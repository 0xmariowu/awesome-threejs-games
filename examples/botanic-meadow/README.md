# Botanical studies: meadow

Independent implementation inspired by FABOTANIC; no FABOTANIC code or assets

An original, procedural Three.js field patch containing grass tufts, clover, broadleaf weeds, small flowers, and pebbles. Inspiration credit: [FABOTANIC](https://amix-design.com/tl/fab-botanic/), by AMIX / Haruki Tominaga. No file from the tool was opened, read, copied, or ported for this example. All scattering, geometry, wind, and host code was written independently from general techniques.

## Run

From the repository root:

```sh
node tools/server.mjs examples/botanic-meadow
# http://127.0.0.1:8135/
```

Or run `python3 -m http.server 8135 --directory examples/botanic-meadow`. A WebGL 2 browser is required. Plain ES modules; no build, install, CDN, fonts, textures, models, or runtime network requests. Three.js r186 and its MIT LICENSE are copied byte-for-byte from the tracked `antikythera/public/vendor/three/` directory. `src/ui.js` and `src/ui.css` are unchanged first-party shared UI copies.

## How the field works

The seeded sampler proposes points within a square. A uniform spatial grid rejects any point closer than `0.7 / √density` to an accepted neighbour, giving a Poisson-disk exclusion rule. Smooth value noise modulates acceptance at a local scale. One seeded circular clearing per two-metre cell grows with Gaps; default radii stay separated, preventing a broad connected void. The sampler uses a fixed proposal budget of `2.5 × area × density`; density is a proposal parameter, not a guaranteed plants-per-square-metre count. It does not refill holes to meet a fixed population target.

Separate noise fields weight each species' affinity for a location. Increasing clumping strengthens both density variation and those local species preferences. Species sliders are relative weights: zero removes that species, and all zero gives an empty patch. Each populated species uses one GPU-instanced mesh with vertex colours. Curved ribbons form grass and broad leaves; simple procedural solids form clover leaflets, flower petals, and stones.

The vertex shader bends vegetation in two horizontal directions using time, root position, and squared vertex height. The base stays planted. The same displacement runs in the shadow depth material, while pebbles remain still. Wind is a visual approximation; normals do not deform with the bend. The reduced-motion preference freezes time, and zero wind restores undeformed geometry.

## Controls and statistics

Adjust field side length (4–12 m), density, five species weights, clumping, gaps, and wind. **New seed** gives another repeatable layout. Drag to orbit and scroll to zoom. `?lang=zh&theme=dark` overrides browser preferences; English/Chinese and light/dark are supported.

**Plant count** counts vegetation instances, excluding pebbles. One tuft, rosette, or flower cluster is one instance, even when it contains several blades or stems. Pebbles have their own count. **Triangles** and **draw calls** come directly from `renderer.info.render` after rendering, including the ground, studio floor, and shadow pass. They are rendered work per frame, not unique mesh triangle counts. Empty species do not allocate an instanced mesh.

## Source and verification

`src/model.mjs` contains noise and scattering. `geometry.js` constructs all species and injects the wind shader. `studio.js` provides lighting and an orbit camera. `main.js` rebuilds instance batches and binds the UI. There are no third-party sources besides Three.js. `provenance.json` pins local implementation, test and documentation files, first-party shared helpers, and the three vendored files.

```sh
node --test examples/botanic-meadow/*.test.mjs
python3 examples/botanic-meadow/test_browser.py
```

Node tests check seed repeatability, pairwise minimum distances, bounds, default quadrant shares (at least 15% of plants each), local two-metre coverage, population controls, zero species weights, noise continuity, clustering, import closure, licenses and file hashes. Browser tests use installed Chrome and unchanged `ui_browser.py`, block external requests, reject console/page/HTTP errors, compare canvas pixels after real inputs, test each species alone and the empty field, verify wind and reduced motion, and check resource counts across rebuilds, mobile, iframe, language and theme layouts. Screenshots default to the system temporary directory under `gameref-botanic-shots/`; set `BOTANIC_SHOTS` to choose another directory. The shared helper's screenshot location is redirected there without modifying the helper.

`window.__example` exposes parameters, counts, plant counts per quadrant, minimum distance, render statistics and wind time. Species are stylized, with no ecosystem simulation, terrain growth, collision, export, or biological validation. The rejection sampler is finite-budget rather than a maximal Poisson distribution. This does not reproduce FABOTANIC's generator or claim feature parity.
