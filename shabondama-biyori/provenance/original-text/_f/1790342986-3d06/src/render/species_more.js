// 生きもの（追加分）の形と動き：キツネ・タヌキ・ニホンリス・ニワトリ・ネコ・イシガメ・アメンボ・オタマジャクシ
// 形は creatures.js の MeshB で組み、材質（毛・羽・甲羅・目・濡れた鼻）を頂点ごとに持たせて、専用の材質で描く
import * as THREE from 'three';
import { ALL, SHADOW } from './glsl.js';
import { MeshB } from './creatures_base.js';

const mix3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const mul3 = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const hash = (x, y, z) => { const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return s - Math.floor(s); };
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
// なめらかな値の雑音（毛色のむら・三毛の斑）
const vn3 = (x, y, z) => {
  const i = Math.floor(x), j = Math.floor(y), k = Math.floor(z);
  const u = x - i, v = y - j, w = z - k;
  const f = (t) => t * t * (3 - 2 * t);
  const a = f(u), b = f(v), c = f(w);
  const L = (p, q, t) => p + (q - p) * t;
  return L(L(L(hash(i, j, k), hash(i + 1, j, k), a), L(hash(i, j + 1, k), hash(i + 1, j + 1, k), a), b),
    L(L(hash(i, j, k + 1), hash(i + 1, j, k + 1), a), L(hash(i, j + 1, k + 1), hash(i + 1, j + 1, k + 1), a), b), c);
};

// 材質の番号
export const M = { FUR: 0, SKIN: 1, EYE: 2, NOSE: 3, SHELL: 4, FEATHER: 5, COMB: 6, KERATIN: 7, CHITIN: 8, WING: 9, BARK: 10, TAB_BODY: 11, TAB_LEG: 12, TAB_TAIL: 13, TAB_HEAD: 14 };

// 材質の番号を頂点ごとに持つ MeshB
class MeshX extends MeshB {
  constructor() { super(); this.Mt = []; this.mat = 0; }
  vert(p, n, c, a) { this.Mt.push(this.mat); return super.vert(p, n, c, a); }
  with(mat, fn) { const o = this.mat; this.mat = mat; fn(); this.mat = o; return this; }
  // 真上へ向かう節では、MeshB の代わりの上向き [0,0,1] が横向きを左右反対にして、管がねじれて段になる。
  // 上へ向かう節だけ [0,0,-1] を使い、となりの節と横向きをそろえる（首・立てた尾）
  tube(rings, segs, col, part, capA = true, capB = true) {
    const nR = rings.length;
    const rs = rings.map((r, i) => {
      if (r.up) return r;
      const a = rings[Math.max(0, i - 1)].p, b = rings[Math.min(nR - 1, i + 1)].p;
      const tx = b[0] - a[0], ty = b[1] - a[1], tz = b[2] - a[2];
      const tl = Math.hypot(tx, ty, tz) || 1;
      return ty / tl > 0.95 ? { ...r, up: [0, 0, -1] } : r;
    });
    return super.tube(rs, segs, col, part, capA, capB);
  }
  build() {
    const g = super.build();
    g.setAttribute('aMat', new THREE.Float32BufferAttribute(this.Mt, 1));
    return g;
  }
}

// ---- 材質 ----
const XVS = (anim) => /* glsl */ `
${ALL}
${SHADOW}
attribute vec3 aCol;
attribute vec4 aPart;   // x=部位 y=部位の中の位置(0..1) z=左右 w=予備
attribute float aMat;
attribute vec4 iA;      // 位置xyz・向き（y軸まわり）
attribute vec4 iB;      // 前後の傾き・横の傾き・大きさ・時間
attribute vec4 iC;      // 姿勢（種ごとの意味）
attribute vec4 iD;      // 姿勢2・個体差
varying vec3 vN;
varying vec3 vWorld;
varying vec3 vCol;
varying vec3 vLocal;
varying float vMat;
varying float vThin;
varying float vWet;
varying float vSeed;
mat3 rotX(float a) { float c = cos(a), s = sin(a); return mat3(1.0, 0.0, 0.0, 0.0, c, s, 0.0, -s, c); }
mat3 rotY(float a) { float c = cos(a), s = sin(a); return mat3(c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c); }
mat3 rotZ(float a) { float c = cos(a), s = sin(a); return mat3(c, s, 0.0, -s, c, 0.0, 0.0, 0.0, 1.0); }
vec3 rotAbout(vec3 p, vec3 o, mat3 R) { return o + R * (p - o); }
float vThinOut = 0.0;
float vWetOut = 0.0;
${anim}
void main() {
  vec3 p = position;
  vec3 n = normal;
  vec3 col = aCol;
  vLocal = position;
  animate(p, n, col);
  mat3 R = rotY(iA.w) * rotX(iB.x) * rotZ(iB.y);
  vec3 wp = iA.xyz + R * (p * iB.z);
  vN = R * n;
  vWorld = wp;
  vCol = col;
  vMat = aMat;
  vThin = vThinOut;
  vWet = vWetOut;
  vSeed = iD.w;
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
}
`;
const XFS = /* glsl */ `
${ALL}
${SHADOW}
varying vec3 vN;
varying vec3 vWorld;
varying vec3 vCol;
varying vec3 vLocal;
varying float vMat;
varying float vThin;
varying float vWet;
varying float vSeed;
uniform float uFurF;     // 毛の細かさ（1mあたり）
uniform float uGAO;      // 地面の近くが暗くなる高さ（m）
float ggx(float nh, float a) { float a2 = a * a; float d = nh * nh * (a2 - 1.0) + 1.0; return a2 / (PI * d * d + 1e-5); }
void main() {
#ifdef DEPTH
  gl_FragColor = vec4(1.0);
#else
  int mt = int(vMat + 0.5);
  vec3 N = vN;
  float nlen = length(N);
  N = nlen > 1e-5 ? N / nlen : vec3(0.0, 1.0, 0.0);
  vec3 V = cameraPosition - vWorld;
  float dist = length(V);
  V = V / max(dist, 1e-4);
  if (dot(N, V) < 0.0 && vThin > 0.5) N = -N;
  vec3 alb = vCol;
  // ネコのきじ縞（11 胴・12 脚・13 尾・14 頭）：立ち姿の形の座標で描く。白い毛（頂点色の明るい所）には入れない。描いたあとはふつうの毛
  if (mt >= 11 && mt <= 14) {
    vec3 L = vLocal;
    float tabK = 1.0 - smoothstep(0.4, 0.58, min(alb.r, min(alb.g, alb.b)));
    float ph = 0.0, dark = 0.0;
    if (mt == 11) {
      // 鯖虎：背骨と直角に回る縞が脇腹で後ろへ流れる。背すじは濃い一本の線
      ph = L.z * 250.0 + (0.22 - L.y) * 70.0 + vnoise2(vec2(L.z * 30.0, L.y * 30.0 + abs(L.x) * 25.0) + vSeed * 3.0) * 5.0 + vnoise2(vec2(L.z * 90.0, L.y * 90.0)) * 1.6;
      dark = smoothstep(0.016, 0.006, abs(L.x)) * smoothstep(0.18, 0.205, L.y) * 0.8;
    } else if (mt == 12) {
      ph = L.y * 230.0 + vnoise2(L.xz * 40.0) * 2.5;
    } else if (mt == 13) {
      float d = length(L - vec3(0.0, 0.185, -0.19));
      ph = d * 140.0 + 1.0;
      dark = smoothstep(0.235, 0.265, d);
    } else {
      vec3 h = L - vec3(0.0, 0.238, 0.203);
      // 額から後頭部へのびる細い縞
      ph = abs(h.x) * 320.0 + vnoise2(h.yz * 60.0) * 1.4 + 1.2;
      tabK *= smoothstep(0.0, 0.018, h.y + h.z * 0.25);
    }
    float fs = sat(1.3 - fwidth(ph) * 0.3);
    // 縞はところどころ切れる（鯖虎のまだら）
    float brk = mix(0.55, 1.0, smoothstep(0.3, 0.6, vnoise2(vec2(L.z * 60.0 + L.x * 40.0, L.y * 60.0) + 7.0)));
    float st = max(mix(0.4, smoothstep(-0.15, 0.6, sin(ph)), fs) * brk, dark);
    alb = mix(alb, alb * vec3(0.3, 0.27, 0.25), st * tabK * 0.85);
    mt = 0;
  }
  // 毛・羽の細かい筋：画面で細かすぎるところは消す（ちらつき防止）
  vec3 lp = vLocal * uFurF;
  vec3 fw = fwidth(lp);
  float fade = sat(1.6 - max(fw.x, max(fw.y, fw.z)) * 1.2);
  float grain = 0.0;
  if ((mt == 0 || mt == 5) && fade > 0.0) {
    // 毛並み：体の前後にのびる筋（z に沿って長く、横に細かい）
    float s1 = vnoise2(vec2(lp.x + lp.y + vSeed * 17.0, lp.z * 0.16));
    float s2 = vnoise2(vec2(lp.y * 1.7 - lp.x * 1.3 + 31.0, lp.z * 0.22));
    grain = (s1 * 0.6 + s2 * 0.4 - 0.5) * fade;
  }
  // 毛の房（筋より大きな、ふさのむら）：遠くでも効く
  vec3 lq = vLocal * uFurF * 0.06;
  float fq = sat(1.8 - max(fwidth(lq).x, max(fwidth(lq).y, fwidth(lq).z)) * 1.4);
  float clump = 0.0;
  if ((mt == 0 || mt == 5) && fq > 0.0) clump = (vnoise2(vec2(lq.x + lq.y + vSeed * 5.0, lq.z * 0.4)) - 0.5) * fq;
  if (mt == 0) alb *= 1.0 + grain * 0.4 + clump * 0.35;
  if (mt == 5) {
    alb *= 1.0 + grain * 0.2 + clump * 0.2;
    // 羽の重なり：後ろへ向いた丸い羽先が鱗のように並ぶ（縁は濃く、羽の中ほどはわずかに明るい）
    vec2 fc = vec2((vLocal.y + abs(vLocal.x) * 0.9) * 62.0, vLocal.z * 52.0);
    float row = floor(fc.y);
    fc.x += 0.5 * mod(row, 2.0);
    vec2 ff = fract(fc) - vec2(0.5, 0.0);
    float e = length(ff * vec2(1.0, 0.85));
    float fsc = sat(1.4 - max(fwidth(fc.x), fwidth(fc.y)) * 1.6);
    float rim = smoothstep(0.36, 0.5, e) * (1.0 - smoothstep(0.5, 0.6, e));
    float cj = fract(sin(dot(floor(fc), vec2(12.9898, 78.233)) + vSeed * 7.0) * 43758.5453);
    alb *= mix(1.0, (1.0 - 0.13 * rim) * (0.95 + 0.1 * cj) * (1.0 + 0.05 * (1.0 - e)), fsc);
  }
  // 甲羅：鱗板の溝と成長輪（形の座標で描く）
  if (mt == 4) {
    vec2 q = vec2(vLocal.x / 0.07, vLocal.z / 0.09);
    float ax = abs(q.x);
    float row = ax < 0.3 ? 0.0 : ax < 0.78 ? 1.0 : 2.0;
    float nseg = row == 0.0 ? 5.0 : row == 1.0 ? 4.0 : 11.0;
    float along = (q.y * 0.5 + 0.5) * nseg + (row == 1.0 ? 0.5 : 0.0);
    float fa = fract(along), fd = min(fa, 1.0 - fa);
    float gw = 0.03 * nseg;
    float groove = max(1.0 - smoothstep(0.0, gw, fd), max(1.0 - smoothstep(0.0, 0.035, abs(ax - 0.3)), 1.0 - smoothstep(0.0, 0.035, abs(ax - 0.78))));
    // 鱗板の中心へ向かう同心の成長輪
    float cx = row == 0.0 ? 0.0 : row == 1.0 ? 0.54 : 0.9;
    float rr = length(vec2((ax - cx) * 2.2, (fa - 0.5)));
    float rings = 0.5 + 0.5 * sin(rr * 40.0 + vSeed * 6.0);
    float fr = sat(1.5 - fwidth(rr * 40.0) * 0.8);
    alb *= mix(1.0, 0.82 + 0.3 * rings, fr * 0.6) * (1.0 - 0.6 * groove * sat(1.4 - fwidth(along) * 3.0));
    alb *= 0.9 + 0.25 * vnoise2(vLocal.xz * 180.0 + vSeed * 9.0);
  }
  // 流木：樹皮の縦の割れ目（皮の残る所は深く、はがれて白く晒けた所は細い木目）・上面の苔・水ぎわの濡れ
  float wetB = 0.0;
  if (mt == 10) {
    float ang = atan(vLocal.x, vLocal.y + 1e-5);
    vec2 bq = vec2(ang * 0.1 * 70.0, vLocal.z * 7.0);
    float lum = dot(alb, vec3(0.33));
    float barkK = 1.0 - sat((lum - 0.2) * 5.0);
    float fb = sat(1.5 - max(fwidth(bq.x), fwidth(bq.y)) * 1.2);
    float ridge = vnoise2(bq + vSeed * 13.0) * 0.65 + vnoise2(bq * vec2(2.3, 1.7) + 7.0) * 0.35;
    float grainL = 0.5 + 0.5 * sin(ang * 90.0 + vnoise2(vec2(ang * 12.0, vLocal.z * 3.0)) * 6.0);
    alb *= mix(1.0, mix(0.8 + 0.3 * grainL, 0.35 + 0.8 * smoothstep(0.25, 0.65, ridge), barkK), fb);
    float moss = smoothstep(0.55, 0.9, N.y) * smoothstep(0.45, 0.7, vnoise2(vWorld.xz * 9.0 + vSeed * 3.0));
    alb = mix(alb, vec3(0.06, 0.1, 0.03), moss * 0.7);
    float wl = texelFetch(tHW, worldTexel(vWorld.xz), 0).g;
    wetB = wl > -100.0 ? smoothstep(wl + 0.07, wl - 0.01, vWorld.y) : 0.0;
    alb *= mix(1.0, 0.5, wetB);
  }
  float nl = dot(N, uSunDir);
  float sh = sunShadow(vWorld, max(nl, 0.2), gl_FragCoord.xy) * cloudShadow(vWorld);
  // 地面に近いところ（腹の下・脚の付け根）は空の光がとどきにくい
  float gh = vWorld.y - heightAt(vWorld.xz);
  float gao = mix(0.55, 1.0, sat(gh / max(uGAO, 1e-3)));
  float ao = (0.6 + 0.4 * sat(N.y * 0.5 + 0.6)) * gao;
  vec3 H = normalize(uSunDir + V);
  float nh = max(dot(N, H), 0.0), nv = max(dot(N, V), 0.0);
  vec3 col;
  // 白い毛・羽は空の青みを少し抑える（日陰で青く見えないように）
  float whiteK = sat((min(alb.r, min(alb.g, alb.b)) - 0.35) * 3.0);
  if (mt == 0 || mt == 5) {
    // 毛・羽：光が回りこむ拡散＋縁の柔らかい照り（逆光で輪郭が光る）
    float diff = sat((nl + 0.35) / 1.35);
    vec3 irr = shIrr(N);
    irr = mix(irr, vec3(dot(irr, vec3(0.3, 0.45, 0.25))) * vec3(1.02, 1.0, 0.96), whiteK * 0.55);
    col = alb * (uSunCol * diff * sh + irr * ao);
    float rim = pow(1.0 - nv, 3.0);
    col += alb * uSunCol * rim * (0.35 + 0.9 * pow(sat(dot(-V, uSunDir)), 2.0)) * sh * sat(nl + 0.6);
    col += alb * irr * rim * 0.35 * ao;
    // 毛先のにぶい艶
    col += uSunCol * 0.035 * pow(nh, 12.0) * sh * (1.0 + grain);
  } else {
    float diff = max(nl, 0.0);
    if (mt == 1 || mt == 6) diff = sat((nl + 0.2) / 1.2);
    col = alb * (uSunCol * diff * sh + shIrr(N) * ao);
    float rough = mt == 2 ? 0.08 : mt == 3 ? 0.28 : mt == 4 ? mix(0.5, 0.14, vWet) : mt == 6 ? 0.4 : mt == 7 ? 0.35 : mt == 8 ? 0.3 : mt == 9 ? 0.25 : mt == 10 ? mix(0.8, 0.25, wetB) : 0.6;
    float ks = mt == 2 ? 1.0 : mt == 3 ? 0.35 : mt == 4 ? mix(0.05, 0.5, vWet) : mt == 6 ? 0.12 : mt == 7 ? 0.2 : mt == 8 ? 0.35 : mt == 9 ? 0.4 : mt == 10 ? mix(0.02, 0.4, wetB) : 0.04;
    float F = 0.04 + 0.96 * pow(1.0 - nv, 5.0);
    // 鏡面の輝きには上限（目の小さな点が被写界深度で光の輪に広がらないように）
    col += uSunCol * min(ggx(nh, rough) * ks * F * 0.25, 1.5) * max(nl, 0.0) * sh;
    // 空の映り込み（目・濡れた甲羅）
    if (mt == 2 || mt == 4 || mt == 9) col += shIrr(reflect(-V, N)) * F * ks * 0.8;
    // 薄い部分（鶏冠・耳・翅）は逆光で透ける
    if (vThin > 0.5 || mt == 6) col += alb * uSunCol * pow(sat(dot(-V, uSunDir)), 2.0) * 0.6 * sh;
  }
  if (vThin > 0.5 && (mt == 0 || mt == 1)) col += alb * uSunCol * vec3(1.0, 0.55, 0.4) * pow(sat(dot(-V, uSunDir)), 2.0) * 0.7 * sh;
  gl_FragColor = vec4(max(col, vec3(0.0)), 1.0);
#endif
}
`;

// たくさん並べる入れ物（creatures.js の Herd と同じ使い方：begin → push → end）
export class HerdX {
  constructor(shared, geo, anim, { cap = 16, shadow = false, fur = 700, gao = 0.2, name = '' } = {}) {
    this.cap = cap;
    this.geo = geo;
    this.name = name;
    const mk = (n) => { const a = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4); a.setUsage(THREE.DynamicDrawUsage); geo.setAttribute(n, a); return a; };
    this.a = mk('iA'); this.b = mk('iB'); this.c = mk('iC'); this.d = mk('iD');
    geo.instanceCount = 0;
    const uniforms = { ...shared, uFurF: { value: fur }, uGAO: { value: gao } };
    this.mat = new THREE.ShaderMaterial({ uniforms, vertexShader: XVS(anim), fragmentShader: XFS, side: THREE.DoubleSide });
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.frustumCulled = false;
    if (shadow) {
      this.mesh.userData.depthMaterial = new THREE.ShaderMaterial({ uniforms, vertexShader: XVS(anim), fragmentShader: XFS, defines: { DEPTH: '' }, side: THREE.DoubleSide });
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

// ---- 形の道具：なめらかな線で胴・脚を組む ----
const cr = (a, b, c, d, t) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t);
function spline(keys, n) {
  const out = [], K = keys.length;
  for (let i = 0; i <= n; i++) {
    const fk = (i / n) * (K - 1), k = Math.min(K - 2, Math.floor(fk)), t = fk - k;
    const a = keys[Math.max(0, k - 1)], b = keys[k], c = keys[k + 1], d = keys[Math.min(K - 1, k + 2)];
    out.push(b.map((_, j) => cr(a[j], b[j], c[j], d[j], t)));
  }
  return out;
}
// 胴：[z, 背の高さ, 腹の高さ, 半幅] の節を背骨に沿って補間
function body(m, keys, n, segs, col, part, capA = true, capB = true) {
  const rings = spline(keys, n).map(([z, top, bot, hw]) => ({ p: [0, (top + bot) / 2, z], rx: Math.max(hw, 2e-4), ry: Math.max((top - bot) / 2, 2e-4) }));
  m.tube(rings, segs, col, part, capA, capB);
}
// 手足・首・尾：[x, y, z, 太さ] の節を補間。ry は太さ×asp
function limb(m, pts, n, segs, col, part, asp = 1.0, up = null) {
  m.tube(spline(pts, n).map(([x, y, z, r]) => ({ p: [x, y, z], rx: r, ry: r * asp, ...(up ? { up } : {}) })), segs, col, part);
}
// 背（上）ほど濃く、腹ほど淡い毛色
const shade3 = (up, back, side, belly, lo = -0.35, hi = 0.75) => (up > hi ? mix3(side, back, sstep(hi, 1.0, up)) : up < lo ? mix3(side, belly, sstep(lo, lo - 0.3, up)) : side);

// ---- 四つ足の共通の動き ----
// 部位: 0 胴 1 頭 3 鼻先 4 尾 5 脚 6 首 8 目 9 耳
// iC: x=歩みの位相(rad) y=歩みの強さ（0 立つ 0.5 歩く 0.8 速足 1 駆ける） z=頭を下げる（嗅ぐ・食む） w=尾を上げる
// iD: x=伏せる（0..1）／すわる（-1..0） y=頭の左右（rad） z=尾を振る強さ w=個体差
// 脚の aPart: y=付け根0〜足先1 z=左右 w=後脚
const f = (v) => (Number.isInteger(v) ? v.toFixed(1) : String(+v.toFixed(5)));
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const clampN = (x, a, b) => Math.min(b, Math.max(a, x));
const wrapA = (a) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
// すわる姿勢を解く：上体を sitA 起こし、背を sitComp 縮め、前脚が胸の真下でまっすぐ地面に届く高さまで腰を落とす。
// 後脚は 腿→膝→かかと→足の甲→指 の関節ごとに回して、腿を前へたたみ、かかとと足の甲を地面につける
function solveSit(o) {
  const A = o.sitA, comp = o.sitComp ?? 0;
  const dy = o.hipF - o.hipH, dz = o.zF - o.zH - comp;
  const drop = o.sitDrop ?? Math.max(0, o.hipH + dy * Math.cos(A) + dz * Math.sin(A) - o.hipF);
  const out = { drop, fk: null };
  const K = o.hindKeys;
  if (!K) return out;
  const n = K.length, J = (i) => [K[i][1], K[i][2]], R = (i) => K[i][3];
  const j0 = [o.hipH, o.zH], j1 = J(o.knee), j2 = J(o.hock), j3 = J(o.paw), j4 = J(n - 1);
  const L = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const Lt = L(j0, j1), Ls = L(j1, j2), Lm = L(j2, j3), Lp = L(j3, j4);
  const hs = o.hipH - drop;
  // 膝：腰の少し下の高さで前へ
  const kneeY = Math.max(hs * (o.kneeK ?? 0.8), R(o.knee) + 0.008);
  const phi = Math.asin(clampN((kneeY - hs) / Lt, -1, 1));
  const knee = [kneeY, o.zH + Lt * Math.cos(phi)];
  const hockY = R(o.hock) + 0.002;
  const dk = knee[0] - hockY;
  const hock = [hockY, knee[1] - Math.sqrt(Math.max(0, Ls * Ls - dk * dk))];
  const pawY = Math.max(R(o.paw), K[o.paw][1]);
  const paw = [pawY, hock[1] + Math.sqrt(Math.max(0, Lm * Lm - (hockY - pawY) ** 2))];
  const toe = [K[n - 1][1], paw[1] + Math.sqrt(Math.max(0, Lp * Lp - (pawY - K[n - 1][1]) ** 2))];
  const th = (a, b) => Math.atan2(b[0] - a[0], b[1] - a[1]);
  const D = [th(j0, j1), th(j1, j2), th(j2, j3), th(j3, j4)];
  const E = [th([hs, o.zH], knee), th(knee, hock), th(hock, paw), th(paw, toe)];
  const d = D.map((x, i) => wrapA(E[i] - x));
  // rotX(a) は (z,y) の角度を -a 回す
  const ang = [-d[0], -wrapA(d[1] - d[0]), -wrapA(d[2] - d[1]), -wrapA(d[3] - d[2])];
  const u = (i) => i / (n - 1);
  out.fk = { ang, J: [j0, j1, j2, j3], u: [0, u(o.knee), u(o.hock), u(o.paw)] };
  return out;
}
export function quadAnim(o) {
  const sv = solveSit(o);
  const comp = o.sitComp ?? 0;
  const fk = sv.fk;
  const v2 = (q) => `${f(q[0])}, ${f(q[1])}`;
  const fkCode = fk ? `
    // すわる：後脚は関節ごとに（足先→付け根の順に、休みの姿勢の関節のまわりで回す）
    vec3 q = position, qn = normal;
    float uu = aPart.y;
    ${[3, 2, 1].map((k) => `{ float w = smoothstep(${f(fk.u[k] - 0.05)}, ${f(fk.u[k] + 0.05)}, uu); mat3 Rk = rotX(${f(fk.ang[k])} * w); vec3 o = vec3(0.0, ${v2(fk.J[k])}); q = rotAbout(q, o, Rk); qn = Rk * qn; }`).join('\n    ')}
    { mat3 Rk = rotX(${f(fk.ang[0])}); vec3 o = vec3(0.0, ${v2(fk.J[0])}); q = rotAbout(q, o, Rk); qn = Rk * qn; }
    q.y -= ${f(sv.drop)};
    q.y = max(q.y, 0.004);
    p = mix(p, q, sit); n = mix(n, qn, sit);` : `
    p = rotAbout(p, pv, rotX(-1.25 * sit)); n = rotX(-1.25 * sit) * n;
    p.y -= sit * ${f(sv.drop)};`;
  return /* glsl */ `
void animate(inout vec3 p, inout vec3 n, inout vec3 col) {
  int part = int(aPart.x + 0.5);
  float ph = iC.x, amp = iC.y;
  float lie = max(iD.x, 0.0), sit = max(-iD.x, 0.0);
  float drop = lie * ${f(o.drop)};
  float seed = iD.w * 37.0;
  float wside = iD.w > 0.5 ? 1.0 : -1.0;
  // すわる：後ろの腰を軸に上体を起こし、腰を落とす
  vec3 hipP = vec3(0.0, ${f(o.hipH)}, ${f(o.zH)});
  mat3 Rs = rotX(-sit * ${f(o.sitA)});
  float sDrop = sit * ${f(sv.drop)};
  if (part == 5) {
    float side = aPart.z;
    bool hind = aPart.w > 0.5;
    vec3 pv = vec3(${f(o.legX)} * side, hind ? ${f(o.hipH)} : ${f(o.hipF)}, hind ? ${f(o.zH)} : ${f(o.zF)});
    // 歩き：左後→左前→右後→右前。速足：対角がそろう。駆け足：前後の対がそろう
    float off;
    if (amp < 0.65) off = hind ? (side < 0.0 ? 0.0 : 3.1416) : (side < 0.0 ? 1.5708 : 4.7124);
    else if (amp < 0.9) off = hind ? (side < 0.0 ? 3.1416 : 0.0) : (side < 0.0 ? 0.0 : 3.1416);
    else off = hind ? (side < 0.0 ? 3.1416 : 3.5) : (side < 0.0 ? 0.0 : 0.35);
    float g = sat(amp * 3.0) * (1.0 - sit);
    float sw = sin(ph + off);
    float a = sw * mix(0.3, ${f(o.runSwing ?? 0.8)}, sat(amp * 2.0 - 1.0)) * g;
    // 前へ振り出すあいだは膝から先をたたむ
    float fold = max(0.0, -cos(ph + off)) * aPart.y * ${f(o.fold ?? 1.1)} * g;
    float ang = a + (hind ? -fold * 0.8 : fold);
    // 伏せる：前脚は胸の下へたたみ、後脚は腹の下へ
    ang = mix(ang, hind ? -1.3 : ${f(o.lieF ?? 1.45)}, lie);
    if (hind) {
      mat3 R = rotX(ang);
      p = rotAbout(p, pv, R); n = R * n;
      p.y -= drop;
      p.y = max(p.y, 0.004 * aPart.y * lie);
      ${fkCode}
    } else {
      // すわる：前脚は胸の真下でまっすぐ地面へ（上体を起こした分だけ肩で戻す）
      ang += sit * (${f(o.sitA)} + ${f(o.sitFront ?? 0)});
      ${o.sitElbow ? `{ float w = smoothstep(${f(o.elbowU - 0.06)}, ${f(o.elbowU + 0.06)}, aPart.y); mat3 Re = rotX(${f(o.sitElbow)} * w * sit); vec3 eo = vec3(0.0, ${f(o.elbowP[0])}, ${f(o.elbowP[1])}); p = rotAbout(p, eo, Re); n = Re * n; }` : ''}
      mat3 R = rotX(ang);
      p = rotAbout(p, pv, R); n = R * n;
      p.z -= sit * ${f(comp)};
      p = rotAbout(p, hipP, Rs); n = Rs * n;
      p.y -= drop + sDrop;
      p.y = max(p.y, 0.004 * aPart.y * max(lie, sit));
    }
  } else {
    if (part == 1 || part == 3 || part == 6 || part == 8 || part == 9) {
      // 首：付け根は胴と同じ、先は頭と同じ回り方。途中はなめらかに混ぜる（首の管が折れない）
      float t = part == 6 ? aPart.y : 1.0;
      float w = t * t * (3.0 - 2.0 * t);
      vec3 nb = vec3(0.0, ${f(o.neckY)}, ${f(o.neckZ)});
      if (part == 9) {
        // 耳：ときどきぴくっと動く
        vec3 eb = vec3(${f(o.earX)} * aPart.z, ${f(o.earY)}, ${f(o.earZ)});
        float tw = pow(max(0.0, sin(uTime * 0.9 + seed + aPart.z)), 40.0);
        mat3 E = rotZ(aPart.z * tw * 0.35) * rotX(-tw * 0.2 - lie * 0.15);
        p = rotAbout(p, eb, E); n = E * n;
        vThinOut = 1.0;
      }
      mat3 Rh = rotY(iD.y * w) * rotX((iC.z * ${f(o.headDown)} + lie * ${f(o.lieHead ?? 0.25)} + sit * ${f(o.sitHead ?? 0.5)}) * w);
      p = rotAbout(p, nb, Rh); n = Rh * n;
      p.z -= sit * ${f(comp)};
    } else if (part == 4) {
      // 尾：付け根から。u=尾の先ほど大きく曲がる
      vec3 tb = vec3(0.0, ${f(o.tailY)}, ${f(o.tailZ)});
      float u = aPart.y;
      float wave = sin(uTime * ${f(o.tailF ?? 2.0)} + seed - u * 2.0) * iD.z;
      float rest = max(lie, sit);
      mat3 Rt = rotY(wave * 0.6 * u + rest * ${f(o.tailWrap ?? 0.0)} * u * wside) * rotX(iC.w * ${f(o.tailLift ?? 0.6)} * u + amp * ${f(o.tailRun ?? 0.15)} * u - rest * ${f(o.tailLie ?? 0.3)} * u);
      p = rotAbout(p, tb, Rt); n = Rt * n;
    } else if (part == 0) {
      // 息づかい
      float br = 1.0 + 0.012 * sin(uTime * ${f(o.breath ?? 2.2)} + seed);
      p.x *= br; p.y = ${f(o.bodyY)} + (p.y - ${f(o.bodyY)}) * br;
      // すわると背が縮む（胸が腰へ寄る）
      p.z -= sit * ${f(comp)} * smoothstep(${f(o.zH)}, ${f(o.zF)}, p.z);
    }
    p = rotAbout(p, hipP, Rs); n = Rs * n;
    p.y -= drop + sDrop;
    // すわった尻は地面で平たくなる
    if (part == 0 || part == 4) p.y = mix(p.y, max(p.y, 0.006), sit);
  }
}
`;
}

// 耳：付け根から先へ細くなる、薄い葉の形の筒（前面は内側の色）
function ear(m, base, tip, w, thick, sx, colOut, colIn, tipCol = null, round = false) {
  const rings = [];
  for (let i = 0; i <= 6; i++) {
    const t = i / 6;
    // round：先の丸い半楕円の耳（リス）。ふつうは先の尖った三角
    const wd = round ? w * Math.sqrt(Math.max(0, 1 - Math.pow(t, 2.2))) + 0.0008 : w * Math.pow(Math.sin(Math.PI * (0.5 + 0.5 * t)), 0.8) * (1 - t * 0.1) + 0.001;
    rings.push({ p: mix3(base, tip, t), rx: wd, ry: thick * (1 - t * 0.6) + 0.0006, up: [0, 0, 1] });
  }
  m.tube(rings, 10, (u, th) => {
    const front = Math.sin(th) > 0.15;
    let c = front ? mix3(colIn, colOut, sstep(0.55, 0.95, Math.abs(Math.cos(th)))) : colOut;
    if (tipCol && u > 0.72) c = tipCol;
    return c;
  }, () => [9, 0, sx, 0]);
}
function eye(m, c, r, iris, sx, fwd = 0.35) {
  m.with(M.EYE, () => {
    m.ellipsoid(c, [r, r, r], 10, 8, (v, th, p) => {
      // 外（横）と前を向いた面の真ん中が瞳
      const d = [(p[0] - c[0]) / r, (p[1] - c[1]) / r, (p[2] - c[2]) / r];
      const facing = d[0] * sx * (1 - fwd) + d[2] * fwd;
      return facing > 0.8 ? [0.008, 0.006, 0.005] : facing > 0.45 ? iris : mul3(iris, 0.35);
    }, () => [8, 0, sx, 0]);
  });
}
const colLeg = (fn) => (u, th, p) => mul3(fn(u, p), u < 0.12 ? 0.75 + u * 2 : 1);

// ---- キツネ（ホンドギツネ） ----
export const FOX = { drop: 0.21, legX: 0.05, hipF: 0.33, hipH: 0.35, zF: 0.17, zH: -0.24, neckY: 0.39, neckZ: 0.22, earX: 0.032, earY: 0.53, earZ: 0.35, headDown: 0.9, tailY: 0.37, tailZ: -0.33, bodyY: 0.34, tailLift: 0.6, tailRun: 0.25, tailLie: 0.55, tailWrap: 1.6, runSwing: 0.95, sitA: 0.95, sitComp: 0.05, sitHead: 0.8, lieHead: 0.45, knee: 1, hock: 3, paw: 4 };
FOX.hindKeys = [[0.03, 0.37, -0.25, 0.047], [0.052, 0.24, -0.18, 0.034], [0.051, 0.15, -0.25, 0.018], [0.049, 0.09, -0.285, 0.013], [0.048, 0.02, -0.265, 0.012], [0.048, 0.01, -0.238, 0.012]];
// 胴を前後に約9cm縮める（形を組んでから頂点ごとに z を写す。動きの軸も同じ写しで合わせる）
const foxZ = (z) => (z > 0.3 ? z - 0.036 : z < -0.35 ? z + 0.055 : 0.86 * z + 0.006);
const foxDZ = (z) => (z > 0.3 || z < -0.35 ? 1 : 0.86);
export const FOX_ANIM = quadAnim({ ...FOX, zF: foxZ(FOX.zF), zH: foxZ(FOX.zH), neckZ: foxZ(FOX.neckZ), earZ: foxZ(FOX.earZ), tailZ: foxZ(FOX.tailZ), hindKeys: FOX.hindKeys.map(([x, y, z, r]) => [x, y, foxZ(z), r]) });
function remapZ(m, fz, dfz) {
  for (let i = 0; i < m.P.length; i += 3) {
    const z = m.P[i + 2], k = dfz(z);
    m.P[i + 2] = fz(z);
    const nx = m.N[i], ny = m.N[i + 1], nz = m.N[i + 2] / k, l = Math.hypot(nx, ny, nz) || 1;
    m.N[i] = nx / l; m.N[i + 1] = ny / l; m.N[i + 2] = nz / l;
  }
}
export function foxGeo() {
  const m = new MeshX();
  const red = [0.5, 0.15, 0.035], redD = [0.3, 0.075, 0.018], ochre = [0.58, 0.3, 0.1], cream = [0.72, 0.62, 0.48], white = [0.82, 0.8, 0.75], black = [0.03, 0.022, 0.018];
  const coat = (p) => mix3(mix3(red, redD, vn3(p[0] * 30, p[1] * 30, p[2] * 30) * 0.8), ochre, vn3(p[0] * 11 + 5, p[1] * 11, p[2] * 11) * 0.3);
  m.with(M.FUR, () => {
    // 胸は深く（腹の線 約0.22）、腰はくびれる
    body(m, [[-0.345, 0.385, 0.345, 0.02], [-0.32, 0.405, 0.3, 0.058], [-0.26, 0.418, 0.285, 0.074], [-0.18, 0.412, 0.296, 0.068], [-0.08, 0.407, 0.29, 0.066], [0.02, 0.41, 0.258, 0.073], [0.12, 0.416, 0.222, 0.08], [0.2, 0.42, 0.228, 0.075], [0.26, 0.412, 0.272, 0.058], [0.29, 0.4, 0.33, 0.03]], 30, 24, (u, th, p) => {
      const up = Math.sin(th);
      // 胸と腹は白〜クリーム、脇は黄土がかる、背すじは濃い
      if (u > 0.68 && up < -0.05) return mix3(white, cream, sstep(0.68, 0.6, u));
      return shade3(up, mul3(coat(p), 0.75), mix3(coat(p), ochre, sstep(0.3, -0.3, up) * 0.4), cream, -0.5);
    }, (u) => [0, u, 0, 0]);
    // 首：首回りの毛がふくらむ
    limb(m, [[0, 0.37, 0.215, 0.062], [0, 0.405, 0.265, 0.058], [0, 0.44, 0.31, 0.047], [0, 0.462, 0.34, 0.04]], 8, 16, (u, th, p) => (Math.sin(th) < -0.1 ? white : coat(p)), (u) => [6, u, 0, 0], 1.25);
    // 頭：額は広く、ほおの白い毛
    const hc = [0, 0.477, 0.355];
    m.ellipsoid(hc, [0.05, 0.047, 0.06], 18, 14, (v, th, p) => (p[1] - hc[1] < -0.02 ? white : mix3(coat(p), redD, sstep(0.0, 0.04, p[1] - hc[1]) * 0.3)), () => [1, 0, 0, 0]);
    for (const sx of [-1, 1]) m.ellipsoid([sx * 0.03, 0.458, 0.36], [0.03, 0.028, 0.038], 10, 8, (v, th, p) => (p[1] < 0.456 ? white : coat(p)), () => [1, 0, 0, 0]);
    // 鼻先：細く尖る。上は赤茶、口のまわりは白、口の線は黒
    body(m, [[0.36, 0.5, 0.44, 0.036], [0.4, 0.487, 0.445, 0.028], [0.44, 0.474, 0.448, 0.019], [0.47, 0.467, 0.449, 0.012], [0.492, 0.463, 0.452, 0.006]], 10, 14, (u, th) => {
      const up = Math.sin(th);
      if (up < -0.55) return white;
      if (up < -0.25) return u > 0.4 ? black : white;
      return u > 0.75 ? mul3(redD, 0.8) : coat([0, 0.5, 0.4]);
    }, () => [3, 0, 0, 0], false, true);
  });
  m.with(M.NOSE, () => m.ellipsoid([0, 0.461, 0.494], [0.0085, 0.0075, 0.0065], 8, 6, () => [0.02, 0.016, 0.014], () => [3, 0, 0, 0]));
  for (const sx of [-1, 1]) eye(m, [sx * 0.028, 0.488, 0.401], 0.0075, [0.48, 0.28, 0.04], sx);
  // 耳：大きな三角、裏は黒い
  m.with(M.FUR, () => { for (const sx of [-1, 1]) ear(m, [sx * 0.03, 0.512, 0.352], [sx * 0.056, 0.605, 0.335], 0.028, 0.006, sx, black, [0.62, 0.5, 0.4]); });
  m.with(M.FUR, () => {
    for (const sx of [-1, 1]) {
      // 前脚：肩→肘→手首→足。肘から下は黒い靴下
      limb(m, [[sx * 0.03, 0.36, 0.17, 0.042], [sx * 0.049, 0.23, 0.158, 0.026], [sx * 0.047, 0.15, 0.17, 0.017], [sx * 0.045, 0.06, 0.18, 0.012], [sx * 0.045, 0.018, 0.195, 0.012], [sx * 0.045, 0.01, 0.222, 0.012]], 14, 10, colLeg((u, p) => (p[1] < 0.2 ? black : red)), (u) => [5, u, sx, 0], 1.1);
      // 後脚：もも→膝→かかと→足
      limb(m, FOX.hindKeys.map(([x, y, z, r]) => [sx * x, y, z, r]), 16, 12, colLeg((u, p) => (p[1] < 0.12 ? black : mix3(red, redD, 0.35))), (u) => [5, u, sx, 1], 1.1);
    }
    // 尾：ふさふさ、先が白い
    limb(m, [[0, 0.372, -0.33, 0.028], [0, 0.35, -0.39, 0.05], [0, 0.305, -0.48, 0.066], [0, 0.255, -0.58, 0.066], [0, 0.215, -0.66, 0.054], [0, 0.195, -0.715, 0.034], [0, 0.19, -0.742, 0.004]], 16, 14, (u, th, p) => {
      if (u > 0.82) return white;
      const c = mix3(mix3(red, redD, vn3(p[0] * 50, p[1] * 50, p[2] * 50) * 0.8), [0.12, 0.07, 0.04], sstep(0.55, 0.8, u) * 0.55);
      return Math.sin(th) > 0.75 && u < 0.35 ? mul3(c, 0.6) : Math.sin(th) < -0.5 ? mix3(c, cream, 0.35) : c;
    }, (u) => [4, u, 0, 0], 0.95);
  });
  remapZ(m, foxZ, foxDZ);
  return m.build();
}

// ---- タヌキ ----
export const TANUKI = { drop: 0.12, legX: 0.058, hipF: 0.2, hipH: 0.21, zF: 0.15, zH: -0.19, neckY: 0.29, neckZ: 0.2, earX: 0.042, earY: 0.36, earZ: 0.28, headDown: 1.0, tailY: 0.28, tailZ: -0.28, bodyY: 0.25, tailLift: 0.25, tailRun: 0.1, tailLie: 0.5, tailWrap: 1.0, runSwing: 0.7, lieHead: 0.4, sitA: 0.8, sitDrop: 0.13 };
export const TANUKI_ANIM = quadAnim(TANUKI);
export function tanukiGeo() {
  const m = new MeshX();
  const buff = [0.25, 0.168, 0.082], grey = [0.15, 0.115, 0.078], dark = [0.05, 0.038, 0.028], black = [0.022, 0.018, 0.014];
  const face = [0.33, 0.265, 0.185], pale = [0.56, 0.5, 0.4], tipL = [0.48, 0.41, 0.31];
  // 差し毛：黄土の下毛に、黒い毛先と白っぽい毛先がまじる
  const grizzle = (p, k = 1) => {
    const n = vn3(p[0] * 45, p[1] * 45, p[2] * 45), n2 = vn3(p[0] * 160, p[1] * 160, p[2] * 160), n3 = vn3(p[0] * 190 + 7, p[1] * 190, p[2] * 190);
    const c = mix3(mix3(mix3(buff, grey, n * 0.8), dark, sstep(0.48, 0.74, n2) * 0.8), tipL, sstep(0.66, 0.9, n3) * 0.45);
    return mul3(c, k);
  };
  m.with(M.FUR, () => {
    // 胴：ずんぐり丸く、腹は低い
    body(m, [[-0.3, 0.3, 0.24, 0.03], [-0.27, 0.34, 0.16, 0.09], [-0.2, 0.36, 0.132, 0.12], [-0.08, 0.362, 0.126, 0.127], [0.05, 0.356, 0.128, 0.123], [0.15, 0.348, 0.145, 0.106], [0.21, 0.334, 0.19, 0.08], [0.245, 0.31, 0.24, 0.048]], 26, 22, (u, th, p) => {
      const up = Math.sin(th);
      if (up < -0.45) return mix3(dark, grey, 0.35);
      let c = grizzle(p);
      // 肩の黒い十字の帯と背すじ
      if (u > 0.6 && u < 0.82 && up > -0.2) c = mix3(c, dark, 0.6 * sstep(0.6, 0.7, u) * sstep(0.82, 0.72, u));
      if (up > 0.9) c = mix3(c, dark, 0.35);
      return c;
    }, (u) => [0, u, 0, 0]);
    limb(m, [[0, 0.28, 0.2, 0.085], [0, 0.295, 0.245, 0.078], [0, 0.305, 0.275, 0.068]], 6, 16, (u, th, p) => (Math.sin(th) < -0.25 ? dark : grizzle(p)), (u) => [6, u, 0, 0], 1.0);
    const hc = [0, 0.318, 0.3];
    m.ellipsoid(hc, [0.058, 0.052, 0.055], 18, 14, (v, th, p) => mix3(grizzle(p), face, p[1] - hc[1] > 0.02 ? 0.35 : 0.15), () => [1, 0, 0, 0]);
    // ほおの毛：横へ大きく張り出す襟巻き。下は黒っぽく
    for (const sx of [-1, 1]) {
      m.ellipsoid([sx * 0.056, 0.294, 0.282], [0.052, 0.044, 0.04], 14, 10, (v, th, p) => (p[1] < 0.28 ? mix3(dark, grey, 0.3) : mix3(grizzle(p), face, 0.3)), () => [1, 0, 0, 0]);
      // 毛先の房：ほおの外へ
      m.ellipsoid([sx * 0.09, 0.288, 0.272], [0.03, 0.028, 0.03], 10, 8, (v, th, p) => mix3(grizzle(p, 1.05), tipL, 0.12), () => [1, 0, 0, 0]);
    }
    // 目のまわりの黒い斑（マスク）と、眉の淡い小さな斑
    for (const sx of [-1, 1]) {
      m.ellipsoid([sx * 0.031, 0.314, 0.338], [0.026, 0.018, 0.015], 10, 8, () => black, () => [1, 0, 0, 0]);
      m.ellipsoid([sx * 0.022, 0.34, 0.333], [0.012, 0.007, 0.01], 8, 6, () => pale, () => [1, 0, 0, 0]);
    }
    // 鼻先：上は淡く、口のまわりは黒い
    body(m, [[0.325, 0.337, 0.283, 0.034], [0.355, 0.325, 0.289, 0.025], [0.38, 0.313, 0.294, 0.014], [0.393, 0.307, 0.297, 0.006]], 8, 12, (u, th, p) => (Math.sin(th) < -0.2 ? dark : mix3(mix3(pale, face, 0.35), grizzle(p), 0.25 + u * 0.3)), () => [3, 0, 0, 0], false, true);
  });
  m.with(M.NOSE, () => m.ellipsoid([0, 0.305, 0.396], [0.01, 0.0085, 0.0075], 8, 6, () => [0.018, 0.015, 0.013], () => [3, 0, 0, 0]));
  for (const sx of [-1, 1]) eye(m, [sx * 0.03, 0.322, 0.349], 0.0068, [0.16, 0.09, 0.035], sx, 0.5);
  m.with(M.FUR, () => { for (const sx of [-1, 1]) ear(m, [sx * 0.042, 0.358, 0.282], [sx * 0.053, 0.392, 0.276], 0.021, 0.007, sx, black, [0.3, 0.25, 0.19], black, true); });
  m.with(M.FUR, () => {
    for (const sx of [-1, 1]) {
      // 脚：太く短い。上半分は胴の毛におおわれ、黒いのは下の短い所だけ
      const legC = (u, p) => mix3(grizzle(p, 0.8), mix3(black, dark, 0.3), sstep(0.12, 0.34, u));
      limb(m, [[sx * 0.05, 0.22, 0.15, 0.072], [sx * 0.058, 0.13, 0.158, 0.044], [sx * 0.058, 0.06, 0.16, 0.032], [sx * 0.057, 0.014, 0.17, 0.027], [sx * 0.057, 0.009, 0.19, 0.022]], 10, 12, colLeg(legC), (u) => [5, u, sx, 0], 1.05);
      limb(m, [[sx * 0.055, 0.24, -0.19, 0.086], [sx * 0.064, 0.13, -0.16, 0.05], [sx * 0.06, 0.06, -0.195, 0.031], [sx * 0.058, 0.014, -0.19, 0.027], [sx * 0.058, 0.009, -0.17, 0.022]], 10, 12, colLeg(legC), (u) => [5, u, sx, 1], 1.05);
    }
    limb(m, [[0, 0.28, -0.28, 0.034], [0, 0.265, -0.325, 0.05], [0, 0.235, -0.385, 0.056], [0, 0.2, -0.435, 0.044], [0, 0.182, -0.462, 0.006]], 12, 14, (u, th, p) => (u > 0.6 || Math.sin(th) > 0.7 ? mix3(dark, black, 0.4) : grizzle(p)), (u) => [4, u, 0, 0]);
  });
  return m.build();
}

// ---- ネコ（三毛・きじ白） ----
// 立つ・香箱（脚をたたんで丸くなる）・すわる・横になる の4つの姿勢を、同じ組み方で骨の位置だけ変えて4回組む。
// 立ち姿を position、香箱・すわる・横になるを aP1〜aP3（法線 aN1〜aN3）に持たせ、頂点シェーダで混ぜる。歩きは立ち姿の脚を関節ごとに回す。
// 大きさ：鼻先〜尾の付け根 約46cm、肩の高さ 約24cm、胸の深さ 約12cm、尾 29cm。脚は短く太い（腿・肩の肉・丸い足先）
// iC: x=歩みの位相 y=歩みの強さ z=頭を下げる(rad) w=尾を立てる（立ち姿）  iD: x=伏せる(0..1)／すわる(-1..0) y=頭の左右 z=尾の先を振る w=個体差  iB.w=伏せ方（0 香箱・1 横になる）
const CAT_TAIL_L = 0.29;
const D2R = Math.PI / 180;
// 立ち姿の脚の関節 [y, z]：前脚＝肩甲骨の上・肩・肘・手首・掌の球・指先、後脚＝腰骨の上・股関節・膝・かかと・足裏の球・指先
const CAT_FJ = [[0.222, 0.078], [0.172, 0.112], [0.104, 0.074], [0.034, 0.08], [0.016, 0.1], [0.012, 0.118]].map(([y, z]) => [y * 0.9, z]);
const CAT_HJ = [[0.215, -0.095], [0.18, -0.125], [0.115, -0.07], [0.062, -0.14], [0.016, -0.128], [0.012, -0.105]].map(([y, z]) => [y * 0.9, z]);
const segLen = (J) => J.slice(1).map((b, i) => Math.hypot(b[0] - J[i][0], b[1] - J[i][1]));
const CAT_FL = segLen(CAT_FJ), CAT_HL = segLen(CAT_HJ);
// 関節の向き（真下から前へ＋、度）で脚を組む。骨の長さは立ち姿と同じ
const fkJ = (start, L, ang) => { const out = [start]; let [y, z] = start; L.forEach((len, i) => { const a = ang[i] * D2R; y -= len * Math.cos(a); z += len * Math.sin(a); out.push([y, z]); }); return out; };
// 脚の管の太さ [前後, 左右]：肩甲骨の上・肩・肘・前腕・手首・掌・指・先端（後脚は 腰・腿・膝・すね・かかと・足・指・先端）
const CAT_FR = [[0.032, 0.026], [0.04, 0.032], [0.025, 0.023], [0.019, 0.018], [0.0152, 0.014], [0.013, 0.02], [0.0106, 0.0172], [0.0046, 0.007]];
const CAT_HR = [[0.047, 0.032], [0.052, 0.036], [0.029, 0.024], [0.024, 0.019], [0.0165, 0.0127], [0.013, 0.019], [0.0106, 0.0167], [0.0046, 0.007]];
const bodyZ = (keys) => keys.map(([z, t, b, w]) => [(t + b) / 2, z, w, (t - b) / 2]);
const CAT_BODY_STAND = bodyZ([[-0.197, 0.19, 0.155, 0.013], [-0.183, 0.21, 0.122, 0.046], [-0.15, 0.221, 0.106, 0.061], [-0.1, 0.222, 0.106, 0.064], [-0.04, 0.217, 0.1, 0.066], [0.02, 0.213, 0.094, 0.064], [0.07, 0.216, 0.094, 0.058], [0.11, 0.216, 0.102, 0.051], [0.143, 0.2, 0.118, 0.042], [0.164, 0.176, 0.14, 0.02]]);
const CAT_POSE = {
  stand: {
    body: CAT_BODY_STAND,
    neck: [[0, 0.176, 0.112, 0.047], [0, 0.2, 0.15, 0.043], [0, 0.218, 0.174, 0.039], [0, 0.23, 0.19, 0.035]],
    head: { c: [0, 0.238, 0.203], pitch: 0.14 },
    front: () => ({ J: CAT_FJ, xs: [0.026, 0.038, 0.044, 0.041, 0.037, 0.035, 0.034, 0.034] }),
    hind: () => ({ J: CAT_HJ, xs: [0.034, 0.046, 0.053, 0.048, 0.042, 0.038, 0.036, 0.036] }),
    tail: [[0, 0.185, -0.19], [0, 0.218, -0.232], [0, 0.275, -0.262], [0, 0.34, -0.275], [0, 0.4, -0.265], [0, 0.44, -0.24], [0, 0.46, -0.21]], tailUp: [1, 0, 0],
  },
  // 香箱：前脚は胸の下へたたみ、後脚は腹のわきにたたむ（腿が横にふくらむ）。尾は腰を回って脇へ
  loaf: {
    body: bodyZ([[-0.178, 0.122, 0.03, 0.016], [-0.165, 0.148, 0.004, 0.052], [-0.13, 0.164, 0.0, 0.066], [-0.075, 0.171, 0.0, 0.07], [-0.015, 0.171, 0.0, 0.071], [0.04, 0.167, 0.0, 0.067], [0.08, 0.161, 0.004, 0.06], [0.11, 0.151, 0.012, 0.052], [0.132, 0.136, 0.03, 0.041], [0.146, 0.116, 0.06, 0.02]]), box: 0.5,
    neck: [[0, 0.118, 0.098, 0.046], [0, 0.145, 0.128, 0.042], [0, 0.162, 0.147, 0.038], [0, 0.172, 0.16, 0.034]],
    head: { c: [0, 0.18, 0.17], pitch: 0.08 }, eyes: 0.5,
    front: () => ({ J: fkJ([0.12, 0.058], CAT_FL, [45, -40, 88, -90, -95]), xs: [0.026, 0.034, 0.04, 0.034, 0.028, 0.025, 0.023, 0.023] }),
    hind: () => ({ J: fkJ([0.125, -0.085], CAT_HL, [-40, 35, -85, 88, 92]), xs: [0.034, 0.05, 0.066, 0.064, 0.058, 0.052, 0.048, 0.048] }),
    tail: [[0, 0.088, -0.168], [0.004, 0.045, -0.198], [0.028, 0.016, -0.222], [0.07, 0.015, -0.218], [0.102, 0.015, -0.18], [0.116, 0.015, -0.115], [0.113, 0.015, -0.045], [0.1, 0.016, 0.03]], tailUp: [0, 1, 0],
  },
  // すわる：前脚はまっすぐ胸の下、後脚は腿を前へ倒してかかとを地面に。尾は前足へ回す
  sit: {
    body: [[0.045, -0.13, 0.02, 0.02], [0.05, -0.118, 0.06, 0.052], [0.066, -0.092, 0.073, 0.067], [0.093, -0.066, 0.073, 0.068], [0.122, -0.044, 0.068, 0.066], [0.148, -0.026, 0.062, 0.064], [0.172, -0.011, 0.056, 0.06], [0.192, 0.001, 0.05, 0.054], [0.208, 0.011, 0.04, 0.043], [0.22, 0.018, 0.02, 0.02]],
    neck: [[0, 0.194, 0.012, 0.047], [0, 0.218, 0.03, 0.043], [0, 0.238, 0.046, 0.039], [0, 0.25, 0.057, 0.035]],
    head: { c: [0, 0.258, 0.07], pitch: 0.04 },
    front: () => ({ J: fkJ([0.195, 0.0], CAT_FL, [50, -30, 8, 35, 80]), xs: [0.024, 0.034, 0.038, 0.035, 0.032, 0.031, 0.03, 0.03] }),
    hind: () => ({ J: fkJ([0.095, -0.065], CAT_HL, [-60, 75, -60, 88, 92]), xs: [0.035, 0.052, 0.066, 0.064, 0.058, 0.052, 0.049, 0.049] }),
    tail: [[0, 0.045, -0.138], [0, 0.016, -0.172], [0.032, 0.015, -0.195], [0.076, 0.015, -0.175], [0.1, 0.015, -0.12], [0.104, 0.015, -0.05], [0.09, 0.015, 0.02], [0.06, 0.015, 0.07]], tailUp: [0, 1, 0],
  },
  // 横になる：体の向きで組んでから右脇を下に倒し、背を丸める。上側の脚は下側の脚の上へ落ちる。目は閉じる
  side: {
    body: CAT_BODY_STAND,
    neck: [[0, 0.175, 0.12, 0.046], [-0.004, 0.184, 0.158, 0.042], [-0.008, 0.188, 0.185, 0.038], [-0.01, 0.188, 0.2, 0.034]],
    head: { c: [-0.014, 0.19, 0.218], pitch: 0.3 }, eyes: 1,
    front: (sx) => (sx < 0 ? { J: fkJ(CAT_FJ[0], CAT_FL, [40, -25, 75, 25, 5]), xs: [0.026, 0.038, 0.044, 0.045, 0.045, 0.045, 0.045, 0.045] }
      : { J: fkJ(CAT_FJ[0], CAT_FL, [38, -10, 95, 40, 15]), xs: [0.026, 0.034, 0.022, 0.002, -0.012, -0.018, -0.02, -0.02] }),
    hind: (sx) => (sx < 0 ? { J: fkJ(CAT_HJ[0], CAT_HL, [-40.6, 55, -70, 25, 60]), xs: [0.034, 0.046, 0.053, 0.053, 0.05, 0.05, 0.05, 0.05] }
      : { J: fkJ(CAT_HJ[0], CAT_HL, [-40.6, 65, -55, 35, 70]), xs: [0.034, 0.042, 0.03, 0.008, -0.008, -0.016, -0.018, -0.018] }),
    tail: [[0, 0.185, -0.19], [-0.03, 0.165, -0.235], [-0.045, 0.13, -0.275], [-0.047, 0.09, -0.3], [-0.047, 0.045, -0.31], [-0.047, 0.005, -0.295], [-0.047, -0.03, -0.265]], tailUp: [1, 0, 0],
    roll: true,
  },
};
// 折れ線を弧長でならして、先頭から長さ L までを K 点に
function resampleL(pts, L, K) {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1], pts[i][2] - pts[i - 1][2]));
  const out = [];
  for (let k = 0; k < K; k++) {
    const s = Math.min(L * k / (K - 1), cum[cum.length - 1]);
    let i = 1;
    while (i < cum.length - 1 && cum[i] < s) i++;
    const t = (s - cum[i - 1]) / Math.max(cum[i] - cum[i - 1], 1e-9);
    out.push(pts[i - 1].map((v, j) => v + (pts[i][j] - v) * t));
  }
  return out;
}
const rotPYR = (pitch, yaw = 0, roll = 0) => (v) => {
  let [x, y, z] = v, c = Math.cos(roll), s = Math.sin(roll);
  [x, y] = [x * c - y * s, x * s + y * c];
  c = Math.cos(pitch); s = Math.sin(pitch); [y, z] = [y * c - z * s, y * s + z * c];
  c = Math.cos(yaw); s = Math.sin(yaw); [x, z] = [x * c + z * s, -x * s + z * c];
  return [x, y, z];
};
function xformRange(m, a, b, fp, fn) {
  for (let i = a; i < b; i++) {
    const o = i * 3;
    const p = fp([m.P[o], m.P[o + 1], m.P[o + 2]]), q = fn([m.N[o], m.N[o + 1], m.N[o + 2]]);
    m.P[o] = p[0]; m.P[o + 1] = p[1]; m.P[o + 2] = p[2]; m.N[o] = q[0]; m.N[o + 1] = q[1]; m.N[o + 2] = q[2];
  }
}
// 横になる姿勢の置き方：右脇を下へ倒し（x→上）、地面へ下ろし、腹の側へ背を丸める
const CAT_SIDE = { sy: 0.069, sx: 0.16, R: 0.25 };
const catSideP = (v) => {
  const x = -v[1] + CAT_SIDE.sx, y = v[0] + CAT_SIDE.sy, z = v[2];
  const th = z / CAT_SIDE.R, r = CAT_SIDE.R - x;
  return [CAT_SIDE.R - r * Math.cos(th), y, r * Math.sin(th)];
};
const catSideN = (v, p) => { const th = p[2] / CAT_SIDE.R; const x = -v[1], y = v[0], z = v[2]; const c = Math.cos(th), s = Math.sin(th); return [x * c + z * s, y, -x * s + z * c]; };
// 目：大きく前を向く。縦長の瞳・虹彩・ふちの黒いアイライン
function catEye(m, c, r, iris, sx) {
  const al = Math.hypot(sx * 0.32, 0.06, 0.945), ax = [sx * 0.32 / al, 0.06 / al, 0.945 / al];
  const sl = Math.hypot(ax[2], ax[0]), sd = [ax[2] / sl, 0, -ax[0] / sl];
  m.with(M.EYE, () => m.ellipsoid(c, [r, r, r], 16, 12, (v, th, p) => {
    const d = [(p[0] - c[0]) / r, (p[1] - c[1]) / r, (p[2] - c[2]) / r];
    const f = d[0] * ax[0] + d[1] * ax[1] + d[2] * ax[2];
    const s = d[0] * sd[0] + d[2] * sd[2];
    if (f > 0.6 && Math.abs(s) < 0.24 && Math.abs(d[1]) < 0.62) return [0.012, 0.01, 0.009];
    if (f > 0.5) return mix3(iris, mul3(iris, 0.55), sstep(0.92, 0.55, f));
    return [0.02, 0.018, 0.016];
  }, () => [8, 0, sx, 0]));
}
function buildCat(kind, P) {
  const m = new MeshX();
  const white = [0.8, 0.785, 0.745], orange = [0.64, 0.3, 0.075], orangeL = [0.8, 0.5, 0.22], black = [0.032, 0.029, 0.027];
  const ag = (p) => mix3([0.2, 0.155, 0.1], [0.34, 0.27, 0.175], vn3(p[0] * 55, p[1] * 55, p[2] * 55) * 0.8);
  const orng = (p) => mix3(orange, orangeL, vn3(p[0] * 45, p[1] * 45, p[2] * 45) * 0.7);
  // 三毛の斑：大きく、ふちがはっきり
  const cal = (p, noWhite = false) => {
    const a = vn3(p[0] * 8.5 + 3.3, p[1] * 8.5 + 1.1, p[2] * 8.5 + 0.7) + (vn3(p[0] * 21, p[1] * 21 + 4, p[2] * 21) - 0.5) * 0.3;
    if (!noWhite && vn3(p[0] * 7 + 9, p[1] * 7, p[2] * 7 + 2) > 0.7) return white;
    return a > 0.5 ? orng(p) : black;
  };
  const bodyCol = (p, up) => {
    if (kind === 0) {
      const wn = up + (vn3(p[0] * 14 + 2, p[1] * 14, p[2] * 14) - 0.5) * 0.5;
      return wn < -0.05 || (p[2] > 0.11 && up < 0.35) ? white : cal(p);
    }
    const wn = up + (vn3(p[0] * 12 + 5, p[1] * 12, p[2] * 12) - 0.5) * 0.8;
    return wn < -0.3 || (p[2] > 0.12 && up < 0.2) ? white : mul3(ag(p), 1.0 - 0.3 * sstep(0.3, 0.95, up));
  };
  const headCol = (p) => {
    if (kind === 0) {
      const blaze = Math.abs(p[0]) < 0.006 + Math.max(0, -p[1]) * 0.5 && p[2] > 0.0;
      if (p[1] < -0.008 || blaze) return white;
      return p[0] > 0 ? orng(p) : black;
    }
    const blaze = Math.abs(p[0]) < 0.004 + Math.max(0, 0.004 - p[1]) * 0.45 && p[2] > 0.02;
    if ((p[1] < -0.01 && p[2] > -0.01) || blaze) return white;
    return ag(p);
  };
  const TB = kind === 0 ? M.FUR : M.TAB_BODY, TL = kind === 0 ? M.FUR : M.TAB_LEG, TT = kind === 0 ? M.FUR : M.TAB_TAIL, TH = kind === 0 ? M.FUR : M.TAB_HEAD;
  // 胴
  m.with(TB, () => {
    const rings = spline(P.body, 40).map(([y, z, hw, hd]) => ({ p: [0, y, z], rx: Math.max(hw, 2e-4), ry: Math.max(hd, 2e-4) }));
    const b0 = m.n;
    m.tube(rings, 28, (u, th, p) => bodyCol(p, Math.sin(th)), (u) => [0, u, 0, 0]);
    // 香箱：胴の下半分を角ばらせる（脇はまっすぐ地面へ、腹は平ら）＝食パンの形
    if (P.box) {
      const q = P.box, nn = 2 / q;
      for (let i = 0; i < rings.length * 29; i++) {
        const r = rings[Math.floor(i / 29)], o = (b0 + i) * 3;
        const a = (m.P[o] - r.p[0]) / r.rx, b = (m.P[o + 1] - r.p[1]) / r.ry;
        if (b >= 0) continue;
        const ua = Math.sign(a) * Math.pow(Math.abs(a), q), vb = -Math.pow(-b, q);
        m.P[o] = r.p[0] + ua * r.rx; m.P[o + 1] = r.p[1] + vb * r.ry;
        const gx = Math.sign(ua) * Math.pow(Math.abs(ua), nn - 1) / r.rx, gy = -Math.pow(-vb, nn - 1) / r.ry;
        const gl = Math.hypot(gx, gy, m.N[o + 2] * 0.5) || 1;
        m.N[o] = gx / gl; m.N[o + 1] = gy / gl; m.N[o + 2] = m.N[o + 2] * 0.5 / gl;
      }
    }
  });
  // 首：のどは白
  m.with(TB, () => limb(m, P.neck, 8, 18, (u, th, p) => (Math.sin(th) < -0.25 ? white : bodyCol(p, 0.6)), (u) => [6, u, 0, 0], 1.08));
  // 頭（頭の座標で組んでから置く）：丸い頭骨・張ったほお・短い鼻すじ・ふくらんだひげ袋・小さなあご
  const h0 = m.n;
  m.with(TH, () => {
    m.ellipsoid([0, 0.004, -0.006], [0.04, 0.036, 0.042], 24, 18, (v, th, p) => headCol(p), () => [1, 0, 0, 0]);
    for (const sx of [-1, 1]) m.ellipsoid([sx * 0.021, -0.014, 0.012], [0.024, 0.021, 0.025], 14, 10, (v, th, p) => headCol(p), () => [1, 0, 0, 0]);
    m.ellipsoid([0, 0.0, 0.025], [0.011, 0.01, 0.0135], 12, 8, (v, th, p) => headCol(p), () => [3, 0, 0, 0]);
  });
  m.with(M.FUR, () => {
    for (const sx of [-1, 1]) m.ellipsoid([sx * 0.0095, -0.017, 0.03], [0.012, 0.0105, 0.0095], 12, 8, () => white, () => [3, 0, 0, 0]);
    m.ellipsoid([0, -0.027, 0.024], [0.0095, 0.0072, 0.0095], 10, 6, () => white, () => [3, 0, 0, 0]);
  });
  m.with(M.NOSE, () => m.ellipsoid([0, -0.006, 0.0385], [0.0062, 0.0048, 0.004], 8, 6, () => (kind === 0 ? [0.66, 0.38, 0.37] : [0.42, 0.2, 0.17]), () => [3, 0, 0, 0]));
  // 目：閉じる姿勢では頭の中へ沈める
  const ek = P.eyes ?? 0;
  for (const sx of [-1, 1]) catEye(m, [sx * 0.0182, 0.008, 0.0275 - 0.006 * ek], 0.0098 * (1 - 0.55 * ek), kind === 0 ? [0.66, 0.5, 0.1] : [0.46, 0.52, 0.12], sx);
  // 耳：三角に立ち、少し外へ開く。内側は淡い桃色
  m.with(M.FUR, () => {
    for (const sx of [-1, 1]) {
      const eo = kind === 0 ? (sx > 0 ? orange : black) : mul3(ag([sx * 0.03, 0.3, 0.2]), 0.7);
      ear(m, [sx * 0.024, 0.026, -0.004], [sx * 0.036, 0.06, -0.012], 0.0205, 0.0042, sx, eo, [0.72, 0.55, 0.52]);
    }
  });
  const hd = P.head, hr = rotPYR(hd.pitch ?? 0, hd.yaw ?? 0, hd.roll ?? 0), HS = 1.15;
  xformRange(m, h0, m.n, (v) => { const q = hr([v[0] * HS, v[1] * HS, v[2] * HS]); return [q[0] + hd.c[0], q[1] + hd.c[1], q[2] + hd.c[2]]; }, hr);
  // 脚：肩の肉・腿の張り・細い手首とかかと・丸い足先を一本の管で
  const leg = (spec, R, sx, hind) => {
    const J = spec.J;
    const K = [J[0], J[1], J[2], [(J[2][0] + J[3][0]) / 2, (J[2][1] + J[3][1]) / 2], J[3], J[4], J[5]];
    const dy = J[5][0] - J[4][0], dz = J[5][1] - J[4][1], dl = Math.hypot(dy, dz) || 1;
    K.push([J[5][0] + dy / dl * 0.007, J[5][1] + dz / dl * 0.007]);
    const keys = K.map(([y, z], i) => [sx * spec.xs[i], y, z, R[i][0], R[i][1]]);
    const rings = spline(keys, 35).map(([x, y, z, a, b]) => ({ p: [x, y, z], rx: a, ry: b, up: [1, 0, 0] }));
    const col = (u, th, p) => {
      let c;
      if (kind === 0) c = u < (hind ? 0.28 : 0.12) ? bodyCol(p, 0.2) : white;
      else c = u < (hind ? 0.5 : 0.42) ? ag(p) : white;
      return mul3(c, u < 0.1 ? 0.8 + u * 2 : 1);
    };
    m.with(TL, () => m.tube(rings, 14, col, (u) => [5, u, sx, hind ? 1 : 0]));
  };
  for (const sx of [-1, 1]) { leg(P.front(sx), CAT_FR, sx, false); leg(P.hind(sx), CAT_HR, sx, true); }
  // 尾：太く、根元から先まで同じくらいの太さ。先は丸い
  const TP = resampleL(P.tail, CAT_TAIL_L, 13);
  const tkeys = TP.map((p, i) => { const u = i / 12; return [...p, 0.0165 * (1 - 0.2 * u) * (u > 0.9 ? Math.max(0.3, Math.sqrt((1 - u) / 0.1)) : 1)]; });
  m.with(TT, () => m.tube(spline(tkeys, 36).map(([x, y, z, r]) => ({ p: [x, y, z], rx: r, ry: r, up: P.tailUp })), 12,
    (u, th, p) => (kind === 0 ? (u < 0.45 ? orng(p) : cal(p, true)) : ag(p)), (u) => [4, u, 0, 0]));
  // 動きの軸（首の付け根・尾の中ほど・耳の付け根）
  const piv = { nb: P.neck[0].slice(0, 3), tp: TP[5], el: [0.024, 0.026, -0.004], er: [-0.024, 0.026, -0.004] };
  for (const k of ['el', 'er']) { const q = hr(piv[k].map((v) => v * HS)); piv[k] = [q[0] + hd.c[0], q[1] + hd.c[1], q[2] + hd.c[2]]; }
  if (P.roll) {
    for (let i = 0; i < m.n; i++) {
      const o = i * 3, v = [m.P[o], m.P[o + 1], m.P[o + 2]];
      const p = catSideP(v), q = catSideN([m.N[o], m.N[o + 1], m.N[o + 2]], v);
      m.P[o] = p[0]; m.P[o + 1] = p[1]; m.P[o + 2] = p[2]; m.N[o] = q[0]; m.N[o + 1] = q[1]; m.N[o + 2] = q[2];
    }
    for (const k of Object.keys(piv)) piv[k] = catSideP(piv[k]);
  }
  // 地面に触れる所は平たく
  if (P !== CAT_POSE.stand) {
    for (let i = 0; i < m.n; i++) {
      const o = i * 3;
      if (m.P[o + 1] < 0.004) {
        m.P[o + 1] = 0.004 - (0.004 - m.P[o + 1]) * 0.12;
        const nx = m.N[o] * 0.4, ny = m.N[o + 1] * 0.4 - 0.6, nz = m.N[o + 2] * 0.4, l = Math.hypot(nx, ny, nz) || 1;
        m.N[o] = nx / l; m.N[o + 1] = ny / l; m.N[o + 2] = nz / l;
      }
    }
  }
  m.piv = piv;
  return m;
}
const CAT_PIV = {};
export function catGeo(kind = 0) {
  const ms = buildCat(kind, CAT_POSE.stand);
  const g = ms.build();
  ['loaf', 'sit', 'side'].forEach((k, i) => {
    const mm = buildCat(kind, CAT_POSE[k]);
    if (mm.n !== ms.n) throw new Error(`cat pose ${k}: ${mm.n} != ${ms.n}`);
    g.setAttribute(`aP${i + 1}`, new THREE.Float32BufferAttribute(mm.P, 3));
    g.setAttribute(`aN${i + 1}`, new THREE.Float32BufferAttribute(mm.N, 3));
    CAT_PIV[k] = mm.piv;
  });
  CAT_PIV.stand = ms.piv;
  return g;
}
// 動きの軸は形から決まる（形を組まずに先に求めておく）
for (const k of ['stand', 'loaf', 'sit', 'side']) CAT_PIV[k] = buildCat(0, CAT_POSE[k]).piv;
const v3c = (a) => `vec3(${f(a[0])}, ${f(a[1])}, ${f(a[2])})`;
const v2c = (a) => `vec2(${f(a[0])}, ${f(a[1])})`;
const bl = (k) => `(${v3c(CAT_PIV.stand[k])} * w0 + ${v3c(CAT_PIV.loaf[k])} * wL + ${v3c(CAT_PIV.sit[k])} * wSt + ${v3c(CAT_PIV.side[k])} * wSd)`;
const CU = (k) => f(k / 7);
export const CAT_ANIM = /* glsl */ `
attribute vec3 aP1; attribute vec3 aN1; attribute vec3 aP2; attribute vec3 aN2; attribute vec3 aP3; attribute vec3 aN3;
// 脚を関節ごとに回す：先の関節から順に、立ち姿の関節のまわりで
void catLeg(inout vec3 q, inout vec3 qn, float u, vec2 j0, float u0, float a0, vec2 j1, float u1, float a1, vec2 j2, float u2, float a2) {
  float w2 = smoothstep(u2 - 0.035, u2 + 0.035, u);
  mat3 R2 = rotX(a2 * w2); q = rotAbout(q, vec3(0.0, j2), R2); qn = R2 * qn;
  float w1 = smoothstep(u1 - 0.035, u1 + 0.035, u);
  mat3 R1 = rotX(a1 * w1); q = rotAbout(q, vec3(0.0, j1), R1); qn = R1 * qn;
  float wa = smoothstep(0.0, u0, u);
  mat3 R0 = rotX(a0 * wa); q = rotAbout(q, vec3(0.0, j0), R0); qn = R0 * qn;
}
void animate(inout vec3 p, inout vec3 n, inout vec3 col) {
  int part = int(aPart.x + 0.5);
  float ph = iC.x, amp = iC.y;
  float lie = max(iD.x, 0.0), sit = max(-iD.x, 0.0), side = clamp(iB.w, 0.0, 1.0);
  float wL = lie * (1.0 - side), wSd = lie * side, wSt = sit;
  float w0 = max(0.0, 1.0 - wL - wSd - wSt);
  float seed = iD.w * 37.0;
  vec3 q = p, qn = n;
  vec3 tb = ${v3c(CAT_POSE.stand.tail[0])};
  mat3 Rt = rotX(-(1.0 - iC.w) * 1.25 * smoothstep(0.0, 0.35, aPart.y));
  if (part == 5) {
    // 歩き：左後→左前→右後→右前（なみ足）。速いと対角がそろう。踏んでいる間は脚をのばして後ろへ送り、振り出す間は肘・膝・手首・かかとを曲げて足先を上げる
    float s = aPart.z;
    bool hind = aPart.w > 0.5;
    float off;
    if (amp < 0.65) off = hind ? (s < 0.0 ? 0.0 : 3.1416) : (s < 0.0 ? 1.5708 : 4.7124);
    else off = hind ? (s < 0.0 ? 3.1416 : 0.0) : (s < 0.0 ? 0.0 : 3.1416);
    float lp = fract((ph + off) / 6.2832);
    float duty = amp < 0.65 ? 0.62 : 0.5;
    float A = mix(0.4, 0.52, sat(amp * 2.5 - 1.25));
    float th, fl;
    if (lp < duty) { th = mix(-A, A, lp / duty); fl = 0.0; }
    else { float e = (lp - duty) / (1.0 - duty); th = mix(A, -A, e * e * (3.0 - 2.0 * e)); fl = sin(3.1416 * e); }
    float g = sat(amp * 3.0);
    th *= g; fl *= g;
    if (hind) catLeg(q, qn, aPart.y, ${v2c(CAT_HJ[1])}, ${CU(1)}, th - fl * 0.2, ${v2c(CAT_HJ[2])}, ${CU(2)}, fl * 0.8, ${v2c(CAT_HJ[3])}, ${CU(4)}, -fl * 1.2);
    else catLeg(q, qn, aPart.y, ${v2c(CAT_FJ[0])}, ${CU(1)}, th, ${v2c(CAT_FJ[2])}, ${CU(2)}, fl * 0.9, ${v2c(CAT_FJ[3])}, ${CU(4)}, fl * 1.5);
    // 脚を前後に振ると足先が浮くので、その分だけ下へのばして地面につけておく
    q.y -= (hind ? 0.165 : 0.206) * (1.0 - cos(th)) * smoothstep(0.1, 0.9, aPart.y);
  } else if (part == 4) {
    // 立ち姿の尾：歩くと立て、止まると下ろす
    q = rotAbout(q, tb, Rt); qn = Rt * qn;
  }
  p = q * w0 + aP1 * wL + aP2 * wSt + aP3 * wSd;
  n = qn * w0 + aN1 * wL + aN2 * wSt + aN3 * wSd;
  // 息づかい：胸と腹がふくらむ
  if (part == 0) p += n * 0.0022 * sin(uTime * 1.4 + seed) * sin(3.1416 * aPart.y);
  if (part == 4) {
    // 尾の先をゆっくり振る
    float u = aPart.y;
    vec3 tp0 = rotAbout(${v3c(CAT_PIV.stand.tp)}, tb, Rt);
    vec3 tp = tp0 * w0 + ${v3c(CAT_PIV.loaf.tp)} * wL + ${v3c(CAT_PIV.sit.tp)} * wSt + ${v3c(CAT_PIV.side.tp)} * wSd;
    float wv = (sin(uTime * 1.9 + seed) + 0.6 * sin(uTime * 3.3 + seed * 1.7)) * iD.z;
    float k = smoothstep(0.4, 1.0, u);
    mat3 Rf = rotY(wv * 0.55 * k);
    p = rotAbout(p, tp, Rf); n = Rf * n;
  }
  if (part == 1 || part == 3 || part == 6 || part == 8 || part == 9) {
    float t = part == 6 ? aPart.y : 1.0;
    float w = t * t * (3.0 - 2.0 * t);
    if (part == 9) {
      // 耳：ときどき向きを変える
      vec3 eb = aPart.z > 0.0 ? ${bl('el')} : ${bl('er')};
      float tw = pow(max(0.0, sin(uTime * 0.8 + seed + aPart.z * 1.3)), 30.0);
      mat3 E = rotY(aPart.z * tw * 0.5);
      p = rotAbout(p, eb, E); n = E * n;
      vThinOut = 1.0;
    }
    vec3 nb = ${bl('nb')};
    mat3 Rh = rotY(iD.y * w) * rotX(iC.z * w);
    p = rotAbout(p, nb, Rh); n = Rh * n;
  }
}
`;

// ---- ニホンリス：幹を駆け上がる・止まって辺りを見る・すわって食べる ----
// quadAnim を使う（駆け足で跳ねる）。iC.w=尾を背中へ巻き上げる
export const SQUIRREL = { drop: 0.03, legX: 0.022, hipF: 0.075, hipH: 0.08, zF: 0.055, zH: -0.05, neckY: 0.095, neckZ: 0.07, earX: 0.012, earY: 0.132, earZ: 0.1, headDown: 0.6, tailY: 0.095, tailZ: -0.085, bodyY: 0.08, tailLift: 2.4, tailRun: 0.0, tailLie: 0.0, tailF: 5.0, runSwing: 1.1, fold: 1.6, breath: 6.0, sitA: 1.2, sitDrop: 0.018, sitHead: 1.0, sitFront: 0.25, sitElbow: -2.5, elbowU: 0.333, elbowP: [0.045, 0.06], knee: 1, hock: 2, paw: 3 };
SQUIRREL.hindKeys = [[0.026, 0.08, -0.05, 0.017], [0.029, 0.045, -0.025, 0.011], [0.026, 0.012, -0.06, 0.006], [0.024, 0.003, -0.035, 0.005], [0.024, 0.003, -0.018, 0.004]];
export const SQUIRREL_ANIM = quadAnim(SQUIRREL);
export function squirrelGeo() {
  const m = new MeshX();
  const brown = [0.26, 0.1, 0.03], brownD = [0.12, 0.05, 0.018], grey = [0.24, 0.18, 0.13], white = [0.8, 0.78, 0.72], pale = [0.46, 0.36, 0.27];
  const coat = (p) => mix3(mix3(brown, grey, sstep(0.09, 0.12, p[1]) * 0.4), brownD, vn3(p[0] * 150, p[1] * 150, p[2] * 150) * 0.5);
  m.with(M.FUR, () => {
    // 胴：胸は細く、腰（後脚の腿）は丸く太い
    body(m, [[-0.092, 0.1, 0.07, 0.012], [-0.08, 0.116, 0.044, 0.032], [-0.052, 0.123, 0.036, 0.04], [-0.015, 0.12, 0.042, 0.034], [0.025, 0.115, 0.05, 0.028], [0.058, 0.11, 0.062, 0.022], [0.078, 0.106, 0.076, 0.015], [0.088, 0.103, 0.086, 0.008]], 20, 16, (u, th, p) => (Math.sin(th) < -0.4 ? white : coat(p)), (u) => [0, u, 0, 0]);
    // 首
    limb(m, [[0, 0.1, 0.06, 0.02], [0, 0.109, 0.078, 0.018], [0, 0.114, 0.092, 0.017]], 5, 12, (u, th, p) => (Math.sin(th) < -0.3 ? white : coat(p)), (u) => [6, u, 0, 0]);
    const hc = [0, 0.118, 0.099];
    m.ellipsoid(hc, [0.022, 0.021, 0.026], 14, 12, (v, th, p) => (p[1] - hc[1] < -0.009 && p[2] > hc[2] ? white : coat(p)), () => [1, 0, 0, 0]);
    // ほお
    for (const sx of [-1, 1]) m.ellipsoid([sx * 0.012, 0.11, 0.108], [0.012, 0.011, 0.014], 8, 7, (v, th, p) => (p[1] < 0.107 ? white : coat(p)), () => [1, 0, 0, 0]);
    // 鼻先：短く丸い。上は頭と同じ毛色、口のまわりは白
    body(m, [[0.104, 0.125, 0.099, 0.017], [0.115, 0.121, 0.1, 0.015], [0.124, 0.116, 0.101, 0.011], [0.13, 0.112, 0.103, 0.006]], 6, 12, (u, th, p) => (Math.sin(th) < -0.25 ? white : mix3(coat(p), grey, 0.25)), () => [3, 0, 0, 0], false, true);
  });
  m.with(M.NOSE, () => m.ellipsoid([0, 0.111, 0.1305], [0.003, 0.0026, 0.0026], 5, 4, () => [0.05, 0.035, 0.03], () => [3, 0, 0, 0]));
  for (const sx of [-1, 1]) {
    // 目のまわりの白い輪
    m.with(M.FUR, () => m.ellipsoid([sx * 0.0135, 0.123, 0.109], [0.0048, 0.0068, 0.0068], 7, 6, () => white, () => [1, 0, 0, 0]));
    eye(m, [sx * 0.015, 0.123, 0.11], 0.0053, [0.02, 0.015, 0.012], sx, 0.2);
  }
  // 耳：短く丸い。春はまだ先に房毛が少し残る
  m.with(M.FUR, () => { for (const sx of [-1, 1]) ear(m, [sx * 0.012, 0.13, 0.094], [sx * 0.0165, 0.152, 0.089], 0.0085, 0.0032, sx, brown, [0.5, 0.35, 0.25], brownD, true); });
  m.with(M.FUR, () => {
    for (const sx of [-1, 1]) {
      limb(m, [[sx * 0.022, 0.075, 0.055, 0.01], [sx * 0.023, 0.045, 0.06, 0.006], [sx * 0.022, 0.01, 0.068, 0.005], [sx * 0.021, 0.004, 0.078, 0.004]], 8, 7, colLeg(() => brown), (u) => [5, u, sx, 0]);
      limb(m, SQUIRREL.hindKeys.map(([x, y, z, r]) => [sx * x, y, z, r]), 8, 7, colLeg(() => brown), (u) => [5, u, sx, 1], 1.25);
    }
    // 尾：体と同じくらい長く、左右へ平たく広がる房。休みの形は後ろへまっすぐ（巻き上げは動きで）
    // 断面は毛先のぎざぎざ（星形）にして、ふわっとした輪郭にする
    const NU = 34, NS = 28, base = m.n;
    const L = 0.175;
    for (let i = 0; i <= NU; i++) {
      const u = i / NU;
      const c = [0, 0.095 + u * 0.028 + Math.sin(u * Math.PI) * 0.006, -0.083 - u * L];
      const W = 0.01 + 0.046 * Math.pow(Math.sin(Math.min(1, u * 1.25 + 0.04) * Math.PI * 0.62), 0.9) * (1 - 0.35 * sstep(0.8, 1.0, u)) + (u > 0.97 ? -0.03 * (u - 0.97) / 0.03 : 0);
      const H = W * 0.52;
      for (let k = 0; k <= NS; k++) {
        const th = (k / NS) * Math.PI * 2;
        const ct = Math.cos(th), st = Math.sin(th);
        // 毛先の房：角度と長さ方向にずらした尖り
        const tuft = Math.pow(Math.abs(Math.sin(th * 5 + u * 23 + hash(k, i, 3) * 0.8)), 3) * 0.28 + (hash(k, i, 7) - 0.5) * 0.12;
        const rr = (1 + tuft * sstep(0.02, 0.2, u)) * Math.max(W, 0.002);
        const p = [ct * rr, c[1] + st * rr * (H / Math.max(W, 1e-4)), c[2]];
        let nx = ct / Math.max(W, 1e-4), ny = st / Math.max(H, 1e-4), nz = 0.25 * (u < 0.5 ? 1 : -1) * 0;
        const nl = Math.hypot(nx, ny, nz) || 1;
        const edge = Math.abs(ct);
        // 毛の根元は濃く、外へ向かって淡い毛先。背（上）はやや濃い
        const col = mix3(mix3(coat(p), brownD, 0.25 + 0.15 * sstep(0.3, 0.9, st)), pale, sstep(0.55, 1.0, edge) * 0.45 + tuft * 0.5);
        m.vert(p, [nx / nl, ny / nl, nz / nl], col, [4, u, 0, 0]);
      }
    }
    for (let i = 0; i < NU; i++) for (let k = 0; k < NS; k++) {
      const a = base + i * (NS + 1) + k, b = a + 1, cc = a + NS + 1, d = cc + 1;
      m.I.push(a, b, cc, b, d, cc);
    }
  });
  return m.build();
}

// ---- ニワトリ：歩く（首を前後）・ついばむ・土をかく・羽ばたいて走る ----
// 部位: 0 胴 1 頭 2 翼 4 尾 5 脚 6 首 7 とさか・肉垂 8 目
// iC: x=歩みの位相 y=歩みの強さ（1 走る） z=ついばむ w=羽ばたき
// iD: x=首の前後（頭を空間に止める） y=頭の左右 z=土をかく脚（-1/1） w=個体差
export const CHICKEN_ANIM = /* glsl */ `
void animate(inout vec3 p, inout vec3 n, inout vec3 col) {
  int part = int(aPart.x + 0.5);
  float ph = iC.x, amp = iC.y, peck = iC.z;
  vec3 hip = vec3(0.0, 0.15, 0.0);
  // 体全体：ついばむと前へ傾く
  mat3 Rb = rotX(peck * 0.5);
  if (part == 5) {
    float side = aPart.z;
    vec3 pv = vec3(0.045 * side, 0.15, 0.0);
    float o = side > 0.0 ? 3.1416 : 0.0;
    float a = sin(ph + o) * mix(0.45, 0.8, sat(amp * 2.0 - 1.0)) * sat(amp * 3.0);
    // 土をかく：片脚を後ろへ強く蹴る
    float sc = iD.z * side > 0.5 ? max(0.0, sin(uTime * 9.0)) * 0.9 : 0.0;
    float fold = max(0.0, -cos(ph + o)) * sat(aPart.y * 1.5 - 0.3) * 1.3 * sat(amp * 3.0);
    mat3 R = rotX(a + sc - fold);
    p = rotAbout(p, pv, R); n = R * n;
    return;
  }
  if (part == 1 || part == 6 || part == 7 || part == 8) {
    float t = part == 6 ? aPart.y : 1.0;
    // 首を前後に出し入れ（歩くと頭が止まって見える）＋ついばみ。首の付け根は胴と一緒に動く
    vec3 nb = vec3(0.0, 0.3, 0.09);
    float w = t * t * (3.0 - 2.0 * t);
    p.z += iD.x * 0.03 * w;
    mat3 Rh = rotY(iD.y * w) * rotX(peck * 1.15 * w);
    p = rotAbout(p, nb, Rh); n = Rh * n;
  } else if (part == 2) {
    // 翼：肩から開いて羽ばたく
    float side = aPart.z;
    vec3 sh = vec3(0.08 * side, 0.3, 0.07);
    float fl = iC.w * (0.55 + 0.45 * sin(uTime * 24.0 + iD.w * 9.0));
    mat3 R = rotZ(-side * fl * 1.5) * rotY(side * iC.w * 0.35);
    p = rotAbout(p, sh, R); n = R * n;
    vThinOut = 1.0;
  } else if (part == 4) {
    vec3 tb = vec3(0.0, 0.33, -0.13);
    mat3 R = rotX(0.08 * sin(uTime * 3.0 + iD.w * 20.0) * amp - peck * 0.3);
    p = rotAbout(p, tb, R); n = R * n;
    vThinOut = 1.0;
  }
  p = rotAbout(p, hip, Rb); n = Rb * n;
}
`;
// 胴の節 [z, 背, 腹, 半幅] を細かく補間して、z での断面を返す（翼を胴の面に沿わせる）
function bodySection(keys) {
  const S = spline(keys, 200);
  return (z) => {
    let k = 0;
    while (k < S.length - 2 && S[k + 1][0] < z) k++;
    const a = S[k], b = S[k + 1], t = clamp01((z - a[0]) / ((b[0] - a[0]) || 1));
    const top = a[1] + (b[1] - a[1]) * t, bot = a[2] + (b[2] - a[2]) * t, hw = a[3] + (b[3] - a[3]) * t;
    return { mid: (top + bot) / 2, hh: (top - bot) / 2, hw };
  };
}
// kind 0 赤褐色のめんどり 1 白色レグホン 2 おんどり
export function chickenGeo(kind = 0) {
  const m = new MeshX();
  const P = kind === 1
    ? { body: [0.84, 0.82, 0.76], dark: [0.66, 0.64, 0.58], neck: [0.86, 0.84, 0.78], wing: [0.8, 0.78, 0.72], tail: [0.82, 0.8, 0.74], breast: [0.84, 0.82, 0.76] }
    : kind === 0
      ? { body: [0.36, 0.13, 0.035], dark: [0.2, 0.065, 0.02], neck: [0.52, 0.25, 0.06], wing: [0.3, 0.1, 0.03], tail: [0.06, 0.04, 0.03], breast: [0.4, 0.16, 0.045] }
      : { body: [0.42, 0.1, 0.025], dark: [0.02, 0.03, 0.03], neck: [0.66, 0.34, 0.07], wing: [0.36, 0.08, 0.02], tail: [0.015, 0.025, 0.022], breast: [0.025, 0.03, 0.028] };
  const red = [0.6, 0.035, 0.025], yellow = [0.66, 0.5, 0.14];
  const HY = -0.065;   // 頭まわりの高さ（胴を低くした分）
  // 羽の重なり：鱗状の縁取り
  const feather = (p, c) => {
    const s = Math.sin(p[2] * 190 + Math.sin(p[0] * 160) * 1.5) * Math.sin(p[1] * 170 + p[0] * 60);
    return mix3(c, mul3(c, 0.62), sstep(0.35, 0.95, s) * 0.5 + vn3(p[0] * 50, p[1] * 50, p[2] * 50) * 0.2);
  };
  // 胴：丸い卵形。胸は低く前へ張り、背は尾へ向かって上がる。腹は地面から約13cm
  const BK = [[-0.168, 0.345, 0.29, 0.016], [-0.145, 0.358, 0.228, 0.05], [-0.105, 0.357, 0.172, 0.078], [-0.05, 0.347, 0.14, 0.092], [0.005, 0.338, 0.13, 0.096], [0.055, 0.332, 0.138, 0.091], [0.095, 0.327, 0.16, 0.08], [0.128, 0.32, 0.192, 0.062], [0.152, 0.307, 0.235, 0.036], [0.163, 0.292, 0.268, 0.01]];
  const sec = bodySection(BK);
  m.with(M.FEATHER, () => {
    body(m, BK, 32, 26, (u, th, p) => {
      const up = Math.sin(th);
      let base = up < 0.1 && u > 0.55 ? P.breast : up > 0.6 ? mix3(P.body, P.dark, 0.15) : P.body;
      // おんどりは腰の鞍羽が金茶
      if (kind === 2 && up > 0.2 && u < 0.4) base = mix3(base, P.neck, sstep(0.2, 0.7, up) * sstep(0.4, 0.2, u));
      return feather(p, up < -0.6 ? mul3(base, 0.85) : base);
    }, (u) => [0, u, 0, 0]);
    // 首から頭まで一本の管：付け根は胴の中から胴の幅で出て、細くなりながら曲がって頭の丸みへ、くちばしの付け根で閉じる。
    // 色は胴の色から首の羽の色へなだらかに移り、蓑毛の細い筋が肩へ流れる（段や襟の境目を作らない）
    const NK = [[0, 0.24, 0.03, 0.076], [0, 0.297, 0.072, 0.064], [0, 0.343, 0.096, 0.047], [0, 0.381, 0.107, 0.034], [0, 0.411, 0.114, 0.028], [0, 0.434, 0.122, 0.0262], [0, 0.445, 0.136, 0.0248], [0, 0.444, 0.149, 0.02], [0, 0.44, 0.159, 0.0115], [0, 0.438, 0.163, 0.004]];
    limb(m, NK, 30, 20, (u, th, p) => {
      const streak = 0.5 + 0.5 * Math.sin(th * 9 + vn3(p[0] * 80, p[1] * 40, p[2] * 80) * 4);
      const c = mix3(P.body, P.neck, sstep(0.16, 0.44, u));
      const head = mix3(P.neck, P.body, 0.2);
      return u > 0.56 ? feather(p, mix3(c, head, sstep(0.56, 0.64, u))) : mix3(feather(p, c), mul3(c, 0.62), streak * 0.35 * sstep(0.08, 0.3, u) * sstep(0.58, 0.45, u));
    }, (u) => [6, Math.min(1, u / 0.55), 0, 0], 1.1);
    m.ellipsoid([0, 0.445, 0.137], [0.021, 0.0245, 0.028], 14, 12, (v, th, p) => mix3(P.neck, P.body, 0.2), () => [1, 0, 0, 0]);
    // 翼（たたんで体の横）：胴の面に沿って張りつき、下の縁だけ少し浮く。肩から風切羽の先へ、下の縁ほど濃い
    for (const sx of [-1, 1]) {
      const NI = 12, NJ = 6, base = m.n;
      const surf = (z, a, off) => {
        const q = sec(z);
        const c = Math.cos(a), s = Math.sin(a);
        let nx = c / q.hw, ny = s / q.hh;
        const nl = Math.hypot(nx, ny) || 1; nx /= nl; ny /= nl;
        return { p: [sx * (q.hw * c + nx * off), q.mid + q.hh * s + ny * off, z], n: [sx * nx, ny, 0] };
      };
      const rowZ = (i) => 0.08 - (i / NI) * 0.23;
      // 外形：肩は丸く、中ほどで幅が広く、風切羽の先は尾の方へ細く尖る
      const wingT = (t) => 0.25 + 0.42 * Math.sin(Math.min(1, t * 2.6) * Math.PI * 0.5) - 0.3 * sstep(0.35, 1.0, t);
      const wingB = (t) => 0.1 - 0.72 * Math.sin(Math.min(1, t * 2.2) * Math.PI * 0.5) + 0.78 * sstep(0.3, 1.0, t);
      for (let i = 0; i <= NI; i++) {
        const t = i / NI;
        const aT = wingT(t), aB = wingB(t);
        for (let j = 0; j <= NJ; j++) {
          const v = j / NJ;
          const off = 0.003 + 0.011 * v * v * Math.sin(Math.min(1, t * 1.6 + 0.2) * Math.PI * 0.5) - 0.002 * t;
          const q = surf(rowZ(i), aT + (aB - aT) * v, Math.max(0.002, off));
          m.vert(q.p, q.n, feather(q.p, mix3(P.wing, P.dark, (v > 0.55 ? 0.35 : 0) + (t > 0.55 && v > 0.3 ? 0.3 : 0))), [2, 0, sx, 0]);
        }
      }
      for (let i = 0; i < NI; i++) for (let j = 0; j < NJ; j++) {
        const a = base + i * (NJ + 1) + j, b = a + 1, c = a + NJ + 1, d = c + 1;
        m.I.push(a, c, b, b, c, d);
      }
      // 下の縁の厚み：浮いた縁から胴の面へ閉じる
      const lead = [], trail = [];
      for (let i = 0; i <= NI; i++) {
        const t = i / NI, aB = wingB(t);
        const off = 0.003 + 0.011 * Math.sin(Math.min(1, t * 1.6 + 0.2) * Math.PI * 0.5) - 0.002 * t;
        lead.push(surf(rowZ(i), aB, Math.max(0.002, off)).p);
        trail.push(surf(rowZ(i), aB + 0.08, -0.004).p);
      }
      m.strip(lead, trail, [sx, -0.5, 0], (p) => feather(p, mul3(P.dark, 0.8)), () => [2, 0, sx, 0]);
    }
    // 尾：細い羽を扇に束ねる。おんどりは長い鎌羽が弧を描いて垂れる
    const feathers = [];
    const nT = kind === 2 ? 12 : 8;
    for (let k = 0; k < nT; k++) {
      const side = k % 2 ? 1 : -1, lay = Math.floor(k / 2) / Math.max(1, Math.floor(nT / 2) - 1);
      if (kind === 2) {
        const L = 0.2 + 0.2 * (1 - lay) + 0.04 * Math.sin(k * 2.3);
        feathers.push({ side, L, rise: 1.25 + 0.2 * (1 - lay), fall: 2.9, w: 0.022, lat: 0.012 + lay * 0.035, c: k < 4 ? P.tail : mix3(P.tail, P.body, 0.15) });
      } else {
        feathers.push({ side, L: 0.13 + 0.03 * (1 - lay), rise: 0.95 + 0.25 * (1 - lay), fall: 0.5, w: 0.024, lat: 0.008 + lay * 0.03, c: P.tail });
      }
    }
    for (const fe of feathers) {
      const lead = [], trail = [];
      for (let i = 0; i <= 8; i++) {
        const t = i / 8;
        // 弧：付け根から上へ伸び、先は後ろへ垂れる
        let y = 0.325, z = -0.13;
        for (let q = 0; q < i; q++) { const a = fe.rise - (q / 8) * fe.fall; y += Math.sin(a) * fe.L / 8; z -= Math.abs(Math.cos(a)) * fe.L / 8; }
        const w = fe.w * Math.sin(Math.PI * Math.min(1, t * 0.85 + 0.15)) * (1 - t * 0.3);
        const x = fe.side * fe.lat * (0.4 + t);
        lead.push([x, y + w * 0.35, z + w * 0.5]);
        trail.push([x, y - w * 0.35, z - w * 0.5]);
      }
      m.strip(lead, trail, [1, 0, 0], (p, i) => mix3(fe.c, mul3(fe.c, 0.7), i / 8 * 0.4), (p, i) => [4, i / 8, 0, 1]);
    }
  });
  // くちばし
  m.with(M.KERATIN, () => {
    limb(m, [[0, 0.505 + HY, 0.158, 0.011], [0, 0.498 + HY, 0.172, 0.007], [0, 0.489 + HY, 0.186, 0.0015]], 6, 8, () => yellow, () => [1, 0, 0, 0], 0.85);
  });
  // とさか・肉垂（ぎざぎざの一枚とさか）
  m.with(M.COMB, () => {
    const big = kind === 2 ? 1.7 : kind === 1 ? 1.25 : 0.8;
    body(m, [[0.105, 0.53 + HY, 0.52 + HY, 0.003], [0.12, 0.535 + HY + 0.01 * big, 0.524 + HY, 0.004], [0.14, 0.537 + HY + 0.012 * big, 0.526 + HY, 0.0045], [0.16, 0.532 + HY + 0.008 * big, 0.522 + HY, 0.004], [0.172, 0.522 + HY, 0.515 + HY, 0.003]], 10, 8, () => red, () => [7, 0, 0, 0]);
    for (let k = 0; k < 5; k++) {
      const z = 0.11 + k * 0.014;
      const hgt = (0.008 + 0.01 * Math.sin((k + 0.5) / 5 * Math.PI)) * big;
      m.ellipsoid([0, 0.538 + HY + hgt * 0.6, z], [0.003, hgt * 0.65, 0.0055], 6, 5, () => red, () => [7, 0, 0, 0]);
    }
    for (const sx of [-1, 1]) m.ellipsoid([sx * 0.006, 0.472 + HY, 0.155], [0.005, 0.013 * big, 0.009], 6, 6, () => red, () => [7, 0, 0, 0]);
    // 耳たぶ（レグホンは白）
    for (const sx of [-1, 1]) m.ellipsoid([sx * 0.021, 0.49 + HY, 0.128], [0.004, 0.007, 0.006], 5, 4, () => (kind === 1 ? [0.82, 0.8, 0.74] : red), () => [7, 0, 0, 0]);
  });
  for (const sx of [-1, 1]) eye(m, [sx * 0.019, 0.508 + HY, 0.145], 0.0055, [0.62, 0.36, 0.05], sx, 0.2);
  // 脚：もも（太い羽の塊）が腹の下から膝まで覆い、黄色い鱗のすねは8〜9cm
  for (const sx of [-1, 1]) {
    m.with(M.FEATHER, () => limb(m, [[sx * 0.036, 0.21, -0.005, 0.05], [sx * 0.045, 0.16, 0.0, 0.044], [sx * 0.048, 0.125, 0.004, 0.032], [sx * 0.047, 0.103, 0.006, 0.019], [sx * 0.047, 0.094, 0.006, 0.011]], 10, 12, (u, th, p) => feather(p, mix3(mul3(P.body, 0.9), P.breast, 0.3)), (u) => [5, u * 0.3, sx, 0], 1.15));
    m.with(M.KERATIN, () => {
      limb(m, [[sx * 0.047, 0.104, 0.006, 0.0095], [sx * 0.046, 0.07, 0.002, 0.008], [sx * 0.046, 0.035, 0.004, 0.0073], [sx * 0.046, 0.013, 0.008, 0.007]], 8, 7, () => yellow, (u) => [5, 0.35 + u * 0.65, sx, 0]);
      // 指：前に三本、後ろに一本
      for (const a of [-0.5, 0, 0.5, Math.PI]) {
        const L = a === Math.PI ? 0.025 : 0.052;
        limb(m, [[sx * 0.046, 0.012, 0.008, 0.0048], [sx * 0.046 + Math.sin(a) * L * 0.5, 0.006, 0.008 + Math.cos(a) * L * 0.5, 0.0035], [sx * 0.046 + Math.sin(a) * L, 0.003, 0.008 + Math.cos(a) * L, 0.0018]], 3, 5, () => yellow, () => [5, 1, sx, 0]);
      }
    });
  }
  return m.build();
}

// ---- カメ（イシガメ・クサガメ）：甲羅干し・首をのばす・水へすべり込む・泳ぐ ----
// 部位: 0 甲羅 1 頭 4 尾 5 脚 6 首 8 目
// iC: x=手足の位相 y=動きの強さ z=首の出し（0 引っこめる〜1 のばす） w=首の上げ
// iD: x=濡れ（0 乾く〜1 濡れる） y=頭の左右 w=個体差（0.5 以上はクサガメの黒い甲羅）
export const TURTLE_ANIM = /* glsl */ `
void animate(inout vec3 p, inout vec3 n, inout vec3 col) {
  int part = int(aPart.x + 0.5);
  vWetOut = iD.x;
  // 濡れると色が濃くなる
  col *= mix(1.0, 0.62, iD.x);
  if (iD.w > 0.5) col *= part == 0 ? vec3(0.45, 0.44, 0.4) : vec3(0.7, 0.72, 0.62);
  if (part == 5) {
    float side = aPart.z;
    bool hind = aPart.w > 0.5;
    vec3 pv = vec3(0.045 * side, 0.03, hind ? -0.05 : 0.055);
    float off = (hind ? 3.1416 : 0.0) + (side > 0.0 ? 3.1416 : 0.0);
    float a = sin(iC.x + off) * 0.6 * iC.y;
    // 引っこめると甲羅の下へ
    float out_ = 0.35 + 0.65 * sat(iC.z * 1.5);
    mat3 R = rotY(side * a * (hind ? -1.0 : 1.0)) * rotZ(side * cos(iC.x + off) * 0.25 * iC.y);
    p = pv + (p - pv) * out_;
    p = rotAbout(p, pv, R); n = R * n;
  } else if (part == 1 || part == 6 || part == 8) {
    float t = part == 6 ? aPart.y : 1.0;
    vec3 nb = vec3(0.0, 0.036, 0.075);
    float ext = iC.z;
    p.z -= (1.0 - ext) * 0.045 * (0.4 + 0.6 * t);
    mat3 Rh = rotY(iD.y * t) * rotX(-iC.w * 0.6 * t);
    p = rotAbout(p, nb, Rh); n = Rh * n;
  } else if (part == 4) {
    p.z += (1.0 - iC.z) * 0.012;
  }
}
`;
export function turtleGeo() {
  const m = new MeshX();
  const shellC = [0.3, 0.2, 0.08], edgeC = [0.36, 0.26, 0.1], skin = [0.2, 0.18, 0.1], skinY = [0.55, 0.47, 0.2], plast = [0.3, 0.24, 0.1];
  // 甲羅：低いドームに背の稜、縁は少し反り、後ろの縁はぎざぎざ（溝と成長輪は材質で描く）
  m.with(M.SHELL, () => {
    const L = 0.09, W = 0.07, Hh = 0.04;
    const su = 40, sv = 14, base = m.n;
    const P = (v, th) => {
      const ca = Math.cos(th), sa = Math.sin(th);
      const rr = Math.sin(v * Math.PI * 0.5);
      const serr = ca < -0.3 ? 0.06 * Math.max(0, Math.sin(th * 11)) * sstep(0.85, 1.0, rr) : 0;
      const x = sa * W * rr * (1 + serr * 0.3), z = ca * L * rr * (ca > 0 ? 1.0 : 1.05) * (1 + serr);
      const dome = Math.pow(Math.cos(v * Math.PI * 0.5), 0.8);
      const keel = 0.006 * Math.exp(-Math.pow(sa * rr / 0.15, 2)) * dome;
      const flare = 0.004 * sstep(0.8, 1.0, rr);
      const y = 0.028 + dome * Hh * (1 - 0.12 * ca) + keel + flare;
      return [x, y, z];
    };
    for (let j = 0; j <= sv; j++) for (let i = 0; i <= su; i++) {
      const v = j / sv, th = (i / su) * Math.PI * 2;
      const p = P(v, th);
      const e = 1e-3;
      const a = P(Math.min(1, v + e), th), b = P(Math.max(0.0001, v), th + e);
      const d1 = [a[0] - p[0], a[1] - p[1], a[2] - p[2]], d2 = [b[0] - p[0], b[1] - p[1], b[2] - p[2]];
      let nn = [d1[1] * d2[2] - d1[2] * d2[1], d1[2] * d2[0] - d1[0] * d2[2], d1[0] * d2[1] - d1[1] * d2[0]];
      if (v < 0.02) nn = [0, 1, 0];
      if (nn[0] * p[0] + nn[1] * (p[1] - 0.02) + nn[2] * p[2] < 0) nn = nn.map((q) => -q);
      const nl = Math.hypot(...nn) || 1;
      m.vert(p, [nn[0] / nl, nn[1] / nl, nn[2] / nl], mix3(shellC, edgeC, sstep(0.8, 1.0, v)), [0, v, 0, 0]);
    }
    for (let j = 0; j < sv; j++) for (let i = 0; i < su; i++) {
      const a = base + j * (su + 1) + i, b = a + 1, cc = a + su + 1, d = cc + 1;
      m.I.push(a, cc, b, b, cc, d);
    }
    // 腹甲（下の平らな面）
    m.ellipsoid([0, 0.027, 0], [W * 0.93, 0.007, L * 0.95], 18, 5, () => plast, () => [0, 0, 0, 0]);
  });
  m.with(M.SKIN, () => {
    // 首と頭：のどは黄色く、頭の横に黄色い筋（クサガメは目立つ）
    limb(m, [[0, 0.033, 0.06, 0.016], [0, 0.036, 0.08, 0.0145], [0, 0.039, 0.1, 0.013]], 6, 10, (u, th) => (Math.sin(th) < -0.1 ? skinY : Math.abs(Math.cos(th)) > 0.8 ? mix3(skin, skinY, 0.6) : skin), (u) => [6, u, 0, 0]);
    body(m, [[0.097, 0.052, 0.028, 0.012], [0.11, 0.054, 0.029, 0.013], [0.123, 0.051, 0.031, 0.011], [0.134, 0.046, 0.034, 0.007], [0.14, 0.042, 0.036, 0.002]], 8, 12, (u, th) => (Math.sin(th) < -0.3 ? skinY : Math.abs(Math.cos(th)) > 0.85 && u > 0.3 ? mix3(skin, skinY, 0.7) : skin), () => [1, 0, 0, 0], true, true);
    for (const sx of [-1, 1]) {
      // 手足：鱗の水かき、爪
      limb(m, [[sx * 0.045, 0.03, 0.055, 0.012], [sx * 0.066, 0.025, 0.068, 0.011], [sx * 0.078, 0.017, 0.077, 0.01], [sx * 0.086, 0.012, 0.084, 0.007], [sx * 0.09, 0.01, 0.09, 0.003]], 8, 8, () => skin, (u) => [5, u, sx, 0]);
      limb(m, [[sx * 0.045, 0.03, -0.05, 0.013], [sx * 0.066, 0.022, -0.066, 0.012], [sx * 0.077, 0.014, -0.078, 0.01], [sx * 0.083, 0.011, -0.086, 0.007], [sx * 0.086, 0.01, -0.092, 0.003]], 8, 8, () => skin, (u) => [5, u, sx, 1]);
    }
    limb(m, [[0, 0.032, -0.085, 0.007], [0, 0.03, -0.097, 0.004], [0, 0.028, -0.107, 0.001]], 4, 6, () => skin, () => [4, 0, 0, 0]);
  });
  for (const sx of [-1, 1]) eye(m, [sx * 0.0098, 0.047, 0.121], 0.0034, [0.42, 0.34, 0.1], sx, 0.2);
  return m.build();
}

// ---- アメンボ（水面に立つ細長い虫） ----
// iC: x=漕ぐ（0..1） iD.w 個体差
export const STRIDER_ANIM = /* glsl */ `
void animate(inout vec3 p, inout vec3 n, inout vec3 col) {
  int part = int(aPart.x + 0.5);
  if (part == 5 && aPart.w > 0.5) {
    // 中脚：漕ぐと後ろへ振る
    vec3 pv = vec3(0.0015 * aPart.z, 0.004, 0.0);
    mat3 R = rotY(aPart.z * iC.x * 0.6);
    p = rotAbout(p, pv, R); n = R * n;
  }
}
`;
export function striderGeo() {
  const m = new MeshX();
  const c = [0.05, 0.045, 0.04];
  m.with(M.CHITIN, () => {
    m.tube([{ p: [0, 0.004, -0.008], rx: 0.0008, ry: 0.0007 }, { p: [0, 0.0045, -0.004], rx: 0.0016, ry: 0.0012 }, { p: [0, 0.0048, 0.003], rx: 0.0014, ry: 0.0011 }, { p: [0, 0.0048, 0.007], rx: 0.0009, ry: 0.0008 }], 6, () => c, () => [0, 0, 0, 0]);
    for (const sx of [-1, 1]) {
      // 前脚（短い）・中脚（長く横へ）・後脚（後ろへ）
      m.tube([{ p: [sx * 0.001, 0.0045, 0.005], rx: 0.0003, ry: 0.0003 }, { p: [sx * 0.003, 0.003, 0.009], rx: 0.0003, ry: 0.0003 }, { p: [sx * 0.004, 0.0005, 0.011], rx: 0.0002, ry: 0.0002 }], 3, () => c, () => [5, 0, sx, 0]);
      m.tube([{ p: [sx * 0.0015, 0.004, 0.0], rx: 0.00035, ry: 0.00035 }, { p: [sx * 0.008, 0.005, 0.001], rx: 0.0003, ry: 0.0003 }, { p: [sx * 0.014, 0.0003, -0.002], rx: 0.00025, ry: 0.00025 }, { p: [sx * 0.019, 0.0, -0.008], rx: 0.0002, ry: 0.0002 }], 3, () => c, () => [5, 0, sx, 1]);
      m.tube([{ p: [sx * 0.0012, 0.004, -0.003], rx: 0.0003, ry: 0.0003 }, { p: [sx * 0.007, 0.004, -0.008], rx: 0.00028, ry: 0.00028 }, { p: [sx * 0.01, 0.0002, -0.016], rx: 0.0002, ry: 0.0002 }, { p: [sx * 0.011, 0.0, -0.022], rx: 0.0002, ry: 0.0002 }], 3, () => c, () => [5, 0, sx, 0]);
    }
  });
  return m.build();
}

// ---- オタマジャクシ（トノサマガエル・アマガエルの子） ----
// iC: x=尾の位相 y=泳ぐ強さ
export const TADPOLE_ANIM = /* glsl */ `
void animate(inout vec3 p, inout vec3 n, inout vec3 col) {
  float u = sat(-p.z / 0.02);
  float w = sin(iC.x - u * 5.0) * (0.15 + 0.85 * u) * (0.2 + 0.8 * iC.y);
  p.x += w * 0.004;
  if (aPart.x > 3.5) vThinOut = 1.0;
}
`;
export function tadpoleGeo() {
  const m = new MeshX();
  const c = [0.05, 0.045, 0.035], belly = [0.2, 0.18, 0.12];
  m.with(M.SKIN, () => {
    m.ellipsoid([0, 0.0, 0.002], [0.0045, 0.0038, 0.0065], 10, 7, (v) => (v > 0.6 ? belly : c), () => [0, 0, 0, 0]);
    const lead = [], trail = [];
    for (let i = 0; i <= 6; i++) {
      const t = i / 6;
      const hgt = 0.0035 * Math.sin(Math.PI * Math.min(1, 0.25 + t * 0.8));
      lead.push([0, hgt, -0.003 - t * 0.02]);
      trail.push([0, -hgt, -0.003 - t * 0.02]);
    }
    m.strip(lead, trail, [1, 0, 0], (p, i) => mix3(c, [0.12, 0.11, 0.08], i / 6), () => [4, 0, 0, 0]);
  });
  m.with(M.EYE, () => { for (const sx of [-1, 1]) m.ellipsoid([sx * 0.003, 0.0015, 0.005], [0.0012, 0.0012, 0.0012], 5, 4, () => [0.12, 0.1, 0.05], () => [8, 0, 0, 0]); });
  return m.build();
}

// ---- 流木（カメが甲羅干しする、岸から水へ半分沈んだ丸太） ----
// 丸太の軸は z（0 が岸の端、LOG_L が水の端）。半径は LOG_R(u)（u=0..1）。上面の高さはこの式で求まる
export const LOG_L = 1.7;
export const LOG_R = (u) => 0.105 * (1 - 0.28 * u);
export const LOG_ANIM = /* glsl */ `void animate(inout vec3 p, inout vec3 n, inout vec3 col) {}`;
export function logGeo() {
  const m = new MeshX();
  const bark = [0.15, 0.12, 0.095], barkD = [0.09, 0.075, 0.06], bare = [0.44, 0.41, 0.36], endG = [0.5, 0.42, 0.3];
  const col = (p, up) => {
    // 皮がはがれた所は晒けて白っぽい（上を向いた面ほど多い）
    const pe = vn3(p[0] * 7 + 3, p[1] * 7, p[2] * 5) + up * 0.18;
    return pe > 0.62 ? mix3(bare, mul3(bare, 0.8), vn3(p[0] * 30, p[1] * 30, p[2] * 8)) : mix3(bark, barkD, vn3(p[0] * 25, p[1] * 25, p[2] * 6));
  };
  m.with(M.BARK, () => {
    const NR = 34, NS = 22, base = m.n;
    for (let i = 0; i <= NR; i++) {
      const u = i / NR, z = u * LOG_L;
      for (let k = 0; k <= NS; k++) {
        const th = (k / NS) * Math.PI * 2;
        const c = Math.cos(th), sn = Math.sin(th);
        // こぶと割れ目で丸さをくずす（平均の半径は LOG_R のまま）
        const bump = 1 + 0.05 * (vn3(c * 2 + 5, sn * 2, z * 3) - 0.5) + 0.025 * (vn3(c * 6, sn * 6 + 3, z * 9) - 0.5);
        const r = LOG_R(u) * bump;
        const p = [sn * r, c * r, z];
        m.vert(p, [sn, c, 0], col(p, c), [0, u, 0, 0]);
      }
    }
    for (let i = 0; i < NR; i++) for (let k = 0; k < NS; k++) {
      const a = base + i * (NS + 1) + k, b = a + 1, cc = a + NS + 1, d = cc + 1;
      m.I.push(a, cc, b, b, cc, d);
    }
    // 折れた両端：ぎざぎざの木口
    for (const [u, sg] of [[0, -1], [1, 1]]) {
      const z = u * LOG_L, c0 = m.vert([0, 0, z + sg * 0.01], [0, 0, sg], endG, [0, u, 0, 0]);
      const ids = [];
      for (let k = 0; k <= NS; k++) {
        const th = (k / NS) * Math.PI * 2;
        const r = LOG_R(u) * (1 + 0.05 * (vn3(Math.cos(th) * 2 + 5, Math.sin(th) * 2, z * 3) - 0.5));
        const jag = sg * 0.025 * Math.abs(Math.sin(th * 3.5 + u * 5));
        ids.push(m.vert([Math.sin(th) * r * 0.97, Math.cos(th) * r * 0.97, z + jag], [0, 0, sg], mix3(endG, [0.3, 0.26, 0.2], 0.4 + 0.3 * Math.sin(th * 7)), [0, u, 0, 0]));
      }
      for (let k = 0; k < NS; k++) m.I.push(c0, ids[k], ids[k + 1]);
    }
    // 折れた枝の株
    for (const [u, th, len] of [[0.34, 0.9, 0.16], [0.62, -1.3, 0.11], [0.8, 0.2, 0.08]]) {
      const r0 = LOG_R(u), z = u * LOG_L;
      const d = [Math.sin(th), Math.cos(th), 0.35];
      limb(m, [[d[0] * r0 * 0.6, d[1] * r0 * 0.6, z], [d[0] * (r0 + len * 0.5), d[1] * (r0 + len * 0.5), z + len * 0.18], [d[0] * (r0 + len), d[1] * (r0 + len), z + len * 0.35]].map((q, i) => [...q, [0.032, 0.024, 0.016][i]]), 4, 8, (uu, t2, p) => (uu > 0.9 ? endG : col(p, 0.5)), () => [0, u, 0, 0]);
    }
  });
  return m.build();
}
