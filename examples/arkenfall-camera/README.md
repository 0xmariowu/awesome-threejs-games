# Arkenfall lock-on camera

Run from the Gameref root:

```sh
node tools/server.mjs examples/arkenfall-camera
# http://127.0.0.1:8112/
node --test examples/arkenfall-camera/*.test.mjs
python3 examples/arkenfall-camera/test_browser.py
```

No build, npm install or external requests are needed. The page fills its container, including the library's 16:9 iframe.

Click the scene and press **Tab** or **middle mouse** to lock the gold target. Hold **D** to circle past the wall and tree; **A** circles back. **W/S** move toward/away from the target. Arrow keys also move. Drag the mouse to orbit freely or offset the locked view. These bindings and mouse sensitivity follow the original game. The overhead helper shows the cyan player, gold target and white camera; the arm turns orange when shortened, with a dashed extension marking the obstructed desired position. The two buttons hide the helper and return to the start.

## Isolation and provenance

Five complete deployed modules are copied byte-for-byte from `arkenfall/public/assets/` into `original/`:

- `camera-CsWg7FPD.js`: camera factory, lock tracking, aim bias, multi-ray wall avoidance, trunk intervals and angular dodging, arm contraction/extension, pivot/floor/ceiling constraints, FOV and recovery.
- `math-CaZ96FWb.js` and `contracts-CvM_HOZo.js`: original math and update order.
- `three.core-_y2F91K_.js` and `three.module-DGcYoYN8.js`: the game's original Three.js math and WebGL renderer.

`provenance.json` pins all copies and archive sources. The provenance test re-hashes both. It also pins three reference-only modules: `Game-BmRmdldn.js`, `material-Di0Yd9td.js` and `combat-DANZZ0C7.js` for the sensitivity, fade contract and lock controls. Originals are never rewritten or transformed.

The HTML import map routes two imports to explicit host shims. `game-shim.js` exposes only the original sensitivity export `i = {x: 0.0022, y: 0.0019}`. `material-shim.js` provides the shared `r.uFade` uniform that the camera writes; the host uses its value as the cyan pawn's opacity. This avoids importing the full Game dependency graph and character shader. `three.js` only gives readable names to the archived vendor exports.

`src/host.js` supplies a flat terrain, a raycast service for one wall, a nearby-trunk query and a single target with `aimPoint()`. The tree uses the original `camera:false` / `tag:'trunk'` descriptor so the original camera performs its own trunk intersection and dodge logic. All camera transforms and avoidance decisions come from `camera.update()`. The host creates simple geometry, renders it, collects input and moves the player fixture; locked strafing preserves its radius so the technique can be observed repeatedly. No original artwork is needed for this small scene.

## Verification and limits

`window.__example` is a read-only snapshot of original `debugStats()` plus precise camera/player positions, yaw, pitch, camera-arm lengths, lock-dodge angle, target screen coordinates, fade and elapsed time. It exposes no test setters. Browser tests use real input, collect this state and save screenshots under `screenshots/`. They start and stop their own server on 8112 and fail if that port is already occupied or zero tests ran.

The original combat target scoring/cycling, player movement controller, combat, boss/cave/swim framing, cutscene handoff, gamepad and touch are outside this fixture. Locking chooses the only target; it does not reproduce combat's target-selection algorithm. This verifies the isolated camera scene, not full-game parity. WebGL 2 and a keyboard/mouse are required. Maturity remains `extracted-unverified` as requested. The archive has no confirmed project-wide reuse license; this example does not assign one to the original modules.
