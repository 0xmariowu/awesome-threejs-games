# Cloudkeep

This is the historical design and iteration log. Later entries supersede earlier
decisions. The project README describes the current game.

## Scope
A local, complete 3D sky sanctuary game: flight, feeding, growing creatures,
collecting pearls, upgrades, unlocking species, restoration goal, pause, restart,
and validated versioned local saves. TypeScript + Vite + Three.js. Blender assets.

## Visual specification
Reference: `concept.png` (1536 x 1024). Full-bleed sky, behind-the-airship camera,
warm yellow and ivory balloon, timber and teal gondola, soft blue whales, coral
rays, limestone floating gardens and a lighthouse. Restrained HUD in dark teal.
Tokens: ink #234f58, muted #56757b, sky #a4cfe3, paper #fffdf3,
gold #efb74a, coral #e9a082, meadow #769979. Display: Iowan Old Style / Georgia;
UI: Avenir Next / Trebuchet MS. All text and controls are native DOM elements.

Layout: brand top left, heading compass top center, pearls/upgrades/pause top
right, mission lower left, controls bottom center, radar lower right. Horizontal
HUD at desktop; compact top bar and thumb controls at mobile. Modal sheets
extend the same type, spacing, palette, and border treatment.

Allowed gameplay copy: Cloudkeep; THE FLOATING GARDENS; Sky pearls; Upgrades;
A home in the clouds; Befriend the sky.; Feed 5 sky creatures; Fly; Altitude;
Feed; Boost; Cloud garden. Counts and objectives change with real game state.
Additional functional states: introduction, journal, upgrades, pause, restart
confirmation, save failure, loading failure and completion.

## Visual rebuild: September 15

The original concept remains the art target. The user's fishslop video is the
minimum benchmark for character expression, fin detail, material separation,
environment layering and coherent atmospheric lighting. Functional completion
does not satisfy this visual acceptance criterion.

Keep the Blender + Three.js pipeline, native HUD, and existing game rules. Build
continuous organic silhouettes with vertex-painted skin, curved articulated
fins, expressive layered eyes, and restrained surface detail. Model the airship
as a crafted object with stitched canvas, timber courses, brass machinery,
rigging, cabin glass, cargo and a visible pilot. Replace repeated pointed cones
with stratified limestone gardens, mature branching trees, cypresses, varied
flowers, paths and distinct architecture. Use depth and light in a continuous
cloud sea; all scene components must share the same warm sun and blue sky fill.

Intentional medium adaptation: real Blender geometry and procedural volumetric
clouds implement the illustrated concept in a fully navigable 3D world. Retain
the generated sky asset for environment lighting. Asset detail must survive the
normal chase camera. Use geometry batching and distance culling to sustain play.

### Rebuild plan and verification

1. Replace the Blender asset library, including four garden variations. Verify:
   `npm run assets`; inspect exported GLB geometry/material metadata.
2. Rebuild atmosphere, materials, movement and camera framing. Verify:
   `npm run build`; desktop browser screenshots, GL diagnostics and frame timing.
3. Tune the integrated scene against the concept and fishslop video. Verify:
   browser screenshots at 1536 x 1024 and 390 x 844, including close creatures.
4. Complete gameplay regression and delivery. Verify: `npm test`,
   `npm run build`, browser flight/feeding/workshop/save/pause/restart checks.

### Additional visual acceptance

The user's review still found the light, models and effects insufficient.
Compare lighting from the identical in-game camera before selecting the final
sun direction. Preserve authored hard edges through the Blender batching step;
replace regular cliff profiles and flat tree crowns. Add a pooled effects system
for seed release, eating, pearl trails and flight wakes, with reduced-motion
support. Animate creature banking and a short feeding response. These changes
must remain readable in normal gameplay and sustain the existing frame budget.
Verify through the same build, tests and real browser interaction checks above;
inspect a recorded feeding sequence, not only static screenshots.

Boost feedback must be visible in normal flight: twin engine jets, gold/cyan
sparks, fading wakes and a restrained field-of-view change. Releasing Shift
decays the effect smoothly. Species have distinct trails and breath; meals
release hearts and a ripple. Verify held Shift + flight, release decay, feeding
effects and reduced-motion behavior in the browser.

### Free-flight correction

The fixed horizontal chase camera did not fulfill the intended 3D flying control.
Replace it in three bounded steps:

1. Add pointer/touch steering, optional mouse capture, free-look and zoom. Keep
   HUD interaction separate. Verify: browser drag, capture/release and UI checks.
2. Move along the ship's yaw and pitch, add strafing, and make the chase camera
   follow the complete orientation with obstacle avoidance. Preserve older
   saves. Verify: `npm test`, `npm run build`, 3D movement and save tests.
3. Update the control guide and verify keyboard + drag, mobile multi-touch,
   feeding, boost, pause and resume in the actual renderer.

Free-flight verification completed: 13 simulation tests and production build
passed. Browser checks verified yaw/pitch steering, forward and reverse motion,
strafing, mouse capture/release, independent orbit, zoom/recenter, HUD isolation,
old/new save compatibility, feeding and simultaneous two-finger flight at
390 x 844. A garden obstruction shortened the camera arm from 28.97 to 14.26
world units with a clear line of sight, then recovered after recentering.
The production playthrough completed seven meals while flying, with no browser
errors. Current gameplay videos are available in the repository's GitHub releases.

## Atomic implementation and verification
1. Model and export assets. Verify: Blender background build, GLB manifest checks.
2. Implement simulation and rendering. Verify: `npm run build` and flight checks.
3. Implement economy, progression and persistence. Verify: `npm test`.
4. Play the complete loop, pause/restart/reload; inspect desktop and mobile.
   Verify: browser interaction snapshots, console, screenshots, final build.

## Source references
- https://threejs.org/docs/pages/GLTFLoader.html
- https://threejs.org/docs/pages/WebGLRenderer.html
- https://vite.dev/guide/

### Airship 3C correction

The previous implementation applied up to 75 degrees of view pitch directly to
an otherwise buoyant airship. A stopped ship retained that pose. The camera also
interpolated world positions across the orbit, shortening its arm during abrupt
turns. These are control/character/camera coupling errors.

1. Separate flight heading from the visual hull attitude. Limit flight pitch to
   45 degrees, keep the hull within a small pitch/bank envelope, and settle it
   upright on release. C levels flight pitch as well as recentering the camera.
   Verify: simulation regression tests including extreme input and legacy saves.
2. Interpolate camera orbit angles and its focus anchor before constructing the
   camera position. Keep world-up and a bounded elevation; retain obstruction
   checks. Verify: camera tests for full turns, rapid reversal, angle sweeps and
   low-altitude framing.
3. Reproduce the user's stopped, steeply pitched pose in an isolated browser and
   repeat drag/capture, full turns, boost, recenter, touch and pause checks.
   Verify: `npm test`, `npm run build`, rendered before/after screenshots and
   browser console checks. Preserve the user's active sanctuary.

The follow-up left-turn report also exposed shortest-arc interpolation on
unwrapped input: a left drag larger than 180 degrees could send the camera
right. Preserve signed turns, reserve shortest-arc motion for explicit recenter,
and use a centered chase view. Dampen the ship's turn command without a rate-limited backlog;
steering resumes piloting from free-look. Verify both long left and right drags.

### Living sky, capture and sensory feedback

The user chose capture: a creature disappears, drops coins, then returns after
a delay. Keep Space as food bait; hold Q to capture a nearby creature ahead.
Preserve existing currency, upgrades and meals when migrating the old save.

1. Expand the population to 15, with five additional birds unlocked in the
   workshop. Add wandering, loose flocking, food seeking, boost avoidance and
   island avoidance. Implement capture, visible coin release and delayed respawn
   as explicit simulation states. Verify: `npm test`, including capture release,
   single rewards, respawn, legacy migration and saving an empty population.
2. Connect capture input, model absorption, species trails, coin meshes, pickup
   numbers and capture targeting to the real state. Add engine, boost, collision,
   capture, coin and quiet ambient audio with persisted mute and pause handling.
   Verify: `npm run build`; browser capture-to-coin-to-respawn, audio graph and
   held boost/release checks, plus touch controls at 390 x 844.
3. Replace the periodic limestone relief responsible for the visible grid with
   filtered, nonperiodic stone variation. Add high cirrus, soft sun haze and
   sparse drifting light motes. Verify: identical-camera material screenshots,
   upward/level/downward views, reduced motion and measured frame timing.
4. Run integrated gameplay and flight regressions. Verify: `npm test`,
   `npm run build`, left/right steering, capture persistence, workshop, pause,
   desktop/mobile screenshots and console health. Keep the user's save intact.

### Follow-up: space, variety and softer stone

The live review found the 15-creature population too dense and repetitive. The
new target supersedes that count: nine residents across five species, three
lantern birds unlocked later, and an optional extra whale. Add Blender-authored
cloud jellies, sky koi and sun moths with distinct silhouettes, animation and
sounds. Assign separate home ranges, reduce roaming overlap and limit how many
creatures respond to bait. Migrate prior populations while preserving earned
currency, upgrades, encounter totals and the most-grown existing residents.

The first stone fix removed the procedural grid. The follow-up screenshot also
asks for softer geometry: rebuild the cliff and buttresses with rounded profiles
and smooth normals, and reduce strong per-face color differences. Keep detail
in large natural shapes rather than small pits.

1. Author new creatures and smooth island geometry. Verify: `npm run assets`,
   exported model metadata and close in-game screenshots.
2. Redistribute species and add species-specific animation, VFX and responsive
   spatial calls. Verify: `npm test`, save migration, visible density, feeding,
   capture/respawn and captured audio with no clipping.
3. Repeat integrated browser QA, including desktop, touch, sound mute/pause,
   left/right steering and a production build. Verify: `npm run build` and the
   existing temporary Playwright scenarios.

### Follow-up: cloud depth, HUD and music

Use natural white clouds with subtle warm light and cool shadows. Depth comes
from raised world-space cloud banks, self-shadowing, parallax and foreground
billows, rather than differently colored regions. Retain navigation clarity.
Remove the large mission panel; progression remains in the workshop. Align the
coin icon to the numeric row with a fixed gap.

The user rejected the rhythmic celesta/harp miniature as distracting. Replace it
with a much quieter, spacious background, without a beat or insistent melody.
Wildlife calls and flight sounds remain in the foreground.
The user selected beatless long tones. Boost also needs more mechanical character:
blend motor harmonics, speed-dependent propeller pulses and gradual spool-down.

1. Remove tinted cloud regions and resolve cloud sampling bands. Verify: close,
   level and upward browser screenshots, shader errors and measured frame rate.
2. Replace the score after the sound preference check. Verify: captured audio,
   bounded voices, muted/reloaded state and pause/resume scheduling.
3. Verify the HUD, touch controls and integrated game. Verify: `npm test`,
   `npm run build`, existing browser scenarios and a production smoke test.

### Follow-up: readable materials and currency alignment

Center the coin against the complete two-line amount/caption block. The user
also found materials too dark: the old fill came from nearly the sun direction,
and weak brown ground illumination did not represent a bright cloud sea.
Use white cloud bounce, a gentle fill from the opposite side, a separate cool
rim and stronger material reflections. Keep exposure fixed and retain shadows.
Verify: identical-camera light comparisons, front/back flight views, desktop and
390 x 844 currency bounds, `npm run build` and browser console health.
