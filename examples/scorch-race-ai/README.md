# SCORCH look-ahead racing AI

Six original SCORCH pods race the original desert circuit immediately on load. Colored lines connect each pod to its steering target. The target moves farther ahead as speed rises; lane choices, nearby rivals and narrow sections shift it sideways. Click a numbered pod to follow it, toggle slow motion or take over using the original keyboard controls. The host fits the project page's 16:9 iframe.

From the repository root:

```sh
node examples/scorch-race-ai/build.mjs
node tools/server.mjs examples/scorch-race-ai
# http://127.0.0.1:8118/
node --test examples/scorch-race-ai/*.test.mjs
python3 examples/scorch-race-ai/test_browser.py
```

No installation or bundler is needed. Generated ES modules and embedded Three.js are included in `public/`, so the library can launch the example directly. Packaging writes only inside this example and re-hashes the archive and original copy before and after building, including on failure.

## Source boundary

`original/index.html` is a byte-identical copy of `scorch-podracer/public/index.html`, pinned to SHA-256 `2dbb6cb98d570211867f6aa2ea2a69d3ad0675dddd270e3a963d43e2846e4c0e`. SCORCH is deployed as one HTML file with an inline game script and embedded Three.js r158; separate game modules are unavailable.

Following `scorch-racing`, `build.mjs` selects complete declaration blocks by pinned byte offsets and hashes. It adds host imports and exports without changing the selected bytes. The eight blocks preserve:

- Math, quality settings, palette and shader uniforms.
- Procedural pod geometry, textures, track, terrain, scenery, hills, narrow sections and boost pads.
- Race constants and barrier meshes.
- `racers`, `Racer`, `yawCap`, `cornerSpeed`, `landed`, `impact` and `stepRacer`.
- The complete `aiInput` and `collide` functions.
- `playerInput` and `poseRacer`.

The host runs the original AI and physics sequentially for each racer, then original collisions, at a fixed 120 Hz. All six original pod definitions retain their own stats. The original random lane selection and stuck recovery remain active. Unlike the full game's race loop, this host keeps each speed-cap multiplier at 1; it does not apply player-relative catch-up or stop at the results screen.

The new host owns the camera, controls, overview map and colored markers. `src/targets.mjs` reconstructs only the display coordinates from the lane just chosen by `aiInput`, before that racer moves. It never feeds controls or state back into the simulation. A test observes the actual `Math.atan2` arguments inside the unchanged AI and compares them with these coordinates at three speeds and all five narrow sections, with a nearby rival present.

`src/shims.mjs` supplies inert audio, toast, particle and postprocessing adapters and passes the host renderer to the original texture generator. Pod posing uses a distance of 800 to skip discarded particle emission. The scene reuses the original procedural assets; no fonts, network services or external assets are required.

## Controls and observation

- Number buttons select the followed pod. All six pods run on AI by default.
- **接管飞梭** switches the selected pod to original `playerInput`: W / Up accelerates, S / Down brakes and reverses, A D / Left Right steers, Shift / Space boosts. Toggle again to resume AI. Selecting another pod returns all pods to AI.
- **慢动作** changes simulated time to 0.25×; **目标点** toggles the six helper sets.
- **重新出发** or R resets the grid. Keyboard input clears on focus loss. Hidden tabs do not accumulate simulation time.

`window.__example` contains detached snapshots: simulation time and steps, time scale, selected pod, manual mode, helper visibility, track length, and each racer's position, speed, heading, progress, lap, lane, lateral offset, stuck timer, boost state, original input and displayed target. Manual driving hides that pod's AI target. This state is intended for browser assertions, not simulation control.

## Verification and limits

Node tests verify the copied original and archive hashes, each complete source block, tamper rejection and byte-preserving build output. They check the target coordinates against actual AI calls and run six seeded racers for 150 simulated seconds, requiring more than two full laps each, all narrow sections visited, avoidance, braking and changes in race order. Wall-contact samples and maximum stuck time are reported; clean racing without collisions is not promised.

The Python Playwright suite starts and stops its own server on port 8118 and uses installed Chrome headless. It checks automatic progress, speed-dependent targets, real keyboard takeover, braking, steering, boost, AI resumption, slow motion, helper visibility, reset, selecting a pod and input/focus loss in a 16:9 iframe. Console errors, page errors, failed requests, external requests and zero executed tests fail the run. Screenshots go in `screenshots/`.

This is a technique demonstration with a new elevated camera and overview map. It omits menus, pickups, audio, smoke, postprocessing, catch-up balancing and race results. Gamepad mappings remain in the original input function but are not browser-certified; touch driving controls are not supplied. Catalog maturity remains `extracted-unverified`, without a full-game parity claim.

Original reference: https://scortch-podracer.netlify.app/. The archive has no project-wide license; this example grants no new reuse rights. The embedded Three.js notice is preserved in the original and packaged vendor script.
