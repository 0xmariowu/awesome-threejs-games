# Tupi

Follow a canoe fleet through rainy mangroves and move the camera around Bertioga in 1554.

Category: 互动影像 / Interactive film.

By Ruben Marcus (@rubenmarcus_dev). Source: https://www.rubenmarcus.dev/demos/tupi/

## Run locally

```sh
cd tupi
npm start
```

Open <http://127.0.0.1:8106/demos/tupi/index.html>. Node.js serves the captured `public/` directory; npm install is not required. Use a browser with WebGPU support. The server binds only to 127.0.0.1.

## Controls

The live scene starts automatically. Click the canvas to enable sound. The 210-second film loops through the canoe reveal, mountains, mangrove shore, birds, forest, fish, narrows, village smoke and closing title.

- Drag: orbit around the authored camera view; scroll: zoom. Offsets ease back after four idle seconds.
- Double-click: recenter the view. Touch supports drag and pinch; touch behavior is not verified here.
- Space: pause/resume the film clock. Left/right arrows: seek backward/forward five seconds.
- Click a visible caption to expand its historical source note; click the sound button to mute/unmute.

The author describes the piece as "made with Opus 5.5 + three.js". The scene depicts a Tupinambá canoe fleet on a rainy mangrove river near Bertioga in 1554; its captions distinguish historical sources from reconstruction.

## Capture and verification

- Capture verified locally on 2026-09-29. Source form: `deployed-bundles`.
- Archived runtime: 199 files, 49,207,900 bytes (46.93 MiB), computed from `public/`.
- Original and localized file hashes: [provenance/manifest.json](provenance/manifest.json).
- Original captured text: `provenance/original-text/`. This registration changes no captured files.
- Source reading map: [TECHNICAL.md](TECHNICAL.md).

```sh
# From the collection root, one renderer at a time:
python3 tools/playthrough.py tupi
python3 tools/record.py tupi
```

Playthrough screenshots, contact sheet and telemetry are written to `output/playthrough/tupi/`. Overview artifacts go to `media/tupi/`; the animated preview is `previews/tupi.webp`. Automated diagnostics are not a reviewed verdict.

Verified coverage: one uninterrupted natural film loop (all nine caption beats and the closing title), plus drag orbit, wheel zoom, double-click recenter, pause/resume and five-second keyboard seeking. The runner waits for the original deferred world modules before measuring playback. Both modes use the live WebGPU scene, not the fallback video.

Original captured runtime is unchanged. The local /api/views visitor counter returns 405; this does not stop the live scene. Native 210-second cinematic and camera-control evidence is collected separately from visual review. Touch controls and fallback film playback are unverified.

## Attribution and license

No license is stated in the captured deployment. Archived with credit to Ruben Marcus (@rubenmarcus_dev) for study; rights remain with the original authors. Preserve included vendor and asset notices.
