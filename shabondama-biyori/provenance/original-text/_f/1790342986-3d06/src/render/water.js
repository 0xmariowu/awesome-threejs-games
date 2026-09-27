// 水面：田んぼ（区画ごとの水位）・川・ため池・渓流・滝つぼ
// 粗い代理の格子を描き、画素ごとに本当の水面（水平面）を求めて深度を書く。畦は距離場で鋭く切る
// 波は分散つきの4つの帯（起動時に焼く）、反射は画面空間＋地形トレース＋空、透過は深さで吸収・散乱、浅い澄んだ水は底に集光模様
import * as THREE from 'three';
import { ALL, SHADOW } from './glsl.js';
import { SKY_GLSL } from './sky.js';
import { DEPTH_GLSL } from './post.js';
import { patchGeometry, CHUNK } from './terrain.js';
import { streamHalfW } from '../world/gen.js';
import { GORGE, gorgeWorld, streamA } from '../world/layout.js';
import { mulberry32 } from '../util/noise.js';

export const CLOUD2D_GLSL = /* glsl */ `
// 映り込み用の平面の雲（空の立体の雲と同じ被覆の地図）
vec4 cloud2D(vec3 ro, vec3 rd) {
  if (rd.y < 0.015) return vec4(0.0, 0.0, 0.0, 1.0);
  float t = (uCloud.x - ro.y) / rd.y;
  vec2 p = ro.xz + rd.xz * t;
  vec2 cuv = (p + uCloudOff) / uCloud.w;
  float cov = texture(tCloudCov, cuv).r;
  float c = smoothstep(uCloud.z - 0.03, uCloud.z + 0.16, cov);
  float thick = smoothstep(uCloud.z, uCloud.z + 0.35, cov);
  float fade = smoothstep(0.015, 0.14, rd.y) * exp(-t * 0.000018);
  c *= fade;
  // 太陽側の縁が明るく、厚いところは下が灰色
  float lit = 0.62 + 0.38 * smoothstep(-0.2, 0.8, dot(normalize(vec3(rd.x, 0.0, rd.z) + vec3(1e-4, 0.0, 0.0)), normalize(vec3(uSunDir.x, 0.0, uSunDir.z))));
  vec3 base = mix(vec3(1.05, 1.07, 1.12), vec3(0.62, 0.66, 0.76), thick * 0.85) * lit;
  vec3 col = base * (uSunCol * 0.36 + shIrr(vec3(0.0, -1.0, 0.0)) * 0.9);
  return vec4(col * c, 1.0 - c * 0.92);
}
`;

const WATER_VS = /* glsl */ `
${ALL}
attribute vec2 aChunk;
uniform float uStep;
varying vec3 vProxy;
void main() {
  vec2 t = aChunk + position.xy;
  ivec2 ti = ivec2(clamp(t, vec2(0.0), vec2(uWorld.z - 1.0)));
  int s = int(max(1.0, uStep * 0.5));
  float wl = -1e4;
  for (int dj = -1; dj <= 1; dj++) for (int di = -1; di <= 1; di++) {
    ivec2 q = clamp(ti + ivec2(di, dj) * s, ivec2(0), ivec2(int(uWorld.z) - 1));
    wl = max(wl, texelFetch(tHW, q, 0).g);
  }
  float h = texelFetch(tHW, ti, 0).r;
  float y = wl > -1000.0 ? wl : h - 1.0;
  vec3 wp = vec3(uWorld.x + t.x * uWorld.y, y, uWorld.x + t.y * uWorld.y);
  vProxy = wp;
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
}
`;

// 渓流の水面：流れに沿った一枚の面（淵は平ら、落ち口は岩の段を越えて下へ曲がる）
const RIBBON_VS = /* glsl */ `
${ALL}
attribute vec3 aRib;    // x=横(-1..1) y=谷の道のり z=横(m)
attribute vec4 aFlow;   // 下流の向きxz・速さ(m/s)・白さ
varying vec3 vProxy;
varying vec3 vRN;
varying vec4 vFlow;
varying vec3 vRib;
void main() {
  vProxy = position;
  vRN = normal;
  vFlow = aFlow;
  vRib = aRib;
  gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0);
}
`;

const WATER_FS = /* glsl */ `
${ALL}
${SHADOW}
${SKY_GLSL}
${DEPTH_GLSL}
${CLOUD2D_GLSL}
uniform sampler2D tSdf, tType, tFlow;
uniform highp sampler2DArray tWaves;  // 0..7=波の帯（2層ずつ） 8=集光模様 9=泡の模様
uniform vec4 uCS[4];       // 帯ごと：内側の輪の cos(ωt), sin(ωt)、外側の輪の cos, sin
uniform vec4 uBand[4];     // x=1/繰り返しの長さ y=風に流される割合 z=細かさの限界(m)
uniform float uCaus;       // 集光模様の明るさの正規化
uniform sampler2D tColor, tDepth;
uniform vec2 uRes;
uniform mat4 uViewProj;
uniform float uPy;         // 投影の縦の倍率
uniform vec4 uRings[24];   // 水の輪：x,z,生まれた時刻,強さ（蛙・魚・鴨）
uniform vec3 uImpact;      // 滝の水が落ちるところ
uniform vec2 uOutlet;      // 滝つぼの出口
varying vec3 vProxy;
#ifdef RIBBON
varying vec3 vRN;
varying vec4 vFlow;
varying vec3 vRib;
#endif

// ---- 波 ----
vec2 subBand(vec2 uv, int l, vec2 cs) {
  vec4 t = (texture(tWaves, vec3(uv, float(l))) - 0.50196) * 7.969;
  return t.xy * cs.x + t.zw * cs.y;
}
// 帯 b の傾き（波長の違う2つの輪は違う速さで時間発展する＝同じ模様がくり返さない）
vec2 band(vec2 q, int b) {
  vec2 uv = q * uBand[b].x;
  return (subBand(uv, b * 2, uCS[b].xy) + subBand(uv + 0.31, b * 2 + 1, uCS[b].zw)) * 0.7071;
}
// 画素より細かくなりきった帯は読まない（遠くの水面を軽く）
bool alive(int b, float fw) { return fw < uBand[b].z * 3.0; }
// 風の波：細かい波ほど風下へ流される。w=帯ごとの傾きの強さ(RMS)
vec2 windWaves(vec2 p, vec4 w, float fw) {
  vec2 s = vec2(0.0);
  if (w.x > 0.0 && alive(0, fw)) s += band(p - uWindOff * uBand[0].y, 0) * w.x;
  if (w.y > 0.0 && alive(1, fw)) s += band(p - uWindOff * uBand[1].y, 1) * w.y;
  if (alive(2, fw)) s += band(p - uWindOff * uBand[2].y, 2) * w.z;
  if (alive(3, fw)) s += band(p - uWindOff * uBand[3].y, 3) * w.w;
  return s;
}
vec2 flowBands(vec2 q, vec3 w, float fw) {
  vec2 s = band(q, 1) * w.x;
  if (alive(2, fw)) s += band(q, 2) * w.y;
  if (w.z > 0.0 && alive(3, fw)) s += band(q, 3) * w.z;
  return s;
}
// 流れに乗る波（2つの位相を交互に混ぜて、引き伸ばされないように）
vec2 flowWaves(vec2 p, vec2 fd, float spd, float T, vec3 w, float fw) {
  float t0 = fract(uTime / T), t1 = fract(uTime / T + 0.5);
  float a = 1.0 - abs(2.0 * t0 - 1.0);
  vec2 q0 = p - fd * spd * t0 * T + vec2(0.37, 0.71), q1 = p - fd * spd * t1 * T;
  vec2 s0 = flowBands(q0, w, fw), s1 = flowBands(q1, w, fw);
  return (s0 * a + s1 * (1.0 - a)) * inversesqrt(a * a + (1.0 - a) * (1.0 - a));
}
// 画素より細かくて見えなくなった波の分の傾きの分散（→ ざらつき＝粗さへ）
float lostVar(float fw, vec4 w) {
  vec4 lim = vec4(uBand[0].z, uBand[1].z, uBand[2].z, uBand[3].z);
  vec4 lost = smoothstep(lim * 0.5, lim * 3.0, vec4(fw));
  return dot(w * w, lost);
}
// 水の輪：外へ広がる小さな波の列
vec2 ringSlope(vec2 p) {
  vec2 acc = vec2(0.0);
  for (int i = 0; i < 24; i++) {
    vec4 R = uRings[i];
    if (R.w <= 0.0) continue;
    float age = uTime - R.z;
    if (age < 0.0 || age > 5.0) continue;
    vec2 d = p - R.xy;
    float r = length(d);
    float front = 0.06 + age * 0.38;
    float x = r - front;
    if (x > 0.25 || x < -0.7) continue;
    float g = exp(-(x + 0.16) * (x + 0.16) * 18.0);
    float a = R.w * exp(-age * 0.8) / (1.0 + r * 3.0);
    acc += d / max(r, 1e-3) * a * cos(x * 30.0) * g * 2.2;
  }
  return acc;
}
// 水の反射率（屈折率1.333、偏光なし）
float fresnelW(float c) {
  c = clamp(c, 1e-3, 1.0);
  float g = sqrt(0.7769 + c * c);
  float A = (g - c) / (g + c);
  float B = (c * (g + c) - 1.0) / (c * (g - c) + 1.0);
  return 0.5 * A * A * (1.0 + B * B);
}

float waterLevelAt(vec2 p, out float sdf) {
  vec2 uv = worldUV(p);
  float s0 = texture(tSdf, uv).x;
  sdf = s0;
  vec2 q = p;
  if (s0 < 1.3) {
    float e = 0.5;
    vec2 g = vec2(texture(tSdf, worldUV(p + vec2(e, 0.0))).x - texture(tSdf, worldUV(p - vec2(e, 0.0))).x,
                  texture(tSdf, worldUV(p + vec2(0.0, e))).x - texture(tSdf, worldUV(p - vec2(0.0, e))).x);
    if (dot(g, g) > 1e-6) q = p + normalize(g) * (1.3 - s0);
  }
  return texelFetch(tHW, worldTexel(q), 0).g;
}
float depthFromView(float z) {
  float n = uCam.x, f = uCam.y;
  if (uCam.z > 0.5) return n * (f - z) / (z * (f - n));
  float zn = (f + n) / (f - n) - 2.0 * f * n / ((f - n) * z);
  return zn * 0.5 + 0.5;
}
vec2 toScreen(vec3 p, out float w) {
  vec4 c = uViewProj * vec4(p, 1.0);
  w = c.w;
  return c.xy / c.w * 0.5 + 0.5;
}
// 反射の1点：空の画素（まだ黒い）は空の色で埋める
vec3 reflTap(vec2 uv, vec3 skyC) {
  return isSky(texture(tDepth, uv).r) ? skyC : texture(tColor, uv).rgb;
}
// 画面空間の反射。spread=画素より細かい波による反射のにじみ（傾きの幅）→ 縦に伸びる
vec3 ssr(vec3 wp, vec3 R, float jit, float spread, vec3 skyC, out float hit, out vec3 hitPos) {
  hit = 0.0;
  hitPos = wp;
  float t = 0.08 + 0.1 * jit;
  float tPrev = 0.0;
  for (int i = 0; i < 40; i++) {
    vec3 p = wp + R * t;
    float w;
    vec2 uv = toScreen(p, w);
    if (w <= 0.0 || uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) break;
    float sd = linearDepth(texture(tDepth, uv).r);
    float stepLen = t - tPrev;
    if (w > sd + 0.015 && w - sd < max(0.3, stepLen * 2.5)) {
      float a = tPrev, b = t;
      for (int k = 0; k < 5; k++) {
        float m = 0.5 * (a + b);
        float wm;
        vec2 um = toScreen(wp + R * m, wm);
        float sm = linearDepth(texture(tDepth, um).r);
        if (wm > sm) { b = m; uv = um; } else a = m;
      }
      vec2 e = min(uv, 1.0 - uv);
      hit = sat(min(e.x, e.y) * 12.0) * (1.0 - smoothstep(0.75, 1.0, float(i) / 40.0));
      float dr = texture(tDepth, uv).r;
      hitPos = worldFromDepth(uv, dr);
      vec3 c = texture(tColor, uv).rgb;
      // 波で揺れる映り込みは縦に伸びる（水面から当たった所までの距離に比例）
      // 伸びは画面の高さの1%まで（映った花や桜の色と形が溶けないように、中心を重く）
      float du = min(spread * length(hitPos - wp) / max(linearDepth(dr), 0.5) * uPy, 0.009);
      if (du * uRes.y > 1.2) {
        c = c * 0.5 + (reflTap(uv + vec2(0.0, du * 0.5), skyC) + reflTap(uv - vec2(0.0, du * 0.5), skyC)) * 0.15
              + (reflTap(uv + vec2(0.0, du * 1.2), skyC) + reflTap(uv - vec2(0.0, du * 1.2), skyC)) * 0.1;
      }
      return c;
    }
    tPrev = t;
    t = t * 1.2 + 0.12;
  }
  return vec3(0.0);
}
// 水底の集光模様（平均1）：2枚をずらして重ね、小さい方を取る。blur=深いほどぼける（mipの偏り）
float caustic(vec2 p, float blur) {
  float c1 = texture(tWaves, vec3(p * 1.25 + vec2(uTime * 0.043, uTime * 0.029), 8.0), blur).r;
  float c2 = texture(tWaves, vec3(vec2(p.y, -p.x) * 1.05 + vec2(-uTime * 0.031, uTime * 0.047) + 0.5, 8.0), blur).r;
  return min(c1, c2) * uCaus;
}
// 渓流の白い泡の模様（fq は流れに沿って流した座標）：x=覆う割合 y=明るさ
vec2 foamPattern(vec2 fq, float amt) {
  float clump = texture(tNoise, fq * vec2(0.19, 0.47)).r * 0.6 + texture(tNoise, fq * vec2(0.6, 1.2) + 3.1).r * 0.4;
  // 泡の網は大小2つの大きさ
  vec3 fm = texture(tWaves, vec3(fq * vec2(0.3, 0.42), 9.0)).rgb;
  vec3 fm2 = texture(tWaves, vec3(fq * vec2(0.62, 0.85) + 0.37, 9.0)).rgb;
  // 流れの向きに伸びた筋：白い水の中にも暗い筋と明るい筋
  float streak = texture(tNoise, vec2(fq.x * 0.25, fq.y * 2.2)).r * 0.6 + texture(tNoise, vec2(fq.x * 0.7, fq.y * 5.0) + 1.3).r * 0.4;
  float base = amt * 1.1 + (clump - 0.5) * 0.9 + (streak - 0.5) * 0.5;
  float dense = smoothstep(0.55, 0.95, base) * (0.8 + 0.2 * fm2.b);
  float lace = max(fm.r, fm2.r * 0.7) * smoothstep(0.15, 0.55, base) * (0.55 + 0.45 * fm.g);
  return vec2(max(dense, lace * 0.85) * min(1.0, amt * 1.7), 0.72 + 0.28 * smoothstep(0.3, 0.7, streak) + 0.1 * fm2.b);
}
// 桜の花びらの密度（桜の木のまわり、地図の値をなめらかに）
float petalDensity(vec2 p) {
  // 桜から遠い水面（ほとんど）は1回読むだけ
  if (texelFetch(tType, worldTexel(p), 0).a < 0.003) return 0.0;
  vec2 f = (p - uWorld.x) / uWorld.y;
  vec2 i = floor(f), u = f - i;
  ivec2 t = ivec2(clamp(i, vec2(0.0), vec2(uWorld.z - 2.0)));
  float a = texelFetch(tType, t, 0).a, b = texelFetch(tType, t + ivec2(1, 0), 0).a;
  float c = texelFetch(tType, t + ivec2(0, 1), 0).a, d = texelFetch(tType, t + ivec2(1, 1), 0).a;
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
// 水に浮かぶ花びら1層：9cmの格子に0か1枚。px=1画素あたりの格子の幅。x=覆う割合 y=個体差
vec2 petalLayer(vec2 p, float dens, float px) {
  vec2 g = p * 11.0;
  vec2 ci = floor(g);
  uint h = hashU2(ivec2(ci) + ivec2(7919, 104729));
  float r0 = float(h & 255u) / 255.0;
  float r1 = float((h >> 8) & 255u) / 255.0, r2 = float((h >> 16) & 255u) / 255.0, r3 = float(h >> 24) / 255.0;
  vec2 c = ci + 0.3 + 0.4 * vec2(r1, r2);
  float an = r3 * 6.2831;
  vec2 d = g - c;
  d = mat2(cos(an), sin(an), -sin(an), cos(an)) * d;
  float sz = 0.8 + 0.4 * r2;
  float e = length(d / (vec2(0.2, 0.14) * sz));
  // 先の小さな切れ込み
  float notch = (1.0 - smoothstep(0.0, 0.035, abs(d.y))) * step(0.1 * sz, d.x);
  float aa = px / (0.14 * sz) + 0.05;
  float cov = (1.0 - smoothstep(1.0 - aa, 1.0 + aa, e + notch * 0.7)) * step(r0, dens);
  return vec2(cov, r1);
}

void main() {
  vec3 ro = cameraPosition;
#ifdef RIBBON
  vec3 wp = vProxy;
  vec3 rd = normalize(wp - ro);
  int tc = 22;
  bool paddy = false;
  float pr = 0.5;
  // 横の縁は岸の土の下へ消える（見えてしまうところは薄く）
  float edge = 1.0 - smoothstep(0.8, 1.0, abs(vRib.x));
  vec2 suv = gl_FragCoord.xy / uRes;
  float od = linearDepth(texture(tDepth, suv).r);
  vec3 fwd = normalize((uViewInv * vec4(0.0, 0.0, -1.0, 0.0)).xyz);
  float wd = dot(wp - ro, fwd);
  if (od < wd - 0.01) discard;
#else
  vec3 rd = normalize(vProxy - ro);
  float sdf;
  float L = waterLevelAt(vProxy.xz, sdf);
  if (L < -1000.0 || rd.y > -1e-3) discard;
  float t = (L - ro.y) / rd.y;
  if (t <= 0.0) discard;
  vec3 wp = ro + rd * t;
  float L2 = waterLevelAt(wp.xz, sdf);
  if (L2 < -1000.0) discard;
  if (abs(L2 - L) > 0.02) { L = L2; t = (L - ro.y) / rd.y; wp = ro + rd * t; if (abs(waterLevelAt(wp.xz, sdf) - L) > 0.5) discard; }
  ivec2 tt = worldTexel(wp.xz);
  vec2 ty0 = texelFetch(tType, tt, 0).xy;
  int tc = int(ty0.x * 255.0 + 0.5);
  bool paddy = tc >= 1 && tc <= 6;
  float pr = ty0.y;          // 区画ごとの乱数（田の水の濁り・風の当たり方の個体差）
  float edge = paddy ? smoothstep(0.26, 0.4, sdf) : 1.0;
  if (edge <= 0.01) discard;

  vec2 suv = gl_FragCoord.xy / uRes;
  float od = linearDepth(texture(tDepth, suv).r);
  vec3 fwd = normalize((uViewInv * vec4(0.0, 0.0, -1.0, 0.0)).xyz);
  float wd = dot(wp - ro, fwd);
  if (od < wd - 0.01) discard;
  // 渓流は別の面（RIBBON）で描く
  if (tc == 22) discard;
  gl_FragDepth = depthFromView(wd);
#endif
  // 1画素に入る水面の幅（m）：細かい波がつぶれた分を粗さへ回す
  // 奥行き方向には引き伸ばされるが、異方性フィルタ（4倍）の分は細かさが残る
  float fw0 = max(wd, 0.1) * 2.0 / (uPy * uRes.y);
  float fw = max(fw0, fw0 / max(abs(rd.y), 0.02) * 0.25);

  // ---- 波 ----
  vec2 wv = windAt(wp.xz);
  float g = gustField(wp.xz);
  // 突風の当たるところだけ細かい波が立つ（黒っぽいさざ波の帯）
  float amp = 0.08 + 0.92 * smoothstep(0.2, 0.85, g);
  bool clearW = tc == 22 || tc == 23;   // 渓流と滝つぼ：澄んだ山の水
  vec4 fl = texture(tFlow, worldUV(wp.xz));
  vec2 fd = fl.xy * 2.0 - 1.0;
  float foamAmt = clearW ? fl.w : 0.0;
  float spd = tc == 23 ? 0.6 : 1.7 + 1.0 * fl.z;
#ifdef RIBBON
  fd = vFlow.xy;
  foamAmt = vFlow.w;
  spd = vFlow.z;
#endif
  vec2 fdn = dot(fd, fd) > 1e-6 ? normalize(fd) : vec2(1.0, 0.0);
  vec2 slope;
  vec4 wW;     // 風の波の帯ごとの強さ（粗さの見積もりにも使う）
  float rr = 1e3;
  if (tc == 11) {
    // 川：流れに乗るうねりと、風のさざ波
    vec3 fW = vec3(0.02, 0.021, 0.0);
    // 流れのゆるい瀬の間の「とろ」：さざ波が消えて岸の菜の花や桜をくっきり映す（下流へ伸びてゆっくり流れる）
    float calm = smoothstep(0.46, 0.6, texture(tNoise, vec2((wp.x - uTime * 0.6) * 0.006, wp.z * 0.045) + 0.21).r * 0.75
                                   + texture(tNoise, vec2(wp.x * 0.02, wp.z * 0.11) + 0.63).r * 0.25);
    wW = vec4(0.0, 0.0, 0.007, 0.012) * (0.4 + 0.6 * amp) * (1.0 - 0.8 * calm);
    fW *= 1.0 - 0.55 * calm;
    slope = flowWaves(wp.xz, fdn, 0.8, 2.4, fW, fw);
    slope += windWaves(wp.xz, wW, fw);
    wW += vec4(0.0, fW);
  } else if (clearW) {
    // 渓流：速い流れ。落ち口の下と滝つぼは波立つ
    float k = 0.7 + 1.6 * foamAmt;
    if (tc == 23) {
      // 滝つぼ：落ち口のまわりだけ強く波立ち、淵の外側は落ち着いて崖と滝を映す
      rr = length(wp.xz - uImpact.xz);
      k = 0.45 + 0.6 * foamAmt * exp(-rr * 0.15) + 2.8 * exp(-rr * 0.35);
    }
    vec3 fW = vec3(0.05, 0.06, 0.05) * k;
    slope = flowWaves(wp.xz, fdn, spd, 1.2, fW, fw);
    wW = vec4(0.0, fW);
    if (tc == 23) {
      // 滝つぼ：落ち口から外へ広がる波の輪
      // 波の列は途切れ途切れで、場所ごとに位相がずれる
      vec2 dv = (wp.xz - uImpact.xz) / max(rr, 1e-3);
      // 輪は方向ごとに位相も強さもばらばら（同心円の模様に見せない）
      float jit = texture(tNoise, wp.xz * 0.11).r + texture(tNoise, dv * 0.45 + 0.2).r * 1.6;
      float gate = smoothstep(0.35, 0.7, texture(tNoise, wp.xz * 0.19 + vec2(-uTime * 0.05, uTime * 0.03)).g) * smoothstep(0.3, 0.6, texture(tNoise, dv * 0.3 + vec2(0.61, uTime * 0.01)).r);
      float ph = rr * 4.4 - uTime * 7.0 + jit * 9.0;
      slope += dv * sin(ph) * 0.055 * gate * exp(-rr * 0.2) * smoothstep(0.8, 2.2, rr);
    }
  } else {
    // 田・池：風のさざ波。田は浅く風が弱いので長い波は立たない
    // ため池は谷戸の奥で森に囲まれて風が弱い（凪ぐと滝と森をくっきり映す）
    wW = paddy ? vec4(0.0, 0.0, 0.016, 0.036) * amp : vec4(0.01, 0.02, 0.034, 0.05) * (0.08 + 0.52 * amp);
    // 水面の薄い膜（花粉・有機物）がさざ波を消す：風下へ伸びた滑らかな筋がゆっくり流れる
    vec2 wdir = dot(wv, wv) > 1e-6 ? normalize(wv) : vec2(1.0, 0.0);
    vec2 sq = vec2(dot(wp.xz, wdir) - uTime * 0.18, dot(wp.xz, vec2(-wdir.y, wdir.x)));
    float sn = texture(tNoise, sq * vec2(0.0045, 0.014) + pr * 0.37).r * 0.7 + texture(tNoise, sq * vec2(0.014, 0.04) + 0.5).r * 0.3;
    float slick = smoothstep(0.5, 0.56, sn) * (paddy ? 0.75 : 0.9);
#ifndef RIBBON
    // 田：風上の畦ぎわは風がさえぎられて鏡のよう（畦から離れるほど波が立つ）
    if (paddy && sdf < 6.0) {
      float e = 0.75;
      vec2 gs = vec2(texture(tSdf, worldUV(wp.xz + vec2(e, 0.0))).x - texture(tSdf, worldUV(wp.xz - vec2(e, 0.0))).x,
                     texture(tSdf, worldUV(wp.xz + vec2(0.0, e))).x - texture(tSdf, worldUV(wp.xz - vec2(0.0, e))).x);
      if (dot(gs, gs) > 1e-6) {
        float up = smoothstep(-0.1, 0.6, dot(normalize(gs), wdir));
        slick = max(slick, (1.0 - smoothstep(0.8, 3.0 + 3.0 * pr, sdf)) * up * 0.92);
      }
    }
    // 区画ごとに風の当たり方が少しちがう
    if (paddy) wW *= 0.6 + 0.8 * fract(pr * 7.31);
#endif
    wW *= 1.0 - slick;
    slope = windWaves(wp.xz, wW, fw);
  }
  slope += ringSlope(wp.xz);
#ifdef RIBBON
  // 落ち口では面そのものが傾く
  vec3 N0 = normalize(vRN);
  vec3 N = normalize(N0 + vec3(-slope.x, 0.0, -slope.y) * N0.y);
#else
  vec3 N = normalize(vec3(-slope.x, 1.0, -slope.y));
#endif
  // 粗さ：太陽の大きさ＋画素より細かい波
  float lv = lostVar(fw, wW);
  float alpha = sqrt((paddy ? 0.00006 : 0.0009) + lv * 2.0);
  vec3 V = -rd;
  float NdV = max(dot(N, V), 1e-3);
  float F = fresnelW(NdV);
  // 遠くの田：画素より細かいさざ波の面の向きのばらつきで、平均すると空をもう少し映す（遠目にも水の張った田に見える）
  float farP = paddy ? smoothstep(0.02, 0.12, fw) : 0.0;
  F = max(F, 0.11 * farP);
  vec3 R = reflect(rd, N);
  R.y = abs(R.y);

  // ---- 反射 ----
  vec3 skyR = skyRadiance(R);
  vec4 cl = cloud2D(wp, R);
  skyR = skyR * cl.a + cl.rgb;
  float hit; vec3 hp;
  float jit = ign(gl_FragCoord.xy + uFrame * 5.588);
  vec3 refl = ssr(wp, R, jit, sqrt(lv) * (tc == 11 ? 0.6 : 1.5), skyR, hit, hp);
  refl = applyFog(refl, wp, hp);
  // 画面外へ出た反射：地形の高さ（＋森の樹冠）をたどって丘に当たるか調べる
  if (hit < 0.99) {
    float tt2 = 3.0, tPrev2 = 0.0;
    float lim = -uWorld.x - 4.0;
    for (int i = 0; i < 24; i++) {
      vec3 q = wp + R * tt2;
      if (q.y > 320.0 || tt2 > 420.0 || abs(q.x) > lim || abs(q.z) > lim) break;
      vec4 tyq = texelFetch(tType, worldTexel(q.xz), 0);
      float canopy = tyq.z * 12.0;
      float hq = heightAt(q.xz) + canopy;
      if (q.y < hq) {
        // 当たった区間を二分して、稜線の映り込みを階段にしない
        float a = tPrev2, b = tt2;
        for (int k = 0; k < 5; k++) {
          float m = 0.5 * (a + b);
          vec3 qm = wp + R * m;
          if (qm.y < heightAt(qm.xz) + texelFetch(tType, worldTexel(qm.xz), 0).z * 12.0) b = m; else a = m;
        }
        q = wp + R * b;
        tyq = texelFetch(tType, worldTexel(q.xz), 0);
        vec3 hn = normalize(vec3(-R.x, 1.5, -R.z));
        float nq = texture(tNoise, q.xz / 37.0).r;
        vec3 alb = mix(vec3(0.11, 0.15, 0.05), vec3(0.2, 0.25, 0.08), nq);
        alb = mix(alb, vec3(0.04, 0.07, 0.035), smoothstep(0.55, 0.75, texture(tNoise, q.xz / 211.0).g));
        // 樹冠は木の塊の陰影でまだらに
        alb *= mix(1.0, 0.55 + 0.7 * texture(tNoise, q.xz / 9.0).r, tyq.z);
        vec3 hill = alb * (uSunCol * max(dot(hn, uSunDir), 0.25) * cloudShadow(q) + shIrr(hn) * 0.75);
        hill = applyFog(hill, wp, q);
        skyR = hill;
        break;
      }
      tPrev2 = tt2;
      tt2 = tt2 * 1.22 + 1.2;
    }
  }
  refl = mix(skyR, refl, hit);

  // ---- 透過：深さで吸収と濁り ----
  float sh = sunShadow(wp, 1.0, gl_FragCoord.xy);
  float dRaw = texture(tDepth, suv).r;
  vec3 bed = worldFromDepth(suv, dRaw);
  float Dv = isSky(dRaw) ? 30.0 : max(wp.y - bed.y, 0.0);
  // 屈折：底は波の傾きと深さに応じてずれて見える
  vec2 roff = slope * min(Dv, 2.0) * 0.25 * uPy * 0.5 / max(wd, 0.3);
  vec2 ruv = suv + clamp(roff, vec2(-0.03), vec2(0.03));
  float dR = texture(tDepth, ruv).r;
  if (linearDepth(dR) < wd) { ruv = suv; dR = dRaw; }
  else { bed = worldFromDepth(ruv, dR); Dv = isSky(dR) ? 30.0 : max(wp.y - bed.y, 0.0); }
  vec3 under = texture(tColor, ruv).rgb;
  // 代かきのあとの田：ところどころ泥が水面から顔を出す（畦ぎわほど多い）
  float mud = 0.0;
#ifndef RIBBON
  if (tc == 1) {
    float mn = texture(tNoise, wp.xz * 0.045 + 0.3).r * 0.55 + texture(tNoise, wp.xz * 0.17 + 2.7).r * 0.3 + texture(tNoise, wp.xz * 0.7).r * 0.15;
    mn += (1.0 - smoothstep(0.4, 2.5, sdf)) * 0.1;
    mud = smoothstep(0.685, 0.7, mn);
    Dv *= 1.0 - 0.7 * smoothstep(0.64, 0.69, mn);
  }
#endif
  // 視線は屈折して底へ、光は上から底へ届いて戻る
  float cosT = sqrt(max(1.0 - (1.0 - NdV * NdV) / 1.777, 0.04));
  float pathV = Dv / cosT;
  vec3 ext, scA;
  if (paddy) {
    // 代かきの泥で濁った浅い水：区画ごとに濁りがちがう（代かきしたての黄土色〜泥が沈んで澄んだ水）
    float fresh = fract(pr * 3.71);
    ext = mix(vec3(3.4, 3.2, 3.1), vec3(9.5, 8.6, 7.6), fresh);
    scA = mix(vec3(0.05, 0.046, 0.036), vec3(0.15, 0.115, 0.066), fresh * fresh);
  }
  else if (clearW) { ext = vec3(1.05, 0.2, 0.17); scA = vec3(0.004, 0.028, 0.03); }   // 澄んだ山の水
  else if (tc == 20) { ext = vec3(1.3, 0.72, 0.9); scA = vec3(0.011, 0.024, 0.015); }     // ため池：緑がかった濁り
  else { ext = vec3(1.05, 0.5, 0.55); scA = vec3(0.012, 0.029, 0.025); }                   // 川
  // 滝つぼは細かい泡と岩の粉で、澄んだ中にも青緑に光る
  if (tc == 23) scA = vec3(0.01, 0.036, 0.034);
  vec3 Eu = shIrr(vec3(0.0, 1.0, 0.0)) + uSunCol * 0.45 * sh;
  // 浅い澄んだ水の底：波が集めた光の模様
  // 波立って泡を含んだ水・速い流れの下では模様は崩れて消える。深いほどぼけたまだらに
  if (clearW) {
    float cs = smoothstep(0.03, 0.14, Dv) * (1.0 - smoothstep(0.45, 1.6, Dv)) * sh;
    cs *= (1.0 - smoothstep(0.15, 0.65, foamAmt)) / (1.0 + 0.35 * spd);
    if (tc == 23) cs *= smoothstep(3.0, 7.0, rr);
    if (cs > 0.01) {
      vec2 cp = bed.xz + uSunDir.xz / max(uSunDir.y, 0.2) * Dv * 0.75;
      float blur = min(Dv * 3.0, 2.5);
      float c;
#ifdef RIBBON
      // 模様を作る波は流れに乗って下流へ動く（2つの位相を交互に）
      float Tc = 1.6;
      float c0 = fract(uTime / Tc), c1 = fract(uTime / Tc + 0.5);
      float ca = 1.0 - abs(2.0 * c0 - 1.0);
      c = mix(caustic(cp - fdn * spd * 0.7 * c1 * Tc + 0.41, blur), caustic(cp - fdn * spd * 0.7 * c0 * Tc, blur), ca);
#else
      c = caustic(cp, blur);
#endif
      under *= 1.0 + (c - 1.0) * cs * 0.6;
    }
  }
  // 川・池の底：泥と藻のまだら、沈んだ落ち葉の暗い点（浅いところほどよく見える）
  if (tc == 11 || tc == 20) {
    vec2 bq = bed.xz;
    float m1 = texture(tNoise, bq * 0.21).r, m2 = texture(tNoise, bq * 0.9 + 1.3).b;
    float algae = smoothstep(0.45, 0.7, m1);
    vec3 tint = mix(vec3(1.0), vec3(0.55, 0.7, 0.42), algae * 0.8) * (0.8 + 0.35 * m2);
    under *= mix(vec3(1.0), tint, 1.0 - smoothstep(0.3, 1.6, Dv));
  }
#ifndef RIBBON
  if (paddy) {
    // 田の底：泥のまだらと、畦に沿って回った機械の車輪の跡（距離場の等高線）
    vec2 bq = bed.xz;
    float m1 = texture(tNoise, bq * 0.11 + pr * 3.0).r, m2 = texture(tNoise, bq * 0.47 + 1.7).r;
    float u = (sdf + (texture(tNoise, bq * 0.017 + pr).r - 0.5) * 0.6) / 2.1;
    float f = fract(u);
    float rut = max(1.0 - smoothstep(0.02, 0.1, abs(f - 0.22)), 1.0 - smoothstep(0.02, 0.1, abs(f - 0.8)));
    rut *= (1.0 - smoothstep(2.5, 5.0, sdf)) * smoothstep(0.35, 0.6, texture(tNoise, bq * 0.05 + 3.3).g + 0.15) * (1.0 - smoothstep(0.02, 0.08, fw));
    float tone = 0.8 + (0.55 * (m1 - 0.5) + 0.3 * (m2 - 0.5)) * (1.0 - 0.7 * farP);
    under *= tone * (1.0 - 0.22 * rut);
    Dv += 0.03 * rut;
  }
#endif
  vec3 Tb = exp(-ext * (pathV + Dv * 1.15));
  vec3 Tv = exp(-ext * pathV);
  vec3 transm = under * Tb + scA * Eu * (1.0 - Tv);
  if (tc == 23) {
    // 滝の水が巻きこんだ泡：水の中で光を散らして、落ち口のまわりが明るい青緑になる
    float aer = exp(-rr * 0.5);
    transm = mix(transm, vec3(0.42, 0.62, 0.62) * Eu * 0.55, aer * 0.75);
  }

  // ---- 太陽の照り返し ----
  vec3 Ls = uSunDir;
  vec3 H = normalize(Ls + V);
  float NdL = max(dot(N, Ls), 0.0);
  float NdH = max(dot(N, H), 0.0);
  float a2 = alpha * alpha;
  float dd = NdH * NdH * (a2 - 1.0) + 1.0;
  float D = a2 / (PI * dd * dd);
  float Vis = 0.5 / (NdL * sqrt(NdV * NdV * (1.0 - a2) + a2) + NdV * sqrt(NdL * NdL * (1.0 - a2) + a2) + 1e-4);
  vec3 spec = uSunCol * D * Vis * fresnelW(max(dot(V, H), 0.0)) * NdL * sh;
  // 画素より細かいさざ波の照り返しは、なめらかな円ではなく細かなきらめきの粒に（平均の明るさは同じ）
  float gk = smoothstep(0.0001, 0.0015, lv);
  if (gk > 0.01 && spec.r > 0.03) {
    vec2 gs = band(wp.xz * 1.37 - uWindOff * 0.15, 3);
    float gx = dot(gs, gs) * 0.5;
    spec *= mix(1.0, gx * gx * 0.5, gk * 0.85);
  }

  vec3 col = mix(transm, refl, F) + min(spec, vec3(60.0));
  if (mud > 0.001) {
    float mv = texture(tNoise, wp.xz * 1.3).r;
    vec3 mA = vec3(0.13, 0.11, 0.085) * (0.8 + 0.4 * mv);
    // 泥の小さな起伏で光の当たり方がまだら
    vec3 mN = normalize(vec3((texture(tNoise, wp.xz * 0.9).r - 0.5) * 0.8, 1.0, (texture(tNoise, wp.xz * 0.9 + 0.5).r - 0.5) * 0.8));
    vec3 mc = mA * (uSunCol * max(dot(mN, uSunDir), 0.0) * sh + shIrr(mN));
    // 濡れた泥のつや：空をうっすら映す
    mc = mix(mc, refl, fresnelW(max(-rd.y, 0.02)) * 0.35);
    col = mix(col, mc, mud);
  }

  // ---- 白い泡：落ち口の下・滝つぼで、流れに乗って流れる ----
  // 流れに沿った座標（x=下流へ・y=横, m）。向きの変わる流れに大きな世界座標をそのまま射影すると、
  // わずかな向きの差で座標が大きくずれて模様が細かい縞になるので、流れの形から直接とる
#ifdef RIBBON
  vec2 pf = vec2(-vRib.y, vRib.z), pfR = pf;
#else
  vec2 pf = vec2(dot(wp.xz, fdn), dot(wp.xz, vec2(-fdn.y, fdn.x)));
  vec2 pfR = pf;
  if (tc == 11) {
    // 川：東へ流れるので下流＝x、横は川の中心線からの符号つき距離
    vec2 pp = vec2(-fdn.y, fdn.x) * 0.75;
    float rP = texture(tSdf, worldUV(wp.xz + pp)).z, rM = texture(tSdf, worldUV(wp.xz - pp)).z;
    float dd = (rM - rP) * 0.5;
    pfR = vec2(wp.x, abs(dd) < 0.7 ? dd : sign(dd) * texture(tSdf, worldUV(wp.xz)).z);
  }
#endif
  float foam = 0.0, foamTone = 1.0;
  if (foamAmt > 0.01 && tc != 23) {
    // 流れの速さは場所ごとにちがうので、模様を uTime×速さ で流しつづけると時間とともに縮んで縞になる
    // → 2つの位相を交互に混ぜて、流す距離をいつも1周期ぶんまでにする
    float Tf = 1.0;
    float f0 = fract(uTime / Tf), f1 = fract(uTime / Tf + 0.5);
    float fa = 1.0 - abs(2.0 * f0 - 1.0);
    vec2 A = foamPattern(vec2(pf.x - spd * f0 * Tf, pf.y), foamAmt);
    vec2 B = foamPattern(vec2(pf.x - spd * f1 * Tf + 3.7, pf.y + 1.3), foamAmt);
    foam = mix(B.x, A.x, fa);
    foamTone = mix(B.y, A.y, fa);
  }
#ifndef RIBBON
  if (tc == 23) {
    {
      // 滝つぼ：落ち口はわき立つ泡、その外は泡の群れが外へ流れてほどけ、筋になって出口から流れ出る
      // 淵の外側はほとんど澄んだ暗い水（泡のいかだがところどころ浮かぶだけ）
      vec2 dv = wp.xz - uImpact.xz;
      vec2 dn = dv / max(rr, 1e-3);
      vec2 ov = uOutlet - uImpact.xz;
      vec2 od = ov / max(length(ov), 1e-3);
      // 出口へ向かう流れの筋：落ち口から出口への線の近く
      float along = dot(dv, od), lat = abs(dot(dv, vec2(-od.y, od.x)));
      float trail = smoothstep(0.5, 3.0, along) * (1.0 - smoothstep(1.2, 3.2 + along * 0.15, lat));
      // 流れの向き：落ち口の近くは外へ、離れるほど出口へ曲がる
      vec2 fv = mix(dn, od, smoothstep(1.5, 5.5, rr) * 0.7 + trail * 0.3);
      fv = dot(fv, fv) > 1e-6 ? normalize(fv) : od;
      // 流した座標で模様を引く（2つの位相を交互に）
      float T = 9.0;
      float t0 = fract(uTime / T), t1 = fract(uTime / T + 0.5);
      float a = 1.0 - abs(2.0 * t0 - 1.0);
      vec2 q0 = wp.xz - fv * (0.55 * t0 * T), q1 = wp.xz - fv * (0.55 * t1 * T) + 0.37;
      // 模様の座標をゆがめて、泡の網を不ぞろいな糸と塊に
      q0 += (texture(tNoise, q0 * 0.07).rg - 0.5) * 1.2;
      q1 += (texture(tNoise, q1 * 0.07 + 0.5).rg - 0.5) * 1.2;
      float patch0 = texture(tNoise, q0 * 0.16).r * 0.6 + texture(tNoise, q0 * 0.41 + 1.7).r * 0.4;
      float patch1 = texture(tNoise, q1 * 0.16).r * 0.6 + texture(tNoise, q1 * 0.41 + 1.7).r * 0.4;
      // 泡の網は大小2つの大きさ（小さい方は回して重ねる）
      mat2 r2 = mat2(0.8, 0.6, -0.6, 0.8);
      vec3 l0 = texture(tWaves, vec3(q0 * 0.38, 9.0), 0.7).rgb, l1 = texture(tWaves, vec3(q1 * 0.38, 9.0), 0.7).rgb;
      vec3 m0 = texture(tWaves, vec3(r2 * q0 * 0.9 + 0.21, 9.0), 0.5).rgb, m1 = texture(tWaves, vec3(r2 * q1 * 0.9 + 0.63, 9.0), 0.5).rgb;
      float n0 = max(l0.r, m0.r * 0.8) * (0.3 + 0.7 * l0.g), n1 = max(l1.r, m1.r * 0.8) * (0.3 + 0.7 * l1.g);
      // 塊のところだけ泡が集まる
      float nearB = trail * 0.12 + (1.0 - smoothstep(2.0, 5.5, rr)) * 0.14;
      float drift = mix(smoothstep(0.3, 0.7, n1 + m1.b * 0.3) * smoothstep(0.5, 0.72, patch1 + nearB),
                        smoothstep(0.3, 0.7, n0 + m0.b * 0.3) * smoothstep(0.5, 0.72, patch0 + nearB), a);
      float sheet = mix(smoothstep(0.6, 0.76, patch1) * l1.g * m1.g, smoothstep(0.6, 0.76, patch0) * l0.g * m0.g, a);
      float boil = texture(tNoise, wp.xz * 0.55 + vec2(uTime * 0.23, -uTime * 0.17)).b * 0.6 + texture(tNoise, wp.xz * 1.4 - vec2(uTime * 0.4, uTime * 0.31)).r * 0.4;
      vec3 lz = texture(tWaves, vec3(wp.xz * 0.6 + dn * uTime * 0.2, 9.0)).rgb;
      float core = 1.0 - smoothstep(0.6, 4.4, rr);
      float ring = max(1.0 - smoothstep(1.0, 6.5, rr), trail * 0.8);
      foam = max(core * smoothstep(0.3, 0.62, boil + core * 0.22) * (0.8 + 0.2 * lz.b),
                 ring * max(drift, sheet * 1.2) * (0.45 + 0.55 * ring));
    }
  }
#endif
  // 岸の水ぎわ：ごく浅いところに細い泡とごみの線（川・池）
  if (!paddy && !clearW) {
    float shore = smoothstep(0.0, 0.01, Dv) * (1.0 - smoothstep(0.012, 0.05, Dv)) * (1.0 - smoothstep(0.02, 0.08, fw));
    if (shore > 0.01) {
      float lz = texture(tWaves, vec3(wp.xz * 0.7 - fdn * uTime * 0.05, 9.0)).r;
      float gate = smoothstep(0.45, 0.7, texture(tNoise, wp.xz * 0.23).r);
      foam = max(foam, shore * lz * gate * 0.35);
    }
  }
#ifndef RIBBON
  // 川：流れに沿った細い泡と花粉の筋（流れの継ぎ目に集まり、ゆっくり蛇行しながら流れる）
  if (tc == 11 && fw < 0.15) {
    // 横方向だけの関数の等値線＝流れに沿った筋。下流へ行くにつれてゆっくり横へゆらぐ
    float xs = pfR.x - uTime * 0.8;
    float yy = pfR.y + (texture(tNoise, vec2(xs * 0.004, 0.31)).r - 0.5) * 5.0 + (texture(tNoise, vec2(xs * 0.03, 0.53)).r - 0.5) * 1.6;
    float n1 = texture(tNoise, vec2(yy * 0.045, 0.77)).r;
    // 太さは筋に沿って変わる（細い糸から、泡の粒が広がった帯まで）
    float wl = 0.005 * (0.4 + 1.4 * texture(tNoise, vec2(xs * 0.08, yy * 0.2) + 0.9).b), pxn = fw * 0.15;
    float line = (1.0 - smoothstep(0.0, wl + pxn, abs(n1 - 0.5))) * wl / (wl + pxn);
    float gate = smoothstep(0.5, 0.7, texture(tNoise, vec2((pfR.x - uTime * 0.8) * 0.01, pfR.y * 0.05) + 0.3).g);
    // 筋は細かな泡の粒の集まり：ところどころ途切れる
    float grain = smoothstep(0.42, 0.68, texture(tNoise, vec2(pfR.x - uTime * 0.8, pfR.y) * vec2(0.5, 1.2)).r);
    foam = max(foam, line * gate * 0.16 * grain * (1.0 - smoothstep(0.03, 0.1, fw)));
  }
#endif
  if (foam > 0.001) {
    vec3 fN = normalize(vec3(-slope.x * 2.0, 1.0, -slope.y * 2.0));
    vec3 fcol = vec3(0.86, 0.9, 0.92) * foamTone * (uSunCol * (0.35 + 0.65 * max(dot(fN, uSunDir), 0.0)) * sh + shIrr(fN) * 1.1);
    col = mix(col, fcol, foam * 0.92);
  }

  // ---- 花筏：桜のそばの水面に浮かぶ花びら（川は上流から流れてくる分も） ----
  float pd = petalDensity(wp.xz);
  // 川：上流から流れてきた分が、流れのゆるい岸寄りにたまる
  if (tc == 11) {
    float bank = smoothstep(2.4, 4.0, texture(tSdf, worldUV(wp.xz)).z);
    pd = max(pd * (0.3 + 0.9 * bank), 0.12 * bank);
  }
  if (pd > 0.02 && !clearW) {
    float px = fw * 11.0;
    // 花びらは寄り集まって筋になる
    vec2 cq = tc == 11 ? vec2(pfR.x * 0.25, pfR.y * 0.9) : wp.xz * 0.35;
    float clumpP = smoothstep(tc == 11 ? 0.52 : 0.42, 0.74, texture(tNoise, cq * 0.35 - uWindOff * 0.004).g);
    // 川はばらばらの1枚ではなく、岸のよどみに寄り集まった花筏に
    float dens = pd * ((tc == 11 ? 0.01 : 0.06) + 1.4 * clumpP * clumpP) * 0.5;
    vec2 pc;
    if (tc == 11) {
      // 流れに乗る（2つの位相を交互に）
      float T = 14.0;
      float t0 = fract(uTime / T), t1 = fract(uTime / T + 0.5);
      float a = 1.0 - abs(2.0 * t0 - 1.0);
      vec2 p0 = petalLayer(wp.xz - fdn * 0.55 * t0 * T, dens, px);
      vec2 p1 = petalLayer(wp.xz - fdn * 0.55 * t1 * T + 0.043, dens, px);
      pc = vec2(p0.x * a + p1.x * (1.0 - a), mix(p1.y, p0.y, a));
    } else {
      pc = petalLayer(wp.xz - uWindOff * 0.02, dens, px);
    }
    // 遠くは1枚ずつではなく、覆う割合の色味で
    float far = smoothstep(0.25, 0.9, px);
    float cov = mix(pc.x, dens * 0.08, far);
    if (cov > 0.001) {
      vec3 alb = mix(vec3(0.93, 0.68, 0.76), vec3(0.97, 0.84, 0.88), pc.y);
      vec3 pcol = alb * (uSunCol * max(uSunDir.y, 0.0) * sh * 0.9 + shIrr(vec3(0.0, 1.0, 0.0)));
      col = mix(col, pcol, cov * 0.95);
    }
  }

  // 岸へ向かって水は薄くなって消える（交わる線を固くしない）
#ifndef RIBBON
  if (!paddy) edge *= smoothstep(0.0, 0.02, Dv);
#endif
  gl_FragColor = vec4(col, edge);
}
`;

// ---- 波の帯・集光模様・泡の模様を焼く（起動時・約0.1秒） ----
const WS = 128;
// 波の帯：繰り返しの長さL(m)、波数の範囲（L/n が波長）、風に流される割合
const BANDS = [
  { L: 8.0, n0: 3, n1: 9, drift: 0.02 },
  { L: 2.4, n0: 3, n1: 9, drift: 0.045 },
  { L: 0.72, n0: 3, n1: 10, drift: 0.08 },
  { L: 0.21, n0: 3, n1: 11, drift: 0.12 },
];
// 重力＋表面張力の分散：ω² = g k + (σ/ρ) k³
const omegaOf = (L, n) => { const k = 2 * Math.PI * n / L; return Math.sqrt(9.81 * k + 7.3e-5 * k * k * k); };
const SUB = BANDS.flatMap(({ L, n0, n1 }) => {
  const nm = Math.sqrt(n0 * n1);
  return [{ L, a: n0, b: nm, w: omegaOf(L, Math.sqrt(n0 * nm)) }, { L, a: nm, b: n1, w: omegaOf(L, Math.sqrt(nm * n1)) }];
});

function waveTextures() {
  const S = WS, NL = SUB.length + 2, px = S * S;
  const out = new Uint8Array(px * 4 * NL);
  const cosT = new Float32Array(S), sinT = new Float32Array(S);
  for (let m = 0; m < S; m++) { cosT[m] = Math.cos(2 * Math.PI * m / S); sinT[m] = Math.sin(2 * Math.PI * m / S); }
  // 波の場：整数の波数 n0≤|n|<n1 の成分の和。傾きの複素振幅（実部x,y・虚部x,y）
  const field = (n0, n1, seed) => {
    const r = mulberry32(seed);
    const acc = new Float32Array(px * 4);
    const N1 = Math.ceil(n1);
    for (let ny = -N1; ny <= N1; ny++) for (let nx = -N1; nx <= N1; nx++) {
      const nn = Math.hypot(nx, ny);
      if (nn < n0 || nn >= n1) continue;
      const s = Math.sqrt(-2 * Math.log(1 - r() * 0.999)) / nn;
      const ph = r() * 2 * Math.PI;
      const ux = nx / nn, uy = ny / nn;
      const pc = Math.cos(ph) * s, ps = Math.sin(ph) * s;
      const sx = ((nx % S) + S) % S, sy = ((ny % S) + S) % S;
      let my = 0;
      for (let y = 0; y < S; y++) {
        const ry = pc * cosT[my] - ps * sinT[my], iy = pc * sinT[my] + ps * cosT[my];
        let mx = 0;
        let o = y * S * 4;
        for (let x = 0; x < S; x++) {
          const er = ry * cosT[mx] - iy * sinT[mx], ei = ry * sinT[mx] + iy * cosT[mx];
          // 傾き = i·k̂·振幅·e^{iθ}
          acc[o] -= ux * ei; acc[o + 1] -= uy * ei; acc[o + 2] += ux * er; acc[o + 3] += uy * er;
          o += 4;
          mx += sx; if (mx >= S) mx -= S;
        }
        my += sy; if (my >= S) my -= S;
      }
    }
    return acc;
  };
  const put8 = (layer, q, v) => { out[layer * px * 4 + q] = Math.max(0, Math.min(255, Math.round(v))); };
  SUB.forEach((sb, l) => {
    const acc = field(sb.a, sb.b, 7001 + l * 131);
    let ms = 0;
    for (let q = 0; q < px; q++) ms += acc[q * 4] ** 2 + acc[q * 4 + 1] ** 2 + acc[q * 4 + 2] ** 2 + acc[q * 4 + 3] ** 2;
    const k = 32 / Math.sqrt(ms / (2 * px) + 1e-12);   // 傾きのRMSを1に
    for (let q = 0; q < px * 4; q++) put8(l, q, 128 + acc[q] * k);
  });
  // 集光模様：波の面で曲げた光を底に落として数える
  let causScale = 1;
  {
    const acc = field(2, 8, 4242);
    const sxF = new Float32Array(px), syF = new Float32Array(px);
    for (let q = 0; q < px; q++) { sxF[q] = acc[q * 4]; syF[q] = acc[q * 4 + 1]; }
    let dv = 0;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const q = y * S + x, xr = y * S + ((x + 1) % S), yu = ((y + 1) % S) * S + x;
      dv += (sxF[xr] - sxF[q] + syF[yu] - syF[q]) ** 2;
    }
    const Dp = 1.25 / Math.sqrt(dv / px);
    const bin = new Float32Array(px);
    const SS = 3;
    for (let y = 0; y < S * SS; y++) for (let x = 0; x < S * SS; x++) {
      const q = Math.floor(y / SS) * S + Math.floor(x / SS);
      let X = x / SS + sxF[q] * Dp, Y = y / SS + syF[q] * Dp;
      const xi = Math.floor(X), yi = Math.floor(Y), fx = X - xi, fy = Y - yi;
      const i0 = ((xi % S) + S) % S, j0 = ((yi % S) + S) % S, i1 = (i0 + 1) % S, j1 = (j0 + 1) % S;
      bin[j0 * S + i0] += (1 - fx) * (1 - fy); bin[j0 * S + i1] += fx * (1 - fy);
      bin[j1 * S + i0] += (1 - fx) * fy; bin[j1 * S + i1] += fx * fy;
    }
    // 少しぼかして平均1に
    const c = new Float32Array(px);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      let s = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) s += bin[((y + dy + S) % S) * S + ((x + dx + S) % S)] * (dx === 0 && dy === 0 ? 4 : dx === 0 || dy === 0 ? 2 : 1);
      c[y * S + x] = s / 16 / (SS * SS);
    }
    const r = mulberry32(99);
    let mm = 0;
    for (let i = 0; i < 20000; i++) mm += Math.min(Math.min(4, c[Math.floor(r() * px)]), Math.min(4, c[Math.floor(r() * px)]));
    causScale = 4 / (mm / 20000);
    const l = SUB.length;
    for (let q = 0; q < px; q++) { const v = Math.min(4, c[q]) / 4 * 255; put8(l, q * 4, v); put8(l, q * 4 + 1, v); put8(l, q * 4 + 2, v); put8(l, q * 4 + 3, 255); }
  }
  // 泡の模様：r=泡の網（細胞の境目） g=塊 b=細かい泡粒
  {
    const hash = (x, y, s) => { let v = (x * 374761393 + y * 668265263 + s * 2246822519) >>> 0; v = Math.imul(v ^ (v >>> 13), 1274126177) >>> 0; return ((v ^ (v >>> 16)) >>> 0) / 4294967296; };
    const md = (a, p) => ((a % p) + p) % p;
    const worley = (x, y, P, s) => {
      const xi = Math.floor(x), yi = Math.floor(y);
      let f1 = 9, f2 = 9;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const cx = xi + dx, cy = yi + dy;
        const d = Math.hypot(cx + hash(md(cx, P), md(cy, P), s) - x, cy + hash(md(cx, P), md(cy, P), s + 7) - y);
        if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) f2 = d;
      }
      return [f1, f2];
    };
    const vn = (x, y, P, s) => {
      const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
      const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
      const a = hash(md(xi, P), md(yi, P), s), b = hash(md(xi + 1, P), md(yi, P), s), c = hash(md(xi, P), md(yi + 1, P), s), d = hash(md(xi + 1, P), md(yi + 1, P), s);
      return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
    };
    const ss = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
    const l = SUB.length + 1;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const u = x / S, v = y / S;
      // 網の太さはまちまちで、ところどころ切れる。泡粒は塊のところに集まる
      const th = 0.05 + 0.22 * vn(u * 6, v * 6, 6, 5) ** 1.5;
      const [a1, a2] = worley(u * 9, v * 9, 9, 11);
      const [b1, b2] = worley(u * 19, v * 19, 19, 23);
      const brk = ss(0.3, 0.62, vn(u * 5, v * 5, 5, 13) * 0.6 + vn(u * 13, v * 13, 13, 17) * 0.4);
      const clump = vn(u * 4, v * 4, 4, 31) * 0.65 + vn(u * 8, v * 8, 8, 37) * 0.35;
      const [c1] = worley(u * 32, v * 32, 32, 41);
      const bub = (1 - ss(0.1, 0.45, c1)) * ss(0.4, 0.7, clump);
      // 境目からの距離でやわらかく（ひびのような細い線にしない）
      const e1 = (a2 - a1) / (th * 1.8), e2 = (b2 - b1) / (th * 1.3);
      const lace = Math.max(Math.max(Math.exp(-e1 * e1), Math.exp(-e2 * e2) * 0.7) * (0.25 + 0.75 * brk), bub * 0.7);
      const q = (y * S + x) * 4;
      put8(l, q, lace * 255); put8(l, q + 1, clump * 255); put8(l, q + 2, bub * 255); put8(l, q + 3, 255);
    }
    // 網は1画素ぶんぼかす
    const o = l * px * 4, tmp = new Float32Array(px);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      let a = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) a += out[o + ((((y + dy + S) % S) * S + ((x + dx + S) % S)) * 4)] * (dx || dy ? (dx && dy ? 1 : 2) : 4);
      tmp[y * S + x] = a / 16;
    }
    for (let q = 0; q < px; q++) out[o + q * 4] = Math.round(tmp[q]);
  }
  const t = new THREE.DataArrayTexture(out, S, S, NL);
  t.format = THREE.RGBAFormat; t.type = THREE.UnsignedByteType;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true;
  t.anisotropy = 4;
  t.needsUpdate = true;
  return { tex: t, causScale };
}

// 渓流の面の格子：池の少し手前から滝つぼの出口の少し奥まで（両端は池・滝つぼの水面の下に隠れる）
function streamRibbon(world) {
  const G = world.gorge;
  if (!G || !G.profile) return null;
  const P = G.profile;
  const NA = 16, ds = 0.2;
  const rows = Math.ceil((P.s1 - P.s0) / ds);
  const pos = [], rib = [], flw = [], idx = [];
  for (let j = 0; j <= rows; j++) {
    const s = P.s0 + j * ds;
    const a0 = streamA(s);
    const W = streamHalfW(s) + 0.75;
    const [xa, za] = gorgeWorld(s + 0.3, streamA(s + 0.3)), [xb, zb] = gorgeWorld(s - 0.3, streamA(s - 0.3));
    let fx = xb - xa, fz = zb - za;
    const fl = Math.hypot(fx, fz) || 1; fx /= fl; fz /= fl;
    for (let i = 0; i <= NA; i++) {
      const t = (i / NA) * 2 - 1;
      const ac = t * W;
      const [x, z] = gorgeWorld(s, a0 + ac);
      const acc = Math.max(-W + 0.15, Math.min(W - 0.15, ac));
      const y = s < GORGE.sIn ? world.pondLevel - 0.006 : P.level(s, acc) - 0.004;
      pos.push(x, y, z);
      rib.push(t, s, ac);
      flw.push(fx, fz, P.speed(s, acc), P.white(s, acc));
    }
  }
  for (let j = 0; j < rows; j++) for (let i = 0; i < NA; i++) {
    const a = j * (NA + 1) + i, b = a + 1, c = a + NA + 1, d = c + 1;
    idx.push(a, b, c, b, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aRib', new THREE.Float32BufferAttribute(rib, 3));
  g.setAttribute('aFlow', new THREE.Float32BufferAttribute(flw, 4));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export class Water {
  constructor(world, shared, textures, depthU) {
    const N = world.N;
    this.world = world;
    this.n = (N - 1) / CHUNK;
    this.chunks = [];
    for (let cj = 0; cj < this.n; cj++) for (let ci = 0; ci < this.n; ci++) {
      let has = false, mn = 1e9, mx = -1e9;
      for (let j = cj * CHUNK; j <= (cj + 1) * CHUNK && !has; j++) for (let i = ci * CHUNK; i <= (ci + 1) * CHUNK; i++) {
        const w = world.water[j * N + i];
        if (w > -1000) { has = true; }
      }
      if (!has) continue;
      for (let j = cj * CHUNK; j <= (cj + 1) * CHUNK; j++) for (let i = ci * CHUNK; i <= (ci + 1) * CHUNK; i++) {
        const w = world.water[j * N + i]; if (w > -1000) { mn = Math.min(mn, w); mx = Math.max(mx, w); }
      }
      const x0 = world.ORIGIN + ci * CHUNK * world.CELL, z0 = world.ORIGIN + cj * CHUNK * world.CELL;
      this.chunks.push({ ci, cj, box: new THREE.Box3(new THREE.Vector3(x0, mn - 1.5, z0), new THREE.Vector3(x0 + CHUNK * world.CELL, mx + 0.5, z0 + CHUNK * world.CELL)) });
    }
    const wt = waveTextures();
    this.uniforms = {
      ...shared, ...textures, ...depthU,
      tWaves: { value: wt.tex },
      uCaus: { value: wt.causScale },
      uCS: { value: BANDS.map(() => new THREE.Vector4(1, 0, 1, 0)) },
      // 細かさの限界：いちばん短い波長の半分（これより画素が粗いと波は見えない）
      uBand: { value: BANDS.map((b) => new THREE.Vector4(1 / b.L, b.drift, b.L / b.n1 * 0.5, 0)) },
      uRings: { value: Array.from({ length: 24 }, () => new THREE.Vector4(0, 0, -99, 0)) },
      uImpact: { value: new THREE.Vector3(...(world.gorge ? world.gorge.impact : [0, -1000, 0])) },
      // 滝つぼの出口（渓流の上の端）：泡の筋はここへ流れ出る
      uOutlet: { value: new THREE.Vector2(...gorgeWorld(GORGE.sTop, streamA(GORGE.sTop))) },
      tColor: { value: null }, tDepth: { value: null },
      uRes: { value: new THREE.Vector2(1, 1) },
      uViewProj: { value: new THREE.Matrix4() },
      uPy: { value: 1 },
      uStep: { value: 1 },
    };
    this.group = new THREE.Group();
    this.levels = [2, 4, 8].map((step) => {
      const mat = new THREE.ShaderMaterial({
        uniforms: { ...this.uniforms, uStep: { value: step } },
        vertexShader: WATER_VS, fragmentShader: WATER_FS,
        alphaToCoverage: true,
      });
      const g = patchGeometry(step, false);
      const attr = new THREE.InstancedBufferAttribute(new Float32Array(this.chunks.length * 2), 2);
      attr.setUsage(THREE.DynamicDrawUsage);
      g.setAttribute('aChunk', attr);
      g.instanceCount = 0;
      const m = new THREE.Mesh(g, mat);
      m.frustumCulled = false;
      this.group.add(m);
      return { step, g, attr, mesh: m, mat };
    });
    // 渓流
    const rg = streamRibbon(world);
    if (rg) {
      const mat = new THREE.ShaderMaterial({
        uniforms: { ...this.uniforms },
        vertexShader: RIBBON_VS, fragmentShader: WATER_FS,
        defines: { RIBBON: 1 },
        alphaToCoverage: true,
      });
      this.ribbon = new THREE.Mesh(rg, mat);
      this.group.add(this.ribbon);
    }
    this._frustum = new THREE.Frustum();
    if (typeof window !== 'undefined') window.__water = this;
    this._m = new THREE.Matrix4();
  }
  // 開発用：水面だけを n 回描いて1回あたりのGPU時間(ms)を測る（重さの比較用・画面には出ない）
  bench(renderer, camera, n = 20) {
    const w = this.uniforms.uRes.value.x, h = this.uniforms.uRes.value.y;
    if (!this._benchRT || this._benchRT.width !== w) this._benchRT = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType });
    const px = new Uint16Array(4);
    renderer.setRenderTarget(this._benchRT);
    renderer.readRenderTargetPixels(this._benchRT, 0, 0, 1, 1, px);
    const t0 = performance.now();
    for (let i = 0; i < n; i++) renderer.render(this.group, camera);
    renderer.readRenderTargetPixels(this._benchRT, 0, 0, 1, 1, px);
    const t = (performance.now() - t0) / n;
    renderer.setRenderTarget(null);
    return t;
  }
  update(camera, sceneRT, w, h) {
    this._m.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    this._frustum.setFromProjectionMatrix(this._m, camera.coordinateSystem, camera.reversedDepth);
    const U = this.uniforms;
    U.tColor.value = sceneRT.texture;
    U.tDepth.value = sceneRT.depthTexture;
    U.uRes.value.set(w, h);
    U.uViewProj.value.copy(this._m);
    U.uPy.value = camera.projectionMatrix.elements[5];
    // 波の時間発展（帯の中の2つの輪はそれぞれの速さで回る）
    const t = U.uTime.value;
    for (let b = 0; b < BANDS.length; b++) {
      const wa = SUB[b * 2].w * t, wb = SUB[b * 2 + 1].w * t;
      U.uCS.value[b].set(Math.cos(wa), Math.sin(wa), Math.cos(wb), Math.sin(wb));
    }
    const counts = [0, 0, 0];
    const v = new THREE.Vector3();
    for (const c of this.chunks) {
      if (!this._frustum.intersectsBox(c.box)) continue;
      c.box.clampPoint(camera.position, v);
      const d = v.distanceTo(camera.position);
      const L = d < 350 ? 0 : d < 800 ? 1 : 2;
      const lv = this.levels[L];
      lv.attr.array[counts[L] * 2] = c.ci * CHUNK;
      lv.attr.array[counts[L] * 2 + 1] = c.cj * CHUNK;
      counts[L]++;
    }
    for (let L = 0; L < 3; L++) {
      const lv = this.levels[L];
      lv.g.instanceCount = counts[L];
      lv.attr.clearUpdateRanges();
      lv.attr.addUpdateRange(0, counts[L] * 2);
      lv.attr.needsUpdate = true;
    }
  }
}
