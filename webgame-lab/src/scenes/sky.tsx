import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, useLoader, useThree } from '@react-three/fiber'
import { useControls } from 'leva'
import {
  Color, MathUtils, NoColorSpace, PMREMGenerator, RepeatWrapping, SRGBColorSpace, Scene,
  TextureLoader, Vector3,
  type DirectionalLight, type HemisphereLight, type PerspectiveCamera, type RenderTarget,
  type WebGPURenderer,
} from 'three/webgpu'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { SkyMesh } from 'three/addons/objects/SkyMesh.js'
import { setInfo } from '../lab'
import { describeRenderer } from '../renderer'

// Time of day drives only the sun's elevation: a sine arc from sunrise to
// sunset peaking at NOON_ELEVATION. Before sunrise the sun sits below the horizon.
const SUNRISE = 6
const SUNSET = 19
const NOON_ELEVATION = 70
const DAY_START = 5
const DAY_END = 20
// Animated day: in-game hours per real second.
const DAY_SPEED = 1

// Light levels are in the sky's own units: SkyMesh radiance is ~10 at noon and
// the example views it at exposure ~0.05, so the lights are scaled to match.
const SUN_NOON = 60
const HEMI_NOON = 6
const ENV_INTENSITY = 0.6

const SUN_LOW = new Color('#ff7a2e')
const SUN_HIGH = new Color('#fff4e6')
const SKY_NIGHT = new Color('#1b2640')
const SKY_DUSK = new Color('#e59a6a')
const SKY_NOON = new Color('#9cc4ff')
const GROUND_LOW = new Color('#2a2018')
const GROUND_HIGH = new Color('#6b5a44')

function sunElevation(hour: number): number {
  const t = (hour - SUNRISE) / (SUNSET - SUNRISE)
  return NOON_ELEVATION * Math.sin(Math.PI * t)
}

function initialHour(): number {
  const requested = Number.parseFloat(new URLSearchParams(location.search).get('time') ?? '')
  return Number.isFinite(requested) ? MathUtils.clamp(requested, DAY_START, DAY_END) : 12
}

function SkyContent() {
  const { gl, scene, camera } = useThree()
  const classic = describeRenderer(gl).backend === 'webgl-classic'
  const sunLight = useRef<DirectionalLight>(null)
  const hemiLight = useRef<HemisphereLight>(null)
  const hour = useRef(0)
  const envDirty = useRef(true)
  const envUpdatedAt = useRef(-Infinity)
  const skyEnv = useRef<{ pmrem: PMREMGenerator; envScene: Scene; target: RenderTarget | null } | null>(null)
  const sky = useMemo(() => (classic ? null : new SkyMesh()), [classic])
  const sun = useMemo(() => new Vector3(), [])

  const [{ time, azimuth, turbidity, rayleigh, exposure, animateDay }, set] = useControls('Sky', () => ({
    time: { value: initialHour(), min: DAY_START, max: DAY_END, step: 0.05, label: 'Time of day (h)' },
    azimuth: { value: -160, min: -180, max: 180, step: 0.1, label: 'Sun azimuth (°)' },
    turbidity: { value: 10, min: 0, max: 20, step: 0.1, label: 'Turbidity' },
    rayleigh: { value: 3, min: 0, max: 4, step: 0.001, label: 'Rayleigh' },
    exposure: { value: 0.05, min: 0, max: 1, step: 0.0001, label: 'Exposure' },
    animateDay: { value: false, label: 'Animate day' },
  }))

  // Same ground textures as the look scene; clones keep the shared cache untouched.
  const loaded = useLoader(TextureLoader, [
    '/assets/ground/Ground037_1K-JPG_Color.jpg',
    '/assets/ground/Ground037_1K-JPG_NormalGL.jpg',
    '/assets/ground/Ground037_1K-JPG_Roughness.jpg',
    '/assets/ground/Ground037_1K-JPG_AmbientOcclusion.jpg',
  ])
  const [color, normal, roughness, ao] = useMemo(() => loaded.map((source, index) => {
    const map = source.clone()
    map.wrapS = map.wrapT = RepeatWrapping
    map.repeat.set(100, 100)
    map.colorSpace = index === 0 ? SRGBColorSpace : NoColorSpace
    map.needsUpdate = true
    return map
  }), [loaded])
  useEffect(() => () => { for (const map of [color, normal, roughness, ao]) map.dispose() },
    [color, normal, roughness, ao])

  // Scene setup: sky dome, PMREM generator, camera and orbit controls.
  useLayoutEffect(() => {
    const perspective = camera as PerspectiveCamera
    const previous = {
      position: perspective.position.clone(),
      quaternion: perspective.quaternion.clone(),
      environment: scene.environment,
      environmentIntensity: scene.environmentIntensity,
      exposure: gl.toneMappingExposure,
    }
    perspective.position.set(9, 3, 13)
    const controls = new OrbitControls(perspective, gl.domElement)
    controls.target.set(0, 1.5, 0)
    controls.maxPolarAngle = MathUtils.degToRad(88)
    controls.update()

    if (sky) {
      // As in the example: a huge box whose vertices are pushed to the far plane.
      sky.scale.setScalar(450000)
      scene.add(sky)
      skyEnv.current = {
        pmrem: new PMREMGenerator(gl as unknown as WebGPURenderer),
        envScene: new Scene(),
        target: null,
      }
      scene.environmentIntensity = ENV_INTENSITY
    }

    return () => {
      controls.dispose()
      if (sky) {
        sky.removeFromParent()
        sky.geometry.dispose()
        sky.material.dispose()
      }
      if (skyEnv.current) {
        skyEnv.current.target?.dispose()
        skyEnv.current.pmrem.dispose()
        skyEnv.current = null
      }
      scene.environment = previous.environment
      scene.environmentIntensity = previous.environmentIntensity
      gl.toneMappingExposure = previous.exposure
      perspective.position.copy(previous.position)
      perspective.quaternion.copy(previous.quaternion)
      perspective.updateMatrixWorld()
    }
  }, [gl, scene, camera, sky])

  // Moves the sun to `h` hours and relights the scene to match.
  const applyHour = (h: number) => {
    hour.current = h
    const elevation = sunElevation(h)
    const phi = MathUtils.degToRad(90 - elevation)
    const theta = MathUtils.degToRad(azimuth)
    sun.setFromSphericalCoords(1, phi, theta)
    if (sky) sky.sunPosition.value.copy(sun)

    // 0 at the horizon, 1 from ~35 degrees up: orange and dim low, white at noon.
    const high = MathUtils.smoothstep(elevation, 0, 35)
    const day = MathUtils.smoothstep(elevation, -4, 6)
    const light = sunLight.current
    if (light) {
      light.position.copy(sun).multiplyScalar(40)
      light.color.copy(SUN_LOW).lerp(SUN_HIGH, high)
      light.intensity = SUN_NOON * MathUtils.smoothstep(elevation, -1, 25)
    }
    const hemi = hemiLight.current
    if (hemi) {
      hemi.color.copy(SKY_NIGHT).lerp(SKY_DUSK, day).lerp(SKY_NOON, high)
      hemi.groundColor.copy(GROUND_LOW).lerp(GROUND_HIGH, high)
      hemi.intensity = HEMI_NOON * (0.08 + 0.92 * MathUtils.smoothstep(elevation, -6, 30))
    }
    envDirty.current = true
  }

  useLayoutEffect(() => {
    if (sky) {
      sky.turbidity.value = turbidity
      sky.rayleigh.value = rayleigh
    }
    gl.toneMappingExposure = exposure
    // While animating, the frame loop owns the hour; the slider only mirrors it.
    applyHour(animateDay ? hour.current : time)
  }, [gl, sky, time, azimuth, turbidity, rayleigh, exposure, animateDay])

  useEffect(() => {
    // App's effect runs initLab() after child effects and resets __LAB__.info;
    // publish on the next task so the value survives. Classic WebGL has no SkyMesh.
    const timer = window.setTimeout(() => setInfo('sky', sky !== null), 0)
    return () => window.clearTimeout(timer)
  }, [sky])

  const lastSliderSync = useRef(0)
  useFrame(({ clock }, delta) => {
    if (animateDay) {
      let next = hour.current + delta * DAY_SPEED
      if (next > DAY_END) next = DAY_START
      applyHour(next)
      // Keep the slider in step without re-rendering React every frame.
      if (clock.elapsedTime - lastSliderSync.current > 0.25) {
        lastSliderSync.current = clock.elapsedTime
        set({ time: Math.round(next / 0.05) * 0.05 })
      }
    }

    // Reflections: render the sky alone into a PMREM, as three's ocean example
    // does, throttled so the animated day does not rebuild it every frame.
    const env = skyEnv.current
    const now = clock.elapsedTime
    if (sky && env && envDirty.current && now - envUpdatedAt.current > 0.1) {
      envDirty.current = false
      envUpdatedAt.current = now
      // SkyMesh docs: hide the sun disc while baking to avoid artifacts.
      sky.showSunDisc.value = false
      env.envScene.add(sky)
      // Rebake into the previous target so scene.environment keeps one texture.
      env.target = env.pmrem.fromScene(env.envScene, 0, 0.1, 100, { renderTarget: env.target })
      scene.add(sky)
      sky.showSunDisc.value = true
      scene.environment = env.target.texture
    }
  })

  return (
    <>
      <hemisphereLight ref={hemiLight} />
      <directionalLight
        ref={sunLight}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-15}
        shadow-camera-right={15}
        shadow-camera-top={15}
        shadow-camera-bottom={-15}
        shadow-camera-near={1}
        shadow-camera-far={90}
        shadow-normalBias={0.02}
      />
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[400, 400]} />
        <meshStandardMaterial map={color} normalMap={normal} roughnessMap={roughness} aoMap={ao}
          roughness={1} metalness={0} />
      </mesh>
      <mesh position={[-2.5, 1, 0]} castShadow receiveShadow>
        <sphereGeometry args={[1, 64, 32]} />
        <meshStandardMaterial color="#d5dce4" metalness={1} roughness={0.12} />
      </mesh>
      <mesh position={[0, 0.9, 0.5]} rotation={[0, 0.3, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.8, 1.8, 1.8]} />
        <meshStandardMaterial color="#e8e2d6" metalness={0} roughness={0.85} />
      </mesh>
      <mesh position={[2.6, 1.25, -0.5]} castShadow receiveShadow>
        <torusKnotGeometry args={[0.75, 0.25, 128, 24]} />
        <meshStandardMaterial color="#176c78" metalness={0} roughness={0.2} />
      </mesh>
      {[-6, -3, 0, 3, 6].map((x) => (
        <mesh key={x} position={[x, 1.5, -5]} castShadow receiveShadow>
          <cylinderGeometry args={[0.25, 0.25, 3, 24]} />
          <meshStandardMaterial color="#b8b0a4" roughness={0.7} />
        </mesh>
      ))}
    </>
  )
}

export default function Sky() {
  return <SkyContent />
}
