# Threejs-Punk Drive: implementation reading map

## Technology

Three.js WebGPU / TSL, Rapier vehicle physics, Procedural city and authored vehicle assets, Web Audio engine worklets and radio, DOM menus and HUD. These are captured deployment bundles, not an upstream source checkout.

## Read in this order

| Source path | Responsibility |
|---|---|
| `public/index.html` | Deployment entry, metadata, bundled stylesheet and module entry |
| `public/assets/index-BdYCjkRC.js` | Bundled Three.js renderer and game boot; city, vehicle simulation bridge, walking, driving, camera, missions, progression, garage, map and DOM interfaces. Imports boot the full game. |
| `public/assets/rapier-CGfTHJBj.js` | Rapier physics integration and bundled physics runtime |
| `public/assets/loadVehicleRig-CFgsTUy0.js` | Vehicle asset loading and rig preparation |
| `public/assets/applyNeonLook-ZuopezRC.js` | Vehicle neon material styling |
| `public/assets/engineSampler.worklet-CiauAed6.js` | Sample-based engine AudioWorklet |
| `public/assets/engineSynth.worklet-tkiTUezc.js` | Synthesized engine AudioWorklet |
| `public/audio/engine/v8.json` | Engine sample regions; the paired WAV supplies the audio |
| `public/audio/radio/playlist.json` | Local radio track catalog |
| `public/maps/metro/map.json` | City map data |
| `public/models/game/city/kit.json` | City construction asset data |
| `public/assets/index-CmOknlDP.css` | HUD, intro, settings and menu styling |

## Runtime inventory

Counts include all captured files under `public/`, including fonts, vendor chunks and incidental deployment resources. They are not counts of original art assets. Total: 121 files, 118,324,576 bytes.

| Extension | Files |
|---|---:|
| `.css` | 1 |
| `.glb` | 14 |
| `.hdr` | 1 |
| `.html` | 1 |
| `.jpg` | 4 |
| `.js` | 13 |
| `.json` | 8 |
| `.ktx2` | 4 |
| `.mp3` | 34 |
| `.png` | 7 |
| `.ttf` | 1 |
| `.wasm` | 5 |
| `.wav` | 4 |
| `.webmanifest` | 1 |
| `.webp` | 17 |
| `.woff` | 1 |
| `.woff2` | 5 |

## Input and evidence boundary

The playthrough module uses native browser keyboard and pointer events. JavaScript evaluation only reads runtime or DOM observations; it does not call game setters, change clocks or patch physics. The recording scenario reuses the verified entry flow and adds no explanatory overlay.

Original captured runtime is unchanged. Driving and menus run locally, but the achievements panel requests uncaptured models/game/sigils/*.svg images (404). Headless desktop pointer lock is unavailable; walking uses native Chrome touch emulation and keyboard input. Campaign completion, all unlocks and physical touch devices are not certified.

## Provenance and attribution

Source: https://www.threejspunk.com/

Author: Anderson Mancini and Sunag. See `provenance/manifest.json` for source URLs and SHA-256 hashes, and `provenance/original-text/` for captured text before localization.

No license is stated in the captured deployment. Archived with credit to Anderson Mancini and Sunag for study; rights remain with the original authors. Preserve included vendor and asset notices.
