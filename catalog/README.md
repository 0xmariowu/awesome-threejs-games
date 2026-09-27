# Captured references

Run `node tools/library.mjs` to open the unified library locally · [UI, CLI and API usage](LIBRARY-USAGE.md) · [Extracted examples](examples.json)

[AI reading guide](AI-READING-GUIDE.md) · [Machine-readable catalog](games.json) · [Current library verification](library-verification.json) · [Historical thirteen-project verification](verification.json)

| Reference | Run locally | Evidence | Study |
|---|---|---|---|
| [Hanakawa](../hanakawa/README.md) | `node tools/server.mjs hanakawa` | Local browser evidence kept outside the repository | [Source map](../hanakawa/TECHNICAL.md) |
| [Monolith Wilds](../monolith-wilds/README.md) | `node tools/server.mjs monolith-wilds` | Local browser evidence kept outside the repository | [Source map](../monolith-wilds/TECHNICAL.md) |
| [INKWAVE — Turf Riot](../inkwave/README.md) | `python3 -m http.server 8088 --bind 127.0.0.1` in `inkwave/` | Local browser evidence kept outside the repository | [Source map](../inkwave/TECHNICAL.md) |
| [Long Hoang / Lyo](../longhoang-lyo/README.md) | `node tools/server.mjs longhoang-lyo` | Local browser evidence kept outside the repository | [Source map](../longhoang-lyo/TECHNICAL.md) |
| [Vox Arcana](../vox-arcana/README.md) | `node tools/server.mjs vox-arcana` | Local browser evidence kept outside the repository | [Source map](../vox-arcana/TECHNICAL.md) |
| [Sakuragaoka Station](../sakuragaoka-station/README.md) | `node tools/server.mjs sakuragaoka-station` | Local browser evidence kept outside the repository | [Source map](../sakuragaoka-station/TECHNICAL.md) |
| [Smartgame Town](../smartgame-town/README.md) | `node tools/server.mjs smartgame-town` | Local browser evidence kept outside the repository | [Source map](../smartgame-town/TECHNICAL.md) |
| [Everdrift](../everdrift/README.md) | `node tools/server.mjs everdrift` | Local browser evidence kept outside the repository | [Source map](../everdrift/TECHNICAL.md) |
| [SCORCH — Desert Pod Racing](../scorch-podracer/README.md) | `node tools/server.mjs scorch-podracer` | Local browser evidence kept outside the repository | [Source map](../scorch-podracer/TECHNICAL.md) |
| [Moritsuki / なちゃっとの夏休み](../moritsuki/README.md) | `node tools/server.mjs moritsuki` | Local browser evidence kept outside the repository | [Source map](../moritsuki/TECHNICAL.md) |
| [Tidewater](../tidewater/README.md) | `node tools/server.mjs tidewater` | Local browser evidence kept outside the repository | [Source map](../tidewater/TECHNICAL.md) |
| [Shabondama Biyori / しゃぼん玉日和](../shabondama-biyori/README.md) | `node tools/server.mjs shabondama-biyori` | Local browser evidence kept outside the repository | [Source map](../shabondama-biyori/TECHNICAL.md) |
| [Arkenfall](../arkenfall/README.md) | `node tools/server.mjs arkenfall` | Local browser evidence kept outside the repository | [Source map](../arkenfall/TECHNICAL.md) |
| [Sunsprint / Tableparty Kart](../tableparty-kart/README.md) | `node tools/server.mjs tableparty-kart` | Local browser evidence kept outside the repository | [Source map](../tableparty-kart/TECHNICAL.md) |
| [Cloudkeep](../cloudkeep/README.md) | `node tools/server.mjs cloudkeep` | Local browser evidence kept outside the repository | [Source map](../cloudkeep/TECHNICAL.md) |

Start a stopped archived game with `npm start` in its project folder. For original INKWAVE, run `python3 -m http.server 8088 --bind 127.0.0.1` in `inkwave/`. Ports 8090–8101 are reserved by this batch. Source licenses and backend gaps are documented per project; none is labeled as exhaustively 100% equivalent.

Known issues: Hanakawa reproduced a prolonged startup stall in ordinary Chrome; later successful gameplay does not close that issue. The startup diagnosis was retained as local evidence outside the repository. Three Moritsuki minigames have black 3D scenes in the tested Chrome environment; the original hamaguri page reproduces it. The visual review was retained as local evidence outside the repository. These cases are not marked as passed.

[Thirteen-project fidelity and performance audit](FULL-AUDIT.md).

[Current fifteen-project source analysis](PROJECT-ANALYSIS.md) · [62 extraction candidates](extraction-candidates.json) · [AI library proposal](AI-GAME-LIBRARY.md).
