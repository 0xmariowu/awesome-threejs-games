# Vox Arcana

Voice- or text-driven elemental spell combat. The browser contains both a keyword parser and a separate AI-provider path.

Source: https://jev-spell.vercel.app/

## Run locally

```sh
cd vox-arcana
npm start
```

Open <http://127.0.0.1:8091/> (redirects to the original entry path when necessary). Node.js is the only runtime dependency; npm install is not required for the archived version. The server binds only to 127.0.0.1.

## Controls

Open Settings, expand the model section and disable Jev to use the original local keyword parser. Choose Practice field. WASD moves; Enter opens text casting. Try "fire ball". No microphone is needed.

## Capture and verification

- Capture date: 2026-09-26.
- Source form: `readable-deployed-modules`.
- Archived runtime: 65 unique files, 36.45 MiB.
- Original byte hashes and current local hashes: [provenance/manifest.json](provenance/manifest.json).
- Localization changes: [provenance/localization.json](provenance/localization.json).
- Screenshots and browser reports from local checks are kept outside the repository.
- Source reading map: [TECHNICAL.md](TECHNICAL.md).

Practice, movement and an actual fireball cast passed with external requests blocked. /api/status and /api/spell have no archived server implementation. Jev AI inference and the server-backed local-model option are unavailable. Browser voice recognition is not certified offline, and microphone input was not tested. This is a playable original client with a documented backend gap.

```sh
# Run from the Gameref collection root:
python3 tools/audit.py vox-arcana --runtime
```

## Attribution and license

No project-wide license was found in the deployed files.

This snapshot preserves the upstream implementation. Passing a smoke check does not establish complete campaign coverage or pixel identity for every state.
