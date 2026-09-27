// 主人公（麦わら帽子の男の子）の形の定義: 関節・骨・距離関数・重み・色
// three.js に依存しないので、ワーカーでメッシュを作れる（kid.worker.js）
// 座標: 足もとが原点、y が上、+z が前。男の子の左手は +x 側。
import { meshSDF, capsule, ellipsoid, roundBox, torus, bounded, smin, smax, sstep, mix } from './sdf.js';
import { sweepLocks, mergeMesh } from './hair.js';

// ---------- 関節（静止ポーズ: 腕を少し開いた A ポーズ）----------
export const A_UP = 0.36, A_LO = 0.40; // 上腕・前腕の開き（ラジアン）
const UA = 0.195, FA = 0.172;
const armDir = (a) => [Math.sin(a), -Math.cos(a), 0];
const add = (p, d, s) => [p[0] + d[0] * s, p[1] + d[1] * s, p[2] + d[2] * s];

function joints(side) {
  const x = side; // +1 = 左, -1 = 右
  const sh = [0.138 * x, 1.0, -0.014];
  const el = add(sh, [armDir(A_UP)[0] * x, armDir(A_UP)[1], -0.02 / UA], UA);
  const wr = add(el, [armDir(A_LO)[0] * x, armDir(A_LO)[1], 0.03 / FA], FA);
  return {
    sh, el, wr,
    hip: [0.079 * x, 0.655, 0.0],
    kn: [0.082 * x, 0.37, 0.012],
    an: [0.082 * x, 0.078, -0.006],
    toe: [0.082 * x, 0.012, 0.082],
  };
}
export const J = {
  base: [0, 0, 0], hips: [0, 0.70, 0], spine: [0, 0.80, 0.004], chest: [0, 0.915, -0.006],
  neck: [0, 1.035, -0.012], head: [0, 1.105, -0.004],
  L: joints(1), R: joints(-1),
};
// 頭の中心（頭のメッシュの原点）
export const HEAD_C = [0, 1.222, 0.004];
export const HEAD_SCALE = 1.13;

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
export const BONE_POS = {
  base: J.base, hips: J.hips, spine: J.spine, chest: J.chest, neck: J.neck, head: J.head,
  upperArmL: J.L.sh, forearmL: J.L.el, handL: J.L.wr, upperArmR: J.R.sh, forearmR: J.R.el, handR: J.R.wr,
  thighL: J.L.hip, shinL: J.L.kn, footL: J.L.an, toeL: J.L.toe, thighR: J.R.hip, shinR: J.R.kn, footR: J.R.an, toeR: J.R.toe,
};

// ---------- 体の距離関数 ----------
function bodyParts() {
  const P = {};
  P.pelvis = ellipsoid([0, 0.708, -0.004], [0.117, 0.088, 0.086]);
  P.buttL = ellipsoid([0.05, 0.672, -0.038], [0.064, 0.068, 0.056]);
  P.buttR = ellipsoid([-0.05, 0.672, -0.038], [0.064, 0.068, 0.056]);
  P.belly = ellipsoid([0, 0.8, 0.014], [0.11, 0.1, 0.09]);
  P.chest = ellipsoid([0, 0.92, -0.004], [0.122, 0.105, 0.082]);
  P.shoulders = capsule([-0.112, 0.992, -0.014], [0.112, 0.992, -0.014], 0.047);
  P.neck = capsule([0, 0.99, -0.014], [0, 1.15, -0.004], 0.038, 0.036);
  for (const [s, j] of [['L', J.L], ['R', J.R]]) {
    const x = s === 'L' ? 1 : -1;
    P['deltoid' + s] = ellipsoid(add(j.sh, [0.008 * x, -0.022, 0], 1), [0.043, 0.056, 0.046], [0, 0, x * A_UP]);
    P['upperArm' + s] = capsule(j.sh, j.el, 0.039, 0.031);
    P['forearm' + s] = capsule(j.el, j.wr, 0.031, 0.0235);
    P['thigh' + s] = capsule(j.hip, j.kn, 0.064, 0.043);
    P['knee' + s] = ellipsoid(add(j.kn, [0, 0.004, 0.014], 1), [0.041, 0.044, 0.036]);
    P['calf' + s] = ellipsoid([j.kn[0] + 0.002 * x, 0.265, -0.012], [0.041, 0.085, 0.042]);
    P['shin' + s] = capsule(j.kn, j.an, 0.04, 0.027);
    P['foot' + s] = capsule(j.an, [j.toe[0], 0.035, 0.06], 0.03, 0.025);
  }
  return P;
}

function legSDF(P, s) {
  return (x, y, z) => {
    let d = smin(P['thigh' + s](x, y, z), P['knee' + s](x, y, z), 0.03);
    d = smin(d, P['calf' + s](x, y, z), 0.04);
    d = smin(d, P['shin' + s](x, y, z), 0.03);
    return smin(d, P['foot' + s](x, y, z), 0.02);
  };
}
function armSDF(P, s) {
  return (x, y, z) => {
    let d = smin(P['upperArm' + s](x, y, z), P['deltoid' + s](x, y, z), 0.03);
    return smin(d, P['forearm' + s](x, y, z), 0.018);
  };
}
function torsoSDF(P) {
  return (x, y, z) => {
    let d = smin(P.pelvis(x, y, z), P.belly(x, y, z), 0.07);
    d = smin(d, P.chest(x, y, z), 0.07);
    d = smin(d, P.shoulders(x, y, z), 0.05);
    d = smin(d, P.buttL(x, y, z), 0.03);
    return smin(d, P.buttR(x, y, z), 0.03);
  };
}

// 骨の重み付け用の部品（どの骨に付くか・なじませる幅）
function weightParts(P) {
  const W = [
    [P.pelvis, 'hips', 0.05], [P.buttL, 'hips', 0.03], [P.buttR, 'hips', 0.03],
    [P.belly, 'spine', 0.06], [P.chest, 'chest', 0.06], [P.shoulders, 'chest', 0.04],
    [capsule([0, 0.99, -0.014], [0, 1.07, -0.01], 0.038), 'neck', 0.03],
    [ellipsoid([0, 1.2, 0], [0.1, 0.1, 0.1]), 'head', 0.05],
  ];
  for (const s of ['L', 'R']) {
    W.push([P['deltoid' + s], 'upperArm' + s, 0.03], [P['upperArm' + s], 'upperArm' + s, 0.03], [P['forearm' + s], 'forearm' + s, 0.03]);
    W.push([P['thigh' + s], 'thigh' + s, 0.045], [P['knee' + s], 'shin' + s, 0.02], [P['calf' + s], 'shin' + s, 0.03], [P['shin' + s], 'shin' + s, 0.03], [P['foot' + s], 'foot' + s, 0.02]);
  }
  return W;
}

function weightsAt(W, x, y, z, out) {
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

// メッシュの配列 → BufferGeometry（重み・頂点色つき）
// ---------- 服 ----------
function shirtSDF(P) {
  const torso = (x, y, z) => {
    let d = smin(P.pelvis(x, y, z), P.belly(x, y, z), 0.07);
    d = smin(d, P.chest(x, y, z), 0.07);
    return smin(d, P.shoulders(x, y, z), 0.05);
  };
  // 襟ぐり（前が低い丸首）
  const collarCut = ellipsoid([0, 1.058, 0.004], [0.056, 0.062, 0.05], [0.42, 0, 0]);
  const collar = torus([0, 1.022, 0.006], 0.051, 0.0085, [0.42, 0, 0]);
  const sleeves = ['L', 'R'].map((s) => {
    const j = J[s], x = s === 'L' ? 1 : -1;
    const d = [Math.sin(A_UP) * x, -Math.cos(A_UP), 0];
    const arm = P['upperArm' + s], del = P['deltoid' + s];
    const LEN = 0.105;
    return (px, py, pz) => {
      // 袖口に向かって少し広がる
      const t = ((px - j.sh[0]) * d[0] + (py - j.sh[1]) * d[1]) / LEN;
      let v = smin(arm(px, py, pz), del(px, py, pz), 0.03) - 0.012 - 0.009 * sstep(0.2, 1, t);
      v += 0.0012 * Math.sin(t * 9 + pz * 70); // しわ
      return smax(v, t - 1, 0.004);
    };
  });
  return (x, y, z) => {
    const th = Math.atan2(x, z);
    let off = 0.011 + 0.012 * sstep(0.86, 0.7, y);
    // 腰まわりのゆるいしわ
    off += 0.0022 * sstep(0.84, 0.72, y) * Math.sin(th * 5 + y * 40);
    let d = torso(x, y, z) - off;
    d = smin(d, sleeves[0](x, y, z), 0.02);
    d = smin(d, sleeves[1](x, y, z), 0.02);
    // すそ
    const hem = 0.688 + 0.004 * Math.sin(th * 3 + 0.6);
    d = smax(d, hem - y, 0.005);
    d = smax(d, -collarCut(x, y, z), 0.012);
    d = smin(d, collar(x, y, z), 0.008);
    return d;
  };
}

function shortsSDF(P) {
  const pel = (x, y, z) => {
    let d = smin(P.pelvis(x, y, z), P.buttL(x, y, z), 0.03);
    return smin(d, P.buttR(x, y, z), 0.03);
  };
  const legs = ['L', 'R'].map((s) => {
    const t = P['thigh' + s];
    return (x, y, z) => t(x, y, z) - (0.012 + 0.016 * sstep(0.62, 0.49, y)) - 0.0015 * Math.sin(Math.atan2(x - J[s].hip[0], z) * 4 + y * 60);
  });
  return (x, y, z) => {
    let d = pel(x, y, z) - 0.013;
    d = smin(d, legs[0](x, y, z), 0.03);
    d = Math.min(d, smin(pel(x, y, z) - 0.013, legs[1](x, y, z), 0.03));
    d = smax(d, y - 0.775, 0.004);
    d = smax(d, 0.487 - y, 0.004);
    return d;
  };
}

// ---------- 靴（足首がローカル原点、+z が前）----------
function shoeSDF() {
  const sole = roundBox([0, -0.067, 0.034], [0.037, 0.0115, 0.084], 0.009);
  const upper = ellipsoid([0, -0.05, 0.03], [0.038, 0.036, 0.083]);
  const toe = ellipsoid([0, -0.053, 0.08], [0.036, 0.026, 0.042]);
  const heel = ellipsoid([0, -0.038, -0.022], [0.034, 0.046, 0.034]);
  const tongue = ellipsoid([0, -0.012, 0.036], [0.023, 0.011, 0.035], [-0.5, 0, 0]);
  const hole = ellipsoid([0, 0.01, -0.004], [0.027, 0.045, 0.031]);
  const collar = torus([0, -0.006, -0.006], 0.031, 0.007, [0.35, 0, 0]);
  const laces = [];
  for (let k = 0; k < 4; k++) {
    const z = 0.022 + k * 0.016, y = -0.018 - k * 0.0062;
    laces.push(capsule([-0.014, y, z], [0.014, y, z], 0.0028));
  }
  return (x, y, z) => {
    let d = smin(upper(x, y, z), toe(x, y, z), 0.02);
    d = smin(d, heel(x, y, z), 0.02);
    d = smax(d, y - (-0.004 + z * 0.12), 0.006); // はき口の高さ
    d = smax(d, -hole(x, y, z), 0.005);
    d = smin(d, collar(x, y, z), 0.004);
    d = smin(d, tongue(x, y, z), 0.006);
    for (const l of laces) d = smin(d, l(x, y, z), 0.002);
    return Math.min(d, sole(x, y, z));
  };
}

// ---------- 手（手首がローカル原点、-y が指先、+z が前、-x が手のひら側）----------
function handSDF() {
  const palm = roundBox([0.002, -0.042, 0.002], [0.013, 0.036, 0.03], 0.012);
  const parts = [palm];
  // 4 本の指: 付け根 → 中 → 先 と手のひら側（-x）へ曲がる
  const fz = [0.022, 0.0075, -0.0075, -0.021], fl = [0.9, 1.0, 0.95, 0.78], fr = [0.0082, 0.0086, 0.0083, 0.0072];
  for (let i = 0; i < 4; i++) {
    const l = fl[i];
    const k0 = [0.0, -0.074, fz[i]];
    const k1 = [-0.008 * l, -0.098 * l - 0.0 , fz[i] * 0.95];
    const k2 = [-0.024 * l, -0.108 * l, fz[i] * 0.9];
    parts.push(capsule(k0, k1, fr[i]), capsule(k1, k2, fr[i], fr[i] * 0.88));
  }
  // 親指
  const t0 = [-0.008, -0.03, 0.026], t1 = [-0.018, -0.056, 0.035], t2 = [-0.027, -0.07, 0.03];
  parts.push(capsule(t0, t1, 0.011, 0.0095), capsule(t1, t2, 0.0095, 0.0085));
  const heel = ellipsoid([-0.006, -0.03, 0.012], [0.011, 0.02, 0.018]);
  const wrist = capsule([0, 0.012, 0], [0.002, -0.03, 0.002], 0.021, 0.02);
  return (x, y, z) => {
    let d = parts[0](x, y, z);
    d = smin(d, heel(x, y, z), 0.01);
    for (let i = 1; i < 9; i++) d = smin(d, parts[i](x, y, z), i % 2 ? 0.01 : 0.004);
    d = smin(d, parts[9](x, y, z), 0.012);
    d = smin(d, parts[10](x, y, z), 0.004);
    // 手首へ伸ばして前腕の中に隠す
    return smin(d, wrist(x, y, z), 0.012);
  };
}

// ---------- 頭（頭の中心がローカル原点）----------
export const HEAD_GEO = {
  eye: { x: 0.041, y: -0.016, w: 0.0168, h: 0.0215 },
  noseY: -0.036, mouthY: -0.071,
};
function headSDF() {
  const cranium = ellipsoid([0, 0.008, -0.01], [0.116, 0.118, 0.122]);
  const face = ellipsoid([0, -0.036, 0.016], [0.104, 0.086, 0.102]);
  const jaw = ellipsoid([0, -0.079, 0.04], [0.062, 0.04, 0.056]);
  const cheekL = ellipsoid([0.052, -0.05, 0.058], [0.046, 0.04, 0.042]);
  const cheekR = ellipsoid([-0.052, -0.05, 0.058], [0.046, 0.04, 0.042]);
  const nose = ellipsoid([0, -0.037, 0.114], [0.0078, 0.009, 0.008], [-0.35, 0, 0]);
  const ears = [1, -1].map((s) => ({
    outer: ellipsoid([s * 0.111, -0.02, -0.008], [0.017, 0.029, 0.021], [0, s * 0.35, s * 0.12]),
    inner: ellipsoid([s * 0.122, -0.022, -0.004], [0.008, 0.019, 0.012], [0, s * 0.35, s * 0.12]),
  }));
  return (x, y, z) => {
    let d = smin(cranium(x, y, z), face(x, y, z), 0.05);
    d = smin(d, jaw(x, y, z), 0.04);
    d = smin(d, cheekL(x, y, z), 0.03);
    d = smin(d, cheekR(x, y, z), 0.03);
    d = smin(d, nose(x, y, z), 0.012);
    for (const e of ears) d = smin(d, smax(e.outer(x, y, z), -e.inner(x, y, z), 0.004), 0.01);
    return d;
  };
}

// 髪: 頭を包む殻（距離関数）を生え際で切り、尖った房（sweepLocks）を重ねる
function hairShape(headF) {
  const shell = ellipsoid([0, 0.01, -0.012], [0.127, 0.129, 0.134]);
  // 生え際の高さ（θ = 0 が正面）。房が縁を隠す
  const line = (th) => {
    const a = Math.abs(th);
    if (a < 0.75) return mix(0.042, 0.03, sstep(0, 0.75, a));
    if (a < 1.25) return mix(0.03, 0.0, sstep(0.75, 1.2, a));
    if (a < 1.75) return mix(0.0, 0.024, sstep(1.25, 1.55, a)); // 耳の上
    return mix(0.024, -0.092, sstep(1.75, 2.5, a)); // えり足
  };
  const sdf = (x, y, z) => smax(shell(x, y, z), line(Math.atan2(x, z + 0.01)) - y, 0.008);
  // 頭の表面の点（高さ y・向き th）から、(out − 1) × 12cm だけ外
  const pt = (th, y, out) => {
    const dx = Math.sin(th), dz = Math.cos(th);
    let lo = 0, hi = 0.2;
    for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; if (headF(dx * m, y, -0.01 + dz * m) < 0) lo = m; else hi = m; }
    const r = lo + (out - 1) * 0.12;
    return [dx * r, y, -0.01 + dz * r];
  };
  const R = (i) => { const v = Math.sin(i * 91.7 + 3.1) * 43758.5453; return v - Math.floor(v); };
  const locks = [];
  const add = (th0, y0, th1, y1, o1, th2, y2, o2, w, t = 0.0055, twist = 0) =>
    locks.push({ p: [pt(th0, y0, 1.0), pt(th1, y1, o1), pt(th2, y2, o2)], w, t, twist });
  // 前髪: 付け根は帽子の下、いったん外へふくらんで額に沿い、眉の上で尖る
  const bangs = 9;
  for (let i = 0; i < bangs; i++) {
    const u = (i / (bangs - 1)) * 2 - 1;
    const th = u * 0.8 + (R(i) - 0.5) * 0.06;
    const tipY = 0.004 + Math.abs(u) * 0.02 + (R(i + 7) - 0.5) * 0.012 - (i === 4 ? 0.008 : 0);
    const bend = (R(i + 3) - 0.5) * 0.14 + u * 0.12;
    add(th - u * 0.05, 0.08, th + bend * 0.3, 0.052, 1.1, th + bend, tipY, 1.035, 0.0175 + R(i + 11) * 0.004, 0.0055, (R(i + 5) - 0.5) * 0.4);
  }
  for (const s of [-1, 1]) {
    // もみあげ（耳の前）
    add(s * 1.0, 0.07, s * 1.05, 0.03, 1.09, s * 1.12, -0.03, 1.04, 0.017);
    add(s * 1.2, 0.07, s * 1.25, 0.03, 1.09, s * 1.3, -0.012, 1.05, 0.015);
    add(s * 0.9, 0.075, s * 0.93, 0.04, 1.1, s * 0.98, 0.006, 1.04, 0.016);
    // 耳の上をまたいで後ろへ
    add(s * 1.5, 0.08, s * 1.6, 0.05, 1.1, s * 1.78, 0.012, 1.08, 0.02);
    add(s * 1.75, 0.08, s * 1.85, 0.035, 1.1, s * 2.0, -0.02, 1.08, 0.02);
  }
  // えり足: 下へ伸び、先が少し外へはねる
  for (let k = 0; k < 9; k++) {
    const u = (k - 4) / 4;
    const th = Math.PI + u * 0.95;
    const tipY = -0.112 + Math.abs(u) * 0.04 + (R(k + 20) - 0.5) * 0.014;
    add(th, 0.04, th + u * 0.04, -0.045, 1.1, th + u * 0.1, tipY, 1.12 + R(k) * 0.05, 0.022 + R(k + 30) * 0.004, 0.0065);
  }
  return { sdf, locks };
}

export function bowSDF() {
  const loopL = ellipsoid([0.024, 0.004, 0.012], [0.024, 0.013, 0.006], [0, 0.35, 0.12]);
  const loopLi = ellipsoid([0.024, 0.004, 0.013], [0.016, 0.006, 0.02], [0, 0.35, 0.12]);
  const loopR = ellipsoid([-0.024, 0.004, 0.012], [0.024, 0.013, 0.006], [0, -0.35, -0.12]);
  const loopRi = ellipsoid([-0.024, 0.004, 0.013], [0.016, 0.006, 0.02], [0, -0.35, -0.12]);
  const knot = ellipsoid([0, 0.003, 0.009], [0.009, 0.012, 0.007]);
  const tail = (s) => {
    const a = capsule([s * 0.004, -0.004, 0.009], [s * 0.016, -0.045, 0.012], 0.004);
    const b = capsule([s * 0.016, -0.045, 0.012], [s * 0.022, -0.075, 0.006], 0.004);
    return (x, y, z) => {
      // 平たい帯にする
      const d = Math.min(a(x, y, z * 1), b(x, y, z));
      return Math.max(d - 0.006, Math.abs(z - mix(0.009, 0.01, (-y) / 0.07)) - 0.0018);
    };
  };
  const tl = tail(1), tr = tail(-1);
  return (x, y, z) => {
    let d = smax(loopL(x, y, z), -loopLi(x, y, z), 0.002);
    d = Math.min(d, smax(loopR(x, y, z), -loopRi(x, y, z), 0.002));
    d = smin(d, knot(x, y, z), 0.004);
    d = Math.min(d, tl(x, y, z), tr(x, y, z));
    return d;
  };
}

// ---------- 色（リニア RGB）----------
export const lin = (hex) => {
  const v = parseInt(hex.slice(1), 16);
  const f = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  return [f((v >> 16) & 255), f((v >> 8) & 255), f(v & 255)];
};
const setC = (o, c) => { o[0] = c[0]; o[1] = c[1]; o[2] = c[2]; };
const lerpC = (o, a, b, t) => { for (let k = 0; k < 3; k++) o[k] = a[k] + (b[k] - a[k]) * t; };
export const SKIN_HEX = '#e3a47a';

// 重み・頂点色・追加の値を付ける
function attach(m, { W, weightFn, color, extra } = {}) {
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
  if (extra) {
    const e = new Float32Array(n);
    for (let v = 0; v < n; v++) e[v] = extra(m.pos[v * 3], m.pos[v * 3 + 1], m.pos[v * 3 + 2]);
    m.extra = e;
  }
  return m;
}

// ---------- 部品ごとのメッシュ ----------
let cache = null;
function common() {
  if (cache) return cache;
  const P = bodyParts();
  const W = weightParts(P);
  // 部位ごとの箱で、遠い所は計算を省く
  const torso = bounded(torsoSDF(P), [-0.18, 0.58, -0.12, 0.18, 1.06, 0.12]);
  const legL = bounded(legSDF(P, 'L'), [0.0, 0.02, -0.08, 0.17, 0.74, 0.09]);
  const legR = bounded(legSDF(P, 'R'), [-0.17, 0.02, -0.08, 0.0, 0.74, 0.09]);
  const armL = bounded(armSDF(P, 'L'), [0.07, 0.6, -0.08, 0.34, 1.07, 0.07]);
  const armR = bounded(armSDF(P, 'R'), [-0.34, 0.6, -0.08, -0.07, 1.07, 0.07]);
  const body = (x, y, z) => {
    let d = smin(torso(x, y, z), P.neck(x, y, z), 0.035);
    d = smin(d, armL(x, y, z), 0.022);
    d = smin(d, armR(x, y, z), 0.022);
    d = smin(d, legL(x, y, z), 0.03);
    return smin(d, legR(x, y, z), 0.03);
  };
  const headF = headSDF();
  cache = { P, W, body, shirt: shirtSDF(P), shorts: shortsSDF(P), headF, hair: hairShape(headF) };
  return cache;
}

// ワーカーに分ける組（重さがだいたいそろうように）
export const PART_GROUPS = [['body'], ['shirt', 'hand', 'bow'], ['shorts', 'shoe'], ['head', 'hair']];

export function buildPart(name) {
  const C = common();
  switch (name) {
    case 'body': {
      // 肌（服の下に深く隠れる所は捨てる）
      const skin = lin(SKIN_HEX), knee = lin('#e8967a'), sock = lin('#f2f0ea'), sockRib = lin('#dcdad2');
      const m = meshSDF(C.body, [-0.33, 0.03, -0.14, 0.33, 1.17, 0.15], 0.0058, {
        cull: (x, y, z) => C.shirt(x, y, z) < -0.008 || C.shorts(x, y, z) < -0.008 || y < 0.07,
      });
      return attach(m, {
        W: C.W,
        color: (x, y, z, nx, ny, nz, o) => {
          const kn = Math.exp(-(((y - 0.37) / 0.04) ** 2)) * sstep(0.0, 0.03, z) * 0.6;
          lerpC(o, skin, knee, kn);
          // 白い靴下（リブ編み）
          const s = sstep(0.128, 0.122, y);
          if (s > 0) lerpC(o, [o[0], o[1], o[2]], Math.sin(Math.atan2(x - Math.sign(x) * 0.082, z) * 18) > 0 ? sock : sockRib, s);
        },
      });
    }
    case 'shirt': {
      const tee = lin('#f4f2ec'), rib = lin('#e6e3da');
      return attach(meshSDF(C.shirt, [-0.3, 0.64, -0.14, 0.3, 1.1, 0.15], 0.0058), {
        W: C.W,
        color: (x, y, z, nx, ny, nz, o) => setC(o, Math.hypot(x, z) < 0.07 && y > 0.98 ? rib : tee),
      });
    }
    case 'shorts': {
      // 紺の半ズボン、横に白い線 2 本
      const navy = lin('#27477f'), stripe = lin('#eeeae0');
      return attach(meshSDF(C.shorts, [-0.2, 0.46, -0.14, 0.2, 0.8, 0.13], 0.0055), {
        W: C.W,
        color: (x, y, z, nx, ny, nz, o) => {
          setC(o, navy);
          const side = Math.abs(nx) > 0.55 && Math.abs(x) > 0.08;
          const zz = z + 0.004;
          if (side && ((zz > 0.004 && zz < 0.009) || (zz > -0.008 && zz < -0.003))) setC(o, stripe);
          if (y < 0.5) for (let k = 0; k < 3; k++) o[k] *= 0.92;
        },
      });
    }
    case 'shoe': {
      // 足首がローカル原点。extra = つま先の骨の重み
      const white = lin('#efece4'), red = lin('#c43a32'), gum = lin('#e0d8c6'), lace = lin('#f7f5ef');
      const toeZ = J.L.toe[2] - J.L.an[2];
      return attach(meshSDF(shoeSDF(), [-0.05, -0.085, -0.07, 0.05, 0.02, 0.135], 0.0036), {
        color: (x, y, z, nx, ny, nz, o) => {
          setC(o, white);
          if (y < -0.055) setC(o, gum);
          if (y < -0.052 && y > -0.058) setC(o, red);
          if (z < -0.04 && y > -0.05 && Math.abs(x) < 0.012) setC(o, red); // かかとのタブ
          if (Math.abs(x) > 0.02 && y > -0.05 && y < -0.02 && Math.abs((z - 0.02) + (y + 0.035) * 1.2) < 0.007) setC(o, red); // 横のライン
          if (y > -0.03 && z > 0.015 && Math.abs(x) < 0.017) setC(o, lace);
        },
        extra: (x, y, z) => sstep(toeZ - 0.018, toeZ + 0.012, z),
      });
    }
    case 'hand': return meshSDF(handSDF(), [-0.045, -0.13, -0.04, 0.03, 0.035, 0.05], 0.0028);
    case 'head': return meshSDF(C.headF, [-0.15, -0.14, -0.15, 0.15, 0.14, 0.15], 0.0033, { cull: (x, y, z) => C.hair.sdf(x, y, z) < -0.005 });
    case 'hair': {
      // 帽子の中に隠れる頭のてっぺんは作らない
      const shell = meshSDF(C.hair.sdf, [-0.16, -0.12, -0.17, 0.16, 0.15, 0.16], 0.0036, { cull: (x, y) => y > 0.09 });
      return mergeMesh(shell, sweepLocks(C.hair.locks, { along: 12, around: 10 }));
    }
    case 'bow': return meshSDF(bowSDF(), [-0.07, -0.09, -0.03, 0.07, 0.05, 0.035], 0.0024);
  }
  throw new Error('unknown part ' + name);
}

// 転送できる配列の一覧
export function transferables(m) {
  return ['pos', 'nrm', 'idx', 'skinIndex', 'skinWeight', 'color', 'extra'].filter((k) => m[k]).map((k) => m[k].buffer);
}
