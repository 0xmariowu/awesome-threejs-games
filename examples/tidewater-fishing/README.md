# Tidewater fishing rules

This example runs the original fishing state machine and economy without the 3D renderer. The four files in `original/` are byte-identical to the archived Tidewater source. Their hashes and original paths are recorded in `provenance.json`; the original MIT notice is in `LICENSE`.

Run from the Gameref root:

```sh
node tools/server.mjs examples/tidewater-fishing
# http://127.0.0.1:8102/
node --test examples/tidewater-fishing/*.test.mjs
```

Hold the reel button to pull the fish in. Release it to reduce tension. Change the fish or seed and choose **New fight** for a repeatable scenario. The original rules determine caught, snapped and escaped outcomes. A catch enters the original inventory; selling updates the wallet. Save keys are prefixed with `gameref.example.` and use a separate origin from the original game.

## Reuse contract

```js
import { CatchMinigame } from './original/CatchMinigame.js';
const fight = new CatchMinigame({
  species: 'mullet', kg: 1, lineKg: 7, reelSpeed: 1.1,
  distance: 15, rng: Math.random,
});
fight.update(1 / 60, true); // seconds, reeling
// fight.state: fighting | caught | snapped | escaped
```

Use valid `FishTable` species, positive weights, metres, kilograms and seconds. Inject a seeded RNG for replay. The original core does not validate arbitrary external input. `GameState.spend()` assumes nonnegative amounts; validate them in a consumer. Save import is tolerant of missing legacy length fields, not a security boundary for untrusted save files.

`session.mjs` is the new host adapter: fixed 60 Hz updates, bounded frame accumulation, pause/dispose, one inventory insertion per catch and an isolated storage wrapper. UI input and presentation live in `app.js`; the original core has no browser dependency. The host deliberately pauses when hidden or blurred and requires explicit resume.

## Verified scope

Tests compare all four copied files with their pinned originals, replay each terminal result at 30/60/120 Hz, check terminal stability, capacity/record behavior, one-time selling, line upgrades, legacy saves, storage failures and host lifecycle. The browser check exercises real pointer input, pause, reload and selling.

This is a bounded rules example. It does not include fishing encounters, the original HUD, boat integration, ocean rendering, every upgrade path or a second production consumer. The original Tidewater game remains separately runnable.
