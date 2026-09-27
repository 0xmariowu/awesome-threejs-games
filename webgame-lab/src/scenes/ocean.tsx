import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, useLoader, useThree } from '@react-three/fiber'
import { folder, useControls } from 'leva'
import {
  ACESFilmicToneMapping, MathUtils, PMREMGenerator, PlaneGeometry, RenderPipeline, RepeatWrapping,
  Scene, TextureLoader, Vector3,
  type Mesh, type PerspectiveCamera, type RenderTarget, type WebGPURenderer,
} from 'three/webgpu'
import { pass } from 'three/tsl'
import { bloom } from 'three/addons/tsl/display/BloomNode.js'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { WaterMesh } from 'three/addons/objects/WaterMesh.js'
import { SkyMesh } from 'three/addons/objects/SkyMesh.js'
import { setInfo } from '../lab'
import { describeRenderer } from '../renderer'

// Port of three.js r186 examples/webgpu_ocean.html. The normal map is the
// example's own texture, pinned to the r186 tag on jsDelivr.
const WATER_NORMALS = 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r186/examples/textures/waternormals.jpg'

function OceanContent() {
  const { gl, scene, camera } = useThree()
  const box = useRef<Mesh>(null)
  const published = useRef(false)
  const sunDirty = useRef(true)
  const resources = useRef<{
    renderPipeline: RenderPipeline
    bloomPass: ReturnType<typeof bloom>
    pmrem: PMREMGenerator
    envScene: Scene
    target: RenderTarget | null
  } | null>(null)
  const sun = useMemo(() => new Vector3(), [])

  const waterNormals = useLoader(TextureLoader, WATER_NORMALS)
  const water = useMemo(() => {
    // Clone so the wrap mode does not leak into useLoader's shared cache.
    const normals = waterNormals.clone()
    normals.wrapS = normals.wrapT = RepeatWrapping
    normals.needsUpdate = true
    const mesh = new WaterMesh(new PlaneGeometry(10000, 10000), {
      waterNormals: normals,
      sunDirection: new Vector3(),
      sunColor: 0xffffff,
      waterColor: 0x001e0f,
      distortionScale: 3.7,
    })
    mesh.rotation.x = -Math.PI / 2
    return mesh
  }, [waterNormals])
  const sky = useMemo(() => {
    const mesh = new SkyMesh()
    mesh.scale.setScalar(10000)
    mesh.turbidity.value = 10
    mesh.rayleigh.value = 2
    mesh.mieCoefficient.value = 0.005
    mesh.mieDirectionalG.value = 0.8
    return mesh
  }, [])

  // The example's Settings GUI: Sky, Water, Bloom and Clouds folders.
  const {
    elevation, azimuth, exposure, distortionScale, size,
    bloomStrength, bloomRadius, cloudCoverage, cloudDensity, cloudElevation,
  } = useControls('Ocean', {
    Sky: folder({
      elevation: { value: 2, min: 0, max: 90, step: 0.1 },
      azimuth: { value: 180, min: -180, max: 180, step: 0.1 },
      exposure: { value: 0.1, min: 0, max: 1, step: 0.0001 },
    }),
    Water: folder({
      distortionScale: { value: 3.7, min: 0, max: 8, step: 0.1 },
      size: { value: 1, min: 0.1, max: 10, step: 0.1 },
    }),
    Bloom: folder({
      bloomStrength: { value: 0.1, min: 0, max: 3, step: 0.01, label: 'strength' },
      bloomRadius: { value: 0, min: 0, max: 1, step: 0.01, label: 'radius' },
    }),
    Clouds: folder({
      cloudCoverage: { value: 0.4, min: 0, max: 1, step: 0.01, label: 'coverage' },
      cloudDensity: { value: 0.5, min: 0, max: 1, step: 0.01, label: 'density' },
      cloudElevation: { value: 0.5, min: 0, max: 1, step: 0.01, label: 'elevation' },
    }),
  })

  // Scene setup: camera, orbit controls, water, sky, bloom pipeline and PMREM.
  useLayoutEffect(() => {
    // R3F types gl as WebGLRenderer even when its async factory returns WebGPU.
    const renderer = gl as unknown as WebGPURenderer
    const perspective = camera as PerspectiveCamera
    const previous = {
      position: perspective.position.clone(),
      quaternion: perspective.quaternion.clone(),
      fov: perspective.fov,
      near: perspective.near,
      far: perspective.far,
      environment: scene.environment,
      toneMapping: renderer.toneMapping,
      exposure: renderer.toneMappingExposure,
    }
    perspective.fov = 55
    perspective.near = 1
    perspective.far = 20000
    perspective.position.set(30, 30, 100)
    perspective.updateProjectionMatrix()
    renderer.toneMapping = ACESFilmicToneMapping

    const controls = new OrbitControls(perspective, gl.domElement)
    controls.maxPolarAngle = Math.PI * 0.495
    controls.target.set(0, 10, 0)
    controls.minDistance = 40
    controls.maxDistance = 200
    controls.update()

    scene.add(water)
    scene.add(sky)

    const scenePass = pass(scene, camera)
    const scenePassColor = scenePass.getTextureNode('output')
    const bloomPass = bloom(scenePassColor)
    bloomPass.threshold.value = 0
    const renderPipeline = new RenderPipeline(renderer)
    renderPipeline.outputNode = scenePassColor.add(bloomPass)

    resources.current = {
      renderPipeline,
      bloomPass,
      pmrem: new PMREMGenerator(renderer),
      envScene: new Scene(),
      target: null,
    }
    sunDirty.current = true

    return () => {
      const current = resources.current
      resources.current = null
      if (current) {
        current.target?.dispose()
        current.pmrem.dispose()
      }
      renderPipeline.dispose()
      bloomPass.dispose()
      scenePass.dispose()
      controls.dispose()
      water.removeFromParent()
      water.geometry.dispose()
      water.material.dispose()
      water.waterNormals.value.dispose()
      sky.removeFromParent()
      sky.geometry.dispose()
      sky.material.dispose()
      scene.environment = previous.environment
      renderer.toneMapping = previous.toneMapping
      renderer.toneMappingExposure = previous.exposure
      perspective.fov = previous.fov
      perspective.near = previous.near
      perspective.far = previous.far
      perspective.position.copy(previous.position)
      perspective.quaternion.copy(previous.quaternion)
      perspective.updateProjectionMatrix()
      perspective.updateMatrixWorld()
    }
  }, [gl, scene, camera, water, sky])

  // Sun position: the example's updateSun(); the PMREM rebake runs in the frame loop.
  useLayoutEffect(() => {
    const phi = MathUtils.degToRad(90 - elevation)
    const theta = MathUtils.degToRad(azimuth)
    sun.setFromSphericalCoords(1, phi, theta)
    sky.sunPosition.value.copy(sun)
    water.sunDirection.value.copy(sun).normalize()
    sunDirty.current = true
  }, [sun, sky, water, elevation, azimuth])

  // Uniforms stay live; none of these rebuild the pipeline.
  useLayoutEffect(() => {
    (gl as unknown as WebGPURenderer).toneMappingExposure = exposure
    water.distortionScale.value = distortionScale
    water.size.value = size
    sky.cloudCoverage.value = cloudCoverage
    sky.cloudDensity.value = cloudDensity
    sky.cloudElevation.value = cloudElevation
    const current = resources.current
    if (current) {
      current.bloomPass.strength.value = bloomStrength
      current.bloomPass.radius.value = bloomRadius
    }
  }, [gl, water, sky, exposure, distortionScale, size, bloomStrength, bloomRadius,
    cloudCoverage, cloudDensity, cloudElevation])

  // Positive priority takes over R3F's render loop and renders the bloom pipeline.
  useFrame(({ clock }) => {
    const current = resources.current
    if (!current) return

    if (sunDirty.current) {
      sunDirty.current = false
      // As in the example: bake the sky alone into the environment map.
      // Rebake into the previous target so scene.environment keeps one texture.
      current.envScene.add(sky)
      current.target = current.pmrem.fromScene(current.envScene, 0, 0.1, 100, { renderTarget: current.target })
      scene.add(sky)
      scene.environment = current.target.texture
    }

    const time = clock.elapsedTime
    const mesh = box.current
    if (mesh) {
      mesh.position.y = Math.sin(time) * 20 + 5
      mesh.rotation.x = time * 0.5
      mesh.rotation.z = time * 0.51
    }

    current.renderPipeline.render()
    if (!published.current) {
      published.current = true
      setInfo('ocean', true)
    }
  }, 1)

  return (
    <mesh ref={box}>
      <boxGeometry args={[30, 30, 30]} />
      <meshStandardMaterial roughness={0} />
    </mesh>
  )
}

function OceanUnsupported() {
  useEffect(() => {
    // WaterMesh and SkyMesh are node materials; classic WebGL cannot run them.
    // App's effect runs initLab() after child effects; publish on the next task.
    const timer = window.setTimeout(() => setInfo('ocean', false), 0)
    return () => window.clearTimeout(timer)
  }, [])
  return null
}

export default function Ocean() {
  const gl = useThree((state) => state.gl)
  return describeRenderer(gl).backend === 'webgl-classic' ? <OceanUnsupported /> : <OceanContent />
}
