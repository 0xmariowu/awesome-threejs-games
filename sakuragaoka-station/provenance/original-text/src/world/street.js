// ============================================================================
//  street — all road surfaces (R1 main street, R2, R3, R4, R6 + junction fillets),
//  R1 curbed sidewalks with corner ramps & tactile paving, L-gutters, U-ditches with
//  lids / gratings / open water, road markings & road text, manholes, lids, repair
//  patches, stains, spray marks, standalone sign posts, convex mirrors, guardrails,
//  cones at a repair site. Publishes ctx.services.street = { edges, gutters }.
// ============================================================================
import * as THREE from 'three';
import { MeshBuilder, grid, resample, pointAt, UP } from './street/mesh.js';
import { makeStreetTextures, GLYPH, UTIL, SIGN, uvOf } from './street/textures.js';
import { buildFurniture } from './street/furniture.js';
import { DitchBuilder, ditchMaterial } from './street/ditch.js';

const LIFT = 0.02;      // road surface above terrain
const ATILE = 4.0;      // asphalt canvas tile (m): texels stay below a screen pixel in close-ups
const CURB_H = 0.13;    // curb face height above the road surface
const TAU = Math.PI * 2;

export async function build(ctx) {
  const { L, mat, physics } = ctx;
  const H = L.heightAt, cX = L.streetCenterX, sX = L.streetSlopeX;
  const smooth = L.smoothstep, lerp = L.lerp;
  const root = new THREE.Group(); root.name = 'street'; ctx.addStatic(root);
  const T = makeStreetTextures(ctx);

  // ------------------------------------------------------------------ frames & heights
  // R2 north end: the environment's levee stairs sit on R2's axis — the road stops at the stair foot
  const r2Stair = (ctx.services.environment?.levee?.stairs || []).find(st => Math.abs(st.x - L.ROADS.R2.x) < 3);
  const R2N = r2Stair ? Math.max(-84.2, r2Stair.z1 - 0.3) : -83.8;
  const liftAt = (x, z) => LIFT + 0.04 * smooth(-83.3, -85.3, z); // extra lift if R2 ever reaches the levee slope
  const roadY = (x, z) => H(x, z) + liftAt(x, z);
  /** R1: point at centreline z `zc`, signed lateral offset o (east +). */
  const r1 = (zc, o) => { const sx = sX(zc), len = Math.hypot(sx, 1); return [cX(zc) + o / len, zc - o * sx / len]; };
  /** R1 unit tangent pointing north at zc. */
  const r1T = (zc) => { const sx = sX(zc), len = Math.hypot(sx, 1); return [-sx / len, -1 / len]; };
  const r1N = (zc) => { const sx = sX(zc), len = Math.hypot(sx, 1); return [1 / len, -sx / len]; }; // east normal
  const range = (a, b, step) => { const n = Math.max(1, Math.round(Math.abs(b - a) / step)); return Array.from({ length: n + 1 }, (_, i) => a + (b - a) * i / n); };
  const cat = (...rs) => { const out = []; for (const r of rs) for (const v of r) if (!out.length || Math.abs(v - out[out.length - 1]) > 1e-6) out.push(v); return out; };
  const mirrorList = (half) => [...half.slice(1).reverse().map(v => -v), ...half];
  const colOf = (hex) => { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; };

  // ------------------------------------------------------------------ materials
  const M = {
    asphalt: mat.toon('#ffffff', { map: T.asphalt, vertexColors: true, paint: 0.03 }),
    pavers: mat.toon('#ffffff', { map: T.pavers, paint: 0.035 }),
    curb: mat.toon('#ffffff', { map: T.curb, paint: 0.03 }),
    lgutter: mat.toon('#ffffff', { map: T.lgutter, paint: 0.03, polygonOffset: -1 }),
    lid: mat.toon('#ffffff', { map: T.lid, paint: 0.04 }),
    grate: mat.toon('#ffffff', { map: T.grate, alphaTest: 0.5, side: 'double', paint: 0 }),
    dots: mat.toon('#ffffff', { map: T.dots, paint: 0.02, polygonOffset: -1 }),
    bars: mat.toon('#ffffff', { map: T.bars, paint: 0.02, polygonOffset: -1 }),
    line: mat.decal('#ffffff', { map: T.line, vertexColors: true }),
    paint: mat.decal('#ffffff', { map: T.paint, vertexColors: true }),
    glyph: mat.decal('#ffffff', { map: T.glyphs, vertexColors: true }),
    util: mat.decal('#ffffff', { map: T.util }),
  };

  const F = buildFurniture(ctx, root, T, { baseLift: (x, z) => 0 });
  const VC = F.materials.VC;
  /** paint every vertex of a MeshBuilder(true) one colour */
  const solid = (B, hex) => { const c = new THREE.Color(hex); for (let i = 0; i < B.n; i++) { B.col[i * 3] = c.r; B.col[i * 3 + 1] = c.g; B.col[i * 3 + 2] = c.b; } return B; };
  const add = (b, material, o = {}) => {
    if (b.empty) return null;
    const m = b.mesh(material, o); root.add(m);
    if (o.noOutline) ctx.noOutline(m);
    return m;
  };

  // ------------------------------------------------------------------ tone (vertex colour) helpers
  const hr = (a, b) => { const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return x - Math.floor(x); };
  const section = (seed, s, len = 30) => { const q = s / len, k = Math.floor(q), f = q - k; const va = 0.955 + 0.09 * hr(seed, k), vb = 0.955 + 0.09 * hr(seed, k + 1); return lerp(va, vb, smooth(0.93, 1.0, f)); };
  const bump = (a, c, w) => Math.max(0, 1 - Math.abs(a - c) / w);
  const prof2 = (o) => { const a = Math.abs(o); return 1 + 0.085 * bump(a, 0.58, 0.3) + 0.085 * bump(a, 2.08, 0.3) - 0.04 * bump(a, 1.33, 0.25) - 0.02 * bump(a, 0, 0.3); };
  const prof1 = (o) => { const a = Math.abs(o); return 1 + 0.06 * bump(a, 0.8, 0.3) - 0.03 * bump(a, 0, 0.3); };
  const grime = (a, hw, on) => (on ? 1 - 0.075 * smooth(hw - 0.35, hw, a) : 1);
  const tone3 = (m) => [m, m * 0.998, m * 1.008];
  const inR = (v, a, b) => v >= a && v <= b;

  const r3Tone = (x, o) => {
    const mouth = (o > 0 && Math.abs(x) < 5.25) || (o < 0 && inR(x, -17.3, -9.2));
    return prof2(o) * grime(Math.abs(o), 3.0, !mouth) * section(23, x, 36) * 1.02;
  };
  const r1Tone = (zc, o) => {
    const a = Math.abs(o);
    let m = a <= 2.6 ? prof2(o) : a <= 3.0 ? 0.955 : 0.985 - 0.07 * smooth(4.2, 4.6, a);
    m *= section(11, zc, 34);
    if (o < 0 && o > -2.6) m *= 1 - 0.045 * smooth(13, 4, zc) * bump(a, 1.33, 0.7); // braking zone darkening
    return m;
  };
  const r2Mouth = (z) => z > -7.6 || inR(z, -59.6, -52.2) || inR(z, -74.1, -67.9);
  const r2Tone = (z, o) => prof1(o) * grime(Math.abs(o), 2.75, !r2Mouth(z)) * section(37, z, 30) * 1.03;
  const r2Edge = (z) => section(37, z, 30) * 1.03;
  const laneTone = (seed, base, hw) => (x, o, x0, x1) => {
    let m = prof1(o) * grime(Math.abs(o), hw, true) * section(seed, x, 40) * base;
    return m;
  };

  // ================================================================== ROAD SURFACES
  const roadB = new MeshBuilder(true);
  const surf = (rows, lats, pos, tone) => grid(roadB, rows.length, lats.length, (i, j) => {
    const s = rows[i], o = lats[j]; const [x, z] = pos(s, o); const m = tone(x, z, s, o);
    return { x, y: roadY(x, z), z, u: x / ATILE, v: -z / ATILE, c: tone3(m) };
  });
  const R1_HALF = [0, 0.3, 0.58, 0.86, 1.33, 1.8, 2.08, 2.36, 2.6, 2.72, 3.0, 3.8, 4.6];
  const R1_LAT = mirrorList(R1_HALF);
  const R1A_LAT = R1_LAT.filter(o => Math.abs(o) <= 3.0 + 1e-6);
  const R3_LAT = mirrorList([0, 0.3, 0.58, 0.86, 1.33, 1.8, 2.08, 2.36, 2.72, 3.0]);
  const R2_LAT = mirrorList([0, 0.5, 0.8, 1.1, 1.8, 2.4, 2.75]);
  const R4_LAT = mirrorList([0, 0.5, 0.8, 1.1, 1.65, 2.0]);
  const R6_LAT = mirrorList([0, 0.5, 0.8, 1.1, 1.5]);
  // R1 (main street) — junction mouth piece (|o|<=3) then the full-width piece (lanes + shoulders)
  surf(range(1.0, 3.2, 0.44), R1A_LAT, (zc, o) => r1(zc, o), (x, z, zc, o) => lerp(r3Tone(x, 3.0), r1Tone(zc, o), smooth(1.0, 3.2, zc)));
  surf(cat(range(3.2, 12, 0.4), range(12, 130, 1.0)), R1_LAT, (zc, o) => r1(zc, o), (x, z, zc, o) => r1Tone(zc, o));
  // R3 (E-W, z -5..1)
  surf(cat(range(-95, -30, 2), range(-30, 30, 1), range(30, 95, 2)), R3_LAT, (x, o) => [x, -2 + o], (x, z, s, o) => r3Tone(x, o));
  // R2 (N-S, x -14.75..-9.25), skipping the crossing deck z -47.6..-38.4
  const r2T = (x, z, s, o) => lerp(r2Tone(z, o), r3Tone(x, -3.0), smooth(-7.2, -5.0, z));
  surf(cat(range(R2N, -83, 0.4), range(-83, -53, 1), range(-53, -47.6, 0.3)), R2_LAT, (z, o) => [-12 + o, z], r2T);
  surf(cat(range(-38.4, -33, 0.3), range(-33, -5, 1)), R2_LAT, (z, o) => [-12 + o, z], r2T);
  // R4 / R6 (split at R2)
  const r4Base = laneTone(41, 1.1, 2.0), r6Base = laneTone(43, 1.13, 1.5);
  const sideBlend = (base) => (x, z, s, o) => {
    const m = base(x, o);
    const w = x < -12 ? smooth(-16.8, -14.75, x) : smooth(-7.2, -9.25, x);
    return lerp(m, r2Edge(z), w);
  };
  surf(cat(range(-95, -30, 2), range(-30, -14.75, 1)), R4_LAT, (x, o) => [x, -55.5 + o], sideBlend(r4Base));
  surf(cat(range(-9.25, 30, 1), range(30, 95, 2)), R4_LAT, (x, o) => [x, -55.5 + o], sideBlend(r4Base));
  surf(cat(range(-85, -30, 2), range(-30, -14.75, 1)), R6_LAT, (x, o) => [x, -71 + o], sideBlend(r6Base));
  surf(cat(range(-9.25, 30, 1), range(30, 85, 2)), R6_LAT, (x, o) => [x, -71 + o], sideBlend(r6Base));
  // junction corner fillets
  const FILLETS = [
    { K: [-14.75, -5], e1: [0, -1], e2: [-1, 0], r: 2.5 },
    { K: [-14.75, -57.5], e1: [0, -1], e2: [-1, 0], r: 2.0 }, { K: [-9.25, -57.5], e1: [0, -1], e2: [1, 0], r: 2.0 },
    { K: [-14.75, -53.5], e1: [0, 1], e2: [-1, 0], r: 1.2 }, { K: [-9.25, -53.5], e1: [0, 1], e2: [1, 0], r: 1.2 },
    { K: [-14.75, -72.5], e1: [0, -1], e2: [-1, 0], r: 1.5 }, { K: [-9.25, -72.5], e1: [0, -1], e2: [1, 0], r: 1.5 },
    { K: [-14.75, -69.5], e1: [0, 1], e2: [-1, 0], r: 1.5 }, { K: [-9.25, -69.5], e1: [0, 1], e2: [1, 0], r: 1.5 },
    { K: [-3, 1], e1: [0, 1], e2: [-1, 0], r: 2.2, r1: true }, { K: [3, 1], e1: [0, 1], e2: [1, 0], r: 2.2, r1: true },
  ];
  const filletArc = (f, n = 12) => {
    const C = [f.K[0] + f.r * (f.e1[0] + f.e2[0]), f.K[1] + f.r * (f.e1[1] + f.e2[1])];
    const a1 = Math.atan2(-f.e2[1], -f.e2[0]), a2 = Math.atan2(-f.e1[1], -f.e1[0]); // from C toward T1 (= -e2 dir) and T2 (= -e1 dir)
    let d = a2 - a1; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU;
    return { C, pts: Array.from({ length: n + 1 }, (_, i) => { const a = a1 + d * i / n; return [C[0] + f.r * Math.cos(a), C[1] + f.r * Math.sin(a)]; }) };
  };
  for (const f of FILLETS) {
    const { pts } = filletArc(f);
    const kIdx = roadB.vert(f.K[0], roadY(f.K[0], f.K[1]), f.K[1], f.K[0] / ATILE, -f.K[1] / ATILE, UP, tone3(1.0));
    const ring = (fr, m) => pts.map(([x, z]) => { const X = f.K[0] + (x - f.K[0]) * fr, Z = f.K[1] + (z - f.K[1]) * fr; return roadB.vert(X, roadY(X, Z), Z, X / ATILE, -Z / ATILE, UP, tone3(m)); });
    const mid = ring(0.5, 0.985), out = ring(1.0, 0.94);
    for (let i = 0; i < pts.length - 1; i++) { roadB.tri(kIdx, mid[i], mid[i + 1]); roadB.quad(mid[i], out[i], out[i + 1], mid[i + 1]); }
  }
  add(roadB, M.asphalt, { computeNormals: true, name: 'street-asphalt' });

  // ================================================================== DECAL BUILDERS
  const lineB = new MeshBuilder(true), paintB = new MeshBuilder(true), glyphB = new MeshBuilder(true), utilB = new MeshBuilder(false), utilTopB = new MeshBuilder(false);
  const C_WHITE = colOf('#e7e5de'), C_ORANGE = colOf('#e59b3c'), C_YELLOW = colOf('#e4c14a'), C_GREEN = colOf('#86b494');
  const LINE_LIFT = 0.006, GLYPH_LIFT = 0.007, UTIL_LIFT = 0.004;
  /** ribbon along a 2D polyline */
  function strip(B, pts, w, col, lift = LINE_LIFT, hFn = roadY, tile = 0.8) {
    const rs = resample(pts, 0.8);
    let prev = null;
    for (const p of rs) {
      const nx = -p.tz, nz = p.tx;
      const ax = p.x + nx * w / 2, az = p.z + nz * w / 2, bx = p.x - nx * w / 2, bz = p.z - nz * w / 2;
      const a = B.vert(ax, hFn(ax, az) + lift, az, p.s / tile, w / tile, UP, col), b = B.vert(bx, hFn(bx, bz) + lift, bz, p.s / tile, 0, UP, col);
      if (prev) B.quad(prev[0], prev[1], b, a);
      prev = [a, b];
    }
  }
  /** flat quad decal: centre, width (driver's left-right), length (along dir); canvas top points along dir */
  function quad(B, cell, cx, cz, w, l, dir, lift, col = null, hFn = roadY) {
    const dl = Math.hypot(dir[0], dir[1]); const dx = dir[0] / dl, dz = dir[1] / dl; const rx = -dz, rz = dx;
    const n = Math.max(1, Math.ceil(l / 1.0)), m = Math.max(1, Math.ceil(w / 1.5));
    const rows = [];
    for (let i = 0; i <= n; i++) {
      const lv = -l / 2 + l * i / n; const row = [];
      for (let j = 0; j <= m; j++) {
        const lu = -w / 2 + w * j / m;
        const x = cx + rx * lu + dx * lv, z = cz + rz * lu + dz * lv; const [u, v] = uvOf(cell, lu / w + 0.5, lv / l + 0.5);
        row.push(B.vert(x, hFn(x, z) + lift, z, u, v, UP, col));
      }
      rows.push(row);
    }
    for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) B.quad(rows[i][j], rows[i][j + 1], rows[i + 1][j + 1], rows[i + 1][j]);
  }
  const r1Path = (o, z0, z1, step = 1.0) => range(z0, z1, step).map(zc => r1(zc, o));
  const dashes = (fnPts, a, b, dash, gap, w, col) => { for (let s = a; s < b - 0.2; s += dash + gap) strip(lineB, fnPts(s, Math.min(b, s + dash)), w, col); };
  const northDir = (zc) => r1T(zc), southDir = (zc) => { const t = r1T(zc); return [-t[0], -t[1]]; };
  const r1Glyph = (cell, zc, o, w, l, dirSign, col = C_WHITE) => { const [x, z] = r1(zc, o); quad(glyphB, cell, x, z, w, l, dirSign < 0 ? northDir(zc) : southDir(zc), GLYPH_LIFT, col); };
  const r1Util = (cell, zc, o, w, l, dirSign = -1, lift = UTIL_LIFT, B = utilB) => { const [x, z] = r1(zc, o); quad(B, cell, x, z, w, l, dirSign < 0 ? northDir(zc) : southDir(zc), lift); };

  // ================================================================== SIDEWALKS (R1, both sides, z 1..60)
  const edges = [], gutters = [];
  const pushEdgePoly = (pts, kind, step = 3) => { const rs = resample(pts, step); for (let i = 1; i < rs.length; i++) edges.push({ a: [+rs[i - 1].x.toFixed(3), +rs[i - 1].z.toFixed(3)], b: [+rs[i].x.toFixed(3), +rs[i].z.toFixed(3)], kind }); };
  const curbB = new MeshBuilder(), paverB = new MeshBuilder(), lgB = new MeshBuilder(), faceB = new MeshBuilder(true), dotsB = new MeshBuilder(), barsB = new MeshBuilder();
  const SW_END = 60, ARC_R = 2.2;
  const sidewalkInfo = {};
  for (const s of [-1, 1]) {
    const P = [];
    for (const zc of cat(range(SW_END, 57.6, 0.3), range(57.6, 6, 1.0), range(6, 3.2, 0.4))) {
      const [cx, cz] = r1(zc, s * 3.0), [ox, oz] = r1(zc, s * 4.6), n = r1N(zc);
      P.push({ cx, cz, ox, oz, nx: s * n[0], nz: s * n[1], part: 1, zc });
    }
    const A = [s * 5.2, 3.2], th0 = s < 0 ? 0 : Math.PI, dth = s < 0 ? -Math.PI / 2 : Math.PI / 2;
    for (let i = 0; i <= 12; i++) {
      const th = th0 + dth * i / 12, cx = A[0] + ARC_R * Math.cos(th), cz = A[1] + ARC_R * Math.sin(th);
      const l = Math.hypot(A[0] - cx, A[1] - cz);
      P.push({ cx, cz, ox: s * 4.6, oz: 2.45, nx: (A[0] - cx) / l, nz: (A[1] - cz) / l, part: 2 });
    }
    for (const ax of range(5.2, 8.5, 0.4)) P.push({ cx: s * ax, cz: 1.0, ox: s * ax, oz: 2.45, nx: 0, nz: 1, part: 3 });
    let t = 0; P[0].t = 0;
    for (let i = 1; i < P.length; i++) { t += Math.hypot(P[i].cx - P[i - 1].cx, P[i].cz - P[i - 1].cz); P[i].t = t; }
    const tEnd = t, arc = P.filter(p => p.part === 2), tA0 = arc[0].t, tA1 = arc[arc.length - 1].t;
    const E = (tt) => smooth(0, 1.2, tt) * smooth(tEnd, tEnd - 1.0, tt);
    const dip = (tt) => smooth(tA0 + 0.3, tA0 + 0.9, tt) * (1 - smooth(tA1 - 0.9, tA1 - 0.3, tt));
    const curbH = (tt, d) => Math.max(0.012, CURB_H * E(tt) * (1 - 0.9 * dip(tt) * (1 - smooth(0.05, 1.05, d))));
    sidewalkInfo[s] = { P, curbH, tA0, tA1, tEnd };
    const FR = [0, 0.15, 0.3, 0.45, 0.6, 0.8, 1.0];
    const rowsCurb = [], rowsPav = [], rowsLG = [];
    for (const p of P) {
      const ry = roadY(p.cx, p.cz), h0 = curbH(p.t, 0), h3 = curbH(p.t, 0.03), h18 = curbH(p.t, 0.18);
      const faceTop = ry + Math.max(0.004, h0 - 0.02);
      const nF = [-p.nx, 0, -p.nz], nC = (() => { const l = Math.SQRT2; return [-p.nx / l, 1 / l, -p.nz / l]; })();
      const u = p.t / 1.2;
      const c3x = p.cx + p.nx * 0.03, c3z = p.cz + p.nz * 0.03, bx = p.cx + p.nx * 0.18, bz = p.cz + p.nz * 0.18;
      rowsCurb.push([
        curbB.vert(p.cx, ry - 0.015, p.cz, u, 0.0, nF), curbB.vert(p.cx, faceTop, p.cz, u, 0.45, nF),
        curbB.vert(p.cx, faceTop, p.cz, u, 0.45, nC), curbB.vert(c3x, roadY(c3x, c3z) + h3, c3z, u, 0.55, nC),
        curbB.vert(c3x, roadY(c3x, c3z) + h3, c3z, u, 0.55, UP), curbB.vert(bx, roadY(bx, bz) + h18, bz, u, 1.0, UP),
      ]);
      const pav = [];
      const len = Math.hypot(p.ox - bx, p.oz - bz);
      for (const f of FR) {
        const x = bx + (p.ox - bx) * f, z = bz + (p.oz - bz) * f, d = 0.18 + len * f;
        pav.push(paverB.vert(x, roadY(x, z) + curbH(p.t, d), z, x / 1.6, -z / 1.6, UP)); // world grid: pavers are laid straight and cut at the curb
      }
      rowsPav.push(pav);
      if (p.part !== 3 || true) {
        const gx = p.cx - p.nx * 0.28, gz = p.cz - p.nz * 0.28;
        rowsLG.push([lgB.vert(p.cx, ry + 0.006, p.cz, p.t / 2, 1, UP), lgB.vert(gx, roadY(gx, gz) + 0.006, gz, p.t / 2, 0, UP)]);
      }
    }
    for (let i = 0; i < P.length - 1; i++) {
      const a = rowsCurb[i], b = rowsCurb[i + 1];
      const nF = [-P[i].nx, 0, -P[i].nz];
      curbB.quad(a[0], b[0], b[1], a[1], nF);
      curbB.quad(a[2], b[2], b[3], a[3], [-P[i].nx, 1, -P[i].nz]);
      curbB.quad(a[4], b[4], b[5], a[5]);
      for (let j = 0; j < FR.length - 1; j++) paverB.quad(rowsPav[i][j], rowsPav[i + 1][j], rowsPav[i + 1][j + 1], rowsPav[i][j + 1]);
      lgB.quad(rowsLG[i][0], rowsLG[i + 1][0], rowsLG[i + 1][1], rowsLG[i][1]);
    }
    // outer face along R3 part (faces south, toward the lot side)
    const p3 = P.filter(p => p.part === 3);
    for (let i = 0; i < p3.length - 1; i++) {
      const a = p3[i], b = p3[i + 1];
      const ya = roadY(a.ox, a.oz) + curbH(a.t, 2), yb = roadY(b.ox, b.oz) + curbH(b.t, 2);
      const v0 = faceB.vert(a.ox, H(a.ox, a.oz) - 0.03, a.oz, 0, 0, [0, 0, 1]), v1 = faceB.vert(b.ox, H(b.ox, b.oz) - 0.03, b.oz, 0, 0, [0, 0, 1]);
      const v2 = faceB.vert(b.ox, yb, b.oz, 0, 0, [0, 0, 1]), v3 = faceB.vert(a.ox, ya, a.oz, 0, 0, [0, 0, 1]);
      faceB.quad(v0, v1, v2, v3, [0, 0, 1]);
    }
    // catch basin at the north end of the R1 U-ditch (x 4.6..4.95, z 2.45..3.25)
    {
      const x0 = s * 4.6, x1 = s * 4.95, top = roadY(s * 4.8, 2.85) + CURB_H;
      const bx = (x0 + x1) / 2;
      F.box(0.35, top - H(bx, 2.85) + 0.05, 0.8, '#b2b0a8', [bx, (top + H(bx, 2.85) - 0.05) / 2, 2.85]);
      quad(utilTopB, UTIL.drain, bx, 2.85, 0.3, 0.7, [0, -1], 0.003, null, () => top);
      physics.addWalkBox(bx, 2.85, 0.4, 0.85, 0, top);
    }
    // tactile warning band along the lowered corner, and the guide line along the sidewalk
    {
      const band = []; const tb0 = tA0 + 0.35, tb1 = tA1 - 0.35;
      for (const p of P) if (p.t >= tb0 - 0.2 && p.t <= tb1 + 0.2) band.push(p);
      let prev = null;
      for (const p of band) {
        const ax = p.cx + p.nx * 0.36, az = p.cz + p.nz * 0.36, bx = p.cx + p.nx * 0.66, bz = p.cz + p.nz * 0.66;
        const a = dotsB.vert(ax, roadY(ax, az) + curbH(p.t, 0.36) + 0.008, az, p.t / 0.3, 0, UP), b = dotsB.vert(bx, roadY(bx, bz) + curbH(p.t, 0.66) + 0.008, bz, p.t / 0.3, 1, UP);
        if (prev) dotsB.quad(prev[0], prev[1], b, a);
        prev = [a, b];
      }
      // guide line (linear blocks) o 3.8..4.1 from zc 58.3 to 4.2, dot squares at both ends
      const guide = (z0, z1) => {
        let prevG = null;
        for (const zc of range(z0, z1, 1.0)) {
          const [ax, az] = r1(zc, s * 3.8), [bx, bz] = r1(zc, s * 4.1);
          const y = roadY(ax, az) + CURB_H + 0.005;
          const a = barsB.vert(ax, y, az, s < 0 ? 1 : 0, zc / 0.3, UP), b = barsB.vert(bx, y, bz, s < 0 ? 0 : 1, zc / 0.3, UP);
          if (prevG) barsB.quad(prevG[0], prevG[1], b, a);
          prevG = [a, b];
        }
      };
      guide(4.5, 57.6);
      for (const zc of [4.2, 57.9]) { const [x, z] = r1(zc, s * 3.95); quad(dotsB, { x: 0, y: 0, w: 1024, h: 1024 }, x, z, 0.3, 0.3, northDir(zc), CURB_H + 0.005, null, roadY); }
    }
    // physics: walk ramps along the sidewalk, corner boxes, end ramps
    for (let za = 3.2; za < 58.8 - 0.01; za += 3.0) {
      const zb = Math.min(58.8, za + 3.0), zm = (za + zb) / 2;
      const [x, z] = r1(zm, s * 3.95), [dx, dz] = southDir(zm);
      const ya = roadY(...r1(za, s * 3.95)) + CURB_H, yb = roadY(...r1(zb, s * 3.95)) + CURB_H;
      physics.addWalkRamp(x, z, 1.95, (zb - za) + 0.06, Math.atan2(dx, dz), ya, yb);
    }
    { const [x, z] = r1(59.4, s * 3.95), [dx, dz] = southDir(59.4); physics.addWalkRamp(x, z, 1.95, 1.2, Math.atan2(dx, dz), roadY(...r1(58.8, s * 3.95)) + CURB_H, roadY(...r1(60, s * 3.95)) + 0.01); }
    physics.addWalkBox(s * 6.35, 1.72, 2.3, 1.45, 0, CURB_H + 0.02);
    physics.addWalkRamp(s * 8.0, 1.72, 1.45, 1.0, s * Math.PI / 2, CURB_H + 0.02, 0.03);
    physics.addWalkBox(s * 4.1, 2.85, 0.9, 0.8, 0, CURB_H + 0.02);
    // services: curb line + frontage wall line
    pushEdgePoly(P.map(p => [p.cx, p.cz]), 'curb', 2.5);
  }
  add(curbB, M.curb, { cast: true, name: 'street-curbs' });
  add(paverB, M.pavers, { name: 'street-sidewalk' });
  add(lgB, M.lgutter, { name: 'street-lgutter' });
  add(dotsB, M.dots, { name: 'street-tactile-dots' });
  add(barsB, M.bars, { name: 'street-tactile-bars' });

  // ================================================================== GUTTERS (U字溝)
  const lidB = new MeshBuilder(), gFaceB = faceB, ditchB = new DitchBuilder(), grateB = new MeshBuilder();
  const topR1 = (sgn) => (x, z) => { const zc = z + sgn * 4.75 * sX(z); return H(x, z) + LIFT + Math.max(0.012, CURB_H * (1 - smooth(58.8, 60, zc))); };
  const topFlat = (x, z) => roadY(x, z) + 0.012;
  const RUNS = [];
  const run = (id, pts, o = {}) => RUNS.push({ id, pts, w: o.w ?? 0.3, top: o.top ?? topFlat, open: o.open || (() => false), noGrate: o.noGrate || (() => false), every: o.every ?? [8, 14] });
  run('R1W', range(3.25, 130, 2).map(zc => r1(zc, -4.75)), { top: topR1(-1), open: (x, z) => inR(z, 92.5, 95.5) });
  run('R1E', range(3.25, 130, 2).map(zc => r1(zc, 4.75)), { top: topR1(1), open: (x, z) => inR(z, 104.5, 107.5) });
  run('R3S-W', [[-95, 1.13], [-8.6, 1.13]], { open: (x) => inR(x, -61, -57.5), noGrate: (x) => Math.abs(x + 78) < 0.6 || Math.abs(x + 52) < 0.6 || Math.abs(x + 26) < 0.6 });
  run('R3S-E', [[8.6, 1.13], [95, 1.13]], { open: (x) => inR(x, 39, 43), noGrate: (x) => Math.abs(x - 22) < 0.6 || Math.abs(x - 46) < 0.6 || Math.abs(x - 72) < 0.6 });
  run('R3N-W', [[-95, -5.15], [-17.35, -5.15]], { open: (x) => inR(x, -45, -41) });
  run('R3N-E', [[26.2, -5.15], [95, -5.15]]);
  run('R2W-S', [[-14.9, -7.6], [-14.9, -33.8]]);
  run('R2W-N1', [[-14.9, -59.6], [-14.9, -67.9]], { open: (x, z) => inR(z, -66.2, -63.8) });
  run('R2W-N2', [[-14.9, -74.1], [-14.9, R2N + 0.25]]);
  run('R2E-N1', [[-9.1, -59.6], [-9.1, -67.9]]);
  run('R2E-N2', [[-9.1, -74.1], [-9.1, R2N + 0.25]]);
  run('R4N-W', [[-95, -57.65], [-16.85, -57.65]], { open: (x) => inR(x, -61, -57) });
  run('R4N-E', [[-7.15, -57.65], [95, -57.65]], { open: (x) => inR(x, 23.5, 27.5) });
  run('R6N-W', [[-85, -72.65], [-16.35, -72.65]], { open: (x) => inR(x, -52, -46) });
  run('R6N-E', [[-7.65, -72.65], [85, -72.65]], { open: (x) => inR(x, 30, 42) });
  run('R6S-W', [[-85, -69.375], [-16.35, -69.375]], { w: 0.25, open: (x) => inR(x, -41, -38) });
  run('R6S-E', [[-7.65, -69.375], [85, -69.375]], { w: 0.25 });
  const RIM = 0.035, LIDLEN = 0.5, grateSpots = [];
  for (const g of RUNS) {
    const rs = resample(g.pts, 1.0); const total = rs[rs.length - 1].s; const w = g.w, hw = w / 2;
    const nLid = Math.max(1, Math.floor(total / LIDLEN));
    const kind = [];
    for (let k = 0; k < nLid; k++) { const p = pointAt(rs, (k + 0.5) * LIDLEN); kind.push(g.open(p.x, p.z) ? 'open' : 'lid'); }
    const rr = ctx.rng('gutter-' + g.id); let next = rr.range(2, 7);
    while (next < total - 1) {
      const k = Math.floor(next / LIDLEN); const p = pointAt(rs, (k + 0.5) * LIDLEN);
      if (k > 0 && k < nLid - 1 && kind[k] === 'lid' && kind[k - 1] === 'lid' && kind[k + 1] === 'lid' && !g.noGrate(p.x, p.z)) kind[k] = 'grate';
      next += rr.range(g.every[0], g.every[1]);
    }
    const spans = []; let k0 = 0;
    for (let k = 1; k <= nLid; k++) if (k === nLid || kind[k] !== kind[k0]) { spans.push({ kind: kind[k0], s0: k0 * LIDLEN, s1: k * LIDLEN }); k0 = k; }
    const last = spans[spans.length - 1]; if (last.kind === 'lid') last.s1 = total; else spans.push({ kind: 'lid', s0: last.s1, s1: total });
    const samples = (s0, s1) => { const out = [s0]; for (const p of rs) if (p.s > s0 + 0.05 && p.s < s1 - 0.05) out.push(p.s); out.push(s1); return out.map(s => pointAt(rs, s)); };
    for (const sp of spans) {
      if (sp.s1 - sp.s0 < 0.02) continue;
      const pts = samples(sp.s0, sp.s1);
      const E = (p, off) => { const nx = -p.tz, nz = p.tx; const x = p.x + nx * off, z = p.z + nz * off; return [x, z, g.top(x, z)]; };
      // outer faces (both sides) for every span
      for (const side of [1, -1]) {
        const N = (p) => [-p.tz * side, 0, p.tx * side];
        let prev = null;
        for (const p of pts) {
          const [x, z, y] = E(p, side * hw);
          const a = gFaceB.vert(x, H(x, z) - 0.035, z, 0, 0, N(p)), b = gFaceB.vert(x, y, z, 0, 0, N(p));
          if (prev) gFaceB.quad(prev[0], a, b, prev[1], N(p));
          prev = [a, b];
        }
      }
      if (sp.kind === 'lid') {
        let prev = null;
        for (const p of pts) {
          const [ax, az, ay] = E(p, hw), [bx, bz, by] = E(p, -hw);
          const a = lidB.vert(ax, ay, az, p.s / 1.0, 1, UP), b = lidB.vert(bx, by, bz, p.s / 1.0, 0, UP);
          if (prev) lidB.quad(prev[0], prev[1], b, a);
          prev = [a, b];
        }
        for (let i = 0; i < pts.length - 1; i += 3) {
          const p = pts[i], q = pts[Math.min(pts.length - 1, i + 3)];
          gutters.push({ a: [+p.x.toFixed(2), +p.z.toFixed(2)], b: [+q.x.toFixed(2), +q.z.toFixed(2)], w, water: false, y: +g.top(p.x, p.z).toFixed(3) });
        }
        continue;
      }
      // open or grate span: rims, inner walls, bottom, end walls, water, grate
      const wi = hw - RIM;
      for (const [o0, o1] of [[hw, wi], [-wi, -hw]]) {
        let prev = null;
        for (const p of pts) { const [ax, az, ay] = E(p, o0), [bx, bz, by] = E(p, o1); const a = gFaceB.vert(ax, ay, az, 0, 0, UP), b = gFaceB.vert(bx, by, bz, 0, 0, UP); if (prev) gFaceB.quad(prev[0], prev[1], b, a); prev = [a, b]; }
      }
      {
        const wl = sp.kind === 'open' ? 0.19 : 0.21, dp = sp.kind === 'open' ? 0.002 : 0.012, span = [sp.s0, sp.s1, wi, wl];
        let prev = null;
        for (const p of pts) {
          const n2 = [-p.tz, p.tx]; const [ax, az, ay] = E(p, wi), [bx, bz, by] = E(p, -wi);
          const a = ditchB.vert(ax, ay - dp, az, wi, p.s, dp, n2, span), b = ditchB.vert(bx, by - dp, bz, -wi, p.s, dp, n2, span);
          if (prev) ditchB.quad(prev[0], prev[1], b, a);
          prev = [a, b];
        }
      }
      if (sp.kind === 'grate') {
        let prev = null;
        for (const p of pts) { const [ax, az, ay] = E(p, hw - 0.012), [bx, bz, by] = E(p, -hw + 0.012); const u = (p.s - sp.s0) / LIDLEN; const a = grateB.vert(ax, ay - 0.004, az, u, 1, UP), b = grateB.vert(bx, by - 0.004, bz, u, 0, UP); if (prev) grateB.quad(prev[0], prev[1], b, a); prev = [a, b]; }
      }
      const pa = pts[0], pb = pts[pts.length - 1];
      const topY = g.top(pa.x, pa.z), wlY = sp.kind === 'open' ? 0.19 : 0.21;
      gutters.push({ a: [+pa.x.toFixed(2), +pa.z.toFixed(2)], b: [+pb.x.toFixed(2), +pb.z.toFixed(2)], w, water: true, open: sp.kind === 'open', grate: sp.kind === 'grate', y: +topY.toFixed(3), waterY: +(topY - wlY).toFixed(3) });
      if (sp.kind === 'grate') { const pm = pointAt(rs, (sp.s0 + sp.s1) / 2); grateSpots.push({ x: pm.x, z: pm.z, tx: pm.tx, tz: pm.tz, top: g.top, id: g.id }); }
    }
    pushEdgePoly(g.pts, 'gutter', 4);
  }
  add(lidB, M.lid, { name: 'street-gutter-lids' });
  add(solid(gFaceB, '#b2b0a8'), VC, { name: 'street-gutter-faces' });
  if (!ditchB.empty) root.add(ditchB.mesh(ditchMaterial(ctx)));
  add(grateB, M.grate, { name: 'street-gratings', noOutline: true });

  // ================================================================== LINE MARKINGS
  const W = C_WHITE;
  // --- R1
  strip(lineB, r1Path(-2.6, 3.65, 130), 0.15, W);
  strip(lineB, r1Path(2.6, 3.2, 130), 0.15, W);
  strip(lineB, r1Path(0, 3.2, 9), 0.15, W);
  dashes((a, b) => r1Path(0, a, b, 0.75), 12, 30, 3, 3, 0.15, W);
  strip(lineB, r1Path(0, 30, 90), 0.15, C_ORANGE);
  dashes((a, b) => r1Path(0, a, b, 0.75), 93, 130, 3, 3, 0.15, W);
  strip(lineB, [r1(3.45, -2.6), r1(3.45, -0.08)], 0.4, W);                                  // stop line (northbound)
  // green 通学路 shoulders (beyond the sidewalks)
  strip(paintB, r1Path(-3.615, 63, 101), 1.85, C_GREEN, 0.005, roadY, 2.0);
  strip(paintB, r1Path(3.615, 65, 85.2), 1.85, C_GREEN, 0.005, roadY, 2.0);
  strip(paintB, r1Path(3.615, 87.4, 99), 1.85, C_GREEN, 0.005, roadY, 2.0);
  // --- R3
  strip(lineB, [[-95, -4.72], [-17.4, -4.72]], 0.15, W); strip(lineB, [[-9.15, -4.72], [-2.45, -4.72]], 0.15, W); strip(lineB, [[2.45, -4.72], [95, -4.72]], 0.15, W);
  strip(lineB, [[-95, 0.72], [-8.75, 0.72]], 0.15, W); strip(lineB, [[8.75, 0.72], [95, 0.72]], 0.15, W);
  dashes((a, b) => [[a, -2], [b, -2]], 6, 95, 3, 3, 0.15, W);
  dashes((a, b) => [[-a, -2], [-b, -2]], 18, 95, 3, 3, 0.15, W);
  for (let i = 0; i < 7; i++) strip(lineB, [[-2.0, -4.7 + i * 0.9], [2.0, -4.7 + i * 0.9]], 0.45, W); // zebra crossing R1 -> plaza
  // --- R2 (outside the crossing zone)
  for (const [z0, z1] of [[-33.9, -7.6], [-67.9, -59.6], [R2N + 0.3, -74.1]]) strip(lineB, [[-14.47, z0], [-14.47, z1]], 0.15, W);
  for (const [z0, z1] of [[-33.9, -5.35], [-67.9, -59.6], [R2N + 0.3, -74.1]]) strip(lineB, [[-9.53, z0], [-9.53, z1]], 0.15, W);
  strip(lineB, [[-12.0, -6.3], [-9.6, -6.3]], 0.4, W);                                         // stop line R2 -> R3
  // --- R4
  strip(lineB, [[-95, -57.22], [-16.85, -57.22]], 0.15, W); strip(lineB, [[-7.15, -57.22], [95, -57.22]], 0.15, W);
  strip(lineB, [[-95, -53.78], [-16.0, -53.78]], 0.15, W); strip(lineB, [[-8.0, -53.78], [95, -53.78]], 0.15, W);
  strip(lineB, [[-6.95, -55.45], [-6.95, -53.86]], 0.4, W); strip(lineB, [[-17.05, -57.14], [-17.05, -55.55]], 0.4, W);
  // --- R6
  strip(lineB, [[-85, -72.25], [-16.35, -72.25]], 0.13, W); strip(lineB, [[-7.65, -72.25], [85, -72.25]], 0.13, W);
  strip(lineB, [[-85, -69.75], [-16.35, -69.75]], 0.13, W); strip(lineB, [[-7.65, -69.75], [85, -69.75]], 0.13, W);
  strip(lineB, [[-7.4, -72.2], [-7.4, -69.8]], 0.35, W); strip(lineB, [[-16.6, -72.2], [-16.6, -69.8]], 0.35, W);
  add(paintB, M.paint, { name: 'street-paint', renderOrder: -3, noOutline: true });
  add(lineB, M.line, { name: 'street-lines', renderOrder: -2, noOutline: true });

  // ================================================================== ROAD TEXT & SYMBOLS
  r1Glyph(GLYPH.tomare, 7.55, -1.3, 1.35, 7.2, -1);
  r1Glyph(GLYPH.diamond, 22, -1.3, 1.25, 3.0, -1); r1Glyph(GLYPH.diamond, 40, -1.3, 1.25, 3.0, -1);
  r1Glyph(GLYPH.jokou, 15.5, 1.3, 1.3, 4.6, 1);
  r1Glyph(GLYPH.n30, 55.5, -1.3, 1.2, 2.9, -1); r1Glyph(GLYPH.n30, 70.5, 1.3, 1.2, 2.9, 1);
  r1Glyph(GLYPH.school, 86, -1.3, 2.2, 3.6, -1); r1Glyph(GLYPH.school, 77.5, 1.3, 2.2, 3.6, 1);
  r1Glyph(GLYPH.hokou, 74.5, -1.3, 2.2, 3.6, -1); r1Glyph(GLYPH.hokou, 89, 1.3, 2.2, 3.6, 1);
  for (const zc of [18.5, 47, 104, 117]) r1Glyph(GLYPH.navi, zc, -2.2, 0.62, 1.6, -1);
  for (const zc of [26, 52, 97, 121]) r1Glyph(GLYPH.navi, zc, 2.2, 0.62, 1.6, 1);
  for (const zc of [67, 85]) r1Glyph(GLYPH.tsugaku, zc, -3.62, 1.05, 3.2, -1);
  for (const zc of [73, 91]) r1Glyph(GLYPH.kids, zc, -3.62, 1.2, 1.5, -1);
  for (const zc of [70, 94]) r1Glyph(GLYPH.tsugaku, zc, 3.62, 1.05, 3.2, 1);
  for (const zc of [76, 81]) r1Glyph(GLYPH.kids, zc, 3.62, 1.2, 1.5, 1);
  // R3
  quad(glyphB, GLYPH.jokou, 16.5, -0.7, 1.3, 4.6, [-1, 0], GLYPH_LIFT, W);
  quad(glyphB, GLYPH.jokou, -24.5, -3.3, 1.3, 4.6, [1, 0], GLYPH_LIFT, W);
  for (const x of [32, 52]) quad(glyphB, GLYPH.diamond, x, -0.7, 1.25, 3.0, [-1, 0], GLYPH_LIFT, W);
  for (const x of [-32, -52]) quad(glyphB, GLYPH.diamond, x, -3.3, 1.25, 3.0, [1, 0], GLYPH_LIFT, W);
  for (const x of [28, 64]) quad(glyphB, GLYPH.navi, x, 0.25, 0.62, 1.6, [-1, 0], GLYPH_LIFT, W);
  for (const x of [-40, -70]) quad(glyphB, GLYPH.navi, x, -4.25, 0.62, 1.6, [1, 0], GLYPH_LIFT, W);
  quad(glyphB, GLYPH.bus, 9.8, -3.9, 0.9, 2.4, [1, 0], GLYPH_LIFT, C_YELLOW);
  // stop text on R2 / R4 / R6
  quad(glyphB, GLYPH.tomare, -10.75, -9.9, 1.2, 6.0, [0, 1], GLYPH_LIFT, W);
  quad(glyphB, GLYPH.tomare, -3.7, -54.62, 1.1, 5.6, [-1, 0], GLYPH_LIFT, W);
  quad(glyphB, GLYPH.tomare, -20.3, -56.38, 1.1, 5.6, [1, 0], GLYPH_LIFT, W);
  quad(glyphB, GLYPH.tomare, -4.2, -71, 1.3, 5.4, [-1, 0], GLYPH_LIFT, W);
  quad(glyphB, GLYPH.tomare, -19.8, -71, 1.3, 5.4, [1, 0], GLYPH_LIFT, W);
  // white 自転車 pictograms on the R3 shoulders
  quad(glyphB, GLYPH.bike, -35, 0.2, 0.95, 0.95, [-1, 0], GLYPH_LIFT, W);
  quad(glyphB, GLYPH.bike, 58, -4.2, 0.95, 0.95, [1, 0], GLYPH_LIFT, W);
  // petals & a few leaves caught on some gratings (and the lid next to them)
  {
    const rl = ctx.rng('street-litter'), ONE = [1, 1, 1];
    for (const gs of grateSpots) {
      if (!rl.chance(0.55)) continue;
      const k = rl.range(-0.12, 0.12), top = gs.top(gs.x, gs.z) + 0.006;
      quad(glyphB, GLYPH.litter, gs.x + gs.tx * k, gs.z + gs.tz * k, 0.42, 0.46, [gs.tx * (rl.chance(0.5) ? 1 : -1), gs.tz], 0, ONE, () => top);
      if (rl.chance(0.6)) { const d = rl.pick([-0.55, 0.55]); quad(glyphB, GLYPH.litter, gs.x + gs.tx * d, gs.z + gs.tz * d, 0.36, 0.4, [-gs.tz, gs.tx], 0, ONE, () => top); }
    }
  }
  add(glyphB, M.glyph, { name: 'street-glyphs', renderOrder: -1, noOutline: true });

  // ================================================================== UTILITY DECALS (manholes, lids, patches, stains, sprays)
  // repair patches (drawn first so everything else sits on top)
  r1Util(UTIL.patchA, 17.5, -1.2, 1.8, 2.6); r1Util(UTIL.patchB, 45, 1.6, 1.2, 1.6); r1Util(UTIL.patchC, 36.5, -1.0, 1.4, 1.4);
  r1Util(UTIL.patchC, 112, 0.9, 2.2, 2.2); r1Util(UTIL.trench, 96.5, -1.8, 0.55, 8.0);
  { const [x, z] = r1(58, 0); quad(utilB, UTIL.trench, x, z, 0.6, 5.8, r1N(58), UTIL_LIFT); }
  quad(utilB, UTIL.patchA, -30, -3.1, 2.0, 3.0, [1, 0], UTIL_LIFT); quad(utilB, UTIL.trench, 48, -2, 0.6, 5.8, [0, 1], UTIL_LIFT); quad(utilB, UTIL.patchB, 12, -0.6, 1.4, 1.8, [1, 0], UTIL_LIFT);
  quad(utilB, UTIL.fresh, 35, 0.1, 1.3, 2.6, [1, 0], UTIL_LIFT);
  quad(utilB, UTIL.patchA, -11.2, -16, 1.6, 2.2, [0, 1], UTIL_LIFT); quad(utilB, UTIL.trench, -12, -22, 0.6, 5.3, [1, 0], UTIL_LIFT); quad(utilB, UTIL.patchC, -12.6, -63, 1.5, 1.5, [0, 1], UTIL_LIFT);
  quad(utilB, UTIL.patchB, -30, -55.9, 1.5, 2.2, [1, 0], UTIL_LIFT); quad(utilB, UTIL.patchA, 40, -55.0, 2.0, 2.5, [1, 0], UTIL_LIFT); quad(utilB, UTIL.trench, 12, -55.5, 0.6, 3.8, [0, 1], UTIL_LIFT);
  quad(utilB, UTIL.patchA, 22, -71.2, 1.4, 2.0, [1, 0], UTIL_LIFT); quad(utilB, UTIL.patchC, -40, -70.6, 1.2, 1.2, [1, 0], UTIL_LIFT);
  // crack sealing, oil, stains, skid marks
  r1Util(UTIL.seal, 64, -0.4, 0.8, 4.0); r1Util(UTIL.seal, 20.5, 1.2, 0.7, 3.2);
  quad(utilB, UTIL.seal, -60, -2.8, 0.8, 4.0, [1, 0.2], UTIL_LIFT); quad(utilB, UTIL.seal, 58, -0.9, 0.8, 4.0, [1, -0.1], UTIL_LIFT);
  quad(utilB, UTIL.seal, -70, -55.2, 0.7, 3.6, [1, 0.1], UTIL_LIFT); quad(utilB, UTIL.seal, 48, -71, 0.6, 3.0, [1, 0], UTIL_LIFT);
  r1Util(UTIL.oilA, 12.4, -1.3, 0.9, 0.9); r1Util(UTIL.oilB, 14.3, -1.4, 0.7, 0.7); r1Util(UTIL.oilB, 72.5, -3.9, 1.0, 1.2); r1Util(UTIL.oilA, 33, 1.4, 0.6, 0.6);
  quad(utilB, UTIL.oilA, -6.0, -3.5, 1.0, 1.0, [1, 0], UTIL_LIFT); quad(utilB, UTIL.oilB, 22.3, -0.25, 0.9, 0.9, [1, 0], UTIL_LIFT); quad(utilB, UTIL.oilA, -10.6, -54.2, 0.8, 0.8, [0, 1], UTIL_LIFT);
  for (const [zc, o] of [[9, -2.75], [24, 2.75], [41, -2.75], [53, 2.75], [80, -2.9], [110, 2.9]]) r1Util(UTIL.stain, zc, o, 0.8, 2.2, -1);
  for (const [x, z] of [[-50, 0.6], [30, -4.6], [70, 0.6], [-80, -4.6]]) quad(utilB, UTIL.stain, x, z, 0.8, 2.4, [1, 0], UTIL_LIFT);
  r1Util(UTIL.skid, 16.5, -1.3, 0.9, 2.8); quad(utilB, UTIL.skid, -20, -3.3, 0.9, 2.8, [1, 0], UTIL_LIFT);
  // corner drains & wet corners at every fillet
  for (const f of FILLETS) {
    if (f.r1) continue;
    const { C } = filletArc(f); const dx = f.K[0] - C[0], dz = f.K[1] - C[1], l = Math.hypot(dx, dz);
    const px = C[0] + dx / l * (f.r + 0.25), pz = C[1] + dz / l * (f.r + 0.25);
    quad(utilB, UTIL.wet, px + dx / l * 0.2, pz + dz / l * 0.2, 1.3, 0.7, [-dz, dx], UTIL_LIFT);
    quad(utilB, UTIL.drain, px, pz, 0.42, 0.42, f.e1, UTIL_LIFT + 0.001);
  }
  // survey / repair spray marks
  r1Util(UTIL.sprayA, 108.8, 2.2, 0.9, 0.9, 1); r1Util(UTIL.sprayC, 107.2, 3.3, 1.0, 1.0, 1); r1Util(UTIL.sprayB, 50.5, -2.0, 0.8, 0.8);
  quad(utilB, UTIL.sprayA, 32.9, 0.3, 0.9, 0.9, [-1, 0], UTIL_LIFT); quad(utilB, UTIL.sprayB, 37.6, -0.6, 0.9, 0.9, [-1, 0], UTIL_LIFT); quad(utilB, UTIL.sprayC, 35, -1.35, 0.8, 0.8, [-1, 0], UTIL_LIFT);
  quad(utilB, UTIL.sprayB, -44, -54.2, 0.8, 0.8, [1, 0], UTIL_LIFT); quad(utilB, UTIL.sprayA, -58, -70.4, 0.8, 0.8, [1, 0], UTIL_LIFT);
  r1Util(UTIL.fresh, 108, 3.4, 1.0, 1.9, 1);
  // manholes (御当地マンホール), valve lids, gas lids, hydrant areas
  const MH = 0.66;
  r1Util(UTIL.manholeA, 28.6, -0.6, MH, MH); for (const [zc, o] of [[15.5, 0.6], [47, 0.6], [79, -0.6], [109.5, 0.6]]) r1Util(UTIL.manholeB, zc, o, MH, MH);
  r1Util(UTIL.manholeC, 36, -1.9, 0.6, 0.6); r1Util(UTIL.manholeC, 62, 2.0, 0.6, 0.6);
  quad(utilB, UTIL.manholeA, 10.5, -1.4, MH, MH, [1, 0], UTIL_LIFT);
  for (const [x, z] of [[-43.5, -1.4], [40, -2.6], [70, -1.4]]) quad(utilB, UTIL.manholeB, x, z, MH, MH, [1, 0], UTIL_LIFT);
  for (const [x, z] of [[-70, -2.6], [-24, -1.3]]) quad(utilB, UTIL.manholeC, x, z, 0.6, 0.6, [1, 0], UTIL_LIFT);
  quad(utilB, UTIL.manholeB, -12.6, -20, MH, MH, [0, -1], UTIL_LIFT); quad(utilB, UTIL.manholeC, -11.4, -64, 0.6, 0.6, [0, -1], UTIL_LIFT); quad(utilB, UTIL.manholeA, -12.5, -78, MH, MH, [0, -1], UTIL_LIFT);
  quad(utilB, UTIL.manholeB, -40, -55.1, MH, MH, [1, 0], UTIL_LIFT); quad(utilB, UTIL.manholeA, 30, -55.8, MH, MH, [1, 0], UTIL_LIFT); quad(utilB, UTIL.manholeC, 60, -55.2, 0.6, 0.6, [1, 0], UTIL_LIFT);
  quad(utilB, UTIL.manholeA, 20, -71, MH, MH, [1, 0], UTIL_LIFT); quad(utilB, UTIL.manholeB, -45, -71, MH, MH, [1, 0], UTIL_LIFT); quad(utilB, UTIL.manholeC, 55, -71, 0.6, 0.6, [1, 0], UTIL_LIFT);
  for (const [zc, o] of [[19, 2.2], [52, -2.0], [88, 1.9]]) r1Util(UTIL.valveR, zc, o, 0.3, 0.3);
  for (const [zc, o] of [[33.5, -2.2], [100, 2.3]]) r1Util(UTIL.valveS, zc, o, 0.32, 0.32);
  for (const [zc, o] of [[24.5, -2.35], [57, 2.2]]) r1Util(UTIL.gas, zc, o, 0.24, 0.24);
  quad(utilB, UTIL.valveR, -24, 0.2, 0.3, 0.3, [1, 0], UTIL_LIFT); quad(utilB, UTIL.valveR, 28, -4.2, 0.3, 0.3, [1, 0], UTIL_LIFT); quad(utilB, UTIL.valveR, -10.3, -26, 0.3, 0.3, [0, 1], UTIL_LIFT); quad(utilB, UTIL.valveR, -30, -71.8, 0.3, 0.3, [1, 0], UTIL_LIFT);
  quad(utilB, UTIL.valveS, 18.4, 0.1, 0.32, 0.32, [1, 0], UTIL_LIFT); quad(utilB, UTIL.valveS, 0, -56.9, 0.32, 0.32, [1, 0], UTIL_LIFT); quad(utilB, UTIL.valveS, 60, -70.3, 0.32, 0.32, [1, 0], UTIL_LIFT);
  quad(utilB, UTIL.gas, -52, 0.3, 0.24, 0.24, [1, 0], UTIL_LIFT); quad(utilB, UTIL.gas, -13.8, -70.2, 0.24, 0.24, [1, 0], UTIL_LIFT); quad(utilB, UTIL.gas, -62, -70.1, 0.24, 0.24, [1, 0], UTIL_LIFT);
  r1Util(UTIL.hydrant, 86.3, 3.55, 1.05, 1.6, 1);
  quad(utilB, UTIL.hydrant, 44.0, -4.0, 0.95, 1.45, [0, 1], UTIL_LIFT);
  quad(utilB, UTIL.hydrant, -13.75, -29.5, 0.9, 1.35, [0, 1], UTIL_LIFT);
  add(utilB, M.util, { name: 'street-util-decals', renderOrder: -3, noOutline: true });
  // curb-side inlet grates on the L-gutters (above the concrete strip)
  for (const [zc, s] of [[6.5, -1], [6.5, 1], [21, -1], [29, 1], [36, -1], [44, 1], [50, -1], [50.5, 1]]) r1Util(UTIL.drain, zc, s * 2.86, 0.25, 0.5, -1, 0.009, utilTopB);
  add(utilTopB, M.util, { name: 'street-util-top', renderOrder: -1, noOutline: true });

  // ================================================================== SIGN POSTS, MIRRORS, GUARDRAILS, CONES
  const swTop = (x, z) => roadY(x, z) + CURB_H;      // sidewalk surface
  const shTop = (x, z) => roadY(x, z) - 0.01;        // asphalt shoulder
  const faceS = (zc) => { const d = southDir(zc); return Math.atan2(d[0], d[1]); };
  const faceN = (zc) => { const d = northDir(zc); return Math.atan2(d[0], d[1]); };
  const disc = (cell, y, r = 0.3, extra = {}) => ({ kind: 'circle', cell, size: [r], y, ...extra });
  const rect = (cell, y, w, h, extra = {}) => ({ kind: 'rect', cell, size: [w, h], y, ...extra });
  // R1/R3 junction: 止まれ, 横断歩道 (double-faced), curve mirrors on both corners
  F.signPost(-3.38, 4.3, swTop(-3.38, 4.3), 2.55, 0, [{ kind: 'tri', cell: SIGN.stop, size: [0.8], y: 2.2, clamps: [0.08, -0.12] }, rect(SIGN.pPriority, 1.72, 0.52, 0.18)]);
  F.signPost(-6.7, 1.45, swTop(-6.7, 1.45), 2.75, -Math.PI / 2, [rect(SIGN.cross, 2.42, 0.6, 0.6, { double: true, clamps: [0.14, -0.14] })]);
  F.signPost(6.7, 1.45, swTop(6.7, 1.45), 2.75, Math.PI / 2, [rect(SIGN.cross, 2.42, 0.6, 0.6, { double: true, clamps: [0.14, -0.14] })]);
  F.curveMirror(-4.85, 1.42, -0.36, undefined, [], swTop(-4.85, 1.42));
  F.curveMirror(4.85, 1.42, 0.25, undefined, [], swTop(4.85, 1.42));
  // blue guide sign (west sidewalk, facing northbound traffic)
  {
    const x = -3.32, z = 19.2, base = swTop(x, z), top = 3.55;
    F.signPost(x, z, base, top, 0, []);
    const pw = 1.2, ph = 0.9, cx = x - 0.02 - pw / 2, cy = base + 2.98;
    F.addPlate(F.plateGeo('rect', SIGN.guide, [pw, ph]), cx, cy, z + 0.055, 0);
    const bx1 = cx - pw / 2 + 0.12;
    for (const dy of [-0.28, 0.28]) F.box(x - bx1, 0.04, 0.03, F.COL.steel, [(x + bx1) / 2, cy + dy, z + 0.03]);
  }
  // no parking, speed limit, school-zone and hydrant signs along R1
  { const [x, z] = r1(28.8, -3.35); F.signPost(x, z, swTop(x, z), 2.6, faceS(28.8), [disc(SIGN.noPark, 2.25), rect(SIGN.p820, 1.8, 0.5, 0.19)]); }
  { const [x, z] = r1(44.5, 3.35); F.signPost(x, z, swTop(x, z), 2.6, faceN(44.5), [disc(SIGN.noPark, 2.25)]); }
  { const [x, z] = r1(60.8, -4.3); F.signPost(x, z, shTop(x, z), 2.75, faceS(60.8), [disc(SIGN.n30, 2.4)]); }
  { const [x, z] = r1(64.2, 4.3); F.signPost(x, z, shTop(x, z), 2.75, faceN(64.2), [disc(SIGN.n30, 2.4)]); }
  { const [x, z] = r1(66.5, -4.3); F.signPost(x, z, shTop(x, z), 2.9, faceS(66.5), [{ kind: 'diamond', cell: SIGN.school, size: [0.4], y: 2.45, clamps: [0.12, -0.12] }, rect(SIGN.pTsugaku, 1.85, 0.5, 0.19)]); }
  { const [x, z] = r1(91, 4.3); F.signPost(x, z, shTop(x, z), 2.9, faceN(91), [{ kind: 'diamond', cell: SIGN.school, size: [0.4], y: 2.45, clamps: [0.12, -0.12] }, rect(SIGN.pSchool, 1.85, 0.56, 0.21)]); }
  { const [x, z] = r1(101, 4.3); F.signPost(x, z, shTop(x, z), 2.6, faceN(101), [disc(SIGN.noPark, 2.25), rect(SIGN.p820, 1.8, 0.5, 0.19)]); }
  { const [x, z] = r1(87.3, 4.42); F.signPost(x, z, shTop(x, z), 2.3, faceN(87.3) + 0.5, [rect(SIGN.hydrant, 1.95, 0.3, 0.6, { clamps: [0.2, -0.2] })], { r: 0.025 }); }
  F.signPost(44.8, -5.5, H(44.8, -5.5), 2.3, 0, [rect(SIGN.hydrant, 1.95, 0.3, 0.6, { clamps: [0.2, -0.2] })], { r: 0.025 });
  // R2/R3: double mirror opposite the mouth of R2
  F.curveMirror(-12.0, 1.62, Math.PI, [{ yaw: 0.5, dx: -0.42 }, { yaw: -0.5, dx: 0.42 }]);
  // R2/R4 cross: mirrors on NW and SE corners with 一時停止 plates for R4
  F.curveMirror(-15.4, -58.15, Math.PI / 4, [{ yaw: 0 }], [{ kind: 'rect', cell: SIGN.pStop, size: [0.5, 0.25], y: 1.35, rotY: -Math.PI * 3 / 4 }]);
  F.curveMirror(-8.6, -52.95, -Math.PI * 3 / 4, [{ yaw: 0 }], [{ kind: 'rect', cell: SIGN.pStop, size: [0.5, 0.25], y: 1.35, rotY: Math.PI * 5 / 4 }]);
  // R2/R6 cross: mirrors (NE, SW) + 止まれ signs for R6 (SE for westbound, NW for eastbound)
  F.curveMirror(-8.62, -73.12, -Math.PI / 4);
  F.curveMirror(-15.38, -68.88, Math.PI * 3 / 4);
  F.signPost(-8.6, -68.85, H(-8.6, -68.85), 2.5, Math.PI / 2, [{ kind: 'tri', cell: SIGN.stop, size: [0.75], y: 2.15, clamps: [0.08, -0.12] }]);
  F.signPost(-15.4, -73.15, H(-15.4, -73.15), 2.5, -Math.PI / 2, [{ kind: 'tri', cell: SIGN.stop, size: [0.75], y: 2.15, clamps: [0.08, -0.12] }]);
  // guardrails: R2 up the levee (both sides) and short stretches of R4 along the rail corridor
  F.guardrail([-57, -53.3], [-35, -53.3], -1);
  F.guardrail([54, -53.3], [76, -53.3], -1);
  // bollards at the end of R2 (levee stairs)
  { // road-end guardrails (道路終点) along the levee toe on both sides of the stairs
    const sx0 = r2Stair ? r2Stair.x - r2Stair.w / 2 : -13.7, sx1 = r2Stair ? r2Stair.x + r2Stair.w / 2 : -10.3, zg = R2N - 0.15;
    F.guardrail([-16.6, zg], [sx0 - 0.26, zg], 1);
    F.guardrail([sx1 + 0.26, zg], [-7.4, zg], 1);
  }
  // repair sites: cones + cone bar
  F.cone(33.4, 0.45, roadY(33.4, 0.45)); F.cone(36.6, 0.45, roadY(36.6, 0.45)); F.coneBar([33.4, 0.45], [36.6, 0.45], roadY(35, 0.45) + 0.55);
  { const [x, z] = r1(106.3, 3.45); F.cone(x, z, shTop(x, z) + 0.01); }

  // ================================================================== SERVICES
  for (const s of [-1, 1]) for (const lot of L.LOTS.filter(l => l.side === s)) pushEdgePoly(range(lot.z0, lot.z1, 2).map(zc => r1(zc, s * L.STREET.lotOffset)), 'wall', 2.5);
  const edgeLine = (pts) => pushEdgePoly(pts, 'edge', 4);
  edgeLine([[-95, 1], [-5.2, 1]]); edgeLine([[5.2, 1], [95, 1]]); edgeLine([[-95, -5], [-17.25, -5]]); edgeLine([[26, -5], [95, -5]]);
  edgeLine([[-14.75, -7.5], [-14.75, -34]]); edgeLine([[-9.25, -5], [-9.25, -34]]);
  for (const x of [-14.75, -9.25]) { edgeLine([[x, -59.5], [x, -68]]); edgeLine([[x, -74], [x, R2N]]); }
  for (const z of [-57.5, -53.5]) { edgeLine([[-95, z], [-16.75, z]]); edgeLine([[-7.25, z], [95, z]]); }
  for (const z of [-72.5, -69.5]) { edgeLine([[-85, z], [-16.25, z]]); edgeLine([[-7.75, z], [85, z]]); }
  edgeLine(r1Path(-4.6, 60, 130, 2)); edgeLine(r1Path(4.6, 60, 130, 2));
  for (const f of FILLETS) pushEdgePoly(filletArc(f, 6).pts, f.r1 ? 'curb' : 'edge', 1.5);
  ctx.services.street = { edges, gutters };
}
