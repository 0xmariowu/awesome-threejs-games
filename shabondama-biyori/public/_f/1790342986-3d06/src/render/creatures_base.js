// 追加の鳥・動物・蝶が使う生き物の土台（生き物の本体 creatures.js とは別に、作ったときの形のまま残す）
// 生き物の共通部分：形を組む道具（楕円の輪をつないだ筒・楕円体・平たい翼）と、
// 種ごとの動き（頂点シェーダの animate 関数）を差し込む共通の材質、たくさん並べる入れ物
import * as THREE from 'three';
import { ALL, SHADOW } from './glsl.js';

// ---- 形を組む ----
export class MeshB {
  constructor() { this.P = []; this.N = []; this.C = []; this.A = []; this.I = []; }
  get n() { return this.P.length / 3; }
  vert(p, n, c, a) {
    this.P.push(p[0], p[1], p[2]); this.N.push(n[0], n[1], n[2]); this.C.push(c[0], c[1], c[2]); this.A.push(a[0], a[1], a[2], a[3]);
    return this.n - 1;
  }
  // 背骨に沿った楕円の輪をつなぐ筒。rings: [{p:[x,y,z], rx, ry}]。col(u, th, lp) → [r,g,b]、part(u, th) → [id, t, side, x]
  tube(rings, segs, col, part, capA = true, capB = true) {
    const nR = rings.length;
    const base = this.n;
    for (let i = 0; i < nR; i++) {
      const r = rings[i];
      const a = rings[Math.max(0, i - 1)].p, b = rings[Math.min(nR - 1, i + 1)].p;
      let tx = b[0] - a[0], ty = b[1] - a[1], tz = b[2] - a[2];
      const tl = Math.hypot(tx, ty, tz) || 1; tx /= tl; ty /= tl; tz /= tl;
      // 横（右）＝ 接線 × 上。上＝右 × 接線
      let up = r.up || [0, 1, 0];
      if (Math.abs(tx * up[0] + ty * up[1] + tz * up[2]) > 0.95) up = [0, 0, 1];
      let rx = ty * up[2] - tz * up[1], ry = tz * up[0] - tx * up[2], rz = tx * up[1] - ty * up[0];
      const rl = Math.hypot(rx, ry, rz) || 1; rx /= rl; ry /= rl; rz /= rl;
      const ux = ry * tz - rz * ty, uy = rz * tx - rx * tz, uz = rx * ty - ry * tx;
      const u = nR > 1 ? i / (nR - 1) : 0;
      for (let k = 0; k <= segs; k++) {
        const th = (k / segs) * Math.PI * 2;
        const c = Math.cos(th), s = Math.sin(th);
        const ox = rx * c * r.rx + ux * s * r.ry, oy = ry * c * r.rx + uy * s * r.ry, oz = rz * c * r.rx + uz * s * r.ry;
        let nx = rx * c / Math.max(r.rx, 1e-4) + ux * s / Math.max(r.ry, 1e-4), ny = ry * c / Math.max(r.rx, 1e-4) + uy * s / Math.max(r.ry, 1e-4), nz = rz * c / Math.max(r.rx, 1e-4) + uz * s / Math.max(r.ry, 1e-4);
        const nl = Math.hypot(nx, ny, nz) || 1;
        const p = [r.p[0] + ox, r.p[1] + oy, r.p[2] + oz];
        this.vert(p, [nx / nl, ny / nl, nz / nl], col(u, th, p), part(u, th, p));
      }
    }
    for (let i = 0; i < nR - 1; i++) for (let k = 0; k < segs; k++) {
      const a = base + i * (segs + 1) + k, b = a + 1, c = a + segs + 1, d = c + 1;
      this.I.push(a, b, c, b, d, c);
    }
    const cap = (i, flip) => {
      const r = rings[i];
      const a = rings[Math.max(0, i - 1)].p, b = rings[Math.min(nR - 1, i + 1)].p;
      let tx = b[0] - a[0], ty = b[1] - a[1], tz = b[2] - a[2];
      const tl = Math.hypot(tx, ty, tz) || 1; tx /= tl; ty /= tl; tz /= tl;
      const s = flip ? -1 : 1;
      const u = nR > 1 ? i / (nR - 1) : 0;
      const c0 = this.vert(r.p, [tx * s, ty * s, tz * s], col(u, 0, r.p), part(u, 0, r.p));
      const ring0 = base + i * (segs + 1);
      for (let k = 0; k < segs; k++) {
        if (flip) this.I.push(c0, ring0 + k + 1, ring0 + k); else this.I.push(c0, ring0 + k, ring0 + k + 1);
      }
    };
    if (capA && rings[0].rx > 0) cap(0, true);
    if (capB && rings[nR - 1].rx > 0) cap(nR - 1, false);
  }
  // 楕円体
  ellipsoid(c, r, su, sv, col, part) {
    const base = this.n;
    for (let j = 0; j <= sv; j++) {
      const v = j / sv, ph = v * Math.PI;
      for (let i = 0; i <= su; i++) {
        const th = (i / su) * Math.PI * 2;
        const nx = Math.sin(ph) * Math.cos(th), ny = Math.cos(ph), nz = Math.sin(ph) * Math.sin(th);
        const p = [c[0] + nx * r[0], c[1] + ny * r[1], c[2] + nz * r[2]];
        let gx = nx / r[0], gy = ny / r[1], gz = nz / r[2];
        const gl = Math.hypot(gx, gy, gz) || 1;
        this.vert(p, [gx / gl, gy / gl, gz / gl], col(v, th, p), part(v, th, p));
      }
    }
    for (let j = 0; j < sv; j++) for (let i = 0; i < su; i++) {
      const a = base + j * (su + 1) + i, b = a + 1, cc = a + su + 1, d = cc + 1;
      this.I.push(a, cc, b, b, cc, d);
    }
  }
  // 平たい面（翼・ひれ・耳）：外形の点列を扇形に張る。n は面の向き
  fan(center, outline, n, col, part) {
    const c0 = this.vert(center, n, col(center, -1), part(center, -1));
    const ids = outline.map((p, i) => this.vert(p, n, col(p, i), part(p, i)));
    for (let i = 0; i < ids.length - 1; i++) this.I.push(c0, ids[i], ids[i + 1]);
  }
  // 帯状の面：2本の点列（前縁・後縁）の間を張る
  strip(lead, trail, n, col, part) {
    const a = lead.map((p, i) => this.vert(p, n, col(p, i, 0), part(p, i, 0)));
    const b = trail.map((p, i) => this.vert(p, n, col(p, i, 1), part(p, i, 1)));
    for (let i = 0; i < a.length - 1; i++) this.I.push(a[i], b[i], a[i + 1], a[i + 1], b[i], b[i + 1]);
  }
  build() {
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.P, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.N, 3));
    g.setAttribute('aCol', new THREE.Float32BufferAttribute(this.C, 3));
    g.setAttribute('aPart', new THREE.Float32BufferAttribute(this.A, 4));
    g.setIndex(this.I);
    return g;
  }
}

// ---- 共通の材質 ----
const CVS = (anim) => /* glsl */ `
${ALL}
${SHADOW}
attribute vec3 aCol;
attribute vec4 aPart;   // x=部位 y=部位の中の位置(0..1) z=左右 w=予備
attribute vec4 iA;      // 位置xyz・向き（y軸まわり）
attribute vec4 iB;      // 前後の傾き・横の傾き・大きさ・時間
attribute vec4 iC;      // 姿勢（種ごとの意味）
attribute vec4 iD;      // 姿勢2・色の違い
varying vec3 vN;
varying vec3 vWorld;
varying vec3 vCol;
varying vec4 vPart;
varying float vThin;
mat3 rotX(float a) { float c = cos(a), s = sin(a); return mat3(1.0, 0.0, 0.0, 0.0, c, s, 0.0, -s, c); }
mat3 rotY(float a) { float c = cos(a), s = sin(a); return mat3(c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c); }
mat3 rotZ(float a) { float c = cos(a), s = sin(a); return mat3(c, s, 0.0, -s, c, 0.0, 0.0, 0.0, 1.0); }
// 点 p を、軸の点 o のまわりに回す
vec3 rotAbout(vec3 p, vec3 o, mat3 R) { return o + R * (p - o); }
float vThinOut = 0.0;
${anim}
void main() {
  vec3 p = position;
  vec3 n = normal;
  vec3 col = aCol;
  animate(p, n, col);
  mat3 R = rotY(iA.w) * rotX(iB.x) * rotZ(iB.y);
  vec3 wp = iA.xyz + R * (p * iB.z);
  vN = normalize(R * n);
  vWorld = wp;
  vCol = col;
  vPart = aPart;
  vThin = vThinOut;
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
}
`;
const CFS = /* glsl */ `
${ALL}
${SHADOW}
varying vec3 vN;
varying vec3 vWorld;
varying vec3 vCol;
varying vec4 vPart;
varying float vThin;
uniform float uGloss;
void main() {
#ifdef DEPTH
  gl_FragColor = vec4(1.0);
#else
  vec3 N = normalize(vN);
  vec3 V = normalize(cameraPosition - vWorld);
  if (dot(N, V) < 0.0 && vThin > 0.5) N = -N;
  vec3 alb = vCol;
  float nl = dot(N, uSunDir);
  // 羽毛・毛は光が回りこむ（包みこむ拡散）
  float diff = sat((nl + 0.3) / 1.3);
  float sh = sunShadow(vWorld, max(nl, 0.2), gl_FragCoord.xy) * cloudShadow(vWorld);
  float ao = 0.62 + 0.38 * sat(N.y * 0.5 + 0.6);
  vec3 col = alb * (uSunCol * diff * sh + shIrr(N) * ao);
  // 薄い部分（翼・耳・ひれ）は逆光で透ける
  if (vThin > 0.5) col += alb * uSunCol * pow(sat(dot(-V, uSunDir)), 2.0) * 0.55 * sh;
  // 艶（目・くちばし・濡れた肌）
  vec3 H = normalize(uSunDir + V);
  col += uSunCol * pow(max(dot(N, H), 0.0), 40.0) * uGloss * sh;
  gl_FragColor = vec4(col, 1.0);
#endif
}
`;

// たくさん並べる入れ物：毎フレーム begin → push → end
export class Herd {
  constructor(shared, geo, anim, { cap = 64, gloss = 0.05, shadow = false, name = '' } = {}) {
    this.cap = cap;
    this.geo = geo;
    this.name = name;
    const mk = (n) => { const a = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4); a.setUsage(THREE.DynamicDrawUsage); geo.setAttribute(n, a); return a; };
    this.a = mk('iA'); this.b = mk('iB'); this.c = mk('iC'); this.d = mk('iD');
    geo.instanceCount = 0;
    const uniforms = { ...shared, uGloss: { value: gloss } };
    this.mat = new THREE.ShaderMaterial({ uniforms, vertexShader: CVS(anim), fragmentShader: CFS, side: THREE.DoubleSide });
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.frustumCulled = false;
    if (shadow) {
      this.mesh.userData.depthMaterial = new THREE.ShaderMaterial({ uniforms, vertexShader: CVS(anim), fragmentShader: CFS, defines: { DEPTH: '' }, side: THREE.DoubleSide });
      this.mesh.userData.farShadow = false;
    }
    this.n = 0;
  }
  begin() { this.n = 0; }
  push(x, y, z, yaw, pitch, roll, scale, t, c0 = 0, c1 = 0, c2 = 0, c3 = 0, d0 = 0, d1 = 0, d2 = 0, d3 = 0) {
    if (this.n >= this.cap) return;
    const o = this.n * 4;
    const A = this.a.array, B = this.b.array, C = this.c.array, D = this.d.array;
    A[o] = x; A[o + 1] = y; A[o + 2] = z; A[o + 3] = yaw;
    B[o] = pitch; B[o + 1] = roll; B[o + 2] = scale; B[o + 3] = t;
    C[o] = c0; C[o + 1] = c1; C[o + 2] = c2; C[o + 3] = c3;
    D[o] = d0; D[o + 1] = d1; D[o + 2] = d2; D[o + 3] = d3;
    this.n++;
  }
  end() {
    this.geo.instanceCount = this.n;
    for (const at of [this.a, this.b, this.c, this.d]) { at.clearUpdateRanges(); at.addUpdateRange(0, Math.max(1, this.n) * 4); at.needsUpdate = true; }
  }
}
