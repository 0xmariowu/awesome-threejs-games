// Chase camera ported from the owner's own game, cloudkeep (MIT):
// 0xmariowu/cloudkeep src/flight-camera.ts. Same math, retargeted from the
// airship to the fox: exp-decay smoothing (1 - exp(-dt * k)) for yaw, pitch and
// zoom; unwrapped drag angles so a >180-degree drag keeps its direction; a focus
// point lerped apart from the camera; and a short-arc recentre on C.
import { useEffect, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useControls } from 'leva'
import { MathUtils, Vector3 } from 'three'
import { setInfo } from '../lab'
import { FeelContent } from './feel'

type View = { orbitYaw: number; orbitPitch: number; distanceScale: number; recenterId: number }
type Tune = { sharpness: number; distance: number; height: number; focusLag: number }
type Point = { x: number; y: number; z: number }

// The fox is ~1 unit tall; cloudkeep's 2.4 focus lift and 8/28 aim lead are rescaled.
const FOCUS_LIFT = 0.3
const AIM_LEAD = 8 / 28
const MIN_CAMERA_Y = 0.3

class ChaseRig {
  readonly position = new Vector3()
  readonly aim = new Vector3()
  readonly focus = new Vector3()
  private forward = new Vector3()
  private yaw = 0
  private pitch = 0
  private zoom = 1
  private recenterId = 0
  private initial = true

  update(pos: Point, view: View, dt: number, tune: Tune) {
    const alpha = this.initial ? 1 : 1 - Math.exp(-dt * tune.sharpness)
    // The fox steers relative to this camera, so yaw follows input only; tracking
    // the fox's heading as cloudkeep does for the airship would feed back into steering.
    const targetYaw = view.orbitYaw
    // Input angles are unwrapped. Only an explicit recentre takes the short arc.
    if (this.initial) this.yaw = targetYaw
    else if (this.recenterId !== view.recenterId) {
      this.yaw = targetYaw + Math.atan2(Math.sin(this.yaw - targetYaw), Math.cos(this.yaw - targetYaw))
    }
    this.recenterId = view.recenterId
    this.yaw = MathUtils.lerp(this.yaw, targetYaw, alpha)
    this.pitch = MathUtils.lerp(this.pitch, MathUtils.clamp(view.orbitPitch, -0.9, 0.75), alpha)
    this.zoom = MathUtils.lerp(this.zoom, view.distanceScale, alpha)
    const follow = this.initial || tune.focusLag <= 0 ? 1 : 1 - Math.exp(-dt / tune.focusLag)
    this.focus.x = MathUtils.lerp(this.focus.x, pos.x, follow)
    this.focus.y = MathUtils.lerp(this.focus.y, pos.y + FOCUS_LIFT, follow)
    this.focus.z = MathUtils.lerp(this.focus.z, pos.z, follow)
    this.initial = false

    // cloudkeep's fixed 0.44 rest elevation and 28-unit arm come from the Leva offsets here.
    const elevation = MathUtils.clamp(Math.atan2(tune.height, tune.distance) - this.pitch, -0.3, 1.0)
    const arm = Math.hypot(tune.distance, tune.height) * this.zoom
    this.position.set(
      Math.sin(this.yaw) * Math.cos(elevation), Math.sin(elevation), Math.cos(this.yaw) * Math.cos(elevation),
    ).multiplyScalar(arm).add(this.focus)
    this.position.y = Math.max(MIN_CAMERA_Y, this.position.y)
    this.forward.set(
      -Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), -Math.cos(this.yaw) * Math.cos(this.pitch),
    )
    this.aim.copy(this.focus).addScaledVector(this.forward, arm * AIM_LEAD)
  }
}

function readPlayer(): Point | null {
  const player = window.__LAB__?.info.player
  if (!player || typeof player !== 'object') return null
  const { x, y, z } = player as Record<string, unknown>
  if (typeof x !== 'number' || typeof y !== 'number' || typeof z !== 'number') return null
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return null
  return { x, y, z }
}

function CloudkeepCamera() {
  const domElement = useThree((state) => state.gl.domElement)
  const tune = useControls('Cloudkeep camera', {
    sharpness: { value: 12, min: 1, max: 30, step: 0.5, label: 'Follow sharpness', hint: 'k in 1 - exp(-dt * k) for yaw, pitch and zoom.' },
    distance: { value: 7, min: 2, max: 20, step: 0.1, label: 'Distance' },
    height: { value: 4, min: 0, max: 15, step: 0.1, label: 'Height' },
    focusLag: { value: 0.1, min: 0, max: 1, step: 0.01, label: 'Focus lag (s)', hint: 'Time constant of the focus point; 0 locks it to the fox.' },
  })
  const [rig] = useState(() => new ChaseRig())
  // Yaw pi puts the camera on -Z, matching feel's fixed follow before any input.
  const view = useRef<View>({ orbitYaw: Math.PI, orbitPitch: 0, distanceScale: 1, recenterId: 0 })
  const heading = useRef(0)
  const last = useRef<Point | null>(null)
  const published = useRef(false)

  useEffect(() => {
    let drag: { id: number; x: number; y: number } | null = null
    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return
      domElement.setPointerCapture(event.pointerId)
      drag = { id: event.pointerId, x: event.clientX, y: event.clientY }
    }
    const onPointerMove = (event: PointerEvent) => {
      if (drag?.id !== event.pointerId) return
      const v = view.current
      // Same sensitivities as cloudkeep's input.ts orbit drag.
      v.orbitYaw -= (event.clientX - drag.x) * 0.004
      v.orbitPitch = MathUtils.clamp(v.orbitPitch - (event.clientY - drag.y) * 0.003, -1.2, 1.2)
      drag.x = event.clientX
      drag.y = event.clientY
    }
    const onPointerUp = (event: PointerEvent) => {
      if (drag?.id === event.pointerId) drag = null
    }
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      const pixels = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaMode === 2 ? event.deltaY * 400 : event.deltaY
      const v = view.current
      v.distanceScale = MathUtils.clamp(v.distanceScale * Math.exp(pixels * 0.0012), 0.68, 1.5)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'KeyC' || event.repeat) return
      // Behind the fox: the camera sits opposite its heading (sin h, cos h).
      const v = view.current
      v.orbitYaw = heading.current + Math.PI
      v.orbitPitch = 0
      v.distanceScale = 1
      v.recenterId++
    }

    domElement.addEventListener('pointerdown', onPointerDown)
    domElement.addEventListener('pointermove', onPointerMove)
    domElement.addEventListener('pointerup', onPointerUp)
    domElement.addEventListener('pointercancel', onPointerUp)
    domElement.addEventListener('lostpointercapture', onPointerUp)
    domElement.addEventListener('wheel', onWheel, { passive: false })
    window.addEventListener('keydown', onKeyDown)
    return () => {
      domElement.removeEventListener('pointerdown', onPointerDown)
      domElement.removeEventListener('pointermove', onPointerMove)
      domElement.removeEventListener('pointerup', onPointerUp)
      domElement.removeEventListener('pointercancel', onPointerUp)
      domElement.removeEventListener('lostpointercapture', onPointerUp)
      domElement.removeEventListener('wheel', onWheel)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [domElement])

  // Player writes its fixed follow at -1 and publishes info.player; this overrides
  // it at -0.5, so it always runs after Player and before Ecctrl's priority-0
  // callback, which reads the camera for W direction, whatever the mount order.
  useFrame(({ camera }, delta) => {
    const player = readPlayer()
    if (!player) return
    const previous = last.current
    if (previous) {
      const dx = player.x - previous.x
      const dz = player.z - previous.z
      // Ignore jitter; a moving fox faces its horizontal travel direction.
      if (dx * dx + dz * dz > (0.5 * delta) ** 2) heading.current = Math.atan2(dx, dz)
    }
    last.current = player
    rig.update(player, view.current, Math.min(delta, 0.1), tune)
    camera.position.copy(rig.position)
    camera.lookAt(rig.aim)
    camera.updateMatrixWorld()
    // Only claim the camera once this rig has actually placed it.
    if (!published.current) {
      setInfo('camera', 'cloudkeep')
      published.current = true
    }
  }, -0.5)

  return null
}

export default function CloudkeepCam() {
  return <><CloudkeepCamera /><FeelContent /></>
}
