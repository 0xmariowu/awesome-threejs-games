// 船: 漁港の漁船（一本釣り・いか釣り・刺し網）と、アヒル島への渡船
// 船体: 船尾から船首へ断面を並べて張る。断面は 竜骨 → V 字の船底 → チャイン → 上へ開く舷側 → 防舷材 → ブルワークの天端 → 内側 → 甲板
// 船体の塗り分け（船底塗料・水線・舷側の帯・排水口と錆・船名）は船体シェーダーが高さから決める（線がぎざぎざにならない）
// 座標: +z = 船首、y = 0 が水面、x = 幅（+x が左舷）
import * as THREE from 'three';
import { Kit, kitMaterials } from './kit.js';
import { texMat } from './textures.js';

const C = (h) => new THREE.Color(h);
const pick = (a, r) => a[Math.floor(r() * a.length) % a.length];
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// ---------- 船型 ----------
// t = 0（船尾の板）→ 1（船首の先）
export class Hull {
  constructor(o) {
    Object.assign(this, { L: 10, B: 2.8, draft: 0.55, fb: 1.05, bow: 1.9, rise: 2.6, bh: 0.5, deckRise: 0.65, tr: 0.86, peak: 0.45, cam: 0.05 }, o);
    this.za = -this.L / 2; this.zb = this.L / 2;
  }
  t(z) { return clamp((z - this.za) / this.L, 0, 1); }
  // 舷縁（ブルワークの天端）の高さ: 船首へ向かって反り上がる
  sheer(t) { return this.fb + (this.bow - this.fb) * Math.pow(t, this.rise); }
  // 竜骨: 船尾はやや浅く、前 4 割で水面の上まで反り上がって船首材になる
  keel(t) {
    const d = this.draft;
    if (t < 0.35) return -d * (0.8 + 0.2 * sstep(0, 0.35, t));
    if (t < 0.6) return -d;
    return Math.min(-d + (this.sheer(1) + d) * Math.pow((t - 0.6) / 0.4, 2.4), this.sheer(t));
  }
  // 舷縁の半幅
  half(t) {
    const m = this.peak, b = this.B / 2;
    if (t <= m) { const u = (m - t) / m; return b * (1 - (1 - this.tr) * u * u); }
    const u = (t - m) / (1 - m);
    return b * Math.pow(Math.max(0, 1 - u * u), 0.8);
  }
  // 甲板（舷縁ほどは反らない → 船首のブルワークは高い）
  deck(t) {
    const s = this.sheer(t);
    const d = this.fb - this.bh + (this.bow - this.fb) * Math.pow(t, this.rise) * this.deckRise;
    return Math.min(Math.max(d, this.keel(t) + 0.2), s - 0.03);
  }
  sheerAt(z) { return this.sheer(this.t(z)); }
  deckAt(z, x = 0) { const s = this.section(z); return s.d + this.cam * (1 - Math.min(1, (x / Math.max(s.xi, 0.01)) ** 2)); }
  // 断面（左舷 x > 0 の半分）: 部位ごとの点列。隣り合う部位は端の点を共有する
  section(z) {
    const t = this.t(z);
    const s = this.sheer(t), hb = Math.max(0, this.half(t)), k = Math.min(this.keel(t), s);
    const r = Math.min(1, hb / 0.35);
    const cw = lerp(0.9, 0.5, sstep(0.4, 1, t)), cf = lerp(0.3, 0.42, sstep(0.3, 1, t));
    const cx = hb * cw, cy = k + (s - k) * cf;
    const bottom = [];
    {
      const dx = cx, dy = cy - k, l = Math.hypot(dx, dy) || 1, nx = dy / l, ny = -dx / l;
      for (let q = 0; q <= 3; q++) { const u = q / 3, b = 0.03 * r * Math.sin(Math.PI * u); bottom.push([dx * u + nx * b, k + dy * u + ny * b]); }
    }
    const lip = [[cx, cy], [cx + 0.05 * r, cy + 0.012 * r]];
    const side = [];
    const [x0, y0] = lip[1], yTop = Math.max(s - 0.13 * r, y0);
    for (let q = 0; q <= 5; q++) { const u = q / 5; side.push([lerp(x0, hb, u) + 0.03 * r * Math.sin(Math.PI * u), lerp(y0, yTop, u)]); }
    const rub = [[0, 0.13], [0.035, 0.12], [0.055, 0.095], [0.055, 0.065], [0.035, 0.042], [0, 0.032]].map(([dx, dy]) => [hb + dx * r, Math.max(s - dy * r, yTop)]);
    const bt = 0.075 * r;
    const cap = [[hb, s - 0.032 * r], [hb, s - 0.012 * r], [hb - 0.012 * r, s], [Math.max(0, hb - bt + 0.012 * r), s], [Math.max(0, hb - bt), s - 0.012 * r]];
    const d = this.deck(t);
    const outer = [...bottom, ...side];
    let xo = hb;
    for (let q = 1; q < outer.length; q++) {
      const [ax, ay] = outer[q - 1], [bx, by] = outer[q];
      if (d >= ay && d <= by && by > ay) { xo = ax + (bx - ax) * (d - ay) / (by - ay); break; }
    }
    if (d < k) xo = 0;
    const xi = Math.max(0, Math.min(hb - bt - 0.02, xo - 0.06));
    const inner = [cap[4], [xi, d]];
    const cam = this.cam * Math.min(1, xi / 0.4);
    const deck = [[xi, d], [xi * 0.66, d + cam * 0.56], [xi * 0.33, d + cam * 0.89], [0, d + cam]];
    return { t, s, hb, k, d, xi, cx, cy, bt, r, parts: { bottom, lip, side, rub, cap, inner, deck } };
  }
  // 舷側の外面の x（高さ y で）
  outerX(z, y) {
    const { parts: P, hb } = this.section(z);
    const pts = [...P.bottom, ...P.lip.slice(1), ...P.side.slice(1)];
    if (y >= pts[pts.length - 1][1]) return hb;
    for (let q = 1; q < pts.length; q++) {
      const [ax, ay] = pts[q - 1], [bx, by] = pts[q];
      if (y >= ay && y <= by && by > ay) return ax + (bx - ax) * (y - ay) / (by - ay);
    }
    return 0;
  }
  stations() {
    const zs = [this.za, this.za + 0.015, this.za + 0.05];
    let z = this.za + 0.05;
    for (;;) {
      z += lerp(0.3, 0.045, sstep(0.55, 0.97, this.t(z)));
      if (z >= this.zb - 0.01) break;
      zs.push(z);
    }
    zs.push(this.zb);
    return zs;
  }
}

// ---------- 船体のシェーダー ----------
const HULL_GLSL = /* glsl */ `
  varying vec3 vHP;
  varying vec2 vHU;
  uniform vec3 hTop, hBottom, hBoot, hStripe, hRust;
  uniform float hWl, hBootW, hScup, hZa, hDirt;
  uniform vec4 hStripeR;
  uniform sampler2D hName;
  uniform vec4 hNameR, hTransR;
  float hh(float n) { return fract(sin(n * 91.345) * 47453.21); }
  float hn(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float n = i.x + i.y * 57.0;
    return mix(mix(hh(n), hh(n + 1.0), f.x), mix(hh(n + 57.0), hh(n + 58.0), f.x), f.y);
  }
  float hEdge(float v, float e) { float w = max(fwidth(v), 1e-4); return smoothstep(e - w, e + w, v); }
  float hBand(float v, float a, float b) { return hEdge(v, a) * (1.0 - hEdge(v, b)); }
  vec3 hullPaint(out float rough) {
    float y = vHP.y, z = vHP.z, dS = vHU.x, fr = vHU.y;
    float n1 = hn(vec2(z * 1.7, y * 2.3)), n2 = hn(vec2(z * 9.0, y * 13.0)), n3 = hn(vec2(z * 23.0, y * 3.0));
    vec3 c = hTop * (0.965 + 0.05 * n1);
    rough = 0.28 + 0.12 * n2;
    // 舷側の帯
    c = mix(c, hStripe, max(hBand(dS, hStripeR.x, hStripeR.y), hBand(dS, hStripeR.z, hStripeR.w)));
    // 排水口と、そこから垂れる錆
    float cell = floor(z / hScup + 0.5), fz = z - cell * hScup, on = step(0.4, hh(cell + 3.7)) * step(0.02, abs(vHP.x)) * step(hZa + 0.02, z);
    vec2 nd = vec2(0.5 + sign(vHP.x) * (hNameR.x - z) / hNameR.z, 0.5 + (y - hNameR.y) / hNameR.w);
    on *= 1.0 - step(-0.15, nd.x) * step(nd.x, 1.15);
    float hole = hBand(fz, -0.1, 0.1) * hBand(fr, 0.87, 1.0) * on;
    float wid = 0.05 * (1.0 - smoothstep(1.0, 2.6, fr)) + 0.012;
    float streak = hBand(fz + (n3 - 0.5) * 0.03, -wid, wid) * hBand(fr, 1.0, 3.2) * (1.0 - smoothstep(1.0, 3.0, fr)) * on * (0.4 + 0.6 * n3);
    c = mix(c, hRust, streak * 0.5 * hDirt);
    c = mix(c, vec3(0.03), hole);
    // 水線の少し上の汚れ
    float g = 1.0 - smoothstep(hWl + hBootW, hWl + hBootW + 0.4, y);
    c = mix(c, vec3(0.42, 0.4, 0.3), g * 0.3 * (0.5 + 0.5 * n1) * hDirt);
    // ブーツトップ（水線の帯）と船底塗料
    c = mix(c, hBoot, 1.0 - hEdge(y, hWl + hBootW));
    float bot = 1.0 - hEdge(y, hWl);
    vec3 bc = hBottom * (0.9 + 0.15 * n2);
    // 水面のあたりの藻
    bc = mix(bc, vec3(0.16, 0.2, 0.09), (1.0 - smoothstep(-0.3, hWl, y)) * smoothstep(-0.6, -0.1, y) * 0.5 * n1);
    c = mix(c, bc, bot);
    rough = mix(rough, 0.8, bot);
    // 船名（舷側）と船尾の板
    vec2 d = vec2(0.5 + sign(vHP.x) * (hNameR.x - z) / hNameR.z, 0.5 + (y - hNameR.y) / hNameR.w);
    if (z > hZa + 0.01 && d.x > 0.0 && d.x < 1.0 && d.y > 0.0 && d.y < 1.0) { vec4 tx = texture2D(hName, vec2(d.x, 0.5 + d.y * 0.5)); c = mix(c, tx.rgb, tx.a); }
    vec2 e = vec2(0.5 - vHP.x / hTransR.z, 0.5 + (y - hTransR.y) / hTransR.w);
    if (z <= hZa + 0.01 && e.x > 0.0 && e.x < 1.0 && e.y > 0.0 && e.y < 1.0) { vec4 tx = texture2D(hName, vec2(e.x, e.y * 0.5)); c = mix(c, tx.rgb, tx.a); }
    return c;
  }
`;

// 舷側の船名の位置（中心の z と幅）
const nameRect = (H) => [H.za + H.L * 0.76, Math.min(3.2, H.L * 0.24)];
const nameStart = (H) => { const [zc, w] = nameRect(H); return zc - w / 2; };

function hullMaterial(spec) {
  const { hull: H, paint: P } = spec;
  const m = new THREE.MeshStandardMaterial({ roughness: 0.3, metalness: 0 });
  const [zc, nw] = nameRect(H), tc = H.t(zc);
  const tw = Math.min(H.half(0) * 1.5, 2.6);
  const u = {
    hTop: { value: C(P.top) }, hBottom: { value: C(P.bottom) }, hBoot: { value: C(P.boot) }, hStripe: { value: C(P.stripe || P.top) }, hRust: { value: C('#8a5a36') },
    hWl: { value: P.wl ?? 0.06 }, hBootW: { value: P.bootW ?? 0.09 }, hScup: { value: P.scup ?? 1.3 }, hZa: { value: H.za }, hDirt: { value: P.dirt ?? 1 },
    hStripeR: { value: new THREE.Vector4(...(P.stripeR || [-1, -1, -1, -1])) },
    hName: { value: nameTexture(spec) },
    hNameR: { value: new THREE.Vector4(zc, H.sheer(tc) - 0.2 - nw / 8 - 0.12, nw, nw / 4) },
    hTransR: { value: new THREE.Vector4(0, H.sheer(0) - 0.24 - tw / 8, tw, tw / 4) },
  };
  m.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, u);
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vHP;\nvarying vec2 vHU;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvHP = position;\nvHU = uv;');
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', '#include <common>\n' + HULL_GLSL)
      .replace('#include <color_fragment>', '#include <color_fragment>\nfloat hRough;\ndiffuseColor.rgb = hullPaint(hRough);')
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = hRough;');
  };
  m.customProgramCacheKey = () => 'boatHull';
  return m;
}

// 船名: 上半分 = 舷側（船名と登録番号）、下半分 = 船尾（船名と船籍港）
const SERIF = '"Zen Old Mincho", "Yu Mincho", "YuMincho", "Hiragino Mincho ProN", serif';
function drawName(g, spec) {
  g.clearRect(0, 0, 1024, 512);
  g.fillStyle = spec.paint.ink || '#15233f'; g.textBaseline = 'middle';
  // 舷側
  const [pre, main] = spec.name.includes(' ') ? spec.name.split(' ') : ['', spec.name];
  g.font = `700 60px "Arial Black", "Yu Gothic", sans-serif`;
  const rw = g.measureText(spec.reg).width;
  g.textAlign = 'right';
  g.fillText(spec.reg, 1000, 150);
  g.textAlign = 'left';
  let x = 30;
  if (pre) { g.font = `900 64px ${SERIF}`; g.fillText(pre, x, 150); x += g.measureText(pre).width + 12; }
  g.font = `900 150px ${SERIF}`;
  g.fillText(main, x, 128, 1000 - rw - 50 - x);
  // 船尾
  g.textAlign = 'center';
  g.font = `900 120px ${SERIF}`;
  g.fillText(spec.name.replace(' ', ''), 512, 330, 960);
  g.font = `700 64px ${SERIF}`;
  g.fillText(spec.port || '吉山', 512, 450);
}
function nameTexture(spec) {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 512;
  const g = c.getContext('2d');
  drawName(g, spec);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  // 明朝のウェブフォントが後から届いたら描き直す
  document.fonts?.load(`900 150px "Zen Old Mincho"`, spec.name).then((f) => { if (f.length) { drawName(g, spec); t.needsUpdate = true; } }, () => {});
  return t;
}

// ---------- 組み立ての道具 ----------
const V3 = (a) => new THREE.Vector3(...a);
const TUBES = new Map();
const tubeGeo = (seg) => TUBES.get(seg) || TUBES.set(seg, new THREE.CylinderGeometry(1, 1, 1, seg, 1, true)).get(seg);
const _up = new THREE.Vector3(0, 1, 0);
// 丸いパイプ
function pipe(k, mat, a, b, rad, seg = 8) {
  const A = V3(a), B = V3(b), d = B.clone().sub(A), L = d.length();
  if (L < 1e-4) return;
  const q = new THREE.Quaternion().setFromUnitVectors(_up, d.normalize());
  k.geo(mat, tubeGeo(seg), new THREE.Matrix4().compose(A.add(B).multiplyScalar(0.5), q, new THREE.Vector3(rad, L, rad)));
}
// たるんだロープ
function rope(k, a, b, sag = 0.1, rad = 0.012, n = 8) {
  let p = a;
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    const q = [lerp(a[0], b[0], t), lerp(a[1], b[1], t) - sag * 4 * t * (1 - t), lerp(a[2], b[2], t)];
    pipe(k, 'cloth', p, q, rad, 5);
    p = q;
  }
}
// 外向き（out）になるよう向きをそろえて面を張る。UV は面の向きに合わせた m 単位
function face(k, mat, pts, out) {
  const [a, b] = pts, c = pts[pts.length === 4 ? 3 : 2];
  const n = V3(b).sub(V3(a)).cross(V3(c).sub(V3(a)));
  if (n.dot(V3(out)) < 0) pts = pts.slice().reverse();
  const ax = Math.abs(out[0]), ay = Math.abs(out[1]), az = Math.abs(out[2]);
  const uv = pts.map((p) => (ax >= ay && ax >= az ? [p[2], p[1]] : ay >= az ? [p[0], p[2]] : [p[0], p[1]]));
  k.face(mat, pts, uv);
}
const geoAt = (k, mat, g, x, y, z, rx = 0, ry = 0, rz = 0, s = 1) =>
  k.geo(mat, g, new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(s, s, s)));

// ---------- 船体 ----------
const HULL_PARTS = [['bottom', 'hull'], ['lip', 'hull'], ['side', 'hull'], ['rub', 'rubber'], ['cap', 'trim'], ['inner', 'trim'], ['deck', 'deck']];

function loftPart(rows, uvOf) {
  const m = rows.length, n = rows[0].length;
  const pos = new Float32Array(m * n * 3), uv = new Float32Array(m * n * 2), idx = [];
  rows.forEach((row, i) => row.forEach((p, j) => { pos.set(p, (i * n + j) * 3); uv.set(uvOf(p, i, j), (i * n + j) * 2); }));
  for (let i = 0; i < m - 1; i++) for (let j = 0; j < n - 1; j++) {
    const a = i * n + j, b = a + 1, c = a + n + 1, d = a + n;
    idx.push(a, b, c, a, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  // 右舷（鏡写し）
  const h = g.clone();
  const P = h.attributes.position.array, N = h.attributes.normal.array;
  for (let q = 0; q < P.length; q += 3) { P[q] = -P[q]; N[q] = -N[q]; }
  const I = h.index.array;
  for (let q = 0; q < I.length; q += 3) { const t = I[q + 1]; I[q + 1] = I[q + 2]; I[q + 2] = t; }
  return [g, h];
}

function buildHull(k, spec) {
  const H = spec.hull, P = spec.paint;
  const zs = H.stations();
  const secs = zs.map((z) => H.section(z));
  for (const [part, mat] of HULL_PARTS) {
    const rows = secs.map((s, i) => s.parts[part].map(([x, y]) => [x, y, zs[i]]));
    let arc = null;
    const uvOf = mat === 'hull'
      ? (p, i) => { const s = secs[i]; return [s.s - p[1], (s.s - p[1]) / Math.max(0.05, s.s - s.d)]; }
      : mat === 'deck' ? (p) => [p[0], p[2]]
        : (p, i, j) => { if (j === 0) arc = 0; else { const q = rows[i][j - 1]; arc += Math.hypot(p[0] - q[0], p[1] - q[1]); } return [arc, p[2]]; };
    const col = { rubber: P.rub || '#2b2d30', trim: part === 'cap' ? (P.cap || '#eef0ec') : (P.inner || '#e4e8e2'), deck: P.deck || '#9aa89f', hull: '#ffffff' }[mat];
    k.color(C(col));
    for (const g of loftPart(rows, uvOf)) k.geo(mat, g);
  }
  // 船尾の板（トランサム）: 外形を三角形に割る
  {
    const s = secs[0], p = s.parts;
    const half = [...p.bottom, ...p.lip.slice(1), ...p.side.slice(1), ...p.rub.slice(1), ...p.cap.slice(1)];
    const ring = [...half, ...half.slice(1).reverse().map(([x, y]) => [-x, y])];
    const tris = THREE.ShapeUtils.triangulateShape(ring.map(([x, y]) => new THREE.Vector2(x, y)), []);
    const pos = [], uv = [], nor = [];
    for (const tri of tris) {
      const q = tri.map((i) => ring[i]);
      const cr = (q[1][0] - q[0][0]) * (q[2][1] - q[0][1]) - (q[1][1] - q[0][1]) * (q[2][0] - q[0][0]);
      // 後ろ（-z）から見て反時計回り
      const o = cr > 0 ? [q[0], q[2], q[1]] : q;
      for (const [x, y] of o) { pos.push(x, y, H.za); uv.push(s.s - y, (s.s - y) / Math.max(0.05, s.s - s.d)); nor.push(0, 0, -1); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    k.color(C('#ffffff')).geo('hull', g);
    // 船尾のブルワークの内側と天端
    const z1 = H.za + s.bt + 0.005;
    k.color(C(P.inner || '#e4e8e2'));
    face(k, 'trim', [[-s.xi, s.d - 0.02, z1], [s.xi, s.d - 0.02, z1], [s.hb - s.bt, s.s - 0.012, z1], [-(s.hb - s.bt), s.s - 0.012, z1]], [0, 0, 1]);
    k.color(C(P.cap || '#eef0ec'));
    face(k, 'trim', [[-(s.hb - s.bt), s.s, H.za], [s.hb - s.bt, s.s, H.za], [s.hb - s.bt, s.s, z1], [-(s.hb - s.bt), s.s, z1]], [0, 1, 0]);
  }
  // 竜骨とスケグ（船尾ほど深い）・舵・プロペラ
  {
    const rows = [];
    for (const z of zs) {
      const t = H.t(z);
      if (t < 0.02 || t > 0.9) continue;
      const kz = H.keel(t), dep = 0.08 + 0.26 * (1 - sstep(0.05, 0.42, t));
      rows.push([[-0.04, kz + 0.03, z], [-0.03, kz - dep, z], [0.03, kz - dep, z], [0.04, kz + 0.03, z]]);
    }
    const [g] = loftPart(rows, (p) => [0, 0]);
    k.color(C('#ffffff')).geo('hull', g);
    const k0 = H.keel(0.03);
    k.box('hull', 0, k0 - 0.33, H.za + 0.18, 0.05, 0.5, 0.42);
    k.color(C('#b08d57'));
    pipe(k, 'metal', [0, k0 - 0.22, H.za + 0.4], [0, k0 - 0.2, H.za + 1.0], 0.03);
    for (let b = 0; b < 3; b++) {
      const a = b * Math.PI * 2 / 3;
      geoAt(k, 'metal', new THREE.BoxGeometry(0.012, 0.2, 0.09), Math.sin(a) * 0.11, k0 - 0.22 + Math.cos(a) * 0.11, H.za + 0.42, 0, 0.5, -a);
    }
  }
}

// ---------- 甲板の上 ----------
// 操舵室・客室: z0..z1（前面は上ほど前へ出る rake）、半幅 w、高さ h
function deckhouse(k, H, o) {
  const { z0, z1, w, h, rake = 0.15, wall = '#f2f3f0', roof = '#e8eae6', panes = 2, frontPanes = 3, winH = null, base = null } = o;
  const yb = base ?? Math.min(H.deckAt(z0), H.deckAt(z1)) - 0.06;
  const yt = (base ?? Math.max(H.deckAt(z0), H.deckAt(z1))) + h;
  const zf = (y) => z1 + rake * (y - yb) / (yt - yb);
  const wc = C(wall), gl = C('#17222b'), fr = C('#c7cbce');
  k.color(wc);
  face(k, 'paint', [[-w, yb, z0], [w, yb, z0], [w, yt, z0], [-w, yt, z0]], [0, 0, -1]);
  for (const s of [1, -1]) face(k, 'paint', [[s * w, yb, z0], [s * w, yb, z1], [s * w, yt, zf(yt)], [s * w, yt, z0]], [s, 0, 0]);
  face(k, 'paint', [[-w, yb, z1], [w, yb, z1], [w, yt, zf(yt)], [-w, yt, zf(yt)]], [0, -rake, yt - yb]);
  // 窓（ガラスは壁の少し外、アルミの枠）
  const wh = winH ?? Math.min(0.8, (yt - yb) * 0.42);
  const w0 = yt - 0.12 - wh, w1 = yt - 0.12;
  const frameLoop = (pts) => { k.color(fr); for (let q = 0; q < pts.length; q++) k.rod('metal', pts[q], pts[(q + 1) % pts.length], 0.03); };
  // 前
  {
    const nz = (yt - yb), ny = -rake, nl = Math.hypot(ny, nz), oy = ny / nl * 0.012, oz = nz / nl * 0.012;
    const gap = 0.05, pw = (2 * w - 0.16 - gap * (frontPanes - 1)) / frontPanes;
    for (let q = 0; q < frontPanes; q++) {
      const xa = -w + 0.08 + q * (pw + gap), xb = xa + pw;
      const pts = [[xa, w0 + oy, zf(w0) + oz], [xb, w0 + oy, zf(w0) + oz], [xb, w1 + oy, zf(w1) + oz], [xa, w1 + oy, zf(w1) + oz]];
      k.color(gl); face(k, 'glass', pts, [0, ny, nz]);
      frameLoop(pts.map(([x, y, z]) => [x, y + oy, z + oz]));
    }
  }
  // 横
  for (const s of [1, -1]) {
    const za = z0 + 0.2, zb = (y) => zf(y) - 0.14;
    const L0 = zb(w0) - za, L1 = zb(w1) - za;
    for (let q = 0; q < panes; q++) {
      const f0 = q / panes, f1 = (q + 1) / panes, g0 = q ? 0.03 : 0, g1 = q < panes - 1 ? 0.03 : 0;
      const pts = [[s * (w + 0.012), w0, za + L0 * f0 + g0], [s * (w + 0.012), w0, za + L0 * f1 - g1], [s * (w + 0.012), w1, za + L1 * f1 - g1], [s * (w + 0.012), w1, za + L1 * f0 + g0]];
      k.color(gl); face(k, 'glass', pts, [s, 0, 0]);
      frameLoop(pts.map(([x, y, z]) => [x + s * 0.01, y, z]));
    }
  }
  // 後ろ: 左舷寄りに扉、右舷寄りに小窓
  if (o.door !== false) {
    const dx = w > 0.9 ? -w + 0.2 : -w + 0.12, dw = Math.min(0.62, w * 0.8);
    k.color(C(o.doorCol || wall)); k.box('paint', dx + dw / 2, yb + (yt - yb - 0.12) / 2 + 0.03, z0 - 0.015, dw, yt - yb - 0.16, 0.03);
    k.color(gl); k.box('glass', dx + dw / 2, w0 + wh * 0.45, z0 - 0.032, dw * 0.6, wh * 0.7, 0.01);
    k.color(C('#8d9296')); k.box('metal', dx + dw - 0.08, yb + (yt - yb) * 0.45, z0 - 0.04, 0.03, 0.1, 0.03);
    if (w > 0.75) { const pts = [[w - 0.55, w0, z0 - 0.012], [w - 0.15, w0, z0 - 0.012], [w - 0.15, w1, z0 - 0.012], [w - 0.55, w1, z0 - 0.012]]; k.color(gl); face(k, 'glass', pts, [0, 0, -1]); frameLoop(pts.map(([x, y, z]) => [x, y, z - 0.01])); }
  }
  // 屋根（前にひさし）と雨どい
  k.color(C(roof));
  const rz0 = z0 - 0.08, rz1 = zf(yt) + 0.28;
  k.box('paint', 0, yt + 0.04, (rz0 + rz1) / 2, 2 * w + 0.14, 0.08, rz1 - rz0);
  k.color(wc); k.box('paint', 0, yt + 0.1, (rz0 + rz1) / 2, 2 * w + 0.16, 0.04, rz1 - rz0 + 0.02, 1 | 2 | 4 | 8 | 16);
  // 水切り
  k.color(C('#9aa0a4')); k.box('metal', 0, w0 - 0.035, zf(w0 - 0.035) + 0.03, 2 * w + 0.02, 0.03, 0.06);
  return { yb, yt, top: yt + 0.12, z0, z1, zFront: zf(yt), w };
}

// 手すり（点列に沿って支柱と 2 段のパイプ）
function railing(k, pts, h = 0.9, col = '#d7dadc', gap = 1.1) {
  k.color(C(col));
  for (let q = 0; q < pts.length - 1; q++) {
    const a = pts[q], b = pts[q + 1];
    pipe(k, 'metal', [a[0], a[1] + h, a[2]], [b[0], b[1] + h, b[2]], 0.022);
    pipe(k, 'metal', [a[0], a[1] + h * 0.5, a[2]], [b[0], b[1] + h * 0.5, b[2]], 0.016);
    const L = Math.hypot(b[0] - a[0], b[2] - a[2]), n = Math.max(1, Math.round(L / gap));
    for (let i = q ? 1 : 0; i <= n; i++) { const t = i / n; const x = lerp(a[0], b[0], t), y = lerp(a[1], b[1], t), z = lerp(a[2], b[2], t); pipe(k, 'metal', [x, y, z], [x, y + h, z], 0.02); }
  }
}

// 灯火（色つきで光る小箱）
function lamp(k, x, y, z, col, s = 0.08) { k.color(C('#2a2c2e')); k.box('dark', x, y - s * 0.7, z, s * 0.9, s * 0.4, s * 0.9); k.color(C(col)); k.box('glowV', x, y, z, s, s * 1.1, s); }

// マスト（屋根の上）: 帆桁・灯火・アンテナ・レーダー・旗
function mast(k, r, x, y0, z, hgt, o = {}) {
  const white = C('#eef0ee');
  k.color(white);
  pipe(k, 'paint', [x, y0, z], [x, y0 + hgt, z], 0.05, 10);
  const yY = y0 + hgt * 0.72;
  pipe(k, 'paint', [x - 0.55, yY, z], [x + 0.55, yY, z], 0.03);
  for (const s of [1, -1]) pipe(k, 'paint', [x, y0 + hgt * 0.5, z], [x + s * 0.5, yY, z], 0.018);
  lamp(k, x, y0 + hgt + 0.06, z, '#fff7e0', 0.09);
  lamp(k, x, yY + 0.34, z + 0.06, '#fff7e0', 0.08);
  lamp(k, x + 0.5, yY + 0.08, z, '#ffd24a', 0.07);
  lamp(k, x - 0.5, yY + 0.08, z, '#ffd24a', 0.07);
  // 旗
  if (o.flag !== false) {
    const fc = C(pick(['#d33a2c', '#f3f1ea', '#e6b92e', '#2d61b0'], r));
    const fy = y0 + hgt - 0.05;
    k.color(fc);
    const pts = [];
    for (let i = 0; i <= 4; i++) { const u = i / 4; pts.push([x + 0.01 + Math.sin(u * 3 + 1) * 0.04, fy, z - u * 0.55]); }
    for (let i = 0; i < 4; i++) face(k, 'cloth', [pts[i], pts[i + 1], [pts[i + 1][0], fy - 0.34, pts[i + 1][2]], [pts[i][0], fy - 0.34, pts[i][2]]], [1, 0, 0]);
  }
}

// 屋根の上の道具
function roofGear(k, r, H, hs, o = {}) {
  const y = hs.top, zc = (hs.z0 + hs.zFront) / 2;
  // レーダー: 回るアンテナ（オープン）か白いドーム
  if (o.radome ?? r() < 0.5) {
    k.color(C('#f4f5f3'));
    k.cyl('plastic', 0, y + 0.18, hs.z0 + 0.45, 0.3, 0.2, 20);
    geoAt(k, 'plastic', new THREE.SphereGeometry(0.3, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.35, 1), 0, y + 0.38, hs.z0 + 0.45);
    k.color(C('#d7dadc')); pipe(k, 'metal', [0, y, hs.z0 + 0.45], [0, y + 0.18, hs.z0 + 0.45], 0.05);
  } else {
    k.color(C('#2c2f33')); k.box('plastic', 0, y + 0.2, hs.z0 + 0.45, 0.28, 0.4, 0.3);
    k.color(C('#f2f3f1')); k.box('plastic', 0, y + 0.47, hs.z0 + 0.45, 1.25, 0.1, 0.16);
  }
  mast(k, r, 0, y, hs.z0 + 1.05 > hs.zFront - 0.3 ? zc : hs.z0 + 1.05, o.mastH ?? 2.1, o);
  // GPS・無線のきのこアンテナと細いアンテナ
  k.color(C('#f4f5f3'));
  for (const s of [1, -1]) {
    const x = s * (hs.w - 0.2), z = hs.zFront - 0.25;
    k.cyl('plastic', x, y, z, 0.07, 0.12, 12);
    geoAt(k, 'plastic', new THREE.SphereGeometry(0.07, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), x, y + 0.12, z);
  }
  k.color(C('#e9eae8'));
  for (const [x, lean, L] of [[hs.w - 0.08, 0.12, 3.2], [-(hs.w - 0.08), -0.08, 2.4]]) pipe(k, 'plastic', [x, y, hs.z0 + 0.2], [x + lean, y + L, hs.z0 + 0.1], 0.012, 5);
  // 探照灯
  k.color(C('#34383c'));
  const sz = hs.zFront - 0.1;
  pipe(k, 'dark', [0.35, y, sz], [0.35, y + 0.18, sz], 0.03);
  geoAt(k, 'metal', new THREE.CylinderGeometry(0.11, 0.09, 0.2, 16), 0.35, y + 0.28, sz + 0.02, Math.PI / 2);
  k.color(C('#f6f1dc')); geoAt(k, 'lamp', new THREE.CircleGeometry(0.1, 16), 0.35, y + 0.28, sz + 0.125);
  // 汽笛
  k.color(C('#d8dadb')); geoAt(k, 'metal', new THREE.CylinderGeometry(0.06, 0.02, 0.3, 12), -0.35, y + 0.14, sz, Math.PI / 2);
  // 舷灯（操舵室の横）
  lamp(k, hs.w + 0.06, hs.yt - 0.25, hs.zFront - 0.35, '#e0332b', 0.09);
  lamp(k, -hs.w - 0.06, hs.yt - 0.25, hs.zFront - 0.35, '#2fc46a', 0.09);
  // 煙突（後ろ）
  k.color(C(o.stack || '#2b2d30'));
  pipe(k, 'dark', [-(hs.w - 0.25), hs.yt - 0.4, hs.z0 - 0.1], [-(hs.w - 0.25), y + 0.55, hs.z0 - 0.1], 0.06, 10);
}

// スパンカー（船尾の帆）
function spanker(k, r, H, col, set = true) {
  const zm = H.za + 0.32, y0 = H.deckAt(zm), top = y0 + 3.6;
  k.color(C('#e9ebea'));
  pipe(k, 'paint', [0, y0, zm], [0, top, zm], 0.045, 10);
  lamp(k, 0, top + 0.06, zm, '#fff7e0', 0.08);
  const yb = y0 + 1.25, zEnd = H.za - 1.35;
  pipe(k, 'metal', [0, yb, zm], [0, yb - 0.05, zEnd], 0.03);
  if (!set) {
    k.color(C(col));
    for (let i = 0; i < 6; i++) geoAt(k, 'cloth', new THREE.CylinderGeometry(0.1 - i * 0.008, 0.1 - i * 0.008, 0.36, 10), 0, yb + 0.25 + i * 0.36, zm - 0.1);
    return;
  }
  // 少しふくらんだ帆（4 × 6 の網目）
  const corner = [[yb + 0.1, zm - 0.06], [top - 0.2, zm - 0.06], [top - 0.4, zm - 0.62], [yb + 0.05, zEnd + 0.08]];
  const P = (u, v) => {
    const y = lerp(lerp(corner[0][0], corner[3][0], u), lerp(corner[1][0], corner[2][0], u), v);
    const z = lerp(lerp(corner[0][1], corner[3][1], u), lerp(corner[1][1], corner[2][1], u), v);
    return [0.16 * Math.sin(Math.PI * u) * Math.sin(Math.PI * v), y, z];
  };
  const cloth = C(col);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 6; j++) {
    k.color(j === 2 || j === 3 ? cloth.clone().multiplyScalar(0.92) : cloth);
    face(k, 'cloth', [P(i / 4, j / 6), P((i + 1) / 4, j / 6), P((i + 1) / 4, (j + 1) / 6), P(i / 4, (j + 1) / 6)], [1, 0, 0]);
  }
  k.color(C('#e6e3d8'));
  rope(k, [0, top - 0.3, zm - 0.62], [0, top - 0.1, zm], 0.01, 0.008, 2);
  rope(k, [0, yb, zEnd], [0, H.deckAt(H.za + 0.1) + 0.05, H.za + 0.05], 0.05, 0.008, 4);
}

// 古タイヤの防舷材
function tires(k, H, zs) {
  const tg = new THREE.TorusGeometry(0.26, 0.1, 8, 18);
  for (const s of [1, -1]) for (const z of zs) {
    const sh = H.sheerAt(z), y = sh - 0.5;
    const x = H.outerX(z, y) + 0.1;
    k.color(C('#1c1d1f'));
    geoAt(k, 'rubber', tg, s * x, y, z, 0, Math.PI / 2, 0);
    k.color(C('#d8d2c0'));
    rope(k, [s * (x - 0.02), y + 0.33, z], [s * (H.section(z).hb - 0.03), sh + 0.02, z], 0.02, 0.01, 3);
  }
}

// ビット（係船柱）
function bitts(k, H, z, x) {
  const y = H.deckAt(z, x);
  k.color(C('#2f3236'));
  for (const s of [1, -1]) { k.cyl('metal', s * x, y, z, 0.05, 0.28, 10); k.cyl('metal', s * x, y + 0.28, z, 0.065, 0.03, 10); }
}

// 魚箱（トロ箱）の山
function fishBoxes(k, r, x, y, z, n = 3) {
  const cols = ['#2f73b8', '#e8e8e2', '#e58a2e', '#3a8f6a'];
  const c = pick(cols, r);
  for (let i = 0; i < n; i++) {
    k.color(C(c).multiplyScalar(0.95 + r() * 0.08));
    const yy = y + 0.1 + i * 0.19, dx = (r() - 0.5) * 0.04, a = (r() - 0.5) * 0.08;
    geoAt(k, 'plastic', new THREE.BoxGeometry(0.62, 0.18, 0.42), x + dx, yy, z, 0, a, 0);
  }
}

// 浮き玉
function floats(k, r, x, y, z, n = 6, spread = 0.5) {
  const g = new THREE.SphereGeometry(0.14, 14, 10);
  for (let i = 0; i < n; i++) {
    k.color(C(pick(['#f06a1e', '#f06a1e', '#f0c21e', '#f4f4f0'], r)));
    geoAt(k, 'plastic', g, x + (r() - 0.5) * spread, y + 0.13 + (i > n * 0.6 ? 0.2 : 0), z + (r() - 0.5) * spread);
  }
}

// とぐろを巻いたロープ
function coil(k, r, x, y, z, col = '#e4c24a') {
  k.color(C(col));
  for (let i = 0; i < 4; i++) geoAt(k, 'cloth', new THREE.TorusGeometry(0.2 - i * 0.02, 0.022, 6, 20), x, y + 0.025 + i * 0.035, z, Math.PI / 2, 0, 0);
}

// ハッチ（魚倉のふた）
function hatch(k, H, z, w, l, col) {
  const y = H.deckAt(z);
  k.color(C(col)); k.box('paint', 0, y + 0.06, z, w, 0.16, l);
  k.color(C(col).multiplyScalar(0.92)); k.box('paint', 0, y + 0.16, z, w + 0.06, 0.04, l + 0.06);
  k.color(C('#7a7f84')); for (const s of [1, -1]) k.box('metal', s * w * 0.3, y + 0.19, z, 0.14, 0.02, 0.04);
}

// ---------- 漁法ごとの道具 ----------
// いか釣り: 集魚灯（船の中心に一列にぶら下がる大きな電球）と自動いか釣り機
function squidGear(k, r, H, hs) {
  const zf = H.zb - 1.7, yF = H.deckAt(zf) + 3.0, zA = H.za + 0.32, yA = H.deckAt(zA) + 3.6;
  k.color(C('#e9ebea'));
  pipe(k, 'paint', [0, H.deckAt(zf), zf], [0, yF, zf], 0.045, 10);
  lamp(k, 0, yF + 0.06, zf, '#fff7e0', 0.08);
  k.color(C('#6a6e72'));
  pipe(k, 'metal', [0, yA - 0.15, zA], [0, yF - 0.1, zf], 0.012, 5);
  const bulb = new THREE.LatheGeometry([[0, -0.2], [0.07, -0.18], [0.11, -0.1], [0.12, 0], [0.09, 0.08], [0.04, 0.12], [0.035, 0.18]].map(([x, y]) => new THREE.Vector2(x, y)), 14);
  const hat = new THREE.ConeGeometry(0.2, 0.12, 16, 1, true);
  for (let z = zA + 0.7; z < zf - 0.3; z += 0.62) {
    if (z > hs.z0 - 0.35 && z < hs.zFront + 0.4) continue;
    const t = (z - zA) / (zf - zA), yw = lerp(yA - 0.15, yF - 0.1, t) - 0.04 * Math.sin(Math.PI * t);
    k.color(C('#6a6e72'));
    pipe(k, 'metal', [-0.34, yw - 0.02, z], [0.34, yw - 0.02, z], 0.012, 5);
    for (const s of [1, -1]) {
      const x = s * 0.3, y = yw - 0.34;
      k.color(C('#5d6368')); pipe(k, 'metal', [x, yw - 0.02, z], [x, y + 0.25, z], 0.01, 4);
      k.color(C('#d9dde0')); geoAt(k, 'metal', hat, x, y + 0.24, z);
      k.color(C('#2a2c2e')); k.cyl('dark', x, y + 0.14, z, 0.04, 0.1, 8);
      k.color(C('#f1efe6')); geoAt(k, 'glass', bulb, x, y, z);
    }
  }
  // いか釣り機（両舷に並ぶ）
  const mc = C(pick(['#e9e7df', '#3c6ea8', '#e9e7df'], r));
  const zones = [[hs.zFront + 0.6, H.zb - 2.4], [H.za + 1.0, hs.z0 - 0.4]];
  for (const [za, zb] of zones) for (let z = za; z <= zb; z += 1.05) for (const s of [1, -1]) {
    const sec = H.section(z), x = s * (sec.xi - 0.22), y = H.deckAt(z, x);
    k.color(C('#8d9296')); pipe(k, 'metal', [x, y, z], [x, y + 0.55, z], 0.035);
    k.color(mc); k.box('paint', x, y + 0.72, z, 0.3, 0.34, 0.46);
    k.color(C('#6f757a')); geoAt(k, 'metal', new THREE.CylinderGeometry(0.13, 0.13, 0.12, 14), x + s * 0.22, y + 0.72, z, 0, 0, Math.PI / 2);
    k.color(C('#c9ccce'));
    const tip = [s * (sec.hb + 0.55), y + 1.05, z];
    pipe(k, 'metal', [x + s * 0.1, y + 0.82, z], tip, 0.018, 5);
    k.color(C('#e3e0d4')); geoAt(k, 'plastic', new THREE.CylinderGeometry(0.045, 0.045, 0.1, 10), tip[0], tip[1], tip[2], Math.PI / 2);
  }
}

// 一本釣り: ラインホーラー・竿立て・生け簀
function lineGear(k, r, H, hs) {
  const z = hs.zFront + 0.9, sec = H.section(z), x = -(sec.xi - 0.3), y = H.deckAt(z, x);
  k.color(C('#8d9296')); pipe(k, 'metal', [x, y, z], [x, y + 0.7, z], 0.05);
  k.color(C('#3e6fa8')); k.box('paint', x, y + 0.8, z, 0.3, 0.26, 0.3);
  k.color(C('#b9bdc0')); geoAt(k, 'metal', new THREE.CylinderGeometry(0.16, 0.16, 0.08, 18), x - 0.2, y + 0.82, z, 0, 0, Math.PI / 2);
  // 竿立て
  for (let q = 0; q < 4; q++) {
    const zz = hs.z0 - 0.5 - q * 0.9;
    if (zz < H.za + 0.8) break;
    for (const s of [1, -1]) {
      const sc = H.section(zz), xx = s * (sc.hb - 0.04);
      k.color(C('#d8dadc')); pipe(k, 'metal', [xx, sc.s - 0.3, zz], [xx, sc.s + 0.15, zz], 0.03, 8);
      if (r() < 0.4) { k.color(C('#1d1f22')); pipe(k, 'dark', [xx, sc.s + 0.1, zz], [xx + s * 0.6, sc.s + 2.4, zz - 0.9], 0.012, 5); }
    }
  }
  hatch(k, H, hs.zFront + 2.0, 0.9, 0.8, '#e6e9e4');
}

// 刺し網: 網を巻くドラム・浮き玉・ボンデン（旗竿）
function netGear(k, r, H, hs) {
  const z = H.za + 1.25, y = H.deckAt(z), R = 0.42, W = Math.min(1.8, H.section(z).xi * 1.4);
  k.color(C('#3a5a8a'));
  for (const s of [1, -1]) {
    k.box('paint', s * (W / 2 + 0.06), y + 0.45, z, 0.08, 0.9, 0.5);
    geoAt(k, 'metal', new THREE.CylinderGeometry(R + 0.08, R + 0.08, 0.03, 24), s * (W / 2 - 0.01), y + 0.62, z, 0, 0, Math.PI / 2);
  }
  k.color(C('#4d6b3c'));
  geoAt(k, 'cloth', new THREE.CylinderGeometry(R, R, W - 0.04, 24), 0, y + 0.62, z, 0, 0, Math.PI / 2);
  // 網の重なりの筋
  k.color(C('#3c5530'));
  for (let q = -3; q <= 3; q++) geoAt(k, 'cloth', new THREE.TorusGeometry(R + 0.01, 0.012, 5, 28), q * (W - 0.1) / 7, y + 0.62, z, 0, Math.PI / 2, 0);
  // 門形のやぐら
  k.color(C('#d9dcde'));
  const gy = y + 2.3, gz = H.za + 0.25, gx = H.section(gz).xi - 0.1;
  for (const s of [1, -1]) pipe(k, 'metal', [s * gx, H.deckAt(gz), gz], [s * (gx - 0.25), gy, gz], 0.05);
  pipe(k, 'metal', [-(gx - 0.25), gy, gz], [gx - 0.25, gy, gz], 0.05);
  k.color(C('#e8a33a')); geoAt(k, 'metal', new THREE.CylinderGeometry(0.12, 0.12, 0.2, 14), 0, gy - 0.14, gz, 0, 0, Math.PI / 2);
  floats(k, r, 0.55, H.deckAt(z + 1.0), z + 1.0, 9, 0.7);
  // ボンデン（操舵室の後ろに立てかける）
  for (let q = 0; q < 3; q++) {
    const x = -0.5 + q * 0.3, zz = hs.z0 - 0.25, yy = H.deckAt(zz, x);
    k.color(C('#d8c48a')); pipe(k, 'plastic', [x, yy, zz], [x + 0.05, yy + 3.4, zz + 0.12], 0.02, 6);
    k.color(C(pick(['#e03a2a', '#f0e04a', '#2f63c0'], r)));
    face(k, 'cloth', [[x + 0.05, yy + 3.35, zz + 0.12], [x + 0.05, yy + 3.35, zz - 0.45], [x + 0.045, yy + 2.95, zz - 0.45], [x + 0.045, yy + 2.95, zz + 0.1]], [1, 0, 0]);
    k.color(C('#f06a1e')); geoAt(k, 'plastic', new THREE.SphereGeometry(0.16, 14, 10), x + 0.01, yy + 0.9, zz + 0.03);
  }
}

// ---------- 船の仕様 ----------
const NAMES = ['第三 吉山丸', '幸栄丸', '第八 恵比寿丸', '宝生丸', '勝漁丸', '福徳丸', '明神丸', '第五 千代丸', '若潮丸', '清栄丸', '豊漁丸', '第二 喜久丸'];
const HULL_PAINT = [
  { top: '#f4f5f2', bottom: '#b3362c', boot: '#1d1f22', stripe: '#2d63b0', stripeR: [0.16, 0.25, -1, -1] },
  { top: '#f4f5f2', bottom: '#2e5d8a', boot: '#2e5d8a', stripe: null },
  { top: '#eaf2f5', bottom: '#b3362c', boot: '#f4f5f2', stripe: '#c43a31', stripeR: [0.16, 0.2, 0.24, 0.27] },
  { top: '#f2efe4', bottom: '#3d6b4b', boot: '#1d1f22', stripe: '#2f7a5a', stripeR: [0.16, 0.26, -1, -1] },
  { top: '#f4f5f2', bottom: '#8a3a2e', boot: '#1f4a86', stripe: '#1f4a86', stripeR: [0.16, 0.21, -1, -1] },
  { top: '#d8e9ef', bottom: '#b3362c', boot: '#1d1f22', stripe: null },
];
const KINDS = ['ika', 'line', 'net'];

export function boatSpec(r, idx = 0, kind = null) {
  kind ||= KINDS[idx % KINDS.length];
  const L = kind === 'ika' ? 12 + r() * 2.5 : kind === 'net' ? 10 + r() * 2 : 8.5 + r() * 2.5;
  const hull = new Hull({
    L, B: L * (0.26 + r() * 0.03), draft: 0.45 + L * 0.012, fb: 0.95 + L * 0.012, bow: 1.7 + L * 0.03 + r() * 0.2,
    rise: 2.3 + r() * 0.6, bh: 0.5 + r() * 0.1, tr: 0.84 + r() * 0.06,
  });
  const paint = { ...HULL_PAINT[(idx * 5 + Math.floor(r() * 3)) % HULL_PAINT.length] };
  paint.deck = pick(['#9aa89f', '#8f9ba5', '#a9a58f', '#8fae9c'], r);
  paint.inner = pick(['#e4e8e2', '#d4e6dc', '#dbe6ee'], r);
  paint.dirt = 0.6 + r() * 0.6;
  paint.scup = 1.1 + r() * 0.5;
  const house = { roof: pick(['#e8eae6', '#6f9cc4', '#8cb7a4', '#e8eae6', '#c9453a'], r), wall: pick(['#f2f3f0', '#f2f3f0', '#eef2f4'], r) };
  return {
    kind, hull, paint, house,
    name: NAMES[idx % NAMES.length], reg: 'YC2-' + (1000 + Math.floor(r() * 8999)), port: '吉山',
    sail: pick(['#f2f0e6', '#f2f0e6', '#e87a2a', '#e3c64a', '#6fa6d6'], r), sailSet: r() < 0.6, radome: r() < 0.5, seed: r(),
  };
}

export function ferrySpec() {
  return {
    kind: 'ferry',
    hull: new Hull({ L: 14.5, B: 3.9, draft: 0.75, fb: 1.35, bow: 2.2, rise: 2.2, bh: 0.55, deckRise: 0.5, tr: 0.9 }),
    paint: { top: '#f5f6f3', bottom: '#b3362c', boot: '#1f4a86', stripe: '#1f5fb0', stripeR: [0.17, 0.3, 0.34, 0.38], deck: '#8fa3b0', inner: '#eef1f0', dirt: 0.5, scup: 1.4, ink: '#1f4a86' },
    house: { wall: '#f5f6f3', roof: '#e9ebe8' },
    name: '第二 あひる丸', reg: '渡船', port: '吉山', seed: 0.37,
  };
}

// 仕様 → 部材ごとのメッシュ（船のローカル座標）
function boatMeshes(spec) {
  const H = spec.hull;
  const mats = { ...kitMaterials(), hull: hullMaterial(spec), deck: deckMaterial() };
  const k = new Kit(mats);
  k.at(new THREE.Matrix4());
  let s = Math.floor((spec.seed ?? 0.5) * 1e6) + 7;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  buildHull(k, spec);
  if (spec.kind === 'ferry') ferryTop(k, r, spec);
  else fishingTop(k, r, spec);
  return k.meshes();
}

function fishingTop(k, r, spec) {
  const H = spec.hull, kind = spec.kind;
  // 操舵室: いか釣り・一本釣りは後ろ寄り、刺し網は真ん中より前
  const hl = kind === 'ika' ? 2.2 : 1.9;
  const z0 = kind === 'net' ? H.za + H.L * 0.46 : H.za + H.L * (kind === 'ika' ? 0.22 : 0.3);
  const w = Math.min(0.95, H.section(z0).xi - 0.38);
  const hs = deckhouse(k, H, { z0, z1: z0 + hl, w, h: 1.75 + r() * 0.15, rake: 0.2, wall: spec.house.wall, roof: spec.house.roof, panes: 2 });
  roofGear(k, r, H, hs, { radome: spec.radome, mastH: kind === 'ika' ? 1.4 : 2.1, flag: kind !== 'ika' });
  // 船首の錨と、へさきの小さな手すり
  {
    const z = H.zb - 0.55, sec = H.section(z);
    k.color(C('#26282b'));
    const x = sec.hb * 0.3;
    geoAt(k, 'metal', new THREE.TorusGeometry(0.12, 0.025, 6, 12, Math.PI), x + 0.05, sec.s - 0.2, z - 0.05, 0, Math.PI / 2, Math.PI);
    pipe(k, 'metal', [x + 0.05, sec.s - 0.08, z - 0.05], [x + 0.05, sec.s - 0.32, z - 0.05], 0.02);
    if (r() < 0.5) {
      const zz = H.zb - 1.8, a = H.section(zz), b = H.section(H.zb - 0.35);
      k.color(C('#d9dcde'));
      for (const sg of [1, -1]) pipe(k, 'metal', [sg * (a.hb - 0.05), a.s + 0.5, zz], [0, b.s + 0.5, H.zb - 0.35], 0.022);
      for (const [sec2, zz2] of [[a, zz], [b, H.zb - 0.35]]) for (const sg of sec2 === b ? [0] : [1, -1]) pipe(k, 'metal', [sg * (sec2.hb - 0.05), sec2.s, zz2], [sg * (sec2.hb - 0.05), sec2.s + 0.5, zz2], 0.02);
    }
  }
  bitts(k, H, H.zb - 1.2, 0.35);
  bitts(k, H, H.za + 0.45, H.section(H.za + 0.45).xi - 0.25);
  // 漁法の道具
  if (kind === 'ika') squidGear(k, r, H, hs);
  else if (kind === 'line') lineGear(k, r, H, hs);
  else netGear(k, r, H, hs);
  spanker(k, r, H, spec.sail, spec.sailSet);
  // 前の甲板: ハッチ・魚箱・ロープ・バケツ
  if (kind !== 'line') hatch(k, H, hs.zFront + 1.1, Math.min(1.0, H.section(hs.zFront + 1.1).xi), 0.8, spec.paint.inner);
  {
    const z = hs.z0 - 0.9;
    if (kind !== 'net') fishBoxes(k, r, 0.45, H.deckAt(z, 0.45), z, 2 + Math.floor(r() * 3));
    coil(k, r, -0.5, H.deckAt(z - 0.6, -0.5), z - 0.6, pick(['#e4c24a', '#e8e6de', '#3f78c0'], r));
    const bz = hs.zFront + 0.35;
    k.color(C(pick(['#2f73b8', '#e05a2a', '#f2f2ee'], r)));
    k.cyl('plastic', 0.55, H.deckAt(bz, 0.55), bz, 0.15, 0.32, 14, 0.17);
  }
  // 古タイヤ
  const tz = [];
  for (let z = H.za + 1.3; z < nameStart(H) - 0.4; z += 1.9 + r() * 0.6) tz.push(z);
  tires(k, H, tz);
}

function ferryTop(k, r, spec) {
  const H = spec.hull;
  // 客室（長い箱・窓がずらり）と、その上の操舵室
  const z0 = H.za + 3.2, z1 = H.zb - 4.4, w = 1.42;
  const cab = deckhouse(k, H, { z0, z1, w, h: 2.05, rake: 0.25, wall: '#f5f6f3', roof: '#e9ebe8', panes: 6, frontPanes: 4, winH: 0.72, doorCol: '#1f5fb0' });
  // 窓の下の青い帯
  k.color(C('#1f5fb0'));
  for (const s of [1, -1]) k.box('paint', s * (w + 0.008), cab.yt - 0.98, (z0 + z1) / 2 - 0.1, 0.01, 0.1, z1 - z0 - 0.2);
  const wh = deckhouse(k, H, { z0: z1 - 2.3, z1: z1 - 0.35, w: 1.0, h: 1.55, rake: 0.2, base: cab.top, wall: '#f5f6f3', roof: '#1f5fb0', panes: 2, door: false });
  roofGear(k, r, H, wh, { radome: true, mastH: 2.0, flag: true });
  // 客室の屋根の手すりと救命いかだ
  {
    const y = cab.top, xa = w - 0.05;
    railing(k, [[xa, y, z0 + 0.1], [xa, y, wh.z0 - 0.1]], 0.8);
    railing(k, [[-xa, y, z0 + 0.1], [-xa, y, wh.z0 - 0.1]], 0.8);
    railing(k, [[-xa, y, z0 + 0.1], [xa, y, z0 + 0.1]], 0.8);
    k.color(C('#f4f5f2'));
    geoAt(k, 'plastic', new THREE.CapsuleGeometry(0.32, 0.9, 6, 14), 0.4, y + 0.36, z0 + 1.3, 0, 0, Math.PI / 2);
    geoAt(k, 'plastic', new THREE.CapsuleGeometry(0.32, 0.9, 6, 14), 0.4, y + 0.36, z0 + 2.3, 0, 0, Math.PI / 2);
    k.color(C('#7a8086'));
    for (const z of [z0 + 1.3, z0 + 2.3]) k.box('metal', 0.4, y + 0.03, z, 1.4, 0.06, 0.5);
    // はしご
    k.color(C('#d7dadc'));
    for (const s of [0.9, 1.25]) pipe(k, 'metal', [-s, cab.yb + 0.1, z0 - 0.08], [-s, y + 0.8, z0 - 0.08], 0.02);
    for (let q = 1; q < 8; q++) pipe(k, 'metal', [-1.25, cab.yb + q * 0.3, z0 - 0.08], [-0.9, cab.yb + q * 0.3, z0 - 0.08], 0.014);
  }
  // 救命浮環（オレンジと白）
  const ring = (x, y, z, ry) => {
    for (let q = 0; q < 8; q++) {
      k.color(C(q % 2 ? '#f4f4f0' : '#f0661e'));
      const g = new THREE.TorusGeometry(0.26, 0.06, 8, 6, Math.PI / 4).rotateZ(q * Math.PI / 4);
      geoAt(k, 'plastic', g, x, y, z, 0, ry, 0);
    }
  };
  ring(w + 0.08, cab.yb + 1.0, z0 + 0.5, Math.PI / 2);
  ring(-w - 0.08, cab.yb + 1.0, z0 + 0.5, Math.PI / 2);
  ring(0.7, cab.yb + 1.35, z0 - 0.06, 0);
  // 後ろの甲板: ベンチと手すり
  {
    const wood = C('#9a6a3c');
    for (const s of [1, -1]) {
      const zc = (H.za + 0.5 + z0 - 0.3) / 2, x = s * (H.section(zc).xi - 0.3), y = H.deckAt(zc, x);
      k.color(C('#8d9296')); for (const dz of [-0.9, 0, 0.9]) k.box('metal', x, y + 0.2, zc + dz, 0.05, 0.4, 0.05);
      k.color(wood); k.box('wood', x, y + 0.42, zc, 0.38, 0.05, 2.1);
    }
    for (const s of [1, -1]) {
      const pts = [];
      for (let z = H.za + 0.12; z <= z0; z += 0.8) { const sc = H.section(z); pts.push([s * (sc.hb - 0.04), sc.s, z]); }
      railing(k, pts, 0.45);
    }
  }
  // へさき: 舷縁に沿った手すりと、岸へ渡る踏み板（先にゴムの当て）
  {
    const zb = H.zb, sb = H.section(zb - 0.9);
    for (const s of [1, -1]) {
      const pts = [];
      for (const z of [zb - 3.2, zb - 2.2, zb - 1.3, zb - 0.6]) { const sc = H.section(z); pts.push([s * (sc.hb - 0.05), sc.s, z]); }
      railing(k, pts, 0.7, '#d7dadc', 0.9);
    }
    const z0 = zb - 1.5, y = H.sheer(H.t(zb - 0.35)) + 0.03;
    k.color(C('#8fa3b0')); k.box('deck', 0, y, z0 + 0.8, 0.8, 0.05, 1.6);
    k.color(C('#d7dadc'));
    for (const s of [1, -1]) pipe(k, 'metal', [s * 0.38, y, zb + 0.02], [s * 0.38, y + 0.7, zb + 0.02], 0.022);
    pipe(k, 'metal', [-0.38, y + 0.7, zb + 0.02], [0.38, y + 0.7, zb + 0.02], 0.022);
    pipe(k, 'metal', [-0.38, y + 0.7, zb + 0.02], [-(H.section(zb - 0.6).hb - 0.05), y + 0.68, zb - 0.6], 0.022);
    pipe(k, 'metal', [0.38, y + 0.7, zb + 0.02], [H.section(zb - 0.6).hb - 0.05, y + 0.68, zb - 0.6], 0.022);
    k.color(C('#1c1d1f')); k.box('rubber', 0, y - 0.1, zb + 0.08, 0.8, 0.2, 0.14);
    bitts(k, H, zb - 2.0, sb.xi - 0.3);
  }
  bitts(k, H, H.za + 0.5, H.section(H.za + 0.5).xi - 0.3);
  // 客室の横に「渡船」の文字（両側）
  {
    const t = ferryBoard();
    const mat = 'ferryBoard';
    k.mats[mat] ||= new THREE.MeshStandardMaterial({ map: t, roughness: 0.5 });
    k.color(C('#ffffff'));
    // 客室の屋根の手すりに付けた看板
    for (const s of [1, -1]) {
      const zc = (z0 + wh.z0) / 2, yc = cab.top + 0.42, L = Math.min(3.4, wh.z0 - z0 - 0.4), hgt = L * 148 / 1024, x = s * (w - 0.02);
      const pts = [[x, yc - hgt / 2, zc + s * L / 2], [x, yc - hgt / 2, zc - s * L / 2], [x, yc + hgt / 2, zc - s * L / 2], [x, yc + hgt / 2, zc + s * L / 2]];
      k.color(C('#ffffff')); k.face(mat, pts, [[0, 0], [1, 0], [1, 1], [0, 1]]);
      k.color(C('#f5f6f3')); k.box('paint', x - s * 0.02, yc, zc, 0.03, hgt + 0.04, L + 0.04);
    }
  }
  tires(k, H, [H.za + 1.5, H.za + 4.2, H.za + 6.9, nameStart(H) - 0.45]);
}

let BOARD = null;
function ferryBoard() {
  if (BOARD) return BOARD;
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 148;
  const g = c.getContext('2d');
  g.fillStyle = '#f5f6f3'; g.fillRect(0, 0, 1024, 148);
  g.fillStyle = '#1f4a86'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = '900 96px "Zen Kaku Gothic New", "Yu Gothic", sans-serif';
  g.fillText('アヒル島 渡船', 512, 78);
  BOARD = new THREE.CanvasTexture(c);
  BOARD.colorSpace = THREE.SRGBColorSpace;
  BOARD.anisotropy = 8;
  return BOARD;
}

let DECK = null;
function deckMaterial() { return (DECK ||= texMat('concrete', { roughness: 1 })); }

// ---------- 並べて浮かべる ----------
// items: { spec, x, z, yaw, y?, ph?, amp? }。同じ仕様の船はインスタンスで描き、波に合わせて揺らす
const DESIGNS = new Map();
export function buildFleet(items) {
  const group = new THREE.Group();
  group.name = 'boats';
  const by = new Map();
  for (const it of items) { if (!by.has(it.spec)) by.set(it.spec, []); by.get(it.spec).push(it); }
  const sets = [];
  for (const [spec, list] of by) {
    if (!DESIGNS.has(spec)) DESIGNS.set(spec, boatMeshes(spec));
    const attr = new THREE.InstancedBufferAttribute(new Float32Array(list.length * 16), 16);
    attr.setUsage(THREE.DynamicDrawUsage);
    const ims = DESIGNS.get(spec).map((m) => {
      const im = new THREE.InstancedMesh(m.geometry, m.material, list.length);
      im.instanceMatrix = attr;
      im.castShadow = m.castShadow; im.receiveShadow = true;
      im.name = 'boat:' + m.name;
      group.add(im);
      return im;
    });
    sets.push({ list, attr, ims });
  }
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), S = new THREE.Vector3(1, 1, 1), P = new THREE.Vector3();
  const update = (t) => {
    for (const s of sets) {
      s.list.forEach((b, i) => {
        const ph = b.ph ?? 0, amp = b.amp ?? 1;
        E.set(Math.sin(t * 0.55 + ph * 1.3) * 0.012 * amp, b.yaw + Math.sin(t * 0.21 + ph) * 0.006 * amp, Math.sin(t * 0.7 + ph) * 0.022 * amp, 'YXZ');
        P.set(b.x, (b.y ?? 0) + Math.sin(t * 0.9 + ph) * 0.05 * amp, b.z);
        M.compose(P, Q.setFromEuler(E), S).toArray(s.attr.array, i * 16);
      });
      s.attr.needsUpdate = true;
    }
  };
  update(0);
  for (const s of sets) for (const im of s.ims) { im.computeBoundingSphere(); im.boundingSphere.radius += 0.5; }
  group.userData.update = update;
  return group;
}

// 船のローカル座標の点 → 世界座標（揺れは無視）
export function boatPoint(it, lx, ly, lz) {
  const c = Math.cos(it.yaw), s = Math.sin(it.yaw);
  return [it.x + lx * c + lz * s, (it.y ?? 0) + ly, it.z - lx * s + lz * c];
}

// 舫い綱と岸のビット（町の組み立て用 Kit に積む。a = 船の舷縁、b = 岸の地面）
export function mooring(k, a, b) {
  k.at(new THREE.Matrix4()).chunk(b[0], b[2]);
  k.color(C('#34373a'));
  k.cyl('metal', b[0], b[1] - 0.05, b[2], 0.12, 0.45, 12);
  geoAt(k, 'metal', new THREE.SphereGeometry(0.15, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.6, 1), b[0], b[1] + 0.4, b[2]);
  k.color(C('#ddd6c2'));
  const L = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  rope(k, a, [b[0], b[1] + 0.3, b[2]], Math.min(0.5, L * 0.06), 0.018, 10);
}
