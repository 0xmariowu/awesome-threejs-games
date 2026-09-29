# Tupi · Paddling fleet

The archived canoe geometry, crew models, paddling poses, GPU animation and
fleet update run unchanged. Source and author: [Ruben Marcus — Tupi](https://www.rubenmarcus.dev/demos/tupi/).

Run from the repository root:

```sh
node tools/server.mjs examples/tupi-paddling-fleet
# http://localhost:8132/
node --test examples/tupi-paddling-fleet/*.test.mjs && python3 examples/tupi-paddling-fleet/test_browser.py
```

No build step or external requests. Requires WebGPU on localhost or HTTPS.
Language and theme use shared `ui.js`: `?lang=zh&theme=dark` or
`?lang=en&theme=light`. Drag to orbit; scroll to zoom.

- **Stroke speed:** scales time passed to the original fleet update (0.25–2×). Crew strokes, boat motion, wakes and hero animation share this clock.
- **Canoes:** selects 1, 3, 6 or 12. This reloads the host with a `canoes` query parameter and limits the original exported layout before the fleet factory allocates its crew.
- **Camera:** side view of the crew, overhead, or fleet overview. The orbit target follows the hero canoe.
- **Pause:** freezes the original update clock.

The host imports the default export of `fleet-*.js`, whose original closure
includes `paddling-*.js`, `canoe-s8Ju-0Hu.js`, meshopt and the baked-shape loader.
The six high/low crew variants, hero model, eye texture and two baked shape
files are copied byte-for-byte. `provenance.json` records each source URL,
archive path and SHA-256. No `main-*.js` or game bootstrap is imported.
`src/host.js` remaps the original absolute asset URLs into this example's
`original/` directory without modifying any original file.

Limitations: stroke speed is host time scaling, not a new native stroke-rate
parameter. Original per-rower phase offsets and small boat-to-boat period
variations are retained; the crew is coordinated rather than mathematically
identical. Canoe-count changes reset time and camera. The original fleet's
standalone flat water and wake fallback are used, with host ambient fill and a
lighter water material for visibility. This does not include the full river,
forest, cinematic camera, audio or post-processing. The original module can
warn that variant v4's hands fall 2.2 cm short of the paddle; its rig is unchanged.
The archive is credited as received; no additional license grant is asserted.

Browser tests use installed headless Chrome, one renderer at a time, and check
zh/en, light/dark, real inputs, speed-dependent animation, visible camera and
fleet-count changes, nonblank canvas and zero console/HTTP errors. The required
screenshot is saved to the task's scratchpad `shots/` directory.
