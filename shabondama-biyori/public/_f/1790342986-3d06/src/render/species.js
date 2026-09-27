// 生き物の形と動き：実物の大きさ（m）で組み、頂点シェーダの animate() で部位を動かす
// 体の座標：+z が前、+y が上。aPart.x の部位番号：0 胴 1 頭 2 左の翼 3 右の翼 4 尾 5 脚 6 首 7 たたんだ翼 8 目 9 耳・ひれ 10 角・胸びれ
// どの種も q（細かさ）を受け取り、近景（q=1）と遠景（q≈0.45）の2段で作る
import { MeshB, MAT } from './creatures.js';

const mix3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const hash = (x, y, z) => { const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return s - Math.floor(s); };
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const frac = (x) => x - Math.floor(x);
const sc = (c, k) => [c[0] * k, c[1] * k, c[2] * k];
const two = (a, b) => [a[0], a[1], a[2], b[0], b[1], b[2]];   // 表・裏の色
// なめらかな曲線（Catmull-Rom）：点列 pts（数の配列）から n 個
const cr = (a, b, c, d, t) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t);
function spline(pts, n) {
  const out = [], k = pts.length - 1;
  for (let i = 0; i < n; i++) {
    const s = (i / (n - 1)) * k, j = Math.min(k - 1, Math.floor(s)), t = s - j;
    const a = pts[Math.max(0, j - 1)], b = pts[j], c = pts[j + 1], d = pts[Math.min(k, j + 2)];
    out.push(b.map((_, e) => cr(a[e], b[e], c[e], d[e], t)));
  }
  return out;
}
// 体の輪郭表 [z, y, rx, ry] から z での値
function profAt(arr, z) {
  if (z <= arr[0][0]) return arr[0].slice(1);
  for (let i = 1; i < arr.length; i++) if (z <= arr[i][0]) { const a = arr[i - 1], b = arr[i], t = (z - a[0]) / (b[0] - a[0]); return [lerp(a[1], b[1], t), lerp(a[2], b[2], t), lerp(a[3], b[3], t)]; }
  return arr[arr.length - 1].slice(1);
}
// 背骨の表から筒（z 順の表）
function bodyTube(m, P, nR, segs, col, part, f, kx = 1, ky = 1) {
  const rings = spline(P, nR).map(([z, y, rx, ry]) => ({ p: [0, y, z], rx: Math.max(0, rx) * kx, ry: Math.max(0, ry) * ky, f }));
  m.tube(rings, segs, col, part);
}
// 点列の筒（[x,y,z,r]）
function limb(m, pts, segs, col, part, n = 0) {
  const Q = pts.map((p) => (p.length === 4 ? [...p, p[3]] : p));
  const P = n ? spline(Q, n) : Q;
  m.tube(P.map(([x, y, z, r, r2]) => ({ p: [x, y, z], rx: Math.max(1e-4, r), ry: Math.max(1e-4, r2 || r) })), segs, col, part);
}
// 目：外向き dir の側に瞳。iris・pupil・ring（縁の色）
function eye(m, c, r, dir, iris, pupil = [0.01, 0.01, 0.012], opt = {}) {
  const dl = Math.hypot(...dir), d = dir.map((v) => v / dl);
  m.use(MAT.EYE);
  m.ellipsoid(c, [r, r, r], m.seg(10, 6), m.seg(8, 5), (v, th, p) => {
    const o = [(p[0] - c[0]) / r, (p[1] - c[1]) / r, (p[2] - c[2]) / r];
    const k = o[0] * d[0] + o[1] * d[1] + o[2] * d[2];
    if (opt.lid && o[1] > opt.lid[0]) return opt.lid[1];
    if (opt.slit) { if (k > 0.72 && Math.abs(o[1]) < 0.28) return pupil; return k > 0.2 ? iris : sc(iris, 0.5); }
    if (k > (opt.pupil ?? 0.8)) return pupil;
    if (k > 0.25) return iris;
    return opt.ring || sc(iris, 0.4);
  }, () => [opt.part ?? 8, 0, 0, 0]);
}
// 楕円体の表面の点（中心 c・半径 r・向き d）
const onEll = (c, r, d, inset = 0) => {
  const t = 1 / Math.hypot(d[0] / r[0], d[1] / r[1], d[2] / r[2]), dl = Math.hypot(...d);
  return [0, 1, 2].map((i) => c[i] + d[i] * t - (d[i] / dl) * inset);
};

// =====================================================================
// ---- 小鳥（スズメ・セキレイ）：とまる・跳ねる・ついばむ・飛ぶ ----
// iC: x=飛ぶ(0..1) y=羽ばたきの位相 z=頭の傾き（ついばみ） w=尾の上下
// iD: x=頭の左右 y=色違い（セキレイ：1=キセキレイ）
export const SMALLBIRD_ANIM = /* glsl */ `
void animate(inout vec3 p, inout vec3 n, inout vec3 col) {
  int part = int(aPart.x + 0.5);
  float fly = iC.x;
  if (part == 2 || part == 3) {
    float side = part == 2 ? 1.0 : -1.0;
    vec3 sh = vec3(0.015 * side, 0.021, 0.012);
    float tip = aPart.y;
    // 先ほど遅れてしなる。打ち上げでは翼先をたたむ
    float a = sin(iC.y - tip * 0.9) * 1.1 + 0.2;
    float upk = max(0.0, cos(iC.y));
    vec3 q = p;
    q.x = sh.x + (q.x - sh.x) * (1.0 - 0.38 * upk * tip * tip);
    q.z += 0.014 * upk * tip * tip;
    mat3 R = rotZ(a * side);
    p = rotAbout(q, sh, R); n = R * n;
    p = sh + (p - sh) * fly;
  } else if (part == 7 || part == 5) {
    p = mix(p, vec3(0.0, 0.004, -0.004), fly * (part == 5 ? 0.85 : 1.0));
  } else if (part == 1 || part == 8) {
    vec3 nk = vec3(0.0, 0.02, 0.036);
    mat3 R = rotY(iD.x) * rotX(iC.z);
    p = rotAbout(p, nk, R); n = R * n;
  } else if (part == 4) {
    vec3 tb = vec3(0.0, 0.006, -0.036);
    mat3 R = rotX(-iC.w - 0.3 * fly);
    // 飛ぶときは尾を開く
    p.x *= 1.0 + 0.5 * fly * smoothstep(-0.04, -0.08, p.z);
    p = rotAbout(p, tb, R); n = R * n;
  }
  // キセキレイ：灰色の背・黄色の腹
  if (iD.y > 0.5 && (part == 0 || part == 1)) {
    float lm = dot(col, vec3(0.33));
    if (lm < 0.08 && (n.y > -0.3 || part == 1) && !(part == 1 && n.y < -0.4 && p.z > 0.05)) col = vec3(0.2, 0.22, 0.23);
    else if (part == 0 && n.y < 0.2) col = mix(vec3(0.8, 0.64, 0.07), vec3(0.85, 0.82, 0.7), smoothstep(-0.2, 0.2, n.y));
  }
}
`;

function smallBird(o, q) {
  const m = new MeshB(q);
  const C = o.col;
  const hi = q > 0.7;
  // 胴：頭側が高い卵形。腹はふくらみ、背はやや平ら
  const P = o.body;
  m.use(MAT.FEATHER, o.streak || 0);
  bodyTube(m, P, m.seg(18, 9), m.seg(20, 9), (u, th, p) => o.bodyPaint(u, Math.sin(th), p), (u) => [0, u, 0, 0], (th) => [1, Math.sin(th) < 0 ? 1.07 : 0.95], o.plump, o.plump);
  // 頭
  const hc = o.head, hr = o.headR;
  m.use(MAT.FEATHER);
  m.ellipsoid(hc, hr, m.seg(18, 9), m.seg(14, 7), (v, th, p) => o.headPaint(Math.abs(p[0] - hc[0]), p[1] - hc[1], p[2] - hc[2]), () => [1, 0, 0, 0],
    (nx, ny, nz) => 1 - 0.06 * Math.max(0, ny) * Math.max(0, nz) + 0.03 * Math.max(0, -nz));
  // くちばし：上下の合わせ目は暗く
  const bz = hc[2] + hr[2] * 0.82, by = hc[1] - hr[1] * 0.12;
  m.use(MAT.HORN);
  const bill = [[0, by, bz - 0.002, o.billW, o.billW * 0.95], [0, by - 0.0005, bz + (o.bill - bz) * 0.45, o.billW * 0.62, o.billW * 0.6], [0, by - 0.0015, o.bill - 0.001, o.billW * 0.18, o.billW * 0.18], [0, by - 0.0025, o.bill, 0.0003, 0.0003]];
  limb(m, bill, m.seg(10, 5), (u, th) => (Math.abs(Math.sin(th)) < 0.18 ? sc(C.bill, 0.45) : C.bill), () => [1, 0, 0, 0]);
  // 目
  for (const sx of [-1, 1]) eye(m, onEll(hc, hr, [sx * 0.8, 0.28, 0.52], 0.0011), 0.0031, [sx * 0.8, 0.2, 0.55], C.iris || [0.09, 0.05, 0.03]);
  // 尾：羽の先が丸く並ぶ扇
  const tl = o.tail, nF = 6;
  m.use(MAT.FEATHER, 0, true);
  m.grid(m.seg(6, 2), m.seg(24, 6), (u, v) => {
    const w = Math.abs(2 * v - 1);
    const fe = frac(v * nF * 2);
    const Lf = 1 - 0.1 * (2 * fe - 1) ** 2 * 4 * 0.25 - (o.notch || 0) * (1 - w);
    const L = tl * Lf * (o.tailOuter ? lerp(1, o.tailOuter, w) : 1);
    const z = -0.034 - u * L;
    return [(v - 0.5) * lerp(0.014, 0.026 * (o.tailSpread || 1), u), 0.008 - u * L * 0.3 + w * 0.0015, z];
  }, (u, v) => { const c = o.tailPaint(u, v); return two(c, sc(c, 1.15)); }, () => [4, 0, 0, 0]);
  // たたんだ翼：胴の横に沿う殻。風切りの先は尾の上で重なる
  for (const sx of [-1, 1]) {
    m.use(MAT.FEATHER, 0, true);
    m.grid(m.seg(12, 5), m.seg(6, 3), (u, v) => {
      const z = lerp(0.024, -0.034 - o.wingTip, u);
      const [yc, rx, ry] = profAt(P, Math.max(z, P[0][0] + 0.004));
      const top = yc + ry * o.plump * lerp(0.62, 0.3, u), bot = yc - ry * o.plump * lerp(0.28, -0.05, u);
      const w = u < 0.62 ? 1 : 1 - ((u - 0.62) / 0.38) * 0.85;
      const mid = (top + bot) / 2;
      const y = mid + (lerp(top, bot, v) - mid) * w;
      const ryk = ry * o.plump * (y < yc ? 1.07 : 0.95);
      const t = clamp((y - yc) / Math.max(ryk, 1e-4), -0.98, 0.98);
      const x = Math.max(rx * o.plump * Math.sqrt(1 - t * t) + 0.0022, u > 0.7 ? 0.004 + (1 - u) * 0.01 : 0);
      return [sx * x, y, z];
    }, (u, v) => { const c = o.wingPaint(u, v); return two(c, sc(c, 0.7)); }, () => [7, 0, sx, 0], [sx, 0.4, 0]);
  }
  // 広げた翼（飛ぶとき）：丸みのある翼。後縁は羽の先が並ぶ
  for (const sx of [-1, 1]) {
    const S = o.span;
    m.use(MAT.FEATHER, 0, true);
    m.grid(m.seg(14, 6), m.seg(6, 3), (u, v) => {
      const x = sx * (0.014 + u * S);
      const zl = 0.017 + 0.006 * Math.sin(Math.PI * Math.min(1, u * 1.1)) - 0.006 * u - (u > 0.78 ? ((u - 0.78) / 0.22) ** 2 * 0.022 : 0);
      let c = (0.046 - 0.016 * u * u) * (u > 0.85 ? Math.sqrt(Math.max(0.05, 1 - ((u - 0.85) / 0.15) ** 2)) : 1);
      const ser = u > 0.3 ? 0.1 * (1 - Math.cos(frac(u * 9) * Math.PI * 2)) * 0.5 : 0;
      c *= 1 - ser * v;
      const z = zl - v * c;
      const y = 0.02 + 0.005 * u + Math.sin(Math.PI * v) * c * 0.12;
      return [x, y, z];
    }, (u, v) => o.spreadPaint(u, v), (u) => [sx > 0 ? 2 : 3, u, sx, 0]);
  }
  // 脚と指（止まり木を握る）
  if (hi) {
    m.use(MAT.HORN);
    for (const sx of [-1, 1]) {
      limb(m, [[sx * 0.007, -0.006, 0.002, 0.0028], [sx * 0.0075, -0.014, 0.004, 0.0021], [sx * 0.008, -0.033, 0.006, 0.0012]], 6, () => C.leg, () => [5, 0, sx, 0]);
      for (const a of [-0.45, 0, 0.45, Math.PI]) {
        const L = a === Math.PI ? 0.009 : 0.012 - Math.abs(a) * 0.004;
        const dx = Math.sin(a) * L * sx * 0.6, dz = Math.cos(a) * L;
        limb(m, [[sx * 0.008, -0.034, 0.006, 0.0011], [sx * 0.008 + dx * 0.6, -0.0355, 0.006 + dz * 0.6, 0.0009], [sx * 0.008 + dx, -0.0362, 0.006 + dz, 0.0005]], 4, () => C.leg, () => [5, 0, sx, 0]);
      }
    }
    // もものふくらみ
    m.use(MAT.FEATHER);
    for (const sx of [-1, 1]) m.ellipsoid([sx * 0.009, -0.005, 0.002], [0.0065, 0.008, 0.008], 8, 6, () => sc(C.belly, 0.85), () => [0, 0, 0, 0]);
  }
  return m.build();
}

const SPARROW = {
  body: [[-0.042, 0.009, 0.005, 0.004], [-0.031, 0.005, 0.016, 0.015], [-0.016, 0.002, 0.025, 0.026], [0.0, 0.004, 0.029, 0.031], [0.014, 0.009, 0.03, 0.031], [0.027, 0.016, 0.025, 0.025], [0.037, 0.022, 0.018, 0.018], [0.045, 0.026, 0.015, 0.015]],
  head: [0, 0.03, 0.052], headR: [0.0175, 0.017, 0.0195],
  plump: 1.05, span: 0.1, tail: 0.042, notch: 0.06, bill: 0.081, billW: 0.0058, wingTip: 0.02, streak: 2.3,
  col: { belly: [0.6, 0.57, 0.5], bill: [0.07, 0.065, 0.06], leg: [0.5, 0.38, 0.32] },
  bodyPaint: (u, up, p) => {
    let c = mix3([0.6, 0.55, 0.46], [0.4, 0.26, 0.14], sstep(-0.25, 0.45, up));
    if (up < 0 && Math.abs(p[0]) > 0.012) c = mix3(c, [0.55, 0.47, 0.36], 0.5);  // 脇のうすい茶
    if (u > 0.8 && up > 0.2) c = [0.3, 0.14, 0.07];
    return c;
  },
  headPaint: (lx, ly, lz) => {
    // 栗色の頭・白い頬に黒い斑・のどの黒
    if (ly > 0.003 - lz * 0.25) return [0.3, 0.13, 0.06];
    if (lz > 0.005 && ly < -0.006 && lx < 0.011) return [0.025, 0.022, 0.02];
    if (lz > 0.013 && ly > -0.005) return [0.03, 0.025, 0.02];
    if (lz < -0.011 && ly < -0.001) return [0.74, 0.72, 0.66];
    if (lx > 0.008) return Math.hypot(lx - 0.0165, ly + 0.002, lz + 0.001) < 0.0048 ? [0.03, 0.028, 0.025] : [0.84, 0.83, 0.78];
    return [0.62, 0.59, 0.53];
  },
  wingPaint: (u, v) => {
    // 雨覆は栗色に黒い軸斑、白い2本の帯。風切りは黒褐に栗色の縁
    if (u < 0.44) {
      if ((Math.abs(u - 0.2) < 0.016 || Math.abs(u - 0.41) < 0.016) && v > 0.45) return [0.8, 0.78, 0.72];
      return frac(v * 4 + u * 6) < 0.35 ? [0.08, 0.05, 0.03] : [0.42, 0.2, 0.08];
    }
    return frac(v * 6) < 0.3 ? [0.44, 0.27, 0.13] : [0.11, 0.075, 0.05];
  },
  spreadPaint: (u, v) => {
    const under = [0.62, 0.59, 0.53];
    if (v < 0.3) return two(u < 0.45 ? [0.4, 0.2, 0.09] : [0.3, 0.16, 0.08], under);
    if (v < 0.38 && u > 0.1 && u < 0.7) return two([0.82, 0.8, 0.74], under);
    return two(frac(u * 9) < 0.2 ? [0.4, 0.27, 0.15] : [0.13, 0.09, 0.06], sc(under, 0.85));
  },
  tailPaint: (u, v) => (frac(v * 12) < 0.18 ? [0.35, 0.24, 0.14] : [0.18, 0.12, 0.075]),
};
const WAGTAIL = {
  body: [[-0.044, 0.008, 0.005, 0.004], [-0.032, 0.005, 0.014, 0.013], [-0.016, 0.003, 0.021, 0.022], [0.0, 0.005, 0.024, 0.026], [0.014, 0.01, 0.024, 0.026], [0.027, 0.017, 0.02, 0.021], [0.037, 0.023, 0.015, 0.016], [0.045, 0.027, 0.013, 0.013]],
  head: [0, 0.031, 0.052], headR: [0.015, 0.0152, 0.0185],
  plump: 1.0, span: 0.105, tail: 0.078, tailOuter: 1.0, notch: 0.0, bill: 0.083, billW: 0.0036, wingTip: 0.022, tailSpread: 0.8,
  col: { belly: [0.88, 0.88, 0.86], bill: [0.02, 0.02, 0.02], leg: [0.05, 0.05, 0.05] },
  bodyPaint: (u, up) => {
    if (up > -0.2) return [0.035, 0.035, 0.04];
    if (u > 0.62) return [0.03, 0.03, 0.035];   // 黒い胸
    return [0.88, 0.88, 0.86];
  },
  headPaint: (lx, ly, lz) => {
    if (lz > 0.011 && ly > -0.003 && ly < 0.009) return [0.9, 0.9, 0.88];     // 白い額
    if (ly > 0.0015 && ly < 0.0065 && lx > 0.008 && lz > -0.012) return [0.9, 0.9, 0.88]; // 白い眉
    if (ly < -0.008 && lz > 0.009 && lx < 0.007) return [0.88, 0.88, 0.86];   // 白いあご
    return [0.035, 0.035, 0.04];
  },
  wingPaint: (u, v) => {
    if (u > 0.08 && u < 0.46 && v > 0.15 && v < 0.85) return [0.88, 0.88, 0.86];   // 大きな白い斑
    if (u >= 0.46 && u < 0.7 && frac(v * 4) < 0.3) return [0.82, 0.82, 0.8];     // 三列風切りの白い縁
    return [0.03, 0.03, 0.035];
  },
  spreadPaint: (u, v) => {
    if (v > 0.25 && v < 0.65 && u < 0.75) return two([0.88, 0.88, 0.86], [0.85, 0.85, 0.83]);
    return two([0.03, 0.03, 0.035], [0.5, 0.5, 0.5]);
  },
  tailPaint: (u, v) => (v < 0.17 || v > 0.83 ? [0.88, 0.88, 0.86] : [0.03, 0.03, 0.035]),
};
export const sparrowGeo = (q = 1) => smallBird(SPARROW, q);
export const wagtailGeo = (q = 1) => smallBird(WAGTAIL, q);

// =====================================================================
// ---- ツバメ：いつも飛んでいる。細く反った翼と長い燕尾 ----
// iC: x=羽ばたきの強さ（0は滑空） y=位相
export const SWALLOW_ANIM = /* glsl */ `
void animate(inout vec3 p, inout vec3 n, inout vec3 col) {
  int part = int(aPart.x + 0.5);
  if (part == 2 || part == 3) {
    float side = part == 2 ? 1.0 : -1.0;
    vec3 sh = vec3(0.012 * side, 0.004, 0.022);
    float tip = aPart.y;
    float a = sin(iC.y - tip * 0.7) * 0.95 * iC.x + 0.06;
    mat3 R = rotZ(a * side);
    // 羽ばたくときは翼を前へ振り、打ち上げで翼先を引く
    mat3 R2 = rotY(-side * (0.3 + 0.28 * sin(iC.y + 1.2) * iC.x) * tip);
    p = rotAbout(p, sh, R * R2); n = R * R2 * n;
  } else if (part == 4) {
    // 旋回で尾を開く
    p.x *= 1.0 + abs(iB.y) * 0.6 * smoothstep(-0.04, -0.09, p.z);
  }
}
`;
export function swallowGeo(q = 1) {
  const m = new MeshB(q);
  const back = [0.018, 0.025, 0.07], belly = [0.86, 0.82, 0.74], red = [0.42, 0.08, 0.04];
  const P = [[-0.046, 0.002, 0.004, 0.004], [-0.033, 0.001, 0.01, 0.01], [-0.013, 0.0, 0.0155, 0.016], [0.01, 0.001, 0.0165, 0.017], [0.03, 0.002, 0.0152, 0.0152], [0.044, 0.003, 0.0132, 0.0122], [0.054, 0.002, 0.0098, 0.009], [0.061, 0.0, 0.004, 0.0038]];
  m.use(MAT.FEATHER, -0.6);
  bodyTube(m, P, m.seg(18, 8), m.seg(16, 8), (u, th, p) => {
    const up = Math.sin(th);
    if (p[2] > 0.053 && up > -0.35 && up < 0.6) return red;          // 赤い額
    if (p[2] > 0.037 && up < -0.15) return red;                       // 赤いのど
    if (p[2] > 0.024 && up < -0.1) return back;                       // 胸の黒い帯
    return up > -0.2 ? back : belly;
  }, () => [0, 0, 0, 0], (th) => [1, Math.sin(th) > 0 ? 0.92 : 1.02]);
  m.use(MAT.HORN);
  limb(m, [[0, -0.0005, 0.058, 0.0034, 0.0022], [0, -0.0015, 0.066, 0.0003, 0.0003]], 6, () => [0.02, 0.02, 0.02], () => [1, 0, 0, 0]);
  for (const sx of [-1, 1]) eye(m, [sx * 0.0092, 0.0045, 0.049], 0.0026, [sx, 0.2, 0.4], [0.05, 0.03, 0.02]);
  // 翼：細く長く、後ろへ反る（先がとがる）
  for (const sx of [-1, 1]) {
    m.use(MAT.FEATHER, -0.5, true);
    m.grid(m.seg(16, 7), m.seg(5, 2), (u, v) => {
      const x = sx * (0.012 + u * 0.155);
      const zl = 0.024 + 0.012 * Math.sin(Math.PI * Math.min(1, u * 1.6)) * (1 - u) - 0.085 * Math.pow(u, 2.1);
      const c = 0.036 * (1 - u * 0.84) + 0.002;
      const ser = u < 0.55 ? 0.08 * (1 - Math.cos(frac(u * 12) * Math.PI * 2)) * 0.5 : 0;
      return [x, 0.004 + Math.sin(Math.PI * v) * c * 0.1, zl - v * c * (1 - ser * v)];
    }, (u, v) => two(v > 0.6 && u < 0.5 ? [0.05, 0.05, 0.08] : back, u < 0.4 && v < 0.5 ? [0.72, 0.66, 0.6] : [0.32, 0.3, 0.3]), (u) => [sx > 0 ? 2 : 3, u, sx, 0]);
  }
  // 燕尾：外側ほど長い（吹き流し）
  m.use(MAT.FEATHER, -0.4, true);
  m.grid(m.seg(10, 4), m.seg(16, 6), (u, v) => {
    const w = Math.abs(2 * v - 1);
    const L = 0.03 + 0.078 * Math.pow(w, 3.2);
    const wide = lerp(0.016, lerp(0.034, 0.05, w), u) * (w > 0.85 ? lerp(1, 0.94, u) : 1);
    return [(v - 0.5) * wide, 0.002, -0.036 - u * L];
  }, (u, v) => two(back, (u > 0.4 && u < 0.6 && Math.abs(2 * v - 1) < 0.7) ? [0.8, 0.78, 0.72] : [0.14, 0.14, 0.16]), () => [4, 0, 0, 0]);
  return m.build();
}

// =====================================================================
// ---- コサギ（とアオサギの色違い）：S字の首・黒い脚・黄色い足指。立つ・歩く・つつく・飛ぶ ----
// iC: x=飛ぶ(0..1) y=羽ばたきの位相 z=首（0=S字 1=前へ伸ばす -1=縮める） w=歩きの位相
// iD: x=歩きの強さ z=アオサギ(1)
export const EGRET_ANIM = /* glsl */ `
void animate(inout vec3 p, inout vec3 n, inout vec3 col) {
  int part = int(aPart.x + 0.5);
  float fly = iC.x;
  bool heron = iD.z > 0.5;
  if (heron) {
    // アオサギ：灰色の背と翼、白い首、黒い冠羽、黄色いくちばし
    vec3 grey = vec3(0.34, 0.36, 0.38);
    if (part == 0 || part == 7) col = n.y > -0.35 ? grey : vec3(0.7, 0.7, 0.68);
    else if (part == 4) col = grey;
    else if (part == 2 || part == 3) { col = aPart.y > 0.62 ? vec3(0.05, 0.05, 0.06) : grey; col2 = aPart.y > 0.62 ? vec3(0.08) : vec3(0.3, 0.31, 0.33); }
    else if (part == 6) col = vec3(0.76, 0.76, 0.74);
    else if (part == 1) {
      if (aPart.w > 0.5) col = vec3(0.03);
      else if (p.z > 0.158) col = vec3(0.72, 0.52, 0.16);
      else if (p.y > 0.642 && abs(p.x) > 0.006) col = vec3(0.04);
      else col = vec3(0.82, 0.82, 0.8);
    } else if (part == 5) col = vec3(0.42, 0.36, 0.22);
    else if (part == 8) col = mix(col, vec3(0.7, 0.62, 0.1), step(0.2, dot(col, vec3(0.33))));
  }
  if (part == 6 || part == 1 || part == 8) {
    // 首：根元・中ほど・頭の三つの関節で曲げる（t=首の中の位置）
    float t = part == 6 ? aPart.y : 1.0;
    float ext = iC.z;
    vec3 j0 = vec3(0.0, 0.3, 0.11);
    float a0 = mix(-0.35, 0.85, sat(ext)) - 0.9 * sat(-ext) - 0.7 * fly;
    float a1 = mix(1.35, 0.25, sat(ext)) + 1.1 * sat(-ext) + 1.2 * fly;
    float a2 = mix(-0.9, 0.35, sat(ext)) - 0.3 * fly;
    float w1 = smoothstep(0.2, 0.64, t);
    float w2 = smoothstep(0.78, 1.0, t);
    vec3 j1 = j0 + vec3(0.0, 0.16, 0.0);
    vec3 j2 = j0 + vec3(0.0, 0.3, 0.0);
    vec3 q = p;
    q = rotAbout(q, j2, rotX(a2 * w2));
    q = rotAbout(q, j1, rotX(a1 * w1));
    q = rotAbout(q, j0, rotX(a0));
    n = rotX(a0) * rotX(a1 * w1) * rotX(a2 * w2) * n;
    p = q;
  } else if (part == 2 || part == 3) {
    float side = part == 2 ? 1.0 : -1.0;
    vec3 sh = vec3(0.05 * side, 0.285, 0.05);
    float tip = aPart.y;
    float a = sin(iC.y - tip * 0.8) * 0.8 + 0.08;
    float upk = max(0.0, cos(iC.y));
    vec3 q = p;
    q.x = sh.x + (q.x - sh.x) * (1.0 - 0.22 * upk * tip * tip);
    mat3 R = rotZ(a * side * (0.75 + 0.35 * tip));
    p = rotAbout(q, sh, R); n = R * n;
    p = sh + (p - sh) * fly;
  } else if (part == 7) {
    p = mix(p, vec3(0.0, 0.27, -0.02), fly);
  } else if (part == 5) {
    // 脚：もも（腰）と、かかと（後ろへ曲がる関節）の二つで歩く。飛ぶときは後ろへ伸ばす
    float side = aPart.z;
    vec3 hip = vec3(0.03 * side, 0.235, -0.01);
    vec3 ank = vec3(0.03 * side, 0.118, 0.0);
    float ph = iC.w + (side > 0.0 ? 0.0 : 3.1416);
    float walk = iD.x * (1.0 - fly);
    float sw = sin(ph) * 0.38 * walk;
    float flex = max(0.0, -cos(ph)) * 0.75 * walk + 0.25 * fly;
    float wk = smoothstep(ank.y + 0.015, ank.y - 0.015, p.y);
    vec3 q = rotAbout(p, ank, rotX(flex * wk));
    n = rotX(flex * wk) * n;
    mat3 R = rotX(sw + 1.35 * fly);
    p = rotAbout(q, hip, R); n = R * n;
  } else if (part == 4) {
    p = mix(p, p + vec3(0.0, 0.01, -0.01), fly);
  }
}
`;
export function egretGeo(q = 1) {
  const m = new MeshB(q);
  const hi = q > 0.7;
  const W = [0.92, 0.92, 0.89], W2 = [0.84, 0.85, 0.83];
  // 胴：前が高い卵形。胸は竜骨で少しとがる
  const P = [[-0.235, 0.262, 0.005, 0.004], [-0.19, 0.266, 0.03, 0.032], [-0.12, 0.27, 0.05, 0.058], [-0.04, 0.278, 0.057, 0.07], [0.04, 0.29, 0.055, 0.07], [0.1, 0.305, 0.043, 0.056], [0.14, 0.315, 0.026, 0.032]];
  m.use(MAT.FEATHER);
  bodyTube(m, P, m.seg(20, 9), m.seg(24, 10), (u, th) => mix3(W2, W, Math.sin(th) * 0.5 + 0.5), (u) => [0, u, 0, 0], (th) => { const s = Math.sin(th); return [1 - (s < 0 ? 0.04 * s * s : 0), s < 0 ? 1.04 : 0.97]; });
  // 首：まっすぐに組み、頂点シェーダで曲げる（根元 y=0.3 → 0.62）
  const neck = [];
  const nN = m.seg(22, 10);
  for (let i = 0; i <= nN; i++) { const t = i / nN; neck.push({ p: [0, 0.3 + t * 0.32, 0.12 + 0.01 * Math.sin(t * 3)], rx: 0.016 - 0.007 * t + 0.009 * sstep(0.22, 0, t), ry: 0.019 - 0.009 * t + 0.01 * sstep(0.22, 0, t), up: [0, 0, 1] }); }
  m.tube(neck, m.seg(16, 8), () => W, (u) => [6, u, 0, 0], false, false);
  // 頭とくちばし：ひとつづきの筒。目先は黄緑の肌、くちばしは黒
  const head = [[0, 0.636, 0.106, 0.006, 0.008], [0, 0.638, 0.116, 0.0135, 0.0165], [0, 0.638, 0.13, 0.0165, 0.0185], [0, 0.636, 0.145, 0.0125, 0.0135], [0, 0.633, 0.156, 0.0082, 0.0092], [0, 0.6315, 0.166, 0.0062, 0.0078], [0, 0.628, 0.19, 0.0044, 0.0054], [0, 0.625, 0.214, 0.0025, 0.003], [0, 0.6225, 0.232, 0.0004, 0.0005]];
  m.use(MAT.FEATHER);
  limb(m, head, m.seg(14, 7), (u, th, p) => {
    if (p[2] > 0.158) return [0.035, 0.035, 0.04];
    if (p[2] > 0.143 && Math.abs(Math.sin(th)) < 0.75) return [0.72, 0.72, 0.3];
    return W;
  }, () => [1, 0, 0, 0], m.seg(22, 9));
  for (const sx of [-1, 1]) eye(m, [sx * 0.0128, 0.6405, 0.142], 0.0036, [sx, 0.1, 0.35], [0.85, 0.74, 0.12]);
  if (hi) {
    // 冠羽：うなじから垂れる2本の細い飾り羽（細い毛：遠くでは描かない）
    m.use(MAT.FEATHER, 0, true, 0.004);
    for (const sx of [-1, 1]) {
      m.grid(10, 1, (u, v) => {
        const z = 0.112 - u * 0.1, y = 0.645 - u * 0.03 - u * u * 0.03;
        return [sx * (0.002 + u * 0.004) + (v - 0.5) * 0.004 * (1 - u * 0.8), y, z];
      }, () => W, () => [1, 1, 0, 1], [0, 1, 0]);
    }
    // 蓑毛：背から尾の先まで垂れるレースのような飾り羽
    for (let k = 0; k < 18; k++) {
      const x0 = (k / 17 - 0.5) * 0.07, ph = hash(k, 3, 1), L = 0.25 + ph * 0.09;
      m.grid(12, 1, (u, v) => {
        const z = 0.0 - u * L;
        const [yc, rx, ry] = profAt(P, Math.max(z, -0.22));
        const t = clamp(x0 / Math.max(rx, 0.01), -0.9, 0.9);
        const surf = yc + ry * 0.95 * Math.sqrt(1 - t * t);
        const y = Math.max(surf, 0.262) + 0.004 + 0.012 * Math.sin(Math.PI * Math.min(1, u * 1.4)) - u * u * 0.02 + (u > 0.82 ? (u - 0.82) * 0.12 : 0);
        return [x0 * (1 + u * 0.9) + (v - 0.5) * 0.004 * (1 - u * 0.7), y, z];
      }, (u) => sc(W, 0.93 + 0.07 * u), () => [0, 0, 0, 0], [0, 1, 0]);
    }
  }
  // 尾（短い）
  m.use(MAT.FEATHER, 0, true);
  m.grid(4, 6, (u, v) => [(v - 0.5) * lerp(0.05, 0.075, u), 0.27 - u * 0.01, -0.185 - u * 0.065 * (1 - 0.1 * Math.abs(2 * v - 1))], () => W2, () => [4, 0, 0, 0]);
  // たたんだ翼：胴の横
  for (const sx of [-1, 1]) {
    m.use(MAT.FEATHER, 0, true);
    m.grid(m.seg(10, 5), m.seg(5, 2), (u, v) => {
      const z = lerp(0.09, -0.245, u);
      const [yc, rx, ry] = profAt(P, Math.max(z, -0.225));
      const top = yc + ry * lerp(0.62, 0.35, u), bot = yc - ry * lerp(0.3, -0.1, u);
      const w = u < 0.7 ? 1 : 1 - ((u - 0.7) / 0.3) * 0.8;
      const mid = (top + bot) / 2, y = mid + (lerp(top, bot, v) - mid) * w;
      const t = clamp((y - yc) / ry, -0.98, 0.98);
      return [sx * Math.max(rx * Math.sqrt(1 - t * t) + 0.003, 0.012), y, z];
    }, () => W, () => [7, 0, sx, 0], [sx, 0.3, 0]);
  }
  // 広げた翼：幅広く丸い。翼先は羽が指のように分かれる
  for (const sx of [-1, 1]) {
    m.use(MAT.FEATHER, 0, true);
    m.grid(m.seg(18, 8), m.seg(6, 3), (u, v) => {
      const x = sx * (0.05 + u * 0.43);
      const zl = 0.07 + 0.02 * Math.sin(Math.PI * Math.min(1, u * 1.3)) - 0.03 * u - (u > 0.8 ? ((u - 0.8) / 0.2) ** 2 * 0.06 : 0);
      let c = (0.19 - 0.06 * u * u) * (u > 0.82 ? Math.sqrt(Math.max(0.05, 1 - ((u - 0.82) / 0.18) ** 2)) : 1);
      const fing = u > 0.7 ? 0.3 * (1 - Math.cos(frac((u - 0.7) * 22) * Math.PI * 2)) * 0.5 * ((u - 0.7) / 0.3) : 0.06 * (1 - Math.cos(frac(u * 14) * Math.PI * 2)) * 0.5;
      c *= 1 - fing * v;
      return [x, 0.28 + 0.01 * u + Math.sin(Math.PI * v) * c * 0.1, zl - v * c];
    }, () => two(W, W2), (u) => [sx > 0 ? 2 : 3, u, sx, 0]);
  }
  // 脚（黒）：すね・かかと・ふ蹠。足指は黄色
  m.use(MAT.HORN);
  for (const sx of [-1, 1]) {
    limb(m, [[sx * 0.03, 0.245, -0.012, 0.013], [sx * 0.03, 0.2, -0.008, 0.007], [sx * 0.03, 0.14, -0.003, 0.0048], [sx * 0.03, 0.118, 0.0, 0.0056], [sx * 0.03, 0.095, 0.001, 0.0045], [sx * 0.03, 0.04, 0.003, 0.0038], [sx * 0.03, 0.012, 0.005, 0.0042]], m.seg(8, 5), (u, th, p) => (p[1] > 0.205 ? W : [0.03, 0.03, 0.035]), () => [5, 0, sx, 0]);
    for (const a of [-0.5, 0, 0.5, Math.PI]) {
      const L = a === Math.PI ? 0.028 : 0.05 - Math.abs(a) * 0.012;
      const dx = Math.sin(a) * L * 0.9, dz = Math.cos(a) * L;
      limb(m, [[sx * 0.03, 0.012, 0.005, 0.0034], [sx * 0.03 + dx * 0.5, 0.006, 0.005 + dz * 0.5, 0.0024], [sx * 0.03 + dx, 0.003, 0.005 + dz, 0.0012]], 5, () => [0.78, 0.68, 0.16], () => [5, 0, sx, 0]);
    }
  }
  return m.build();
}

// =====================================================================
// ---- 鳶：指のように分かれた翼先・浅く切れ込んだ尾。滑空しながら輪を描く ----
// iC: x=羽ばたきの強さ y=位相 z=尾のひねり（旋回）
export const KITE_ANIM = /* glsl */ `
void animate(inout vec3 p, inout vec3 n, inout vec3 col) {
  int part = int(aPart.x + 0.5);
  if (part == 2 || part == 3) {
    float side = part == 2 ? 1.0 : -1.0;
    vec3 sh = vec3(0.055 * side, 0.02, 0.05);
    float tip = aPart.y;
    // 滑空は浅い上反角で翼先がそり上がる。羽ばたきはゆっくり大きく、先が遅れる
    float a = 0.1 + sin(iC.y - tip * 0.9) * 0.5 * iC.x;
    mat3 R = rotZ(side * (a * (0.8 + 0.5 * tip) + 0.07 * tip * tip + 0.03 * sin(uTime * 1.7 + iD.y * 5.0) * tip));
    p = rotAbout(p, sh, R); n = R * n;
  } else if (part == 4) {
    // 尾：旋回でひねり、開く
    vec3 tb = vec3(0.0, 0.0, -0.19);
    float k = smoothstep(-0.19, -0.45, p.z);
    p.x *= 1.0 + 0.25 * abs(iC.z) * k;
    mat3 R = rotZ(iC.z * 0.6 * k);
    p = rotAbout(p, tb, R); n = R * n;
  }
}
`;
export function kiteGeo(q = 1) {
  const m = new MeshB(q);
  const brown = [0.19, 0.13, 0.085], dark = [0.075, 0.058, 0.045], pale = [0.36, 0.3, 0.22], head = [0.33, 0.27, 0.2], under = [0.13, 0.085, 0.055];
  const P = [[-0.22, 0.0, 0.03, 0.02], [-0.15, 0.0, 0.05, 0.045], [-0.05, 0.0, 0.07, 0.07], [0.06, 0.005, 0.068, 0.07], [0.14, 0.012, 0.05, 0.055], [0.2, 0.02, 0.041, 0.043], [0.245, 0.023, 0.031, 0.033], [0.27, 0.019, 0.012, 0.014]];
  m.use(MAT.FEATHER, 0.03);
  bodyTube(m, P, m.seg(16, 8), m.seg(16, 8), (u, th, p) => {
    const up = Math.sin(th);
    if (p[2] > 0.19) {
      if (p[2] < 0.235 && up > -0.3 && up < 0.35 && p[2] > 0.215) return [0.1, 0.07, 0.05];  // 目の後ろの黒い帯
      return head;
    }
    return up > 0 ? brown : mix3(under, [0.24, 0.15, 0.09], hash(Math.round(p[2] * 60), Math.round(p[0] * 60), 1) * 0.6);
  }, () => [0, 0, 0, 0]);
  // かぎ形のくちばし
  m.use(MAT.HORN);
  limb(m, [[0, 0.02, 0.258, 0.011, 0.012], [0, 0.021, 0.272, 0.0075, 0.009], [0, 0.016, 0.285, 0.0045, 0.0065], [0, 0.006, 0.291, 0.002, 0.0028], [0, -0.002, 0.289, 0.0005, 0.0005]], 7, (u) => (u < 0.2 ? [0.35, 0.34, 0.25] : [0.06, 0.06, 0.07]), () => [1, 0, 0, 0], 8);
  for (const sx of [-1, 1]) eye(m, [sx * 0.026, 0.031, 0.236], 0.0065, [sx, 0.1, 0.4], [0.35, 0.22, 0.08]);
  for (const sx of [-1, 1]) {
    // 翼：手首で前へ出る腕と手。先は6本の初列風切りが指のように開く。下面は焦げ茶で、手の根元に白い窓
    m.use(MAT.FEATHER, 0, true);
    const HAND = 0.6;   // 手の先（指のつけ根）までの長さ
    const zle = (u) => 0.08 + 0.06 * Math.sin(Math.PI * 0.5 * Math.min(u / 0.42, 1)) - (u > 0.42 ? (u - 0.42) * 0.16 : 0);
    const chord = (u) => (u < 0.42 ? lerp(0.32, 0.31, u / 0.42) : lerp(0.31, 0.24, (u - 0.42) / 0.58));
    m.grid(m.seg(22, 9), m.seg(7, 3), (u, v) => {
      const x = sx * (0.055 + u * HAND);
      const c = chord(u) * (1 - v * 0.05 * (1 - Math.cos(frac(u * 14) * Math.PI * 2)) * 0.5);
      const y = 0.02 + Math.sin(Math.PI * v) * c * 0.07;
      return [x, y, zle(u) - v * c];
    }, (u, v) => {
      let top = brown, bot = under;
      if (v < 0.35) top = hash(Math.round(u * 40), Math.round(v * 20), sx) > 0.5 ? brown : sc(brown, 1.2);
      if (v > 0.3 && v < 0.45 && u < 0.6) top = pale;                    // 大雨覆の淡い帯
      if (v >= 0.45 || u > 0.72) top = dark;                             // 風切り
      if (v > 0.42) bot = frac(v * 7 + u * 2) < 0.4 ? [0.08, 0.065, 0.055] : [0.15, 0.13, 0.11];   // 横縞の風切り
      if (u > 0.68 && v > 0.1 && v < 0.7) bot = frac(v * 8) < 0.25 ? [0.26, 0.23, 0.2] : [0.5, 0.46, 0.4]; // 白い窓
      return two(top, bot);
    }, (u) => [sx > 0 ? 2 : 3, u * 0.8, sx, 0]);
    // 指：手の先から扇に開く6本の羽（あいだはすき間）
    const x0 = 0.055 + HAND, c0 = chord(1), z0 = zle(1);
    for (let f = 0; f < 6; f++) {
      const t = (f + 0.5) / 6;
      const zr = z0 - t * c0 * 0.92;                  // 手の先の前縁から後ろへ並ぶ
      const ang = lerp(0.22, -0.5, t);                // 前の指ほど前向きに開く
      const L = lerp(0.2, 0.12, Math.abs(t - 0.3) * 1.6);
      const w = c0 / 6 * 1.15;
      m.grid(m.seg(6, 3), 1, (u, v) => {
        const d = u * L;
        const wd = w * (1 - u * u * 0.6) * (v - 0.5);
        return [sx * (x0 - 0.01 + Math.cos(ang) * d), 0.02 + u * u * 0.05, zr + Math.sin(ang) * d + wd];
      }, (u) => two(dark, u < 0.3 ? [0.42, 0.38, 0.33] : [0.06, 0.05, 0.045]), (u) => [sx > 0 ? 2 : 3, 0.8 + u * 0.2, sx, 0]);
    }
  }
  // 尾：浅く切れ込んだ台形。横縞
  m.use(MAT.FEATHER, 0, true);
  m.grid(m.seg(8, 3), m.seg(12, 4), (u, v) => {
    const w = Math.abs(2 * v - 1);
    const L = 0.25 - 0.035 * (1 - w) + 0.01 * w;
    return [(v - 0.5) * lerp(0.1, 0.19, u), 0.0, -0.19 - u * L];
  }, (u) => two(frac(u * 5) < 0.3 ? [0.12, 0.09, 0.06] : brown, frac(u * 5) < 0.3 ? [0.24, 0.2, 0.16] : [0.45, 0.4, 0.33]), () => [4, 0, 0, 0]);
  return m.build();
}

// =====================================================================
// ---- カルガモ：水に浮いて泳ぐ・逆立ちして餌をとる ----
// iC: x=頭の上下（位相） y=首の傾き
// iD.w=1 はひな（ducklingGeo）。シェーダを1つにまとめて読み込みを軽くする
export const DUCK_ANIM = /* glsl */ `
void animate(inout vec3 p, inout vec3 n, inout vec3 col) {
  int part = int(aPart.x + 0.5);
  if (iD.w > 0.5) {
    if (part == 1 || part == 8) {
      vec3 nk = vec3(0.0, 0.04, 0.035);
      mat3 R = rotX(iC.y + sin(iC.x * 1.3) * 0.08) * rotY(sin(iC.x * 0.37) * 0.3);
      p = rotAbout(p, nk, R); n = R * n;
    }
    return;
  }
  if (part == 1 || part == 8 || part == 6) {
    vec3 nk = vec3(0.0, 0.08, 0.13);
    float w = part == 6 ? aPart.y : 1.0;
    mat3 R = rotX(iC.y * w + sin(iC.x) * 0.06 * w);
    p = rotAbout(p, nk, R); n = R * n;
  } else if (part == 4) {
    vec3 tb = vec3(0.0, 0.07, -0.22);
    mat3 R = rotY(sin(iC.x * 0.7) * 0.12);
    p = rotAbout(p, tb, R); n = R * n;
  }
}
`;
export function duckGeo(q = 1) {
  const m = new MeshB(q);
  const body = [0.17, 0.12, 0.075], dark = [0.09, 0.065, 0.045], face = [0.62, 0.54, 0.4];
  const P = [[-0.275, 0.075, 0.006, 0.006], [-0.235, 0.064, 0.05, 0.036], [-0.17, 0.047, 0.094, 0.07], [-0.08, 0.038, 0.12, 0.088], [0.02, 0.038, 0.123, 0.092], [0.1, 0.043, 0.108, 0.086], [0.16, 0.056, 0.08, 0.076], [0.2, 0.078, 0.046, 0.05]];
  m.use(MAT.FEATHER, 0.017);
  bodyTube(m, P, m.seg(20, 9), m.seg(24, 10), (u, th, p) => {
    const up = Math.sin(th);
    let c = mix3(body, dark, 0.25 + 0.25 * hash(Math.round(p[2] * 40), Math.round(p[0] * 40), 2));
    if (up < -0.2) c = mix3(c, [0.3, 0.24, 0.17], 0.4);
    if (u < 0.16 && up < 0.3) c = [0.03, 0.025, 0.02];    // 黒い下尾筒
    if (u > 0.85) c = mix3(c, [0.36, 0.3, 0.22], 0.5);     // 胸はうすい
    return c;
  }, (u) => [0, u, 0, 0], (th) => { const s = Math.sin(th); return [1, s > 0 ? 0.9 : 1.0]; });
  // 首と頭とくちばし：1本の筒。首は根元の体の色から頭の淡い黄褐へ、頭頂の焦げ茶はうなじから背へ続く
  m.use(MAT.FEATHER);
  const NK = [[0.062, 0.118, 0.05, 0.052], [0.1, 0.136, 0.042, 0.045], [0.14, 0.149, 0.035, 0.037], [0.172, 0.155, 0.032, 0.034], [0.196, 0.161, 0.035, 0.039], [0.21, 0.175, 0.038, 0.041], [0.21, 0.19, 0.037, 0.04], [0.205, 0.203, 0.031, 0.032], [0.197, 0.217, 0.022, 0.02], [0.192, 0.23, 0.021, 0.0105], [0.188, 0.252, 0.0195, 0.0078], [0.184, 0.272, 0.017, 0.0058], [0.182, 0.285, 0.0105, 0.0038], [0.181, 0.289, 0.003, 0.002]];
  const upv = [0, 0.7071, -0.7071];   // 首から嘴まで同じ向き：横＝x、上下＝背と腹（ねじれない）
  const hr = spline(NK, m.seg(34, 14)).map(([y, z, rx, ry]) => ({ p: [0, y, z], rx, ry, up: upv }));
  m.tube(hr, m.seg(20, 10), (u, th, p) => {
    const dor = Math.sin(th);                     // +1＝首の後ろ・頭のてっぺん
    const ly = p[1] - 0.205, lz = p[2] - 0.17;
    const head = sstep(0.19, 0.205, p[1]) * sstep(0.145, 0.165, p[2]);
    // 首：根元は体の色、上は淡い黄褐
    let c = mix3(mix3(body, [0.3, 0.24, 0.17], 0.5), face, sstep(0.08, 0.17, p[1]));
    // 頭頂からうなじ・背へ続く焦げ茶
    c = mix3(c, dark, sstep(0.35, 0.85, dor) * (0.5 + 0.5 * head));
    if (head > 0.01) {
      c = mix3(c, dark, sstep(0.013, 0.02, ly + 0.007 * clamp(-lz / 0.04, 0, 1)) * head);          // 焦げ茶の頭頂
      c = mix3(c, [0.07, 0.05, 0.035], sstep(0.0075, 0.0045, Math.abs(ly - 0.002 + lz * 0.12)) * sstep(-0.045, -0.035, lz) * head);   // 目を通る黒い線
      c = mix3(c, [0.26, 0.2, 0.14], sstep(0.006, 0.0035, Math.abs(ly + 0.017 + lz * 0.1)) * sstep(-0.02, -0.01, lz) * head);         // 頬の線
    }
    // くちばし：黒、先は黄色
    const bill = sstep(0.221, 0.226, p[2]);
    const tip = sstep(0.262, 0.27, p[2]) * sstep(-0.45, -0.2, dor);
    c = mix3(c, mix3([0.035, 0.035, 0.04], [0.82, 0.64, 0.1], tip), bill);
    return c;
  }, (u, th, p) => [6, Math.max(sstep(0.075, 0.19, p[1]), sstep(0.15, 0.175, p[2])), 0, 0], true, true);
  for (const sx of [-1, 1]) eye(m, [sx * 0.0335, 0.2135, 0.19], 0.0055, [sx, 0.1, 0.3], [0.1, 0.06, 0.03]);
  // たたんだ翼：三列風切りの白い縁と青い翼鏡
  for (const sx of [-1, 1]) {
    m.use(MAT.FEATHER, 0, true);
    m.grid(m.seg(12, 5), m.seg(6, 3), (u, v) => {
      const z = lerp(0.1, -0.215, u);
      const [yc, rx, ry] = profAt(P, z);
      const top = yc + ry * lerp(0.75, 0.55, u), bot = yc + ry * lerp(0.05, 0.25, u);
      const w = u < 0.75 ? 1 : 1 - ((u - 0.75) / 0.25) * 0.8;
      const mid = (top + bot) / 2, y = mid + (lerp(top, bot, v) - mid) * w;
      const t = clamp((y - yc) / ry, -0.98, 0.98);
      return [sx * Math.max(rx * Math.sqrt(1 - t * t) + 0.004, 0.02), y, z];
    }, (u, v) => {
      if (u > 0.5 && u < 0.72 && v > 0.62) return [0.1, 0.13, 0.4];             // 翼鏡
      if (u > 0.5 && u < 0.72 && v > 0.52) return [0.85, 0.84, 0.8];
      if (u > 0.55 && u < 0.85 && v < 0.35 && frac(v * 3) > 0.62) return [0.86, 0.84, 0.78];  // 三列風切りの白い縁
      return frac(v * 5 + u * 3) < 0.25 ? [0.28, 0.21, 0.14] : [0.13, 0.095, 0.065];
    }, () => [7, 0, sx, 0], [sx, 0.5, 0]);
  }
  // 尾：とがって少し上がる
  m.use(MAT.FEATHER, 0, true);
  m.grid(5, 8, (u, v) => { const w = Math.abs(2 * v - 1); return [(v - 0.5) * lerp(0.07, 0.05, u) * (1 - u * 0.3), 0.072 + u * 0.018 + w * 0.004, -0.225 - u * 0.085 * (1 - 0.4 * w * w)]; },
    (u, v) => (frac(v * 7) < 0.25 ? [0.4, 0.33, 0.24] : dark), () => [4, 0, 0, 0]);
  return m.build();
}

// ---- カルガモのひな：丸い綿毛。焦げ茶に黄色の顔と背の斑 ----
export function ducklingGeo(q = 1) {
  const m = new MeshB(q);
  const dk = [0.2, 0.14, 0.08], yl = [0.78, 0.66, 0.3];
  const P = [[-0.058, 0.024, 0.004, 0.004], [-0.047, 0.021, 0.024, 0.022], [-0.025, 0.02, 0.036, 0.034], [0.005, 0.022, 0.037, 0.035], [0.028, 0.027, 0.03, 0.03], [0.042, 0.035, 0.019, 0.021]];
  m.use(MAT.DOWN);
  bodyTube(m, P, m.seg(14, 7), m.seg(18, 8), (u, th, p) => {
    const up = Math.sin(th);
    // 焦げ茶の背・黄色い腹。境目はぼかす
    let c = mix3(mix3(yl, [0.75, 0.7, 0.5], sstep(-0.3, -0.7, up)), dk, sstep(-0.4, -0.1, up));
    // 背の黄色い斑：肩と腰に左右一対ずつ
    let sp = 0;
    for (const [zc, r] of [[-0.002, 0.0095], [-0.036, 0.0075]]) sp = Math.max(sp, sstep(1.0, 0.55, Math.hypot((Math.abs(p[0]) - 0.02) / r, (p[2] - zc) / r)));
    return mix3(c, yl, sp * sstep(-0.1, 0.2, up));
  }, () => [0, 0, 0, 0]);
  const hc = [0, 0.06, 0.046];
  m.ellipsoid(hc, [0.021, 0.022, 0.024], m.seg(16, 8), m.seg(12, 6), (v, th, p) => {
    const ly = p[1] - hc[1], lz = p[2] - hc[2];
    if (ly > 0.008 - lz * 0.2) return dk;
    if (Math.abs(ly - 0.001 + lz * 0.1) < 0.0028 && lz < 0.018) return dk;   // 目の線
    return yl;
  }, () => [1, 0, 0, 0]);
  m.use(MAT.HORN);
  limb(m, [[0, 0.057, 0.066, 0.0065, 0.0036], [0, 0.055, 0.076, 0.0058, 0.0026], [0, 0.054, 0.082, 0.003, 0.0015]], 7, () => [0.14, 0.11, 0.08], () => [1, 0, 0, 0]);
  for (const sx of [-1, 1]) eye(m, [sx * 0.0175, 0.0635, 0.055], 0.0036, [sx, 0.1, 0.3], [0.02, 0.02, 0.02]);
  return m.build();
}
export const DUCKLING_ANIM = DUCK_ANIM;

// =====================================================================
// ---- カエル（トノサマガエル／アマガエルの色違い）：畦にすわる・跳ぶ・水に浮く ----
// iC: x=跳ぶ（後脚をのばす 0..1） y=のどのふくらみ z=泳ぐ（脚を広げる）  iD: x=アマガエル(1)
export const FROG_ANIM = /* glsl */ `
void animate(inout vec3 p, inout vec3 n, inout vec3 col) {
  int part = int(aPart.x + 0.5);
  float jump = iC.x, swim = iC.z;
  if (part == 5) {
    // 後脚（aPart.w=1）：すわるとたたみ、跳ぶと後ろへのびる
    float side = aPart.z;
    if (aPart.w > 0.5) {
      vec3 hip = vec3(0.012 * side, 0.012, -0.02);
      float ext = max(jump, swim * 0.7);
      mat3 R = rotY(side * (0.2 + 0.9 * ext * aPart.y)) * rotX(-1.3 * ext * aPart.y);
      p = rotAbout(p, hip, R); n = R * n;
      p = hip + (p - hip) * (1.0 + 0.9 * ext * aPart.y);
    } else {
      vec3 sh = vec3(0.01 * side, 0.01, 0.022);
      mat3 R = rotX(0.6 * jump - 0.3 * swim);
      p = rotAbout(p, sh, R); n = R * n;
    }
  } else if (part == 1 && aPart.y > 0.5) {
    // のど
    p.y -= iC.y * 0.004 * aPart.y;
  }
  // アマガエル：あざやかな緑、目を通る焦げ茶の線、斑なし
  if (iD.x > 0.5) {
    matOut.y = 0.0;
    if (part != 8) {
      float lm = dot(col, vec3(0.33));
      bool belly = lm > 0.6;
      col = belly ? vec3(0.8, 0.8, 0.72) : vec3(0.22, 0.46, 0.08);
      if (!belly && part == 1 && abs(p.x) > 0.012 && p.y < 0.0175 && p.y > 0.009 && p.z > -0.004) col = vec3(0.16, 0.1, 0.05);
    }
  }
}
`;
export function frogGeo(q = 1) {
  const m = new MeshB(q);
  const hi = q > 0.7;
  const green = [0.2, 0.26, 0.09], belly = [0.8, 0.79, 0.68], stripe = [0.46, 0.52, 0.26], ridge = [0.52, 0.47, 0.25];
  const P = [[-0.035, 0.012, 0.006, 0.005], [-0.027, 0.013, 0.017, 0.011], [-0.012, 0.0145, 0.021, 0.013], [0.004, 0.0155, 0.02, 0.012], [0.016, 0.015, 0.017, 0.0105], [0.027, 0.0135, 0.012, 0.0082], [0.036, 0.0115, 0.0065, 0.0055], [0.041, 0.0105, 0.0022, 0.0022]];
  m.use(MAT.SKIN, 1);
  bodyTube(m, P, m.seg(20, 9), m.seg(22, 10), (u, th, p) => {
    const up = Math.sin(th);
    if (up < -0.25) return belly;
    const ax = Math.abs(p[0]);
    if (ax < 0.0022 && up > 0.75 && u < 0.92) return stripe;                     // 背の中の線
    if (ax > 0.0095 && ax < 0.0128 && up > 0.35 && u > 0.15 && u < 0.88) return ridge;  // 背の両脇の隆起
    if (up < 0.1 && u > 0.72 && Math.abs(up + 0.08) < 0.06) return [0.1, 0.12, 0.04];   // 口の線
    if (up < 0.15) return mix3(green, [0.62, 0.6, 0.38], 0.5);                   // 脇は黄みがかる
    return green;
  }, (u, th) => [1, Math.sin(th) < -0.5 && u > 0.6 ? 1 : 0, 0, 0], (th) => { const s = Math.sin(th); return [1 + (s > 0.3 && s < 0.8 ? 0.04 : 0), s < 0 ? 0.8 : 1]; });
  // 目：こんもりと高く、金色の虹彩に横長の瞳。上まぶたは緑
  for (const sx of [-1, 1]) {
    m.use(MAT.SKIN, 0);
    m.ellipsoid([sx * 0.0092, 0.0205, 0.0262], [0.0052, 0.004, 0.0056], m.seg(10, 6), m.seg(8, 5), () => green, () => [1, 0, 0, 0]);
    eye(m, [sx * 0.0105, 0.0238, 0.027], 0.0043, [sx, 0.35, 0.3], [0.6, 0.47, 0.14], [0.01, 0.01, 0.01], { slit: true, lid: [0.7, green] });
    // 鼓膜
    m.use(MAT.SKIN, 0);
    m.ellipsoid([sx * 0.0145, 0.0185, 0.0185], [0.0012, 0.0032, 0.0032], 8, 6, () => [0.3, 0.25, 0.12], () => [1, 0, 0, 0]);
  }
  // 前脚と指
  m.use(MAT.SKIN, 0);
  for (const sx of [-1, 1]) {
    limb(m, [[sx * 0.013, 0.011, 0.02, 0.0032], [sx * 0.018, 0.006, 0.024, 0.0027], [sx * 0.019, 0.002, 0.03, 0.0022], [sx * 0.0195, 0.0008, 0.034, 0.0016]], 6, () => green, () => [5, 0.5, sx, 0]);
    if (hi) for (let f = 0; f < 4; f++) { const a = -0.6 + f * 0.4; limb(m, [[sx * 0.0195, 0.0008, 0.034, 0.0011], [sx * (0.0195 + Math.sin(a) * 0.005), 0.0004, 0.034 + Math.cos(a) * 0.005, 0.0007]], 4, () => mix3(green, belly, 0.3), () => [5, 0.5, sx, 0]); }
  }
  // 後脚：もも→すね→足→水かきのある指（たたんだ Z 字）。濃い横縞
  for (const sx of [-1, 1]) {
    const pts = [[sx * 0.012, 0.012, -0.02, 0.006], [sx * 0.02, 0.011, -0.012, 0.0058], [sx * 0.026, 0.008, -0.005, 0.0046], [sx * 0.023, 0.005, -0.018, 0.0038], [sx * 0.019, 0.004, -0.028, 0.0034], [sx * 0.026, 0.0015, -0.031, 0.0026], [sx * 0.032, 0.0008, -0.022, 0.002], [sx * 0.035, 0.0005, -0.013, 0.0016]];
    limb(m, pts, m.seg(8, 5), (u) => (Math.sin(u * 34) > 0.45 ? mix3(green, [0.02, 0.03, 0.01], 0.75) : green), (u) => [5, u, sx, 1], m.seg(18, 8));
    // 水かき
    m.use(MAT.SKIN, 0, true);
    m.grid(3, 4, (u, v) => { const a = sx * (0.1 + (v - 0.5) * 1.3); return [sx * 0.035 + Math.sin(a) * u * 0.012, 0.0005, -0.013 + Math.cos(a) * u * 0.012 * (1 - 0.15 * Math.abs(2 * v - 1))]; }, () => mix3(green, belly, 0.25), (u) => [5, 1, sx, 1]);
    m.use(MAT.SKIN, 0);
  }
  return m.build();
}

// =====================================================================
// ---- 魚：体をくねらせて泳ぐ（オイカワ・ヤマメ・コイ） ----
// 体の長さは約1.1（口 +0.43 ～ 尾びれの先 -0.68）。大きさは push の scale
// iC: x=泳ぎの位相 y=くねりの強さ   iD: x=色の違い y=個体の乱数 w=種（0 ヤマメ 1 コイ 2 オイカワ）。3種で1つのシェーダ
export const FISH_ANIM = /* glsl */ `
void animate(inout vec3 p, inout vec3 n, inout vec3 col) {
  float z = p.z;
  int part = int(aPart.x + 0.5);
  if (iD.w > 0.5 && iD.w < 1.5 && iD.x > 0.5) {
    // コイの色：iD.x 1=緋鯉 2=紅白 3=黄金（0=真鯉はそのまま）
    float up = n.y;
    vec3 base = iD.x < 1.5 ? vec3(0.8, 0.28, 0.06) : iD.x < 2.5 ? vec3(0.86, 0.85, 0.8) : vec3(0.85, 0.62, 0.2);
    if (iD.x > 1.5 && iD.x < 2.5 && sin(p.z * 11.0 + p.x * 20.0 + iD.y * 7.0) * sin(p.z * 5.0 + 1.3 + iD.y * 3.0) > 0.1 && up > -0.2) base = vec3(0.8, 0.12, 0.05);
    // ひれ（薄い板）は体の色を薄く透かす程度に（明るい紙片に見えない）
    float fk = aMat.x > 9.5 ? 0.45 : 0.92;
    col = mix(col, base * (aMat.x > 9.5 ? 0.7 : 1.0), fk);
    col2 = mix(col2, base * 0.6, fk * 0.9);
  } else if (iD.w > 1.5 && iD.x > 0.5) {
    // オイカワの婚姻色の雄：青緑の体にうす紅の帯、赤いひれ
    if (part == 0) {
      float up = n.y;
      col = mix(vec3(0.75, 0.38, 0.36), vec3(0.1, 0.3, 0.3), smoothstep(-0.2, 0.4, up + 0.3 * sin(p.z * 32.0)));
      if (up < -0.6) col = vec3(0.8, 0.3, 0.2);
    } else if (part == 9 || part == 10) { col = vec3(0.7, 0.3, 0.22); col2 = col; }
  }
  // 胸びれ・腹びれはゆっくりあおぐ
  if (part == 10) {
    float side = aPart.z;
    vec3 pv = vec3(side * 0.05, -0.05, 0.22 - aPart.w * 0.32);
    mat3 R = rotZ(side * (0.25 + 0.25 * sin(iC.x * 0.5 + side)));
    p = rotAbout(p, pv, R); n = R * n;
  }
  // 頭（+z）はほとんど動かず、尾へ行くほど大きく振れる
  float k = smoothstep(0.35, -1.0, z);
  float w = sin(iC.x - z * 9.0) * iC.y * k * k;
  p.x += w;
  vec3 nn = n + vec3(-cos(iC.x - z * 9.0) * iC.y * k * 2.0, 0.0, 0.0);
  n = dot(nn, nn) > 1e-8 ? normalize(nn) : n;
}
`;
function fishGeo(o, q) {
  const m = new MeshB(q);
  const hi = q > 0.7;
  const D = o.deep || 1, F = o.fat;
  const P = [[-0.5, -0.003, 0.013, 0.03], [-0.44, -0.004, 0.017, 0.036], [-0.34, -0.004, 0.03, 0.06], [-0.2, 0.0, 0.05, 0.1], [-0.05, 0.01, 0.068, 0.134], [0.1, 0.012, 0.075, 0.145], [0.24, 0.01, 0.07, 0.126], [0.34, 0.004, 0.055, 0.09], [0.4, 0.0, 0.032, 0.048], [0.43, 0.0, 0.006, 0.006]];
  m.use(MAT.SCALE, o.scale);
  const Ps = P.map(([z, y, rx, ry]) => [z, y * D, rx * F, ry * D]);
  bodyTube(m, Ps, m.seg(30, 12), m.seg(24, 10), (u, th, p) => {
    const up = Math.sin(th);
    let c = o.paint(u, up, p);
    if (Math.abs(p[2] - 0.27) < 0.008 && Math.abs(up) < 0.8) c = sc(c, 0.7);    // えらぶた
    if (p[2] > 0.395 && Math.abs(up + 0.1) < 0.12) c = sc(c, 0.35);              // 口
    return c;
  }, () => [0, 0, 0, 0], (th) => { const s = Math.sin(th); return [1 - 0.28 * s * s, 1]; });
  for (const sx of [-1, 1]) eye(m, [sx * 0.042 * F, 0.034 * D, 0.33], 0.017 * Math.min(1.2, D), [sx, 0.05, 0.3], o.iris || [0.62, 0.58, 0.45], [0.01, 0.01, 0.01], { pupil: 0.72 });
  const fin = (c) => two(c, sc(c, 1.1));
  m.use(MAT.MEMB, 0, true);
  // 尾びれ：二股。すじ（鰭条）の明暗
  m.grid(m.seg(6, 3), m.seg(14, 6), (u, v) => {
    const s = 2 * v - 1, a = Math.abs(s);
    const L = 0.18 * (1 + (o.fork ?? 0.6) * Math.pow(a, 1.3) - (o.fork ?? 0.6) * 0.35);
    return [0, s * (0.028 * D + u * 0.13 * D * (o.tailH || 1)), -0.47 - u * L];
  }, (u, v) => fin(frac(v * 14) < 0.3 ? sc(o.fin, 0.75) : o.fin), () => [9, 0, 0, 0], [1, 0, 0]);
  // 背びれ
  m.grid(m.seg(5, 2), m.seg(8, 3), (u, v) => {
    const z = lerp(o.dorsal[0], o.dorsal[1], v);
    const [yc, , ry] = profAt(Ps, z);
    const h = o.dorsalH * D * (1 - 0.55 * v) * (1 - 0.15 * frac(v * 8));
    return [0, yc + ry * 0.92 + u * h, z - u * 0.05];
  }, (u, v) => fin(o.dorsalPaint ? o.dorsalPaint(u, v) : o.fin), () => [9, 0, 0, 0], [1, 0, 0]);
  // しりびれ
  m.grid(m.seg(4, 2), m.seg(8, 3), (u, v) => {
    const z = lerp(o.anal[0], o.anal[1], v);
    const [yc, , ry] = profAt(Ps, z);
    const h = o.analH * D * (1 - 0.4 * v);
    return [0, yc - ry * 0.92 - u * h, z - u * 0.04];
  }, (u, v) => fin(o.analPaint ? o.analPaint(u, v) : o.fin), () => [9, 0, 0, 0], [1, 0, 0]);
  if (o.adipose) m.grid(3, 3, (u, v) => { const z = lerp(-0.3, -0.36, v); const [yc, , ry] = profAt(Ps, z); return [0, yc + ry * 0.9 + u * 0.03 * D * (1 - Math.abs(2 * v - 1) * 0.5), z]; }, () => fin(o.fin), () => [9, 0, 0, 0], [1, 0, 0]);
  // 胸びれ・腹びれ（あおぐ）
  for (const sx of [-1, 1]) for (const [z0, w] of [[0.22, 0], [-0.1, 1]]) {
    m.grid(4, 5, (u, v) => {
      const [yc, rx, ry] = profAt(Ps, z0);
      const x = sx * (rx * 0.75 + u * 0.06 * F), y = yc - ry * (w ? 0.75 : 0.45) - u * 0.035;
      return [x, y, z0 - u * 0.1 - v * 0.05 + u * v * 0.02];
    }, () => fin(o.pectoral || o.fin), () => [10, 0, sx, w], [0, 1, 0]);
  }
  // コイのひげ
  if (o.barbels && hi) {
    m.use(MAT.SKIN, 0, false, 0.006);
    for (const sx of [-1, 1]) {
      limb(m, [[sx * 0.018, -0.02, 0.405, 0.004], [sx * 0.035, -0.045, 0.39, 0.002]], 4, () => o.fin, () => [0, 0, 0, 0]);
      limb(m, [[sx * 0.02, -0.01, 0.415, 0.003], [sx * 0.032, -0.025, 0.42, 0.0015]], 4, () => o.fin, () => [0, 0, 0, 0]);
    }
  }
  return m.build(0.6);
}
export function riverFishGeo(q = 1) {
  // オイカワ：銀の体に青みの背とうすい横帯。婚姻色の雄は青緑とうす紅（色の違いは iD で）
  return fishGeo({ fat: 0.78, deep: 0.95, scale: 44, fin: [0.6, 0.56, 0.5], dorsal: [0.02, -0.16], dorsalH: 0.1, anal: [-0.12, -0.34], analH: 0.1, iris: [0.72, 0.7, 0.62],
    paint: (u, up, p) => {
      let c = mix3([0.8, 0.82, 0.83], [0.2, 0.28, 0.3], sstep(0.05, 0.75, up));
      if (Math.abs(up) < 0.6 && Math.sin(p[2] * 60) > 0.55 && u > 0.2 && u < 0.85) c = mix3(c, [0.45, 0.55, 0.62], 0.4);
      if (up < -0.5) c = [0.9, 0.9, 0.88];
      return c;
    } }, q);
}
export function troutGeo(q = 1) {
  // ヤマメ：緑がかった背に黒い点、体の横に楕円の斑（パーマーク）、うす紅の帯、あぶらびれ
  return fishGeo({ fat: 0.85, deep: 0.92, scale: 70, fin: [0.46, 0.42, 0.34], dorsal: [0.04, -0.12], dorsalH: 0.11, anal: [-0.2, -0.32], analH: 0.08, adipose: true, fork: 0.25, iris: [0.7, 0.6, 0.35],
    paint: (u, up, p) => {
      let c = mix3([0.8, 0.78, 0.72], [0.24, 0.27, 0.19], sstep(0.0, 0.7, up));
      if (Math.abs(up) < 0.5 && u > 0.14 && u < 0.86) {
        const cz = Math.round(p[2] / 0.075) * 0.075;
        const pm = Math.hypot((p[2] - cz) / 0.028, up / 0.42) < 1;
        if (pm) c = mix3(c, [0.2, 0.2, 0.24], 0.75);
        else if (Math.abs(up) < 0.14) c = mix3(c, [0.78, 0.48, 0.48], 0.45);
      }
      if (up > 0.35 && hash(Math.round(p[0] * 60), Math.round(p[2] * 60), 5) > 0.82) c = [0.05, 0.05, 0.045];
      return c;
    } }, q);
}
export function carpGeo(q = 1) {
  // コイ：色は iD で塗りかえる（真鯉・緋鯉・紅白・黄金）
  return fishGeo({ fat: 1.05, deep: 1.08, scale: 22, fin: [0.3, 0.26, 0.2], dorsal: [0.14, -0.3], dorsalH: 0.08, anal: [-0.24, -0.34], analH: 0.08, fork: 0.35, barbels: true, iris: [0.55, 0.45, 0.25],
    paint: (u, up) => mix3([0.55, 0.45, 0.3], [0.12, 0.1, 0.07], Math.max(0, up * 1.3)) }, q);
}
export const CARP_ANIM = FISH_ANIM;
export const RIVERFISH_ANIM = FISH_ANIM;

// =====================================================================
// ---- ノウサギ：すわる・耳を立てる・草をはむ・跳ねる ----
// iC: x=跳ねの位相(0..1) y=跳ねの強さ z=頭を下げる w=耳の傾き
export const RABBIT_ANIM = /* glsl */ `
void animate(inout vec3 p, inout vec3 n, inout vec3 col) {
  int part = int(aPart.x + 0.5);
  float ph = iC.x * 6.2831, amp = iC.y;
  float sp = sin(ph);
  if (part == 0 || part == 4) {
    // 胴：跳ぶと伸び、着地で縮む
    float st = 1.0 + 0.2 * amp * sp;
    p.z = p.z * st;
    p.y += 0.02 * amp * max(0.0, sp) * smoothstep(-0.2, 0.1, p.z);
  } else if (part == 1 || part == 8 || part == 9) {
    vec3 nk = vec3(0.0, 0.2, 0.1);
    mat3 R = rotX(iC.z * 0.9 - 0.15 * amp * sp);
    if (part == 9) {
      // 耳：根元から後ろへ倒す。ときどきぴくりと動く
      vec3 eb = vec3(0.02 * aPart.z, 0.278, 0.11);
      float tw = pow(max(0.0, sin(uTime * 0.9 + iD.y * 13.0 + aPart.z)), 30.0) * 0.4;
      mat3 E = rotX(-iC.w - tw) * rotZ(aPart.z * (0.18 + 0.1 * iC.w));
      p = rotAbout(p, eb, E); n = E * n;
    }
    p = rotAbout(p, nk, R); n = R * n;
    if (part == 1 && p.z > 0.2) p.y += 0.0015 * sin(uTime * 14.0 + iD.y * 5.0);   // 鼻がひくひく
  } else if (part == 5) {
    float side = aPart.z;
    bool hind = aPart.w > 0.5;
    vec3 pv = hind ? vec3(0.05 * side, 0.13, -0.11) : vec3(0.035 * side, 0.13, 0.08);
    float a = hind ? (-1.0 * amp * max(0.0, sp)) : (1.0 * amp * max(0.0, sin(ph + 1.0)));
    mat3 R = rotX(a);
    p = rotAbout(p, pv, R); n = R * n;
  }
}
`;
export function rabbitGeo(q = 1) {
  const m = new MeshB(q);
  const hi = q > 0.7;
  const fur = [0.38, 0.28, 0.18], furD = [0.24, 0.17, 0.11], belly = [0.76, 0.72, 0.64], nape = [0.45, 0.3, 0.17];
  // 胴：丸い腰・背の弧・細い胸
  const P = [[-0.185, 0.125, 0.02, 0.02], [-0.168, 0.135, 0.078, 0.088], [-0.12, 0.142, 0.1, 0.112], [-0.06, 0.15, 0.09, 0.102], [0.0, 0.16, 0.074, 0.088], [0.05, 0.175, 0.062, 0.074], [0.09, 0.2, 0.048, 0.056]];
  const bodyCol = (u, up, p) => {
    const g = hash(Math.round(p[0] * 90), Math.round(p[1] * 90), Math.round(p[2] * 90));
    let c = mix3(fur, furD, g * 0.55 + sstep(0.2, 0.9, up) * 0.3);
    // 腹の白は胸から腹まで。腰の下（股のあいだ）は暗い毛色のまま
    c = mix3(c, belly, sstep(-0.2, -0.6, up) * sstep(0.3, 0.55, u));
    c = mix3(c, sc(furD, 0.85), sstep(-0.1, -0.7, up) * sstep(0.4, 0.15, u));
    if (u > 0.75 && up > 0.1) c = mix3(c, nape, 0.5);
    return c;
  };
  m.use(MAT.FUR);
  bodyTube(m, P, m.seg(18, 8), m.seg(20, 9), (u, th, p) => bodyCol(u, Math.sin(th), p), () => [0, 0, 0, 0], (th, u) => [1, Math.sin(th) < 0 ? 1.0 + 0.14 * (1 - u) : 1.02]);
  // 腰（後脚のもも）
  // もも：腹の白は塗らず、下へ行くほど暗い毛色（股のまわりは沈める）
  for (const sx of [-1, 1]) m.ellipsoid([sx * 0.06, 0.09, -0.11], [0.042, 0.068, 0.08], m.seg(14, 6), m.seg(12, 5), (v, th, p) => {
    const g = hash(Math.round(p[0] * 90), Math.round(p[1] * 90), Math.round(p[2] * 90));
    const up = (p[1] - 0.09) / 0.068, inner = sstep(0.02, -0.03, sx * (p[0] - sx * 0.06));
    return sc(mix3(mix3(fur, furD, g * 0.5), sc(furD, 0.8), sstep(0.3, -0.7, up)), 1 - 0.35 * inner * sstep(0.2, -0.6, up));
  }, () => [5, 0, sx, 1]);
  // 股の奥の陰を焼くための球
  m.blob([0, 0.08, -0.13], 0.035);
  // 頭：頭蓋から鼻先まで。頬はふくらむ
  const H = [[0, 0.225, 0.07, 0.03, 0.036], [0, 0.238, 0.095, 0.05, 0.055], [0, 0.243, 0.128, 0.054, 0.054], [0, 0.237, 0.16, 0.046, 0.047], [0, 0.226, 0.187, 0.035, 0.036], [0, 0.217, 0.207, 0.023, 0.025], [0, 0.212, 0.217, 0.01, 0.011]];
  limb(m, H, m.seg(16, 8), (u, th, p) => {
    const up = Math.sin(th);
    if (p[2] > 0.206 && up > -0.2) return [0.42, 0.32, 0.27];            // 鼻
    if (p[2] > 0.19 && up < -0.3) return [0.72, 0.68, 0.6];              // 口もと
    if (up < -0.4) return mix3(fur, belly, 0.6);
    const ex = Math.hypot(p[1] - 0.252, p[2] - 0.148);
    if (Math.abs(p[0]) > 0.034 && ex < 0.018 && ex > 0.0105) return [0.62, 0.55, 0.45];   // 目のまわりの淡い輪
    return mix3(fur, [0.33, 0.27, 0.2], 0.4);
  }, () => [1, 0, 0, 0], m.seg(18, 8));
  for (const sx of [-1, 1]) eye(m, [sx * 0.041, 0.252, 0.148], 0.0105, [sx, 0.1, 0.25], [0.12, 0.06, 0.025], [0.01, 0.008, 0.006], { pupil: 0.7 });
  // 耳：長く、内側はうす紅で透ける。先が黒い
  for (const sx of [-1, 1]) {
    m.use(MAT.FUR, 0, true);
    m.grid(m.seg(12, 5), m.seg(6, 3), (u, v) => {
      const L = 0.15, s = 2 * v - 1;
      const w = 0.023 * Math.sin(Math.PI * Math.min(1, u * 0.92 + 0.1)) * (1 - 0.25 * u);
      const cup = 0.008 * (1 - s * s) * Math.sin(Math.PI * Math.min(1, u * 1.2));
      // 耳の向き：上・少し後ろ・少し外
      const ux = sx * 0.22, uy = 0.93, uz = -0.28;
      return [sx * 0.02 + ux * u * L + cup * sx * 0.3, 0.278 + uy * u * L, 0.11 + uz * u * L + s * w - cup];
    }, (u, v) => {
      const edge = Math.abs(2 * v - 1) > 0.75;
      if (u > 0.86) return two([0.05, 0.04, 0.035], [0.05, 0.04, 0.035]);
      return two(edge ? [0.66, 0.6, 0.5] : [0.62, 0.44, 0.38], [0.42, 0.33, 0.24]);
    }, () => [9, 0, sx, 0], [0, 0, 1]);
  }
  // 尾（白い綿、上は黒っぽい）
  m.use(MAT.FUR);
  m.ellipsoid([0, 0.146, -0.196], [0.019, 0.02, 0.014], m.seg(12, 6), m.seg(10, 5), (v) => mix3([0.2, 0.15, 0.1], [0.78, 0.74, 0.66], sstep(0.62, 0.85, v)), () => [4, 0, 0, 0]);
  // 前脚（細い）・後脚の長い足
  for (const sx of [-1, 1]) {
    limb(m, [[sx * 0.034, 0.12, 0.075, 0.017], [sx * 0.033, 0.07, 0.088, 0.011], [sx * 0.032, 0.02, 0.1, 0.0085], [sx * 0.031, 0.007, 0.112, 0.0085, 0.006], [sx * 0.03, 0.005, 0.124, 0.006, 0.004]], m.seg(8, 5), (u) => (u > 0.6 ? [0.52, 0.44, 0.34] : fur), () => [5, 0, sx, 0]);
    limb(m, [[sx * 0.062, 0.05, -0.15, 0.02], [sx * 0.064, 0.022, -0.17, 0.016], [sx * 0.06, 0.011, -0.13, 0.014, 0.01], [sx * 0.056, 0.008, -0.07, 0.012, 0.008], [sx * 0.052, 0.006, -0.035, 0.007, 0.005]], m.seg(8, 5), (u) => (u > 0.5 ? [0.5, 0.42, 0.32] : furD), () => [5, 1, sx, 1]);
  }
  if (hi) {
    // ひげ（細い毛：画面で1ピクセルを切る距離では描かない）
    m.use(MAT.HORN, 0, false, 0.0012);
    for (const sx of [-1, 1]) for (let k = 0; k < 3; k++) limb(m, [[sx * 0.012, 0.212, 0.205, 0.0006], [sx * (0.05 + k * 0.006), 0.215 - k * 0.008, 0.21 - k * 0.01, 0.0002]], 3, () => [0.75, 0.73, 0.7], () => [1, 0, 0, 0]);
  }
  return m.build();
}

// =====================================================================
// ---- ニホンジカ：草をはむ・顔を上げる・歩く・跳ねて逃げる。雄は袋角 ----
// iC: x=歩みの位相 y=歩みの強さ（0 立つ 0.5 歩く 1 跳ぶ） z=首を下げる w=耳・尾   iD: y=個体の乱数 z=雄(1)
export const DEER_ANIM = /* glsl */ `
void animate(inout vec3 p, inout vec3 n, inout vec3 col) {
  int part = int(aPart.x + 0.5);
  float ph = iC.x, amp = iC.y;
  if (part == 5) {
    float side = aPart.z;
    bool hind = aPart.w > 0.5;
    vec3 pv = vec3(0.11 * side, hind ? 0.95 : 0.92, hind ? -0.45 : 0.42);
    // 歩き：左右が半周ずれ、前後は四分の一ずれる。跳ぶ：前後がそろう
    float off = (side > 0.0 ? 0.0 : 3.1416) + (hind ? 1.5708 : 0.0);
    bool bound = amp > 0.75;
    if (bound) off = hind ? 3.1416 : 0.0;
    float g = sat(amp * 2.0);
    float s = sin(ph + off);
    float a = -s * mix(0.3, 0.75, sat(amp * 2.0 - 1.0)) * g;
    // 関節：前脚の膝は後ろへ、後脚のかかとは前へ曲がる。脚を前へ運ぶ間に曲げる
    float fold = max(0.0, cos(ph + off)) * g * (bound ? 1.0 : 0.8);
    // 曲げはなだらかに（関節の上下 ±9cm で移る）。中心は脚の輪の中心線
    float jy = hind ? 0.45 : 0.4;
    float wk = smoothstep(jy + 0.09, jy - 0.09, p.y);
    vec3 jp = vec3(pv.x, jy, hind ? -0.51 : 0.42);
    mat3 K = rotX((hind ? -1.0 : 1.0) * fold * wk);
    vec3 q = rotAbout(p, jp, K); n = K * n;
    // 脚の根元（胴の中）は回さない
    float wr = smoothstep(1.0, 0.78, p.y);
    mat3 R = rotX(a * wr);
    p = rotAbout(q, pv, R); n = R * n;
  } else if (part == 6 || part == 1 || part == 8 || part == 9 || part == 10) {
    // 首：根元から前下へ倒して草をはむ
    float t = part == 6 ? aPart.y : 1.0;
    vec3 nb = vec3(0.0, 1.1, 0.46);
    mat3 R = rotX(iC.z * 1.25 * (0.4 + 0.6 * t));
    if (part == 9) {
      vec3 eb = vec3(0.05 * aPart.z, 1.6, 0.64);
      float tw = pow(max(0.0, sin(uTime * 0.7 + iD.y * 11.0 + aPart.z * 2.0)), 24.0);
      mat3 E = rotZ(aPart.z * (0.15 + 0.3 * sin(uTime * 1.3 + iD.y * 7.0) * iC.w + 0.35 * tw)) * rotY(aPart.z * 0.3 * tw);
      p = rotAbout(p, eb, E); n = E * n;
    }
    if (part == 10 && iD.z < 0.5) p = vec3(0.0, 1.58, 0.66);
    p = rotAbout(p, nb, R); n = R * n;
  } else if (part == 4) {
    vec3 tb = vec3(0.0, 1.05, -0.62);
    mat3 R = rotX(-0.5 * iC.w * (0.5 + 0.5 * sin(uTime * 7.0 + iD.y * 3.0)));
    p = rotAbout(p, tb, R); n = R * n;
  } else if (part == 0) {
    // 息で胸がふくらむ
    float br = 1.0 + 0.012 * sin(uTime * 2.2 + iD.y * 9.0) * smoothstep(-0.3, 0.2, p.z);
    p.x *= br; p.y = 1.0 + (p.y - 1.0) * br;
  }
  // 白い斑は子鹿だけ（春の大人は冬毛で斑が目立たない）
  if (iD.w < 0.5) matOut.y = 0.0;
}
`;
export function deerGeo(q = 1) {
  const m = new MeshB(q);
  const hi = q > 0.7;
  const coat = [0.4, 0.28, 0.17], coatD = [0.27, 0.19, 0.12], belly = [0.66, 0.58, 0.46], rump = [0.9, 0.88, 0.82], leg = [0.46, 0.37, 0.27];
  const P = [[-0.645, 1.0, 0.05, 0.06], [-0.585, 0.99, 0.15, 0.19], [-0.45, 0.99, 0.19, 0.23], [-0.25, 0.975, 0.198, 0.243], [0.0, 0.98, 0.203, 0.253], [0.2, 0.995, 0.19, 0.258], [0.38, 1.04, 0.16, 0.24], [0.5, 1.085, 0.12, 0.18], [0.56, 1.125, 0.09, 0.13]];
  m.use(MAT.FUR, hi ? 1 : 0);
  bodyTube(m, P, m.seg(22, 10), m.seg(24, 10), (u, th, p) => {
    const up = Math.sin(th);
    // お尻の白い斑（ハート形）と黒い縁
    if (u < 0.14 && up > -0.55) {
      const w = Math.abs(Math.cos(th));
      if (u < 0.1 && w < 0.72 - (0.1 - u) * 2) return rump;
      if (u < 0.14 && w < 0.85) return [0.06, 0.05, 0.04];
    }
    if (up < -0.5) return belly;
    const g = hash(Math.round(p[0] * 25), Math.round(p[1] * 25), Math.round(p[2] * 25));
    let c = mix3(coat, coatD, g * 0.35 + sstep(0.5, 1, up) * 0.35);
    if (Math.abs(p[0]) < 0.035 && up > 0.9) c = [0.18, 0.12, 0.08];   // 背の黒い筋
    if (up < -0.25) c = mix3(c, belly, 0.5);
    return c;
  }, () => [0, 0, 0, 0], (th, u) => { const s = Math.sin(th); return [1 - (s < -0.3 ? 0.1 : 0) * (1 - u * 0.5), s < 0 ? 1.0 + 0.06 * sstep(0.4, 0.9, u) : 0.96]; });
  // 首
  m.use(MAT.FUR);
  const neck = [];
  const nN = m.seg(9, 5);
  for (let i = 0; i <= nN; i++) { const t = i / nN; neck.push({ p: [0, 1.0 + t * 0.56, 0.36 + t * 0.265 + 0.03 * Math.sin(t * Math.PI)], rx: 0.13 - 0.085 * t, ry: 0.2 - 0.15 * t }); }
  m.tube(neck, m.seg(16, 8), (u, th) => (Math.sin(th) < -0.6 && Math.cos(th) > -0.2 ? mix3(coat, belly, 0.4) : coat), (u) => [6, u, 0, 0], true, true);
  // 頭：額からくさび形に鼻先へ
  const H = [[0, 1.575, 0.595, 0.05, 0.062], [0, 1.585, 0.645, 0.064, 0.076], [0, 1.568, 0.71, 0.059, 0.068], [0, 1.535, 0.78, 0.045, 0.053], [0, 1.502, 0.84, 0.033, 0.038], [0, 1.484, 0.875, 0.026, 0.03], [0, 1.475, 0.893, 0.018, 0.02], [0, 1.473, 0.9, 0.006, 0.006]];
  limb(m, H, m.seg(16, 8), (u, th, p) => {
    const up = Math.sin(th);
    if (p[2] > 0.865 && up > -0.5) return [0.05, 0.045, 0.045];                  // 鼻
    if (p[2] > 0.83 && up < -0.2) return [0.62, 0.58, 0.52];                     // 口もとの白
    if (Math.abs(p[0]) > 0.035 && Math.abs(p[2] - 0.745) < 0.018 && up > -0.3 && up < 0.4) return [0.1, 0.07, 0.05]; // 眼下腺
    if (up > 0.6 && p[2] < 0.75) return coatD;
    return mix3(coat, [0.42, 0.34, 0.26], 0.5);
  }, () => [1, 0, 0, 0], m.seg(18, 8));
  for (const sx of [-1, 1]) eye(m, [sx * 0.056, 1.588, 0.705], 0.0145, [sx, 0.15, 0.3], [0.12, 0.07, 0.04], [0.01, 0.008, 0.006], { pupil: 0.7 });
  // 耳：大きく、内側は白い毛
  for (const sx of [-1, 1]) {
    m.use(MAT.FUR, 0, true);
    m.grid(m.seg(8, 4), m.seg(6, 3), (u, v) => {
      const L = 0.16, s = 2 * v - 1;
      const w = 0.042 * Math.sin(Math.PI * Math.min(1, u * 0.9 + 0.12));
      const cup = 0.018 * (1 - s * s) * Math.sin(Math.PI * Math.min(1, u * 1.1));
      return [sx * (0.05 + u * L * 0.85), 1.6 + u * L * 0.45, 0.64 + s * w - cup];
    }, (u, v) => two(Math.abs(2 * v - 1) > 0.7 || u > 0.9 ? [0.85, 0.83, 0.78] : [0.5, 0.42, 0.36], u > 0.88 ? [0.12, 0.09, 0.07] : coat), () => [9, 0, sx, 0], [0, 0, 1]);
  }
  // 袋角（雄だけ。頂点シェーダで雌は隠す）
  m.use(MAT.FUR);
  for (const sx of [-1, 1]) {
    limb(m, [[sx * 0.042, 1.625, 0.655, 0.022], [sx * 0.058, 1.7, 0.63, 0.018], [sx * 0.07, 1.78, 0.6, 0.017], [sx * 0.075, 1.83, 0.58, 0.02]], m.seg(8, 5), () => [0.34, 0.25, 0.19], () => [10, 0, sx, 0]);
    limb(m, [[sx * 0.058, 1.71, 0.63, 0.014], [sx * 0.07, 1.76, 0.68, 0.012], [sx * 0.072, 1.78, 0.7, 0.014]], m.seg(6, 4), () => [0.34, 0.25, 0.19], () => [10, 0, sx, 0]);
  }
  // 尾：白く、上に黒い筋
  limb(m, [[0, 1.06, -0.62, 0.035, 0.03], [0, 1.0, -0.665, 0.032, 0.026], [0, 0.93, -0.68, 0.02, 0.018]], m.seg(8, 5), (u, th) => (Math.sin(th) > 0.5 ? [0.08, 0.06, 0.05] : rump), () => [4, 0, 0, 0]);
  // 脚：前は肩→ひじ→膝→球節→ひづめ、後ろはもも→膝→かかと→球節→ひづめ
  for (const sx of [-1, 1]) for (const hind of [0, 1]) {
    const x = sx * 0.1;
    const pts = hind
      // もも（横に薄く前後に広い。胴の外へ出ない）→ 膝 → かかと（少し太い）→ 管骨 → 球節 → ひづめ
      ? [[x * 0.75, 1.0, -0.43, 0.075, 0.15], [x * 0.9, 0.84, -0.38, 0.075, 0.125], [x, 0.68, -0.37, 0.056, 0.078], [x, 0.56, -0.43, 0.041, 0.052], [x, 0.46, -0.505, 0.034, 0.043], [x, 0.37, -0.51, 0.025, 0.029], [x, 0.22, -0.49, 0.02, 0.022], [x, 0.11, -0.472, 0.022, 0.024], [x, 0.06, -0.457, 0.019, 0.02]]
      : [[x * 0.75, 1.0, 0.4, 0.065, 0.12], [x * 0.9, 0.8, 0.385, 0.058, 0.085], [x, 0.62, 0.405, 0.037, 0.047], [x, 0.49, 0.418, 0.029, 0.034], [x, 0.41, 0.42, 0.031, 0.035], [x, 0.34, 0.421, 0.023, 0.026], [x, 0.2, 0.425, 0.019, 0.021], [x, 0.1, 0.43, 0.022, 0.023], [x, 0.06, 0.445, 0.019, 0.02]];
    m.use(MAT.FUR);
    limb(m, pts, m.seg(14, 6), (u, th, p) => (p[1] > 0.7 ? coat : p[1] < 0.13 ? [0.2, 0.16, 0.12] : mix3(leg, coat, sstep(0.3, 0.7, p[1]))), () => [5, 0, sx, hind], m.seg(28, 10));
    // ひづめ（割れた2つの指）
    m.use(MAT.HORN);
    const z0 = hind ? -0.455 : 0.445;
    for (const dx of [-0.011, 0.011]) limb(m, [[x + dx, 0.065, z0, 0.012, 0.014], [x + dx * 1.1, 0.03, z0 + 0.012, 0.012, 0.016], [x + dx * 1.1, 0.004, z0 + 0.026, 0.009, 0.011], [x + dx, 0.0, z0 + 0.034, 0.002, 0.002]], 6, () => [0.07, 0.06, 0.055], () => [5, 1, sx, hind]);
  }
  return m.build();
}
