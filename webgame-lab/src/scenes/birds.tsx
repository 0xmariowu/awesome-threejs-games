import { useEffect, useLayoutEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useControls } from 'leva'
import {
  BufferAttribute, BufferGeometry, DoubleSide, InstancedMesh, NodeMaterial, Raycaster, Vector2, Vector3,
  type PerspectiveCamera, type Scene, type WebGPURenderer,
} from 'three/webgpu'
import {
  Continue, Fn, If, Loop, cameraProjectionMatrix, cameraViewMatrix, cos, dot, float, instanceIndex,
  instancedArray, length, mat3, max, modelWorldMatrix, negate, normalize, positionLocal, sin, sqrt,
  uint, uniform, vec4, vertexIndex,
} from 'three/tsl'
import { setInfo } from '../lab'
import { describeRenderer } from '../renderer'
import { LookContent } from './look'

// Port of three.js r186 examples/webgpu_compute_birds.html: the GPU boids
// (separation, alignment, cohesion, centre pull and the pointer ray as the
// predator) in two compute shaders, drawn by the example's 3-triangle bird
// with its flapping, velocity-aligned vertex shader. The example's own sky
// sphere and fog are replaced by the look set; no assets.
const BIRDS = 8192
const SPEED_LIMIT = 9.0
const BOUNDS = 800, BOUNDS_HALF = BOUNDS / 2

// The simulation runs in the example's units (an 800-unit box). This maps it
// onto look's 40 m ground: 1 unit = 2.5 cm, flock centred 10 m up.
const FLOCK_SCALE = 0.025
const FLOCK_ORIGIN = new Vector3(0, 10, 0)

// Custom Geometry - using 3 triangles each. No normals currently.
function createBirdGeometry() {
  const geometry = new BufferGeometry()
  const points = 3 * 3
  const vertices = new BufferAttribute(new Float32Array(points * 3), 3)
  geometry.setAttribute('position', vertices)

  let v = 0
  const vertsPush = (...values: number[]) => {
    for (const value of values) vertices.array[v++] = value
  }

  const wingsSpan = 20

  // Body
  vertsPush(
    0, 0, -20,
    0, -8, 10,
    0, 0, 30,
  )

  // Left Wing
  vertsPush(
    0, 0, -15,
    -wingsSpan, 0, 5,
    0, 0, 15,
  )

  // Right Wing
  vertsPush(
    0, 0, 15,
    wingsSpan, 0, 5,
    0, 0, -15,
  )

  geometry.scale(0.2, 0.2, 0.2)
  return geometry
}

// The example's init() and render(), scoped to one mount so the storage
// buffers, compute nodes and mesh are rebuilt and freed with the scene.
function createBirds(renderer: WebGPURenderer, scene: Scene) {
  // Initialize position, velocity, and phase values
  const positionArray = new Float32Array(BIRDS * 3)
  const velocityArray = new Float32Array(BIRDS * 3)
  const phaseArray = new Float32Array(BIRDS)

  for (let i = 0; i < BIRDS; i++) {
    positionArray[i * 3 + 0] = Math.random() * BOUNDS - BOUNDS_HALF
    positionArray[i * 3 + 1] = Math.random() * BOUNDS - BOUNDS_HALF
    positionArray[i * 3 + 2] = Math.random() * BOUNDS - BOUNDS_HALF

    velocityArray[i * 3 + 0] = (Math.random() - 0.5) * 10
    velocityArray[i * 3 + 1] = (Math.random() - 0.5) * 10
    velocityArray[i * 3 + 2] = (Math.random() - 0.5) * 10

    phaseArray[i] = 1
  }

  const positionStorage = instancedArray(positionArray, 'vec3').setName('positionStorage')
  const velocityStorage = instancedArray(velocityArray, 'vec3').setName('velocityStorage')
  const phaseStorage = instancedArray(phaseArray, 'float').setName('phaseStorage')

  // setPBO(true) only matters for the WebGL fallback
  positionStorage.setPBO(true)
  velocityStorage.setPBO(true)
  phaseStorage.setPBO(true)

  // Uniforms are shared by the compute and vertex shaders. speedLimit is the
  // example's SPEED_LIMIT const, made a uniform so Leva can drive it.
  const effectController = {
    separation: uniform(15.0).setName('separation'),
    alignment: uniform(20.0).setName('alignment'),
    cohesion: uniform(20.0).setName('cohesion'),
    speedLimit: uniform(SPEED_LIMIT).setName('speedLimit'),
    deltaTime: uniform(0.0).setName('deltaTime'),
    rayOrigin: uniform(new Vector3()).setName('rayOrigin'),
    rayDirection: uniform(new Vector3()).setName('rayDirection'),
  }
  const flockOrigin = uniform(FLOCK_ORIGIN.clone()).setName('flockOrigin')
  const flockScale = uniform(FLOCK_SCALE).setName('flockScale')

  // Create geometry

  const birdGeometry = createBirdGeometry()
  const birdMaterial = new NodeMaterial()

  // Animate bird mesh within vertex shader, then apply position offset to vertices.
  const birdVertexTSL = Fn(() => {
    const position = positionLocal.toVar()
    const newPhase = phaseStorage.element(instanceIndex).toVar()
    const newVelocity = normalize(velocityStorage.element(instanceIndex)).toVar()

    If(vertexIndex.equal(4).or(vertexIndex.equal(7)), () => {
      // flap wings
      position.y = sin(newPhase).mul(5.0)
    })

    const newPosition = modelWorldMatrix.mul(position)

    newVelocity.z.mulAssign(-1.0)
    const xz = length(newVelocity.xz)
    const xyz = float(1.0)
    const x = sqrt((newVelocity.y.mul(newVelocity.y)).oneMinus())

    const cosry = newVelocity.x.div(xz).toVar()
    const sinry = newVelocity.z.div(xz).toVar()

    const cosrz = x.div(xyz)
    const sinrz = newVelocity.y.div(xyz).toVar()

    // Nodes must be negated with negate(). Using '-', their values will resolve to NaN.
    const maty = mat3(
      cosry, 0, negate(sinry),
      0, 1, 0,
      sinry, 0, cosry,
    )

    const matz = mat3(
      cosrz, sinrz, 0,
      negate(sinrz), cosrz, 0,
      0, 0, 1,
    )

    const finalVert = maty.mul(matz).mul(newPosition)
    finalVert.addAssign(positionStorage.element(instanceIndex))

    // Lab addition: place the example's flock space over the look ground.
    const worldVert = flockOrigin.add(finalVert.xyz.mul(flockScale))

    return cameraProjectionMatrix.mul(cameraViewMatrix).mul(vec4(worldVert, 1.0))
  })

  birdMaterial.vertexNode = birdVertexTSL()
  birdMaterial.side = DoubleSide

  const birdMesh = new InstancedMesh(birdGeometry, birdMaterial, BIRDS)
  birdMesh.rotation.y = Math.PI / 2
  birdMesh.matrixAutoUpdate = false
  birdMesh.frustumCulled = false
  birdMesh.updateMatrix()

  // Define GPU Compute shaders.
  const computeVelocity = Fn(() => {
    // Define consts
    const PI = float(3.141592653589793)
    const PI_2 = PI.mul(2.0)
    const limit = float(effectController.speedLimit).toVar('limit')

    // Destructure uniforms
    const { alignment, separation, cohesion, deltaTime, rayOrigin, rayDirection } = effectController

    const zoneRadius = separation.add(alignment).add(cohesion).toConst()
    const separationThresh = separation.div(zoneRadius).toConst()
    const alignmentThresh = (separation.add(alignment)).div(zoneRadius).toConst()
    const zoneRadiusSq = zoneRadius.mul(zoneRadius).toConst()

    // Cache current bird's position and velocity outside the loop
    const birdIndex = instanceIndex.toConst('birdIndex')
    const position = positionStorage.element(birdIndex).toVar()
    const velocity = velocityStorage.element(birdIndex).toVar()

    // Add influence of pointer position to velocity using cached position
    const directionToRay = rayOrigin.sub(position).toConst()
    const projectionLength = dot(directionToRay, rayDirection).toConst()
    const closestPoint = rayOrigin.sub(rayDirection.mul(projectionLength)).toConst()
    const directionToClosestPoint = closestPoint.sub(position).toConst()
    const distanceToClosestPoint = length(directionToClosestPoint).toConst()
    const distanceToClosestPointSq = distanceToClosestPoint.mul(distanceToClosestPoint).toConst()

    const rayRadius = float(150.0).toConst()
    const rayRadiusSq = rayRadius.mul(rayRadius).toConst()

    If(distanceToClosestPointSq.lessThan(rayRadiusSq), () => {
      const velocityAdjust = (distanceToClosestPointSq.div(rayRadiusSq).sub(1.0)).mul(deltaTime).mul(100.0)
      velocity.addAssign(normalize(directionToClosestPoint).mul(velocityAdjust))
      limit.addAssign(5.0)
    })

    // Attract flocks to center
    const dirToCenter = position.toVar()
    dirToCenter.y.mulAssign(2.5)
    velocity.subAssign(normalize(dirToCenter).mul(deltaTime).mul(5.0))

    Loop({ start: uint(0), end: uint(BIRDS), type: 'uint', condition: '<' }, ({ i }) => {
      If(i.equal(birdIndex), () => {
        Continue()
      })

      // Cache bird's position and velocity
      const birdPosition = positionStorage.element(i)
      const dirToBird = birdPosition.sub(position)
      const distToBird = length(dirToBird)

      If(distToBird.lessThan(0.0001), () => {
        Continue()
      })

      const distToBirdSq = distToBird.mul(distToBird)

      // Don't apply any changes to velocity if the bird is outside the zone's radius.
      If(distToBirdSq.greaterThan(zoneRadiusSq), () => {
        Continue()
      })

      // Determine which threshold the bird is flying within and adjust its velocity accordingly
      const percent = distToBirdSq.div(zoneRadiusSq)

      If(percent.lessThan(separationThresh), () => {
        // Separation - Move apart for comfort
        const velocityAdjust = (separationThresh.div(percent).sub(1.0)).mul(deltaTime)
        velocity.subAssign(normalize(dirToBird).mul(velocityAdjust))
      }).ElseIf(percent.lessThan(alignmentThresh), () => {
        // Alignment - fly the same direction
        const threshDelta = alignmentThresh.sub(separationThresh)
        const adjustedPercent = (percent.sub(separationThresh)).div(threshDelta)
        const birdVelocity = velocityStorage.element(i)

        const cosRange = cos(adjustedPercent.mul(PI_2))
        const cosRangeAdjust = float(0.5).sub(cosRange.mul(0.5)).add(0.5)
        const velocityAdjust = cosRangeAdjust.mul(deltaTime)
        velocity.addAssign(normalize(birdVelocity).mul(velocityAdjust))
      }).Else(() => {
        // Attraction / Cohesion - move closer
        const threshDelta = alignmentThresh.oneMinus()
        const adjustedPercent = threshDelta.equal(0.0).select(1.0, (percent.sub(alignmentThresh)).div(threshDelta))

        const cosRange = cos(adjustedPercent.mul(PI_2))
        const adj1 = cosRange.mul(-0.5)
        const adj2 = adj1.add(0.5)
        const adj3 = float(0.5).sub(adj2)

        const velocityAdjust = adj3.mul(deltaTime)
        velocity.addAssign(normalize(dirToBird).mul(velocityAdjust))
      })
    })

    If(length(velocity).greaterThan(limit), () => {
      velocity.assign(normalize(velocity).mul(limit))
    })

    // Write back the final velocity to storage
    velocityStorage.element(birdIndex).assign(velocity)
  })().compute(BIRDS).setName('Birds Velocity')

  const computePosition = Fn(() => {
    const { deltaTime } = effectController
    positionStorage.element(instanceIndex).addAssign(velocityStorage.element(instanceIndex).mul(deltaTime).mul(15.0))

    const velocity = velocityStorage.element(instanceIndex)
    const phase = phaseStorage.element(instanceIndex)

    const modValue = phase.add(deltaTime).add(length(velocity.xz).mul(deltaTime).mul(3.0))
      .add(max(velocity.y, 0.0).mul(deltaTime).mul(6.0))
    phaseStorage.element(instanceIndex).assign(modValue.mod(62.83))
  })().compute(BIRDS).setName('Birds Position')

  scene.add(birdMesh)

  // The example's pointer: set on move, pushed off screen after each frame so
  // birds are only disturbed while the mouse moves.
  const pointer = new Vector2(0, 10)
  const raycaster = new Raycaster()

  function step(delta: number, camera: PerspectiveCamera) {
    // safety cap on large deltas
    effectController.deltaTime.value = Math.min(delta, 1)

    // The ray is in world space; the boids run in flock space.
    raycaster.setFromCamera(pointer, camera)
    effectController.rayOrigin.value.copy(raycaster.ray.origin).sub(flockOrigin.value).divideScalar(flockScale.value)
    effectController.rayDirection.value.copy(raycaster.ray.direction)

    renderer.compute(computeVelocity)
    renderer.compute(computePosition)
  }

  function dispose() {
    birdMesh.removeFromParent()
    computeVelocity.dispose()
    computePosition.dispose()
    birdGeometry.dispose()
    birdMaterial.dispose()
  }

  return { effectController, pointer, step, dispose }
}

type Birds = ReturnType<typeof createBirds>

function BirdsContent() {
  const { gl, scene, camera } = useThree()
  const birds = useRef<Birds | null>(null)
  const published = useRef(false)

  // The example's "Birds settings" GUI plus its SPEED_LIMIT.
  const values = useControls('Birds', {
    separation: { value: 15, min: 0, max: 100, step: 1, label: 'Separation' },
    alignment: { value: 20, min: 0, max: 100, step: 0.001, label: 'Alignment' },
    cohesion: { value: 20, min: 0, max: 100, step: 0.025, label: 'Cohesion' },
    speedLimit: { value: SPEED_LIMIT, min: 1, max: 20, step: 0.1, label: 'Speed limit' },
  })

  // Scene setup. LookContent is the earlier sibling, so this camera wins.
  useLayoutEffect(() => {
    // R3F types gl as WebGLRenderer even when its async factory returns WebGPU.
    const renderer = gl as unknown as WebGPURenderer
    const perspective = camera as PerspectiveCamera
    // Ground in the lower third, the flock in the sky above it.
    perspective.position.set(13, 1.8, 17)
    perspective.lookAt(0, 8.5, 0)
    perspective.updateMatrixWorld()

    const current = createBirds(renderer, scene)
    birds.current = current

    const onPointerMove = (event: PointerEvent) => {
      if (event.isPrimary === false) return
      const rect = gl.domElement.getBoundingClientRect()
      current.pointer.x = ((event.clientX - rect.left) / rect.width) * 2.0 - 1.0
      current.pointer.y = 1.0 - ((event.clientY - rect.top) / rect.height) * 2.0
    }
    gl.domElement.addEventListener('pointermove', onPointerMove)

    return () => {
      gl.domElement.removeEventListener('pointermove', onPointerMove)
      current.dispose()
      birds.current = null
      // No camera restore here: LookContent saved the pre-scene pose and owns it.
    }
  }, [gl, scene, camera])

  // Leva -> the example's uniforms.
  useLayoutEffect(() => {
    const current = birds.current
    if (!current) return
    current.effectController.separation.value = values.separation
    current.effectController.alignment.value = values.alignment
    current.effectController.cohesion.value = values.cohesion
    current.effectController.speedLimit.value = values.speedLimit
  }, [gl, scene, camera, values])

  // Positive priority takes over R3F's render loop, as the example's render().
  useFrame((_, delta) => {
    const current = birds.current
    if (!current) return

    const renderer = gl as unknown as WebGPURenderer
    current.step(delta, camera as PerspectiveCamera)
    renderer.render(scene, camera)
    // Move pointer away so we only affect birds when moving the mouse
    current.pointer.y = 10
    if (!published.current) {
      published.current = true
      setInfo('birds', { compute: true, count: BIRDS })
    }
  }, 1)

  return null
}

function BirdsUnsupported() {
  useEffect(() => {
    // The example requires WebGPU ("TODO: Fix example with WebGL backend") and
    // reads three storage buffers from the vertex stage.
    // App's effect runs initLab() after child effects; publish on the next task.
    const timer = window.setTimeout(() => setInfo('birds', { compute: false, count: 0 }), 0)
    return () => window.clearTimeout(timer)
  }, [])
  return null
}

export default function Birds() {
  const gl = useThree((state) => state.gl)
  return (
    <>
      <LookContent />
      {describeRenderer(gl).backend === 'webgpu' ? <BirdsContent /> : <BirdsUnsupported />}
    </>
  )
}
