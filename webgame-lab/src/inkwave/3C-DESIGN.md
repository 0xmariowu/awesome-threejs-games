# The integrated INKWAVE 3C design

This note is about the actual source pipeline, not a recipe for adding a smoothing constant to every value.

## Responsibilities and the frame contract

| Stage | Input | Output | What must remain coordinated |
| --- | --- | --- | --- |
| `player.js` | Keyboard/mouse/gamepad, camera orientation | World-space movement intent, look angles, aim point, action intent | Movement direction follows camera yaw. Mouse look remains direct. Aim ray is derived from the rendered camera. |
| `actor.js` | Intent, tuning, physical support and paint query | Physical position/velocity, grounded/climbing/form state, buffered actions | Collision is authoritative; input is intent rather than an animation request. |
| Actor `_finishFrame` | Physical state and accumulated discontinuities | Visual root plus normalized `AnimState` | `smoothY` softens a step without moving the physical capsule off its support. |
| `character.js` | Visual root, animation state, world ground queries | Feet, hips, body/arms/head, hair/tank/weapon motion; footstep events | The animation reads actual root travel; planted feet are world-locked rather than merely cycling a local clip. |
| `cameraRig.js` | `actor.visualPos`, velocity, form, landings, obstacle queries | Final camera transform/FOV | The pivot follows the visible actor, while velocity anticipates motion to limit steady tracking lag. |
| Presentation events | Hit, footstep, recoil, shake and state changes | Audio, FX and HUD feedback | Event facts are shared; each presentation consumer owns its timing and lifetime. |

The demo runs this chain at 120 Hz inside one external render callback. This changes scheduling, not the source motor equations. Mouse deltas are consumed once, not repeated for each substep. The camera is updated after movement and pose; the next controller query sees the last rendered orientation. That frame relationship matches the source's feedback loop and avoids inventing a separate invisible aiming camera.

## Actor: responsiveness without abrupt motion

Source entry points: `_horizontal`, `_integrate`, `_probeGround`, `_face`, `_finishFrame` and `visualPos`. `_horizontal` now delegates to the exact extracted `stepLocomotion` kernel.

- **Intent buffering:** reference `jumpBuffer = 0.13 s` and `coyoteTime = 0.12 s` tolerate presses just before contact or just after leaving an edge. These are tunable rules, not render delays.
- **Speed and heading:** ground movement uses a scalar speed curve and separately slews the velocity direction. Ordinary turns keep momentum; large reversals brake through zero.
- **Asymmetric states:** grounded run, air, dry squid and submerged swim have distinct acceleration, braking and turn rules. Firing and weapon wind-up affect requested speed.
- **Support:** the ground probe samples a footprint, distinguishes walkable surfaces, and collaborates with capsule contacts. Step and ledge movement have physical collision handling.
- **Visual discontinuities:** when physics raises the body onto a step, `smoothY` compensates the visible root and then settles. The character and camera both consume that visible position.
- **State coupling:** ink ownership changes movement/refill/damage; animation receives the resulting state. The portable planar motor has no paint dependency, while the full Actor still does.

A plain “velocity = input × speed” baseline removes all of these relationships. It is useful for comparison, but not a faithful substitute for the source controller.

## Character: animation is a model of the moving body

Source order: root tracking → form/state weights → foot planning → layered pose → rig application → secondary motion.

- `_trackRoot` measures motion of the actual visual root and derives velocity/acceleration/turn information.
- `_updateFeet` predicts placements, locks stance feet in world coordinates, plans swing/settle steps and queries ground. Cadence, duty cycle and lift respond to speed.
- Pose layers add locomotion, aim and weapon holds, recoil, airborne anticipation, landing, one-shots, facial motion and form blending.
- Rig application includes leg solving and hip compensation; secondary springs add hair, clothing, tank and weapon response.
- Footstep events come from placement rather than a separate unrelated timer, allowing sound to align with the feet and queried surface.

This is a bespoke procedural rig. Reusable mechanisms and dependencies are now explicit, but its bone names/proportions and shape assets remain reference-specific. A different character requires mapping the rig contract or reusing the planners with a new pose adapter.

The lab separately toggles foot planting, the entire procedural pose and Actor's visual step smoothing. The live panel reports planted/swing feet, cadence, hip offset, physical/visual Y and jump buffers. Freezing the whole pose is an intentionally crude diagnostic baseline; it is not proposed production behavior.

## Camera: smooth motion with a stable point of attention

- Exact critically damped springs track pivot axes. Horizontal following uses **72% velocity feed-forward** with source frequency 30 in ordinary follow; it anticipates motion rather than merely adding lag.
- Vertical policy is state-dependent: grounded/ramp support follows firmly, ordinary upward hops preserve the horizon more softly, falls track downward more firmly.
- Landing adds an underdamped dip. The source uses substeps to stabilize that spring at larger timesteps.
- The obstacle boom queries hard line of sight and a wider soft probe. It retracts quickly and releases slowly; floor clearance and close shoulder offset handle edge cases.
- Form changes affect pivot height, boom and FOV. Recoil is a separate pitch spring. Trauma shake uses continuous low-frequency noise, not a new random direction each frame.
- The crosshair and controller use the rendered camera. Any adapter that points the shot from a different pose must consciously resolve that discrepancy.

The source tolerates limited trailing beyond a hard obstruction while level-material transparency covers the character. Its hard limit is not a promise that the camera can never momentarily be occluded. A game without that see-through material should retune the constraint rather than copying only the camera file.

## Test the coupling, not just the idle pose

The `inkwave-3c` route provides checkpoints for:

| Checkpoint / action | Observe | Remove one mechanism |
| --- | --- | --- |
| Start, move then release/reverse | Acceleration, brake and turn behavior | Adjust requested run speed; source motor has plain-object and isolation tests |
| Steps, walk forward | Physical root steps while visual root settles; camera remains readable | Toggle visual step smoothing |
| Ramp, walk and stop | Feet conform and settle on the incline | Toggle foot planting |
| Wall, hold Shift + forward on own ink | Motor state becomes climb; pose and camera height follow it | Observe form and physical/visual Y |
| Edge, walk off then jump | Coyote window and falling camera policy | Inspect coyote milliseconds and jump event |
| Jump/land | Pose, camera dip and foot contact resolve together | Compare spring camera with direct follow |

Preserve this order when migrating: first motor/support correctness, then visual-root correction, then feet/body pose, then camera, then sound/FX. Tune against the same repeatable course. A smooth camera cannot repair unstable support, and polished animation cannot conceal a controller that misses intent.
