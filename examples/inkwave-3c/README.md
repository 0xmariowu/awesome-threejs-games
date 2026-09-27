# INKWAVE locomotion and follow camera

Run, jump, change into a squid and swim through the orange ink lane with the original procedural character and follow camera. The practice scene includes steps and solid walls for observing foot placement and camera retraction. The Chinese interface fits the project page's 16:9 iframe.

## Run and verify

From the Gameref root:

```sh
node tools/server.mjs examples/inkwave-3c
# http://127.0.0.1:8124/
```

No build, dependency installation or external requests are needed. Browser import maps load the archived Three.js modules included in this folder.

```sh
node --test examples/inkwave-3c/*.test.mjs
python3 examples/inkwave-3c/test_browser.py
```

The browser test starts and stops its own server; stop a manually running server on port 8124 first. It uses installed Chrome headless through Python Playwright and fails if no tests run. Screenshots are saved in `screenshots/`.

## Controls

- WASD or arrow keys: move relative to the camera.
- Space: jump.
- Hold Shift: squid form; swim faster while on the orange lane, hop slowly on dry ground.
- Click the scene, then move the mouse: turn the original camera. Drag also works when pointer lock is unavailable. Escape releases the pointer.
- 慢动作: toggle quarter speed for both simulation and camera.
- 回到起点: clear held input and return to the dry starting position.

## Isolation and provenance

The 12 files in `original/` are byte-for-byte copies from `inkwave/src/`, preserving relative imports:

- `game/actor.js`: acceleration, braking, turning, jumping, surface/form policy and animation state.
- `game/character.js`, `character-geo.js`, `character-mats.js`, `character-weapons.js`: original procedural meshes, materials, rig and animation. No replacement avatar or model download is used.
- `game/cameraRig.js`: follow springs, velocity lead, landing dip, form-dependent height/FOV, obstruction probes and camera boom.
- `game/player.js`, `core/input.js`: original keyboard, pointer-lock mouse and gamepad input mapping.
- `game/physics.js`: original ground, body and camera collision queries.
- `game/weapons.js`, `config.js`, `core/ctx.js`: the actor's weapon-state dependency, tuning and shared context.

`provenance.json` pins the archive path and SHA-256 of every original, the three runtime dependency files in `vendor/three/`, and both license notices. Tests hash both copies and archive sources, compare the four candidate references, and check that original imports resolve to pinned files. Never edit copied originals.

`src/main.js` initializes the original `G` context and calls input → player controller → actor → camera → aim → render. Like the original main loop, it updates the controller once per frame and splits actor updates in two below 45 fps. The host caps elapsed time at 50 ms, scales it for slow motion, and clears input on blur, pointer unlock and visibility changes. A host drag adapter supplies mouse deltas when native pointer lock is unavailable; sensitivity, pitch limits, movement mapping and camera behavior remain in the originals. `window.__example` exposes a frozen snapshot of actor and camera state for observation; tests use real input rather than mutating it.

`src/world.js` provides new axis-aligned practice geometry, block bounds, one floor face and a fixed ink sampler. The sampler returns own-team ink only within the visible orange lane (`x ∈ [-3, 3]`, `z ∈ [2, 36]`); the original actor determines all dry-squid and swimming behavior. The original physics performs collision response and raycasts. The host supplies scene data rather than replacing locomotion or camera logic.

## Verified scope and limits

Browser tests cover running and braking, jump/landing, dry squid → swimming → human transitions, mouse look, camera-relative motion, wall collision/camera retraction and recovery, slow motion, reset, and operation inside a 16:9 iframe. They fail on page errors, console errors, failed requests and HTTP errors. Installed headless Chrome rejects native pointer lock with `WrongDocumentError`; the test checks for capture or a real rejection, then exercises mouse look through real drag input when necessary. Native pointer capture is not verified on that browser.

The host suppresses combat intents after the original controller runs. It has no combat targets, projectiles, painting, audio, match loop or enemy ink; those are outside this locomotion example. Procedural character visuals are retained, including the original submerged squid ghost. The ink strip is a fixed scene fixture, not the game's GPU painting system. Gamepad controls remain in the originals but are not covered by these browser tests. Wall climbing, super jumps, specials and full-game parity are not claimed. Catalog maturity remains `extracted-unverified`.
