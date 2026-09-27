import { describe, expect, it } from 'vitest'
import { CATEGORY_ORDER, catalog, groupCatalog, webglCatalog } from './catalog'
import type { Backend, CatalogEntry } from './catalog'
import { listScenes } from './lab'

const BACKENDS: Backend[] = ['webgpu', 'webgpu-gl', 'webgl']

function entry(id: string, category: string): CatalogEntry {
  return { id, category, name: id, desc: id, backend: 'webgpu', source: 'test', picks: [] }
}

describe('catalog', () => {
  it('keeps GPU-only examples out of the verified WebGL route', () => {
    const ids = webglCatalog().map(entry => entry.id)
    expect(ids).toEqual(expect.arrayContaining(['inkwave-3c', 'quarks', 'retarget', 'ropes', 'tank-cam']))
    expect(ids).not.toContain('crowd')
    expect(ids).not.toContain('ssgi')
    expect(ids).not.toContain('flames')
  })
  it('has unique ids', () => {
    const ids = catalog.map((row) => row.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('only lists scenes that exist in src/scenes', () => {
    const scenes = listScenes()
    for (const row of catalog) {
      expect(scenes, `catalog id "${row.id}" has no scene file`).toContain(row.id)
    }
  })

  it('has a row for every scene file', () => {
    const ids = catalog.map((row) => row.id)
    for (const scene of listScenes()) {
      expect(ids, `scene "${scene}" has no catalog row`).toContain(scene)
    }
  })

  it('uses valid backends', () => {
    for (const row of catalog) {
      expect(BACKENDS).toContain(row.backend)
    }
  })

  it('fills name, desc, category and source for every row', () => {
    for (const row of catalog) {
      expect(row.name.trim(), `${row.id}.name`).not.toBe('')
      expect(row.desc.trim(), `${row.id}.desc`).not.toBe('')
      expect(row.category.trim(), `${row.id}.category`).not.toBe('')
      expect(row.source.trim(), `${row.id}.source`).not.toBe('')
      expect(Array.isArray(row.picks), `${row.id}.picks`).toBe(true)
    }
  })
})

describe('groupCatalog', () => {
  it('orders the seeded catalog by CATEGORY_ORDER', () => {
    const categories = groupCatalog().map((group) => group.category)
    const positions = categories.map((category) => CATEGORY_ORDER.indexOf(category))
    expect(positions.every((position) => position >= 0)).toBe(true)
    expect(positions).toEqual([...positions].sort((a, b) => a - b))
    expect(groupCatalog().flatMap((group) => group.entries)).toHaveLength(catalog.length)
  })

  it('keeps entry order within a group and puts unknown categories last alphabetically', () => {
    const groups = groupCatalog([
      entry('z1', 'zeta'),
      entry('b1', '基础'),
      entry('a1', 'alpha'),
      entry('c1', '角色'),
      entry('c2', '角色'),
    ])
    expect(groups.map((group) => group.category)).toEqual(['角色', '基础', 'alpha', 'zeta'])
    expect(groups[0].entries.map((row) => row.id)).toEqual(['c1', 'c2'])
  })
})
