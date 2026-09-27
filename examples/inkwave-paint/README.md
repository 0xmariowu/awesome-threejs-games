# INKWAVE surface painting

A runnable extraction of `inkwave.paint`: hold the left mouse button to fire the original Spritzer at a floor and two walls. Ink spreads, drips down walls and crosses corners. Switch teams to repaint the same surface. The Chinese panel shows the original CPU ground coverage percentages and cell maps for the floor and back wall.

## Run and verify

From the repository root:

```sh
node examples/inkwave-paint/build.mjs
node tools/server.mjs examples/inkwave-paint
# http://127.0.0.1:8119/
```

The built `public/` files are included for the project page's inline 16:9 player. No install, external requests or game server is needed. To rebuild, the archived `inkwave/node_modules` must be present.

```sh
node --test examples/inkwave-paint/*.test.mjs
python3 examples/inkwave-paint/test_browser.py
node tools/pages.mjs check
node tools/readme.mjs --check
node --test tools/*.test.mjs
```

The browser test rebuilds, owns and stops its server on port 8119, and uses installed Chrome through Python Playwright. It rejects an occupied port rather than using another process. Tests apply real pointer input, check continuous fire and release, repaint between teams, read actual GPU atlas pixels against CPU ownership, exercise floor/wall corner painting, clear both representations, and run at 800 × 450. Page, console and request errors fail the run; zero tests also fail. The visual evidence is written to `screenshots/paint.png`.

## Isolation

All nine modules in `original/` are byte copies, with archive paths and SHA-256 hashes in `provenance.json`:

| Original module | Role |
| --- | --- |
| `world/paint.js` | Atlas packing, GPU splats and animated drips, CPU grid, ownership queries and coverage |
| `world/levelMaterial.js` | Original procedural surface and wet-ink shaders |
| `world/level.js` | Surface faces, geometry, atlas UVs and spatial queries |
| `world/maps.js` | Pattern constants imported by the level module; original arena layouts are unused |
| `world/texlib.js` | Required shader-library import; the optional texture-array generator is unused |
| `game/weapons.js` | Original WeaponRunner and Projectiles: fire cadence, spread, ballistics, trail paint and impacts |
| `game/physics.js` | Original ray and segment collision queries |
| `config.js` | Unchanged Spritzer settings |
| `core/ctx.js` | Shared context and event bus populated by the host |

`src/main.js` supplies three box definitions, lights, a fixed camera, a stationary muzzle fixture and a pointer-to-aim adapter. It retains the original left-button hold-to-fire control while replacing the full game's pointer-lock camera with direct surface aiming. It supplies unlimited ink and no-op character animation/reward callbacks; audio and effects stay absent. The original weapon code calls `PaintSystem.splat`; the host does not implement painting or projectile logic. Team switching clears old projectiles before changing their shared owner. The original level material uses its built-in procedural fallback, so no image or model assets are needed.

`window.__example` exposes a fresh telemetry snapshot: readiness, frame/shot/impact counts, coverage, ground counts, floor/back-wall counts, latest impact, current aim, growing splats and projectile count. `project(worldPoint)` maps a point to browser coordinates for real pointer input. `probe(faceId, worldPoint)` returns the original CPU sample and an actual render-target RGBA pixel. Neither method injects paint or input.

## Build and boundaries

`build.mjs` uses Vite and Three.js r186 from `inkwave/node_modules`, with `configFile: false` and a cache inside this example. It verifies copied modules, license notices and pinned dependencies before building, then re-hashes all 15 pinned archive entries in a `finally` block. Repeat builds remove only outputs listed in `public/.build-files.json`; the game directory is never an output target. `LICENSE` and `THREE-LICENSE` preserve the archived notices.

This is a paint experiment, not a full match. There is no player movement, roller, combat target, gamepad support, baked lighting, texture-array generation or post-processing. Ground coverage uses the original live turf-cell denominator, including the walls' horizontal top faces. Vertical wall ownership never contributes to the score. The CPU uses 0.25 m cells and a slightly inset main-blob outline; decorative GPU droplets and drips do not claim extra cells. Pixel agreement is tested inside splats, not at every filtered edge. The back-wall map shows that face only; the left wall remains paintable. WebGL 2 is required. Catalog maturity remains `extracted-unverified`; these checks do not certify full-game parity.
