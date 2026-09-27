# Shabondama camera director

A runnable extraction of `shabondama-biyori.director`: click to blow bubbles, watch the camera follow one and enter it, then drift until it pops and the director fades to another viewing spot. Drag or use the arrow keys to take over the gaze immediately. After ten idle seconds, the original director blends back to automatic framing over 2.5 seconds. Bubble movement remains wind-driven during manual looking.

## Run

From the Gameref root:

```sh
node tools/server.mjs examples/shabondama-director
# http://127.0.0.1:8113/index.html
```

No build or package installation is needed. An import map resolves `three` to the game's archived Three.js r186 browser modules. All runtime requests stay on the example origin. The Chinese interface fills the library's 16:9 iframe.

Click/tap, Space or Enter blows bubbles. Drag and arrow keys look around with the original input directions and six-pixel drag threshold. The three host buttons restart through the director's fade, enable 0.25× slow motion, or show composition guides and the tracked bubble marker.

## Isolation and provenance

The following files are byte-for-byte copies under `original/`, with archive paths and SHA-256 pins in `provenance.json`:

| Original | Responsibility |
| --- | --- |
| `sim/director.js` | Shot states, camera spring, focus, manual gaze blend, bubble spawning and companions, pop and scene-cut transitions |
| `sim/flight.js` | Bubble movement, wind response, obstacle checks and expiration |
| `sim/wind.js` | Wind direction, gusts and turbulence |
| `world/layout.js` | Unchanged spatial dependencies imported by director and flight |
| `util/noise.js` | Original random and noise functions |
| `vendor/three.module.js`, `vendor/three.core.js` | Archived browser renderer and math dependency |

The candidate's `director.js` hash is checked directly against `catalog/extraction-candidates.json`. The archive's `main.js` is pinned as a reference for input routing and update order, but is not imported: booting it would construct the full game and its audio/capture services. The host forwards input to `click`, `look`, `endLook` and `lookKeys`; it does not implement camera transitions, interpolation or manual blending.

`src/host.js` supplies a flat garden, three launch spots, gaze landmarks, trunk obstacle boxes and empty canopy/tree queries. It uses the director's supported `mainLife` override of 28 seconds (the game normally chooses 95–155 seconds), a seeded director opening, and `placeAtSpot(0)` for a repeatable initial view. Flight still uses its own original thermal initialization.

The host renders simple procedural scenery and a wand. Bubble display radii are four times the original radii to make framing visible in a small iframe; physics and camera coordinates retain their original values. The host translates the original `film`, `flash` and `fade` outputs into simple screen overlays. Focus and aperture are observable, but the host does not render the game's depth of field or thin-film shader. FOV follows the original entry's 52° landscape / 64° portrait setting; the director itself does not animate FOV. No original art assets are required for this procedural camera fixture.

## Verify

```sh
node --test examples/shabondama-director/*.test.mjs
python3 examples/shabondama-director/test_browser.py
```

The browser suite starts and stops its own server on reserved port 8113 and fails if another server owns that port. It uses installed Chrome headlessly through Python Playwright and rejects console/page errors, HTTP failures and external requests. It exercises the full blow → follow → ride → pop → fade → ready sequence, target framing, movement, drag handoff, idle return, arrow keys, slow motion, restart and an 800×450 iframe. Zero tests is a failure. Screenshots are written to `screenshots/`.

`window.__example` exposes per-frame observations of the original director, camera, input blend and transition history. Tests use browser input and read these observations; they cannot drive time or invoke the director through this object. The provenance suite verifies both copies and archive sources without writing to the archive; rerun it after browser verification to confirm the archive remains unchanged. `test/iframe.html` is an HTTP-served cross-origin embedding fixture for Chrome's local-network checks.

## Scope and attribution

This is a camera technique fixture, not the full game's landscape, authored eight-location tour, audio, menu or rendering pipeline. The original state names are `title`, `blow`, `follow`, `ride`, `pop`, `after`, `fadein` and `ready`; entering the bubble occurs during `follow`, and drifting uses `ride`. Scene changes use the original white fade. No additional hard-cut choreography is invented.

Source: the archived Shabondama Biyori artifact, identified in `provenance.json`. No artifact-wide source license was found in the archive; this example does not add a reuse license. The copied Three.js modules retain their upstream MIT notices.
