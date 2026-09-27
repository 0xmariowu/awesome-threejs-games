// 木の描画：遠景（全部の木・大きい板）と近景（視点の近くだけ・細かい板）を距離で入れ替える
import * as THREE from 'three';
import { ALL, SHADOW } from './glsl.js';
import { buildPrototype, SPECIES_CFG, cherry } from './treegeo.js';
import { SP } from '../world/gen.js';
import { riverDZ } from '../world/layout.js';

// 種類ごとの色（葉のテクスチャに掛ける）と樹皮・樹冠の性質
// bt: 樹皮の種類（0=縦に裂ける 1=杉の繊維 2=桜の横縞の皮目 3=竹 4=なめらか 5=柿の格子 6=柳の網目）
// dens: 樹冠の葉の密度[1/m]（日の光が樹冠を抜ける長さで減る割合）
const LOOK = {
  [SP.OAK]: { a: [0.84, 0.86, 0.74], b: [0.74, 0.86, 0.58], c: [0.95, 0.8, 0.6], pc: 0.12, bark: [0.33, 0.28, 0.22], bt: 0, trans: 1.0, spec: 0.1, dens: 0.42 },
  [SP.YAMAZAKURA]: { sc: 0.35, a: [0.97, 0.92, 0.92], b: [1.0, 0.9, 0.86], bark: [0.2, 0.14, 0.13], bt: 2, trans: 0.8, spec: 0.05, dens: 0.26 },
  [SP.KOBUSHI]: { sc: 0.45, a: [1.0, 1.0, 1.0], b: [0.97, 0.97, 0.95], bark: [0.36, 0.35, 0.32], bt: 4, trans: 0.8, spec: 0.05, dens: 0.18 },
  [SP.CEDAR]: { a: [0.9, 0.98, 0.92], b: [1.0, 0.95, 0.84], bark: [0.34, 0.2, 0.13], bt: 1, trans: 0.3, spec: 0.08, dens: 0.55 },
  [SP.EVERGREEN]: { a: [0.95, 1.0, 0.95], b: [0.84, 0.92, 0.8], c: [1.05, 0.98, 0.72], pc: 0.22, bark: [0.24, 0.23, 0.21], bt: 4, trans: 0.35, spec: 0.4, dens: 0.55 },
  [SP.SAKURA]: { sc: 0.6, a: [1.1, 0.86, 0.95], b: [1.1, 0.83, 0.93], bark: [0.13, 0.095, 0.09], bt: 2, trans: 0.9, spec: 0.03, dens: 0.14 },
  [SP.KAKI]: { a: [1.0, 1.0, 0.95], b: [0.92, 1.02, 0.85], bark: [0.17, 0.15, 0.13], bt: 5, trans: 1.0, spec: 0.28, dens: 0.4 },
  [SP.WILLOW]: { a: [0.9, 0.92, 0.8], b: [0.84, 0.94, 0.74], bark: [0.17, 0.155, 0.125], bt: 6, trans: 1.1, spec: 0.05, dens: 0.22 },
  [SP.SHRUB]: { a: [1.0, 1.0, 1.0], b: [0.86, 0.95, 0.82], bark: [0.2, 0.18, 0.15], bt: 4, trans: 0.6, spec: 0.14, dens: 0.9 },
  [SP.BAMBOO]: { a: [0.9, 0.92, 0.8], b: [0.8, 0.9, 0.7], bark: [0.34, 0.42, 0.2], bt: 3, trans: 1.2, spec: 0.2, dens: 0.3 },
  [SP.CAMELLIA]: { a: [1.0, 1.05, 0.95], b: [0.92, 1.0, 0.88], bark: [0.3, 0.29, 0.26], bt: 4, trans: 0.3, spec: 0.3, dens: 0.9 },
  [SP.KEYAKI]: { a: [0.88, 0.9, 0.8], b: [0.8, 0.92, 0.68], bark: [0.36, 0.33, 0.29], bt: 4, trans: 1.0, spec: 0.08, dens: 0.36 },
  [SP.TSUTSUJI]: { sc: 0.25, a: [0.85, 0.82, 0.85], b: [0.9, 0.8, 0.86], bark: [0.18, 0.15, 0.12], bt: 4, trans: 0.45, spec: 0.12, dens: 1.2 },
};

const TREE_VS = /* glsl */ `
${ALL}
${SHADOW}
attribute vec4 aux;    // x=揺れの重み, y=葉(1)/枝(0), z=こもり(AO), w=葉:乱数 / 枝:半径[m]
attribute vec4 iPos;   // xyz, scale
attribute vec4 iData;  // rot, color, phase, -
uniform float uH;
uniform float uFlex;
uniform float uNearR;
uniform float uMidR;
uniform vec3 uTintA, uTintB, uTintC;
uniform float uPC;
uniform vec3 uCrownC;  // 樹冠の中心（木の座標）
uniform vec3 uCrownR;  // x=横の半径, y=縦の半径, z=葉の密度[1/m]
uniform vec3 uEye;     // 一本桜：段の入れ替えを決める視点（影の描画でも本当の視点で決める）
varying vec2 vUv;
varying vec3 vN;
varying vec3 vWorld;
varying vec4 vAux;
varying vec3 vFade;    // x=手前の段から入ってくる割合, y=奥の段へ出ていく前の割合, z=木ごとの乱数（網目のずれ）
varying vec3 vTint;
varying float vShadowV;
varying vec3 vVol;     // x=日の光が樹冠を抜けて届く割合, y=空の見える割合, z=幹の高さ[m]
// 楕円体の樹冠を点pから向きdへ通る長さ（木の座標・m）
float crownChord(vec3 p, vec3 d) {
  vec3 q = (p - uCrownC) / uCrownR.xyx;
  vec3 dd = d / uCrownR.xyx;
  float a = dot(dd, dd), b = dot(q, dd), c = dot(q, q) - 1.0;
  float disc = b * b - a * c;
  if (disc <= 0.0 || a < 1e-8) return 0.0;
  float sq = sqrt(disc);
  float t0 = (-b - sq) / a, t1 = (-b + sq) / a;
  return max(0.0, t1 - max(t0, 0.0));
}
void main() {
  float s = iPos.w;
  vec3 base = iPos.xyz;
  float d = distance(cameraPosition, base + vec3(0.0, uH * s * 0.5, 0.0));
  // 入れ替えの帯は狭く（網目の見える木を少なく）
#if defined(HERO)
  float dh = distance(uEye, base + vec3(0.0, uH * s * 0.5, 0.0));
#if defined(HMID)
  vFade.xy = vec2(smoothstep(uNearR - 4.0, uNearR + 4.0, dh), 1.0);
#else
  vFade.xy = vec2(1.0, 1.0 - smoothstep(uNearR - 4.0, uNearR + 4.0, dh));
#endif
#elif defined(FAR)
  vFade.xy = vec2(smoothstep(uMidR - 16.0, uMidR + 16.0, d), 1.0);
#elif defined(MID)
  vFade.xy = vec2(smoothstep(uNearR - 5.0, uNearR + 5.0, d), 1.0 - smoothstep(uMidR - 16.0, uMidR + 16.0, d));
#else
  vFade.xy = vec2(1.0, 1.0 - smoothstep(uNearR - 5.0, uNearR + 5.0, d));
#endif
  vFade.z = iData.z;
  if (vFade.x * vFade.y <= 0.002) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
#if defined(DEPTH) && !defined(FAR) && !defined(MID) && !defined(HERO)
  // 近景の影：葉の板は4割を間引く（影の図の解像度では見分けがつかない。残りは縁を少し太らせる）
  if (aux.y > 0.5 && fract(aux.w * 91.7) < 0.4) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
#endif
  float c = cos(iData.x), sn = sin(iData.x);
  mat2 R = mat2(c, sn, -sn, c);
  vec3 p = position * s;
  p.xz = R * p.xz;
  vec3 n = normal;
  n.xz = R * n.xz;
  // 風：幹ごとのしなり＋枝ごとの揺れ（近くの葉と小枝は同じ位相）＋葉の震え
  vec2 w = windAt(base.xz);
  float wl = length(w);
  float h01 = clamp(position.y / uH, 0.0, 1.2);
  float ph = iData.z * 6.2831;
  float k = h01 * h01 * uFlex;
  vec2 osc = vec2(sin(uTime * 1.1 + ph), cos(uTime * 0.83 + ph * 1.7)) * (0.25 + 0.2 * wl);
  vec2 bend = (w * 0.05 + osc * 0.07) * k * s;
  p.xz += bend * uH * 0.25;
  float br = aux.x;
  float bph = dot(position, vec3(0.41, 0.23, 0.37)) + ph;
  vec3 bsw = vec3(sin(uTime * 1.6 + bph), 0.35 * sin(uTime * 2.1 + bph * 1.3), cos(uTime * 1.35 + bph * 0.8));
  p += bsw * br * br * (0.025 + 0.07 * wl) * s * (0.6 + 0.4 * uFlex);
  float fl = aux.y * (sin(uTime * 6.3 + aux.w * 50.0 + position.x * 1.7) * 0.6 + sin(uTime * 9.7 + aux.w * 23.0) * 0.4);
  p += n * fl * (0.025 + 0.03 * wl) * s * br;
  p.y += sin(uTime * 1.7 + aux.w * 30.0 + ph) * 0.04 * br * aux.y * wl * s;
  vec3 wp = base + p;
  vWorld = wp;
  vN = n;
  vUv = uv;
  vAux = aux;
  if (aux.y < 0.5) vAux.w = aux.w * s;
  float cv = fract(iData.y * 7.13);
  float cw = fract(iData.y * 31.7);
  vTint = mix(uTintA, uTintB, smoothstep(0.1, 0.9, iData.y));
  if (cw < uPC) vTint = uTintC;
  vTint *= 0.76 + 0.44 * cv;
  vTint = mix(vTint, vTint.ggg * vec3(0.95, 1.0, 0.85), 0.25 * fract(iData.y * 3.7));
  vShadowV = 1.0;
  vVol = vec3(1.0, 1.0, position.y * s);
#ifndef DEPTH
  // 樹冠の中の陰：日の方・空の方へ樹冠を抜ける長さ（木の座標で求める）
  vec3 Ls = vec3(c * uSunDir.x + sn * uSunDir.z, uSunDir.y, -sn * uSunDir.x + c * uSunDir.z);
  float tS = crownChord(position, Ls) * s;
  float tU = crownChord(position, vec3(0.0, 1.0, 0.0)) * s;
  vVol.x = exp(-tS * uCrownR.z);
  vVol.y = exp(-tU * uCrownR.z * 0.55);
#endif
#if (defined(FAR) || defined(MID)) && !defined(DEPTH)
  // 中景・遠景は影を頂点で一度だけ引く
  vec4 pf = uShadowFMat * vec4(wp + uSunDir * 0.6, 1.0);
  vec3 uf = pf.xyz / pf.w;
  if (all(greaterThan(uf.xy, vec2(0.0))) && all(lessThan(uf.xy, vec2(1.0))) && uf.z > 0.0 && uf.z < 1.0)
    vShadowV = texture(tShadowF, vec3(uf.xy, uf.z - 0.0015 * uShadowP.w));
#endif
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
}
`;

const TREE_FS = /* glsl */ `
${ALL}
${SHADOW}
uniform sampler2D tLeaf;
uniform vec3 uBark;
uniform float uBarkType;
uniform float uTrans;
uniform float uSpec;
uniform float uScatter;
varying vec2 vUv;
varying vec3 vN;
varying vec3 vWorld;
varying vec4 vAux;
varying vec3 vFade;
varying vec3 vTint;
varying float vShadowV;
varying vec3 vVol;

// 雑音の画像を滑らかに引く（線形補間のままだと凹凸の傾きが格子ごとに折れて、樹皮が四角いタイルに見える）
float tnS(vec2 uv, int ch) {
  vec2 x = uv * 256.0 - 0.5;
  vec2 i = floor(x), f = x - i;
  f = f * f * (3.0 - 2.0 * f);
  vec4 t = texture(tNoise, (i + f + 0.5) / 256.0);
  return ch == 0 ? t.r : ch == 1 ? t.g : t.b;
}
// 樹皮：uv.x=周方向（整数回で一周）、uv.y=長さ[m]、rad=半径[m]
// 高さ（凹凸）と色を返す。凹凸は溝ほど低い
float barkH(vec2 uv, float rad, out vec3 col, out float lich) {
  float bt = uBarkType;
  float h = 0.5;
  lich = 0.0;
  vec3 b = uBark;
  if (bt < 0.5 || bt > 5.5) {
    // 楢・柳：縦に長い板と深い溝（網目）
    float sy = bt > 5.5 ? 0.22 : 0.14;
    float n1 = tnS(vec2(uv.x * 0.5, uv.y * sy), 0);
    float n2 = tnS(vec2(uv.x * 1.3 + 0.37, uv.y * sy * 2.7), 0);
    float ridge = 1.0 - abs(n1 * 2.0 - 1.0);
    ridge = smoothstep(0.35, 0.85, ridge * 0.7 + n2 * 0.4);
    h = ridge;
    col = mix(b * 0.42, b * (1.05 + 0.25 * n2), ridge);
    lich = smoothstep(0.62, 0.8, tnS(vec2(uv.x * 0.21, uv.y * 0.09), 1)) * ridge;
  } else if (bt < 1.5) {
    // 杉：縦の細い繊維がはがれかけた帯
    float n1 = tnS(vec2(uv.x * 1.1, uv.y * 0.035), 0);
    float n2 = tnS(vec2(uv.x * 3.1, uv.y * 0.12), 0);
    float strip = smoothstep(0.3, 0.7, n1);
    h = strip * 0.7 + n2 * 0.3;
    col = b * mix(vec3(0.62, 0.66, 0.7), vec3(1.15, 1.02, 0.92), strip) * (0.85 + 0.3 * n2);
    col = mix(col, vec3(0.42, 0.38, 0.34), smoothstep(0.55, 0.8, tnS(vec2(uv.x * 0.3, uv.y * 0.02), 1)) * 0.5);
  } else if (bt < 2.5) {
    // 桜：艶のある暗い紫褐色の皮に、横に長い皮目（幅2〜6cm・高さ数mm）が点々と並ぶ。太い幹は縦に割れた荒い板になる
    // 周方向の uv は約3くり返しで1m（管の付け根の太さで決まる）→ m に直して縦横の比をそろえる
    vec2 m = vec2(uv.x / 3.0, uv.y);
    float cell = tnS(vec2(m.x * 1.6 + 0.3, m.y * 11.0), 2);
    float lent = (1.0 - smoothstep(0.14, 0.34, cell)) * smoothstep(0.3, 0.55, tnS(vec2(m.x * 0.9, m.y * 3.0), 0));
    float band = tnS(vec2(m.x * 0.25, m.y * 7.0) + 0.4, 0);
    float n1 = tnS(m * 0.7, 0), n3 = tnS(m * 3.1 + 0.5, 0);
    // 古い幹の割れ：縦長の板と溝
    float plate = tnS(vec2(m.x * 1.1, m.y * 0.4) + 0.2, 2);
    float old = smoothstep(0.14, 0.4, rad);
    float fiss = old * smoothstep(0.5, 0.72, plate);   // 点からの距離が大きい所＝板の境目の溝
    h = 0.55 + 0.2 * lent - 0.5 * fiss + 0.1 * n3 + 0.08 * n1 + 0.08 * band;
    col = b * (0.8 + 0.28 * n1 + 0.1 * n3 + 0.25 * band);
    col = mix(col, b * vec3(2.4, 2.05, 1.8), lent * 0.75);
    col = mix(col, b * vec3(0.55, 0.52, 0.5), fiss * 0.8);
    col = mix(col, vec3(0.26, 0.25, 0.24), old * smoothstep(0.55, 0.75, n1) * 0.35);
    lich = smoothstep(0.62, 0.8, tnS(m * 0.55 + 0.7, 1)) * (0.4 + 0.6 * old);
  } else if (bt < 3.5) {
    // 竹：節（下ほど間が短い）、節の下の白い粉、古い稈は黄ばむ
    float sp = 0.26 + 0.1 * smoothstep(0.0, 6.0, uv.y);
    float f = fract(uv.y / sp);
    float node = 1.0 - smoothstep(0.0, 0.035, f) + smoothstep(0.965, 1.0, f);
    float powder = smoothstep(0.0, 0.03, f) * (1.0 - smoothstep(0.04, 0.14, f));
    float n1 = tnS(vec2(uv.x * 0.2, uv.y * 0.05), 1);
    h = 0.5 + node * 0.5;
    col = b * (0.85 + 0.35 * n1);
    col = mix(col, vec3(0.62, 0.62, 0.5), powder * 0.45);
    col = mix(col, b * vec3(1.2, 1.05, 0.6), node * 0.6);
    col = mix(col, vec3(0.42, 0.36, 0.2), (1.0 - smoothstep(0.0, 1.2, uv.y)) * 0.6);
  } else if (bt < 4.5) {
    // なめらか（辛夷・欅・常緑・椿）：灰色のまだら、はがれた跡、皮目
    float n1 = tnS(vec2(uv.x * 0.35, uv.y * 0.25), 0);
    float wc = tnS(vec2(uv.x * 0.18 + 0.5, uv.y * 0.12), 2);
    float pch = 1.0 - smoothstep(0.1, 0.25, wc);
    h = 0.5 + 0.2 * n1 - 0.15 * pch;
    col = b * (0.8 + 0.45 * n1);
    col = mix(col, b * vec3(1.25, 1.0, 0.75), pch * 0.5);
    lich = smoothstep(0.58, 0.76, tnS(vec2(uv.x * 0.22, uv.y * 0.1), 1));
  } else {
    // 柿：四角い小さな板に割れる
    float wc = tnS(vec2(uv.x * 0.6, uv.y * 0.9), 2);
    float plate = smoothstep(0.05, 0.25, wc);
    float n1 = tnS(vec2(uv.x * 1.3, uv.y * 1.3), 0);
    h = plate * 0.8 + 0.2 * n1;
    col = mix(b * 0.35, b * (1.1 + 0.3 * n1), plate);
  }
  return h;
}
// 葉の影：近景の図の中では遠景の図を引かず、2×2の格子の4点で引く（葉は重なって何層も塗られるので、1画素16点では重い）
// 格子は影の図の比較補間と合わせて縁が滑らかにぼける。画素ごとの回転の雑音を使わないので、網点もちらつきも出ない
float tap4(highp sampler2DShadow sm, vec3 uvz, float r, float bias) {
  float z = uvz.z - bias * uShadowP.w;
  return 0.25 * (texture(sm, vec3(uvz.xy + vec2(-r, -r), z)) + texture(sm, vec3(uvz.xy + vec2(r, -r), z))
    + texture(sm, vec3(uvz.xy + vec2(-r, r), z)) + texture(sm, vec3(uvz.xy + vec2(r, r), z)));
}
float leafShadow(vec3 wp, float nl) {
  float fade = 0.0, sN = 1.0;
  if (uShadowP.z > 0.5) {
    vec4 pn = uShadowNMat * vec4(wp, 1.0);
    vec3 un = pn.xyz / pn.w;
    vec2 e = min(un.xy, 1.0 - un.xy);
    fade = (un.z > 0.0 && un.z < 1.0) ? sat(min(e.x, e.y) * 12.0) : 0.0;
    if (fade > 0.0) sN = tap4(tShadowN, un, uShadowP.x * 1.1, 0.0006 + 0.0010 * (1.0 - nl));
  }
  if (fade >= 1.0) return sN;
  float sF = 1.0;
  vec4 pf = uShadowFMat * vec4(wp, 1.0);
  vec3 uf = pf.xyz / pf.w;
  if (all(greaterThan(uf.xy, vec2(0.0))) && all(lessThan(uf.xy, vec2(1.0))) && uf.z > 0.0 && uf.z < 1.0)
    sF = tap4(tShadowF, uf, uShadowP.y * 0.9, 0.0009 + 0.0012 * (1.0 - nl));
  return mix(sF, min(sN, sF + 0.25), fade);
}
// 凹凸から法線を曲げる（画面の微分：接線の属性が要らない）
vec3 bumpN(vec3 N, vec3 p, float h, float k) {
  vec3 dpx = dFdx(p), dpy = dFdy(p);
  float dhx = dFdx(h), dhy = dFdy(h);
  vec3 r1 = cross(dpy, N), r2 = cross(N, dpx);
  float det = dot(dpx, r1);
  vec3 g = sign(det) * (dhx * r1 + dhy * r2);
  vec3 n2 = abs(det) * N - k * g;
  float l = length(n2);
  return l > 1e-8 ? n2 / l : N;
}

void main() {
  bool leaf = vAux.y > 0.5;
  vec3 wp = vWorld;
  vec3 albedo;
  float alpha = 1.0;
  float bh = 0.5, lich = 0.0;
  if (leaf) {
    vec4 tx = texture(tLeaf, vUv);
    // 縮小しても葉が痩せないよう縁を立てる
    float a = tx.a;
    // 縮小（ミップ）で細い葉の不透明さが薄まり、遠くの樹冠が網目に透けるのを補う
    vec2 tdx = dFdx(vUv) * 2048.0, tdy = dFdy(vUv) * 2048.0;
    float lod = max(0.0, 0.5 * log2(max(max(dot(tdx, tdx), dot(tdy, tdy)), 1e-8)));
    a = sat(a * (1.0 + 0.24 * lod));
    float fw = max(fwidth(a), 1e-3);
    alpha = sat((a - 0.42) / fw * 0.6 + 0.5);
    // 板ごとに少し色を変える（同じ房のくり返しに見えないよう）
    float cr = fract(vAux.w * 13.37);
    albedo = tx.rgb * vTint * (0.86 + 0.26 * cr) * mix(vec3(1.0), vec3(1.05, 1.02, 0.86), step(0.8, fract(vAux.w * 7.1)) * 0.6);
  } else {
    bh = barkH(vUv, vAux.w, albedo, lich);
  }
  // 段の入れ替え：画素ごとの網目で、手前の段と奥の段が補い合う（同じ画素を両方が抜いて穴が開き暗く透けることがない）
  {
    // 網目は木ごとにずらす（隣り合う木で同じ模様が並ばない）
    float hN = fract(52.9829189 * fract(dot(gl_FragCoord.xy + floor(vFade.z * vec2(61.0, 37.0)), vec2(0.06711056, 0.00583715))));
    if (hN < 1.0 - vFade.x || hN >= vFade.y) discard;
  }
#ifdef DEPTH
  if (alpha < (leaf ? 0.3 : 0.5)) discard;
  gl_FragColor = vec4(1.0);
#else
  if (alpha < 0.01) discard;
  vec3 N = normalize(vN);
  vec3 V = normalize(cameraPosition - wp);
  vec3 L = uSunDir;
  if (!leaf) {
    if (!gl_FrontFacing) N = -N;
#if !defined(FAR) && !defined(MID)
    N = bumpN(N, wp, bh, 0.035 * clamp(vAux.w * 4.0, 0.25, 1.0));
#endif
    // 苔：北側（日の当たらない側）と根元、上を向いた大枝の背。地衣：淡い灰緑の斑
    float mn = texture(tNoise, wp.xz * 0.21 + wp.y * vec2(0.05, 0.13)).g;
    float lxz = length(N.xz);
    float north = lxz > 1e-3 ? sat(0.35 - dot(N.xz / lxz, normalize(L.xz)) * 0.65) : 0.0;
    float moss = sat(north * (1.0 - smoothstep(0.2, 3.0, vVol.z)) + smoothstep(0.55, 0.95, N.y) * 0.35) * smoothstep(0.4, 0.7, mn + 0.15 * (1.0 - bh));
    moss *= uBarkType > 2.5 && uBarkType < 3.5 ? 0.0 : 1.0;
    albedo = mix(albedo, vec3(0.44, 0.47, 0.4), lich * 0.45);
    albedo = mix(albedo, vec3(0.13, 0.16, 0.07) * (0.8 + 0.4 * mn), moss * 0.7);
  }
  float nl = dot(N, L);
#if defined(FAR) || defined(MID)
  float sh = vShadowV;
#else
  float sh = leaf ? leafShadow(wp, max(nl, 0.3)) : sunShadow(wp, max(nl, 0.3), gl_FragCoord.xy);
#endif
  sh *= cloudShadow(wp);
  float ao = vAux.z;
  // 樹冠の中の陰（近景は影の図もあるので控えめに重ねる）
#if defined(FAR) || defined(MID)
  float vs = mix(0.06, 1.0, vVol.x);
#else
  float vs = mix(0.1, 1.0, vVol.x);
  vs = mix(vs, 1.0, 0.25);
#endif
  float sky = mix(0.35, 1.0, vVol.y);
  vec3 canopy = mix(vec3(0.92, 1.0, 0.74), vec3(1.0), vVol.y);
  vec3 col;
  if (leaf) {
    float diff = sat((nl + 0.5) / 1.5);
    // 房ごとの陰：奥の房ほど、隣の房の陰にランダムに入る（樹冠の中のまだらな光）
    float clump = fract(vAux.w * 57.31);
    vs *= mix(1.0, 0.3 + 0.7 * clump, sat(1.0 - ao) * 0.75 * (1.0 - 0.6 * uScatter));
    // 白い花びらは樹冠の中でも光を散らして明るい（房ごとの明暗と樹冠の奥の陰は少し残す）
    vs = mix(vs, 1.0, uScatter * 0.45);
    diff = mix(diff, 0.75, uScatter * 0.5);
    sky = mix(sky, 1.0, uScatter * 0.6);
    vec3 amb = shIrr(N) * (0.3 + 0.7 * ao) * sky * canopy;
    col = albedo * (uSunCol * diff * sh * vs + amb);
    // 花びらは薄く、陰の中でも周りの花を抜けてきた日の光でほんのり明るい（灰色にくすまない）
    col += albedo * albedo * uSunCol * uScatter * 0.12 * (0.4 + 0.6 * ao) * sqrt(vs) * (1.0 - 0.6 * sh);
    // 逆光で葉が透ける：透けた光は葉の色で濃くなる。樹冠の奥では弱まる
    float vl = sat(dot(-V, L));
    float back = pow(vl, 4.0) * 0.85 + sat(-nl) * 0.3;
    vec3 tcol = albedo * vec3(1.05, 1.12, 0.55) * (0.55 + 0.9 * albedo);
    col += tcol * uSunCol * back * uTrans * 0.6 * sh * sqrt(vs) * (0.4 + 0.6 * ao);
    // 葉の表の艶：浅い角度で空が映る＋日の照り返し
    float nv = sat(dot(N, V));
    float F = 0.04 + 0.5 * pow(1.0 - nv, 5.0);
    col += max(shIrr(reflect(-V, N)), vec3(0.0)) * F * (0.08 + uSpec * 0.3) * ao * sky;
    vec3 Hh = normalize(L + V);
    col += uSunCol * pow(max(dot(N, Hh), 0.0), 60.0) * uSpec * 0.5 * sh * vs;
  } else {
    float diff = max(nl, 0.0);
    // 溝の奥は暗い
    float cav = mix(0.55, 1.0, sat(bh * 1.4));
    vec3 amb = shIrr(N) * (0.35 + 0.65 * ao) * sky * cav * canopy * vec3(1.06, 0.96, 0.8);
    col = albedo * (uSunCol * diff * sh * vs * mix(0.8, 1.0, cav) + amb);
    // 桜・竹の皮は少し艶がある
    float gl = uBarkType > 1.5 && uBarkType < 3.5 ? 0.08 : 0.02;
    vec3 Hh = normalize(L + V);
    col += uSunCol * pow(max(dot(N, Hh), 0.0), 24.0) * gl * sh * vs * cav;
  }
  gl_FragColor = vec4(max(col, vec3(0.0)), alpha);
#endif
}
`;

export class Trees {
  constructor(world, shared, atlas) {
    this.group = new THREE.Group();
    this.world = world;
    this.nearR = 68;
    this._eye = new THREE.Vector3(1e9, 0, 0);
    this.midR = 320;
    const trees = world.trees.filter((t) => !t.hero);
    this.hero = world.trees.find((t) => t.hero);
    const VAR = (sp) => (sp === SP.SAKURA ? 3 : [SP.OAK, SP.CEDAR, SP.EVERGREEN, SP.BAMBOO, SP.YAMAZAKURA, SP.SHRUB].includes(sp) ? 2 : 1);
    // 川沿いの並木の桜：形の張り出し（木の座標の+x）を川の方へ向ける。向きは木ごとに少しずらす（鳥の止まり木も同じ t.rot を読む）
    for (const t of trees) if (t.sp === SP.SAKURA) {
      const dz = riverDZ(t.x), l = Math.hypot(dz, 1);
      t.rot = Math.atan2(1 / l, -dz / l) + (((t.c * 7.31) % 1) - 0.5) * 0.5;
    }
    this.protos = [];
    const bySp = new Map();
    for (const t of trees) {
      const v = Math.floor(t.c * 997) % VAR(t.sp);
      const key = t.sp * 10 + v;
      if (!bySp.has(key)) bySp.set(key, []);
      bySp.get(key).push(t);
    }
    // 近景に切り替える距離：杉は房の板が多く、群れて立つので近めで中景へ（中景の段の板でも50m先なら見分けがつかない）
    const nearROf = (sp) => (sp === SP.CEDAR ? 48 : this.nearR);
    const mkMat = (sp, defs, proto, nearR = nearROf(sp)) => {
      const L = LOOK[sp];
      const cfg = SPECIES_CFG[sp];
      const cc = proto.crownC || [0, proto.crownY, 0];
      return new THREE.ShaderMaterial({
        uniforms: {
          ...shared,
          tLeaf: { value: atlas },
          uH: { value: proto.height }, uFlex: { value: cfg.flex }, uNearR: { value: nearR }, uMidR: { value: this.midR }, uEye: { value: this._eye },
          uTintA: { value: new THREE.Vector3(...L.a) }, uTintB: { value: new THREE.Vector3(...L.b) },
          uTintC: { value: new THREE.Vector3(...(L.c || L.a)) }, uPC: { value: L.pc || 0 },
          uBark: { value: new THREE.Vector3(...L.bark) }, uBarkType: { value: L.bt }, uTrans: { value: L.trans }, uSpec: { value: L.spec }, uScatter: { value: L.sc ?? 0.1 },
          uCrownC: { value: new THREE.Vector3(...cc) },
          uCrownR: { value: new THREE.Vector3(proto.crownR, proto.crownRy, L.dens) },
        },
        defines: defs,
        vertexShader: TREE_VS, fragmentShader: TREE_FS,
        side: THREE.DoubleSide,
        alphaToCoverage: !defs.DEPTH,
      });
    };
    // 株（低木・躑躅・椿）は斜面の下り側が浮かないよう、株の縁の一番低い地面まで沈める
    const W = world, gAt = (x, z) => {
      const N = W.N, fi = Math.min(N - 1.001, Math.max(0, (x - W.ORIGIN) / W.CELL)), fj = Math.min(N - 1.001, Math.max(0, (z - W.ORIGIN) / W.CELL));
      const i = Math.floor(fi), j = Math.floor(fj), u = fi - i, v = fj - j, k = j * N + i, Hh = W.height;
      return (Hh[k] * (1 - u) + Hh[k + 1] * u) * (1 - v) + (Hh[k + N] * (1 - u) + Hh[k + N + 1] * u) * v;
    };
    const BUSH = new Set([SP.SHRUB, SP.TSUTSUJI, SP.CAMELLIA]);
    const sink = new Map();
    const baseY = (t) => sink.get(t) ?? t.y - 0.15;
    const setSink = (t, R) => {
      let lo = t.y;
      for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; lo = Math.min(lo, gAt(t.x + Math.cos(a) * R, t.z + Math.sin(a) * R)); }
      sink.set(t, lo - 0.15);
    };
    this._baseY = baseY;
    const inst = (t) => [[t.x, baseY(t), t.z, t.s], [t.rot, t.c, (t.c * 13.7) % 1, 0]];
    const dynSet = (geo, cap) => {
      const a = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4);
      const b = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4);
      a.setUsage(THREE.DynamicDrawUsage); b.setUsage(THREE.DynamicDrawUsage);
      geo.setAttribute('iPos', a); geo.setAttribute('iData', b);
      geo.instanceCount = 0;
      return { geo, a, b, cap, n: 0 };
    };
    for (const [key, list] of bySp) {
      const sp = Math.floor(key / 10), v = key % 10;
      const near = buildPrototype(sp, v, false);
      const mid = buildPrototype(sp, v, 'mid');
      const far = buildPrototype(sp, v, true);
      const H = near.height;
      if (BUSH.has(sp)) for (const t of list) setSink(t, near.crownR * t.s * 0.85);
      // 遠景：視錐台の中の木だけを詰め直す（影の描画のときは全部）
      const fp = new Float32Array(list.length * 4), fd = new Float32Array(list.length * 4);
      list.forEach((t, i) => { const [a, b] = inst(t); fp.set(a, i * 4); fd.set(b, i * 4); });
      const fpA = new THREE.InstancedBufferAttribute(fp.slice(), 4), fdA = new THREE.InstancedBufferAttribute(fd.slice(), 4);
      fpA.setUsage(THREE.DynamicDrawUsage); fdA.setUsage(THREE.DynamicDrawUsage);
      far.geo.setAttribute('iPos', fpA);
      far.geo.setAttribute('iData', fdA);
      far.geo.instanceCount = list.length;
      const farMesh = new THREE.Mesh(far.geo, mkMat(sp, { FAR: '' }, near));
      farMesh.frustumCulled = false;
      farMesh.userData.depthMaterial = mkMat(sp, { FAR: '', DEPTH: '' }, near);
      farMesh.userData.nearShadow = false;
      this.group.add(farMesh);
      // 中景・近景：視点の近くを集め直す
      const midSet = dynSet(mid.geo, Math.min(list.length, 9000));
      const midMesh = new THREE.Mesh(mid.geo, mkMat(sp, { MID: '' }, near));
      midMesh.frustumCulled = false;
      midMesh.userData.depthMaterial = mkMat(sp, { MID: '', DEPTH: '' }, near);
      midMesh.userData.farShadow = false;
      midMesh.userData.nearShadow = false;
      this.group.add(midMesh);
      const nearSet = dynSet(near.geo, Math.min(list.length, 3000));
      const nearMesh = new THREE.Mesh(near.geo, mkMat(sp, {}, near));
      nearMesh.frustumCulled = false;
      nearMesh.userData.depthMaterial = mkMat(sp, { DEPTH: '' }, near);
      nearMesh.userData.farShadow = false;
      this.group.add(nearMesh);
      this.protos.push({ sp, v, list, H, nearR: nearROf(sp), near: nearSet, mid: midSet, farMesh, nearMesh, midMesh, far: { geo: far.geo, a: fpA, b: fdA, allP: fp, allD: fd } });
    }
    this.cell = 32;
    this.grid = new Map();
    for (const p of this.protos) for (const t of p.list) {
      const k = Math.floor(t.x / this.cell) * 1000 + Math.floor(t.z / this.cell);
      if (!this.grid.has(k)) this.grid.set(k, []);
      this.grid.get(k).push({ t, p });
    }
    // 一本桜（専用の形：短い幹から大枝6本、丸い傘の樹冠に花の塊。treegeo.js の cherryDome）。45mより先は同じ骨格の中景版（花の板3000枚）に網目で入れ替える
    if (this.hero) {
      this.heroR = 45;
      const cfg = { ...SPECIES_CFG[SP.SAKURA], dome: 1, cards: 14000, spread: 0.52, rise: 0.35, domeY: 0.3, lumpR: 0.12, limbs: 6, height: 9 * this.hero.s, bark: 0.03, cardSize: 0.043 };
      const hb = cherry(cfg, 777, false);
      const hm = cherry({ ...cfg, midCards: 3000, midCardSize: 0.043 * Math.sqrt(14000 / 3000) * 0.95 }, 777, 'mid');
      this.hero.s = 1;
      const hx = this.hero.x, hy = this.hero.y - 0.2, hz = this.hero.z;
      // 境界球：視錐台の外（影の図の範囲の外も）なら描かない
      const bs = new THREE.Sphere(new THREE.Vector3(hx + hb.crownC[0], hy + hb.crownC[1] * 0.75, hz + hb.crownC[2]), Math.hypot(hb.crownR * 1.25 + 1.5, hb.crownC[1] * 0.75 + hb.crownRy + 1));
      const mk = (b, defs) => {
        const g = b.geo;
        g.setAttribute('iPos', new THREE.InstancedBufferAttribute(new Float32Array([hx, hy, hz, 1]), 4));
        g.setAttribute('iData', new THREE.InstancedBufferAttribute(new Float32Array([0.7, 0.4, 0.3, 0]), 4));
        g.instanceCount = 1;
        g.boundingSphere = bs.clone();
        const m = new THREE.Mesh(g, mkMat(SP.SAKURA, { HERO: '', ...defs }, hb, this.heroR));
        m.userData.depthMaterial = mkMat(SP.SAKURA, { HERO: '', DEPTH: '', ...defs }, hb, this.heroR);
        this.group.add(m);
        return m;
      };
      this.heroNear = mk(hb, {});
      this.heroMid = mk(hm, { HMID: '' });
      this.heroC = bs.center.clone();
      this.heroInfo = { ...hb, x: this.hero.x, y: this.hero.y, z: this.hero.z, s: this.hero.s };
    }
    this._last = new THREE.Vector3(1e9, 0, 0);
    this._lastMid = new THREE.Vector3(1e9, 0, 0);
    this._frame = 0;
  }

  // 視野を少し広げたカメラで選ぶ（回転の遅れで端が欠けないように）
  _cullCam(camera) {
    if (!this._cc) { this._cc = new THREE.PerspectiveCamera(); }
    const c = this._cc;
    c.copy(camera);
    c.fov = Math.min(120, camera.fov * 1.35);
    c.aspect = camera.aspect * 1.1;
    c.near = 1; c.far = 40000;
    c._reversedDepth = camera.reversedDepth;
    c.updateProjectionMatrix();
    c.updateMatrixWorld();
    return c;
  }

  _gather(cp, R, key) {
    for (const p of this.protos) p[key].n = 0;
    const c0x = Math.floor((cp.x - R) / this.cell), c1x = Math.floor((cp.x + R) / this.cell);
    const c0z = Math.floor((cp.z - R) / this.cell), c1z = Math.floor((cp.z + R) / this.cell);
    const R2 = R * R;
    for (let cx = c0x; cx <= c1x; cx++) for (let cz = c0z; cz <= c1z; cz++) {
      const list = this.grid.get(cx * 1000 + cz);
      if (!list) continue;
      for (const e of list) {
        const t = e.t, set = e.p[key];
        const dx = t.x - cp.x, dy = t.y + e.p.H * t.s * 0.5 - cp.y, dz = t.z - cp.z;
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 > R2 || set.n >= set.cap) continue;
        if (key === 'near' && d2 > (e.p.nearR + 9) ** 2) continue;
        const o = set.n * 4;
        set.a.array[o] = t.x; set.a.array[o + 1] = this._baseY(t); set.a.array[o + 2] = t.z; set.a.array[o + 3] = t.s;
        set.b.array[o] = t.rot; set.b.array[o + 1] = t.c; set.b.array[o + 2] = (t.c * 13.7) % 1; set.b.array[o + 3] = 0;
        set.n++;
      }
    }
    for (const p of this.protos) {
      const set = p[key];
      set.geo.instanceCount = set.n;
      set.a.clearUpdateRanges(); set.a.addUpdateRange(0, set.n * 4); set.a.needsUpdate = true;
      set.b.clearUpdateRanges(); set.b.addUpdateRange(0, set.n * 4); set.b.needsUpdate = true;
    }
  }

  // 遠景の木：視錐台（少し広め）の中で、中景より遠いものだけ
  cullFar(camera, all = false) {
    const m = new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    const fr = new THREE.Frustum().setFromProjectionMatrix(m, camera.coordinateSystem, camera.reversedDepth);
    const sph = new THREE.Sphere();
    const cp = camera.position;
    const minD = (this.midR - 30) ** 2;
    for (const p of this.protos) {
      const f = p.far;
      if (all) {
        f.a.array.set(f.allP); f.b.array.set(f.allD);
        f.geo.instanceCount = p.list.length;
      } else {
        let n = 0;
        const H = p.H;
        for (let i = 0; i < p.list.length; i++) {
          const t = p.list[i];
          const dx = t.x - cp.x, dz = t.z - cp.z;
          if (dx * dx + dz * dz < minD) continue;
          sph.center.set(t.x, t.y + H * t.s * 0.5, t.z);
          sph.radius = H * t.s * 0.7 + 25;
          if (!fr.intersectsSphere(sph)) continue;
          f.a.array[n * 4] = f.allP[i * 4]; f.a.array[n * 4 + 1] = f.allP[i * 4 + 1]; f.a.array[n * 4 + 2] = f.allP[i * 4 + 2]; f.a.array[n * 4 + 3] = f.allP[i * 4 + 3];
          f.b.array[n * 4] = f.allD[i * 4]; f.b.array[n * 4 + 1] = f.allD[i * 4 + 1]; f.b.array[n * 4 + 2] = f.allD[i * 4 + 2]; f.b.array[n * 4 + 3] = f.allD[i * 4 + 3];
          n++;
        }
        f.geo.instanceCount = n;
      }
      f.a.clearUpdateRanges(); f.a.addUpdateRange(0, f.geo.instanceCount * 4); f.a.needsUpdate = true;
      f.b.clearUpdateRanges(); f.b.addUpdateRange(0, f.geo.instanceCount * 4); f.b.needsUpdate = true;
    }
  }

  update(camera, force = false) {
    const cp = camera.position;
    this._frame++;
    // 一本桜の段：本当の視点からの距離で決める（影の描画でも同じ段を使う）
    if (this.heroNear) {
      this._eye.copy(cp);
      const d = cp.distanceTo(new THREE.Vector3(this.hero.x, this.hero.y + this.heroInfo.height * 0.5, this.hero.z));
      this.heroNear.visible = d < this.heroR + 5;
      this.heroMid.visible = d > this.heroR - 5;
    }
    // 遠景の選び直し：移動・回転が大きいときか、ときどき
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    if (!this._lastFwd) { this._lastFwd = new THREE.Vector3(); this._lastFar = new THREE.Vector3(1e9, 0, 0); }
    if (force || fwd.dot(this._lastFwd) < 0.9985 || cp.distanceToSquared(this._lastFar) > 100 || this._frame % 45 === 0) {
      this._lastFwd.copy(fwd); this._lastFar.copy(cp);
      this.cullFar(this._cullCam(camera));
    }
    if (force || cp.distanceToSquared(this._last) > 4 || this._frame % 30 === 0) {
      this._last.copy(cp);
      this._gather(cp, this.nearR + 9, 'near');
    }
    if (force || cp.distanceToSquared(this._lastMid) > 64 || this._frame % 90 === 45) {
      this._lastMid.copy(cp);
      this._gather(cp, this.midR + 28, 'mid');
    }
  }

  // 泡の衝突用：点の近くの木
  nearby(x, z, r) {
    const out = [];
    const c0x = Math.floor((x - r) / this.cell), c1x = Math.floor((x + r) / this.cell);
    const c0z = Math.floor((z - r) / this.cell), c1z = Math.floor((z + r) / this.cell);
    for (let cx = c0x; cx <= c1x; cx++) for (let cz = c0z; cz <= c1z; cz++) {
      const list = this.grid.get(cx * 1000 + cz);
      if (list) for (const e of list) out.push(e);
    }
    return out;
  }
}
