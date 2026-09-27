// 雲：被覆の地図（繰り返し）＋立体の細部雑音。雲の影・水面の映り込み・空の雲が同じ地図を使う
import * as THREE from 'three';

const hash = (x, y, z, s) => {
  let h = (x * 374761393 + y * 668265263 + z * 1274126177 + s * 2246822519) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
const mod = (a, p) => ((a % p) + p) % p;
function pnoise2(x, y, P, s) {
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
  const u = fx * fx * fx * (fx * (fx * 6 - 15) + 10), v = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
  const g = (ix, iy) => { const a = hash(mod(ix, P), mod(iy, P), 0, s) * 6.2831853; return [Math.cos(a), Math.sin(a)]; };
  const d = (ix, iy) => { const gg = g(ix, iy); return gg[0] * (x - ix) + gg[1] * (y - iy); };
  const a = d(xi, yi), b = d(xi + 1, yi), c = d(xi, yi + 1), e = d(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + e) * u * v;
}
function worley2(x, y, P, s) {
  const xi = Math.floor(x), yi = Math.floor(y);
  let best = 9;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const cx = xi + dx, cy = yi + dy;
    const px = cx + hash(mod(cx, P), mod(cy, P), 1, s), py = cy + hash(mod(cx, P), mod(cy, P), 2, s);
    best = Math.min(best, Math.hypot(px - x, py - y));
  }
  return best;
}
function worley3(x, y, z, P, s) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  let best = 9;
  for (let dz = -1; dz <= 1; dz++) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const cx = xi + dx, cy = yi + dy, cz = zi + dz;
    const mx = mod(cx, P), my = mod(cy, P), mz = mod(cz, P);
    const px = cx + hash(mx, my, mz, s), py = cy + hash(mx, my, mz, s + 1), pz = cz + hash(mx, my, mz, s + 2);
    const d = (px - x) ** 2 + (py - y) ** 2 + (pz - z) ** 2;
    if (d < best) best = d;
  }
  return Math.sqrt(best);
}

export function buildCloudCoverage() {
  const S = 512;
  const d = new Uint8Array(S * S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const u = x / S, v = y / S;
    let f = 0, a = 0.5, fr = 4, n = 0;
    for (let o = 0; o < 5; o++) { f += a * pnoise2(u * fr, v * fr, fr, 3 + o); n += a; a *= 0.5; fr *= 2; }
    f = f / n * 0.5 + 0.5;
    const w = 1 - Math.min(1, worley2(u * 10, v * 10, 10, 17) * 1.1);
    const w2 = 1 - Math.min(1, worley2(u * 22, v * 22, 22, 29) * 1.1);
    const c = f * 0.62 + w * 0.28 + w2 * 0.1;
    d[y * S + x] = Math.max(0, Math.min(255, Math.round((c - 0.18) / 0.7 * 255)));
  }
  const t = new THREE.DataTexture(d, S, S, THREE.RedFormat, THREE.UnsignedByteType);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.needsUpdate = true;
  return t;
}

// 立体の細部（64³：r=もこもこ g=細かい侵食）
export function buildCloudNoise3D() {
  const S = 64;
  const d = new Uint8Array(S * S * S * 2);
  for (let z = 0; z < S; z++) for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const u = x / S, v = y / S, w = z / S;
    const w1 = 1 - Math.min(1, worley3(u * 4, v * 4, w * 4, 4, 5));
    const w2 = 1 - Math.min(1, worley3(u * 8, v * 8, w * 8, 8, 11));
    const w3 = 1 - Math.min(1, worley3(u * 16, v * 16, w * 16, 16, 23));
    const o = (z * S * S + y * S + x) * 2;
    d[o] = Math.round(Math.min(1, w1 * 0.625 + w2 * 0.25 + w3 * 0.125) * 255);
    d[o + 1] = Math.round(Math.min(1, w2 * 0.5 + w3 * 0.5) * 255);
  }
  const t = new THREE.Data3DTexture(d, S, S, S);
  t.format = THREE.RGFormat;
  t.type = THREE.UnsignedByteType;
  t.wrapS = t.wrapT = t.wrapR = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearFilter;
  t.unpackAlignment = 1;
  t.needsUpdate = true;
  return t;
}

// ---- 立体の雲（半分の解像度で光線を進める） ----
import { ALL as _ALL } from './glsl.js';
import { SKY_GLSL as _SKY } from './sky.js';
import { DEPTH_GLSL as _DEPTH, FS_VS as _FSVS } from './post.js';

const CLOUD_FS = /* glsl */ `
${_ALL}
${_SKY}
${_DEPTH}
uniform sampler2D tDepth;
uniform highp sampler3D tNoise3;
uniform vec2 uRes;
varying vec2 vUv;
float remap(float x, float a, float b, float c, float d) { return c + (x - a) / (b - a) * (d - c); }
// 被覆の地図から雲の濃さへの傾き（雲の量）
#define CSLOPE 1.7
float cloudDensity(vec3 p, bool detail) {
  float base = uCloud.x, top = uCloud.y;
  float h01 = (p.y - base) / (top - base);
  if (h01 < 0.0 || h01 > 1.0) return 0.0;
  vec2 uv = (p.xz + uCloudOff) / uCloud.w;
  float cov = texture(tCloudCov, uv).r;
  float c = sat((cov - uCloud.z) / (1.0 - uCloud.z) * CSLOPE);
  if (c <= 0.001) return 0.0;
  // 積雲：底は平らでくっきり、上へ行くほど細って丸い頭。濃いところほど背が高い
  float topH = mix(0.2, 0.85, pow(c, 0.9));
  float bottom = smoothstep(0.0, 0.035, h01);
  float crown = 1.0 - smoothstep(topH * 0.3, topH, h01);
  // 上ほど外側から削られる（カリフラワー状の頭）
  float d = c * bottom * crown;
  if (d <= 0.001) return 0.0;
  d = sat(remap(d, min(pow(h01 / topH, 1.5), 1.0) * 0.55, 1.0, 0.0, 1.0));
  if (d <= 0.001) return 0.0;
  vec3 q = (p + vec3(uCloudOff.x, 0.0, uCloudOff.y)) / 1100.0;
  float n = texture(tNoise3, q).r;
  d = sat(remap(d, (1.0 - n) * 0.75, 1.0, 0.0, 1.0));
  if (detail && d > 0.0) {
    // 細かい侵食：縁をもこもこに削る（底の近くは弱く、平らな底を残す）
    float n2 = texture(tNoise3, q * 1.7 + vec3(0.0, uTime * 0.004, 0.0)).g;
    float n3 = texture(tNoise3, q * 3.4 - vec3(uTime * 0.006, 0.0, 0.0)).r;
    float hf = n2 * 0.7 + n3 * 0.3;
    d = sat(remap(d, hf * mix(0.04, 0.42, sat(h01 * 3.0)), 1.0, 0.0, 1.0));
  }
  return d * 2.0;
}
// 形だけの密度（雑音なし）：太陽方向の遠い区間の厚さに使う。1点が雑音の穴に落ちて厚さが抜けるのを防ぐ
float cloudShape(vec3 p) {
  float h01 = (p.y - uCloud.x) / (uCloud.y - uCloud.x);
  if (h01 < 0.0 || h01 > 1.0) return 0.0;
  float cov = texture(tCloudCov, (p.xz + uCloudOff) / uCloud.w).r;
  float c = sat((cov - uCloud.z) / (1.0 - uCloud.z) * CSLOPE);
  float topH = mix(0.2, 0.85, pow(c, 0.9));
  float d = c * smoothstep(0.0, 0.035, h01) * (1.0 - smoothstep(topH * 0.3, topH, h01));
  d = sat(remap(d, min(pow(h01 / max(topH, 1e-3), 1.5), 1.0) * 0.55, 1.0, 0.0, 1.0));
  // 3Dの雑音で削られる分の平均（約0.55）
  return d * 0.55 * 2.0;
}
void main() {
  float dsc = texture(tDepth, vUv).r;
  if (!isSky(dsc)) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }
  vec3 ro = cameraPosition;
  vec3 rd = viewRay(vUv);
  if (rd.y < 0.005) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }
  float t0 = (uCloud.x - ro.y) / rd.y, t1 = (uCloud.y - ro.y) / rd.y;
  t0 = max(t0, 0.0);
  t1 = min(t1, 60000.0);
  if (t1 <= t0) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }
  const int STEPS = 44;
  float seg = t1 - t0;
  float dt = clamp(seg / float(STEPS), 20.0, 300.0);
  float jitter = ign(gl_FragCoord.xy + uFrame * 5.3);
  // 太陽方向の刻みのずらし：視線のずらしとは別の種で、フレームごとに黄金比で回す（同じ画素で偏らない）
  float jl = fract(ign(gl_FragCoord.yx * 1.13 + 47.0) + float(uFrame) * 0.618034);
  float t = t0 + dt * jitter;
  float T = 1.0;
  vec3 acc = vec3(0.0);
  float mu = dot(rd, uSunDir);
  // 位相：前方の強い山（太陽の近くの銀の縁）＋後方の山（順光の面も白く光る）。多重散乱の段ほど丸く
  float ph0 = min(mix(hg(mu, 0.75), hg(mu, -0.3), 0.4) * 4.0 * PI, 12.0);
  float ph1 = mix(hg(mu, 0.45), hg(mu, -0.2), 0.4) * 4.0 * PI;
  float ph2 = mix(hg(mu, 0.2), hg(mu, -0.1), 0.5) * 4.0 * PI;
  vec3 skyUp = shIrr(vec3(0.0, 1.0, 0.0)) / 0.8;
  // 雲の中の空の光：上は空がよく見える。底は空の散乱光と地面の照り返し（晴れた春の空の明るい腹）
  vec3 ambTop = skyUp * 0.7;
  vec3 ambBot = mix(vec3(dot(skyUp, vec3(0.33))), skyUp, 0.5) * 0.2 + uGroundCol * 0.45;
  float sigma = 0.04;
  float firstHit = -1.0;
  // 空いている所は粗く進み、雲に入ったら一歩戻って細かく刻む（表面の縞を防ぐ）
  float dtF = min(dt * 0.3, 18.0);
  bool fine = false;
  int empty = 0;
  // 戻った距離より長く空が続いたときだけ粗い歩みに戻す（行ったり来たりを防ぐ）
  int emptyMax = int(dt * 1.5 / dtF) + 2;
  for (int i = 0; i < 140; i++) {
    if (t > t1 || T < 0.015) break;
    vec3 p = ro + rd * t;
    float dd = cloudDensity(p, false);
    if (!fine) {
      if (dd > 0.0) { fine = true; empty = 0; t = max(t - dt * 1.4, t0); continue; }
      t += dt * 1.4;
      continue;
    }
    float d = dd > 0.0 ? cloudDensity(p, true) : 0.0;
    // 入ったばかり（まだ透ける所）は細かく刻む：表面の1点で画素の色が決まって、明暗の粒になるのを防ぐ
    float st = d > 0.0 ? dtF * mix(0.3, 1.0, sat(1.1 - T * 1.1)) : dtF;
    if (d > 0.0) {
      empty = 0;
      if (firstHit < 0.0) firstHit = t;
      // 太陽への光学的な厚さ：手前2点は決まった距離（5m・15m、細部つき）、その先は区間を広げて区間内に層化（雑音なしの形）
      // 1点が外れても厚さが大きく抜けないよう、区間の幅で重みをつける
      float od = cloudDensity(p + uSunDir * 5.0, true) * 10.0 + cloudDensity(p + uSunDir * 15.0, true) * 10.0;
      float a0 = 20.0, w0 = 30.0;
      for (int k = 0; k < 4; k++) {
        od += cloudShape(p + uSunDir * (a0 + w0 * jl)) * w0;
        a0 += w0;
        w0 *= 2.2;
      }
      od *= sigma;
      // 多重散乱の近似（段ごとに減衰を弱め、位相を丸める）
      vec3 Ls = uSunCol * (1.6 * exp(-od) * ph0 + 0.9 * exp(-od * 0.25) * ph1 + 0.3 * exp(-od * 0.1) * ph2);
      // 粉っぽさ：太陽の反対側から見る縁が少し暗い
      float powder = 1.0 - exp(-dd * sigma * 60.0);
      Ls *= mix(1.0, powder, 0.2 * (0.5 - 0.5 * mu));
      float h01 = (p.y - uCloud.x) / (uCloud.y - uCloud.x);
      vec3 amb = mix(ambBot, ambTop, pow(sat(h01 * 1.3), 0.7));
      vec3 S = (Ls * 0.9 + amb) * d * sigma;
      float Ti = exp(-d * sigma * st);
      acc += T * S * (1.0 - Ti) / max(d * sigma, 1e-5);
      T *= Ti;
    } else if (++empty > emptyMax) { fine = false; }
    t += st;
  }
  // 遠い雲は空の霞に溶ける・地平線の近くは薄く
  float dist = firstHit > 0.0 ? firstHit : t0;
  float haze = 1.0 - exp(-dist * 0.000065);
  vec3 skyC = skyRadiance(rd);
  acc = mix(acc, skyC * (1.0 - T), haze * 0.85);
  float low = smoothstep(0.03, 0.14, rd.y);
  acc *= low;
  T = mix(1.0, T, low);
  gl_FragColor = vec4(acc, T);
}
`;

// 前のフレームの雲を、空の向きで写し直して混ぜる（ざらつきを消す）
const TAA_FS = /* glsl */ `
${_DEPTH}
uniform sampler2D tCur;
uniform sampler2D tPrev;
uniform mat4 uPrevVP;
uniform float uBlend;
varying vec2 vUv;
vec3 toYC(vec3 c) { return vec3(dot(c, vec3(0.25, 0.5, 0.25)), dot(c, vec3(0.5, 0.0, -0.5)), dot(c, vec3(-0.25, 0.5, -0.25))); }
vec3 fromYC(vec3 y) { return vec3(y.x + y.y - y.z, y.x + y.z, y.x - y.y - y.z); }
void main() {
  vec4 cur = texture(tCur, vUv);
  vec3 rd = viewRay(vUv);
  vec4 pc = uPrevVP * vec4(rd, 0.0);
  vec2 puv = pc.xy / pc.w * 0.5 + 0.5;
  float ok = (pc.w > 0.0 && all(greaterThan(puv, vec2(0.002))) && all(lessThan(puv, vec2(0.998)))) ? 1.0 : 0.0;
  vec4 prev = texture(tPrev, puv);
  // 近くの画素の平均±1.25σ（YCoCg）に前のフレームを収める：にじみ（ゴースト）と飛び出た点を防ぐ
  vec2 px = 1.0 / vec2(textureSize(tCur, 0));
  vec4 m1 = vec4(0.0), m2 = vec4(0.0);
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec4 s = texture(tCur, vUv + vec2(float(i), float(j)) * px);
    vec4 y = vec4(toYC(s.rgb), s.a);
    m1 += y; m2 += y * y;
  }
  m1 /= 9.0; m2 /= 9.0;
  vec4 sg = sqrt(max(m2 - m1 * m1, 0.0));
  vec4 lo = m1 - sg * 1.25 - vec4(0.004), hi = m1 + sg * 1.25 + vec4(0.004);
  // 今のフレームの明るさも、自分を除いた近傍平均の2.5倍で頭打ち（光の刻みの外れで出る白い点を抑える）
  vec3 yc = toYC(cur.rgb);
  float cap = (m1.x * 9.0 - yc.x) / 8.0 * 2.5 + 0.02;
  if (yc.x > cap) yc *= cap / max(yc.x, 1e-5);
  cur.rgb = fromYC(yc);
  vec4 yp = clamp(vec4(toYC(prev.rgb), prev.a), lo, hi);
  prev = vec4(fromYC(yp.xyz), yp.w);
  // 明るさで重みをつけて混ぜる（明るい点ほど重みが小さい）
  float b = uBlend * ok;
  float wc = (1.0 - b) / (1.0 + yc.x), wp = b / (1.0 + yp.x);
  vec3 rgb = (cur.rgb * wc + prev.rgb * wp) / max(wc + wp, 1e-5);
  gl_FragColor = vec4(max(rgb, 0.0), mix(cur.a, prev.a, b));
}
`;

export class Clouds {
  constructor(renderer, shared, depthU) {
    this.renderer = renderer;
    this.tex3 = buildCloudNoise3D();
    this.mat = new THREE.ShaderMaterial({
      uniforms: { ...shared, ...depthU, tDepth: { value: null }, tNoise3: { value: this.tex3 }, uRes: { value: new THREE.Vector2() } },
      vertexShader: _FSVS, fragmentShader: CLOUD_FS, depthTest: false, depthWrite: false,
    });
    this.taa = new THREE.ShaderMaterial({
      uniforms: { ...depthU, tCur: { value: null }, tPrev: { value: null }, uPrevVP: { value: new THREE.Matrix4() }, uBlend: { value: 0.85 } },
      vertexShader: _FSVS, fragmentShader: TAA_FS, depthTest: false, depthWrite: false,
    });
    this.rt = null;
    this.hist = [null, null];
    this.idx = 0;
    this.prevVP = new THREE.Matrix4();
    this.hasPrev = false;
  }
  resize(w, h) {
    this.rt?.dispose();
    this.hist.forEach((t) => t?.dispose());
    const mk = () => new THREE.WebGLRenderTarget(Math.ceil(w / 2), Math.ceil(h / 2), { type: THREE.HalfFloatType, depthBuffer: false, magFilter: THREE.LinearFilter, minFilter: THREE.LinearFilter });
    this.rt = mk();
    this.hist = [mk(), mk()];
    this.hasPrev = false;
    this.mat.uniforms.uRes.value.set(this.rt.width, this.rt.height);
  }
  render(post, depthTex, camera) {
    this.mat.uniforms.tDepth.value = depthTex;
    post.run(this.mat, this.rt);
    const out = this.hist[this.idx], prev = this.hist[1 - this.idx];
    this.taa.uniforms.tCur.value = this.rt.texture;
    this.taa.uniforms.tPrev.value = prev.texture;
    this.taa.uniforms.uPrevVP.value.copy(this.prevVP);
    this.taa.uniforms.uBlend.value = this.hasPrev ? 0.92 : 0;
    post.run(this.taa, out);
    // 今の向きだけの行列（平行移動なし）を次のフレームへ
    const rot = new THREE.Matrix4().extractRotation(camera.matrixWorldInverse);
    this.prevVP.multiplyMatrices(camera.projectionMatrix, rot);
    this.hasPrev = true;
    this.idx = 1 - this.idx;
    return out.texture;
  }
}
