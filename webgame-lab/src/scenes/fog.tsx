import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useLoader, useThree } from '@react-three/fiber'
import { useControls } from 'leva'
import {
  Color, NoColorSpace, Object3D, RepeatWrapping, SRGBColorSpace, TextureLoader,
  type InstancedMesh,
} from 'three/webgpu'
import { color as colorNode, exponentialHeightFogFactor, fog, uniform } from 'three/tsl'
import { setInfo } from '../lab'
import { describeRenderer } from '../renderer'
import { LookContent } from './look'

// Pillars scattered from the look set out to FAR metres, inside a wedge that
// faces away from the look camera so most of them are in frame.
const PILLARS = 90
const NEAR = 14
const FAR = 150
const WEDGE = Math.PI / 3
const VIEW_AZIMUTH = Math.atan2(-7, -10)
// Look's ground is 40 m with 8 repeats; the outer ground keeps the same 5 m tile.
const OUTER_GROUND = 400

// Small seeded generator so every capture lays the field out the same way.
function random(seed: number): () => number {
  let state = seed
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 4294967296
  }
}

function FogContent() {
  const { gl, scene } = useThree()
  const classic = describeRenderer(gl).backend === 'webgl-classic'
  const pillars = useRef<InstancedMesh>(null)

  const { enabled, density, height, fogColor } = useControls('Fog', {
    enabled: { value: true, label: 'Fog' },
    density: { value: 0.01, min: 0.001, max: 0.05, step: 0.0005, label: 'Density' },
    height: { value: 3, min: 0, max: 20, step: 0.1, label: 'Fog height (m)' },
    fogColor: { value: '#c9d5e0', label: 'Colour' },
  })

  // As in webgpu_fog_height: exponentialHeightFogFactor is 1 - exp(-(d * m)^2)
  // with m = max(height - y, 0) * viewZ, so fog grows with distance and with
  // depth below `height`, and is zero above it. The HDRI background is not fogged.
  const fogSetup = useMemo(() => {
    const densityUniform = uniform(0.01)
    const heightUniform = uniform(3)
    const colorUniform = uniform(new Color())
    const node = fog(colorNode(colorUniform), exponentialHeightFogFactor(densityUniform, heightUniform))
    return { node, densityUniform, heightUniform, colorUniform }
  }, [])

  // Classic WebGL has no node fog; the scene then renders without fog.
  const active = enabled && !classic

  useLayoutEffect(() => {
    const previous = scene.fogNode
    scene.fogNode = active ? fogSetup.node : null
    return () => {
      scene.fogNode = previous
    }
  }, [scene, fogSetup, active])

  useLayoutEffect(() => {
    fogSetup.densityUniform.value = density
    fogSetup.heightUniform.value = height
    fogSetup.colorUniform.value.set(fogColor)
  }, [fogSetup, density, height, fogColor])

  useEffect(() => {
    // App's effect runs initLab() after child effects and resets __LAB__.info;
    // publish on the next task so the value survives.
    const timer = window.setTimeout(() => setInfo('fog', active ? 'height' : 'off'), 0)
    return () => window.clearTimeout(timer)
  }, [active])

  // Same ground textures as the look scene; clones keep the shared cache untouched.
  const loaded = useLoader(TextureLoader, [
    '/assets/ground/Ground037_1K-JPG_Color.jpg',
    '/assets/ground/Ground037_1K-JPG_NormalGL.jpg',
    '/assets/ground/Ground037_1K-JPG_Roughness.jpg',
    '/assets/ground/Ground037_1K-JPG_AmbientOcclusion.jpg',
  ])
  const [groundColor, normal, roughness, ao] = useMemo(() => loaded.map((source, index) => {
    const map = source.clone()
    map.wrapS = map.wrapT = RepeatWrapping
    map.repeat.set(OUTER_GROUND / 5, OUTER_GROUND / 5)
    map.colorSpace = index === 0 ? SRGBColorSpace : NoColorSpace
    map.needsUpdate = true
    return map
  }), [loaded])
  useEffect(() => () => { for (const map of [groundColor, normal, roughness, ao]) map.dispose() },
    [groundColor, normal, roughness, ao])

  useLayoutEffect(() => {
    const mesh = pillars.current
    if (!mesh) return
    const next = random(7)
    const dummy = new Object3D()
    for (let i = 0; i < PILLARS; i++) {
      const angle = VIEW_AZIMUTH + (next() * 2 - 1) * WEDGE
      // Square-root spacing spreads pillars evenly over the wedge's area.
      const distance = Math.sqrt(NEAR * NEAR + next() * (FAR * FAR - NEAR * NEAR))
      const tall = 4 + next() * 10
      dummy.position.set(Math.sin(angle) * distance, tall / 2, Math.cos(angle) * distance)
      dummy.scale.set(1, tall, 1)
      dummy.rotation.set(0, next() * Math.PI, 0)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    }
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [])

  return (
    <>
      {/* Just under look's 40 m ground so the two never z-fight. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <planeGeometry args={[OUTER_GROUND, OUTER_GROUND]} />
        <meshStandardMaterial map={groundColor} normalMap={normal} roughnessMap={roughness} aoMap={ao}
          roughness={1} metalness={0} />
      </mesh>
      <instancedMesh ref={pillars} args={[undefined, undefined, PILLARS]} receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#b8b0a4" roughness={0.8} />
      </instancedMesh>
    </>
  )
}

export default function Fog() {
  return (
    <>
      <LookContent />
      <FogContent />
    </>
  )
}
