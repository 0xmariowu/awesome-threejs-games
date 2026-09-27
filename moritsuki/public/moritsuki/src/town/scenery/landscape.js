// 田園の地形: 町並みの外の土地を「田んぼ」「森」「草地」に分ける
// ・谷の平地を広く見せるため、山すその低い所をなだらかにならす（山・湾・川の位置関係はそのまま）
// ・急な所と高い所は森、平らで低い所は田んぼ、海ぎわは草地
import * as THREE from 'three';

const ss = THREE.MathUtils.smoothstep;

// 山すそをならす高さの変換: H0 より低い所はそのまま、H1 より高い所もそのまま、間を下へ寄せる（単調なので地形の並びは変わらない）
const H0 = 2.5, H1 = 30, EXP = 1.35;
const shape = (h) => (h <= H0 || h >= H1 ? h : H0 + (H1 - H0) * Math.pow((h - H0) / (H1 - H0), EXP));

export function shapeValley(data) {
  for (const g of [data.core, data.outer]) for (let i = 0; i < g.h.length; i++) g.h[i] = shape(g.h[i]);
}

// 森らしさ 0..1（傾き・高さから）
export function forestness(h, slope) {
  if (h < 0.4) return 0;
  return Math.max(ss(slope, 0.11, 0.19), ss(h, 20, 30) * ss(slope, 0.04, 0.1), ss(h, 34, 42));
}

// 外周の森を見た目だけ盛り上げる割合（森のきわは低いまま。田んぼを森のきわまで広げるので）
export const canopyLift = (f) => ss(f, 0.45, 1);

// 町並みの外の土地の種類
export function landKind(h, slope) {
  if (h < 0.4) return 'grass';
  return forestness(h, slope) > 0.5 ? 'forest' : 'paddy';
}

// 森と田んぼの境目の細かいぶつぶつをならす（5×5 の多数決を 2 回）。kinds を書きかえる
export function smoothKinds(kinds, nx, nz, locked) {
  for (let it = 0; it < 2; it++) {
    const src = kinds.slice();
    for (let j = 2; j < nz - 2; j++) for (let i = 2; i < nx - 2; i++) {
      const c = j * nx + i, k = src[c];
      if (locked[c] || (k !== 'forest' && k !== 'paddy')) continue;
      let f = 0, n = 0;
      for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++) {
        const q = src[c + dj * nx + di];
        if (q === 'forest') { f++; n++; } else if (q === 'paddy') n++;
      }
      if (n < 8) continue;
      kinds[c] = f * 2 > n ? 'forest' : 'paddy';
    }
  }
}
