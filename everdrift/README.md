# Everdrift

A 3D wind-bending platformer delivered as a Godot web export. The original runtime and PCK are preserved byte-for-byte.

Source: https://everdrift.iliareingold.com/

## Run locally

```sh
cd everdrift
npm start
```

Open <http://127.0.0.1:8094/> (redirects to the original entry path when necessary). Node.js is the only runtime dependency; npm install is not required for the archived version. The server binds only to 127.0.0.1.

## Controls

Wait for shader warmup, select New Game and advance the opening dialogue by clicking. Use the game's How to Play screen for controls; WASD moves, Space jumps and Shift dashes.

## Capture and verification

- Capture date: 2026-09-26.
- Source form: `godot-web-export-and-extracted-resources`.
- Archived runtime: 11 unique files, 43.30 MiB.
- Original byte hashes and current local hashes: [provenance/manifest.json](provenance/manifest.json).
- Localization changes: [provenance/localization.json](provenance/localization.json).
- Screenshots and browser reports from local checks are kept outside the repository.
- Source reading map: [TECHNICAL.md](TECHNICAL.md).

Main menu, opening dialogue, the first village, movement/jump input and coin collection ran locally with external requests blocked. Both audio worklets and the runtime version.json were captured. Extracted GDC files are compiled bytecode, not editable GDScript source; no decompilation or source-equivalence claim is made. Full campaign completion has not been tested.

```sh
# Run from the Gameref collection root:
python3 tools/audit.py everdrift --runtime
```

## Attribution and license

No game-wide license was found in the deployment. Godot engine and third-party components retain their own licenses.

This snapshot preserves the upstream implementation. Passing a smoke check does not establish complete campaign coverage or pixel identity for every state.
