import { useEffect, useMemo, useRef, type ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import { KeyboardControls, useAnimations, useGLTF, useKeyboardControls } from '@react-three/drei'
import { BallCollider, CuboidCollider, Physics, RigidBody } from '@react-three/rapier'
import { Ecctrl, type EcctrlHandle } from 'ecctrl'
import { EcctrlAnimationStateController, useEcctrlAnimationStore } from 'ecctrl/animation'
import { levaStore, useControls } from 'leva'
import { Box3, Vector3, type Mesh } from 'three'
import { clone } from 'three/addons/utils/SkeletonUtils.js'
import { setInfo } from '../lab'
import { LookContent } from './look'

type Control = 'forward' | 'backward' | 'leftward' | 'rightward' | 'jump' | 'run'
export const keyboardMap = [
  { name: 'forward', keys: ['KeyW', 'ArrowUp'] },
  { name: 'backward', keys: ['KeyS', 'ArrowDown'] },
  { name: 'leftward', keys: ['KeyA', 'ArrowLeft'] },
  { name: 'rightward', keys: ['KeyD', 'ArrowRight'] },
  { name: 'jump', keys: ['Space'] },
  { name: 'run', keys: ['Shift'] },
]

const animationMap = {
  IDLE: 'Survey',
  WALK: 'Walk',
  RUN: 'Run',
  // Fox has no airborne clips; keep its survey pose during jumps.
  JUMP_START: 'Survey',
  JUMP_IDLE: 'Survey',
  JUMP_FALL: 'Survey',
  JUMP_LAND: 'Survey',
} as const

export function Fox() {
  const { scene, animations } = useGLTF('/assets/Fox.glb')
  const { model, scale, offset } = useMemo(() => {
    // Clone the skeleton so another scene can reuse the cached GLTF safely.
    const model = clone(scene)
    model.traverse((object) => {
      if ((object as Mesh).isMesh) object.castShadow = object.receiveShadow = true
    })
    model.updateMatrixWorld(true)
    const bounds = new Box3().setFromObject(model, true)
    const scale = 1 / (bounds.max.y - bounds.min.y)
    const center = bounds.getCenter(new Vector3())
    const offset: [number, number, number] = [
      -center.x * scale, -bounds.min.y * scale - 0.63, -center.z * scale,
    ]
    return { model, scale, offset }
  }, [scene])
  const { actions } = useAnimations(animations, model)
  const animationState = useEcctrlAnimationStore((state) => state.animationState)
  const clip = animationMap[animationState]

  useEffect(() => {
    const action = actions[clip]
    if (!action) return
    action.reset().fadeIn(0.15).play()
    return () => { action.fadeOut(0.15) }
  }, [actions, clip])

  useEffect(() => {
    setInfo('feel', {
      controller: 'ecctrl', physics: 'rapier', animations: animations.map((clip) => clip.name),
    })
  }, [animations])

  return <primitive object={model} scale={scale} position={offset} dispose={null} />
}

export function Player() {
  const controller = useRef<EcctrlHandle>(null)
  const [, getKeys] = useKeyboardControls<Control>()
  const character = useControls('Character', {
    maxWalkVel: { value: 2, min: 0, max: 10, step: 0.1, label: 'Walk speed' },
    maxRunVel: { value: 5, min: 0, max: 15, step: 0.1, label: 'Run speed' },
    jumpVel: { value: 5, min: 0, max: 15, step: 0.1, label: 'Jump velocity' },
    accDeltaTime: {
      value: 0.2, min: 0, max: 1, step: 0.01, label: 'Acceleration factor',
      hint: 'Higher values reach the target speed faster; this is a factor, not seconds.',
    },
    decDeltaTime: {
      value: 0.2, min: 0, max: 1, step: 0.01, label: 'Deceleration factor',
      hint: 'Higher values stop faster after movement input is released.',
    },
    autoBalanceDampingC: {
      // Leva otherwise formats to two decimals and rounds on blur.
      value: 0.01, min: 0, max: 0.05, step: 0.001, pad: 3, label: 'Balance damping ⚠',
      hint: 'Around 0.03 and above, the small fox capsule can blow up (NaN). Default: 0.01.',
    },
    cameraDistance: { value: 7, min: 1, max: 20, step: 0.1, label: 'Camera behind' },
    cameraHeight: { value: 4, min: 0, max: 15, step: 0.1, label: 'Camera height' },
    cameraLookAtHeight: { value: 0.2, min: -2, max: 5, step: 0.1, label: 'Camera look-at height' },
  })

  // v2 accepts input through its handle; KeyboardControls alone does not feed it.
  // Run before Ecctrl's frame callback and preserve camera-relative movement.
  useFrame(({ camera }) => {
    setInfo('character', character)
    const handle = controller.current
    if (!handle?.body) return
    handle.setMovement(getKeys())
    const { x, y, z } = handle.body.translation()
    setInfo('player', { x, y, z })
    // v2's camera helper does not follow automatically. A fixed offset keeps
    // W pointing along +Z and avoids steering feedback from camera smoothing.
    camera.position.set(x, y + character.cameraHeight, z - character.cameraDistance)
    camera.lookAt(x, y + character.cameraLookAtHeight, z)
    camera.updateMatrixWorld()
  }, -1)

  return (
    <>
      {/* The default 0.03 torque-impulse damping overcorrects this small
          capsule's X/Z inertia (~0.009), making angular velocity diverge.
          v2.0.2 tracks these tuning props in its runtime callbacks, so updates
          preserve the existing body and position without a remount. */}
      <Ecctrl
        ref={controller}
        position={[0, 0.65, 3]}
        capsuleHalfHeight={0.2}
        capsuleRadius={0.25}
        maxWalkVel={character.maxWalkVel}
        maxRunVel={character.maxRunVel}
        jumpVel={character.jumpVel}
        accDeltaTime={character.accDeltaTime}
        decDeltaTime={character.decDeltaTime}
        autoBalanceDampingC={character.autoBalanceDampingC}
        floatHeight={0.2}
        enableToggleRun={false}
      >
        <Fox />
      </Ecctrl>
      <EcctrlAnimationStateController ecctrl={controller} />
    </>
  )
}

// Overrides Player's follow camera for a scene and puts the previous values
// back on unmount; Leva keeps plain values after their controls unmount. Render
// it after Player so the "Character" paths are registered by then.
export function CameraPreset({ distance, height, lookAt }: { distance: number; height: number; lookAt: number }) {
  useEffect(() => {
    const preset = {
      'Character.cameraDistance': distance,
      'Character.cameraHeight': height,
      'Character.cameraLookAtHeight': lookAt,
    }
    const previous = Object.fromEntries(Object.keys(preset).map((path) => [path, levaStore.get(path)]))
    levaStore.set(preset, false)
    return () => levaStore.set(previous, false)
  }, [distance, height, lookAt])
  return null
}

type Triple = [number, number, number]

function Block({ position, size, angle = 0, dynamic = false, color = '#ad9472' }: {
  position: Triple
  size: Triple
  angle?: number
  dynamic?: boolean
  color?: string
}) {
  return (
    <RigidBody
      type={dynamic ? 'dynamic' : 'fixed'}
      position={position}
      rotation={[angle, 0, 0]}
      colliders={false}
    >
      <CuboidCollider
        args={[size[0] / 2, size[1] / 2, size[2] / 2]}
        friction={0.7}
        restitution={0}
        {...(dynamic ? { mass: 0.3 } : {})}
      />
      <mesh castShadow receiveShadow>
        <boxGeometry args={size} />
        <meshStandardMaterial color={color} roughness={0.85} />
      </mesh>
    </RigidBody>
  )
}

// Static course plus LookContent; must be rendered inside a <Physics>.
export function FeelCourse() {
  return (
    <>
      <LookContent />
      <RigidBody type="fixed" colliders={false}>
        {/* Cuboid arguments are half extents; the top is exactly y=0. */}
        <CuboidCollider position={[0, -0.25, 0]} args={[20, 0.25, 20]} friction={0.8} />
        {/* Match the existing LookContent props as well as its ground. */}
        <CuboidCollider position={[0, 0.9, 0.5]} rotation={[0, 0.3, 0]} args={[0.9, 0.9, 0.9]} />
        <BallCollider position={[-2.5, 1, 0]} args={[1]} />
      </RigidBody>
      <RigidBody type="fixed" position={[2.6, 1.25, -0.5]} colliders="trimesh" includeInvisible>
        <mesh visible={false}>
          <torusKnotGeometry args={[0.75, 0.25, 128, 24]} />
        </mesh>
      </RigidBody>
      {[15, 30].map((degrees, index) => {
        const angle = degrees * Math.PI / 180
        return (
          <Block
            key={degrees}
            position={[index === 0 ? -3 : 3, 2 * Math.sin(angle), 8]}
            size={[2, 0.2, 4]}
            angle={-angle}
            color={index === 0 ? '#b4b9a4' : '#7c9c9d'}
          />
        )
      })}
      {Array.from({ length: 5 }, (_, index) => {
        const height = (index + 1) * 0.2
        return <Block key={index} position={[-5.5, height / 2, 2 + index * 0.6]} size={[2, height, 0.6]} />
      })}
      <Block position={[5.5, 0.5, 3]} size={[1, 1, 1]} />
      <Block position={[-5, 0.75, 9]} size={[1.5, 1.5, 1.5]} />
      <Block position={[-1.5, 0.4, 5.5]} size={[0.8, 0.8, 0.8]} dynamic color="#bb5935" />
      <Block position={[1.5, 0.4, 5.5]} size={[0.8, 0.8, 0.8]} dynamic color="#bb5935" />
    </>
  )
}

export function FeelContent({ children, player = true }: { children?: ReactNode; player?: boolean }) {
  return (
    <Physics>
      <FeelCourse />
      {player && (
        <KeyboardControls map={keyboardMap}>
          <Player />
        </KeyboardControls>
      )}
      {children}
    </Physics>
  )
}

export default function Feel() {
  return <FeelContent />
}
