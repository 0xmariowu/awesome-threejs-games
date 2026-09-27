# Sakuragaoka Station

A procedural first-person Japanese station town. Original Git source and a separate fully localized runtime snapshot are both retained.

Source: https://github.com/Kenton-GMI/sakuragaoka-station/tree/main

## Run locally

```sh
cd sakuragaoka-station
npm start
```

Open <http://127.0.0.1:8092/> (redirects to the original entry path when necessary). Node.js is the only runtime dependency; npm install is not required for the archived version. The server binds only to 127.0.0.1.

## Controls

Click Start walking. WASD walks, mouse looks, Shift runs, Space jumps, F flies, 1–5 changes location, M mutes.

## Capture and verification

- Capture date: 2026-09-26.
- Source form: `source-repository-and-localized-snapshot`.
- Archived runtime: 155 unique files, 52.65 MiB.
- Original byte hashes and current local hashes: [provenance/manifest.json](provenance/manifest.json).
- Localization changes: [provenance/localization.json](provenance/localization.json).
- Screenshots and browser reports from local checks are kept outside the repository.
- Source reading map: [TECHNICAL.md](TECHNICAL.md).

Offline entry and walking passed. Upstream npm run check passed for the world modules. The original upstream index still uses CDN URLs; launch the localized public snapshot with npm start in this outer folder. Train timing, all interiors and touch controls are not exhaustively tested.

```sh
# Run from the Gameref collection root:
python3 tools/audit.py sakuragaoka-station --runtime
```

## Attribution and license

MIT. Original LICENSE retained. CDN fonts/libraries retain their own licenses.

This snapshot preserves the upstream implementation. Passing a smoke check does not establish complete campaign coverage or pixel identity for every state.
