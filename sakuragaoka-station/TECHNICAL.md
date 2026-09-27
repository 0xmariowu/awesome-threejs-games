# Sakuragaoka Station: implementation reading map

## Verified technology

Three.js 0.170.0, Procedural geometry, Cel shading, Texture atlasing, Web Audio.

A procedural first-person Japanese station town. Original Git source and a separate fully localized runtime snapshot are both retained.

## Read in this order

| Source path | Responsibility |
|---|---|
| `upstream/src/main.js` | Boot, module order, frame loop and HUD |
| `upstream/src/world/layout.js` | Shared world coordinates, places and timetable |
| `upstream/src/core/` | Renderer, toon materials, physics, batching and synthesized audio |
| `upstream/src/world/station/` | Station geometry and furnishings |
| `upstream/src/world/trains.js` | Train timetable and animation |
| `upstream/src/world/petals.js` | Wind-driven petals |
| `upstream/docs/DESIGN.md` | Original architecture/module contracts |

## Asset inventory

Counts describe the localized runtime directory, including vendor dependencies/fonts. They do not claim that every file is an original art asset. Embedded assets and procedural meshes do not appear as separate files.

| Extension | Files |
|---|---:|
| `.js` | 143 |
| `.ttf` | 10 |
| `(no extension)` | 1 |
| `.html` | 1 |

## Runtime and service boundary

Offline entry and walking passed. Upstream npm run check passed for the world modules. The original upstream index still uses CDN URLs; launch the localized public snapshot with npm start in this outer folder. Train timing, all interiors and touch controls are not exhaustively tested.

## Suggested learning exercise

Trace input → game/simulation state → geometry or shader uniforms → rendered output. Identify where the project shares data between visual effects and gameplay rules. Inspect the relevant rendering and audio modules before modifying them. Compare any experiment to this frozen baseline using the same browser, viewport, quality settings and saved state.

## Provenance

Original reference: https://github.com/Kenton-GMI/sakuragaoka-station/tree/main

Read `provenance/manifest.json`, `provenance/original-text/` and `provenance/localization.json`. For repository imports, `provenance/git.json` records the exact commit. Original source attribution and licenses are not replaced by the archive's local packaging.

MIT. Original LICENSE retained. CDN fonts/libraries retain their own licenses.
