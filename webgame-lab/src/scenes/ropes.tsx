import { createRef, useEffect, useMemo, useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  BallCollider, CapsuleCollider, CuboidCollider, RigidBody,
  useRevoluteJoint, useRopeJoint, useSphericalJoint,
  type RapierRigidBody, type RevoluteJointParams, type RopeJointParams, type SphericalJointParams,
} from '@react-three/rapier'
import { button, useControls } from 'leva'
import { DoubleSide, Quaternion, Vector3, type Mesh } from 'three'
import { setInfo } from '../lab'
import { CameraPreset, FeelContent } from './feel'

// Rope bridge, hanging chain and swinging lamp built from @react-three/rapier
// 2.2.0 joint hooks, composed into the feel course as FeelContent children so
// the Fox can bump them. Chain links follow three.js r186
// physics_rapier_joints.html: spherical joints, bottom anchor to top anchor.
// Everything sits ahead of the spawn along +Z, which the follow camera faces.

type Triple = [number, number, number]
// The hooks type their refs as RefObject<RapierRigidBody>; RigidBody fills
// them when it creates its body, before sibling joint effects run.
type BodyRef = RefObject<RapierRigidBody>
const bodyRef = () => createRef<RapierRigidBody>() as BodyRef

// Bridge: planks hinge about X between two fixed end posts. The joint points
// follow a symmetric sag so the chain starts slack and resting.
const PLANKS = 10
const PITCH = 0.5
const SAG = 0.3 // slope of the first segment, radians
const BRIDGE_START: Triple = [0, 0.45, 6.4]
const bridgePoints: Triple[] = [BRIDGE_START]
const planks: { position: Triple; angle: number }[] = []
for (let index = 0; index < PLANKS; index++) {
  const angle = SAG - 2 * SAG * (index + 0.5) / PLANKS
  const [x, y, z] = bridgePoints[index]
  const next: Triple = [x, y - PITCH * Math.sin(angle), z + PITCH * Math.cos(angle)]
  bridgePoints.push(next)
  // Rotating +Z about X by `angle` gives (0, -sin, cos), the segment direction.
  planks.push({ position: [x, (y + next[1]) / 2, (z + next[2]) / 2], angle })
}
const BRIDGE_END = bridgePoints[PLANKS]
const HINGE_AXIS: Triple = [1, 0, 0]

// Gallows between the spawn and the bridge; the chain hangs left of the path
// and the lamp right of it.
const GALLOWS: Triple = [0, 0, 4.6]
const BEAM_Y = 3.2
const CHAIN_PIVOT: Triple = [-0.45, BEAM_Y - 0.08, 0]
const LINKS = 8
const LINK = 0.3
const LAMP_PIVOT: Triple = [0.75, BEAM_Y - 0.08, 0]
const LAMP_ROPE = 1.9
const LAMP_TOP: Triple = [0, 0.12, 0]

const EXPECTED_BODIES = 2 + PLANKS + 1 + LINKS + 1
const EXPECTED_JOINTS = PLANKS + 1 + LINKS + 1

const add = (a: Triple, b: Triple): Triple => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]

// The part of Rapier's ImpulseJoint used here, shared by every joint kind.
type Joint = { setContactsEnabled(enabled: boolean): void }
type Registry = Set<Joint>

// Hooks cannot run in a loop, so each joint is its own null component. It must
// render after both bodies so their refs are set when the hook's effect runs.
function useRegister(joint: RefObject<Joint | undefined>, registry: Registry) {
  useEffect(() => {
    const created = joint.current
    if (!created) return
    // Jointed neighbours overlap at their pivots; let only the joint hold them.
    created.setContactsEnabled(false)
    registry.add(created)
    return () => { registry.delete(created) }
  }, [joint, registry])
}

function Hinge({ a, b, params, registry }: { a: BodyRef; b: BodyRef; params: RevoluteJointParams; registry: Registry }) {
  useRegister(useRevoluteJoint(a, b, params), registry)
  return null
}

function Ball({ a, b, params, registry }: { a: BodyRef; b: BodyRef; params: SphericalJointParams; registry: Registry }) {
  useRegister(useSphericalJoint(a, b, params), registry)
  return null
}

function Rope({ a, b, params, registry }: { a: BodyRef; b: BodyRef; params: RopeJointParams; registry: Registry }) {
  useRegister(useRopeJoint(a, b, params), registry)
  return null
}

const wood = '#8a6440'
const darkWood = '#5b3f28'
const steel = '#5d646c'

// Collider positions are body-local; nesting them in a transformed group is
// not how feel.tsx places them, so each part carries its own offset.
function Part({ position, size }: { position: Triple; size: Triple }) {
  return (
    <>
      <CuboidCollider position={position} args={[size[0] / 2, size[1] / 2, size[2] / 2]} />
      <mesh position={position} castShadow receiveShadow>
        <boxGeometry args={size} />
        <meshStandardMaterial color={darkWood} roughness={0.9} />
      </mesh>
    </>
  )
}

function BridgePost({ body, position, outward }: { body: BodyRef; position: Triple; outward: number }) {
  // Two side posts plus a crossbar set just outside the first plank's hinge.
  const parts: { position: Triple; size: Triple }[] = [
    { position: [-0.62, -0.1, 0], size: [0.1, 0.7, 0.1] },
    { position: [0.62, -0.1, 0], size: [0.1, 0.7, 0.1] },
    { position: [0, -0.12, 0.12 * outward], size: [1.24, 0.08, 0.1] },
  ]
  return (
    <RigidBody ref={body} type="fixed" position={position} colliders={false}>
      {parts.map(({ position, size }, index) => (
        <Part key={index} position={position} size={size} />
      ))}
    </RigidBody>
  )
}

function Bridge({ start, end, bodies, registry }: { start: BodyRef; end: BodyRef; bodies: BodyRef[]; registry: Registry }) {
  const half = PITCH / 2
  return (
    <>
      <BridgePost body={start} position={BRIDGE_START} outward={-1} />
      <BridgePost body={end} position={BRIDGE_END} outward={1} />
      {planks.map(({ position, angle }, index) => (
        <RigidBody
          key={index} ref={bodies[index]} position={position} rotation={[angle, 0, 0]}
          colliders={false} linearDamping={0.4} angularDamping={1}
        >
          <CuboidCollider args={[0.55, 0.04, 0.21]} mass={0.4} friction={0.9} />
          <mesh castShadow receiveShadow>
            <boxGeometry args={[1.1, 0.08, 0.42]} />
            <meshStandardMaterial color={index % 2 ? wood : '#977150'} roughness={0.85} />
          </mesh>
        </RigidBody>
      ))}
      <Hinge a={start} b={bodies[0]} params={[[0, 0, 0], [0, 0, -half], HINGE_AXIS]} registry={registry} />
      {bodies.slice(1).map((body, index) => (
        <Hinge key={index} a={bodies[index]} b={body} params={[[0, 0, half], [0, 0, -half], HINGE_AXIS]} registry={registry} />
      ))}
      <Hinge a={bodies[PLANKS - 1]} b={end} params={[[0, 0, half], [0, 0, 0], HINGE_AXIS]} registry={registry} />
    </>
  )
}

function Gallows({ body }: { body: BodyRef }) {
  const parts: { position: Triple; size: Triple }[] = [
    { position: [-1.4, BEAM_Y / 2, 0], size: [0.12, BEAM_Y + 0.06, 0.12] },
    { position: [1.4, BEAM_Y / 2, 0], size: [0.12, BEAM_Y + 0.06, 0.12] },
    { position: [0, BEAM_Y, 0], size: [3, 0.12, 0.12] },
  ]
  return (
    <RigidBody ref={body} type="fixed" position={GALLOWS} colliders={false}>
      {parts.map(({ position, size }, index) => (
        <Part key={index} position={position} size={size} />
      ))}
    </RigidBody>
  )
}

function Chain({ gallows, links, registry }: { gallows: BodyRef; links: BodyRef[]; registry: Registry }) {
  const top = add(GALLOWS, CHAIN_PIVOT)
  const half = LINK / 2
  return (
    <>
      {links.map((link, index) => (
        <RigidBody
          key={index} ref={link} position={[top[0], top[1] - (index + 0.5) * LINK, top[2]]}
          colliders={false} linearDamping={0.2} angularDamping={0.5}
        >
          <CapsuleCollider args={[0.08, 0.05]} mass={0.1} />
          {/* Alternate link planes so neighbours read as interlocked. */}
          <mesh castShadow rotation={[0, index % 2 ? Math.PI / 2 : 0, 0]} scale={[0.75, 1.45, 1]}>
            <torusGeometry args={[0.09, 0.022, 8, 20]} />
            <meshStandardMaterial color={steel} metalness={0.8} roughness={0.35} />
          </mesh>
        </RigidBody>
      ))}
      <Ball a={gallows} b={links[0]} params={[CHAIN_PIVOT, [0, half, 0]]} registry={registry} />
      {links.slice(1).map((link, index) => (
        <Ball key={index} a={links[index]} b={link} params={[[0, -half, 0], [0, half, 0]]} registry={registry} />
      ))}
    </>
  )
}

function Lamp({ gallows, lamp, registry }: { gallows: BodyRef; lamp: BodyRef; registry: Registry }) {
  const rope = useRef<Mesh>(null)
  const pivot = add(GALLOWS, LAMP_PIVOT)
  const scratch = useMemo(() => ({
    top: new Vector3(), pivot: new Vector3(...pivot), direction: new Vector3(),
    rotation: new Quaternion(), up: new Vector3(0, 1, 0),
  }), [pivot[0], pivot[1], pivot[2]])

  // Stretch a thin cylinder from the gallows pivot to the lamp's hook.
  useFrame(() => {
    const body = lamp.current
    const mesh = rope.current
    if (!body || !mesh) return
    const { top, direction, rotation, up } = scratch
    top.set(...LAMP_TOP).applyQuaternion(rotation.copy(body.rotation())).add(body.translation())
    direction.subVectors(top, scratch.pivot)
    const length = direction.length()
    mesh.position.copy(scratch.pivot).addScaledVector(direction, 0.5)
    mesh.quaternion.setFromUnitVectors(up, direction.divideScalar(length || 1))
    mesh.scale.set(1, length, 1)
  })

  return (
    <>
      <mesh ref={rope} castShadow>
        <cylinderGeometry args={[0.012, 0.012, 1, 6]} />
        <meshStandardMaterial color="#2d2a26" roughness={0.9} />
      </mesh>
      <RigidBody
        ref={lamp} position={[pivot[0], pivot[1] - LAMP_ROPE - LAMP_TOP[1], pivot[2]]}
        colliders={false} linearDamping={0.1} angularDamping={0.3}
      >
        <BallCollider args={[0.2]} mass={0.4} />
        <mesh castShadow position={[0, 0.04, 0]}>
          <coneGeometry args={[0.22, 0.2, 24, 1, true]} />
          <meshStandardMaterial color="#2f4a3a" metalness={0.6} roughness={0.4} side={DoubleSide} />
        </mesh>
        <mesh position={[0, -0.07, 0]}>
          <sphereGeometry args={[0.08, 16, 12]} />
          <meshStandardMaterial color="#ffe2a8" emissive="#ffc46b" emissiveIntensity={6} />
        </mesh>
        <pointLight position={[0, -0.12, 0]} color="#ffc46b" intensity={4} distance={6} />
      </RigidBody>
      <Rope a={gallows} b={lamp} params={[LAMP_PIVOT, LAMP_TOP, LAMP_ROPE]} registry={registry} />
    </>
  )
}

function Joints() {
  const refs = useMemo(() => ({
    bridgeStart: bodyRef(),
    bridgeEnd: bodyRef(),
    planks: Array.from({ length: PLANKS }, bodyRef),
    gallows: bodyRef(),
    links: Array.from({ length: LINKS }, bodyRef),
    lamp: bodyRef(),
  }), [])
  const registry = useMemo<Registry>(() => new Set(), [])
  const published = useRef(false)

  const push = useMemo(() => (strength: number) => {
    const impulse = (body: BodyRef, x: number, y: number, z: number) => {
      body.current?.applyImpulse({ x: x * strength, y: y * strength, z: z * strength }, true)
    }
    impulse(refs.links[LINKS - 1], 0.25, 0, 0.12)
    impulse(refs.lamp, -0.5, 0, 0.4)
    impulse(refs.planks[PLANKS / 2], 0, 0.5, 0)
  }, [refs])

  useControls('Joints', { 'push everything': button(() => push(1)) })

  // initLab clears info after child effects, so publish from a frame once
  // every joint exists; the same frame gives the capture its first swing.
  useFrame(() => {
    if (published.current) return
    const all = [refs.bridgeStart, refs.bridgeEnd, ...refs.planks, refs.gallows, ...refs.links, refs.lamp]
    const bodies = all.filter((body) => body.current).length
    const joints = registry.size
    const ready = bodies === EXPECTED_BODIES && joints === EXPECTED_JOINTS
    setInfo('joints', { ready, bodies, joints })
    if (!ready) return
    push(1)
    published.current = true
  })

  return (
    <>
      <Bridge start={refs.bridgeStart} end={refs.bridgeEnd} bodies={refs.planks} registry={registry} />
      <Gallows body={refs.gallows} />
      <Chain gallows={refs.gallows} links={refs.links} registry={registry} />
      <Lamp gallows={refs.gallows} lamp={refs.lamp} registry={registry} />
    </>
  )
}

// feel's default follow camera sits low behind the course box, which hides the
// Fox and shrinks the props. Raise and pull it in so the view looks down over
// the box at the Fox, gallows and bridge.
const CAMERA = { distance: 5, height: 8, lookAt: 1.5 }

export default function Ropes() {
  return (
    <FeelContent>
      <Joints />
      <CameraPreset {...CAMERA} />
    </FeelContent>
  )
}
