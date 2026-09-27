import { describe, expect, it } from 'vitest'
import type { CatalogEntry } from '../src/catalog'
import { buildReportModel, identify, renderReport, type EvidenceRecord } from './report'

const row = (id: string, category: string, extra: Partial<CatalogEntry> = {}): CatalogEntry => ({
  id, category, name: `名字-${id}`, desc: `描述-${id}`, backend: 'webgpu', source: 'test', picks: [], ...extra,
})

const full = (scene: string, backend: string, extra: Record<string, unknown> = {}): EvidenceRecord => ({
  file: `${scene}-${backend}`,
  hasScreenshot: true,
  data: {
    scene, backend, labBackend: backend,
    adapter: { vendor: 'apple', architecture: 'metal-3', device: '', description: '' },
    fps: { avg: 60, min: 58, max: 61, samples: [] },
    render: { drawCalls: 12, triangles: 34 },
    consoleErrors: [], pageErrors: [], labError: null, captureErrors: [],
    infoAfter: { ok: true }, verdict: 'PASS',
    ...extra,
  },
})

const entries = [
  row('boot', '基础'),
  row('zeta', '自定义'),
  row('feel', '角色'),
  row('alpha', '自定义'),
  row('sky', '天空', { note: '注意事项' }),
  row('lightning', '天空', { backend: 'webgl' }),
]

describe('buildReportModel', () => {
  it('groups cards in CATEGORY_ORDER, unknown categories last, rows in catalog order', () => {
    const records = entries.map((entry) => full(entry.id, entry.backend)).reverse()
    const model = buildReportModel(entries, records)
    expect(model.groups.map((group) => group.category)).toEqual(['角色', '天空', '基础', '自定义'])
    expect(model.groups[1].cards.map((card) => card.id)).toEqual(['sky', 'lightning'])
    expect(model.groups[3].cards.map((card) => card.id)).toEqual(['zeta', 'alpha'])
    expect(model.groups[1].cards[0]).toMatchObject({ name: '名字-sky', note: '注意事项', screenshot: 'sky-webgpu.png' })
    expect(model.missing).toEqual([])
    expect(model.summary).toMatchObject({ scenes: 6, withEvidence: 6, passed: 6, missing: 0, totalErrors: 0, avgFps: 60 })
    expect(model.summary.adapters).toEqual(['apple/metal-3'])
  })

  it('reports catalog rows that have no evidence at all as missing', () => {
    const model = buildReportModel(entries, [full('boot', 'webgpu'), full('sky', 'webgpu')])
    expect(model.missing.map((entry) => entry.id)).toEqual(['zeta', 'feel', 'alpha', 'lightning'])
    expect(model.summary).toMatchObject({ scenes: 6, withEvidence: 2, missing: 4 })
    expect(model.groups.map((group) => group.category)).toEqual(['天空', '基础'])
  })

  it('uses the catalog backend as primary and lists other backends and unknown scenes as extras', () => {
    const records = [
      full('boot', 'webgl'),
      full('boot', 'webgpu-gl'),
      full('boot', 'webgpu'),
      full('lightning', 'webgpu', { verdict: 'FAIL' }),
      full('lightning', 'webgl'),
      full('stray', 'webgpu'),
    ]
    const model = buildReportModel(entries, records)
    const primary = model.groups.flatMap((group) => group.cards).map((card) => card.file)
    expect(primary).toEqual(['lightning-webgl', 'boot-webgpu'])
    expect(model.extras.map((card) => card.file)).toEqual(['boot-webgl', 'boot-webgpu-gl', 'lightning-webgpu', 'stray-webgpu'])
    expect(model.extras[3].name).toBeNull()
    expect(model.extras[0].name).toBe('名字-boot')
  })

  it('falls back to another backend rather than calling a scene missing', () => {
    const model = buildReportModel([row('boot', '基础')], [full('boot', 'webgpu-gl')])
    expect(model.missing).toEqual([])
    expect(model.groups[0].cards[0].file).toBe('boot-webgpu-gl')
  })

  it('handles records with missing fields', () => {
    const sparse: EvidenceRecord = { file: 'feel-webgpu', hasScreenshot: false, data: {} }
    const partial = full('sky', 'webgpu', { fps: { avg: null, min: null, max: null }, render: null, consoleErrors: ['boom'], labError: 'bad', verdict: 'FAIL' })
    delete partial.data.adapter
    const model = buildReportModel(entries, [sparse, partial])
    const feel = model.groups[0].cards[0]
    expect(identify(sparse)).toEqual({ id: 'feel', backend: 'webgpu' })
    expect(feel).toMatchObject({
      id: 'feel', backend: 'webgpu', labBackend: null, screenshot: null, verdict: null,
      fps: { avg: null, min: null, max: null }, drawCalls: null, errorCount: null, adapter: null, infoAfter: null,
    })
    const sky = model.groups[1].cards[0]
    expect(sky).toMatchObject({ errorCount: 2, errors: ['boom', 'bad'], drawCalls: null, verdict: 'FAIL' })
    expect(model.summary).toMatchObject({ passed: 0, totalErrors: 2, avgFps: null, adapters: [] })

    const html = renderReport(model, '2026-09-24 12:00:00')
    expect(html).toContain('<title>WebGPU 游戏实验室 · 验收报告</title>')
    expect(html).toContain('没有截图')
    expect(html).toContain('缺少证据')
    expect(html).toContain('<dd class="bad">2</dd>')
    expect(html).not.toContain('undefined')
    expect(html).not.toContain('NaN')
  })

  it('escapes evidence text and matches comparison images to scenes', () => {
    const model = buildReportModel(entries, [full('boot', 'webgpu', { consoleErrors: ['<script>x</script>'] })], ['sky-noon-dusk.jpg', 'x.jpg'])
    expect(model.compareImages).toEqual([
      { file: 'sky-noon-dusk.jpg', sceneId: 'sky', name: '名字-sky' },
      { file: 'x.jpg', sceneId: null, name: null },
    ])
    const html = renderReport(model, 'now')
    expect(html).not.toContain('<script>')
    expect(html).toContain('&#60;script&#62;')
  })
})
