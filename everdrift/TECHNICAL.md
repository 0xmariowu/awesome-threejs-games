# Everdrift: implementation reading map

## Verified technology

Godot 4.7 export, WebAssembly, PCK v4, Godot shaders, AudioWorklet.

A 3D wind-bending platformer delivered as a Godot web export. The original runtime and PCK are preserved byte-for-byte.

## Read in this order

| Source path | Responsibility |
|---|---|
| `public/index.html` | GODOT_CONFIG, executable names, loader and canvas setup |
| `public/everdrift-8dd1a13e413c.js` | Godot/Emscripten JavaScript runtime |
| `public/everdrift-8dd1a13e413c.wasm` | Compiled Godot engine |
| `public/everdrift-8dd1a13e413c.pck` | Game resource pack |
| `extracted/shaders/` | Original readable shader resources |
| `extracted/scripts/game/` | Compiled GDC scripts, remaps and gameplay module names |
| `provenance/pck-inventory.json` | 325 extracted resources with verified MD5 and SHA-256 |

## Asset inventory

Counts describe the localized runtime directory, including vendor dependencies/fonts. They do not claim that every file is an original art asset. Embedded assets and procedural meshes do not appear as separate files.

| Extension | Files |
|---|---:|
| `.png` | 4 |
| `.js` | 3 |
| `.pck` | 1 |
| `.wasm` | 1 |
| `.html` | 1 |
| `.json` | 1 |

## Runtime and service boundary

Main menu, opening dialogue, the first village, movement/jump input and coin collection ran locally with external requests blocked. Both audio worklets and the runtime version.json were captured. Extracted GDC files are compiled bytecode, not editable GDScript source; no decompilation or source-equivalence claim is made. Full campaign completion has not been tested.

## Suggested learning exercise

Trace input → game/simulation state → geometry or shader uniforms → rendered output. Identify where the project shares data between visual effects and gameplay rules. Inspect the relevant rendering and audio modules before modifying them. Compare any experiment to this frozen baseline using the same browser, viewport, quality settings and saved state.

## Provenance

Original reference: https://everdrift.iliareingold.com/

Read `provenance/manifest.json`, `provenance/original-text/` and `provenance/localization.json`. For repository imports, `provenance/git.json` records the exact commit. Original source attribution and licenses are not replaced by the archive's local packaging.

No game-wide license was found in the deployment. Godot engine and third-party components retain their own licenses.
