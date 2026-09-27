// shopsB shared toolkit: lot-space helpers, hand-painted detail textures, walls with openings,
// sliding doors, windows, roofs, cloth (nobori / noren) animation, lanterns, steam, small props.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { makeShrub, makeHedge } from '../lib/foliage.js';

export const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export function createKit(ctx) {
  const { mat, tex, L } = ctx;
  const F = tex.FONTS;
  const K = { ctx, F, mat, tex };

  // ------------------------------------------------------------------ colours (soft Showa palette)
  const C = K.C = {
    frame: '#5a4032', frameDeep: '#4a3528', woodMid: '#7a5a42', wood: '#8a6446', woodLight: '#b48a62', woodPale: '#cfae84', woodAged: '#8e7862',
    plaster: '#efe6d3', plasterWarm: '#eadcc4', plasterGrey: '#dcd8cf', mortar: '#cbc5b8', base: '#b7b1a6', concrete: '#c6c3bb', concreteDark: '#a9a69f',
    tile: '#5f6a79', tileDark: '#4f5866', metalRoof: '#7b8691', metalBlue: '#5f7389', rust: '#9a6450',
    alu: '#b9bfc4', aluDark: '#8d949b', steel: '#9aa1a8', steelDark: '#6d747c', ink: '#3a3346', white: '#ece8df', paper: '#f1ece0',
    red: '#c9473e', redDeep: '#a93a35', pink: '#f2b5c8', pinkDeep: '#e38aa6', indigo: '#3e4d78', green: '#6f9a6a', mint: '#a9cfc0', copper: '#8fb7a3',
  };

  // ------------------------------------------------------------------ text helpers
  /** Vertical text; rotates long-vowel marks / wave dashes like real 縦書き. g.font must be set. */
  K.vtext = (g, text, x, y, size, gap = 1.04) => {
    g.textAlign = 'center'; g.textBaseline = 'middle';
    let yy = y + size / 2;
    for (const ch of text) {
      if (ch === ' ' || ch === '　') { yy += size * 0.5; continue; }
      if ('ー〜ｰ-―—…'.includes(ch)) { g.save(); g.translate(x, yy); g.rotate(Math.PI / 2); g.fillText(ch, 0, 0); g.restore(); }
      else if ('、。'.includes(ch)) g.fillText(ch, x + size * 0.55, yy - size * 0.5);
      else if ('ぁぃぅぇぉっゃゅょァィゥェォッャュョ'.includes(ch)) g.fillText(ch, x + size * 0.1, yy - size * 0.08);
      else g.fillText(ch, x, yy);
      yy += size * gap;
    }
    return yy;
  };
  K.font = (size, fam = F.sans, weight = 700) => `${weight} ${size}px ${fam}`;
  /** Text fitted into maxW, centred. */
  K.text = (g, s, x, y, maxW, size, fam, weight = 700, color = '#333', align = 'center') => {
    g.fillStyle = color; g.textAlign = align; g.textBaseline = 'middle';
    return tex.fitText(g, s, x, y, maxW, size, fam, weight);
  };
  /** Carved / gilded lettering on a wooden board. */
  K.carve = (g, s, x, y, size, fam, fill, weight = 700) => {
    g.font = `${weight} ${size}px ${fam}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = 'rgba(25,12,6,0.6)'; g.fillText(s, x + size * 0.035, y + size * 0.045);
    g.fillStyle = 'rgba(255,238,200,0.35)'; g.fillText(s, x - size * 0.02, y - size * 0.025);
    g.fillStyle = fill; g.fillText(s, x, y);
  };
  K.rr = (g, x, y, w, h, r) => tex.roundRect(g, x, y, w, h, r);
  /** Seamless soft blotches (hand-painted wash). */
  K.blotch = (g, w, h, rnd, n, amax, light = false, rmin = 0.04, rmax = 0.2) => {
    const col = light ? '255,255,255' : '40,30,50';
    for (let i = 0; i < n; i++) {
      const x = rnd() * w, y = rnd() * h, rad = (rmin + rnd() * (rmax - rmin)) * w, a = rnd() * amax;
      for (const ox of [-w, 0, w]) for (const oy of [-h, 0, h]) {
        const cx = x + ox, cy = y + oy;
        if (cx + rad < 0 || cx - rad > w || cy + rad < 0 || cy - rad > h) continue;
        const gr = g.createRadialGradient(cx, cy, 0, cx, cy, rad);
        gr.addColorStop(0, `rgba(${col},${a})`); gr.addColorStop(1, `rgba(${col},0)`);
        g.fillStyle = gr; g.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
      }
    }
  };
  const rng = ctx.rng;
  const draw = (w, h, fn, key, repeat = true) => tex.draw(w, h, fn, { key, repeat: repeat ? [1, 1] : undefined });

  // ------------------------------------------------------------------ detail textures (near-white; tinted by material colour)
  const T = K.T = {};
  T.plaster = draw(512, 512, (g, w, h) => {
    const r = rng('sb-plaster');
    g.fillStyle = '#f6f5f3'; g.fillRect(0, 0, w, h);
    K.blotch(g, w, h, r, 26, 0.06); K.blotch(g, w, h, r, 14, 0.08, true);
    for (let i = 0; i < 500; i++) { g.fillStyle = r() < 0.5 ? 'rgba(60,50,70,0.035)' : 'rgba(255,255,255,0.06)'; g.fillRect(r() * w, r() * h, 2 + r() * 3, 2 + r() * 3); }
  }, 'sb-plaster');
  T.siding = draw(512, 512, (g, w, h) => { // 下見板: 10 boards over the tile (tile = 1.8 m)
    const r = rng('sb-siding'); const n = 10, bh = h / n;
    for (let i = 0; i < n; i++) {
      const v = 228 + Math.floor(r() * 24); g.fillStyle = `rgb(${v},${v - 2},${v - 5})`; g.fillRect(0, i * bh, w, bh);
      g.strokeStyle = 'rgba(70,50,40,0.10)'; g.lineWidth = 1.5;
      for (let j = 0; j < 5; j++) { const y = i * bh + 6 + r() * (bh - 12); g.beginPath(); g.moveTo(0, y); for (let x = 0; x <= w; x += 32) g.lineTo(x, y + Math.sin(x * 0.02 + j + i) * 2.2); g.stroke(); }
      const gr = g.createLinearGradient(0, (i + 1) * bh - 9, 0, (i + 1) * bh); gr.addColorStop(0, 'rgba(50,35,45,0)'); gr.addColorStop(1, 'rgba(50,35,45,0.42)');
      g.fillStyle = gr; g.fillRect(0, (i + 1) * bh - 9, w, 9);
      g.fillStyle = 'rgba(255,250,240,0.35)'; g.fillRect(0, i * bh, w, 2);
    }
    K.blotch(g, w, h, r, 12, 0.07);
  }, 'sb-siding');
  T.vboards = draw(512, 512, (g, w, h) => { // vertical boards (tile 1.5 m, 10 boards)
    const r = rng('sb-vboards'); const n = 10, bw = w / n;
    for (let i = 0; i < n; i++) {
      const v = 226 + Math.floor(r() * 26); g.fillStyle = `rgb(${v},${v - 3},${v - 6})`; g.fillRect(i * bw, 0, bw, h);
      g.strokeStyle = 'rgba(70,50,40,0.10)'; g.lineWidth = 1.4;
      for (let j = 0; j < 3; j++) { const x = i * bw + 6 + r() * (bw - 12); g.beginPath(); g.moveTo(x, 0); for (let y = 0; y <= h; y += 32) g.lineTo(x + Math.sin(y * 0.02 + j * 3 + i) * 2, y); g.stroke(); }
      g.fillStyle = 'rgba(45,32,40,0.45)'; g.fillRect(i * bw, 0, 3, h);
    }
    K.blotch(g, w, h, r, 10, 0.07);
  }, 'sb-vboards');
  T.grain = draw(256, 256, (g, w, h) => { // generic furniture grain (tile 1 m)
    const r = rng('sb-grain');
    g.fillStyle = '#f2efea'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(80,55,40,0.12)'; g.lineWidth = 1.3;
    for (let j = 0; j < 22; j++) { const y = r() * h; g.beginPath(); g.moveTo(0, y); for (let x = 0; x <= w; x += 16) g.lineTo(x, y + Math.sin(x * 0.03 + j) * 3); g.stroke(); }
    K.blotch(g, w, h, r, 8, 0.06);
  }, 'sb-grain');
  T.tile = draw(512, 512, (g, w, h) => { // 土間 tiles 0.3 m (tile 2.4 m, 8x8)
    const r = rng('sb-tile'); const n = 8, s = w / n;
    g.fillStyle = '#b9b6b0'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const v = 222 + Math.floor(r() * 26); g.fillStyle = `rgb(${v},${v - 1},${v - 4})`; g.fillRect(i * s + 2, j * s + 2, s - 4, s - 4); }
    K.blotch(g, w, h, r, 14, 0.07);
  }, 'sb-tile');
  T.kawara = draw(512, 512, (g, w, h) => { // 桟瓦 roof tiles (tile 2.1 m: 8 columns x 6 courses)
    const r = rng('sb-kawara'); const cols = 8, rows = 6, cw = w / cols, rh = h / rows;
    for (let c = 0; c < cols; c++) {
      const gr = g.createLinearGradient(c * cw, 0, (c + 1) * cw, 0);
      gr.addColorStop(0, '#a3a3a8'); gr.addColorStop(0.2, '#dadade'); gr.addColorStop(0.46, '#f6f6f8'); gr.addColorStop(0.78, '#c8c8cd'); gr.addColorStop(1, '#8f8f96');
      g.fillStyle = gr; g.fillRect(c * cw, 0, cw, h);
    }
    for (let c = 0; c < cols; c++) for (let q = 0; q < rows; q++) { const a = r() * 0.09; g.fillStyle = r() < 0.5 ? `rgba(30,30,50,${a})` : `rgba(255,255,255,${a})`; g.fillRect(c * cw, q * rh, cw, rh); }
    for (let q = 0; q < rows; q++) {
      const y = q * rh;
      const gr = g.createLinearGradient(0, y, 0, y + rh * 0.3); gr.addColorStop(0, 'rgba(35,32,55,0.5)'); gr.addColorStop(1, 'rgba(35,32,55,0)');
      g.fillStyle = gr; g.fillRect(0, y, w, rh * 0.3);
      g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(0, y - 3, w, 3);
    }
  }, 'sb-kawara');
  T.corr = draw(256, 256, (g, w, h) => { // corrugated sheet (tile 1.2 m, 12 ridges)
    const r = rng('sb-corr'); const n = 12, p = w / n;
    for (let i = 0; i < n; i++) {
      const gr = g.createLinearGradient(i * p, 0, (i + 1) * p, 0);
      gr.addColorStop(0, '#b8b8bc'); gr.addColorStop(0.35, '#f4f4f4'); gr.addColorStop(0.6, '#e2e2e4'); gr.addColorStop(1, '#b0b0b6');
      g.fillStyle = gr; g.fillRect(i * p, 0, p, h);
    }
    K.blotch(g, w, h, r, 10, 0.08);
  }, 'sb-corr');
  T.shutter = draw(256, 256, (g, w, h) => { // roll-up shutter slats (tile 0.8 m, 10 slats)
    const n = 10, p = h / n;
    for (let i = 0; i < n; i++) {
      const gr = g.createLinearGradient(0, i * p, 0, (i + 1) * p);
      gr.addColorStop(0, '#f2f2f2'); gr.addColorStop(0.55, '#e6e6e8'); gr.addColorStop(0.85, '#c2c2c8'); gr.addColorStop(1, '#9d9da6');
      g.fillStyle = gr; g.fillRect(0, i * p, w, p);
    }
  }, 'sb-shutter');
  T.concrete = draw(512, 512, (g, w, h) => { // apron concrete (tile 4 m)
    const r = rng('sb-concrete');
    g.fillStyle = '#f1f0ed'; g.fillRect(0, 0, w, h);
    K.blotch(g, w, h, r, 30, 0.07); K.blotch(g, w, h, r, 12, 0.06, true);
    g.strokeStyle = 'rgba(60,55,70,0.11)'; g.lineWidth = 1.2;
    for (let i = 0; i < 4; i++) { let x = r() * w, y = r() * h; g.beginPath(); g.moveTo(x, y); for (let j = 0; j < 7; j++) { x += (r() - 0.5) * 40; y += 10 + r() * 22; g.lineTo(x, y); } g.stroke(); }
    for (let i = 0; i < 260; i++) { const v = r() < 0.5 ? 'rgba(60,55,70,0.10)' : 'rgba(255,255,255,0.18)'; g.fillStyle = v; g.fillRect(r() * w, r() * h, 2, 2); }
  }, 'sb-concrete');
  T.gravel = draw(256, 256, (g, w, h) => { // gravel / packed earth (tile 1.5 m)
    const r = rng('sb-gravel');
    g.fillStyle = '#e6e2da'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) { const v = 170 + Math.floor(r() * 85); g.fillStyle = `rgb(${v},${v - 4},${v - 10})`; const s = 2 + r() * 4; g.beginPath(); g.ellipse(r() * w, r() * h, s, s * 0.7, r() * 3, 0, 7); g.fill(); }
    K.blotch(g, w, h, r, 8, 0.08);
  }, 'sb-gravel');
  T.copper = draw(512, 512, (g, w, h) => { // 銅板張り plates for 看板建築 (tile 1.8 m: 6 x 4 plates)
    const r = rng('sb-copper'); const nx = 6, ny = 4, pw = w / nx, ph = h / ny;
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const off = (j % 2) * pw / 2; const v = 214 + Math.floor(r() * 36);
      for (const ox of [0, -w]) { g.fillStyle = `rgb(${v},${v + 2},${v})`; g.fillRect(i * pw + off + ox, j * ph, pw, ph); }
    }
    for (let j = 0; j < ny; j++) {
      g.fillStyle = 'rgba(40,60,55,0.35)'; g.fillRect(0, j * ph, w, 3);
      const off = (j % 2) * pw / 2; for (let i = 0; i <= nx; i++) g.fillRect(i * pw + off - 1, j * ph, 2, ph);
    }
    K.blotch(g, w, h, r, 18, 0.10); K.blotch(g, w, h, r, 10, 0.12, true);
  }, 'sb-copper');
  T.peg = draw(256, 256, (g, w, h) => { // pegboard (tile 0.8 m)
    g.fillStyle = '#efece6'; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(60,50,45,0.55)';
    const n = 10, s = w / n; for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { g.beginPath(); g.arc(i * s + s / 2, j * s + s / 2, 2.6, 0, 7); g.fill(); }
  }, 'sb-peg');
  T.bamboo = draw(256, 256, (g, w, h) => { // すだれ slats (horizontal), tile 0.5 m
    const r = rng('sb-bamboo'); const n = 32, p = h / n;
    for (let i = 0; i < n; i++) { const v = 205 + Math.floor(r() * 40); g.fillStyle = `rgb(${v},${v - 12},${v - 45})`; g.fillRect(0, i * p, w, p - 1.6); g.fillStyle = 'rgba(70,55,30,0.45)'; g.fillRect(0, i * p + p - 1.6, w, 1.6); }
    g.fillStyle = 'rgba(90,70,40,0.55)'; for (const x of [0.2, 0.5, 0.8]) g.fillRect(x * w - 1.5, 0, 3, h);
  }, 'sb-bamboo');

  // ------------------------------------------------------------------ materials
  // Every plain / texture-tinted toon material made through K is recorded so optimize.js can bake its
  // colour into vertex colours and collapse many colours into one material (far fewer draw calls).
  const rec = K.rec = new Map();
  // Local memo: ctx.mat.toon's cache key JSON-stringifies opts, and a texture's toJSON() PNG-encodes its
  // canvas (toDataURL) — very slow when repeated thousands of times. Key textures by uuid here instead.
  const memo = new Map();
  K.optKey = (o) => { const s = {}; for (const k of Object.keys(o).sort()) { const v = o[k]; s[k] = v && v.isTexture ? 'tex:' + v.uuid : v && v.isColor ? '#' + v.getHexString() : v; } return JSON.stringify(s); };
  // Our own canvas textures serialise to their uuid, so the core material cache key stays cheap
  // (per-instance override; these textures are never exported with scene.toJSON()).
  const cheapTex = (o) => { for (const k of ['map', 'alphaMap']) { const t = o[k]; if (t && t.isTexture && !Object.prototype.hasOwnProperty.call(t, 'toJSON')) t.toJSON = function () { return 'tex:' + this.uuid; }; } return o; };
  K.cheapTex = cheapTex;
  K.toonMemo = (color, o = {}) => {
    const key = (typeof color === 'string' ? color : '#' + new THREE.Color(color).getHexString()) + '|' + K.optKey(o);
    let m = memo.get(key); if (!m) { m = mat.toon(color, cheapTex(o)); memo.set(key, m); }
    return m;
  };
  /** Memoised ctx.mat.decal / ctx.mat.emissive (same uuid-keyed memo). */
  K.memo = (kind, color, o = {}, intensity = 1) => {
    const key = kind + '|' + color + '|' + intensity + '|' + K.optKey(o);
    let m = memo.get(key); if (!m) { cheapTex(o); m = kind === 'decal' ? mat.decal(color, o) : mat.emissive(color, intensity, o); memo.set(key, m); }
    return m;
  };
  const toonR = (color, o, glow = 0) => { const m = K.toonMemo(color, o); if (!rec.has(m)) rec.set(m, { color, o, glow }); return m; };
  K.m = (color, o = {}) => toonR(color, o);
  K.mt = (color, map, o = {}) => toonR(color, { map, ...o });
  /** Interior material: warm self-light so rooms read as lit behind glass even in shadow. */
  K.im = (color, glow = 0.3, o = {}) => {
    const c = new THREE.Color(color).multiply(new THREE.Color('#ffc58a'));
    return toonR(color, { ...o, emissive: '#' + c.getHexString(), emissiveIntensity: glow }, glow);
  };
  K.lamp = (intensity = 1.3, color = '#ffe3b8') => mat.emissive(color, intensity);
  K.glass = (o = {}) => mat.glass({ tint: '#a6bccb', opacity: 0.3, ...o });

  // ------------------------------------------------------------------ geometry
  /** Box geometry with world-tiled UVs (tile = metres per texture repeat); off = box centre in parent space. */
  K.boxGeo = (w, h, d, tile = 1, off = [0, 0, 0], tileV = tile) => {
    const g = new THREE.BoxGeometry(w, h, d);
    const p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i) + off[0], y = p.getY(i) + off[1], z = p.getZ(i) + off[2];
      const nx = n.getX(i), ny = n.getY(i), nz = n.getZ(i);
      let u, v;
      if (Math.abs(nx) > 0.5) { u = -z * Math.sign(nx); v = y; }
      else if (Math.abs(ny) > 0.5) { u = x; v = -z * Math.sign(ny); }
      else { u = x * Math.sign(nz); v = y; }
      uv.setXY(i, u / tile, v / tileV);
    }
    return g;
  };
  /** Textured box (centre pos) with world-tiled UV. */
  K.tbox = (parent, w, h, d, material, pos, tile = 1, rot = null, tileV = tile) => {
    const m = new THREE.Mesh(K.boxGeo(w, h, d, tile, rot ? [0, 0, 0] : pos, tileV), material);
    m.position.set(pos[0], pos[1], pos[2]); if (rot) m.rotation.set(rot[0] || 0, rot[1] || 0, rot[2] || 0);
    m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
  };
  /** Box via shared unit geometry (untextured). */
  K.box = (parent, w, h, d, material, pos, rot) => {
    const m = new THREE.Mesh(ctx.geo.G.box(), material);
    m.scale.set(w, h, d); m.position.set(pos[0], pos[1], pos[2]); if (rot) m.rotation.set(rot[0] || 0, rot[1] || 0, rot[2] || 0);
    m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
  };
  K.boxB = (parent, w, h, d, material, pos, rot) => K.box(parent, w, h, d, material, [pos[0], pos[1] + h / 2, pos[2]], rot);
  K.cyl = (parent, r, h, material, pos, seg = 12, rot = null, r2 = r) => {
    const m = r === r2 ? new THREE.Mesh(ctx.geo.G.cyl(seg), material) : new THREE.Mesh(new THREE.CylinderGeometry(r, r2, 1, seg), material);
    if (r === r2) m.scale.set(r * 2, h, r * 2); else m.scale.set(1, h, 1);
    m.position.set(pos[0], pos[1], pos[2]); if (rot) m.rotation.set(rot[0] || 0, rot[1] || 0, rot[2] || 0);
    m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
  };
  K.sph = (parent, r, material, pos, seg = 10, scale = null) => {
    const m = new THREE.Mesh(ctx.geo.G.sphere(seg), material);
    m.scale.set(r * 2, r * 2, r * 2); if (scale) m.scale.multiply(new THREE.Vector3(...scale));
    m.position.set(pos[0], pos[1], pos[2]); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
  };
  K.rbox = (parent, w, h, d, r, material, pos, rot) => {
    const m = new THREE.Mesh(ctx.geo.G.rbox(r, 2), material);
    m.scale.set(w, h, d); m.position.set(pos[0], pos[1], pos[2]); if (rot) m.rotation.set(rot[0] || 0, rot[1] || 0, rot[2] || 0);
    m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
  };
  /** Rounded box with true radius (unique geometry). */
  K.rboxR = (parent, w, h, d, r, material, pos, rot) => {
    const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2, h / 2, d / 2)), material);
    m.position.set(pos[0], pos[1], pos[2]); if (rot) m.rotation.set(rot[0] || 0, rot[1] || 0, rot[2] || 0);
    m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
  };
  /** Plane facing +Z (no shadow cast). */
  K.plane = (parent, w, h, material, pos, rotY = 0, rotX = 0) => {
    const m = new THREE.Mesh(ctx.geo.G.plane(), material);
    m.scale.set(w, h, 1); m.position.set(pos[0], pos[1], pos[2]); m.rotation.set(rotX, rotY, 0);
    m.receiveShadow = true; parent.add(m); return m;
  };
  /** Poster / sticker (decal material, 4 mm in front of its surface — caller passes the surface pos). */
  K.decal = (parent, texture, w, h, pos, rotY = 0, o = {}) => K.plane(parent, w, h, K.memo('decal', '#ffffff', { map: texture, ...o }), pos, rotY);
  /** Horizontal cylinder along X. */
  K.cylX = (parent, r, len, material, pos, seg = 10) => K.cyl(parent, r, len, material, pos, seg, [0, 0, Math.PI / 2]);
  K.cylZ = (parent, r, len, material, pos, seg = 10) => K.cyl(parent, r, len, material, pos, seg, [Math.PI / 2, 0, 0]);
  K.lathe = (parent, pts, material, pos, seg = 16, rotY = 0) => {
    const m = new THREE.Mesh(new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(p[0], p[1])), seg), material);
    m.position.set(pos[0], pos[1], pos[2]); m.rotation.y = rotY; m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
  };
  K.extrude = (parent, pts, depth, material, pos, rot, opts) => {
    const m = new THREE.Mesh(ctx.geo.extrude(pts, depth, opts), material);
    m.position.set(pos[0], pos[1], pos[2]); if (rot) m.rotation.set(rot[0] || 0, rot[1] || 0, rot[2] || 0);
    m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
  };

  /** Half tube (round side up), axis along Z, flat side at y = 0 (cached). */
  const _ht = new Map();
  K.halfTube = (r, len) => {
    const key = r + '|' + len; if (_ht.has(key)) return _ht.get(key);
    const g = new THREE.CylinderGeometry(r, r, len, 7, 1, false, 0, Math.PI);
    g.rotateZ(Math.PI / 2); g.rotateY(Math.PI / 2);
    _ht.set(key, g); return g;
  };
  /** Wall with rectangular openings. o: {axis:'x'|'z', a0,a1 (along axis), y0,y1, c (plane centre coord), t, holes:[{a0,a1,y0,y1}], tile} */
  K.wall = (parent, material, o) => {
    const holes = (o.holes || []).map(h => ({ a0: Math.max(o.a0, h.a0), a1: Math.min(o.a1, h.a1), y0: Math.max(o.y0, h.y0), y1: Math.min(o.y1, h.y1) })).filter(h => h.a1 > h.a0 && h.y1 > h.y0);
    const cuts = [...new Set([o.a0, o.a1, ...holes.flatMap(h => [h.a0, h.a1])])].sort((a, b) => a - b);
    const cols = [];
    for (let i = 0; i < cuts.length - 1; i++) {
      const a = cuts[i], b = cuts[i + 1]; if (b - a < 1e-4) continue; const mid = (a + b) / 2;
      const hs = holes.filter(h => h.a0 <= mid && h.a1 >= mid).sort((p, q) => p.y0 - q.y0);
      const spans = []; let y = o.y0;
      for (const h of hs) { if (h.y0 > y + 1e-4) spans.push([y, h.y0]); y = Math.max(y, h.y1); }
      if (y < o.y1 - 1e-4) spans.push([y, o.y1]);
      const key = spans.map(s => s.join(':')).join('|');
      const last = cols[cols.length - 1];
      if (last && last.key === key && Math.abs(last.b - a) < 1e-6) last.b = b; else cols.push({ a, b, spans, key });
    }
    const out = [];
    for (const c of cols) for (const [y0, y1] of c.spans) {
      const len = c.b - c.a, h = y1 - y0, am = (c.a + c.b) / 2, ym = (y0 + y1) / 2;
      if (o.axis === 'z') out.push(K.tbox(parent, o.t, h, len, material, [o.c, ym, am], o.tile || 1));
      else out.push(K.tbox(parent, len, h, o.t, material, [am, ym, o.c], o.tile || 1));
    }
    return out;
  };

  /** Sloped slab that follows the terrain (top = ground + lift). Lot terrain is planar. */
  K.slab = (S, x0, x1, z0, z1, lift, material, tile = 4, thick = 0.25) => {
    const w = x1 - x0, d = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const g = K.boxGeo(w, 1, d, tile, [cx, 0, cz]);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const lx = p.getX(i) + cx, lz = p.getZ(i) + cz, top = p.getY(i) > 0;
      p.setY(i, S.gl(lx, lz) + (top ? lift : -thick));
    }
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, material); m.position.set(cx, 0, cz); m.receiveShadow = true; m.castShadow = false;
    S.g.add(m); return m;
  };
  /** Minimum / maximum local ground height over a local rectangle. */
  K.gRange = (S, x0, x1, z0, z1) => { const v = [S.gl(x0, z0), S.gl(x1, z0), S.gl(x0, z1), S.gl(x1, z1)]; return [Math.min(...v), Math.max(...v)]; };

  // ------------------------------------------------------------------ lot space
  K.spaces = [];
  K.space = (lot) => {
    const f = L.lotFrame(lot);
    const c = Math.cos(f.rotY), s = Math.sin(f.rotY);
    const g = new THREE.Group(); g.position.set(f.x, f.y, f.z); g.rotation.y = f.rotY; g.name = 'shopsB-' + lot.id;
    const d = new THREE.Group(); d.position.copy(g.position); d.rotation.y = f.rotY; d.name = 'shopsB-dyn-' + lot.id;
    ctx.addStatic(g); ctx.add(d); K.spaces.push(g);
    const w2 = (lx, lz) => ({ x: f.x + lx * c + lz * s, z: f.z - lx * s + lz * c });
    const gl = (lx, lz) => { const p = w2(lx, lz); return L.heightAt(p.x, p.z) - f.y; };
    const P = ctx.physics;
    const S = {
      lot, f, g, d, w2, gl,
      /** local point of a world position */
      local(x, z) { const dx = x - f.x, dz = z - f.z; return { x: dx * c - dz * s, z: dx * s + dz * c }; },
      box(x0, z0, x1, z1, y0, y1) { const p = w2((x0 + x1) / 2, (z0 + z1) / 2); return P.addBox(p.x, p.z, Math.abs(x1 - x0), Math.abs(z1 - z0), f.rotY, f.y + y0, f.y + y1); },
      walk(x0, z0, x1, z1, top, bottom = null) { const p = w2((x0 + x1) / 2, (z0 + z1) / 2); return P.addWalkBox(p.x, p.z, Math.abs(x1 - x0), Math.abs(z1 - z0), f.rotY, f.y + top, bottom === null ? -50 : f.y + bottom); },
      cyl(x, z, r, y0, y1) { const p = w2(x, z); return P.addCylinder(p.x, p.z, r, f.y + y0, f.y + y1); },
      /** oriented box in local space rotated by rl around its centre */
      obox(x, z, w, dd, rl, y0, y1) { const p = w2(x, z); return P.addBox(p.x, p.z, w, dd, f.rotY + rl, f.y + y0, f.y + y1); },
    };
    return S;
  };
  K.playerLocal = (S) => { const p = ctx.player.position; const q = S.local(p.x, p.z); q.y = p.y - S.f.y; return q; };

  // ------------------------------------------------------------------ building parts
  /** Sliding door / window panel (group, origin = bottom centre). o: {w,h,d,frame,glass,stile,top,bottom,bars:[y..], vbars:[x..], kick:{h,mat}, lattice} */
  K.panel = (parent, o) => {
    const g = new THREE.Group(); parent.add(g);
    const w = o.w, h = o.h, d = o.d ?? 0.04, st = o.stile ?? 0.045, tr = o.top ?? 0.05, br = o.bottom ?? 0.08;
    const fm = o.frame;
    K.box(g, st, h, d, fm, [-w / 2 + st / 2, h / 2, 0]); K.box(g, st, h, d, fm, [w / 2 - st / 2, h / 2, 0]);
    K.box(g, w - 2 * st, tr, d, fm, [0, h - tr / 2, 0]);
    let y0 = br;
    if (o.kick) { K.tbox(g, w - 2 * st, o.kick.h, d * 0.6, o.kick.mat, [0, br + o.kick.h / 2, 0], o.kick.tile || 1); y0 = br + o.kick.h; K.box(g, w - 2 * st, 0.03, d, fm, [0, y0, 0]); }
    K.box(g, w - 2 * st, br, d, fm, [0, br / 2, 0]);
    const gh = h - tr - y0, gw = w - 2 * st;
    if (o.glass) { const gp = K.box(g, gw, gh, 0.006, o.glass, [0, y0 + gh / 2, 0]); gp.castShadow = false; if (o.noOutlineGlass !== false) ctx.noOutline(gp); }
    for (const by of o.bars || []) K.box(g, gw, 0.022, d * 0.7, fm, [0, y0 + by * gh, 0]);
    for (const bx of o.vbars || []) K.box(g, 0.022, gh, d * 0.7, fm, [bx * gw / 2, y0 + gh / 2, 0]);
    if (o.lattice) { // 格子 (vertical close bars in front)
      const n = Math.max(2, Math.round(gw / o.lattice)); for (let i = 1; i < n; i++) K.box(g, 0.02, gh, d * 0.8, fm, [-gw / 2 + gw * i / n, y0 + gh / 2, d * 0.2]);
    }
    return g;
  };
  /** Window: frame + glass + sill, opening centred at (x, y0..y1) on a wall plane z (+Z facing). */
  K.window = (parent, o) => {
    const g = new THREE.Group(); g.position.set(o.x, o.y0, o.z); g.rotation.y = o.rotY || 0; parent.add(g);
    const w = o.w, h = o.h, fm = o.frame, ft = o.ft ?? 0.05, fd = o.fd ?? 0.07;
    K.box(g, w + ft * 2, ft, fd, fm, [0, -ft / 2, 0]); K.box(g, w + ft * 2, ft, fd, fm, [0, h + ft / 2, 0]);
    K.box(g, ft, h, fd, fm, [-w / 2 - ft / 2, h / 2, 0]); K.box(g, ft, h, fd, fm, [w / 2 + ft / 2, h / 2, 0]);
    if (o.sill !== false) K.box(g, w + ft * 2 + 0.08, 0.04, fd + 0.06, o.sillMat || fm, [0, -ft - 0.02, 0.04]);
    const panes = o.panes || 2;
    for (let i = 0; i < panes; i++) {
      const pw = w / panes, px = -w / 2 + pw * (i + 0.5), pz = (i % 2 ? -0.012 : 0.012) - 0.01;
      K.box(g, 0.03, h, 0.035, fm, [px + pw / 2 - (i === panes - 1 ? 0 : 0.015), h / 2, pz]);
      const gp = K.box(g, pw - 0.03, h - 0.02, 0.006, o.glass, [px, h / 2, pz]); gp.castShadow = false; ctx.noOutline(gp);
    }
    if (o.lattice) { const n = Math.round(w / o.lattice); for (let i = 1; i < n; i++) K.box(g, 0.025, h, 0.035, o.latticeMat || fm, [-w / 2 + w * i / n, h / 2, 0.035]); K.box(g, w, 0.03, 0.035, o.latticeMat || fm, [0, h * 0.5, 0.036]); }
    if (o.behind) { const b = K.plane(g, w, h, o.behind, [0, h / 2, -(o.behindD ?? 0.08)]); b.castShadow = false; }
    return g;
  };
  /** Gable roof, ridge along X. o: {x0,x1,zf,zb (eave lines), yE (eave height), yR (ridge), zR (ridge z), t, mat, tile, fascia, edgeTiles} */
  K.gableX = (parent, o) => {
    const t = o.t ?? 0.12, parts = [];
    for (const side of [1, -1]) {
      const ze = side > 0 ? o.zf : o.zb; const run = Math.abs(ze - o.zR), rise = o.yR - o.yE;
      const len = Math.hypot(run, rise), ang = Math.atan2(rise, run);
      const cz = (ze + o.zR) / 2, cy = (o.yE + o.yR) / 2;
      const m = K.tbox(parent, o.x1 - o.x0, t, len + 0.02, o.mat, [(o.x0 + o.x1) / 2, cy + t / 2 * Math.cos(ang), cz + side * 0 ], o.tile || 2.1, [side * ang, 0, 0]);
      m.userData.shopsBRoof = true; parts.push(m);
      if (o.fascia) { // eave fascia board (鼻隠し)
        K.box(parent, o.x1 - o.x0, 0.16, 0.05, o.fascia, [(o.x0 + o.x1) / 2, o.yE - 0.02, ze + side * 0.02]);
      }
      if (o.edgeTiles) { // 軒瓦: rounded tile ends along the eave
        const n = Math.round((o.x1 - o.x0) / 0.2625);
        const geo = K.halfTube(0.065, 0.1);
        for (let i = 0; i < n; i++) {
          const x = o.x0 + (i + 0.5) * (o.x1 - o.x0) / n;
          const e = new THREE.Mesh(geo, o.edgeTiles); e.position.set(x, o.yE + t * 0.85, ze - side * 0.05); e.rotation.x = side * ang;
          e.castShadow = true; e.receiveShadow = true; parent.add(e);
        }
      }
    }
    return parts;
  };
  /** Gable end wall triangle (in the plane x = xc), spanning z0..z1 at base y0 up to apex (zA, yA). */
  K.gableEnd = (parent, material, xc, z0, z1, y0, zA, yA, t = 0.15, tile = 2.5) => {
    const pts = [[z0, y0], [z1, y0], [zA, yA]];
    const shape = new THREE.Shape(pts.map(p => new THREE.Vector2(p[0], p[1])));
    const g = new THREE.ExtrudeGeometry(shape, { depth: t, bevelEnabled: false });
    g.translate(0, 0, -t / 2);
    // map: extrude lies in XY (x = our z) ; rotate so shape x -> -local z? We want shape x -> world z.
    g.rotateY(-Math.PI / 2); // shape (x,y,zExt) -> (zExt?,y,x): after rotateY(-90): x' = -z, z' = x
    const p = g.attributes.position, uv = g.attributes.uv;
    for (let i = 0; i < p.count; i++) uv.setXY(i, p.getZ(i) / tile, p.getY(i) / tile);
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, material); m.position.set(xc, 0, 0); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
  };
  /** Ridge (棟) along X with rounded cap + simple onigawara at the ends. */
  K.ridgeX = (parent, x0, x1, y, z, material, capMat) => {
    K.box(parent, x1 - x0, 0.2, 0.3, material, [(x0 + x1) / 2, y + 0.08, z]);
    K.box(parent, x1 - x0 + 0.02, 0.07, 0.36, capMat || material, [(x0 + x1) / 2, y + 0.2, z]);
    K.cylX(parent, 0.1, x1 - x0 + 0.06, capMat || material, [(x0 + x1) / 2, y + 0.25, z], 10);
    for (const x of [x0 - 0.05, x1 + 0.05]) {
      const oni = K.extrude(parent, [[-0.24, 0], [0.24, 0], [0.26, 0.28], [0.12, 0.44], [0, 0.4], [-0.12, 0.44], [-0.26, 0.28]], 0.08, capMat || material, [x, y - 0.02, z], [0, Math.PI / 2, 0]);
      oni.userData.oni = true;
    }
  };
  /** Pent roof (庇) on a +Z facing wall at zWall: from (y at wall) sloping down to the front edge. */
  K.pent = (parent, o) => {
    const depth = o.depth, drop = o.drop ?? 0.25, len = Math.hypot(depth, drop), ang = Math.atan2(drop, depth);
    const t = o.t ?? 0.08, cz = o.zWall + depth / 2, cy = o.y - drop / 2;
    const m = K.tbox(parent, o.x1 - o.x0, t, len, o.mat, [(o.x0 + o.x1) / 2, cy, cz], o.tile || 2.1, [ang, 0, 0]);
    if (o.fascia) K.box(parent, o.x1 - o.x0 + 0.02, o.fasciaH ?? 0.1, 0.04, o.fascia, [(o.x0 + o.x1) / 2, o.y - drop - 0.03, o.zWall + depth + 0.01]);
    if (o.edgeTiles) {
      const n = Math.round((o.x1 - o.x0) / 0.2625);
      const geo = K.halfTube(0.055, 0.09);
      for (let i = 0; i < n; i++) {
        const x = o.x0 + (i + 0.5) * (o.x1 - o.x0) / n;
        const e = new THREE.Mesh(geo, o.edgeTiles); e.position.set(x, o.y - drop + t * 0.55, o.zWall + depth - 0.04); e.rotation.x = ang;
        e.castShadow = true; e.receiveShadow = true; parent.add(e);
      }
    }
    if (o.brackets) for (const x of o.brackets) { // 腕木
      K.box(parent, 0.07, 0.09, depth * 0.85, o.bracketMat || o.fascia || o.mat, [x, o.y - drop * 0.5 - 0.13, o.zWall + depth * 0.42], [ang, 0, 0]);
      K.box(parent, 0.06, 0.34, 0.06, o.bracketMat || o.fascia || o.mat, [x, o.y - 0.36, o.zWall + 0.04]);
    }
    return m;
  };
  /** Half-round gutter along X + downpipe. */
  K.gutterX = (parent, x0, x1, y, z, material) => {
    const g = new THREE.CylinderGeometry(0.06, 0.06, 1, 8, 1, true, Math.PI, Math.PI);
    const m = new THREE.Mesh(g, material); m.scale.set(1, x1 - x0, 1); m.rotation.set(0, 0, Math.PI / 2); m.position.set((x0 + x1) / 2, y, z);
    m.material = material; m.castShadow = true; parent.add(m);
    K.box(parent, x1 - x0, 0.02, 0.012, material, [(x0 + x1) / 2, y + 0.05, z + 0.058]);
    return m;
  };
  /** Downpipe with wall brackets; dir = unit [dx,dz] from the pipe toward its wall. */
  K.downpipe = (parent, x, z, yTop, yBot, material, off = 0.1, dir = [0, -1]) => {
    K.cyl(parent, 0.035, yTop - yBot, material, [x, (yTop + yBot) / 2, z], 8);
    for (let y = yBot + 0.6; y < yTop - 0.2; y += 1.4) K.box(parent, dir[0] ? off : 0.06, 0.03, dir[0] ? 0.06 : off, material, [x + dir[0] * off / 2, y, z + dir[1] * off / 2]);
    K.cyl(parent, 0.045, 0.14, material, [x, yBot + 0.07, z], 8);
    K.cyl(parent, 0.045, 0.1, material, [x + dir[0] * 0.03, yBot + 0.05, z + dir[1] * 0.03], 8, [dir[1] * 0.9, 0, -dir[0] * 0.9]);
  };
  /** Pipe along a polyline of [x,y,z] points (elbows are small spheres). */
  K.pipeRun = (parent, pts, r, material) => {
    for (let i = 0; i < pts.length - 1; i++) {
      const A = new THREE.Vector3(...pts[i]), Bv = new THREE.Vector3(...pts[i + 1]), d = new THREE.Vector3().subVectors(Bv, A), len = d.length();
      const m = new THREE.Mesh(ctx.geo.G.cyl(8), material); m.scale.set(r * 2, len, r * 2);
      m.position.copy(A).addScaledVector(d, 0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
      m.castShadow = true; m.receiveShadow = true; parent.add(m);
      if (i > 0) K.sph(parent, r * 1.15, material, pts[i], 8);
    }
  };
  /** AC outdoor unit (室外機) standing at local (x,y,z), facing +Z by rotY. */
  K.acUnit = (parent, x, y, z, rotY = 0, withPipe = true) => {
    const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rotY; parent.add(g);
    const body = K.m('#e3e1da'), dark = K.m('#8f949a');
    K.rbox(g, 0.78, 0.56, 0.28, 0.06, body, [0, 0.33, 0]);
    K.cyl(g, 0.2, 0.02, dark, [-0.1, 0.34, 0.14], 16, [Math.PI / 2, 0, 0]);
    for (let i = -2; i <= 2; i++) K.box(g, 0.4, 0.012, 0.012, K.m('#b9bcbf'), [-0.1, 0.34 + i * 0.07, 0.155]);
    K.box(g, 0.14, 0.4, 0.02, K.m('#cfcdc6'), [0.28, 0.33, 0.145]);
    for (const sx of [-0.3, 0.3]) K.box(g, 0.06, 0.05, 0.3, dark, [sx, 0.025, 0]);
    if (withPipe) { K.cyl(g, 0.035, 0.5, K.m('#e9e3d2'), [0.33, 0.8, -0.1], 8); }
    return g;
  };
  /** Electric meter box on a +Z wall. */
  K.meter = (parent, x, y, z) => {
    K.rbox(parent, 0.2, 0.28, 0.1, 0.02, K.m('#d9d7d0'), [x, y, z + 0.05]);
    K.box(parent, 0.13, 0.1, 0.012, K.mat.emissive('#d7e2e6', 0.9), [x, y + 0.04, z + 0.105]);
    K.cyl(parent, 0.012, 0.6, K.m('#5c5a60'), [x + 0.06, y + 0.44, z + 0.04], 6);
  };
  K.gasMeter = (parent, x, y, z) => {
    const m = K.m('#cfd2cc');
    K.rbox(parent, 0.22, 0.26, 0.16, 0.03, m, [x, y, z + 0.08]);
    K.cyl(parent, 0.018, 0.5, K.m('#c9a44a'), [x - 0.06, y - 0.36, z + 0.06], 6);
    K.box(parent, 0.1, 0.05, 0.01, K.m('#e4e0d4'), [x, y + 0.05, z + 0.162]);
  };
  /** Potted plant: ceramic pot + leafy clump. */
  K.plant = (parent, x, y, z, o = {}) => {
    const r = o.r ?? 0.16, h = o.h ?? 0.24;
    K.cyl(parent, r, h, K.m(o.pot || '#a8674b'), [x, y + h / 2, z], 12, null, r * 0.78);
    K.cyl(parent, r * 1.04, 0.035, K.m(o.pot || '#a8674b'), [x, y + h, z], 12);
    const rr = rng('plant' + x.toFixed(2) + z.toFixed(2));
    // smooth cel shrub (lib/foliage.js) instead of faceted sphere clumps
    const sh = makeShrub(ctx, { r: r * 1.12, h: r * (1.25 + 0.55 * (o.tall ?? 1)), seed: 1 + Math.floor(rr() * 97), lumps: 0.24, freq: 3.2, colors: { top: o.leaf2 || '#a9cf7c', mid: o.leaf || '#6fa35c', base: '#4a7a5a' } });
    sh.position.set(x, y + h - 0.03, z); sh.rotation.y = rr() * 6.28; parent.add(sh);
    const shH = r * (1.25 + 0.55 * (o.tall ?? 1));
    if (o.flowers) for (let i = 0; i < 9; i++) { const a = rr() * 6.28, t = 0.35 + rr() * 0.5, d = r * 1.05 * Math.sqrt(1 - t * t); K.sph(parent, 0.026, K.m(o.flowers), [x + Math.cos(a) * d, y + h - 0.03 + shH * (0.5 + 0.5 * t), z + Math.sin(a) * d], 6); }
  };

  // ------------------------------------------------------------------ cloth: nobori & noren (CPU-animated geometry keeps outlines)
  const clothUpdaters = [];
  ctx.onUpdate((dt, t) => { const gust = ctx.shared.uGust.value; for (const f of clothUpdaters) f(t, gust, dt); });

  /** Nobori flag. Pole + top bar static; banner animated. o: {x,z,rot,tex,w,h,poleH,base} */
  K.nobori = (S, o) => {
    const w = o.w ?? 0.45, h = o.h ?? 1.65, ph = o.poleH ?? 2.55;
    const y0 = S.gl(o.x, o.z);
    const gs = new THREE.Group(); gs.position.set(o.x, y0, o.z); gs.rotation.y = o.rot || 0; S.g.add(gs);
    const pole = K.m('#e8e6e0'), baseM = K.m(o.baseColor || '#6d747c');
    K.cyl(gs, 0.016, ph, pole, [0, ph / 2, 0], 8);
    K.box(gs, w + 0.03, 0.016, 0.016, pole, [(o.flip ? -1 : 1) * (w / 2 + 0.01), ph - 0.05, 0]);
    // water-tank base (注水式スタンド)
    K.cyl(gs, 0.2, 0.12, baseM, [0, 0.06, 0], 14, null, 0.22);
    K.cyl(gs, 0.08, 0.12, baseM, [0, 0.18, 0], 10);
    const gd = new THREE.Group(); gd.position.copy(gs.position); gd.rotation.y = gs.rotation.y; S.d.add(gd);
    const nx = 5, ny = 14;
    const sgn = o.flip ? -1 : 1;
    const geo = new THREE.PlaneGeometry(w, h, nx, ny); geo.translate(sgn * (w / 2 + 0.018), ph - 0.07 - h / 2, 0);
    const base = geo.attributes.position.array.slice();
    const m = new THREE.Mesh(geo, K.toonMemo('#ffffff', { map: o.tex, side: 'double', paint: 0.02 }));
    m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; gd.add(m);
    // loops (チチ) on the pole
    for (let i = 0; i < 4; i++) K.cyl(gs, 0.024, 0.03, K.m('#f0ece2'), [0, ph - 0.12 - i * (h - 0.1) / 3, 0], 8);
    const ph0 = (o.x * 1.7 + o.z * 0.9) % 6.28;
    const p = geo.attributes.position;
    clothUpdaters.push((t, gust) => {
      const amp = 0.035 + 0.05 * gust;
      for (let i = 0; i < p.count; i++) {
        const bx = base[i * 3], by = base[i * 3 + 1];
        const u = (sgn * bx - 0.018) / w, vt = (by - (ph - 0.07 - h)) / h; // u 0 at pole, vt 1 at top
        const free = u * (0.25 + 0.75 * (1 - vt));
        const wave = Math.sin(5.2 * u + 3.0 * (1 - vt) - 4.8 * t + ph0) + 0.45 * Math.sin(9.0 * u - 7.4 * t + ph0 * 2.1);
        const dz = amp * free * wave + 0.07 * gust * u * (1 - vt * 0.6) * Math.sin(0.8 * t + ph0);
        p.setXYZ(i, bx - sgn * Math.abs(dz) * 0.3 * u, by + Math.abs(dz) * 0.15 * (1 - vt) * u, dz);
      }
      p.needsUpdate = true; geo.computeVertexNormals();
    });
    S.cyl(o.x, o.z, 0.2, y0, y0 + ph);
    return { gs, gd, mesh: m };
  };

  /** Noren (暖簾): n strips hung from a rod at (x,y,z) (+Z faces the street); strips part when the player walks through. */
  K.noren = (S, o) => {
    const n = o.n ?? 3, w = o.w, h = o.h, gap = o.gap ?? 0.014;
    const sw = (w - gap * (n - 1)) / n;
    // rod + brackets (static)
    K.cylX(S.g, 0.018, w + 0.16, K.m(o.rodColor || '#6b4a35'), [o.x, o.y + 0.02, o.z], 8);
    const gd = new THREE.Group(); gd.position.set(o.x, o.y, o.z); S.d.add(gd);
    const mtl = K.toonMemo('#ffffff', { map: o.tex, side: 'double', paint: 0.02 });
    const strips = [];
    for (let i = 0; i < n; i++) {
      const geo = new THREE.PlaneGeometry(sw, h, 2, 8); geo.translate(0, -h / 2, 0);
      const uv = geo.attributes.uv;
      for (let j = 0; j < uv.count; j++) uv.setX(j, (i * (sw + gap) + uv.getX(j) * sw) / w);
      const m = new THREE.Mesh(geo, mtl); const xs = -w / 2 + sw / 2 + i * (sw + gap);
      m.position.set(xs, 0, 0); m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; gd.add(m);
      strips.push({ m, geo, base: geo.attributes.position.array.slice(), xs, open: 0 });
    }
    clothUpdaters.push((t, gust, dt) => {
      const pl = K.playerLocal(S);
      for (let i = 0; i < n; i++) {
        const s = strips[i]; const p = s.geo.attributes.position;
        const dx = Math.abs(pl.x - (o.x + s.xs)) - sw / 2, dzp = pl.z - o.z;
        const near = (1 - smooth(0.05, 0.45, dx)) * (1 - smooth(0.15, 0.75, Math.abs(dzp))) * (pl.y > o.y - h - 1.9 && pl.y < o.y + 0.3 ? 1 : 0);
        const target = near * (dzp > 0 ? -1 : 1);
        if (!dt) s.open = target; else s.open += (target - s.open) * Math.min(1, dt * 6);
        const sway = (0.03 + 0.05 * gust) * Math.sin(1.3 * t + i * 0.9 + o.x) + 0.02 * Math.sin(3.1 * t + i * 1.7);
        const ang = sway + s.open * 1.05;
        const ca = Math.cos(ang), sa = Math.sin(ang);
        for (let j = 0; j < p.count; j++) {
          const bx = s.base[j * 3], by = s.base[j * 3 + 1]; const dd = -by; // depth below rod
          const rip = 0.012 * Math.sin(6 * dd - 3.3 * t + i) * dd;
          p.setXYZ(j, bx + s.open * 0.12 * dd * Math.sign(bx + 0.001) * 0.4, -dd * ca, dd * sa + rip);
        }
        p.needsUpdate = true; s.geo.computeVertexNormals();
      }
    });
    return gd;
  };

  /** Paper lantern (提灯) hanging from a hook at (x,y,z); swings gently. tex drawn centred at u = 0.5. */
  K.lantern = (S, o) => {
    const r = o.r ?? 0.2, h = o.h ?? 0.5;
    const gd = new THREE.Group(); gd.position.set(o.x, o.y, o.z); S.d.add(gd);
    const pts = []; for (let i = 0; i <= 10; i++) { const v = i / 10; const y = -h + v * h; const rr = r * (0.62 + 0.38 * Math.sin(Math.PI * v)); pts.push([rr, y - 0.06]); }
    const body = K.lathe(gd, pts, K.memo('emi', '#ffffff', { map: o.tex }, o.glow ?? 1.0), [0, 0, 0], 18, Math.PI);
    const cap = K.m('#3f3a3c');
    K.cyl(gd, r * 0.66, 0.05, cap, [0, -0.06 + 0.02, 0], 14); K.cyl(gd, r * 0.66, 0.05, cap, [0, -h - 0.06 - 0.02, 0], 14);
    K.cyl(gd, 0.008, 0.08, cap, [0, 0.0, 0], 6);
    if (o.tassel) K.cyl(gd, 0.03, 0.12, K.m(o.tassel), [0, -h - 0.16, 0], 6);
    K.mergeGroup(gd);
    const ph0 = o.x * 2.1 + o.z;
    clothUpdaters.push((t, gust) => { gd.rotation.z = (0.03 + 0.04 * gust) * Math.sin(1.1 * t + ph0); gd.rotation.x = 0.025 * Math.sin(0.83 * t + ph0 * 1.3); });
    return gd;
  };

  /** Rising steam / smoke puffs (billboards, pure function of t). */
  K.steam = (S, o) => {
    const n = o.n ?? 6, puffTex = K.puffTex();
    const levels = [0.08, 0.16, 0.26, 0.36].map(a => K.memo('emi', o.color || '#f3f0ea', { map: puffTex, transparent: true, depthWrite: false, opacity: a * (o.alpha ?? 1) }, o.bright ?? 0.95));
    const puffs = [];
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(ctx.geo.G.plane(), levels[0]); m.renderOrder = 3; m.frustumCulled = false; ctx.noOutline(m); S.d.add(m); puffs.push(m);
    }
    const cam = ctx.camera, q = new THREE.Quaternion(), pq = new THREE.Quaternion();
    clothUpdaters.push((t) => {
      q.copy(cam.quaternion);
      S.d.getWorldQuaternion(pq).invert();
      for (let i = 0; i < n; i++) {
        const life = o.life ?? 3.2; const a = ((t / life + i / n) % 1 + 1) % 1;
        const m = puffs[i];
        const y = o.y + a * (o.rise ?? 1.0);
        m.position.set(o.x + (o.drift?.[0] ?? 0.25) * a + 0.05 * Math.sin(t * 1.3 + i * 2), y, o.z + (o.drift?.[1] ?? 0) * a + 0.04 * Math.cos(t + i));
        const s = (o.size ?? 0.25) * (0.5 + a * 1.4); m.scale.set(s, s, s);
        const alpha = Math.sin(Math.PI * Math.min(1, a * 1.15)) ; m.material = levels[Math.max(0, Math.min(3, Math.floor(alpha * 4)))];
        m.quaternion.copy(pq).multiply(q);
      }
    });
    return puffs;
  };
  K.puffTex = () => draw(128, 128, (g, w, h) => {
    const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  }, 'sb-puff', false);

  /** Automatic sliding door (panel group slides along local X of its parent when the player is near). */
  /** Merge a (dynamic) group's child meshes by material + layer + shadow flags into one mesh each,
   *  in group space — dynamic objects are never batched, so this keeps their draw calls low. */
  K.mergeGroup = (grp) => {
    grp.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(grp.matrixWorld).invert(), m4 = new THREE.Matrix4();
    const by = new Map();
    grp.traverse((o) => {
      if (!o.isMesh || o === grp || Array.isArray(o.material) || !o.geometry.index) return;
      const k = o.material.uuid + '|' + o.layers.mask + '|' + o.castShadow + o.receiveShadow;
      let a = by.get(k); if (!a) by.set(k, (a = [])); a.push(o);
    });
    for (const list of by.values()) {
      if (list.length < 2) continue;
      const geos = list.map((o) => {
        const gg = o.geometry.clone();
        for (const n of Object.keys(gg.attributes)) if (n !== 'position' && n !== 'normal' && n !== 'uv') gg.deleteAttribute(n);
        if (!gg.attributes.uv) gg.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(gg.attributes.position.count * 2), 2));
        gg.applyMatrix4(m4.multiplyMatrices(inv, o.matrixWorld)); return gg;
      });
      const mg = ctx.geo.mergeGeometries(geos, false); if (!mg) continue;
      const s = list[0], mesh = new THREE.Mesh(mg, s.material);
      mesh.castShadow = s.castShadow; mesh.receiveShadow = s.receiveShadow; mesh.layers.mask = s.layers.mask;
      for (const o of list) o.parent.remove(o);
      grp.add(mesh);
    }
    return grp;
  };
  K.autoSlide = (S, panel, o) => {
    K.mergeGroup(panel);
    const x0 = panel.position.x; let st = 0;
    ctx.onUpdate((dt) => {
      const pl = K.playerLocal(S);
      const d = Math.hypot(pl.x - o.cx, pl.z - o.cz);
      const target = d < (o.r ?? 2.6) ? 1 : (o.rest ?? 0);
      if (!dt) st = target; else st += (target - st) * Math.min(1, dt * 3.2);
      const e = st * st * (3 - 2 * st);
      panel.position.x = x0 + e * o.dx;
    });
  };

  // ------------------------------------------------------------------ small shop props
  /** Plastic beer/drink crate with bottle tops. */
  K.crate = (parent, x, y, z, color, rotY = 0, bottles = true, bottleColor = '#8a5a3a') => {
    const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rotY; parent.add(g);
    const cm = K.mt(color, K.crateTex(), {});
    K.box(g, 0.46, 0.3, 0.34, cm, [0, 0.15, 0]);
    K.box(g, 0.42, 0.02, 0.3, K.m('#4a4450'), [0, 0.295, 0]);
    if (bottles) { const bm = K.m(bottleColor); for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) K.cyl(g, 0.028, 0.05, bm, [-0.165 + i * 0.11, 0.33, -0.1 + j * 0.1], 6); }
    return g;
  };
  K.crateTex = () => draw(128, 128, (g, w, h) => {
    g.fillStyle = '#f2f2f2'; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(40,30,50,0.55)';
    for (let i = 0; i < 4; i++) K.rr(g, 10 + i * 29, 22, 20, 40, 5), g.fill();
    for (let i = 0; i < 4; i++) K.rr(g, 10 + i * 29, 78, 20, 30, 5), g.fill();
    g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(0, 0, w, 6);
  }, 'sb-crate', false);
  /** Wooden bench. */
  K.bench = (parent, x, y, z, len, rotY = 0, o = {}) => {
    const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rotY; parent.add(g);
    const wm = K.mt(o.color || C.woodLight, T.grain), dm = K.m(o.leg || C.woodMid);
    const sh = o.seatH ?? 0.42, d = o.d ?? 0.38;
    K.tbox(g, len, 0.045, d, wm, [0, sh - 0.022, 0], 1);
    for (const sx of [-len / 2 + 0.12, len / 2 - 0.12]) { K.box(g, 0.06, sh - 0.045, 0.06, dm, [sx, (sh - 0.045) / 2, -d / 2 + 0.06]); K.box(g, 0.06, sh - 0.045, 0.06, dm, [sx, (sh - 0.045) / 2, d / 2 - 0.06]); K.box(g, 0.05, 0.05, d - 0.1, dm, [sx, 0.12, 0]); }
    K.box(g, len - 0.2, 0.05, 0.04, dm, [0, sh - 0.09, -d / 2 + 0.05]);
    if (o.back) { for (const sx of [-len / 2 + 0.12, len / 2 - 0.12]) K.box(g, 0.05, 0.42, 0.05, dm, [sx, sh + 0.2, -d / 2 + 0.03]); K.tbox(g, len, 0.12, 0.03, wm, [0, sh + 0.32, -d / 2 + 0.03], 1); }
    return g;
  };
  /** Price tag / small card texture (cached by text). */
  K.card = (lines, o = {}) => {
    const w = o.w || 256, h = o.h || 128;
    return draw(w, h, (g) => {
      g.fillStyle = o.bg || '#f4efe2'; K.rr(g, 0, 0, w, h, o.r ?? 10); g.fill();
      if (o.border) { g.strokeStyle = o.border; g.lineWidth = 6; K.rr(g, 5, 5, w - 10, h - 10, 8); g.stroke(); }
      const n = lines.length;
      lines.forEach((ln, i) => {
        const size = (i === 0 ? (o.size0 || h * 0.42) : (o.size1 || h * 0.26)) / (n > 2 ? 1.2 : 1);
        K.text(g, ln, w / 2, h * (n === 1 ? 0.52 : (0.3 + i * (0.5 / (n - 1)) + (n > 2 ? -0.04 : 0.04))), w * 0.9, size, o.font || F.hand, o.weight || 700, (i === 0 ? o.fg : o.fg2) || o.fg || '#3a3346');
      });
    }, 'sb-card|' + lines.join('/') + '|' + JSON.stringify(o), false);
  };
  /** Standard stickers shared by the shops. */
  K.hoursSticker = (lines, accent = '#d9718f') => draw(256, 192, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = 'rgba(248,244,236,0.93)'; K.rr(g, 4, 4, w - 8, h - 8, 14); g.fill();
    g.strokeStyle = accent; g.lineWidth = 5; K.rr(g, 10, 10, w - 20, h - 20, 10); g.stroke();
    g.fillStyle = accent; K.rr(g, 10, 10, w - 20, 44, 10); g.fill();
    K.text(g, '営業時間', w / 2, 33, w - 40, 30, F.round, 900, '#fbf6ee');
    lines.forEach((l, i) => K.text(g, l, w / 2, 82 + i * 38, w - 36, i === lines.length - 1 && lines.length > 2 ? 22 : 28, F.round, 700, '#3a3346'));
  }, 'sb-hours|' + lines.join('/'), false);
  K.cashless = () => draw(512, 160, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = 'rgba(250,248,242,0.95)'; K.rr(g, 4, 4, w - 8, h - 8, 16); g.fill();
    g.strokeStyle = '#6a8bb8'; g.lineWidth = 4; K.rr(g, 8, 8, w - 16, h - 16, 12); g.stroke();
    K.text(g, '各種キャッシュレス決済 ご利用いただけます', w / 2, 34, w - 40, 26, F.sans, 700, '#2f4d7a');
    const icons = [['IC', '#3f8f5b', '交通系IC'], ['QR', '#d9463b', 'QR決済'], ['CARD', '#2f64b5', 'クレジット'], ['e¥', '#e9a23b', '電子マネー']];
    icons.forEach(([s, c, lab], i) => {
      const x = 22 + i * 122; g.fillStyle = c; K.rr(g, x, 56, 108, 60, 10); g.fill();
      K.text(g, s, x + 54, 87, 96, 34, F.en, 900, '#fbf7ee');
      K.text(g, lab, x + 54, 136, 110, 19, F.sans, 700, '#3a3346');
    });
  }, 'sb-cashless', false);
  /** Hand-written 営業中 wooden plate. */
  K.eigyoTex = (text = '営業中', sub = '') => draw(256, 128, (g, w, h) => {
    const r = rng('eigyo' + text);
    g.fillStyle = '#c9a57a'; K.rr(g, 0, 0, w, h, 14); g.fill();
    g.strokeStyle = 'rgba(90,60,40,0.25)'; g.lineWidth = 2; for (let i = 0; i < 12; i++) { const y = r() * h; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(w * 0.3, y + 6, w * 0.6, y - 6, w, y + 3); g.stroke(); }
    g.strokeStyle = 'rgba(70,45,30,0.55)'; g.lineWidth = 5; K.rr(g, 8, 8, w - 16, h - 16, 10); g.stroke();
    K.text(g, text, w / 2, sub ? h * 0.44 : h * 0.54, w - 40, sub ? 64 : 78, F.brush, 400, '#3a2a22');
    if (sub) K.text(g, sub, w / 2, h * 0.8, w - 50, 22, F.hand, 400, '#5a3a2a');
    g.fillStyle = '#3a3346'; g.beginPath(); g.arc(w / 2, 12, 4, 0, 7); g.fill();
  }, 'sb-eigyo|' + text + sub, false);
  K.eigyoPlate = (parent, x, y, z, rotY = 0, text = '営業中', sub = '', scale = 1) => {
    // reversible plate: 営業中 on the street side, 準備中 on the back (never mirrored text)
    const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rotY; parent.add(g);
    const m = K.plane(g, 0.3 * scale, 0.15 * scale, K.toonMemo('#ffffff', { map: K.eigyoTex(text, sub) }), [0, 0, 0.0015]);
    K.plane(g, 0.3 * scale, 0.15 * scale, K.toonMemo('#ffffff', { map: K.eigyoTex('準備中', '') }), [0, 0, -0.0015], Math.PI);
    return m;
  };

  /** Clipped hedge strip for window boxes (lib/foliage.js). */
  K.hedge = (parent, x, y, z, len, h, d, seed = 3) => { const m = makeHedge(ctx, { length: len, h, d, seed, lumps: 0.16, square: 2.2 }); m.position.set(x, y, z); parent.add(m); return m; };
  /** Soft pool of warm lamplight on a floor/wall (transparent emissive gradient, no outline). */
  K.lightPool = (parent, x, y, z, w, h, o = {}) => {
    const t = draw(128, 128, (g, W, H) => {
      const gr = g.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W / 2);
      gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.45, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
    }, 'sb-pool', false);
    const m = K.plane(parent, w, h, K.memo('emi', o.color || '#ffd9a0', { map: t, transparent: true, depthWrite: false, opacity: o.opacity ?? 0.28 }, o.intensity ?? 1.0), [x, y, z], o.rotY || 0, o.rotX ?? -Math.PI / 2);
    m.receiveShadow = false; m.renderOrder = 1; ctx.noOutline(m);
    return m;
  };
  /** Shoji screen material (paper + wooden grid) seen behind upper-floor windows. */
  K.shoji = () => K.toonMemo('#ffffff', { map: draw(256, 256, (g, w, h) => {
    g.fillStyle = '#f1ece0'; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(120,90,60,0.75)';
    for (let i = 0; i <= 4; i++) g.fillRect(i * w / 4 - 3, 0, 6, h);
    for (let j = 0; j <= 6; j++) g.fillRect(0, j * h / 6 - 3, w, 6);
  }, 'sb-shoji', false), emissive: '#6b5a44', emissiveIntensity: 0.25 });
  /** Curtain (light fabric with folds) behind a window. */
  K.curtain = (color = '#e8dccb') => K.toonMemo(color, { map: draw(256, 128, (g, w, h) => {
    for (let i = 0; i < 16; i++) { const gr = g.createLinearGradient(i * 16, 0, i * 16 + 16, 0); gr.addColorStop(0, '#d9d4cc'); gr.addColorStop(0.5, '#f7f5f0'); gr.addColorStop(1, '#d4cfc6'); g.fillStyle = gr; g.fillRect(i * 16, 0, 16, h); }
  }, 'sb-curtain', false), emissive: '#5a4a3a', emissiveIntensity: 0.15 });
  /** Vertical projecting lightbox sign (袖看板), perpendicular to the facade. texA faces +X, texB faces -X. */
  K.sodeSign = (parent, o) => {
    const g = new THREE.Group(); g.position.set(o.x, o.y, o.z); parent.add(g);
    const w = o.w ?? 0.5, h = o.h ?? 1.6, t = o.t ?? 0.14;
    const frame = K.m(o.frame || '#e8e4da');
    K.rboxR(g, t, h + 0.06, w + 0.06, 0.02, frame, [0, h / 2, w / 2 + 0.2]);
    for (const s of [1, -1]) K.plane(g, w, h, K.memo('emi', '#ffffff', { map: o.tex }, o.glow ?? 0.95), [s * (t / 2 + 0.004), h / 2, w / 2 + 0.2], s * Math.PI / 2);
    for (const yy of [0.25, h - 0.25]) K.box(g, 0.04, 0.04, 0.24, K.m('#8d949b'), [0, yy, 0.1]);
    return g;
  };

  return K;
}
