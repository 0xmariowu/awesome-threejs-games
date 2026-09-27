import { Suspense, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, useLoader, useThree } from '@react-three/fiber'
import { EffectComposer, ToneMapping } from '@react-three/postprocessing'
import { useControls } from 'leva'
import { EffectPass, ToneMappingMode, type EffectComposer as EffectComposerImpl } from 'postprocessing'
import {
  BoxGeometry, Data3DTexture, InstancedMesh, LinearFilter, LinearMipMapLinearFilter, LoadingManager,
  MathUtils, Matrix4, MeshBasicMaterial, NoColorSpace, RedFormat, RepeatWrapping, TextureLoader,
  type PerspectiveCamera, type WebGLRenderer,
} from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { PrecomputedTexturesLoader } from '@takram/three-atmosphere'
import { AerialPerspective, Atmosphere, type AtmosphereApi } from '@takram/three-atmosphere/r3f'
import { CLOUD_SHAPE_DETAIL_TEXTURE_SIZE, CLOUD_SHAPE_TEXTURE_SIZE } from '@takram/three-clouds'
import { CloudLayer, Clouds } from '@takram/three-clouds/r3f'
import {
  DataTextureLoader, DEFAULT_STBN_URL, Ellipsoid, Geodetic, parseUint8Array, radians, STBNLoader,
} from '@takram/three-geospatial'
import { setInfo } from '../lab'
import { describeRenderer } from '../renderer'
// Precomputed atmosphere LUTs and cloud noise shipped in the packages' own
// assets folders. Their package exports hide the folders, hence the paths.
import transmittanceUrl from '../../node_modules/@takram/three-atmosphere/assets/transmittance.exr?url'
import scatteringUrl from '../../node_modules/@takram/three-atmosphere/assets/scattering.exr?url'
import irradianceUrl from '../../node_modules/@takram/three-atmosphere/assets/irradiance.exr?url'
import higherOrderScatteringUrl from '../../node_modules/@takram/three-atmosphere/assets/higher_order_scattering.exr?url'
import localWeatherUrl from '../../node_modules/@takram/three-clouds/assets/local_weather.png?url'
import shapeUrl from '../../node_modules/@takram/three-clouds/assets/shape.bin?url'
import shapeDetailUrl from '../../node_modules/@takram/three-clouds/assets/shape_detail.bin?url'
import turbulenceUrl from '../../node_modules/@takram/three-clouds/assets/turbulence.png?url'

// World origin on the ground near Tokyo; X north, Y up, Z east (README recipe).
const LONGITUDE = 139.7
const LATITUDE = 35.7
const CAMERA_HEIGHT = 350
// Hours of local solar time are turned into a UTC date on the summer solstice.
const DAY_UTC = Date.UTC(2024, 5, 21)
const DAY_START = 4
const DAY_END = 20

const GROUND_SIZE = 60000
const CITY_BLOCKS = 900
const CITY_RADIUS = 6000
const MOUNTAINS: { x: number; z: number; radius: number; height: number }[] = [
  { x: 14000, z: -9000, radius: 5000, height: 2400 },
  { x: 20000, z: 2000, radius: 6500, height: 3200 },
  { x: 11000, z: 9000, radius: 4000, height: 1800 },
  { x: 26000, z: -16000, radius: 7000, height: 2800 },
  { x: 4500, z: -14000, radius: 3500, height: 1500 },
]

// PrecomputedTexturesLoader joins file names onto one directory URL. Vite gives
// each asset its own URL, so a URL modifier maps the virtual directory back.
const ATMOSPHERE_DIR = 'takram-atmosphere'
const ATMOSPHERE_FILES: Record<string, string> = {
  'transmittance.exr': transmittanceUrl,
  'scattering.exr': scatteringUrl,
  'irradiance.exr': irradianceUrl,
  'higher_order_scattering.exr': higherOrderScatteringUrl,
}
const atmosphereManager = new LoadingManager()
atmosphereManager.setURLModifier((url) => ATMOSPHERE_FILES[url.slice(url.lastIndexOf('/') + 1)] ?? url)
const atmosphereLoader = new PrecomputedTexturesLoader({}, atmosphereManager)

// Same loader settings the Clouds component uses when given URLs.
const shapeLoader = (size: number) => new DataTextureLoader(Data3DTexture, parseUint8Array, {
  width: size, height: size, depth: size,
  format: RedFormat, minFilter: LinearFilter, magFilter: LinearFilter,
  wrapS: RepeatWrapping, wrapT: RepeatWrapping, wrapR: RepeatWrapping, colorSpace: NoColorSpace,
})
const shapeTextureLoader = shapeLoader(CLOUD_SHAPE_TEXTURE_SIZE)
const shapeDetailTextureLoader = shapeLoader(CLOUD_SHAPE_DETAIL_TEXTURE_SIZE)

function dateAt(hour: number): number {
  return DAY_UTC + (hour - LONGITUDE / 15) * 3600e3
}

// Deterministic scatter of box "buildings" for scale: 20–120 m tall, a few km across.
function createCity(): InstancedMesh<BoxGeometry, MeshBasicMaterial> {
  const mesh = new InstancedMesh(new BoxGeometry(), new MeshBasicMaterial({ color: '#b9b2a6' }), CITY_BLOCKS)
  const matrix = new Matrix4()
  let seed = 7
  const random = () => {
    seed = (seed * 16807) % 2147483647
    return seed / 2147483647
  }
  for (let i = 0; i < CITY_BLOCKS; i++) {
    const angle = random() * Math.PI * 2
    const distance = Math.sqrt(random()) * CITY_RADIUS + 400
    const width = 30 + random() * 50
    const height = 20 + random() * random() * 100
    matrix.makeScale(width, height, 30 + random() * 50)
      .setPosition(Math.cos(angle) * distance + 2500, height / 2, Math.sin(angle) * distance)
    mesh.setMatrixAt(i, matrix)
  }
  return mesh
}

function AtmosphereContent() {
  const { gl, camera } = useThree()
  const atmosphere = useRef<AtmosphereApi>(null)
  const composer = useRef<EffectComposerImpl>(null)
  const city = useMemo(() => createCity(), [])

  const { time, coverage, exposure, lowClouds, towerClouds, cirrus } = useControls('Atmosphere', {
    time: { value: 11, min: DAY_START, max: DAY_END, step: 0.05, label: 'Time of day (h)' },
    coverage: { value: 0.4, min: 0, max: 1, step: 0.01, label: 'Cloud coverage' },
    exposure: { value: 4, min: 0.25, max: 8, step: 0.05, label: 'Exposure' },
    lowClouds: { value: true, label: 'Low cumulus (750 m)' },
    towerClouds: { value: true, label: 'Tall cumulus (1 km)' },
    cirrus: { value: true, label: 'Cirrus (7.5 km)' },
  })

  // README "Suspend until textures are fully loaded" recipes, pointed at the
  // bundled assets. STBN is not bundled, so it uses the documented default URL.
  const textures = useLoader(atmosphereLoader.setType(gl as WebGLRenderer), ATMOSPHERE_DIR)
  const loaded = useLoader(TextureLoader, [localWeatherUrl, turbulenceUrl])
  const shape = useLoader(shapeTextureLoader, shapeUrl)
  const shapeDetail = useLoader(shapeDetailTextureLoader, shapeDetailUrl)
  const stbn = useLoader(STBNLoader, DEFAULT_STBN_URL)
  // Settings the Clouds component applies to URL-loaded 2D textures; clones
  // keep the shared loader cache untouched.
  const [localWeather, turbulence] = useMemo(() => loaded.map((source) => {
    const texture = source.clone()
    texture.minFilter = LinearMipMapLinearFilter
    texture.magFilter = LinearFilter
    texture.wrapS = texture.wrapT = RepeatWrapping
    texture.colorSpace = NoColorSpace
    texture.needsUpdate = true
    return texture
  }), [loaded])
  useEffect(() => () => { localWeather.dispose(); turbulence.dispose() }, [localWeather, turbulence])

  useLayoutEffect(() => {
    const perspective = camera as PerspectiveCamera
    const previous = {
      position: perspective.position.clone(),
      quaternion: perspective.quaternion.clone(),
      near: perspective.near,
      far: perspective.far,
    }
    perspective.near = 5
    perspective.far = 1e6
    perspective.updateProjectionMatrix()
    perspective.position.set(-1500, CAMERA_HEIGHT, 1200)
    const controls = new OrbitControls(perspective, gl.domElement)
    controls.target.set(6000, 200, -1500)
    controls.maxPolarAngle = MathUtils.degToRad(89)
    controls.update()

    return () => {
      controls.dispose()
      perspective.near = previous.near
      perspective.far = previous.far
      perspective.updateProjectionMatrix()
      perspective.position.copy(previous.position)
      perspective.quaternion.copy(previous.quaternion)
      perspective.updateMatrixWorld()
    }
  }, [gl, camera])

  useLayoutEffect(() => {
    const api = atmosphere.current
    if (!api) return
    const origin = new Geodetic(radians(LONGITUDE), radians(LATITUDE), 0).toECEF()
    Ellipsoid.WGS84.getNorthUpEastFrame(origin, api.worldToECEFMatrix)
  }, [])

  useLayoutEffect(() => {
    atmosphere.current?.updateByDate(dateAt(time))
  }, [time])

  // Neither ToneMapping nor the takram effects take an exposure prop; the AgX
  // chunk ToneMappingEffect includes scales by the renderer's exposure uniform.
  useLayoutEffect(() => {
    const previous = gl.toneMappingExposure
    gl.toneMappingExposure = exposure
    return () => { gl.toneMappingExposure = previous }
  }, [gl, exposure])

  useEffect(() => () => {
    city.geometry.dispose()
    city.material.dispose()
    setInfo('atmosphere', { ready: false, clouds: false })
  }, [city])

  useEffect(() => {
    // App's effect runs initLab() after child effects and resets __LAB__.info;
    // publish on the next task so the value survives. Suspense has resolved,
    // so every texture above is loaded by the time this runs.
    const clouds = lowClouds || towerClouds || cirrus
    const timer = window.setTimeout(() => setInfo('atmosphere', { ready: true, clouds }), 0)
    return () => window.clearTimeout(timer)
  }, [lowClouds, towerClouds, cirrus])

  // postprocessing's own EffectPass dithering on the last pass, to hide banding
  // in the smooth sky gradient after tone mapping.
  useFrame(() => {
    const passes = composer.current?.passes ?? []
    for (let i = passes.length - 1; i >= 0; i--) {
      const pass = passes[i]
      if (pass instanceof EffectPass) {
        if (!pass.dithering) pass.dithering = true
        break
      }
    }
  })

  return (
    <Atmosphere ref={atmosphere} textures={textures}>
      {/* Post-process lighting: unlit albedo, lit in AerialPerspective. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[GROUND_SIZE, GROUND_SIZE]} />
        <meshBasicMaterial color="#5d6b45" />
      </mesh>
      <primitive object={city} />
      {MOUNTAINS.map(({ x, z, radius, height }) => (
        <mesh key={`${x},${z}`} position={[x, height / 2, z]}>
          <coneGeometry args={[radius, height, 48, 1, true]} />
          <meshBasicMaterial color="#6e6a5e" />
        </mesh>
      ))}
      <EffectComposer ref={composer} enableNormalPass multisampling={0}>
        <Clouds
          qualityPreset="high"
          coverage={coverage}
          disableDefaultLayers
          localWeatherTexture={localWeather}
          shapeTexture={shape}
          shapeDetailTexture={shapeDetail}
          turbulenceTexture={turbulence}
          stbnTexture={stbn}
        >
          {/* CloudsLayers.DEFAULT, one toggle per layer; fixed indices keep slots stable. */}
          {lowClouds && <CloudLayer index={0} channel="r" altitude={750} height={650} shadow />}
          {towerClouds && <CloudLayer index={1} channel="g" altitude={1000} height={1200} shadow />}
          {cirrus && (
            <CloudLayer index={2} channel="b" altitude={7500} height={500} densityScale={0.003}
              shapeAmount={0.4} shapeDetailAmount={0} coverageFilterWidth={0.5} />
          )}
        </Clouds>
        <AerialPerspective sky sunLight skyLight stbnTexture={stbn} />
        <ToneMapping mode={ToneMappingMode.AGX} />
      </EffectComposer>
    </Atmosphere>
  )
}

// The takram packages are GLSL-only (no WebGPU build of the clouds yet).
function WebGpuPlaceholder() {
  useEffect(() => {
    const timer = window.setTimeout(() => setInfo('atmosphere', { ready: false, clouds: false }), 0)
    return () => window.clearTimeout(timer)
  }, [])

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[40, 40]} />
      <meshBasicMaterial color="#5d6b45" />
    </mesh>
  )
}

export default function AtmosphereScene() {
  const gl = useThree((state) => state.gl)
  if (describeRenderer(gl).backend !== 'webgl-classic') return <WebGpuPlaceholder />
  return (
    <Suspense fallback={null}>
      <AtmosphereContent />
    </Suspense>
  )
}
