# Smartgame Town: implementation reading map

## Verified technology

Three.js, Procedural town geometry, Layered avatar sprites, Web Audio synthesis, PHP service endpoints.

A shared 3D town with an avatar editor, shops, rooms, collectibles and online services. Assets were enumerated from the actual avatar/creature definitions, including thumbnails.

## Read in this order

| Source path | Responsibility |
|---|---|
| `public/town/js/town.js` | Bundled renderer, town, avatar definitions, gameplay, storage and service calls |
| `public/town/assets/parts/` | Avatar body, face, hair, clothes and accessories |
| `public/town/assets/critters/` | Fish and insect sprites and thumbnails |
| `public/town/assets/signs/atlas.webp` | Town signage atlas |
| `public/js/sg-account.js` | Account client; server is not included |
| `public/js/games.js` | Arcade game catalog; linked games are separate projects |

## Asset inventory

Counts describe the localized runtime directory, including vendor dependencies/fonts. They do not claim that every file is an original art asset. Embedded assets and procedural meshes do not appear as separate files.

| Extension | Files |
|---|---:|
| `.webp` | 1777 |
| `.js` | 26 |
| `.png` | 13 |
| `.html` | 7 |
| `.svg` | 4 |
| `.css` | 3 |
| `.gif` | 2 |
| `.json` | 1 |

## Runtime and service boundary

The scene, avatar editor and named-avatar town entry render locally with external requests blocked. Account, room registration, announcements, online players/chat, voice, cloud saves and payments need unavailable PHP services. The original client may display a connecting state. Individual arcade destinations and the separate farm are outside this town capture. No fake server responses or production proxy were added.

## Suggested learning exercise

Trace input → game/simulation state → geometry or shader uniforms → rendered output. Identify where the project shares data between visual effects and gameplay rules. Inspect the relevant rendering and audio modules before modifying them. Compare any experiment to this frozen baseline using the same browser, viewport, quality settings and saved state.

## Provenance

Original reference: https://smartgame.jp/town/

Read `provenance/manifest.json`, `provenance/original-text/` and `provenance/localization.json`. For repository imports, `provenance/git.json` records the exact commit. Original source attribution and licenses are not replaced by the archive's local packaging.

No project-wide license was found. Original Smartgame/Gameline attribution retained.
