import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { useControls } from 'leva'
import {
  AnimationMixer, Matrix4, Quaternion, SkeletonHelper, Vector3,
  type AnimationClip, type Object3D, type PerspectiveCamera, type SkinnedMesh,
} from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { clone, retargetClip, type RetargetClipOptions } from 'three/addons/utils/SkeletonUtils.js'
import { setInfo } from '../lab'

// Khronos glTF-Sample-Assets, both CC-BY-4.0 by Cesium (see LICENSES.md).
// The r186 example's Michelle.glb / Soldier.glb ship without a stated licence.
const SAMPLE_ASSETS = 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models'
const SOURCE = { name: 'CesiumMan', url: `${SAMPLE_ASSETS}/CesiumMan/glTF-Binary/CesiumMan.glb` }
const TARGET = { name: 'RiggedFigure', url: `${SAMPLE_ASSETS}/RiggedFigure/glTF-Binary/RiggedFigure.glb` }

// Target bone name -> source bone name. Both rigs have the same 19 joints, but
// the names differ and every bone uses a different local axis convention.
const BONE_NAMES: Record<string, string> = {
  torso_joint_1: 'Skeleton_torso_joint_1',
  torso_joint_2: 'Skeleton_torso_joint_2',
  torso_joint_3: 'torso_joint_3',
  neck_joint_1: 'Skeleton_neck_joint_1',
  neck_joint_2: 'Skeleton_neck_joint_2',
  arm_joint_R_1: 'Skeleton_arm_joint_R',
  arm_joint_R_2: 'Skeleton_arm_joint_R__2_',
  arm_joint_R_3: 'Skeleton_arm_joint_R__3_',
  // CesiumMan numbers its left arm from the hand; the hierarchy runs 4 -> 3 -> 2.
  arm_joint_L_1: 'Skeleton_arm_joint_L__4_',
  arm_joint_L_2: 'Skeleton_arm_joint_L__3_',
  arm_joint_L_3: 'Skeleton_arm_joint_L__2_',
  leg_joint_R_1: 'leg_joint_R_1',
  leg_joint_R_2: 'leg_joint_R_2',
  leg_joint_R_3: 'leg_joint_R_3',
  leg_joint_R_5: 'leg_joint_R_5',
  leg_joint_L_1: 'leg_joint_L_1',
  leg_joint_L_2: 'leg_joint_L_2',
  leg_joint_L_3: 'leg_joint_L_3',
  leg_joint_L_5: 'leg_joint_L_5',
}
const SOURCE_HIP = 'Skeleton_torso_joint_1'
// A target knee: once it turns away from its first-frame pose, the retargeted
// clip is measurably driving the target rig.
const PROBE_BONE = 'leg_joint_R_2'
const MOVING_ANGLE = 5 * Math.PI / 180

function findSkin(root: Object3D): SkinnedMesh {
  let skin: SkinnedMesh | undefined
  root.traverse((object) => {
    if (!skin && (object as SkinnedMesh).isSkinnedMesh) skin = object as SkinnedMesh
  })
  if (!skin) throw new Error(`No skinned mesh under "${root.name || root.type}"`)
  return skin
}

function worldRest(skin: SkinnedMesh, root: Object3D): Map<string, { rotation: Quaternion; position: Vector3 }> {
  skin.skeleton.pose()
  root.updateWorldMatrix(true, true)
  const rest = new Map<string, { rotation: Quaternion; position: Vector3 }>()
  for (const bone of skin.skeleton.bones) {
    const rotation = new Quaternion()
    const position = new Vector3()
    bone.matrixWorld.decompose(position, rotation, new Vector3())
    rest.set(bone.name, { rotation, position })
  }
  return rest
}

// retarget() copies each source bone's world rotation onto the target bone and
// reads the result in the target's world frame (the target bones sit under
// Z_UP > Armature, not under the skinned mesh). So the source copy is placed in
// that same frame, and a per-bone offset maps source rest rotation to target
// rest rotation: target = source * (sourceRest^-1 * targetRest). The r186
// example hand-writes these offsets for two Mixamo rigs; here the rigs' bone
// axes differ everywhere, so they are derived from both rest poses. Bake before
// the scenes are mounted so the hip position is not scaled with a stage offset.
function bakeRetarget(sourceScene: Object3D, targetScene: Object3D, sourceClip: AnimationClip) {
  const targetSkin = findSkin(targetScene)
  const rig = clone(sourceScene)
  const sourceSkin = findSkin(rig)
  targetScene.updateWorldMatrix(true, false)
  rig.matrixAutoUpdate = false
  rig.matrix.copy(targetScene.matrixWorld)

  const sourceRest = worldRest(sourceSkin, rig)
  const targetRest = worldRest(targetSkin, targetScene)
  const localOffsets: Record<string, Matrix4> = {}
  for (const [targetName, sourceName] of Object.entries(BONE_NAMES)) {
    const from = sourceRest.get(sourceName)
    const to = targetRest.get(targetName)
    if (!from || !to) throw new Error(`Missing bone for retarget map ${targetName} -> ${sourceName}`)
    localOffsets[targetName] = new Matrix4().makeRotationFromQuaternion(from.rotation.clone().invert().multiply(to.rotation))
  }

  const options: RetargetClipOptions & { localOffsets: Record<string, Matrix4> } = {
    hip: SOURCE_HIP,
    names: BONE_NAMES,
    localOffsets,
    // Keep the target's own leg length: scale the source hip track by hip height.
    scale: targetRest.get('torso_joint_1')!.position.y / sourceRest.get(SOURCE_HIP)!.position.y,
  }
  return { targetSkin, clip: retargetClip(targetSkin, sourceSkin, sourceClip, options) }
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
    perspective.fov = 40
    perspective.position.set(0, 1.3, 4.2)
    perspective.updateProjectionMatrix()

    const controls = new OrbitControls(perspective, gl.domElement)
    controls.target.set(0, 0.8, 0)
    controls.minDistance = 2
    controls.maxDistance = 12
    controls.maxPolarAngle = Math.PI / 2
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
      <color attach="background" args={['#1d2330']} />
      <hemisphereLight args={['#e9c0a5', '#0175ad', 2]} />
      <directionalLight position={[2, 5, 3]} intensity={3} castShadow
        shadow-mapSize={[1024, 1024]} shadow-camera-left={-3} shadow-camera-right={3}
        shadow-camera-top={3} shadow-camera-bottom={-3} />
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[20, 20]} />
        <meshStandardMaterial color="#8a8f98" />
      </mesh>
    </>
  )
}

function Characters() {
  const source = useGLTF(SOURCE.url)
  const target = useGLTF(TARGET.url)
  const { speed, showSource, skeletons } = useControls('Retarget', {
    speed: { value: 1, min: 0, max: 2, step: 0.05, label: 'Animation speed' },
    showSource: { value: true, label: 'Show source' },
    skeletons: { value: false, label: 'Skeleton helpers' },
  })

  const { sourceMixer, targetMixer, clip, probe } = useMemo(() => {
    const { targetSkin, clip } = bakeRetarget(source.scene, target.scene, source.animations[0])
    for (const root of [source.scene, target.scene]) {
      root.traverse((object) => {
        if ((object as SkinnedMesh).isMesh) object.castShadow = object.receiveShadow = true
      })
    }
    const sourceMixer = new AnimationMixer(source.scene)
    sourceMixer.clipAction(source.animations[0]).play()
    // As in the r186 example: the retargeted clip binds to the SkinnedMesh
    // itself (tracks are `.bones[name]`), so the mixer root is the mesh.
    const targetMixer = new AnimationMixer(targetSkin)
    targetMixer.clipAction(clip).play()
    const bone = targetSkin.skeleton.getBoneByName(PROBE_BONE)
    if (!bone) throw new Error(`Target rig has no "${PROBE_BONE}" bone`)
    return { sourceMixer, targetMixer, clip, probe: { bone, first: null as Quaternion | null, moving: false } }
  }, [source, target])

  const helpers = useMemo(
    () => [new SkeletonHelper(source.scene), new SkeletonHelper(target.scene)],
    [source, target],
  )

  useEffect(() => () => {
    for (const mixer of [sourceMixer, targetMixer]) {
      mixer.stopAllAction()
      mixer.uncacheRoot(mixer.getRoot())
    }
  }, [sourceMixer, targetMixer])

  useEffect(() => () => {
    for (const helper of helpers) helper.dispose()
  }, [helpers])

  const published = useRef<boolean | null>(null)
  useFrame((_, delta) => {
    sourceMixer.update(delta * speed)
    targetMixer.update(delta * speed)
    // Measure motion on the target bone instead of trusting the speed slider.
    if (!probe.first) probe.first = probe.bone.quaternion.clone()
    else if (!probe.moving && probe.bone.quaternion.angleTo(probe.first) > MOVING_ANGLE) probe.moving = true
    if (published.current !== probe.moving) {
      setInfo('retarget', { tracks: clip.tracks.length, moving: probe.moving, source: SOURCE.name, target: TARGET.name })
      published.current = probe.moving
    }
  })

  return (
    <>
      <group position={[-0.7, 0, 0]} rotation-y={Math.PI / 5} visible={showSource}>
        <primitive object={source.scene} dispose={null} />
      </group>
      <group position={[0.7, 0, 0]} rotation-y={Math.PI / 5}>
        <primitive object={target.scene} dispose={null} />
      </group>
      {helpers.map((helper) => (
        <primitive key={helper.uuid} object={helper} visible={skeletons && (showSource || helper === helpers[1])} />
      ))}
    </>
  )
}

export default function Retarget() {
  return (
    <>
      <Stage />
      <Characters />
    </>
  )
}
