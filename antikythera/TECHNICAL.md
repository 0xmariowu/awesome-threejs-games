# Antikythera: implementation reading map

The game is one inline Three.js 0.186.0 bundle. `src/` exposes its 36 original marker-delimited modules as reading slices; they share the original bundle scope and are not separate runnable modules. [src/INDEX.md](src/INDEX.md) gives their order, original line ranges, and purposes.

Read [src/main.js](src/main.js) for the overall sequence, then follow the systems below. This map follows the owner's 2026-09-23 distillation and the archived source.

| System | Read | Responsibility |
|---|---|---|
| Rendering | [core.js](src/core.js), [fx.js](src/fx.js), [hdr.js](src/hdr.js) | Half-float scene targets, god rays, underwater absorption, depth of field, particles, bloom, color grading, and optional WebGPU HDR output. |
| Ocean and sky | [waves.js](src/waves.js), [ocean.js](src/ocean.js), [sky.js](src/sky.js), [surface.js](src/surface.js), [astro.js](src/astro.js) | Five-wave Gerstner ocean, atmosphere lookup tables, clouds, surface scene, and sun/moon/eclipse motion; horizon and flare modules supply distant scenery and lens effects. |
| World | [layout.js](src/layout.js), [world.js](src/world.js), [wreck.js](src/wreck.js), [boat.js](src/boat.js), [island.js](src/island.js) | Fixed objectives, seabed, procedural rocks and plants, ancient hull and amphorae, sponge boat, and Aegean terrain. Noise and surface-geometry helpers support the generated meshes. |
| Diver and life | [diver.js](src/diver.js), [life.js](src/life.js), [critters.js](src/critters.js), [rare.js](src/rare.js), [leaps.js](src/leaps.js) | Signed-distance sculpting, skin weights, skeleton and procedural animation; schooling fish, seabed creatures, and weighted encounters. |
| Mechanism | [gears.js](src/gears.js), [fragments.js](src/fragments.js), [mechanism.js](src/mechanism.js), [magic.js](src/magic.js) | Tooth geometry, sediment masks, historically grounded gear trains and spiral dials, build-up, and orrery reveal. |
| Gameplay | [main.js](src/main.js), [player.js](src/player.js), [guide.js](src/guide.js), [touch.js](src/touch.js), [lenstext.js](src/lenstext.js) | `title → dive → explore → clean → assemble → crank → eclipse → end`; movement, two-minute air supply, sonar, brushing, hints, gestures, and UI text. |
| Audio | [audio.js](src/audio.js) | Procedural Web Audio effects and music; no downloaded sound assets. |
| Performance tiers | [core.js](src/core.js), [main.js](src/main.js) | Desktop/laptop/tablet/phone settings and GPU-timed resolution adjustment with hysteresis. The phone tier reduces detail, shadow resolution, MSAA, and frame rate. |

The `ENTER[state]` handlers in `main.js` connect the game stages. Follow the 120-second air timer, seven-second sonar cooldown, 70% cleaning threshold, gear-fit sequence, and 223-month crank target to understand how the discovery loop controls the reveal. [band.js](src/band.js) and [frame.js](src/frame.js) handle cinematic and responsive framing.

## Archive boundary

[build.mjs](build.mjs) applies only the six localization patches recorded in [provenance/manifest.json](provenance/manifest.json). The original module-script bytes remain intact in the runnable page. The host removal is the marked `frame-runtime` block only; surrounding HTML, styling, and all game scripts remain as captured.

The provenance tests compare an independent textual reconstruction with `public/index.html`, build twice into a temporary directory, check the complete vendor inventory and import closure, and reconstruct the original from `src/`. These checks establish packaging integrity. The blocked-network browser smoke establishes title-to-dive rendering; it does not establish complete gameplay coverage.

No license is stated in the original artifact. It is archived here with full credit to its author for study; rights remain with the author.
