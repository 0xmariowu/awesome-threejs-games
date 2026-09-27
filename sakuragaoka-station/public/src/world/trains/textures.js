// Canvas atlases for the trains: decals (logo, numbers, stickers, ads), LED/LCD displays, petals.
// All text is fictional (桜川電鉄 / Sakuragawa Railway) and drawn un-mirrored (planes face +Z).

const DEC_W = 1024, DEC_H = 1024;
const LED_W = 1024, LED_H = 256;

export const DEC_RECTS = {
  emblem: [0, 0, 256, 256],
  wordmark: [256, 0, 512, 128],
  jakurei: [768, 0, 256, 128],
  priority: [256, 128, 512, 128],
  wheelchair: [768, 128, 128, 128],
  stroller: [896, 128, 128, 128],
  doorCaution: [0, 256, 128, 128],
  mascot: [128, 256, 128, 128],
  kids: [256, 256, 128, 128],
  prioritySign: [384, 256, 256, 64],
  crewSign: [384, 320, 256, 64],
  routeMap: [640, 256, 384, 128],
  num0: [0, 384, 256, 64], num1: [256, 384, 256, 64], num2: [512, 384, 256, 64], num3: [768, 384, 256, 64],
  num4: [0, 448, 256, 64], num5: [256, 448, 256, 64], num6: [512, 448, 256, 64], num7: [768, 448, 256, 64],
  ad0: [0, 512, 256, 160], ad1: [256, 512, 256, 160], ad2: [512, 512, 256, 160], ad3: [768, 512, 256, 160],
  ad4: [0, 672, 256, 160], ad5: [256, 672, 256, 160],
  hang0: [512, 672, 256, 128], hang1: [768, 672, 256, 128], hang2: [0, 832, 256, 128], hang3: [256, 832, 256, 128],
  emergency: [512, 832, 128, 64], plate: [640, 832, 128, 64], gangway: [768, 832, 128, 128], cabPanel: [896, 832, 128, 128],
  jumperWarn: [512, 896, 128, 64],
};
export const LED_RECTS = {
  destA: [0, 0, 512, 128], destB: [512, 0, 512, 128],
  runA: [0, 128, 128, 64], runB: [128, 128, 128, 64],
  lcdA: [256, 128, 256, 64], lcdB: [512, 128, 256, 64],
  cab: [768, 128, 128, 64], cab2: [896, 128, 128, 64],
  sideA: [0, 192, 384, 64], sideB: [384, 192, 384, 64],
};
export const CAR_NUMBERS = { A: ['5001', '5101'], B: ['5002', '5102'] };

const toUV = (r, W, H) => ({ u0: r[0] / W, u1: (r[0] + r[2]) / W, v0: 1 - (r[1] + r[3]) / H, v1: 1 - r[1] / H });

// ------------------------------------------------------------------ drawing helpers
function sakuraPath(g, cx, cy, R, rot = 0) {
  g.beginPath();
  for (let k = 0; k < 5; k++) {
    const a = rot + (k * Math.PI * 2) / 5;
    const c = Math.cos(a), s = Math.sin(a);
    const P = (x, y) => [cx + x * c - y * s, cy + x * s + y * c];
    // petal along -y
    const p0 = P(0, 0), c1 = P(-0.62 * R, -0.28 * R), c2 = P(-0.52 * R, -0.95 * R), p1 = P(-0.14 * R, -R), n = P(0, -0.84 * R), p2 = P(0.14 * R, -R), c3 = P(0.52 * R, -0.95 * R), c4 = P(0.62 * R, -0.28 * R);
    g.moveTo(...p0); g.bezierCurveTo(...c1, ...c2, ...p1); g.lineTo(...n); g.lineTo(...p2); g.bezierCurveTo(...c3, ...c4, ...p0);
  }
  g.closePath();
}
function rr(tex, g, x, y, w, h, r) { tex.roundRect(g, x, y, w, h, r); }

function person(g, x, y, s, col, opts = {}) {
  // simple pictogram figure; (x,y) = feet centre, s = height
  g.save(); g.fillStyle = col; g.strokeStyle = col; g.lineCap = 'round'; g.lineJoin = 'round';
  const lw = s * 0.13; g.lineWidth = lw;
  const bend = opts.bend || 0;
  const hx = x + bend * s * 0.18, hy = y - s * 0.86;
  g.beginPath(); g.arc(hx, hy, s * 0.1, 0, Math.PI * 2); g.fill();
  const sx = x + bend * s * 0.12, sy = y - s * 0.68, px = x, py = y - s * 0.32;
  if (opts.belly) { g.beginPath(); g.ellipse(x + s * 0.05, y - s * 0.46, s * 0.14, s * 0.2, 0, 0, Math.PI * 2); g.fill(); }
  g.beginPath(); g.moveTo(sx, sy); g.lineTo(px, py); g.stroke();
  g.beginPath(); g.moveTo(px, py); g.lineTo(x - s * 0.1, y); g.moveTo(px, py); g.lineTo(x + s * 0.1, y); g.stroke();
  if (opts.cane) { g.beginPath(); g.moveTo(sx, sy + s * 0.05); g.lineTo(x + s * 0.28, y - s * 0.34); g.stroke(); g.lineWidth = lw * 0.7; g.beginPath(); g.moveTo(x + s * 0.28, y - s * 0.36); g.lineTo(x + s * 0.3, y); g.stroke(); }
  else if (opts.crutch) { g.beginPath(); g.moveTo(sx, sy + s * 0.05); g.lineTo(x - s * 0.24, y - s * 0.5); g.stroke(); g.lineWidth = lw * 0.7; g.beginPath(); g.moveTo(x - s * 0.26, y - s * 0.62); g.lineTo(x - s * 0.3, y); g.stroke(); }
  else if (opts.hand) { g.beginPath(); g.moveTo(sx, sy + s * 0.05); g.lineTo(opts.hand[0], opts.hand[1]); g.stroke(); }
  else { g.beginPath(); g.moveTo(sx, sy + s * 0.05); g.lineTo(x - s * 0.16, y - s * 0.38); g.moveTo(sx, sy + s * 0.05); g.lineTo(x + s * 0.16, y - s * 0.38); g.stroke(); }
  g.restore();
}
function wheelchairIcon(g, cx, cy, s, col) {
  g.save(); g.strokeStyle = col; g.fillStyle = col; g.lineCap = 'round'; g.lineJoin = 'round'; g.lineWidth = s * 0.09;
  g.beginPath(); g.arc(cx - s * 0.05, cy - s * 0.38, s * 0.085, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.moveTo(cx - s * 0.08, cy - s * 0.24); g.lineTo(cx - s * 0.1, cy + s * 0.02); g.lineTo(cx + s * 0.16, cy + s * 0.02); g.lineTo(cx + s * 0.26, cy + s * 0.26); g.stroke();
  g.beginPath(); g.moveTo(cx - s * 0.09, cy - s * 0.13); g.lineTo(cx + s * 0.1, cy - s * 0.13); g.stroke();
  g.lineWidth = s * 0.07; g.beginPath(); g.arc(cx - s * 0.06, cy + s * 0.12, s * 0.22, Math.PI * 0.62, Math.PI * 2.1); g.stroke();
  g.restore();
}
function strollerIcon(g, cx, cy, s, col) {
  g.save(); g.strokeStyle = col; g.fillStyle = col; g.lineCap = 'round'; g.lineJoin = 'round'; g.lineWidth = s * 0.08;
  g.beginPath(); g.moveTo(cx - s * 0.3, cy - s * 0.05); g.arc(cx - s * 0.04, cy - s * 0.05, s * 0.26, Math.PI, 0, true); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(cx - s * 0.3, cy - s * 0.05); g.lineTo(cx - s * 0.3, cy - s * 0.33); g.arc(cx - s * 0.04, cy - s * 0.05, s * 0.28, Math.PI, Math.PI * 1.45); g.stroke();
  g.beginPath(); g.moveTo(cx + s * 0.22, cy - s * 0.05); g.lineTo(cx + s * 0.36, cy - s * 0.36); g.lineTo(cx + s * 0.46, cy - s * 0.36); g.stroke();
  g.beginPath(); g.arc(cx - s * 0.2, cy + s * 0.34, s * 0.09, 0, Math.PI * 2); g.arc(cx + s * 0.14, cy + s * 0.34, s * 0.09, 0, Math.PI * 2); g.fill();
  g.restore();
}

/** Convert a region to an LED dot-matrix look (works on real canvases; no-op-ish in node stubs). */
function ledify(g, x, y, w, h, cell, dim = '#2a1a10') {
  let img; try { img = g.getImageData(x, y, w, h); } catch (e) { return; }
  const d = img.data; if (!d || !d.length) return;
  const cols = Math.floor(w / cell), rows = Math.floor(h / cell);
  const cells = [];
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    let r = 0, gg = 0, b = 0, n = 0;
    for (let yy = 0; yy < cell; yy++) for (let xx = 0; xx < cell; xx++) {
      const k = ((j * cell + yy) * w + (i * cell + xx)) * 4; r += d[k]; gg += d[k + 1]; b += d[k + 2]; n++;
    }
    cells.push([r / n, gg / n, b / n]);
  }
  g.fillStyle = '#0d0806'; g.fillRect(x, y, w, h);
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const [r, gg, b] = cells[j * cols + i];
    const lum = Math.max(r, gg, b);
    const cx = x + i * cell + cell / 2, cy = y + j * cell + cell / 2;
    if (lum > 70) {
      const k = Math.min(1, lum / 200);
      g.fillStyle = `rgb(${Math.min(255, r / k) | 0},${Math.min(255, gg / k) | 0},${Math.min(255, b / k) | 0})`;
      g.beginPath(); g.arc(cx, cy, cell * 0.46, 0, Math.PI * 2); g.fill();
    } else { g.fillStyle = dim; g.beginPath(); g.arc(cx, cy, cell * 0.3, 0, Math.PI * 2); g.fill(); }
  }
}

// ------------------------------------------------------------------ atlases
export function createTrainTextures(ctx) {
  const T = ctx.tex, F = T.FONTS;
  const NAMES = ctx.L.NAMES;

  const decal = T.draw(DEC_W, DEC_H, (g) => {
    g.clearRect(0, 0, DEC_W, DEC_H);
    const R = DEC_RECTS;
    // --- emblem: white roundel, pink sakura, SR
    {
      const [x, y, w] = R.emblem; const cx = x + w / 2, cy = y + w / 2;
      g.fillStyle = '#fbf6ee'; g.beginPath(); g.arc(cx, cy, w * 0.47, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#e57aa1'; sakuraPath(g, cx, cy + 4, w * 0.42); g.fill();
      g.fillStyle = '#fbf6ee'; g.beginPath(); g.arc(cx, cy + 4, w * 0.2, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#d4577f'; g.textAlign = 'center'; g.textBaseline = 'middle';
      T.fitText(g, 'SR', cx, cy + 8, w * 0.36, w * 0.24, F.round, 900);
    }
    // --- wordmark
    {
      const [x, y, w, h] = R.wordmark;
      const cx = x + 62, cy = y + h / 2;
      g.fillStyle = '#e57aa1'; sakuraPath(g, cx, cy + 2, 50); g.fill();
      g.fillStyle = '#fbf6ee'; g.beginPath(); g.arc(cx, cy + 2, 21, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#d4577f'; g.textAlign = 'center'; g.textBaseline = 'middle'; T.fitText(g, 'SR', cx, cy + 4, 34, 24, F.round, 900);
      g.textAlign = 'left'; g.fillStyle = '#4a4668';
      T.fitText(g, NAMES.company, x + 124, y + 56, 370, 66, F.sans, 900);
      g.fillStyle = '#d9718f'; T.fitText(g, 'SAKURAGAWA RAILWAY', x + 128, y + 104, 360, 24, F.en, 700);
    }
    // --- 弱冷房車
    {
      const [x, y, w, h] = R.jakurei;
      g.fillStyle = '#7fb3d9'; rr(T, g, x + 6, y + 14, w - 12, h - 28, 16); g.fill();
      g.fillStyle = '#ffffff'; g.textAlign = 'center'; g.textBaseline = 'middle';
      T.fitText(g, '弱冷房車', x + w / 2, y + 54, w - 40, 46, F.sans, 900);
      T.fitText(g, 'Mild A/C Car', x + w / 2, y + 92, w - 60, 20, F.en, 700);
    }
    // --- priority seat strip: 優先席 + elderly / injured / pregnant / child
    {
      const [x, y, w, h] = R.priority;
      g.fillStyle = '#fbf6ee'; rr(T, g, x + 4, y + 4, w - 8, h - 8, 14); g.fill();
      g.fillStyle = '#ee8a3c'; rr(T, g, x + 4, y + 4, 150, h - 8, 14); g.fill();
      g.fillStyle = '#ffffff'; g.textAlign = 'center'; g.textBaseline = 'middle';
      T.fitText(g, '優先席', x + 79, y + 54, 130, 40, F.sans, 900);
      T.fitText(g, 'Priority Seat', x + 79, y + 92, 130, 18, F.en, 700);
      const icons = [{ bend: 1, cane: true }, { crutch: true }, { belly: true }, { child: true }];
      icons.forEach((o, i) => {
        const cx = x + 205 + i * 84, cy = y + h / 2;
        g.fillStyle = '#ee8a3c'; g.beginPath(); g.arc(cx, cy, 36, 0, Math.PI * 2); g.fill();
        if (o.child) { person(g, cx - 10, cy + 26, 58, '#ffffff', { hand: [cx + 8, cy - 2] }); person(g, cx + 14, cy + 26, 34, '#ffffff'); }
        else person(g, cx, cy + 27, 60, '#ffffff', o);
      });
    }
    // --- wheelchair / stroller stickers (blue)
    for (const [key, fn] of [['wheelchair', wheelchairIcon], ['stroller', strollerIcon]]) {
      const [x, y, w, h] = R[key];
      g.fillStyle = '#2f64b5'; rr(T, g, x + 6, y + 6, w - 12, h - 12, 14); g.fill();
      g.strokeStyle = '#ffffff'; g.lineWidth = 4; rr(T, g, x + 12, y + 12, w - 24, h - 24, 10); g.stroke();
      fn(g, x + w / 2, y + h / 2 - 4, 84, '#ffffff');
    }
    // --- door caution sticker (手をはさまないように)
    {
      const [x, y, w] = R.doorCaution; const cx = x + w / 2, cy = y + w / 2;
      g.fillStyle = '#ffffff'; g.beginPath(); g.arc(cx, cy, 58, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#e8545f'; g.lineWidth = 8; g.beginPath(); g.arc(cx, cy, 53, 0, Math.PI * 2); g.stroke();
      g.fillStyle = '#f2b6a0'; // hand
      g.beginPath(); g.ellipse(cx - 12, cy + 6, 18, 22, -0.3, 0, Math.PI * 2); g.fill();
      for (let k = 0; k < 4; k++) { g.beginPath(); g.ellipse(cx + 6 + k * 2, cy - 14 + k * 9, 16, 5, 0.15, 0, Math.PI * 2); g.fill(); }
      g.fillStyle = '#6d7480'; g.fillRect(cx + 20, cy - 34, 10, 66); g.fillRect(cx + 32, cy - 34, 10, 66);
      g.fillStyle = '#e8545f'; g.textAlign = 'center'; g.textBaseline = 'middle'; T.fitText(g, 'ドアにご注意', cx, cy + 40, 84, 14, F.sans, 900);
    }
    // --- mascot sticker (さくらちゃん)
    {
      const [x, y, w] = R.mascot; const cx = x + w / 2, cy = y + w / 2 + 6;
      g.fillStyle = '#ffffff'; g.beginPath(); g.arc(cx, cy - 4, 58, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#f6c3d3'; g.beginPath(); g.arc(cx, cy, 44, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#e57aa1'; sakuraPath(g, cx + 22, cy - 38, 20, 0.3); g.fill();
      g.fillStyle = '#3f3a4a'; g.beginPath(); g.arc(cx - 15, cy - 2, 5, 0, Math.PI * 2); g.arc(cx + 15, cy - 2, 5, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#3f3a4a'; g.lineWidth = 3; g.beginPath(); g.arc(cx, cy + 8, 8, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke();
      g.fillStyle = 'rgba(232,110,140,0.55)'; g.beginPath(); g.ellipse(cx - 27, cy + 10, 8, 5, 0, 0, Math.PI * 2); g.ellipse(cx + 27, cy + 10, 8, 5, 0, 0, Math.PI * 2); g.fill();
    }
    // --- kids (こどもの手をはなさないで)
    {
      const [x, y, w] = R.kids; const cx = x + w / 2, cy = y + w / 2;
      g.fillStyle = '#f7d65a'; rr(T, g, x + 8, y + 8, w - 16, w - 16, 18); g.fill();
      person(g, cx - 14, cy + 30, 66, '#4a4668', { hand: [cx + 6, cy + 2] });
      person(g, cx + 18, cy + 30, 40, '#4a4668');
      g.fillStyle = '#4a4668'; g.textAlign = 'center'; g.textBaseline = 'middle'; T.fitText(g, 'おこさまの手を', cx, y + 22, 100, 13, F.sans, 900);
    }
    // --- interior signs
    {
      let [x, y, w, h] = R.prioritySign;
      g.fillStyle = '#ee8a3c'; g.fillRect(x, y, w, h); g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
      T.fitText(g, '優先席  Priority Seat', x + w / 2, y + h / 2 + 2, w - 20, 34, F.sans, 900);
      [x, y, w, h] = R.crewSign;
      g.fillStyle = '#3c4660'; g.fillRect(x, y, w, h); g.fillStyle = '#fff';
      T.fitText(g, '乗務員室  Crew Only', x + w / 2, y + h / 2 + 2, w - 20, 32, F.sans, 700);
      [x, y, w, h] = R.emergency;
      g.fillStyle = '#d9463b'; rr(T, g, x + 4, y + 4, w - 8, h - 8, 8); g.fill(); g.fillStyle = '#fff';
      T.fitText(g, '非常用ドアコック', x + w / 2, y + 26, w - 16, 16, F.sans, 900); T.fitText(g, 'EMERGENCY', x + w / 2, y + 46, w - 24, 12, F.en, 700);
      [x, y, w, h] = R.plate;
      g.fillStyle = '#c9c3b4'; rr(T, g, x + 4, y + 8, w - 8, h - 16, 6); g.fill(); g.fillStyle = '#4a4552';
      T.fitText(g, '桜川車輌 2019', x + w / 2, y + 26, w - 16, 14, F.sans, 700); T.fitText(g, '桜ヶ丘工場', x + w / 2, y + 42, w - 24, 12, F.sans, 500);
      [x, y, w, h] = R.jumperWarn;
      g.fillStyle = '#f2c230'; g.fillRect(x + 4, y + 8, w - 8, h - 16); g.fillStyle = '#3a3346'; T.fitText(g, '高圧注意', x + w / 2, y + h / 2 + 1, w - 20, 24, F.sans, 900);
    }
    // --- route map strip (above doors, inside)
    {
      const [x, y, w, h] = R.routeMap;
      g.fillStyle = '#fbf8f2'; g.fillRect(x, y, w, h);
      g.fillStyle = '#ef9fbe'; g.fillRect(x, y, w, 26); g.fillStyle = '#fff'; g.textAlign = 'left'; g.textBaseline = 'middle';
      T.fitText(g, '桜川線  Sakuragawa Line', x + 10, y + 14, w - 20, 18, F.sans, 900);
      const st = [['川辺', 'SK05'], ['花見台', 'SK06'], ['桜ヶ丘', 'SK07'], ['春日野', 'SK08'], ['城山', 'SK09']];
      g.fillStyle = '#ef9fbe'; g.fillRect(x + 24, y + 62, w - 48, 8);
      st.forEach(([n, no], i) => {
        const sx = x + 34 + i * ((w - 68) / 4);
        g.fillStyle = i === 2 ? '#d9718f' : '#ffffff'; g.strokeStyle = '#d9718f'; g.lineWidth = 4;
        g.beginPath(); g.arc(sx, y + 66, 9, 0, Math.PI * 2); g.fill(); g.stroke();
        g.fillStyle = '#3f3a4a'; g.textAlign = 'center'; T.fitText(g, n, sx, y + 94, 70, 18, F.sans, 700);
        g.fillStyle = '#8a8494'; T.fitText(g, no, sx, y + 114, 60, 12, F.en, 700);
      });
    }
    // --- car numbers
    const nums = [...CAR_NUMBERS.A, ...CAR_NUMBERS.B, 'クハ' + CAR_NUMBERS.A[0], 'モハ' + CAR_NUMBERS.A[1], 'クハ' + CAR_NUMBERS.B[0], 'モハ' + CAR_NUMBERS.B[1]];
    nums.forEach((s, i) => {
      const [x, y, w, h] = R['num' + i];
      g.fillStyle = '#433d52'; g.textAlign = 'center'; g.textBaseline = 'middle';
      T.fitText(g, s, x + w / 2, y + h / 2 + 3, w - 16, 52, i < 4 ? F.en : F.sans, 700);
    });
    // --- window-top ads
    const ads = [
      { bg: '#f7d3de', fg: '#b84a72', t: 'お花見きっぷ', s: '桜川線 1日乗り放題 ¥800', deco: 'sakura' },
      { bg: '#d6ead0', fg: '#3f7a52', t: '花見台植物園', s: 'さくらまつり 4/1〜4/15', deco: 'leaf' },
      { bg: '#d4e4f2', fg: '#35609a', t: '春日野温泉郷', s: '日帰り入浴プラン 好評', deco: 'wave' },
      { bg: '#f6e7b0', fg: '#9a6a1f', t: 'さくら進学ゼミ', s: '新学期生 募集中！', deco: 'star' },
      { bg: '#f3dcc6', fg: '#8a5234', t: '桜あんぱん', s: '桜ヶ丘ベーカリー 駅前店', deco: 'bun' },
      { bg: '#e2ecf4', fg: '#3c5a82', t: '車内マナー', s: '通話はご遠慮ください', deco: 'phone' },
    ];
    ads.forEach((a, i) => {
      const [x, y, w, h] = R['ad' + i];
      g.fillStyle = a.bg; g.fillRect(x + 3, y + 3, w - 6, h - 6);
      g.strokeStyle = '#ffffff'; g.lineWidth = 5; g.strokeRect(x + 10, y + 10, w - 20, h - 20);
      g.fillStyle = a.fg; g.globalAlpha = 0.25;
      if (a.deco === 'sakura') { for (let k = 0; k < 5; k++) { sakuraPath(g, x + 30 + k * 50, y + 132 - (k % 2) * 16, 16, k); g.fill(); } }
      else { for (let k = 0; k < 4; k++) { g.beginPath(); g.arc(x + 200 + k * 9, y + 50 + k * 22, 26 - k * 4, 0, Math.PI * 2); g.fill(); } }
      g.globalAlpha = 1;
      g.fillStyle = a.fg; g.textAlign = 'left'; g.textBaseline = 'middle';
      T.fitText(g, a.t, x + 22, y + 60, w - 44, 40, F.sans, 900);
      g.fillStyle = '#4a4552'; T.fitText(g, a.s, x + 22, y + 104, w - 44, 20, F.sans, 700);
    });
    // --- hanging posters (中吊り)
    const hangs = [
      { bg: '#fbf1f4', fg: '#c65a82', t: '季刊 さくら文庫', s: '春の新刊フェア 4月号' },
      { bg: '#eef5fb', fg: '#2f64b5', t: '春の交通安全運動', s: '4月6日〜15日 桜ヶ丘警察署' },
      { bg: '#f5f3e4', fg: '#6f8a3a', t: 'かすがの動物園', s: 'レッサーパンダの赤ちゃん誕生' },
      { bg: '#fdf0e6', fg: '#d9718f', t: 'SAKURA PASS', s: 'ICカードでスムーズにご乗車' },
    ];
    hangs.forEach((a, i) => {
      const [x, y, w, h] = R['hang' + i];
      g.fillStyle = a.bg; g.fillRect(x + 2, y + 2, w - 4, h - 4);
      g.fillStyle = a.fg; g.fillRect(x + 2, y + 2, 16, h - 4);
      g.textAlign = 'left'; g.textBaseline = 'middle';
      T.fitText(g, a.t, x + 30, y + 48, w - 44, 34, F.sans, 900);
      g.fillStyle = '#4a4552'; T.fitText(g, a.s, x + 30, y + 90, w - 44, 18, F.sans, 700);
    });
    // --- gangway door (end wall) & cab back panel
    {
      let [x, y, w, h] = R.gangway;
      g.fillStyle = '#d9d6cf'; g.fillRect(x, y, w, h);
      g.fillStyle = '#6f7f8c'; rr(T, g, x + 26, y + 14, w - 52, 56, 6); g.fill();
      g.fillStyle = '#bcc3c7'; g.fillRect(x + w - 30, y + 80, 8, 26);
      [x, y, w, h] = R.cabPanel;
      g.fillStyle = '#4b5565'; g.fillRect(x, y, w, h);
      g.fillStyle = '#293140'; rr(T, g, x + 8, y + 10, 70, 44, 5); g.fill(); rr(T, g, x + 84, y + 10, 36, 44, 5); g.fill();
      const cols = ['#e8545f', '#f2c230', '#8fd1c1', '#ffffff'];
      for (let k = 0; k < 8; k++) { g.fillStyle = cols[k % 4]; g.beginPath(); g.arc(x + 14 + k * 14, y + 76, 4, 0, Math.PI * 2); g.fill(); }
      g.fillStyle = '#9aa1a8'; g.fillRect(x + 10, y + 96, 108, 18);
    }
  }, { key: 'trains.decal', anisotropy: 8 });

  const led = T.draw(LED_W, LED_H, (g) => {
    g.fillStyle = '#0d0806'; g.fillRect(0, 0, LED_W, LED_H);
    const R = LED_RECTS;
    const AMBER = '#ffa033', ORANGE = '#ff7a2a', GREEN = '#7dff9a';
    const dest = (rect, kanji, en) => {
      const [x, y, w, h] = rect;
      g.fillStyle = '#000'; g.fillRect(x, y, w, h);
      // type box 普通 (local) — in green, as on many lines
      g.strokeStyle = GREEN; g.lineWidth = 6; g.strokeRect(x + 12, y + 16, 128, h - 32);
      g.fillStyle = GREEN; g.textAlign = 'center'; g.textBaseline = 'middle';
      T.fitText(g, '普通', x + 76, y + 56, 110, 56, F.sans, 900);
      T.fitText(g, 'Local', x + 76, y + 96, 100, 22, F.en, 900);
      g.fillStyle = AMBER;
      T.fitText(g, kanji, x + 330, y + 54, 330, 76, F.sans, 900);
      T.fitText(g, en, x + 330, y + 104, 300, 24, F.en, 900);
      ledify(g, x, y, w, h, 4);
    };
    dest(R.destA, '花見台', 'Hanamidai');
    dest(R.destB, '春日野', 'Kasugano');
    const side = (rect, kanji) => {
      const [x, y, w, h] = rect;
      g.fillStyle = '#000'; g.fillRect(x, y, w, h);
      g.fillStyle = GREEN; g.textAlign = 'center'; g.textBaseline = 'middle';
      T.fitText(g, '普通', x + 60, y + h / 2 + 2, 96, 44, F.sans, 900);
      g.fillStyle = AMBER; T.fitText(g, kanji + ' 行', x + 238, y + h / 2 + 2, 250, 48, F.sans, 900);
      ledify(g, x, y, w, h, 4);
    };
    side(R.sideA, '花見台'); side(R.sideB, '春日野');
    const run = (rect, s) => {
      const [x, y, w, h] = rect; g.fillStyle = '#000'; g.fillRect(x, y, w, h);
      g.fillStyle = ORANGE; g.textAlign = 'center'; g.textBaseline = 'middle'; T.fitText(g, s, x + w / 2, y + h / 2 + 2, w - 12, 50, F.en, 900);
      ledify(g, x, y, w, h, 4);
    };
    run(R.runA, '1215'); run(R.runB, '1308');
    const lcd = (rect, kanji, en) => {
      const [x, y, w, h] = rect;
      g.fillStyle = '#16233e'; g.fillRect(x, y, w, h);
      g.fillStyle = '#ef9fbe'; g.fillRect(x, y + h - 8, w, 8);
      g.fillStyle = '#cfd8ea'; g.textAlign = 'left'; g.textBaseline = 'middle'; T.fitText(g, '次は', x + 10, y + 26, 50, 20, F.sans, 700);
      g.fillStyle = '#ffffff'; T.fitText(g, kanji, x + 62, y + 26, 110, 34, F.sans, 900);
      g.fillStyle = '#9fb3d6'; T.fitText(g, en, x + 176, y + 28, 74, 16, F.en, 700);
    };
    lcd(R.lcdA, '花見台', 'Hanamidai'); lcd(R.lcdB, '春日野', 'Kasugano');
    const cab = (rect, hue) => {
      const [x, y, w, h] = rect; g.fillStyle = '#0c1a2a'; g.fillRect(x, y, w, h);
      g.strokeStyle = hue; g.lineWidth = 3; g.beginPath(); g.arc(x + 32, y + 36, 20, Math.PI * 0.8, Math.PI * 2.2); g.stroke();
      g.fillStyle = hue; for (let k = 0; k < 5; k++) g.fillRect(x + 64 + k * 11, y + 50 - k * 7, 7, 8 + k * 7);
    };
    cab(R.cab, '#7de0ff'); cab(R.cab2, '#9dffb0');
  }, { key: 'trains.led', anisotropy: 8 });

  const petal = T.draw(64, 64, (g) => {
    g.clearRect(0, 0, 64, 64);
    g.fillStyle = '#ffffff';
    g.beginPath(); g.moveTo(32, 60);
    g.bezierCurveTo(6, 44, 8, 12, 26, 5); g.lineTo(32, 12); g.lineTo(38, 5); g.bezierCurveTo(56, 12, 58, 44, 32, 60); g.fill();
  }, { key: 'trains.petal' });

  const dec = (k) => toUV(DEC_RECTS[k], DEC_W, DEC_H);
  const ledUV = (k) => toUV(LED_RECTS[k], LED_W, LED_H);
  return { decal, led, petal, dec, ledUV };
}
