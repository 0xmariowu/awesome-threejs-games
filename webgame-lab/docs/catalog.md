---
title: Lab showcase catalog (方案库) — candidate items
date: 2026-09-23
status: screened 2026-09-23 (awaiting 老板's pick)
sources: a local game-design research note from 2026-09-23 (kept outside this repository); three.js r186 examples list (230 webgpu_* examples, fetched 2026-09-23); two researcher sweeps on 2026-09-23, with 22 key claims audited (20 confirmed, 2 wrong and removed)
---

# Showcase catalog

The implemented **Inkwave 技术拆解** collection (2026-09-25) has its own nine-scene navigation column. See the [extraction guide](../src/inkwave/README.md), [integrated 3C design](../src/inkwave/3C-DESIGN.md), and [verification record](../src/inkwave/QA.md). The candidate screening below remains unchanged.

The **WebGL 游戏技术** tab now launches 16 verified classic-WebGL entries, including alternate WebGL routes for retargeting, tank camera and Rapier joints. See `src/inkwave/README.md` for the deeper 3C, AO, feedback and surface modules.

Each item becomes one scene the owner can open from a menu and judge by playing or looking.

Columns:
- **Batch**: 1 = cheap and high value, 2 = medium effort, R = reserve (large, unlicensed or low confidence).
- **Source**: `ex:` = three.js r186 official example (MIT); `lib:` = library; `ref:` = a complete work to learn from.
- **GPU**: `WebGPU` = runs on our main renderer; `WebGL` = runs on the classic comparison renderer; `?` = untested.
- **Status**: ✅ = already in the lab.

Removed after audit: ecctrl swim, wall-climb and air-dash (roadmap only, not shipped), and dsoft20/psx_retroshader (a Unity shader, not three.js).

## A. Character control (角色怎么动)

| # | Item | Source | GPU | License | Effort | Batch |
|---|---|---|---|---|---|---|
| A1 | Physics character | lib: pmndrs/ecctrl + Rapier | WebGPU | MIT | ✅ | ✅ |
| A2 | Drive a car (ecctrl wheels) | lib: ecctrl vehicle system | WebGPU? | MIT | S | 1 |
| A3 | Fly a drone (ecctrl propellers) | lib: ecctrl ThrustPropeller | WebGPU? | MIT | S | 1 |
| A4 | Walk on a planet / walls (ecctrl custom gravity) | lib: ecctrl spherical/cylindrical gravity | WebGPU? | MIT | S | 1 |
| A5 | Character without a physics engine | lib: pmndrs/BVHEcctrl | ? | MIT | S | 1 |
| A6 | Rapier's official car | ex: physics_rapier_vehicle_controller | port to WebGPU | MIT | S | 1 |
| A7 | 1st/3rd person switch + foot IK + car | lib: hh-hang/three-player-controller | ? | MIT | M | 2 |
| A8 | Start/stop/landing state machine | ref: swift502/Sketchbook | port | MIT | M | 2 |
| A9 | Arcade racing feel | ref: pmndrs/racing-game Vehicle.tsx | port | MIT | M | 2 |
| A10 | Parkour (vault, slide, wall-run) | ref: StarKnightt/parapet | ? | unclear | M | R |
| A11 | Top-down / side-scroller controllers | ref: kamilch1k/top-down-character-demo, chamchi0809/r3f-platformer | ? | none | S–M | R |

## B. Camera (镜头怎么跟)

| # | Item | Source | GPU | License | Effort | Batch |
|---|---|---|---|---|---|---|
| B1 | Follow camera | lab feel scene | WebGPU | — | ✅ | ✅ |
| B2 | Free orbit camera | lib: camera-controls | WebGPU | MIT | ✅ | ✅ |
| B3 | Owner's cloudkeep chase camera | ref: 0xmariowu/cloudkeep flight-camera.ts | port | MIT | S | 1 |
| B4 | Camera shake on impact | lib: felixmariotto/three-screenshake | ? | MIT | S | 1 |
| B5 | Top-down / isometric camera | ref: DanieloM83/THREE.js-Interactive-Isometric | port | MIT | S | 1 |
| B6 | Tank-game camera (pulls in at walls, lifts uphill) | ref: Kevin-Liu-01/Claude-of-Tanks cameraRig.ts | port | MIT (engine code) | M | 2 |
| B7 | Cinematic rail camera + path editor | lib: nytimes/three-story-controls | ? | Apache-2.0 | M | 2 |
| B8 | Lock-on target camera | ref: squarefeet/THREE.TargetCamera (2015) | rewrite | MIT | M | 2 |

## C. Animation (动画)

| # | Item | Source | GPU | License | Effort | Batch |
|---|---|---|---|---|---|---|
| C1 | Smooth walk↔run blending | lib: jmschrack/three-blendtree | ? | MIT | S | 1 |
| C2 | Limb/foot IK | ex: webgl_animation_skinning_ik (CCDIK) | port | MIT | S | 1 |
| C3 | Animation retargeting | ex: webgpu_animation_retargeting | WebGPU | MIT | S | 1 |
| C4 | Crowd of animated characters | ex: webgpu_skinning_instancing | WebGPU | MIT | S | 1 |
| C5 | Anime avatars with hair/skirt physics | lib: pixiv/three-vrm | WebGPU (supported) | MIT | S | 1 |
| C6 | Ragdoll (knock a character over) | lib: mattvb91/rapierjs-ragdoll | ? | README says MIT, no LICENSE file | M | 2 |
| C7 | Many-legged bugs walking by IK | ref: bandinopla/threejs-easybugs | ? | MIT | M | 2 |
| C8 | Motion matching on the web | ref: orangeduck/Motion-Matching | port | MIT | L | R |

## D. Look presets and art styles (画面风格)

| # | Item | Source | GPU | License | Effort | Batch |
|---|---|---|---|---|---|---|
| D1 | One-click presets: raw / cinematic / bright / dusk / overcast | lab Light + Post controls | WebGPU | — | S | 1 |
| D2 | Toon shading + outlines | ex: webgpu_materials_toon + webgpu_postprocessing_outline | WebGPU | MIT | S | 1 |
| D3 | Pixel-art look | ex: webgpu_postprocessing_pixel | WebGPU | MIT | S | 1 |
| D4 | Retro look | ex: webgpu_postprocessing_retro | WebGPU | MIT | S | 1 |
| D5 | Halftone / comic dots | ex: webgpu_tsl_halftone | WebGPU | MIT | S | 1 |
| D6 | Film colour grading (LUT) | ex: webgpu_postprocessing_3dlut | WebGPU | MIT | S | 1 |
| D7 | Cinematic extras: depth of field, motion blur, god rays, reflections, global illumination | ex: webgpu_postprocessing_dof / motion_blur / godrays / ssr / ssgi | WebGPU | MIT | S each | 1 |
| D8 | Anime cel style with painted shading | lib: xymeow/three-anime-style | WebGL | MIT | M | 2 |
| D9 | Cross-hatch sketch | lib: spite/sketch | WebGL2 | MIT | M | 2 |
| D10 | Low-poly flat style kit | lib: jasonsturges/three-low-poly | ? | ISC | M | 2 |
| D11 | Pixel art with clean outlines | ref: KodyJKing/hello-threejs | ? | none | S | R |

## E. Sky, time and weather (天空天气)

| # | Item | Source | GPU | License | Effort | Batch |
|---|---|---|---|---|---|---|
| E1 | Physical sky | ex: webgpu_sky | WebGPU | MIT | S | 1 |
| E2 | Volumetric clouds | ex: webgpu_volume_cloud | WebGPU | MIT | S | 1 |
| E3 | Height fog | ex: webgpu_fog_height | WebGPU | MIT | S | 1 |
| E4 | Rain and snow | ex: webgpu_compute_particles_rain / _snow | WebGPU | MIT | S | 1 |
| E5 | Lightning strike | lib: SahilK-027/Lightning-VFX | ? | MIT | S | 1 |
| E6 | Atmosphere + clouds for big worlds | lib: takram three-geospatial | WebGPU (atmosphere) | MIT | M | 2 |
| E7 | Day/night + 8 weather states + lightning | lib: jasonkneen/Eanpa-Sky (0★, new) | WebGPU | MIT | L | 2 |

## F. Vegetation (植被)

| # | Item | Source | GPU | License | Effort | Batch |
|---|---|---|---|---|---|---|
| F1 | 20k trees: core vs instanced-mesh | plan F005 | both | MIT | S | 1 |
| F2 | Grass with wind: core vs THREE.Terrain | plan F006 | both | MIT | M | 1 |
| F3 | Procedural trees with wind + LOD | lib: dgreenheck/ez-tree (1,648★) | ? | MIT | S | 1 |
| F4 | WebGPU plant generator (20 species, full scene) | lib: SkyeShark/SeedThree | WebGPU | MIT | M | 2 |
| F5 | Huge forest (3.8k trees, 2.5M grass) | ref: AlexLisong/verdant-forest-showcase | ? | none | M | R |

## G. World building (世界)

| # | Item | Source | GPU | License | Effort | Batch |
|---|---|---|---|---|---|---|
| G1 | Terrain: core vs THREE.Terrain | plan F006 | both | MIT | M | 1 |
| G2 | Procedural city / building | ex: webgpu_generator_city / _building | WebGPU | MIT | S | 1 |
| G3 | Hex island by Wave Function Collapse | lib: felixturner/hex-map-wfc | WebGPU | MIT | M | 2 |
| G4 | Procedural dungeon | lib: majidmanzarpour/threejs-procedural-dungeon | ? | MIT | M | 2 |
| G5 | Breakable geometry (holes, craters) | lib: gkjohnson/three-bvh-csg | ? | MIT | M | 2 |
| G6 | City with terrain-following roads | ref: jstrait/city-tour | ? | MIT | M | 2 |
| G7 | Infinite terrain + planet mode | lib: ZyFou/ProceduralTerrains | ? | MIT | L | R |
| G8 | Real-world 3D map tiles | lib: NASA-AMMOS/3DTilesRendererJS | renderer-agnostic | Apache-2.0 | M | R |

## H. Water and materials (水和材质)

| # | Item | Source | GPU | License | Effort | Batch |
|---|---|---|---|---|---|---|
| H1 | Ocean / water / shoreline water | ex: webgpu_ocean, webgpu_water, webgpu_backdrop_water | WebGPU | MIT | S | 1 |
| H2 | Pool-floor caustics | lib: martinRenou/threejs-caustics | ? | BSD-3 | S | 1 |
| H3 | Cartoon water | lib: thaslle/stylized-water (R3F) | WebGL | MIT | S | 1 |
| H4 | Raytraced pool with floating objects | lib: jeantimex/threejs-water | ? | MIT | M | 2 |
| H5 | FFT ocean | lib: owenyuwono/poseidon | WebGPU only | MIT | M | 2 |
| H6 | Motion trails / footprints | lib: mkkellogg/TrailRendererJS | ? | none | S | R |

## I. Effects (特效)

| # | Item | Source | GPU | License | Effort | Batch |
|---|---|---|---|---|---|---|
| I1 | Fire + sparks: core vs three.quarks | plan F007 | both | MIT | S | 1 |
| I2 | TSL flames and tornado | ex: webgpu_tsl_vfx_flames / _tornado | WebGPU | MIT | S | 1 |
| I3 | Volumetric fire | ex: webgpu_volume_fire | WebGPU | MIT | S | 1 |
| I4 | Cloth simulation | ex: webgpu_compute_cloth | WebGPU | MIT | S | 1 |
| I5 | Flocking birds | ex: webgpu_compute_birds | WebGPU | MIT | S | 1 |

## J. NPC behaviour (NPC 行为)

| # | Item | Source | GPU | License | Effort | Batch |
|---|---|---|---|---|---|---|
| J1 | Wander / flee / chase / flock | lib: Mugen87/yuka | renderer-agnostic | MIT | S | 1 |
| J2 | Pathfinding + crowds | lib: isaac-mason/navcat | renderer-agnostic | MIT | M | 2 |
| J3 | NPCs as R3F components | lib: ssethsara/react-three-npc | ? | MIT | S | 2 |

## K. Physics play (物理玩法)

| # | Item | Source | GPU | License | Effort | Batch |
|---|---|---|---|---|---|---|
| K1 | Ropes, chains, hinges | ex: physics_rapier_joints | port | MIT | S | 1 |
| K2 | Push/stack boxes (already in feel) | lab | WebGPU | — | ✅ | ✅ |

## Counts

- 74 items in total.
- Already in the lab: 4.
- Batch 1: 40 items, mostly S (three.js official WebGPU examples, ecctrl modes, presets, and the plan's F005–F007 comparisons).
- Batch 2: 22 items (M).
- Reserve: 8 items (L, unlicensed or low confidence).

## Screening (2026-09-23)

The owner asked for every item to be screened on two things: how trustworthy it is and what it actually does.

**How each item was checked**
- **Trust**: GitHub stars, forks, contributors, commits on the default branch since 2026-03-23, last push and license. These come from `gh api graphql` on 2026-09-23.
- **What it does**: each live demo was opened in headless Chrome on the real `apple/metal-3` WebGPU adapter. Pages were given 9 s to load; slow or interactive pages got a retake with a 12–45 s wait and one click. Page errors were recorded, and the screenshots are in `/tmp/demoshots/` (not committed).
- **Frame rates** come from each three.js example's own fps counter, visible in the screenshot. On the same machine the lab's own scenes run at 60 fps.
- **Visual judgement** was made by the orchestrator comparing the screenshots within each category. It is not a blind or pairwise judgement.
- **Usefulness** has three levels. Core: nearly every 3D game needs it. Common: some genres need it. Niche: a stylistic extra.

**Verdicts**
- **Keep-1**: build in batch 1.
- **Keep-2**: build in batch 2.
- **Study**: read the code and learn from it, but don't depend on it.
- **Owner-check**: the demo did not render within 45 s in headless Chrome, so 老板 should open it in desktop Chrome before we decide.
- **Drop**.

| # | Item | ★ / activity | Demo check | Usefulness | Verdict | Reason |
|---|---|---|---|---|---|---|
| A2–A4 | ecctrl vehicle / drone / custom gravity | 798★, 37 people, active | ecctrl.app renders a rich test world | core (A2), common (A3, A4) | Keep-1 | same library we already use; features are in the README |
| A5 | BVHEcctrl | 140★, stale since 2025-08 | renders, character walks | niche (comparison only) | Drop | ecctrl already covers this; inactive for 13 months |
| A6 | Rapier official car | three.js core | renders, very plain (red box) | common | Study | reference for how ecctrl's vehicle feels; not a showcase on its own |
| A7 | three-player-controller | 284★, 197 commits/6m, 2 people | landing page with polished Foot IK / FPS demos | common | Keep-2 | foot IK and first/third-person switching are unique; bus factor of 1–2 |
| A8 | Sketchbook state machine | 1,753★, archived | renders (world with vehicles, welcome dialog) | core (learn) | Study → Keep-2 port | best character/vehicle state design; old three.js |
| A9 | racing-game arcade feel | 2,218★, stale since 2023 | only reached the start screen (needs a click on text) | common | Study → Keep-2 port | short Vehicle.tsx recipe; old deps |
| A10 | parapet parkour | 2★, license unclear | looks polished (rooftop city) | niche | Study | too new, and the license is not clear |
| A11 | top-down / side-scroller | 0–2★, no license | top-down renders, platformer is weak | common | Drop | no license; write our own when needed |
| B3 | cloudkeep chase camera | owner's own | — | core | Keep-1 | our own code, MIT |
| B4 | screenshake | 19★, 2020 | not shot | common | Drop (write ourselves) | about 20 lines of code; stale |
| B5 | isometric camera | 4★ | not shot | common | Drop (write ourselves) | trivial with camera-controls |
| B6 | Claude-of-Tanks camera | 438★, 4,084 commits/6m | renders, very polished product | core | Keep-2 | best-documented camera feel; engine code is MIT |
| B7 | three-story-controls rail camera | 272★, stale since 2023, Apache-2.0 | demo is text-only (scroll page) | niche (cutscenes) | Study | no maintained alternative; revisit for cutscenes |
| B8 | TargetCamera lock-on | 28★, 2015 | not shot | common | Drop (write ourselves) | 10 years stale |
| C1 | three-blendtree | 6★ | not shot | core need, weak repo | Drop | three.js AnimationMixer cross-fade covers it |
| C2 | CCDIK (official) | three.js core | renders well (girl in room reaching an orb) | common | Keep-1 | official, stable |
| C3 | animation retargeting (official) | three.js core | renders two characters | core | Keep-1 | lets us reuse any animation on our characters |
| C4 | skinning instancing (official) | three.js core | renders a crowd of dancers | common | Keep-1 | crowds |
| C5 | three-vrm | 2,180★, 59 commits/6m | renders an anime avatar | common | Keep-1 | mature, supports WebGPU |
| C6 | rapierjs-ragdoll | 21★, license only stated in README | renders debug ragdoll lines | common | Study | tiny repo; learn the bone-to-body sync |
| C7 | easybugs | 9★ | renders (bug crawling on a face) | niche | Drop | fun but not game-core |
| C7b | THREE.IK | 586★, stale | **broken** (`geo.applyMatrix4 is not a function`) | — | Drop | demo broken on current three.js |
| C8 | Motion-Matching | 917★, stale | no hosted demo | common | Study | research reference; large effort |
| D1 | look presets | lab | — | core | Keep-1 | direct fix for the grey image |
| D2 | toon + outline (official) | three.js core | toon renders; outline renders (60 fps) | common | Keep-1 | a real art-style option |
| D3 | pixel (official) | three.js core | renders, 52 fps | niche | Keep-1 | cheap style option |
| D4 | retro (official) | three.js core | renders, 60 fps | niche | Keep-1 | cheap style option |
| D5 | halftone (official) | three.js core | renders, **24 fps** | niche | Drop | heavy for a niche look |
| D6 | 3D LUT colour grading (official) | three.js core | renders, 60 fps, cinematic | core | Keep-1 | film colour grading |
| D7 | DOF / motion blur / godrays / SSR / SSGI (official) | three.js core | all render; SSR **40 fps**, others 60 | core | Keep-1 | cinematic toolbox; SSR costs more |
| D8 | three-anime-style | 1★, 6 days old | renders an in-page comparison tool | common | Owner-check | looks good, but the project is days old |
| D9 | spite/sketch | 325★ | renders a cross-hatch gallery | niche | Study | WebGL2 only, niche |
| D10 | three-low-poly | 58★, one author | renders an effects/camera animator | niche | Study | one author |
| D11 | hello-threejs pixel | 440★, no license | — | niche | Drop | no license; official pixel pass covers it |
| E1 | sky (official) | three.js core | renders, 60 fps | core | Keep-1 | |
| E2 | volumetric cloud (official) | three.js core | renders a single cloud | common | Keep-1 | |
| E3 | height fog (official) | three.js core | renders, 60 fps | core | Keep-1 | |
| E4 | rain / snow (official) | three.js core | both render, 60 fps | common | Keep-1 | |
| E5 | Lightning-VFX | 45★, MIT | empty until clicked (controls render) | niche | Keep-2 | weather spectacle; small repo |
| E6 | takram atmosphere + clouds | 1,694★, 494 commits/6m | WebGPU storybook blank in headless | core (big worlds) | Owner-check | strong project; the demo needs a desktop check |
| E7 | Eanpa-Sky weather engine | 0★, 11 days old | stuck at a loading spinner after 45 s | common | Owner-check | promising README, unproven |
| E7b | Sky-Shader | 154★, 2021 | renders | core | Drop | the official sky supersedes it |
| F1 | 20k trees shootout | plan | — | core | Keep-1 | |
| F2 | grass/terrain shootout | plan (THREE.Terrain 905★) | THREE.Terrain renders a textured terrain | core | Keep-1 | |
| F3 | ez-tree | 1,648★, 10 commits/6m | renders a realistic forest scene | core | Keep-1 | best vegetation visual in the set |
| F4 | SeedThree | 100★, 2 months old | stuck at "Building the biome" after 45 s | common | Owner-check | WebGPU plant generator, unproven |
| F5 | verdant forest | 0★, no license | stuck at "Entering the forest" | — | Drop | no license |
| G2 | city / building generators (official) | three.js core | render, but city **7 fps**, building 25 fps | common | Keep-2 | beautiful but heavy; tune before use |
| G3 | hex-map-wfc | 437★, one author | renders a polished WebGPU island | common | Keep-2 | best world-gen demo; single author |
| G4 | procedural dungeon | 504★, one author | renders a themed dungeon | common | Keep-2 | good; single author |
| G5 | three-bvh-csg | 949★ | renders boolean ops | common | Keep-2 | destructible/procedural geometry |
| G6 | city-tour | 88★ | renders a dated flat-colour city | niche | Drop | the official generator looks far better |
| G7 | ProceduralTerrains | 611★, 3 months old, 1 author | stuck at "Starting terrain editor" after 45 s | common | Owner-check | big feature set, unproven |
| G8 | 3D Tiles | 2,474★, very active | not shot | niche (real-world maps) | Study | only if the game uses real places |
| H1 | ocean / water / backdrop water (official) | three.js core | all render; ocean **23 fps**, water 47 fps | core | Keep-1 | ocean needs tuning |
| H2 | threejs-caustics | 367★, 2020 | renders a small canvas | niche | Drop | stale; official water covers it |
| H3 | stylized-water | 73★, 2025 | renders a charming toon island | common | Keep-1 | best cartoon water |
| H4 | threejs-water pool | 207★, active | renders raytraced pool | niche | Study | impressive but pool-only |
| H5 | poseidon FFT ocean | 302★ | not shot | common | Study | WebGPU only, 2 people |
| H6 | TrailRenderer | 190★, no license | renders a trail | common | Drop | no license; write our own |
| I1 | three.quarks | 1,037★ | renders muzzle-flash demo, high quality | core | Keep-1 | best game VFX look; WebGL renderer |
| I1b | three-nebula | 1,227★, active | not shot | core | Study | runner-up to quarks |
| I2 | TSL flames / tornado (official) | three.js core | flames render; tornado **10 fps** | common | Keep-1 flames / Drop tornado | tornado too heavy |
| I3 | volumetric fire (official) | three.js core | renders realistic fire, 60 fps | common | Keep-1 | |
| I4 | cloth (official) | three.js core | renders, 41 fps | niche | Keep-2 | capes/flags |
| I5 | birds (official) | three.js core | renders a flock, 46 fps | niche | Keep-2 | ambient life |
| J1 | yuka | 1,371★ | wander demo renders (arrows) | core | Keep-1 | mature NPC steering |
| J2 | navcat | 292★, active | renders crowd demo | core | Keep-1 | pathfinding + crowds; pure JS |
| J2b | recast-navigation-js | 428★, maintenance | renders | core | Study | navcat is the successor |
| J3 | react-three-npc | 13★, 2024 | not shot | — | Drop | stale; yuka directly is enough |
| K1 | Rapier joints (official) | three.js core | renders a simple chain | common | Keep-1 | ropes/chains |
