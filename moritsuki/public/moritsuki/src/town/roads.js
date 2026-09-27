// 道路・線路・岸壁・護岸・ガードレール・防波堤・ホーム
import * as THREE from 'three';
import { Mesher, resample } from './mesher.js';
import { roadW, PAVED, M } from './layout.js';
import { lambert, paint, triplanarDetail } from './materials.js';
import { TEX } from './assets/textures.js';
import { texAvg } from './terrain.js';
import { polylineDist, hash2, rng } from './data.js';

const C = (h) => new THREE.Color(h);
const COL = {
  asphalt: C('#6f7176'), asphaltOld: C('#7d7c7a'), track: C('#b39f7c'), foot: C('#a39d90'),
  white: C('#f2f2ee'), yellow: C('#e8b53a'), concrete: C('#b9b6ad'), concreteDark: C('#8e8b83'), concreteWet: C('#6f6d67'),
  ballast: C('#8a8276'), rail: C('#5b4f46'), sleeper: C('#6d655c'), guard: C('#e9ebea'), post: C('#d9dcdc'), tactile: C('#e6c23a'),
  manhole: C('#55534f'), rock: C('#8d877a'), rockDark: C('#6e6a61'), tetra: C('#c3c0b6'),
};

export function buildRoads(ctx) {
  const { data, ground, mask, deck, segs } = ctx;
  const { V } = data;
  const road = new Mesher({ aLine: 1, aR: 2 });
  const mark = new Mesher();
  const struct = new Mesher();
  const group = new THREE.Group();

  // 橋: 両端の高さを結ぶ
  const bridgeY = (r, pts) => {
    // 両端の高さ: 橋の端が川の中に入っていても、岸の高さ（端から外へ数 m の地面）に合わせる
    const end = (p, o) => {
      const l = Math.hypot(p[0] - o[0], p[1] - o[1]) || 1, ux = (p[0] - o[0]) / l, uz = (p[1] - o[1]) / l;
      let h = -Infinity;
      for (const d of [0, 1.5, 3]) h = Math.max(h, ground(p[0] + ux * d, p[1] + uz * d));
      return h;
    };
    const P0 = r.p[0], P1 = r.p[r.p.length - 1];
    const a = end(P0, P1), b = end(P1, P0);
    const L = pts[pts.length - 1].d || 1;
    if (!r.rampless) {
      // 道の橋（両端に取り付けあり）: d = RAMP..L-RAMP を端から端へ
      const L2 = Math.max(0.1, L - 6);
      return (q) => a + (b - a) * Math.max(0, Math.min(1, (q.d - 3) / L2)) + 0.35;
    }
    return (q) => Math.max(a + (b - a) * (q.d / L), ground(q.x, q.z)) + 0.35;
  };

  const cuts = []; // 道の下の地面を削る区間（道より上に地面が盛り上がって、道が埋もれないように）
  const order = { trunk: 5, primary: 5, secondary: 4, tertiary: 3, unclassified: 2, residential: 2, service: 1, track: 0, footway: 0, path: 0 };
  const roads = V.roads.filter((r) => r.k !== 'path' || r.p.length > 1);
  for (const r of roads) {
    const w = roadW(r.k), hw = w / 2;
    // 橋は両端に 3 m の取り付け（スロープ）を足して、岸の地面とつなぐ
    const RAMP = 3;
    const line = r.br ? (() => {
      const p = r.p, n = p.length;
      const e = (a, b) => { const l = Math.hypot(a[0] - b[0], a[1] - b[1]) || 1; return [a[0] + (a[0] - b[0]) / l * RAMP, a[1] + (a[1] - b[1]) / l * RAMP]; };
      return [e(p[0], p[1]), ...p, e(p[n - 1], p[n - 2])];
    })() : r.p;
    const pts = resample(line, 2.5);
    if (pts.length < 2) continue;
    const paved = PAVED.has(r.k) && r.sf !== 'unpaved' && r.sf !== 'gravel' && r.sf !== 'dirt';
    const col = paved ? (r.k === 'trunk' || r.k === 'secondary' ? COL.asphalt : COL.asphaltOld) : r.k === 'footway' ? COL.foot : COL.track;
    const lift = 0.07 + (order[r.k] ?? 1) * 0.008;
    const yAt = r.br ? (() => {
      const mid = bridgeY(r, pts), Lb = pts[pts.length - 1].d;
      const g0 = ground(line[0][0], line[0][1]), g1 = ground(line[line.length - 1][0], line[line.length - 1][1]);
      const at = (d) => mid({ d: Math.max(RAMP, Math.min(Lb - RAMP, d)), x: 0, z: 0 });
      return (q) => {
        const k0 = Math.min(1, q.d / RAMP), k1 = Math.min(1, (Lb - q.d) / RAMP);
        if (k0 < 1) return g0 + (at(RAMP) - g0) * k0;
        if (k1 < 1) return g1 + (at(Lb - RAMP) - g1) * k1;
        return Math.max(at(q.d), ground(q.x, q.z) + 0.35);
      };
    })() : null;
    // 橋でない道: 両端の高さ（片側が川や斜面に落ちていても、真ん中よりあまり下げない）。道の中の点はその間をつなぐ
    if (!r.br) for (const q of pts) {
      const yc = ground(q.x, q.z), a = ground(q.x + q.nx * hw, q.z + q.nz * hw), b = ground(q.x - q.nx * hw, q.z - q.nz * hw);
      const hi = Math.max(yc, a, b), lim = hw * 0.12;
      q.yl = Math.max(a, hi - lim); q.yr = Math.max(b, hi - lim);
    }
    const Y = (q, x, z) => {
      if (r.br) return yAt(q) + lift;
      const sd = Math.max(-1, Math.min(1, ((x - q.x) * q.nx + (z - q.z) * q.nz) / hw));
      return q.yr + (q.yl - q.yr) * (sd + 1) / 2 + lift;
    };
    const base = road.count;
    for (const q of pts) {
      const lx = q.x + q.nx * hw, lz = q.z + q.nz * hw, rx = q.x - q.nx * hw, rz = q.z - q.nz * hw;
      road.v(lx, Y(q, lx, lz), lz, 0, 1, 0, col, { aLine: paved ? 1 : 0, aR: [q.d, 1] });
      road.v(rx, Y(q, rx, rz), rz, 0, 1, 0, col, { aLine: paved ? 1 : 0, aR: [q.d, -1] });
    }
    for (let k = 0; k < pts.length - 1; k++) { const a = base + k * 2; road.quad(a, a + 2, a + 3, a + 1); }
    if (!r.br) for (let k = 0; k < pts.length - 1; k++) {
      const q = pts[k], q2 = pts[k + 1];
      cuts.push([q, q2, hw, q.yl, q.yr, q2.yl, q2.yr]);
    }
    // 端を丸く（交差点のすき間を埋める）
    for (const q of [pts[0], pts[pts.length - 1]]) {
      const c0 = road.v(q.x, Y(q, q.x, q.z), q.z, 0, 1, 0, col, { aLine: paved ? 1 : 0, aR: [q.d, 0] });
      const ring = [];
      for (let a = 0; a <= 10; a++) {
        const t = (a / 10) * Math.PI * 2, x = q.x + Math.cos(t) * hw, z = q.z + Math.sin(t) * hw;
        ring.push(road.v(x, Y(q, x, z) - 0.004, z, 0, 1, 0, col, { aLine: paved ? 1 : 0, aR: [q.d, Math.sin(t) * 0.9] }));
      }
      for (let a = 0; a < 10; a++) road.tri(c0, ring[a + 1], ring[a]);
    }
    // 白線
    if (paved && w >= 4.4) {
      const dash = (off, on, gap, width, c) => {
        for (let k = 0; k < pts.length - 1; k++) {
          const q = pts[k], q2 = pts[k + 1];
          if (on && (q.d % (on + gap)) > on) continue;
          const hw2 = width / 2;
          const P = (qq, s) => { const x = qq.x + qq.nx * (off + s * hw2), z = qq.z + qq.nz * (off + s * hw2); return [x, Y(qq, x, z) + 0.012, z]; };
          mark.face([P(q, 1), P(q2, 1), P(q2, -1), P(q, -1)], c);
        }
      };
      const big = r.k === 'trunk' || r.k === 'secondary' || r.k === 'primary';
      if (big || r.k === 'tertiary') dash(0, 5, 5, 0.14, COL.white);
      if (big) { dash(hw - 0.35, 0, 0, 0.15, COL.white); dash(-(hw - 0.35), 0, 0, 0.15, COL.white); }
      else if (hash2(r.p[0][0], r.p[0][1]) > 0.45) dash(hw - 0.3, 0, 0, 0.12, COL.white);
    }
    // マンホール（舗装路の真ん中に）
    if (paved && !r.br && w >= 3.8) {
      for (let k = 0; k < pts.length; k++) {
        const q = pts[k];
        if (hash2(Math.floor(q.d / 6), r.p[0][0]) > 0.14 || (q.d % 6) > 2.5) continue;
        const g = new THREE.CylinderGeometry(0.32, 0.32, 0.02, 14);
        mark.merge(g, new THREE.Matrix4().setPosition(q.x + q.nx * 0.6, Y(q, q.x, q.z) + 0.012, q.z + q.nz * 0.6), COL.manhole);
        k += 3;
      }
    }
    // 橋の欄干
    if (r.br) {
      for (const s of [1, -1]) {
        for (let k = 0; k < pts.length - 1; k++) {
          const q = pts[k], q2 = pts[k + 1];
          if (q.d < RAMP - 0.5 || q2.d > pts[pts.length - 1].d - RAMP + 0.5) continue;
          const x = (q.x + q2.x) / 2 + q.nx * s * (hw + 0.15), z = (q.z + q2.z) / 2 + q.nz * s * (hw + 0.15);
          const len = Math.hypot(q2.x - q.x, q2.z - q.z);
          struct.box(x, Y(q, x, z) + 0.45, z, 0.25, 0.9, len + 0.05, Math.atan2(q.tx, q.tz), COL.concrete);
          segs.add(q.x + q.nx * s * (hw + 0.15), q.z + q.nz * s * (hw + 0.15), q2.x + q2.nx * s * (hw + 0.15), q2.z + q2.nz * s * (hw + 0.15), 0.2);
        }
      }
      for (const q of resample(line, 0.7)) deck.line(q.x, q.z, hw + 0.2, yAt(q) + lift - 0.02);
      // 取り付けの下は盛り土（地面を取り付けの面に合わせる）
      for (let k = 0; k < pts.length - 1; k++) {
        const q = pts[k], q2 = pts[k + 1];
        if (q.d >= RAMP && q2.d <= pts[pts.length - 1].d - RAMP) continue;
        cuts.push([q, q2, hw, yAt(q), yAt(q), yAt(q2), yAt(q2)]);
      }
    }
  }

  // 道の下の格子点を、道の面（両端の地面を結んだ面）より下へ
  {
    const core = data.core, st = core.step;
    for (const [q, q2, hw, yl0, yr0, yl1, yr1] of cuts) {
      const tx = q2.x - q.x, tz = q2.z - q.z, len = Math.hypot(tx, tz) || 1, ux = tx / len, uz = tz / len;
      const R = hw + 0.6;
      const i0 = Math.floor((Math.min(q.x, q2.x) - R - core.x0) / st), i1 = Math.ceil((Math.max(q.x, q2.x) + R - core.x0) / st);
      const j0 = Math.floor((Math.min(q.z, q2.z) - R - core.z0) / st), j1 = Math.ceil((Math.max(q.z, q2.z) + R - core.z0) / st);
      for (let j = Math.max(0, j0); j <= Math.min(core.nz - 1, j1); j++) for (let i = Math.max(0, i0); i <= Math.min(core.nx - 1, i1); i++) {
        const dx = core.xOf(i) - q.x, dz = core.zOf(j) - q.z;
        const t = (dx * ux + dz * uz) / len;
        if (t < -0.05 || t > 1.05) continue;
        const sd = dx * -uz + dz * ux; // 左（+n）が正
        if (Math.abs(sd) > R) continue;
        const u = Math.max(0, Math.min(1, t)), w = (Math.max(-hw, Math.min(hw, sd)) / hw + 1) / 2;
        const y = (yr0 + (yl0 - yr0) * w) * (1 - u) + (yr1 + (yl1 - yr1) * w) * u - 0.03;
        const c = j * core.nx + i;
        if (core.h[c] > y || Math.abs(sd) < hw - 0.3) core.h[c] = y;
      }
    }
  }

  // ---------- 線路 ----------
  const sleeper = [];
  for (const rl of V.rails) {
    const pts = resample(rl.p, 2);
    const yb = rl.br ? bridgeY({ ...rl, rampless: true }, pts) : null;
    const Y = (q, x, z) => (rl.br ? yb(q) : ground(x, z)) + 0.25;
    // バラスト（台形）
    const base = struct.count;
    for (const q of pts) {
      for (const [o, dy] of [[2.2, -0.25], [1.4, 0.1], [-1.4, 0.1], [-2.2, -0.25]]) {
        const x = q.x + q.nx * o, z = q.z + q.nz * o;
        struct.v(x, Y(q, q.x, q.z) + dy, z, 0, 1, 0, COL.ballast);
      }
    }
    for (let k = 0; k < pts.length - 1; k++) {
      const a = base + k * 4, b = a + 4;
      struct.quad(a, b, b + 1, a + 1); struct.quad(a + 1, b + 1, b + 2, a + 2); struct.quad(a + 2, b + 2, b + 3, a + 3);
    }
    for (const q of pts) {
      const y = Y(q, q.x, q.z) + 0.1;
      sleeper.push([q.x, y, q.z, Math.atan2(q.tx, q.tz)]);
      const q2 = { x: q.x + q.tx, z: q.z + q.tz };
      sleeper.push([q2.x, y, q2.z, Math.atan2(q.tx, q.tz)]);
    }
    for (const s of [0.53, -0.53]) {
      for (let k = 0; k < pts.length - 1; k++) {
        const q = pts[k], q2 = pts[k + 1];
        const x = (q.x + q2.x) / 2 + q.nx * s, z = (q.z + q2.z) / 2 + q.nz * s;
        struct.box(x, Y(q, q.x, q.z) + 0.26, z, 0.07, 0.14, Math.hypot(q2.x - q.x, q2.z - q.z) + 0.02, Math.atan2(q.tx, q.tz), COL.rail, null, 1 | 2 | 4 | 8 | 16);
      }
    }
    if (rl.br) for (const q of pts) deck.line(q.x, q.z, 2.2, Y(q, q.x, q.z) + 0.1);
  }
  for (const [x, y, z, yaw] of sleeper) struct.box(x, y, z, 2.1, 0.12, 0.22, yaw, COL.sleeper, null, 1 | 2 | 4 | 8 | 16);

  // ---------- ホーム ----------
  for (const pl of V.platforms) {
    const shape = new THREE.Shape(pl.p.map(([x, z]) => new THREE.Vector2(x, -z)));
    let yTop = -Infinity;
    for (const [x, z] of pl.p) yTop = Math.max(yTop, ground(x, z));
    yTop += 1.0;
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 3, bevelEnabled: false });
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, yTop - 3, 0);
    struct.merge(geo, new THREE.Matrix4(), (v, n) => (n.y > 0.5 ? COL.concrete : COL.concreteDark));
    // 点字ブロックの帯
    const p = pl.p;
    for (let k = 0; k < p.length - 1; k++) {
      const [ax, az] = p[k], [bx, bz] = p[k + 1];
      const l = Math.hypot(bx - ax, bz - az);
      if (l < 20) continue;
      const nx = -(bz - az) / l, nz = (bx - ax) / l;
      // 内側へ 0.9m
      const cx = (ax + bx) / 2, cz = (az + bz) / 2;
      const inside = (x, z) => { let ins = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) { const [xi, zi] = p[i], [xj, zj] = p[j]; if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) ins = !ins; } return ins; };
      const s = inside(cx + nx * 1.5, cz + nz * 1.5) ? 1 : -1;
      const o = 0.9 * s;
      mark.face([[ax + nx * (o - 0.15), yTop + 0.01, az + nz * (o - 0.15)], [bx + nx * (o - 0.15), yTop + 0.01, bz + nz * (o - 0.15)], [bx + nx * (o + 0.15), yTop + 0.01, bz + nz * (o + 0.15)], [ax + nx * (o + 0.15), yTop + 0.01, az + nz * (o + 0.15)]].reverse(), COL.tactile);
    }
    deck.poly(pl.p, yTop);
  }

  // ---------- 海岸: 岸壁・護岸・磯 ----------
  const rocks = [];
  const core = data.core;
  const roadNear = (x, z) => { for (const [dx, dz] of [[2, 0], [-2, 0], [0, 2], [0, -2], [1.5, 1.5], [-1.5, 1.5], [1.5, -1.5], [-1.5, -1.5]]) if (mask.get(x + dx, z + dz) & M.ROAD) return true; return false; };
  const quay = (q, s, top) => {
    const i0 = Math.floor((q.x - 10 - core.x0) / core.step), j0 = Math.floor((q.z - 10 - core.z0) / core.step);
    for (let j = j0; j <= j0 + 4; j++) for (let i = i0; i <= i0 + 4; i++) {
      if (i < 0 || j < 0 || i >= core.nx || j >= core.nz) continue;
      const vx = core.xOf(i), vz = core.zOf(j);
      const along = (vx - q.x) * q.tx + (vz - q.z) * q.tz;
      if (Math.abs(along) > 3) continue;
      const sd = ((vx - q.x) * q.nx + (vz - q.z) * q.nz) * s;
      const c = j * core.nx + i;
      if (sd < -0.4 && sd > -9) core.h[c] = Math.min(core.h[c], -2.6);
      // 陸側を天端まで上げるのは岸壁の真後ろだけ。道の下や道のきわまで上げると、地面が道を突き抜けて緑のまだらになる
      else if (sd > 0.4 && sd < 5 && !(mask.get(vx, vz) & M.ROAD) && !roadNear(vx, vz)) core.h[c] = Math.max(core.h[c], top);
    }
  };
  for (const cl of V.coast) {
    const pts = resample(cl.p, 2);
    // 先に各区間の陸側と高さを調べ、岸壁の天端は前後でならす（段々にしない）
    const seg = [];
    for (let k = 0; k < pts.length - 1; k++) {
      const q = pts[k];
      let s = 1;
      if (ground(q.x + q.nx * 3, q.z + q.nz * 3) < ground(q.x - q.nx * 3, q.z - q.nz * 3)) s = -1;
      let landH = 0;
      for (const d of [2.5, 4, 6, 8]) landH = Math.max(landH, ground(q.x + q.nx * s * d, q.z + q.nz * s * d));
      const m = mask.get(q.x + q.nx * s * 2.5, q.z + q.nz * s * 2.5);
      const urban = (m & (M.TOWN | M.HARBOR | M.ROAD)) && !(m & M.BEACH);
      seg.push({ s, landH, m, quay: urban && landH > 0.8 });
    }
    seg.forEach((g, k) => {
      if (!g.quay) return;
      let sum = 0, n = 0;
      for (let j = k - 3; j <= k + 3; j++) if (seg[j] && seg[j].quay && seg[j].s === g.s) { sum += Math.max(seg[j].landH, 1.5); n++; }
      g.top = Math.max(sum / n, g.landH, 1.5);
    });
    for (let k = 0; k < pts.length - 1; k++) {
      const q = pts[k], q2 = pts[k + 1];
      const { s, landH, m } = seg[k];
      const len = Math.hypot(q2.x - q.x, q2.z - q.z);
      const yaw = Math.atan2(q.tx, q.tz);
      if (seg[k].quay) {
        // 岸壁（垂直のコンクリート）: 手前の海底を掘り、陸側は平らに
        const top = seg[k].top;
        quay(q, s, top);
        struct.box((q.x + q2.x) / 2 + q.nx * s * 0.5, (top - 3) / 2, (q.z + q2.z) / 2 + q.nz * s * 0.5, 1.0, top + 3, len + 0.1, yaw, COL.concreteDark);
        // 道がすぐ脇を通るところだけ胸の高さの護岸。道が岸へ下りる口（スロープ）はあける
        const at = (d) => mask.get(q.x + q.nx * s * d, q.z + q.nz * s * d);
        const nearRoad = [3, 5, 7].some((d) => at(d) & M.ROAD);
        if (nearRoad && !(m & M.HARBOR) && !(at(0.7) & M.ROAD) && !(at(1.8) & M.ROAD)) {
          const px = (q.x + q2.x) / 2 + q.nx * s * 0.7, pz = (q.z + q2.z) / 2 + q.nz * s * 0.7;
          struct.box(px, top + 0.5, pz, 0.4, 1.0, len + 0.08, yaw, COL.concrete);
          struct.box(px, top + 1.03, pz, 0.48, 0.06, len + 0.1, yaw, COL.concreteDark);
          segs.add(q.x + q.nx * s * 0.7, q.z + q.nz * s * 0.7, q2.x + q2.nx * s * 0.7, q2.z + q2.nz * s * 0.7, 0.25);
        } else if (m & M.HARBOR && hash2(q.x * 0.2, q.z * 0.2) > 0.86) {
          // 係船柱
          const bx = q.x + q.nx * s * 0.9, bz = q.z + q.nz * s * 0.9;
          struct.box(bx, top + 0.25, bz, 0.35, 0.5, 0.35, yaw, C('#4a4640'));
          struct.box(bx, top + 0.52, bz, 0.5, 0.1, 0.5, yaw, C('#4a4640'));
        }
      } else if (!(m & M.BEACH) && landH > 0.4) {
        // 磯の岩
        const r = rng(Math.floor(hash2(q.x, q.z) * 1e9));
        if (r() < 0.8) rocks.push([q.x - q.nx * s * (r() * 2), -0.6 + r() * 0.8, q.z - q.nz * s * (r() * 2), 0.8 + r() * 1.8, r() * 6]);
      }
    }
  }

  // ---------- 町なかの川岸の護岸 ----------
  // 川の輪郭に沿って、垂直のコンクリート護岸と天端の笠木を一続きの帯で張る（高さは前後でならす）。
  // 輪郭が川を横切るところ（多角形の切れ目）は両側とも水なので張らない。
  // 道の近くだけ転落防止柵を立て、道が川を渡るところ（橋・暗渠）はあける。
  const rail = new Mesher(), fenceGrid = new Mesher({ uv: 2 });
  const fence = [];
  // 縦の四角（下 2 点 → 上 2 点）を (dx, dz) の側に向けて張る
  const towardFace = (m, pts, dx, dz, c) => {
    const [a, b] = pts;
    const nx = -(b[2] - a[2]), nz = b[0] - a[0];
    m.face(nx * dx + nz * dz >= 0 ? pts : [pts[1], pts[0], pts[3], pts[2]], c);
  };
  // 上向きの面
  const upFace = (m, pts, c) => {
    const [a, b, , d] = pts;
    const ny = (b[2] - a[2]) * (d[0] - a[0]) - (b[0] - a[0]) * (d[2] - a[2]);
    m.face(ny >= 0 ? pts : [pts[0], pts[3], pts[2], pts[1]], c);
  };
  for (const w of V.water) {
    if (w.w !== 'river') continue;
    const ring = w.p[0][0] === w.p[w.p.length - 1][0] && w.p[0][1] === w.p[w.p.length - 1][1] ? w.p : [...w.p, w.p[0]];
    // 地図の輪郭のガタつきをならしてから（護岸と柵がジグザグにならないように）
    const raw = resample(ring, 1.5);
    const pts = raw.map((q, i) => {
      let x = 0, z = 0, n = 0;
      for (let j = i - 2; j <= i + 2; j++) { const p = raw[Math.max(0, Math.min(raw.length - 1, j))]; x += p.x; z += p.z; n++; }
      return { ...q, x: x / n, z: z / n };
    });
    const info = pts.map((q) => {
      const wa = mask.get(q.x + q.nx * 2.2, q.z + q.nz * 2.2) & M.WATER, wb = mask.get(q.x - q.nx * 2.2, q.z - q.nz * 2.2) & M.WATER;
      if (!wa === !wb) return null;
      const s = wa ? -1 : 1; // 陸の側
      const L = (d) => [q.x + q.nx * s * d, q.z + q.nz * s * d];
      if (!(mask.get(...L(2.5)) & (M.TOWN | M.HARBOR | M.ROAD))) return null;
      // 道が川の上に張り出しているところは、護岸を道の端まで出す（道の下は盛り土してある）
      let o = 0;
      while (o < 3 && (mask.get(...L(-o - 0.1)) & M.ROAD)) o += 0.25;
      if (o >= 3) return null; // 道が川を渡っている（橋・暗渠）
      let top = -Infinity;
      for (const d of [0.4, 1.2, 2.2]) top = Math.max(top, ground(...L(d - o)));
      if (top < 0.6) return null;
      return {
        q, s, o, top, bed: ground(...L(-o - 1.6)),
        road: o > 0 || [1.5, 3, 4.5, 6].some((d) => mask.get(...L(d)) & M.ROAD),
        cross: [-o - 0.9, -o - 1.7].some((d) => mask.get(...L(d)) & M.ROAD),
      };
    });
    // 柵を立てる所: 道ぞいで、道が渡っていない所。短いすき間は埋め、短い切れ端は立てない
    {
      const want = info.map((f) => !!(f && f.road && !f.cross));
      const same = (i, j) => info[i] && info[j] && info[i].s === info[j].s;
      for (let i = 0; i < want.length; i++) {
        if (want[i] || !info[i] || info[i].cross) continue;
        let a = i; while (a > 0 && !want[a - 1] && same(a - 1, i) && !info[a - 1].cross) a--;
        let b = i; while (b < want.length - 1 && !want[b + 1] && same(b + 1, i) && !info[b + 1].cross) b++;
        if (a > 0 && b < want.length - 1 && want[a - 1] && want[b + 1] && same(a - 1, b + 1) && b - a < 4) for (let j = a; j <= b; j++) want[j] = true;
        i = b;
      }
      for (let i = 0; i < want.length; i++) {
        if (!want[i]) continue;
        let b = i; while (b < want.length - 1 && want[b + 1] && same(b + 1, i)) b++;
        if (b - i < 3) for (let j = i; j <= b; j++) want[j] = false;
        i = b;
      }
      info.forEach((f, i) => { if (f) f.fence = want[i]; });
    }
    // 天端の高さを前後でならす（段々にしない）
    const top0 = info.map((f) => f && f.top);
    info.forEach((f, i) => {
      if (!f) return;
      let s = 0, n = 0;
      for (let j = i - 3; j <= i + 3; j++) { const t = top0[j]; if (t != null && info[j].s === f.s) { s += t; n++; } }
      f.y = Math.max(s / n, f.top - 0.08) + 0.12;
    });
    for (let i = 0; i < pts.length - 1; i++) {
      const A = info[i], B = info[i + 1];
      if (!A || !B || A.s !== B.s) continue;
      const P = (f, o, y) => [f.q.x + f.q.nx * f.s * (o - f.o), y, f.q.z + f.q.nz * f.s * (o - f.o)];
      const bot = Math.min(A.bed, B.bed, A.y - 2) - 0.6;
      const dx = -A.q.nx * A.s, dz = -A.q.nz * A.s; // 水の側
      // 護岸の壁（水側）・笠木の上面・陸側の小口
      towardFace(struct, [P(A, 0, bot), P(B, 0, bot), P(B, 0, B.y), P(A, 0, A.y)], dx, dz, COL.concreteDark);
      upFace(struct, [P(A, 0, A.y), P(B, 0, B.y), P(B, 0.35, B.y), P(A, 0.35, A.y)], COL.concrete);
      towardFace(struct, [P(A, 0.35, A.y - 0.5), P(B, 0.35, B.y - 0.5), P(B, 0.35, B.y), P(A, 0.35, A.y)], -dx, -dz, COL.concrete);
      // 転落防止柵（道の近く、道が渡るところはあける）
      if (A.fence && B.fence) fence.push([P(A, 0.17, A.y), P(B, 0.17, B.y), i]);
    }
  }
  // 柵: 支柱・笠木・中桟と、縦格子（透かしのテクスチャ）
  {
    const col = C('#56504a'), H = 1.05;
    for (const [a, b, i] of fence) {
      const len = Math.hypot(b[0] - a[0], b[2] - a[2]), yaw = Math.atan2(b[0] - a[0], b[2] - a[2]);
      const mx = (a[0] + b[0]) / 2, mz = (a[2] + b[2]) / 2, my = (a[1] + b[1]) / 2;
      const pitch = Math.atan2(b[1] - a[1], len);
      for (const [h, t] of [[H, 0.06], [0.12, 0.045]]) {
        const g = new THREE.BoxGeometry(t, t, Math.hypot(len, b[1] - a[1]) + 0.02);
        g.rotateX(-pitch); g.rotateY(yaw); g.translate(mx, my + h, mz);
        rail.merge(g, new THREE.Matrix4(), col);
      }
      if (i % 2 === 0) rail.box(a[0], a[1] + H / 2, a[2], 0.07, H, 0.07, yaw, col);
      // 縦格子の板（両面）
      const L2 = Math.hypot(len, b[1] - a[1]);
      const q = [[a[0], a[1] + 0.12, a[2]], [b[0], b[1] + 0.12, b[2]], [b[0], b[1] + H, b[2]], [a[0], a[1] + H, a[2]]];
      const uv = [[0, 0], [L2, 0], [L2, 1], [0, 1]];
      const base = fenceGrid.count;
      const fnx = -(b[2] - a[2]) / len, fnz = (b[0] - a[0]) / len;
      q.forEach((p, k) => fenceGrid.v(p[0], p[1], p[2], fnx, 0, fnz, col, { uv: uv[k] }));
      fenceGrid.quad(base, base + 1, base + 2, base + 3);
      segs.add(a[0], a[2], b[0], b[2], 0.12);
    }
  }

  // ---------- 防波堤 ----------
  const tetra = [];
  for (const bw of V.breakwaters) {
    const pts = resample(bw.p, 2);
    const top = 2.6, hw = bw.k === 'pier' ? 2 : 2.6;
    for (let k = 0; k < pts.length - 1; k++) {
      const q = pts[k], q2 = pts[k + 1];
      const len = Math.hypot(q2.x - q.x, q2.z - q.z), yaw = Math.atan2(q.tx, q.tz);
      const cx = (q.x + q2.x) / 2, cz = (q.z + q2.z) / 2;
      const bottom = Math.min(ground(cx, cz), -1) - 1;
      struct.box(cx, (top + bottom) / 2, cz, hw * 2, top - bottom, len + 0.1, yaw, COL.concrete);
      // 外側のパラペット
      struct.box(cx + q.nx * (hw - 0.3), top + 0.6, cz + q.nz * (hw - 0.3), 0.6, 1.2, len + 0.1, yaw, COL.concreteDark);
      segs.add(q.x + q.nx * (hw - 0.3), q.z + q.nz * (hw - 0.3), q2.x + q2.nx * (hw - 0.3), q2.z + q2.nz * (hw - 0.3), 0.3);
      if (k % 2 === 0) for (const o of [hw + 1.6, hw + 3.4]) tetra.push([cx + q.nx * o + (hash2(cx, o) - 0.5), -0.6 + hash2(cz, o) * 0.6, cz + q.nz * o, hash2(cx, cz) * 6]);
      deck.line(cx, cz, hw, top);
    }
  }

  // ---------- 海沿いの道のガードレール（町の外） ----------
  // 高さは道の端の路面にそろえ（川や斜面の上に浮かせない）、支柱は地面まで下ろす。
  // 川ぞいは護岸の柵にまかせ、橋・交差点の口にはつけない。
  const beam = (a, b, h, t, th, col) => {
    const len = Math.hypot(b[0] - a[0], b[2] - a[2]);
    const g = new THREE.BoxGeometry(t, th, Math.hypot(len, b[1] - a[1]) + 0.03);
    g.rotateX(-Math.atan2(b[1] - a[1], len)); g.rotateY(Math.atan2(b[0] - a[0], b[2] - a[2]));
    g.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + h, (a[2] + b[2]) / 2);
    rail.merge(g, new THREE.Matrix4(), col);
  };
  for (const r of V.roads) {
    if (!PAVED.has(r.k) || r.k === 'service' || r.br) continue;
    const pts = resample(r.p, 2);
    const hw = roadW(r.k) / 2;
    for (let k = 0; k < pts.length - 1; k++) {
      const q = pts[k], q2 = pts[k + 1];
      let side = 0;
      for (const s of [1, -1]) {
        const x = q.x + q.nx * s * (hw + 4), z = q.z + q.nz * s * (hw + 4), m2 = mask.get(x, z);
        if ((ground(x, z) < 0.3 && !(m2 & M.WATER)) || (m2 & M.BEACH)) side = s;
      }
      if (!side) continue;
      const m = mask.get(q.x, q.z);
      if (m & (M.HARBOR)) continue;
      if (m & M.TOWN && !(mask.get(q.x + q.nx * side * (hw + 4), q.z + q.nz * side * (hw + 4)) & M.BEACH)) continue;
      // 横から別の道が入ってくる所はあける
      if ([1.2, 2.2].some((d) => mask.get(q.x + q.nx * side * (hw + d), q.z + q.nz * side * (hw + d)) & (M.ROAD | M.WATER))) continue;
      const o = hw + 0.35;
      const E = (p) => Math.max(ground(p.x + p.nx * side * hw, p.z + p.nz * side * hw), ground(p.x, p.z) - hw * 0.12) + 0.07; // 道の端の路面
      const a = [q.x + q.nx * side * o, E(q), q.z + q.nz * side * o], b = [q2.x + q2.nx * side * o, E(q2), q2.z + q2.nz * side * o];
      beam(a, b, 0.62, 0.07, 0.32, COL.guard);
      beam(a, b, 0.5, 0.1, 0.05, COL.guard);
      if (k % 2 === 0) {
        const g0 = Math.min(ground(a[0], a[2]), a[1]) - 0.3;
        const g = new THREE.CylinderGeometry(0.06, 0.06, a[1] + 0.8 - g0, 10);
        rail.merge(g, new THREE.Matrix4().setPosition(a[0], (a[1] + 0.8 + g0) / 2, a[2]), COL.post);
      }
      segs.add(a[0], a[2], b[0], b[2], 0.15);
    }
  }

  const asp = TEX.asphalt();
  const roadMat = paint(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }), {
    amp: 0.1, scale: 0.6, key: 'road2',
    uniforms: { tA: { value: asp.map }, aA: { value: texAvg(asp.map) } },
    fragHead: 'uniform sampler2D tA; uniform vec3 aA;',
    attrs: 'attribute float aLine; attribute vec2 aR;', vars: 'varying float vLine; varying vec2 vR;', vtx: 'vLine = aLine; vR = aR;',
    frag: /* glsl */ `
      {
        float av = abs(vR.y);
        // アスファルトの粒
        float dist = length(cameraPosition - vWP);
        diffuseColor.rgb *= mix(vec3(1.0), texture2D(tA, vWP.xz / 4.0).rgb / aA, vLine * (1.0 - smoothstep(60.0, 220.0, dist)));
        // 骨材のざらつき
        diffuseColor.rgb *= 0.93 + tnH(floor(vWP.xz * 18.0)) * 0.1;
        // 補修跡（色の違う四角いつぎはぎ）
        vec2 pc = floor(vec2(vR.x / 3.5, vR.y * 1.2 + 3.0));
        float pn = tnH(pc + 17.0);
        float inPatch = step(0.86, pn) * step(abs(fract(vR.x / 3.5) - 0.5), 0.38);
        diffuseColor.rgb *= mix(1.0, mix(0.86, 1.1, tnH(pc)), inPatch * vLine);
        // タイヤの通る所は少し白っぽく、端は砂ぼこりで明るく
        float track = exp(-pow((av - 0.42) / 0.12, 2.0));
        diffuseColor.rgb *= 1.0 + track * 0.07 * vLine;
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.62, 0.58, 0.5), smoothstep(0.8, 1.0, av) * 0.35 * vLine);
        // ひび
        float cr = abs(tnV(vec2(vR.x * 0.9, vR.y * 3.0 + 5.0)) - 0.5);
        float crOn = step(0.78, tnV(vec2(vR.x * 0.12, vR.y + 9.0)));
        diffuseColor.rgb *= 1.0 - smoothstep(0.012, 0.0, cr) * 0.22 * vLine * crOn;
        // 未舗装: 轍と小石
        diffuseColor.rgb *= mix(1.0 - track * 0.08 + tnH(floor(vWP.xz * 11.0)) * 0.12, 1.0, vLine);
      }`,
  });
  const roadMesh = new THREE.Mesh(road.build(), roadMat);
  roadMesh.receiveShadow = true;
  const markMesh = new THREE.Mesh(mark.build(), lambert({ side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -6 }, { amp: 0.15, scale: 1.5, key: 'mark' }));
  markMesh.receiveShadow = true;
  // 岩とテトラポッド
  const rockGeo = new THREE.IcosahedronGeometry(1, 0);
  for (const [x, y, z, s, a] of rocks) {
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(a, a * 1.7, a * 0.3)), new THREE.Vector3(s, s * 0.7, s * 0.9));
    struct.merge(rockGeo, m, hash2(x, z) > 0.5 ? COL.rock : COL.rockDark);
  }
  const tp = tetrapodGeo();
  for (const [x, y, z, a] of tetra) {
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(a, a * 2.3, a * 0.7)), new THREE.Vector3(1, 1, 1));
    struct.merge(tp, m, COL.tetra);
  }
  const ct = TEX.concrete().map;
  const structMesh = new THREE.Mesh(struct.build(), paint(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }), { amp: 0.15, scale: 0.5, key: 'struct2', ...triplanarDetail(ct, texAvg(ct), 2.5) }));
  structMesh.castShadow = true; structMesh.receiveShadow = true;
  group.add(roadMesh, markMesh, structMesh);
  // 柵・ガードレール（金属）と、柵の縦格子
  const railMesh = new THREE.Mesh(rail.build(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.45 }));
  railMesh.castShadow = true; railMesh.receiveShadow = true;
  const gridMesh = new THREE.Mesh(fenceGrid.build(), new THREE.MeshStandardMaterial({ vertexColors: true, map: barsTexture(), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.45, metalness: 0.4 }));
  gridMesh.castShadow = true; gridMesh.receiveShadow = true;
  group.add(railMesh, gridMesh);
  return group;
}

// 転落防止柵の縦格子（1 m に 8 本）
function barsTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#fff';
  for (let k = 0; k < 8; k++) g.fillRect(k * 32 + 13, 0, 6, 64);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function tetrapodGeo() {
  const m = new Mesher();
  const legs = [[0, 1, 0], [0.94, -0.33, 0], [-0.47, -0.33, 0.82], [-0.47, -0.33, -0.82]];
  const cyl = new THREE.CylinderGeometry(0.35, 0.6, 1.5, 6, 1);
  cyl.translate(0, 0.75, 0);
  for (const d of legs) {
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(...d).normalize());
    m.merge(cyl, new THREE.Matrix4().compose(new THREE.Vector3(), q, new THREE.Vector3(1, 1, 1)), new THREE.Color(1, 1, 1));
  }
  const g = m.build();
  g.deleteAttribute('color');
  return g;
}
