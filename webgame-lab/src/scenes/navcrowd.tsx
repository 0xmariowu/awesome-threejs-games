import { mountLabLegend } from '../embed'
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { button, folder, useControls } from 'leva'
import {
  BoxGeometry, CapsuleGeometry, Color, InstancedMesh, Mesh, MeshStandardMaterial, Object3D, PlaneGeometry,
  type PerspectiveCamera,
} from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import {
  createFindNearestPolyResult, DEFAULT_QUERY_FILTER, findNearestPoly, findRandomPoint, type NavMesh, type Vec3,
} from 'navcat'
import { crowd, generateSoloNavMesh, type SoloNavMeshOptions } from 'navcat/blocks'
import { createNavMeshHelper, getPositionsAndIndices } from 'navcat/three'
import { setInfo } from '../lab'

// navcat 0.4.1 crowd, following upstream examples/src/example-crowd-simulation.ts:
// getPositionsAndIndices over the level meshes, a navmesh from the blocks
// generator (solo here, tiled upstream), crowd.create/addAgent/requestMoveTarget,
// and crowd.update with a clamped delta. The town is built as plain three
// meshes in useMemo so the navmesh exists before the first frame.

const AGENT_COUNT = 30
const AGENT_RADIUS = 0.3
const AGENT_HEIGHT = 1.2
// The walkable ground; box tops above this are roofs and never used as targets.
const MAX_STREET_Y = 0.5
// Agents sent by a click keep the clicked point this long, then wander again.
const HOLD_SECONDS = 8
// An agent whose target stays out of reach this long picks a new one.
const GIVE_UP_SECONDS = 25

const HUES = ['#e5484d', '#3a7bff', '#f5a524', '#2fb67c']

// [x, z, width, depth, height, colour]; the plaza around the origin stays open.
const HOUSES: [number, number, number, number, number, string][] = [
  [-8, -8.5, 6, 5, 3, '#e8d5b7'],
  [8, -8.5, 6, 5, 2.6, '#f2c6a0'],
  [-8, 8.5, 6, 5, 2.8, '#c9d6c2'],
  [8, 8.5, 6, 5, 3.4, '#e6b8a2'],
  [-9.5, 0, 3, 5, 2.4, '#d4c4e0'],
  [9.5, 0, 3, 5, 2.6, '#e8d5b7'],
  [-3.2, -10.5, 2.6, 3, 2.4, '#f2c6a0'],
  [3.5, 10.5, 3, 3, 2.4, '#c9d6c2'],
]

// Outer wall at ±14 with gates on the north and south sides (|x| < 1.5), plus
// two low inner walls that split the streets. [x, z, width, depth, height]
const WALLS: [number, number, number, number, number][] = [
  [-7.875, -14, 12.75, 0.5, 1.8], [7.875, -14, 12.75, 0.5, 1.8],
  [-7.875, 14, 12.75, 0.5, 1.8], [7.875, 14, 12.75, 0.5, 1.8],
  [-14, 0, 0.5, 28.5, 1.8], [14, 0, 0.5, 28.5, 1.8],
  [4, 4.5, 4, 0.4, 1.2], [-5, -2, 0.4, 4, 1.2],
]

// Mulberry32, as upstream's seeded createMulberry32Generator, so captures repeat.
function seeded(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Same defaults as the README's navcat/three snippet, with a 0.3 m agent radius
// and a 2 m clearance so the ground under every box is carved out.
function navMeshOptions(): SoloNavMeshOptions {
  const cellSize = 0.15
  const cellHeight = 0.15
  const walkableRadiusWorld = AGENT_RADIUS
  const walkableClimbWorld = 0.5
  const walkableHeightWorld = 2
  const detailSampleDistanceVoxels = 6
  return {
    cellSize,
    cellHeight,
    walkableRadiusWorld,
    walkableRadiusVoxels: Math.ceil(walkableRadiusWorld / cellSize),
    walkableClimbWorld,
    walkableClimbVoxels: Math.ceil(walkableClimbWorld / cellHeight),
    walkableHeightWorld,
    walkableHeightVoxels: Math.ceil(walkableHeightWorld / cellHeight),
    walkableSlopeAngleDegrees: 45,
    borderSize: 0,
    minRegionArea: 8,
    mergeRegionArea: 20,
    maxSimplificationError: 1.3,
    maxEdgeLength: 12,
    maxVerticesPerPoly: 5,
    detailSampleDistance: cellSize * detailSampleDistanceVoxels,
    detailSampleMaxError: cellHeight,
  }
}

function box(x: number, z: number, width: number, depth: number, height: number, material: MeshStandardMaterial) {
  const mesh = new Mesh(new BoxGeometry(width, height, depth), material)
  mesh.position.set(x, height / 2, z)
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}

function buildTown() {
  const materials: MeshStandardMaterial[] = []
  const material = (color: string) => {
    const made = new MeshStandardMaterial({ color, roughness: 0.85 })
    materials.push(made)
    return made
  }
  const ground = new Mesh(new PlaneGeometry(32, 32), material('#d8c7a0'))
  ground.rotation.x = -Math.PI / 2
  ground.receiveShadow = true
  const wallMaterial = material('#9c8f7e')
  const walls = WALLS.map(([x, z, w, d, h]) => box(x, z, w, d, h, wallMaterial))
  const houses = HOUSES.map(([x, z, w, d, h, color]) => box(x, z, w, d, h, material(color)))
  // Darker roof slabs, left out of the navmesh input like upstream's decorative props.
  const roofMaterial = material('#8a4b3c')
  const roofs = HOUSES.map(([x, z, w, d, h]) => {
    const roof = box(x, z, w + 0.3, d + 0.3, 0.25, roofMaterial)
    roof.position.y = h + 0.125
    return roof
  })
  return { ground, obstacles: [...walls, ...houses], roofs, materials }
}

function randomStreetPoint(navMesh: NavMesh, random: () => number) {
  for (let attempt = 0; attempt < 20; attempt++) {
    const result = findRandomPoint(navMesh, DEFAULT_QUERY_FILTER, random)
    if (result.success && result.position[1] < MAX_STREET_Y) return result
  }
  return null
}

type Mode = { heldUntil: number; since: number }

function Town() {
  const { camera, gl } = useThree()

  const world = useMemo(() => {
    const town = buildTown()
    const [positions, indices] = getPositionsAndIndices([town.ground, ...town.obstacles])
    const { navMesh } = generateSoloNavMesh({ positions, indices }, navMeshOptions())
    const helper = createNavMeshHelper(navMesh)
    helper.object.position.y = 0.02

    const random = seeded(42)
    const agents = crowd.create(AGENT_RADIUS)
    const params: crowd.AgentParams = {
      radius: AGENT_RADIUS,
      height: AGENT_HEIGHT,
      maxAcceleration: 15,
      maxSpeed: 2.5,
      collisionQueryRange: 2,
      separationWeight: 0.5,
      updateFlags:
        crowd.CrowdUpdateFlags.ANTICIPATE_TURNS |
        crowd.CrowdUpdateFlags.SEPARATION |
        crowd.CrowdUpdateFlags.OBSTACLE_AVOIDANCE |
        crowd.CrowdUpdateFlags.OPTIMIZE_TOPO |
        crowd.CrowdUpdateFlags.OPTIMIZE_VIS,
      queryFilter: DEFAULT_QUERY_FILTER,
      obstacleAvoidance: crowd.DEFAULT_OBSTACLE_AVOIDANCE_PARAMS,
    }
    const ids: string[] = []
    for (let i = 0; i < AGENT_COUNT; i++) {
      const start = randomStreetPoint(navMesh, random)
      if (!start) continue
      ids.push(crowd.addAgent(agents, navMesh, start.position, params))
    }
    const modes = new Map<string, Mode>(ids.map((id) => [id, { heldUntil: 0, since: 0 }]))
    return { town, navMesh, helper, agents, ids, modes, random }
  }, [])

  const capsule = useMemo(() => new CapsuleGeometry(AGENT_RADIUS, AGENT_HEIGHT - AGENT_RADIUS * 2, 4, 12), [])
  const agentMaterial = useMemo(() => new MeshStandardMaterial({ roughness: 0.6 }), [])
  const instances = useRef<InstancedMesh>(null)
  const clock = useRef(0)

  useEffect(() => () => {
    world.helper.dispose()
    for (const mesh of [world.town.ground, ...world.town.obstacles, ...world.town.roofs]) mesh.geometry.dispose()
    for (const made of world.town.materials) made.dispose()
    capsule.dispose()
    agentMaterial.dispose()
  }, [world, capsule, agentMaterial])

  const retarget = (id: string) => {
    const target = randomStreetPoint(world.navMesh, world.random)
    if (!target) return
    crowd.requestMoveTarget(world.agents, id, target.nodeRef, target.position)
    world.modes.get(id)!.since = clock.current
  }

  // Sends agents to a point; the crowd's separation and avoidance spread them around it.
  const sendTo = (point: Vec3, ids: string[]) => {
    const nearest = findNearestPoly(createFindNearestPolyResult(), world.navMesh, point, [2, 1, 2], DEFAULT_QUERY_FILTER)
    if (!nearest.success) return
    for (const id of ids) {
      crowd.requestMoveTarget(world.agents, id, nearest.nodeRef, nearest.position)
      const mode = world.modes.get(id)!
      mode.heldUntil = clock.current + HOLD_SECONDS
      mode.since = clock.current
    }
  }
  const sendRef = useRef(sendTo)
  sendRef.current = sendTo

  const { maxSpeed, showNavMesh } = useControls({
    Crowd: folder({
      maxSpeed: { value: 2.5, min: 0.5, max: 6, step: 0.1, label: 'Max speed' },
      showNavMesh: { value: false, label: 'Show navmesh' },
      'Send all to centre': button(() => sendRef.current([0, 0, 0], world.ids)),
    }),
  })
  useEffect(() => {
    for (const id of world.ids) world.agents.agents[id].maxSpeed = maxSpeed
  }, [world, maxSpeed])

  // Scripted targets: every agent sets off on load.
  useEffect(() => {
    // retarget only reads world and the clock ref.
    for (const id of world.ids) retarget(id)
  }, [world])

  useEffect(() => {
    const mesh = instances.current
    if (!mesh) return
    const color = new Color()
    world.ids.forEach((_, index) => mesh.setColorAt(index, color.set(HUES[index % HUES.length])))
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }, [world])

  useLayoutEffect(() => {
    const perspective = camera as PerspectiveCamera
    const previous = {
      position: perspective.position.clone(),
      quaternion: perspective.quaternion.clone(),
      fov: perspective.fov,
    }
    // A high overview that frames the whole walled town.
    perspective.fov = 45
    perspective.position.set(0, 34, 24)
    perspective.updateProjectionMatrix()

    const controls = new OrbitControls(perspective, gl.domElement)
    controls.target.set(0, 0, 1)
    controls.minDistance = 8
    controls.maxDistance = 80
    controls.maxPolarAngle = Math.PI / 2 - 0.05
    controls.update()

    return () => {
      controls.dispose()
      perspective.position.copy(previous.position)
      perspective.quaternion.copy(previous.quaternion)
      perspective.fov = previous.fov
      perspective.updateProjectionMatrix()
    }
  }, [camera, gl])

  // Bottom-left, clear of the lab overlay and menu (top-left) and the panel (top-right).
  useEffect(() => {
    const legend = document.createElement('div')
    Object.assign(legend.style, {
      position: 'fixed', left: '12px', bottom: '12px', zIndex: '1', padding: '8px 12px',
      color: '#fff', background: 'rgba(0, 0, 0, 0.75)', borderRadius: '6px',
      fontFamily: 'sans-serif', fontSize: '14px', lineHeight: '1.6', pointerEvents: 'none',
    })
    for (const line of ['30 人各自在小镇里找路', '点地面：最近的一半人走过去', '面板按钮：全部走到广场']) {
      const row = document.createElement('div')
      row.textContent = line
      legend.append(row)
    }
    return mountLabLegend(legend)
  }, [])

  const onClick = (event: ThreeEvent<MouseEvent>) => {
    // Orbit drags end in a click too; only a still pointer sends agents.
    if (event.delta > 2) return
    const { x, y, z } = event.point
    const byDistance = world.ids
      .map((id) => {
        const [ax, , az] = world.agents.agents[id].position
        return { id, distance: (ax - x) ** 2 + (az - z) ** 2 }
      })
      .sort((a, b) => a.distance - b.distance)
    sendRef.current([x, y, z], byDistance.slice(0, Math.ceil(byDistance.length / 2)).map(({ id }) => id))
  }

  const dummy = useMemo(() => new Object3D(), [])
  useFrame((_, delta) => {
    const step = Math.min(delta, 0.1)
    clock.current += step
    crowd.update(world.agents, world.navMesh, step)

    let moving = 0
    const mesh = instances.current
    world.ids.forEach((id, index) => {
      const agent = world.agents.agents[id]
      const mode = world.modes.get(id)!
      const [vx, , vz] = agent.velocity
      const speed = Math.hypot(vx, vz)
      if (speed > 0.1) moving++

      const held = clock.current < mode.heldUntil
      const failed = agent.targetState === crowd.AgentTargetState.FAILED
        || agent.targetState === crowd.AgentTargetState.NONE
      const arrived = crowd.isAgentAtTarget(world.agents, id, 1)
      if (!held && (failed || arrived || clock.current - mode.since > GIVE_UP_SECONDS)) retarget(id)

      if (mesh) {
        const [px, py, pz] = agent.position
        dummy.position.set(px, py + AGENT_HEIGHT / 2, pz)
        if (speed > 0.1) dummy.rotation.y = Math.atan2(vx, vz)
        dummy.updateMatrix()
        mesh.setMatrixAt(index, dummy.matrix)
      }
    })
    if (mesh) mesh.instanceMatrix.needsUpdate = true

    // Published every frame: initLab clears info after child effects mount.
    setInfo('crowd', { agents: world.ids.length, navmesh: true, moving })
  })

  return (
    <>
      <primitive object={world.town.ground} onClick={onClick} />
      {world.town.obstacles.map((mesh) => <primitive key={mesh.uuid} object={mesh} />)}
      {world.town.roofs.map((mesh) => <primitive key={mesh.uuid} object={mesh} />)}
      <primitive object={world.helper.object} visible={showNavMesh} />
      <instancedMesh
        ref={instances}
        args={[capsule, agentMaterial, world.ids.length]}
        castShadow
        frustumCulled={false}
      />
    </>
  )
}

export default function NavCrowd() {
  return (
    <>
      <color attach="background" args={['#b9d3e3']} />
      <fog attach="fog" args={['#b9d3e3', 50, 110]} />
      <hemisphereLight args={['#ffffff', '#6f7a5a', 1.2]} />
      <directionalLight
        position={[-12, 22, 10]}
        intensity={2.8}
        color="#fff4e2"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
        shadow-camera-near={0.5}
        shadow-camera-far={60}
        shadow-normalBias={0.02}
      />
      {/* Grass outside the paved town; not part of the navmesh. */}
      <mesh rotation-x={-Math.PI / 2} position-y={-0.02} receiveShadow>
        <planeGeometry args={[120, 120]} />
        <meshStandardMaterial color="#8e9a78" roughness={0.95} />
      </mesh>
      <Town />
    </>
  )
}
