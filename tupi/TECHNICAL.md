# Tupi: implementation reading map

## Technology

Three.js WebGPU / TSL, Authored 210-second cinematic camera, Instanced forest and animated canoe fleet, Rain ripples, river reflections and mist, Web Audio soundscape and historical captions. These are captured deployment bundles, not an upstream source checkout.

## Read in this order

| Source path | Responsibility |
|---|---|
| `public/demos/tupi/index.html` | Page shell, canvas stage and loading overlay |
| `public/demos/tupi/assets/main-BxOdblV6.js` | WebGPU startup, dynamic module loading, quality selection, warm-up, 210-second clock, deferred fauna, keyboard playback controls and read-only observation surface window.__tupi |
| `public/demos/tupi/assets/layout-n7oYTSht.js` | River spline, fleet layout, cinematic beat ranges and quality tiers |
| `public/demos/tupi/assets/camera-CDf2sJ53.js` | Authored camera shots, collision clearance, pointer orbit, wheel/pinch zoom and double-click recenter; offsets decay after four idle seconds |
| `public/demos/tupi/assets/overlay-nBNR6e8J.js` | Nine timed historical captions and expandable sources, title, sound toggle and optional visitor count |
| `public/demos/tupi/assets/water-Ct6j_3H2.js` | TSL river material, rain ripples and reflection rendering |
| `public/demos/tupi/assets/fleet-CmCdPN8d.js` | Fleet placement and crew rendering |
| `public/demos/tupi/assets/paddling-p-iGeLm8.js` | Shared paddling motion |
| `public/demos/tupi/assets/canoe-s8Ju-0Hu.js` | Canoe geometry and materials; canoe-By32-8C4.js is the world module wrapper |
| `public/demos/tupi/assets/forest-ehp2HefA.js` | Forest placement and distant tree impostors |
| `public/demos/tupi/assets/mangrove-Dx2aduxF.js` | Mangrove trees and shoreline vegetation |
| `public/demos/tupi/assets/terrain-nbKkxvd9.js` | Terrain module; terrainUtil-BBWYZdtw.js provides terrain helpers |
| `public/demos/tupi/assets/environment-DsRXgLng.js` | Sky, light and mist |
| `public/demos/tupi/assets/pipeline-BT70zyB_.js` | Post-processing pipeline |
| `public/demos/tupi/assets/soundscape-BConVJq7.js` | Ambient soundscape; engine-h0W-Gsup.js, engine-DyFoP1yu.js and score chunks support audio |
| `public/demos/tupi/assets/three.webgpu-DTZfZZb9.js` | Three.js WebGPU renderer; three.core-CKagcDpn.js and three.tsl-Cx8kD8RS.js provide core and shader nodes |

## Runtime inventory

Counts include all captured files under `public/`, including fonts, vendor chunks and incidental deployment resources. They are not counts of original art assets. Total: 199 files, 49,207,900 bytes.

| Extension | Files |
|---|---:|
| `(no extension)` | 1 |
| `.bin` | 23 |
| `.glb` | 32 |
| `.gltf` | 14 |
| `.html` | 1 |
| `.jpg` | 3 |
| `.js` | 35 |
| `.json` | 8 |
| `.m4a` | 15 |
| `.mp4` | 2 |
| `.png` | 8 |
| `.svg` | 2 |
| `.ttf` | 3 |
| `.txt` | 3 |
| `.webp` | 49 |

## Input and evidence boundary

The playthrough module uses native browser keyboard and pointer events. JavaScript evaluation only reads runtime or DOM observations; it does not call game setters, change clocks or patch physics. The recording scenario reuses the verified entry flow and adds no explanatory overlay.

Original captured runtime is unchanged. The local /api/views visitor counter returns 405; this does not stop the live scene. Native 210-second cinematic and camera-control evidence is collected separately from visual review. Touch controls and fallback film playback are unverified.

## Provenance and attribution

Source: https://www.rubenmarcus.dev/demos/tupi/

Author: Ruben Marcus (@rubenmarcus_dev). See `provenance/manifest.json` for source URLs and SHA-256 hashes, and `provenance/original-text/` for captured text before localization.

No license is stated in the captured deployment. Archived with credit to Ruben Marcus (@rubenmarcus_dev) for study; rights remain with the original authors. Preserve included vendor and asset notices.
