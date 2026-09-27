// Where every cherry tree goes (all positions derived from layout.js), with species, LOD and the
// clearance envelopes that keep canopies off roads, platforms, the train/catenary envelope and
// neighbouring buildings.
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export function makePlacements(ctx) {
  const L = ctx.L;
  const H = L.heightAt;
  const R = ctx.rng('sakura-placement');
  const jit = (a) => (R() - 0.5) * 2 * a;

  // ------------------------------------------------------------ smooth clearance floor (absolute y)
  function roadWeight(x, z) {
    // 1 on a road surface, fading to 0 within 1.3 m outside its edge
    let d = Infinity;
    if (z > 1 && z < 131) d = Math.min(d, Math.abs(x - L.streetCenterX(z)) - L.STREET.halfW);
    const R2 = L.ROADS.R2; if (z > R2.z0 && z < R2.z1) d = Math.min(d, Math.abs(x - R2.x) - R2.halfW);
    const R3 = L.ROADS.R3; if (Math.abs(x) < R3.x1) d = Math.min(d, Math.abs(z - R3.z) - R3.halfW);
    const R4 = L.ROADS.R4; if (Math.abs(x) < R4.x1) d = Math.min(d, Math.abs(z - R4.z) - R4.halfW);
    const R6 = L.ROADS.R6; if (Math.abs(x) < R6.x1) d = Math.min(d, Math.abs(z - R6.z) - R6.halfW);
    return 1 - sstep(0, 1.3, d);
  }
  function inRect(x, z, x0, x1, z0, z1, m) { return Math.min(sstep(x0 - m, x0, x), 1 - sstep(x1, x1 + m, x), sstep(z0 - m, z0, z), 1 - sstep(z1, z1 + m, z)); }
  function baseFloor(x, z) {
    const g = H(x, z);
    let f = g + 2.45 + 1.85 * roadWeight(x, z);
    const PS = L.PLATFORM.south, PN = L.PLATFORM.north;
    const plat = Math.max(inRect(x, z, PS.x0, L.PLATFORM.rampX1, PS.z0, PS.z1, 0.8), inRect(x, z, PN.x0, L.PLATFORM.rampX1, PN.z0, PN.z1, 0.8));
    f = Math.max(f, g + (L.PLATFORM.y + 3.65 - g) * plat);
    const SY = L.STATION.sideYard; const sy = inRect(x, z, SY.x0, SY.x1, SY.z0, SY.z1, 0.8);
    f = Math.max(f, g + 2.45 + 2.2 * sy);
    const lev = inRect(x, z, -140, 140, -94.6, -91.4, 1.0);
    f = Math.max(f, (L.ROADS.R5.y + 2.65) * lev);
    return f;
  }

  // ------------------------------------------------------------ keep-out boxes
  const TRACK_N = { x0: -500, x1: 500, z0: -46.7, z1: -39.3, y0: -5, y1: 8.6, push: 'z-' }; // tree north of the tracks
  const TRACK_S = { ...TRACK_N, push: 'z+' };
  const STATION = { x0: L.STATION.x0 - 0.9, x1: L.STATION.x1 + 0.9, z0: L.STATION.z0 - 0.5, z1: L.STATION.z1 + 0.7, y0: -5, y1: 10.5, push: 'z+' };
  const houseRearNW = { x0: -63, x1: -15, z0: -31.3, z1: -5.5, y0: -5, y1: 12, push: 'z-' };
  const houseRearNE = { x0: 26.5, x1: 63, z0: -31.3, z1: -5.5, y0: -5, y1: 12, push: 'z-' };
  const houseN1W = { x0: -86, x1: -15, z0: -70, z1: -58.7, y0: -5, y1: 12, push: 'z+' };
  const houseN1E = { x0: -9, x1: 86, z0: -70, z1: -58.7, y0: -5, y1: 12, push: 'z+' };
  const poleBoxes = (tx) => L.POLE_RUNS.R4S.map(p => ({ x0: p.x - 0.55, x1: p.x + 0.55, z0: p.z - 0.55, z1: p.z + 0.55, y0: -5, y1: 14, push: tx < p.x ? 'x-' : 'x+' }));

  const trees = [];
  const add = (t) => { trees.push({ lod: 0, bark: 'old', floorAt: baseFloor, seed: 'sakura-' + t.id, ...t }); };

  // ============================================================ hero plaza tree (the big one)
  {
    const T = L.PLAZA.tree;
    add({
      id: 'plaza', kind: 'old', meshH: 0.2, x: T.x, z: T.z, height: 10.3, spread: 7.3, spreadZ: 6.6, vr: 0.5, trunkR: 0.5, forkH: 2.35,
      lean: [0.28, -0.12], offset: [0.35, 0.35], limbs: 6, padR: 1.3, thetaMax: 1.92, archDirs: [0.25, 1.75], lobes: 0.2,
      gnarl: 0.16, limbArch: 0.26, rootReach: 1.15, inner: 0.24,
      floorAt: (x, z) => { const g = H(x, z); return Math.max(baseFloor(x, z), g + 2.55 + 1.45 * (1 - sstep(-6.5, -4.8, x))); },
      keepOut: [STATION], base: { type: 'none' },
    });
  }
  // ============================================================ W3 garden tree leaning east over the street
  {
    const s = L.SPOTS.w3Sakura;
    add({
      id: 'w3', kind: 'old', meshH: 0.19, x: s.x, z: s.z, height: 9.1, spread: 5.8, spreadZ: 4.7, vr: 0.47, trunkR: 0.36, forkH: 2.65,
      lean: [1.15, 0.05], leanEarly: 0.5, offset: [2.35, 0.25], limbs: 5, padR: 1.12, thetaMax: 1.9, archDirs: [0.1], lobes: 0.2,
      gnarl: 0.15, limbArch: 0.2, limbReach: 0.66, rootReach: 0.95,
      keepOut: [
        { x0: -20, x1: -10.3, z0: 22.4, z1: 31.6, y0: -5, y1: 13, push: 'x+' },   // the W3 house
        { x0: -20, x1: -5.3, z0: 14, z1: 22.35, y0: -5, y1: 13, push: 'z+' },     // W2 flower shop
        { x0: -20, x1: -5.3, z0: 31.65, z1: 41, y0: -5, y1: 13, push: 'z-' },     // W4 bookstore
      ],
      // houses lays a ring of garden stones round this tree; only add our own when it is absent
      base: ctx.services.houses ? { type: 'soil', r: 1.0 } : { type: 'stones', r: 1.18 },
    });
  }
  // ============================================================ shrine: weeping cherry (枝垂れ桜)
  {
    const s = L.SPOTS.shrineSakura;
    add({
      id: 'shrine', kind: 'weeping', x: s.x, z: s.z, height: 7.0, spread: 3.9, trunkR: 0.34, forkH: 2.5, limbs: 6, strands: 11, hang: 3.6,
      floorAt: (x, z) => H(x, z) + 1.75 + 2.3 * roadWeight(x, z), base: { type: 'stones', r: 1.25, shimenawa: true },
      keepOut: [{ x0: -2, x1: 24, z0: 30, z1: 47.9, y0: -5, y1: 20, push: 'z+' }], // E5 ramen shop next door
    });
  }
  // ============================================================ plaza SW corner (young, keeps the crossing view clear)
  add({
    id: 'plazaSW', kind: 'young', x: -7.6, z: -7.8, height: 6.1, spread: 2.9, vr: 0.72, trunkR: 0.15, forkH: 1.75, lean: [0.12, 0.08],
    offset: [0.2, 0.1], limbs: 3, padR: 0.82, bark: 'young', thetaMax: 1.85, gnarl: 0.1, limbArch: 0.35, rootReach: 0.45,
    floorAt: (x, z) => Math.max(baseFloor(x, z), H(x, z) + 3.3), base: { type: 'pit', size: 1.35 },
  });
  // ============================================================ east of the station forecourt
  add({
    id: 'forecourtE', kind: 'medium', x: 19.5, z: -22.0, height: 7.8, spread: 4.1, spreadZ: 3.8, vr: 0.55, trunkR: 0.3, forkH: 2.25,
    lean: [0.1, 0.25], offset: [0.1, 0.7], limbs: 4, padR: 1.05, keepOut: [STATION], rootReach: 0.7, base: { type: 'pit', size: 1.6 },
  });
  // ============================================================ behind the north platform fence
  for (const x of [2, 14, 26]) {
    add({
      id: 'platN' + x, kind: 'medium', x: x + jit(0.4), z: -51.3, height: 8.4 + jit(0.4), spread: 4.1, spreadZ: 3.5, vr: 0.52, trunkR: 0.3, forkH: 2.5,
      lean: [jit(0.3), 0.3], offset: [jit(0.4), 1.0], limbs: 4, padR: 1.08, rootReach: 0.75,
      keepOut: [TRACK_N, ...poleBoxes(x)], base: { type: 'soil', r: 1.1 },
    });
  }
  // ============================================================ behind the south platform
  // (x 20 stands in the station side yard: 0.9 m south of the station's hedge line at z -34.85)
  for (const x of [20, 32]) {
    add({
      id: 'platS' + x, kind: 'medium', x: x + jit(0.3), z: x < 27 ? -33.7 : -34.6, height: 8.0 + jit(0.4), spread: 3.9, spreadZ: 3.3, vr: 0.54, trunkR: 0.28, forkH: 2.4,
      lean: [jit(0.3), -0.3], offset: [jit(0.3), -1.0], limbs: 4, padR: 1.05, rootReach: 0.7,
      keepOut: [TRACK_S, houseRearNE], base: { type: 'soil', r: 1.0 },
    });
  }
  // ============================================================ corridor: south row (NW / NE rear strips)
  const rowS = [];
  for (let x = -23.5; x > -61; x -= 8.6) rowS.push(x + jit(1.2));
  for (let x = 51.5; x < 62.5; x += 8.8) rowS.push(x + jit(0.8));
  rowS.forEach((x, i) => add({
    id: 'rowS' + i, kind: 'medium', x, z: -32.8 + jit(0.25), height: 7.2 + jit(0.6), spread: 3.8 + jit(0.3), spreadZ: 3.3, vr: 0.55, trunkR: 0.27, forkH: 2.2,
    lean: [jit(0.3), -0.35], offset: [jit(0.3), -1.25], limbs: 4, padR: 1.2, lod: 1, rootReach: 0.7,
    keepOut: [TRACK_S, x < 0 ? houseRearNW : houseRearNE], base: { type: 'soil', r: 1.0 },
  }));
  // ============================================================ corridor: north row along R4 (tunnel over the lane)
  const poles = L.POLE_RUNS.R4S.map(p => p.x);
  const rowN = [];
  const pushPole = (x) => { for (const p of poles) if (Math.abs(x - p) < 2.6) x = p + Math.sign(x - p || 1) * 2.7; return x; };
  for (let x = -24.5; x > -91; x -= 8.3) rowN.push(pushPole(x + jit(1.1)));
  for (let x = 52.5; x < 91; x += 8.3) rowN.push(pushPole(x + jit(1.1)));
  rowN.forEach((x, i) => add({
    id: 'rowN' + i, kind: 'medium', x, z: -52.9 + jit(0.15), height: 7.7 + jit(0.6), spread: 4.2 + jit(0.3), spreadZ: 3.7, vr: 0.52, trunkR: 0.29, forkH: 2.35,
    lean: [jit(0.3), -0.4], offset: [jit(0.3), -1.45], limbs: 4, padR: 1.2, lod: Math.abs(x) > 80 ? 2 : 1, rootReach: 0.65,
    keepOut: [TRACK_N, x < 0 ? houseN1W : houseN1E, ...poleBoxes(x)], base: { type: 'soil', r: 0.95 },
  }));
  // ============================================================ levee rows (桜堤) on both shoulders of the levee path
  const stairs = [-12, 40];
  const nearStairs = (x) => stairs.some(s => Math.abs(x - s) < 5.0);
  const levee = [];
  for (const [z0, side, start] of [[-90.8, -1, -124], [-95.3, 1, -119.5]]) {
    for (let x = start; x <= 125; x += 9.2 + jit(0.6)) {
      const xx = x + jit(1.3);
      if (nearStairs(xx)) continue;
      levee.push({ x: xx, z: z0 + jit(0.12), side });
    }
  }
  levee.forEach((p, i) => add({
    id: 'levee' + i, kind: 'medium', x: p.x, z: p.z, height: 7.6 + jit(0.8), spread: 4.3 + jit(0.4), spreadZ: 3.9, vr: 0.52, trunkR: 0.3 + jit(0.04), forkH: 2.3,
    lean: [jit(0.35), p.side * -0.35], offset: [jit(0.4), p.side * -1.05], limbs: 4, padR: Math.abs(p.x) > 92 ? 1.7 : 1.35, lod: Math.abs(p.x) > 92 ? 2 : 1,
    inner: 0.12, rootReach: 0.7, base: { type: Math.abs(p.x) > 100 ? 'none' : 'soil', r: 1.0 },
  }));
  // ============================================================ street-corner / roadside trees in square pits
  add({
    id: 'cornerE', kind: 'medium', x: 64.6, z: -8.0, height: 6.8, spread: 3.4, vr: 0.58, trunkR: 0.24, forkH: 2.1, lean: [0.1, 0.1], offset: [0, 0],
    limbs: 4, padR: 1.0, lod: 1, rootReach: 0.55, keepOut: [houseRearNE], base: { type: 'pit', size: 1.5 },
  });
  add({
    id: 'cornerW', kind: 'weeping', x: -64.8, z: -8.4, height: 6.0, spread: 3.3, trunkR: 0.26, forkH: 2.3, limbs: 5, strands: 9, hang: 3.0, lod: 1,
    floorAt: (x, z) => H(x, z) + 1.8 + 2.4 * roadWeight(x, z), base: { type: 'stones', r: 1.05 },
  });
  const r3South = { x0: -95, x1: 95, z0: 3.0, z1: 20, y0: -5, y1: 12, push: 'z-' };
  for (const [id, x] of [['r3W', -36.2], ['r3E', 33.8]]) {
    add({
      id, kind: 'young', x, z: 1.85, height: 5.4, spread: 2.5, vr: 0.7, trunkR: 0.13, forkH: 1.9, lean: [0, -0.1], offset: [0, -0.5],
      limbs: 3, padR: 0.8, bark: 'young', lod: 1, rootReach: 0.35, keepOut: [r3South], base: { type: 'pit', size: 1.05 },
    });
  }
  // ============================================================ garden trees (houses.gardenSpots, else fallback lot corners)
  const others = trees.map(t => [t.x, t.z]);
  const farFromOthers = (x, z, d) => others.every(([ox, oz]) => Math.hypot(ox - x, oz - z) > d);
  let spots = ctx.services.houses?.gardenSpots;
  const fromHouses = Array.isArray(spots);
  if (!fromHouses) {
    spots = [];
    for (const [id, sgn] of [['W5', 1], ['E4', -1], ['W7', -1], ['E8', 1], ['W9', 1], ['E10', -1], ['W11', -1], ['E12', 1]]) {
      const lot = L.lotById(id); if (!lot) continue;
      const w = lot.z1 - lot.z0; const p = L.lotToWorld(lot, sgn * (w / 2 - 2.0), -12.2);
      spots.push({ x: p.x, z: p.z, r: 1.6 });
    }
  }
  const cand = spots.filter(s => s && Number.isFinite(s.x) && Number.isFinite(s.z) && (s.r ?? 1.5) >= 1.0)
    .map(s => ({ ...s, d: Math.hypot(s.x - 0, (s.z - 10) * 0.8) }))
    .sort((a, b) => (b.r ?? 1.5) - (a.r ?? 1.5) || a.d - b.d);
  let nG = 0;
  for (const s of cand) {
    if (nG >= 7) break;
    if (!farFromOthers(s.x, s.z, 9)) continue;
    // the spot radius is the free garden around the trunk (houses stand ~1.2 m beyond it): tight front
    // gardens get a slim young tree, open corner plots a medium one whose crown stays near the plot
    const sr = s.r ?? 1.5;
    const young = sr < 1.7 || R() < 0.3;
    const r = young ? Math.min(2.0, sr + 0.3) : Math.min(3.0, sr * 1.35);
    add({
      id: 'garden' + nG, kind: young ? 'young' : 'medium', x: s.x, z: s.z, height: young ? 4.9 + jit(0.3) : 6.4 + jit(0.4), spread: r, vr: young ? 0.85 : 0.6,
      trunkR: young ? 0.14 : 0.22, forkH: young ? 1.8 : 2.1, lean: [jit(0.2), jit(0.2)], offset: [jit(0.3), jit(0.3)], limbs: young ? 3 : 4,
      padR: young ? 0.82 : 0.98, bark: young ? 'young' : 'old', lod: s.d < 60 ? 0 : 1, rootReach: young ? 0.35 : 0.55,
      base: { type: R() < 0.45 ? 'stones' : 'soil', r: Math.min(0.95, (s.r ?? 1.5) * 0.7) },
    });
    others.push([s.x, s.z]); nG++;
  }
  return { trees, floor: baseFloor, roadWeight, fromHouses };
}
