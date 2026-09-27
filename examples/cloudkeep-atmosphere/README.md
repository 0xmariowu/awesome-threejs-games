# Cloudkeep atmosphere

A runnable extraction of `cloudkeep.atmosphere`: the original ray-marched lower cloud layer, high cirrus and six cloud banks. Fly into a bank to see scene fog close around the camera. The Chinese interface fits the library's 16:9 iframe.

## Run and verify

From the repository root:

```sh
node examples/cloudkeep-atmosphere/build.mjs
node tools/server.mjs examples/cloudkeep-atmosphere
# http://127.0.0.1:8111/
```

```sh
node --test examples/cloudkeep-atmosphere/*.test.mjs
python3 examples/cloudkeep-atmosphere/test_browser.py
```

The browser test always builds first, starts its own server on port 8111 and stops it during cleanup. An occupied port fails the test. It uses Python Playwright with installed Chrome headless, blocks external requests, fails on page/console/network errors, and exits nonzero if no tests run. Screenshots are written to `screenshots/`.

## Isolation and provenance

All four files in `original/` are byte-for-byte copies from Cloudkeep revision `b28406d581bfbc3c905c200e552b669f4dd02a15`. `provenance.json` pins each archive path and SHA-256; `provenance.test.mjs` rechecks both sides. `LICENSE` preserves the upstream MIT notice.

| Original | Use |
| --- | --- |
| `atmosphere.ts` | Imported unchanged. Owns procedural 64³ noise, cloud density, ray marching, lighting, render target, six bank positions/radii and `localMist()`. No cloud texture is needed. |
| `input.ts` | Imported unchanged. Owns keyboard, steering drag, free-look, wheel and recenter input. The host supplies `#world`, enables controls and supplies a no-op game-menu shortcut handler. |
| `simulation.ts` | Resolves the input module's `IDLE` dependency. The host does not instantiate the game simulation. |
| `scene.ts` | Reference only; never imported. Its fog-immersion statements at lines 290–293 are adapted in `src/fog.mjs`, avoiding the full game's assets, materials and effects dependencies. |

The fog adapter retains exponential smoothing at rate 2, interpolating near distance from 100 to 3 and far distance from 390 to 75. Its test executes the pinned original statements as an independent reference for entry and exit at 24/60/120 Hz. The toggle disables only this immersion adjustment; the ray-marched clouds remain active.

The candidate's broader materials and pooled-effects mechanisms are outside this extraction. The host does not copy or replace their logic.

## Host and controls

`src/host.ts` supplies a free camera, lights, six landmark placements, resize handling and a small comparison panel. The archived `island-distant.glb` (851,068 bytes) is copied once by the build and reused in all banks so changing visibility is easy to see. Its geometry and materials are unchanged.

W/S flies forward/back, A/D strafes, R/F changes altitude and Shift boosts. Drag steers; right-drag or Alt-drag looks around without changing travel direction. The wheel changes field of view; C resets pitch, free-look and zoom. Arrow keys also steer. Double-click retains the original optional pointer lock; Escape releases it. Clicking the canvas explicitly focuses the iframe so keyboard controls work inline.

The bank selector and reset button place the camera outside a chosen bank. Hold W and Shift to fly inside. The fog toggle compares visibility; the boundary toggle draws the original bank ellipsoids. There is no autoplay or persistence.

Free-camera translation is host code, with speed 28 or 70 scene units per second and frame time capped at 0.1 seconds. It allows every bank to be reached; the original simulation limits travel to a horizontal radius of 104 and altitude 5–44. This host does not reproduce the ship's acceleration, collisions or chase camera.

The renderer keeps the original HDR `RenderPass` → `OutputPass` color path, ACES tone mapping, exposure 1 and DPR cap 1.4. `Atmosphere.resize()` retains its original 0.7 resolution factor and the original render throttling. AO, bloom, billow sprites, audio, creatures and full gameplay are omitted. WebGL 2 and mouse/keyboard input are required.

## Evidence and build ownership

`window.__example` exposes a fresh snapshot after each rendered frame: readiness, frames/time, all bank definitions, selected bank, camera position, yaw/pitch, free-look angles, field of view, speed, local mist, smoothed immersion, fog near/far, toggle states and viewport size. Browser tests only read these values; movement comes from real input. They cover flying into and out of clouds, all six banks, fog comparison, steering, free-look, zoom, recenter, vertical movement, helpers and input in a resized 16:9 iframe.

The build uses Vite and Three.js already present in `cloudkeep/upstream/node_modules`, with `configFile: false` and cache inside this example. No install or write under the archive is needed. It checks pinned originals and assets before building and re-hashes archive sources afterward, including on failure. Repeat builds remove only generated HTML/JS/CSS recorded in `public/.build-files.json`; symlink output paths are rejected. Built output is under `public/`.

Browser checks establish this isolated example's behavior; maturity remains `extracted-unverified` and no full-game visual parity is claimed.
