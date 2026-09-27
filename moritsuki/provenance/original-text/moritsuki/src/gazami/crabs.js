// カニのモデル（実寸。1 匹ずつ模様・色がちがう）: タイワンガザミ（オス・メス）とイシガニ
//
// 形
// ・甲羅: 縁の形（前縁の歯・眼のくぼみ・前側縁の歯・後側縁）を決めて中心から輪で張る。内側の輪は歯のない本体の縁をなぞり、
//   いちばん外の帯で本当の縁へ移る。上面は低いドームに、胃域・心域・鰓域のふくらみと、頸溝（V の溝）・粒の並んだ稜線
// ・横の長いとげ: 甲羅とは別の、根もとの太い丸いとげ（少し前へ反る）
// ・はさみ脚: 長節（三角柱。前のふちに鋭いとげ 4 本）・腕節（内と外にとげ）・掌（稜の立った角柱、指の付け根の上にとげ）・
//   不動指と可動指（長く、内側に大小の歯、先は鉤になって交差する）
// ・歩脚 3 対（前後に平たい刃のような節、先は槍の穂の形）と遊泳脚（先の 2 節がオール。ふちに毛の房）
// ・眼（柄の先の黒い玉）・触角・口のまわりの板・腹のふた（オスは細い T 字、メスは幅の広い丸）
// 模様はシェーダーで（オスは青むらさきの甲羅に水色の網目、脚は明るい青に白い点。メスは緑がかった茶、イシガニは暗いオリーブ）
//
// 動き（pose）
// ・歩く: 横歩き。ハサミは軽くバンザイ（ふり上げて少し開く）。歩脚は脚先を地面に置いて（IK）、4 本ずつ交互に踏みかえる。
//   遊泳脚は背の上でゆっくりかく
// ・威嚇: 体を持ち上げ、ハサミを大きく広げて開く。遊泳脚も振り上げる
// ・暴れる（持ち上げられた時）・たたむ（砂の中）・並べる（結果）
// 姿勢の切りかえは、関節の角度をなめらかに寄せる
//
// ローカル座標: +z = 前（眼）、+x = カニの左、y = 上。原点 = 甲羅の縁の高さの中心
import * as THREE from 'three';
import { patchMaterial } from './shade.js';
import { RNG, clamp, lerp, smoothstep } from './core/noise.js';
import { CRABS } from './species.js';

const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;

// ───────── 甲羅の縁 ─────────
const qb = (a, c, b, t) => [(1 - t) * (1 - t) * a[0] + 2 * (1 - t) * t * c[0] + t * t * b[0], (1 - t) * (1 - t) * a[1] + 2 * (1 - t) * t * c[1] + t * t * b[1]];

/** 前側縁の弧に、前を向いた歯を並べる（歯の間も細かく点を置く） */
function toothedArc(out, A, C, B, n, len, lastBig = 1) {
  const N = n * 6;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const p = qb(A, C, B, t);
    const k = i % 6;
    if (k === 3 && i < N) {
      const e = 1e-3;
      const p2 = qb(A, C, B, Math.min(1, t + e));
      let tx = p2[0] - p[0], tz = p2[1] - p[1];
      const tl = Math.hypot(tx, tz); tx /= tl; tz /= tl;
      const nx = tz, nz = -tx;
      const L = len * (i >= N - 6 ? lastBig : 1) * (0.9 + 0.2 * Math.sin(t * 3));
      out.push([p[0] + (nx * 0.55 - tx * 0.84) * L, p[1] + (nz * 0.55 - tz * 0.84) * L, 1]);
    } else out.push([p[0], p[1], 0]);
  }
}

// 右半分（x ≥ 0）を前の中央から後ろの中央まで。[x, z, 刃か]
const SHAPES = {
  taiwan: {
    Wz: 0.235,                // 甲羅の長さの半分 / 幅（とげ込み）
    uX: 0.71, uZ: 0.86, uE: 1.8, cz: -0.02,
    top: 0.2, bot: 0.27,
    outline() {
      const o = [[0, 0.84, 0], [0.03, 0.9, 0], [0.06, 0.955, 1], [0.085, 0.9, 0], [0.105, 0.845, 0], [0.13, 0.89, 0], [0.155, 0.94, 1], [0.175, 0.88, 0], [0.19, 0.83, 0],
        [0.215, 0.795, 0], [0.245, 0.748, 0], [0.28, 0.738, 0], [0.31, 0.762, 0], [0.33, 0.82, 0], [0.345, 0.878, 1]];
      toothedArc(o, [0.355, 0.79], [0.62, 0.7], [0.7, 0.13], 7, 0.062);
      // 長いとげの根もと（とげ本体は別の形）
      o.push([0.74, 0.14, 1], [0.76, 0.12, 1], [0.74, 0.09, 1], [0.7, 0.04, 0]);
      for (let i = 1; i <= 12; i++) { const p = qb([0.7, 0.04], [0.5, -0.33], [0.27, -0.8], i / 12); o.push([p[0], p[1], 0]); }
      o.push([0.2, -0.84, 0], [0.1, -0.855, 0], [0, -0.85, 0]);
      return o;
    },
    spine: { base: [0.7, 0.1], tip: [1.0, 0.2], r: 0.022 },
    relief(x, z) {
      const ax = Math.abs(x);
      let h = 0.05 * Math.exp(-((x / 0.17) ** 2) - (((z - 0.28) / 0.2) ** 2));
      h += 0.024 * Math.exp(-(((ax - 0.16) / 0.1) ** 2) - (((z - 0.46) / 0.13) ** 2));
      h += 0.038 * Math.exp(-((x / 0.12) ** 2) - (((z + 0.36) / 0.15) ** 2));
      h += 0.03 * Math.exp(-(((ax - 0.42) / 0.2) ** 2) - (((z + 0.12) / 0.28) ** 2));
      // 頸溝: 胃域を囲む V の溝
      h -= 0.02 * Math.exp(-((segDist(ax, z, 0.3, 0.14, 0.06, -0.14) / 0.032) ** 2));
      // 稜線（粒が並ぶ）: 横のとげの根もとから内前へ・鰓域の斜めの線
      const r1 = Math.exp(-((segDist(ax, z, 0.68, 0.12, 0.22, 0.34) / 0.016) ** 2));
      const r2 = Math.exp(-((segDist(ax, z, 0.28, -0.04, 0.5, -0.3) / 0.014) ** 2)) * 0.6;
      return { h: h + 0.01 * r1 + 0.006 * r2, ridge: Math.max(r1, r2) };
    },
    legs: { cheliped: [0.29, 0.5], walk: [[0.53, 0.2], [0.55, -0.06], [0.5, -0.3]], swim: [0.4, -0.52] },
    eye: [0.265, 0.77],
  },
  ishi: {
    Wz: 0.345,
    uX: 0.94, uZ: 0.88, uE: 2.2, cz: -0.02,
    top: 0.2, bot: 0.28,
    outline() {
      const o = [[0, 0.83, 0], [0.045, 0.905, 1], [0.08, 0.835, 0], [0.12, 0.9, 1], [0.155, 0.83, 0], [0.195, 0.885, 1], [0.225, 0.8, 0],
        [0.255, 0.75, 0], [0.3, 0.735, 0], [0.345, 0.765, 0], [0.37, 0.83, 0], [0.39, 0.885, 1]];
      toothedArc(o, [0.405, 0.8], [0.8, 0.7], [0.955, 0.13], 5, 0.09, 1.4);
      o.push([0.985, 0.16, 1], [1.0, 0.13, 1], [0.97, 0.06, 0]);
      for (let i = 1; i <= 12; i++) { const p = qb([0.97, 0.06], [0.86, -0.42], [0.47, -0.84], i / 12); o.push([p[0], p[1], 0]); }
      o.push([0.3, -0.875, 0], [0.15, -0.885, 0], [0, -0.88, 0]);
      return o;
    },
    spine: null,
    relief(x, z) {
      const ax = Math.abs(x);
      let h = 0.045 * Math.exp(-((x / 0.2) ** 2) - (((z - 0.25) / 0.22) ** 2));
      h += 0.04 * Math.exp(-((x / 0.14) ** 2) - (((z + 0.35) / 0.16) ** 2));
      h += 0.028 * Math.exp(-(((ax - 0.5) / 0.22) ** 2) - (((z + 0.1) / 0.3) ** 2));
      h -= 0.018 * Math.exp(-((segDist(ax, z, 0.32, 0.12, 0.08, -0.14) / 0.03) ** 2));
      // イシガニの甲羅には、横に走る粒の稜線が何本もある
      let ridge = 0;
      for (const [x0, z0, x1, z1] of [[0.1, 0.55, 0.3, 0.52], [0.4, 0.35, 0.8, 0.22], [0.25, 0.08, 0.6, 0.0], [0.15, -0.3, 0.45, -0.38]]) ridge = Math.max(ridge, Math.exp(-((segDist(ax, z, x0, z0, x1, z1) / 0.016) ** 2)));
      return { h: h + 0.008 * ridge, ridge };
    },
    legs: { cheliped: [0.36, 0.52], walk: [[0.66, 0.2], [0.7, -0.08], [0.64, -0.34]], swim: [0.5, -0.56] },
    eye: [0.3, 0.765],
  },
  // タラバガニ（ヤドカリの仲間）: 甲羅は後ろ寄りがいちばん幅の広い、丸みのある五角形（ハート形）。前に長い額角（ロストラム）。
  // 縁も背中も円すいのとげだらけ。歩脚は 3 対で長く太い（4 対目は甲羅の中にしまってあって見えない）。ハサミは右が大きい
  taraba: {
    king: true,
    Wz: 0.5,
    uX: 1.0, uZ: 0.95, uE: 2.3, cz: -0.06,
    top: 0.19, bot: 0.23,
    outline() {
      const o = [[0, 0.8, 0], [0.05, 0.797, 0], [0.09, 0.785, 0], [0.12, 0.765, 0]];
      // 眼のくぼみ
      for (let i = 1; i <= 6; i++) { const p = qb([0.12, 0.765], [0.19, 0.66], [0.27, 0.735], i / 6); o.push([p[0], p[1], 0]); }
      // 前側縁 → いちばん幅の広い所（後ろ寄り）→ 後側縁 → 後縁
      for (let i = 1; i <= 16; i++) { const p = qb([0.27, 0.735], [0.74, 0.64], [0.98, -0.08], i / 16); o.push([p[0], p[1], 0]); }
      for (let i = 1; i <= 12; i++) { const p = qb([0.98, -0.08], [1.03, -0.62], [0.46, -0.89], i / 12); o.push([p[0], p[1], 0]); }
      o.push([0.31, -0.925, 0], [0.16, -0.945, 0], [0, -0.94, 0]);
      return o;
    },
    spine: null,
    relief(x, z) {
      const ax = Math.abs(x);
      // 胃域・心域・鰓域・肝域が大きくふくらみ、その間を深い溝が分ける
      let h = 0.05 * Math.exp(-((x / 0.24) ** 2) - (((z - 0.34) / 0.25) ** 2));
      h += 0.04 * Math.exp(-((x / 0.15) ** 2) - (((z + 0.3) / 0.2) ** 2));
      h += 0.055 * Math.exp(-(((ax - 0.54) / 0.27) ** 2) - (((z + 0.17) / 0.36) ** 2));
      h += 0.022 * Math.exp(-(((ax - 0.4) / 0.12) ** 2) - (((z - 0.5) / 0.12) ** 2));
      h -= 0.026 * Math.exp(-((segDist(ax, z, 0.36, 0.3, 0.12, 0.03) / 0.045) ** 2));
      h -= 0.024 * Math.exp(-((segDist(ax, z, 0.22, 0.0, 0.25, -0.58) / 0.045) ** 2));
      h -= 0.012 * Math.exp(-((segDist(ax, z, 0.25, -0.58, 0.1, -0.78) / 0.04) ** 2));
      return { h, ridge: 0 };
    },
    legs: { cheliped: [0.3, 0.6], walk: [[0.6, 0.3], [0.68, 0.0], [0.62, -0.32]], swim: null },
    legFwd: [0.62, 0.03, -0.58],
    eye: [0.15, 0.775],
    antenna: [[0.05, 0.3], [0.1, 0.13]],
    // 背中のとげ [x, z, 大きさ]（右半分。左は写す）: 胃域 3 対・肝域・心域・腸域・鰓域の群れ
    spines: [
      [0.08, 0.53, 0.85], [0.17, 0.4, 1], [0.07, 0.3, 0.8], [0.33, 0.53, 0.8], [0.43, 0.42, 0.7], [0.26, 0.2, 0.6],
      [0.08, -0.18, 1], [0.1, -0.38, 0.9], [0.09, -0.64, 0.75],
      [0.4, 0.15, 0.9], [0.56, 0.12, 1], [0.72, 0.03, 0.85], [0.47, -0.06, 1], [0.63, -0.18, 1.05], [0.82, -0.18, 0.8],
      [0.38, -0.3, 0.9], [0.54, -0.4, 0.95], [0.72, -0.42, 0.8], [0.42, -0.58, 0.8], [0.6, -0.6, 0.7], [0.3, -0.76, 0.65],
    ],
  },
};

const uOf = (S, x, z) => Math.pow(Math.pow(Math.abs(x / S.uX), S.uE) + Math.pow(Math.abs((z - S.cz) / S.uZ), S.uE), 1 / S.uE);
/** 甲羅の上面の高さ（x, z は幅・長さの半分を 1 とした値）。L = 甲羅の長さ */
function topY(S, x, z, L, bump) {
  const u = uOf(S, x, z);
  const d = u < 1 ? Math.pow(1 - u * u, 0.45) : 0;
  const rel = S.relief(x, z);
  let y = (S.top * d * bump * (1 - 0.16 * smoothstep(0.2, 0.9, z)) + rel.h * smoothstep(1.02, 0.7, u)) * L;
  // 縁は薄い刃にせず、2mm ほどの厚みを残す（歯の先だけ細く）
  y = Math.max(y, 0.0011 * (1 - smoothstep(1, 1.5, u)) + 0.0004);
  return { y, u, ridge: rel.ridge * (u < 0.98 ? 1 : 0) };
}

/** 点 (x, z) と線分 (x0, z0)-(x1, z1) の距離 */
function segDist(x, z, x0, z0, x1, z1) {
  const dx = x1 - x0, dz = z1 - z0;
  const t = clamp(((x - x0) * dx + (z - z0) * dz) / (dx * dx + dz * dz), 0, 1);
  return Math.hypot(x - x0 - dx * t, z - z0 - dz * t);
}

// ───────── 形の部品 ─────────
// 属性: aPart 部位, aT 長さ方向 0..1（甲羅は縁からの位置 u）, aLoc 模様の座標, aAux 印（稜線・関節の膜・毛）
// aPart: 0 甲羅の上, 1 甲羅の下, 2 脚, 3 はさみの指, 4 眼, 5 とげ・歯, 6 遊泳脚の毛, 7 はさみの掌
function geoFrom(pos, idx, part, T, loc, aux) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aPart', new THREE.Float32BufferAttribute(part, 1));
  g.setAttribute('aT', new THREE.Float32BufferAttribute(T, 1));
  g.setAttribute('aLoc', new THREE.Float32BufferAttribute(loc, 2));
  g.setAttribute('aAux', new THREE.Float32BufferAttribute(aux, 1));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
/** three の形に部位の属性を付ける */
function tag(g, part, T = 1, aux = 0) {
  const n = g.attributes.position.count;
  if (g.attributes.uv) g.deleteAttribute('uv');
  g.setAttribute('aPart', new THREE.Float32BufferAttribute(new Array(n).fill(part), 1));
  g.setAttribute('aT', new THREE.Float32BufferAttribute(new Array(n).fill(T), 1));
  g.setAttribute('aLoc', new THREE.Float32BufferAttribute(new Array(n * 2).fill(0), 2));
  g.setAttribute('aAux', new THREE.Float32BufferAttribute(new Array(n).fill(aux), 1));
  return g;
}

/** 甲羅（上面・下面）。W = とげ込みの幅 m */
function carapaceGeo(shape, W, rng, sex) {
  const S = SHAPES[shape];
  const Wh = W / 2, Lh = W * S.Wz;
  const half = S.outline();
  const ring = [...half, ...half.slice(1, -1).reverse().map(([x, z, b]) => [-x, z, b])];
  const NR = ring.length, NS = 26;
  const C = [0, S.cz];
  // 内側の輪がなぞる本体の縁（歯・とげの先は前後の点の間を割る）
  const body = ring.map(([ex, ez, b]) => {
    if (b) return null;
    const u = uOf(S, ex, ez);
    return [C[0] + (ex - C[0]) / u, C[1] + (ez - C[1]) / u];
  });
  for (let j = 0; j < NR; j++) {
    if (body[j]) continue;
    let a = j, b = j;
    while (!body[(a - 1 + NR) % NR]) a--;
    while (!body[(b + 1) % NR]) b++;
    const A = body[(a - 1 + NR) % NR], B = body[(b + 1) % NR];
    const k = (j - a + 1) / (b - a + 2);
    body[j] = [lerp(A[0], B[0], k), lerp(A[1], B[1], k)];
  }
  const SB = 0.84;
  const pos = [], idx = [], part = [], T = [], loc = [], aux = [];
  const L = Lh * 2;
  const bump = rng.range(0.92, 1.08);
  for (const side of [1, -1]) {
    const base = pos.length / 3;
    for (let i = 0; i <= NS; i++) {
      const s = i / NS;
      const ss = side > 0 ? 1 - Math.pow(1 - s, 1.7) : s;
      for (let j = 0; j < NR; j++) {
        const [ex, ez] = ring[j];
        const [bx, bz] = body[j];
        let x, z;
        if (ss <= SB) { const k = ss / SB; x = C[0] + (bx - C[0]) * k; z = C[1] + (bz - C[1]) * k; }
        else { const k = (ss - SB) / (1 - SB); x = lerp(bx, ex, k); z = lerp(bz, ez, k); }
        const u = uOf(S, x, z);
        let y, rg = 0;
        if (side > 0) {
          const tp = topY(S, x, z, L, bump);
          y = tp.y; rg = tp.ridge;
        } else {
          const d = u < 1 ? Math.pow(1 - Math.pow(u, 2.2), 0.7) : 0;
          y = -S.bot * L * d;
          // 胸板の節の段（腹側の縫い目）
          if (u < 0.85) y += Math.sin(z * 22) * 0.0006 * smoothstep(0.85, 0.5, u);
          y = Math.min(y, -0.0009 * (1 - smoothstep(1, 1.5, u)) - 0.0003);
        }
        pos.push(x * Wh, y, z * Lh);
        part.push(side > 0 ? 0 : 1);
        T.push(u);
        loc.push(x, z);
        aux.push(rg);
      }
    }
    for (let i = 0; i < NS; i++) for (let j = 0; j < NR; j++) {
      const a = base + i * NR + j, b = base + i * NR + ((j + 1) % NR), c = a + NR, d = b + NR;
      if (side > 0) idx.push(a, b, c, b, d, c); else idx.push(a, c, b, b, c, d);
    }
  }
  void sex;
  const geo = geoFrom(pos, idx, part, T, loc, aux);
  geo.userData.bump = bump;
  return geo;
}

/**
 * タラバガニの甲羅のとげ: 背中の円すいのとげ・小さな粒・縁のとげ・額角（前へ突き出たとげ。先は二またで、根もとの上にもとげ）
 * 背中のとげは甲羅の面に立てる（少し前・外へ傾ける）
 */
function kingSpinesGeo(S, W, bump, rng) {
  const Wh = W / 2, Lh = W * S.Wz, L = Lh * 2;
  const P = (x, z) => V3(x * Wh, topY(S, x, z, L, bump).y, z * Lh);
  const N = (x, z) => {
    const e = 0.01;
    const dx = P(x + e, z).sub(P(x - e, z)), dz = P(x, z + e).sub(P(x, z - e));
    return new THREE.Vector3().crossVectors(dz, dx).normalize();
  };
  const list = [];
  const spike = (x, z, s, lean = 1) => {
    const p = P(x, z), n = N(x, z);
    const r = W * 0.017 * s;
    const d = n.clone().add(V3(Math.sign(x) * 0.22 * Math.abs(x) * lean, 0, 0.3 * lean));
    list.push(spikeGeo(p.addScaledVector(n, -r * 0.5), d, W * 0.078 * s, r, 5, 0.08));
  };
  const placed = [];
  for (const [x, z, s] of S.spines) for (const sd of x < 0.02 ? [1] : [1, -1]) { spike(sd * x, z, s * rng.range(0.88, 1.12)); placed.push([sd * x, z]); }
  // 小さな粒（低いとげ）を、大きなとげの間に
  for (let k = 0, n = 0; k < 400 && n < 64; k++) {
    const x = rng.range(-0.9, 0.9), z = rng.range(-0.85, 0.7);
    if (uOf(S, x, z) > 0.9) continue;
    if (placed.some(([px, pz]) => Math.hypot(px - x, (pz - z) * 1.1) < 0.1)) continue;
    placed.push([x, z]); n++;
    spike(x, z, rng.range(0.28, 0.45), 0.5);
  }
  // 縁のとげ: 眼のくぼみの外から後ろまで、縁にそって外・上へ
  const half = S.outline();
  let acc = 0;
  for (let j = 10; j < half.length - 4; j++) {
    const [x0, z0] = half[j - 1], [x1, z1] = half[j];
    acc += Math.hypot((x1 - x0) * Wh, (z1 - z0) * Lh);
    if (acc < W * 0.052) continue;
    acc = 0;
    const tx = (x1 - x0) * Wh, tz = (z1 - z0) * Lh, tl = Math.hypot(tx, tz);
    const nx = -tz / tl, nz = tx / tl;   // 外向き（右まわりの縁で）
    const out = V3(nx, 0, nz);
    if (out.x * x1 * Wh + out.z * (z1 - S.cz) * Lh < 0) out.multiplyScalar(-1);
    const s = (0.75 + 0.45 * smoothstep(0.7, 0.0, Math.abs(z1 + 0.05))) * rng.range(0.9, 1.1);
    for (const sd of [1, -1]) {
      const p = V3(sd * x1 * Wh * 0.985, W * 0.004, z1 * Lh * 0.985);
      const d = V3(out.x * sd, 0.42, out.z + 0.12);
      list.push(spikeGeo(p, d, W * 0.075 * s, W * 0.016 * s, 5, 0.1));
    }
  }
  // 額角
  const rb = P(0, 0.7);
  const rd = V3(0, 0.28, 1).normalize();
  const rl = W * 0.17;
  list.push(spikeGeo(rb.clone().add(V3(0, -W * 0.012, 0)), rd, rl, W * 0.024, 5, 0));
  const tip = rb.clone().addScaledVector(rd, rl * 0.8);
  for (const sd of [1, -1]) list.push(spikeGeo(tip.clone(), V3(sd * 0.55, 0.35, 1), W * 0.04, W * 0.007, 5, 0));
  list.push(spikeGeo(P(0, 0.62).add(V3(0, -W * 0.004, 0)), V3(0, 1, 0.55), W * 0.06, W * 0.013, 5, 0.1));
  for (const sd of [1, -1]) list.push(spikeGeo(P(sd * 0.06, 0.72).add(V3(0, -W * 0.004, 0)), V3(sd * 0.3, 0.8, 0.8), W * 0.04, W * 0.009, 5, 0.1));
  return mergeGeos(list);
}

// 断面の形（単位の大きさ。a = 0..2π）
const CROSS = {
  round: (a) => [Math.cos(a), Math.sin(a)],
  // 角の丸い三角柱（はさみ脚の長節）
  tri: (a) => { const k = 1 + 0.16 * Math.cos(3 * a + Math.PI); return [Math.cos(a) * k, Math.sin(a) * k]; },
  // 稜の立った六角柱（掌）
  palm: (a) => { const k = 1 + 0.07 * Math.pow(Math.max(0, Math.cos(6 * a)), 3) - 0.03; return [Math.cos(a) * k, Math.sin(a) * k]; },
  // 上に背の立った刃（歩脚の節）
  blade: (a) => { const s = Math.sin(a); return [Math.cos(a) * (1 - 0.25 * s * s), s * (1 + 0.08 * Math.max(0, s))]; },
};

/**
 * 管の節（+y 方向へ長さ len）。prof(t) → [rx, rz]（x・z 方向の半径）、bend(t) → [dx, dz]（曲がり）
 * cross: 断面の形、tip: 先を閉じてとがらせる、ends: 両端の関節の膜の印
 */
function tubeGeo(len, prof, { ns = 10, nr = 14, part = 2, bend = null, cross = CROSS.round, tip = false, ends = true, loc0 = 0, aOff = 0 } = {}) {
  const pos = [], idx = [], P = [], T = [], loc = [], aux = [];
  for (let i = 0; i <= ns; i++) {
    const t = i / ns;
    let [rx, rz] = prof(t);
    if (tip && i === ns) { rx *= 0.02; rz *= 0.02; }
    const [dx, dz] = bend ? bend(t) : [0, 0];
    const mem = ends ? Math.max(smoothstep(0.1, 0.0, t), smoothstep(0.93, 1.0, t) * (tip ? 0 : 1)) : 0;
    for (let j = 0; j < nr; j++) {
      const a = (j / nr) * TAU;
      const [cx, cz] = cross(a);
      pos.push(dx + cx * rx, t * len, dz + cz * rz);
      P.push(part); T.push(t); loc.push(loc0 + t * len * 40, j / nr + aOff); aux.push(mem);
    }
  }
  for (let i = 0; i < ns; i++) for (let j = 0; j < nr; j++) {
    const a = i * nr + j, b = i * nr + ((j + 1) % nr), c = a + nr, d = b + nr;
    idx.push(a, c, b, b, c, d);
  }
  const c0 = pos.length / 3;
  pos.push(bend ? bend(0)[0] : 0, 0, bend ? bend(0)[1] : 0); P.push(part); T.push(0); loc.push(loc0, 0); aux.push(1);
  for (let j = 0; j < nr; j++) idx.push(c0, j, (j + 1) % nr);
  return geoFrom(pos, idx, P, T, loc, aux);
}

/** とげ（少し反った円すい）を、点 p から向き d へ */
function spikeGeo(p, d, len, r, part = 5, curl = 0.15) {
  const g = tubeGeo(len, (t) => { const k = Math.pow(1 - t, 0.9) * r; return [k, k]; }, { ns: 5, nr: 7, part, tip: true, ends: false, bend: (t) => [0, -t * t * len * curl] });
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V3(0, 1, 0), d.clone().normalize()));
  g.translate(p.x, p.y, p.z);
  return g;
}

/** 形をまとめる（位置・法線・aPart・aT・aLoc・aAux） */
export function mergeGeos(list) {
  let n = 0;
  for (const g of list) n += g.attributes.position.count;
  const pos = new Float32Array(n * 3), nrm = new Float32Array(n * 3), part = new Float32Array(n), T = new Float32Array(n), loc = new Float32Array(n * 2), aux = new Float32Array(n);
  const idx = [];
  let o = 0;
  for (const g of list) {
    const c = g.attributes.position.count;
    if (!g.attributes.normal) g.computeVertexNormals();
    pos.set(g.attributes.position.array, o * 3);
    nrm.set(g.attributes.normal.array, o * 3);
    part.set(g.attributes.aPart.array, o);
    T.set(g.attributes.aT.array, o);
    loc.set(g.attributes.aLoc.array, o * 2);
    aux.set(g.attributes.aAux.array, o);
    if (g.index) for (const i of g.index.array) idx.push(i + o);
    else for (let i = 0; i < c; i++) idx.push(i + o);
    o += c;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  geo.setAttribute('aPart', new THREE.BufferAttribute(part, 1));
  geo.setAttribute('aT', new THREE.BufferAttribute(T, 1));
  geo.setAttribute('aLoc', new THREE.BufferAttribute(loc, 2));
  geo.setAttribute('aAux', new THREE.BufferAttribute(aux, 1));
  geo.setIndex(n > 65535 ? new THREE.Uint32BufferAttribute(idx, 1) : new THREE.Uint16BufferAttribute(idx, 1));
  geo.computeBoundingSphere();
  return geo;
}

// ───────── 色と模様（シェーダー） ─────────
const CRAB_FX = {
  key: 'crab3',
  vdecl: 'attribute float aPart; attribute float aT; attribute vec2 aLoc; attribute float aAux; varying float vPart; varying float vT; varying vec2 vLoc; varying float vAux; varying vec3 vOP;',
  vcode: 'vPart = aPart; vT = aT; vLoc = aLoc; vAux = aAux; vOP = position;',
  decl: /* glsl */ `
    varying float vPart; varying float vT; varying vec2 vLoc; varying float vAux; varying vec3 vOP;
    uniform vec3 uBase; uniform vec3 uBase2; uniform vec3 uSpot; uniform vec3 uLimb; uniform vec3 uLimbSpot; uniform vec3 uTip;
    uniform vec3 uBelly; uniform vec3 uClaw; uniform vec3 uJoint; uniform vec3 uSetae; uniform vec3 uSpineTip; uniform float uUnder; uniform float uUnderLoc;
    uniform float uSeed; uniform float uSpotK; uniform float uWet; uniform float uScale; uniform float uSex;
    float cr_voro(vec2 p, out float edge) {
      vec2 ip = floor(p), fp = fract(p);
      float d1 = 8.0, d2 = 8.0;
      for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
        vec2 g = vec2(float(x), float(y));
        vec2 o = hm_h22(ip + g + uSeed * 7.0);
        vec2 r = g + o - fp;
        float d = dot(r, r);
        if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
      }
      edge = sqrt(d2) - sqrt(d1);
      return sqrt(d1);
    }
    float crGran;
  `,
  color: /* glsl */ `
    {
      vec3 col;
      float part = vPart;
      float edge;
      if (part < 0.5) {
        // ── 甲羅の上 ──
        vec2 q = vLoc * vec2(11.0, 12.5);
        q += (vec2(hm_vn(q * 0.9 + uSeed), hm_vn(q * 0.9 - uSeed + 4.0)) - 0.5) * 1.3;
        float v = cr_voro(q, edge);
        // 真ん中（胃域・心域）は地の色が濃く斑点が小さい。まわりほど淡い網目になる
        float mid = exp(-pow(vLoc.x / 0.34, 2.0) - pow((vLoc.y - 0.05) / 0.55, 2.0));
        float big = hm_fbm(vLoc * 3.0 + uSeed * 3.0);
        float sz = mix(0.36, 0.22, mid);
        float spot = smoothstep(sz, sz - 0.12, v) * uSpotK;
        float net = smoothstep(0.07, 0.015, edge) * (1.0 - mid) * 0.35 * uSpotK;
        float small = 0.0;
        { float e2; float v2 = cr_voro(q * 2.6 + 3.1, e2); small = smoothstep(0.18, 0.08, v2) * 0.6 * uSpotK; }
        col = mix(uBase, uBase2, clamp(mid * 0.9 + (big - 0.5) * 0.6, 0.0, 1.0));
        col = mix(col, uSpot, clamp(max(max(spot, net), small * (0.4 + mid * 0.6)), 0.0, 1.0));
        // 稜線の粒は明るく
        col = mix(col, uSpot * 1.1, vAux * 0.55);
        // 歯ととげの先は濃く
        col = mix(col, uTip, smoothstep(1.0, 1.25, vT) * 0.7);
      } else if (part < 1.5) {
        // ── 甲羅の下: クリーム色。ふちは上の色が回りこむ。口のまわりは暗い。腹のふた ──
        col = mix(uBelly, mix(uBase, uSpot, 0.35), smoothstep(0.62, 1.0, vT) * 0.8);
        col = mix(col, uBase * 0.8, smoothstep(0.3, 0.7, vLoc.y) * 0.85);
        // 腹のふた: オスは細い T 字（先がとがる）、メスは幅の広い丸
        float ax = abs(vLoc.x), zz = vLoc.y;
        float wAbd = mix(mix(0.07, 0.03, smoothstep(-0.7, 0.2, zz)), 0.34 * sqrt(max(0.0, 1.0 - pow((zz + 0.25) / 0.6, 2.0))), uSex);
        float inAbd = step(ax, wAbd) * step(zz, mix(0.18, 0.3, uSex)) * step(-0.85, zz);
        float rim = inAbd * smoothstep(wAbd - 0.015, wAbd, ax);
        float segl = inAbd * smoothstep(0.012, 0.0, abs(fract(zz * 6.0) - 0.5) - 0.47);
        col = mix(col, col * 0.78, rim + segl);
        // 胸板の縫い目
        float sut = (1.0 - inAbd) * smoothstep(0.018, 0.0, abs(fract(zz * 4.0 + ax * 1.5) - 0.5) - 0.47) * smoothstep(0.75, 0.45, vT);
        col *= 1.0 - sut * 0.2;
      } else if (part < 2.5 || part > 6.5) {
        // ── 脚・掌: 明るい地に、節にそって流れる点 ──
        vec2 q = vec2(vLoc.x * 2.4 * uScale, vLoc.y * 9.0);
        q += (vec2(hm_vn(q * 1.1 + uSeed), hm_vn(q * 1.1 + 9.0)) - 0.5) * 0.7;
        float v = cr_voro(q, edge);
        float spot = smoothstep(0.27, 0.13, v) * uSpotK;
        float big = hm_vn(vLoc * vec2(0.3 * uScale, 2.0) + uSeed * 2.0);
        vec3 base = part > 6.5 ? mix(uLimb, uClaw, 0.5) : uLimb;
        col = mix(base, base * 0.7 + uBase * 0.3, big * 0.5);
        col = mix(col, uLimbSpot, spot);
        // 関節の膜: うすい赤むらさき
        col = mix(col, uJoint, vAux * 0.55);
        // 下側（腹側）は白っぽい
        float upness = uUnderLoc > 0.5 ? sin(vLoc.y * 6.2832) * step(0.001, abs(vLoc.x) + abs(vLoc.y)) : vOP.z / max(length(vOP.xz), 1e-4);
        float under = smoothstep(0.3, -0.7, upness);
        col = mix(col, uBelly, under * uUnder);
      } else if (part < 3.5) {
        // ── はさみの指: 根もとは掌の色、先へ行くほど濃い ──
        col = mix(uClaw, uLimb, 0.3);
        col = mix(col, uLimbSpot, smoothstep(0.3, 0.15, cr_voro(vec2(vLoc.x * 1.2 * uScale, vLoc.y * 4.0), edge)) * (1.0 - vT) * 0.7 * uSpotK);
        col = mix(col, uTip, smoothstep(0.45, 0.9, vT));
      } else if (part < 4.5) {
        col = vec3(0.02, 0.018, 0.018);
      } else if (part < 5.5) {
        // とげ・歯: 根もとは地の色、先は白っぽい（はさみの歯）か濃い（とげ）
        col = mix(uLimb, uSpineTip, vT);
      } else {
        // 遊泳脚のふちの毛の房: うす茶
        col = uSetae;
      }
      // 甲羅の細かい粒（明るい点）
      if (part < 0.5) {
        vec2 gp = vLoc * vec2(170.0, 190.0);
        float gk = 1.0 - smoothstep(0.25, 0.6, length(fwidth(gp)));
        crGran = hm_h21(floor(gp + uSeed * 13.0));
        col *= 1.0 + step(0.78, crGran) * 0.25 * gk;
      }
      diffuseColor.rgb = col;
    }
  `,
  normal: /* glsl */ `
    {
      if (vPart < 0.5) {
        vec2 gp = vLoc * vec2(170.0, 190.0);
        float gk = 1.0 - smoothstep(0.25, 0.6, length(fwidth(gp)));
        vec2 g = (hm_h22(floor(gp + uSeed * 13.0)) - 0.5) * (0.35 + vAux * 0.5) * gk;
        normal = normalize(normal + (viewMatrix * vec4(g.x, 0.0, g.y, 0.0)).xyz * 0.6);
      } else if (uUnderLoc > 0.5 && vPart > 1.5 && (vPart < 2.5 || vPart > 6.5)) {
        // タラバガニの脚・ハサミ: 細かいいぼ
        vec2 gp = vec2(vLoc.x * 3.0, vLoc.y * 22.0);
        float gk = 1.0 - smoothstep(0.3, 0.7, length(fwidth(gp)));
        vec2 g = (vec2(hm_vn(gp + uSeed), hm_vn(gp * 1.3 + 5.1)) - 0.5) * 0.35 * gk;
        normal = normalize(normal + vec3(g, 0.0));
      }
    }
  `,
  rough: /* glsl */ `
    roughnessFactor = mix(0.62, 0.32, uWet);
    if (vPart > 3.5 && vPart < 4.5) roughnessFactor = 0.08;
    if (vPart > 5.5 && vPart < 6.5) roughnessFactor = 0.8;
  `,
};

// 種類ごとの色（リニアの値で書く）
const PALETTE = {
  taiwanM: {
    base: [0.022, 0.04, 0.15], base2: [0.06, 0.035, 0.085], spot: [0.33, 0.5, 0.78], limb: [0.03, 0.1, 0.42], limbSpot: [0.55, 0.7, 0.92],
    tip: [0.1, 0.015, 0.055], belly: [0.8, 0.8, 0.76], claw: [0.025, 0.07, 0.3], joint: [0.3, 0.2, 0.32], setae: [0.42, 0.34, 0.22], spotK: 1, sex: 0,
  },
  taiwanF: {
    base: [0.06, 0.07, 0.035], base2: [0.08, 0.055, 0.035], spot: [0.3, 0.34, 0.2], limb: [0.06, 0.09, 0.06], limbSpot: [0.36, 0.42, 0.28],
    tip: [0.18, 0.025, 0.06], belly: [0.8, 0.76, 0.66], claw: [0.05, 0.08, 0.07], joint: [0.4, 0.24, 0.26], setae: [0.4, 0.32, 0.2], spotK: 0.85, sex: 1,
  },
  ishigani: {
    base: [0.045, 0.055, 0.028], base2: [0.1, 0.045, 0.03], spot: [0.14, 0.12, 0.06], limb: [0.07, 0.065, 0.035], limbSpot: [0.16, 0.13, 0.07],
    tip: [0.03, 0.015, 0.015], belly: [0.72, 0.66, 0.55], claw: [0.11, 0.035, 0.09], joint: [0.14, 0.09, 0.08], setae: [0.3, 0.25, 0.15], spotK: 0.5, sex: 0.5,
  },
  // 生きているタラバガニ: 背は赤むらさき〜えんじ、とげの先は橙。脚の下側とおなかはクリーム色。ハサミの指先は黒い
  taraba: {
    base: [0.2, 0.028, 0.03], base2: [0.11, 0.016, 0.03], spot: [0.25, 0.05, 0.036], limb: [0.2, 0.03, 0.03], limbSpot: [0.27, 0.05, 0.035],
    tip: [0.025, 0.012, 0.012], spineTip: [0.62, 0.26, 0.09], belly: [0.72, 0.56, 0.4], claw: [0.22, 0.032, 0.03], joint: [0.3, 0.13, 0.09], setae: [0.4, 0.3, 0.2],
    spotK: 0.25, sex: 1, under: 0.34, underLoc: true,
  },
};

const matCache = new Map();
/** 種類・個体差（seed）ごとの材質（seed は 8 通りにまとめて使い回す） */
export function crabMaterial(id, seed = 0, wet = 1) {
  const key = `${id}|${Math.floor(seed * 8)}|${wet}`;
  if (matCache.has(key)) return matCache.get(key);
  const P = PALETTE[id];
  const r = new RNG(Math.floor(seed * 8) * 97 + 5);
  const jit = (c, k = 0.12) => new THREE.Color(...c.map((x) => x * r.range(1 - k, 1 + k)));
  const m = new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.3, clearcoat: 0.35, clearcoatRoughness: 0.3, side: THREE.DoubleSide });
  const u = {
    uBase: { value: jit(P.base) }, uBase2: { value: jit(P.base2) }, uSpot: { value: jit(P.spot, 0.08) }, uLimb: { value: jit(P.limb) }, uLimbSpot: { value: jit(P.limbSpot, 0.06) },
    uTip: { value: new THREE.Color(...P.tip) }, uBelly: { value: new THREE.Color(...P.belly) }, uClaw: { value: jit(P.claw) },
    uJoint: { value: new THREE.Color(...P.joint) }, uSetae: { value: new THREE.Color(...P.setae) },
    uSpineTip: { value: new THREE.Color(...(P.spineTip || P.tip)) }, uUnder: { value: P.under ?? 0.12 }, uUnderLoc: { value: P.underLoc ? 1 : 0 },
    uSeed: { value: r.range(0, 10) }, uSpotK: { value: P.spotK * r.range(0.88, 1.1) }, uSex: { value: P.sex },
    uWet: { value: wet }, uScale: { value: 1 },
  };
  patchMaterial(m, { fx: CRAB_FX, uniforms: u, caustics: true });
  m.userData.u = u;
  matCache.set(key, m);
  return m;
}

// ───────── 脚の寸法（幅 W に対する割合） ─────────
const LIMBS = {
  taiwan: {
    cheliped: { len: [0.06, 0.36, 0.15], r: [0.027, 0.031, 0.035], palm: 0.3, palmH: 0.086, palmT: 0.05, finger: 0.24, fingerR: 0.019, spines: 4 },
    walk: { len: [0.045, 0.25, 0.12, 0.15, 0.16], r: [0.024, 0.026, 0.021, 0.018, 0.014] },
    swim: { len: [0.04, 0.19, 0.08, 0.12], r: [0.024, 0.026, 0.022, 0.03], paddle: [0.13, 0.078] },
    stand: 0.17,
  },
  ishi: {
    cheliped: { len: [0.07, 0.3, 0.16], r: [0.045, 0.055, 0.062], palm: 0.3, palmH: 0.14, palmT: 0.085, finger: 0.2, fingerR: 0.034, spines: 3 },
    walk: { len: [0.05, 0.22, 0.1, 0.12, 0.13], r: [0.032, 0.034, 0.028, 0.024, 0.016] },
    swim: { len: [0.05, 0.17, 0.075, 0.1], r: [0.03, 0.032, 0.03, 0.036], paddle: [0.11, 0.07] },
    stand: 0.19,
  },
  // タラバガニ: 脚は長く太い（はさみ脚は短め）。reach = 付け根から脚先までの横の距離、lift = 脚を上げる高さ、
  // e0 = 付け根の節の上向き、b3 = 腕節と前節の間の曲げ、a4 = 指節の向き、scale = 前・中・後ろの脚の長さ
  taraba: {
    cheliped: { len: [0.1, 0.36, 0.2], r: [0.048, 0.052, 0.058], palm: 0.27, palmH: 0.13, palmT: 0.1, finger: 0.16, fingerR: 0.04, big: 1.18, small: 0.8 },
    walk: { len: [0.13, 0.76, 0.34, 0.54, 0.3], r: [0.07, 0.068, 0.064, 0.054, 0.04], scale: [0.93, 1.0, 0.97], reach: 1.42, lift: 0.13, e0: 0.3, b3: -0.32, a4: -1.3, spiny: true },
    swim: null,
    stand: 0.4,
  },
};

// 姿勢（関節の角度）
const P_CHEL = {
  // [腕の振り, 腕の上げ, 腕節の曲げ, 掌の曲げ, 掌のねじり, ハサミの開き]
  walk: [-0.2, 0.55, 0.8, 0.35, 0.25, 0.25],   // 軽くバンザイ（ハサミを少しだけ上げて、少し開いて）
  threat: [-0.65, 1.05, 0.35, 0.05, 0.4, 0.85], // 大きく広げて開く
  rest: [0.42, -0.08, 1.9, 1.0, 0.0, 0.04],     // たたむ
  pile: [0.35, 0.05, 1.7, 0.8, 0.1, 0.1],
  flail: [-0.2, 0.9, 0.8, 0.3, 0.3, 0.5],
};
const P_WALK = { rest: [0.0, 0.1, -2.0, -0.9, -0.5], pile: [0.0, 0.25, -1.55, -0.6, -0.45], flail: [0.1, 0.45, -1.0, -0.35, -0.35] };
// タラバガニ: ハサミはバンザイせず、顔の前に低くたたんで構える。威嚇で持ち上げて開く。長い脚は砂の中でもひざを立ててたたむ
const P_CHEL_K = {
  walk: [0.25, -0.28, 1.1, 0.5, 0.9, 0.12],
  threat: [-0.15, 0.62, 0.8, 0.35, 0.9, 0.72],
  rest: [0.45, -0.1, 1.8, 1.0, 0.0, 0.04],
  pile: [0.4, 0.0, 1.7, 0.85, 0.1, 0.1],
  flail: [-0.1, 0.6, 1.0, 0.4, 0.3, 0.5],
};
const P_WALK_K = { rest: [0.3, 0.32, -1.75, -0.55, -0.4], pile: [0.3, 0.4, -1.55, -0.5, -0.4], flail: [0.3, 0.55, -1.15, -0.4, -0.35] };
const P_SWIM = { up: [0.25, 0.95, -0.5, -0.35], threat: [0.35, 1.35, -0.35, -0.2], rest: [0.1, 0.35, -1.3, -0.5], pile: [0.1, 0.4, -1.0, -0.4], flail: [0.2, 0.7, -0.6, -0.3] };

export class Crab {
  /** id: 'taiwanM' | 'taiwanF' | 'ishigani'、cm: 甲羅の幅、seed: 0..1 */
  constructor(id, cm, seed = 0.5, { wet = 1 } = {}) {
    const sp = CRABS[id];
    this.id = id; this.sp = sp; this.cm = cm; this.seed = seed;
    const shape = (this.shape = sp.model);
    const S = SHAPES[shape];
    const D = (this.D = LIMBS[shape]);
    const W = (this.W = cm / 100);
    const Wh = W / 2, Lh = W * S.Wz;
    this.L = Lh * 2;
    this.H = (S.top + S.bot) * this.L;
    this.standH = D.stand * W;       // 歩くときの、甲羅の縁の地面からの高さ
    this.king = !!S.king;
    this.R = W * (S.king ? 2.0 : 1);  // 歩くときに占める広さの目安（脚の先まで）
    const rng = new RNG(Math.floor(seed * 1e6) + 3);
    this.mat = crabMaterial(id, seed, wet);
    this.mat.userData.u.uScale.value = 0.16 / W;
    this.group = new THREE.Group();
    this.body = new THREE.Group();
    this.group.add(this.body);
    this.parts = [];
    // 影は落とすが受けない（ヘッドライトが近いので、自分の影でまだらに黒くなるのを避ける）
    const add = (geo, parent) => { const m = new THREE.Mesh(geo, this.mat); m.castShadow = true; m.receiveShadow = false; parent.add(m); this.parts.push(m); return m; };
    this.add = add;
    // 甲羅
    const cg = add(carapaceGeo(shape, W, rng, sp.sex), this.body).geometry;
    if (S.king) add(kingSpinesGeo(S, W, cg.userData.bump, rng), this.body);
    // 横の長いとげ（根もとが太く、少し前へ反る）
    if (S.spine) {
      const sgs = [];
      for (const s of [1, -1]) {
        const b = V3(s * S.spine.base[0] * Wh, 0.0012, S.spine.base[1] * Lh);
        const tp = V3(s * S.spine.tip[0] * Wh, 0.002, S.spine.tip[1] * Lh);
        sgs.push(spikeGeo(b, tp.clone().sub(b), b.distanceTo(tp), S.spine.r * W, 5, -0.12 * s));
      }
      add(mergeGeos(sgs), this.body);
    }
    // 口のまわりの板（第 3 顎脚）・触角
    {
      const g = [];
      for (const s of [1, -1]) {
        const plate = tag(new THREE.SphereGeometry(1, 12, 8), 2, 0.5);
        plate.scale(W * 0.045, W * 0.012, W * 0.07);
        plate.translate(s * W * 0.045, -this.L * 0.14, Lh * 0.55);
        g.push(plate);
        for (const [dx, len] of S.antenna || [[0.03, 0.06], [0.07, 0.045]]) g.push(spikeGeo(V3(s * dx * Wh, S.king ? -W * 0.018 : 0.001, Lh * (S.king ? 0.8 : 0.84)), (S.king ? V3(s * 0.22, 0.12, 1) : V3(s * 0.5, 0.35, 1)), W * len, W * (S.king ? 0.005 : 0.0035), 2, 0.4));
      }
      add(mergeGeos(g), this.body);
    }
    // 眼（柄の先の黒い玉）
    this.eyes = [];
    for (const s of [1, -1]) {
      const [ex, ez] = S.eye;
      const root = new THREE.Object3D();
      root.position.set(s * ex * Wh, 0.001, ez * Lh);
      root.quaternion.setFromUnitVectors(V3(0, 1, 0), V3(s * 0.4, 0.45, 0.8).normalize());
      this.body.add(root);
      const stalkL = W * 0.05;
      add(tubeGeo(stalkL, (t) => [W * 0.0085 * (1 - t * 0.25), W * 0.0085 * (1 - t * 0.25)], { ns: 3, nr: 8, part: 2, ends: false }), root);
      const ball = add(tag(new THREE.SphereGeometry(W * 0.0135, 14, 10), 4), root);
      ball.position.y = stalkL;
      ball.scale.set(1, 1.2, 1);
      this.eyes.push(root);
    }
    // 脚
    this.limbs = [];
    for (const s of [1, -1]) {
      this.limbs.push((S.king ? this.makeChelipedKing : this.makeCheliped).call(this, s, S.legs.cheliped, D.cheliped, Wh, Lh, W));
      S.legs.walk.forEach((at, i) => this.limbs.push(this.makeLeg(s, at, D.walk, Wh, Lh, W, 'walk', i)));
      if (S.legs.swim) this.limbs.push(this.makeLeg(s, S.legs.swim, D.swim, Wh, Lh, W, 'swim', 3));
    }
    this.t = rng.range(0, 10);
    this.gaitT = rng.range(0, 1);
    this.snap = true;
    this.pose('rest', 0);
  }

  /** 付け根の向き: y = 脚ののびる向き、x = 曲がる軸 */
  rootFrame(y, zHint) {
    const yy = y.clone().normalize();
    const z = zHint.clone().addScaledVector(yy, -zHint.dot(yy)).normalize();
    const x = new THREE.Vector3().crossVectors(yy, z);
    return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, yy, z));
  }

  makeLeg(side, at, D, Wh, Lh, W, kind, i) {
    const root = new THREE.Object3D();
    root.position.set(side * at[0] * Wh, -this.L * 0.1, at[1] * Lh);
    // 前の脚は少し前へ、後ろほど後ろへ。遊泳脚は後ろ上へ
    const fwd = kind === 'swim' ? -0.95 : (SHAPES[this.shape].legFwd || [0.42, -0.02, -0.42])[i];
    root.quaternion.copy(this.rootFrame(V3(side * Math.cos(fwd), 0, Math.sin(fwd)), V3(0, 1, 0)));
    this.body.add(root);
    const joints = [];
    let parent = root;
    const sc = kind === 'walk' && D.scale ? D.scale[i] : 1;
    const lens = D.len.map((l) => l * W * sc), rs = D.r.map((r) => r * W);
    lens.forEach((L, k) => {
      const j = new THREE.Object3D();
      if (k > 0) j.position.y = lens[k - 1];
      parent.add(j);
      const last = k === lens.length - 1;
      const r0 = rs[k], r1 = last ? rs[k] * 0.3 : (rs[k + 1] || rs[k]) * 1.02;
      if (kind === 'swim' && last) {
        // オールの形の先（だ円の板）と、ふちの毛の房
        const [pl, pw] = D.paddle;
        const blade = (s) => (t) => [W * 0.0045 * s, pw * W * 0.5 * s * Math.sqrt(Math.max(0, Math.sin(Math.PI * clamp(t * 0.96 + 0.04, 0, 1))))];
        this.add(tubeGeo(pl * W, blade(1), { ns: 12, nr: 12, part: 2, tip: true, ends: false }), j);
        this.add(tubeGeo(pl * W * 1.04, (t) => { const b = blade(1)(t); return [W * 0.0015, b[1] * 1.14 + W * 0.002]; }, { ns: 12, nr: 10, part: 6, tip: true, ends: false }), j);
      } else if (kind === 'swim' && k === lens.length - 2) {
        this.add(tubeGeo(L, (t) => [r0 * 0.42, lerp(r0, D.paddle[1] * W * 0.42, t)], { ns: 6, nr: 12, part: 2, cross: CROSS.blade }), j);
        // この節のふちにも毛
        this.add(tubeGeo(L, (t) => [W * 0.0012, lerp(r0, D.paddle[1] * W * 0.42, t) * 1.15], { ns: 6, nr: 8, part: 6, ends: false }), j);
      } else if (D.spiny) {
        // タラバガニの脚: 太い丸みのある節。背と前後の稜にとげが並ぶ。指節は黒い爪の先へ細く曲がる
        if (last) this.add(tubeGeo(L, (t) => { const r = r0 * (1 - t * 0.85) * (1 + 0.1 * Math.sin(Math.PI * t)); return [r * 0.85, r]; }, { ns: 9, nr: 12, part: 3, tip: true, bend: (t) => [0, -t * t * L * 0.14] }), j);
        else {
          this.add(tubeGeo(L, (t) => { const r = lerp(r0, r1, t) * (1 + 0.1 * Math.sin(Math.PI * t) + 0.05 * smoothstep(0.85, 1, t)); return [r * 0.9, r * 1.02]; }, { ns: 9, nr: 14, part: 2 }), j);
          if (k >= 1) {
            const sp = [];
            const n = [0, 7, 3, 5][k];
            for (const [a, kk] of [[Math.PI / 2 + 0.55, 1], [Math.PI / 2 - 0.55, 0.85], [Math.PI / 2, 0.6], [-0.2, 0.5]]) {
              for (let q = 0; q < n; q++) {
                const t = 0.12 + (q + (kk < 0.9 ? 0.5 : 0)) / n * 0.78;
                if (t > 0.94) continue;
                const r = lerp(r0, r1, t) * (1 + 0.1 * Math.sin(Math.PI * t));
                const c = Math.cos(a), s2 = Math.sin(a);
                const sz = kk * (0.8 + 0.4 * ((q * 7 + k * 3) % 5) / 4);
                sp.push(spikeGeo(V3(c * r * 0.8, t * L, s2 * r * 0.9), V3(c, 0.7, s2), W * 0.042 * sz, W * 0.011 * sz, 5, 0.1));
              }
            }
            this.add(mergeGeos(sp), j);
          }
        }
      } else {
        const dact = kind === 'walk' && last;
        this.add(tubeGeo(L, (t) => {
          const r = lerp(r0, r1, t) * (1 + 0.12 * Math.sin(Math.PI * t));
          // 槍の穂の形の先: 中ほどが幅広く、先へ細くとがる
          if (dact) { const k2 = Math.sin(Math.PI * Math.min(1, t * 1.1 + 0.08)) * 0.6 + 0.4 * (1 - t); return [r0 * 0.45 * k2 + 0.0003, r0 * 1.05 * k2 + 0.0003]; }
          return [r * 0.46, r * 1.1];
        }, { ns: dact ? 9 : 7, nr: 12, part: 2, tip: dact, cross: CROSS.blade, bend: dact ? (t) => [0, -t * t * L * 0.08] : null }), j);
      }
      if (k > 0) { const kn = this.add(tag(new THREE.SphereGeometry(r0 * 0.9, 10, 8), 2, 0, 1), j); kn.scale.set(0.5, 1, 1); }
      joints.push(j);
      parent = j;
    });
    return { kind, side, root, joints, i, lens, ph: Math.random() * TAU, ang: joints.map(() => 0), yaw: 0 };
  }

  makeCheliped(side, at, D, Wh, Lh, W) {
    const root = new THREE.Object3D();
    root.position.set(side * at[0] * Wh, -this.L * 0.12, at[1] * Lh);
    root.quaternion.copy(this.rootFrame(V3(side * 0.62, 0.05, 1), V3(-side, 0, 0.2)));
    this.body.add(root);
    const joints = [];
    let parent = root;
    const lens = D.len.map((l) => l * W), rs = D.r.map((r) => r * W);
    lens.forEach((L, k) => {
      const j = new THREE.Object3D();
      if (k > 0) j.position.y = lens[k - 1];
      parent.add(j);
      const r0 = rs[k], r1 = rs[k + 1] || D.palmH * W * 0.42;
      this.add(tubeGeo(L, (t) => { const r = lerp(r0, r1, t) * (1 + 0.14 * Math.sin(Math.PI * t)); return [r * 1.1, r * 0.72]; }, { ns: 8, nr: 14, part: 2, cross: k === 1 ? CROSS.tri : CROSS.round }), j);
      if (k > 0) { const kn = this.add(tag(new THREE.SphereGeometry(r0 * 0.95, 10, 8), 2, 0, 1), j); kn.scale.set(1, 1, 0.72); }
      joints.push(j);
      parent = j;
    });
    // 付け根の x 軸は、左（side = 1）では下、右では上を向く。「上」は up 倍で
    const up = -side;
    // 長節の前のふちの鋭いとげ（先へ行くほど長い）と、先の外側のとげ
    const mer = joints[1], mL = lens[1], mr = rs[1];
    const sp = [];
    for (let s = 0; s < D.spines; s++) {
      const t = 0.3 + (s / Math.max(1, D.spines - 1)) * 0.6;
      sp.push(spikeGeo(V3(up * mr * 0.35, t * mL, mr * 0.7), V3(up * 0.35, 0.7, 0.62), W * (0.028 + s * 0.006), W * 0.006));
    }
    sp.push(spikeGeo(V3(up * mr * 0.9, mL * 0.92, -mr * 0.1), V3(up * 0.4, 0.8, -0.2), W * 0.022, W * 0.005));
    this.add(mergeGeos(sp), mer);
    // 腕節: 内側の長いとげと外側の小さなとげ
    const car = joints[2], cL = lens[2], cr = rs[2];
    this.add(mergeGeos([spikeGeo(V3(up * cr * 0.2, cL * 0.72, cr * 0.8), V3(up * 0.2, 0.55, 0.85), W * 0.055, W * 0.008), spikeGeo(V3(up * cr * 0.8, cL * 0.6, -cr * 0.3), V3(up * 0.7, 0.5, -0.3), W * 0.02, W * 0.005)]), car);
    // 掌（稜の立った角柱。指の付け根の上にとげ）
    const palmJ = new THREE.Object3D();
    palmJ.position.y = lens[2];
    car.add(palmJ);
    const PL = D.palm * W, PH = D.palmH * W, PT = D.palmT * W;
    this.add(tubeGeo(PL, (t) => {
      const k = 1 + 0.16 * Math.sin(Math.PI * clamp(t * 1.15, 0, 1)) - 0.22 * smoothstep(0.8, 1, t);
      return [PH * 0.5 * k, PT * 0.5 * k];
    }, { ns: 12, nr: 18, part: 7, cross: CROSS.palm }), palmJ);
    this.add(mergeGeos([
      spikeGeo(V3(up * PH * 0.42, PL * 0.93, 0), V3(up * 0.45, 1, 0), W * 0.03, W * 0.006),
      spikeGeo(V3(up * PH * 0.46, PL * 0.35, PT * 0.1), V3(up * 0.8, 0.5, 0), W * 0.012, W * 0.004),
    ]), palmJ);
    joints.push(palmJ);
    // 不動指（下）と可動指（上）: 内側に大小の歯、先は鉤で交差する
    const FL = D.finger * W, FR = D.fingerR * W;
    const makeFinger = (dir) => {
      const bend = (t) => [-dir * (t * t * FL * 0.12 + Math.pow(t, 6) * FL * 0.1), 0];
      const g = tubeGeo(FL, (t) => { const r = FR * (1 - t * 0.78); return [r, r * 0.72]; }, { ns: 14, nr: 12, part: 3, tip: true, ends: false, bend });
      const teeth = [];
      for (let k = 0; k < 9; k++) {
        const t = 0.08 + k * 0.095;
        const r = FR * (1 - t * 0.78);
        const [bx] = bend(t);
        teeth.push(spikeGeo(V3(bx - dir * r * 0.85, t * FL, 0), V3(-dir, 0.25, 0), W * (k % 3 === 1 ? 0.018 : 0.009), W * 0.0038, 5, 0));
      }
      return mergeGeos([g, ...teeth]);
    };
    const fixedF = new THREE.Object3D();
    fixedF.position.set(-up * PH * 0.28, PL * 0.97, 0);
    palmJ.add(fixedF);
    this.add(makeFinger(-up), fixedF);
    const dactyl = new THREE.Object3D();
    dactyl.position.set(up * PH * 0.3, PL * 0.94, 0);
    palmJ.add(dactyl);
    this.add(makeFinger(up), dactyl);
    return { kind: 'cheliped', side, root, joints, dactyl, i: 0, ph: Math.random() * TAU, ang: [0, 0, 0, 0, 0, 0] };
  }

  /**
   * タラバガニのはさみ脚: 右（side = -1）が大きい。どの節も丸く太く、とげが並ぶ。
   * 右は押しつぶす歯（丸い臼歯）、左は細かくとがった歯。指先は黒い爪
   */
  makeChelipedKing(side, at, D, Wh, Lh, W) {
    const big = side === -1;
    const sc = big ? D.big : D.small;
    const rk = Math.sqrt(sc);
    const root = new THREE.Object3D();
    root.position.set(side * at[0] * Wh, -this.L * 0.1, at[1] * Lh);
    root.quaternion.copy(this.rootFrame(V3(side * 0.62, 0.05, 1), V3(-side, 0, 0.2)));
    this.body.add(root);
    const up = -side;
    const joints = [];
    let parent = root;
    const lens = D.len.map((l, k) => l * W * (k ? lerp(1, sc, 0.35) : 1)), rs = D.r.map((r) => r * W * rk);
    // 節の表面のとげ（背の側 up と外側 -z に列をつくる）
    const rowSpikes = (L, rOf, n, rows, size) => {
      const sp = [];
      for (const [a, kk, off] of rows) for (let q = 0; q < n; q++) {
        const t = 0.14 + (q + off) / n * 0.76;
        if (t > 0.93) continue;
        const r = rOf(t);
        const c = Math.cos(a), s2 = Math.sin(a);
        const sz = kk * (0.8 + 0.4 * ((q * 5 + n) % 4) / 3);
        sp.push(spikeGeo(V3(c * r[0] * 0.82, t * L, s2 * r[1] * 0.82), V3(c, 0.55, s2), W * size * sz, W * 0.012 * sz * rk, 5, 0.1));
      }
      return mergeGeos(sp);
    };
    const upA = up > 0 ? 0 : Math.PI;       // 断面の角度で「上」（x = up の向き）
    const aOff = up > 0 ? 0.25 : -0.25;     // 模様の「下側は白っぽい」を、この向きに合わせる
    lens.forEach((L, k) => {
      const j = new THREE.Object3D();
      if (k > 0) j.position.y = lens[k - 1];
      parent.add(j);
      const r0 = rs[k], r1 = rs[k + 1] || D.palmH * W * sc * 0.4;
      const rOf = (t) => { const r = lerp(r0, r1, t) * (1 + 0.12 * Math.sin(Math.PI * t)); return [r, r * 0.9]; };
      this.add(tubeGeo(L, rOf, { ns: 9, nr: 14, part: 2, aOff }), j);
      if (k > 0) {
        const kn = this.add(tag(new THREE.SphereGeometry(r0 * 0.95, 10, 8), 2, 0, 1), j); kn.scale.set(1, 1, 0.85);
        this.add(rowSpikes(L, rOf, k === 1 ? 6 : 3, [[upA, 1, 0], [upA + 0.8 * up, 0.8, 0.5], [-Math.PI / 2, 0.7, 0.25], [upA - 0.9 * up, 0.55, 0.5]], 0.036), j);
      }
      joints.push(j);
      parent = j;
    });
    // 掌: 丸くふくらんだ箱。背と外側にとげの列
    const car = joints[2];
    const palmJ = new THREE.Object3D();
    palmJ.position.y = lens[2];
    car.add(palmJ);
    const PL = D.palm * W * sc, PH = D.palmH * W * sc, PT = D.palmT * W * sc;
    const palmR = (t) => { const k = 1 + 0.14 * Math.sin(Math.PI * clamp(t * 1.1, 0, 1)) - 0.2 * smoothstep(0.82, 1, t); return [PH * 0.5 * k, PT * 0.5 * k]; };
    this.add(tubeGeo(PL, palmR, { ns: 12, nr: 18, part: 7, aOff }), palmJ);
    this.add(rowSpikes(PL, palmR, 5, [[upA, 1, 0], [upA + 0.55 * up, 0.8, 0.5], [-Math.PI / 2, 0.75, 0], [-Math.PI / 2 + 0.6 * up, 0.6, 0.5], [upA - 0.6 * up, 0.5, 0.3]], 0.034), palmJ);
    joints.push(palmJ);
    // 指: 太く短く、先は黒い爪。右は丸い臼歯、左は細かい歯
    const FL = D.finger * W * sc, FR = D.fingerR * W * sc;
    const makeFinger = (dir) => {
      const bend = (t) => [-dir * (t * t * FL * 0.16), 0];
      const g = tubeGeo(FL, (t) => { const r = FR * (1 - t * 0.8) * (1 + 0.08 * Math.sin(Math.PI * t)); return [r, r * 0.8]; }, { ns: 12, nr: 12, part: 3, tip: true, ends: false, bend });
      const teeth = [];
      const nT = big ? 4 : 7;
      for (let k = 0; k < nT; k++) {
        const t = 0.1 + k * (0.7 / nT);
        const r = FR * (1 - t * 0.8);
        const [bx] = bend(t);
        if (big) {
          // 臼歯: 低い丸いこぶ
          const m = tag(new THREE.SphereGeometry(1, 8, 6), 3, 0.3);
          m.scale(FR * 0.3 * (1 - t * 0.5), FR * 0.42, FR * 0.4);
          m.translate(bx - dir * r * 0.78, t * FL, 0);
          teeth.push(m);
        } else teeth.push(spikeGeo(V3(bx - dir * r * 0.85, t * FL, 0), V3(-dir, 0.3, 0), W * 0.012, W * 0.0045, 5, 0));
      }
      return mergeGeos([g, ...teeth]);
    };
    const fixedF = new THREE.Object3D();
    fixedF.position.set(-up * PH * 0.26, PL * 0.96, 0);
    palmJ.add(fixedF);
    this.add(makeFinger(-up), fixedF);
    const dactyl = new THREE.Object3D();
    dactyl.position.set(up * PH * 0.28, PL * 0.93, 0);
    palmJ.add(dactyl);
    this.add(makeFinger(up), dactyl);
    return { kind: 'cheliped', side, root, joints, dactyl, i: 0, ph: Math.random() * TAU, ang: [0, 0, 0, 0, 0, 0], fingerL: FL };
  }

  /**
   * 姿勢と動き。mode: 'walk'（横歩き。o.v = 横の速さ m/s、+ = カニの左）/ 'idle'（立って構える）/ 'threat'（威嚇）/
   *   'flail'（持ち上げられて暴れる）/ 'rest'（砂の中でたたむ）/ 'pile'（並べる）
   * o.open = [左のハサミ, 右のハサミ] の開き（決めたい時だけ）、o.speed = 暴れる速さの倍率
   */
  pose(mode, dt = 0, o = {}) {
    this.t += dt;
    const t = this.t, W = this.W;
    const k = this.snap || dt <= 0 ? 1 : 1 - Math.exp(-dt * (mode === 'flail' ? 16 : 10));
    this.snap = false;
    const standing = mode === 'walk' || mode === 'idle' || mode === 'threat';
    const v = mode === 'walk' ? (o.v ?? 0.08) : 0;
    const spd = o.speed ?? 1;
    // 歩みの位相: 1 歩の幅 S を、支えの間（6 割）に進む
    // 速いほど大またに
    const S = W * (0.3 + 0.9 * Math.min(Math.abs(v), 0.6));
    this.stride = S;
    const freq = Math.abs(v) * 0.62 / S;
    this.gaitT = (this.gaitT + dt * freq) % 1;
    // 体: 歩くと上下にゆれる。威嚇は持ち上げる
    const rise = mode === 'threat' ? 1.32 : 1;
    const bob = standing ? Math.sin(this.gaitT * TAU * 2) * 0.012 * W * Math.min(1, freq * 2) : 0;
    const by = standing ? (rise - 1) * this.standH + bob : 0;
    this.body.position.y = lerp(this.body.position.y, by, k);
    const tilt = mode === 'threat' ? -0.12 + Math.sin(t * 2.2) * 0.03 : standing ? Math.sin(this.gaitT * TAU) * 0.02 : 0;
    this.body.rotation.x = lerp(this.body.rotation.x, tilt, k);
    this.body.rotation.z = lerp(this.body.rotation.z, standing ? Math.sin(this.gaitT * TAU * 2 + 1) * 0.015 : 0, k);
    const groundY = -this.standH * rise - by;   // 体（body）から見た地面の高さ
    for (const L of this.limbs) {
      if (L.kind === 'cheliped') this.poseCheliped(L, mode, t, k, o, spd);
      else if (L.kind === 'walk' && standing) this.stepLeg(L, v, groundY, t, k, mode);
      else this.poseLeg(L, mode, t, k, spd);
    }
    // 眼: 砂の中ではたたむ
    const eyeUp = mode === 'rest' || mode === 'pile' ? 0.3 : 1;
    for (const e of this.eyes) e.scale.setScalar(lerp(e.scale.x, lerp(0.75, 1, eyeUp), k));
  }

  poseCheliped(L, mode, t, k, o, spd) {
    const PC = this.king ? P_CHEL_K : P_CHEL;
    const P = (PC[mode] || PC.walk).slice();
    if (mode === 'idle') P.splice(0, 6, ...PC.walk);
    const ph = L.ph;
    if (mode === 'walk' || mode === 'idle') {
      // バンザイのまま、ゆらゆら
      P[0] += Math.sin(t * 1.7 + ph) * 0.06; P[1] += Math.sin(t * 2.1 + ph) * 0.07; P[2] += Math.sin(t * 1.3 + ph * 2) * 0.05;
      P[5] += Math.max(0, Math.sin(t * 1.1 + ph)) * 0.12;
    } else if (mode === 'threat') {
      // 大きく構えて、ハサミをカチカチ
      P[0] += Math.sin(t * 2.3 + ph) * 0.08; P[1] += Math.sin(t * 3.1 + ph) * 0.06;
      P[5] = 0.55 + 0.35 * Math.pow(Math.max(0, Math.sin(t * 5 + ph)), 2);
    } else if (mode === 'flail') {
      P[0] += Math.sin(t * 7 * spd + ph) * 0.35; P[1] += Math.sin(t * 5.3 * spd + ph) * 0.3; P[2] += Math.sin(t * 6.1 * spd + ph * 2) * 0.3;
      P[5] = 0.25 + 0.45 * Math.max(0, Math.sin(t * 9 * spd + ph));
    }
    const si = L.side === 1 ? 0 : 1;
    if (o.open && o.open[si] !== undefined) P[5] = o.open[si];
    for (let n = 0; n < 6; n++) L.ang[n] = lerp(L.ang[n], P[n], k);
    const a = L.ang;
    // 付け根: 振り（水平）と上げ（付け根の z 軸まわり）
    L.joints[0].rotation.set(a[0], 0, a[1] * 0.75 * L.side);
    L.joints[1].rotation.set(0, 0, 0);
    L.joints[2].rotation.set(a[2], 0, 0);
    L.joints[3].rotation.set(a[3], a[4] * L.side, 0);
    L.dactyl.rotation.set(0, 0, a[5] * L.side);
  }

  /** 歩脚を地面に置く（脚の縦の面の中で 2 本の骨の IK。足先の槍は地面へ向ける） */
  stepLeg(L, v, groundY, t, k, mode) {
    const len = L.lens;
    // 付け根の位置（体の座標）から地面までの高さ
    const rootY = L.root.position.y;
    const dz = groundY - rootY;
    // 脚ごとの位相（4 本ずつ交互: 左の 0・2 と右の 1 が同じ組）
    const grp = (L.i % 2 === 0) === (L.side === 1) ? 0 : 0.5;
    const ph = (this.gaitT + grp) % 1;
    const sgn = Math.sign(v) || 0;
    const stride = (this.stride || this.W * 0.3) * (sgn ? 1 : 0);
    let off, lift;
    if (ph < 0.62) { off = lerp(0.5, -0.5, ph / 0.62) * stride; lift = 0; }
    else { const w = (ph - 0.62) / 0.38; off = lerp(-0.5, 0.5, w) * stride; lift = Math.sin(Math.PI * w) * this.W * (this.D.walk.lift ?? 0.07); }
    // 前へ進む側の脚は引き寄せ、後ろの脚は押し出す（脚の外向きの向きで符号が変わる）
    off *= L.side * sgn;
    const DW = this.D.walk;
    const reach0 = this.W * ((DW.reach ?? 0.44) - (mode === 'threat' ? 0.04 : 0)) + [0.02, 0.03, 0.02][L.i] * this.W;
    const R = reach0 + off + Math.sin(t * 1.3 + L.ph) * this.W * 0.006;
    const footZ = dz + lift;
    // コクサ（付け根の短い節）は少し上向き
    const e0 = DW.e0 ?? 0.12;
    const My = len[0] * Math.cos(e0), Mz = len[0] * Math.sin(e0);
    // 足先の槍の向き（地面へほぼまっすぐ、少し外へ）
    const a4 = DW.a4 ?? -1.2;
    const Ay = R - len[4] * Math.cos(a4), Az = footZ - len[4] * Math.sin(a4);
    // 腕節＋前節（間の曲げ b3 は決め打ち）をひとつの骨とみなす
    const b3 = DW.b3 ?? -0.35;
    const L2 = len[2], L3 = len[3];
    const L23 = Math.sqrt(L2 * L2 + L3 * L3 + 2 * L2 * L3 * Math.cos(b3));
    const gam = Math.atan2(L3 * Math.sin(b3), L2 + L3 * Math.cos(b3));
    const L1 = len[1];
    let dy = Ay - My, dzz = Az - Mz;
    let d = Math.hypot(dy, dzz);
    d = clamp(d, Math.abs(L1 - L23) + 1e-4, L1 + L23 - 1e-4);
    const phi = Math.atan2(dzz, dy);
    const a1 = phi + Math.acos(clamp((L1 * L1 + d * d - L23 * L23) / (2 * L1 * d), -1, 1));
    const Ky = My + L1 * Math.cos(a1), Kz = Mz + L1 * Math.sin(a1);
    const aE = Math.atan2(Az - Kz, Ay - Ky);
    const a2 = aE - gam;
    const a3 = a2 + b3;
    const tgt = [e0, a1 - e0, a2 - a1, b3, a4 - a3];
    for (let n = 0; n < 5; n++) L.ang[n] = lerp(L.ang[n], tgt[n], k);
    // 脚先を前後へ少し振る（コクサを縦軸まわりに）
    L.yaw = lerp(L.yaw, Math.sin((this.gaitT + grp) * TAU) * 0.06 * Math.abs(sgn), k);
    L.joints.forEach((j, n) => j.rotation.set(L.ang[n], 0, n === 0 ? L.yaw : 0));
  }

  poseLeg(L, mode, t, k, spd) {
    let P;
    if (L.kind === 'swim') {
      P = (mode === 'threat' ? P_SWIM.threat : mode === 'rest' ? P_SWIM.rest : mode === 'pile' ? P_SWIM.pile : mode === 'flail' ? P_SWIM.flail : P_SWIM.up).slice();
      // オールをかく（威嚇・暴れる時は速く）
      const f = mode === 'flail' ? 14 * spd : mode === 'threat' ? 5 : mode === 'walk' || mode === 'idle' ? 3 : 0;
      if (f) { P[0] += Math.sin(t * f + L.ph) * 0.25; P[1] += Math.sin(t * f * 0.5 + L.ph) * 0.15; P[3] += Math.sin(t * f + L.ph + 1) * 0.5; }
    } else {
      const PW = this.king ? P_WALK_K : P_WALK;
      P = (PW[mode] || PW.rest).slice();
      if (mode === 'flail') {
        const ph = t * (11 + L.i * 1.7) * spd + L.ph;
        P[1] += Math.sin(ph) * 0.55; P[2] += Math.sin(ph * 1.3 + 1) * 0.5; P[3] += Math.sin(ph * 0.9 + 2) * 0.4; P[0] += Math.sin(ph * 0.7) * 0.3;
      }
    }
    for (let n = 0; n < P.length; n++) L.ang[n] = lerp(L.ang[n], P[n], k);
    L.yaw = lerp(L.yaw, 0, k);
    L.joints.forEach((j, n) => j.rotation.set(L.ang[n] ?? 0, 0, 0));
  }

  /** はさみ脚（side: 1 = カニの左、-1 = 右）の可動指の先（世界） */
  clawTip(side = -1) {
    const L = this.limbs.find((l) => l.kind === 'cheliped' && l.side === side);
    L.dactyl.updateWorldMatrix(true, false);
    return L.dactyl.localToWorld(new THREE.Vector3(0, (L.fingerL ?? this.W * this.D.cheliped.finger) * 0.72, 0));
  }

  /** 今の姿勢のまま、1 つの形にまとめる（並べて置くとき用） */
  bake() {
    this.group.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(this.group.matrixWorld).invert();
    const list = [];
    for (const m of this.parts) {
      const g = m.geometry.clone();
      g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld));
      list.push(g);
    }
    const mesh = new THREE.Mesh(mergeGeos(list), this.mat);
    mesh.castShadow = true; mesh.receiveShadow = false;
    return mesh;
  }

  setWet(k) { this.mat.userData.u.uWet.value = k; }
  dispose() { for (const m of this.parts) m.geometry.dispose(); }
}

export function makeCrab(id, cm, seed, opts) { return new Crab(id, cm, seed, opts); }

/** 甲羅の縁（一周）と脚の付け根。幅 1 に対する値（x: 左右, z: 前後）。輪郭の絵（sense.js）に使う */
export function crabShape(model) {
  const S = SHAPES[model];
  const half = S.outline();
  const ring = [...half, ...half.slice(1, -1).reverse().map(([x, z, b]) => [-x, z, b])].map(([x, z]) => [x * 0.5, z * S.Wz]);
  // 横の長いとげを輪に足す（右と左）
  if (S.spine) {
    const add = (s) => {
      const bi = ring.findIndex(([x, z]) => s * x > 0.34 && Math.abs(z - S.spine.base[1] * S.Wz) < 0.02);
      if (bi >= 0) ring.splice(bi + 1, 0, [s * S.spine.tip[0] * 0.5, S.spine.tip[1] * S.Wz]);
    };
    add(1); add(-1);
  }
  return { ring, Wz: S.Wz, legs: S.legs, legFwd: S.legFwd, eye: S.eye, limbs: LIMBS[model], king: !!S.king };
}
