# FABOTANIC

A browser-based procedural plant generator: 41 plant systems (trees, grasses, wildflowers, ferns, foliage plants, cacti), shape and texture controls, wind preview, near/mid/far LOD and GLB / Three.js ZIP export.

- Author: AMIX · トミナガハルキ (<https://amix-design.com/>)
- Original: <https://amix-design.com/tl/fab-botanic/>
- Terms: <https://amix-design.com/tl/fab-botanic/license.html> (v1.0.0, 2026-09-28)

## Rights and notice

All rights to FABOTANIC belong to AMIX / トミナガハルキ. This is a non-commercial study copy, credited to the author and linked to the original. The author's terms do not grant permission to mirror the tool; this copy is published at the repository owner's decision and will be removed on the author's request. Generated assets remain subject to the author's asset terms: they may be used inside games and other works, but not redistributed or sold on their own.

## Run locally

```sh
node tools/server.mjs fab-botanic
```

Open <http://127.0.0.1:8107/> (redirects to `/tl/fab-botanic/index.html`). The server binds only to 127.0.0.1.

## Capture

- Captured 2026-09-29 from the original site: generator page (`tl/fab-botanic/index.html`), guide and 3D gallery (`about.html`, `about/`), terms pages and the shared Three.js r185 runtime under `tl/common/`.
- The Cloudflare challenge/analytics script injected by the host was removed.
- The generator page's interface text (`tl/fab-botanic/index.html`) was translated from Japanese into Chinese/English for this site (labels, buttons and plant display names only; generation logic unchanged). The author's original page is kept byte-for-byte in `provenance/original-text/tl/fab-botanic/index.html`.
- Original byte hashes: [provenance/manifest.json](provenance/manifest.json). Source reading map: [TECHNICAL.md](TECHNICAL.md).
