# Sunsprint implementation map

The main deployed module is `public/assets/kart-7vz70Zig.js`. Its minified
identifiers are not invented source names. Descriptive methods below survive
in the bundle and can be searched directly. The renderer vendors Three.js;
the UI uses React. Hashed dependency chunks and original assets are preserved.

## Asset resolution

The main bundle's `it` resolver prepends `/kart/`. Its import map resolves model
names such as `./meshes/pip-lod.glb` to hashed GLBs in `/assets/`; those map keys
are not themselves missing network assets. Vite's `__vite__mapDeps` arrays resolve
from the site root, not `/kart/assets/`. The capture supplements the static crawl:

- Character IDs: pip, luma, bruno, nova, dash, tess, rocco, poppy.
- Course IDs: coast, canyon, garden, cosmos, candy, cloud, snow, forge.
- Character portraits, course thumbnails, skies, ground/cliff textures and intro art.
- The complete literal `v0` cue list, per-character hurt/whoop/laugh voices,
  menu-v2 music and per-course `-v1` music.

Keep this derived asset list with the original bytes. Replacing failed assets
with new art would invalidate reference fidelity.

## Simulation and rendering boundaries

- Track projection/support: `project`, `loopAt`, `loopPoint`, `loopFrame`,
  `supportAt`, `railAt`, `delta`, `groundHeight`. Preserve the authored course
  specification and coordinate system when extracting.
- Kart/race step: `stepDriver`, `beginRescue`, `recordProgress`, `passGate`.
  State covers drift charge/direction, boost, jumping/tricks, item/status state,
  checkpoint/lap progress and off-course recovery. Start with one complete kart
  plus track fixture, not an isolated steering formula.
- Bot policy: `botInput`, `curveAt`, `packPace`, `rivalPace`, `ghostLane`.
  Bot controls and driver simulation should share the original input contract.
- Presentation: `setGhosts`, `placeGlider`, `placeNameTag`, `placeBalloons`,
  `syncPostSize`, `perfSummary`. Course scenery combines original GLBs,
  LOD/shadow variants, instanced spectators and procedural geometry.
- Audio: `fetchCue`, `decodeCue`, `setTrack`, `unlock`, `rebuild`, `updateRivals`.
  Voice limits, spatial rival engines, delayed decode and lifecycle behavior are
  useful independently of kart handling.
- Networking: WebSocket URL `/kart-room`; session/resume/frame/ranked messages,
  bounded received-frame history and interpolation. These are client-side
  evidence only. Server authority, room rules and ranking cannot be recovered
  from client assets alone.

## Proposed extraction and proof

Candidates `tableparty-kart.*` in the library index specify dependencies and
acceptance checks. First extract a single offline course/controller/audio
fixture; only then broaden to item and battle systems. Validate all eight
courses for missing dynamic assets, race/battle finish and restart, not just
an attract screen. Mobile, sustained performance and multiplayer parity remain
separate verification work. No public reuse license was confirmed in deployment.

## Observed upstream prefetch defect

The battle spec uses `id: "arena"` and `theme: "coast"`. `Hr` prefetches with the ID, requesting missing `sky-arena.webp`. Actual scene initialization calls `$u(Qi(track.spec))`, where `Qi` selects the theme, so the coastal sky renders normally. The original URL 404 response is documented in local evidence kept outside the repository. The strict all-assets probe records this failure instead of hiding it.
