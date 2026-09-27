# Arkenfall melee training

This example runs Arkenfall's original combat against one training target: four-hit combos, buffered input and cancellation windows, swept weapon hits, charged attacks, timed parries and ripostes. The interface is in Chinese and fills the library's 16:9 iframe.

## Run and verify

From the Gameref root:

```sh
node tools/server.mjs examples/arkenfall-combat
# http://127.0.0.1:8116/
node --test examples/arkenfall-combat/*.test.mjs
python3 examples/arkenfall-combat/test_browser.py
```

No build, package installation or external requests are needed. All runtime imports are local ES modules. The browser test starts and stops its own server, requires port 8116 to be free, uses installed Chrome headlessly, and exits nonzero if no tests run.

Left mouse attacks; press again near the cyan cancellation window to continue the chain. Holding right mouse charges a heavy attack; release to strike. **F** parries. These are the original game's bindings. **招架练习** enables a fixture strike every three simulation seconds; the orange rod and countdown announce it. Press F just before contact, then left mouse for a riposte. **慢动作** runs at 0.25×; **挥击轨迹** toggles trail helpers; **重新站位** resets position and health. Buttons return keyboard focus to the scene.

The timing panel reads the original current move's active and cancellation ranges. Gold marks its hit interval, cyan marks when another action can start, and the white cursor shows action progress. The input buffer lasts 0.25 seconds; the parry window lasts 0.18 seconds. Neither constant is duplicated in host decision logic.

## Isolation

`original/` contains eleven complete deployed files copied byte-for-byte from `arkenfall/public/assets/`. `provenance.json` pins each archive path and copy with SHA-256. The tests re-hash both and check that every static import resolves to a copy or an explicit shim.

| Original | Responsibility |
| --- | --- |
| `combat-DANZZ0C7.js` | Attack definitions, procedural combat poses and IK, buffering, combo/charge/parry policies, swept hit queries, once-per-swing hit sets, hit payloads and ripostes. Its original glow effects also render. |
| `player-Dy-PiEeW.js` | Exported `PlayerImpl` prototype: `canAct`, `beginAction`, the private action handle, `updateAction`, `cancelAction`, `onActionInterrupted`, `faceYaw`, and `setState`. |
| `Animator-CyW8ITDY.js` | Original Rig, Animator, clip registry, pose sampling and blending. |
| `Actor-CPc2Vruf.js` | Actors, actor registry, hit construction, health, poise, stagger and knockback velocity. |
| `math-CaZ96FWb.js`, `contracts-CvM_HOZo.js` | Geometry/math helpers and subsystem ordering. |
| `Debug-mAQ8BxhD.js` | Original debug parameters and scenario registration. The fixture does not invoke full-world scenarios. |
| `noise-mHFAXQOi.js`, `rng-R5614gXl.js` | Player module dependencies. |
| `three.core-_y2F91K_.js`, `three.module-DGcYoYN8.js` | The game's own Three.js math and WebGL renderer. |

`src/host.js` creates a plain object inheriting the unchanged `PlayerImpl.prototype`, bypassing its full-world constructor. It supplies the standard bone hierarchy and bind dimensions from the original player's `Ut` table, with simple mesh limbs and a glaive segment from 0.6 to 2.02 units. Original combat clips animate that rig; the original player action handle owns cancellation and elapsed time. No combat method is replaced. Only cosmetic mount, cloth and fidget services are no-ops. Root velocity from the original action update is integrated on a flat floor; the full movement controller is outside this fixture.

Four import-map shims avoid loading the full game:

- `game-shim.js` provides unused world exports. Its physics constructor throws if called.
- `cache-shim.js` satisfies the player's import-time atlas cache read with correctly sized blank arrays. These are never rendered. No worker, IndexedDB or archive write occurs; a cache write throws.
- `settings-shim.js` returns low quality for that unused atlas initialization without reading saved settings.
- `material-shim.js` supplies glow/hurt uniforms. Original body/cloth material factories throw if called; the host meshes use basic local materials.

The replaced modules and the candidate's `anim-exnbZ3yq.js` are pinned as reference-only sources. That tiny `anim` module handles base locomotion blends and is not needed for the combat action path. No external model or texture assets are needed: the visible poses, weapon glow and combat rules are procedural original code; the stage, target, character meshes and trail lines are host geometry.

## Host boundary and evidence

The host supplies real pointer/keyboard events, a fixed 120 Hz loop, actor registration, flat-ground and unobstructed ray queries, and an event bus. It calls the original action update and animator before combat, following the original player-before-combat order. Slow motion scales simulation time without changing the fixed step. Visibility changes discard accumulated time and input. Trails display original `fx.trail` endpoints; they do not determine hits.

The practice target is an anchored original Actor with 10,000 health, 30 poise and mass 1,000. It receives original hit payloads and records health, poise and knockback velocity; its visible wobble is a host effect. Practice attacks are scheduled host inputs to `interceptPlayerHit`, not extracted enemy AI. They restore player health after each strike so timing practice can continue. Original parry direction checks, the 180 ms window, deflection and riposte eligibility decide the outcome.

`window.__example` provides read-only snapshots of move/progress, original windows, queued input, charge, parry/riposte state, positions and combat event history. There are no test setters. Browser tests apply real input to verify the four-hit buffered chain, expired early input, one hit per swing, stagger/knockback, root motion, charged release, missed and successful parries, riposte, helpers, slow motion, a smaller viewport and playback inside a 16:9 iframe. Screenshots are saved in `screenshots/` for visual review. Console errors, page errors and failed requests fail the run.

This fixture omits full-world collision, free movement, dodge/plunge/lash/burst controls, enemy AI, original character artwork, cloth, audio, camera shake and hitstop/slow-motion feedback events. The only time scaling is the host's slow-motion button. It does not claim full-game parity. WebGL 2, mouse and keyboard are required. Catalog maturity remains `extracted-unverified`. The archive has no confirmed project-wide reuse license; this example assigns no license to the copied originals.
