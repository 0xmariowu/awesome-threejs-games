import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useControls } from 'leva'
import {
  BoxGeometry, MeshPhysicalMaterial, PlaneGeometry, RenderPipeline, UnsignedByteType,
  type Node, type PerspectiveCamera, type WebGPURenderer,
} from 'three/webgpu'
import {
  add, diffuseColor, mrt, normalView, output, packNormalToRGB, pass, sample,
  unpackRGBToNormal, vec4, velocity,
} from 'three/tsl'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { ssgi } from 'three/addons/tsl/display/SSGINode.js'
import { traa } from 'three/addons/tsl/display/TRAANode.js'
import { setInfo } from '../lab'
import { describeRenderer } from '../renderer'

// Cornell-box room from the r186 webgpu_postprocessing_ssgi example, built in
// code: red and green side walls bounce coloured light onto the white boxes.
function SsgiRoom() {
  const { camera, gl } = useThree()
  const { wall, tallBox, shortBox, white } = useMemo(() => ({
    wall: new PlaneGeometry(1, 1),
    tallBox: new BoxGeometry(5, 7, 5),
    shortBox: new BoxGeometry(4, 4, 4),
    white: new MeshPhysicalMaterial({ color: '#fff' }),
  }), [])

  useEffect(() => () => {
    wall.dispose()
    tallBox.dispose()
    shortBox.dispose()
    white.dispose()
  }, [wall, tallBox, shortBox, white])

  useLayoutEffect(() => {
    // The example frames the room with a 40 degree lens from (0, 10, 30).
    const perspective = camera as PerspectiveCamera
    const previous = {
      position: perspective.position.clone(),
      quaternion: perspective.quaternion.clone(),
      fov: perspective.fov, near: perspective.near, far: perspective.far,
    }
    perspective.fov = 40
    perspective.near = 0.1
    perspective.far = 100
    perspective.position.set(0, 10, 30)
    perspective.updateProjectionMatrix()

    const controls = new OrbitControls(perspective, gl.domElement)
    controls.target.set(0, 7, 0)
    controls.minDistance = 1
    controls.maxDistance = 100
    controls.update()

    return () => {
      controls.dispose()
      perspective.position.copy(previous.position)
      perspective.quaternion.copy(previous.quaternion)
      perspective.fov = previous.fov
      perspective.near = previous.near
      perspective.far = previous.far
      perspective.updateProjectionMatrix()
    }
  }, [camera, gl])

  return (
    <>
      <color attach="background" args={['#aaaaaa']} />
      <mesh geometry={wall} scale={[20, 15, 1]} rotation-y={Math.PI * 0.5} position={[-10, 7.5, 0]} receiveShadow>
        <meshPhysicalMaterial color="#ff0000" />
      </mesh>
      <mesh geometry={wall} scale={[20, 15, 1]} rotation-y={Math.PI * -0.5} position={[10, 7.5, 0]} receiveShadow>
        <meshPhysicalMaterial color="#00ff00" />
      </mesh>
      <mesh geometry={wall} material={white} scale={[20, 20, 1]} rotation-x={Math.PI * -0.5} receiveShadow />
      <mesh geometry={wall} material={white} scale={[15, 20, 1]} rotation-z={Math.PI * -0.5}
        position={[0, 7.5, -10]} receiveShadow />
      <mesh geometry={wall} material={white} scale={[20, 20, 1]} rotation-x={Math.PI * 0.5}
        position={[0, 15, 0]} receiveShadow />
      <mesh geometry={tallBox} material={white} rotation-y={Math.PI * 0.25} position={[-3, 3.5, -2]}
        castShadow receiveShadow />
      <mesh geometry={shortBox} material={white} rotation-y={Math.PI * -0.1} position={[4, 2, 4]}
        castShadow receiveShadow />
      <mesh position-y={15}>
        <cylinderGeometry args={[2.5, 2.5, 1, 64]} />
        <meshBasicMaterial />
      </mesh>
      <pointLight color="#ffffff" intensity={100} distance={100} position={[0, 13, 0]} castShadow
        shadow-mapSize-width={1024} shadow-mapSize-height={1024} />
      <ambientLight color="#0c0c0c" />
    </>
  )
}

function SsgiPostProcessing() {
  const { gl, scene, camera } = useThree()
  const classic = describeRenderer(gl).backend === 'webgl-classic'
  const pipeline = useRef<{
    renderPipeline: RenderPipeline
    direct: Node<'vec4'>
    filtered: Node
    giPass: ReturnType<typeof ssgi>
  } | null>(null)
  const { enabled, giIntensity, aoIntensity } = useControls('Global illumination', {
    enabled: true,
    giIntensity: { value: 10, min: 0, max: 100, step: 0.1 },
    aoIntensity: { value: 1, min: 0, max: 4, step: 0.01 },
  })

  useLayoutEffect(() => {
    if (classic) return

    // R3F types gl as WebGLRenderer even when its async factory returns WebGPU.
    const renderer = gl as unknown as WebGPURenderer
    // As in the r186 example: one scene pass writes lit colour, albedo, packed
    // view normals and velocity. SSGI reads colour, depth and normals.
    // The lab renderer enables MSAA, but TRAA copies the depth texture into a
    // single-sample history target, so the pass must be single-sample like the
    // example's non-antialiased renderer; TRAA supplies the anti-aliasing.
    const scenePass = pass(scene, camera, { samples: 0 })
    scenePass.setMRT(mrt({
      output,
      diffuseColor,
      normal: packNormalToRGB(normalView),
      velocity,
    }))
    const scenePassColor = scenePass.getTextureNode('output')
    const scenePassDiffuse = scenePass.getTextureNode('diffuseColor')
    const scenePassDepth = scenePass.getTextureNode('depth')
    const scenePassNormal = scenePass.getTextureNode('normal')
    const scenePassVelocity = scenePass.getTextureNode('velocity')
    // The example's bandwidth optimization: albedo and packed normals fit 8 bits.
    scenePass.getTexture('diffuseColor').type = UnsignedByteType
    scenePass.getTexture('normal').type = UnsignedByteType
    const sceneNormal = sample((uv) => unpackRGBToNormal(scenePassNormal.sample(uv)))

    const giPass = ssgi(scenePassColor, scenePassDepth, sceneNormal, camera as PerspectiveCamera)
    giPass.sliceCount.value = 2
    giPass.stepCount.value = 8
    // Composite: direct light darkened by AO, plus albedo times bounced light.
    const composite = vec4(
      add(scenePassColor.rgb.mul(giPass.getAONode()), scenePassDiffuse.rgb.mul(giPass.getGINode().rgb)),
      scenePassColor.a,
    )
    // SSGI's temporal sampling (on by default) is resolved by TRAA, as in the example.
    const filtered = traa(composite, scenePassDepth, scenePassVelocity, camera)
    const renderPipeline = new RenderPipeline(renderer)
    pipeline.current = { renderPipeline, direct: scenePassColor, filtered, giPass }

    return () => {
      pipeline.current = null
      renderPipeline.dispose()
      filtered.dispose()
      giPass.dispose()
      scenePass.dispose()
    }
  }, [gl, scene, camera, classic])

  useLayoutEffect(() => {
    const resources = pipeline.current
    if (!resources) return
    // Intensities are live uniforms. Turning GI off shows the example's
    // "Direct" view, which drops SSGI and TRAA from the graph so neither runs.
    resources.giPass.giIntensity.value = giIntensity
    resources.giPass.aoIntensity.value = aoIntensity
    const outputNode = enabled ? resources.filtered : resources.direct
    if (resources.renderPipeline.outputNode !== outputNode) {
      resources.renderPipeline.outputNode = outputNode
      resources.renderPipeline.needsUpdate = true
    }
  }, [gl, scene, camera, classic, enabled, giIntensity, aoIntensity])

  useEffect(() => {
    // App's effect runs initLab() after child effects and resets __LAB__.info;
    // publish on the next task so the value survives. Classic WebGL has no SSGI.
    const active = !classic && enabled
    const timer = window.setTimeout(() => setInfo('ssgi', active), 0)
    return () => window.clearTimeout(timer)
  }, [classic, enabled])

  // Positive priority takes over R3F's render loop; classic WebGL keeps it.
  useFrame(() => pipeline.current?.renderPipeline.render(), classic ? 0 : 1)
  return null
}

export default function Ssgi() {
  return (
    <>
      <SsgiRoom />
      <SsgiPostProcessing />
    </>
  )
}
