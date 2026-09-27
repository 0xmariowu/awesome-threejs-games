import { useLayoutEffect, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useControls } from 'leva'
import {
  ACESFilmicToneMapping, AgXToneMapping, NeutralToneMapping, NoToneMapping,
  ReinhardToneMapping, RenderPipeline, type Node, type WebGPURenderer,
} from 'three/webgpu'
import { mrt, normalView, output, pass, vec4 } from 'three/tsl'
import { ssao } from 'three/addons/tsl/display/SSAONode.js'
import { bloom } from 'three/addons/tsl/display/BloomNode.js'
import { setInfo } from '../lab'
import { describeRenderer } from '../renderer'
import { LookContent } from './look'

const effectNames = ['ao', 'bloom', 'tonemap'] as const
const toneMappings = {
  none: NoToneMapping,
  AgX: AgXToneMapping,
  'ACES Filmic': ACESFilmicToneMapping,
  Neutral: NeutralToneMapping,
  Reinhard: ReinhardToneMapping,
}

function LookPostProcessing() {
  const { gl, scene, camera } = useThree()
  const classic = describeRenderer(gl).backend === 'webgl-classic'
  const pipeline = useRef<{
    renderPipeline: RenderPipeline
    sceneColor: Node<'vec4'>
    aoColor: Node<'vec4'>
    aoPass: ReturnType<typeof ssao>
    bloomPass: ReturnType<typeof bloom> | null
  } | null>(null)
  const [effects] = useState(() => {
    const requested = new URLSearchParams(location.search).get('post')
    const tokens = new Set((requested ?? effectNames.join(',')).split(',').map((token) => token.trim()))
    return effectNames.filter((name) => tokens.has(name))
  })
  const {
    toneMapping, exposure, ao, aoIntensity, aoRadius,
    bloom: bloomEnabled, bloomStrength, bloomThreshold, bloomRadius,
  } = useControls('Post', {
    toneMapping: { value: effects.includes('tonemap') ? 'AgX' : 'none', options: Object.keys(toneMappings) },
    exposure: { value: 1, min: 0.1, max: 3, step: 0.01 },
    bloom: effects.includes('bloom'),
    bloomStrength: { value: 0.3, min: 0, max: 2, step: 0.01 },
    bloomThreshold: { value: 1, min: 0, max: 2, step: 0.01 },
    bloomRadius: { value: 0, min: 0, max: 1, step: 0.01 },
    ao: effects.includes('ao'),
    aoIntensity: { value: 1, min: 0, max: 3, step: 0.01 },
    aoRadius: { value: 0.4, min: 0.01, max: 3, step: 0.01 },
  })

  useLayoutEffect(() => {
    if (classic) {
      setInfo('post', [])
      return
    }

    // R3F types gl as WebGLRenderer even when its async factory returns WebGPU.
    const renderer = gl as unknown as WebGPURenderer
    const previousToneMapping = renderer.toneMapping
    const previousExposure = renderer.toneMappingExposure

    const scenePass = pass(scene, camera)
    // r186 SSAONode documents this single-pass MRT alternative to the AO
    // example's separate normal pre-pass. SSAO includes its own spatial denoise.
    // Keep normals available so enabling AO does not recreate the scene pass.
    scenePass.setMRT(mrt({ output, normal: normalView }))
    const sceneColor = scenePass.getTextureNode('output')
    const aoPass = ssao(scenePass.getTextureNode('depth'), scenePass.getTextureNode('normal'), camera)
    aoPass.resolutionScale = 1
    aoPass.samples.value = 16

    const aoColor = vec4(sceneColor.rgb.mul(aoPass.r), sceneColor.a)
    const renderPipeline = new RenderPipeline(renderer)
    // RenderPipeline applies the renderer's tone mapping and output color
    // conversion after this linear HDR chain, as in the r186 bloom example.
    const resources = { renderPipeline, sceneColor, aoColor, aoPass, bloomPass: null as ReturnType<typeof bloom> | null }
    pipeline.current = resources

    return () => {
      pipeline.current = null
      renderPipeline.dispose()
      resources.bloomPass?.dispose()
      aoPass.dispose()
      scenePass.dispose()
      renderer.toneMapping = previousToneMapping
      renderer.toneMappingExposure = previousExposure
      setInfo('post', [])
    }
  }, [gl, scene, camera, classic])

  useLayoutEffect(() => {
    const resources = pipeline.current
    if (!resources) return
    const shadedColor = ao ? resources.aoColor : resources.sceneColor
    // Bloom caches its input shader. Replace it only when the effect topology
    // changes; disabled nodes are absent from the output graph and do not run.
    const previousBloom = resources.bloomPass
    resources.bloomPass = bloomEnabled ? bloom(shadedColor) : null
    resources.renderPipeline.outputNode = resources.bloomPass
      ? shadedColor.add(resources.bloomPass) : shadedColor
    resources.renderPipeline.needsUpdate = true
    previousBloom?.dispose()
  }, [gl, scene, camera, classic, ao, bloomEnabled])

  useLayoutEffect(() => {
    const resources = pipeline.current
    if (!resources) return
    const renderer = gl as unknown as WebGPURenderer
    // r186 detects tone mapping changes; exposure and effect uniforms stay live
    // without marking the pipeline dirty or rebuilding it in the frame loop.
    renderer.toneMapping = toneMappings[toneMapping as keyof typeof toneMappings]
    renderer.toneMappingExposure = exposure
    resources.aoPass.intensity.value = aoIntensity
    resources.aoPass.radius.value = aoRadius
    if (resources.bloomPass) {
      resources.bloomPass.strength.value = bloomStrength
      resources.bloomPass.threshold.value = bloomThreshold
      resources.bloomPass.radius.value = bloomRadius
    }
    setInfo('post', effectNames.filter((name) => (
      name === 'ao' ? ao : name === 'bloom' ? bloomEnabled : toneMapping !== 'none'
    )))
    setInfo('postSettings', {
      toneMapping, exposure, ao, aoIntensity, aoRadius,
      bloom: bloomEnabled, bloomStrength, bloomThreshold, bloomRadius,
    })
  }, [gl, scene, camera, classic, toneMapping, exposure, ao, aoIntensity, aoRadius,
    bloomEnabled, bloomStrength, bloomThreshold, bloomRadius])

  // Positive priority takes over R3F's render loop; classic WebGL keeps it.
  useFrame(() => pipeline.current?.renderPipeline.render(), classic ? 0 : 1)
  return null
}

export default function LookPost() {
  return (
    <>
      <LookContent />
      <LookPostProcessing />
    </>
  )
}
