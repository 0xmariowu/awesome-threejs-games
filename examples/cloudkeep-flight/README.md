# Cloudkeep flight and model examples

This local example demonstrates **Airship movement, orbit and input ownership** (`cloudkeep.flight`). Its second page is a turntable for inspecting the GLB outputs of **Reproducible Blender asset pipeline** (`cloudkeep.asset-build`). The interface is in Chinese.

## Run

From the Gameref root, with the archived Cloudkeep dependencies already present:

```sh
node examples/cloudkeep-flight/build.mjs
node --test examples/cloudkeep-flight/provenance.test.mjs
node tools/server.mjs examples/cloudkeep-flight
# Flight: http://127.0.0.1:8103/
# Models: http://127.0.0.1:8103/models.html?model=airship
```

No npm install is needed. The build imports Vite and Three.js from `cloudkeep/upstream/node_modules`; Vite transforms the TypeScript. Both pages run from `public/` with no development server or external requests. `?autostart=1` also works: flight starts as soon as its three GLBs load.

## Original code and host code

`original/simulation.ts`, `original/flight-camera.ts` and `original/input.ts` are byte-identical copies of Cloudkeep revision `b28406d581bfbc3c905c200e552b669f4dd02a15`. Their archive paths, hashes and the 18 GLB hashes are pinned in `provenance.json`. `LICENSE` preserves the original MIT notice. Never edit these copied modules to change the example.

The HTML, CSS, `src/flight.ts`, `src/models.ts`, `src/camera-rig.ts` and build script are new host code. **`src/camera-rig.ts` adapts `cloudkeep/upstream/src/scene.ts` lines 273–289; it is not an original file.** It casts from the ship toward the desired camera, retracts immediately at island meshes, extends smoothly when clear, and blends the aim toward the focus as the arm shortens.

The host follows the fixed 60 Hz accumulator in upstream `main.ts`: clamp real frame time to 0.1 seconds, multiply by the selected time scale, then call `sim.step(1 / 60, controls.read())` for each accumulated step. The camera uses the same scaled frame time. Hidden tabs reset the accumulator. Controls receive a no-op shortcut handler and become enabled only after flight assets load. Events are drained without rendering their effects.

## Flight controls and comparisons

| Control | What to observe |
| --- | --- |
| Drag the mouse | Changes flight yaw and pitch; the hull only leans within the original body-pitch and bank limits. |
| Right-drag or Alt-drag | Orbits the camera without steering the ship. A normal steering drag returns input ownership to flight. |
| W/S, A/D, R/F | Forward/back, sideways, up/down. Velocity eases toward its target; releasing a key does not stop instantly. |
| Shift | Boost while moving; the telemetry reports the original `boosting` flag. |
| C | Recenters orbit and zoom and resets flight pitch through the original input queue. |
| Mouse wheel | Changes camera distance. |
| 慢动作 | Selects 1×, 0.25× or 0.1× for simulation and camera time, preserving the 1/60 simulation step. |
| 原版平滑 / 直接跟随 | Compares the original camera smoothing with alpha = 1 at the same orbit offset. Direct mode calls the original camera's `reset()` each frame and bypasses arm-extension smoothing. Both modes keep island occlusion. |
| 显示辅助线 | Cyan focus marker and arm, yellow final aim marker, and a red shortened-arm segment. Fly beside an island and orbit toward it to observe occlusion. Lines along the view direction can overlap. |

Panel buttons support Tab and Enter/Space and blur after activation so flying keys remain usable. The original double-click pointer-lock behavior is also retained; Escape releases capture. No settings or flight state are saved.

`window.__flight` returns a read-only frozen snapshot each frame: `speed`, `altitude`, `yaw`, `yawDegrees`, `pitch`, `pitchDegrees`, `maxPitch`, `maxPitchDegrees`, `orbitYaw`, `orbitPitch`, `orbitYawDegrees`, `orbitPitchDegrees`, `cameraArmLength`, `desiredArmLength`, `boosting`, `timeScale`, `cameraMode`, `helpersVisible`, `occluded`, `position` and simulation `time`. Bare angles are radians; `*Degrees` fields and the UI use degrees. Distance and speed labels use scene units as metres and metres per simulation second.

## Model inspection

The left list contains all 18 assets and their pinned file sizes. Loading one adds its mesh, triangle, vertex and unique material counts and whether any geometry has vertex colours. Geometry counts sum across mesh instances; indexed meshes use index count / 3 for triangles. The same statistics appear over the viewer and remain in the list for models already inspected.

Drag or zoom with OrbitControls; the model rotates automatically while idle. **线框** reveals triangulation. **顶点色：开/关** changes `material.vertexColors` and recompiles the material; the “contains vertex colours” statistic continues to describe the source geometry. **显示远景版本** switches between base and `-distant` GLBs for island, lighthouse, orchard and ruins, and is disabled for assets without a twin. The viewer centers and scales each asset to fit, so it does not compare their original world sizes.

`?model=<name>` accepts names with or without `.glb`; unknown names fall back to airship. `window.__models` exposes `{ current, stats }`, where `current` includes `.glb` and `stats` contains `meshes`, `triangles`, `vertices`, `materials`, `vertexColors` and `bytes`. It reports only successfully loaded models.

## Build ownership and limits

The build checks pinned archive hashes before work, verifies each GLB's SHA-256 and size before writing its copy, and rechecks all 21 pinned archive sources afterward, including on a build failure. It copies provenance into `public/`. Repeat builds remove only HTML/JS/CSS paths recorded in `public/.build-files.json`; they do not clear the output directory. `public/bundles/`, both built HTML pages, the ownership manifest and copied provenance belong in git. `public/assets/` and `.vite/` are already git-ignored; regenerate the GLBs with the build command after checkout.

This host renders the airship and six islands, choosing island/lighthouse by `ISLANDS.kind`, preserving their positions, rotations and scales. It uses a flat translucent cloud floor and simple lights/fog. It does **not** render creatures, ecosystem objects, atmosphere shaders or audio. The unchanged simulation still runs the ecosystem internally, including its original input actions. There is no save system, upgrade UI or claim of full-game visual parity. The model page inspects archived Blender outputs; it does not run Blender or rebuild assets. WebGL 2 is required. Flight is designed for mouse and keyboard; this host adds no touch movement buttons.
