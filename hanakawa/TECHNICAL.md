# Hanakawa: original runtime audit

Source: <https://hanakawa-boat-game.vercel.app/>. On 2026-09-26, all 214 existing runtime files were downloaded independently and compared by SHA-256. All matched. The original game scripts, models, textures, fonts, audio and world data were not patched.

## Reading map

- `index.html`: original loading screen and hashed module entry.
- `assets/index-BeXmJqZW.js`: boot/runtime bundle.
- `assets/render-BbLvNM6z.js`: Three.js WebGPU rendering and postprocessing.
- `assets/boat-*`, `assets/hullSpec-*`, `assets/model-*`: boat simulation and geometry.
- `assets/water-*`, `assets/caustics-*`: water and caustic rendering.
- `world/world.json`: world channel descriptions; compressed and uncompressed channel files are retained.
- `preload.json`: 148 declared preload URLs; every referenced file exists locally.
- `assets/vegetation/`: baked vegetation and impostors loaded through manifests.
- `assets/ui/fonts/`: the original local fonts.

## Fidelity evidence

`provenance/manifest.json` records source and local hashes. `provenance/original-text/` retains the fetched text. Original game code has no local modifications. Packaging (`server.js`, `package.json`, documentation) is separate from original game code.

Browser and timing evidence is kept outside the repository. Startup shader work and steady gameplay are measured separately. A working scene and matching files do not establish completion of every cargo task or every browser/device configuration.

The browser HUD is the controls reference: E casts off/docks, W/S change throttle, A/D steer, M opens the river chart and C changes camera. Existing prose controls should not override the original runtime HUD.

## Startup limitation reproduced in ordinary Chrome

The deployed boot bundle waits on animation frames during warmup and before reveal. A hidden tab can stop this progression. Both the original site and local snapshot reproduced a loading stall while hidden. Local startup additionally recorded a main-thread task lasting 11.925 seconds; that full first-run delay is not explained by visibility alone. A later native-browser run reached `window.__lumaReady === true`, and an isolated default-graphics Chrome run reached playable boat movement at 60 fps. Caches were not cleared, so the later result does not establish a cold-start repair.

The detailed diagnosis is kept outside the repository. `window.__luma.stats()` exposes runtime frame statistics and boat state; `window.__luma.ctx.services.startup` exposes boot phases. Inspect these rather than treating a visible HUD or an HTTP 200 as readiness. No quality, shader or boot-logic workaround was added to the preserved source.
