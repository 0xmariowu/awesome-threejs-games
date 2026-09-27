// One 18 m EMU car in its own frame: cab (if any) toward local +X, gangway end toward -X,
// left side = -Z. Everything goes into Buckets (vertex-coloured, merged later).
import * as THREE from 'three';
import { GEO, M, basis, rrectPts, shapeFrom, extrudeShape, shapeGeo, colorByNormal, rowsSurface, sweepX } from './builder.js';
import { person, pickLook } from './people.js';

export const HW = 1.40, YB = 1.02, YS = 3.40, YR = 3.80, FLOOR = 1.30, WALL_T = 0.08;
export const XE = -8.80, XS = 8.35;
const RH = YR - YS, PR = 3.2;
const Y_BAND0 = 1.78, Y_BAND1 = 2.02, Y_MINT0 = 2.05, Y_MINT1 = 2.09;
const DOOR_HW = 0.65, DOOR_TOP = 3.15, LEAF_W = 0.68;
export const DOORS = [-6, 0, 6];
const WIN_Y0 = 2.15, WIN_Y1 = 3.02;
const WINDOWS = [
  { x0: -8.55, x1: -7.45, pri: true },
  { x0: -4.60, x1: -3.10 }, { x0: -2.90, x1: -1.40 },
  { x0: 1.40, x1: 2.90 }, { x0: 3.10, x1: 4.60 },
];
const CREW = { x0: 7.36, x1: 7.92 }, CREW_WIN = { x0: 7.46, x1: 7.82, y0: 2.3, y1: 2.98 };
const CAB_WIN = { x0: 7.99, x1: 8.29, y0: 2.2, y1: 3.0 };
export const CAB_BACK = 7.02;
export const BOGIE_X = 6.1, WHEEL_R = 0.43, WHEELBASE = 2.1;

export const COL = {
  cream: '#f2ece0', pink: '#ee9dbb', mint: '#86cdbb', roof: '#b7bcc3', roofDark: '#9ca2aa', reveal: '#ddd6ca', mask: '#3b3a4c',
  metal: '#c6ccd3', metalDark: '#7e858e', under: '#595e67', bogie: '#50545c', rubber: '#3e3c47', spring: '#6e747d',
  wallIn: '#ece7dd', floor: '#a9a196', floorDoor: '#c3b8a2', ceiling: '#f0eee8', seat: '#c46a86', seatPri: '#5f80b2', seatBase: '#8f959c',
  partition: '#dfe2e4', yellow: '#f2c230', cabIn: '#5d6674', console: '#4b5463', leafIn: '#d8d6d0', ring: '#f1eee6', ringPri: '#f0a441',
};

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const se = (q, n) => Math.pow(Math.max(0, 1 - Math.pow(Math.min(1, Math.abs(q)), n)), 1 / n);
export const roofY = (z) => YS + RH * se(z / HW, PR);
export function roofNormal(z) {
  const q = Math.min(1, Math.abs(z) / HW), t = Math.max(0, (roofY(z) - YS) / RH);
  const gz = (PR / HW) * Math.pow(q, PR - 1) * Math.sign(z), gy = (PR / RH) * Math.pow(t, PR - 1);
  const l = Math.hypot(gz, gy) || 1; return [gz / l, gy / l];
}
function roofProfile(th0, th1, n) {
  const pts = [], nrm = [];
  for (let i = 0; i <= n; i++) {
    const th = th0 + (th1 - th0) * i / n;
    const c = Math.cos(th), s = Math.sin(th);
    const z = HW * Math.sign(c) * Math.pow(Math.abs(c), 2 / PR), y = YS + RH * Math.pow(Math.abs(s), 2 / PR);
    pts.push([z, y]); nrm.push(roofNormal(z === 0 ? 1e-6 : z));
  }
  return { pts, nrm };
}

// ------------------------------------------------------------------ nose surface (cab at +X)
const D0 = 0.45, BOW = 0.06, RV = 0.38, NPLAN = 4.2, RAKE = 0.30;
function noseDepth(u, y) {
  const q = Math.min(1, Math.abs(u));
  const plan = se(q, NPLAN);
  const ry = roofY(u * HW);
  const t = clamp((ry - y) / RV, 0, 1);
  const sv = Math.pow(Math.max(0, 1 - Math.pow(1 - t, 2.2)), 1 / 2.2);
  const k = clamp((y - 2.1) / (YR - 2.1), 0, 1);
  const rake = RAKE * Math.pow(k, 1.3);
  const kb = clamp((1.3 - y) / 0.28, 0, 1);
  const tuck = 0.06 * kb * kb;
  return (D0 - rake - tuck + BOW * (1 - q * q)) * plan * sv;
}
function nose(u, y) {
  const p = new THREE.Vector3(XS + noseDepth(u, y), y, u * HW);
  const e = 1e-3;
  const ua = Math.max(-1, u - e), ub = Math.min(1, u + e);
  const Xz = (noseDepth(ub, y) - noseDepth(ua, y)) / ((ub - ua) * HW);
  const Xy = (noseDepth(u, y + e) - noseDepth(u, y - e)) / (2 * e);
  const n = new THREE.Vector3(1, -Xy, -Xz);
  if (!Number.isFinite(n.lengthSq()) || n.lengthSq() < 1e-12) n.set(0, 0, Math.sign(u) || 1);
  n.normalize();
  return { p, n };
}
const U = []; for (let i = 0; i <= 32; i++) { const a = -1 + 2 * i / 32; U.push(Math.sin(a * Math.PI / 2)); }
function rowAt(y, uA, uB, extra = []) {
  const us = [uA, uB];
  for (const u of U.concat(extra)) if (u > uA + 0.005 && u < uB - 0.005) us.push(u);
  us.sort((a, b) => a - b);
  const out = []; for (const u of us) if (!out.length || u - out[out.length - 1][0] > 1e-5) out.push([u, y]);
  return out;
}
function rrHalf(y, hz, y0, y1, r) { const dy = Math.max(0, y0 + r - y, y - (y1 - r)); return hz - r + Math.sqrt(Math.max(0, r * r - dy * dy)); }
const MASK = { hz: 1.31, y0: 2.12, y1: 3.40, r: 0.26 }, GLS = { hz: 1.20, y0: 2.24, y1: 3.28, r: 0.16 };
const mU = (y) => rrHalf(y, MASK.hz, MASK.y0, MASK.y1, MASK.r) / HW;
const gU = (y) => rrHalf(y, GLS.hz, GLS.y0, GLS.y1, GLS.r) / HW;
function midLevels() {
  const s = new Set([MASK.y0, MASK.y1, GLS.y0, GLS.y1]);
  for (let i = 0; i <= 7; i++) {
    const c = 1 - Math.cos((i / 7) * Math.PI / 2);
    s.add(MASK.y0 + MASK.r * c); s.add(MASK.y1 - MASK.r * c); s.add(GLS.y0 + GLS.r * c); s.add(GLS.y1 - GLS.r * c);
  }
  for (let y = MASK.y0; y < MASK.y1; y += 0.12) s.add(y);
  const a = [...s].filter(y => y >= MASK.y0 - 1e-6 && y <= MASK.y1 + 1e-6).sort((p, q) => p - q);
  const out = []; for (const y of a) if (!out.length || y - out[out.length - 1] > 0.004) out.push(y); else if (y === MASK.y1 || y === GLS.y0 || y === GLS.y1) out[out.length - 1] = y;
  return out;
}

function buildNose(B, o) {
  const YM = midLevels();
  const between = (a, b) => YM.filter(y => y >= a - 1e-6 && y <= b + 1e-6);
  const patches = []; // {rows, col, key}
  const exB = [-mU(MASK.y0), mU(MASK.y0)];
  const bands = [
    { y: [YB, 1.05, 1.1, 1.17, 1.25, 1.35, 1.47, 1.6, 1.7, Y_BAND0], col: COL.cream },
    { y: [Y_BAND0, 1.86, 1.94, Y_BAND1], col: COL.pink },
    { y: [Y_BAND1, Y_MINT0], col: COL.cream },
    { y: [Y_MINT0, Y_MINT1], col: COL.mint },
    { y: [Y_MINT1, MASK.y0], col: COL.cream },
  ];
  for (const b of bands) patches.push({ rows: b.y.map(y => rowAt(y, -1, 1, exB)), col: b.col, noLining: true });
  patches.push({ rows: YM.map(y => rowAt(y, -1, -mU(y))), col: COL.cream });
  patches.push({ rows: YM.map(y => rowAt(y, mU(y), 1)), col: COL.cream });
  const exG0 = [-gU(GLS.y0), gU(GLS.y0)], exG1 = [-gU(GLS.y1), gU(GLS.y1)];
  patches.push({ rows: between(MASK.y0, GLS.y0).map(y => rowAt(y, -mU(y), mU(y), exG0)), col: COL.mask });
  patches.push({ rows: between(GLS.y1, MASK.y1).map(y => rowAt(y, -mU(y), mU(y), exG1)), col: COL.mask });
  patches.push({ rows: between(GLS.y0, GLS.y1).map(y => rowAt(y, -mU(y), -gU(y))), col: COL.mask });
  patches.push({ rows: between(GLS.y0, GLS.y1).map(y => rowAt(y, gU(y), mU(y))), col: COL.mask });
  // cap (top of the nose, curving into the roof)
  const S = [0, 0.1, 0.22, 0.36, 0.5, 0.64, 0.77, 0.88, 0.95, 1];
  const exC = [-mU(MASK.y1), mU(MASK.y1)];
  const capRows = S.map(s => rowAt(0, -1, 1, exC).map(([u]) => [u, MASK.y1 + s * (roofY(u * HW) - MASK.y1) - (s === 1 ? 1e-4 : 0)]));
  patches.push({ rows: capRows, col: COL.cream });
  for (const p of patches) {
    B.add('paint', rowsSurface(p.rows, nose, 0), null, p.col);
    if (!p.noLining) B.add('interior', rowsSurface(p.rows, nose, -0.02, true), null, COL.cabIn);
  }
  // glass
  B.add('glass', rowsSurface(between(GLS.y0, GLS.y1).map(y => rowAt(y, -gU(y), gU(y))), nose, -0.012), null, '#ffffff');

  B.tag = 'noseparts';
  const onFace = (u, y, off) => { const s = nose(u, y); return basis(s.p.clone().addScaledVector(s.n, off), s.n); };
  // light cases, headlights, taillights
  for (const sg of [-1, 1]) {
    // one rounded light case per side; lenses coplanar with its front face (local +x = toward -Z)
    B.push(onFace(sg * 0.682, 1.6, -0.014));
    B.rbox('matte', 0.54, 0.2, 0.07, 0.09, [0, 0, 0], '#4a4759');
    const hx = sg * 0.14, tx = -sg * 0.165;
    B.add(o.lit === 'head' ? 'head' : 'metal', GEO.circle(24), M([hx, 0, 0.037], null, [0.152, 0.152, 1]), o.lit === 'head' ? '#ffffff' : '#c9d3dc');
    B.add('metal', GEO.torus(0.079, 0.009, 4, 24), M([hx, 0, 0.036]), COL.metal);
    B.add(o.lit === 'tail' ? 'tail' : 'metal', GEO.circle(20), M([tx, 0, 0.037], null, [0.104, 0.104, 1]), o.lit === 'tail' ? '#ffffff' : '#c4505c');
    B.add('metal', GEO.torus(0.054, 0.007, 4, 20), M([tx, 0, 0.036]), COL.metal);
    B.pop();
  }
  // emblem on the band, car number below
  B.push(onFace(0, 1.905, 0.006)); B.decal('decal', 0.22, 0.22, o.uv.dec('emblem')); B.pop();
  B.push(onFace(0, 1.6, 0.006)); B.decal('decal', 0.3, 0.075, o.uv.dec(o.numFront)); B.pop();
  // destination + run number displays behind the glass (flat, facing +X)
  const glassX = (u0, u1, y) => Math.min(nose(u0, y).p.x, nose(u1, y).p.x, nose((u0 + u1) / 2, y).p.x) - 0.012;
  {
    const zc = 0.2, w = 1.28, h = 0.32, y = 3.1;
    const x = Math.min(glassX((zc - w / 2) / HW, (zc + w / 2) / HW, y + h / 2), glassX((zc - w / 2) / HW, (zc + w / 2) / HW, y - h / 2)) - 0.03;
    B.box('matte', 0.04, h + 0.06, w + 0.06, [x - 0.025, y, zc], '#2b2a33');
    B.push(M([x, y, zc], [0, Math.PI / 2, 0])); B.decal('led', w, h, o.uv.led(o.destKey)); B.pop();
    const z2 = -0.86, w2 = 0.34, h2 = 0.17;
    const x2 = glassX((z2 - w2 / 2) / HW, (z2 + w2 / 2) / HW, y) - 0.03;
    B.box('matte', 0.04, h2 + 0.05, w2 + 0.05, [x2 - 0.025, y, z2], '#2b2a33');
    B.push(M([x2, y, z2], [0, Math.PI / 2, 0])); B.decal('led', w2, h2, o.uv.led(o.runKey)); B.pop();
  }
  // wipers (parked along the bottom of the windscreen)
  for (const [u0, len] of [[-0.44, 0.47], [0.2, 0.47]]) {
    const a = nose(u0, 2.31), b = nose(u0 + len, 2.36);
    const pa = a.p.clone().addScaledVector(a.n, 0.024), pb = b.p.clone().addScaledVector(b.n, 0.024);
    B.rod('matte', pa.toArray(), pb.toArray(), 0.011, '#3c3f48', 6);
    const qa = a.p.clone().addScaledVector(a.n, 0.012).add(new THREE.Vector3(0, 0.012, 0)), qb = b.p.clone().addScaledVector(b.n, 0.012).add(new THREE.Vector3(0, 0.012, 0));
    B.rod('matte', qa.toArray(), qb.toArray(), 0.007, '#2f3038', 4);
    B.push(basis(a.p.clone().addScaledVector(a.n, 0.012), a.n)); B.cyl('metal', 0.028, 0.028, 0.03, [0, 0, 0], '#5c616a', [Math.PI / 2, 0, 0], 10); B.pop();
  }
  B.tag = 'skirt';
  // front skirt (排障器): curved plate under the nose with a coupler gap
  const skirtP = (u, y) => {
    const f = (uu, yy) => new THREE.Vector3(XS - 0.30 + 0.70 * se(uu, 2.6) + 0.06 * (1 - (yy - 0.36) / 0.64), yy, uu * 1.3);
    const p = f(u, y), e = 1e-3;
    const pu = f(Math.min(1, u + e), y).sub(f(Math.max(-1, u - e), y));
    const pv = f(u, y + e).sub(f(u, y - e));
    const n = new THREE.Vector3().crossVectors(pv, pu).normalize();
    if (n.x < 0) n.negate();
    return { p, n };
  };
  const SY = [0.36, 0.46, 0.58, 0.7, 0.82, 0.92, 1.0];
  const halves = [[-1, -0.2], [0.2, 1]];
  for (const [a, b] of halves) {
    const rows = SY.map(y => rowAt(y, a, b));
    B.add('metal', rowsSurface(rows, skirtP, 0), null, '#9ca2aa');
    B.add('matte', rowsSurface(rows, skirtP, -0.025, true), null, '#5a5f68');
  }
  {
    const rows = [0.36, 0.46, 0.56].map(y => rowAt(y, -0.2, 0.2));
    B.add('metal', rowsSurface(rows, skirtP, 0), null, '#9ca2aa');
    B.add('matte', rowsSurface(rows, skirtP, -0.025, true), null, '#5a5f68');
  }
  // skirt stiffener ribs
  for (const u of [-0.62, 0.62]) { const s = skirtP(u, 0.68); B.push(basis(s.p.clone().addScaledVector(s.n, -0.06), s.n)); B.box('matte', 0.05, 0.56, 0.1, [0, 0, 0], '#4a4e57'); B.pop(); }
  // coupler (密着連結器) + electric coupler + hoses
  B.box('metal', 0.62, 0.12, 0.14, [XS + 0.33, 0.86, 0], '#50555e');
  B.rbox('metal', 0.24, 0.26, 0.3, 0.03, [XS + 0.72, 0.86, 0], '#5a5f68');
  B.box('matte', 0.02, 0.18, 0.2, [XS + 0.845, 0.86, 0], '#3a3346');
  B.rbox('matte', 0.2, 0.14, 0.34, 0.03, [XS + 0.66, 0.66, 0], '#454952');
  for (const [z, c] of [[-0.3, '#d9463b'], [0.3, '#f2c230']]) {
    B.tube('matte', [[XS + 0.3, 0.8, z], [XS + 0.46, 0.66, z * 1.1], [XS + 0.52, 0.5, z * 1.15]], 0.025, '#2f3038', 10, 6);
    B.box('matte', 0.06, 0.03, 0.08, [XS + 0.28, 0.83, z], c);
  }
  B.tag = 'cab';
  // cab interior: raised floor, console, instrument panel, seat, partition, driver / conductor
  B.box('interior', XS + 0.25 - CAB_BACK, 0.2, 2.6, [(XS + 0.25 + CAB_BACK) / 2, FLOOR + 0.1, 0], '#555c69');
  B.box('interior', 0.5, 0.72, 2.46, [XS + 0.06, FLOOR + 0.2 + 0.36, 0], COL.console);
  B.push(M([XS + 0.02, 2.24, 0], [0, 0, 0.35]));
  B.box('interior', 0.36, 0.05, 2.3, [0, 0, 0], '#434b58');
  B.pop();
  {
    const s = basis(new THREE.Vector3(XS - 0.02, 2.29, -0.45), new THREE.Vector3(-0.35, 1, 0).normalize());
    B.push(s); B.decal('led', 0.34, 0.17, o.uv.led('cab')); B.pop();
    const s2 = basis(new THREE.Vector3(XS - 0.02, 2.29, 0.05), new THREE.Vector3(-0.35, 1, 0).normalize());
    B.push(s2); B.decal('led', 0.3, 0.15, o.uv.led('cab2')); B.pop();
  }
  B.box('metal', 0.08, 0.14, 0.05, [XS - 0.16, 2.34, -0.78], '#2f3038');
  B.cyl('metal', 0.018, 0.018, 0.22, [XS - 0.16, 2.44, -0.78], '#9aa1a8', [Math.PI / 2, 0, 0], 8);
  // driver's seat
  B.rbox('interior', 0.45, 0.1, 0.45, 0.04, [XS - 0.62, 1.95, -0.52], '#3f4758');
  B.rbox('interior', 0.08, 0.55, 0.45, 0.04, [XS - 0.88, 2.28, -0.52], '#3f4758', [0, 0, 0.12]);
  B.cyl('interior', 0.04, 0.04, 0.45, [XS - 0.62, 1.72, -0.52], '#2f3038', null, 8);
  if (o.crew === 'driver') person(B, 'interior', [XS - 0.6, 2.0, -0.52], Math.PI / 2, { pose: 'sit', outfit: 'staff', h: 1.7, hands: true, glove: '#f4f4f4', hair: '#3a3240' });
  else if (o.crew === 'conductor') person(B, 'interior', [XS - 0.45, FLOOR + 0.2, 0.62], Math.PI / 2 + 0.4, { pose: 'stand', outfit: 'staff', h: 1.66, hair: '#4a3a36' });
  // partition wall between cab and saloon (3 windows)
  {
    const pb = colorByNormal(GEO.box().clone().scale(0.05, YS + 0.18 - FLOOR, 2.62), (nx) => nx > 0.5 ? COL.cabIn : nx < -0.5 ? COL.partition : COL.partition);
    B.add('interior', pb, M([CAB_BACK, FLOOR + (YS + 0.18 - FLOOR) / 2, 0]), null);
    for (const [zc, w, y0, y1] of [[-0.8, 0.8, 2.3, 3.05], [0, 0.55, 1.5, 3.05], [0.8, 0.8, 2.3, 3.05]]) {
      for (const sx of [-1, 1]) B.box('interior', 0.006, y1 - y0, w, [CAB_BACK + sx * 0.028, (y0 + y1) / 2, zc], '#4e5a68');
    }
    B.push(M([CAB_BACK - 0.03, 3.2, 0], [0, -Math.PI / 2, 0])); B.decal('decal', 0.42, 0.105, o.uv.dec('crewSign')); B.pop();
  }
  // cab ceiling
  const cp = [[-1.32, 3.38], [-0.95, 3.6], [0.95, 3.6], [1.32, 3.38]], cn = [[0.51, -0.86], [0, -1], [0, -1], [-0.51, -0.86]];
  B.add('interior', sweepX(cp, cn, CAB_BACK, XS + 0.02), null, '#6a7280');
}

// ------------------------------------------------------------------ side wall pieces
function wallPieces(cab) {
  const out = [];
  const doorsDesc = DOORS.slice().sort((a, b) => b - a), doorsAsc = DOORS.slice().sort((a, b) => a - b);
  const x1 = cab ? XS : -XE;
  // lower (YB..Y_BAND0) with door notches from the top
  {
    const pts = [[XE, YB], [x1, YB], [x1, Y_BAND0]];
    for (const d of doorsDesc) pts.push([d + DOOR_HW, Y_BAND0], [d + DOOR_HW, FLOOR], [d - DOOR_HW, FLOOR], [d - DOOR_HW, Y_BAND0]);
    pts.push([XE, Y_BAND0]);
    out.push({ shape: shapeFrom(pts), col: COL.cream, rev: COL.reveal });
  }
  // band / gap / mint strips between doors
  const spans = []; let prev = XE;
  for (const d of doorsAsc) { spans.push([prev, d - DOOR_HW]); prev = d + DOOR_HW; }
  spans.push([prev, x1]);
  for (const [y0, y1, col] of [[Y_BAND0, Y_BAND1, COL.pink], [Y_BAND1, Y_MINT0, COL.cream], [Y_MINT0, Y_MINT1, COL.mint]]) {
    for (const [a, b] of spans) out.push({ shape: shapeFrom([[a, y0], [b, y0], [b, y1], [a, y1]]), col, rev: col });
  }
  // upper with door notches from below + window holes
  {
    const pts = [[XE, Y_MINT1]];
    for (const d of doorsAsc) pts.push([d - DOOR_HW, Y_MINT1], [d - DOOR_HW, DOOR_TOP - 0.04], [d - DOOR_HW + 0.04, DOOR_TOP], [d + DOOR_HW - 0.04, DOOR_TOP], [d + DOOR_HW, DOOR_TOP - 0.04], [d + DOOR_HW, Y_MINT1]);
    pts.push([x1, Y_MINT1], [x1, YS], [XE, YS]);
    const holes = windowRects(cab).map(w => rrectPts((w.x0 + w.x1) / 2, (w.y0 + w.y1) / 2, w.x1 - w.x0, w.y1 - w.y0, w.r, 4));
    out.push({ shape: shapeFrom(pts, holes), col: COL.cream, rev: COL.reveal });
  }
  return out;
}
function windowRects(cab) {
  const list = WINDOWS.map(w => ({ ...w, y0: WIN_Y0, y1: WIN_Y1, r: 0.07 }));
  if (cab) { list.push({ ...CREW_WIN, r: 0.05, crew: true }, { ...CAB_WIN, r: 0.05, cab: true }); }
  else { list.push({ x0: 7.45, x1: 8.55, y0: WIN_Y0, y1: WIN_Y1, r: 0.07, pri: true }); } // (unused: all cars have a cab)
  return list;
}

// ------------------------------------------------------------------ door leaf
function leaf(B, xd, k, side, stickerUV) {
  const x0 = k === 0 ? xd - LEAF_W : xd, x1 = k === 0 ? xd : xd + LEAF_W;
  const wx0 = k === 0 ? xd - 0.56 : xd + 0.1, wx1 = k === 0 ? xd - 0.1 : xd + 0.56, wy0 = 2.18, wy1 = 3.0;
  const zT = side < 0 ? -(HW - 0.015) : HW - 0.055; // leaf occupies zT..zT+0.04
  const pieces = [
    [1.29, Y_BAND0, COL.cream], [Y_BAND0, Y_BAND1, COL.pink], [Y_BAND1, Y_MINT0, COL.cream], [Y_MINT0, Y_MINT1, COL.mint],
  ];
  for (const [y0, y1, col] of pieces) {
    const g = colorByNormal(extrudeShape(shapeFrom([[x0, y0], [x1, y0], [x1, y1], [x0, y1]]), 0.04), (nx, ny, nz) => nz * side > 0.5 ? col : nz * side < -0.5 ? COL.leafIn : col);
    B.add('paint', g, M([0, 0, zT]), null);
  }
  const win = rrectPts((wx0 + wx1) / 2, (wy0 + wy1) / 2, wx1 - wx0, wy1 - wy0, 0.06, 4);
  const up = colorByNormal(extrudeShape(shapeFrom([[x0, Y_MINT1], [x1, Y_MINT1], [x1, DOOR_TOP + 0.02], [x0, DOOR_TOP + 0.02]], [win]), 0.04, 4), (nx, ny, nz) => nz * side > 0.5 ? COL.cream : nz * side < -0.5 ? COL.leafIn : '#d3cdc2');
  B.add('paint', up, M([0, 0, zT]), null);
  B.add('glass', shapeGeo(shapeFrom(win)), M([0, 0, side * (HW - 0.035)]), '#ffffff');
  // leading edge rubber + inner yellow line
  B.box('paint', 0.024, DOOR_TOP + 0.02 - 1.29, 0.046, [xd + (k === 0 ? -0.012 : 0.012), (DOOR_TOP + 0.02 + 1.29) / 2, side * (HW - 0.035)], COL.rubber);
  B.box('paint', 0.022, 1.7, 0.004, [xd + (k === 0 ? -0.042 : 0.042), 2.25, side * (HW - 0.057)], COL.yellow);
  // sticker on the window (outside)
  if (stickerUV) { B.push(M([(wx0 + wx1) / 2 + (k === 0 ? 0.1 : -0.1), 2.32, side * (HW - 0.031)], [0, side < 0 ? Math.PI : 0, 0])); B.decal('decal', 0.12, 0.12, stickerUV); B.pop(); }
}

// ------------------------------------------------------------------ the car
/** o: { lit:'head'|'tail', animSide:-1|1, carSign:±1, doorsNeg, doorsPos, uv, numFront, numSide, destKey, runKey, lcdKey, sideKey,
 *        panto:bool, motor:bool, rng, crew:'driver'|'conductor', jakurei:bool, petals: [] (out), wheelsets: [] (out, car frame) } */
export function buildCar(B, o) {
  const r = o.rng;
  const cab = true;
  B.tag = 'walls';
  // ---------------- side walls
  for (const side of [-1, 1]) {
    for (const pc of wallPieces(cab)) {
      const g = colorByNormal(extrudeShape(pc.shape, WALL_T, 4), (nx, ny, nz) => nz * side > 0.5 ? pc.col : nz * side < -0.5 ? COL.wallIn : pc.rev);
      B.add('paint', g, M([0, 0, side < 0 ? -HW : HW - WALL_T]), null);
    }
    // window frames + glass
    for (const w of windowRects(cab)) {
      const cx = (w.x0 + w.x1) / 2, cy = (w.y0 + w.y1) / 2, ww = w.x1 - w.x0, hh = w.y1 - w.y0;
      const inner = rrectPts(cx, cy, ww, hh, w.r, 4);
      const fr = extrudeShape(shapeFrom(rrectPts(cx, cy, ww + 0.07, hh + 0.07, w.r + 0.035, 4), [inner]), 0.012, 4);
      B.add('metal', fr, M([0, 0, side < 0 ? -HW - 0.012 : HW]), w.crew || w.cab ? '#4a4a56' : COL.metal);
      B.add('glass', shapeGeo(shapeFrom(inner)), M([0, 0, side * (HW - 0.035)]), '#ffffff');
      const faceRot = [0, side < 0 ? Math.PI : 0, 0];
      if (w.pri) { B.push(M([cx, 2.27, side * (HW - 0.031)], faceRot)); B.decal('decal', 0.56, 0.14, o.uv.dec('priority')); B.pop(); }
    }
    // doors: leaves (platform side animated), threshold, visor
    for (const xd of DOORS) {
      for (const k of [0, 1]) {
        const anim = side === o.animSide;
        let target = B;
        if (anim) { const dirTrain = o.carSign * (k === 0 ? -1 : 1); target = dirTrain < 0 ? o.doorsNeg : o.doorsPos; }
        const st = k === 0 ? o.uv.dec('doorCaution') : (xd === 0 ? o.uv.dec('mascot') : o.uv.dec('kids'));
        leaf(target, xd, k, side, st);
      }
      B.box('metal', 2 * DOOR_HW, 0.025, WALL_T + 0.02, [xd, FLOOR - 0.0095, side * (HW - WALL_T / 2)], '#b5bbc2');
      B.box('paint', 2 * DOOR_HW - 0.04, 0.022, 0.012, [xd, FLOOR - 0.011, side * (HW + 0.012)], COL.yellow); // sill edge (足元注意)
      B.box('interior', 2 * DOOR_HW - 0.1, 0.006, 0.06, [xd, FLOOR + 0.003, side * (HW - WALL_T - 0.05)], COL.yellow);
      B.box('interior', 2 * DOOR_HW + 0.3, 0.004, 0.5, [xd, FLOOR + 0.002, side * (HW - WALL_T - 0.33)], COL.floorDoor);
      B.rbox('metal', 2 * DOOR_HW + 0.14, 0.025, 0.05, 0.01, [xd, DOOR_TOP + 0.08, side * (HW + 0.018)], COL.metal);
      // above-door (inside) LCD + route map
      B.box('interior', 1.2, 0.2, 0.04, [xd, DOOR_TOP + 0.14, side * (HW - WALL_T - 0.02)], '#dcdad4');
      const inRot = [0, side < 0 ? 0 : Math.PI, 0];
      B.push(M([xd - 0.3, DOOR_TOP + 0.14, side * (HW - WALL_T - 0.043)], inRot)); B.decal('led', 0.46, 0.115, o.uv.led(o.lcdKey)); B.pop();
      B.push(M([xd + 0.3, DOOR_TOP + 0.14, side * (HW - WALL_T - 0.043)], inRot)); B.decal('decal', 0.5, 0.166, o.uv.dec('routeMap')); B.pop();
    }
    const faceRot = [0, side < 0 ? Math.PI : 0, 0];
    const zo = side * (HW + 0.005);
    // car number, wordmark, maker plate, emergency sticker
    B.push(M([XE + 0.75, 1.5, zo], faceRot)); B.decal('decal', 0.52, 0.13, o.uv.dec(o.numSide)); B.pop();
    for (const x of [-3.0, 3.0]) { B.push(M([x, 1.46, zo], faceRot)); B.decal('decal', 0.96, 0.24, o.uv.dec('wordmark')); B.pop(); }
    B.push(M([XE + 1.6, 1.2, zo], faceRot)); B.decal('decal', 0.16, 0.08, o.uv.dec('plate')); B.pop();
    B.push(M([-6.95, 1.55, zo], faceRot)); B.decal('decal', 0.14, 0.07, o.uv.dec('emergency')); B.pop();
    // wheelchair / stroller stickers next to the cab-end door
    B.push(M([7.02, 2.66, zo], faceRot)); B.decal('decal', 0.2, 0.2, o.uv.dec('wheelchair')); B.pop();
    B.push(M([7.02, 2.4, zo], faceRot)); B.decal('decal', 0.2, 0.2, o.uv.dec('stroller')); B.pop();
    if (o.jakurei) { B.push(M([3.85, 2.3, side * (HW - 0.031)], faceRot)); B.decal('decal', 0.3, 0.15, o.uv.dec('jakurei')); B.pop(); }
    // side destination LED (above the window at x≈-2.15)
    B.box('matte', 0.84, 0.19, 0.016, [-2.15, 3.2, side * (HW + 0.004)], '#2b2a33');
    B.push(M([-2.15, 3.2, side * (HW + 0.0135)], faceRot)); B.decal('led', 0.76, 0.127, o.uv.led(o.sideKey)); B.pop();
    // car side lamps (車側灯): red, lit while the doors on this side are open
    for (const x of [XE + 0.32, CREW.x0 - 0.25]) {
      B.rbox('matte', 0.1, 0.1, 0.03, 0.012, [x, 3.27, side * (HW + 0.01)], '#6a3a44');
      if (side === o.animSide) o.lamps.push([x, 3.27, side * (HW + 0.026)]);
    }
    // crew door: outline, grab handles, step
    {
      const zz = side * (HW + 0.003);
      for (const [w, h, x, y] of [[0.012, 1.92, CREW.x0, 2.21], [0.012, 1.92, CREW.x1, 2.21], [CREW.x1 - CREW.x0, 0.012, (CREW.x0 + CREW.x1) / 2, 3.17]]) B.box('matte', w, h, 0.006, [x, y, zz], '#8d8a92');
      for (const x of [CREW.x0 - 0.07, CREW.x1 + 0.05]) {
        B.rod('metal', [x, 1.55, side * (HW + 0.05)], [x, 2.75, side * (HW + 0.05)], 0.014, COL.metal, 8);
        for (const y of [1.6, 2.7]) B.rod('metal', [x, y, side * HW], [x, y, side * (HW + 0.05)], 0.01, COL.metal, 6);
      }
      B.box('metal', 0.42, 0.035, 0.09, [(CREW.x0 + CREW.x1) / 2, 0.93, side * (HW + 0.02)], '#7e858e');
      B.rod('metal', [(CREW.x0 + CREW.x1) / 2 - 0.18, 0.95, side * (HW + 0.02)], [(CREW.x0 + CREW.x1) / 2 - 0.18, 1.02, side * (HW - 0.02)], 0.012, '#7e858e', 6);
    }
    // gutter (rain channel) along the roof edge
    B.rbox('metal', XS - XE + 0.02, 0.035, 0.03, 0.01, [(XS + XE) / 2, YS - 0.005, side * (HW + 0.012)], '#d4d8dc');
  }

  B.tag = 'roof';
  // ---------------- roof shell (cream shoulders, grey top)
  {
    const th1 = Math.PI - Math.acos(Math.pow(1.16 / HW, PR / 2)), th2 = Math.acos(Math.pow(1.16 / HW, PR / 2));
    const L = roofProfile(Math.PI, th1, 5), T = roofProfile(th1, th2, 26), R = roofProfile(th2, 0, 5);
    B.add('paint', sweepX(L.pts, L.nrm, XE, XS), null, COL.cream);
    B.add('paint', sweepX(T.pts, T.nrm, XE, XS), null, COL.roof);
    B.add('paint', sweepX(R.pts, R.nrm, XE, XS), null, COL.cream);
    // anti-slip walkway strips
    B.box('matte', XS - XE - 1.2, 0.012, 0.5, [(XS + XE) / 2, YR + 0.002, 0.0], COL.roofDark);
  }
  B.tag = 'endwall';
  // ---------------- gangway end wall
  {
    const prof = roofProfile(0, Math.PI, 24).pts; // from +HW over the roof to -HW
    const pts = [[-HW, YB], [HW, YB], ...prof.map(([z, y]) => [z, y])];
    const g = colorByNormal(extrudeShape(shapeFrom(pts), 0.06, 4), (nx, ny, nz) => nz < -0.5 ? COL.wallIn : COL.cream);
    // shape (sx=z, sy=y, d) -> rotate -90° about Y: x=-d, z=sx  => then shift to x = XE + 0.06
    B.add('paint', g, M([XE + 0.06, 0, 0], [0, -Math.PI / 2, 0]), null);
    // gangway door panel inside
    B.push(M([XE + 0.065, 2.25, 0], [0, Math.PI / 2, 0])); B.decal('decal', 0.8, 1.9, o.uv.dec('gangway')); B.pop();
    // receptacles / jumper sockets on the outer face
    for (const z of [-0.95, -0.72, 0.8]) B.rbox('matte', 0.08, 0.14, 0.14, 0.02, [XE - 0.03, 1.12, z * o.carSign], '#3f434c');
    B.box('matte', 0.3, 0.14, 0.16, [XE - 0.12, 0.9, 0], '#4a4e57');
    B.push(M([XE - 0.004, 1.36, -0.84 * o.carSign], [0, -Math.PI / 2, 0])); B.decal('decal', 0.2, 0.1, o.uv.dec('jumperWarn')); B.pop();
  }

  B.tag = 'under';
  // ---------------- underframe & floor
  B.add('interior', colorByNormal(GEO.box().clone().scale(XS - XE - 0.06, 0.28, 2 * (HW - WALL_T)), (nx, ny) => ny > 0.5 ? COL.floor : COL.under), M([(XS + XE + 0.06) / 2, YB + 0.14, 0]), null);
  B.box('matte', XS - XE, 0.09, 2 * HW - 0.08, [(XS + XE) / 2, 0.975, 0], COL.under);
  // underfloor equipment boxes
  {
    const specs = o.motor
      ? [[-4.45, -2.85, 0.5, 1.2, 0.2], [-2.6, -1.85, 0.32, 1.1, 0.35], [-1.55, 0.35, 0.52, 1.2, 0.18], [0.6, 1.5, 0.36, 1.05, 0.4], [1.8, 3.35, 0.46, 1.18, 0.22], [3.6, 4.4, 0.3, 1.0, 0.45]]
      : [[-4.4, -3.3, 0.42, 1.15, 0.25], [-3.0, -1.4, 0.3, 1.0, 0.5], [-1.1, 0.2, 0.48, 1.2, 0.2], [0.5, 1.9, 0.34, 1.1, 0.35], [2.2, 3.1, 0.44, 1.15, 0.3], [3.4, 4.4, 0.28, 0.95, 0.5]];
    for (const side of [-1, 1]) {
      for (const [x0, x1, h, zOut, zIn] of specs) {
        const w = x1 - x0, zc = side * (zOut + zIn) / 2, d = zOut - zIn;
        const col = r.pick(['#5b5f68', '#63676f', '#555960', '#6d7178']);
        B.rbox('matte', w, h, d, 0.03, [(x0 + x1) / 2, 0.93 - h / 2, zc], col, null, 1);
        // ribs / vents on the outer face
        const nr = Math.max(2, Math.floor(w / 0.22));
        if (r.chance(0.6)) for (let i = 0; i < nr; i++) B.box('matte', 0.03, h * 0.6, 0.012, [x0 + 0.1 + (w - 0.2) * i / Math.max(1, nr - 1), 0.93 - h / 2, side * (zOut + 0.004)], '#4a4e56');
        else B.box('matte', w * 0.7, h * 0.5, 0.01, [(x0 + x1) / 2, 0.93 - h / 2, side * (zOut + 0.004)], '#727781');
      }
    }
    // air reservoirs
    for (const z of [-0.12, 0.3]) B.cyl('matte', 0.15, 0.15, 2.2, [o.motor ? 2.4 : -2.1, 0.7, z], '#6a6e76', [0, 0, Math.PI / 2], 14);
    // pipes
    for (const [z, y] of [[-0.3, 0.84], [0.25, 0.86], [0.1, 0.8]]) B.cyl('matte', 0.025, 0.025, XS - XE - 1.2, [(XS + XE) / 2, y, z], '#4a4e56', [0, 0, Math.PI / 2], 6);
  }
  B.tag = 'bogies';
  // ---------------- bogies
  for (const bx of [-BOGIE_X, BOGIE_X]) {
    const prof = [[-1.38, 0.8], [-1.38, 0.92], [-0.72, 0.92], [-0.5, 0.76], [0.5, 0.76], [0.72, 0.92], [1.38, 0.92], [1.38, 0.8], [0.8, 0.8], [0.56, 0.6], [-0.56, 0.6], [-0.8, 0.8]];
    for (const side of [-1, 1]) {
      B.add('matte', extrudeShape(shapeFrom(prof), 0.14), M([bx, 0, side * 0.86 - 0.07]), COL.bogie);
      for (const ax of [-WHEELBASE / 2, WHEELBASE / 2]) {
        B.rbox('metal', 0.32, 0.2, 0.2, 0.04, [bx + ax, WHEEL_R + 0.15, side * 0.86], '#5f646c', null, 1);
        B.cyl('metal', 0.07, 0.07, 0.05, [bx + ax, WHEEL_R + 0.15, side * 0.975], '#8a9098', [Math.PI / 2, 0, 0], 12);
        // coil spring
        const pts = []; const turns = 4.5, n = 36;
        for (let i = 0; i <= n; i++) { const a = (i / n) * turns * Math.PI * 2; pts.push(new THREE.Vector3(bx + ax + Math.cos(a) * 0.075, 0.68 + 0.12 * i / n, side * 0.86 + Math.sin(a) * 0.075)); }
        B.add('metal', new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 27, 0.017, 3, false), null, COL.spring);
        // brake unit facing the tread (inboard of each wheel)
        const bxx = bx + ax - Math.sign(ax) * 0.52;
        B.rbox('matte', 0.16, 0.18, 0.14, 0.03, [bxx, 0.6, side * 0.56], '#474b53');
        B.cyl('matte', 0.06, 0.06, 0.16, [bxx - Math.sign(ax) * 0.12, 0.62, side * 0.56], '#666b73', [0, 0, Math.PI / 2], 10);
      }
      // air spring (bellows)
      B.add('matte', new THREE.LatheGeometry([[0.16, 0], [0.23, 0.03], [0.25, 0.08], [0.23, 0.13], [0.17, 0.16]].map(p => new THREE.Vector2(p[0], p[1])), 16), M([bx, 0.765, side * 0.98]), '#3f4148');
      B.cyl('matte', 0.2, 0.2, 0.02, [bx, 0.935, side * 0.98], '#5b5f68', null, 16);
      // lateral damper
      B.rod('matte', [bx + 0.35, 0.7, side * 0.35], [bx + 0.35, 0.9, side * 0.75], 0.03, '#2f3038', 8);
    }
    for (const ax of [-WHEELBASE / 2, WHEELBASE / 2]) o.wheelsets.push([bx + ax, WHEEL_R + 0.15, 0]);
    B.box('matte', 0.34, 0.2, 1.62, [bx, 0.7, 0], COL.bogie);
    B.box('matte', 1.9, 0.08, 0.12, [bx, 0.66, 0], '#45494f');
    if (o.motor) for (const ax of [-0.55, 0.55]) {
      B.cyl('matte', 0.2, 0.2, 0.5, [bx + ax, 0.58, -0.12 * Math.sign(ax)], '#5a5e66', [Math.PI / 2, 0, 0], 16);
      B.rbox('matte', 0.3, 0.34, 0.16, 0.04, [bx + ax * 1.55, 0.55, 0.36 * Math.sign(ax)], '#4a4e56');
    }
  }

  B.tag = 'roofgear';
  // ---------------- roof gear
  const acX = o.panto ? 1.0 : 0.0;
  {
    B.rbox('paint', 3.3, 0.05, 1.92, 0.02, [acX, 3.76, 0], '#8f959d');
    B.rbox('paint', 3.2, 0.34, 1.86, 0.1, [acX, 3.91, 0], '#d3d7da', null, 3);
    for (const fx of [-0.78, 0.78]) {
      B.cyl('metal', 0.36, 0.36, 0.02, [acX + fx, 4.08, 0], '#707780', null, 24);
      B.cyl('metal', 0.3, 0.3, 0.012, [acX + fx, 4.089, 0], '#5d636c', null, 24);
      B.box('metal', 0.64, 0.012, 0.035, [acX + fx, 4.094, 0], '#8b929a', [0, 0.6, 0]);
      B.box('metal', 0.64, 0.012, 0.035, [acX + fx, 4.094, 0], '#8b929a', [0, -0.6, 0]);
      B.cyl('metal', 0.07, 0.07, 0.03, [acX + fx, 4.1, 0], '#9aa1a8', null, 12);
    }
    for (const side of [-1, 1]) { for (const y of [3.84, 3.9, 3.96]) B.box('matte', 2.7, 0.014, 0.012, [acX, y, side * 0.931], '#a2a8af'); B.box('matte', 2.9, 0.2, 0.004, [acX, 3.9, side * 0.927], '#bfc4c9'); }
    const vents = o.panto ? [3.9, 5.6, -2.3] : [-3.5, 3.5, -5.8, 5.6];
    for (const vx of vents) {
      B.rbox('paint', 0.62, 0.13, 0.42, 0.05, [vx, 3.83, 0], '#c9cdd1');
      B.box('matte', 0.5, 0.012, 0.3, [vx, 3.9, 0], '#8a9098');
    }
    // antenna near the cab
    B.box('matte', 0.3, 0.03, 0.14, [XS - 1.5, YR + 0.01, -0.5], '#5b5f68');
    B.box('matte', 0.03, 0.22, 0.16, [XS - 1.5, YR + 0.12, -0.5], '#3f434c');
    // roof bus cable (runs the whole car on small insulators)
    const cz = 0.62 * o.carSign;
    for (let x = XE + 0.5; x < XS - 0.8; x += 1.6) { const y = roofY(cz); B.cyl('metal', 0.03, 0.035, 0.08, [x, y + 0.03, cz], '#e3e0d8', null, 8); }
    B.cyl('matte', 0.024, 0.024, XS - XE - 1.0, [(XS + XE) / 2 - 0.2, roofY(cz) + 0.085, cz], '#3a3a44', [0, 0, Math.PI / 2], 8);
  }
  if (o.panto) buildPantograph(B, -BOGIE_X, 0.62 * o.carSign);

  B.tag = 'saloon';
  // ---------------- interior (saloon)
  buildSaloon(B, o);
  B.tag = 'nose';
  // ---------------- nose
  buildNose(B, o);
  B.tag = 'petals';
  // ---------------- petals resting on the roof / windscreen edge
  roofPetals(B, o, acX);
}

function buildPantograph(B, px, cz) {
  const y0 = YR;
  // insulators + base frame
  for (const dx of [-0.55, 0.55]) for (const dz of [-0.42, 0.42]) {
    const x = px + dx, z = dz; const yb = roofY(z);
    for (let i = 0; i < 3; i++) B.cyl('metal', 0.065, 0.065, 0.03, [x, yb + 0.03 + i * 0.05, z], '#e6e2da', null, 12);
    B.cyl('metal', 0.035, 0.035, 0.16, [x, yb + 0.08, z], '#d8d4cc', null, 8);
  }
  const yf = y0 + 0.2;
  for (const dz of [-0.42, 0.42]) B.box('metal', 1.3, 0.05, 0.07, [px, yf, dz], '#8a9098');
  for (const dx of [-0.55, 0.55]) B.box('metal', 0.07, 0.05, 0.9, [px + dx, yf, 0], '#8a9098');
  const H = [px - 0.5, yf + 0.05], P = [px - 0.35, 5.06];
  const L1 = 1.25, L2 = 1.2;
  const dx = P[0] - H[0], dy = P[1] - H[1], d = Math.hypot(dx, dy);
  const ca = (L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), a = Math.atan2(dy, dx) - Math.acos(clamp(ca, -1, 1));
  const K = [H[0] + L1 * Math.cos(a), H[1] + L1 * Math.sin(a)];
  B.cyl('metal', 0.05, 0.05, 0.5, [H[0], H[1], 0], '#9aa1a8', [Math.PI / 2, 0, 0], 10);
  B.rod('metal', [H[0], H[1], 0], [K[0], K[1], 0], 0.045, '#c9ced4', 10);
  B.rod('metal', [H[0] + 0.1, H[1] - 0.02, 0.1], [K[0] - 0.05, K[1] - 0.06, 0.06], 0.014, '#aab0b7', 6);
  for (const z of [-0.26, 0.26]) B.rod('metal', [K[0], K[1], z * 0.25], [P[0], P[1], z], 0.024, '#c9ced4', 8);
  B.rod('metal', [K[0] - 0.3, K[1] + 0.18, -0.13], [K[0] - 0.3, K[1] + 0.18, 0.13], 0.014, '#aab0b7', 6);
  B.cyl('metal', 0.04, 0.04, 0.3, [K[0], K[1], 0], '#8a9098', [Math.PI / 2, 0, 0], 10);
  // spring/damper at the base
  B.rod('matte', [H[0] + 0.08, H[1] - 0.02, -0.2], [H[0] + 0.55, H[1] + 0.12, -0.2], 0.035, '#4a4e57', 8);
  // pan head: two collector strips with horns (top at y 5.15)
  B.box('metal', 0.1, 0.04, 0.62, [P[0], 5.075, 0], '#9aa1a8');
  for (const sx of [-0.06, 0.06]) {
    B.box('metal', 0.045, 0.05, 1.12, [P[0] + sx, 5.12, 0], '#6d747c');
    for (const s of [-1, 1]) B.tube('metal', [[P[0] + sx, 5.12, s * 0.55], [P[0] + sx, 5.1, s * 0.75], [P[0] + sx, 5.02, s * 0.9], [P[0] + sx, 4.95, s * 0.93]], 0.016, '#9aa1a8', 8, 5);
  }
  for (const s of [-1, 1]) B.rod('metal', [P[0], 5.075, s * 0.3], [P[0], 5.1, s * 0.3], 0.02, '#8a9098', 6);
  // lightning arrester + cable to the bus line
  B.cyl('metal', 0.06, 0.07, 0.28, [px + 1.2, roofY(cz) + 0.14, cz], '#e3e0d8', null, 10);
  B.tube('matte', [[px + 0.55, yf, 0.42], [px + 0.8, yf - 0.05, 0.55], [px + 1.2, roofY(cz) + 0.28, cz]], 0.02, '#3a3a44', 10, 6);
}

function buildSaloon(B, o) {
  const r = o.rng;
  // ceiling (cove + flat), light strips, diffuser
  const cp = [[-1.32, 3.38], [-0.95, 3.6], [0.95, 3.6], [1.32, 3.38]], cn = [[0.51, -0.86], [0, -1], [0, -1], [-0.51, -0.86]];
  B.add('interior', sweepX(cp, cn, XE + 0.06, CAB_BACK), null, COL.ceiling);
  for (const z of [-0.62, 0.62]) {
    for (let x = XE + 0.35; x < CAB_BACK - 0.5; x += 1.25) B.box('iLight', 1.12, 0.02, 0.15, [x + 0.56, 3.588, z], '#ffffff');
  }
  B.box('interior', CAB_BACK - XE - 0.5, 0.03, 0.34, [(CAB_BACK + XE) / 2, 3.585, 0], '#e2e1dc');
  // benches: [x0, x1, priority]
  const benches = [[-8.68, -7.34, true], [-4.61, -1.39, false], [1.39, 4.61, false]];
  for (const side of [-1, 1]) {
    for (const [x0, x1, pri] of benches) {
      const len = x1 - x0, cx = (x0 + x1) / 2;
      const col = pri ? COL.seatPri : COL.seat;
      B.rbox('interior', len, 0.11, 0.5, 0.045, [cx, 1.685, side * 1.06], col, null, 1);
      B.rbox('interior', len, 0.4, 0.09, 0.04, [cx, 1.97, side * 1.27], col, [side * 0.08, 0, 0], 1);
      B.box('interior', len - 0.02, 0.3, 0.02, [cx, 1.47, side * 1.12], COL.seatBase);
      // seat end partitions (袖仕切り) + poles
      for (const [ex, dir] of [[x0, -1], [x1, 1]]) {
        const px = ex + dir * 0.03;
        if (!(pri && dir < 0)) {
          B.rbox('interior', 0.035, 1.02, 0.5, 0.03, [px, FLOOR + 0.52, side * 1.07], COL.partition, null, 1);
          B.rod('metal', [px, FLOOR, side * 0.8], [px, 3.3, side * 0.8], 0.017, COL.metal, 8);
        }
      }
      if (!pri) for (const d of [-0.69, 0.69]) B.rod('metal', [cx + d, 1.74, side * 0.82], [cx + d, 3.05, side * 1.1], 0.015, COL.metal, 8);
      // luggage rack
      B.box('metal', len, 0.025, 0.3, [cx, 3.05, side * 1.17], '#cfd4d8');
      for (let k = 0; k <= Math.round(len / 1.1); k++) B.box('metal', 0.02, 0.08, 0.3, [x0 + 0.05 + (len - 0.1) * k / Math.max(1, Math.round(len / 1.1)), 3.09, side * 1.17], '#aeb4ba');
      // window-top ads
      if (!pri) for (const ax of [cx - 0.8, cx + 0.8]) {
        B.push(M([ax, 3.24, side * (HW - WALL_T - 0.05)], [0.25, side < 0 ? 0 : Math.PI, 0]));
        B.decal('decal', 0.5, 0.31, o.uv.dec('ad' + r.int(0, 5))); B.pop();
      }
    }
    // grab bar + straps
    const x0 = XE + 0.3, x1 = CAB_BACK - 0.25;
    B.rod('metal', [x0, 3.3, side * 0.86], [x1, 3.3, side * 0.86], 0.015, COL.metal, 8);
    for (let x = x0 + 0.2; x < x1 - 0.1; x += 0.34) {
      const pri = x < -7.2;
      B.box('interior', 0.028, 0.2, 0.01, [x, 3.19, side * 0.86], '#e5e3de');
      B.add('interior', GEO.torus(0.055, 0.011, 3, 7), M([x, 3.035, side * 0.86]), pri ? COL.ringPri : COL.ring);
    }
    // wheelchair space handrail near the cab
    B.rod('metal', [6.72, 2.1, side * 1.26], [6.98, 2.1, side * 1.26], 0.015, COL.metal, 6);
  }
  // hanging posters (中吊り) — double sided
  for (const hx of [-3.0, 3.0, -8.0]) {
    B.rod('metal', [hx - 0.3, 3.58, 0], [hx + 0.3, 3.58, 0], 0.008, COL.metal, 4);
    const id = 'hang' + r.int(0, 3);
    B.push(M([hx, 3.44, 0.004], [0, 0, 0])); B.decal('decal', 0.56, 0.28, o.uv.dec(id)); B.pop();
    B.push(M([hx, 3.44, -0.004], [0, Math.PI, 0])); B.decal('decal', 0.56, 0.28, o.uv.dec('hang' + r.int(0, 3))); B.pop();
  }
  // priority sign on the end wall area
  B.push(M([XE + 0.07, 3.2, 0], [0, Math.PI / 2, 0])); B.decal('decal', 0.5, 0.125, o.uv.dec('prioritySign')); B.pop();

  B.tag = 'people';
  // passengers (a few)
  const seatsX = [];
  for (const [x0, x1, pri] of benches) { const n = Math.round((x1 - x0) / 0.46); for (let i = 0; i < n; i++) seatsX.push([x0 + (i + 0.5) * (x1 - x0) / n, pri]); }
  const nSit = r.int(3, 5);
  const used = new Set();
  for (let i = 0; i < nSit; i++) {
    const side = r.chance(0.5) ? -1 : 1;
    let k = r.int(0, seatsX.length - 1);
    if (used.has(side + ':' + k)) continue; used.add(side + ':' + k);
    const [x, pri] = seatsX[k];
    const look = pickLook(r);
    if (pri && r.chance(0.6)) { look.outfit = 'cardigan'; look.hair = '#b8b2b8'; look.style = 'bob'; }
    person(B, 'interior', [x, 1.74, side * 1.1], side < 0 ? 0 : Math.PI, { ...look, pose: 'sit', lookDown: look.acc === 'phone' || look.acc === 'book' });
  }
  const nStand = r.int(1, 3);
  for (let i = 0; i < nStand; i++) {
    const xd = r.pick(DOORS);
    const look = pickLook(r);
    const x = xd + r.range(-0.9, 0.9), z = r.range(-0.55, 0.55);
    const strap = r.chance(0.5);
    person(B, 'interior', [x, FLOOR, strap ? Math.sign(z || 1) * 0.86 : z], r.chance(0.5) ? Math.PI / 2 : -Math.PI / 2, { ...look, pose: 'stand', strap, acc: strap ? 'bag' : look.acc });
  }
}

const PETAL_COLS = ['#f2a9c0', '#eb9db6', '#f5bfd0', '#e993b0', '#f7c9d7', '#f0b0c6', '#f4b6c9'];
function roofPetals(B, o, acX) {
  const r = o.rng;
  const up = new THREE.Vector3(0, 1, 0);
  const add = (p, n, s) => { B.push(basis(p, n)); B.add('petal', GEO.plane(), M([0, 0, 0], [0, 0, r() * Math.PI * 2], [s, s * 1.2, 1]), r.pick(PETAL_COLS)); B.pop(); };
  const vents = o.panto ? [3.9, 5.6, -2.3] : [-3.5, 3.5, -5.8, 5.6];
  const blocked = (x, z) => (Math.abs(x - acX) < 1.66 && Math.abs(z) < 0.98) || vents.some(v => Math.abs(x - v) < 0.34 && Math.abs(z) < 0.24)
    || (o.panto && Math.abs(x + BOGIE_X) < 0.72 && Math.abs(z) < 0.52);
  const onRoof = (x, z, s) => {
    if (x < XE + 0.05 || x > XS - 0.1 || blocked(x, z)) return;
    const [nz, ny] = roofNormal(z || 1e-4);
    add(new THREE.Vector3(x, roofY(z) + 0.005, z), new THREE.Vector3(0, ny, nz), s);
  };
  const tri = () => r() + r() - 1; // soft-centred offset in [-1, 1]
  // drifts: elongated along the car (air flow), dense core, soft falloff
  const drift = (cx, cz, lx, lz, n, s0 = 0.058, s1 = 0.088) => {
    for (let i = 0; i < n; i++) onRoof(cx + tri() * lx, clamp(cz + tri() * lz, -1.08, 1.08), r.range(s0, s1));
  };
  drift(acX - 1.95, r.range(-0.3, 0.3), 0.42, 0.58, 50);          // leeward of the AC unit (both ends)
  drift(acX + 1.95, r.range(-0.3, 0.3), 0.34, 0.52, 36);
  for (const zc of [-0.29, 0.29]) for (let k = 0; k < 3; k++)    // caught along the edges of the anti-slip walkway
    drift(r.range(XE + 1, XS - 1.2), zc + r.range(-0.04, 0.04), r.range(0.5, 1.1), 0.1, r.int(16, 28));
  drift(XS - 0.55, r.range(-0.3, 0.3), 0.32, 0.72, 28);            // cab-end roof
  drift(XE + 0.45, r.range(-0.4, 0.4), 0.3, 0.62, 18);            // gangway end
  for (const v of vents) drift(v + 0.45, 0, 0.14, 0.3, 6, 0.045, 0.065); // little heaps behind the vents
  // on top of the AC unit (avoid the fan discs)
  for (let i = 0; i < 16; i++) {
    const x = acX + r.range(-1.45, 1.45), z = r.range(-0.82, 0.82);
    if ([-0.78, 0.78].some(fx => Math.hypot(x - acX - fx, z) < 0.39)) continue;
    add(new THREE.Vector3(x, 4.084, z), up, r.range(0.045, 0.065));
  }
  for (let i = 0; i < 60; i++) onRoof(r.range(XE + 0.1, XS - 0.2), r.range(-1.05, 1.05), r.range(0.048, 0.07)); // sparse scatter
  // windscreen: caught along the lower edge of the glass, mostly in the corners and against the parked wipers
  for (let i = 0; i < 24; i++) {
    const corner = r.chance(0.55), sgn = r.chance(0.5) ? -1 : 1;
    const u = corner ? sgn * r.range(0.55, 0.8) : r.range(-0.55, 0.55);
    const y = GLS.y0 + (corner ? r.range(-0.035, 0.07) : r.range(-0.035, 0.03));
    const onGlass = y > GLS.y0 && Math.abs(u) < gU(y);
    const s = nose(u, y); add(s.p.clone().addScaledVector(s.n, onGlass ? -0.008 : 0.004), s.n.clone(), r.range(0.042, 0.06));
  }
  // nose cap (top of the cab, curving into the roof)
  for (let i = 0; i < 12; i++) {
    const u = r.range(-0.8, 0.8), y = r.range(MASK.y1 + 0.05, 3.62);
    const s = nose(u, y); add(s.p.clone().addScaledVector(s.n, 0.005), s.n.clone(), r.range(0.04, 0.055));
  }
}
