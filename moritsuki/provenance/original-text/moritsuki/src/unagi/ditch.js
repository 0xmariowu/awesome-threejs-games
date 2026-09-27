// 側溝のコース（形・高さ・水位）。three に頼らない計算だけを置く（CPU と GLSL で同じ式）
// 座標: 下流 → 上流 が -z。s = -z（スタートからの距離 m）
//       x: − が農道の側（西）、+ が田んぼの側（東）。y: スタートの所のコンクリートの底 = 0
// 水は +z（下流）へ流れる。研究所の横の川へ注ぐ排水路の、少し上った所
import { makeNoise2D, smoothstep, clamp } from './core/noise.js';

export const HW = 0.6;          // 内幅の半分（内幅 1.2m）
export const WALL_T = 0.13;     // 壁の厚さ
export const WALL_H = 0.95;     // 底から壁の上まで（ふつうの所）
export const DEPTH = 0.40;      // 水深
export const S_BACK = -3.4;     // 下流の端（ここから先は格子と暗渠で川へ）
export const S_GRATE = -4.4;
export const S_END = 100;       // ゴール（水門の手前）
export const S_GATE = 101.4;    // 水門
export const S_FAR = 118;       // 水門の向こうの見える所まで
export const FLOW = 0.28;       // 流れの速さ（m/s）

// 落ち込み: s = 段の位置、h = 段の高さ、pool = 下の桝の長さ、poolD = 桝の深さ
export const DROPS = [
  { s: 40, h: 0.3, pool: 1.8, poolD: 0.22 },
  { s: 78, h: 0.34, pool: 2.0, poolD: 0.26 },
];
// 横切る道の下の暗渠
export const CULVERT = { s0: 57.6, s1: 62.4, hump: 0.24, slab: 0.2 };
export const ROAD2 = { s: 60, w: 4.8 };
// 田んぼからの排水パイプ（side: +1 田んぼ側 / −1 農道側、y: 底からの高さ、r: 半径、flow: 水の量）
export const PIPES = [
  { s: 11.5, side: 1, y: 0.66, r: 0.05, flow: 0.35, kind: 'pvc' },
  { s: 27, side: 1, y: 0.5, r: 0.15, flow: 1, kind: 'hume' },
  { s: 49, side: -1, y: 0.62, r: 0.05, flow: 0.12, kind: 'pvc' },
  { s: 68.5, side: 1, y: 0.64, r: 0.05, flow: 0.55, kind: 'pvc' },
  { s: 88, side: 1, y: 0.58, r: 0.075, flow: 0.45, kind: 'pvc' },
  { s: 95.5, side: -1, y: 0.7, r: 0.05, flow: 0, kind: 'pvc' },
];
// 水草の茂みの帯（s0..s1、side、種類、濃さ）。生き物の居場所もここから決める
export const WEEDS = [
  { s0: 4, s1: 9, side: 1, kind: 'sekisho', k: 0.8 },
  { s0: 7.5, s1: 12, side: -1, kind: 'sekisho', k: 0.6 },
  { s0: 13, s1: 21, side: 0, kind: 'ebimo', k: 0.9 },
  { s0: 16, s1: 24, side: 1, kind: 'sekisho', k: 0.9 },
  { s0: 21, s1: 26, side: -1, kind: 'cress', k: 0.9 },
  { s0: 28, s1: 35, side: 0, kind: 'ebimo', k: 1 },
  { s0: 30, s1: 37, side: -1, kind: 'sekisho', k: 0.7 },
  { s0: 43, s1: 49, side: 1, kind: 'cress', k: 1 },
  { s0: 45, s1: 54, side: 0, kind: 'ebimo', k: 0.6 },
  { s0: 50, s1: 56, side: -1, kind: 'sekisho', k: 0.8 },
  { s0: 64, s1: 71, side: 1, kind: 'sekisho', k: 1 },
  { s0: 66, s1: 74, side: 0, kind: 'ebimo', k: 0.9 },
  { s0: 70, s1: 76, side: -1, kind: 'cress', k: 0.8 },
  { s0: 81, s1: 86, side: 1, kind: 'cress', k: 0.9 },
  { s0: 82, s1: 97, side: 0, kind: 'ebimo', k: 1 },
  { s0: 84, s1: 99, side: 1, kind: 'sekisho', k: 1 },
  { s0: 88, s1: 99, side: -1, kind: 'sekisho', k: 0.9 },
];

const N = makeNoise2D(9031);

/** コンクリートの底の高さ（桝の中は深い） */
export function floorC(s) {
  let y = 0;
  for (const d of DROPS) {
    if (s >= d.s) y += d.h;
    else if (s > d.s - d.pool) y -= d.poolD * smoothstep(d.s - d.pool, d.s - d.pool + 0.06, s);
  }
  if (s > S_GATE + 0.4) y += 0.12;
  return y;
}

/** 壁の上の高さ（まわりの地面）。落ち込みの前後でなだらかに上がる */
export function groundAt(s) {
  let y = WALL_H;
  for (const d of DROPS) y += d.h * smoothstep(d.s - 3.5, d.s + 3.5, s);
  y += 0.12 * smoothstep(S_GATE - 2, S_GATE + 3, s);
  return y;
}
/** 横切る道の盛り上がり（暗渠の上） */
export function humpAt(s) {
  const c = CULVERT, m = (c.s0 + c.s1) / 2, h = (ROAD2.w / 2) + 2.2;
  return c.hump * (1 - smoothstep(ROAD2.w / 2 - 0.2, h, Math.abs(s - m)));
}
/** 暗渠の天井（底からではなく絶対の高さ）。暗渠の外は大きな値 */
export const CEIL = groundAt(ROAD2.s) + CULVERT.hump - CULVERT.slab;
export function ceilingAt(s) {
  const c = CULVERT;
  if (s < c.s0 || s > c.s1) return 99;
  return CEIL;
}
// 歩いて出入りするはしご（壁の鉄の足掛け）
export const LADDERS = [{ s: 1.2, side: -1 }, { s: S_END + 0.55, side: -1 }];
// 壁の水抜き穴（2m ごと、左右で交互）
export const weepHoles = () => {
  const out = [];
  // U 字溝 1 本（2m）のまん中、s = 2k + 1。k が偶数なら田んぼ側（シェーダーの汚れの跡と同じ決め方）
  for (let k = -2; 2 * k + 1 < S_FAR; k++) {
    const s = 2 * k + 1;
    if (s > CULVERT.s0 - 0.5 && s < CULVERT.s1 + 0.5) continue;
    if (DROPS.some((d) => Math.abs(s - d.s) < 1.2)) continue;
    const side = ((k % 2) + 2) % 2 === 0 ? 1 : -1;
    out.push({ s, side, y: floorC(s) + 0.72 });
  }
  return out;
};

/** 水位 */
export function levelAt(s) {
  let L = DEPTH;
  for (const d of DROPS) if (s >= d.s) L += d.h;
  if (s >= S_GATE) L += 0.12 + 0.2;
  // 落ち込みの縁の手前で水面が下がる
  for (const d of DROPS) if (s >= d.s && s < d.s + 0.9) { const k = 1 - (s - d.s) / 0.9; L -= 0.075 * k * k; }
  return L;
}

/** 底の泥・砂のたまり（コンクリートの上の厚さ） */
export function sedAt(x, s) {
  const ax = Math.abs(x);
  let t = 0.025 + 0.03 * (N(x * 1.3, s * 0.35) * 0.5 + 0.5) + 0.02 * (N(x * 4 + 3, s * 1.4) * 0.5 + 0.5);
  t += 0.05 * smoothstep(HW - 0.32, HW, ax);                       // 壁ぎわにたまる
  for (const d of DROPS) {
    if (s < d.s && s > d.s - 0.7) t *= smoothstep(d.s, d.s - 0.7, s) * 0.8;   // 落ちてくる水で削られる
    if (s >= d.s && s < d.s + 1.2) t *= 0.35 + 0.65 * smoothstep(d.s, d.s + 1.2, s);
  }
  if (s > CULVERT.s0 - 0.5 && s < CULVERT.s1 + 0.5) t *= 0.55;
  return clamp(t, 0, 0.13);
}
/** 歩く・生き物が這う底の高さ */
export function bedAt(x, s) { return floorC(s) + sedAt(x, s); }

/** 側溝の中（水のある所）か */
export const inDitch = (x, s) => Math.abs(x) < HW && s > S_GRATE && s < S_FAR;

// GLSL: 水位（側溝の外は -99）。z は世界の z（s = -z）
export const LEVEL_GLSL = /* glsl */ `
float ditchLevel(vec3 p) {
  if (abs(p.x) > ${(HW + 0.02).toFixed(3)}) return -99.0;
  float s = -p.z;
  if (s < ${S_GRATE.toFixed(2)} || s > ${S_FAR.toFixed(2)}) return -99.0;
  float L = ${DEPTH.toFixed(3)};
  ${DROPS.map((d) => `if (s >= ${d.s.toFixed(3)}) L += ${d.h.toFixed(3)};`).join('\n  ')}
  if (s >= ${S_GATE.toFixed(3)}) L += 0.32;
  ${DROPS.map((d) => `if (s >= ${d.s.toFixed(3)} && s < ${(d.s + 0.9).toFixed(3)}) { float k = 1.0 - (s - ${d.s.toFixed(3)}) / 0.9; L -= 0.075 * k * k; }`).join('\n  ')}
  return L;
}
`;
