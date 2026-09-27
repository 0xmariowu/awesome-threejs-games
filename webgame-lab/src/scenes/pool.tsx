import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, useLoader, useThree } from '@react-three/fiber'
import { useControls } from 'leva'
import {
  ACESFilmicToneMapping, DoubleSide, EquirectangularReflectionMapping, Group, Mesh, MeshStandardMaterial,
  PlaneGeometry, RenderPipeline, RepeatWrapping, TextureLoader, Vector2,
  type PerspectiveCamera, type WebGPURenderer,
} from 'three/webgpu'
import { emissive, mrt, output, pass, renderOutput } from 'three/tsl'
import { bloom } from 'three/addons/tsl/display/BloomNode.js'
import { fxaa } from 'three/addons/tsl/display/FXAANode.js'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { UltraHDRLoader } from 'three/addons/loaders/UltraHDRLoader.js'
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { WaterMesh, type WaterNode } from 'three/addons/objects/Water2Mesh.js'
import { setInfo } from '../lab'
import { describeRenderer } from '../renderer'
// Serve the Draco decoder from the installed three package. DRACO_GLTF_CONFIG
// resolves against import.meta.url, which breaks once Vite pre-bundles three.
import dracoWrapperUrl from 'three/examples/jsm/libs/draco/gltf/draco_wasm_wrapper.js?url'
import dracoWasmUrl from 'three/examples/jsm/libs/draco/gltf/draco_decoder.wasm?url'

// Port of three.js r186 examples/webgpu_water.html. Assets are the example's
// own, pinned to the r186 tag. jsDelivr refuses the three.js repo for files it
// serves from a >50 MB package (pool.glb), so all four come from raw GitHub.
const R186 = 'https://raw.githubusercontent.com/mrdoob/three.js/r186/examples'
// "The Night Pool" by syntheticplants, CC BY 4.0 (credited in the example).
const POOL_MODEL = `${R186}/models/gltf/pool.glb`
const WATER_NORMAL_0 = `${R186}/textures/water/Water_1_M_Normal.jpg`
const WATER_NORMAL_1 = `${R186}/textures/water/Water_2_M_Normal.jpg`
// Poly Haven "Moonless Golf" (Greg Zaal, CC0), as an UltraHDR JPEG.
const ENVIRONMENT = `${R186}/textures/equirectangular/moonless_golf_2k.hdr.jpg`

// The example's four grey floor slabs around the pool: [x, z, scaleX, scaleZ].
const FLOORS = [[20, 0, 15, 80], [-20, 0, 15, 80], [0, 30, 30, 20], [0, -30, 30, 20]] as const

// One decoder for this scene; disposed on unmount. useLoader caches the parsed
// model, so a later mount only needs a new decoder on a cache miss.
let draco: DRACOLoader | null = null
function getDraco(): DRACOLoader {
  draco ??= new DRACOLoader().setDecoderPath({ js: dracoWrapperUrl, wasm: dracoWasmUrl })
  return draco
}

function PoolContent() {
  const { gl, scene, camera } = useThree()
  const published = useRef(false)
  const resources = useRef<{ renderPipeline: RenderPipeline; controls: OrbitControls } | null>(null)

  const gltf = useLoader(GLTFLoader, POOL_MODEL, (loader) => {
    loader.setDRACOLoader(getDraco())
  })
  const hdr = useLoader(UltraHDRLoader, ENVIRONMENT)
  const [normal0, normal1] = useLoader(TextureLoader, [WATER_NORMAL_0, WATER_NORMAL_1])

  const environment = useMemo(() => {
    // Clone so the mapping does not leak into useLoader's shared cache.
    const texture = hdr.clone()
    texture.mapping = EquirectangularReflectionMapping
    texture.needsUpdate = true
    return texture
  }, [hdr])

  const water = useMemo(() => {
    // Clone so the wrap mode does not leak into useLoader's shared cache.
    const normalMap0 = normal0.clone()
    const normalMap1 = normal1.clone()
    normalMap0.wrapS = normalMap0.wrapT = RepeatWrapping
    normalMap1.wrapS = normalMap1.wrapT = RepeatWrapping
    normalMap0.needsUpdate = normalMap1.needsUpdate = true
    const mesh = new WaterMesh(new PlaneGeometry(30, 40), {
      color: '#99e0ff',
      scale: 2,
      flowDirection: new Vector2(1, 1),
      normalMap0,
      normalMap1,
    })
    mesh.position.set(0, 0.2, -2)
    mesh.rotation.x = Math.PI * -0.5
    mesh.renderOrder = Infinity
    return mesh
  }, [normal0, normal1])

  const floors = useMemo(() => {
    const geometry = new PlaneGeometry(1, 1)
    geometry.rotateX(-Math.PI * 0.5)
    const material = new MeshStandardMaterial({ color: 0x444444, roughness: 1, metalness: 0, side: DoubleSide })
    const group = new Group()
    for (const [x, z, scaleX, scaleZ] of FLOORS) {
      const floor = new Mesh(geometry, material)
      floor.position.set(x, 0, z)
      floor.scale.set(scaleX, 1, scaleZ)
      group.add(floor)
    }
    return { group, geometry, material }
  }, [])

  // The example's "Water" parameters panel.
  const { color, scale, flowX, flowY } = useControls('Water', {
    color: '#99e0ff',
    scale: { value: 2, min: 1, max: 10 },
    flowX: { value: 1, min: -1, max: 1, step: 0.01 },
    flowY: { value: 1, min: -1, max: 1, step: 0.01 },
  })

  // Scene setup: camera, orbit controls, environment, model, water, floors and
  // the bloom + FXAA pipeline.
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
      background: scene.background,
      environment: scene.environment,
      toneMapping: renderer.toneMapping,
      exposure: renderer.toneMappingExposure,
    }
    perspective.fov = 45
    perspective.near = 0.1
    perspective.far = 200
    perspective.position.set(-20, 6, -30)
    perspective.updateProjectionMatrix()
    renderer.toneMapping = ACESFilmicToneMapping
    renderer.toneMappingExposure = 0.5
    scene.background = environment
    scene.environment = environment

    const model = gltf.scene
    model.position.z = 2
    model.scale.setScalar(0.1)
    scene.add(model)
    scene.add(water)
    scene.add(floors.group)

    // Bloom only the emissive MRT channel, then tone map and FXAA, as in the example.
    const renderPipeline = new RenderPipeline(renderer)
    renderPipeline.outputColorTransform = false
    const scenePass = pass(scene, camera)
    scenePass.setMRT(mrt({ output, emissive }))
    const beautyPass = scenePass.getTextureNode()
    const emissivePass = scenePass.getTextureNode('emissive')
    const bloomPass = bloom(emissivePass, 2)
    const outputPass = renderOutput(beautyPass.add(bloomPass))
    renderPipeline.outputNode = fxaa(outputPass)

    const controls = new OrbitControls(perspective, gl.domElement)
    controls.enableDamping = true
    controls.target.set(0, 0, -5)
    controls.update()

    resources.current = { renderPipeline, controls }

    return () => {
      resources.current = null
      renderPipeline.dispose()
      bloomPass.dispose()
      scenePass.dispose()
      controls.dispose()
      // The model is owned by useLoader's cache: detach it, do not dispose it.
      model.removeFromParent()
      water.removeFromParent()
      water.geometry.dispose()
      water.material.dispose()
      const waterNode = water.material.colorNode as WaterNode
      waterNode.normalMap0.value.dispose()
      waterNode.normalMap1.value.dispose()
      floors.group.removeFromParent()
      floors.geometry.dispose()
      floors.material.dispose()
      environment.dispose()
      draco?.dispose()
      draco = null
      scene.background = previous.background
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
  }, [gl, scene, camera, gltf, environment, water, floors])

  // Uniforms stay live; none of these rebuild the pipeline.
  useLayoutEffect(() => {
    const waterNode = water.material.colorNode as WaterNode
    waterNode.color.value.set(color)
    waterNode.scale.value = scale
    // The example starts at the unnormalised (1, 1) and normalises only once a
    // flow slider moves; keep that until the sliders differ from the vector.
    const flow = waterNode.flowDirection.value
    if (flow.x !== flowX || flow.y !== flowY) flow.set(flowX, flowY).normalize()
  }, [water, color, scale, flowX, flowY])

  // Positive priority takes over R3F's render loop and renders the pipeline.
  useFrame(() => {
    const current = resources.current
    if (!current) return

    current.controls.update()
    current.renderPipeline.render()
    if (!published.current) {
      published.current = true
      setInfo('water', true)
    }
  }, 1)

  return null
}

function PoolUnsupported() {
  useEffect(() => {
    // Water2Mesh is a node material; classic WebGL cannot run it.
    // App's effect runs initLab() after child effects; publish on the next task.
    const timer = window.setTimeout(() => setInfo('water', false), 0)
    return () => window.clearTimeout(timer)
  }, [])
  return null
}

export default function Pool() {
  const gl = useThree((state) => state.gl)
  return describeRenderer(gl).backend === 'webgl-classic' ? <PoolUnsupported /> : <PoolContent />
}
