# Botanical studies: phyllotaxis

Independent implementation inspired by FABOTANIC; no FABOTANIC code or assets

An original, procedural Three.js study of leaves on stems and seeds in a sunflower head. Inspiration credit: [FABOTANIC](https://amix-design.com/tl/fab-botanic/), by AMIX / Haruki Tominaga. No file from the tool was opened, read, copied, or ported for this example. The placement rules, meshes, scene, and controls were written independently from general geometric techniques.

## Run

From the repository root:

```sh
node tools/server.mjs examples/botanic-phyllotaxis
# http://127.0.0.1:8134/
```

Or run `python3 -m http.server 8134 --directory examples/botanic-phyllotaxis`. A WebGL 2 browser is required. Plain ES modules; no build, install, CDN, fonts, textures, models, or runtime network requests. Both Three.js r186 modules and its MIT LICENSE are copied byte-for-byte from the tracked `antikythera/public/vendor/three/` directory. `src/ui.js` and `src/ui.css` are unchanged first-party shared UI copies.

## Explore

- **Spiral:** one leaf per node, with an adjustable divergence angle. The initial 137.5° approximates the golden angle, `180 × (3 − √5)`.
- **Alternate:** one leaf per node, alternating by 180°.
- **Opposite:** two leaves at each node, 180° apart, in a fixed plane.
- **Decussate:** opposite pairs; the next pair rotates by 90°.
- **Whorled:** three leaves at each node, 120° apart; each next whorl rotates by 60°.
- **Sunflower head:** Vogel positions, `r = 0.105√(n + 0.5)` and `θ = n × divergence + seeded phase`. The count switches to 610 when entering this mode.

Use the angle slider or the 135° / 137.5° / 140° buttons, then enable **Top-down view** to inspect seed packing. At 135°, eight radial spokes repeat. At 140°, eighteen repeat. The golden-angle approximation distributes seeds more evenly for this fixture. The readout measures mean nearest-neighbour distance between seed centres; it is not a claim that one angle maximizes packing for every finite disc or organ shape.

Leaf/seed count, internode spacing, taper and seed are adjustable. Fixed arrangements lock the angle; sunflower disables internode spacing. Taper reduces leaf size toward the tip, or seed width toward the rim. Seed changes the global rotation, leaf variation, and seed colour. Drag to orbit and scroll to zoom. `?lang=zh&theme=dark` overrides browser preferences; English/Chinese and light/dark are supported.

## Source and verification

`src/model.mjs` contains pure placement functions. `geometry.js` constructs folded leaf surfaces. `studio.js` provides lighting and an orbit camera. `main.js` builds the specimen and binds controls. There are no third-party sources besides Three.js. `provenance.json` pins all local implementation, test and documentation files, the shared helpers, and the three vendored files.

```sh
node --test examples/botanic-phyllotaxis/*.test.mjs
python3 examples/botanic-phyllotaxis/test_browser.py
```

Node tests verify arrangement rules, Vogel radii, deterministic seeds, spacing, taper, comparative packing, import closure, licenses and file hashes. Browser tests use installed Chrome and the repository's unchanged `ui_browser.py`, block external requests, check all arrangements and parameter inputs against canvas pixels, reject console/page/HTTP errors, and exercise mobile, iframe, theme and language layouts. Screenshots default to the system temporary directory under `gameref-botanic-shots/`; set `BOTANIC_SHOTS` to choose another directory. The shared helper's screenshot location is redirected there without modifying the helper.

`window.__example` exposes the current parameters, computed positions, packing statistic, view mode, render counts and geometry count for inspection. The plants are stylized geometric specimens, with no growth simulation, biological validation, texture assets, or export pipeline. This does not reproduce FABOTANIC's generator or claim feature parity.
