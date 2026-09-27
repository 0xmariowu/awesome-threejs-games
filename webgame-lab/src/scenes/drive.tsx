import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { KeyboardControls, useKeyboardControls } from '@react-three/drei'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { EcctrlVehicle, ShapeCastWheel, type EcctrlVehicleHandle, type VehicleInput } from 'ecctrl/vehicle'
import { useControls } from 'leva'
import { Quaternion, Vector3 } from 'three'
import { setInfo } from '../lab'
import { FeelContent } from './feel'

// Control names match VehicleInput keys, so getKeys() feeds setMovement as-is.
type Control = keyof Pick<VehicleInput, 'forward' | 'backward' | 'steerLeft' | 'steerRight' | 'brake'>
const keyboardMap = [
  { name: 'forward', keys: ['KeyW', 'ArrowUp'] },
  { name: 'backward', keys: ['KeyS', 'ArrowDown'] },
  { name: 'steerLeft', keys: ['KeyA', 'ArrowLeft'] },
  { name: 'steerRight', keys: ['KeyD', 'ArrowRight'] },
  { name: 'brake', keys: ['Space'] },
]

type Triple = [number, number, number]

// Open lane east of the feel course: nothing sits along x=8 ahead of z=-12.
// The vehicle's forward axis is body +Z.
const START: Triple = [8, 1.2, -12]
const WHEEL_RADIUS = 0.4
const WHEELS: { position: Triple; front: boolean }[] = [
  { position: [1.05, 0, 1.3], front: true },
  { position: [-1.05, 0, 1.3], front: true },
  { position: [1.05, 0, -1.3], front: false },
  { position: [-1.05, 0, -1.3], front: false },
]
const RUN_OFF = 300
const CAMERA_BEHIND = 8
const CAMERA_HEIGHT = 3.5
const CAMERA_LOOK_AHEAD = 4
const CAMERA_FOLLOW_RATE = 4

function Car() {
  const vehicle = useRef<EcctrlVehicleHandle>(null)
  const [, getKeys] = useKeyboardControls<Control>()
  const tuning = useControls('Vehicle', {
    engineHorsepower: { value: 6, min: 1, max: 30, step: 0.5, label: 'Engine power (hp)' },
    maxSteerDegrees: { value: 30, min: 5, max: 50, step: 1, label: 'Steering angle (deg)' },
    springK: { value: 180, min: 50, max: 600, step: 5, label: 'Suspension stiffness' },
    dampingC: { value: 16, min: 0, max: 60, step: 1, label: 'Suspension damping' },
    tireGripFactor: { value: 1.5, min: 0.2, max: 4, step: 0.05, label: 'Tire grip' },
    maxBrakeTorque: {
      value: 40, min: 0, max: 150, step: 1, label: 'Handbrake torque',
      hint: 'Space brakes the rear wheels only, so it can kick the tail out.',
    },
  })
  // EcctrlVehicle memoizes on carConfig identity and re-syncs wheels when these change.
  const carConfig = useMemo(() => ({
    engineHorsepower: tuning.engineHorsepower,
    maxSteerAngle: tuning.maxSteerDegrees * Math.PI / 180,
  }), [tuning.engineHorsepower, tuning.maxSteerDegrees])

  // Run before EcctrlVehicle's frame callback so input applies this frame.
  useFrame(() => {
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
    const body = vehicle.current?.body
    if (!body) return
    const { x, y, z } = body.translation()
    // Horizontal distance from the spawn point, so evidence proves the car drove.
    const travel = Math.hypot(x - START[0], z - START[2])
    setInfo('vehicle', { x, y, z, travel })

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
    <EcctrlVehicle ref={vehicle} position={START} carConfig={carConfig}>
      {/* Chassis: half extents, matching the box mesh below. */}
      <CuboidCollider args={[0.9, 0.3, 2]} />
      <mesh castShadow receiveShadow>
        <boxGeometry args={[1.8, 0.6, 4]} />
        <meshStandardMaterial color="#c0392b" roughness={0.45} metalness={0.2} />
      </mesh>
      <mesh position={[0, 0.55, -0.3]} castShadow receiveShadow>
        <boxGeometry args={[1.5, 0.5, 2]} />
        <meshStandardMaterial color="#2c3e50" roughness={0.2} metalness={0.4} />
      </mesh>
      {WHEELS.map(({ position, front }) => (
        <ShapeCastWheel
          key={position.join(',')}
          position={position}
          rayShapeR={WHEEL_RADIUS}
          wheelModelRadius={WHEEL_RADIUS}
          springK={tuning.springK}
          dampingC={tuning.dampingC}
          tireGripFactor={tuning.tireGripFactor}
          maxBrakeTorque={tuning.maxBrakeTorque}
          driveWheel
          steerWheel={front}
          brakeWheel={!front}
        >
          {/* The wheel spins its model about local X; lay the cylinder on that axis. */}
          <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[WHEEL_RADIUS, WHEEL_RADIUS, 0.3, 24]} />
            <meshStandardMaterial color="#1b1b1b" roughness={0.9} />
          </mesh>
        </ShapeCastWheel>
      ))}
    </EcctrlVehicle>
  )
}

// The feel course ground is only 40 m wide and a car coasts far past it, so
// extend the world with a plain run-off field. Its top is also y=0; the mesh
// sits a little lower so it never z-fights the textured course plane.
function RunOff() {
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

export default function Drive() {
  return (
    <FeelContent player={false}>
      <RunOff />
      <KeyboardControls map={keyboardMap}>
        <Car />
      </KeyboardControls>
    </FeelContent>
  )
}
