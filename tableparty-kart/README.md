# Sunsprint / Tableparty Kart

Original: <https://tableparty.io/kart>.

```sh
cd tableparty-kart
npm start
```

Open <http://127.0.0.1:8100/>. The server redirects to the preserved local entry.
The archive contains original deployed JavaScript, CSS, hashed GLB models,
Meshopt decoder, character/course textures and dynamically named MP3 music/voices.
`provenance/manifest.json` records source URLs and hashes. Rejected string-derived
URL candidates are retained as capture diagnostics, not silently counted as assets.

This is the original **client**, with no substituted gameplay. Single-player race
and battle are client implementations. Online rooms, session resume, ranked
profiles/results and telemetry use `/kart-room`; the original server source has
not been obtained. No success stubs or production multiplayer proxy were added.
No authoring-source repository or source maps have been confirmed; production
bundles are not represented as the original development source tree.

Runtime evidence is kept outside the repository.
Consult the latest browser JSON for tested flows and remaining failures.
See [TECHNICAL.md](TECHNICAL.md) for the source map and extraction boundaries.

On 2026-09-26 all eight courses and eight racers were loaded into visible offline races and received input. The default race also passed steering/drift and pause checks. Battle renders and responds, but its optional `sky-arena.webp` prefetch returns 404 on the original too; the actual scene uses the archived coastal sky through `theme: coast`. This is a retained original prefetch defect, not a replacement texture. Full cups and race/battle completion remain unverified.
