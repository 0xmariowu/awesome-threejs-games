# Smartgame Town

A shared 3D town with an avatar editor, shops, rooms, collectibles and online services. Assets were enumerated from the actual avatar/creature definitions, including thumbnails.

Source: https://smartgame.jp/town/

## Run locally

```sh
cd smartgame-town
npm start
```

Open <http://127.0.0.1:8093/> (redirects to the original entry path when necessary). Node.js is the only runtime dependency; npm install is not required for the archived version. The server binds only to 127.0.0.1.

## Controls

Create an avatar, open the name tab, enter a nickname of at most 10 characters and click この見た目でタウンへ！. Local activity is isolated from the production service.

## Capture and verification

- Capture date: 2026-09-26.
- Source form: `deployed-client-with-backend-gap`.
- Archived runtime: 1833 unique files, 33.24 MiB.
- Original byte hashes and current local hashes: [provenance/manifest.json](provenance/manifest.json).
- Localization changes: [provenance/localization.json](provenance/localization.json).
- Screenshots and browser reports from local checks are kept outside the repository.
- Source reading map: [TECHNICAL.md](TECHNICAL.md).

The scene, avatar editor and named-avatar town entry render locally with external requests blocked. Account, room registration, announcements, online players/chat, voice, cloud saves and payments need unavailable PHP services. The original client may display a connecting state. Individual arcade destinations and the separate farm are outside this town capture. No fake server responses or production proxy were added.

```sh
# Run from the Gameref collection root:
python3 tools/audit.py smartgame-town --runtime
```

## Attribution and license

No project-wide license was found. Original Smartgame/Gameline attribution retained.

This snapshot preserves the upstream implementation. Passing a smoke check does not establish complete campaign coverage or pixel identity for every state.
