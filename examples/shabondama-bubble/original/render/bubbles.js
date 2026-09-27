// しゃぼん玉の描画：画面に向けた四角に、球（揺れる楕円体）を画素ごとに解いて薄膜の干渉色を計算する
// 映り込み：毎フレーム焼く小さな環境図（カメラの位置から見た空・雲・丘・森・田の水）を、表面（凸面鏡）と裏面（内側の凹面）で映す
// 膜の厚さ：継ぎ目のない3D雑音の流れ（緯度ごとに回る帯＋渦）と重力の排水（上が薄く下が厚い）
// ボケは解析的に解く：本体は円盤の重なり、縁の輪は円と円盤の交わる弧、太陽の映り込み2点はボケ円盤（点々・放射状のすじが出ない）
import * as THREE from 'three';
import { ALL } from './glsl.js';
import { SKY_GLSL } from './sky.js';
import { DEPTH_GLSL, FS_VS } from './post.js';
import { CLOUD2D_GLSL } from './water.js';

// 薄膜の干渉：空気・石けん膜(n=1.33)・空気。9つの波長を線形sRGBへ
export const FILM_GLSL = /* glsl */ `
const float FILM_N = 1.33;
const vec3 WL_RGB[9] = vec3[9](
  vec3(0.0142, -0.0117, 0.0829), vec3(0.0638, -0.0781, 0.7198), vec3(-0.0785, 0.0679, 0.3171),
  vec3(-0.2313, 0.3789, 0.0009), vec3(-0.0340, 0.4985, -0.0644), vec3(0.5131, 0.2042, -0.0429),
  vec3(0.5898, -0.0435, -0.0109), vec3(0.1533, -0.0171, -0.0020), vec3(0.0095, 0.0009, -0.0004));
const float WL[9] = float[9](410.0, 445.0, 480.0, 515.0, 550.0, 585.0, 620.0, 655.0, 690.0);
vec3 filmReflectance(float cosI, float dnm) {
  float sinI2 = 1.0 - cosI * cosI;
  float cosT = sqrt(max(1.0 - sinI2 / (FILM_N * FILM_N), 0.0));
  // 一つの境界の振幅反射率（sとpの平均の近似）
  float rs = (cosI - FILM_N * cosT) / (cosI + FILM_N * cosT);
  float rp = (FILM_N * cosI - cosT) / (FILM_N * cosI + cosT);
  float r2 = 0.5 * (rs * rs + rp * rp);
  vec3 acc = vec3(0.0);
  for (int i = 0; i < 9; i++) {
    float delta = 4.0 * 3.14159265 * FILM_N * dnm * cosT / WL[i];
    float c = cos(delta);
    float R = 2.0 * r2 * (1.0 - c) / (1.0 + r2 * r2 - 2.0 * r2 * c);
    acc += WL_RGB[i] * R;
  }
  return max(acc, 0.0);
}
`;

// 膜の厚さ(nm)。n=泡の中心から見た向き（-yが重力の下）、base=厚さの基準、age=寿命の進み、detail=細かい渦の強さ（ボケると0）
export const FILMD_GLSL = /* glsl */ `
uniform highp sampler3D tFilm3;
float filmD(vec3 n, float base, float age, float seed, float detail) {
  float t = uTime;
  // 緯度ごとに違う速さで回る流れ：横に伸びた帯と、帯の境の渦
  float ang = t * (0.22 + 0.3 * sin(n.y * 3.3 + seed)) + seed * 2.3;
  float cs = cos(ang), sn = sin(ang);
  vec3 p = vec3(cs * n.x - sn * n.z, n.y, sn * n.x + cs * n.z);
  vec3 o = fract(vec3(seed * 0.37, seed * 0.11, seed * 0.23));
  // ゆっくり渦を巻くゆがみ（2段）
  vec3 w = texture(tFilm3, p * 0.28 + o + vec3(0.0, t * 0.016, 0.0)).xyz - 0.5;
  vec3 q = p + w * 1.5;
  w = texture(tFilm3, q * 0.5 + o.yzx - vec3(0.0, t * 0.03, 0.0)).xyz - 0.5;
  q += w * 0.5 * detail;
  // 横に長い帯（縦に細かい）
  float f1 = texture(tFilm3, vec3(q.x * 0.2, q.y * 0.42 - t * 0.01, q.z * 0.2) + o).w;
  // 細かい渦（ボケると消す）
  float f2 = texture(tFilm3, q * 0.62 + o.zxy + vec3(0.0, -t * 0.025, 0.0)).y - 0.5;
  float f = (f1 - 0.5) * 1.5 + f2 * 0.7 * detail;
  // 重力で下へ流れる：上が薄く下が厚い。年を取るほど上が薄くなる
  float down = 0.5 - 0.5 * n.y;
  down = down * down * (3.0 - 2.0 * down);
  float prof = mix(mix(0.62, 0.22, age), 1.7, down);
  float d = base * prof * (1.0 + 0.6 * f);
  // 下の縁から薄い膜が細く立ちのぼる（縁の再生）
  d *= 1.0 - 0.35 * smoothstep(0.62, 0.8, f2 + 0.5) * detail * (1.0 - down * 0.5);
  // 寿命の終わり：上から黒い膜（極薄）が広がる
  float bk = smoothstep(0.78, 1.0, age);
  float thr = 1.03 - bk * 0.75;
  d *= 1.0 - 0.94 * smoothstep(thr, thr + 0.12, n.y + f * 0.06);
  return max(d, 6.0);
}
`;

// 環境図：カメラの位置から全方向を見た色（正距円筒・縦は sin(緯度)）。地形の高さと森の高さをたどり、当たれば丘・森・田の水、外れれば空と雲
const ENV_FS = /* glsl */ `
${ALL}
${SKY_GLSL}
${CLOUD2D_GLSL}
uniform sampler2D tType;
uniform vec3 uEye;
varying vec2 vUv;
float surfH(vec2 p, out float g, out float wl, out float cano) {
  g = heightAt(p);
  ivec2 tt = worldTexel(p);
  wl = texelFetch(tHW, tt, 0).g;
  cano = texelFetch(tType, tt, 0).z * 12.0;
  return max(max(g + cano, wl), g);
}
void main() {
  float ph = (vUv.x - 0.5) * 6.2831853;
  float y = vUv.y * 2.0 - 1.0;
  float rxz = sqrt(max(1.0 - y * y, 0.0));
  vec3 d = vec3(sin(ph) * rxz, y, cos(ph) * rxz);
  vec3 ro = uEye;
  vec3 sky = skyRadiance(d);
  vec4 cl = cloud2D(ro, d);
  sky = sky * cl.a + cl.rgb;
  float mu = max(dot(d, uSunDir), 0.0);
  // 太陽のまわりの照り（円盤そのものは泡の側で点として描く）
  sky += uSunCol * (0.8 * pow(mu, 900.0) + 0.2 * pow(mu, 90.0));
  vec3 col = sky;
  if (d.y < 0.42) {
    float lim = -uWorld.x - 2.0;
    float t = 0.2, pt = 0.0, hitT = -1.0;
    float g, wl, cano;
    for (int i = 0; i < 64; i++) {
      vec3 q = ro + d * t;
      if (q.y > 420.0 || abs(q.x) > lim || abs(q.z) > lim) break;
      if (q.y < surfH(q.xz, g, wl, cano)) {
        float a = pt, b = t;
        for (int j = 0; j < 5; j++) {
          float m = 0.5 * (a + b);
          vec3 qm = ro + d * m;
          if (qm.y < surfH(qm.xz, g, wl, cano)) b = m; else a = m;
        }
        hitT = b;
        break;
      }
      pt = t;
      t = t * 1.09 + 0.2;
    }
    if (hitT > 0.0) {
      vec3 q = ro + d * hitT;
      surfH(q.xz, g, wl, cano);
      float e = uWorld.y;
      vec3 gn = normalize(vec3(heightAt(q.xz - vec2(e, 0.0)) - heightAt(q.xz + vec2(e, 0.0)), 2.0 * e, heightAt(q.xz - vec2(0.0, e)) - heightAt(q.xz + vec2(0.0, e))));
      float nq = texture(tNoise, q.xz / 23.0).r, nq2 = texture(tNoise, q.xz / 97.0).g;
      vec3 lit;
      if (wl > g + 0.02 && q.y <= wl + 0.05 && wl > -1000.0) {
        // 水面：空を映す（田の水は少し濁る）
        vec3 R = reflect(d, vec3(0.0, 1.0, 0.0));
        vec3 s = skyRadiance(R);
        vec4 c2 = cloud2D(q, R);
        s = s * c2.a + c2.rgb;
        float F = 0.02 + 0.98 * pow(1.0 - abs(d.y), 5.0);
        lit = mix(vec3(0.03, 0.045, 0.035) * shIrr(vec3(0.0, 1.0, 0.0)), s, max(F, 0.3));
      } else if (cano > 0.5 && q.y > g + 0.8) {
        // 森：こんもりした樹冠
        vec3 nrm = normalize(vec3(-d.x, 1.3, -d.z) + (texture(tNoise, q.xz / 7.0).rgb - 0.5) * 0.8);
        vec3 alb = mix(vec3(0.045, 0.08, 0.032), vec3(0.1, 0.14, 0.05), nq);
        lit = alb * (uSunCol * max(dot(nrm, uSunDir), 0.0) * cloudShadow(q) * 0.85 + shIrr(nrm) * 0.9);
      } else {
        // 草地・畦・土
        vec3 alb = mix(vec3(0.12, 0.16, 0.055), vec3(0.2, 0.23, 0.085), nq);
        alb = mix(alb, vec3(0.2, 0.17, 0.12), smoothstep(0.6, 0.8, nq2) * 0.45);
        lit = alb * (uSunCol * max(dot(gn, uSunDir), 0.0) * cloudShadow(q) + shIrr(gn));
      }
      col = applyFog(lit, ro, q);
    } else if (d.y < 0.08) {
      // 地図の外：遠い山の稜線を霞の中に
      float sk = 0.012 + 0.03 * texture(tNoise, vec2(ph * 0.6, 0.3)).g + 0.012 * texture(tNoise, vec2(ph * 2.3, 0.7)).r;
      float m = smoothstep(sk + 0.004, sk - 0.004, d.y);
      vec3 hill = mix(vec3(0.05, 0.08, 0.05) * (shIrr(vec3(0.0, 1.0, 0.0)) + uSunCol * 0.4), fogColor(d), 0.62);
      col = mix(sky, hill, m);
      col = mix(col, envRadiance(d), smoothstep(-0.02, -0.12, d.y));
    }
  }
  gl_FragColor = vec4(col, 1.0);
}
`;

const BUB_VS = /* glsl */ `
${ALL}
${FILM_GLSL}
${FILMD_GLSL}
attribute vec4 iPos;     // xyz=中心 w=半径
attribute vec4 iData;    // x=揺れの位相 y=膜の厚さの基準(nm) z=寿命の進み(0..1) w=見える強さ(0..1)
uniform vec3 uFocus;
uniform vec2 uRes;
uniform float uPxPerRad;
uniform float uBoost;
varying vec4 vPos;
varying vec4 vData;
varying float vCoc;
varying vec2 vCenterPx;
varying vec3 vSc;
varying float vNear;     // レンズのすぐ前まで来た泡は、ボケて薄れる
varying vec4 vG0, vG1;   // 太陽の映り込み（表面・裏面）の画面位置
varying vec3 vGc0, vGc1; // その色
vec2 toPx(vec3 wp) { vec4 c = projectionMatrix * viewMatrix * vec4(wp, 1.0); return (c.xy / max(c.w, 1e-4) * 0.5 + 0.5) * uRes; }
vec3 boostR(vec3 R) { return min(R * uBoost / (1.0 + (uBoost - 1.0) * R), vec3(0.97)); }
// 割れる穴（BUB_FS の hole と同じ）
float holeV(vec3 nl) {
  if (iData.w >= 0.999) return 1.0;
  vec3 hc = normalize(vec3(sin(iData.x * 7.1), cos(iData.x * 3.3), sin(iData.x * 5.7 + 1.0)) + 1e-4);
  float edge = cos(min((1.0 - iData.w) * 1.2, 1.0) * 3.14159);
  return smoothstep(edge + 0.02, edge - 0.1, dot(nl, hc));
}
void main() {
  vPos = iPos;
  vData = iData;
  vec3 C = iPos.xyz;
  float R = iPos.w;
  vec4 vc = viewMatrix * vec4(C, 1.0);
  float z = -vc.z;
  float dist = length(cameraPosition - C);
  // 中にいる泡は描かない（泡の視点の膜が受け持つ）
  if (z < R * 0.3 + 0.02 || iData.w <= 0.001 || dist < R * 1.06) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  float coc = abs(uFocus.y * (1.0 / uFocus.x - 1.0 / z));
  coc = min(coc, 90.0);
  vCoc = coc;
  vNear = mix(0.06, 1.0, smoothstep(1.1, 8.0, dist / R));
  vCenterPx = toPx(C);
  // 揺れ：吹いた直後は大きく、だんだん落ち着く
  float ph = iData.x;
  float amp = 0.01 + 0.045 * exp(-iData.z * 30.0);
  vec3 sc = 1.0 + amp * vec3(sin(uTime * 3.1 + ph), sin(uTime * 2.3 + ph * 1.7), sin(uTime * 2.7 + ph * 0.6));
  sc /= pow(sc.x * sc.y * sc.z, 1.0 / 3.0);
  vSc = sc;
  // 画面上の半径（近いときの遠近も含む）＋ボケ
  float rpx = R / sqrt(max(dist * dist - R * R, 1e-8)) * uPxPerRad * (dist / z);
  float ext = rpx * 1.14 + coc + 3.0;
  vec4 cc = projectionMatrix * vc;
  gl_Position = vec4(cc.xy / cc.w + position.xy * ext / uRes * 2.0, 0.0, 1.0);
  // 太陽の映り込み：表面（凸面鏡）は太陽と視線の二等分の向き、裏面（内側の凹面）はその反対側
  vG0 = vec4(-1e5); vG1 = vec4(-1e5); vGc0 = vec3(0.0); vGc1 = vec3(0.0);
  vec3 V = (cameraPosition - C) / dist;
  vec3 H = V + uSunDir;
  float hl = length(H);
  if (hl > 1e-3 && uSunDir.y > -0.02) {
    vec3 m = H / hl;
    float cI = clamp(dot(m, V), 0.02, 1.0);
    vec3 Rf = boostR(filmReflectance(cI, filmD(m, iData.y, iData.z, ph, 1.0)));
    vec3 Rb = boostR(filmReflectance(cI, filmD(-m, iData.y, iData.z, ph, 1.0)));
    vG0 = vec4(toPx(C + m * R * sc), 1.0, 0.0);
    vG1 = vec4(toPx(C - m * R * sc), 1.0, 0.0);
    // 色は膜の反射率を太陽の色の方へ5割寄せる（濃い色の点にしない）
    vec3 Rfg = mix(Rf, vec3(dot(Rf, vec3(0.3333))), 0.5), Rbg = mix(Rb, vec3(dot(Rb, vec3(0.3333))), 0.5);
    vGc0 = Rfg * uSunCol * holeV(m);
    vGc1 = Rbg * uSunCol * (1.0 - dot(Rf, vec3(0.3333))) * holeV(-m);
  }
}
`;

const BUB_FS = /* glsl */ `
${ALL}
${DEPTH_GLSL}
${FILM_GLSL}
${FILMD_GLSL}
uniform sampler2D tDepth;
uniform sampler2D tEnvB;
uniform mat4 uPV;
uniform vec2 uRes;
uniform float uBoost;
uniform float uGlint;
varying vec4 vPos;
varying vec4 vData;
varying float vCoc;
varying vec2 vCenterPx;
varying vec3 vSc;
varying float vNear;
varying vec4 vG0, vG1;
varying vec3 vGc0, vGc1;

vec3 envB(vec3 d, float lod) {
  vec2 uv = vec2(atan(d.x, d.z + 1e-7) * 0.15915494 + 0.5, clamp(d.y * 0.5 + 0.5, 0.002, 0.998));
  return textureLod(tEnvB, uv, lod).rgb;
}
// 画面で小さい泡ほど膜を少し強める（数m先の連れの泡が景色に溶けて消えないように）。main() で決める
float gK = 2.6;
vec3 boostR(vec3 R) { return min(R * gK / (1.0 + (gK - 1.0) * R), vec3(0.97)); }
// 割れる瞬間：膜に穴が開いて広がる
float hole(vec3 nl) {
  if (vData.w >= 0.999) return 1.0;
  float pr = 1.0 - vData.w;
  vec3 hc = normalize(vec3(sin(vData.x * 7.1), cos(vData.x * 3.3), sin(vData.x * 5.7 + 1.0)) + 1e-4);
  float edge = cos(min(pr * 1.2, 1.0) * 3.14159);
  return smoothstep(edge + 0.02, edge - 0.1, dot(nl, hc));
}
// 膜の1点：nl=厚さの向き、n=法線、inner=裏面（内側から映す）。色は前掛け済み、aは反射率の平均
vec4 surf(vec3 nl, vec3 n, vec3 rd, bool inner, float lod, float detail) {
  float cosI = clamp(abs(dot(n, rd)), 0.02, 1.0);
  vec3 Rf = boostR(filmReflectance(cosI, filmD(nl, vData.y, vData.z, vData.x, detail)));
  vec3 rr = reflect(rd, inner ? -n : n);
  vec3 L = envB(rr, lod);
  return vec4(Rf * L, dot(Rf, vec3(0.3333)));
}
// 本体：1本の視線で楕円体の表と裏を解く
vec4 body(vec3 ro, vec3 rd, float sceneZ, float lod, float detail) {
  vec3 C = vPos.xyz;
  float R = vPos.w;
  vec3 s = vSc * R;
  vec3 o = (ro - C) / s;
  vec3 d = rd / s;
  float a = dot(d, d), b = dot(o, d), cc = dot(o, o) - 1.0;
  float disc = b * b - a * cc;
  if (disc <= 0.0) return vec4(0.0);
  float sq = sqrt(disc);
  float tA = (-b - sq) / a, tB = (-b + sq) / a;
  vec3 fwd = -uViewInv[2].xyz;
  vec4 outc = vec4(0.0);
  float T = 1.0;
  for (int k = 0; k < 2; k++) {
    float t = k == 0 ? tA : tB;
    if (t <= 0.0) continue;
    vec3 p = ro + rd * t;
    if (dot(p - ro, fwd) > sceneZ + 0.02) continue;
    vec3 nl = (p - C) / s;
    vec3 n = normalize(nl / vSc);
    nl = normalize(nl);
    vec4 sv = surf(nl, n, rd, k == 1, lod, detail) * hole(nl);
    outc.rgb += T * sv.rgb;
    outc.a += T * sv.a;
    T *= 1.0 - sv.a;
  }
  return outc;
}
// 縁（輪郭のすぐ内側）の色：表と裏がほぼ重なる。cosR=視線と法線のなす角の余弦
vec4 rimAt(vec3 uw, vec3 ro, float lod, float detail) {
  vec3 C = vPos.xyz;
  vec3 V = normalize(ro - C);
  vec3 ns = normalize(uw - V * dot(uw, V) + 1e-5);
  const float cR = 0.2;
  float sR = sqrt(1.0 - cR * cR);
  vec3 nf = ns * sR + V * cR, nb = ns * sR - V * cR;
  vec3 rdf = normalize(C + nf * vPos.w - ro), rdb = normalize(C + nb * vPos.w - ro);
  vec4 f = surf(nf, nf, rdf, false, lod, detail) * hole(nf);
  vec4 b = surf(nb, nb, rdb, true, lod, detail) * hole(nb);
  return vec4(f.rgb + (1.0 - f.a) * b.rgb, 1.0 - (1.0 - f.a) * (1.0 - b.a));
}
// 画面上の輪郭の半径（画素の向き u2 について）：輪郭の点を実際に投影する
float silPx(vec3 uw, vec3 ro) {
  vec3 C = vPos.xyz;
  vec3 V = ro - C;
  float dist = length(V);
  V /= dist;
  vec3 ns = normalize(uw - V * dot(uw, V) + 1e-5);
  float k = min(vPos.w / dist, 0.999);
  float Re = vPos.w * sqrt(dot(vSc * vSc, ns * ns));
  vec4 c = uPV * vec4(C + (ns * sqrt(1.0 - k * k) + V * k) * Re, 1.0);
  return length((c.xy / max(c.w, 1e-4) * 0.5 + 0.5) * uRes - vCenterPx);
}
// 二つの円の重なりの面積
float lensArea(float d, float r1, float r2) {
  if (d >= r1 + r2) return 0.0;
  float rm = min(r1, r2);
  if (d <= abs(r1 - r2)) return PI * rm * rm;
  float a = r1 * r1 * acos(clamp((d * d + r1 * r1 - r2 * r2) / (2.0 * d * r1), -1.0, 1.0));
  float b = r2 * r2 * acos(clamp((d * d + r2 * r2 - r1 * r1) / (2.0 * d * r2), -1.0, 1.0));
  float c = 0.5 * sqrt(max((-d + r1 + r2) * (d + r1 - r2) * (d - r1 + r2) * (d + r1 + r2), 0.0));
  return max(a + b - c, 0.0);
}
// 半径Rの円のうち、距離ρにある半径cの円盤に入る弧の半角
float arcHalf(float rho, float R, float c) {
  if (rho < 1e-3) return R < c ? PI : 0.0;
  float x = (rho * rho + R * R - c * c) / (2.0 * rho * R);
  return acos(clamp(x, -1.0, 1.0));
}
// 太陽の映り込み：ピントが合えば小さな光の点、ボケると円盤（明るすぎて頭打ちになる分、ボケても消えすぎない）
vec3 glint(vec4 g, vec3 gc, vec2 frag, float ce, float Rp) {
  float g0 = max(1.1, Rp * 0.022);
  float r2 = ce * ce + g0 * g0;
  float rr = sqrt(r2);
  float d = distance(frag, g.xy);
  float disc = 1.0 - smoothstep(rr - 0.8, rr + 0.8, d);
  // ボケ円盤の縁が少し明るい（玉ボケ）
  disc *= 0.85 + 0.3 * smoothstep(rr * 0.5, rr, d) * step(3.0, rr);
  // 大きくボケるほど光は広がって薄まる
  // レンズのすぐ前でひどくボケた泡の光は、面積どおりに薄める（乳白の円盤にしない）
  float kc = smoothstep(20.0, 70.0, ce);
  return gc * disc * uGlint * pow(g0 * g0 / r2, mix(0.75, 1.0, kc)) / (1.0 + ce * ce / mix(1600.0, 800.0, kc));
}
void main() {
  vec2 frag = gl_FragCoord.xy;
  vec2 uv = frag / uRes;
  float dr = texture(tDepth, uv).r;
  float sceneZ = isSky(dr) ? 1e6 : linearDepth(dr);
  vec3 ro = cameraPosition;
  vec3 camR = uViewInv[0].xyz, camU = uViewInv[1].xyz, fwd = -uViewInv[2].xyz;
  float ce = max(vCoc, 0.85);
  vec2 d2 = frag - vCenterPx;
  float rho = length(d2);
  vec2 u2 = rho > 1e-3 ? d2 / rho : vec2(1.0, 0.0);
  vec3 uw = camR * u2.x + camU * u2.y;
  float Rp = max(silPx(uw, ro), 0.5);
  float w = max(Rp * mix(0.07, 0.045, smoothstep(20.0, 90.0, Rp)), 0.9);
  gK = uBoost * mix(2.4, 1.0, smoothstep(20.0, 90.0, Rp));
  float blurK = vCoc / (Rp + vCoc);
  // 大写しの泡は環境図の粗い段を読む（高さの地図の角ばった稜線をなじませる）
  float lod = clamp(log2(1.0 + vCoc * 0.35) + 0.8 * smoothstep(50.0, 220.0, Rp), 0.0, 4.5);
  float detail = 1.0 - smoothstep(0.03, 0.22, vCoc / Rp);
  vec4 acc = vec4(0.0);
  float aRaw = 0.0;
  float kc = smoothstep(20.0, 70.0, vCoc);  // 泡の大きさによらず、ボケの絶対量  // 背景を弱める量（見えやすくする強め方は足す光だけにかけ、ここには通さない）
  // 本体：画素のボケ円盤が泡の円に重なる割合（輪郭が解析的にボケる）
  float covB = lensArea(rho, ce, Rp) / (PI * ce * ce);
  if (covB > 1e-4) {
    // 画素の向きの膜を拾う（縁ほど明るいフレネルを残す）。ボケが泡より大きいときだけ中心寄りの平均へ
    float rs = min(rho * (1.0 - 0.85 * smoothstep(0.45, 0.9, blurK)), max(Rp - w, 0.0));
    vec4 bd = body(ro, viewRay((vCenterPx + u2 * rs) / uRes), sceneZ, lod, detail);
    // ボケると膜のあちこちの色が混ざって白っぽくなる
    bd.rgb = mix(vec3(dot(bd.rgb, vec3(0.3333))), bd.rgb, 1.0 - 0.2 * smoothstep(0.1, 0.5, blurK));
    // レンズのすぐ前の大きな泡：映り込みはボケて一様にならされるので、面の光は弱く
    acc.rgb += bd.rgb * covB * mix(1.0, 0.4, kc);
    aRaw += bd.a * covB;
  }
  float zc = dot(vPos.xyz - ro, fwd);
  if (zc - vPos.w <= sceneZ + 0.05) {
    // 縁の輪：輪の上の弧のうちボケ円盤に入る長さ
    float R0 = max(Rp - w * 0.5, 0.5);
    float cr = sqrt(ce * ce + 0.25 * w * w);
    float al = arcHalf(rho, R0, cr);
    if (al > 0.0) {
      float dens = al * R0 * 2.0 * w / (PI * cr * cr);
      float th = atan(u2.y, u2.x);
      int K = al < 0.3 ? 1 : (al < 1.0 ? 3 : (al < 2.0 ? 5 : 8));
      vec4 a = vec4(0.0);
      for (int k = 0; k < 8; k++) {
        if (k >= K) break;
        float s = K == 1 ? 0.0 : ((float(k) + 0.5) / float(K) * 2.0 - 1.0) * 0.92;
        float tk = th + al * s;
        a += rimAt(camR * cos(tk) + camU * sin(tk), ro, lod, detail);
      }
      a /= float(K);
      // ボケると縁の上側に映る明るい空が輪のまわりに広がる
      // 大きくボケると縁のあちこちの色が混ざる（抜けるのは最大25%。輪の干渉色は残す）
      float la = dot(a.rgb, vec3(0.3333));
      a.rgb = mix(vec3(la), a.rgb, 1.0 - 0.25 * smoothstep(0.15, 0.6, blurK));
      // ボケた輪は干渉色を少し濃く（細い虹色の輪として見えるように）
      a.rgb = max(vec3(la) + (a.rgb - vec3(la)) * (1.0 + 0.8 * smoothstep(0.2, 0.6, blurK)), 0.0);
      aRaw += a.a * dens * 0.62;
      // ボケた泡は縁の輪が見えるように強める（写真の玉ボケの縁の明るさ）。足す光だけ
      acc.rgb += a.rgb * dens * 0.62 * (1.0 + 60.0 * blurK * blurK * blurK * (1.0 - blurK));
    }
  }
  // 大きくボケた泡はレンズの玉ボケの形に：中は澄んで、縁に細い明るい輪
  float kb = smoothstep(0.3, 0.65, blurK);
  float rr = rho / (Rp + ce);
  acc.rgb *= mix(1.0, mix(0.05, 3.0, smoothstep(0.8, 0.97, rr)), kb);
  // 背景を弱める量はボケるほど頭打ち（乳白の円盤にしない）
  acc.a = min(aRaw, mix(1.0, 0.1, max(smoothstep(0.2, 0.6, blurK), kc)));
  // ボケた泡の玉ボケの縁：細い明るい虹色の輪（写真のしゃぼん玉の玉ボケ）。色はその向きの縁の膜の色
  float kr = max(smoothstep(0.18, 0.5, blurK), 0.7 * kc);
  if (kr > 0.0 && zc - vPos.w <= sceneZ + 0.05) {
    float Rt = Rp + ce * 0.88;
    float wr = max(1.1, 0.04 * Rt);
    float xr = (rho - Rt) / wr;
    float ring = exp(-xr * xr);
    if (ring > 0.004) {
      vec4 rc = rimAt(uw, ro, lod + 1.0, detail);
      float lr = dot(rc.rgb, vec3(0.3333));
      rc.rgb = max(vec3(lr) + (rc.rgb - vec3(lr)) * 1.6, 0.0);
      // 大きな玉ボケほど光が広がって薄い
      float gr = kr * pow(clamp(28.0 / Rt, 0.08, 1.0), 0.85);
      acc.rgb += rc.rgb * ring * gr * 0.9;
      acc.a += min(rc.a, 1.0) * ring * gr * 0.06;
    }
  }
  if (zc - vPos.w <= sceneZ + 0.05) {
    // 太陽の映り込み
    acc.rgb += glint(vG0, vGc0, frag, ce, Rp) + glint(vG1, vGc1, frag, ce, Rp);
  }
  acc *= smoothstep(0.0, 0.4, vData.w) * vNear;
  // 霞
  float dist = distance(ro, vPos.xyz);
  float T = exp(-fogOptical(ro, normalize(vPos.xyz - ro), dist));
  acc *= T;
  if (any(isnan(acc)) || any(isinf(acc))) discard;  // 1画素のNaNもにじみで黒い塊になる
  acc = clamp(acc, 0.0, 60.0);
  if (acc.a < 0.0004 && dot(acc.rgb, vec3(1.0)) < 0.0004) discard;
  gl_FragColor = acc;
}
`;

// 膜の厚さの3D雑音（32^3・継ぎ目なし）。r,g,b=ゆがみ用、a=帯用（大きな塊）
export function buildFilmNoise3D(S = 32) {
  const hash = (x, y, z, s) => { let h = (x * 374761393 + y * 668265263 + z * 1440662683 + s * 2246822519) >>> 0; h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  const vn = (x, y, z, P, s) => {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    const fx = x - xi, fy = y - yi, fz = z - zi;
    const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), w = fz * fz * (3 - 2 * fz);
    const m = (a) => ((a % P) + P) % P;
    const X0 = m(xi), X1 = m(xi + 1), Y0 = m(yi), Y1 = m(yi + 1), Z0 = m(zi), Z1 = m(zi + 1);
    const l = (a, b, t) => a + (b - a) * t;
    return l(l(l(hash(X0, Y0, Z0, s), hash(X1, Y0, Z0, s), u), l(hash(X0, Y1, Z0, s), hash(X1, Y1, Z0, s), u), v),
      l(l(hash(X0, Y0, Z1, s), hash(X1, Y0, Z1, s), u), l(hash(X0, Y1, Z1, s), hash(X1, Y1, Z1, s), u), v), w);
  };
  const fbm = (x, y, z, P, s) => (vn(x, y, z, P, s) * 0.68 + vn(x * 2, y * 2, z * 2, P * 2, s + 1) * 0.32);
  const n = S * S * S;
  const ch = [new Float32Array(n), new Float32Array(n), new Float32Array(n), new Float32Array(n)];
  for (let z = 0, k = 0; z < S; z++) for (let y = 0; y < S; y++) for (let x = 0; x < S; x++, k++) {
    ch[0][k] = fbm(x / 8, y / 8, z / 8, 4, 1);
    ch[1][k] = fbm(x / 8, y / 8, z / 8, 4, 5);
    ch[2][k] = fbm(x / 8, y / 8, z / 8, 4, 9);
    ch[3][k] = fbm(x / 8, y / 8, z / 8, 4, 13);
  }
  // 値の幅を0..1へ広げる（雑音の和は真ん中に寄るため）
  const d = new Uint8Array(n * 4);
  ch.forEach((a, c) => {
    let lo = 1, hi = 0;
    for (let i = 0; i < n; i++) { lo = Math.min(lo, a[i]); hi = Math.max(hi, a[i]); }
    for (let i = 0; i < n; i++) d[i * 4 + c] = Math.round((a[i] - lo) / (hi - lo) * 255);
  });
  const t = new THREE.Data3DTexture(d, S, S, S);
  t.format = THREE.RGBAFormat; t.type = THREE.UnsignedByteType;
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearFilter;
  t.wrapS = t.wrapT = t.wrapR = THREE.RepeatWrapping;
  t.unpackAlignment = 1;
  t.needsUpdate = true;
  return t;
}

export class BubbleRenderer {
  constructor(shared, depthU, max = 32, tType = null) {
    this.max = max;
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    this.iPos = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4);
    this.iData = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4);
    this.iPos.setUsage(THREE.DynamicDrawUsage); this.iData.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('iPos', this.iPos);
    g.setAttribute('iData', this.iData);
    g.instanceCount = 0;
    // three.js は物を作るたびに Math.random で名札を作る。乱数の種で決まる進行（風・生きもの・書き出しの台本）を変えないよう、
    // 新しく足した物（環境図・膜の雑音）だけ別の乱数で作る
    const rnd = Math.random;
    let sd = 12345;
    Math.random = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
    try { this.buildEnv(shared, tType); } finally { Math.random = rnd; }

    this.uniforms = {
      ...shared, ...depthU, tDepth: { value: null }, tEnvB: this.envU, tFilm3: this.filmU, uPV: { value: new THREE.Matrix4() },
      uRes: { value: new THREE.Vector2() }, uFocus: { value: new THREE.Vector3(60, 70, 36) }, uPxPerRad: { value: 1000 },
      uBoost: { value: 2.6 }, uGlint: { value: 26 },
    };
    this.mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms, vertexShader: BUB_VS, fragmentShader: BUB_FS,
      transparent: true, depthTest: false, depthWrite: false,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
      blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
    });
    this.mesh = new THREE.Mesh(g, this.mat);
    this.mesh.frustumCulled = false;
    this.scene = new THREE.Scene();
    this.scene.add(this.mesh);
    this.geo = g;
    this.frameNo = 0;
  }
  // 環境図（泡の映り込み・泡の視点の膜で共用）と膜の3D雑音
  buildEnv(shared, tType) {
    this.envRT = new THREE.WebGLRenderTarget(256, 128, {
      type: THREE.HalfFloatType, depthBuffer: false, generateMipmaps: true,
      minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter, wrapS: THREE.RepeatWrapping, wrapT: THREE.ClampToEdgeWrapping,
    });
    this.envU = { value: this.envRT.texture };
    this.filmU = { value: buildFilmNoise3D() };
    if (!tType) { tType = new THREE.DataTexture(new Uint8Array(4), 1, 1); tType.needsUpdate = true; }
    this.envMat = new THREE.ShaderMaterial({
      uniforms: { ...shared, tType: { value: tType }, uEye: { value: new THREE.Vector3() } },
      vertexShader: FS_VS, fragmentShader: ENV_FS, depthTest: false, depthWrite: false,
    });
    const quad = new THREE.Mesh(new THREE.BufferGeometry(), this.envMat);
    quad.geometry.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    quad.frustumCulled = false;
    this.envScene = new THREE.Scene();
    this.envScene.add(quad);
    this.envCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  }
  // 泡の視点の膜（post.js の povFilm）へ環境図と膜の雑音を渡す
  attachPov(mat) {
    mat.uniforms.tEnvB = this.envU;
    mat.uniforms.tFilm3 = this.filmU;
    this.povU = mat.uniforms;
  }
  // 環境図を焼く（毎フレーム呼ぶ。カメラが大きく動かなければ1コマおき）
  probe(renderer, camera) {
    // 泡がひとつもなく、泡の視点の膜も見えないときは焼かない（泡が現れたコマは render() の前に焼く）
    const pu = this.povU;
    if (!this.geo.instanceCount && pu && pu.uFilm.value <= 0.001 && pu.uFlash.value <= 0.001 && pu.uPop.value < 0) {
      this.envStale = true;
      return;
    }
    this.envStale = false;
    const e = this.envMat.uniforms.uEye.value;
    const moved = e.distanceToSquared(camera.position) > 4;
    if (!moved && this.frameNo++ % 2 === 1) return;
    e.copy(camera.position);
    renderer.setRenderTarget(this.envRT);
    renderer.render(this.envScene, this.envCam);
  }
  // list: [{x,y,z,r,phase,film,age,vis}]
  update(list, camera, w, h, focus, depthTex) {
    const cp = camera.position;
    // 中にいる泡は外して、遠い順に描く
    const d2 = (b) => (b.x - cp.x) ** 2 + (b.y - cp.y) ** 2 + (b.z - cp.z) ** 2;
    const sorted = list.filter((b) => d2(b) > (b.r * 1.06) ** 2).slice(0, this.max).sort((a, b) => d2(b) - d2(a));
    sorted.forEach((b, i) => {
      this.iPos.array.set([b.x, b.y, b.z, b.r], i * 4);
      this.iData.array.set([b.phase, b.film, b.age, b.vis], i * 4);
    });
    this.geo.instanceCount = sorted.length;
    this.iPos.needsUpdate = true; this.iData.needsUpdate = true;
    this.uniforms.uRes.value.set(w, h);
    this.uniforms.uFocus.value.copy(focus);
    this.uniforms.tDepth.value = depthTex;
    this.uniforms.uPxPerRad.value = (h / 2) / Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    this.uniforms.uPV.value.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  }
  render(renderer, camera, target) {
    if (!this.geo.instanceCount) return;
    if (this.envStale) {
      this.envStale = false;
      this.envMat.uniforms.uEye.value.copy(camera.position);
      renderer.setRenderTarget(this.envRT);
      renderer.render(this.envScene, this.envCam);
    }
    renderer.setRenderTarget(target);
    renderer.render(this.scene, camera);
  }
}
