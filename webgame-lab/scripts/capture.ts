// This browser-focused project does not install @types/node. Keep the untyped
// boundary at built-in imports rather than disabling checks for the script.
// @ts-ignore -- Node built-in is available at runtime; its declarations are absent.
import { mkdir, writeFile } from 'node:fs/promises'
// @ts-ignore -- Node built-in is available at runtime; its declarations are absent.
import { fileURLToPath } from 'node:url'
// @ts-ignore -- Node built-in is available at runtime; its declarations are absent.
import nodeProcess from 'node:process'
import { chromium, type Browser, type Page } from 'playwright-core'
import { createServer, type ViteDevServer } from 'vite'
import { buildLabUrl, evaluateExpectations, parseCaptureArgs } from './capture-args'

const process = nodeProcess as {
  argv: string[]
  exitCode?: number
  on(signal: 'SIGINT', listener: () => void): void
  off(signal: 'SIGINT', listener: () => void): void
}
const root = fileURLToPath(new URL('../', import.meta.url))
const chromeArgs = [
  '--enable-unsafe-webgpu',
  '--enable-gpu',
  '--use-angle=metal',
  '--ignore-gpu-blocklist',
]

interface AdapterInfo {
  vendor: string
  architecture: string
  device: string
  description: string
  isFallbackAdapter: boolean | null
  adapterIsFallbackAdapter: boolean | null
}

const message = (error: unknown) => error instanceof Error ? error.message : String(error)

async function checkBlank(page: Page, png: { toString(encoding: 'base64'): string }) {
  return page.evaluate(async (dataUrl) => {
    const image = new Image()
    image.src = dataUrl
    await image.decode()
    const canvas = document.createElement('canvas')
    canvas.width = image.naturalWidth
    canvas.height = image.naturalHeight
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Cannot create the blank-check 2D canvas')
    context.drawImage(image, 0, 0)
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data
    let count = 0
    let sum = 0
    let squares = 0
    for (let y = 0; y < canvas.height; y += 8) {
      for (let x = 0; x < canvas.width; x += 8) {
        const i = (y * canvas.width + x) * 4
        const luminance = 0.2126 * pixels[i] + 0.7152 * pixels[i + 1] + 0.0722 * pixels[i + 2]
        count++
        sum += luminance
        squares += luminance * luminance
      }
    }
    const stddev = Math.sqrt(Math.max(0, squares / count - (sum / count) ** 2))
    return { blank: stddev < 2, stddev }
  }, `data:image/png;base64,${png.toString('base64')}`)
}

async function main() {
  const argv = process.argv.slice(2)
  const opts = parseCaptureArgs(argv)
  const url = buildLabUrl('http://localhost:5199', opts)
  const evidenceBase = fileURLToPath(new URL(`../evidence/${opts.scene}-${opts.backend}`, import.meta.url))
  const consoleErrors: string[] = []
  const pageErrors: string[] = []
  // Harness failures must never satisfy --expect-fail.
  const captureErrors: string[] = []
  let server: ViteDevServer | undefined
  let browser: Browser | undefined
  let page: Page | undefined
  let interrupted = false
  let chromeVersion: string | null = null
  let userAgent: string | null = null
  let adapter: AdapterInfo | null = null
  let adapterError: string | null = null
  let labBackend: string | null = null
  let labError: string | null = null
  let infoBefore: Record<string, unknown> = {}
  let infoAfter: Record<string, unknown> = {}
  let render: unknown = null
  let blank: boolean | null = null
  let stddev: number | null = null
  const samples: (number | null)[] = []

  async function closeResources() {
    const results = await Promise.allSettled([browser?.close(), server?.close()])
    for (const result of results) {
      if (result.status === 'rejected') captureErrors.push(`Cleanup: ${message(result.reason)}`)
    }
  }
  function onInterrupt() {
    interrupted = true
    process.exitCode = 130
    void closeResources()
  }
  function checkInterrupted() {
    if (interrupted) throw new Error('Capture interrupted by SIGINT')
  }
  process.on('SIGINT', onInterrupt)

  try {
    await mkdir(new URL('../evidence/', import.meta.url), { recursive: true })
    server = await createServer({
      root,
      server: { port: 5199, strictPort: true },
      plugins: [{
        name: 'capture-default-icon',
        // No favicon is declared by the lab. Avoid Chrome's implicit /favicon.ico
        // 404 without filtering any console errors or intercepting scene assets.
        transformIndexHtml(html) {
          if (/<link\b[^>]*\brel\s*=\s*["'][^"']*icon\b/i.test(html)) return html
          return [{ tag: 'link', attrs: { rel: 'icon', href: 'data:,' }, injectTo: 'head' }]
        },
      }],
    })
    checkInterrupted()
    await server.listen()
    checkInterrupted()
    browser = await chromium.launch({
      channel: 'chrome', headless: true, args: chromeArgs, handleSIGINT: false,
    })
    checkInterrupted()
    chromeVersion = browser.version()
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1,
    })
    const probe = await context.newPage()
    // A fresh about:blank is not a secure context. Serve empty HTML at localhost
    // so WebGPU is available without loading any scene or application scripts.
    const probeUrl = 'http://localhost:5199/__capture_adapter__'
    await probe.route(probeUrl, (route) => route.fulfill({
      contentType: 'text/html', body: '<!doctype html><title>Adapter probe</title>',
    }))
    await probe.goto(probeUrl)
    const detected = await probe.evaluate(async () => {
      const a = await navigator.gpu?.requestAdapter()
      const info = a?.info
      const legacy = a as (typeof a & { isFallbackAdapter?: boolean })
      return {
        userAgent: navigator.userAgent,
        adapter: a && info ? {
          vendor: info.vendor,
          architecture: info.architecture,
          device: info.device,
          description: info.description,
          isFallbackAdapter: info.isFallbackAdapter ?? null,
          adapterIsFallbackAdapter: legacy?.isFallbackAdapter ?? null,
        } : null,
      }
    })
    userAgent = detected.userAgent
    adapter = detected.adapter
    await probe.close()
    const software = adapter && (adapter.isFallbackAdapter === true
      || adapter.adapterIsFallbackAdapter === true
      || /swiftshader|llvmpipe|lavapipe|software|microsoft basic render/i.test(
        [adapter.vendor, adapter.architecture, adapter.device, adapter.description].join(' '),
      ))
    if (opts.backend !== 'webgl' && (!adapter || software)) {
      adapterError = `A real non-fallback WebGPU adapter is required for ${opts.backend}; received ${JSON.stringify(adapter)}; flags: ${chromeArgs.join(' ')}`
      throw new Error(adapterError)
    }

    page = await context.newPage()
    page.setDefaultTimeout(30_000)
    page.on('console', (event) => {
      if (event.type() === 'error') {
        const location = event.location()
        consoleErrors.push(`${event.text()}${location.url ? ` (${location.url}:${location.lineNumber})` : ''}`)
      }
    })
    page.on('pageerror', (error) => pageErrors.push(message(error)))
    await page.goto(url)
    await page.waitForFunction(() => window.__LAB__?.ready === true, undefined, { timeout: 30_000 })
    labError = await page.evaluate(() => window.__LAB__?.error ?? null)
    // Give async scene assets time to load before expectations are read.
    if (opts.waitMs > 0) await page.waitForTimeout(opts.waitMs)
    infoBefore = await page.evaluate(() => window.__LAB__?.info ?? {})
    await page.mouse.click(640, 360)
    // The parser stores holds and presses separately; retain their CLI order.
    let holdIndex = 0
    let pressIndex = 0
    for (let index = 0; index < argv.length; index++) {
      const flag = argv[index]
      if (flag === '--hold') {
        const { code, ms } = opts.holds[holdIndex++]
        await page.keyboard.down(code)
        try {
          await page.waitForTimeout(ms)
        } finally {
          await page.keyboard.up(code)
        }
      } else if (flag === '--press') {
        await page.keyboard.press(opts.presses[pressIndex++])
      }
      if (flag !== '--expect-fail') index++
    }
    await page.waitForTimeout(300)
    infoAfter = await page.evaluate(() => window.__LAB__?.info ?? {})
    const sampleStart = performance.now()
    for (let index = 1; index <= 10; index++) {
      await page.waitForTimeout(Math.max(0, sampleStart + index * 500 - performance.now()))
      samples.push(await page.evaluate(() => {
        const fps = window.__LAB__?.fps
        return typeof fps === 'number' && Number.isFinite(fps) ? fps : null
      }))
    }
  } catch (error) {
    captureErrors.push(message(error))
  } finally {
    try {
      if (page && !page.isClosed() && !interrupted) {
        try {
          const state = await page.evaluate(() => ({
            render: window.__LAB__?.info.render ?? null,
            backend: window.__LAB__?.backend ?? null,
            error: window.__LAB__?.error ?? null,
          }))
          render = state.render
          labBackend = state.backend
          labError = state.error ?? labError
        } catch (error) {
          captureErrors.push(`Read lab state: ${message(error)}`)
        }
        const png = await page.screenshot({ path: `${evidenceBase}.png` })
        const checker = await page.context().newPage()
        try {
          ;({ blank, stddev } = await checkBlank(checker, png))
        } finally {
          await checker.close()
        }
      }
    } catch (error) {
      captureErrors.push(`Screenshot: ${message(error)}`)
    } finally {
      await closeResources()
      process.off('SIGINT', onInterrupt)
    }
  }

  const validSamples = samples.filter((sample): sample is number => sample !== null)
  const fps = {
    avg: validSamples.length ? validSamples.reduce((sum, value) => sum + value, 0) / validSamples.length : null,
    min: validSamples.length ? Math.min(...validSamples) : null,
    max: validSamples.length ? Math.max(...validSamples) : null,
    samples,
  }
  const expectedBackend = { webgpu: 'webgpu', 'webgpu-gl': 'webgl2', webgl: 'webgl-classic' }[opts.backend]
  const backendMismatch = labBackend !== expectedBackend
  const expectations = evaluateExpectations(opts.expects, infoBefore, infoAfter)
  const errorCount = consoleErrors.length + pageErrors.length + (labError ? 1 : 0)
  const passed = !interrupted && (opts.expectFail ? errorCount > 0 : (
    errorCount === 0 && captureErrors.length === 0 && blank === false
    && !backendMismatch && !adapterError && expectations.every((result) => result.ok)
  ))
  await writeFile(`${evidenceBase}.json`, `${JSON.stringify({
    scene: opts.scene, backend: opts.backend, labBackend, url, headless: true,
    chromeVersion, userAgent, chromeArgs, adapter, adapterError, fps, render,
    infoBefore, infoAfter, consoleErrors, pageErrors, labError, captureErrors,
    expectations, blank, stddev, backendMismatch, expectFail: opts.expectFail, waitMs: opts.waitMs,
    timestamp: new Date().toISOString(), verdict: passed ? 'PASS' : 'FAIL',
  }, null, 2)}\n`)
  for (const error of [...consoleErrors, ...pageErrors, ...(labError ? [labError] : []), ...captureErrors]) {
    console.error(error)
  }
  if (backendMismatch) console.error(`Backend mismatch: expected ${expectedBackend}, received ${labBackend}`)
  if (blank) console.error(`Blank frame: luminance stddev ${stddev} < 2`)
  for (const result of expectations) if (!result.ok) console.error(result.detail)
  const drawCalls = (render as { drawCalls?: number } | null)?.drawCalls ?? 'n/a'
  const adapterLabel = adapter ? [adapter.vendor, adapter.architecture, adapter.device, adapter.description].filter(Boolean).join('/') : 'none'
  console.log(`backend=${opts.backend} labBackend=${labBackend} adapter=${adapterLabel} fps.avg=${fps.avg?.toFixed(1) ?? 'n/a'} drawCalls=${drawCalls} errors=${errorCount} verdict=${passed ? 'PASS' : 'FAIL'}`)
  process.exitCode = interrupted ? 130 : passed ? 0 : 1
}

main().catch((error: unknown) => {
  console.error(`Capture failed: ${message(error)}`)
  process.exitCode = process.exitCode === 130 ? 130 : 1
})
