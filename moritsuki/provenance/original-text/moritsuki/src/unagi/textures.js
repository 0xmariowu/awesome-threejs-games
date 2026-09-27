// 手続きで描くテクスチャ（コンクリート・泥・網・竹・落ち葉など）
import * as THREE from 'three';
import { makeNoise2D, RNG, clamp } from './core/noise.js';

function canvas(w, h = w) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}
function toTex(c, { srgb = true, repeat = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  t.needsUpdate = true;
  return t;
}
/** 高さ（0..1 の配列）から法線マップを作る */
function normalFrom(h, W, H, strength = 2) {
  const c = canvas(W, H);
  const g = c.getContext('2d');
  const img = g.createImageData(W, H);
  const at = (x, y) => h[((y + H) % H) * W + ((x + W) % W)];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
    const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
    const l = Math.hypot(dx, dy, 1);
    const i = (y * W + x) * 4;
    img.data[i] = (-dx / l * 0.5 + 0.5) * 255;
    img.data[i + 1] = (dy / l * 0.5 + 0.5) * 255;
    img.data[i + 2] = (1 / l * 0.5 + 0.5) * 255;
    img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return toTex(c, { srgb: false });
}
// 継ぎ目なく繰り返すノイズ（4 隅を混ぜる）
function tileNoise(noise, x, y, W, H, f) {
  const u = x / W, v = y / H;
  const a = noise(x * f, y * f), b = noise((x - W) * f, y * f);
  const c = noise(x * f, (y - H) * f), d = noise((x - W) * f, (y - H) * f);
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}

/** コンクリート（1 枚 = 1m 四方）: 色・法線 */
export function concreteTextures(seed = 3) {
  const W = 512, H = 512;
  const n1 = makeNoise2D(seed), n2 = makeNoise2D(seed + 1), n3 = makeNoise2D(seed + 2);
  const rng = new RNG(seed);
  const h = new Float32Array(W * H);
  const c = canvas(W, H);
  const g = c.getContext('2d');
  const img = g.createImageData(W, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const big = tileNoise(n1, x, y, W, H, 0.006) * 0.5 + 0.5;
    const mid = tileNoise(n2, x, y, W, H, 0.03) * 0.5 + 0.5;
    const fine = tileNoise(n3, x, y, W, H, 0.2) * 0.5 + 0.5;
    let v = 0.56 + (big - 0.5) * 0.16 + (mid - 0.5) * 0.1 + (fine - 0.5) * 0.08;
    const i = y * W + x;
    h[i] = 0.5 + (mid - 0.5) * 0.3 + (fine - 0.5) * 0.35;
    img.data[i * 4] = v * 255 * 1.0;
    img.data[i * 4 + 1] = v * 255 * 0.99;
    img.data[i * 4 + 2] = v * 255 * 0.95;
    img.data[i * 4 + 3] = 255;
  }
  // 骨材の粒・気泡の穴
  for (let k = 0; k < 2200; k++) {
    const x = rng.int(0, W - 1), y = rng.int(0, H - 1);
    const hole = rng.chance(0.3);
    const r = hole ? rng.range(0.5, 1.6) : rng.range(0.6, 2.2);
    const shade = hole ? rng.range(0.34, 0.5) : rng.range(0.5, 0.74);
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
      const d = Math.hypot(dx, dy);
      if (d > r) continue;
      const xx = (x + dx + W) % W, yy = (y + dy + H) % H, i = yy * W + xx;
      const w = 1 - d / r;
      img.data[i * 4] = img.data[i * 4] * (1 - w) + shade * 255 * w;
      img.data[i * 4 + 1] = img.data[i * 4 + 1] * (1 - w) + shade * 250 * w;
      img.data[i * 4 + 2] = img.data[i * 4 + 2] * (1 - w) + shade * 240 * w;
      h[i] += (hole ? -0.6 : 0.2) * w;
    }
  }
  g.putImageData(img, 0, 0);
  return { map: toTex(c), normal: normalFrom(h, W, H, 3.2) };
}

/** 底の泥・砂・小石（1 枚 = 0.8m 四方） */
export function bedTextures(seed = 11) {
  const W = 512, H = 512;
  const n1 = makeNoise2D(seed), n2 = makeNoise2D(seed + 5), n3 = makeNoise2D(seed + 9);
  const rng = new RNG(seed);
  const h = new Float32Array(W * H);
  const c = canvas(W, H);
  const g = c.getContext('2d');
  const img = g.createImageData(W, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const a = tileNoise(n1, x, y, W, H, 0.012) * 0.5 + 0.5;
    const b = tileNoise(n2, x, y, W, H, 0.05) * 0.5 + 0.5;
    const f = tileNoise(n3, x, y, W, H, 0.35) * 0.5 + 0.5;
    const i = y * W + x;
    const v = 0.42 + (a - 0.5) * 0.25 + (b - 0.5) * 0.14 + (f - 0.5) * 0.18;
    h[i] = a * 0.4 + b * 0.3 + f * 0.3;
    img.data[i * 4] = v * 255 * 1.02;
    img.data[i * 4 + 1] = v * 255 * 0.94;
    img.data[i * 4 + 2] = v * 255 * 0.78;
    img.data[i * 4 + 3] = 255;
  }
  // 砂粒・小石（形はいびつ、色は地になじませる）
  for (let k = 0; k < 520; k++) {
    const x = rng.int(0, W - 1), y = rng.int(0, H - 1);
    const big = rng.chance(0.07);
    const r = big ? rng.range(5, 11) : rng.range(1.2, 3.2);
    const tone = rng.pick([[0.5, 0.47, 0.42], [0.36, 0.34, 0.31], [0.56, 0.52, 0.45], [0.3, 0.27, 0.23], [0.46, 0.41, 0.34]]);
    const ex = rng.range(0.6, 1.4), rot = rng.range(0, Math.PI);
    const lobes = [rng.range(0, 6), rng.range(0.1, 0.25), rng.range(0, 6), rng.range(0.05, 0.18)];
    const R = Math.ceil(r * 1.6);
    for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
      const cx = dx * Math.cos(rot) + dy * Math.sin(rot), cy = -dx * Math.sin(rot) + dy * Math.cos(rot);
      const a = Math.atan2(cy, cx);
      const rr = r * (1 + lobes[1] * Math.sin(2 * a + lobes[0]) + lobes[3] * Math.sin(3 * a + lobes[2]));
      const d = Math.hypot(cx * ex, cy / ex);
      if (d > rr) continue;
      const xx = (x + dx + W) % W, yy = (y + dy + H) % H, i = yy * W + xx;
      const w = Math.min(1, (1 - d / rr) * 4) * 0.85;
      for (let ch = 0; ch < 3; ch++) img.data[i * 4 + ch] = img.data[i * 4 + ch] * (1 - w) + tone[ch] * 255 * w * (0.9 + 0.2 * Math.random());
      h[i] += Math.sqrt(Math.max(0, 1 - (d / rr) ** 2)) * (big ? 0.7 : 0.35);
    }
  }
  g.putImageData(img, 0, 0);
  return { map: toTex(c), normal: normalFrom(h, W, H, -1.4) };
}

/** 網目（タモ網・ビクのふた）: 透明の地に糸の格子 */
export function meshTexture({ color = '#1d2a22', cells = 8, line = 0.16, knot = true } = {}) {
  const S = 256;
  const c = canvas(S);
  const g = c.getContext('2d');
  g.clearRect(0, 0, S, S);
  const step = S / cells;
  g.strokeStyle = color;
  g.lineWidth = step * line;
  g.lineCap = 'round';
  // ひし形の網目
  for (let i = -cells; i <= cells * 2; i++) {
    g.beginPath(); g.moveTo(i * step, 0); g.lineTo(i * step + S, S); g.stroke();
    g.beginPath(); g.moveTo(i * step + S, 0); g.lineTo(i * step, S); g.stroke();
  }
  if (knot) {
    g.fillStyle = color;
    for (let y = 0; y <= cells; y++) for (let x = 0; x <= cells; x++) {
      g.beginPath(); g.arc(x * step, y * step, step * line * 0.9, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.arc(x * step + step / 2, y * step + step / 2, step * line * 0.9, 0, Math.PI * 2); g.fill();
    }
  }
  const t = toTex(c);
  return t;
}

/** 竹を編んだ目（ビク） */
export function bambooWeave() {
  const W = 256, H = 256;
  const c = canvas(W, H);
  const g = c.getContext('2d');
  g.fillStyle = '#3a2a16';
  g.fillRect(0, 0, W, H);
  const rng = new RNG(71);
  const band = 32;
  for (let row = 0; row < H / band; row++) {
    for (let col = 0; col < W / band; col++) {
      const over = (row + col) % 2 === 0;
      const x = col * band, y = row * band;
      const base = over ? [196, 160, 98] : [168, 132, 78];
      const j = rng.range(-14, 14);
      const gr = over ? g.createLinearGradient(x, y, x, y + band) : g.createLinearGradient(x, y, x + band, y);
      gr.addColorStop(0, `rgb(${base[0] * 0.6 + j},${base[1] * 0.6 + j},${base[2] * 0.6})`);
      gr.addColorStop(0.5, `rgb(${base[0] + j},${base[1] + j},${base[2]})`);
      gr.addColorStop(1, `rgb(${base[0] * 0.6 + j},${base[1] * 0.6 + j},${base[2] * 0.6})`);
      g.fillStyle = gr;
      g.fillRect(x + 1.5, y + 1.5, band - 3, band - 3);
      // 竹の筋
      g.strokeStyle = 'rgba(90,60,25,0.35)';
      g.lineWidth = 1;
      for (let k = 0; k < 4; k++) {
        const o = 5 + k * 7 + rng.range(-1, 1);
        g.beginPath();
        if (over) { g.moveTo(x + 2, y + o); g.lineTo(x + band - 2, y + o); } else { g.moveTo(x + o, y + 2); g.lineTo(x + o, y + band - 2); }
        g.stroke();
      }
    }
  }
  return toTex(c);
}

/** 落ち葉（アルファつき）: 数種類を 1 枚に並べる（4×2） */
export function leafAtlas() {
  const W = 512, H = 256;
  const c = canvas(W, H);
  const g = c.getContext('2d');
  const rng = new RNG(33);
  const cols = [['#5a3d1e', '#3b2612'], ['#6b4a22', '#40290f'], ['#4a3a1c', '#2d220e'], ['#7a5a2a', '#4d3414'], ['#39331a', '#221e0e'], ['#5c4420', '#3a2710'], ['#4d4a24', '#2c2a12'], ['#6a3a1c', '#40200c']];
  for (let i = 0; i < 8; i++) {
    const cx = (i % 4) * 128 + 64, cy = Math.floor(i / 4) * 128 + 64;
    const [a, b] = cols[i];
    const L = rng.range(44, 58), Wd = rng.range(16, 28);
    g.save();
    g.translate(cx, cy);
    g.rotate(rng.range(-0.3, 0.3));
    const gr = g.createLinearGradient(-Wd, 0, Wd, 0);
    gr.addColorStop(0, b); gr.addColorStop(0.5, a); gr.addColorStop(1, b);
    g.fillStyle = gr;
    g.beginPath();
    g.moveTo(0, -L);
    g.bezierCurveTo(Wd * 1.3, -L * 0.4, Wd * 1.1, L * 0.5, 0, L * 0.85);
    g.bezierCurveTo(-Wd * 1.1, L * 0.5, -Wd * 1.3, -L * 0.4, 0, -L);
    g.fill();
    // 葉脈
    g.strokeStyle = 'rgba(30,20,8,0.5)';
    g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(0, -L * 0.95); g.lineTo(0, L); g.stroke();
    for (let k = -3; k <= 3; k++) {
      const y = k * L * 0.22;
      g.beginPath(); g.moveTo(0, y); g.lineTo(Wd * 0.8, y - L * 0.18); g.stroke();
      g.beginPath(); g.moveTo(0, y); g.lineTo(-Wd * 0.8, y - L * 0.18); g.stroke();
    }
    // 虫食い
    g.globalCompositeOperation = 'destination-out';
    for (let k = 0; k < rng.int(0, 4); k++) { g.beginPath(); g.arc(rng.range(-Wd * 0.6, Wd * 0.6), rng.range(-L * 0.6, L * 0.6), rng.range(2, 6), 0, Math.PI * 2); g.fill(); }
    g.restore();
    g.globalCompositeOperation = 'source-over';
  }
  return toTex(c, { repeat: false });
}

/** 草の葉（細長い葉の束の絵、アルファつき）: 田んぼの遠くの稲の板に */
export function riceCard() {
  const W = 256, H = 256;
  const c = canvas(W, H);
  const g = c.getContext('2d');
  const rng = new RNG(5);
  g.clearRect(0, 0, W, H);
  for (let i = 0; i < 46; i++) {
    const x0 = W / 2 + rng.range(-18, 18);
    const lean = rng.range(-1, 1);
    const len = rng.range(0.6, 1) * H * 0.95;
    const w = rng.range(3, 6);
    const t = rng.range(0.35, 0.8);
    g.fillStyle = `rgb(${40 + t * 50},${80 + t * 70},${30 + t * 20})`;
    g.beginPath();
    g.moveTo(x0 - w / 2, H);
    const tipX = x0 + lean * len * 0.55, tipY = H - len;
    g.quadraticCurveTo(x0 + lean * len * 0.1, H - len * 0.6, tipX, tipY);
    g.quadraticCurveTo(x0 + lean * len * 0.1 + w, H - len * 0.6, x0 + w / 2, H);
    g.fill();
  }
  return toTex(c, { repeat: false });
}

export { clamp };
