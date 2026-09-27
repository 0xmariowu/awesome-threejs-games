# Arkenfall

Original site: https://www.arkenfall.site/

This archive contains the original deployed client: 88 files, 7,292,228 bytes. Every archived file matches its downloaded SHA-256. No gameplay, rendering, artwork or quality settings have been rewritten.

## Run

```sh
npm start
```

Open http://127.0.0.1:8099/ in Chrome. Node.js is required; installing npm dependencies is unnecessary. Keep this port and hostname consistent to retain the same browser save. Game progress is stored in browser storage, not in this project folder.

Allow the loading scene to finish, press a key, then choose **Begin**. Hold Space to skip the opening cinematic. Click the scene to capture the mouse.

| Input | Action |
|---|---|
| WASD / arrow keys | Move |
| Shift / Space / Q | Sprint / jump / dodge |
| Left / right mouse | Attack / heavy attack |
| F / R / C | Parry / lash / burst |
| E | Interact |
| M / I | Map / inventory |
| Esc | Menu / close |

The offline test entered the world, walked and jumped, attacked, dodged, opened the map and inventory, reached the first quest area, then reloaded and continued the original automatic save. No external requests, missing HTTP resources or page exceptions occurred in that run. Local and original-site high-DPI samples both recorded approximately 60 Hz frame callbacks on the audit machine. These are sampled checks, not a complete campaign run.

## Archive and verification

- [File manifest](provenance/manifest.json): original URLs, sizes and hashes.
- [Localization record](provenance/localization.json): no runtime file changes; all ten dynamically selected loading paintings are included.
- [Implementation guide](TECHNICAL.md): entry points, generation workers and persistence.
- Local gameplay checks exercised the controls and captured screenshots with external requests blocked; evidence is kept outside the repository.
- [Library audit](../catalog/FULL-AUDIT.md): performance samples and source comparisons.

The capture preserves deployed JavaScript modules, fonts, icons and loading art. It is not an unpublished development repository. Full-world exploration, every quest and boss, gamepad, mobile controls and long-session stability have not been exhaustively verified. No project-wide reuse license was confirmed; retain original credits and vendor notices.
