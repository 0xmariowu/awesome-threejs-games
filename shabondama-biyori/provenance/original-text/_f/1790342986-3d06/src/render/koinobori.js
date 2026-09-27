// 鯉のぼり：竿・回転球・矢車・吹き流し・真鯉・緋鯉・子鯉。布は風下へなびき、突風でふくらみ、凪ぐと垂れてしわが寄る
// 布（ナイロン）の艶と、日を透かしたときの透け。尾びれは縦に平たく二股、吹き流しは先が五本に裂ける
import * as THREE from 'three';
import { ALL, SHADOW } from './glsl.js';

const KVS = /* glsl */ `
${ALL}
${SHADOW}
attribute vec4 aK;       // x=長さ方向0..1 y=周方向0..1 z=種類(0竿 1吹き流し 2〜4鯉 5矢車・球 6綱) w=予備
uniform vec3 uBase;      // 竿の根元
uniform float uTimeK;
varying vec2 vUv;
varying vec3 vN;
varying vec3 vWorld;
varying float vKind;
varying float vSlack;
const float LEN[5] = float[5](0.0, 4.2, 4.4, 3.5, 2.7);
const float RAD[5] = float[5](0.0, 0.34, 0.5, 0.42, 0.34);
const float HGT[5] = float[5](0.0, 10.6, 9.5, 8.3, 7.2);
vec3 bodyAt(int kind, float t, float ang, vec3 dir, vec3 lat, float ws, float strength, out vec3 nrm) {
  float L = LEN[kind], R = RAD[kind];
  // 胴の太さ：口が輪、胸で少しふくらみ、尾へ細く、尾びれで広がる
  float prof = kind == 1 ? 1.0 : (0.94 + 0.14 * sin(min(t * 3.4, 3.1416)) - 0.6 * smoothstep(0.38, 0.84, t) + 0.34 * smoothstep(0.84, 1.0, t));
  float inflate = mix(0.5, 1.0, strength) + 0.05 * sin(uTimeK * 5.0 + t * 9.0);
  float r = R * prof * mix(1.0, inflate, smoothstep(0.02, 0.2, t));
  // 尾は横につぶれて縦の鰭になる
  float flatK = kind == 1 ? 1.0 : mix(1.0, 0.16, smoothstep(0.8, 0.97, t));
  // 胴の曲がり：進む波。凪ぐと下へ垂れる
  float ph = uTimeK * (3.0 + ws * 1.2) - t * 7.0 + float(kind) * 1.7;
  float amp = (0.18 + 0.25 * strength) * t * L * 0.35;
  float side = sin(ph) * amp;
  float up = sin(ph * 0.7 + 1.3) * amp * 0.45;
  float droop = (1.0 - strength) * t * t * L * 0.6;
  float along = t * L * mix(0.72, 1.0, strength);
  vec3 axis = uBase + vec3(0.0, HGT[kind], 0.0) + dir * (along + R) + lat * side + vec3(0.0, up - droop - R, 0.0);
  // 吹き流しの先は五本の帯に裂けて、それぞれ別にはためく
  if (kind == 1) {
    float strip = floor(fract(ang / 6.2831 + 0.1) * 5.0);
    float sp = smoothstep(0.55, 1.0, t);
    axis += (lat * sin(ph * 1.7 + strip * 1.9) + vec3(0.0, cos(ph * 1.3 + strip * 2.3), 0.0)) * sp * 0.22;
  }
  // 凪いだときのしわ（周方向に波打つ）
  float wr = (1.0 - strength) * 0.18 * smoothstep(0.05, 0.3, t) * sin(ang * 7.0 + t * 23.0 + uTimeK * 1.5);
  r *= 1.0 + wr;
  vec3 rn = lat * cos(ang) * flatK + vec3(0.0, 1.0, 0.0) * sin(ang);
  nrm = normalize(lat * cos(ang) / max(flatK, 0.2) + vec3(0.0, sin(ang), 0.0));
  return axis + rn * r;
}
void main() {
  int kind = int(aK.z + 0.5);
  vKind = aK.z;
  vUv = aK.xy;
  vec3 wp;
  vec3 n = normal;
  vec2 w = windAt(uBase.xz);
  float ws = length(w);
  vec2 wd = ws > 0.01 ? w / ws : vec2(1.0, 0.0);
  float strength = smoothstep(0.1, 2.0, ws) * 0.8 + 0.2;
  vSlack = 1.0 - strength;
  if (kind == 0 || kind == 6) {
    wp = uBase + position;
  } else if (kind == 5) {
    // 矢車と回転球：竿の先で回る（矢車は風上を向く）
    float a = uTimeK * (2.0 + ws * 2.5) * step(0.5, aK.w);
    float c = cos(a), s = sin(a);
    vec3 p = position;
    vec3 q = vec3(p.x, p.y * c - p.z * s, p.y * s + p.z * c);
    vec3 qn = vec3(n.x, n.y * c - n.z * s, n.y * s + n.z * c);
    float ya = atan(wd.y, wd.x);
    float cy = cos(ya), sy = sin(ya);
    wp = uBase + vec3(0.0, 11.35, 0.0) + vec3(q.x * cy - q.z * sy, q.y, q.x * sy + q.z * cy);
    n = normalize(vec3(qn.x * cy - qn.z * sy, qn.y, qn.x * sy + qn.z * cy));
  } else {
    vec3 dir = normalize(vec3(wd.x, 0.0, wd.y));
    vec3 lat = vec3(-dir.z, 0.0, dir.x);
    float t = aK.x, ang = aK.y * 6.2831;
    vec3 nn;
    wp = bodyAt(kind, t, ang, dir, lat, ws, strength, nn);
    // 法線：隣の点との差から（しわ・曲がりを反映）
    vec3 n2;
    vec3 pa = bodyAt(kind, min(t + 0.01, 1.0), ang, dir, lat, ws, strength, n2);
    vec3 pb = bodyAt(kind, t, ang + 0.05, dir, lat, ws, strength, n2);
    vec3 cr = cross(pb - wp, pa - wp);
    n = dot(cr, cr) > 1e-12 ? normalize(cr) : nn;
    if (dot(n, nn) < 0.0) n = -n;
  }
  vN = n;
  vWorld = wp;
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
}
`;
const KFS = /* glsl */ `
${ALL}
${SHADOW}
varying vec2 vUv;
varying vec3 vN;
varying vec3 vWorld;
varying float vKind;
varying float vSlack;
float fishPaint(float u, float v, int kind, out vec3 alb, out float gloss) {
  vec3 base = kind == 2 ? vec3(0.018, 0.02, 0.03) : kind == 3 ? vec3(0.62, 0.06, 0.035) : vec3(0.05, 0.16, 0.5);
  vec3 edge = kind == 2 ? vec3(0.6, 0.45, 0.12) : kind == 3 ? vec3(0.85, 0.72, 0.35) : vec3(0.82, 0.84, 0.86);
  // 背と腹の濃淡（v=0.25が背、0.75が腹）
  float back = 0.5 + 0.5 * sin(v * 6.2831);
  vec3 body = base * mix(1.15, 0.78, back);
  // うろこ：弧の縁取りと、弧の内の濃淡
  vec2 sc = vec2(u * 18.0, v * 13.0);
  sc.y += mod(floor(sc.x), 2.0) * 0.5;
  vec2 f = fract(sc) - vec2(0.0, 0.5);
  float d = length(f);
  float fw = fwidth(sc.x) * 0.7 + 1e-4;
  float arc = smoothstep(0.07 + fw, 0.0, abs(d - 0.5)) * step(0.0, f.x);
  float inner = smoothstep(0.5, 0.15, d);
  float scaleZone = smoothstep(0.16, 0.22, u) * (1.0 - smoothstep(0.8, 0.86, u));
  alb = mix(body, body * 1.35 + base * 0.2, inner * 0.35 * scaleZone);
  alb = mix(alb, edge, arc * 0.8 * scaleZone);
  gloss = arc * scaleZone;
  // 頭：白い顔、金の口の輪、えら、目
  float head = smoothstep(0.155, 0.13, u);
  alb = mix(alb, vec3(0.86, 0.85, 0.82), head * 0.95);
  float gill = smoothstep(0.012, 0.0, abs(u - 0.15 - 0.012 * sin(v * 12.566))) ;
  alb = mix(alb, kind == 2 ? vec3(0.75, 0.55, 0.15) : vec3(0.7, 0.08, 0.05), gill);
  alb = mix(alb, vec3(0.85, 0.62, 0.18), smoothstep(0.03, 0.012, u));
  // 目（左右）：白目・金の輪・黒目・光
  float Lf = kind == 2 ? 4.4 : kind == 3 ? 3.5 : 2.7, Rf = kind == 2 ? 0.5 : kind == 3 ? 0.42 : 0.34;
  for (int s = 0; s < 2; s++) {
    float vc = s == 0 ? 0.07 : 0.43;
    vec2 e = vec2((u - 0.075) * Lf, (v - vc) * 6.2831 * Rf) / Rf;
    float r = length(e);
    float aa = fwidth(r) + 1e-4;
    alb = mix(alb, vec3(0.92, 0.9, 0.85), smoothstep(0.36 + aa, 0.36 - aa, r));
    alb = mix(alb, vec3(0.85, 0.6, 0.12), smoothstep(0.29 + aa, 0.29 - aa, r));
    alb = mix(alb, vec3(0.012), smoothstep(0.21 + aa, 0.21 - aa, r));
    alb = mix(alb, vec3(0.95), smoothstep(0.06 + aa, 0.03, length(e - vec2(0.07, 0.08))));
  }
  // 尾びれ：筋と縁の色
  float tail = smoothstep(0.85, 0.9, u);
  alb = mix(alb, mix(base * 1.3 + 0.03, edge, 0.35) * (0.7 + 0.3 * sin(v * 70.0)), tail);
  return 1.0;
}
void main() {
  int kind = int(vKind + 0.5);
  float u = vUv.x, v = vUv.y;
  // 尾の二股（縦の鰭の真ん中を切り欠く）
  if (kind >= 2 && kind <= 4) {
    // 縦の鰭の高さの真ん中（v=0, 0.5）を尾の先ほど深く切る
    float cut = 0.23 * smoothstep(0.9, 1.0, u);
    float fv = fract(v);
    float vm = min(min(fv, 1.0 - fv), abs(fv - 0.5));
    if (u > 0.9 && vm < cut) discard;
  }
  // 吹き流しの裂け目
  if (kind == 1) {
    float fs = fract(fract(v + 0.1) * 5.0);
    if (u > 0.55 && (fs < 0.06 || fs > 0.94)) discard;
  }
#ifdef DEPTH
  gl_FragColor = vec4(1.0);
#else
  vec3 N = normalize(vN);
  bool front = gl_FrontFacing;
  if (!front) N = -N;
  vec3 alb;
  float gloss = 0.0;
  float inside = front ? 1.0 : 0.35;
  float rough = 0.45, f0 = 0.04;
  if (kind == 0) {
    // アルミの伸縮竿
    alb = vec3(0.46, 0.47, 0.48) * (0.92 + 0.08 * texture(tNoise, vec2(v * 2.0, u * 30.0)).r);
    rough = 0.3; f0 = 0.6; inside = 1.0;
  } else if (kind == 5) {
    alb = vUv.y > 0.5 ? vec3(0.88, 0.66, 0.2) : vec3(0.78, 0.78, 0.8);
    rough = 0.25; f0 = 0.7; inside = 1.0;
  } else if (kind == 6) {
    alb = vec3(0.75, 0.73, 0.68); rough = 0.9; inside = 1.0;
  } else if (kind == 1) {
    // 吹き流し：五色の縦縞、頭に金の雲の帯
    float st = floor(fract(v + 0.1) * 5.0);
    alb = st < 1.0 ? vec3(0.04, 0.12, 0.5) : st < 2.0 ? vec3(0.66, 0.05, 0.035) : st < 3.0 ? vec3(0.78, 0.6, 0.04) : st < 4.0 ? vec3(0.82, 0.82, 0.8) : vec3(0.03, 0.26, 0.09);
    float band = smoothstep(0.02, 0.04, u) * (1.0 - smoothstep(0.16, 0.18, u));
    float cloud = smoothstep(0.55, 0.6, texture(tNoise, vec2(u * 3.0, v * 2.0)).g);
    alb = mix(alb, mix(vec3(0.05, 0.1, 0.4), vec3(0.85, 0.66, 0.2), cloud), band);
    alb = mix(alb, vec3(0.85, 0.66, 0.2), smoothstep(0.02, 0.0, u));
  } else {
    fishPaint(u, v, kind, alb, gloss);
  }
  vec3 V = normalize(cameraPosition - vWorld);
  vec3 L = uSunDir;
  float nl = dot(N, L);
  float cloth = kind >= 1 && kind <= 4 ? 1.0 : 0.0;
  float diff = cloth > 0.5 ? sat((nl + 0.25) / 1.25) : max(nl, 0.0);
  float sh = sunShadow(vWorld + N * 0.05, max(nl, 0.0), gl_FragCoord.xy) * cloudShadow(vWorld);
  vec3 col = alb * (uSunCol * diff * sh + shIrr(N)) * inside;
  // 布の透け：日を背にした側が明るく光る
  if (cloth > 0.5) col += alb * uSunCol * pow(sat(dot(-V, L)), 2.0) * 0.55 * sh * (0.6 + 0.4 * sat(-nl));
  // 艶（ナイロンの張り・金の縁取り）
  vec3 H = normalize(L + V);
  float NoH = max(dot(N, H), 0.0);
  float spec = pow(NoH, cloth > 0.5 ? mix(30.0, 70.0, gloss) : 90.0) * (cloth > 0.5 ? mix(0.08, 0.5, gloss) * (1.0 - vSlack * 0.5) : f0);
  col += uSunCol * spec * sh * sat(nl * 4.0);
  vec3 R = reflect(-V, N);
  float Fe = f0 + (1.0 - f0) * pow(1.0 - max(dot(N, V), 0.0), 5.0);
  if (cloth < 0.5) col += shIrr(R) * Fe * (1.0 - rough * 0.6) * (kind == 5 ? alb * 1.5 : vec3(1.0));
  else col += shIrr(R) * 0.04 * (1.0 - vSlack) * inside;
  gl_FragColor = vec4(col, 1.0);
#endif
}
`;

export function buildKoinobori(shared, base) {
  const pos = [], nrm = [], aK = [], idx = [];
  const push = (p, n, k) => { pos.push(...p); nrm.push(...n); aK.push(...k); return pos.length / 3 - 1; };
  // 竿：伸縮のアルミ竿（上ほど細い3段）
  const S = 12, H = 11.3;
  const segs = [[0, 4.2, 0.062], [4.2, 8.0, 0.05], [8.0, H, 0.038]];
  for (const [y0, y1, r] of segs) {
    const b = pos.length / 3;
    for (let s = 0; s <= S; s++) {
      const a = (s / S) * Math.PI * 2;
      push([Math.cos(a) * r, y0 - 0.02, Math.sin(a) * r], [Math.cos(a), 0, Math.sin(a)], [y0 / H, s / S, 0, 0]);
      push([Math.cos(a) * r, y1, Math.sin(a) * r], [Math.cos(a), 0, Math.sin(a)], [y1 / H, s / S, 0, 0]);
    }
    for (let s = 0; s < S; s++) { const a = b + s * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    // 継ぎ目の輪
    const b2 = pos.length / 3;
    for (let s = 0; s <= S; s++) {
      const a = (s / S) * Math.PI * 2;
      push([Math.cos(a) * (r + 0.012), y1 - 0.06, Math.sin(a) * (r + 0.012)], [Math.cos(a), 0, Math.sin(a)], [0.99, s / S, 0, 0]);
      push([Math.cos(a) * (r + 0.012), y1, Math.sin(a) * (r + 0.012)], [Math.cos(a), 0, Math.sin(a)], [0.99, s / S, 0, 0]);
    }
    for (let s = 0; s < S; s++) { const a = b2 + s * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  // 竿の先：金の回転球（回る）
  const b0 = pos.length / 3;
  for (let j = 0; j <= 8; j++) for (let i = 0; i <= 12; i++) {
    const th = (j / 8) * Math.PI, ph = (i / 12) * Math.PI * 2;
    const n = [Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph)];
    push([n[0] * 0.13, 0.35 + n[1] * 0.13, n[2] * 0.13], n, [0, 1, 5, 0]);
  }
  for (let j = 0; j < 8; j++) for (let i = 0; i < 12; i++) { const a = b0 + j * 13 + i; idx.push(a, a + 1, a + 13, a + 1, a + 14, a + 13); }
  // 矢車：軸と8本の矢羽根（回る）
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    const c = Math.cos(a), s = Math.sin(a), c2 = Math.cos(a + 0.22), s2 = Math.sin(a + 0.22);
    const nn = [1, 0, 0];
    const kk = [0, k % 2 ? 1 : 0, 5, 1];
    // 細い軸
    const i0 = push([0, c * 0.05, s * 0.05], nn, kk), i1 = push([0, c * 0.5, s * 0.5], nn, kk), i2 = push([0, c2 * 0.5, s2 * 0.5], nn, kk), i3 = push([0, c2 * 0.05, s2 * 0.05], nn, kk);
    idx.push(i0, i1, i2, i0, i2, i3);
    // 矢じり
    const ca = Math.cos(a + 0.11), sa = Math.sin(a + 0.11);
    const j0 = push([0.01, ca * 0.62, sa * 0.62], nn, kk), j1 = push([0.01, Math.cos(a - 0.08) * 0.47, Math.sin(a - 0.08) * 0.47], nn, kk), j2 = push([0.01, Math.cos(a + 0.3) * 0.47, Math.sin(a + 0.3) * 0.47], nn, kk);
    idx.push(j0, j1, j2);
  }
  // 矢車の軸の輪
  {
    const b = pos.length / 3;
    for (let s = 0; s <= 12; s++) {
      const a = (s / 12) * Math.PI * 2;
      push([-0.04, Math.cos(a) * 0.07, Math.sin(a) * 0.07], [0, Math.cos(a), Math.sin(a)], [0, 0, 5, 1]);
      push([0.04, Math.cos(a) * 0.07, Math.sin(a) * 0.07], [0, Math.cos(a), Math.sin(a)], [0, 0, 5, 1]);
    }
    for (let s = 0; s < 12; s++) { const a = b + s * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  }
  // 吹き流しと鯉：管（長さ方向56×周方向28）
  for (let kind = 1; kind <= 4; kind++) {
    const NL = 56, NA = 28;
    const base0 = pos.length / 3;
    for (let j = 0; j <= NL; j++) for (let i = 0; i <= NA; i++) push([0, 0, 0], [0, 1, 0], [Math.pow(j / NL, 0.9), i / NA, kind, 0]);
    for (let j = 0; j < NL; j++) for (let i = 0; i < NA; i++) {
      const a = base0 + j * (NA + 1) + i;
      idx.push(a, a + NA + 1, a + 1, a + 1, a + NA + 1, a + NA + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('aK', new THREE.Float32BufferAttribute(aK, 4));
  g.setIndex(idx);
  const uniforms = { ...shared, uBase: { value: base.clone() }, uTimeK: shared.uTime };
  const mat = new THREE.ShaderMaterial({ uniforms, vertexShader: KVS, fragmentShader: KFS, side: THREE.DoubleSide });
  const m = new THREE.Mesh(g, mat);
  m.frustumCulled = false;
  // 近くの影は落とす（布の動きもそのまま）
  m.userData.depthMaterial = new THREE.ShaderMaterial({ uniforms, vertexShader: KVS, fragmentShader: KFS, defines: { DEPTH: '' }, side: THREE.DoubleSide });
  m.userData.farShadow = false;
  return m;
}
