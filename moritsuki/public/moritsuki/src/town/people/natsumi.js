// 定食屋「定食 みなと」の湊 夏海（20 代）の形: 関節・体・服・頭・髪・手ぬぐい（three.js に依存しない）
// ボーダーの T シャツ（袖をまくる）、黒のクロップドパンツ、紺の前掛け、白いスニーカー、
// 高い位置のポニーテールに赤い豆絞りの手ぬぐいの鉢巻き。座標は human.js と同じ（+z が前、本人の左手が +x）。
import { meshSDF, bounded } from '../kid/sdf.js';
import {
  makeRig, bodyParts, legSDF, armSDF, torsoSDF, weightParts, skirtWeights, attach, lin, setC, lerpC, handSDF,
  headPoint, hash, capsule, ellipsoid, torus, smin, smax, sstep, mix, add, B, loftFace,
} from './human.js';
import { sneakerSDF, sneakerColor } from './shoes.js';
import { sweepStrands, mergeMeshes, flowDir } from './strands.js';

export const RIG = makeRig({
  ankleY: 0.082, kneeY: 0.455, kneeX: 0.08, hipY: 0.815, hipX: 0.085, toeZ: 0.112,
  hips: 0.87, spine: 0.99, chest: 1.14, neck: 1.335, head: 1.41,
  sh: [0.16, 1.3, -0.022], ua: 0.272, fa: 0.232, aUp: 0.3, aLo: 0.34,
});
const J = RIG.J;
export const HEAD_C = [0, 1.492, 0.012];
export const HEAD_SCALE = 1.09;

// 顔の模様（face.js）: 頭のローカル座標（頭の中心が原点）の弧長 X と高さ Y
export const FACE = {
  R: 0.087, W: 0.15, Y0: -0.09, Y1: 0.042, PX: 768,
  eye: { x: 0.0292, y: -0.0115, w: 0.0162, h: 0.0182 },
  browY: 0.0172, noseY: -0.0345, mouthY: -0.0585,
};
export const SKIN_HEX = '#efbf9f';
export const HAIR_HEX = '#2b1c15';

const S = {
  pelvis: { c: [0, 0.868, -0.004], r: [0.146, 0.1, 0.098] },
  butt: { x: 0.066, y: 0.822, z: -0.046, r: [0.078, 0.084, 0.07] },
  belly: { c: [0, 0.93, 0.018], r: [0.12, 0.07, 0.082] },
  waist: { c: [0, 1.0, 0.0], r: [0.106, 0.085, 0.077] },
  chest: { c: [0, 1.155, -0.01], r: [0.126, 0.13, 0.09] },
  bust: { x: 0.05, y: 1.143, z: 0.05, r: [0.055, 0.051, 0.045], tilt: 0.2 },
  shoulders: { x: 0.124, y: 1.3, z: -0.024, r: 0.045 },
  neck: { y0: 1.27, z0: -0.024, y1: 1.45, z1: -0.004, r0: 0.041, r1: 0.037 },
  deltoid: [0.045, 0.06, 0.049],
  upperArm: [0.039, 0.031], forearm: [0.033, 0.0225], brachio: [0.029, 0.054, 0.029],
  thigh: [0.085, 0.055], knee: [0.045, 0.049, 0.041], calf: { dy: 0.12, r: [0.046, 0.094, 0.049] },
  shin: [0.047, 0.03], foot: [0.034, 0.028],
};

// ---------- 頭（頭の中心がローカル原点）----------
function headSDF() {
  // 頭蓋は高め・後ろ寄り。顔は高さごとの幅と奥行きで作る（ほおから細いあごへ。口もとは鼻より奥）
  const cranium = ellipsoid([0, 0.02, -0.016], [0.08, 0.09, 0.095]);
  // [高さ, 半幅, 前, 後ろ]: 後ろはあごの下で前へ上がる（首へつながる斜めの面）
  const face = loftFace([
    [0.035, 0.071, 0.08, -0.03],
    [0.0, 0.07, 0.087, -0.03],
    [-0.016, 0.068, 0.087, -0.03],
    [-0.034, 0.062, 0.085, -0.028],
    [-0.05, 0.053, 0.082, -0.02],
    [-0.064, 0.043, 0.0785, -0.006],
    [-0.078, 0.03, 0.0745, 0.014],
    [-0.089, 0.017, 0.069, 0.034],
    [-0.096, 0.007, 0.063, 0.048],
  ], -0.03, { round: 0.008 });
  const cheekL = ellipsoid([0.036, -0.026, 0.06], [0.02, 0.016, 0.02]);
  const cheekR = ellipsoid([-0.036, -0.026, 0.06], [0.02, 0.016, 0.02]);
  const bridge = capsule([0, -0.006, 0.0865], [0, -0.03, 0.0945], 0.0027, 0.0034);
  const tip = ellipsoid([0, -0.0335, 0.0938], [0.0052, 0.0046, 0.005]);
  const lip = ellipsoid([0, -0.0618, 0.0785], [0.0095, 0.0026, 0.003]);
  const ears = [1, -1].map((s) => ({
    outer: ellipsoid([s * 0.081, -0.022, -0.01], [0.012, 0.022, 0.016], [0, s * 0.3, s * 0.1]),
    inner: ellipsoid([s * 0.089, -0.023, -0.007], [0.006, 0.014, 0.009], [0, s * 0.3, s * 0.1]),
  }));
  return (x, y, z) => {
    let d = smin(cranium(x, y, z), face(x, y, z), 0.03);
    d = smin(d, cheekL(x, y, z), 0.02);
    d = smin(d, cheekR(x, y, z), 0.02);
    d = smin(d, bridge(x, y, z), 0.012);
    d = smin(d, tip(x, y, z), 0.008);
    d = smin(d, lip(x, y, z), 0.008);
    for (const e of ears) d = smin(d, smax(e.outer(x, y, z), -e.inner(x, y, z), 0.003), 0.008);
    return d;
  };
}

// ---------- 髪: 後ろへまとめた殻＋前髪・触角・後れ毛 ----------
const SHELL = { c: [0, 0.016, -0.018], r: [0.0905, 0.1035, 0.1065] };
// ポニーテールの付け根（頭のローカル）
export const PONY = { base: [0, 0.066, -0.118], dir: [0, 0.45, -0.89] };

function hairShape(headF) {
  const shell = ellipsoid(SHELL.c, SHELL.r);
  const line = (th) => {
    const a = Math.abs(th);
    if (a < 0.8) return 0.05;
    if (a < 1.25) return mix(0.05, -0.004, sstep(0.8, 1.2, a));
    if (a < 1.75) return mix(-0.004, 0.022, sstep(1.25, 1.55, a)); // 耳は出す
    return mix(0.022, -0.078, sstep(1.75, 2.5, a));                  // えり足
  };
  // 生え際に近いほど殻を頭の面へ寄せて薄くする（ヘルメットのような縁にしない）
  const sdf = (x, y, z) => {
    const ln = line(Math.atan2(x, z + 0.01));
    const e = sstep(0.028, 0.0, y - ln);
    const d = e > 0 ? mix(shell(x, y, z), headF(x, y, z) - 0.0026, e) : shell(x, y, z);
    return smax(d, ln - y, 0.005);
  };
  const pt = headPoint(headF);
  const locks = [];
  const L = (a, b, c, w, t = 0.0048, twist = 0, taper) => locks.push({ p: [a, b, c], w, t, twist, taper });
  // 前髪: 左（+x）寄りの分け目から右へ流す。幅の広い房を重ね、先は丸めに。右ほど長く、眉にかかる
  for (let i = 0; i < 12; i++) {
    const u = i / 11;
    const thr = 0.4 - u * 1.02 + (hash(i) - 0.5) * 0.04;
    const tipY = 0.03 - u * 0.019 + (hash(i + 7) - 0.5) * 0.008 - (i === 7 ? 0.005 : 0);
    const sweep = 0.15 + u * 0.07;
    L(pt(thr, 0.1, 1.0), pt(thr - sweep * 0.45, 0.064, 1.13), pt(thr - sweep - hash(i + 3) * 0.035, tipY, 1.045), 0.021 + hash(i + 11) * 0.005, 0.0052, (hash(i + 5) - 0.5) * 0.3, 0.55);
  }
  // 分け目の左側: 短く左のこめかみへ
  for (let i = 0; i < 3; i++) {
    const thr = 0.5 + i * 0.13;
    L(pt(thr, 0.1, 1.0), pt(thr + 0.12, 0.066, 1.12), pt(thr + 0.26, 0.036 - i * 0.01, 1.05), 0.019, 0.005, -0.2, 0.6);
  }
  for (const s of [-1, 1]) {
    // 触角（耳の前に垂らす細い房）: あごの高さまで、先が少し内へ
    L(pt(s * 1.02, 0.06, 1.0), pt(s * 1.12, -0.004, 1.13), pt(s * 1.0, -0.078, 1.09), 0.0135, 0.0042, s * 0.3, 0.7);
    L(pt(s * 1.14, 0.055, 1.0), pt(s * 1.22, 0.0, 1.12), pt(s * 1.16, -0.056, 1.09), 0.0095, 0.0036, -s * 0.2, 0.7);
    // こめかみから後ろへ流れる房（殻の縁を隠す）
    L(pt(s * 0.95, 0.075, 1.0), pt(s * 1.3, 0.05, 1.1), pt(s * 1.75, 0.035, 1.09), 0.018, 0.005);
    L(pt(s * 1.35, 0.04, 1.0), pt(s * 1.65, 0.035, 1.1), pt(s * 2.05, 0.045, 1.08), 0.016, 0.005);
    // えり足の後れ毛
    L(pt(s * 2.25, -0.045, 1.0), pt(s * 2.28, -0.075, 1.07), pt(s * 2.2, -0.105, 1.06), 0.006, 0.0025, s * 0.5);
  }
  // えり足からポニーテールへ上がる房（うなじをきれいに見せる）
  for (let k = 0; k < 7; k++) {
    const u = (k - 3) / 3;
    const th = Math.PI + u * 0.75;
    L(pt(th, -0.07 + Math.abs(u) * 0.03, 1.0), pt(th - u * 0.12, -0.01, 1.105), [PONY.base[0] + u * 0.008, PONY.base[1] - 0.012, PONY.base[2] + 0.012], 0.02, 0.005);
  }
  return { sdf, locks, shell };
}

// ポニーテール（付け根がローカル原点）: 芯（距離関数）＋まわりの房
function ponytail() {
  const [bx, by, bz] = PONY.base;
  const P0 = [0, 0, -0.004], P1 = [0, 0.036, -0.07], P2 = [0.006, -0.235, -0.1];
  const bezP = (u) => { const a = (1 - u) ** 2, b = 2 * (1 - u) * u, c = u * u; return [0, 1, 2].map((k) => a * P0[k] + b * P1[k] + c * P2[k]); };
  // 付け根はしぼり、少し下でふくらみ、先へ細る
  const rad = (u) => (0.0135 + 0.0145 * sstep(0.0, 0.35, u)) * Math.pow(1 - u, 0.65) + 0.0018;
  const segs = [];
  for (let i = 0; i < 16; i++) { const u0 = i / 16, u1 = (i + 1) / 16; segs.push(capsule(bezP(u0), bezP(u1), rad(u0), rad(u1))); }
  const core = (x, y, z) => { let d = segs[0](x, y, z); for (let i = 1; i < segs.length; i++) d = smin(d, segs[i](x, y, z), 0.012); return d; };
  const coreM = flowDir(meshSDF(core, [-0.06, -0.26, -0.16, 0.06, 0.07, 0.03], 0.0034), (x, y, z) => {
    // 軸の向き（いちばん近い点の接線）
    let best = 0, bd = 1e9;
    for (let i = 0; i <= 24; i++) { const q = bezP(i / 24), d = (q[0] - x) ** 2 + (q[1] - y) ** 2 + (q[2] - z) ** 2; if (d < bd) { bd = d; best = i / 24; } }
    const a = bezP(Math.max(0, best - 0.02)), b = bezP(Math.min(1, best + 0.02));
    return [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  });
  // 房: 軸のまわりに、付け根から先へ
  const locks = [];
  const N = 16;
  for (let i = 0; i < N; i++) {
    const f = (i / N) * Math.PI * 2 + hash(i) * 0.3;
    const len = 0.78 + hash(i + 9) * 0.26;
    const ring = (u, r) => {
      const c = bezP(u * len);
      // 軸に垂直な 2 方向（おおむね x と、軸と x に垂直な向き）
      const t = [0, 1, 2].map((k) => bezP(Math.min(1, u * len + 0.02))[k] - bezP(Math.max(0, u * len - 0.02))[k]);
      const tl = Math.hypot(...t);
      const tn = t.map((v) => v / tl);
      const e1 = [1, 0, 0];
      const e2 = [tn[1] * e1[2] - tn[2] * e1[1], tn[2] * e1[0] - tn[0] * e1[2], tn[0] * e1[1] - tn[1] * e1[0]];
      return [c[0] + (Math.cos(f) * e1[0] + Math.sin(f) * e2[0]) * r, c[1] + (Math.cos(f) * e1[1] + Math.sin(f) * e2[1]) * r, c[2] + (Math.cos(f) * e1[2] + Math.sin(f) * e2[2]) * r];
    };
    const tw = (hash(i + 4) - 0.5) * 1.2;
    locks.push({
      p: [ring(0.02, rad(0.02) * 0.7), ring(0.42, rad(0.42 * len) * 1.02), ring(1, rad(0.95) + 0.004 + hash(i + 2) * 0.01)],
      w: 0.019 + hash(i + 13) * 0.006, t: 0.006, twist: tw, taper: 0.62,
      o: (u, c) => { const q = bezP(Math.min(1, u * len)); return q; },
    });
  }
  const strands = sweepStrands(locks, { along: 16, around: 9 });
  const m = mergeMeshes([coreM, strands]);
  // extra = 付け根からの長さ（0..1、揺れの大きさ）
  const ex = new Float32Array(m.count);
  for (let v = 0; v < m.count; v++) {
    const y = m.pos[v * 3 + 1], z = m.pos[v * 3 + 2];
    ex[v] = Math.min(1, Math.hypot(y, z) / 0.26);
  }
  m.extra = ex;
  return { mesh: m, base: [bx, by, bz] };
}

// 手ぬぐいの鉢巻き: 髪の殻の外を一周する帯（前は高く、後ろは低く）＋ 左うしろの結び目と端
const BAND = { n: [0, 0.9037, -0.4281], c: 0.0468, hw: 0.0132 };
function bandSDF() {
  const shell = ellipsoid(SHELL.c, SHELL.r);
  const plane = (x, y, z) => BAND.n[1] * y + BAND.n[2] * z - BAND.c;
  const ring = (x, y, z) => Math.max(Math.abs(shell(x, y, z) - 0.0042) - 0.0024, Math.abs(plane(x, y, z)) - BAND.hw);
  // 結び目: 帯の上の、左うしろの点
  const th = Math.PI - 0.62, dx = Math.sin(th), dz = Math.cos(th);
  let lo = 0, hi = 0.2, K = [0, 0, 0];
  for (let i = 0; i < 40; i++) {
    const m = (lo + hi) / 2, z = SHELL.c[2] + dz * m, y = (BAND.c - BAND.n[2] * z) / BAND.n[1];
    if (shell(dx * m, y, z) < 0.006) lo = m; else hi = m;
    K = [dx * m, y, z];
  }
  const out = [dx, 0.1, dz - 0.05].map((v, i, a) => v / Math.hypot(...a));
  const knot = ellipsoid(add(K, out, 0.004), [0.0115, 0.0105, 0.0105], [0, th, 0.3]);
  const tail = (dir, len, w) => {
    const a = add(K, out, 0.006), b = add(a, dir, len);
    const cap = capsule(a, b, w, w * 0.85);
    const dl = Math.hypot(...dir), tn = dir.map((v) => v / dl);
    // 帯の面の向き: 外向きから接線の成分を抜く
    const k = out[0] * tn[0] + out[1] * tn[1] + out[2] * tn[2];
    const nn = [out[0] - tn[0] * k, out[1] - tn[1] * k, out[2] - tn[2] * k], nl = Math.hypot(...nn);
    const n = nn.map((v) => v / nl);
    return (x, y, z) => Math.max(cap(x, y, z), Math.abs((x - a[0]) * n[0] + (y - a[1]) * n[1] + (z - a[2]) * n[2]) - 0.0017);
  };
  const t1 = tail([out[0] * 0.3 + 0.15, -0.95, out[2] * 0.3 - 0.1], 0.058, 0.0105);
  const t2 = tail([out[0] * 0.5 - 0.25, -0.8, out[2] * 0.5 + 0.05], 0.046, 0.0095);
  return (x, y, z) => {
    let d = ring(x, y, z);
    d = smin(d, knot(x, y, z), 0.004);
    return Math.min(d, t1(x, y, z), t2(x, y, z));
  };
}
// ポニーテールのゴム（付け根）
function tieSDF() {
  const a = Math.atan2(PONY.dir[2], PONY.dir[1]);
  return torus([0, 0.004, -0.009], 0.0175, 0.0058, [a, 0, 0]);
}

// ---------- 服 ----------
function teeSDF(P) {
  const torso = (x, y, z) => {
    let d = smin(P.pelvis(x, y, z), P.waist(x, y, z), 0.08);
    d = smin(d, P.belly(x, y, z), 0.06);
    d = smin(d, P.chest(x, y, z), 0.08);
    d = smin(d, P.bustL(x, y, z), 0.05);
    d = smin(d, P.bustR(x, y, z), 0.05);
    d = smin(d, P.shoulders(x, y, z), 0.06);
    return smin(d, P.traps(x, y, z), 0.05);
  };
  // 胸の下は布がまっすぐ落ちる
  const drape = ellipsoid([0, 1.07, 0.028], [0.118, 0.085, 0.078]);
  const collarCut = ellipsoid([0, 1.35, 0.018], [0.056, 0.06, 0.05], [0.4, 0, 0]);
  const collar = torus([0, 1.316, 0.02], 0.054, 0.0056, [0.4, 0, 0]);
  const sleeves = ['L', 'R'].map((s) => {
    const j = J[s], x = s === 'L' ? 1 : -1;
    const d = [Math.sin(RIG.aUp) * x, -Math.cos(RIG.aUp), 0];
    const arm = P['upperArm' + s], del = P['deltoid' + s];
    const LEN = 0.125;
    // まくった袖口の輪
    const cc = add(j.sh, d, LEN + 0.004);
    const roll = torus(cc, 0.0425, 0.0068, [0, 0, x * RIG.aUp]);
    return (px, py, pz) => {
      const t = ((px - j.sh[0]) * d[0] + (py - j.sh[1]) * d[1]) / LEN;
      let v = smin(arm(px, py, pz), del(px, py, pz), 0.035) - 0.0062 - 0.0045 * sstep(0.2, 1, t);
      v += 0.001 * Math.sin(t * 9 + pz * 70);
      v = smax(v, t - 1, 0.003);
      return smin(v, roll(px, py, pz), 0.004);
    };
  });
  const f = (x, y, z) => {
    const th = Math.atan2(x, z);
    let off = 0.0085 + 0.004 * sstep(1.1, 0.98, y);
    off += 0.0014 * sstep(1.05, 0.96, y) * Math.sin(th * 6 + y * 50); // 腰のしわ
    let d = smin(torso(x, y, z), drape(x, y, z), 0.04) - off;
    d = smin(d, sleeves[0](x, y, z), 0.022);
    d = smin(d, sleeves[1](x, y, z), 0.022);
    d = smax(d, 0.945 - y, 0.004); // パンツの中に入れる
    d = smax(d, -collarCut(x, y, z), 0.01);
    d = smin(d, collar(x, y, z), 0.006);
    return d;
  };
  return { f, torso, sleeves, collar };
}

function pantsSDF(P) {
  const pel = (x, y, z) => {
    let d = smin(P.pelvis(x, y, z), P.buttL(x, y, z), 0.04);
    d = smin(d, P.buttR(x, y, z), 0.04);
    return smin(d, P.waist(x, y, z), 0.06);
  };
  const legs = ['L', 'R'].map((s) => {
    const th = P['thigh' + s], kn = P['knee' + s], ca = P['calf' + s], sh = P['shin' + s];
    const x0 = J[s].hip[0];
    return (x, y, z) => {
      let d = smin(th(x, y, z), kn(x, y, z), 0.035);
      d = smin(d, ca(x, y, z), 0.05);
      d = smin(d, sh(x, y, z), 0.035);
      return d - (0.0085 + 0.004 * sstep(0.5, 0.2, y)) - 0.0012 * Math.sin(Math.atan2(x - x0, z) * 5 + y * 45);
    };
  });
  // すその折り返し
  const cuffs = ['L', 'R'].map((s) => torus([J[s].kn[0], 0.142, -0.0045], 0.0445, 0.0062, [0.05, 0, 0]));
  const band = (x, y, z) => Math.max(pel(x, y, z) - 0.0135, Math.abs(y - 0.978) - 0.013);
  return (x, y, z) => {
    let d = pel(x, y, z) - 0.0105;
    d = smin(d, legs[0](x, y, z), 0.035);
    d = Math.min(d, smin(pel(x, y, z) - 0.0105, legs[1](x, y, z), 0.035));
    d = smax(d, y - 0.99, 0.003);
    d = smax(d, 0.137 - y, 0.003);
    d = smin(d, band(x, y, z), 0.003);
    for (const c of cuffs) d = smin(d, c(x, y, z), 0.004);
    return d;
  };
}

// 前掛け: 腰から膝下まで、体の前を包む厚手の布。上の縁は腰ひもでしめる
const ell2 = (x, z, rx, rz) => {
  const a = x / rx, b = z / rz;
  const k0 = Math.sqrt(a * a + b * b), k1 = Math.sqrt((a * a) / (rx * rx) + (b * b) / (rz * rz));
  return k1 > 1e-9 ? (k0 * (k0 - 1)) / k1 : -Math.min(rx, rz);
};
export const APRON = { top: 0.986, hem: 0.43 };
// 前掛けの布の面（楕円の筒の前半分）: 負 = 内側。すそへ少し広がり、縦のひだ
function apronSurface(x, y, z) {
  const t = sstep(0.986, 0.92, y), b = sstep(0.8, APRON.hem, y);
  const rx = mix(0.128, 0.19, t) + b * 0.02, rz = mix(0.1, 0.142, t) + b * 0.02, cz = mix(0.0, -0.01, t);
  const fold = sstep(0.9, 0.5, y) * (0.0042 * Math.sin(x * 48 + 0.8) + 0.0022 * Math.sin(x * 97 - 1.1)) + 0.0015 * Math.sin(x * 23 - 1.3);
  return ell2(x, z - cz, rx, rz) + fold;
}
function apronSDF() {
  // 布は 1 枚の面（切り口の面は捨てて、裏は両面描画で見せる）
  const sheet = (x, y, z) => {
    let d = apronSurface(x, y, z);
    // 両脇の縁は少し内へ巻く
    d = smax(d, 0.022 - z - Math.max(0, 0.6 - y) * 0.02, 0.002);
    d = smax(d, y - APRON.top, 0.002);
    d = smax(d, APRON.hem - y + 0.004 * Math.sin(x * 30), 0.002);
    return d;
  };
  // 腰ひも（前は前掛けの上、後ろは体にそう）
  const strap = (x, y, z) => {
    const rz = z > 0 ? 0.1035 : 0.0935;
    return Math.max(Math.abs(ell2(x, z, 0.1245, rz)) - 0.0026, Math.abs(y - 0.979) - 0.0085);
  };
  // 後ろの蝶結び（+z が外 = 体の後ろ向き）
  const bz = -0.096, by = 0.979;
  const loopL = ellipsoid([0.03, 0.004, 0.012], [0.03, 0.015, 0.007], [0, 0.3, 0.15]);
  const loopLi = ellipsoid([0.03, 0.004, 0.013], [0.02, 0.0065, 0.02], [0, 0.3, 0.15]);
  const loopR = ellipsoid([-0.03, 0.004, 0.012], [0.03, 0.015, 0.007], [0, -0.3, -0.15]);
  const loopRi = ellipsoid([-0.03, 0.004, 0.013], [0.02, 0.0065, 0.02], [0, -0.3, -0.15]);
  const knot = ellipsoid([0, 0.002, 0.01], [0.011, 0.013, 0.008]);
  const tail = (s) => {
    const a = capsule([s * 0.005, -0.004, 0.01], [s * 0.022, -0.075, 0.013], 0.0075, 0.0068);
    return (x, y, z) => Math.max(a(x, y, z), Math.abs(z - mix(0.01, 0.013, -y / 0.075)) - 0.0022);
  };
  const tl = tail(1), tr = tail(-1);
  const bow = (x, y, z) => {
    let d = smax(loopL(x, y, z), -loopLi(x, y, z), 0.002);
    d = Math.min(d, smax(loopR(x, y, z), -loopRi(x, y, z), 0.002));
    d = smin(d, knot(x, y, z), 0.004);
    return Math.min(d, tl(x, y, z), tr(x, y, z));
  };
  const ties = (x, y, z) => Math.min(strap(x, y, z), bow(-x, y - by, -(z - bz)));
  return { f: (x, y, z) => Math.min(sheet(x, y, z), ties(x, y, z)), ties };
}

// ---------- 部品ごとのメッシュ ----------
let cache = null;
function common() {
  if (cache) return cache;
  const P = bodyParts(J, S);
  const W = weightParts(P, J);
  const torso = bounded(torsoSDF(P), [-0.2, 0.72, -0.14, 0.2, 1.36, 0.13]);
  const legL = bounded(legSDF(P, 'L'), [-0.01, 0.02, -0.1, 0.19, 0.92, 0.1]);
  const legR = bounded(legSDF(P, 'R'), [-0.19, 0.02, -0.1, 0.01, 0.92, 0.1]);
  const armL = bounded(armSDF(P, 'L'), [0.08, 0.72, -0.09, 0.36, 1.36, 0.08]);
  const armR = bounded(armSDF(P, 'R'), [-0.36, 0.72, -0.09, -0.08, 1.36, 0.08]);
  const body = (x, y, z) => {
    let d = smin(torso(x, y, z), P.neck(x, y, z), 0.04);
    d = smin(d, armL(x, y, z), 0.026);
    d = smin(d, armR(x, y, z), 0.026);
    d = smin(d, legL(x, y, z), 0.035);
    return smin(d, legR(x, y, z), 0.035);
  };
  const headF = headSDF();
  cache = { P, W, body, tee: teeSDF(P), pants: pantsSDF(P), apron: apronSDF(), headF, hair: hairShape(headF) };
  return cache;
}

export const HAND = { palm: [0.0118, 0.041, 0.034], fr: 0.0074, len: 1.0, curl: 0.4 };

export const PART_GROUPS = [['body'], ['tee', 'hand', 'handPoint', 'handFist'], ['pants', 'shoe'], ['apron', 'band', 'tie'], ['head'], ['hair'], ['pony']];

export function buildPart(name) {
  const C = common();
  switch (name) {
    case 'body': {
      const skin = lin(SKIN_HEX), knee = lin('#eaa790'), elbow = lin('#eaae94');
      const m = meshSDF(C.body, [-0.37, 0.05, -0.16, 0.37, 1.47, 0.17], 0.0055, {
        cull: (x, y, z) => C.tee.f(x, y, z) < -0.008 || C.pants(x, y, z) < -0.008 || y < 0.075,
      });
      return attach(m, {
        W: C.W,
        color: (x, y, z, nx, ny, nz, o) => {
          setC(o, skin);
          // ひじ・くるぶしの赤み
          const el = Math.exp(-((Math.hypot(Math.abs(x) - Math.abs(J.L.el[0]), y - J.L.el[1]) / 0.03) ** 2)) * Math.max(0, -nz) * 0.5;
          lerpC(o, skin, elbow, el);
          const an = Math.exp(-(((y - 0.09) / 0.02) ** 2)) * 0.35;
          if (an > 0.01) lerpC(o, [o[0], o[1], o[2]], knee, an);
        },
      });
    }
    case 'tee': {
      // extra = ボーダーの縞の座標（胴は高さ、袖は腕に沿った長さ）
      const T = C.tee;
      const white = lin('#f3f1ea'), rib = lin('#e4e1d8');
      return attach(meshSDF(T.f, [-0.3, 0.9, -0.14, 0.3, 1.39, 0.15], 0.0052), {
        W: C.W,
        color: (x, y, z, nx, ny, nz, o) => setC(o, T.collar(x, y, z) < 0.004 ? rib : white),
        extra: (x, y, z) => {
          const tor = T.torso(x, y, z);
          for (const s of ['L', 'R']) {
            const j = J[s], sx = s === 'L' ? 1 : -1;
            if (sx * x > 0.1 && T.sleeves[s === 'L' ? 0 : 1](x, y, z) < tor - 0.004) {
              // 袖は腕に沿った長さ（肩の縫い目で胴の縞とだいたいつながる）
              const d = [Math.sin(RIG.aUp) * sx, -Math.cos(RIG.aUp)];
              return j.sh[1] + 0.01 - ((x - j.sh[0]) * d[0] + (y - j.sh[1]) * d[1]);
            }
          }
          return y;
        },
        // extra2 = 縞の濃さ（襟のリブは無地）
        extra2: (x, y, z) => sstep(0.0035, 0.0075, T.collar(x, y, z)),
      });
    }
    case 'pants': {
      const black = lin('#1e1f24'), seam = lin('#2b2c33');
      return attach(meshSDF(C.pants, [-0.2, 0.12, -0.15, 0.2, 1.01, 0.14], 0.0058), {
        W: C.W,
        color: (x, y, z, nx, ny, nz, o) => {
          setC(o, black);
          if (Math.abs(nx) > 0.8 && y < 0.9) setC(o, seam); // 脇の縫い目
          if (y > 0.965) for (let k = 0; k < 3; k++) o[k] *= 1.15;
        },
      });
    }
    case 'apron': {
      const navy = lin('#1d2a48');
      // 切り口（布の面より内側の点）の三角形は捨てる。ひも・結び目は残す
      return attach(meshSDF(C.apron.f, [-0.21, 0.4, -0.15, 0.21, 1.0, 0.16], 0.004, {
        cull: (x, y, z) => C.apron.ties(x, y, z) > 0.0012 && apronSurface(x, y, z) < -0.0025,
      }), {
        weightFn: skirtWeights(C.W, J, { top: 0.93, bottom: 0.55, thigh: 0.9 }),
        color: (x, y, z, nx, ny, nz, o) => {
          setC(o, navy);
          // ひもと結び目は少し明るい
          if (Math.abs(y - 0.979) < 0.009 || z < 0) for (let k = 0; k < 3; k++) o[k] *= 1.25;
        },
      });
    }
    case 'shoe': return attach(meshSDF(sneakerSDF(J.L.an[1], 0.98, 0.95), [-0.055, -0.09, -0.09, 0.055, 0.02, 0.2], 0.0039), {
      color: sneakerColor(J.L.an[1], 0.98),
      extra: (x, y, z) => sstep(J.L.toe[2] - J.L.an[2] - 0.02, J.L.toe[2] - J.L.an[2] + 0.015, z),
    });
    case 'hand': return meshSDF(handSDF(HAND), [-0.05, -0.19, -0.06, 0.04, 0.045, 0.07], 0.0027);
    case 'handPoint': return meshSDF(handSDF({ ...HAND, pose: 'point' }), [-0.06, -0.19, -0.06, 0.04, 0.045, 0.07], 0.0027);
    case 'handFist': return meshSDF(handSDF({ ...HAND, pose: 'fist' }), [-0.07, -0.16, -0.06, 0.04, 0.045, 0.07], 0.0027);
    case 'head': return meshSDF(C.headF, [-0.11, -0.12, -0.13, 0.11, 0.12, 0.12], 0.0026, { cull: (x, y, z) => C.hair.sdf(x, y, z) < -0.005 });
    case 'hair': {
      const shell = meshSDF(C.hair.sdf, [-0.11, -0.1, -0.14, 0.11, 0.13, 0.11], 0.003);
      // 殻の毛の流れ: ポニーテールの付け根へ集まる（前は後ろへ、えり足は上へ）
      flowDir(shell, (x, y, z) => [PONY.base[0] - x, PONY.base[1] - y, PONY.base[2] - z]);
      return mergeMeshes([shell, sweepStrands(C.hair.locks, { along: 12, around: 9 })]);
    }
    case 'pony': return ponytail().mesh;
    case 'band': return attach(meshSDF(bandSDF(), [-0.11, -0.08, -0.14, 0.11, 0.13, 0.11], 0.0026), {});
    case 'tie': return meshSDF(tieSDF(), [-0.03, -0.03, -0.035, 0.03, 0.035, 0.02], 0.0012);
  }
  throw new Error('unknown part ' + name);
}
export { B };
