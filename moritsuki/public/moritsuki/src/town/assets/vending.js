// 自販機とリサイクルボックス
// 見本は奥行きのある窓の棚に 3D で並べ、価格の帯・広告・硬貨投入口などは 1 枚の図柄（アトラス）から貼る
import * as THREE from 'three';

const C = (h) => new THREE.Color(h);
const pick = (a, r) => a[Math.floor(r() * a.length) % a.length];

// ---------- 図柄（1024×1024 のアトラス） ----------
const AT = 1024;
const REG = {
  header: (v) => [0, v * 64, 512, v * 64 + 64],
  back: [512, 0, 1024, 256],
  strip: (v) => [0, 256 + v * 40, 512, 296 + v * 40],
  ad: (v) => [(v % 2) * 384, 416 + Math.floor(v / 2) * 288, (v % 2) * 384 + 384, 704 + Math.floor(v / 2) * 288],
  coin: [768, 416, 1024, 800],
  bin: [768, 800, 1024, 928],
};
const THEMES = [
  { head: ['#1b56b0', '#3d93e0'], text: 'つめた〜い', sub: 'COLD', ad: 'sea' },
  { head: ['#1f7a48', '#4cb070'], text: 'お茶と、水。', sub: 'DRINK', ad: 'tea' },
  { head: ['#b8261e', '#e2503a'], text: 'あったか〜い・つめた〜い', sub: '', ad: 'coffee' },
  { head: ['#202226', '#4a4d52'], text: 'COFFEE & SODA', sub: '', ad: 'soda' },
];
let atlas = null;
function drawAtlas() {
  const c = document.createElement('canvas'), e = document.createElement('canvas');
  c.width = c.height = e.width = e.height = AT;
  const g = c.getContext('2d');
  g.fillStyle = '#e8e8e4'; g.fillRect(0, 0, AT, AT);
  let s = 7;
  const rr = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const font = (w, px) => `${w} ${px}px "Zen Kaku Gothic New", "Yu Gothic", "Hiragino Sans", sans-serif`;
  const round = (x, y, w, h, r) => { g.beginPath(); g.roundRect(x, y, w, h, r); };
  // 上の看板
  THEMES.forEach((t, v) => {
    const [x0, y0, x1, y1] = REG.header(v);
    const gr = g.createLinearGradient(x0, 0, x1, 0);
    gr.addColorStop(0, t.head[0]); gr.addColorStop(1, t.head[1]);
    g.fillStyle = gr; g.fillRect(x0, y0, x1 - x0, y1 - y0);
    g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(x0, y0, x1 - x0, 10);
    g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = font(900, t.text.length > 8 ? 30 : 38); g.fillText(t.text, (x0 + x1) / 2, (y0 + y1) / 2 + 2);
    if (t.sub) { g.font = font(700, 16); g.textAlign = 'right'; g.globalAlpha = 0.7; g.fillText(t.sub, x1 - 16, y1 - 14); g.globalAlpha = 1; }
  });
  // 見本の窓の奥（光る板）
  {
    const [x0, y0, x1, y1] = REG.back;
    const gr = g.createLinearGradient(0, y0, 0, y1);
    gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, '#d8ecf8');
    g.fillStyle = gr; g.fillRect(x0, y0, x1 - x0, y1 - y0);
    g.strokeStyle = 'rgba(120,170,210,0.25)'; g.lineWidth = 2;
    for (let q = 0; q < 12; q++) { g.beginPath(); g.moveTo(x0 + q * 48, y0); g.lineTo(x0 + q * 48 - 60, y1); g.stroke(); }
  }
  // 価格の帯（8 本ぶん・ボタン付き）
  for (let v = 0; v < 4; v++) {
    const [x0, y0, x1] = REG.strip(v);
    g.fillStyle = '#f7f7f4'; g.fillRect(x0, y0, x1 - x0, 40);
    g.fillStyle = '#c9ccd0'; g.fillRect(x0, y0 + 37, x1 - x0, 3);
    for (let q = 0; q < 8; q++) {
      const cx = x0 + 32 + q * 64;
      const hot = v === 2 && q >= 5;
      g.fillStyle = hot ? '#d8342a' : '#2a6cc8'; round(cx - 26, y0 + 4, 52, 12, 3); g.fill();
      g.fillStyle = '#fff'; g.font = font(700, 10); g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(hot ? 'あったか〜い' : 'つめた〜い', cx, y0 + 10.5);
      g.fillStyle = '#222'; g.font = font(800, 15);
      g.fillText(pick(['110', '130', '140', '160', '180'], rr), cx - 6, y0 + 27);
      g.fillStyle = rr() < 0.12 ? '#e33' : '#3c3'; g.beginPath(); g.arc(cx + 20, y0 + 27, 4, 0, 7); g.fill();
    }
  }
  // 広告
  THEMES.forEach((t, v) => {
    const [x0, y0, x1, y1] = REG.ad(v), w = x1 - x0, h = y1 - y0;
    g.save(); g.beginPath(); g.rect(x0, y0, w, h); g.clip();
    if (t.ad === 'sea') {
      const gr = g.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, '#7fd0f4'); gr.addColorStop(1, '#1d6fc0');
      g.fillStyle = gr; g.fillRect(x0, y0, w, h);
      g.fillStyle = 'rgba(255,255,255,0.85)';
      for (let q = 0; q < 3; q++) { g.beginPath(); g.moveTo(x0, y0 + h * (0.62 + q * 0.12)); for (let x = 0; x <= w; x += 8) g.lineTo(x0 + x, y0 + h * (0.62 + q * 0.12) + Math.sin(x / 26 + q) * 6); g.lineTo(x0 + w, y0 + h * (0.66 + q * 0.12)); g.lineTo(x0, y0 + h * (0.66 + q * 0.12)); g.fill(); }
      bottle(g, x0 + w * 0.72, y0 + h * 0.52, 1.5, '#e8f6ff', '#2a88d8');
      g.fillStyle = '#fff'; g.font = font(900, 50); g.textAlign = 'left'; g.textBaseline = 'alphabetic';
      g.fillText('冷えてます', x0 + 22, y0 + 78);
      g.font = font(700, 22); g.fillText('夏の、ひとやすみ。', x0 + 24, y0 + 114);
    } else if (t.ad === 'tea') {
      g.fillStyle = '#eef3e2'; g.fillRect(x0, y0, w, h);
      g.fillStyle = '#5c9a48'; g.beginPath(); g.ellipse(x0 + w * 0.3, y0 + h * 1.05, w * 0.7, h * 0.45, 0, 0, 7); g.fill();
      bottle(g, x0 + w * 0.7, y0 + h * 0.5, 1.5, '#c9d98a', '#2e7a3a');
      g.fillStyle = '#1f5a2e'; g.font = font(900, 58); g.textAlign = 'left'; g.textBaseline = 'alphabetic';
      g.fillText('緑茶', x0 + 26, y0 + 90);
      g.font = font(700, 22); g.fillText('すっきり 600ml', x0 + 28, y0 + 126);
    } else if (t.ad === 'coffee') {
      const gr = g.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, '#3a2418'); gr.addColorStop(1, '#6e4630');
      g.fillStyle = gr; g.fillRect(x0, y0, w, h);
      can(g, x0 + w * 0.7, y0 + h * 0.55, 2.1, '#d8b070', '#5a3420');
      g.fillStyle = '#f4e2c4'; g.font = font(900, 44); g.textAlign = 'left'; g.textBaseline = 'alphabetic';
      g.fillText('朝の一本', x0 + 22, y0 + 76);
      g.font = font(700, 20); g.fillText('微糖 BLACK', x0 + 24, y0 + 110);
    } else {
      g.fillStyle = '#f2d23a'; g.fillRect(x0, y0, w, h);
      g.fillStyle = '#ffffff';
      for (let q = 0; q < 26; q++) { g.globalAlpha = 0.35 + rr() * 0.5; g.beginPath(); g.arc(x0 + rr() * w, y0 + rr() * h, 4 + rr() * 14, 0, 7); g.fill(); }
      g.globalAlpha = 1;
      can(g, x0 + w * 0.72, y0 + h * 0.55, 2.1, '#e23a2a', '#ffffff');
      g.fillStyle = '#c0281c'; g.font = font(900, 54); g.textAlign = 'left'; g.textBaseline = 'alphabetic';
      g.fillText('シュワッ', x0 + 22, y0 + 84);
      g.font = font(700, 22); g.fillText('ソーダ 350ml', x0 + 26, y0 + 118);
    }
    g.restore();
  });
  // 硬貨・お札の投入口
  {
    const [x0, y0, x1, y1] = REG.coin, w = x1 - x0;
    const gr = g.createLinearGradient(x0, 0, x1, 0); gr.addColorStop(0, '#9a9ea3'); gr.addColorStop(0.5, '#e4e6e8'); gr.addColorStop(1, '#a6aaae');
    g.fillStyle = gr; g.fillRect(x0, y0, w, y1 - y0);
    g.fillStyle = '#101214'; round(x0 + 28, y0 + 24, 200, 44, 6); g.fill();
    g.fillStyle = '#ff5a3a'; g.font = '700 30px monospace'; g.textAlign = 'right'; g.textBaseline = 'middle'; g.fillText('0', x0 + 214, y0 + 47);
    g.fillStyle = '#2a2c2e'; g.font = font(700, 16); g.textAlign = 'center';
    g.fillText('硬貨', x0 + 70, y0 + 96); g.fillText('千円札', x0 + 170, y0 + 96);
    g.fillStyle = '#26282a'; round(x0 + 62, y0 + 110, 16, 54, 4); g.fill();
    g.fillStyle = '#26282a'; round(x0 + 120, y0 + 124, 104, 20, 4); g.fill();
    g.fillStyle = '#3ad060'; g.fillRect(x0 + 124, y0 + 146, 96, 4);
    g.fillStyle = '#1d4fa0'; round(x0 + 36, y0 + 196, 184, 70, 10); g.fill();
    g.fillStyle = '#fff'; g.font = font(900, 21); g.fillText('電子マネー', x0 + 128, y0 + 222); g.font = font(700, 14); g.fillText('ここにタッチ', x0 + 128, y0 + 250);
    g.fillStyle = '#5a5e62'; g.beginPath(); g.arc(x0 + 70, y0 + 318, 22, 0, 7); g.fill();
    g.fillStyle = '#d0d3d6'; g.beginPath(); g.arc(x0 + 70, y0 + 318, 14, 0, 7); g.fill();
    g.fillStyle = '#2a2c2e'; g.font = font(700, 14); g.fillText('返却', x0 + 70, y0 + 356); g.fillText('つり銭切れ', x0 + 172, y0 + 304);
    g.fillStyle = '#6a2020'; g.beginPath(); g.arc(x0 + 172, y0 + 330, 7, 0, 7); g.fill();
  }
  // リサイクルボックスのラベル
  {
    const [x0, y0, x1, y1] = REG.bin, w = x1 - x0;
    g.fillStyle = '#f8f8f4'; g.fillRect(x0, y0, w, y1 - y0);
    g.fillStyle = '#1f7a48'; g.fillRect(x0, y0, w, 36);
    g.fillStyle = '#fff'; g.font = font(900, 22); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('リサイクル', x0 + w / 2, y0 + 19);
    g.fillStyle = '#1f7a48'; g.font = font(900, 26); g.fillText('あきかん', x0 + w / 2, y0 + 62);
    g.font = font(700, 20); g.fillText('ペットボトル', x0 + w / 2, y0 + 98);
  }
  // 光る部分だけの図柄
  const ge = e.getContext('2d');
  ge.fillStyle = '#000'; ge.fillRect(0, 0, AT, AT);
  for (const R of [[0, 0, 1024, 256], [0, 256, 512, 416]]) ge.drawImage(c, R[0], R[1], R[2] - R[0], R[3] - R[1], R[0], R[1], R[2] - R[0], R[3] - R[1]);
  const mk = (cv) => { const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
  atlas = { map: mk(c), emissive: mk(e) };
  return atlas;
}
function bottle(g, x, y, s, liquid, label) {
  g.save(); g.translate(x, y); g.scale(s, s);
  g.fillStyle = liquid; g.beginPath(); g.roundRect(-22, -30, 44, 96, 10); g.fill();
  g.beginPath(); g.moveTo(-22, -26); g.quadraticCurveTo(-20, -52, -8, -58); g.lineTo(8, -58); g.quadraticCurveTo(20, -52, 22, -26); g.fill();
  g.fillStyle = '#f4f4f0'; g.fillRect(-9, -70, 18, 13);
  g.fillStyle = label; g.fillRect(-22, 0, 44, 36);
  g.fillStyle = 'rgba(255,255,255,0.45)'; g.fillRect(-16, -26, 5, 88);
  g.restore();
}
function can(g, x, y, s, body, band) {
  g.save(); g.translate(x, y); g.scale(s, s);
  g.fillStyle = '#c8ccd0'; g.beginPath(); g.ellipse(0, -34, 18, 4, 0, 0, 7); g.fill();
  g.fillStyle = body; g.fillRect(-20, -32, 40, 66);
  g.beginPath(); g.ellipse(0, 34, 20, 4, 0, 0, 7); g.fill();
  g.fillStyle = band; g.fillRect(-20, -6, 40, 14);
  g.fillStyle = 'rgba(255,255,255,0.4)'; g.fillRect(-14, -30, 5, 62);
  g.restore();
}
export function vendingTexture() { return (atlas || drawAtlas()).map; }
export function vendingEmissive() { return (atlas || drawAtlas()).emissive; }

// アトラスの区画 → 面の UV（図柄は上下反転して貼られる）
function uvOf([x0, y0, x1, y1]) { return [[x0 / AT, 1 - y1 / AT], [x1 / AT, 1 - y1 / AT], [x1 / AT, 1 - y0 / AT], [x0 / AT, 1 - y0 / AT]]; }
// 正面（+z）向きの四角
function front(k, mat, x0, y0, x1, y1, z, uv) { k.face(mat, [[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]], uv); }
// 凹み（奥の面と四方の内壁）
function recess(k, x0, y0, x1, y1, z, d, wallCol, wallMat = 'trim') {
  k.color(wallCol);
  k.face(wallMat, [[x0, y0, z], [x1, y0, z], [x1, y0, z - d], [x0, y0, z - d]]);
  k.face(wallMat, [[x1, y1, z], [x0, y1, z], [x0, y1, z - d], [x1, y1, z - d]]);
  k.face(wallMat, [[x0, y1, z], [x0, y0, z], [x0, y0, z - d], [x0, y1, z - d]]);
  k.face(wallMat, [[x1, y0, z], [x1, y1, z], [x1, y1, z - d], [x1, y0, z - d]]);
}
// 穴をよけて正面を四角で埋める
function panelWithHoles(k, mat, x0, y0, x1, y1, z, holes) {
  const xs = [...new Set([x0, x1, ...holes.flatMap((h) => [h[0], h[2]])])].sort((a, b) => a - b);
  const ys = [...new Set([y0, y1, ...holes.flatMap((h) => [h[1], h[3]])])].sort((a, b) => a - b);
  for (let i = 0; i < xs.length - 1; i++) for (let j = 0; j < ys.length - 1; j++) {
    const cx = (xs[i] + xs[i + 1]) / 2, cy = (ys[j] + ys[j + 1]) / 2;
    if (holes.some((h) => cx > h[0] && cx < h[2] && cy > h[1] && cy < h[3])) continue;
    front(k, mat, xs[i], ys[j], xs[i + 1], ys[j + 1], z);
  }
}

// ---------- 見本（缶・ペットボトル） ----------
let ITEMS = null;
function lathe(pts, seg = 8) { return new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg); }
function items() {
  if (ITEMS) return ITEMS;
  ITEMS = {
    can: {
      body: lathe([[0.001, 0], [0.026, 0], [0.033, 0.01], [0.033, 0.106], [0.029, 0.118]]),
      band: lathe([[0.0335, 0.045], [0.0335, 0.078]]),
      top: lathe([[0.029, 0.118], [0.027, 0.122], [0.001, 0.12]]),
      h: 0.122,
    },
    short: {
      body: lathe([[0.001, 0], [0.022, 0], [0.027, 0.008], [0.027, 0.09], [0.024, 0.1]]),
      band: lathe([[0.0275, 0.03], [0.0275, 0.07]]),
      top: lathe([[0.024, 0.1], [0.022, 0.104], [0.001, 0.102]]),
      h: 0.104,
    },
    pet: {
      body: lathe([[0.001, 0], [0.03, 0], [0.034, 0.012], [0.034, 0.13], [0.03, 0.152], [0.017, 0.176], [0.013, 0.182]]),
      band: lathe([[0.0348, 0.05], [0.0348, 0.118]]),
      top: lathe([[0.0145, 0.182], [0.0145, 0.2], [0.001, 0.201]]),
      h: 0.2,
    },
  };
  return ITEMS;
}
const DRINKS = {
  can: [['#e23a2a', '#ffffff'], ['#2a6cc8', '#f4f4f0'], ['#f2c330', '#2a2a2a'], ['#3aa05a', '#f4f4f0'], ['#f4f4f0', '#2a6cc8'], ['#9a60c0', '#f2c330'], ['#1e1e1e', '#d8a040'], ['#7ac8e8', '#ffffff']],
  short: [['#5a3420', '#d8b070'], ['#1e2a4a', '#d8b070'], ['#c8a060', '#5a3420'], ['#f4f4f0', '#5a3420']],
  pet: [['#e6f4fa', '#2a88d8'], ['#c9d98a', '#2e7a3a'], ['#d8a860', '#8a3a20'], ['#f0f4f0', '#f07a30'], ['#b8e070', '#1f5a2e'], ['#f4e8a0', '#e2503a']],
};

// ---------- 自販機 ----------
// ローカル: 原点 = 足もとの中央、+z = 正面。幅 1.0 m・奥行 0.72 m・高さ 1.83 m
export function vendingMachine(k, M, r, variant = null) {
  k.at(M);
  const v = variant ?? Math.floor(r() * THEMES.length);
  const body = C(pick([['#f2f2ee', '#d8332b', '#2a64b8', '#2f8f4e'], ['#2f8f4e', '#f2f2ee'], ['#d8332b', '#f2f2ee'], ['#26282c', '#8a1f22']][v % 4], r));
  const W = 1.0, D = 0.72, H = 1.83, zf = D / 2, hw = W / 2;
  const white = C('#ffffff');
  // 台と本体
  k.color(C('#1c1d1f')); k.box('dark', 0, 0.035, -0.02, W - 0.04, 0.07, D - 0.06);
  k.color(body);
  k.box('paint', 0, (0.07 + H) / 2, -0.04, W, H - 0.07, D - 0.08, 0b111110);
  k.box('paint', 0, H + 0.015, -0.01, W + 0.02, 0.03, D - 0.02);
  // 扉（正面は窓や投入口をよけて貼る）
  const zd = zf - 0.07;
  k.box('paint', 0, (0.08 + H - 0.02) / 2, (zd + zf) / 2, W - 0.02, H - 0.1, zf - zd, 0b111110);
  const disp = [-0.44, 0.9, 0.44, 1.66], head = [-0.46, 1.69, 0.46, 1.79], ad = [-0.44, 0.5, 0.14, 0.86];
  const coin = [0.18, 0.48, 0.44, 0.87], outlet = [-0.4, 0.13, 0.24, 0.35], ret = [0.29, 0.16, 0.42, 0.3];
  panelWithHoles(k, 'paint', -hw + 0.01, 0.08, hw - 0.01, H - 0.02, zf, [disp, head, ad, coin, outlet, ret]);
  // 看板・広告
  k.color(white);
  front(k, 'vend', ...head.slice(0, 2), ...head.slice(2), zf, uvOf(REG.header(v)));
  front(k, 'vend', ...ad.slice(0, 2), ...ad.slice(2), zf, uvOf(REG.ad(v)));
  front(k, 'vend', ...coin.slice(0, 2), ...coin.slice(2), zf, uvOf([REG.coin[0], REG.coin[1], REG.coin[2], REG.coin[3]]));
  // 投入口のまわりの出っぱり
  k.color(C('#a8acb0'));
  k.box('metal', (coin[0] + coin[2]) / 2, coin[3] + 0.012, zf + 0.012, coin[2] - coin[0] + 0.02, 0.024, 0.024);
  k.color(C('#2a2c2e')); k.box('plastic', 0.254, 0.643, zf + 0.012, 0.012, 0.05, 0.024);
  // 見本の窓
  const dd = 0.2;
  const [dx0, dy0, dx1, dy1] = disp;
  recess(k, dx0, dy0, dx1, dy1, zf, dd, C('#f4f6f8'));
  k.color(white); front(k, 'vend', dx0, dy0, dx1, dy1, zf - dd, uvOf(REG.back));
  k.color(C('#8e9296'));
  for (const [x, y, w, h] of [[0, dy1 + 0.012, dx1 - dx0 + 0.04, 0.024], [0, dy0 - 0.012, dx1 - dx0 + 0.04, 0.024], [dx0 - 0.012, (dy0 + dy1) / 2, 0.024, dy1 - dy0], [dx1 + 0.012, (dy0 + dy1) / 2, 0.024, dy1 - dy0]])
    k.box('metal', x, y, zf + 0.004, w, h, 0.012);
  // 棚: 下の段がペットボトル、上は缶
  const rowH = (dy1 - dy0) / 3, it = items();
  for (let row = 0; row < 3; row++) {
    const yb = dy0 + row * rowH + 0.042;
    k.color(white); front(k, 'vend', dx0, yb - 0.042, dx1, yb, zf - 0.03, uvOf(REG.strip((v + row) % 4)));
    k.color(C('#e2e6ea'));
    k.face('trim', [[dx0, yb, zf - 0.03], [dx1, yb, zf - 0.03], [dx1, yb, zf - dd], [dx0, yb, zf - dd]].reverse());
    k.face('trim', [[dx0, yb - 0.042, zf - 0.03], [dx1, yb - 0.042, zf - 0.03], [dx1, yb, zf - 0.03], [dx0, yb, zf - 0.03]]);
    for (let q = 0; q < 8; q++) {
      const type = row === 0 ? 'pet' : row === 1 ? (r() < 0.5 ? 'pet' : 'can') : r() < 0.4 ? 'short' : 'can';
      const g = it[type], [c0, c1] = pick(DRINKS[type], r);
      const x = dx0 + 0.055 + q * ((dx1 - dx0 - 0.11) / 7);
      const m = new THREE.Matrix4().makeRotationY(r() * 6.28).setPosition(x, yb, zf - dd * 0.55);
      k.color(C(c0)).geo('glowV', g.body, m);
      k.color(C(c1)).geo('glowV', g.band, m);
      k.color(type === 'pet' ? C(pick(['#f4f4f0', '#2a6cc8', '#e23a2a', '#f2c330'], r)) : C('#c8ccd0')).geo('glowV', g.top, m);
    }
  }
  // 取り出し口（くもった蓋）とおつり
  {
    const [x0, y0, x1, y1] = outlet;
    recess(k, x0, y0, x1, y1, zf, 0.16, C('#2a2c2e'), 'dark');
    k.color(C('#1a1b1c')); front(k, 'dark', x0, y0, x1, y1, zf - 0.16);
    const flap = new THREE.Matrix4().makeRotationX(0.12).setPosition((x0 + x1) / 2, y1 - 0.005, zf - 0.02);
    k.color(C('#2a3036')); k.geo('glass', new THREE.BoxGeometry(x1 - x0 - 0.02, y1 - y0 - 0.02, 0.008).translate(0, -(y1 - y0) / 2 + 0.005, 0), flap);
    k.color(C('#e8e8e4')); k.box('trim', (x0 + x1) / 2, y1 + 0.03, zf + 0.002, 0.16, 0.035, 0.004);
    const [rx0, ry0, rx1, ry1] = ret;
    recess(k, rx0, ry0, rx1, ry1, zf, 0.06, C('#303234'), 'dark');
    k.color(C('#1a1b1c')); front(k, 'dark', rx0, ry0, rx1, ry1, zf - 0.06);
  }
  // 鍵
  k.color(C('#c8ccd0')); k.geo('chrome', new THREE.CylinderGeometry(0.018, 0.018, 0.012, 12).rotateX(Math.PI / 2), new THREE.Matrix4().setPosition(0.46, 1.25, zf + 0.006));
  return { W, D, body };
}

// リサイクルボックス（自販機の横に）
export function recycleBin(k, M, col = C('#2f8f4e')) {
  k.at(M);
  const W = 0.44, D = 0.36, H = 0.82, zf = D / 2;
  k.color(col);
  k.box('plastic', 0, H / 2, 0, W, H, D);
  k.box('plastic', 0, H + 0.02, 0.01, W + 0.02, 0.04, D + 0.02);
  k.color(C('#ffffff'));
  front(k, 'vend', -W / 2 + 0.03, 0.3, W / 2 - 0.03, 0.52, zf + 0.001, uvOf(REG.bin));
  // 投入口（丸い穴ふたつ）
  for (const x of [-0.1, 0.1]) {
    k.color(C('#e8e8e4')); k.geo('plastic', new THREE.CylinderGeometry(0.065, 0.065, 0.012, 16).rotateX(Math.PI / 2), new THREE.Matrix4().setPosition(x, 0.66, zf + 0.004));
    k.color(C('#0e0f10')); k.geo('dark', new THREE.CylinderGeometry(0.048, 0.048, 0.012, 16).rotateX(Math.PI / 2), new THREE.Matrix4().setPosition(x, 0.66, zf + 0.008));
  }
}
