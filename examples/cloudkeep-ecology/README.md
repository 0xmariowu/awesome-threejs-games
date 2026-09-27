# Cloudkeep ecology

Run the original creature ecosystem in a compact scene: roam and flock, drop seeds, watch creatures forage, boost to startle them, or hold Q to capture them. Captures release coins and schedule a return after the original 9–14 simulation seconds. The interface is in Chinese.

## Run and verify

From the repository root:

```sh
node examples/cloudkeep-ecology/build.mjs
node tools/server.mjs examples/cloudkeep-ecology
# http://127.0.0.1:8110/

node --test examples/cloudkeep-ecology/*.test.mjs
python3 examples/cloudkeep-ecology/test_browser.py
```

The browser test builds current sources, starts its own server on 8110 and stops it afterward. Stop a manual server before running the test. It uses Python Playwright and installed Chrome, saves screenshots in `screenshots/`, and rejects an empty test selection.

## Original boundary

`original/simulation.ts`, `original/storage.ts` and `original/input.ts` are byte-identical copies of Cloudkeep revision `b28406d581bfbc3c905c200e552b669f4dd02a15`. `provenance.json` records archive paths and SHA-256 hashes. `LICENSE` preserves the upstream MIT notice. Provenance tests compare both copies and archive sources; the build verifies them before work and rechecks archive hashes even if a build fails.

Simulation owns movement, seeded randomness, species tuning, hunger, flocking, food claims, fleeing, capture targeting/cancellation, coin attraction, rewards and delayed respawns. Storage calls its original validated snapshot reconstruction. Controls retain the original keyboard, drag, orbit, zoom and pointer-lock behavior. No original module is patched or replaced.

`src/fixture.ts` changes only initial conditions: nine creatures of five species start near the ship, with nearby pairs that can flock. This uses the original `addCreature` method. `src/ecology.ts` supplies the scene, a wider observation camera, state labels, event messages, persistence and a fixed 60 Hz accumulator. It passes real input to `Simulation.step`; it does not implement creature decisions. The camera and simple capture line/shrink presentation are host code, not extracted rendering logic.

Ten original GLBs are copied by the build: airship, five creature species, food, coin, and two distant island models. Islands retain original positions and collision rules. The example omits the full game's atmosphere, audio, articulated creature animation, upgrades and missions. It demonstrates ecosystem behavior, not complete game parity.

## Controls and state

WASD moves; R/F changes altitude; drag or arrow keys steer; Space drops seeds; Shift plus movement triggers boost; hold Q to capture the highlighted creature. Release Q to cancel. Right/Alt-drag orbits, the wheel zooms, and C recenters. Slow motion uses 0.25× time without changing simulation steps. State labels can be hidden. Restart resets this example's save and compact arrangement.

The original `cloudkeep.save.v1` key is isolated by this example's dedicated port/origin, 8110. Saves run once per simulation second and on hide/page exit. Reload preserves growth, seeds, pending coins and respawns; capture in progress is intentionally absent from the original snapshot. Background time is not simulated. If storage is unavailable, the simulation continues without persistence.

`window.__example` returns detached snapshots with `ready`, simulation `time`, `timeScale`, `helpers`, ship position/yaw/speed/boosting, creature positions and modes, foods, drops, respawns, totals, capture target/candidate and event counts since load/reset. It exposes no mutation or fast-forward API.

The build uses Vite and Three.js already in `cloudkeep/upstream/node_modules`, with `configFile: false` and cache/output inside this example. Node tests strip TypeScript types in memory using Node 22. It never installs packages or writes into the archive. Repeat builds clean only outputs in their ownership manifest. The generated `public/` files and copied assets make the registered 16:9 iframe runnable through the library's existing launcher.
