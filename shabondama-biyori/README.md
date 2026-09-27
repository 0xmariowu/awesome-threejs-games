# Shabondama Biyori / しゃぼん玉日和

A contemplative spring landscape with soap bubbles. Source modules were recovered from the actual public artifact iframe using the existing browser session.

Source: https://claude.ai/artifact/FozvXt7fcZ6ydzxndkRS1k

## Run locally

```sh
cd shabondama-biyori
npm start
```

Open <http://127.0.0.1:8098/> (redirects to the original entry path when necessary). Node.js is the only runtime dependency; npm install is not required for the archived version. The server binds only to 127.0.0.1.

## Controls

Click to blow bubbles, drag to look around, and Esc to open the original menu.

## Capture and verification

- Capture date: 2026-09-26.
- Source form: `browser-recovered-readable-modules`.
- Archived runtime: 412 unique files, 15.56 MiB.
- Original byte hashes and current local hashes: [provenance/manifest.json](provenance/manifest.json).
- Localization changes: [provenance/localization.json](provenance/localization.json).
- Screenshots and browser reports from local checks are kept outside the repository.
- Source reading map: [TECHNICAL.md](TECHNICAL.md).

Scene readiness, bubble input, camera drag and menu passed with no external requests or HTTP failures. The Claude embedding runtime was removed from the local entry; original game modules remain intact. Development-only /api/video, /api/still and /api/log capture helpers do not have a local backend and are not used by normal play.

```sh
# Run from the Gameref collection root:
python3 tools/audit.py shabondama-biyori --runtime
```

## Attribution and license

No explicit artifact-wide source license was found. Three.js and font licenses remain those of their upstream projects.

This snapshot preserves the upstream implementation. Passing a smoke check does not establish complete campaign coverage or pixel identity for every state.
