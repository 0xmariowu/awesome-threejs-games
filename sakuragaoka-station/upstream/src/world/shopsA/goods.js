// shopsA — instanced goods. Every small repeated object inside the shops (products, bottles, cans,
// books, magazines, cups, floor tiles, flower heads, stems…) is a real little 3D shape rendered as an
// instance of ONE InstancedMesh per kind and per shop (so each shop frustum-culls on its own).
// Per instance: matrix + colour + label "variant" (a cell of the kind's canvas label sheet).
// Per vertex: aTint (1 = surface takes the instance colour, 0 = keeps the printed label colours).
// Textures are only used for what is genuinely printed: labels, spines, covers, lids.
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

// swatch band: every label cell keeps its bottom 9 % for four solid colour swatches
// (s0 side, s1 top, s2 back, s3 extra) that the non-printed faces sample.
const SW = [[0.125, 0.045], [0.375, 0.045], [0.625, 0.045], [0.875, 0.045]];
const FRONT = [0.02, 0.11, 0.98, 0.99];

// ---------------------------------------------------------------- geometry helpers
function ensure(g, tint = 1) {
  if (g.index === null) { const n = g.attributes.position.count, a = new Uint32Array(n); for (let i = 0; i < n; i++) a[i] = i; g.setIndex(new THREE.BufferAttribute(a, 1)); }
  const n = g.attributes.position.count;
  if (!g.attributes.normal) g.computeVertexNormals();
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
  if (!g.attributes.aTint) g.setAttribute('aTint', new THREE.BufferAttribute(new Float32Array(n).fill(tint), 1));
  for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'aTint'].includes(k)) g.deleteAttribute(k);
  g.clearGroups();
  return g;
}
/** unit box, origin at the bottom centre, without its bottom face (never seen: things stand on shelves) */
function boxNB(bottom = false, back = true) {
  const g = new THREE.BoxGeometry(1, 1, 1); g.translate(0, 0.5, 0);
  if (!bottom || !back) { const src = g.index.array, keep = []; for (let f = 0; f < 6; f++) if ((bottom || f !== 3) && (back || f !== 5)) for (let t = 0; t < 6; t++) keep.push(src[f * 6 + t]); g.setIndex(keep); }
  return g;
}
/** classify each vertex by its normal and assign label UVs (front/back planar projection, points elsewhere) */
function projUV(g, spec) {
  g.computeBoundingBox();
  const bb = g.boundingBox, p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv, tn = g.attributes.aTint;
  const W = bb.max.x - bb.min.x || 1, H = bb.max.y - bb.min.y || 1, D = bb.max.z - bb.min.z || 1;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), nx = n.getX(i), ny = n.getY(i), nz = n.getZ(i);
    let face;
    if (spec.half) face = nz >= 0 ? 'front' : 'back';
    else face = nz > 0.62 ? 'front' : nz < -0.62 ? 'back' : ny > 0.7 ? 'top' : ny < -0.7 ? 'bottom' : 'side';
    let s = spec[face] ?? spec.side;
    if (face === 'back' && s === 'front') s = spec.front;
    if (s.length === 4) {
      const fx = face === 'back' ? (bb.max.x - x) / W : face === 'top' || face === 'bottom' ? (x - bb.min.x) / W : (x - bb.min.x) / W;
      const fy = face === 'top' || face === 'bottom' ? (bb.max.z - z) / D : (y - bb.min.y) / H;
      uv.setXY(i, s[0] + fx * (s[2] - s[0]), s[1] + fy * (s[3] - s[1]));
    } else uv.setXY(i, s[0], s[1]);
    if (spec.tint && tn) { const t = spec.tint[face]; if (t !== undefined) tn.setX(i, t); }
  }
  return g;
}
/** lathe around Y with u = 0.5 facing +z and v given per profile point: prof = [[r, y, v], ...] */
function lathe(prof, seg, o = {}) {
  const pts = prof.map(p => new THREE.Vector2(Math.max(1e-4, p[0]), p[1]));
  const g = new THREE.LatheGeometry(pts, seg, Math.PI, Math.PI * 2);
  const uv = g.attributes.uv, np = prof.length, pos = g.attributes.position;
  for (let i = 0; i <= seg; i++) for (let j = 0; j < np; j++) {
    const k = i * np + j;
    uv.setXY(k, (o.u0 ?? 0) + (i / seg) * ((o.u1 ?? 1) - (o.u0 ?? 0)), prof[j][2] ?? j / (np - 1));
    if (o.warp) { const phi = Math.PI + (i / seg) * Math.PI * 2; const [dr, dy] = o.warp(phi, j, prof[j]); const x = pos.getX(k), z = pos.getZ(k); pos.setXYZ(k, x * (1 + dr), pos.getY(k) + dy, z * (1 + dr)); }
  }
  if (o.warp) g.computeVertexNormals();
  return g;
}
function extrudeY(shapePts, depth = 1, curve = 3) {
  const sh = new THREE.Shape(shapePts.map(p => new THREE.Vector2(p[0], p[1])));
  const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: false, curveSegments: curve });
  g.translate(0, 0, -depth / 2);
  return g;
}
function roundedTri(r = 0.16) {
  const sh = new THREE.Shape();
  const P = [[-0.5, 0], [0.5, 0], [0, 0.92]];
  const lerp2 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  for (let i = 0; i < 3; i++) {
    const a = P[(i + 2) % 3], b = P[i], c = P[(i + 1) % 3];
    const p0 = lerp2(b, a, r), p1 = lerp2(b, c, r);
    if (i === 0) sh.moveTo(p0[0], p0[1]); else sh.lineTo(p0[0], p0[1]);
    sh.quadraticCurveTo(b[0], b[1], p1[0], p1[1]);
  }
  sh.closePath();
  const g = new THREE.ExtrudeGeometry(sh, { depth: 1, bevelEnabled: false, curveSegments: 3 });
  g.translate(0, 0, -0.5);
  // flatten the bottom: shift so min y = 0
  g.computeBoundingBox(); g.translate(0, -g.boundingBox.min.y, 0);
  return g;
}
function bagGeo() {
  const g = new THREE.BoxGeometry(1, 1, 1, 1, 3, 1);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const t = Math.pow(Math.max(0, Math.cos(Math.PI * y * 0.98)), 0.55);
    const bx = 1 - 0.08 * (1 - Math.cos(Math.PI * x)) * t;
    p.setXYZ(i, x * (0.96 + 0.04 * t) * (Math.abs(x) > 0.49 ? 1 : bx), y, z * Math.max(0.1, t) * (1 - 0.25 * Math.abs(x)));
  }
  g.translate(0, 0.5, 0); g.computeVertexNormals();
  return g;
}
function cartonGeo() {
  const body = boxNB(); body.scale(1, 0.8, 1);
  const roof = new THREE.BufferGeometry();
  // gable roof (ridge along x) from y 0.8 to 0.96 + fin to 1.0
  const v = [-0.5, 0.8, 0.5, 0.5, 0.8, 0.5, 0.5, 0.96, 0, -0.5, 0.96, 0, /* front slope */ 0.5, 0.8, -0.5, -0.5, 0.8, -0.5, -0.5, 0.96, 0, 0.5, 0.96, 0 /* back slope */];
  roof.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); roof.setIndex([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7]);
  const gab = new THREE.BufferGeometry();
  gab.setAttribute('position', new THREE.Float32BufferAttribute([0.5, 0.8, 0.5, 0.5, 0.8, -0.5, 0.5, 0.96, 0, -0.5, 0.8, -0.5, -0.5, 0.8, 0.5, -0.5, 0.96, 0], 3)); gab.setIndex([0, 1, 2, 3, 4, 5]);
  const fin = new THREE.BoxGeometry(1, 0.05, 0.08); fin.translate(0, 0.975, 0);
  const parts = [body, roof, gab, fin].map(x => { const y = x.index ? x.toNonIndexed() : x; y.deleteAttribute('uv'); y.deleteAttribute('normal'); y.computeVertexNormals(); return y; });
  return mergeGeometries(parts, false);
}
function leafGeo() {
  const s = new THREE.Shape(); s.moveTo(0, 0); s.quadraticCurveTo(0.42, 0.35, 0, 1); s.quadraticCurveTo(-0.42, 0.35, 0, 0);
  const g = new THREE.ShapeGeometry(s, 3); return g;
}
function starGeo(n = 14, rIn = 0.18) {
  const s = new THREE.Shape();
  for (let i = 0; i <= n * 2; i++) { const a = i / (n * 2) * Math.PI * 2, r = i % 2 ? rIn : 0.5; const x = Math.cos(a) * r, y = Math.sin(a) * r; if (i === 0) s.moveTo(x, y); else s.lineTo(x, y); }
  const g = new THREE.ShapeGeometry(s, 1); g.rotateX(-Math.PI / 2); return g;
}
function cupHandleGeo() {
  const body = lathe([[0, 0, 0], [0.36, 0, 0], [0.4, 0.06, 0], [0.5, 0.9, 0], [0.5, 1.0, 0], [0.45, 1.0, 0], [0.4, 0.2, 0], [0, 0.18, 0]], 12);
  const h = new THREE.TorusGeometry(0.2, 0.05, 5, 8, Math.PI * 1.2); h.rotateZ(-Math.PI * 0.6); h.translate(0.52, 0.52, 0);
  [body, h].forEach(x => { x.deleteAttribute('uv'); });
  return mergeGeometries([body.toNonIndexed(), h.toNonIndexed()], false);
}

// ---------------------------------------------------------------- label sheets (painted once, lazily)
function swatches(g, w, h, cols) { const y = h * 0.91; for (let i = 0; i < 4; i++) { g.fillStyle = cols[i] || cols[0]; g.fillRect(i * w / 4, y, w / 4 + 1, h - y); } }
function rr(g, x, y, w, h, r) { r = Math.max(0, Math.min(r, w / 2, h / 2)); g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function shade(hex, k) { const c = new THREE.Color(hex); c.multiplyScalar(k); return '#' + c.getHexString(); }
function mix(a, b, t) { const c = new THREE.Color(a).lerp(new THREE.Color(b), t); return '#' + c.getHexString(); }

export function makeGoods(ctx, C) {
  const { tex } = ctx;
  const F = tex.FONTS;
  const T = (g, s, x, y, size, font, color, o = {}) => { g.textAlign = o.align || 'center'; g.textBaseline = 'middle'; g.fillStyle = color; if (o.maxW) return tex.fitText(g, s, x, y, o.maxW, size, font, o.weight ?? 900); g.font = `${o.weight ?? 900} ${size}px ${font}`; g.fillText(s, x, y); };
  const sak = (g, x, y, r, c) => { g.fillStyle = c; for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * 1.2566; g.beginPath(); g.ellipse(x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55, r * 0.5, r * 0.36, a, 0, 6.3); g.fill(); } };

  // ---- palettes
  const BOXP = [['#e36b5d', '#fbf3e6', '#f2c230', 'クッキー'], ['#8a5a44', '#f4e3c8', '#e8506a', 'ミルクチョコ'], ['#3f7fb5', '#eef4f8', '#f2c230', 'ビスケット'], ['#f2b53b', '#fff6dc', '#e36b5d', 'じゃがスティック'],
    ['#5a9e58', '#eef6e8', '#f4f1e8', '抹茶ラング'], ['#f28db2', '#fdeef3', '#8a5a44', 'いちごチョコ'], ['#8e7cc3', '#f1ecf8', '#f2c230', 'ぶどうグミ'], ['#e9a23b', '#fff1d8', '#8a4b2a', 'レトルトカレー'],
    ['#58a8d8', '#eef7fc', '#3f7fb5', 'やわらかティッシュ'], ['#e8e4d8', '#58a8d8', '#e36b5d', 'ふわマスク'], ['#7cc576', '#f4f9ee', '#3f8f5b', 'ハミガキ'], ['#d9463b', '#fbe9e4', '#f2c230', '即席ラーメン'],
    ['#f2b5c8', '#fbe9ef', '#dd7f9d', 'さくらクッキー'], ['#eb9db6', '#fdf0f4', '#8a4b5a', 'さくらもち'], ['#c9a060', '#f6ecd8', '#5a4032', 'おせんべい'], ['#4a4552', '#e9e4d8', '#f2c230', 'ドリップ珈琲']];
  const BAGP = [['#f2c230', '#e36b5d', 'ポテトチップス', 'うすしお'], ['#58a8d8', '#fbf8f0', 'ポテトチップス', 'のりしお'], ['#e36b5d', '#f2c230', 'えびせん', 'しお味'], ['#7cc576', '#fbf8f0', 'わさびチップ', '辛口'],
    ['#8e7cc3', '#f2b5c8', 'ラムネグミ', 'ぶどう'], ['#f28db2', '#fbf8f0', 'いちごマシュマロ', 'ふわふわ'], ['#e9a23b', '#5a4032', 'コーンスナック', 'チーズ'], ['#3f7fb5', '#f2c230', 'ポップコーン', 'バター醤油'],
    ['#8a5a44', '#f4e3c8', 'チョコクランチ', 'ミルク'], ['#f08a4b', '#fbf8f0', 'カラムーチョ風', 'ホット'], ['#f2b5c8', '#dd7f9d', 'さくらポテト', '春限定'], ['#d9c9a0', '#8a5a44', 'ミックスナッツ', '素焼き'],
    ['#f3e3bf', '#b86a3a', 'メロンパン', 'ふんわり'], ['#efe3c8', '#e36b5d', 'あんぱん', 'こしあん'], ['#f6ecd8', '#3f7fb5', '食パン', '6枚切'], ['#f7d3de', '#c2476a', 'いちごサンド', '春']];
  const PETP = [['#c9d98a', '#3f8f5b', '#f4f1e8', '緑茶'], ['#bcd48a', '#2f6f4b', '#f4f1e8', '濃い茶'], ['#e2d08a', '#8a6a2a', '#f4f1e8', '麦茶'], ['#dfeef5', '#3f7fb5', '#58a8d8', '天然水'],
    ['#e8f2f5', '#58a8d8', '#e8e8e8', '炭酸水'], ['#f2b56a', '#e36b5d', '#f2c230', 'オレンジ'], ['#e8d6b8', '#8a5a44', '#e36b5d', 'ミルクティー'], ['#d9e8f2', '#2f64b5', '#3f7fb5', 'スポーツ'],
    ['#f2e27a', '#d99a1f', '#e9e4d8', 'レモン'], ['#b88a5a', '#4a4552', '#3a3346', '微糖コーヒー'], ['#f7d3de', '#dd7f9d', '#fbe9ef', 'さくらソーダ'], ['#c9e0b0', '#5a9e58', '#e8e8e8', 'ジャスミン'],
    ['#f4f1ea', '#58a8d8', '#e9e4d8', 'のむヨーグルト'], ['#f0a3a0', '#d9463b', '#f4f1e8', 'トマト'], ['#dcc6e8', '#8e7cc3', '#f4f1e8', 'ぶどう'], ['#b8e0d8', '#2c9a91', '#e8e8e8', 'ミネラル']];
  const CANP = [['#e36b5d', '#fbf8f0', 'COLA風'], ['#3f7fb5', '#fbf8f0', 'ソーダ'], ['#5a4032', '#e9c98a', 'ブラック'], ['#e9e4d8', '#8a5a44', 'カフェオレ'], ['#f2c230', '#e36b5d', 'エナジー'], ['#7cc576', '#fbf8f0', 'メロン'],
    ['#f28db2', '#fbf8f0', 'ピーチ'], ['#58a8d8', '#fbf8f0', 'サイダー'], ['#c9ced3', '#3f7fb5', '炭酸水'], ['#f08a4b', '#fbf8f0', 'みかん'], ['#4a4552', '#f2c230', '微糖'], ['#e8d6b8', '#5a4032', 'ラテ'],
    ['#f7d3de', '#dd7f9d', 'さくら'], ['#d9463b', '#f2c230', 'トマト'], ['#8e7cc3', '#fbf8f0', 'グレープ'], ['#2c9a91', '#fbf8f0', 'レモン']];

  const SHEETS = {
    box: { cols: 8, rows: 2, cw: 128, ch: 160, paint(g, i, w, h) {
      const [bg, fg, acc, name] = BOXP[i % BOXP.length]; const H = h * 0.9;
      g.fillStyle = bg; g.fillRect(0, 0, w, H);
      const st = i % 4;
      if (st === 0) { g.fillStyle = fg; rr(g, w * 0.1, H * 0.38, w * 0.8, H * 0.46, 14); g.fill(); for (let k = 0; k < 5; k++) { g.fillStyle = shade(acc, 0.9); g.beginPath(); g.arc(w * 0.24 + (k % 3) * w * 0.26, H * 0.54 + Math.floor(k / 3) * H * 0.18, 13, 0, 6.3); g.fill(); } }
      else if (st === 1) { g.fillStyle = fg; g.beginPath(); g.moveTo(0, H * 0.45); g.lineTo(w, H * 0.3); g.lineTo(w, H * 0.72); g.lineTo(0, H * 0.86); g.fill(); g.fillStyle = acc; g.fillRect(0, H * 0.86, w, 8); }
      else if (st === 2) { g.fillStyle = acc; for (let k = 0; k < 12; k++) { g.save(); g.translate(w / 2, H * 0.6); g.rotate(k * 0.52); g.fillRect(-3, 0, 6, w); g.restore(); } g.fillStyle = fg; g.beginPath(); g.arc(w / 2, H * 0.6, 36, 0, 6.3); g.fill(); g.fillStyle = bg; g.beginPath(); g.arc(w / 2, H * 0.6, 20, 0, 6.3); g.fill(); }
      else { g.fillStyle = fg; for (let k = 0; k < 5; k++) g.fillRect(0, H * 0.34 + k * 16, w, 7); g.fillStyle = shade(bg, 0.8); g.beginPath(); g.ellipse(w / 2, H * 0.62, 30, 12, 0, 0, 6.3); g.fill(); }
      if (name.startsWith('さくら')) for (let k = 0; k < 5; k++) sak(g, 14 + k * 26, H * 0.93 - 22, 9, '#fbe9ef');
      g.fillStyle = st === 1 ? acc : fg; g.fillRect(0, 0, w, H * 0.3);
      T(g, name, w / 2, H * 0.15, 22, F.round, st === 1 ? '#fbf8f0' : bg, { maxW: w - 10 });
      swatches(g, w, h, [shade(bg, 0.95), mix(bg, fg, 0.3), shade(bg, 0.9), acc]);
    } },
    bag: { cols: 8, rows: 2, cw: 128, ch: 160, paint(g, i, w, h) {
      const [bg, fg, name, sub] = BAGP[i % BAGP.length]; const H = h * 0.9, bread = i >= 12;
      g.fillStyle = bg; g.fillRect(0, 0, w, H);
      g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(0, 0, w, 10); g.fillRect(0, H - 10, w, 10);
      if (bread) { g.fillStyle = 'rgba(255,255,255,0.6)'; rr(g, w * 0.15, H * 0.36, w * 0.7, H * 0.44, 20); g.fill(); g.fillStyle = mix('#d9a05a', bg, 0.2); g.beginPath(); g.ellipse(w / 2, H * 0.6, w * 0.3, H * 0.16, 0, 0, 6.3); g.fill(); g.fillStyle = 'rgba(255,240,210,0.7)'; g.beginPath(); g.ellipse(w / 2 - 8, H * 0.55, w * 0.14, H * 0.06, 0, 0, 6.3); g.fill(); }
      else { g.fillStyle = fg; g.beginPath(); g.ellipse(w / 2, H * 0.62, w * 0.4, H * 0.24, 0, 0, 6.3); g.fill(); for (let k = 0; k < 7; k++) { g.fillStyle = mix('#f2d38a', bg, 0.15); g.beginPath(); g.ellipse(w * 0.28 + (k % 4) * 20, H * 0.56 + Math.floor(k / 4) * 24, 13, 9, k, 0, 6.3); g.fill(); } }
      T(g, name, w / 2, H * 0.2, 22, F.round, bread ? fg : '#fbf8f0', { maxW: w - 12 });
      g.fillStyle = bread ? fg : shade(bg, 0.7); rr(g, w * 0.22, H * 0.3, w * 0.56, 22, 11); g.fill();
      T(g, sub, w / 2, H * 0.3 + 11, 15, F.round, '#fbf8f0', { maxW: w * 0.5 });
      if (name.startsWith('さくら')) for (let k = 0; k < 4; k++) sak(g, 18 + k * 30, H * 0.9 - 12, 8, '#fbe9ef');
      swatches(g, w, h, [shade(bg, 0.92), shade(bg, 1.04), bg, fg]);
    } },
    pet: { cols: 16, rows: 1, cw: 64, ch: 256, paint(g, i, w, h) {
      const [liq, band, cap, name] = PETP[i % PETP.length];
      const Y = (v) => h * (1 - v);
      const gr = g.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, shade(liq, 0.92)); gr.addColorStop(0.5, liq); gr.addColorStop(1, shade(liq, 0.92)); g.fillStyle = gr; g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(w * 0.36, Y(0.8), 4, Y(0.06) - Y(0.8));
      // label band (v 0.18..0.5)
      g.fillStyle = band; g.fillRect(0, Y(0.5), w, Y(0.18) - Y(0.5));
      g.fillStyle = '#fbf8f0'; g.fillRect(w * 0.2, Y(0.46), w * 0.6, Y(0.23) - Y(0.46));
      g.save(); g.translate(w / 2, (Y(0.46) + Y(0.23)) / 2); g.rotate(-Math.PI / 2); T(g, name, 0, 0, 13, F.round, band, { maxW: Y(0.23) - Y(0.46) - 6 }); g.restore();
      if (name === 'さくらソーダ') sak(g, w / 2, Y(0.48), 7, '#fbe9ef');
      g.fillStyle = shade(band, 0.8); g.fillRect(0, Y(0.5), w, 3); g.fillRect(0, Y(0.18) - 3, w, 3);
      // cap (v 0.8..1)
      g.fillStyle = 'rgba(255,255,255,0.28)'; g.fillRect(0, Y(0.8), w, Y(0.62) - Y(0.8));
      g.fillStyle = cap; g.fillRect(0, 0, w, Y(0.815)); g.fillStyle = 'rgba(0,0,0,0.14)'; for (let x = 2; x < w; x += 6) g.fillRect(x, Y(0.95), 2, Y(0.84) - Y(0.95)); g.fillStyle = shade(cap, 0.8); g.fillRect(0, Y(0.83), w, 3);
    } },
    can: { cols: 16, rows: 1, cw: 64, ch: 128, paint(g, i, w, h) {
      const [bg, fg, name] = CANP[i % CANP.length]; const Y = (v) => h * (1 - v);
      g.fillStyle = bg; g.fillRect(0, 0, w, h);
      g.fillStyle = fg; g.fillRect(0, Y(0.62), w, Y(0.38) - Y(0.62));
      g.save(); g.translate(w / 2, (Y(0.62) + Y(0.38)) / 2); g.rotate(-Math.PI / 2); T(g, name, 0, 0, 14, F.en, bg, { maxW: Y(0.38) - Y(0.62) - 4 }); g.restore();
      g.fillStyle = 'rgba(255,255,255,0.3)'; g.fillRect(w * 0.42, Y(0.9), 3, Y(0.1) - Y(0.9));
      if (name === 'さくら') for (let k = 0; k < 3; k++) sak(g, 12 + k * 20, Y(0.75), 7, '#fbe9ef');
      g.fillStyle = '#c9ced3'; g.fillRect(0, 0, w, Y(0.9)); g.fillRect(0, Y(0.06), w, h - Y(0.06));
      g.fillStyle = '#9aa1a8'; g.fillRect(0, Y(0.99), w, 2);
    } },
    cupmen: { cols: 8, rows: 1, cw: 128, ch: 128, paint(g, i, w, h) {
      const P = [['#e36b5d', '#fbf8f0', 'しょうゆ'], ['#f2c230', '#e36b5d', 'カレー'], ['#3f7fb5', '#fbf8f0', 'シーフード'], ['#fbf8f0', '#d9463b', 'きつね'], ['#5a9e58', '#fbf8f0', 'たぬき'], ['#8a5a44', '#f2c230', 'やきそば'], ['#f08a4b', '#fbf8f0', 'みそ'], ['#f2b5c8', '#c2476a', 'さくらえび']][i % 8];
      const Y = (v) => h * (1 - v);
      g.fillStyle = P[0]; g.fillRect(0, 0, w, h);
      g.fillStyle = P[1]; g.fillRect(0, Y(0.62), w, Y(0.36) - Y(0.62));
      T(g, P[2], w / 2, (Y(0.62) + Y(0.36)) / 2, 22, F.round, P[0], { maxW: w * 0.9 });
      g.fillStyle = shade(P[0], 0.85); g.fillRect(0, Y(0.84), w, 5); g.fillRect(0, Y(0.12), w, 5);
      for (let k = 0; k < 3; k++) { g.fillStyle = '#f2d38a'; g.beginPath(); g.arc(24 + k * 40, Y(0.72), 8, 0, 6.3); g.fill(); }
      // lid (v > 0.86): white/silver with coloured ring
      g.fillStyle = '#f1efe9'; g.fillRect(0, 0, w, Y(0.86)); g.fillStyle = P[0]; g.fillRect(0, Y(0.95), w, 5);
      g.fillStyle = '#e8e4d8'; g.fillRect(0, Y(0.04), w, h - Y(0.04));
    } },
    carton: { cols: 8, rows: 1, cw: 96, ch: 160, paint(g, i, w, h) {
      const P = [['#f4f1ea', '#3f7fb5', '牛乳'], ['#fbe9ef', '#dd7f9d', 'いちごミルク'], ['#e8d6b8', '#8a5a44', 'コーヒー牛乳'], ['#f6e3a0', '#d99a1f', 'バナナ'], ['#f2c28a', '#e36b5d', 'オレンジ'], ['#dff0d8', '#3f8f5b', '野菜ジュース'], ['#eef4f8', '#58a8d8', 'のむヨーグルト'], ['#f7d3de', '#c2476a', 'さくらラテ']][i % 8];
      const H = h * 0.9; g.fillStyle = P[0]; g.fillRect(0, 0, w, H);
      g.fillStyle = P[1]; g.fillRect(0, H * 0.18, w, 10); g.beginPath(); g.moveTo(0, H); g.bezierCurveTo(w * 0.3, H * 0.6, w * 0.7, H * 0.95, w, H * 0.62); g.lineTo(w, H); g.fill();
      T(g, P[2], w / 2, H * 0.42, 20, F.round, P[1], { maxW: w - 8 });
      g.fillStyle = mix(P[1], '#ffffff', 0.4); g.beginPath(); g.arc(w / 2, H * 0.64, 14, 0, 6.3); g.fill();
      if (i === 7) sak(g, w / 2, H * 0.64, 10, '#fbe9ef');
      swatches(g, w, h, [P[0], P[0], P[0], P[1]]);
    } },
    bento: { cols: 8, rows: 1, cw: 160, ch: 160, paint(g, i, w, h) {
      const names = ['幕の内弁当', 'のり弁当', '唐揚げ弁当', '春の彩り弁当', 'ハンバーグ弁当', '焼鮭弁当', 'ナポリタン', '親子丼'];
      const top = h * 0.58, Y0 = 0; // top view occupies canvas y 0..h*0.58 (v 0.42..1)
      g.fillStyle = '#3a3346'; g.fillRect(0, Y0, w, top);
      g.fillStyle = '#f7f4ec'; rr(g, 8, 8, w * 0.46, top - 16, 6); g.fill();
      if (i === 1) { g.fillStyle = '#3d4a44'; rr(g, 12, 12, w * 0.42, top - 24, 4); g.fill(); }
      if (i === 3) for (let k = 0; k < 3; k++) sak(g, 24 + k * 22, top * 0.5, 7, '#f2b5c8');
      const food = [['#b86a3a', '#f2c230', '#6fa55a'], ['#e9a23b', '#6fa55a', '#f7f4ec'], ['#b86a3a', '#b86a3a', '#6fa55a'], ['#f2b5c8', '#f2c230', '#7cc576'], ['#6b3f28', '#f2c230', '#6fa55a'], ['#f08a6a', '#f7f4ec', '#6fa55a'], ['#e36b5d', '#f2c230', '#6fa55a'], ['#f2c230', '#e9a23b', '#6fa55a']][i];
      g.fillStyle = food[0]; rr(g, w * 0.54, 8, w * 0.4, top * 0.46, 8); g.fill();
      g.fillStyle = food[1]; rr(g, w * 0.54, top * 0.56, w * 0.19, top * 0.36, 5); g.fill();
      g.fillStyle = food[2]; rr(g, w * 0.75, top * 0.56, w * 0.19, top * 0.36, 5); g.fill();
      if (i === 6 || i === 7) { g.fillStyle = food[0]; rr(g, 8, 8, w - 16, top - 16, 10); g.fill(); g.fillStyle = food[1]; g.beginPath(); g.ellipse(w / 2, top / 2, 30, 18, 0, 0, 6.3); g.fill(); }
      g.fillStyle = 'rgba(255,255,255,0.22)'; g.fillRect(0, 0, w, 10); g.fillRect(0, 0, 10, top);
      // front label (canvas y h*0.62..h*0.89)
      g.fillStyle = '#fbf8f0'; g.fillRect(0, h * 0.62, w, h * 0.27);
      g.fillStyle = ['#e36b5d', '#3f8f5b', '#e9a23b', '#dd7f9d', '#8a5a44', '#3f7fb5', '#e36b5d', '#e9a23b'][i]; g.fillRect(0, h * 0.62, 12, h * 0.27);
      T(g, names[i], w / 2 + 6, h * 0.72, 18, F.round, '#3a3346', { maxW: w - 24 });
      T(g, '¥' + [498, 398, 530, 598, 550, 580, 460, 520][i], w / 2 + 6, h * 0.83, 15, F.en, '#d9463b');
      swatches(g, w, h, ['#3a3346', '#f4f1ea', '#3a3346', '#d9463b']);
    } },
    onigiri: { cols: 8, rows: 1, cw: 96, ch: 112, paint(g, i, w, h) {
      const P = [['#e36b5d', '梅'], ['#f08a6a', '鮭'], ['#f2c230', 'ツナマヨ'], ['#5a9e58', '高菜'], ['#8a5a44', 'おかか'], ['#dd7f9d', '明太子'], ['#3f7fb5', '昆布'], ['#f2b5c8', '桜えび']][i % 8];
      const H = h * 0.9; g.fillStyle = '#f7f4ec'; g.fillRect(0, 0, w, H);
      g.fillStyle = '#3d4a44'; g.beginPath(); g.moveTo(w * 0.34, H); g.lineTo(w * 0.4, H * 0.5); g.lineTo(w * 0.6, H * 0.5); g.lineTo(w * 0.66, H); g.fill();
      g.fillStyle = P[0]; g.fillRect(0, H * 0.4, w, H * 0.14);
      T(g, P[1], w / 2, H * 0.47, 14, F.round, '#fbf8f0', { maxW: w * 0.5 });
      g.fillStyle = 'rgba(255,255,255,0.4)'; g.fillRect(w * 0.2, H * 0.1, 5, H * 0.3);
      swatches(g, w, h, ['#eceae4', '#f7f4ec', '#eceae4', P[0]]);
    } },
    sando: { cols: 4, rows: 1, cw: 96, ch: 96, paint(g, i, w, h) {
      const fill = [['#f2d060', '#f7f0d0'], ['#f0a3a0', '#8fc86a'], ['#e9a23b', '#f7f0d0'], ['#f7d3de', '#f7f4ec']][i % 4]; const H = h * 0.9;
      g.fillStyle = '#e8c48a'; g.fillRect(0, 0, w, H);
      g.fillStyle = '#f7f0e0'; g.fillRect(4, 4, w - 8, H - 8);
      g.fillStyle = fill[0]; g.fillRect(4, H * 0.38, w - 8, H * 0.22);
      g.fillStyle = fill[1]; g.fillRect(4, H * 0.46, w - 8, H * 0.06);
      swatches(g, w, h, ['#e8c48a', '#e8c48a', '#e8c48a', fill[0]]);
    } },
    mag: { cols: 8, rows: 4, cw: 128, ch: 176, paint(g, i, w, h) {
      const titles = [['週刊少年ソラ', '#e8506a'], ['月刊ねこびより', '#f2b53b'], ['まちあるき', '#58a8d8'], ['鉄道のたび', '#3f7fb5'], ['週刊はるかぜ', '#7cc576'], ['CAFE TIME', '#b48a62'], ['コミックさくら', '#f28db2'], ['ゲーム通信', '#8e7cc3'],
        ['おうちごはん', '#e9a23b'], ['週刊まちかど', '#e36b5d'], ['Spring Style', '#dd7f9d'], ['釣りの友', '#2c9a91'], ['テレビ桜', '#5a9e58'], ['ガーデン', '#6f8455'], ['カメラ散歩', '#4a4f58'], ['ヤング桜', '#dd7f9d'],
        ['旅と温泉', '#c2476a'], ['クルマの本', '#3a3346'], ['月刊ピアノ', '#8a5a44'], ['将棋世界風', '#6d5a50'], ['こども図鑑', '#f08a4b'], ['手芸と暮らし', '#e9a0b0'], ['週刊ベースボール', '#2f64b5'], ['星空ガイド', '#3f4a6a'],
        ['パズル王', '#f2c230'], ['レシピ100', '#e36b5d'], ['ねこ日和', '#c9a060'], ['放課後通信', '#8e7cc3'], ['山と川', '#3f8f5b'], ['月刊アニメ', '#e8506a'], ['家電ナビ', '#58a8d8'], ['春の京都', '#dd7f9d']];
      const [t, c] = titles[i % titles.length]; const H = h * 0.9; const r = ctx.rng('mag' + i);
      g.fillStyle = mix(c, '#fbf8f0', 0.72); g.fillRect(0, 0, w, H);
      const st = i % 4;
      if (st === 0) { // character bust
        g.fillStyle = r.pick(['#4a4f7a', '#6b3f28', '#3a3346', '#c9a060']); g.beginPath(); g.arc(w / 2, H * 0.52, 34, Math.PI, 0); g.fill(); g.fillRect(w / 2 - 34, H * 0.52, 68, 40);
        g.fillStyle = '#f7dcc8'; g.beginPath(); g.arc(w / 2, H * 0.56, 24, 0, 6.3); g.fill();
        g.fillStyle = '#2f64b5'; g.fillRect(w / 2 - 12, H * 0.56, 6, 7); g.fillRect(w / 2 + 6, H * 0.56, 6, 7);
        g.fillStyle = c; g.beginPath(); g.moveTo(w / 2 - 44, H); g.lineTo(w / 2, H * 0.72); g.lineTo(w / 2 + 44, H); g.fill();
      } else if (st === 1) { g.fillStyle = r.pick(['#bcd6ea', '#f7d3de', '#cfe0c8']); g.fillRect(8, H * 0.3, w - 16, H * 0.5); g.fillStyle = c; g.beginPath(); g.moveTo(8, H * 0.8); g.lineTo(w * 0.4, H * 0.5); g.lineTo(w * 0.6, H * 0.64); g.lineTo(w - 8, H * 0.44); g.lineTo(w - 8, H * 0.8); g.fill(); sak(g, w * 0.7, H * 0.38, 10, '#f2b5c8'); }
      else if (st === 2) { g.fillStyle = '#fbf8f0'; g.beginPath(); g.arc(w / 2, H * 0.58, 36, 0, 6.3); g.fill(); g.fillStyle = c; g.beginPath(); g.arc(w / 2, H * 0.58, 26, 0, 6.3); g.fill(); g.fillStyle = '#f2d38a'; g.beginPath(); g.arc(w / 2 - 6, H * 0.55, 10, 0, 6.3); g.fill(); }
      else { g.fillStyle = '#e9a23b'; g.beginPath(); g.ellipse(w / 2, H * 0.62, 32, 24, 0, 0, 6.3); g.fill(); g.beginPath(); g.moveTo(w / 2 - 26, H * 0.56); g.lineTo(w / 2 - 18, H * 0.4); g.lineTo(w / 2 - 8, H * 0.52); g.fill(); g.beginPath(); g.moveTo(w / 2 + 26, H * 0.56); g.lineTo(w / 2 + 18, H * 0.4); g.lineTo(w / 2 + 8, H * 0.52); g.fill(); g.fillStyle = '#3a3346'; g.fillRect(w / 2 - 12, H * 0.6, 5, 5); g.fillRect(w / 2 + 7, H * 0.6, 5, 5); }
      g.fillStyle = c; g.fillRect(0, 0, w, H * 0.2);
      T(g, t, w / 2, H * 0.1, 22, F.sans, '#fbf8f0', { maxW: w - 8 });
      g.fillStyle = '#fbf8f0'; rr(g, 6, H * 0.23, 50, 16, 8); g.fill(); T(g, (i % 2 ? '春' : '最新') + '号', 31, H * 0.23 + 8, 11, F.sans, c);
      g.fillStyle = '#3a3346'; g.fillRect(8, H * 0.86, w * 0.4, 4); g.fillRect(8, H * 0.92, w * 0.28, 4);
      T(g, '¥' + (380 + (i % 5) * 110), w - 22, H * 0.9, 13, F.en, '#3a3346');
      swatches(g, w, h, ['#f1efe9', '#f1efe9', mix(c, '#fbf8f0', 0.5), c]);
    } },
    // book spines: row 0 = tintable (grey/white designs × instance colour), row 1 = full colour (instance colour ~white)
    spine: { cols: 16, rows: 2, cw: 64, ch: 512, paint(g, i, w, h) {
      const H = h * 0.9, r = ctx.rng('spine' + i);
      const titles = ['さくら坂の約束', '風の手紙', '夜行列車', '猫と暮らす', '春の庭', '星を数えて', '海辺の町', '青い傘', 'ひだまり日記', '旅する本屋', '雨上がり', '花冷え', '空色ノート', '遠い灯', '鉄道の歴史', '和菓子の本',
        '放課後さくら通信', 'ソラの冒険', '魔法学園', '探偵ミナト', '宇宙の果て', 'ねこ侍', '料理の達人', '青春ブルー', '竜の騎士', '恋する電車', 'ひみつ基地', '異世界食堂', 'バスケの王', '刀と桜', 'ロボ研', '山の家'];
      const vt = (s, x, y0, size, color, font = F.serif) => { g.fillStyle = color; g.font = `700 ${size}px ${font}`; g.textAlign = 'center'; g.textBaseline = 'top'; let y = y0; for (const ch of s) { if (y > H * 0.8) break; g.fillText(ch, x, y); y += size * 1.04; } };
      if (i < 16) {
        g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, H);
        const st = i % 4, dark = 'rgba(40,30,50,0.62)', mid = 'rgba(40,30,50,0.2)';
        if (st === 0) { g.fillStyle = mid; g.fillRect(0, H * 0.06, w, 10); g.fillRect(0, H * 0.84, w, 10); }
        else if (st === 1) { g.fillStyle = mid; g.fillRect(0, 0, w, H * 0.18); g.fillStyle = '#e8d8a8'; g.fillRect(0, H * 0.18, w, 6); }
        else if (st === 2) { g.fillStyle = '#f4ecd8'; rr(g, 8, H * 0.1, w - 16, H * 0.55, 6); g.fill(); g.strokeStyle = dark; g.lineWidth = 2; rr(g, 8, H * 0.1, w - 16, H * 0.55, 6); g.stroke(); }
        else { g.fillStyle = mid; for (let k = 0; k < 3; k++) g.fillRect(0, H * (0.72 + k * 0.05), w, 5); }
        vt(titles[i], w / 2, H * 0.14, 26, st === 2 ? '#3a3346' : dark);
        g.fillStyle = dark; g.font = `700 14px ${F.sans}`; g.textAlign = 'center'; g.fillText(['文庫', '新書', '単行本', '選書'][st], w / 2, H * 0.92 - 30);
        g.fillStyle = mid; g.beginPath(); g.arc(w / 2, H * 0.94 - 8, 8, 0, 6.3); g.fill();
        swatches(g, w, h, ['#ffffff', '#f1e8d2', '#ffffff', '#ffffff']);
      } else {
        const c = r.pick(['#e8506a', '#3f7fb5', '#f2c230', '#5a9e58', '#8e7cc3', '#f08a4b', '#2c9a91', '#dd7f9d']);
        const manga = i < 28;
        g.fillStyle = manga ? mix(c, '#f6f3ec', 0.62) : c; g.fillRect(0, 0, w, H);
        if (manga) { g.fillStyle = c; g.fillRect(0, 0, w, H * 0.16); g.fillStyle = '#3a3346'; g.fillRect(0, H * 0.16, w, 4); g.fillStyle = c; g.beginPath(); g.arc(w / 2, H * 0.08, 16, 0, 6.3); g.fill(); g.fillStyle = '#f6f3ec'; g.beginPath(); g.arc(w / 2, H * 0.08, 11, 0, 6.3); g.fill(); }
        vt(titles[i], w / 2, H * 0.2, 24, manga ? '#3a3346' : '#fbf8f0', F.sans);
        g.fillStyle = manga ? c : '#fbf8f0'; rr(g, 10, H * 0.84, w - 20, 34, 6); g.fill();
        g.fillStyle = manga ? '#fbf8f0' : c; g.font = `900 24px ${F.en}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(1 + (i % 9)), w / 2, H * 0.84 + 17);
        swatches(g, w, h, [manga ? mix(c, '#ffffff', 0.35) : c, '#f1e8d2', manga ? c : c, '#ffffff']);
      }
    } },
    cover: { cols: 8, rows: 4, cw: 128, ch: 176, paint(g, i, w, h) {
      const H = h * 0.9, r = ctx.rng('cover' + i);
      const bg = r.pick(['#bcd6ea', '#f7d3de', '#f1e3cf', '#cfe0c8', '#f6e3a0', '#c9b8e8', '#e9e2d0', '#3f4a6a', '#8c3a45', '#3f5f4f']);
      const dark = ['#3f4a6a', '#8c3a45', '#3f5f4f'].includes(bg);
      g.fillStyle = bg; g.fillRect(0, 0, w, H);
      const st = i % 4;
      if (st === 0) { for (let k = 0; k < 9; k++) sak(g, r() * w, 30 + r() * (H - 60), 7 + r() * 8, dark ? 'rgba(247,211,222,0.8)' : 'rgba(221,127,157,0.7)'); }
      else if (st === 1) { g.fillStyle = dark ? '#e7c98a' : '#6d6478'; g.beginPath(); g.moveTo(0, H * 0.75); g.lineTo(w * 0.35, H * 0.45); g.lineTo(w * 0.6, H * 0.62); g.lineTo(w, H * 0.38); g.lineTo(w, H * 0.75); g.fill(); g.fillStyle = '#f6e3a0'; g.beginPath(); g.arc(w * 0.72, H * 0.24, 12, 0, 6.3); g.fill(); }
      else if (st === 2) { g.fillStyle = '#4a4f7a'; g.beginPath(); g.arc(w / 2, H * 0.5, 30, Math.PI, 0); g.fill(); g.fillRect(w / 2 - 30, H * 0.5, 60, 36); g.fillStyle = '#f7dcc8'; g.beginPath(); g.arc(w / 2, H * 0.54, 21, 0, 6.3); g.fill(); g.fillStyle = r.pick(['#e8506a', '#3f7fb5', '#f2c230']); g.beginPath(); g.moveTo(w / 2 - 40, H); g.lineTo(w / 2, H * 0.68); g.lineTo(w / 2 + 40, H); g.fill(); }
      else { g.strokeStyle = dark ? '#e7c98a' : '#8a6446'; g.lineWidth = 3; g.strokeRect(10, 10, w - 20, H - 20); g.fillStyle = dark ? '#e7c98a' : '#8a6446'; g.beginPath(); g.arc(w / 2, H * 0.55, 16, 0, 6.3); g.fill(); }
      const tt = ['さくら坂の約束', '夜行列車', '猫と暮らす', '放課後さくら通信', '旅する本屋', '星を数えて', 'ひだまり日記', '春の庭', '海辺の町', '青い傘', 'ソラの冒険', '和菓子の本', '空色ノート', 'ねこ侍', '雨上がり', '花冷え'][i % 16];
      g.fillStyle = dark ? 'rgba(250,245,235,0.92)' : 'rgba(255,255,255,0.8)'; g.fillRect(0, H * 0.06, w, 36);
      T(g, tt, w / 2, H * 0.06 + 18, 18, st === 2 ? F.round : F.serif, dark ? bg : '#3a3346', { maxW: w - 10, weight: 700 });
      if (i % 3 === 0) { g.fillStyle = '#d9463b'; g.fillRect(0, H * 0.82, w, H * 0.18); T(g, i % 2 ? '本屋大賞ノミネート' : '重版出来!', w / 2, H * 0.91, 14, F.sans, '#fbf8f0', { maxW: w - 8 }); }
      swatches(g, w, h, [shade(bg, 0.9), '#f1e8d2', shade(bg, 0.85), bg]);
    } },
    album: { cols: 8, rows: 2, cw: 128, ch: 144, paint(g, i, w, h) {
      const r = ctx.rng('album' + i), H = h * 0.9;
      const bg = r.pick(['#e9a23b', '#3f7fb5', '#8c3a45', '#f2e3c8', '#5a9e58', '#3a3346', '#dd7f9d', '#58a8d8']);
      g.fillStyle = bg; g.fillRect(0, 0, w, H);
      g.fillStyle = r.pick(['#fbf8f0', '#f2c230', '#e8506a', '#bfe3f4']);
      if (i % 3 === 0) { g.beginPath(); g.arc(w / 2, H / 2, 38, 0, 6.3); g.fill(); } else if (i % 3 === 1) { for (let k = 0; k < 5; k++) g.fillRect(0, 12 + k * 22, w, 9); } else { g.beginPath(); g.moveTo(10, H - 10); g.lineTo(w / 2, 14); g.lineTo(w - 10, H - 10); g.fill(); }
      T(g, ['JAZZ', 'Bossa', 'City Pop', 'Classic', 'Folk', 'Piano', 'Swing', 'Soul'][i % 8], w / 2, H - 16, 16, F.serif, bg === '#f2e3c8' ? '#5a4032' : '#fbf8f0', { weight: 700 });
      swatches(g, w, h, [shade(bg, 0.9), shade(bg, 0.9), shade(bg, 0.85), bg]);
    } },
    bmark: { cols: 8, rows: 1, cw: 48, ch: 160, paint(g, i, w, h) {
      const bg = ['#f7d3de', '#bcd6ea', '#cfe0c8', '#f6e3a0', '#e9e2d0', '#c9b8e8', '#3f5f4f', '#8c3a45'][i]; const H = h * 0.9, dark = i >= 6;
      g.fillStyle = bg; g.fillRect(0, 0, w, H);
      if (i % 2) for (let k = 0; k < 4; k++) sak(g, w / 2 + (k % 2 ? 8 : -8), 30 + k * 26, 8, dark ? '#f7d3de' : '#dd7f9d'); else { g.fillStyle = dark ? '#e7c98a' : '#6f9a5a'; for (let k = 0; k < 5; k++) { g.beginPath(); g.ellipse(w / 2, 26 + k * 20, 9, 5, k, 0, 6.3); g.fill(); } }
      g.fillStyle = '#fbf8f0'; g.beginPath(); g.arc(w / 2, 10, 4, 0, 6.3); g.fill();
      g.save(); g.translate(w / 2, H - 30); g.rotate(-Math.PI / 2); T(g, 'こもれび書店', 0, 0, 11, F.serif, dark ? '#fbf8f0' : '#3f5f4f', { weight: 700 }); g.restore();
      swatches(g, w, h, [bg, bg, bg, bg]);
    } },
    blister: { cols: 8, rows: 2, cw: 96, ch: 144, paint(g, i, w, h) {
      const P = [['#3a3346', '#f2c230', '単3電池'], ['#e36b5d', '#fbf8f0', 'ボールペン'], ['#3f7fb5', '#fbf8f0', 'USBケーブル'], ['#5a9e58', '#fbf8f0', 'ばんそうこう'], ['#f28db2', '#fbf8f0', 'ヘアゴム'], ['#f2c230', '#3a3346', '単4電池'], ['#8e7cc3', '#fbf8f0', 'イヤホン'], ['#58a8d8', '#fbf8f0', '歯ブラシ']][i % 8];
      const H = h * 0.9; g.fillStyle = P[0]; g.fillRect(0, 0, w, H);
      g.fillStyle = '#fbf8f0'; g.beginPath(); g.arc(w / 2, 12, 6, 0, 6.3); g.fill();
      T(g, P[2], w / 2, 34, 15, F.sans, P[1], { maxW: w - 8 });
      g.fillStyle = 'rgba(255,255,255,0.55)'; rr(g, 14, 50, w - 28, H - 66, 10); g.fill();
      g.fillStyle = P[1]; for (let k = 0; k < 4; k++) rr(g, 22 + (k % 2) * 28, 60 + Math.floor(k / 2) * 30, 22, 24, 5), g.fill();
      swatches(g, w, h, [P[0], P[0], '#f1efe9', P[1]]);
    } },
  };
  const sheetTex = {};
  function sheet(name) {
    if (sheetTex[name]) return sheetTex[name];
    const s = SHEETS[name];
    const t = tex.draw(s.cols * s.cw, s.rows * s.ch, (g) => {
      for (let i = 0; i < s.cols * s.rows; i++) {
        const cx = i % s.cols, cy = Math.floor(i / s.cols);
        g.save(); g.translate(cx * s.cw, cy * s.ch); g.beginPath(); g.rect(0, 0, s.cw, s.ch); g.clip();
        g.textAlign = 'left'; g.textBaseline = 'alphabetic'; g.globalAlpha = 1;
        s.paint(g, i, s.cw, s.ch); g.restore();
      }
    }, { key: 'shopsA.sheet.' + name, anisotropy: 8 });
    return (sheetTex[name] = { t, cols: s.cols, rows: s.rows, n: s.cols * s.rows });
  }

  // ---------------------------------------------------------------- kinds
  const spot = (k) => SW[k];
  const KINDS = {
    tile: { geo: () => { const g = new THREE.PlaneGeometry(1, 1); g.rotateX(-Math.PI / 2); return g; }, outline: false },
    slab: { geo: () => boxNB(true) },
    pbox: { sheet: 'box', geo: () => projUV(ensure(boxNB()), { front: FRONT, back: FRONT, top: spot(1), side: spot(0) }) },
    bag: { sheet: 'bag', geo: () => projUV(ensure(bagGeo()), { half: true, front: FRONT, back: FRONT }) },
    pet: { sheet: 'pet', geo: () => lathe([[0.48, 0, 0.04], [0.5, 0.05, 0.06], [0.5, 0.6, 0.58], [0.4, 0.7, 0.68], [0.2, 0.8, 0.78], [0.235, 0.815, 0.83], [0.235, 0.975, 0.96], [0, 1, 1]], 7) },
    can: { sheet: 'can', geo: () => lathe([[0.46, 0, 0.04], [0.5, 0.05, 0.07], [0.5, 0.92, 0.92], [0.42, 0.99, 0.96], [0, 0.99, 1]], 8) },
    // cheaper silhouettes for the rows behind the front facing (same label sheet)
    petLo: { sheet: 'pet', geo: () => lathe([[0.5, 0.02, 0.05], [0.5, 0.6, 0.58], [0.22, 0.84, 0.82], [0, 0.99, 1]], 6) },
    canLo: { sheet: 'can', geo: () => lathe([[0.5, 0.02, 0.05], [0.5, 0.95, 0.93], [0, 0.99, 1]], 6) },
    cupLo: { sheet: 'cupmen', geo: () => lathe([[0.37, 0.02, 0.06], [0.52, 0.9, 0.86], [0, 0.95, 1]], 6) },
    cupmen: { sheet: 'cupmen', geo: () => lathe([[0.37, 0.01, 0.06], [0.5, 0.88, 0.84], [0.53, 0.9, 0.87], [0.53, 0.95, 0.9], [0, 0.96, 1]], 8) },
    carton: { sheet: 'carton', geo: () => projUV(ensure(cartonGeo()), { front: FRONT, back: FRONT, top: spot(1), side: spot(0) }) },
    bento: { sheet: 'bento', geo: () => projUV(ensure(boxNB()), { top: [0.02, 0.43, 0.98, 0.99], front: [0.02, 0.12, 0.98, 0.38], back: [0.02, 0.12, 0.98, 0.38], side: spot(0) }) },
    onigiri: { sheet: 'onigiri', geo: () => projUV(ensure(roundedTri()), { front: FRONT, back: FRONT, side: spot(0), top: spot(0) }) },
    sando: { sheet: 'sando', geo: () => projUV(ensure(extrudeY([[-0.5, 0], [0.5, 0], [0, 0.95]], 1)), { front: FRONT, back: FRONT, side: spot(0), top: spot(0) }) },
    mag: { sheet: 'mag', geo: () => projUV(ensure(boxNB()), { front: FRONT, back: spot(2), top: spot(0), side: spot(0) }) },
    book: { sheet: 'spine', geo: () => projUV(ensure(boxNB(false, false)), { front: [0.04, 0.11, 0.96, 0.995], back: spot(1), top: spot(1), side: spot(0), tint: { front: 1, back: 0, top: 0, side: 1 } }) },
    cover: { sheet: 'cover', geo: () => projUV(ensure(boxNB()), { front: FRONT, back: spot(2), top: spot(1), side: spot(0), tint: { front: 1, back: 1, top: 0, side: 1 } }) },
    album: { sheet: 'album', geo: () => projUV(ensure(boxNB()), { front: FRONT, back: FRONT, top: spot(0), side: spot(0) }) },
    bmark: { sheet: 'bmark', geo: () => projUV(ensure(boxNB()), { front: FRONT, back: FRONT, top: spot(0), side: spot(0) }) },
    blister: { sheet: 'blister', geo: () => projUV(ensure(boxNB()), { front: FRONT, back: spot(2), top: spot(0), side: spot(0) }) },
    // plain (instance colour only)
    blob: { geo: () => { const g = new THREE.SphereGeometry(0.5, 8, 6); g.translate(0, 0.5, 0); return g; } },
    bud: { geo: () => { let g = new THREE.IcosahedronGeometry(0.5, 0); g.deleteAttribute('normal'); g.deleteAttribute('uv'); g = mergeVertices(g, 1e-4); g.computeVertexNormals(); g.translate(0, 0.5, 0); return g; }, outline: false },
    cyl: { geo: () => { const g = new THREE.CylinderGeometry(0.5, 0.5, 1, 10); g.translate(0, 0.5, 0); return g; } },
    cyl6: { geo: () => { const g = new THREE.CylinderGeometry(0.5, 0.5, 1, 6); g.translate(0, 0.5, 0); return g; } },
    stem: { geo: () => { const g = new THREE.CylinderGeometry(0.5, 0.5, 1, 4, 1, true); g.translate(0, 0.5, 0); return g; }, outline: false },
    leaf: { geo: leafGeo, side: 'double', outline: false },
    mcup: { geo: () => lathe([[0.34, 0, 0], [0.5, 1, 0], [0.53, 0.98, 0], [0.47, 0.93, 0], [0.33, 0.03, 0]], 8) },
    ccup: { geo: cupHandleGeo },
    saucer: { geo: () => lathe([[0, 0, 0], [0.3, 0, 0], [0.34, 0.05, 0], [0.5, 0.18, 0], [0.5, 0.24, 0], [0.3, 0.14, 0], [0, 0.12, 0]], 14) },
    plate: { geo: () => lathe([[0, 0, 0], [0.36, 0, 0], [0.4, 0.3, 0], [0.5, 0.8, 0], [0.5, 1, 0], [0.38, 0.55, 0], [0, 0.5, 0]], 14) },
    rose: { geo: () => lathe([[0, 0, 0], [0.36, 0.1, 0], [0.5, 0.45, 0], [0.45, 0.8, 0], [0.26, 0.86, 0], [0, 0.78, 0]], 7, { warp: (phi, j) => [j >= 2 && j <= 4 ? 0.08 * Math.cos(phi * 5 + j * 1.3) : 0, j === 3 ? 0.05 * Math.cos(phi * 5) : 0] }), outline: false },
    tulip: { geo: () => lathe([[0, 0, 0], [0.28, 0.08, 0], [0.46, 0.4, 0], [0.45, 0.78, 0], [0.34, 0.96, 0]], 6, { warp: (phi, j) => [0, j === 4 ? 0.14 * Math.max(0, Math.cos(phi * 3)) : 0] }), side: 'double', outline: false },
    daisy: { geo: () => starGeo(14, 0.2), side: 'double', outline: false },
    star5: { geo: () => starGeo(5, 0.26), side: 'double', outline: false },
    cone: { geo: () => { const g = new THREE.ConeGeometry(0.5, 1, 8, 1, true); g.translate(0, 0.5, 0); return g; }, side: 'double' },
    ring: { geo: () => { const g = new THREE.TorusGeometry(0.4, 0.1, 5, 10); g.rotateX(Math.PI / 2); g.translate(0, 0.1, 0); return g; } },
  };

  // ---------------------------------------------------------------- material (toon + per-instance label cell + per-vertex tint mask)
  const matCache = new Map(); // patch each (kind, glow) material exactly once — mat.toon() caches by args
  function goodsMat(kind, inner, side) {
    const mk = kind + '|' + inner;
    if (matCache.has(mk)) return matCache.get(mk);
    const K = KINDS[kind];
    const sh = K.sheet ? sheet(K.sheet) : null;
    // interior self-light is proportional to the albedo (label x instance colour), so goods stay saturated
    const m = ctx.mat.toon('#ffffff', { map: sh ? sh.t : null, paint: 0.02, side, name: `shopsA-goods-${kind}-${inner || 0}` });
    const obc = m.onBeforeCompile;
    m.onBeforeCompile = (s, r) => {
      obc(s, r);
      s.uniforms.uSelf = { value: inner || 0 };
      s.fragmentShader = s.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform float uSelf;')
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n  totalEmissiveRadiance += diffuseColor.rgb * vec3(1.0, 0.9, 0.76) * uSelf;');
      s.vertexShader = s.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float aTint;\nattribute vec4 aUV;')
        .replace('#include <uv_vertex>', '#include <uv_vertex>\n#ifdef USE_MAP\n  vMapUv = vMapUv * aUV.zw + aUV.xy;\n#endif')
        .replace('#include <color_vertex>', '#include <color_vertex>\n#ifdef USE_INSTANCING_COLOR\n  vColor.xyz = mix(vec3(1.0), instanceColor.xyz, aTint);\n#endif');
    };
    m.customProgramCacheKey = () => 'paint|shopsA-goods';
    const res = { m, sh }; matCache.set(mk, res);
    return res;
  }

  // ---------------------------------------------------------------- registry
  const lists = new Map(); // key -> {kind, inner, items: []}
  let shop = 'x', inner = 0.42;
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();
  let lastBase = null;
  const G = {
    KINDS, sheet,
    /** subsequent add() calls belong to this shop (one InstancedMesh per kind per shop); innerGlow = warm self-light (0 = none) */
    setShop(id, innerGlow = 0.42) { shop = id; inner = innerGlow; },
    count(kind) { const s = sheet(KINDS[kind].sheet); return s.n; },
    /** add an instance: base = Object3D (its current world matrix is used) or a space S; pos/rot/scl in base-local
     *  coordinates; unit shapes have their origin at the bottom centre and face +z. */
    add(kind, base, pos, scl, color = '#ffffff', rot = null, variant = 0, o = {}) {
      const b = base.g || base;
      if (b !== lastBase) { b.updateWorldMatrix(true, false); lastBase = b; }
      _e.set(rot ? rot[0] || 0 : 0, rot ? rot[1] || 0 : 0, rot ? rot[2] || 0 : 0, rot && rot[3] || 'XYZ'); _q.setFromEuler(_e);
      _p.set(pos[0], pos[1], pos[2]); _s.set(scl[0], scl[1], scl[2]);
      _m.compose(_p, _q, _s).premultiply(b.matrixWorld);
      const inn = o.inner ?? inner;
      const key = `${kind}|${shop}|${inn}`;
      let L2 = lists.get(key); if (!L2) lists.set(key, (L2 = { kind, inner: inn, shop, items: [] }));
      _c.set(color);
      L2.items.push({ m: _m.clone(), r: _c.r, g: _c.g, b: _c.b, v: variant });
    },
    build() {
      const out = [];
      for (const [, L2] of lists) {
        if (!L2.items.length) continue;
        const K = KINDS[L2.kind];
        const geo = ensure(K.geo());
        const { m, sh } = goodsMat(L2.kind, L2.inner, K.side);
        const n = L2.items.length;
        const auv = new Float32Array(n * 4);
        const im = new THREE.InstancedMesh(geo, m, n);
        const col = new THREE.Color();
        L2.items.forEach((it, i) => {
          im.setMatrixAt(i, it.m); col.setRGB(it.r, it.g, it.b); im.setColorAt(i, col);
          if (sh) { const v = ((it.v % sh.n) + sh.n) % sh.n, cx = v % sh.cols, cy = Math.floor(v / sh.cols); auv.set([cx / sh.cols, 1 - (cy + 1) / sh.rows, 1 / sh.cols, 1 / sh.rows], i * 4); }
          else auv.set([0, 0, 1, 1], i * 4);
        });
        geo.setAttribute('aUV', new THREE.InstancedBufferAttribute(auv, 4));
        im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
        im.computeBoundingSphere(); im.computeBoundingBox?.();
        im.castShadow = false; im.receiveShadow = true; im.name = `shopsA-goods-${L2.kind}-${L2.shop}`;
        if (K.outline === false) ctx.noOutline(im);
        ctx.addStatic(im); out.push(im);
      }
      return out;
    },
    stats() { const s = {}; for (const [k, L2] of lists) s[k] = L2.items.length; return s; },
  };
  return G;
}
