import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useControls } from 'leva'
import {
  BackSide, BoxGeometry, Color, Data3DTexture, LinearFilter, MathUtils, Mesh, NodeMaterial,
  RedFormat, Vector3,
  type PerspectiveCamera,
} from 'three/webgpu'
import { Break, Fn, If, float, smoothstep, texture3D, uniform, vec3, vec4 } from 'three/tsl'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { ImprovedNoise } from 'three/addons/math/ImprovedNoise.js'
import { RaymarchingBox } from 'three/addons/tsl/utils/Raymarching.js'
import { setInfo } from '../lab'
import { describeRenderer } from '../renderer'

const SKY = new Color('#8cc4ee')
const NOISE_SIZE = 128
// Radians per second. The example spins its single cloud at 1/7.5 rad/s;
// sky clouds turn slower so they drift rather than spin.
const SPIN = 0.04

// A few copies of the example's unit cloud box, stretched and turned so they
// read as different clouds. The raymarch runs in local space, so scale is free.
const CLOUDS: { position: [number, number, number]; scale: [number, number, number]; turn: number }[] = [
  { position: [0, 30, -40], scale: [24, 10, 18], turn: 0 },
  { position: [-38, 34, -55], scale: [20, 8, 16], turn: 1.3 },
  { position: [36, 28, -45], scale: [22, 9, 14], turn: 2.6 },
  { position: [-14, 40, -85], scale: [30, 11, 20], turn: 4.1 },
  { position: [48, 38, -95], scale: [26, 10, 18], turn: 5.2 },
  { position: [-60, 26, -30], scale: [18, 7, 14], turn: 3.4 },
]

// As in the example: Perlin noise faded by squared distance from the centre,
// stored as an R8 3D texture.
function createNoiseTexture(): Data3DTexture {
  const size = NOISE_SIZE
  const data = new Uint8Array(size * size * size)
  const scale = 0.05
  const perlin = new ImprovedNoise()
  const vector = new Vector3()
  let i = 0
  for (let z = 0; z < size; z++) {
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const d = 1.0 - vector.set(x, y, z).subScalar(size / 2).divideScalar(size).length()
        data[i++] = (128 + 128 * perlin.noise(x * scale / 1.5, y * scale, z * scale / 1.5)) * d * d
      }
    }
  }
  const texture = new Data3DTexture(data, size, size, size)
  texture.format = RedFormat
  texture.minFilter = LinearFilter
  texture.magFilter = LinearFilter
  texture.unpackAlignment = 1
  texture.needsUpdate = true
  return texture
}

function createCloudMaterial(texture: Data3DTexture) {
  const baseColor = uniform(new Color(0x798aa0))
  const range = uniform(0.1)
  const threshold = uniform(0.25)
  const opacity = uniform(0.25)
  const steps = uniform(100)
  const map = texture3D(texture, null, 0)

  // The example's transparentRaymarchingTexture, closed over the uniforms.
  const cloud = Fn(() => {
    const finalColor = vec4(0).toVar()
    RaymarchingBox(steps, ({ positionRay }) => {
      const mapValue = float(map.sample(positionRay.add(0.5)).r).toVar()
      mapValue.assign(smoothstep(threshold.sub(range), threshold.add(range), mapValue).mul(opacity))
      const shading = map.sample(positionRay.add(vec3(-0.01))).r.sub(map.sample(positionRay.add(vec3(0.01))).r)
      const col = shading.mul(3.0).add(positionRay.x.add(positionRay.y).mul(0.25)).add(0.2)
      finalColor.rgb.addAssign(finalColor.a.oneMinus().mul(mapValue).mul(col))
      finalColor.a.addAssign(finalColor.a.oneMinus().mul(mapValue))
      If(finalColor.a.greaterThanEqual(0.95), () => {
        Break()
      })
    })
    return finalColor
  })()

  const material = new NodeMaterial()
  material.colorNode = cloud.setRGB(cloud.rgb.add(baseColor))
  material.side = BackSide
  material.transparent = true
  return { material, uniforms: { range, threshold, opacity, steps } }
}

function VolumeCloudContent() {
  const { gl, scene, camera } = useThree()
  const classic = describeRenderer(gl).backend === 'webgl-classic'
  const clouds = useRef<Mesh[]>([])

  // Classic WebGL cannot run node materials; it keeps only sky and ground.
  const resources = useMemo(() => {
    if (classic) return null
    const texture = createNoiseTexture()
    const geometry = new BoxGeometry(1, 1, 1)
    return { texture, geometry, ...createCloudMaterial(texture) }
  }, [classic])

  const { threshold, opacity, range, steps } = useControls('Clouds', {
    threshold: { value: 0.25, min: 0, max: 1, step: 0.01 },
    opacity: { value: 0.25, min: 0, max: 1, step: 0.01 },
    range: { value: 0.1, min: 0, max: 1, step: 0.01 },
    steps: { value: 100, min: 0, max: 200, step: 1 },
  })

  // Scene setup: sky colour, camera, orbit controls and the cloud meshes.
  useLayoutEffect(() => {
    const perspective = camera as PerspectiveCamera
    const previous = {
      position: perspective.position.clone(),
      quaternion: perspective.quaternion.clone(),
      background: scene.background,
    }
    scene.background = SKY
    // Eye near the ground, looking ~13 degrees up: sky fills the upper
    // three quarters of the frame and the ground is a band at the bottom.
    perspective.position.set(0, 2, 30)
    const controls = new OrbitControls(perspective, gl.domElement)
    controls.target.set(0, 14, -20)
    // Looking up puts the camera below the target (polar angle past 90 degrees),
    // so allow ~104 degrees and cap distance so the eye stays above the ground.
    controls.maxPolarAngle = MathUtils.degToRad(104)
    controls.maxDistance = 55
    controls.update()

    if (resources) {
      clouds.current = CLOUDS.map(({ position, scale, turn }) => {
        const mesh = new Mesh(resources.geometry, resources.material)
        mesh.position.set(...position)
        mesh.scale.set(...scale)
        mesh.rotation.y = turn
        scene.add(mesh)
        return mesh
      })
    }

    return () => {
      controls.dispose()
      for (const mesh of clouds.current) mesh.removeFromParent()
      clouds.current = []
      if (resources) {
        resources.geometry.dispose()
        resources.material.dispose()
        resources.texture.dispose()
      }
      scene.background = previous.background
      perspective.position.copy(previous.position)
      perspective.quaternion.copy(previous.quaternion)
      perspective.updateMatrixWorld()
    }
  }, [gl, scene, camera, resources])

  useLayoutEffect(() => {
    if (!resources) return
    const { uniforms } = resources
    uniforms.threshold.value = threshold
    uniforms.opacity.value = opacity
    uniforms.range.value = range
    uniforms.steps.value = steps
  }, [resources, threshold, opacity, range, steps])

  useEffect(() => {
    // App's effect runs initLab() after child effects and resets __LAB__.info;
    // publish on the next task so the value survives. Classic WebGL has no clouds.
    const timer = window.setTimeout(() => setInfo('cloud', resources !== null), 0)
    return () => window.clearTimeout(timer)
  }, [resources])

  useFrame((_, delta) => {
    for (const mesh of clouds.current) mesh.rotation.y -= delta * SPIN
  })

  return (
    <>
      <hemisphereLight args={['#cfe6ff', '#5a6b3a', 1.2]} />
      <directionalLight position={[20, 30, 10]} intensity={2} />
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[400, 400]} />
        <meshStandardMaterial color="#6f8f4e" roughness={1} metalness={0} />
      </mesh>
    </>
  )
}

export default function VolumeCloud() {
  return <VolumeCloudContent />
}
