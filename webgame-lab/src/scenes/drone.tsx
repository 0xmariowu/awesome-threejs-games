import { useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { KeyboardControls, useKeyboardControls } from '@react-three/drei'
import { CuboidCollider, CylinderCollider, Physics, RigidBody } from '@react-three/rapier'
import { EcctrlVehicle, ThrustPropeller, type EcctrlVehicleHandle, type VehicleInput } from 'ecctrl/vehicle'
import { useControls } from 'leva'
import { Quaternion, Vector3 } from 'three'
import { setInfo } from '../lab'
import { LookContent } from './look'

// Control names match VehicleInput keys, so getKeys() feeds setMovement as-is.
// These are the fields EcctrlVehicle's VELOCITY drone mode reads.
type Control = keyof Pick<VehicleInput,
  'throttleUp' | 'throttleDown' | 'pitchForward' | 'pitchBackward' | 'rollLeft' | 'rollRight' | 'yawLeft' | 'yawRight'>
const keyboardMap = [
  { name: 'throttleUp', keys: ['Space'] },
  { name: 'throttleDown', keys: ['ShiftLeft', 'ShiftRight'] },
  { name: 'pitchForward', keys: ['KeyW', 'ArrowUp'] },
  { name: 'pitchBackward', keys: ['KeyS', 'ArrowDown'] },
  { name: 'rollLeft', keys: ['KeyA', 'ArrowLeft'] },
  { name: 'rollRight', keys: ['KeyD', 'ArrowRight'] },
  { name: 'yawLeft', keys: ['KeyQ'] },
  { name: 'yawRight', keys: ['KeyE'] },
]

type Triple = [number, number, number]

// Start in the air south of the look props, facing them. The drone's forward axis is body +Z.
const START: Triple = [0, 1.5, -6]
const MASS = 1
// The README recipe scaled to a 1 m drone: diagonal pairs share a spin direction,
// so their reaction torques cancel at hover and the mixer can yaw by unbalancing them.
const PROPELLERS: { position: Triple; invertTorque: boolean }[] = [
  { position: [0.5, 0.12, 0.5], invertTorque: false },
  { position: [-0.5, 0.12, 0.5], invertTorque: true },
  { position: [0.5, 0.12, -0.5], invertTorque: true },
  { position: [-0.5, 0.12, -0.5], invertTorque: false },
]
const PROPELLER_RADIUS = 0.24
const ARM_LENGTH = Math.hypot(0.5, 0.5)
const RUN_OFF = 300
const PILLARS: { position: [number, number]; height: number }[] = [
  { position: [-6, 12], height: 12 },
  { position: [6, 16], height: 16 },
  { position: [0, 28], height: 20 },
  { position: [-10, 36], height: 14 },
  { position: [10, 42], height: 18 },
]
const PILLAR_RADIUS = 0.8
const RINGS: { position: Triple; rotationY: number }[] = [
  { position: [0, 5, 18], rotationY: 0 },
  { position: [-5, 8, 32], rotationY: 0.5 },
  { position: [5, 11, 48], rotationY: -0.4 },
]
const CAMERA_BEHIND = 4.5
const CAMERA_HEIGHT = 1.8
const CAMERA_LOOK_AHEAD = 3
const CAMERA_FOLLOW_RATE = 4

// A blade pair plus hub; ThrustPropeller spins its children about local Y.
function PropellerModel({ color }: { color: string }) {
  return (
    <>
      <mesh castShadow>
        <boxGeometry args={[PROPELLER_RADIUS * 2, 0.015, 0.05]} />
        <meshStandardMaterial color={color} roughness={0.5} />
      </mesh>
      <mesh rotation={[0, Math.PI / 2, 0]} castShadow>
        <boxGeometry args={[PROPELLER_RADIUS * 2, 0.015, 0.05]} />
        <meshStandardMaterial color={color} roughness={0.5} />
      </mesh>
      <mesh>
        <cylinderGeometry args={[0.04, 0.04, 0.04, 12]} />
        <meshStandardMaterial color="#d0d0d0" metalness={0.6} roughness={0.3} />
      </mesh>
    </>
  )
}

function Drone() {
  const vehicle = useRef<EcctrlVehicleHandle>(null)
  const [, getKeys] = useKeyboardControls<Control>()
  const tuning = useControls('Drone', {
    maxThrust: {
      value: 6, min: 3, max: 15, step: 0.1, label: 'Thrust per propeller (N)',
      hint: 'The drone weighs 1 kg, so four propellers need more than 2.5 N each to hover.',
    },
    maxVertSpeed: { value: 6, min: 1, max: 15, step: 0.5, label: 'Climb speed (m/s)' },
    maxHorizSpeed: { value: 12, min: 2, max: 30, step: 0.5, label: 'Top speed (m/s)' },
    maxTiltDegrees: { value: 35, min: 5, max: 60, step: 1, label: 'Max tilt (deg)' },
    TILT_P: { value: 15, min: 2, max: 40, step: 0.5, label: 'Self-levelling strength' },
    TILT_D: { value: 3, min: 0, max: 10, step: 0.1, label: 'Self-levelling damping' },
  })
  // EcctrlVehicle memoizes on droneConfig identity, so new values apply live.
  const droneConfig = useMemo(() => ({
    controlMode: 'VELOCITY' as const,
    maxVertSpeed: tuning.maxVertSpeed,
    maxHorizSpeed: tuning.maxHorizSpeed,
    maxTiltAngle: tuning.maxTiltDegrees * Math.PI / 180,
    TILT_P: tuning.TILT_P,
    TILT_D: tuning.TILT_D,
  }), [tuning.maxVertSpeed, tuning.maxHorizSpeed, tuning.maxTiltDegrees, tuning.TILT_P, tuning.TILT_D])

  // ThrustPropeller reads the vehicle body once at render time, and on the first
  // render the RigidBody does not exist yet. Mount the propellers only after it does.
  const [bodyReady, setBodyReady] = useState(false)

  // Run before EcctrlVehicle's frame callback so input applies this frame.
  useFrame(() => {
    if (!bodyReady && vehicle.current?.body) setBodyReady(true)
    vehicle.current?.setMovement(getKeys())
  }, -1)

  const scratch = useMemo(() => ({
    position: new Vector3(),
    quaternion: new Quaternion(),
    forward: new Vector3(),
    goal: new Vector3(),
    lookAt: new Vector3(),
    smoothLookAt: new Vector3(),
    placed: false,
  }), [])

  // Priority 0 keeps R3F's automatic rendering (positive priorities disable it).
  useFrame(({ camera }, delta) => {
    const handle = vehicle.current
    const body = handle?.body
    if (!handle || !body) return
    const { x, y, z } = body.translation()
    // Climb and the live propeller count prove the drone lifted itself on its rotors.
    const climb = Math.round((y - START[1]) * 100) / 100
    let propellers = 0
    for (const info of handle.propellersInfo.values()) {
      if (info.current?.enable) propellers++
    }
    setInfo('drone', { x, y, z, climb, propellers })

    const { position, quaternion, forward, goal, lookAt, smoothLookAt } = scratch
    position.set(x, y, z)
    const r = body.rotation()
    quaternion.set(r.x, r.y, r.z, r.w)
    // Flatten the heading so pitch and roll do not swing the camera.
    forward.set(0, 0, 1).applyQuaternion(quaternion).setY(0)
    if (forward.lengthSq() < 1e-6) forward.set(0, 0, 1)
    forward.normalize()
    goal.copy(position).addScaledVector(forward, -CAMERA_BEHIND).setY(y + CAMERA_HEIGHT)
    lookAt.copy(position).addScaledVector(forward, CAMERA_LOOK_AHEAD)

    if (!scratch.placed) {
      camera.position.copy(goal)
      smoothLookAt.copy(lookAt)
      scratch.placed = true
    } else {
      const t = 1 - Math.exp(-CAMERA_FOLLOW_RATE * delta)
      camera.position.lerp(goal, t)
      smoothLookAt.lerp(lookAt, t)
    }
    camera.lookAt(smoothLookAt)
    camera.updateMatrixWorld()
  }, 0)

  return (
    <EcctrlVehicle ref={vehicle} position={START} droneConfig={droneConfig}>
      {/* A flat plate spanning the arms keeps the body's inertia in line with the propeller lever arms. */}
      <CuboidCollider args={[0.6, 0.08, 0.6]} mass={MASS} />
      <mesh castShadow receiveShadow>
        <boxGeometry args={[0.36, 0.14, 0.5]} />
        <meshStandardMaterial color="#2c3e50" roughness={0.4} metalness={0.3} />
      </mesh>
      {/* Nose marker so the heading reads from the chase camera. */}
      <mesh position={[0, 0, 0.27]} castShadow>
        <boxGeometry args={[0.12, 0.08, 0.06]} />
        <meshStandardMaterial color="#c0392b" roughness={0.5} />
      </mesh>
      {PROPELLERS.map(({ position }) => (
        <group key={`arm-${position.join(',')}`} rotation={[0, Math.atan2(position[0], position[2]), 0]}>
          <mesh position={[0, 0.02, ARM_LENGTH / 2]} castShadow>
            <boxGeometry args={[0.05, 0.04, ARM_LENGTH]} />
            <meshStandardMaterial color="#7f8c8d" roughness={0.6} metalness={0.2} />
          </mesh>
          <mesh position={[0, 0.06, ARM_LENGTH]} castShadow>
            <cylinderGeometry args={[0.05, 0.05, 0.1, 16]} />
            <meshStandardMaterial color="#1b1b1b" roughness={0.7} />
          </mesh>
        </group>
      ))}
      {bodyReady && PROPELLERS.map(({ position, invertTorque }) => (
        <ThrustPropeller
          key={position.join(',')}
          position={position}
          invertTorque={invertTorque}
          maxThrust={tuning.maxThrust}
          debug={false}
          propellerModelMaxSpin={2}
        >
          <PropellerModel color={invertTorque ? '#e67e22' : '#ecf0f1'} />
        </ThrustPropeller>
      ))}
    </EcctrlVehicle>
  )
}

// LookContent's textured ground is 40 m and has no collider, so add a plain
// field underneath. Its top is y=0; the mesh sits a little lower so it never
// z-fights the textured plane.
function Ground() {
  return (
    <RigidBody type="fixed" colliders={false}>
      <CuboidCollider position={[0, -0.25, 0]} args={[RUN_OFF, 0.25, RUN_OFF]} friction={0.8} />
      <mesh position={[0, -0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[RUN_OFF * 2, RUN_OFF * 2]} />
        <meshStandardMaterial color="#77804f" roughness={1} />
      </mesh>
    </RigidBody>
  )
}

function Course() {
  return (
    <>
      {PILLARS.map(({ position: [x, z], height }) => (
        <RigidBody key={`pillar-${x},${z}`} type="fixed" colliders={false} position={[x, height / 2, z]}>
          <CylinderCollider args={[height / 2, PILLAR_RADIUS]} />
          <mesh castShadow receiveShadow>
            <cylinderGeometry args={[PILLAR_RADIUS, PILLAR_RADIUS, height, 24]} />
            <meshStandardMaterial color="#b8a88a" roughness={0.9} />
          </mesh>
        </RigidBody>
      ))}
      {RINGS.map(({ position, rotationY }) => (
        <RigidBody key={`ring-${position.join(',')}`} type="fixed" colliders="trimesh" position={position} rotation={[0, rotationY, 0]}>
          <mesh castShadow receiveShadow>
            <torusGeometry args={[2.2, 0.18, 12, 48]} />
            <meshStandardMaterial color="#f1c40f" roughness={0.35} metalness={0.3} />
          </mesh>
        </RigidBody>
      ))}
    </>
  )
}

export default function DroneScene() {
  return (
    <Physics>
      <LookContent />
      <Ground />
      <Course />
      <KeyboardControls map={keyboardMap}>
        <Drone />
      </KeyboardControls>
    </Physics>
  )
}
