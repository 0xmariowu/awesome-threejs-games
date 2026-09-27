# Vox Arcana: implementation reading map

## Verified technology

Three.js, WebGL shaders, Web Audio, Web Speech API, Web Workers, Jev API boundary.

Voice- or text-driven elemental spell combat. The browser contains both a keyword parser and a separate AI-provider path.

## Read in this order

| Source path | Responsibility |
|---|---|
| `public/js/main.js` | Game state, input, menus, camera and update loop |
| `public/js/spellbook.js` | Keyword parsing, spell specification and /api/spell request |
| `public/js/elements.js` | Element, shape and reaction definitions |
| `public/js/spells.js` | Spell construction, trajectories and effects |
| `public/js/combat.js` | Damage, enhancement and actor combat rules |
| `public/js/bot.js` | Opponent AI |
| `public/js/world.js` | Procedural arena geometry and materials |
| `public/js/voice.js` | Browser speech recognition and voice state |
| `public/js/audio.js` | Synthesized audio |
| `public/js/postfx.js` | Rendering/postprocessing pipeline |

## Asset inventory

Counts describe the localized runtime directory, including vendor dependencies/fonts. They do not claim that every file is an original art asset. Embedded assets and procedural meshes do not appear as separate files.

| Extension | Files |
|---|---:|
| `.js` | 46 |
| `.ttf` | 14 |
| `.css` | 2 |
| `(no extension)` | 1 |
| `.mp3` | 1 |
| `.html` | 1 |

## Runtime and service boundary

Practice, movement and an actual fireball cast passed with external requests blocked. /api/status and /api/spell have no archived server implementation. Jev AI inference and the server-backed local-model option are unavailable. Browser voice recognition is not certified offline, and microphone input was not tested. This is a playable original client with a documented backend gap.

## Suggested learning exercise

Trace input → game/simulation state → geometry or shader uniforms → rendered output. Identify where the project shares data between visual effects and gameplay rules. Inspect the relevant rendering and audio modules before modifying them. Compare any experiment to this frozen baseline using the same browser, viewport, quality settings and saved state.

## Provenance

Original reference: https://jev-spell.vercel.app/

Read `provenance/manifest.json`, `provenance/original-text/` and `provenance/localization.json`. For repository imports, `provenance/git.json` records the exact commit. Original source attribution and licenses are not replaced by the archive's local packaging.

No project-wide license was found in the deployed files.
