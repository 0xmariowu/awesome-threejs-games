// 地形：64テクセル角の区画を5段階の細かさで描く（高さは頂点シェーダで高さテクスチャから）
// ＋中心の外側（遠くの山並み）を入れ子の四角い輪で描く
import * as THREE from 'three';
import { ALL, SHADOW } from './glsl.js';
import { SKY_GLSL } from './sky.js';
import { baseHeight, floorT, floorBase, setFarSmooth } from '../world/layout.js';
import { fbm2, hashf2, smoothstep } from '../util/noise.js';
import { buildDetailTextures } from './worldtex.js';

const CH = 64;           // 区画の一辺（テクセル）
const LODS = [1, 2, 4, 8, 16];

export function patchGeometry(step, skirt = true) {
  const n = CH / step + 1;
  const pos = [];
  const index = [];
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) pos.push(i * step, j * step, 0);
  for (let j = 0; j < n - 1; j++) for (let i = 0; i < n - 1; i++) {
    const a = j * n + i, b = a + 1, c = a + n, d = c + 1;
    // 対角線の向きを交互に（格子の癖を目立たせない）
    if ((i + j) & 1) index.push(a, c, b, b, c, d); else index.push(a, c, d, a, d, b);
  }
  // スカート（区画の縁を下へ垂らして、細かさの違う区画の隙間を隠す）
  if (!skirt) { const g0 = new THREE.InstancedBufferGeometry(); g0.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g0.setIndex(index); return g0; }
  const base = pos.length / 3;
  const ring = [];
  for (let i = 0; i < n; i++) ring.push([i, 0]);
  for (let j = 1; j < n; j++) ring.push([n - 1, j]);
  for (let i = n - 2; i >= 0; i--) ring.push([i, n - 1]);
  for (let j = n - 2; j >= 1; j--) ring.push([0, j]);
  for (const [i, j] of ring) pos.push(i * step, j * step, 1);
  for (let q = 0; q < ring.length; q++) {
    const [i0, j0] = ring[q], [i1, j1] = ring[(q + 1) % ring.length];
    const a = j0 * n + i0, b = j1 * n + i1, c = base + q, d = base + (q + 1) % ring.length;
    index.push(a, b, c, b, d, c, a, c, b, b, c, d); // 両面
  }
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(index);
  return g;
}

export const CHUNK = CH;
export const TERRAIN_VS = /* glsl */ `
${ALL}
attribute vec2 aChunk;
varying vec3 vWorld;
varying float vSkirt;
void main() {
  vec2 t = aChunk + position.xy;
  ivec2 ti = ivec2(min(t, vec2(uWorld.z - 1.0)));
  float h = texelFetch(tHW, ti, 0).r;
  vec3 wp = vec3(uWorld.x + t.x * uWorld.y, h, uWorld.x + t.y * uWorld.y);
  if (position.z > 0.5) wp.y -= 4.0;
  vSkirt = position.z;
  vWorld = wp;
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
}
`;

export const TERRAIN_FS = /* glsl */ `
${ALL}
${SHADOW}
${SKY_GLSL}
uniform sampler2D tNorm, tMatA, tMatB, tMatC, tSdf, tType, tDetA, tDetB;
varying vec3 vWorld;
varying float vSkirt;
// 面の向きに依らない貼り方（崖でも模様が伸びない）
float tri(vec3 p, vec3 w, float sc, int ch) {
  vec4 a = texture(tNoise, p.zy * sc), b = texture(tNoise, p.xz * sc), c = texture(tNoise, p.xy * sc);
  return (ch == 0 ? a.r : ch == 1 ? a.g : a.b) * w.x + (ch == 0 ? b.r : ch == 1 ? b.g : b.b) * w.y + (ch == 0 ? c.r : ch == 1 ? c.g : c.b) * w.z;
}
float triStrata(vec3 p, vec3 w) {
  return texture(tNoise, p.zy * vec2(0.09, 0.55)).g * w.x + texture(tNoise, p.xz * 0.09).g * w.y + texture(tNoise, p.xy * vec2(0.09, 0.55)).g * w.z;
}
// 細部テクスチャ：x=高さ(0〜1) yz=高さの傾き（高さ1あたり・1mあたり）w=色むら
vec4 detA(vec2 p, float tile) { vec4 s = texture(tDetA, p / tile); return vec4(s.r, (s.gb * 2.0 - 1.0) * (48.0 / tile), s.a); }
vec4 detB(vec2 p, float tile) { vec4 s = texture(tDetB, p / tile); return vec4(s.r, (s.gb * 2.0 - 1.0) * (24.0 / tile), s.a); }
mat2 rot2(float a) { float c = cos(a), s = sin(a); return mat2(c, s, -s, c); }
// 粗い面の鏡面（GGX・Smith・Schlick）。nl を掛けた値
float ggxSpec(vec3 N, vec3 V, vec3 L, float rough) {
  vec3 H = normalize(V + L + vec3(0.0, 1e-4, 0.0));
  float nh = max(dot(N, H), 0.0), nv = max(dot(N, V), 1e-3), nl = max(dot(N, L), 0.0), vh = max(dot(V, H), 0.0);
  float a = rough * rough, a2 = a * a;
  float d = nh * nh * (a2 - 1.0) + 1.0;
  float D = a2 / (PI * d * d + 1e-6);
  float vis = 0.5 / (nl * sqrt(nv * nv * (1.0 - a2) + a2) + nv * sqrt(nl * nl * (1.0 - a2) + a2) + 1e-5);
  float F = 0.04 + 0.96 * pow(1.0 - vh, 5.0);
  return min(D * vis * F * nl, 8.0);
}
void main() {
  vec3 wp = vWorld;
  vec2 uv = worldUV(wp.xz);
  vec4 nt = texture(tNorm, uv);
  vec3 N = normalize(nt.xyz * 2.0 - 1.0);
  vec3 Ng = N;
  float ao = nt.w;
  vec4 mA = texture(tMatA, uv);
  vec4 mB = texture(tMatB, uv);
  vec4 mC = texture(tMatC, uv);
  vec4 sd = texture(tSdf, uv);
  vec4 ty = texelFetch(tType, worldTexel(wp.xz), 0);
  int tc = int(ty.x * 255.0 + 0.5);
  float pr = ty.y;
  vec3 V = cameraPosition - wp;
  float fdist = length(V);
  V /= max(fdist, 1e-3);
  // 細部（数cm〜数十cm）の凹凸を描く距離
  float near = 1.0 - smoothstep(30.0, 80.0, fdist);

  float n1 = texture(tNoise, wp.xz / 7.3).r;
  float n2 = texture(tNoise, wp.xz / 41.0).g;
  float n3 = texture(tNoise, wp.xz / 1.7).r;
  float n4 = texture(tNoise, wp.xz / 0.53).r;
  float nw = texture(tNoise, wp.xz / 3.1).b;
  // 大きな色むら（百m〜数百m：同じ模様の繰り返しを消す）
  float m1 = texture(tNoise, wp.xz / 163.0).g;
  float m2 = texture(tNoise, wp.xz / 617.0 + 0.31).g;
  float m0 = texture(tNoise, wp.xz / 19.0 + 0.17).g;

  vec2 G = vec2(0.0);    // 細部の高さの勾配（m/m）
  float cav = 0.0;       // 細部のくぼみ（0〜1：土の塊・石のすき間）
  float specW = 0.0;     // 艶の強さ
  float rough = 0.8;

  vec3 cGrass = mix(vec3(0.13, 0.215, 0.05), vec3(0.22, 0.31, 0.08), n1);
  cGrass = mix(cGrass, vec3(0.3, 0.26, 0.13), smoothstep(0.52, 0.78, n2) * 0.55);
  cGrass *= 0.85 + 0.3 * n4;
  cGrass *= (0.9 + 0.2 * m1) * (0.93 + 0.14 * m0);
  cGrass = mix(cGrass, cGrass * vec3(1.1, 1.03, 0.75), smoothstep(0.5, 0.8, m2) * 0.45);
  vec3 cGrassFar = cGrass;
  // 草の根もと：枯れ草のかけら・土・若い芽（近くだけ。草の葉の間からのぞく）
  float wg = mA.x + mA.w * 0.7;
  if (near > 0.0 && wg > 0.01) {
    vec4 tb = detB(rot2(0.4) * wp.xz, 0.8);
    vec4 sb = detB(wp.xz + 7.1, 2.9);
    float thatch = smoothstep(0.05, 0.12, tb.w);
    vec3 dead = mix(vec3(0.17, 0.14, 0.08), vec3(0.3, 0.26, 0.15), tb.w);
    vec3 under = mix(vec3(0.07, 0.056, 0.036) * (0.8 + 0.5 * sb.x), dead, thatch * (0.35 + 0.4 * smoothstep(0.4, 0.8, n2)));
    under = mix(under, vec3(0.1, 0.17, 0.04) * (0.8 + 0.4 * n4), smoothstep(0.35, 0.6, n3 + 0.2 * sb.x) * 0.7);
    cGrass = mix(cGrass, under, 0.4 * near);
    G += (sb.yz * 0.045 + tb.yz * 0.004) * wg;
    cav += (1.0 - smoothstep(0.2, 0.55, sb.x)) * 0.5 * wg;
  }
  // 畑の土：乾いた塊の頂は明るく、すき間は湿って黒い（黒ぼく土）
  vec3 cSoil = mix(vec3(0.16, 0.11, 0.07), vec3(0.24, 0.17, 0.11), n3) * (0.8 + 0.4 * n4);
  if (mA.y > 0.01) {
    vec4 c1 = detB(wp.xz, 0.9), c2 = detB(rot2(0.7) * wp.xz + 3.7, 2.3);
    float hs = mix(0.5, c1.x * 0.4 + c2.x * 0.6, 1.0 - 0.65 * smoothstep(4.0, 14.0, fdist));
    float dry = smoothstep(0.2, 0.75, hs * 0.7 + 0.15 + 0.35 * (n2 - 0.5) + 0.25 * (m1 - 0.5));
    vec3 moist = vec3(0.085, 0.058, 0.038), dryc = mix(vec3(0.26, 0.185, 0.12), vec3(0.32, 0.24, 0.16), n1);
    cSoil = mix(moist, dryc, dry) * (0.88 + 0.24 * n4) * (0.9 + 0.2 * m1);
    // 細かな枯れ草・わらのかけら
    vec4 st = detB(rot2(2.2) * wp.xz + 1.9, 0.9);
    cSoil = mix(cSoil, vec3(0.34, 0.28, 0.16), smoothstep(0.82, 0.9, st.w) * 0.5 * near);
    G += (c1.yz * 0.022 + c2.yz * 0.05) * mA.y;
    cav += (1.0 - smoothstep(0.15, 0.55, hs)) * 0.8 * mA.y;
  }
  // 田の泥（水の下）：なめらかな泥・去年の刈り株の列
  vec3 cMud = mix(vec3(0.09, 0.08, 0.05), vec3(0.13, 0.11, 0.07), n3);
  if (mA.z > 0.01) {
    vec4 mb = detB(wp.xz, 2.3);
    cMud = mix(vec3(0.07, 0.062, 0.043), vec3(0.135, 0.115, 0.078), sat(n3 * 0.6 + mb.x * 0.7 - 0.25)) * (0.9 + 0.2 * m1);
    G += mb.yz * 0.012 * mA.z;
    if (tc == 1 && fdist < 20.0) {
      // 去年の刈り株：列は通るが株の位置は列ごとにずれ、半分は朽ちて泥に沈む
      vec2 q = rot2(pr * 3.14159) * wp.xz / vec2(0.3, 0.2);
      float row = floor(q.y);
      q.x += hashI2(ivec2(int(row), 71)) * 7.0;
      vec2 ci = floor(q);
      ivec2 cii = ivec2(ci);
      vec2 f = (fract(q) - 0.5 - (vec2(hashI2(cii), hashI2(cii + 7)) - 0.5) * vec2(0.6, 0.3)) * vec2(0.3, 0.2);
      float rs = 0.008 + 0.012 * hashI2(cii + 5);
      float spx = max(length(fwidth(wp.xz)) * 0.7, 1e-5);
      float stub = (1.0 - smoothstep(rs * 0.6 - spx, rs * 1.4 + spx, length(f))) * step(0.45, hashI2(cii + 3)) * sat(rs / spx - 0.4);
      stub *= 1.0 - smoothstep(10.0, 20.0, fdist);
      cMud = mix(cMud, mix(vec3(0.1, 0.085, 0.055), vec3(0.19, 0.16, 0.1), hashI2(cii + 11)), stub * 0.8);
    }
  }
  // れんげ：若い葉の明るい緑。花は近くの草の株がぽつぽつ描く（遠くでも緑のまま）
  float rfine = smoothstep(0.42, 0.62, n4 * 0.7 + n3 * 0.5 - 0.1 + 0.2 * nw);
  float rf = mix(rfine * 0.05, 0.035 + 0.03 * (n1 - 0.5), smoothstep(12.0, 130.0, fdist));
  vec3 cRenge = mix(mix(vec3(0.11, 0.2, 0.045), vec3(0.16, 0.25, 0.06), rfine * 0.6 + 0.2 * n3), vec3(0.4, 0.22, 0.34), rf);
  cRenge *= (0.92 + 0.16 * m1) * (0.9 + 0.2 * m0);
  // 舗装：骨材の粒・タイヤの通り道・補修のつぎはぎ・ひび・かすれた白線・欠けた路肩
  vec3 cAsph = mix(vec3(0.11, 0.11, 0.115), vec3(0.17, 0.17, 0.17), n3) * (0.85 + 0.3 * n4);
  vec3 cDirt = mix(vec3(0.19, 0.155, 0.11), vec3(0.27, 0.22, 0.16), n1) * (0.85 + 0.3 * n4);
  cDirt = mix(cDirt, cGrass * 0.8, smoothstep(0.62, 0.8, n2) * 0.5);
  if (mB.x > 0.01) {
    vec4 ag = detA(wp.xz, 0.55);
    vec4 ag2 = detA(rot2(1.1) * wp.xz + 1.3, 2.4);
    float e = -sd.y;
    vec2 du = vec2(1.0 / uWorld.z, 0.0);
    vec2 gR = vec2(texture(tSdf, uv + du.xy).y - texture(tSdf, uv - du.xy).y, texture(tSdf, uv + du.yx).y - texture(tSdf, uv - du.yx).y);
    vec2 across = gR / max(length(gR), 1e-5);
    vec2 along = vec2(-across.y, across.x);
    float s = dot(wp.xz, along), t = dot(wp.xz, across);
    vec3 cA = vec3(0.078, 0.078, 0.082) * (0.9 + 0.2 * n2) * (0.92 + 0.16 * m1);
    float stone = smoothstep(0.3, 0.6, ag.x);
    cA = mix(cA, mix(vec3(0.15, 0.145, 0.14), vec3(0.25, 0.235, 0.215), ag.w), stone * 0.5);
    float tire = exp(-pow((e - 0.55) / 0.32, 2.0)) + exp(-pow((e - 1.85) / 0.32, 2.0));
    cA *= 1.0 + 0.16 * tire - 0.08 * smoothstep(1.9, 2.3, e);
    // 補修の跡（道なりの四角いつぎはぎ）
    vec2 pc = vec2(s / 3.7, t / 1.6) + vec2(0.37, 0.11);
    ivec2 pci = ivec2(floor(pc));
    vec2 pf = fract(pc);
    vec2 pw = fwidth(pc) * 1.5 + 1e-4;
    float rect = smoothstep(0.1, 0.1 + pw.x, pf.x) * (1.0 - smoothstep(0.9 - pw.x, 0.9, pf.x)) * smoothstep(0.15, 0.15 + pw.y, pf.y) * (1.0 - smoothstep(0.85 - pw.y, 0.85, pf.y));
    float ph = hashI2(pci + 91);
    cA = mix(cA, ph > 0.965 ? vec3(0.1, 0.1, 0.1) : vec3(0.055, 0.055, 0.058), rect * step(0.93, ph));
    // ひび（路肩寄りほど多い）
    float rc = texture(tNoise, vec2(s, t) / 6.3).r;
    float cr = 1.0 - abs(rc * 2.0 - 1.0);
    float crW = fwidth(cr) * 1.2 + 0.01;
    float crack = smoothstep(0.988 - crW, 0.993, cr) * smoothstep(0.62, 0.82, texture(tNoise, wp.xz / 23.0).g + 0.3 * (1.0 - smoothstep(0.0, 0.9, e)));
    crack *= 1.0 - smoothstep(10.0, 30.0, fdist);
    cA = mix(cA, vec3(0.04, 0.039, 0.038), crack * 0.6);
    // 外側線：かすれた白線
    float lw = fwidth(e) + 0.01;
    float line = smoothstep(0.16 - lw, 0.16 + lw, e) * (1.0 - smoothstep(0.31 - lw, 0.31 + lw, e));
    line *= smoothstep(0.3, 0.6, texture(tNoise, vec2(s / 3.0, t / 0.4)).r * 0.7 + ag.w * 0.35 + 0.1);
    cA = mix(cA, vec3(0.52, 0.52, 0.49), line * 0.85 * (1.0 - stone * 0.3));
    // 欠けた路肩：土と砂利
    float edge = 1.0 - smoothstep(0.0, 0.12, e + 0.14 * (n4 - 0.5) + 0.12 * (n3 - 0.5));
    cA = mix(cA, cDirt * 0.85, edge);
    cAsph = cA;
    G += (ag.yz * 0.004 + ag2.yz * 0.003) * mB.x * (1.0 - line * 0.7);
    cav += (1.0 - stone) * 0.3 * mB.x + crack * mB.x;
    specW += 0.55 * mB.x * (1.0 - edge);
    rough = mix(rough, 0.62, mB.x);
  }
  // 土の道・砂利：踏み固めた土に小石、砂利は玉砂利をすき間なく
  if (mB.y > 0.01) {
    vec4 st = detA(wp.xz, 1.5);
    vec4 sb = detB(wp.xz + 2.3, 2.2);
    vec3 cD = mix(vec3(0.21, 0.16, 0.105), vec3(0.32, 0.255, 0.17), sat(n1 * 0.6 + sb.x * 0.5)) * (0.88 + 0.24 * n4) * (0.92 + 0.16 * m1);
    float peb = smoothstep(0.35, 0.55, st.x) * smoothstep(0.35, 0.65, n3 + 0.15 * sb.x);
    cD = mix(cD, mix(vec3(0.19, 0.165, 0.135), vec3(0.42, 0.37, 0.3), st.w), peb * 0.7);
    vec2 gD = st.yz * 0.012 * peb + sb.yz * 0.018;
    float cvD = (1.0 - smoothstep(0.1, 0.4, sb.x)) * 0.4;
    if (tc == 10) {
      vec4 gv = detA(rot2(0.6) * wp.xz, 0.75);
      float cover = smoothstep(0.12, 0.35, gv.x);
      cD = mix(vec3(0.11, 0.095, 0.075), mix(vec3(0.3, 0.27, 0.225), vec3(0.5, 0.46, 0.39), gv.w), cover);
      gD = gv.yz * 0.012;
      cvD = 1.0 - cover;
    }
    cDirt = mix(cDirt, cD, 0.85);
    G += gD * mB.y;
    cav += cvD * mB.y;
  }
  // 林床：落ち葉（コナラ・クヌギの乾いた葉、杉の赤茶の葉）・黒い腐植・苔の斑。竹林はわら色の細長い竹の葉
  vec3 cForest = mix(vec3(0.05, 0.062, 0.032), vec3(0.1, 0.088, 0.052), n1);
  if (mB.z > 0.01) {
    vec4 l1 = detB(wp.xz, 3.4), l2 = detB(rot2(1.9) * wp.xz + 5.3, 1.9);
    float top = step(0.05, l1.w);
    float lt = mix(l2.w, l1.w, top);
    float cover = smoothstep(0.02, 0.08, max(l1.w, l2.w));
    // 葉ごとに色が大きく違う：濡れた黒茶・赤茶・乾いた淡い灰褐色
    float lt2 = lt * lt;
    vec3 leafC = mix(vec3(0.045, 0.031, 0.019), vec3(0.2, 0.16, 0.108), lt2);
    leafC = mix(leafC, vec3(0.15, 0.075, 0.035) * (0.8 + 0.4 * lt), smoothstep(0.35, 0.65, fract(lt * 5.3)) * 0.35);
    leafC = mix(leafC, vec3(0.2, 0.095, 0.045) * (0.7 + 0.5 * lt), smoothstep(0.55, 0.8, n2 + 0.2 * (m1 - 0.5)) * 0.6);
    leafC = mix(leafC, vec3(dot(leafC, vec3(0.33))) * vec3(0.95, 0.92, 0.85), smoothstep(0.55, 0.8, n1) * 0.3);
    // 竹林らしさ：種類コード17を2×2で双線形に読み、雑音でゆらした閾値で混ぜる（最近傍だと升目の四角い縁が出る）
    vec2 tcf = (wp.xz - uWorld.x) / uWorld.y;
    ivec2 t0 = ivec2(floor(tcf)), tmx = ivec2(int(uWorld.z) - 1);
    vec2 tf = fract(tcf);
    float b00 = float(int(texelFetch(tType, clamp(t0, ivec2(0), tmx), 0).x * 255.0 + 0.5) == 17);
    float b10 = float(int(texelFetch(tType, clamp(t0 + ivec2(1, 0), ivec2(0), tmx), 0).x * 255.0 + 0.5) == 17);
    float b01 = float(int(texelFetch(tType, clamp(t0 + ivec2(0, 1), ivec2(0), tmx), 0).x * 255.0 + 0.5) == 17);
    float b11 = float(int(texelFetch(tType, clamp(t0 + ivec2(1, 1), ivec2(0), tmx), 0).x * 255.0 + 0.5) == 17);
    float bam = mix(mix(b00, b10, tf.x), mix(b01, b11, tf.x), tf.y);
    float bamW = smoothstep(0.25, 0.75, bam + 0.45 * (n3 - 0.5) + 0.25 * (n1 - 0.5));
    if (bamW > 0.001) {
      // 竹の葉：細長い葉が向きを変えて2層に積もる。わら色〜黄褐色、古い葉は灰褐色に朽ちる
      vec4 k1 = detB(rot2(0.6) * wp.xz * vec2(1.0, 3.4), 6.5);
      vec4 k2 = detB(rot2(2.7) * wp.xz * vec2(1.0, 3.8) + 3.1, 5.0);
      vec4 k3 = detB(rot2(4.6) * wp.xz * vec2(1.0, 3.6) + 1.3, 5.7);
      float kt = k1.w > 0.05 ? k1.w : k2.w > 0.05 ? k2.w * 0.85 : k3.w * 0.7;
      float kcov = smoothstep(0.02, 0.08, max(max(k1.w, k2.w), k3.w));
      vec3 bl = mix(vec3(0.09, 0.066, 0.038), vec3(0.28, 0.21, 0.11), kt);
      bl = mix(bl, vec3(0.16, 0.13, 0.085) * (0.8 + 0.4 * kt), smoothstep(0.5, 0.75, n2 + 0.3 * (n4 - 0.5)) * 0.4);
      bl = mix(vec3(0.035, 0.028, 0.02), bl, kcov);
      leafC = mix(leafC, bl, bamW);
      lt = mix(lt, kt, bamW);
      cover = mix(cover, max(kcov, 0.7), bamW);
    }
    vec3 cF = mix(vec3(0.04, 0.03, 0.02), leafC, cover);
    // 湿った腐植の斑（数mの単位で暗い）と、日の当たる乾いた所
    float hum = smoothstep(0.5, 0.78, n3 * 0.55 + n2 * 0.35 + 0.3 * (m0 - 0.5) + 0.05);
    cF = mix(cF, cF * vec3(0.55, 0.52, 0.5), hum * 0.7);
    cF *= 0.85 + 0.3 * n1;
    // 林の密度で暗く（竹林は葉が厚く積もり、光が少ない）
    cF *= mix(1.0, 0.74 - 0.1 * ty.z, bamW);
    // 落ちた小枝（近くだけ：0.55mの升ごとに1本）
    if (fdist < 14.0) {
      vec2 tq = wp.xz / 0.55;
      ivec2 tci = ivec2(floor(tq));
      float th = hashI2(tci + 313) * 6.2832;
      vec2 td = vec2(cos(th), sin(th));
      vec2 tp = fract(tq) - 0.5 - (vec2(hashI2(tci + 17), hashI2(tci + 29)) - 0.5) * 0.4;
      float ta = dot(tp, td), tb = dot(tp, vec2(-td.y, td.x));
      float tw = (0.008 + 0.012 * hashI2(tci + 41)) / 0.55;
      float twAA = fwidth(tb) + 1e-4;
      float twig = (1.0 - smoothstep(tw - twAA, tw + twAA, abs(tb))) * (1.0 - smoothstep(0.3, 0.36, abs(ta))) * step(0.55, hashI2(tci + 53));
      twig *= (1.0 - smoothstep(8.0, 14.0, fdist)) * sat(tw / twAA - 0.3) * (1.0 - 0.6 * bamW);
      cF = mix(cF, mix(vec3(0.05, 0.036, 0.024), vec3(0.2, 0.16, 0.11), hashI2(tci + 67)), twig);
    }
    float moss = smoothstep(0.6, 0.8, n1 * 0.55 + n3 * 0.35 + 0.25 * (m1 - 0.5) + 0.1);
    cF = mix(cF, vec3(0.05, 0.095, 0.028) * (0.8 + 0.5 * n4), moss * 0.75 * (1.0 - 0.7 * bamW));
    // 林のまばらな所・林縁は下草とササ、若い芽がまだらに混じる（草地との境は雑音で1〜3mゆらぐ）
    float fwt = mB.z / max(dot(mA, vec4(1.0)) + dot(mB, vec4(1.0)) + mC.x + mC.y + mC.z, 1e-3);
    float rim = 1.0 - smoothstep(0.45, 0.9, fwt + 0.35 * (n3 - 0.5) + 0.2 * (n1 - 0.5));
    float open_ = max(1.0 - smoothstep(0.45, 0.95, ty.z), rim * 0.85) * (1.0 - bamW);
    vec3 under = mix(vec3(0.065, 0.1, 0.032), vec3(0.13, 0.16, 0.055), n1) * (0.85 + 0.3 * n4);
    under = mix(under, vec3(0.1, 0.14, 0.05) * (0.8 + 0.4 * n3), smoothstep(0.5, 0.7, n2) * 0.5); // ササの群れ
    cF = mix(cF, under, open_ * smoothstep(0.3, 0.6, n3 * 0.6 + n2 * 0.6 - 0.1 + 0.25 * rim) * 0.85);
    // 遠くは木陰の暗さも含めた平均の色へ：彩度を落とした暗い灰褐色に下草の緑がまだらに
    vec3 farF = mix(vec3(0.052, 0.05, 0.036), vec3(0.07, 0.068, 0.045), n1);
    farF = mix(farF, under * 0.8, smoothstep(0.45, 0.7, n3 * 0.5 + n2 * 0.5 + 0.3 * rim) * 0.6);
    farF = mix(farF, vec3(0.1, 0.085, 0.055), bamW * 0.6);
    cForest = mix(farF, cF, 0.25 + 0.75 * near);
    G += (l1.yz * 0.0025 + l2.yz * 0.002) * mB.z * (1.0 - bamW);
    cav += (1.0 - cover) * 0.4 * mB.z;
  }
  vec3 cNana = mix(vec3(0.14, 0.23, 0.05), vec3(0.62, 0.5, 0.06), smoothstep(0.3, 0.65, n4 * 0.5 + n3 * 0.5 + n1 * 0.3 - 0.15));
  cNana *= 0.8 + 0.35 * n2;
  // 滝の谷：岩・苔・川床の小石
  float rockW = mC.x + mC.z;
  vec3 cRock = vec3(0.0), cPeb = vec3(0.0);
  float wetSheen = 0.0;
  if (rockW > 0.002) {
    vec3 an = abs(N); an = an * an * an * an; an /= (an.x + an.y + an.z);
    float strata = triStrata(wp, an);
    float cell = tri(wp, an, 0.29, 2);
    float fine = tri(wp, an, 1.7, 0);
    float mid = tri(wp, an, 0.45, 0);
    // 層ごとに色の違う岩（灰・茶・青み）。大きな単位でも色がゆらぐ
    float layer = texture(tNoise, vec2(wp.y * 0.21 + mid * 0.6, (wp.x + wp.z) * 0.004)).g;
    vec3 rA = mix(vec3(0.12, 0.115, 0.105), vec3(0.16, 0.13, 0.1), smoothstep(0.3, 0.7, layer));
    vec3 rB = mix(vec3(0.27, 0.26, 0.24), vec3(0.3, 0.26, 0.21), smoothstep(0.4, 0.8, layer));
    cRock = mix(rA, rB, smoothstep(0.3, 0.8, strata * 0.55 + fine * 0.3 + mid * 0.25));
    cRock *= 0.8 + 0.4 * texture(tNoise, wp.xz * 0.013 + wp.y * 0.008).g;
    cRock *= 0.55 + 0.45 * smoothstep(0.04, 0.3, cell);
    cRock *= 0.82 + 0.34 * fine;
    // 立った面：縦の節理（暗い割れ目）と、上から垂れた水の筋
    float vert = 1.0 - smoothstep(0.35, 0.7, N.y);
    float jt = texture(tNoise, vec2((wp.x + wp.z) * 0.33, wp.y * 0.035)).b;
    cRock *= mix(1.0, 0.45 + 0.55 * smoothstep(0.03, 0.16, jt), vert);
    float stk = texture(tNoise, vec2((wp.x * 0.7 - wp.z * 0.7) * 0.5, wp.y * 0.025)).r;
    cRock *= mix(1.0, 0.62, smoothstep(0.55, 0.75, stk) * vert);
    // 染み出す水の筋に沿った苔（縦の緑の帯）
    float seep = texture(tNoise, vec2((wp.x * 0.7 - wp.z * 0.7) * 0.18 + 5.0, wp.y * 0.012)).g;
    cRock = mix(cRock, vec3(0.05, 0.1, 0.03) * (0.8 + 0.5 * fine), smoothstep(0.6, 0.72, seep) * vert * 0.75);
    // 上を向いた面は苔、ところどころ地衣の明るい斑
    float mossTop = smoothstep(0.42, 0.82, N.y + 0.3 * (mid - 0.5)) * (0.5 + 0.5 * smoothstep(0.35, 0.7, strata));
    cRock = mix(cRock, vec3(0.06, 0.12, 0.032) * (0.75 + 0.6 * fine), mossTop * 0.88);
    cRock = mix(cRock, vec3(0.55, 0.56, 0.46), smoothstep(0.78, 0.9, tri(wp, an, 0.9, 2) * 0.5 + fine * 0.6) * 0.35 * (1.0 - mossTop));
    // 川床：大きな玉石の間に小石と砂。水の中の石は珪藻でうっすら茶緑
    vec4 pa = detA(wp.xz, 1.2), pb = detA(rot2(0.8) * wp.xz + 2.0, 4.6);
    float big = step(pa.x * 0.75, pb.x);
    float phh = max(pa.x * 0.75, pb.x);
    float tone = mix(pa.w, pb.w, big);
    cPeb = mix(vec3(0.13, 0.12, 0.105), vec3(0.45, 0.42, 0.37), tone * 0.8 + n3 * 0.2);
    cPeb = mix(cPeb, cPeb * vec3(0.75, 0.8, 0.55), smoothstep(0.3, 0.7, n2) * 0.6);
    cPeb = mix(vec3(0.16, 0.14, 0.11), cPeb, smoothstep(0.08, 0.3, phh));
    cPeb *= 0.55 + 0.45 * smoothstep(0.05, 0.4, phh);
    G += (pa.yz * 0.012 * (1.0 - big) + pb.yz * 0.05 * big) * mC.z;
    cav += (1.0 - smoothstep(0.05, 0.35, phh)) * 0.7 * mC.z;
    // 岩の凹凸（画面の微分で法線を揺らす）
    float hb = (strata * 0.45 + cell * 0.35 + fine * 0.2) * 0.45 * mC.x;
    vec3 dpx = dFdx(wp), dpy = dFdy(wp);
    float dhx = dFdx(hb), dhy = dFdy(hb);
    vec3 r1 = cross(dpy, N), r2 = cross(N, dpx);
    float det = dot(dpx, r1);
    vec3 grad = sign(det) * (dhx * r1 + dhy * r2);
    vec3 nb = abs(det) * N - grad;
    N = normalize(mix(N, nb / max(length(nb), 1e-6), min(mC.x, 1.0) * (1.0 - smoothstep(40.0, 120.0, fdist))));
    // 濡れて暗く、艶が出る
    wetSheen = mC.w;
  }
  vec3 cMoss = mix(vec3(0.045, 0.095, 0.025), vec3(0.12, 0.185, 0.045), smoothstep(0.25, 0.8, n1 * 0.6 + n3 * 0.4)) * (0.8 + 0.45 * n4);
  cMoss = mix(cMoss, vec3(0.2, 0.17, 0.1), smoothstep(0.7, 0.85, n2) * 0.35);
  float ws = dot(mA, vec4(1.0)) + dot(mB, vec4(1.0)) + mC.x + mC.y + mC.z + 1e-4;
  vec3 alb = (cGrass * mA.x + cSoil * mA.y + cMud * mA.z + cRenge * mA.w + cAsph * mB.x + cDirt * mB.y + cForest * mB.z + cNana * mB.w + cRock * mC.x + cMoss * mC.y + cPeb * mC.z) / ws;
  G /= ws;
  cav /= ws;
  alb *= mix(1.0, 0.58, wetSheen * min(rockW + mC.y, 1.0));

  // 急な法面は草に覆われる（岩と苔の谷は除く）。ところどころ枯れ草と赤土がのぞく
  float steep = 1.0 - smoothstep(0.62, 0.85, N.y);
  // 林・川床・岩の重み（ぼかした重みで：種類コードで分けると1.5mの升目の段が出る）
  float notBank = sat((mB.z + mC.x + mC.y + mC.z) / ws * 1.6);
  {
    vec3 bank = mix(cGrassFar * (0.8 + 0.3 * n1), vec3(0.26, 0.22, 0.12) * (0.8 + 0.3 * n4), smoothstep(0.55, 0.8, n2 + 0.25 * (n3 - 0.5)) * 0.45);
    alb = mix(alb, bank, steep * 0.9 * (1.0 - notBank));
  }
  // 林の急斜面：赤土（ローム）の崩れと根
  alb = mix(alb, vec3(0.15, 0.11, 0.075) * (0.75 + 0.4 * n3), smoothstep(0.5, 0.35, N.y) * smoothstep(0.7, 0.82, n3 * 0.6 + n2 * 0.4 + 0.3 * (n1 - 0.5)) * 0.3 * sat(mB.z / ws));
  // 屋敷の庭：踏み固めた土に苔と砂利
  if (tc == 14 && N.y > 0.8) {
    // 真砂土を踏み固めた庭：明るい灰褐色に細かな砂粒、雨だれの湿りと苔、ところどころ砂利
    vec4 gs = detB(wp.xz * 1.7 + 3.1, 1.1);
    vec3 earth = mix(vec3(0.14, 0.115, 0.08), vec3(0.25, 0.205, 0.145), sat(n1 * 0.5 + gs.x * 0.9 - 0.2)) * (0.85 + 0.3 * n4);
    earth = mix(earth, earth * vec3(0.62, 0.6, 0.58), smoothstep(0.55, 0.8, n2 + 0.25 * (m0 - 0.5)) * 0.6);
    vec3 moss = mix(vec3(0.05, 0.075, 0.03), vec3(0.09, 0.12, 0.045), n3);
    alb = mix(earth, moss, smoothstep(0.62, 0.85, n2 + 0.3 * n3 - 0.15) * 0.85);
    vec4 gv = detA(wp.xz, 0.9);
    // 砂利の溜まり＋散らばった小石
    float gpatch = max(smoothstep(0.68, 0.85, n3 + 0.15 * m0), step(0.93, gv.w) * 0.8);
    alb = mix(alb, mix(vec3(0.16, 0.155, 0.14), vec3(0.32, 0.3, 0.27), gv.w), smoothstep(0.3, 0.5, gv.x) * gpatch * 0.8);
    G += gv.yz * 0.008 * gpatch + gs.yz * 0.01;
    cav += (1.0 - smoothstep(0.2, 0.5, gs.x)) * 0.2;
  }
  // 耕した田・畑：区画ごとの向きの畝
  if (tc == 4 || tc == 6 || tc == 15) {
    float a = pr * 3.14159;
    vec2 dir = vec2(cos(a), sin(a));
    float fr = tc == 4 ? 9.0 : 4.2;
    float ph = dot(wp.xz, dir) * fr;
    float aa = 1.0 - smoothstep(0.6, 2.2, fwidth(ph));
    float sp = sin(ph), cp = cos(ph);
    if (tc == 4) {
      // 田起こし：ロータリーの筋（細かい）＋トラクターの往復の帯（中距離で見える）＋縁の回り道
      alb *= mix(1.0, 0.74 + 0.44 * smoothstep(-0.6, 0.8, sin(ph + 1.5 * n3)), aa);
      G += dir * cp * fr * 0.075 * aa;
      float lane = dot(wp.xz, dir) / 2.05;
      float la = 1.0 - smoothstep(0.25, 0.9, fwidth(lane));
      float headland = 1.0 - smoothstep(2.5, 4.5, sd.x);
      float lh = hashI2(ivec2(int(floor(lane)), int(pr * 977.0)));
      alb *= 1.0 + ((lh - 0.5) * 0.28 * la + 0.07 * sin(lane * 3.14159 + 0.8 * n2)) * (1.0 - headland) - 0.07 * headland;
    } else {
      // 畝：頂は乾いて明るく、溝は湿って暗い。側面は日を受ける向きで明暗
      float bed = smoothstep(-0.4, 0.4, sp);
      alb *= mix(1.0, mix(0.68, 1.1, bed), aa);
      G += dir * cp * fr * 0.1 * (1.0 - smoothstep(0.4, 0.95, abs(sp))) * aa;
      cav += (1.0 - bed) * 0.4 * aa;
    }
  }
  // 田の畦（距離場で細く鋭く）
  bool paddy = tc >= 1 && tc <= 6;
  if (paddy) alb *= 0.88 + 0.24 * pr;
  if (paddy) {
    float lev = 1.0 - smoothstep(0.22, 0.55, sd.x);
    float rim = smoothstep(0.3, 0.55, sd.x) * (1.0 - smoothstep(0.55, 1.2, sd.x));
    alb = mix(alb, cMud * 0.8, rim * 0.6 * float(tc != 4));
    alb = mix(alb, cGrass * 1.08, lev);
  }
  // 農道（中央の草・二本の轍）。轍は踏み固められて少し低く、湿って暗い
  if (sd.w < 1.4) {
    float c = abs(sd.w);
    vec3 track = mix(cDirt, cGrass, 1.0 - smoothstep(0.18, 0.32, c));
    track = mix(track, cGrass, smoothstep(1.0, 1.35, c));
    float rut = smoothstep(0.3, 0.5, c) * (1.0 - smoothstep(0.82, 1.02, c));
    track *= 1.0 - 0.28 * rut * (0.6 + 0.4 * n3);
    alb = mix(alb, track, 1.0 - smoothstep(1.2, 1.4, c));
  }
  // 桜の下の散った花びら
  float petals = ty.w;
  if (petals > 0.0) {
    float sp = step(1.0 - petals * 0.32, texture(tNoise, wp.xz / 0.37).a) + step(1.0 - petals * 0.22, texture(tNoise, wp.xz / 0.23 + 0.5).a);
    alb = mix(alb, vec3(0.8, 0.62, 0.68), min(sp, 1.0) * 0.85 * (1.0 - smoothstep(60.0, 140.0, fdist)));
    alb = mix(alb, vec3(0.62, 0.5, 0.52), petals * 0.25 * smoothstep(40.0, 160.0, fdist));
  }
  // 水ぎわの濡れ：水面のすぐ上の土は黒く湿り、艶が出る（岩と苔は上で別に）
  float wet = mC.w * (1.0 - min(rockW + mC.y, 1.0)) * (1.0 - 0.5 * mA.x);
  if (wet > 0.003) {
    // 水の下の泥は水面の側で描くので、ここでは水より上だけ
    float under = step(wp.y + 0.01, texelFetch(tHW, worldTexel(wp.xz), 0).g);
    float wn = sat(wet * (1.15 + 0.5 * (n3 - 0.5))) * (1.0 - under);
    alb *= mix(1.0, 0.55, wn);
    specW = max(specW, wn * 0.22);
    rough = mix(rough, 0.5, wn);
  }
  // 風の筋：突風の下で草が倒れて明るく見える
  float gust = gustField(wp.xz);
  alb *= 1.0 + gust * 0.22 * (mA.x + mA.w * 0.6 + mB.w * 0.5);
  // 草の葉が描かれない中〜遠距離の草地：株の粗密・区画ごとの色の違い・草むらの見え方（視線と日の向き）
  float gw = sat((mA.x + mA.w * 0.9 + mB.w * 0.5) / ws);
  gw = max(gw, steep * 0.9 * (1.0 - notBank));
  gw *= 1.0 - min(rockW + mC.y, 1.0);
  float ffar = smoothstep(45.0, 150.0, fdist);
  if (gw * ffar > 0.01) {
    float gf = gw * ffar;
    // 株の粗密（数十cm〜2m。遠くはミップで平均され消える）
    float cl = texture(tNoise, wp.xz / 2.1 + 0.37).r * 0.6 + texture(tNoise, rot2(0.9) * wp.xz / 0.83).g * 0.4;
    alb *= 1.0 + (cl - 0.5) * 0.6 * gf;
    // 数m〜数十mの斑：湿って茂った濃い所・乾いて薄い所
    float lush = smoothstep(0.52, 0.76, n1 * 0.45 + m0 * 0.55 + 0.15 * (nw - 0.5));
    alb = mix(alb, alb * vec3(0.74, 0.84, 0.78), lush * 0.55 * gf);
    float dryP = smoothstep(0.6, 0.82, n2 * 0.6 + (1.0 - m0) * 0.4 + 0.2 * (n3 - 0.5));
    alb = mix(alb, vec3(0.26, 0.245, 0.14) * (0.85 + 0.3 * n1), dryP * 0.28 * gf);
    // 春先の草地は冬越しの枯れ草が株の間に残る（遠くでは平均されて少しくすんだ黄緑に）
    float straw = smoothstep(0.35, 0.8, n3 * 0.45 + cl * 0.45 + 0.3 * (n2 - 0.5) + 0.1) * (0.3 + 0.3 * m1);
    alb = mix(alb, vec3(0.28, 0.25, 0.155) * (0.8 + 0.4 * n4), straw * gf);
    // 遠くの草地は葉の影と枯れ葉が混ざって少しくすむ（写真の草地の彩度）
    alb = mix(alb, vec3(dot(alb, vec3(0.3, 0.59, 0.11))), 0.16 * gf) * (1.0 - 0.05 * gf);
    // 区画ごと（刈った時期・草の種類）の色の違い
    if (tc == 3 || tc == 5 || tc == 7 || tc == 19) {
      alb *= mix(vec3(0.9, 0.96, 1.04), vec3(1.07, 1.02, 0.86), pr) * (0.9 + 0.2 * fract(pr * 7.31)) * gf + (1.0 - gf);
    }
  }
  if (gw > 0.01) {
    // 草むらの見え方：日を背にすると葉の影が隠れて明るく（ホットスポット）、日に向かうと影の面が見えて暗い
    float vs = dot(V, uSunDir);
    alb *= 1.0 + gw * (0.28 * pow(max(vs, 0.0), 6.0) - 0.14 * pow(max(-vs, 0.0), 2.0) * ffar);
    // 浅い角度では葉のろうの艶で空が白っぽく映る
    specW = max(specW, gw * 0.1 * ffar);
    rough = mix(rough, 0.72, gw * ffar);
  }

  // 細部の凹凸を法線へ（近くだけ）
  G *= near * sat(N.y * 1.6);
  float gl = length(G);
  if (gl > 2.5) G *= 2.5 / gl;
  vec3 nb = N - vec3(G.x, 0.0, G.y);
  N = nb / max(length(nb), 1e-4);
  float nlG = max(dot(Ng, uSunDir), 0.0);
  float nl = max(dot(N, uSunDir), 0.0);
  float sh = sunShadow(wp, nlG, gl_FragCoord.xy) * cloudShadow(wp);
  // くぼみの暗さ：塊や石のすき間は空の光も日も届きにくい
  float cv = sat(cav) * near;
  ao *= 1.0 - 0.5 * cv;
  // 遠くの林床：影の地図の粗さで抜ける樹冠の陰を、林の密度で近似する
  float fcan = sat(mB.z / ws) * ty.z * (1.0 - near);
  vec3 col = alb * (uSunCol * nl * sh * (1.0 - 0.35 * cv) * (1.0 - 0.4 * fcan) + shIrr(N) * ao * (1.0 - 0.15 * fcan));
  // 艶（舗装・濡れた土）：日の照り返しと空の映り込み
  if (specW > 0.002) {
    col += uSunCol * sh * ggxSpec(N, V, uSunDir, rough) * specW;
    vec3 R = reflect(-V, N);
    float F = 0.04 + 0.96 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
    col += mix(skyRadiance(R), shIrr(R), rough) * F * specW * ao * (1.0 - 0.6 * rough);
  }
  // 濡れた岩の艶
  if (wetSheen > 0.01) {
    vec3 Hh = normalize(uSunDir + V);
    col += uSunCol * pow(max(dot(N, Hh), 0.0), 55.0) * 0.35 * wetSheen * sh * min(rockW + mC.y, 1.0);
  }
  gl_FragColor = vec4(col, 1.0);
}
`;

export const DEPTH_FS = /* glsl */ `void main() { gl_FragColor = vec4(1.0); }`;

export class Terrain {
  // 地面の細部テクスチャ（一度だけ作る）
  static detail() {
    if (!Terrain._det) {
      const t0 = performance.now();
      const d = buildDetailTextures();
      Terrain._det = { tDetA: { value: d.tDetA }, tDetB: { value: d.tDetB } };
      (window.__boot ||= []).push([`detailTex ${Math.round(performance.now() - t0)}ms`, Math.round(performance.now())]);
    }
    return Terrain._det;
  }
  constructor(world, shared, textures) {
    this.world = world;
    const N = world.N;
    this.nChunks = (N - 1) / CH;
    // 区画ごとの高さの範囲
    const H = world.height;
    this.bounds = [];
    for (let cj = 0; cj < this.nChunks; cj++) for (let ci = 0; ci < this.nChunks; ci++) {
      let mn = 1e9, mx = -1e9;
      for (let j = cj * CH; j <= (cj + 1) * CH; j++) for (let i = ci * CH; i <= (ci + 1) * CH; i++) {
        const v = H[j * N + i]; if (v < mn) mn = v; if (v > mx) mx = v;
      }
      const x0 = world.ORIGIN + ci * CH * world.CELL, z0 = world.ORIGIN + cj * CH * world.CELL;
      this.bounds.push({ ci, cj, box: new THREE.Box3(new THREE.Vector3(x0, mn - 4, z0), new THREE.Vector3(x0 + CH * world.CELL, mx + 1, z0 + CH * world.CELL)) });
    }
    this.material = new THREE.ShaderMaterial({
      uniforms: { ...shared, ...textures, ...Terrain.detail() },
      vertexShader: TERRAIN_VS,
      fragmentShader: TERRAIN_FS,
    });
    this.depthMaterial = new THREE.ShaderMaterial({ uniforms: { ...shared }, vertexShader: TERRAIN_VS, fragmentShader: DEPTH_FS });
    this.group = new THREE.Group();
    this.levels = LODS.map((step) => {
      const g = patchGeometry(step);
      const arr = new Float32Array(this.nChunks * this.nChunks * 2);
      const attr = new THREE.InstancedBufferAttribute(arr, 2);
      attr.setUsage(THREE.DynamicDrawUsage);
      g.setAttribute('aChunk', attr);
      g.instanceCount = 0;
      const m = new THREE.Mesh(g, this.material);
      m.frustumCulled = false;
      m.userData.depthMaterial = this.depthMaterial;
      this.group.add(m);
      return { step, g, attr, mesh: m };
    });
    this._frustum = new THREE.Frustum();
    this._m = new THREE.Matrix4();
  }

  // 視点に応じて区画の細かさを選ぶ（all=true なら視錐台で間引かない：影用）
  update(camera, all = false) {
    const cp = camera.position;
    this._m.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    this._frustum.setFromProjectionMatrix(this._m, camera.coordinateSystem, camera.reversedDepth);
    const counts = [0, 0, 0, 0, 0];
    const v = new THREE.Vector3();
    for (const b of this.bounds) {
      if (!all && !this._frustum.intersectsBox(b.box)) continue;
      b.box.clampPoint(cp, v);
      const d = all ? 5000 : v.distanceTo(cp);
      const L = d < 130 ? 0 : d < 300 ? 1 : d < 620 ? 2 : d < 1150 ? 3 : 4;
      const lv = this.levels[L];
      lv.attr.array[counts[L] * 2] = b.ci * CH;
      lv.attr.array[counts[L] * 2 + 1] = b.cj * CH;
      counts[L]++;
    }
    for (let L = 0; L < 5; L++) {
      const lv = this.levels[L];
      lv.g.instanceCount = counts[L];
      lv.attr.clearUpdateRanges();
      lv.attr.addUpdateRange(0, counts[L] * 2);
      lv.attr.needsUpdate = true;
    }
  }
}

// ---- 遠景：中心の外側の入れ子の輪 ----
const FAR_VS = /* glsl */ `
${ALL}
attribute vec3 aInfo; // x=谷底らしさ y=森らしさ z=尾根(+)／谷筋(-)
varying vec3 vWorld;
varying vec3 vN;
varying vec3 vInfo;
void main() {
  vWorld = position;
  vN = normal;
  vInfo = aInfo;
  gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0);
}
`;
const FAR_FS = /* glsl */ `
${ALL}
${SHADOW}
${SKY_GLSL}
varying vec3 vWorld;
varying vec3 vN;
varying vec3 vInfo;
// 樹冠：格子ごとに1本。半径は木ごとに0.45〜0.75（大きい木が小さい木に覆いかぶさる）
// x=樹冠の半径で割った中心からの距離 yz=中心からの向き（半径で割る） w=木の番号
vec4 crown(vec2 p) {
  vec2 ip = floor(p), fp = p - ip;
  float best = 9.0, id = 0.0;
  vec2 bd = vec2(0.0);
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    ivec2 c = ivec2(ip) + ivec2(i, j);
    vec2 o = vec2(hashI2(c), hashI2(c + 1013)) * 0.76 + 0.12;
    vec2 d = vec2(i, j) + o - fp;
    float r = 0.45 + 0.3 * hashI2(c + 3031);
    float dd = length(d) / r;
    if (dd < best) { best = dd; bd = d / r; id = hashI2(c + 2029); }
  }
  return vec4(best, -bd, id);
}
// 1つの面（A・B＝面の軸、Cn＝面の外向き）に貼った樹冠。戻り値：x=日の当たり y=空の光 z=木の番号 w=山桜の花
vec4 crownPlane(vec2 p, vec3 A, vec3 B, vec3 Cn, float csz, bool cedar, float pinkP) {
  vec2 cp = p / csz;
  // 縁を雑音で揺らす（枝張りの不ぞろい）
  vec2 wob = vec2(texture(tNoise, p / (csz * 4.8)).r, texture(tNoise, p / (csz * 4.8) + 0.5).r) - 0.5;
  cp += wob * 0.42;
  vec4 cr = crown(cp);
  float rr = cr.x;
  vec2 q = cr.yz;
  // 樹冠の中の小さな枝葉の塊
  float clump = texture(tNoise, p / (csz * 1.1) + cr.w * 7.0).r;
  float hh = sqrt(max(1.0 - rr * rr, 0.0));
  vec3 cn = normalize(A * (q.x + (clump - 0.5) * 0.9) + B * (q.y + (clump - 0.5) * 0.5) + Cn * max(hh, 0.15) * (cedar ? 0.7 : 1.0));
  float gap = smoothstep(0.86, 1.06, rr + 0.25 * (clump - 0.5));
  // 隣の木の落ち影：日の方へずらした所に別の木の樹冠があれば陰
  vec2 so = vec2(dot(uSunDir, A), dot(uSunDir, B)) / max(dot(uSunDir, Cn), 0.3) * (cedar ? 0.55 : 0.4);
  vec4 cr2 = crown(cp + so);
  float castS = (1.0 - smoothstep(0.8, 1.02, cr2.x)) * max(gap, step(0.001, abs(cr2.w - cr.w)) * smoothstep(0.2, 0.7, rr));
  float lit = max(dot(cn, uSunDir), 0.0) / max(uSunDir.y, 0.2);
  float cS = mix(0.4 + 0.65 * lit, 0.14, gap) * (1.0 - 0.7 * castS);
  float cA = mix(0.7 + 0.34 * max(cn.y, 0.0), 0.36, gap) * (1.0 - 0.2 * castS);
  float bloom = step(1.0 - pinkP, cr.w) * smoothstep(0.42, 0.6, clump + 0.3 * (texture(tNoise, p / (csz * 0.6) + 0.71).r - 0.5)) * (1.0 - gap);
  return vec4(cS, cA, cr.w, bloom);
}
// 一帯ごとの作物の割合（x=水を張った田 y=耕した田 z=れんげ w=休耕の草。残り＝菜の花）：gen.js の rTypes と同じ割合
vec4 fieldMix(float b) {
  return b > 0.1 ? vec4(0.906, 0.019, 0.019, 0.0375) : b < -0.3 ? vec4(0.094, 0.031, 0.531, 0.3125) : b < -0.05 ? vec4(0.415, 0.185, 0.025, 0.35) : vec4(0.64, 0.14, 0.02, 0.18);
}
vec4 fieldMixS(float b) {
  vec4 A = vec4(0.906, 0.019, 0.019, 0.0375), B = vec4(0.094, 0.031, 0.531, 0.3125), C = vec4(0.415, 0.185, 0.025, 0.35), D = vec4(0.64, 0.14, 0.02, 0.18);
  return mix(mix(mix(B, C, smoothstep(-0.36, -0.24, b)), D, smoothstep(-0.11, 0.01, b)), A, smoothstep(0.04, 0.16, b));
}
void main() {
  vec3 wp = vWorld;
  vec3 N = normalize(vN);
  vec3 V = cameraPosition - wp;
  float dist = length(V);
  V /= max(dist, 1e-3);
  float fw = max(length(fwidth(wp.xz)), 1e-3);   // 1画素の大きさ（m）
  float relief = 1.0 - vInfo.x;
  // 山肌の細かな起伏：雑音の勾配で法線を揺らす（1画素より十分大きい単位だけ）
  float sc = max(mix(30.0, 140.0, smoothstep(1500.0, 9000.0, dist)), fw * 8.0);
  vec2 e = vec2(sc * 0.15, 0.0);
  float b0 = texture(tNoise, wp.xz / sc).r;
  float bx = texture(tNoise, (wp.xz + e.xy) / sc).r, bz = texture(tNoise, (wp.xz + e.yx) / sc).r;
  float g0 = texture(tNoise, wp.xz / (sc * 4.3)).g;
  float gx = texture(tNoise, (wp.xz + e.xy * 4.3) / (sc * 4.3)).g, gz = texture(tNoise, (wp.xz + e.yx * 4.3) / (sc * 4.3)).g;
  vec2 grad = vec2(bx - b0, bz - b0) * 2.2 + vec2(gx - g0, gz - g0) * 2.6;
  N = normalize(N + vec3(grad.x, 0.0, grad.y) * (0.45 + 0.55 * vInfo.y) * relief);
  float n1 = texture(tNoise, wp.xz / 90.0).r;
  float n2 = texture(tNoise, wp.xz / 23.0).b;
  float n3 = texture(tNoise, wp.xz / 400.0).g;
  float ridge = vInfo.z;

  // ---- 森：林分ごとに植林（杉・檜の濃い緑）・新緑の雑木・常緑広葉樹・山桜の混じる林 ----
  vec2 wq = wp.xz + (vec2(texture(tNoise, wp.xz / 1500.0).g, texture(tNoise, wp.xz / 1500.0 + 0.5).g) - 0.5) * 400.0;
  wq += (vec2(texture(tNoise, wp.xz / 340.0).r, texture(tNoise, wp.xz / 340.0 + 0.37).r) - 0.5) * 80.0;
  vec2 cs = wq / vec2(240.0, 175.0);
  ivec2 ci = ivec2(floor(cs));
  float st = hashI2(ci);
  // 谷筋・山裾は植林、尾根は雑木。境は木の大きさの雑音でぎざぎざに、1画素より細い線は出さない
  float cedarP = 0.3 + 0.28 * smoothstep(0.25, -0.6, ridge);
  float dC = cedarP - st + (texture(tNoise, wp.xz / 88.0 + 0.3).r - 0.5) * 0.12;
  float kC = fwidth(dC) * 1.5 + 0.004;
  float wC = smoothstep(-kC, kC, dC);
  int other = st > 0.9 ? 2 : st > 0.78 ? 3 : 1;
  int stand = wC > 0.5 ? 0 : other;
  vec3 fresh = mix(vec3(0.12, 0.165, 0.045), vec3(0.21, 0.25, 0.075), n1);
  fresh = mix(fresh, vec3(0.2, 0.2, 0.07), smoothstep(0.6, 0.85, n3) * 0.4);
  vec3 cedarC = mix(vec3(0.028, 0.048, 0.03), vec3(0.045, 0.068, 0.036), n1);
  vec3 everC = mix(vec3(0.05, 0.075, 0.032), vec3(0.075, 0.095, 0.04), n1);
  vec3 avgF = mix(fresh, cedarC, 0.4);
  vec3 forest = mix(other == 2 ? everC : fresh, cedarC, wC);
  // 林分の境はやわらかく（遠くでちらつかない）
  vec2 bf = min(fract(cs), 1.0 - fract(cs));
  vec2 fwc = fwidth(cs) * 1.5 + 1e-4;
  float inner = smoothstep(0.0, 1.0, min(bf.x / fwc.x, bf.y / fwc.y));
  forest = mix(avgF, forest, inner * (1.0 - smoothstep(9000.0, 16000.0, dist)));
  // 一本ずつの樹冠（数画素に写る距離だけ）：不ぞろいな縁、日の当たる側が明るく、すき間と隣の木の落ち影は暗い
  float csz = stand == 0 ? 3.6 : 5.5;
  float cvis = (1.0 - smoothstep(0.25, 0.55, fw / csz)) * vInfo.y;
  float crownSun = 0.8, crownAO = 0.8;
  if (cvis > 0.01) {
    // 面の向きで貼り分ける（急な斜面で樹冠が坂の下へ伸びない）：上向きの面と、東西・南北を向いた立った面
    vec3 Nv = normalize(vN);
    vec3 tw = abs(Nv); tw = tw * tw * tw * tw; tw /= tw.x + tw.y + tw.z;
    bool cedar = stand == 0;
    float pinkP = stand == 3 ? 0.1 : stand == 1 ? 0.015 : 0.0;
    vec4 cT = vec4(0.0);
    if (tw.y > 0.02) cT += crownPlane(wp.xz, vec3(1.0, 0.0, 0.0), vec3(0.0, 0.0, 1.0), vec3(0.0, 1.0, 0.0), csz, cedar, pinkP) * tw.y;
    if (tw.x > 0.02) cT += crownPlane(vec2(wp.z * sign(Nv.x), wp.y), vec3(0.0, 0.0, sign(Nv.x)), vec3(0.0, 1.0, 0.0), vec3(sign(Nv.x), 0.0, 0.0), csz, cedar, pinkP) * tw.x;
    if (tw.z > 0.02) cT += crownPlane(vec2(-wp.x * sign(Nv.z), wp.y), vec3(-sign(Nv.z), 0.0, 0.0), vec3(0.0, 1.0, 0.0), vec3(0.0, 0.0, sign(Nv.z)), csz, cedar, pinkP) * tw.z;
    cT /= max(tw.x * step(0.02, tw.x) + tw.y * step(0.02, tw.y) + tw.z * step(0.02, tw.z), 1e-3);
    // 木ごとの色の違い（黄緑〜青緑）。山桜は樹冠の中に点々と散る花
    vec3 tint = forest * (0.82 + 0.36 * cT.z);
    tint *= mix(vec3(1.06, 1.04, 0.86), vec3(0.9, 0.98, 1.1), fract(cT.z * 13.7));
    tint = mix(tint, vec3(0.42, 0.36, 0.36), cT.w * 0.8);
    forest = mix(forest, tint, cvis);
    crownSun = mix(0.8, cT.x, cvis);
    crownAO = mix(0.8, cT.y, cvis);
  } else if (stand == 3) forest = mix(forest, vec3(0.42, 0.37, 0.37), 0.06);
  // 樹冠が1画素より小さい距離：画素の大きさに合わせた2の累乗の大きさの粒を2段まぜる（距離が変わっても模様が泳がない）
  // 樹冠のすき間の陰・木の高さの不ぞろいを、ざらついた明暗として残す
  {
    float lg = log2(max(fw * 2.2, 2.0));
    float k0 = floor(lg), fk = lg - k0;
    float s0 = exp2(k0);
    float o0 = fract(k0 * 0.618), o1 = fract((k0 + 1.0) * 0.618);
    float gA = texture(tNoise, wp.xz / (16.0 * s0) + o0).r, gB = texture(tNoise, wp.xz / (32.0 * s0) + o1).r;
    float grain = mix(gA, gB, fk);
    float gwF = vInfo.y * (1.0 - cvis) * (1.0 - smoothstep(9000.0, 18000.0, dist));
    float gc = (grain - 0.5) * (stand == 0 ? 1.5 : 1.2);
    crownSun *= 1.0 + gc * 1.2 * gwF;
    crownAO *= 1.0 + gc * 0.8 * gwF;
    forest *= 1.0 + gc * 0.45 * gwF;
  }
  // 尾根は明るく乾き、谷筋は暗く湿る
  forest *= 0.92 + 0.14 * ridge;
  // ---- 谷底の田畑：ゆがんだ格子の区画。近所の田は同じ時期の作業になる（260m単位の一帯：水田の一帯・れんげの一帯・耕した一帯） ----
  vec3 alb = forest;
  float flooded = 0.0;
  float flatF = vInfo.x * smoothstep(0.955, 0.985, normalize(vN).y);
  alb = mix(alb, mix(vec3(0.13, 0.18, 0.06), vec3(0.2, 0.22, 0.1), n2), (vInfo.x - flatF) * (1.0 - vInfo.y));
  if (flatF > 0.01) {
    vec2 fq = wp.xz + (vec2(texture(tNoise, wp.xz / 430.0).r, texture(tNoise, wp.xz / 430.0 + 0.5).r) - 0.5) * 36.0;
    vec2 fc = fq / vec2(31.0, 23.0);
    ivec2 fi = ivec2(floor(fc));
    float ft = hashI2(fi + 555), fv = hashI2(fi + 777);
    vec2 ff = min(fract(fc), 1.0 - fract(fc)) * vec2(31.0, 23.0);
    float ed = min(ff.x, ff.y);
    // 一帯の偏り（区画の中心で引く＝区画ごとに一定）となめらかな値（平均の色用）
    vec2 fcc = (floor(fc) + 0.5) * vec2(31.0, 23.0);
    float bc = (texture(tNoise, fcc / 1040.0 + vec2(0.37, 0.61)).g - 0.5) * 5.0;
    float bs = (texture(tNoise, fq / 1040.0 + vec2(0.37, 0.61)).g - 0.5) * 5.0;
    vec4 P = fieldMix(bc), Ps = fieldMixS(bs);
    const vec3 cWat = vec3(0.075, 0.07, 0.05), cSeed = vec3(0.075, 0.095, 0.045), cTil = vec3(0.17, 0.13, 0.09);
    const vec3 cRen = vec3(0.12, 0.19, 0.05), cFal = vec3(0.17, 0.2, 0.085), cNan = vec3(0.46, 0.4, 0.09);
    vec3 fcol;
    float fl = 0.0;
    // 水を張った田：区画ごとに水の深さ・濁り・苗の混み具合が違い、映り込みの強さも違う
    if (ft < P.x) { bool sd = fv < 0.3; fcol = (sd ? cSeed : mix(cWat, vec3(0.11, 0.09, 0.06), fract(fv * 3.3))) * (0.8 + 0.4 * fract(fv * 7.1)); fl = (sd ? 0.45 : 0.6 + 0.4 * fract(fv * 5.7)) * (0.75 + 0.25 * fract(fv * 11.3)); }
    else if (ft < P.x + P.y) fcol = cTil * (0.8 + 0.4 * fv);
    else if (ft < P.x + P.y + P.z) fcol = cRen * (0.85 + 0.3 * fv);
    else if (ft < P.x + P.y + P.z + P.w) fcol = cFal * (0.85 + 0.3 * fv);
    else fcol = cNan * (0.9 + 0.2 * fv);
    // 一帯の平均の色と水の割合
    vec3 avgC = Ps.x * mix(cWat, cSeed, 0.3) + Ps.y * cTil + Ps.z * cRen + Ps.w * cFal + max(1.0 - dot(Ps, vec4(1.0)), 0.0) * cNan;
    float avgFl = Ps.x * 0.62;
    // 区画の縁を軸ごとに1画素ぶん一帯の平均へぼかす（浅い角度で細い横長になっても段とちらつきが出ない）。区画が画素より小さい距離は平均の色だけ
    vec2 fwc = fwidth(fc) + 1e-5;
    vec2 bfc = min(fract(fc), 1.0 - fract(fc));
    float pf = smoothstep(0.0, 1.0, bfc.x / fwc.x) * smoothstep(0.0, 1.0, bfc.y / fwc.y) * smoothstep(1.0, 3.0, 1.0 / min(fwc.x, fwc.y));
    fcol = mix(avgC, fcol, pf);
    fl = mix(avgFl, fl, pf);
    // 屋敷林・社の森の小さな島
    float grove = smoothstep(0.78, 0.86, texture(tNoise, wp.xz / 260.0 + 0.23).b);
    fcol = mix(fcol, forest * crownSun, grove);
    fl *= 1.0 - grove;
    float lev = (1.0 - smoothstep(0.35, 0.35 + fw * 1.2, ed)) * (0.5 + 0.5 * smoothstep(fw * 0.4, fw * 1.2, 0.7));
    lev *= smoothstep(1.5, 4.0, 23.0 / fw);
    fcol = mix(fcol, vec3(0.15, 0.21, 0.06), lev);
    fl *= 1.0 - lev;
    alb = mix(alb, fcol, flatF);
    flooded = fl * flatF * (1.0 - 0.7 * smoothstep(2500.0, 7000.0, dist));
  }
  vec3 fields0 = mix(vec3(0.17, 0.2, 0.1), vec3(0.3, 0.26, 0.2), n2);
  alb = mix(alb, fields0, (1.0 - vInfo.y) * relief * 0.6);
  // ---- 急な斜面の崩れ（淡い灰褐色の地肌）と岩の帯 ----
  float steepF = smoothstep(0.66, 0.5, normalize(vN).y) * relief;
  float strata = texture(tNoise, vec2(wp.y / 38.0 + 0.4 * n2, (wp.x - wp.z) / 1600.0)).g;
  float scar = steepF * smoothstep(0.62, 0.8, n3 * 0.6 + texture(tNoise, wp.xz / 70.0 + 0.61).g * 0.6 - 0.1);
  vec3 rockC = mix(vec3(0.13, 0.12, 0.1), vec3(0.2, 0.18, 0.15), strata) * (0.8 + 0.3 * n2);
  alb = mix(alb, rockC, scar * 0.75);
  // ---- 高い山：森林限界より上は岩と這松、さらに上は春でも残る雪（北向き・谷筋・緩い面ほど多い） ----
  float hl = wp.y + 180.0 * (n1 - 0.5) + 90.0 * (n2 - 0.5);
  // 標高の高い森は亜高山の針葉樹（暗い青緑）
  alb = mix(alb, mix(vec3(0.03, 0.05, 0.035), vec3(0.05, 0.07, 0.045), n1) * crownSun, smoothstep(1300.0, 1700.0, hl) * vInfo.y * 0.8);
  float alpW = smoothstep(2000.0, 2300.0, hl);
  if (alpW > 0.0) {
    vec3 alpine = mix(vec3(0.17, 0.165, 0.155), vec3(0.08, 0.11, 0.06), smoothstep(0.35, 0.7, n2) * (1.0 - smoothstep(1700.0, 2100.0, hl)));
    alpine = mix(alpine, mix(vec3(0.12, 0.115, 0.11), vec3(0.25, 0.24, 0.22), strata), smoothstep(0.75, 0.5, N.y) * 0.8);
    alpine = mix(vec3(0.07, 0.1, 0.055), alpine, smoothstep(2100.0, 2500.0, hl));
    alb = mix(alb, alpine, alpW);
    // 雪：谷筋に沿って筋状に残る（斜面の下り方向に伸びた雑音）
    vec2 dd = N.xz / max(length(N.xz), 1e-3);
    vec2 su = vec2(dot(wp.xz, vec2(-dd.y, dd.x)) / 110.0, dot(wp.xz, dd) / 700.0);
    float lodS = log2(max(fw / 110.0 * 256.0, 1.0));
    float gully = textureLod(tNoise, su, lodS).r;
    float snowH = hl + 300.0 * smoothstep(0.1, -0.5, N.z) - 520.0 * (1.0 - smoothstep(0.5, 0.82, N.y)) - 280.0 * ridge + 380.0 * (gully - 0.5);
    float snow = smoothstep(2250.0, 2450.0, snowH);
    snow *= 0.6 + 0.4 * smoothstep(0.3, 0.7, b0 + n2 * 0.4);
    alb = mix(alb, vec3(0.72, 0.75, 0.8), clamp(snow, 0.0, 1.0));
    crownSun = mix(crownSun, 1.0, alpW);
    crownAO = mix(crownAO, 1.0, alpW);
  }
  // 遠くの森は凹凸で陰が柔らかく混ざる
  float nl = mix(max(dot(N, uSunDir), 0.0), 0.62, 0.16);
  float sh = cloudShadow(wp);
  float ao = mix(1.0, 0.8, vInfo.y) * (0.82 + 0.18 * smoothstep(-1.0, 0.6, ridge));
  vec3 col = alb * (uSunCol * nl * sh * crownSun + shIrr(N) * ao * crownAO);
  // 水を張った田：空が映る
  if (flooded > 0.01) {
    // 谷の中の水面は空だけでなく向かいの山と森を映す（近景の水田の明るさに合わせる）
    vec3 R = reflect(-V, vec3(0.0, 1.0, 0.0));
    float F = 0.02 + 0.98 * pow(1.0 - max(V.y, 0.0), 5.0);
    vec3 envF = avgF * (shIrr(vec3(0.0, 1.0, 0.0)) + uSunCol * 0.35);
    vec3 refl = mix(skyRadiance(R) * 0.72, envF, 0.45);
    col = mix(col, refl, min(F, 0.55) * flooded);
  }
  // 十数km先はさらに青く霞む（春霞）
  col = mix(col, uFogCol * 0.92 + shIrr(vec3(0.0, 1.0, 0.0)) * 0.08, smoothstep(5000.0, 22000.0, dist) * 0.42);
  gl_FragColor = vec4(col, 1.0);
}
`;

// 値雑音（-1〜1）と勾配
const _nd = [0, 0, 0];
function vnoiseD(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z), fx = x - xi, fz = z - zi;
  const u = fx * fx * fx * (fx * (fx * 6 - 15) + 10), v = fz * fz * fz * (fz * (fz * 6 - 15) + 10);
  const du = 30 * fx * fx * (fx * (fx - 2) + 1), dv = 30 * fz * fz * (fz * (fz - 2) + 1);
  const a = hashf2(xi | 0, zi | 0), b = hashf2((xi + 1) | 0, zi | 0), c = hashf2(xi | 0, (zi + 1) | 0), d = hashf2((xi + 1) | 0, (zi + 1) | 0);
  const k1 = b - a, k2 = c - a, k4 = a - b - c + d;
  _nd[0] = 2 * (a + k1 * u + k2 * v + k4 * u * v) - 1;
  _nd[1] = 2 * du * (k1 + k4 * v);
  _nd[2] = 2 * dv * (k2 + k4 * u);
  return _nd;
}
// 山肌の細部：尾根の尖った雑音を重ね、急な所ほど細かい凹凸を抑える（侵食された尾根と谷筋）
// 波長ごとに、その輪の格子で描ける所まで（四角い距離 rc で、輪の境より手前で消す）
const OCT = [2600, 1300, 640, 320, 160, 80, 44];
const OCT_FADE = [null, null, null, [9400, 12160], [4700, 6080], [2300, 3040], [1050, 1500]];
function farDetail(x, z, rc, rel) {
  const big = smoothstep(500, 2200, rel), mid = smoothstep(15, 260, rel);
  let h = 0, gx = 0, gz = 0;
  for (let i = 0; i < OCT.length; i++) {
    const lam = OCT[i], f = 1 / lam;
    const fd = OCT_FADE[i];
    const w = fd ? 1 - smoothstep(fd[0], fd[1], rc) : 1;
    if (w <= 0) break;
    const amp = lam * 0.085 * (i < 2 ? big : mid) * w;
    if (amp <= 0) continue;
    const n = vnoiseD(x * f + i * 17.13, z * f - i * 11.71);
    const r = 1 - Math.abs(n[0]), sg = n[0] > 0 ? 1 : -1;
    gx += -2 * r * sg * n[1] * f * amp;
    gz += -2 * r * sg * n[2] * f * amp;
    const damp = 1 / (1 + 0.9 * (gx * gx + gz * gz));
    h += amp * (r * r - 0.36) * (i < 3 ? 1 : damp);
  }
  return h;
}

export function buildFarTerrain(shared) {
  const tB = performance.now();
  const group = new THREE.Group();
  setFarSmooth(1);
  const mat = new THREE.ShaderMaterial({ uniforms: { ...shared }, vertexShader: FAR_VS, fragmentShader: FAR_FS });
  const inner0 = 768;
  const rings = [
    { inner: 768, outer: 1536, step: 12 },
    { inner: 1536, outer: 3072, step: 24 },
    { inner: 3072, outer: 6144, step: 48 },
    { inner: 6144, outer: 12288, step: 96 },
    { inner: 12288, outer: 24576, step: 192 },
  ];
  const SECT = 12;
  for (const r of rings) {
    const n = Math.round((2 * r.outer) / r.step) + 1;
    const skip = (x, z) => Math.abs(x) < r.inner - 2 * r.step - 0.01 && Math.abs(z) < r.inner - 2 * r.step - 0.01;
    const inside = (x, z) => Math.abs(x) < r.inner - 0.01 && Math.abs(z) < r.inner - 0.01;
    // 高さの格子（曲率を測るため内側に1列余分に持つ）
    const Hg = new Float32Array(n * n).fill(NaN), FL = new Float32Array(n * n), FO = new Float32Array(n * n);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const x = -r.outer + i * r.step, z = -r.outer + j * r.step;
      if (skip(x, z)) continue;
      let y = baseHeight(x, z);
      const t = floorT(x, z);
      const k = j * n + i;
      FL[k] = 1 - Math.min(1, Math.max(0, (t - 10) / 40));
      FO[k] = Math.max(0, Math.min(1, Math.max(0, (t - 20) / 30)) * (0.75 + 0.25 * fbm2(x / 400, z / 400, 2)));
      const rc = Math.max(Math.abs(x), Math.abs(z));
      const rel = Math.max(0, y - floorBase(x, z) - 3);
      y += farDetail(x, z, rc, rel) * smoothstep(820, 1250, rc);
      if (r.inner === inner0 && inside(x, z)) y -= 3; // 中心の地形の下に潜らせる
      Hg[k] = y;
    }
    const pos = [], info = [], index = [];
    const vid = new Int32Array(n * n).fill(-1);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const x = -r.outer + i * r.step, z = -r.outer + j * r.step;
      if (Math.abs(x) < r.inner - r.step - 0.01 && Math.abs(z) < r.inner - r.step - 0.01) continue;
      const k = j * n + i;
      // 尾根(+)／谷筋(-)：まわり2目の平均との差
      let s = 0, c = 0;
      for (const [di, dj] of [[2, 0], [-2, 0], [0, 2], [0, -2], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
        const ii = i + di, jj = j + dj;
        if (ii < 0 || jj < 0 || ii >= n || jj >= n) continue;
        const v = Hg[jj * n + ii];
        if (v === v) { s += v; c++; }
      }
      const curv = c ? Math.max(-1, Math.min(1, (Hg[k] - s / c) / (r.step * 0.45))) : 0;
      vid[k] = pos.length / 3;
      pos.push(x, Hg[k], z);
      info.push(FL[k], FO[k], curv);
    }
    const tris = [];
    const quad = new Uint8Array(n * n);
    for (let j = 0; j < n - 1; j++) for (let i = 0; i < n - 1; i++) {
      const a = vid[j * n + i], b = vid[j * n + i + 1], c = vid[(j + 1) * n + i], d = vid[(j + 1) * n + i + 1];
      if (a < 0 || b < 0 || c < 0 || d < 0) continue;
      const cx = -r.outer + (i + 0.5) * r.step, cz = -r.outer + (j + 0.5) * r.step;
      if (inside(cx, cz) && r.inner === inner0) continue;
      if (Math.abs(cx) < r.inner && Math.abs(cz) < r.inner && r.inner !== inner0) continue;
      quad[j * n + i] = 1;
      // 対角線は谷に沿う向きに（尾根が折れ線で欠けない）
      if (Math.abs(pos[a * 3 + 1] - pos[d * 3 + 1]) < Math.abs(pos[b * 3 + 1] - pos[c * 3 + 1])) tris.push(a, c, d, a, d, b);
      else tris.push(a, c, b, b, c, d);
    }
    const g0 = new THREE.BufferGeometry();
    g0.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g0.setIndex(tris);
    g0.computeVertexNormals();
    const nrm = Array.from(g0.getAttribute('normal').array);
    // 境目のすき間を隠すスカート：となりに面の無い辺を下へ垂らす
    const drop = new Map();
    const dropV = (a) => {
      if (drop.has(a)) return drop.get(a);
      const v = pos.length / 3;
      pos.push(pos[a * 3], pos[a * 3 + 1] - r.step * 3, pos[a * 3 + 2]);
      nrm.push(nrm[a * 3], nrm[a * 3 + 1], nrm[a * 3 + 2]);
      info.push(info[a * 3], info[a * 3 + 1], info[a * 3 + 2]);
      drop.set(a, v);
      return v;
    };
    const skirt = [];
    const has = (i, j) => i >= 0 && j >= 0 && i < n - 1 && j < n - 1 && quad[j * n + i] === 1;
    const edge = (p, q) => { const a = vid[p], b = vid[q], a2 = dropV(a), b2 = dropV(b); skirt.push(a, b, a2, b, b2, a2, a, a2, b, b, a2, b2); };
    for (let j = 0; j < n - 1; j++) for (let i = 0; i < n - 1; i++) {
      if (!quad[j * n + i]) continue;
      if (!has(i, j - 1)) edge(j * n + i, j * n + i + 1);
      if (!has(i, j + 1)) edge((j + 1) * n + i, (j + 1) * n + i + 1);
      if (!has(i - 1, j)) edge(j * n + i, (j + 1) * n + i);
      if (!has(i + 1, j)) edge(j * n + i + 1, (j + 1) * n + i + 1);
    }
    const all = tris.concat(skirt);
    const P = new THREE.Float32BufferAttribute(pos, 3), Nn = new THREE.Float32BufferAttribute(nrm, 3), I = new THREE.Float32BufferAttribute(info, 3);
    // 向きごとに分けて、視野の外は描かない
    const buckets = Array.from({ length: SECT }, () => []);
    for (let q = 0; q < all.length; q += 3) {
      const a = all[q] * 3, b = all[q + 1] * 3, c = all[q + 2] * 3;
      const cx = pos[a] + pos[b] + pos[c], cz = pos[a + 2] + pos[b + 2] + pos[c + 2];
      const s = Math.min(SECT - 1, Math.floor(((Math.atan2(cz, cx) / (2 * Math.PI)) + 0.5) * SECT));
      buckets[s].push(all[q], all[q + 1], all[q + 2]);
    }
    for (const idx of buckets) {
      if (!idx.length) continue;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', P);
      g.setAttribute('normal', Nn);
      g.setAttribute('aInfo', I);
      g.setIndex(idx);
      const box = new THREE.Box3();
      const v = new THREE.Vector3();
      for (const q of idx) box.expandByPoint(v.set(pos[q * 3], pos[q * 3 + 1], pos[q * 3 + 2]));
      g.boundingBox = box;
      g.boundingSphere = box.getBoundingSphere(new THREE.Sphere());
      const m = new THREE.Mesh(g, mat);
      group.add(m);
    }
  }
  setFarSmooth(0);
  if (typeof window !== 'undefined') (window.__boot ||= []).push([`farTerrain ${Math.round(performance.now() - tB)}ms`, Math.round(performance.now())]);
  return group;
}
