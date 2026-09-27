import { afterEach, describe, expect, it, vi } from 'vitest'
import { frameHint, frameReadoutRows, parseEmbedParams } from './embed'

afterEach(() => vi.unstubAllGlobals())

describe('parseEmbedParams', () => {
  it.each([
    ['zh-CN', true, 'zh', 'dark'],
    ['zh-TW', false, 'zh', 'light'],
    ['ZH-HK', false, 'zh', 'light'],
    ['en-US', false, 'en', 'light'],
    ['fr-FR', true, 'en', 'dark'],
  ])('defaults from browser language %s and dark preference %s', (language, dark, lang, theme) => {
    vi.stubGlobal('navigator', { language })
    const matchMedia = vi.fn(() => ({ matches: dark }))
    vi.stubGlobal('window', { matchMedia })
    expect(parseEmbedParams('')).toEqual({ embed: false, lang, theme })
    expect(matchMedia).toHaveBeenCalledWith('(prefers-color-scheme: dark)')
  })

  it.each([
    ['?embed=1&theme=light&lang=en', 'zh-CN', true, 'light', 'en'],
    ['?embed=1&theme=dark&lang=zh', 'en-US', false, 'dark', 'zh'],
  ])('honors overrides in %s', (query, language, dark, theme, lang) => {
    expect(parseEmbedParams(query, language, dark)).toEqual({ embed: true, theme, lang })
  })

  it.each(['', '0', 'true', '2'])('only enables embed for the literal 1, not %j', (value) => {
    expect(parseEmbedParams(`?embed=${value}`, 'en-US', false).embed).toBe(false)
  })

  it.each(['?theme=&lang=', '?theme=system&lang=fr'])('falls back for invalid overrides: %s', (query) => {
    expect(parseEmbedParams(query, 'zh-CN', true)).toEqual({ embed: false, theme: 'dark', lang: 'zh' })
  })

  it('keeps embed enabled regardless of menu, panel, or unrelated scene parameters', () => {
    expect(parseEmbedParams('?scene=crowd&embed=1&menu=1&panel=0', 'en', false))
      .toEqual({ embed: true, theme: 'light', lang: 'en' })
  })
})

describe('observeFrameHeight', () => {
  it('posts integer content height on mount, load and resize, then cleans up', async () => {
    const { observeFrameHeight } = await import('./embed')
    let height = 534.375
    const root = { getBoundingClientRect: () => ({ height }) }
    const parent = { postMessage: vi.fn() }
    const events = new Map<string, () => void>()
    const win = {
      parent, document: { documentElement: root },
      addEventListener: vi.fn((name, callback) => events.set(name, callback)),
      removeEventListener: vi.fn((name) => events.delete(name)),
    }
    let resize = () => {}
    const observe = vi.fn(), disconnect = vi.fn()
    vi.stubGlobal('ResizeObserver', class {
      constructor(callback: () => void) { resize = callback }
      observe = observe
      disconnect = disconnect
    })
    const stop = observeFrameHeight(win as unknown as Window)
    expect(observe).toHaveBeenCalledWith(root)
    expect(parent.postMessage).toHaveBeenLastCalledWith({ type: 'gameref:frame-height', height: 535 }, '*')
    height = 812.1
    events.get('load')!()
    expect(parent.postMessage).toHaveBeenLastCalledWith({ type: 'gameref:frame-height', height: 813 }, '*')
    height = 600 // Shrinking must not retain the previous iframe/viewport height.
    resize()
    expect(parent.postMessage).toHaveBeenLastCalledWith({ type: 'gameref:frame-height', height: 600 }, '*')
    stop()
    expect(disconnect).toHaveBeenCalledOnce()
    expect(events.has('load')).toBe(false)
  })

  it('does not post or observe when opened standalone', async () => {
    const { observeFrameHeight } = await import('./embed')
    const observer = vi.fn()
    vi.stubGlobal('ResizeObserver', observer)
    const win = {} as Window
    Object.assign(win, { parent: win })
    expect(() => observeFrameHeight(win)()).not.toThrow()
    expect(observer).not.toHaveBeenCalled()
  })
})

describe('frame console presentation', () => {
  it('formats nested snapshots as key/value rows, including zero and false', () => {
    expect(frameReadoutRows({ Audio: { enabled: false, voices: 0 }, Ticks: 42, Speed: null }))
      .toEqual([['Audio · enabled', 'false'], ['Audio · voices', '0'], ['Ticks', '42'], ['Speed', '—']])
  })

  it('keeps input hints but removes directions to controls below the picture', () => {
    expect(frameHint('drive', 'en')).toContain('WASD')
    expect(frameHint('inkwave-ui', 'zh')).toContain('Tab / Enter')
    expect(frameHint('inkwave-audio', 'zh')).toBe('拖动画面旋转 · 滚轮缩放')
    for (const scene of ['look', 'look-post', 'look-presets', 'lut', 'fog', 'rain']) {
      expect(frameHint(scene, 'en')).toBe('Drag: orbit · Scroll: zoom')
    }
    expect(frameHint('birds', 'en')).toBe('Move pointer to repel the flock')
    expect(frameHint('navcrowd', 'en')).toBe('Click the ground to interact')
  })
})
