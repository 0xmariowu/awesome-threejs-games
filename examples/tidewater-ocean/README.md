# Tidewater ocean and surface queries

This example runs Tidewater's original four-cascade, 256-point GPU FFT ocean, asynchronous surface queries, and boat buoyancy in a standalone deep-water scene. Five buoys follow queried water heights and normals. The original procedural lobster boat responds to the water beneath its 32 hull samples. The interface is in Chinese.

## Run

From the Gameref root:

```sh
node tools/server.mjs examples/tidewater-ocean
# http://127.0.0.1:8128/
```

This is a plain ES-module host: no build, package installation, or external requests. Use a browser with WebGPU support. The project page can load the example directly in its 16:9 iframe.

## Original boundary

`original/` contains 73 byte-identical files (608,172 bytes) from `tidewater/upstream/src/`. `provenance.json` pins every archive path and SHA-256. The files retain their directory layout and relative imports. The complete import closure contains:

- `ocean/OceanFFT.js`: spectrum generation, four FFT cascades, displacement textures and mipmaps.
- `ocean/WaterSurface.js`: shared surface parameters and cascade attenuation.
- `ocean/WaterQuery.js`: Eulerian surface-height inversion, GPU height/normal queries, asynchronous readback and result metadata.
- `player/BoatController.js`: hull queries, delayed-result extrapolation and blending, the 120 Hz buoyancy integrator, propulsion and steering.
- `world/BoatModel.js` and `world/boat/*.js`: original procedural boat, hull sample data, materials and buoy geometry.
- `core/Input.js`, `world/WorldLayout.js`, `materials/Materials.js` and the custom engine modules required by those imports.

No game bootstrap is imported. No original file is patched, transformed, or evaluated as rewritten text. `LICENSE` preserves the archive's MIT notice.

`src/main.js`, the HTML and CSS are new host code. The host provides a camera, a 200 m water grid, simple water shading, a flat seabed adapter at −500 m, and an unused one-pixel shadow texture required by the original renderer's global binding. Each grid vertex calls **the original** `waterQueryHeightAtXZ()` shader function, so the visible surface and queried heights share the same solver. The host does not implement wave synthesis, FFT, surface inversion, or boat physics.

The host positions each buoy at `query.get(slot).height - 0.18` and aligns it to the returned normal. Buoys are height probes, not additional rigid bodies; their original geometry is enlarged 3× for visibility. Amber dots show the last returned hull sample positions and heights. The boat itself uses the original buoyancy solver and original model dimensions.

## Controls

| Input | Result |
| --- | --- |
| 海况: 平静 / 微风 / 大浪 | Changes wind, fetch, choppiness and swell through the original FFT API. Values come from the deep-water fields of `src/ui/AppUI.js`'s Calm/Breezy/Choppy presets. |
| W / S, A / D, Shift + W | Forward/reverse, steer, full throttle. The host passes the same input values as `src/player/Player.js`'s boat mode to the original controller. |
| Drag / wheel | Orbit the boat / zoom. This camera is host code. |
| 显示采样点 | Show or hide the returned hull query markers. |
| 慢动作 | Advance FFT and boat simulation at 0.2× time. |

`window.__example` exposes a per-frame snapshot: sea state, actual FFT wind speed, simulation time, query version/result time/original smoothed latency, boat pose/speed/input/consumed query version/hull heights, buoy mesh positions and queried heights, helper state and camera state. Time and latency use simulation seconds; positions use metres. The original latency estimate measures simulation-time age when a result arrives; it can approach zero when readback completes before the next simulation frame. It is not a wall-clock GPU timing measurement.

## Verification and limits

```sh
node --test examples/tidewater-ocean/*.test.mjs
python3 examples/tidewater-ocean/test_browser.py
```

The provenance tests re-hash both copies and archive sources, verify the complete import closure, and check the candidate's three pinned source references. The browser test owns its server on port 8128 and runs installed Chrome headlessly. It rejects page/console/HTTP errors, compares real GPU query heights across sea states, checks buoy height following and boat heave, drives and turns the boat with keyboard input, and tests helpers, slow motion, camera input and iframe-sized resizing. Zero executed tests is a failure. Screenshots are saved under `screenshots/`.

This example has no shoreline, wake, collisions, fishing, atmosphere, refraction, underwater passes or production water material. The finite grid uses the original query solver with simplified host shading. It demonstrates the coupled FFT/query/buoyancy mechanism, not full-game rendering parity. Sea-state changes regenerate the spectrum immediately and can cause a transient. Catalog maturity remains `extracted-unverified` as requested.
