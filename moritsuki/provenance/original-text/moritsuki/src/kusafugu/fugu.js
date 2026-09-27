// フグのモデル（クサフグ・ヒガンフグ・ショウサイフグ・トラフグ）
// ・体は背・腹・幅の輪郭カーブから断面を積み上げて作る（全長 = 1。吻端が +z、背が +y、右が +x）
// ・ふくらんだ形（腹が球になる）も同じ頂点の並びで作っておき、シェーダーで切りかえる（uPuff）
// ・眼は出っぱった玉。虹彩・瞳はシェーダーで描き、瞳はヘッドライトを照り返して赤く光る（輝板）
// ・模様（斑点・網目・虫食い・トラフグの黒い紋）もシェーダーで。体の座標（s = 吻端からの距離、th = 背から回った角度）で描くので、ふくらむと模様も伸びる
// ・胸鰭・背鰭・尻鰭・尾鰭は別の板。フグは体をくねらせず、鰭をぱたぱたさせて泳ぐ
import * as THREE from 'three';
import { patchMaterial } from './shade.js';
import { clamp, lerp, smoothstep } from './core/noise.js';

const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

// ───────── 単調な 3 次補間（輪郭の制御点を行き過ぎずに結ぶ） ─────────
function curve(pts) {
  const n = pts.length;
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const d = [], m = new Array(n);
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  m[0] = d[0]; m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i], h = a * a + b * b;
    if (h > 9) { const t = 3 / Math.sqrt(h); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; }
  }
  return (x) => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0;
    while (x > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i], t = (x - xs[i]) / h, t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1];
  };
}

// ───────── 体形（全長 = 1 の側面図と幅） ─────────
// top: 体軸から背までの高さ、bot: 腹までの深さ、wid: 体の半幅（s = 吻端からの距離）
// body: 尾鰭の付け根の s。eye: 眼の位置 [s, 背からの角度, 半径]。puff: ふくらんだ球 [中心の s, 半径, 中心の高さ]
const SHAPES = {
  kusa: {
    top: [[0, 0.016], [0.03, 0.04], [0.07, 0.066], [0.12, 0.088], [0.19, 0.1], [0.27, 0.104], [0.36, 0.099], [0.46, 0.085], [0.56, 0.064], [0.65, 0.043], [0.73, 0.03], [0.8, 0.026]],
    bot: [[0, 0.018], [0.03, 0.04], [0.08, 0.068], [0.15, 0.092], [0.24, 0.106], [0.32, 0.106], [0.42, 0.093], [0.52, 0.07], [0.61, 0.047], [0.7, 0.031], [0.8, 0.024]],
    wid: [[0, 0.015], [0.03, 0.043], [0.07, 0.072], [0.13, 0.095], [0.2, 0.103], [0.28, 0.1], [0.37, 0.089], [0.47, 0.072], [0.57, 0.052], [0.66, 0.034], [0.74, 0.022], [0.8, 0.018]],
    body: 0.8, eye: [0.165, 0.9, 0.026], puff: [0.33, 0.215, -0.02],
    round: 0.82,
  },
  higan: {
    top: [[0, 0.018], [0.03, 0.044], [0.07, 0.072], [0.12, 0.095], [0.19, 0.108], [0.27, 0.112], [0.36, 0.106], [0.46, 0.09], [0.56, 0.067], [0.65, 0.045], [0.73, 0.032], [0.8, 0.027]],
    bot: [[0, 0.02], [0.03, 0.044], [0.08, 0.074], [0.15, 0.098], [0.24, 0.112], [0.32, 0.112], [0.42, 0.098], [0.52, 0.074], [0.61, 0.05], [0.7, 0.032], [0.8, 0.025]],
    wid: [[0, 0.016], [0.03, 0.042], [0.07, 0.07], [0.13, 0.093], [0.2, 0.104], [0.28, 0.105], [0.37, 0.095], [0.47, 0.077], [0.57, 0.055], [0.66, 0.036], [0.74, 0.023], [0.8, 0.019]],
    body: 0.8, eye: [0.17, 0.8, 0.025], puff: [0.33, 0.225, -0.02],
    round: 0.8,
  },
  shosai: {
    top: [[0, 0.014], [0.03, 0.034], [0.07, 0.056], [0.12, 0.076], [0.19, 0.088], [0.27, 0.092], [0.36, 0.088], [0.46, 0.077], [0.56, 0.059], [0.65, 0.041], [0.73, 0.029], [0.8, 0.025]],
    bot: [[0, 0.016], [0.03, 0.036], [0.08, 0.06], [0.15, 0.082], [0.24, 0.095], [0.32, 0.096], [0.42, 0.085], [0.52, 0.064], [0.61, 0.044], [0.7, 0.029], [0.8, 0.023]],
    wid: [[0, 0.013], [0.03, 0.034], [0.07, 0.058], [0.13, 0.078], [0.2, 0.088], [0.28, 0.089], [0.37, 0.081], [0.47, 0.066], [0.57, 0.048], [0.66, 0.032], [0.74, 0.021], [0.8, 0.017]],
    body: 0.8, eye: [0.16, 0.8, 0.024], puff: [0.34, 0.205, -0.018],
    round: 0.86,
  },
  tora: {
    top: [[0, 0.02], [0.03, 0.046], [0.07, 0.074], [0.12, 0.096], [0.19, 0.108], [0.27, 0.11], [0.36, 0.103], [0.46, 0.087], [0.56, 0.064], [0.65, 0.043], [0.73, 0.03], [0.8, 0.026]],
    bot: [[0, 0.02], [0.03, 0.042], [0.08, 0.07], [0.15, 0.092], [0.24, 0.104], [0.32, 0.104], [0.42, 0.092], [0.52, 0.07], [0.61, 0.047], [0.7, 0.031], [0.8, 0.024]],
    wid: [[0, 0.017], [0.03, 0.044], [0.07, 0.072], [0.13, 0.094], [0.2, 0.104], [0.28, 0.104], [0.37, 0.094], [0.47, 0.076], [0.57, 0.054], [0.66, 0.035], [0.74, 0.022], [0.8, 0.018]],
    body: 0.8, eye: [0.16, 0.84, 0.021], puff: [0.33, 0.21, -0.02],
    round: 0.8,
  },
};
const Z0 = 0.4;            // 模型の原点（体のまん中）の s。z = Z0 - s
const zOf = (s) => Z0 - s;

// 色（sRGB で書き、three.js がリニアへ直す）: 背・斑点・腹・差し色・鰭・虹彩
const COLORS = {
  kusa: { back: '#4f5236', spot: '#e0dcc2', belly: '#f1efe6', accent: '#b9a95a', fin: '#b6a768', iris: '#9c9140' },
  higan: { back: '#a8894a', spot: '#3d2b1b', belly: '#f0ede4', accent: '#c9a24c', fin: '#c8a651', iris: '#c3a23e' },
  shosai: { back: '#b9a986', spot: '#6f5f47', belly: '#f3f1ea', accent: '#d2c29c', fin: '#d5c9a8', iris: '#b9ae63' },
  tora: { back: '#2f3336', spot: '#8b9092', belly: '#f2f1ec', accent: '#161718', fin: '#232628', iris: '#8fa05a' },
};
const SPECIES_KEY = { kusa: 0, higan: 1, shosai: 2, tora: 3 };

// ───────── 形の計算 ─────────
class Form {
  constructor(id) {
    const S = (this.S = SHAPES[id]);
    this.top = curve(S.top); this.bot = curve(S.bot); this.wid = curve(S.wid);
    this.body = S.body;
    const [pc, pr, py] = S.puff;
    this.pc = pc; this.pr = pr; this.py = py;
  }
  /** 断面の大きさ（puff = 0..1。ふくらむのは腹が大きく、背は少し） */
  radii(s, puff) {
    let t = this.top(s), b = this.bot(s), w = this.wid(s);
    if (puff > 0) {
      const ds = (s - this.pc) / this.pr;
      const k = Math.max(0, 1 - ds * ds);
      if (k > 0) {
        const r = this.pr * Math.sqrt(k);
        // 頭と尾の側は元の形になめらかに戻す
        const blend = smoothstep(0, 0.35, k);
        t = lerp(t, Math.max(t, this.py + r * 0.93), blend * puff);
        b = lerp(b, Math.max(b, -this.py + r * 1.05), blend * puff);
        w = lerp(w, Math.max(w, r), blend * puff);
      }
    }
    return [t, b, w];
  }
  /** 断面の点（th: 背 = 0、右 = +π/2、腹 = ±π）。返すのは [x, y] と外向き */
  point(s, th, puff, out = V3()) {
    const [t, b, w] = this.radii(s, puff);
    const p = this.S.round;
    const cy = Math.cos(th), sx = Math.sin(th);
    const y = cy >= 0 ? t * Math.pow(cy, p) : -b * Math.pow(-cy, p * 0.92);
    const x = w * Math.sign(sx) * Math.pow(Math.abs(sx), p);
    out.set(x, y, zOf(s));
    // 眼のまわりの盛り上がり（フグの眼は頭の上に出っぱる）
    const [es, eth, er] = this.S.eye;
    for (const sg of [1, -1]) {
      const dth = (th - sg * eth);
      const dd = ((s - es) / (er * 1.5)) ** 2 + ((dth * 0.1) / (er * 1.5)) ** 2;
      if (dd < 9) {
        const k = Math.exp(-dd) * er * 0.42 * (1 - puff * 0.4);
        const rl = Math.hypot(out.x, out.y) || 1;
        out.x += (out.x / rl) * k; out.y += (out.y / rl) * k;
      }
    }
    return out;
  }
  /** 体の表面の点と外向き（眼・鰭の付け根） */
  anchor(s, th, puff) {
    const p = this.point(s, th, puff);
    const e = 0.004;
    const a = this.point(s, th + e, puff), b = this.point(s, th - e, puff);
    const c = this.point(s + e, th, puff), d = this.point(s - e, th, puff);
    const tu = a.sub(b), tv = c.sub(d);
    const n = new THREE.Vector3().crossVectors(tv, tu).normalize();
    if (n.dot(V3(p.x, p.y, 0)) < 0) n.negate();
    return { p, n };
  }
}
const forms = {};
const formOf = (id) => (forms[id] ||= new Form(id));

// ───────── 体のジオメトリ ─────────
const geoCache = new Map();
function bodyGeometry(id, lod) {
  const key = `${id}|${lod}`;
  if (geoCache.has(key)) return geoCache.get(key);
  const F = formOf(id);
  const NU = lod ? 30 : 64, NV = lod ? 22 : 44;
  const rows = [];
  for (let i = 0; i <= NU; i++) {
    const u = i / NU;
    rows.push(F.body * (u * u * 0.3 + u * 0.7));
  }
  const nV = (NU + 1) * (NV + 1) + 2;
  const P0 = new Float32Array(nV * 3), P1 = new Float32Array(nV * 3), B = new Float32Array(nV * 3);
  const tmp = V3();
  let k = 0;
  const put = (arr, v) => { arr[k * 3] = v.x; arr[k * 3 + 1] = v.y; arr[k * 3 + 2] = v.z; };
  for (let i = 0; i <= NU; i++) {
    const s = rows[i];
    for (let j = 0; j <= NV; j++) {
      const th = -Math.PI + (j / NV) * Math.PI * 2;
      put(P0, F.point(s, th, 0, tmp));
      put(P1, F.point(s, th, 1, tmp));
      B[k * 3] = s; B[k * 3 + 1] = th; B[k * 3 + 2] = 0;
      k++;
    }
  }
  // 吻端と尾の付け根のふた
  const capA = k;
  {
    const s = -0.006;
    for (const [arr, puff] of [[P0, 0], [P1, 1]]) {
      const [t, b] = F.radii(0, puff);
      tmp.set(0, (t - b) * 0.5, zOf(s));
      put(arr, tmp);
    }
    B[k * 3] = 0; B[k * 3 + 1] = 0; B[k * 3 + 2] = 1;
    k++;
  }
  const capB = k;
  {
    const s = F.body + 0.004;
    for (const [arr, puff] of [[P0, 0], [P1, 1]]) {
      const [t, b] = F.radii(F.body, puff);
      tmp.set(0, (t - b) * 0.5, zOf(s));
      put(arr, tmp);
    }
    B[k * 3] = F.body; B[k * 3 + 1] = 0; B[k * 3 + 2] = 2;
    k++;
  }
  const idx = [];
  for (let i = 0; i < NU; i++) {
    for (let j = 0; j < NV; j++) {
      const a = i * (NV + 1) + j, c = a + NV + 1;
      idx.push(a, a + 1, c, c, a + 1, c + 1);
    }
  }
  for (let j = 0; j < NV; j++) idx.push(capA, j + 1, j);
  const last = NU * (NV + 1);
  for (let j = 0; j < NV; j++) idx.push(capB, last + j, last + j + 1);
  const normals = (P) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(P, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    const N = g.attributes.normal.array;
    // 腹の継ぎ目（th = ±π）の法線をそろえる
    for (let i = 0; i <= NU; i++) {
      const a = i * (NV + 1), b = a + NV;
      for (let c = 0; c < 3; c++) { const m = (N[a * 3 + c] + N[b * 3 + c]) / 2; N[a * 3 + c] = N[b * 3 + c] = m; }
    }
    return N;
  };
  const N0 = normals(P0), N1 = normals(P1);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(P0, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(N0, 3));
  geo.setAttribute('aPuffPos', new THREE.BufferAttribute(P1, 3));
  geo.setAttribute('aPuffNrm', new THREE.BufferAttribute(N1, 3));
  geo.setAttribute('aBody', new THREE.BufferAttribute(B, 3));
  geo.setIndex(idx);
  // ふくらんだ時の大きさで囲む
  const box = new THREE.Box3().setFromBufferAttribute(geo.attributes.aPuffPos);
  box.union(new THREE.Box3().setFromBufferAttribute(geo.attributes.position));
  geo.boundingBox = box;
  geo.boundingSphere = box.getBoundingSphere(new THREE.Sphere());
  geoCache.set(key, geo);
  return geo;
}

// ───────── 鰭のジオメトリ（aFin: x = 横の割合 0..1, y = 付け根からの割合 0..1） ─────────
function finGeo(build) {
  const pos = [], fin = [], idx = [];
  const { strips, rings } = build;
  for (let a = 0; a < strips.length; a++) {
    const [B, O] = strips[a];
    for (let r = 0; r <= rings; r++) {
      const t = r / rings;
      pos.push(lerp(B[0], O[0], t), lerp(B[1], O[1], t), lerp(B[2], O[2], t));
      fin.push(a / (strips.length - 1), t);
    }
  }
  for (let a = 0; a < strips.length - 1; a++) {
    for (let r = 0; r < rings; r++) {
      const i0 = a * (rings + 1) + r, i1 = (a + 1) * (rings + 1) + r;
      idx.push(i0, i1, i0 + 1, i1, i1 + 1, i0 + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aFin', new THREE.Float32BufferAttribute(fin, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
// 胸鰭: 付け根は縦の線（y）、鰭は後ろ（-z）へ扇に開く
function pectoralGeo(h, len) {
  const strips = [];
  const N = 12, fmax = 1.25;
  for (let i = 0; i <= N; i++) {
    const u = i / N, f = lerp(fmax, -fmax, u);
    const B = [0, (h / 2) * (f / fmax), 0];
    const r = len * (0.62 + 0.38 * Math.cos(f * 0.85)) * (1 + 0.08 * Math.sin(u * Math.PI));
    strips.push([B, [0, B[1] + Math.sin(f) * r * 0.85, -Math.cos(f) * r]]);
  }
  return finGeo({ strips, rings: 3 });
}
// 背鰭・尻鰭: 付け根は体の上（下）の線（z）、鰭は上（下）後ろへ
function medianGeo(len, H, sg) {
  const strips = [];
  const N = 8;
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    const B = [0, 0, -u * len];
    const h = H * Math.pow(Math.sin(Math.PI * (0.12 + 0.88 * u) * 0.55 + 0.35), 1.2) * (1 - u * 0.35);
    strips.push([B, [0, sg * h, B[2] - 0.03 - u * 0.035]]);
  }
  return finGeo({ strips, rings: 3 });
}
// 尾鰭: 付け根は尾柄の縦の線、鰭は後ろへ。後ろの縁はゆるい丸
function caudalGeo(hb, H, len) {
  const strips = [];
  const N = 14;
  for (let i = 0; i <= N; i++) {
    const u = i / N, v = u * 2 - 1;
    const B = [0, hb * v, 0];
    strips.push([B, [0, H * v * (1 - 0.06 * v * v), -len * (0.93 + 0.07 * Math.cos(v * 1.4))]]);
  }
  return finGeo({ strips, rings: 4 });
}

// ───────── 材質 ─────────
const BODY_GLSL = /* glsl */ `
uniform float uPuff; uniform float uSand; uniform float uWet; uniform float uSeed; uniform float uSpecies; uniform vec3 uEye;
uniform vec3 uBack; uniform vec3 uSpot; uniform vec3 uBelly; uniform vec3 uAccent;
varying vec3 vBody;
// 斑点（セルごとに 1 つ）: 近い斑点の中なら 1
float kfSpots(vec2 q, float cs, float r0, float r1, float seed) {
  vec2 c = floor(q / cs);
  float m = 0.0;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 g = c + vec2(float(x), float(y));
    vec2 o = hm_h22(g + seed) * 0.8 + 0.1;
    float r = mix(r0, r1, hm_h21(g + seed * 1.7));
    float d = length(q - (g + o) * cs);
    m = max(m, 1.0 - smoothstep(r * 0.72, r, d));
  }
  return m;
}
// ボロノイ: x = いちばん近い点まで、y = 2 番目との差（境目の近さ）
vec2 kfVoro(vec2 q, float seed) {
  vec2 ip = floor(q), fp = fract(q);
  float d1 = 8.0, d2 = 8.0;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 g = vec2(float(x), float(y));
    vec2 o = hm_h22(ip + g + seed);
    float d = length(g + o - fp);
    if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
  }
  return vec2(d1, d2 - d1);
}
`;

const matCache = {};
function bodyMaterial(id) {
  const C = COLORS[id];
  const uniforms = {
    uPuff: { value: 0 }, uSand: { value: 0 }, uWet: { value: 1 }, uSeed: { value: 0 }, uEye: { value: new THREE.Vector3(...SHAPES[id].eye) },
    uSpecies: { value: SPECIES_KEY[id] },
    uBack: { value: new THREE.Color(C.back) }, uSpot: { value: new THREE.Color(C.spot) },
    uBelly: { value: new THREE.Color(C.belly) }, uAccent: { value: new THREE.Color(C.accent) },
  };
  const m = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.42, metalness: 0 });
  patchMaterial(m, {
    caustics: true,
    uniforms,
    fx: {
      key: 'fugu-' + id,
      vdecl: 'attribute vec3 aPuffPos; attribute vec3 aPuffNrm; attribute vec3 aBody; uniform float uPuff; varying vec3 vBody;',
      vnormal: 'objectNormal = normalize(mix(objectNormal, aPuffNrm, uPuff));',
      vcode: 'transformed = mix(transformed, aPuffPos, uPuff); vBody = aBody;',
      decl: BODY_GLSL,
      color: /* glsl */ `
        {
          float s = vBody.x, th = vBody.y;
          float up = cos(th);
          float side = sign(sin(th) + 1e-4);
          // 体の表面の、ほぼ等しい長さの座標（周の向きは体の太さで縮める）
          vec2 q = vec2(s, th * 0.095);
          vec2 qs = vec2(s, abs(th) * 0.095);  // 左右で模様を写さず、別々に
          float seed = uSeed * 17.0 + (side > 0.0 ? 0.0 : 31.0);
          // 背と腹の境目（ゆるく波打つ）
          float edge = -0.18 + 0.07 * sin(s * 38.0 + seed) + 0.05 * (hm_vn(q * 30.0 + seed) - 0.5);
          float belly = smoothstep(edge + 0.06, edge - 0.14, up);
          vec3 back = uBack;
          // 背のすじ（背の真ん中が少し濃い）
          back *= 0.82 + 0.18 * smoothstep(1.0, 0.55, up) + 0.1 * (hm_vn(q * 18.0 + seed) - 0.5);
          vec3 col = back;
          if (uSpecies < 0.5) {
            // クサフグ: 暗い緑褐色に、白い小さな斑点がびっしり。腹との境目に黄色み
            float sp = kfSpots(q + vec2(seed * 0.01, 0.0), 0.024, 0.0045, 0.0092, seed);
            col = mix(col, uSpot, sp * 0.92 * smoothstep(-0.35, 0.1, up));
            col = mix(col, uAccent, smoothstep(0.1, 0.0, abs(up - edge - 0.03)) * 0.35);
          } else if (uSpecies < 1.5) {
            // ヒガンフグ: 黄土色の地に、こげ茶の不定形の斑紋が網のようにつながる。白い小さな点がまじる
            vec2 v = kfVoro(q * 26.0, seed);
            float blot = smoothstep(0.62, 0.32, v.x + (hm_vn(q * 60.0 + seed) - 0.5) * 0.35);
            col = mix(col, uSpot, blot * 0.85);
            col = mix(col, uAccent, smoothstep(0.08, 0.0, v.y) * 0.4);
            float dots = kfSpots(q, 0.02, 0.003, 0.0045, seed + 5.0);
            col = mix(col, vec3(0.92, 0.9, 0.82), dots * 0.55 * smoothstep(-0.3, 0.2, up));
          } else if (uSpecies < 2.5) {
            // ショウサイフグ: うすい砂色に、こまかい虫食いの線。胸鰭のうしろに、ぼんやり濃い所
            float n = hm_fbm(q * 70.0 + seed);
            float worm = smoothstep(0.05, 0.0, abs(n - 0.5)) * 0.75;
            col = mix(col, uSpot, worm);
            float saddle = exp(-pow((s - 0.36) / 0.08, 2.0)) * smoothstep(-0.2, 0.5, up);
            col = mix(col, uSpot * 0.85, saddle * 0.35);
          } else {
            // トラフグ: 黒っぽい灰色に白っぽい小さな斑。胸鰭の後ろに白くふちどられた大きな黒い紋
            float sp = kfSpots(q, 0.03, 0.005, 0.009, seed);
            col = mix(col, uSpot, sp * 0.28 * smoothstep(-0.2, 0.4, up));
            vec2 d = vec2((s - 0.38) / 0.058, (up - 0.12) / 0.3);
            float wob = (hm_vn(vec2(atan(d.y, d.x) * 2.0, seed)) - 0.5) * 0.25;
            float r = length(d) + wob;
            float ring = smoothstep(1.2, 1.1, r) * smoothstep(0.92, 1.02, r);
            float blot = smoothstep(1.0, 0.9, r);
            col = mix(col, vec3(0.5, 0.5, 0.47), ring * 0.55);
            col = mix(col, uAccent, blot * 0.85);
            // 背にも、ぼんやり黒いまだら
            col *= 1.0 - 0.3 * smoothstep(0.55, 0.75, hm_fbm(q * 18.0 + seed)) * smoothstep(-0.1, 0.4, up);
          }
          col = mix(col, uBelly, belly);
          // ふくらむと、腹の小さなとげが見える（白い地に、うすい灰色の点）
          float spin = kfSpots(q * 1.0, 0.013, 0.0016, 0.0024, 3.0) * belly * uPuff;
          col = mix(col, vec3(0.62, 0.62, 0.6), spin * 0.5);
          // 口: 吻端の小さなくちばし（少し明るい唇と、横一文字の暗い口）
          float mouthK = smoothstep(0.026, 0.01, s) * smoothstep(0.75, 0.2, abs(up + 0.15));
          col = mix(col, vec3(0.62, 0.6, 0.54), mouthK * 0.45);
          col = mix(col, vec3(0.05, 0.045, 0.04), smoothstep(0.012, 0.004, s) * smoothstep(0.16, 0.04, abs(up + 0.15)) * step(abs(th), 2.6));
          // 鰓あな（胸鰭の前の小さな黒い切れ目）
          float gill = exp(-pow((s - 0.255) / 0.006, 2.0) - pow((abs(th) - 1.5) / 0.14, 2.0));
          col = mix(col, vec3(0.03), gill * 0.8);
          // 砂をかぶっている（もぐっていた時）
          if (uSand > 0.001) {
            // もぐっている時は、眼のまわり以外は砂がかぶる（砂の粒のまだら）。出てきた後は、まだらに残る
            float g = hm_h21(floor(q * 900.0) + seed);
            float patchy = smoothstep(0.25, 0.75, hm_vn(q * 90.0 + seed) + g * 0.3);
            float eyeD = length(vec2((s - uEye.x) / uEye.z, (abs(th) - uEye.y) * 0.1 / uEye.z));
            float cover = mix(patchy, 1.0 - smoothstep(1.2, 2.4, 3.6 - eyeD) * 0.85, smoothstep(0.7, 1.0, uSand));
            float sm = uSand * smoothstep(-0.7, -0.2, up) * cover;
            col = mix(col, vec3(0.33, 0.27, 0.16) * (0.75 + g * 0.5), clamp(sm, 0.0, 1.0));
          }
          diffuseColor.rgb = col;
        }`,
      rough: `roughnessFactor = mix(0.72, 0.28, uWet) + uPuff * 0.06;`,
    },
  });
  m.userData.uniforms = uniforms;
  return m;
}

function finMaterial(id) {
  const key = 'fin-' + id;
  if (matCache[key]) return matCache[key];
  const C = COLORS[id];
  const uniforms = { uFinCol: { value: new THREE.Color(C.fin) }, uFinKind: { value: SPECIES_KEY[id] } };
  // 奥行きは書く（書かないと、水面の処理が鰭の所を「水の下の砂」とみなして屈折でずらし、透明なコピーのように見える）
  const m = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.35, side: THREE.DoubleSide, transparent: true, depthWrite: true });
  patchMaterial(m, {
    caustics: true,
    uniforms,
    fx: {
      key,
      vdecl: 'attribute vec2 aFin; varying vec2 vFin;',
      vcode: 'vFin = aFin;',
      decl: 'uniform vec3 uFinCol; uniform float uFinKind; varying vec2 vFin;',
      color: /* glsl */ `
        {
          float a = vFin.x, t = vFin.y;
          // 鰭条（放射状の筋）と、膜（すけている）
          float ray = smoothstep(0.3, 0.0, abs(fract(a * 13.0) - 0.5) * 2.0 - 0.45);
          vec3 col = uFinCol * (0.75 + 0.35 * ray);
          col *= 0.85 + 0.25 * t;
          // トラフグの尻鰭は白っぽい（ここでは鰭の種類を持たないので、ふちを少し明るく）
          col = mix(col, vec3(0.95, 0.93, 0.86), smoothstep(0.8, 1.0, t) * 0.25);
          diffuseColor.rgb = col;
          diffuseColor.a = mix(0.9, 0.55, smoothstep(0.2, 1.0, t)) * (0.7 + 0.3 * ray);
        }`,
    },
  });
  matCache[key] = m;
  return m;
}

// 眼: 玉の +z が眼の向く方向。瞳（黒）・虹彩（金緑）・まわりの皮膚
// 瞳の奥の輝板がヘッドライトを照り返して赤く光る（光る点は shine.js でも描く。ここは近くで見たとき）
function eyeMaterial(id) {
  const key = 'eye-' + id;
  if (matCache[key]) return matCache[key];
  const C = COLORS[id];
  const uniforms = { uIris: { value: new THREE.Color(C.iris) }, uRim: { value: new THREE.Color(C.back) } };
  const m = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.06, metalness: 0 });
  patchMaterial(m, {
    caustics: true,
    uniforms,
    fx: {
      key,
      vdecl: 'varying vec3 vEyeN; varying vec3 vAxisW;',
      vcode: 'vEyeN = normalize(position); vAxisW = normalize(mat3(modelMatrix) * vec3(0.0, 0.0, 1.0));',
      decl: 'uniform vec3 uIris; uniform vec3 uRim; varying vec3 vEyeN; varying vec3 vAxisW; float kfPupil;',
      color: /* glsl */ `
        {
          float c = vEyeN.z;
          float ang = acos(clamp(c, -1.0, 1.0));
          // 瞳は少し横長
          float pa = length(vec2(vEyeN.x * 0.8, vEyeN.y * 1.15));
          kfPupil = smoothstep(0.47, 0.41, pa) * step(0.0, c);
          float iris = smoothstep(1.02, 0.92, ang);
          vec3 ir = uIris * (0.7 + 0.5 * hm_vn(vec2(atan(vEyeN.y, vEyeN.x) * 6.0, ang * 20.0)));
          ir = mix(ir * 0.55, ir, smoothstep(0.3, 0.6, ang));
          vec3 col = mix(uRim * 0.8, ir, iris);
          col = mix(col, vec3(0.012, 0.012, 0.015), kfPupil);
          diffuseColor.rgb = col;
        }`,
      light: /* glsl */ `
        {
          // 輝板の照り返し: ライトが眼の向く方にあるほど強い（どのフグも同じ）
          vec3 toH = normalize(uHeadPos - vWPos);
          float lobe = pow(max(dot(normalize(vAxisW), toH), 0.0), 1.6);
          float I = headIrr(vWPos) * lobe * kfPupil;
          reflectedLight.directDiffuse += vec3(1.0, 0.2, 0.08) * I * 2.6;
        }`,
    },
  });
  matCache[key] = m;
  return m;
}

// ───────── 1 匹 ─────────
export class Fugu {
  /**
   * id: 種類、cm: 全長、seed: 模様の乱数
   * opts.lod: 軽い形（バケツの中など）
   */
  constructor(id, cm, seed = 0.5, opts = {}) {
    this.id = id;
    this.cm = cm;
    this.L = cm / 100;
    this.seed = seed;
    const F = (this.F = formOf(id));
    this.group = new THREE.Group();
    this.group.scale.setScalar(this.L);
    // 体
    this.mat = bodyMaterial(id);
    this.u = this.mat.userData.uniforms;
    this.u.uSeed.value = seed;
    this.body = new THREE.Mesh(bodyGeometry(id, opts.lod ? 1 : 0), this.mat);
    this.group.add(this.body);
    // 眼
    const [es, eth, er] = F.S.eye;
    this.eyeR = er;
    this.eyes = [1, -1].map((sg) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(er, opts.lod ? 10 : 18, opts.lod ? 8 : 14), eyeMaterial(id));
      this.group.add(m);
      const a0 = F.anchor(es, sg * eth, 0), a1 = F.anchor(es, sg * eth, 1);
      return { m, sg, a0, a1 };
    });
    // 鰭
    const fm = finMaterial(id);
    const [pt] = F.radii(0.27, 0);
    this.pecs = [1, -1].map((sg) => {
      const g = new THREE.Group();
      const m = new THREE.Mesh(pectoralGeo(0.042, 0.068), fm);
      g.add(m);
      if (sg < 0) g.scale.x = -1;
      this.group.add(g);
      return { g, sg, a0: F.anchor(0.27, sg * 1.52, 0), a1: F.anchor(0.27, sg * 1.52, 1) };
    });
    void pt;
    const dorsal = new THREE.Group(), anal = new THREE.Group(), tail = new THREE.Group();
    dorsal.add(new THREE.Mesh(medianGeo(0.075, 0.062, 1), fm));
    anal.add(new THREE.Mesh(medianGeo(0.07, 0.056, -1), fm));
    const [tb, bb] = F.radii(F.body - 0.01, 0);
    tail.add(new THREE.Mesh(caudalGeo((tb + bb) * 0.42, 0.085, 0.2), fm));
    this.dorsal = { g: dorsal, a0: F.anchor(0.6, 0, 0), a1: F.anchor(0.6, 0, 1) };
    this.anal = { g: anal, a0: F.anchor(0.62, Math.PI, 0), a1: F.anchor(0.62, Math.PI, 1) };
    this.tail = { g: tail, p: V3(0, (tb - bb) * 0.5, zOf(F.body - 0.012)) };
    tail.position.copy(this.tail.p);
    this.group.add(dorsal, anal, tail);
    for (const o of [this.body]) { o.castShadow = false; o.receiveShadow = false; }
    this.t = seed * 10;
    this.puff = -1;
    this.setPuff(0);
    this.setSand(0);
  }

  /** ふくらみ（0..1） */
  setPuff(k) {
    k = clamp(k, 0, 1);
    if (k === this.puff) return;
    this.puff = k;
    this.u.uPuff.value = k;
    for (const e of this.eyes) {
      const p = e.a0.p.clone().lerp(e.a1.p, k), n = e.a0.n.clone().lerp(e.a1.n, k).normalize();
      // 眼は玉の半分ほど出っぱる。少し前・上を向く
      e.m.position.copy(p).addScaledVector(n, this.eyeR * 0.08);
      const ax = n.clone().add(V3(0, 0.12, 0.28)).normalize();
      e.m.quaternion.setFromUnitVectors(V3(0, 0, 1), ax);
      e.axis = ax;
    }
    for (const f of this.pecs) {
      f.base = f.a0.p.clone().lerp(f.a1.p, k);
      f.g.position.copy(f.base);
    }
    this.dorsal.g.position.copy(this.dorsal.a0.p.clone().lerp(this.dorsal.a1.p, k));
    this.anal.g.position.copy(this.anal.a0.p.clone().lerp(this.anal.a1.p, k));
  }
  /** 砂をかぶった度合い（0..1） */
  setSand(k) { this.u.uSand.value = k; }
  setWet(k) { this.u.uWet.value = k; }

  /**
   * 動き。mode: 'rest'（砂の中で休む）| 'swim'（泳ぐ）| 'flail'（手の中で暴れる）| 'float'（ふくらんで浮く）
   * opts.speed: 速さの倍率
   */
  pose(mode, dt, { speed = 1 } = {}) {
    this.t += dt * speed;
    const t = this.t;
    let pa, pf, tail, med;
    if (mode === 'swim') { pa = 0.55; pf = 0.45 * Math.sin(t * 15); tail = Math.sin(t * 2.3) * 0.18; med = Math.sin(t * 9) * 0.35; }
    else if (mode === 'flail') { pa = 0.75; pf = 0.6 * Math.sin(t * 24); tail = Math.sin(t * 13) * 0.55; med = Math.sin(t * 17) * 0.5; }
    else if (mode === 'float') { pa = 0.95; pf = 0.35 * Math.sin(t * 18); tail = Math.sin(t * 3) * 0.12; med = Math.sin(t * 11) * 0.3; }
    else { pa = 0.22; pf = 0.06 * Math.sin(t * 2.2); tail = 0; med = 0; }
    for (const f of this.pecs) f.g.rotation.set(0, -(pa + pf) * f.sg, 0);
    this.tail.g.rotation.set(0, tail, 0);
    this.dorsal.g.rotation.set(0, 0, med * 0.4);
    this.anal.g.rotation.set(0, 0, -med * 0.4);
    // 尾鰭はたたむ（休む時）・開く
    const spread = mode === 'rest' ? 0.55 : 1;
    this.tail.g.scale.set(1, spread, 1);
  }

  /** 眼（左右）の世界の位置と向き */
  eyeWorld(i, pos = V3(), axis = V3()) {
    const e = this.eyes[i];
    this.group.updateMatrixWorld(true);
    pos.copy(e.m.position).applyMatrix4(this.group.matrixWorld);
    axis.copy(e.axis).transformDirection(this.group.matrixWorld);
    return { pos, axis };
  }
  /** 体の中心（ふくらんだ球の中心）の世界の位置 */
  center(out = V3()) {
    this.group.updateMatrixWorld(true);
    return out.set(0, this.F.py * this.puff, zOf(this.F.pc)).applyMatrix4(this.group.matrixWorld);
  }
  /** 半径の目安（m）: ふくらむと大きい */
  get radius() { return this.L * lerp(0.1, this.F.pr, this.puff); }

  dispose() {
    this.mat.dispose();
    for (const e of this.eyes) e.m.geometry.dispose();
    // 体・鰭のジオメトリと鰭・眼の材質は種類ごとに使い回す
  }
}

/** 眼の、魚の原点からの位置（全長 = 1、右の眼。左は x を反転）と向き。砂にもぐったフグの光る点に使う */
export function eyeLocal(id = 'kusa') {
  const F = formOf(id);
  const [es, eth, er] = F.S.eye;
  const a = F.anchor(es, eth, 0);
  const p = a.p.clone().addScaledVector(a.n, er * 0.08);
  const ax = a.n.clone().add(V3(0, 0.12, 0.28)).normalize();
  return { p, axis: ax, top: F.radii(es, 0)[0] };
}
/** 体の中心（原点）から背のいちばん高い所まで（全長 = 1） */
export function topOf(id = 'kusa') { return formOf(id).radii(0.27, 0)[0]; }
export const FUGU_Z0 = Z0;
