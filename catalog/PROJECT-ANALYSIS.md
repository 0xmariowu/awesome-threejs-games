# Fifteen-project implementation analysis

This report covers all 15 references, including Tableparty Kart and the original exploration release of Cloudkeep. It identifies 62 candidate systems from retained implementation files. These are source-inspected proposals, not newly extracted and certified packages.

The existing webgame-lab has 45 scene entries. It contains prior Inkwave adaptations and a Cloudkeep camera adaptation; their changed scale, rendering and host assumptions must remain explicit. The library proposal is in [AI-GAME-LIBRARY.md](AI-GAME-LIBRARY.md).

## Runtime and source limits

| Project | Refreshed core probe | Source / material limitation |
| --- | --- | --- |
| [Hanakawa](../hanakawa/README.md) | Sample completed; full parity unverified | verified-deployed-files |
| [Monolith Wilds](../monolith-wilds/README.md) | Sample completed; full parity unverified | verified-deployed-files |
| [INKWAVE — Turf Riot](../inkwave/README.md) | Sample completed; full parity unverified | retained-git-import-original-site-unavailable |
| [Long Hoang / Lyo](../longhoang-lyo/README.md) | Sample completed; full parity unverified | deployed-bundles |
| [Vox Arcana](../vox-arcana/README.md) | Sample completed; full parity unverified | readable-deployed-modules |
| [Sakuragaoka Station](../sakuragaoka-station/README.md) | Sample completed; full parity unverified | source-repository-and-localized-snapshot |
| [Smartgame Town](../smartgame-town/README.md) | Sample completed; full parity unverified | deployed-client-with-backend-gap |
| [Everdrift](../everdrift/README.md) | Sample completed; full parity unverified | godot-web-export-and-extracted-resources |
| [SCORCH — Desert Pod Racing](../scorch-podracer/README.md) | Sample completed; full parity unverified | single-document-deployment |
| [Moritsuki / なちゃっとの夏休み](../moritsuki/README.md) | Sample completed; full parity unverified | readable-deployed-modules |
| [Tidewater](../tidewater/README.md) | Sample completed; full parity unverified | source-repository-and-deployment |
| [Shabondama Biyori / しゃぼん玉日和](../shabondama-biyori/README.md) | Sample completed; full parity unverified | browser-recovered-readable-modules |
| [Arkenfall](../arkenfall/README.md) | Sample completed; full parity unverified | original-deployed-modules |
| [Sunsprint / Tableparty Kart](../tableparty-kart/README.md) | Sample completed; full parity unverified | original-deployed-client-with-backend-gap |
| [Cloudkeep](../cloudkeep/README.md) | Sample completed; full parity unverified | local-source-snapshot-and-independent-production-build |

All core samples completed, but this is not full-feature coverage. Hanakawa cold startup is unresolved; three Moritsuki minigames remain visually failed; Smartgame, Vox and Kart have unavailable service implementations. Inkwave has no surviving original website, and Everdrift GDC bytecode is not recovered GDScript. The detailed limits below override a successful main-scene probe.

Short samples measured browser animation-frame intervals at 1280×800, DPR 1, original settings. These are not GPU timings or a native-Retina/mobile guarantee. Arkenfall refresh overlapped the exploratory Kart tab: use its earlier isolated audit for performance conclusions. No graphics settings were lowered to force success.

## Candidate selection

P0 means an initial extraction target with a valuable, relatively bounded contract. P1 needs a larger fixture/integration. P2 is coupled research or blocked work. Priority is a proposal, not a quality score. Every proposed validation below still has to pass in an extracted example.

## Hanakawa

**Reference:** `hanakawa` · `http://127.0.0.1:8082/index.html` · [source map](../hanakawa/TECHNICAL.md).

**Runtime boundary:** All 214 original runtime files match the current source. Native Chrome startup stalled beyond 80 seconds and recorded an 11.925-second main-thread task. Hidden-tab frame suspension occurs on both original and local. A later local run reached readiness and isolated default-graphics gameplay ran at 60 fps, but a cold-start repair is not established. Original game code and graphics settings unchanged.

### Boat forces and docking (P0)

**Observed:** Controls drive spool-up thrust, water-relative forces and forces at the hull; dockForces, boundaryForces and groundForces constrain movement. snapshot/interpolate separate simulation from display.

**Source:** [`boat-DaKAMpSv.js`](../hanakawa/assets/boat-DaKAMpSv.js), [`hullSpec-CNwDzYD8.js`](../hanakawa/assets/hullSpec-CNwDzYD8.js).

**Proposed extraction:** Inject water velocity, terrain and dock queries into the boat solver; retain units and original coefficients.

**Required context:** Rigid-body integration; world water/ground queries; hull mass and displacement data.

**Acceptance check:** Replay thrust, reverse, cross-current and dock/undock at fixed timesteps; compare position, heading and applied force traces.

### Bridge-aware boat camera (P0)

**Observed:** Damped camera modes use floorAt, bridgeCeiling and lineOfSight; angle wrapping and analytic damping avoid abrupt turns.

**Source:** [`camera-BZCFS0Jb.js`](../hanakawa/assets/camera-BZCFS0Jb.js).

**Proposed extraction:** Camera target plus obstruction-query interface; keep helm and chase modes together until transitions match.

**Required context:** Three vectors; boat pose; bridge and ground services.

**Acceptance check:** Drive under a low bridge, reverse and switch helm/chase; check clipping and continuity at 30/60/120 Hz.

### River surface and wake (P2)

**Observed:** Water rendering combines clipmap geometry, reflections, a boat mask and a wake grid with sources/weirs.

**Source:** [`water-BpetgGmD.js`](../hanakawa/assets/water-BpetgGmD.js).

**Proposed extraction:** One short river reach plus original water-query contract and a moving hull; preserve wake/shore inputs.

**Required context:** Three WebGPU/TSL; custom lighting; terrain channel data.

**Acceptance check:** Compare the same bank, boat wake and reflection at original DPR; inspect seams and moving-grid resets.

### Delivery, passage and docking progression (P1)

**Observed:** Quest data gates cargo/passages/docks/rewards; bridge crossing checks interpolate across movement segments.

**Source:** [`game-DXv9Pcsb.js`](../hanakawa/assets/game-DXv9Pcsb.js).

**Proposed extraction:** A delivery state machine emitting events, with injected storage and location facts.

**Required context:** Route/quest data; boat load state; bridge/dock identifiers.

**Acceptance check:** Replay deliveries, cross a gate in one large step, reload mid-route and ensure rewards are not duplicated.

### Baked vegetation and impostors (P2)

**Observed:** Runtime consumes pre-baked compressed fields/atlases and distant impostors, separate from source GLB vegetation assets.

**Source:** [`vegetation-C2QfA5c6.js`](../hanakawa/assets/vegetation-C2QfA5c6.js), [`manifest.json`](../hanakawa/assets/vegetation/baked/manifest.json), [`manifest.json`](../hanakawa/assets/vegetation/impostors/manifest.json).

**Proposed extraction:** A small near/far vegetation patch preserving the bake manifest and runtime decoder.

**Required context:** WebGPU materials; compressed binary layout; baked placement data.

**Acceptance check:** Record bytes, decode time, draw counts and silhouettes while crossing LOD thresholds.

## Monolith Wilds

**Reference:** `monolith-wilds` · `http://127.0.0.1:8081/index.html` · [source map](../monolith-wilds/TECHNICAL.md).

**Runtime boundary:** All 40 pre-existing runtime files matched the current original. Original Google Fonts dependencies were subsequently localized; game JavaScript and CSS are unchanged. Full landmark coverage is not certified. Post-repair offline gameplay has zero external requests and zero HTTP/page errors.

### Terrain streaming and worker jobs (P0)

**Observed:** Quadtree selection/refinement and eviction cooperate with a worker pool and geometry allocator; result buffers include morph positions/normals.

**Source:** [`terrain-MmovLCQt.js`](../monolith-wilds/assets/terrain-MmovLCQt.js), [`terrain-worker-DVcr_hr3.js`](../monolith-wilds/assets/terrain-worker-DVcr_hr3.js).

**Proposed extraction:** Terrain tile scheduler and geometry job contract around an injected height function.

**Required context:** Three WebGL buffers; worker transfer ownership; LOD morph data.

**Acceptance check:** Fly a repeatable path; compare cracks, popping, job queue length and bounded memory after revisiting tiles.

### Walk/fly/tour camera handoff (P0)

**Observed:** Walk/fly modes query terrain and obstacles; authored tour stops use orbit/push/crane/truck moves and bounded turning/FOV blending.

**Source:** [`controls-DX7CeMlr.js`](../monolith-wilds/assets/controls-DX7CeMlr.js), [`tour-Do76daLD.js`](../monolith-wilds/assets/tour-Do76daLD.js).

**Proposed extraction:** Input modes plus camera handoff policy; author stops as data instead of copying landmarks.

**Required context:** Terrain/obstacle queries; pointer lock; landmark coordinates.

**Acceptance check:** Interrupt every tour move with user input and switch walk/fly; verify no position snaps or stuck pointer lock.

### Water fields and worker baking (P2)

**Observed:** Water uses wave bands/reflections; the bake worker builds height/SDF-related spatial fields for the surface.

**Source:** [`water-CMdFOwUw.js`](../monolith-wilds/assets/water-CMdFOwUw.js), [`water-bake-worker-DfGbNK0h.js`](../monolith-wilds/assets/water-bake-worker-DfGbNK0h.js).

**Proposed extraction:** A bounded water region with the exact field-generation and sampling layout.

**Required context:** Three WebGL; worker field format; terrain sampling.

**Acceptance check:** Freeze time and compare shore/depth/reflection samples; measure bake cost separately from steady rendering.

### Procedural landmark construction (P1)

**Observed:** Separate landmark modules consume common construction helpers; authored structure lives in parameters and geometry code.

**Source:** [`builder-BZhEe_8v.js`](../monolith-wilds/assets/builder-BZhEe_8v.js), [`temple-BUB7d4Jj.js`](../monolith-wilds/assets/temple-BUB7d4Jj.js), [`observatory-Yis9EN5I.js`](../monolith-wilds/assets/observatory-Yis9EN5I.js).

**Proposed extraction:** One landmark using the original construction vocabulary and material registry.

**Required context:** Three geometry; shared builder/materials; world coordinate convention.

**Acceptance check:** Generate the same seed twice; compare bounding boxes, geometry counts, collisions and silhouette snapshots.

## INKWAVE — Turf Riot

**Reference:** `inkwave` · `http://127.0.0.1:8088/index.html` · [source map](../inkwave/TECHNICAL.md).

**Runtime boundary:** The original external website is gone, confirmed by the user. The 70 original runtime/support files match retained origin/main at 11ce485. External-origin equivalence cannot be recertified.

### Character locomotion and camera pipeline (P0)

**Observed:** Actor, procedural character, camera rig and player input are separate modules but share movement/form/weapon state. Existing lab factories preserve this composition.

**Source:** [`actor.js`](../inkwave/src/game/actor.js), [`character.js`](../inkwave/src/game/character.js), [`cameraRig.js`](../inkwave/src/game/cameraRig.js), [`player.js`](../inkwave/src/game/player.js).

**Proposed extraction:** Keep locomotion state separate from the rig; expose world queries and input ownership; use existing lab adapters as a migration example.

**Required context:** Three WebGL; paint/form policy; procedural rig semantics.

**Acceptance check:** Replay run/jump/form/aim transitions; compare root motion and camera framing. Inspect existing lab QA; do not assume arbitrary GLB compatibility.

### GPU painting and CPU surface ownership (P0)

**Observed:** Paint appearance and gameplay ownership are separate concerns; the CPU grid supports movement/team queries while the GPU represents marks.

**Source:** [`paint.js`](../inkwave/src/world/paint.js), [`levelMaterial.js`](../inkwave/src/world/levelMaterial.js).

**Proposed extraction:** Surface facts plus a rendering adapter; allow a second consumer such as hazard/boost zones.

**Required context:** Render targets; level UV mapping; team ownership grid.

**Acceptance check:** Stamp boundaries, overlapping teams and corners; confirm visual color agrees with queried ownership, including a second gameplay consumer.

### Weapon events and audiovisual feedback (P1)

**Observed:** Weapons, effect hooks and audio are separated files around gameplay events; existing lab work distinguishes presentation sequences from damage rules.

**Source:** [`weapons.js`](../inkwave/src/game/weapons.js), [`fxHooks.js`](../inkwave/src/fx/fxHooks.js), [`audio.js`](../inkwave/src/audio/audio.js).

**Proposed extraction:** Typed weapon events feeding effects/audio adapters; keep authoritative hit resolution outside presentation.

**Required context:** Actor/hit queries; pool ownership; paint world.

**Acceptance check:** Use one recorded shot/hit sequence, check damage once and compare impact, sound and paint ordering.

### Navigation and bot decision-making (P1)

**Observed:** Bots consume navigation and level data rather than only chasing screen coordinates; level construction also defines collision context.

**Source:** [`nav.js`](../inkwave/src/game/nav.js), [`bots.js`](../inkwave/src/game/bots.js), [`level.js`](../inkwave/src/world/level.js).

**Proposed extraction:** Navigation queries and bot policy against a small original layout.

**Required context:** Level geometry; team/objective state; weapon reach.

**Acceptance check:** Run seeded rounds; record unreachable objectives, wall collisions, stuck durations and route choice.

## Long Hoang / Lyo

**Reference:** `longhoang-lyo` · `http://127.0.0.1:8090/index.html` · [source map](../longhoang-lyo/TECHNICAL.md).

**Runtime boundary:** Entry, tutorial and movement were exercised with external network access blocked. Full combat progression, every portfolio panel and the contact submission backend are not exhaustively verified. Original development sources/source maps were not available; minified production bundles are retained.

### Terrain-following robot controller (P1)

**Observed:** Production bundle retains ground support/step/drop logic, Rapier bodies and fixed-step accumulation with display interpolation.

**Source:** [`B-Z8xTec.js`](../longhoang-lyo/public/assets/B-Z8xTec.js).

**Proposed extraction:** A recovered controller around Rapier and support-query inputs; retain the original bundle as the reference.

**Required context:** Rapier collider groups/CCD; Three transforms; robot asset dimensions.

**Acceptance check:** Drive slopes, ledges and steps at different render rates; compare support contacts and interpolated pose.

### Vehicle tracks and independent turret (P1)

**Observed:** Bundle implements track segments/model data and aim/steering relationships for player and enemy robots.

**Source:** [`B-Z8xTec.js`](../longhoang-lyo/public/assets/B-Z8xTec.js).

**Proposed extraction:** Track animation driven by travel/turn measurements plus a separately aimed turret.

**Required context:** Original model pivots; instanced geometry; robot movement state.

**Acceptance check:** Turn in place, reverse and aim across the hull; compare track phase and turret orientation.

### Compressed model/texture loading pipeline (P2)

**Observed:** Deployed assets include GLB models and KTX2 textures with a local Basis transcoder.

**Source:** [`B-Z8xTec.js`](../longhoang-lyo/public/assets/B-Z8xTec.js), [`basis_transcoder.js`](../longhoang-lyo/public/basis/basis_transcoder.js).

**Proposed extraction:** A loader example retaining decoder versions and compressed-texture support checks.

**Required context:** Three loaders; KTX2/Basis runtime; model/material metadata.

**Acceptance check:** Cold-load offline on target GPU, count missing requests and verify compressed textures visually; keep fallback behavior explicit.

### Robot styling and gameplay transitions (P2)

**Observed:** The bundle contains material/outline modifications and effect timelines tied to robot gameplay and portfolio transitions.

**Source:** [`B-Z8xTec.js`](../longhoang-lyo/public/assets/B-Z8xTec.js).

**Proposed extraction:** One robot material/effect sequence with named inputs, separated from portfolio navigation.

**Required context:** Version-specific shader hooks; GSAP timelines; asset licenses unconfirmed.

**Acceptance check:** Freeze matching poses and lighting, compare outlines, effects and transition cleanup after repeated entry/exit.

## Vox Arcana

**Reference:** `vox-arcana` · `http://127.0.0.1:8091/index.html` · [source map](../vox-arcana/TECHNICAL.md).

**Runtime boundary:** Practice, movement and an actual fireball cast passed with external requests blocked. /api/status and /api/spell have no archived server implementation. Jev AI inference and the server-backed local-model option are unavailable. Browser voice recognition is not certified offline, and microphone input was not tested. This is a playable original client with a documented backend gap.

### Local spell language to structured specification (P0)

**Observed:** localParse maps bilingual phrases to element/shape/morph/trajectory/payload parameters. Jev parsing is a separate unavailable service path.

**Source:** [`spellbook.js`](../vox-arcana/public/js/spellbook.js), [`elements.js`](../vox-arcana/public/js/elements.js).

**Proposed extraction:** Pure parse/normalize/validate specification stage; preserve the local rule parser without calling it AI inference.

**Required context:** Element/form tables; localization; explicit provider boundary.

**Acceptance check:** Table-driven phrases and contradictory/out-of-range inputs; serialize normalized results and compare original casts.

### Parameterized spell execution and effects (P1)

**Observed:** SpellSystem implements behavior from the normalized specification; VFX helpers represent the same parameters visually.

**Source:** [`spells.js`](../vox-arcana/public/js/spells.js), [`vfxkit.js`](../vox-arcana/public/js/vfxkit.js).

**Proposed extraction:** One projectile plus one self/utility form through the original specification pipeline.

**Required context:** Three; world collision; combat targets; effect pools.

**Acceptance check:** Cast the same specification with fixed seed; compare trajectory, contacts, duration and effects at multiple frame rates.

### Element reaction and combat rules (P0)

**Observed:** reactionFor and applyHit combine aura/element data with Combatant state and enhancements.

**Source:** [`elements.js`](../vox-arcana/public/js/elements.js), [`combat.js`](../vox-arcana/public/js/combat.js).

**Proposed extraction:** Reaction resolution and damage/status events, independent of spell text entry.

**Required context:** Element/shape balance data; combatant state.

**Acceptance check:** Cover reaction order, immunity, repeated hits and status expiration; assert exact health/status results.

### Worker-painted magic circles (P1)

**Observed:** Circle geometry/presentation and paint generation are separated into runtime and worker modules.

**Source:** [`magicCircle.js`](../vox-arcana/public/js/magicCircle.js), [`circleWorker.js`](../vox-arcana/public/js/circleWorker.js), [`circlePaint.js`](../vox-arcana/public/js/circlePaint.js).

**Proposed extraction:** One circle renderer with a serializable paint job and bounded result cache.

**Required context:** Canvas worker support; Three texture lifecycle; spell/style parameters.

**Acceptance check:** Repeat identical jobs, replace spells rapidly and dispose while a worker finishes; check no stale texture or memory growth.

## Sakuragaoka Station

**Reference:** `sakuragaoka-station` · `http://127.0.0.1:8092/index.html` · [source map](../sakuragaoka-station/TECHNICAL.md).

**Runtime boundary:** Offline entry and walking passed. Upstream npm run check passed for the world modules. The original upstream index still uses CDN URLs; launch the localized public snapshot with npm start in this outer folder. Train timing, all interiors and touch controls are not exhaustively tested.

### Procedural world build contract (P0)

**Observed:** World modules share construction/context helpers and register static geometry, dynamic objects and update work.

**Source:** [`ctx.js`](../sakuragaoka-station/public/src/core/ctx.js), [`geo.js`](../sakuragaoka-station/public/src/core/geo.js), [`main.js`](../sakuragaoka-station/public/src/main.js).

**Proposed extraction:** Document and reproduce one block builder using explicit services and deterministic time/randomness.

**Required context:** Three 0.170; material and physics services; fixed world coordinates.

**Acceptance check:** Build twice with the same seed; compare object/collider counts and validate teardown of registered updates.

### Material-aware batching and texture atlases (P0)

**Observed:** batchStatic bakes material colors into vertex colors, packs eligible canvas textures into atlas pages, and partitions near/far spatial cells. It excludes skinned/instanced/morph/custom cases.

**Source:** [`batch2.js`](../sakuragaoka-station/public/src/core/batch2.js).

**Proposed extraction:** Extract batchStatic with its eligibility checks and material signatures intact.

**Required context:** Three 0.170; toon material factory; Canvas 2D; UV/color-space semantics.

**Acceptance check:** Compare before/after screenshots and draw calls; test transparent materials, repeated UVs and non-batchable objects.

### Lightweight walking and colliders (P1)

**Observed:** The custom physics layer exposes boxes, ramps/stairs and cylinders for a walkable procedural scene.

**Source:** [`physics.js`](../sakuragaoka-station/public/src/core/physics.js), [`player.js`](../sakuragaoka-station/public/src/core/player.js).

**Proposed extraction:** A walker with primitive query inputs and stair/ramp fixtures.

**Required context:** World scale; player shape; pointer lock/touch input.

**Acceptance check:** Walk ramps, stairs, corners and dynamic obstacles; verify grounding and speed independent of render rate.

### Scheduled train choreography (P1)

**Observed:** Train construction is separate from schedule data/logic, enabling timed world activity in the station scene.

**Source:** [`schedule.js`](../sakuragaoka-station/public/src/world/trains/schedule.js), [`builder.js`](../sakuragaoka-station/public/src/world/trains/builder.js), [`car.js`](../sakuragaoka-station/public/src/world/trains/car.js).

**Proposed extraction:** One train and platform driven by a shared clock; retain the original timing relationship.

**Required context:** Rail/station coordinates; train geometry; world updates.

**Acceptance check:** Sample arrival, dwell and departure through a complete original cycle, then jump time and resume.

## Smartgame Town

**Reference:** `smartgame-town` · `http://127.0.0.1:8093/town/index.html` · [source map](../smartgame-town/TECHNICAL.md).

**Runtime boundary:** The scene, avatar editor and named-avatar town entry render locally with external requests blocked. Account, room registration, announcements, online players/chat, voice, cloud saves and payments need unavailable PHP services. The original client may display a connecting state. Individual arcade destinations and the separate farm are outside this town capture. No fake server responses or production proxy were added.

### Layered avatar compositing and caches (P0)

**Observed:** Avatar code transforms/flips part canvases and caches results with bounded map eviction; original part assets supply the visual vocabulary.

**Source:** [`town.js`](../smartgame-town/public/town/js/town.js).

**Proposed extraction:** Avatar composition from explicit part IDs and transforms with bounded cache ownership.

**Required context:** Canvas 2D; part catalog and images; original layer order.

**Acceptance check:** Compare multiple outfits, mirrored offsets and cache eviction; verify every part resolves offline.

### Room dimensions and furnishing state (P1)

**Observed:** Room tiers define cell counts and upgrades; furnishing placement shares world/UI state inside the bundle.

**Source:** [`town.js`](../smartgame-town/public/town/js/town.js).

**Proposed extraction:** A local room-data editor and placement validator, independent of account purchase operations.

**Required context:** Room/grid schema; furniture catalog; collision and UI state.

**Acceptance check:** Load layouts at each supported room size, validate occupied cells and preserve transforms through save/reload.

### Modal UI and world input ownership (P1)

**Observed:** Town entry/avatar editing and modal flows coexist with world input; some state changes are gated on asynchronous account operations.

**Source:** [`town.js`](../smartgame-town/public/town/js/town.js).

**Proposed extraction:** Explicit active-input owner and cancellation policy around editor/gameplay transitions.

**Required context:** DOM event routing; avatar state; account lifecycle for online branches.

**Acceptance check:** Hold movement while opening/closing editor/dialogs; verify no stuck keys or movement behind blocking menus.

### Account-epoch asynchronous service boundary (P2)

**Observed:** Client write queues and epoch checks guard asynchronous account changes, but PHP implementations are absent.

**Source:** [`town.js`](../smartgame-town/public/town/js/town.js).

**Proposed extraction:** Document the request/state machine as a reference; do not provide fake successful account/chat/payment endpoints.

**Required context:** Unavailable PHP backend; session/auth semantics; local persistence.

**Acceptance check:** Offline client must report unavailable operations; a future authorized server integration must test account changes during in-flight writes.

## Everdrift

**Reference:** `everdrift` · `http://127.0.0.1:8094/index.html` · [source map](../everdrift/TECHNICAL.md).

**Runtime boundary:** Main menu, opening dialogue, the first village, movement/jump input and coin collection ran locally with external requests blocked. Both audio worklets and the runtime version.json were captured. Extracted GDC files are compiled bytecode, not editable GDScript source; no decompilation or source-equivalence claim is made. Full campaign completion has not been tested.

### Instanced wind volumes (P0)

**Observed:** Godot MultiMesh custom attributes encode spawn/lifetime/twist/style; shader deforms tube geometry into multiple wind effects with age-based fade.

**Source:** [`fx_wind.gdshader`](../everdrift/extracted/shaders/fx_wind.gdshader).

**Proposed extraction:** A shader algorithm port with explicit instance attribute schema; source shader remains the authority.

**Required context:** Godot shader built-ins; MultiMesh geometry; alpha blending.

**Acceptance check:** Freeze age/seed/style and compare silhouettes and fade; test every style before a GLSL/TSL adaptation is called equivalent.

### Depth-based toon water (P1)

**Observed:** Depth reconstruction controls shallow/deep colors and shoreline foam; Voronoi edges add crest lines and vertex swell perturbs normals.

**Source:** [`world_water.gdshader`](../everdrift/extracted/shaders/world_water.gdshader).

**Proposed extraction:** Water material plus depth-input adapter; handle target engine projection/depth conventions explicitly.

**Required context:** Godot depth texture; world lighting include; render ordering.

**Acceptance check:** Compare shallow/deep/shore samples from a fixed camera; validate depth reconstruction before adjusting style.

### Instanced foliage motion and tint (P1)

**Observed:** Vertex height controls bending; per-instance RGB and vertex alpha select tinted parts, while an up-biased normal blends vegetation with ground.

**Source:** [`world_foliage.gdshader`](../everdrift/extracted/shaders/world_foliage.gdshader).

**Proposed extraction:** One instanced grass/flower patch with authored vertex masks and shared clock.

**Required context:** Godot instance attributes; world lighting include; original mesh masks.

**Acceptance check:** Compare roots/tips, per-instance color and ground transition at fixed time.

### Screen transitions and speed feedback (P1)

**Observed:** Readable shaders preserve transition and movement feedback even though game scripts are compiled GDC bytecode.

**Source:** [`ui_transition.gdshader`](../everdrift/extracted/shaders/ui_transition.gdshader), [`fx_speedlines.gdshader`](../everdrift/extracted/shaders/fx_speedlines.gdshader).

**Proposed extraction:** Shader examples first; flight/movement behavior remains a separate decompilation investigation.

**Required context:** Godot screen coordinates; uniform timing; compiled controller not recovered.

**Acceptance check:** Sweep transition/speed uniforms and verify aspect-ratio behavior; do not claim original movement source recovery.

## SCORCH — Desert Pod Racing

**Reference:** `scorch-podracer` · `http://127.0.0.1:8095/index.html` · [source map](../scorch-podracer/TECHNICAL.md).

**Runtime boundary:** Selection, race movement and pause passed with zero external requests or HTTP failures. Netlify toolbar was removed; game code retained. Full three-lap finish, all six vehicles and touch controls are not exhaustively tested.

### Arcade racer forces and track coordinates (P0)

**Observed:** stepRacer resolves forward/lateral velocity, drag, speed-dependent yaw, off-road/air modifiers and boost energy; track projection supplies progress and lateral offset.

**Source:** [`index.html`](../scorch-podracer/public/index.html).

**Proposed extraction:** Track query interface plus one racer state/input step preserving coefficients.

**Required context:** Track tables; vehicle stats; collision/barrier queries.

**Acceptance check:** Replay throttle/brake/reverse/boost and off-road motion; compare progress and velocity traces at fixed step.

### Look-ahead racing AI (P0)

**Observed:** aiInput chooses a look-ahead point, changes lanes, avoids racers and estimates corner speed before choosing throttle/brake/boost.

**Source:** [`index.html`](../scorch-podracer/public/index.html).

**Proposed extraction:** AI produces the same input schema as the player against track/racer queries.

**Required context:** Track curvature; vehicle yaw/speed limits; nearby racers.

**Acceptance check:** Seed lanes, run multiple laps and report wall impacts/stuck time; test narrow sections and overtakes.

### Racing chase/cockpit/finish camera (P1)

**Observed:** updateCamera blends target heading/height, speed FOV, boost and shake, with distinct menu, cockpit and finish policies.

**Source:** [`index.html`](../scorch-podracer/public/index.html).

**Proposed extraction:** Camera mode state plus race pose/velocity/event inputs.

**Required context:** Three camera; track height; vehicle pose; race phase.

**Acceptance check:** Compare menu→countdown→race→finish and reverse view; verify no angle-wrap snap and retain original shake.

### Procedural track and stable shadow framing (P1)

**Observed:** buildTrackMesh uses sampled centerline/lateral geometry; updateSunShadow snaps shadow framing to a texel grid.

**Source:** [`index.html`](../scorch-podracer/public/index.html).

**Proposed extraction:** One generated track section and its matching collision/query representation.

**Required context:** Three embedded version; track samples; shadow-map resolution.

**Acceptance check:** Compare visible road and drivable boundaries; move camera slowly to inspect shadow shimmer without reducing quality.

## Moritsuki / なちゃっとの夏休み

**Reference:** `moritsuki` · `http://127.0.0.1:8096/moritsuki/index.html` · [source map](../moritsuki/TECHNICAL.md).

**Runtime boundary:** Town rendering, fast-travel UI and entry/input in all five minigames were exercised with external requests blocked and no runtime HTTP failures. The hamaguri, gazami and kusafugu minigames show black 3D scenes after their intro fades finish in the tested Chrome environment, although HUD/input and requests work. The original hamaguri site reproduces the same black scene with both default Chrome graphics settings and ANGLE Metal; the cause is unresolved. Town, unagi and mori render visibly. Do not count these three minigames as visually passed. The original page explicitly says story content is unfinished. Public repository lookup did not resolve; readable deployed modules were archived. Geographic credit links are not game dependencies and were excluded from the runtime archive.

### Shared progression across minigames (P0)

**Observed:** Separate shared modules connect items/progress and town return flow across five game entries.

**Source:** [`progress.js`](../moritsuki/public/moritsuki/src/shared/progress.js), [`items.js`](../moritsuki/public/moritsuki/src/shared/items.js), [`townLink.js`](../moritsuki/public/moritsuki/src/shared/townLink.js).

**Proposed extraction:** Versioned progression store and return-location messages with game-specific adapters.

**Required context:** LocalStorage origin; item IDs; town routing.

**Acceptance check:** Earn an item in a minigame, return to town and reload; verify idempotence and shared-state consistency.

### Worker-generated procedural characters (P1)

**Observed:** Character model construction is split into worker jobs and runtime assembly, including separate kid and NPC pipelines.

**Source:** [`kid.worker.js`](../moritsuki/public/moritsuki/src/town/kid/kid.worker.js), [`people.worker.js`](../moritsuki/public/moritsuki/src/town/people/people.worker.js), [`model.js`](../moritsuki/public/moritsuki/src/town/kid/model.js).

**Proposed extraction:** One parameterized character job with a versioned transferable result schema.

**Required context:** Geometry/texture buffers; worker ownership; material assembly.

**Acceptance check:** Build identical parameters twice, cancel/restart generation and compare buffer bounds and visible shape.

### Procedural fish surface generation (P1)

**Observed:** Fish texture generation is available as readable worker code in both common and eel-game pipelines.

**Source:** [`fishpaint.worker.js`](../moritsuki/public/moritsuki/src/fish/fishpaint.worker.js), [`fishpaint.worker.js`](../moritsuki/public/moritsuki/src/unagi/fish/fishpaint.worker.js).

**Proposed extraction:** One species texture generator with explicit seed/palette/UV contract.

**Required context:** Worker Canvas support; species mesh UV layout; material parameters.

**Acceptance check:** Compare seeded surface maps and the rendered fish from several angles; retain species-specific parameters.

### Depth-composited water investigation (P2)

**Observed:** WaterPass reads color/depth, beach height and murk inputs and reconstructs camera rays. Disabling WaterPass made the scene visible in diagnostic runs; the original site also reproduces black output.

**Source:** [`water.js`](../moritsuki/public/moritsuki/src/hamaguri/water.js), [`post.js`](../moritsuki/public/moritsuki/src/hamaguri/post.js).

**Proposed extraction:** Quarantined reference until the depth/material path is diagnosed; not a ready reusable water module.

**Required context:** Three 0.170; HalfFloat render target; depth texture; matrix uniforms.

**Acceptance check:** Reduce to a minimal original pass chain and inspect finite color/depth values. Preserve the effect and original graphics; never use effect removal as the fix.

## Tidewater

**Reference:** `tidewater` · `http://127.0.0.1:8097/tidewater/index.html` · [source map](../tidewater/TECHNICAL.md).

**Runtime boundary:** The original game-logic and engine-smoke tests passed. Offline browser exploration and inventory run with installed Chrome. Bundled headless Chromium fails on both upstream and local because it exposes only 16 sampled textures per shader stage; installed Chrome exposes 48. No engine or image-quality downgrade was applied. Boat trips, a complete caught-fish sale and all weather conditions remain unverified.

### Fishing tension state machine (P0)

**Observed:** CatchMinigame.update integrates tension, line distance, fish stamina and surges with injected RNG; outcomes include caught, snapped and escaped.

**Source:** [`CatchMinigame.js`](../tidewater/upstream/src/game/CatchMinigame.js), [`FishTable.js`](../tidewater/upstream/src/game/FishTable.js).

**Proposed extraction:** Pure fishing simulation plus a tiny input/HUD adapter.

**Required context:** FishTable balance data; seconds/metres/kg conventions; injected RNG.

**Acceptance check:** Seed fish surges; exercise all terminal outcomes, sustained overload/slack and multiple timesteps.

### Inventory, fish records and saves (P0)

**Observed:** GameState owns inventory capacity, fish records, money/upgrades/fuel and storage; records can update even when a catch exceeds hold capacity.

**Source:** [`GameState.js`](../tidewater/upstream/src/game/GameState.js).

**Proposed extraction:** Inject storage and events; isolate economy from rendering/boat controls.

**Required context:** Item/fish/upgrade tables; save version; storage failures.

**Acceptance check:** Catch with full hold, sell, buy, reload malformed/old saves; check balances and non-duplicated records.

### FFT ocean with asynchronous surface queries (P2)

**Observed:** GPU ocean displacement feeds query compute/readback. WaterQuery records result time, inputs, version and latency because CPU results arrive 1–3 frames later.

**Source:** [`OceanFFT.js`](../tidewater/upstream/src/ocean/OceanFFT.js), [`WaterQuery.js`](../tidewater/upstream/src/ocean/WaterQuery.js), [`BoatController.js`](../tidewater/upstream/src/player/BoatController.js).

**Proposed extraction:** Keep ocean surface sampling, latency handling and boat integration as a coupled example initially.

**Required context:** Custom WebGPU engine; WGSL/storage buffers; readback ring; boat settings.

**Acceptance check:** Compare visible water and buoyancy sample heights with timestamps; stress readback delays and wave changes.

### Near-shore water and boat wakes (P2)

**Observed:** Dedicated near-shore and wake simulations participate in the ocean surface/query architecture.

**Source:** [`ShoreSim.js`](../tidewater/upstream/src/ocean/ShoreSim.js), [`WakeSim.js`](../tidewater/upstream/src/ocean/WakeSim.js).

**Proposed extraction:** A small shoreline plus one boat with the original GPU pass scheduling.

**Required context:** Custom compute wrappers; terrain depth; FFT surface; query composition.

**Acceptance check:** Compare shoreline/wake interactions at fixed path/time, including grid recentering and GPU resource lifetime.

## Shabondama Biyori / しゃぼん玉日和

**Reference:** `shabondama-biyori` · `http://127.0.0.1:8098/_f/1790342986-3d06/index.html` · [source map](../shabondama-biyori/TECHNICAL.md).

**Runtime boundary:** Scene readiness, bubble input, camera drag and menu passed with no external requests or HTTP failures. The Claude embedding runtime was removed from the local entry; original game modules remain intact. Development-only /api/video, /api/still and /api/log capture helpers do not have a local backend and are not used by normal play. A retina input sample recorded a 200 ms frame interval; later steady frames do not erase this input-sample observation.

### Cinematic camera director with user handoff (P0)

**Observed:** Director coordinates authored spots and title/blow/follow/inside/drift/pop states with manual gaze, FOV, focus and film/fade values.

**Source:** [`director.js`](../shabondama-biyori/public/_f/1790342986-3d06/src/sim/director.js).

**Proposed extraction:** Bubble target plus a camera/director state machine, keeping manual-input handoff explicit.

**Required context:** Bubble state; world landmarks; ground/obstacle queries; post-processing uniforms.

**Acceptance check:** Replay blow→follow→inside→pop, interrupt with drag, and verify smooth framing and no stuck input.

### Shared wind field and bubble flight (P0)

**Observed:** Wind exposes gust and curl fields; Flight combines terrain slopes, gorge flow, thermals and obstacle-aware motion. Visual vegetation and moving bubbles share wind concepts.

**Source:** [`wind.js`](../shabondama-biyori/public/_f/1790342986-3d06/src/sim/wind.js), [`flight.js`](../shabondama-biyori/public/_f/1790342986-3d06/src/sim/flight.js).

**Proposed extraction:** Wind query with explicit clock/seed, plus flight adapter injecting terrain and obstacles; extract gorge assumptions into data.

**Required context:** Noise functions; authored layout; JS/GLSL field agreement.

**Acceptance check:** Sample CPU/GPU wind at matching points/time; replay bubble paths near slopes, trees and rising thermals.

### Thin-film bubble rendering (P1)

**Observed:** FILM_GLSL and filmD compute reflection/thickness; BubbleRenderer uses instance data, 3D film noise and depth/environment inputs.

**Source:** [`bubbles.js`](../shabondama-biyori/public/_f/1790342986-3d06/src/render/bubbles.js).

**Proposed extraction:** One bubble material and instanced list adapter, retaining sorting and depth dependencies.

**Required context:** Three r186; depth/environment textures; 3D film noise; transparent ordering.

**Acceptance check:** Compare front/back reflection at fixed age and light; test intersecting bubbles and foreground depth at original DPR.

### Simulation/render separation for ambient wildlife (P1)

**Observed:** Bird behavior and species rendering live in separate simulation and render modules.

**Source:** [`fauna_birds.js`](../shabondama-biyori/public/_f/1790342986-3d06/src/sim/fauna_birds.js), [`species_birds.js`](../shabondama-biyori/public/_f/1790342986-3d06/src/render/species_birds.js).

**Proposed extraction:** One ambient species producing pose/state snapshots into an instanced or pooled renderer.

**Required context:** World/wind queries; species shape conventions; shared time.

**Acceptance check:** Freeze/replay simulation snapshots and compare visible poses; measure update/render cost separately.

## Arkenfall

**Reference:** `arkenfall` · `http://127.0.0.1:8099/index.html` · [source map](../arkenfall/TECHNICAL.md).

**Runtime boundary:** All 88 deployed files retain original bytes. Offline gameplay sampled: opening, movement, jump, attack, dodge, map, inventory, quest-triggered autosave and Continue after reload. Complete world, boss progression, gamepad and touch controls are not certified. No development source repository or project-wide license confirmed.

### Action combat, input windows and hit sweeps (P0)

**Observed:** Combat combines buffered actions, parry/charge/combo policies, swept attack trails and root motion; Actor resolves health/poise and hit outcomes.

**Source:** [`combat-DANZZ0C7.js`](../arkenfall/public/assets/combat-DANZZ0C7.js), [`Actor-CPc2Vruf.js`](../arkenfall/public/assets/Actor-CPc2Vruf.js), [`anim-exnbZ3yq.js`](../arkenfall/public/assets/anim-exnbZ3yq.js).

**Proposed extraction:** One weapon/enemy fixture exposing input, pose samples, sweep queries and combat events.

**Required context:** Procedural animation pose; actor registry; collision/target selection; time policies.

**Acceptance check:** Replay combo/charge/parry/dodge windows at fixed step; ensure a sweep hits once and preserves stagger/knockback.

### Combat lock-on and obstruction recovery (P0)

**Observed:** Camera uses lock candidates, trunk obstruction queries, pivot clamps and recovery/handoff logic with FOV and shake.

**Source:** [`camera-CsWg7FPD.js`](../arkenfall/public/assets/camera-CsWg7FPD.js).

**Proposed extraction:** Target pose plus candidate/obstruction services; separate shot policy from world geometry.

**Required context:** Three vectors; lock state; world trunk/obstacle queries.

**Acceptance check:** Circle a target near trees, switch lock and enter boss framing; check near-plane clipping and recovery continuity.

### Versioned procedural resource cache (P0)

**Observed:** Small IndexedDB helper versions keys, clears older prefixes and fails softly when cache access is unavailable.

**Source:** [`cache-DIhMlTLC.js`](../arkenfall/public/assets/cache-DIhMlTLC.js).

**Proposed extraction:** A cache adapter returning optional results; keep generated resource format/version in the caller.

**Required context:** IndexedDB; generation version prefix; worker result serialization.

**Acceptance check:** Test empty/warm/old-version/denied storage and late worker completion; gameplay must still initialize.

### Ordered simulation/render stages (P1)

**Observed:** Named numeric stage order places input/player/combat/enemies before camera/effects/audio/UI and final render.

**Source:** [`contracts-CvM_HOZo.js`](../arkenfall/public/assets/contracts-CvM_HOZo.js).

**Proposed extraction:** Explicit phase registration with deterministic order and lifecycle ownership.

**Required context:** World services; fixed/variable time split; cross-stage state dependencies.

**Acceptance check:** Trace stage ordering, pause/resume and disposal; reject duplicate/unregistered handlers in a future adapter.

## Sunsprint / Tableparty Kart

**Reference:** `tableparty-kart` · `http://127.0.0.1:8100/kart/index.html` · [source map](../tableparty-kart/TECHNICAL.md).

**Runtime boundary:** All 292 archived deployed files retain original bytes. Offline input and visible races sampled on all eight courses with all eight racers; pause passed. Local battle renders and responds, but a non-fatal sky-arena.webp prefetch returns 404 on both original and local; actual renderer loads sky-coast.webp via theme=coast. Online rooms/ranked features require unavailable /kart-room server. Full race/cup/battle completion, every item and touch controls remain unverified. No original authoring source maps/repository confirmed.

### Track-relative kart simulation (P0)

**Observed:** Track helpers provide projection/loop/rail/support queries; stepDriver manages drift, boost, airborne/tricks, rescue and progress/checkpoints.

**Source:** [`kart-7vz70Zig.js`](../tableparty-kart/public/assets/kart-7vz70Zig.js), [`trackProtocol-OIX5LHKx.js`](../tableparty-kart/public/assets/trackProtocol-OIX5LHKx.js).

**Proposed extraction:** Track query plus driver state/input step; preserve track format and vehicle tuning.

**Required context:** Course specifications; character stats; track protocol; original timestep.

**Acceptance check:** Replay drift release, ramp/trick landing, off-track rescue and gate crossing; compare state traces with original client.

### Racing and battle AI (P1)

**Observed:** botInput, curveAt and pack/rival pacing share the race state; battle has separate shot and rotation handling.

**Source:** [`kart-7vz70Zig.js`](../tableparty-kart/public/assets/kart-7vz70Zig.js).

**Proposed extraction:** Bot input policy using the same driver controls; keep race and battle policies separate.

**Required context:** Track geometry; driver/item state; difficulty settings.

**Acceptance check:** Seed a full race and a battle; track progress, recovery loops, item use and terminal results.

### Spatial race audio and bounded voices (P0)

**Observed:** Audio loads dynamic cue/music paths, handles unlock/rebuild/pause, limits simultaneous one-shots and spatially mixes nearby rival engines.

**Source:** [`kart-7vz70Zig.js`](../tableparty-kart/public/assets/kart-7vz70Zig.js).

**Proposed extraction:** Audio event sink with asset resolver and listener/rival poses.

**Required context:** Web Audio; all original MP3 cues; user gesture; voice/loop ownership.

**Acceptance check:** Pause/resume and switch course repeatedly; compare cue timing, rival panning and bounded voice counts with no missing assets.

### Kart LODs, crowds and course assets (P1)

**Observed:** Hashed GLBs load through an import map; course rendering combines LOD/shadow models, instanced spectators, procedural props and dynamic sky/ground textures.

**Source:** [`kart-7vz70Zig.js`](../tableparty-kart/public/assets/kart-7vz70Zig.js), [`meshopt_decoder.module-O9a9x0ao.js`](../tableparty-kart/public/assets/meshopt_decoder.module-O9a9x0ao.js).

**Proposed extraction:** One course renderer with explicit dynamic asset manifest, preserving original shader/LOD choices.

**Required context:** Three WebGL; meshopt; course theme data; original assets.

**Acceptance check:** Visit all eight courses, compare LOD silhouettes/shadows and collect every runtime request at original DPR.

### Snapshot interpolation and server boundary (P2)

**Observed:** Client connects to /kart-room, handles resume/session/frame messages and retains bounded frame history; server authority and ranked state are not deployed client code.

**Source:** [`kart-7vz70Zig.js`](../tableparty-kart/public/assets/kart-7vz70Zig.js).

**Proposed extraction:** Protocol/interpolation study only until the real server source is available.

**Required context:** Unavailable WebSocket/ranked server; ordered ticks; input sequence counters.

**Acceptance check:** Document message shapes from code; future authorized server tests need jitter/loss/reconnect. Do not use mock success as parity evidence.

## Cloudkeep

Selected reference: the original exploration release b28406d, before Arena. Four candidates: flight 3C, ecosystem/persistence, atmosphere/effects, and Blender assets. See [source map](../cloudkeep/TECHNICAL.md) and the complete candidate contracts in [extraction-candidates.json](extraction-candidates.json). The previous 513-test dual-mode import is superseded; the selected original has 37 tests. The separate local project is unchanged.

## Evidence and reproducibility


The previous [13-project audit](FULL-AUDIT.md) is retained as a historical baseline. Its counts do not include the two later additions. Current coverage comes from `games.json`, the candidate index, and a runtime summary kept outside the repository.
