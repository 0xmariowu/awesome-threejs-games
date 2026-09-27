# SCORCH — Desert Pod Racing: implementation reading map

## Verified technology

Embedded Three.js, WebGL, Procedural track and vehicles, Web Audio, DOM HUD.

A desert pod racer largely contained in one HTML document, including its rendering library and game implementation.

## Read in this order

| Source path | Responsibility |
|---|---|
| `public/index.html` | Inline rendering library, procedural assets, racers, state machine, UI and audio |
| `public/_external/fonts.googleapis.com/` | Localized font stylesheet |
| `public/_external/fonts.gstatic.com/` | Localized Bungee and Black Ops One fonts |

## Asset inventory

Counts describe the localized runtime directory, including vendor dependencies/fonts. They do not claim that every file is an original art asset. Embedded assets and procedural meshes do not appear as separate files.

| Extension | Files |
|---|---:|
| `.ttf` | 2 |
| `(no extension)` | 1 |
| `.html` | 1 |

## Runtime and service boundary

Selection, race movement and pause passed with zero external requests or HTTP failures. Netlify toolbar was removed; game code retained. Full three-lap finish, all six vehicles and touch controls are not exhaustively tested.

## Suggested learning exercise

Trace input → game/simulation state → geometry or shader uniforms → rendered output. Identify where the project shares data between visual effects and gameplay rules. Inspect the relevant rendering and audio modules before modifying them. Compare any experiment to this frozen baseline using the same browser, viewport, quality settings and saved state.

## Provenance

Original reference: https://scortch-podracer.netlify.app/

Read `provenance/manifest.json`, `provenance/original-text/` and `provenance/localization.json`. For repository imports, `provenance/git.json` records the exact commit. Original source attribution and licenses are not replaced by the archive's local packaging.

No project-wide license was found. Original author/credits links remain in the page.
