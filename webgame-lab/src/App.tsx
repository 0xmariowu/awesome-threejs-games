import { Component, useCallback, useEffect, useMemo, useRef, useState, type ComponentType, type ReactNode } from 'react'
import { Canvas, extend, useFrame, useThree, type ThreeToJSXElements } from '@react-three/fiber'
import { Leva } from 'leva'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import * as THREE from 'three/webgpu'
import { createFpsSampler, initLab, listScenes, loadScene, markReady, setError, setInfo, type LabState } from './lab'
import { createRendererFactory, describeRenderer, parseLabParams } from './renderer'
import Menu from './Menu'
import { embedPalettes, inspectionScenes, parseEmbedParams } from './embed'
import { EmbedFrame } from './EmbedFrame'

extend(THREE as any)

declare module '@react-three/fiber' {
  // Three's classic and WebGPU PMREMGenerator constructors have incompatible types.
  // Keep R3F's existing declaration for that name while adding all node materials.
  interface ThreeElements extends Omit<ThreeToJSXElements<typeof THREE>, 'pMREMGenerator'> {}
}

type LabParams = ReturnType<typeof parseLabParams>

class LabErrorBoundary extends Component<{
  children: ReactNode
  onError: (error: unknown) => void
}, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: Error) {
    this.props.onError(error)
  }

  render() {
    return this.state.failed ? null : this.props.children
  }
}

function LabProbe({ scene }: { scene: string }) {
  const gl = useThree((state) => state.gl)
  const [sampler] = useState(() => createFpsSampler())
  const ready = useRef(false)
  const lastInfo = useRef(performance.now())

  useEffect(() => {
    gl.info.autoReset = false
  }, [gl])

  useFrame(() => {
    if (!ready.current) {
      markReady(describeRenderer(gl).backend, scene)
      ready.current = true
    }

    sampler.frame()
    if (window.__LAB__) window.__LAB__.fps = sampler.fps()

    const now = performance.now()
    if (now - lastInfo.current >= 500) {
      // R3F types gl as WebGLRenderer even when an async factory returns WebGPU.
      // useFrame runs before rendering, so these are the preceding frame's counts.
      const render = (gl as typeof gl | THREE.WebGPURenderer).info.render
      setInfo('render', {
        drawCalls: 'drawCalls' in render ? render.drawCalls : render.calls,
        triangles: render.triangles,
        source: 'drawCalls' in render
          ? 'webgpu.info.render.drawCalls'
          : 'webgl.info.render.calls',
      })
      lastInfo.current = now
    }
    gl.info.reset()
  })

  return null
}

/** Inspect fixed-camera render studies without changing their standalone view. */
function EmbedInspection() {
  const { camera, gl } = useThree()
  const controls = useRef<OrbitControls | null>(null)
  useEffect(() => {
    const orbit = new OrbitControls(camera, gl.domElement)
    orbit.target.copy(camera.position).add(camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(camera.position.length()))
    orbit.enableDamping = true
    controls.current = orbit
    return () => { orbit.dispose(); controls.current = null }
  }, [camera, gl])
  useFrame(() => controls.current?.update())
  return null
}

function LabOverlay({ params, error, inline = false }: { params: LabParams | null; error: string | null; inline?: boolean }) {
  const [lab, setLab] = useState<LabState | null>(null)

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (window.__LAB__) setLab({ ...window.__LAB__ })
    }, 250)
    return () => window.clearInterval(timer)
  }, [])

  return (
    <div className={inline ? 'lab-frame-telemetry' : undefined} style={inline ? undefined : {
      position: 'absolute', top: 12, left: 12, zIndex: 1,
      padding: '8px 10px', color: '#fff', background: 'rgba(0, 0, 0, 0.75)',
      fontFamily: 'monospace', fontSize: 12, lineHeight: 1.5,
      maxWidth: 'calc(100% - 44px)', overflowWrap: 'anywhere', pointerEvents: 'none',
    }}>
      <div>backend: {lab?.backend ?? params?.backend ?? '—'}</div>
      <div>scene: {lab?.scene ?? params?.scene ?? '—'}</div>
      <div>fps: {lab?.fps ?? '—'}</div>
      {(error ?? lab?.error) && <div role="alert">error: {error ?? lab?.error}</div>}
    </div>
  )
}

function EmbedPanel({ options, hidden }: { options: ReturnType<typeof parseEmbedParams>; hidden: boolean }) {
  const palette = embedPalettes[options.theme]
  return (
    <div className="lab-embed-panel" hidden={hidden} style={{ colorScheme: options.theme }}>
      <Leva hidden={hidden} fill flat oneLineLabels={false} hideCopyButton
        collapsed={false} titleBar={false}
        theme={{
          colors: {
            elevation1: palette.line, elevation2: 'transparent', elevation3: palette.bg,
            accent1: palette.link, accent2: palette.link, accent3: palette.accent,
            highlight1: palette.line, highlight2: palette.muted, highlight3: palette.ink,
            vivid1: palette.accent, folderWidgetColor: palette.muted, folderTextColor: palette.ink,
            toolTipBackground: palette.ink, toolTipText: palette.bg,
          },
          fonts: { sans: 'system-ui, "PingFang SC", sans-serif', mono: 'system-ui, "PingFang SC", sans-serif' },
          fontSizes: { root: '13px' },
          fontWeights: { folder: '600' },
          radii: { xs: '8px', sm: '8px', lg: '8px' },
          sizes: { rootWidth: '280px', controlWidth: '60%', colorPickerWidth: '180px', rowHeight: '28px', folderTitleHeight: '24px', titleBarHeight: '44px', numberInputMinWidth: '60px' },
          space: { md: '0px', rowGap: '2px', colGap: '8px' },
          shadows: {
            level1: `0 0 0 1px ${palette.line}, 0 6px 20px rgba(0, 0, 0, 0.12)`,
            level2: '0 4px 12px rgba(0, 0, 0, 0.16)',
          },
        }} />
    </div>
  )
}

function LabPanel({ params, hidden }: { params: LabParams | null; hidden: boolean }) {
  const [embed] = useState(() => parseEmbedParams(location.search))
  if (embed.embed) return <EmbedPanel options={embed} hidden={hidden} />

  const changeParam = (key: 'scene' | 'backend', value: string) => {
    const query = new URLSearchParams(location.search)
    query.set(key, value)
    location.search = query.toString()
  }
  const selectStyle = {
    minWidth: 0, width: '100%', padding: '4px 6px',
    color: '#fff', background: '#252932', border: '1px solid #687080',
    borderRadius: 4, font: 'inherit',
  }

  return (
    <div style={{
      position: 'absolute', top: 12, right: 12, zIndex: 2,
      width: 300, maxWidth: 'calc(100% - 24px)',
      display: hidden ? 'none' : 'grid', gap: 8, pointerEvents: 'auto',
    }}>
      <div role="group" aria-label="Lab picker" style={{
        padding: 10, color: '#fff', background: 'rgba(0, 0, 0, 0.8)',
        borderRadius: 6, fontFamily: 'monospace', fontSize: 12,
        display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr)',
        gap: 8, alignItems: 'center', colorScheme: 'dark',
      }}>
        <label htmlFor="lab-scene">Scene</label>
        <select id="lab-scene" style={selectStyle} value={params?.scene ?? 'boot'}
          onChange={(event) => changeParam('scene', event.target.value)}>
          {listScenes().map((scene) => <option key={scene} value={scene}>{scene}</option>)}
        </select>
        <label htmlFor="lab-backend">Backend</label>
        <select id="lab-backend" style={selectStyle} value={params?.backend ?? 'webgpu'}
          onChange={(event) => changeParam('backend', event.target.value)}>
          <option value="webgpu">WebGPU</option>
          <option value="webgpu-gl">WebGPU (WebGL2 mode)</option>
          <option value="webgl">Classic WebGL</option>
        </select>
      </div>
      <Leva hidden={hidden} fill collapsed={false} oneLineLabels
        titleBar={{ title: 'Scene controls', drag: false }}
        theme={{ fontSizes: { root: '12px' } }} />
    </div>
  )
}

export default function App() {
  const [embed] = useState(() => parseEmbedParams(location.search))
  const [panelHidden] = useState(() => !embed.embed && (navigator.webdriver === true
    || new URLSearchParams(location.search).get('panel') === '0'
    || new URLSearchParams(location.search).get('scene')?.startsWith('inkwave-') === true))
  const [params, setParams] = useState<LabParams | null>(null)
  const [Scene, setScene] = useState<ComponentType | null>(null)
  const [error, setFailure] = useState<string | null>(null)
  const reportError = useCallback((reason: unknown) => {
    const message = reason instanceof Error ? reason.message : String(reason)
    setError(message)
    setFailure(message)
  }, [])
  const rendererFactory = useMemo(
    () => params ? createRendererFactory(params.backend) : undefined,
    [params],
  )

  useEffect(() => {
    initLab()
    setInfo('panel', panelHidden ? 'hidden' : 'shown')
    let active = true
    const onError = (event: ErrorEvent) => reportError(event.error ?? event.message)
    const onRejection = (event: PromiseRejectionEvent) => reportError(event.reason)
    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRejection)

    try {
      const parsed = parseLabParams(location.search)
      setParams(parsed)
      void loadScene(parsed.scene).then(
        (loaded) => { if (active) setScene(() => loaded) },
        (reason: unknown) => { if (active) reportError(reason) },
      )
    } catch (reason) {
      reportError(reason)
    }

    return () => {
      active = false
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onRejection)
    }
  }, [reportError, panelHidden])

  const picture = error === null && params && Scene ? (
    <LabErrorBoundary onError={reportError}>
      <Canvas gl={rendererFactory} shadows camera={{ position: [4, 3, 6], fov: 50 }}>
        <Scene />
        {embed.embed && inspectionScenes.has(params.scene) && <EmbedInspection />}
        <LabProbe scene={params.scene} />
      </Canvas>
    </LabErrorBoundary>
  ) : null

  if (embed.embed) return (
    <EmbedFrame options={embed} scene={params?.scene ?? ''} picture={picture}
      performance={new URLSearchParams(location.search).get('clean') !== '1'
        ? <LabOverlay params={params} error={error} inline /> : null}>
      <LabPanel params={params} hidden={panelHidden} />
      {error && <p role="alert">{error}</p>}
    </EmbedFrame>
  )

  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      {picture}
      {(new URLSearchParams(location.search).get('clean') !== '1' || error) && <LabOverlay params={params} error={error} />}
      <LabPanel params={params} hidden={panelHidden} />
      <Menu />
    </div>
  )
}
