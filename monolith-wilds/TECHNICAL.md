# Monolith Wilds: original runtime audit

Source: <https://monolithwilds.vercel.app/>. On 2026-09-26, all 40 pre-existing runtime files matched the live original by SHA-256. The offline audit found one missing dependency group: Google Fonts.

## Source-backed repair

The original font stylesheet and eight font files are now archived under `_external/`. Only their URLs in `index.html` and the font stylesheet were localized. All game JavaScript and game CSS remain unchanged. The previous HTML is preserved under `../.claude/backups/full-audit/` and the original text is in `provenance/original-text/`.

Run `npm start` or `node server.js`, then open <http://127.0.0.1:8081/>. The font stylesheet has a `.css` extension so the existing server sends the correct MIME type.

## Reading map

- `assets/index-DGqtqlWq.js`: world boot, render loop and `window.__MW` diagnostics.
- `assets/terrain-*`, `assets/terrain-worker-*`: terrain and worker computation.
- `assets/water-*`, `assets/water-bake-worker-*`: water and baking work.
- `assets/sky-*`: sky and atmosphere.
- `assets/hud-*`, `assets/controls-*`: UI and input.
- `assets/tour-*`: cinematic camera route.
- `assets/ambience-*`: procedural audio.
- `assets/three.core-*`, `assets/three.module-*`: bundled Three.js implementation.

## Verification limits

Browser screenshots, request logs, and performance samples are kept outside the repository. Runtime tests cover entry and movement; no claim of visiting every landmark is made. Performance measurements retain the original default quality. Dynamic scenes are not expected to produce identical pixels at unrelated elapsed times.
