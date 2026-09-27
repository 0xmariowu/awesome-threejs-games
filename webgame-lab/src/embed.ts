export function parseEmbedParams(
  search: string,
  language = navigator.language,
  prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches,
) {
  const query = new URLSearchParams(search)
  const theme = query.get('theme')
  const lang = query.get('lang')
  return {
    embed: query.get('embed') === '1',
    theme: theme === 'light' || theme === 'dark' ? theme : prefersDark ? 'dark' : 'light',
    lang: lang === 'zh' || lang === 'en' ? lang : language.toLowerCase().startsWith('zh') ? 'zh' : 'en',
  } as const
}

export const embedPalettes = {
  dark: {
    bg: '#0E141F', panel: '#151D2B', line: '#25324A',
    ink: '#E7EDF6', muted: '#8C99AF', accent: '#F0B541', link: '#6FA1FF',
  },
  light: {
    bg: '#F5F7FA', panel: '#FFFFFF', line: '#D9E0EA',
    ink: '#111827', muted: '#5B687C', accent: '#B7791F', link: '#2F5FD0',
  },
}

/** Observe intrinsic content height, never the parent iframe's current height. */
export function observeFrameHeight(win: Window = window) {
  if (win.parent === win) return () => {}
  const root = win.document.documentElement
  const postHeight = () => win.parent.postMessage({
    type: 'gameref:frame-height',
    height: Math.ceil(root.getBoundingClientRect().height),
  }, '*')
  const observer = new ResizeObserver(postHeight)
  observer.observe(root)
  win.addEventListener('load', postHeight)
  postHeight()
  return () => {
    observer.disconnect()
    win.removeEventListener('load', postHeight)
  }
}

/** Shared mount for the two imperative scene legends; their content is unchanged. */
export function mountLabLegend(legend: HTMLElement) {
  const controls = document.getElementById('lab-controls')
  if (controls) {
    legend.removeAttribute('style')
    legend.className = 'lab-frame-legend'
  }
  const target = controls ?? document.body
  target.append(legend)
  return () => legend.remove()
}

// Fixed-camera studies gain inspection controls only inside the library embed.
export const inspectionScenes = new Set(['look', 'look-post', 'look-presets', 'lut', 'fog', 'rain'])

export function frameHint(scene: string, lang: 'zh' | 'en') {
  const zh = lang === 'zh'
  if (scene === 'inkwave-ui') return zh ? 'Tab / Enter 操作菜单' : 'Tab / Enter: navigate menus'
  if (scene === 'inkwave-paint') return zh ? '点击画面涂色' : 'Click the picture to paint'
  if (scene === 'drive') return zh ? 'WASD / 方向键驾驶 · 空格刹车' : 'WASD / arrows: drive · Space: brake'
  if (scene === 'drone') return zh ? 'WASD 飞行 · 空格 / Shift 升降 · Q / E 转向' : 'WASD: fly · Space / Shift: altitude · Q / E: yaw'
  if (['inkwave-3c', 'inkwave-combat', 'inkwave-diagnostics'].includes(scene)) {
    return zh ? 'WASD 移动 · 空格跳跃 · 左键开火 · E 投掷' : 'WASD: move · Space: jump · Click: fire · E: throw'
  }
  if (scene.startsWith('inkwave-')) return zh ? '拖动画面旋转 · 滚轮缩放' : 'Drag: orbit · Scroll: zoom'
  if (['feel', 'feel-cam', 'planet', 'cloudkeep-cam', 'tank-cam', 'npc', 'shallow', 'ropes', 'motion-blur'].includes(scene)) {
    const camera = ['feel-cam', 'cloudkeep-cam'].includes(scene) ? (zh ? ' · C 切换/回正镜头' : ' · C: switch/reset camera') : ''
    return (zh ? 'WASD 移动 · 空格跳跃 · Shift 奔跑' : 'WASD: move · Space: jump · Shift: run') + camera
  }
  if (['lightning', 'quarks', 'destruct', 'navcrowd'].includes(scene)) return zh ? '点击地面交互' : 'Click the ground to interact'
  if (scene === 'birds') return zh ? '移动鼠标驱散鸟群' : 'Move pointer to repel the flock'
  return zh ? '拖动画面旋转 · 滚轮缩放' : 'Drag: orbit · Scroll: zoom'
}

/** Flatten a state snapshot into readable key/value rows without exposing raw JSON. */
export function frameReadoutRows(value: Record<string, unknown>, prefix = ''): [string, string][] {
  return Object.entries(value).flatMap(([key, entry]) => {
    const label = prefix ? `${prefix} · ${key}` : key
    if (entry !== null && typeof entry === 'object') {
      return frameReadoutRows(entry as Record<string, unknown>, label)
    }
    return [[label, entry == null ? '—' : String(entry)] as [string, string]]
  })
}
