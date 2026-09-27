// 吉山水産研究所の所長・磯貝博士（50 歳くらい）の形（three.js に依存しない）
// 白衣（前を開けて、胸ポケットにペン）、水色のシャツにえんじのネクタイ、グレーのスラックス、茶の革靴。
// ごま塩の髪をオールバック気味に、口ひげ、丸メガネ（メガネとペンは model.js で three.js の形として付ける）。
import { meshSDF, bounded } from '../kid/sdf.js';
import {
  makeRig, bodyParts, legSDF, armSDF, torsoSDF, weightParts, weightsAt, skirtWeights, attach, lin, setC, lerpC, handSDF,
  headPoint, hash, capsule, ellipsoid, roundBox, torus, smin, smax, sstep, mix, add, B, loftFace,
} from './human.js';
import { leatherSDF, leatherColor } from './shoes.js';
import { sweepStrands, mergeMeshes, flowDir } from './strands.js';

export const RIG = makeRig({
  ankleY: 0.09, kneeY: 0.485, kneeX: 0.09, hipY: 0.87, hipX: 0.09, toeZ: 0.125,
  hips: 0.925, spine: 1.055, chest: 1.215, neck: 1.43, head: 1.505,
  sh: [0.183, 1.385, -0.028], ua: 0.298, fa: 0.256, aUp: 0.28, aLo: 0.32,
});
const J = RIG.J;
export const HEAD_C = [0, 1.597, 0.014];
export const HEAD_SCALE = 1.07;

export const FACE = {
  R: 0.094, W: 0.16, Y0: -0.108, Y1: 0.05, PX: 768,
  eye: { x: 0.0335, y: -0.0135, w: 0.0129, h: 0.0121 },
  browY: 0.0085, noseY: -0.042, mouthY: -0.0705,
};
export const SKIN_HEX = '#dca684';
export const HAIR_HEX = '#36312d';

const S = {
  pelvis: { c: [0, 0.925, -0.004], r: [0.143, 0.1, 0.1] },
  butt: { x: 0.064, y: 0.878, z: -0.048, r: [0.074, 0.08, 0.068] },
  belly: { c: [0, 1.02, 0.03], r: [0.146, 0.115, 0.118] },
  waist: { c: [0, 1.075, 0.0], r: [0.134, 0.1, 0.1] },
  chest: { c: [0, 1.25, -0.01], r: [0.15, 0.14, 0.103] },
  pecs: { x: 0.058, y: 1.265, z: 0.05, r: [0.068, 0.052, 0.048] },
  shoulders: { x: 0.148, y: 1.39, z: -0.03, r: 0.055 },
  neck: { y0: 1.36, z0: -0.03, y1: 1.55, z1: -0.006, r0: 0.052, r1: 0.047 },
  deltoid: [0.05, 0.066, 0.053],
  upperArm: [0.043, 0.035], forearm: [0.038, 0.027], brachio: [0.032, 0.06, 0.032],
  thigh: [0.092, 0.06], knee: [0.05, 0.054, 0.046], calf: { dy: 0.13, r: [0.05, 0.1, 0.053] },
  shin: [0.052, 0.034], foot: [0.038, 0.03],
};

// ---------- 頭 ----------
function headSDF() {
  // 頭蓋 + 高さごとの幅と奥行きで作る顔（50 代: ほおからあごにかけて少し肉づきがよく、四角いあご）
  const cranium = ellipsoid([0, 0.018, -0.018], [0.088, 0.1, 0.104]);
  const face = loftFace([
    [0.04, 0.079, 0.088, -0.035],
    [0.005, 0.078, 0.096, -0.035],
    [-0.014, 0.076, 0.095, -0.035],
    [-0.04, 0.073, 0.093, -0.033],
    [-0.06, 0.068, 0.09, -0.028],
    [-0.078, 0.06, 0.087, -0.016],
    [-0.095, 0.045, 0.083, 0.004],
    [-0.107, 0.027, 0.077, 0.028],
    [-0.114, 0.012, 0.07, 0.048],
  ], -0.035, { round: 0.009 });
  const cheekL = ellipsoid([0.042, -0.04, 0.066], [0.024, 0.022, 0.024]);
  const cheekR = ellipsoid([-0.042, -0.04, 0.066], [0.024, 0.022, 0.024]);
  const brow = capsule([-0.034, 0.004, 0.088], [0.034, 0.004, 0.088], 0.008); // 眉の骨
  const bridge = capsule([0, -0.006, 0.094], [0, -0.038, 0.106], 0.0052, 0.0064);
  const tip = ellipsoid([0, -0.041, 0.1045], [0.0105, 0.009, 0.0092]);
  const wings = [1, -1].map((s) => ellipsoid([s * 0.0102, -0.046, 0.097], [0.0062, 0.0054, 0.0058]));
  const lip = ellipsoid([0, -0.075, 0.086], [0.017, 0.005, 0.006]);
  const ears = [1, -1].map((s) => ({
    outer: ellipsoid([s * 0.085, -0.024, -0.012], [0.014, 0.027, 0.019], [0, s * 0.3, s * 0.1]),
    inner: ellipsoid([s * 0.094, -0.025, -0.009], [0.007, 0.018, 0.011], [0, s * 0.3, s * 0.1]),
  }));
  return (x, y, z) => {
    let d = smin(cranium(x, y, z), face(x, y, z), 0.035);
    d = smin(d, cheekL(x, y, z), 0.022);
    d = smin(d, cheekR(x, y, z), 0.022);
    d = smin(d, brow(x, y, z), 0.02);
    d = smin(d, bridge(x, y, z), 0.014);
    d = smin(d, tip(x, y, z), 0.01);
    for (const w of wings) d = smin(d, w(x, y, z), 0.006);
    d = smin(d, lip(x, y, z), 0.01);
    for (const e of ears) d = smin(d, smax(e.outer(x, y, z), -e.inner(x, y, z), 0.003), 0.009);
    return d;
  };
}

// ---------- 髪: ごま塩のオールバック気味（左で軽く分ける）、少しはねた毛 ----------
function hairShape(headF) {
  const shell = ellipsoid([0, 0.024, -0.019], [0.0965, 0.1095, 0.1125]);
  const line = (th) => {
    const a = Math.abs(th);
    if (a < 0.35) return 0.058;
    if (a < 0.8) return mix(0.058, 0.068, sstep(0.35, 0.72, a));   // 少し上がった生え際（M 字）
    if (a < 1.3) return mix(0.068, 0.012, sstep(0.8, 1.25, a));
    if (a < 1.8) return mix(0.012, 0.02, sstep(1.3, 1.6, a));      // 耳の上
    return mix(0.02, -0.078, sstep(1.8, 2.55, a));
  };
  // 生え際に近いほど殻を頭の面へ寄せて薄くする
  const sdf = (x, y, z) => {
    const ln = line(Math.atan2(x, z + 0.01));
    const e = sstep(0.03, 0.0, y - ln);
    const d = e > 0 ? mix(shell(x, y, z), headF(x, y, z) - 0.0028, e) : shell(x, y, z);
    return smax(d, ln - y, 0.006);
  };
  const pt = headPoint(headF);
  // 殻（楕円体）の上の点: 向き az（0 = 前）・仰角 el、off だけ外
  const C0 = [0, 0.024, -0.019], R0 = [0.0965, 0.1095, 0.1125];
  const sp = (az, el, off) => {
    const d = [Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)];
    return [C0[0] + d[0] * (R0[0] + off), C0[1] + d[1] * (R0[1] + off), C0[2] + d[2] * (R0[2] + off)];
  };
  const locks = [];
  const L = (a, b, c, w, t, g, twist = 0, taper) => locks.push({ p: [a, b, c], w, t, twist, g, taper });
  // 前: 生え際から上へ立ち上げ、頭の上を後ろへなでつける（前にボリューム）
  for (let i = 0; i < 12; i++) {
    const u = i / 11 * 2 - 1;
    const th = u * 0.8 + (hash(i) - 0.5) * 0.05;
    const y0 = 0.06 + Math.abs(u) * 0.01;
    const back = th >= 0 ? Math.PI - th * 0.55 : -Math.PI - th * 0.55;
    L(pt(th, y0, 1.0), sp(th * 0.9 + 0.06, 0.88 + (hash(i + 2) - 0.5) * 0.1, 0.028 + hash(i + 9) * 0.007), sp(back + (hash(i + 3) - 0.5) * 0.2, 0.75, -0.004),
      0.026 + hash(i + 4) * 0.006, 0.0052, hash(i + 8) * 0.45 + 0.08, (hash(i + 5) - 0.5) * 0.4, 0.6);
  }
  // 分け目（左 = +x）の左は横から後ろへ
  for (let i = 0; i < 4; i++) {
    const th = 0.84 + i * 0.12;
    L(pt(th, 0.072, 1.0), sp(th + 0.3, 0.72, 0.019), sp(th + 1.1, 0.3, -0.003), 0.021, 0.007, 0.45 + hash(i + 21) * 0.4, 0, 0.7);
  }
  for (const s of [-1, 1]) {
    // 横（耳の上）: 短く後ろへ。こめかみは白髪が多い
    L(pt(s * 1.2, 0.07, 1.0), sp(s * 1.5, 0.4, 0.012), sp(s * 2.1, 0.25, -0.002), 0.02, 0.006, 0.7);
    L(pt(s * 1.35, 0.03, 1.0), sp(s * 1.7, 0.12, 0.01), sp(s * 2.3, 0.05, -0.002), 0.018, 0.005, 0.65);
    // もみあげ
    L(pt(s * 1.25, 0.03, 1.0), pt(s * 1.3, 0.0, 1.07), pt(s * 1.3, -0.025, 1.04), 0.011, 0.004, 0.9);
  }
  return { sdf, locks };
}

// 口ひげ: 鼻の下から左右へ、少し下がる
function mustache(headF) {
  const locks = [];
  for (const s of [-1, 1]) for (let i = 0; i < 7; i++) {
    const u = i / 6;
    const x0 = s * (0.002 + u * 0.016);
    const surf = (x, y, out) => {
      let lo = 0.05, hi = 0.14;
      for (let k = 0; k < 30; k++) { const m = (lo + hi) / 2; if (headF(x, y, m) < 0) lo = m; else hi = m; }
      return [x, y, lo + out];
    };
    const a = surf(x0, -0.0525, 0.001), b = surf(x0 + s * 0.012, -0.058, 0.006), c = surf(x0 + s * (0.018 + u * 0.004), -0.0665 - u * 0.004, 0.003);
    locks.push({ p: [a, b, c], w: 0.0055, t: 0.0035, twist: 0, o: [0, -0.06, 0.02], g: 0.35 + hash(i + (s > 0 ? 50 : 70)) * 0.35 });
  }
  return locks;
}

// ---------- 服 ----------
const torsoOf = (P) => (x, y, z) => {
  let d = smin(P.pelvis(x, y, z), P.waist(x, y, z), 0.08);
  d = smin(d, P.belly(x, y, z), 0.07);
  d = smin(d, P.chest(x, y, z), 0.08);
  d = smin(d, P.bustL(x, y, z), 0.05);
  d = smin(d, P.bustR(x, y, z), 0.05);
  d = smin(d, P.shoulders(x, y, z), 0.06);
  return smin(d, P.traps(x, y, z), 0.05);
};

// シャツ（水色）: 長袖、襟。胴は白衣の下なので前の開きから見える所が主
function shirtSDF(P) {
  const torso = torsoOf(P);
  const sleeves = ['L', 'R'].map((s) => {
    const arm = armSDF(P, s), j = J[s];
    const cuff = torus(add(j.wr, [0, 0.03, 0]), 0.036, 0.004, [0, 0, (s === 'L' ? 1 : -1) * RIG.aLo]);
    return (x, y, z) => smin(arm(x, y, z) - 0.009, cuff(x, y, z), 0.004);
  });
  const neckRing = capsule([0, 1.39, -0.03], [0, 1.47, -0.022], 0.057);
  const collarCut = ellipsoid([0, 1.43, 0.035], [0.028, 0.06, 0.04]);
  const points = [1, -1].map((s) => {
    const a = [s * 0.012, 1.43, 0.052], b = [s * 0.05, 1.375, 0.072];
    const c = capsule(a, b, 0.016, 0.006);
    return (x, y, z) => Math.max(c(x, y, z), Math.abs((z - a[2]) - (y - a[1]) * -0.35) - 0.0042);
  });
  return (x, y, z) => {
    let d = torso(x, y, z) - 0.009;
    // 手首の少し上で切る（袖口は白衣の袖から少し出る）
    d = smin(d, smax(sleeves[0](x, y, z), (J.L.wr[1] + 0.012) - y, 0.003), 0.02);
    d = smin(d, smax(sleeves[1](x, y, z), (J.R.wr[1] + 0.012) - y, 0.003), 0.02);
    d = smax(d, 0.975 - y, 0.004);
    // 襟: 首のまわりに立ち、前はネクタイの結び目のところで開く
    const col = smax(Math.abs(neckRing(x, y, z)) - 0.0035, Math.abs(y - 1.435) - 0.022, 0.002);
    d = smin(d, smax(col, -collarCut(x, y, z), 0.002), 0.004);
    for (const p of points) d = smin(d, p(x, y, z), 0.003);
    return smax(d, y - 1.475, 0.002);
  };
}

// ネクタイ（シャツの上）
function tieSDF(P) {
  const torso = torsoOf(P);
  const knot = roundBox([0, 1.411, 0.062], [0.0095, 0.0125, 0.0055], 0.004, [-0.35, 0, 0]);
  return (x, y, z) => {
    // 幅: 結び目の下から広がり、先は尖る
    const w = mix(0.011, 0.034, sstep(1.4, 1.15, y)) * Math.min(1, (y - 1.075) / 0.035);
    const sheet = Math.abs(torso(x, y, z) - 0.0145) - 0.0028;
    let d = Math.max(sheet, Math.abs(x) - Math.max(0, w), 0.0 - z);
    d = Math.max(d, y - 1.405, 1.08 - y - Math.abs(x) * 1.2);
    return smin(d, knot(x, y, z), 0.005);
  };
}

function trousersSDF(P) {
  const pel = (x, y, z) => {
    let d = smin(P.pelvis(x, y, z), P.buttL(x, y, z), 0.04);
    d = smin(d, P.buttR(x, y, z), 0.04);
    return smin(d, smin(P.waist(x, y, z), P.belly(x, y, z), 0.06), 0.06);
  };
  const legs = ['L', 'R'].map((s) => {
    const j = J[s];
    const th = P['thigh' + s], kn = P['knee' + s];
    // ひざから下はまっすぐな筒（すそは靴の甲にかかる）
    const tube = capsule([j.kn[0], j.kn[1], 0.006], [j.an[0], 0.11, -0.004], 0.058, 0.056);
    return (x, y, z) => {
      let d = smin(th(x, y, z) - 0.016, kn(x, y, z) - 0.014, 0.04);
      d = smin(d, tube(x, y, z), 0.06);
      return d - 0.0012 * Math.sin(Math.atan2(x - j.hip[0], z) * 4 + y * 30);
    };
  });
  const belt = (x, y, z) => Math.max(pel(x, y, z) - 0.0158, Math.abs(y - 1.0) - 0.016);
  return (x, y, z) => {
    let d = pel(x, y, z) - 0.012;
    d = smin(d, legs[0](x, y, z), 0.04);
    d = Math.min(d, smin(pel(x, y, z) - 0.012, legs[1](x, y, z), 0.04));
    d = smax(d, y - 1.018, 0.003);
    d = smax(d, 0.065 - y + Math.max(0, z) * 0.35, 0.003); // すそ（前は靴の甲へ）
    return Math.min(d, belt(x, y, z));
  };
}

// 白衣: 厚みのある殻。前は大きく開き、襟（ラペル）・胸ポケット・腰のポケット・ボタン
const ell2 = (x, z, rx, rz) => {
  const a = x / rx, b = z / rz;
  const k0 = Math.sqrt(a * a + b * b), k1 = Math.sqrt((a * a) / (rx * rx) + (b * b) / (rz * rz));
  return k1 > 1e-9 ? (k0 * (k0 - 1)) / k1 : -Math.min(rx, rz);
};
export const COAT = { hem: 0.46, open: (y) => (y > 1.2 ? mix(0.064, 0.058, sstep(1.2, 1.43, y)) : y > 1.02 ? mix(0.05, 0.064, sstep(1.02, 1.2, y)) : mix(0.085, 0.05, sstep(0.5, 1.02, y))) };
function coatSDF(P) {
  const torso = torsoOf(P);
  const arms = ['L', 'R'].map((s) => {
    const arm = armSDF(P, s), j = J[s], x = s === 'L' ? 1 : -1;
    const d = [Math.sin(RIG.aUp) * x, -Math.cos(RIG.aUp), 0];
    return (px, py, pz) => {
      const t = ((px - j.sh[0]) * d[0] + (py - j.sh[1]) * d[1]);
      return arm(px, py, pz) - 0.01 - 0.007 * sstep(0.1, 0.5, t) - 0.001 * Math.sin(t * 40 + pz * 50);
    };
  });
  // 腰から下のすそ（楕円の筒が少し広がる。太ももが突き抜けない幅）
  const skirt = (x, y, z) => {
    const t = sstep(1.02, 0.78, y), b = sstep(0.78, COAT.hem, y);
    const fold = sstep(0.9, 0.5, y) * 0.003 * Math.sin(Math.atan2(x, z) * 9 + 0.7);
    return ell2(x, z + 0.008, mix(0.172, 0.222, t) + b * 0.022, mix(0.14, 0.158, t) + b * 0.022) + fold;
  };
  const solid = (x, y, z) => {
    let d = smin(torso(x, y, z) - 0.02, smax(skirt(x, y, z), y - 1.02, 0.06), 0.06);
    d = smin(d, arms[0](x, y, z), 0.03);
    d = smin(d, arms[1](x, y, z), 0.03);
    return d;
  };
  // 襟の後ろ（首のまわりに立つ）
  const neckAx = capsule([0, 1.36, -0.03], [0, 1.5, -0.012], 0.001);
  const collar = (x, y, z) => smax(Math.abs(neckAx(x, y, z) - 0.074) - 0.0085, Math.abs(y - 1.44) - 0.03, 0.004);
  const pockets = [
    { x0: 0.062, x1: 0.13, y0: 1.2, y1: 1.29 }, // 胸（左）
    { x0: 0.07, x1: 0.175, y0: 0.8, y1: 0.93 }, { x0: -0.175, x1: -0.07, y0: 0.8, y1: 0.93 },
  ];
  // 布は 1 枚の面（中身のある形を切り、切り口の面は捨てる。裏は両面描画で見せる）
  const f = (x, y, z) => {
    const s0 = solid(x, y, z);
    let d = s0;
    // 前の開き
    const w = COAT.open(y);
    const gap = Math.max(Math.abs(x) - w, -z);
    d = smax(d, -gap, 0.003);
    // 胸の襟（ラペル）: 開きの縁の外に折り返した布
    const lw = mix(0, 0.055, sstep(1.16, 1.4, y));
    if (lw > 0.002 && z > 0) {
      const lap = Math.max(Math.abs(s0 - 0.0045) - 0.0034, Math.abs(x) - (w + lw), w - 0.004 - Math.abs(x), -z, y - 1.44);
      d = Math.min(d, lap);
    }
    d = Math.min(d, smax(collar(x, y, z), -Math.max(Math.abs(x) - 0.04, -(z - 0.02)), 0.003));
    // ポケット: 表面に 2 mm の布を重ねる
    for (const p of pockets) {
      const box = Math.max(p.x0 - x, x - p.x1, p.y0 - y, y - p.y1, -z + 0.02);
      if (box < 0.01) d = Math.min(d, Math.max(Math.abs(s0 - 0.0022) - 0.0022, box));
    }
    // すそ・袖口
    d = smax(d, COAT.hem - y + Math.abs(x) * 0.04, 0.003);
    // 袖口（袖の中だけ切る。すそは切らない）
    for (const [i, s] of [[0, 'L'], [1, 'R']]) {
      const j = J[s], sx = s === 'L' ? 1 : -1;
      if (sx * x < 0.15) continue;
      const a = arms[i](x, y, z);
      if (a > Math.min(torso(x, y, z) - 0.024, skirt(x, y, z)) - 0.01) continue;
      const dd = [Math.sin(RIG.aLo) * sx, -Math.cos(RIG.aLo)];
      const t = (x - j.wr[0]) * dd[0] + (y - j.wr[1]) * dd[1];
      d = smax(d, t + 0.032, 0.003);
    }
    return d;
  };
  // 袖の中か（袖は腕の骨、すそは腰・太ももの骨で動かす）
  const sleeve = (x, y, z) => Math.min(arms[0](x, y, z), arms[1](x, y, z)) < Math.min(torso(x, y, z) - 0.02, skirt(x, y, z)) - 0.004;
  return { f, solid, sleeve };
}

// 白衣の下で見える所（前の開き・襟・袖口）。ほかは作らない
function seen(x, y, z) {
  if (z > 0 && Math.abs(x) < COAT.open(y) + 0.04) return true;
  if (y > 1.37) return true;
  for (const s of ['L', 'R']) {
    const j = J[s], sx = s === 'L' ? 1 : -1;
    if (sx * x < 0.15) continue;
    const dd = [Math.sin(RIG.aLo) * sx, -Math.cos(RIG.aLo)];
    if ((x - j.wr[0]) * dd[0] + (y - j.wr[1]) * dd[1] > -0.07) return true;
  }
  return false;
}

// ---------- 部品ごとのメッシュ ----------
let cache = null;
function common() {
  if (cache) return cache;
  const P = bodyParts(J, S);
  const W = weightParts(P, J);
  const torso = bounded(torsoSDF(P), [-0.22, 0.78, -0.15, 0.22, 1.48, 0.17]);
  const legL = bounded(legSDF(P, 'L'), [-0.01, 0.02, -0.11, 0.21, 0.98, 0.11]);
  const legR = bounded(legSDF(P, 'R'), [-0.21, 0.02, -0.11, 0.01, 0.98, 0.11]);
  const armL = bounded(armSDF(P, 'L'), [0.09, 0.76, -0.1, 0.4, 1.46, 0.09]);
  const armR = bounded(armSDF(P, 'R'), [-0.4, 0.76, -0.1, -0.09, 1.46, 0.09]);
  const body = (x, y, z) => {
    let d = smin(torso(x, y, z), P.neck(x, y, z), 0.045);
    d = smin(d, armL(x, y, z), 0.028);
    d = smin(d, armR(x, y, z), 0.028);
    d = smin(d, legL(x, y, z), 0.04);
    return smin(d, legR(x, y, z), 0.04);
  };
  const headF = headSDF();
  cache = { P, W, body, shirt: shirtSDF(P), tie: tieSDF(P), trousers: trousersSDF(P), coat: coatSDF(P), headF, hair: hairShape(headF) };
  return cache;
}

export const HAND = { palm: [0.0135, 0.046, 0.039], fr: 0.0088, len: 1.08, curl: 0.45 };

export const PART_GROUPS = [['body'], ['coat'], ['shirt', 'tie'], ['trousers', 'shoe'], ['hand', 'handPoint', 'handFist'], ['head'], ['hair', 'beard']];

export function buildPart(name) {
  const C = common();
  switch (name) {
    case 'body': {
      const skin = lin(SKIN_HEX);
      // 服の下に隠れる所はほとんど捨てる（首と手首だけ残る）
      const m = meshSDF(C.body, [-0.4, 0.05, -0.17, 0.4, 1.57, 0.18], 0.0058, {
        cull: (x, y, z) => C.shirt(x, y, z) < -0.006 || C.trousers(x, y, z) < -0.006 || y < 0.1,
      });
      return attach(m, { W: C.W, color: (x, y, z, nx, ny, nz, o) => setC(o, skin) });
    }
    case 'shirt': {
      const blue = lin('#b9cfe6'), shade = lin('#a6bdd6');
      return attach(meshSDF(C.shirt, [-0.4, 0.8, -0.16, 0.4, 1.49, 0.18], 0.0036, {
        cull: (x, y, z) => !seen(x, y, z),
      }), {
        W: C.W,
        color: (x, y, z, nx, ny, nz, o) => {
          setC(o, blue);
          // 前立て（ボタンの並ぶ帯）とボタン
          if (Math.abs(x) < 0.013 && z > 0.05) setC(o, shade);
          if (Math.abs(x) < 0.004 && z > 0.05 && ((y - 1.1) / 0.075) % 1 > 0.9) setC(o, lin('#eef2f6'));
        },
      });
    }
    case 'tie': {
      const red = lin('#6d2231'), stripe = lin('#b58a4a'), dark = lin('#521826');
      return attach(meshSDF(C.tie, [-0.05, 1.05, 0.0, 0.05, 1.44, 0.2], 0.0022), {
        W: C.W,
        color: (x, y, z, nx, ny, nz, o) => {
          setC(o, red);
          const s = ((x + y) / 0.016) % 1;
          if (s > 0.82) setC(o, stripe);
          if (y > 1.395) setC(o, dark);
        },
      });
    }
    case 'trousers': {
      const gray = lin('#5c564f'), belt = lin('#2c1c14'), buckle = lin('#c9b27a');
      return attach(meshSDF(C.trousers, [-0.22, 0.05, -0.16, 0.22, 1.04, 0.19], 0.0055, { cull: (x, y, z) => y > COAT.hem + 0.06 && !seen(x, y, z) }), {
        W: C.W,
        color: (x, y, z, nx, ny, nz, o) => {
          setC(o, gray);
          // 折り目（前の中心）
          for (const s of [1, -1]) if (Math.abs(x - s * 0.09) < 0.003 && z > 0.03 && y < 0.8) for (let k = 0; k < 3; k++) o[k] *= 1.18;
          if (Math.abs(y - 1.0) < 0.016) {
            setC(o, belt);
            if (Math.abs(x) < 0.022 && z > 0.06) setC(o, buckle);
          }
        },
      });
    }
    case 'coat': {
      const white = lin('#f3f4f1'), inner = lin('#e1e3de'), stitch = lin('#d9dbd6');
      const Cf = C.coat;
      return attach(meshSDF(Cf.f, [-0.43, 0.43, -0.2, 0.43, 1.52, 0.22], 0.0052, {
        cull: (x, y, z) => Cf.solid(x, y, z) < -0.0028,
      }), {
        weightFn: (() => {
          const sk = skirtWeights(C.W, J, { top: 0.98, bottom: 0.55, thigh: 0.8 });
          return (x, y, z, out) => (Cf.sleeve(x, y, z) ? weightsAt(C.W, x, y, z, out) : sk(x, y, z, out));
        })(),
        color: (x, y, z, nx, ny, nz, o) => {
          // 内側（体に向いた面）は少し暗い
          setC(o, white);
          // ステッチ: すその少し上
          if (Math.abs(y - (COAT.hem + 0.022 - Math.abs(x) * 0.04)) < 0.0018) setC(o, stitch);
        },
      });
    }
    case 'shoe': return attach(meshSDF(leatherSDF(J.L.an[1], 1.05, 1.02), [-0.06, -0.095, -0.1, 0.06, 0.02, 0.21], 0.004), {
      color: leatherColor(J.L.an[1], 1.05),
      extra: (x, y, z) => sstep(J.L.toe[2] - J.L.an[2] - 0.02, J.L.toe[2] - J.L.an[2] + 0.015, z),
    });
    case 'hand': return meshSDF(handSDF(HAND), [-0.06, -0.21, -0.07, 0.045, 0.05, 0.08], 0.003);
    case 'handPoint': return meshSDF(handSDF({ ...HAND, pose: 'point' }), [-0.07, -0.21, -0.07, 0.045, 0.05, 0.08], 0.003);
    case 'handFist': return meshSDF(handSDF({ ...HAND, pose: 'fist' }), [-0.08, -0.18, -0.07, 0.045, 0.05, 0.08], 0.003);
    case 'head': return meshSDF(C.headF, [-0.12, -0.135, -0.14, 0.12, 0.13, 0.13], 0.0027, { cull: (x, y, z) => C.hair.sdf(x, y, z) < -0.005 });
    case 'hair': {
      const dark = lin(HAIR_HEX), gray = lin('#a8a29a');
      const shell = meshSDF(C.hair.sdf, [-0.115, -0.1, -0.145, 0.115, 0.14, 0.11], 0.0031);
      flowDir(shell, (x, y, z) => [0.15 * Math.sign(x), 0.2 * (y > 0.06 ? 1 : -0.3), -1]);
      // 白髪の混じり方: こめかみ・横が多い
      attach(shell, {
        color: (x, y, z, nx, ny, nz, o) => {
          const side = sstep(0.04, 0.085, Math.abs(x)) * sstep(0.09, 0.02, y);
          lerpC(o, dark, gray, 0.22 + side * 0.5 + (hash(Math.floor(x * 300) + Math.floor(y * 300) * 7) - 0.5) * 0.12);
        },
      });
      const lk = sweepStrands(C.hair.locks, { along: 12, around: 9 });
      // 房ごとの白髪の量（g）
      const col = new Float32Array(lk.count * 3), per = lk.count / C.hair.locks.length;
      C.hair.locks.forEach((l, i) => { for (let v = i * per; v < (i + 1) * per; v++) { const c = [0, 0, 0]; lerpC(c, dark, gray, l.g); col.set(c, v * 3); } });
      lk.color = col;
      return mergeMeshes([shell, lk]);
    }
    case 'beard': {
      const dark = lin('#3b3632'), gray = lin('#a9a39b');
      const locks = mustache(C.headF);
      const m = sweepStrands(locks, { along: 8, around: 7 });
      const col = new Float32Array(m.count * 3), per = m.count / locks.length;
      locks.forEach((l, i) => { for (let v = i * per; v < (i + 1) * per; v++) { const c = [0, 0, 0]; lerpC(c, dark, gray, l.g); col.set(c, v * 3); } });
      m.color = col;
      return m;
    }
  }
  throw new Error('unknown part ' + name);
}
export { B, weightsAt };
