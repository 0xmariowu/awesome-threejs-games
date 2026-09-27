// environment/textures.js — canvas-painted textures (hand-painted anime look, never photo noise).
// Every texture is keyed (shared) and <= 1024 px.
import { FONTS } from '../../core/textures.js';

export function createEnvTextures(ctx) {
  const T = ctx.tex;
  const R = (k) => ctx.rng('envtex-' + k);
  const rgba = (r, g, b, a) => `rgba(${r | 0},${g | 0},${b | 0},${a})`;

  // soft round blotch
  function blotch(g, x, y, r, col, a) {
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, col.replace('A', a)); gr.addColorStop(1, col.replace('A', 0));
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  // draw with wrap-around so the texture tiles
  function wrap(w, h, fn) { for (const ox of [-w, 0, w]) for (const oy of [-h, 0, h]) fn(ox, oy); }

  // ---------------------------------------------------------------- ground detail (multiplies vertex colours)
  const ground = T.draw(512, 512, (g, w, h) => {
    const r = R('ground');
    g.fillStyle = '#f3f1ec'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 70; i++) {
      const x = r() * w, y = r() * h, rad = 30 + r() * 90, dark = r() < 0.55;
      wrap(w, h, (ox, oy) => blotch(g, x + ox, y + oy, rad, dark ? 'rgba(196,190,176,A)' : 'rgba(255,253,246,A)', 0.16 + r() * 0.16));
    }
    // faint painted strokes (short, directional)
    for (let i = 0; i < 900; i++) {
      const x = r() * w, y = r() * h, l = 3 + r() * 7, a = -1.2 + r() * 0.5;
      g.strokeStyle = r() < 0.5 ? 'rgba(170,166,150,0.20)' : 'rgba(255,255,250,0.32)'; g.lineWidth = 1 + r() * 1.4;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
    }
    // tiny pebbles
    for (let i = 0; i < 260; i++) {
      const x = r() * w, y = r() * h, s = 1 + r() * 2.2;
      g.fillStyle = r() < 0.5 ? 'rgba(160,152,138,0.35)' : 'rgba(255,255,255,0.45)';
      g.beginPath(); g.ellipse(x, y, s * 1.3, s, r() * 3, 0, Math.PI * 2); g.fill();
    }
  }, { key: 'env-ground', repeat: [1, 1] });

  // ---------------------------------------------------------------- levee grass: mown stripes + blade strokes
  const levee = T.draw(512, 512, (g, w, h) => {
    const r = R('levee');
    g.fillStyle = '#f2f5ea'; g.fillRect(0, 0, w, h);
    // 4 mown bands along u (constant v) with soft painted edges
    for (let b = 0; b < 4; b++) {
      const y0 = b * h / 4;
      const light = b % 2 === 0;
      const gr = g.createLinearGradient(0, y0, 0, y0 + h / 4);
      const c = light ? '255,255,246' : '204,218,184';
      gr.addColorStop(0, `rgba(${c},0.0)`); gr.addColorStop(0.18, `rgba(${c},0.75)`); gr.addColorStop(0.82, `rgba(${c},0.75)`); gr.addColorStop(1, `rgba(${c},0.0)`);
      g.fillStyle = gr; g.fillRect(0, y0, w, h / 4);
    }
    for (let i = 0; i < 40; i++) { const x = r() * w, y = r() * h; wrap(w, h, (ox, oy) => blotch(g, x + ox, y + oy, 20 + r() * 50, r() < 0.5 ? 'rgba(200,214,176,A)' : 'rgba(255,255,236,A)', 0.2)); }
    // blade strokes, leaning with the mowing direction per band
    for (let i = 0; i < 2600; i++) {
      const x = r() * w, y = r() * h, band = Math.floor(y / (h / 4)) % 2;
      const l = 4 + r() * 7, a = -Math.PI / 2 + (band ? 0.45 : -0.45) + (r() - 0.5) * 0.5;
      g.strokeStyle = r() < 0.55 ? 'rgba(150,176,118,0.30)' : 'rgba(255,255,240,0.42)';
      g.lineWidth = 1 + r() * 1.2;
      g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + 1, y + Math.sin(a) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
    }
  }, { key: 'env-levee', repeat: [1, 1] });

  // ---------------------------------------------------------------- stone revetment: staggered courses, soft joints, moss & water stains
  const masonry = T.draw(512, 512, (g, w, h) => {
    const r = R('mas');
    g.fillStyle = '#a9a498'; g.fillRect(0, 0, w, h);
    const rows = 7, rh = h / rows;
    for (let j = 0; j < rows; j++) {
      let x = -((j * 37) % 60);
      while (x < w) {
        const sw = 58 + r() * 34, v = r();
        const c = 205 + v * 26 | 0;
        const draw = (ox) => {
          g.fillStyle = `rgb(${c},${c - 3},${c - 11})`;
          ctx.tex.roundRect(g, x + ox + 2.5, j * rh + 2.5, sw - 5, rh - 5, 9); g.fill();
          g.fillStyle = 'rgba(255,255,248,0.28)'; ctx.tex.roundRect(g, x + ox + 6, j * rh + 5, (sw - 12) * 0.7, rh * 0.22, 5); g.fill();
          g.fillStyle = 'rgba(120,116,104,0.16)'; ctx.tex.roundRect(g, x + ox + 5, j * rh + rh * 0.62, sw - 10, rh * 0.28, 6); g.fill();
        };
        draw(0); if (x + sw > w) draw(-w);
        x += sw;
      }
    }
    // moss in the joints + vertical rain / water stains
    for (let i = 0; i < 26; i++) { const x = r() * w, y = r() * h; wrap(w, h, (ox, oy) => blotch(g, x + ox, y + oy, 16 + r() * 30, 'rgba(126,146,98,A)', 0.22)); }
    for (let i = 0; i < 16; i++) { const x = r() * w, y0 = r() * h * 0.5, l = 80 + r() * 200; const gr = g.createLinearGradient(0, y0, 0, y0 + l); gr.addColorStop(0, 'rgba(110,108,98,0.16)'); gr.addColorStop(1, 'rgba(110,108,98,0)'); g.fillStyle = gr; g.fillRect(x, y0, 8 + r() * 14, l); }
  }, { key: 'env-masonry2', repeat: [1, 1] });

  // ---------------------------------------------------------------- pale fine asphalt for the levee path
  const path = T.draw(512, 512, (g, w, h) => {
    const r = R('path');
    g.fillStyle = '#ecebe6'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 50; i++) { const x = r() * w, y = r() * h; wrap(w, h, (ox, oy) => blotch(g, x + ox, y + oy, 25 + r() * 70, r() < 0.6 ? 'rgba(200,196,186,A)' : 'rgba(255,255,252,A)', 0.2)); }
    for (let i = 0; i < 5000; i++) {
      const x = r() * w, y = r() * h, s = 0.6 + r() * 1.4;
      g.fillStyle = r() < 0.5 ? 'rgba(150,146,138,0.35)' : 'rgba(255,255,255,0.5)';
      g.fillRect(x, y, s, s);
    }
    // a few hairline cracks
    g.strokeStyle = 'rgba(140,134,124,0.35)'; g.lineWidth = 1.2;
    for (let i = 0; i < 5; i++) { let x = r() * w, y = r() * h; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (r() - 0.5) * 40; y += 10 + r() * 20; g.lineTo(x, y); } g.stroke(); }
  }, { key: 'env-path', repeat: [1, 1] });

  // ---------------------------------------------------------------- vegetation card atlases (colour + alpha)
  function blade(g, x, y, len, ang, wid, c0, c1) {
    const tx = x + Math.sin(ang) * len, ty = y - Math.cos(ang) * len;
    const mx = x + Math.sin(ang * 0.5) * len * 0.55, my = y - Math.cos(ang * 0.5) * len * 0.55;
    const gr = g.createLinearGradient(x, y, tx, ty); gr.addColorStop(0, c0); gr.addColorStop(1, c1);
    g.fillStyle = gr;
    g.beginPath(); g.moveTo(x - wid, y); g.quadraticCurveTo(mx - wid * 0.6, my, tx, ty); g.quadraticCurveTo(mx + wid * 0.6, my, x + wid, y); g.closePath(); g.fill();
  }
  const tufts = T.draw(1024, 512, (g) => {
    const r = R('tufts');
    g.clearRect(0, 0, 1024, 512);
    const cell = (i, fn) => { g.save(); g.translate(i * 256, 0); g.beginPath(); g.rect(0, 0, 256, 512); g.clip(); fn(); g.restore(); };
    // 0 fresh short tuft
    cell(0, () => { for (let k = 0; k < 34; k++) { const a = (r() - 0.5) * 1.5; blade(g, 128 + (r() - 0.5) * 70, 512, 220 + r() * 230, a, 6 + r() * 5, '#5f8f4e', r() < 0.5 ? '#b9d67f' : '#9cc56a'); } });
    // 1 tall grass with seed heads
    cell(1, () => {
      for (let k = 0; k < 26; k++) { const a = (r() - 0.5) * 1.0; blade(g, 128 + (r() - 0.5) * 60, 512, 300 + r() * 200, a, 4 + r() * 3, '#628f4f', '#c5d98c'); }
      for (let k = 0; k < 5; k++) { const x = 90 + r() * 80, y = 30 + r() * 80; g.strokeStyle = '#8fa35f'; g.lineWidth = 3; g.beginPath(); g.moveTo(x, y + 60); g.quadraticCurveTo(x + 6, y + 200, 128, 512); g.stroke(); g.fillStyle = '#ddd8a8'; g.beginPath(); g.ellipse(x, y + 25, 4.5, 30, 0.15, 0, Math.PI * 2); g.fill(); }
    });
    // 2 broadleaf weed (mugwort / dock)
    cell(2, () => {
      for (let k = 0; k < 9; k++) {
        const a = (r() - 0.5) * 1.6, len = 180 + r() * 170, x = 128 + (r() - 0.5) * 40;
        blade(g, x, 512, len, a, 22 + r() * 12, '#5a8752', '#a9c97c');
        g.strokeStyle = 'rgba(70,110,60,0.6)'; g.lineWidth = 2; g.beginPath(); g.moveTo(x, 512); g.lineTo(x + Math.sin(a) * len * 0.95, 512 - Math.cos(a) * len * 0.95); g.stroke();
      }
    });
    // 3 mixed grass with a few dry blades
    cell(3, () => { for (let k = 0; k < 30; k++) { const a = (r() - 0.5) * 1.7, dry = r() < 0.3; blade(g, 128 + (r() - 0.5) * 80, 512, 160 + r() * 260, a, 5 + r() * 4, dry ? '#a39266' : '#66924f', dry ? '#e2d3a4' : '#b3d27c'); } });
  }, { key: 'env-tufts2' });

  const flowers = T.draw(1024, 512, (g) => {
    const r = R('flowers');
    g.clearRect(0, 0, 1024, 512);
    const cell = (i, fn) => { g.save(); g.translate((i % 4) * 256, Math.floor(i / 4) * 256); g.beginPath(); g.rect(0, 0, 256, 256); g.clip(); fn(); g.restore(); };
    const stem = (x0, y0, x1, y1, c = '#6c9a50', wd = 4) => { g.strokeStyle = c; g.lineWidth = wd; g.lineCap = 'round'; g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo((x0 + x1) / 2 + 8, (y0 + y1) / 2, x1, y1); g.stroke(); };
    const leaves = (n, len, wid, c0, c1) => { for (let k = 0; k < n; k++) blade(g, 128 + (r() - 0.5) * 40, 256, len * (0.6 + r() * 0.5), (r() - 0.5) * 2.4, wid, c0, c1); };
    const disc = (x, y, rad, petals, cOut, cIn) => {
      for (let p = 0; p < petals; p++) { const a = p / petals * Math.PI * 2; g.fillStyle = cOut; g.beginPath(); g.ellipse(x + Math.cos(a) * rad * 0.55, y + Math.sin(a) * rad * 0.55, rad * 0.5, rad * 0.2, a, 0, Math.PI * 2); g.fill(); }
      g.fillStyle = cIn; g.beginPath(); g.arc(x, y, rad * 0.35, 0, Math.PI * 2); g.fill();
    };
    // 0 dandelion
    cell(0, () => { leaves(7, 90, 12, '#5d8c48', '#8fbd5f'); for (const [x, y] of [[110, 70], [150, 105], [92, 125]]) { stem(128, 256, x, y + 10); disc(x, y, 34, 22, '#f5c52a', '#f09c1c'); g.fillStyle = 'rgba(255,240,150,0.7)'; g.beginPath(); g.arc(x - 6, y - 6, 9, 0, 7); g.fill(); } });
    // 1 dandelion puffs
    cell(1, () => { leaves(6, 80, 11, '#5d8c48', '#8fbd5f'); for (const [x, y, s] of [[108, 60, 1], [158, 96, 0.8]]) { stem(128, 256, x, y + 10, '#7d9c5c', 3); g.fillStyle = 'rgba(248,250,246,0.95)'; g.beginPath(); g.arc(x, y, 36 * s, 0, 7); g.fill(); g.strokeStyle = 'rgba(200,205,210,0.9)'; g.lineWidth = 1.5; for (let k = 0; k < 20; k++) { const a = k / 20 * 6.283; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * 34 * s, y + Math.sin(a) * 34 * s); g.stroke(); } } disc(96, 150, 26, 18, '#f5c52a', '#f09c1c'); });
    // 2 white clover
    cell(2, () => {
      for (let k = 0; k < 7; k++) { const x = 60 + r() * 136, y = 150 + r() * 70; stem(128 + (r() - 0.5) * 40, 256, x, y, '#6f9b56', 3); for (let l = 0; l < 3; l++) { const a = l / 3 * 6.283 + r(); g.fillStyle = l % 2 ? '#78a85c' : '#8dbb68'; g.beginPath(); g.ellipse(x + Math.cos(a) * 13, y + Math.sin(a) * 13, 14, 11, a, 0, 7); g.fill(); } }
      for (const [x, y] of [[100, 70], [160, 100]]) { stem(128, 256, x, y, '#7aa35e', 3); for (let k = 0; k < 26; k++) { const a = r() * 6.283, d = r() * 22; g.fillStyle = r() < 0.3 ? '#efe1e8' : '#fbfaf4'; g.beginPath(); g.ellipse(x + Math.cos(a) * d, y + Math.sin(a) * d, 7, 4, a, 0, 7); g.fill(); } }
    });
    // 3 violet (スミレ)
    cell(3, () => {
      for (let k = 0; k < 6; k++) { const a = (r() - 0.5) * 2.2, x = 128 + Math.sin(a) * 60, y = 200 - Math.cos(a) * 40; stem(128, 256, x, y, '#6a9650', 3); g.fillStyle = '#74a356'; g.beginPath(); g.moveTo(x, y + 18); g.bezierCurveTo(x - 30, y - 10, x - 5, y - 30, x, y - 12); g.bezierCurveTo(x + 5, y - 30, x + 30, y - 10, x, y + 18); g.fill(); }
      for (const [x, y] of [[98, 80], [150, 62], [172, 120], [110, 130]]) { stem(128, 256, x, y + 8, '#6a9650', 3); for (let p = 0; p < 5; p++) { const a = -Math.PI / 2 + (p - 2) * 0.9; g.fillStyle = p === 2 ? '#6d4fa8' : '#8e6fcb'; g.beginPath(); g.ellipse(x + Math.cos(a) * 12, y + Math.sin(a) * 12 + (p === 2 ? 6 : 0), 12, 7, a, 0, 7); g.fill(); } g.fillStyle = '#f3e7a0'; g.beginPath(); g.arc(x, y, 4, 0, 7); g.fill(); }
    });
    // 4 菜の花 (rape blossom): stalks + yellow clusters
    cell(4, () => {
      for (let k = 0; k < 4; k++) blade(g, 128 + (r() - 0.5) * 50, 256, 120 + r() * 60, (r() - 0.5) * 1.6, 16, '#5f8f65', '#88b57c');
      for (let s = 0; s < 4; s++) {
        const tx = 70 + s * 38 + (r() - 0.5) * 20, ty = 30 + r() * 50;
        stem(128 + (s - 1.5) * 10, 256, tx, ty + 30, '#6f9e5c', 4);
        for (let k = 0; k < 30; k++) { const a = r() * 6.283, d = r() * 24; const x = tx + Math.cos(a) * d, y = ty + Math.sin(a) * d * 0.75 + 10; g.fillStyle = r() < 0.2 ? '#efc93a' : (r() < 0.5 ? '#f8e05a' : '#fbe977'); g.beginPath(); g.arc(x, y, 3.5 + r() * 2.5, 0, 7); g.fill(); }
        g.fillStyle = 'rgba(255,248,190,0.9)'; g.beginPath(); g.arc(tx - 6, ty + 2, 6, 0, 7); g.fill();
      }
    });
    // 5 ホトケノザ (henbit): pink-purple whorls
    cell(5, () => {
      for (let s = 0; s < 5; s++) {
        const x = 70 + s * 30 + (r() - 0.5) * 16, top = 60 + r() * 60;
        stem(128 + (s - 2) * 8, 256, x, top, '#78985a', 3);
        for (let lv = 0; lv < 3; lv++) {
          const y = top + lv * 40; g.fillStyle = '#7aa25a'; g.beginPath(); g.ellipse(x - 12, y + 6, 13, 8, -0.3, 0, 7); g.ellipse(x + 12, y + 6, 13, 8, 0.3, 0, 7); g.fill();
          if (lv < 2) for (let k = 0; k < 4; k++) { g.fillStyle = k % 2 ? '#c46fa8' : '#d98cc0'; g.beginPath(); g.ellipse(x + (k - 1.5) * 7, y - 6, 4, 10, (k - 1.5) * 0.4, 0, 7); g.fill(); }
        }
      }
    });
    // 6 ハルジオン (fleabane)
    cell(6, () => {
      leaves(5, 90, 10, '#6a9553', '#99c06c');
      for (const [x, y] of [[90, 60], [130, 40], [170, 75], [112, 100], [150, 112]]) { stem(128, 256, x, y + 6, '#7ea560', 3); disc(x, y, 30, 26, r() < 0.4 ? '#f6dce8' : '#fbf7f2', '#f3cf45'); }
    });
    // 7 オオイヌノフグリ (speedwell): low mound + tiny blue flowers
    cell(7, () => {
      for (let k = 0; k < 40; k++) { const x = 30 + r() * 196, y = 150 + r() * 100; g.fillStyle = r() < 0.5 ? '#6e9c55' : '#86b364'; g.beginPath(); g.ellipse(x, y, 11, 8, r() * 3, 0, 7); g.fill(); }
      for (let k = 0; k < 22; k++) { const x = 40 + r() * 176, y = 140 + r() * 80; for (let p = 0; p < 4; p++) { const a = p * 1.571 + 0.3; g.fillStyle = p === 3 ? '#8fb7ec' : '#6c98e0'; g.beginPath(); g.ellipse(x + Math.cos(a) * 5, y + Math.sin(a) * 5, 6, 4.5, a, 0, 7); g.fill(); } g.fillStyle = '#f5f7ff'; g.beginPath(); g.arc(x, y, 2.2, 0, 7); g.fill(); }
    });
  }, { key: 'env-flowers2' });

  // ground-cover patches (lie flat)
  const mats = T.draw(512, 512, (g) => {
    const r = R('mats');
    g.clearRect(0, 0, 512, 512);
    const cell = (i, fn) => { g.save(); g.translate((i % 2) * 256, Math.floor(i / 2) * 256); g.beginPath(); g.rect(0, 0, 256, 256); g.clip(); fn(); g.restore(); };
    const inside = (x, y) => Math.hypot(x - 128, y - 128) < 100 + 18 * Math.sin(Math.atan2(y - 128, x - 128) * 5);
    // 0 clover patch
    cell(0, () => {
      for (let k = 0; k < 170; k++) { const x = 20 + r() * 216, y = 20 + r() * 216; if (!inside(x, y)) continue; for (let l = 0; l < 3; l++) { const a = l / 3 * 6.283 + r(); g.fillStyle = r() < 0.5 ? '#79a95c' : '#93c26b'; g.beginPath(); g.ellipse(x + Math.cos(a) * 7, y + Math.sin(a) * 7, 8, 6, a, 0, 7); g.fill(); } }
      for (let k = 0; k < 9; k++) { const x = 50 + r() * 156, y = 50 + r() * 156; if (!inside(x, y)) continue; for (let j = 0; j < 14; j++) { const a = r() * 6.283, d = r() * 11; g.fillStyle = '#fbf8f0'; g.beginPath(); g.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, 4, 0, 7); g.fill(); } }
    });
    // 1 speedwell mat
    cell(1, () => {
      for (let k = 0; k < 200; k++) { const x = 20 + r() * 216, y = 20 + r() * 216; if (!inside(x, y)) continue; g.fillStyle = r() < 0.5 ? '#6e9c55' : '#88b566'; g.beginPath(); g.ellipse(x, y, 8, 6, r() * 3, 0, 7); g.fill(); }
      for (let k = 0; k < 45; k++) { const x = 30 + r() * 196, y = 30 + r() * 196; if (!inside(x, y)) continue; g.fillStyle = r() < 0.5 ? '#6f9be2' : '#93b9ef'; g.beginPath(); g.arc(x, y, 5, 0, 7); g.fill(); g.fillStyle = '#f5f7ff'; g.beginPath(); g.arc(x, y, 1.6, 0, 7); g.fill(); }
    });
    // 2 short grass / moss mat
    cell(2, () => { for (let k = 0; k < 260; k++) { const x = 20 + r() * 216, y = 20 + r() * 216; if (!inside(x, y)) continue; g.fillStyle = ['#7aa45a', '#8fb96a', '#a4c877', '#6f9a55'][k % 4]; g.beginPath(); g.ellipse(x, y, 6 + r() * 5, 3 + r() * 3, r() * 3, 0, 7); g.fill(); } });
    // 3 dandelion rosette
    cell(3, () => {
      for (let k = 0; k < 11; k++) { const a = k / 11 * 6.283 + r() * 0.3, len = 70 + r() * 30; g.save(); g.translate(128, 128); g.rotate(a); g.fillStyle = k % 2 ? '#5f8f4a' : '#77a55a'; g.beginPath(); g.moveTo(0, -8); for (let j = 1; j <= 5; j++) { g.lineTo(len * j / 5, -12 + (j % 2) * 8); } g.lineTo(len, 0); for (let j = 5; j >= 1; j--) g.lineTo(len * j / 5 - 4, 12 - (j % 2) * 8); g.closePath(); g.fill(); g.restore(); }
      for (let p = 0; p < 24; p++) { const a = p / 24 * 6.283; g.fillStyle = '#f6c62c'; g.beginPath(); g.ellipse(128 + Math.cos(a) * 16, 128 + Math.sin(a) * 16, 15, 6, a, 0, 7); g.fill(); }
      g.fillStyle = '#ef9d1d'; g.beginPath(); g.arc(128, 128, 10, 0, 7); g.fill();
    });
  }, { key: 'env-mats' });

  const reeds = T.draw(512, 512, (g) => {
    const r = R('reeds');
    g.clearRect(0, 0, 512, 512);
    const cell = (i, fn) => { g.save(); g.translate(i * 256, 0); g.beginPath(); g.rect(0, 0, 256, 512); g.clip(); fn(); g.restore(); };
    // 0 fresh green reeds (young ヨシ)
    cell(0, () => { for (let k = 0; k < 30; k++) blade(g, 128 + (r() - 0.5) * 80, 512, 300 + r() * 200, (r() - 0.5) * 0.9, 5 + r() * 4, '#557f4d', r() < 0.5 ? '#a9cc80' : '#8cb56b'); });
    // 1 last year's dry stalks with plumes + new green at the base
    cell(1, () => {
      for (let k = 0; k < 9; k++) { const x = 60 + r() * 136, top = 20 + r() * 110; g.strokeStyle = r() < 0.5 ? '#d6c49c' : '#c4b08a'; g.lineWidth = 3.5; g.beginPath(); g.moveTo(128 + (x - 128) * 0.3, 512); g.quadraticCurveTo(x - 10, 300, x, top + 50); g.stroke(); for (let q = 0; q < 9; q++) { const a = 0.25 + q * 0.09 + (r() - 0.5) * 0.1, l = 26 + r() * 30; g.strokeStyle = q % 3 ? 'rgba(214,198,170,0.95)' : 'rgba(184,166,146,0.95)'; g.lineWidth = 3.2; g.beginPath(); g.moveTo(x, top + 44); g.quadraticCurveTo(x + Math.sin(a) * l * 0.6, top + 44 - Math.cos(a) * l * 0.5, x + Math.sin(a) * l, top + 44 - Math.cos(a) * l * 0.35 + l * 0.35); g.stroke(); } }
      for (let k = 0; k < 26; k++) blade(g, 128 + (r() - 0.5) * 90, 512, 160 + r() * 180, (r() - 0.5) * 1.2, 5, '#5b874f', '#a7c97d');
    });
  }, { key: 'env-reeds2' });

  // ---------------------------------------------------------------- field textures (tile 4 m)
  const field = (key, draw) => T.draw(256, 256, (g, w, h) => draw(g, w, h, R(key)), { key: 'env-field-' + key, repeat: [1, 1] });
  const fields = {
    dry: field('dry', (g, w, h, r) => { g.fillStyle = '#d9c7a4'; g.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 16) for (let x = 0; x < w; x += 16) { g.fillStyle = 'rgba(160,138,100,0.55)'; g.fillRect(x + 6 + (r() - 0.5) * 3, y + 5, 3, 7); } for (let i = 0; i < 30; i++) blotch(g, r() * w, r() * h, 20 + r() * 30, 'rgba(170,150,120,A)', 0.2); }),
    veg: field('veg', (g, w, h, r) => { g.fillStyle = '#d9c3a2'; g.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 32) { g.fillStyle = 'rgba(150,120,86,0.45)'; g.fillRect(0, y + 22, w, 10); for (let x = 0; x < w; x += 14) { g.fillStyle = r() < 0.5 ? '#7fae5c' : '#9cc76c'; g.beginPath(); g.ellipse(x + 7 + (r() - 0.5) * 4, y + 12, 7 + r() * 2, 6, 0, 0, 7); g.fill(); } } }),
    renge: field('renge', (g, w, h, r) => { g.fillStyle = '#9ec07a'; g.fillRect(0, 0, w, h); for (let i = 0; i < 700; i++) { g.fillStyle = r() < 0.6 ? '#d6a0cf' : (r() < 0.5 ? '#c887c2' : '#b4d38a'); g.beginPath(); g.arc(r() * w, r() * h, 2 + r() * 2.5, 0, 7); g.fill(); } }),
    wheat: field('wheat', (g, w, h, r) => { g.fillStyle = '#9dc56d'; g.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 12) { g.fillStyle = 'rgba(96,140,70,0.45)'; g.fillRect(0, y, w, 3); } for (let i = 0; i < 500; i++) { g.fillStyle = 'rgba(210,232,150,0.55)'; g.fillRect(r() * w, r() * h, 2, 5); } }),
    nano: field('nano', (g, w, h, r) => { g.fillStyle = '#9cbf62'; g.fillRect(0, 0, w, h); for (let i = 0; i < 900; i++) { g.fillStyle = r() < 0.7 ? '#f5d948' : '#ecc233'; g.beginPath(); g.arc(r() * w, r() * h, 2.5 + r() * 3, 0, 7); g.fill(); } }),
    grass: field('grass', (g, w, h, r) => { g.fillStyle = '#a9c983'; g.fillRect(0, 0, w, h); for (let i = 0; i < 600; i++) { g.fillStyle = r() < 0.5 ? 'rgba(130,170,100,0.5)' : 'rgba(210,228,160,0.5)'; g.fillRect(r() * w, r() * h, 2, 4); } for (let i = 0; i < 40; i++) { g.fillStyle = r() < 0.5 ? '#f3e7a0' : '#fbf8f0'; g.beginPath(); g.arc(r() * w, r() * h, 2, 0, 7); g.fill(); } }),
  };

  // ---------------------------------------------------------------- bridge railing (alpha)
  const railing = T.draw(256, 128, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = '#e9ecec';
    g.fillRect(0, 0, w, 16); g.fillRect(0, h - 14, w, 14);
    for (let x = 6; x < w; x += 21) g.fillRect(x, 10, 7, h - 20);
    g.fillStyle = 'rgba(160,168,172,1)'; g.fillRect(0, 13, w, 3);
  }, { key: 'env-railing', repeat: [1, 1] });

  // ---------------------------------------------------------------- flowering shrub (tsutsuji) texture
  const shrub = T.draw(256, 256, (g, w, h) => {
    const r = R('shrub');
    g.fillStyle = '#6a9658'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 70; i++) { const x = r() * w, y = r() * h; wrap(w, h, (ox, oy) => { g.fillStyle = '#5a8650'; g.beginPath(); g.arc(x + ox + 3, y + oy + 4, 15, 0, 7); g.fill(); g.fillStyle = r() < 0.5 ? '#78a462' : '#83ae69'; g.beginPath(); g.arc(x + ox, y + oy, 13, 0, 7); g.fill(); }); }
    for (let i = 0; i < 300; i++) { g.fillStyle = r() < 0.5 ? 'rgba(80,120,70,0.5)' : 'rgba(170,205,130,0.45)'; g.beginPath(); g.ellipse(r() * w, r() * h, 4, 2.5, r() * 3, 0, 7); g.fill(); }
    const cols = [['#f2a6c4', '#fbd9e6'], ['#ea8fb5', '#f7c3d7'], ['#faf3f4', '#f3dde6']];
    for (let i = 0; i < 34; i++) {
      const cx = r() * w, cy = r() * h, [c0, c1] = cols[r() < 0.45 ? 0 : r() < 0.6 ? 1 : 2];
      wrap(w, h, (ox, oy) => { for (let k = 0; k < 6; k++) { const a = r() * 6.283, d = r() * 9; g.fillStyle = k < 4 ? c0 : c1; g.beginPath(); g.arc(cx + ox + Math.cos(a) * d, cy + oy + Math.sin(a) * d, 3.6 + r() * 1.6, 0, 7); g.fill(); } });
    }
  }, { key: 'env-shrub2', repeat: [1, 1] });

  // ---------------------------------------------------------------- far school / building facade
  // far house facade (multiplied by the instance wall colour): 2 storeys of windows, a door, eaves shadow
  const facade = T.draw(256, 128, (g, w, h) => {
    g.fillStyle = '#f4f2ee'; g.fillRect(0, 0, w, h);
    const gr = g.createLinearGradient(0, 0, 0, 22); gr.addColorStop(0, 'rgba(120,118,140,0.45)'); gr.addColorStop(1, 'rgba(120,118,140,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, 22);
    g.fillStyle = 'rgba(150,146,138,0.55)'; g.fillRect(0, 62, w, 4);
    for (const [x, y, ww, hh] of [[24, 20, 46, 28], [104, 22, 30, 24], [176, 20, 52, 28], [22, 78, 60, 32], [150, 80, 40, 28]]) {
      g.fillStyle = '#8c9fb0'; g.fillRect(x, y, ww, hh); g.fillStyle = '#c9d6df'; g.fillRect(x, y, ww, 6);
      g.fillStyle = '#e9e7e1'; g.fillRect(x - 3, y + hh, ww + 6, 4);
    }
    g.fillStyle = '#7b6a5c'; g.fillRect(206, 76, 26, 50); g.fillStyle = '#d7d1c5'; g.fillRect(200, 72, 38, 5);
  }, { key: 'env-facade' });
  const school = T.draw(512, 128, (g, w, h) => {
    g.fillStyle = '#f1efe8'; g.fillRect(0, 0, w, h);
    for (let f = 0; f < 3; f++) for (let i = 0; i < 16; i++) { g.fillStyle = '#8fa7ba'; g.fillRect(8 + i * 31.5, 12 + f * 38, 24, 22); g.fillStyle = '#dfe7ee'; g.fillRect(8 + i * 31.5, 12 + f * 38, 24, 5); }
    g.fillStyle = '#c9c3b6'; for (let f = 0; f < 3; f++) g.fillRect(0, 36 + f * 38, w, 3);
  }, { key: 'env-school' });

  return { ground, levee, masonry, path, tufts, flowers, mats, reeds, fields, railing, shrub, school, facade, FONTS };
}
