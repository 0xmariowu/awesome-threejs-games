# Verification record — 2026-09-25

## Environment and scope

Local Vite server at `http://127.0.0.1:5199`; Chrome through Playwright, classic WebGL with Metal enabled, desktop 1440×900. Mobile layout checks used 390×844. Browser plugin not available; the existing project Playwright dependency was used. No dependency or lockfile changes were needed.

The flow under test was: open the dedicated collection → load each real scene → operate its controls → observe changes in rendered output and actual runtime telemetry, with no application error. Separate checks exercised collection navigation back to the existing boot scene.

## Automated results

- `npm test`: **7 files, 163 tests passed** (152 pre-existing + 11 extraction tests).
- `npm run build`: TypeScript and production Vite build passed. Vite retains its large-chunk advisory; reference INKWAVE code is one lazy scene chunk.
- `node scripts/inkwave-audit.mjs --source ../inkwave`: **38 JS/TS modules, 67 resolved local references, 26 upstream source hashes matched**, no original global-context imports or hardcoded owner paths.
- `node scripts/inkwave-check.mjs`: **9 / 9 interactive scene checks passed**, no application console/page errors or failed network requests in the final suite.
- `git diff --check`: passed.
- The original sibling INKWAVE checkout remained clean.

The sole warning in the final interaction run was the existing Three Clock deprecation from the R3F host. A separate fresh-browser screenshot run also saw the host's missing favicon request; no experiment asset was missing. These are not scene rendering failures. No claim is made that warning suppression or a framework upgrade was performed.

## Interaction evidence

| Experiment | Observed result |
| --- | --- |
| 3C | Held forward moved from z = −9 to −6.459; jump event fired; steps checkpoint reached y = 0.5; ink-wall traversal reached y = 1.609. Foot planting and camera baseline toggles responded. |
| Materials | Actual environment theme changed to sunset, HDR post switched off, paint version advanced; 14 texture layers generated. Surface close-up inspected. |
| Paint | Moving probe queried an orange owned cell under hazard policy; speed changed from 3 to 1.05 and HP dropped below 100. Switching policy changes the live consumer, not just a label. |
| Combat | Blaster shots consumed ink, emitted recoil, turf, impact, damage and hit events; manual impact pulse emitted once. Actual projectile/FX output inspected. |
| AI | Switching to rescue disabled firing and produced live paths and changed world positions; bots selected both near/front destinations according to their distances and policy scores. |
| World | Seed advanced to 2; six props batched into eight meshes with 4,895 triangles; 713 nav nodes visible. Structural wireframe changed the rendering. |
| Audio | User gesture started a running AudioContext; two synthesized cues played, score changed and intensity control responded; stop control worked. |
| UI | Full wipe changed screen once; two skip presses committed the results once; cancel did not commit; keyboard activation produced a burst. Additional light/fade and reduced-motion checks passed. |
| Diagnostics | Pause kept tick count unchanged, single step advanced it by exactly one, actor load reached 12; three subsequent full rebuilds produced stable resource/subscription counts. |

Rebuild samples (same renderer):

| Rebuild | GPU geometry count | Texture count | World event subscriptions |
| --- | ---: | ---: | ---: |
| 1 | 56 | 30 | 25 |
| 2 | 56 | 30 | 25 |
| 3 | 56 | 30 | 25 |

This caught and fixed a real leak: the upstream environment disposed its main root but omitted the offscreen cloud-bake geometry and environment material. The adapter now disposes those scenes, shadow resources and instance buffers. These counts are renderer/event-bus metrics, not a complete JS heap or DOM-listener profiler.

Offline audio validation rendered 48,000 stereo samples at 48 kHz using the actual AudioEngine. Left-channel RMS was 0.008165, peak 0.092287, with zero non-finite samples and two played cues. This checks signal generation and levels; it is not a subjective listening review.

## Visual checks and reference differences

Desktop screenshots of the character course, close material samples, UI gallery, world/nav overlay and remaining scenes were captured. The character/material/UI images were visually inspected. Mobile 3C and UI screenshots were also inspected: no horizontal overflow, navigation collapsed by default, experiment controls scroll, and the results controls remain reachable. The mobile UI successfully completed a results sequence.

Intentional differences from the original game:

- New compact training course and lab navigation; original authored map, full match simulation and HUD are not embedded.
- Reference character/rig, material shaders and environment remain; modules have explicit dependencies and lifetime ownership.
- Smaller paint/texture/shadow targets; no original baked map lightmaps/murals. The WebGL toolkit follow-up below adds training-course AO baking and a GTAO comparison.
- The original simplified UI was replaced by the source menus in the follow-up below. Source art and composition are now retained; the lab supplies sample game data.
- Fixed-step simulation and diagnostic comparison modes are lab additions.

## Reproduction and artifacts

```sh
npm run dev -- --host 127.0.0.1 --port 5199
# In another shell:
node scripts/inkwave-check.mjs
# Or a targeted rerun:
node scripts/inkwave-check.mjs 3c diagnostics
node scripts/inkwave-audit.mjs --source ../inkwave
```

`INKWAVE_LAB_URL` changes the server URL. `INKWAVE_EVIDENCE_DIR` changes the browser-output directory. Default evidence lives outside the checkout at `/tmp/webgame-lab-inkwave/`: `interactions.json`, per-scene PNGs, `3c-default.png`, mobile PNGs/JSON, audio signal JSON and navigation JSON. These session artifacts are not versioned; the repeatable browser check regenerates its interaction evidence.

## Limits

This is not cross-device performance certification. Physical gamepad, pointer-lock permissions, mobile touch gameplay and arbitrary replacement skeletons were not hardware-validated. The source 3C algorithms and reference rig are retained; a different rig needs an adapter. The current render path is classic WebGL, not a completed WebGPU port. Unextracted full-match/profile/onboarding systems are listed in README rather than represented as finished modules.

## Follow-up: frozen menu interaction

The owner reported that UI motion was stuck. Browser reproduction found that the entrance animation used `fill-mode: both` on the interactive button itself. Its retained transform overrode hover and active transforms: idle, hover and press all measured an identity matrix. The earlier UI checks validated state changes and burst creation, but did not measure button movement.

Entrance animation now belongs to a wrapper and uses backwards fill for staggered delays. Hover, focus and press belong to the button, so these effects can compose without competing for the same transform.

The expanded `node scripts/inkwave-check.mjs ui` first failed on the old code with `Menu hover must move after entrance finishes`. After the fix it passed: hover/focus moved 8px and tilted 1 degree; press scaled to 0.97. The checks also passed after changing themes, for all three transition modes, natural result completion, skip/cancel, keyboard bursts and reduced motion. No application errors or failed requests occurred. The final rendered screenshot was inspected. `npm run build` passed with the existing chunk advisory.

Evidence: `/tmp/inkwave-ui-before.json`, `/tmp/inkwave-ui-red/interactions.json`, `/tmp/inkwave-ui-fixed/interactions.json` and `/tmp/inkwave-ui-fixed/ui.png`. A whole-page freeze was not reproduced in this browser run; this fix addresses the confirmed button-animation conflict.

## Correction: whole-page scrollbar resize loop

The owner clarified that the entire picture was shaking continuously. The button fix above did not resolve that report. Actual Chrome at 1535×909 / DPR 2 reproduced it: classic scrollbars repeatedly appeared and disappeared, resizing the canvas to 1520×894 and shifting the Html overlay by ±7.5px. A 4.68-second live sample captured 19 canvas size changes. Prior static screenshots happened to capture the same phase, and the even-sized headless viewport did not reproduce the loop.

The extracted `.iw-wipe__cv` omitted upstream `styles/ui.css:708`'s absolute positioning and block display. The inline canvas added a baseline gap: the 909px wipe host had a 913px scroll height even while hidden. Restoring those styles removes the overflow source. `index.html` now also constrains `html, body` overflow to preserve the fullscreen viewport; navigation and experiment panels continue to own their scrolling.

Verification:
- `INKWAVE_HEADED=1 INKWAVE_EVIDENCE_DIR=/tmp/inkwave-jitter-red-headed node scripts/inkwave-check.mjs ui` failed on the unfixed app with five alternating canvas/overlay/gallery layouts.
- The same headed check passed after the fix, including 2.5-second continuous stability samples before and after viewport resizing, zero wipe baseline overflow, all transition modes, natural results completion, skip/cancel, theme changes and keyboard interactions.
- Actual Chrome, via browser-harness: **240 consecutive frames, one unchanged canvas/overlay/gallery/viewport layout**, wipe height = scroll height = 909px, no app error. The updated screenshot was inspected. Evidence: `/tmp/inkwave-live-jitter.json`, `/tmp/inkwave-live-fixed.json`, `/tmp/inkwave-live-fixed.png`.
- At 390×844, 3C panel wheel scrolling, UI result completion and the existing boot scene's catalog wheel scrolling passed. Evidence: `/tmp/inkwave-overflow-qa.json` and `/tmp/inkwave-overflow-mobile-{3c,ui}.png`.
- Production build passed; existing large-chunk advisory remains. Final regression evidence: `/tmp/inkwave-jitter-fixed/interactions.json`.

The repeatable browser script uses a 1535×909, DPR 2 starting viewport to cover this case. Set `INKWAVE_HEADED=1` to exercise ordinary Chrome window behavior. Browser plugin was unavailable; Playwright and the existing local browser-harness skill were used.

## Follow-up: restore the original visual language

The cream card was a simplified replacement and did not preserve the original design. It has been removed. The gallery now mounts the original `Menus`, complete `menu-art`, SVG icons and scoped source stylesheet: Titan One/Rubik type, outlined ink logo, cyan/coral palette, thick offset buttons, pointer-origin ink fill, spring focus cursor, translucent dotted panels, source settings previews and result choreography. Main/title/loadout/setup/settings/how-to/credits/pause/results are available. The lab uses sample game data and its training course backdrop; original map and 3D loadout/podium scenes are outside this change.

Source callbacks are injected instead of importing the game singleton. Cursor/burst/wipe coordinates are relative to the bounded preview. Dispose cancels the menu loop, delayed work and wipe callbacks. Settings/loadout edits persist between source screens within the mounted gallery, not across reloads.

Validation:
- `node scripts/inkwave-check.mjs ui` passed: original type/menu structure, pointer and keyboard focus, source settings/loadout state, palette changes, three transitions, natural results completion, repeated skip, cancel and reduced motion. The cursor center aligned within 0.04px horizontally and 0.01px vertically.
- Continuous classic-scrollbar checks at 1535×909 and 1280×800 each had one fixed canvas/overlay/stage layout. The owner's Chrome also produced **240 frames over 3.986 seconds with one fixed layout**, no app error. Evidence: `/tmp/inkwave-restored-live.json` and `/tmp/inkwave-restored-live.png`.
- At 390×844, six detail screens had 358px client/scroll widths and working vertical wheel scrolling. Original horizontal layouts are stacked at this width. Evidence: `/tmp/inkwave-restored-final/interactions.json` and `ui-mobile-*.png` in that directory.
- Original main/title screenshots were compared visually with restored main/settings, and mobile settings/results were inspected. Reference captures: `/tmp/inkwave-original-{title,main}.png`; restored captures: `/tmp/inkwave-restored-{main,settings}.png`.
- Source audit: **41 modules, 73 resolved references, 29 upstream hashes matched**, no game-context imports or hardcoded owner paths. Production build, 163 unit tests and `git diff --check` passed. Existing bundle-size advisory remains.

Two separate headed automation attempts unexpectedly found the settings screen before the first main-menu assertion; their cause was not established, so those runs are not reported as passing. The complete interaction suite passed in isolated headless Chrome, and the user's attached Chrome supplied the live layout sample above. No subjective claim of full-game visual parity is made.

## WebGL game toolkit follow-up

Implemented a 16-entry WebGL games collection, an exclusively owned GLB clip adapter, five-second 3C replay comparison, geometry-derived AO baking versus realtime GTAO, cancellable skill feedback recipes, boost/recovery surface policies, and bounded frame-interval percentiles. Fixed controls retaining stale values after world rebuild and controlled inputs waiting for the telemetry poll before updating.

Evidence collected in Chrome on this machine:
- Rebuild regression first failed: the control displayed direct camera / 12 actors while the rebuilt world used tuned / 3. The same assertion passes after remounting controls with the world generation. Evidence: `/tmp/inkwave-toolkit-red/interactions.json`, `/tmp/inkwave-toolkit-final/interactions.json`.
- 3C loaded the existing Fox GLB, blended its run clip to 0.99998 weight, and completed both routes. Tuned maximum visual step compensation was 0.241327m; baseline was zero. This measures compensation, not a subjective quality score. The GLB uses source movement/camera, but has no source foot IK, squid pose or dedicated jump clip.
- The materials scene baked 386,160 geometry rays into a 512px AO atlas in approximately 332ms during this run. None/baked/realtime modes, resizing and existing light/post controls passed. Corner-vs-open unit checks validate the bake; disposal ownership was inspected. No cross-device timing or new AO allocation stress-test claim is made.
- The probe accelerated to 7.5 units/s. After a fresh reset and drained reserves, recovery raised HP from 35 to 41.13 and energy from 10 to 21.5. The browser assertion bounds the result below a full reset, avoiding a false positive when the probe wraps around its lane.
- Cancelled charged recipes emitted no delayed impact; three completed recipes emitted three impacts. Layer controls update immediately. The full run initially failed its old weapon assertion because an idle player could be splatted during the longer recipe tests. The test now resets the round and measures consumption while firing; it passed at 91 ink. Evidence: `/tmp/inkwave-toolkit-rerun/interactions.json` (paint and combat).
- The other seven scene checks passed in `/tmp/inkwave-toolkit-final/interactions.json`. These include original UI typography/focus/transitions, stable canvas layout at 1535×909 and 1280×800, six mobile menu screens, and three diagnostic rebuilds staying at 56 geometries / 30 textures / 25 subscriptions. Thus all nine scene checks passed across the full run and affected rerun; the initial full-run combat failure remains recorded.
- The catalog exposed 16 entries; opening retargeting preserved the WebGL collection and rendered 20 moving tracks through `webgl-classic`. Evidence: `/tmp/webgl-toolkit-navigation.json`.
- At 390×844, the new 3C, materials and combat controls were operable and their panels scrolled. Panel client/scroll widths were equal at 356px; document width remained 390px. Evidence: `/tmp/inkwave-toolkit-mobile.json` and corresponding PNGs. Desktop Fox/AO/skill and mobile 3C screenshots were inspected.
- 169 tests in 8 files passed; final production build passed with the existing chunk-size advisory. Source audit: 46 modules, 83 resolved references, 29 upstream hashes, no original context imports or hardcoded owner paths. `git diff --check` passed.

Reusable module contracts, disposal and limits are in README. Full match/progression integration and arbitrary-skeleton IK are not included in this batch. Frame P95 is a presentation interval measurement, not GPU timing or certification of mobile performance.
