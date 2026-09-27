// 世界の生成：高さ・水面・地表の種類・田んぼの区画・道・川・集落・木の配置
// DOMに依存しない（Nodeでも実行して地図画像で確認できる）
import { simplex2, fbm2, hash2i, hash3i, hashf2, mulberry32, clamp, lerp, smoothstep } from '../util/noise.js';
import {
  valleyZ, halfN, halfS, edgeN, edgeS, floorBase, floorT, baseHeight, riverZ, riverDist, riverLevel, riverDZ,
  YATOS, yatoAxisX, KNOLL, POND, HOUSES, OUTBUILDINGS, SHRINE, roadPolylines, smoothPolyline, BRIDGE,
  GORGE, gorgeLocal, gorgeWorld, streamA, streamStep, streamLevel, RIDGE,
} from './layout.js';

export const N = 1025, CELL = 1.5, ORIGIN = -768, SIZE = 1536;
export const T = {
  NONE: 0, FLOODED: 1, SEEDLING: 2, RENGE: 3, TILLED: 4, FALLOW: 5, FIELD: 6, MEADOW: 7,
  ASPHALT: 8, DIRT: 9, GRAVEL: 10, RIVER: 11, BANK: 12, LEVEE_BIG: 13, YARD: 14, GARDEN: 15,
  FOREST: 16, BAMBOO: 17, KNOLL: 18, NANOHANA: 19, POND: 20,
  ROCK: 21, STREAM: 22, POOL: 23, MOSS: 24,
};
// 木の種類
export const SP = {
  OAK: 0, YAMAZAKURA: 1, KOBUSHI: 2, CEDAR: 3, EVERGREEN: 4, SAKURA: 5, KAKI: 6, WILLOW: 7, SHRUB: 8, BAMBOO: 9, CAMELLIA: 10, KEYAKI: 11, TSUTSUJI: 12,
};

const idx = (i, j) => j * N + i;
export const wx = (i) => ORIGIN + i * CELL;

// 田んぼの区画格子（ゆがませた格子）
function makeBounds(seed, minW, maxW) {
  const r = mulberry32(seed);
  const b = [];
  let p = -1100;
  while (p < 1100) { b.push(p); p += minW + (maxW - minW) * r(); }
  b.push(p);
  return Float64Array.from(b);
}
const BX = makeBounds(101, 19, 36);
const BZ = makeBounds(202, 15, 29);
function cellOf(B, v) {
  let lo = 0, hi = B.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (B[m] <= v) lo = m; else hi = m; }
  return lo;
}
const warpXf = (x, z) => x + 14 * simplex2(x / 170 + 3.1, z / 170 - 1.7) + 1.6 * simplex2(x / 48, z / 48);
const warpZf = (x, z) => z + 14 * simplex2(x / 170 - 4.2, z / 170 + 2.9) + 1.6 * simplex2(x / 48 + 7, z / 48 - 3);

export function generateWorld(log = () => {}) {
  const n = N * N;
  const tm = Date.now();
  const lap = (s) => log(`${s} ${Date.now() - tm}ms`);

  // ---- 1. 土台の高さ ----
  const hB = new Float32Array(n);
  const tA = new Float32Array(n);
  const yatoIn = new Float32Array(n); // 谷戸の床からの横距離（床の外側の距離、谷戸外は大）
  for (let j = 0; j < N; j++) {
    const z = ORIGIN + j * CELL;
    for (let i = 0; i < N; i++) {
      const x = ORIGIN + i * CELL;
      const k = idx(i, j);
      hB[k] = baseHeight(x, z);
      tA[k] = floorT(x, z);
      let yi = 1e9;
      for (const y of YATOS) {
        const zEdge = y.side < 0 ? edgeN(y.mx) : edgeS(y.mx);
        const s = y.side * (z - zEdge);
        if (s < -20 || s > y.len + 10) continue;
        const a = Math.abs(x - yatoAxisX(y, s));
        const w = lerp(y.w0, y.w1, clamp(s / y.len, 0, 1));
        yi = Math.min(yi, a - w);
      }
      yatoIn[k] = yi;
    }
  }
  lap('base');
  // 滝の谷（崖・滝つぼ・渓流の床）と山の上の見晴らし（平らな原っぱ）
  const gorge = new Uint8Array(n);      // 1=谷の床・崖・滝つぼ（固い・田にしない・木を植えない）
  const G = carveGorge(hB, gorge);
  carveRidge(hB);
  lap('gorge');

  // 勾配
  const slope = new Float32Array(n);
  const gxA = new Float32Array(n), gzA = new Float32Array(n);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const k = idx(i, j);
    const hl = hB[idx(Math.max(i - 1, 0), j)], hr = hB[idx(Math.min(i + 1, N - 1), j)];
    const hd = hB[idx(i, Math.max(j - 1, 0))], hu = hB[idx(i, Math.min(j + 1, N - 1))];
    const gx = (hr - hl) / (2 * CELL), gz = (hu - hd) / (2 * CELL);
    gxA[k] = gx; gzA[k] = gz;
    slope[k] = Math.hypot(gx, gz);
  }
  // 広域の勾配（区画ごとの段の高さを決める）
  const slopeR = boxBlur(slope, 8);
  lap('slope');

  // ---- 2. 区画（田んぼ） ----
  const WX = new Float32Array(n), WZ = new Float32Array(n);
  for (let j = 0; j < N; j++) {
    const z = ORIGIN + j * CELL;
    for (let i = 0; i < N; i++) { const x = ORIGIN + i * CELL; const k = idx(i, j); WX[k] = warpXf(x, z); WZ[k] = warpZf(x, z); }
  }
  const type = new Uint8Array(n);
  const prand = new Uint8Array(n);
  const sdf = new Float32Array(n).fill(30);
  const h = new Float32Array(hB);
  const hard = new Uint8Array(n);
  const water = new Float32Array(n).fill(-1e4);
  const parcelH = new Float32Array(n);
  const paddy = new Uint8Array(n);
  const pkey = new Int32Array(n).fill(-1);
  for (let k = 0; k < n; k++) if (gorge[k]) hard[k] = 1;

  // 区画ごとの段の高さ：区画の平均的な広域勾配から
  const cellSlope = new Map();
  const eligible = new Uint8Array(n);
  for (let j = 0; j < N; j++) {
    const z = ORIGIN + j * CELL;
    for (let i = 0; i < N; i++) {
      const x = ORIGIN + i * CELL;
      const k = idx(i, j);
      const t = tA[k];
      const edgeLim = 48 + 26 * simplex2(x / 160 + 9, z / 160);
      const inYato = yatoIn[k] < 6;
      const kd = Math.hypot(x - KNOLL.x, z - KNOLL.z) + 7 * simplex2(x / 14 + 3, z / 14 - 1);
      const pd = Math.hypot((x - POND.x) / (POND.rx + 14), (z - POND.z) / (POND.rz + 14));
      const ok = (t < edgeLim || inYato) && slopeR[k] < 0.17 && slope[k] < 0.24 && riverDist(x, z) > 14.5 && kd > KNOLL.r * 2.0 && pd > 1 && !gorge[k] && !(gorgeLocal(x, z).s > 312 && Math.abs(gorgeLocal(x, z).a) < 60);
      if (!ok) continue;
      eligible[k] = 1;
      const ci = cellOf(BX, WX[k]), cj = cellOf(BZ, WZ[k]);
      const key = ci * 4096 + cj;
      let c = cellSlope.get(key);
      if (!c) { c = [0, 0, 0]; cellSlope.set(key, c); }
      c[0] += slopeR[k]; c[1]++; c[2] += hB[k];
    }
  }
  const rTypes = (hsh, x, z, yato) => {
    const u = (hsh >>> 8) / 16777216;
    // 近所の田んぼは同じ時期の作業になりやすい：区画の中心で低周波の雑音を引く
    const bias = 1.35 * fbm2(x / 260 + 2, z / 260 - 6, 2);
    if (yato) {
      if (u < 0.5) return T.FLOODED;
      if (u < 0.78) return T.SEEDLING;
      if (u < 0.88) return T.RENGE;
      return T.FALLOW;
    }
    const u2 = ((hsh * 2654435761) >>> 8) / 16777216;
    const other = [T.FLOODED, T.SEEDLING, T.FALLOW, T.TILLED, T.FLOODED, T.RENGE, T.NANOHANA, T.FALLOW];
    const pick = () => other[Math.floor(u2 * other.length)];
    if (bias > 0.1) return u < 0.6 ? T.FLOODED : u < 0.85 ? T.SEEDLING : pick();      // 水を張った一帯
    if (bias < -0.3) return u < 0.5 ? T.RENGE : u < 0.75 ? T.FALLOW : pick();        // れんげの一帯
    if (bias < -0.05) return u < 0.3 ? T.FALLOW : u < 0.52 ? T.FLOODED : u < 0.68 ? T.TILLED : u < 0.8 ? T.SEEDLING : pick();
    return u < 0.42 ? T.FLOODED : u < 0.58 ? T.SEEDLING : u < 0.72 ? T.FALLOW : u < 0.84 ? T.TILLED : pick();
  };

  for (let j = 1; j < N - 1; j++) {
    const z = ORIGIN + j * CELL;
    for (let i = 1; i < N - 1; i++) {
      const k = idx(i, j);
      if (!eligible[k]) continue;
      const x = ORIGIN + i * CELL;
      const ci = cellOf(BX, WX[k]), cj = cellOf(BZ, WZ[k]);
      const c = cellSlope.get(ci * 4096 + cj);
      const sl = c ? c[0] / c[1] : slopeR[k];
      // 平らな谷底：区画ごとに一枚の平面（等高線で割らない）。斜面：等高線で段に割る
      const flat = sl < 0.035;
      const step = flat ? 0.3 : lerp(0.5, 1.5, smoothstep(0.035, 0.12, sl));
      const hm = c ? c[2] / c[1] : hB[k];
      const u = (flat ? hm : hB[k]) / step;
      const level = Math.floor(u);
      const frac = u - level;
      const H = flat ? Math.round(hm / 0.1) * 0.1 : (level + 0.5) * step;
      // 格子線までの距離（ゆがみの勾配で実距離へ）
      const gwx = Math.hypot((WX[k + 1] - WX[k - 1]) / (2 * CELL), (WX[k + N] - WX[k - N]) / (2 * CELL));
      const gwz = Math.hypot((WZ[k + 1] - WZ[k - 1]) / (2 * CELL), (WZ[k + N] - WZ[k - N]) / (2 * CELL));
      const dx = Math.min(WX[k] - BX[ci], BX[ci + 1] - WX[k]) / Math.max(gwx, 0.3);
      const dz = Math.min(WZ[k] - BZ[cj], BZ[cj + 1] - WZ[k]) / Math.max(gwz, 0.3);
      const dc = flat ? 30 : Math.min(frac, 1 - frac) * step / Math.max(slope[k], 1e-4);
      sdf[k] = Math.min(dx, dz, dc, 30);
      const hsh = hash3i(ci, cj, level + 1000);
      pkey[k] = (ci * 4096 + cj) * 64 + ((level % 64) + 64) % 64;
      prand[k] = hsh & 255;
      const yato = yatoIn[k] < 6;
      const ccx = (BX[ci] + BX[ci + 1]) * 0.5, ccz = (BZ[cj] + BZ[cj + 1]) * 0.5;
      const ty = rTypes(hash2i(hsh, 77), ccx, ccz, yato);
      type[k] = ty;
      paddy[k] = 1;
      parcelH[k] = H;
      h[k] = H;
      if (ty === T.FLOODED || ty === T.SEEDLING) water[k] = H + 0.07;
    }
  }
  // 小さすぎる区画（境目で切れた細い切れ端）は田にしない
  {
    const cnt = new Map();
    for (let k = 0; k < n; k++) if (paddy[k]) cnt.set(pkey[k], (cnt.get(pkey[k]) || 0) + 1);
    for (let k = 0; k < n; k++) {
      if (!paddy[k] || cnt.get(pkey[k]) >= 150) continue;
      paddy[k] = 0; type[k] = T.NONE; h[k] = hB[k]; water[k] = -1e4; sdf[k] = 30; eligible[k] = 0;
    }
  }
  lap('parcels');

  // 農道：いくつかの格子線に沿った土の道
  const pathX = new Set(), pathZ = new Set();
  for (let c = 0; c < BX.length; c++) if ((hash2i(c, 5) >>> 8) / 16777216 < 0.2) pathX.add(c);
  for (let c = 0; c < BZ.length; c++) if ((hash2i(c, 9) >>> 8) / 16777216 < 0.14) pathZ.add(c);
  const pathD = new Float32Array(n).fill(99);
  for (let j = 1; j < N - 1; j++) for (let i = 1; i < N - 1; i++) {
    const k = idx(i, j);
    if (!paddy[k]) continue;
    const ci = cellOf(BX, WX[k]), cj = cellOf(BZ, WZ[k]);
    const gwx = Math.hypot((WX[k + 1] - WX[k - 1]) / (2 * CELL), (WX[k + N] - WX[k - N]) / (2 * CELL));
    const gwz = Math.hypot((WZ[k + 1] - WZ[k - 1]) / (2 * CELL), (WZ[k + N] - WZ[k - N]) / (2 * CELL));
    let d = 99;
    if (pathX.has(ci)) d = Math.min(d, (WX[k] - BX[ci]) / gwx);
    if (pathX.has(ci + 1)) d = Math.min(d, (BX[ci + 1] - WX[k]) / gwx);
    if (pathZ.has(cj)) d = Math.min(d, (WZ[k] - BZ[cj]) / gwz);
    if (pathZ.has(cj + 1)) d = Math.min(d, (BZ[cj + 1] - WZ[k]) / gwz);
    pathD[k] = d;
    if (d < 1.3) { type[k] = T.DIRT; water[k] = -1e4; }
  }
  lap('paths');

  // ---- 3. 川と土手 ----
  const rdist = new Float32Array(n).fill(99);
  const flowR = new Float32Array(n * 4);
  for (let j = 0; j < N; j++) {
    const z = ORIGIN + j * CELL;
    for (let i = 0; i < N; i++) {
      const x = ORIGIN + i * CELL;
      const k = idx(i, j);
      const d = riverDist(x, z);
      rdist[k] = Math.min(d, 99);
      if (d > 14) continue;
      const wl = riverLevel(x);
      const fl = floorBase(x, z);
      const top = fl + 1.35;
      let y;
      if (d < 3.6) y = wl - 0.55 - 0.35 * (1 - d / 3.6);
      else if (d < 6.8) y = lerp(wl - 0.55, top, smoothstep(0, 1, (d - 3.6) / 3.2));
      else if (d < 9.8) y = top;
      else y = lerp(top, Math.min(h[k], top), smoothstep(0, 1, (d - 9.8) / 4.2));
      h[k] = y;
      hard[k] = d < 10.5 ? 1 : 0;
      paddy[k] = 0;
      water[k] = d < 5.2 ? wl : -1e4;
      const south = z > riverZ(x);
      type[k] = d < 4.2 ? T.RIVER : d < 6.8 ? T.BANK : T.LEVEE_BIG;
      // 川の流れ（東へ、蛇行に沿って）
      { const dz = riverDZ(x), l = Math.hypot(1, dz); flowR[k * 4] = 1 / l; flowR[k * 4 + 1] = dz / l; flowR[k * 4 + 2] = 0.55; }
      if (south && d > 5.0 && x > -240 && x < 190 && simplex2(x / 40, 3) > -0.5) type[k] = T.NANOHANA;
    }
  }
  lap('river');

  // ---- 4. ため池 ----
  const pondLevel = hB[idx(Math.round((POND.x - ORIGIN) / CELL), Math.round((POND.z - ORIGIN) / CELL))] + 0.2;
  for (let j = 0; j < N; j++) {
    const z = ORIGIN + j * CELL;
    for (let i = 0; i < N; i++) {
      const x = ORIGIN + i * CELL;
      const e = Math.hypot((x - POND.x) / POND.rx, (z - POND.z) / POND.rz) + 0.08 * simplex2(x / 12, z / 12);
      if (e > 1.5) continue;
      const k = idx(i, j);
      if (e < 1.2 && e >= 1) water[k] = pondLevel; // 岸の下まで水面を伸ばす（岸の地面が隠す）
      if (e < 1) {
        h[k] = pondLevel - 0.3 - 1.8 * (1 - e * e);
        water[k] = pondLevel;
        type[k] = T.POND;
        hard[k] = 1;
        paddy[k] = 0;
      } else {
        h[k] = lerp(pondLevel + 0.35, h[k], smoothstep(1, 1.5, e));
        if (e >= 1.2) water[k] = -1e4;
        paddy[k] = 0;
        type[k] = T.MEADOW;
      }
    }
  }
  // 堤（池の下流側の土の堰）
  {
    const dx = 0, dz = 1; // 谷戸Aは北へ入るので下流は南
    const cx = POND.x, cz = POND.z + POND.rz + 4;
    for (let j = 0; j < N; j++) {
      const z = ORIGIN + j * CELL;
      if (Math.abs(z - cz) > 10) continue;
      for (let i = 0; i < N; i++) {
        const x = ORIGIN + i * CELL;
        if (Math.abs(x - cx) > 50) continue;
        const k = idx(i, j);
        const u = Math.abs(z - cz);
        const top = pondLevel + 0.9;
        if (u < 2) { h[k] = Math.max(h[k], top); hard[k] = 1; type[k] = T.LEVEE_BIG; paddy[k] = 0; water[k] = -1e4; }
        else if (u < 8) { const y = lerp(top, h[k], smoothstep(2, 8, u)); if (y > h[k]) { h[k] = y; type[k] = T.LEVEE_BIG; paddy[k] = 0; water[k] = -1e4; } }
      }
    }
    void dx; void dz;
  }
  lap('pond');
  // 渓流：段ごとの水面・川床・滝つぼ・滝口の小さな淵（池の岸の盛り土も切る）
  const flow = flowR;   // 流れの向き xy・速さ・白い泡
  gorgeWater({ h, water, type, hard, paddy, flow, gorge, G, pondLevel });
  lap('stream');

  // ---- 5. 屋敷の敷地 ----
  const plots = [];
  for (const hs of HOUSES) {
    const [pw, pd] = hs.plot;
    const c = Math.cos(hs.rot), s = Math.sin(hs.rot);
    const cx = hs.x + s * (pd * 0.12), cz = hs.z + c * (pd * 0.12); // 家の前（南）に庭が広い
    const ph = hB[idx(Math.round((hs.x - ORIGIN) / CELL), Math.round((hs.z - ORIGIN) / CELL))] - 0.3;
    hs.y = ph;
    plots.push({ cx, cz, pw, pd, c, s, ph, house: hs });
  }
  for (const p of plots) {
    const r = Math.hypot(p.pw, p.pd) * 0.5 + 6;
    const i0 = Math.max(0, Math.floor((p.cx - r - ORIGIN) / CELL)), i1 = Math.min(N - 1, Math.ceil((p.cx + r - ORIGIN) / CELL));
    const j0 = Math.max(0, Math.floor((p.cz - r - ORIGIN) / CELL)), j1 = Math.min(N - 1, Math.ceil((p.cz + r - ORIGIN) / CELL));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const x = ORIGIN + i * CELL - p.cx, z = ORIGIN + j * CELL - p.cz;
      const u = x * p.c - z * p.s, v = x * p.s + z * p.c;
      const du = Math.abs(u) - p.pw / 2, dv = Math.abs(v) - p.pd / 2;
      const dout = Math.max(du, dv);
      const k = idx(i, j);
      if (dout < 0) {
        h[k] = p.ph; hard[k] = 1; paddy[k] = 0; water[k] = -1e4; type[k] = T.YARD;
      } else if (dout < 4) {
        paddy[k] = 0; water[k] = -1e4;
        if (type[k] !== T.RIVER) type[k] = T.MEADOW;
      }
    }
  }
  // 畑（家の横）
  const gardens = [];
  for (const hs of HOUSES) {
    const side = (hash2i(hs.x | 0, 3) & 1) ? 1 : -1;
    const c = Math.cos(hs.rot), s = Math.sin(hs.rot);
    const off = hs.plot[0] * 0.5 + 9;
    gardens.push({ cx: hs.x + c * off * side, cz: hs.z + 4 - s * off * side, w: 14, d: 18, c, s, y: hs.y - 0.2 });
  }
  for (const g of gardens) {
    const r = Math.hypot(g.w, g.d) * 0.5 + 2;
    const i0 = Math.max(0, Math.floor((g.cx - r - ORIGIN) / CELL)), i1 = Math.min(N - 1, Math.ceil((g.cx + r - ORIGIN) / CELL));
    const j0 = Math.max(0, Math.floor((g.cz - r - ORIGIN) / CELL)), j1 = Math.min(N - 1, Math.ceil((g.cz + r - ORIGIN) / CELL));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const x = ORIGIN + i * CELL - g.cx, z = ORIGIN + j * CELL - g.cz;
      const u = x * g.c - z * g.s, v = x * g.s + z * g.c;
      if (Math.abs(u) > g.w / 2 || Math.abs(v) > g.d / 2) continue;
      const k = idx(i, j);
      if (hard[k]) continue;
      h[k] = lerp(h[k], g.y, 0.85); paddy[k] = 0; water[k] = -1e4; type[k] = T.GARDEN;
    }
  }
  lap('plots');

  // ---- 6. 道 ----
  const roads = roadPolylines().map((r) => ({ ...r, pts: smoothPolyline(r.pts, 2) }));
  const bridgeDeck = floorBase(BRIDGE.x, BRIDGE.z) + 1.35 + 0.35;
  const sampleH = (x, z) => {
    const fi = (x - ORIGIN) / CELL, fj = (z - ORIGIN) / CELL;
    const i = clamp(Math.floor(fi), 0, N - 2), j = clamp(Math.floor(fj), 0, N - 2);
    const u = clamp(fi - i, 0, 1), v = clamp(fj - j, 0, 1);
    const a = h[idx(i, j)], b = h[idx(i + 1, j)], c = h[idx(i, j + 1)], d = h[idx(i + 1, j + 1)];
    return lerp(lerp(a, b, u), lerp(c, d, u), v);
  };
  for (const r of roads) {
    const raw = r.pts.map(([x, z]) => {
      const d = riverDist(x, z);
      if (d < 10) return bridgeDeck;
      return sampleH(x, z);
    });
    const sm = raw.map((_, i) => {
      let s = 0, w = 0;
      for (let o = -10; o <= 10; o++) {
        const q = raw[clamp(i + o, 0, raw.length - 1)];
        const ww = Math.exp(-(o * o) / 30);
        s += q * ww; w += ww;
      }
      return s / w;
    });
    r.h = sm.map((v, i) => Math.max(v, raw[i] - 0.6) + 0.22);
  }
  // 道の距離場（空間ハッシュ）
  const BUCK = 16;
  const buckets = new Map();
  const segs = [];
  for (const r of roads) {
    for (let i = 0; i < r.pts.length - 1; i++) {
      const a = r.pts[i], b = r.pts[i + 1];
      const sg = { ax: a[0], az: a[1], bx: b[0], bz: b[1], ha: r.h[i], hb: r.h[i + 1], hw: r.hw, kind: r.kind, road: r.id };
      segs.push(sg);
      const minx = Math.min(a[0], b[0]) - 10, maxx = Math.max(a[0], b[0]) + 10;
      const minz = Math.min(a[1], b[1]) - 10, maxz = Math.max(a[1], b[1]) + 10;
      for (let bx = Math.floor(minx / BUCK); bx <= Math.floor(maxx / BUCK); bx++)
        for (let bz = Math.floor(minz / BUCK); bz <= Math.floor(maxz / BUCK); bz++) {
          const key = bx * 100000 + bz;
          if (!buckets.has(key)) buckets.set(key, []);
          buckets.get(key).push(sg);
        }
    }
  }
  const roadD = new Float32Array(n).fill(40);
  for (let j = 0; j < N; j++) {
    const z = ORIGIN + j * CELL;
    for (let i = 0; i < N; i++) {
      const x = ORIGIN + i * CELL;
      const list = buckets.get(Math.floor(x / BUCK) * 100000 + Math.floor(z / BUCK));
      if (!list) continue;
      let best = 1e9, bh = 0, bw = 2, bk = 'dirt';
      for (const s of list) {
        const vx = s.bx - s.ax, vz = s.bz - s.az;
        const l2 = vx * vx + vz * vz;
        let t = l2 > 0 ? ((x - s.ax) * vx + (z - s.az) * vz) / l2 : 0;
        t = clamp(t, 0, 1);
        const px = s.ax + vx * t - x, pz = s.az + vz * t - z;
        const d = Math.hypot(px, pz) - s.hw;
        if (d < best) { best = d; bh = lerp(s.ha, s.hb, t); bw = s.hw; bk = s.kind; }
      }
      const k = idx(i, j);
      roadD[k] = Math.min(best, 40);
      if (best > 3) continue;
      const underBridge = rdist[k] < 6.9;
      if (best < 0) {
        if (underBridge) continue;
        h[k] = bh; hard[k] = 1; paddy[k] = 0; water[k] = -1e4;
        type[k] = bk === 'asphalt' ? T.ASPHALT : bk === 'gravel' ? T.GRAVEL : T.DIRT;
      } else {
        if (underBridge) continue;
        if (type[k] === T.YARD) continue;
        const y = lerp(bh - 0.05, h[k], smoothstep(0, 3, best));
        h[k] = y; paddy[k] = 0; water[k] = -1e4;
        if (type[k] !== T.NANOHANA) type[k] = T.MEADOW;
      }
    }
  }
  lap('roads');

  // ---- 7. 法面：高い所から低い所へ斜面を下ろす（2回走査） ----
  const K = 0.95;
  const d1 = K * CELL, d2 = K * CELL * Math.SQRT2;
  const relax = (k, q, d) => { const c = h[q] - d; if (c > h[k]) h[k] = c; };
  for (let j = 1; j < N - 1; j++) for (let i = 1; i < N - 1; i++) {
    const k = idx(i, j);
    if (hard[k]) continue;
    relax(k, k - 1, d1); relax(k, k - N - 1, d2); relax(k, k - N, d1); relax(k, k - N + 1, d2);
  }
  for (let j = N - 2; j >= 1; j--) for (let i = N - 2; i >= 1; i--) {
    const k = idx(i, j);
    if (hard[k]) continue;
    relax(k, k + 1, d1); relax(k, k + N + 1, d2); relax(k, k + N, d1); relax(k, k + N - 1, d2);
  }
  // 法面の角を丸める（田の平らな面と固い所はそのまま）
  {
    const soft = new Uint8Array(n);
    for (let k = 0; k < n; k++) soft[k] = !hard[k] && (!paddy[k] || h[k] > parcelH[k] + 0.03) ? 1 : 0;
    const tmp = new Float32Array(n);
    for (let it = 0; it < 2; it++) {
      tmp.set(h);
      for (let j = 1; j < N - 1; j++) for (let i = 1; i < N - 1; i++) {
        const k = idx(i, j);
        if (!soft[k]) continue;
        let s = tmp[k] * 4, w = 4;
        s += tmp[k - 1] * 2 + tmp[k + 1] * 2 + tmp[k - N] * 2 + tmp[k + N] * 2; w += 8;
        s += tmp[k - N - 1] + tmp[k - N + 1] + tmp[k + N - 1] + tmp[k + N + 1]; w += 4;
        let v = s / w;
        // 平らな田面より下げない（水がこぼれないように）
        if (paddy[k]) v = Math.max(v, parcelH[k] + 0.04);
        h[k] = v;
      }
    }
  }
  // 持ち上がった田面は水を引く・畦を盛る
  for (let k = 0; k < n; k++) {
    if (!paddy[k]) continue;
    if (h[k] > parcelH[k] + 0.03) { water[k] = -1e4; }
    const lev = 1 - smoothstep(0.1, 0.95, sdf[k]);
    h[k] += 0.2 * lev;
    if (water[k] > -1e3 && h[k] > water[k] - 0.02) water[k] = -1e4;
  }
  lap('banks');

  // ---- 8. 森・竹林・杉林・原っぱ ----
  const forest = new Float32Array(n);
  for (let j = 0; j < N; j++) {
    const z = ORIGIN + j * CELL;
    for (let i = 0; i < N; i++) {
      const x = ORIGIN + i * CELL;
      const k = idx(i, j);
      const t = tA[k];
      const edge = 26 + 20 * fbm2(x / 140 + 5, z / 140, 3);
      let f = smoothstep(edge - 8, edge + 12, t);
      if (yatoIn[k] < 1e8) f = Math.min(f, smoothstep(8, 22, yatoIn[k] + 6 * simplex2(x / 50, z / 50)));
      f = Math.max(f, smoothstep(0.26, 0.4, slope[k]) * (paddy[k] ? 0 : 1));
      if (paddy[k] || hard[k] || type[k] === T.GARDEN || type[k] === T.NANOHANA || type[k] === T.MEADOW) f = 0;
      if (roadD[k] < 4) f = 0;
      // 滝の谷：床と岩肌の帯には木を植えない（崖の上の縁も少し空ける）
      if (G.band[k] > 0.5) f = 0;
      // 山の上の見晴らし：原っぱと、谷へ下る斜面の見通し
      if (ridgeOpen(x, z)) f = 0;
      // 丘の低いところに草地の空き地（滝の谷の斜面は森のまま）
      const cl = fbm2(x / 110 - 3, z / 110 + 8, 3);
      const gl = gorgeLocal(x, z);
      const inGorge = gl.s > 236 && gl.s < 480 && Math.abs(gl.a) < 70;
      if (t < 170 && t > 10 && !inGorge) f *= 1 - smoothstep(0.34, 0.46, cl);
      if (inGorge && G.band[k] < 0.5 && slope[k] > 0.35 && Math.hypot((x - POND.x) / POND.rx, (z - POND.z) / POND.rz) > 1.16) { f = 1; if (type[k] === T.MEADOW) type[k] = T.FOREST; }
      forest[k] = f;
    }
  }
  // 敷地の周りは森を空ける
  for (const p of plots) {
    const r = Math.hypot(p.pw, p.pd) * 0.5 + 8;
    const i0 = Math.max(0, Math.floor((p.cx - r - ORIGIN) / CELL)), i1 = Math.min(N - 1, Math.ceil((p.cx + r - ORIGIN) / CELL));
    const j0 = Math.max(0, Math.floor((p.cz - r - ORIGIN) / CELL)), j1 = Math.min(N - 1, Math.ceil((p.cz + r - ORIGIN) / CELL));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const x = ORIGIN + i * CELL - p.cx, z = ORIGIN + j * CELL - p.cz;
      const u = x * p.c - z * p.s, v = x * p.s + z * p.c;
      const dout = Math.max(Math.abs(u) - p.pw / 2, Math.abs(v) - p.pd / 2);
      const k = idx(i, j);
      if (dout < 5) forest[k] = 0;
    }
  }
  // 残りの地表の種類
  for (let j = 0; j < N; j++) {
    const z = ORIGIN + j * CELL;
    for (let i = 0; i < N; i++) {
      const x = ORIGIN + i * CELL;
      const k = idx(i, j);
      if (type[k] !== T.NONE) continue;
      if (G.band[k] > 0.5) { type[k] = G.rock[k] > 0.5 ? T.ROCK : T.MOSS; continue; }
      const kd = Math.hypot(x - KNOLL.x, z - KNOLL.z) + 7 * simplex2(x / 14 + 3, z / 14 - 1);
      if (kd < KNOLL.r * 2.0) { type[k] = T.KNOLL; continue; }
      type[k] = forest[k] > 0.5 ? T.FOREST : T.MEADOW;
    }
  }
  lap('forest');

  // ---- 9. 木の配置 ----
  const trees = placeTrees({ h, forest, type, tA, slope, roadD, rdist, plots, G });
  lap(`trees ${trees.length}`);

  // ---- 10. 竹林の中の種類を反映 ----
  for (const t of trees) {
    if (t.sp !== SP.BAMBOO) continue;
    const i = Math.round((t.x - ORIGIN) / CELL), j = Math.round((t.z - ORIGIN) / CELL);
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      const q = idx(clamp(i + di, 0, N - 1), clamp(j + dj, 0, N - 1));
      if (type[q] === T.FOREST || type[q] === T.MEADOW) type[q] = T.BAMBOO;
    }
  }

  // ---- 11. 岩（滝の谷・山の上・川の上手） ----
  const rocks = placeRocks({ h, water, type, G, forest });
  lap(`rocks ${rocks.length}`);

  return {
    N, CELL, ORIGIN, SIZE,
    height: h, water, type, prand, sdf, roadD, rdist, pathD, forest, flow,
    trees, plots, gardens, roads, segs, pondLevel, bridgeDeck,
    gorge: G, rocks,
  };
}

function boxBlur(src, r) {
  const n = N * N;
  const tmp = new Float32Array(n), out = new Float32Array(n);
  for (let j = 0; j < N; j++) {
    let s = 0;
    for (let i = -r; i <= r; i++) s += src[j * N + clamp(i, 0, N - 1)];
    for (let i = 0; i < N; i++) {
      tmp[j * N + i] = s / (2 * r + 1);
      s += src[j * N + clamp(i + r + 1, 0, N - 1)] - src[j * N + clamp(i - r, 0, N - 1)];
    }
  }
  for (let i = 0; i < N; i++) {
    let s = 0;
    for (let j = -r; j <= r; j++) s += tmp[clamp(j, 0, N - 1) * N + i];
    for (let j = 0; j < N; j++) {
      out[j * N + i] = s / (2 * r + 1);
      s += tmp[clamp(j + r + 1, 0, N - 1) * N + i] - tmp[clamp(j - r, 0, N - 1) * N + i];
    }
  }
  return out;
}

// 木の配置：揺らした格子＋棄却
function placeTrees({ h, forest, type, tA, slope, roadD, rdist, plots, G: GG }) {
  const trees = [];
  const r = mulberry32(777);
  const at = (x, z) => {
    const i = clamp(Math.round((x - ORIGIN) / CELL), 0, N - 1), j = clamp(Math.round((z - ORIGIN) / CELL), 0, N - 1);
    return j * N + i;
  };
  const hAt = (x, z) => {
    const fi = clamp((x - ORIGIN) / CELL, 0, N - 1.001), fj = clamp((z - ORIGIN) / CELL, 0, N - 1.001);
    const i = Math.floor(fi), j = Math.floor(fj), u = fi - i, v = fj - j;
    const k = j * N + i;
    return lerp(lerp(h[k], h[k + 1], u), lerp(h[k + N], h[k + N + 1], u), v);
  };
  const add = (x, z, sp, s, extra = {}) => {
    trees.push({ x, y: hAt(x, z), z, sp, s, rot: r() * Math.PI * 2, c: r(), ...extra });
  };
  const lim = -ORIGIN - 4;
  // 杉林の区域
  const cedarZone = (x, z, t) => (fbm2(x / 260 + 1.3, z / 260 - 4.4, 3) > 0.2 && t > 40) || Math.hypot(x - SHRINE.x, z - SHRINE.shrineZ) < 60;
  // 竹林の区域：集落の背後
  const bambooZone = (x, z) => {
    for (const p of plots) {
      const bx = p.cx + p.s * (-p.pd * 0.5 - 20), bz = p.cz - p.c * (p.pd * 0.5 + 20);
      const d = Math.hypot(x - bx, (z - bz) * 1.4) + 8 * simplex2(x / 25, z / 25);
      if (d < 26) return true;
    }
    return false;
  };
  // 広葉樹・杉：森の中
  const G = 7.2;
  for (let gz = -lim; gz < lim; gz += G) for (let gx = -lim; gx < lim; gx += G) {
    let x = gx + (r() - 0.5) * G * 0.9, z = gz + (r() - 0.5) * G * 0.9;
    const k = at(x, z);
    const f = forest[k];
    if (f < 0.35 || r() > f * 1.05) continue;
    const t = tA[k];
    if (bambooZone(x, z)) continue;
    if (Math.hypot(x - SHRINE.x, z - SHRINE.shrineZ) < 7) continue;
    if (Math.abs(x - SHRINE.x) < 3.5 && z > SHRINE.toriiZ - 3 && z < SHRINE.shrineZ + 3) continue;
    if (cedarZone(x, z, t)) {
      // 杉は密に
      add(x, z, SP.CEDAR, 0.85 + 0.35 * r());
      const x2 = x + (r() - 0.5) * 5, z2 = z + (r() - 0.5) * 5;
      if (r() < 0.55 && forest[at(x2, z2)] > 0.5) add(x2, z2, SP.CEDAR, 0.8 + 0.3 * r());
      continue;
    }
    if (Math.hypot(x - SHRINE.x, z - SHRINE.shrineZ) < 7) continue;
    if (Math.abs(x - SHRINE.x) < 3.5 && z > SHRINE.toriiZ - 3 && z < SHRINE.shrineZ + 3) continue;
    const u = r();
    const nearShrine = Math.hypot(x - SHRINE.x, z - SHRINE.shrineZ) < 110;
    let sp = SP.OAK;
    if (u < 0.065) sp = SP.YAMAZAKURA;
    else if (u < 0.085) sp = SP.KOBUSHI;
    else if (u < (nearShrine ? 0.5 : 0.2)) sp = SP.EVERGREEN;
    const edge = forest[at(x + 9, z)] < 0.3 || forest[at(x - 9, z)] < 0.3 || forest[at(x, z + 9)] < 0.3 || forest[at(x, z - 9)] < 0.3;
    if (edge && r() < 0.45) sp = SP.SHRUB;
    add(x, z, sp, sp === SP.SHRUB ? 0.7 + 0.5 * r() : 0.8 + 0.45 * r());
  }
  // 竹林
  const GB = 1.9;
  for (let gz = -lim; gz < lim; gz += GB) for (let gx = -lim; gx < lim; gx += GB) {
    if (Math.abs(gz - (-230)) > 120) continue;
    const x = gx + (r() - 0.5) * GB, z = gz + (r() - 0.5) * GB;
    if (!bambooZone(x, z)) continue;
    const k = at(x, z);
    if (type[k] === T.YARD || roadD[k] < 3 || type[k] === T.GARDEN) continue;
    add(x, z, SP.BAMBOO, 0.8 + 0.4 * r());
  }
  // 川沿いの桜並木（北の土手の外側）
  for (let x = -340; x < -30; x += 7.5 + r() * 1.5) {
    const zr = riverZ(x);
    const nz = -1 / Math.sqrt(1 + riverDZ(x) ** 2);
    const d = 11.6;
    const px = x - riverDZ(x) * nz * d * 0 , pz = zr + nz * d;
    add(px, pz, SP.SAKURA, 0.95 + 0.2 * r());
  }
  // 柳（川の南側に数本）
  for (const x of [120, 175, 236, -420, -470]) {
    const zr = riverZ(x);
    add(x + r() * 4, zr + 7.2, SP.WILLOW, 0.9 + 0.2 * r());
  }
  // 一本桜
  add(KNOLL.x + 1.5, KNOLL.z - 1, SP.SAKURA, 2.05, { hero: 1 });
  // 集落の木：柿・欅・椿・生垣の低木
  for (const p of plots) {
    const hs = p.house;
    const loc = (u, v) => [p.cx + u * p.c + v * p.s, p.cz - u * p.s + v * p.c];
    let [x, z] = loc(-p.pw * 0.36, p.pd * 0.3);
    add(x, z, SP.KAKI, 0.9 + 0.2 * r());
    [x, z] = loc(p.pw * 0.42, -p.pd * 0.42);
    add(x, z, (hash2i(hs.x | 0, 7) & 1) ? SP.KEYAKI : SP.EVERGREEN, 1.1 + 0.3 * r());
    for (let q = 0; q < 5; q++) {
      [x, z] = loc((r() - 0.5) * p.pw * 1.0, -p.pd * 0.5 - 1.5 + r());
      add(x, z, SP.CAMELLIA, 0.8 + 0.4 * r());
    }
    // 庭の躑躅（つつじ）：家の前の左右に、丸い株
    const hc = Math.cos(hs.rot), hsn = Math.sin(hs.rot);
    const hloc = (u, v) => [hs.x + u * hc + v * hsn, hs.z - u * hsn + v * hc];
    const az = hs.id === 'h1' ? [[-8.8, 7.2], [8.6, 7.8], [9.8, 6.4]] : [[-hs.w * 0.45, hs.d * 0.5 + 3], [hs.w * 0.4, hs.d * 0.5 + 3.5], [hs.w * 0.5 + 1.5, 1]];
    for (const [u, v] of az) { [x, z] = hloc(u + (r() - 0.5) * 0.6, v + (r() - 0.5) * 0.6); add(x, z, SP.TSUTSUJI, 0.85 + 0.4 * r()); }
    // 前面の生垣（始まりの家は縁側から谷が見えるよう低く、真ん中を空ける）
    const main = hs.id === 'h1';
    for (let u = -p.pw * 0.5 + 1; u < p.pw * 0.5; u += 1.6) {
      if (Math.abs(u) < (main ? 10 : 3)) continue; // 入口
      [x, z] = loc(u, p.pd * 0.5 - 0.8);
      add(x, z, SP.SHRUB, (main ? 0.3 : 0.42) + 0.08 * r(), { hedge: 1 });
    }
  }
  // 滝の谷：崖の上の縁と岩壁の棚に、しがみつく低木・躑躅・山桜
  if (GG) {
    for (let a = -26; a <= 26; a += 2.6 + r() * 3) {
      if (Math.abs(a) < 4) continue;
      const [x, z] = gorgeWorld(cliffLine(a) + 2.5 + r() * 4, a);
      const u = r();
      add(x, z, u < 0.55 ? SP.SHRUB : u < 0.8 ? SP.TSUTSUJI : SP.YAMAZAKURA, u < 0.8 ? 0.7 + 0.5 * r() : 0.75 + 0.2 * r());
    }
    for (let q = 0; q < 16; q++) {
      const s0 = GORGE.sIn + 10 + r() * (GORGE.sTop - GORGE.sIn - 6);
      const side = r() < 0.5 ? -1 : 1;
      const [x, z] = gorgeWorld(s0, side * (floorHalfW(s0) + 1.5 + r() * 3.5));
      add(x, z, r() < 0.6 ? SP.SHRUB : SP.TSUTSUJI, 0.6 + 0.5 * r());
    }
  }
  // 神社の杉（背が高い）
  for (let q = 0; q < 26; q++) {
    const a = r() * Math.PI * 2, d = 10 + r() * 34;
    const x = SHRINE.x + Math.cos(a) * d, z = SHRINE.shrineZ - 6 + Math.sin(a) * d * 0.8;
    if (Math.abs(x - SHRINE.x) < 4 && z < SHRINE.shrineZ + 2) continue; // 石段
    add(x, z, SP.CEDAR, 1.35 + 0.3 * r(), { tall: 1 });
  }
  return trees;
}

// ---- 共通：格子の値を双線形で読む ----
function bilinear(arr, x, z) {
  const fi = clamp((x - ORIGIN) / CELL, 0, N - 1.001), fj = clamp((z - ORIGIN) / CELL, 0, N - 1.001);
  const i = Math.floor(fi), j = Math.floor(fj), u = fi - i, v = fj - j;
  const k = j * N + i;
  return lerp(lerp(arr[k], arr[k + 1], u), lerp(arr[k + N], arr[k + N + 1], u), v);
}
const texelOf = (x, z) => idx(clamp(Math.round((x - ORIGIN) / CELL), 0, N - 1), clamp(Math.round((z - ORIGIN) / CELL), 0, N - 1));

// ---- 滝の谷：床・滝つぼ・崖（岩壁）を削る ----
// 床は段ごとに少しずつ上がり、両側は岩の帯から森の斜面へ。s=sCliff で地面が一気に崖の上へ立ち上がる
const GZ_E = edgeN(YATOS[0].mx);
const floorHalfW = (s) => lerp(8.6 + 1.8 * Math.sin(s / 9.0) + 1.1 * Math.sin(s / 3.7 + 1.3), 14.8, smoothstep(376, 395, s));
const upperA = (s) => { const k = smoothstep(GORGE.sCliff + 3, GORGE.sCliff + 14, s); return 0.6 * Math.sin(s / 8.5 + 0.4) + k * (3.2 * Math.sin(s / 13 + 1.1) + 1.4 * Math.sin(s / 5.3 + 0.2)); };   // 滝口より上の流れの横のずれ
// 崖の線（s）：両端が回りこみ、岩の出入りで凸凹。滝口（a≈0）のところは奥へ少し切れ込む
export function cliffLine(a) {
  return GORGE.sCliff - 5.5 * (a / 16) ** 2 + 1.9 * simplex2(a / 5.2 + 7.3, 1.1) + 0.9 * simplex2(a / 2.1 - 3.3, 4.2) + 0.8 * Math.exp(-((a / 2.5) ** 2));
}
// ---- 渓流の水面の形：段ごとの淵（平ら）と、岩の段を越えて下の淵へ落ちる水の舌 ----
// 落ち口の線は斜めで、水の集まる切れ目（gap）のところが上流へ食いこむ。ac は流れの中心からの横の位置
export const streamHalfW = (s) => 1.25 + 0.45 * Math.sin(s / 6.3 + 1.0);
export function streamProfile(G, pondLevel) {
  const Ls = G.Ls, Ld = 1.15;
  const steps = [];
  for (let k = 0; k <= GORGE.steps; k++) {
    const sb = GORGE.sIn + k * Ls;
    let base, crest;
    if (k === 0) { base = sb + 0.5; crest = base + Ld * 0.8; }
    // 滝つぼの出口：滝つぼの水面（格子）が舌の上へはみ出さないよう、舌は出口の縁から少し下流に置く
    else if (k === GORGE.steps) { crest = sb - 2.4; base = crest - Ld * 1.1; }
    else { base = sb - Ld * 0.5; crest = sb + Ld * 0.5; }
    const hw = streamHalfW(crest);
    steps.push({
      k, base, crest,
      up: k === GORGE.steps ? G.poolLevel : streamLevel(k),
      dn: k === 0 ? pondLevel : streamLevel(k - 1),
      tilt: (hashf2(k, 11) - 0.5) * (k === GORGE.steps ? 0.15 : 0.45),
      gap: (hashf2(k, 12) - 0.5) * hw * 0.9,
      bite: k === GORGE.steps ? 0.2 : 0.35 + 0.4 * hashf2(k, 13),
    });
  }
  // 落ち口の線のずれ（下流へ＋）：斜め＋切れ目が上流へ食いこむ＋小さな凸凹
  const shiftOf = (st, ac) => st.tilt * ac + st.bite * Math.exp(-((ac - st.gap) ** 2) / 0.55) + 0.12 * Math.sin(ac * 2.3 + st.k * 1.7);
  const level = (s, ac = 0) => {
    let lv = pondLevel;
    for (const st of steps) {
      const sh = shiftOf(st, ac);
      const b = st.base + sh, c = st.crest + sh;
      if (s < b) return lv;
      if (s <= c) { const u = (s - b) / (c - b); return st.dn + (st.up - st.dn) * (1 - Math.pow(1 - u, 2.2)); }
      lv = st.up;
    }
    return lv;
  };
  // 白さ（泡立ち）と流れの速さ：舌の上で白くなり、下の淵で泡が流れてほどける
  const white = (s, ac = 0) => {
    let w = 0;
    for (const st of steps) {
      const sh = shiftOf(st, ac);
      const b = st.base + sh, c = st.crest + sh;
      const g = 0.62 + 0.38 * Math.exp(-((ac - st.gap) ** 2) / 0.45);
      const drop = Math.min(1, (st.up - st.dn) * 1.5);
      // 落ち口の縁だけ透きとおり、落ちはじめてすぐ白く砕ける
      if (s >= b && s <= c) { const u = (s - b) / (c - b); w = Math.max(w, g * drop * (0.95 - 0.87 * Math.pow(u, 2.5))); }
      else if (s < b && s > b - 5) w = Math.max(w, g * drop * 0.85 * Math.exp(-(b - s) / 1.1));
    }
    return w;
  };
  const speed = (s, ac = 0) => {
    let v = 0.55;
    for (const st of steps) {
      const sh = shiftOf(st, ac);
      const b = st.base + sh, c = st.crest + sh;
      if (s >= b && s <= c) v = Math.max(v, 0.9 + 2.2 * Math.pow(1 - (s - b) / (c - b), 0.8));
      else if (s < b && s > b - 4) v = Math.max(v, 0.55 + 1.9 * Math.exp(-(b - s) / 1.2));
    }
    return v;
  };
  // 川床の深さ：淵は深く、落ち口の岩の段は浅く、落ちたところはえぐれて深い
  const depth = (s, ac = 0) => {
    let d = 0.55;
    for (const st of steps) {
      const sh = shiftOf(st, ac);
      const b = st.base + sh, c = st.crest + sh;
      if (s >= b - 0.2 && s <= c + 0.6) d = Math.min(d, 0.3);
      if (s < b - 0.2 && s > b - 3.2) d = Math.max(d, 0.55 + 0.35 * Math.sin(Math.PI * (b - 0.2 - s) / 3.0));
    }
    return d;
  };
  // s のまわり ±r での一番高い水位（岸はこれより高くして水を閉じこめる）
  const levelMax = (s, r = 1.3) => Math.max(level(s - r), level(s), level(s + r), level(s - r, -1.5), level(s + r, 1.5), level(s + r, -1.5), level(s - r, 1.5));
  return { steps, shiftOf, level, white, speed, depth, levelMax, s0: GORGE.sIn - 1.6, s1: GORGE.sTop + 1.3 };
}

function carveGorge(hB, mask) {
  const n = N * N;
  const band = new Float32Array(n), rock = new Float32Array(n);
  const hB0 = new Float32Array(hB);
  // 滝口の高さ：崖の上の地面を少し持ち上げて、落差を18m前後にする
  const lipH = 48.2;
  const poolLevel = streamLevel(GORGE.steps - 1) + 1.05;
  const Ls = (GORGE.sTop - GORGE.sIn) / GORGE.steps;
  const zA = GZ_E - 482, zB = GZ_E - 300;
  for (let j = 0; j < N; j++) {
    const z = ORIGIN + j * CELL;
    if (z < zA || z > zB) continue;
    for (let i = 0; i < N; i++) {
      const x = ORIGIN + i * CELL;
      const { s, a } = gorgeLocal(x, z);
      if (s < GORGE.sIn - 14 || s > 480 || Math.abs(a) > 75) continue;
      const k = idx(i, j);
      const base = hB0[k];
      let hNew = base;
      // 崖の線：両端が滝つぼの側へ回りこむ（円形の岩壁）。出入りのある不規則な線
      const sC = cliffLine(a);
      if (s < sC) {
        // 床の高さ（段の中で少しずつ上がる）
        let F;
        if (s < GORGE.sTop) {
          const st = streamStep(s);
          const u = clamp((s - GORGE.sIn) / Ls - st, 0, 1);
          F = streamLevel(st) + 0.38 + 0.5 * u;
        } else F = poolLevel + 0.6;
        F += 0.22 * simplex2(x / 2.6, z / 2.6) + 0.35 * simplex2(x / 7.5 + 3, z / 7.5);
        const Wf = floorHalfW(s);
        const d = Math.abs(a) - Wf;
        // 岩の帯（高さ12〜16m）→ 森の斜面
        const wallH = lerp(5, 15, smoothstep(338, 392, s));
        const wall = d > 0 ? wallH * smoothstep(0, 5.2, d) + 1.05 * Math.max(0, d - 5.2) + 1.4 * simplex2(x / 5.5, z / 5.5) * smoothstep(0.5, 3, d) : 0;
        let hg = F + wall;
        // 滝つぼ
        const dp = Math.hypot(s - GORGE.sPool, a);
        if (dp < GORGE.poolR + 3.2) {
          const bowl = dp < GORGE.poolR ? poolLevel - 0.7 - 2.3 * (1 - (dp / GORGE.poolR) ** 2) : lerp(poolLevel - 0.7, poolLevel + 0.75, smoothstep(GORGE.poolR, GORGE.poolR + 2.6, dp));
          hg = Math.min(hg, bowl);
        }
        // 池の側では削り込みを弱める
        const kin = smoothstep(GORGE.sIn - 12, GORGE.sIn + 1, s);
        hNew = Math.min(base, lerp(base, hg, kin));
        if (d < 1.2 && s > GORGE.sIn - 6) mask[k] = 1;
        if (d < 5.6 && s > GORGE.sIn - 8) band[k] = 1;
        if (d > -0.2 && d < 5.6 && s > GORGE.sIn + 4) rock[k] = smoothstep(-0.2, 1.2, d) * (0.65 + 0.35 * smoothstep(340, 380, s));
        if (dp > GORGE.poolR - 0.8 && dp < GORGE.poolR + 2.4) rock[k] = Math.max(rock[k], 0.85);
        if (s > sC - 2.5 && Math.abs(a) < 24) { band[k] = 1; rock[k] = 1; }
      } else {
        // 崖の上：谷の頭を滝口の高さまで持ち上げる（横と奥へなだらかにもとの地面へ）
        const crown = lipH + 0.3 + 0.28 * (s - GORGE.sCliff) + 1.6 * simplex2(a / 7.5 + 4.1, 0.5) * smoothstep(3, 9, Math.abs(a)) + 0.5 * simplex2(x / 3, z / 3);
        const kc = (1 - smoothstep(16, 34, Math.abs(a))) * (1 - smoothstep(GORGE.sCliff + 18, GORGE.sCliff + 42, s));
        hNew = Math.max(base, lerp(base, crown, kc));
        // 崖の上：滝口の淵と、上へ続く急な流れの溝
        const aU = upperA(s);
        const dU = Math.abs(a - aU);
        if (s < GORGE.sCliff + 7.5) {
          const bed = lipH - 0.6 + 0.95 * smoothstep(0.9, 2.8, dU);
          if (dU < 3.2) hNew = Math.min(hNew, bed);
        } else if (s < 476) {
          const bed = Math.max(lipH - 0.6, Math.max(bilinear(hB0, ...gorgeWorld(s, aU)), lipH + 0.3 + 0.28 * (s - GORGE.sCliff)) - 1.1) + 1.0 * smoothstep(0.7, 2.4, dU);
          if (dU < 2.6) hNew = Math.min(hNew, bed);
        }
        if (dU < 2.8) { mask[k] = 1; band[k] = 1; rock[k] = Math.max(rock[k], dU > 1.3 ? 0.9 : 0.6); }
        if (s < GORGE.sCliff + 5 && Math.abs(a) < 22) { band[k] = 1; rock[k] = Math.max(rock[k], 1 - smoothstep(12, 22, Math.abs(a)) * 0.6); }
        else if (dU < 5.5) band[k] = Math.max(band[k], 1);
      }
      hB[k] = hNew;
      if (band[k] > 0.5 || mask[k]) mask[k] = mask[k] || (band[k] > 0.5 ? 1 : 0);
    }
  }
  return { lipH, poolLevel, band, rock, Ls, cascades: [], upper: [] };
}

// 渓流の水面・川床・流れの向き（池の工程のあと：岸の盛り土も切る）
function gorgeWater({ h, water, type, hard, paddy, flow, gorge, G, pondLevel }) {
  const { lipH, poolLevel } = G;
  const zA = GZ_E - 482, zB = GZ_E - 300;
  const halfW = streamHalfW;
  const imp = [GORGE.sPool + 3.8, 0];   // 滝の水が落ちるところ
  const P = streamProfile(G, pondLevel);
  G.profile = P;
  const wet = [];   // 岸の濡れ（texel, 濡れ）の組
  for (let j = 0; j < N; j++) {
    const z = ORIGIN + j * CELL;
    if (z < zA || z > zB) continue;
    for (let i = 0; i < N; i++) {
      const x = ORIGIN + i * CELL;
      const { s, a } = gorgeLocal(x, z);
      if (s < GORGE.sIn - 10 || s > 480 || Math.abs(a) > 30) continue;
      const k = idx(i, j);
      const setFlow = (dx, dz, sp, foam) => { const l = Math.hypot(dx, dz) || 1; flow[k * 4] = dx / l; flow[k * 4 + 1] = dz / l; flow[k * 4 + 2] = sp; flow[k * 4 + 3] = Math.max(flow[k * 4 + 3], foam); };
      // 下流の向き（ワールド）：中心線の接線の逆
      const e = 0.5;
      const [x1, z1] = gorgeWorld(s + e, streamA(s + e)), [x0, z0] = gorgeWorld(s - e, streamA(s - e));
      const ddx = x0 - x1, ddz = z0 - z1;
      const ac = a - streamA(s), dA = Math.abs(ac), hw = halfW(s);
      // 滝つぼの出口：谷を横切る低い岩の縁（切れ目だけが渓流へ開く）
      if (s > GORGE.sTop - 2.6 && s < GORGE.sTop + 1.3 && Math.abs(a) < 11 && dA > hw + 0.25) {
        h[k] = Math.max(h[k], poolLevel + 0.06 + 0.3 * smoothstep(hw + 0.25, hw + 1.2, dA));
      }
      if (s < GORGE.sTop) {
        if (s < GORGE.sIn) {
          // 池への入り口：池の水位
          if (dA < hw + 2.4) {
            const bed = pondLevel - 0.5 + 0.95 * smoothstep(hw * 0.45, hw + 1.05, dA);
            if (bed < h[k]) h[k] = bed;
            water[k] = pondLevel;
            setFlow(ddx, ddz, 0.3, 0);
          }
        } else if (dA < hw + 2.8) {
          // 渓流：水面は流れに沿った一枚の面で描く（water は動物・判定用の値）
          const acc = clamp(ac, -hw - 0.6, hw + 0.6);
          const lv = P.level(s, acc);
          const hi = P.levelMax(s);
          const bedC = lv - P.depth(s, acc);
          const bed = bedC + (hi + 0.4 - bedC) * smoothstep(hw * 0.5, hw + 0.95, dA);
          if (dA < hw + 0.9) { if (s > GORGE.sTop - 3.2) h[k] = bed; else if (bed < h[k]) h[k] = bed; }
          // 岸は水面より高く（流れの外に水が見えないように）
          if (dA > hw + 0.25) h[k] = Math.max(h[k], hi + 0.03 + 0.34 * smoothstep(hw + 0.25, hw + 1.2, dA));
          if (dA < hw + 0.35) { type[k] = T.STREAM; hard[k] = 1; paddy[k] = 0; water[k] = P.level(s, ac); }
          else if (dA < hw + 1.8) wet.push(k, 1 - smoothstep(hw + 0.35, hw + 1.8, dA));
          setFlow(ddx, ddz, Math.min(1, P.speed(s, acc) / 3), 0);
        }
      } else if (s < GORGE.sCliff + 0.5) {
        // 滝つぼ
        const dp = Math.hypot(s - GORGE.sPool, a);
        if (dp < GORGE.poolR + 1.3 && h[k] < poolLevel + 2) {   // 崖の岩の下のセルは乾いたまま
          water[k] = poolLevel;
          if (dp < GORGE.poolR) { type[k] = T.POOL; hard[k] = 1; }
          const [ix, iz] = gorgeWorld(imp[0], imp[1]);
          const di = Math.hypot(x - ix, z - iz);
          setFlow(x - ix, z - iz, 0.7, 1 - smoothstep(0.5, 6.5, di));
        }
      }
      // 滝口の淵（崖の上）
      const aU = upperA(s);
      const dU = Math.abs(a - aU);
      if (s > GORGE.sCliff - 0.4 && s < GORGE.sCliff + 7.5 && dU < 2.4 && h[k] > lipH - 3) {   // 崖の下の低いセルは除く（滝口の水位の面が崖の前へ垂れ下がる）
        water[k] = lipH - 0.12; type[k] = T.POOL; hard[k] = 1;
        setFlow(ddx, ddz, 1.0, 0.5 * (1 - smoothstep(GORGE.sCliff - 0.4, GORGE.sCliff + 3, s)));
      }
    }
  }
  G.wet = wet;
  // 段の落ち口：水の集まる切れ目の位置（岩・魚の置き場所）
  G.cascades = P.steps.map((st) => {
    const ac = st.gap, sh = P.shiftOf(st, ac);
    const sm = (st.base + st.crest) / 2 + sh;
    const [x, z] = gorgeWorld(sm, streamA(sm) + ac);
    const [xu, zu] = gorgeWorld(sm + 1, streamA(sm + 1) + ac);
    const sp = st.base + sh - 1.1;
    const [xb, zb] = gorgeWorld(sp, streamA(sp) + ac * 0.6);
    return { x, z, top: st.up, bottom: st.dn, w: 1.2, dir: [x - xu, z - zu], plunge: [xb, zb] };
  });
  // 滝：滝口と、水が落ちる点
  const [lx, lz] = gorgeWorld(GORGE.sCliff - 0.3, upperA(GORGE.sCliff));
  const [px, pz] = gorgeWorld(GORGE.sPool, 0);
  const [ix, iz] = gorgeWorld(imp[0], imp[1]);
  G.lip = [lx, lipH - 0.12, lz];
  G.pool = [px, poolLevel, pz, GORGE.poolR];
  G.impact = [ix, poolLevel, iz];
  // 崖の上の急な流れ（白い帯で描く）：川床に沿った折れ線
  const up = [];
  for (let s = GORGE.sCliff + 7; s < 476; s += 2) {
    const [x, z] = gorgeWorld(s, upperA(s));
    up.push([x, bilinear(h, x, z) + 0.12, z]);
  }
  G.upper = up;
}

// ---- 山の上の見晴らし：平らな原っぱ ----
function carveRidge(hB) {
  const R = RIDGE.r;
  let sum = 0, cnt = 0;
  for (let dz = -R; dz <= R; dz += CELL) for (let dx = -R; dx <= R; dx += CELL) {
    if (dx * dx + dz * dz > R * R) continue;
    sum += bilinear(hB, RIDGE.x + dx, RIDGE.z + dz); cnt++;
  }
  const top = sum / cnt + 0.8;
  RIDGE.y = top;
  const i0 = Math.floor((RIDGE.x - R * 2.2 - ORIGIN) / CELL), i1 = Math.ceil((RIDGE.x + R * 2.2 - ORIGIN) / CELL);
  const j0 = Math.floor((RIDGE.z - R * 2.2 - ORIGIN) / CELL), j1 = Math.ceil((RIDGE.z + R * 2.2 - ORIGIN) / CELL);
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const x = ORIGIN + i * CELL, z = ORIGIN + j * CELL;
    const d = Math.hypot(x - RIDGE.x, z - RIDGE.z);
    const k = idx(i, j);
    // 南（谷の側）へゆるく下がる肩
    const shoulder = top - 0.035 * Math.max(0, z - RIDGE.z) + 0.3 * simplex2(x / 6, z / 6);
    hB[k] = lerp(shoulder, hB[k], smoothstep(R * 0.75, R * 1.9, d));
  }
}
export function ridgeOpen(x, z) {
  const d = Math.hypot(x - RIDGE.x, z - RIDGE.z);
  if (d < RIDGE.r + 7) return true;
  const dz = z - RIDGE.z;
  if (dz < 0 || dz > 115) return false;
  const cx = RIDGE.x + 0.28 * dz;
  return Math.abs(x - cx) < 15 + 0.32 * dz + 5 * simplex2(x / 20, z / 20);
}

// ---- 岩：滝の谷（崖の下・滝つぼの縁・渓流の岸と中）・山の上・川の上手・丘の原っぱ ----
function placeRocks({ h, water, type, G, forest }) {
  const out = [];
  const r = mulberry32(4242);
  const add = (x, z, s, opt = {}) => {
    const k = texelOf(x, z);
    const wl = water[k];
    const gy = opt.y ?? bilinear(h, x, z);
    const wet = wl > -1000 ? smoothstep(-0.2, 0.6, wl - gy + 0.5) : 0;
    out.push({ x, y: gy - s * (opt.sink ?? 0.28), z, s, rot: opt.rot ?? r() * Math.PI * 2, tilt: opt.tilt ?? (r() - 0.5) * 0.5, v: opt.v ?? Math.floor(r() * 6), moss: opt.moss ?? 0.4, wet: Math.max(wet, opt.wet ?? 0), flat: opt.flat ?? (0.55 + 0.35 * r()) });
  };
  const halfW = (s) => 1.25 + 0.45 * Math.sin(s / 6.3 + 1.0);
  // 崖の下の大岩
  for (let q = 0; q < 9; q++) {
    const a = (q < 4 ? -1 : 1) * (5.5 + r() * 10);
    const s = GORGE.sCliff - 1.2 - r() * 2.5 - 3.5 * (a / 16) ** 2;
    const [x, z] = gorgeWorld(s, a);
    add(x, z, 1.6 + r() * 2.0, { moss: 0.55, sink: 0.35 });
  }
  // 滝つぼの縁
  for (let q = 0; q < 16; q++) {
    const an = (q / 16) * Math.PI * 2 + r() * 0.3;
    const ds = Math.cos(an), da = Math.sin(an);
    if (ds < -0.8) continue; // 出口（下流側）は空ける
    const R = GORGE.poolR + 0.3 + r() * 1.8;
    const [x, z] = gorgeWorld(GORGE.sPool + ds * R, da * R);
    add(x, z, 0.7 + r() * 1.5, { moss: 0.5, wet: 0.6 });
  }
  // 渓流：岸・流れの中・段の落ち口
  for (let s = GORGE.sIn - 3; s < GORGE.sTop - 1; s += 1.4 + r() * 1.6) {
    const a0 = streamA(s), hw = halfW(s);
    for (const side of [-1, 1]) {
      if (r() < 0.5) continue;
      const [x, z] = gorgeWorld(s, a0 + side * (hw + 0.3 + r() * 1.1));
      add(x, z, 0.35 + r() * 0.8, { moss: 0.65, wet: 0.4 });
    }
    if (r() < 0.22) { const [x, z] = gorgeWorld(s, a0 + (r() - 0.5) * hw * 1.2); add(x, z, 0.25 + r() * 0.35, { moss: 0.25, wet: 1, sink: 0.45 }); }
  }
  // 段の落ち口：水の集まる切れ目の両側に岩（岩のあいだから水が落ちる）＋落ちた先の淵に沈んだ石
  const P = G.profile;
  for (const st of P.steps) {
    const drop = st.up - st.dn;
    const sm = (st.base + st.crest) / 2;
    const hwc = halfW(sm);
    for (const side of [-1, 1]) {
      let off = 0.36 + 0.22 * r();
      for (let q = 0; q < 2; q++) {
        const sz = q === 0 ? 0.62 + 0.3 * r() + drop * 0.15 : 0.4 + 0.3 * r();
        const fl = 0.72 + 0.2 * r();
        off += sz * 0.8;
        const ac = st.gap + side * off;
        off += sz * 0.7;
        if (Math.abs(ac) > hwc + 0.8) break;
        const sp = st.crest + P.shiftOf(st, ac) - 0.35 - 0.3 * r();
        const [x, z] = gorgeWorld(sp, streamA(sp) + ac);
        const top = st.up + 0.22 + 0.34 * r() * (q === 0 ? 1 : 0.6);
        add(x, z, sz, { y: top - 1.18 * sz * fl, flat: fl, moss: 0.2 + 0.35 * r(), wet: 0.9, sink: 0, tilt: (r() - 0.5) * 0.3 });
      }
    }
    if (r() < 0.75) {
      const sp = st.base + P.shiftOf(st, st.gap) - 1.4 - r() * 1.6;
      const [x, z] = gorgeWorld(sp, streamA(sp) + (r() - 0.5) * 1.8);
      add(x, z, 0.24 + 0.2 * r(), { y: st.dn - 0.42, moss: 0.1, wet: 1, sink: 0 });
    }
  }
  // 谷の床の苔むした岩・岩壁の足元
  for (let q = 0; q < 70; q++) {
    const s = GORGE.sIn + 4 + r() * (GORGE.sTop - GORGE.sIn - 4);
    const W = floorHalfW(s);
    const side = r() < 0.5 ? -1 : 1;
    const a = r() < 0.55 ? side * (W - 0.5 + r() * 2.5) : side * (2.5 + r() * (W - 3));
    if (Math.abs(a - streamA(s)) < halfW(s) + 0.8) continue;
    const [x, z] = gorgeWorld(s, a);
    add(x, z, 0.6 + r() * 1.6, { moss: 0.75 });
  }
  // 滝口の両脇
  for (const side of [-1, 1]) for (let q = 0; q < 3; q++) {
    const [x, z] = gorgeWorld(GORGE.sCliff + 1 + r() * 5, upperA(GORGE.sCliff) + side * (2.6 + r() * 2.5));
    add(x, z, 0.8 + r() * 1.2, { moss: 0.5 });
  }
  // 山の上：原っぱの縁と、谷を見下ろす突き出た岩
  for (let q = 0; q < 9; q++) {
    const an = r() * Math.PI * 2;
    if (Math.sin(an) > 0.55) continue; // 谷の側は空ける
    const R = RIDGE.r * (0.85 + r() * 0.35);
    add(RIDGE.x + Math.cos(an) * R, RIDGE.z + Math.sin(an) * R, 1.0 + r() * 1.8, { moss: 0.35 });
  }
  add(RIDGE.x + 7, RIDGE.z + RIDGE.r * 0.95, 2.6, { moss: 0.3, flat: 0.45 });
  add(RIDGE.x - 9, RIDGE.z + RIDGE.r * 0.8, 1.7, { moss: 0.3 });
  // 川の上手（谷が狭まるあたり）の岸の岩
  for (let x = -760; x < -380; x += 9 + r() * 14) {
    const zr = riverZ(x);
    const nz = 1 / Math.sqrt(1 + riverDZ(x) ** 2);
    const side = r() < 0.5 ? -1 : 1;
    const d = 3.2 + r() * 2.2;
    add(x - riverDZ(x) * nz * side * d * 0, zr + side * d * nz, 0.5 + r() * 1.0, { moss: 0.3, wet: 0.5 });
  }
  // 丘の原っぱの岩（ところどころ）
  for (let q = 0; q < 2400 && out.length < 360; q++) {
    const x = (r() - 0.5) * 1480, z = (r() - 0.5) * 1480;
    const k = texelOf(x, z);
    if (type[k] !== T.MEADOW || floorT(x, z) < 25) continue;
    if (r() < 0.8) continue;
    add(x, z, 0.7 + r() * 1.6, { moss: 0.35 });
  }
  void forest;
  return out;
}
