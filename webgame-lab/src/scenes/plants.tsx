/*
 * Procedural garden from SkyeShark/SeedThree (MIT), vendored unchanged under
 * src/vendor/seedthree at commit 85787bf. Follows its API README and
 * src/api/example-eidoverse-scene.js: one createTree({ species, seed,
 * loadTexture, assetsDir, sunLight, level: 'LOD0' }) per plant, setWind() for
 * the shared TSL sway, and the app's texture setup (main.js loadTex: repeat
 * wrap, sRGB albedo, anisotropy 8). The PBR maps are not copied into the repo;
 * they load at runtime from jsDelivr pinned to the same commit.
 */
import { Suspense, useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { useLoader, useThree } from '@react-three/fiber'
import { useControls } from 'leva'
import {
  DirectionalLight,
  EquirectangularReflectionMapping,
  Group,
  NoColorSpace,
  RepeatWrapping,
  SRGBColorSpace,
  TextureLoader,
  type BufferGeometry,
  type Material,
  type Mesh,
  type PerspectiveCamera,
  type Texture,
} from 'three'
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { createTree, setWind, type LoadTexture } from '../vendor/seedthree/api/seedthree.js'
import { setError, setInfo } from '../lab'
import { describeRenderer } from '../renderer'

const COMMIT = '85787bf03af363cac85a1ad0660ffa925605b198'
const ASSETS_DIR = `https://cdn.jsdelivr.net/gh/SkyeShark/SeedThree@${COMMIT}/assets`

// Mixed temperate/desert garden, big trees at the back. Sizes at seed 1 (m,
// width x height): oak 20x14, willow 23x15, birch 13x20, saguaro 3x8,
// creosote 4x3, sagebrush 2x1.5.
const GARDEN: { species: string; x: number; z: number }[] = [
  { species: 'whiteOak', x: -15, z: -8 },
  { species: 'weepingWillow', x: 16, z: -10 },
  { species: 'paperBirch', x: 0, z: -22 },
  { species: 'saguaro', x: 4, z: 6 },
  { species: 'creosote', x: -5, z: 10 },
  { species: 'sagebrush', x: 9, z: 13 },
]

// Maps that exist at COMMIT for the species above. buildAssets also asks for
// <leaf>_dry_albedo / _dryest_albedo, which these species do not ship; answering
// null without a request keeps 404s out of the console (the API treats null as
// "map absent").
const PBR = ['albedo', 'normal', 'roughness']
const AVAILABLE = new Set([
  ...['white_oak', 'weeping_willow', 'paper_birch', 'saguaro_skin', 'saguaro_skin_clean', 'creosote_branch', 'blackbrush_branch']
    .flatMap((base) => PBR.map((map) => `bark/${base}_${map}.png`)),
  ...['white_oak_single', 'weeping_willow_spray', 'paper_birch_single', 'saguaro_spines', 'creosote', 'sagebrush']
    .flatMap((base) => [...PBR, 'translucency'].map((map) => `leaves/${base}_${map}.png`)),
])

function createTextureCache() {
  const loader = new TextureLoader()
  const cache = new Map<string, Promise<Texture | null>>()
  const load: LoadTexture = (path, { srgb }) => {
    if (!AVAILABLE.has(path.slice(ASSETS_DIR.length + 1))) return Promise.resolve(null)
    let pending = cache.get(path)
    if (!pending) {
      pending = loader.loadAsync(path).then((texture) => {
        texture.wrapS = texture.wrapT = RepeatWrapping
        texture.colorSpace = srgb ? SRGBColorSpace : NoColorSpace
        texture.anisotropy = 8
        return texture
      }, () => null)
      cache.set(path, pending)
    }
    return pending
  }
  // The API passes srgb only for *_albedo maps, so the same flag primes the cache.
  const preload = () => Promise.all([...AVAILABLE].map((file) => (
    load(`${ASSETS_DIR}/${file}`, { srgb: file.endsWith('_albedo.png') })
  )))
  const dispose = () => {
    for (const pending of cache.values()) void pending.then((texture) => texture?.dispose())
  }
  return { load, preload, dispose }
}

function disposeGarden(garden: Group) {
  // Materials are built per createTree call; textures belong to the cache.
  const geometries = new Set<BufferGeometry>()
  const materials = new Set<Material>()
  garden.traverse((object) => {
    const mesh = object as Mesh
    if (!mesh.isMesh) return
    geometries.add(mesh.geometry)
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) materials.add(material)
  })
  geometries.forEach((geometry) => geometry.dispose())
  materials.forEach((material) => material.dispose())
}

function PlantsContent() {
  const { scene, camera, gl } = useThree()
  const { seed, windStrength, windSpeed } = useControls('Plants', {
    seed: { value: 1, min: 1, max: 999, step: 1, label: 'Seed' },
    windStrength: { value: 0.5, min: 0, max: 1, step: 0.01, label: 'Wind strength' },
    windSpeed: { value: 1, min: 0, max: 3, step: 0.05, label: 'Wind speed' },
  })

  const environment = useLoader(HDRLoader, '/assets/kloofendal_48d_partly_cloudy_puresky_2k.hdr')
  const [color, normal, roughness, ao] = useLoader(TextureLoader, [
    '/assets/ground/Ground037_1K-JPG_Color.jpg',
    '/assets/ground/Ground037_1K-JPG_NormalGL.jpg',
    '/assets/ground/Ground037_1K-JPG_Roughness.jpg',
    '/assets/ground/Ground037_1K-JPG_AmbientOcclusion.jpg',
  ])

  // Shadow setup from the SeedThree example: 4096 map plus these biases keep
  // leaf cards and thin twigs free of acne. The light sits along the API's
  // default sunDirectionUniform (0.5, 0.7, 0.5), and is also handed to
  // createTree for the saguaro spines' self-shadow.
  const sun = useMemo(() => {
    const light = new DirectionalLight('#fff0dd', 3)
    light.position.set(25, 35, 25)
    light.castShadow = true
    light.shadow.mapSize.set(4096, 4096)
    light.shadow.bias = -0.0003
    light.shadow.normalBias = 0.04
    Object.assign(light.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 1, far: 120 })
    return light
  }, [])

  const textures = useMemo(createTextureCache, [])
  useEffect(() => textures.dispose, [textures])

  const [garden, setGarden] = useState<Group | null>(null)
  // Runs after the commit that swapped the garden out, so it is off-scene.
  useEffect(() => (garden ? () => disposeGarden(garden) : undefined), [garden])

  useEffect(() => {
    setWind({ strength: windStrength, speed: windSpeed })
  }, [windStrength, windSpeed])

  useEffect(() => {
    let cancelled = false
    const grow = async () => {
      const started = performance.now()
      await textures.preload()
      const grown = performance.now()
      const trees = await Promise.all(GARDEN.map(({ species }) => createTree({
        species, seed, loadTexture: textures.load, assetsDir: ASSETS_DIR, sunLight: sun, level: 'LOD0',
      })))
      const next = new Group()
      trees.forEach((tree, index) => {
        const { x, z } = GARDEN[index]
        // level: 'LOD0' detaches the level from its LOD, which carried the
        // species' plantSink as position.y; keep that offset.
        tree.object.position.set(x, tree.group.position.y, z)
        tree.object.rotation.y = index * 2.39
        tree.object.traverse((object) => {
          if ((object as Mesh).isMesh) object.castShadow = object.receiveShadow = true
        })
        next.add(tree.object)
      })
      if (cancelled) {
        disposeGarden(next)
        return
      }
      setGarden(next)
      setInfo('plants', {
        ready: true,
        count: trees.length,
        seed,
        textureMs: Math.round(grown - started),
        buildMs: Math.round(performance.now() - grown),
        lod0Triangles: trees.reduce((sum, tree) => sum + tree.stats.summary.lod0Triangles, 0),
      })
    }
    grow().catch((error: unknown) => {
      if (!cancelled) setError(`plants: ${error instanceof Error ? error.message : String(error)}`)
    })
    return () => {
      cancelled = true
    }
  }, [seed, sun, textures])

  useLayoutEffect(() => {
    const previousEnvironment = scene.environment
    const previousBackground = scene.background
    const previousIntensity = scene.environmentIntensity

    environment.mapping = EquirectangularReflectionMapping
    environment.needsUpdate = true
    scene.background = environment
    scene.environment = environment
    scene.environmentIntensity = 0.5

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
    perspective.position.set(0, 9, 40)
    const controls = new OrbitControls(perspective, gl.domElement)
    controls.target.set(0, 6, -6)
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

  useEffect(() => () => setInfo('plants', { ready: false, count: 0 }), [])

  return (
    <>
      <hemisphereLight args={['#cfe6ff', '#5a4a36', 0.8]} />
      <primitive object={sun} />
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
      {garden && <primitive object={garden} />}
    </>
  )
}

// SeedThree's materials are TSL node materials, which only WebGPURenderer runs.
function ClassicPlaceholder() {
  useEffect(() => {
    const timer = window.setTimeout(() => setInfo('plants', { ready: false, count: 0 }), 0)
    return () => window.clearTimeout(timer)
  }, [])

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[40, 40]} />
      <meshBasicMaterial color="#5d6b45" />
    </mesh>
  )
}

export default function PlantsScene() {
  const gl = useThree((state) => state.gl)
  if (describeRenderer(gl).backend === 'webgl-classic') return <ClassicPlaceholder />
  return (
    <Suspense fallback={null}>
      <PlantsContent />
    </Suspense>
  )
}
