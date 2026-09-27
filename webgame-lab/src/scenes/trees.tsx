/*
 * Procedural grove from @dgreenheck/ez-tree 1.1.0 (MIT, Daniel Greenheck).
 * Follows the package's own usage: README (set options, then generate()) and
 * src/app/scene.js + main.js (loadPreset, reseed, generate, tree.update(time)
 * every frame). Bark and leaf textures ship inside the package build.
 */
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, useLoader, useThree } from '@react-three/fiber'
import { useControls } from 'leva'
import {
  EquirectangularReflectionMapping,
  LOD,
  NoColorSpace,
  RepeatWrapping,
  SRGBColorSpace,
  TextureLoader,
  type Material,
  type PerspectiveCamera,
} from 'three'
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { Billboard, Tree, TreePreset } from '@dgreenheck/ez-tree'
import { setInfo } from '../lab'
import { describeRenderer } from '../renderer'

type PresetName = keyof typeof TreePreset

// Preset trees are tens of units tall; scale brings them to roughly 4-9 m.
const GROVE: { preset: PresetName; x: number; z: number; scale: number }[] = [
  { preset: 'Oak Large', x: 0, z: 0, scale: 0.12 },
  { preset: 'Oak Medium', x: -9, z: 5, scale: 0.12 },
  { preset: 'Pine Large', x: -14, z: -10, scale: 0.11 },
  { preset: 'Pine Medium', x: 8, z: -12, scale: 0.12 },
  { preset: 'Pine Medium', x: -4, z: -18, scale: 0.11 },
  { preset: 'Ash Medium', x: 12, z: 3, scale: 0.12 },
  { preset: 'Ash Large', x: 20, z: -8, scale: 0.1 },
  { preset: 'Aspen Medium', x: -18, z: 2, scale: 0.12 },
  { preset: 'Aspen Small', x: 5, z: 10, scale: 0.14 },
  { preset: 'Ash Small', x: -6, z: 13, scale: 0.14 },
  { preset: 'Bush 1', x: 3, z: 5, scale: 0.12 },
  { preset: 'Bush 2', x: -12, z: 12, scale: 0.12 },
  { preset: 'Oak Medium', x: 16, z: 14, scale: 0.1 },
  { preset: 'Pine Small', x: 22, z: 8, scale: 0.13 },
]

// Beyond this camera distance (m) the low-detail copy is drawn.
const LOD_DISTANCE = 30

interface GroveTree {
  lod: LOD
  levels: Tree[]
}

function buildGrove(baseSeed: number): GroveTree[] {
  return GROVE.map(({ preset, x, z, scale }, index) => {
    // scene.js: loadPreset, then change the seed and generate() again.
    const high = new Tree()
    high.loadPreset(preset)
    high.options.seed += baseSeed * 7919 + index * 101
    high.generate()

    // Low detail keeps the same seed and shape: radial segments and the
    // second leaf quad do not consume random numbers in generateBranch/Leaf.
    const low = new Tree()
    low.options.copy(high.options)
    const segments = low.options.branch.segments
    for (const level of [0, 1, 2, 3] as const) {
      segments[level] = Math.max(3, Math.round(segments[level] / 2))
    }
    low.options.leaves.billboard = Billboard.Single
    low.generate()

    const lod = new LOD()
    lod.addLevel(high, 0)
    lod.addLevel(low, LOD_DISTANCE)
    lod.position.set(x, 0, z)
    lod.rotation.y = index * 2.39
    lod.scale.setScalar(scale)
    return { lod, levels: [high, low] }
  })
}

function disposeTree(tree: Tree) {
  // Textures are package-level singletons shared by every tree; keep them.
  for (const mesh of [tree.branchesMesh, tree.leavesMesh]) {
    mesh.geometry.dispose()
    ;(mesh.material as Material).dispose()
  }
}

function TreesContent() {
  const { scene, camera, gl } = useThree()
  const { windStrength, windSpeed, seed } = useControls('Trees', {
    windStrength: { value: 2, min: 0, max: 6, step: 0.1, label: 'Wind strength' },
    windSpeed: { value: 1, min: 0, max: 4, step: 0.05, label: 'Wind speed' },
    seed: { value: 0, min: 0, max: 99, step: 1, label: 'Seed' },
  })

  const environment = useLoader(HDRLoader, '/assets/kloofendal_48d_partly_cloudy_puresky_2k.hdr')
  const [color, normal, roughness, ao] = useLoader(TextureLoader, [
    '/assets/ground/Ground037_1K-JPG_Color.jpg',
    '/assets/ground/Ground037_1K-JPG_NormalGL.jpg',
    '/assets/ground/Ground037_1K-JPG_Roughness.jpg',
    '/assets/ground/Ground037_1K-JPG_AmbientOcclusion.jpg',
  ])

  const grove = useMemo(() => buildGrove(seed), [seed])
  useEffect(() => () => {
    for (const { levels } of grove) levels.forEach(disposeTree)
  }, [grove])

  useLayoutEffect(() => {
    const previousEnvironment = scene.environment
    const previousBackground = scene.background
    const previousIntensity = scene.environmentIntensity

    environment.mapping = EquirectangularReflectionMapping
    environment.needsUpdate = true
    scene.background = environment
    // Only the ground is PBR; ez-tree's Phong materials ignore scene.environment.
    scene.environment = environment
    scene.environmentIntensity = 0.6

    for (const map of [color, normal, roughness, ao]) {
      map.wrapS = map.wrapT = RepeatWrapping
      map.repeat.set(30, 30)
      map.colorSpace = map === color ? SRGBColorSpace : NoColorSpace
      map.needsUpdate = true
    }

    return () => {
      scene.environment = previousEnvironment
      scene.background = previousBackground
      scene.environmentIntensity = previousIntensity
    }
  }, [scene, environment, color, normal, roughness, ao])

  useLayoutEffect(() => {
    const perspective = camera as PerspectiveCamera
    const previous = {
      position: perspective.position.clone(),
      quaternion: perspective.quaternion.clone(),
      far: perspective.far,
    }
    perspective.far = 500
    perspective.updateProjectionMatrix()
    perspective.position.set(20, 6, 30)
    const controls = new OrbitControls(perspective, gl.domElement)
    controls.target.set(0, 4, 0)
    controls.maxPolarAngle = Math.PI / 2 - 0.05
    controls.update()

    return () => {
      controls.dispose()
      perspective.far = previous.far
      perspective.updateProjectionMatrix()
      perspective.position.copy(previous.position)
      perspective.quaternion.copy(previous.quaternion)
      perspective.updateMatrixWorld()
    }
  }, [gl, camera])

  useEffect(() => () => setInfo('trees', { count: 0, wind: false }), [])

  const published = useRef('')
  useFrame(({ clock }) => {
    const time = clock.elapsedTime * windSpeed
    let swaying = 0
    for (const { levels } of grove) {
      for (const tree of levels) {
        // main.js: tree.update(t) drives uTime in the leaf shader. Strength
        // lives in the same onBeforeCompile shader, which exists after compile.
        tree.update(time)
        const shader = (tree.leavesMesh.material as Material).userData.shader
        if (shader) {
          shader.uniforms.uWindStrength.value.set(windStrength, 0, windStrength)
          if (tree === levels[0]) swaying++
        }
      }
    }

    // Runs after App's initLab(), so the value survives. Wind is on once a
    // compiled leaf shader is being driven.
    const info = { count: grove.length, wind: swaying > 0 }
    const key = JSON.stringify(info)
    if (key !== published.current) {
      setInfo('trees', info)
      published.current = key
    }
  })

  return (
    <>
      <hemisphereLight args={['#cfe3ff', '#4a5a32', 1.1]} />
      <directionalLight
        position={[30, 40, 20]}
        color="#fff3dc"
        intensity={2.6}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-35}
        shadow-camera-right={35}
        shadow-camera-top={35}
        shadow-camera-bottom={-35}
        shadow-camera-near={1}
        shadow-camera-far={120}
        shadow-normalBias={0.04}
      />
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[160, 160]} />
        <meshStandardMaterial
          map={color}
          normalMap={normal}
          roughnessMap={roughness}
          aoMap={ao}
          roughness={1}
          metalness={0}
        />
      </mesh>
      {grove.map(({ lod }) => <primitive key={lod.uuid} object={lod} />)}
    </>
  )
}

// ez-tree's wind is GLSL injected with onBeforeCompile, which WebGPURenderer ignores.
function WebGpuPlaceholder() {
  useEffect(() => {
    const timer = window.setTimeout(() => setInfo('trees', { count: 0, wind: false }), 0)
    return () => window.clearTimeout(timer)
  }, [])

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[40, 40]} />
      <meshBasicMaterial color="#5d6b45" />
    </mesh>
  )
}

export default function TreesScene() {
  const gl = useThree((state) => state.gl)
  if (describeRenderer(gl).backend !== 'webgl-classic') return <WebGpuPlaceholder />
  return (
    <Suspense fallback={null}>
      <TreesContent />
    </Suspense>
  )
}
