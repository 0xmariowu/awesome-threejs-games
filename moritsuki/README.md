# Moritsuki / なちゃっとの夏休み

A Japanese summer town linked to five coastal/river minigames. Both the town and its game entry pages are archived.

Source: https://cda-social.github.io/moritsuki/

## Run locally

```sh
cd moritsuki
npm start
```

Open <http://127.0.0.1:8096/> (redirects to the original entry path when necessary). Node.js is the only runtime dependency; npm install is not required for the archived version. The server binds only to 127.0.0.1.

## Controls

WASD walks, Shift runs, Space jumps, F opens fast travel, I opens the bag and Esc opens the menu. Each minigame also has a direct entry URL beneath /moritsuki/.

## Capture and verification

- Capture date: 2026-09-26.
- Source form: `readable-deployed-modules`.
- Archived runtime: 398 unique files, 44.51 MiB.
- Original byte hashes and current local hashes: [provenance/manifest.json](provenance/manifest.json).
- Localization changes: [provenance/localization.json](provenance/localization.json).
- Screenshots and browser reports from local checks are kept outside the repository.
- Source reading map: [TECHNICAL.md](TECHNICAL.md).

Town rendering, fast-travel UI and entry/input in all five minigames were exercised with external requests blocked and no runtime HTTP failures. The hamaguri, gazami and kusafugu minigames show black 3D scenes after their intro fades finish in the tested Chrome environment, although HUD/input and requests work. The original hamaguri site reproduces the same black scene with both default Chrome graphics settings and ANGLE Metal; the cause is unresolved. Town, unagi and mori render visibly. Do not count these three minigames as visually passed. The original page explicitly says story content is unfinished. Public repository lookup did not resolve; readable deployed modules were archived. Geographic credit links are not game dependencies and were excluded from the runtime archive.

```sh
# Run from the Gameref collection root:
python3 tools/audit.py moritsuki --runtime
```

## Attribution and license

Preserve original OpenStreetMap/GSI and sound credits in the game. A project-wide source license was not found.

This snapshot preserves the upstream implementation. Passing a smoke check does not establish complete campaign coverage or pixel identity for every state.
