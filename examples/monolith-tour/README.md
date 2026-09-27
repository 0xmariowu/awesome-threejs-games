# Monolith Wilds camera handoff

Run from the repository root, with no build or dependency installation:

```sh
node tools/server.mjs examples/monolith-tour
# http://127.0.0.1:8122/
node --test examples/monolith-tour/*.test.mjs
python3 examples/monolith-tour/test_browser.py
```

The example runs the original walking, flying and cinematic-tour camera controllers in a small scene. Press **F** to switch walk/fly or **C** to start/stop the tour. Walking eases down to ground level; stopping a tour transfers its camera orientation and velocity to flight. The tour plans paths around the host's four stone landmarks and runs its own push, pull, orbit, crane and truck moves with bounded turning and FOV blending.

Use WASD to move, drag to look, or click the canvas for pointer lock. Space/Q rise/sink in flight; Space jumps while walking. Shift accelerates, Alt slows flight, and the wheel changes flight speed. Esc releases pointer lock. Moving, clicking or scrolling interrupts a manual tour after the original input grace period. Mode buttons call the original APIs. The slow-motion button scales elapsed time to 0.25× for both controllers.

## Original files and isolation

All six complete files in `original/` are byte copies of the deployed archive modules. `provenance.json` pins each archive path and SHA-256; `provenance.test.mjs` checks both copies and archive sources.

| Original module | Responsibility |
| --- | --- |
| `controls-DX7CeMlr.js` | Input, fly/walk integration, smooth landing, camera handoff |
| `tour-Do76daLD.js` | Stop planning, cinematic moves, transitions, interruption, FOV |
| `obstacles-DQBr1hBF.js` | Obstacle bounds, terrain-aware paths, interpolation and angle helpers |
| `biome-DstsBN7N.js` | Original tree-density query used by tour clearance planning |
| `three.core-DtjtRha-.js` | Archived Three.js math and scene objects |
| `three.module-e53_FFk2.js` | Archived Three.js renderer |

`biome` imports the full game's `index-DGqtqlWq.js`, which boots the game on import. The browser import map redirects **only that dependency** to `src/world-shim.js`. The shim supplies ground height zero. The unchanged biome function returns zero tree density for heights below 1.5, before reading noise, world layout or slope. Its unused imports are guarded with explicit errors; this is not a substitute terrain generator. The full game entry is neither copied nor executed. Camera, input, tour, path and renderer imports resolve to their unchanged originals.

`src/host.js` supplies a flat ground plane, geometry, landmark/viewpoint data, event dispatch, environment fields and the render loop. It calls the original `build(ctx)` exports and runs their updates in original order: tour −110, controls −100. No camera-motion algorithm is implemented in the host. No separate asset files are needed; the scene geometry is new and deliberately simple.

## Verification and limits

`window.__example.state` reports camera position, quaternion, FOV, velocity, mode, grounding, pointer lock, tour segment and planned moves. `samples` retains the last 900 frame snapshots. The tests use these observations and real Playwright keyboard/mouse input, with virtual time advancing every animation frame. They do not call camera methods or mutate technique state. The suite owns its server, rejects external requests and browser errors, and fails if no tests run. Screenshots are saved under `screenshots/` (git-ignored).

The browser suite covers walking/landing/jumping, flight movement/boost/altitude/look, unlocked pointer state on tour entry, every planned move's keyboard interruption, wheel/mouse interruption, momentum handoff, bounded position/rotation/FOV changes, mode buttons, slow motion, a 960×540 viewport and real input inside a 16:9 iframe.

Installed headless Chrome on the development machine rejects native pointer lock with `WrongDocumentError`, with or without virtual time. The tests observe the actual capture attempt and test the original drag-to-look fallback; capture is never mocked. Successful native pointer capture remains unverified here. The example retains the original click-to-capture behavior for browsers that support it.

This example demonstrates camera handoff, not the full game. Ground is flat; decorative meshes do not add walking collision. The original planner sees landmark bounds for transit clearance. Original terrain, vegetation, water, lighting changes, audio, HUD and world assets are excluded. Attract-mode tours, gamepad and touch input remain in the original code but are not browser-tested here. WebGL 2 and a desktop keyboard/mouse are required for the tested controls.

The archive is a deployed site snapshot from <https://monolithwilds.vercel.app/>; it supplies no project license in this snapshot. No new license grant is asserted for the original game modules.
