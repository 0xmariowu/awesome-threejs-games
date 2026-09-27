// Track: ballast bed, rails (head/web/foot profile), sleepers (PC near the station, wooden further out),
// fasteners / tie plates, fishplate joints with bolts, the crossover (2 turnouts: switch rails, frogs,
// check rails, point machines + rods), ATS transponders and instanced ballast stones.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// ---------------------------------------------------------------- rail profile (JIS 50N simplified)
export const PROF = [
  [-0.0635, 0.000], [-0.0635, 0.012], [-0.012, 0.030], [-0.009, 0.042], [-0.009, 0.100], [-0.014, 0.109], [-0.0325, 0.117],
  [-0.0325, 0.139], [-0.027, 0.148], [-0.0135, 0.150], [0.0135, 0.150], [0.027, 0.148], [0.0325, 0.139], [0.0325, 0.117],
  [0.014, 0.109], [0.009, 0.100], [0.009, 0.042], [0.012, 0.030], [0.0635, 0.012], [0.0635, 0.000]];
const TOP_EDGES = new Set([9]);                           // polished running band
const HEAD_EDGES = new Set([5, 6, 7, 8, 10, 11, 12, 13]); // steel-grey head, the rest = rusty web / foot
let _capTris = null;
function capTris() {
  if (!_capTris) _capTris = THREE.ShapeUtils.triangulateShape(PROF.map(p => new THREE.Vector2(p[0], p[1])), []);
  return _capTris;
}

function pushTri(t, a, b, c, N) {
  const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
  const cx = uy * vz - uz * vy, cy = uz * vx - ux * vz, cz = ux * vy - uy * vx;
  const tri = cx * N[0] + cy * N[1] + cz * N[2] < 0 ? [a, c, b] : [a, b, c];
  for (const v of tri) { t.p.push(v[0], v[1], v[2]); t.n.push(N[0], N[1], N[2]); }
}
function toGeo(t) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(t.p, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(t.n, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(t.p.length / 3 * 2), 2));
  return g;
}

/** Extrude the rail profile along an XZ path. hs(x) scales the head width (switch-rail taper).
 *  Returns { side, top } geometries (rust sides / polished running strip). */
export function railGeo(path, hs = null, caps = [false, false], lift = 0) {
  const n = path.length;
  const lat = path.map((p, i) => {
    const a = path[Math.max(0, i - 1)], b = path[Math.min(n - 1, i + 1)];
    let tx = b[0] - a[0], tz = b[1] - a[1]; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
    return [-tz, tx];
  });
  const side = { p: [], n: [] }, top = { p: [], n: [] }, head = { p: [], n: [] };
  const P = (i, e) => { const [x, z] = path[i], [lx, lz] = lat[i]; let [u, y] = PROF[e]; if (hs && e >= 6 && e <= 13) u *= hs(x); return [x + lx * u, y + lift, z + lz * u]; };
  for (let i = 0; i < n - 1; i++) {
    let lx = lat[i][0] + lat[i + 1][0], lz = lat[i][1] + lat[i + 1][1]; const ll = Math.hypot(lx, lz) || 1; lx /= ll; lz /= ll;
    for (let e = 0; e < PROF.length - 1; e++) {
      const a = PROF[e], b = PROF[e + 1];
      let nu = -(b[1] - a[1]), ny = b[0] - a[0]; const nl = Math.hypot(nu, ny); nu /= nl; ny /= nl;
      const N = [lx * nu, ny, lz * nu];
      const A0 = P(i, e), B0 = P(i, e + 1), A1 = P(i + 1, e), B1 = P(i + 1, e + 1);
      const t = TOP_EDGES.has(e) ? top : HEAD_EDGES.has(e) ? head : side;
      pushTri(t, A0, B0, B1, N); pushTri(t, A0, B1, A1, N);
    }
  }
  for (const [k, on] of [[0, caps[0]], [n - 1, caps[1]]]) {
    if (!on) continue;
    const j = k === 0 ? 1 : n - 2;
    let tx = path[k][0] - path[j][0], tz = path[k][1] - path[j][1]; const l = Math.hypot(tx, tz) || 1;
    const N = [tx / l, 0, tz / l];
    for (const [a, b, c] of capTris()) pushTri(side, P(k, a), P(k, b), P(k, c), N);
  }
  return { side: toGeo(side), top: toGeo(top), head: toGeo(head) };
}

// ---------------------------------------------------------------- small geometry builders
/** Box-ish solid with a narrower top (PC sleeper), length along Z, top at y = 0, no bottom face. */
function taperedBox(len, wTop, wBot, h) {
  const t = { p: [], n: [], uv: [] };
  const L2 = len / 2, a = wTop / 2, b = wBot / 2;
  const quad = (v0, v1, v2, v3, N, uv) => {
    const tris = [[0, 1, 2], [0, 2, 3]]; const V = [v0, v1, v2, v3];
    for (const tr of tris) {
      const A = V[tr[0]], B = V[tr[1]], C = V[tr[2]];
      const ux = B[0] - A[0], uy = B[1] - A[1], uz = B[2] - A[2], vx = C[0] - A[0], vy = C[1] - A[1], vz = C[2] - A[2];
      const cx = uy * vz - uz * vy, cy = uz * vx - ux * vz, cz = ux * vy - uy * vx;
      const ord = cx * N[0] + cy * N[1] + cz * N[2] < 0 ? [tr[0], tr[2], tr[1]] : tr;
      for (const k of ord) { t.p.push(...V[k]); t.n.push(...N); t.uv.push(...uv[k]); }
    }
  };
  const sl = (b - a) / h, nl = Math.hypot(1, sl);
  // top
  quad([-a, 0, -L2], [a, 0, -L2], [a, 0, L2], [-a, 0, L2], [0, 1, 0], [[0, 0.1], [0, 0.9], [1, 0.9], [1, 0.1]]);
  // long sides
  quad([a, 0, -L2], [b, -h, -L2], [b, -h, L2], [a, 0, L2], [1 / nl, sl / nl, 0], [[0, 0.9], [0, 1], [1, 1], [1, 0.9]]);
  quad([-a, 0, -L2], [-b, -h, -L2], [-b, -h, L2], [-a, 0, L2], [-1 / nl, sl / nl, 0], [[0, 0.1], [0, 0], [1, 0], [1, 0.1]]);
  // ends
  quad([-a, 0, L2], [a, 0, L2], [b, -h, L2], [-b, -h, L2], [0, 0, 1], [[1, 0.1], [1, 0.9], [1, 1], [1, 0]]);
  quad([-a, 0, -L2], [a, 0, -L2], [b, -h, -L2], [-b, -h, -L2], [0, 0, -1], [[0, 0.1], [0, 0.9], [0, 1], [0, 0]]);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(t.p, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(t.n, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(t.uv, 2));
  return g;
}
function boxGeo(w, h, d, x = 0, y = 0, z = 0, noBottom = false) {
  const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z);
  if (noBottom) { const ix = g.index.array; const keep = []; for (let i = 0; i < ix.length; i++) if (i < 18 || i >= 24) keep.push(ix[i]); g.setIndex(keep); g.clearGroups(); }
  return g;
}

// ---------------------------------------------------------------- helpers
const smooth01 = (t) => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
const smoother = (t) => { t = Math.max(0, Math.min(1, t)); return t * t * t * (t * (t * 6 - 15) + 10); };
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();
export function makeInstanced(geo, mat, items, { shadow = true, colors = false } = {}) {
  if (!items.length) return null;
  const m = new THREE.InstancedMesh(geo, mat, items.length);
  items.forEach((it, i) => {
    _e.set(it.rx || 0, it.ry || 0, it.rz || 0, 'YXZ'); _q.setFromEuler(_e);
    _m4.compose(_p.set(it.x, it.y, it.z), _q, _s.set(it.sx ?? 1, it.sy ?? 1, it.sz ?? 1));
    m.setMatrixAt(i, _m4);
    if (colors) m.setColorAt(i, _c.set(it.c || '#ffffff'));
  });
  m.instanceMatrix.needsUpdate = true;
  if (m.instanceColor) m.instanceColor.needsUpdate = true;
  m.castShadow = shadow; m.receiveShadow = true;
  m.computeBoundingSphere();
  return m;
}

// =====================================================================================
export function buildTrack(ctx, root, T, E) {
  const { mat } = ctx;
  const r = ctx.rng('rw-track');
  const out = { sleeperLists: {}, ties: [], frogs: [], railsAt: null };
  const { zA, zB, HG, X0, X1 } = E;
  const { SaZ, NaZ, SbZ, NbZ } = E.rails;
  const { xa, xb } = E.xo;

  // ------------------------------------------------ materials
  const M = {
    railSide: mat.toon('#68564d', { paint: 0.08 }),
    railHead: mat.toon('#8e8580', { paint: 0.08 }),
    railTop: mat.toon('#e6eaee', { paint: 0.05, emissive: '#444a54', emissiveIntensity: 1 }),
    ballast: mat.toon('#ffffff', { map: T.ballast, vertexColors: true, paint: 0.05 }),
    pc: mat.toon('#ffffff', { map: T.pc, paint: 0.05 }),
    wood: mat.toon('#ffffff', { map: T.wood, paint: 0.08 }),
    steel: mat.toon('#5d5a5c', { paint: 0.05 }),
    clip: mat.toon('#4a4a52', { paint: 0.05 }),
    plate: mat.toon('#6a5d57', { paint: 0.08 }),
    frog: mat.toon('#5f5754', { paint: 0.08 }),
    stone: mat.toon('#ffffff', { paint: 0.05 }),
    pm: mat.toon('#a2a8ac', { paint: 0.05 }),
    concrete: mat.toon(ctx.palette.concrete, { paint: 0.08 }),
    ats: mat.toon('#e7b23e', { paint: 0.05 }),
    atsDark: mat.toon('#4b4750'),
    white: mat.toon('#eeebe4'),
    black: mat.toon('#3d3a42'),
  };
  out.M = M;

  // ------------------------------------------------ ballast bed (cross-section across both tracks)
  // half profile by distance d from the corridor centre (z = -43); mirrored for both sides.
  const HALF = [
    [0.0, -0.062, [0.9, 0.88, 0.86]], [0.45, -0.05, [0.95, 0.94, 0.92]], [0.9, -0.03, [1.0, 1.0, 0.99]], [1.1, -0.02, [0.98, 0.97, 0.96]],
    [1.434, -0.02, [0.84, 0.76, 0.7]], [1.62, -0.02, [0.95, 0.92, 0.9]], [2.0, -0.02, [0.88, 0.86, 0.85]], [2.38, -0.02, [0.95, 0.92, 0.9]],
    [2.566, -0.02, [0.84, 0.76, 0.7]], [2.75, -0.02, [0.97, 0.96, 0.95]], [3.2, -0.02, [1.05, 1.04, 1.03]], [3.33, -0.032, [1.06, 1.05, 1.04]],
    [3.6, -0.15, [1.0, 1.0, 0.99]], [3.85, -0.285, [0.9, 0.91, 0.86]], [4.02, -0.345, [0.84, 0.86, 0.8]]];
  const PZ = [];
  for (let i = HALF.length - 1; i >= 0; i--) PZ.push([-43 - HALF[i][0], HALF[i][1], HALF[i][2]]); // north half (z ascending)
  for (let i = 1; i < HALF.length; i++) PZ.push([-43 + HALF[i][0], HALF[i][1], HALF[i][2]]);
  E.ballastY = (z) => {
    const d = Math.abs(z + 43);
    if (d >= HALF[HALF.length - 1][0]) return -0.345;
    for (let i = 1; i < HALF.length; i++) if (d <= HALF[i][0]) { const t = (d - HALF[i - 1][0]) / (HALF[i][0] - HALF[i - 1][0]); return HALF[i - 1][1] + (HALF[i][1] - HALF[i - 1][1]) * t; }
    return -0.02;
  };
  {
    const rowNoise = (x) => 1 + 0.05 * Math.sin(x * 0.21 + 1.3) + 0.04 * Math.sin(x * 0.57) + 0.03 * Math.sin(x * 1.31 + 0.4);
    for (let cx = -440; cx < X1; cx += 40) {
      const x0 = Math.max(X0, cx), x1 = Math.min(X1, cx + 40); if (x1 <= x0) continue;
      const xs = []; for (let x = x0; x < x1 - 1e-6; x += 4) xs.push(x); xs.push(x1);
      const pos = [], col = [], uv = [], idx = [];
      const nz = PZ.length;
      for (const x of xs) {
        const rn = rowNoise(x);
        for (const [z, y, c] of PZ) {
          pos.push(x, y, z); uv.push(x / 1.7, -z / 1.7);
          const k = rn * (1 + 0.04 * Math.sin(x * 0.9 + z * 3.1));
          col.push(c[0] * k, c[1] * k, c[2] * k);
        }
      }
      for (let i = 0; i < xs.length - 1; i++) for (let j = 0; j < nz - 1; j++) {
        const a = i * nz + j, b = a + 1, c = a + nz, d = c + 1;
        idx.push(a, b, d, a, d, c);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      g.setIndex(idx);
      g.computeVertexNormals();
      // make sure triangles face up
      const m = new THREE.Mesh(g, M.ballast); m.receiveShadow = true; m.castShadow = false;
      root.add(m);
    }
  }

  // ------------------------------------------------ crossover centreline
  const XL = xb - xa;
  const zc = (x) => zA + (zB - zA) * smoother((x - xa) / XL);
  const zcSlope = (x) => { const t = (x - xa) / XL; if (t <= 0 || t >= 1) return 0; return (zB - zA) / XL * 30 * t * t * (1 - t) * (1 - t); };
  const sec = (x) => Math.sqrt(1 + zcSlope(x) ** 2);
  const XsZ = (x) => zc(x) + HG * sec(x), XnZ = (x) => zc(x) - HG * sec(x);
  E.xo.zc = zc; E.xo.XsZ = XsZ; E.xo.XnZ = XnZ;
  const hsStart = (x) => 0.3 + 0.7 * smooth01((x - xa) / 4.5);
  const hsEnd = (x) => 0.3 + 0.7 * smooth01((xb - x) / 4.5);
  const off = (hs) => 0.0325 * (1 + hs);

  const RAILS = [
    { id: 'Sa', track: 'A', x0: X0, x1: X1, zf: () => SaZ },
    { id: 'Nb', track: 'B', x0: X0, x1: X1, zf: () => NbZ },
    { id: 'NaW-Xn', track: 'A', x0: X0, x1: xb, zf: (x) => (x <= xa ? NaZ : Math.max(XnZ(x), NbZ + off(hsEnd(x)))), hs: (x) => (x > xb - 5 ? hsEnd(x) : 1), curved: true, capEnd: true },
    { id: 'NaE', track: 'A', x0: xa, x1: X1, zf: (x) => Math.max(NaZ, XnZ(x) + off(hsStart(x))), hs: (x) => (x < xa + 5 ? hsStart(x) : 1), curved: true, capStart: true },
    { id: 'Xs-SbE', track: 'B', x0: xa, x1: X1, zf: (x) => (x >= xb ? SbZ : Math.min(XsZ(x), SaZ - off(hsStart(x)))), hs: (x) => (x < xa + 5 ? hsStart(x) : 1), curved: true, capStart: true },
    { id: 'SbW', track: 'B', x0: X0, x1: xb, zf: (x) => (x < xa ? SbZ : Math.min(SbZ, XsZ(x) - off(hsEnd(x)))), hs: (x) => (x > xb - 5 ? hsEnd(x) : 1), curved: true, capEnd: true },
  ];
  out.rails = RAILS;
  const railsAt = (x) => RAILS.filter(R => x >= R.x0 && x <= R.x1).map(R => ({ id: R.id, z: R.zf(x) }));
  out.railsAt = railsAt;

  // frogs
  const solve = (f, lo, hi) => { for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (f(lo) * f(m) <= 0) hi = m; else lo = m; } return (lo + hi) / 2; };
  const xf1 = solve((x) => XsZ(x) - NaZ, xa + 1, xb - 1);
  const xf2 = solve((x) => XnZ(x) - SbZ, xa + 1, xb - 1);
  out.frogs = [{ x: xf1, z: NaZ, slope: zcSlope(xf1) }, { x: xf2, z: SbZ, slope: zcSlope(xf2) }];

  // check rails (guard rails opposite the frogs), flared ends
  const flare = (x, xc, len) => { const d = Math.abs(x - xc) - (len / 2 - 0.6); return d > 0 ? 0.045 * (d / 0.6) ** 1.5 : 0; };
  const CO = 0.107, CL = 4.6;
  const CHECKS = [
    { xc: xf1, zf: (x) => SaZ - CO - flare(x, xf1, CL) },
    { xc: xf1, zf: (x) => XnZ(x) + CO + flare(x, xf1, CL) },
    { xc: xf2, zf: (x) => NbZ + CO + flare(x, xf2, CL) },
    { xc: xf2, zf: (x) => XsZ(x) - CO - flare(x, xf2, CL) },
  ];

  // ------------------------------------------------ rail meshes
  const addRailPath = (path, hs, caps) => {
    const { side, top, head } = railGeo(path, hs, caps);
    const ms = new THREE.Mesh(side, M.railSide), mt = new THREE.Mesh(top, M.railTop), mh = new THREE.Mesh(head, M.railHead);
    ms.castShadow = true; ms.receiveShadow = true; mh.castShadow = true; mh.receiveShadow = true; mt.castShadow = false; mt.receiveShadow = true;
    root.add(ms); root.add(mt); root.add(mh);
  };
  for (const R of RAILS) {
    const cuts = new Set([R.x0, R.x1]);
    for (let x = Math.ceil(R.x0 / 20) * 20; x < R.x1; x += 20) cuts.add(x);
    if (R.curved) { cuts.add(xa); cuts.add(xb); }
    const xsCut = [...cuts].filter(x => x >= R.x0 && x <= R.x1).sort((a, b) => a - b);
    for (let i = 0; i < xsCut.length - 1; i++) {
      const a = xsCut[i], b = xsCut[i + 1];
      const curvedHere = R.curved && b > xa - 0.01 && a < xb + 0.01;
      const xs = [a];
      if (curvedHere) { const n = Math.max(1, Math.ceil((b - a) / 0.6)); for (let k = 1; k < n; k++) xs.push(a + (b - a) * k / n); }
      xs.push(b);
      const path = xs.map(x => [x, R.zf(x)]);
      addRailPath(path, R.hs && curvedHere ? R.hs : null, [R.capStart && a === R.x0, R.capEnd && b === R.x1]);
    }
  }
  for (const C of CHECKS) {
    const xs = []; for (let k = 0; k <= 16; k++) xs.push(C.xc - CL / 2 + CL * k / 16);
    addRailPath(xs.map(x => [x, C.zf(x)]), null, [true, true]);
  }
  // frog castings (dark manganese crossings, rails run over them)
  for (const F of out.frogs) {
    const ang = Math.atan(F.slope) / 2;
    const k = ctx.kit(root);
    const b = k.box(3.2, 0.13, 0.34, M.frog, [F.x, 0.075, F.z + Math.tan(ang) * 0.0], [0, -ang, 0]);
    b.castShadow = true;
    k.box(3.6, 0.018, 0.5, M.plate, [F.x, 0.006, F.z], [0, -ang, 0]);
  }

  // ------------------------------------------------ sleepers & turnout ties
  const SP = 0.625;
  const TX0 = xa - 4.4, TX1 = xb + 4.4, TSP = 0.6;
  const pcProb = (x) => { if (x >= -45 && x <= 150) return 0.975; if (x < -45) return Math.max(0, 1 - (-45 - x) / 16); return Math.max(0, 1 - (x - 150) / 16); };
  const pcItems = [], woodItems = [];
  const clipItems = [], plateItems = [], plateLite = [];
  const WOOD_COLS = ['#8b7462', '#7c6655', '#957e69', '#76655a', '#8f8274', '#6f5b4d'];
  const PC_COLS = ['#cfccc3', '#c6c3bb', '#d6d3ca', '#bfbdb6', '#cbc6b8', '#c2c2ba'];
  const lists = { A: [], B: [] };
  for (const [tid, zT, x00] of [['A', zA, X0 + 0.3125], ['B', zB, X0 + 0.625]]) {
    for (let x = x00; x < X1 - 0.1; x += SP) {
      if (x > TX0 - 0.3 && x < TX1 + 0.3) continue;
      const jx = x + (r() - 0.5) * 0.03, jr = (r() - 0.5) * 0.02;
      const isPC = r() < pcProb(x);
      lists[tid].push(jx);
      if (isPC) {
        pcItems.push({ x: jx, y: 0, z: zT, ry: jr, c: PC_COLS[Math.floor(r() * PC_COLS.length)] });
        for (const rz of [zT - HG, zT + HG]) for (const s of [0, Math.PI]) clipItems.push({ x: jx, y: 0, z: rz, ry: s + jr });
      } else {
        woodItems.push({ x: jx, y: 0, z: zT, ry: jr, sz: 2.1 + (r() - 0.5) * 0.06, c: WOOD_COLS[Math.floor(r() * WOOD_COLS.length)] });
        if (Math.abs(x) < 130) for (const rz of [zT - HG, zT + HG]) plateItems.push({ x: jx, y: 0, z: rz, ry: jr + (r() < 0.5 ? 0 : Math.PI) });
        else if (Math.abs(x) < 260) for (const rz of [zT - HG, zT + HG]) plateLite.push({ x: jx, y: 0, z: rz, ry: jr });
      }
    }
  }
  out.sleeperLists = { A: { x0: X0 + 0.3125, list: lists.A }, B: { x0: X0 + 0.625, list: lists.B } };
  // turnout ties: shared long timbers spanning every rail present at that x
  for (let x = TX0; x <= TX1 + 1e-6; x += TSP) {
    const zs = railsAt(x).map(o => o.z);
    for (const C of CHECKS) if (Math.abs(x - C.xc) < CL / 2) zs.push(C.zf(x));
    zs.sort((a, b) => a - b);
    const groups = []; let g0 = zs[0], g1 = zs[0];
    for (let i = 1; i < zs.length; i++) { if (zs[i] - g1 > 1.5) { groups.push([g0, g1]); g0 = zs[i]; } g1 = zs[i]; }
    groups.push([g0, g1]);
    for (const [a, b] of groups) {
      const zlo = a - 0.43 - 0.0, zhi = b + 0.43;
      // symmetric-ish around a nominal track so ends look tidy
      const c = WOOD_COLS[Math.floor(r() * WOOD_COLS.length)];
      woodItems.push({ x, y: 0, z: (zlo + zhi) / 2, ry: 0, sz: zhi - zlo, sx: 1.06, c });
      out.ties.push({ x, z0: zlo, z1: zhi });
    }
    for (const zr of zs) plateItems.push({ x, y: 0, z: zr, ry: r() < 0.5 ? 0 : Math.PI });
  }
  const pcGeo = taperedBox(2.0, 0.2, 0.26, 0.17);
  const woodGeo = boxGeo(0.21, 0.145, 1, 0, -0.0725, 0, true);
  // wood uv: map u along the length
  {
    const uvA = woodGeo.attributes.uv, pA = woodGeo.attributes.position, nA = woodGeo.attributes.normal;
    for (let i = 0; i < uvA.count; i++) {
      const z = pA.getZ(i) + 0.5, ny = Math.abs(nA.getY(i)), nx = Math.abs(nA.getX(i));
      const v = ny > 0.5 ? (pA.getX(i) / 0.21 + 0.5) : nx > 0.5 ? (pA.getY(i) / 0.145 + 1) * 0.5 : 0.5 + pA.getX(i) / 0.21 * 0.8;
      uvA.setXY(i, Math.abs(nA.getZ(i)) > 0.5 ? (z > 0.5 ? 1 : 0) : z, v);
    }
  }
  const pcM = makeInstanced(pcGeo, M.pc, pcItems, { colors: true });
  const woodM = makeInstanced(woodGeo, M.wood, woodItems, { colors: true });
  if (pcM) { pcM.name = 'rw-pc-sleepers'; root.add(pcM); }
  if (woodM) { woodM.name = 'rw-wood-sleepers'; root.add(woodM); }

  // fasteners: PC double elastic clip (spring + bolt), wooden tie plate + dog spikes
  const clipGeo = mergeGeometries([boxGeo(0.07, 0.022, 0.056, 0, 0.021, 0.082, true), boxGeo(0.032, 0.04, 0.032, 0, 0.02, 0.114, true)]);
  const plateGeo = mergeGeometries([boxGeo(0.17, 0.014, 0.32, 0, 0.003, 0, true), boxGeo(0.022, 0.03, 0.03, 0.045, 0.02, 0.082, true), boxGeo(0.022, 0.03, 0.03, -0.045, 0.02, -0.082, true)]);
  const plateLiteGeo = boxGeo(0.17, 0.014, 0.3, 0, 0.003, 0, true);
  for (const [geo, items, m, nm] of [[clipGeo, clipItems, M.clip, 'rw-clips'], [plateGeo, plateItems, M.plate, 'rw-plates'], [plateLiteGeo, plateLite, M.plate, 'rw-plates-lite']]) {
    const im = makeInstanced(geo, m, items, { shadow: false }); if (im) { im.name = nm; root.add(im); }
  }

  // ------------------------------------------------ fishplate joints (every 25 m, both rails, both sides) + bolts
  const fishItems = [], boltItems = [];
  for (const [zT, j0] of [[zA, X0], [zB, X0 + 12.8125]]) {
    for (let x = j0 + 25; x < X1 - 1; x += 25) {
      if (x > TX0 - 3 && x < TX1 + 3) continue;
      for (const rz of [zT - HG, zT + HG]) {
        for (const s of [-1, 1]) {
          fishItems.push({ x, y: 0.072, z: rz + s * 0.019 });
          if (Math.abs(x) < 230) for (const bx of [-0.2, -0.07, 0.07, 0.2]) boltItems.push({ x: x + bx, y: 0.07, z: rz + s * 0.04, rx: Math.PI / 2, ry: 0 });
        }
      }
    }
  }
  const fishGeo = boxGeo(0.58, 0.062, 0.016, 0, 0, 0, true);
  const boltGeo = new THREE.CylinderGeometry(0.014, 0.014, 0.024, 6, 1);
  for (const [geo, items, m, nm] of [[fishGeo, fishItems, M.steel, 'rw-fishplates'], [boltGeo, boltItems, M.clip, 'rw-bolts']]) {
    const im = makeInstanced(geo, m, items, { shadow: false }); if (im) { im.name = nm; root.add(im); }
  }

  // ------------------------------------------------ turnout equipment: point machines, rods, switch indicators
  {
    const k = ctx.kit(root);
    const machine = (x, zMachine, zFar, dir /* +1 south side, -1 north side */, rodX) => {
      // concrete pad, machine box, top cover, label face
      k.boxB(1.2, 0.42, 0.7, M.concrete, [x, -0.5, zMachine]);
      k.rbox(0.95, 0.3, 0.46, 0.04, M.pm, [x, 0.07, zMachine]);
      k.box(0.9, 0.05, 0.4, M.pm, [x, 0.245, zMachine]);
      T.signMesh(k, T.sign.pm, 0.9, 0.24, [x, 0.08, zMachine - dir * 0.232], [0, dir > 0 ? Math.PI : 0, 0]);
      // throw rod + detector rod under the rails to the switch rails
      const zr0 = zMachine - dir * 0.22, len = Math.abs(zFar - zr0);
      for (const [dx, h] of [[0, 0.028], [0.12, 0.022]]) k.box(0.035, h, len, M.steel, [rodX + dx, 0.0, (zr0 + zFar) / 2]);
      // crank housing
      k.box(0.18, 0.1, 0.18, M.steel, [rodX + 0.06, 0.03, zMachine - dir * 0.3]);
    };
    machine(xa + 0.55, SaZ + 1.08, NaZ + 0.05, 1, xa + 0.5);
    machine(xb - 0.55, NbZ - 1.08, SbZ - 0.05, -1, xb - 0.1);
    // switch indicators (転てつ器標識): short post + black box with a white bar
    for (const [x, z, face] of [[xa - 0.9, SaZ + 1.15, Math.PI / 2], [xb + 0.9, NbZ - 1.15, -Math.PI / 2]]) {
      k.boxB(0.3, 0.36, 0.3, M.concrete, [x, -0.5, z]);
      k.cyl(0.028, 0.028, 0.75, M.pm, [x, 0.2, z], null, 8);
      const g = k.group([x, 0.66, z], face);
      const kk = ctx.kit(g);
      kk.cyl(0.1, 0.1, 0.12, M.black, [0, 0, 0], [Math.PI / 2, 0, 0], 16);
      kk.cyl(0.082, 0.082, 0.01, M.white, [0, 0, 0.062], [Math.PI / 2, 0, 0], 16);
      kk.box(0.13, 0.03, 0.01, M.black, [0, 0, 0.068]);
    }
  }

  // ------------------------------------------------ ATS transponders (地上子) between the rails
  {
    const k = ctx.kit(root);
    const at = (x, zT) => {
      k.box(0.5, 0.07, 0.26, M.ats, [x, 0.035, zT]);
      k.box(0.44, 0.012, 0.2, M.atsDark, [x, 0.076, zT]);
      for (const s of [-1, 1]) k.box(0.05, 0.02, 0.36, M.steel, [x + s * 0.2, 0.01, zT]);
    };
    at(-2.4, zA); at(16.0, zA); at(147, zA);
    at(41.8, zB); at(18.0, zB); at(-167, zB);
  }

  // ------------------------------------------------ sleeper lookup (for stones / weeds)
  const onSleeper = (x, z, pad = 0.04) => {
    if (x > TX0 - 0.4 && x < TX1 + 0.4) {
      const kx = Math.round((x - TX0) / TSP), tx = TX0 + kx * TSP;
      if (Math.abs(x - tx) < 0.11 + pad) {
        for (const t of out.ties) if (Math.abs(t.x - tx) < 0.01 && z > t.z0 - pad && z < t.z1 + pad) return true;
      }
      if (x > TX0 && x < TX1) return false;
    }
    for (const [tid, zT] of [['A', zA], ['B', zB]]) {
      if (Math.abs(z - zT) > 1.0 + pad) continue;
      const L0 = out.sleeperLists[tid];
      const kx = Math.round((x - L0.x0) / SP), sx = L0.x0 + kx * SP;
      if (Math.abs(x - sx) < 0.13 + pad) return true;
    }
    return false;
  };
  out.onSleeper = onSleeper;
  const nearRail = (x, z, pad = 0.085) => { for (const o of railsAt(x)) if (Math.abs(z - o.z) < pad) return true; return false; };
  out.nearRail = nearRail;

  // ------------------------------------------------ instanced ballast stones
  {
    const rs = ctx.rng('rw-stones');
    const STONE_COLS = [['#8a8781', 24], ['#7c7975', 18], ['#6d6a66', 14], ['#958f86', 10], ['#86766a', 12], ['#9c8e80', 6], ['#aea99f', 5], ['#7a7e85', 6], ['#67615b', 3]];
    const pickC = () => { let s = 0; for (const c of STONE_COLS) s += c[1]; let v = rs() * s; for (const c of STONE_COLS) { v -= c[1]; if (v <= 0) return c[0]; } return STONE_COLS[0][0]; };
    const octItems = [], tetItems = [];
    const density = (x) => {
      if (x > -17.2 && x < -6.8) return 0;
      if (x > 45.8 && x < 48.7) return 0;
      if (x > -62 && x < 102) return 1;
      if (x > -135 && x < 165) return 0.28;
      return 0;
    };
    const place = (x, z, big) => {
      const rad = (big ? 0.032 : 0.024) + rs() * rs() * 0.03;
      const y = E.ballastY(z);
      const it = { x, y: y - rad * 0.12, z, rx: (rs() - 0.5) * 0.5, ry: rs() * 6.28, rz: (rs() - 0.5) * 0.5, sx: rad * (0.9 + rs() * 0.6), sy: rad * (0.42 + rs() * 0.22), sz: rad * (0.9 + rs() * 0.6), c: pickC() };
      (rs() < 0.8 ? octItems : tetItems).push(it);
    };
    // bands: [dMin, dMax, per m²]
    const BANDS = [[0.0, 1.0, 11], [1.0, 3.0, 8], [3.0, 3.95, 15]];
    for (let x = -140; x < 170; x += 1) {
      const dens = density(x + 0.5); if (!dens) continue;
      for (const [d0, d1, pm] of BANDS) {
        for (const s of [-1, 1]) {
          const n = Math.round(pm * (d1 - d0) * dens * (0.8 + rs() * 0.4));
          for (let i = 0; i < n; i++) {
            const px = x + rs(), d = d0 + (d1 - d0) * rs(), pz = -43 + s * d;
            if (onSleeper(px, pz, 0.035) || nearRail(px, pz)) continue;
            // no stones under the platforms' faces (hidden) — keep them for the track area only there
            if (px > -7 && px < 46 && d > 3.45) continue;
            place(px, pz, d > 3.0);
          }
        }
      }
    }
    // chunky pebbles with flattened tops; normals bent upward so stones read as soft painted lumps
    const soften = (g) => { g = g.toNonIndexed(); g.computeVertexNormals(); const n = g.attributes.normal, p = g.attributes.position; for (let i = 0; i < n.count; i++) { if (p.getY(i) > 0.5) p.setY(i, 0.62); const v = new THREE.Vector3(n.getX(i), n.getY(i) * 0.6 + 0.9, n.getZ(i)).normalize(); n.setXYZ(i, v.x, v.y, v.z); } return g; };
    const oct = soften(new THREE.OctahedronGeometry(1, 0));
    const tet = soften(new THREE.OctahedronGeometry(1, 0).scale(1.35, 0.8, 0.85));
    for (const [geo, items, nm] of [[oct, octItems, 'rw-stones-oct'], [tet, tetItems, 'rw-stones-tet']]) {
      const im = makeInstanced(geo, M.stone, items, { shadow: false, colors: true });
      if (im) { im.name = nm; ctx.noOutline(im); root.add(im); }
    }
    out.stoneCount = octItems.length + tetItems.length;
  }
  out.TX0 = TX0; out.TX1 = TX1;
  return out;
}
