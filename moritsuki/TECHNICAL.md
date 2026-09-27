# Moritsuki / なちゃっとの夏休み: implementation reading map

## Verified technology

Three.js, Geographical heightfields, Procedural scenery, Shader patches, Shared minigame progression.

A Japanese summer town linked to five coastal/river minigames. Both the town and its game entry pages are archived.

## Read in this order

| Source path | Responsibility |
|---|---|
| `public/moritsuki/src/town/main.js` | Town boot and update loop |
| `public/moritsuki/src/town/data.js` | Geographical data and heightfield loading |
| `public/moritsuki/src/town/data/` | Yoshimi JSON, core/outer heightfield BIN files |
| `public/moritsuki/src/town/scenery/` | Terrain shaping, paddies, forest, river and planted scenery |
| `public/moritsuki/src/town/people/` | NPCs and conversation |
| `public/moritsuki/src/town/quests.js` | Quest state and progression |
| `public/moritsuki/src/shared/` | Shared progress across minigames |
| `public/moritsuki/hamaguri/index.html` | Clam minigame |
| `public/moritsuki/gazami/index.html` | Crab minigame |
| `public/moritsuki/kusafugu/index.html` | Pufferfish minigame |
| `public/moritsuki/unagi/index.html` | Eel minigame |
| `public/moritsuki/mori/index.html` | Spearfishing minigame |

## Asset inventory

Counts describe the localized runtime directory, including vendor dependencies/fonts. They do not claim that every file is an original art asset. Embedded assets and procedural meshes do not appear as separate files.

| Extension | Files |
|---|---:|
| `.js` | 235 |
| `.woff2` | 109 |
| `.mp3` | 25 |
| `.ttf` | 9 |
| `.html` | 6 |
| `.css` | 6 |
| `.json` | 4 |
| `(no extension)` | 2 |
| `.bin` | 2 |

## Runtime and service boundary

Town rendering, fast-travel UI and entry/input in all five minigames were exercised with external requests blocked and no runtime HTTP failures. The hamaguri, gazami and kusafugu minigames show black 3D scenes after their intro fades finish in the tested Chrome environment, although HUD/input and requests work. The original hamaguri site reproduces the same black scene with both default Chrome graphics settings and ANGLE Metal; the cause is unresolved. Town, unagi and mori render visibly. Do not count these three minigames as visually passed. The original page explicitly says story content is unfinished. Public repository lookup did not resolve; readable deployed modules were archived. Geographic credit links are not game dependencies and were excluded from the runtime archive.

## Suggested learning exercise

Trace input → game/simulation state → geometry or shader uniforms → rendered output. Identify where the project shares data between visual effects and gameplay rules. Inspect the relevant rendering and audio modules before modifying them. Compare any experiment to this frozen baseline using the same browser, viewport, quality settings and saved state.

## Provenance

Original reference: https://cda-social.github.io/moritsuki/

Read `provenance/manifest.json`, `provenance/original-text/` and `provenance/localization.json`. For repository imports, `provenance/git.json` records the exact commit. Original source attribution and licenses are not replaced by the archive's local packaging.

Preserve original OpenStreetMap/GSI and sound credits in the game. A project-wide source license was not found.
