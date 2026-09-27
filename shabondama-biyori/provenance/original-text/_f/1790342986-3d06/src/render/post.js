// 画面全体の処理：空と霞の合成 → 被写界深度 → 泡 → 光のにじみ → 色調
import * as THREE from 'three';
import { ALL } from './glsl.js';
import { SKY_GLSL } from './sky.js';

// 薄膜（bubbles.js と同じ式。循環を避けてここにも置く）
const FILM_GLSL_POST = /* glsl */ `
const float FILM_N = 1.33;
const vec3 WL_RGB[9] = vec3[9](
  vec3(0.0142, -0.0117, 0.0829), vec3(0.0638, -0.0781, 0.7198), vec3(-0.0785, 0.0679, 0.3171),
  vec3(-0.2313, 0.3789, 0.0009), vec3(-0.0340, 0.4985, -0.0644), vec3(0.5131, 0.2042, -0.0429),
  vec3(0.5898, -0.0435, -0.0109), vec3(0.1533, -0.0171, -0.0020), vec3(0.0095, 0.0009, -0.0004));
const float WL[9] = float[9](410.0, 445.0, 480.0, 515.0, 550.0, 585.0, 620.0, 655.0, 690.0);
vec3 filmReflectance(float cosI, float dnm) {
  float sinI2 = 1.0 - cosI * cosI;
  float cosT = sqrt(max(1.0 - sinI2 / (FILM_N * FILM_N), 0.0));
  float rs = (cosI - FILM_N * cosT) / (cosI + FILM_N * cosT);
  float rp = (FILM_N * cosI - cosT) / (FILM_N * cosI + cosT);
  float r2 = 0.5 * (rs * rs + rp * rp);
  vec3 acc = vec3(0.0);
  for (int i = 0; i < 9; i++) {
    float delta = 4.0 * 3.14159265 * FILM_N * dnm * cosT / WL[i];
    float c = cos(delta);
    acc += WL_RGB[i] * (2.0 * r2 * (1.0 - c) / (1.0 + r2 * r2 - 2.0 * r2 * c));
  }
  return max(acc, 0.0);
}
`;

export const FS_VS = /* glsl */ `
varying vec2 vUv;
void main() { vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

// 深度 → 視点からの距離（逆Z：near側が1）
export const DEPTH_GLSL = /* glsl */ `
uniform vec3 uCam;        // x=near y=far z=逆Zなら1
uniform mat4 uProjInv;
uniform mat4 uViewInv;
float linearDepth(float d) {
  float n = uCam.x, f = uCam.y;
  if (uCam.z > 0.5) return n * f / (d * (f - n) + n);
  float z = d * 2.0 - 1.0;
  return 2.0 * n * f / (f + n - z * (f - n));
}
bool isSky(float d) { return uCam.z > 0.5 ? d <= 0.0 : d >= 1.0; }
vec3 viewRay(vec2 uv) {
  vec4 p = uProjInv * vec4(uv * 2.0 - 1.0, uCam.z > 0.5 ? 0.5 : 0.0, 1.0);
  vec3 v = p.xyz / p.w;
  return normalize((uViewInv * vec4(v, 0.0)).xyz);
}
vec3 worldFromDepth(vec2 uv, float d) {
  vec4 p = uProjInv * vec4(uv * 2.0 - 1.0, uCam.z > 0.5 ? d : d * 2.0 - 1.0, 1.0);
  return (uViewInv * vec4(p.xyz / p.w, 1.0)).xyz;
}
`;

const COMPOSITE_FS = /* glsl */ `
${ALL}
${SKY_GLSL}
${DEPTH_GLSL}
uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform sampler2D tClouds;
uniform float uClouds;
uniform sampler2D tAO;
uniform float uAO;
varying vec2 vUv;
// 半分の解像度の遮蔽を、距離の近い画素だけで広げる（縁のにじみを防ぐ）
float aoUp(vec2 uv, float z) {
  vec2 hs = vec2(textureSize(tAO, 0));
  vec2 f = uv * hs - 0.5;
  vec2 i = floor(f), t = f - i;
  ivec2 b = ivec2(i);
  ivec2 mx = ivec2(hs) - 1;
  float acc = 0.0, tot = 0.0;
  for (int k = 0; k < 4; k++) {
    ivec2 o = ivec2(k & 1, k >> 1);
    vec2 s = texelFetch(tAO, clamp(b + o, ivec2(0), mx), 0).rg;
    float w = (o.x == 1 ? t.x : 1.0 - t.x) * (o.y == 1 ? t.y : 1.0 - t.y);
    w *= 1.0 / (abs(s.y - z) / z * 30.0 + 0.03);
    acc += s.x * w; tot += w;
  }
  return tot > 0.0 ? acc / tot : 1.0;
}
void main() {
  float d = texture(tDepth, vUv).r;
  vec3 ro = cameraPosition;
  vec3 col;
  if (isSky(d)) {
    vec3 rd = viewRay(vUv);
    col = skyRadiance(rd);
    float mu = dot(rd, uSunDir);
    // 太陽の円盤（ぼやけて大きく光る）
    col += uSunCol * 40.0 * smoothstep(0.999955, 0.99999, mu);
    col += uSunCol * 1.2 * pow(max(mu, 0.0), 3000.0) + uSunCol * 0.25 * pow(max(mu, 0.0), 300.0);
    if (uClouds > 0.5) {
      // 半分の解像度の雲を、少しぼかしながら広げる
      vec2 px = 1.0 / vec2(textureSize(tClouds, 0));
      vec4 cl = texture(tClouds, vUv) * 0.4 + (texture(tClouds, vUv + px * vec2(0.7, 0.4)) + texture(tClouds, vUv + px * vec2(-0.4, 0.7)) + texture(tClouds, vUv + px * vec2(-0.7, -0.4)) + texture(tClouds, vUv + px * vec2(0.4, -0.7))) * 0.15;
      col = col * cl.a + cl.rgb;
    }
    // 地平線より下（遠景の外）は霞の色
    col = mix(col, fogColor(rd), smoothstep(0.02, -0.06, rd.y));
  } else {
    vec3 wp = worldFromDepth(vUv, d);
    col = texture(tColor, vUv).rgb;
    if (uAO > 0.0) {
      float ao = aoUp(vUv, linearDepth(d));
      // 暗い所ほど遮蔽が効く（日なたは影が薄い）：明るさで少しだけ弱める
      col *= mix(1.0, ao, uAO * (1.0 - 0.35 * smoothstep(0.6, 3.0, luma(col))));
    }
    col = applyFog(col, ro, wp);
  }
  gl_FragColor = vec4(col, 1.0);
}
`;

// 色調：AgX の近似＋春の柔らかい調子（黒を少し持ち上げ、ハイライトは暖かく）
const FINAL_FS = /* glsl */ `
${ALL}
${SKY_GLSL}
${DEPTH_GLSL}
${FILM_GLSL_POST}
uniform sampler2D tColor;
uniform float uFilm;
uniform float uFlash;
uniform float uPop;
uniform vec2 uPopPt;
uniform float uAge;
uniform sampler2D tBloom;
uniform float uBloom;
uniform float uExposure;
uniform vec4 uGrade;     // x=中間の締まり y=彩度 z=影の青み w=黒の持ち上げ
uniform vec2 uAgxEv;     // 写す明るさの幅（中間の灰色から下・上のEV）
uniform float uGrain;    // フィルムの粒子の強さ（書き出しでは0）
uniform vec2 uRes;
uniform float uFade;
uniform vec3 uFadeCol;
varying vec2 vUv;
// 自分の泡の膜：目は泡の中心より少し後ろ。前方の膜を内側から見る（目の前すぎてピントは合わない）
// 膜の反射率は物理どおり（控えめに強調）。映るのは背中側の景色（泡の環境図）なので、明るい空が映るところだけ色づく
uniform sampler2D tEnvB;
uniform highp sampler3D tFilm3;
vec3 povEnv(vec3 d, float lod) {
  vec2 uv = vec2(atan(d.x, d.z + 1e-7) * 0.15915494 + 0.5, clamp(d.y * 0.5 + 0.5, 0.002, 0.998));
  return textureLod(tEnvB, uv, lod).rgb;
}
// 膜の厚さ：ピントが合わないので大きな流れだけ（継ぎ目のない3D雑音。上が薄く下が厚い）
float povThick(vec3 n, float age) {
  float t = uTime;
  float ang = t * (0.05 + 0.06 * sin(n.y * 2.5));
  float cs = cos(ang), sn = sin(ang);
  vec3 p = vec3(cs * n.x - sn * n.z, n.y, sn * n.x + cs * n.z);
  vec3 w = texture(tFilm3, p * 0.2 + vec3(0.13, t * 0.005, 0.71)).xyz - 0.5;
  vec3 q = p + w * 1.2;
  float f = texture(tFilm3, vec3(q.x * 0.15, q.y * 0.28 - t * 0.005, q.z * 0.15) + 0.4).w - 0.5;
  float down = 0.5 - 0.5 * n.y;
  float prof = mix(mix(0.75, 0.35, age), 1.55, down * down * (3.0 - 2.0 * down));
  return 330.0 * prof * (1.0 + 0.8 * f);
}
vec3 povBoost(vec3 R, float k) { return min(R * k / (1.0 + (k - 1.0) * R), vec3(0.97)); }
vec3 povFilm(vec3 col, vec2 uv) {
  vec3 col0 = col;
  vec3 rd = viewRay(uv);
  vec3 fwd = normalize((uViewInv * vec4(0.0, 0.0, -1.0, 0.0)).xyz);
  vec3 c = fwd * 0.42;
  float b = dot(rd, c), cc = dot(c, c) - 1.0;
  float t = b + sqrt(max(b * b - cc, 0.0));
  vec3 n = normalize(rd * t - c);
  float cosI = clamp(abs(dot(n, rd)), 0.05, 1.0);
  vec3 Rf = povBoost(filmReflectance(cosI, povThick(n, uAge)), 2.3);
  vec3 L = povEnv(reflect(rd, -n), 2.5);
  // 画面の縁ほど膜が見える（中心はほぼ透明）
  vec2 q = uv - 0.5;
  float edge = smoothstep(0.25, 1.0, length(q * vec2(uRes.x / uRes.y, 1.0)));
  float vis = uFilm * (0.1 + 0.55 * edge * edge);
  if (uPop >= 0.0) {
    // 割れる：穴が広がって膜が消える。縮んでいく液の縁はピントの合わない柔らかな帯で、背景を少し屈折させる
    vec2 a = vec2(uRes.x / uRes.y, 1.0);
    vec2 dv = (uv - uPopPt) * a;
    float d = length(dv);
    float rad = pow(uPop, 0.85) * 1.9;
    // 割れる間は膜を少しはっきり見せて、穴が景色を開いていくのが分かるように
    vis = max(vis, 0.35) * (1.0 - uPop * uPop) * smoothstep(rad - 0.05, rad + 0.04, d);
    float fade = 1.0 - uPop;
    float x = (d - rad) / 0.085;
    float band = exp(-x * x) * fade;
    vec2 dir = d > 1e-4 ? dv / d / a : vec2(0.0);
    col = mix(col, texture(tColor, uv + dir * 0.06 * x * band).rgb, min(band * 1.5, 1.0));
    // 縁は厚い液の輪（干渉色は出ない）：円柱のレンズのように景色をゆがめ、細い照り返しがきらめく
    float hx = (d - rad) / 0.014;
    float an = atan(dv.y, dv.x + 1e-6);
    float spark = 0.55 + 0.45 * sin(an * 23.0 + uPopPt.y * 40.0) * sin(an * 9.0 - 1.3);
    col += (0.1 * band + 0.55 * exp(-hx * hx) * fade * spark) * L;
    // 穴の縁のすぐ外に淡い干渉色のふち（最初の0.2秒ほど。幅は画面の高さの数%）
    float fx = (d - rad - 0.016) / 0.011;
    float fr = exp(-fx * fx) * (1.0 - smoothstep(0.25, 0.5, uPop));
    vec3 Rr = povBoost(filmReflectance(0.9, 180.0 + 260.0 * clamp(0.5 + 0.5 * sin(an * 3.0 + uPop * 4.0), 0.0, 1.0)), 2.3);
    float lr = max(dot(Rr, vec3(0.2126, 0.7152, 0.0722)), 1e-4);
    col *= mix(vec3(1.0), clamp(mix(vec3(1.0), Rr / lr, 0.6), 0.5, 1.8), 0.3 * fr);
    col += Rr * L * 0.12 * fr;
    // しずく：外へ飛ぶ小さな粒。手前でボケた丸で、中は背景が小さく反転して見え、縁がかすかに明るい
    for (int i = 0; i < 12; i++) {
      float fi = float(i);
      float an = fi * 2.39996 + uPopPt.x * 9.0;
      float sp = 0.35 + fract(fi * 0.618 + 0.3) * 0.8;
      vec2 pp = uPopPt * a + vec2(cos(an), sin(an)) * sp * pow(uPop, 0.7) * 1.2;
      pp.y -= uPop * uPop * 0.25;
      float sz = 0.016 + 0.024 * fract(fi * 0.37);
      vec2 dd = uv * a - pp;
      float r = length(dd) / sz;
      if (r < 1.1) {
        float disc = smoothstep(1.0, 0.86, r) * pow(fade, 0.7);
        vec3 bg = texture(tColor, clamp(uv - dd / a * 1.6, 0.0, 1.0)).rgb;
        col = mix(col, bg * 1.05, disc * 0.7);
        col += L * 0.1 * smoothstep(0.6, 1.0, r) * disc;
      }
    }
  }
  // 透過は反射した分だけ弱まり（補色にかすかに色づく）、背中側の景色が薄く映る
  // 足す光は景色の明るさで頭打ち（暗い幹や日陰を藍色に染めない）。膜の色は明るさをそろえた色合いとして掛ける
  const vec3 LW = vec3(0.2126, 0.7152, 0.0722);
  float lc = dot(col, LW);
  vec3 add = Rf * L * vis;
  add *= min(1.0, (lc * 0.25 + 0.003) / max(dot(add, LW), 1e-4));
  add = mix(add, vec3(dot(add, LW)), 0.3);
  // 色ごとにも頭打ち（紫の光は明るさが小さくても赤・青が大きい。暗い物を染めない）
  add = min(add, col * 0.12 + 0.001);
  vec3 hue = clamp(mix(vec3(1.0), Rf / max(dot(Rf, LW), 1e-4), 0.5), 0.6, 1.6);
  col = col * (1.0 - 0.6 * dot(Rf, LW) * vis) * mix(vec3(1.0), hue, min(vis * 0.5, 0.3) * mix(0.25, 1.0, smoothstep(0.03, 0.25, lc))) + add;
  if (uFlash > 0.001) {
    // 膜がレンズを横切る瞬間：画面全体に一様な色かぶりと、背中側の光のかすかな照り返し（模様は出ない）
    vec3 Rv = povBoost(filmReflectance(0.98, povThick(normalize(-fwd + vec3(0.0, 0.35, 0.0)), uAge)), 3.0);
    vec3 Lb = mix(povEnv(-fwd, 4.0), povEnv(vec3(0.0, 1.0, 0.0), 4.0), 0.5);
    float k = uFlash * (0.85 + 0.15 * (uv.y - 0.5));
    col = col * (1.0 - Rv * k) + Rv * Lb * k + Lb * 0.02 * k;
  }
  return any(isnan(col)) ? col0 : max(col, 0.0);
}
vec3 agxContrast(vec3 x) {
  vec3 x2 = x * x, x4 = x2 * x2;
  return 15.5 * x4 * x2 - 40.14 * x4 * x + 31.96 * x4 - 6.868 * x2 * x + 0.4298 * x2 + 0.1191 * x - 0.00232;
}
vec3 agx(vec3 c) {
  const mat3 inM = mat3(0.842479062253094, 0.0423282422610123, 0.0423756549057051, 0.0784335999999992, 0.878468636469772, 0.0784336, 0.0792237451477643, 0.0791661274605434, 0.879142973793104);
  const mat3 outM = mat3(1.19687900512017, -0.0528968517574562, -0.0529716355144438, -0.0980208811401368, 1.15190312990417, -0.0980434501171241, -0.0990297440797205, -0.0989611768448433, 1.15107367264116);
  float minEv = uAgxEv.x, maxEv = uAgxEv.y;
  c = inM * c;
  c = clamp(log2(max(c, 1e-10)), minEv, maxEv);
  c = (c - minEv) / (maxEv - minEv);
  c = agxContrast(c);
  // 見た目の調整：中間の締まりと彩度（柔らかさは残す）
  c = pow(max(c, 0.0), vec3(uGrade.x));
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  // 彩度：暗部では上げない（日かげが青黒く転ばないように）
  c = l + (c - l) * mix(0.92, uGrade.y, smoothstep(0.06, 0.3, l));
  c = outM * c;
  c = pow(max(c, 0.0), vec3(2.2));
  return c;
}
vec3 toSRGB(vec3 c) { return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
void main() {
  // レンズの倍率色収差：周辺ほど赤は外へ、青は内へ少しずれる（中心はずれない）
  vec2 cq = vUv - 0.5;
  float ca = dot(cq, cq) * 0.0045;
  vec3 c = vec3(texture(tColor, vUv + cq * ca).r, texture(tColor, vUv).g, texture(tColor, vUv - cq * ca).b);
  if (uFilm > 0.001 || uPop >= 0.0 || uFlash > 0.001) c = povFilm(c, vUv);
  if (uBloom > 0.0) {
    vec3 b = texture(tBloom, vUv).rgb / 6.0;
    // 柔らかいにじみ：明るいところほど広く滲み、全体にも薄くかかる
    c = mix(c, b, uBloom) + b * uBloom * 0.25;
  }
  c *= uExposure;
  vec3 m = agx(c);
  // 黒の持ち上げ・影の色（z>0 で青く、z<0 で中立へ戻す）、光を少し暖かく
  float l = dot(m, vec3(0.2126, 0.7152, 0.0722));
  m = mix(m, m * vec3(0.96, 0.99, 1.06), (1.0 - smoothstep(0.0, 0.35, l)) * uGrade.z);
  m = mix(m, m * vec3(1.04, 1.0, 0.95), smoothstep(0.45, 1.0, l) * 0.5);
  m = m * (1.0 - 0.03 * uGrade.w) + vec3(0.015, 0.016, 0.016) * uGrade.w;
  // 明るい所だけ肩で持ち上げる（日の当たる雲・白い壁が白まで届く。中間と日かげはそのまま）
  float lh = dot(m, vec3(0.2126, 0.7152, 0.0722));
  m *= 1.0 + 0.3 * smoothstep(0.32, 0.78, lh);
  m = mix(m, 0.86 + 0.14 * (1.0 - exp(-(m - 0.86) / 0.14)), step(0.86, m));
  // 周辺減光
  vec2 q = vUv - 0.5;
  m *= 1.0 - dot(q, q) * 0.36;
  m = mix(m, uFadeCol, uFade);
  vec3 s = toSRGB(clamp(m, 0.0, 1.0));
  // 粒子：中間の明るさで一番見え、暗部・明部では控えめ（フィルムの粒状感）＋量子化のにじみ止め
  float gl = dot(s, vec3(0.2126, 0.7152, 0.0722));
  float gn = hash12(vUv * uRes + fract(uTime * 7.31) * 173.0) + hash12(vUv * uRes * 1.37 + fract(uTime * 3.17) * 91.0) - 1.0;
  s += gn * (0.011 * gl * (1.0 - gl) * 4.0 * 0.6 * uGrain);
  s += (hash12(vUv * uRes + fract(uTime) * 100.0) - 0.5) / 255.0 * 1.6;
  gl_FragColor = vec4(s, 1.0);
}
`;

// ---- 被写界深度（半分の解像度で金角らせんの集め方） ----
const COC_FS = /* glsl */ `
${DEPTH_GLSL}
uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform vec2 uTexel;     // 全解像度の1画素
uniform vec3 uFocus;     // x=焦点距離 y=絞り（px・m） z=最大ボケ(px)
varying vec2 vUv;
float coc(vec2 uv) {
  float d = texture(tDepth, uv).r;
  float z = isSky(d) ? 1e5 : linearDepth(d);
  float c = uFocus.y * (1.0 / uFocus.x - 1.0 / z);
  return clamp(c, -uFocus.z, uFocus.z);
}
void main() {
  // 2×2を1画素へ：色は平均、ボケは手前を優先
  vec2 o = uTexel * 0.5;
  vec3 c0 = texture(tColor, vUv + vec2(-o.x, -o.y)).rgb, c1 = texture(tColor, vUv + vec2(o.x, -o.y)).rgb;
  vec3 c2 = texture(tColor, vUv + vec2(-o.x, o.y)).rgb, c3 = texture(tColor, vUv + vec2(o.x, o.y)).rgb;
  float k0 = coc(vUv + vec2(-o.x, -o.y)), k1 = coc(vUv + vec2(o.x, -o.y)), k2 = coc(vUv + vec2(-o.x, o.y)), k3 = coc(vUv + vec2(o.x, o.y));
  float kn = min(min(k0, k1), min(k2, k3));
  float kf = (k0 + k1 + k2 + k3) * 0.25;
  float k = kn < -0.5 ? kn : kf;
  // 明るい点を少し強めて、玉ボケを立たせる
  vec3 c = (c0 + c1 + c2 + c3) * 0.25;
  gl_FragColor = vec4(c, k);
}
`;
const BLUR_FS = /* glsl */ `
uniform sampler2D tSrc;   // rgb=色 a=ボケの大きさ（全解像度px、手前は負）
uniform vec2 uTexel;      // 半分の解像度の1画素
uniform float uMaxR;      // 半解像度px
varying vec2 vUv;
const float GA = 2.39996323;
void main() {
  vec4 center = texture(tSrc, vUv);
  float cs = abs(center.a) * 0.5;
  vec3 acc = center.rgb;
  float tot = 1.0;
  float radius = 0.7;
  for (int i = 0; i < 96; i++) {
    if (radius > uMaxR) break;
    float ang = float(i) * GA;
    vec2 tc = vUv + vec2(cos(ang), sin(ang)) * uTexel * radius;
    vec4 s = texture(tSrc, tc);
    float ss = abs(s.a) * 0.5;
    // 奥の物は手前のボケの中へにじまない
    if (s.a > center.a + 0.5) ss = clamp(ss, 0.0, cs * 2.0);
    float m = smoothstep(radius - 0.6, radius + 0.6, ss);
    float br = 1.0 + max(dot(s.rgb, vec3(0.3, 0.5, 0.2)) - 2.0, 0.0) * 0.35;
    acc += mix(acc / tot, s.rgb * br, m);
    tot += 1.0;
    radius += 1.55 / radius;
  }
  gl_FragColor = vec4(acc / tot, center.a);
}
`;
const DOFMIX_FS = /* glsl */ `
${DEPTH_GLSL}
uniform sampler2D tColor;
uniform sampler2D tBlur;
uniform sampler2D tDepth;
uniform vec3 uFocus;
varying vec2 vUv;
void main() {
  vec3 sharp = texture(tColor, vUv).rgb;
  vec4 b = texture(tBlur, vUv);
  float d = texture(tDepth, vUv).r;
  float z = isSky(d) ? 1e5 : linearDepth(d);
  float c = abs(clamp(uFocus.y * (1.0 / uFocus.x - 1.0 / z), -uFocus.z, uFocus.z));
  float cb = abs(b.a);
  float k = smoothstep(0.6, 2.2, max(c, b.a < -0.5 ? cb : 0.0));
  gl_FragColor = vec4(mix(sharp, b.rgb, k), 1.0);
}
`;
// ---- 画面空間の遮蔽（半分の解像度・深度から法線を起こす・深度を見ながらぼかす） ----
// 草の根元・木の幹の足元・軒下・家と地面の境・森の奥の暗がり。遠くほど半径を広げて樹冠の塊にも効かせる
const AO_FS = /* glsl */ `
${DEPTH_GLSL}
uniform sampler2D tDepth;
uniform vec2 uHalf;       // 半分の解像度の寸法
uniform float uProjY;     // 投影行列の[1][1]（1/tan(fov/2)）
varying vec2 vUv;
float ignAO(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
vec3 vpos(vec2 uv) {
  float d = texture(tDepth, uv).r;
  if (isSky(d)) return vec3(0.0, 0.0, -1e6);
  vec4 p = uProjInv * vec4(uv * 2.0 - 1.0, uCam.z > 0.5 ? d : d * 2.0 - 1.0, 1.0);
  return p.xyz / p.w;
}
void main() {
  vec3 P = vpos(vUv);
  float z = -P.z;
  if (z > 9e5) { gl_FragColor = vec4(1.0, 6e4, 0.0, 1.0); return; }
  // 法線：左右・上下のうち差の小さい側（縁で法線が崩れない）
  vec2 px = 1.0 / uHalf;
  vec3 pl = vpos(vUv - vec2(px.x, 0.0)), pr = vpos(vUv + vec2(px.x, 0.0));
  vec3 pd = vpos(vUv - vec2(0.0, px.y)), pu = vpos(vUv + vec2(0.0, px.y));
  vec3 dx = abs(pr.z - P.z) < abs(P.z - pl.z) ? pr - P : P - pl;
  vec3 dy = abs(pu.z - P.z) < abs(P.z - pd.z) ? pu - P : P - pd;
  vec3 N = cross(dx, dy);
  float nl = length(N);
  N = nl > 1e-12 ? N / nl : vec3(0.0, 0.0, 1.0);
  if (dot(N, P) > 0.0) N = -N;
  // 半径（m）：近くは0.9m、遠くは距離に比例（最大9m）
  float R = clamp(z * 0.028, 0.9, 9.0);
  float rpx = R * uProjY * 0.5 * uHalf.y / z;
  rpx = clamp(rpx, 1.5, 44.0);
  R = rpx * z / (uProjY * 0.5 * uHalf.y);
  float R2 = R * R;
  float n0 = ignAO(gl_FragCoord.xy);
  float n1 = ignAO(gl_FragCoord.yx + 17.0);
  float acc = 0.0;
  const int NS = 12;
  for (int i = 0; i < NS; i++) {
    float fi = float(i);
    float a = (fi + n0) * 2.39996323 + n1 * 6.2831853;
    float r = (fi + 0.5 + n1 * 0.5) / float(NS);
    r = r * r * rpx + 0.75;
    vec2 uv = vUv + vec2(cos(a), sin(a)) * r * px;
    vec3 Q = vpos(uv);
    vec3 v = Q - P;
    float vv = dot(v, v);
    float vn = dot(v, N);
    float f = max(1.0 - vv / R2, 0.0);
    acc += f * max(vn * inversesqrt(vv + 1e-6) - 0.08, 0.0);
  }
  float ao = 1.0 - acc / float(NS) * 3.2;
  // 接地の段（半径0.35m・4点）：鳥居の足・灯籠の台・家の土台と地面の境・幹の根元を締める。遠くでは画素が粗いので消す
  float cf = 1.0 - smoothstep(35.0, 70.0, z);
  if (cf > 0.0) {
    float rpc = clamp(0.35 * uProjY * 0.5 * uHalf.y / z, 1.0, 14.0);
    float Rc = rpc * z / (uProjY * 0.5 * uHalf.y);
    float ac = 0.0;
    for (int i = 0; i < 4; i++) {
      float fi = float(i);
      float a = (fi + n1) * 1.5707963 + n0 * 3.14159;
      vec2 uv = vUv + vec2(cos(a), sin(a)) * (0.6 + 0.4 * fract(n0 + fi * 0.37)) * rpc * px;
      vec3 v = vpos(uv) - P;
      float vv = dot(v, v);
      ac += max(1.0 - vv / (Rc * Rc), 0.0) * max(dot(v, N) * inversesqrt(vv + 1e-6) - 0.1, 0.0);
    }
    ao *= 1.0 - cf * min(ac * 0.9, 0.6);
  }
  gl_FragColor = vec4(clamp(ao, 0.0, 1.0), z, 0.0, 1.0);
}
`;
const AOBLUR_FS = /* glsl */ `
uniform sampler2D tSrc;   // r=遮蔽 g=距離
uniform vec2 uDir;        // 半分の解像度の1画素×方向
varying vec2 vUv;
void main() {
  vec4 c = texture(tSrc, vUv);
  float z = c.g;
  float acc = c.r, tot = 1.0;
  for (int i = -4; i <= 4; i++) {
    if (i == 0) continue;
    vec4 s = texture(tSrc, vUv + uDir * float(i));
    float w = exp(-float(i * i) * 0.09) * clamp(1.0 - abs(s.g - z) / (z * 0.06 + 0.05), 0.0, 1.0);
    acc += s.r * w; tot += w;
  }
  gl_FragColor = vec4(acc / tot, z, 0.0, 1.0);
}
`;
// ---- 光のにじみ（縮小の鎖→拡大しながら足す） ----
const DOWN_FS = /* glsl */ `
uniform sampler2D tSrc;
uniform vec2 uTexel;
uniform float uFirst;
varying vec2 vUv;
vec3 s(vec2 o) { return texture(tSrc, vUv + o * uTexel).rgb; }
void main() {
  vec3 a = s(vec2(-2.0, -2.0)), b = s(vec2(0.0, -2.0)), c = s(vec2(2.0, -2.0));
  vec3 d = s(vec2(-1.0, -1.0)), e = s(vec2(1.0, -1.0));
  vec3 f = s(vec2(-2.0, 0.0)), g = s(vec2(0.0, 0.0)), h = s(vec2(2.0, 0.0));
  vec3 i = s(vec2(-1.0, 1.0)), j = s(vec2(1.0, 1.0));
  vec3 k = s(vec2(-2.0, 2.0)), l = s(vec2(0.0, 2.0)), m = s(vec2(2.0, 2.0));
  vec3 col = (d + e + i + j) * 0.125 + (a + c + k + m) * 0.03125 + (b + f + h + l) * 0.0625 + g * 0.125;
  if (uFirst > 0.5) col = min(col, vec3(40.0));
  gl_FragColor = vec4(col, 1.0);
}
`;
const UP_FS = /* glsl */ `
uniform sampler2D tSrc;
uniform sampler2D tPrev;
uniform vec2 uTexel;
uniform float uMix;
varying vec2 vUv;
void main() {
  vec3 c = vec3(0.0);
  c += texture(tSrc, vUv + vec2(-1.0, -1.0) * uTexel).rgb * 1.0;
  c += texture(tSrc, vUv + vec2(0.0, -1.0) * uTexel).rgb * 2.0;
  c += texture(tSrc, vUv + vec2(1.0, -1.0) * uTexel).rgb * 1.0;
  c += texture(tSrc, vUv + vec2(-1.0, 0.0) * uTexel).rgb * 2.0;
  c += texture(tSrc, vUv).rgb * 4.0;
  c += texture(tSrc, vUv + vec2(1.0, 0.0) * uTexel).rgb * 2.0;
  c += texture(tSrc, vUv + vec2(-1.0, 1.0) * uTexel).rgb * 1.0;
  c += texture(tSrc, vUv + vec2(0.0, 1.0) * uTexel).rgb * 2.0;
  c += texture(tSrc, vUv + vec2(1.0, 1.0) * uTexel).rgb * 1.0;
  c /= 16.0;
  gl_FragColor = vec4(texture(tPrev, vUv).rgb + c * uMix, 1.0);
}
`;

export class Post {
  constructor(renderer, shared) {
    this.renderer = renderer;
    this.shared = shared;
    this.quad = new THREE.Mesh(new THREE.BufferGeometry(), null);
    this.quad.geometry.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    this.quad.frustumCulled = false;
    this.scene = new THREE.Scene();
    this.scene.add(this.quad);
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.depthU = { uCam: { value: new THREE.Vector3(0.1, 20000, 1) }, uProjInv: { value: new THREE.Matrix4() }, uViewInv: { value: new THREE.Matrix4() } };
    this.composite = new THREE.ShaderMaterial({
      uniforms: { ...shared, ...this.depthU, tColor: { value: null }, tDepth: { value: null }, tClouds: { value: null }, uClouds: { value: 0 }, tAO: { value: null }, uAO: { value: 0 } },
      vertexShader: FS_VS, fragmentShader: COMPOSITE_FS, depthTest: false, depthWrite: false,
    });
    this.final = new THREE.ShaderMaterial({
      uniforms: {
        ...shared, ...this.depthU,
        tColor: { value: null }, tBloom: { value: null }, uBloom: { value: 0 }, uExposure: { value: 1.0 }, uGrade: { value: new THREE.Vector4(1.31, 1.17, -0.6, 0.5) }, uGrain: { value: 1 }, uAgxEv: { value: new THREE.Vector2(-12.47393, 4.026069) }, uRes: { value: new THREE.Vector2() },
        uFade: { value: 0 }, uFadeCol: { value: new THREE.Color(1, 1, 1) },
        uFilm: { value: 0 }, uFlash: { value: 0 }, uPop: { value: -1 }, uPopPt: { value: new THREE.Vector2(0.5, 0.5) }, uAge: { value: 0 },
      },
      vertexShader: FS_VS, fragmentShader: FINAL_FS, depthTest: false, depthWrite: false,
    });
  }
  initChain() {
    const mk = (fs, extra = {}) => new THREE.ShaderMaterial({ uniforms: { ...extra }, vertexShader: FS_VS, fragmentShader: fs, depthTest: false, depthWrite: false });
    this.cocMat = mk(COC_FS, { ...this.depthU, tColor: { value: null }, tDepth: { value: null }, uTexel: { value: new THREE.Vector2() }, uFocus: { value: new THREE.Vector3(60, 70, 36) } });
    this.blurMat = mk(BLUR_FS, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() }, uMaxR: { value: 16 } });
    this.dofMix = mk(DOFMIX_FS, { ...this.depthU, tColor: { value: null }, tBlur: { value: null }, tDepth: { value: null }, uFocus: this.cocMat.uniforms.uFocus });
    this.downMat = mk(DOWN_FS, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() }, uFirst: { value: 0 } });
    this.aoMat = mk(AO_FS, { ...this.depthU, tDepth: { value: null }, uHalf: { value: new THREE.Vector2() }, uProjY: { value: 1 } });
    this.aoBlur = mk(AOBLUR_FS, { tSrc: { value: null }, uDir: { value: new THREE.Vector2() } });
    this.upMat = mk(UP_FS, { tSrc: { value: null }, tPrev: { value: null }, uTexel: { value: new THREE.Vector2() }, uMix: { value: 1 } });
  }
  resizeChain(w, h) {
    const T = (ww, hh) => new THREE.WebGLRenderTarget(Math.max(1, ww), Math.max(1, hh), { type: THREE.HalfFloatType, depthBuffer: false, magFilter: THREE.LinearFilter, minFilter: THREE.LinearFilter });
    (this.rts || []).forEach((t) => t.dispose());
    this.rts = [];
    const hw = Math.ceil(w / 2), hh = Math.ceil(h / 2);
    this.cocRT = T(hw, hh); this.blurRT = T(hw, hh); this.dofRT = T(w, h);
    this.rts.push(this.cocRT, this.blurRT, this.dofRT);
    this.aoRT = [T(hw, hh), T(hw, hh)];
    this.rts.push(...this.aoRT);
    this.down = []; this.up = [];
    let ww = hw, hh2 = hh;
    for (let i = 0; i < 6; i++) { this.down.push(T(ww, hh2)); this.up.push(T(ww, hh2)); ww = Math.ceil(ww / 2); hh2 = Math.ceil(hh2 / 2); }
    this.rts.push(...this.down, ...this.up);
    this.w = w; this.h = h;
  }
  // 被写界深度：litRT（霞まで済んだ色）と深度 → dofRT
  dof(colorTex, depthTex) {
    this.cocMat.uniforms.tColor.value = colorTex;
    this.cocMat.uniforms.tDepth.value = depthTex;
    this.cocMat.uniforms.uTexel.value.set(1 / this.w, 1 / this.h);
    this.run(this.cocMat, this.cocRT);
    this.blurMat.uniforms.tSrc.value = this.cocRT.texture;
    this.blurMat.uniforms.uTexel.value.set(1 / this.cocRT.width, 1 / this.cocRT.height);
    this.blurMat.uniforms.uMaxR.value = Math.min(24, this.cocMat.uniforms.uFocus.value.z * 0.5);
    this.run(this.blurMat, this.blurRT);
    this.dofMix.uniforms.tColor.value = colorTex;
    this.dofMix.uniforms.tBlur.value = this.blurRT.texture;
    this.dofMix.uniforms.tDepth.value = depthTex;
    this.run(this.dofMix, this.dofRT);
  }
  // 画面空間の遮蔽：深度 → 半分の解像度の遮蔽（ぼかし済み）
  ao(depthTex, camera) {
    const [a, b] = this.aoRT;
    this.aoMat.uniforms.tDepth.value = depthTex;
    this.aoMat.uniforms.uHalf.value.set(a.width, a.height);
    this.aoMat.uniforms.uProjY.value = camera.projectionMatrix.elements[5];
    this.run(this.aoMat, a);
    this.aoBlur.uniforms.tSrc.value = a.texture;
    this.aoBlur.uniforms.uDir.value.set(1 / a.width, 0);
    this.run(this.aoBlur, b);
    this.aoBlur.uniforms.tSrc.value = b.texture;
    this.aoBlur.uniforms.uDir.value.set(0, 1 / a.height);
    this.run(this.aoBlur, a);
    return a.texture;
  }
  bloom(srcTex) {
    let src = srcTex;
    for (let i = 0; i < this.down.length; i++) {
      this.downMat.uniforms.tSrc.value = src;
      const sw = i === 0 ? this.w : this.down[i - 1].width, sh = i === 0 ? this.h : this.down[i - 1].height;
      this.downMat.uniforms.uTexel.value.set(1 / sw, 1 / sh);
      this.downMat.uniforms.uFirst.value = i === 0 ? 1 : 0;
      this.run(this.downMat, this.down[i]);
      src = this.down[i].texture;
    }
    let prev = this.down[this.down.length - 1].texture;
    for (let i = this.down.length - 2; i >= 0; i--) {
      this.upMat.uniforms.tSrc.value = prev;
      this.upMat.uniforms.tPrev.value = this.down[i].texture;
      this.upMat.uniforms.uTexel.value.set(1 / this.down[i + 1].width, 1 / this.down[i + 1].height);
      this.upMat.uniforms.uMix.value = 1.0;
      this.run(this.upMat, this.up[i]);
      prev = this.up[i].texture;
    }
    return prev;
  }
  setCamera(camera, reversed) {
    this.depthU.uCam.value.set(camera.near, camera.far, reversed ? 1 : 0);
    this.depthU.uProjInv.value.copy(camera.projectionMatrixInverse);
    this.depthU.uViewInv.value.copy(camera.matrixWorld);
  }
  run(material, target) {
    this.quad.material = material;
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.scene, this.cam);
  }
}
