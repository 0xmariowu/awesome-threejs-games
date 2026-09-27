import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, useLoader, useThree } from '@react-three/fiber'
import { folder, useControls } from 'leva'
import {
  BufferAttribute, BufferGeometry, Color, DoubleSide, EquirectangularReflectionMapping, IcosahedronGeometry,
  InstancedBufferGeometry, Line, LineBasicNodeMaterial, Mesh, MeshPhysicalNodeMaterial, MeshStandardNodeMaterial,
  NeutralToneMapping, PlaneGeometry, SpriteNodeMaterial, Vector3,
  type PerspectiveCamera, type Scene, type Texture, type WebGPURenderer,
} from 'three/webgpu'
import {
  Fn, If, Loop, Return, attribute, cross, float, instanceIndex, instancedArray, select, time,
  transformNormalToView, triNoise3D, uniform,
} from 'three/tsl'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { UltraHDRLoader } from 'three/addons/loaders/UltraHDRLoader.js'
import { setInfo } from '../lab'
import { describeRenderer } from '../renderer'

// Port of three.js r186 examples/webgpu_compute_cloth.html: a verlet cloth
// (spring forces, gravity, triNoise3D wind, sphere collision) stepped in two
// compute shaders at a fixed 360 steps per second, drawn by a node material
// that rebuilds positions and normals from the storage buffer.
// The only asset is the example's own environment: Poly Haven "Royal
// Esplanade" (Greg Zaal, CC0) as an UltraHDR JPEG, pinned to r186.
const R186 = 'https://raw.githubusercontent.com/mrdoob/three.js/r186/examples'
const ENVIRONMENT = `${R186}/textures/equirectangular/royal_esplanade_2k.hdr.jpg`

const clothWidth = 1
const clothHeight = 1
const clothNumSegmentsX = 30
const clothNumSegmentsY = 30
const sphereRadius = 0.15
const stepsPerSecond = 360 // same amount of simulation steps per second on all systems, independent of refresh rate

interface VerletVertex {
  id: number
  position: Vector3
  isFixed: boolean
  springIds: number[]
}

interface VerletSpring {
  id: number
  vertex0: VerletVertex
  vertex1: VerletVertex
}

// The example's setupCloth() and render(), scoped to one mount so the storage
// buffers, compute nodes and meshes are rebuilt and freed with the scene.
function createCloth(renderer: WebGPURenderer, scene: Scene) {
  const verletVertices: VerletVertex[] = []
  const verletSprings: VerletSpring[] = []
  const verletVertexColumns: VerletVertex[][] = []

  // setupVerletGeometry: a grid of vertices connected by springs

  const addVerletVertex = (x: number, y: number, z: number, isFixed: boolean) => {
    const vertex: VerletVertex = { id: verletVertices.length, position: new Vector3(x, y, z), isFixed, springIds: [] }
    verletVertices.push(vertex)
    return vertex
  }

  const addVerletSpring = (vertex0: VerletVertex, vertex1: VerletVertex) => {
    const spring: VerletSpring = { id: verletSprings.length, vertex0, vertex1 }
    vertex0.springIds.push(spring.id)
    vertex1.springIds.push(spring.id)
    verletSprings.push(spring)
    return spring
  }

  // create the cloth's verlet vertices
  for (let x = 0; x <= clothNumSegmentsX; x++) {
    const column: VerletVertex[] = []
    for (let y = 0; y <= clothNumSegmentsY; y++) {
      const posX = x * (clothWidth / clothNumSegmentsX) - clothWidth * 0.5
      const posZ = y * (clothHeight / clothNumSegmentsY)
      const isFixed = (y === 0) && ((x % 5) === 0) // make some of the top vertices' positions fixed
      column.push(addVerletVertex(posX, clothHeight * 0.5, posZ, isFixed))
    }
    verletVertexColumns.push(column)
  }

  // create the cloth's verlet springs
  for (let x = 0; x <= clothNumSegmentsX; x++) {
    for (let y = 0; y <= clothNumSegmentsY; y++) {
      const vertex0 = verletVertexColumns[x][y]
      if (x > 0) addVerletSpring(vertex0, verletVertexColumns[x - 1][y])
      if (y > 0) addVerletSpring(vertex0, verletVertexColumns[x][y - 1])
      if (x > 0 && y > 0) addVerletSpring(vertex0, verletVertexColumns[x - 1][y - 1])
      if (x > 0 && y < clothNumSegmentsY) addVerletSpring(vertex0, verletVertexColumns[x - 1][y + 1])
    }
  }

  // setupVerletVertexBuffers

  const vertexCount = verletVertices.length
  // spring ids ordered by the vertex they affect, so each vertex iterates only its own springs
  const springListArray: number[] = []
  const vertexPositionArray = new Float32Array(vertexCount * 3)
  // per vertex: x = isFixed, y = springCount, z = springPointer into springListArray
  const vertexParamsArray = new Uint32Array(vertexCount * 3)

  for (let i = 0; i < vertexCount; i++) {
    const vertex = verletVertices[i]
    vertexPositionArray[i * 3] = vertex.position.x
    vertexPositionArray[i * 3 + 1] = vertex.position.y
    vertexPositionArray[i * 3 + 2] = vertex.position.z
    vertexParamsArray[i * 3] = vertex.isFixed ? 1 : 0
    if (!vertex.isFixed) {
      vertexParamsArray[i * 3 + 1] = vertex.springIds.length
      vertexParamsArray[i * 3 + 2] = springListArray.length
      springListArray.push(...vertex.springIds)
    }
  }

  const vertexPositionBuffer = instancedArray(vertexPositionArray, 'vec3').setPBO(true) // setPBO(true) only matters for the WebGL fallback
  const vertexForceBuffer = instancedArray(vertexCount, 'vec3')
  const vertexParamsBuffer = instancedArray(vertexParamsArray, 'uvec3')
  const springListBuffer = instancedArray(new Uint32Array(springListArray), 'uint').setPBO(true)

  // setupVerletSpringBuffers

  const springCount = verletSprings.length
  const springVertexIdArray = new Uint32Array(springCount * 2)
  const springRestLengthArray = new Float32Array(springCount)

  for (let i = 0; i < springCount; i++) {
    const spring = verletSprings[i]
    springVertexIdArray[i * 2] = spring.vertex0.id
    springVertexIdArray[i * 2 + 1] = spring.vertex1.id
    springRestLengthArray[i] = spring.vertex0.position.distanceTo(spring.vertex1.position)
  }

  const springVertexIdBuffer = instancedArray(springVertexIdArray, 'uvec2').setPBO(true)
  const springRestLengthBuffer = instancedArray(springRestLengthArray, 'float')
  const springForceBuffer = instancedArray(springCount * 3, 'vec3').setPBO(true)

  // setupUniforms

  const dampeningUniform = uniform(0.99)
  const spherePositionUniform = uniform(new Vector3(0, 0, 0))
  const sphereUniform = uniform(1.0)
  const windUniform = uniform(1.0)
  const stiffnessUniform = uniform(0.2)

  // setupComputeShaders

  // 1. per spring: a force from the distance between its two vertices and the rest length
  const computeSpringForces = Fn(() => {
    const vertexIds = springVertexIdBuffer.element(instanceIndex)
    const restLength = springRestLengthBuffer.element(instanceIndex)

    const vertex0Position = vertexPositionBuffer.element(vertexIds.x)
    const vertex1Position = vertexPositionBuffer.element(vertexIds.y)

    const delta = vertex1Position.sub(vertex0Position).toVar()
    const dist = delta.length().max(0.000001).toVar()
    const force = dist.sub(restLength).mul(stiffnessUniform).mul(delta).mul(0.5).div(dist)
    springForceBuffer.element(instanceIndex).assign(force)
  })().compute(springCount).setName('Spring Forces')

  // 2. per vertex: accumulate its spring forces, add gravity, wind and the
  // sphere collision, then move the vertex by the resulting force.
  const computeVertexForces = Fn(() => {
    const params = vertexParamsBuffer.element(instanceIndex).toVar()
    const isFixed = params.x
    const vertexSpringCount = params.y
    const springPointer = params.z

    If(isFixed, () => {
      // don't need to calculate vertex forces if the vertex is set as immovable
      Return()
    })

    const position = vertexPositionBuffer.element(instanceIndex).toVar('vertexPosition')
    const force = vertexForceBuffer.element(instanceIndex).toVar('vertexForce')

    force.mulAssign(dampeningUniform)

    const ptrStart = springPointer.toVar('ptrStart')
    const ptrEnd = ptrStart.add(vertexSpringCount).toVar('ptrEnd')

    Loop({ start: ptrStart, end: ptrEnd, type: 'uint', condition: '<' }, ({ i }) => {
      const springId = springListBuffer.element(i).toVar('springId')
      const springForce = springForceBuffer.element(springId)
      const springVertexIds = springVertexIdBuffer.element(springId)
      const factor = select(springVertexIds.x.equal(instanceIndex), 1.0, -1.0)
      force.addAssign(springForce.mul(factor))
    })

    // gravity
    force.y.subAssign(0.00005)

    // wind
    const noise = triNoise3D(position, 1, time).sub(0.2).mul(0.0001)
    const windForce = noise.mul(windUniform)
    force.z.subAssign(windForce)

    // collision with sphere
    const deltaSphere = position.add(force).sub(spherePositionUniform)
    const dist = deltaSphere.length()
    const sphereForce = float(sphereRadius).sub(dist).max(0).mul(deltaSphere).div(dist).mul(sphereUniform)
    force.addAssign(sphereForce)

    vertexForceBuffer.element(instanceIndex).assign(force)
    vertexPositionBuffer.element(instanceIndex).addAssign(force)
  })().compute(vertexCount).setName('Vertex Forces')

  // setupWireframe: helpers to visualize the verlet system

  const vertexWireframeGeometry = new PlaneGeometry(0.01, 0.01)
  const vertexWireframeMaterial = new SpriteNodeMaterial()
  vertexWireframeMaterial.positionNode = vertexPositionBuffer.element(instanceIndex)
  const vertexWireframeObject = new Mesh(vertexWireframeGeometry, vertexWireframeMaterial)
  vertexWireframeObject.frustumCulled = false
  vertexWireframeObject.count = vertexCount
  scene.add(vertexWireframeObject)

  const springWireframeMaterial = new LineBasicNodeMaterial()
  springWireframeMaterial.positionNode = Fn(() => {
    const vertexIds = springVertexIdBuffer.element(instanceIndex)
    const vertexId = select(attribute('vertexIndex', 'uint').equal(0), vertexIds.x, vertexIds.y)
    return vertexPositionBuffer.element(vertexId)
  })()

  const springWireframeGeometry = new InstancedBufferGeometry()
  springWireframeGeometry.setAttribute('position', new BufferAttribute(new Float32Array(6), 3, false))
  springWireframeGeometry.setAttribute('vertexIndex', new BufferAttribute(new Uint32Array([0, 1]), 1, false))
  springWireframeGeometry.instanceCount = springCount

  const springWireframeObject = new Line(springWireframeGeometry, springWireframeMaterial)
  springWireframeObject.frustumCulled = false
  springWireframeObject.count = springCount
  scene.add(springWireframeObject)

  // setupSphere

  const sphereGeometry = new IcosahedronGeometry(sphereRadius * 0.95, 4)
  const sphereMaterial = new MeshStandardNodeMaterial()
  const sphere = new Mesh(sphereGeometry, sphereMaterial)
  scene.add(sphere)

  // setupClothMesh: each render vertex sits at the centre of 4 verlet vertices

  const clothVertexCount = clothNumSegmentsX * clothNumSegmentsY
  const clothGeometry = new BufferGeometry()
  // the 4 verlet vertex ids that contribute to each geometry vertex's position
  const verletVertexIdArray = new Uint32Array(clothVertexCount * 4)
  const indices: number[] = []

  const getIndex = (x: number, y: number) => y * clothNumSegmentsX + x

  for (let x = 0; x < clothNumSegmentsX; x++) {
    for (let y = 0; y < clothNumSegmentsX; y++) {
      const index = getIndex(x, y)
      verletVertexIdArray[index * 4] = verletVertexColumns[x][y].id
      verletVertexIdArray[index * 4 + 1] = verletVertexColumns[x + 1][y].id
      verletVertexIdArray[index * 4 + 2] = verletVertexColumns[x][y + 1].id
      verletVertexIdArray[index * 4 + 3] = verletVertexColumns[x + 1][y + 1].id

      if (x > 0 && y > 0) {
        indices.push(getIndex(x, y), getIndex(x - 1, y), getIndex(x - 1, y - 1))
        indices.push(getIndex(x, y), getIndex(x - 1, y - 1), getIndex(x, y - 1))
      }
    }
  }

  clothGeometry.setAttribute('position', new BufferAttribute(new Float32Array(clothVertexCount * 3), 3, false))
  clothGeometry.setAttribute('vertexIds', new BufferAttribute(verletVertexIdArray, 4, false))
  clothGeometry.setIndex(indices)

  const clothMaterial = new MeshPhysicalNodeMaterial({
    color: new Color().setHex(0x204080),
    side: DoubleSide,
    transparent: true,
    opacity: 0.85,
    sheen: 1.0,
    sheenRoughness: 0.5,
    sheenColor: new Color().setHex(0xffffff),
  })

  clothMaterial.positionNode = Fn(({ material }) => {
    // gather the 4 verlet vertices and derive the centre position and normal
    const vertexIds = attribute('vertexIds', 'uvec4')
    const v0 = vertexPositionBuffer.element(vertexIds.x).toVar()
    const v1 = vertexPositionBuffer.element(vertexIds.y).toVar()
    const v2 = vertexPositionBuffer.element(vertexIds.z).toVar()
    const v3 = vertexPositionBuffer.element(vertexIds.w).toVar()

    const top = v0.add(v1)
    const right = v1.add(v3)
    const bottom = v2.add(v3)
    const left = v0.add(v2)

    const tangent = right.sub(left).normalize()
    const bitangent = bottom.sub(top).normalize()

    const normal = cross(tangent, bitangent)

    // send the normalView from the vertex shader to the fragment shader
    ;(material as MeshPhysicalNodeMaterial).normalNode = transformNormalToView(normal).toVarying()

    return v0.add(v1).add(v2).add(v3).mul(0.25)
  })()

  const clothMesh = new Mesh(clothGeometry, clothMaterial)
  clothMesh.frustumCulled = false
  scene.add(clothMesh)

  const params = { wireframe: false, sphere: true, wind: 1.0 }
  let timeSinceLastStep = 0
  let timestamp = 0

  function updateSphere() {
    sphere.position.set(Math.sin(timestamp * 2.1) * 0.1, 0, Math.sin(timestamp * 0.8))
    spherePositionUniform.value.copy(sphere.position)
  }

  function step(delta: number) {
    sphere.visible = params.sphere
    sphereUniform.value = params.sphere ? 1 : 0
    windUniform.value = params.wind
    clothMesh.visible = !params.wireframe
    vertexWireframeObject.visible = params.wireframe
    springWireframeObject.visible = params.wireframe

    // don't advance the time too far, for example when the window is out of focus
    const deltaTime = Math.min(delta, 1 / 60)
    const timePerStep = 1 / stepsPerSecond

    timeSinceLastStep += deltaTime

    while (timeSinceLastStep >= timePerStep) {
      // run a verlet system simulation step
      timestamp += timePerStep
      timeSinceLastStep -= timePerStep
      updateSphere()
      renderer.compute(computeSpringForces)
      renderer.compute(computeVertexForces)
    }
  }

  function dispose() {
    for (const object of [vertexWireframeObject, springWireframeObject, sphere, clothMesh]) object.removeFromParent()
    computeSpringForces.dispose()
    computeVertexForces.dispose()
    vertexWireframeGeometry.dispose()
    vertexWireframeMaterial.dispose()
    springWireframeGeometry.dispose()
    springWireframeMaterial.dispose()
    sphereGeometry.dispose()
    sphereMaterial.dispose()
    clothGeometry.dispose()
    clothMaterial.dispose()
  }

  return { params, stiffnessUniform, clothMaterial, step, dispose }
}

type Cloth = ReturnType<typeof createCloth>

function ClothContent() {
  const { gl, scene, camera } = useThree()
  const cloth = useRef<Cloth | null>(null)
  const published = useRef(false)

  const hdr = useLoader(UltraHDRLoader, ENVIRONMENT)
  const environment = useMemo<Texture>(() => {
    // Clone so the mapping does not leak into useLoader's shared cache.
    const texture = hdr.clone()
    texture.mapping = EquirectangularReflectionMapping
    texture.needsUpdate = true
    return texture
  }, [hdr])

  // The example's "Settings" GUI and its "material" folder.
  const values = useControls('Cloth', {
    stiffness: { value: 0.2, min: 0.1, max: 0.5, step: 0.01 },
    wireframe: false,
    sphere: true,
    wind: { value: 1.0, min: 0, max: 5, step: 0.1 },
    material: folder({
      color: '#204080',
      roughness: { value: 1, min: 0, max: 1, step: 0.01 },
      sheen: { value: 1, min: 0, max: 1, step: 0.01 },
      sheenRoughness: { value: 0.5, min: 0, max: 1, step: 0.01 },
      sheenColor: '#ffffff',
    }),
  })

  // Scene setup: renderer state, camera, environment, cloth and controls.
  useLayoutEffect(() => {
    // R3F types gl as WebGLRenderer even when its async factory returns WebGPU.
    const renderer = gl as unknown as WebGPURenderer
    const perspective = camera as PerspectiveCamera
    const previous = {
      position: perspective.position.clone(),
      quaternion: perspective.quaternion.clone(),
      fov: perspective.fov,
      near: perspective.near,
      far: perspective.far,
      background: scene.background,
      backgroundBlurriness: scene.backgroundBlurriness,
      environment: scene.environment,
      toneMapping: renderer.toneMapping,
      exposure: renderer.toneMappingExposure,
    }
    perspective.fov = 40
    perspective.near = 0.01
    perspective.far = 10
    perspective.position.set(-1.6, -0.1, -1.6)
    perspective.updateProjectionMatrix()
    renderer.toneMapping = NeutralToneMapping
    renderer.toneMappingExposure = 1
    scene.background = environment
    scene.backgroundBlurriness = 0.5
    scene.environment = environment

    const orbit = new OrbitControls(perspective, gl.domElement)
    orbit.minDistance = 1
    orbit.maxDistance = 3
    orbit.target.set(0, -0.1, 0)
    orbit.update()

    cloth.current = createCloth(renderer, scene)

    return () => {
      cloth.current?.dispose()
      cloth.current = null
      orbit.dispose()
      environment.dispose()
      scene.background = previous.background
      scene.backgroundBlurriness = previous.backgroundBlurriness
      scene.environment = previous.environment
      renderer.toneMapping = previous.toneMapping
      renderer.toneMappingExposure = previous.exposure
      perspective.fov = previous.fov
      perspective.near = previous.near
      perspective.far = previous.far
      perspective.position.copy(previous.position)
      perspective.quaternion.copy(previous.quaternion)
      perspective.updateProjectionMatrix()
      perspective.updateMatrixWorld()
    }
  }, [gl, scene, camera, environment])

  // Leva -> the example's params, uniforms and cloth material.
  useLayoutEffect(() => {
    const current = cloth.current
    if (!current) return
    current.stiffnessUniform.value = values.stiffness
    current.params.wireframe = values.wireframe
    current.params.sphere = values.sphere
    current.params.wind = values.wind
    current.clothMaterial.color.set(values.color)
    current.clothMaterial.roughness = values.roughness
    current.clothMaterial.sheen = values.sheen
    current.clothMaterial.sheenRoughness = values.sheenRoughness
    current.clothMaterial.sheenColor.set(values.sheenColor)
  }, [gl, scene, camera, environment, values])

  // Positive priority takes over R3F's render loop, as the example's render().
  useFrame((_, delta) => {
    const current = cloth.current
    if (!current) return

    const renderer = gl as unknown as WebGPURenderer
    current.step(delta)
    renderer.render(scene, camera)
    if (!published.current) {
      published.current = true
      setInfo('cloth', true)
    }
  }, 1)

  return null
}

function ClothUnsupported() {
  useEffect(() => {
    // The example requires WebGPU ("TODO: Fix example with WebGL backend") and
    // reads storage buffers from the vertex stage.
    // App's effect runs initLab() after child effects; publish on the next task.
    const timer = window.setTimeout(() => setInfo('cloth', false), 0)
    return () => window.clearTimeout(timer)
  }, [])
  return null
}

export default function Cloth() {
  const gl = useThree((state) => state.gl)
  return describeRenderer(gl).backend === 'webgpu' ? <ClothContent /> : <ClothUnsupported />
}
