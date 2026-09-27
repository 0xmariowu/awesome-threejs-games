# SCORCH arcade racing

Drive the original KRAKEN pod on SCORCH's procedural desert circuit. Throttle, braking, reverse, speed-dependent steering, lateral slip, boost energy, off-road drag, barrier response and banking run through the archived game code. The example opens directly into driving and fits a 16:9 project-page iframe.

From the repository root:

```sh
node examples/scorch-racing/build.mjs
node tools/server.mjs examples/scorch-racing
# http://127.0.0.1:8115/
node --test examples/scorch-racing/*.test.mjs
python3 examples/scorch-racing/test_browser.py
```

Click the scene to focus it. W / Up accelerates; S / Down brakes, then reverses; A D / Left Right steers; Shift / Space boosts. R resets. Slow motion runs at 0.25×. Direction helpers show heading in cream and velocity in cyan.

## Original source and isolation

`original/index.html` is a byte-for-byte copy of `scorch-podracer/public/index.html`, pinned to SHA-256 `2dbb6cb98d570211867f6aa2ea2a69d3ad0675dddd270e3a963d43e2846e4c0e`. This archive contains one inline game script and an embedded Three.js r158 bundle; it has no separate game module files.

`provenance.json` records the archive path, full-file hash, and byte offsets plus hashes for seven complete declaration blocks and the embedded vendor script. `build.mjs` selects those bytes without replacement or transpilation, adding only host imports and an export list. The blocks contain:

- Math, quality settings, palette and shader uniforms.
- Original procedural pod geometry/textures, terrain, track tables, queries, hills, scenery and boost pads.
- Race constants, barrier meshes, `Racer`, `yawCap`, `landed`, `impact` and `stepRacer`.
- Original `playerInput` and `poseRacer`, including steering/slide banking and engine flame response.

The host calls `stepRacer` and `poseRacer` at 120 Hz. It creates one original pod, mounts the original scenery, supplies keyboard state to the original input mapping, and exposes read-only snapshots through `window.__example`. The new chase camera and Chinese controls belong to the host. Audio, toast, particle and postprocessing calls have inert adapters in `src/shims.mjs`; the original texture generator receives the real host renderer for its anisotropy query. No force coefficient, track query or banking formula is replaced.

No bundler or package installation is needed. Packaging writes only to this example's `public/` and verifies the archive and copied original before and after writing. All visual assets are procedural source from the pinned HTML; there are no external requests or copied fonts. The generated files are included so the library can launch the example directly.

## Verification and limits

The Node tests verify the full original, every selected block, parsable declaration boundaries, tamper rejection, generated source preservation and the unchanged archive after packaging. The browser suite owns its server on port 8115 and uses installed Chrome headless. It checks real keyboard acceleration, coasting, braking/reverse, boost consumption/recharge, steering in both directions, banking/slip, off-road movement, barrier bounds, slow motion, helpers, reset, focus loss and input inside a 16:9 iframe. Page/console errors, failed requests, external requests and zero executed tests fail the run. Screenshots are saved in `screenshots/`.

This is one driving-technique example, without race opponents, menus, pickups, audio, smoke particles or the original postprocessing pipeline. Full race completion, all six pod variants, gamepad and touch input are not certified. Catalog maturity remains `extracted-unverified`; these checks do not claim full-game parity.

Original reference: https://scortch-podracer.netlify.app/. The archive records no project-wide license; this example does not grant new reuse rights. The embedded Three.js license notice remains in the copied source and packaged vendor script.
