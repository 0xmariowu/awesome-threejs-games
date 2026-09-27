// 手続き的テクスチャ: 色・法線・粗さをキャンバスで作る（タイルできる）
import * as THREE from 'three';

const cache = new Map();

// ---------- タイルできるノイズ ----------
function hash(i, j, s) {
  let h = Math.imul(i | 0, 374761393) ^ Math.imul(j | 0, 668265263) ^ Math.imul(s | 0, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
// 周期 per（格子数）で繰り返す値ノイズ
export function pnoise(x, y, per, seed = 0) {
  const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const m = (a) => ((a % per) + per) % per;
  const a = hash(m(i), m(j), seed), b = hash(m(i + 1), m(j), seed), c = hash(m(i), m(j + 1), seed), d = hash(m(i + 1), m(j + 1), seed);
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}
export function pfbm(x, y, per, oct = 4, seed = 0) {
  let s = 0, a = 0.5, f = 1, n = 0;
  for (let o = 0; o < oct; o++) { s += a * pnoise(x * f, y * f, per * f, seed + o * 17); n += a; a *= 0.5; f *= 2; }
  return s / n;
}
export const rnd = (i, j, s = 0) => hash(i, j, s);
const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const sstep = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };

// ---------- 画素配列 → テクスチャ ----------
function canvasFrom(N, M, fill) {
  const c = document.createElement('canvas');
  c.width = N; c.height = M;
  const g = c.getContext('2d');
  const img = g.createImageData(N, M);
  fill(img.data);
  g.putImageData(img, 0, 0);
  return c;
}
function tex(canvas, srgb, repeat = true) {
  const t = new THREE.CanvasTexture(canvas);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}

// recipe(u, v, out) : u,v は 0..1、out = {r,g,b,h,ro,a}
function build(name, N, M, recipe, { normal = 2, alpha = false } = {}) {
  if (cache.has(name)) return cache.get(name);
  const H = new Float32Array(N * M), col = new Float32Array(N * M * 4), R = new Float32Array(N * M);
  const o = { r: 0, g: 0, b: 0, h: 0, ro: 0.8, a: 1 };
  for (let y = 0; y < M; y++) for (let x = 0; x < N; x++) {
    o.r = o.g = o.b = 0.5; o.h = 0; o.ro = 0.8; o.a = 1;
    recipe((x + 0.5) / N, (y + 0.5) / M, o, x, y);
    const k = y * N + x;
    col[k * 4] = o.r; col[k * 4 + 1] = o.g; col[k * 4 + 2] = o.b; col[k * 4 + 3] = o.a;
    H[k] = o.h; R[k] = o.ro;
  }
  const map = tex(canvasFrom(N, M, (d) => {
    for (let k = 0; k < N * M; k++) {
      d[k * 4] = clamp(col[k * 4]) * 255; d[k * 4 + 1] = clamp(col[k * 4 + 1]) * 255; d[k * 4 + 2] = clamp(col[k * 4 + 2]) * 255; d[k * 4 + 3] = alpha ? clamp(col[k * 4 + 3]) * 255 : 255;
    }
  }), true);
  const nrm = tex(canvasFrom(N, M, (d) => {
    for (let y = 0; y < M; y++) for (let x = 0; x < N; x++) {
      const hx = H[y * N + ((x + 1) % N)] - H[y * N + ((x - 1 + N) % N)];
      const hy = H[((y + 1) % M) * N + x] - H[((y - 1 + M) % M) * N + x];
      let nx = -hx * normal, ny = hy * normal, nz = 1;
      const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
      const k = (y * N + x) * 4;
      d[k] = (nx * 0.5 + 0.5) * 255; d[k + 1] = (ny * 0.5 + 0.5) * 255; d[k + 2] = (nz * 0.5 + 0.5) * 255; d[k + 3] = 255;
    }
  }), false);
  const rough = tex(canvasFrom(N, M, (d) => {
    for (let k = 0; k < N * M; k++) { const v = clamp(R[k]) * 255; d[k * 4] = v; d[k * 4 + 1] = v; d[k * 4 + 2] = v; d[k * 4 + 3] = 255; }
  }), false);
  const set = { map, normalMap: nrm, roughnessMap: rough };
  cache.set(name, set);
  return set;
}

// ---------- 素材 ----------
// 大きさ（m）: テクスチャ 1 枚が何 m 四方か（UV を m 単位で作り、repeat = 1 / size）
export const TEX_SIZE = {
  kawara: [1.2, 1.12], ibushi: [1.08, 0.94], metalRoof: [1.8, 1.8], slate: [1.2, 1.2], siding: [1.6, 1.6], mortar: [2, 2], woodBoard: [1.8, 1.8],
  block: [1.6, 1.6], concrete: [3, 3], asphalt: [4, 4], gravel: [2, 2], dirt: [3, 3], grassGround: [3, 3], sand: [3, 3],
  bark: [1, 2], tile: [1.2, 1.2], paving: [1.8, 1.8],
};

export const TEX = {
  // いぶし瓦（J 形の波瓦）: 横 4 枚 × 縦 4 段
  kawara: () => build('kawara', 512, 512, (u, v, o, x, y) => {
    const tu = u * 4, tv = v * 4;
    const ci = Math.floor(tu), ri = Math.floor(tv);
    const fu = tu - ci, fv = tv - ri;
    const wave = Math.cos((fu - 0.5) * Math.PI * 2) * 0.5 + 0.5;
    // 下端が次の段に重なる（段ごとの影）
    const lap = sstep(0.0, 0.85, fv);
    const edge = sstep(0.93, 1.0, fv);
    o.h = wave * 0.55 + lap * 0.45 - edge * 0.7;
    const tint = rnd(ci, ri, 3) * 0.08 - 0.04;
    const n = pfbm(u * 16, v * 16, 16, 3, 1);
    let g = 0.36 + tint + wave * 0.07 + (n - 0.5) * 0.06 - edge * 0.12 - (1 - lap) * 0.03;
    o.r = g * 0.96; o.g = g * 1.0; o.b = g * 1.1;
    o.ro = 0.55 - wave * 0.15 + n * 0.1;
  }, { normal: 5 }),
  // いぶし瓦（J 形の桟瓦）: 横 4 枚 × 縦 4 段（1 枚 0.27 × 0.235 m）。v は軒から棟へ。
  // 山（凸）と谷（凹）の縦の筋が主役で、段の重なりは下端の厚みと、その下の細い影だけにする
  ibushi: () => build('ibushi', 512, 512, (u, v, o) => {
    const tu = u * 4, tv = v * 4;
    const ci = Math.floor(tu), ri = Math.floor(tv);
    const fu = tu - ci, fv = tv - ri;
    // 断面: 幅の 6 割が丸い山、残りが谷
    const x = (fu + 0.2) % 1;
    const hill = x < 0.62 ? Math.sin((x / 0.62) * Math.PI) : -0.35 * Math.sin(((x - 0.62) / 0.38) * Math.PI);
    // 瓦は屋根より少し寝ていて、下端（fv = 0）が上がる。上の段の下端が落とす影
    const tilt = (1 - fv) * 0.35;
    const lip = 1 - sstep(0.0, 0.06, fv);
    const shade = sstep(0.8, 1.0, fv);
    o.h = hill * 0.5 + tilt + lip * 0.15;
    const n = pfbm(u * 24, v * 24, 24, 3, 31), n2 = pfbm(u * 6, v * 6, 6, 2, 32);
    const tint = (rnd(ci, ri, 33) - 0.5) * 0.035;
    let g = 0.44 + tint + hill * 0.05 + (n - 0.5) * 0.05 + (n2 - 0.5) * 0.04 - shade * 0.16 + lip * 0.03;
    o.r = g * 0.97; o.g = g * 0.99; o.b = g * 1.03;
    o.ro = 0.5 - Math.max(hill, 0) * 0.2 + n * 0.12 + shade * 0.2;
  }, { normal: 6 }),
  // 金属屋根（立平葺き）
  metalRoof: () => build('metalRoof', 512, 512, (u, v, o) => {
    const fu = (u * 4) % 1;
    const rib = sstep(0.0, 0.03, fu) * (1 - sstep(0.06, 0.09, fu));
    const n = pfbm(u * 8, v * 8, 8, 3, 7);
    o.h = rib * 1.0 + (n - 0.5) * 0.05;
    const g = 0.78 + (n - 0.5) * 0.08 + rib * 0.06 - sstep(0.9, 1, v) * 0.0;
    // 雨の筋
    const streak = pfbm(u * 32, v * 2, 32, 2, 9);
    o.r = o.g = o.b = g - streak * 0.08;
    o.ro = 0.45 + n * 0.2;
  }, { normal: 3 }),
  // 横張りのサイディング（白っぽい。色は頂点色で付ける）
  siding: () => build('siding', 512, 512, (u, v, o) => {
    const rows = 8, fv = (v * rows) % 1, ri = Math.floor(v * rows);
    const shadow = sstep(0.0, 0.12, fv);
    const n = pfbm(u * 20, v * 20, 20, 3, 2);
    const grain = pfbm(u * 64, v * 4, 64, 2, 5);
    o.h = shadow * 0.6 + fv * 0.25 + (n - 0.5) * 0.03;
    const g = 0.9 - (1 - shadow) * 0.25 + (n - 0.5) * 0.04 + (grain - 0.5) * 0.03 + rnd(ri, 0, 4) * 0.02;
    o.r = o.g = o.b = g;
    o.ro = 0.7;
  }, { normal: 4 }),
  // モルタル・吹き付け壁（雨だれ付き）
  mortar: () => build('mortar', 512, 512, (u, v, o) => {
    const n = pfbm(u * 48, v * 48, 48, 3, 11), n2 = pfbm(u * 8, v * 8, 8, 4, 12);
    const drip = Math.pow(pfbm(u * 24, v * 1.5, 24, 2, 13), 3) * sstep(0.2, 1.0, v);
    o.h = n * 0.5;
    const g = 0.92 + (n - 0.5) * 0.07 + (n2 - 0.5) * 0.05 - drip * 0.12;
    o.r = o.g = o.b = g;
    o.ro = 0.9;
  }, { normal: 2.5 }),
  // 下見板張り（古い家の焼き板・木板）
  woodBoard: () => build('woodBoard', 512, 512, (u, v, o) => {
    const rows = 10, fv = (v * rows) % 1, ri = Math.floor(v * rows);
    const shadow = sstep(0.0, 0.18, fv);
    const grain = pfbm(u * 3 + ri * 7.1, v * 60, 3, 3, 21);
    const knot = pfbm(u * 12, v * 12, 12, 2, 22);
    o.h = shadow * 0.7 + fv * 0.2 + grain * 0.1;
    const base = 0.3 + rnd(ri, 1, 23) * 0.08;
    const g = base * (0.75 + shadow * 0.25) + (grain - 0.5) * 0.08 - (knot > 0.72 ? 0.05 : 0);
    o.r = g * 1.12; o.g = g * 0.92; o.b = g * 0.74;
    o.ro = 0.85;
  }, { normal: 4 }),
  // コンクリートブロック（40×20cm）
  block: () => build('block', 512, 512, (u, v, o) => {
    const rows = 8, ri = Math.floor(v * rows), fv = (v * rows) % 1;
    const cols = 4, fu = (u * cols + (ri % 2) * 0.5) % 1, ci = Math.floor(u * cols + (ri % 2) * 0.5);
    const joint = Math.max(1 - sstep(0.0, 0.04, fu), sstep(0.96, 1.0, fu), 1 - sstep(0.0, 0.07, fv), sstep(0.93, 1.0, fv));
    const pore = pnoise(u * 256, v * 256, 256, 31);
    const n = pfbm(u * 12, v * 12, 12, 3, 32);
    o.h = (1 - joint) * 0.8 + (pore - 0.5) * 0.15;
    const g = 0.66 + rnd(ci, ri, 33) * 0.06 + (n - 0.5) * 0.08 - joint * 0.12 - (pore > 0.85 ? 0.08 : 0);
    o.r = g; o.g = g * 0.99; o.b = g * 0.95;
    o.ro = 0.95;
  }, { normal: 4 }),
  concrete: () => build('concrete', 512, 512, (u, v, o) => {
    const n = pfbm(u * 12, v * 12, 12, 4, 41), p = pnoise(u * 300, v * 300, 300, 42);
    const stain = pfbm(u * 3, v * 3, 3, 3, 43);
    o.h = n * 0.3 + p * 0.1;
    const g = 0.7 + (n - 0.5) * 0.08 - (stain > 0.6 ? (stain - 0.6) * 0.3 : 0) - (p > 0.9 ? 0.05 : 0);
    o.r = g; o.g = g * 0.99; o.b = g * 0.96;
    o.ro = 0.9;
  }, { normal: 2 }),
  asphalt: () => build('asphalt', 1024, 1024, (u, v, o) => {
    const p = pnoise(u * 700, v * 700, 700, 51), p2 = pnoise(u * 300, v * 300, 300, 52);
    const n = pfbm(u * 6, v * 6, 6, 4, 53);
    const stone = p > 0.78 ? (p - 0.78) * 2.2 : 0;
    o.h = p2 * 0.5 + stone;
    const g = 0.3 + (n - 0.5) * 0.06 + stone * 0.35 + (p2 - 0.5) * 0.05;
    o.r = g; o.g = g; o.b = g * 1.03;
    o.ro = 0.88 - stone * 0.2;
  }, { normal: 3 }),
  gravel: () => build('gravel', 512, 512, (u, v, o) => {
    // 小石: ボロノイ風
    const s = 40, x = u * s, y = v * s, ix = Math.floor(x), iy = Math.floor(y);
    let d1 = 9, id = 0;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      const cx = ix + i, cy = iy + j, m = (a) => ((a % s) + s) % s;
      const px = cx + rnd(m(cx), m(cy), 61), py = cy + rnd(m(cx), m(cy), 62);
      const d = Math.hypot(x - px, y - py);
      if (d < d1) { d1 = d; id = rnd(m(cx), m(cy), 63); }
    }
    o.h = clamp(1 - d1 * 1.6);
    const g = 0.55 + id * 0.25 - (1 - o.h) * 0.25;
    o.r = g; o.g = g * 0.97; o.b = g * 0.9;
    o.ro = 0.8;
  }, { normal: 5 }),
  dirt: () => build('dirt', 512, 512, (u, v, o) => {
    const n = pfbm(u * 10, v * 10, 10, 5, 71), p = pnoise(u * 200, v * 200, 200, 72);
    o.h = n * 0.6 + p * 0.2;
    const g = 0.5 + (n - 0.5) * 0.15 + (p - 0.5) * 0.06;
    o.r = g * 1.02; o.g = g * 0.86; o.b = g * 0.66;
    o.ro = 0.95;
  }, { normal: 3 }),
  sand: () => build('sand', 512, 512, (u, v, o) => {
    const n = pfbm(u * 8, v * 8, 8, 4, 81), p = pnoise(u * 400, v * 400, 400, 82);
    const ripple = Math.sin((v * 14 + n * 3) * Math.PI * 2) * 0.5 + 0.5;
    o.h = ripple * 0.3 + p * 0.2;
    const g = 0.86 + (n - 0.5) * 0.06 + (p - 0.5) * 0.08;
    o.r = g; o.g = g * 0.93; o.b = g * 0.76;
    o.ro = 0.95;
  }, { normal: 2 }),
  // 地面の草（上から見た芝・雑草のまだら）
  grassGround: () => build('grassGround', 1024, 1024, (u, v, o) => {
    const n = pfbm(u * 6, v * 6, 6, 4, 91), b = pnoise(u * 420, v * 420, 420, 92), b2 = pnoise(u * 180 + 3, v * 180, 180, 93);
    const clover = pfbm(u * 30, v * 30, 30, 2, 94);
    o.h = b * 0.6 + b2 * 0.4;
    let r = 0.36, g = 0.55, bl = 0.2;
    const k = (b * 0.6 + b2 * 0.4 - 0.5) * 0.35 + (n - 0.5) * 0.25;
    r += k * 0.6; g += k; bl += k * 0.3;
    if (clover > 0.62) { g += 0.05; r -= 0.04; }
    const dry = sstep(0.62, 0.8, n);
    o.r = r + dry * 0.14; o.g = g + dry * 0.05; o.b = bl + dry * 0.02;
    o.ro = 0.95;
  }, { normal: 3 }),
  paving: () => build('paving', 512, 512, (u, v, o) => {
    const fu = (u * 3) % 1, fv = (v * 4 + Math.floor(u * 3) * 0.5) % 1;
    const joint = Math.max(1 - sstep(0, 0.03, fu), sstep(0.97, 1, fu), 1 - sstep(0, 0.03, fv), sstep(0.97, 1, fv));
    const n = pfbm(u * 20, v * 20, 20, 3, 101);
    o.h = 1 - joint;
    const g = 0.62 + (n - 0.5) * 0.1 - joint * 0.15 + rnd(Math.floor(u * 3), Math.floor(v * 4 + Math.floor(u * 3) * 0.5), 102) * 0.06;
    o.r = g * 1.02; o.g = g * 0.97; o.b = g * 0.9;
    o.ro = 0.9;
  }, { normal: 3 }),
  // 樹皮（縦の割れ目）
  bark: () => build('bark', 256, 512, (u, v, o) => {
    const f = pfbm(u * 10, v * 3, 10, 4, 111);
    const crack = Math.abs(pfbm(u * 6, v * 1.2, 6, 3, 112) - 0.5);
    const c = sstep(0.0, 0.08, crack);
    o.h = c * 0.7 + f * 0.3;
    const g = 0.66 + f * 0.14 - (1 - c) * 0.28;
    o.r = g * 1.04; o.g = g * 0.97; o.b = g * 0.9;
    o.ro = 0.95;
  }, { normal: 5 }),
};

// ---------- 葉・草のカード（アルファ付き、キャンバスで描く） ----------
function drawCanvas(name, N, draw) {
  if (cache.has(name)) return cache.get(name);
  const c = document.createElement('canvas');
  c.width = c.height = N;
  const g = c.getContext('2d');
  draw(g, N);
  const t = tex(c, true, false);
  t.premultiplyAlpha = false;
  cache.set(name, t);
  return t;
}

// 広葉樹の葉の房
export function leafCluster(kind = 'broad') {
  return drawCanvas('leaf-' + kind, 512, (g, N) => {
    let s = kind.length * 97 + 13;
    const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    const pal = {
      broad: [[62, 104, 44], [84, 132, 52], [104, 150, 62], [132, 170, 74], [48, 86, 38]],
      cherry: [[70, 112, 46], [92, 138, 56], [118, 158, 66], [56, 96, 40]],
      shrub: [[58, 98, 42], [78, 124, 50], [98, 142, 58], [44, 80, 34]],
    }[kind] || [[70, 110, 50]];
    const leafLen = kind === 'shrub' ? N * 0.075 : N * 0.12;
    // 房の芯（中は詰まって、縁だけ葉がぎざぎざ）
    {
      const c = pal[0];
      const grd = g.createRadialGradient(N / 2, N * 0.52, N * 0.05, N / 2, N * 0.52, N * 0.36);
      grd.addColorStop(0, `rgba(${c[0] * 0.9 | 0},${c[1] * 0.9 | 0},${c[2] * 0.9 | 0},1)`);
      grd.addColorStop(0.8, `rgba(${c[0] * 0.8 | 0},${c[1] * 0.8 | 0},${c[2] * 0.8 | 0},1)`);
      grd.addColorStop(1, `rgba(${c[0] * 0.8 | 0},${c[1] * 0.8 | 0},${c[2] * 0.8 | 0},0)`);
      g.fillStyle = grd; g.beginPath(); g.arc(N / 2, N * 0.52, N * 0.36, 0, Math.PI * 2); g.fill();
    }
    // 小枝
    g.strokeStyle = 'rgba(70,52,36,1)'; g.lineCap = 'round';
    for (let k = 0; k < 7; k++) {
      g.lineWidth = 2 + r() * 2;
      g.beginPath(); g.moveTo(N / 2, N * 0.95);
      const a = -Math.PI / 2 + (r() - 0.5) * 2.2, L = N * (0.25 + r() * 0.2);
      g.quadraticCurveTo(N / 2 + Math.cos(a) * L * 0.5 + (r() - 0.5) * 30, N * 0.95 + Math.sin(a) * L * 0.5, N / 2 + Math.cos(a) * L, N * 0.95 + Math.sin(a) * L);
      g.stroke();
    }
    const count = kind === 'shrub' ? 300 : 220;
    for (let k = 0; k < count; k++) {
      // 房の形（ふっくらした丸）の中に葉を置く
      const ang = r() * Math.PI * 2, rad = Math.pow(r(), 0.6) * N * 0.42;
      const x = N / 2 + Math.cos(ang) * rad, y = N * 0.5 + Math.sin(ang) * rad * 0.9;
      const L = leafLen * (0.7 + r() * 0.6), W = L * (kind === 'cherry' ? 0.5 : 0.42);
      const rot = r() * Math.PI * 2;
      const c = pal[Math.floor(r() * pal.length)];
      const lit = 0.8 + (1 - y / N) * 0.4 + (r() - 0.5) * 0.14;
      g.save(); g.translate(x, y); g.rotate(rot);
      const grd = g.createLinearGradient(-W, 0, W, 0);
      grd.addColorStop(0, `rgb(${c[0] * lit * 0.8 | 0},${c[1] * lit * 0.8 | 0},${c[2] * lit * 0.8 | 0})`);
      grd.addColorStop(1, `rgb(${Math.min(255, c[0] * lit * 1.1) | 0},${Math.min(255, c[1] * lit * 1.1) | 0},${Math.min(255, c[2] * lit * 1.05) | 0})`);
      g.fillStyle = grd;
      g.beginPath();
      g.moveTo(0, -L / 2);
      g.bezierCurveTo(W, -L * 0.25, W * 0.8, L * 0.3, 0, L / 2);
      g.bezierCurveTo(-W * 0.8, L * 0.3, -W, -L * 0.25, 0, -L / 2);
      g.fill();
      g.strokeStyle = `rgba(30,50,20,0.35)`; g.lineWidth = 1;
      g.beginPath(); g.moveTo(0, -L * 0.45); g.lineTo(0, L * 0.45); g.stroke();
      g.restore();
    }
  });
}

// 松葉の房
export function pineCluster() {
  return drawCanvas('pine', 512, (g, N) => {
    let s = 4711;
    const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    g.lineCap = 'round';
    for (let k = 0; k < 110; k++) {
      const cx = N / 2 + (r() - 0.5) * N * 0.7, cy = N / 2 + (r() - 0.5) * N * 0.45;
      const n = 14;
      const lit = 0.7 + (1 - cy / N) * 0.5;
      for (let q = 0; q < n; q++) {
        const a = (q / n) * Math.PI * 2 + r() * 0.3, L = N * (0.04 + r() * 0.035);
        const c = [40 + r() * 20, 76 + r() * 30, 40 + r() * 16].map((v) => Math.min(255, v * lit) | 0);
        g.strokeStyle = `rgb(${c[0]},${c[1]},${c[2]})`; g.lineWidth = 1.6 + r();
        g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * L, cy + Math.sin(a) * L * 0.6); g.stroke();
      }
    }
  });
}

// ヤシの葉
export function frondTex() {
  return drawCanvas('frond', 512, (g, N) => {
    g.strokeStyle = 'rgb(96,120,50)'; g.lineWidth = 6; g.lineCap = 'round';
    g.beginPath(); g.moveTo(N / 2, N); g.lineTo(N / 2, 0); g.stroke();
    for (let y = 8; y < N; y += 9) {
      const L = Math.sin((y / N) * Math.PI) * N * 0.47 + 12;
      for (const s of [-1, 1]) {
        const c = 70 + (y / N) * 60;
        g.strokeStyle = `rgb(${c * 0.7 | 0},${c * 1.2 | 0},${c * 0.45 | 0})`; g.lineWidth = 4;
        g.beginPath(); g.moveTo(N / 2, y); g.quadraticCurveTo(N / 2 + s * L * 0.6, y + 10, N / 2 + s * L, y + 40); g.stroke();
      }
    }
  });
}

// テクスチャ付きの標準マテリアル（UV は m 単位、size で繰り返し）
export function texMat(name, opts = {}) {
  const set = TEX[name]();
  const [sx, sy] = TEX_SIZE[name] || [1, 1];
  const clone = (t) => { const c = t.clone(); c.repeat.set(1 / sx, 1 / sy); c.needsUpdate = true; return c; };
  return new THREE.MeshStandardMaterial({
    map: clone(set.map), normalMap: clone(set.normalMap), roughnessMap: clone(set.roughnessMap),
    roughness: 1, metalness: 0, vertexColors: true, ...opts,
  });
}
