# 桜ヶ丘駅 — Builder Guide (read fully before writing code)

A walkable first-person **anime cel-shaded** Three.js scene of a small suburban Japanese
station in sakura season, ~16:00 on a spring afternoon. World contract: `src/world/layout.js`.

Stack: plain ES modules, **three@0.170.0** (import map → jsDelivr in the browser, `node_modules` in node).
No build step. Entry `index.html` → `src/main.js`.

## 1. Your module

Each world module is one file `src/world/<name>.js` (you may add helpers `src/world/<name>/*.js`) exporting:

```js
export async function build(ctx) { ... }   // may be sync
```

You own ONLY your files. **Never edit** `src/core/*`, `src/main.js`, `src/world/layout.js`, `index.html`,
or other modules (exception: the audio agent owns `src/core/audio.js`). If the core blocks you, work around
it inside your module and report it in `knownIssues`.

Build order (main.js): environment, street, poles, railway, station, plaza, shopsA, shopsB, houses,
sakura, trains, crossing, props, vehicles, characters, petals. A module may read `ctx.services.X` of an
**earlier** module at build time, and of any module at update time — always with optional chaining and a
sensible fallback computed from `layout.js` (your module must work alone).

## 2. The ctx API (see `src/core/ctx.js`)

| member | what |
|---|---|
| `ctx.THREE` | three.js namespace (or `import * as THREE from 'three'`) |
| `ctx.L` | everything from `layout.js` (heightAt, streetFrame, lotFrame, lotToWorld, LOTS, SPOTS, RAIL, PLATFORM, STATION, CROSSING, PLAZA, ROADS, POLE_RUNS, VENDING, BLOCKS, FAR_TOWN, NAMES, …) |
| `ctx.addStatic(obj)` | add static scenery. After all modules build, meshes are **merged by material** (so never keep a reference to a static mesh to animate it). |
| `ctx.add(obj)` | add animated/dynamic objects (never merged). |
| `ctx.onUpdate((dt, t) => …)` | per-frame. `t` = sim seconds (deterministic: screenshots fast-forward `t`). Prefer animation as a **pure function of t**. |
| `ctx.mat.toon(color, opts)` | the main cel material (MeshToonMaterial + 4-band ramp + world-space hand-painted variation). opts: `map, alphaMap, alphaTest, transparent, opacity, side:'double', vertexColors, emissive, emissiveIntensity, paint (0..0.15), polygonOffset, depthWrite`. Cached: same args → same material (good for batching). |
| `ctx.mat.decal(color, opts)` | markings/posters/stains on surfaces (polygonOffset). Still lift 5 mm off the surface. |
| `ctx.mat.emissive(color, intensity, opts)` | unlit/self-lit (screens, lamps, lit signs, interior glow). intensity > ~1.1 blooms softly. |
| `ctx.mat.glass({tint, opacity, streaks, frost})` | anime glass (sky reflection + diagonal highlight streaks). Put a dim interior behind it. |
| `ctx.mat.foliage(color, map, opts)` | alpha-tested double-sided cards (grass, flowers, leaves). |
| `ctx.palette` | named sRGB colours (see materials.js PALETTE). Start from these. |
| `ctx.tex.draw(w,h,(g,w,h)=>{…},{key,repeat})` | canvas texture; `ctx.tex.sign({...})`, `fitText`, `verticalText`, `roundRect`, `FONTS` (sans, serif, round, hand, brush, en — Google fonts are loaded before build). Keep canvases ≤ 1024 px, reuse via `key`. |
| `ctx.kit(parent)` | `box(w,h,d,mat,[x,y,z],[rx,ry,rz])`, `boxB` (bottom at y), `rbox` (rounded), `cyl(rTop,rBot,h,mat,pos,rot,seg)`, `sphere`, `plane` (faces +Z), `mesh`, `group(pos, rotY)`. Sets cast/receive shadow. |
| `ctx.geo` | `G` shared unit geometries, `extrude(points2D, depth)`, `catenary(a,b,sag,seg)`, `mergeGeometries`, `mergeMeshes`, `RoundedBox` via kit. |
| `ctx.wires.add(points, {width, color})` | thin lines (power lines, cables, ropes, clotheslines, droppers). Screen-space-aware ribbons: never alias, never vanish. One draw call for the whole scene. |
| `ctx.physics` | `addBox(cx,cz,w,d,rotY,y0,y1)`, `addAABB`, `addCylinder(cx,cz,r,y0,y1)`, `addWalkBox(cx,cz,w,d,rotY,topY)` (floors/steps/curbs — acts as a wall where it is > 0.45 m above the feet), `addWalkRamp(cx,cz,w,d,rotY,yA,yB)` (rises along local +z), `addStairs(...)`, `addFromObject(obj,pad)`, `addDynamic(fn)` (moving boxes), `groundHeight(x,z,feetY)`. |
| `ctx.noOutline(obj)` | put on layer 1: excluded from the outline pass. **Required** for alpha cut-outs, particles and vertex-shader-animated meshes. |
| `ctx.noBatch(obj)` | exclude static meshes from merging. |
| `ctx.rng(seed)` | seeded PRNG (`r()`, `r.range`, `r.int`, `r.pick`, `r.chance`). Never use `Math.random()` (non-deterministic screenshots). |
| `ctx.shared` | `uTime`, `uWind` (vec2, blows ~+X), `uGust` (0..1), `uSunDir` — share these uniforms in custom shaders so everything sways together. |
| `ctx.sunDir` | direction TO the sun (from the west-south-west, ~31° up). |
| `ctx.audio` | `loop(name,{position,volume})` → handle `{setVolume,setParam,setPosition,stop}`, `play(name,{position,volume,text})`. Safe before start. Names in `src/core/audio.js`. |
| `ctx.player.position` | player feet position (updated each frame). |
| `ctx.quality` | `{name:'high'|'medium'|'low', petals}` — scale particle counts. |
| `ctx.services` | cross-module data (see §6). |

## 3. Coordinates & world map (all in `layout.js`)

Meters. +X east, −Z north, +Y up. Model forward = local **+Z**. `rotY` = three.js rotation.y
(0 faces south/+Z, π faces north, +π/2 faces east, −π/2 faces west). Ground: **always** `L.heightAt(x,z)`
(the south town slopes gently up toward +Z; the rail corridor is a 0.3 m cut; the levee rises at z≈−84…−91.5).

```
 z=-116..-101  river (water y=-0.45)          z<-119 fields -> hills -> far mountains (environment)
 z=-94.5..-91.5 levee top path R5 (y=3.2)  ── sakura row on both levee shoulders
 z=-83.5..-57.9 north residential rows N1/N2 (faces R4 z=-55.5 and alley R6 z=-71)
 z=-52 ......... corridor north edge ─ north platform z -50.5..-46.5 (x -7..40) ─ track B z=-45
 z=-41 ......... track A ─ south platform z -39.5..-35.5 ─ station building x -4..12, z -35.5..-25
 x=-12 ......... level crossing on road R2 (x -14.75..-9.25), crossing zone x -17..-7, z -52..-34
 z=-25..-5 ..... station plaza x -9.25..26 (big sakura at (-3,-14), bike racks east part)
 z=-5..1 ....... cross street R3 (E-W)
 z=1..130 ...... main street R1 (6 m, centreline L.streetCenterX(z): straight to z=28, then bends east),
                 lots W1..W13 (west) / E1..E13 (east), 14 m deep, frontage at 4.8 m from centreline.
```

Hero camera (first frame): `L.HERO` = eye at (1.6, ground+1.52, 34) looking north down the main street.
Composition: street → plaza sakura (left-centre) → station (right-centre) → crossing with a passing
train (left, visible past the NW corner) → platforms, catenary, residential hills. **Keep that view
corridor readable** (don't put tall opaque things in the plaza west part x∈[−9,−3], z∈[−25,−5], or on the
road). Lots: see `LOTS`; each lot's local frame: origin at the frontage centre, local +Z faces the
street, lot occupies local x∈[−w/2,w/2], z∈[−depth,0]; `lotFrame(lot)` gives the world transform
(`y` = ground at frontage centre; the ground rises ~0.028 m per m toward +Z — add foundations/steps).

Railway direction (left-hand running): **track A (south) = westbound** (to 花見台, trains move −X),
**track B (north) = eastbound** (to 春日野, +X). Rail top y = 0.15, platform top y = 1.25,
contact wire y = 5.15. Trains: `L.TRAIN` (2 × 18 m cars, 2.8 m wide, stop centred at x = 17, door
centres `L.TRAIN_DOORS_X` = 2, 8, 14, 20, 26, 32), timetable `L.SCHEDULE` (120 s loop; at t≈20–26 train B
passes the crossing while train A waits at platform 1 with doors open). Bicycle geometry contract: `L.BIKE`.
Station also owns `STATION.sideYard` (east of the building) and `STATION.westYard` (west, keep low).

## 4. Look (cel shading) — rules

* Materials from `ctx.mat` only (custom ShaderMaterials allowed for special effects — include fog chunks,
  use stepped/cel lighting from `ctx.shared.uSunDir`, never PBR). No MeshStandardMaterial.
* Outlines are automatic (screen-space, colour-aware). Make silhouettes clean: chunky, readable shapes,
  slightly **rounded/bevelled** main forms (kit.rbox), clear eaves/frames/sills. Avoid noisy micro-geometry.
* Shadows turn blue-violet automatically (ambient is lavender). Don't paint black. Darkest albedo ≈ `#3a3346`.
  Keep albedos ≤ ~0.92 brightness (pure white blooms). Saturated colour only for accents (signs, train band,
  vending machines, konbini sign) — the rest is soft pastel / neutral.
* Surfaces seen up close get a light canvas "hand-painted" detail texture (soft stains, uneven wash,
  simplified wood grain, tile lines, cracks) — never photographic noise.
* Text: real, natural Japanese (kanji/kana + small romaji where appropriate). **Fictional brands only** —
  never real company names/logos. Check text is not mirrored (planes face +Z; don't scale −1).
* Warm interior light (`mat.emissive('#ffd9a0', 0.9..1.4)` panels) behind glass; cool daylight outside.
* Scale sanity: door 2.0×0.85 m; storey 2.9 m; ceiling 2.5 m; handrail 0.9–1.1 m; bench seat 0.44 m;
  vending machine 1.83×1.0×0.75 m; bicycle 1.75 m long; person 1.45–1.75 m; utility pole 10–12 m.
* Life & wear: slight moss/rain streaks/cracks/patches, but overall clean and warm.

## 5. Performance

* Budgets (triangles): environment 350k, street 250k, poles 250k, railway 400k, station 400k, plaza 200k,
  shopsA 450k, shopsB 450k, houses 700k, sakura 700k, trains 350k, crossing 100k, props 300k,
  vehicles 250k, characters 200k, petals 250k.
* Reuse geometries (`ctx.geo.G.box()` scaled) and materials (cached by args). Use `InstancedMesh` for
  anything repeated > ~40 times (sleepers, stones, grass tufts, bikes' spokes, cans in vending machines…).
  Instanced/dynamic meshes are not merged — keep their count low (< ~60 per module).
* Canvas textures: share via `key`, ≤ 1024², total ≤ 24 Mpx per module. Distant stuff (> 150 m) = simple.

## 6. Cross-module services (publish exactly these shapes; consumers must tolerate absence)

```js
ctx.services.rail    = { trains: [{ id, track:'A'|'B', x, length, dir /* +1|-1 travel */, speed /* m/s */, doorsOpen /*0..1*/, stopped }],
                         crossingActive(x) /* bool: warning at a crossing at world x */,
                         crossingApproach(x) /* {fromWest:bool, fromEast:bool} */ };          // trains
ctx.services.street  = { edges: [{ a:[x,z], b:[x,z], kind:'curb'|'gutter'|'wall'|'edge' }], gutters: [{ a:[x,z], b:[x,z], w, water }] }; // street
ctx.services.poles   = { poles: [{ x, z, y, top }], spans: [{ points:[THREE.Vector3…] }] };   // poles
ctx.services.houses  = { gardenSpots: [{ x, z, r }], bikeSpots: [{ x, z, rotY }], wallTops: [{ x, z, y, rotY, len }] }; // houses
ctx.services.sakura  = { trees: [{ x, z, y /*canopy centre*/, r /*canopy radius*/, h }] };   // sakura
ctx.services.station = { benches: [{ x, z, y, rotY, len }] };                                  // station
ctx.services.plaza   = { benches: [{ x, z, y, rotY, len }] };                                  // plaza
ctx.services.shopsA  = { cafeWindow: { x, y, z, rotY, w, h }, cafeTables: [{ x, z, y }] };     // shopsA
```

## 7. Ownership map (who builds what — stay inside yours; keep pinned spots clear)

* **environment**: base terrain for the whole world (fine inside the play area, coarse beyond), ground
  colouring of unowned areas (grass verges, dirt, gravel), vacant-lot weeds/wildflowers, the levee (slopes,
  top path R5 surface, concrete stairs), river water + banks + reeds, distant hills/mountains/far fields,
  aerial-perspective layering. NOT roads, lots, plaza, rail bed.
* **street**: asphalt of R1, R2 (not the crossing deck z∈[−47.6,−38.4]), R3, R4, R6 + junctions; curbs &
  sidewalks; white edge lines, centre lines, all road markings outside the crossing zone (止まれ, stop lines,
  ◇, 30, 徐行, bicycle symbols, zebra crossing R1→plaza at x≈0), gutters + grates + lids, manholes, hydrant
  marks, repair marks, standalone sign posts (blue guide signs, speed limit, no-parking, 通学路, 止まれ ▽),
  convex mirrors at junctions, guardrails. Publishes `services.street`.
* **poles**: utility poles at `POLE_RUNS` (+ extras outside the play area), everything on them (crossarms,
  insulators, transformers, streetlights, number plates, pole ads, reflective sleeves, yellow guards,
  stickers, small cameras, pole-mounted signs), all street wires + service drops. Publishes `services.poles`.
* **railway**: rails/sleepers/fasteners/ballast/joints/turnout, catenary poles (centre poles between the
  tracks at z=−43 near the station), messenger/contact wires/droppers, signals, km posts, speed signs,
  equipment boxes, cable troughs, maintenance path, drainage, corridor fences (gaps at the crossing zone and
  the station section x∈[−7,50]), 立入禁止 & emergency signs, reflectors, corridor weeds.
* **station**: station building inside+out, forecourt steps/ramp (`STATION.forecourt`), both platforms with
  all furniture, shelters, 駅名標, platform fences, platform-end items, ramps + 構内踏切 walkway, optional
  north exit ramp, platform-edge invisible colliders. Leaves the V2 vending spot free. Publishes `services.station`.
* **plaza**: plaza paving/curbs, flower beds, ring bench round the tree (seat y = `SPOTS.plazaBenchSeatY`)
  + items on it, map/tourist/community boards, bus stop, taxi sign, postbox, phone booth, bike racks at
  `PLAZA.bikeRows`, bollards, chains, bins, lamps. Tree itself = sakura. Leaves V1a/V1b free. Publishes `services.plaza`.
* **shopsA**: konbini (W1), flower shop (W2), bookstore (W4), café (E1) incl. interiors, signage, awnings,
  shop-front props, konbini bike line at `SPOTS.konbiniBikes`, café board at `SPOTS.cafeBoard`. Keep V3a/V3b free.
* **shopsB**: wagashi (E2), general store (E3), ramen (E5), bicycle shop (W6) — keep `SPOTS.gashapon` and
  `SPOTS.bikeShopBikes` clear (props/vehicles fill them).
* **houses**: all houses (street lots W3,W5,W7–W13,E4,E7–E13, `BLOCKS`, `FAR_TOWN`), their yards, walls,
  fences, and the domestic small objects. W3 frontage wall exactly per `SPOTS.w3Wall`, keep
  `SPOTS.w3Sakura` (r 1.5 m) clear. Publishes `services.houses`.
* **sakura**: every cherry tree (plaza tree at `PLAZA.tree`, `SPOTS.w3Sakura`, `SPOTS.shrineSakura`,
  station surroundings, platform outsides, corridor rows, levee rows, garden spots…). Publishes `services.sakura`.
* **trains**: two 2-car EMUs, schedule/traffic, doors, lights, interiors & silhouettes, petals resting on
  the roof, train colliders. Publishes `services.rail`.
* **crossing**: everything in `CROSSING.zone` except asphalt: deck, gates, lights, crossbucks, bell,
  direction arrows, control box, emergency button, fences, walkway/bicycle markings, stop lines 止まれ.
* **props**: ALL vending machines (`VENDING`) + recycle bins, the E6 shrine lot (torii, hokora, jizo, ema,
  foxes), V5 bench (`SPOTS.v5Bench`), gashapon (`SPOTS.gashapon`), 防災倉庫 (`SPOTS.disasterCabinet`),
  scattered extras (fire extinguisher boxes, traffic cones…).
* **vehicles**: every bicycle (plaza racks, `SPOTS.*Bike*`, houses' bikeSpots, crossing girl's bike),
  parked cars (`SPOTS.whiteVan`, `keiCar`, `taxi`, `crossingCar`).
* **characters**: people at `SPOTS` (+ platform reader at `PLATFORM.benchB1`), cats, sparrows (on
  `services.poles.spans`), idle animations, wind in hair/skirts.
* **petals**: falling petals (GPU), ground drifts/streaks/piles, petals on benches/vending tops/ballast/gutter
  water/river/café window, train-gust swirls.
* **audio**: `src/core/audio.js` — synthesized WebAudio implementation of the documented API.

## 8. Verify like you mean it

1. `node tools/check.mjs <module>` → must end `RESULT: OK`, within budget, no warnings you can fix.
2. Screenshots with the real renderer (headless GPU, ~20–40 s each run):
   `node tools/shot.mjs --only _ground,<module> --cams "x,z,yaw,pitch;x,y,z,yaw,pitch" --out shots/<module>/a --t 20`
   (4 numbers = walking eye height; 5 numbers = free camera; yaw 0 = north, 90 = west, 180 = south, −90 = east).
   `_ground` is a DEV placeholder (flat colours + boxes) for context only. Then **look at every PNG with the
   Read tool** and fix what you see: floating/sunken objects, z-fighting, mirrored text, wrong scale,
   missing faces, harsh colours, clutter, dull areas. Iterate several times; include close-ups (1–3 m),
   mid shots, the hero view `1.6,34,4,2`, and a high overview. Save into `shots/<module>/` only.
3. At the end, if other modules' files exist, also try `--only _ground,<neighbour>,<module>` to catch
   overlaps (don't edit their files; report conflicts).
