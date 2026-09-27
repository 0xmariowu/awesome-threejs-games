// shopsA — shared helpers: tiling hand-painted textures, texture atlases (one material per page ->
// good batching), lot-local spaces (group + kit + ground + physics in lot coordinates), generic
// shop-front / back-yard props, and an instanced "scatter" for flower heads and leaves.
import * as THREE from 'three';
import { shrubGeometry, SHRUB_COLORS } from '../lib/foliage.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
/** icosahedron welded + smooth normals: tiny round things without facet banding */
export function smoothIco(detail = 0) { let g = new THREE.IcosahedronGeometry(1, detail); g.deleteAttribute('normal'); g.deleteAttribute('uv'); g = mergeVertices(g, 1e-4); g.computeVertexNormals(); g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2)); return g; }

export const DEG = Math.PI / 180;

export function makeCommon(ctx) {
  const { mat, tex, L } = ctx;
  const F = tex.FONTS;
  const col = (c) => new THREE.Color(c);
  const hex = (c) => '#' + col(c).getHexString();

  // ------------------------------------------------------------------ canvas utils
  function blot(g, W, H, x, y, r, rgb, a) {
    for (const dx of [-W, 0, W]) for (const dy of [-H, 0, H]) {
      const cx = x + dx, cy = y + dy;
      if (cx + r < 0 || cx - r > W || cy + r < 0 || cy - r > H) continue;
      const gr = g.createRadialGradient(cx, cy, 0, cx, cy, r);
      gr.addColorStop(0, `rgba(${rgb},${a})`); gr.addColorStop(1, `rgba(${rgb},0)`);
      g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
    }
  }
  const U = {
    rr(g, x, y, w, h, r) { tex.roundRect(g, x, y, w, h, r); },
    /** text with optional fit width. */
    text(g, s, x, y, size, font, color, o = {}) {
      g.textAlign = o.align || 'center'; g.textBaseline = o.base || 'middle'; g.fillStyle = color;
      const weight = o.weight ?? 700;
      if (o.maxW) return tex.fitText(g, s, x, y, o.maxW, size, font, weight, o.stroke ? { stroke: o.stroke, strokeStyle: o.strokeColor || '#fff' } : {});
      g.font = `${weight} ${size}px ${font}`;
      if (o.stroke) { g.lineWidth = o.stroke; g.strokeStyle = o.strokeColor || '#fff'; g.lineJoin = 'round'; g.strokeText(s, x, y); }
      g.fillText(s, x, y); return size;
    },
    vtext(g, s, x, y, size, font, color, weight = 700, gap = 1.05) { g.fillStyle = color; return tex.verticalText(g, s, x, y, size, font, weight, gap); },
    blot,
    /** little five-petal sakura flower drawn on a canvas */
    sakura(g, x, y, r, fill, center) {
      g.fillStyle = fill;
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + i * Math.PI * 2 / 5;
        g.beginPath(); g.ellipse(x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55, r * 0.5, r * 0.36, a, 0, Math.PI * 2); g.fill();
      }
      if (center) { g.fillStyle = center; g.beginPath(); g.arc(x, y, r * 0.18, 0, Math.PI * 2); g.fill(); }
    },
    sun(g, x, y, r, fill, rays) {
      g.fillStyle = fill; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
      if (rays) { g.strokeStyle = fill; g.lineCap = 'round'; g.lineWidth = r * 0.22; for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; g.beginPath(); g.moveTo(x + Math.cos(a) * r * 1.3, y + Math.sin(a) * r * 1.3); g.lineTo(x + Math.cos(a) * r * 1.65, y + Math.sin(a) * r * 1.65); g.stroke(); } }
    },
  };

  // ------------------------------------------------------------------ tiling textures (multiply with material colour)
  const T = {};
  T.wash = tex.draw(512, 512, (g, W, H) => {
    const r = ctx.rng('shopsA.wash');
    g.fillStyle = '#f5f4f1'; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 70; i++) { const warm = r() < 0.45; blot(g, W, H, r() * W, r() * H, 20 + r() * 90, warm ? '205,175,135' : '140,132,160', warm ? 0.02 + r() * 0.03 : 0.018 + r() * 0.03); }
    for (let i = 0; i < 24; i++) blot(g, W, H, r() * W, r() * H, 30 + r() * 70, '255,255,255', 0.05 + r() * 0.06);
    g.strokeStyle = 'rgba(120,110,130,0.10)'; g.lineWidth = 1;
    for (let i = 0; i < 3; i++) { let x = 40 + r() * (W - 80), y = 40 + r() * (H - 160); g.beginPath(); g.moveTo(x, y); for (let j = 0; j < 5; j++) { x += (r() - 0.5) * 18; y += 6 + r() * 10; g.lineTo(x, y); } g.stroke(); }
  }, { key: 'shopsA.wash', repeat: [1, 1] });

  T.wood = tex.draw(256, 256, (g, W, H) => {
    const r = ctx.rng('shopsA.wood');
    g.fillStyle = '#f3f1ee'; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 26; i++) {
      const y0 = 6 + r() * (H - 12), a = 0.05 + r() * 0.1, amp = 1 + r() * 3, ph = r() * 6.28, fr = (1 + Math.floor(r() * 3)) * Math.PI * 2 / W;
      g.strokeStyle = `rgba(95,62,40,${a})`; g.lineWidth = 0.8 + r() * 1.6;
      g.beginPath(); for (let x = 0; x <= W; x += 8) { const y = y0 + Math.sin(x * fr + ph) * amp; if (x) g.lineTo(x, y); else g.moveTo(x, y); } g.stroke();
    }
  }, { key: 'shopsA.wood', repeat: [1, 1] });

  T.planks = tex.draw(512, 512, (g, W, H) => {
    const r = ctx.rng('shopsA.planks');
    const n = 8, pw = W / n;
    for (let i = 0; i < n; i++) {
      const js = [r() * H * 0.3, H * 0.35 + r() * H * 0.3, H * 0.72 + r() * H * 0.2].sort((a, b) => a - b);
      for (let j = 0; j < js.length; j++) {
        const y0 = js[j], y1 = j + 1 < js.length ? js[j + 1] : js[0] + H;
        const t = 222 + r() * 30;
        g.fillStyle = `rgb(${t | 0},${(t - 5) | 0},${(t - 13) | 0})`;
        g.fillRect(i * pw, y0, pw, y1 - y0); if (y1 > H) g.fillRect(i * pw, y0 - H, pw, y1 - y0);
        g.fillStyle = 'rgba(70,45,30,0.32)'; g.fillRect(i * pw, y0, pw, 2);
      }
      g.fillStyle = 'rgba(70,45,30,0.35)'; g.fillRect(i * pw, 0, 2, H);
      g.strokeStyle = 'rgba(90,60,40,0.07)'; g.lineWidth = 1;
      for (let l = 0; l < 4; l++) { const x = i * pw + 6 + r() * (pw - 12); g.beginPath(); g.moveTo(x, 0); g.bezierCurveTo(x + 4, H * 0.3, x - 4, H * 0.6, x, H); g.stroke(); }
    }
  }, { key: 'shopsA.planks', repeat: [1, 1] });

  T.tiles = tex.draw(256, 256, (g, W, H) => {
    const r = ctx.rng('shopsA.tiles');
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) { const t = 236 + r() * 14; g.fillStyle = `rgb(${t | 0},${t | 0},${(t - 3) | 0})`; g.fillRect(i * 128, j * 128, 128, 128); }
    for (let i = 0; i < 30; i++) blot(g, W, H, r() * W, r() * H, 10 + r() * 30, '150,145,160', 0.04);
    g.fillStyle = 'rgba(140,138,150,0.55)'; g.fillRect(0, 0, W, 2); g.fillRect(0, 128, W, 2); g.fillRect(0, 0, 2, H); g.fillRect(128, 0, 2, H);
  }, { key: 'shopsA.tiles', repeat: [1, 1] });

  T.roofTile = tex.draw(256, 256, (g, W, H) => {
    const rows = 4, rh = H / rows;
    for (let i = 0; i < rows; i++) {
      const gr = g.createLinearGradient(0, i * rh, 0, (i + 1) * rh);
      gr.addColorStop(0, '#f4f4f6'); gr.addColorStop(0.75, '#dcdce2'); gr.addColorStop(1, '#b9b8c4');
      g.fillStyle = gr; g.fillRect(0, i * rh, W, rh);
      g.fillStyle = 'rgba(60,55,80,0.45)'; g.fillRect(0, (i + 1) * rh - 3, W, 3);
      g.fillStyle = 'rgba(60,55,80,0.18)';
      for (let x = (i % 2) * 32; x < W; x += 64) g.fillRect(x, i * rh, 2, rh - 3);
    }
  }, { key: 'shopsA.roofTile', repeat: [1, 1] });

  T.seam = tex.draw(256, 64, (g, W, H) => {
    g.fillStyle = '#ececef'; g.fillRect(0, 0, W, H);
    for (let x = 0; x < W; x += 64) { g.fillStyle = '#ffffff'; g.fillRect(x, 0, 4, H); g.fillStyle = 'rgba(70,70,90,0.35)'; g.fillRect(x + 4, 0, 3, H); }
  }, { key: 'shopsA.seam', repeat: [1, 1] });

  T.brick = tex.draw(256, 256, (g, W, H) => {
    const r = ctx.rng('shopsA.brick');
    g.fillStyle = '#d9d1c5'; g.fillRect(0, 0, W, H);
    const rows = 16, rh = H / rows, bw = W / 4;
    for (let i = 0; i < rows; i++) {
      const off = (i % 2) * bw * 0.5;
      for (let x = -bw + off; x < W; x += bw) {
        const t = r();
        g.fillStyle = `rgb(${(178 + t * 30) | 0},${(102 + t * 22) | 0},${(84 + t * 16) | 0})`;
        g.fillRect(x + 2, i * rh + 2, bw - 4, rh - 3);
      }
    }
  }, { key: 'shopsA.brick', repeat: [1, 1] });

  T.concrete = tex.draw(512, 512, (g, W, H) => {
    const r = ctx.rng('shopsA.concrete');
    g.fillStyle = '#f1f0ec'; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 40; i++) blot(g, W, H, r() * W, r() * H, 20 + r() * 80, r() < 0.5 ? '150,145,160' : '190,170,140', 0.035);
    for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(110,105,120,${0.08 + r() * 0.1})`; g.fillRect(r() * W, r() * H, 1.5, 1.5); }
    g.fillStyle = 'rgba(110,108,122,0.45)'; g.fillRect(0, 0, W, 3); g.fillRect(0, 0, 3, H);
  }, { key: 'shopsA.concrete', repeat: [1, 1] });

  T.crate = tex.draw(128, 128, (g, W, H) => {
    g.fillStyle = '#f2f2f2'; g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(40,40,60,0.42)';
    for (let i = 0; i < 5; i++) for (let j = 0; j < 3; j++) { U.rr(g, 12 + i * 21.5, 34 + j * 30, 14, 22, 5); g.fill(); }
    U.rr(g, 44, 10, 40, 12, 6); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(0, 0, W, 5);
  }, { key: 'shopsA.crate' });

  T.carton = tex.draw(128, 128, (g, W, H) => {
    g.fillStyle = '#f4f1ea'; g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(255,248,225,0.55)'; g.fillRect(W * 0.4, 0, W * 0.2, H);
    g.strokeStyle = 'rgba(95,65,40,0.35)'; g.lineWidth = 2; g.strokeRect(16, 70, 40, 28);
    g.fillStyle = 'rgba(95,65,40,0.35)'; g.fillRect(84, 20, 30, 4); g.fillRect(84, 28, 22, 4);
    g.fillStyle = 'rgba(95,65,40,0.18)'; g.fillRect(0, H - 6, W, 6);
  }, { key: 'shopsA.carton' });

  const stripeCache = new Map();
  function stripeTex(a, b, n = 4) {
    const key = `shopsA.stripe|${a}|${b}|${n}`;
    if (stripeCache.has(key)) return stripeCache.get(key);
    const t = tex.draw(256, 16, (g, W, H) => { for (let i = 0; i < n; i++) { g.fillStyle = i % 2 ? b : a; g.fillRect(i * W / n, 0, W / n + 1, H); } }, { key, repeat: [1, 1] });
    stripeCache.set(key, t); return t;
  }

  // ------------------------------------------------------------------ materials
  // The core static batcher (core/batch2.js) bakes each material's colour into vertex colours and merges
  // meshes whose materials share the same *signature* (map, side, transparency, paint, emissive colour +
  // intensity). So colours are free, but every distinct emissive value is a separate draw call: interior
  // self-light is therefore quantised to a few warm levels (by albedo luminance) instead of c * WARM.
  const WARM = col('#ffdcae');
  const INNER_LV = [0.05, 0.14, 0.3, 0.52, 0.78];
  const innerEm = (c, amt) => {
    const cc = col(c); const lum = 0.2126 * cc.r + 0.7152 * cc.g + 0.0722 * cc.b;
    const lv = INNER_LV.reduce((a, b) => (Math.abs(b - lum) < Math.abs(a - lum) ? b : a));
    return { emissive: hex(WARM.clone().multiplyScalar(lv)), emissiveIntensity: amt < 0.24 ? 0.2 : amt < 0.38 ? 0.3 : 0.42 };
  };
  const quantGlass = (o = {}) => {
    if (o.frost) return { tint: '#9fb6c8', opacity: 0.26, frost: true };
    const op = o.opacity ?? 0.2;
    return { tint: o.tint === '#6b4a37' ? '#6b4a37' : '#9fb6c8', opacity: op < 0.24 ? 0.18 : op < 0.38 ? 0.3 : 0.45 };
  };
  const M = {
    t: (c, o) => mat.toon(c, o),
    wall: (c, o = {}) => mat.toon(c, { map: T.wash, ...o }),
    wood: (c, o = {}) => mat.toon(c, { map: T.wood, ...o }),
    planks: (c, o = {}) => mat.toon(c, { map: T.planks, ...o }),
    tiles: (c, o = {}) => mat.toon(c, { map: T.tiles, ...o }),
    brick: (o = {}) => mat.toon('#ffffff', { map: T.brick, ...o }),
    concrete: (c = '#cfcdc6', o = {}) => mat.toon(c, { map: T.concrete, ...o }),
    roofTile: (c, o = {}) => mat.toon(c, { map: T.roofTile, ...o }),
    seam: (c, o = {}) => mat.toon(c, { map: T.seam, ...o }),
    crate: (c) => mat.toon(c, { map: T.crate, paint: 0.03 }),
    carton: (c = '#c9a57a') => mat.toon(c, { map: T.carton, paint: 0.04 }),
    stripe: (a, b, n) => mat.toon('#ffffff', { map: stripeTex(a, b, n), paint: 0.05 }),
    /** interior surface: toon + (quantised) warm self-light so shop interiors glow softly behind the glass */
    inner: (c, amt = 0.3, o = {}) => mat.toon(c, { ...innerEm(c, amt), ...o }),
    innerMap: (c, map, amt = 0.3, o = {}) => mat.toon(c, { map, ...innerEm(c, amt), ...o }),
    glow: (c, i = 1.0, o) => mat.emissive(c, i, o),
    glass: (o = {}) => mat.glass(quantGlass(o)),
    decal: (c, o) => mat.decal(c, o),
  };

  // ------------------------------------------------------------------ geometry
  /** BoxGeometry whose UVs are in metres / s (tiling textures keep their scale on any box). */
  function uvBox(w, h, d, s = 1) {
    const g = new THREE.BoxGeometry(w, h, d);
    const uv = g.attributes.uv;
    const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
    for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) { const j = f * 4 + i; uv.setXY(j, uv.getX(j) * dims[f][0] / s, uv.getY(j) * dims[f][1] / s); }
    return g;
  }
  function uvPlane(w, h, s = 1) {
    const g = new THREE.PlaneGeometry(w, h);
    const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / s, uv.getY(i) * h / s);
    return g;
  }
  /** Prism from a 2D profile in the (z,y) plane, extruded along x by w (centred). */
  function profileX(pts, w) {
    const g = ctx.geo.extrude(pts, w); // shape XY, extruded along Z, centred
    g.rotateY(-Math.PI / 2);        // shape x -> +z, extrusion -> x
    return g;
  }
  /** Row of downward half-discs (awning scallops) along x from 0..w, top edge at y=0 (+lip). */
  function scallopGeo(w, sw = 0.16, lip = 0.03) {
    const n = Math.max(1, Math.round(w / sw)); const s = w / n, r = s / 2;
    const sh = new THREE.Shape(); sh.moveTo(0, lip);
    sh.lineTo(0, 0);
    for (let i = 0; i < n; i++) sh.absarc(i * s + r, 0, r, Math.PI, 2 * Math.PI, false);
    sh.lineTo(w, lip); sh.lineTo(0, lip);
    const g = new THREE.ExtrudeGeometry(sh, { depth: 0.012, bevelEnabled: false, curveSegments: 4 });
    g.translate(-w / 2, 0, -0.006);
    return g;
  }

  // ------------------------------------------------------------------ atlases
  class Atlas {
    constructor(kind, size = 1024) { this.kind = kind; this.size = size; this.pages = []; this._new(); }
    _new() {
      const { canvas, g } = tex.canvas(this.size, this.size);
      g.fillStyle = this.kind === 'cut' ? 'rgba(0,0,0,0)' : '#ffffff'; g.fillRect(0, 0, this.size, this.size);
      const t = tex.finish(canvas, { anisotropy: 8 });
      let m;
      const i = this.pages.length;
      if (this.kind === 'glow') m = mat.emissive('#ffffff', 1.0, { map: t });
      else if (this.kind === 'inner') m = mat.emissive('#fff0dc', 0.92, { map: t });
      else if (this.kind === 'cut') m = mat.toon('#ffffff', { map: t, alphaTest: 0.5, side: 'double', paint: 0.02, name: 'shopsA-cut-' + i });
      else {
        m = mat.toon('#ffffff', { map: t, paint: 0.0, name: 'shopsA-atlas-' + i });
      }
      this.pages.push({ canvas, g, t, m, x: 0, y: 0, rowH: 0 });
    }
    region(w, h, fn, o = {}) {
      const pad = 4, S = this.size;
      w = Math.round(w); h = Math.round(h);
      let pg = this.pages[this.pages.length - 1];
      if (pg.x + w + pad * 2 > S) { pg.x = 0; pg.y += pg.rowH; pg.rowH = 0; }
      if (pg.y + h + pad * 2 > S) { this._new(); pg = this.pages[this.pages.length - 1]; }
      const x = pg.x + pad, y = pg.y + pad, g = pg.g;
      g.save(); g.translate(x, y);
      if (o.bg) { g.fillStyle = o.bg; g.fillRect(-pad, -pad, w + pad * 2, h + pad * 2); }
      g.beginPath(); g.rect(-pad, -pad, w + pad * 2, h + pad * 2); g.clip();
      g.textAlign = 'left'; g.textBaseline = 'alphabetic'; g.globalAlpha = 1; g.lineWidth = 1;
      fn(g, w, h);
      g.restore();
      pg.x += w + pad * 2; pg.rowH = Math.max(pg.rowH, h + pad * 2);
      return { m: pg.m, u0: x / S, u1: (x + w) / S, v0: 1 - (y + h) / S, v1: 1 - y / S, w, h };
    }
    finalize() { for (const p of this.pages) p.t.needsUpdate = true; }
  }
  const A = { lit: new Atlas('lit'), glow: new Atlas('glow'), cut: new Atlas('cut'), inner: new Atlas('inner') };
  /** PlaneGeometry (w×h, facing +Z) showing an atlas region, optionally a sub-rectangle of it (fractions). */
  function regionGeo(reg, w, h, sub) {
    const g = new THREE.PlaneGeometry(w, h);
    const uv = g.attributes.uv;
    let u0 = reg.u0, u1 = reg.u1, v0 = reg.v0, v1 = reg.v1;
    if (sub) { const du = u1 - u0, dv = v1 - v0; u0 = reg.u0 + sub[0] * du; u1 = reg.u0 + sub[2] * du; v1 = reg.v1 - sub[1] * dv; v0 = reg.v1 - sub[3] * dv; }
    for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) * (u1 - u0), v0 + uv.getY(i) * (v1 - v0));
    return g;
  }

  // ------------------------------------------------------------------ lot spaces
  function space(id) {
    const lot = L.lotById(id), f = L.lotFrame(lot);
    const g = new THREE.Group(); g.name = 'shopsA:' + id; g.position.set(f.x, f.y, f.z); g.rotation.y = f.rotY;
    ctx.addStatic(g); g.updateMatrixWorld(true);
    const k = ctx.kit(g);
    const c = Math.cos(f.rotY), s = Math.sin(f.rotY);
    const toW = (lx, lz) => ({ x: f.x + lx * c + lz * s, z: f.z - lx * s + lz * c });
    const toL = (x, z) => { const dx = x - f.x, dz = z - f.z; return { x: dx * c - dz * s, z: dx * s + dz * c }; };
    const gy = (lx, lz) => { const p = toW(lx, lz); return L.heightAt(p.x, p.z) - f.y; };
    const ph = ctx.physics;
    const S = {
      id, lot, f, g, k, toW, toL, gy, c, s,
      box(lx, lz, w, d, y0, y1, rot = 0) { const p = toW(lx, lz); return ph.addBox(p.x, p.z, w, d, f.rotY + rot, f.y + y0, f.y + y1); },
      walk(lx, lz, w, d, top, rot = 0) { const p = toW(lx, lz); return ph.addWalkBox(p.x, p.z, w, d, f.rotY + rot, f.y + top); },
      ramp(lx, lz, w, d, yA, yB, rot = 0) { const p = toW(lx, lz); return ph.addWalkRamp(p.x, p.z, w, d, f.rotY + rot, f.y + yA, f.y + yB); },
      cyl(lx, lz, r, y0, y1) { const p = toW(lx, lz); return ph.addCylinder(p.x, p.z, r, f.y + y0, f.y + y1); },
      world(lx, ly, lz) { const p = toW(lx, lz); return new THREE.Vector3(p.x, f.y + ly, p.z); },
      dyn() { const d = new THREE.Group(); d.position.copy(g.position); d.rotation.y = f.rotY; ctx.add(d); return d; },
      ubox(w, h, d, m, pos, rot, sc = 1) { return k.mesh(uvBox(w, h, d, sc), m, pos, rot); },
      uboxB(w, h, d, m, pos, rot, sc = 1) { return k.mesh(uvBox(w, h, d, sc), m, [pos[0], pos[1] + h / 2, pos[2]], rot); },
      card(reg, w, h, pos, rot, sub, kk = k) { const m = kk.mesh(regionGeo(reg, w, h, sub), reg.m, pos, rot); m.castShadow = false; return m; },
    };
    return S;
  }

  /** Ground-following paving (lot-local rectangle), lifted a little above the terrain. */
  function pave(S, x0, x1, z0, z1, m, o = {}) {
    const step = o.step ?? 0.8, lift = o.lift ?? 0.02, s = o.uv ?? 1;
    const nx = Math.max(1, Math.ceil((x1 - x0) / step)), nz = Math.max(1, Math.ceil((z1 - z0) / step));
    const geo = new THREE.PlaneGeometry(x1 - x0, z1 - z0, nx, nz);
    geo.rotateX(-Math.PI / 2); geo.translate((x0 + x1) / 2, 0, (z0 + z1) / 2);
    const p = geo.attributes.position, t = geo.attributes.uv;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); p.setY(i, (o.yFn ? o.yFn(x, z) : S.gy(x, z)) + lift); t.setXY(i, x / s, -z / s); }
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, m); mesh.receiveShadow = true; mesh.castShadow = false; S.g.add(mesh);
    return mesh;
  }
  /** Foundation/plinth block: top at y=top, bottom buried below the lowest ground in the footprint. */
  function plinth(S, x0, x1, z0, z1, top, m, sc = 1) {
    let lo = Infinity; for (const [x, z] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1], [(x0 + x1) / 2, (z0 + z1) / 2]]) lo = Math.min(lo, S.gy(x, z));
    const y0 = lo - 0.25;
    return S.ubox(x1 - x0, top - y0, z1 - z0, m, [(x0 + x1) / 2, (top + y0) / 2, (z0 + z1) / 2], null, sc);
  }

  // ------------------------------------------------------------------ instanced scatter (flowers, leaves, blossoms)
  function tulipGeo() {
    const pts = [[0.0, 0], [0.55, 0.12], [0.85, 0.45], [0.9, 0.8], [0.72, 1.0]].map(p => new THREE.Vector2(p[0], p[1]));
    return new THREE.LatheGeometry(pts, 8);
  }
  const scatterTypes = {
    // smooth (welded, smooth-normal) shapes only: faceted icosahedra band badly under the toon ramp
    ball: { geo: () => smoothIco(0), outline: false },
    bush: { geo: () => smoothIco(1), outline: true },
    cup: { geo: tulipGeo, outline: false, side: 'double' },
    disc: { geo: () => new THREE.CylinderGeometry(1, 1, 1, 8), outline: false },
    stem: { geo: () => new THREE.CylinderGeometry(1, 1, 1, 4, 1, true), outline: false },
    blade: { geo: () => { const g = new THREE.PlaneGeometry(1, 1); g.translate(0, 0.5, 0); return g; }, outline: false, side: 'double' },
  };
  const scatterLists = {};
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
  let _lastBase = null;
  const scatter = {
    /** base: a space S or any Object3D; pos/scl/rot in base-local coordinates. */
    add(type, base, pos, scl, color, rot) {
      const o = base.g || base;
      if (o !== _lastBase) { o.updateWorldMatrix(true, false); _lastBase = o; }
      _e.set(rot ? rot[0] || 0 : 0, rot ? rot[1] || 0 : 0, rot ? rot[2] || 0 : 0); _q.setFromEuler(_e);
      _p.set(pos[0], pos[1], pos[2]); _s.set(scl[0], scl[1], scl[2]);
      _m.compose(_p, _q, _s).premultiply(o.matrixWorld);
      (scatterLists[type] ||= []).push({ m: _m.clone(), c: col(color) });
    },
    build() {
      const out = [];
      for (const [type, arr] of Object.entries(scatterLists)) {
        if (!arr.length) continue;
        const t = scatterTypes[type];
        const m = mat.toon('#ffffff', { paint: 0.03, side: t.side });
        const im = new THREE.InstancedMesh(t.geo(), m, arr.length);
        arr.forEach((it, i) => { im.setMatrixAt(i, it.m); im.setColorAt(i, it.c); });
        im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
        im.computeBoundingSphere(); im.computeBoundingBox?.();
        im.castShadow = type === 'bush'; im.receiveShadow = true; im.name = 'shopsA-scatter-' + type;
        if (!t.outline) ctx.noOutline(im);
        ctx.addStatic(im); out.push(im);
      }
      return out;
    },
  };

  // ------------------------------------------------------------------ generic props
  const P = {};
  const mMetal = M.t('#9aa1a8'), mMetalDark = M.t('#6d747c'), mInk = M.t('#4a4552');

  /** plastic crate (折りたたみコンテナ / ビールケース). pos = bottom centre. */
  P.crate = (S, x, y, z, rotY = 0, c = '#4f8fc0', o = {}) => {
    const w = o.w ?? 0.5, h = o.h ?? 0.3, d = o.d ?? 0.36;
    const m = S.k.box(w, h, d, M.crate(c), [x, y + h / 2, z], [0, rotY, 0]);
    if (o.bottles) {
      const gq = S.k.group([x, y + h, z], rotY); const kk = ctx.kit(gq);
      for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) kk.cyl(0.028, 0.028, 0.04, M.t(o.bottles), [-w / 2 + 0.07 + i * (w - 0.14) / 3, 0.0, -d / 2 + 0.07 + j * (d - 0.14) / 2], null, 6);
    }
    return m;
  };
  /** cardboard box */
  P.carton = (S, x, y, z, w, h, d, rotY = 0, c = '#c9a57a') => S.k.box(w, h, d, M.carton(c), [x, y + h / 2, z], [0, rotY, 0]);

  /** wall-hung / ground AC outdoor unit (室外機) with duct cover up the wall. pos = bottom centre, back against wall at -z. */
  P.acUnit = (S, x, y, z, rotY = 0, o = {}) => {
    const w = o.w ?? 0.8, h = o.h ?? 0.6, d = o.d ?? 0.29;
    const gq = S.k.group([x, y, z], rotY); const k = ctx.kit(gq);
    const body = M.t('#e4e2da');
    k.rbox(w, h, d, 0.03, body, [0, h / 2 + 0.06, 0]);
    k.cyl(h * 0.36, h * 0.36, 0.02, M.t('#5d6068'), [-w * 0.14, h / 2 + 0.06, d / 2 + 0.005], [Math.PI / 2, 0, 0], 16);
    k.cyl(h * 0.12, h * 0.12, 0.03, M.t('#d9d7cf'), [-w * 0.14, h / 2 + 0.06, d / 2 + 0.01], [Math.PI / 2, 0, 0], 10);
    for (let i = -2; i <= 2; i++) k.box(h * 0.72, 0.012, 0.012, M.t('#8b8e96'), [-w * 0.14, h / 2 + 0.06 + i * h * 0.13, d / 2 + 0.02]);
    k.box(w * 0.22, h * 0.7, 0.01, M.t('#cfcdc5'), [w * 0.34, h / 2 + 0.06, d / 2 + 0.003]);
    k.box(0.08, 0.06, d * 0.9, M.t('#5d5a62'), [-w * 0.36, 0.03, 0]);
    k.box(0.08, 0.06, d * 0.9, M.t('#5d5a62'), [w * 0.36, 0.03, 0]);
    if (o.duct !== false) {
      const dh = o.ductH ?? 1.4;
      k.box(0.1, 0.1, 0.22, M.t('#e8e1cf'), [w / 2 + 0.06, h * 0.45, -d / 2 + 0.02]);
      k.box(0.1, dh, 0.08, M.t('#e8e1cf'), [w / 2 + 0.06, h * 0.45 + dh / 2, -d / 2 - 0.06]);
    }
    return gq;
  };
  /** electric meter on a small board. pos = centre, facing +z. */
  P.meter = (S, x, y, z, rotY = 0) => {
    const gq = S.k.group([x, y, z], rotY); const k = ctx.kit(gq);
    k.box(0.26, 0.36, 0.02, M.t('#d8d5cc'), [0, 0, 0.01]);
    k.rbox(0.16, 0.22, 0.12, 0.02, M.t('#b9bcc0'), [0, 0.01, 0.08]);
    k.box(0.1, 0.07, 0.01, M.glow('#dfe9e6', 0.8), [0, 0.05, 0.145]);
    k.cyl(0.018, 0.018, 0.9, M.t('#8e9298'), [0.1, 0.62, 0.03]);
    return gq;
  };
  P.gasMeter = (S, x, y, z, rotY = 0) => {
    const gq = S.k.group([x, y, z], rotY); const k = ctx.kit(gq);
    k.rbox(0.24, 0.26, 0.14, 0.03, M.t('#c9c5b6'), [0, 0, 0.09]);
    k.box(0.12, 0.05, 0.01, M.t('#5a5f66'), [0, 0.05, 0.165]);
    k.cyl(0.02, 0.02, 0.5, M.t('#d6b64f'), [-0.07, -0.36, 0.06]);
    k.cyl(0.02, 0.02, 0.5, M.t('#d6b64f'), [0.07, -0.36, 0.06]);
    return gq;
  };
  /** two LPG cylinders with a chain (プロパンガス) pos = bottom centre between them, backs to -z */
  P.propane = (S, x, y, z, rotY = 0) => {
    const gq = S.k.group([x, y, z], rotY); const k = ctx.kit(gq);
    const m = M.t('#aeb3b8');
    for (const s of [-1, 1]) {
      k.cyl(0.16, 0.16, 1.0, m, [s * 0.19, 0.55, 0], null, 12);
      k.sphere(0.16, m, [s * 0.19, 1.05, 0], 10);
      k.cyl(0.17, 0.17, 0.06, M.t('#8d9298'), [s * 0.19, 0.03, 0], null, 12);
      k.cyl(0.06, 0.06, 0.1, M.t('#6d747c'), [s * 0.19, 1.2, 0], null, 8);
      k.box(0.2, 0.04, 0.01, M.t('#d6c35a'), [s * 0.19, 0.8, 0.162]);
    }
    ctx.wires.add([S.world(x - 0.4, y + 0.85, z), S.world(x, y + 0.8, z + 0.2), S.world(x + 0.4, y + 0.85, z)].map(v => v), { width: 0.012, color: '#6b6770' });
    k.cyl(0.015, 0.015, 0.6, M.t('#d6b64f'), [0, 1.2, -0.12], [0, 0, Math.PI / 2]);
    return gq;
  };
  /** vertical pipe from y0 to y1 (lot-local) */
  P.pipe = (S, x, z, y0, y1, r = 0.04, m = M.t('#b9b7ae')) => S.k.cyl(r, r, y1 - y0, m, [x, (y0 + y1) / 2, z], null, 8);
  /** pipe along x or z at height y */
  P.pipeH = (S, x0, x1, y, z, r = 0.035, m = M.t('#b9b7ae'), alongZ = false) => {
    const L2 = Math.abs(x1 - x0);
    if (alongZ) return S.k.cyl(r, r, L2, m, [z, y, (x0 + x1) / 2], [Math.PI / 2, 0, 0], 8);
    return S.k.cyl(r, r, L2, m, [(x0 + x1) / 2, y, z], [0, 0, Math.PI / 2], 8);
  };
  /** downpipe with brackets + shoe at the bottom (ends at ground). n = unit (x,z) direction from pipe to wall. */
  P.downpipe = (S, x, z, yTop, m = M.t('#c9c3b4'), n = [0, -1]) => {
    const yb = S.gy(x, z);
    S.k.cyl(0.04, 0.04, yTop - yb - 0.1, m, [x, (yTop + yb + 0.1) / 2, z], null, 8);
    S.k.cyl(0.045, 0.045, 0.14, m, [x - n[0] * 0.05, yb + 0.08, z - n[1] * 0.05], [-n[1] * Math.PI / 4, 0, n[0] * Math.PI / 4], 8);
    const dims = n[0] ? [0.06, 0.03, 0.12] : [0.12, 0.03, 0.06];
    for (let yy = yb + 0.8; yy < yTop - 0.3; yy += 1.2) S.k.box(dims[0], dims[1], dims[2], m, [x + n[0] * 0.03, yy, z + n[1] * 0.03]);
  };
  /** steel back door with frame, handle, small hood and a lamp. pos = bottom centre on wall face (+z out). */
  P.backDoor = (S, x, y, z, rotY = 0, c = '#8f9aa0', o = {}) => {
    const gq = S.k.group([x, y, z], rotY); const k = ctx.kit(gq);
    k.box(0.98, 2.1, 0.05, M.t('#6f757c'), [0, 1.05, 0.0]);
    k.box(0.86, 2.0, 0.04, M.t(c), [0, 1.0, 0.03]);
    k.box(0.04, 0.16, 0.05, M.t('#4f5358'), [0.33, 1.0, 0.07]);
    k.box(0.5, 0.04, 0.01, M.t('#7b8388'), [0, 1.65, 0.052]);
    if (o.hood !== false) { k.box(1.2, 0.05, 0.5, M.t('#8a9096'), [0, 2.32, 0.25]); k.box(1.2, 0.08, 0.02, M.t('#8a9096'), [0, 2.29, 0.5]); }
    if (o.lamp !== false) { k.box(0.12, 0.16, 0.08, M.t('#e6e4dc'), [0.62, 2.0, 0.05]); k.box(0.08, 0.1, 0.02, M.glow('#ffe8c0', 1.1), [0.62, 2.0, 0.1]); }
    if (o.label) { const reg = o.label; S.card(reg, 0.3, 0.1, [0, 1.5, 0.056], null, null, k); }
    return gq;
  };
  /** Smooth foliage clump from lib/foliage.js (shared vertex-colour toon material -> batched).
   *  parent: space S or Object3D; pos = ground contact centre. o: r, h, sx, sz, seed, colors|kind|green, seg */
  const shrubMat = () => mat.toon('#ffffff', { vertexColors: true, paint: 0.03 });
  const greenSet = (c) => { const b = col(c); const top = b.clone().lerp(col('#e4f0b0'), 0.38), base = b.clone().multiplyScalar(0.72).lerp(col('#3d5a66'), 0.25); return { top: hex(top), mid: hex(b), base: hex(base) }; };
  function shrub(parent, x, y, z, o = {}) {
    const p = parent.g || parent;
    const r = o.r ?? 0.3, h = o.h ?? r * 1.4;
    const colors = o.colors || (o.green ? greenSet(o.green) : SHRUB_COLORS[o.kind || 'boxwood']);
    const seg = o.seg ?? (r < 0.1 ? 12 : r < 0.2 ? 16 : undefined);
    const g = shrubGeometry({ rx: r * (o.sx ?? 1), ry: h / 2, rz: r * (o.sz ?? 1), lumps: o.lumps ?? 0.22, freq: o.freq ?? (r < 0.15 ? 5 : 2.6), seed: o.seed ?? 1, colors, seg, flatBottom: o.flatBottom ?? true });
    const m = new THREE.Mesh(g, shrubMat()); m.position.set(x, y, z); if (o.rot) m.rotation.set(o.rot[0], o.rot[1], o.rot[2]);
    m.castShadow = o.shadow ?? true; m.receiveShadow = true; p.add(m);
    return m;
  }
  /** terracotta / ceramic pot with a plant. pos = bottom centre */
  P.pot = (S, x, y, z, o = {}) => {
    const r = o.r ?? 0.16, h = o.h ?? r * 1.5, c = o.color ?? '#c7805d';
    S.k.cyl(r, r * 0.74, h, M.t(c), [x, y + h / 2, z], null, 12);
    S.k.cyl(r * 1.06, r * 1.06, h * 0.12, M.t(c), [x, y + h * 0.94, z], null, 12);
    S.k.cyl(r * 0.92, r * 0.92, 0.01, M.t('#6a5040'), [x, y + h * 0.9, z], null, 10);
    const kind = o.plant ?? 'bush';
    const g0 = y + h * 0.9;
    const rr = ctx.rng(`pot|${S.id}|${x.toFixed(2)}|${z.toFixed(2)}`);
    const greens = o.greens ?? ['#6f9a5a', '#5f8c5c', '#86ad68'];
    const seed = Math.floor(rr() * 1000);
    if (kind === 'bush') {
      shrub(S, x, g0 - r * 0.1, z, { r: r * 1.05, h: r * 1.5, green: greens[0], seed });
    } else if (kind === 'flowers') {
      shrub(S, x, g0 - r * 0.05, z, { r: r * 0.95, h: r * 0.9, green: greens[0], seed, lumps: 0.18 });
      const fc = o.flowers ?? ['#f2b5c8', '#fbe9ef', '#f1e3b0'];
      const n = o.n ?? 9;
      for (let i = 0; i < n; i++) { const a = rr() * 6.28, d = Math.sqrt(rr()) * r * 0.8; scatter.add('ball', S, [x + Math.cos(a) * d, g0 + r * (0.62 + rr() * 0.22), z + Math.sin(a) * d], [r * 0.19, r * 0.14, r * 0.19], rr.pick(fc), [rr(), rr(), rr()]); }
    } else if (kind === 'tall') {
      const th = o.th ?? 0.9;
      S.k.cyl(0.012, 0.018, th, M.t('#6a5040'), [x, g0 + th / 2, z], null, 6);
      const balls = [[0, th * 0.78, 0, 1.25], [r * 0.9, th * 0.55, r * 0.3, 0.9], [-r * 0.8, th * 0.62, -r * 0.35, 0.95], [r * 0.2, th * 0.4, -r * 0.8, 0.75]];
      balls.forEach(([bx, by, bz, s], i) => shrub(S, x + bx, g0 + by - r * s * 0.5, z + bz, { r: r * 1.1 * s, h: r * 1.5 * s, green: greens[i % greens.length], seed: seed + i, lumps: 0.26 }));
    } else if (kind === 'succulent') {
      for (let i = 0; i < 5; i++) scatter.add('ball', S, [x + (rr() - 0.5) * r, g0 + r * 0.25, z + (rr() - 0.5) * r], [r * 0.35, r * 0.3, r * 0.35], rr.pick(['#8fb49a', '#a6c49a', '#7fa38a']), [rr(), rr(), rr()]);
    } else if (kind === 'grass') {
      for (let i = 0; i < 9; i++) { const a = rr() * 6.28; scatter.add('blade', S, [x + Math.cos(a) * r * 0.3, g0, z + Math.sin(a) * r * 0.3], [0.03, r * (1.6 + rr()), 1], rr.pick(greens), [(rr() - 0.5) * 0.6, a, (rr() - 0.5) * 0.6]); }
    }
  };
  /** A-frame board (two leaning boards). regF/regB: atlas regions for the two faces. pos = ground centre. */
  P.aFrame = (S, x, y, z, rotY, regF, regB, o = {}) => {
    const w = o.w ?? 0.6, h = o.h ?? 0.92, lean = 0.2;
    const gq = S.k.group([x, y, z], rotY); const k = ctx.kit(gq);
    const wood = M.wood(o.frame ?? '#8a6446');
    const ang = Math.atan2(lean, h);
    for (const s of [1, -1]) {
      const b = new THREE.Group(); b.position.set(0, 0, s * lean); b.rotation.x = -s * ang; gq.add(b); const kb = ctx.kit(b);
      kb.box(w, 0.045, 0.03, wood, [0, h - 0.02, 0]);
      kb.box(0.045, h, 0.03, wood, [-w / 2 + 0.022, h / 2, 0]);
      kb.box(0.045, h, 0.03, wood, [w / 2 - 0.022, h / 2, 0]);
      kb.box(w, 0.045, 0.03, wood, [0, 0.1, 0]);
      kb.box(w - 0.09, h - 0.16, 0.012, M.t('#34403b'), [0, h / 2 + 0.05, 0]);
      const reg = s > 0 ? regF : regB;
      if (reg) { const c = kb.mesh(regionGeo(reg, w - 0.1, h - 0.18), reg.m, [0, h / 2 + 0.05, s * 0.008], [0, s > 0 ? 0 : Math.PI, 0]); c.castShadow = false; }
    }
    k.cyl(0.004, 0.004, lean * 1.6, mMetalDark, [0, h * 0.42, 0], [Math.PI / 2, 0, 0], 4);
    return gq;
  };
  /** folding stand sign (スタンド看板): metal frame, poster on both sides. */
  P.standSign = (S, x, y, z, rotY, reg, o = {}) => {
    const w = o.w ?? 0.5, h = o.h ?? 1.0;
    const gq = S.k.group([x, y, z], rotY); const k = ctx.kit(gq);
    const fr = M.t(o.frame ?? '#e8e6df');
    const ang = 0.12;
    for (const s of [1, -1]) {
      const b = new THREE.Group(); b.position.set(0, 0, s * 0.06); b.rotation.x = -s * ang; gq.add(b); const kb = ctx.kit(b);
      kb.box(w, h, 0.03, fr, [0, h / 2 + 0.03, 0]);
      if (reg) { const c = kb.mesh(regionGeo(reg, w - 0.06, h - 0.1), reg.m, [0, h / 2 + 0.05, s * 0.017], [0, s > 0 ? 0 : Math.PI, 0]); c.castShadow = false; }
    }
    return gq;
  };
  /** nobori flag (のぼり旗) on a pole with water-tank base. reg: atlas region (tall). */
  P.nobori = (S, x, y, z, rotY, reg, o = {}) => {
    const w = o.w ?? 0.45, h = o.h ?? 1.6, pole = h + 0.55;
    const gq = S.k.group([x, y, z], rotY); const k = ctx.kit(gq);
    k.cyl(0.14, 0.17, 0.26, M.t(o.base ?? '#cfd2d4'), [0, 0.13, 0], null, 10);
    k.cyl(0.013, 0.013, pole, M.t('#e6e6e2'), [0, 0.26 + pole / 2, 0], null, 6);
    k.cyl(0.009, 0.009, w, M.t('#e6e6e2'), [w / 2, 0.26 + pole - 0.05, 0], [0, 0, Math.PI / 2], 5);
    // gently waving cloth: subdivided plane with a baked wave
    const geo = regionGeo(reg, w, h);
    const g2 = new THREE.PlaneGeometry(w, h, 6, 1);
    const uv0 = geo.attributes.uv, uv = g2.attributes.uv, pp = g2.attributes.position;
    const u0 = Math.min(uv0.getX(0), uv0.getX(1)), u1 = Math.max(uv0.getX(0), uv0.getX(1)), v0 = Math.min(uv0.getY(0), uv0.getY(2)), v1 = Math.max(uv0.getY(0), uv0.getY(2));
    for (let i = 0; i < uv.count; i++) { uv.setXY(i, u0 + uv.getX(i) * (u1 - u0), v0 + uv.getY(i) * (v1 - v0)); const px = pp.getX(i) + w / 2; pp.setZ(i, Math.sin(px / w * Math.PI * 1.3) * 0.035 * (px / w)); }
    g2.computeVertexNormals();
    const flag = k.mesh(g2, mat.toon('#ffffff', { map: reg.m.map, side: 'double', paint: 0.02 }), [w / 2 + 0.015, 0.26 + pole - 0.08 - h / 2, 0]);
    flag.castShadow = true;
    return gq;
  };
  /** umbrella stand with a couple of umbrellas. pos = bottom centre */
  P.umbrellaStand = (S, x, y, z, rotY = 0, o = {}) => {
    const gq = S.k.group([x, y, z], rotY); const k = ctx.kit(gq);
    const m = M.t(o.color ?? '#9aa1a8');
    k.box(0.5, 0.05, 0.22, m, [0, 0.03, 0]);
    k.box(0.5, 0.03, 0.22, m, [0, 0.55, 0]);
    for (const sx of [-0.24, 0.24]) k.box(0.02, 0.55, 0.2, m, [sx, 0.3, 0]);
    const cols = o.umbrellas ?? ['#7ea6c9', '#e8e6df', '#d98f9e'];
    cols.forEach((c, i) => {
      const ux = -0.15 + i * 0.15;
      k.cyl(0.035, 0.02, 0.62, M.t(c), [ux, 0.36, 0.0], [0.08 * (i - 1), 0, 0.1 * (i - 1)], 8);
      k.cyl(0.008, 0.008, 0.25, M.t('#5a4032'), [ux + 0.03 * (i - 1), 0.78, 0.0], null, 4);
    });
    return gq;
  };
  /** round bistro table (top at y + 0.72). Returns world top centre. */
  P.bistroTable = (S, x, y, z, o = {}) => {
    const r = o.r ?? 0.34, top = o.h ?? 0.72;
    const mTop = o.topMat ?? M.t('#e8e2d6'), mLeg = o.legMat ?? M.t('#4b4d52');
    S.k.cyl(r, r, 0.03, mTop, [x, y + top - 0.015, z], null, 20);
    S.k.cyl(r + 0.008, r + 0.008, 0.012, mLeg, [x, y + top - 0.036, z], null, 20);
    S.k.cyl(0.022, 0.022, top - 0.05, mLeg, [x, y + (top - 0.05) / 2 + 0.02, z], null, 6);
    S.k.cyl(0.2, 0.24, 0.03, mLeg, [x, y + 0.015, z], null, 12);
    return S.world(x, y + top, z);
  };
  /** metal bistro chair facing rotY (+z local forward = seat front). pos = ground */
  P.bistroChair = (S, x, y, z, rotY, o = {}) => {
    const gq = S.k.group([x, y, z], rotY); const k = ctx.kit(gq);
    const m = o.mat ?? M.t('#4b4d52'), seat = o.seat ?? m;
    k.cyl(0.19, 0.19, 0.025, seat, [0, 0.45, 0], null, 14);
    for (const [lx, lz] of [[-0.13, -0.13], [0.13, -0.13], [-0.13, 0.13], [0.13, 0.13]]) k.cyl(0.011, 0.011, 0.45, m, [lx * 1.08, 0.225, lz * 1.08], [lz * 0.12, 0, -lx * 0.12], 5);
    k.cyl(0.011, 0.011, 0.44, m, [-0.15, 0.66, -0.15], [-0.1, 0, 0], 5);
    k.cyl(0.011, 0.011, 0.44, m, [0.15, 0.66, -0.15], [-0.1, 0, 0], 5);
    const arc = new THREE.TorusGeometry(0.17, 0.012, 4, 12, Math.PI);
    k.mesh(arc, m, [0, 0.8, -0.16], [-0.1, 0, 0]);
    k.mesh(arc, m, [0, 0.68, -0.155], [-0.1, 0, 0], [0.95, 0.95, 1]);
    k.cyl(0.14, 0.14, 0.008, m, [0, 0.14, 0], null, 12);
    return gq;
  };
  /** pendant lamp hanging from ceiling y=ceil down to shade bottom at yb. */
  P.pendant = (S, x, ceil, yb, z, o = {}) => {
    const shade = o.shade ?? '#3f5a4a';
    ctx.wires.add([S.world(x, ceil, z), S.world(x, yb + 0.2, z)], { width: 0.008, color: '#3a3640' });
    if (o.kind === 'globe') {
      S.k.sphere(0.13, M.glow('#ffe2b0', 1.25), [x, yb + 0.13, z], 12);
      S.k.cyl(0.03, 0.03, 0.05, M.t('#b08a4a'), [x, yb + 0.27, z], null, 8);
    } else {
      S.k.cyl(0.05, 0.19, 0.17, M.t(shade, { side: 'double' }), [x, yb + 0.1, z], null, 14);
      S.k.cyl(0.17, 0.17, 0.005, M.glow('#ffe2b0', 1.35), [x, yb + 0.015, z], null, 14);
      S.k.sphere(0.05, M.glow('#fff0d0', 1.6), [x, yb + 0.05, z], 8);
    }
  };
  /** framed window: frame + glass (+ optional mullions / backing). pos = bottom centre on wall plane. */
  P.window = (S, x, y, z, w, h, o = {}) => {
    const gq = S.k.group([x, y, z], o.rotY ?? 0); const k = ctx.kit(gq);
    const ft = o.ft ?? 0.06, fd = o.fd ?? 0.1, fm = o.frameMat ?? M.wood(o.frame ?? '#5a4032');
    k.box(w + ft * 2, ft, fd, fm, [0, h + ft / 2, 0]);
    k.box(w + ft * 2, ft, fd, fm, [0, -ft / 2, 0]);
    k.box(ft, h, fd, fm, [-w / 2 - ft / 2, h / 2, 0]);
    k.box(ft, h, fd, fm, [w / 2 + ft / 2, h / 2, 0]);
    const cols = o.cols ?? 1, rows = o.rows ?? 1, mt = o.mt ?? ft * 0.6;
    for (let i = 1; i < cols; i++) k.box(mt, h, fd * 0.8, fm, [-w / 2 + i * w / cols, h / 2, 0]);
    for (let j = 1; j < rows; j++) k.box(w, mt, fd * 0.8, fm, [0, j * h / rows, 0]);
    if (o.transom) k.box(w, mt * 1.2, fd * 0.85, fm, [0, o.transom, 0]);
    const gl = k.plane(w, h, o.glass ?? M.glass(), [0, h / 2, 0.0]); gl.castShadow = false; gl.receiveShadow = false;
    if (o.sill !== false) k.box(w + ft * 2 + 0.08, 0.045, fd + (o.sillD ?? 0.08), o.sillMat ?? fm, [0, -ft - 0.022, (o.sillD ?? 0.08) / 2]);
    if (o.back) { const b = S.card(o.back, w, h, [0, h / 2, -(o.backZ ?? 0.12)], null, null, k); b.receiveShadow = true; }
    else if (o.dim) k.plane(w, h, o.dim, [0, h / 2, -(o.backZ ?? 0.12)]);
    return gq;
  };
  /** awning (fixed canvas) on a wall whose outer face is at z=zWall; slopes toward +z. */
  P.awning = (S, o) => {
    const { x0, x1, zWall, yTop, depth, drop } = o;
    const w = x1 - x0, cx = (x0 + x1) / 2, len = Math.hypot(depth, drop), ang = Math.atan2(drop, depth);
    const sm = o.stripeMat ?? M.stripe(o.stripe[0], o.stripe[1], o.n ?? 4);
    S.ubox(w, 0.03, len, sm, [cx, yTop - drop / 2, zWall + depth / 2], [ang, 0, 0], o.period ?? 1);
    const valH = o.valH ?? 0.24, vm = o.valMat ?? M.t(o.valance ?? o.stripe[0]);
    const zf = zWall + depth, yb = yTop - drop;
    S.k.box(w + 0.02, valH, 0.02, vm, [cx, yb - valH / 2 + 0.02, zf]);
    if (o.valReg) S.card(o.valReg, Math.min(w - 0.1, o.valTextW ?? w - 0.1), valH * 0.8, [cx + (o.valTextX ?? 0), yb - valH / 2 + 0.02, zf + 0.012]);
    if (o.scallop !== false) S.k.mesh(scallopGeo(w + 0.02, o.scallopW ?? 0.18), vm, [cx, yb - valH + 0.02, zf]);
    // side cheeks
    const cheek = profileX([[0, 0], [depth, -drop], [depth, -drop - valH + 0.02], [0, -0.05]], 0.02);
    for (const sx of [x0 + 0.01, x1 - 0.01]) S.k.mesh(cheek, sm, [sx, yTop, zWall]);
    S.k.cyl(0.012, 0.012, w, M.t('#6d747c'), [cx, yb + 0.01, zf - 0.02], [0, 0, Math.PI / 2], 6);
    return { zf, yb: yb - valH };
  };

  return { F, U, T, M, A, uvBox, uvPlane, profileX, scallopGeo, regionGeo, space, pave, plinth, scatter, shrub, greenSet, P, col, hex, blot };
}
