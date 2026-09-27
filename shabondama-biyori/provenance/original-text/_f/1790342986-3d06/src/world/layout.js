// 谷の大きな形（関数で定義し、どの解像度からでも同じ値を返す）
// 座標: x=東, z=南, y=上（メートル）。谷は東西に走り、川は西から東へ流れる
import { simplex2, fbm2, ridged2, smoothstep, smin, clamp, lerp } from '../util/noise.js';

export const valleyZ = (x) => 26 * Math.sin(x * 0.0027 + 0.4) + 16 * Math.sin(x * 0.0061 + 2.2);
// 上流（西）ほど谷が狭まる・ところどころ尾根が谷へ張り出す
const narrow = (x) => 0.58 + 0.42 * smoothstep(-780, -380, x);
const gauss = (x, c, w) => Math.exp(-(((x - c) / w) ** 2));
export const halfN = (x) => (158 + 24 * Math.sin(x * 0.0074 + 1.1) + 12 * Math.sin(x * 0.019 + 0.3) - 52 * gauss(x, -405, 62) - 40 * gauss(x, 262, 58) - 30 * gauss(x, 610, 70)) * narrow(x);
export const halfS = (x) => (170 + 26 * Math.sin(x * 0.0063 + 2.9) + 12 * Math.sin(x * 0.021 + 1.7) - 62 * gauss(x, 255, 70) - 48 * gauss(x, -560, 70) - 26 * gauss(x, -120, 80)) * narrow(x);
export const edgeN = (x) => valleyZ(x) - halfN(x);
export const edgeS = (x) => valleyZ(x) + halfS(x);

// 谷底の緩い傾き（東へ下る・縁へわずかに上る）
export function floorBase(x, z) {
  const dz = z - valleyZ(x);
  return 4.2 - x * 0.003 + 0.0024 * Math.abs(dz) + 0.8 * simplex2(x / 230 + 4.1, z / 230 - 2.3);
}

// 川の中心線（xの関数：蛇行するがループしない）
export const riverZ = (x) => valleyZ(x) + 16 + 42 * Math.sin(x * 0.0058 + 0.3) + 15 * Math.sin(x * 0.0135 + 2.0);
export const riverDZ = (x) => riverZ(x + 0.5) - riverZ(x - 0.5);
export const riverDist = (x, z) => Math.abs(z - riverZ(x)) / Math.sqrt(1 + riverDZ(x) ** 2);
// 川の水面（谷底より1.15m下、下流へ下がる）
export const riverLevel = (x) => floorBase(x, riverZ(x)) - 1.15;

// 谷戸（丘へ切れ込む小さな谷）
export const YATOS = [
  { mx: -470, side: -1, len: 400, w0: 44, w1: 20, slope: 0.05, bend: 0.1, ph: 0.0 },
  { mx: 395, side: 1, len: 340, w0: 40, w1: 18, slope: 0.058, bend: -0.12, ph: 1.7 },
  { mx: 165, side: -1, len: 170, w0: 24, w1: 11, slope: 0.075, bend: 0.22, ph: 3.1 },
];
export function yatoAxisX(y, s) { return y.mx + y.bend * s + 16 * Math.sin(s / 70 + y.ph); }
export function yatoLocal(y, x, z) {
  const zEdge = y.side < 0 ? edgeN(y.mx) : edgeS(y.mx);
  const s = y.side * (z - zEdge);
  const ax = yatoAxisX(y, s);
  return { s, a: Math.abs(x - ax), ax, zEdge };
}

// 一本桜の小丘
export const KNOLL = { x: -92, z: -72, r: 15, h: 3.4 };
// ため池（谷戸Aの奥）
export const POND = (() => {
  const y = YATOS[0];
  const s = 300;
  const zEdge = edgeN(y.mx);
  return { x: yatoAxisX(y, s), z: zEdge - s, rx: 30, rz: 24, s };
})();

// ---- 滝の谷（谷戸Aの奥、ため池の上） ----
// s=谷戸の奥への距離、a=谷の軸からの横のずれ（東が正）。池（s≈276〜324）の上に渓流、s≈398 に滝つぼ、s≈404 の崖から滝が落ちる
const GY = YATOS[0];
const G_ZE = edgeN(GY.mx);
export const GORGE = {
  sIn: 326,        // 渓流が池へ入るところ
  sTop: 391,       // 渓流の上の端（滝つぼの出口）
  sPool: 397.5,    // 滝つぼの中心
  poolR: 7.8,
  sCliff: 404.3,   // 崖の下（滝口の真下）
  steps: 8,        // 渓流の段の数
};
export const gorgeLocal = (x, z) => { const s = G_ZE - z; return { s, a: x - yatoAxisX(GY, s) }; };
export const gorgeWorld = (s, a) => [yatoAxisX(GY, s) + a, G_ZE - s];
// 渓流の中心線（谷の軸からの横のずれ）：池の口と滝つぼでは軸へ寄る
export function streamA(s) {
  const k = smoothstep(GORGE.sIn - 2, GORGE.sIn + 14, s) * (1 - smoothstep(GORGE.sTop - 14, GORGE.sTop + 2, s));
  return k * (3.4 * Math.sin(s / 11.5 + 0.8) + 1.5 * Math.sin(s / 4.9 + 2.0));
}
// 渓流の段：s の区切り（下流から）
export const streamStep = (s) => clamp(Math.floor((s - GORGE.sIn) / ((GORGE.sTop - GORGE.sIn) / GORGE.steps)), 0, GORGE.steps - 1);
export const streamLevel = (k) => 23.2 + k * 0.8;

// ---- 山の上の見晴らし（村の裏山） ----
export const RIDGE = { x: -150, z: -393, r: 19, lookX: -40, lookZ: 60 };

// 丸みのある尾根（里山の低い丘）
function softRidge(x, z) {
  const a = 1 - Math.abs(simplex2(x, z));
  const b = 1 - Math.abs(simplex2(x * 2.1 + 7.7, z * 2.1 - 3.1));
  return a * a * 0.7 + b * b * 0.3;
}
export let FAR_SMOOTH = 0;
export function setFarSmooth(v) { FAR_SMOOTH = v; }
function hillRise(t, x, z) {
  const apron = 9 * (1 - Math.exp(-t / 26));
  const hills = 135 * Math.pow(1 - Math.exp(-t / 230), 1.3);
  const n = 0.72 + 0.46 * (0.5 + 0.5 * fbm2(x / 520 + 11, z / 520 - 7, 3));
  const ridge = (softRidge(x / 380, z / 380) - 0.45) * 60 * smoothstep(30, 280, t);
  const detail = FAR_SMOOTH ? 0 : fbm2(x / 95, z / 95, 3) * 7 * smoothstep(10, 110, t);
  return apron + hills * n + ridge + detail;
}

// 境目の外側への距離（谷底内は負）
export function floorT(x, z) {
  const dz = z - valleyZ(x);
  return dz < 0 ? -dz - halfN(x) : dz - halfS(x);
}

// 地形の土台（田んぼ・川・道を入れる前）
export function baseHeight(x, z) {
  const t = floorT(x, z);
  const fl = floorBase(x, z);
  let h = fl + 1.1 * smoothstep(-35, 0, t);
  if (t > 0) h += hillRise(t, x, z);
  // 谷戸：谷の床を丘の中へ伸ばす
  for (const y of YATOS) {
    const { s, a } = yatoLocal(y, x, z);
    if (s < -60 || s > y.len + 260) continue;
    const u = clamp(s / y.len, 0, 1);
    const w = lerp(y.w0, y.w1, u);
    const edgeH = floorBase(y.mx, y.side < 0 ? edgeN(y.mx) : edgeS(y.mx)) + 1.1;
    let yf = edgeH + Math.max(s, 0) * y.slope + 1.2 * smoothstep(-15, 0, a - w);
    const tt = Math.max(a - w, 0) + Math.max(s - y.len, 0) * 0.9;
    yf += 11 * (1 - Math.exp(-tt / 18)) + 120 * (1 - Math.exp(-tt / 125)) + fbm2(x / 70, z / 70, 3) * 5 * smoothstep(5, 60, tt);
    const k = smoothstep(-60, -10, s);
    h = lerp(h, smin(h, yf, 12), k);
  }
  // 小丘
  const kd2 = (x - KNOLL.x) ** 2 + (z - KNOLL.z) ** 2;
  h += KNOLL.h * Math.exp(-kd2 / (2 * KNOLL.r * KNOLL.r));
  // 遠くの山並み
  const r = Math.hypot(x * 1.0, z * 1.15);
  const m1 = 0.5 + 0.5 * fbm2(x / 1700 + 3, z / 1700 - 5, 4);
  h += smoothstep(640, 2600, r) * (120 + 230 * m1 + 150 * softRidge(x / 2300 + 1.1, z / 2300 - 0.4));
  const m2 = 0.5 + 0.5 * fbm2(x / 4200 - 1, z / 4200 + 2, 3);
  h += smoothstep(2600, 7000, r) * (180 + 420 * m2 + 260 * softRidge(x / 5200 - 2.3, z / 5200 + 1.7));
  // 遠くの雪山：谷の下手（東北東）の十数km先に、春でも雪の残る高い山並み
  if (r > 8000) h += snowRange(x, z);
  return h;
}
export function snowRange(x, z) {
  const r = Math.hypot(x, z);
  const ang = Math.atan2(z, x);
  let dA = ang + 0.38;
  while (dA > Math.PI) dA -= 2 * Math.PI;
  while (dA < -Math.PI) dA += 2 * Math.PI;
  const dir = Math.exp(-((dA / 0.62) ** 2));
  const band = smoothstep(8000, 11500, r) * (1 - smoothstep(20000, 24000, r));
  if (dir * band < 0.002) return 0;
  const pk = ridged2(x / 6200 + 3.3, z / 6200 - 1.9, 6);
  const mass = 0.6 + 0.4 * fbm2(x / 9000 - 4.1, z / 9000 + 2.2, 3);
  return band * dir * (850 + 1400 * mass + 1500 * Math.pow(pk, 1.6) * mass);
}

// ---- 集落（北側の山裾、南向き） ----
// inset: 谷底の縁から北へ入った距離
const HOUSE_DEFS = [
  { id: 'h1', x: -122, inset: 24, w: 15.5, d: 10, type: 'kaya', rot: 0.05, plot: [40, 30] },   // 始まりの縁側
  { id: 'h2', x: -56, inset: 36, w: 12, d: 9, type: 'kawara2', rot: -0.07, plot: [34, 28] },  // 鯉のぼり
  { id: 'h3', x: 14, inset: 20, w: 14, d: 9.5, type: 'kaya', rot: 0.11, plot: [36, 28] },
  { id: 'h4', x: -208, inset: 15, w: 12.5, d: 9, type: 'kawara', rot: -0.03, plot: [34, 26] },
  { id: 'h5', x: 102, inset: 38, w: 11, d: 8, type: 'kawara', rot: 0.16, plot: [30, 26] },
  { id: 'h6', x: -296, inset: 30, w: 13.5, d: 9, type: 'kaya', rot: -0.1, plot: [34, 28] },
  { id: 'h7', x: -166, inset: 56, w: 11.5, d: 8.5, type: 'kawara', rot: 0.02, plot: [30, 24] },
  { id: 'h8', x: 60, inset: 62, w: 13, d: 9, type: 'kaya', rot: 0.08, plot: [32, 26] },
];
export const HOUSES = HOUSE_DEFS.map((h) => ({ ...h, z: edgeN(h.x) - h.inset }));

// 付属の建物（家からの相対位置：家の向きの局所座標 [右, 奥]）
export const OUTBUILDINGS = [
  { of: 'h1', type: 'barn', off: [14, 4], w: 8, d: 5.5, rot: 0.0 },
  { of: 'h1', type: 'kura', off: [-13, 6], w: 5.5, d: 4.5, rot: 0.0 },
  { of: 'h2', type: 'barn', off: [-12, 3], w: 7, d: 5, rot: 0.1 },
  { of: 'h3', type: 'barn', off: [12, 3], w: 7.5, d: 5, rot: -0.05 },
  { of: 'h4', type: 'kura', off: [11, 5], w: 5, d: 4, rot: 0.0 },
  { of: 'h5', type: 'barn', off: [-10, 2], w: 6.5, d: 4.5, rot: 0.0 },
  { of: 'h6', type: 'barn', off: [12, 2], w: 7, d: 5, rot: 0.05 },
  { of: 'h8', type: 'kura', off: [-11, 4], w: 5, d: 4, rot: 0.0 },
];

// 神社（南の丘の麓）
export const SHRINE = (() => {
  const x = 252;
  const ze = edgeS(x);
  return { x, toriiZ: ze - 4, shrineZ: ze + 34, stepsFrom: ze + 2, stepsTo: ze + 28 };
})();

// 道（折れ線：あとで滑らかにする）
export function roadPolylines() {
  const north = [];
  for (let x = -800; x <= 800; x += 20) north.push([x, edgeN(x) + 7 + 3 * Math.sin(x / 90)]);
  const south = [];
  for (let x = -800; x <= 800; x += 20) south.push([x, edgeS(x) - 9 + 3 * Math.sin(x / 70 + 1)]);
  const bx = -18;
  const bz = riverZ(bx);
  const cross = [
    [-60, edgeN(-60) + 7 + 3 * Math.sin(-60 / 90)],
    [-52, edgeN(-60) + 50],
    [-36, bz - 60],
    [bx - 2, bz - 22],
    [bx, bz],
    [bx + 3, bz + 22],
    [bx + 18, bz + 70],
    [bx + 34, edgeS(bx + 36) - 60],
    [bx + 40, edgeS(bx + 40) - 9 + 3 * Math.sin((bx + 40) / 70 + 1)],
  ];
  // 神社への参道（南の道から鳥居へ）
  const sando = [
    [SHRINE.x - 3, edgeS(SHRINE.x) - 9 + 3 * Math.sin(SHRINE.x / 70 + 1)],
    [SHRINE.x, SHRINE.toriiZ + 2],
  ];
  return [
    { id: 'north', pts: north, hw: 2.4, kind: 'asphalt' },
    { id: 'south', pts: south, hw: 1.7, kind: 'dirt' },
    { id: 'cross', pts: cross, hw: 2.1, kind: 'asphalt' },
    { id: 'sando', pts: sando, hw: 1.3, kind: 'gravel' },
  ];
}
export const BRIDGE = (() => { const x = -18; return { x, z: riverZ(x) }; })();

// 滑らかな曲線（Catmull-Rom）で折れ線を細かく刻む
export function smoothPolyline(pts, step = 2) {
  const out = [];
  const P = (i) => pts[Math.max(0, Math.min(pts.length - 1, i))];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
    const len = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
    const n = Math.max(1, Math.ceil(len / step));
    for (let k = 0; k < n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(pts[pts.length - 1].slice());
  return out;
}
