# Vox Arcana element reactions

A runnable, single-target example of `vox-arcana.reactions`. Select fire, water,
ice, lightning, earth or arcane, then hold the left mouse button over the canvas.
The original combat code resolves every hit, reaction, damage multiplier and
status timer. The interface is in Chinese and fits a 16:9 iframe.

## Run and verify

From the repository root:

```sh
node tools/server.mjs examples/vox-reactions
# http://127.0.0.1:8117/
node --test examples/vox-reactions/*.test.mjs
python3 examples/vox-reactions/test_browser.py
```

No install or build is needed. Browser ES modules use an import map to the
archived Three.js r169 module. Node tests require Node 22.15+ for `registerHooks`,
which provides the same module mapping without transforming source. Browser
tests use Python Playwright and installed Chrome, start their own server, and
stop it on completion or failure. An occupied port 8117 causes a test failure.
They reject zero tests, console/page errors, failed requests and external requests.

## Original code and host boundary

All seven files in `original/` are byte-for-byte archive copies. `provenance.json`
pins their archive paths and SHA-256 values; `provenance.test.mjs` re-hashes both
copies and archive sources and checks the candidate's two source hashes.

- `combat.js`: `Combatant`, `applyHit`, aura application, damage-over-time,
  status expiry, defenses and reaction effect interpretation.
- `elements.js`: element palettes, `reactionFor`, balance data and combo tables.
- `util.js`: math and random helpers imported by combat.
- `i18n.js`, `languages.js`, `more-locales.js`: the unchanged localization import
  closure of `elements.js`. The host supplies its own Chinese display labels.
- `three.module.js`: the original archived dependency, used for vectors and
  colors. Its embedded copyright notice is preserved. No additional art assets
  are required for the rules demonstration.

`src/session.js` creates an original caster and an original 600-HP combatant.
It supplies visual event callbacks, silent audio callbacks, an authoritative
single-target registry and the original game's death contract (`alive = false`).
It calls `applyHit` directly with a fixed lab hit: `dmg: 22`, `mag: 0.5`,
`dmgMult: 1`, `basic: true`. These are fixture inputs, not a reproduction of the
full game's spell parameter pipeline. The six available elements require no
seed-spawning or deferred smite service. Every offered pair is exercised in tests.

`src/main.js` and `src/style.css` draw the new canvas target, aura, ice shell,
burning and shock marks, damage numbers and recent hits. They preserve the
original left-button hold-to-cast gesture and ordinary 0.28-second cooldown;
the element buttons replace spell entry for this bounded lab. Space also casts
when the canvas has keyboard focus. Targets are guaranteed to be hit: aiming,
projectile collision, movement and mana costs are outside the example.

Status updates run at a fixed 60 Hz with frame deltas capped at 0.1 seconds.
Pause stops status time but still permits single hits for inspecting combinations.
Hidden tabs stop status updates and clear held input. Reset creates fresh
combatants and clears the hit history. Nothing is saved.

## What to try

| Input order | Original result with these fixture inputs |
| --- | --- |
| Fire, water | Vaporize: second hit deals 44 damage. |
| Water, fire | Reverse Vaporize: second hit deals 33 damage. |
| Water, ice, earth | Freeze for 3 seconds; earth shatters it for 48.4 damage. |
| Fire, earth | Molten Rupture: 49.28 damage, vulnerability and burning; each initial burn tick deals 21. |
| Water, lightning | Electro-Charged: 27.5 damage, then 13 damage per half-second tick. |
| Fire, fire | Two ordinary 22-damage hits refresh the aura instead of reacting. |

The damage display includes all modifiers applied to a hit, including
vulnerability, rather than only the pair's multiplier. It rounds to one decimal;
`window.__example` exposes the exact values.

`window.__example` is a getter returning detached state snapshots: HP, aura,
status timers, damage-over-time entries, `canAct`, last cast, recent damage
events, cast count, simulation time, selected element and pause state. Browser
tests only read it; all casting and controls use real pointer or keyboard input.
Screenshots are written to `screenshots/`, including an actual 960×540 iframe.

## Limits

This is a reaction-rules extraction, not original scene or VFX parity. The
stationary single target means splash effects cannot damage nearby actors, and
knockback vectors are calculated but not integrated into movement. Audio is
silent. The six-element selection excludes reactions needing seed mines or
delayed sky strikes. Basic hits do not enter the original three-spell finisher
or chain systems. Enhancements, shields and multiplayer are not exposed in the
UI. Original spell parsing, network services and full-game rendering are not
imported. Catalog maturity remains `extracted-unverified` as requested.
