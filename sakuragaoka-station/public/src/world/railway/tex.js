// Hand-painted canvas textures for the railway corridor (ballast, sleepers, ground strip, troughs,
// walkway slabs, wire-mesh fence, weed atlas) + all trackside sign faces.
// Every painter is deterministic (ctx.rng) and cached by key.
import * as THREE from 'three';

export function hexToRgb(h) {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function shade(h, f, add = 0) {
  const [r, g, b] = hexToRgb(h);
  const c = (v) => Math.max(0, Math.min(255, Math.round(v * f + add)));
  return '#' + [c(r), c(g), c(b)].map(v => v.toString(16).padStart(2, '0')).join('');
}
export function mixHex(a, b, t) {
  const A = hexToRgb(a), B = hexToRgb(b);
  return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('');
}
const wpick = (r, list) => { let s = 0; for (const it of list) s += it[1]; let v = r() * s; for (const it of list) { v -= it[1]; if (v <= 0) return it[0]; } return list[0][0]; };

function polyPath(g, cx, cy, pts, s = 1, ox = 0, oy = 0) {
  g.beginPath();
  for (let i = 0; i < pts.length; i++) { const X = cx + ox + pts[i][0] * s, Y = cy + oy + pts[i][1] * s; if (i) g.lineTo(X, Y); else g.moveTo(X, Y); }
  g.closePath();
}
function stonePts(r, rad, flat = 0.88) {
  const n = 5 + Math.floor(r() * 3), a0 = r() * 6.283, pts = [];
  for (let k = 0; k < n; k++) {
    const a = a0 + (k / n) * 6.283 + (r() - 0.5) * 0.7;
    const rr = rad * (0.7 + r() * 0.42);
    pts.push([Math.cos(a) * rr * 1.1, Math.sin(a) * rr * flat]);
  }
  return pts;
}
/** Paint one stone (shadow, body, highlight) at cx,cy — sun comes from the left / lower-left of the map. */
function paintStone(g, cx, cy, pts, col, rad) {
  g.fillStyle = 'rgba(70,64,66,0.38)'; polyPath(g, cx, cy, pts, 1.04, rad * 0.14, -rad * 0.1); g.fill();
  g.fillStyle = col; polyPath(g, cx, cy, pts); g.fill();
  g.fillStyle = shade(col, 1.08, 6); polyPath(g, cx, cy, pts, 0.58, -rad * 0.18, rad * 0.1); g.fill();
  g.fillStyle = shade(col, 0.93); polyPath(g, cx, cy, pts, 0.4, rad * 0.26, -rad * 0.2); g.fill();
}
const BALLAST_COLS = [['#8f8c86', 24], ['#86837e', 18], ['#77746f', 13], ['#9a958d', 10], ['#8d7d6f', 10], ['#a09384', 6], ['#b4aea3', 6], ['#81858b', 6], ['#6f6a64', 4]];

export function makeRailTextures(ctx) {
  const { tex } = ctx;
  const FONTS = tex.FONTS;
  const T = {};

  // ---------------------------------------------------------------- ballast (tiles every 1.7 m)
  T.ballast = tex.draw(512, 512, (g, w, h) => {
    const r = ctx.rng('rw-ballast-tex');
    g.fillStyle = '#6c6864'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2300; i++) {
      const x = r() * w, y = r() * h, rad = 3.8 + r() * r() * 6.5 + r() * 2;
      const pts = stonePts(r, rad), col = shade(wpick(r, BALLAST_COLS), 0.93 + r() * 0.14);
      for (const dx of [-w, 0, w]) for (const dy of [-h, 0, h]) {
        const X = x + dx, Y = y + dy;
        if (X < -20 || X > w + 20 || Y < -20 || Y > h + 20) continue;
        paintStone(g, X, Y, pts, col, rad);
      }
    }
  }, { key: 'rw-ballast', repeat: [1, 1] });

  // ---------------------------------------------------------------- PC (concrete) sleeper: u along the 2.0 m length
  T.pc = tex.draw(256, 64, (g, w, h) => {
    const r = ctx.rng('rw-pc-tex');
    g.fillStyle = '#d2cfc7'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '150,146,138' : '226,223,216'},${0.08 + r() * 0.12})`; g.beginPath(); g.ellipse(r() * w, r() * h, 6 + r() * 20, 3 + r() * 8, r() * 3, 0, 6.3); g.fill(); }
    // rail seats (darker pads + rust drips) at 0.217 / 0.783 of the length
    for (const u of [0.217, 0.783]) {
      g.fillStyle = 'rgba(96,86,80,0.35)'; g.fillRect(u * w - 13, 0, 26, h);
      for (let k = 0; k < 5; k++) { g.fillStyle = `rgba(150,108,82,${0.12 + r() * 0.15})`; g.beginPath(); g.ellipse(u * w + (r() - 0.5) * 34, r() * h, 4 + r() * 7, 2 + r() * 4, 0, 0, 6.3); g.fill(); }
    }
    // end darkening + chamfer lines
    const gr = g.createLinearGradient(0, 0, w, 0);
    gr.addColorStop(0, 'rgba(120,114,106,0.35)'); gr.addColorStop(0.08, 'rgba(120,114,106,0)'); gr.addColorStop(0.92, 'rgba(120,114,106,0)'); gr.addColorStop(1, 'rgba(120,114,106,0.35)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(110,104,98,0.35)'; g.fillRect(0, 0, w, 2); g.fillRect(0, h - 2, w, 2);
    // tiny cast mark
    g.fillStyle = 'rgba(120,115,108,0.45)'; g.font = `700 9px ${FONTS.sans}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('3PC', w * 0.5, h * 0.5);
  }, { key: 'rw-pc' });

  // ---------------------------------------------------------------- wooden sleeper: grain along u
  T.wood = tex.draw(256, 64, (g, w, h) => {
    const r = ctx.rng('rw-wood-tex');
    g.fillStyle = '#86705c'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 26; i++) {
      const y = r() * h, c = r() < 0.5 ? 'rgba(92,72,58,0.45)' : 'rgba(160,136,112,0.35)';
      g.strokeStyle = c; g.lineWidth = 1 + r() * 2; g.beginPath(); g.moveTo(0, y);
      for (let x = 0; x <= w; x += 16) g.lineTo(x, y + Math.sin(x * 0.03 + i) * 2.2 + (r() - 0.5) * 1.2);
      g.stroke();
    }
    for (let i = 0; i < 7; i++) { // checks / cracks
      const x = r() < 0.5 ? r() * 40 : w - r() * 40, y = 6 + r() * (h - 12);
      g.strokeStyle = 'rgba(58,44,36,0.7)'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 70, y + (r() - 0.5) * 5); g.stroke();
    }
    for (const u of [0.23, 0.77]) { g.fillStyle = 'rgba(52,40,34,0.35)'; g.beginPath(); g.ellipse(u * w, h / 2, 26, h * 0.62, 0, 0, 6.3); g.fill(); }
    const gr = g.createLinearGradient(0, 0, w, 0);
    gr.addColorStop(0, 'rgba(70,56,46,0.5)'); gr.addColorStop(0.06, 'rgba(70,56,46,0)'); gr.addColorStop(0.94, 'rgba(70,56,46,0)'); gr.addColorStop(1, 'rgba(70,56,46,0.5)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  }, { key: 'rw-wood' });

  // ---------------------------------------------------------------- corridor ground strip: u along x (8 m), v across (0 = ballast toe .. 1 = fence)
  // Packed pale earth with crisp fine gravel, a spill of ballast at the toe, a softly trodden band
  // along the walkway and a ragged grass verge at the fence (canvas top = fence side).
  T.strip = tex.draw(1024, 512, (g, w, h) => {
    const r = ctx.rng('rw-strip-tex2');
    const wrapX = (fn) => { for (const dx of [-w, 0, w]) fn(dx); };
    const blot = (x, y, rx, ry, c, rot = 0) => wrapX((dx) => { if (x + dx + rx < 0 || x + dx - rx > w) return; g.fillStyle = c; g.beginPath(); g.ellipse(x + dx, y, rx, ry, rot, 0, 6.3); g.fill(); });
    // base: vertical gradient (slightly warmer & darker toward the fence where it is damp)
    const bg = g.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#b7ae98'); bg.addColorStop(0.35, '#bfb6a1'); bg.addColorStop(0.7, '#c2baa6'); bg.addColorStop(1, '#b3ac9e');
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    // broad soft washes (hand-painted unevenness, low contrast)
    for (let i = 0; i < 90; i++) blot(r() * w, r() * h, 40 + r() * 110, 10 + r() * 26, `rgba(${r() < 0.5 ? '160,150,132' : '210,203,188'},${0.1 + r() * 0.12})`, (r() - 0.5) * 0.3);
    // trodden lighter band along the walkway (canvas y ~0.44..0.62)
    for (let i = 0; i < 70; i++) blot(r() * w, h * (0.45 + r() * 0.16), 30 + r() * 70, 4 + r() * 8, `rgba(214,207,192,${0.14 + r() * 0.14})`);
    // fine gravel: crisp small dots in 4 tones
    const GR = ['rgba(128,120,108,0.75)', 'rgba(150,143,131,0.7)', 'rgba(222,216,203,0.8)', 'rgba(170,158,140,0.7)'];
    for (let i = 0; i < 26000; i++) { const x = r() * w, y = r() * h; g.fillStyle = GR[(r() * 4) | 0]; const s = 1 + r() * 1.8; g.fillRect(x, y, s, s * (0.7 + r() * 0.5)); }
    // small pebbles with a light top and a soft shadow (2..5 px ~ 1.5..4 cm)
    for (let i = 0; i < 1500; i++) {
      const x = r() * w, y = r() * h, rad = 1.6 + r() * r() * 3.4;
      const col = shade(wpick(r, BALLAST_COLS), 1.02 + r() * 0.1);
      const pts = stonePts(r, rad, 0.8);
      wrapX((dx) => { if (x + dx < -8 || x + dx > w + 8) return; paintStone(g, x + dx, y, pts, col, rad); });
    }
    // spilled ballast near the toe (canvas bottom), density falling off upward
    for (let i = 0; i < 1700; i++) {
      const y = h - Math.pow(r(), 2.6) * h * 0.22, x = r() * w, rad = 2.6 + r() * 3.4;
      const pts = stonePts(r, rad), col = wpick(r, BALLAST_COLS);
      wrapX((dx) => { if (x + dx < -10 || x + dx > w + 10) return; paintStone(g, x + dx, y, pts, col, rad); });
    }
    // damp darker line where the trough sits (canvas y ~0.87) and along the drain (~0.18)
    for (let i = 0; i < 50; i++) blot(r() * w, h * (0.86 + r() * 0.04), 20 + r() * 50, 2 + r() * 4, `rgba(132,128,112,${0.1 + r() * 0.1})`);
    // grass verge at the top with a ragged lower edge, painted as short strokes
    const edge = []; for (let x = 0; x <= w; x += 8) edge.push(h * 0.2 + Math.sin(x * 0.012) * 12 + Math.sin(x * 0.041 + 2) * 7 + (r() - 0.5) * 8);
    edge[edge.length - 1] = edge[0];
    g.fillStyle = '#9dbf7c'; g.beginPath(); g.moveTo(0, 0); edge.forEach((y, i) => g.lineTo(i * 8, y)); g.lineTo(w, 0); g.closePath(); g.fill();
    for (let i = 0; i < 260; i++) blot(r() * w, r() * h * 0.2, 10 + r() * 30, 3 + r() * 8, r() < 0.5 ? 'rgba(128,168,100,0.35)' : 'rgba(184,212,142,0.35)');
    const GREENS = ['#86ad69', '#95bb74', '#a9cb85', '#7aa062', '#b9d493'];
    for (let i = 0; i < 5200; i++) {
      const x = r() * w, ei = Math.min(edge.length - 1, Math.max(0, Math.round(x / 8)));
      const y = r() * (edge[ei] + 10) - 4; if (y > edge[ei] + 6) continue;
      const len = 4 + r() * 9, a = (r() - 0.5) * 0.9;
      g.strokeStyle = GREENS[(r() * GREENS.length) | 0]; g.lineWidth = 1 + r() * 1.3; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.sin(a) * len, y - Math.cos(a) * len); g.stroke();
    }
    // grass tongues reaching into the gravel + a few isolated tufts
    for (let i = 0; i < 70; i++) {
      const cx = r() * w, cy = h * (0.22 + r() * 0.5), n = 8 + (r() * 16 | 0);
      for (let k = 0; k < n; k++) { const x = cx + (r() - 0.5) * 16, y = cy + (r() - 0.5) * 6, len = 3 + r() * 6, a = (r() - 0.5) * 1.1; g.strokeStyle = GREENS[(r() * GREENS.length) | 0]; g.lineWidth = 1 + r(); g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.sin(a) * len, y - Math.cos(a) * len); g.stroke(); }
    }
    // tiny flowers in the verge (white clover, yellow, lilac speedwell, pink)
    for (let i = 0; i < 420; i++) { const x = r() * w, y = r() * h * 0.19; g.fillStyle = r() < 0.4 ? '#f4f1e6' : r() < 0.6 ? '#f1d04a' : r() < 0.8 ? '#aeb8ee' : '#eab6ca'; g.beginPath(); g.arc(x, y, 1.1 + r() * 1.3, 0, 6.3); g.fill(); }
    // moss specks near the drain
    for (let i = 0; i < 60; i++) blot(r() * w, h * (0.16 + r() * 0.06), 6 + r() * 18, 2 + r() * 4, `rgba(118,146,92,${0.18 + r() * 0.16})`);
  }, { key: 'rw-strip2', repeat: [1, 1] });

  // ---------------------------------------------------------------- cable trough lids (1 m along u)
  T.trough = tex.draw(256, 64, (g, w, h) => {
    const r = ctx.rng('rw-trough-tex');
    g.fillStyle = '#c3c0b7'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(${r() < 0.6 ? '150,146,138' : '214,210,202'},${0.1 + r() * 0.15})`; g.beginPath(); g.ellipse(r() * w, r() * h, 6 + r() * 18, 3 + r() * 7, 0, 0, 6.3); g.fill(); }
    for (const x of [0, 128]) {
      g.fillStyle = 'rgba(92,86,82,0.85)'; g.fillRect(x, 0, 3, h); g.fillRect((x + w - 2) % w, 0, 2, h);
      g.fillStyle = 'rgba(110,104,98,0.6)'; g.fillRect(x + 56, h * 0.42, 16, 4); // lifting notch
    }
    g.fillStyle = 'rgba(96,90,84,0.5)'; g.fillRect(0, 0, w, 3); g.fillRect(0, h - 3, w, 3);
    for (let i = 0; i < 8; i++) { g.fillStyle = `rgba(118,136,96,${0.15 + r() * 0.2})`; g.beginPath(); g.ellipse(r() < 0.5 ? r() * 10 : 128 + (r() - 0.5) * 12, r() * h, 3 + r() * 6, 2 + r() * 4, 0, 0, 6.3); g.fill(); }
  }, { key: 'rw-trough', repeat: [1, 1] });

  // ---------------------------------------------------------------- walkway slabs (0.6 x 0.6 m, 2 slabs along u)
  T.slab = tex.draw(256, 128, (g, w, h) => {
    const r = ctx.rng('rw-slab-tex');
    for (let s = 0; s < 2; s++) {
      g.fillStyle = shade('#c7c4bb', 0.94 + r() * 0.1); g.fillRect(s * 128, 0, 128, h);
      for (let i = 0; i < 14; i++) { g.fillStyle = `rgba(${r() < 0.6 ? '150,146,138' : '220,216,208'},${0.08 + r() * 0.12})`; g.beginPath(); g.ellipse(s * 128 + r() * 128, r() * h, 5 + r() * 16, 3 + r() * 8, 0, 0, 6.3); g.fill(); }
      if (r() < 0.6) { g.strokeStyle = 'rgba(110,104,98,0.45)'; g.lineWidth = 1; g.beginPath(); let x = s * 128 + 20 + r() * 80, y = 0; g.moveTo(x, y); while (y < h) { x += (r() - 0.5) * 16; y += 8 + r() * 10; g.lineTo(x, y); } g.stroke(); }
    }
    g.fillStyle = 'rgba(96,98,84,0.9)'; g.fillRect(0, 0, 3, h); g.fillRect(126, 0, 4, h); g.fillRect(w - 2, 0, 2, h);
    for (let i = 0; i < 26; i++) { g.fillStyle = `rgba(116,146,92,${0.35 + r() * 0.3})`; const x = r() < 0.5 ? 128 + (r() - 0.5) * 6 : r() * 4; g.beginPath(); g.ellipse(x, r() * h, 2 + r() * 3, 2 + r() * 5, 0, 0, 6.3); g.fill(); }
  }, { key: 'rw-slab', repeat: [1, 1] });

  // ---------------------------------------------------------------- green diamond wire mesh (alpha), tile = 0.3 m
  T.mesh = tex.draw(128, 128, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    const n = 6, s = w / n;
    const line = (x0, y0, x1, y1) => { g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); };
    for (const pass of [0, 1]) {
      g.strokeStyle = pass ? '#86b594' : '#4c7d5d'; g.lineWidth = pass ? 1.0 : 2.7;
      for (let i = -n; i <= 2 * n; i++) {
        line(i * s - (pass ? 0.6 : 0), 0, i * s + h - (pass ? 0.6 : 0), h);
        line(i * s + (pass ? 0.6 : 0), 0, i * s - h + (pass ? 0.6 : 0), h);
      }
    }
  }, { key: 'rw-mesh2', repeat: [1, 1] });

  // ---------------------------------------------------------------- weed atlas (4 x 2 cells of 256 px)
  T.weeds = tex.draw(1024, 512, (g) => paintWeedAtlas(g, ctx.rng('rw-weeds-tex')), { key: 'rw-weeds' });

  // ---------------------------------------------------------------- sign faces: ONE shared 1024² atlas
  // Every sign painter draws at its design size into a shelf-packed region of the atlas (scaled), so all
  // sign planes share a single material and batch into a handful of draw calls. Regions are
  // { map, u0, v0, u1, v1 }; use T.signMesh(kit, region, w, h, pos, rot) to place one.
  const AW = 1024, AH = 1024, PAD = 4;
  const atlas = tex.draw(AW, AH, (g) => { g.fillStyle = '#e2e0da'; g.fillRect(0, 0, AW, AH); }, { key: 'rw-sign-atlas' });
  atlas.anisotropy = 8;
  const ag = atlas.image.getContext('2d');
  const shelves = []; let yTop = 0;
  const alloc = (w, h) => {
    const W2 = w + PAD * 2, H2 = h + PAD * 2;
    let best = null;
    for (const s of shelves) if (s.h >= H2 && AW - s.x >= W2 && (!best || s.h < best.h)) best = s;
    if (!best) { if (yTop + H2 > AH) return null; best = { y: yTop, h: H2, x: 0 }; shelves.push(best); yTop += H2; }
    const r = { x: best.x + PAD, y: best.y + PAD, w, h }; best.x += W2; return r;
  };
  const regions = new Map();
  const region = (key, w, h, dw, dh, painter) => {
    if (regions.has(key)) return regions.get(key);
    const rc = alloc(w, h);
    let reg;
    if (!rc) { T.atlasFallbacks = (T.atlasFallbacks || 0) + 1; // atlas full: fall back to an own canvas (never expected, keeps the build safe)
      reg = { map: tex.draw(dw, dh, painter, { key: 'rw-fb|' + key }), u0: 0, v0: 0, u1: 1, v1: 1 };
    } else {
      // bleed pass (stretched over the padding) + exact pass, so mipmaps never sample neighbours
      ag.save(); ag.beginPath(); ag.rect(rc.x - PAD, rc.y - PAD, w + 2 * PAD, h + 2 * PAD); ag.clip();
      ag.translate(rc.x - PAD, rc.y - PAD); ag.scale((w + 2 * PAD) / dw, (h + 2 * PAD) / dh); painter(ag, dw, dh); ag.restore();
      ag.save(); ag.translate(rc.x, rc.y); ag.beginPath(); ag.rect(0, 0, w, h); ag.clip(); ag.scale(w / dw, h / dh); painter(ag, dw, dh); ag.restore();
      atlas.needsUpdate = true;
      reg = { map: atlas, u0: (rc.x + 0.5) / AW, u1: (rc.x + w - 0.5) / AW, v1: 1 - (rc.y + 0.5) / AH, v0: 1 - (rc.y + h - 0.5) / AH };
    }
    regions.set(key, reg);
    return reg;
  };
  const geoCache = new Map();
  T.signGeo = (reg) => {
    const k = [reg.u0, reg.v0, reg.u1, reg.v1].join(',') + (reg.map === atlas ? '' : reg.map.uuid);
    if (geoCache.has(k)) return geoCache.get(k);
    const g = new THREE.PlaneGeometry(1, 1); const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, reg.u0 + uv.getX(i) * (reg.u1 - reg.u0), reg.v0 + uv.getY(i) * (reg.v1 - reg.v0));
    geoCache.set(k, g); return g;
  };
  T.signMat = (reg) => ctx.mat.toon('#ffffff', { map: reg.map, paint: 0.02 });
  /** Place a sign face (faces local +Z) of w×h metres. */
  T.signMesh = (kit, reg, w, h, pos, rot) => { const m = kit.mesh(T.signGeo(reg), T.signMat(reg), pos, rot, [w, h, 1]); m.castShadow = false; m.receiveShadow = true; return m; };

  const S = {};
  T.sign = S;
  S.emergency = region('emergency', 256, 320, 512, 640, (g, w, h) => {
    g.fillStyle = '#f4f2ec'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#2f5ea8'; g.fillRect(0, 0, w, 120);
    g.fillStyle = '#f6f4ee'; g.textAlign = 'center'; g.textBaseline = 'middle';
    tex.fitText(g, '緊急連絡先', w / 2, 62, w - 60, 78, FONTS.sans, 900);
    g.fillStyle = '#35303c';
    tex.fitText(g, '踏切や線路内で', w / 2, 170, w - 60, 40, FONTS.sans, 700);
    tex.fitText(g, '異常を見つけたときは', w / 2, 220, w - 60, 40, FONTS.sans, 700);
    tex.fitText(g, 'すぐにご連絡ください', w / 2, 270, w - 60, 40, FONTS.sans, 700);
    g.fillStyle = '#c93a34'; tex.roundRect(g, 36, 312, w - 72, 120, 12); g.fill();
    g.fillStyle = '#f6f4ee'; tex.fitText(g, '☎ 0120-390-783', w / 2, 356, w - 100, 58, FONTS.sans, 900);
    tex.fitText(g, '24時間受付', w / 2, 410, w - 100, 28, FONTS.sans, 700);
    g.fillStyle = '#35303c';
    tex.fitText(g, '桜川電鉄 桜ヶ丘駅', w / 2, 482, w - 60, 42, FONTS.sans, 900);
    tex.fitText(g, '桜川線 第1踏切 付近  8K562M', w / 2, 540, w - 60, 28, FONTS.sans, 500);
    g.fillStyle = '#2f5ea8'; g.fillRect(0, h - 40, w, 40);
    g.fillStyle = '#f6f4ee'; tex.fitText(g, 'EMERGENCY CONTACT · SAKURAGAWA RAILWAY', w / 2, h - 20, w - 40, 20, FONTS.en, 700);
  });
  S.kiken = region('kiken', 336, 252, 512, 384, (g, w, h) => {
    g.fillStyle = '#f3f1ea'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#c93a34'; tex.roundRect(g, 18, 18, w - 36, 96, 10); g.fill();
    g.fillStyle = '#f6f2ea'; g.textAlign = 'center'; g.textBaseline = 'middle';
    tex.fitText(g, '危　険', w / 2, 68, w - 80, 66, FONTS.sans, 900);
    g.fillStyle = '#c93a34'; tex.fitText(g, '線路内立入禁止', w / 2, 178, w - 60, 74, FONTS.sans, 900);
    g.fillStyle = '#35303c'; tex.fitText(g, '列車にはねられる危険があります', w / 2, 252, w - 70, 30, FONTS.sans, 700);
    g.fillStyle = '#35303c'; g.fillRect(40, 290, w - 80, 3);
    tex.fitText(g, '桜川電鉄', w / 2, 334, w - 80, 38, FONTS.sans, 700);
    g.strokeStyle = '#c93a34'; g.lineWidth = 6; tex.roundRect(g, 5, 5, w - 10, h - 10, 12); g.stroke();
  });
  S.tachiiri = region('tachiiri', 336, 252, 512, 384, (g, w, h) => {
    g.fillStyle = '#f3f1ea'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#35303c'; g.textAlign = 'center'; g.textBaseline = 'middle';
    tex.fitText(g, '関係者以外', w / 2, 70, w - 90, 54, FONTS.sans, 900);
    g.fillStyle = '#c93a34'; tex.fitText(g, '立入禁止', w / 2, 170, w - 70, 118, FONTS.sans, 900);
    g.fillStyle = '#35303c'; tex.fitText(g, 'KEEP OUT', w / 2, 256, w - 90, 34, FONTS.en, 700);
    g.fillRect(40, 290, w - 80, 3);
    tex.fitText(g, '桜川電鉄 保線区', w / 2, 334, w - 80, 36, FONTS.sans, 700);
    g.strokeStyle = '#35303c'; g.lineWidth = 5; tex.roundRect(g, 5, 5, w - 10, h - 10, 12); g.stroke();
  });
  S.hv = region('hv', 160, 120, 256, 192, (g, w, h) => {
    g.fillStyle = '#f0c93a'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#35303c'; g.beginPath(); g.moveTo(w / 2, 14); g.lineTo(w / 2 + 44, 90); g.lineTo(w / 2 - 44, 90); g.closePath(); g.fill();
    g.fillStyle = '#f0c93a'; g.beginPath(); g.moveTo(w / 2 + 4, 34); g.lineTo(w / 2 - 12, 62); g.lineTo(w / 2 + 2, 62); g.lineTo(w / 2 - 6, 84); g.lineTo(w / 2 + 14, 54); g.lineTo(w / 2 + 1, 54); g.closePath(); g.fill();
    g.fillStyle = '#35303c'; g.textAlign = 'center'; g.textBaseline = 'middle';
    tex.fitText(g, '高電圧危険', w / 2, 124, w - 30, 40, FONTS.sans, 900);
    tex.fitText(g, 'さわるな', w / 2, 166, w - 40, 30, FONTS.sans, 700);
    g.strokeStyle = '#35303c'; g.lineWidth = 6; g.strokeRect(3, 3, w - 6, h - 6);
  });
  S.num = (txt, bg = '#f4f2ec', fg = '#35303c', sub = '') => region('num|' + txt + '|' + bg + '|' + fg + '|' + sub, 96, 96, 128, 128, (g, w, h) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
    tex.fitText(g, txt, w / 2, sub ? h * 0.44 : h * 0.54, w - 16, sub ? 78 : 96, FONTS.sans, 900);
    if (sub) tex.fitText(g, sub, w / 2, h * 0.84, w - 20, 22, FONTS.sans, 700);
    g.strokeStyle = fg; g.lineWidth = 5; g.strokeRect(4, 4, w - 8, h - 8);
  });
  S.km = (km, hm) => region(`km|${km}|${hm}`, 80, 120, 128, 192, (g, w, h) => {
    g.fillStyle = '#f2f0ea'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#2f2c36'; g.textAlign = 'center'; g.textBaseline = 'middle';
    tex.fitText(g, String(km), w / 2, 58, w - 20, 92, FONTS.sans, 900);
    g.fillRect(22, 108, w - 44, 5);
    tex.fitText(g, String(hm), w / 2, 150, w - 30, 62, FONTS.sans, 900);
  });
  S.plate = (lines, key, w = 256, h = 128, opts = {}) => region('plate|' + key, Math.round(w * 0.5), Math.round(h * 0.5), w, h, (g) => {
    g.fillStyle = opts.bg || '#f2f0ea'; g.fillRect(0, 0, w, h);
    g.fillStyle = opts.fg || '#35303c'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const n = lines.length;
    lines.forEach((ln, i) => tex.fitText(g, ln.t, w / 2, h * (i + 0.5) / n + (ln.dy || 0), w - 20, ln.s || h / n * 0.66, ln.f || FONTS.sans, ln.wt || 900));
    if (opts.border !== false) { g.strokeStyle = opts.fg || '#35303c'; g.lineWidth = 4; g.strokeRect(3, 3, w - 6, h - 6); }
  });
  S.box = region('box', 160, 240, 256, 384, (g, w, h) => { // equipment cabinet door face
    const r = ctx.rng('rw-box-tex');
    g.fillStyle = '#b4b9bc'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 30; i++) { g.fillStyle = `rgba(${r() < 0.6 ? '140,146,150' : '205,210,212'},${0.08 + r() * 0.12})`; g.beginPath(); g.ellipse(r() * w, r() * h, 8 + r() * 26, 4 + r() * 14, 0, 0, 6.3); g.fill(); }
    g.fillStyle = 'rgba(82,86,92,0.8)'; g.fillRect(w / 2 - 2, 20, 3, h - 34); g.fillRect(14, 16, w - 28, 3); g.fillRect(14, h - 16, w - 28, 3); g.fillRect(14, 16, 3, h - 30); g.fillRect(w - 17, 16, 3, h - 30);
    for (let i = 0; i < 6; i++) { g.fillStyle = 'rgba(92,96,102,0.7)'; g.fillRect(32, h - 90 + i * 10, 74, 4); g.fillRect(w - 106, h - 90 + i * 10, 74, 4); }
    g.fillStyle = '#5b5f66'; tex.roundRect(g, w / 2 - 22, h * 0.48, 10, 40, 4); g.fill(); tex.roundRect(g, w / 2 + 12, h * 0.48, 10, 40, 4); g.fill();
    g.fillStyle = '#f2f0ea'; g.fillRect(34, 44, w - 68, 70); g.strokeStyle = '#35303c'; g.lineWidth = 2; g.strokeRect(34, 44, w - 68, 70);
    g.fillStyle = '#35303c'; g.textAlign = 'center'; g.textBaseline = 'middle';
    tex.fitText(g, '信号機器箱', w / 2, 68, w - 90, 30, FONTS.sans, 900);
    tex.fitText(g, '桜川電鉄 電気区', w / 2, 98, w - 90, 20, FONTS.sans, 700);
    g.fillStyle = '#f0c93a'; g.fillRect(58, 132, w - 116, 50); g.fillStyle = '#35303c'; tex.fitText(g, '⚡ 高電圧注意', w / 2, 158, w - 130, 26, FONTS.sans, 900);
    for (let i = 0; i < 6; i++) { g.fillStyle = `rgba(150,110,86,${0.12 + r() * 0.12})`; g.fillRect(20 + r() * (w - 40), 0, 2 + r() * 3, 30 + r() * 80); }
  });
  S.speed = (v) => region('speed|' + v, 96, 96, 128, 128, (g, w, h) => {
    g.fillStyle = '#f2c13a'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#2f2c36'; g.textAlign = 'center'; g.textBaseline = 'middle';
    tex.fitText(g, String(v), w / 2, h * 0.56, w - 18, 96, FONTS.sans, 900);
    g.strokeStyle = '#2f2c36'; g.lineWidth = 6; g.strokeRect(4, 4, w - 8, h - 8);
  });
  S.pm = region('pm', 192, 96, 256, 128, (g, w, h) => { // point machine side
    g.fillStyle = '#a3a9ad'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#f0c93a'; for (let i = -4; i < 20; i++) { g.beginPath(); g.moveTo(i * 22, h); g.lineTo(i * 22 + 11, h); g.lineTo(i * 22 + 11 + 26, h - 26); g.lineTo(i * 22 + 26, h - 26); g.closePath(); g.fill(); }
    g.fillStyle = '#35303c'; g.fillRect(0, h - 28, w, 2);
    g.fillStyle = '#f2f0ea'; g.fillRect(70, 22, 116, 44); g.fillStyle = '#35303c'; g.textAlign = 'center'; g.textBaseline = 'middle';
    tex.fitText(g, '21ロ 転てつ器', 128, 44, 106, 22, FONTS.sans, 900);
    g.fillStyle = 'rgba(82,86,92,0.7)'; g.fillRect(8, 8, w - 16, 3);
  });
  T.atlasFill = () => yTop / AH;
  return T;
}

// ---------------------------------------------------------------------------------------------
//  Weed atlas painter. Cells (256 px): 0 grass tuft, 1 tall grass, 2 dandelion, 3 dandelion clocks,
//  4 菜の花 (rape blossom), 5 ヒメジョオン daisies, 6 ホトケノザ / オオイヌノフグリ, 7 つくし & スギナ.
// ---------------------------------------------------------------------------------------------
function paintWeedAtlas(g, r) {
  g.clearRect(0, 0, 1024, 512);
  const cell = (i) => ({ ox: (i % 4) * 256, oy: Math.floor(i / 4) * 256 });
  const blade = (x, y, len, ang, wid, col, bend = 0.25) => {
    const dx = Math.sin(ang), dy = -Math.cos(ang);
    const tx = x + dx * len + bend * len * Math.sign(ang || 1) * 0.3, ty = y + dy * len;
    const nx = -dy, ny = dx;
    g.fillStyle = col; g.beginPath();
    g.moveTo(x - nx * wid / 2, y - ny * wid / 2);
    g.quadraticCurveTo(x + dx * len * 0.55 - nx * wid * 0.35, y + dy * len * 0.55 - ny * wid * 0.35, tx, ty);
    g.quadraticCurveTo(x + dx * len * 0.55 + nx * wid * 0.35, y + dy * len * 0.55 + ny * wid * 0.35, x + nx * wid / 2, y + ny * wid / 2);
    g.closePath(); g.fill();
    return [tx, ty];
  };
  const stem = (pts, w, col) => { g.strokeStyle = col; g.lineWidth = w; g.lineCap = 'round'; g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); if (pts.length === 3) g.quadraticCurveTo(pts[1][0], pts[1][1], pts[2][0], pts[2][1]); else for (const p of pts.slice(1)) g.lineTo(p[0], p[1]); g.stroke(); };
  const dot = (x, y, rad, col) => { g.fillStyle = col; g.beginPath(); g.arc(x, y, rad, 0, 6.3); g.fill(); };
  const GREENS = ['#6f9d58', '#7fae62', '#8fbd6c', '#a6cc7a', '#b8d68a'];
  const tuft = (ox, oy, n, lenLo, lenHi, spread, wid) => {
    const bx = ox + 128;
    for (let k = 0; k < n; k++) {
      const t = k / n, col = GREENS[Math.min(4, Math.floor(t * 4.2 + r() * 1.3))];
      blade(bx + (r() - 0.5) * 60, oy + 250, lenLo + r() * (lenHi - lenLo), (r() - 0.5) * spread, wid * (0.7 + r() * 0.6), col, r() * 0.6);
    }
  };
  // 0 grass tuft
  { const { ox, oy } = cell(0); tuft(ox, oy, 22, 110, 230, 1.3, 11); }
  // 1 tall grass with seed heads
  {
    const { ox, oy } = cell(1); tuft(ox, oy, 16, 150, 240, 0.9, 9);
    for (let k = 0; k < 5; k++) {
      const x0 = ox + 100 + r() * 56, top = [x0 + (r() - 0.5) * 70, oy + 14 + r() * 40];
      stem([[x0, oy + 250], [x0 + (top[0] - x0) * 0.3, oy + 130], top], 2.4, '#94a86a');
      for (let j = 0; j < 9; j++) { g.fillStyle = j % 2 ? '#cbc493' : '#b5ae7c'; g.beginPath(); g.ellipse(top[0] + (r() - 0.5) * 8, top[1] + j * 5, 3.2, 6, (r() - 0.5) * 0.8, 0, 6.3); g.fill(); }
    }
  }
  // 2 dandelion (たんぽぽ)
  const rosette = (ox, oy, n) => {
    for (let k = 0; k < n; k++) {
      const ang = (k / (n - 1) - 0.5) * 2.6 + (r() - 0.5) * 0.3, len = 60 + r() * 50;
      const [tx, ty] = blade(ox + 128, oy + 250, len, ang, 26, k % 2 ? '#79a45c' : '#6b9652', 0.1);
      g.fillStyle = 'rgba(0,0,0,0)';
      for (let j = 1; j < 4; j++) { const f = j / 4; dot(ox + 128 + (tx - ox - 128) * f, oy + 250 + (ty - oy - 250) * f, 6, k % 2 ? '#79a45c' : '#6b9652'); }
    }
  };
  {
    const { ox, oy } = cell(2); rosette(ox, oy, 8);
    for (let k = 0; k < 3; k++) {
      const hx = ox + 78 + k * 48 + (r() - 0.5) * 16, hy = oy + 60 + r() * 60;
      stem([[ox + 128 + (k - 1) * 10, oy + 248], [hx + (r() - 0.5) * 20, (hy + oy + 248) / 2], [hx, hy]], 4, '#9dbb72');
      if (k === 2) { g.fillStyle = '#86aa5e'; g.beginPath(); g.ellipse(hx, hy, 9, 15, 0.2, 0, 6.3); g.fill(); dot(hx, hy - 10, 6, '#f0c84a'); continue; }
      for (let j = 0; j < 22; j++) { const a = j / 22 * 6.283; g.fillStyle = j % 2 ? '#f2c43a' : '#f6d25a'; g.beginPath(); g.ellipse(hx + Math.cos(a) * 14, hy + Math.sin(a) * 9, 7, 3, a, 0, 6.3); g.fill(); }
      dot(hx, hy, 11, '#f4cf48'); dot(hx - 2, hy - 2, 6, '#f9e27a'); dot(hx + 1, hy + 2, 4, '#e2a52c');
    }
  }
  // 3 dandelion clocks (綿毛)
  {
    const { ox, oy } = cell(3); rosette(ox, oy, 7);
    for (let k = 0; k < 2; k++) {
      const hx = ox + 96 + k * 64 + (r() - 0.5) * 12, hy = oy + 46 + r() * 40;
      stem([[ox + 124 + k * 8, oy + 248], [hx - 8, (hy + oy + 248) / 2], [hx, hy]], 3.5, '#a4bd82');
      dot(hx, hy, 30, '#eeede6');
      g.strokeStyle = '#f9f8f3'; g.lineWidth = 1.6; for (let j = 0; j < 36; j++) { const a = j / 36 * 6.283; g.beginPath(); g.moveTo(hx, hy); g.lineTo(hx + Math.cos(a) * 36, hy + Math.sin(a) * 36); g.stroke(); }
      dot(hx, hy, 24, '#f7f6f0'); dot(hx - 6, hy - 6, 11, '#ffffff'); dot(hx, hy, 4, '#b9ae8e');
    }
  }
  // 4 菜の花
  {
    const { ox, oy } = cell(4);
    for (let k = 0; k < 7; k++) blade(ox + 128 + (r() - 0.5) * 40, oy + 250, 60 + r() * 50, (r() - 0.5) * 2.0, 22, k % 2 ? '#86a86e' : '#779d62', 0.1);
    for (let k = 0; k < 3; k++) {
      const hx = ox + 70 + k * 58 + (r() - 0.5) * 14, hy = oy + 30 + r() * 44;
      stem([[ox + 120 + k * 8, oy + 250], [hx + (r() - 0.5) * 24, oy + 150], [hx, hy + 16]], 5, '#7da65a');
      for (let j = 0; j < 3; j++) blade(hx + (r() - 0.5) * 10, hy + 90 + j * 34, 34, (j % 2 ? 1 : -1) * 0.9, 16, '#8aac70', 0.1);
      for (let j = 0; j < 30; j++) {
        const a = r() * 6.283, d = Math.sqrt(r()) * 28, fx = hx + Math.cos(a) * d * 1.1, fy = hy + Math.sin(a) * d * 0.8 + d * 0.3;
        const c = r() < 0.4 ? '#f5d63d' : r() < 0.7 ? '#f0c52a' : '#fae67a';
        for (let p = 0; p < 4; p++) { const pa = p * 1.571 + a; dot(fx + Math.cos(pa) * 3.2, fy + Math.sin(pa) * 3.2, 3.4, c); }
      }
      for (let j = 0; j < 6; j++) dot(hx + (r() - 0.5) * 16, hy - 20 - r() * 12, 3, '#b5c46a');
    }
  }
  // 5 ヒメジョオン (small white daisies)
  {
    const { ox, oy } = cell(5);
    for (let k = 0; k < 6; k++) blade(ox + 128 + (r() - 0.5) * 30, oy + 250, 50 + r() * 40, (r() - 0.5) * 2.2, 18, '#7ea562', 0.1);
    const heads = [];
    for (let k = 0; k < 4; k++) {
      const top = [ox + 60 + k * 44 + (r() - 0.5) * 20, oy + 40 + r() * 60];
      stem([[ox + 128 + (k - 1.5) * 6, oy + 250], [top[0] * 0.5 + (ox + 128) * 0.5, oy + 140], top], 3, '#88ab66');
      for (let j = 0; j < 3; j++) { const h2 = [top[0] + (r() - 0.5) * 50, top[1] - 6 + r() * 30]; stem([[top[0], top[1] + 20], h2], 2, '#88ab66'); heads.push(h2); }
      heads.push(top);
    }
    for (const [hx, hy] of heads) { for (let j = 0; j < 14; j++) { const a = j / 14 * 6.283; g.fillStyle = '#f6f3ec'; g.beginPath(); g.ellipse(hx + Math.cos(a) * 7, hy + Math.sin(a) * 5, 4.5, 1.8, a, 0, 6.3); g.fill(); } dot(hx, hy, 4.2, '#f0c040'); }
  }
  // 6 ホトケノザ + オオイヌノフグリ
  {
    const { ox, oy } = cell(6);
    for (let k = 0; k < 26; k++) { const x = ox + 40 + r() * 176, y = oy + 150 + r() * 96; dot(x, y, 10 + r() * 8, k % 3 ? '#7fa865' : '#6c9656'); }
    for (let k = 0; k < 5; k++) {
      const x = ox + 60 + k * 34 + (r() - 0.5) * 12, top = oy + 70 + r() * 50;
      stem([[x, oy + 240], [x, top]], 3, '#7d9e5e');
      for (let j = 0; j < 3; j++) { const y = top + j * 26; dot(x - 11, y + 6, 8, '#7fa865'); dot(x + 11, y + 6, 8, '#7fa865'); for (let p = 0; p < 4; p++) { g.fillStyle = p % 2 ? '#c47bb0' : '#b068a8'; g.beginPath(); g.ellipse(x + (p - 1.5) * 5, y - 4, 3, 7, (p - 1.5) * 0.4, 0, 6.3); g.fill(); } }
    }
    for (let k = 0; k < 16; k++) { const x = ox + 40 + r() * 176, y = oy + 170 + r() * 70; dot(x, y, 4.5, '#7390e2'); dot(x, y, 1.5, '#f2f2f6'); }
  }
  // 7 つくし & スギナ
  {
    const { ox, oy } = cell(7);
    for (let k = 0; k < 4; k++) {
      const x = ox + 60 + k * 44 + (r() - 0.5) * 16, top = oy + 60 + r() * 60;
      stem([[x, oy + 250], [x + (r() - 0.5) * 8, top]], 4, '#9dbb72');
      for (let j = 0; j < 7; j++) { const y = top + 14 + j * ((oy + 240 - top) / 7); for (let s = -1; s <= 1; s += 2) blade(x, y, 26 + r() * 12, s * (1.0 + r() * 0.3), 3, '#7fae62', 0.2); }
    }
    for (let k = 0; k < 5; k++) {
      const x = ox + 50 + k * 38 + (r() - 0.5) * 10, top = oy + 90 + r() * 70;
      stem([[x, oy + 250], [x, top + 20]], 7, '#d5b88c');
      for (let j = 0; j < 4; j++) { const y = top + 44 + j * ((oy + 250 - top - 44) / 4); g.fillStyle = '#8e6c4a'; g.fillRect(x - 5, y, 10, 4); }
      g.fillStyle = '#b38a5e'; g.beginPath(); g.ellipse(x, top + 8, 7, 16, 0, 0, 6.3); g.fill();
      g.fillStyle = '#9a744c'; for (let j = 0; j < 4; j++) g.fillRect(x - 6, top - 2 + j * 6, 12, 2);
    }
  }
}
