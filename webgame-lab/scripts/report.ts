// This browser-focused project does not install @types/node. Keep the untyped
// boundary at built-in imports rather than disabling checks for the script.
// @ts-ignore -- Node built-in is available at runtime; its declarations are absent.
import { readdir, readFile, writeFile } from 'node:fs/promises'
// @ts-ignore -- Node built-in is available at runtime; its declarations are absent.
import { fileURLToPath } from 'node:url'
// @ts-ignore -- Node built-in is available at runtime; its declarations are absent.
import nodeProcess from 'node:process'
import { catalog, groupCatalog, type CatalogEntry } from '../src/catalog'

const process = nodeProcess as { argv: string[]; exitCode?: number }

/** One evidence JSON as written by scripts/capture.ts; `file` is the basename without extension. */
export interface EvidenceRecord {
  file: string
  data: Record<string, unknown>
  hasScreenshot: boolean
}

export interface SceneCard {
  id: string
  file: string
  backend: string | null
  labBackend: string | null
  /** capture.ts compares labBackend against the expected renderer for `backend`. */
  backendMismatch: boolean
  name: string | null
  desc: string | null
  category: string | null
  picks: string[]
  note: string | null
  screenshot: string | null
  fps: { avg: number | null; min: number | null; max: number | null }
  drawCalls: number | null
  triangles: number | null
  /** null when the record has no error fields at all (older shapes). */
  errorCount: number | null
  errors: string[]
  verdict: string | null
  adapter: string | null
  timestamp: string | null
  infoAfter: unknown
}

export interface ReportModel {
  groups: { category: string; cards: SceneCard[] }[]
  extras: SceneCard[]
  missing: CatalogEntry[]
  compareImages: { file: string; sceneId: string | null; name: string | null }[]
  summary: {
    scenes: number
    withEvidence: number
    passed: number
    missing: number
    totalErrors: number
    avgFps: number | null
    adapters: string[]
  }
}

// Longest first so `boot-webgpu-gl` is not read as scene `boot-webgpu`.
const BACKEND_SUFFIXES = ['webgpu-gl', 'webgpu', 'webgl']

const num = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : null
const str = (value: unknown) => typeof value === 'string' && value !== '' ? value : null
const obj = (value: unknown) => value && typeof value === 'object' && !Array.isArray(value)
  ? value as Record<string, unknown> : null
const strings = (value: unknown) => Array.isArray(value) ? value.map(String) : null

/** Scene id and backend from the JSON fields, falling back to the `<scene>-<backend>` file name. */
export function identify(record: EvidenceRecord): { id: string; backend: string | null } {
  const scene = str(record.data.scene)
  const backend = str(record.data.backend)
  if (scene) return { id: scene, backend }
  for (const suffix of BACKEND_SUFFIXES) {
    if (record.file.endsWith(`-${suffix}`)) return { id: record.file.slice(0, -suffix.length - 1), backend: suffix }
  }
  return { id: record.file, backend }
}

export function adapterLabel(value: unknown): string | null {
  const adapter = obj(value)
  if (!adapter) return null
  const label = [adapter.vendor, adapter.architecture, adapter.device, adapter.description]
    .map(str).filter(Boolean).join('/')
  return label || null
}

function toCard(record: EvidenceRecord, entry: CatalogEntry | undefined): SceneCard {
  const { id, backend } = identify(record)
  const data = record.data
  const fps = obj(data.fps)
  const render = obj(data.render) ?? obj(obj(data.infoAfter)?.render)
  const lists = [data.consoleErrors, data.pageErrors, data.captureErrors].map(strings)
  const labError = str(data.labError)
  const hasErrorFields = lists.some((list) => list !== null) || 'labError' in data
  const errors = [...lists.flatMap((list) => list ?? []), ...(labError ? [labError] : [])]
  return {
    id,
    file: record.file,
    backend,
    labBackend: str(data.labBackend),
    backendMismatch: data.backendMismatch === true,
    name: entry?.name ?? null,
    desc: entry?.desc ?? null,
    category: entry?.category ?? null,
    picks: entry?.picks ?? [],
    note: entry?.note ?? null,
    screenshot: record.hasScreenshot ? `${record.file}.png` : null,
    fps: { avg: num(fps?.avg), min: num(fps?.min), max: num(fps?.max) },
    drawCalls: num(render?.drawCalls),
    triangles: num(render?.triangles),
    errorCount: hasErrorFields ? errors.length : null,
    errors,
    verdict: str(data.verdict),
    adapter: adapterLabel(data.adapter),
    timestamp: str(data.timestamp),
    infoAfter: data.infoAfter ?? null,
  }
}

const byFile = (a: { file: string }, b: { file: string }) => a.file < b.file ? -1 : a.file > b.file ? 1 : 0

/**
 * Pure model behind the report. Each catalog row takes the evidence for its own
 * backend (or, failing that, its first evidence file); every other record is an extra.
 */
export function buildReportModel(entries: CatalogEntry[], records: EvidenceRecord[], images: string[] = []): ReportModel {
  const sorted = [...records].sort(byFile)
  const known = new Map(entries.map((entry) => [entry.id, entry]))
  const used = new Set<string>()
  const primary = new Map<string, SceneCard>()
  for (const entry of entries) {
    const mine = sorted.filter((record) => identify(record).id === entry.id)
    const record = mine.find((candidate) => identify(candidate).backend === entry.backend) ?? mine[0]
    if (!record) continue
    used.add(record.file)
    primary.set(entry.id, toCard(record, entry))
  }

  const groups = groupCatalog(entries)
    .map(({ category, entries: rows }) => ({
      category,
      cards: rows.map((row) => primary.get(row.id)).filter((card): card is SceneCard => card !== undefined),
    }))
    .filter((group) => group.cards.length > 0)
  const extras = sorted.filter((record) => !used.has(record.file))
    .map((record) => toCard(record, known.get(identify(record).id)))
  const missing = entries.filter((entry) => !primary.has(entry.id))

  // Match a comparison image to the longest catalog id it starts with.
  const ids = [...known.keys()].sort((a, b) => b.length - a.length)
  const compareImages = [...images].sort().map((file) => {
    const sceneId = ids.find((id) => file.startsWith(`${id}-`)) ?? null
    return { file, sceneId, name: sceneId ? known.get(sceneId)?.name ?? null : null }
  })

  const cards = [...primary.values()]
  const fpsValues = cards.map((card) => card.fps.avg).filter((value): value is number => value !== null)
  return {
    groups,
    extras,
    missing,
    compareImages,
    summary: {
      scenes: entries.length,
      withEvidence: cards.length,
      passed: cards.filter((card) => card.verdict === 'PASS').length,
      missing: missing.length,
      totalErrors: cards.reduce((sum, card) => sum + (card.errorCount ?? 0), 0),
      avgFps: fpsValues.length ? fpsValues.reduce((sum, value) => sum + value, 0) / fpsValues.length : null,
      adapters: [...new Set(sorted.map((record) => adapterLabel(record.data.adapter)).filter((label): label is string => label !== null))].sort(),
    },
  }
}

const DASH = '—'
const escape = (value: string) => value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
const fmt = (value: number | null, digits = 0) => value === null ? DASH : value.toFixed(digits)

function fpsText(fps: SceneCard['fps']) {
  if (fps.avg === null) return DASH
  const range = fps.min !== null && fps.max !== null ? `（${fmt(fps.min)}–${fmt(fps.max)}）` : ''
  return `${fmt(fps.avg, 1)}${range}`
}

function verdictBadge(verdict: string | null) {
  if (verdict === 'PASS') return '<span class="badge pass">PASS 通过</span>'
  if (verdict === 'FAIL') return '<span class="badge fail">FAIL 未通过</span>'
  return `<span class="badge">${verdict ? escape(verdict) : DASH}</span>`
}

function renderCard(card: SceneCard, small = false) {
  const title = card.name ?? card.id
  const backend = card.backend ?? DASH
  const actual = card.backendMismatch ? ` <span class="bad">（实际是 ${escape(card.labBackend ?? DASH)}，不符）</span>` : ''
  const label = small
    ? { backend: '后端', fps: '帧率', draws: '绘制次数' }
    : { backend: '渲染后端', fps: '帧率（每秒画面数）', draws: '绘制次数（draw calls）' }
  const errorClass = card.errorCount !== null && card.errorCount > 0 ? ' class="bad"' : ''
  const shot = card.screenshot
    ? `<img src="${escape(card.screenshot)}" loading="lazy" alt="${escape(title)} 截图">`
    : '<div class="noshot">没有截图</div>'
  const errorList = card.errors.length
    ? `<details class="errors"><summary>错误内容（${card.errors.length}）</summary><pre>${escape(card.errors.join('\n'))}</pre></details>`
    : ''
  return `<article class="card${small ? ' small' : ''}">
<div class="shot">${shot}</div>
<div class="body">
<h3>${escape(title)} ${verdictBadge(card.verdict)}</h3>
<p class="id"><code>${escape(card.file)}</code>${card.picks.length ? ` · 编号 ${escape(card.picks.join('、'))}` : ''}</p>
${card.desc && !small ? `<p class="desc">${escape(card.desc)}</p>` : ''}
<dl>
<dt>${label.backend}</dt><dd><code>${escape(backend)}</code>${actual}</dd>
<dt>${label.fps}</dt><dd>${fpsText(card.fps)}</dd>
<dt>${label.draws}</dt><dd>${fmt(card.drawCalls)}</dd>
<dt>错误</dt><dd${errorClass}>${fmt(card.errorCount)}</dd>
</dl>
${card.note ? `<p class="note">注意：${escape(card.note)}</p>` : ''}
${errorList}
<details><summary>运行后状态（infoAfter）</summary><pre>${escape(JSON.stringify(card.infoAfter, null, 2) ?? DASH)}</pre></details>
</div>
</article>`
}

const CSS = `
:root{--bg:#f6f7f9;--fg:#1c1e21;--muted:#65676b;--card:#fff;--line:#e3e5e8;--pass:#1a7f37;--fail:#cf222e;--failbg:#ffebe9;--code:#eef0f3}
@media (prefers-color-scheme:dark){:root{--bg:#111315;--fg:#e6e8eb;--muted:#9aa0a6;--card:#1c1f23;--line:#2e3338;--pass:#3fb950;--fail:#ff7b72;--failbg:#3b1a1a;--code:#262a2f}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.6 -apple-system,BlinkMacSystemFont,"PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif}
main{max-width:1400px;margin:0 auto;padding:24px 16px 64px}
h1{font-size:26px;margin:0 0 16px}
h2{font-size:20px;margin:32px 0 12px;padding-bottom:6px;border-bottom:1px solid var(--line)}
h2 .count{color:var(--muted);font-weight:normal;font-size:15px}
h3{font-size:16px;margin:0 0 4px;display:flex;flex-wrap:wrap;gap:6px;align-items:center;justify-content:space-between}
code,pre{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px}
code{background:var(--code);padding:1px 5px;border-radius:4px}
pre{background:var(--code);padding:8px;border-radius:6px;overflow:auto;max-height:320px;white-space:pre-wrap;word-break:break-word}
.summary{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px}
.stat{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:10px 14px}
.stat b{display:block;font-size:22px}
.stat span{color:var(--muted);font-size:13px}
.stat.wide{grid-column:1/-1}
.stat.wide b{font-size:15px;font-weight:normal}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,320px),1fr));gap:14px}
.grid.small{grid-template-columns:repeat(auto-fill,minmax(min(100%,230px),1fr))}
.card{background:var(--card);border:1px solid var(--line);border-radius:12px;overflow:hidden;display:flex;flex-direction:column}
.shot{aspect-ratio:16/9;background:var(--code)}
.shot img{width:100%;height:100%;object-fit:cover;display:block}
.noshot{height:100%;display:flex;align-items:center;justify-content:center;color:var(--muted)}
.body{padding:10px 14px 14px}
.id{margin:0;color:var(--muted);font-size:12px}
.desc{margin:6px 0}
.note{margin:6px 0;font-size:13px;color:var(--muted)}
dl{display:grid;grid-template-columns:auto 1fr;gap:2px 12px;margin:8px 0;font-size:14px}
dt{color:var(--muted)}
dd{margin:0}
dd.bad,.bad{color:var(--fail);font-weight:bold}
.card.small .body{font-size:13px}
.card.small dl{font-size:13px}
.badge{font-size:12px;padding:1px 8px;border-radius:999px;border:1px solid var(--line);white-space:nowrap}
.badge.pass{color:var(--pass);border-color:var(--pass)}
.badge.fail{color:#fff;background:var(--fail);border-color:var(--fail)}
details{margin-top:6px;font-size:13px}
summary{cursor:pointer;color:var(--muted)}
details.errors summary{color:var(--fail)}
.missing{background:var(--failbg);border:1px solid var(--fail);border-radius:12px;padding:12px 16px}
.missing h2{color:var(--fail);border-color:var(--fail);margin-top:0}
.missing li{margin:4px 0}
.ok{color:var(--pass)}
figure{margin:0;background:var(--card);border:1px solid var(--line);border-radius:12px;overflow:hidden}
figure img{width:100%;display:block}
figcaption{padding:8px 12px;font-size:13px;color:var(--muted)}
.compare{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,480px),1fr));gap:14px}
`

export function renderReport(model: ReportModel, generatedAt: string): string {
  const s = model.summary
  const missingSection = model.missing.length
    ? `<section class="missing"><h2>缺少证据 <span class="count">${model.missing.length} 个场景</span></h2>
<p>下面这些场景在清单里，但 evidence/ 里找不到它们的测试记录。</p>
<ul>${model.missing.map((entry) => `<li><b>${escape(entry.name)}</b> <code>${escape(entry.id)}-${escape(entry.backend)}</code> · ${escape(entry.category)}</li>`).join('')}</ul></section>`
    : ''
  const groups = model.groups.map((group) => `<section><h2>${escape(group.category)} <span class="count">${group.cards.length} 个</span></h2>
<div class="grid">${group.cards.map((card) => renderCard(card)).join('\n')}</div></section>`).join('\n')
  const extras = model.extras.length
    ? `<section><h2>其他截图（额外后端） <span class="count">${model.extras.length} 个</span></h2>
<p class="note">同一个场景换别的渲染后端跑的结果，或不在清单里的截图，仅供参考。</p>
<div class="grid small">${model.extras.map((card) => renderCard(card, true)).join('\n')}</div></section>`
    : ''
  const compare = model.compareImages.length
    ? `<section><h2>对比图 <span class="count">${model.compareImages.length} 张</span></h2>
<div class="compare">${model.compareImages.map((image) => `<figure><img src="${escape(image.file)}" loading="lazy" alt="${escape(image.file)}"><figcaption>${image.name ? `${escape(image.name)} · ` : ''}<code>${escape(image.file)}</code></figcaption></figure>`).join('\n')}</div></section>`
    : ''
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>WebGPU 游戏实验室 · 验收报告</title>
<style>${CSS}</style>
</head>
<body>
<main>
<h1>WebGPU 游戏实验室 · 验收报告</h1>
<div class="summary">
<div class="stat"><b>${s.scenes}</b><span>场景总数</span></div>
<div class="stat"><b class="${s.passed === s.withEvidence && s.missing === 0 ? 'ok' : ''}">${s.passed} / ${s.withEvidence}</b><span>通过 / 有记录</span></div>
<div class="stat"><b${s.missing ? ' style="color:var(--fail)"' : ''}>${s.missing}</b><span>缺少证据</span></div>
<div class="stat"><b${s.totalErrors ? ' style="color:var(--fail)"' : ''}>${s.totalErrors}</b><span>错误总数</span></div>
<div class="stat"><b>${fmt(s.avgFps, 1)}</b><span>平均帧率</span></div>
<div class="stat"><b style="font-size:15px">${escape(generatedAt)}</b><span>生成时间</span></div>
<div class="stat wide"><b><code>${s.adapters.length ? escape(s.adapters.join('，')) : DASH}</code></b><span>显卡（adapter）</span></div>
</div>
${missingSection}
${groups}
${extras}
${compare}
</main>
</body>
</html>
`
}

async function main() {
  const dir = new URL('../evidence/', import.meta.url)
  const names = (await readdir(dir) as string[]).sort()
  const present = new Set(names)
  const records: EvidenceRecord[] = []
  for (const name of names.filter((file) => file.endsWith('.json'))) {
    const file = name.slice(0, -'.json'.length)
    let data: Record<string, unknown> = {}
    try {
      data = obj(JSON.parse(await readFile(new URL(name, dir), 'utf8'))) ?? {}
    } catch (error) {
      data = { captureErrors: [`Unreadable evidence JSON: ${error instanceof Error ? error.message : String(error)}`] }
    }
    records.push({ file, data, hasScreenshot: present.has(`${file}.png`) })
  }
  const images = names.filter((file) => /\.(jpe?g|png|webp)$/i.test(file)
    && !present.has(`${file.replace(/\.[^.]+$/, '')}.json`))
  const model = buildReportModel(catalog, records, images)
  const generatedAt = new Date().toLocaleString('zh-CN', { hour12: false })
  await writeFile(new URL('report.html', dir), renderReport(model, generatedAt))
  const s = model.summary
  console.log(`report: scenes=${s.scenes} withEvidence=${s.withEvidence} passed=${s.passed} missing=${s.missing} extras=${model.extras.length} compare=${model.compareImages.length} errors=${s.totalErrors} avgFps=${fmt(s.avgFps, 1)}`)
  for (const entry of model.missing) console.error(`Missing evidence: ${entry.id}-${entry.backend}`)
}

// Run only as a script, not when the test imports the pure functions.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error: unknown) => {
    console.error(`Report failed: ${error instanceof Error ? error.message : String(error)}`)
    process.exitCode = 1
  })
}
