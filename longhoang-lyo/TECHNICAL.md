# Long Hoang / Lyo: implementation reading map

## Verified technology

Three.js rendering, Rapier physics, GSAP transitions, GLB models, KTX2 compressed textures.

Original stylized 3D portfolio/game with a controllable combat robot. The captured deployment retains its hashed module layout.

## Read in this order

| Source path | Responsibility |
|---|---|
| `public/assets/BUq3XE3I.js` | Entry, module preloading and application boot |
| `public/assets/5g15ipwS.js` | World/game startup and renderer configuration |
| `public/assets/B-Z8xTec.js` | Large gameplay/scene bundle; enemy, boss, player and audio logic |
| `public/assets/C2vT0KxV.js` | Three.js and model/texture loader implementation |
| `public/assets/DrDnj3Lb.js` | GSAP animation library |
| `public/assets/` | Models, compressed textures, sounds, HUD SVGs and lazy chunks |

## Asset inventory

Counts describe the localized runtime directory, including vendor dependencies/fonts. They do not claim that every file is an original art asset. Embedded assets and procedural meshes do not appear as separate files.

| Extension | Files |
|---|---:|
| `.svg` | 232 |
| `.mp3` | 61 |
| `.glb` | 48 |
| `.js` | 39 |
| `.webp` | 28 |
| `.ktx2` | 25 |
| `.css` | 9 |
| `.woff2` | 5 |
| `.ttf` | 4 |
| `.json` | 4 |
| `.png` | 3 |
| `.wasm` | 2 |
| `(no extension)` | 1 |
| `.woff` | 1 |
| `.bin` | 1 |
| `.ico` | 1 |
| `.html` | 1 |
| `.webmanifest` | 1 |

## Runtime and service boundary

Entry, tutorial and movement were exercised with external network access blocked. Full combat progression, every portfolio panel and the contact submission backend are not exhaustively verified. Original development sources/source maps were not available; minified production bundles are retained.

## Suggested learning exercise

Trace input → game/simulation state → geometry or shader uniforms → rendered output. Identify where the project shares data between visual effects and gameplay rules. Inspect the relevant rendering and audio modules before modifying them. Compare any experiment to this frozen baseline using the same browser, viewport, quality settings and saved state.

## Provenance

Original reference: https://longhoang-lyo.com/

Read `provenance/manifest.json`, `provenance/original-text/` and `provenance/localization.json`. For repository imports, `provenance/git.json` records the exact commit. Original source attribution and licenses are not replaced by the archive's local packaging.

No project-wide license was found in the deployment. Preserve the author credits; rights remain with the author.
