import { useEffect, useLayoutEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useControls } from 'leva'
import { RenderPipeline, type Node, type UniformNode, type WebGPURenderer } from 'three/webgpu'
import { mrt, output, pass, uniform, velocity } from 'three/tsl'
import { motionBlur } from 'three/addons/tsl/display/MotionBlur.js'
import { setInfo } from '../lab'
import { describeRenderer } from '../renderer'
import { FeelContent } from './feel'

function MotionBlurPostProcessing() {
  const { gl, scene, camera } = useThree()
  const classic = describeRenderer(gl).backend === 'webgl-classic'
  const pipeline = useRef<{
    renderPipeline: RenderPipeline
    beauty: Node<'vec4'>
    blurred: Node<'vec4'>
    amount: UniformNode<'float', number>
  } | null>(null)
  const { enabled, amount } = useControls('Motion blur', {
    enabled: true,
    amount: { value: 1, min: 0, max: 2, step: 0.01 },
  })

  useLayoutEffect(() => {
    if (classic) return

    // R3F types gl as WebGLRenderer even when its async factory returns WebGPU.
    const renderer = gl as unknown as WebGPURenderer
    // As in the r186 example: one scene pass writes colour plus per-pixel
    // velocity (camera and object motion since the previous frame), and
    // motionBlur() samples the colour along that velocity.
    const amountUniform = uniform(1)
    const scenePass = pass(scene, camera)
    scenePass.setMRT(mrt({ output, velocity }))
    const beauty = scenePass.getTextureNode()
    const blurred = motionBlur(beauty, scenePass.getTextureNode('velocity').mul(amountUniform))
    const renderPipeline = new RenderPipeline(renderer)
    renderPipeline.outputNode = blurred
    pipeline.current = { renderPipeline, beauty, blurred, amount: amountUniform }

    return () => {
      pipeline.current = null
      renderPipeline.dispose()
      scenePass.dispose()
    }
  }, [gl, scene, camera, classic])

  useLayoutEffect(() => {
    const resources = pipeline.current
    if (!resources) return
    // Amount is a live uniform. Turning the effect off drops the 16-tap blur
    // from the output graph instead of running it at zero offset.
    resources.amount.value = amount
    const outputNode = enabled ? resources.blurred : resources.beauty
    if (resources.renderPipeline.outputNode !== outputNode) {
      resources.renderPipeline.outputNode = outputNode
      resources.renderPipeline.needsUpdate = true
    }
  }, [gl, scene, camera, classic, enabled, amount])

  useEffect(() => {
    // App's effect runs initLab() after child effects and resets __LAB__.info;
    // publish on the next task so the value survives. Classic WebGL has no blur.
    const active = !classic && enabled
    const timer = window.setTimeout(() => setInfo('motionBlur', active), 0)
    return () => window.clearTimeout(timer)
  }, [classic, enabled])

  // Positive priority takes over R3F's render loop; classic WebGL keeps it.
  // Player moves the camera at priority -1, so velocity sees this frame's view.
  useFrame(() => pipeline.current?.renderPipeline.render(), classic ? 0 : 1)
  return null
}

export default function MotionBlur() {
  return (
    <>
      <FeelContent />
      <MotionBlurPostProcessing />
    </>
  )
}
