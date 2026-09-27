# Cloudkeep — original exploration release

Gameref preserves the exact original exploration release `b28406d581bfbc3c905c200e552b669f4dd02a15`, before Sky Arena was added. The owner explicitly excluded Arena from this library. No game source was rewritten.

Run `npm start` here and open http://127.0.0.1:8101/. The static `public/` build needs no dependency installation. `upstream/` contains the 68 original tracked source/art/test files, including Blender source and authoring scripts. The separate local working project is unchanged.

To develop this source snapshot: `cd upstream`, `npm ci`, `npm test`, `npm run build`. Building `upstream/dist` does not replace the frozen `public/` automatically.

The exploration version passed its 37 original tests and production build. Current browser evidence is kept outside the repository. Earlier dual-mode evidence describes a superseded snapshot and is not evidence for this version. Original repository license: MIT; art provenance is in `upstream/art/ASSETS.md`.

See [TECHNICAL.md](TECHNICAL.md) and the SHA-256 records in `provenance/`.
