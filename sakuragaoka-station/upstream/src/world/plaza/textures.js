// Canvas textures for the station plaza. All ground/stone textures are authored for UVs in metres:
// each texture's `repeat` = 1 / (its real-world size), so geometry just stores metres in its UVs.
import * as THREE from 'three';

const hsl = (h, s, l, a = 1) => `hsla(${h},${s}%,${l}%,${a})`;

export function makeTextures(ctx) {
  const { tex } = ctx;
  const F = tex.FONTS;
  const T = {};

  // ------------------------------------------------------------------ helpers
  const txt = (g, s, x, y, size, font, color, weight = 700, align = 'center', base = 'middle', maxW = 0) => {
    g.fillStyle = color; g.textAlign = align; g.textBaseline = base;
    if (maxW) tex.fitText(g, s, x, y, maxW, size, font, weight);
    else { g.font = `${weight} ${size}px ${font}`; g.fillText(s, x, y); }
  };
  const rr = (g, x, y, w, h, r, fill, stroke, lw = 2) => {
    tex.roundRect(g, x, y, w, h, r);
    if (fill) { g.fillStyle = fill; g.fill(); }
    if (stroke) { g.lineWidth = lw; g.strokeStyle = stroke; g.stroke(); }
  };
  const blotch = (g, x, y, r, color, a) => {
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, color.replace('A', a)); gr.addColorStop(1, color.replace('A', 0));
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  };
  const sakuraIcon = (g, x, y, r, col = '#ef9fbe', core = '#d9718f') => {
    g.save(); g.translate(x, y);
    for (let i = 0; i < 5; i++) {
      g.rotate(Math.PI * 2 / 5);
      g.beginPath(); g.fillStyle = col;
      g.ellipse(0, -r * 0.55, r * 0.36, r * 0.55, 0, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.fillStyle = '#fbe9ef'; g.moveTo(0, -r * 1.08); g.lineTo(-r * 0.1, -r * 0.9); g.lineTo(r * 0.1, -r * 0.9); g.fill();
    }
    g.beginPath(); g.fillStyle = core; g.arc(0, 0, r * 0.2, 0, Math.PI * 2); g.fill();
    g.restore();
  };
  T.sakuraIcon = sakuraIcon;

  // ------------------------------------------------------------------ paving tiles (5 m x 5 m, 0.5 m tiles)
  T.tiles = tex.draw(1024, 1024, (g, w, h) => {
    const r = ctx.rng('plaza-tiles');
    const n = 10, s = w / n, j = 5;
    g.fillStyle = '#a9a69b'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < n; i++) for (let k = 0; k < n; k++) {
      const x = i * s + j / 2, y = k * s + j / 2, sz = s - j;
      const l = 80 + r.range(-2.6, 2.6), hue = r.chance(0.5) ? 45 + r.range(-10, 10) : 210 + r.range(-15, 15), sat = r.range(2, 6);
      g.fillStyle = hsl(hue, sat, l); g.fillRect(x, y, sz, sz);
      // soft wash inside each tile
      blotch(g, x + r.range(0.2, 0.8) * sz, y + r.range(0.2, 0.8) * sz, sz * r.range(0.35, 0.7), 'rgba(120,118,110,A)', r.range(0.03, 0.08));
      // fine grain
      for (let d = 0; d < 26; d++) { g.fillStyle = `rgba(${r.chance(0.5) ? '90,88,84' : '255,255,250'},${r.range(0.04, 0.1)})`; g.fillRect(x + r() * sz, y + r() * sz, r.range(1, 2.5), r.range(1, 2.5)); }
      // dusty edge
      g.strokeStyle = 'rgba(130,122,105,0.16)'; g.lineWidth = 5; g.strokeRect(x + 2.5, y + 2.5, sz - 5, sz - 5);
      if (r.chance(0.1)) blotch(g, x + r() * sz, y + r() * sz, r.range(14, 34), 'rgba(110,104,96,A)', 0.14);   // stain
      if (r.chance(0.025)) { // hairline crack
        g.strokeStyle = 'rgba(95,92,88,0.45)'; g.lineWidth = 1.3; g.beginPath();
        let cx = x + r() * sz, cy = y; g.moveTo(cx, cy);
        for (let q = 0; q < 5; q++) { cx += r.range(-10, 10); cy += sz / 5; g.lineTo(cx, cy); } g.stroke();
      }
      if (r.chance(0.07)) { g.fillStyle = '#b3b0a6'; g.beginPath(); const cx = x + (r.chance(0.5) ? 0 : sz), cy = y + (r.chance(0.5) ? 0 : sz); g.arc(cx, cy, r.range(5, 9), 0, Math.PI * 2); g.fill(); }
    }
    // tiny weeds / moss in a few joints
    for (let q = 0; q < 7; q++) {
      const cx = Math.round(r() * n) * s, cy = r() * h, vert = r.chance(0.5);
      const X = vert ? cx : cy, Y = vert ? cy : cx;
      g.fillStyle = 'rgba(118,146,86,0.55)';
      for (let b = 0; b < 12; b++) g.fillRect(X + (vert ? r.range(-2, 2) : r.range(-12, 12)), Y + (vert ? r.range(-12, 12) : r.range(-2, 2)), 3, 3);
      g.strokeStyle = '#7fa35a'; g.lineWidth = 2;
      for (let b = 0; b < 5; b++) { g.beginPath(); const bx = X + r.range(-4, 4), by = Y + r.range(-4, 4); g.moveTo(bx, by); g.lineTo(bx + r.range(-7, 7), by + r.range(-9, 9)); g.stroke(); }
    }
  }, { key: 'plaza-tiles', repeat: [1 / 5, 1 / 5] });

  // ------------------------------------------------------------------ granite setts (2.4 m x 1.2 m, courses 0.3 m, slabs 0.6 m)
  T.granite = tex.draw(512, 256, (g, w, h) => {
    const r = ctx.rng('plaza-granite');
    g.fillStyle = '#8f8e89'; g.fillRect(0, 0, w, h);
    const rows = 4, cols = 4, rh = h / rows, cw = w / cols, j = 3;
    for (let k = 0; k < rows; k++) for (let i = -1; i < cols; i++) {
      const off = (k % 2) * cw / 2;
      const x = i * cw + off + j / 2, y = k * rh + j / 2;
      const l = 67 + r.range(-4, 4);
      g.fillStyle = hsl(40 + r.range(-20, 30), 3 + r.range(0, 4), l); g.fillRect(x, y, cw - j, rh - j);
      for (let d = 0; d < 260; d++) { const c = r(); g.fillStyle = c < 0.45 ? 'rgba(70,70,78,0.35)' : c < 0.8 ? 'rgba(240,238,232,0.4)' : 'rgba(160,130,120,0.3)'; g.fillRect(x + r() * (cw - j), y + r() * (rh - j), r.range(1, 3), r.range(1, 3)); }
      g.strokeStyle = 'rgba(245,242,235,0.25)'; g.lineWidth = 2; g.beginPath(); g.moveTo(x + 2, y + 2); g.lineTo(x + cw - j - 2, y + 2); g.stroke();
    }
  }, { key: 'plaza-granite', repeat: [1 / 2.4, 1 / 1.2] });

  // ------------------------------------------------------------------ curb stone (0.6 m blocks along u, 0.3 m in v)
  T.curb = tex.draw(256, 128, (g, w, h) => {
    const r = ctx.rng('plaza-curb');
    g.fillStyle = '#c9c7bf'; g.fillRect(0, 0, w, h);
    for (let d = 0; d < 700; d++) { const c = r(); g.fillStyle = c < 0.5 ? 'rgba(90,90,96,0.22)' : 'rgba(250,248,240,0.35)'; g.fillRect(r() * w, r() * h, r.range(1, 2.5), r.range(1, 2.5)); }
    blotch(g, w * 0.3, h * 0.2, 60, 'rgba(120,115,104,A)', 0.12);
    g.fillStyle = 'rgba(120,112,100,0.22)'; g.fillRect(0, 0, w, 10); // road grime at the bottom
  }, { key: 'plaza-curb', repeat: [1 / 0.6, 1 / 0.3] });

  // ------------------------------------------------------------------ tree-circle pavers (polar: u = 1/6 of the circle, v = radius)
  T.circle = tex.draw(1024, 256, (g, w, h) => {
    const r = ctx.rng('plaza-circle');
    g.fillStyle = '#b4a891'; g.fillRect(0, 0, w, h);
    const r0 = 1.62, r1 = 3.55, courses = 8;
    for (let c = 0; c < courses; c++) {
      const ra = r0 + (r1 - r0) * c / courses, rb = r0 + (r1 - r0) * (c + 1) / courses;
      const arc = (Math.PI / 3) * (ra + rb) / 2;
      const nb = Math.max(4, Math.round(arc / 0.26));
      const y0 = h - (c + 1) * h / courses, ch = h / courses;
      const off = (c % 2) * 0.5;
      for (let b = -1; b <= nb; b++) {
        const x0 = ((b + off) / nb) * w, bw = w / nb;
        const outer = c === courses - 1;
        let col;
        if (outer) col = hsl(40, 4, 62 + r.range(-3, 3));
        else if (r.chance(0.14)) col = hsl(350 + r.range(-8, 8), 14 + r.range(0, 7), 81 + r.range(-3, 3));
        else col = hsl(36 + r.range(-6, 6), 16 + r.range(-4, 6), 79 + r.range(-4, 3));
        g.fillStyle = col; g.fillRect(x0 + 2, y0 + 2, bw - 4, ch - 4);
        for (let d = 0; d < 10; d++) { g.fillStyle = `rgba(90,80,70,${r.range(0.05, 0.12)})`; g.fillRect(x0 + r() * bw, y0 + r() * ch, 2, 2); }
        g.strokeStyle = 'rgba(120,108,90,0.15)'; g.lineWidth = 3; g.strokeRect(x0 + 3.5, y0 + 3.5, bw - 7, ch - 7);
      }
    }
  }, { key: 'plaza-circle' });
  T.circle.wrapS = THREE.RepeatWrapping;

  // ------------------------------------------------------------------ brick (1.1 m x 0.45 m)
  T.brick = tex.draw(512, 256, (g, w, h) => {
    const r = ctx.rng('plaza-brick');
    g.fillStyle = '#d6cdbd'; g.fillRect(0, 0, w, h);
    const rows = 6, cols = 5, rh = h / rows, cw = w / cols;
    for (let k = 0; k < rows; k++) for (let i = -1; i <= cols; i++) {
      const x = i * cw + (k % 2) * cw / 2 + 3, y = k * rh + 3;
      g.fillStyle = hsl(12 + r.range(-6, 8), 30 + r.range(-6, 8), 55 + r.range(-6, 6)); g.fillRect(x, y, cw - 6, rh - 6);
      g.fillStyle = 'rgba(255,240,225,0.12)'; g.fillRect(x, y, cw - 6, 5);
      if (r.chance(0.25)) blotch(g, x + r() * cw, y + rh / 2, 20, 'rgba(90,60,50,A)', 0.2);
    }
    // lower moss/damp line
    const gr = g.createLinearGradient(0, h, 0, h * 0.6); gr.addColorStop(0, 'rgba(100,120,80,0.28)'); gr.addColorStop(1, 'rgba(100,120,80,0)');
    g.fillStyle = gr; g.fillRect(0, h * 0.6, w, h * 0.4);
  }, { key: 'plaza-brick', repeat: [1 / 1.1, 1 / 0.45] });

  // ------------------------------------------------------------------ light concrete (1 m)
  T.concrete = tex.draw(256, 256, (g, w, h) => {
    const r = ctx.rng('plaza-concrete');
    g.fillStyle = '#d3d0c7'; g.fillRect(0, 0, w, h);
    for (let d = 0; d < 900; d++) { g.fillStyle = r.chance(0.5) ? 'rgba(100,98,92,0.12)' : 'rgba(255,255,250,0.22)'; g.fillRect(r() * w, r() * h, 1.5, 1.5); }
    for (let d = 0; d < 5; d++) blotch(g, r() * w, r() * h, r.range(20, 60), 'rgba(130,126,116,A)', 0.12);
    const gr = g.createLinearGradient(0, h, 0, h * 0.7); gr.addColorStop(0, 'rgba(110,105,95,0.25)'); gr.addColorStop(1, 'rgba(110,105,95,0)');
    g.fillStyle = gr; g.fillRect(0, h * 0.7, w, h * 0.3);
  }, { key: 'plaza-concrete', repeat: [1, 1] });

  // ------------------------------------------------------------------ wood slats (1.2 m along u)
  T.wood = tex.draw(256, 128, (g, w, h) => {
    const r = ctx.rng('plaza-wood');
    g.fillStyle = '#d8b58c'; g.fillRect(0, 0, w, h);
    for (let k = 0; k < 9; k++) {
      g.strokeStyle = `rgba(140,95,60,${r.range(0.18, 0.35)})`; g.lineWidth = r.range(1, 2.5);
      g.beginPath(); let y = r() * h; g.moveTo(0, y);
      for (let x = 0; x <= w; x += 32) { y += r.range(-3, 3); g.lineTo(x, y); } g.stroke();
    }
    for (let k = 0; k < 2; k++) { g.fillStyle = 'rgba(130,85,55,0.35)'; g.beginPath(); g.ellipse(r() * w, r() * h, 7, 3, 0, 0, Math.PI * 2); g.fill(); }
    blotch(g, w * 0.6, h * 0.5, 70, 'rgba(120,90,70,A)', 0.12);
  }, { key: 'plaza-wood', repeat: [1 / 1.2, 1 / 0.3] });

  // ------------------------------------------------------------------ soil (1 m)
  T.soil = tex.draw(256, 256, (g, w, h) => {
    const r = ctx.rng('plaza-soil');
    g.fillStyle = '#93795e'; g.fillRect(0, 0, w, h);
    for (let d = 0; d < 1400; d++) { const c = r(); g.fillStyle = c < 0.4 ? 'rgba(70,52,40,0.3)' : c < 0.8 ? 'rgba(190,165,130,0.3)' : 'rgba(120,140,90,0.35)'; g.fillRect(r() * w, r() * h, r.range(1, 4), r.range(1, 4)); }
    for (let d = 0; d < 6; d++) blotch(g, r() * w, r() * h, r.range(20, 50), 'rgba(80,62,48,A)', 0.2);
  }, { key: 'plaza-soil', repeat: [1, 1] });

  // ------------------------------------------------------------------ leafy (hedges / shrubs, 1 m)
  T.leafy = tex.draw(256, 256, (g, w, h) => {
    const r = ctx.rng('plaza-leafy');
    g.fillStyle = '#86a86e'; g.fillRect(0, 0, w, h);
    for (let d = 0; d < 360; d++) {
      const c = r(); g.fillStyle = c < 0.45 ? 'rgba(70,108,74,0.22)' : c < 0.85 ? 'rgba(170,200,120,0.22)' : 'rgba(215,230,150,0.3)';
      g.beginPath(); g.ellipse(r() * w, r() * h, r.range(3, 7), r.range(2, 4), r() * 3, 0, Math.PI * 2); g.fill();
    }
  }, { key: 'plaza-leafy', repeat: [1, 1] });
  // azalea (ツツジ) in bloom: the same leaves under clusters of pink / white blossoms
  T.azalea = tex.draw(256, 256, (g, w, h) => {
    const r = ctx.rng('plaza-azalea');
    g.fillStyle = '#86a86e'; g.fillRect(0, 0, w, h);
    for (let d = 0; d < 260; d++) {
      const c = r(); g.fillStyle = c < 0.5 ? 'rgba(70,108,74,0.22)' : 'rgba(170,200,120,0.24)';
      g.beginPath(); g.ellipse(r() * w, r() * h, r.range(3, 7), r.range(2, 4), r() * 3, 0, Math.PI * 2); g.fill();
    }
    const cols = ['#f3a9c2', '#ee93b2', '#f8cbd9', '#f6f0f2'];
    for (let k = 0; k < 34; k++) {
      const cx = r() * w, cy = r() * h, col = cols[k % 4 === 3 && r.chance(0.5) ? 3 : r.int(0, 2)];
      for (let i = 0; i < 5; i++) {
        const a = i / 5 * Math.PI * 2 + r.range(-0.3, 0.3), d = r.range(5, 9);
        g.fillStyle = col; g.beginPath(); g.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, r.range(5, 7), 0, Math.PI * 2); g.fill();
      }
      g.fillStyle = 'rgba(214,110,150,0.8)'; g.beginPath(); g.arc(cx, cy, 2.2, 0, Math.PI * 2); g.fill();
    }
  }, { key: 'plaza-azalea', repeat: [1, 1] });

  // ------------------------------------------------------------------ tactile blocks (0.3 m)
  const tactile = (kind) => tex.draw(128, 128, (g, w, h) => {
    g.fillStyle = '#e6c350'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(150,110,30,0.55)'; g.lineWidth = 3; g.strokeRect(1.5, 1.5, w - 3, h - 3);
    if (kind === 'dots') {
      for (let i = 0; i < 5; i++) for (let k = 0; k < 5; k++) {
        const x = 14 + i * 25, y = 14 + k * 25;
        g.fillStyle = 'rgba(160,118,35,0.55)'; g.beginPath(); g.arc(x + 1.5, y + 2, 8.5, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#f2d56a'; g.beginPath(); g.arc(x, y, 7.5, 0, Math.PI * 2); g.fill();
      }
    } else if (kind === 'barsV') {
      for (let i = 0; i < 4; i++) {
        const x = 18 + i * 31;
        rr(g, x - 7 + 2, 10, 15, h - 18, 7, 'rgba(160,118,35,0.55)');
        rr(g, x - 7, 8, 14, h - 18, 7, '#f2d56a');
      }
    } else {
      for (let i = 0; i < 4; i++) {
        const y = 18 + i * 31;
        rr(g, 10, y - 7 + 2, w - 18, 15, 7, 'rgba(160,118,35,0.55)');
        rr(g, 8, y - 7, w - 18, 14, 7, '#f2d56a');
      }
    }
    blotch(g, w * 0.7, h * 0.4, 50, 'rgba(120,100,70,A)', 0.14);
  }, { key: 'plaza-tactile-' + kind, repeat: [1 / 0.3, 1 / 0.3] });
  T.tacDots = tactile('dots');
  T.tacBarsV = tactile('barsV');   // bars run along canvas y (= geometry v)
  T.tacBarsU = tactile('barsU');   // bars run along canvas x (= geometry u)

  // ------------------------------------------------------------------ sakura-flower paving inlay (alpha cut-out)
  T.inlay = tex.draw(1024, 1024, (g, w, h) => {
    const r = ctx.rng('plaza-inlay');
    g.clearRect(0, 0, w, h);
    const cx = w / 2, cy = h / 2, R = w * 0.47;
    const petal = (a) => {
      g.save(); g.translate(cx, cy); g.rotate(a);
      g.beginPath(); g.moveTo(0, -R * 0.16);
      g.bezierCurveTo(R * 0.52, -R * 0.3, R * 0.5, -R * 0.88, R * 0.13, -R * 0.99);
      g.lineTo(0, -R * 0.85); g.lineTo(-R * 0.13, -R * 0.99);
      g.bezierCurveTo(-R * 0.5, -R * 0.88, -R * 0.52, -R * 0.3, 0, -R * 0.16);
      g.closePath(); g.restore();
    };
    for (let i = 0; i < 5; i++) {
      const a = i * Math.PI * 2 / 5;
      petal(a); g.lineWidth = 34; g.strokeStyle = '#a3a098'; g.stroke(); g.fillStyle = '#b09c98'; g.fill();
      g.save(); petal(a); g.clip(); g.translate(cx, cy); g.rotate(a);
      const th = 44, tw = 60;
      for (let y = -R, k = 0; y < 0; y += th, k++) for (let x = -R * 0.6 - (k % 2) * tw / 2; x < R * 0.6; x += tw) {
        const t = -y / R;
        const c = r.chance(0.5) ? hsl(350 + r.range(-6, 6), 30 + r.range(-6, 6) - t * 8, 82 + r.range(-3, 3) - t * 3) : hsl(20 + r.range(-10, 10), 22, 83 + r.range(-3, 3));
        g.fillStyle = c; g.fillRect(x + 3, y + 3, tw - 6, th - 6);
      }
      g.restore();
      petal(a); g.lineWidth = 6; g.strokeStyle = '#8c8980'; g.stroke();
    }
    // centre: granite disc with a light ring
    g.fillStyle = '#a3a098'; g.beginPath(); g.arc(cx, cy, R * 0.24, 0, 7); g.fill();
    g.fillStyle = '#d9c7c2'; g.beginPath(); g.arc(cx, cy, R * 0.19, 0, 7); g.fill();
    g.fillStyle = '#b8b4ab'; g.beginPath(); g.arc(cx, cy, R * 0.15, 0, 7); g.fill();
    for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * Math.PI * 2 / 5 + Math.PI / 5; g.fillStyle = '#e8b8c4'; g.beginPath(); g.arc(cx + Math.cos(a) * R * 0.2, cy + Math.sin(a) * R * 0.2, 9, 0, 7); g.fill(); }
  }, { key: 'plaza-inlay' });

  // ------------------------------------------------------------------ soft dust / stain alpha
  T.dust = tex.draw(256, 256, (g, w, h) => {
    const r = ctx.rng('plaza-dust');
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
    for (let d = 0; d < 14; d++) blotch(g, w / 2 + r.range(-60, 60), h / 2 + r.range(-60, 60), r.range(30, 80), 'rgba(255,255,255,A)', r.range(0.12, 0.3));
  }, { key: 'plaza-dust' });
  T.moss = tex.draw(128, 128, (g, w, h) => {
    const r = ctx.rng('plaza-moss');
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
    for (let d = 0; d < 40; d++) { g.fillStyle = '#fff'; g.beginPath(); g.arc(w / 2 + r.range(-38, 38) * r(), h / 2 + r.range(-38, 38) * r(), r.range(4, 12), 0, Math.PI * 2); g.fill(); }
  }, { key: 'plaza-moss' });

  // ------------------------------------------------------------------ foliage sprites (alpha)
  T.grass = tex.draw(256, 256, (g, w, h) => {
    const r = ctx.rng('plaza-grass');
    for (let b = 0; b < 22; b++) {
      const x = w * 0.5 + r.range(-80, 80), lean = r.range(-50, 50), top = r.range(20, 120);
      g.fillStyle = r.chance(0.4) ? '#9cc070' : r.chance(0.5) ? '#7ea85f' : '#b8d487';
      g.beginPath(); g.moveTo(x - 7, h); g.quadraticCurveTo(x + lean * 0.3, h * 0.6, x + lean, top); g.quadraticCurveTo(x + lean * 0.3 + 4, h * 0.62, x + 7, h); g.closePath(); g.fill();
    }
  }, { key: 'plaza-grass' });
  T.daisy = tex.draw(128, 128, (g, w, h) => {
    g.translate(w / 2, h / 2);
    for (let i = 0; i < 14; i++) { g.rotate(Math.PI * 2 / 14); g.fillStyle = i % 2 ? '#fbf8f1' : '#f1ece6'; g.beginPath(); g.ellipse(0, -34, 8, 26, 0, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = '#f0c238'; g.beginPath(); g.arc(0, 0, 17, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#d9a52a'; g.beginPath(); g.arc(3, 3, 9, 0, Math.PI * 2); g.fill();
  }, { key: 'plaza-daisy' });
  T.pansy = tex.draw(128, 128, (g, w, h) => {
    g.translate(w / 2, h / 2 + 4);
    const petal = (x, y, rx, ry, c) => { g.fillStyle = c; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); g.fill(); };
    petal(-22, -30, 26, 30, '#ffffff'); petal(22, -30, 26, 30, '#ffffff');
    petal(-32, 4, 26, 24, '#f4f2f8'); petal(32, 4, 26, 24, '#f4f2f8');
    petal(0, 26, 34, 30, '#f7f5fa');
    g.fillStyle = 'rgba(58,40,70,0.85)'; g.beginPath(); g.ellipse(0, 12, 20, 18, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(58,40,70,0.5)'; g.beginPath(); g.ellipse(-20, 2, 12, 9, 0.5, 0, Math.PI * 2); g.ellipse(20, 2, 12, 9, -0.5, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#f5d24a'; g.beginPath(); g.arc(0, 2, 6, 0, Math.PI * 2); g.fill();
  }, { key: 'plaza-pansy' });
  T.tinyFlower = tex.draw(128, 128, (g, w, h) => {
    const r = ctx.rng('plaza-tiny');
    for (let q = 0; q < 7; q++) {
      const x = r.range(20, 108), y = r.range(20, 108), s = r.range(8, 13);
      g.save(); g.translate(x, y);
      for (let i = 0; i < 6; i++) { g.rotate(Math.PI / 3); g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(0, -s * 0.6, s * 0.3, s * 0.6, 0, 0, Math.PI * 2); g.fill(); }
      g.fillStyle = '#f3d35a'; g.beginPath(); g.arc(0, 0, s * 0.22, 0, Math.PI * 2); g.fill(); g.restore();
    }
  }, { key: 'plaza-tiny' });
  T.dandelion = tex.draw(128, 128, (g, w, h) => {
    g.translate(w / 2, h / 2);
    for (let i = 0; i < 28; i++) { g.rotate(Math.PI * 2 / 28); g.fillStyle = i % 2 ? '#f5cf32' : '#f0bf22'; g.beginPath(); g.ellipse(0, -30, 4, 26, 0, 0, Math.PI * 2); g.fill(); }
    for (let i = 0; i < 18; i++) { g.rotate(Math.PI * 2 / 18); g.fillStyle = '#f7d84a'; g.beginPath(); g.ellipse(0, -16, 3.5, 14, 0, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = '#e8b21c'; g.beginPath(); g.arc(0, 0, 8, 0, Math.PI * 2); g.fill();
  }, { key: 'plaza-dandelion' });
  T.leafClump = tex.draw(256, 256, (g, w, h) => {
    const r = ctx.rng('plaza-leafclump');
    const cols = ['#5f9150', '#72a35d', '#86b56b', '#9cc57a'];
    for (let i = 0; i < 16; i++) {
      const a = -Math.PI / 2 + r.range(-1.25, 1.25), len = r.range(70, 118), wd = r.range(26, 40);
      const bx = w / 2 + r.range(-26, 26), by = h - 6;
      const tx = bx + Math.cos(a) * len, ty = by + Math.sin(a) * len;
      g.save(); g.translate((bx + tx) / 2, (by + ty) / 2); g.rotate(a + Math.PI / 2);
      g.fillStyle = cols[i % 4]; g.beginPath(); g.ellipse(0, 0, wd / 2, len / 2, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(60,90,50,0.45)'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, len / 2 - 4); g.lineTo(0, -len / 2 + 8); g.stroke();
      g.restore();
    }
  }, { key: 'plaza-leafclump' });
  T.rosette = tex.draw(128, 128, (g, w, h) => {
    g.translate(w / 2, h / 2);
    for (let i = 0; i < 9; i++) {
      g.rotate(Math.PI * 2 / 9 + 0.2); g.fillStyle = i % 2 ? '#79a45a' : '#8fb86a';
      g.beginPath(); g.moveTo(0, 0); g.lineTo(-8, -20); g.lineTo(-4, -26); g.lineTo(-9, -36); g.lineTo(0, -60); g.lineTo(9, -36); g.lineTo(4, -26); g.lineTo(8, -20); g.closePath(); g.fill();
    }
  }, { key: 'plaza-rosette' });

  return T;
}
