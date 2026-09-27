// 主人公の手描きテクスチャ: 麦わらの編み目・リボン・顔（目・口・ほっぺ・ばんそうこう）
import * as THREE from 'three';

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

function rng(seed) {
  let s = seed | 0 || 1;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

// 高さ（グレー）から法線マップを作る
function heightToNormal(hc, strength = 2) {
  const w = hc.width, h = hc.height;
  const src = hc.getContext('2d').getImageData(0, 0, w, h).data;
  const out = canvas(w, h), octx = out.getContext('2d');
  const img = octx.createImageData(w, h), d = img.data;
  const H = (x, y) => src[(((y + h) % h) * w + ((x + w) % w)) * 4] / 255;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = (H(x + 1, y) - H(x - 1, y)) * strength, dy = (H(x, y + 1) - H(x, y - 1)) * strength;
    const l = Math.hypot(dx, dy, 1);
    const i = (y * w + x) * 4;
    d[i] = (-dx / l * 0.5 + 0.5) * 255;
    d[i + 1] = (dy / l * 0.5 + 0.5) * 255;
    d[i + 2] = (1 / l * 0.5 + 0.5) * 255;
    d[i + 3] = 255;
  }
  octx.putImageData(img, 0, 0);
  return out;
}

const tex = (c, srgb) => {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
};

// ---------- 麦わら: 8 段の平編みの帯（1 段 = 64px）----------
export const STRAW_ROWS = 8;
export function strawTextures() {
  const S = 512, ROW = S / STRAW_ROWS, U = 16;
  const col = canvas(S, S), hgt = canvas(S, S);
  const c = col.getContext('2d'), g = hgt.getContext('2d');
  const r = rng(77);
  c.fillStyle = '#6b4a22'; c.fillRect(0, 0, S, S);
  g.fillStyle = '#000'; g.fillRect(0, 0, S, S);
  // 1 本の麦わら（平たい帯）: 中央が明るく高い
  const strand = (x0, y0, x1, y1, wid, tone) => {
    const ang = Math.atan2(y1 - y0, x1 - x0), len = Math.hypot(x1 - x0, y1 - y0);
    for (const [ctx, isH] of [[c, false], [g, true]]) {
      ctx.save();
      ctx.translate(x0, y0); ctx.rotate(ang);
      const gr = ctx.createLinearGradient(0, -wid / 2, 0, wid / 2);
      if (isH) {
        gr.addColorStop(0, '#202020'); gr.addColorStop(0.5, '#ffffff'); gr.addColorStop(1, '#202020');
      } else {
        const [hh, ss, ll] = tone;
        gr.addColorStop(0, `hsl(${hh},${ss}%,${ll - 16}%)`);
        gr.addColorStop(0.35, `hsl(${hh},${ss}%,${ll + 4}%)`);
        gr.addColorStop(0.55, `hsl(${hh - 2},${ss - 4}%,${ll + 9}%)`);
        gr.addColorStop(1, `hsl(${hh},${ss}%,${ll - 14}%)`);
      }
      ctx.fillStyle = gr;
      ctx.beginPath();
      ctx.moveTo(-1, -wid / 2); ctx.lineTo(len + 1, -wid / 2); ctx.lineTo(len + 1, wid / 2); ctx.lineTo(-1, wid / 2);
      ctx.fill();
      // 先で折り返している陰
      if (!isH) {
        const sh = ctx.createLinearGradient(len - 5, 0, len + 1, 0);
        sh.addColorStop(0, 'rgba(60,35,10,0)'); sh.addColorStop(1, 'rgba(60,35,10,0.45)');
        ctx.fillStyle = sh; ctx.fillRect(len - 5, -wid / 2, 6, wid);
        // 細い繊維のすじ
        ctx.strokeStyle = 'rgba(255,240,200,0.18)'; ctx.lineWidth = 0.6;
        for (let k = 0; k < 3; k++) { const yy = (r() - 0.5) * wid * 0.7; ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(len, yy); ctx.stroke(); }
      }
      ctx.restore();
    }
  };
  for (let row = 0; row < STRAW_ROWS; row++) {
    const y0 = row * ROW, mid = y0 + ROW / 2;
    const rowTone = (r() - 0.5) * 5;
    // 上半分と下半分から斜めに編み込まれた「くの字」の列
    for (let pass = 0; pass < 2; pass++) {
      for (let u = -1; u <= S / U; u++) {
        const x = u * U + (pass ? U / 2 : 0);
        const tone = [40 + (r() - 0.5) * 6, 52 + (r() - 0.5) * 10, 58 + rowTone + (r() - 0.5) * 9];
        if (pass === 0) strand(x, y0 + 2, x + U * 1.15, mid + 1, U * 0.72, tone);
        else strand(x, y0 + ROW - 2, x + U * 1.15, mid - 1, U * 0.72, tone);
      }
    }
    // 段の境目（縫い目）
    c.fillStyle = 'rgba(70,45,18,0.85)'; c.fillRect(0, y0, S, 2.5);
    g.fillStyle = '#000'; g.fillRect(0, y0, S, 3);
    c.strokeStyle = 'rgba(80,55,25,0.55)'; c.lineWidth = 1.2;
    for (let x = 0; x < S; x += 8) { c.beginPath(); c.moveTo(x, y0 - 1); c.lineTo(x + 3, y0 + 3); c.stroke(); }
    // 中央の折り目
    c.fillStyle = 'rgba(90,60,25,0.35)'; c.fillRect(0, mid - 1, S, 2);
  }
  // 日焼けむら
  for (let k = 0; k < 60; k++) {
    const x = r() * S, y = r() * S, rad = 20 + r() * 60;
    const gr = c.createRadialGradient(x, y, 0, x, y, rad);
    const dark = r() < 0.5;
    gr.addColorStop(0, dark ? 'rgba(120,80,30,0.10)' : 'rgba(255,235,190,0.09)');
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = gr;
    for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) { c.save(); c.translate(ox, oy); c.fillRect(x - rad, y - rad, rad * 2, rad * 2); c.restore(); }
  }
  return { map: tex(col, true), normalMap: tex(heightToNormal(hgt, 3.2)) };
}

// ---------- リボン（グログラン: 細かい横うね）----------
export function ribbonTextures() {
  const W = 64, H = 128;
  const col = canvas(W, H), hgt = canvas(W, H);
  const c = col.getContext('2d'), g = hgt.getContext('2d');
  c.fillStyle = '#b3262b'; c.fillRect(0, 0, W, H);
  for (let y = 0; y < H; y += 4) {
    c.fillStyle = 'rgba(255,190,180,0.10)'; c.fillRect(0, y, W, 2);
    g.fillStyle = '#fff'; g.fillRect(0, y, W, 2);
    g.fillStyle = '#555'; g.fillRect(0, y + 2, W, 2);
  }
  // 縁の織り
  c.fillStyle = 'rgba(80,0,10,0.35)'; c.fillRect(0, 0, W, 4); c.fillRect(0, H - 4, W, 4);
  return { map: tex(col, true), normalMap: tex(heightToNormal(hgt, 1.5)) };
}

// ---------- 顔 ----------
// 頭のローカル座標（頭の中心が原点）を、角度 θ = atan(x, z) の弧長 X = θ·FACE.R と高さ Y で平らに開く。
// 1 マス = X ∈ [-W/2, W/2], Y ∈ [Y0, Y1]。3 列 × 2 段のアトラス。
export const FACE = { R: 0.12, W: 0.216, Y0: -0.108, Y1: 0.054, PX: 768 };
FACE.PY = Math.round(FACE.PX * (FACE.Y1 - FACE.Y0) / FACE.W);

// マスの種類
export const CELL = { base: [0, 0], eyesOpen: [1, 0], eyesClosed: [2, 0], eyesHappy: [0, 1], mouthSmile: [1, 1], mouthOpen: [2, 1] };

export function faceAtlas(geo) {
  const { PX, PY, W, Y1 } = FACE;
  const cv = canvas(PX * 3, PY * 2);
  const ctx = cv.getContext('2d');
  const S = PX / W; // px / m
  // (X, Y) メートルで描く
  const cell = ([cx, cy], draw) => {
    ctx.save();
    ctx.beginPath(); ctx.rect(cx * PX + 2, cy * PY + 2, PX - 4, PY - 4); ctx.clip();
    ctx.translate(cx * PX + PX / 2, cy * PY + Y1 * S);
    ctx.scale(S, -S);
    draw(ctx);
    ctx.restore();
  };
  const E = geo.eye; // { x, y, w, h }
  const ellipse = (x, y, rx, ry, rot = 0) => { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); };

  // 下地: 眉・ほっぺ・鼻の日焼け・ばんそうこう
  cell(CELL.base, () => {
    for (const s of [-1, 1]) {
      // ほっぺの赤み
      const bx = s * (E.x + 0.012), by = E.y - E.h * 0.95;
      const gr = ctx.createRadialGradient(bx, by, 0, bx, by, 0.02);
      gr.addColorStop(0, 'rgba(236,104,92,0.42)'); gr.addColorStop(1, 'rgba(236,104,92,0)');
      ctx.save(); ctx.translate(bx, by); ctx.scale(1.45, 1); ctx.translate(-bx, -by);
      ctx.fillStyle = gr; ctx.fillRect(bx - 0.03, by - 0.03, 0.06, 0.06);
      ctx.restore();
      // 眉（太めで短い、少し上がり気味）
      ctx.save();
      ctx.translate(s * (E.x + 0.002), E.y + E.h * 0.5 + 0.017);
      ctx.rotate(s * -0.12);
      ctx.fillStyle = '#3a2618';
      ctx.beginPath();
      ctx.moveTo(-0.0125, -0.0018);
      ctx.quadraticCurveTo(0, 0.0032, 0.0125, 0.0004);
      ctx.quadraticCurveTo(0.0132, -0.0016, 0.011, -0.0026);
      ctx.quadraticCurveTo(0, -0.0006, -0.0118, -0.0038);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    // 鼻の頭の日焼け
    const ng = ctx.createRadialGradient(0, geo.noseY, 0, 0, geo.noseY, 0.012);
    ng.addColorStop(0, 'rgba(226,110,90,0.28)'); ng.addColorStop(1, 'rgba(226,110,90,0)');
    ctx.fillStyle = ng; ctx.fillRect(-0.02, geo.noseY - 0.02, 0.04, 0.04);
    // ばんそうこう（左のほほ = +X）
    ctx.save();
    ctx.translate(E.x + 0.02, E.y - E.h * 1.05);
    ctx.rotate(0.45);
    const bw = 0.026, bh = 0.0095;
    const rr = (x, y, w, h, r) => { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); };
    ctx.shadowColor = 'rgba(120,60,40,0.35)'; ctx.shadowBlur = 0;
    rr(-bw / 2, -bh / 2, bw, bh, bh * 0.48);
    ctx.fillStyle = '#e9c49a'; ctx.fill();
    ctx.lineWidth = 0.0005; ctx.strokeStyle = 'rgba(150,95,60,0.6)'; ctx.stroke();
    rr(-bw * 0.17, -bh * 0.36, bw * 0.34, bh * 0.72, bh * 0.1);
    ctx.fillStyle = '#f6e6cf'; ctx.fill();
    ctx.fillStyle = 'rgba(160,110,70,0.45)';
    for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) {
      ctx.beginPath(); ctx.arc(sx * (bw * 0.3 + i * 0.0022), (j - 0.5) * 0.003, 0.00045, 0, 7); ctx.fill();
    }
    ctx.restore();
  });

  // 目（開き）
  cell(CELL.eyesOpen, () => {
    for (const s of [-1, 1]) {
      const x = s * E.x, y = E.y;
      // 白目
      ctx.save();
      ellipse(x, y, E.w, E.h);
      ctx.fillStyle = '#fbf8f2'; ctx.fill();
      ctx.clip();
      // 瞳（下が明るい茶色のグラデーション）
      const ix = x + s * -0.0012, iy = y - E.h * 0.08, irx = E.w * 0.8, iry = E.h * 0.86;
      const ig = ctx.createLinearGradient(0, iy + iry, 0, iy - iry);
      ig.addColorStop(0, '#1b0f0a'); ig.addColorStop(0.45, '#2a1810'); ig.addColorStop(0.8, '#6b3f22'); ig.addColorStop(1, '#8c5a2f');
      ellipse(ix, iy, irx, iry); ctx.fillStyle = ig; ctx.fill();
      // 瞳孔
      ellipse(ix, iy - iry * 0.05, irx * 0.46, iry * 0.5); ctx.fillStyle = '#0d0705'; ctx.fill();
      // 上まぶたの影
      const sg = ctx.createLinearGradient(0, y + E.h, 0, y + E.h * 0.35);
      sg.addColorStop(0, 'rgba(60,30,20,0.45)'); sg.addColorStop(1, 'rgba(60,30,20,0)');
      ctx.fillStyle = sg; ctx.fillRect(x - E.w, y, E.w * 2, E.h);
      // ハイライト（光は左上から）
      ellipse(ix - irx * 0.35, iy + iry * 0.42, irx * 0.36, iry * 0.26, 0.4); ctx.fillStyle = 'rgba(255,255,255,0.97)'; ctx.fill();
      ellipse(ix + irx * 0.38, iy - iry * 0.45, irx * 0.14, iry * 0.1); ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fill();
      ctx.restore();
      // 上まつげ（太い線、目じりを少し伸ばす）
      ctx.save();
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.strokeStyle = '#1c110c'; ctx.lineWidth = 0.0026;
      ctx.beginPath();
      ctx.ellipse(x, y, E.w * 1.02, E.h * 1.01, 0, s > 0 ? Math.PI * 0.06 : Math.PI * 0.2, s > 0 ? Math.PI * 0.8 : Math.PI * 0.94);
      ctx.stroke();
      // 目じりのはね
      const ox = x + s * E.w * 0.98, oy = y + E.h * 0.18;
      ctx.lineWidth = 0.0021;
      ctx.beginPath(); ctx.moveTo(ox - s * 0.002, oy + 0.002); ctx.quadraticCurveTo(ox + s * 0.001, oy, ox + s * 0.0035, oy - 0.0015); ctx.stroke();
      // 下まぶた（うすく）
      ctx.strokeStyle = 'rgba(90,50,35,0.55)'; ctx.lineWidth = 0.0009;
      ctx.beginPath();
      ctx.ellipse(x, y, E.w * 0.96, E.h * 0.98, 0, Math.PI * 1.25, Math.PI * 1.75);
      ctx.stroke();
      ctx.restore();
    }
  });

  // 目（閉じ: まばたき）
  cell(CELL.eyesClosed, () => {
    for (const s of [-1, 1]) {
      const x = s * E.x, y = E.y - E.h * 0.25;
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#1c110c'; ctx.lineWidth = 0.0024;
      ctx.beginPath();
      ctx.moveTo(x - E.w * 0.95, y + 0.0015);
      ctx.quadraticCurveTo(x, y - E.h * 0.45, x + E.w * 0.95, y + 0.0015);
      ctx.stroke();
      ctx.lineWidth = 0.0016;
      ctx.beginPath(); ctx.moveTo(x + s * E.w * 0.9, y + 0.001); ctx.lineTo(x + s * (E.w + 0.003), y + 0.0028); ctx.stroke();
    }
  });

  // 目（にっこり: ^ ^）
  cell(CELL.eyesHappy, () => {
    for (const s of [-1, 1]) {
      const x = s * E.x, y = E.y - E.h * 0.15;
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.strokeStyle = '#1c110c'; ctx.lineWidth = 0.0029;
      ctx.beginPath();
      ctx.moveTo(x - E.w * 0.95, y - E.h * 0.28);
      ctx.quadraticCurveTo(x, y + E.h * 0.62, x + E.w * 0.95, y - E.h * 0.28);
      ctx.stroke();
    }
  });

  // 口（にこっと閉じた口）
  cell(CELL.mouthSmile, () => {
    const y = geo.mouthY;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#6a2f22'; ctx.lineWidth = 0.0017;
    ctx.beginPath();
    ctx.moveTo(-0.0105, y + 0.0022);
    ctx.quadraticCurveTo(0, y - 0.0042, 0.0105, y + 0.0022);
    ctx.stroke();
    ctx.lineWidth = 0.0011;
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * 0.0098, y + 0.0028); ctx.lineTo(s * 0.0116, y + 0.0036); ctx.stroke(); }
  });

  // 口（開けて笑う）
  cell(CELL.mouthOpen, () => {
    const y = geo.mouthY;
    ctx.beginPath();
    ctx.moveTo(-0.0125, y + 0.003);
    ctx.quadraticCurveTo(0, y + 0.0005, 0.0125, y + 0.003);
    ctx.quadraticCurveTo(0.009, y - 0.0135, 0, y - 0.0145);
    ctx.quadraticCurveTo(-0.009, y - 0.0135, -0.0125, y + 0.003);
    ctx.closePath();
    ctx.fillStyle = '#6e2320'; ctx.fill();
    ctx.save(); ctx.clip();
    // 舌
    ellipse(0, y - 0.0135, 0.0085, 0.0055); ctx.fillStyle = '#e0695e'; ctx.fill();
    // 上の歯
    ctx.fillStyle = '#fbf6ee'; ctx.fillRect(-0.011, y + 0.0002, 0.022, 0.0028);
    ctx.restore();
    ctx.lineJoin = 'round'; ctx.strokeStyle = '#4a1a14'; ctx.lineWidth = 0.0011; ctx.stroke();
  });

  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.flipY = false;
  t.anisotropy = 8;
  t.generateMipmaps = true;
  return t;
}

// ---------- T シャツの胸のプリント（魚と波）----------
export function shirtPrint() {
  const S = 256;
  const cv = canvas(S, S), c = cv.getContext('2d');
  c.clearRect(0, 0, S, S);
  c.translate(S / 2, S / 2);
  const ink = '#2c4f86', red = '#d2463a';
  // 丸い枠
  c.lineWidth = 9; c.strokeStyle = ink;
  c.beginPath(); c.arc(0, 0, 104, 0, Math.PI * 2); c.stroke();
  // 波
  c.save();
  c.beginPath(); c.arc(0, 0, 96, 0, Math.PI * 2); c.clip();
  c.fillStyle = ink;
  for (let k = 0; k < 2; k++) {
    c.beginPath();
    const y0 = 38 + k * 30;
    c.moveTo(-110, 120);
    for (let x = -110; x <= 110; x += 4) c.lineTo(x, y0 + Math.sin(x / 17 + k * 1.7) * 7);
    c.lineTo(110, 120); c.closePath();
    c.globalAlpha = k ? 1 : 0.55; c.fill();
  }
  c.globalAlpha = 1;
  // 太陽
  c.fillStyle = red; c.beginPath(); c.arc(46, -44, 22, 0, Math.PI * 2); c.fill();
  c.restore();
  // 魚
  c.save();
  c.translate(-10, -6); c.rotate(-0.18);
  c.fillStyle = ink;
  c.beginPath();
  c.moveTo(-62, 0);
  c.bezierCurveTo(-40, -34, 30, -36, 52, -6);
  c.lineTo(80, -30); c.lineTo(74, 0); c.lineTo(80, 30); c.lineTo(52, 6);
  c.bezierCurveTo(30, 36, -40, 34, -62, 0);
  c.fill();
  c.fillStyle = '#f4f2ec';
  c.beginPath(); c.arc(-38, -5, 6.5, 0, Math.PI * 2); c.fill();
  c.strokeStyle = '#f4f2ec'; c.lineWidth = 4;
  c.beginPath(); c.arc(-20, 0, 18, -1.1, 1.1); c.stroke();
  c.restore();
  // かすれ（洗いざらし）
  c.globalCompositeOperation = 'destination-out';
  const r = rng(5);
  for (let k = 0; k < 900; k++) {
    c.globalAlpha = 0.25 + r() * 0.5;
    c.beginPath(); c.arc((r() - 0.5) * S, (r() - 0.5) * S, 0.8 + r() * 2.2, 0, Math.PI * 2); c.fill();
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
