// 鳥（第2弾）：アオサギ・カワセミ・キジ・ハシブトガラス・キジバト・メジロ・シジュウカラ・ヒバリ・ウグイス・ムクドリ・ヒヨドリ
// 形は実物の大きさ（m）で、足の裏が y=0・+z が前。背骨の曲線に沿った一続きの胴・首・頭（継ぎ目なし）、
// たたんだ翼（胴に沿う曲面）、広げた翼（上面と下面の二枚・翼の厚み・初列風切りの指）、一枚ずつの尾羽、脚と指、目とアイリング。
// 動きは頂点シェーダ（羽ばたき：肩と手首の二関節／首：重みつきの回転／尾：上下と開き／脚：歩み・たたむ）。
// 材質は creatures.js の Herd を使い、面の描き方（羽毛の細かいむら・構造色の艶・目の映り込み・翼の透け）だけ差し替える
import * as THREE from 'three';
import { MeshB, Herd } from './creatures_base.js';
import { ALL, SHADOW } from './glsl.js';

// ---- 小道具 ----
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
// 広げた翼の下面の明るさ（上面の色に掛ける。下面は影側で、逆光でも体より明るくならないように）
const UNDER = 0.62;
const sstep = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const mix3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const add = (a, b, s = 1) => [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len3 = (a) => Math.hypot(a[0], a[1], a[2]);
const nrm = (a, fb = [0, 1, 0]) => { const l = len3(a); return l > 1e-12 ? [a[0] / l, a[1] / l, a[2] / l] : fb; };
const hash3 = (x, y, z) => { const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return s - Math.floor(s); };
const cr = (a, b, c, d, t) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t);
// 値ノイズ（まだら・羽の房）
function vnoise3(x, y, z) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const fx = x - ix, fy = y - iy, fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy), uz = fz * fz * (3 - 2 * fz);
  const h = (a, b, c) => hash3(ix + a, iy + b, iz + c);
  const l = (a, b, t) => a + (b - a) * t;
  return l(l(l(h(0, 0, 0), h(1, 0, 0), ux), l(h(0, 1, 0), h(1, 1, 0), ux), uy), l(l(h(0, 0, 1), h(1, 0, 1), ux), l(h(0, 1, 1), h(1, 1, 1), ux), uy), uz);
}
const jit = (c, p, k = 0.05, f = 300) => { const n = 1 + (vnoise3(p[0] * f, p[1] * f, p[2] * f) - 0.5) * 2 * k; return [c[0] * n, c[1] * n, c[2] * n]; };
const F = (v) => { const s = Number(v).toFixed(5); return s.includes('.') ? s : s + '.0'; };
const V3 = (a) => `vec3(${F(a[0])}, ${F(a[1])}, ${F(a[2])})`;

// 材質の番号（aPart.w）：0 羽 1 艶のある羽（構造色） 2 くちばし・爪 3 目 4 肌・脚 5 木。+10 は片面（裏は描かない）
const M = { FEATHER: 0, GLOSS: 1, BILL: 2, EYE: 3, SKIN: 4, WOOD: 5, ONE: 10 };

// ---- 格子の面：pts[i][j] = { p, c, a }。hint(i, j) の向きを表にする ----
function grid(m, pts, hint) {
  const R = pts.length, C = pts[0].length;
  const id = [];
  for (let i = 0; i < R; i++) {
    const row = [];
    for (let j = 0; j < C; j++) {
      const q = pts[i][j];
      const pi = pts[Math.min(R - 1, i + 1)][j].p, pm = pts[Math.max(0, i - 1)][j].p;
      const pj = pts[i][Math.min(C - 1, j + 1)].p, pn = pts[i][Math.max(0, j - 1)].p;
      const h = hint(i, j);
      let n = nrm(cross(sub(pi, pm), sub(pj, pn)), [0, 0, 0]);
      if (n[0] === 0 && n[1] === 0 && n[2] === 0) n = nrm(h);
      else if (dot(n, h) < 0) n = [-n[0], -n[1], -n[2]];
      row.push(m.vert(q.p, n, q.c, q.a));
    }
    id.push(row);
  }
  const P = (k) => [m.P[k * 3], m.P[k * 3 + 1], m.P[k * 3 + 2]];
  for (let i = 0; i < R - 1; i++) for (let j = 0; j < C - 1; j++) {
    const a = id[i][j], b = id[i + 1][j], c = id[i][j + 1], d = id[i + 1][j + 1];
    const g = cross(sub(P(b), P(a)), sub(P(c), P(a)));
    const g2 = cross(sub(P(d), P(b)), sub(P(c), P(b)));
    const s = dot(add(g, g2), hint(i, j));
    if (s >= 0) m.I.push(a, b, c, b, d, c); else m.I.push(a, c, b, b, c, d);
  }
  return id;
}

// ---- 背骨：制御点 [z, y, rx, ry] を Catmull-Rom でつなぐ（x=0 の面の中の曲線。横は常に +x） ----
function spine(ctrl) {
  const n = ctrl.length;
  const C = (k) => ctrl[Math.max(0, Math.min(n - 1, k))];
  const at = (s) => {
    s = Math.max(0, Math.min(n - 1, s));
    const i = Math.min(n - 2, Math.floor(s)), f = s - i;
    const o = [];
    for (let c = 0; c < 4; c++) o.push(cr(C(i - 1)[c], C(i)[c], C(i + 1)[c], C(i + 2)[c], f));
    return { z: o[0], y: o[1], rx: Math.max(o[2], 2e-4), ry: Math.max(o[3], 2e-4) };
  };
  const frame = (s) => {
    const e = 0.02;
    const a = at(s - e), b = at(s + e);
    let tz = b.z - a.z, ty = b.y - a.y;
    const l = Math.hypot(tz, ty) || 1; tz /= l; ty /= l;
    return { T: [0, ty, tz], U: [0, tz, -ty] };
  };
  // th: 0=左横(+x) π/2=上 π=右横 3π/2=下
  const point = (s, th) => {
    const q = at(s), f = frame(s);
    const c = Math.cos(th), sn = Math.sin(th);
    return [q.rx * c, q.y + f.U[1] * sn * q.ry, q.z + f.U[2] * sn * q.ry];
  };
  const normal = (s, th) => {
    const e = 0.03, et = 0.03;
    const ds = sub(point(s + e, th), point(s - e, th)), dt = sub(point(s, th + et), point(s, th - et));
    let nn = nrm(cross(dt, ds), [0, 0, 0]);
    const q = at(s), rad = sub(point(s, th), [0, q.y, q.z]);
    if (nn[0] === 0 && nn[1] === 0 && nn[2] === 0) return nrm(rad);
    if (dot(nn, rad) < 0) nn = [-nn[0], -nn[1], -nn[2]];
    return nn;
  };
  return { n, at, frame, point, normal };
}

// ---- 一羽を組む ----
function buildBird(o) {
  const m = new MeshB();
  const SP = spine(o.spine);
  const nS = SP.n - 1;
  const eyeC = SP.point(o.eye.s, o.eye.th);
  const head0 = o.iHead;
  const ctxBody = (s, th, p) => {
    const e = [Math.abs(p[0]) - eyeC[0], p[1] - eyeC[1], p[2] - eyeC[2]];
    const region = s < o.iNeck ? 'body' : s < o.iHead ? 'neck' : 'head';
    return { s, th, up: Math.sin(th), sd: Math.abs(Math.cos(th)), p, e, region, hs: clamp01((s - head0) / Math.max(1e-3, nS - head0)), bs: clamp01(s / Math.max(1e-3, o.iNeck)) };
  };
  // 胴・首・頭：一続きの筒
  {
    const K = o.k || 5, segs = o.segs || 22;
    const rows = [];
    const NR = nS * K;
    for (let i = 0; i <= NR; i++) {
      const s = i / K;
      const q = SP.at(s);
      const row = [];
      for (let j = 0; j <= segs; j++) {
        const th = (j / segs) * Math.PI * 2;
        let p = SP.point(s, th);
        {
          const c0 = [0, q.y, q.z];
          const fz = 1 / (o.feather * 2.2);
          const k = 1 + (o.fluff ?? 0.03) * (vnoise3(p[0] * fz + 5, p[1] * fz, p[2] * fz) - 0.5) * 2;
          p = add(c0, sub(p, c0), k);
        }
        const cx = ctxBody(s, th, p);
        const cls = o.paint.bodyCls ? o.paint.bodyCls(cx) : M.FEATHER;
        const part = s < o.iNeck - 0.35 ? 0 : s < o.iHead ? 6 : 1;
        let col = jit(o.paint.body(cx), p, o.paint.jit ?? 0.05, 1 / (o.feather * 1.6));
        // たたんだ翼の下の縁のすき間の陰
        if (o.fold) {
          const fw = o.fold, thc = Math.abs(Math.atan2(Math.sin(th), Math.abs(Math.cos(th))));
          const inS = sstep(fw.s1 - 0.2, fw.s1 + 0.4, s) * (1 - sstep(fw.s0 - 0.5, fw.s0 + 0.2, s));
          const below = Math.sin(th) < 0.9 ? Math.exp(-(((Math.asin(Math.max(-1, Math.min(1, Math.sin(th)))) - (fw.thB - 0.12)) / 0.16) ** 2)) : 0;
          void thc;
          col = col.map((v) => v * (1 - 0.35 * inS * below));
        }
        // 腹の下・首の付け根の下の陰
        col = col.map((v) => v * (0.82 + 0.18 * sstep(-0.95, -0.2, Math.sin(th))));
        row.push({ p, c: col, a: [part, s, j / segs, cls], q });
      }
      rows.push(row);
    }
    grid(m, rows, (i, j) => { const r = rows[i][j]; return nrm(sub(r.p, [0, r.q.y, r.q.z])); });
    // 両端をふさぐ
    for (const [i, s0] of [[0, 0], [NR, nS]]) {
      const q = SP.at(s0), f = SP.frame(s0);
      const dir = i === 0 ? [-f.T[0], -f.T[1], -f.T[2]] : f.T;
      const cp = [0, q.y, q.z];
      const cx = ctxBody(s0, Math.PI / 2, cp);
      const c0 = m.vert(add(cp, dir, Math.min(q.rx, q.ry) * 0.25), dir, o.paint.body(cx), [s0 < o.iNeck ? 0 : 1, s0, 0, 0]);
      const base = m.n - (i === 0 ? 1 : 1);
      void base;
      for (let j = 0; j < segs; j++) {
        const pA = rows[i][j].p, pB = rows[i][j + 1].p;
        const a = m.vert(pA, nrm(add(sub(pA, cp), dir, Math.min(q.rx, q.ry))), rows[i][j].c, rows[i][j].a);
        const b = m.vert(pB, nrm(add(sub(pB, cp), dir, Math.min(q.rx, q.ry))), rows[i][j + 1].c, rows[i][j + 1].a);
        m.I.push(c0, a, b);
      }
    }
  }
  // 目（黒目＋虹彩）とアイリング
  for (const sx of [-1, 1]) {
    const e = o.eye;
    const nn = SP.normal(e.s, e.th);
    const pS = [eyeC[0] * sx, eyeC[1], eyeC[2]], nS2 = [nn[0] * sx, nn[1], nn[2]];
    if (e.ring) m.ellipsoid(add(pS, nS2, -e.r * 0.25), [e.r * 0.55, e.r * e.ring.r, e.r * e.ring.r], 10, 7, () => e.ring.col, () => [8, 99, sx, M.FEATHER]);
    const c = add(pS, nS2, -e.r * 0.42);
    m.ellipsoid(c, [e.r * 0.8, e.r, e.r], 10, 8, (v, th, p) => {
      // 表に出ている側（外向き）の中心ほど瞳。縁は虹彩
      const d = dot(nrm(sub(p, c)), nS2);
      return d > (e.pupil ?? 0.9) ? [0.006, 0.005, 0.005] : d > 0.7 ? e.iris : [0.02, 0.018, 0.016];
    }, () => [8, 99, sx, M.EYE]);
  }
  // くちばし（上下のくちばし・口角の線）
  {
    const b = o.bill;
    const q = SP.at(nS), f = SP.frame(nS);
    const ang = b.ang || 0;
    const ca = Math.cos(ang), sa = Math.sin(ang);
    // 前を少し下へ：T と U の面の中で回す
    const dir = nrm([0, f.T[1] * ca - f.U[1] * sa, f.T[2] * ca - f.U[2] * sa]);
    const up = [0, dir[2], -dir[1]];
    const base = add([0, q.y + (b.dy || 0), q.z], dir, -(b.inset ?? 0.3) * q.rx);
    const rings = [];
    const NB = 10;
    for (let i = 0; i <= NB; i++) {
      const u = i / NB;
      const L = b.len * u;
      const drop = (b.droop || 0) * u * u;
      const arc = (b.arc || 0) * Math.sin(Math.PI * Math.min(1, u)) * 0.5;
      const c = add(add(base, dir, L), up, -drop + arc * b.d);
      const w = (b.w / 2) * Math.pow(1 - u * 0.97, b.pw || 0.8);
      const d = (b.d / 2) * Math.pow(1 - u * 0.97, b.pwd || b.pw || 0.8);
      rings.push({ c, rx: Math.max(w, 1e-4), ry: Math.max(d, 1e-4) });
    }
    const segs = 12;
    const pts = rings.map((r, i) => {
      const u = i / NB;
      const row = [];
      for (let j = 0; j <= segs; j++) {
        const th = (j / segs) * Math.PI * 2;
        const cth = Math.cos(th), sth = Math.sin(th);
        const p = [r.rx * cth, r.c[1] + up[1] * sth * r.ry, r.c[2] + up[2] * sth * r.ry];
        const lower = sth < (b.gape ?? -0.1);
        let col = lower ? (b.colL || b.col) : b.col;
        if (b.tip && u > (b.tipAt ?? 0.8)) col = b.tip;
        if (b.base && u < (b.baseAt ?? 0.2)) col = b.base;
        if (Math.abs(sth - (b.gape ?? -0.1)) < 0.12 && u < 0.9) col = mix3(col, [0.01, 0.01, 0.01], 0.6);
        row.push({ p, c: col, a: [10, 99, 0, M.BILL], cc: r.c });
      }
      return row;
    });
    grid(m, pts, (i, j) => nrm(sub(pts[i][j].p, pts[i][j].cc)));
  }
  // たたんだ翼（胴の横に沿う曲面。先は尾の上へ突き出る）
  if (o.fold) {
    const fw = o.fold;
    const RB = 9, RT = fw.tip > 0 ? 5 : 0, CC = 6;
    for (const sx of [-1, 1]) {
      const rows = [];
      for (let i = 0; i <= RB; i++) {
        const a = i / RB;
        const s = lerp(fw.s0, fw.s1, a);
        // 前は細く、なかほどで最も幅広い（木の葉形）
        const wf = lerp(fw.front ?? 0.45, 1, sstep(0, 0.45, a));
        const thM = (fw.thT + fw.thB) / 2, thW = (fw.thT - fw.thB) / 2;
        const row = [];
        for (let j = 0; j <= CC; j++) {
          const b = j / CC;
          const th = thM + (0.5 - b) * 2 * thW * wf;
          let p = SP.point(s, th);
          const nn = SP.normal(s, th);
          const lift = fw.lift * (0.35 + 1.1 * Math.pow(Math.sin(Math.PI * Math.min(1, b * 0.8 + 0.1)), 0.6) * (1 - b * 0.55)) * (0.6 + 0.4 * sstep(0, 0.3, a));
          p = add(p, nn, lift);
          p[0] *= sx;
          row.push({ p, a, b });
        }
        rows.push(row);
      }
      // 尾の上へ：最後の列から後ろへ、先で一点に寄る
      if (RT) {
        const last = rows[RB];
        const f = SP.frame(fw.s1);
        const back = nrm([0, -f.T[1] - (fw.drop || 0), -f.T[2]]);
        const cen = last.reduce((acc, q) => add(acc, q.p, 1 / last.length), [0, 0, 0]);
        for (let i = 1; i <= RT; i++) {
          const k = i / RT;
          const row = [];
          for (let j = 0; j <= CC; j++) {
            const q = last[j];
            const pLine = add(q.p, back, fw.tip * k);
            const cLine = add(cen, back, fw.tip * k);
            const conv = Math.pow(k, fw.conv ?? 1.3) * 0.92;
            const p = mix3(pLine, cLine, conv);
            row.push({ p, a: 1 + k * 0.001, b: q.b, k });
          }
          rows.push(row);
        }
      }
      const R = rows.length;
      const pts = rows.map((row, i) => row.map((q) => {
        const aa = i <= RB ? q.a * 0.78 : 0.78 + (q.k || 0) * 0.22;
        const c = jit(o.paint.fold({ a: aa, b: q.b, i, R, p: q.p }), q.p, 0.04, 1 / (o.feather * 1.3));
        return { p: q.p, c, a: [7, aa, q.b, o.paint.foldCls ? o.paint.foldCls({ a: aa, b: q.b }) : M.FEATHER] };
      }));
      grid(m, pts, (i, j) => nrm([sx, 0.5, 0]));
    }
  }
  // 広げた翼：上面と下面の二枚（前縁で合わさる）。外側は初列風切りの指に分かれる
  if (o.wing) {
    const W = o.wing;
    const NS = W.ns || 26, NC = 5;
    const tAt = (x) => clamp01((Math.abs(x) - W.root[0]) / W.span);
    const leadZ = (t) => W.root[2] + W.lead * sstep(0, W.arm, t) - W.sweep * Math.pow(sstep(W.arm, 1, t), 1.3);
    const chordAt = (t) => {
      let c = W.chord * (1 - (1 - W.taper) * sstep(0.1, 1, t));
      const rr = W.round || 0.2;
      if (t > 1 - rr) c *= Math.sqrt(Math.max(0, 1 - ((t - (1 - rr)) / rr) ** 2));
      return c;
    };
    const tEnd = W.fingers ? W.fingerAt : 1;
    for (const sx of [-1, 1]) {
      for (const top of [true, false]) {
        const layer = (t, c) => {
          const cam = Math.pow(Math.sin(Math.PI * c), 0.6) * (1 - 0.65 * t);
          return top ? W.thick * cam : -W.thick * 0.28 * cam;
        };
        const rows = [];
        for (let i = 0; i <= NS; i++) {
          const t = (i / NS) * tEnd;
          const x = W.root[0] + t * W.span;
          const lz = leadZ(t);
          const ch = chordAt(t);
          const row = [];
          for (let j = 0; j <= NC; j++) {
            const c = j / NC;
            let cc = c;
            // 後縁の風切りのぎざぎざ
            if (j === NC && W.notch) { const hj = hash3(i * 1.37, sx * 2.1, W.nFeath); cc = c * (1 - W.notch * 0.5 * (0.35 + 1.1 * hj) * Math.pow(Math.abs(Math.cos(Math.PI * (t * W.nFeath + 0.35 * (hash3(i, 3.3, sx) - 0.5)))), 4)); }
            const y = W.root[1] + (W.dihed || 0) * t * W.span + layer(t, c);
            const p = [sx * x, y, lz - ch * cc];
            let col = jit(o.paint.wing({ t, c, top, finger: false, p }), p, 0.035, 1 / (o.feather * 1.3));
            if (!top) col = mul(col, UNDER);
            // aPart.z：符号＝上面(+)/下面(-)、大きさ＝0.05＋翼弦の位置（前縁0→後縁1）。面の描き方で雨覆と風切り・後縁の透けに使う
            row.push({ p, c: col, a: [sx > 0 ? 2 : 3, tAt(x), (top ? 1 : -1) * (0.05 + cc), (o.paint.wingCls ? o.paint.wingCls({ t, c, top }) : M.FEATHER) + M.ONE] });
          }
          rows.push(row);
        }
        grid(m, rows, () => (top ? [0, 1, 0] : [0, -1, 0]));
        // 指：初列風切り（外側ほど前、内側ほど後ろへ扇に開く）
        if (W.fingers) {
          const t0 = W.fingerAt;
          const ch0 = chordAt(t0), lz0 = leadZ(t0);
          const x0 = W.root[0] + t0 * W.span;
          for (let k = 0; k < W.fingers; k++) {
            const u = (k + 0.5) / W.fingers;          // 0=前縁側（外側の羽）
            const zc = lz0 - ch0 * (0.12 + 0.76 * u);
            const L = W.span * (1 - t0) * (W.fingerLen || 1) * (1.0 - 0.25 * Math.abs(u - 0.3) * 1.6) + ch0 * 0.25;
            const ang = (W.fingerSpread || 0.5) * (u - 0.2);   // 後ろへの開き
            const dir = [Math.cos(ang), 0, -Math.sin(ang)];
            const wid = ch0 / W.fingers * 1.35;
            const FR = 6, FC2 = 2;
            const rows2 = [];
            for (let i = 0; i <= FR; i++) {
              const v = i / FR;
              const back = -0.08 * W.span * (1 - v);   // 付け根は内側の翼に重ねる
              const cxl = x0 + back * 0.5 + dir[0] * L * v;
              const czl = zc + dir[2] * L * v;
              // 先は丸くすぼまる（先の 40% で細くなる：切れ込み）
              const w = wid * (v < 0.55 ? 1 : 1 - 0.45 * sstep(0.55, 0.8, v)) * Math.sqrt(Math.max(0, 1 - Math.pow(Math.max(0, v - 0.8) / 0.2, 2)));
              const row = [];
              for (let j = 0; j <= FC2; j++) {
                const c = j / FC2;
                const off = (c - 0.5) * w;
                const t = (cxl - W.root[0]) / W.span;
                const y = W.root[1] + (W.dihed || 0) * t * W.span + (top ? 1 : -1) * W.thick * 0.12 * Math.sin(Math.PI * c) * (1 - v) + (top ? 1 : -1) * k * 0.0007 * W.span + (W.fingerLift || 0) * v * v * W.span;
                const p = [sx * (cxl - dir[2] * off * 0.0), y, czl + off * (Math.abs(dir[0]) > 0.3 ? 1 : 0.5)];
                let col = jit(o.paint.wing({ t: Math.min(1, t), c: 0.5 + (u - 0.5) * 0.6, top, finger: true, v, k, p }), p, 0.03, 1 / (o.feather * 1.3));
                if (!top) col = mul(col, UNDER);
                row.push({ p, c: col, a: [sx > 0 ? 2 : 3, tAt(p[0]), (top ? 1 : -1) * (0.05 + 0.55 + 0.35 * v), M.FEATHER + M.ONE] });
              }
              rows2.push(row);
            }
            grid(m, rows2, () => (top ? [0, 1, 0] : [0, -1, 0]));
          }
        }
      }
      // 前縁の丸み（翼の厚みの芯）
      {
        const rings = [];
        for (let i = 0; i <= 10; i++) {
          const t = (i / 10) * Math.min(tEnd, 0.92);
          const x = W.root[0] + t * W.span;
          rings.push([sx * x, W.root[1] + (W.dihed || 0) * t * W.span + W.thick * 0.2, leadZ(t) - W.thick * 0.35, W.thick * 0.55 * (1 - 0.7 * t)]);
        }
        const segs = 6;
        const pts = rings.map((r, i) => {
          const row = [];
          for (let j = 0; j <= segs; j++) {
            const th = (j / segs) * Math.PI * 2;
            const p = [r[0], r[1] + Math.sin(th) * r[3], r[2] + Math.cos(th) * r[3]];
            const t = i / 10 * Math.min(tEnd, 0.92);
            const tp = Math.sin(th) > 0, wc = o.paint.wing({ t, c: 0, top: tp, finger: false, p });
            row.push({ p, c: tp ? wc : mul(wc, UNDER), a: [sx > 0 ? 2 : 3, t, tp ? 0.05 : -0.05, M.FEATHER], cc: [r[0], r[1], r[2]] });
          }
          return row;
        });
        grid(m, pts, (i, j) => nrm(sub(pts[i][j].p, pts[i][j].cc)));
      }
    }
  }
  // 尾羽：一枚ずつ扇に並べる（まん中の羽が上）
  if (o.tail) {
    const T = o.tail;
    const n = T.n;
    for (let k = 0; k < n; k++) {
      const f = n > 1 ? (k / (n - 1)) * 2 - 1 : 0;
      const af = Math.abs(f);
      const L = T.len * (T.shape ? T.shape(af) : 1);
      const ang = f * T.spread * 0.5;
      const pitch = T.pitch || 0;
      const dir = [Math.sin(ang) * Math.cos(pitch), Math.sin(pitch), -Math.cos(ang) * Math.cos(pitch)];
      const side = [Math.cos(ang), 0, Math.sin(ang)];
      const R = 6, C = 2;
      const rows = [];
      for (let i = 0; i <= R; i++) {
        const v = i / R;
        const curve = (T.curve || 0) * v * v * L;
        const c0 = add(add(T.base, dir, L * v), [0, 1, 0], -curve + (1 - af) * T.w * 0.06 + (T.lift || 0) * v);
        const tip = T.tip || 0.25;
        const w = T.w * (T.wf ? T.wf(v) : 1) * (v > 1 - tip ? Math.sqrt(Math.max(0, 1 - ((v - (1 - tip)) / tip) ** 2)) : 1) * (0.75 + 0.25 * v);
        const row = [];
        for (let j = 0; j <= C; j++) {
          const c = j / C;
          const p = add(add(c0, side, (c - 0.5) * w), [0, 1, 0], Math.sin(Math.PI * c) * w * 0.05);
          const col = jit(o.paint.tail({ f, v, c, k, n, p, L }), p, 0.035, 1 / (o.feather * 1.3));
          row.push({ p, c: col, a: [4, v, f, o.paint.tailCls ? o.paint.tailCls({ f, v }) : M.FEATHER] });
        }
        rows.push(row);
      }
      grid(m, rows, () => [0, 1, 0]);
    }
  }
  // 脚と指
  if (o.leg) {
    const L = o.leg;
    for (const sx of [-1, 1]) {
      const hip = [sx * L.x, L.top, L.z];
      const ankle = [sx * L.x * 1.02, L.top - L.len * (L.knee ?? 0.62), L.z - (L.bend || 0)];
      const foot = [sx * L.x * 1.04, L.r * 1.2, L.z + (L.fz || 0)];
      const pts = [];
      const segs = 6;
      const ctrl = L.tibia ? [[hip, L.r * 1.9], [add(hip, sub(ankle, hip), 0.5), L.r * 1.25], [ankle, L.r * 1.2], [foot, L.r]] : [[hip, L.r * 1.3], [ankle, L.r * 1.05], [foot, L.r * 0.95]];
      for (let i = 0; i < ctrl.length; i++) {
        const [c, r] = ctrl[i];
        const a = ctrl[Math.max(0, i - 1)][0], b = ctrl[Math.min(ctrl.length - 1, i + 1)][0];
        const T = nrm(sub(b, a));
        const X = nrm(cross(T, [0, 0, 1]), [1, 0, 0]), Y = cross(X, T);
        const row = [];
        for (let j = 0; j <= segs; j++) {
          const th = (j / segs) * Math.PI * 2;
          const d = add(mul(X, Math.cos(th)), Y, Math.sin(th));
          const p = add(c, d, r);
          const feathered = L.tibia && i === 0;
          row.push({ p, c: feathered ? (L.thighCol || L.col) : L.col, a: [5, 1 - c[1] / L.top, sx, M.SKIN], d });
        }
        pts.push(row);
      }
      grid(m, pts, (i, j) => pts[i][j].d);
      // 指：前に三本、後ろに一本
      const toes = [[0.42, 1], [0, 1.1], [-0.42, 1], [Math.PI, 0.6]];
      for (const [a0, lf] of toes) {
        const a = a0 * (L.toeSpread ?? 1) + (a0 === Math.PI ? 0 : 0);
        const d = [Math.sin(a) * sx * (a0 === Math.PI ? 0 : 1), 0, Math.cos(a)];
        const tl = L.toe * lf;
        const p0 = [foot[0], L.r * 0.9, foot[2]];
        const p1 = add(p0, d, tl * 0.55); p1[1] = L.r * 0.7;
        const p2 = add(p0, d, tl); p2[1] = L.r * 0.4;
        const rs = [L.r * 0.8, L.r * 0.6, L.r * 0.25];
        const ps = [p0, p1, p2];
        const rows = ps.map((c, i) => {
          const T = nrm(d), X = nrm(cross(T, [0, 1, 0]), [1, 0, 0]), Y = cross(X, T);
          const row = [];
          for (let j = 0; j <= 4; j++) {
            const th = (j / 4) * Math.PI * 2;
            const dd = add(mul(X, Math.cos(th)), Y, Math.sin(th));
            row.push({ p: add(c, dd, rs[i]), c: i === 2 ? (L.claw || [0.03, 0.03, 0.03]) : L.col, a: [5, 1, sx, M.SKIN], d: dd });
          }
          return row;
        });
        grid(m, rows, (i, j) => rows[i][j].d);
      }
    }
  }
  if (o.extras) o.extras(m, { SP, eyeC, grid, M, jit, o });
  return m.build();
}

// ---- 動き（頂点シェーダ） ----
// iB: x=前後の傾き y=横の傾き z=大きさ w=歩み(+)・脚をたたむ(-)
// iC: x=翼を広げる(0..1) y=羽ばたきの位相 z=首（頭の上下・サギは首の伸び） w=尾の上下（+で上）
// iD: x=歩みの位相 y=頭の左右 z=羽ばたきの強さ(0 滑空) w=色の違い(0..1)
function birdAnim(o) {
  const A = o.anim || {};
  const W = o.wing;
  const sp = spine(o.spine);
  const nk = sp.at(o.iNeck - 0.2);
  const cen = sp.at(o.iNeck * 0.45);
  const heron = !!A.neck;
  let neckCode = '';
  if (heron) {
    const j = A.neck.map((s) => sp.at(s));
    neckCode = `
    const vec3 J0 = vec3(0.0, ${F(j[0].y)}, ${F(j[0].z)});
    const vec3 J1 = vec3(0.0, ${F(j[1].y)}, ${F(j[1].z)});
    const vec3 J2 = vec3(0.0, ${F(j[2].y)}, ${F(j[2].z)});
    const float S0 = ${F(A.neck[0])}; const float S1 = ${F(A.neck[1])}; const float S2 = ${F(A.neck[2])};`;
  }
  return /* glsl */ `
varying vec3 vObj;
const vec3 SH = ${V3(W.root)};
const float ARM = ${F(W.arm)};
const float ARML = ${F(W.arm * W.span)};
const float AMP = ${F(A.amp ?? 1.0)};
const float DIH = ${F(A.dih ?? 0.08)};
const float HDIH = ${F(A.hdih ?? 0.0)};
const float SWEEP = ${F(A.sweep ?? 0.5)};
const vec3 NK = vec3(0.0, ${F(nk.y)}, ${F(nk.z)});
const float NS0 = ${F(o.iNeck - 0.6)};
const float NS1 = ${F(o.iHead - 0.2)};
const vec3 HIP = ${V3([o.leg.x, o.leg.top, o.leg.z])};
const vec3 TB = ${V3(o.tail.base)};
const vec3 FC = vec3(0.0, ${F(cen.y)}, ${F(cen.z)});
const float FAN0 = ${F(A.fan0 ?? 0.0)};
const float FAN1 = ${F(A.fan1 ?? 0.6)};
const float TUCKA = ${F(A.tuckA ?? 1.1)};
const float TUCKS = ${F(A.tuckS ?? 0.45)};
const float LIFT = ${F(A.lift ?? o.leg.len * 0.25)};
const float SWING = ${F(A.swing ?? 0.5)};
const float BOB = ${F(A.bob ?? 0.0)};
${neckCode}
void animate(inout vec3 p, inout vec3 n, inout vec3 col) {
  vObj = position;
  int part = int(aPart.x + 0.5);
  float fly = iC.x, ph = iC.y, amp = iD.z;
  float walk = max(iB.w, 0.0), tuck = max(-iB.w, 0.0);
  col *= 0.94 + 0.12 * iD.w;
  if (part == 2 || part == 3) {
    // 羽ばたき：肩（腕）と手首（手）の二関節。打ち上げでは手を後ろへたたむ
    float side = part == 2 ? 1.0 : -1.0;
    vec3 sh = SH * vec3(side, 1.0, 1.0);
    vec3 wr = sh + vec3(side * ARML, 0.0, 0.0);
    float t = aPart.y;
    float s = sin(ph), c = cos(ph);
    float a1 = DIH + AMP * amp * s;
    float a2 = HDIH + AMP * amp * 0.6 * sin(ph - 0.9);
    float fold = SWEEP * amp * max(0.0, c) * (0.4 + 0.6 * max(0.0, -s + 0.3));
    float wh = smoothstep(ARM - 0.05, ARM + 0.1, t);
    mat3 Rh = rotZ(side * a2 * wh) * rotY(side * fold * wh);
    p = rotAbout(p, wr, Rh); n = Rh * n;
    mat3 Ra = rotZ(side * a1) * rotY(side * fold * 0.3);
    p = rotAbout(p, sh, Ra); n = Ra * n;
    p = sh + (p - sh) * fly;
    vThinOut = 1.0;
  } else if (part == 7) {
    p = mix(p, FC, fly);
  } else if (part == 5) {
    // 脚：左右交互に振る。飛ぶときはたたむ（サギは後ろへのばす）
    float side = aPart.z;
    vec3 hip = HIP * vec3(side, 1.0, 1.0);
    float q = iD.x + (side > 0.0 ? 0.0 : 3.14159);
    float sw = sin(q);
    float lf = max(0.0, cos(q));
    mat3 R = rotX(-sw * SWING * walk + TUCKA * tuck);
    p = rotAbout(p, hip, R); n = R * n;
    p.y += lf * walk * LIFT * aPart.y;
    p = mix(p, hip + (p - hip) * TUCKS, tuck);
  } else if (part == 4) {
    float fan = FAN0 + FAN1 * max(fly, 0.0);
    mat3 R = rotX(iC.w) * rotY(aPart.z * fan);
    p = rotAbout(p, TB, R); n = R * n;
    vThinOut = 1.0;
  }
  if (part == 0 || part == 6 || part == 1 || part == 8 || part == 9 || part == 10) {
${heron ? `
    // サギの首：三つの関節で S 字を伸び縮み（iC.z: -1 縮める 0 ふつう 1 前へ伸ばす）
    float s = (part == 0 || part == 6 || part == 1) ? aPart.y : 99.0;
    float ext = iC.z;
    float a0 = mix(0.0, 0.55, sat(ext)) + mix(0.0, -0.45, sat(-ext)) - 0.35 * fly;
    float a1 = mix(0.0, -0.55, sat(ext)) + mix(0.0, 1.05, sat(-ext)) + 1.25 * fly;
    float a2 = mix(0.0, 0.55, sat(ext)) + mix(0.0, -0.75, sat(-ext)) - 0.85 * fly;
    float w0 = smoothstep(S0 - 0.35, S0 + 0.35, s), w1 = smoothstep(S1 - 0.35, S1 + 0.35, s), w2 = smoothstep(S2 - 0.3, S2 + 0.3, s);
    mat3 R2 = rotX(a2 * w2), R1 = rotX(a1 * w1), R0 = rotY(iD.y * w0) * rotX(a0 * w0);
    p = rotAbout(p, J2, R2); p = rotAbout(p, J1, R1); p = rotAbout(p, J0, R0);
    n = R0 * R1 * R2 * n;` : `
    float w = (part == 0 || part == 6) ? smoothstep(NS0, NS1, aPart.y) : 1.0;
    if (w > 0.0) {
      // ハトの首ふり：一歩ごとに頭を前へ突き出して止める
      float fr = fract(iD.x / 3.14159);
      float bob = BOB * walk * ((fr < 0.3 ? fr / 0.3 : 1.0 - (fr - 0.3) / 0.7) - 0.5);
      mat3 R = rotY(iD.y * w) * rotX(iC.z * w);
      p = rotAbout(p, NK, R); n = R * n;
      p.z += bob * w;
    }`}
    if (part == 9) vThinOut = 1.0;
  }
}
`;
}

// ---- 面の描き方（creatures.js の CFS の代わり） ----
const BIRD_FS = /* glsl */ `
${ALL}
${SHADOW}
varying vec3 vN;
varying vec3 vWorld;
varying vec3 vCol;
varying vec4 vPart;
varying float vThin;
varying vec3 vObj;
uniform float uGloss;
uniform float uFeather;
uniform vec3 uIriA;
uniform vec3 uIriB;
uniform vec3 uFN;      // 体の羽の並び：x=背骨1区間あたりの列 y=まわりの数 z=強さ
uniform float uStreak; // 羽の軸の黒い筋（キジ♀・ヒバリの縦斑）
float vn3(vec3 p) {
  vec3 i = floor(p), f = p - i;
  vec3 u = f * f * (3.0 - 2.0 * f);
  ivec3 q = ivec3(i);
  float a = hashI3(q), b = hashI3(q + ivec3(1, 0, 0)), c = hashI3(q + ivec3(0, 1, 0)), d = hashI3(q + ivec3(1, 1, 0));
  float e = hashI3(q + ivec3(0, 0, 1)), g = hashI3(q + ivec3(1, 0, 1)), h = hashI3(q + ivec3(0, 1, 1)), k = hashI3(q + ivec3(1, 1, 1));
  return mix(mix(mix(a, b, u.x), mix(c, d, u.x), u.y), mix(mix(e, g, u.x), mix(h, k, u.x), u.y), u.z);
}
void main() {
#ifdef DEPTH
  gl_FragColor = vec4(1.0);
#else
  float w = vPart.w;
  bool one = w > 9.5;
  int cls = int(w - (one ? 10.0 : 0.0) + 0.5);
  if (one && !gl_FrontFacing) discard;
  vec3 N = normalize(vN);
  vec3 V = normalize(cameraPosition - vWorld);
  if (!one && vThin > 0.5 && dot(N, V) < 0.0) N = -N;
  vec3 alb = vCol;
  float NV = sat(dot(N, V));
  // 羽毛：房のむらと羽枝の細い筋（画面で細かすぎるところは消す）
  int part = int(vPart.x + 0.5);
  float fshade = 1.0;
  if (cls <= 1) {
    vec3 q = vObj / uFeather;
    float fw = length(fwidth(q));
    float fade = 1.0 - smoothstep(0.35, 1.1, fw);
    if (fade > 0.0) {
      float n1 = vn3(q * vec3(0.9, 1.3, 0.6));
      float n2 = vn3(q * 3.1 + 7.0);
      float k = (n1 - 0.5) * 0.22 + (n2 - 0.5) * 0.1;
      alb *= 1.0 + k * fade;
    }
    if (part == 0 || part == 6 || part == 1) {
      // 体の羽：後ろ向きに重なる並び（背骨の位置 s × まわりの角度）。一枚ごとに大きさ・明るさがばらつき、縁はうすく影になる。背ほど見え、腹はやわらかい
      vec2 g = vec2(vPart.y * uFN.x, vPart.z * uFN.y);
      float row = floor(g.x);
      g.y += mod(row, 2.0) * 0.5 + (hashI2(ivec2(int(row), 7)) - 0.5) * 0.3;
      vec2 id = floor(g);
      vec2 f = fract(g);
      float fwg = length(fwidth(g));
      float fd = 1.0 - smoothstep(0.2, 0.6, fwg);
      if (fd > 0.0) {
        float h1 = hashI2(ivec2(id) + ivec2(31, 17));
        float d = length(vec2((f.y - 0.5) * (1.0 + 0.3 * h1), f.x - 0.55 - 0.15 * h1));
        float wob = vn3(vec3(g * 3.0, 1.7)) * 0.12;
        float edge = smoothstep(0.36 + wob, 0.52 + wob, d);
        float barb = sin((f.y - 0.5) * 30.0 + f.x * 5.0 + h1 * 6.0) * 0.5 + 0.5;
        float up = sin(vPart.z * 6.2832);
        float k = uFN.z * (0.35 + 0.65 * smoothstep(-0.3, 0.7, up));
        fshade = mix(1.0, (1.0 - 0.2 * edge) * (0.96 + 0.08 * h1) * (0.97 + 0.05 * barb), fd * k);
      }
      // 縦斑：一枚ごとの羽の中央（羽軸）に沿う細長い黒い筋。濃さは羽ごとにばらつく。細かすぎて描けない距離では平均の暗さにする
      if (uStreak > 0.0) {
        float h2 = hashI2(ivec2(id) + ivec2(31, 17));
        float upS = sin(vPart.z * 6.2832);
        float fs = 1.0 - smoothstep(0.35, 1.0, fwg);
        float core = 1.0 - smoothstep(0.1, 0.28, length(vec2((f.y - 0.5) * 1.6, (f.x - 0.45) * 0.55)));
        float stv = mix(0.1, core * (0.35 + 0.65 * h2), fs);
        fshade *= 1.0 - uStreak * stv * (0.4 + 0.6 * smoothstep(-0.5, 0.3, upS));
      }
    } else if (part == 7) {
      // たたんだ翼：前は小さな雨覆、後ろは長い風切り（縁の線）
      float a = vPart.y, b = vPart.z;
      float cov = 1.0 - smoothstep(0.35, 0.5, a);
      vec2 g = cov > 0.5 ? vec2(a * 22.0, b * 7.0) : vec2(a * 3.0, b * 9.0 - a * 3.0);
      float row = floor(g.x);
      g.y += mod(row, 2.0) * 0.5;
      vec2 f = fract(g);
      float fwg = length(fwidth(g));
      float fd = 1.0 - smoothstep(0.25, 0.7, fwg);
      float e = cov > 0.5 ? smoothstep(0.3, 0.48, length(vec2(f.y - 0.5, (f.x - 0.6) * 0.8))) : smoothstep(0.72, 0.98, f.y) + (1.0 - smoothstep(0.0, 0.08, f.y)) * 0.4;
      fshade = mix(1.0, 1.0 - (cov > 0.5 ? 0.14 : 0.24) * e, fd * min(1.0, uFN.z * 1.4));
      if (uStreak > 0.0) fshade *= 1.0 - uStreak * 0.9 * fd * (1.0 - smoothstep(0.08, 0.3, abs(f.y - 0.5))) * (cov > 0.5 ? 0.7 : 1.0);
    } else if (part == 2 || part == 3) {
      // 広げた翼：aPart.z の大きさ＝翼弦の位置。後ろ半分の風切りは雨覆より暗く、羽の境の線（外側ほど長い初列）。雨覆は段の線
      float cz = abs(vPart.z) - 0.05;
      float rem = smoothstep(0.4, 0.56, cz);
      vec2 g = vec2(vPart.y * 17.0 + cz * 1.3, cz * 6.0);
      float fwg = length(fwidth(g));
      float fd = 1.0 - smoothstep(0.3, 0.8, fwg);
      float ln = rem > 0.5 ? smoothstep(0.8, 1.0, fract(g.x)) : smoothstep(0.75, 1.0, fract(g.y + 0.3 * fract(g.x * 0.5)));
      fshade = mix(1.0, 0.8, rem) * (1.0 - (rem > 0.5 ? 0.16 : 0.1) * ln * fd);
    }
    alb *= fshade;
  }
  float nl = dot(N, uSunDir);
  float wrap = cls == 3 ? 0.0 : (cls >= 2 ? 0.15 : 0.4);
  float diff = sat((nl + wrap) / (1.0 + wrap));
  float sh = sunShadow(vWorld, max(nl, 0.2), gl_FragCoord.xy) * cloudShadow(vWorld);
  float ao = 0.6 + 0.4 * sat(N.y * 0.5 + 0.6);
  vec3 amb = shIrr(N) * ao;
  vec3 col = alb * (uSunCol * diff * sh + amb);
  vec3 H = normalize(uSunDir + V);
  float NH = max(dot(N, H), 0.0);
  float rough = cls == 3 ? 0.06 : cls == 2 ? 0.34 : cls == 1 ? 0.42 : cls == 4 ? 0.5 : cls == 5 ? 0.7 : 0.6;
  float a2 = rough * rough * rough * rough;
  float dd = NH * NH * (a2 - 1.0) + 1.0;
  float D = a2 / (3.14159 * dd * dd + 1e-5);
  float fres = 0.04 + 0.96 * pow(1.0 - NV, 5.0);
  float spec = D * fres * sat(nl) * 0.25;
  vec3 sc = vec3(1.0);
  if (cls == 1) {
    // 構造色：見る角度で色が移る艶（カラス・キジ・カワセミ）
    sc = mix(uIriA, uIriB, sat(pow(1.0 - NV, 1.5) + 0.25 * sin(dot(N, uSunDir) * 4.0))) * 0.8 + 0.08;
    spec *= 2.2 * fshade * fshade;
    col += sc * amb * 0.12 * (0.3 + 0.7 * pow(1.0 - NV, 2.0));
  }
  col += uSunCol * sc * spec * sh * (cls == 0 ? uGloss * 4.0 + 0.3 : 1.0);
  // 羽の縁の柔らかい明るさ（毛羽立ち）
  if (cls == 0) col += alb * amb * pow(1.0 - NV, 3.0) * 0.3;
  // 目：空の映り込み
  if (cls == 3) {
    vec3 R = reflect(-V, N);
    col += shIrr(R) * fres * 1.6 + uSunCol * pow(max(dot(R, uSunDir), 0.0), 300.0) * 3.0 * sh;
  }
  // 薄い部分（翼・尾）は逆光で透ける
  // 翼は後縁の風切りの帯だけ（雨覆・前縁は厚くて透けない）
  float thinK = (part == 2 || part == 3) ? smoothstep(0.62, 0.95, abs(vPart.z) - 0.05) : 1.0;
  if (vThin > 0.5) col += alb * uSunCol * pow(sat(dot(-V, uSunDir)), 4.0) * 0.14 * sh * thinK;
  gl_FragColor = vec4(col, 1.0);
#endif
}
`;

// Herd を作り、面の描き方を差し替える
function herd(shared, o, opt) {
  const geo = buildBird(o);
  const h = new Herd(shared, geo, birdAnim(o), { cap: opt.cap, gloss: o.mat?.gloss ?? 0.05, shadow: !!opt.shadow });
  const u = h.mat.uniforms;
  u.uFeather = { value: o.feather };
  u.uIriA = { value: new THREE.Vector3(...(o.mat?.iriA || [1, 1, 1])) };
  u.uIriB = { value: new THREE.Vector3(...(o.mat?.iriB || [1, 1, 1])) };
  u.uFN = { value: new THREE.Vector3(...(o.fn || [3.2, 22, 0.55])) };
  u.uStreak = { value: o.streak ?? 0 };
  h.mat.fragmentShader = BIRD_FS; h.mat.needsUpdate = true;
  if (h.mesh.userData.depthMaterial) { h.mesh.userData.depthMaterial.fragmentShader = BIRD_FS; h.mesh.userData.depthMaterial.needsUpdate = true; }
  h.spec = o;
  h.verts = geo.attributes.position.count;
  return h;
}

// =====================================================================
// 種ごとの形と色
// =====================================================================

// 小鳥の胴の型（L=全長の基準）。ctrl は [z, y, rx, ry]、姿勢は pitch（前上がり）で傾ける
function smallSpine(L, o = {}) {
  const pw = o.plump ?? 1, head = o.head ?? 1, pitch = o.pitch ?? 0.35, hy = o.hy ?? 0.255, neck = o.neck ?? head;
  // 水平に組んでから、腰（ほぼ胴の中心）を軸に前上がりへ回す
  const raw = [
    [-0.24, 0.02, 0.05, 0.06],
    [-0.17, 0.0, 0.11 * pw, 0.12 * pw],
    [-0.06, -0.01, 0.145 * pw, 0.15 * pw],
    [0.06, 0.01, 0.135 * pw, 0.14 * pw],
    [0.15, 0.05, 0.1 * neck, 0.105 * neck],
    [0.2, 0.1 + (o.neckUp ?? 0), 0.105 * head, 0.108 * head],
    [0.26, 0.12 + (o.neckUp ?? 0), 0.1 * head, 0.1 * head],
    [0.31, 0.11 + (o.neckUp ?? 0), 0.058 * head, 0.062 * head],
    [0.335, 0.105 + (o.neckUp ?? 0), 0.028 * head, 0.03 * head],
  ];
  const c = Math.cos(pitch), s = Math.sin(pitch);
  return raw.map(([z, y, rx, ry], i) => {
    // 頭は起こしすぎない（首から先は半分だけ回す）
    const k = i >= 4 ? 0.35 : 1;
    const cc = Math.cos(pitch * k), ss = Math.sin(pitch * k);
    const zz = i >= 4 ? (0.06 * c + (z - 0.06) * cc - (y - 0.01) * ss) : z * c - y * s;
    const yy = i >= 4 ? (0.06 * s + 0.01 * c + (z - 0.06) * ss + (y - 0.01) * cc) : z * s + y * c;
    return [zz * L, (yy + hy) * L, rx * L, ry * L];
  });
}
// 小鳥の共通の骨組み（翼・尾・脚の置き場所）を L から作る
function smallKit(L, o = {}) {
  const sp = smallSpine(L, o);
  const tb = sp[0];
  return {
    spine: sp, iNeck: 4, iHead: 5, k: 5, segs: 22,
    eye: { s: 6.05, th: 0.32, r: 0.024 * L * (o.eyeK ?? 1), iris: o.iris || [0.08, 0.05, 0.03], ring: o.ring, pupil: o.pupil },
    fold: { s0: 3.55, s1: 1.0, thT: 1.08, thB: -0.28, tip: (o.foldTip ?? 0.2) * L, lift: 0.008 * L, drop: 0.15, front: 0.4 },
    wing: { root: [0.07 * L, sp[3][1] + 0.05 * L, sp[3][0] + 0.02 * L], span: (o.span ?? 0.62) * L, chord: (o.chord ?? 0.3) * L, arm: 0.42, lead: 0.05 * L, sweep: (o.sweep ?? 0.14) * L, taper: o.taper ?? 0.55, round: o.round ?? 0.35, notch: 0.12, nFeath: 16, thick: 0.02 * L, dihed: 0.02, ns: 22 },
    tail: { base: [0, tb[1] + 0.01 * L, tb[2] + 0.02 * L], n: 10, len: (o.tail ?? 0.42) * L, w: (o.tailW ?? 0.075) * L, spread: o.spread ?? 0.35, pitch: o.tailPitch ?? -0.12, shape: o.tailShape || ((f) => 1 - 0.08 * f), tip: 0.3 },
    leg: { x: 0.05 * L, top: sp[2][1] - 0.08 * L, z: sp[2][0] + 0.03 * L, len: sp[2][1] - 0.08 * L, r: 0.009 * L * (o.legK ?? 1), toe: 0.11 * L, bend: 0.03 * L, knee: 0.55, col: o.leg || [0.2, 0.18, 0.17] },
    feather: 0.02 * L,
    anim: { amp: 1.05, dih: 0.1, sweep: 0.75, fan0: 0.0, fan1: 0.7, tuckA: 1.2, tuckS: 0.4, swing: 0.6 },
  };
}

// ---- メジロ：黄緑の背・黄色いのど・白いアイリング ----
function mejiro() {
  const L = 0.118;
  const K = smallKit(L, { plump: 1.05, head: 1.02, pitch: 0.45, ring: { r: 1.42, col: [0.86, 0.86, 0.83] }, eyeK: 1.18, pupil: 0.84, iris: [0.16, 0.09, 0.04], tail: 0.4, span: 0.6, leg: [0.2, 0.21, 0.24] });
  const olive = [0.14, 0.2, 0.025], oliveD = [0.08, 0.11, 0.02], yel = [0.55, 0.43, 0.03], belly = [0.62, 0.61, 0.55], flank = [0.32, 0.27, 0.19];
  return {
    ...K,
    bill: { len: 0.1 * L, w: 0.03 * L, d: 0.03 * L, ang: 0.12, droop: 0.012 * L, col: [0.1, 0.1, 0.11], colL: [0.3, 0.3, 0.32], pw: 0.9 },
    paint: {
      body: (c) => {
        if (c.region === 'head') {
          // 目先の黒い筋・のどの黄色
          if (c.e[1] < -0.2 * c.e[2] - 0.008 && c.up < 0) return yel;
          if (Math.abs(c.e[1] + 0.001) < 0.0025 && c.e[2] > 0.002 && c.e[2] < 0.01) return [0.03, 0.04, 0.02];
          return mix3(olive, [0.3, 0.36, 0.05], sstep(0.4, 1, c.hs) * 0.4);
        }
        const up = c.up;
        let col = mix3(belly, olive, sstep(-0.25, 0.35, up));
        if (up < 0 && c.s > 3.2) col = mix3(col, yel, sstep(3.2, 4.2, c.s));         // のど
        if (up < 0.1 && up > -0.7 && c.s > 1.2 && c.s < 3.3) col = mix3(col, flank, 0.55 * (1 - Math.abs(up + 0.3) * 1.4)); // わき腹
        if (up < -0.2 && c.s < 1.4) col = mix3(col, yel, 0.7);                         // 下尾筒
        return col;
      },
      fold: (c) => (c.a > 0.55 ? mix3(oliveD, [0.05, 0.06, 0.03], sstep(0.6, 1, c.a) * (1 - c.b * 0.5)) : mix3(olive, oliveD, c.b * 0.5)),
      wing: (c) => (c.top ? (c.c > 0.4 || c.finger ? mix3([0.07, 0.08, 0.05], olive, 0.3 * (1 - c.c)) : olive) : mix3([0.32, 0.31, 0.27], [0.2, 0.2, 0.18], c.c)),
      tail: (c) => mix3([0.08, 0.09, 0.05], oliveD, 0.5 + 0.5 * Math.abs(c.f) * (c.c > 0.5 === c.f > 0 ? 1 : 0.4)),
    },
    feather: 0.004,
  };
}
// ---- シジュウカラ：黒い頭・白い頬・胸のネクタイ・黄緑の背 ----
function shijukara() {
  const L = 0.14;
  const K = smallKit(L, { plump: 1.08, head: 1.1, pitch: 0.4, iris: [0.03, 0.02, 0.02], tail: 0.44, span: 0.62, leg: [0.25, 0.27, 0.32] });
  const blk = [0.01, 0.01, 0.012], wht = [0.75, 0.75, 0.73], grey = [0.17, 0.19, 0.22], green = [0.22, 0.25, 0.06], belly = [0.56, 0.56, 0.53];
  return {
    ...K,
    bill: { len: 0.075 * L, w: 0.04 * L, d: 0.04 * L, ang: 0.08, col: [0.02, 0.02, 0.02], pw: 0.9 },
    paint: {
      body: (c) => {
        if (c.region === 'head' || (c.region === 'neck' && c.up > -0.2)) {
          // 白い頬：目の下から首の横へ
          const ch = c.e[1] < -0.0025 && c.e[1] > -0.012 && c.e[2] < 0.004 && c.e[2] > -0.014 && c.sd > 0.3;
          if (ch) return wht;
          // 後頭の白い斑
          if (c.region === 'neck' && c.up > 0.7) return [0.75, 0.75, 0.7];
          return blk;
        }
        const up = c.up;
        let col = mix3(belly, grey, sstep(-0.15, 0.4, up));
        if (up > 0.35 && c.s > 2.6) col = mix3(col, green, sstep(2.6, 3.4, c.s));    // 背の上の黄緑
        // 黒いネクタイ：のどから腹の中央
        if (up < -0.15 && c.sd < 0.22 + 0.25 * sstep(3.0, 4.2, c.s) && c.s > 1.2) col = blk;
        if (c.region === 'neck' && up < 0) col = blk;
        return col;
      },
      fold: (c) => {
        let col = mix3([0.19, 0.22, 0.26], [0.09, 0.1, 0.12], sstep(0.5, 1, c.a));
        if (c.a > 0.3 && c.a < 0.4 && c.b > 0.3) col = [0.72, 0.72, 0.7];          // 白い翼帯
        if (c.a > 0.55 && c.b < 0.25) col = mix3(col, [0.6, 0.62, 0.62], 0.5);
        return col;
      },
      wing: (c) => (c.top ? (c.c > 0.42 || c.finger ? [0.1, 0.11, 0.13] : (c.c > 0.3 ? [0.7, 0.7, 0.68] : [0.19, 0.22, 0.26])) : [0.3, 0.31, 0.32]),
      tail: (c) => (Math.abs(c.f) > 0.8 && (c.c > 0.5) === (c.f > 0) ? [0.75, 0.75, 0.73] : [0.12, 0.13, 0.15]),
    },
    feather: 0.0045,
  };
}
// ---- ウグイス：地味なうぐいす色・白っぽい眉・長めの尾 ----
function uguisu() {
  const L = 0.15;
  const K = smallKit(L, { plump: 0.95, head: 0.98, pitch: 0.3, iris: [0.12, 0.08, 0.04], tail: 0.5, tailW: 0.068, span: 0.56, leg: [0.45, 0.36, 0.3], tailShape: (f) => 1 - 0.22 * f * f, tailPitch: 0.05 });
  const up = [0.2, 0.17, 0.075], upD = [0.13, 0.11, 0.05], under = [0.45, 0.42, 0.34];
  return {
    ...K,
    bill: { len: 0.085 * L, w: 0.03 * L, d: 0.03 * L, ang: 0.05, col: [0.2, 0.16, 0.12], colL: [0.5, 0.42, 0.34], pw: 0.9 },
    paint: {
      body: (c) => {
        if (c.region === 'head') {
          if (c.e[1] > 0.002 && c.e[1] < 0.0055 && c.e[2] > -0.012 && c.e[2] < 0.012 && c.sd > 0.3) return [0.62, 0.58, 0.46]; // 眉
          if (Math.abs(c.e[1]) < 0.002 && c.e[2] < -0.002 && c.e[2] > -0.012 && c.sd > 0.4) return [0.14, 0.11, 0.06];         // 過眼線
          return c.up < -0.1 ? under : up;
        }
        return mix3(under, up, sstep(-0.3, 0.3, c.up));
      },
      fold: (c) => mix3(up, upD, sstep(0.4, 1, c.a) * (1 - c.b * 0.6)),
      wing: (c) => (c.top ? mix3(up, upD, c.c) : [0.34, 0.32, 0.27]),
      tail: () => upD,
    },
    feather: 0.005,
  };
}
// ---- ヒバリ：茶色に黒い縦斑・小さな冠羽・外側の白い尾羽 ----
function hibari() {
  const L = 0.17;
  const K = smallKit(L, { plump: 1.0, head: 0.95, pitch: 0.18, iris: [0.1, 0.07, 0.04], tail: 0.4, span: 0.66, chord: 0.32, leg: [0.55, 0.42, 0.33] });
  const buff = [0.25, 0.18, 0.1], dark = [0.06, 0.042, 0.025], under = [0.48, 0.42, 0.33], breast = [0.33, 0.25, 0.16];
  const streak = (p, a, b) => vnoise3(p[0] * a + 3.1, p[1] * a, p[2] * b) > 0.62;
  return {
    ...K,
    bill: { len: 0.075 * L, w: 0.04 * L, d: 0.042 * L, ang: 0.08, col: [0.3, 0.25, 0.2], colL: [0.55, 0.47, 0.38], pw: 0.9 },
    paint: {
      body: (c) => {
        if (c.region === 'head') {
          if (c.e[1] > 0.002 && c.e[1] < 0.006 && c.sd > 0.3 && c.e[2] > -0.014) return [0.66, 0.58, 0.44];  // 眉
          if (c.up < -0.2) return under;
          return streak(c.p, 900, 350) ? dark : buff;
        }
        const up = c.up;
        let col = mix3(under, buff, sstep(-0.1, 0.4, up));
        if (up > 0.1 && streak(c.p, 800, 260)) col = mix3(col, dark, 0.55);
        if (up < 0.1 && up > -0.6 && c.s > 2.6 && streak(c.p, 1300, 500)) col = mix3(breast, dark, 0.55);
        else if (up < 0.1 && up > -0.6 && c.s > 2.6) col = mix3(col, breast, 0.6);
        return col;
      },
      // 羽の中心が黒く縁が淡い（黒い軸は面の描き方の uStreak）
      fold: (c) => mix3([0.5, 0.41, 0.27], mix3(buff, dark, 0.5), sstep(0.5, 1, c.a) * (1 - c.b * 0.4)),
      wing: (c) => (c.top ? (c.c > 0.85 && !c.finger && c.t < 0.5 ? [0.7, 0.66, 0.58] : mix3(buff, dark, c.c * 0.8 + (c.finger ? 0.2 : 0))) : [0.4, 0.36, 0.3]),
      tail: (c) => (Math.abs(c.f) > 0.75 ? [0.78, 0.76, 0.7] : (c.k % 2 ? dark : [0.2, 0.14, 0.09])),
    },
    extras: (m, h) => {
      // 冠羽：頭の後ろに立つ短い羽
      const p0 = h.SP.point(6.2, Math.PI / 2), p1 = h.SP.point(5.3, Math.PI / 2);
      const rows = [];
      for (let i = 0; i <= 3; i++) {
        const v = i / 3;
        const c = add(mix3(p0, p1, v), [0, 1, 0], 0.012 * L * v + 0.004 * L);
        const w = 0.05 * L * (1 - v * 0.8);
        rows.push([-1, 0, 1].map((x) => ({ p: add(c, [x * w, 0, 0]), c: v > 0.5 ? dark : buff, a: [9, 99, 0, M.FEATHER] })));
      }
      h.grid(m, rows, () => [0, 1, 0]);
    },
    streak: 0.8,
    fn: [2.6, 18, 0.55],
    feather: 0.0055,
    anim: { ...K.anim, fan1: 1.0 },
  };
}
// ---- ヒヨドリ：灰色のほっそりした体・茶色の頬・ぼさぼさの頭・長い尾 ----
function hiyodori() {
  const L = 0.27;
  const K = smallKit(L, { plump: 0.88, head: 0.9, pitch: 0.42, iris: [0.25, 0.1, 0.05], tail: 0.5, tailW: 0.06, span: 0.56, leg: [0.1, 0.1, 0.1], tailShape: (f) => 1 - 0.1 * f });
  const grey = [0.11, 0.11, 0.12], greyL = [0.21, 0.21, 0.22], cheek = [0.22, 0.11, 0.05];
  return {
    ...K,
    bill: { len: 0.085 * L, w: 0.03 * L, d: 0.028 * L, ang: 0.08, droop: 0.01 * L, col: [0.02, 0.02, 0.02], pw: 0.9 },
    paint: {
      body: (c) => {
        if (c.region === 'head') {
          if (c.e[2] < 0.002 && c.e[2] > -0.03 && c.e[1] < 0.004 && c.e[1] > -0.02 && c.sd > 0.3) return cheek;
          return mix3(greyL, grey, sstep(-0.3, 0.3, c.up));
        }
        let col = mix3(greyL, grey, sstep(-0.4, 0.3, c.up));
        // 胸の白い細かい斑
        if (c.up < -0.1 && c.s > 1.5 && vnoise3(c.p[0] * 700, c.p[1] * 700, c.p[2] * 700) > 0.7) col = mix3(col, [0.45, 0.45, 0.44], 0.5);
        return col;
      },
      fold: (c) => mix3(grey, [0.12, 0.12, 0.13], sstep(0.5, 1, c.a)),
      wing: (c) => (c.top ? mix3(grey, [0.1, 0.1, 0.11], c.c) : [0.25, 0.24, 0.22]),
      tail: () => [0.11, 0.11, 0.12],
    },
    extras: (m, h) => {
      // 逆立った頭の羽
      for (const [s, dx] of [[6.0, 0], [5.6, 0.25], [5.6, -0.25], [5.3, 0]]) {
        const p0 = h.SP.point(s, Math.PI / 2 + dx);
        const rows = [];
        for (let i = 0; i <= 2; i++) {
          const v = i / 2;
          const c = add(p0, [0, 0.35, -1], 0.035 * L * v);
          const w = 0.035 * L * (1 - v * 0.8);
          rows.push([-1, 0, 1].map((x) => ({ p: add(c, [x * w, 0, 0]), c: greyL, a: [9, 99, 0, M.FEATHER] })));
        }
        h.grid(m, rows, () => [0, 1, 0]);
      }
    },
    feather: 0.008,
  };
}
// ---- ムクドリ：黒っぽい茶・白い頬・橙のくちばしと脚・白い腰 ----
function mukudori() {
  const L = 0.24;
  const K = smallKit(L, { plump: 1.0, head: 1.0, pitch: 0.1, iris: [0.1, 0.07, 0.05], tail: 0.3, span: 0.62, chord: 0.28, sweep: 0.2, taper: 0.4, round: 0.25, leg: [0.7, 0.36, 0.1], legK: 1.2 });
  const body = [0.07, 0.06, 0.055], head = [0.03, 0.028, 0.028], white = [0.72, 0.7, 0.66];
  return {
    ...K,
    bill: { len: 0.1 * L, w: 0.035 * L, d: 0.03 * L, ang: 0.1, col: [0.75, 0.45, 0.08], tip: [0.12, 0.1, 0.08], tipAt: 0.82, pw: 0.85 },
    paint: {
      body: (c) => {
        if (c.region === 'head' || c.region === 'neck') {
          // 白っぽい頬と額の斑（個体差の強い模様を点々で）
          if (c.region === 'head' && c.sd > 0.4 && c.e[1] < 0.004 && c.e[2] < 0.01 && vnoise3(c.p[0] * 500, c.p[1] * 500, c.p[2] * 500) > 0.42) return white;
          return head;
        }
        let col = mix3([0.12, 0.1, 0.09], body, sstep(-0.3, 0.3, c.up));
        if (c.up > 0.3 && c.s < 0.9) col = white;                                // 白い腰
        if (c.up < -0.4 && c.s < 1.0) col = mix3(col, white, 0.6);
        return col;
      },
      fold: (c) => mix3([0.08, 0.065, 0.055], [0.02, 0.02, 0.02], sstep(0.5, 1, c.a)),
      wing: (c) => (c.top ? mix3([0.06, 0.05, 0.045], [0.02, 0.02, 0.02], c.c) : [0.15, 0.13, 0.12]),
      tail: (c) => (c.v > 0.9 ? [0.4, 0.38, 0.35] : [0.03, 0.03, 0.03]),
    },
    feather: 0.007,
  };
}
// ---- キジバト：葡萄色がかった灰・うろこ模様の翼・首の縞・赤い脚 ----
function kijibato() {
  const L = 0.33;
  const K = smallKit(L, { plump: 1.0, head: 0.62, neck: 0.82, pitch: 0.2, iris: [0.72, 0.32, 0.05], tail: 0.36, tailW: 0.075, span: 0.64, chord: 0.3, sweep: 0.22, taper: 0.4, round: 0.25, leg: [0.55, 0.12, 0.1], legK: 1.1, neckUp: 0.03 });
  const head = [0.19, 0.17, 0.17], breast = [0.28, 0.2, 0.18], belly = [0.36, 0.31, 0.29], back = [0.17, 0.135, 0.11];
  return {
    ...K,
    bill: { len: 0.06 * L, w: 0.025 * L, d: 0.025 * L, ang: 0.15, col: [0.15, 0.13, 0.14], base: [0.4, 0.35, 0.38], baseAt: 0.35, pw: 0.7 },
    paint: {
      body: (c) => {
        if (c.region === 'head') return mix3(head, [0.42, 0.38, 0.38], sstep(0.5, 1, c.hs) * 0.4);
        if (c.region === 'neck' || c.s > 3.6) {
          // 首の横の縞（黒と青灰）
          if (c.sd > 0.55 && c.up > -0.3 && c.up < 0.55 && c.s > 3.8 && c.s < 4.9) return Math.sin((c.p[1] - c.p[2] * 0.5) * 900) > 0 ? [0.03, 0.03, 0.04] : [0.35, 0.4, 0.48];
          return c.up > 0.3 ? head : breast;
        }
        let col = mix3(belly, breast, sstep(1.0, 3.2, c.s));
        col = mix3(col, back, sstep(0.0, 0.5, c.up));
        if (c.up < -0.2 && c.s < 1.2) col = [0.4, 0.38, 0.4];
        return col;
      },
      fold: (c) => {
        // うろこ：羽の中心が黒く、縁が赤茶
        const u = c.a * 11, v = c.b * 4 + (Math.floor(c.a * 11) % 2) * 0.5;
        const fu = u - Math.floor(u), fv = v - Math.floor(v);
        const d = Math.hypot(fu - 0.45, (fv - 0.5) * 0.9);
        if (c.a > 0.72) return [0.1, 0.09, 0.09];                                      // 初列風切り
        return d < 0.3 ? [0.045, 0.036, 0.03] : mix3([0.24, 0.15, 0.09], [0.2, 0.16, 0.135], sstep(0.4, 0.55, d));
      },
      wing: (c) => (c.top ? (c.c > 0.45 || c.finger || c.t > 0.5 ? [0.06, 0.06, 0.065] : [0.24, 0.18, 0.14]) : [0.2, 0.21, 0.23]),
      tail: (c) => (c.v > 0.85 ? [0.45, 0.45, 0.46] : c.v > 0.75 ? [0.03, 0.03, 0.035] : [0.11, 0.11, 0.125]),
    },
    feather: 0.009,
    anim: { ...K.anim, amp: 1.0, sweep: 0.55, bob: 0.018 },
  };
}
// ---- ハシブトガラス：艶のある黒・太く反ったくちばし・盛り上がった額・指の開いた翼 ----
function karasu() {
  const L = 0.5;
  const K = smallKit(L, { plump: 0.95, head: 0.95, pitch: 0.22, iris: [0.05, 0.035, 0.03], tail: 0.4, tailW: 0.07, span: 0.95, chord: 0.36, sweep: 0.1, taper: 0.75, round: 0.2, leg: [0.02, 0.02, 0.022], legK: 1.25, tailShape: (f) => 1 - 0.1 * f * f });
  const blk = [0.014, 0.014, 0.018];
  const sp = K.spine.map((r) => r.slice());
  // 額を高く（ハシブト）
  sp[6][1] += 0.015 * L; sp[6][3] *= 1.12; sp[7][1] += 0.01 * L; sp[7][3] *= 1.25;
  return {
    ...K,
    spine: sp,
    bill: { len: 0.15 * L, w: 0.055 * L, d: 0.085 * L, ang: 0.06, droop: 0.008 * L, arc: 0.3, col: [0.012, 0.012, 0.014], pw: 0.8, pwd: 1.1, gape: -0.25, inset: 0.1 },
    wing: { ...K.wing, fingers: 5, fingerAt: 0.72, fingerLen: 1.15, fingerSpread: 0.55, notch: 0.06, nFeath: 12 },
    paint: {
      body: () => blk, bodyCls: () => M.GLOSS,
      fold: () => blk, foldCls: () => M.GLOSS,
      wing: (c) => (c.top ? blk : [0.02, 0.02, 0.022]), wingCls: (c) => (c.top ? M.GLOSS : M.FEATHER),
      tail: () => blk, tailCls: () => M.GLOSS,
      jit: 0.08,
    },
    feather: 0.014,
    mat: { gloss: 0.1, iriA: [0.3, 0.33, 0.55], iriB: [0.5, 0.36, 0.6] },
    anim: { ...K.anim, amp: 0.85, sweep: 0.35, dih: 0.06, fan1: 0.5 },
  };
}
// ---- カワセミ：大きな頭と長いくちばし・コバルトの背の筋・橙の腹・赤い脚 ----
function kawasemi() {
  const L = 0.13;
  const K = smallKit(L, { plump: 1.05, head: 1.38, pitch: 0.55, iris: [0.02, 0.02, 0.02], tail: 0.24, tailW: 0.06, span: 0.52, chord: 0.3, sweep: 0.1, taper: 0.55, round: 0.35, leg: [0.75, 0.12, 0.05], legK: 1.2 });
  const bg = [0.02, 0.16, 0.2], cyan = [0.02, 0.42, 0.55], org = [0.65, 0.22, 0.04], wht = [0.8, 0.78, 0.7];
  const spots = (p) => vnoise3(p[0] * 700, p[1] * 700, p[2] * 700) > 0.7;
  return {
    ...K,
    bill: { len: 0.32 * L, w: 0.07 * L, d: 0.085 * L, ang: 0.05, col: [0.02, 0.02, 0.02], colL: [0.05, 0.03, 0.03], pw: 1.0, inset: 0.15 },
    paint: {
      body: (c) => {
        if (c.region === 'head' || c.region === 'neck') {
          const e = c.e;
          if (c.up < -0.35 && e[2] > -0.02) return wht;                                      // のど
          if (c.sd > 0.3 && e[1] < 0.003 && e[1] > -0.009 && e[2] < -0.004 && e[2] > -0.022) return org; // 耳羽（頬の橙）
          if (c.sd > 0.3 && e[1] < 0.003 && e[1] > -0.007 && e[2] > 0.0 && e[2] < 0.012) return org;    // 目先
          if (c.sd > 0.35 && e[1] < -0.009 && e[1] > -0.014 && e[2] < 0.006) return bg;          // ひげ線
          if (c.region === 'neck' && c.sd > 0.5 && c.up > -0.3 && c.up < 0.3) return wht;          // 首の白斑
          return spots(c.p) ? [0.08, 0.45, 0.55] : bg;
        }
        if (c.up > 0.55) return cyan;                                    // 背の青い筋
        if (c.up < 0.15) return org;
        return bg;
      },
      bodyCls: (c) => (c.up > 0.15 && !(c.region !== 'body' && c.up < -0.35) ? M.GLOSS : M.FEATHER),
      fold: (c) => (c.a > 0.7 ? [0.02, 0.1, 0.12] : (Math.sin(c.a * 40) * Math.sin(c.b * 12) > 0.6 ? [0.07, 0.4, 0.5] : [0.02, 0.2, 0.24])),
      foldCls: () => M.GLOSS,
      wing: (c) => (c.top ? (c.c > 0.5 || c.finger ? [0.02, 0.08, 0.1] : [0.02, 0.22, 0.28]) : [0.45, 0.2, 0.08]),
      wingCls: (c) => (c.top ? M.GLOSS : M.FEATHER),
      tail: () => [0.02, 0.2, 0.3], tailCls: () => M.GLOSS,
    },
    feather: 0.0045,
    mat: { gloss: 0.08, iriA: [0.1, 0.6, 0.9], iriB: [0.2, 0.4, 1.0] },
    anim: { ...K.anim, amp: 0.9, sweep: 0.4 },
  };
}

// ---- キジ（雄）：緑の胸・青紫の首・赤い顔・長い縞の尾 ----
function kijiBase(male) {
  const L = 0.58;
  const neckUp = male ? 0.1 : 0.02;          // 胴＋頭の長さの基準（尾は別）
  const K = smallKit(L, { plump: male ? 1.08 : 1.12, head: male ? 0.46 : 0.42, neck: male ? 0.62 : 0.66, pitch: male ? 0.12 : 0.04, iris: [0.55, 0.4, 0.12], tail: male ? 0.85 : 0.45, tailW: male ? 0.065 : 0.07, spread: 0.2, tailPitch: 0.08, span: 0.62, chord: 0.36, sweep: 0.1, taper: 0.6, round: 0.4, leg: [0.36, 0.32, 0.27], legK: 1.6, neckUp, hy: male ? 0.31 : 0.28, tailShape: (f) => 0.3 + 0.7 * Math.pow(1 - f, 1.6) });
  // 首を長く、頭を小さく
  const sp = K.spine.map((r) => r.slice());
  sp[4][2] *= 1.1; sp[4][3] *= 1.1;
  const kit = { ...K, spine: sp };
  kit.leg = { ...K.leg, len: K.leg.len * 1.25, top: K.leg.top, r: 0.0085 * L, toe: 0.12 * L };
  kit.tail.n = male ? 12 : 12;
  kit.tail.curve = male ? 0.06 : 0.04;
  kit.fold.tip = 0.12 * L;
  return kit;
}
function kijiM() {
  const K = kijiBase(true);
  const L = 0.58;
  const green = [0.015, 0.05, 0.025], purple = [0.02, 0.02, 0.06], red = [0.55, 0.025, 0.015], blueG = [0.1, 0.11, 0.115];
  return {
    ...K,
    bill: { len: 0.075 * L, w: 0.045 * L, d: 0.045 * L, ang: 0.2, droop: 0.012 * L, col: [0.62, 0.55, 0.38], pw: 0.8 },
    paint: {
      body: (c) => {
        if (c.region === 'head') {
          const e = c.e;
          if (c.sd > 0.25 && Math.hypot(e[1] + 0.001, e[2] + 0.001) < 0.017) return red;       // 赤い肉垂
          return purple;
        }
        if (c.region === 'neck') return c.up > 0.4 ? mix3(purple, green, 0.4) : purple;
        const up = c.up;
        if (up < 0.25) return green;                                                           // 胸・腹
        // 背：黄土色の縁どりの斑
        const n = vnoise3(c.p[0] * 90, c.p[1] * 90, c.p[2] * 90);
        return n > 0.55 ? [0.28, 0.2, 0.1] : n > 0.4 ? [0.05, 0.08, 0.05] : [0.2, 0.2, 0.17];
      },
      bodyCls: (c) => ((c.region === 'head' && c.sd > 0.25 && Math.hypot(c.e[1] + 0.001, c.e[2] + 0.001) < 0.017) ? M.SKIN : (c.up < 0.25 || c.region !== 'body' ? M.GLOSS : M.FEATHER)),
      fold: (c) => (c.a > 0.7 ? [0.16, 0.13, 0.09] : mix3(blueG, [0.18, 0.2, 0.2], c.b * 0.6)),
      wing: (c) => (c.top ? (c.c > 0.45 || c.finger ? (Math.sin(c.t * 60) > 0.2 ? [0.22, 0.17, 0.1] : [0.07, 0.055, 0.035]) : blueG) : [0.3, 0.27, 0.22]),
      tail: (c) => {
        // 黄土色の尾に黒い横縞
        const bar = Math.sin(c.v * c.L * 190) > 0.55;
        const base = mix3([0.33, 0.3, 0.2], [0.26, 0.22, 0.15], Math.abs(c.f));
        return bar ? [0.05, 0.045, 0.035] : (Math.abs(c.c - 0.5) > 0.35 ? mix3(base, [0.4, 0.28, 0.14], 0.5) : base);
      },
    },
    extras: (m, h) => {
      // 耳羽（小さな角）
      for (const sx of [-1, 1]) {
        const p0 = h.SP.point(6.0, Math.PI / 2 - sx * 0.6 + (sx < 0 ? Math.PI * 0 : 0));
        const q = [sx * Math.abs(p0[0]), p0[1], p0[2]];
        const rows = [];
        for (let i = 0; i <= 2; i++) {
          const v = i / 2;
          const c = add(q, [sx * 0.2, 0.5, -0.9], 0.03 * L * v);
          const w = 0.018 * L * (1 - v * 0.8);
          rows.push([-1, 0, 1].map((x) => ({ p: add(c, [0, 0, x * w]), c: [0.02, 0.06, 0.03], a: [9, 99, 0, M.GLOSS] })));
        }
        h.grid(m, rows, () => [sx, 0.3, 0]);
      }
    },
    feather: 0.012,
    mat: { gloss: 0.08, iriA: [0.15, 0.7, 0.35], iriB: [0.4, 0.2, 0.85] },
    anim: { ...K.anim, amp: 1.0, sweep: 0.3, fan1: 0.4 },
  };
}
function kijiF() {
  const K = kijiBase(false);
  const L = 0.58;
  const buff = [0.22, 0.15, 0.08], dark = [0.05, 0.034, 0.02], pale = [0.34, 0.26, 0.16];
  // 斑は羽ごとの縦の筋（面の描き方の uStreak）で描く。頂点の色は細かく淡いむらだけ
  const mottle = (p, f = 260) => { const n = vnoise3(p[0] * f, p[1] * f, p[2] * f * 0.4); return mix3(mix3(buff, pale, 0.25), mix3(buff, dark, 0.45), sstep(0.3, 0.7, n)); };
  return {
    ...K,
    bill: { len: 0.07 * L, w: 0.04 * L, d: 0.04 * L, ang: 0.2, droop: 0.01 * L, col: [0.5, 0.45, 0.35], pw: 0.8 },
    paint: {
      body: (c) => (c.region === 'head' ? (c.up < -0.2 ? pale : mottle(c.p, 220)) : (c.up < -0.3 ? mix3(pale, buff, 0.3) : mottle(c.p))),
      fold: (c) => mix3(mix3(pale, buff, 0.5), mix3(buff, dark, 0.4), sstep(0.55, 1, c.a) * (1 - c.b * 0.4)),
      wing: (c) => (c.top ? mix3(buff, mix3(buff, dark, 0.6), sstep(0.35, 0.7, c.c) * (0.6 + 0.4 * Math.abs(Math.sin(c.t * 40)))) : [0.34, 0.29, 0.22]),
      tail: (c) => (Math.sin(c.v * c.L * 170) > 0.6 ? dark : buff),
    },
    streak: 0.85,
    fn: [2.6, 18, 0.55],
    feather: 0.012,
    anim: { ...K.anim, amp: 1.0, sweep: 0.3, fan1: 0.4 },
  };
}

// ---- アオサギ：灰色の背・白い頭と首・黒い冠羽・黄色い短剣のくちばし・長い脚 ----
function aosagi() {
  const s = 0.95;
  const sp = [
    [-0.27, 0.45, 0.03, 0.035],
    [-0.2, 0.47, 0.085, 0.09],
    [-0.08, 0.51, 0.11, 0.125],
    [0.04, 0.565, 0.1, 0.12],
    [0.1, 0.635, 0.066, 0.076],
    [0.145, 0.71, 0.046, 0.05],
    [0.13, 0.79, 0.036, 0.038],
    [0.14, 0.865, 0.03, 0.032],
    [0.17, 0.905, 0.03, 0.033],
    [0.21, 0.912, 0.028, 0.029],
    [0.24, 0.907, 0.013, 0.015],
  ].map(([z, y, rx, ry]) => [z * s, y * s, rx * s, ry * s]);
  const grey = [0.07, 0.075, 0.082], greyL = [0.115, 0.12, 0.13], wht = [0.62, 0.62, 0.6], blk = [0.012, 0.012, 0.015], neckG = [0.24, 0.24, 0.26];
  return {
    spine: sp, iNeck: 4, iHead: 8, k: 5, segs: 22,
    eye: { s: 9.05, th: 0.35, r: 0.0065, iris: [0.75, 0.62, 0.1] },
    bill: { len: 0.125 * s, w: 0.018 * s, d: 0.024 * s, ang: 0.08, col: [0.72, 0.5, 0.1], colL: [0.75, 0.58, 0.18], pw: 0.9, inset: 0.2 },
    fold: { s0: 3.8, s1: 0.8, thT: 1.42, thB: -0.55, tip: 0.13 * s, lift: 0.01, drop: 0.35, front: 0.35, conv: 1.1 },
    wing: { root: [0.07 * s, 0.55 * s, 0.03 * s], span: 0.82 * s, chord: 0.33 * s, arm: 0.45, lead: 0.03, sweep: 0.08, taper: 0.8, round: 0.25, fingers: 6, fingerAt: 0.8, fingerLen: 0.9, fingerSpread: 0.35, notch: 0.05, nFeath: 14, thick: 0.02, dihed: -0.02, ns: 26 },
    tail: { base: [0, sp[0][1] + 0.005, sp[0][2] + 0.01], n: 12, len: 0.13 * s, w: 0.032 * s, spread: 0.45, pitch: -0.35, tip: 0.35 },
    leg: { x: 0.035 * s, top: 0.47 * s, z: -0.01, len: 0.47 * s, r: 0.0065 * s, toe: 0.085 * s, bend: 0.03, knee: 0.5, tibia: true, col: [0.55, 0.42, 0.15], thighCol: [0.62, 0.6, 0.55], claw: [0.08, 0.07, 0.06], toeSpread: 1.1 },
    paint: {
      body: (c) => {
        if (c.region === 'head') {
          // 白い顔、目の上から後ろへ黒い帯（冠羽へつづく）
          if (c.e[1] > 0.0 && c.e[1] < 0.016 && c.e[2] < 0.012 && c.sd > 0.15) return blk;
          if (c.up > 0.75 && c.hs < 0.5) return blk;
          return wht;
        }
        if (c.region === 'neck') {
          // 前面に黒い斑の列
          if (c.up < -0.7 && Math.sin(c.s * 40 + (c.p[0] > 0 ? 1.5 : 0)) > 0.35 && c.sd < 0.22 && c.sd > 0.04) return [0.04, 0.04, 0.05];
          return mix3(wht, neckG, sstep(-0.3, 0.6, c.up));
        }
        const up = c.up;
        let col = mix3(wht, grey, sstep(-0.1, 0.45, up));
        if (up < 0.1 && up > -0.6 && c.s > 1.5 && c.s < 3.8) col = blk;                        // わきの黒い帯
        if (up < -0.6) col = mix3(wht, greyL, 0.3);
        return col;
      },
      fold: (c) => {
        if (c.a < 0.12 && c.b > 0.15 && c.b < 0.65) return blk;                                   // 肩の黒い斑
        if (c.b < 0.12 && c.a < 0.6) return mix3(greyL, wht, 0.35);                             // 翼の前縁の淡い縁
        if (c.a > 0.78) return [0.06, 0.06, 0.07];                                             // 初列
        return mix3(greyL, grey, sstep(0.2, 0.8, c.b) * 0.6 + sstep(0.5, 0.8, c.a) * 0.3);
      },
      wing: (c) => {
        if (c.top) return c.finger || c.c > 0.5 || (c.t > 0.45 && c.c > 0.25) ? [0.035, 0.035, 0.04] : (c.c < 0.1 && c.t < 0.45 ? wht : greyL);
        return c.finger || c.c > 0.55 ? [0.08, 0.08, 0.09] : [0.3, 0.31, 0.33];
      },
      tail: () => grey,
    },
    extras: (m, h) => {
      // 冠羽：後頭から垂れる二本の黒く細い羽
      for (const dx of [-0.006, 0.006]) {
        const p0 = h.SP.point(8.5, Math.PI / 2);
        const rows = [];
        for (let i = 0; i <= 5; i++) {
          const v = i / 5;
          const c = add(add(p0, [0, 0.004, 0]), [dx * 3, -0.2 - v * 0.25, -1], 0.13 * s * v);
          c[1] -= 0.015 * v * v;
          const w = 0.0065 * (1 - v * 0.8);
          rows.push([-1, 1].map((x) => ({ p: add(c, [x * w, 0, 0]), c: blk, a: [9, 99, 0, M.FEATHER] })));
        }
        h.grid(m, rows, () => [0, 1, 0]);
      }
      // 胸の飾り羽：首の付け根の前から垂れる細長い羽の房
      for (let k = 0; k < 7; k++) {
        const f = k / 6 - 0.5;
        const p0 = h.SP.point(4.2 + Math.abs(f) * 0.3, -Math.PI / 2 + f * 1.4);
        const rows = [];
        const Lp = (0.11 + 0.03 * Math.cos(f * 3)) * s;
        for (let i = 0; i <= 5; i++) {
          const v = i / 5;
          const c = add(add(p0, [f * 0.03, -1, 0.35 - v * 0.2], Lp * v), [0, 0, 0.004 * Math.sin(k * 2.1) * v]);
          const w = 0.011 * (1 - v * 0.75);
          rows.push([-1, 1].map((x) => ({ p: add(c, [x * w, 0, 0]), c: mix3([0.62, 0.62, 0.62], [0.5, 0.5, 0.52], v), a: [0, 4.0, 0, M.FEATHER] })));
        }
        h.grid(m, rows, () => [0, 0, 1]);
      }
    },
    feather: 0.015,
    mat: { gloss: 0.04 },
    anim: { amp: 0.75, dih: 0.0, hdih: -0.05, sweep: 0.2, fan0: 0.0, fan1: 0.5, tuckA: 1.45, tuckS: 1.0, swing: 0.45, lift: 0.06, neck: [4.2, 6.0, 7.8] },
  };
}

// ---- 杭（カワセミの止まり木）：岸に挿した二股の枯れ枝。少し傾き、股から水の上へ細い小枝が折れ曲がって出る ----
export const STAKE_ANIM = /* glsl */ `
varying vec3 vObj;
void animate(inout vec3 p, inout vec3 n, inout vec3 col) { vObj = position; }
`;
function stakeGeo() {
  const m = new MeshB();
  const bark = [0.13, 0.11, 0.08], dead = [0.24, 0.21, 0.16], wet = [0.07, 0.06, 0.045];
  // 折れ線に沿う枝（節でわずかにふくらむ・先は折れ口）
  const limb = (pts, r0, r1, sides, tipCol) => {
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + len3(sub(pts[i], pts[i - 1])));
    const Lt = cum[cum.length - 1];
    const rows = [];
    const NR = Math.max(4, Math.round(Lt / 0.07));
    let seg = 1;
    for (let i = 0; i <= NR; i++) {
      const sd = (i / NR) * Lt;
      while (seg < pts.length - 1 && cum[seg] < sd) seg++;
      const f = clamp01((sd - cum[seg - 1]) / Math.max(1e-6, cum[seg] - cum[seg - 1]));
      const c = mix3(pts[seg - 1], pts[seg], f);
      const T = nrm(sub(pts[seg], pts[seg - 1]));
      const X = nrm(cross(T, Math.abs(T[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0])), Y = cross(T, X);
      const v = sd / Lt;
      const knot = 1 + 0.12 * Math.exp(-(((f - 0.02) / 0.05) ** 2)) * (seg > 1 ? 1 : 0);
      const r = lerp(r0, r1, v) * knot;
      const row = [];
      for (let j = 0; j <= sides; j++) {
        const th = (j / sides) * Math.PI * 2;
        const d = add(mul(X, Math.cos(th)), Y, Math.sin(th));
        const p = add(c, d, r * (1 + 0.08 * (vnoise3(c[0] * 30 + th, c[1] * 30, c[2] * 30) - 0.5)));
        // 根元は濡れて暗く、上は皮がはげて白っぽい。先の折れ口は明るい
        let col = mix3(wet, mix3(bark, dead, 0.35 + 0.65 * vnoise3(p[0] * 60, p[1] * 18, p[2] * 60)), sstep(-0.35, 0.05, c[1]));
        if (tipCol && v > 0.97) col = tipCol;
        row.push({ p, c: jit(col, p, 0.1, 50), a: [0, 0, 0, M.WOOD], d });
      }
      rows.push(row);
    }
    grid(m, rows, (i, j) => rows[i][j].d);
  };
  // 幹：12°ほど後ろ（-x）へ傾き、途中でゆるく曲がる。股は高さ 0.9m
  const fork = [-0.17, 0.9, 0.01];
  limb([[0.02, -0.45, 0.0], [-0.04, 0.1, 0.02], [-0.11, 0.55, -0.01], fork], 0.026, 0.02, 9, null);
  // 股から上へ：もう一方の枝は反対へ開いて短く折れている
  limb([fork, [-0.24, 1.08, -0.03], [-0.27, 1.19, -0.06]], 0.017, 0.011, 7, [0.36, 0.31, 0.23]);
  // 小枝：股から水の上へ。二度折れて、なかほど（0.36, 1.05, 0.06 あたり）にカワセミが止まる
  limb([fork, [0.02, 0.99, 0.03], [0.2, 1.03, 0.07], [0.37, 1.05, 0.06], [0.5, 1.1, 0.02]], 0.011, 0.0045, 6, null);
  // 小枝の先のもう一本の細い枝分かれ
  limb([[0.2, 1.03, 0.07], [0.27, 1.12, 0.12], [0.3, 1.17, 0.11]], 0.005, 0.0025, 5, null);
  return m.build();
}

// ---- まとめて作る ----
export const BIRD_SPECS = { aosagi, kawasemi, kijiM, kijiF, karasu, kijibato, mejiro, shijukara, hibari, uguisu, mukudori, hiyodori };
export function makeBirdHerds(shared) {
  const H = {
    aosagi: herd(shared, aosagi(), { cap: 20, shadow: true }),
    kawasemi: herd(shared, kawasemi(), { cap: 8 }),
    kijiM: herd(shared, kijiM(), { cap: 12, shadow: true }),
    kijiF: herd(shared, kijiF(), { cap: 8, shadow: true }),
    karasu: herd(shared, karasu(), { cap: 32, shadow: true }),
    kijibato: herd(shared, kijibato(), { cap: 32 }),
    mejiro: herd(shared, mejiro(), { cap: 72 }),
    shijukara: herd(shared, shijukara(), { cap: 24 }),
    hibari: herd(shared, hibari(), { cap: 16 }),
    uguisu: herd(shared, uguisu(), { cap: 8 }),
    mukudori: herd(shared, mukudori(), { cap: 140 }),
    hiyodori: herd(shared, hiyodori(), { cap: 16 }),
  };
  const st = new Herd(shared, stakeGeo(), STAKE_ANIM, { cap: 8, gloss: 0.02, shadow: true });
  st.mat.uniforms.uFeather = { value: 0.01 }; st.mat.uniforms.uIriA = { value: new THREE.Vector3(1, 1, 1) }; st.mat.uniforms.uIriB = { value: new THREE.Vector3(1, 1, 1) }; st.mat.uniforms.uFN = { value: new THREE.Vector3(4, 26, 0) }; st.mat.uniforms.uStreak = { value: 0 };
  st.mat.fragmentShader = BIRD_FS;
  st.mesh.userData.depthMaterial.fragmentShader = BIRD_FS;
  H.stake = st;
  return H;
}
