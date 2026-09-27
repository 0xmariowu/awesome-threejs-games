# Local runnability — 16 games

Checked 2026-09-27 by headless playthrough (`python3 tools/playthrough.py <slug>`): every mode reachable from each game's own menus was attempted through the real UI and, where it could be entered, played for 30 s or more with input (exceptions are listed per game below), with screenshots every 5 s and black/frozen/stall/error detection. Every game's screenshots were then reviewed by eye. Machine-readable results: `catalog/runnability.json`; browser evidence kept outside the repository.

| Game | Verdict | Notes |
|---|---|---|
| Antikythera | 能玩 | Complete discovery through real keyboard/mouse input: sonar, all 3 fragments brushed clean, all 3 wheels dragged into lit sockets, crank to 223 months, eclipse and timed end card (0:55). Separate idle dive verified natural air depletion, “Hauled up to the boat.” and automatic return to title. Screenshots reviewed across both paths. |
| Arkenfall | 能玩 | All 11 waystone regions entered and played (movement, swimming, combat, parry). |
| Cloudkeep | 能玩 | Flight, feeding, capture, upgrades and restoring the lighthouse all playable. |
| Everdrift | 部分能玩 | First 4 levels playable. The last 5 are locked behind stars by design. Across separate automated runs, stars were earned by real play and Wake the Windmill, Rail to the Sky and Chimney Climb were entered and played (evidence kept outside the repository), but not reliably in one run; Grind the Gale and Three Windmills were never reached and remain unverified. No missing files or save problems found. |
| Hanakawa | 能玩 | 19 modes and all 8 objectives completed; first load is slow. The missing tea-crate model was restored from the original site. |
| INKWAVE — Turf Riot | 能玩 | 3 maps × 4 weapons, full matches. Occasional `atlas` error on Kelpline does not stop the match. Headless runs use a harness-only pointer-lock emulation. |
| Long Hoang / Lyo | 能玩 | Driving, combat, puzzles and portfolio pages work; 29 missing case-study images and videos were restored from the original site. Contact-form submission needs an external service. |
| Monolith Wilds | 能玩 | All 46 places and camera modes. |
| Moritsuki | 部分能玩 | Town, map, eel and diving minigames work. The 3 beach minigames (clam, crab, pufferfish) render black; the clam game is also black on the original site. |
| Sakuragaoka Station | 能玩 | All 6 scenes; trains run on schedule. |
| SCORCH | 能玩 | Full 3-lap races, pod change, cameras, graphics settings, touch controls. The race timer keeps running while paused (original behaviour). |
| Shabondama Biyori | 能玩 | All 8 starting scenes. |
| Smartgame Town | 部分能玩 | Walking, avatar editor, shops, fishing, bug catching, stage work. Accounts, multiplayer, gacha and 117 arcade games need the original PHP/WebSocket servers, which are not in the archive. |
| Sunsprint / Tableparty Kart | 部分能玩 | All 8 courses, Grand Prix, battle and trailer work offline. Online rooms need the original server. The battle arena background image is missing on the original site too. |
| Tidewater | 能玩 | Walking, fishing and selling, boat, four sea states, diving, night, shops. |
| Vox Arcana | 部分能玩 | Practice and all three duel difficulties work. AI spell casting, local model and voice casting need the missing inference service. |

## Fixed during this check
- Restored from the original origins, byte-exact and recorded in each `provenance/manifest.json`: Hanakawa `wooden_crate_02` glTF; Long Hoang case-study images and videos; Kart AV1 trailer.
- `kart/sky-arena.webp` returns 404 at the original origin too (recorded as `missing_at_origin`).

## Not fixable without changing original code or adding servers
- Moritsuki beach minigames (black render; isolated earlier to the WaterPass stage, also reproduced on the original site).
- Server-backed features of Smartgame Town, Vox Arcana and Kart (no backend code exists).
