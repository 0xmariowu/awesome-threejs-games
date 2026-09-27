# Moritsuki character workers

This example runs Moritsuki's original character workers and model assembly in a small Three.js scene. Select Natsumi, Isogai or the straw-hat kid, regenerate the model, drag to rotate, scroll to zoom, or enable wireframe. The progress bar counts completed worker jobs; the rotating indicator runs on the main thread while meshes are generated.

**The original has fixed character designs, not a random-seed character API.** Worker requests accept part names and, for NPCs, a character ID. Internal hair hashes and texture seeds are fixed in the source. This example preserves that behavior and does not invent seeded villagers. Rebuilding the same design returns identical geometry buffers.

Run from the repository root; no build or installation is required:

```sh
node tools/server.mjs examples/moritsuki-characters
# http://127.0.0.1:8127/index.html
node --test examples/moritsuki-characters/*.test.mjs
python3 examples/moritsuki-characters/test_browser.py
```

## Original boundary

All 17 files in `original/` are byte-for-byte archive copies, pinned by archive path and SHA-256 in `provenance.json`. Tests re-hash both sides and check the import closure.

- `kid/model.js` launches four `kid/kid.worker.js` jobs, then assembles the original skeleton, materials, textures and hat. Its dependencies are `shapes.js`, `sdf.js`, `hair.js` and `textures.js`.
- `people/model.js` launches seven `people/people.worker.js` jobs for Natsumi or Isogai. Original geometry comes from `natsumi.js`, `isogai.js`, `human.js`, `shoes.js`, `strands.js` and the shared kid SDF module. Original faces and fabric prints use `face.js`, `prints.js` and `assets/build.js`.
- `vendor/three.module.js` is the archived Three.js r170 runtime. An import map resolves `three` locally. The workers use numeric modules and do not need an import map.

No whole-game entry point is imported. No original files are transformed or edited. Shapes and textures are procedural, so no image or model assets are needed. Source: the deployed [Moritsuki game](https://cda-social.github.io/moritsuki/), archived in `moritsuki/public/`. The archive reports no project-wide source license; this example does not assign one. The Three.js license header remains intact.

## Host and evidence

`src/host.js` owns the scene, camera, controls, disposal and generation lifecycle. The original model modules have no user-facing controls; rotation, zoom, selection and wireframe are host inspection controls. `src/workers.js` subclasses native `Worker` only to observe job starts, results, errors and termination. It passes original worker URLs and messages unchanged, hashes all received typed-array attributes, and terminates pending jobs when a new generation starts. Generation tokens prevent stale results from replacing the current character.

The original assembly runs on the main thread, including canvas textures, skeletons, materials and some accessories. The expensive distance-field mesh jobs run in workers. The original modules contain a main-thread fallback; the host treats any worker error or missing worker completion as failure, and browser tests reject fallback warnings. This example does not claim that all construction is off-thread.

`window.__example` exposes a snapshot with `schemaVersion: 1`, generation ID, selected character, readiness/error, worker counts, cancelled worker count, returned bytes, per-part buffer SHA-256 hashes, model bounds, triangle count, elapsed time, animation frame counts, camera yaw/distance and wireframe state. This is host telemetry, not a replacement worker protocol.

The Python test starts and stops its own server on port 8127, rejects an occupied port, and uses installed Chrome headlessly with external requests blocked. It verifies all three original designs, byte-identical regeneration, bounded models, real worker URLs, rendering frames during generation, cancellation/restart, mouse rotation/zoom, wireframe input and a 16:9 iframe. Console warnings/errors, page errors and failed requests fail the test; zero tests also fail. Screenshots are written to `/tmp/moritsuki-characters/` for visual inspection.

The scene deliberately omits the town, gameplay, character animation, dialogue and postprocessing. WebGL 2 and module workers are required. The catalog maturity remains `extracted-unverified` as requested; local checks are evidence for this bounded host, not full-game parity.
