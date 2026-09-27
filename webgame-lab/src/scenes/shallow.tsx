import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, useLoader, useThree } from '@react-three/fiber'
import { KeyboardControls } from '@react-three/drei'
import { CuboidCollider, Physics, RigidBody } from '@react-three/rapier'
import { useControls } from 'leva'
import {
  Color, EquirectangularReflectionMapping, MeshBasicNodeMaterial, MeshStandardNodeMaterial,
  NoColorSpace, RepeatWrapping, SRGBColorSpace, TextureLoader,
  type WebGPURenderer,
} from 'three/webgpu'
import {
  cameraFar, cameraNear, color, float, linearDepth, normalWorld, positionWorld, screenUV, time,
  uniform, vec2, viewportDepthTexture, viewportLinearDepth, viewportSharedTexture,
} from 'three/tsl'
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js'
import { voronoi2d, voronoi3d } from 'three/addons/tsl/math/voronoiNoise.js'
import { setInfo } from '../lab'
import { describeRenderer } from '../renderer'
import { CameraPreset, keyboardMap, Player } from './feel'

// Backdrop water from three.js r186 examples/webgpu_backdrop_water.html around
// feel's ecctrl Fox. The example's Michelle model and water.jpg texture are not
// used: the floor is look.tsx's ground set. The example's depth thresholds are
// normalised against a 0.25–30 m camera; here depth is converted to metres so
// the default 0.1–1000 m camera works. The feel course is not reused because its
// box stands between the follow camera and the Fox's spawn point.

// A lower, closer follow camera than feel's so the legs and waterline read.
const CAMERA = { distance: 4.5, height: 1.6, lookAt: 0.35 }

const SIZE = 40
// Rocks and pillars in front of the spawn at (0, 3), facing +Z: [x, z, radius, height].
const ROCKS = [[1.3, 4.2, 0.4, 0.45], [-1.9, 5.6, 0.55, 0.5], [2.4, 7.4, 0.6, 0.55], [-0.6, 9.2, 0.5, 0.4]] as const
const PILLARS = [[-3.2, 8.2, 0.3, 1.6], [0.9, 11.5, 0.3, 1.2], [4.2, 10.5, 0.35, 2]] as const

function createMaterials() {
  const level = uniform(0.22)
  const speed = uniform(0.8)
  const fade = uniform(1.5)
  const tint = uniform(new Color('#0487e2'))
  const t = time.mul(speed)

  // Example: two voronoi layers make the moving ripple highlights.
  const floorUV = positionWorld.xz
  const waterIntensity = voronoi2d(floorUV.mul(6), t).mul(voronoi2d(floorUV.mul(3), t))
  const waterColor = waterIntensity.mul(1.4).mix(tint, color(0x74ccf4))

  // Distance in metres from the surface to what lies behind it along the view.
  const metres = cameraFar.sub(cameraNear)
  const depth = linearDepth()
  const depthWater = viewportLinearDepth.sub(depth).mul(metres)
  // The example's ratio of 0.04 to 0.1 between its two fades is kept.
  const depthEffect = depthWater.remapClamp(-0.05, fade.mul(0.4))

  // The example offsets by 0.1 of the screen; shallow water reads better with less.
  const refractionUV = screenUV.add(vec2(0, waterIntensity.mul(0.03)))
  const depthTestForRefraction = linearDepth(viewportDepthTexture(refractionUV)).sub(depth).mul(metres)
  const depthRefraction = depthTestForRefraction.remapClamp(0, fade)
  // Do not refract things that stand in front of the surface, such as the Fox's body.
  const finalUV = depthTestForRefraction.lessThan(0).select(screenUV, refractionUV)
  const viewportTexture = viewportSharedTexture(finalUV)

  // Foam: a soft bright band where legs, rocks and pillars cut the surface.
  const foam = depthWater.remapClamp(0.06, 0).mul(waterIntensity.oneMinus()).mul(0.5)

  const water = new MeshBasicNodeMaterial()
  water.colorNode = waterColor
  water.backdropNode = depthEffect
    .mix(viewportSharedTexture(), viewportTexture.mul(depthRefraction.mix(float(1), waterColor)))
    .mul(color(0xd3ebf8))
    .add(foam)
  water.backdropAlphaNode = depthRefraction.oneMinus()
  water.transparent = true
  water.depthWrite = false

  // Example: caustics on a surface's sides, fading with distance from the waterline.
  const causticNoise = voronoi3d(positionWorld.mul(6), t)
  const rockColor = color(0x6f6a62)
  const causticFade = normalWorld.y.mix(positionWorld.y.distance(level).oneMinus().saturate(), 0)
  const rock = new MeshStandardNodeMaterial({ roughness: 0.9 })
  rock.colorNode = causticFade.mix(rockColor, rockColor.add(causticNoise.mul(0.5)))

  // The flat floor has no sides, so its caustics are added light under the surface.
  const floor = new MeshStandardNodeMaterial({ roughness: 1, metalness: 0 })
  floor.emissiveNode = voronoi3d(positionWorld.mul(3), t).pow(3).mul(color(0x74ccf4)).mul(0.35)

  return {
    water, rock, floor, level, speed, fade, tint,
    dispose() {
      for (const material of [water, rock, floor]) material.dispose()
    },
  }
}

function ShallowPool() {
  const { gl, scene, camera } = useThree()
  const published = useRef(false)
  const materials = useMemo(createMaterials, [])
  useEffect(() => () => materials.dispose(), [materials])

  const environment = useLoader(HDRLoader, '/assets/kloofendal_48d_partly_cloudy_puresky_2k.hdr')
  const maps = useLoader(TextureLoader, [
    '/assets/ground/Ground037_1K-JPG_Color.jpg',
    '/assets/ground/Ground037_1K-JPG_NormalGL.jpg',
    '/assets/ground/Ground037_1K-JPG_Roughness.jpg',
  ])

  const { color: tint, depth, rippleSpeed, level } = useControls('Shallow water', {
    color: { value: '#0487e2', label: 'Water colour' },
    depth: { value: 1.5, min: 0.1, max: 6, step: 0.05, label: 'Clear depth (m)' },
    rippleSpeed: { value: 0.8, min: 0, max: 4, step: 0.05, label: 'Ripple speed' },
    level: { value: 0.22, min: 0.05, max: 0.6, step: 0.01, label: 'Water level (m)' },
  })

  // Sky and floor maps; restored on unmount like the look scene.
  useLayoutEffect(() => {
    const previous = { environment: scene.environment, background: scene.background }
    // Same mapping look.tsx sets on this cached HDR.
    environment.mapping = EquirectangularReflectionMapping
    environment.needsUpdate = true
    scene.environment = environment
    scene.background = environment

    // Clone so repeat and colour space do not leak into useLoader's shared cache.
    const [colorMap, normalMap, roughnessMap] = maps.map((map) => {
      const clone = map.clone()
      clone.wrapS = clone.wrapT = RepeatWrapping
      clone.repeat.set(8, 8)
      clone.colorSpace = map === maps[0] ? SRGBColorSpace : NoColorSpace
      clone.needsUpdate = true
      return clone
    })
    Object.assign(materials.floor, { map: colorMap, normalMap, roughnessMap })
    materials.floor.needsUpdate = true

    return () => {
      for (const map of [colorMap, normalMap, roughnessMap]) map.dispose()
      Object.assign(materials.floor, { map: null, normalMap: null, roughnessMap: null })
      scene.environment = previous.environment
      scene.background = previous.background
    }
  }, [scene, environment, maps, materials])

  // Uniforms stay live; none of these recompile the materials.
  useLayoutEffect(() => {
    materials.tint.value.set(tint)
    materials.fade.value = depth
    materials.speed.value = rippleSpeed
    materials.level.value = level
  }, [materials, tint, depth, rippleSpeed, level])

  // Positive priority takes over R3F's render loop, so the flag is set only
  // after a frame with the water has actually been submitted.
  useFrame(() => {
    ;(gl as unknown as WebGPURenderer).render(scene, camera)
    if (!published.current) {
      published.current = true
      setInfo('shallow', true)
    }
  }, 1)

  return (
    <>
      <directionalLight
        position={[-5, 9, 5]}
        color="#fff2e3"
        intensity={3}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-12}
        shadow-camera-right={12}
        shadow-camera-top={12}
        shadow-camera-bottom={-12}
        shadow-camera-near={0.5}
        shadow-camera-far={30}
        shadow-normalBias={0.02}
      />
      <RigidBody type="fixed" colliders={false}>
        {/* Cuboid arguments are half extents; the top is exactly y=0. */}
        <CuboidCollider position={[0, -0.25, 0]} args={[SIZE / 2, 0.25, SIZE / 2]} friction={0.8} />
      </RigidBody>
      <mesh material={materials.floor} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[SIZE, SIZE]} />
      </mesh>
      {/* Visual only, not a collider: the Fox walks on the floor beneath it. */}
      <mesh material={materials.water} position={[0, level, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[SIZE, SIZE]} />
      </mesh>
      {ROCKS.map(([x, z, radius, height]) => (
        <RigidBody key={`${x},${z}`} type="fixed" colliders="hull" position={[x, height / 2, z]}>
          <mesh material={materials.rock} scale={[radius, height, radius * 0.8]} castShadow receiveShadow>
            <dodecahedronGeometry args={[1, 1]} />
          </mesh>
        </RigidBody>
      ))}
      {PILLARS.map(([x, z, radius, height]) => (
        <RigidBody key={`${x},${z}`} type="fixed" colliders="hull" position={[x, height / 2, z]}>
          <mesh material={materials.rock} castShadow receiveShadow>
            <cylinderGeometry args={[radius, radius * 1.15, height, 12]} />
          </mesh>
        </RigidBody>
      ))}
    </>
  )
}

function ShallowUnsupported() {
  useEffect(() => {
    // The backdrop water is a node material; classic WebGL cannot run it.
    // App's effect runs initLab() after child effects; publish on the next task.
    const timer = window.setTimeout(() => setInfo('shallow', false), 0)
    return () => window.clearTimeout(timer)
  }, [])
  return null
}

export default function Shallow() {
  const gl = useThree((state) => state.gl)
  if (describeRenderer(gl).backend === 'webgl-classic') return <ShallowUnsupported />
  return (
    <Physics>
      <ShallowPool />
      <KeyboardControls map={keyboardMap}>
        <Player />
        <CameraPreset {...CAMERA} />
      </KeyboardControls>
    </Physics>
  )
}
