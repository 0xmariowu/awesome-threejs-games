// 建物と小物：茅葺きの家・瓦の家・納屋・土蔵・神社・鳥居・橋・電柱・地蔵・石垣・石灯籠
// すべて手続きで組み立て、材質番号つきの一つの形にまとめる（描画は1回）
// 材質の細部（茅の茎・切り口・瓦の肌・板目・石積み・御影石・コンクリート・トタンの錆…）は
// 最初に描かれるときGPUで配列テクスチャ（512²×15枚・ミップ付き）に焼き、実行中は読むだけ
// 瓦は波形（山と谷）を形そのものに持たせ、遠くでは頂点で平らに戻す（ちらつき防止）
import * as THREE from 'three';
import { ALL, SHADOW, NOISE } from './glsl.js';
import { HOUSES, OUTBUILDINGS, SHRINE, BRIDGE, KNOLL, riverLevel } from '../world/layout.js';
import { mulberry32 } from '../util/noise.js';

export const M = {
  PLAIN: 0, PLASTER: 1, BOARD: 2, THATCH: 3, KAWARA: 4, SHOJI: 5, STONE: 6, TIN: 7, VERMILION: 8, CONCRETE: 9, GLASS: 10,
  BARK: 11, CLOTH: 12, NAMAKO: 13, GRAIN: 14, THATCH_END: 15, GRANITE: 16, LOGEND: 17, COPPER: 18, TATAMI: 19, METAL: 20,
  CERAMIC: 21, ASPHALT: 22, DARK: 23, NOSHI: 24, ROPE: 25, PAPER: 26, BAMBOO: 27, FLOOR: 28, KOSHI: 29, FUSUMA: 30,
};
// 木目の向きを長手に合わせる材質
const GRAINY = new Set([M.GRAIN, M.VERMILION, M.BARK, M.BAMBOO, M.FLOOR, M.METAL]);

// 瓦の波（桟瓦：広い谷と細い山）。JSとGLSLで同じ式
const TP = 0.3, TA = 0.045;
function tileWave(u) {
  const x = u / TP - Math.floor(u / TP) - 0.8;
  const f = 0.5 + 0.5 * Math.cos(2 * Math.PI * x) + 0.18 * Math.cos(4 * Math.PI * x);
  return TA * Math.max(0, (f - 0.14) / 1.04);
}

const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul3 = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len3 = (a) => Math.hypot(a[0], a[1], a[2]);
const norm3 = (a, fb = [0, 1, 0]) => { const l = len3(a); return l > 1e-9 ? [a[0] / l, a[1] / l, a[2] / l] : fb; };
const lerp = (a, b, t) => a + (b - a) * t;

class MB {
  constructor(groundAt) {
    this.p = []; this.n = []; this.u = []; this.c = []; this.m = []; this.t = []; this.w = []; this.i = [];
    this.T = { ox: 0, oy: 0, oz: 0, rot: 0, c: 1, s: 0 };
    this.tint = [1, 1, 1];
    this.top = null;  // 雨だれの始まる高さ（局所y）。null＝なし
    this.groundAt = groundAt;
  }
  setFrame(ox, oy, oz, rot) { this.T = { ox, oy, oz, rot, c: Math.cos(rot), s: Math.sin(rot) }; }
  // 入れ子の座標（局所の点・向きで子の枠をつくる）
  sub(x, y, z, rot, fn) {
    const old = this.T, oldTop = this.top;
    const p = this.tp(x, y, z);
    this.setFrame(p[0], p[1], p[2], old.rot + rot);
    if (oldTop !== null) this.top = oldTop - y;
    fn();
    this.T = old; this.top = oldTop;
  }
  tp(x, y, z) { const T = this.T; return [T.ox + x * T.c + z * T.s, T.oy + y, T.oz - x * T.s + z * T.c]; }
  tn(x, y, z) { const T = this.T; return [x * T.c + z * T.s, y, -x * T.s + z * T.c]; }
  // 局所の点・法線・接線 → 頂点
  V(pl, nl, uv, col, ao, mat, tl, tw = 1, disp = 0) {
    const p = this.tp(pl[0], pl[1], pl[2]), n = this.tn(nl[0], nl[1], nl[2]), t = this.tn(tl[0], tl[1], tl[2]);
    this.p.push(p[0], p[1], p[2]); this.n.push(n[0], n[1], n[2]); this.u.push(uv[0], uv[1]);
    const k = this.tint;
    this.c.push(col[0] * k[0], col[1] * k[1], col[2] * k[2], ao); this.m.push(mat);
    this.t.push(t[0], t[1], t[2], tw);
    const drip = this.top === null ? 50 : Math.max(0, this.T.oy + this.top - p[1]);
    this.w.push(drip, p[1] - this.groundAt(p[0], p[2]), disp);
    return this.p.length / 3 - 1;
  }
  // 三角形の接線（uの増える向き）と向き（vの符号）
  static tanOf(a, b, c, ua, ub, uc, n) {
    const e1 = sub3(b, a), e2 = sub3(c, a);
    const du1 = ub[0] - ua[0], dv1 = ub[1] - ua[1], du2 = uc[0] - ua[0], dv2 = uc[1] - ua[1];
    const det = du1 * dv2 - du2 * dv1;
    if (Math.abs(det) < 1e-12) return [norm3(e1, [1, 0, 0]), 1];
    const r = 1 / det;
    const t = [(e1[0] * dv2 - e2[0] * dv1) * r, (e1[1] * dv2 - e2[1] * dv1) * r, (e1[2] * dv2 - e2[2] * dv1) * r];
    const bt = [(e2[0] * du1 - e1[0] * du2) * r, (e2[1] * du1 - e1[1] * du2) * r, (e2[2] * du1 - e1[2] * du2) * r];
    const tt = norm3(sub3(t, mul3(n, dot3(n, t))), [1, 0, 0]);
    return [tt, dot3(cross3(n, tt), bt) < 0 ? -1 : 1];
  }
  // 局所座標の4点の面（反時計回りが表）
  quad(a, b, c, d, col, mat, uvs, ao = [1, 1, 1, 1]) {
    const n = norm3(cross3(sub3(b, a), sub3(d, a)));
    const [t, w] = MB.tanOf(a, b, d, uvs[0], uvs[1], uvs[3], n);
    const i0 = this.V(a, n, uvs[0], col, ao[0], mat, t, w), i1 = this.V(b, n, uvs[1], col, ao[1], mat, t, w);
    const i2 = this.V(c, n, uvs[2], col, ao[2], mat, t, w), i3 = this.V(d, n, uvs[3], col, ao[3], mat, t, w);
    this.i.push(i0, i1, i2, i0, i2, i3);
  }
  tri(a, b, c, col, mat, uvs, ao = [1, 1, 1]) {
    const n = norm3(cross3(sub3(b, a), sub3(c, a)));
    const [t, w] = MB.tanOf(a, b, c, uvs[0], uvs[1], uvs[2], n);
    const i0 = this.V(a, n, uvs[0], col, ao[0], mat, t, w), i1 = this.V(b, n, uvs[1], col, ao[1], mat, t, w), i2 = this.V(c, n, uvs[2], col, ao[2], mat, t, w);
    this.i.push(i0, i1, i2);
  }
  // 箱（局所座標：中心・大きさ）。skip: 省く面、ao: [下,上]、mats: 面ごとの材質
  box(cx, cy, cz, sx, sy, sz, col, mat, opt = {}) {
    const x0 = cx - sx / 2, x1 = cx + sx / 2, y0 = cy - sy / 2, y1 = cy + sy / 2, z0 = cz - sz / 2, z1 = cz + sz / 2;
    const ao = opt.ao || [1, 1];
    const aoV = (y) => ao[0] + (ao[1] - ao[0]) * ((y - y0) / Math.max(sy, 1e-3));
    const skip = opt.skip || '';
    const mt = (f) => (opt.mats && opt.mats[f] !== undefined ? opt.mats[f] : mat);
    const ct = (f) => (opt.cols && opt.cols[f] ? opt.cols[f] : col);
    // 木目は長手へ
    const g = GRAINY.has(mat) || opt.grain;
    const lx = g && sx >= sy && sx >= sz, lz = g && sz > sx && sz >= sy;
    const U = (u0, u1, v0, v1, sw) => (sw ? [[v0, u0], [v0, u1], [v1, u1], [v1, u0]] : [[u0, v0], [u1, v0], [u1, v1], [u0, v1]]);
    // us: 模様の縮尺（大きいほど細かい）
    if (opt.us && opt.us !== 1) {
      const S = opt.us, q = this.quad;
      this.quad = (a, b, c, d, cl, mt2, uvs, ao2) => q.call(this, a, b, c, d, cl, mt2, uvs.map(([u, v]) => [u * S, v * S]), ao2);
      try { return this.box(cx, cy, cz, sx, sy, sz, col, mat, { ...opt, us: 1 }); } finally { this.quad = q; }
    }
    const A4 = (a, b) => [aoV(a), aoV(a), aoV(b), aoV(b)];
    if (!skip.includes('s')) this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], ct('s'), mt('s'), lx ? [[y0, x0], [y0, x1], [y1, x1], [y1, x0]] : U(x0, x1, y0, y1), A4(y0, y1));
    if (!skip.includes('n')) this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], ct('n'), mt('n'), lx ? [[y0, -x1], [y0, -x0], [y1, -x0], [y1, -x1]] : U(-x1, -x0, y0, y1), A4(y0, y1));
    if (!skip.includes('e')) this.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], ct('e'), mt('e'), lz ? [[y0, -z1], [y0, -z0], [y1, -z0], [y1, -z1]] : U(-z1, -z0, y0, y1), A4(y0, y1));
    if (!skip.includes('w')) this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], ct('w'), mt('w'), lz ? [[y0, z0], [y0, z1], [y1, z1], [y1, z0]] : U(z0, z1, y0, y1), A4(y0, y1));
    if (!skip.includes('t')) this.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], ct('t'), mt('t'), lx ? [[-z1, x0], [-z1, x1], [-z0, x1], [-z0, x0]] : [[x0, -z1], [x1, -z1], [x1, -z0], [x0, -z0]], [ao[1], ao[1], ao[1], ao[1]]);
    if (!skip.includes('b')) this.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], ct('b'), mt('b'), lx ? [[z0, x0], [z0, x1], [z1, x1], [z1, x0]] : [[x0, z0], [x1, z0], [x1, z1], [x0, z1]], [ao[0], ao[0], ao[0], ao[0]]);
  }
  // 格子の面：P[j][i]（局所の元の点）、UV[j][i]、D[j][i]（法線方向の持ち上げ）、N[j][i]（与えた法線）
  grid(P, UV, col, mat, opt = {}) {
    const R = P.length, Cn = P[0].length;
    const base = this.p.length / 3;
    const nfix = opt.normal ? norm3(opt.normal) : null;
    let last = [0, 1, 0];
    for (let j = 0; j < R; j++) for (let i = 0; i < Cn; i++) {
      const pi0 = P[j][Math.max(0, i - 1)], pi1 = P[j][Math.min(Cn - 1, i + 1)];
      const pj0 = P[Math.max(0, j - 1)][i], pj1 = P[Math.min(R - 1, j + 1)][i];
      let di = sub3(pi1, pi0), dj = sub3(pj1, pj0);
      // 縮退（端に寄せた点）の近くは隣の差分で代える
      if (len3(di) < 1e-6) for (let q = 1; q < Cn && len3(di) < 1e-6; q++) di = sub3(P[j][Math.min(Cn - 1, i + q)], P[j][Math.max(0, i - q)]);
      if (len3(dj) < 1e-6) for (let q = 1; q < R && len3(dj) < 1e-6; q++) dj = sub3(P[Math.min(R - 1, j + q)][i], P[Math.max(0, j - q)][i]);
      let n = opt.N ? opt.N[j][i] : nfix || norm3(cross3(di, dj), last);
      if (opt.flip && !opt.N) n = mul3(n, -1);
      last = n;
      const t = norm3(sub3(di, mul3(n, dot3(n, di))), [1, 0, 0]);
      const tw = dot3(cross3(n, t), dj) < 0 ? -1 : 1;
      const d = opt.D ? opt.D[j][i] : 0;
      const p = d ? add3(P[j][i], mul3(n, d)) : P[j][i];
      const ao = opt.AO ? opt.AO[j][i] : (opt.ao ?? 1);
      const m = opt.MAT ? opt.MAT[j][i] : mat;
      this.V(p, n, UV[j][i], col, ao, m, t, tw, d);
    }
    const flip = !!opt.flip !== !!opt.flipWinding;
    for (let j = 0; j < R - 1; j++) for (let i = 0; i < Cn - 1; i++) {
      const a = base + j * Cn + i, b = a + 1, c = a + Cn + 1, d = a + Cn;
      if (flip) this.i.push(a, c, b, a, d, c); else this.i.push(a, b, c, a, c, d);
    }
  }
  // 円柱（局所座標、縦）。caps: 上下のふた
  cyl(cx, cz, y0, y1, r0, r1, sides, col, mat, ao = [1, 1], caps = '') {
    for (let s = 0; s < sides; s++) {
      const a0 = (s / sides) * Math.PI * 2, a1 = ((s + 1) / sides) * Math.PI * 2;
      const p = (a, y, r) => [cx + Math.cos(a) * r, y, cz + Math.sin(a) * r];
      const u0 = (s / sides) * 2 * Math.PI * r0, u1 = ((s + 1) / sides) * 2 * Math.PI * r0;
      this.quad(p(a1, y0, r0), p(a0, y0, r0), p(a0, y1, r1), p(a1, y1, r1), col, mat, [[u1, y0], [u0, y0], [u0, y1], [u1, y1]], [ao[0], ao[0], ao[1], ao[1]]);
      if (caps.includes('t')) this.tri([cx, y1, cz], p(a1, y1, r1), p(a0, y1, r1), col, mat, [[cx, cz], [cx + Math.cos(a1) * r1, cz + Math.sin(a1) * r1], [cx + Math.cos(a0) * r1, cz + Math.sin(a0) * r1]], [ao[1], ao[1], ao[1]]);
      if (caps.includes('b')) this.tri([cx, y0, cz], p(a0, y0, r0), p(a1, y0, r0), col, mat, [[cx, cz], [cx + Math.cos(a0) * r0, cz + Math.sin(a0) * r0], [cx + Math.cos(a1) * r0, cz + Math.sin(a1) * r0]], [ao[0], ao[0], ao[0]]);
    }
  }
  // 回転体（なめらか）：prof=[[r,y],...] 下から上。sz＝奥行きの縮み、a0,a1＝角度の範囲
  lathe(cx, cz, prof, sides, col, mat, opt = {}) {
    const a0 = opt.a0 ?? 0, a1 = opt.a1 ?? Math.PI * 2, sz = opt.sz ?? 1, oy = opt.y ?? 0;
    const P = [], UV = [], N = [];
    let vacc = 0;
    for (let j = 0; j < prof.length; j++) {
      const [r, y] = prof[j];
      if (j > 0) vacc += Math.hypot(r - prof[j - 1][0], y - prof[j - 1][1]);
      const rowP = [], rowU = [], rowN = [];
      const jp = prof[Math.max(0, j - 1)], jn = prof[Math.min(prof.length - 1, j + 1)];
      const dr = jn[0] - jp[0], dy = jn[1] - jp[1];
      for (let i = 0; i <= sides; i++) {
        const a = a0 + (a1 - a0) * (i / sides);
        const ca = Math.cos(a), sa = Math.sin(a);
        rowP.push([cx + ca * r, oy + y, cz + sa * r * sz]);
        rowU.push([(a - a0) * Math.max(0.05, prof[0][0]), vacc]);
        rowN.push(norm3([ca * dy, -dr, sa * dy / sz], [0, 1, 0]));
      }
      P.push(rowP); UV.push(rowU); N.push(rowN);
    }
    this.grid(P, UV, col, mat, { N, ao: opt.ao, AO: opt.AO, flipWinding: true });
  }
  // 管（なめらか）：path=[[x,y,z]...]、r（数か関数）、arc＝[始め,終わり]の角度
  tube(path, r, sides, col, mat, opt = {}) {
    const up0 = opt.up || [0, 1, 0];
    const a0 = opt.arc ? opt.arc[0] : 0, a1 = opt.arc ? opt.arc[1] : Math.PI * 2;
    const P = [], UV = [], N = [];
    let vacc = 0;
    for (let j = 0; j < path.length; j++) {
      const t = norm3(sub3(path[Math.min(path.length - 1, j + 1)], path[Math.max(0, j - 1)]), [1, 0, 0]);
      let s = cross3(t, up0); if (len3(s) < 1e-4) s = cross3(t, [1, 0, 0]);
      s = norm3(s); const u = cross3(s, t);
      if (j > 0) vacc += len3(sub3(path[j], path[j - 1]));
      const rr = typeof r === 'function' ? r(j / (path.length - 1)) : r;
      const rowP = [], rowU = [], rowN = [];
      for (let i = 0; i <= sides; i++) {
        const a = a0 + (a1 - a0) * (i / sides);
        const d = add3(mul3(s, Math.cos(a)), mul3(u, Math.sin(a)));
        rowP.push(add3(path[j], mul3(d, rr))); rowN.push(d);
        rowU.push([(a - a0) * rr, vacc]);
      }
      P.push(rowP); UV.push(rowU); N.push(rowN);
    }
    this.grid(P, UV, col, mat, { N, ao: opt.ao, AO: opt.AO, flipWinding: !opt.inside });
  }
  // 任意の2点を結ぶ箱：a→b が長手、w＝横幅、h＝高さ（up の向き）、中心線は箱の中心
  sbox(a, b, w, h, col, mat, opt = {}) {
    const ax = norm3(sub3(b, a));
    let s = cross3(ax, opt.up || [0, 1, 0]); if (len3(s) < 1e-4) s = cross3(ax, [1, 0, 0]);
    s = norm3(s); const u = cross3(s, ax);
    const L = len3(sub3(b, a));
    const P = (t, x, y) => add3(add3(a, mul3(ax, t * L)), add3(mul3(s, x * w / 2), mul3(u, y * h / 2)));
    const ao = opt.ao || [1, 1];
    const sides = [[[-1, -1], [1, -1]], [[1, -1], [1, 1]], [[1, 1], [-1, 1]], [[-1, 1], [-1, -1]]];
    const skip = opt.skip || '';
    for (let k = 0; k < 4; k++) {
      if (skip.includes('' + k)) continue;
      const [[x0, y0], [x1, y1]] = sides[k];
      const wdt = k % 2 === 0 ? w : h;
      const a0 = y0 < 0 ? ao[0] : ao[1], a1 = y1 < 0 ? ao[0] : ao[1];
      this.quad(P(0, x0, y0), P(0, x1, y1), P(1, x1, y1), P(1, x0, y0), col, opt.mats ? opt.mats[k] : mat, [[0, 0], [wdt, 0], [wdt, L], [0, L]], [a0, a1, a1, a0]);
    }
    if (!skip.includes('e')) {
      this.quad(P(0, -1, -1), P(0, -1, 1), P(0, 1, 1), P(0, 1, -1), col, mat, [[0, 0], [0, h], [w, h], [w, 0]], [ao[0], ao[1], ao[1], ao[0]]);
      this.quad(P(1, 1, -1), P(1, 1, 1), P(1, -1, 1), P(1, -1, -1), col, mat, [[0, 0], [0, h], [w, h], [w, 0]], [ao[0], ao[1], ao[1], ao[0]]);
    }
  }
  // 平たい多角形（xy面、凸）を z0..z1 に押し出す
  extrude(poly, z0, z1, col, mat, ao = 1) {
    const n = poly.length;
    for (let k = 0; k < n; k++) {
      const [x0, y0] = poly[k], [x1, y1] = poly[(k + 1) % n];
      const L = Math.hypot(x1 - x0, y1 - y0);
      this.quad([x0, y0, z1], [x0, y0, z0], [x1, y1, z0], [x1, y1, z1], col, mat, [[0, 0], [z1 - z0, 0], [z1 - z0, L], [0, L]], [ao, ao, ao, ao]);
    }
    for (let k = 1; k < n - 1; k++) {
      const a = poly[0], b = poly[k], c = poly[k + 1];
      this.tri([a[0], a[1], z1], [b[0], b[1], z1], [c[0], c[1], z1], col, mat, [a, b, c], [ao, ao, ao]);
      this.tri([a[0], a[1], z0], [c[0], c[1], z0], [b[0], b[1], z0], col, mat, [a, c, b], [ao, ao, ao]);
    }
  }
  // いびつな平石（飛び石・沓脱ぎ石）：上面は少し丸く、縁は面取り
  slab(cx, cy, cz, rx, rz, h, rnd, col, mat) {
    const K = 11, ring = [];
    for (let k = 0; k < K; k++) {
      const a = (k / K) * Math.PI * 2 + rnd() * 0.25;
      const r = 0.82 + rnd() * 0.3;
      ring.push([Math.cos(a) * rx * r, Math.sin(a) * rz * r]);
    }
    const P = [], UV = [];
    const rows = [[0.0, h + 0.012], [0.35, h + 0.012], [0.7, h + 0.004], [0.92, h - 0.01], [1.0, h - 0.045], [1.04, -0.12]];
    const jit = []; for (let k = 0; k < K; k++) jit.push((rnd() - 0.5) * h * 0.35);
    for (const [s, y] of rows) {
      const rp = [], ru = [];
      for (let k = 0; k <= K; k++) { const [x, z] = ring[k % K]; const yy = s > 0.2 && s < 1.01 ? y + jit[k % K] * s : y; rp.push([cx + x * s, cy + yy, cz + z * s]); ru.push([cx + x * s, cz + z * s]); }
      P.push(rp); UV.push(ru);
    }
    this.grid(P, UV, col, mat, { AO: rows.map((r, j) => new Array(K + 1).fill(j < 3 ? 1 : j < 5 ? 0.8 : 0.55)) });
  }
  // ここまでの形を切り出して、次の塊のために空にする
  cut() {
    const g = this.geometry();
    this.p = []; this.n = []; this.u = []; this.c = []; this.m = []; this.t = []; this.w = []; this.i = [];
    return g;
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.u, 2));
    g.setAttribute('aCol', new THREE.Float32BufferAttribute(this.c, 4));
    g.setAttribute('aMat', new THREE.Float32BufferAttribute(this.m, 1));
    g.setAttribute('aTan', new THREE.Float32BufferAttribute(this.t, 4));
    g.setAttribute('aW', new THREE.Float32BufferAttribute(this.w, 3));
    g.setIndex(this.i);
    g.computeBoundingSphere();
    return g;
  }
}

// ---- 色（線形の反射率。材質の模様は焼いた絵が明暗・色むらをのせる） ----
const C = {
  plaster: [0.56, 0.545, 0.505], shikkui: [0.77, 0.76, 0.72], shikkuiD: [0.7, 0.69, 0.655], earth: [0.42, 0.335, 0.235], wood: [0.12, 0.085, 0.06], woodL: [0.26, 0.19, 0.13], woodG: [0.2, 0.17, 0.14],
  yakisugi: [0.07, 0.058, 0.05], board: [0.2, 0.15, 0.11],
  thatch: [0.28, 0.225, 0.155], kawara: [0.125, 0.127, 0.132], stone: [0.27, 0.26, 0.235], granite: [0.28, 0.275, 0.26],
  tinRed: [0.3, 0.085, 0.05], tinTeal: [0.11, 0.24, 0.24], tinBrown: [0.2, 0.1, 0.06],
  vermilion: [0.58, 0.09, 0.03], concrete: [0.37, 0.35, 0.315], shoji: [0.78, 0.76, 0.7], black: [0.03, 0.03, 0.03],
  cloth: [0.85, 0.84, 0.8], red: [0.55, 0.05, 0.04], floor: [0.26, 0.17, 0.1], tatami: [0.42, 0.38, 0.22], dark: [0.02, 0.018, 0.015],
  metal: [0.5, 0.5, 0.49], alu: [0.62, 0.62, 0.6], ceramic: [0.8, 0.8, 0.78], asphalt: [0.12, 0.12, 0.12], bamboo: [0.26, 0.21, 0.13],
  copper: [0.3, 0.45, 0.38], fusuma: [0.62, 0.58, 0.48], paper: [0.88, 0.87, 0.84], rope: [0.42, 0.36, 0.2],
};
// ガラスの奥に見えるもの（障子・暗い室内・カーテン）
const BEHIND = { shoji: [0.5, 0.48, 0.44], dark: [0.035, 0.03, 0.028], curtain: [0.3, 0.27, 0.22] };

// ---- 瓦屋根 ----
// 斜面1枚（正準の向き）：軒は z=D の線、x方向の半分の長さ L。t＝軒から内へ水平に進んだ距離
// X(t)＝その段での横の広がり、y＝y0 + t*k − 反り
function roofFace(B, o) {
  const { L, D, tmax, X, k, y0, sag, sagN, mat, col } = o;
  const du = mat === M.KAWARA ? 0.05 : 0.5;
  const ts = [];
  const nr = Math.max(2, Math.ceil(tmax / 0.45));
  for (let j = 0; j <= nr; j++) ts.push((j / nr) * tmax);
  for (const t of o.extraT || []) if (t > 0 && t < tmax) ts.push(t);
  ts.sort((a, b) => a - b);
  const nc = Math.max(2, Math.ceil((2 * L) / du));
  const yAt = (t) => y0 + t * k - sag * Math.sin(Math.PI * Math.min(1, t / sagN));
  const P = [], UV = [], Dd = [], AO = [];
  let vacc = 0;
  for (let j = 0; j < ts.length; j++) {
    const t = ts[j];
    if (j > 0) vacc += Math.hypot(t - ts[j - 1], yAt(t) - yAt(ts[j - 1]));
    const xe = X(t);
    const rp = [], ru = [], rd = [], ra = [];
    for (let i = 0; i <= nc; i++) {
      const u = -L + (i / nc) * 2 * L;
      const x = Math.max(-xe, Math.min(xe, u));
      rp.push([x, yAt(t), D - t]); ru.push([x, vacc]);
      rd.push(mat === M.KAWARA ? tileWave(x) : 0);
      ra.push(o.aoFn ? o.aoFn(t, x) : 1);
    }
    P.push(rp); UV.push(ru); Dd.push(rd); AO.push(ra);
  }
  // 法線は上向き（t が増える＝奥へ上る、i が増える＝x+）
  B.grid(P, UV, col, mat, { D: Dd, AO });
  // 軒先の小口（瓦の波がそのまま縁の形になる）
  if (o.edge !== false) {
    const top = [], bot = [], ut = [], ub = [];
    for (let i = 0; i <= nc; i++) {
      const u = -L + (i / nc) * 2 * L;
      const x = Math.max(-X(0), Math.min(X(0), u));
      const d = mat === M.KAWARA ? tileWave(x) : 0;
      // 斜面の法線方向へ持ち上げた点（grid と同じ）
      const nn = norm3([0, 1, k]);
      top.push([x, y0 + nn[1] * d, D + nn[2] * d]); bot.push([x, y0 - (o.edgeH ?? 0.1), D + 0.01]);
      ut.push([x, 0]); ub.push([x, -(o.edgeH ?? 0.1)]);
    }
    B.grid([bot, top], [ub, ut], o.edgeCol || col, mat === M.KAWARA ? M.NOSHI : mat, { normal: [0, 0, 1], ao: 0.85 });
  }
  return yAt;
}

// 屋根一式：style = 'hip'（寄棟）| 'irimoya'（入母屋）| 'gable'（切妻）| 'skirt'（二階の下の庇：t≦tTop）
// a,b＝軒の半幅・半奥行き、y0＝軒の高さ、k＝勾配、wa,wb＝壁の半幅（軒裏の奥）
function roof(B, o) {
  const { a, b, y0, k, style } = o;
  const mat = o.mat ?? M.KAWARA, col = o.col || C.kawara;
  const sag = o.sag ?? 0.07;
  const r = style === 'gable' ? a : Math.max(0.4, a - b);
  const xg = style === 'irimoya' ? Math.max(r + 0.3, a - b * (o.gableAt ?? 0.45)) : r;
  const xw = style === 'irimoya' ? xg - 0.45 : a;
  const tTop = o.tTop ?? b;
  const yAt = (t) => y0 + t * k - sag * Math.sin(Math.PI * Math.min(1, t / b));
  const y1 = yAt(b);
  const Xfront = style === 'gable' ? () => a : style === 'irimoya' ? (t) => (t < a - xg ? a - t : xg) : (t) => Math.max(r, a - t);
  const tj = a - xg;
  const eh = o.edgeH ?? 0.1;
  for (const sgn of [1, -1]) {
    B.sub(0, 0, 0, sgn > 0 ? 0 : Math.PI, () => {
      roofFace(B, { L: a, D: b, tmax: Math.min(tTop, b), X: Xfront, k, y0, sag, sagN: b, mat, col, extraT: style === 'irimoya' ? [tj] : [], edgeH: eh, edgeCol: o.edgeCol });
    });
  }
  if (style !== 'gable') {
    const tEnd = style === 'irimoya' ? a - xw : Math.min(tTop, a - r);
    for (const sgn of [1, -1]) {
      B.sub(0, 0, 0, sgn * Math.PI / 2, () => {
        roofFace(B, { L: b, D: a, tmax: tEnd, X: (t) => Math.max(0, b - t), k, y0, sag, sagN: b, mat, col, edgeH: eh, edgeCol: o.edgeCol });
      });
    }
  }
  // 軒裏（垂木と野地板）：壁の線から軒先まで、屋根と同じ勾配
  const wa = o.wa, wb = o.wb;
  const soffY = (t) => yAt(t) - eh - 0.16;
  if (wa !== undefined) {
    const sideDefs = [[0, a, b, wa, wb], [Math.PI, a, b, wa, wb], [Math.PI / 2, b, a, wb, wa], [-Math.PI / 2, b, a, wb, wa]];
    for (const [rot, L, D, wl, wd] of sideDefs) {
      if (style === 'gable' && Math.abs(rot) > 1) continue;
      B.sub(0, 0, 0, rot, () => {
        const ov = D - wd;
        const yE = soffY(0), yI = soffY(ov);
        // 野地板（下から見える板）
        B.quad([L, yE, D], [-L, yE, D], [-wl, yI, wd], [wl, yI, wd], o.soffitCol || C.woodL, M.BOARD, [[L, 0], [-L, 0], [-wl, ov], [wl, ov]], [0.55, 0.55, 0.3, 0.3]);
        // 垂木
        const n = Math.floor((2 * wl) / 0.45);
        for (let q = 0; q <= n; q++) {
          const x = -wl + (q / n) * 2 * wl;
          B.sbox([x, yI - 0.045, wd], [x, yE - 0.045, D - 0.02], 0.055, 0.075, C.wood, M.GRAIN, { ao: [0.35, 0.5] });
        }
        // 鼻隠し（軒先の板）
        B.box(0, yE - 0.02, D - 0.02, 2 * L, eh + 0.2, 0.035, C.wood, M.GRAIN, { ao: [0.7, 0.8], skip: 'n' });
      });
    }
  }
  // 棟：のし瓦の積みと冠瓦、鬼瓦
  const ridge = [];
  if (style !== 'skirt' && o.ridge !== false) {
    const Lr = (style === 'gable' ? a : xg) + 0.08;
    const nh = o.noshiH ?? 0.36;
    B.box(0, y1 + nh / 2 - 0.12, 0, 2 * Lr, nh, 0.34, col, M.NOSHI, { ao: [0.5, 1] });
    B.tube([[-Lr, y1 + nh - 0.12, 0], [Lr, y1 + nh - 0.12, 0]], 0.14, 10, col, M.KAWARA, { arc: [0, Math.PI] });
    for (const sx of [-1, 1]) {
      B.sub(sx * Lr, y1 - 0.14, 0, sx * Math.PI / 2, () => {
        const w = 0.24 + nh * 0.25, h = nh + 0.3;
        const poly = [[-w, 0], [w, 0], [w, h * 0.55], [w * 0.8, h * 0.82], [w * 0.4, h * 0.98], [0, h * 1.02], [-w * 0.4, h * 0.98], [-w * 0.8, h * 0.82], [-w, h * 0.55]];
        B.extrude(poly, -0.06, 0.1, col, M.KAWARA, 0.9);
      });
    }
    ridge.push(y1 + nh + 0.02);
    // 隅棟・降り棟
    const hipSeg = (p0, p1) => {
      B.sbox(p0, p1, 0.24, 0.2, col, M.NOSHI, { ao: [0.6, 1] });
      const u = norm3(cross3(norm3(cross3(sub3(p1, p0), [0, 1, 0])), sub3(p1, p0)));
      const up = mul3(u, u[1] < 0 ? -0.1 : 0.1);
      B.tube([add3(p0, up), add3(p1, up)], 0.1, 8, col, M.KAWARA, { arc: [0, Math.PI], up: u[1] < 0 ? mul3(u, -1) : u });
    };
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      if (style === 'hip') hipSeg([sx * (a - 0.05), y0 + 0.08, sz * (b - 0.05)], [sx * r, y1 + 0.02, 0]);
      else if (style === 'irimoya') {
        const zj = sz * (b - tj), yj = yAt(tj);
        hipSeg([sx * (a - 0.05), y0 + 0.08, sz * (b - 0.05)], [sx * xg, yj + 0.1, zj]);
        // 降り棟：破風の上
        const pts = [];
        for (let q = 0; q <= 4; q++) { const t = lerp(tj, b, q / 4); pts.push([sx * (xg - 0.05), yAt(t) + 0.1, sz * (b - t)]); }
        for (let q = 0; q < 4; q++) hipSeg(pts[q], pts[q + 1]);
      }
    }
  } else if (style === 'skirt') {
    // 隅棟（庇の角）と、二階の壁との取り合い
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const p0 = [sx * (a - 0.05), y0 + 0.08, sz * (b - 0.05)], p1 = [sx * (a - tTop), yAt(tTop) + 0.02, sz * (b - tTop)];
      B.sbox(p0, p1, 0.24, 0.2, col, M.NOSHI, { ao: [0.6, 1] });
      B.tube([add3(p0, [0, 0.1, 0]), add3(p1, [0, 0.1, 0])], 0.1, 8, col, M.KAWARA, { arc: [0, Math.PI] });
    }
    ridge.push(yAt(tTop));
  } else ridge.push(y1);
  // 入母屋・切妻の妻壁と破風
  if (style === 'irimoya' || style === 'gable') {
    const xwall = style === 'gable' ? o.gw : xw;
    const tb = style === 'gable' ? 0 : a - xw;
    const zb = style === 'gable' ? o.gwz : b - tb;
    const ywb = yAt(tb);
    for (const sx of [-1, 1]) {
      // 妻壁：縦の帯で屋根の反りに沿わせる
      const n = 8;
      for (let q = 0; q < n; q++) {
        const z0 = -zb + (q / n) * 2 * zb, z1 = -zb + ((q + 1) / n) * 2 * zb;
        const yb = style === 'gable' ? o.gwBase : ywb;
        const yt0 = Math.max(yb, yAt(b - Math.abs(z0)) - 0.12), yt1 = Math.max(yb, yAt(b - Math.abs(z1)) - 0.12);
        const pz = sx > 0 ? [z1, z0] : [z0, z1], py = sx > 0 ? [yt1, yt0] : [yt0, yt1];
        B.quad([sx * xwall, yb, pz[0]], [sx * xwall, yb, pz[1]], [sx * xwall, py[1], pz[1]], [sx * xwall, py[0], pz[0]], o.gableCol || C.plaster, o.gableMat ?? M.PLASTER, [[sx * pz[0], yb], [sx * pz[1], yb], [sx * pz[1], py[1]], [sx * pz[0], py[0]]], [0.75, 0.75, 0.5, 0.5]);
      }
      if (style === 'irimoya') {
        // 妻の木組み（束と貫）
        for (const zz of [-zb * 0.5, 0, zb * 0.5]) B.box(sx * (xwall + 0.03), (ywb + yAt(b - Math.abs(zz)) - 0.1) / 2, zz, 0.06, yAt(b - Math.abs(zz)) - 0.1 - ywb, 0.1, C.wood, M.GRAIN, { ao: [0.6, 0.6] });
        B.box(sx * (xwall + 0.03), ywb + (y1 - ywb) * 0.35, 0, 0.06, 0.1, 2 * (b - (tb + (y1 - ywb) * 0.35 / k)) * 0.95, C.wood, M.GRAIN, { ao: [0.6, 0.6] });
        // 妻の下の小屋根（壁の足もとの水切り）
        B.box(sx * (xwall + 0.08), ywb + 0.03, 0, 0.18, 0.08, 2 * zb, col, M.NOSHI, { ao: [0.6, 0.8] });
        // 上の屋根の張り出しの裏板
        const tq = [];
        for (let q = 0; q <= 6; q++) tq.push(lerp(tj, b, q / 6));
        for (const sz of [-1, 1]) for (let q = 0; q < 6; q++) {
          const ta = tq[q], tb2 = tq[q + 1];
          const pa = [sx * xwall, yAt(ta) - 0.12, sz * (b - ta)], pb = [sx * xwall, yAt(tb2) - 0.12, sz * (b - tb2)];
          const pc = [sx * xg, yAt(tb2) - 0.1, sz * (b - tb2)], pd = [sx * xg, yAt(ta) - 0.1, sz * (b - ta)];
          B.quad(pa, pb, pc, pd, C.woodL, M.BOARD, [[0, ta], [0, tb2], [0.45, tb2], [0.45, ta]], [0.4, 0.4, 0.55, 0.55]);
        }
      }
      // 破風板：屋根の縁に沿う
      const xb = style === 'gable' ? a + 0.02 : xg + 0.02;
      const t0 = style === 'gable' ? 0 : tj;
      for (const sz of [-1, 1]) {
        const N = 6;
        for (let q = 0; q < N; q++) {
          const ta = lerp(t0, b, q / N), tb2 = lerp(t0, b, (q + 1) / N);
          B.sbox([sx * xb, yAt(ta) - 0.1, sz * (b - ta)], [sx * xb, yAt(tb2) - 0.1, sz * (b - tb2)], 0.05, 0.3, o.bargeCol || C.wood, M.GRAIN, { ao: [0.6, 0.9], up: [0, 1, 0] });
        }
      }
      // 懸魚（妻の頂の飾り板）
      B.sub(sx * (xb + 0.03), y1 - 0.45, 0, sx * Math.PI / 2, () => {
        B.extrude([[-0.22, 0.3], [0, -0.05], [0.22, 0.3], [0.1, 0.38], [-0.1, 0.38]], -0.02, 0.02, o.bargeCol || C.wood, M.GRAIN, 0.8);
      });
    }
  }
  // 雨樋（軒先の半丸の樋と、角の竪樋）
  if (o.gutter) {
    const gy = y0 - eh - 0.05;
    for (const sz of [-1, 1]) {
      B.tube([[-a + 0.1, gy, sz * (b + 0.08)], [a - 0.1, gy, sz * (b + 0.08)]], 0.065, 8, C.tinBrown, M.METAL, { arc: sz > 0 ? [Math.PI, Math.PI * 2] : [Math.PI, Math.PI * 2], ao: 0.8 });
    }
    if (o.downpipe) for (const [sx, sz] of [[1, 1], [-1, -1]]) {
      const x = sx * (a - 0.25), z = sz * (b + 0.08);
      B.tube([[x, gy, z], [x, gy - 0.35, sz * (o.wb + 0.12)]], 0.035, 6, C.tinBrown, M.METAL);
      B.tube([[x, gy - 0.35, sz * (o.wb + 0.12)], [x, 0.05, sz * (o.wb + 0.12)]], 0.035, 6, C.tinBrown, M.METAL);
      for (const yy of [0.8, 1.8, 2.8]) if (yy < gy - 0.4) B.box(x, yy, sz * (o.wb + 0.06), 0.05, 0.03, 0.12, C.metal, M.METAL);
    }
  }
  return { y1, top: ridge[0] ?? y1, yAt, xg, xw };
}

// ---- 茅葺き屋根（なめらかな寄棟。角と隅棟は丸く、厚い軒の切り口と軒裏の竹の垂木） ----
// 角の丸い長方形の輪（点の数は輪によらず同じ：辺ごと・角ごとに割り当て）
function ringRR(ax, bz, rc, nx, nz, nc) {
  rc = Math.max(0.02, Math.min(rc, ax * 0.98, bz * 0.98));
  const pts = [];
  const side = (x0, z0, x1, z1, n) => { for (let q = 0; q < n; q++) pts.push([lerp(x0, x1, q / n), lerp(z0, z1, q / n)]); };
  const corner = (cx, cz, a0) => { for (let q = 0; q < nc; q++) { const a = a0 - (q / nc) * Math.PI / 2; pts.push([cx + Math.cos(a) * rc, cz + Math.sin(a) * rc]); } };
  // 上から見て（+yから）x+ 右、z+ 手前。南の辺を x− → x+ へ、角は時計回り（z+ → x+）
  side(-ax + rc, bz, ax - rc, bz, nx); corner(ax - rc, bz - rc, Math.PI / 2);
  side(ax, bz - rc, ax, -bz + rc, nz); corner(ax - rc, -bz + rc, 0);
  side(ax - rc, -bz, -ax + rc, -bz, nx); corner(-ax + rc, -bz + rc, -Math.PI / 2);
  side(-ax, -bz + rc, -ax, bz - rc, nz); corner(-ax + rc, bz - rc, Math.PI);
  pts.push(pts[0]);
  return pts;
}

function thatchRoof(B, o) {
  const { a, b, ey, H, r, th, hw, hd } = o;
  const tin = !!o.tin;
  const nx = Math.ceil((2 * a) / 0.3), nz = Math.ceil((2 * b) / 0.3), nc = 10;
  const rc0 = 1.3;
  // 輪の定義：[半幅, 半奥行き, 角の半径, 高さ, 材質]
  const rings = [];
  rings.push([hw + 0.12, hd + 0.12, 0.3, ey - th + 0.5, 'under']);
  rings.push([a - 0.32, b - 0.32, rc0 - 0.32, ey - th, 'cut']);
  rings.push([a, b, rc0, ey - 0.06, 'lip']);
  rings.push([a - 0.1, b - 0.1, rc0 - 0.08, ey + 0.1, 'slope']);
  const NS = 14;
  const bul = o.bulge ?? 0.3;
  for (let q = 1; q <= NS; q++) {
    const s = (q / NS) * 0.975;
    const bu = bul * Math.sin(Math.PI * s) * (1 - s * 0.3);
    const ax = r + (a - 0.1 - r) * (1 - s) + bu, bz = (b - 0.1) * (1 - s) + bu * (1 - s * 0.9);
    const y = ey + 0.1 + H * (s + 0.06 * Math.sin(Math.PI * s));
    rings.push([ax, bz, Math.max(0.12, (rc0 - 0.08) * (1 - s) + 0.35 * s), y, 'slope']);
  }
  const R = rings.map(([ax, bz, rc, y]) => ringRR(ax, bz, rc, nx, nz, nc).map(([x, z]) => [x, y, z]));
  const Cn = R[0].length;
  // u：軒の輪に沿った長さ
  const U = [0];
  for (let i = 1; i < Cn; i++) U.push(U[i - 1] + Math.hypot(R[2][i][0] - R[2][i - 1][0], R[2][i][2] - R[2][i - 1][2]));
  const band = (j0, j1, mat, col, flip, aoFn) => {
    const P = [], UV = [], AO = [];
    const v = new Array(Cn).fill(0);
    for (let j = j0; j <= j1; j++) {
      if (j > j0) for (let i = 0; i < Cn; i++) v[i] += len3(sub3(R[j][i], R[j - 1][i]));
      P.push(R[j]); UV.push(R[j].map((_, i) => [U[i], mat === M.THATCH_END ? R[j][i][1] : v[i] + (j0 === 3 ? 0.4 : 0)]));
      AO.push(R[j].map(() => aoFn(j)));
    }
    B.grid(P, UV, col, mat, { AO, flip });
  };
  // 軒裏（下向き）・切り口・唇・斜面
  band(0, 1, tin ? M.THATCH : M.THATCH, C.thatch, false, (j) => (j === 0 ? 0.28 : 0.55));
  band(1, 3, tin ? M.TIN : M.THATCH_END, tin ? o.tinCol : C.thatch, false, (j) => (j === 1 ? 0.7 : 1.0));
  band(3, rings.length - 1, tin ? M.TIN : M.THATCH, tin ? o.tinCol : C.thatch, false, () => 1);
  const yTop = rings[rings.length - 1][3];
  // 軒裏の竹の垂木と横竹（下から見える）
  // 壁ぎわ（輪0）から切り口の手前（輪1）へ、軒裏の面の少し下
  const y0r = rings[0][3], y1r = rings[1][3];
  const raft = (x0, z0, x1, z1) => {
    const f1 = 0.93;
    B.sbox([x0, y0r - 0.05, z0], [lerp(x0, x1, f1), lerp(y0r, y1r, f1) - 0.05, lerp(z0, z1, f1)], 0.06, 0.06, C.bamboo, M.BAMBOO, { ao: [0.3, 0.45] });
  };
  for (const sz of [-1, 1]) {
    const n = Math.floor((2 * (hw - 0.3)) / 0.5);
    for (let k = 0; k <= n; k++) {
      const x = -(hw - 0.3) + (k / n) * 2 * (hw - 0.3);
      raft(x, sz * (hd + 0.12), x * (a - 0.35) / (hw + 0.12), sz * (b - 0.32));
    }
  }
  for (const sx of [-1, 1]) {
    const n = Math.floor((2 * (hd - 0.3)) / 0.5);
    for (let k = 0; k <= n; k++) {
      const z = -(hd - 0.3) + (k / n) * 2 * (hd - 0.3);
      raft(sx * (hw + 0.12), z, sx * (a - 0.32), z * (b - 0.35) / (hd + 0.12));
    }
  }
  // 隅の扇垂木
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (const f of [0.25, 0.5, 0.75]) {
    raft(sx * (hw + 0.1), sz * (hd + 0.1), sx * lerp(hw + 0.3, a - 0.6, f), sz * lerp(b - 0.6, hd + 0.3, f));
  }
  // 横竹（軒と平行）
  for (const f of [0.35, 0.72]) {
    const y = lerp(y0r, y1r, f) - 0.1;
    const ax = lerp(hw + 0.12, a - 0.34, f), bz = lerp(hd + 0.12, b - 0.34, f);
    B.tube([[-ax, y, bz], [ax, y, bz]], 0.028, 6, C.bamboo, M.BAMBOO, { ao: 0.35 });
    B.tube([[ax, y, -bz], [-ax, y, -bz]], 0.028, 6, C.bamboo, M.BAMBOO, { ao: 0.35 });
    B.tube([[ax, y, bz], [ax, y, -bz]], 0.028, 6, C.bamboo, M.BAMBOO, { ao: 0.35 });
    B.tube([[-ax, y, -bz], [-ax, y, bz]], 0.028, 6, C.bamboo, M.BAMBOO, { ao: 0.35 });
  }
  // 棟：杉皮で包んだ丸い棟、押さえの竹、馬乗り（棟をまたぐ木）
  const rl = rings[rings.length - 1][0] + 0.25;
  const ry = yTop - 0.1;
  if (tin) {
    B.tube([[-rl, ry, 0], [rl, ry, 0]], 0.42, 12, o.tinCol, M.TIN, { arc: [0, Math.PI] });
    for (const sx of [-1, 1]) B.lathe(sx * rl, 0, [[0.42, 0.0], [0.3, 0.3], [0.0, 0.42]], 8, o.tinCol, M.TIN, { y: ry, a0: sx > 0 ? -Math.PI / 2 : Math.PI / 2, a1: sx > 0 ? Math.PI / 2 : Math.PI * 1.5 });
    return { top: ry + 0.42 };
  }
  B.tube([[-rl, ry, 0], [rl, ry, 0]], 0.5, 14, [0.16, 0.12, 0.09], M.BARK, { arc: [-0.15, Math.PI + 0.15] });
  // 棟の端（丸いふた）
  for (const sx of [-1, 1]) B.lathe(sx * rl, 0, [[0.5, 0.0], [0.3, 0.42], [0.0, 0.5]], 8, [0.14, 0.11, 0.08], M.BARK, { y: ry, a0: sx > 0 ? -Math.PI / 2 : Math.PI / 2, a1: sx > 0 ? Math.PI / 2 : Math.PI * 1.5, sz: 1 });
  B.tube([[-rl - 0.1, ry + 0.52, 0], [rl + 0.1, ry + 0.52, 0]], 0.06, 8, C.bamboo, M.BAMBOO);
  for (const sz of [-1, 1]) B.tube([[-rl, ry + 0.38, sz * 0.34], [rl, ry + 0.38, sz * 0.34]], 0.045, 6, C.bamboo, M.BAMBOO);
  const nU = Math.max(5, Math.round(rl / 0.9));
  for (let k = 0; k <= nU; k++) {
    const x = -rl + 0.3 + (k / nU) * (2 * rl - 0.6);
    for (const sz of [-1, 1]) B.sbox([x, ry + 0.62, 0], [x, ry - 0.05, sz * 0.72], 0.09, 0.06, [0.1, 0.075, 0.055], M.GRAIN, { ao: [0.6, 1] });
  }
  return { top: ry + 0.62 };
}

// ---- 壁と開口 ----
// 壁の枠（sub で外向きを +z にした局所）：s0..s1 の柱間に、腰板・漆喰（窓）を入れる
function wallBay(B, s0, s1, fy, wh, st, kind) {
  const L = s1 - s0, cx = (s0 + s1) / 2;
  const pf = 0.075;           // 柱の面
  const koshi = st.koshi ?? 0.9;
  // 腰板（焼杉・下見板）
  B.box(cx, fy + koshi / 2, pf - 0.012, L - 0.15, koshi, 0.03, st.boardCol, M.BOARD, { ao: [0.75, 0.95], skip: 'n' });
  B.box(cx, fy + koshi + 0.015, pf - 0.0, L - 0.15, 0.03, 0.05, C.wood, M.GRAIN, { ao: [0.9, 0.95], skip: 'n' });
  const yT = fy + wh - 0.26;  // 桁の下
  if (kind === 'window' || kind === 'grille' || kind === 'sash') {
    const wy0 = fy + koshi + 0.05, wy1 = Math.min(yT - 0.25, fy + 1.85);
    const wx0 = s0 + 0.2, wx1 = s1 - 0.2;
    B.quad([s0 + 0.075, fy + koshi + 0.03, pf - 0.03], [s1 - 0.075, fy + koshi + 0.03, pf - 0.03], [s1 - 0.075, wy0, pf - 0.03], [s0 + 0.075, wy0, pf - 0.03], st.wallCol, st.wallMat, [[s0, fy + koshi], [s1, fy + koshi], [s1, wy0], [s0, wy0]], [0.9, 0.9, 0.9, 0.9]);
    B.quad([s0 + 0.075, wy1, pf - 0.03], [s1 - 0.075, wy1, pf - 0.03], [s1 - 0.075, yT, pf - 0.03], [s0 + 0.075, yT, pf - 0.03], st.wallCol, st.wallMat, [[s0, wy1], [s1, wy1], [s1, yT], [s0, yT]], [0.85, 0.85, 0.55, 0.55]);
    for (const [xa, xb] of [[s0 + 0.075, wx0], [wx1, s1 - 0.075]]) B.quad([xa, wy0, pf - 0.03], [xb, wy0, pf - 0.03], [xb, wy1, pf - 0.03], [xa, wy1, pf - 0.03], st.wallCol, st.wallMat, [[xa, wy0], [xb, wy0], [xb, wy1], [xa, wy1]], [0.9, 0.9, 0.8, 0.8]);
    // 窓の奥行き（抱き）
    const dep = 0.1;
    B.quad([wx0, wy0, pf - 0.03], [wx1, wy0, pf - 0.03], [wx1, wy0, pf - 0.03 - dep], [wx0, wy0, pf - 0.03 - dep], C.woodL, M.GRAIN, [[wx0, 0], [wx1, 0], [wx1, dep], [wx0, dep]], [0.8, 0.8, 0.6, 0.6]);
    B.quad([wx1, wy1, pf - 0.03], [wx0, wy1, pf - 0.03], [wx0, wy1, pf - 0.03 - dep], [wx1, wy1, pf - 0.03 - dep], C.woodL, M.GRAIN, [[wx1, 0], [wx0, 0], [wx0, dep], [wx1, dep]], [0.5, 0.5, 0.4, 0.4]);
    B.quad([wx0, wy1, pf - 0.03], [wx0, wy0, pf - 0.03], [wx0, wy0, pf - 0.03 - dep], [wx0, wy1, pf - 0.03 - dep], C.woodL, M.GRAIN, [[wy1, 0], [wy0, 0], [wy0, dep], [wy1, dep]], [0.6, 0.7, 0.6, 0.5]);
    B.quad([wx1, wy0, pf - 0.03], [wx1, wy1, pf - 0.03], [wx1, wy1, pf - 0.03 - dep], [wx1, wy0, pf - 0.03 - dep], C.woodL, M.GRAIN, [[wy0, 0], [wy1, 0], [wy1, dep], [wy0, dep]], [0.7, 0.6, 0.5, 0.6]);
    const gz = pf - 0.03 - dep;
    const frameCol = kind === 'sash' ? C.alu : C.woodL, frameMat = kind === 'sash' ? M.METAL : M.GRAIN;
    // 引き違いの2枚：ガラスと框
    const mid = (wx0 + wx1) / 2;
    for (const [xa, xb, dz] of [[wx0, mid + 0.02, 0.0], [mid - 0.02, wx1, -0.03]]) {
      B.quad([xa, wy0, gz + dz + 0.001], [xb, wy0, gz + dz + 0.001], [xb, wy1, gz + dz + 0.001], [xa, wy1, gz + dz + 0.001], st.behind || BEHIND.curtain, M.GLASS, [[xa, wy0], [xb, wy0], [xb, wy1], [xa, wy1]], [0.8, 0.8, 0.6, 0.6]);
      const fw = kind === 'sash' ? 0.035 : 0.04;
      for (const x of [xa + fw / 2, xb - fw / 2]) B.box(x, (wy0 + wy1) / 2, gz + dz + 0.012, fw, wy1 - wy0, 0.03, frameCol, frameMat, { ao: [0.8, 0.7] });
      for (const y of [wy0 + fw / 2, wy1 - fw / 2]) B.box((xa + xb) / 2, y, gz + dz + 0.012, xb - xa, fw, 0.03, frameCol, frameMat, { ao: [0.8, 0.7] });
      if (kind !== 'sash') B.box((xa + xb) / 2, (wy0 + wy1) / 2, gz + dz + 0.012, xb - xa, 0.025, 0.025, frameCol, frameMat);
    }
    // 窓台と格子
    B.box((wx0 + wx1) / 2, wy0 - 0.02, pf + 0.0, wx1 - wx0 + 0.12, 0.04, 0.12, C.wood, M.GRAIN, { ao: [0.7, 0.95] });
    if (kind === 'grille') {
      const n = Math.max(4, Math.round((wx1 - wx0) / 0.11));
      for (let q = 0; q <= n; q++) B.box(lerp(wx0 + 0.02, wx1 - 0.02, q / n), (wy0 + wy1) / 2, pf + 0.02, 0.03, wy1 - wy0, 0.04, C.wood, M.GRAIN, { ao: [0.7, 0.8] });
      for (const y of [wy0 + 0.02, wy1 - 0.02]) B.box((wx0 + wx1) / 2, y, pf + 0.02, wx1 - wx0 + 0.06, 0.05, 0.06, C.wood, M.GRAIN, { ao: [0.7, 0.8] });
    }
  } else {
    B.quad([s0 + 0.075, fy + koshi + 0.03, pf - 0.03], [s1 - 0.075, fy + koshi + 0.03, pf - 0.03], [s1 - 0.075, yT, pf - 0.03], [s0 + 0.075, yT, pf - 0.03], st.wallCol, st.wallMat, [[s0, fy + koshi], [s1, fy + koshi], [s1, yT], [s0, yT]], [0.92, 0.92, 0.5, 0.5]);
  }
  // 内法の貫（戸の高さの横木）
  if (kind === 'plain') B.box(cx, fy + 1.82, pf - 0.02, L - 0.15, 0.09, 0.03, C.wood, M.GRAIN, { ao: [0.8, 0.75], skip: 'n' });
}

// 家の本体：柱・壁・床下・縁側・ガラス戸・障子・雨戸の戸袋。前（南）が +z
function houseBody(B, h, st) {
  const { w, d } = h, hw = w / 2, hd = d / 2;
  const fy = st.fy, wh = st.wh;
  const zf = hd - 0.9;           // 障子の線（座敷の前）
  const open = st.open || 0;
  const nb = Math.max(3, Math.round(w / 1.82));
  const xs = []; for (let k = 0; k <= nb; k++) xs.push(-hw + (k / nb) * w);
  const inOpen = (x) => open > 0 && Math.abs(x) < open / 2 - 0.2;
  B.top = fy + wh + 0.2;
  // 床下：茅の家は礎石と暗がり、瓦の家は布基礎（換気口つき）
  if (st.kaya) {
    B.box(0, (fy - 0.12) / 2, 0, w - 0.2, fy - 0.12, d - 0.2, C.dark, M.DARK, { ao: [0.3, 0.3], skip: 'tb' });
    const posts = [];
    for (const x of xs) { posts.push([x, -hd]); posts.push([x, zf]); posts.push([x, hd]); }
    for (let k = 1; k < 5; k++) { const z = lerp(-hd, zf, k / 5); posts.push([-hw, z]); posts.push([hw, z]); }
    const rr = mulberry32(Math.round(h.x * 7 + 3));
    for (const [x, z] of posts) B.slab(x, -0.05, z, 0.24 + rr() * 0.06, 0.22 + rr() * 0.06, 0.16, rr, C.granite, M.GRANITE);
    for (const [x, z] of posts) B.box(x, (fy - 0.12) / 2 + 0.05, z, 0.13, fy - 0.12 - 0.1, 0.13, C.woodG, M.GRAIN, { ao: [0.4, 0.5] });
  } else {
    for (const [cx, cz, sx, sz] of [[0, -hd, w, 0.16], [0, hd, w, 0.16], [-hw, 0, 0.16, d], [hw, 0, 0.16, d]]) B.box(cx, (fy - 0.14) / 2 - 0.03, cz, sx + 0.02, fy - 0.14 + 0.06, sz + 0.02, C.concrete, M.CONCRETE, { ao: [0.55, 0.85] });
    for (const x of xs.slice(1, -1)) for (const sz of [-1, 1]) {
      B.box(x - 0.9, fy * 0.5, sz * (hd + 0.085), 0.4, 0.14, 0.01, C.dark, M.DARK);
      for (let q = 0; q < 6; q++) B.box(x - 1.08 + q * 0.07, fy * 0.5, sz * (hd + 0.09), 0.012, 0.14, 0.012, C.metal, M.METAL);
    }
  }
  // 土台と床（部屋の床の縁）
  for (const [cx, cz, sx, sz] of [[0, -hd, w + 0.16, 0.17], [-hw, (zf - hd) / 2, 0.17, zf + hd], [hw, (zf - hd) / 2, 0.17, zf + hd], [0, zf, w, 0.17]]) B.box(cx, fy - 0.07, cz, sx, 0.14, sz, C.wood, M.GRAIN, { ao: [0.5, 0.8] });
  const st2 = { ...st };
  // 北の壁
  B.sub(0, 0, -hd, Math.PI, () => {
    for (let k = 0; k < nb; k++) {
      const s0 = -hw + (k / nb) * w, s1 = -hw + ((k + 1) / nb) * w;
      const kind = st.northWin && st.northWin.includes(k) ? (st.kaya ? 'grille' : 'sash') : 'plain';
      wallBay(B, s0, s1, fy, wh, st2, kind);
    }
  });
  // 東西の壁（北の角から障子の線まで）
  const dz = zf + hd;
  const nzb = Math.max(2, Math.round(dz / 1.82));
  for (const sx of [-1, 1]) {
    B.sub(sx * hw, 0, (zf - hd) / 2, sx * Math.PI / 2, () => {
      for (let k = 0; k < nzb; k++) {
        const s0 = -dz / 2 + (k / nzb) * dz, s1 = -dz / 2 + ((k + 1) / nzb) * dz;
        const kind = k === (sx > 0 ? 1 : nzb - 2) ? (st.kaya ? 'window' : 'sash') : 'plain';
        wallBay(B, s0, s1, fy, wh, st2, kind);
      }
    });
  }
  // 柱（北・東西・障子の線・縁側の外の線）
  const post = (x, z, y0 = fy - 0.14) => B.box(x, (y0 + fy + wh) / 2, z, 0.15, fy + wh - y0, 0.15, C.wood, M.GRAIN, { ao: [0.65, 0.55] });
  for (const x of xs) { post(x, -hd); if (!inOpen(x)) post(x, zf); }
  for (let k = 1; k < nzb; k++) for (const sx of [-1, 1]) post(sx * hw, -hd + (k / nzb) * dz);
  for (const x of xs) if (!inOpen(x) && (xs.indexOf(x) % 2 === 0 || Math.abs(x) > hw - 0.1)) post(x, hd - 0.08);
  // 桁（壁の上の横木）
  for (const z of [-hd, zf, hd - 0.08]) B.box(0, fy + wh - 0.12, z, w + 0.3, 0.24, 0.17, C.wood, M.GRAIN, { ao: [0.45, 0.4] });
  for (const x of [-hw, hw]) B.box(x, fy + wh - 0.12, 0, 0.17, 0.24, d + 0.1, C.wood, M.GRAIN, { ao: [0.45, 0.4] });
  // 縁側：磨かれた縁板・縁框・束
  const ez0 = zf, ez1 = hd;
  const eX0 = st.genkan ? -hw : -hw, eX1 = st.genkan ? hw - w / nb : hw;
  B.box((eX0 + eX1) / 2, fy - 0.07, (ez0 + ez1) / 2 + 0.02, eX1 - eX0, 0.05, ez1 - ez0 + 0.04, C.floor, M.FLOOR, { ao: [0.5, 0.75], skip: 'n' });
  B.box((eX0 + eX1) / 2, fy - 0.1, ez1 + 0.02, eX1 - eX0, 0.12, 0.1, C.wood, M.GRAIN, { ao: [0.6, 0.8] });
  for (let x = eX0 + 0.4; x < eX1; x += 1.82) { B.box(x, (fy - 0.16) / 2, ez1 - 0.1, 0.1, fy - 0.16, 0.1, C.woodG, M.GRAIN, { ao: [0.4, 0.6] }); B.slab(x, -0.04, ez1 - 0.1, 0.16, 0.14, 0.1, mulberry32(Math.round(x * 13 + h.x)), C.granite, M.GRANITE); }
  B.box((eX0 + eX1) / 2, (fy - 0.16) / 2, ez1 - 0.35, eX1 - eX0 - 0.2, fy - 0.16, 0.02, C.dark, M.DARK, { skip: 'tbn' });
  // 障子の線：敷居・鴨居・障子（開けたところは無し）、上は小壁
  const shojiRun = (z, mkPanel) => {
    for (let k = 0; k < nb; k++) {
      const s0 = xs[k], s1 = xs[k + 1];
      if (inOpen((s0 + s1) / 2)) continue;
      mkPanel(s0, s1, z, k);
    }
  };
  const yK = fy + 1.8;
  shojiRun(zf, (s0, s1, z, k) => {
    if (st.genkan && k === nb - 1) return;
    for (let q = 0; q < 2; q++) {
      const xa = lerp(s0 + 0.075, s1 - 0.075, q / 2), xb = lerp(s0 + 0.075, s1 - 0.075, (q + 1) / 2);
      const zz = z + (q ? 0.03 : -0.01);
      B.quad([xa, fy, zz], [xb, fy, zz], [xb, yK, zz], [xa, yK, zz], C.shoji, M.SHOJI, [[xa, 0], [xb, 0], [xb, 1.8], [xa, 1.8]], [0.8, 0.8, 0.55, 0.55]);
      for (const x of [xa + 0.02, xb - 0.02]) B.box(x, (fy + yK) / 2, zz + 0.01, 0.035, 1.8, 0.03, C.woodL, M.GRAIN, { ao: [0.7, 0.6] });
    }
  });
  // 鴨居と小壁（障子の線と縁の外の線）
  for (const [z, full] of [[zf, false], [hd - 0.08, true]]) {
    for (let k = 0; k < nb; k++) {
      const s0 = xs[k], s1 = xs[k + 1];
      B.box((s0 + s1) / 2, yK + 0.05, z, s1 - s0, 0.1, 0.12, C.wood, M.GRAIN, { ao: [0.55, 0.5] });
      B.box((s0 + s1) / 2, fy - 0.015, z, s1 - s0, 0.03, 0.12, C.woodL, M.GRAIN, { ao: [0.6, 0.8] });
      if (full || !inOpen((s0 + s1) / 2)) B.quad([s0 + 0.075, yK + 0.1, z + 0.02], [s1 - 0.075, yK + 0.1, z + 0.02], [s1 - 0.075, fy + wh - 0.24, z + 0.02], [s0 + 0.075, fy + wh - 0.24, z + 0.02], st.wallCol, st.wallMat, [[s0, yK], [s1, yK], [s1, fy + wh], [s0, fy + wh]], [0.55, 0.55, 0.4, 0.4]);
    }
  }
  // 縁の外の線：ガラス戸（木の框・3段のガラス・腰板）と両端の戸袋
  const glassDoor = (xa, xb, z) => {
    const y0 = fy, y1 = yK;
    B.quad([xa, y0 + 0.28, z], [xb, y0 + 0.28, z], [xb, y1, z], [xa, y1, z], BEHIND.shoji, M.GLASS, [[xa, y0], [xb, y0], [xb, y1], [xa, y1]], [0.7, 0.7, 0.45, 0.45]);
    B.box((xa + xb) / 2, y0 + 0.14, z, xb - xa, 0.28, 0.03, C.board, M.BOARD, { ao: [0.6, 0.8] });
    for (const x of [xa + 0.022, xb - 0.022]) B.box(x, (y0 + y1) / 2, z + 0.005, 0.045, y1 - y0, 0.035, C.woodL, M.GRAIN, { ao: [0.7, 0.6] });
    for (const y of [y0 + 0.29, y0 + 0.78, y0 + 1.28, y1 - 0.02]) B.box((xa + xb) / 2, y, z + 0.005, xb - xa, 0.035, 0.035, C.woodL, M.GRAIN, { ao: [0.7, 0.6] });
  };
  for (let k = 0; k < nb; k++) {
    const s0 = xs[k], s1 = xs[k + 1];
    if (inOpen((s0 + s1) / 2)) continue;
    if (st.genkan && k === nb - 1) continue;
    const mid = (s0 + s1) / 2;
    glassDoor(s0 + 0.075, mid + 0.02, hd - 0.12);
    glassDoor(mid - 0.02, s1 - 0.075, hd - 0.05);
  }
  // 戸袋（雨戸をしまう箱）
  for (const sx of [-1, 1]) {
    if (st.genkan && sx > 0) continue;
    B.box(sx * (hw + 0.5), fy + 0.95, hd - 0.12, 0.92, 1.95, 0.2, st.boardCol, M.BOARD, { ao: [0.7, 0.8] });
    B.box(sx * (hw + 0.5), fy + 1.95, hd - 0.12, 0.98, 0.05, 0.26, C.wood, M.GRAIN);
  }
  // 玄関（瓦の家：東の端の間）
  if (st.genkan) {
    const s0 = xs[nb - 1], s1 = xs[nb];
    const gz = zf;
    B.box((s0 + s1) / 2, 0.12, gz + 0.45, s1 - s0, 0.24, 0.9, C.concrete, M.CONCRETE, { ao: [0.6, 0.9] });
    B.box((s0 + s1) / 2, 0.02, gz + 1.2, s1 - s0 - 0.3, 0.12, 0.5, C.granite, M.GRANITE, { ao: [0.7, 0.9] });
    for (let q = 0; q < 4; q++) {
      const xa = lerp(s0 + 0.08, s1 - 0.08, q / 4), xb = lerp(s0 + 0.08, s1 - 0.08, (q + 1) / 4) + 0.02;
      const zz = gz + (q % 2 ? 0.02 : -0.02);
      B.quad([xa, 0.24, zz], [xb, 0.24, zz], [xb, yK, zz], [xa, yK, zz], BEHIND.dark, M.GLASS, [[xa, 0], [xb, 0], [xb, 1.8], [xa, 1.8]], [0.6, 0.6, 0.4, 0.4]);
      for (const x of [xa + 0.02, xb - 0.02]) B.box(x, (0.24 + yK) / 2, zz + 0.01, 0.04, yK - 0.24, 0.04, C.alu, M.METAL);
      for (const y of [0.26, 1.0, yK - 0.02]) B.box((xa + xb) / 2, y, zz + 0.01, xb - xa, 0.04, 0.04, C.alu, M.METAL);
    }
    // 玄関の小さな庇（瓦）
    B.sub((s0 + s1) / 2, 0, hd - 0.2, 0, () => {
      const a = (s1 - s0) / 2 + 0.3;
      B.sub(0, 0, 0, 0, () => {
        const k = 0.35, y0 = fy + 2.15;
        const P = [], UV = [], Dd = [];
        for (let j = 0; j <= 2; j++) {
          const t = (j / 2) * 0.9;
          const rp = [], ru = [], rd = [];
          for (let i = 0; i <= 40; i++) { const x = -a + (i / 40) * 2 * a; rp.push([x, y0 + t * k, 0.9 - t]); ru.push([x, t * 1.06]); rd.push(tileWave(x)); }
          P.push(rp); UV.push(ru); Dd.push(rd);
        }
        B.grid(P, UV, C.kawara, M.KAWARA, { D: Dd });
        B.box(0, y0 - 0.08, 0.45, 2 * a, 0.03, 0.9, C.woodL, M.BOARD, { ao: [0.4, 0.5] });
        B.box(0, y0 - 0.02, 0.9, 2 * a, 0.14, 0.04, C.wood, M.GRAIN);
        for (const sx of [-1, 1]) B.sbox([sx * (a - 0.2), y0 - 0.1, 0.02], [sx * (a - 0.2), y0 - 0.1, 0.85], 0.06, 0.08, C.wood, M.GRAIN);
      });
    });
  }
  // 縁側の天井（化粧垂木の下地は屋根の軒裏）
  B.top = null;
  // 室内：開け放った座敷（始まりの家）
  if (open > 0) {
    const iz0 = -hd + 0.1, iz1 = zf;
    // 畳（縁つき）
    const tw = 0.91, tl = 1.82;
    for (let x = -hw + 0.1; x < hw - 0.1 - 0.01; x += tl) for (let z = iz0; z < iz1 - 0.01; z += tw) {
      const x1 = Math.min(x + tl, hw - 0.1), z1 = Math.min(z + tw, iz1);
      B.box((x + x1) / 2, fy + 0.02, (z + z1) / 2, x1 - x - 0.012, 0.04, z1 - z - 0.012, C.tatami, M.TATAMI, { ao: [0.1, 0.1 + 0.3 * ((z1 - iz0) / (iz1 - iz0)) ** 2], skip: 'b' });
      B.box((x + x1) / 2, fy + 0.041, z + 0.02, x1 - x, 0.004, 0.035, [0.03, 0.03, 0.035], M.CLOTH, { ao: [0.22, 0.22] });
      B.box((x + x1) / 2, fy + 0.041, z1 - 0.02, x1 - x, 0.004, 0.035, [0.03, 0.03, 0.035], M.CLOTH, { ao: [0.22, 0.22] });
    }
    // 竿縁の天井
    const yc = fy + wh - 0.28;
    B.quad([-hw, yc, iz1], [hw, yc, iz1], [hw, yc, iz0], [-hw, yc, iz0], [0.2, 0.15, 0.1], M.BOARD, [[-hw, iz1], [hw, iz1], [hw, iz0], [-hw, iz0]], [0.14, 0.14, 0.08, 0.08]);
    for (let x = -hw + 0.45; x < hw; x += 0.45) B.box(x, yc - 0.02, (iz0 + iz1) / 2, 0.035, 0.035, iz1 - iz0, [0.1, 0.07, 0.05], M.GRAIN, { ao: [0.3, 0.3] });
    // 奥の襖と床の間の暗がり
    const fz = -hd + 0.2;
    for (let k = 0; k < nb; k++) {
      const s0 = xs[k] + 0.08, s1 = xs[k + 1] - 0.08;
      if (k === 0) { B.quad([s0, fy + 0.1, fz], [s1, fy + 0.1, fz], [s1, yK, fz], [s0, yK, fz], [0.05, 0.045, 0.04], M.PLASTER, [[s0, 0], [s1, 0], [s1, 1.8], [s0, 1.8]], [0.3, 0.3, 0.25, 0.25]); B.box((s0 + s1) / 2, fy + 0.1, fz + 0.4, s1 - s0, 0.18, 0.8, C.floor, M.FLOOR, { ao: [0.3, 0.45] }); continue; }
      for (let q = 0; q < 2; q++) {
        const xa = lerp(s0, s1, q / 2), xb = lerp(s0, s1, (q + 1) / 2);
        B.quad([xa, fy + 0.04, fz + q * 0.02], [xb, fy + 0.04, fz + q * 0.02], [xb, yK, fz + q * 0.02], [xa, yK, fz + q * 0.02], C.fusuma, M.FUSUMA, [[xa, 0], [xb, 0], [xb, 1.8], [xa, 1.8]], [0.16, 0.16, 0.12, 0.12]);
        for (const x of [xa + 0.012, xb - 0.012]) B.box(x, (fy + yK) / 2, fz + q * 0.02 + 0.01, 0.022, yK - fy, 0.02, [0.04, 0.03, 0.025], M.GRAIN, { ao: [0.35, 0.3] });
        B.box((xa + xb) / 2, fy + 1.0, fz + q * 0.02 + 0.012, 0.03, 0.08, 0.01, [0.5, 0.42, 0.2], M.METAL, { ao: [0.35, 0.35] });
      }
    }
    B.quad([-hw, yK, fz], [hw, yK, fz], [hw, yc, fz], [-hw, yc, fz], [0.3, 0.26, 0.2], M.PLASTER, [[-hw, yK], [hw, yK], [hw, yc], [-hw, yc]], [0.12, 0.12, 0.08, 0.08]);
    B.box(0, yK + 0.05, fz + 0.03, w, 0.1, 0.06, C.wood, M.GRAIN, { ao: [0.3, 0.3] });
    // 欄間（障子の線の上、開けた間）：透かしの格子
    B.box(0, yK + 0.35, zf, open + 0.2, 0.5, 0.03, [0.03, 0.025, 0.02], M.KOSHI, { ao: [0.4, 0.35] });
    // 側の内壁
    for (const sx of [-1, 1]) B.quad([sx * (hw - 0.09), fy, sx > 0 ? iz0 : iz1], [sx * (hw - 0.09), fy, sx > 0 ? iz1 : iz0], [sx * (hw - 0.09), yc, sx > 0 ? iz1 : iz0], [sx * (hw - 0.09), yc, sx > 0 ? iz0 : iz1], [0.32, 0.27, 0.2], M.PLASTER, [[0, 0], [1, 0], [1, 1], [0, 1]], [0.18, 0.18, 0.1, 0.1]);
  }
  return { zf };
}

function kayaHouse(B, h, r) {
  const w = h.w, d = h.d, fy = 0.55, wh = 2.45;
  const earth = r() < 0.6;
  const st = { fy, wh, kaya: true, open: h.id === 'h1' ? 5.4 : 0, wallCol: earth ? C.earth : C.plaster, wallMat: M.PLASTER, boardCol: r() < 0.5 ? C.yakisugi : C.board, northWin: [1, 3], behind: BEHIND.dark };
  houseBody(B, h, st);
  const ey = fy + wh + 0.25;
  const a = w / 2 + 1.45, b = d / 2 + 1.45;
  const pitch = 1.08 + r() * 0.1;
  const H = b * pitch;
  const rr = Math.max(1.2, a * 0.46, w * 0.38 - 0.4);
  const tin = h.id === 'h8';
  const info = thatchRoof(B, { a, b, ey, H, r: rr, th: 0.78, hw: w / 2, hd: d / 2, tin, tinCol: C.tinRed, bulge: 0.32 });
  return { top: info.top };
}

function kawaraHouse(B, h, r, twoStory) {
  const w = h.w, d = h.d, fy = 0.5, wh = 2.6;
  const st = { fy, wh, kaya: false, wallCol: C.plaster, wallMat: M.PLASTER, boardCol: C.yakisugi, northWin: [1, 2], genkan: true, behind: BEHIND.curtain };
  houseBody(B, h, st);
  const k = 0.55;
  const wallTop = fy + wh;
  if (!twoStory) {
    const ov = 0.95;
    const a = w / 2 + ov, b = d / 2 + ov;
    const y0 = wallTop - ov * k + 0.28;
    const R = roof(B, { a, b, y0, k, style: 'irimoya', wa: w / 2, wb: d / 2, gutter: true, downpipe: true, noshiH: 0.42 });
    return { top: R.top };
  }
  // 二階建て：一階の庇（下屋）＋二階（入母屋）
  const ov = 0.85;
  const a1 = w / 2 + ov, b1 = d / 2 + ov;
  const d2 = d * 0.72, w2 = d2 + (w - d);
  const y0 = wallTop - ov * k + 0.28;
  const tTop = b1 - d2 / 2 - 0.05;
  const Rs = roof(B, { a: a1, b: b1, y0, k, style: 'skirt', tTop, wa: w / 2, wb: d / 2, gutter: true, downpipe: true });
  const y2 = Rs.yAt(tTop) - 0.25, wh2 = 2.35;
  B.top = y2 + wh2 + 0.2;
  // 二階の壁：柱・漆喰・アルミの窓・手すり
  const hw2 = w2 / 2, hd2 = d2 / 2;
  const n2 = Math.max(3, Math.round(w2 / 1.82));
  for (const [rot, L, D] of [[0, w2, hd2], [Math.PI, w2, hd2], [Math.PI / 2, d2, hw2], [-Math.PI / 2, d2, hw2]]) {
    B.sub(0, y2, 0, rot, () => {
      B.sub(0, 0, D, 0, () => {
        const n = rot === 0 || rot === Math.PI ? n2 : Math.max(2, Math.round(L / 1.82));
        for (let q = 0; q < n; q++) {
          const s0 = -L / 2 + (q / n) * L, s1 = -L / 2 + ((q + 1) / n) * L;
          const kind = rot === 0 ? (q === 0 ? 'plain' : 'sash') : (q === 1 ? 'sash' : 'plain');
          wallBay(B, s0, s1, 0, wh2, { ...st, koshi: 0.3, behind: BEHIND.curtain }, kind);
          B.box(s0, wh2 / 2, 0, 0.14, wh2, 0.14, C.wood, M.GRAIN, { ao: [0.6, 0.5] });
        }
        B.box(L / 2, wh2 / 2, 0, 0.14, wh2, 0.14, C.wood, M.GRAIN, { ao: [0.6, 0.5] });
        B.box(0, wh2 - 0.1, 0, L + 0.14, 0.2, 0.16, C.wood, M.GRAIN, { ao: [0.45, 0.4] });
      });
    });
  }
  // 南の手すり（物干しの縁）
  B.sub(0, y2, hd2, 0, () => {
    B.box(0, 0.02, 0.45, w2 * 0.8, 0.05, 0.8, C.woodL, M.FLOOR, { ao: [0.5, 0.7] });
    B.box(0, 0.85, 0.83, w2 * 0.8, 0.06, 0.08, C.wood, M.GRAIN);
    B.box(0, 0.45, 0.83, w2 * 0.8, 0.04, 0.05, C.wood, M.GRAIN);
    const n = Math.round(w2 * 0.8 / 0.12);
    for (let q = 0; q <= n; q++) B.box(-w2 * 0.4 + (q / n) * w2 * 0.8, 0.42, 0.84, 0.03, 0.8, 0.03, C.wood, M.GRAIN, { ao: [0.7, 0.9] });
    for (const sx of [-1, 1]) B.box(sx * w2 * 0.4, 0.45, 0.83, 0.08, 0.9, 0.08, C.wood, M.GRAIN);
    // 物干し竿
    B.tube([[-w2 * 0.35, 1.5, 0.65], [w2 * 0.35, 1.5, 0.65]], 0.018, 6, C.alu, M.METAL);
    for (const sx of [-1, 1]) B.box(sx * w2 * 0.37, 0.85 + 0.35, 0.72, 0.03, 0.7, 0.03, C.alu, M.METAL);
  });
  B.top = null;
  const ey2 = y2 + wh2;
  const ov2 = 0.8;
  const a2 = w2 / 2 + ov2, b2 = d2 / 2 + ov2;
  const R2 = roof(B, { a: a2, b: b2, y0: ey2 - ov2 * k + 0.28, k, style: 'irimoya', wa: hw2, wb: hd2, gutter: true, noshiH: 0.36 });
  return { top: R2.top };
}

// 納屋：板張り（押縁つき）、瓦棒葺きのトタン、開いた間口、薪の山
function barn(B, o, r) {
  const w = o.w, d = o.d, wh = 2.9;
  const bc = r() < 0.5 ? C.board : C.woodG;
  B.top = wh;
  const wallSeg = (x0, x1, z, rot) => {
    B.sub((x0 + x1) / 2, 0, z, rot, () => {
      const L = Math.abs(x1 - x0);
      B.box(0, wh / 2, 0, L, wh, 0.05, bc, M.BOARD, { ao: [0.8, 0.55], skip: 'n' });
      for (let x = -L / 2 + 0.3; x < L / 2 - 0.1; x += 0.45) B.box(x, wh / 2, 0.035, 0.05, wh - 0.1, 0.025, bc, M.GRAIN, { ao: [0.8, 0.6] });
      B.box(0, 0.1, 0.03, L, 0.2, 0.06, C.wood, M.GRAIN, { ao: [0.5, 0.8] });
    });
  };
  wallSeg(-w / 2, w / 2, -d / 2, Math.PI);
  B.sub(-w / 2, 0, 0, -Math.PI / 2, () => { B.box(0, wh / 2, 0, d, wh, 0.05, bc, M.BOARD, { ao: [0.8, 0.55], skip: 'n' }); for (let x = -d / 2 + 0.3; x < d / 2 - 0.1; x += 0.45) B.box(x, wh / 2, 0.035, 0.05, wh - 0.1, 0.025, bc, M.GRAIN); });
  B.sub(w / 2, 0, 0, Math.PI / 2, () => { B.box(0, wh / 2, 0, d, wh, 0.05, bc, M.BOARD, { ao: [0.8, 0.55], skip: 'n' }); for (let x = -d / 2 + 0.3; x < d / 2 - 0.1; x += 0.45) B.box(x, wh / 2, 0.035, 0.05, wh - 0.1, 0.025, bc, M.GRAIN); });
  wallSeg(-w / 2, -w / 2 + w * 0.44, d / 2, 0);
  // 開いた間口の奥：暗がりと藁束・農具
  B.box(w * 0.22, wh / 2, -d / 2 + 0.08, w * 0.5, wh, 0.02, [0.03, 0.025, 0.02], M.BOARD, { skip: 'n', ao: [0.25, 0.2] });
  B.quad([-w / 2 + w * 0.44, 0.01, d / 2], [w / 2, 0.01, d / 2], [w / 2, 0.01, -d / 2], [-w / 2 + w * 0.44, 0.01, -d / 2], [0.12, 0.1, 0.08], M.PLAIN, [[0, 0], [1, 0], [1, 1], [0, 1]], [0.5, 0.5, 0.2, 0.2]);
  for (let q = 0; q < 5; q++) {
    const x = w * 0.05 + q * 0.42, z = -d / 2 + 0.6;
    B.cyl(x, z, 0, 1.1 + (q % 2) * 0.15, 0.2, 0.16, 8, C.thatch, M.THATCH, [0.35, 0.45], 't');
  }
  for (let q = 0; q < 3; q++) B.sbox([w * 0.35 + q * 0.25, 0.02, -d / 2 + 0.3], [w * 0.35 + q * 0.25 + 0.05, 1.6, -d / 2 + 0.12], 0.035, 0.035, C.woodL, M.GRAIN, { ao: [0.3, 0.4] });
  // 柱と桁
  for (const x of [-w / 2, -w / 2 + w * 0.44, w / 2]) B.box(x, wh / 2, d / 2, 0.14, wh, 0.14, C.wood, M.GRAIN, { ao: [0.7, 0.6] });
  B.box(0, wh - 0.1, d / 2, w + 0.2, 0.2, 0.15, C.wood, M.GRAIN, { ao: [0.5, 0.5] });
  B.top = null;
  // 屋根：トタン（瓦棒）
  const a = w / 2 + 0.5, b = d / 2 + 0.6;
  const k = 0.42;
  const tin = r() < 0.6 ? C.tinRed : C.tinTeal;
  const y0 = wh - 0.6 * k + 0.12;
  const R = roof(B, { a, b, y0, k, style: 'gable', mat: M.TIN, col: tin, sag: 0.0, gw: w / 2, gwz: d / 2, gwBase: wh, gableCol: bc, gableMat: M.BOARD, edgeH: 0.06, ridge: false, edgeCol: tin });
  // 瓦棒（斜面の桟）と棟包み
  for (const sz of [-1, 1]) for (let x = -a + 0.2; x <= a - 0.1; x += 0.45) {
    B.sbox([x, y0 + 0.03, sz * (b - 0.02)], [x, R.y1 + 0.03, 0], 0.045, 0.045, tin, M.TIN, { ao: [0.7, 1] });
  }
  B.sbox([-a, R.y1 + 0.05, 0], [a, R.y1 + 0.05, 0], 0.4, 0.1, tin, M.TIN, { ao: [0.8, 1] });
  // 薪の山（切り口が外を向く）と小さな屋根
  const fx = -w / 2 - 0.55;
  B.box(fx, 0.62, 0, 0.8, 1.24, d * 0.82, [0.36, 0.3, 0.22], M.BARK, { mats: { w: M.LOGEND }, cols: { w: [0.42, 0.34, 0.24] }, ao: [0.55, 1] });
  B.sub(fx, 1.35, 0, 0, () => {
    B.quad([-0.55, 0, d * 0.45], [-0.55, 0, -d * 0.45], [0.45, 0.25, -d * 0.45], [0.45, 0.25, d * 0.45], C.tinBrown, M.TIN, [[-0.55, d * 0.45], [-0.55, -d * 0.45], [0.45, -d * 0.45], [0.45, d * 0.45]], [0.8, 0.8, 0.9, 0.9]);
  });
  return { top: R.y1 };
}

// 土蔵：石の腰・なまこ壁・厚い漆喰・鉢巻・扉の庇・置き屋根
function kura(B, o) {
  const w = o.w, d = o.d, wh = 4.2;
  B.box(0, 0.35, 0, w + 0.24, 0.7, d + 0.24, C.granite, M.GRANITE, { ao: [0.55, 0.9] });
  B.top = 0.7 + wh + 0.4;
  B.box(0, 0.7 + 0.6, 0, w + 0.04, 1.2, d + 0.04, [0.06, 0.06, 0.065], M.NAMAKO, { skip: 't', ao: [0.8, 0.9] });
  B.box(0, 1.9 + 0.03, 0, w + 0.08, 0.06, d + 0.08, C.shikkui, M.PLASTER, { ao: [0.9, 0.95] });
  B.box(0, 1.9 + (wh - 1.2) / 2, 0, w, wh - 1.2, d, C.shikkui, M.PLASTER, { skip: 'b', ao: [0.95, 0.72] });
  // 鉢巻（軒下の厚い帯）
  B.box(0, 0.7 + wh - 0.15, 0, w + 0.2, 0.3, d + 0.2, C.shikkui, M.PLASTER, { ao: [0.8, 0.6] });
  B.box(0, 0.7 + wh + 0.08, 0, w + 0.34, 0.16, d + 0.34, C.shikkui, M.PLASTER, { ao: [0.7, 0.55] });
  // 扉：厚い漆喰の枠と観音扉（段つき）
  const fz = d / 2;
  B.top = 2.95; // 扉まわりの雨だれは庇の下から
  B.box(0, 1.65, fz + 0.06, 1.7, 2.1, 0.12, C.shikkui, M.PLASTER, { ao: [0.8, 0.8] });
  B.box(0, 1.6, fz + 0.12, 1.3, 1.9, 0.02, [0.03, 0.03, 0.03], M.DARK);
  for (const sx of [-1, 1]) {
    // 観音扉：段々の掛子（3段の段つき）と鉄の把手
    B.box(sx * 0.33, 1.6, fz + 0.2, 0.62, 1.85, 0.14, C.shikkuiD, M.PLASTER, { ao: [0.72, 0.85] });
    B.box(sx * 0.33, 1.6, fz + 0.29, 0.52, 1.73, 0.04, C.shikkuiD, M.PLASTER, { ao: [0.78, 0.85] });
    B.box(sx * 0.33, 1.6, fz + 0.325, 0.42, 1.6, 0.03, C.shikkuiD, M.PLASTER, { ao: [0.82, 0.88] });
    B.box(sx * 0.02, 1.6, fz + 0.28, 0.035, 1.8, 0.02, [0.05, 0.048, 0.045], M.METAL);
    const ring = []; for (let q = 0; q <= 12; q++) { const t = (q / 12) * Math.PI * 2; ring.push([sx * 0.2 + Math.sin(t) * 0.06, 1.52 - 0.06 + Math.cos(t) * 0.06, fz + 0.36]); }
    B.tube(ring, 0.011, 6, [0.035, 0.032, 0.03], M.METAL);
    B.box(sx * 0.2, 1.52, fz + 0.345, 0.05, 0.05, 0.02, [0.04, 0.036, 0.033], M.METAL);
  }
  // 扉の上の庇（瓦）と持ち送り
  B.sub(0, 0, fz, 0, () => {
    const a = 1.25, y0 = 3.05;
    const P = [], UV = [], Dd = [];
    for (let j = 0; j <= 2; j++) {
      const t = (j / 2) * 0.75;
      const rp = [], ru = [], rd = [];
      for (let i = 0; i <= 50; i++) { const x = -a + (i / 50) * 2 * a; rp.push([x, y0 + t * 0.5, 0.8 - t]); ru.push([x, t * 1.1]); rd.push(tileWave(x)); }
      P.push(rp); UV.push(ru); Dd.push(rd);
    }
    B.grid(P, UV, C.kawara, M.KAWARA, { D: Dd });
    // 軒瓦の丸い縁（庇の先に瓦の並びが見える）
    B.tube([[-a, y0 - 0.02, 0.82], [a, y0 - 0.02, 0.82]], 0.045, 8, C.kawara, M.NOSHI, { up: [0, 0, 1] });
    for (let q = 0; q <= 8; q++) { const x = -a + 0.1 + (q / 8) * (2 * a - 0.2); const poly = []; for (let k = 0; k < 10; k++) { const t = -(k / 10) * Math.PI * 2; poly.push([x + Math.cos(t) * 0.06, y0 - 0.01 + Math.sin(t) * 0.06]); } B.extrude(poly, 0.78, 0.87, [0.1, 0.1, 0.105], M.NOSHI, 0.9); }
    B.box(0, y0 + 0.4, 0.06, 2 * a, 0.18, 0.14, C.kawara, M.NOSHI);
    B.box(0, y0 - 0.06, 0.4, 2 * a, 0.1, 0.8, C.shikkui, M.PLASTER, { ao: [0.45, 0.6] });
    for (const sx of [-1, 1]) B.sbox([sx * 0.95, y0 - 0.55, 0.02], [sx * 0.95, y0 - 0.08, 0.7], 0.08, 0.1, C.shikkui, M.PLASTER, { ao: [0.5, 0.6] });
  });
  // 上の小窓（鉄格子と漆喰の戸）
  B.top = 4.45;
  B.box(0, 3.95, fz + 0.06, 0.95, 0.85, 0.12, C.shikkui, M.PLASTER, { ao: [0.8, 0.75] });
  B.box(0, 3.95, fz + 0.1, 0.6, 0.55, 0.02, [0.03, 0.03, 0.03], M.DARK);
  for (let q = 0; q < 4; q++) B.box(-0.22 + q * 0.147, 3.95, fz + 0.13, 0.025, 0.55, 0.025, [0.06, 0.055, 0.05], M.METAL);
  B.top = null;
  // 屋根：切妻（置き屋根）
  const a = w / 2 + 0.6, b = d / 2 + 0.6;
  const k = 0.62;
  const ey = 0.7 + wh + 0.2;
  const R = roof(B, { a, b, y0: ey, k, style: 'gable', gw: w / 2 + 0.17, gwz: d / 2 + 0.17, gwBase: ey - 0.04, gableCol: C.shikkui, gableMat: M.PLASTER, edgeH: 0.12, noshiH: 0.5, bargeCol: C.shikkui });
  // 妻の家紋（丸に水）
  B.sub(w / 2 + 0.18, ey + 0.8, 0, Math.PI / 2, () => {
    const poly = []; for (let q = 0; q < 16; q++) { const t = (q / 16) * Math.PI * 2; poly.push([Math.cos(t) * 0.32, Math.sin(t) * 0.32]); }
    B.extrude(poly, 0, 0.015, [0.04, 0.04, 0.045], M.PLAIN, 0.9);
  });
  return { top: R.top };
}

// 石灯籠（春日型）：基礎・竿・中台・火袋・笠（蕨手）・宝珠
function lantern(B, x, z, s, col) {
  const c = col || [0.25, 0.245, 0.23];
  B.cyl(x, z, -0.05, 0.16 * s, 0.4 * s, 0.36 * s, 6, c, M.GRANITE, [0.6, 0.9], 't');
  B.cyl(x, z, 0.16 * s, 0.24 * s, 0.26 * s, 0.2 * s, 6, c, M.GRANITE, [0.8, 0.9], 't');
  B.lathe(x, z, [[0.12 * s, 0.24 * s], [0.1 * s, 0.4 * s], [0.095 * s, 0.62 * s], [0.13 * s, 0.64 * s], [0.13 * s, 0.68 * s], [0.095 * s, 0.7 * s], [0.1 * s, 0.95 * s], [0.13 * s, 1.0 * s]], 10, c, M.GRANITE);
  B.cyl(x, z, 1.0 * s, 1.16 * s, 0.24 * s, 0.34 * s, 6, c, M.GRANITE, [0.8, 0.95], 'tb');
  // 火袋：柱の間が窓
  const fy0 = 1.16 * s, fy1 = 1.48 * s, fr = 0.22 * s;
  for (let k = 0; k < 6; k++) {
    const a0 = (k / 6) * Math.PI * 2, a1 = ((k + 1) / 6) * Math.PI * 2;
    const p0 = [x + Math.cos(a0) * fr, z + Math.sin(a0) * fr], p1 = [x + Math.cos(a1) * fr, z + Math.sin(a1) * fr];
    const m = (t) => [lerp(p0[0], p1[0], t), lerp(p0[1], p1[1], t)];
    const win = k % 2 === 0;
    const L = [[0, 0.18], [0.18, 0.82], [0.82, 1]];
    for (const [ta, tb] of L) {
      const A = m(ta), Bb = m(tb);
      const isWin = win && ta > 0.1 && tb < 0.9;
      if (isWin) {
        B.quad([Bb[0], fy0 + 0.05 * s, Bb[1]], [A[0], fy0 + 0.05 * s, A[1]], [A[0], fy1 - 0.05 * s, A[1]], [Bb[0], fy1 - 0.05 * s, Bb[1]], [0.015, 0.014, 0.012], M.DARK, [[0, 0], [1, 0], [1, 1], [0, 1]]);
        B.quad([Bb[0], fy0, Bb[1]], [A[0], fy0, A[1]], [A[0], fy0 + 0.05 * s, A[1]], [Bb[0], fy0 + 0.05 * s, Bb[1]], c, M.GRANITE, [[0, 0], [1, 0], [1, 0.05], [0, 0.05]]);
        B.quad([Bb[0], fy1 - 0.05 * s, Bb[1]], [A[0], fy1 - 0.05 * s, A[1]], [A[0], fy1, A[1]], [Bb[0], fy1, Bb[1]], c, M.GRANITE, [[0, 0], [1, 0], [1, 0.05], [0, 0.05]]);
      } else B.quad([Bb[0], fy0, Bb[1]], [A[0], fy0, A[1]], [A[0], fy1, A[1]], [Bb[0], fy1, Bb[1]], c, M.GRANITE, [[Bb[0] + Bb[1], fy0], [A[0] + A[1], fy0], [A[0] + A[1], fy1], [Bb[0] + Bb[1], fy1]], [0.85, 0.85, 0.8, 0.8]);
    }
  }
  B.cyl(x, z, fy1, fy1 + 0.02 * s, 0.26 * s, 0.26 * s, 6, c, M.GRANITE, [0.6, 0.7], 'b');
  // 笠：反った六角の屋根と蕨手
  B.cyl(x, z, fy1 + 0.02 * s, fy1 + 0.08 * s, 0.46 * s, 0.46 * s, 6, c, M.GRANITE, [0.5, 0.8], 'b');
  B.cyl(x, z, fy1 + 0.08 * s, fy1 + 0.2 * s, 0.46 * s, 0.2 * s, 6, c, M.GRANITE, [0.85, 0.95]);
  B.cyl(x, z, fy1 + 0.2 * s, fy1 + 0.26 * s, 0.2 * s, 0.1 * s, 6, c, M.GRANITE, [0.95, 1]);
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    B.sbox([x + Math.cos(a) * 0.43 * s, fy1 + 0.07 * s, z + Math.sin(a) * 0.43 * s], [x + Math.cos(a) * 0.5 * s, fy1 + 0.16 * s, z + Math.sin(a) * 0.5 * s], 0.06 * s, 0.05 * s, c, M.GRANITE);
  }
  B.lathe(x, z, [[0.07 * s, fy1 + 0.25 * s], [0.08 * s, fy1 + 0.3 * s], [0.1 * s, fy1 + 0.34 * s], [0.07 * s, fy1 + 0.42 * s], [0.02 * s, fy1 + 0.47 * s], [0.0, fy1 + 0.48 * s]], 8, c, M.GRANITE);
}

// 地蔵：丸い石の体と頭、赤い前掛けと帽子
function jizo(B, x, y, z, rot, rnd) {
  B.setFrame(x, y, z, rot);
  B.box(0, 0.1, 0, 0.52, 0.28, 0.46, C.granite, M.GRANITE, { ao: [0.6, 0.9] });
  B.box(0, 0.27, 0, 0.44, 0.06, 0.4, C.granite, M.GRANITE, { ao: [0.8, 0.9] });
  const st = [0.5, 0.49, 0.46].map((v) => v * (0.9 + rnd() * 0.15));
  B.lathe(0, 0, [[0.0, 0.3], [0.15, 0.3], [0.17, 0.36], [0.165, 0.55], [0.15, 0.68], [0.1, 0.76], [0.07, 0.785], [0.095, 0.81], [0.112, 0.87], [0.11, 0.93], [0.09, 0.985], [0.05, 1.015], [0.0, 1.025]], 14, st, M.GRANITE, { sz: 0.85 });
  // 前掛け
  B.lathe(0, 0, [[0.2, 0.55], [0.14, 0.72], [0.085, 0.79]], 12, C.red, M.CLOTH, { a0: 0.15, a1: Math.PI - 0.15, sz: 0.95 });
  // 帽子
  B.lathe(0, 0, [[0.118, 0.9], [0.12, 0.95], [0.1, 1.0], [0.06, 1.04], [0.0, 1.055]], 12, C.red, M.CLOTH, { sz: 0.87 });
}

// ---- 材質の絵（GPUで焼く） ----
const BAKE_VS = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;
const BAKE_FS = /* glsl */ `
precision highp float;
precision highp int;
${NOISE}
uniform int uLayer;
uniform int uOne; // 常に1（ループを展開させず、初回のコンパイルを軽くする）
varying vec2 vUv;
ivec2 wrapI(ivec2 p, ivec2 P) { return p - P * ivec2(floor(vec2(p) / vec2(P))); }
float hs(ivec2 p, int s) { return float(pcg(uint(p.x) * 7919u + pcg(uint(p.y) + pcg(uint(s) + 17u))) >> 8u) / 16777216.0; }
float pn(vec2 x, ivec2 P, int s) {
  vec2 i = floor(x); vec2 f = x - i; vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  ivec2 ii = ivec2(i);
  float a = hs(wrapI(ii, P), s), b = hs(wrapI(ii + ivec2(1, 0), P), s), c = hs(wrapI(ii + ivec2(0, 1), P), s), d = hs(wrapI(ii + ivec2(1, 1), P), s);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float pfbm(vec2 x, ivec2 P, int s, int oct) {
  float t = 0.0, a = 0.5, n = 0.0;
  for (int i = 0; i < 7; i++) { if (i >= oct) break; t += a * pn(x, P, s + i * 31); n += a; a *= 0.5; x *= 2.0; P *= 2; }
  return t / n;
}
// 周期つきのボロノイ：x=最近 y=二番目 z=セルの値 w=最近点への角度
vec4 pvor(vec2 x, ivec2 P, int s) {
  vec2 i = floor(x), f = x - i;
  float d1 = 9.0, d2 = 9.0, id = 0.0, ang = 0.0;
  for (int y = -1; y <= 1; y++) for (int xx = -1; xx <= 1; xx++) {
    ivec2 c = ivec2(i) + ivec2(xx, y);
    ivec2 w = wrapI(c, P);
    vec2 o = vec2(hs(w, s), hs(w, s + 7)) * 0.85 + 0.075;
    vec2 r = vec2(xx, y) + o - f;
    float d = length(r);
    if (d < d1) { d2 = d1; d1 = d; id = hs(w, s + 13); ang = atan(r.y, r.x); }
    else if (d < d2) d2 = d;
  }
  return vec4(d1, d2, id, ang);
}
vec4 layer(vec2 uv) {
  float u = uv.x, v = uv.y;
  if (uLayer == 0) { // 漆喰：こて跡・砂粒・ひび・しみ（4m）
    float lo = pfbm(uv * 3.0, ivec2(3), 1, 5);
    float tr = pfbm(uv * vec2(12.0, 16.0), ivec2(12, 16), 2, 4);
    float gr = hs(ivec2(uv * 512.0), 3);
    vec4 wv = pvor(uv * 10.0, ivec2(10), 4);
    float crack = (1.0 - smoothstep(0.0, 0.03, wv.y - wv.x)) * smoothstep(0.6, 0.78, pfbm(uv * 5.0, ivec2(5), 5, 3));
    float stain = smoothstep(0.55, 0.8, pfbm(uv * 4.0 + 3.0, ivec2(4), 6, 5));
    float lo2 = pfbm(uv * 8.0, ivec2(8), 7, 4);
    float m = 1.0 + (lo - 0.5) * 0.3 + (lo2 - 0.5) * 0.12 + (tr - 0.5) * 0.08 + (gr - 0.5) * 0.07 - crack * 0.18 - stain * 0.16;
    vec3 c = vec3(m) * mix(vec3(1.0), vec3(1.03, 1.0, 0.93), lo) * mix(vec3(1.0), vec3(0.95, 0.94, 0.9), stain);
    return vec4(c * 0.5, 0.5 + (tr - 0.5) * 0.5 + (gr - 0.5) * 0.12 - crack * 0.4);
  }
  if (uLayer == 1) { // 板張り：縦板11枚・木目・節・継ぎ目・風化（2.4m）
    float x = u * 11.0; float i = floor(x); float f = x - i;
    float bid = hs(wrapI(ivec2(int(i), 0), ivec2(11, 1)), 11);
    float bid2 = hs(wrapI(ivec2(int(i), 0), ivec2(11, 1)), 12);
    float warp = pfbm(vec2(u * 33.0, v * 3.0), ivec2(33, 3), 13, 4);
    float lines = pow(0.5 + 0.5 * sin((f * 6.0 + bid * 13.0 + warp * 4.5 + sin(v * 6.2831 * 2.0 + bid * 6.0) * 0.4) * 6.2831), 3.0);
    float fib = pfbm(vec2(u * 440.0, v * 10.0), ivec2(440, 10), 14, 3);
    vec4 kn = pvor(vec2(u * 11.0, v * 5.0), ivec2(11, 5), 15);
    float knot = step(0.78, kn.z) * smoothstep(0.16, 0.02, kn.x);
    float weath = clamp(pfbm(vec2(u * 11.0, v * 2.0), ivec2(11, 2), 16, 3) * 1.3 - 0.2 + (bid - 0.5) * 0.5, 0.0, 1.0);
    float gap = smoothstep(0.0, 0.03, f) * smoothstep(1.0, 0.97, f);
    vec3 wood = mix(vec3(1.08, 0.92, 0.76), vec3(0.93, 0.94, 0.97), weath);
    float tone = 0.72 + 0.5 * bid2;
    vec3 c = wood * tone * (0.78 + 0.26 * (1.0 - lines)) * (0.88 + 0.24 * fib) * (1.0 - knot * 0.55) * mix(0.18, 1.0, gap);
    float h = 0.55 + 0.2 * (1.0 - lines) * (0.4 + weath) + 0.08 * fib - (1.0 - gap) * 0.5 + knot * 0.08;
    return vec4(c * 0.5, h);
  }
  if (uLayer == 2) { // 柾目・板目（柱・梁・縁板。木目はv方向、1m）
    float warp = pfbm(vec2(u * 4.0, v * 1.0), ivec2(4, 1), 21, 4);
    float r = u * 22.0 + warp * 3.5 + pfbm(vec2(u * 2.0, v * 3.0), ivec2(2, 3), 25, 2) * 2.0;
    float lines = pow(0.5 + 0.5 * sin(r * 6.2831), 4.0);
    float fib = pfbm(vec2(u * 320.0, v * 6.0), ivec2(320, 6), 22, 3);
    float blot = pfbm(uv * vec2(3.0, 2.0), ivec2(3, 2), 23, 4);
    vec4 kn = pvor(vec2(u * 3.0, v * 2.0), ivec2(3, 2), 24);
    float knot = step(0.85, kn.z) * smoothstep(0.12, 0.03, length(vec2(kn.x * 1.0, 0.0)));
    vec3 c = mix(vec3(1.06, 0.95, 0.82), vec3(0.96, 0.96, 0.95), 0.4 * blot) * (0.82 + 0.2 * (1.0 - lines)) * (0.9 + 0.2 * fib) * (1.0 - 0.45 * knot);
    return vec4(c * 0.5, 0.5 + 0.14 * (1.0 - lines) + 0.12 * fib);
  }
  if (uLayer == 3) { // 茅：下を向いた短い茎の端（2〜5cm）がびっしり重なる面・束ごとの明暗・葺き足の段（1.2m）
    float weather = pfbm(uv * 2.0, ivec2(2), 51, 5);
    // 束（幅約10cm×葺き足30cm、段ごとに半分ずれる）
    float brow = floor(v * 4.0 + pfbm(vec2(u * 3.0, v * 4.0), ivec2(3, 4), 52, 2) * 0.35);
    int bri = int(brow);
    float bx = u * 12.0 + hs(wrapI(ivec2(0, bri), ivec2(1, 4)), 53) * 3.0 + pfbm(vec2(u * 6.0, v * 8.0), ivec2(6, 8), 54, 2) * 0.6;
    ivec2 bc = wrapI(ivec2(int(floor(bx)), bri), ivec2(12, 4));
    float bt = hs(bc, 55), bt2 = hs(bc, 56);
    float fv = fract(v * 4.0);
    float bestH = -1.0; vec3 bestC = vec3(0.0);
    for (int k = 0; k < 4 * uOne; k++) {
      int NX = 72 + k * 10, NY = 30 + k * 6;
      float gy = v * float(NY) + float(k) * 0.61;
      float row0 = floor(gy);
      for (int dy = 0; dy < 2 * uOne; dy++) {
        int ry = int(row0) + dy;
        float off = hs(wrapI(ivec2(0, ry), ivec2(1, NY)), 200 + k);
        float gx = u * float(NX) + off * 7.0 + float(k) * 0.37;
        for (int dx = -uOne; dx <= uOne; dx++) {
          ivec2 c = wrapI(ivec2(int(floor(gx)) + dx, ry), ivec2(NX, NY));
          float h1 = hs(c, 210 + k), h2 = hs(c, 220 + k), h3 = hs(c, 230 + k), h4 = hs(c, 240 + k);
          float L = 0.8 + 1.1 * h2;                              // 長さ（段の高さ単位、約2〜6cm）
          vec2 root = vec2(floor(gx) + float(dx) + 0.15 + 0.7 * h1, float(ry) + 1.0);
          vec2 p = vec2(gx, gy) - root;                          // 根もとは上、先は下（斜面の下向き）
          float t = -p.y / L;
          if (t < 0.0 || t > 1.0) continue;
          float lean = (h3 - 0.5) * 0.9;
          float d = abs(p.x - lean * (-p.y));
          float wd = 0.22 + 0.12 * h4;
          if (d > wd) continue;
          float prof = sqrt(1.0 - (d / wd) * (d / wd));
          float hh = prof * (0.35 + 0.65 * t) + float(k) * 0.06 + h1 * 0.05;
          if (hh > bestH) {
            vec3 gold = vec3(1.25, 1.0, 0.62), grey = vec3(0.9, 0.86, 0.8);
            vec3 sc = mix(gold, grey, clamp(weather * 1.3 - 0.2 + (bt - 0.5) * 0.7 + (h2 - 0.5) * 0.3, 0.0, 1.0));
            sc *= (0.62 + 0.55 * h4) * (0.6 + 0.4 * t) * (0.8 + 0.2 * prof);
            if (h3 < 0.05) sc *= 0.5;
            if (h3 > 0.96) sc *= vec3(1.25, 1.18, 1.05);
            bestH = hh; bestC = sc;
          }
        }
      }
    }
    if (bestH < 0.0) { bestH = 0.0; bestC = vec3(0.16, 0.12, 0.08); }
    // 束ごとの明暗と、段（葺き足）の下の縁の陰
    float course = smoothstep(0.0, 0.12, fv) * (0.9 + 0.1 * fv);
    vec3 c = bestC * (0.8 + 0.4 * bt2) * mix(0.84, 1.0, course);
    return vec4(c * 0.5, clamp(bestH * 0.72 + (1.0 - fv) * 0.12 + bt * 0.06, 0.0, 1.0));
  }
  if (uLayer == 4) { // 茅の切り口：茎の断面の点々と層（1m）
    float bw = pn(vec2(u * 3.0, v * 2.0), ivec2(3, 2), 61) * 0.18 + pn(vec2(u * 24.0, v * 2.0), ivec2(24, 2), 65) * 0.06;
    float bv = v * 7.0 + bw;
    float bi = floor(bv), bt = bv - bi;
    float btone = hs(wrapI(ivec2(0, int(bi)), ivec2(1, 7)), 62);
    vec4 w = pvor(uv * 110.0, ivec2(110), 60);
    float d = w.x;
    float rim = smoothstep(0.1, 0.18, d) * smoothstep(0.42, 0.3, d);
    float hole = smoothstep(0.14, 0.06, d);
    float cut = hs(wrapI(ivec2(uv * 110.0), ivec2(110)), 63);
    vec3 gold = vec3(1.25, 1.0, 0.62), grey = vec3(0.85, 0.82, 0.78);
    vec3 sc = mix(gold, grey, clamp(btone * 1.3 - 0.2 + pfbm(uv * 3.0, ivec2(3), 64, 3) * 0.4 - 0.2, 0.0, 1.0));
    float seam = smoothstep(0.0, 0.06, bt) * smoothstep(1.0, 0.94, bt);
    vec3 c = sc * (0.6 + 0.8 * btone) * (0.25 + 0.85 * rim * (0.7 + 0.5 * w.z)) * (1.0 - 0.65 * hole) * mix(0.2, 1.0, seam);
    float h = 0.3 + rim * 0.45 * (0.6 + 0.4 * cut) - hole * 0.2 + seam * 0.2;
    return vec4(c * 0.5, h);
  }
  if (uLayer == 5) { // 瓦の肌：8×8枚、焼きむら・重なりの縁・谷の汚れ・地衣（2.4m）
    vec2 g = uv * 8.0; ivec2 ti = ivec2(floor(g)); vec2 f = fract(g);
    float id = hs(wrapI(ti, ivec2(8)), 70), id2 = hs(wrapI(ti, ivec2(8)), 71);
    vec3 tc = mix(vec3(0.94, 0.97, 1.03), vec3(1.04, 1.02, 0.97), id) * (0.9 + 0.18 * id2);
    if (id2 > 0.94) tc *= vec3(1.25, 1.2, 1.12);
    if (id2 < 0.05) tc *= 0.75;
    float bloom = pfbm(uv * 12.0, ivec2(12), 72, 4);
    tc *= 0.92 + 0.22 * bloom;
    float edgeHi = smoothstep(0.0, 0.012, f.y) * smoothstep(0.05, 0.022, f.y);
    float under = smoothstep(0.84, 1.0, f.y);
    float trough = exp(-pow((f.x - 0.5) / 0.13, 2.0));
    float streak = pfbm(vec2(u * 8.0, v * 1.0), ivec2(8, 1), 73, 3);
    float dirt = trough * smoothstep(0.35, 0.75, streak);
    vec4 lw = pvor(uv * 40.0, ivec2(40), 74);
    float lichen = step(0.9, lw.z) * smoothstep(0.35, 0.15, lw.x) * step(0.45, pfbm(uv * 3.0, ivec2(3), 75, 3));
    vec3 c = tc * (1.0 - 0.38 * under) * (1.0 + 0.3 * edgeHi) * (1.0 - dirt * 0.35);
    c = mix(c, vec3(1.6, 1.62, 1.35), lichen * 0.7);
    float h = 0.3 + 0.55 * (1.0 - f.y) + 0.05 * bloom;
    return vec4(c * 0.5, h);
  }
  if (uLayer == 6) { // 石垣：割った野面石（平たい面・欠けた縁・石ごとの色）と、深さの違う目地の土と苔（3m）
    vec2 wp = vec2(pfbm(uv * 4.0, ivec2(4), 81, 3), pfbm(uv * 4.0 + 5.0, ivec2(4), 82, 3)) - 0.5;
    vec4 w = pvor(vec2(u * 6.0, v * 8.0) + wp * 0.6, ivec2(6, 8), 80);
    ivec2 sidI = ivec2(int(w.z * 997.0), 3);
    float sid = w.z, sid2 = hs(sidI, 83), sid3 = hs(sidI, 87);
    // 縁の欠け（細かいノイズで輪郭を崩す）と、場所で太さの変わる目地
    float chip = (pfbm(uv * 40.0, ivec2(40), 88, 3) - 0.5) * 0.09 + (pn(uv * 120.0, ivec2(120), 89) - 0.5) * 0.025;
    float jw = 0.012 + 0.05 * smoothstep(0.3, 0.8, pfbm(uv * 6.0, ivec2(6), 90, 2));
    float e = w.y - w.x + chip;
    float stoneM = smoothstep(jw, jw + 0.025, e);
    // 割れ面：石ごとに少し傾いた平たい面＋縁の丸み（ドームにしない）
    vec2 r = w.x * vec2(cos(w.w), sin(w.w));
    vec2 tilt = vec2(hs(sidI, 91) - 0.5, hs(sidI, 92) - 0.5) * 0.9;
    float shoulder = smoothstep(jw, jw + 0.13, e);
    float bump = pfbm(uv * 18.0, ivec2(18), 93, 3);
    float gr = pfbm(uv * 70.0, ivec2(70), 84, 3);
    float face = 0.5 + dot(r, tilt) * 0.5 + (bump - 0.5) * 0.18 + (gr - 0.5) * 0.06;
    float h = stoneM * (0.25 + 0.35 * shoulder + 0.4 * face);
    // 色：石ごとに明暗±22%・暖色/寒色、ときどき鉄さびの茶と黒い石
    vec3 sc = mix(vec3(0.92, 0.96, 1.04), vec3(1.08, 1.0, 0.88), sid) * (0.78 + 0.44 * sid2);
    if (sid3 > 0.86) sc *= vec3(1.06, 0.9, 0.74);
    if (sid3 < 0.08) sc *= 0.66;
    sc *= 0.86 + 0.28 * gr;
    sc *= 0.9 + 0.2 * bump;
    float lich = smoothstep(0.64, 0.78, pfbm(uv * 9.0, ivec2(9), 85, 4)) * smoothstep(0.2, 0.6, shoulder);
    sc = mix(sc, vec3(1.35, 1.38, 1.22), lich * 0.35);
    // 縁は少し明るい（割れたばかりの角が欠けて白い）→ 丸みの陰はシェーダーの法線に任せる
    sc *= 1.0 + 0.06 * (1.0 - shoulder) * stoneM;
    vec3 gapC = mix(vec3(0.26, 0.22, 0.17), vec3(0.2, 0.3, 0.12), smoothstep(0.4, 0.7, pfbm(uv * 8.0, ivec2(8), 86, 3)));
    vec3 c = mix(gapC * 0.55, sc, stoneM);
    return vec4(c * 0.5, h);
  }
  if (uLayer == 7) { // 御影石：白・黒の粒と風化のしみ（1.2m）
    float sp1 = hs(wrapI(ivec2(uv * 256.0), ivec2(256)), 90);
    float sp2 = pn(uv * 140.0, ivec2(140), 91);
    float blot = pfbm(uv * 4.0, ivec2(4), 92, 5);
    float lich = smoothstep(0.66, 0.8, pfbm(uv * 7.0, ivec2(7), 93, 4));
    float m = 1.0 - step(0.9, sp1) * 0.55 + smoothstep(0.6, 0.8, sp2) * 0.18 - (blot - 0.5) * 0.3;
    vec3 c = vec3(m) * mix(vec3(1.0), vec3(1.05, 1.0, 0.94), blot);
    c = mix(c, vec3(0.45, 0.46, 0.42), lich * 0.6);
    return vec4(c * 0.5, 0.5 + (sp2 - 0.5) * 0.3 + (sp1 - 0.5) * 0.1);
  }
  if (uLayer == 8) { // コンクリート：型枠の目地・セパ穴・気泡・雨だれ（3.6m）
    vec2 pg = vec2(u * 2.0, v * 4.0); vec2 pf = fract(pg);
    float seam = max(smoothstep(0.006, 0.0, pf.x), smoothstep(0.004, 0.0, pf.y)) + max(smoothstep(0.994, 1.0, pf.x), smoothstep(0.992, 1.0, pf.y));
    vec2 th = vec2(fract(pf.x * 3.0), pf.y);
    float tie = smoothstep(0.035, 0.02, length((th - vec2(0.5, 0.5)) * vec2(0.6, 0.9 / 4.0 * 4.0) * vec2(1.0, 0.5)));
    vec4 pw = pvor(uv * 90.0, ivec2(90), 95);
    float pore = step(0.93, pw.z) * smoothstep(0.2, 0.08, pw.x);
    float mot = pfbm(uv * 5.0, ivec2(5), 96, 5);
    float drip = smoothstep(0.55, 0.85, pfbm(vec2(u * 40.0, v * 1.0), ivec2(40, 1), 97, 3));
    float sand = hs(ivec2(uv * 512.0), 98);
    float m = (0.86 + 0.28 * mot) * (1.0 - 0.3 * seam) * (1.0 - 0.6 * tie) * (1.0 - 0.5 * pore) * (1.0 - 0.18 * drip) * (0.95 + 0.1 * sand);
    return vec4(vec3(m) * mix(vec3(1.0), vec3(0.98, 0.99, 1.02), mot) * 0.5, 0.5 - seam * 0.2 - tie * 0.4 - pore * 0.4 + (sand - 0.5) * 0.1);
  }
  if (uLayer == 9) { // トタン：r=塗装の明暗 g=錆の量 b=流れ錆の筋（2m）
    float chalk = pfbm(uv * 3.0, ivec2(3), 101, 5);
    float rs = pfbm(uv * 6.0, ivec2(6), 102, 5) * 0.7 + pfbm(uv * 24.0, ivec2(24), 103, 3) * 0.3;
    float rust = smoothstep(0.58, 0.7, rs);
    float runs = smoothstep(0.5, 0.85, pfbm(vec2(u * 36.0, v * 1.0), ivec2(36, 1), 104, 3)) * smoothstep(0.45, 0.65, rs);
    float scr = hs(ivec2(uv * 512.0), 105);
    return vec4(0.8 + 0.4 * chalk + (scr - 0.5) * 0.06, clamp(rust + runs * 0.5, 0.0, 1.0), runs, 0.5 + rust * 0.3 * pfbm(uv * 50.0, ivec2(50), 106, 2));
  }
  if (uLayer == 10) { // 薪の山の切り口：年輪・割れ・樹皮の縁・隙間（1.2m）
    vec4 w = pvor(uv * 9.0, ivec2(9), 110);
    float rr = 0.36 + 0.12 * w.z;
    float d = w.x;
    float inside = smoothstep(rr, rr - 0.02, d);
    float split = step(0.55, hs(ivec2(int(w.z * 1000.0), 1), 111));
    float half_ = step(0.0, cos(w.w - w.z * 12.0));
    inside *= mix(1.0, half_, split);
    float rings = 0.5 + 0.5 * sin(d / rr * 6.2831 * (5.0 + 5.0 * w.z) + pn(uv * 40.0, ivec2(40), 112) * 2.0);
    float bark = smoothstep(rr - 0.07, rr - 0.03, d);
    float crack = smoothstep(0.06, 0.0, abs(sin(w.w * 2.0 + w.z * 9.0))) * step(d, rr * 0.8) * step(0.5, w.z);
    vec3 wood = mix(vec3(1.35, 1.1, 0.8), vec3(1.05, 1.0, 0.92), smoothstep(0.3, 0.8, w.z)) * (0.85 + 0.15 * rings) * (1.0 - 0.5 * crack);
    wood = mix(wood, vec3(0.5, 0.36, 0.26), bark);
    wood *= 1.0 - 0.35 * smoothstep(rr * 0.2, 0.0, d);
    vec3 c = mix(vec3(0.08, 0.06, 0.05), wood, inside);
    return vec4(c * 0.5, inside * (0.6 + 0.05 * rings - crack * 0.2));
  }
  if (uLayer == 11) { // 杉皮：縦の繊維の帯（1.5m）
    float s1 = pfbm(vec2(u * 60.0, v * 2.0), ivec2(60, 2), 120, 4);
    float s2 = pfbm(vec2(u * 12.0, v * 1.0), ivec2(12, 1), 121, 3);
    float strip = fract(u * 18.0 + s2 * 2.0);
    float gap = smoothstep(0.0, 0.08, strip) * smoothstep(1.0, 0.9, strip);
    vec3 c = mix(vec3(1.15, 0.86, 0.68), vec3(0.85, 0.83, 0.8), s2) * (0.55 + 0.85 * s1) * mix(0.45, 1.0, gap);
    return vec4(c * 0.5, s1 * 0.7 + gap * 0.3);
  }
  if (uLayer == 12) { // 銅板の緑青：r=緑青の量 g=黒い筋 b=明暗、a=立てはぜ（2m）
    float f = fract(u * 7.0);
    float seamH = smoothstep(0.035, 0.0, abs(f - 0.5));
    float pat = pfbm(uv * 5.0, ivec2(5), 130, 5);
    float st = smoothstep(0.45, 0.8, pfbm(vec2(u * 28.0, v * 1.0), ivec2(28, 1), 131, 4));
    float tone = pfbm(uv * 20.0, ivec2(20), 132, 3);
    return vec4(smoothstep(0.3, 0.6, pat), st, tone, 0.4 + 0.5 * seamH);
  }
  if (uLayer == 13) { // 畳：い草の目と縦糸（0.9m）
    float l = 0.5 + 0.5 * sin(v * 6.2831 * 128.0);
    float warp = smoothstep(0.85, 1.0, fract(u * 30.0));
    float mot = pfbm(uv * 6.0, ivec2(6), 140, 4);
    vec3 c = vec3(0.85 + 0.2 * l) * (0.9 + 0.2 * mot) * (1.0 - 0.25 * warp);
    return vec4(c * 0.5, 0.5 + 0.3 * l - 0.2 * warp);
  }
  // 14 アスファルト：骨材の粒・ひび（2m）
  vec4 w = pvor(uv * 160.0, ivec2(160), 150);
  float st = smoothstep(0.3, 0.2, w.x) * w.z;
  float mot = pfbm(uv * 6.0, ivec2(6), 151, 5);
  vec4 cw = pvor(uv * 5.0, ivec2(5), 152);
  float crack = (1.0 - smoothstep(0.0, 0.015, cw.y - cw.x)) * step(0.6, pfbm(uv * 3.0, ivec2(3), 153, 3));
  float m = (0.8 + 0.5 * st) * (0.88 + 0.24 * mot) * (1.0 - 0.6 * crack);
  return vec4(vec3(m) * 0.5, 0.5 + 0.3 * st - 0.5 * crack);
}
void main() { gl_FragColor = layer(vUv); }
`;
const NL = 15, TS = 512;
function makeBaker(tex) {
  let done = false;
  return (renderer) => {
    if (done) return;
    done = true;
    const rt = tex.rt;
    const mat = new THREE.ShaderMaterial({ vertexShader: BAKE_VS, fragmentShader: BAKE_FS, uniforms: { uLayer: { value: 0 }, uOne: { value: 1 } }, depthTest: false, depthWrite: false });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
    quad.frustumCulled = false;
    const sc = new THREE.Scene(); sc.add(quad);
    const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const prevRT = renderer.getRenderTarget(), prevFace = renderer.getActiveCubeFace(), prevMip = renderer.getActiveMipmapLevel();
    const prevAuto = renderer.autoClear;
    renderer.autoClear = false;
    const gl = renderer.getContext();
    const t0 = performance.now();
    for (let l = 0; l < NL; l++) {
      mat.uniforms.uLayer.value = l;
      renderer.setRenderTarget(rt, l);
      renderer.render(sc, cam);
    }
    gl.finish();
    console.log('bake ms', (performance.now() - t0).toFixed(0));
    renderer.autoClear = prevAuto;
    renderer.setRenderTarget(prevRT, prevFace, prevMip);
    mat.dispose(); quad.geometry.dispose();
    window.__bldBaked = performance.now();
  };
}

// ---- 建物の描画 ----
const BVS = /* glsl */ `
${ALL}
${SHADOW}
attribute vec4 aCol;
attribute float aMat;
attribute vec4 aTan;
attribute vec3 aW;
varying vec3 vWorld;
varying vec3 vN;
varying vec2 vUv;
varying vec4 vCol;
varying float vMat;
varying vec4 vTan;
varying vec3 vW;
void main() {
  vec3 p = position;
#ifdef DEPTH
  p -= normal * aW.z;
#else
  // 瓦の波：遠くでは元の平面へ戻す（細かすぎる凹凸のちらつきを防ぐ）
  float dist = distance(cameraPosition, p);
  p -= normal * aW.z * smoothstep(45.0, 95.0, dist);
#endif
  vec4 wp = modelMatrix * vec4(p, 1.0);
  vWorld = wp.xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  vUv = uv;
  vCol = aCol;
  vMat = aMat;
  vTan = aTan;
  vW = aW;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;
const BFS = /* glsl */ `
${ALL}
${SHADOW}
precision highp sampler2DArray;
uniform sampler2DArray tMat;
uniform float uMatReady;
uniform vec3 uBridgeW;
varying vec3 vWorld;
varying vec3 vN;
varying vec2 vUv;
varying vec4 vCol;
varying float vMat;
varying vec4 vTan;
varying vec3 vW;
const float TP = 0.3, TA = 0.045;
float tileF(float u) { float x = fract(u / TP) - 0.8; return (0.5 + 0.5 * cos(6.2831853 * x) + 0.18 * cos(12.566371 * x) - 0.14) / 1.04; }
float tileDF(float u) { float x = fract(u / TP) - 0.8; return (-3.14159265 * sin(6.2831853 * x) - 2.2619467 * sin(12.566371 * x)) / 1.04 / TP; }
vec3 gN; vec3 gT; vec3 gB;
// 焼いた材質を読み、高さの差で法線を曲げる
vec4 matTex(float L, vec2 tuv, float bump) {
  if (uMatReady < 0.5) return vec4(0.5, 0.5, 0.5, 0.5);
  vec4 t = texture(tMat, vec3(tuv, L));
  if (bump > 0.0) {
    float e = 1.0 / 512.0;
    float hx = texture(tMat, vec3(tuv + vec2(e, 0.0), L)).a;
    float hy = texture(tMat, vec3(tuv + vec2(0.0, e), L)).a;
    vec2 g = vec2(hx - t.a, hy - t.a) * bump;
    gN = normalize(gN - gT * g.x - gB * g.y);
  }
  return t;
}
float D_GGX(float NoH, float a) { float a2 = a * a; float d = NoH * NoH * (a2 - 1.0) + 1.0; return a2 / (PI * d * d + 1e-7); }
void main() {
#ifdef DEPTH
  gl_FragColor = vec4(1.0);
#else
  int m = int(vMat + 0.5);
  vec3 base = vCol.rgb;
  float ao = vCol.a;
  vec3 Ng = normalize(vN);
  if (!gl_FrontFacing) Ng = -Ng;
  gN = Ng;
  vec3 tt = vTan.xyz - Ng * dot(Ng, vTan.xyz);
  gT = dot(tt, tt) > 1e-8 ? normalize(tt) : normalize(cross(Ng, abs(Ng.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
  gB = cross(Ng, gT) * (vTan.w < 0.0 ? -1.0 : 1.0) * (gl_FrontFacing ? 1.0 : -1.0);
  vec2 uv = vUv;
  vec3 wp = vWorld;
  float rough = 0.85, f0 = 0.04, cav = 1.0, sss = 0.0;
  vec3 alb = base;
  vec3 emitBehind = vec3(0.0);
  float glass = 0.0;
  float drip = exp(-vW.x / 1.4);
  float grime = exp(-max(vW.y, 0.0) / 0.4);
  vec4 nz = texture(tNoise, wp.xz * 0.013 + wp.y * 0.007);
  float moss = 0.0;
  if (m == 1) { // 漆喰・土壁
    vec4 t = matTex(0.0, uv / 4.0, 0.22);
    alb = base * t.rgb * 2.0;
    // 白い漆喰（土蔵）は雨だれを軒・庇の下の数本だけに。土壁・古い壁は全体に薄い筋
    float white = smoothstep(0.62, 0.72, base.r);
    float streak = texture(tNoise, vec2(uv.x * 0.9, uv.y * 0.04)).r * 0.7 + texture(tNoise, vec2(uv.x * 3.1, uv.y * 0.11)).r * 0.3;
    float wob = texture(tNoise, vec2(uv.x * 0.2, uv.y * 0.05)).r * 0.08;
    float colm = texture(tNoise, vec2(uv.x * 1.3 + wob, 0.37)).r;
    float rlen = 0.35 + 2.2 * texture(tNoise, vec2(uv.x * 0.45, 0.71)).g;
    float runs = smoothstep(0.47, 0.62, colm) * (1.0 - smoothstep(rlen * 0.3, rlen, vW.x)) * (0.6 + 0.4 * streak);
    float band = exp(-vW.x / 0.3) * (0.5 + 0.5 * streak);
    float rs = runs * 0.9 + band * 0.35 + smoothstep(0.42, 0.72, streak) * mix(0.1, 0.03, white);
    alb *= mix(vec3(1.0), vec3(0.52, 0.5, 0.46), sat(rs) * mix(0.8, 0.65, white));
    float splash = exp(-max(vW.y, 0.0) / 0.7) * (0.7 + 0.6 * texture(tNoise, uv * vec2(0.8, 0.4)).r);
    alb *= mix(vec3(1.0), vec3(0.7, 0.66, 0.58), sat(splash) * 0.8);
    alb *= mix(0.84 + 0.3 * texture(tNoise, uv * 0.07).g, 0.95 + 0.1 * texture(tNoise, uv * 0.09 + 0.4).g, white);
    alb = mix(alb, alb * vec3(0.85, 0.88, 0.75), grime * smoothstep(0.4, 0.7, nz.g) * 0.6);
    rough = 0.92;
  } else if (m == 2) { // 板張り
    vec4 t = matTex(1.0, uv / 2.4, 1.2);
    alb = base * t.rgb * 2.0;
    alb *= mix(1.0, 0.75, grime);
    rough = 0.85; cav = mix(0.6, 1.0, smoothstep(0.1, 0.45, t.a));
  } else if (m == 3) { // 茅：古い灰茶と差し茅の金、軒寄りの雨筋、葺いた段、苔
    vec4 t = matTex(3.0, uv / 1.2, 4.0);
    alb = base * t.rgb * 2.0;
    float age = texture(tNoise, uv * 0.045 + 0.3).g;
    float age2 = texture(tNoise, uv * 0.13).r;
    float fresh = smoothstep(0.5, 0.9, age * 0.8 + age2 * 0.35);
    alb = mix(alb * vec3(0.9, 0.91, 0.93), alb * vec3(1.08, 1.02, 0.88), fresh);
    alb = mix(alb, vec3(dot(alb, vec3(0.33))), 0.2);
    float eaveZ = 1.0 - smoothstep(0.6, 3.2, uv.y);
    float rain = texture(tNoise, vec2(uv.x * 0.8, uv.y * 0.2)).r * 0.65 + texture(tNoise, vec2(uv.x * 2.6, uv.y * 0.6)).r * 0.35;
    alb *= 1.0 - 0.11 * smoothstep(0.45, 0.8, rain) * eaveZ * (1.0 - fresh * 0.6);
    // 段（葺いた束の列）：列の下の縁が張り出して光を受け、その下に細い陰
    float ph = uv.y / 0.62 + texture(tNoise, uv * vec2(0.05, 0.1)).r * 0.45;
    float fr = fract(ph);
    float fwp = fwidth(ph) + 1e-4;
    float edge = smoothstep(0.0, 0.12 + fwp, fr) * (1.0 - smoothstep(0.88 - fwp, 1.0, fr));
    alb *= mix(0.86, 1.0, edge) * (0.95 + 0.1 * (1.0 - fr));
    // 大きなむらと、斜面に沿う粗い筋（引き伸ばしは4倍まで）
    vec2 lq = uv * vec2(0.14, 0.3);
    float e = 0.35;
    float n0 = texture(tNoise, lq).r, nx = texture(tNoise, lq + vec2(e * 0.14, 0.0)).r, ny = texture(tNoise, lq + vec2(0.0, e * 0.3)).r;
    float comb = texture(tNoise, vec2(uv.x * 1.7, uv.y * 0.42)).r;
    float cx = texture(tNoise, vec2((uv.x + 0.05) * 1.7, uv.y * 0.42)).r;
    float stepN = sin(ph * 6.2831853) * 0.09 * (1.0 - smoothstep(0.3, 0.8, fwp * 4.0));
    gN = normalize(gN - gT * ((nx - n0) * 0.1 + (cx - comb) * 0.2) - gB * ((ny - n0) * 0.14 + stepN));
    alb *= 0.9 + 0.2 * comb;
    // 苔：北向き・軒の線・棟寄りの柔らかい塊（全面の斑にしない）
    float mz = texture(tNoise, uv * 0.21).g * 0.75 + texture(tNoise, uv * 0.9).r * 0.3;
    float bias = (Ng.z < 0.0 ? 0.12 : -0.08) + eaveZ * 0.15 + smoothstep(0.75, 0.95, Ng.y) * 0.1;
    moss = smoothstep(0.76, 0.95, mz + bias) * (1.0 - smoothstep(0.3, 0.6, t.a) * 0.35) * (1.0 - fresh);
    alb = mix(alb, vec3(0.085, 0.105, 0.045) * (0.7 + 0.6 * t.a), moss * 0.55);
    cav = mix(0.42, 1.0, smoothstep(0.05, 0.5, t.a)) * mix(0.85, 1.0, edge);
    rough = 0.95; f0 = 0.02; sss = 0.12;
  } else if (m == 15) { // 茅の切り口
    vec4 t = matTex(4.0, uv / 1.0, 3.5);
    alb = base * t.rgb * 2.0;
    alb *= mix(vec3(0.75, 0.74, 0.72), vec3(1.05, 1.0, 0.92), texture(tNoise, uv * vec2(0.08, 0.3)).g);
    cav = mix(0.5, 1.0, smoothstep(0.2, 0.55, t.a));
    rough = 0.95; f0 = 0.02;
  } else if (m == 4 || m == 24) { // 瓦（波は形と解析の法線）・のし瓦
    vec4 t = matTex(5.0, (uv - vec2(m == 4 ? 0.24 : 0.0, 0.0)) / 2.4, m == 4 ? 3.8 : 0.0);
    alb = base * t.rgb * 2.0;
    if (m == 4) {
      float fw = fwidth(uv.x / TP);
      float fade = 1.0 - smoothstep(0.2, 0.55, fw);
      float dh = TA * tileDF(uv.x) * fade;
      gN = normalize(gN - gT * dh);
      float hgt = tileF(uv.x);
      cav = mix(1.0, mix(0.72, 1.0, hgt), fade);
      // 谷の苔と汚れ（軒寄り・北向き）
      moss = (1.0 - hgt) * fade * smoothstep(0.55, 0.8, texture(tNoise, uv * vec2(0.4, 0.08)).g + (Ng.z < 0.0 ? 0.1 : 0.0));
      alb = mix(alb, vec3(0.06, 0.075, 0.035), moss * 0.6);
    } else {
      float l = fract(uv.y / 0.072);
      alb *= 0.7 + 0.3 * smoothstep(0.0, 0.25, l);
      cav = 0.75 + 0.25 * smoothstep(0.0, 0.2, l);
    }
    rough = 0.42; f0 = 0.05;
  } else if (m == 5) { // 障子：紙と組子
    vec2 g = vec2(fract(uv.x / 0.303), fract(uv.y / 0.225));
    vec2 fwg = fwidth(uv / vec2(0.303, 0.225)) + 1e-4;
    float bw = 0.022 / 0.303;
    float bx = 1.0 - smoothstep(bw - fwg.x, bw + fwg.x, min(g.x, 1.0 - g.x) * 2.0);
    float by = 1.0 - smoothstep(bw * 1.35 - fwg.y, bw * 1.35 + fwg.y, min(g.y, 1.0 - g.y) * 2.0);
    float bar = max(bx, by);
    vec3 paper = base * (0.93 + 0.1 * texture(tNoise, uv * 2.0).r);
    alb = mix(paper, vec3(0.3, 0.22, 0.15), bar);
    float lower = 1.0 - step(0.3, uv.y);
    alb = mix(alb, vec3(0.2, 0.14, 0.09), lower);
    sss = (1.0 - bar) * (1.0 - lower) * 0.6;
    rough = 0.9;
  } else if (m == 6) { // 石垣：目地は深い陰（線でなく凹み）、下の目地ほど苔
    vec4 t = matTex(6.0, uv / 3.0, 9.0);
    alb = base * t.rgb * 2.0;
    float jnt = 1.0 - smoothstep(0.03, 0.26, t.a);
    cav = mix(0.3, 1.0, smoothstep(0.02, 0.45, t.a));
    float low = 1.0 - smoothstep(0.2, 1.6, vW.y);
    moss = jnt * (0.35 + 0.6 * low) * smoothstep(0.3, 0.6, nz.g + low * 0.3) + smoothstep(0.6, 0.85, nz.g) * 0.35 * max(Ng.y, 0.0);
    alb = mix(alb, vec3(0.05, 0.075, 0.025) * (0.8 + 0.5 * nz.r), sat(moss) * 0.7);
    alb *= 0.9 + 0.2 * nz.b;
    alb *= mix(1.0, 0.8, grime);
    rough = 0.9;
  } else if (m == 7) { // トタン
    vec4 t = matTex(9.0, uv / 2.0, 0.6);
    vec3 paint = base * t.r;
    vec3 rust = vec3(0.16, 0.075, 0.04) * (0.6 + 0.8 * nz.r);
    paint *= mix(vec3(1.0), vec3(1.1, 1.12, 1.15), 0.4 * texture(tNoise, uv * 0.3).g);
    // 錆は軒先・板の重ね目・流れ錆の筋に寄る（全面の水玉にしない）
    float eav = 1.0 - smoothstep(0.2, 1.8, uv.y);
    float lap = smoothstep(0.9, 1.0, fract(uv.y / 1.82));
    float ramt = sat(t.g * (0.25 + 0.9 * eav + 0.9 * lap) + t.b * 0.35 * (0.5 + eav));
    alb = mix(paint, rust, smoothstep(0.0, 1.0, ramt) * 0.85);
    alb *= 1.0 - 0.25 * t.b;
    rough = mix(0.5, 0.92, ramt); f0 = mix(0.06, 0.03, ramt);
  } else if (m == 8) { // 朱塗り：色あせ・剥げ・根もとの黒ずみ
    vec4 t = matTex(2.0, uv / 1.0, 0.5);
    float fadeUp = smoothstep(1.0, 4.5, vW.y);
    alb = base * mix(vec3(1.0), vec3(1.12, 1.25, 1.3), fadeUp * 0.35) * (0.9 + 0.24 * (t.r * 2.0 - 1.0) + 0.12 * (nz.r - 0.5));
    // 上を向いた面は雨と埃で黒ずむ、塗りの下の木目がうっすら浮く
    alb *= mix(1.0, 0.7, smoothstep(0.5, 0.95, Ng.y)) * (0.94 + 0.12 * smoothstep(0.35, 0.75, t.a));
    gN = normalize(gN - gT * (t.a - 0.5) * 0.08);
    float chip = smoothstep(0.78, 0.86, texture(tNoise, uv * vec2(1.5, 0.5)).r + grime * 0.25);
    alb = mix(alb, vec3(0.16, 0.12, 0.09) * t.rgb * 2.0, chip);
    alb *= mix(1.0, 0.45, grime);
    rough = mix(0.55, 0.85, chip + grime * 0.5);
  } else if (m == 9) { // コンクリート
    vec4 t = matTex(8.0, uv / 3.6, 0.5);
    alb = base * t.rgb * 2.0;
    float streak = texture(tNoise, vec2(uv.x * 1.1, uv.y * 0.05)).r;
    alb *= mix(1.0, 0.7, drip * smoothstep(0.45, 0.75, streak));
    alb *= mix(1.0, 0.68, grime);
    alb = mix(alb, vec3(0.05, 0.07, 0.03), grime * smoothstep(0.5, 0.8, nz.g) * 0.7);
    // 橋脚：水ぎわの黒い帯と、その下の藻の緑（川の水位から）
    float nearB = 1.0 - smoothstep(9.0, 12.0, distance(wp.xz, uBridgeW.xz));
    float wd = wp.y - uBridgeW.y;
    float wet = (1.0 - smoothstep(0.05, 0.55 + 0.25 * nz.r, wd)) * nearB;
    alb = mix(alb, alb * vec3(0.42, 0.46, 0.36), wet);
    alb = mix(alb, vec3(0.05, 0.07, 0.035), (1.0 - smoothstep(-0.3, 0.1, wd)) * nearB * 0.6);
    rough = mix(0.9, 0.6, wet * (1.0 - smoothstep(0.0, 0.2, wd)));
  } else if (m == 10) { // ガラス
    glass = 1.0;
    vec2 pw = texture(tNoise, uv * 0.6).rg - 0.5;
    gN = normalize(gN + (gT * pw.x + gB * pw.y) * 0.03);
    alb = vec3(0.0);
    emitBehind = base;
    rough = 0.06; f0 = 0.045;
  } else if (m == 11) { // 杉皮・薪
    vec4 t = matTex(11.0, uv / 1.5, 2.0);
    alb = base * t.rgb * 2.0;
    cav = mix(0.6, 1.0, t.a);
    rough = 0.95;
  } else if (m == 12) { // 布
    alb = base * (0.9 + 0.2 * texture(tNoise, uv * 8.0).r);
    rough = 1.0; f0 = 0.02; sss = 0.2;
  } else if (m == 13) { // なまこ壁：黒い平瓦と盛り上がった白い目地
    vec2 q = vec2(uv.x + uv.y, uv.x - uv.y) / 0.36;
    vec2 f = fract(q) - 0.5;
    vec2 fwq = fwidth(q) + 1e-4;
    float dx = 0.5 - abs(f.x), dy = 0.5 - abs(f.y);
    float jw = 0.1;
    float jx = 1.0 - smoothstep(jw - fwq.x, jw + fwq.x, dx), jy = 1.0 - smoothstep(jw - fwq.y, jw + fwq.y, dy);
    float joint = max(jx, jy);
    vec4 t = matTex(0.0, uv / 4.0, 0.0);
    float tid = fract(sin(dot(floor(q), vec2(12.9898, 78.233))) * 43758.5453);
    vec3 tileC = base * (0.8 + 0.4 * tid) * (0.9 + 0.2 * t.r);
    alb = mix(tileC, vec3(0.66, 0.64, 0.6) * t.rgb * 2.0, joint);
    float jb = max(1.0 - smoothstep(0.0, 2.5 * fwq.x + 0.02, abs(dx - jw)), 1.0 - smoothstep(0.0, 2.5 * fwq.y + 0.02, abs(dy - jw)));
    cav = 1.0 - 0.45 * jb;
    // 目地の丸い盛り上がり
    float sx = jx > jy ? sign(f.x) : 0.0, sy = jy >= jx ? sign(f.y) : 0.0;
    vec2 gq = vec2(sx * (1.0 - dx / jw), sy * (1.0 - dy / jw)) * joint * 0.9;
    vec2 gu = vec2(gq.x + gq.y, gq.x - gq.y);
    gN = normalize(gN + (gT * gu.x + gB * gu.y) * 0.8);
    alb *= mix(1.0, 0.8, grime);
    rough = mix(0.35, 0.9, joint); f0 = mix(0.05, 0.03, joint);
  } else if (m == 14 || m == 28) { // 木（柱・梁）・縁板（板の継ぎ目つき、磨かれて光る）
    vec4 t = matTex(2.0, uv / 1.0, 0.8);
    alb = base * t.rgb * 2.0;
    alb *= mix(1.0, 0.7, grime);
    rough = 0.72;
    if (m == 28) {
      float fl = fract(uv.x / 0.135);
      float fwf = fwidth(uv.x / 0.135) + 1e-4;
      float seam = 1.0 - smoothstep(0.0, 0.04 + fwf, min(fl, 1.0 - fl));
      float bid = fract(sin(floor(uv.x / 0.135) * 91.7) * 4375.5);
      alb *= (0.85 + 0.3 * bid) * (1.0 - 0.6 * seam);
      rough = 0.32 + 0.2 * texture(tNoise, uv * 1.3).r; f0 = 0.045;
      cav = 1.0 - 0.5 * seam;
    }
  } else if (m == 16) { // 御影石
    vec4 t = matTex(7.0, uv / 1.2, 0.9);
    alb = base * t.rgb * 2.0;
    moss = smoothstep(0.45, 0.8, nz.g + grime * 0.5) * (0.35 + 0.65 * max(Ng.y, 0.0)) * smoothstep(0.1, 0.9, grime + max(Ng.y, 0.0) * 0.4);
    alb = mix(alb, vec3(0.07, 0.09, 0.035), moss * 0.55);
    // 風化：大きな灰黒のむらと上向きの面の黒ずみ（雨の当たる所）
    alb *= 0.78 + 0.32 * nz.r;
    alb *= mix(1.0, 0.82, smoothstep(0.5, 0.9, max(Ng.y, 0.0)) * smoothstep(0.35, 0.6, nz.b));
    alb *= mix(1.0, 0.8, grime);
    rough = 0.78;
  } else if (m == 17) { // 薪の切り口
    vec4 t = matTex(10.0, uv / 1.2, 7.0);
    alb = base * t.rgb * 2.0;
    cav = mix(0.3, 1.0, smoothstep(0.02, 0.5, t.a));
    rough = 0.95;
  } else if (m == 18) { // 銅板（緑青）
    vec4 t = matTex(12.0, uv / 2.0, 1.5);
    // 古い社の屋根：ほぼ全面が粉をふいた淡い緑青、地の銅は縁と筋にだけ。艶はほとんどない
    float cov = sat(t.r * 0.7 + 0.45);
    vec3 pat = vec3(0.19, 0.33, 0.28) * (0.9 + 0.2 * nz.g), cu = vec3(0.13, 0.075, 0.045);
    alb = mix(cu, pat, cov) * (0.82 + 0.3 * t.b) * (1.0 - 0.5 * t.g);
    alb = mix(alb, alb * vec3(0.72, 0.74, 0.7), grime * 0.6);
    rough = mix(0.5, 0.88, cov); f0 = mix(0.18, 0.035, cov);
    cav = mix(0.8, 1.0, t.a);
    if (!gl_FrontFacing) { // 裏から見える所は野地板（古い木）
      vec4 tw = matTex(1.0, uv / 2.4, 0.6);
      alb = vec3(0.13, 0.1, 0.075) * tw.rgb * 2.0; rough = 0.9; f0 = 0.03; cav = 0.8; ao *= 0.6;
    }
  } else if (m == 19) { // 畳
    vec4 t = matTex(13.0, uv / 0.9, 0.7);
    alb = base * t.rgb * 2.0;
    rough = 0.75;
  } else if (m == 20) { // 金属（樋・腕金・サッシ）
    alb = base * (0.85 + 0.3 * texture(tNoise, uv * 1.7).r);
    rough = 0.45; f0 = 0.12;
    alb *= mix(1.0, 0.7, grime);
  } else if (m == 21) { // 碍子（白い磁器）
    rough = 0.14; f0 = 0.05;
  } else if (m == 22) { // アスファルト
    vec4 t = matTex(14.0, uv / 2.0, 0.8);
    alb = base * t.rgb * 2.0;
    rough = 0.88;
  } else if (m == 23) { // 奥の暗がり
    alb = base; ao *= 0.6; rough = 1.0;
  } else if (m == 25) { // しめ縄
    float tw = fract(uv.x / 0.1 + uv.y * 2.2);
    vec4 t = matTex(3.0, vec2(uv.x * 0.6, uv.y * 0.6 + tw * 0.2), 2.0);
    alb = base * t.rgb * 2.0 * (0.6 + 0.4 * smoothstep(0.0, 0.3, tw) * smoothstep(1.0, 0.7, tw));
    rough = 0.95;
  } else if (m == 26) { // 紙垂（和紙：少し生成り、繊維のむら）
    alb = base * 0.66 * (0.94 + 0.08 * texture(tNoise, uv * 1.7 + wp.xz).r); sss = 0.2; rough = 0.9;
  } else if (m == 27) { // 竹
    float nd = fract(uv.y / 0.38);
    float node = smoothstep(0.03, 0.0, abs(nd - 0.5) - 0.005);
    vec4 t = matTex(2.0, uv * vec2(3.0, 0.5), 0.2);
    alb = base * (0.8 + 0.4 * (t.r * 2.0 - 0.5)) * (1.0 - 0.35 * node) * (0.8 + 0.4 * texture(tNoise, uv * vec2(0.3, 0.05)).g);
    rough = 0.45; f0 = 0.045;
  } else if (m == 29) { // 格子（透かし）
    float f = fract(uv.x / 0.06);
    float bar = smoothstep(0.35, 0.3, abs(f - 0.5));
    alb = mix(vec3(0.012), vec3(0.14, 0.1, 0.07), bar);
    ao *= mix(0.5, 1.0, bar);
    rough = 0.8;
  } else if (m == 30) { // 襖：鳥の子紙に淡い雲の柄
    float cloud = smoothstep(0.55, 0.62, texture(tNoise, uv * 0.35).g);
    alb = base * (0.95 + 0.08 * texture(tNoise, uv * 3.0).r) * mix(1.0, 1.1, cloud);
    rough = 0.85;
  }
  vec3 N = gN;
  vec3 L = uSunDir;
  vec3 V = normalize(cameraPosition - wp);
  float NoLg = dot(Ng, L);
  float nl = max(dot(N, L), 0.0) * sat(NoLg * 6.0 + 0.3);
  float sh = sunShadow(wp + Ng * 0.03, max(NoLg, 0.0), gl_FragCoord.xy) * cloudShadow(wp);
  // 庭や田んぼからの照り返し（軒下が青くなりすぎない）
  vec3 bounce = vec3(0.34, 0.3, 0.22) * (0.35 + 0.65 * sat(-N.y * 0.5 + 0.5)) * 0.32;
  // 奥まった所（座敷・軒の奥・暗い間口）は空の青より畳や板の照り返しの暖かい光
  float inr = sat((0.42 - ao) * 4.0);
  vec3 skyI = shIrr(N);
  vec3 warmB = vec3(dot(shIrr(vec3(0.0, 1.0, 0.0)), vec3(0.3333))) * vec3(1.3, 0.88, 0.5) * 0.5;
  vec3 amb = (mix(skyI, skyI * 0.4 + warmB, inr) + bounce) * ao * cav;
  vec3 col = alb * (uSunCol * nl * sh * mix(0.55, 1.0, cav) + amb);
  // 透ける紙・茅（逆光）
  if (sss > 0.0) col += alb * uSunCol * sh * sss * sat(-dot(Ng, L)) * 0.6 + alb * shIrr(-Ng) * sss * 0.25;
  // 鏡面（GGX）＋空の映り込み
  vec3 H = normalize(L + V);
  float NoV = max(dot(N, V), 1e-3), NoH = max(dot(N, H), 0.0), VoH = max(dot(V, H), 0.0), NoL = max(dot(N, L), 0.0);
  float a = max(rough * rough, 0.002);
  float kk = a * 0.5;
  float Fs = f0 + (1.0 - f0) * pow(1.0 - VoH, 5.0);
  float spec = D_GGX(NoH, a) * Fs * 0.25 / ((NoL * (1.0 - kk) + kk) * (NoV * (1.0 - kk) + kk));
  col += uSunCol * PI * spec * nl * sh * cav;
  vec3 R = reflect(-V, N);
  float Fe = f0 + (1.0 - f0) * pow(1.0 - NoV, 5.0) * (1.0 - rough) * (1.0 - rough);
  vec3 env = shIrr(R) * (1.0 + 0.6 * sat(R.y)) + vec3(0.12, 0.11, 0.09) * sat(-R.y);
  col += env * Fe * ao * (1.0 - rough * 0.6);
  if (glass > 0.5) {
    // 映り込み：空（地平のかすみ→天頂）と地面・木々。軒の下は空が隠れる
    vec3 Rg = reflect(-V, N);
    vec3 sky = mix(uFogCol * 1.05 + uFogSun * 0.15, shIrr(vec3(0.0, 1.0, 0.0)) * 1.25, sqrt(sat(Rg.y)));
    vec3 gnd = mix(vec3(0.07, 0.085, 0.05), vec3(0.12, 0.13, 0.1), texture(tNoise, uv * 0.2).r);
    vec3 envS = mix(gnd, sky * mix(0.35, 1.0, ao), smoothstep(-0.03, 0.06, Rg.y + (texture(tNoise, vec2(uv.x * 0.05, 0.3)).r - 0.5) * 0.08));
    // 深い軒の下：上向きの映り込みは空でなく軒裏（照り返しに照らされた暗い木）
    float eaveOcc = smoothstep(0.2, 0.42, Rg.y) * (vW.x < 6.0 ? 0.9 : 0.0);
    envS = mix(envS, shIrr(vec3(0.0, -1.0, 0.0)) * vec3(0.3, 0.23, 0.17), eaveOcc);
    // ガラスの奥（障子なら組子の影も）
    vec3 behind = emitBehind * (shIrr(Ng) * 0.95 + uSunCol * 0.05 * sh) * ao;
    if (emitBehind.r > 0.3) {
      vec2 g = vec2(fract(uv.x / 0.303 + 0.13), fract(uv.y / 0.225 + 0.4));
      float bar = max(1.0 - smoothstep(0.03, 0.07, min(g.x, 1.0 - g.x)), 1.0 - smoothstep(0.03, 0.08, min(g.y, 1.0 - g.y)));
      behind *= 1.0 - 0.55 * bar;
    }
    float Fg = 0.04 + 0.96 * pow(1.0 - NoV, 5.0);
    col = mix(behind, envS, sat(Fg + 0.06)) + uSunCol * PI * spec * nl * sh;
  }
  gl_FragColor = vec4(col, 1.0);
#endif
}
`;

const DEPTH_FS = /* glsl */ `
void main() { gl_FragColor = vec4(1.0); }
`;

export function buildBuildings(shared, world, groundAt) {
  const B = new MB(groundAt);
  const r = mulberry32(99);
  const byId = {};
  const chunks = [];
  for (const h of HOUSES) byId[h.id] = h;
  for (const h of HOUSES) {
    // 家ごとの色の揺らぎ（明るさと色み）
    const tv = 0.9 + r() * 0.18, hue = (r() - 0.5) * 0.06;
    B.tint = [tv * (1 + hue), tv, tv * (1 - hue)];
    B.setFrame(h.x, h.y, h.z, h.rot);
    if (h.type === 'kaya') h.info = kayaHouse(B, h, r);
    else h.info = kawaraHouse(B, h, r, h.type === 'kawara2');
    B.tint = [1, 1, 1];
    // 沓脱ぎ石と飛び石（始まりの家）
    B.setFrame(h.x, h.y, h.z, h.rot);
    const sr = mulberry32(Math.round(h.x * 3.1 + 5));
    if (h.id === 'h1') {
      B.slab(-0.3, 0.02, h.d / 2 + 0.5, 0.62, 0.34, 0.24, sr, [0.3, 0.29, 0.27], M.GRANITE);
      const st = [[0.2, 1.6], [-0.4, 2.5], [0.3, 3.4], [-0.2, 4.4], [0.5, 5.4], [0.0, 6.5]];
      for (const [u, v] of st) B.slab(u, 0.0, h.d / 2 + 0.6 + v, 0.32 + (u + 1) * 0.04, 0.25, 0.07, sr, [0.22, 0.215, 0.2], M.GRANITE);
    } else {
      B.slab(0.4, 0.02, h.d / 2 + 0.45, 0.5, 0.3, 0.2, sr, [0.3, 0.29, 0.27], M.GRANITE);
    }
    // 庭の石灯籠
    lantern(B, h.w * 0.35, h.d / 2 + 4.5, 0.95 + sr() * 0.2);
    // 付属の建物
    for (const o of OUTBUILDINGS) {
      if (o.of !== h.id) continue;
      const c = Math.cos(h.rot), s = Math.sin(h.rot);
      const x = h.x + o.off[0] * c + o.off[1] * s, z = h.z - o.off[0] * s + o.off[1] * c;
      const tv2 = 0.9 + r() * 0.18;
      B.tint = [tv2, tv2, tv2];
      B.setFrame(x, h.y, z, h.rot + o.rot);
      if (o.type === 'barn') barn(B, o, r); else kura(B, o);
      B.tint = [1, 1, 1];
    }
    // 石垣：敷地の縁で外の地面が下がっているところ
    for (const p of world.plots) {
      if (p.house !== h) continue;
      const hs = p.house;
      B.setFrame(p.cx, 0, p.cz, hs.rot);
      const edges = [[-p.pw / 2, p.pd / 2, p.pw / 2, p.pd / 2], [p.pw / 2, -p.pd / 2, -p.pw / 2, -p.pd / 2], [p.pw / 2, p.pd / 2, p.pw / 2, -p.pd / 2], [-p.pw / 2, -p.pd / 2, -p.pw / 2, p.pd / 2]];
      for (const [x0, z0, x1, z1] of edges) {
        const len = Math.hypot(x1 - x0, z1 - z0);
        const n = Math.ceil(len / 1.5);
        const nx = (z1 - z0) / len, nz = -(x1 - x0) / len;
        for (let k = 0; k < n; k++) {
          const ta = k / n, tb = (k + 1) / n;
          const ax = x0 + (x1 - x0) * ta, az = z0 + (z1 - z0) * ta, bx = x0 + (x1 - x0) * tb, bz = z0 + (z1 - z0) * tb;
          const wa = B.tp(ax + nx * 1.6, 0, az + nz * 1.6), wb = B.tp(bx + nx * 1.6, 0, bz + nz * 1.6);
          const ga = groundAt(wa[0], wa[2]), gb = groundAt(wb[0], wb[2]);
          const top = p.ph + 0.05;
          if (top - Math.min(ga, gb) >= 0.5) {
            // 下り：敷地の外が低い → 外向きの石垣（天端の笠石つき）
            const bot = Math.min(ga, gb) - 0.3;
            const slant = 0.25;
            B.quad([ax + nx * slant, bot, az + nz * slant], [bx + nx * slant, bot, bz + nz * slant], [bx, top - 0.12, bz], [ax, top - 0.12, az], C.stone, M.STONE, [[ta * len, bot], [tb * len, bot], [tb * len, top], [ta * len, top]], [0.55, 0.55, 0.9, 0.9]);
            B.quad([ax, top - 0.12, az], [bx, top - 0.12, bz], [bx - nx * 0.02, top, bz - nz * 0.02], [ax - nx * 0.02, top, az - nz * 0.02], C.granite, M.GRANITE, [[ta * len, 0], [tb * len, 0], [tb * len, 0.12], [ta * len, 0.12]], [0.85, 0.85, 1, 1]);
            B.quad([ax - nx * 0.02, top, az - nz * 0.02], [bx - nx * 0.02, top, bz - nz * 0.02], [bx - nx * 0.35, top, bz - nz * 0.35], [ax - nx * 0.35, top, az - nz * 0.35], C.granite, M.GRANITE, [[ta * len, 0], [tb * len, 0], [tb * len, 0.33], [ta * len, 0.33]], [1, 1, 1, 1]);
          } else if (Math.min(ga, gb) - top >= 0.7) {
            // 上り：敷地の外が高い → 内向きの石垣（切土の法面を押さえる）
            const hi = Math.max(ga, gb) + 0.2;
            const slant = 0.3;
            B.quad([bx, top - 0.3, bz], [ax, top - 0.3, az], [ax + nx * slant, hi, az + nz * slant], [bx + nx * slant, hi, bz + nz * slant], C.stone, M.STONE, [[tb * len, top], [ta * len, top], [ta * len, hi], [tb * len, hi]], [0.5, 0.5, 0.85, 0.85]);
          }
        }
      }
    }
    chunks.push(B.cut());
  }
  // 鳥居・石段・石灯籠・社
  {
    const sx = SHRINE.x, tz = SHRINE.toriiZ;
    const gy = groundAt(sx, tz);
    B.setFrame(sx, gy, tz, 0);
    // 柱（内へ少し傾く）と亀腹
    for (const x of [-1.9, 1.9]) {
      const lean = -Math.sign(x) * 0.07;
      B.tube([[x, -0.3, 0], [x + lean * 0.5, 2.4, 0], [x + lean, 4.72, 0]], (t) => 0.21 - 0.035 * t, 14, C.vermilion, M.VERMILION);
      B.lathe(x, 0, [[0.29, -0.1], [0.3, 0.2], [0.285, 0.38], [0.24, 0.47], [0.2, 0.5]], 14, [0.035, 0.033, 0.03], M.PLAIN, { ao: undefined });
    }
    // 貫（柱を貫いて外へ出る）と楔
    B.box(0, 3.72, 0, 5.2, 0.26, 0.16, C.vermilion, M.VERMILION, { ao: [0.75, 0.9] });
    for (const x of [-1.84, 1.84]) B.box(x + Math.sign(x) * 0.22, 3.72, 0, 0.1, 0.2, 0.2, C.vermilion, M.VERMILION);
    // 島木と笠木（両端が反り上がる）
    const kas = (y, len, h, dpt, lift, col, mat) => {
      const path = [];
      for (let q = 0; q <= 16; q++) { const x = -len / 2 + (q / 16) * len; path.push([x, y + lift * Math.pow(Math.abs(x) / (len / 2), 2.2), 0]); }
      for (let q = 0; q < 16; q++) B.sbox(path[q], path[q + 1], dpt, h, col, mat, { ao: [0.8, 1], skip: q === 0 || q === 15 ? '' : 'e' });
    };
    kas(4.72, 6.1, 0.3, 0.36, 0.12, C.vermilion, M.VERMILION);
    kas(4.98, 6.9, 0.24, 0.5, 0.26, [0.03, 0.03, 0.03], M.METAL);
    // 額束と額
    B.box(0, 4.22, 0, 0.3, 0.78, 0.14, C.vermilion, M.VERMILION);
    B.box(0, 4.25, 0.1, 0.46, 0.6, 0.05, [0.04, 0.035, 0.03], M.GRAIN);
    B.box(0, 4.25, 0.127, 0.38, 0.5, 0.004, [0.5, 0.38, 0.1], M.METAL);
    // しめ縄と紙垂
    const rope = [];
    for (let q = 0; q <= 20; q++) { const t = q / 20; rope.push([-1.72 + t * 3.44, 3.5 - 0.22 * Math.sin(Math.PI * t), 0.16]); }
    B.tube(rope, (t) => 0.085 - 0.03 * Math.abs(t - 0.5), 10, C.rope, M.ROPE);
    // 紙垂：折り目ごとに向きが変わる細い紙（少しねじれて垂れ、縄の下は陰る）
    const rsd = mulberry32(19);
    for (const x of [-1.1, -0.35, 0.35, 1.1]) {
      const y = 3.5 - 0.22 * Math.sin(Math.PI * (x + 1.72) / 3.44) - 0.07;
      const am = 0.8 + rsd() * 0.35, ln = 0.9 + rsd() * 0.2;
      const zz = [[0, 0], [0.1, -0.11], [0.02, -0.12], [0.115, -0.235], [0.035, -0.245], [0.13, -0.37]].map(([a, b]) => [a * am, b * ln]);
      const hw = 0.04, sw = (rsd() - 0.5) * 0.8;
      const rows = zz.map(([a, b], q) => {
        const zr = 0.2 + (q ? (rsd() - 0.5) * 0.06 : 0) + q * 0.006, tw = sw + (q % 2 ? 1 : -1) * (0.8 + 0.6 * rsd());
        const droop = q * q * 0.002;
        return [[x + a - hw, y + b - droop, zr + tw * hw], [x + a + hw, y + b - droop, zr - tw * hw]];
      });
      for (let q = 0; q < rows.length - 1; q++) {
        const [l0, r0] = rows[q], [l1, r1] = rows[q + 1];
        const a0 = 0.55 + 0.45 * Math.min(1, q / 2), a1 = 0.55 + 0.45 * Math.min(1, (q + 1) / 2);
        B.quad(l0, r0, r1, l1, C.paper, M.PAPER, [[0, 0], [1, 0], [1, 1], [0, 1]], [a0, a0, a1, a1]);
      }
    }
    // 石段：一段ずつの御影石（蹴上げ約17cm）。下半分は斜面なり、上は少しずつ急になって社の前庭の高さへ登りきる
    // 段の天端は「その段の奥の地面」より必ず上（地面が段を突き抜けない）。上の方は築いた土手（野面石の側壁）に載る
    const shz = SHRINE.shrineZ, shy = groundAt(sx, shz);
    const FCZ = 4.6, FCY = 0.1;             // 前庭：社の前 4.6m まで（局所z）、高さは社の地面+0.1
    const s0 = SHRINE.stepsFrom - 0.5, sTop = shz - FCZ, yTop = shy + FCY;
    const gL = (z) => Math.max(groundAt(sx, z), groundAt(sx - 1.45, z), groundAt(sx + 1.45, z)) + 0.04;
    const zA = SHRINE.stepsFrom + 15;         // ここまでは斜面なり（出発点の高さ）
    const extra = (z) => { const t = Math.max(0, z - zA); return t < 3 ? t * t / 6 : t - 1.5; };
    const kx = (yTop - gL(sTop)) / Math.max(extra(sTop), 1e-3);
    const Hs = (z) => gL(z) + kx * extra(z);
    const H0 = Hs(s0), nSteps = Math.max(8, Math.round((yTop - H0) / 0.17)), rise = (yTop - H0) / nSteps;
    const zOf = (h) => { let lo = s0, hi = sTop; for (let q = 0; q < 40; q++) { const m = (lo + hi) / 2; if (Hs(m) < h) lo = m; else hi = m; } return (lo + hi) / 2; };
    const zs = [s0]; for (let k = 1; k < nSteps; k++) zs.push(zOf(H0 + k * rise)); zs.push(sTop);
    const rs = mulberry32(7);
    const SW = 2.16;
    let prevTop = H0 - rise;
    for (let k = 0; k < nSteps; k++) {
      const zf = zs[k], zb = zs[k + 1];
      const top = H0 + (k + 1) * rise;
      const bot = Math.min(groundAt(sx - 1.1, zf), groundAt(sx + 1.1, zf), prevTop) - 0.35;
      B.setFrame(sx + (rs() - 0.5) * 0.03, 0, (zf + zb) / 2 - 0.005, (rs() - 0.5) * 0.012);
      const tv = 0.8 + rs() * 0.26, hue = (rs() - 0.5) * 0.04;
      // 踏み石（鼻先は少し前へ張り出して下の段に重なり、奥は次の段の下へもぐる）
      // 見える石（蹴上げの下ほど陰る）と、その下に埋まる胴
      const sc = [0.25 * tv * (1 + hue), 0.245 * tv, 0.232 * tv * (1 - hue)], dep = zb - zf + 0.05;
      B.box(0, top - 0.11, 0, SW, 0.22, dep, sc, M.GRANITE, { ao: [0.5, 1] });
      if (top - 0.22 > bot) B.box(0, (top - 0.22 + bot) / 2, 0.01, SW - 0.01, top - 0.22 - bot, dep - 0.02, sc, M.GRANITE, { ao: [0.3, 0.5], skip: 't' });
      prevTop = top;
    }
    // 両脇の耳石（段の勾配なりの長い角石）と、その下の野面石の側壁（土手が高くなる上の方で見える）
    B.setFrame(sx, 0, 0, 0);
    const nose = (z) => Hs(z) + rise;
    for (let k = 0; k < nSteps; k += 4) {
      const za = zs[k] - 0.03, zb = zs[Math.min(nSteps, k + 4)];
      const ya = nose(Math.max(za, s0)) + 0.1, yb = nose(zb) + 0.1;
      const tv = 0.85 + rs() * 0.2;
      for (const sgn of [-1, 1]) {
        B.sbox([sgn * 1.25, ya - 0.14, za], [sgn * 1.25, yb - 0.14, zb], 0.3, 0.32, [0.17 * tv, 0.167 * tv, 0.155 * tv], M.GRANITE, { ao: [0.5, 0.9], skip: k === 0 || k + 4 >= nSteps ? '' : 'e' });
        const xo = sgn * 1.4;
        const ga = groundAt(sx + xo, za) - 0.3, gb = groundAt(sx + xo, zb) - 0.3;
        const ta = ya - 0.3, tb = yb - 0.3;
        if (Math.min(ta - ga, tb - gb) < 0.02) continue;
        const bat = 0.12;
        const q0 = [xo + sgn * bat * (ta - ga) * 0.3, ga, za], q1 = [xo + sgn * bat * (tb - gb) * 0.3, gb, zb], q2 = [xo, tb, zb], q3 = [xo, ta, za];
        const uvw = [[za * 1.5, ga * 1.5], [zb * 1.5, gb * 1.5], [zb * 1.5, tb * 1.5], [za * 1.5, ta * 1.5]];
        if (sgn < 0) B.quad(q0, q1, q2, q3, C.stone, M.STONE, uvw, [0.5, 0.5, 0.85, 0.85]);
        else B.quad(q1, q0, q3, q2, C.stone, M.STONE, [uvw[1], uvw[0], uvw[3], uvw[2]], [0.5, 0.5, 0.85, 0.85]);
      }
    }
    // 参道の石灯籠（下と上に一対ずつ）
    B.setFrame(sx, 0, 0, 0);
    for (const sgn of [-1, 1]) {
      const zl = s0 + 1.2, xl = sgn * 2.4;
      B.setFrame(sx + xl, groundAt(sx + xl, zl), zl, 0);
      lantern(B, 0, 0, 1.15);
    }
    // 社（流造り、銅板の屋根）
    B.setFrame(sx, shy, shz, Math.PI);
    // 局所の地面の高さ（斜面の低い側まで石積みを下ろす）
    const gAt = (x, z) => { const p = B.tp(x, 0, z); return groundAt(p[0], p[2]) - shy; };
    const gMin = (pts) => pts.reduce((m, [x, z]) => Math.min(m, gAt(x, z)), 0);
    const gmin = gMin([[-2.4, -2.1], [2.4, -2.1], [-2.4, 2.1], [2.4, 2.1], [0, 2.1]]);
    const SU = 1.5; // 社の石積みは家の石垣より小さな石
    // 基壇：野面石の石積みと御影石の葛石
    B.box(0, (0.46 + gmin - 0.3) / 2, 0, 4.5, 0.46 - gmin + 0.3, 3.9, C.stone, M.STONE, { ao: [0.45, 0.85], us: SU });
    B.box(0, 0.53, 0, 4.66, 0.14, 4.06, [0.23, 0.225, 0.21], M.GRANITE, { ao: [0.7, 0.95] });
    B.box(0, 0.75, -0.2, 3.8, 0.3, 3.0, [0.24, 0.235, 0.22], M.GRANITE, { ao: [0.6, 0.95] });
    // 前庭：石段を登りきった平らな所（玉砂利・石畳・縁の葛石）。斜面の低い側は同じ石積みで地面まで下ろす
    {
      const z0 = 1.95, z1 = FCZ, hw = 2.33;
      const fmin = gMin([[-hw, z1], [hw, z1], [0, z1], [-hw, z0], [hw, z0]]);
      B.box(0, (FCY - 0.08 + fmin - 0.3) / 2, (z0 + z1) / 2, 2 * hw, FCY - 0.08 - fmin + 0.3, z1 - z0, C.stone, M.STONE, { ao: [0.45, 0.85], us: SU, skip: 't' });
      B.box(0, FCY - 0.05, (z0 + z1) / 2, 2 * hw - 0.3, 0.06, z1 - z0 - 0.15, [0.19, 0.182, 0.165], M.ASPHALT, { ao: [0.85, 0.9], skip: 'b', us: 1.6 });
      // 石畳（石段の上から社の石段まで）
      const rp = mulberry32(31);
      for (let z = z1 - 0.2; z > 2.7; z -= 0.42) {
        const t2 = 0.85 + rp() * 0.25;
        B.box((rp() - 0.5) * 0.04, FCY - 0.005, z, 1.3 + (rp() - 0.5) * 0.08, 0.05, 0.38, [0.24 * t2, 0.235 * t2, 0.22 * t2], M.GRANITE, { ao: [0.7, 1], skip: 'b' });
      }
      // 縁の葛石（石段の口は開ける）
      const cap = (cx, cz, lx, lz) => B.box(cx, FCY + 0.02, cz, lx, 0.16, lz, [0.22, 0.215, 0.2], M.GRANITE, { ao: [0.6, 0.95] });
      for (const sgn of [-1, 1]) {
        cap(sgn * (hw - 0.08), (z0 + z1) / 2 + 0.04, 0.3, z1 - z0 + 0.08);
        cap(sgn * (hw + 1.2) / 2, z1 - 0.08, hw - 1.16, 0.3);
      }
      B.box(0, FCY - 0.04, z1 - 0.1, 2.3, 0.08, 0.26, [0.23, 0.225, 0.21], M.GRANITE, { ao: [0.7, 1] });
    }
    // 社の前の石段：前庭から葛石へ
    {
      const nq = Math.ceil((0.6 - FCY) / 0.18), rq = (0.6 - FCY) / nq;
      for (let q = 0; q < nq - 1; q++) {
        const tq = FCY + (nq - 1 - q) * rq, zq = 2.03 + q * 0.3 + 0.15;
        B.box(0, (tq + FCY - 0.1) / 2, zq, 1.6, tq - FCY + 0.1, 0.34, [0.235, 0.23, 0.215], M.GRANITE, { ao: [0.5, 1] });
      }
    }
    const by = 0.9;
    // 縁と高欄
    B.box(0, by + 0.05, -0.2, 3.3, 0.08, 2.7, [0.22, 0.17, 0.13], M.FLOOR, { ao: [0.5, 0.8] });
    for (const [x, z] of [[-1.6, -1.5], [1.6, -1.5], [-1.6, 1.1], [1.6, 1.1]]) B.box(x, by + 0.35, z, 0.06, 0.55, 0.06, C.woodG, M.GRAIN);
    B.box(0, by + 0.6, -1.5, 3.2, 0.05, 0.05, C.woodG, M.GRAIN);
    for (const x of [-1.6, 1.6]) B.box(x, by + 0.6, -0.2, 0.05, 0.05, 2.6, C.woodG, M.GRAIN);
    // 身舎：板壁と格子戸
    const wy = by + 0.1;
    B.box(0, wy + 0.95, -0.4, 2.4, 1.9, 1.8, [0.24, 0.19, 0.15], M.BOARD, { ao: [0.7, 0.6] });
    for (const [x, z] of [[-1.2, -1.3], [1.2, -1.3], [-1.2, 0.5], [1.2, 0.5]]) B.box(x, wy + 0.95, z, 0.14, 1.9, 0.14, C.woodG, M.GRAIN, { ao: [0.6, 0.6] });
    B.box(0, wy + 0.85, 0.52, 1.8, 1.5, 0.04, [0.05, 0.04, 0.03], M.KOSHI, { ao: [0.6, 0.6] });
    B.box(0, wy + 1.7, 0.52, 2.3, 0.12, 0.08, C.woodG, M.GRAIN);
    // 木階
    // 木階：縁から葛石（0.6）へ3段
    for (let q = 0; q < 2; q++) {
      B.box(0, 0.965 - (q + 1) * 0.13, 1.27 + q * 0.23, 1.3, 0.05, 0.24, [0.22, 0.17, 0.13], M.FLOOR, { ao: [0.6, 0.85] });
      B.box(0, 0.99 - (q + 1) * 0.13 - 0.065, 1.16 + q * 0.23 + 0.2, 1.28, 0.13, 0.025, [0.16, 0.12, 0.09], M.GRAIN, { ao: [0.45, 0.7] });
    }
    for (const sgn of [-1, 1]) B.sbox([sgn * 0.68, by + 0.02, 1.12], [sgn * 0.68, 0.66, 1.78], 0.06, 0.14, C.woodG, M.GRAIN);
    // 向拝の柱：前庭の礎石に立つ
    for (const sgn of [-1, 1]) {
      B.cyl(sgn * 1.25, 2.1, FCY - 0.06, FCY + 0.16, 0.2, 0.16, 10, [0.23, 0.225, 0.21], M.GRANITE, [0.6, 0.95], 't');
      B.box(sgn * 1.25, (FCY + 0.16 + 3.1) / 2, 2.1, 0.13, 3.1 - FCY - 0.16, 0.13, C.woodG, M.GRAIN, { ao: [0.55, 0.7] });
    }
    B.box(0, 3.0, 2.1, 2.8, 0.18, 0.16, C.woodG, M.GRAIN);
    // 屋根：前へ長く流れる（銅板・緑青）
    B.sub(0, 0, -0.35, 0, () => {
      const a = 2.1, y1 = 4.35;
      const face = (D, k, sgn, sag) => {
        B.sub(0, 0, 0, sgn > 0 ? 0 : Math.PI, () => {
          roofFace(B, { L: a, D, tmax: D, X: () => a, k, y0: y1 - D * k, sag, sagN: D, mat: M.COPPER, col: C.copper, edgeH: 0.14 });
        });
      };
      face(2.9, 0.42, 1, 0.22);
      face(1.7, 0.72, -1, 0.08);
      B.box(0, y1 + 0.08, 0, 2 * a + 0.1, 0.2, 0.3, C.copper, M.COPPER, { ao: [0.7, 1] });
      // 千木・鰹木の代わりの箱棟の飾り
      for (const x of [-1.2, 0, 1.2]) B.tube([[x, y1 + 0.28, -0.25], [x, y1 + 0.28, 0.25]], 0.09, 8, [0.3, 0.24, 0.16], M.GRAIN);
      // 破風
      for (const sx2 of [-1, 1]) {
        for (const [D, k, sgn, sag] of [[2.9, 0.42, 1, 0.22], [1.7, 0.72, -1, 0.08]]) {
          const yA = (t) => y1 - D * k + t * k - sag * Math.sin(Math.PI * t / D);
          for (let q = 0; q < 6; q++) {
            const ta = (q / 6) * D, tb = ((q + 1) / 6) * D;
            B.sbox([sx2 * (a + 0.02), yA(ta) - 0.12, sgn * (D - ta)], [sx2 * (a + 0.02), yA(tb) - 0.12, sgn * (D - tb)], 0.05, 0.26, C.woodG, M.GRAIN, { ao: [0.6, 0.8] });
          }
        }
        // 妻壁：屋根の反りに沿う縦の帯
        const roofY = (z) => (z >= 0 ? y1 - 2.9 * 0.42 + (2.9 - z) * 0.42 - 0.22 * Math.sin(Math.PI * (2.9 - z) / 2.9) : y1 - 1.7 * 0.72 + (1.7 + z) * 0.72 - 0.08 * Math.sin(Math.PI * (1.7 + z) / 1.7));
        const zs = [];
        for (let q = 0; q <= 8; q++) zs.push(lerp(-0.95, 0.85, q / 8));
        zs.push(0); zs.sort((p, q) => p - q);
        for (let q = 0; q < zs.length - 1; q++) {
          const za = zs[q], zb2 = zs[q + 1];
          if (zb2 - za < 1e-4) continue;
          const yb = wy + 1.9, ya = roofY(za) - 0.12, ybb = roofY(zb2) - 0.12;
          B.quad([sx2 * 1.2, yb, za], [sx2 * 1.2, yb, zb2], [sx2 * 1.2, ybb, zb2], [sx2 * 1.2, ya, za], [0.24, 0.19, 0.15], M.BOARD, [[za, yb], [zb2, yb], [zb2, ybb], [za, ya]], [0.6, 0.6, 0.4, 0.4]);
        }
      }
    });
    // 賽銭箱と鈴緒
    // 賽銭箱：前庭の石畳の上、社の石段の前（脚つき、上は斜めの桟）
    const sy0 = FCY + 0.02, oz = 3.05;
    for (const [x, z] of [[-0.44, oz - 0.2], [0.44, oz - 0.2], [-0.44, oz + 0.2], [0.44, oz + 0.2]]) B.box(x, sy0 + 0.06, z, 0.08, 0.12, 0.08, [0.16, 0.12, 0.08], M.GRAIN);
    B.box(0, sy0 + 0.42, oz, 1.0, 0.6, 0.52, [0.2, 0.15, 0.1], M.GRAIN, { ao: [0.5, 0.9] });
    for (let q = 0; q < 7; q++) B.box(-0.42 + q * 0.14, sy0 + 0.75, oz, 0.05, 0.06, 0.48, [0.24, 0.18, 0.12], M.GRAIN);
    // 上の石灯籠（前庭の両脇）
    for (const sgn of [-1, 1]) B.sub(sgn * 1.65, FCY - 0.02, 3.95, 0, () => lantern(B, 0, 0, 1.0));
    B.setFrame(sx, shy, shz, Math.PI);
    B.tube([[0, 3.0, 2.25], [0.02, 2.2, 2.3], [0.0, 1.2, 2.35]], 0.035, 8, [0.5, 0.08, 0.08], M.ROPE);
    B.lathe(0, 2.25, [[0.0, 2.95], [0.08, 2.98], [0.13, 3.06], [0.12, 3.14], [0.05, 3.2], [0.0, 3.21]], 10, [0.5, 0.38, 0.12], M.METAL);
  }
  chunks.push(B.cut());
  // 橋（コンクリートの桁橋）：床版・地覆・高欄・親柱・桁・橋脚・橋台
  {
    const bx = BRIDGE.x, bz = BRIDGE.z;
    const deck = world.bridgeDeck;
    B.setFrame(bx, deck, bz, 0);
    const Lb = 15, Wb = 4.4;
    B.box(0, -0.02, 0, Wb - 0.5, 0.04, Lb, C.asphalt, M.ASPHALT, { ao: [0.9, 1], skip: 'b' });
    B.box(0, -0.3, 0, Wb, 0.52, Lb, C.concrete, M.CONCRETE, { ao: [0.55, 0.95] });
    for (const sgn of [-1, 1]) {
      const xx = sgn * (Wb / 2 - 0.14);
      B.box(xx, 0.08, 0, 0.3, 0.2, Lb, C.concrete, M.CONCRETE, { ao: [0.6, 0.95] });
      // 高欄
      const n = 7;
      for (let q = 0; q <= n; q++) {
        const z = -Lb / 2 + 0.6 + (q / n) * (Lb - 1.2);
        B.box(xx, 0.58, z, 0.2, 0.82, 0.2, C.concrete, M.CONCRETE, { ao: [0.7, 1] });
      }
      B.box(xx, 1.02, 0, 0.24, 0.13, Lb - 1.0, C.concrete, M.CONCRETE, { ao: [0.8, 1] });
      B.box(xx, 0.6, 0, 0.12, 0.09, Lb - 1.0, C.concrete, M.CONCRETE, { ao: [0.75, 0.9] });
      // 親柱（橋の名の銘板つき）
      for (const e of [-1, 1]) {
        const z = e * (Lb / 2 - 0.2);
        B.box(xx, 0.65, z, 0.42, 1.2, 0.42, C.concrete, M.CONCRETE, { ao: [0.6, 1] });
        B.box(xx, 1.3, z, 0.48, 0.1, 0.48, C.concrete, M.CONCRETE);
        B.cyl(xx, z, 1.35, 1.52, 0.2, 0.05, 4, C.concrete, M.CONCRETE, [1, 1]);
        B.box(xx - sgn * 0.215, 0.85, z, 0.012, 0.5, 0.26, [0.18, 0.14, 0.08], M.METAL);
      }
    }
    // 桁と橋脚（流れに沿う壁、丸い鼻）・橋台
    for (const x of [-1.3, 0, 1.3]) B.box(x, -0.85, 0, 0.35, 0.6, Lb, C.concrete, M.CONCRETE, { ao: [0.4, 0.6] });
    for (const z of [-3.2, 3.2]) {
      B.box(0, -2.6, z, 3.2, 2.9, 0.7, C.concrete, M.CONCRETE, { ao: [0.45, 0.65] });
      for (const sgn of [-1, 1]) B.cyl(sgn * 1.6, z, -4.05, -1.15, 0.35, 0.35, 10, C.concrete, M.CONCRETE, [0.45, 0.65]);
      B.box(0, -1.08, z, 4.0, 0.26, 1.0, C.concrete, M.CONCRETE, { ao: [0.4, 0.6] });
    }
    for (const e of [-1, 1]) B.box(0, -2.0, e * (Lb / 2 + 0.2), Wb + 0.6, 3.6, 0.6, C.concrete, M.CONCRETE, { ao: [0.45, 0.8] });
  }
  chunks.push(B.cut());
  // 地蔵（小丘への道の脇に三体）
  {
    const jx = KNOLL.x + 22, jz = KNOLL.z - 16;
    const rj = mulberry32(31);
    for (let k = 0; k < 3; k++) {
      const x = jx + k * 0.75, z = jz;
      jizo(B, x, groundAt(x, z) - 0.04, z, 0.3 + (rj() - 0.5) * 0.15, rj);
    }
  }
  chunks.push(B.cut());
  // 電柱：北の道に沿って（コンクリート柱・腕金・碍子・足場ボルト・ときどき変圧器）
  const poles = [];
  const north = world.roads.find((rd) => rd.id === 'north');
  if (north) {
    let acc = 0;
    for (let i = 1; i < north.pts.length; i++) {
      const [x0, z0] = north.pts[i - 1], [x1, z1] = north.pts[i];
      acc += Math.hypot(x1 - x0, z1 - z0);
      if (acc < 38) continue;
      acc = 0;
      const dx = x1 - x0, dz = z1 - z0, l = Math.hypot(dx, dz);
      const px = x1 - dz / l * 3.6, pz = z1 + dx / l * 3.6; // 道の南側（田んぼ側）
      if (Math.abs(px) > 740 || Math.abs(pz) > 740) continue;
      const gy = groundAt(px, pz);
      poles.push({ x: px, y: gy, z: pz, dir: Math.atan2(dz, dx) });
      if (poles.length % 8 === 0) chunks.push(B.cut());
      B.setFrame(px, gy, pz, -Math.atan2(dz, dx));
      B.top = 9.0;
      B.cyl(0, 0, -0.6, 9.0, 0.16, 0.1, 12, C.concrete, M.CONCRETE, [0.8, 1], 't');
      B.top = null;
      // 番号札
      B.box(0.16, 2.0, 0, 0.012, 0.3, 0.14, [0.7, 0.7, 0.65], M.METAL);
      // 足場ボルト
      for (let q = 0; q < 12; q++) {
        const y = 2.7 + q * 0.45, a = (q % 2 ? 1 : -1) * Math.PI / 2;
        const rr = 0.115 - (y / 9) * 0.05;
        B.sbox([Math.cos(a) * rr * 0 + 0, y, Math.sin(a) * rr], [0, y, Math.sin(a) * (rr + 0.18)], 0.025, 0.025, C.metal, M.METAL, { up: [1, 0, 0] });
      }
      // 腕金と碍子（電線は 8.34m）
      B.box(0, 8.08, 0, 0.08, 0.08, 1.9, [0.42, 0.42, 0.4], M.METAL);
      for (const sz of [-1, 1]) B.sbox([0, 7.62, 0], [0, 8.05, sz * 0.6], 0.03, 0.01, [0.42, 0.42, 0.4], M.METAL, { up: [1, 0, 0] });
      for (const zz of [-0.75, 0, 0.75]) {
        B.cyl(0, zz, 8.12, 8.18, 0.012, 0.012, 6, C.metal, M.METAL);
        B.lathe(0, zz, [[0.0, 8.17], [0.055, 8.18], [0.06, 8.2], [0.035, 8.22], [0.05, 8.25], [0.045, 8.27], [0.03, 8.3], [0.025, 8.33], [0.0, 8.345]], 10, C.ceramic, M.CERAMIC);
      }
      // 通信線の支え（6.1m）
      B.box(-0.14, 6.1, 0, 0.1, 0.06, 0.06, [0.3, 0.3, 0.3], M.METAL);
      if (poles.length % 5 === 2) {
        // 変圧器
        B.box(-0.28, 6.9, 0, 0.14, 0.1, 1.0, [0.42, 0.42, 0.4], M.METAL);
        for (const zz of [-0.28, 0.28]) {
          B.cyl(-0.42, zz, 6.2, 7.0, 0.22, 0.22, 12, [0.52, 0.54, 0.54], M.METAL, [0.7, 0.95], 'tb');
          B.cyl(-0.42, zz, 7.0, 7.12, 0.1, 0.06, 8, C.ceramic, M.CERAMIC);
        }
      }
    }
  }
  chunks.push(B.cut());
  // 材質の絵：配列テクスチャの描画先（最初の描画の前に焼く）
  const rt = new THREE.WebGLArrayRenderTarget(TS, TS, NL, { depthBuffer: false, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter, wrapS: THREE.RepeatWrapping, wrapT: THREE.RepeatWrapping });
  rt.texture.wrapS = rt.texture.wrapT = THREE.RepeatWrapping;
  rt.texture.generateMipmaps = true;
  rt.texture.minFilter = THREE.LinearMipmapLinearFilter;
  rt.texture.anisotropy = 8;
  const tex = { rt };
  const uReady = { value: 0 };
  const uniforms = { ...shared, tMat: { value: rt.texture }, uMatReady: uReady, uBridgeW: { value: new THREE.Vector3(BRIDGE.x, riverLevel(BRIDGE.x), BRIDGE.z) } };
  const mat = new THREE.ShaderMaterial({ uniforms, vertexShader: BVS, fragmentShader: BFS, side: THREE.DoubleSide });
  const depthMat = new THREE.ShaderMaterial({ uniforms: { ...shared }, vertexShader: BVS, fragmentShader: DEPTH_FS, defines: { DEPTH: '' }, side: THREE.DoubleSide });
  const bake = makeBaker(tex);
  const onBR = (renderer) => { if (!uReady.value) { bake(renderer); uReady.value = 1; } };
  // 建物ごとの塊に分けて、画面の外は描かない
  const mesh = new THREE.Group();
  for (const g of chunks) {
    if (!g.index || g.index.count === 0) continue;
    const m = new THREE.Mesh(g, mat);
    m.userData.depthMaterial = depthMat;
    m.onBeforeRender = onBR;
    mesh.add(m);
  }
  return { mesh, poles };
}

// 電線：柱の間の垂れた線（細い帯を画面に向ける）
const WIRE_VS = /* glsl */ `
${ALL}
attribute vec3 aDir;
attribute float aSide;
attribute float aR;
varying vec3 vWorld;
varying float vA;
varying float vSide;
void main() {
  vec3 p = position;
  vec3 toCam = normalize(cameraPosition - p);
  vec3 sd = cross(aDir, toCam);
  vec3 side = dot(sd, sd) > 1e-10 ? normalize(sd) : vec3(0.0, 1.0, 0.0);
  float d = distance(cameraPosition, p);
  // 1画素より細くならないように（細すぎる分は薄くする）
  float px = d * 0.0011;
  float w = max(aR, px);
  vA = aR / w;
  vSide = aSide;
  p += side * aSide * w;
  vWorld = p;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}
`;
const WIRE_FS = /* glsl */ `
${ALL}
varying vec3 vWorld;
varying float vA;
varying float vSide;
void main() {
  vec3 V = normalize(cameraPosition - vWorld);
  // 丸い線として陰影：帯の横位置から法線を起こす
  float s = clamp(vSide, -1.0, 1.0);
  vec3 up = vec3(0.0, 1.0, 0.0);
  vec3 N = normalize(up * sqrt(max(1.0 - s * s, 0.0)) * 0.8 + V * 0.6);
  vec3 col = vec3(0.028) * (shIrr(N) + uSunCol * 0.4 * max(dot(N, uSunDir), 0.0));
  // 陽を受けて光る
  col += uSunCol * pow(sat(dot(reflect(-uSunDir, vec3(0.0, 1.0, 0.0)), V)), 20.0) * 0.35;
  gl_FragColor = vec4(col, sat(vA) * 0.92);
}
`;
export function buildWires(shared, poles) {
  const pos = [], dir = [], side = [], rad = [], idx = [];
  const add = (a, b, R, sagK) => {
    const seg = 18;
    const L = Math.hypot(b[0] - a[0], b[2] - a[2]);
    const sag = sagK * L * L / 8 + 0.25;
    const base = pos.length / 3;
    for (let k = 0; k <= seg; k++) {
      const t = k / seg;
      const x = a[0] + (b[0] - a[0]) * t, z = a[2] + (b[2] - a[2]) * t;
      const y = a[1] + (b[1] - a[1]) * t - sag * 4 * t * (1 - t);
      const d = [b[0] - a[0], b[1] - a[1] + sag * 4 * (2 * t - 1), b[2] - a[2]];
      const l = Math.hypot(...d);
      for (const s of [-1, 1]) { pos.push(x, y, z); dir.push(d[0] / l, d[1] / l, d[2] / l); side.push(s); rad.push(R); }
    }
    for (let k = 0; k < seg; k++) { const i = base + k * 2; idx.push(i, i + 1, i + 2, i + 1, i + 3, i + 2); }
  };
  for (let i = 1; i < poles.length; i++) {
    const p0 = poles[i - 1], p1 = poles[i];
    if (Math.hypot(p1.x - p0.x, p1.z - p0.z) > 60) continue;
    for (const o of [-0.75, 0, 0.75]) {
      const off = (p) => { const c = Math.cos(-p.dir), s = Math.sin(-p.dir); return [p.x + o * s, p.y + 8.34, p.z + o * c]; };
      add(off(p0), off(p1), 0.012, 0.012);
    }
    // 通信線（太い黒のケーブル、6.1m）
    const offT = (p) => { const c = Math.cos(-p.dir), s = Math.sin(-p.dir); return [p.x - 0.19 * c, p.y + 6.08, p.z + 0.19 * s]; };
    add(offT(p0), offT(p1), 0.022, 0.016);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aDir', new THREE.Float32BufferAttribute(dir, 3));
  g.setAttribute('aSide', new THREE.Float32BufferAttribute(side, 1));
  g.setAttribute('aR', new THREE.Float32BufferAttribute(rad, 1));
  g.setIndex(idx);
  const m = new THREE.Mesh(g, new THREE.ShaderMaterial({ uniforms: { ...shared }, vertexShader: WIRE_VS, fragmentShader: WIRE_FS, transparent: false, alphaToCoverage: true, side: THREE.DoubleSide }));
  m.frustumCulled = false;
  return m;
}
