// 大人の登場人物の共通部品（three.js に依存しない。ワーカーでメッシュを作る）
// 関節・体の距離関数・骨の重み・手・靴・髪の房の置き方・頂点色。
// 座標は主人公（kid/shapes.js）と同じ: 足もとが原点、y が上、+z が前、本人の左手が +x。
import { capsule, ellipsoid, roundBox, torus, smin, smax, sstep, mix } from '../kid/sdf.js';

// 骨は主人公と同じ並び（動きの道具を共有するため）
export const BONES = ['base', 'hips', 'spine', 'chest', 'neck', 'head',
  'upperArmL', 'forearmL', 'handL', 'upperArmR', 'forearmR', 'handR',
  'thighL', 'shinL', 'footL', 'toeL', 'thighR', 'shinR', 'footR', 'toeR'];
export const B = Object.fromEntries(BONES.map((n, i) => [n, i]));
export const PARENT = {
  hips: 'base', spine: 'hips', chest: 'spine', neck: 'chest', head: 'neck',
  upperArmL: 'chest', forearmL: 'upperArmL', handL: 'forearmL',
  upperArmR: 'chest', forearmR: 'upperArmR', handR: 'forearmR',
  thighL: 'hips', shinL: 'thighL', footL: 'shinL', toeL: 'footL',
  thighR: 'hips', shinR: 'thighR', footR: 'shinR', toeR: 'footR',
};

export const add = (p, d, s = 1) => [p[0] + d[0] * s, p[1] + d[1] * s, p[2] + d[2] * s];
const armDir = (a) => [Math.sin(a), -Math.cos(a), 0];

// ---------- 関節（静止ポーズ: 腕を少し開いた A ポーズ）----------
// R: { ankleY, kneeY, kneeX, hipY, hipX, toeZ, hips, spine, chest, neck, head, sh: [x, y, z], ua, fa, aUp, aLo }
export function makeRig(R) {
  const joints = (x) => {
    const sh = [R.sh[0] * x, R.sh[1], R.sh[2]];
    const el = add(sh, [armDir(R.aUp)[0] * x, armDir(R.aUp)[1], -0.02 / R.ua * 0.8], R.ua);
    const wr = add(el, [armDir(R.aLo)[0] * x, armDir(R.aLo)[1], 0.03 / R.fa * 0.8], R.fa);
    return {
      sh, el, wr,
      hip: [R.hipX * x, R.hipY, 0.0],
      kn: [R.kneeX * x, R.kneeY, 0.014],
      an: [R.kneeX * x, R.ankleY, -0.008],
      toe: [R.kneeX * x, 0.016, R.toeZ],
    };
  };
  const J = {
    base: [0, 0, 0], hips: [0, R.hips, 0], spine: [0, R.spine, 0.006], chest: [0, R.chest, -0.006],
    neck: [0, R.neck, -0.022], head: [0, R.head, -0.012],
    L: joints(1), R: joints(-1),
  };
  const BONE_POS = {
    base: J.base, hips: J.hips, spine: J.spine, chest: J.chest, neck: J.neck, head: J.head,
    upperArmL: J.L.sh, forearmL: J.L.el, handL: J.L.wr, upperArmR: J.R.sh, forearmR: J.R.el, handR: J.R.wr,
    thighL: J.L.hip, shinL: J.L.kn, footL: J.L.an, toeL: J.L.toe, thighR: J.R.hip, shinR: J.R.kn, footR: J.R.an, toeR: J.R.toe,
  };
  return { J, BONE_POS, aUp: R.aUp, aLo: R.aLo };
}

// ---------- 体の距離関数 ----------
// S: 部位ごとの寸法（登場人物のファイルで決める）
export function bodyParts(J, S) {
  const P = {};
  P.pelvis = ellipsoid(S.pelvis.c, S.pelvis.r);
  P.buttL = ellipsoid([S.butt.x, S.butt.y, S.butt.z], S.butt.r);
  P.buttR = ellipsoid([-S.butt.x, S.butt.y, S.butt.z], S.butt.r);
  P.belly = ellipsoid(S.belly.c, S.belly.r);
  P.waist = ellipsoid(S.waist.c, S.waist.r);
  P.chest = ellipsoid(S.chest.c, S.chest.r);
  if (S.bust) {
    const b = S.bust;
    P.bustL = ellipsoid([b.x, b.y, b.z], b.r, [b.tilt || 0, 0.18, 0]);
    P.bustR = ellipsoid([-b.x, b.y, b.z], b.r, [b.tilt || 0, -0.18, 0]);
  }
  if (S.pecs) {
    const b = S.pecs;
    P.bustL = ellipsoid([b.x, b.y, b.z], b.r);
    P.bustR = ellipsoid([-b.x, b.y, b.z], b.r);
  }
  const sh = S.shoulders;
  P.shoulders = capsule([-sh.x, sh.y, sh.z], [sh.x, sh.y, sh.z], sh.r);
  P.traps = capsule([-sh.x * 0.55, sh.y + sh.r * 0.55, sh.z - 0.012], [sh.x * 0.55, sh.y + sh.r * 0.55, sh.z - 0.012], sh.r * 0.7);
  P.neck = capsule([0, S.neck.y0, S.neck.z0], [0, S.neck.y1, S.neck.z1], S.neck.r0, S.neck.r1);
  for (const [s, j] of [['L', J.L], ['R', J.R]]) {
    const x = s === 'L' ? 1 : -1;
    P['deltoid' + s] = ellipsoid(add(j.sh, [0.01 * x, -0.028, 0.002]), S.deltoid, [0, 0, x * 0.3]);
    P['upperArm' + s] = capsule(j.sh, j.el, S.upperArm[0], S.upperArm[1]);
    P['forearm' + s] = capsule(j.el, j.wr, S.forearm[0], S.forearm[1]);
    P['brachio' + s] = ellipsoid(add(mix3(j.el, j.wr, 0.28), [0.008 * x, 0, 0.01]), S.brachio, [0, 0, x * 0.33]);
    P['thigh' + s] = capsule(j.hip, j.kn, S.thigh[0], S.thigh[1]);
    P['knee' + s] = ellipsoid(add(j.kn, [0, 0.004, 0.018]), S.knee);
    P['calf' + s] = ellipsoid([j.kn[0] + 0.003 * x, j.kn[1] - S.calf.dy, -0.016], S.calf.r);
    P['shin' + s] = capsule(j.kn, j.an, S.shin[0], S.shin[1]);
    P['foot' + s] = capsule(j.an, [j.toe[0], 0.035, j.toe[2] - 0.03], S.foot[0], S.foot[1]);
  }
  return P;
}
const mix3 = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];

export function legSDF(P, s) {
  return (x, y, z) => {
    let d = smin(P['thigh' + s](x, y, z), P['knee' + s](x, y, z), 0.035);
    d = smin(d, P['calf' + s](x, y, z), 0.05);
    d = smin(d, P['shin' + s](x, y, z), 0.035);
    return smin(d, P['foot' + s](x, y, z), 0.025);
  };
}
export function armSDF(P, s) {
  return (x, y, z) => {
    let d = smin(P['upperArm' + s](x, y, z), P['deltoid' + s](x, y, z), 0.035);
    d = smin(d, P['forearm' + s](x, y, z), 0.022);
    return smin(d, P['brachio' + s](x, y, z), 0.025);
  };
}
export function torsoSDF(P) {
  return (x, y, z) => {
    let d = smin(P.pelvis(x, y, z), P.waist(x, y, z), 0.08);
    d = smin(d, P.belly(x, y, z), 0.06);
    d = smin(d, P.chest(x, y, z), 0.08);
    if (P.bustL) { d = smin(d, P.bustL(x, y, z), 0.035); d = smin(d, P.bustR(x, y, z), 0.035); }
    d = smin(d, P.shoulders(x, y, z), 0.06);
    d = smin(d, P.traps(x, y, z), 0.05);
    d = smin(d, P.buttL(x, y, z), 0.04);
    return smin(d, P.buttR(x, y, z), 0.04);
  };
}

// ---------- 骨の重み ----------
export function weightParts(P, J) {
  const W = [
    [P.pelvis, 'hips', 0.06], [P.buttL, 'hips', 0.04], [P.buttR, 'hips', 0.04],
    [P.waist, 'spine', 0.07], [P.belly, 'spine', 0.07], [P.chest, 'chest', 0.07], [P.shoulders, 'chest', 0.05], [P.traps, 'chest', 0.04],
    [capsule([0, J.neck[1] - 0.04, J.neck[2]], [0, J.head[1] - 0.01, J.head[2]], 0.045), 'neck', 0.035],
    [ellipsoid([0, J.head[1] + 0.09, 0], [0.09, 0.1, 0.1]), 'head', 0.05],
  ];
  if (P.bustL) W.push([P.bustL, 'chest', 0.04], [P.bustR, 'chest', 0.04]);
  for (const s of ['L', 'R']) {
    W.push([P['deltoid' + s], 'upperArm' + s, 0.035], [P['upperArm' + s], 'upperArm' + s, 0.035], [P['forearm' + s], 'forearm' + s, 0.035], [P['brachio' + s], 'forearm' + s, 0.03]);
    W.push([P['thigh' + s], 'thigh' + s, 0.05], [P['knee' + s], 'shin' + s, 0.022], [P['calf' + s], 'shin' + s, 0.035], [P['shin' + s], 'shin' + s, 0.035], [P['foot' + s], 'foot' + s, 0.025]);
  }
  return W;
}

export function weightsAt(W, x, y, z, out) {
  const ds = W.map(([f]) => f(x, y, z));
  const dmin = Math.min(...ds);
  const acc = new Map();
  for (let i = 0; i < W.length; i++) {
    const t = 1 - (ds[i] - dmin) / W[i][2];
    if (t <= 0) continue;
    const b = B[W[i][1]];
    acc.set(b, (acc.get(b) || 0) + t * t);
  }
  const top = [...acc.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
  let sum = 0;
  for (const [, w] of top) sum += w;
  for (let k = 0; k < 4; k++) {
    out[k * 2] = top[k] ? top[k][0] : 0;
    out[k * 2 + 1] = top[k] ? top[k][1] / sum : 0;
  }
}

// 服のすそ（腰より下に垂れる布）: 骨盤と左右の太ももの間で重みを分ける
export function skirtWeights(W, J, { top, bottom, thigh = 0.55 }) {
  return (x, y, z, out) => {
    const t = sstep(top, bottom, y) * thigh;
    if (t <= 0.001) return weightsAt(W, x, y, z, out);
    // 左右どちらの足に近いか（まん中は半分ずつ）
    const l = sstep(-0.05, 0.05, x);
    const w = [[B.hips, 1 - t], [B.thighL, t * l], [B.thighR, t * (1 - l)]].filter((e) => e[1] > 1e-4);
    for (let k = 0; k < 4; k++) { out[k * 2] = w[k] ? w[k][0] : 0; out[k * 2 + 1] = w[k] ? w[k][1] : 0; }
  };
}

// ---------- 色（リニア RGB）と、メッシュへの付けたし ----------
export const lin = (hex) => {
  const v = parseInt(hex.slice(1), 16);
  const f = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  return [f((v >> 16) & 255), f((v >> 8) & 255), f(v & 255)];
};
export const setC = (o, c) => { o[0] = c[0]; o[1] = c[1]; o[2] = c[2]; };
export const lerpC = (o, a, b, t) => { for (let k = 0; k < 3; k++) o[k] = a[k] + (b[k] - a[k]) * t; };

// 重み・頂点色・追加の値（extra: 1 つ、extra2: もう 1 つ）
export function attach(m, { W, weightFn, color, extra, extra2 } = {}) {
  const n = m.count;
  if (W || weightFn) {
    const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4), tmp = new Array(8);
    for (let v = 0; v < n; v++) {
      const x = m.pos[v * 3], y = m.pos[v * 3 + 1], z = m.pos[v * 3 + 2];
      if (weightFn) weightFn(x, y, z, tmp); else weightsAt(W, x, y, z, tmp);
      for (let k = 0; k < 4; k++) { si[v * 4 + k] = tmp[k * 2]; sw[v * 4 + k] = tmp[k * 2 + 1]; }
    }
    m.skinIndex = si; m.skinWeight = sw;
  }
  if (color) {
    const c = new Float32Array(n * 3), o = [0, 0, 0];
    for (let v = 0; v < n; v++) {
      color(m.pos[v * 3], m.pos[v * 3 + 1], m.pos[v * 3 + 2], m.nrm[v * 3], m.nrm[v * 3 + 1], m.nrm[v * 3 + 2], o);
      c[v * 3] = o[0]; c[v * 3 + 1] = o[1]; c[v * 3 + 2] = o[2];
    }
    m.color = c;
  }
  for (const [key, f] of [['extra', extra], ['extra2', extra2]]) {
    if (!f) continue;
    const e = new Float32Array(n);
    for (let v = 0; v < n; v++) e[v] = f(m.pos[v * 3], m.pos[v * 3 + 1], m.pos[v * 3 + 2]);
    m[key] = e;
  }
  return m;
}

export function transferables(m) {
  return ['pos', 'nrm', 'idx', 'skinIndex', 'skinWeight', 'color', 'extra', 'extra2'].filter((k) => m[k]).map((k) => m[k].buffer);
}

// ---------- 手（手首がローカル原点、-y が指先、+z が親指の側、-x が手のひら側。左手）----------
// H: { palm: [半厚み, 半長さ, 半幅], fr: 指の太さ, len: 指の長さの倍率, curl: 指の曲げ（0 = まっすぐ, 1 = 軽く握る）, pose }
// pose: 'relaxed' | 'point'（人差し指を立てる）| 'fist'
export function handSDF(H) {
  const [pt, pl, pw] = H.palm;
  const palm = roundBox([0.001, -pl - 0.004, 0.002], [pt, pl, pw], Math.min(pt, 0.013));
  const parts = [];
  // 指: 付け根（z の並び）と長さ（基節・中節・末節）
  const fz = [pw * 0.72, pw * 0.24, -pw * 0.24, -pw * 0.7];
  const base = [-2 * pl - 0.001, -2 * pl - 0.006, -2 * pl - 0.004, -2 * pl + 0.004];
  const lens = [[0.042, 0.025, 0.021], [0.046, 0.029, 0.022], [0.043, 0.027, 0.021], [0.034, 0.02, 0.018]].map((l) => l.map((v) => v * H.len));
  const rad = [1, 1.04, 0.98, 0.86].map((v) => v * H.fr);
  const curlOf = (i) => {
    if (H.pose === 'point') return i === 0 ? [0.08, 0.05, 0.03] : [1.35, 1.5, 0.9];
    if (H.pose === 'fist') return [1.45, 1.6, 1.0];
    const c = H.curl ?? 0.35;
    return [0.35 + c * 0.4 + i * 0.08, 0.35 + c * 0.6 + i * 0.1, 0.25 + c * 0.35];
  };
  for (let i = 0; i < 4; i++) {
    const cu = curlOf(i);
    let p = [0.0, base[i], fz[i]], a = 0;
    const splay = (i - 1.5) * 0.045;
    for (let k = 0; k < 3; k++) {
      a += cu[k];
      const d = [-Math.sin(a), -Math.cos(a), splay];
      const q = add(p, d, lens[i][k]);
      const r0 = rad[i] * (1 - k * 0.08), r1 = rad[i] * (1 - (k + 1) * 0.08) * (k === 2 ? 0.92 : 1);
      parts.push(capsule(p, q, r0, r1));
      p = q;
    }
  }
  // 親指（手のひら側へ向いて前に出る）
  const tc = H.pose === 'fist' ? 0.9 : H.pose === 'point' ? 0.7 : 0.35;
  const t0 = [-pt * 0.6, -pl * 0.55, pw * 0.8], t1 = add(t0, [-0.012 - tc * 0.012, -0.03, 0.012 - tc * 0.012], H.len);
  const t2 = add(t1, [-0.014 - tc * 0.014, -0.024, -0.002 - tc * 0.014], H.len);
  parts.push(capsule(t0, t1, H.fr * 1.35, H.fr * 1.15), capsule(t1, t2, H.fr * 1.15, H.fr * 1.02));
  const thenar = ellipsoid([-pt * 0.55, -pl * 0.7, pw * 0.45], [pt * 0.8, pl * 0.6, pw * 0.55]);
  const wrist = capsule([0, 0.02, 0], [0.001, -0.03, 0.002], pw * 0.75, pw * 0.72);
  return (x, y, z) => {
    let d = smin(palm(x, y, z), thenar(x, y, z), 0.012);
    for (let i = 0; i < 12; i++) d = smin(d, parts[i](x, y, z), i % 3 === 0 ? 0.011 : 0.003);
    d = smin(d, parts[12](x, y, z), 0.014);
    d = smin(d, parts[13](x, y, z), 0.004);
    return smin(d, wrist(x, y, z), 0.014);
  };
}

// 爪（手の頂点色で薄く塗る）: 指先の甲の側
export function nailTint(H) {
  return (x, y, z, nx) => (nx > 0.35 && y < -2 * H.palm[1] - 0.05 * H.len ? 1 : 0);
}

// ---------- 顔の面（高さごとの幅と前後の奥行きを並べた「ロフト」）----------
// rows: [[y, 半幅, 前の z, 後ろの z?], ...]（y の大きい順）。back: 後ろの z（行ごとに無いとき）。
// 高さの間は Catmull-Rom でなめらかにつなぐ（段にならない）
export function loftFace(rows, back, { round = 0.006 } = {}) {
  const R = rows.map((r) => [r[0], r[1], r[2], r[3] ?? back]);
  const n = R.length, ytop = R[0][0], ybot = R[n - 1][0];
  const cr = (p0, p1, p2, p3, t) => 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t);
  const at = (y) => {
    if (y >= ytop) return R[0];
    if (y <= ybot) return R[n - 1];
    let i = 0;
    while (R[i + 1][0] > y) i++;
    const t = (R[i][0] - y) / (R[i][0] - R[i + 1][0]);
    const a = R[Math.max(0, i - 1)], b = R[i], c = R[i + 1], d = R[Math.min(n - 1, i + 2)];
    return [y, cr(a[1], b[1], c[1], d[1], t), cr(a[2], b[2], c[2], d[2], t), cr(a[3], b[3], c[3], d[3], t)];
  };
  return (x, y, z) => {
    const [, w, f, back] = at(y);
    const rx = Math.max(w, 0.004), rz = Math.max((f - back) / 2, 0.004), cz = (f + back) / 2;
    const a = x / rx, b = (z - cz) / rz;
    const k0 = Math.sqrt(a * a + b * b), k1 = Math.sqrt((a * a) / (rx * rx) + (b * b) / (rz * rz));
    let d = k1 > 1e-9 ? (k0 * (k0 - 1)) / k1 : -Math.min(rx, rz);
    d = smax(d, ybot - y, round);
    return smax(d, y - ytop, round);
  };
}

// ---------- 髪の房を置く道具 ----------
// 頭の距離関数 headF の表面の点（向き th = atan(x, z)、高さ y）から (out − 1) × 10cm だけ外
export function headPoint(headF, cz = -0.01) {
  return (th, y, out) => {
    const dx = Math.sin(th), dz = Math.cos(th);
    let lo = 0, hi = 0.2;
    for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; if (headF(dx * m, y, cz + dz * m) < 0) lo = m; else hi = m; }
    const r = lo + (out - 1) * 0.1;
    return [dx * r, y, cz + dz * r];
  };
}
export const hash = (i) => { const v = Math.sin(i * 91.7 + 3.1) * 43758.5453; return v - Math.floor(v); };

export { capsule, ellipsoid, roundBox, torus, smin, smax, sstep, mix };
