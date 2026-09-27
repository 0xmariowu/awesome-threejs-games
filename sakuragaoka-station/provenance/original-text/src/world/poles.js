// 電柱と電線 — utility poles of 桜ヶ丘町 (桜川電力), everything mounted on them, and every street wire:
// 6.6 kV conductors on crossarms, overhead ground wire, low-voltage racks, telecom cables with
// closures, cross-street zigzag spans, service drops (引込線) to the facades, guy wires with guards.
// Publishes ctx.services.poles = { poles:[{x,z,y,top,id}], spans:[{points,kind}], drops } (service-drop spans are
// appended when the shared wire mesh is built, after every module — see section 8).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { Acc } from './poles/acc.js';
import { createFacadeFinder } from './poles/facade.js';
import { makeAtlases, RA, RB, adRect, plateRect, telPlateRect, uvOf, WHITE_UV } from './poles/atlas.js';

const V3 = THREE.Vector3;
const UP = new V3(0, 1, 0);
const TAU = Math.PI * 2, HALF = Math.PI / 2;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const angd = (a, b) => { let d = (a - b) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return Math.abs(d); };

// ---------------------------------------------------------------- shared unit geometries
const _gc = new Map();
const cache = (k, f) => { let g = _gc.get(k); if (!g) _gc.set(k, (g = f())); return g; };
const LP = { // lathe profiles (radius, y) bottom -> top
  pin: [[0.0, 0], [0.03, 0], [0.03, 0.018], [0.074, 0.046], [0.036, 0.063], [0.06, 0.095], [0.031, 0.11], [0.034, 0.14], [0.0, 0.157]],
  spool: [[0, 0], [0.037, 0], [0.043, 0.008], [0.03, 0.022], [0.028, 0.04], [0.03, 0.054], [0.043, 0.068], [0.037, 0.076], [0, 0.076]],
  bush: [[0, 0], [0.03, 0], [0.032, 0.02], [0.05, 0.03], [0.028, 0.045], [0.043, 0.06], [0.024, 0.075], [0.03, 0.09], [0.012, 0.1], [0, 0.1]],
};
const G = {
  box: () => cache('box', () => new THREE.BoxGeometry(1, 1, 1)),
  cyl: (s) => cache('c' + s, () => new THREE.CylinderGeometry(0.5, 0.5, 1, s, 1, false)),
  cylO: (s) => cache('co' + s, () => new THREE.CylinderGeometry(0.5, 0.5, 1, s, 1, true)),
  sph: (s) => cache('s' + s, () => new THREE.SphereGeometry(0.5, s, Math.max(4, Math.round(s * 0.6)))),
  plane: () => cache('pl', () => new THREE.PlaneGeometry(1, 1)),
  rbox: () => cache('rb', () => new RoundedBoxGeometry(1, 1, 1, 2, 0.18)),
  torus: () => cache('tor', () => new THREE.TorusGeometry(0.3, 0.016, 5, 22)),
  lathe: (n, s = 10) => cache('l' + n + s, () => new THREE.LatheGeometry(LP[n].map(p => new THREE.Vector2(p[0], p[1])), s)),
  diamond: () => cache('dia', () => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0.5, 0, 0.5, 0, 0, 0, -0.5, 0, -0.5, 0, 0], 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1], 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute([0.5, 1, 1, 0.5, 0.5, 0, 0, 0.5], 2));
    g.setIndex([0, 3, 2, 0, 2, 1]);
    return g;
  }),
};

// sticker / sign physical sizes (m)
const STK = {
  mascot0: [0.13, 0.13], mascot1: [0.13, 0.13], mascot2: [0.13, 0.13], camera: [0.16, 0.12], suido: [0.16, 0.08],
  harigami: [0.07, 0.175], poisute: [0.1, 0.133], hittakuri: [0.1, 0.133], tako: [0.1, 0.15], scrap: [0.07, 0.07],
  scrap2: [0.07, 0.07], dog: [0.1, 0.1], kodomo: [0.1, 0.133],
};
const SIGN = { diamond: [0.5, 0.5], aux: [0.42, 0.14], station: [0.5, 0.19], hydrant: [0.26, 0.43] };
const COMPASS = { S: 0, SE: Math.PI / 4, E: HALF, NE: 3 * Math.PI / 4, N: Math.PI, NW: -3 * Math.PI / 4, W: -HALF, SW: -Math.PI / 4 };

// per-pole features (see docs/SPEC 四/二/十五). ad:[adIndex, face], st:[[sticker, face, y]], sign:[[type, face, y]]
const FEAT = {
  W0: { tr: 1, cam: 'N', ad: [0, 'S'], st: [['mascot0', 'SE', 1.5], ['poisute', 'NW', 1.3], ['scrap', 'N', 1.72]] },
  W1: { sw: 1, ad: [1, 'S'], st: [['harigami', 'NE', 1.35], ['mascot1', 'SW', 1.55], ['dog', 'N', 1.1]] },
  W2: { tr: 2, ad: [2, 'S'], st: [['suido', 'SE', 1.62], ['scrap2', 'W', 1.4], ['hittakuri', 'N', 1.45]] },
  W3: { ad: [3, 'S'], sign: [['hydrant', 'road', 2.74]], st: [['kodomo', 'SW', 1.45], ['scrap', 'E', 1.2]] },
  W4: { tr: 1, ad: [4, 'S'], st: [['mascot2', 'SE', 1.5], ['dog', 'NW', 1.15]] },
  E0: { sign: [['diamond', 'S', 3.03], ['aux', 'S', 2.58]], ad: [5, 'N'], st: [['mascot0', 'SW', 1.52], ['scrap2', 'NW', 1.35], ['poisute', 'SE', 1.22]] },
  E1: { tr: 1, ad: [6, 'S'], sign: [['hydrant', 'road', 2.74]], st: [['poisute', 'SE', 1.35], ['harigami', 'N', 1.4]] },
  E2: { ad: [7, 'S'], st: [['mascot1', 'SW', 1.5], ['suido', 'NE', 1.58]] },
  E3: { tr: 2, ad: [8, 'S'], st: [['hittakuri', 'SE', 1.45], ['dog', 'W', 1.12], ['scrap', 'N', 1.6]] },
  'S-26': { ad: [9, 'E'], st: [['mascot2', 'SE', 1.5], ['poisute', 'NE', 1.3]] },
  'S-52': { tr: 1, ad: [10, 'E'], st: [['suido', 'S', 1.58], ['scrap', 'W', 1.3]] },
  'S-78': { sw: 1, st: [['harigami', 'E', 1.4], ['dog', 'S', 1.12]] },
  S22: { tr: 1, ad: [11, 'W'], st: [['mascot0', 'SW', 1.52], ['hittakuri', 'S', 1.35], ['scrap2', 'E', 1.62]] },
  S46: { ad: [0, 'W'], st: [['poisute', 'SW', 1.3], ['kodomo', 'S', 1.5]] },
  S72: { tr: 1, st: [['dog', 'W', 1.15], ['suido', 'S', 1.58]] },
  K0: { cam: 'N', telHigh: 1, sign: [['station', 'S', 2.64]], ad: [2, 'N'], st: [['camera', 'S', 1.62], ['mascot1', 'E', 1.45]] },
  K1: { telHigh: 1, ad: [4, 'S'], st: [['tako', 'E', 1.45], ['harigami', 'N', 1.35]] },
  K2: { tr: 1, st: [['tako', 'S', 1.45], ['mascot2', 'E', 1.5]] },
  N0: { st: [['scrap', 'N', 1.4]] },
  N1: { st: [['poisute', 'N', 1.3], ['kodomo', 'W', 1.5]] },
  N2: { ad: [5, 'E'], st: [['mascot0', 'NE', 1.5], ['hittakuri', 'N', 1.35]] },
  N3: { st: [['dog', 'N', 1.12], ['scrap2', 'E', 1.5]] },
  N4: { st: [['suido', 'N', 1.58]] },
  N5: { st: [['harigami', 'N', 1.4]] },
  A0: { tr: 1, st: [['tako', 'N', 1.45]] },
  A1: { st: [['mascot1', 'N', 1.5], ['dog', 'E', 1.12]] },
  A2: { tr: 1, ad: [9, 'W'], st: [['tako', 'NE', 1.45], ['scrap', 'S', 1.4]] },
  A3: { ad: [7, 'E'], st: [['kodomo', 'N', 1.5]] },
  A4: { st: [['tako', 'N', 1.45], ['poisute', 'W', 1.3]] },
};

export async function build(ctx) {
  const L = ctx.L, mat = ctx.mat, heightAt = L.heightAt;
  const R = ctx.rng('poles:v1');
  const _cc = new Map(); const C = (h) => { let c = _cc.get(h); if (!c) _cc.set(h, (c = new THREE.Color(h))); return c; };
  const COL = {
    cap: C('#b3b2ab'), steel: C('#a1a8ae'), steelLight: C('#b9bec2'), steelDark: C('#7d848b'), porcelain: C('#e9e6df'),
    porcelainGrey: C('#cdd1d1'), black: C('#48454f'), closure: C('#4a4751'), trans: C('#c5cacd'), transDark: C('#a7adb1'),
    lampArm: C('#c9ccc9'), lampHousing: C('#dcdfdc'), camera: C('#e7e5df'), lens: C('#3a3346'), yellow: C('#eec13a'),
    yellowDark: C('#c99a26'), boxGrey: C('#aab1b5'), boxGreyDark: C('#949ba0'), cutout: C('#dfddd6'), conduit: C('#b4b6b2'),
    anchor: C('#b8b5ad'), signBack: C('#b7bcc0'), termBox: C('#5a5761'), termBoxDark: C('#4a4751'), telCable: C('#3e3b45'),
    guard: C('#efc33c'), guardBand: C('#3e3a46'),
  };
  const UV = { shaft: uvOf(RA.shaft), sleeve: uvOf(RA.sleeve), cover: uvOf(RA.cover), trans: uvOf(RA.trans) };

  // ================================================================ 1. poles
  const poles = [], byId = {};
  const mk = (id, x, z, o = {}) => {
    const p = { id, x, z, y: heightAt(x, z), cls: 'main', H: 12, detail: 'full', road: [1, 0], f: FEAT[id] || {}, ...o };
    poles.push(p); byId[id] = p; return p;
  };
  const PR = L.POLE_RUNS;
  const R1WH = [12, 11.5, 12, 11.5, 12], R1EH = [11.5, 12, 11.5, 12];
  PR.R1W.forEach((q, i) => mk('W' + i, q.x, q.z, { run: 'R1W', H: R1WH[i] ?? 12, road: [1, 0], gw: true, plate: { line: '桜ヶ丘幹', num: 12 + i } }));
  PR.R1E.forEach((q, i) => mk('E' + i, q.x, q.z, { run: 'R1E', H: R1EH[i] ?? 12, road: [-1, 0], gw: true, plate: { line: '駅前支', num: 1 + i } }));
  const r3w = PR.R3S.filter(q => q.x < 0).sort((a, b) => b.x - a.x), r3e = PR.R3S.filter(q => q.x >= 0).sort((a, b) => a.x - b.x);
  r3w.forEach((q, i) => mk('S' + q.x, q.x, q.z, { run: 'R3S', road: [0, -1], gw: true, plate: { line: '桜ヶ丘幹', num: 11 - i } }));
  r3e.forEach((q, i) => mk('S' + q.x, q.x, q.z, { run: 'R3S', road: [0, -1], gw: true, plate: { line: '東町支', num: 1 + i } }));
  PR.R2W.forEach((q, i) => mk('K' + i, q.x, q.z, { run: 'R2W', road: [1, 0], gw: i > 0, plate: { line: '踏切支', num: 1 + i } }));
  PR.R4S.forEach((q, i) => mk('N' + i, q.x, q.z, { run: 'R4S', cls: 'low', H: 8.5, road: [0, -1], plate: { line: '線路北', num: 1 + i } }));
  PR.R6S.forEach((q, i) => mk('A' + i, q.x, q.z, { run: 'R6S', cls: 'alley', H: 10.5, road: [0, -1], plate: { line: '北町支', num: 1 + i } }));
  // extensions beyond the play area + far-town lines (simplified)
  const far = (id, x, z, o = {}) => mk(id, x, z, { detail: 'far', H: 11.5 + (R() < 0.5 ? 0.5 : 0), f: { tr: R() < 0.25 ? 1 : 0 }, ...o });
  far('XW1', -104, 1.45, { road: [0, -1] }); far('XE1', 98, 1.45, { road: [0, -1] });
  const FZ = [-31.55, 1.45, 34.45, 67.45, 100.45, 133.45, 166.45];
  FZ.forEach((z, i) => { far('FW' + i, -134, z, { road: [1, 0] }); far('FE' + i, 128, z, { road: [-1, 0] }); });
  far('XN0', -106, -53.05, { cls: 'low', H: 8.5, road: [0, -1], f: {} }); far('XN1', -134, -53.05, { cls: 'low', H: 8.5, road: [0, -1], f: {} });
  far('XN2', 106, -53.05, { cls: 'low', H: 8.5, road: [0, -1], f: {} }); far('XN3', 134, -53.05, { cls: 'low', H: 8.5, road: [0, -1], f: {} });
  far('XA0', -91, -69.1, { cls: 'alley', H: 10.5, road: [0, -1] }); far('XA1', -120, -69.1, { cls: 'alley', H: 10.5, road: [0, -1] });
  far('XA2', 93, -69.1, { cls: 'alley', H: 10.5, road: [0, -1] }); far('XA3', 122, -69.1, { cls: 'alley', H: 10.5, road: [0, -1] });
  far('XS0', L.streetCenterX(154) - 3.45, 154, { road: [1, 0] });
  far('XS1', L.streetCenterX(141) + 3.45, 141, { road: [-1, 0] });

  // ================================================================ 2. span topology
  const SP = [];
  const link = (a, b, tiers, run = false) => { if (byId[a] && byId[b]) SP.push({ A: byId[a], B: byId[b], tiers, run }); };
  const chain = (ids, tiers) => { for (let i = 0; i + 1 < ids.length; i++) link(ids[i], ids[i + 1], tiers, true); };
  const MAIN = ['hv', 'gw', 'lv', 'tel'], ALLEY = ['hv', 'lv', 'tel'], LOW = ['lv', 'tel'], FAR = ['hv', 'lv', 'tel1'];
  chain(['W0', 'W1', 'W2', 'W3', 'W4', 'XS0'], MAIN);
  chain(['E0', 'E1', 'E2', 'E3', 'XS1'], MAIN);
  chain(['S-26', 'S-52', 'S-78', 'XW1'], MAIN);
  chain(['S22', 'S46', 'S72', 'XE1'], MAIN);
  link('XW1', 'FW1', FAR); link('XE1', 'FE1', FAR);
  chain(FZ.map((_, i) => 'FW' + i), FAR); chain(FZ.map((_, i) => 'FE' + i), FAR);
  link('K0', 'K1', ['telHigh'], true);          // the one span crossing the rail corridor: telecom only, y >= 9
  chain(['K1', 'K2'], MAIN);
  chain(['XN1', 'XN0', 'N0', 'N1', 'N2', 'N3', 'N4', 'N5', 'XN2', 'XN3'], LOW);   // along the tracks: wires < 7 m
  chain(['XA1', 'XA0', 'A0', 'A1', 'A2', 'A3', 'A4', 'XA2', 'XA3'], ALLEY);
  link('W0', 'S-26', ['hv', 'lv', 'tel']);       // junction pole at the station-front crossroads
  link('W0', 'S22', ['hv', 'lv', 'tel']);
  link('S-26', 'K0', ['hv', 'lv', 'tel1']);
  link('K1', 'N2', ['tel1']);
  link('K2', 'A1', ['hv', 'lv', 'tel']);
  // main street zigzag: LV + telecom criss-cross over the street (the iconic view from the hero camera)
  const ZZ = ['W0', 'E0', 'W1', 'E1', 'W2', 'E2', 'W3', 'E3', 'W4'];
  for (let i = 0; i + 1 < ZZ.length; i++) link(ZZ[i], ZZ[i + 1], i < 2 ? ['lv', 'tel2'] : ['lv2', 'tel1']);

  // ================================================================ 3. frames (local +X = run direction, +Z = road side)
  const unit2 = (x, z) => { const l = Math.hypot(x, z) || 1; return [x / l, z / l]; };
  const toLocal = (p, x, z) => { const c = Math.cos(p.rotY), s = Math.sin(p.rotY); return [x * c - z * s, x * s + z * c]; };
  for (const p of poles) {
    let rd = null;
    for (const s of SP) {
      if (!s.run || (s.A !== p && s.B !== p)) continue;
      const o = s.A === p ? s.B : s.A; let d = unit2(o.x - p.x, o.z - p.z);
      if (!rd) rd = d; else { if (d[0] * rd[0] + d[1] * rd[1] < 0) d = [-d[0], -d[1]]; rd = [rd[0] + d[0], rd[1] + d[1]]; }
    }
    if (!rd) { const s = SP.find(s => s.A === p || s.B === p); const o = s ? (s.A === p ? s.B : s.A) : { x: p.x, z: p.z - 1 }; rd = [o.x - p.x, o.z - p.z]; }
    rd = unit2(rd[0], rd[1]);
    let zx = p.road[0], zz = p.road[1]; const dt = zx * rd[0] + zz * rd[1]; zx -= dt * rd[0]; zz -= dt * rd[1];
    if (Math.hypot(zx, zz) < 0.2) { zx = -rd[1]; zz = rd[0]; }
    [zx, zz] = unit2(zx, zz);
    p.rotY = Math.atan2(zx, zz);
    p.hs = heights(p);
    // HV arms
    p.arms = [];
    if (p.hs.arm != null) {
      const hv = [];
      for (const s of SP) if (s.tiers.includes('hv') && (s.A === p || s.B === p)) { const o = s.A === p ? s.B : s.A; const d = toLocal(p, o.x - p.x, o.z - p.z); hv.push({ psi: Math.atan2(d[0], d[1]), run: s.run }); }
      if (hv.length) {
        p.arms.push({ psi: hv.some(h => h.run) ? HALF : hv[0].psi });
        for (const h of hv) if (p.arms.length < 2 && !p.arms.some(a => Math.abs(Math.cos(h.psi - a.psi)) > Math.cos(35 * Math.PI / 180))) p.arms.push({ psi: h.psi });
      }
    }
  }
  function heights(p) {
    const H = p.H;
    if (p.cls === 'low') return { arm: null, lv: [6.9, 6.6, 6.3], light: 5.55, tel: [5.15, 4.9] };
    if (p.cls === 'alley') return { arm: H - 0.4, lv: [7.2, 6.9, 6.6], light: 5.85, tel: [5.3, 5.02] };
    return { arm: H - 0.4, lv: [H - 3.4, H - 3.7, H - 4.0], light: H >= 12 ? 6.5 : 6.3, tel: [5.95, 5.65, 5.38] };
  }

  // ================================================================ 4. atlases & materials
  const plates = [], telPlates = [];
  for (const p of poles) if (p.detail === 'full') { p.plateIdx = plates.length; plates.push({ line: p.plate.line, num: p.plate.num, sub: R() < 0.4 ? (R() < 0.5 ? '左' : '右') + (1 + (R() * 3 | 0)) : '' }); }
  for (let i = 0; i < 15; i++) telPlates.push({ line: ['桜ヶ丘', '駅前', '北町', '東町', '川原'][i % 5], num: String(101 + i * 7) });
  const atlas = makeAtlases(ctx, { plates, telPlates });
  const mA = mat.toon('#ffffff', { map: atlas.A, vertexColors: true, paint: 0.05 });
  const mB = mat.toon('#ffffff', { map: atlas.B, vertexColors: true, alphaTest: 0.5, paint: 0.02, polygonOffset: -1 });
  const mL = mat.emissive('#e9ece8', 0.92);

  // ================================================================ 5. kit
  function kit(acc) {
    const q = new THREE.Quaternion(), e = new THREE.Euler(), s = new V3(), pv = new V3(), d = new V3();
    const arr = (v) => (Array.isArray(v) ? v : [v.x, v.y, v.z]);
    const M = (pos, rot, scl) => {
      e.set(rot ? rot[0] : 0, rot ? rot[1] : 0, rot ? rot[2] : 0, (rot && rot[3]) || 'XYZ'); q.setFromEuler(e);
      pos = arr(pos);
      return new THREE.Matrix4().compose(pv.set(pos[0], pos[1], pos[2]), q, scl ? s.set(scl[0], scl[1], scl[2]) : s.set(1, 1, 1));
    };
    const rodM = (p0, p1, sx, sz) => {
      p0 = arr(p0); p1 = arr(p1); d.set(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]); const len = d.length() || 1e-4;
      q.setFromUnitVectors(UP, d.multiplyScalar(1 / len));
      return new THREE.Matrix4().compose(pv.set((p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2, (p0[2] + p1[2]) / 2), q, s.set(sx, len, sz));
    };
    return {
      M, acc,
      geo: (g, m, col, uv) => acc.add(g, m || new THREE.Matrix4(), col, uv),
      box: (w, h, dd, pos, col, rot) => acc.add(G.box(), M(pos, rot, [w, h, dd]), col),
      cyl: (r, h, pos, col, seg = 8, rot) => acc.add(G.cyl(seg), M(pos, rot, [r * 2, h, r * 2]), col),
      cylO: (r, h, pos, col, seg = 8, rot) => acc.add(G.cylO(seg), M(pos, rot, [r * 2, h, r * 2]), col),
      sph: (r, pos, col, seg = 8, scl = [1, 1, 1], rot) => acc.add(G.sph(seg), M(pos, rot, [r * 2 * scl[0], r * 2 * scl[1], r * 2 * scl[2]]), col),
      lathe: (n, pos, col, sc = 1, rot, seg = 10) => acc.add(G.lathe(n, seg), M(pos, rot, [sc, sc, sc]), col),
      rodC: (p0, p1, r, col, seg = 6) => acc.add(G.cyl(seg), rodM(p0, p1, r * 2, r * 2), col),
      rodB: (p0, p1, w, t, col) => acc.add(G.box(), rodM(p0, p1, w, t), col),
    };
  }

  // ================================================================ 6. pole geometry
  const faceL = (p, s) => (typeof s === 'number' ? s : s === 'road' ? 0 : s === 'lot' ? Math.PI : COMPASS[s] - p.rotY);
  for (const p of poles) buildPole(p);

  function buildPole(p) {
    const H = p.H, far = p.detail === 'far', f = p.f, hs = p.hs;
    const rTop = far ? 0.12 : 0.11;
    const rAt = (h) => rTop + (H - h) / 150;
    p.rAt = rAt;
    const poleM = new THREE.Matrix4().compose(new V3(p.x, p.y, p.z), new THREE.Quaternion().setFromAxisAngle(UP, p.rotY), new V3(1, 1, 1));
    p.M = poleM;
    const A = new Acc(WHITE_UV), B = new Acc(WHITE_UV), Lm = new Acc(WHITE_UV), Wd = new Acc(WHITE_UV);
    A.T.copy(poleM); B.T.copy(poleM); Lm.T.copy(poleM);
    p.acc = { A, B, L: Lm, W: Wd };
    const a = kit(A), b = kit(B), l = kit(Lm);
    p.kW = kit(Wd);
    const W = (x, y, z) => new V3(x, y, z).applyMatrix4(poleM);
    const at = (phi, rad, y) => [Math.sin(phi) * rad, y, Math.cos(phi) * rad];
    const seg = far ? 10 : 16;
    const busy = [];
    const isBusy = (y, phi) => busy.some(bz => y >= bz.y0 && y <= bz.y1 && (bz.face == null || angd(phi, bz.face) < (bz.w || 0.7)));
    const band = (y, extra = 0.006, h = 0.03, col = COL.steel) => a.cylO(rAt(y) + extra, h, [0, y, 0], col, seg);

    // --- shaft + cap
    a.geo(new THREE.CylinderGeometry(rTop, rAt(-0.3), H + 0.3, seg, 1, true), a.M([0, (H - 0.3) / 2, 0]), null, UV.shaft);
    a.sph(rTop + 0.012, [0, H, 0], COL.cap, 10, [1, 0.5, 1]);
    a.cylO(rTop + 0.014, 0.05, [0, H - 0.025, 0], COL.cap, seg);
    if (p.gw && !far) { a.cyl(0.013, 0.17, [0, H + 0.1, 0], COL.steel, 6); a.sph(0.02, [0, H + 0.19, 0], COL.steel, 6); p.gwPt = W(0, H + 0.17, 0); }

    // --- base: yellow guard + black/yellow reflective sleeve (tiger stripes)
    const kind = far ? (R() < 0.5 ? 'tiger' : 'none') : p.cls === 'alley' ? 'tiger' : 'both';
    p.hasCover = kind === 'both'; p.hasTiger = kind !== 'none';
    if (p.hasCover) {
      a.geo(new THREE.CylinderGeometry(rAt(0.78) + 0.02, rAt(-0.02) + 0.024, 0.8, seg, 1, true), a.M([0, 0.38, 0]), null, UV.cover);
      a.cyl(rAt(0.78) + 0.026, 0.035, [0, 0.785, 0], COL.yellowDark, seg);
    }
    if (p.hasTiger) {
      const y0 = p.hasCover ? 0.8 : 0.25, y1 = 1.95;
      a.geo(new THREE.CylinderGeometry(rAt(y1) + 0.008, rAt(y0) + 0.008, y1 - y0, seg, 1, true), a.M([0, (y0 + y1) / 2, 0]), null, UV.sleeve);
    }

    // --- number plate (road face) + telecom plate (lot face) + ad + stickers
    if (!far) {
      const hc = 2.17, rr = rAt(hc);
      a.box(0.116, 0.346, 0.008, at(0, rr + 0.004, hc), COL.steelLight);
      b.geo(G.plane(), b.M(at(0, rr + 0.0088, hc), null, [0.108, 0.336, 1]), null, uvOf(plateRect(p.plateIdx)));
      band(hc + 0.19, 0.012, 0.022, COL.steelDark); band(hc - 0.19, 0.012, 0.022, COL.steelDark);
      busy.push({ y0: 1.95, y1: 2.42, face: 0 });
      const ti = (p.plateIdx * 7) % 15, tc = 2.12, tr_ = rAt(tc);
      a.box(0.076, 0.19, 0.006, at(Math.PI, tr_ + 0.003, tc), COL.steelLight, [0, Math.PI, 0]);
      a.geo(G.plane(), a.M(at(Math.PI, tr_ + 0.0082, tc), [0, Math.PI, 0], [0.07, 0.176, 1]), null, uvOf(telPlateRect(ti)));
      busy.push({ y0: 1.95, y1: 2.3, face: Math.PI });
    }
    if (!far && f.ad) {
      const phi = faceL(p, f.ad[1]), y0 = 2.06, y1 = 3.42, r0 = rAt(y0) + 0.007, r1 = rAt(y1) + 0.007, tl = 0.28 / ((r0 + r1) / 2);
      a.geo(new THREE.CylinderGeometry(r1, r0, y1 - y0, 8, 1, true, phi - tl / 2, tl), a.M([0, (y0 + y1) / 2, 0]), null, uvOf(adRect(f.ad[0])));
      for (const yb of [y0 - 0.018, y1 + 0.018]) { const rb = rAt(yb) + 0.01; a.geo(new THREE.CylinderGeometry(rb, rb, 0.024, 10, 1, true, phi - tl / 2 - 0.3, tl + 0.6), a.M([0, yb, 0]), COL.steelDark); }
      busy.push({ y0: y0 - 0.06, y1: y1 + 0.06, face: phi, w: tl / 2 + 0.35 });
    }
    if (!far) for (const [key, face, yc] of f.st || []) {
      const phi = faceL(p, face) + (R() - 0.5) * 0.25, [sw, sh] = STK[key];
      const off = p.hasCover && yc < 0.8 ? 0.028 : p.hasTiger && yc > 0.25 && yc < 1.95 ? 0.013 : 0.004;
      const rr = rAt(yc) + off, tl = sw / rr;
      b.geo(new THREE.CylinderGeometry(rr, rr, sh, 5, 1, true, phi - tl / 2, tl), b.M([0, yc, 0]), null, uvOf(RB[key]));
    }

    // --- HV crossarms with pin insulators
    for (let ai = 0; ai < p.arms.length; ai++) {
      const arm = p.arms[ai], y = hs.arm - ai * 0.75, beta = arm.psi - HALF;
      const sub = new THREE.Matrix4().makeRotationY(beta);
      const sa = (x, yy, z) => { const v = new V3(x, yy, z).applyMatrix4(sub); return [v.x, v.y, v.z]; };
      const side = ai ? 1 : -1, xa = side * (rAt(y) + 0.045);
      a.box(0.085, 0.085, far ? 1.7 : 1.8, sa(xa, y, 0), COL.steel, [0, beta, 0]);
      band(y, 0.01, 0.07, COL.steelDark);
      a.rodC(sa(side * (rAt(y) - 0.02), y, 0), sa(xa + side * 0.05, y, 0), 0.016, COL.steelDark, 6);   // through bolt
      if (!far) {
        for (const zz of [-0.56, 0.56]) a.rodB(sa(side * (rAt(y - 0.5) + 0.01), y - 0.5, 0), sa(xa, y - 0.045, zz), 0.03, 0.012, COL.steel);
        band(y - 0.5, 0.008, 0.04);
      }
      arm.pts = []; arm.y = y;
      for (const o of [-0.78, 0.33, 0.78]) {
        if (far) { a.cyl(0.034, 0.12, sa(xa, y + 0.1, o), COL.porcelain, 6); a.cyl(0.062, 0.02, sa(xa, y + 0.1, o), COL.porcelain, 8); }
        else { a.cyl(0.012, 0.05, sa(xa, y + 0.065, o), COL.steelDark, 6); a.lathe('pin', sa(xa, y + 0.07, o), COL.porcelain, 1, [0, beta, 0], 8); }
        arm.pts.push(W(...sa(xa, y + 0.2, o)));
      }
      busy.push({ y0: y - 0.62, y1: H + 0.3, face: null });
    }
    if (p.arms.length) p.hvAt = (dW) => {
      const dl = toLocal(p, dW.x, dW.z), psi = Math.atan2(dl[0], dl[1]);
      let best = p.arms[0], bc = -1;
      for (const arm of p.arms) { const c = Math.abs(Math.cos(psi - arm.psi)); if (c > bc) { bc = c; best = arm; } }
      return best.pts.slice().sort((u, v) => (dW.x * (u.z - p.z) - dW.z * (u.x - p.x)) - (dW.x * (v.z - p.z) - dW.z * (v.x - p.x)));
    };

    // --- pole transformer(s) + cut-out switches, or a sectionalizing switch
    const shift = p.arms.length > 1 ? 0.45 : 0;
    if (f.tr && hs.arm != null) {
      const trTop = hs.arm - 1.75 - shift, trBot = trTop - 0.75, cy = trTop - 0.375;
      const sides = f.tr === 2 ? [1, -1] : [1];
      const cans = [];
      for (const s of sides) {
        const r0 = rAt(cy), cx = s * (r0 + 0.3), cs = far ? 10 : 16;
        for (const yy of [trTop - 0.08, trBot + 0.12]) { a.box(0.34, 0.05, 0.05, [s * (r0 + 0.15), yy, 0], COL.steelDark); band(yy, 0.01, 0.05, COL.steelDark); }
        a.box(0.03, 0.8, 0.12, [s * (r0 + 0.075), cy, 0], COL.steelDark);
        a.geo(new THREE.CylinderGeometry(0.22, 0.22, 0.75, cs, 1, true, -Math.PI, TAU), a.M([cx, cy, 0]), null, UV.trans);
        a.cyl(0.214, 0.03, [cx, trBot - 0.008, 0], COL.transDark, cs);
        a.cyl(0.236, 0.036, [cx, trTop + 0.012, 0], COL.trans, cs);
        a.sph(0.226, [cx, trTop + 0.028, 0], COL.trans, far ? 8 : 12, [1, 0.22, 1]);
        if (!far) for (const yy of [cy + 0.2, cy - 0.22]) a.cylO(0.226, 0.022, [cx, yy, 0], COL.transDark, cs);
        const hvB = [], lvB = [];
        for (const dz of [-0.09, 0.09]) {
          if (far) a.cyl(0.025, 0.09, [cx, trTop + 0.09, dz], COL.porcelainGrey, 6); else a.lathe('bush', [cx, trTop + 0.04, dz], COL.porcelainGrey, 0.9, null, 8);
          hvB.push(W(cx, trTop + 0.14, dz));
        }
        for (const dx of [-0.08, 0, 0.08]) { a.rodC([cx + dx, cy + 0.2, 0.2], [cx + dx, cy + 0.2, 0.29], 0.018, COL.black, 6); lvB.push(W(cx + dx, cy + 0.2, 0.295)); }
        cans.push({ hvB, lvB });
      }
      const ycut = hs.arm - 1.1 - shift, r1 = rAt(ycut), xc = r1 + 0.035;
      a.box(0.065, 0.065, 1.12, [xc, ycut, 0], COL.steel); band(ycut, 0.01, 0.05);
      const cutTop = [], cutBot = [];
      for (const cz of far ? [-0.35, 0.35] : [-0.42, 0.02, 0.44]) {
        const yb = ycut - 0.2;
        a.box(0.1, 0.27, 0.11, [xc, yb, cz], COL.cutout);
        a.box(0.11, 0.035, 0.12, [xc, yb + 0.1, cz], COL.porcelainGrey);
        if (!far) { a.box(0.03, 0.15, 0.028, [xc + 0.065, yb - 0.02, cz], COL.steelDark); a.cyl(0.012, 0.05, [xc, yb + 0.16, cz], COL.steelDark, 6); a.cyl(0.012, 0.05, [xc, yb - 0.16, cz], COL.steelDark, 6); }
        cutTop.push(W(xc, yb + 0.185, cz)); cutBot.push(W(xc, yb - 0.185, cz));
      }
      p.trInfo = { cans, cutTop, cutBot };
      busy.push({ y0: trBot - 0.15, y1: ycut + 0.1, face: null });
      if (!far) { // earth wire + grey conduit down the pole
        const phi = Math.PI - 0.55;
        a.rodC(at(phi, rAt(trBot) + 0.014, trBot + 0.1), at(phi, rAt(2.45) + 0.03, 2.45), 0.008, COL.black, 4);
        a.box(0.05, 1.7, 0.03, at(phi, rAt(1.6) + 0.036, 1.6), COL.conduit, [0, phi, 0]);
      }
    }
    if (f.sw && hs.arm != null) {
      const ysw = hs.arm - 1.35, s = -1, r0 = rAt(ysw), bx = s * (r0 + 0.3);
      a.box(0.06, 0.06, 0.5, [s * (r0 + 0.03), ysw + 0.3, 0], COL.steelDark); band(ysw + 0.3, 0.01, 0.05, COL.steelDark);
      a.box(0.03, 0.3, 0.3, [s * (r0 + 0.07), ysw + 0.1, 0], COL.steelDark);
      a.box(0.46, 0.4, 0.34, [bx, ysw, 0], COL.boxGrey);
      a.box(0.5, 0.04, 0.38, [bx, ysw + 0.215, 0], COL.boxGreyDark);
      const bushPts = [];
      for (const dz of [-0.11, 0, 0.11]) for (const dx of [-0.13, 0.13]) { a.lathe('bush', [bx + dx, ysw + 0.23, dz], COL.porcelainGrey, 0.8, null, 8); bushPts.push(W(bx + dx, ysw + 0.31, dz)); }
      a.rodC([bx + s * 0.24, ysw - 0.02, 0.1], [bx + s * 0.3, ysw - 0.35, 0.24], 0.012, COL.steelDark);
      a.box(0.1, 0.06, 0.02, [bx, ysw - 0.02, 0.175], COL.signBack);
      p.swInfo = { bushPts };
      busy.push({ y0: ysw - 0.45, y1: ysw + 0.4, face: null });
    }

    // --- low-voltage rack with spool insulators (road face)
    p.lvPts = [];
    {
      const lv = hs.lv, top = lv[0] + 0.1, bot = lv[lv.length - 1] - 0.1, rm = rAt((top + bot) / 2);
      band(top, 0.008, 0.04); band(bot, 0.008, 0.04);
      a.box(0.03, 0.03, 0.13, at(0, rm + 0.055, top), COL.steelDark); a.box(0.03, 0.03, 0.13, at(0, rm + 0.055, bot), COL.steelDark);
      a.box(0.05, top - bot + 0.05, 0.014, at(0, rm + 0.115, (top + bot) / 2), COL.steel);
      for (const y of lv) {
        if (!far) { a.box(0.06, 0.008, 0.1, at(0, rm + 0.165, y + 0.045), COL.steel); a.box(0.06, 0.008, 0.1, at(0, rm + 0.165, y - 0.045), COL.steel); a.lathe('spool', at(0, rm + 0.18, y - 0.038), COL.porcelain, 1, null, 6); }
        else a.cyl(0.036, 0.07, at(0, rm + 0.18, y), COL.porcelain, 6);
        p.lvPts.push(W(...at(0, rm + 0.215, y)));
      }
      busy.push({ y0: bot - 0.12, y1: top + 0.12, face: 0, w: 1.0 });
      // service-drop spool on the side (+X) so drops to either side never clip the shaft
      const yd = bot - 0.2, rd = rAt(yd);
      band(yd, 0.008, 0.035); a.box(0.13, 0.025, 0.025, [rd + 0.06, yd, 0], COL.steelDark);
      if (!far) a.lathe('spool', [rd + 0.14, yd - 0.035, 0], COL.porcelain, 0.85, null, 6);
      p.lvDrop = W(rd + 0.17, yd, 0);
      p.lvDropJ = [p.lvPts[p.lvPts.length - 1], W(rd + 0.16, yd + 0.12, rd + 0.1), p.lvDrop];
      busy.push({ y0: yd - 0.1, y1: yd + 0.1, face: HALF, w: 0.8 });
    }

    // --- LED street light on a side bracket, facing the road
    p.light = far ? R() < 0.4 : true;
    if (p.light) {
      const y = hs.light, r0 = rAt(y);
      band(y, 0.01, 0.05); band(y + 0.17, 0.01, 0.05);
      a.box(0.075, 0.26, 0.03, at(0, r0 + 0.012, y + 0.085), COL.lampArm);
      const curve = new THREE.QuadraticBezierCurve3(new V3(0, y + 0.06, r0 + 0.02), new V3(0, y + 0.1, r0 + 0.62), new V3(0, y + 0.33, r0 + 1.02));
      a.geo(new THREE.TubeGeometry(curve, far ? 5 : 10, 0.026, 6, false), null, COL.lampArm);
      const hz = r0 + 1.25, hy = y + 0.37;
      a.cyl(0.034, 0.07, [0, y + 0.34, r0 + 1.03], COL.lampArm, 8, [HALF, 0, 0]);
      a.sph(0.5, [0, hy, hz], COL.lampHousing, far ? 8 : 12, [0.27, 0.11, 0.56], [-0.08, 0, 0]);
      l.sph(0.5, [0, hy - 0.036, hz + 0.004], null, far ? 8 : 10, [0.22, 0.07, 0.48], [-0.08, 0, 0]);
      if (!far) a.cyl(0.018, 0.035, [0, hy + 0.065, hz - 0.14], COL.lampHousing, 8);
      p.lampFeed = W(0, y + 0.1, r0 + 0.035);
      busy.push({ y0: y - 0.12, y1: y + 0.45, face: 0, w: 0.9 });
    }

    // --- telecom: suspension clamps, drop terminal, slack loop; optional high crossing bracket
    p.telPts = [];
    const telN = far ? 1 : hs.tel.length;
    hs.tel.slice(0, telN).forEach((y, k) => {
      const r0 = rAt(y), off = 0.14 + 0.08 * k;
      band(y, 0.008, 0.035, COL.steelDark);
      a.box(0.025, 0.025, off, at(0, r0 + off / 2, y), COL.steelDark);
      a.box(0.05, 0.055, 0.065, at(0, r0 + off, y - 0.02), COL.black);
      p.telPts.push(W(...at(0, r0 + off, y - 0.055)));
    });
    const tLow = hs.tel[telN - 1];
    if (!far) {
      const yT = tLow - 0.45, r0 = rAt(yT);
      band(yT + 0.1, 0.008, 0.03, COL.steelDark);
      a.box(0.09, 0.22, 0.13, [r0 + 0.055, yT, 0], COL.termBox);
      a.box(0.1, 0.03, 0.14, [r0 + 0.055, yT + 0.125, 0], COL.termBoxDark);
      a.box(0.004, 0.05, 0.07, [r0 + 0.101, yT + 0.03, 0], COL.porcelain);
      p.telDrop = W(r0 + 0.07, yT - 0.12, 0);
      if (R() < 0.5) a.geo(G.torus(), a.M([R() < 0.5 ? 0.42 : -0.42, hs.tel[0] - 0.4, r0 + 0.17]), COL.telCable);
      busy.push({ y0: yT - 0.2, y1: hs.tel[0] + 0.1, face: 0, w: 1.3 }); busy.push({ y0: yT - 0.2, y1: yT + 0.2, face: HALF, w: 0.8 });
    } else p.telDrop = p.telPts[0];
    if (f.telHigh) {
      const y = H - 1.5, r0 = rAt(y);
      band(y, 0.01, 0.05, COL.steelDark);
      a.box(0.03, 0.03, 0.34, at(0, r0 + 0.17, y), COL.steelDark);
      a.rodC(at(0, r0 + 0.01, y - 0.32), at(0, r0 + 0.3, y - 0.02), 0.012, COL.steelDark);
      a.box(0.06, 0.06, 0.075, at(0, r0 + 0.34, y - 0.03), COL.black);
      p.telHighPt = W(...at(0, r0 + 0.34, y - 0.075));
      busy.push({ y0: y - 0.38, y1: y + 0.1, face: null });
    }

    // --- small security camera (near the station)
    if (f.cam && !far) {
      const phi = faceL(p, f.cam), y = 3.62, r0 = rAt(y), tilt = 0.22;
      band(y, 0.01, 0.05);
      a.box(0.07, 0.13, 0.02, at(phi, r0 + 0.01, y), COL.camera, [0, phi, 0]);
      a.rodC(at(phi, r0 + 0.015, y), at(phi, r0 + 0.2, y - 0.02), 0.018, COL.camera, 8);
      const cp = at(phi, r0 + 0.3, y - 0.07);
      const rot = [tilt, phi, 0, 'YXZ'];
      const off = (v) => { const w = new V3(...v).applyEuler(new THREE.Euler(tilt, phi, 0, 'YXZ')); return [cp[0] + w.x, cp[1] + w.y, cp[2] + w.z]; };
      a.geo(G.rbox(), a.M(cp, rot, [0.11, 0.11, 0.27]), COL.camera);
      a.box(0.14, 0.012, 0.31, off([0, 0.068, 0.03]), COL.camera, rot);
      a.cyl(0.04, 0.02, off([0, 0, 0.135]), COL.lens, 12, [HALF + tilt, phi, 0, 'YXZ']);
      a.cyl(0.006, 0.01, off([0.035, -0.035, 0.138]), C('#d9463b'), 6, [HALF + tilt, phi, 0, 'YXZ']);
      busy.push({ y0: y - 0.25, y1: y + 0.15, face: phi, w: 0.8 });
    }

    // --- pole-mounted signs (通学路, 桜ヶ丘駅→, 消火栓)
    if (!far) for (const [key, face, yc] of f.sign || []) {
      const phi = faceL(p, face), r0 = rAt(yc), [sw, sh] = SIGN[key], dd = r0 + 0.075;
      band(yc + sh * 0.28, 0.01, 0.03, COL.steelDark); band(yc - sh * 0.28, 0.01, 0.03, COL.steelDark);
      a.box(0.045, sh * 0.7, 0.07, at(phi, r0 + 0.035, yc), COL.steelDark, [0, phi, 0]);
      if (key === 'diamond') {
        const back = ctx.geo.extrude([[0, 0.5], [-0.5, 0], [0, -0.5], [0.5, 0]], 0.012);
        a.geo(back, a.M(at(phi, dd, yc), [0, phi, 0], [sw, sh, 1]), COL.signBack);
        b.geo(G.diamond(), b.M(at(phi, dd + 0.0075, yc), [0, phi, 0], [sw, sh, 1]), null, uvOf(RB.diamond));
      } else {
        a.box(sw, sh, 0.012, at(phi, dd, yc), COL.signBack, [0, phi, 0]);
        b.geo(G.plane(), b.M(at(phi, dd + 0.0075, yc), [0, phi, 0], [sw, sh, 1]), null, uvOf(RB[key]));
      }
      busy.push({ y0: yc - sh / 2 - 0.06, y1: yc + sh / 2 + 0.06, face: phi, w: 0.9 });
    }

    // --- step bolts (足場ボルト) on the two faces free of ads, "危険 のぼるな" plate below them
    if (!far) {
      const bf = f.ad ? faceL(p, f.ad[1]) + HALF : HALF;
      {
        const y = 2.26, r0 = rAt(y), phi = isBusy(y, bf) ? bf + Math.PI : bf;
        a.box(0.106, 0.14, 0.006, at(phi, r0 + 0.003, y), COL.steelLight, [0, phi, 0]);
        b.geo(G.plane(), b.M(at(phi, r0 + 0.0072, y), [0, phi, 0], [0.098, 0.13, 1]), null, uvOf(RB.noboruna));
      }
      let sgn = 0;
      for (let y = 2.55; y < H - 1.2; y += 0.45) {
        const phi = sgn ? bf + Math.PI : bf; sgn ^= 1;
        if (isBusy(y, phi)) continue;
        const r0 = rAt(y);
        a.box(0.02, 0.02, 0.2, at(phi, r0 + 0.09, y), COL.steelDark, [0, phi, 0]);
        a.box(0.02, 0.055, 0.02, at(phi, r0 + 0.18, y + 0.03), COL.steelDark, [0, phi, 0]);
      }
    }
  }

  // ================================================================ 7. wires
  const spans = [];
  const WS = {
    hv: { w: 0.02, c: '#565b64' }, gw: { w: 0.012, c: '#6d737b' }, lv: { w: 0.026, c: '#403c47' },
    tel: [{ w: 0.046, c: '#37343e' }, { w: 0.034, c: '#3d3a44' }, { w: 0.029, c: '#34313b' }],
    telHigh: { w: 0.038, c: '#37343e' }, dropP: { w: 0.017, c: '#433f4a' }, dropT: { w: 0.012, c: '#4f4b57' },
    jump: { w: 0.012, c: '#50545c' }, jumpLV: { w: 0.016, c: '#403c47' }, guy: { w: 0.014, c: '#7a8088' },
  };
  const addWire = (pts, st, kind) => { ctx.wires.add(pts, { width: st.w, color: st.c }); spans.push({ points: pts, kind }); };
  const hang = (pa, pb, sag, st, kind, n) => {
    const len = pa.distanceTo(pb);
    const pts = ctx.geo.catenary(pa, pb, Math.max(0.02, sag), n || Math.max(6, Math.min(24, Math.round(len / 1.3))));
    addWire(pts, st, kind); return pts;
  };
  const telSpans = [];
  for (const s of SP) {
    const A = s.A, B = s.B;
    const dW = new V3(B.x - A.x, 0, B.z - A.z); const Ls = dW.length(); dW.normalize();
    for (const t of s.tiers) {
      let pa = [], pb = [];
      if (t === 'hv') { pa = A.hvAt ? A.hvAt(dW) : []; pb = B.hvAt ? B.hvAt(dW) : []; }
      else if (t === 'gw') { pa = A.gwPt ? [A.gwPt] : []; pb = B.gwPt ? [B.gwPt] : []; }
      else if (t === 'lv' || t === 'lv2') { const n = t === 'lv' ? 3 : 2; pa = A.lvPts.slice(0, n); pb = B.lvPts.slice(0, n); }
      else if (t === 'tel' || t === 'tel2' || t === 'tel1') { const n = t === 'tel' ? 4 : t === 'tel2' ? 2 : 1; pa = A.telPts.slice(0, n); pb = B.telPts.slice(0, n); }
      else if (t === 'telHigh') { pa = A.telHighPt ? [A.telHighPt] : []; pb = B.telHighPt ? [B.telHighPt] : []; }
      const n = Math.min(pa.length, pb.length);
      for (let i = 0; i < n; i++) {
        const jit = 0.9 + R() * 0.2;
        if (t === 'hv') hang(pa[i], pb[i], (0.011 * Ls + 0.12) * jit, WS.hv, 'hv');
        else if (t === 'gw') hang(pa[i], pb[i], (0.009 * Ls + 0.06) * jit, WS.gw, 'gw');
        else if (t[0] === 'l') hang(pa[i], pb[i], (0.016 * Ls + 0.15) * jit * (1 + i * 0.05), WS.lv, 'lv');
        else if (t === 'telHigh') hang(pa[i], pb[i], 1.0, WS.telHigh, 'tel');
        else {
          const sag = (0.024 * Ls + 0.2) * jit * [1, 1.12, 0.94][i];
          const pts = hang(pa[i], pb[i], sag, WS.tel[i] || WS.tel[0], 'tel');
          if (i === 0) telSpans.push({ A, B, a: pa[i], b: pb[i], sag, pts, Ls });
        }
      }
    }
  }

  // jumpers on the poles (HV -> cut-outs -> transformer -> LV rack; switch bushings; lamp feed; drop spool)
  for (const p of poles) {
    const hv = p.arms[0]?.pts;
    if (p.trInfo && hv) {
      const { cans, cutTop, cutBot } = p.trInfo;
      cutTop.forEach((ct, i) => hang(hv[Math.min(i, hv.length - 1)], ct, 0.06, WS.jump, 'jump', 6));
      cutBot.forEach((cb, i) => { const can = cans[i % cans.length]; hang(cb, can.hvB[i % can.hvB.length], 0.1, WS.jump, 'jump', 6); });
      for (const can of cans) can.lvB.forEach((bp, i) => hang(bp, p.lvPts[i % p.lvPts.length], 0.14, WS.jumpLV, 'jump', 6));
    }
    if (p.swInfo && hv) p.swInfo.bushPts.forEach((bp, i) => hang(bp, hv[(i >> 1) % hv.length], 0.07, WS.jump, 'jump', 6));
    if (p.lampFeed) hang(p.lampFeed, p.lvPts[p.lvPts.length - 1], 0.04, WS.jump, 'jump', 5);
    if (p.lvDropJ) ctx.wires.add(ctx.geo.catenary(p.lvDropJ[0], p.lvDropJ[1], 0.03, 4).concat(ctx.geo.catenary(p.lvDropJ[1], p.lvDropJ[2], 0.03, 4).slice(1)), { width: WS.jumpLV.w, color: WS.jumpLV.c });
  }

  // telecom closures (クロージャー) hanging on the cables near the poles
  for (const ts of telSpans) {
    if (ts.Ls < 10) continue;
    for (const [t, pr] of [[0.1 + R() * 0.07, ts.A], [0.9 - R() * 0.07, ts.B]]) {
      if (pr.detail === 'far' || R() > 0.55) continue;
      const P = new V3().lerpVectors(ts.a, ts.b, t); P.y -= ts.sag * 4 * t * (1 - t);
      const T = new V3().subVectors(ts.b, ts.a); T.y -= ts.sag * 4 * (1 - 2 * t); T.normalize();
      closure(pr.kW, P, T);
    }
  }
  function closure(k, P, T) {
    const q = new THREE.Quaternion().setFromUnitVectors(UP, T);
    const len = 0.48 + R() * 0.28, r = 0.068 + R() * 0.022;
    const c = P.clone(); c.y -= r + 0.035;
    k.geo(G.cyl(8), new THREE.Matrix4().compose(c, q, new V3(2 * r, len, 2 * r)), COL.closure);
    for (const s of [-1, 1]) {
      const e = c.clone().addScaledVector(T, s * len / 2);
      k.geo(G.sph(8), new THREE.Matrix4().compose(e, q, new V3(2 * r * 0.96, 2 * r * 0.55, 2 * r * 0.96)), COL.closure);
      const g = c.clone().addScaledVector(T, s * (len / 2 + r * 0.25));
      k.geo(G.cyl(6), new THREE.Matrix4().compose(g, q, new V3(0.035, 0.05, 0.035)), COL.black);
    }
    for (const s of [-0.3, 0.3]) {
      const e = c.clone().addScaledVector(T, s * len), top = P.clone().addScaledVector(T, s * len);
      k.rodC([e.x, e.y + r * 0.7, e.z], [top.x, top.y, top.z], 0.01, COL.black, 5);
    }
  }

  // ================================================================ 8. service drops (引込線) to facades
  // Drops are requested here and realised just before the shared wire mesh is generated, i.e. after every
  // module has been built: each one is snapped onto the real facade found by a short ray cast into the lot
  // (houses sit 1.7–6 m behind the frontage). Nothing else in the scene -> contract point (lz -1.5, y +5.3).
  const brackets = (k, w, n, tel) => {
    const rot = Math.atan2(n.x, n.z);
    k.box(tel ? 0.05 : 0.07, tel ? 0.07 : 0.12, 0.018, [w.x + n.x * 0.009, w.y, w.z + n.z * 0.009], COL.steelDark, [0, rot, 0]);
    const tip = w.clone().addScaledVector(n, tel ? 0.07 : 0.1);
    k.rodC([w.x, w.y + 0.02, w.z], [tip.x, tip.y + 0.02, tip.z], 0.007, COL.steelDark, 5);
    if (!tel) k.lathe('spool', [tip.x, tip.y - 0.028, tip.z], COL.porcelain, 0.65, null, 6);
    else k.sph(0.016, [tip.x, tip.y + 0.01, tip.z], COL.black, 6);
    return new V3(tip.x, tip.y + (tel ? 0.012 : 0.004), tip.z);
  };
  const dropReqs = [];
  const mainPoles = poles.filter(p => p.run === 'R1W' || p.run === 'R1E');
  const LOT_DROPS = ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8', 'W9', 'W10', 'W11', 'W12', 'W13', 'E1', 'E2', 'E3', 'E4', 'E5', 'E7', 'E8', 'E9', 'E10', 'E11', 'E12', 'E13'];
  for (const id of LOT_DROPS) {
    const lot = L.lotById(id); if (!lot) continue;
    const fr = L.lotFrame(lot), c = Math.cos(fr.rotY), s = Math.sin(fr.rotY);
    let best = null;
    for (const p of mainPoles) {
      const dx = p.x - fr.x, dz = p.z - fr.z;
      const lx = clamp(dx * c - dz * s, -fr.w / 3, fr.w / 3);
      const wp = L.lotToWorld(lot, lx, -1.5);
      const same = (lot.side < 0) === (p.run === 'R1W');
      const d = Math.hypot(wp.x - p.x, wp.z - p.z) + (same ? 0 : 4);
      if (!best || d < best.d) best = { d, p, lx, wp };
    }
    if (!best || best.d > 26) continue;
    const o = L.lotToWorld(lot, best.lx, 0);
    const lxT = clamp(best.lx + (best.lx > 0 ? -0.5 : 0.5), -fr.w / 2 + 0.4, fr.w / 2 - 0.4);
    dropReqs.push({
      p: best.p, O: new V3(o.x, 0, o.z), n: new V3(s, 0, c), lat: new V3(c, 0, -s), maxD: 12, telShift: lxT - best.lx,
      def: new V3(best.wp.x, heightAt(best.wp.x, best.wp.z) + 5.3, best.wp.z), withTel: R() < 0.8,
    });
  }
  // residential blocks: points 1.5 m inside the front edges, [pole, x, z, nx, nz]
  const BLK = [
    ['S-52', -56, -7.3, 0, 1], ['S-52', -47, -7.3, 0, 1], ['S-26', -30, -7.3, 0, 1], ['S-26', -21.5, -7.3, 0, 1], ['S-78', -61, -7.3, 0, 1],
    ['K0', -17.0, -15.5, 1, 0], ['K0', -17.0, -24, 1, 0],
    ['S22', 29.5, -7.3, 0, 1], ['S46', 41, -7.3, 0, 1], ['S46', 51, -7.3, 0, 1], ['S72', 60, -7.3, 0, 1],
    ['N0', -81, -59.4, 0, 1], ['N0', -73, -59.4, 0, 1], ['N1', -52, -59.4, 0, 1], ['N1', -43, -59.4, 0, 1], ['N2', -25, -59.4, 0, 1], ['K1', -17.0, -63.5, 1, 0],
    ['N3', 13, -59.4, 0, 1], ['N3', 23, -59.4, 0, 1], ['N4', 43, -59.4, 0, 1], ['N4', 53, -59.4, 0, 1], ['N5', 73, -59.4, 0, 1], ['N5', 82, -59.4, 0, 1],
    ['A0', -66, -74.2, 0, 1], ['A0', -57, -74.2, 0, 1], ['A1', -36, -74.2, 0, 1], ['A1', -27, -74.2, 0, 1], ['K2', -17.0, -77, 1, 0],
    ['A2', -1, -74.2, 0, 1], ['A2', 9, -74.2, 0, 1], ['A3', 29, -74.2, 0, 1], ['A3', 39, -74.2, 0, 1], ['A4', 59, -74.2, 0, 1], ['A4', 69, -74.2, 0, 1],
    ['S-26', -24, 4.1, 0, -1], ['S-52', -49, 4.1, 0, -1], ['S22', 24.5, 4.1, 0, -1], ['S46', 47, 4.1, 0, -1],
  ];
  for (const [pid, x, z, nx, nz] of BLK) {
    const p = byId[pid]; if (!p) continue;
    dropReqs.push({
      p, O: new V3(x + nx * 1.5, 0, z + nz * 1.5), n: new V3(nx, 0, nz), lat: new V3(nz, 0, -nx), maxD: 10, telShift: 0.5,
      def: new V3(x, heightAt(x, z) + 5.3, z), withTel: R() < 0.55,
    });
  }
  const dropSag = (a, b) => 0.02 * a.distanceTo(b) + 0.08;
  const clearPath = (F, a, b, sag) => {
    const pts = ctx.geo.catenary(a, b, sag, 4);
    for (let i = 0; i + 1 < pts.length; i++) if (F.seg(pts[i], pts[i + 1])) return false;
    return true;
  };
    function findWall(F, d) {
    for (const hy of [5.3, 4.95, 4.6, 3.4, 3.0]) for (const sh of [0, 0.7, -0.7, 1.4, -1.4, 2.2, -2.2]) {
      const ox = d.O.x + d.lat.x * sh, oz = d.O.z + d.lat.z * sh, y = heightAt(ox, oz) + hy;
      const h = F.seg(new V3(ox + d.n.x * 0.5, y, oz + d.n.z * 0.5), new V3(ox - d.n.x * d.maxD, y, oz - d.n.z * d.maxD));
      if (!h || !h.solid) continue;
      const nh = new V3(h.normal.x, 0, h.normal.z); if (nh.length() < 0.85) continue; nh.normalize();
      if (nh.dot(d.n) < 0.5) continue;
      const tip = h.point.clone().addScaledVector(nh, 0.13);
      if (!clearPath(F, d.p.lvDrop, tip, dropSag(d.p.lvDrop, tip))) continue;
      return { wp: h.point, n: nh };
    }
    return null;
  }
  function realise(k, d, w, F) {
    const p = d.p, wp = w.wp, n = w.n;
    const tip = brackets(k, wp, n, false);
    hang(p.lvDrop, tip, dropSag(p.lvDrop, tip), WS.dropP, 'drop');
    const wl = wp.clone(); wl.y -= 0.38;       // service entrance lead into the wall (drip loop)
    ctx.wires.add(ctx.geo.catenary(tip, wl.addScaledVector(n, 0.012), 0.06, 5), { width: 0.014, color: WS.dropP.c });
    if (!d.withTel) return;
    const lat = new V3(-n.z, 0, n.x); if (lat.dot(d.lat) < 0) lat.negate();
    let wt = wp.clone().addScaledVector(lat, d.telShift); wt.y -= 0.5;
    let tn = n;
    if (F) {   // re-find the wall at the telecom bracket (the facade may step or end there)
      const h = F.seg(wt.clone().addScaledVector(n, 0.6), wt.clone().addScaledVector(n, -2.5));
      if (!h || !h.solid) return;
      tn = new V3(h.normal.x, 0, h.normal.z); if (tn.length() < 0.85) return; tn.normalize();
      if (tn.dot(n) < 0.7) return;
      wt = h.point;
      if (!clearPath(F, p.telDrop, wt.clone().addScaledVector(tn, 0.1), dropSag(p.telDrop, wt) + 0.02)) return;
    }
    const tt = brackets(k, wt, tn, true);
    hang(p.telDrop, tt, 0.025 * p.telDrop.distanceTo(tt) + 0.08, WS.dropT, 'drop');
  }
  function finalizeDrops() {
    const F = createFacadeFinder(ctx, { exclude: new Set([mA, mB, mL]) });
    let nMesh = 0; try { nMesh = F.collect(); } catch (e) { nMesh = 0; }
    const acc = new Acc(WHITE_UV), k = kit(acc), spans0 = spans.length, t0 = performance.now();
    let built = 0;
    for (const d of dropReqs) {
      let w = null;
      if (!nMesh) w = { wp: d.def, n: d.n };
      else if (performance.now() - t0 < 4000) { try { w = findWall(F, d); } catch (e) { w = null; } }
      if (!w) continue;
      realise(k, d, w, nMesh ? F : null); built++;
    }
    const g = acc.build();
    if (g) { const m = new THREE.Mesh(g, mA); m.castShadow = true; m.receiveShadow = true; m.name = 'pole-drops'; ctx.addStatic(m); }
    const sv = ctx.services.poles;
    if (sv) {
      for (const s of spans.slice(spans0)) sv.spans.push({ points: s.points, kind: s.kind });
      sv.drops = { requested: dropReqs.length, built, facadeMeshes: nMesh, ms: Math.round(performance.now() - t0) };
    }
  }
  {
    const W = ctx.wires, orig = W.build;
    W.build = function (...args) {
      W.build = orig;
      try { finalizeDrops(); } catch (e) { console.warn('[poles] service drops failed', e); }
      return orig.apply(this, args);
    };
  }

  // ================================================================ 9. guy wires (支線) with yellow guards
  function freeGround(x, z) {
    if (z > 0.5 && z < 131 && Math.abs(x - L.streetCenterX(z)) < 3.2) return false;
    if (Math.abs(x + 12) < 3.0 && z > -89 && z < -4) return false;
    if (Math.abs(z + 2) < 3.2 && Math.abs(x) < 96) return false;
    if (Math.abs(z + 55.5) < 2.2 && Math.abs(x) < 96) return false;
    if (Math.abs(z + 71) < 1.7 && Math.abs(x) < 86) return false;
    if (Math.abs(z + 93) < 1.8) return false;
    if (z < -33.5 && z > -52.5) return false;
    if (x > -9.6 && x < 26.4 && z > -25.4 && z < -4.7) return false;
    if (z > 1 && z < 129) {
      const dx = x - L.streetCenterX(z), d = Math.abs(dx);
      if (d > 4.65 && d < 19.2) return false;
      // keep shop / shrine frontages clear (entrances, boards, benches, flags)
      if (d > 3.0 && d < 5.2) { const lot = L.LOTS.find(l => l.side === Math.sign(dx) && z > l.z0 - 0.8 && z < l.z1 + 0.8 && l.owner !== 'houses'); if (lot) return false; }
    }
    for (const bl of L.BLOCKS) if (x > bl.x0 - 0.3 && x < bl.x1 + 0.3 && z > bl.z0 - 0.3 && z < bl.z1 + 0.3) return false;
    for (const v of L.VENDING) if (Math.hypot(x - v.x, z - v.z) < 1.6) return false;
    for (const b of L.SPOTS.konbiniBikes) if (Math.hypot(x - b.x, z - b.z) < 1.4) return false;
    return true;
  }
  const TW = { hv: 1, gw: 0.3, lv: 0.6, lv2: 0.45, tel: 0.6, tel2: 0.45, tel1: 0.3, telHigh: 0.4 };
  for (const p of poles) {
    let vx = 0, vz = 0;
    for (const s of SP) {
      if (s.A !== p && s.B !== p) continue;
      const o = s.A === p ? s.B : s.A; const [ux, uz] = unit2(o.x - p.x, o.z - p.z);
      const w = s.tiers.reduce((acc, t) => acc + (TW[t] || 0), 0);
      vx += ux * w; vz += uz * w;
    }
    if (Math.hypot(vx, vz) < 1.15) continue;
    const base = Math.atan2(-vx, -vz);
    for (const da of [0, 0.35, -0.35, 0.7, -0.7, 1.05, -1.05, 1.4, -1.4]) {
      const ang = base + da, dx = Math.sin(ang), dz = Math.cos(ang), D = 0.3 * p.H;
      const ax = p.x + dx * D, az = p.z + dz * D;
      if (!freeGround(ax, az)) continue;
      buildGuy(p, dx, dz, ax, az); break;
    }
  }
  function buildGuy(p, dx, dz, ax, az) {
    const k = p.kW, ya = p.hs.lv[p.hs.lv.length - 1] - 0.55, ra = p.rAt(ya);
    k.geo(G.cylO(12), new THREE.Matrix4().compose(new V3(p.x, p.y + ya, p.z), new THREE.Quaternion(), new V3(2 * (ra + 0.01), 0.06, 2 * (ra + 0.01))), COL.steelDark);
    const top = new V3(p.x + dx * (ra + 0.03), p.y + ya, p.z + dz * (ra + 0.03));
    const ay = heightAt(ax, az), anc = new V3(ax, ay + 0.06, az);
    hang(top, anc, 0.02, WS.guy, 'guy', 8);
    const u = new V3().subVectors(top, anc).normalize();
    const g0 = anc.clone().addScaledVector(u, 0.12), g1 = anc.clone().addScaledVector(u, 2.0);
    if (p.detail === 'far') k.rodC(g0, g1, 0.04, COL.guard, 8);
    else {
      k.rodC(g0, g1, 0.04, COL.guard, 10);
      for (const t of [0.2, 0.5, 0.8]) { const m0 = new V3().lerpVectors(g0, g1, t - 0.04), m1 = new V3().lerpVectors(g0, g1, t + 0.04); k.rodC(m0, m1, 0.043, COL.guardBand, 10); }
      k.sph(0.045, g1, COL.guard, 8);
      physics(anc.x + u.x * 0.45, anc.z + u.z * 0.45, 0.12, ay - 0.5, ay + 1.8);
    }
    k.box(0.32, 0.12, 0.32, [ax, ay + 0.02, az], COL.anchor, [0, Math.atan2(dx, dz), 0]);
    k.rodC([ax, ay + 0.06, az], g0, 0.018, COL.steelDark, 6);
  }
  function physics(x, z, r, y0, y1) { ctx.physics.addCylinder(x, z, r, y0, y1); }

  // ================================================================ 10. meshes, colliders, services
  const root = new THREE.Group(); root.name = 'poles';
  for (const p of poles) {
    const put = (acc, m, shadow) => { const g = acc.build(); if (!g) return; const mesh = new THREE.Mesh(g, m); mesh.castShadow = shadow; mesh.receiveShadow = true; mesh.name = 'pole-' + p.id; root.add(mesh); };
    put(p.acc.A, mA, true); put(p.acc.W, mA, true); put(p.acc.B, mB, false); put(p.acc.L, mL, false);
    physics(p.x, p.z, p.rAt(0) + (p.hasCover ? 0.04 : 0.02), p.y - 1, p.y + p.H);
  }
  ctx.addStatic(root);
  ctx.services.poles = {
    poles: poles.map(p => ({ x: p.x, z: p.z, y: p.y, top: p.y + p.H, id: p.id })),
    spans: spans.filter(s => s.kind !== 'guy' && s.kind !== 'jump').map(s => ({ points: s.points, kind: s.kind })),
  };
}
