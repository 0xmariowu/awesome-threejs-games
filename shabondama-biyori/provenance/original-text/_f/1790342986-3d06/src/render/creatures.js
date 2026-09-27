// 生き物の共通部分：形を組む道具（楕円の輪をつないだ筒・楕円体・曲面の板）と、
// 種ごとの動き（頂点シェーダの animate 関数）を差し込む共通の材質、たくさん並べる入れ物（近い／遠いの2段）
import * as THREE from 'three';
import { ALL, SHADOW } from './glsl.js';

// 材質の種類（aMat.x、薄い板は +10）。y は種類ごとの強さ、z は焼きこんだ陰（体の奥まったところ）
export const MAT = { FEATHER: 0, FUR: 1, SKIN: 2, SCALE: 3, EYE: 4, HORN: 5, MEMB: 6, DOWN: 7 };

// ---- 形を組む ----
export class MeshB {
  constructor(q = 1) {
    this.P = []; this.N = []; this.C = []; this.C2 = []; this.A = []; this.M = []; this.I = [];
    this.q = q;            // 細かさ（1＝近景、0.5 前後＝遠景）
    this.mat = [0, 0];
    this.blobs = [];       // 陰を焼くための球（中心・半径）
  }
  get n() { return this.P.length / 3; }
  seg(k, min = 3) { return Math.max(min, Math.round(k * this.q)); }
  // thin＝薄い板（翼・耳・ひれ）：裏からも表として照らし、逆光で透ける
  // hair＝細い毛・飾り羽（幅 m）：画面で1ピクセルを切る距離では描かない（点々のちらつき止め）
  use(kind, param = 0, thin = false, hair = 0) { this.mat = hair > 0 ? [kind + 20, hair] : [kind + (thin ? 10 : 0), param]; return this; }
  // col は [r,g,b]（表裏同じ）か [r,g,b, r2,g2,b2]（裏の色）
  vert(p, n, c, a) {
    this.P.push(p[0], p[1], p[2]); this.N.push(n[0], n[1], n[2]);
    this.C.push(c[0], c[1], c[2]);
    if (c.length >= 6) this.C2.push(c[3], c[4], c[5]); else this.C2.push(c[0], c[1], c[2]);
    this.A.push(a[0], a[1], a[2], a[3] || 0);
    this.M.push(this.mat[0], this.mat[1], 1);
    return this.n - 1;
  }
  blob(c, r) { this.blobs.push([c[0], c[1], c[2], r]); }
  // 背骨に沿った輪をつなぐ筒。rings: [{p:[x,y,z], rx, ry, up?, f?(th)→[kx,ky]}]。col(u, th, p) → 色、part(u, th, p) → [id, t, side, x]
  // f のある輪は断面の形を変える（そのときは法線を面から求め直す）
  tube(rings, segs, col, part, capA = true, capB = true) {
    const nR = rings.length;
    const base = this.n, i0 = this.I.length;
    let custom = false;
    let pr = null;   // ひとつ前の輪の横向き（ねじれない枠を運ぶ）
    for (let i = 0; i < nR; i++) {
      const r = rings[i];
      const a = rings[Math.max(0, i - 1)].p, b = rings[Math.min(nR - 1, i + 1)].p;
      let tx = b[0] - a[0], ty = b[1] - a[1], tz = b[2] - a[2];
      const tl = Math.hypot(tx, ty, tz) || 1; tx /= tl; ty /= tl; tz /= tl;
      let rx, ry, rz, rl = 0;
      if (pr && !r.up) {
        // 前の輪の横向きを今の接線に直交させて使う（向きの急な入れかわりで輪がねじれない）
        const d = pr[0] * tx + pr[1] * ty + pr[2] * tz;
        rx = pr[0] - tx * d; ry = pr[1] - ty * d; rz = pr[2] - tz * d;
        rl = Math.hypot(rx, ry, rz);
      }
      if (rl < 1e-4) {
        let up = r.up || [0, 1, 0];
        if (Math.abs(tx * up[0] + ty * up[1] + tz * up[2]) > 0.95) up = [0, 0, 1];
        rx = ty * up[2] - tz * up[1]; ry = tz * up[0] - tx * up[2]; rz = tx * up[1] - ty * up[0];
        rl = Math.hypot(rx, ry, rz) || 1;
      }
      rx /= rl; ry /= rl; rz /= rl;
      pr = [rx, ry, rz];
      const ux = ry * tz - rz * ty, uy = rz * tx - rx * tz, uz = rx * ty - ry * tx;
      const u = nR > 1 ? i / (nR - 1) : 0;
      if (r.f) custom = true;
      if (r.rx > 0.004) this.blob(r.p, (r.rx + r.ry) * 0.5);
      for (let k = 0; k <= segs; k++) {
        const th = (k / segs) * Math.PI * 2;
        let c = Math.cos(th), s = Math.sin(th);
        if (r.f) { const q = r.f(th, u); c *= q[0]; s *= q[1]; }
        const ox = rx * c * r.rx + ux * s * r.ry, oy = ry * c * r.rx + uy * s * r.ry, oz = rz * c * r.rx + uz * s * r.ry;
        const ic = Math.cos(th), is = Math.sin(th);
        let nx = rx * ic / Math.max(r.rx, 1e-4) + ux * is / Math.max(r.ry, 1e-4), ny = ry * ic / Math.max(r.rx, 1e-4) + uy * is / Math.max(r.ry, 1e-4), nz = rz * ic / Math.max(r.rx, 1e-4) + uz * is / Math.max(r.ry, 1e-4);
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
    if (custom) this.smooth(base, i0, null, true);
  }
  // 楕円体（f があれば (nx,ny,nz)→半径の倍率 で形をゆがめる）
  ellipsoid(c, r, su, sv, col, part, f) {
    const base = this.n, i0 = this.I.length;
    this.blob(c, (r[0] + r[1] + r[2]) / 3);
    for (let j = 0; j <= sv; j++) {
      const v = j / sv, ph = v * Math.PI;
      for (let i = 0; i <= su; i++) {
        const th = (i / su) * Math.PI * 2;
        const nx = Math.sin(ph) * Math.cos(th), ny = Math.cos(ph), nz = Math.sin(ph) * Math.sin(th);
        const k = f ? f(nx, ny, nz) : 1;
        const p = [c[0] + nx * r[0] * k, c[1] + ny * r[1] * k, c[2] + nz * r[2] * k];
        let gx = nx / r[0], gy = ny / r[1], gz = nz / r[2];
        const gl = Math.hypot(gx, gy, gz) || 1;
        this.vert(p, [gx / gl, gy / gl, gz / gl], col(v, th, p), part(v, th, p));
      }
    }
    for (let j = 0; j < sv; j++) for (let i = 0; i < su; i++) {
      const a = base + j * (su + 1) + i, b = a + 1, cc = a + su + 1, d = cc + 1;
      this.I.push(a, cc, b, b, cc, d);
    }
    if (f) this.smooth(base, i0, null, true);
  }
  // 曲面の板（翼・尾・ひれ・耳）：pos(u,v) → 点。hint の向きに表（法線）をそろえる
  grid(nu, nv, pos, col, part, hint = [0, 1, 0]) {
    const base = this.n, i0 = this.I.length;
    for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
      const u = i / nu, v = j / nv;
      const p = pos(u, v);
      this.vert(p, hint, col(u, v, p), part(u, v, p));
    }
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
      const a = base + j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1;
      this.I.push(a, b, c, b, d, c);
    }
    this.smooth(base, i0, hint);
  }
  // 帯状の面：2本の点列（前縁・後縁）の間を張る
  strip(lead, trail, n, col, part) {
    const base = this.n, i0 = this.I.length;
    const a = lead.map((p, i) => this.vert(p, n, col(p, i, 0), part(p, i, 0)));
    const b = trail.map((p, i) => this.vert(p, n, col(p, i, 1), part(p, i, 1)));
    for (let i = 0; i < a.length - 1; i++) this.I.push(a[i], b[i], a[i + 1], a[i + 1], b[i], b[i + 1]);
    this.smooth(base, i0, n);
  }
  // 面から法線を求め直す（同じ位置の点はまとめる）。hint があれば裏返しをそろえる。
  // keep＝もとの（解析的な）法線と同じ側を向かせる
  smooth(v0, i0, hint, keep = false) {
    const P = this.P, I = this.I, n = this.n;
    const acc = new Float32Array((n - v0) * 3);
    let flipDot = 0;
    for (let t = i0; t < I.length; t += 3) {
      const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3;
      const e1x = P[b] - P[a], e1y = P[b + 1] - P[a + 1], e1z = P[b + 2] - P[a + 2];
      const e2x = P[c] - P[a], e2y = P[c + 1] - P[a + 1], e2z = P[c + 2] - P[a + 2];
      const nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x;
      if (hint) flipDot += nx * hint[0] + ny * hint[1] + nz * hint[2];
      for (const q of [I[t], I[t + 1], I[t + 2]]) { const o = (q - v0) * 3; if (o < 0) continue; acc[o] += nx; acc[o + 1] += ny; acc[o + 2] += nz; }
    }
    // 巻き方向を hint にそろえる
    if (hint && flipDot < 0) {
      for (let t = i0; t < I.length; t += 3) { const x = I[t + 1]; I[t + 1] = I[t + 2]; I[t + 2] = x; }
      for (let k = 0; k < acc.length; k++) acc[k] = -acc[k];
    }
    // 同じ位置（継ぎ目）の法線をまとめる
    const key = (k) => `${Math.round(P[k * 3] * 2e4)},${Math.round(P[k * 3 + 1] * 2e4)},${Math.round(P[k * 3 + 2] * 2e4)}`;
    const groups = new Map();
    for (let k = v0; k < n; k++) { const s = key(k); const g = groups.get(s); if (g) g.push(k); else groups.set(s, [k]); }
    // keep：もとの外向きとの向きあわせは全体で1回だけ決める（巻き方向は一続きなので）。
    //（頂点ごとに決めると、筒の端のように面の向きともとの向きが直交するところで裏返りが混ざる）
    let tot = 0;
    if (keep) for (const g of groups.values()) {
      let x = 0, y = 0, z = 0;
      for (const k of g) { const o = (k - v0) * 3; x += acc[o]; y += acc[o + 1]; z += acc[o + 2]; }
      const l = Math.hypot(x, y, z);
      if (l < 1e-12) continue;
      const k = g[0];
      tot += (x * this.N[k * 3] + y * this.N[k * 3 + 1] + z * this.N[k * 3 + 2]) / l;
    }
    const gs = keep && tot < 0 ? -1 : 1;
    for (const g of groups.values()) {
      let x = 0, y = 0, z = 0;
      for (const k of g) { const o = (k - v0) * 3; x += acc[o]; y += acc[o + 1]; z += acc[o + 2]; }
      const l = Math.hypot(x, y, z);
      if (l < 1e-12) continue;
      for (const k of g) {
        const sgn = gs;
        this.N[k * 3] = sgn * x / l; this.N[k * 3 + 1] = sgn * y / l; this.N[k * 3 + 2] = sgn * z / l;
      }
    }
  }
  // 体の奥まったところの陰を焼く（部位の球が法線側をどれだけふさぐか）
  bakeAO(strength = 1) {
    const P = this.P, N = this.N, B = this.blobs;
    for (let k = 0; k < this.n; k++) {
      const px = P[k * 3], py = P[k * 3 + 1], pz = P[k * 3 + 2];
      const nx = N[k * 3], ny = N[k * 3 + 1], nz = N[k * 3 + 2];
      let occ = 0;
      for (const b of B) {
        const dx = b[0] - px, dy = b[1] - py, dz = b[2] - pz;
        const d = Math.hypot(dx, dy, dz);
        if (d < b[3] * 1.05 || d < 1e-5) continue;   // 自分を含む球は数えない
        const cos = (dx * nx + dy * ny + dz * nz) / d;
        if (cos <= 0) continue;
        occ += cos * (b[3] * b[3]) / (d * d);
      }
      this.M[k * 3 + 2] = Math.max(0.35, 1 - occ * 0.9 * strength);
    }
  }
  build(ao = 1) {
    if (ao > 0) this.bakeAO(ao);
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.P, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.N, 3));
    g.setAttribute('aCol', new THREE.Float32BufferAttribute(this.C, 3));
    g.setAttribute('aCol2', new THREE.Float32BufferAttribute(this.C2, 3));
    g.setAttribute('aPart', new THREE.Float32BufferAttribute(this.A, 4));
    g.setAttribute('aMat', new THREE.Float32BufferAttribute(this.M, 3));
    g.setIndex(this.I);
    return g;
  }
}

// ---- 共通の材質 ----
const CVS = (anim) => /* glsl */ `
${ALL}
${SHADOW}
attribute vec3 aCol;
attribute vec3 aCol2;
attribute vec4 aPart;   // x=部位 y=部位の中の位置(0..1) z=左右 w=予備
attribute vec3 aMat;    // x=材質 y=強さ z=焼いた陰
attribute vec4 iA;      // 位置xyz・向き（y軸まわり）
attribute vec4 iB;      // 前後の傾き・横の傾き・大きさ・時間
attribute vec4 iC;      // 姿勢（種ごとの意味）
attribute vec4 iD;      // 姿勢2・色の違い
uniform float uPxH;     // 描画先の高さ（ピクセル）
varying vec3 vN;
varying vec3 vWorld;
varying vec3 vCol;
varying vec3 vCol2;
varying vec4 vPart;
varying vec3 vMat;
varying vec3 vLocal;
varying float vThin;
mat3 rotX(float a) { float c = cos(a), s = sin(a); return mat3(1.0, 0.0, 0.0, 0.0, c, s, 0.0, -s, c); }
mat3 rotY(float a) { float c = cos(a), s = sin(a); return mat3(c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c); }
mat3 rotZ(float a) { float c = cos(a), s = sin(a); return mat3(c, s, 0.0, -s, c, 0.0, 0.0, 0.0, 1.0); }
// 点 p を、軸の点 o のまわりに回す
vec3 rotAbout(vec3 p, vec3 o, mat3 R) { return o + R * (p - o); }
float vThinOut = 0.0;
vec3 col2 = vec3(0.0);
vec3 matOut = vec3(0.0);   // animate() で材質も変えられる（色違いの個体）
${anim}
void main() {
  vec3 p = position;
  vec3 n = normal;
  vec3 col = aCol;
  col2 = aCol2;
  matOut = aMat;
  vThinOut = aMat.x > 9.5 ? 1.0 : 0.0;
  // 細い毛：幅は aMat.y（個体ごとに一律で決めるので、三角形の一部だけ消えることはない）
  float hairW = aMat.x > 19.5 ? aMat.y : 0.0;
  if (hairW > 0.0) matOut.y = 0.0;
  animate(p, n, col);
  mat3 R = rotY(iA.w) * rotX(iB.x) * rotZ(iB.y);
  vec3 wp = iA.xyz + R * (p * iB.z);
  vec3 nn = R * n;
  vN = dot(nn, nn) > 1e-12 ? normalize(nn) : vec3(0.0, 1.0, 0.0);
  vWorld = wp;
  vCol = col;
  vCol2 = col2;
  vPart = aPart;
  vMat = matOut;
  vLocal = position;
  vThin = vThinOut;
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
  if (hairW > 0.0) {
#ifdef DEPTH
    gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
#else
    float px = hairW * iB.z * projectionMatrix[1][1] / max(length(iA.xyz - cameraPosition), 1e-3) * 0.5 * uPxH;
    if (px < 1.5) gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
#endif
  }
}
`;
const CFS = /* glsl */ `
${ALL}
${SHADOW}
varying vec3 vN;
varying vec3 vWorld;
varying vec3 vCol;
varying vec3 vCol2;
varying vec4 vPart;
varying vec3 vMat;
varying vec3 vLocal;
varying float vThin;
uniform float uGloss;
// 模様の細かさに合わせて、画面で細かすぎる模様は消す（ちらつき止め）
float detailFade(float freq) { float w = length(fwidth(vLocal)) * freq; return 1.0 - smoothstep(0.35, 0.9, w); }
void main() {
#ifdef DEPTH
  gl_FragColor = vec4(1.0);
#else
  vec3 N = vN / max(length(vN), 1e-5);
  vec3 dV = cameraPosition - vWorld;
  vec3 V = dV / max(length(dV), 1e-4);
  bool thin = vThin > 0.5;
  bool back = thin && !gl_FrontFacing;
  if (back) N = -N;
  // 輪郭で補間した法線が視線の裏へ回るところは、視線に直交するまで寄せる
  if (!thin) { float d0 = dot(N, V); if (d0 < 0.0) N = normalize(N - d0 * V); }
  float kf = mod(floor(vMat.x + 0.5), 10.0);
  int kind = int(kf + 0.5);
  float prm = vMat.y;
  vec3 alb = back ? vCol2 : vCol;
  vec3 L = vLocal;
  float nv = sat(dot(N, V));
  // ---- 細部の模様（体の座標で貼る）。種に無い材質の分は K* の定義で外す（読み込みを軽く） ----
#if defined(K0) || defined(K7)
  if (kind == 0 || kind == 7) {
    // 羽毛：羽の重なりの細かな明暗
    float fq = kind == 7 ? 420.0 : 230.0;
    float fd = detailFade(fq);
    float f = vnoise2(vec2(L.z * fq * 0.8, (L.y + L.x * 0.7) * fq)) * 0.55 + vnoise2(vec2(L.x + L.z, L.y) * fq * 2.1) * 0.45;
    alb *= 1.0 + (f - 0.5) * 0.2 * fd;
    if (prm >= 2.0 && !thin) {
      // 背の縦斑（スズメ）：prm-2 が 1mm あたりの細かさ
      float s = (prm - 2.0) * 1000.0;
      vec2 g = vec2(L.z * s * 0.4, (L.x * 1.3 + L.y * 0.25) * s);
      vec2 id = floor(g);
      vec2 fc = fract(g) - 0.5;
      float h = hashI2(ivec2(id) + ivec2(31, 17));
      float st = (1.0 - smoothstep(0.1, 0.28, abs(fc.y + (h - 0.5) * 0.3))) * step(0.4, h) * (1.0 - smoothstep(0.25, 0.5, abs(fc.x)));
      float top = sat(N.y * 2.2 - 0.2);
      float fd3 = detailFade(s * 1.3);
      alb = mix(alb, alb * 0.2, st * 0.9 * top * fd3);
      alb = mix(alb, alb * 1.45 + 0.02, (1.0 - st) * smoothstep(0.32, 0.48, abs(fc.y)) * 0.35 * top * fd3);
    } else if (prm > 0.01 && prm < 1.5 && !thin) {
      // うろこ状の羽縁（カルガモ・トビの背）
      float s = 1.0 / max(prm, 0.02);
      vec2 g = vec2(L.z * s, (L.y * 0.8 + abs(L.x) * 0.6) * s * 1.35);
      float row = floor(g.y);
      g.x += row * 0.5 + hashI2(ivec2(int(row), 7)) * 0.3;
      // 羽ごとに位置・大きさ・縁の明るさをばらつかせる（網目のように揃わない）
      ivec2 cid = ivec2(floor(g));
      float h1 = hashI2(cid + ivec2(3, 41)), h2 = hashI2(cid + ivec2(19, 5));
      vec2 fcell = fract(g) - 0.5 + (vec2(h1, h2) - 0.5) * 0.22;
      float rr = 0.2 + 0.08 * h2;
      float e = smoothstep(rr, rr + 0.24, length(fcell * vec2(1.0, 1.25) + vec2(0.0, 0.16)));
      float fd2 = 1.0 - smoothstep(0.3, 0.8, length(fwidth(vLocal)) * s * 1.4);
      alb = mix(alb, alb * vec3(1.75, 1.65, 1.45) + 0.02, e * (0.3 + 0.2 * h1) * fd2);
    }
  }
#endif
#ifdef K1
  if (kind == 1) {
    // 毛：毛並みの筋と、ところどころの毛先の明るさ
    float fq = 900.0;
    float fd = detailFade(fq * 0.25);
    float f = vnoise2(vec2(L.z * fq * 0.12, (L.y * 0.6 + L.x) * fq)) * 0.55 + vnoise2(vec2(L.x, L.y) * fq * 0.3 + L.z * fq * 0.3) * 0.45;
    alb *= 1.0 + (f - 0.5) * 0.45 * fd;
    // 夏毛の白い斑（シカ）：prm>0
    if (prm > 0.01) {
      // 子鹿の斑：並びを乱し、大きさを変え、縁はぼかす
      vec2 g = vec2(L.z * 12.0, L.y * 15.0);
      float row = floor(g.y);
      g.x += row * 0.5 + hashI2(ivec2(int(row), 11)) * 0.4;
      vec2 id = floor(g);
      float h = hashI2(ivec2(id) + ivec2(5, 9));
      vec2 c = fract(g) - 0.5 - (vec2(hashI2(ivec2(id) + 3), h) - 0.5) * 0.7;
      float rr = 0.07 + 0.06 * hashI2(ivec2(id) + ivec2(17, 2));
      float sp = (1.0 - smoothstep(rr * 0.4, rr * 1.3, length(c * vec2(1.0, 1.25)))) * step(0.45, h) * 0.8;
      float band = smoothstep(0.62, 0.8, L.y / 1.0) * smoothstep(1.12, 1.02, L.y) * step(abs(L.x), 0.3) * smoothstep(-0.55, -0.35, L.z) * smoothstep(0.42, 0.25, L.z);
      alb = mix(alb, vec3(0.78, 0.72, 0.62), sp * band * prm * detailFade(22.0));
    }
  }
#endif
#ifdef K2
  if (kind == 2) {
    // 濡れた肌：斑点（カエル）prm=斑の濃さ
    if (prm > 0.01) {
      float fd = detailFade(260.0);
      vec2 wq = L.xz * 230.0 + vec2(vnoise2(L.xz * 700.0), vnoise2(L.xz * 700.0 + 5.3)) * 1.4;
      float s = vnoise2(wq) * 0.75 + vnoise2(L.xz * 900.0 + 3.1) * 0.25;
      float sp = smoothstep(0.64, 0.72, s) * step(0.0, N.y + 0.1);
      alb = mix(alb, alb * 0.18, sp * prm * fd);
      alb *= 0.9 + 0.2 * vnoise2(L.xz * 900.0) * fd;
    }
  }
#endif
#ifdef K3
  if (kind == 3) {
    // 鱗：列になった鱗の縁（prm=鱗の大きさの逆数）
    float s = prm;
    vec2 g = vec2(L.z * s, L.y * s * 1.4);
    float row = floor(g.y);
    g.x += row * 0.5 + hashI2(ivec2(int(row), 23)) * 0.35;
    vec2 c = fract(g) - vec2(0.5, 0.5);
    float e = smoothstep(0.28, 0.5, length(c * vec2(1.0, 1.1) + vec2(0.18, 0.0)));
    alb *= 1.0 - e * 0.12 * detailFade(s * 1.4);
  }
#endif
  // ---- 光 ----
  float nl = dot(N, uSunDir);
  float sh = sunShadow(vWorld, max(nl, 0.2), gl_FragCoord.xy) * cloudShadow(vWorld);
  bool soft = kind == 0 || kind == 1 || kind == 7;
  float wrap = soft ? 0.38 : (thin ? 0.25 : 0.12);
  float diff = sat((nl + wrap) / (1.0 + wrap));
  float bakedAO = vMat.z;
  // 腹側は空の光が届きにくい
  float ao = mix(0.5, 1.0, sat(N.y * 0.5 + 0.55)) * bakedAO;
  vec3 col = alb * (uSunCol * diff * sh * mix(1.0, bakedAO, 0.5) + shIrr(N) * ao);
  // 地面・水面からの照り返し（下向きの面）。白い鳥の腹が沈みすぎない
  col += alb * uSunCol * vec3(0.1, 0.12, 0.085) * sat(-N.y) * max(uSunDir.y, 0.0) * bakedAO;
  // 毛羽・羽毛の縁の柔らかな光
  if (soft) {
    float rim = pow(1.0 - nv, 3.0);
    vec3 skyR = mix(shIrr(N), vec3(luma(shIrr(N))) * vec3(1.05, 1.0, 0.9), 0.55);   // 空の青を混ぜすぎない
    col += alb * rim * (skyR * 0.7 + uSunCol * sat(nl + 0.45) * sh * 0.45) * (kind == 1 ? 0.9 : 0.6) * bakedAO;
  }
  // 薄い部分（翼・耳・ひれ）は逆光で透ける
  if (thin) {
    float bt = pow(sat(dot(-V, uSunDir)), 2.0);
    col += alb * vec3(1.05, 0.85, 0.7) * uSunCol * bt * (kind == 6 || kind == 1 ? 0.6 : 0.25) * sh;
  }
  // 艶
  float gl = uGloss, pw = 40.0;
  if (kind == 2) { gl = 0.35; pw = 70.0; }
  else if (kind == 3) { gl = 0.7; pw = 70.0; }
  else if (kind == 4) { gl = 3.0; pw = 600.0; }
  else if (kind == 5) { gl = 0.3; pw = 45.0; }
  else if (kind == 0 && prm < -0.01) { gl = -prm; pw = 30.0; } // 金属光沢の羽（ツバメの背）
  vec3 Hs = uSunDir + V;
  vec3 H = Hs / max(length(Hs), 1e-5);
  col += uSunCol * pow(max(dot(N, H), 0.0), pw) * gl * sh * (soft ? 0.5 : 1.0);
  // 映りこみ（濡れた肌・鱗・目）
#if defined(K2) || defined(K3) || defined(K4)
  if (kind == 2 || kind == 3 || kind == 4) {
    vec3 R = reflect(-V, N);
    float fr = 0.03 + 0.97 * pow(1.0 - nv, 5.0);
    vec3 env = shIrr(R) * 1.25;
    if (kind == 4) {
      // 目：空の明るいところが小さく映る（キャッチライト）
      vec3 cat = shIrr(vec3(0.0, 1.0, 0.0)) * 3.0 * smoothstep(0.72, 0.9, R.y);
      col = mix(col, env * 0.5, fr * 0.5) + cat * 0.35;
    } else if (kind == 3) {
      // 銀色の体側（prm の大きい魚ほど鏡のよう）
      float silver = sat((luma(alb) - 0.4) * 2.5) * uGloss;
      col = mix(col, env * mix(vec3(1.0), alb * 1.5 + 0.2, 0.4), sat(fr * 0.45 + silver * 0.5));
    } else col = mix(col, env, fr * 0.22);
  }
#endif
  gl_FragColor = vec4(max(col, vec3(0.0)), 1.0);
#endif
}
`;

// たくさん並べる入れ物：毎フレーム begin → push → end
class Level {
  constructor(shared, geo, anim, { cap, gloss, shadow, lo, defines }) {
    this.cap = cap;
    this.geo = geo;
    const mk = (n) => { const a = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4); a.setUsage(THREE.DynamicDrawUsage); geo.setAttribute(n, a); return a; };
    this.a = mk('iA'); this.b = mk('iB'); this.c = mk('iC'); this.d = mk('iD');
    geo.instanceCount = 0;
    const uniforms = { ...shared, uGloss: { value: gloss }, uPxH: { value: 720 } };
    this.mat = new THREE.ShaderMaterial({ uniforms, vertexShader: CVS(anim), fragmentShader: CFS, defines, side: THREE.DoubleSide });
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.frustumCulled = false;
    // 描画先の高さ（細い毛を消す判定に使う）
    this.mesh.onBeforeRender = (r) => { const rt = r.getRenderTarget(); uniforms.uPxH.value = rt ? rt.height : r.domElement.height; };
    if (shadow) {
      // 近景・遠景とも近距離の影に描く（遠景は形が粗いので手間はわずか）
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

const SHARED_DEFINES = new Map();
// geo は1つ、または [近景, 遠景]。lv(距離) で段を選んで push する（距離 lod より遠いと遠景）
export class Herd {
  constructor(shared, geo, anim, { cap = 64, gloss = 0.05, shadow = false, name = '', lod = 30 } = {}) {
    const geos = Array.isArray(geo) ? geo : [geo];
    this.name = name;
    this.key = '_lv_' + name;
    this.lod = lod;
    // 使っている材質の種類。同じ動きの種（と近景・遠景）で定義を共有し、シェーダを1つにする
    //（定義は最初に描くときに読まれるので、あとから加わった種の分も入る）
    let defines = SHARED_DEFINES.get(anim);
    if (!defines) { defines = {}; SHARED_DEFINES.set(anim, defines); }
    for (const g of geos) { const M = g.attributes.aMat.array; for (let k = 0; k < M.length; k += 3) defines[`K${Math.round(M[k]) % 10}`] = ''; }
    this.levels = geos.map((g, i) => new Level(shared, g, anim, { cap, gloss, shadow, lo: i > 0, defines }));
    this.meshes = this.levels.map((l) => l.mesh);
    this.mesh = this.meshes[0];
    this.cap = cap;
  }
  // o（個体）を渡すと今の段を覚え、境目の前後で幅をもたせる（1コマごとの入れかわりを止める）
  lv(dist, o) {
    if (this.levels.length < 2) return this.levels[0];
    let far = dist > this.lod;
    if (o) { const k = this.key, was = o[k]; far = was ? dist > this.lod * 0.9 : dist > this.lod * 1.1; o[k] = far; }
    return this.levels[far ? 1 : 0];
  }
  get n() { return this.levels.reduce((s, l) => s + l.n, 0); }
  begin() { for (const l of this.levels) l.begin(); }
  push(...a) { this.levels[0].push(...a); }
  end() { for (const l of this.levels) l.end(); }
}

// ---- 足元の陰：地面に沿わせた板に、ぼかした楕円の暗さを掛ける（深度は書かない）----
// 近距離の日の影（1テクセル約5cm）では消えてしまう小さな生き物・細い脚の接地を見せる
const CONTACT_VS = /* glsl */ `
${ALL}
attribute vec4 iS;   // 中心x・中心z・横の半径・前後の半径
attribute vec4 iT;   // 向き・濃さ・浮き（地面からの高さ）・予備
varying vec2 vUv;
varying float vK;
void main() {
  vUv = position.xz;
  float c = cos(iT.x), s = sin(iT.x);
  vec2 o = vec2(position.x * iS.z, position.z * iS.w);
  vec2 xz = iS.xy + vec2(o.x * c + o.y * s, -o.x * s + o.y * c);
  float y = heightAt(xz) + 0.01;
  // 地面から離れるほど薄く・広く
  vK = iT.y * (1.0 - smoothstep(0.0, 1.0, iT.z / max(0.6 * max(iS.z, iS.w), 0.02)));
  // 地形の三角形と補間の差で地面に埋もれないよう、視線に沿って手前へ寄せる（画面上の位置は変わらない）
  vec3 wp = vec3(xz.x, y, xz.y);
  vec3 tc = cameraPosition - wp;
  float dc = length(tc);
  wp += tc / max(dc, 1e-3) * min(0.3, 0.05 + 0.012 * dc);
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
}
`;
const CONTACT_FS = /* glsl */ `
varying vec2 vUv;
varying float vK;
void main() {
  // 中心が広く濃く、縁へなだらかに消える楕円（板の四隅は必ず0）
  float r2 = dot(vUv, vUv);
  float e = 1.0 - smoothstep(0.0, 1.0, r2);
  float a = e * e * (0.55 + 0.45 * exp(-r2 * 5.0));
  gl_FragColor = vec4(vec3(0.0), clamp(vK * a, 0.0, 0.85));
}
`;
export class Contacts {
  constructor(shared, cap = 800) {
    this.cap = cap;
    const g = new THREE.InstancedBufferGeometry();
    // 地面の起伏に沿うよう細かめの格子
    const N = 6, P = [], I = [];
    for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) P.push((i / N) * 2 - 1, 0, (j / N) * 2 - 1);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const a = j * (N + 1) + i; I.push(a, a + N + 1, a + 1, a + 1, a + N + 1, a + N + 2); }
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    g.setIndex(I);
    const mk = (n) => { const a = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4); a.setUsage(THREE.DynamicDrawUsage); g.setAttribute(n, a); return a; };
    this.s = mk('iS'); this.t = mk('iT');
    g.instanceCount = 0;
    this.geo = g;
    this.mat = new THREE.ShaderMaterial({
      uniforms: { ...shared }, vertexShader: CONTACT_VS, fragmentShader: CONTACT_FS,
      transparent: true, depthWrite: false, depthTest: true,
      // 黒を濃さ分だけ重ねる＝下の色に (1-濃さ) を掛ける
      blending: THREE.NormalBlending,
    });
    this.mesh = new THREE.Mesh(g, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 5;
    this.n = 0;
  }
  begin() { this.n = 0; }
  // x,z：中心、rx,rz：横・前後の半径(m)、yaw：向き、k：濃さ、h：地面からの高さ
  push(x, z, rx, rz, yaw, k, h = 0) {
    if (this.n >= this.cap || k <= 0.003) return;
    const o = this.n * 4, S = this.s.array, T = this.t.array;
    S[o] = x; S[o + 1] = z; S[o + 2] = rx; S[o + 3] = rz;
    T[o] = yaw; T[o + 1] = k; T[o + 2] = Math.max(0, h); T[o + 3] = 0;
    this.n++;
  }
  end() {
    this.geo.instanceCount = this.n;
    for (const at of [this.s, this.t]) { at.clearUpdateRanges(); at.addUpdateRange(0, Math.max(1, this.n) * 4); at.needsUpdate = true; }
  }
}
