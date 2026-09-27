// 鳥の暮らし（第2弾）：アオサギ（田・川・池）、カワセミ（杭・岩から水へ飛びこむ）、キジ（野と畦を歩く・ホロ打ち）、
// ハシブトガラス（畑を歩く・電柱と木のてっぺん）、キジバト（庭・道・棟・電線、首をふって歩く）、
// メジロとシジュウカラ（花の桜・椿の中を渡る・逆さにぶら下がる）、ヒヨドリ（木から木へ波形に飛ぶ）、
// ウグイス（やぶの中）、ムクドリ（群れで田畑を歩く）、ヒバリ（畑の上の空で停空飛翔してさえずる）。
// どれも住む場所から生まれ、しゃぼん玉（視点）が近づくと逃げる
import * as THREE from 'three';
import { makeBirdHerds } from '../render/species_birds.js';
import { SPECIES_CFG } from '../render/treegeo.js';
import { T, SP } from '../world/gen.js';
import { riverZ, riverLevel, POND, HOUSES, KNOLL, RIDGE, BRIDGE, SHRINE, floorT, GORGE, gorgeWorld, streamA } from '../world/layout.js';
import { mulberry32, clamp, lerp, vnoise2 } from '../util/noise.js';

const TAU = Math.PI * 2;
const wrapPi = (a) => { while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a; };
const yawTo = (dx, dz) => Math.atan2(dx, dz);
const turnTo = (a, b, k) => a + wrapPi(b - a) * k;
const ease = (u) => u * u * (3 - 2 * u);
const rotYv = (v, a) => { const c = Math.cos(a), s = Math.sin(a); return [c * v[0] + s * v[2], v[1], -s * v[0] + c * v[2]]; };

// 木の形（treegeo の Builder.cylinder）から枝の線分を読む：円柱は輪2つ、各輪は sides+1 点で最後の点が最初と同じ位置。葉の板（aux.y=1）は飛ばす
function branchSegs(geo) {
  const P = geo.attributes.position && geo.attributes.position.array, A = geo.attributes.aux && geo.attributes.aux.array;
  if (!P || !A) return [];
  const n = P.length / 3, out = [];
  const same = (i, j) => Math.abs(P[i * 3] - P[j * 3]) + Math.abs(P[i * 3 + 1] - P[j * 3 + 1]) + Math.abs(P[i * 3 + 2] - P[j * 3 + 2]) < 1e-5;
  const ring = (i) => { for (let j = i + 3; j < Math.min(n, i + 24); j++) { if (A[j * 4 + 1] > 0.5) return 0; if (same(i, j)) return j - i; } return 0; };
  const cen = (i, m) => { let x = 0, y = 0, z = 0; for (let q = 0; q < m; q++) { x += P[(i + q) * 3]; y += P[(i + q) * 3 + 1]; z += P[(i + q) * 3 + 2]; } return [x / m, y / m, z / m]; };
  let i = 0;
  while (i < n) {
    if (A[i * 4 + 1] > 0.5) { i++; continue; }
    const m = ring(i), j = i + m + 1;
    if (!m || j + m >= n || !same(j, j + m)) { i++; continue; }
    const a = cen(i, m), b = cen(j, m);
    out.push({ a, b, r0: Math.hypot(P[i * 3] - a[0], P[i * 3 + 1] - a[1], P[i * 3 + 2] - a[2]), r1: Math.hypot(P[j * 3] - b[0], P[j * 3 + 1] - b[1], P[j * 3 + 2] - b[2]) });
    i = j + m + 1;
  }
  return out;
}
// 枝の線分から止まり木の点（枝の上面）を拾う（局所座標）。幹・太い枝・立った枝は除く（小鳥は細い小枝と枝先に）
function localPerches(segs) {
  if (segs.length < 4) return [];
  let rMax = 0;
  for (const q of segs) rMax = Math.max(rMax, q.r0);
  const out = [];
  for (const q of segs) {
    if (q.r0 > rMax * 0.32) continue;
    const d = [q.b[0] - q.a[0], q.b[1] - q.a[1], q.b[2] - q.a[2]], L = Math.hypot(d[0], d[1], d[2]);
    if (L < 0.08) continue;
    const u = [d[0] / L, d[1] / L, d[2] / L];
    if (Math.abs(u[1]) > 0.8) continue;
    const nn = Math.max(1, Math.round(L / 0.3));
    for (let k = 0; k < nn; k++) {
      const f = (k + 0.5) / nn, r = q.r0 + (q.r1 - q.r0) * f;
      out.push({ p: [q.a[0] + d[0] * f, q.a[1] + d[1] * f + r * 0.85, q.a[2] + d[2] * f], d: u, flat: 1 - Math.abs(u[1]) });
    }
  }
  return out;
}

// 飛び方：v=速さ m/s、f=羽ばたき Hz、amp=振り、bound=羽ばたく割合（残りは翼を閉じる）、cyc=その周期、wave=上下の波、glide=滑空の割合
const STY = {
  small: { v: 7.5, f: 19, amp: 1.0, bound: 0.55, cyc: 0.34, wave: 0.12, arc: 0.12, gap: 0.3 },
  mejiro: { v: 5.5, f: 22, amp: 1.0, bound: 0.65, cyc: 0.28, wave: 0.06, arc: 0.15, gap: 0.3 },
  hiyo: { v: 9, f: 13, amp: 1.0, bound: 0.42, cyc: 0.8, wave: 0.7, arc: 0.08, gap: 0.5 },
  crow: { v: 9, f: 3.3, amp: 0.85, glide: 0.18, arc: 0.07, gap: 1.0 },
  heron: { v: 6, f: 2.1, amp: 0.8, arc: 0.1, gap: 1.5 },
  dove: { v: 12, f: 6.5, amp: 0.95, glide: 0.2, arc: 0.08, gap: 0.8 },
  kiji: { v: 11, f: 15, amp: 1.0, whirr: 1.3, arc: 0.05, gap: 0.6 },
  kawa: { v: 10, f: 13, amp: 0.7, arc: 0.0, gap: 0.3 },
  muku: { v: 11, f: 9, amp: 0.9, glide: 0.3, arc: 0.08, gap: 0.6 },
  lark: { v: 6, f: 14, amp: 0.8, arc: 0.1, gap: 0.3 },
};

export class Birds {
  constructor({ shared, world, groundAt, poles, trees, rings }) {
    this.world = world;
    this.groundAt = groundAt;
    this.trees = trees;
    this.shared = shared;
    this._segCache = new Map();
    this.rings = rings;
    // 確かめ用に ?bseed=N で毎回同じ並びにできる
    const bs = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('bseed') : null;
    this.r = mulberry32(bs ? Number(bs) * 7919 : (Math.random() * 1e9) | 0);
    this.t = 0;
    this.calm = false;
    const N = world.N;
    this.texel = (x, z) => {
      const i = clamp(Math.round((x - world.ORIGIN) / world.CELL), 0, N - 1), j = clamp(Math.round((z - world.ORIGIN) / world.CELL), 0, N - 1);
      return j * N + i;
    };
    this.typeAt = (x, z) => world.type[this.texel(x, z)];
    this.waterAt = (x, z) => world.water[this.texel(x, z)];
    this.h = makeBirdHerds(shared);
    this.group = new THREE.Group();
    for (const h of Object.values(this.h)) this.group.add(h.mesh);
    this._habitats(poles);
    this._spawn();
  }

  // 木の樹冠（おおよその楕円体）
  crown(t) {
    if (t.sp === SP.SAKURA) { const H = 9 * t.s; return { x: t.x, y: t.y + H * 0.6, z: t.z, R: H * 0.66, Ry: H * 0.42, t }; }
    const c = SPECIES_CFG[t.sp];
    const H = c.height * t.s;
    return { x: t.x, y: t.y + H * (c.crownY || 0.6), z: t.z, R: H * (c.crownR || 0.35) * 1.05, Ry: H * (c.crownRy || 0.3), t };
  }
  // 樹冠の中の一点（楕円体。やぶのウグイスと、枝の形が読めない木の代わり）
  crownSpot(cr, r, k0 = 0.8, k1 = 0.96, y0 = -0.85, y1 = 0.45) {
    const a = r() * TAU, y = y0 + r() * (y1 - y0), rr = Math.sqrt(1 - y * y), k = k0 + r() * (k1 - k0);
    return [cr.x + Math.cos(a) * rr * cr.R * k, cr.y + y * cr.Ry * k, cr.z + Math.sin(a) * rr * cr.R * k, a];
  }
  // 木の実際の枝の上の点（trees の近景の形を読み、その木の位置・回転・大きさで世界へ）。風のしなりの式も写す
  perches(cr) {
    if (cr.perches !== undefined) return cr.perches;
    cr.perches = null;
    const t = cr.t, tr = this.trees;
    if (!tr) return null;
    try {
      let geo, mat, ox, oy, oz, s, rot, ph;
      if (t.hero) {
        if (!tr.heroInfo) return null;
        geo = tr.heroInfo.geo;
        const ip = geo.attributes.iPos.array, id = geo.attributes.iData.array;
        ox = ip[0]; oy = ip[1]; oz = ip[2]; s = ip[3]; rot = id[0]; ph = id[2];
        mat = tr.group.children.find((m) => m.geometry === geo)?.material;
      } else {
        if (!this._pmap) { this._pmap = new Map(); for (const p of tr.protos || []) for (const u of p.list || []) this._pmap.set(u, p); }
        const p = this._pmap.get(t);
        if (!p) return null;
        geo = (p.near && p.near.geo) || (p.nearMesh && p.nearMesh.geometry);
        mat = p.nearMesh && p.nearMesh.material;
        ox = t.x; oy = t.y - 0.15; oz = t.z; s = t.s; rot = t.rot; ph = (t.c * 13.7) % 1;
      }
      if (!geo) return null;
      let lp = this._segCache.get(geo);
      if (!lp) { lp = localPerches(branchSegs(geo)); this._segCache.set(geo, lp); }
      if (lp.length < 6) return null;
      const u = mat && mat.uniforms;
      const uH = u && u.uH ? u.uH.value : 9, flex = u && u.uFlex ? u.uFlex.value : 0.8;
      const c = Math.cos(rot), sn = Math.sin(rot);
      const out = [];
      let R = 0, y0 = 1e9, y1 = -1e9;
      for (const q of lp) {
        const x = q.p[0] * s, y = q.p[1] * s, z = q.p[2] * s;
        const dx = c * q.d[0] - sn * q.d[2], dz = sn * q.d[0] + c * q.d[2];
        const h01 = clamp(q.p[1] / uH, 0, 1.2);
        const w = { x: ox + c * x - sn * z, y: oy + y, z: oz + sn * x + c * z };
        out.push({ p: [w.x, w.y, w.z], yaw: yawTo(dx, dz) + Math.PI / 2, flat: q.flat, k: h01 * h01 * flex * s * uH * 0.25, out: Math.hypot(x, z) });
        R = Math.max(R, Math.hypot(x, z)); y0 = Math.min(y0, w.y); y1 = Math.max(y1, w.y);
      }
      cr.sway = { ph: ph * TAU };
      cr.R = R + 0.8; cr.y = (y0 + y1) / 2; cr.Ry = (y1 - y0) / 2 + 0.8;
      cr.perches = out;
    } catch (e) { cr.perches = null; }
    return cr.perches;
  }
  // 止まる点：[x, y, z, 向き, 枝の水平さ, 風のしなりの係数]。外寄りの枝を少し多めに（花や葉の陰に全部は隠れない）
  perchSpot(cr, r) {
    const P = this.perches(cr);
    if (P && P.length) {
      let q = P[Math.floor(r() * P.length)];
      const q2 = P[Math.floor(r() * P.length)];
      if (q2.out > q.out && r() < 0.6) q = q2;
      return [q.p[0], q.p[1], q.p[2], q.yaw + (r() < 0.5 ? 0 : Math.PI) + (r() - 0.5) * 0.5, q.flat, q.k];
    }
    // 形が読めないとき：楕円体の中ほど（花・葉の層の内側）
    const sp = this.crownSpot(cr, r, 0.6, 0.85, -0.1, 0.6);
    return [sp[0], sp[1], sp[2], r() * TAU, 0.5, 0];
  }
  // 木のしなり（trees.js の頂点の式と同じ）：止まっている鳥を枝と一緒に揺らす
  _treeBend(cr, k) {
    if (!k || !cr.sway) return [0, 0];
    const U = this.shared, W = U.uWind.value, O = U.uWindOff.value, tm = U.uTime.value;
    const qx = cr.x - O.x, qz = cr.z - O.y, a = qx * W.x + qz * W.y, b = -qx * W.y + qz * W.x;
    let g = vnoise2(a / 34, b / 70) * 0.65 + vnoise2(a / 13 + 17, b / 23 + 17) * 0.35;
    g = clamp((g - 0.34) / 0.52, 0, 1); g = g * g * (3 - 2 * g);
    const ws = W.z * (0.55 + W.w * g * 1.6), wl = Math.abs(ws);
    const ph = cr.sway.ph, oa = 0.25 + 0.2 * wl;
    return [(W.x * ws * 0.05 + Math.sin(tm * 1.1 + ph) * oa * 0.07) * k, (W.y * ws * 0.05 + Math.cos(tm * 0.83 + ph * 1.7) * oa * 0.07) * k];
  }

  // ---- 住む場所を世界から拾う（決まった種で毎回同じ） ----
  _habitats(poles) {
    const W = this.world, N = W.N;
    const hr = mulberry32(20260925);
    // しゃぼん玉の出発点のまわりほど多く（遠くの谷の端にもまばらに）
    const spots = [[HOUSES[0].x, HOUSES[0].z], [-150, 0], [KNOLL.x, KNOLL.z], [SHRINE.x, SHRINE.z], [BRIDGE.x, BRIDGE.z], [POND.x, POND.z], [RIDGE.x, RIDGE.z]];
    const near = (x, z) => { let d = 1e9; for (const [sx, sz] of spots) d = Math.min(d, Math.hypot(x - sx, z - sz)); return 0.12 + Math.exp(-((d / 180) ** 2)); };
    const sample = (test, want, tries = 120000) => {
      const out = [];
      for (let q = 0; q < tries && out.length < want; q++) {
        const i = 2 + Math.floor(hr() * (N - 4)), j = 2 + Math.floor(hr() * (N - 4));
        const x = W.ORIGIN + i * W.CELL, z = W.ORIGIN + j * W.CELL;
        if (hr() > near(x, z)) continue;
        if (test(j * N + i, x, z)) out.push([x, z]);
      }
      return out;
    };
    const dry = (k) => W.water[k] < -1000;
    // 水を張った田
    this.paddy = sample((k) => (W.type[k] === T.FLOODED || W.type[k] === T.SEEDLING) && W.water[k] > -1000 && W.sdf[k] > 1.5, 700);
    // 乾いた田畑（カラス・ムクドリ・キジ・ヒバリ）
    const FIELD = new Set([T.TILLED, T.FIELD]);
    this.fields = sample((k) => (FIELD.has(W.type[k]) || (W.type[k] === T.FALLOW && hr() < 0.3)) && dry(k) && W.sdf[k] > 1.2, 600);
    // 野（キジ）：原っぱ・菜の花・大きな土手・れんげ田の縁
    // 野（キジ）：畑・あぜ道・土手・原っぱ（草の低い所を多めに）
    const WILD = new Set([T.TILLED, T.DIRT, T.LEVEE_BIG, T.KNOLL, T.FIELD]);
    this.wild = sample((k, x, z) => (WILD.has(W.type[k]) || (W.type[k] === T.MEADOW && hr() < 0.35)) && dry(k) && W.forest[k] < 0.15 && floorT(x, z) < 30, 500);
    // 庭・道（キジバト）
    const YARD = new Set([T.YARD, T.GARDEN, T.DIRT, T.GRAVEL]);
    this.yards = sample((k) => YARD.has(W.type[k]) && dry(k), 300);
    // 川の浅瀬（アオサギ）：岸から水へ入ってすぐ
    this.shallows = [];
    for (let x = -700; x < 600; x += 7) {
      for (const sd of [-1, 1]) {
        for (let d = 2; d < 14; d += 0.75) {
          const z = riverZ(x) + sd * d;
          const w = this.waterAt(x, z), g = this.groundAt(x, z);
          if (w > -1000 && w - g < 0.28 && w - g > 0.04) { this.shallows.push([x, z, sd]); break; }
        }
      }
    }
    // 木
    this.sakura = W.trees.filter((t) => t.sp === SP.SAKURA).map((t) => this.crown(t));
    const nearVillage = (t) => HOUSES.some((h) => Math.hypot(h.x - t.x, h.z - t.z) < 45) || Math.hypot(t.x - KNOLL.x, t.z - KNOLL.z) < 40;
    this.camellia = W.trees.filter((t) => (t.sp === SP.CAMELLIA || t.sp === SP.KAKI) && nearVillage(t)).map((t) => this.crown(t));
    this.broad = W.trees.filter((t) => (t.sp === SP.KOBUSHI || t.sp === SP.KEYAKI || t.sp === SP.OAK || t.sp === SP.YAMAZAKURA) && nearVillage(t)).map((t) => this.crown(t));
    this.shrubs = W.trees.filter((t) => t.sp === SP.SHRUB && nearVillage(t)).map((t) => this.crown(t));
    // カラスの止まり木：電柱のてっぺん・村のまわりの高い木のてっぺん
    this.poleTops = poles.map((p) => [p.x, p.y + 8.62, p.z]);
    this.treeTops = W.trees.filter((t) => (t.sp === SP.CEDAR || t.sp === SP.OAK || t.sp === SP.KEYAKI) && nearVillage(t)).map((t) => { const c = this.crown(t); return [t.x, c.y + c.Ry * 0.95, t.z]; });
    // 屋根の棟・電線（キジバト）
    // 棟の上面の高さと半分の長さは buildings.js の屋根の式から（寄棟の棟の端より先へ出ない）
    this.ridges = HOUSES.filter((h) => h.info && h.y !== undefined).map((h) => {
      const top = h.info.top;
      let yT, hl;
      if (h.type === 'kaya') { const y1 = top - 0.55, rr = Math.max(1.2, (h.w / 2 + 1.45) * 0.46); yT = y1 + 0.49; hl = rr + 0.4; }
      else if (h.type === 'kawara2') { const y3 = top - 0.5, a2 = h.w * 0.36 + 0.85, b2 = h.d * 0.36 + 0.85, rr2 = Math.max(1.0, a2 - b2 * 0.95); yT = y3 + 0.3; hl = rr2 + 0.25; }
      else { const y1 = top - 0.5, rr = Math.max(1.5, (h.w / 2 + 0.95) - (h.d / 2 + 0.95) * 0.95); yT = y1 + 0.33; hl = rr + 0.3; }
      const c = Math.cos(h.rot), s = Math.sin(h.rot);
      return { a: [h.x - c * hl, h.y + yT, h.z + s * hl], b: [h.x + c * hl, h.y + yT, h.z - s * hl] };
    });
    this.wires = [];
    for (let i = 1; i < poles.length; i++) {
      const p0 = poles[i - 1], p1 = poles[i];
      const Lw = Math.hypot(p1.x - p0.x, p1.z - p0.z);
      if (Lw > 60) continue;
      const off = (p) => { const c = Math.cos(-p.dir), s = Math.sin(-p.dir); return [p.x + 0.75 * s, p.y + 8.34, p.z + 0.75 * c]; };
      this.wires.push({ a: off(p0), b: off(p1), sag: 0.012 * Lw * Lw / 8 + 0.25 });
    }
    // カワセミの杭：川（土手の近く・橋の近く）と池の岸、滝つぼの岩
    this.stakes = [];
    for (const x of [-150, -40, -262, -96, 28, 118]) {
      const zc = riverZ(x);
      for (const sd of [1, -1]) {
        let edge = null;
        for (let d = 1; d < 20; d += 0.25) { const z = zc + sd * d; if (this.waterAt(x, z) < this.groundAt(x, z) + 0.02) { edge = z - sd * 0.6; break; } }
        if (edge !== null) {
          const yaw = Math.atan2(sd, 0.35);      // 小枝が川の中ほどへ向く（-sd の向き）
          this.stakes.push({ x, z: edge, y: this.groundAt(x, edge), yaw: Math.atan2(-(-sd), 0.3), wl: riverLevel(x) });
          void yaw;
          break;
        }
      }
    }
    {
      // 池の杭：岸から中へ、地面が水面より 0.15m 以上低くなる所まで寄せる
      const a = 2.35;
      let e = 0.985, x, z;
      for (; e > 0.6; e -= 0.01) { x = POND.x + Math.cos(a) * POND.rx * e; z = POND.z + Math.sin(a) * POND.rz * e; if (this.groundAt(x, z) < W.pondLevel - 0.15) break; }
      const dx = POND.x - x, dz = POND.z - z;
      this.stakes.push({ x, z, y: this.groundAt(x, z), yaw: Math.atan2(-dz, dx), wl: W.pondLevel, pond: true });
    }
    this.perchRocks = [];
    const [px, py, pz] = W.gorge.pool;
    // 岩のまわりの水面（滝つぼか渓流の淵）を探し、その水位と向きを持たせる。水面より上に頭を出した岩だけ
    for (const q of W.rocks) {
      if (!(q.wet > 0.3 && q.s < 1.8 && Math.hypot(q.x - px, q.z - pz) < 26)) continue;
      const top = q.y + q.s * (0.2 + 0.62 * q.flat) * 0.95;
      let wl = -1e9, ox = 0, oz = 0;
      for (let i = 0; i < 12; i++) {
        const a = i / 12 * TAU, x = q.x + Math.cos(a) * (q.s + 1.2), z = q.z + Math.sin(a) * (q.s + 1.2);
        const w = this.waterAt(x, z);
        if (w > this.groundAt(x, z) + 0.15 && w > wl) { wl = w; ox = Math.cos(a); oz = Math.sin(a); }
      }
      if (wl > -1000 && top > wl + 0.2) this.perchRocks.push([q.x, top, q.z, wl, ox, oz]);
    }
    void py;
    // 杭の先の小枝（カワセミが止まる所）
    for (const s of this.stakes) {
      const tip = rotYv([0.36, 1.07, 0.06], s.yaw);
      s.perch = [s.x + tip[0], s.y + tip[1], s.z + tip[2]];
      const top = rotYv([0.03, 1.16, 0.02], s.yaw);
      s.top = [s.x + top[0], s.y + top[1], s.z + top[2]];
      s.out = rotYv([1, 0, 0], s.yaw);
    }
  }

  _spawn() {
    const r = this.r;
    const pick = (a) => a[Math.floor(r() * a.length)];
    const W = this.world;
    // アオサギ
    this.herons = [];
    const hspots = [];
    for (let i = 0; i < 8 && this.paddy.length; i++) hspots.push({ at: pick(this.paddy), home: 'paddy' });
    const sh = this.shallows.filter((s) => s[0] > -420 && s[0] < 260);
    for (let i = 0; i < 3 && sh.length; i++) { const s = pick(sh); hspots.push({ at: [s[0], s[1]], home: 'river' }); }
    {
      const a = -0.6, e = 1.03;
      hspots.push({ at: [POND.x + Math.cos(a) * POND.rx * e, POND.z + Math.sin(a) * POND.rz * e], home: 'pond' });
    }
    for (const s of hspots) {
      const [x, z] = s.at;
      this.herons.push({ x, z, y: this.groundAt(x, z), yaw: r() * TAU, st: 'stand', t: r() * 8, next: 8 + r() * 20, ext: r() < 0.5 ? -0.8 : 0, extT: 0, walk: 0, wph: 0, fly: 0, flap: r() * 6, amp: 0, home: s.home, look: 0, lookT: 0, pitch: 0 });
    }
    // カワセミ：杭ごとに一羽、滝つぼの岩に一羽
    this.kingfishers = [];
    for (const s of this.stakes) this.kingfishers.push({ perch: s.perch, wl: s.wl, out: s.out, st: 'perch', t: r() * 5, next: 4 + r() * 8, x: s.perch[0], y: s.perch[1], z: s.perch[2], yaw: yawTo(s.out[0], s.out[2]) + (r() - 0.5) * 1.2, head: 0, tail: 0, fly: 0, flap: 0, amp: 0, pitch: 0, bob: 0, home: s, kind: s.pond ? 'pond' : 'river' });
    if (this.perchRocks.length) {
      const q = pick(this.perchRocks);
      const out = [q[4], 0, q[5]];
      const ol = 1;
      this.kingfishers.push({ perch: [q[0], q[1], q[2]], wl: q[3], out: [out[0] / ol, 0, out[2] / ol], st: 'perch', t: 0, next: 5, x: q[0], y: q[1], z: q[2], yaw: yawTo(out[0], out[2]), head: 0, tail: 0, fly: 0, flap: 0, amp: 0, pitch: 0, bob: 0, home: { perch: [q[0], q[1], q[2]], wl: q[3] }, kind: 'pool' });
    }
    for (const k of this.kingfishers) k.paths = this._kingPaths(k, k.kind);
    // キジ：雄5・雌3
    this.pheasants = [];
    for (let i = 0; i < 8 && this.wild.length; i++) {
      const [x, z] = pick(this.wild);
      this.pheasants.push({ male: i < 5, x, z, y: this.groundAt(x, z), yaw: r() * TAU, st: 'walk', t: 0, next: 3 + r() * 5, wph: 0, walk: 0, head: 0.5, tail: 0, fly: 0, flap: 0, amp: 0, pitch: 0, home: [x, z], spd: 0 });
    }
    // カラス：小さな群れ
    this.crows = [];
    for (let g = 0; g < 5; g++) {
      const base = pick(this.fields);
      const n = 2 + Math.floor(r() * 3);
      for (let i = 0; i < n; i++) {
        const x = base[0] + (r() - 0.5) * 12, z = base[1] + (r() - 0.5) * 12;
        this.crows.push({ g, x, z, y: this.groundAt(x, z), yaw: r() * TAU, st: 'walk', t: r() * 4, next: 2 + r() * 4, wph: 0, walk: 0, head: 0, hy: 0, tail: 0, fly: 0, flap: 0, amp: 0, pitch: 0, roll: 0, ground: true });
      }
    }
    // キジバト：つがい
    this.doves = [];
    for (let g = 0; g < 7; g++) {
      const base = pick(this.yards.length ? this.yards : this.fields);
      for (let i = 0; i < 2; i++) {
        const x = base[0] + (r() - 0.5) * 3, z = base[1] + (r() - 0.5) * 3;
        this.doves.push({ g, x, z, y: this.groundAt(x, z), yaw: r() * TAU, st: 'walk', t: r() * 3, next: 2 + r() * 3, wph: 0, walk: 0, head: 0, tail: 0, fly: 0, flap: 0, amp: 0, pitch: 0, roll: 0, ground: true });
      }
    }
    // メジロ・シジュウカラ・ヒヨドリ：木の群れ
    this.treeFlocks = [];
    const mkFlock = (kind, trees, n, cr0) => {
      const cr = cr0 || pick(trees);
      const fl = { kind, trees, cr, birds: [], t: 0, next: 25 + r() * 40, st: 'tree' };
      for (let i = 0; i < n; i++) {
        const s = this.perchSpot(cr, r);
        fl.birds.push({ x: s[0], y: s[1], z: s[2], yaw: s[3], pyaw: s[3], flat: s[4], bk: s[5], swk: 1, st: 'sit', t: r() * 2, next: 0.5 + r() * 2.5, fly: 0, flap: r() * 6, amp: 0, head: 0, hy: 0, tail: 0, pitch: 0, roll: 0, hang: 0 });
      }
      this.treeFlocks.push(fl);
    };
    if (this.sakura.length) {
      // 土手の桜並木にいくつか、一本桜にひとつ
      const row = this.sakura.filter((c) => !c.t.hero);
      for (let i = 0; i < 6 && row.length; i++) mkFlock('mejiro', this.sakura, 4 + Math.floor(r() * 5), row[Math.floor((i + 0.5) / 6 * row.length)]);
      const hero = this.sakura.find((c) => c.t.hero);
      if (hero) mkFlock('mejiro', this.sakura, 7, hero);
    }
    if (this.camellia.length) for (let i = 0; i < 2; i++) mkFlock('mejiro', this.camellia, 3 + Math.floor(r() * 3));
    const titTrees = this.sakura.concat(this.broad);
    for (let i = 0; i < 5 && titTrees.length; i++) mkFlock('shijukara', titTrees, 2);
    const hiyoTrees = this.sakura.concat(this.camellia);
    for (let i = 0; i < 6 && hiyoTrees.length; i++) mkFlock('hiyodori', hiyoTrees, 1);
    // ウグイス：やぶの中
    this.warblers = [];
    for (let i = 0; i < 5 && this.shrubs.length; i++) {
      const cr = pick(this.shrubs);
      const s = this.crownSpot(cr, r, 0.3, 0.8);
      this.warblers.push({ cr, x: s[0], y: s[1], z: s[2], yaw: r() * TAU, t: 0, next: 1 + r() * 3, st: 'sit', head: 0, hy: 0, tail: 0.2, fly: 0, flap: 0, amp: 0 });
    }
    // ムクドリ：群れで田畑を歩く
    this.starFlocks = [];
    for (let g = 0; g < 3 && this.fields.length; g++) {
      const base = pick(this.fields);
      const fl = { cx: base[0], cz: base[1], yaw: r() * TAU, birds: [], st: 'ground', t: 0, next: 30 + r() * 50 };
      const n = 12 + Math.floor(r() * 10);
      for (let i = 0; i < n; i++) {
        const x = base[0] + (r() - 0.5) * 8, z = base[1] + (r() - 0.5) * 8;
        fl.birds.push({ x, z, y: this.groundAt(x, z), yaw: fl.yaw + (r() - 0.5) * 1.2, st: 'walk', t: r() * 3, next: 1 + r() * 3, wph: r() * 6, walk: 0, head: 0, fly: 0, flap: r() * 6, amp: 0, pitch: 0, roll: 0, dly: r() * 0.6 });
      }
      this.starFlocks.push(fl);
    }
    // ヒバリ：空で停空（5）、畑の地面（3）
    this.larks = [];
    for (let i = 0; i < 8 && this.fields.length; i++) {
      const [x, z] = pick(this.fields);
      const air = i < 5;
      const gy = this.groundAt(x, z);
      this.larks.push({ x, z, y: air ? gy + 25 + r() * 45 : gy, gy, hx: x, hz: z, st: air ? 'hover' : 'walk', t: r() * 60, next: air ? 40 + r() * 80 : 5 + r() * 10, fly: air ? 1 : 0, flap: r() * 6, amp: air ? 0.7 : 0, yaw: r() * TAU, head: 0, tail: 0, wph: 0, walk: 0, pitch: 0 });
    }
  }

  // ---- 飛ぶ（A→B を弧で。飛び方の型ごとに羽ばたく） ----
  _fly(b, to, sty, o = {}) {
    const D = Math.hypot(to[0] - b.x, to[2] - b.z);
    const dur = Math.max(o.minDur ?? 0.5, (D + Math.abs(to[1] - b.y) * 0.6) / sty.v);
    b.f = { x0: b.x, y0: b.y, z0: b.z, x1: to[0], y1: to[1], z1: to[2], t: 0, dur, arc: Math.min(o.maxArc ?? 10, D * sty.arc) + (o.arc || 0), sty, D, land: o.land ?? true };
    b.st = 'fly';
  }
  _flyStep(b, dt) {
    const f = b.f, s = f.sty;
    f.t += dt;
    const u = Math.min(1, f.t / f.dur);
    // 中ほどは一定の速さ（最初と最後だけゆるむ）
    const e = u < 0.15 ? (u * u) / 0.3 : u > 0.85 ? 1 - ((1 - u) * (1 - u)) / 0.3 : (u - 0.075) / 0.85;
    let y = lerp(f.y0, f.y1, ease(u)) + f.arc * Math.sin(Math.PI * u);
    let flapping = true;
    if (s.bound) {
      const cp = (f.t / s.cyc) % 1;
      flapping = cp < s.bound || u > 0.85 || u < 0.1;
      y += s.wave * (cp < s.bound ? cp / s.bound - 0.5 : 0.5 - (cp - s.bound) / (1 - s.bound)) * Math.sin(Math.PI * u);
    }
    if (s.glide && u > 0.25 && u < 0.8) flapping = Math.sin(f.t * 1.3 + f.D) > s.glide * 2 - 1 ? true : ((f.t * 0.7) % 1) > s.glide;
    if (s.whirr && f.t > s.whirr && u < 0.85) flapping = ((f.t - s.whirr) % 2.2) < 0.5;
    const x = lerp(f.x0, f.x1, e), z = lerp(f.z0, f.z1, e);
    // 地面の下へもぐらない：いまの所と少し先（0.4・0.9・1.5秒先）の地面を見て持ち上げる。上がる速さに上限をつけて跳ねを丸める
    f.lift = f.lift || 0;
    if (u > 0.03 && u < 0.97) {
      let g = this.groundAt(x, z);
      for (const la of [0.4, 0.9, 1.5]) { const ea = Math.min(1, e + la * s.v / Math.max(f.D, 1)); g = Math.max(g, this.groundAt(lerp(f.x0, f.x1, ea), lerp(f.z0, f.z1, ea))); }
      const need = Math.max(0, g + (s.gap ?? 0.5) - y);
      f.lift = need > f.lift ? Math.min(need, f.lift + s.v * dt * 2) : f.lift + (need - f.lift) * (1 - Math.exp(-dt * 1.5));
    } else f.lift *= Math.exp(-dt * 10);
    y += f.lift * (u > 0.86 ? Math.max(0, (1 - u) / 0.14) : 1);
    // 降りる終わりぎわも、足元の地面より下へは入らない（持ち上げを抜いた分で丘にかかるとき）
    if (u < 1) y = Math.max(y, this.groundAt(x, z) + (s.gap ?? 0.5) * Math.min(1, (1 - u) / 0.1));
    const dx = x - b.x, dz = z - b.z, dy = y - b.y;
    const dh = Math.hypot(dx, dz);
    if (dh > 1e-5) {
      const ny = yawTo(dx, dz);
      const dyaw = wrapPi(ny - b.yaw);
      b.roll = lerp(b.roll || 0, clamp(-dyaw / Math.max(dt, 1e-3) * 0.25, -0.9, 0.9), 1 - Math.exp(-dt * 6));
      b.yaw = ny;
    }
    let pitch = clamp(-Math.atan2(dy, Math.max(dh, 1e-4)) * 0.6, -0.7, 0.7);
    if (u > 0.82 && f.land) pitch = lerp(pitch, -0.75, (u - 0.82) / 0.18);
    if (u < 0.1) pitch = lerp(-0.45, pitch, u / 0.1);
    b.pitch = lerp(b.pitch || 0, pitch, 1 - Math.exp(-dt * 8));
    b.x = x; b.y = y; b.z = z;
    const fk = u > 0.85 ? 1.25 : 1;
    b.amp = lerp(b.amp || 0, flapping ? s.amp : 0, 1 - Math.exp(-dt * 14));
    b.flap = (b.flap || 0) + dt * TAU * s.f * fk * (flapping ? 1 : 0.15);
    // 閉じる型（小鳥の波形飛行）は羽ばたかない間は翼をたたむ
    const spread = s.bound ? (flapping ? 1 : 0) : 1;
    b.fly = lerp(b.fly || 0, u >= 1 ? 0 : spread, 1 - Math.exp(-dt * 30));
    if (!s.bound && u < 1) b.fly = Math.max(b.fly, Math.min(1, f.t * 8));
    b.tuck = u < 0.88 ? 1 : Math.max(0, (1 - u) / 0.12);
    if (u >= 1) { b.fly = 0; b.amp = 0; b.pitch = 0; b.roll = 0; b.tuck = 0; return true; }
    return false;
  }
  // 折れ線の角を丸める（Chaikin 2回）
  _smooth(pts) {
    let q = pts;
    for (let it = 0; it < 2; it++) {
      const o = [q[0]];
      for (let i = 0; i < q.length - 1; i++) { const a = q[i], c = q[i + 1]; o.push([a[0] * 0.75 + c[0] * 0.25, a[1] * 0.75 + c[1] * 0.25, a[2] * 0.75 + c[2] * 0.25], [a[0] * 0.25 + c[0] * 0.75, a[1] * 0.25 + c[1] * 0.75, a[2] * 0.25 + c[2] * 0.75]); }
      o.push(q[q.length - 1]); q = o;
    }
    return q;
  }
  // 道の全体が地面より gap 上にあるか（1mおきに調べる。最初の skip m は止まり木から降りる所なので除く）
  _pathOK(q, gap, skip = 1.5) {
    let acc = 0;
    for (let i = 1; i < q.length; i++) {
      const a = q[i - 1], c = q[i], L = Math.hypot(c[0] - a[0], c[1] - a[1], c[2] - a[2]), n = Math.max(1, Math.ceil(L));
      for (let k = 1; k <= n; k++) {
        const f = k / n, x = lerp(a[0], c[0], f), y = lerp(a[1], c[1], f), z = lerp(a[2], c[2], f);
        if (acc + L * f > skip && y < this.groundAt(x, z) + gap) return false;
      }
      acc += L;
    }
    return true;
  }
  // 折れ線に沿って飛ぶ（出だしと終わりはゆるむ）
  _pathStart(b, q, sty) {
    const cum = [0];
    for (let i = 1; i < q.length; i++) cum.push(cum[i - 1] + Math.hypot(q[i][0] - q[i - 1][0], q[i][1] - q[i - 1][1], q[i][2] - q[i - 1][2]));
    b.pth = { q, cum, L: cum[cum.length - 1], s: 0, sty, i: 1 };
    b.st = 'path'; b.t = 0;
  }
  _pathStep(b, dt) {
    const P = b.pth, sty = P.sty;
    const k = Math.min(1, 0.35 + P.s / 3, 0.35 + (P.L - P.s) / 3);
    P.s = Math.min(P.L, P.s + sty.v * k * dt);
    while (P.i < P.cum.length - 1 && P.cum[P.i] < P.s) P.i++;
    const a = P.q[P.i - 1], c = P.q[P.i], f = clamp((P.s - P.cum[P.i - 1]) / Math.max(1e-6, P.cum[P.i] - P.cum[P.i - 1]), 0, 1);
    const dx = c[0] - a[0], dz = c[2] - a[2], dh = Math.hypot(dx, dz);
    if (dh > 1e-5) {
      const ny = yawTo(dx, dz);
      b.roll = lerp(b.roll || 0, clamp(-wrapPi(ny - b.yaw) * 1.5, -0.8, 0.8), 1 - Math.exp(-dt * 6));
      b.yaw = turnTo(b.yaw, ny, 1 - Math.exp(-dt * 12));
    }
    b.pitch = lerp(b.pitch || 0, clamp(-Math.atan2(c[1] - a[1], Math.max(dh, 1e-4)) * 0.6, -0.7, 0.7), 1 - Math.exp(-dt * 8));
    b.x = lerp(a[0], c[0], f); b.y = lerp(a[1], c[1], f); b.z = lerp(a[2], c[2], f);
    b.fly = 1; b.amp = lerp(b.amp || 0, sty.amp, 1 - Math.exp(-dt * 14)); b.flap = (b.flap || 0) + dt * TAU * sty.f;
    b.tuck = Math.min(1, (P.L - P.s) / 0.8);
    if (P.s >= P.L) { b.fly = 0; b.amp = 0; b.pitch = 0; b.roll = 0; b.tuck = 0; return true; }
    return false;
  }
  // カワセミの逃げ道：川は川筋に沿って、池は岸の楕円に沿って、滝つぼは淵の上から渓流を下る。地面にかかる道は捨てる
  _kingPaths(k, kind) {
    const W = this.world, out = [];
    const lvl = (x, z) => Math.max(this.waterAt(x, z), this.groundAt(x, z));
    const add = (pts) => { const q = this._smooth([k.perch.slice(), ...pts]); if (this._pathOK(q, 0.3)) out.push(q); };
    if (kind === 'river') {
      const off = k.perch[2] - riverZ(k.perch[0]);
      for (const sd of [1, -1]) {
        const pts = [];
        for (let i = 1; i <= 6; i++) { const x = k.perch[0] + sd * (i * 7 - 3), z = riverZ(x) + off * 0.5; pts.push([x, Math.max(riverLevel(x), lvl(x, z)) + 0.5, z]); }
        add(pts);
      }
    } else if (kind === 'pond') {
      const a0 = Math.atan2((k.perch[2] - POND.z) / POND.rz, (k.perch[0] - POND.x) / POND.rx), rm = (POND.rx + POND.rz) / 2;
      for (const sd of [1, -1]) {
        const pts = [];
        for (let i = 1; i <= 7; i++) { const a = a0 + sd * (i * 6 - 2) / rm, e = 0.72; const x = POND.x + Math.cos(a) * POND.rx * e, z = POND.z + Math.sin(a) * POND.rz * e; pts.push([x, W.pondLevel + 0.5, z]); }
        add(pts);
      }
    } else if (kind === 'pool') {
      // 渓流の中心線の、止まり木にいちばん近い所から下流へ・上流（滝つぼ）へ
      const cl = (sS) => gorgeWorld(sS, sS > GORGE.sTop ? 0 : streamA(sS));
      let s0 = GORGE.sIn, db = 1e9;
      for (let sS = GORGE.sIn; sS <= GORGE.sPool; sS += 0.5) { const [x, z] = cl(sS); const d = Math.hypot(x - k.perch[0], z - k.perch[2]); if (d < db) { db = d; s0 = sS; } }
      for (const sd of [-1, 1]) {
        const pts = [];
        for (let i = 0; i < 9; i++) { const sS = s0 + sd * (i * 5 + 1.5); if (sS > GORGE.sPool + 1 || sS < GORGE.sIn) break; const [x, z] = cl(sS); pts.push([x, lvl(x, z) + 0.6, z]); }
        if (pts.length >= 3) add(pts);
      }
    }
    return out;
  }
  // 地面を歩く（水・急な所には入らない）
  _walk(b, sp, dt, ok) {
    const nx = b.x + Math.sin(b.yaw) * sp * dt, nz = b.z + Math.cos(b.yaw) * sp * dt;
    const g0 = this.groundAt(b.x, b.z), g1 = this.groundAt(nx, nz);
    if (Math.abs(g1 - g0) < 0.6 * dt * Math.max(1, sp) + 0.02 && (!ok || ok(nx, nz))) { b.x = nx; b.z = nz; return true; }
    b.yaw += (1.5 + this.r()) * dt * 2;
    return false;
  }
  _dry(x, z) { return this.waterAt(x, z) < this.groundAt(x, z) + 0.01; }
  _setPerch(b, s) { b.pyaw = s[3] ?? b.yaw; b.flat = s[4] ?? 0.5; b.bk = s[5] ?? 0; }

  update(dt, cam) {
    if (this.freeze) dt = 0;
    this.t += dt;
    for (const h of Object.values(this.h)) h.begin();
    if (this.lineupAt) { this._lineup(); for (const h of Object.values(this.h)) h.end(); return; }
    const r = this.r;
    const cx = cam.x, cy = cam.y, cz = cam.z;
    const K = this.calm ? 1e-3 : 1;
    const d3 = (x, y, z) => Math.hypot(x - cx, y - cy, z - cz);
    const H = this.h;
    const P = (h, b, sc = 1, extra = {}) => {
      const w = b.st === 'fly' ? -(b.tuck ?? 1) : (b.walk || 0);
      h.push(b.x, b.y, b.z, b.yaw, b.pitch || 0, b.roll || 0, sc, w, b.fly || 0, b.flap || 0, extra.head ?? b.head ?? 0, extra.tail ?? b.tail ?? 0, b.wph || 0, b.hy || 0, b.amp || 0, b.var ?? 0.5);
    };

    // ---- 杭 ----
    for (const s of this.stakes) if (d3(s.x, s.y, s.z) < 200) H.stake.push(s.x, s.y, s.z, s.yaw, 0, 0, 1, 0);

    // ---- アオサギ：じっと立つ・そろりと歩く・首をのばして突く・ゆっくり飛ぶ ----
    for (const e of this.herons) {
      e.t += dt;
      const dc = d3(e.x, e.y + 0.8, e.z);
      if (e.st !== 'fly' && dc < 20 * K) { this._heronFly(e); }
      if (e.st === 'stand') {
        e.walk += (0 - e.walk) * (1 - Math.exp(-dt * 4));
        // 首：縮めて休む／のばして見張る
        e.ext += ((e.rest ? -0.85 : 0) - e.ext) * (1 - Math.exp(-dt * 1.5));
        e.lookT -= dt;
        if (e.lookT < 0) { e.lookT = 2 + r() * 5; e.look = (r() - 0.5) * 1.2; }
        e.hy += (e.look - (e.hy || 0)) * (1 - Math.exp(-dt * 2));
        if (e.t > e.next) {
          e.t = 0;
          const u = r();
          if (u < 0.3) { e.st = 'walk'; e.next = 3 + r() * 5; e.yaw += (r() - 0.5) * 1.8; e.rest = false; }
          else if (u < 0.55) { e.st = 'strike'; e.next = 1.2; e.rest = false; }
          else if (u < 0.62) this._heronFly(e);
          else { e.rest = r() < 0.5; e.next = 8 + r() * 20; }
        }
      } else if (e.st === 'walk') {
        e.walk += (1 - e.walk) * (1 - Math.exp(-dt * 2));
        e.ext += (0.25 - e.ext) * (1 - Math.exp(-dt * 2));
        e.wph += dt * 2.4;
        const ok = (x, z) => { const tp = this.typeAt(x, z); const w = this.waterAt(x, z), g = this.groundAt(x, z); return (tp === T.FLOODED || tp === T.SEEDLING || tp === T.BANK || tp === T.RIVER || tp === T.MEADOW) && w - g < 0.3; };
        this._walk(e, 0.16 * e.walk, dt, ok);
        // 水の中を歩くと一歩ごとに波紋
        e.stepT = (e.stepT ?? 0) - dt;
        if (e.stepT < 0) { e.stepT = 1.3; if (this.waterAt(e.x, e.z) > this.groundAt(e.x, e.z) + 0.01 && d3(e.x, e.y, e.z) < 90) this.rings(e.x + Math.sin(e.yaw) * 0.1, e.z + Math.cos(e.yaw) * 0.1, 0.35); }
        if (e.t > e.next) { e.st = 'stand'; e.t = 0; e.next = 6 + r() * 14; }
      } else if (e.st === 'strike') {
        const u = e.t / e.next;
        e.ext = u < 0.18 ? lerp(0.3, 1.0, u / 0.18) : u < 0.4 ? 1.0 : lerp(1.0, 0.1, (u - 0.4) / 0.6);
        e.pitch = u < 0.18 ? 0.25 * u / 0.18 : u < 0.4 ? 0.25 : 0.25 * (1 - (u - 0.4) / 0.6);
        if (u > 0.18 && !e.splashed) { e.splashed = true; const hx = e.x + Math.sin(e.yaw) * 0.55, hz = e.z + Math.cos(e.yaw) * 0.55; if (this.waterAt(hx, hz) > this.groundAt(hx, hz)) this.rings(hx, hz, 0.7); }
        if (e.t > e.next) { e.st = 'stand'; e.t = 0; e.next = 5 + r() * 12; e.splashed = false; e.pitch = 0; }
      } else if (e.st === 'fly') {
        e.ext = 0;
        const done = this._flyStep(e, dt);
        // 飛ぶ間は体を水平に（頭は首を縮めて肩の上）
        e.pitch = clamp(e.pitch, -0.5, 0.3) + 0.12;
        if (done) { e.st = 'stand'; e.t = 0; e.next = 6 + r() * 12; e.y = this.groundAt(e.x, e.z); e.rest = false; e.pitch = 0; }
      }
      if (e.st !== 'fly') { e.y = this.groundAt(e.x, e.z) - 0.02; e.fly = 0; e.amp = 0; }
      if (dc < 380) H.aosagi.push(e.x, e.y, e.z, e.yaw, e.pitch || 0, e.roll || 0, 1, e.st === 'fly' ? -(e.tuck ?? 1) : e.walk, e.fly, e.flap, e.ext, 0, e.wph, e.hy || 0, e.amp, 0.5);
    }

    // ---- カワセミ：杭の先で首をふる・水へ飛びこむ・低く速く飛んで戻る ----
    for (const k of this.kingfishers) {
      k.t += dt;
      const dc = d3(k.x, k.y, k.z);
      if (k.st === 'perch') {
        k.x = k.perch[0]; k.y = k.perch[1]; k.z = k.perch[2]; k.fly = 0; k.amp = 0; k.pitch = 0; k.roll = 0;
        // 水面をのぞく・ときどき尾を上下
        k.head = Math.sin(this.t * 0.8 + k.x) > 0.3 ? 0.55 : 0.05;
        k.hy = Math.sin(this.t * 0.5 + k.z) * 0.6;
        k.tail = Math.max(0, Math.sin(this.t * 3 + k.x * 3)) ** 10 * 0.6;
        k.bob = Math.max(0, Math.sin(this.t * 2.1 + k.z)) ** 12;
        k.pitch = -0.1 + 0.15 * k.bob;
        if (dc < 9 * K && k.paths.length) {
          // 逃げる：川筋・池の岸・渓流に沿って水面の上を低く遠くへ飛び、同じ道を戻る（道のない所では逃げない）
          const q = k.paths[Math.floor(r() * k.paths.length)];
          this._pathStart(k, q, STY.kawa); k.after = q;
        } else if (k.t > k.next) {
          k.t = 0;
          if (r() < 0.6) {
            // 飛びこむ：水面の一点へまっすぐ
            const d = 1.5 + r() * 2.5, ang = (r() - 0.5) * 0.8;
            const o = rotYv(k.out, ang);
            k.dive = { x0: k.x, y0: k.y, z0: k.z, x1: k.perch[0] + o[0] * d, z1: k.perch[2] + o[2] * d, t: 0 };
            k.st = 'dive';
          } else { k.next = 3 + r() * 6; k.yaw = yawTo(k.out[0], k.out[2]) + (r() - 0.5) * 1.6; }
        }
      } else if (k.st === 'dive') {
        const dv = k.dive; dv.t += dt;
        const T1 = 0.55, T2 = 0.45, T3 = 1.1;
        if (dv.t < T1) {
          // 頭から水へ（翼を半ば閉じる）
          const u = dv.t / T1, e = u * u;
          k.x = lerp(dv.x0, dv.x1, e); k.z = lerp(dv.z0, dv.z1, e); k.y = lerp(dv.y0, k.wl, e);
          k.yaw = yawTo(dv.x1 - dv.x0, dv.z1 - dv.z0); k.pitch = lerp(0.4, 1.35, u); k.fly = u < 0.3 ? 1 : 0.35; k.amp = u < 0.3 ? 0.8 : 0; k.flap += dt * TAU * 12; k.tuck = 1; k.st = 'dive';
          k.hidden = false;
        } else if (dv.t < T1 + T2) {
          if (!dv.splash) { dv.splash = true; this.rings(dv.x1, dv.z1, 1.1); }
          k.hidden = true;
        } else if (dv.t < T1 + T2 + T3) {
          if (!dv.out) { dv.out = true; this.rings(dv.x1, dv.z1, 0.6); }
          const u = (dv.t - T1 - T2) / T3, e = ease(u);
          k.hidden = false;
          k.x = lerp(dv.x1, k.perch[0], e); k.z = lerp(dv.z1, k.perch[2], e); k.y = lerp(k.wl + 0.05, k.perch[1], e) + Math.sin(Math.PI * u) * 0.25;
          k.yaw = yawTo(k.perch[0] - dv.x1, k.perch[2] - dv.z1); k.pitch = lerp(-0.6, -0.3, u); k.fly = 1; k.amp = 0.9; k.flap += dt * TAU * 14; k.tuck = 1;
        } else { k.st = 'perch'; k.t = 0; k.next = 4 + r() * 8; k.yaw = yawTo(k.out[0], k.out[2]) + Math.PI * (r() < 0.5 ? 0.9 : -0.9) * 0.5; }
      } else if (k.st === 'path') {
        if (this._pathStep(k, dt)) {
          if (k.after) { const q = k.after.slice().reverse(); k.after = null; k.wait = 3 + r() * 6; k.st = 'away'; k.back = q; k.t = 0; }
          else { k.st = 'perch'; k.t = 0; k.next = 3 + r() * 5; }
        }
      } else if (k.st === 'away') {
        // 逃げた先の水面の上で停空しながら待ち、しゃぼん玉が杭から離れたら同じ道を戻る
        k.fly = 1; k.amp = 0.75; k.flap += dt * TAU * 15; k.tuck = 1; k.roll *= 0.9;
        k.pitch = lerp(k.pitch, -0.7, 1 - Math.exp(-dt * 4));
        k.y = k.back[0][1] + Math.sin(this.t * 2.3) * 0.06;
        k.yaw = turnTo(k.yaw, yawTo(k.back[1][0] - k.x, k.back[1][2] - k.z), 1 - Math.exp(-dt * 3));
        const dp = d3(k.perch[0], k.perch[1], k.perch[2]);
        if ((k.t > k.wait && dp > 14) || k.t > 25) this._pathStart(k, k.back, STY.kawa);
      }
      if (!k.hidden && dc < 140) {
        const w = k.st === 'perch' ? 0 : -(k.tuck ?? 1);
        H.kawasemi.push(k.x, k.y, k.z, k.yaw, k.pitch || 0, k.roll || 0, 1, w, k.fly || 0, k.flap || 0, k.head || 0, k.tail || 0, 0, k.hy || 0, k.amp || 0, 0.5);
      }
    }

    // ---- キジ：野を歩いてついばむ・見張る・雄はホロ打ち・逃げるときは走るか飛び立つ ----
    for (const p of this.pheasants) {
      p.t += dt;
      const dc = d3(p.x, p.y + 0.3, p.z);
      if (dc > 260 && p.st !== 'fly') continue;
      const okW = (x, z) => this._dry(x, z) && this.typeAt(x, z) !== T.ASPHALT && this.typeAt(x, z) !== T.FOREST;
      if (p.st !== 'fly' && p.st !== 'run' && dc < 16 * K) {
        p.yaw = yawTo(p.x - cx, p.z - cz) + (r() - 0.5) * 0.6;
        if (r() < 0.5 || dc < 7 * K) {
          const a = p.yaw, d = 40 + r() * 50;
          let tx = p.x + Math.sin(a) * d, tz = p.z + Math.cos(a) * d;
          for (let q = 0; q < 10 && !okW(tx, tz); q++) { const s = this.wild[Math.floor(r() * this.wild.length)]; tx = s[0]; tz = s[1]; }
          this._fly(p, [tx, this.groundAt(tx, tz), tz], STY.kiji, { arc: 3 });
        } else { p.st = 'run'; p.t = 0; p.next = 2 + r() * 2; }
      }
      if (p.st === 'walk' || p.st === 'peck') {
        const walking = p.st === 'walk';
        p.walk += ((walking ? 0.8 : 0) - p.walk) * (1 - Math.exp(-dt * 4));
        p.wph += dt * 5.5 * p.walk;
        p.head += ((walking ? (Math.sin(this.t * 2 + p.x) > 0.5 ? 0.9 : 0.1) : 1.0) - p.head) * (1 - Math.exp(-dt * 5));
        p.tail += (0 - p.tail) * dt * 2;
        if (walking) {
          if (!this._walk(p, 0.35 * p.walk, dt, okW)) p.yaw += dt;
          const hx = p.home[0] - p.x, hz = p.home[1] - p.z;
          if (Math.hypot(hx, hz) > 25) p.yaw = turnTo(p.yaw, yawTo(hx, hz), dt * 0.8);
        }
        if (p.t > p.next) {
          p.t = 0;
          const u = r();
          if (u < 0.35) { p.st = 'walk'; p.next = 3 + r() * 6; p.yaw += (r() - 0.5) * 1.5; }
          else if (u < 0.6) { p.st = 'peck'; p.next = 2 + r() * 4; }
          else if (u < 0.85 || !p.male) { p.st = 'alert'; p.next = 2 + r() * 3; }
          else { p.st = 'display'; p.next = 2.2; }
        }
      } else if (p.st === 'alert') {
        p.walk += (0 - p.walk) * dt * 5;
        p.head += (-0.35 - p.head) * (1 - Math.exp(-dt * 5));
        p.tail += (0.25 - p.tail) * dt * 3;
        p.hy = Math.sin(this.t * 1.7 + p.z) * 0.7;
        if (p.t > p.next) { p.st = 'walk'; p.t = 0; p.next = 3 + r() * 5; p.hy = 0; }
      } else if (p.st === 'display') {
        // ホロ打ち：胸を張って伸び上がり、翼を激しく打つ
        const u = p.t / p.next;
        p.head = -0.5; p.tail = 0.1;
        p.fly = u > 0.25 && u < 0.75 ? 1 : 0;
        p.amp = p.fly * 0.9; p.flap += dt * TAU * 16;
        p.pitch = -0.35 * Math.sin(Math.PI * clamp(u * 1.2, 0, 1));
        if (p.t > p.next) { p.st = 'alert'; p.t = 0; p.next = 2 + r() * 2; p.fly = 0; p.amp = 0; p.pitch = 0; }
      } else if (p.st === 'run') {
        p.walk += (1 - p.walk) * (1 - Math.exp(-dt * 8));
        p.wph += dt * 13;
        p.head = -0.2; p.tail = 0.15;
        this._walk(p, 3.2, dt, okW);
        if (p.t > p.next) { p.st = 'alert'; p.t = 0; p.next = 3 + r() * 3; p.home = [p.x, p.z]; }
      } else if (p.st === 'fly') {
        if (this._flyStep(p, dt)) { p.st = 'alert'; p.t = 0; p.next = 3 + r() * 4; p.home = [p.x, p.z]; }
      }
      if (p.st !== 'fly') p.y = this.groundAt(p.x, p.z);
      P(p.male ? H.kijiM : H.kijiF, p, 1, { head: p.head, tail: p.tail });
    }

    // ---- カラス：畑を歩く・跳ぶ・電柱や木のてっぺんへ ----
    for (const c of this.crows) {
      c.t += dt;
      const dc = d3(c.x, c.y, c.z);
      if (c.st !== 'fly' && dc < 14 * K) this._crowFly(c, true);
      if (c.st === 'walk' || c.st === 'peck') {
        const walking = c.st === 'walk';
        c.walk += ((walking ? 0.9 : 0) - c.walk) * (1 - Math.exp(-dt * 5));
        c.wph += dt * 6 * c.walk;
        c.head = walking ? Math.max(0, Math.sin(this.t * 1.3 + c.x)) * 0.6 : (Math.sin(this.t * 4 + c.z) > 0.2 ? 1.0 : 0.3);
        if (walking) this._walk(c, 0.5 * c.walk, dt, (x, z) => this._dry(x, z));
        c.y = this.groundAt(c.x, c.z);
        if (c.t > c.next) {
          c.t = 0;
          const u = r();
          if (u < 0.4) { c.st = 'walk'; c.next = 2 + r() * 4; c.yaw += (r() - 0.5) * 2; }
          else if (u < 0.75) { c.st = 'peck'; c.next = 1.5 + r() * 3; }
          else if (u < 0.85) { c.st = 'caw'; c.next = 1.6; }
          else this._crowFly(c, false);
        }
      } else if (c.st === 'perch' || c.st === 'caw') {
        c.walk = 0;
        // 鳴く：体を前へ倒し、尾を上げる
        const cawing = c.st === 'caw' || (c.st === 'perch' && (this.t + c.x) % 7 < 1.2);
        const pu = cawing ? Math.max(0, Math.sin(this.t * 9)) : 0;
        c.pitch = 0.25 * pu; c.head = -0.2 + 0.4 * pu; c.tail = 0.3 * pu;
        c.hy = Math.sin(this.t * 0.6 + c.z) * 0.8;
        if (c.t > c.next) {
          c.t = 0;
          if (c.st === 'caw') { c.st = c.ground ? 'walk' : 'perch'; c.next = 3 + r() * 5; c.pitch = 0; c.tail = 0; }
          else if (r() < 0.3) this._crowFly(c, false);
          else c.next = 5 + r() * 10;
        }
      } else if (c.st === 'fly') {
        if (this._flyStep(c, dt)) { c.st = c.ground ? 'walk' : 'perch'; c.t = 0; c.next = 4 + r() * 8; c.hy = 0; }
      }
      if (dc < 300) P(H.karasu, c);
    }

    // ---- キジバト：首をふって歩く・ついばむ・棟や電線へ ----
    for (const d of this.doves) {
      d.t += dt;
      const dc = d3(d.x, d.y, d.z);
      if (dc > 180 && d.st !== 'fly') continue;
      if (d.st !== 'fly' && dc < 8 * K) this._doveFly(d, true);
      if (d.st === 'walk' || d.st === 'peck') {
        const walking = d.st === 'walk';
        d.walk += ((walking ? 1 : 0) - d.walk) * (1 - Math.exp(-dt * 6));
        d.wph += dt * 7.5 * d.walk;
        d.head = walking ? 0.15 : (Math.sin(this.t * 5 + d.x * 3) > 0 ? 1.0 : 0.2);
        if (walking) this._walk(d, 0.32 * d.walk, dt, (x, z) => this._dry(x, z));
        d.y = this.groundAt(d.x, d.z);
        if (d.t > d.next) {
          d.t = 0;
          const u = r();
          if (u < 0.5) { d.st = 'walk'; d.next = 1.5 + r() * 3; d.yaw += (r() - 0.5) * 2; }
          else if (u < 0.9) { d.st = 'peck'; d.next = 1 + r() * 2.5; }
          else this._doveFly(d, false);
        }
      } else if (d.st === 'perch') {
        d.walk = 0; d.head = Math.sin(this.t * 0.4 + d.z) * 0.15; d.hy = Math.sin(this.t * 0.3 + d.x) * 0.6;
        if (d.t > d.next) { d.t = 0; if (r() < 0.4) this._doveFly(d, false); else d.next = 6 + r() * 12; }
      } else if (d.st === 'fly') {
        if (this._flyStep(d, dt)) { d.st = d.ground ? 'walk' : 'perch'; d.t = 0; d.next = 5 + r() * 10; d.hy = 0; }
      }
      P(H.kijibato, d);
    }

    // ---- メジロ・シジュウカラ・ヒヨドリ：樹冠の中を渡る ----
    for (const fl of this.treeFlocks) {
      fl.t += dt;
      const dcF = d3(fl.cr.x, fl.cr.y, fl.cr.z);
      const h = fl.kind === 'mejiro' ? H.mejiro : fl.kind === 'shijukara' ? H.shijukara : H.hiyodori;
      const sty = fl.kind === 'hiyodori' ? STY.hiyo : fl.kind === 'mejiro' ? STY.mejiro : STY.small;
      // 群れで隣の木へ（ヒヨドリは遠くの木へ）
      if (dt > 0 && fl.st === 'tree' && (fl.t > fl.next || dcF < fl.cr.R * 0.9 * K)) {
        const far = fl.kind === 'hiyodori' ? 90 : 26;
        let best = null;
        for (let q = 0; q < 16; q++) {
          const c = fl.trees[Math.floor(r() * fl.trees.length)];
          const d = Math.hypot(c.x - fl.cr.x, c.z - fl.cr.z);
          if (c !== fl.cr && d < far && d > 3 && d3(c.x, c.y, c.z) > c.R * 1.2) { best = c; break; }
        }
        if (best) {
          fl.cr = best; fl.st = 'move'; fl.t = 0; fl.next = 30 + r() * 50;
          for (const b of fl.birds) { const s = this.perchSpot(best, r); b.dly = r() * 0.8; b.target = s; b.st = 'wait'; b.hang = 0; }
        } else fl.next = fl.t + 10;
      }
      let allIn = true;
      for (const b of fl.birds) {
        b.t += dt;
        if (b.st === 'wait') {
          allIn = false;
          if (b.t > b.dly) { b.t = 0; this._fly(b, b.target, sty, { arc: 1 + r() }); this._setPerch(b, b.target); }
        } else if (b.st === 'fly') {
          allIn = false;
          if (this._flyStep(b, dt)) { b.st = 'sit'; b.t = 0; b.next = 0.5 + r() * 2; b.swk = 0; }
        } else if (b.st === 'sit') {
          // 止まった向きへ回る・枝のしなりになじむ
          b.yaw = turnTo(b.yaw, b.pyaw ?? b.yaw, 1 - Math.exp(-dt * 6));
          b.swk = Math.min(1, (b.swk ?? 1) + dt * 3);
          // 花をのぞく・ぶら下がる・向きを変える
          const probe = Math.sin(this.t * 3.1 + b.x * 7) > 0.2;
          b.head += ((probe ? 0.8 : -0.1) - b.head) * (1 - Math.exp(-dt * 10));
          b.hy += (Math.sin(this.t * 1.7 + b.z * 5) * 0.9 - b.hy) * (1 - Math.exp(-dt * 6));
          b.tail = Math.max(0, Math.sin(this.t * 5 + b.y * 9)) ** 6 * 0.4;
          b.pitch += (b.hang * 1.25 - b.pitch) * (1 - Math.exp(-dt * 6));
          b.roll += (b.hang * 0.9 * Math.sign(Math.sin(b.x * 13)) - b.roll) * (1 - Math.exp(-dt * 6));
          if (b.t > b.next) {
            b.t = 0; b.next = (fl.kind === 'hiyodori' ? 2 : 0.4) + r() * (fl.kind === 'hiyodori' ? 5 : 2.2);
            const u = r();
            if (u < 0.45) { const s = this.perchSpot(fl.cr, r); this._fly(b, s, sty, { arc: 0.2 + r() * 0.4, minDur: 0.25 }); this._setPerch(b, s); b.hang = 0; }
            else if (u < 0.6 && fl.kind !== 'hiyodori') b.hang = b.hang || (b.flat ?? 0) < 0.8 ? 0 : 1;
            else { b.pyaw = (b.pyaw ?? b.yaw) + (r() < 0.4 ? Math.PI : (r() - 0.5) * 0.8); }
          }
        }
        if (d3(b.x, b.y, b.z) < (fl.kind === 'hiyodori' ? 130 : 80)) {
          if (b.st === 'sit' && b.bk) {
            const o = this._treeBend(fl.cr, b.bk * b.swk);
            b.x += o[0]; b.z += o[1]; P(h, b); b.x -= o[0]; b.z -= o[1];
          } else P(h, b);
        }
      }
      if (fl.st === 'move' && allIn) fl.st = 'tree';
    }

    // ---- ウグイス：やぶの中を低く跳ぶ ----
    for (const w of this.warblers) {
      w.t += dt;
      const dc = d3(w.x, w.y, w.z);
      if (dc > 60) continue;
      if (w.st === 'sit') {
        w.head += ((Math.sin(this.t * 2 + w.x) > 0.6 ? -0.4 : 0.1) - w.head) * dt * 6;
        w.hy = Math.sin(this.t * 1.2 + w.z * 3) * 0.8;
        w.tail = 0.2 + Math.max(0, Math.sin(this.t * 4 + w.x)) ** 8 * 0.3;
        if (w.t > w.next || dc < 3 * K) {
          w.t = 0; w.next = 0.8 + r() * 3;
          let cr = w.cr;
          if (r() < 0.1 || dc < 3 * K) { const c2 = this.shrubs[Math.floor(r() * this.shrubs.length)]; if (Math.hypot(c2.x - cr.x, c2.z - cr.z) < 20) cr = c2; }
          w.cr = cr;
          const s = this.crownSpot(cr, r, 0.35, 0.85);
          s[1] = Math.min(s[1], this.groundAt(s[0], s[2]) + 1.6);
          this._fly(w, s, STY.small, { arc: 0.3, minDur: 0.25 });
        }
      } else if (w.st === 'fly') { if (this._flyStep(w, dt)) { w.st = 'sit'; w.t = 0; } }
      P(H.uguisu, w);
    }

    // ---- ムクドリ：群れで田畑を歩き、後ろの鳥が前へ飛び越す ----
    for (const fl of this.starFlocks) {
      fl.t += dt;
      const dcF = Math.hypot(fl.cx - cx, fl.cz - cz);
      if (dcF > 260 && fl.st === 'ground') continue;
      const scared = dcF < 12 * K && cy - this.groundAt(fl.cx, fl.cz) < 12;
      if (fl.st === 'ground' && (fl.t > fl.next || scared)) {
        // 群れごと別の田畑へ
        let to = null;
        for (let q = 0; q < 20; q++) { const s = this.fields[Math.floor(r() * this.fields.length)]; const d = Math.hypot(s[0] - fl.cx, s[1] - fl.cz); if (d > 40 && d < 220) { to = s; break; } }
        if (to) {
          fl.st = 'air'; fl.t = 0; fl.next = 40 + r() * 60;
          const ox = to[0] - fl.cx, oz = to[1] - fl.cz;
          fl.cx = to[0]; fl.cz = to[1]; fl.yaw = yawTo(ox, oz);
          for (const b of fl.birds) {
            const x = b.x + ox + (r() - 0.5) * 3, z = b.z + oz + (r() - 0.5) * 3;
            b.dly = r() * 0.5; b.st = 'wait'; b.to = [x, this.groundAt(x, z), z]; b.t = 0;
          }
        } else fl.next = fl.t + 15;
      }
      let allIn = true;
      let mx = 0, mz = 0;
      for (const b of fl.birds) { mx += b.x; mz += b.z; }
      mx /= fl.birds.length; mz /= fl.birds.length;
      for (const b of fl.birds) {
        b.t += dt;
        if (b.st === 'wait') { allIn = false; if (b.t > b.dly) this._fly(b, b.to, STY.muku, { arc: 6 }); }
        else if (b.st === 'fly') { allIn = false; if (this._flyStep(b, dt)) { b.st = 'walk'; b.t = 0; b.next = 1 + r() * 3; } }
        else {
          const walking = b.st === 'walk';
          b.walk += ((walking ? 1 : 0) - b.walk) * (1 - Math.exp(-dt * 6));
          b.wph += dt * 9 * b.walk;
          b.head = walking ? 0.2 : (Math.sin(this.t * 6 + b.x * 5) > 0 ? 1.0 : 0.3);
          if (walking) { b.yaw = turnTo(b.yaw, fl.yaw, dt * 0.5); this._walk(b, 0.45, dt, (x, z) => this._dry(x, z)); }
          b.y = this.groundAt(b.x, b.z);
          if (b.t > b.next) {
            b.t = 0; b.next = 0.8 + r() * 2.5;
            // 群れの後ろにいたら前へ飛び越す
            const back = (b.x - mx) * Math.sin(fl.yaw) + (b.z - mz) * Math.cos(fl.yaw);
            if (back < -2 && r() < 0.5) {
              const d = 3 + r() * 3, x = mx + Math.sin(fl.yaw) * d + (r() - 0.5) * 3, z = mz + Math.cos(fl.yaw) * d + (r() - 0.5) * 3;
              if (this._dry(x, z)) this._fly(b, [x, this.groundAt(x, z), z], STY.muku, { arc: 0.6, minDur: 0.5 });
            } else b.st = r() < 0.5 ? 'walk' : 'peck';
          }
        }
        if (d3(b.x, b.y, b.z) < 150) P(H.mukudori, b);
      }
      if (fl.st === 'air' && allIn) fl.st = 'ground';
    }

    // ---- ヒバリ：空の一点で羽ばたきながらさえずり、ゆっくり降りる ----
    for (const l of this.larks) {
      l.t += dt;
      if (l.st === 'hover') {
        // 停空：体を起こし、尾を広げて小刻みに羽ばたく。風上へ少しずつ流される
        l.fly = 1; l.amp = 0.55 + 0.15 * Math.sin(this.t * 0.7 + l.x); l.flap += dt * TAU * 14;
        l.pitch = -0.85; l.tail = 0.35; l.head = -0.3;
        l.x += Math.sin(this.t * 0.2 + l.z) * 0.3 * dt; l.z += Math.cos(this.t * 0.17 + l.x) * 0.3 * dt;
        l.y += Math.sin(this.t * 0.5 + l.x) * 0.25 * dt;
        l.tuck = 1;
        if (l.t > l.next) { l.st = 'descend'; l.t = 0; }
      } else if (l.st === 'descend') {
        // 段々に降り、最後は翼を閉じて落ちる
        const gy = this.groundAt(l.x, l.z);
        const hgt = l.y - gy;
        const drop = hgt > 6 ? ((l.t % 3) < 1.8 ? 0.8 : 4.5) : 7;
        l.y -= drop * dt;
        l.fly = hgt > 6 ? ((l.t % 3) < 1.8 ? 1 : 0.2) : 0.1; l.amp = l.fly > 0.5 ? 0.5 : 0; l.flap += dt * TAU * 14; l.pitch = hgt > 6 ? -0.5 : 0.2;
        if (hgt < 0.2) { l.y = gy; l.st = 'walk'; l.t = 0; l.next = 20 + r() * 40; l.fly = 0; l.amp = 0; l.pitch = 0; }
      } else if (l.st === 'walk' || l.st === 'peck') {
        const walking = l.st === 'walk';
        l.walk += ((walking ? 1 : 0) - l.walk) * (1 - Math.exp(-dt * 6));
        l.wph += dt * 10 * l.walk;
        l.head = walking ? 0.1 : 0.8;
        if (walking) this._walk(l, 0.3, dt, (x, z) => this._dry(x, z));
        l.y = this.groundAt(l.x, l.z);
        if (r() < dt * 0.4) l.st = l.st === 'walk' ? 'peck' : 'walk';
        if (l.t > l.next || d3(l.x, l.y, l.z) < 6 * K) { l.st = 'rise'; l.t = 0; }
      } else if (l.st === 'rise') {
        // さえずりながら螺旋に上がる
        l.fly = 1; l.amp = 0.8; l.flap += dt * TAU * 15; l.pitch = -0.6; l.tail = 0.3; l.tuck = 1;
        l.y += 1.6 * dt;
        const a = l.t * 0.35;
        l.x += Math.cos(a) * 1.2 * dt; l.z += Math.sin(a) * 1.2 * dt; l.yaw = a + Math.PI / 2;
        if (l.y - this.groundAt(l.x, l.z) > 30 + (l.hx % 7) * 5) { l.st = 'hover'; l.t = 0; l.next = 50 + r() * 80; }
      }
      const dc = d3(l.x, l.y, l.z);
      if (dc < 220) {
        const w = l.st === 'walk' || l.st === 'peck' ? l.walk : -(l.tuck ?? 1);
        H.hibari.push(l.x, l.y, l.z, l.yaw, l.pitch || 0, 0, 1, w, l.fly || 0, l.flap || 0, l.head || 0, l.tail || 0, l.wph || 0, 0, l.amp || 0, 0.5);
      }
    }

    // ---- 通りすがり：谷の空を横切るカラス・アオサギ・キジバト・ムクドリの群れ ----
    this._flybys(dt, cam, d3);
    // ---- 呼び寄せ：視点のまわりに鳥が少ないとき、遠くの一羽（群れ）を近くの住みかへ飛ばしてくる ----
    this._attract(dt, cam);

    for (const h of Object.values(this.h)) h.end();
  }

  // 視点のまわりの住みかを探す（ok(x,z) を満たす点を、前方寄りに）
  _nearSpot(cam, r0, r1, ok) {
    const r = this.r;
    const fw = this.camFwd || [0, 1];
    for (let q = 0; q < 40; q++) {
      const a = Math.atan2(fw[0], fw[1]) + (r() - 0.5) * 2.4, d = r0 + r() * (r1 - r0);
      const x = cam.x + Math.sin(a) * d, z = cam.z + Math.cos(a) * d;
      if (ok(x, z)) return [x, z];
    }
    return null;
  }
  _attract(dt, cam) {
    const r = this.r;
    // 場所が変わった（最初の一コマ・出発点の切り替え）ときは、近くの住みかへすぐ置く
    const jump = !this.lastCam || Math.hypot(cam.x - this.lastCam[0], cam.z - this.lastCam[1]) > 60;
    if (this.lastCam && !jump) { const dx = cam.x - this.lastCam[0], dz = cam.z - this.lastCam[1]; const l = Math.hypot(dx, dz); if (l > 0.05) this.camFwd = [dx / l, dz / l]; }
    this.lastCam = [cam.x, cam.z];
    if (jump) { this._populate(cam); return; }
    this.attT = (this.attT ?? 3) - dt;
    if (this.attT > 0) return;
    this.attT = 4 + r() * 4;
    const alt = cam.y - this.groundAt(cam.x, cam.z);
    if (alt > 60) return;
    const dist = (b) => Math.hypot(b.x - cam.x, b.z - cam.z);
    const W = this.world;
    const wet = (x, z) => { const k = this.texel(x, z), tp = W.type[k]; return (tp === T.FLOODED || tp === T.SEEDLING) && W.water[k] > -1000 && W.sdf[k] > 1.2; };
    const dry = (x, z) => { const k = this.texel(x, z), tp = W.type[k]; return (tp === T.TILLED || tp === T.FIELD || tp === T.FALLOW || tp === T.DIRT) && W.water[k] < -1000 && W.sdf[k] > 1.0; };
    const yard = (x, z) => { const k = this.texel(x, z), tp = W.type[k]; return (tp === T.YARD || tp === T.GARDEN || tp === T.DIRT || tp === T.GRAVEL || tp === T.LEVEE_BIG) && W.water[k] < -1000; };
    // 遠くの一羽を、視点の後ろ寄りの遠くへ移してから、近くの住みかへ飛ばす
    const bring = (b, spot, sty, o = {}) => {
      const a = Math.atan2(-(this.camFwd || [0, 1])[0], -(this.camFwd || [0, 1])[1]) + (r() - 0.5) * 1.6;
      const x0 = cam.x + Math.sin(a) * 140, z0 = cam.z + Math.cos(a) * 140;
      b.x = x0 + (o.dx || 0); b.z = z0 + (o.dz || 0); b.y = Math.max(this.groundAt(b.x, b.z), cam.y - 20) + 18 + (o.dy || 0);
      b.fly = 1; b.amp = sty.amp; b.pitch = 0;
      this._fly(b, [spot[0] + (o.dx || 0) * 0.3, this.groundAt(spot[0], spot[1]) + (o.hy || 0), spot[1] + (o.dz || 0) * 0.3], sty, { arc: 4, maxArc: 12 });
      b.f.t = b.f.dur * 0.12;
    };
    // アオサギ
    if (this.herons.filter((e) => dist(e) < 110).length < 2) {
      const far = this.herons.filter((e) => e.st !== 'fly' && dist(e) > 220).sort((a, b) => dist(b) - dist(a))[0];
      const sp = far && this._nearSpot(cam, 30, 90, wet);
      if (sp) bring(far, sp, STY.heron, { hy: -0.02 });
    }
    // カラス（群れごと）
    if (this.crows.filter((c) => dist(c) < 110).length < 3) {
      const far = this.crows.filter((c) => c.st !== 'fly' && dist(c) > 220);
      const g = far.length ? far[Math.floor(r() * far.length)].g : -1;
      const sp = g >= 0 && this._nearSpot(cam, 30, 90, dry);
      if (sp) for (const c of this.crows.filter((c) => c.g === g && c.st !== 'fly')) { c.ground = true; bring(c, sp, STY.crow, { dx: (r() - 0.5) * 8, dz: (r() - 0.5) * 8, dy: (r() - 0.5) * 3 }); }
    }
    // キジバト（つがい）
    if (this.doves.filter((d) => dist(d) < 90).length < 2) {
      const far = this.doves.filter((d) => d.st !== 'fly' && dist(d) > 200);
      const g = far.length ? far[Math.floor(r() * far.length)].g : -1;
      const sp = g >= 0 && this._nearSpot(cam, 20, 70, yard);
      if (sp) for (const d of this.doves.filter((d) => d.g === g && d.st !== 'fly')) { d.ground = true; bring(d, sp, STY.dove, { dx: (r() - 0.5) * 2, dz: (r() - 0.5) * 2 }); }
    }
    // ムクドリの群れ
    if (!this.starFlocks.some((f) => Math.hypot(f.cx - cam.x, f.cz - cam.z) < 130)) {
      const f = this.starFlocks.filter((f) => f.st === 'ground' && Math.hypot(f.cx - cam.x, f.cz - cam.z) > 250)[0];
      const sp = f && this._nearSpot(cam, 35, 100, dry);
      if (sp) {
        f.st = 'air'; f.t = 0; f.cx = sp[0]; f.cz = sp[1];
        for (const b of f.birds) { const ox = (r() - 0.5) * 9, oz = (r() - 0.5) * 9; b.st = 'fly'; bring(b, [sp[0] + ox, sp[1] + oz], STY.muku, { dx: ox, dz: oz, dy: (r() - 0.5) * 4 }); }
      }
    }
  }

  _populate(cam) {
    const r = this.r;
    const W = this.world;
    const dist = (b) => Math.hypot(b.x - cam.x, b.z - cam.z);
    const any = (x, z) => true;
    void any;
    const wet = (x, z) => { const k = this.texel(x, z), tp = W.type[k]; return (tp === T.FLOODED || tp === T.SEEDLING) && W.water[k] > -1000 && W.sdf[k] > 1.2; };
    const dry = (x, z) => { const k = this.texel(x, z), tp = W.type[k]; return (tp === T.TILLED || tp === T.FIELD || tp === T.FALLOW || tp === T.DIRT) && W.water[k] < -1000 && W.sdf[k] > 1.0; };
    const yard = (x, z) => { const k = this.texel(x, z), tp = W.type[k]; return (tp === T.YARD || tp === T.GARDEN || tp === T.DIRT || tp === T.GRAVEL || tp === T.LEVEE_BIG) && W.water[k] < -1000; };
    const wild = (x, z) => { const k = this.texel(x, z), tp = W.type[k]; return (tp === T.TILLED || tp === T.DIRT || tp === T.LEVEE_BIG || tp === T.FIELD || tp === T.KNOLL || tp === T.MEADOW) && W.water[k] < -1000 && W.forest[k] < 0.15; };
    const aroundSpot = (r0, r1, ok) => { for (let q = 0; q < 60; q++) { const a = r() * TAU, d = r0 + r() * (r1 - r0); const x = cam.x + Math.sin(a) * d, z = cam.z + Math.cos(a) * d; if (ok(x, z)) return [x, z]; } return null; };
    const place = (b, sp, dx = 0, dz = 0) => { b.x = sp[0] + dx; b.z = sp[1] + dz; b.y = this.groundAt(b.x, b.z); b.fly = 0; b.amp = 0; b.pitch = 0; b.roll = 0; b.t = 0; };
    const farOnes = (arr, n) => arr.filter((b) => b.st !== 'fly' && dist(b) > 160).slice(0, n);
    for (const e of farOnes(this.herons, 2)) { const sp = aroundSpot(25, 110, wet); if (sp) { place(e, sp); e.st = 'stand'; e.next = 5 + r() * 10; } }
    {
      const g = (farOnes(this.crows, 1)[0] || {}).g;
      const sp = g !== undefined && aroundSpot(30, 110, dry);
      if (sp) for (const c of this.crows.filter((c) => c.g === g)) { place(c, sp, (r() - 0.5) * 8, (r() - 0.5) * 8); c.st = 'walk'; c.ground = true; }
    }
    {
      const g = (farOnes(this.doves, 1)[0] || {}).g;
      const sp = g !== undefined && aroundSpot(15, 70, yard);
      if (sp) for (const d of this.doves.filter((d) => d.g === g)) { place(d, sp, (r() - 0.5) * 2, (r() - 0.5) * 2); d.st = 'walk'; d.ground = true; }
    }
    for (const p of farOnes(this.pheasants, 1)) { const sp = aroundSpot(20, 80, wild); if (sp) { place(p, sp); p.st = 'walk'; p.home = sp.slice(); } }
    {
      const f = this.starFlocks.find((f) => f.st === 'ground' && Math.hypot(f.cx - cam.x, f.cz - cam.z) > 200);
      const sp = f && aroundSpot(35, 120, dry);
      if (f && sp) { const ox = sp[0] - f.cx, oz = sp[1] - f.cz; f.cx = sp[0]; f.cz = sp[1]; for (const b of f.birds) { b.x += ox; b.z += oz; b.y = this.groundAt(b.x, b.z); } }
    }
  }

  _flybys(dt, cam, d3) {
    const r = this.r;
    this.flyT = (this.flyT ?? 4) - dt;
    this.flybys ||= [];
    const alt = cam.y - this.groundAt(cam.x, cam.z);
    if (this.flyT < 0 && alt < 90 && this.flybys.length < 4) {
      this.flyT = 6 + r() * 11;
      const u = r();
      const kind = u < 0.34 ? 'karasu' : u < 0.52 ? 'aosagi' : u < 0.72 ? 'kijibato' : 'mukudori';
      const n = kind === 'aosagi' ? 1 : kind === 'karasu' ? 1 + Math.floor(r() * 3) : kind === 'kijibato' ? 1 + Math.floor(r() * 2) : 14 + Math.floor(r() * 14);
      const sty = kind === 'aosagi' ? STY.heron : kind === 'karasu' ? STY.crow : kind === 'kijibato' ? STY.dove : STY.muku;
      const hgt = kind === 'aosagi' ? 14 + r() * 18 : kind === 'kijibato' ? 7 + r() * 12 : 9 + r() * 25;
      const L = 170;
      // 道すじの地面（24点）を見て、山肌より上を飛ぶ高さにする。上げ幅が大きい向きなら8回まで引き直し、いちばん低くすむ向き（谷筋）を選ぶ
      let best = null;
      for (let q = 0; q < 8; q++) {
        const a = r() * TAU, dir = [Math.sin(a), Math.cos(a)], perp = [dir[1], -dir[0]];
        const off = (r() < 0.5 ? -1 : 1) * (6 + r() * 34);
        const cx = cam.x + perp[0] * off, cz = cam.z + perp[1] * off;
        const base = Math.max(this.groundAt(cx, cz), cam.y - 25) + hgt;
        let gmax = -1e9;
        for (let i = 0; i < 24; i++) { const f = (i / 23 * 2 - 1) * L; gmax = Math.max(gmax, this.groundAt(cx + dir[0] * f, cz + dir[1] * f)); }
        const y = Math.max(base, gmax + (kind === 'mukudori' ? 9 : 6));
        const lift = y - base;
        if (!best || lift < best.lift) best = { a, dir, cx, cz, y, lift };
        if (lift <= 0) break;
      }
      const { a, dir, cx, cz } = best;
      const birds = [];
      for (let i = 0; i < n; i++) {
        const jx = (r() - 0.5) * (kind === 'mukudori' ? 9 : 5), jz = (r() - 0.5) * (kind === 'mukudori' ? 9 : 5), jy = (r() - 0.5) * (kind === 'mukudori' ? 4 : 1.5);
        const b = { x: cx - dir[0] * L + jx, y: best.y + jy, z: cz - dir[1] * L + jz, yaw: a, flap: r() * 6, amp: 0, fly: 1, pitch: 0, roll: 0, var: r() };
        this._fly(b, [cx + dir[0] * L + jx, best.y + jy + r() * 3, cz + dir[1] * L + jz], sty, { land: false, arc: 0, maxArc: 0 });
        b.f.t = b.f.dur * 0.12;
        b.dly = i * (kind === 'mukudori' ? 0.03 : 0.5) * r();
        birds.push(b);
      }
      this.flybys.push({ kind, birds });
    }
    for (let i = this.flybys.length - 1; i >= 0; i--) {
      const fb = this.flybys[i];
      let alive = false;
      for (const b of fb.birds) {
        if (b.dly > 0) { b.dly -= dt; alive = true; continue; }
        if (!b.gone) { if (this._flyStep(b, dt)) b.gone = true; else alive = true; }
        if (b.f.t / b.f.dur > 0.88) b.gone = true;
        if (!b.gone && d3(b.x, b.y, b.z) < 260 && b.y > this.groundAt(b.x, b.z) + 1) { b.fly = 1; b.tuck = 1; b.st = 'fly'; this.h[fb.kind].push(b.x, b.y, b.z, b.yaw, b.pitch, b.roll, 1, -1, 1, b.flap, 0, 0, 0, 0, b.amp, b.var); }
      }
      if (!alive) this.flybys.splice(i, 1);
    }
  }

  // アオサギの飛び立ち：別の田・川・池の岸へ
  _heronFly(e) {
    const r = this.r;
    let to = null;
    const pools = [this.paddy, this.shallows];
    for (let q = 0; q < 30 && !to; q++) {
      const src = pools[r() < 0.7 ? 0 : 1];
      if (!src.length) continue;
      const s = src[Math.floor(r() * src.length)];
      const d = Math.hypot(s[0] - e.x, s[1] - e.z);
      if (d > 50 && d < 320) to = [s[0], this.groundAt(s[0], s[1]) - 0.02, s[1]];
    }
    if (!to) to = [e.x + 60, this.groundAt(e.x + 60, e.z), e.z];
    this._fly(e, to, STY.heron, { arc: 6, maxArc: 22 });
  }
  // カラス：地面⇔止まり木
  _crowFly(c, scared) {
    const r = this.r;
    let to;
    const u = r();
    if (u < 0.45 || scared) {
      const src = r() < 0.6 ? this.poleTops : this.treeTops;
      if (src.length) { to = src[Math.floor(r() * src.length)]; c.ground = false; }
    }
    if (!to) {
      const s = this.fields[Math.floor(r() * this.fields.length)];
      to = [s[0] + (r() - 0.5) * 4, 0, s[1] + (r() - 0.5) * 4]; to[1] = this.groundAt(to[0], to[2]); c.ground = true;
    }
    const d = Math.hypot(to[0] - c.x, to[2] - c.z);
    if (d > 350) {
      // 遠すぎる止まり木はやめ、近くの畑へ（いちばん近い候補を数回の抽選から）
      let best = null, bd = 1e9;
      for (let q = 0; q < 12; q++) { const s = this.fields[Math.floor(r() * this.fields.length)]; const dd = Math.hypot(s[0] - c.x, s[1] - c.z); if (dd < bd) { bd = dd; best = s; } if (dd < 250) break; }
      to = [best[0], this.groundAt(best[0], best[1]), best[1]]; c.ground = true;
    }
    this._fly(c, to, STY.crow, { arc: 4, maxArc: 25 });
  }
  // キジバト：地面⇔棟・電線
  _doveFly(d, scared) {
    const r = this.r;
    let to = null;
    if ((scared || r() < 0.6) && (this.ridges.length || this.wires.length)) {
      if (r() < 0.5 && this.ridges.length) {
        const w = this.ridges[Math.floor(r() * this.ridges.length)], t = 0.1 + r() * 0.8;
        to = [lerp(w.a[0], w.b[0], t), lerp(w.a[1], w.b[1], t), lerp(w.a[2], w.b[2], t)];
      } else if (this.wires.length) {
        const w = this.wires[Math.floor(r() * this.wires.length)], t = 0.2 + r() * 0.6;
        to = [lerp(w.a[0], w.b[0], t), lerp(w.a[1], w.b[1], t) - w.sag * 4 * t * (1 - t) + 0.01, lerp(w.a[2], w.b[2], t)];
      }
      d.ground = false;
    }
    if (!to || Math.hypot(to[0] - d.x, to[2] - d.z) > 250) {
      const s = (this.yards.length ? this.yards : this.fields)[Math.floor(r() * (this.yards.length || this.fields.length))];
      to = [s[0], this.groundAt(s[0], s[1]), s[1]]; d.ground = true;
      if (Math.hypot(to[0] - d.x, to[2] - d.z) > 250) { to = [d.x + (r() - 0.5) * 30, 0, d.z + (r() - 0.5) * 30]; to[1] = this.groundAt(to[0], to[2]); }
    }
    this._fly(d, to, STY.dove, { arc: 3 });
  }

  // 確かめ用：全種を一か所に並べる（__app.birds2.lineupAt = {x, z, yaw, fly:false}）
  _lineup() {
    const L = this.lineupAt;
    const y0 = this.groundAt(L.x, L.z);
    const yaw = L.yaw ?? 0;
    const side = [Math.cos(yaw), -Math.sin(yaw)];
    let list = [['aosagi', 1.1], ['kijiM', 0.9], ['kijiF', 0.7], ['karasu', 0.6], ['kijibato', 0.45], ['mukudori', 0.35], ['hiyodori', 0.35], ['kawasemi', 0.25], ['hibari', 0.25], ['uguisu', 0.25], ['shijukara', 0.22], ['mejiro', 0.22]];
    if (L.only) list = list.filter(([k]) => L.only.includes(k));
    const tot = list.reduce((s, [, w]) => s + w, 0);
    let acc = -tot / 2;
    const t = this.t;
    for (const [k, w] of list) {
      const o = acc + w / 2; acc += w;
      const x = L.x + side[0] * o * (L.spread ?? 1), z = L.z + side[1] * o * (L.spread ?? 1);
      const fly = L.fly ? 1 : 0;
      const ph = t * TAU * (k === 'aosagi' ? 2 : k === 'karasu' ? 3.2 : 10) * (L.anim === false ? 0 : 1) + (L.phase ?? 1.2);
      const yy = L.fly ? (L.flyY ?? 1.2) : 0;
      const h = this.h[k];
      h.push(x, this.groundAt(x, z) + yy, z, yaw + (L.turn ?? 0), 0, 0, 1, L.fly ? -1 : (L.walk ?? 0), fly, ph, L.head ?? 0, L.tail ?? 0, t * 6, L.hy ?? 0, fly ? (L.amp ?? 1) : 0, 0.5);
      void y0;
    }
  }
}
