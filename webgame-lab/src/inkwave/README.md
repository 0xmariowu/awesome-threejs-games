# INKWAVE technology breakdown

Nine executable experiments live in the lab's **Inkwave 技术拆解** collection. Start with `?scene=inkwave-3c&backend=webgl`. The upstream game stays unchanged.

This is a source-preserving extraction plus small portable kernels, not a full-game embed. Reference art, tuning and gameplay remain recognizably INKWAVE. The experiments expose boundaries that another game can replace.

## Start with the complete 3C loop

The three central files are [actor.js](runtime/game/actor.js), [character.js](runtime/game/character.js), and [cameraRig.js](runtime/game/cameraRig.js). They are one coordinated system. Read [3C-DESIGN.md](3C-DESIGN.md) before transplanting any one of them.

```text
Keyboard / mouse / gamepad
  → PlayerController: camera-relative intent, raw mouse aim, buffered actor actions
  → Actor: velocity shaping, capsule collision, support/steps, form/ink state
  → AnimState + visual root (physical position + step offset)
  → Character: world-locked feet, layered pose, springs, two-bone legs, secondary motion
  → CameraRig: visual position + velocity feed-forward + vertical policy + obstacle boom
  → rendered camera defines the next aim ray

World events → particles / sound / recoil / hit marker
```

The host uses one R3F frame callback with a bounded 120 Hz simulation. INKWAVE's source motor is not claimed to be analytically timestep invariant. Fixed stepping makes its integration consistent across presentation rates; the camera's constant-target critical spring has an exact solution. No interpolation or network prediction is claimed here.

## Experiments and source boundaries

| Scene | What actually runs | What to compare or change | Reuse boundary |
| --- | --- | --- | --- |
| `inkwave-3c` | Original actor, physics, character, player and camera factories, plus a Fox GLB clip adapter | Replay the same tuned/baseline route; switch source/GLB presentation; steps/ramp/wall/ledge checkpoints; planted feet; visual step smoothing; full pose; direct vs spring camera; speed | Generic planar motor and springs; reference Actor/Character contracts |
| `inkwave-materials` | Texture-array generator, PhysicalMaterial shader injection, wet paint, procedural environment, HDR bloom and source grade | No AO / baked AO / realtime GTAO; day/sunset, post on/off, base roughness, wet coating | Renderer-specific material library and environment presets |
| `inkwave-ui` | Original Menus, complete SVG art, typography, textured panels, ink fill, spring cursor and results | Nine source screens, editable sample settings/loadout, two palettes, three wipes, keyboard, play/skip/cancel | Injected game API, scoped container-sized styles, owned timers and presentation |
| `inkwave-paint` | GPU atlas + CPU ownership grid + a moving query probe | Paint with either owner; territory / hazard / boost / recovery policies change probe speed, damage and energy | Store surface facts separately from game rules and colors |
| `inkwave-combat` | Four weapons, real projectiles/hits, FX hooks, shake/recoil/hit event subscribers | Shoot, throw, weapon changes; impact/charged/nova feedback recipes with independent particle/camera/sound switches and cancellation | Events convey facts; consumers choose presentation |
| `inkwave-ai` | Original turf BotBrain or rescue policy, same A* graph and motor | Goal policy and live bot goals/paths; navigation samples | Objective scoring and movement are separate; rescue is a small second-use example |
| `inkwave-world` | Layout-derived geometry/collision/faces/nav; seeded PropKit batches | Prop seed, structural wireframe, nav points, actual mesh/triangle counts | One structural layout feeds several systems; dressing is separate |
| `inkwave-audio` | Independent AudioEngine/MusicEngine, synthesized SFX and adaptive score | User-gesture audio start, sound, track, intensity, stop | No downloaded sound files; owned AudioContext and subscription lifetime |
| `inkwave-diagnostics` | Real simulation clock and renderer metrics | Median/P95/max frame interval; pause, one fixed tick, time scale, actor load, dispose/rebuild | Host owns scheduling; world owns subscriptions/input/resources |

### Smaller mechanisms inside those nine experiments

The reusable ideas are finer-grained than the scene list:

1. Camera-relative intent independent of body yaw.
2. Buffered jump, coyote window, and buffered fire across form changes.
3. Speed/heading separation for eased acceleration and carve-like turns.
4. Brake-through-zero reversal instead of an instantaneous facing flip.
5. Physical vs visible root positions at discontinuous steps.
6. Grounded feet in world coordinates, predictive stepping and layered poses.
7. Critically damped tracking with velocity feed-forward.
8. Different vertical camera policies for hops, falls, landings and form changes.
9. Soft/hard obstruction probes with fast retract and slow release.
10. Rendered-camera aim as the common reference for crosshair and shot targeting.
11. Procedural texture arrays, anti-tiling and material metadata.
12. A single base surface with an independent wetness/ownership overlay.
13. CPU gameplay representation separate from the GPU's decorative detail.
14. Fresh-paint sheen and spreading/dripping as time-dependent material state.
15. Color grading that reduces hue distortion for saturated team colors.
16. Event-driven presentation and independent feedback consumers.
17. Objective utility scoring, crowd penalties and navigation as separate decisions.
18. Layout-derived physical/render/paint/navigation representations.
19. Deterministic prop variation and material batching.
20. Composable UI feedback, transition midpoints and skippable cue timelines.
21. Surface-aware procedural audio and constrained voice budgets.
22. Music intensity layers, transition fades and music ducking.
23. Bounded fixed-step time, visible overload loss and explicit single stepping.
24. Per-world input, event, audio and GPU lifetime ownership.

Some upstream systems remain research-only: match progression, profile persistence, onboarding, full HUD/minimap, authored map dressing, baked lightmaps and 3D match cinematics. The lab does not claim these have been fully extracted. The CameraRig retains orbit/path/spectate methods, but the current 3C experiment validates follow mode.

## Public modules

### No Three.js, DOM or game dependency

- [motion/locomotion.js](runtime/motion/locomotion.js): `stepLocomotion(state, tuning, dt, policy)`; mutates planar velocity, never position. A plain-object consumer is tested in `source.test.js`.
- [motion/springs.js](runtime/motion/springs.js): `CriticalSpring` and `stepDamped`. The live source camera imports these kernels.
- [systems.ts](systems.ts): `EventBus`, `SimulationClock`, `DampedSpring`, `CueTimeline`, objective scoring, surface-response policy. The policy weights and hazard rule are explicit illustrative defaults, not universal game balance.

```js
import { stepLocomotion } from './runtime/motion/locomotion.js';
import { PLAYER } from './runtime/config.js'; // reference tuning; replace per game

const body = {
  intent: { move: { x: 1, z: 0 } },
  vel: { x: 0, z: 0 }, grounded: true, submerged: false, hardLand: 0,
};
stepLocomotion(body, PLAYER, 1 / 120, { maxSpeed: 4 });
// Your physics integration consumes body.vel; no Actor or INKWAVE mesh required.
```

### Source-preserving adapters

Each `create*Type(world)` returns a class closing over one supplied world, rather than importing a game singleton. This preserves source scratch-vector ownership and avoids cross-talk between separately tuned worlds. Stateless geometry/material caches are shared reference assets; do not mutate their cached geometry per actor.

```js
const { WeaponRunner, Projectiles } = createWeaponSystems(world);
const Character = createCharacterType(world);
const Actor = createActorType(world, WeaponRunner);
const CameraRig = createCameraType(world);
const PlayerController = createPlayerControllerType(world);
const BotBrain = createBotType(world);
```

`world` supplies `preset`, `events`, `time`, `settings`, `scene`, `camera`, `actors`, `teamColors` (`THREE.Color[]`), `level`, `physics`, `paint`, `nav`, `projectiles`, optional `fx/audio/input`, and a small `match.playing()/canRespawn()` facade. [runtime/demo.js](runtime/demo.js) is the inspected composition example. It is **reference integration**, not a claim that every factory is free of shooter semantics.

For an unrelated game, begin with the smaller kernels. Porting the whole Actor additionally requires the paint, weapons, forms and collision contracts. Porting Character to a different skeleton requires a rig adapter; arbitrary GLTF avatars cannot be dropped into this procedural rig unchanged. The Fox adapter demonstrates clip-based presentation on the same motor/camera; it has no procedural foot IK, weapon grip or squid poses.

### Original menu presentation

[UIGallery.tsx](UIGallery.tsx) mounts the source [Menus](runtime/ui/menus.js) into a stable DOM host. [reference-ui.css](reference-ui.css) retains the source typography, surfaces, art and motion; selectors are scoped to `.ink-ui-stage`. The host needs positioning and `container-type: size`: the source sizing unit is fitted to that container. [inkwave.css](inkwave.css) supplies lab placement and narrow-screen reflow.

```js
const menus = new Menus(host, {
  getSettings: () => settings,
  setSettings: patch => { settings = { ...settings, ...patch }; },
  getLoadout: () => loadout,
  setLoadout: patch => { loadout = { ...loadout, ...patch }; },
  getProfile: () => profile,
  setProfileName: name => { profile.name = name; },
  startMatch: options => startYourGame(options),
  onResultsComplete: () => recordPresentationComplete(),
});
menus.setAccent('#08cadd', '#ff3d5e');
menus.show('main');
// Forward host keydown events to menus.handleKey(event).
// On unmount:
menus.dispose();
```

The gallery uses in-memory sample profile/settings/loadout and result data. Its Play/Rematch actions demonstrate results, not a complete match. Settings changes drive the original UI previews; they do not configure the lab renderer or persist across reloads. Original 3D loadout/podium cinematics are not included. The menu screen content still contains INKWAVE weapon/map/game rules; reuse its feedback, components and transition ownership independently, or replace that content when adopting the full controller. `CueTimeline` remains a separate portable kernel; the restored results screen runs its original choreography.

## Ownership and rendering

`InkwaveDemo` borrows renderer, scene and camera. It creates input listeners through an AbortController, owns the event bus and systems, and exposes `init/frame/snapshot/dispose`. React publishes a telemetry snapshot at 4 Hz instead of rerendering for every simulation tick. The renderer is never replaced by a demo.

The reference uses classic WebGL and GLSL shader injection. It is not a WebGPU/TSL implementation. No global Three shader-chunk patch is applied. The lab includes environment lighting, shadows, bloom, grade and output conversion. The material scene adds its own 512px static AO bake for the training geometry and an optional Three GTAOPass. The original authored map's baked textures and murals are not copied. Smaller texture and shadow sizes keep nine experiments practical.

Paint scoring counts valid CPU cells, not exact mesh area or the final rendered silhouette. Cosmetic satellites/drips and growth timing may differ from the CPU ownership decision. This distinction is deliberate and surfaced in the experiment.

The world gallery's decorative props do not affect collision. Structural boxes/ramps do. PropKit can return colliders for a production assembler; rebuild Level and NavGraph with those colliders when using them.

Audio starts only from a user gesture. A supplied AudioContext is borrowed and disconnected, not closed; an internally created one is closed on dispose. Listening quality is subjective; automated checks validate state and synthesized signal, not musical taste.

## Provenance and verification

Source revision: `11ce48547980b70c26354b7d6b6bc8a15da87351`. See [PROVENANCE.json](PROVENANCE.json), [LICENSE](LICENSE), and [UPSTREAM-NOTICES.md](UPSTREAM-NOTICES.md). Original source hashes are retained; adapters, laboratory policies and demo layouts are listed separately from original assets.

```sh
npm test
npm run build
node scripts/inkwave-audit.mjs --source ../inkwave
# With Vite running on 5199:
node scripts/inkwave-check.mjs
```

See [QA.md](QA.md) for browser interactions, evidence and limitations. Unit tests cover event isolation, independent source motor tuning, source motor use without Three, presentation-rate consistency under fixed simulation, spring settling, geometry-derived obstacle navigation, cue skip/cancel and policy substitution.

## WebGL games route and portable toolkit

Open `?scene=inkwave-3c&backend=webgl&collection=webgl&menu=1`. The WebGL games tab includes the nine INKWAVE scenes, existing WebGL scenes, and individually verified alternate backends for retargeting, tank camera and Rapier joints. It does not imply that TSL/compute examples run unchanged in classic WebGL.

- `runtime/game/clipCharacter.js`: `new ClipCharacter(gltf, {height, idle, walk, run, forwardYaw})`. The supplied GLTF is exclusively owned, not a shared loader-cache object. Each frame set root position/yaw from your motor and call `update(dt, {speed, grounded})`. Clip names, forward axis and scale are per-asset calibration. `dispose()` releases the owned skeleton, textures, materials and geometry. Airborne presentation uses idle when no jump clip exists.
- `runtime/world/bakeAO.js`: `await bakeAO(level, physics, options)` allocates lighting UVs and returns an owned single-channel DataTexture. Bake **before** `level.buildGeometry()`. Pass the result as `lightmap` to `createLevelMaterial`. The 20-ray, 3-texel/metre, 2.4-metre-radius default is a lab quality preset. Static structural geometry only; dynamic characters/props require realtime AO. Cancel on unmount and dispose the texture with its owner. The lab bakes once during loading; a production asset pipeline can serialize this texture offline.
- `runtime/skillSequence.js`: `new SkillSequence(cue => present(cue))`; call `play('charged', context)`, `update(dt)` and `cancel()`. Recipes emit cue facts and have no Three/DOM dependency. The host maps charge/beam/impact/ring to FX, camera and sound. These are presentation recipes, not damage/territory commands; cancelling never emits the remaining impact.
- `systems.ts`: `surfaceResponse(owner, team, policy)` supports turf, hazard, boost and recovery. Recovery uses negative damage for healing and negative refill for drain; consumers clamp resources. The probe is an explicit second consumer; the original Actor retains its original turf rules.
- `runtime/frameStats.js`: `new FrameStats(240)` stores bounded recent presentation intervals. Call `push(dt)` every frame and `snapshot()` at UI telemetry frequency. P95 is the 95th-percentile frame interval, not GPU duration or an across-device performance claim.

The five-second 3C route applies the same timed forward/reverse/jump intent from the steps checkpoint. Tuned enables the source spring camera, step smoothing and foot planting; baseline disables those three presentation features. It reuses the same movement/collision equations. The GLB adapter disables source-only pose controls in the UI.
