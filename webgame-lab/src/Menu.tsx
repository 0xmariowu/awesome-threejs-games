import { useEffect, useState } from 'react'
import { catalog, groupCatalog, webglCatalog, type CatalogEntry } from './catalog'
import { setInfo } from './lab'

// Params that survive a scene switch; everything else is scene-specific.
const KEPT_PARAMS = ['panel', 'menu']

// Inline styles cannot express :focus-visible or :hover, so rows get a class.
const ROW_CSS = `
.lab-menu-row:hover { background: rgba(255, 255, 255, 0.08); }
.lab-menu-row:focus-visible { outline: 2px solid #8ab4ff; outline-offset: -2px; }
`

function openEntry(entry: CatalogEntry, collection: string) {
  const current = new URLSearchParams(location.search)
  const query = new URLSearchParams([['scene', entry.id], ['backend', collection === 'webgl' ? 'webgl' : entry.backend], ['collection', collection]])
  for (const key of KEPT_PARAMS) {
    const value = current.get(key)
    if (value !== null) query.set(key, value)
  }
  location.search = query.toString()
}

export default function Menu() {
  const [{ shown, scene }] = useState(() => {
    const query = new URLSearchParams(location.search)
    const hidden = navigator.webdriver === true || query.get('panel') === '0'
    return { shown: query.get('embed') !== '1' && (query.get('menu') === '1' || !hidden), scene: query.get('scene') ?? 'boot' }
  })

  useEffect(() => {
    // App's effect runs after this child effect and calls initLab(), which
    // resets __LAB__.info; publish on the next task so the value survives.
    const timer = window.setTimeout(() => setInfo('menu', { entries: catalog.length, shown }), 0)
    return () => window.clearTimeout(timer)
  }, [shown])

  const [expanded, setExpanded] = useState(() => innerWidth > 760)
  const [collection, setCollection] = useState(() => new URLSearchParams(location.search).get('collection') === 'webgl' ? 'webgl' : scene.startsWith('inkwave-') ? 'inkwave' : 'general')
  const groups = collection === 'inkwave'
    ? [{ category: '完整系统 → 通用模块', entries: catalog.filter(entry => entry.collection === 'inkwave') }]
    : groupCatalog(collection === 'webgl' ? webglCatalog() : catalog.filter(entry => !entry.collection))
  if (!shown) return null

  return (
    <nav aria-label="Scene menu" style={{
      position: 'absolute', top: 96, left: 12, zIndex: 4,
      width: 260, maxWidth: 'calc(100% - 24px)', maxHeight: 'calc(100% - 108px)',
      overflowY: 'auto', boxSizing: 'border-box', padding: 8,
      color: '#fff', background: 'rgba(0, 0, 0, 0.8)', borderRadius: 6,
      fontFamily: 'monospace', fontSize: 12, lineHeight: 1.5,
      pointerEvents: 'auto', colorScheme: 'dark',
    }}>
      <style>{ROW_CSS}</style>
      <button type="button" onClick={() => setExpanded(value => !value)} aria-expanded={expanded}
        style={{ font: 'inherit', color: '#d7e0ea', background: 'transparent', border: 0,
          cursor: 'pointer', padding: '3px 6px', width: '100%', textAlign: 'left' }}>
        技术目录 {expanded ? '−' : '+'}
      </button>
      <div hidden={!expanded}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
        {[["general", "通用技术"], ["inkwave", "Inkwave 技术拆解"], ["webgl", "WebGL 游戏技术"]].map(([id, label]) => (
          <button key={id} type="button" onClick={() => setCollection(id)} aria-pressed={collection === id}
            style={{ flex: id === 'webgl' ? '1 0 100%' : 1, padding: '8px 4px', font: 'inherit', fontSize: 11,
              color: collection === id ? '#ffd198' : '#b8c4cf',
              background: collection === id ? '#ffffff18' : 'transparent',
              border: '1px solid #ffffff28', borderRadius: 3, cursor: 'pointer' }}>
            {label}
          </button>
        ))}
      </div>
      {collection === 'webgl' && <p style={{margin:'4px 6px 10px', color:'#b8c4cf'}}>WebGL 2 · 已验证场景<br />角色、画面、特效与玩法可组合使用。</p>}
      {groups.map(({ category, entries }) => (
        <section key={category} style={{ marginBottom: 8 }}>
          <h2 style={{ margin: '4px 6px', fontSize: 11, fontWeight: 'normal', color: '#9aa3b2' }}>
            {category}
          </h2>
          {entries.map((entry) => {
            const current = entry.id === scene
            return (
              <button key={entry.id} type="button" className="lab-menu-row"
                aria-current={current ? 'page' : undefined}
                onClick={() => openEntry(entry, collection)}
                style={{
                  display: 'block', width: '100%', boxSizing: 'border-box',
                  padding: '6px 8px', marginBottom: 2, textAlign: 'left',
                  color: 'inherit', font: 'inherit', cursor: 'pointer',
                  whiteSpace: 'normal', overflowWrap: 'anywhere',
                  background: current ? 'rgba(138, 180, 255, 0.22)' : 'transparent',
                  border: current ? '1px solid #8ab4ff' : '1px solid transparent',
                  borderRadius: 4,
                }}>
                <span style={{ display: 'block', fontWeight: 'bold' }}>
                  {entry.name}
                  {(entry.backend === 'webgl' || collection === 'webgl') && (
                    <span style={{
                      marginLeft: 6, padding: '0 4px', fontSize: 10, fontWeight: 'normal',
                      color: '#ffd28a', border: '1px solid #8a6d3b', borderRadius: 3,
                    }}>经典WebGL</span>
                  )}
                </span>
                <span style={{ display: 'block', fontSize: 11, color: '#aab2c0' }}>{entry.desc}</span>
              </button>
            )
          })}
        </section>
      ))}
      </div>
    </nav>
  )
}
