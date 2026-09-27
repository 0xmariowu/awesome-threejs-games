import { mountLabLegend } from '../embed'
import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { KeyboardControls } from '@react-three/drei'
import { CuboidCollider, Physics, RigidBody } from '@react-three/rapier'
import { useControls } from 'leva'
import { ConeGeometry, type Mesh } from 'three'
import {
  EntityManager, FleeBehavior, PursuitBehavior, SeparationBehavior, SteeringBehavior, Vehicle,
  WanderBehavior, type GameEntity, type Vector3 as YukaVector3,
} from 'yuka'
import { setInfo } from '../lab'
import { CameraPreset, keyboardMap, Player } from './feel'

// Yuka 0.7.8 steering around feel's ecctrl Fox, following the upstream
// examples/steering/{wander,flee,pursuit}: each Vehicle drives a mesh through
// setRenderComponent(mesh, sync), which copies entity.worldMatrix into a mesh
// with matrixAutoUpdate off. R3F's frame delta replaces yuka's Time.update().
// Like shallow.tsx, the feel course is not reused: its props would sit in the
// agents' way, and the agents are not physics bodies.

// A high follow camera so the pen around the Fox stays in view.
const CAMERA = { distance: 9, height: 13, lookAt: 0 }

type Role = 'wander' | 'flee' | 'pursue'
const ROLES: Record<Role, { color: string; label: string }> = {
  wander: { color: '#3fbf5a', label: '绿=闲逛' },
  flee: { color: '#3a7bff', label: '蓝=躲你' },
  pursue: { color: '#e5484d', label: '红=追你' },
}

// Agents move on this plane; the cone's 0.25 m radius clears the ground.
const AGENT_Y = 0.3
// The pen around the Fox's spawn at (0, 3), sized to the follow camera's view.
const BOUNDS = { minX: -9, maxX: 9, minZ: -4, maxZ: 12 }
const MARGIN = 2
// Flee agents react inside this radius, as FleeBehavior's panicDistance.
const PANIC = 5

// Flee agents start close to the Fox and pursuers far away, so both behaviours
// show in the first seconds. [role, x, z, heading in radians]
const SPAWN: [Role, number, number, number][] = [
  ['wander', -6, 9, 0.5], ['wander', 6, 9, 2.5], ['wander', -6, -1, 4], ['wander', 6, -1, 5.5],
  ['flee', 1.5, 4.5, 0.8], ['flee', -1.5, 4.5, 5.5], ['flee', 1.5, 1.5, 2.4], ['flee', -1.5, 1.5, 3.9],
  ['pursue', -8, 11, 2], ['pursue', 8, 11, 4.3], ['pursue', -8, -3, 0.8], ['pursue', 8, -3, 5.5],
]

// Steers a vehicle back toward the pen once it is within MARGIN of an edge.
class StayInBounds extends SteeringBehavior {
  calculate(vehicle: Vehicle, force: YukaVector3) {
    const push = (value: number, min: number, max: number) =>
      value < min + MARGIN ? min + MARGIN - value : value > max - MARGIN ? max - MARGIN - value : 0
    force.x = push(vehicle.position.x, BOUNDS.minX, BOUNDS.maxX) * vehicle.maxSpeed
    force.z = push(vehicle.position.z, BOUNDS.minZ, BOUNDS.maxZ) * vehicle.maxSpeed
    return force
  }
}

// Upstream's sync, plus a hard clamp for the rare frame where steering overshoots.
function sync(entity: GameEntity, mesh: Mesh) {
  const { position } = entity
  position.x = Math.min(BOUNDS.maxX, Math.max(BOUNDS.minX, position.x))
  position.z = Math.min(BOUNDS.maxZ, Math.max(BOUNDS.minZ, position.z))
  position.y = AGENT_Y
  mesh.matrix.fromArray(entity.worldMatrix.elements)
}

// Player publishes the ecctrl rigid body's translation here every frame (-1).
function readPlayer(): { x: number; z: number } | null {
  const player = window.__LAB__?.info.player
  if (!player || typeof player !== 'object') return null
  const { x, z } = player as Record<string, unknown>
  if (typeof x !== 'number' || typeof z !== 'number' || !Number.isFinite(x) || !Number.isFinite(z)) return null
  return { x, z }
}

function createAgents() {
  const manager = new EntityManager()
  // Stand-in for the Fox: flee and pursuit targets, and a separation neighbour
  // so pursuers ring the Fox instead of stacking on it. Added first, so the
  // manager's reverse-order update moves it last and agents see its copied position.
  const fox = new Vehicle()
  fox.maxSpeed = 20
  fox.position.set(0, AGENT_Y, 3)
  manager.add(fox)

  const wanders: WanderBehavior[] = []
  const agents = SPAWN.map(([role, x, z, heading]) => {
    const vehicle = new Vehicle()
    vehicle.position.set(x, AGENT_Y, z)
    vehicle.rotation.fromEuler(0, heading, 0)
    vehicle.updateNeighborhood = true
    vehicle.neighborhoodRadius = 1.5
    if (role === 'pursue') {
      vehicle.steering.add(new PursuitBehavior(fox, 1))
    } else {
      if (role === 'flee') vehicle.steering.add(new FleeBehavior(fox.position, PANIC))
      const wander = new WanderBehavior()
      // Flee agents drift slowly once the Fox is outside their panic radius.
      if (role === 'flee') wander.weight = 0.3
      wanders.push(wander)
      vehicle.steering.add(wander)
    }
    const separation = new SeparationBehavior()
    separation.weight = 1.5
    vehicle.steering.add(separation)
    const bounds = new StayInBounds()
    bounds.weight = 3
    vehicle.steering.add(bounds)
    manager.add(vehicle)
    return { role, vehicle }
  })
  return { manager, fox, agents, wanders }
}

function averageDistance(agents: { role: Role; vehicle: Vehicle }[], role: Role, fox: Vehicle) {
  const group = agents.filter((agent) => agent.role === role)
  const total = group.reduce((sum, agent) => sum + agent.vehicle.position.distanceTo(fox.position), 0)
  return Math.round(total / group.length * 100) / 100
}

function Agents() {
  const world = useMemo(createAgents, [])
  const cone = useMemo(() => new ConeGeometry(0.25, 0.8, 12).rotateX(Math.PI / 2), [])
  useEffect(() => () => {
    cone.dispose()
    world.manager.clear()
  }, [cone, world])

  const { maxSpeed, wanderRadius } = useControls('NPC', {
    maxSpeed: { value: 3, min: 0.5, max: 8, step: 0.1, label: 'Max speed' },
    wanderRadius: { value: 1, min: 0.1, max: 5, step: 0.1, label: 'Wander radius' },
  })
  useEffect(() => {
    for (const { vehicle } of world.agents) vehicle.maxSpeed = maxSpeed
    for (const wander of world.wanders) wander.radius = wanderRadius
  }, [world, maxSpeed, wanderRadius])

  // Bottom-left, clear of the lab overlay and menu (top-left) and the panel (top-right).
  useEffect(() => {
    const legend = document.createElement('div')
    Object.assign(legend.style, {
      position: 'fixed', left: '12px', bottom: '12px', zIndex: '1', padding: '8px 12px',
      color: '#fff', background: 'rgba(0, 0, 0, 0.75)', borderRadius: '6px',
      fontFamily: 'sans-serif', fontSize: '14px', lineHeight: '1.6', pointerEvents: 'none',
    })
    for (const { color, label } of Object.values(ROLES)) {
      const row = document.createElement('div')
      const swatch = document.createElement('span')
      Object.assign(swatch.style, {
        display: 'inline-block', width: '12px', height: '12px', marginRight: '8px',
        borderRadius: '2px', background: color, verticalAlign: '-1px',
      })
      row.append(swatch, label)
      legend.append(row)
    }
    return mountLabLegend(legend)
  }, [])

  const last = useMemo(() => ({ x: 0, z: 0, valid: false }), [])
  // Latches once the steering is visibly running: pursuers always head for the
  // Fox, so they move even when no key is held and the Fox stands still.
  const check = useMemo(() => ({ frames: 0, behaving: false }), [])
  useFrame((_, delta) => {
    const { manager, fox, agents } = world
    const player = readPlayer()
    if (player) {
      // Pursuit predicts from the evader's velocity, so derive it from the body's motion.
      if (last.valid && delta > 0) fox.velocity.set((player.x - last.x) / delta, 0, (player.z - last.z) / delta)
      fox.position.set(player.x, AGENT_Y, player.z)
      Object.assign(last, { x: player.x, z: player.z, valid: true })
    }
    // Clamp long frames (tab switches) the way yuka's Time does with visibility.
    manager.update(Math.min(delta, 0.05))
    check.frames++
    if (!check.behaving && check.frames >= 60) {
      const finite = agents.every(({ vehicle: { position } }) =>
        Number.isFinite(position.x) && Number.isFinite(position.y) && Number.isFinite(position.z))
      const pursuers = agents.filter((agent) => agent.role === 'pursue')
      const speed = pursuers.reduce((sum, agent) => sum + agent.vehicle.getSpeed(), 0) / pursuers.length
      check.behaving = finite && speed > 0.1
    }
    // Published every frame: initLab clears info after child effects mount.
    setInfo('npc', {
      agents: agents.length, wander: 4, flee: 4, pursue: 4,
      fleeDist: averageDistance(agents, 'flee', fox),
      pursueDist: averageDistance(agents, 'pursue', fox),
      behaving: check.behaving,
    })
  })

  return (
    <>
      {world.agents.map(({ role, vehicle }, index) => (
        <mesh
          key={index}
          geometry={cone}
          matrixAutoUpdate={false}
          castShadow
          ref={(mesh) => {
            if (!mesh) return
            vehicle.setRenderComponent(mesh, sync)
            // Place the mesh before the first manager update.
            sync(vehicle, mesh)
          }}
        >
          <meshStandardMaterial color={ROLES[role].color} roughness={0.6} />
        </mesh>
      ))}
    </>
  )
}

function Ground() {
  const width = BOUNDS.maxX - BOUNDS.minX
  const depth = BOUNDS.maxZ - BOUNDS.minZ
  const center: [number, number, number] = [(BOUNDS.minX + BOUNDS.maxX) / 2, 0, (BOUNDS.minZ + BOUNDS.maxZ) / 2]
  return (
    <>
      <color attach="background" args={['#9fc3d9']} />
      <hemisphereLight args={['#ffffff', '#5b6b4a', 1.2]} />
      <directionalLight
        position={[-5, 12, -2]}
        intensity={2.5}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-14}
        shadow-camera-right={14}
        shadow-camera-top={14}
        shadow-camera-bottom={-14}
        shadow-camera-near={0.5}
        shadow-camera-far={40}
        shadow-normalBias={0.02}
      />
      <RigidBody type="fixed" colliders={false}>
        {/* Cuboid arguments are half extents; the top is exactly y=0. */}
        <CuboidCollider position={[0, -0.25, 0]} args={[20, 0.25, 20]} friction={0.8} />
      </RigidBody>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[40, 40]} />
        <meshStandardMaterial color="#8a9a6a" roughness={1} />
      </mesh>
      {/* The pen the agents stay in. */}
      <mesh position={[center[0], 0.01, center[2]]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial color="#c9b98f" roughness={1} />
      </mesh>
    </>
  )
}

export default function Npc() {
  return (
    <Physics>
      <Ground />
      <KeyboardControls map={keyboardMap}>
        <Player />
        <CameraPreset {...CAMERA} />
      </KeyboardControls>
      <Agents />
    </Physics>
  )
}
