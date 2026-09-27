# SCORCH — Desert Pod Racing

A desert pod racer largely contained in one HTML document, including its rendering library and game implementation.

Source: https://scortch-podracer.netlify.app/

## Run locally

```sh
cd scorch-podracer
npm start
```

Open <http://127.0.0.1:8095/> (redirects to the original entry path when necessary). Node.js is the only runtime dependency; npm install is not required for the archived version. The server binds only to 127.0.0.1.

## Controls

Choose a pod, start the race, use the on-screen controls or keyboard, and Esc to pause. The smoke test selects a pod, races and pauses.

## Capture and verification

- Capture date: 2026-09-26.
- Source form: `single-document-deployment`.
- Archived runtime: 4 unique files, 1.17 MiB.
- Original byte hashes and current local hashes: [provenance/manifest.json](provenance/manifest.json).
- Localization changes: [provenance/localization.json](provenance/localization.json).
- Screenshots and browser reports from local checks are kept outside the repository.
- Source reading map: [TECHNICAL.md](TECHNICAL.md).

Selection, race movement and pause passed with zero external requests or HTTP failures. Netlify toolbar was removed; game code retained. Full three-lap finish, all six vehicles and touch controls are not exhaustively tested.

```sh
# Run from the Gameref collection root:
python3 tools/audit.py scorch-podracer --runtime
```

## Attribution and license

No project-wide license was found. Original author/credits links remain in the page.

This snapshot preserves the upstream implementation. Passing a smoke check does not establish complete campaign coverage or pixel identity for every state.
