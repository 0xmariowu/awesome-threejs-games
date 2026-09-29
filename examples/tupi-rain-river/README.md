# Tupi · Rain river

The archived Tupi water shader runs unchanged with its original rain ripples,
reflection pass and atmospheric mist. Source and author: [Ruben Marcus — Tupi](https://www.rubenmarcus.dev/demos/tupi/).

Run from the repository root:

```sh
node tools/server.mjs examples/tupi-rain-river
# http://localhost:8131/
node --test examples/tupi-rain-river/*.test.mjs && python3 examples/tupi-rain-river/test_browser.py
```

No build step or external requests. Requires WebGPU in a secure context
(localhost qualifies). `?lang=zh&theme=dark` and `?lang=en&theme=light` use the
shared example UI. Drag to orbit; scroll to zoom.

- **Rain intensity:** sets the original atmosphere rain uniform and rain-particle count. The water module reads that same uniform for surface ripples.
- **Mist:** scales the original low fog and water-skin mist uniforms, from 0 to 4×.
- **Light phase:** selects three points in the original atmosphere timeline (8, 60 and 160 seconds).
- **Pause:** freezes water and weather animation; the controls and camera remain active.

`src/main.js` calls the unchanged default exports of `environment-*.js` and
`water-*.js`. It owns the renderer, camera, frame loop and UI. `src/host.js`
relocates only Tupi asset URLs and uses the original OrbitControls chunk.
`original/` contains the complete required chunk closure, with no `main-*.js`.
Every copied file, its archived source, source URL and SHA-256 are pinned in
`provenance.json`.

Limitations: the plain bank silhouettes are host geometry for scale and
reflections. This does not include the original terrain, forest, fleet,
cinematic camera, audio or post-processing. The distant cinematic rain curtain
is hidden; nearby rain, ripples, sky and fog use the original shaders. Light
phase holds a timeline sample rather than exposing a sun-position editor.
The archive is credited as received; this example asserts no additional license grant.

Browser tests use installed headless Chrome, one renderer at a time. They check
zh/en, light/dark, real keyboard and pointer input, WebGPU, nonblank pixels,
paused-frame changes for each weather control, and zero console/HTTP errors.
The required screenshot is saved to the task's scratchpad `shots/` directory.
