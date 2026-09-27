import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { useControls } from 'leva'
import {
  AnimationClip, AnimationMixer, Box3, Euler, Matrix4, Mesh, MeshStandardNodeMaterial, Quaternion,
  StorageBufferAttribute, Vector3,
  type MeshStandardMaterial, type Object3D, type PerspectiveCamera, type SkinnedMesh, type WebGPURenderer,
} from 'three/webgpu'
import { Fn, add, attributeArray, instanceIndex, storage, uint, uniform, vec4, vertexIndex } from 'three/tsl'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { clone } from 'three/addons/utils/SkeletonUtils.js'
import { setInfo } from '../lab'

// Port of the r186 webgpu_skinning_instancing_individual technique: the CPU poses
// one skeleton per instance with mixer.setTime(), writes every pose into one bone
// storage buffer, a compute pass skins all instances, and one mesh draws them
// with mesh.count. (webgpu_skinning_instancing shares a single pose, so it cannot
// give each fox its own clip and phase.)
const COUNT = 200
const CLIPS = ['Survey', 'Walk', 'Run']
// Vogel spiral spacing in metres; the outermost fox sits at SPACING * sqrt(COUNT).
const SPACING = 1.05

// Deterministic layout so captures are comparable between runs.
function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function createCrowd(scene: Object3D, animations: AnimationClip[]) {
  // Clone so the cached GLTF stays untouched for feel and the other Fox scenes.
  const model = clone(scene)
  let source: SkinnedMesh | undefined
  model.traverse((object) => {
    if (!source && (object as SkinnedMesh).isSkinnedMesh) source = object as SkinnedMesh
  })
  if (!source) throw new Error('Fox.glb has no skinned mesh')
  const skin = source
  const skeleton = skin.skeleton
  const boneCount = skeleton.bones.length

  model.updateMatrixWorld(true)
  const bounds = new Box3().setFromObject(model, true)
  // A 1 m tall fox, as in feel.tsx.
  const unit = 1 / (bounds.max.y - bounds.min.y)

  const mixer = new AnimationMixer(model)
  const actions = CLIPS.map((name) => {
    const clip = AnimationClip.findByName(animations, name)
    if (!clip) throw new Error(`Fox.glb has no "${name}" clip`)
    const action = mixer.clipAction(clip)
    action.play()
    return action
  })

  // Per-instance variation: clip, phase, playback rate, size and heading.
  const random = mulberry32(186)
  const clipOf: number[] = []
  const phaseOf: number[] = []
  const rateOf: number[] = []
  const clipCounts = CLIPS.map(() => 0)
  const instanceMatrices = new StorageBufferAttribute(COUNT, 16)
  const matrix = new Matrix4()
  const quaternion = new Quaternion()
  const euler = new Euler()
  for (let i = 0; i < COUNT; i++) {
    const clip = Math.floor(random() * CLIPS.length)
    clipOf.push(clip)
    clipCounts[clip]++
    phaseOf.push(random() * actions[clip].getClip().duration)
    rateOf.push(0.85 + random() * 0.3)

    const radius = SPACING * Math.sqrt(i + 0.5)
    const angle = i * 2.399963 // golden angle
    const size = unit * (0.85 + random() * 0.3)
    // Roughly circle the centre, so walkers and runners read as a milling herd.
    euler.set(0, -angle + (random() - 0.5) * 1.2, 0)
    matrix.compose(
      new Vector3(Math.cos(angle) * radius, -bounds.min.y * size, Math.sin(angle) * radius),
      quaternion.setFromEuler(euler),
      new Vector3(size, size, size),
    )
    matrix.toArray(instanceMatrices.array, i * 16)
  }

  const geometry = skin.geometry.clone()
  const vertexCount = geometry.getAttribute('position').count
  const position = geometry.getAttribute('position')
  // The Fox ships without normals: the example's normal pass is dropped and the
  // node material shades flat from the skinned positions (as GLTFLoader already does).
  const sourcePositions = new Float32Array(vertexCount * 4)
  for (let i = 0; i < vertexCount; i++) {
    sourcePositions.set([position.getX(i), position.getY(i), position.getZ(i), 1], i * 4)
  }

  // pose() writes through this reference; dispose() drops it with the other buffers.
  let boneMatrices: StorageBufferAttribute | null = new StorageBufferAttribute(COUNT * boneCount, 16)
  const boneMatricesNode = storage(boneMatrices, 'mat4', boneMatrices.count).toReadOnly()
  const instanceMatricesNode = storage(instanceMatrices, 'mat4', COUNT).toReadOnly()
  const sourceVertices = storage(new StorageBufferAttribute(sourcePositions, 4), 'vec4', vertexCount).toReadOnly()
  const skinIndices = storage(
    new StorageBufferAttribute(new Uint32Array(geometry.getAttribute('skinIndex').array), 4), 'uvec4', vertexCount,
  ).toReadOnly()
  const skinWeights = storage(
    new StorageBufferAttribute(geometry.getAttribute('skinWeight').array as Float32Array, 4), 'vec4', vertexCount,
  ).toReadOnly()
  const bindMatrix = uniform(skin.bindMatrix, 'mat4')
  const bindMatrixInverse = uniform(skin.bindMatrixInverse, 'mat4')
  const vertices = attributeArray(COUNT * vertexCount, 'vec4')

  const computeSkinning = Fn(() => {
    const sourceVertex = instanceIndex.mod(uint(vertexCount))
    const meshInstance = instanceIndex.div(uint(vertexCount))
    const boneOffset = meshInstance.mul(uint(boneCount))
    const skinIndex = skinIndices.element(sourceVertex)
    const skinWeight = skinWeights.element(sourceVertex)
    const skinVertex = bindMatrix.mul(sourceVertices.element(sourceVertex))
    const skinPosition = bindMatrixInverse.mul(add(
      boneMatricesNode.element(boneOffset.add(skinIndex.x)).mul(skinVertex).mul(skinWeight.x),
      boneMatricesNode.element(boneOffset.add(skinIndex.y)).mul(skinVertex).mul(skinWeight.y),
      boneMatricesNode.element(boneOffset.add(skinIndex.z)).mul(skinVertex).mul(skinWeight.z),
      boneMatricesNode.element(boneOffset.add(skinIndex.w)).mul(skinVertex).mul(skinWeight.w),
    ))
    const instanceMatrix = instanceMatricesNode.element(meshInstance)
    vertices.element(instanceIndex).assign(vec4(instanceMatrix.mul(skinPosition).xyz, 1))
  })().compute(COUNT * vertexCount).setName('Compute Instanced Skinning')

  const sourceMaterial = skin.material as MeshStandardMaterial
  const material = new MeshStandardNodeMaterial()
  material.map = sourceMaterial.map
  material.color.copy(sourceMaterial.color)
  material.roughness = sourceMaterial.roughness
  material.metalness = sourceMaterial.metalness
  material.flatShading = true
  material.positionNode = vertices.element(instanceIndex.mul(uint(vertexCount)).add(vertexIndex)).xyz

  const mesh = new Mesh(geometry, material)
  mesh.count = COUNT
  mesh.castShadow = true
  mesh.receiveShadow = true
  // Instances are placed by the compute pass, far outside the geometry's bounds.
  mesh.frustumCulled = false

  // Pose every instance on the one CPU skeleton and store its bone matrices.
  function pose(clock: number) {
    if (!boneMatrices) return
    for (let i = 0; i < COUNT; i++) {
      const clip = clipOf[i]
      for (let a = 0; a < actions.length; a++) actions[a].setEffectiveWeight(a === clip ? 1 : 0)
      mixer.setTime(clock * rateOf[i] + phaseOf[i])
      model.updateMatrixWorld(true)
      skeleton.update()
      boneMatrices.array.set(skeleton.boneMatrices!, i * boneCount * 16)
    }
    boneMatrices.needsUpdate = true
  }

  return {
    mesh, computeSkinning, pose,
    clips: Object.fromEntries(CLIPS.map((name, index) => [name, clipCounts[index]])),
    dispose() {
      mixer.stopAllAction()
      mixer.uncacheRoot(model)
      // Frees the compute pipeline and bind groups. The renderer keeps storage
      // buffers in WeakMaps and has no public destroy call, so drop the references
      // held here (pose writes, the material's vertex read) to let them be collected.
      computeSkinning.dispose()
      boneMatrices = null
      material.positionNode = null
      geometry.dispose()
      material.dispose()
    },
  }
}

function Stage() {
  const { camera, gl } = useThree()

  useLayoutEffect(() => {
    const perspective = camera as PerspectiveCamera
    const previous = {
      position: perspective.position.clone(),
      quaternion: perspective.quaternion.clone(),
      fov: perspective.fov,
    }
    perspective.fov = 45
    perspective.position.set(0, 14, 27)
    perspective.updateProjectionMatrix()

    const controls = new OrbitControls(perspective, gl.domElement)
    controls.target.set(0, 0, 1.5)
    controls.minDistance = 3
    controls.maxDistance = 60
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

  return (
    <>
      <color attach="background" args={['#b9cbd8']} />
      <fog attach="fog" args={['#b9cbd8', 30, 80]} />
      <hemisphereLight args={['#ffffff', '#6f7a5a', 1.2]} />
      <directionalLight position={[-8, 16, 10]} intensity={2.8} color="#fff6e8" castShadow
        shadow-mapSize={[2048, 2048]} shadow-camera-left={-18} shadow-camera-right={18}
        shadow-camera-top={18} shadow-camera-bottom={-18} shadow-camera-far={50} />
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial color="#8e9a78" roughness={0.95} />
      </mesh>
    </>
  )
}

function Crowd() {
  const gl = useThree((state) => state.gl)
  const { scene, animations } = useGLTF('/assets/Fox.glb')
  const { speed } = useControls('Crowd', {
    speed: { value: 1, min: 0, max: 3, step: 0.05, label: 'Animation speed' },
    count: { value: COUNT, disabled: true, label: 'Foxes (fixed)' },
  })

  const crowd = useMemo(() => createCrowd(scene, animations), [scene, animations])
  useEffect(() => () => crowd.dispose(), [crowd])

  const clock = useRef(0)
  const posedFrames = useRef(0)
  useFrame((_, delta) => {
    // Advance a shared clock so speed changes do not jump the phases.
    clock.current += Math.min(delta, 0.1) * speed
    crowd.pose(clock.current)
    ;(gl as unknown as WebGPURenderer).compute(crowd.computeSkinning)
    posedFrames.current++
    // Read the drawn instance count and dispatch tally rather than echo COUNT.
    setInfo('crowd', { count: crowd.mesh.count, clips: crowd.clips, posedFrames: posedFrames.current })
  })

  return <primitive object={crowd.mesh} />
}

export default function CrowdScene() {
  return (
    <>
      <Stage />
      <Crowd />
    </>
  )
}
