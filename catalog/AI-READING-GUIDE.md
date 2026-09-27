# Reading this collection with an AI assistant

This collection preserves implementations, not just screenshots. Read a project's README and TECHNICAL.md before proposing changes.

## Evidence order

1. `provenance/manifest.json`: upstream URL, original SHA-256, current local SHA-256, byte size, and rejected static dependency candidates.
2. `provenance/original-text/`: unmodified downloaded text. Compare against `public/` to understand localization.
3. `upstream/` where available: original Git repository and exact commit recorded in `provenance/git.json`. Cloudkeep is an exact export of the original exploration Git revision; use `provenance/source-snapshot.json` for its revision and all tracked-file hashes.
4. `TECHNICAL.md`: verified entry points and implementation topics.
5. Local browser evidence (kept outside the repository): screenshots and actual request/error reports. `gameplay/browser.json` records exercised controls.
6. `FULL-AUDIT.md` and `full-audit.json`: the thirteen-project audit. Local evidence kept outside the repository contains source comparisons, repairs and performance probes. `tools/audit.py` selects the newest local browser evidence, including a failed run, instead of retaining an older success. The current 15-project refresh is retained as local evidence outside the repository; it preserves historical failures and backend limits.

A rejected static candidate is not necessarily a missing runtime dependency: comments, concatenated basenames, and library diagnostics can look like URLs. Conversely, a clean initial load does not prove that every late-game path works. Use browser HTTP statuses as well as failed requests; HTTP 404 does not emit a browser `requestfailed` event.

## Study routes

| Topic | Start with | Follow into |
|---|---|---|
| River simulation and staged WebGPU startup | Hanakawa | boot bundle, world channels, boat/hull modules, water and render services; inspect `window.__luma.stats()` and startup phases |
| Streamed procedural landscape | Monolith Wilds | terrain workers, landmark modules, flight/walk controls, procedural audio |
| Turf painting and local 4v4 simulation | Original INKWAVE | `src/main.js`, match simulation, GPU paint buffers, renderer, bot updates |
| Procedural anime town | Sakuragaoka Station | `src/world/layout.js`, world generators, batching, toon postprocessing |
| Real geographical terrain + connected minigames | Moritsuki | town data loader, heightfield BINs, masks, scenery, shared progress |
| Elemental combat and rule composition | Vox Arcana | `elements.js`, `spellbook.js`, `combat.js`, `spells.js`, `bot.js` |
| Stylized model pipeline | Long Hoang | GLB + KTX2 asset inventory, startup/gameplay chunks, GSAP transitions |
| Direct WebGPU engine | Tidewater | GPU device, shader composition, FFT ocean, atmosphere, postprocessing, game tests |
| Godot browser delivery | Everdrift | HTML config, WASM runtime, PCK inventory, extracted shaders/audio; GDC is compiled bytecode |
| Single-document racing | SCORCH | HTML script blocks, procedural track and pods, state transitions, synthesized audio |
| Avatar compositing + shared town | Smartgame Town | part identifiers, sprite layers, procedural town, client/server boundary |
| Atmospheric procedural landscape | Shabondama Biyori | world generation, wind, bubble renderer, director, fauna and postprocessing |
| Procedural open-world action game | Arkenfall | `Game` module, terrain/atlas/audio workers, character rig and combat, quest stages, local saves, map painting |
| Offline kart race simulation | Sunsprint / Tableparty Kart | track-relative dynamics, drift/tricks, bots, original course/model/audio assets, `/kart-room` boundary |
| Airship flight and ecosystem simulation | Cloudkeep | renderer-independent simulation, chase camera, ecology and Blender source; original exploration release |

## Rules for studying and extending

- Attribute upstream authors and preserve included licenses/credits. Public availability is not a blanket reuse license; unknown licenses are explicitly recorded.
- Keep imported source separate from experiments. Create experiments in a separate directory alongside this repository or in an explicitly scoped fork.
- Never replace an original implementation with an approximation and call it the original.
- Distinguish authored source, readable deployed modules, minified bundles, and compiled binaries.
- Treat browser microphone recognition, AI inference, accounts, payments and multiplayer as separate services. Do not silently point local experiments at production backends.
- Start with exact upstream versions. Upgrade dependencies only in a separate experiment after preserving the baseline.
- For browser tests use installed Chrome (`--channel chrome`): the bundled headless Chromium reports only 16 sampled textures per WebGPU stage on this machine; installed Chrome reports 48. Tidewater needs more than 16.

## Verification

```sh
python3 -m unittest discover -s tools -p 'test_*.py'
node --test tools/server.test.mjs
python3 tools/audit.py --all --runtime
python3 tools/gameplay.py tidewater --channel chrome
```

The audit checks archived bytes and reports observed runtime gaps. It does not certify full gameplay or pixel identity. Screenshots of animated scenes differ with elapsed time, random seeds, browser/GPU versions, display size and saved state.

Review `visual-review.json` when present. A black scene with a working HUD can produce zero network and JavaScript errors. The runtime audit reports the unresolved Hanakawa startup and Moritsuki visual issues and exits unsuccessfully; the archive-only checksum audit passes independently.

Do not equate a 60 Hz animation callback with a complete performance pass. Startup stalls, hidden-tab suspension, actual game state, render resolution and source-provided dynamic resolution need separate checks. Hanakawa reproduced long startup tasks in ordinary Chrome even though later isolated gameplay ran at 60 fps. Keep the original quality and adaptive-resolution logic unchanged when comparing it with the source.

## Capability index

Start with [PROJECT-ANALYSIS.md](PROJECT-ANALYSIS.md) for all 15 projects and [extraction-candidates.json](extraction-candidates.json) for 62 candidates with source hashes and proposed acceptance checks. `python3 tools/find.py --project cloudkeep` or `python3 tools/find.py camera --category 3c` returns JSON for AI use. Candidate inspection is not completed extraction. [AI-GAME-LIBRARY.md](AI-GAME-LIBRARY.md) defines the proposed workflow and simpler UI.


## Working interface

Run `node tools/library.mjs` and open `http://127.0.0.1:8080/`. The library reads the original catalogs and sibling Lab catalog without duplicating game code. `node tools/library-cli.mjs search 镜头` searches all record types; `context <id>` returns pinned source references, dependencies, limitations and related runnable entries. See [LIBRARY-USAGE.md](LIBRARY-USAGE.md).

[examples.json](examples.json) separately registers bounded extractions. A candidate remains source analysis even when one related example is verified; a passing example does not certify the entire original game.
