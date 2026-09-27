# Tidewater

A fishing game built on its own WebGPU engine rather than Three.js. It is particularly useful for studying the complete rendering pipeline alongside gameplay.

Source: https://dgreenheck.github.io/tidewater/

## Run locally

```sh
cd tidewater
npm start
```

Open <http://127.0.0.1:8097/> (redirects to the original entry path when necessary). Node.js is the only runtime dependency; npm install is not required for the archived version. The server binds only to 127.0.0.1.

## Controls

Use installed Chrome with WebGPU. Wait for compilation, click to explore and dismiss the first-play guide. WASD moves, R equips the rod, hold/release left mouse casts, I opens inventory and E interacts.

## Capture and verification

- Capture date: 2026-09-26.
- Source form: `source-repository-and-deployment`.
- Archived runtime: 160 unique files, 59.00 MiB.
- Original byte hashes and current local hashes: [provenance/manifest.json](provenance/manifest.json).
- Localization changes: [provenance/localization.json](provenance/localization.json).
- Screenshots and browser reports from local checks are kept outside the repository.
- Source reading map: [TECHNICAL.md](TECHNICAL.md).

The original game-logic and engine-smoke tests passed. Offline browser exploration and inventory run with installed Chrome. Bundled headless Chromium fails on both upstream and local because it exposes only 16 sampled textures per shader stage; installed Chrome exposes 48. No engine or image-quality downgrade was applied. Boat trips, a complete caught-fish sale and all weather conditions remain unverified.

```sh
# Run from the Gameref collection root:
python3 tools/audit.py tidewater --runtime
```

## Attribution and license

MIT source; original LICENSE and CREDITS.md retained. Third-party assets retain the licenses identified there.

This snapshot preserves the upstream implementation. Passing a smoke check does not establish complete campaign coverage or pixel identity for every state.
