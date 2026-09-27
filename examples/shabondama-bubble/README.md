# Shabondama thin-film bubble

A runnable extraction of `shabondama-biyori.bubble`. Orbit one stationary soap bubble and change its base film thickness to see the original wavelength interference, flowing film bands, bright rim and front/back reflections. The Chinese interface fits the project page's 16:9 iframe.

## Run

From the Gameref root:

```sh
node tools/server.mjs examples/shabondama-bubble
# http://127.0.0.1:8120/index.html
```

No build or package installation is needed. Plain browser ES modules use an import map for the archived Three.js r186. All requests stay on the example origin. The source copies total about 2.4 MB, mostly Three.js; the textures are generated locally by the original code.

Drag to orbit, use the wheel to zoom, and adjust **膜厚** from 80 to 900 nanometres. **暂停流动** freezes shader time so angle and thickness can be compared independently. **重叠泡泡** adds an intersecting second bubble; **前景遮挡** places an opaque strip in front. **重置视角** resets the camera.

## Original code and isolation

All 12 files under `original/` are byte-identical archive copies. `provenance.json` records their archive paths and SHA-256 hashes. Nothing in those copies is patched, transformed or replaced.

| Original files | Use |
| --- | --- |
| `render/bubbles.js` | `BubbleRenderer`, nine-wavelength `FILM_GLSL`, thickness flow in `FILMD_GLSL`, `buildFilmNoise3D`, environment probe, front/back intersections, depth rejection and far-to-near instance sorting |
| `render/glsl.js`, `render/sky.js` | Shared shader definitions, original atmospheric sky bake and irradiance |
| `render/post.js` | Original fullscreen vertex and depth/ray shader definitions; the full `Post` class is not instantiated |
| `render/water.js` | Original `CLOUD2D_GLSL` required by the environment probe; no water scene is created |
| `render/worldtex.js` | Original `buildNoiseTexture` for the environment |
| `render/terrain.js`, `world/gen.js`, `world/layout.js`, `util/noise.js` | Complete static import dependencies of the modules above; the full terrain/world generators are not called |
| `vendor/three.module.js`, `vendor/three.core.js` | The game's archived Three.js r186 browser modules, including their license headers |

The archive's `main.js` is hash-pinned as a reference for uniforms, drag input, DPR and rendering order. It is not imported because it boots the full game. There are no application globals or import side effects that need host shims.

`src/host.js` supplies the camera, UI, animation clock, one or two instance records, a flat 2×2 terrain texture and a clear-cloud texture. It calls the original sky and environment generators with the game's sun direction and haze. The bubble renderer creates its original 32³ film noise and 256×128 environment texture. Each frame renders opaque color/depth, copies color into a separate composition target, calls `update`, `probe` and `render`, then displays the result with Three's ACES tone mapping and output color conversion. A separate depth target avoids reading from the target being written.

The host uses the game's drag-to-look convention for a new orbit camera. `BubbleRenderer` itself has no controls; the full game's director, flight and click-to-blow behavior are outside this rendering example. Wheel zoom and the comparison controls are host additions. The effective DPR follows the original cap of 1.25.

## Verify

```sh
node --test examples/shabondama-bubble/*.test.mjs
python3 examples/shabondama-bubble/test_browser.py
node --test examples/shabondama-bubble/*.test.mjs
```

The provenance suite checks exact file coverage, both copies and archive hashes, the candidate's pinned bubble source, and the complete local import closure. Repeating it after browser verification checks that the archive remains unchanged.

The Python Playwright suite starts and stops its own server on port 8120 and fails if that port is occupied. Installed Chrome runs headlessly. Five tests check visible colored pixels, film animation and pause, keyboard thickness input, pointer orbit, wheel zoom, reset, original sorting from opposite camera positions, foreground depth rejection, an inline 960×540 iframe and the Retina DPR cap. Image comparisons at frozen time verify that controls change rendered pixels; the occluded strip must remain unchanged when film thickness changes. Console/page errors, failed HTTP requests and external requests fail the checks. Zero tests also fails.

`window.__example` is an observation snapshot of the actual camera, instance buffers, shader time, bound depth texture, environment/noise sizes and drawing resolution. It exposes no methods to drive the renderer. Screenshots are saved under `screenshots/`.

## Limits and attribution

The bubble stays in place with age fixed at 0.35 and visibility at 1. Focus blur is disabled for inspection. The fixture omits the original landscape, dynamic clouds, bloom, film-inside-the-camera view, lifetime/popping simulation and audio. The flat world supplies the reflected environment; the optional foreground strip is a depth test fixture and is not included in that environment probe. Intersecting bubbles retain the original object-level sorting, not per-pixel transparent sorting. This is a bounded rendering example, with maturity `extracted-unverified`, not a full-game parity claim.

Source: the archived Shabondama Biyori artifact identified in `provenance.json`. No project-wide game license was found in the archive; no new license is asserted. Third-party license headers remain intact.
