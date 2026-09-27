// 風に流れる小さなもの：桜の花びら・たんぽぽの綿毛・光る塵
// 位置は時間の式で決める（CPUで状態を持たない）。被写界深度は各粒のボケで描く
import * as THREE from 'three';
import { ALL, SHADOW } from './glsl.js';
import { DEPTH_GLSL } from './post.js';

const PVS = /* glsl */ `
${ALL}
${SHADOW}
${DEPTH_GLSL}
attribute vec4 aSeed;
attribute float aType;   // 0=花びら 1=綿毛 2=塵 3=滝の霧 4=滝つぼの水しぶき 5=滝つぼの泡の雲
uniform vec4 uMist;      // 滝つぼの落ち口 xyz・強さ
uniform vec4 uSplash;    // 落ち口の中心 xyz・幕の半幅
uniform vec4 uSplashDir; // 滝から離れる向き xz・-・強さ
uniform vec4 uEmit[40];
uniform float uNumEmit;
uniform vec3 uFocus;
uniform float uPxPerRad;
varying vec2 vQ;
varying float vType;
varying float vSize;     // 粒の大きさ（四角の中の割合）
varying float vSoft;     // ボケ（四角の中の割合）
varying float vAlpha;
varying float vRot;
varying float vSquash;
varying vec3 vWorld;
varying float vViewZ;
varying float vRnd;      // 粒ごとの乱数（色・形の違い）
varying float vShade;    // 日なた(1)・日陰(0)（滝の粒だけ）
float h1(uint h, uint k) { return float(pcg(h + k * 0x9E3779B9u) >> 8u) / 16777216.0; }
void main() {
  vType = aType;
  vRnd = aSeed.w;
  vec3 p;
  float size;
  float alpha = 1.0;
  uint seed = uint(aSeed.x * 16777216.0);
  if (aType < 0.5) {
    // 花びら：桜の樹冠から生まれ、風下へ流れながら舞い落ちる
    float life = 13.0 + 9.0 * aSeed.y;
    float tt = uTime + aSeed.z * life;
    float cyc = floor(tt / life);
    float age = tt - cyc * life;
    uint h = pcg(seed + uint(cyc) * 7919u);
    int e = int(mod(float(h >> 4u), max(uNumEmit, 1.0)));
    vec4 em = uEmit[e];
    vec3 rnd = vec3(h1(h, 1u), h1(h, 2u), h1(h, 3u)) * 2.0 - 1.0;
    vec3 spawn = em.xyz + rnd * vec3(em.w, em.w * 0.45, em.w) * 0.85;
    float fall = 0.45 + 0.4 * h1(h, 4u);
    vec2 drift = uWind.xy * uWind.z * (0.75 + 0.5 * h1(h, 5u)) * age;
    float ph = h1(h, 6u) * 6.2831;
    vec3 flut = vec3(sin(age * 2.1 + ph) * 0.5, sin(age * 3.4 + ph * 1.3) * 0.18, cos(age * 1.6 + ph) * 0.5);
    p = spawn + vec3(drift.x, -fall * age, drift.y) + flut;
    float g = heightAt(p.xz) + 0.03;
    if (p.y < g) { alpha = 1.0 - smoothstep(0.0, 2.5, (g - p.y) / fall); p.y = g; }
    alpha *= smoothstep(0.0, 0.8, age) * (1.0 - smoothstep(life - 1.5, life, age));
    size = 0.012 + 0.005 * h1(h, 9u);
    vRot = age * (2.0 + 3.0 * h1(h, 7u)) + ph;
    // 裏返りながら舞う：見かけの幅は向きの余弦（符号で表・裏）
    vSquash = sin(age * (1.3 + 2.0 * h1(h, 8u)) + ph);
    vRnd = h1(h, 10u);
  } else if (aType > 4.5) {
    vec2 fw = uSplashDir.xy, sv = vec2(-fw.y, fw.x);
    if (aSeed.w < 0.25) {
      // しぶきの煙：大きく淡い白い塊が落ち口の線から湧き、幕の足元を包みながら立ちのぼって外へ流れる
      float life = 2.4 + 2.2 * aSeed.y;
      float tt = uTime + aSeed.z * life;
      float cyc = floor(tt / life);
      float age = tt - cyc * life, k = age / life;
      uint h = pcg(seed + uint(cyc) * 7919u);
      float lu = h1(h, 1u) * 2.0 - 1.0;
      float core = 1.0 - lu * lu;
      float R = (0.5 + 2.6 * h1(h, 4u) * h1(h, 4u)) * (0.5 + 0.7 * core);
      vec2 b = uSplash.xz + sv * lu * uSplash.w * (0.9 + 0.5 * k) + fw * ((h1(h, 2u) - 0.3) * 0.8 + k * (0.4 + 1.6 * h1(h, 3u)));
      vec2 drift = uWind.xy * uWind.z * 0.3 * age;
      p = vec3(b.x + drift.x, uSplash.y + 0.15 + R * (1.0 - (1.0 - k) * (1.0 - k)), b.y + drift.y);
      size = (0.38 + 0.6 * h1(h, 5u)) * (0.55 + 0.9 * k) * (0.7 + 0.5 * core);
      alpha = uSplashDir.w * pow(sin(3.14159 * k), 1.3) * (0.55 + 0.45 * h1(h, 6u)) * 0.24;
      vRot = h1(h, 7u) * 6.28 + age * (h1(h, 8u) - 0.5) * 0.7;
    } else {
      // わき立つ泡：落ち口の線で小さな塊が次々に盛り上がっては崩れ、水面を外へ押し流されて薄れる（真ん中ほど高く厚い）
      float life = 0.9 + 1.4 * aSeed.y;
      float tt = uTime + aSeed.z * life;
      float cyc = floor(tt / life);
      float age = tt - cyc * life, k = age / life;
      uint h = pcg(seed + uint(cyc) * 7919u);
      float lu = h1(h, 1u) * 2.0 - 1.0;
      float core = 1.0 - lu * lu;
      float out_ = k * (0.4 + 2.6 * h1(h, 3u)) * (1.25 - core * 0.45);
      vec2 b = uSplash.xz + sv * lu * uSplash.w * (1.05 + 0.25 * k) + fw * ((h1(h, 2u) - 0.45) * 1.1 + out_);
      float up = (0.05 + 0.6 * h1(h, 4u) * h1(h, 4u)) * (0.35 + 0.85 * core);
      float rise = up * sin(3.14159 * min(1.0, k * 1.35));
      p = vec3(b.x, uSplash.y + 0.03 + rise, b.y);
      size = (0.1 + 0.28 * h1(h, 5u)) * (0.7 + 0.9 * k) * (0.8 + 0.4 * core);
      alpha = uSplashDir.w * pow(sin(3.14159 * k), 0.6) * (0.45 + 0.55 * h1(h, 6u)) * 0.72 * (1.0 - 0.45 * k);
      vRot = h1(h, 7u) * 6.28 + age * (h1(h, 8u) - 0.5) * 1.6;
    }
    if (distance(p, cameraPosition) > 220.0) alpha = 0.0;
    vSquash = 1.0;
  } else if (aType > 3.5) {
    // 水しぶき：落ち口の線から跳ね上がり、放物線を描いて水面へ戻る粒
    float life = 0.5 + 1.0 * aSeed.y;
    float tt = uTime + aSeed.z * life;
    float cyc = floor(tt / life);
    float age = tt - cyc * life;
    uint h = pcg(seed + uint(cyc) * 7919u);
    vec2 fw = uSplashDir.xy, sv = vec2(-fw.y, fw.x);
    vec2 b = uSplash.xz + sv * (h1(h, 1u) * 2.0 - 1.0) * uSplash.w * 0.95 + fw * (h1(h, 2u) - 0.4) * 0.8;
    float vy = 1.2 + 4.6 * h1(h, 3u) * h1(h, 3u) + 0.8 * h1(h, 8u);
    float vo = 0.3 + 3.2 * h1(h, 4u);
    float an = (h1(h, 5u) - 0.5) * 2.6;
    vec2 dh = fw * cos(an) + sv * sin(an);
    float y = uSplash.y + 0.05 + vy * age - 4.9 * age * age;
    p = vec3(b.x + dh.x * vo * age, y, b.y + dh.y * vo * age);
    alpha = uSplashDir.w * step(uSplash.y - 0.02, y) * smoothstep(0.0, 0.06, age) * (0.6 + 0.4 * h1(h, 6u));
    size = 0.006 + 0.02 * h1(h, 7u) * h1(h, 7u);
    if (distance(p, cameraPosition) > 160.0) alpha = 0.0;
    vRot = 0.0; vSquash = 1.0;
  } else if (aType > 2.5) {
    // 滝のしぶき：滝つぼから湧き上がり、外へ広がって風に流される
    float life = 4.5 + 3.5 * aSeed.y;
    float tt = uTime + aSeed.z * life;
    float cyc = floor(tt / life);
    float age = tt - cyc * life;
    uint h = pcg(seed + uint(cyc) * 7919u);
    vec3 rnd = vec3(h1(h, 1u), h1(h, 2u), h1(h, 3u)) * 2.0 - 1.0;
    vec3 c = uMist.xyz + vec3(rnd.x * 2.6, 0.1, rnd.z * 2.6);
    // 3割は落ちる幕の下の方から湧く（滝の下半分を包むしぶきの幕）
    if (h1(h, 9u) < 0.3) c = vec3(uSplash.x, uSplash.y, uSplash.z) + vec3(-uSplashDir.y, 0.0, uSplashDir.x) * rnd.x * uSplash.w * 1.2 + vec3(0.0, 0.5 + 5.0 * h1(h, 10u), 0.0) - vec3(uSplashDir.x, 0.0, uSplashDir.y) * 0.6;
    float up = 2.0 * (1.0 - exp(-age * 0.9)) / 0.9 + 0.35 * age;
    vec2 o2 = normalize(rnd.xz + 1e-3) * (2.6 * (1.0 - exp(-age * 0.7)) / 0.7);
    vec2 drift = uWind.xy * uWind.z * 0.45 * age;
    p = c + vec3(o2.x + drift.x, up, o2.y + drift.y);
    size = (0.6 + 0.5 * age) * (0.7 + 0.6 * h1(h, 4u));
    alpha = uMist.w * smoothstep(0.0, 1.4, age) * (1.0 - smoothstep(life * 0.3, life, age)) * 0.026;
    // 霧の中に入っても視界を覆わない（すぐそばの粒は薄く）
    float dc = distance(p, cameraPosition);
    alpha *= smoothstep(2.0, 9.0, dc);
    if (dc > 260.0) alpha = 0.0;
    vRot = 0.0; vSquash = 1.0;
  } else {
    // 綿毛と塵：視点のまわりの箱の中を、風の模様と一緒に流れる
    vec3 B = aType < 1.5 ? vec3(52.0, 18.0, 52.0) : vec3(14.0, 7.0, 14.0);
    vec3 base = vec3(aSeed.y, aSeed.z, aSeed.w) * B;
    float ph = aSeed.x * 6.2831;
    vec3 flow = vec3(uWindOff.x, 0.0, uWindOff.y) * (aType < 1.5 ? 0.95 : 0.85);
    vec3 wob = vec3(sin(uTime * 0.37 + ph) * 1.2, sin(uTime * 0.23 + ph * 1.7) * 1.6, cos(uTime * 0.31 + ph) * 1.2);
    vec3 q = base + flow + wob;
    vec3 rel = mod(q - cameraPosition + B * 0.5, B) - B * 0.5;
    p = cameraPosition + rel;
    float g = heightAt(p.xz);
    // 高さは地面からの割合で（地を這うことも、空高く漂うこともある）
    float hy = (rel.y / B.y + 0.5);
    p.y = max(p.y, g + 0.3 + hy * (aType < 1.5 ? 25.0 : 4.0));
    vec3 d = p - cameraPosition;
    float edge = max(max(abs(d.x) / B.x, abs(d.z) / B.z), abs(d.y) / B.y) * 2.0;
    alpha = 1.0 - smoothstep(0.75, 1.0, edge);
    size = aType < 1.5 ? 0.016 : 0.0012;
    vRot = 0.0; vSquash = 1.0;
  }
  vec4 vc = viewMatrix * vec4(p, 1.0);
  float z = -vc.z;
  if (z < 0.05 || alpha <= 0.001) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  // 滝の粒：崖の陰に入ると暗い（頂点で一度だけ影を引く）
  vShade = aType > 2.5 ? mix(0.5, 1.0, sunShadow(p, 0.7, vec2(0.0)) * cloudShadow(p)) : 1.0;
  float coc = abs(uFocus.y * (1.0 / uFocus.x - 1.0 / z));
  coc = min(coc, 70.0);
  float spx = size / z * uPxPerRad;
  // 小さすぎる粒は1画素ほどに（遠くでちらちら光る）
  float spxv = max(spx, 0.7);
  float R = spxv * 1.3 + coc + 1.0;
  vSize = spxv / R;
  vSoft = (coc + 0.7) / R;
  // 小さく見えるほど薄く（面積を保つ）
  vAlpha = alpha * min(1.0, spx / 0.7) * min(1.0, spxv * spxv / (spxv * spxv + coc * coc * 0.6) * 1.2);
  vQ = position.xy;
  vWorld = p;
  vViewZ = z;
  float rw = R / uPxPerRad * z;
  vec3 camR = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 camU = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  gl_Position = projectionMatrix * viewMatrix * vec4(p + (camR * position.x + camU * position.y) * rw, 1.0);
}
`;

const PFS = /* glsl */ `
${ALL}
${DEPTH_GLSL}
uniform sampler2D tDepth;
uniform vec2 uRes;
varying vec2 vQ;
varying float vType;
varying float vSize;
varying float vSoft;
varying float vAlpha;
varying float vRot;
varying float vSquash;
varying vec3 vWorld;
varying float vViewZ;
varying float vRnd;
varying float vShade;
void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  float d = texture(tDepth, uv).r;
  float sz = isSky(d) ? 1e6 : linearDepth(d);
  if (vViewZ > sz + 0.05) discard;
  vec2 q = vQ;
  float c = cos(vRot), s = sin(vRot);
  q = mat2(c, s, -s, c) * q;
  q.y /= max(abs(vSquash), 0.2);
  float r = length(q);
  float shape;
  vec3 alb;
  vec3 V = normalize(cameraPosition - vWorld);
  float fwd = pow(sat(dot(-V, uSunDir)), 6.0);
  vec3 col;
  if (vType < 0.5) {
    // 花びら：付け根が細く先が広い卵形で、先の真ん中に小さな切れ込み。付け根は濃い桃色、先は白に近い。
    // 日に透けると明るく色が濃くなる。裏返る途中（真横）は薄く暗い
    vec2 pq = q / vSize;
    float yy = pq.y * 0.5 + 0.5;                        // 0=付け根 1=先
    float halfW = mix(0.28, 0.92, smoothstep(0.0, 0.75, yy)) * (1.0 - 0.25 * smoothstep(0.8, 1.0, yy));
    float notch = smoothstep(0.22, 0.0, abs(pq.x)) * smoothstep(0.78, 0.98, yy) * 0.3;
    float e = max(abs(pq.x) / max(halfW, 0.05), abs(pq.y) * 1.0 + notch * 2.0);
    e = mix(e, length(pq * vec2(1.1, 1.0)), 0.35);
    shape = smoothstep(1.0 + vSoft / vSize * 0.9, 1.0 - vSoft / vSize * 0.9 - 0.06, e);
    vec3 tip = vec3(0.97, 0.9, 0.92), root = vec3(0.9, 0.58, 0.68);
    alb = mix(root, tip, smoothstep(0.1, 0.7, yy)) * mix(vec3(1.0), vec3(1.02, 0.96, 0.98), vRnd);
    float face = abs(vSquash);
    float lit = 0.55 + 0.45 * face;
    vec3 trans = vec3(1.0, 0.72, 0.8) * fwd * 2.2 * (0.4 + 0.6 * face);
    col = alb * (uSunCol * 0.6 * lit + shIrr(vec3(0.0, 1.0, 0.0)) * 0.85) + alb * uSunCol * trans;
  } else if (vType < 1.5) {
    // 綿毛：放射状の細い糸の傘（縁が明るい）と、真ん中の小さな種
    vec2 pq = q / vSize;
    float rr = length(pq);
    float ang = atan(pq.y, pq.x);
    float fib = pow(0.5 + 0.5 * sin(ang * 34.0 + vRnd * 6.0), 3.0);
    float rim = smoothstep(0.35, 0.95, rr);
    float seedD = smoothstep(0.2, 0.08, rr);
    float body = mix(0.18 + 0.55 * fib * (0.4 + 0.6 * rim), 0.75, sat(vSoft / vSize));
    shape = smoothstep(1.0 + vSoft / vSize, 1.0 - vSoft / vSize - 0.1, rr) * max(body, seedD * (1.0 - sat(vSoft / vSize)));
    alb = vec3(0.95, 0.95, 0.93);
    col = alb * (uSunCol * 0.5 + shIrr(vec3(0.0, 1.0, 0.0))) + alb * uSunCol * fwd * 3.0 * (0.4 + 0.6 * rim);
    col = mix(col, vec3(0.3, 0.22, 0.12) * (uSunCol * 0.5 + shIrr(vec3(0.0, 1.0, 0.0))), seedD * 0.8 * (1.0 - sat(vSoft / vSize)));
  } else if (vType < 2.5) {
    // 塵：逆光のときだけ光る
    float rr = r / vSize;
    shape = smoothstep(1.0 + vSoft / vSize, 1.0 - vSoft / vSize - 0.1, rr);
    col = vec3(1.0, 0.97, 0.9) * uSunCol * (0.05 + fwd * 3.5);
  } else if (vType > 4.5) {
    float rr = r / (vSize + vSoft);
    vec2 qq = q / (vSize + vSoft);
    float soft = sat(vSoft / (vSize + vSoft));
    float lump = texture(tNoise, qq * 0.55 + vec2(vRot, vRot * 0.7)).r;
    float lump2 = texture(tNoise, qq * 1.6 + vec2(vRot * 1.3, 0.4)).r;
    vec3 n3 = normalize(vec3(qq.x, qq.y, sqrt(max(0.05, 1.0 - dot(qq, qq)))));
    float lit = 0.5 + 0.5 * sat(dot(n3, normalize(vec3(uSunDir.x * 0.6, uSunDir.y + 0.3, 0.5))));
    if (vRnd < 0.25) {
      // しぶきの煙：縁のぼやけた淡い塊。中は筋と穴でむらがある。逆光で明るい
      shape = exp(-rr * rr * 2.2) * smoothstep(0.2, 0.75, lump + 0.35 - rr * 0.35) * (0.7 + 0.3 * lump2);
      float fw = pow(sat(dot(-V, uSunDir)), 3.0);
      col = vec3(0.9, 0.93, 0.96) * (uSunCol * (0.3 + 0.35 * lit + fw * 1.4) * vShade + shIrr(vec3(0.0, 1.0, 0.0)) * 0.95);
    } else {
      // わき立つ泡：もこもこの縁、中に小さな暗い隙間。上が明るく、水面に近い下の方は影で青みの灰
      shape = smoothstep(1.0, 0.32, rr + (lump - 0.5) * 0.8 + (lump2 - 0.5) * 0.35 * (1.0 - soft));
      shape *= mix(0.72 + 0.28 * smoothstep(0.35, 0.6, lump2), 1.0, soft);
      col = vec3(0.92, 0.95, 0.97) * (uSunCol * (0.35 + 0.55 * lit) * vShade + shIrr(vec3(0.0, 1.0, 0.0)) * (1.0 + 0.35 * qq.y)) * (0.84 + 0.22 * lump2);
      col *= mix(vec3(0.74, 0.8, 0.86), vec3(1.0), smoothstep(-0.9, 0.35, qq.y));
    }
  } else if (vType > 3.5) {
    // 水しぶきの粒：小さく明るい。逆光できらめく
    float rr = r / vSize;
    shape = smoothstep(1.0 + vSoft / vSize, 1.0 - vSoft / vSize - 0.1, rr);
    col = vec3(0.92, 0.95, 0.98) * (uSunCol * (0.55 + fwd * 3.0) * vShade + shIrr(vec3(0.0, 1.0, 0.0)) * 0.9);
  } else {
    // しぶき：やわらかい霧の玉。太陽を背にすると虹（主虹42°・副虹51°）
    float rr = r / (vSize + vSoft);
    shape = exp(-rr * rr * 3.2);
    float fw = pow(sat(dot(-V, uSunDir)), 3.0);
    col = vec3(0.9, 0.94, 0.97) * (uSunCol * (0.28 + fw * 1.6) * vShade + shIrr(vec3(0.0, 1.0, 0.0)) * 0.9);
    vec3 dv = normalize(vWorld - cameraPosition);
    float th = degrees(acos(clamp(dot(dv, -uSunDir), -1.0, 1.0)));
    vec3 bow = vec3(exp(-pow((th - 42.2) / 0.55, 2.0)), exp(-pow((th - 41.4) / 0.55, 2.0)), exp(-pow((th - 40.6) / 0.6, 2.0)));
    bow += 0.4 * vec3(exp(-pow((th - 52.2) / 0.8, 2.0)), exp(-pow((th - 51.3) / 0.8, 2.0)), exp(-pow((th - 50.5) / 0.8, 2.0)));
    col += bow * uSunCol * 1.1 * vShade;
  }
  float a = shape * vAlpha;
  if (a < 0.002) discard;
  float od = fogOptical(cameraPosition, -V, vViewZ);
  float T = exp(-od);
  gl_FragColor = vec4(col * a * T, a * T);
}
`;

export class Particles {
  constructor(shared, depthU, emitters, lite = false, mist = null, splash = null) {
    const counts = lite ? [2600, 260, 200, 160, 500, 220] : [6500, 520, 420, 420, 1400, 620];
    if (!mist) counts[3] = 0;
    if (!mist || !splash) counts[4] = counts[5] = 0;
    const n = counts.reduce((a, b) => a + b, 0);
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    const seed = new Float32Array(n * 4), type = new Float32Array(n);
    let k = 0;
    const rnd = (() => { let a = 12345; return () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; }; })();
    for (let t = 0; t < counts.length; t++) for (let i = 0; i < counts[t]; i++, k++) {
      seed.set([rnd(), rnd(), rnd(), rnd()], k * 4);
      type[k] = t;
    }
    g.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seed, 4));
    g.setAttribute('aType', new THREE.InstancedBufferAttribute(type, 1));
    g.instanceCount = n;
    const em = [];
    for (let i = 0; i < 40; i++) em.push(new THREE.Vector4(0, -1000, 0, 1));
    emitters.slice(0, 40).forEach((e, i) => em[i].set(e.x, e.y, e.z, e.r));
    this.uniforms = {
      ...shared, ...depthU,
      tDepth: { value: null }, uRes: { value: new THREE.Vector2() }, uFocus: { value: new THREE.Vector3(60, 70, 36) },
      uPxPerRad: { value: 1000 }, uEmit: { value: em }, uNumEmit: { value: Math.min(40, emitters.length) },
      uMist: { value: mist ? new THREE.Vector4(mist[0], mist[1], mist[2], 1) : new THREE.Vector4(0, -1000, 0, 0) },
      uSplash: { value: new THREE.Vector4(0, -1000, 0, 1) },
      uSplashDir: { value: new THREE.Vector4(1, 0, 0, 0) },
    };
    if (mist && splash) {
      // 滝から離れる向き（滝口→落ち口）と、落ち口の幕の半幅
      let fx = mist[0] - splash.lip[0], fz = mist[2] - splash.lip[2];
      const fl = Math.hypot(fx, fz) || 1; fx /= fl; fz /= fl;
      this.uniforms.uSplash.value.set(mist[0] + fx * 0.3, mist[1], mist[2] + fz * 0.3, splash.halfW);
      this.uniforms.uSplashDir.value.set(fx, fz, 0, 1);
    }
    this.mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms, vertexShader: PVS, fragmentShader: PFS,
      transparent: true, depthTest: false, depthWrite: false,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
      blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
    });
    this.mesh = new THREE.Mesh(g, this.mat);
    this.mesh.frustumCulled = false;
    this.scene = new THREE.Scene();
    this.scene.add(this.mesh);
  }
  render(renderer, camera, target, w, h, focus, depthTex) {
    this.uniforms.uRes.value.set(w, h);
    this.uniforms.uFocus.value.copy(focus);
    this.uniforms.tDepth.value = depthTex;
    this.uniforms.uPxPerRad.value = (h / 2) / Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    renderer.setRenderTarget(target);
    renderer.render(this.scene, camera);
  }
}
