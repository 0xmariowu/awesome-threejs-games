// Tank-game camera ported from Kevin-Liu-01/Claude-of-Tanks src/engine/cameraRig.ts
// (MIT engine code, Copyright (c) 2026 Kevin B. Liu). Only the arcade orbit's feel
// logic is ported: a spring-followed pivot (1 - exp(-dt / tau)), discrete wheel zoom
// steps with a smooth distance lerp, collision pull-in along the pivot -> camera ray
// padded by the hit normal, a minimum clearance above the ground, and the uphill
// framing assist (probe the ground ahead, lift the camera and part of the look
// target). Sniper mode, aim, shake and cinematics are not ported, and nothing from the
// repo's reserved src/vehicles or src/world is used. Upstream samples a terrain
// heightfield; here both the height probes and collision are Rapier ray casts.
//
// Upstream licence (Claude-of-Tanks LICENSE):
//
// MIT License
//
// Copyright (c) 2026 Kevin B. Liu
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useRapier } from '@react-three/rapier'
import { useControls } from 'leva'
import { MathUtils, Vector3 } from 'three'
import { setInfo } from '../lab'
import { FeelContent } from './feel'

type Point = { x: number; y: number; z: number }
type Tune = { stiffness: number; margin: number; assist: number; levels: number; near: number; far: number }

const PITCH_MIN = MathUtils.degToRad(-65)
const PITCH_MAX = MathUtils.degToRad(30)
const SENSITIVITY = 0.0022 // rad per dragged pixel, upstream BASE_SENS
// Upstream sits the pivot 2.5 m above a ~2.4 m turret; the fox is ~1 unit tall and
// its body centre is ~0.63 above its feet, so this puts the pivot just over its ears.
const PIVOT_ABOVE_BODY = 0.6
const DIST_LERP_TAU_S = 0.15
const CLIMB_PROBE_N = 5
const CLIMB_PROBE_RANGE = 1.6 // x orbit distance probed ahead of the pivot
const CLIMB_FULL_RAD = 0.3
const CLIMB_LIFT_MAX = 0.42 // x orbit distance, scaled by the Leva strength
// Upstream measures rise above the pivot line; this course's 1-2 m ramps never clear
// a line over the fox's ears, so rise is measured from roughly its shoulder instead.
const CLIMB_REF_ABOVE_GROUND = 0.5
const CLIMB_GATE_DIST = 1.5 // upstream 9 m for a ~7 m hull; ~1.5 fox lengths here
const CLIMB_GATE_LO_RAD = 0.05
const CLIMB_GATE_HI_RAD = 0.16
const CLIMB_LOOK_FRAC = 0.45
const CLIMB_TAU_S = 0.35
const MIN_CLEARANCE = 0.3 // upstream 1 m above terrain, rescaled to the fox
const WHEEL_NOTCH_PX = 100

function readPlayer(): Point | null {
  const player = window.__LAB__?.info.player
  if (!player || typeof player !== 'object') return null
  const { x, y, z } = player as Record<string, unknown>
  if (typeof x !== 'number' || typeof y !== 'number' || typeof z !== 'number') return null
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return null
  return { x, y, z }
}

// Geometric spacing like upstream's [24, 18, 13, 9, 6, 4]; index 0 is the farthest.
function zoomSteps(tune: Tune): number[] {
  const far = Math.max(tune.far, tune.near)
  const count = Math.max(2, Math.round(tune.levels))
  return Array.from({ length: count }, (_, i) => far * (tune.near / far) ** (i / (count - 1)))
}

function TankCamera() {
  const domElement = useThree((state) => state.gl.domElement)
  const { world, rapier } = useRapier()
  const tune = useControls('Tank camera', {
    stiffness: {
      value: 10, min: 1, max: 40, step: 0.5, label: 'Spring stiffness',
      hint: 'k in 1 - exp(-dt * k) for the pivot follow; upstream tau 0.1 s = 10.',
    },
    margin: {
      value: 0.2, min: 0, max: 1, step: 0.01, label: 'Collision margin',
      hint: 'Distance kept off a blocking surface along its normal.',
    },
    assist: {
      value: 1, min: 0, max: 2, step: 0.05, label: 'Uphill assist',
      hint: 'Scales the max climb lift (0.42 x orbit distance at 1).',
    },
    levels: { value: 4, min: 3, max: 4, step: 1, label: 'Zoom levels' },
    near: { value: 4, min: 2, max: 8, step: 0.1, label: 'Nearest zoom' },
    far: { value: 10, min: 5, max: 20, step: 0.1, label: 'Farthest zoom' },
  })
  const steps = useMemo(() => zoomSteps(tune), [tune])
  const [scratch] = useState(() => ({
    pivot: new Vector3(), target: new Vector3(), view: new Vector3(), desired: new Vector3(),
    ray: new Vector3(), look: new Vector3(),
  }))
  // Yaw 0 looks along +Z with the camera behind the fox on -Z, matching feel's follow.
  const aim = useRef({ yaw: 0, pitch: -0.45 })
  const zoom = useRef({ step: 1, wheel: 0 })
  const state = useRef({ initialized: false, dist: 0, climbLift: 0 })

  useEffect(() => {
    const timer = setTimeout(() => setInfo('camera', 'tank'), 0)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    let drag: { id: number; x: number; y: number } | null = null
    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return
      domElement.setPointerCapture(event.pointerId)
      drag = { id: event.pointerId, x: event.clientX, y: event.clientY }
    }
    const onPointerMove = (event: PointerEvent) => {
      if (drag?.id !== event.pointerId) return
      // Screen-right is world -X when looking along +Z, so a right drag lowers yaw.
      aim.current.yaw -= (event.clientX - drag.x) * SENSITIVITY
      aim.current.pitch = MathUtils.clamp(
        aim.current.pitch - (event.clientY - drag.y) * SENSITIVITY, PITCH_MIN, PITCH_MAX,
      )
      drag.x = event.clientX
      drag.y = event.clientY
    }
    const onPointerUp = (event: PointerEvent) => {
      if (drag?.id === event.pointerId) drag = null
    }
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      const pixels = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaMode === 2 ? event.deltaY * 400 : event.deltaY
      // Whole notches only, at most 3 per event as upstream; trackpads accumulate.
      const z = zoom.current
      z.wheel += pixels
      const notches = Math.trunc(z.wheel / WHEEL_NOTCH_PX)
      if (notches === 0) return
      z.wheel -= notches * WHEEL_NOTCH_PX
      // Wheel up (negative deltaY) steps in toward the nearest level.
      z.step -= MathUtils.clamp(notches, -3, 3)
    }

    domElement.addEventListener('pointerdown', onPointerDown)
    domElement.addEventListener('pointermove', onPointerMove)
    domElement.addEventListener('pointerup', onPointerUp)
    domElement.addEventListener('pointercancel', onPointerUp)
    domElement.addEventListener('lostpointercapture', onPointerUp)
    domElement.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      domElement.removeEventListener('pointerdown', onPointerDown)
      domElement.removeEventListener('pointermove', onPointerMove)
      domElement.removeEventListener('pointerup', onPointerUp)
      domElement.removeEventListener('pointercancel', onPointerUp)
      domElement.removeEventListener('lostpointercapture', onPointerUp)
      domElement.removeEventListener('wheel', onWheel)
    }
  }, [domElement])

  // Priority -0.5 sits between Player's fixed follow (-1), which publishes
  // info.player, and Ecctrl's priority-0 callback, which reads the camera direction
  // for W. R3F sorts subscribers numerically, so this holds even though the camera
  // must mount inside <Physics> (for useRapier), after Ecctrl in effect order.
  useFrame(({ camera }, delta) => {
    const player = readPlayer()
    if (!player) return
    const dt = Math.min(delta, 0.1)
    const { pivot, target, view, desired, ray, look } = scratch
    const s = state.current
    const z = zoom.current
    z.step = MathUtils.clamp(z.step, 0, steps.length - 1)
    const orbit = steps[z.step]
    // Dynamic bodies are the fox's own capsule and loose props; like upstream's
    // world-only collision ray, the camera ignores them. Sensors are ignored too.
    const flags = rapier.QueryFilterFlags.EXCLUDE_DYNAMIC | rapier.QueryFilterFlags.EXCLUDE_SENSORS
    const groundAt = (px: number, pz: number, fromY: number, fallback: number) => {
      const hit = world.castRay(new rapier.Ray({ x: px, y: fromY, z: pz }, { x: 0, y: -1, z: 0 }), 30, true, flags)
      return hit ? fromY - hit.timeOfImpact : fallback
    }

    target.set(player.x, player.y + PIVOT_ABOVE_BODY, player.z)
    if (!s.initialized) {
      pivot.copy(target)
      s.dist = orbit
      s.initialized = true
    } else {
      pivot.lerp(target, 1 - Math.exp(-dt * tune.stiffness))
      s.dist += (orbit - s.dist) * (1 - Math.exp(-dt / DIST_LERP_TAU_S))
    }

    const { yaw, pitch } = aim.current
    const cp = Math.cos(pitch)
    view.set(Math.sin(yaw) * cp, Math.sin(pitch), Math.cos(yaw) * cp)
    desired.copy(pivot).addScaledVector(view, -s.dist)

    // Uphill framing assist: how steeply does the ground ahead rise, gated on the
    // ground just ahead of the fox actually rising so a far wall is not a climb.
    const fx = Math.sin(yaw)
    const fz = Math.cos(yaw)
    const probeY = pivot.y + 3
    const hHere = groundAt(pivot.x, pivot.z, probeY, player.y - 0.63)
    const refY = hHere + CLIMB_REF_ABOVE_GROUND
    let rise = 0
    for (let i = 1; i <= CLIMB_PROBE_N; i++) {
      const d = (i / CLIMB_PROBE_N) * s.dist * CLIMB_PROBE_RANGE
      const a = Math.atan2(groundAt(pivot.x + fx * d, pivot.z + fz * d, probeY, hHere) - refY, d)
      if (a > rise) rise = a
    }
    const hNear = groundAt(pivot.x + fx * CLIMB_GATE_DIST, pivot.z + fz * CLIMB_GATE_DIST, probeY, hHere)
    const nearPitch = Math.atan2(hNear - hHere, CLIMB_GATE_DIST)
    const gate = MathUtils.clamp((nearPitch - CLIMB_GATE_LO_RAD) / (CLIMB_GATE_HI_RAD - CLIMB_GATE_LO_RAD), 0, 1)
    const liftTarget = MathUtils.clamp(rise / CLIMB_FULL_RAD, 0, 1) * gate * s.dist * CLIMB_LIFT_MAX * tune.assist
    s.climbLift += (liftTarget - s.climbLift) * (1 - Math.exp(-dt / CLIMB_TAU_S))
    if (s.climbLift > 1e-3) desired.y += s.climbLift

    // Collision pull-in: pivot -> desired camera position.
    ray.copy(desired).sub(pivot)
    const wanted = ray.length()
    let pulled = false
    if (wanted > 1e-4) {
      ray.multiplyScalar(1 / wanted)
      const hit = world.castRayAndGetNormal(new rapier.Ray(pivot, ray), wanted, true, flags)
      if (hit) {
        desired.copy(pivot).addScaledVector(ray, hit.timeOfImpact)
        desired.x += hit.normal.x * tune.margin
        desired.y += hit.normal.y * tune.margin
        desired.z += hit.normal.z * tune.margin
        pulled = true
      }
    }

    // Auto height: never let the camera sink into the ground behind the fox.
    const minY = groundAt(desired.x, desired.z, desired.y + 2, -Infinity) + MIN_CLEARANCE
    if (desired.y < minY) desired.y = minY

    camera.position.copy(desired)
    camera.up.set(0, 1, 0)
    look.copy(pivot)
    if (s.climbLift > 1e-3) look.y += s.climbLift * CLIMB_LOOK_FRAC
    camera.lookAt(look)
    camera.updateMatrixWorld()

    const round = (value: number) => Math.round(value * 1000) / 1000
    setInfo('tankCam', {
      step: z.step, levels: steps.map(round), orbit: round(s.dist), wanted: round(wanted),
      distance: round(camera.position.distanceTo(pivot)), pulled, climbLift: round(s.climbLift),
    })
  }, -0.5)

  return null
}

export default function TankCam() {
  return <FeelContent><TankCamera /></FeelContent>
}
