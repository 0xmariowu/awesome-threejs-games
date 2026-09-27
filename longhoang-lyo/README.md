# Long Hoang / Lyo

Original stylized 3D portfolio/game with a controllable combat robot. The captured deployment retains its hashed module layout.

Source: https://longhoang-lyo.com/

## Run locally

```sh
cd longhoang-lyo
npm start
```

Open <http://127.0.0.1:8090/> (redirects to the original entry path when necessary). Node.js is the only runtime dependency; npm install is not required for the archived version. The server binds only to 127.0.0.1.

## Controls

Click LET'S GO, then use WASD. The in-game tutorial explains subsequent actions.

## Capture and verification

- Capture date: 2026-09-26.
- Source form: `deployed-bundles`.
- Archived runtime: 466 unique files, 18.71 MiB.
- Original byte hashes and current local hashes: [provenance/manifest.json](provenance/manifest.json).
- Localization changes: [provenance/localization.json](provenance/localization.json).
- Screenshots and browser reports from local checks are kept outside the repository.
- Source reading map: [TECHNICAL.md](TECHNICAL.md).

Entry, tutorial and movement were exercised with external network access blocked. Full combat progression, every portfolio panel and the contact submission backend are not exhaustively verified. Original development sources/source maps were not available; minified production bundles are retained.

```sh
# Run from the Gameref collection root:
python3 tools/audit.py longhoang-lyo --runtime
```

## Attribution and license

No project-wide license was found in the deployment. Preserve the author credits; rights remain with the author.

This snapshot preserves the upstream implementation. Passing a smoke check does not establish complete campaign coverage or pixel identity for every state.
