// Station canvas textures: tiling surfaces + sign / poster / info atlases + foliage cards.
// All text is natural Japanese; all brands are fictional (桜川電鉄, さくらパス …).
import { makeAtlas } from './util.js';

export const INK = { navy: '#223c6a', navy2: '#34507e', pink: '#ef9fbe', pinkDeep: '#d9718f', paper: '#ecebe6', cream: '#ebe4d4', ink: '#34303f', grey: '#7d7b86', yellow: '#efc53c', red: '#cf4a44', green: '#3f8f5b', blue: '#3a6fb8', sky: '#9cc4ea' };

// Stations of the 桜川線 (fictional). SK07 = this station.
export const LINE = [
  ['SK01', '桜川', 'さくらがわ', 'Sakuragawa'], ['SK02', '本町', 'ほんまち', 'Hommachi'], ['SK03', '緑ヶ丘', 'みどりがおか', 'Midorigaoka'],
  ['SK04', '梅見坂', 'うめみざか', 'Umemizaka'], ['SK05', '若葉', 'わかば', 'Wakaba'], ['SK06', '花見台', 'はなみだい', 'Hanamidai'],
  ['SK07', '桜ヶ丘', 'さくらがおか', 'Sakuragaoka'], ['SK08', '春日野', 'かすがの', 'Kasugano'], ['SK09', '雲雀野', 'ひばりの', 'Hibarino'],
  ['SK10', '東山口', 'ひがしやまぐち', 'Higashi-Yamaguchi'], ['SK11', '若菜', 'わかな', 'Wakana'], ['SK12', '山桜', 'やまざくら', 'Yamazakura'],
];
const FARES = [290, 260, 230, 200, 170, 140, 0, 140, 170, 200, 230, 260];

export function createStationTextures(ctx) {
  const T = ctx.tex, F = T.FONTS;
  const rr = (g, x, y, w, h, r) => T.roundRect(g, x, y, w, h, r);
  function txt(g, s, x, y, size, color, o = {}) {
    g.fillStyle = color; g.textAlign = o.align || 'center'; g.textBaseline = o.base || 'middle';
    const font = o.font || F.sans, weight = o.weight || 700;
    if (o.maxW) T.fitText(g, s, x, y, o.maxW, size, font, weight);
    else { g.font = `${weight} ${size}px ${font}`; g.fillText(s, x, y); }
  }
  function spaced(g, s, x, y, size, color, gap, o = {}) { // letter-spaced centred text
    g.font = `${o.weight || 700} ${size}px ${o.font || F.sans}`;
    const chars = [...s]; const ws = chars.map(c => g.measureText(c).width);
    const total = ws.reduce((a, b) => a + b, 0) + gap * (chars.length - 1);
    let xx = x - total / 2; g.fillStyle = color; g.textAlign = 'left'; g.textBaseline = 'middle';
    chars.forEach((c, i) => { g.fillText(c, xx, y); xx += ws[i] + gap; });
  }
  const tri = (g, x, y, s, dir, color) => { g.fillStyle = color; g.beginPath(); g.moveTo(x + dir * s, y); g.lineTo(x - dir * s * 0.6, y - s * 0.85); g.lineTo(x - dir * s * 0.6, y + s * 0.85); g.closePath(); g.fill(); };
  const blossom = (g, x, y, r, c1 = INK.pink, c2 = '#fbe3ea') => {
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + i * Math.PI * 2 / 5;
      g.save(); g.translate(x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55); g.rotate(a + Math.PI / 2);
      g.fillStyle = c1; g.beginPath(); g.ellipse(0, 0, r * 0.36, r * 0.52, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = c2; g.beginPath(); g.moveTo(0, -r * 0.52); g.lineTo(-r * 0.08, -r * 0.36); g.lineTo(r * 0.08, -r * 0.36); g.fill();
      g.restore();
    }
    g.fillStyle = '#f7d36a'; g.beginPath(); g.arc(x, y, r * 0.16, 0, Math.PI * 2); g.fill();
  };
  // wraps a feature so tiling textures stay seamless
  const wrap = (W, H, fn) => { for (const dx of [-W, 0, W]) for (const dy of [-H, 0, H]) fn(dx, dy); };

  // ------------------------------------------------------------------ tiling surfaces
  const concrete = T.draw(1024, 512, (g, W, H) => { // 8 m × 4 m of platform concrete
    const r = ctx.rng('st-concrete');
    g.fillStyle = '#cbcac3'; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 70; i++) { // soft wash
      const x = r() * W, y = r() * H, rx = 30 + r() * 140, ry = 20 + r() * 90, a = 0.025 + r() * 0.04;
      const c = r() < 0.5 ? `rgba(120,118,130,${a})` : `rgba(255,252,240,${a})`;
      wrap(W, H, (dx, dy) => { g.fillStyle = c; g.beginPath(); g.ellipse(x + dx, y + dy, rx, ry, r() * 3, 0, Math.PI * 2); g.fill(); });
    }
    for (let i = 0; i < 5; i++) { // repair patches (colour differences)
      const x = r() * W, y = r() * H, w = 50 + r() * 120, h = 30 + r() * 80;
      const c = r() < 0.5 ? 'rgba(178,176,168,0.55)' : 'rgba(214,212,204,0.6)';
      wrap(W, H, (dx, dy) => { g.fillStyle = c; g.fillRect(x + dx, y + dy, w, h); g.strokeStyle = 'rgba(120,118,112,0.25)'; g.lineWidth = 1; g.strokeRect(x + dx, y + dy, w, h); });
    }
    for (let i = 0; i < 16; i++) { // rain / puddle stains
      const x = r() * W, y = r() * H;
      wrap(W, H, (dx, dy) => {
        g.fillStyle = 'rgba(128,126,138,0.07)';
        for (let j = 0; j < 5; j++) { g.beginPath(); g.ellipse(x + dx + (r() - 0.5) * 40, y + dy + (r() - 0.5) * 20, 12 + r() * 30, 6 + r() * 14, r(), 0, Math.PI * 2); g.fill(); }
      });
    }
    g.strokeStyle = 'rgba(96,94,100,0.38)'; g.lineWidth = 1.2; // cracks
    for (let i = 0; i < 9; i++) {
      let x = r() * W, y = r() * H; const pts = [[x, y]]; let a = r() * 6.28;
      for (let j = 0; j < 7; j++) { a += (r() - 0.5) * 1.2; x += Math.cos(a) * (8 + r() * 16); y += Math.sin(a) * (8 + r() * 16); pts.push([x, y]); }
      wrap(W, H, (dx, dy) => { g.beginPath(); pts.forEach(([px, py], j) => (j ? g.lineTo(px + dx, py + dy) : g.moveTo(px + dx, py + dy))); g.stroke(); });
    }
    for (let i = 0; i < 520; i++) { g.fillStyle = r() < 0.5 ? 'rgba(90,88,96,0.16)' : 'rgba(255,255,248,0.2)'; g.fillRect(r() * W, r() * H, 1 + r() * 2, 1 + r() * 2); }
    for (let i = 0; i < 14; i++) { g.fillStyle = 'rgba(80,78,86,0.22)'; g.beginPath(); g.arc(r() * W, r() * H, 1.5 + r() * 2.5, 0, 7); g.fill(); } // gum spots
    // expansion joints every 2 m
    g.fillStyle = 'rgba(112,110,112,0.55)';
    for (let x = 0; x < W; x += 256) g.fillRect(x, 0, 2, H);
    g.fillRect(0, 0, W, 2); g.fillRect(0, 256, W, 1.5);
  }, { key: 'st-concrete', repeat: [1, 1] });

  const tactileDot = T.draw(128, 128, (g, W) => {
    g.fillStyle = '#e3b93a'; g.fillRect(0, 0, W, W);
    g.fillStyle = 'rgba(150,110,20,0.35)'; g.fillRect(0, 0, W, 2); g.fillRect(0, 0, 2, W);
    for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) {
      const x = 13 + i * 25.5, y = 13 + j * 25.5;
      g.fillStyle = 'rgba(140,100,20,0.45)'; g.beginPath(); g.arc(x + 1.5, y + 2, 8.5, 0, 7); g.fill();
      g.fillStyle = '#f0cb52'; g.beginPath(); g.arc(x, y, 8, 0, 7); g.fill();
      g.fillStyle = 'rgba(255,245,200,0.7)'; g.beginPath(); g.arc(x - 2.5, y - 2.5, 3, 0, 7); g.fill();
    }
  }, { key: 'st-tactile-dot', repeat: [1, 1] });
  const tactileLine = T.draw(128, 128, (g, W) => {
    g.fillStyle = '#e3b93a'; g.fillRect(0, 0, W, W);
    g.fillStyle = 'rgba(150,110,20,0.35)'; g.fillRect(0, 0, W, 2); g.fillRect(0, 0, 2, W);
    for (let i = 0; i < 4; i++) {
      const x = 16 + i * 32;
      g.fillStyle = 'rgba(140,100,20,0.45)'; rr(g, x - 8, 8, 18, W - 14, 8); g.fill();
      g.fillStyle = '#f0cb52'; rr(g, x - 9, 6, 17, W - 14, 8); g.fill();
      g.fillStyle = 'rgba(255,245,200,0.6)'; g.fillRect(x - 6, 12, 3, W - 26);
    }
  }, { key: 'st-tactile-line', repeat: [1, 1] });

  const floorTile = T.draw(512, 512, (g, W) => { // 2.4 m of 30 cm floor tiles
    const r = ctx.rng('st-floor');
    const cols = ['#d9d3c4', '#d4cebf', '#dcd6c8', '#d1cbbd'];
    for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) {
      g.fillStyle = cols[(i * 3 + j * 5 + (r() < 0.3 ? 1 : 0)) % 4]; g.fillRect(i * 64, j * 64, 64, 64);
      for (let s = 0; s < 6; s++) { g.fillStyle = `rgba(120,110,100,${0.05 + r() * 0.06})`; g.fillRect(i * 64 + r() * 60, j * 64 + r() * 60, 2 + r() * 5, 1 + r() * 3); }
    }
    g.fillStyle = '#b3ab9b'; for (let i = 0; i <= 8; i++) { g.fillRect(i * 64 - 1, 0, 2, W); g.fillRect(0, i * 64 - 1, W, 2); }
    for (let i = 0; i < 26; i++) { g.fillStyle = 'rgba(110,100,95,0.06)'; g.beginPath(); g.ellipse(r() * W, r() * W, 20 + r() * 60, 10 + r() * 30, r() * 3, 0, 7); g.fill(); }
  }, { key: 'st-floor', repeat: [1, 1] });

  const plaster = T.draw(512, 512, (g, W, H) => { // neutral hand-painted plaster wash (tinted by material colour)
    const r = ctx.rng('st-plaster');
    g.fillStyle = '#e9e9e9'; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 60; i++) {
      const x = r() * W, y = r() * H, rx = 20 + r() * 90, ry = 14 + r() * 60;
      const c = r() < 0.55 ? `rgba(150,140,150,${0.03 + r() * 0.04})` : `rgba(255,255,250,${0.05 + r() * 0.05})`;
      wrap(W, H, (dx, dy) => { g.fillStyle = c; g.beginPath(); g.ellipse(x + dx, y + dy, rx, ry, r() * 3, 0, 7); g.fill(); });
    }
    for (let i = 0; i < 40; i++) { // trowel strokes
      const x = r() * W, y = r() * H, l = 30 + r() * 70, a = (r() - 0.5) * 0.5;
      wrap(W, H, (dx, dy) => { g.strokeStyle = `rgba(255,255,255,${0.08 + r() * 0.08})`; g.lineWidth = 3 + r() * 5; g.beginPath(); g.moveTo(x + dx, y + dy); g.lineTo(x + dx + Math.cos(a) * l, y + dy + Math.sin(a) * l); g.stroke(); });
    }
    g.strokeStyle = 'rgba(110,100,110,0.22)'; g.lineWidth = 1;
    for (let i = 0; i < 4; i++) { let x = r() * W, y = r() * H; g.beginPath(); g.moveTo(x, y); for (let j = 0; j < 5; j++) { x += (r() - 0.5) * 22; y += 6 + r() * 12; g.lineTo(x, y); } g.stroke(); }
  }, { key: 'st-plaster', repeat: [1, 1] });

  const stoneTile = T.draw(512, 512, (g, W) => { // retaining-wall cladding, 2 m tile, running bond
    const r = ctx.rng('st-stone');
    const cols = ['#b8b1a4', '#c2bbad', '#aea799', '#bdb3a2', '#c7c0b3'];
    g.fillStyle = '#8f887d'; g.fillRect(0, 0, W, W);
    const rowH = 64, tw = 128;
    for (let j = 0; j < 8; j++) {
      const off = (j % 2) * tw / 2;
      for (let i = -1; i < 5; i++) {
        const x = i * tw + off, y = j * rowH;
        g.fillStyle = cols[Math.floor(r() * cols.length)]; g.fillRect(x + 2, y + 2, tw - 4, rowH - 4);
        g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(x + 2, y + 2, tw - 4, 3);
        for (let s = 0; s < 8; s++) { g.fillStyle = `rgba(90,85,80,${0.06 + r() * 0.08})`; g.fillRect(x + r() * tw, y + r() * rowH, 2 + r() * 6, 1 + r() * 3); }
      }
    }
  }, { key: 'st-stone', repeat: [1, 1] });

  const paving = T.draw(512, 512, (g, W) => { // forecourt / terrace pavers, 2.4 m tile
    const r = ctx.rng('st-paving');
    const cols = ['#cfcbc2', '#c7c3ba', '#d6d2c9', '#c2beb6', '#d0c8bd'];
    g.fillStyle = '#a7a39b'; g.fillRect(0, 0, W, W);
    for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) {
      g.fillStyle = cols[Math.floor(r() * cols.length)]; g.fillRect(i * 64 + 1.5, j * 64 + 1.5, 61, 61);
      if (r() < 0.2) { g.fillStyle = 'rgba(120,115,110,0.1)'; g.fillRect(i * 64 + 2, j * 64 + 2, 60, 60); }
    }
    for (let i = 0; i < 30; i++) { g.fillStyle = 'rgba(100,95,100,0.06)'; g.beginPath(); g.ellipse(r() * W, r() * W, 15 + r() * 50, 8 + r() * 30, r() * 3, 0, 7); g.fill(); }
  }, { key: 'st-paving', repeat: [1, 1] });

  const rubber = T.draw(256, 256, (g, W) => { // walkway boards (1.25 m)
    const r = ctx.rng('st-rubber');
    g.fillStyle = '#6b6862'; g.fillRect(0, 0, W, W);
    for (let i = 0; i < 16; i++) { g.fillStyle = i % 2 ? '#625f5a' : '#716e68'; g.fillRect(0, i * 16, W, 9); }
    g.fillStyle = '#4f4c49'; g.fillRect(0, 0, W, 3); g.fillRect(0, 0, 3, W); g.fillRect(126, 0, 3, W);
    for (let i = 0; i < 160; i++) { g.fillStyle = `rgba(230,225,215,${r() * 0.12})`; g.fillRect(r() * W, r() * W, 2, 2); }
  }, { key: 'st-rubber', repeat: [1, 1] });

  const gravel = T.draw(256, 256, (g, W) => { // 1.5 m of fine gravel
    const r = ctx.rng('st-gravel');
    g.fillStyle = '#b3aa9b'; g.fillRect(0, 0, W, W);
    const cols = ['#c9c0b1', '#a1998b', '#bfb6a6', '#948d82', '#d3cabb'];
    for (let i = 0; i < 1400; i++) {
      const x = r() * W, y = r() * W, s = 1.5 + r() * 3.5; g.fillStyle = cols[Math.floor(r() * cols.length)];
      wrap(W, W, (dx, dy) => { g.beginPath(); g.ellipse(x + dx, y + dy, s, s * 0.75, r() * 3, 0, 7); g.fill(); });
    }
  }, { key: 'st-gravel', repeat: [1, 1] });

  const grassTex = T.draw(256, 256, (g, W) => { // 2 m lawn / weed ground
    const r = ctx.rng('st-grass');
    g.fillStyle = '#97b873'; g.fillRect(0, 0, W, W);
    for (let i = 0; i < 70; i++) { const x = r() * W, y = r() * W, c = r() < 0.5 ? 'rgba(110,150,90,0.25)' : 'rgba(190,210,130,0.22)'; wrap(W, W, (dx, dy) => { g.fillStyle = c; g.beginPath(); g.ellipse(x + dx, y + dy, 10 + r() * 30, 6 + r() * 18, r() * 3, 0, 7); g.fill(); }); }
    for (let i = 0; i < 900; i++) { const x = r() * W, y = r() * W; g.strokeStyle = r() < 0.5 ? 'rgba(90,130,70,0.5)' : 'rgba(200,220,150,0.45)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 3, y - 3 - r() * 4); g.stroke(); }
  }, { key: 'st-grass', repeat: [1, 1] });

  const soil = T.draw(256, 256, (g, W) => { // flower-bed soil 1.5 m
    const r = ctx.rng('st-soil');
    g.fillStyle = '#8e7760'; g.fillRect(0, 0, W, W);
    for (let i = 0; i < 700; i++) { g.fillStyle = r() < 0.5 ? 'rgba(70,55,45,0.3)' : 'rgba(170,150,120,0.3)'; const x = r() * W, y = r() * W; g.fillRect(x, y, 2 + r() * 3, 1 + r() * 2); }
  }, { key: 'st-soil', repeat: [1, 1] });

  // soft rain-streak / grime decal (alpha): dark at top, fading down, streaky
  const streaks = T.draw(256, 256, (g, W, H) => {
    const r = ctx.rng('st-streaks');
    g.clearRect(0, 0, W, H);
    for (let i = 0; i < 40; i++) {
      const x = 8 + r() * (W - 16), l = H * (0.3 + r() * 0.65), w = 3 + r() * 10;
      const gr = g.createLinearGradient(0, 0, 0, l); gr.addColorStop(0, 'rgba(90,86,100,0.55)'); gr.addColorStop(1, 'rgba(90,86,100,0)');
      g.fillStyle = gr; g.fillRect(x, 0, w, l);
    }
  }, { key: 'st-streaks' });
  const wireMesh = T.draw(128, 128, (g, W) => { // green diamond wire mesh (alpha)
    g.clearRect(0, 0, W, W); g.strokeStyle = '#ffffff'; g.lineWidth = 5;
    for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(i * 64, 0); g.lineTo(i * 64 + 128, 128); g.stroke(); g.beginPath(); g.moveTo(i * 64 + 128, 0); g.lineTo(i * 64, 128); g.stroke(); }
  }, { key: 'st-wiremesh', repeat: [1, 1] });
  const grime = T.draw(256, 128, (g, W, H) => { // bottom-of-wall splash grime / moss
    const r = ctx.rng('st-grime');
    g.clearRect(0, 0, W, H);
    const gr = g.createLinearGradient(0, H, 0, 0); gr.addColorStop(0, 'rgba(96,100,82,0.55)'); gr.addColorStop(1, 'rgba(96,100,82,0)');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(110,130,80,${0.1 + r() * 0.2})`; g.beginPath(); g.ellipse(r() * W, H - r() * 40, 4 + r() * 12, 2 + r() * 6, 0, 0, 7); g.fill(); }
  }, { key: 'st-grime' });

  // ------------------------------------------------------------------ SIGNS atlas (platform)
  function ekimeihyo(g, W, H, left, right) {
    g.fillStyle = '#9aa0a8'; rr(g, 0, 0, W, H, 20); g.fill();
    g.fillStyle = '#eeede9'; rr(g, 6, 6, W - 12, H - 12, 16); g.fill();
    txt(g, '桜川電鉄  桜川線', 36, 34, 22, INK.grey, { align: 'left', weight: 500 });
    g.fillStyle = INK.pinkDeep; g.fillRect(36, 50, 110, 5);
    // station number box
    g.strokeStyle = INK.pinkDeep; g.lineWidth = 9; rr(g, 168, 64, 104, 104, 14); g.stroke();
    txt(g, 'SK', 220, 92, 28, INK.navy, { weight: 700 }); txt(g, '07', 220, 138, 52, INK.navy, { weight: 900 });
    txt(g, '桜ヶ丘', W / 2 + 30, 124, 138, INK.navy, { weight: 900, maxW: 520 });
    spaced(g, 'さくらがおか', W / 2 + 30, 212, 40, INK.navy, 14, { weight: 700, font: F.round });
    spaced(g, 'Sakuragaoka', W / 2 + 30, 250, 30, '#4f5f7c', 5, { weight: 500, font: F.en });
    // line colour stripe
    g.fillStyle = INK.pink; g.fillRect(6, 270, W - 12, 26);
    g.fillStyle = INK.pinkDeep; g.fillRect(6, 270, W - 12, 4); g.fillRect(6, 292, W - 12, 4);
    // neighbours
    const side = (st, dir) => {
      const x = dir < 0 ? 34 : W - 34;
      tri(g, x + dir * 4, 283, 13, dir, '#ffffff');
      const al = dir < 0 ? 'left' : 'right', tx = dir < 0 ? 40 : W - 40;
      txt(g, st.kana, tx, 322, 38, INK.navy, { align: al, weight: 700, font: F.round });
      txt(g, `${st.kanji}  ${st.en}`, tx, 350, 20, INK.grey, { align: al, weight: 500 });
      g.strokeStyle = INK.pinkDeep; g.lineWidth = 3;
      const bx = dir < 0 ? 300 : W - 300 - 66; rr(g, bx, 306, 66, 30, 6); g.stroke();
      txt(g, st.no, bx + 33, 322, 19, INK.navy, { weight: 700 });
    };
    side(left, -1); side(right, 1);
  }
  const N = ctx.L.NAMES;
  const prev = N.prev, next = N.next;
  function platSign(g, W, H, no, dest, en) {
    g.fillStyle = '#2b4574'; rr(g, 0, 0, W, H, 10); g.fill();
    g.fillStyle = '#eeede9'; g.beginPath(); g.arc(64, H / 2, 44, 0, 7); g.fill();
    txt(g, String(no), 64, H / 2 + 3, 64, '#2b4574', { weight: 900 });
    txt(g, '番線', 150, H / 2 + 2, 34, '#f1efe9', { weight: 700 });
    txt(g, dest, 350, H / 2 - 14, 34, '#f1efe9', { weight: 700, maxW: 300 });
    txt(g, en, 350, H / 2 + 28, 18, '#c9d3e6', { weight: 500, maxW: 300 });
    g.fillStyle = INK.pink; g.fillRect(0, H - 8, W, 8);
  }
  const signs = makeAtlas(ctx, 'st-atlas-signs', 1024, [
    { id: 'ekiN', w: 1016, h: 360, draw: (g, w, h) => ekimeihyo(g, w, h, prev, next) },   // read looking north: west (花見台) on the left
    { id: 'ekiS', w: 1016, h: 360, draw: (g, w, h) => ekimeihyo(g, w, h, next, prev) },   // read looking south: east (春日野) on the left
    { id: 'plat1', w: 500, h: 128, draw: (g, w, h) => platSign(g, w, h, 1, '花見台・桜川 方面', 'for Hanamidai / Sakuragawa') },
    { id: 'plat2', w: 500, h: 128, draw: (g, w, h) => platSign(g, w, h, 2, '春日野・山桜 方面', 'for Kasugano / Yamazakura') },
    { id: 'exitL', w: 500, h: 128, draw: (g, w, h) => { // 出口 (yellow) arrow pointing left
      g.fillStyle = '#f0c63a'; rr(g, 0, 0, w, h, 10); g.fill();
      g.fillStyle = '#2f2c34'; g.beginPath(); g.moveTo(26, h / 2); g.lineTo(76, h / 2 - 34); g.lineTo(76, h / 2 - 14); g.lineTo(120, h / 2 - 14); g.lineTo(120, h / 2 + 14); g.lineTo(76, h / 2 + 14); g.lineTo(76, h / 2 + 34); g.fill();
      txt(g, '出口', 230, h / 2 - 10, 58, '#2f2c34', { weight: 900 });
      txt(g, 'Exit', 230, h / 2 + 38, 22, '#2f2c34', { weight: 700 });
      txt(g, '改札口', 400, h / 2 - 12, 34, '#2f2c34', { weight: 700 }); txt(g, 'Ticket Gate', 400, h / 2 + 26, 18, '#2f2c34', { weight: 500 });
    } },
    { id: 'toTrack2', w: 500, h: 128, draw: (g, w, h) => {
      g.fillStyle = '#2b4574'; rr(g, 0, 0, w, h, 10); g.fill();
      txt(g, '2番線 春日野・山桜 方面', 210, h / 2 - 20, 30, '#f1efe9', { weight: 700, maxW: 380 });
      txt(g, '構内踏切をお渡りください  Track 2 via crossing', 210, h / 2 + 22, 17, '#c9d3e6', { weight: 500, maxW: 380 });
      g.fillStyle = '#f1efe9'; g.beginPath(); g.moveTo(w - 62, 16); g.lineTo(w - 24, 60); g.lineTo(w - 48, 60); g.lineTo(w - 48, 110); g.lineTo(w - 76, 110); g.lineTo(w - 76, 60); g.lineTo(w - 100, 60); g.fill();
      g.fillStyle = INK.pink; g.fillRect(0, h - 8, w, 8);
    } },
  ]);

  // ------------------------------------------------------------------ FACADE / small signs atlas
  function clockFace(g, W) {
    const c = W / 2;
    g.fillStyle = '#eeede8'; g.beginPath(); g.arc(c, c, c - 2, 0, 7); g.fill();
    for (let i = 0; i < 60; i++) {
      const a = i / 60 * Math.PI * 2, big = i % 5 === 0;
      g.strokeStyle = big ? '#2d3550' : '#6c7088'; g.lineWidth = big ? 6 : 2;
      g.beginPath(); g.moveTo(c + Math.sin(a) * (c - 10), c - Math.cos(a) * (c - 10)); g.lineTo(c + Math.sin(a) * (c - (big ? 30 : 18)), c - Math.cos(a) * (c - (big ? 30 : 18))); g.stroke();
    }
    for (let i = 1; i <= 12; i++) { const a = i / 12 * Math.PI * 2; txt(g, String(i), c + Math.sin(a) * (c - 52), c - Math.cos(a) * (c - 52) + 2, 26, '#2d3550', { weight: 700 }); }
    txt(g, '桜川電鉄', c, c + 44, 15, INK.pinkDeep, { weight: 700 });
    blossom(g, c, c - 42, 12);
  }
  const faceItems = [
    { id: 'nameBoard', w: 1016, h: 160, draw: (g, W, H) => {
      g.fillStyle = '#ece6d8'; g.fillRect(0, 0, W, H);
      g.strokeStyle = '#4a4550'; g.lineWidth = 6; g.strokeRect(3, 3, W - 6, H - 6);
      g.fillStyle = INK.pink; g.beginPath(); g.arc(86, H / 2, 54, 0, 7); g.fill();
      blossom(g, 86, H / 2, 46, '#fbe7ee', '#ffffff');
      txt(g, '桜ヶ丘駅', 395, H / 2 + 6, 112, INK.navy, { weight: 700, font: F.serif, maxW: 470 });
      spaced(g, 'さくらがおか', 812, 46, 36, INK.navy, 6, { weight: 700, font: F.round });
      spaced(g, 'SAKURAGAOKA STATION', 812, 92, 24, '#4f5f7c', 3, { weight: 700, font: F.en });
      g.fillStyle = INK.pink; g.fillRect(672, 116, 280, 5);
      txt(g, '桜川電鉄  桜川線', 812, 140, 22, INK.grey, { weight: 500 });
    } },
    { id: 'clock', w: 256, h: 256, draw: (g, w) => clockFace(g, w) },
    { id: 'ticketHead', w: 500, h: 96, draw: (g, w, h) => {
      g.fillStyle = '#2b4574'; g.fillRect(0, 0, w, h);
      txt(g, 'きっぷ・ICチャージ', w / 2 - 40, h / 2 - 10, 38, '#f4f2ec', { weight: 700 });
      txt(g, 'Tickets / IC Card Charge', w / 2 - 40, h / 2 + 26, 17, '#c9d3e6', { weight: 500 });
      g.fillStyle = INK.pink; g.fillRect(w - 70, 20, 50, 56); txt(g, 'IC', w - 45, h / 2 + 2, 30, '#ffffff', { weight: 900 });
    } },
    { id: 'windowSign', w: 500, h: 96, draw: (g, w, h) => {
      g.fillStyle = '#e9e5da'; g.fillRect(0, 0, w, h); g.fillStyle = '#2b4574'; g.fillRect(0, 0, 14, h);
      txt(g, '駅務室  窓口', w / 2, h / 2 - 12, 38, INK.navy, { weight: 700 });
      txt(g, 'きっぷ・定期券・お忘れ物のご相談', w / 2, h / 2 + 26, 19, INK.ink, { weight: 500 });
    } },
    { id: 'fareAdj', w: 500, h: 96, draw: (g, w, h) => {
      g.fillStyle = '#2b4574'; g.fillRect(0, 0, w, h);
      txt(g, 'のりこし精算機', w / 2, h / 2 - 12, 38, '#f4f2ec', { weight: 700 }); txt(g, 'Fare Adjustment', w / 2, h / 2 + 26, 17, '#c9d3e6', { weight: 500 });
      g.fillStyle = INK.pink; g.fillRect(0, h - 6, w, 6);
    } },
    { id: 'exitUp', w: 500, h: 128, draw: (g, w, h) => { // 出口 (yellow) arrow straight ahead
      g.fillStyle = '#f0c63a'; rr(g, 0, 0, w, h, 10); g.fill();
      g.fillStyle = '#2f2c34'; g.beginPath(); g.moveTo(70, 18); g.lineTo(108, 62); g.lineTo(84, 62); g.lineTo(84, 110); g.lineTo(56, 110); g.lineTo(56, 62); g.lineTo(32, 62); g.fill();
      txt(g, '出口', 220, h / 2 - 10, 58, '#2f2c34', { weight: 900 });
      txt(g, 'Exit', 220, h / 2 + 38, 22, '#2f2c34', { weight: 700 });
      txt(g, '駅前広場・バス', 395, h / 2 - 12, 28, '#2f2c34', { weight: 700 }); txt(g, 'Station Square / Bus', 395, h / 2 + 26, 16, '#2f2c34', { weight: 500 });
    } },
    { id: 'gateSign', w: 1016, h: 110, draw: (g, w, h) => {
      g.fillStyle = '#2b4574'; g.fillRect(0, 0, w, h);
      txt(g, '改札口', 120, h / 2 - 8, 46, '#f4f2ec', { weight: 700 }); txt(g, 'Ticket Gate', 120, h / 2 + 32, 18, '#c9d3e6', { weight: 500 });
      g.fillStyle = '#eeede9'; g.beginPath(); g.arc(300, h / 2, 30, 0, 7); g.fill(); txt(g, '1', 300, h / 2 + 2, 40, '#2b4574', { weight: 900 });
      txt(g, '花見台・桜川 方面', 470, h / 2 - 12, 30, '#f4f2ec', { weight: 700 }); txt(g, 'for Hanamidai / Sakuragawa', 470, h / 2 + 24, 16, '#c9d3e6', { weight: 500 });
      g.fillStyle = '#eeede9'; g.beginPath(); g.arc(660, h / 2, 30, 0, 7); g.fill(); txt(g, '2', 660, h / 2 + 2, 40, '#2b4574', { weight: 900 });
      txt(g, '春日野・山桜 方面', 830, h / 2 - 12, 30, '#f4f2ec', { weight: 700 }); txt(g, 'for Kasugano / Yamazakura', 830, h / 2 + 24, 16, '#c9d3e6', { weight: 500 });
      g.fillStyle = INK.pink; g.fillRect(0, h - 7, w, 7);
    } },
    { id: 'depBoard', w: 512, h: 170, draw: (g, w, h) => { // 発車標 (LED look)
      g.fillStyle = '#1c1b22'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#2d2c36'; g.fillRect(0, 0, w, 36);
      txt(g, '発車時刻  Departures', w / 2, 19, 20, '#dfe3ee', { weight: 500 });
      const row = (y, col, typ, time, dest, trk) => {
        txt(g, typ, 48, y, 28, '#8fe39a', { weight: 700 });
        txt(g, time, 150, y, 30, col, { weight: 700 });
        txt(g, dest, 310, y, 28, col, { weight: 700 });
        txt(g, trk, 460, y, 26, '#f5e7a0', { weight: 700 });
      };
      row(78, '#ffb36b', '普通', '16:08', '花見台・桜川', '1番線');
      row(126, '#ffb36b', '普通', '16:12', '春日野・山桜', '2番線');
      g.fillStyle = 'rgba(0,0,0,0.25)'; for (let y = 38; y < h; y += 4) g.fillRect(0, y, w, 1);
    } },
    { id: 'keepOut', w: 256, h: 190, draw: (g, w, h) => {
      g.fillStyle = '#eeede9'; g.fillRect(0, 0, w, h); g.fillStyle = INK.red; g.fillRect(0, 0, w, 58);
      txt(g, '危 険', w / 2, 30, 40, '#ffffff', { weight: 900 });
      txt(g, '立入禁止', w / 2, 96, 48, INK.red, { weight: 900 });
      txt(g, 'KEEP OUT', w / 2, 138, 22, INK.ink, { weight: 700 });
      txt(g, '桜川電鉄', w / 2, 170, 18, INK.grey, { weight: 500 });
    } },
    { id: 'staffOnly', w: 256, h: 96, draw: (g, w, h) => {
      g.fillStyle = '#eeede9'; g.fillRect(0, 0, w, h); g.fillStyle = INK.red; g.fillRect(0, 0, w, 8);
      txt(g, '関係者以外', w / 2, 36, 30, INK.red, { weight: 900 }); txt(g, '立入禁止', w / 2, 72, 30, INK.red, { weight: 900 });
    } },
    { id: 'crossWarn', w: 256, h: 330, draw: (g, w, h) => { // 構内踏切 sign
      g.fillStyle = '#f0c63a'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#2f2c34'; for (let i = -2; i < 12; i++) { g.beginPath(); g.moveTo(i * 36, 0); g.lineTo(i * 36 + 18, 0); g.lineTo(i * 36 - 22, 30); g.lineTo(i * 36 - 40, 30); g.fill(); }
      g.fillStyle = '#eeede9'; g.fillRect(12, 42, w - 24, h - 54);
      txt(g, '構内踏切', w / 2, 80, 38, INK.ink, { weight: 900 });
      txt(g, '列車に注意', w / 2, 142, 44, INK.red, { weight: 900 });
      txt(g, '左右確認', w / 2, 204, 44, INK.red, { weight: 900 });
      txt(g, '← 左 右 →', w / 2, 256, 28, INK.ink, { weight: 700 });
      txt(g, '桜ヶ丘駅長', w / 2, 298, 18, INK.grey, { weight: 500 });
    } },
    { id: 'toilet', w: 500, h: 110, draw: (g, w, h) => {
      g.fillStyle = '#e9e5da'; g.fillRect(0, 0, w, h);
      txt(g, 'お手洗い', 150, h / 2 - 12, 42, INK.ink, { weight: 700 }); txt(g, 'Toilet', 150, h / 2 + 30, 20, INK.grey, { weight: 500 });
      const person = (x, col, skirt) => { g.fillStyle = col; g.beginPath(); g.arc(x, 30, 11, 0, 7); g.fill(); g.beginPath(); if (skirt) { g.moveTo(x - 16, 82); g.lineTo(x + 16, 82); g.lineTo(x + 7, 44); g.lineTo(x - 7, 44); } else g.rect(x - 11, 44, 22, 38); g.fill(); g.fillRect(x - 8, 82, 6, 18); g.fillRect(x + 2, 82, 6, 18); };
      person(330, '#3a6fb8', false); person(385, '#cf4a44', true);
      g.fillStyle = '#3f8f5b'; rr(g, 420, 18, 64, 74, 8); g.fill(); g.strokeStyle = '#ffffff'; g.lineWidth = 5; g.beginPath(); g.arc(452, 64, 18, 0.3, 5.2); g.stroke(); g.fillStyle = '#ffffff'; g.beginPath(); g.arc(452, 34, 7, 0, 7); g.fill();
    } },
    { id: 'wcMen', w: 96, h: 96, draw: (g, w) => { g.fillStyle = '#3a6fb8'; g.fillRect(0, 0, w, w); g.fillStyle = '#fff'; g.beginPath(); g.arc(48, 22, 10, 0, 7); g.fill(); g.fillRect(36, 36, 24, 32); g.fillRect(38, 68, 8, 20); g.fillRect(50, 68, 8, 20); } },
    { id: 'wcWomen', w: 96, h: 96, draw: (g, w) => { g.fillStyle = '#cf4a44'; g.fillRect(0, 0, w, w); g.fillStyle = '#fff'; g.beginPath(); g.arc(48, 22, 10, 0, 7); g.fill(); g.beginPath(); g.moveTo(30, 72); g.lineTo(66, 72); g.lineTo(56, 36); g.lineTo(40, 36); g.fill(); g.fillRect(40, 72, 6, 16); g.fillRect(50, 72, 6, 16); } },
    { id: 'wcMulti', w: 96, h: 96, draw: (g, w) => { g.fillStyle = '#3f8f5b'; g.fillRect(0, 0, w, w); g.strokeStyle = '#fff'; g.lineWidth = 6; g.beginPath(); g.arc(46, 60, 20, 0.4, 5.1); g.stroke(); g.fillStyle = '#fff'; g.beginPath(); g.arc(46, 20, 8, 0, 7); g.fill(); g.fillRect(42, 30, 8, 22); g.fillRect(42, 48, 26, 7); } },
    { id: 'autoDoor', w: 160, h: 48, draw: (g, w, h) => { g.fillStyle = 'rgba(60,60,70,0.85)'; rr(g, 0, 0, w, h, 8); g.fill(); txt(g, '自動ドア', w / 2, h / 2 + 1, 26, '#f4f2ec', { weight: 700 }); } },
    { id: 'icPad', w: 96, h: 96, draw: (g, w) => {
      g.fillStyle = '#3d82c9'; g.beginPath(); g.arc(48, 48, 46, 0, 7); g.fill(); g.strokeStyle = '#bfe0ff'; g.lineWidth = 3;
      for (const rr_ of [20, 30, 40]) { g.beginPath(); g.arc(48, 48, rr_, -0.8, 0.8); g.stroke(); }
      txt(g, 'IC', 36, 50, 30, '#ffffff', { weight: 900 });
    } },
    { id: 'gateGo', w: 64, h: 64, draw: (g, w) => { g.fillStyle = '#1e2a26'; g.fillRect(0, 0, w, w); g.fillStyle = '#6ff09a'; g.beginPath(); g.moveTo(32, 8); g.lineTo(56, 34); g.lineTo(40, 34); g.lineTo(40, 56); g.lineTo(24, 56); g.lineTo(24, 34); g.lineTo(8, 34); g.fill(); } },
    { id: 'gateNo', w: 64, h: 64, draw: (g, w) => { g.fillStyle = '#2a1e22'; g.fillRect(0, 0, w, w); g.strokeStyle = '#ff6a6a'; g.lineWidth = 9; g.beginPath(); g.moveTo(14, 14); g.lineTo(50, 50); g.moveTo(50, 14); g.lineTo(14, 50); g.stroke(); } },
    { id: 'gateLabel', w: 160, h: 48, draw: (g, w, h) => { g.fillStyle = '#4b5060'; g.fillRect(0, 0, w, h); txt(g, 'IC専用', w / 2, h / 2 + 1, 26, '#f6d86a', { weight: 700 }); } },
    { id: 'gateLabel2', w: 160, h: 48, draw: (g, w, h) => { g.fillStyle = '#4b5060'; g.fillRect(0, 0, w, h); txt(g, 'きっぷ・IC', w / 2, h / 2 + 1, 24, '#f4f2ec', { weight: 700 }); } },
    { id: 'mannedGate', w: 256, h: 80, draw: (g, w, h) => { g.fillStyle = '#e9e5da'; g.fillRect(0, 0, w, h); g.fillStyle = INK.green; g.fillRect(0, 0, w, 10); txt(g, '有人改札', w / 2, 38, 30, INK.ink, { weight: 700 }); txt(g, 'きっぷ回収・精算・車いす', w / 2, 64, 16, INK.grey, { weight: 500 }); } },
    { id: 'northExit', w: 500, h: 128, draw: (g, w, h) => {
      g.fillStyle = '#2b4574'; rr(g, 0, 0, w, h, 10); g.fill();
      txt(g, '北口', 120, h / 2 - 8, 56, '#f4f2ec', { weight: 900 }); txt(g, 'North Exit', 120, h / 2 + 36, 18, '#c9d3e6', { weight: 500 });
      txt(g, 'IC専用改札', 350, h / 2 - 16, 32, '#f6d86a', { weight: 700 }); txt(g, 'きっぷのお客さまは南口へ', 350, h / 2 + 24, 20, '#f4f2ec', { weight: 500 });
      g.fillStyle = INK.pink; g.fillRect(0, h - 8, w, 8);
    } },
    { id: 'stopPos', w: 128, h: 160, draw: (g, w, h) => { g.fillStyle = '#2f2c34'; g.fillRect(0, 0, w, h); g.fillStyle = '#f0c63a'; g.fillRect(8, 8, w - 16, h - 16); txt(g, '2', w / 2, 70, 92, '#2f2c34', { weight: 900 }); txt(g, '両 停止位置', w / 2, 136, 20, '#2f2c34', { weight: 700 }); } },
    { id: 'equipLabel', w: 160, h: 64, draw: (g, w, h) => { g.fillStyle = '#e9e5da'; g.fillRect(0, 0, w, h); txt(g, '信号通信機器箱', w / 2, 24, 18, INK.ink, { weight: 700 }); txt(g, '桜川電鉄 電気区  No.07-3', w / 2, 48, 12, INK.grey, { weight: 500 }); } },
    { id: 'platNo1', w: 96, h: 96, draw: (g, w) => { g.fillStyle = '#2b4574'; g.fillRect(0, 0, w, w); g.fillStyle = '#eeede9'; g.beginPath(); g.arc(48, 44, 30, 0, 7); g.fill(); txt(g, '1', 48, 46, 44, '#2b4574', { weight: 900 }); txt(g, '番線', 48, 86, 14, '#eeede9', { weight: 700 }); } },
    { id: 'platNo2', w: 96, h: 96, draw: (g, w) => { g.fillStyle = '#2b4574'; g.fillRect(0, 0, w, w); g.fillStyle = '#eeede9'; g.beginPath(); g.arc(48, 44, 30, 0, 7); g.fill(); txt(g, '2', 48, 46, 44, '#2b4574', { weight: 900 }); txt(g, '番線', 48, 86, 14, '#eeede9', { weight: 700 }); } },
    { id: 'welcome', w: 256, h: 128, draw: (g, w, h) => { g.fillStyle = '#b48a62'; rr(g, 0, 0, w, h, 16); g.fill(); g.fillStyle = '#ecdcc0'; rr(g, 8, 8, w - 16, h - 16, 12); g.fill(); txt(g, 'ようこそ', w / 2, 40, 30, '#8a4a52', { weight: 700, font: F.hand }); txt(g, '桜ヶ丘駅へ', w / 2, 84, 34, '#5a4032', { weight: 700, font: F.hand }); blossom(g, 30, 30, 12); blossom(g, w - 30, h - 30, 12); } },
    { id: 'gardenSign', w: 256, h: 110, draw: (g, w, h) => { g.fillStyle = '#ecdcc0'; g.fillRect(0, 0, w, h); txt(g, '駅の花壇', w / 2, 30, 30, '#4d6457', { weight: 700, font: F.round }); txt(g, 'お手入れ：桜ヶ丘小学校', w / 2, 66, 17, '#5a4032', { weight: 500 }); txt(g, '緑化委員会のみなさん', w / 2, 90, 17, '#5a4032', { weight: 500 }); } },
    { id: 'bikeNotice', w: 200, h: 140, draw: (g, w, h) => { g.fillStyle = '#eeede9'; g.fillRect(0, 0, w, h); g.fillStyle = INK.red; g.fillRect(0, 0, w, 30); txt(g, 'おねがい', w / 2, 16, 20, '#ffffff', { weight: 700 }); txt(g, 'ここに自転車を', w / 2, 58, 22, INK.ink, { weight: 700 }); txt(g, 'とめないでください', w / 2, 88, 22, INK.ink, { weight: 700 }); txt(g, '桜ヶ丘駅・桜ヶ丘町', w / 2, 122, 14, INK.grey, { weight: 500 }); } },
    { id: 'gateBack', w: 1016, h: 100, draw: (g, w, h) => { g.fillStyle = '#e9e6dc'; g.fillRect(0, 0, w, h); g.fillStyle = INK.pink; g.fillRect(0, h - 10, w, 10); txt(g, 'ご乗車ありがとうございました', 340, h / 2 - 5, 42, INK.navy, { weight: 700, maxW: 620 }); txt(g, 'Thank you for riding the Sakuragawa Line', 676, h / 2 - 4, 20, INK.grey, { weight: 500, align: 'left', maxW: 320 }); } },
    { id: 'wheelPlaque', w: 256, h: 112, draw: (g, w, h) => { g.fillStyle = '#6a5a48'; rr(g, 0, 0, w, h, 8); g.fill(); g.fillStyle = '#d9c9a4'; rr(g, 6, 6, w - 12, h - 12, 6); g.fill(); txt(g, '動輪の記念碑', w / 2, 30, 26, '#4a3a2c', { weight: 700, font: F.serif }); txt(g, 'モハ100形 旧桜川線を走った電車の車輪', w / 2, 62, 14, '#5a4a3a', { weight: 500 }); txt(g, '昭和三十二年～平成八年', w / 2, 86, 14, '#5a4a3a', { weight: 500 }); } },
    { id: 'staffBike', w: 256, h: 72, draw: (g, w, h) => { g.fillStyle = '#eeede9'; g.fillRect(0, 0, w, h); g.fillStyle = INK.navy; g.fillRect(0, 0, w, 14); txt(g, '職員用駐輪場', w / 2, 38, 26, INK.ink, { weight: 700 }); txt(g, '関係者以外の駐輪はご遠慮ください', w / 2, 60, 12, INK.grey, { weight: 500 }); } },
    { id: 'tapSign', w: 128, h: 64, draw: (g, w, h) => { g.fillStyle = '#e9e5da'; g.fillRect(0, 0, w, h); g.fillStyle = INK.blue; g.fillRect(0, 0, 10, h); txt(g, '水飲み・手洗い', w / 2 + 5, 24, 15, INK.ink, { weight: 700 }); txt(g, '節水にご協力を', w / 2 + 5, 46, 12, INK.grey, { weight: 500 }); } },
    { id: 'shedLabel', w: 160, h: 48, draw: (g, w, h) => { g.fillStyle = '#e9e5da'; g.fillRect(0, 0, w, h); txt(g, '駅 用具入れ', w / 2, h / 2 + 1, 22, INK.ink, { weight: 700 }); } },
    { id: 'shoeMat', w: 256, h: 128, draw: (g, w, h) => { g.fillStyle = '#56545c'; rr(g, 0, 0, w, h, 10); g.fill(); g.strokeStyle = '#6d6b74'; g.lineWidth = 3; for (let x = 12; x < w; x += 12) { g.beginPath(); g.moveTo(x, 10); g.lineTo(x, h - 10); g.stroke(); } txt(g, 'SAKURAGAOKA', w / 2, h / 2, 26, '#8e8b96', { weight: 700 }); } },
  ];

  // ------------------------------------------------------------------ POSTERS atlas
  const posterItems = [
    { id: 'sakuraFest', w: 250, h: 354, draw: (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#f7d6e0'); gr.addColorStop(1, '#bfdcf0'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
      const r = ctx.rng('p-fest');
      for (let i = 0; i < 26; i++) blossom(g, r() * w, r() * 150, 8 + r() * 12, r() < 0.5 ? '#f2b5c8' : '#fbe3ea', '#ffffff');
      g.fillStyle = '#8a6a5e'; g.fillRect(0, 150, w, 6);
      g.fillStyle = '#f5f0e6'; rr(g, 30, 190, 190, 40, 12); g.fill(); g.fillStyle = INK.pink; g.fillRect(30, 212, 190, 8); // little train
      g.fillStyle = '#9cc4ea'; for (let i = 0; i < 5; i++) g.fillRect(42 + i * 34, 196, 22, 12);
      txt(g, '桜ヶ丘', w / 2, 262, 34, '#8a3a52', { weight: 900, font: F.round }); txt(g, 'さくらまつり', w / 2, 298, 32, '#c2456e', { weight: 900, font: F.round });
      txt(g, '4月4日(土)・5日(日)  会場：桜川堤', w / 2, 326, 14, INK.ink, { weight: 700, maxW: 230 });
      txt(g, '夜桜ライトアップ 18:00〜21:00 / 桜川電鉄', w / 2, 344, 11, INK.grey, { weight: 500, maxW: 230 });
    } },
    { id: 'safety', w: 250, h: 354, draw: (g, w, h) => {
      g.fillStyle = '#e8eef4'; g.fillRect(0, 0, w, h); g.fillStyle = '#3a6fb8'; g.fillRect(0, 0, w, 70);
      txt(g, 'ホームでの', w / 2, 24, 22, '#ffffff', { weight: 700 }); txt(g, '歩きスマホは危険です', w / 2, 52, 22, '#ffffff', { weight: 900, maxW: 230 });
      g.fillStyle = '#c6c5be'; g.fillRect(0, 230, w, 30); g.fillStyle = '#e3b93a'; g.fillRect(0, 222, w, 10); g.fillStyle = '#6c6e73'; g.fillRect(0, 260, w, 16);
      g.fillStyle = '#34507e'; g.beginPath(); g.arc(120, 110, 18, 0, 7); g.fill(); g.fillRect(104, 128, 32, 60); g.fillRect(106, 188, 10, 36); g.fillRect(124, 188, 10, 36);
      g.fillStyle = '#9cc4ea'; g.fillRect(138, 130, 14, 22);
      g.strokeStyle = INK.red; g.lineWidth = 8; g.beginPath(); g.arc(125, 160, 72, 0, 7); g.stroke(); g.beginPath(); g.moveTo(74, 109); g.lineTo(176, 211); g.stroke();
      txt(g, '黄色い線の内側で', w / 2, 300, 20, INK.ink, { weight: 700 }); txt(g, 'お待ちください', w / 2, 326, 20, INK.ink, { weight: 700 });
      txt(g, '桜川電鉄', w / 2, 346, 12, INK.grey, { weight: 500 });
    } },
    { id: 'festival', w: 250, h: 354, draw: (g, w, h) => {
      g.fillStyle = '#f1e7d3'; g.fillRect(0, 0, w, h); g.fillStyle = '#b8403a'; g.fillRect(0, 0, w, 16); g.fillRect(0, h - 16, w, 16);
      for (let i = 0; i < 5; i++) { const x = 30 + i * 47; g.strokeStyle = '#5a4032'; g.lineWidth = 1; g.beginPath(); g.moveTo(x, 16); g.lineTo(x, 34); g.stroke(); g.fillStyle = '#e25b4b'; g.beginPath(); g.ellipse(x, 52, 14, 19, 0, 0, 7); g.fill(); g.fillStyle = '#2f2c34'; g.fillRect(x - 8, 32, 16, 4); g.fillRect(x - 8, 68, 16, 4); }
      T.verticalText(g, '春の例大祭', 190, 90, 40, F.brush, 400);
      txt(g, '桜ヶ丘町', 80, 110, 26, '#5a4032', { weight: 700, font: F.serif });
      txt(g, '神輿渡御', 80, 160, 30, '#b8403a', { weight: 700, font: F.serif });
      txt(g, '4月19日(日)', 80, 210, 22, INK.ink, { weight: 700 }); txt(g, '午前10時〜', 80, 238, 18, INK.ink, { weight: 500 });
      txt(g, '子ども神輿・露店あり', w / 2, 300, 16, INK.ink, { weight: 700 }); txt(g, '主催 桜ヶ丘町内会', w / 2, 326, 14, INK.grey, { weight: 500 });
    } },
    { id: 'stampRally', w: 250, h: 354, draw: (g, w, h) => {
      g.fillStyle = '#fff1d6'; g.fillRect(0, 0, w, h); g.fillStyle = '#8fd1c1'; g.fillRect(0, 0, w, 90);
      txt(g, '桜川線', w / 2, 28, 24, '#2d5b52', { weight: 900, font: F.round }); txt(g, '春のスタンプラリー', w / 2, 62, 25, '#2d5b52', { weight: 900, font: F.round, maxW: 236 });
      for (let i = 0; i < 12; i++) { const x = 34 + (i % 4) * 60, y = 124 + Math.floor(i / 4) * 56; g.strokeStyle = i === 6 ? INK.pinkDeep : '#c9b89a'; g.lineWidth = 3; g.beginPath(); g.arc(x, y, 22, 0, 7); g.stroke(); if (i === 6 || i < 3) { g.fillStyle = 'rgba(217,113,143,0.35)'; g.beginPath(); g.arc(x, y, 18, 0, 7); g.fill(); } txt(g, LINE[i][1], x, y + 1, 12, INK.ink, { weight: 700, maxW: 40 }); }
      txt(g, '全12駅のスタンプを', w / 2, 300, 18, INK.ink, { weight: 700 }); txt(g, 'あつめて記念品をもらおう！', w / 2, 326, 17, '#c2456e', { weight: 700, maxW: 236 });
    } },
    { id: 'manners', w: 250, h: 354, draw: (g, w, h) => {
      g.fillStyle = '#f4f0e6'; g.fillRect(0, 0, w, h); g.fillStyle = '#f0c63a'; g.fillRect(0, 0, w, 80);
      txt(g, 'かけこみ乗車は', w / 2, 28, 24, '#2f2c34', { weight: 900 }); txt(g, 'おやめください', w / 2, 60, 24, '#2f2c34', { weight: 900 });
      g.fillStyle = '#f5f0e6'; g.fillRect(40, 110, 170, 140); g.fillStyle = '#8e959d'; g.fillRect(120, 110, 10, 140); g.fillStyle = INK.pink; g.fillRect(40, 200, 170, 12);
      g.fillStyle = '#34507e'; g.beginPath(); g.arc(90, 150, 14, 0, 7); g.fill(); g.fillRect(78, 164, 24, 44); g.save(); g.translate(96, 210); g.rotate(0.6); g.fillRect(0, 0, 9, 36); g.restore(); g.save(); g.translate(80, 210); g.rotate(-0.5); g.fillRect(0, 0, 9, 36); g.restore();
      txt(g, 'ドアにはさまれると', w / 2, 284, 18, INK.ink, { weight: 700 }); txt(g, '大変危険です', w / 2, 310, 18, INK.ink, { weight: 700 }); txt(g, '桜川電鉄', w / 2, 340, 12, INK.grey, { weight: 500 });
    } },
    { id: 'hanamiMap', w: 354, h: 250, draw: (g, w, h) => {
      g.fillStyle = '#f3efe2'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#a8cbe6'; g.beginPath(); g.moveTo(0, 30); g.bezierCurveTo(120, 10, 240, 60, w, 34); g.lineTo(w, 62); g.bezierCurveTo(240, 88, 120, 38, 0, 58); g.fill();
      g.strokeStyle = '#8e959d'; g.lineWidth = 5; g.beginPath(); g.moveTo(0, 120); g.lineTo(w, 120); g.stroke(); g.strokeStyle = INK.pink; g.lineWidth = 2; g.beginPath(); g.moveTo(0, 120); g.lineTo(w, 120); g.stroke();
      g.strokeStyle = '#cbc3b2'; g.lineWidth = 8; g.beginPath(); g.moveTo(175, 124); g.bezierCurveTo(170, 180, 190, 210, 200, h); g.stroke();
      const r = ctx.rng('p-hanami');
      for (let i = 0; i < 18; i++) blossom(g, 10 + i * 19 + r() * 6, 70 + r() * 10, 7);
      for (let i = 0; i < 6; i++) blossom(g, 150 + r() * 70, 140 + r() * 90, 7);
      g.fillStyle = INK.red; g.beginPath(); g.arc(178, 118, 7, 0, 7); g.fill(); txt(g, '桜ヶ丘駅', 222, 108, 13, INK.ink, { weight: 700 });
      txt(g, '桜川堤 桜並木 約1.2km', 120, 92, 12, '#8a3a52', { weight: 700 });
      txt(g, '神社', 260, 190, 12, INK.ink, { weight: 700 }); g.fillStyle = '#c94a3a'; g.fillRect(252, 168, 16, 10);
      g.fillStyle = 'rgba(255,255,255,0.8)'; rr(g, 8, 186, 138, 56, 8); g.fill();
      txt(g, 'さくら散歩マップ', 77, 204, 16, '#c2456e', { weight: 900, font: F.round }); txt(g, '見ごろ 3月下旬〜4月上旬', 77, 228, 11, INK.ink, { weight: 500 });
    } },
    { id: 'lostFound', w: 250, h: 176, draw: (g, w, h) => {
      g.fillStyle = '#eeede9'; g.fillRect(0, 0, w, h); g.fillStyle = '#2b4574'; g.fillRect(0, 0, w, 44);
      txt(g, 'お忘れ物に', w / 2 - 20, 22, 22, '#ffffff', { weight: 700 }); g.fillStyle = '#f0c63a'; g.beginPath(); g.arc(214, 22, 15, 0, 7); g.fill(); txt(g, '!', 214, 23, 22, '#2f2c34', { weight: 900 });
      txt(g, 'ご注意ください', w / 2, 70, 24, INK.navy, { weight: 900 });
      txt(g, '傘・スマートフォン・定期券など', w / 2, 102, 13, INK.ink, { weight: 500 });
      txt(g, 'お忘れ物のお問い合わせは', w / 2, 128, 14, INK.ink, { weight: 700 }); txt(g, '駅係員までお申し出ください', w / 2, 150, 14, INK.ink, { weight: 700 });
      txt(g, '桜川電鉄 お客さまセンター', w / 2, 169, 10, INK.grey, { weight: 500 });
    } },
    { id: 'noSmoking', w: 176, h: 176, draw: (g, w) => {
      g.fillStyle = '#eeede9'; g.fillRect(0, 0, w, w);
      g.fillStyle = '#6d6b74'; g.fillRect(40, 64, 90, 18); g.fillStyle = '#e8a26a'; g.fillRect(120, 64, 12, 18);
      g.strokeStyle = INK.red; g.lineWidth = 11; g.beginPath(); g.arc(88, 72, 52, 0, 7); g.stroke(); g.beginPath(); g.moveTo(51, 35); g.lineTo(125, 109); g.stroke();
      txt(g, '禁煙', w / 2, 142, 30, INK.red, { weight: 900 }); txt(g, '駅構内・ホームは全面禁煙', w / 2, 166, 12, INK.ink, { weight: 700 });
    } },
    { id: 'drawings', w: 500, h: 270, draw: (g, w, h) => { // children's drawings board
      g.fillStyle = '#d9c7a4'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#f4efe0'; g.fillRect(90, 6, 320, 34); txt(g, 'わたしのすきな さくらがおか', w / 2, 20, 20, '#c2456e', { weight: 700, font: F.hand }); txt(g, '〜 桜ヶ丘小学校 2年生 〜', w / 2, 36, 11, INK.ink, { weight: 500 });
      const r = ctx.rng('p-draw');
      for (let i = 0; i < 6; i++) {
        const x = 12 + (i % 3) * 162, y = 50 + Math.floor(i / 3) * 110;
        g.save(); g.translate(x + 75, y + 50); g.rotate((r() - 0.5) * 0.08); g.translate(-75, -50);
        g.fillStyle = ['#fbf6e8', '#f1f6fb', '#fdf0f2', '#f6f7ea', '#fbf3e6', '#eef6f1'][i]; g.fillRect(0, 0, 150, 100);
        g.lineWidth = 4; g.lineCap = 'round';
        g.strokeStyle = '#8ec4ea'; g.beginPath(); g.moveTo(4, 12); g.lineTo(146, 8); g.stroke();
        if (i % 2 === 0) { // train
          g.fillStyle = '#f7f2e4'; g.strokeStyle = '#555'; g.lineWidth = 2; rr(g, 16, 40, 118, 34, 10); g.fill(); g.stroke();
          g.fillStyle = '#ef8fb0'; g.fillRect(18, 60, 114, 6); g.fillStyle = '#7fb6e0'; for (let k = 0; k < 4; k++) g.fillRect(26 + k * 26, 46, 16, 10);
          g.fillStyle = '#555'; g.beginPath(); g.arc(40, 78, 6, 0, 7); g.arc(110, 78, 6, 0, 7); g.fill();
        } else { // sakura tree + people
          g.fillStyle = '#8a6040'; g.fillRect(30, 50, 12, 40);
          g.fillStyle = '#f5aac0'; for (let k = 0; k < 7; k++) { g.beginPath(); g.arc(24 + r() * 28, 30 + r() * 26, 14, 0, 7); g.fill(); }
          g.fillStyle = '#f0c080'; g.beginPath(); g.arc(98, 52, 9, 0, 7); g.fill(); g.fillStyle = i === 3 ? '#4a6fc0' : '#e06080'; g.fillRect(90, 62, 16, 22);
          g.fillStyle = '#f0c080'; g.beginPath(); g.arc(124, 60, 7, 0, 7); g.fill(); g.fillStyle = '#6ab070'; g.fillRect(118, 68, 12, 16);
        }
        g.fillStyle = '#f5c842'; g.beginPath(); g.arc(128, 20, 9, 0, 7); g.fill();
        g.fillStyle = '#9ccf7a'; g.fillRect(0, 88, 150, 12);
        txt(g, ['さくら ゆうな', 'はると', 'みお', 'そうた', 'ひなの', 'れん'][i], 118, 94, 10, '#555', { weight: 700, font: F.hand });
        g.restore();
      }
    } },
    { id: 'bulletin', w: 500, h: 300, draw: (g, w, h) => { // cork board with notices
      g.fillStyle = '#c89f6e'; g.fillRect(0, 0, w, h);
      const r = ctx.rng('p-bull');
      for (let i = 0; i < 500; i++) { g.fillStyle = r() < 0.5 ? 'rgba(120,80,40,0.25)' : 'rgba(230,200,150,0.3)'; g.fillRect(r() * w, r() * h, 2, 2); }
      const note = (x, y, nw, nh, bg, lines, rot, pin) => {
        g.save(); g.translate(x + nw / 2, y + nh / 2); g.rotate(rot); g.translate(-nw / 2, -nh / 2);
        g.fillStyle = 'rgba(60,40,30,0.25)'; g.fillRect(3, 4, nw, nh); g.fillStyle = bg; g.fillRect(0, 0, nw, nh);
        lines.forEach((l, j) => txt(g, l[0], nw / 2, 18 + j * (l[2] || 20), l[1], l[3] || INK.ink, { weight: j ? 500 : 700, maxW: nw - 12 }));
        g.fillStyle = pin; g.beginPath(); g.arc(nw / 2, 6, 5, 0, 7); g.fill();
        g.restore();
      };
      txt(g, '掲 示 板', w / 2, 16, 18, '#5a4032', { weight: 700 });
      note(14, 34, 150, 118, '#f3f1ea', [['ダイヤ改正のお知らせ', 15], ['3月14日(土)より', 12, 22], ['一部列車の時刻が', 12, 18], ['変わります', 12, 18], ['桜川電鉄', 11, 20, INK.grey]], -0.03, '#d94a4a');
      note(178, 30, 140, 124, '#fdf0c8', [['迷い猫', 20], ['さがしています', 13, 22], ['三毛猫・メス 「みけ」', 12, 20], ['見かけた方は', 12, 18], ['駅員まで', 12, 18]], 0.04, '#3a6fb8');
      g.fillStyle = '#f0b060'; g.beginPath(); g.arc(250, 112, 12, 0, 7); g.fill(); // cat blob
      note(334, 36, 150, 110, '#e3f0e3', [['清掃ボランティア', 15], ['桜川堤のごみ拾い', 12, 22], ['4月12日(日) 9:00', 12, 18], ['桜ヶ丘町内会', 11, 22, INK.grey]], -0.02, '#3f8f5b');
      note(20, 170, 170, 110, '#f6e4ea', [['駅長おすすめ', 15, 20, '#c2456e'], ['桜川堤の桜が', 12, 22], ['見ごろです！', 13, 18], ['徒歩12分', 12, 20]], 0.03, '#e28aa6');
      note(206, 174, 124, 108, '#eeede9', [['落とし物', 16], ['水色の水筒', 12, 22], ['4/2 ホームにて', 12, 18], ['駅務室で保管中', 11, 20]], -0.05, '#f0c63a');
      note(346, 166, 140, 118, '#e8eef7', [['桜ヶ丘図書館', 14], ['春のおはなし会', 13, 22], ['毎週土曜 14時', 12, 18], ['入場無料', 12, 20]], 0.02, '#d94a4a');
    } },
    { id: 'stampArt', w: 176, h: 176, draw: (g, w) => { // the station's commemorative stamp design (pink ink)
      g.fillStyle = '#f2efe6'; g.fillRect(0, 0, w, w);
      const c = w / 2, col = '#c4506e';
      g.strokeStyle = col; g.lineWidth = 5; g.beginPath(); g.arc(c, c, 80, 0, 7); g.stroke(); g.lineWidth = 2; g.beginPath(); g.arc(c, c, 72, 0, 7); g.stroke();
      g.fillStyle = col; g.beginPath(); g.moveTo(c - 44, 104); g.lineTo(c - 44, 82); g.lineTo(c, 60); g.lineTo(c + 44, 82); g.lineTo(c + 44, 104); g.fill();
      g.fillStyle = '#f2efe6'; g.fillRect(c - 10, 88, 20, 16); g.fillRect(c - 36, 88, 14, 10); g.fillRect(c + 22, 88, 14, 10);
      g.fillStyle = col; g.fillRect(c - 60, 106, 120, 4);
      for (const [x, y] of [[40, 56], [134, 52], [52, 36], [124, 34]]) blossom(g, x, y, 11, col, '#f2efe6');
      txt(g, '桜ヶ丘駅', c, 128, 22, col, { weight: 900, font: F.serif }); txt(g, '桜川電鉄 SK07', c, 150, 12, col, { weight: 700 });
    } },
    { id: 'stampSign', w: 250, h: 120, draw: (g, w, h) => {
      g.fillStyle = '#f6e4ea'; rr(g, 0, 0, w, h, 12); g.fill(); g.strokeStyle = INK.pinkDeep; g.lineWidth = 4; rr(g, 4, 4, w - 8, h - 8, 10); g.stroke();
      txt(g, '記念スタンプ', w / 2, 34, 30, '#c2456e', { weight: 900, font: F.round });
      txt(g, 'ご自由にどうぞ', w / 2, 70, 20, INK.ink, { weight: 700 }); txt(g, '押したあとはフタをしめてね', w / 2, 98, 14, INK.grey, { weight: 500 });
    } },
    { id: 'notebook', w: 120, h: 90, draw: (g, w, h) => { g.fillStyle = '#e6d3a8'; g.fillRect(0, 0, w, h); g.fillStyle = '#b8403a'; g.fillRect(0, 0, 12, h); txt(g, '来訪記念', 66, 30, 18, '#5a4032', { weight: 700 }); txt(g, 'ノート', 66, 54, 16, '#5a4032', { weight: 700 }); txt(g, 'No.14', 66, 76, 11, INK.grey, { weight: 500 }); } },
    { id: 'notePage', w: 120, h: 90, draw: (g, w, h) => { g.fillStyle = '#f2efe6'; g.fillRect(0, 0, w, h); g.strokeStyle = '#b8c8dc'; g.lineWidth = 1; for (let y = 14; y < h; y += 10) { g.beginPath(); g.moveTo(4, y); g.lineTo(w - 4, y); g.stroke(); } g.strokeStyle = '#555c70'; g.lineWidth = 1.2; const r = ctx.rng('p-notes'); for (let y = 12; y < h - 6; y += 10) { g.beginPath(); let x = 8; g.moveTo(x, y); while (x < w - 10 - r() * 30) { x += 3 + r() * 4; g.lineTo(x, y - 1 - r() * 3); g.lineTo(x + 1, y); } g.stroke(); } g.strokeStyle = 'rgba(196,80,110,0.7)'; g.lineWidth = 2; g.beginPath(); g.arc(90, 58, 14, 0, 7); g.stroke(); } },
    { id: 'umbrellaSign', w: 250, h: 120, draw: (g, w, h) => {
      g.fillStyle = '#e5eef6'; rr(g, 0, 0, w, h, 10); g.fill();
      g.fillStyle = '#3a6fb8'; g.beginPath(); g.arc(46, 60, 26, Math.PI, 0); g.fill(); g.strokeStyle = '#3a6fb8'; g.lineWidth = 4; g.beginPath(); g.moveTo(46, 60); g.lineTo(46, 92); g.arc(40, 92, 6, 0, Math.PI); g.stroke();
      txt(g, '置き傘', 158, 34, 30, INK.navy, { weight: 900 }); txt(g, 'ご自由にお使いください', 158, 68, 16, INK.ink, { weight: 700 }); txt(g, '使ったらお返しください', 158, 94, 14, INK.grey, { weight: 500 });
    } },
    { id: 'binCan', w: 128, h: 64, draw: (g, w, h) => { g.fillStyle = '#3a6fb8'; g.fillRect(0, 0, w, h); txt(g, 'カン・ビン', w / 2, 26, 22, '#fff', { weight: 900 }); txt(g, 'Cans / Bottles', w / 2, 50, 11, '#e5eef6', { weight: 500 }); } },
    { id: 'binPet', w: 128, h: 64, draw: (g, w, h) => { g.fillStyle = '#3f8f5b'; g.fillRect(0, 0, w, h); txt(g, 'ペットボトル', w / 2, 26, 19, '#fff', { weight: 900 }); txt(g, 'PET Bottles', w / 2, 50, 11, '#e5f5ea', { weight: 500 }); } },
    { id: 'binBurn', w: 128, h: 64, draw: (g, w, h) => { g.fillStyle = '#cf4a44'; g.fillRect(0, 0, w, h); txt(g, '燃えるゴミ', w / 2, 26, 21, '#fff', { weight: 900 }); txt(g, 'Burnable', w / 2, 50, 11, '#fbe6e4', { weight: 500 }); } },
    { id: 'officeBoard', w: 250, h: 170, draw: (g, w, h) => { // whiteboard inside the office
      g.fillStyle = '#ecebe6'; g.fillRect(0, 0, w, h); g.strokeStyle = '#9aa1a8'; g.lineWidth = 6; g.strokeRect(0, 0, w, h);
      txt(g, '本日の予定', 70, 22, 16, '#2b4574', { weight: 700, font: F.hand });
      const l = ['10:00 ホーム点検', '13:30 花壇の水やり', '15:00 臨時列車 確認', '16:30 窓口 交代'];
      l.forEach((s, i) => txt(g, s, 16, 52 + i * 26, 14, i === 3 ? '#c4506e' : '#34303f', { align: 'left', weight: 500, font: F.hand }));
      g.fillStyle = '#f7e27a'; g.fillRect(180, 60, 50, 44); g.fillStyle = '#f6b8c9'; g.fillRect(186, 112, 46, 40);
    } },
    { id: 'calendar', w: 120, h: 160, draw: (g, w, h) => {
      g.fillStyle = '#f2efe6'; g.fillRect(0, 0, w, h); g.fillStyle = '#f2b5c8'; g.fillRect(0, 0, w, 70); blossom(g, 60, 34, 22);
      txt(g, '4', 20, 88, 20, INK.red, { weight: 900 });
      for (let i = 0; i < 30; i++) { const c = i % 7, rw = Math.floor(i / 7); txt(g, String(i + 1), 14 + c * 15, 104 + rw * 13, 9, c === 0 ? INK.red : INK.ink, { weight: 500 }); }
    } },
    { id: 'freePaper', w: 128, h: 176, draw: (g, w, h) => { g.fillStyle = '#eef6ea'; g.fillRect(0, 0, w, h); g.fillStyle = '#8fd1c1'; g.fillRect(0, 0, w, 44); txt(g, 'さくらライン', w / 2, 22, 18, '#2d5b52', { weight: 900, font: F.round }); txt(g, '4月号', w / 2, 60, 14, INK.ink, { weight: 700 }); blossom(g, 64, 110, 30); txt(g, '沿線おでかけ情報', w / 2, 160, 12, INK.ink, { weight: 700 }); } },
    { id: 'wantedPoster', w: 176, h: 250, draw: (g, w, h) => { // platform: 桜川線 おでかけ
      const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#bfe0f2'); gr.addColorStop(1, '#f7e8c9'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
      g.fillStyle = '#a3c48a'; g.beginPath(); g.moveTo(0, 150); g.bezierCurveTo(50, 110, 120, 130, w, 100); g.lineTo(w, h); g.lineTo(0, h); g.fill();
      g.fillStyle = '#f5f0e6'; rr(g, 20, 150, 136, 30, 10); g.fill(); g.fillStyle = INK.pink; g.fillRect(20, 168, 136, 6);
      txt(g, '春日野の', w / 2, 36, 20, '#2d5b52', { weight: 900, font: F.round }); txt(g, '菜の花畑へ', w / 2, 66, 24, '#c28a1a', { weight: 900, font: F.round });
      g.fillStyle = '#f2d24a'; const r = ctx.rng('p-nano'); for (let i = 0; i < 40; i++) { g.beginPath(); g.arc(r() * w, 196 + r() * 50, 3 + r() * 3, 0, 7); g.fill(); }
      txt(g, '桜ヶ丘から1駅 4分', w / 2, 238, 13, INK.ink, { weight: 700 });
    } },
  ];

  // ------------------------------------------------------------------ INFO atlas (fare chart, maps, timetables, ticket machine)
  function fareChart(g, W, H) {
    g.fillStyle = '#eeede8'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#2b4574'; g.fillRect(0, 0, W, 54);
    txt(g, '運賃表', 90, 28, 34, '#f4f2ec', { weight: 900 }); txt(g, 'Fare Chart', 210, 32, 18, '#c9d3e6', { weight: 500 });
    txt(g, '桜川電鉄 桜川線　（おとな / こどもは半額）', 640, 28, 22, '#f4f2ec', { weight: 700 });
    const y = 210, x0 = 60, x1 = W - 60, step = (x1 - x0) / 11;
    g.strokeStyle = INK.pink; g.lineWidth = 16; g.lineCap = 'round'; g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y); g.stroke();
    g.strokeStyle = INK.pinkDeep; g.lineWidth = 3; g.beginPath(); g.moveTo(x0, y - 8); g.lineTo(x1, y - 8); g.stroke();
    LINE.forEach((s, i) => {
      const x = x0 + i * step, here = i === 6;
      g.fillStyle = here ? INK.red : '#ffffff'; g.strokeStyle = INK.navy; g.lineWidth = 4;
      g.beginPath(); g.arc(x, y, here ? 15 : 11, 0, 7); g.fill(); g.stroke();
      // fare bubble above
      if (!here) { g.fillStyle = '#ffffff'; g.strokeStyle = '#8e959d'; g.lineWidth = 2; rr(g, x - 36, 90, 72, 50, 10); g.fill(); g.stroke(); txt(g, String(FARES[i]), x, 108, 26, INK.navy, { weight: 900 }); txt(g, `こども ${FARES[i] / 2 | 0}`, x, 130, 12, INK.grey, { weight: 500 }); }
      else { g.fillStyle = INK.red; rr(g, x - 44, 88, 88, 54, 10); g.fill(); txt(g, '現在地', x, 106, 20, '#ffffff', { weight: 900 }); txt(g, 'You are here', x, 128, 11, '#ffe8e8', { weight: 500 }); }
      g.save(); g.translate(x, y + 26); g.fillStyle = INK.ink;
      T.verticalText(g, s[1], 0, 0, here ? 30 : 24, F.sans, 700);
      g.restore();
      txt(g, s[0], x, H - 24, 14, INK.grey, { weight: 500 });
    });
    txt(g, '← 花見台・桜川 方面', 170, 172, 18, INK.navy, { weight: 700 }); txt(g, '春日野・山桜 方面 →', W - 170, 172, 18, INK.navy, { weight: 700 });
    txt(g, '単位：円', W - 60, 72, 14, INK.grey, { weight: 500 });
    txt(g, '桜川 のりかえ：湾岸線・バス', 120, H - 52, 13, INK.ink, { align: 'left', weight: 500 });
  }
  function routeMap(g, W, H) {
    g.fillStyle = '#f1efe8'; g.fillRect(0, 0, W, H);
    txt(g, '桜川線 路線図', 120, 30, 28, INK.navy, { weight: 900 }); txt(g, 'Sakuragawa Line  Route Map', 330, 34, 16, INK.grey, { weight: 500 });
    // wavy line with the river
    g.fillStyle = '#b9d6ec'; g.beginPath(); g.moveTo(0, 70); g.bezierCurveTo(300, 50, 600, 100, W, 64); g.lineTo(W, 84); g.bezierCurveTo(600, 118, 300, 70, 0, 90); g.fill();
    txt(g, '桜 川', 520, 82, 14, '#5b86b0', { weight: 700 });
    const pts = LINE.map((s, i) => [70 + i * ((W - 140) / 11), 160 + Math.sin(i * 0.7) * 26]);
    g.strokeStyle = INK.pink; g.lineWidth = 12; g.lineJoin = 'round'; g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke();
    LINE.forEach((s, i) => {
      const [x, y] = pts[i], here = i === 6;
      g.fillStyle = here ? INK.red : '#ffffff'; g.strokeStyle = INK.navy; g.lineWidth = 3; g.beginPath(); g.arc(x, y, here ? 12 : 9, 0, 7); g.fill(); g.stroke();
      txt(g, s[1], x, y + (i % 2 ? -30 : 34), here ? 22 : 17, here ? INK.red : INK.ink, { weight: 700 });
      txt(g, s[0], x, y + (i % 2 ? -52 : 56), 11, INK.grey, { weight: 500 });
    });
    txt(g, 'SK01 桜川 のりかえ 湾岸線', 150, H - 20, 13, INK.ink, { weight: 500 });
    txt(g, '全駅 各駅停車 約20分間隔で運転', W - 200, H - 20, 13, INK.ink, { weight: 500 });
    g.fillStyle = INK.pink; g.fillRect(0, H - 6, W, 6);
  }
  function areaMap(g, W, H) {
    g.fillStyle = '#efeadc'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#2b4574'; g.fillRect(0, 0, W, 40); txt(g, '駅周辺案内図', 120, 21, 24, '#f4f2ec', { weight: 900 }); txt(g, 'Area Map', 280, 24, 14, '#c9d3e6', { weight: 500 });
    // map: north up. river top, rail middle, main street down
    g.fillStyle = '#b9d6ec'; g.fillRect(0, 52, W, 34); txt(g, '桜 川', 70, 69, 14, '#5b86b0', { weight: 700 });
    g.fillStyle = '#cfe0b8'; g.fillRect(0, 86, W, 12); // levee
    const r = ctx.rng('p-area'); for (let i = 0; i < 22; i++) blossom(g, 10 + i * 23, 92, 6);
    g.fillStyle = '#e4dccb'; for (let i = 0; i < 26; i++) { const x = 20 + r() * (W - 40), y = 110 + r() * 50; g.fillRect(x, y, 16 + r() * 16, 12 + r() * 8); }
    g.fillStyle = '#ffffff'; g.fillRect(0, 170, W, 12); txt(g, '線路北の道', 440, 176, 11, INK.grey, { weight: 500 });
    g.fillStyle = '#9aa1a8'; g.fillRect(0, 192, W, 16); g.fillStyle = INK.pink; g.fillRect(0, 198, W, 4);
    g.fillStyle = '#ffffff'; g.fillRect(110, 110, 12, H - 110); txt(g, '踏切', 150, 214, 12, INK.ink, { weight: 700 });
    g.fillStyle = '#e8c4a8'; g.fillRect(200, 208, 90, 30); txt(g, '桜ヶ丘駅', 245, 224, 15, INK.ink, { weight: 900 });
    g.fillStyle = '#d8d4c8'; g.fillRect(170, 240, 160, 50); txt(g, '駅前広場', 250, 262, 13, INK.ink, { weight: 700 }); blossom(g, 196, 264, 10);
    g.fillStyle = '#ffffff'; g.fillRect(0, 292, W, 14); g.fillRect(232, 306, 16, H - 306);
    txt(g, '駅前通り', 420, 300, 11, INK.grey, { weight: 500 }); txt(g, '商店街', 272, 356, 13, INK.ink, { weight: 700 });
    const pin = (x, y, label, col) => { g.fillStyle = col; g.beginPath(); g.arc(x, y, 7, 0, 7); g.fill(); txt(g, label, x + 10, y, 12, INK.ink, { align: 'left', weight: 700 }); };
    pin(214, 324, 'コンビニ', '#3a6fb8'); pin(262, 318, '喫茶店', '#8a6446'); pin(214, 346, '花屋', '#d9718f'); pin(262, 342, '和菓子', '#c94a3a');
    pin(262, 366, '神社', '#c94a3a'); pin(214, 370, '書店', '#3f8f5b'); pin(360, 250, 'バス停', '#3a6fb8'); pin(360, 274, 'タクシー', '#e9a23b');
    pin(60, 140, '北口', '#2b4574');
    g.fillStyle = INK.red; g.beginPath(); g.moveTo(245, 244); g.lineTo(236, 232); g.arc(245, 230, 10, Math.PI * 0.8, Math.PI * 0.2); g.fill(); txt(g, '現在地', 245, 196 - 10, 12, INK.red, { weight: 900 });
    g.strokeStyle = INK.ink; g.lineWidth = 2; g.beginPath(); g.moveTo(W - 30, 128); g.lineTo(W - 30, 100); g.stroke(); tri(g, W - 30, 100, 8, 0, INK.ink); txt(g, 'N', W - 30, 140, 14, INK.ink, { weight: 900 });
  }
  function timetable(g, W, H, trackNo, dest, seed) {
    g.fillStyle = '#eeede8'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#2b4574'; g.fillRect(0, 0, W, 62);
    txt(g, `桜ヶ丘駅  ${trackNo}番線`, W / 2, 20, 18, '#f4f2ec', { weight: 700 }); txt(g, `${dest} 方面`, W / 2, 44, 18, '#f4f2ec', { weight: 700 });
    g.fillStyle = '#f2b5c8'; g.fillRect(0, 62, W, 18); txt(g, '平 日   Weekdays', W / 2, 71, 12, INK.ink, { weight: 700 });
    const r = ctx.rng(seed);
    const rows = []; for (let h = 5; h <= 23; h++) rows.push(h);
    const rh = (H - 90) / rows.length;
    rows.forEach((h, i) => {
      const y = 86 + i * rh;
      if (i % 2) { g.fillStyle = '#e4e2da'; g.fillRect(0, y, W, rh); }
      g.fillStyle = '#d7dbe5'; g.fillRect(0, y, 34, rh);
      txt(g, String(h), 17, y + rh / 2 + 1, 13, INK.navy, { weight: 900 });
      const n = h >= 7 && h <= 8 ? 5 : h >= 17 && h <= 19 ? 4 : h === 5 || h === 23 ? 2 : 3;
      let m = Math.floor(r() * 10) + 2; const mins = [];
      for (let k = 0; k < n; k++) { mins.push(m); m += Math.floor(60 / n) + Math.floor(r() * 4) - 1; if (m > 59) break; }
      mins.forEach((mm, k) => txt(g, String(mm).padStart(2, '0'), 50 + k * 40, y + rh / 2 + 1, 13, h === 16 ? INK.red : INK.ink, { weight: 700 }));
    });
  }
  function tvmBody(g, W, H) { // automatic ticket machine front panel (below the screen)
    g.fillStyle = '#c9d7e2'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#b3c3d0'; g.fillRect(0, 0, W, 6);
    // coin slot area
    g.fillStyle = '#e8eef2'; rr(g, 14, 16, 104, 70, 8); g.fill(); txt(g, '硬貨', 66, 30, 14, INK.ink, { weight: 700 });
    g.fillStyle = '#3b3d46'; rr(g, 30, 44, 72, 12, 5); g.fill(); txt(g, '10・50・100・500円', 66, 72, 10, INK.grey, { weight: 500 });
    // bill slot
    g.fillStyle = '#e8eef2'; rr(g, 134, 16, 108, 70, 8); g.fill(); txt(g, '紙幣', 188, 30, 14, INK.ink, { weight: 700 });
    g.fillStyle = '#3b3d46'; rr(g, 146, 44, 84, 10, 4); g.fill(); txt(g, '千円・五千円・一万円', 188, 72, 10, INK.grey, { weight: 500 });
    // IC card slot
    g.fillStyle = '#e8eef2'; rr(g, 14, 98, 228, 56, 8); g.fill(); g.fillStyle = INK.pink; rr(g, 24, 110, 46, 32, 6); g.fill(); txt(g, 'IC', 47, 127, 18, '#fff', { weight: 900 });
    txt(g, 'さくらパス チャージ', 150, 118, 14, INK.ink, { weight: 700 }); g.fillStyle = '#3b3d46'; rr(g, 96, 132, 108, 8, 3); g.fill();
    // outlets
    g.fillStyle = '#e8eef2'; rr(g, 14, 166, 228, 30, 8); g.fill(); txt(g, 'きっぷ・領収書 取出口', 128, 181, 14, INK.ink, { weight: 700 });
    g.fillStyle = '#e8eef2'; rr(g, 14, 236, 228, 30, 8); g.fill(); txt(g, 'おつり・硬貨 取出口', 128, 251, 14, INK.ink, { weight: 700 });
    g.fillStyle = '#e1b54a'; g.beginPath(); g.arc(226, 300, 14, 0, 7); g.fill(); txt(g, '呼出', 226, 301, 11, '#2f2c34', { weight: 900 }); txt(g, '係員呼出', 170, 301, 12, INK.ink, { weight: 700 });
    g.fillStyle = '#8fa3b3'; for (let y = 330; y < H - 10; y += 9) g.fillRect(20, y, W - 40, 3);
  }
  function tvmScreen(g, W, H) { // line-selection touch UI
    g.fillStyle = '#e6f1fa'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#2b4574'; g.fillRect(0, 0, W, 26); txt(g, 'ご希望のボタンを押してください', W / 2, 14, 13, '#ffffff', { weight: 700 });
    g.strokeStyle = INK.pink; g.lineWidth = 5; g.beginPath(); g.moveTo(12, 48); g.lineTo(W - 12, 48); g.stroke();
    for (let i = 0; i < 12; i++) { const x = 12 + i * ((W - 24) / 11); g.fillStyle = i === 6 ? INK.red : '#ffffff'; g.strokeStyle = INK.navy; g.lineWidth = 1.5; g.beginPath(); g.arc(x, 48, 3.5, 0, 7); g.fill(); g.stroke(); }
    const fares = [140, 170, 200, 230, 260, 290];
    fares.forEach((f, i) => { const x = 10 + (i % 3) * 80, y = 62 + Math.floor(i / 3) * 42; g.fillStyle = i === 0 ? '#f7c9d6' : '#ffffff'; g.strokeStyle = '#7d94b0'; g.lineWidth = 2; rr(g, x, y, 72, 34, 6); g.fill(); g.stroke(); txt(g, `${f}円`, x + 36, y + 18, 17, INK.navy, { weight: 900 }); });
    const btn = (x, y, w, t, bg) => { g.fillStyle = bg; rr(g, x, y, w, 26, 6); g.fill(); txt(g, t, x + w / 2, y + 14, 12, '#ffffff', { weight: 700 }); };
    btn(10, 150, 56, 'おとな', '#3a6fb8'); btn(70, 150, 56, 'こども', '#8e959d'); btn(130, 150, 56, 'チャージ', INK.pinkDeep); btn(190, 150, 56, '取消', '#8e959d');
  }
  const infoItems = [
    { id: 'fare', w: 1016, h: 380, draw: fareChart },
    { id: 'route', w: 1016, h: 250, draw: routeMap },
    { id: 'area', w: 500, h: 350, draw: areaMap },
    { id: 'tt1', w: 250, h: 350, draw: (g, w, h) => timetable(g, w, h, 1, '花見台・桜川', 'tt1') },
    { id: 'tt2', w: 250, h: 350, draw: (g, w, h) => timetable(g, w, h, 2, '春日野・山桜', 'tt2') },
  ];
  const tvmItems = [
    { id: 'body', w: 250, h: 380, draw: tvmBody },
    { id: 'screen', w: 250, h: 184, draw: tvmScreen },
    { id: 'depSmall', w: 240, h: 100, draw: (g, w, h) => { g.fillStyle = '#1c1b22'; g.fillRect(0, 0, w, h); txt(g, '普通', 34, 30, 18, '#8fe39a', { weight: 700 }); txt(g, '16:08', 104, 30, 20, '#ffb36b', { weight: 700 }); txt(g, '花見台', 186, 30, 18, '#ffb36b', { weight: 700 }); txt(g, '普通', 34, 72, 18, '#8fe39a', { weight: 700 }); txt(g, '16:28', 104, 72, 20, '#ffb36b', { weight: 700 }); txt(g, '花見台', 186, 72, 18, '#ffb36b', { weight: 700 }); } },
    { id: 'depSmall2', w: 240, h: 100, draw: (g, w, h) => { g.fillStyle = '#1c1b22'; g.fillRect(0, 0, w, h); txt(g, '普通', 34, 30, 18, '#8fe39a', { weight: 700 }); txt(g, '16:12', 104, 30, 20, '#ffb36b', { weight: 700 }); txt(g, '春日野', 186, 30, 18, '#ffb36b', { weight: 700 }); txt(g, '普通', 34, 72, 18, '#8fe39a', { weight: 700 }); txt(g, '16:32', 104, 72, 20, '#ffb36b', { weight: 700 }); txt(g, '山桜', 186, 72, 18, '#ffb36b', { weight: 700 }); } },
    { id: 'doorMark', w: 240, h: 110, draw: (g, w, h) => { // painted boarding-position mark (seen from the platform side)
      g.clearRect(0, 0, w, h);
      g.strokeStyle = 'rgba(236,236,230,0.95)'; g.lineWidth = 7; rr(g, 6, 6, w - 12, h - 12, 12); g.stroke();
      g.fillStyle = 'rgba(239,159,190,0.92)'; rr(g, 70, 22, 100, 64, 10); g.fill();
      txt(g, '乗車位置', 120, 44, 22, '#ffffff', { weight: 900 }); txt(g, '2両', 120, 70, 20, '#ffffff', { weight: 900 });
      g.fillStyle = 'rgba(236,236,230,0.95)';
      for (const x of [34, 206]) for (const y of [34, 62, 90]) { g.beginPath(); g.moveTo(x, y - 12); g.lineTo(x + 12, y + 4); g.lineTo(x - 12, y + 4); g.fill(); }
    } },
  ];


  // ---- pack the item lists into atlases (sizes checked by the shelf packer)
  const byId = new Map([...faceItems, ...posterItems, ...infoItems, ...tvmItems].map(it => [it.id, it]));
  const pick = (ids) => ids.map(id => { const it = byId.get(id); if (!it) throw new Error('no atlas item ' + id); return it; });
  const face = makeAtlas(ctx, 'st-atlas-facade', 1024, pick(['nameBoard', 'gateSign', 'clock', 'depBoard', 'ticketHead', 'windowSign', 'icPad', 'gateGo', 'gateNo', 'gateLabel', 'gateLabel2', 'autoDoor', 'mannedGate', 'fareAdj', 'exitUp']));
  const misc = makeAtlas(ctx, 'st-atlas-misc', 1024, pick(['keepOut', 'staffOnly', 'crossWarn', 'toilet', 'northExit', 'wcMen', 'wcWomen', 'wcMulti', 'stopPos', 'equipLabel', 'platNo1', 'platNo2', 'welcome', 'gardenSign', 'bikeNotice', 'shoeMat', 'doorMark', 'wheelPlaque', 'staffBike', 'tapSign', 'shedLabel']));
  const P = makeAtlas(ctx, 'st-atlas-posters', 1024, pick(['sakuraFest', 'safety', 'festival', 'stampRally', 'manners', 'wantedPoster', 'hanamiMap', 'noSmoking', 'lostFound']));
  const B = makeAtlas(ctx, 'st-atlas-boards', 1024, pick(['drawings', 'bulletin', 'officeBoard', 'stampArt', 'stampSign', 'calendar', 'freePaper', 'notebook', 'notePage', 'umbrellaSign', 'binCan', 'binPet', 'binBurn', 'gateBack']));
  const I = makeAtlas(ctx, 'st-atlas-info', 1024, pick(['fare', 'route', 'area', 'tt1', 'tt2']));
  const TVM = makeAtlas(ctx, 'st-atlas-tvm', 512, pick(['body', 'screen', 'depSmall', 'depSmall2']));

  // ------------------------------------------------------------------ FOLIAGE cards (alpha)
  function grassCard(g, W, H, seed, tint = 0) {
    const r = ctx.rng(seed); g.clearRect(0, 0, W, H); g.lineCap = 'round';
    for (let i = 0; i < 46; i++) {
      const x0 = W / 2 + (r() - 0.5) * W * 0.5, len = H * (0.35 + r() * 0.6), a = (r() - 0.5) * 1.1;
      const cols = tint ? ['#7fa65a', '#9cc06a', '#b6d07c', '#6c9450'] : ['#6f9a52', '#8fb86a', '#a9c979', '#5f8a4c'];
      g.strokeStyle = cols[i % 4]; g.lineWidth = 3 + r() * 4;
      g.beginPath(); g.moveTo(x0, H); g.quadraticCurveTo(x0 + Math.sin(a) * len * 0.3, H - len * 0.6, x0 + Math.sin(a) * len * 0.8, H - len); g.stroke();
    }
  }
  function flowerCard(g, W, H, seed, kind) {
    const r = ctx.rng(seed); g.clearRect(0, 0, W, H); g.lineCap = 'round';
    const leaf = (x, y, l, a, c) => { g.fillStyle = c; g.save(); g.translate(x, y); g.rotate(a); g.beginPath(); g.ellipse(0, -l / 2, l * 0.18, l / 2, 0, 0, 7); g.fill(); g.restore(); };
    if (kind === 'dandelion') {
      for (let i = 0; i < 9; i++) leaf(W / 2, H - 4, 50 + r() * 40, (i - 4) * 0.32, i % 2 ? '#6f9a52' : '#86ad5e');
      for (let i = 0; i < 3; i++) {
        const x = W * (0.3 + i * 0.2) + (r() - 0.5) * 16, y = H * (0.25 + r() * 0.3);
        g.strokeStyle = '#7c9a55'; g.lineWidth = 3; g.beginPath(); g.moveTo(W / 2, H); g.quadraticCurveTo(x, H * 0.7, x, y); g.stroke();
        if (i === 2 && r() < 0.8) { g.fillStyle = 'rgba(245,245,240,0.95)'; g.beginPath(); g.arc(x, y, 16, 0, 7); g.fill(); g.strokeStyle = 'rgba(210,210,200,0.9)'; g.lineWidth = 1; for (let k = 0; k < 16; k++) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(k) * 15, y + Math.sin(k) * 15); g.stroke(); } }
        else { for (let k = 0; k < 20; k++) { const a = k / 20 * 6.28; g.fillStyle = k % 2 ? '#f4c52c' : '#f8d64a'; g.beginPath(); g.ellipse(x + Math.cos(a) * 9, y + Math.sin(a) * 9, 7, 3, a, 0, 7); g.fill(); } g.fillStyle = '#e8a91c'; g.beginPath(); g.arc(x, y, 7, 0, 7); g.fill(); }
      }
    } else if (kind === 'daisy') {
      for (let i = 0; i < 7; i++) leaf(W / 2 + (r() - 0.5) * 40, H - 2, 30 + r() * 20, (r() - 0.5) * 1.6, '#7aa45a');
      for (let i = 0; i < 7; i++) {
        const x = W * 0.15 + r() * W * 0.7, y = H * (0.3 + r() * 0.45);
        g.strokeStyle = '#7ba457'; g.lineWidth = 2; g.beginPath(); g.moveTo(x + (r() - 0.5) * 20, H); g.lineTo(x, y); g.stroke();
        for (let k = 0; k < 12; k++) { const a = k / 12 * 6.28; g.fillStyle = r() < 0.2 ? '#f7dde6' : '#f6f4ee'; g.beginPath(); g.ellipse(x + Math.cos(a) * 7, y + Math.sin(a) * 7, 6, 2.4, a, 0, 7); g.fill(); }
        g.fillStyle = '#f2c230'; g.beginPath(); g.arc(x, y, 4, 0, 7); g.fill();
      }
    } else if (kind === 'nanohana') {
      for (let i = 0; i < 6; i++) {
        const x = W * 0.2 + r() * W * 0.6, top = H * (0.08 + r() * 0.3);
        g.strokeStyle = '#6f9a4c'; g.lineWidth = 4; g.beginPath(); g.moveTo(x + (r() - 0.5) * 20, H); g.quadraticCurveTo(x + (r() - 0.5) * 20, H * 0.6, x, top + 20); g.stroke();
        leaf(x, H * 0.75, 50, (r() - 0.5) * 1.4, '#7fa859'); leaf(x, H * 0.55, 40, (r() - 0.5) * 1.4, '#8db462');
        for (let k = 0; k < 22; k++) { g.fillStyle = k % 3 ? '#f2d33e' : '#f7e36a'; g.beginPath(); g.arc(x + (r() - 0.5) * 30, top + r() * 34, 5 + r() * 3, 0, 7); g.fill(); }
      }
    } else if (kind === 'tulip') {
      const cols = [['#e8594f', '#f28a7d'], ['#f2c230', '#f7dc6a'], ['#f2a0b8', '#f8c6d4'], ['#f5f0e6', '#ffffff'], ['#e8594f', '#f28a7d']];
      for (let i = 0; i < 5; i++) {
        const x = W * (0.12 + i * 0.19), y = H * (0.25 + r() * 0.15), c = cols[(i + Math.floor(r() * 5)) % 5];
        g.strokeStyle = '#6f9a4c'; g.lineWidth = 4; g.beginPath(); g.moveTo(x, H); g.lineTo(x, y); g.stroke();
        leaf(x - 6, H - 4, 60, -0.3, '#86ad62'); leaf(x + 6, H - 4, 54, 0.35, '#7aa45a');
        g.fillStyle = c[0]; g.beginPath(); g.moveTo(x - 15, y - 26); g.lineTo(x - 8, y - 14); g.lineTo(x, y - 30); g.lineTo(x + 8, y - 14); g.lineTo(x + 15, y - 26); g.quadraticCurveTo(x + 17, y + 6, x, y + 6); g.quadraticCurveTo(x - 17, y + 6, x - 15, y - 26); g.fill();
        g.fillStyle = c[1]; g.beginPath(); g.ellipse(x - 5, y - 10, 4, 10, 0.2, 0, 7); g.fill();
      }
    } else if (kind === 'pansy') {
      for (let i = 0; i < 14; i++) leaf(W / 2 + (r() - 0.5) * W * 0.6, H - 2, 26 + r() * 20, (r() - 0.5) * 2.2, i % 2 ? '#5f8c4c' : '#6f9a52');
      const cols = [['#7b5cc4', '#f2d33e'], ['#f2d33e', '#8a4a2a'], ['#f4f0ea', '#7b5cc4'], ['#e87aa0', '#fbe0ea'], ['#5c78d4', '#f4f0ea']];
      for (let i = 0; i < 8; i++) {
        const x = W * 0.15 + r() * W * 0.7, y = H * (0.45 + r() * 0.3), c = cols[Math.floor(r() * cols.length)];
        g.fillStyle = c[0]; for (let k = 0; k < 5; k++) { const a = -1.2 + k * 0.9; g.beginPath(); g.arc(x + Math.cos(a) * 8, y + Math.sin(a) * 8, 9, 0, 7); g.fill(); }
        g.fillStyle = c[1]; g.beginPath(); g.arc(x, y + 2, 6, 0, 7); g.fill(); g.fillStyle = '#f2c230'; g.beginPath(); g.arc(x, y, 2.5, 0, 7); g.fill();
      }
    } else if (kind === 'tsukushi') { // horsetail shoots + clover
      for (let i = 0; i < 10; i++) { const x = W * 0.1 + r() * W * 0.8; g.fillStyle = '#7fa65a'; for (let k = 0; k < 3; k++) { g.beginPath(); g.arc(x + (k - 1) * 7, H - 10 - r() * 6, 6, 0, 7); g.fill(); } }
      for (let i = 0; i < 6; i++) { const x = W * 0.15 + r() * W * 0.7, top = H * (0.35 + r() * 0.3); g.strokeStyle = '#d8c7a4'; g.lineWidth = 5; g.beginPath(); g.moveTo(x, H); g.lineTo(x, top); g.stroke(); g.fillStyle = '#a88a60'; g.beginPath(); g.ellipse(x, top, 5, 13, 0, 0, 7); g.fill(); g.strokeStyle = '#8a6a48'; g.lineWidth = 1.5; for (let y = top + 22; y < H - 10; y += 16) { g.beginPath(); g.moveTo(x - 5, y); g.lineTo(x + 5, y); g.stroke(); } }
    }
  }
  const FOL = makeAtlas(ctx, 'st-atlas-foliage', 1024, [
    { id: 'grass', w: 250, h: 250, draw: (g, w, h) => grassCard(g, w, h, 'fg1') },
    { id: 'grass2', w: 250, h: 250, draw: (g, w, h) => grassCard(g, w, h, 'fg2', 1) },
    { id: 'dandelion', w: 250, h: 250, draw: (g, w, h) => flowerCard(g, w, h, 'fd', 'dandelion') },
    { id: 'daisy', w: 250, h: 250, draw: (g, w, h) => flowerCard(g, w, h, 'fda', 'daisy') },
    { id: 'nanohana', w: 250, h: 250, draw: (g, w, h) => flowerCard(g, w, h, 'fn', 'nanohana') },
    { id: 'tulip', w: 250, h: 250, draw: (g, w, h) => flowerCard(g, w, h, 'ft', 'tulip') },
    { id: 'pansy', w: 250, h: 250, draw: (g, w, h) => flowerCard(g, w, h, 'fp', 'pansy') },
    { id: 'tsukushi', w: 250, h: 250, draw: (g, w, h) => flowerCard(g, w, h, 'fts', 'tsukushi') },
  ]);

  return { wireMesh, concrete, tactileDot, tactileLine, floorTile, plaster, stoneTile, paving, rubber, gravel, grassTex, soil, streaks, grime, signs, face, misc, P, B, I, TVM, FOL, txt, blossom };
}
