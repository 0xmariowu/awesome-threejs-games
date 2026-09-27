# INKWAVE: original runtime audit

The external original website is no longer available, as confirmed by the user. The retained Git import is the available baseline; it cannot independently prove identity to the missing external website.

## Original runtime

The original game is `index.html` with `src/main.js`. Its 70 runtime/support files match `origin/main` at `11ce485` by byte comparison. Compared with the first retained import `b324afe`, the only additions within those original runtime directories are three license text files; original gameplay code is unchanged.

To serve the original without a build:

```sh
python3 -m http.server 8088 --bind 127.0.0.1
```

Open <http://127.0.0.1:8088/index.html>. No build is required.

## Reading map

- `src/main.js`: boot, menus, match progression and frame loop.
- `src/core/renderer.js`: renderer and postprocessing.
- `src/world/paint.js`: GPU paint and CPU turf state.
- `src/game/character*.js`: procedural character, weapon and motion construction.
- `src/game/match.js`, `src/game/bots.js`: match and bot behavior.
- `src/ui/menus.js`: title, setup, pause and results; the title ignores input during its first 350 ms.
- `src/audio/`: synthesized game audio and music.
- `assets/lightmaps/`, `assets/fonts/`, `vendor/three/`: retained original dependencies.

## Evidence

`provenance/manifest.json` records the retained Git baseline and scope limitation. Browser and timing evidence is kept outside the repository. The audit preserves the original game code and existing untracked user work.
