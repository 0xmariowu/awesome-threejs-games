import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useLoader, useThree } from '@react-three/fiber'
import { KeyboardControls, useKeyboardControls } from '@react-three/drei'
import { BallCollider, CylinderCollider, Physics, RigidBody } from '@react-three/rapier'
import { Ecctrl, type EcctrlHandle } from 'ecctrl'
import { EcctrlAnimationStateController } from 'ecctrl/animation'
import { useCustomGravity } from 'ecctrl/gravity'
import { useControls } from 'leva'
import { Euler, NoColorSpace, Quaternion, RepeatWrapping, SRGBColorSpace, TextureLoader, Vector3 } from 'three'
import { setInfo } from '../lab'
import { Fox } from './feel'

// Movement names match Ecctrl's MovementInput; Q/E only turn the camera here.
type Control = 'forward' | 'backward' | 'leftward' | 'rightward' | 'jump' | 'run' | 'turnLeft' | 'turnRight'
const keyboardMap = [
  { name: 'forward', keys: ['KeyW', 'ArrowUp'] },
  { name: 'backward', keys: ['KeyS', 'ArrowDown'] },
  { name: 'leftward', keys: ['KeyA', 'ArrowLeft'] },
  { name: 'rightward', keys: ['KeyD', 'ArrowRight'] },
  { name: 'jump', keys: ['Space'] },
  { name: 'run', keys: ['Shift'] },
  { name: 'turnLeft', keys: ['KeyQ'] },
  { name: 'turnRight', keys: ['KeyE'] },
]

type Triple = [number, number, number]

// The planet sits at the origin; the fox spawns on its +Y pole facing +Z.
const PLANET_RADIUS = 15
// The tower stands 60° around the planet along +Z, straight ahead of the spawn,
// so holding W walks over the curve to its foot (about 11 m of clear lane).
const TOWER_AXIS = new Vector3(0, Math.cos(Math.PI / 3), Math.sin(Math.PI / 3))
const TOWER_BASE = TOWER_AXIS.clone().multiplyScalar(PLANET_RADIUS)
const TOWER_RADIUS = 3
const TOWER_HEIGHT = 14
// Sink the tower into the planet so the curved surface leaves no gap at its foot.
const TOWER_SINK = 1.5
const TOWER_BANDS = ['#c9b79c', '#8f6f55']
// Leave the wall zone only this far past its entry reach, so a fox hovering at
// the boundary does not flip gravity every frame.
const ZONE_HYSTERESIS = 0.3
const SPAWN: Triple = [0, PLANET_RADIUS + 0.65, 0]
const CAMERA_BEHIND = 6
const CAMERA_ABOVE = 3.5
const CAMERA_LOOK_ABOVE = 0.6
const CAMERA_TURN_RATE = Math.PI / 2
const UP = new Vector3(0, 1, 0)

// Euler for a local frame whose +Y points along `dir`.
function alignY(dir: Vector3): Triple {
  const euler = new Euler().setFromQuaternion(new Quaternion().setFromUnitVectors(UP, dir.clone().normalize()))
  return [euler.x, euler.y, euler.z]
}

const scratch = { local: new Vector3(), radial: new Vector3(), closest: new Vector3(), gravity: new Vector3() }

// Closest point on the solid tower (side, top cap or rim) to `pos`; returns the distance.
function towerClosestPoint(pos: Vector3, out: Vector3): number {
  const { local, radial } = scratch
  local.subVectors(pos, TOWER_BASE)
  const h = local.dot(TOWER_AXIS)
  radial.copy(local).addScaledVector(TOWER_AXIS, -h)
  const d = radial.length()
  if (d > TOWER_RADIUS) radial.multiplyScalar(TOWER_RADIUS / d)
  const clampedH = Math.min(Math.max(h, -TOWER_SINK), TOWER_HEIGHT)
  out.copy(TOWER_BASE).addScaledVector(TOWER_AXIS, clampedH).add(radial)
  return pos.distanceTo(out)
}

type Zone = 'planet' | 'tower'

// One stable field function per the README's dynamic-gravity pattern: it reads
// refs, so Leva changes never replace the field or re-render Ecctrl.
function GravitySetup({ strength, reach, zone }: {
  strength: { current: number }
  reach: { current: number }
  zone: { current: Zone }
}) {
  const setGravityField = useCustomGravity((state) => state.setGravityField)

  useEffect(() => {
    const previous = useCustomGravity.getState().gravityField
    setGravityField((bodyPos) => {
      const { closest, gravity } = scratch
      // Wall-walking zone: within reach of the tower, fall toward its nearest
      // surface point. On the side that is cylindrical gravity toward the axis;
      // above the cap it points down onto the top, and past the rim it wraps the edge.
      // Enter at reach, leave at reach + hysteresis; the zone ref remembers which side.
      const distance = towerClosestPoint(bodyPos, closest)
      const limit = zone.current === 'tower' ? reach.current + ZONE_HYSTERESIS : reach.current
      if (distance > 1e-4 && distance < limit) {
        zone.current = 'tower'
        return gravity.subVectors(closest, bodyPos).multiplyScalar(strength.current / distance)
      }
      // Spherical gravity everywhere else.
      zone.current = 'planet'
      return gravity.copy(bodyPos).negate().normalize().multiplyScalar(strength.current)
    })
    // The gravity store is global; hand the previous field back on unmount.
    return () => setGravityField(previous)
  }, [setGravityField, strength, reach, zone])

  return null
}

function PlanetPlayer({ zone }: { zone: { current: Zone } }) {
  const controller = useRef<EcctrlHandle>(null)
  const [, getKeys] = useKeyboardControls<Control>()
  const camera = useThree((state) => state.camera)
  const rig = useMemo(() => ({
    up: new Vector3(0, 1, 0),
    previousUp: new Vector3(0, 1, 0),
    heading: new Vector3(0, 0, 1),
    turn: new Quaternion(),
    position: new Vector3(),
    camera: new Vector3(),
    lookAt: new Vector3(),
  }), [])

  // The camera callback below rewrites camera.up; hand the scene's up back on unmount.
  useEffect(() => {
    const previousUp = camera.up.clone()
    return () => { camera.up.copy(previousUp) }
  }, [camera])

  // v2 accepts input through its handle; run before Ecctrl's frame callback.
  useFrame(() => {
    controller.current?.setMovement(getKeys())
  }, -1)

  // -0.5 runs after the input callback and before Ecctrl's priority-0 callback,
  // which reads the camera for W direction. Non-positive priorities keep R3F's
  // automatic rendering.
  useFrame(({ camera }, delta) => {
    const handle = controller.current
    if (!handle?.body) return
    const { x, y, z } = handle.body.translation()
    setInfo('player', { x, y, z })

    const { up, previousUp, heading, turn, position, lookAt } = rig
    position.set(x, y, z)
    // Ecctrl's up axis eases toward the gravity field; before its first frame it is zero.
    up.copy(handle.upAxis)
    if (up.lengthSq() < 0.5) up.copy(position).normalize()
    up.normalize()

    // Carry the camera heading along with the changing up axis (parallel transport),
    // so walking over the planet or onto the wall keeps "forward" continuous.
    turn.setFromUnitVectors(previousUp, up)
    heading.applyQuaternion(turn)
    const { turnLeft, turnRight } = getKeys()
    if (turnLeft !== turnRight) heading.applyAxisAngle(up, (turnLeft ? 1 : -1) * CAMERA_TURN_RATE * delta)
    heading.projectOnPlane(up)
    if (heading.lengthSq() < 1e-6) heading.set(1, 0, 0).projectOnPlane(up)
    if (heading.lengthSq() < 1e-6) heading.set(0, 0, 1).projectOnPlane(up)
    heading.normalize()
    previousUp.copy(up)

    // Ecctrl derives WASD from the camera direction and camera.up, so the camera
    // must share the character's up axis or forward degenerates on the wall.
    rig.camera.copy(position).addScaledVector(up, CAMERA_ABOVE).addScaledVector(heading, -CAMERA_BEHIND)
    // Keep the camera outside the planet while the fox climbs the tower's foot.
    if (rig.camera.length() < PLANET_RADIUS + 1) rig.camera.setLength(PLANET_RADIUS + 1)
    lookAt.copy(position).addScaledVector(up, CAMERA_LOOK_ABOVE)
    camera.position.copy(rig.camera)
    camera.up.copy(up)
    camera.lookAt(lookAt)
    camera.updateMatrixWorld()

    setInfo('planet', {
      radius: PLANET_RADIUS,
      centreDistance: position.length(),
      zone: zone.current,
      onGround: handle.isOnGround,
      up: up.toArray(),
    })
  }, -0.5)

  return (
    <>
      {/* Same capsule and tuning as feel.tsx: the default 0.03 balance damping
          makes this small capsule's angular velocity diverge (NaN). */}
      <Ecctrl
        ref={controller}
        position={SPAWN}
        enableCustomGravity
        capsuleHalfHeight={0.2}
        capsuleRadius={0.25}
        maxWalkVel={2}
        maxRunVel={5}
        jumpVel={5}
        autoBalanceDampingC={0.01}
        floatHeight={0.2}
        enableToggleRun={false}
      >
        <Fox />
      </Ecctrl>
      <EcctrlAnimationStateController ecctrl={controller} />
    </>
  )
}

function Planet() {
  const [colorMap, normalMap] = useLoader(TextureLoader, [
    '/assets/ground/Ground037_1K-JPG_Color.jpg',
    '/assets/ground/Ground037_1K-JPG_NormalGL.jpg',
  ])
  // Clone so this scene's tiling never leaks into the cached textures LookContent uses.
  const [map, normal] = useMemo(() => [colorMap, normalMap].map((source) => {
    const texture = source.clone()
    texture.wrapS = texture.wrapT = RepeatWrapping
    texture.repeat.set(16, 8)
    texture.colorSpace = source === colorMap ? SRGBColorSpace : NoColorSpace
    texture.needsUpdate = true
    return texture
  }), [colorMap, normalMap])

  return (
    <RigidBody type="fixed" colliders={false}>
      <BallCollider args={[PLANET_RADIUS]} friction={0.8} />
      {/* Poles turned to ±X so the UV pinch stays off the walking lane (the YZ great circle). */}
      <mesh rotation={[0, 0, Math.PI / 2]} receiveShadow>
        <sphereGeometry args={[PLANET_RADIUS, 128, 64]} />
        <meshStandardMaterial map={map} normalMap={normal} color="#c8d8a8" roughness={1} metalness={0} />
      </mesh>
    </RigidBody>
  )
}

function Tower() {
  const bands = Math.round((TOWER_HEIGHT + TOWER_SINK) / 2)
  const bandHeight = (TOWER_HEIGHT + TOWER_SINK) / bands
  return (
    <RigidBody type="fixed" colliders={false} position={TOWER_BASE.toArray()} rotation={alignY(TOWER_AXIS)}>
      <CylinderCollider
        position={[0, (TOWER_HEIGHT - TOWER_SINK) / 2, 0]}
        args={[(TOWER_HEIGHT + TOWER_SINK) / 2, TOWER_RADIUS]}
        friction={0.8}
      />
      {/* Alternating bands make climbing progress readable on the wall. */}
      {Array.from({ length: bands }, (_, index) => (
        <mesh key={index} position={[0, -TOWER_SINK + (index + 0.5) * bandHeight, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[TOWER_RADIUS, TOWER_RADIUS, bandHeight, 48]} />
          <meshStandardMaterial color={TOWER_BANDS[index % 2]} roughness={0.85} />
        </mesh>
      ))}
    </RigidBody>
  )
}

// Rocks and trees on a Fibonacci sphere, skipping the spawn-to-tower lane and the tower foot.
function Props() {
  const items = useMemo(() => {
    const count = 44
    const golden = Math.PI * (3 - Math.sqrt(5))
    const result: { dir: Vector3; kind: 'rock' | 'tree'; size: number }[] = []
    for (let index = 0; index < count; index++) {
      const y = 1 - 2 * (index + 0.5) / count
      const ring = Math.sqrt(1 - y * y)
      const dir = new Vector3(Math.cos(golden * index) * ring, y, Math.sin(golden * index) * ring)
      if (Math.abs(dir.x) < 0.3 || dir.dot(TOWER_AXIS) > Math.cos(Math.PI / 8)) continue
      result.push({ dir, kind: index % 3 === 0 ? 'rock' : 'tree', size: 0.8 + 0.4 * ((index * 7) % 5) / 4 })
    }
    return result
  }, [])

  return (
    <>
      {items.map(({ dir, kind, size }) => (
        <RigidBody
          key={dir.toArray().join(',')}
          type="fixed"
          colliders={false}
          position={dir.clone().multiplyScalar(PLANET_RADIUS).toArray()}
          rotation={alignY(dir)}
        >
          {kind === 'rock' ? (
            <>
              <BallCollider position={[0, 0.15 * size, 0]} args={[0.6 * size]} />
              <mesh position={[0, 0.15 * size, 0]} castShadow receiveShadow>
                <dodecahedronGeometry args={[0.7 * size, 0]} />
                <meshStandardMaterial color="#7d7a74" roughness={0.9} flatShading />
              </mesh>
            </>
          ) : (
            <>
              <CylinderCollider position={[0, 0.7 * size, 0]} args={[0.7 * size, 0.18 * size]} />
              <mesh position={[0, 0.7 * size, 0]} castShadow>
                <cylinderGeometry args={[0.12 * size, 0.18 * size, 1.4 * size, 8]} />
                <meshStandardMaterial color="#6b4a2f" roughness={0.9} />
              </mesh>
              <mesh position={[0, 2.1 * size, 0]} castShadow>
                <coneGeometry args={[0.9 * size, 2.2 * size, 10]} />
                <meshStandardMaterial color="#3f7a3a" roughness={0.8} flatShading />
              </mesh>
            </>
          )}
        </RigidBody>
      ))}
    </>
  )
}

function Stars() {
  const positions = useMemo(() => {
    const count = 800
    const array = new Float32Array(count * 3)
    for (let index = 0; index < count; index++) {
      // Deterministic spread on a far shell (hash-style sequence, no Math.random).
      const u = (index * 0.618034) % 1
      const v = (index * 0.754877) % 1
      const theta = 2 * Math.PI * u
      const phi = Math.acos(2 * v - 1)
      array.set([
        300 * Math.sin(phi) * Math.cos(theta), 300 * Math.cos(phi), 300 * Math.sin(phi) * Math.sin(theta),
      ], index * 3)
    }
    return array
  }, [])
  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial color="#dfe6ff" size={1} sizeAttenuation={false} />
    </points>
  )
}

export default function PlanetScene() {
  const gravity = useControls('Gravity', {
    strength: { value: 9.81, min: 1, max: 25, step: 0.01, label: 'Gravity strength (m/s²)' },
    reach: {
      value: 1.2, min: 0.9, max: 3, step: 0.1, label: 'Wall zone reach (m)',
      hint: 'Within this distance of the tower, gravity pulls toward the tower instead of the planet centre.',
    },
  })
  const strength = useRef(gravity.strength)
  const reach = useRef(gravity.reach)
  const zone = useRef<Zone>('planet')
  strength.current = gravity.strength
  reach.current = gravity.reach

  return (
    <>
      <color attach="background" args={['#060a18']} />
      <hemisphereLight args={['#b8cfff', '#3a3226', 1.1]} />
      <directionalLight
        position={[12, 40, 30]}
        intensity={3}
        color="#fff2e3"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-26}
        shadow-camera-right={26}
        shadow-camera-top={26}
        shadow-camera-bottom={-26}
        shadow-camera-near={1}
        shadow-camera-far={120}
        shadow-normalBias={0.02}
      />
      <Stars />
      {/* Rapier's own gravity is off; Ecctrl applies the custom field per body. */}
      <Physics gravity={[0, 0, 0]}>
        <GravitySetup strength={strength} reach={reach} zone={zone} />
        <Planet />
        <Tower />
        <Props />
        <KeyboardControls map={keyboardMap}>
          <PlanetPlayer zone={zone} />
        </KeyboardControls>
      </Physics>
    </>
  )
}
