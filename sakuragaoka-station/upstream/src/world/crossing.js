// 桜ヶ丘第1踏切 — the level crossing (第1種踏切) on road R2 over both tracks.
// Owns everything inside L.CROSSING.zone except the road asphalt (street) and the rails (railway):
// deck (rubber panels + asphalt fills + flangeways + concrete edge beams), equipment aprons,
// road markings (edge lines, green pedestrian bands, bicycle chevrons/navi marks, stop lines, 止まれ,
// pedestrian waiting lines, tactile blocks), four warning posts (crossbuck, speaker, direction
// indicator, twin flashing lamps front+back, name plate / とまれ みよ, emergency buttons), two barrier
// machines with animated arms, control cabinet, relay box, 踏切動作反応灯, side fences + signs.
// Animation: ctx.services.rail.crossingActive / crossingApproach (fallback: timetable-derived demo cycle).
import * as THREE from 'three';
import { makeCrossingTextures, INK, HAZ_YELLOW } from './crossing/tex.js';
import { makeHaloMesh, makeConeMesh } from './crossing/glow.js';

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const ease = (k) => k * k * (3 - 2 * k);
const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

export function build(ctx) {
  const { L, mat, physics } = ctx;
  const P = ctx.palette;
  const CR = L.CROSSING;
  const CX = CR.x, RW = CR.roadHalfW;
  const XRW = CX - RW, XRE = CX + RW;            // road edges            (-14.75 / -9.25)
  const XLW = XRW + 0.75, XLE = XRE - 0.75;      // edge-line centres     (-14.0 / -10.0)
  const XDW = -15.5, XDE = -8.5;                 // deck outer edges incl. concrete edge beams
  const BEAM = 0.2;
  const XWW = XDW + BEAM, XWE = XDE - BEAM;      // walkway outer edges   (-15.3 / -8.7)
  const ZDS = CR.deckZ1, ZDN = CR.deckZ0;        // deck south / north end (-38.4 / -47.6)
  const ZSS = CR.stopLineSouthZ, ZSN = CR.stopLineNorthZ;
  const ZONE = CR.zone;
  const RTOP = L.RAIL.railTopY + 0.004;          // deck top = rail top (0.15) + 4 mm so it never z-fights the terrain
  const XAW = -16.9, XAE = -7.1;                 // apron / fence outer lines (inside the zone)
  const ZFS = -39.1, ZFN = -46.9;                // fence ends toward the tracks (train body clearance)
  const prof = (z) => L.heightAt(CX, z);         // road (and apron) top profile along z
  const APR = 0.004;                             // apron lift over the terrain

  const T = makeCrossingTextures(ctx);
  const root = new THREE.Group(); root.name = 'crossing'; ctx.addStatic(root);
  const k = ctx.kit(root);
  const rng = ctx.rng('crossing');

  // ------------------------------------------------------------------ materials
  const POST_R = 0.075, POST_H = 4.0;
  // Plain-colour toon materials below are only colour carriers: mergeGroup() bakes them into vertex
  // colours of ONE shared vertex-colour material, so they cost no extra draw calls.
  const M = {
    ink: mat.toon(INK, { paint: 0.03 }),
    inkD: mat.toon(INK, { side: 'double', paint: 0.03 }),
    housing: mat.toon('#47444f', { paint: 0.03 }),
    rim: mat.toon('#5d5a66'),
    steel: mat.toon(P.steel),
    steelDark: mat.toon(P.steelDark),
    concrete: mat.toon(P.concrete),
    beam: mat.toon('#c7c5bc', { paint: 0.06, polygonOffset: -1 }),
    asphalt: mat.toon('#ffffff', { map: T.asphalt, paint: 0.04, polygonOffset: -1 }),
    rubber: [mat.toon('#686a71', { map: T.rubber, paint: 0.04, polygonOffset: -1 }), mat.toon('#71727a', { map: T.rubber, paint: 0.04, polygonOffset: -1 })],
    rubberG: mat.toon('#8fb095', { map: T.rubber, paint: 0.04, polygonOffset: -1 }),
    apron: mat.toon('#ffffff', { map: T.concrete, paint: 0.05, polygonOffset: -1 }),
    post: mat.toon('#ffffff', { map: T.postStripe(POST_H / (2 * Math.PI * POST_R)), paint: 0.03 }),
    mach: mat.toon('#ffffff', { map: T.machStripe, paint: 0.03 }),
    sign: mat.toon('#ffffff', { map: T.signAtlas, paint: 0.015 }),   // every plate / board / crossbuck face
    speaker: mat.toon('#a9aeb3'),
    emBox: mat.toon('#ece5d6'),
    btnRed: mat.toon('#e8503f'),
    cab: mat.toon('#bcc1c4'),
    red: mat.toon('#d9463b'),
    yellow: mat.toon(HAZ_YELLOW, { paint: 0.03 }),
    fence: mat.toon('#6f9a7c', { paint: 0.04 }),
    fenceMesh: mat.foliage('#7aa386', T.mesh, { paint: 0.02 }),
    grass: mat.foliage('#ffffff', T.grass, { paint: 0.05 }),
    lensOff: mat.toon('#9b4448', { paint: 0.02 }),
    lensOn: mat.emissive('#ff563f', 2.4),
    arrowOff: mat.toon('#5b5864', { paint: 0.02 }),
    arrowOn: mat.emissive('#ffd98c', 2.1),
    reactOff: mat.toon('#d6d2ca', { paint: 0.02 }),
    reactOn: mat.emissive('#fff3da', 2.2),
    // road paint (decals: transparent, no depth write, polygon offset)
    white: mat.decal('#eeece6', { map: T.worn }),
    green: mat.decal('#7fb08b', { map: T.worn }),
    sym: mat.decal('#ffffff', { map: T.roadAtlas }),   // 止まれ, とまれ, footprints, chevrons, navi mark, tactile blocks
    guide: mat.decal('#ffffff', { map: T.guide }),
  };
  M.slot = M.housing; M.machCap = M.rim; M.grille = M.rim; M.weight = M.rim; M.plateBack = M.speaker;
  M.cabRoof = M.steel; M.emTop = M.red; M.tipRed = M.red;
  // atlas-mapped copies of the shared unit plane / box (cached per atlas rect)
  const _atlasGeo = new Map();
  function atlasGeo(kind, name) {
    const key = kind + '|' + name;
    if (_atlasGeo.has(key)) return _atlasGeo.get(key);
    const g = (kind === 'box' ? ctx.geo.G.box() : ctx.geo.G.plane()).clone();
    const r = T.rect[name], uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, r[0] + (r[2] - r[0]) * uv.getX(i), r[1] + (r[3] - r[1]) * uv.getY(i));
    _atlasGeo.set(key, g);
    return g;
  }
  /** Flat sign face (faces +Z) of w×h showing atlas image `name`. */
  const signPlane = (kk, name, w, h, pos, rot) => { const me = kk.mesh(atlasGeo('plane', name), M.sign, pos, rot, [w, h, 1]); me.castShadow = false; return me; };
  const signBox = (kk, name, w, h, d, pos, rot) => kk.mesh(atlasGeo('box', name), M.sign, pos, rot, [w, h, d]);

  // ------------------------------------------------------------------ geometry helpers
  /** Box-like slab: top surface from topFn(x,z) on an nx×nz grid, skirts down to yBot. World UVs / tile.
   *  sides = which skirts to build: {s,e,n,w} (south = +z edge). */
  function slabGeo(x0, x1, z0, z1, topFn, yBot, { nx = 1, nz = 1, tile = 1, sides = { s: 1, e: 1, n: 1, w: 1 } } = {}) {
    const pos = [], uv = [], idx = [];
    const W = nx + 1;
    for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
      const x = x0 + (x1 - x0) * i / nx, z = z0 + (z1 - z0) * j / nz;
      pos.push(x, topFn(x, z), z); uv.push(x / tile, -z / tile);
    }
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const a = j * W + i, b = a + 1, c = a + W, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
    const wall = (pts) => {
      const base = pos.length / 3; let dist = 0;
      for (let i = 0; i < pts.length; i++) {
        const [x, z] = pts[i]; if (i) dist += Math.hypot(x - pts[i - 1][0], z - pts[i - 1][1]);
        const yt = topFn(x, z);
        pos.push(x, yt, z, x, yBot, z); uv.push(dist / tile, yt / tile, dist / tile, yBot / tile);
      }
      for (let i = 0; i < pts.length - 1; i++) {
        const t0 = base + i * 2, b0 = t0 + 1, t1 = t0 + 2, b1 = t0 + 3;
        idx.push(t0, b0, b1, t0, b1, t1);
      }
    };
    const lin = (a, b, n) => Array.from({ length: n + 1 }, (_, i) => a + (b - a) * i / n);
    if (sides.s) wall(lin(x0, x1, nx).map(x => [x, z1]));
    if (sides.e) wall(lin(z1, z0, nz).map(z => [x1, z]));
    if (sides.n) wall(lin(x1, x0, nx).map(x => [x, z0]));
    if (sides.w) wall(lin(z0, z1, nz).map(z => [x0, z]));
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }
  const addMesh = (g, m, { shadow = true, parent = root } = {}) => {
    const me = new THREE.Mesh(g, m); me.castShadow = shadow; me.receiveShadow = true; parent.add(me); return me;
  };
  /** Flat decal on the ground/deck: y = yFn(x,z). mode 'N' reads for someone facing north,
   *  'S' facing south, 'W' world-tiled (tile metres). */
  // renderOrder layers coplanar paint: green bands (1) < white lines (2) < symbols / tactile (3)
  const ORDER = new Map();
  function decal(x0, x1, z0, z1, yFn, m, { mode = 'W', tile = 1.5, nz = 1, nx = 1, rect = null } = {}) {
    if (x0 > x1) [x0, x1] = [x1, x0];
    if (z0 > z1) [z0, z1] = [z1, z0];
    const pos = [], uv = [], idx = [];
    const W = nx + 1;
    const r = rect ? T.rect[rect] : [0, 0, 1, 1];
    const put = (u, v) => uv.push(r[0] + (r[2] - r[0]) * u, r[1] + (r[3] - r[1]) * v);
    for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
      const x = x0 + (x1 - x0) * i / nx, z = z0 + (z1 - z0) * j / nz;
      pos.push(x, yFn(x, z), z);
      const fu = (x - x0) / (x1 - x0), fv = (z1 - z) / (z1 - z0);
      if (mode === 'N') put(fu, fv);
      else if (mode === 'S') put(1 - fu, 1 - fv);
      else uv.push(x / tile, -z / tile);
    }
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const a = j * W + i, b = a + 1, c = a + W, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx); g.computeVertexNormals();
    const me = new THREE.Mesh(g, m); me.castShadow = false; me.receiveShadow = true;
    me.renderOrder = ORDER.get(m) ?? 3;
    ctx.noOutline(me);
    root.add(me);
    return me;
  }
  /** Cylinder between two 3D points. */
  function pipe(a, b, r, m, parent = root, seg = 8) {
    const d = new THREE.Vector3().subVectors(b, a), len = d.length();
    const me = new THREE.Mesh(ctx.geo.G.cyl(seg), m);
    me.scale.set(r * 2, len, r * 2);
    me.position.copy(a).addScaledVector(d, 0.5);
    me.quaternion.setFromUnitVectors(V3(0, 1, 0), d.normalize());
    me.castShadow = true; me.receiveShadow = true; parent.add(me);
    return me;
  }

  // ------------------------------------------------------------------ deck (踏切板)
  const HG = L.RAIL.gauge / 2;
  // flangeway: rail heads span gauge/2 .. gauge/2 + 0.065 from the track centre (railway profile)
  const OUTER = 0.08, INNER = 0.07, OUTW = 0.70;
  const [zA, zB] = [L.RAIL.zA, L.RAIL.zB];
  const strips = [];
  for (const tz of [zA, zB]) {
    const rs = tz + HG, rn = tz - HG;                       // south / north rail centre
    strips.push({ z0: rs + OUTER, z1: rs + OUTER + OUTW, kind: 'rubber' });
    strips.push({ z0: rn + INNER, z1: rs - INNER, kind: 'rubber' });
    strips.push({ z0: rn - OUTER - OUTW, z1: rn - OUTER, kind: 'rubber' });
  }
  strips.push({ z0: zA + HG + OUTER + OUTW, z1: ZDS, kind: 'asphalt' });                    // south fill
  strips.push({ z0: zB + HG + OUTER + OUTW, z1: zA - HG - OUTER - OUTW, kind: 'asphalt' });  // between tracks
  strips.push({ z0: ZDN, z1: zB - HG - OUTER - OUTW, kind: 'asphalt' });                    // north fill

  // dark base under the whole deck: visible only as the bottom of the flangeways
  addMesh(slabGeo(XDW + 0.01, XDE - 0.01, ZDN + 0.01, ZDS - 0.01, () => 0.03, -0.45), M.slot, { shadow: false });
  const flat = (y) => () => y;
  const asphaltStrips = [];
  for (const s of strips) {
    // concrete edge beams (縁石) on both sides
    addMesh(slabGeo(XDW, XWW, s.z0, s.z1, flat(RTOP), -0.45, { tile: 1 }), M.beam);
    addMesh(slabGeo(XWE, XDE, s.z0, s.z1, flat(RTOP), -0.45, { tile: 1 }), M.beam);
    if (s.kind === 'asphalt') {
      addMesh(slabGeo(XWW, XWE, s.z0, s.z1, flat(RTOP), -0.45, { tile: 4, sides: { s: 1, e: 0, n: 1, w: 0 } }), M.asphalt);
      asphaltStrips.push(s);
    } else {
      // rubber panels: green pedestrian panels at both sides, dark carriageway panels in the middle
      const segs = [];
      const split = (a, b, n, green) => { for (let i = 0; i < n; i++) segs.push({ a: a + (b - a) * i / n, b: a + (b - a) * (i + 1) / n, green }); };
      split(XWW, XLW, 2, true); split(XLW, XLE, 4, false); split(XLE, XWE, 2, true);
      for (const sg of segs) {
        const m = sg.green ? M.rubberG : M.rubber[rng.int(0, 1)];
        k.boxB(sg.b - sg.a, RTOP - 0.03, s.z1 - s.z0, m, [(sg.a + sg.b) / 2, 0.03, (s.z0 + s.z1) / 2]);
      }
    }
  }
  physics.addWalkBox((XDW + XDE) / 2, (ZDS + ZDN) / 2, XDE - XDW, ZDS - ZDN, 0, RTOP);
  // keep walkers on the deck between the fence ends (no wandering along the tracks)
  physics.addBox(XDW - 0.05, (ZFS + ZFN) / 2, 0.1, ZFS - ZFN, 0, -1, 2.6);
  physics.addBox(XDE + 0.05, (ZFS + ZFN) / 2, 0.1, ZFS - ZFN, 0, -1, 2.6);

  // ------------------------------------------------------------------ equipment aprons (concrete, road level)
  const aprons = [
    // [x0, x1, z0, z1]
    [XAW, XRW, ZDS, -33.0], [XAW, XDW, ZFS, ZDS],         // SW (extends to the town edge so there is no trench)
    [XRE, XAE, ZDS, ZONE.z1], [XDE, XAE, ZFS, ZDS],        // SE (stops at the station's west yard)
    [XAW, XRW, -53.0, ZDN], [XAW, XDW, ZDN, ZFN],          // NW
    [XRE, XAE, -53.0, ZDN], [XDE, XAE, ZDN, ZFN],          // NE
  ];
  for (const [x0, x1, z0, z1] of aprons) {
    const nz = Math.max(1, Math.round((z1 - z0) / 0.25));
    const roadSideE = Math.abs(x1 - XRW) < 1e-6 || Math.abs(x1 - XDW) < 1e-6;   // east side touches road/deck
    const roadSideW = Math.abs(x0 - XRE) < 1e-6 || Math.abs(x0 - XDE) < 1e-6;
    addMesh(slabGeo(x0, x1, z0, z1, (x, z) => prof(z) + APR, -0.45, { nz, tile: 2, sides: { s: 1, n: 1, e: roadSideE ? 0 : 1, w: roadSideW ? 0 : 1 } }), M.apron);
    // physics: flat & ramp parts
    const cx = (x0 + x1) / 2, w = x1 - x0;
    const parts = [];
    const rampS = [-38.4, -37.4, -36.4, -35.4], rampN = [-50.6, -49.6, -48.6, -47.6];   // 3 sub-ramps follow the smoothstep hump
    const cuts = [z0, z1, ...rampS, ...rampN].filter(v => v >= z0 && v <= z1).sort((a, b) => a - b);
    for (let i = 0; i < cuts.length - 1; i++) { const a = cuts[i], b = cuts[i + 1]; if (b - a > 1e-3) parts.push([a, b]); }
    for (const [a, b] of parts) {
      const ya = prof(a), yb = prof(b);
      if (Math.abs(ya - yb) < 0.004) physics.addWalkBox(cx, (a + b) / 2, w, b - a, 0, Math.max(ya, yb) + APR);
      else physics.addWalkRamp(cx, (a + b) / 2, w, b - a, 0, ya + APR, yb + APR);
    }
  }

  // ------------------------------------------------------------------ road markings (inside the zone)
  ORDER.set(M.green, 1); ORDER.set(M.white, 2);
  const LIFT = 0.02;                                // over the street asphalt (follows the hump)
  const yRoad = (lift) => (x, z) => prof(z) + lift;
  const yDeck = (lift) => () => RTOP + lift;
  // south approach: the street's edge lines (x -14.47 / -9.53, ending at z -33.9) taper in to ours by ZT
  const ZT = -34.7, XSL = -14.47, XSR = -9.53;
  const apS = [ZDS, ZT], apN = [ZONE.z0, ZDN];  // approach z ranges inside the zone
  /** straight painted stripe of width w from a to b ([x,z]), following yFn, world-tiled UVs */
  function stripe(a, b, w, yFn, m, n = 4) {
    const dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz), nx = -dz / len * w / 2, nz = dx / len * w / 2;
    const pos = [], uv = [], idx = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n, x = a[0] + dx * t, z = a[1] + dz * t;
      pos.push(x - nx, yFn(x - nx, z - nz), z - nz, x + nx, yFn(x + nx, z + nz), z + nz);
      uv.push(len * t / 1.7, 0, len * t / 1.7, w / 1.7);
      if (i < n) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx); g.computeVertexNormals();
    if (g.attributes.normal.getY(0) < 0) { const ia = g.index.array; for (let i = 0; i < ia.length; i += 3) { const t2 = ia[i + 1]; ia[i + 1] = ia[i + 2]; ia[i + 2] = t2; } g.computeVertexNormals(); }
    const me = new THREE.Mesh(g, m); me.castShadow = false; me.receiveShadow = true; me.renderOrder = ORDER.get(m) ?? 3;
    ctx.noOutline(me); root.add(me); return me;
  }
  const nzOf = (a, b) => Math.max(1, Math.round(Math.abs(b - a) / 0.25));
  const bandW = [XWW, XLW - 0.075], bandE = [XLE + 0.075, XWE];
  // green pedestrian bands + white edge lines along the approaches
  for (const [a, b] of [apS, apN]) {
    decal(bandW[0], bandW[1], a, b, yRoad(LIFT), M.green, { nz: nzOf(a, b), tile: 1.2 });
    decal(bandE[0], bandE[1], a, b, yRoad(LIFT), M.green, { nz: nzOf(a, b), tile: 1.2 });
    decal(XLW - 0.075, XLW + 0.075, a, b, yRoad(LIFT + 0.002), M.white, { nz: nzOf(a, b), tile: 1.7 });
    decal(XLE - 0.075, XLE + 0.075, a, b, yRoad(LIFT + 0.002), M.white, { nz: nzOf(a, b), tile: 1.7 });
  }
  stripe([XSL, ZONE.z1 + 0.1], [XLW, ZT - 0.02], 0.15, yRoad(LIFT + 0.002), M.white);
  stripe([XSR, ZONE.z1 + 0.1], [XLE, ZT - 0.02], 0.15, yRoad(LIFT + 0.002), M.white);
  // on the deck's asphalt fills
  for (const s of asphaltStrips) {
    decal(bandW[0], bandW[1], s.z0, s.z1, yDeck(0.004), M.green, { tile: 1.2 });
    decal(bandE[0], bandE[1], s.z0, s.z1, yDeck(0.004), M.green, { tile: 1.2 });
    decal(XLW - 0.075, XLW + 0.075, s.z0, s.z1, yDeck(0.006), M.white, { tile: 1.7 });
    decal(XLE - 0.075, XLE + 0.075, s.z0, s.z1, yDeck(0.006), M.white, { tile: 1.7 });
  }
  // linear tactile guide (踏切道内誘導表示) along each walkway across the whole deck
  for (const gx of [(bandW[0] + bandW[1]) / 2, (bandE[0] + bandE[1]) / 2]) {
    for (const s of strips) decal(gx - 0.15, gx + 0.15, s.z0 + 0.01, s.z1 - 0.01, yDeck(0.009), M.guide, { tile: 0.3 });
  }
  // stop lines (full width between the edge lines: narrow road without centre line)
  for (const zs of [ZSS, ZSN]) decal(XLW - 0.075, XLE + 0.075, zs - 0.225, zs + 0.225, yRoad(LIFT + 0.004), M.white, { nz: 2, tile: 1.7 });
  // 止まれ before each stop line, centred in the road, reading for the approaching driver
  decal(CX - 1.35, CX + 1.35, ZSS + 0.4, ZSS + 2.0, yRoad(LIFT + 0.003), M.sym, { rect: 'tomare', mode: 'N', nz: 4, nx: 2 });
  decal(CX - 1.35, CX + 1.35, ZSN - 2.0, ZSN - 0.4, yRoad(LIFT + 0.003), M.sym, { rect: 'tomare', mode: 'S', nz: 4, nx: 2 });
  // pedestrian waiting lines + tactile blocks + footprints + とまれ in each band (4 corners)
  const zWaitS = -36.9, zWaitN = -49.0;
  for (const [b0, b1] of [bandW, bandE]) {
    const bc = (b0 + b1) / 2;
    // south approach: pedestrians walk north
    decal(b0, b1, zWaitS - 0.1, zWaitS + 0.1, yRoad(LIFT + 0.004), M.white, { nz: 1, tile: 1.7 });
    decal(bc - 0.45, bc + 0.45, zWaitS + 0.1, zWaitS + 0.7, yRoad(LIFT + 0.004), M.sym, { rect: 'tactile', mode: 'N', nz: 3 });
    decal(bc - 0.24, bc + 0.24, -35.95, -35.47, yRoad(LIFT + 0.005), M.sym, { rect: 'feet', mode: 'N', nz: 2 });
    decal(bc - 0.45, bc + 0.45, -35.25, -34.78, yRoad(LIFT + 0.005), M.sym, { rect: 'tomareSmall', mode: 'N', nz: 2 });
    // north approach: pedestrians walk south
    decal(b0, b1, zWaitN - 0.1, zWaitN + 0.1, yRoad(LIFT + 0.004), M.white, { nz: 1, tile: 1.7 });
    decal(bc - 0.45, bc + 0.45, zWaitN - 0.7, zWaitN - 0.1, yRoad(LIFT + 0.004), M.sym, { rect: 'tactile', mode: 'N', nz: 3 });
    decal(bc - 0.24, bc + 0.24, -50.53, -50.05, yRoad(LIFT + 0.005), M.sym, { rect: 'feet', mode: 'S', nz: 2 });
    decal(bc - 0.45, bc + 0.45, -51.4, -50.88, yRoad(LIFT + 0.005), M.sym, { rect: 'tomareSmall', mode: 'S', nz: 2 });
  }
  // bicycle guidance: blue 矢羽根 chevrons at the left edge of each direction + 自転車ナビマーク
  const onDeck = (z) => z <= ZDS && z >= ZDN;
  const chev = (xc, zc, dir) => {
    const yf = onDeck(zc) ? yDeck(0.008) : yRoad(LIFT + 0.006);
    decal(xc - 0.27, xc + 0.27, zc - 0.3, zc + 0.3, yf, M.sym, { rect: 'chevron', mode: dir, nz: 2 });
  };
  const xNB = XLW + 0.3, xSB = XLE - 0.3;                                  // (-13.7 / -10.3)
  for (const z of [-34.45, -36.25, -37.65, -39.05, -43.0, -46.95]) chev(xNB, z, 'N');
  for (const z of [-51.6, -49.95, -48.6, -46.95, -43.0, -39.05, -38.05, -34.45]) chev(xSB, z, 'S');
  decal(xNB - 0.27, xNB + 0.27, -49.75, -48.65, yRoad(LIFT + 0.006), M.sym, { rect: 'navi', mode: 'N', nz: 3 });
  decal(xSB - 0.27, xSB + 0.27, -37.4, -36.3, yRoad(LIFT + 0.006), M.sym, { rect: 'navi', mode: 'S', nz: 3 });

  // ------------------------------------------------------------------ dynamic part collection
  const dyn = { lens: [[], []], arrowE: [], arrowW: [], react: [], _arrows: [] };
  const halos = [[], []], reactHalos = [];
  const lensGeo = ctx.geo.G.sphere(16);
  const arrowGeo = (() => {
    const pts = [[-0.1, -0.03], [0.015, -0.03], [0.015, -0.072], [0.108, 0], [0.015, 0.072], [0.015, 0.03], [-0.1, 0.03]];
    return ctx.geo.extrude(pts, 0.014);
  })();
  // visor over the lens: ~150° arc, slightly flared toward the front (cylinder +y -> lamp +z after rotation)
  const hoodGeo = new THREE.CylinderGeometry(0.185, 0.152, 0.17, 16, 1, true, Math.PI / 2 + 0.3, Math.PI - 0.6);

  // ------------------------------------------------------------------ warning posts (踏切警報機)
  const lampFaces = [];   // {obj, phase}
  function warningPost({ x, z, rotY, main, roadSide }) {
    const gy = prof(z);
    const g = new THREE.Group(); g.position.set(x, gy, z); g.rotation.y = rotY; root.add(g);
    const kk = ctx.kit(g);
    // foundation + base plate + pole
    kk.rbox(0.46, 0.4, 0.46, 0.035, M.concrete, [0, -0.13, 0]);
    kk.box(0.26, 0.03, 0.26, M.steelDark, [0, 0.085, 0]);
    for (const [bx, bz] of [[-0.09, -0.09], [0.09, -0.09], [-0.09, 0.09], [0.09, 0.09]]) kk.cyl(0.014, 0.014, 0.04, M.steel, [bx, 0.11, bz], null, 6);
    kk.cyl(POST_R, POST_R, POST_H, M.post, [0, POST_H / 2 + 0.07, 0], null, 16);
    kk.cyl(POST_R + 0.012, POST_R + 0.012, 0.05, M.ink, [0, POST_H + 0.07, 0], null, 16);
    // alarm speaker (警報音発生器) on top
    kk.box(0.07, 0.1, 0.07, M.steelDark, [0, POST_H + 0.14, 0]);
    kk.rbox(0.27, 0.25, 0.22, 0.04, M.speaker, [0, POST_H + 0.3, 0]);
    for (const s of [1, -1]) {
      kk.box(0.21, 0.17, 0.012, M.grille, [0, POST_H + 0.3, s * 0.112]);
      signPlane(kk, 'grille', 0.19, 0.15, [0, POST_H + 0.3, s * 0.1185], [0, s > 0 ? 0 : Math.PI, 0]);
    }
    kk.rbox(0.31, 0.035, 0.27, 0.015, M.machCap, [0, POST_H + 0.44, 0]);
    // crossbuck (踏切警標)
    const yB = 3.55;
    kk.box(0.09, 0.34, 0.07, M.steelDark, [0, yB, 0.085]);
    signBox(kk, 'buckA', 1.2, 0.18, 0.028, [0, yB, 0.132], [0, 0, 0.6]);
    signBox(kk, 'buckB', 1.2, 0.18, 0.028, [0, yB, 0.162], [0, 0, -0.6]);
    kk.cyl(0.035, 0.035, 0.02, M.steel, [0, yB, 0.182], [Math.PI / 2, 0, 0], 10);
    // direction indicator (列車進行方向指示器): arrows on both faces
    const yI = 2.95;
    kk.rbox(0.64, 0.23, 0.2, 0.025, M.housing, [0, yI, 0]);
    for (const s of [1, -1]) {
      kk.box(0.66, 0.02, 0.09, M.ink, [0, yI + 0.125, s * 0.125]);
      const fg = new THREE.Group(); fg.position.set(0, yI, s * 0.107); fg.rotation.y = s > 0 ? 0 : Math.PI; g.add(fg);
      for (const side of [1, -1]) {
        const a = new THREE.Mesh(arrowGeo, M.arrowOff);
        a.position.set(side * 0.165, 0, 0); a.rotation.z = side > 0 ? 0 : Math.PI;
        fg.add(a);
        dyn._arrows.push(a);
      }
    }
    // twin flashing lamps (閃光灯) on a cross bar, lenses on both faces
    const yL = 2.45;
    kk.cyl(0.028, 0.028, 1.02, M.ink, [0, yL, 0], [0, 0, Math.PI / 2], 10);
    kk.box(0.11, 0.17, 0.11, M.ink, [0, yL, 0]);
    for (const [phase, lx] of [[0, -0.4], [1, 0.4]]) {
      kk.cyl(0.085, 0.085, 0.13, M.housing, [lx, yL, 0], [Math.PI / 2, 0, 0], 14);
      for (const s of [1, -1]) {
        const fg = new THREE.Group(); fg.position.set(lx, yL, s * 0.065); fg.rotation.y = s > 0 ? 0 : Math.PI; g.add(fg);
        const fk = ctx.kit(fg);
        fk.cyl(0.23, 0.23, 0.02, M.ink, [0, 0, 0.01], [Math.PI / 2, 0, 0], 22);
        fk.cyl(0.14, 0.14, 0.03, M.rim, [0, 0, 0.033], [Math.PI / 2, 0, 0], 18);
        fk.mesh(hoodGeo, M.inkD, [0, 0, 0.105], [Math.PI / 2, 0, 0]);
        const lens = new THREE.Mesh(lensGeo, M.lensOff);
        lens.scale.set(0.25, 0.25, 0.07); lens.position.set(0, 0, 0.05); fg.add(lens);
        dyn.lens[phase].push(lens);
        lampFaces.push({ obj: fg, phase });
      }
    }
    // plates on the approach face: name plate (main) or とまれ みよ (secondary)
    const yP = 1.92;
    if (main) {
      kk.box(0.48, 0.38, 0.016, M.plateBack, [0, yP, POST_R + 0.01]);
      signPlane(kk, 'namePlate', 0.46, 0.36, [0, yP, POST_R + 0.024]);
    } else {
      kk.box(0.29, 0.38, 0.016, M.plateBack, [0, yP, POST_R + 0.01]);
      signPlane(kk, 'tomareMiyo', 0.27, 0.36, [0, yP, POST_R + 0.024]);
    }
    for (const dy of [-0.13, 0.13]) kk.box(0.2, 0.025, 0.17, M.steelDark, [0, yP + dy, 0.0]);
    // emergency button box (非常ボタン / 踏切支障報知装置) facing the road
    const eb = new THREE.Group(); eb.position.set(roadSide * (POST_R + 0.068), 1.22, 0); eb.rotation.y = roadSide * Math.PI / 2; g.add(eb);
    const ek = ctx.kit(eb);
    ek.rbox(0.24, 0.32, 0.12, 0.015, M.emBox, [0, 0, 0]);
    signPlane(ek, 'emergency', 0.22, 0.3, [0, 0, 0.066]);
    ek.cyl(0.045, 0.05, 0.035, M.btnRed, [0, 0.017, 0.075], [Math.PI / 2, 0, 0], 16);
    ek.box(0.27, 0.022, 0.16, M.emTop, [0, 0.172, 0.012]);
    physics.addCylinder(x, z, 0.14, gy - 0.5, gy + 4.6);
    return g;
  }

  /** Merge every mesh below `group` (except `skip`) into one mesh per material/layer/shadow/renderOrder,
   *  in the group's local space. Plain-colour toon materials (no map, opaque, no emissive, no offset) are
   *  baked into vertex colours of one shared vertex-colour material, so the whole crossing needs only a
   *  handful of draw calls (the core batcher would otherwise split it at its 40 m cell border z = -40). */
  const VC = mat.toon('#ffffff', { vertexColors: true }), VCD = mat.toon('#ffffff', { vertexColors: true, side: 'double' });
  const plainColour = (m) => m && m.isMeshToonMaterial && !m.map && !m.alphaMap && !m.transparent && !m.vertexColors &&
    !m.polygonOffset && !m.alphaTest && m.emissive.getHex() === 0;
  function mergeGroup(group, skip = []) {
    group.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(group.matrixWorld).invert();
    const buckets = new Map(), victims = [];
    const tmp = new THREE.Matrix4();
    group.traverse((o) => {
      if (!o.isMesh || o === group || skip.includes(o) || Array.isArray(o.material)) return;
      for (let p = o.parent; p && p !== group; p = p.parent) if (skip.includes(p)) return;
      const src = o.material, pc = plainColour(src);
      const target = pc ? (src.side === THREE.DoubleSide ? VCD : VC) : src;
      const key = `${target.uuid}|${o.layers.mask}|${o.castShadow ? 1 : 0}${o.receiveShadow ? 1 : 0}|${o.renderOrder}`;
      let b = buckets.get(key); if (!b) buckets.set(key, (b = { target, geos: [], proto: o }));
      tmp.multiplyMatrices(inv, o.matrixWorld);
      let g = o.geometry.index ? o.geometry.clone() : o.geometry.clone();
      if (!g.attributes.normal) g.computeVertexNormals();
      for (const a of Object.keys(g.attributes)) if (a !== 'position' && a !== 'normal' && a !== 'uv') g.deleteAttribute(a);
      if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
      if (!g.index) g.setIndex([...Array(g.attributes.position.count).keys()]);
      g.morphAttributes = {}; g.clearGroups();
      g.applyMatrix4(tmp);
      if (tmp.determinant() < 0) { const ia = g.index.array; for (let i = 0; i < ia.length; i += 3) { const t = ia[i + 1]; ia[i + 1] = ia[i + 2]; ia[i + 2] = t; } }
      if (target === VC || target === VCD) {
        const n = g.attributes.position.count, col = new Float32Array(n * 3), c = src.color;
        for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
        g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      }
      b.geos.push(g); victims.push(o);
    });
    for (const o of victims) o.parent.remove(o);
    const out = [];
    for (const { target, geos, proto } of buckets.values()) {
      const me = new THREE.Mesh(geos.length > 1 ? ctx.geo.mergeGeometries(geos, false) : geos[0], target);
      me.castShadow = proto.castShadow; me.receiveShadow = proto.receiveShadow; me.layers.mask = proto.layers.mask; me.renderOrder = proto.renderOrder;
      group.add(me); out.push(me);
    }
    return out;
  }

  // ------------------------------------------------------------------ barrier machines (遮断機) + arms
  const arms = [];
  function barrier({ mx, mz, faceZ, dirX, len }) {
    const gy = prof(mz);
    const g = k.group([mx, gy, mz]);
    const kk = ctx.kit(g);
    kk.rbox(0.6, 0.36, 0.54, 0.035, M.concrete, [0, -0.11, 0]);
    kk.boxB(0.44, 1.0, 0.4, M.mach, [0, 0.06, 0]);
    kk.rbox(0.48, 0.07, 0.44, 0.02, M.machCap, [0, 1.09, 0]);
    kk.cyl(0.115, 0.115, 0.1, M.housing, [0, 0.92, faceZ * 0.245], [Math.PI / 2, 0, 0], 16);
    kk.box(0.3, 0.2, 0.012, M.steelDark, [0, 0.55, -faceZ * 0.207]);   // service hatch on the back
    physics.addBox(mx, mz, 0.62, 0.58, 0, gy - 0.5, gy + 1.15);
    // arm assembly (dynamic): pivot on the track-side hub
    const pivot = new THREE.Group(); pivot.position.set(mx, gy + 0.92, mz + faceZ * 0.33); pivot.rotation.y = dirX > 0 ? 0 : Math.PI;
    const rot = new THREE.Group(); pivot.add(rot);
    const ak = ctx.kit(rot);
    ak.box(0.56, 0.13, 0.07, M.housing, [0.1, 0, 0]);
    ak.cyl(0.058, 0.058, 0.36, M.steelDark, [0.32, 0, 0], [0, 0, Math.PI / 2], 12);
    // tapered tube in alternating yellow / black 0.45 m bands (vertex-coloured segments, no texture)
    const tubeLen = len - 0.4, nBand = Math.round(tubeLen / 0.45), rA = 0.047, rB = 0.033;
    for (let i = 0; i < nBand; i++) {
      const f0 = i / nBand, f1 = (i + 1) / nBand, l = tubeLen / nBand;
      const seg = new THREE.CylinderGeometry(rA + (rB - rA) * f1, rA + (rB - rA) * f0, l, 12, 1, true);
      ak.mesh(seg, i % 2 ? M.ink : M.yellow, [0.4 + tubeLen * (f0 + f1) / 2, 0, 0], [0, 0, -Math.PI / 2]);
    }
    ak.cyl(rA, rA, 0.01, M.ink, [0.405, 0, 0], [0, 0, Math.PI / 2], 12);
    ak.sphere(0.04, M.tipRed, [len, 0, 0], 10);
    // red LED lamps on the arm (遮断かん用赤色灯), lenses on both faces; flash while the crossing is active
    const armLens = [], armHalo = [];
    for (const f of [0.3, 0.58, 0.86]) {
      const ax = 0.4 + tubeLen * f;
      ak.rbox(0.085, 0.085, 0.1, 0.02, M.housing, [ax, 0.0, 0]);
      for (const sz of [1, -1]) {
        const l = new THREE.Mesh(lensGeo, M.lensOff); l.scale.set(0.06, 0.06, 0.02); l.position.set(ax, 0, sz * 0.051); l.updateMatrix();
        armLens.push(l);
        armHalo.push({ c: V3(ax, 0, sz * 0.06), n: V3(0, 0, sz), size: 0.26 });
      }
    }
    const lg = ctx.geo.mergeGeometries(armLens.map(l => { const g2 = l.geometry.clone(); g2.applyMatrix4(l.matrix); return g2; }), false);
    const lensMesh = new THREE.Mesh(lg, M.lensOff); lensMesh.castShadow = false; rot.add(lensMesh);
    const haloMesh = makeHaloMesh(ctx, armHalo, '#ff4a34', { intensity: 1.4, streak: 0.5 }); rot.add(haloMesh);
    ak.box(0.44, 0.075, 0.05, M.housing, [-0.26, 0, 0]);
    ak.rbox(0.3, 0.26, 0.17, 0.035, M.weight, [-0.55, 0, 0]);
    mergeGroup(rot, [lensMesh, haloMesh]);
    ctx.add(pivot);
    const cz = mz + faceZ * 0.33;
    arms.push({ rot, lensMesh, haloMesh, box: { cx: mx + dirX * (len / 2 + 0.1), cz, w: len, d: 0.32, rotY: 0, y0: gy - 0.5, y1: gy + 1.45 } });
  }

  // positions: main posts (with barrier) on the left of each approach, secondary on the right
  warningPost({ x: -15.85, z: -36.6, rotY: 0, main: true, roadSide: 1 });           // SW, faces south approach
  warningPost({ x: -8.15, z: -36.7, rotY: 0, main: false, roadSide: -1 });          // SE
  warningPost({ x: -8.15, z: -49.3, rotY: Math.PI, main: true, roadSide: 1 });      // NE, faces north approach
  warningPost({ x: -15.85, z: -49.2, rotY: Math.PI, main: false, roadSide: -1 });   // NW
  barrier({ mx: -15.85, mz: -37.35, faceZ: -1, dirX: 1, len: 6.9 });
  barrier({ mx: -8.15, mz: -48.55, faceZ: 1, dirX: -1, len: 6.9 });

  // ------------------------------------------------------------------ control cabinet, relay box, reaction lamps
  function cabinet({ x, z, rotY, w, h, d, face }) {
    const gy = prof(z);
    const g = k.group([x, gy, z], rotY); const kk = ctx.kit(g);
    kk.rbox(w + 0.12, 0.3, d + 0.12, 0.025, M.concrete, [0, -0.07, 0]);
    kk.rbox(w, h, d, 0.03, M.cab, [0, 0.08 + h / 2, 0]);
    signPlane(kk, face, w - 0.06, h - 0.12, [0, 0.08 + h / 2 - 0.01, d / 2 + 0.006]);
    kk.rbox(w + 0.1, 0.06, d + 0.1, 0.02, M.cabRoof, [0, 0.08 + h + 0.03, 0]);
    kk.box(0.03, 0.14, 0.035, M.steelDark, [0.06, 0.08 + h * 0.55, d / 2 + 0.018]);
    kk.cyl(0.035, 0.035, 0.3, M.steelDark, [-w * 0.3, -0.02, -d / 2 - 0.05], null, 8);   // cable conduit into the ground
    physics.addBox(x, z, Math.abs(Math.cos(rotY)) > 0.5 ? w + 0.1 : d + 0.1, Math.abs(Math.cos(rotY)) > 0.5 ? d + 0.1 : w + 0.1, 0, gy - 0.5, gy + h + 0.2);
  }
  cabinet({ x: -16.42, z: -50.55, rotY: Math.PI / 2, w: 0.82, h: 1.3, d: 0.5, face: 'cabinet' });   // NW 踏切制御器, door to the road
  cabinet({ x: -7.58, z: -38.12, rotY: -Math.PI / 2, w: 0.55, h: 0.82, d: 0.38, face: 'relay' }); // SE 踏切器具箱 (kept low)

  function reactionLamp({ x, z, rotY }) {
    const gy = prof(z);
    const g = k.group([x, gy, z], rotY); const kk = ctx.kit(g);
    kk.rbox(0.3, 0.3, 0.3, 0.03, M.concrete, [0, -0.08, 0]);
    kk.cyl(0.04, 0.04, 2.1, M.steel, [0, 1.12, 0], null, 10);
    kk.rbox(0.3, 0.3, 0.12, 0.03, M.ink, [0, 2.2, 0.02]);
    kk.cyl(0.095, 0.095, 0.03, M.rim, [0, 2.2, 0.085], [Math.PI / 2, 0, 0], 16);
    kk.mesh(hoodGeo, M.inkD, [0, 2.2, 0.16], [Math.PI / 2, 0, 0], [0.75, 0.8, 0.75]);
    const fg = new THREE.Group(); fg.position.set(0, 2.2, 0.1); g.add(fg);
    const lens = new THREE.Mesh(lensGeo, M.reactOff); lens.scale.set(0.16, 0.16, 0.05); fg.add(lens);
    dyn.react.push(lens);
    reactHalos.push(fg);
    physics.addCylinder(x, z, 0.1, gy - 0.5, gy + 2.4);
  }
  reactionLamp({ x: -7.42, z: -38.8, rotY: Math.PI / 2 });      // for track A trains arriving from the east
  reactionLamp({ x: -16.55, z: -47.22, rotY: -Math.PI / 2 });   // for track B trains arriving from the west

  // ------------------------------------------------------------------ fences (立入防止柵) + signs
  const FH = 1.2;
  const onApron = (x, z) => x >= XAW - 1e-3 && x <= XAE + 1e-3 && z <= -33.0 && z >= -53.0;
  const fenceGround = (x, z) => (onApron(x, z) ? prof(z) + APR : L.heightAt(x, z));
  function fence(pts) {
    for (let s = 0; s < pts.length - 1; s++) {
      const [ax, az] = pts[s], [bx, bz] = pts[s + 1];
      const len = Math.hypot(bx - ax, bz - az); const n = Math.max(1, Math.ceil(len / 2.0 - 0.01));
      const P0 = [];
      for (let i = 0; i <= n; i++) { const t = i / n; const x = ax + (bx - ax) * t, z = az + (bz - az) * t; P0.push(V3(x, fenceGround(x, z), z)); }
      for (let i = 0; i <= n; i++) {
        if (s > 0 && i === 0) continue;
        const p = P0[i];
        k.cyl(0.034, 0.034, FH + 0.2, M.fence, [p.x, p.y + (FH + 0.2) / 2 - 0.12, p.z], null, 8);
        k.sphere(0.042, M.fence, [p.x, p.y + FH + 0.1, p.z], 8);
      }
      for (let i = 0; i < n; i++) {
        const a = P0[i], b = P0[i + 1];
        pipe(V3(a.x, a.y + FH, a.z), V3(b.x, b.y + FH, b.z), 0.024, M.fence);
        pipe(V3(a.x, a.y + 0.1, a.z), V3(b.x, b.y + 0.1, b.z), 0.02, M.fence);
        // wire mesh panel (sheared quad following the ground)
        const dl = a.distanceTo(b) - 0.08, ux = (b.x - a.x) / a.distanceTo(b), uz = (b.z - a.z) / a.distanceTo(b);
        const a2 = V3(a.x + ux * 0.04, a.y, a.z + uz * 0.04), b2 = V3(b.x - ux * 0.04, b.y, b.z - uz * 0.04);
        const y0 = 0.12, y1 = FH - 0.02, tile = 0.14;
        const gq = new THREE.BufferGeometry();
        gq.setAttribute('position', new THREE.Float32BufferAttribute([a2.x, a2.y + y0, a2.z, b2.x, b2.y + y0, b2.z, b2.x, b2.y + y1, b2.z, a2.x, a2.y + y1, a2.z], 3));
        gq.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, dl / tile, 0, dl / tile, (y1 - y0) / tile, 0, (y1 - y0) / tile], 2));
        gq.setIndex([0, 1, 2, 0, 2, 3]); gq.computeVertexNormals();
        const mq = addMesh(gq, M.fenceMesh, { shadow: true });
        ctx.noOutline(mq);
      }
      const mx = (ax + bx) / 2, mz = (az + bz) / 2;
      physics.addBox(mx, mz, 0.12, len + 0.08, Math.atan2(bx - ax, bz - az), -1, Math.max(fenceGround(ax, az), fenceGround(bx, bz)) + FH + 0.15);
    }
  }
  // west pockets start with a short stub that meets the railway's corridor fence ends (x -17.5, z -33.8 / -52.2)
  const RWF = ctx.services.railway?.fences;
  const zRS = Number.isFinite(RWF?.southZ) ? RWF.southZ : -33.8, zRN = Number.isFinite(RWF?.northZ) ? RWF.northZ : -52.2;
  const xRW = Array.isArray(RWF?.ranges?.[0]) && Number.isFinite(RWF.ranges[0][1]) ? RWF.ranges[0][1] : -17.5;
  const stubX = Math.max(xRW + 0.05, ZONE.x0 - 0.6);
  fence([[stubX, zRS - 0.05], [XAW + 0.05, zRS - 0.05], [XAW + 0.05, ZFS], [XDW - 0.05, ZFS]]);   // SW
  fence([[XAE - 0.05, ZONE.z1 - 0.05], [XAE - 0.05, ZFS], [XDE + 0.05, ZFS]]);                    // SE
  fence([[stubX, zRN + 0.05], [XAW + 0.05, zRN + 0.05], [XAW + 0.05, ZFN], [XDW - 0.05, ZFN]]);   // NW
  fence([[XAE - 0.05, ZONE.z0 + 0.05], [XAE - 0.05, ZFN], [XDE + 0.05, ZFN]]);                    // NE
  function plate(x, z, rotY, w, h, m, yOff) {
    const gy = prof(z);
    const g = k.group([x, gy, z], rotY); const kk = ctx.kit(g);
    kk.box(w + 0.02, h + 0.02, 0.012, M.plateBack, [0, yOff, 0]);
    signPlane(kk, m, w, h, [0, yOff, 0.012]);
  }
  // 踏切注意 on the side fences, facing the road; 線路内立入禁止 on the track-side returns
  plate(XAW + 0.1, -34.95, Math.PI / 2, 0.5, 0.31, 'chui', 0.78);
  plate(XAE - 0.1, -34.95, -Math.PI / 2, 0.5, 0.31, 'chui', 0.78);
  plate(XAW + 0.1, -51.05, Math.PI / 2, 0.5, 0.31, 'chui', 0.78);
  plate(XAE - 0.1, -51.05, -Math.PI / 2, 0.5, 0.31, 'chui', 0.78);
  plate(-16.2, ZFS + 0.05, 0, 0.45, 0.28, 'kinshi', 0.72);
  plate(-7.8, ZFS + 0.05, 0, 0.45, 0.28, 'kinshi', 0.72);
  plate(-16.2, ZFN - 0.05, Math.PI, 0.45, 0.28, 'kinshi', 0.72);
  plate(-7.8, ZFN - 0.05, Math.PI, 0.45, 0.28, 'kinshi', 0.72);

  // ------------------------------------------------------------------ weeds at the fence feet & apron cracks
  const grassGeo = ctx.geo.G.plane();
  function tuft(x, z, y, s) {
    for (let i = 0; i < 2; i++) {
      const me = new THREE.Mesh(grassGeo, M.grass);
      me.scale.set(s, s * 0.8, 1); me.position.set(x, y + s * 0.4 - 0.02, z); me.rotation.y = rng() * Math.PI + i * Math.PI / 2;
      me.castShadow = false; me.receiveShadow = true; ctx.noOutline(me); root.add(me);
    }
  }
  for (let i = 0; i < 26; i++) {
    const corner = i % 4;
    const west = corner === 0 || corner === 2, south = corner < 2;
    const x = west ? XAW + 0.12 + rng() * 0.25 : XAE - 0.12 - rng() * 0.25;
    const z = south ? ZFS + 0.2 + rng() * (ZONE.z1 - ZFS - 0.4) : ZFN - 0.2 - rng() * (ZFN - ZONE.z0 - 0.4);
    tuft(x, z, prof(z), 0.22 + rng() * 0.2);
  }
  for (const [x, z] of [[-15.62, -36.3], [-15.55, -38.1], [-8.4, -36.95], [-8.45, -48.9], [-15.62, -49.6], [-16.1, -39.0], [-7.9, -47.0], [-16.7, -51.4], [-7.35, -38.55]]) tuft(x, z, prof(z), 0.2 + rng() * 0.12);

  // ------------------------------------------------------------------ finalize dynamic parts
  root.updateMatrixWorld(true);
  const bake = (list) => {
    const geos = list.map((m) => {
      m.updateWorldMatrix(true, false);
      const g = m.geometry.clone(); g.applyMatrix4(m.matrixWorld);
      for (const a of Object.keys(g.attributes)) if (a !== 'position' && a !== 'normal' && a !== 'uv') g.deleteAttribute(a);
      if (!g.index) { const n = g.attributes.position.count; g.setIndex([...Array(n).keys()]); }
      return g;
    });
    for (const m of list) m.parent && m.parent.remove(m);
    return geos.length ? ctx.geo.mergeGeometries(geos, false) : null;
  };
  for (const a of dyn._arrows) {
    a.updateWorldMatrix(true, false);
    const d = V3(1, 0, 0).transformDirection(a.matrixWorld);
    (d.x > 0 ? dyn.arrowE : dyn.arrowW).push(a);
  }
  for (const f of lampFaces) {
    f.obj.updateWorldMatrix(true, false);
    const c = f.obj.localToWorld(V3(0, 0, 0.07)), n = V3(0, 0, 1).transformDirection(f.obj.matrixWorld);
    halos[f.phase].push({ c, n, size: 0.55 });
  }
  const reactItems = reactHalos.map((fg) => { fg.updateWorldMatrix(true, false); return { c: fg.localToWorld(V3(0, 0, 0.05)), n: V3(0, 0, 1).transformDirection(fg.matrixWorld), size: 0.32 }; });
  const dynMesh = (geo, m) => { const me = new THREE.Mesh(geo, m); me.castShadow = false; me.receiveShadow = false; ctx.add(me); return me; };
  const lensMeshes = [dynMesh(bake(dyn.lens[0]), M.lensOff), dynMesh(bake(dyn.lens[1]), M.lensOff)];
  const arrowE = dynMesh(bake(dyn.arrowE), M.arrowOff), arrowW = dynMesh(bake(dyn.arrowW), M.arrowOff);
  const reactMesh = dynMesh(bake(dyn.react), M.reactOff);
  const haloMeshes = halos.map((h) => ctx.add(makeHaloMesh(ctx, h, '#ff4a34', { intensity: 1.7, streak: 1.0 })));
  const coneMeshes = halos.map((h) => ctx.add(makeConeMesh(ctx, h.map(it => ({ c: it.c.clone().addScaledVector(it.n, 0.02), n: it.n })), '#ff5a40', { length: 1.1, r0: 0.12, r1: 0.3, intensity: 1.0 })));
  const reactHalo = ctx.add(makeHaloMesh(ctx, reactItems, '#fff0d0', { intensity: 1.2, streak: 0.6 }));

  // merge all static parts into a few meshes (vertex-coloured plain parts + one mesh per textured material)
  mergeGroup(root);

  // ------------------------------------------------------------------ state: rail service or timetable-derived demo cycle
  const PER = L.TRAIN?.period || 120;
  // Demo cycle (used only without ctx.services.rail): 22 s warnings matching the timetable —
  // train B (eastbound, from the west) passes ~20-26 s, train A (westbound, from the east) ~52-59 s.
  const WIN = [{ t0: 5.5, t1: 27.5, west: true }, { t0: 37.5, t1: 59.5, west: false }];
  const LOWER_DELAY = 3.0, LOWER_T = 5.0, RAISE_T = 4.0;
  function demoAt(t) {
    const tm = ((t % PER) + PER) % PER, base = t - tm;
    for (const w of WIN) if (tm >= w.t0 && tm < w.t1) {
      return { active: true, fromWest: w.west, fromEast: !w.west, down: ease(clamp01((tm - w.t0 - LOWER_DELAY) / LOWER_T)) };
    }
    let best = -1e9, bw = WIN[0];
    for (const w of WIN) { let te = base + w.t1; if (te > t) te -= PER; if (te > best) { best = te; bw = w; } }
    const d0 = ease(clamp01((bw.t1 - bw.t0 - LOWER_DELAY) / LOWER_T));
    return { active: false, fromWest: false, fromEast: false, down: d0 * (1 - ease(clamp01((t - best) / RAISE_T))) };
  }
  const S = { active: false, tOn: -1e9, tOff: -1e9, dOn: 0, d0: 0, lastT: null };
  const svcDown = (t) => S.active
    ? S.dOn + (1 - S.dOn) * ease(clamp01((t - S.tOn - LOWER_DELAY) / LOWER_T))
    : S.d0 * (1 - ease(clamp01((t - S.tOff) / RAISE_T)));
  function svcAt(rail, t) {
    let act = false, ap = null;
    try { act = !!rail.crossingActive(CX); ap = typeof rail.crossingApproach === 'function' ? rail.crossingApproach(CX) : null; } catch (e) { act = false; }
    if (S.lastT !== null && t < S.lastT - 0.5) { S.active = false; S.tOff = -1e9; S.d0 = 0; }
    if (act && !S.active) { S.dOn = svcDown(t); S.active = true; S.tOn = t; }
    else if (!act && S.active) { S.d0 = svcDown(t); S.active = false; S.tOff = t; }
    S.lastT = t;
    return { active: act, fromWest: !!(ap && ap.fromWest), fromEast: !!(ap && ap.fromEast), down: svcDown(t) };
  }

  const UP = 1.53;   // raised arm angle (~88°)
  const state = { active: false, down: 0, fromWest: false, fromEast: false };
  let bell = null, lastVol = -1;
  try { bell = ctx.audio && ctx.audio.loop ? ctx.audio.loop('crossingBell', { position: V3(CX, 3.4, (ZDS + ZDN) / 2), volume: 0 }) : null; } catch (e) { bell = null; }
  ctx.services.crossing = { x: CX, zone: ZONE, get active() { return state.active; }, get barrierDown() { return state.down; } };

  physics.addDynamic(() => (state.down > 0.55 ? arms.map(a => a.box) : []));

  ctx.onUpdate((dt, t) => {
    const rail = ctx.services.rail;
    const st = rail && typeof rail.crossingActive === 'function' ? svcAt(rail, t) : demoAt(t);
    state.active = st.active; state.fromWest = st.fromWest; state.fromEast = st.fromEast;
    const dn = clamp01(st.down); state.down = dn;
    // lamps alternate ~50 flashes/min each
    const ph = ((Math.floor(t / 0.6) % 2) + 2) % 2;
    for (let i = 0; i < 2; i++) {
      const on = st.active && ph === i;
      lensMeshes[i].material = on ? M.lensOn : M.lensOff;
      haloMeshes[i].material.uniforms.uOn.value = on ? 1 : 0;
      coneMeshes[i].material.uniforms.uOn.value = on ? 1 : 0;
    }
    // direction arrows point the way the train travels (from the west -> it runs east)
    arrowE.material = st.active && st.fromWest ? M.arrowOn : M.arrowOff;
    arrowW.material = st.active && st.fromEast ? M.arrowOn : M.arrowOff;
    reactMesh.material = st.active ? M.reactOn : M.reactOff;
    reactHalo.material.uniforms.uOn.value = st.active ? 1 : 0;
    // barrier arms: smooth lower/raise (slight droop when fully down)
    const e = dn;
    const ang = (1 - e) * UP - e * 0.012;
    const armOn = st.active && dn > 0.02 && ph === 0;
    for (const a of arms) { a.rot.rotation.z = ang; a.lensMesh.material = armOn ? M.lensOn : M.lensOff; a.haloMesh.material.uniforms.uOn.value = armOn ? 1 : 0; }
    // bell
    const vol = st.active ? 1 : 0;
    if (vol !== lastVol && bell) { try { bell.setVolume(vol, 0.08); } catch (err) { /* audio optional */ } lastVol = vol; }
  });
}
