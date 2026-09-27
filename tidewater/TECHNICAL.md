# Tidewater: implementation reading map

## Verified technology

Direct WebGPU, WGSL, Custom rendering engine, FFT ocean, Hillaire atmosphere, Vite 8.

A fishing game built on its own WebGPU engine rather than Three.js. It is particularly useful for studying the complete rendering pipeline alongside gameplay.

## Read in this order

| Source path | Responsibility |
|---|---|
| `upstream/src/engine/gpu/GPU.js` | Adapter requirements, resources and asynchronous pipeline compilation |
| `upstream/src/engine/` | Scene graph, math, geometry, material and WGSL composition |
| `upstream/src/ocean/` | FFT ocean, shore simulation, wake, caustics and underwater lighting |
| `upstream/src/sky/` | Atmosphere, volumetric clouds and environment |
| `upstream/src/post/` | AO, haze, TAA upscaling, bloom and final composition |
| `upstream/src/game/` | Casting, fights, cooler, vendors, guide and minimap |
| `upstream/src/audio/` | Sample-based positional sound |
| `upstream/test/game-logic.mjs` | Original fishing/economy/save regression tests |
| `upstream/CREDITS.md` | Models, audio, fonts and technical references |

## Asset inventory

Counts describe the localized runtime directory, including vendor dependencies/fonts. They do not claim that every file is an original art asset. Embedded assets and procedural meshes do not appear as separate files.

| Extension | Files |
|---|---:|
| `.jpg` | 79 |
| `.ogg` | 43 |
| `.ttf` | 9 |
| `.glb` | 6 |
| `.md` | 5 |
| `.png` | 5 |
| `.js` | 4 |
| `.bin` | 4 |
| `.json` | 2 |
| `(no extension)` | 1 |
| `.css` | 1 |
| `.html` | 1 |

## Runtime and service boundary

The original game-logic and engine-smoke tests passed. Offline browser exploration and inventory run with installed Chrome. Bundled headless Chromium fails on both upstream and local because it exposes only 16 sampled textures per shader stage; installed Chrome exposes 48. No engine or image-quality downgrade was applied. Boat trips, a complete caught-fish sale and all weather conditions remain unverified.

## Suggested learning exercise

Trace input → game/simulation state → geometry or shader uniforms → rendered output. Identify where the project shares data between visual effects and gameplay rules. Inspect the relevant rendering and audio modules before modifying them. Compare any experiment to this frozen baseline using the same browser, viewport, quality settings and saved state.

## Provenance

Original reference: https://dgreenheck.github.io/tidewater/

Read `provenance/manifest.json`, `provenance/original-text/` and `provenance/localization.json`. For repository imports, `provenance/git.json` records the exact commit. Original source attribution and licenses are not replaced by the archive's local packaging.

MIT source; original LICENSE and CREDITS.md retained. Third-party assets retain the licenses identified there.
