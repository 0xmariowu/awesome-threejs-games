# Threejs-Punk Drive

Drive and drift through a rainy neon city, explore on foot and inspect sports cars in the garage.

By Anderson Mancini and Sunag. Source: https://www.threejspunk.com/

## Run locally

```sh
cd threejs-punk
npm start
```

Open <http://127.0.0.1:8105/index.html>. Node.js serves the captured `public/` directory; npm install is not required. Use a browser with WebGPU support. The server binds only to 127.0.0.1.

## Controls

Click **ENTER**, then read the opening message or press Esc to skip. The game enters drive mode.

- W/S or up/down arrows: accelerate/brake; A/D or left/right arrows: steer.
- Space: handbrake/drift; Shift: nitro; B: look back.
- Q/E: change gear (switches to manual); G: manual/automatic; T: driving aids; L: lights.
- C: cycle cameras; R: reset the car; F: get out after slowing down.
- On foot, click to look around, use movement keys, and F/E/Enter near the car to drive again.
- Tab/Esc: city map; M: radio; J: achievements; I: messages; H: driving controls.
- Header buttons open the garage and settings. In the garage, drag to orbit, scroll to zoom, use left/right arrows to browse, Enter to select an unlocked car, and Esc to return.

Missions start at yellow world markers with Enter. Progression, locked vehicles and campaign completion are separate from basic mode coverage.

## Capture and verification

- Capture verified locally on 2026-09-29. Source form: `deployed-bundles`.
- Archived runtime: 121 files, 118,324,576 bytes (112.84 MiB), computed from `public/`.
- Original and localized file hashes: [provenance/manifest.json](provenance/manifest.json).
- Original captured text: `provenance/original-text/`. This registration changes no captured files.
- Source reading map: [TECHNICAL.md](TECHNICAL.md).

```sh
# From the collection root, one renderer at a time:
python3 tools/playthrough.py threejs-punk
python3 tools/record.py threejs-punk
```

Playthrough screenshots, contact sheet and telemetry are written to `output/playthrough/threejs-punk/`. Overview artifacts go to `media/threejs-punk/`; the animated preview is `previews/threejs-punk.webp`. Automated diagnostics are not a reviewed verdict.

Verified input coverage: all four driving cameras for 32 seconds each; walking with native Chrome touch-look and keyboard movement; all seven garage cars (six remain locked); map pan/zoom/waypoints; radio playback and track changes; dispatch messages; achievement browsing; and all six visual looks. Every mode runs for at least 30 seconds. The runner also records aborted audio fetches separately from HTTP failures.

Original captured runtime is unchanged. Driving and menus run locally, but the achievements panel requests uncaptured models/game/sigils/*.svg images (404). Headless desktop pointer lock is unavailable; walking uses native Chrome touch emulation and keyboard input. Campaign completion, all unlocks and physical touch devices are not certified.

## Attribution and license

No license is stated in the captured deployment. Archived with credit to Anderson Mancini and Sunag for study; rights remain with the original authors. Preserve included vendor and asset notices.
