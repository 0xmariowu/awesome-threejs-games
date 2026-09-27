# Shabondama Biyori / しゃぼん玉日和: implementation reading map

## Verified technology

Three.js 0.186.0, Procedural terrain and vegetation, Bubble shader, Wind simulation, Camera director, Web Audio.

A contemplative spring landscape with soap bubbles. Source modules were recovered from the actual public artifact iframe using the existing browser session.

## Read in this order

| Source path | Responsibility |
|---|---|
| `public/_f/1790342986-3d06/src/main.js` | Boot, update/render orchestration, interaction and diagnostics |
| `public/_f/1790342986-3d06/src/world/gen.js` | Procedural world generation |
| `public/_f/1790342986-3d06/src/world/layout.js` | Landscape and landmark configuration |
| `public/_f/1790342986-3d06/src/sim/wind.js` | Wind field and gusts |
| `public/_f/1790342986-3d06/src/sim/director.js` | Camera direction and points of interest |
| `public/_f/1790342986-3d06/src/render/bubbles.js` | Bubble appearance and rendering |
| `public/_f/1790342986-3d06/src/render/` | Terrain, trees, clouds, water, fauna and postprocessing |
| `public/_f/1790342986-3d06/src/audio/ambient.js` | Ambient sound |

## Asset inventory

Counts describe the localized runtime directory, including vendor dependencies/fonts. They do not claim that every file is an original art asset. Embedded assets and procedural meshes do not appear as separate files.

| Extension | Files |
|---|---:|
| `.woff2` | 368 |
| `.js` | 41 |
| `(no extension)` | 1 |
| `.png` | 1 |
| `.html` | 1 |

## Runtime and service boundary

Scene readiness, bubble input, camera drag and menu passed with no external requests or HTTP failures. The Claude embedding runtime was removed from the local entry; original game modules remain intact. Development-only /api/video, /api/still and /api/log capture helpers do not have a local backend and are not used by normal play.

## Suggested learning exercise

Trace input → game/simulation state → geometry or shader uniforms → rendered output. Identify where the project shares data between visual effects and gameplay rules. Inspect the relevant rendering and audio modules before modifying them. Compare any experiment to this frozen baseline using the same browser, viewport, quality settings and saved state.

## Provenance

Original reference: https://claude.ai/artifact/FozvXt7fcZ6ydzxndkRS1k

Read `provenance/manifest.json`, `provenance/original-text/` and `provenance/localization.json`. For repository imports, `provenance/git.json` records the exact commit. Original source attribution and licenses are not replaced by the archive's local packaging.

No explicit artifact-wide source license was found. Three.js and font licenses remain those of their upstream projects.
