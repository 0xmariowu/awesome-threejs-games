// 世界データ → GPUテクスチャ
import * as THREE from 'three';
import { T } from '../world/gen.js';

function tex(data, w, h, format, type, filter, wrap = THREE.ClampToEdgeWrapping) {
  const t = new THREE.DataTexture(data, w, h, format, type);
  t.magFilter = filter; t.minFilter = filter;
  t.wrapS = t.wrapT = wrap;
  t.generateMipmaps = false;
  t.needsUpdate = true;
  return t;
}

export function buildWorldTextures(W) {
  const { N, CELL, height: H, water, type, prand, sdf, roadD, rdist, pathD, forest } = W;
  const n = N * N;
  // 高さ・水面
  const hw = new Float32Array(n * 2);
  // 渓流の水位は判定用（水面は流れに沿った面で別に描く：water.js）→ 格子の水面からは外す
  for (let k = 0; k < n; k++) { hw[k * 2] = H[k]; hw[k * 2 + 1] = type[k] === T.STREAM ? -1e4 : water[k]; }
  // 法線＋くぼみの暗さ
  const nrm = new Uint8Array(n * 4);
  const blurH = boxBlur(H, N, 4);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const k = j * N + i;
    const hl = H[j * N + Math.max(i - 1, 0)], hr = H[j * N + Math.min(i + 1, N - 1)];
    const hd = H[Math.max(j - 1, 0) * N + i], hu = H[Math.min(j + 1, N - 1) * N + i];
    let nx = -(hr - hl) / (2 * CELL), ny = 1, nz = -(hu - hd) / (2 * CELL);
    const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
    nrm[k * 4] = Math.round((nx * 0.5 + 0.5) * 255);
    nrm[k * 4 + 1] = Math.round((ny * 0.5 + 0.5) * 255);
    nrm[k * 4 + 2] = Math.round((nz * 0.5 + 0.5) * 255);
    const cav = Math.max(0, blurH[k] - H[k]);
    let ao = 1 - Math.min(0.45, cav * 0.35);
    ao *= 1 - 0.5 * forest[k];
    nrm[k * 4 + 3] = Math.round(Math.max(0, Math.min(1, ao)) * 255);
  }
  // 地表の材料の重み
  const A = new Float32Array(n * 4), B = new Float32Array(n * 4);
  for (let k = 0; k < n; k++) {
    const t = type[k];
    let g = 0, s = 0, m = 0, r = 0, as = 0, d = 0, f = 0, na = 0;
    switch (t) {
      case T.FLOODED: case T.SEEDLING: case T.POND: m = 1; break;
      case T.RIVER: m = 0.3; break; // 川床は小石（下の C）に泥が少し
      case T.RENGE: r = 1; break;
      case T.TILLED: case T.FIELD: case T.GARDEN: s = 1; break;
      case T.FALLOW: g = 0.78; s = 0.22; break;
      case T.MEADOW: case T.BANK: case T.LEVEE_BIG: case T.KNOLL: case T.NONE: g = 1; break;
      case T.ASPHALT: as = 1; break;
      case T.DIRT: case T.GRAVEL: case T.YARD: d = 1; break;
      case T.FOREST: case T.BAMBOO: f = 1; break;
      case T.NANOHANA: na = 1; g = 0.3; break;
      case T.ROCK: case T.STREAM: case T.POOL: case T.MOSS: break;
      default: g = 1;
    }
    A[k * 4] = g; A[k * 4 + 1] = s; A[k * 4 + 2] = m; A[k * 4 + 3] = r;
    B[k * 4] = as; B[k * 4 + 1] = d; B[k * 4 + 2] = f; B[k * 4 + 3] = na;
  }
  // 岩・苔・川床の小石・濡れ（滝の谷）
  const C = new Float32Array(n * 4);
  for (let k = 0; k < n; k++) {
    const t = type[k];
    if (t === T.ROCK) C[k * 4] = 1;
    else if (t === T.MOSS) C[k * 4 + 1] = 1;
    else if (t === T.STREAM || t === T.POOL) C[k * 4 + 2] = 1;
    else if (t === T.RIVER) C[k * 4 + 2] = 0.7;
    // 濡れ：水面のすぐ上
    const wl = water[k];
    if (wl > -1000 && (t === T.ROCK || t === T.MOSS || t === T.STREAM || t === T.POOL)) C[k * 4 + 3] = Math.max(0, Math.min(1, 1 - (H[k] - wl - 0.1) / 0.9));
  }
  {
    // 水ぎわの濡れ：近く（±3目）の水面の高さより少し上までの土は湿って黒い
    const WL = new Float32Array(n).fill(-1e4), tmp = new Float32Array(n).fill(-1e4);
    for (let k = 0; k < n; k++) if (water[k] > -1000 && type[k] !== T.STREAM) WL[k] = water[k];
    const R = 2;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      let m = -1e4;
      for (let d = -R; d <= R; d++) { const ii = i + d; if (ii >= 0 && ii < N) { const v = WL[j * N + ii]; if (v > m) m = v; } }
      tmp[j * N + i] = m;
    }
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      let near = -1e4;
      for (let d = -R; d <= R; d++) { const jj = j + d; if (jj >= 0 && jj < N) { const v = tmp[jj * N + i]; if (v > near) near = v; } }
      if (near < -1000) continue;
      // 近くの水面ごとに、高さの差と水平の距離で湿り気を決める
      const k = j * N + i;
      let best = 0;
      for (let dj = -R; dj <= R; dj++) for (let di = -R; di <= R; di++) {
        const ii = i + di, jj = j + dj;
        if (ii < 0 || jj < 0 || ii >= N || jj >= N) continue;
        const wl = WL[jj * N + ii];
        if (wl < -1000) continue;
        const dh = H[k] - wl;
        if (dh < -0.8) continue;
        const a = 1 - Math.min(1, Math.max(0, (dh - 0.02) / 0.28));
        const b = 1 - Math.min(1, Math.hypot(di, dj) / (R + 0.5));
        const w = a * a * (3 - 2 * a) * (0.35 + 0.65 * b);
        if (w > best) best = w;
      }
      C[k * 4 + 3] = Math.max(C[k * 4 + 3], best);
    }
  }
  if (W.gorge && W.gorge.wet) {
    // 渓流の岸の濡れ
    const wt = W.gorge.wet;
    for (let q = 0; q < wt.length; q += 2) C[wt[q] * 4 + 3] = Math.max(C[wt[q] * 4 + 3], wt[q + 1]);
  }
  if (W.gorge) {
    // 滝のしぶきで濡れる岩（崖と滝つぼのまわり）
    const [ix, , iz] = W.gorge.impact;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const x = W.ORIGIN + i * CELL, z = W.ORIGIN + j * CELL;
      const d = Math.hypot(x - ix, z - iz);
      if (d > 22) continue;
      const k = j * N + i;
      C[k * 4 + 3] = Math.max(C[k * 4 + 3], 1 - d / 22);
    }
  }
  const Ab = blur4(A, N), Bb = blur4(B, N), Cb = blur4(C, N);
  const matA = new Uint8Array(n * 4), matB = new Uint8Array(n * 4), matC = new Uint8Array(n * 4);
  for (let q = 0; q < n * 4; q++) { matA[q] = Math.round(Math.min(1, Ab[q]) * 255); matB[q] = Math.round(Math.min(1, Bb[q]) * 255); matC[q] = Math.round(Math.min(1, Cb[q]) * 255); }
  // 流れ：向き xy（0.5中心）・速さ・白い泡
  const fl = new Uint8Array(n * 4);
  if (W.flow) for (let k = 0; k < n; k++) {
    fl[k * 4] = Math.round((W.flow[k * 4] * 0.5 + 0.5) * 255);
    fl[k * 4 + 1] = Math.round((W.flow[k * 4 + 1] * 0.5 + 0.5) * 255);
    fl[k * 4 + 2] = Math.round(Math.min(1, W.flow[k * 4 + 2]) * 255);
    fl[k * 4 + 3] = Math.round(Math.min(1, W.flow[k * 4 + 3]) * 255);
  }
  // 種類コード（最近傍で読む）
  const ty = new Uint8Array(n * 4);
  for (let k = 0; k < n; k++) { ty[k * 4] = type[k]; ty[k * 4 + 1] = prand[k]; ty[k * 4 + 2] = Math.round(forest[k] * 255); ty[k * 4 + 3] = 0; }
  // 桜の下の散った花びら（樹冠の少し外まで）
  for (const t of W.trees) {
    if (t.sp !== 5) continue;
    const R = t.hero ? 17 : 6.5 * t.s;
    const i0 = Math.max(0, Math.floor((t.x - R - W.ORIGIN) / CELL)), i1 = Math.min(N - 1, Math.ceil((t.x + R - W.ORIGIN) / CELL));
    const j0 = Math.max(0, Math.floor((t.z - R - W.ORIGIN) / CELL)), j1 = Math.min(N - 1, Math.ceil((t.z + R - W.ORIGIN) / CELL));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const x = W.ORIGIN + i * CELL, z = W.ORIGIN + j * CELL;
      const d = Math.hypot(x - t.x, z - t.z) / R;
      if (d >= 1) continue;
      const v = Math.round((1 - d * d) * 255);
      const k = j * N + i;
      ty[k * 4 + 3] = Math.max(ty[k * 4 + 3], v);
    }
  }
  // 距離場（半精度）：田の畦・道・川・農道
  const sd = new Uint16Array(n * 4);
  const hf = THREE.DataUtils.toHalfFloat;
  for (let k = 0; k < n; k++) {
    sd[k * 4] = hf(sdf[k]); sd[k * 4 + 1] = hf(roadD[k]); sd[k * 4 + 2] = hf(rdist[k]); sd[k * 4 + 3] = hf(Math.min(pathD[k], 60));
  }
  return {
    tHW: tex(hw, N, N, THREE.RGFormat, THREE.FloatType, THREE.NearestFilter),
    tNorm: tex(nrm, N, N, THREE.RGBAFormat, THREE.UnsignedByteType, THREE.LinearFilter),
    tMatA: tex(matA, N, N, THREE.RGBAFormat, THREE.UnsignedByteType, THREE.LinearFilter),
    tMatB: tex(matB, N, N, THREE.RGBAFormat, THREE.UnsignedByteType, THREE.LinearFilter),
    tMatC: tex(matC, N, N, THREE.RGBAFormat, THREE.UnsignedByteType, THREE.LinearFilter),
    tFlow: tex(fl, N, N, THREE.RGBAFormat, THREE.UnsignedByteType, THREE.LinearFilter),
    tType: tex(ty, N, N, THREE.RGBAFormat, THREE.UnsignedByteType, THREE.NearestFilter),
    tSdf: tex(sd, N, N, THREE.RGBAFormat, THREE.HalfFloatType, THREE.LinearFilter),
  };
}

function boxBlur(src, N, r) {
  const tmp = new Float32Array(N * N), out = new Float32Array(N * N);
  const cl = (v) => (v < 0 ? 0 : v > N - 1 ? N - 1 : v);
  for (let j = 0; j < N; j++) {
    let s = 0;
    for (let i = -r; i <= r; i++) s += src[j * N + cl(i)];
    for (let i = 0; i < N; i++) { tmp[j * N + i] = s / (2 * r + 1); s += src[j * N + cl(i + r + 1)] - src[j * N + cl(i - r)]; }
  }
  for (let i = 0; i < N; i++) {
    let s = 0;
    for (let j = -r; j <= r; j++) s += tmp[cl(j) * N + i];
    for (let j = 0; j < N; j++) { out[j * N + i] = s / (2 * r + 1); s += tmp[cl(j + r + 1) * N + i] - tmp[cl(j - r) * N + i]; }
  }
  return out;
}
function blur4(src, N) {
  const out = new Float32Array(src.length);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    for (let c = 0; c < 4; c++) {
      let s = 0, w = 0;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        const ii = Math.min(N - 1, Math.max(0, i + di)), jj = Math.min(N - 1, Math.max(0, j + dj));
        const ww = di === 0 && dj === 0 ? 2 : 1;
        s += src[(jj * N + ii) * 4 + c] * ww; w += ww;
      }
      out[(j * N + i) * 4 + c] = s / w;
    }
  }
  return out;
}

// 繰り返し可能な雑音テクスチャ（256²：r=細かい g=中 b=セル状 a=白色雑音）
export function buildNoiseTexture() {
  const S = 256;
  const d = new Uint8Array(S * S * 4);
  const hash = (x, y, s) => { let h = (x * 374761393 + y * 668265263 + s * 2246822519) >>> 0; h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  const pv = (x, y, P, s) => {
    const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
    const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
    const m = (a) => ((a % P) + P) % P;
    const a = hash(m(xi), m(yi), s), b = hash(m(xi + 1), m(yi), s), c = hash(m(xi), m(yi + 1), s), e = hash(m(xi + 1), m(yi + 1), s);
    return a + (b - a) * u + (c - a) * v + (a - b - c + e) * u * v;
  };
  const fbm = (x, y, P, s, o) => { let a = 0.5, f = 1, t = 0, nn = 0; for (let i = 0; i < o; i++) { t += a * pv(x * f, y * f, P * f, s + i); nn += a; a *= 0.5; f *= 2; } return t / nn; };
  const worley = (x, y, P, s) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    let best = 9;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const cx = xi + dx, cy = yi + dy;
      const m = (a) => ((a % P) + P) % P;
      const px = cx + hash(m(cx), m(cy), s), py = cy + hash(m(cx), m(cy), s + 7);
      best = Math.min(best, Math.hypot(px - x, py - y));
    }
    return best;
  };
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const o = (y * S + x) * 4;
    d[o] = Math.round(fbm(x / 16, y / 16, 16, 1, 4) * 255);
    d[o + 1] = Math.round(fbm(x / 64, y / 64, 4, 11, 4) * 255);
    d[o + 2] = Math.round(Math.min(1, worley(x / 16, y / 16, 16, 21) / 1.1) * 255);
    d[o + 3] = Math.round(hash(x, y, 99) * 255);
  }
  const t = tex(d, S, S, THREE.RGBAFormat, THREE.UnsignedByteType, THREE.LinearFilter, THREE.RepeatWrapping);
  t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true;
  t.needsUpdate = true;
  return t;
}

// ---- 地面の細部テクスチャ（512²・繰り返し・ミップマップ・異方性） ----
// r=高さ g,b=高さの傾き（タイル単位で ±GMAX を 0〜1 に）a=色むら
// A：石（砂利・玉石・骨材）  B：土の塊と細かな凹凸、a=落ち葉・枯れ草のかけら
export const DET_GMAX_A = 48, DET_GMAX_B = 24;
export function buildDetailTextures() {
  const S = 512;
  const hash = (x, y, s) => { let h = (x * 374761393 + y * 668265263 + s * 2246822519) >>> 0; h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  const wrap = (v) => ((v % S) + S) % S;
  // 周期つき値雑音（P = 1タイルあたりの格子数）
  const pv = (x, y, P, s) => {
    const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
    const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
    const m = (a) => ((a % P) + P) % P;
    const a = hash(m(xi), m(yi), s), b = hash(m(xi + 1), m(yi), s), c = hash(m(xi), m(yi + 1), s), e = hash(m(xi + 1), m(yi + 1), s);
    return a + (b - a) * u + (c - a) * v + (a - b - c + e) * u * v;
  };
  const fbm = (x, y, P, s, o) => { let a = 0.5, f = 1, t = 0, nn = 0; for (let i = 0; i < o; i++) { t += a * pv(x * f, y * f, P * f, s + i); nn += a; a *= 0.5; f *= 2; } return t / nn; };
  // 楕円の粒を高さの最大で重ねる（石・土の塊）
  const splat = (H, Tn, count, rMin, rMax, seed, prof, flat) => {
    let st = seed >>> 0;
    const rnd = () => { st = (st + 0x6d2b79f5) >>> 0; let t = st; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    for (let q = 0; q < count; q++) {
      const cx = rnd() * S, cy = rnd() * S;
      const r = rMin + (rMax - rMin) * Math.pow(rnd(), 1.6);
      const asp = 0.55 + 0.45 * rnd(), th = rnd() * Math.PI, ca = Math.cos(th), sa = Math.sin(th);
      const hs = (0.45 + 0.55 * rnd()) * Math.min(1, r / rMax + 0.35), tone = 0.18 + 0.82 * rnd();
      const R = Math.ceil(r) + 1;
      for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
        const px = Math.floor(cx) + dx, py = Math.floor(cy) + dy;
        const ox = px + 0.5 - cx, oy = py + 0.5 - cy;
        const a = (ox * ca + oy * sa) / r, b = (-ox * sa + oy * ca) / (r * asp);
        const q2 = a * a + b * b;
        if (q2 >= 1) continue;
        const h = hs * Math.min(flat, prof(1 - q2));
        const k = wrap(py) * S + wrap(px);
        if (h > H[k]) { H[k] = h; if (Tn) Tn[k] = tone; }
      }
    }
  };
  const pack = (H, Tn, gmax) => {
    const d = new Uint8Array(S * S * 4);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const k = y * S + x;
      const gx = (H[y * S + wrap(x + 1)] - H[y * S + wrap(x - 1)]) * 0.5 * S / gmax;
      const gy = (H[wrap(y + 1) * S + x] - H[wrap(y - 1) * S + x]) * 0.5 * S / gmax;
      d[k * 4] = Math.round(Math.min(1, Math.max(0, H[k])) * 255);
      d[k * 4 + 1] = Math.round(Math.min(1, Math.max(0, gx * 0.5 + 0.5)) * 255);
      d[k * 4 + 2] = Math.round(Math.min(1, Math.max(0, gy * 0.5 + 0.5)) * 255);
      d[k * 4 + 3] = Math.round(Math.min(1, Math.max(0, Tn[k])) * 255);
    }
    const t = tex(d, S, S, THREE.RGBAFormat, THREE.UnsignedByteType, THREE.LinearFilter, THREE.RepeatWrapping);
    t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.anisotropy = 8;
    t.needsUpdate = true;
    return t;
  };
  // A：石。大小の丸い石をすき間なく詰め、すき間は細かな砂
  const HA = new Float32Array(S * S), TA = new Float32Array(S * S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) HA[y * S + x] = 0.04 * fbm(x / 8, y / 8, 64, 5, 3);
  splat(HA, TA, 260, 14, 26, 11, (t) => Math.pow(t, 0.55), 0.95);
  splat(HA, TA, 1400, 5, 13, 12, (t) => Math.pow(t, 0.6), 0.9);
  splat(HA, TA, 5200, 2.2, 5.5, 13, (t) => Math.pow(t, 0.7), 0.8);
  // B：土。大小の塊＋細かな凹凸
  const HB = new Float32Array(S * S), TB = new Float32Array(S * S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) HB[y * S + x] = 0.42 * fbm(x / 64, y / 64, 8, 31, 6);
  const HC = new Float32Array(S * S);
  splat(HC, null, 420, 9, 24, 21, (t) => 0.5 - 0.5 * Math.cos(Math.PI * Math.pow(t, 0.8)), 1);
  splat(HC, null, 2400, 3, 8, 22, (t) => 0.5 - 0.5 * Math.cos(Math.PI * t), 1);
  for (let k = 0; k < S * S; k++) HB[k] = HB[k] + 0.58 * HC[k];
  // 落ち葉・枯れ草のかけら：先の尖った葉形を上から重ね塗り（0=すき間）
  {
    let st = 77;
    const rnd = () => { st = (st + 0x6d2b79f5) >>> 0; let t = st; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    for (let q = 0; q < 2300; q++) {
      const cx = rnd() * S, cy = rnd() * S, L = 7 + 9 * rnd(), W = L * (0.3 + 0.2 * rnd());
      const th = rnd() * Math.PI * 2, ca = Math.cos(th), sa = Math.sin(th), tone = 0.1 + 0.9 * rnd();
      const R = Math.ceil(L) + 1;
      for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
        const px = Math.floor(cx) + dx, py = Math.floor(cy) + dy;
        const ox = px + 0.5 - cx, oy = py + 0.5 - cy;
        const a = (ox * ca + oy * sa) / L, b = (-ox * sa + oy * ca) / W;
        if (Math.abs(a) >= 1 || Math.abs(b) >= 1 - a * a) continue;
        const k = wrap(py) * S + wrap(px);
        // 葉脈のあたりは少し暗い
        TB[k] = tone * (Math.abs(b) < 0.12 ? 0.8 : 1) * (0.9 + 0.1 * (1 - Math.abs(a)));
      }
    }
  }
  return { tDetA: pack(HA, TA, DET_GMAX_A), tDetB: pack(HB, TB, DET_GMAX_B) };
}
