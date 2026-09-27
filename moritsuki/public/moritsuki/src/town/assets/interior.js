// 窓ガラスの奥の部屋（インテリアマッピング）: ガラス面の奥に箱の部屋があるものとして、視線と部屋の壁・床・天井の交点の色を描く。
// 形は増やさずに、見る角度で奥行きが変わる。空の映り込みはふつうの PBR（環境マップ + フレネル）。
// ガラスの面の uv は「壁に沿った m・部屋の床からの高さ m」で渡す（build.js の slider など）。頂点色はガラスの色味。
import * as THREE from 'three';

// kind: 'home'（和室・洋室、レースのカーテン）/ 'shop'（暖色の灯り、店の中）/ 'office'（天井の照明、机の仕切り、ブラインド）
const ROOM = {
  home: { size: [3.6, 2.4, 3.6], ior: 1.5, k: 0 },
  shop: { size: [4.0, 2.6, 5.0], ior: 1.5, k: 1 },
  office: { size: [5.4, 3.9, 7.0], ior: 1.9, k: 2 },
  lobby: { size: [9.0, 3.9, 9.0], ior: 1.9, k: 3 },
};

const GLSL = /* glsl */ `
uniform vec3 uRoom;
uniform float uKind;
varying vec3 vIWP;
varying vec3 vIWN;
varying vec2 vIUv;
// sin を使わないハッシュ（sin は GPU によって精度が低く、画素ごとに値が揺れて縞になる）
float ih(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
vec3 roomColor() {
  vec3 N = normalize(vIWN);
  vec3 T = normalize(cross(vec3(0.0, 1.0, 0.0), N));
  vec3 V = normalize(vIWP - cameraPosition);
  vec3 d = vec3(dot(V, T), V.y, -dot(V, N));
  d.z = max(d.z, 0.02);
  if (abs(d.x) < 1e-4) d.x = 1e-4;
  if (abs(d.y) < 1e-4) d.y = 1e-4;
  vec2 cf = vIUv / uRoom.xy;
  vec2 cell = floor(cf);
  vec3 p = vec3(fract(cf) * uRoom.xy, 0.0);
  float wallId = floor(dot(vIWP, N) * 1.7) + N.x * 17.0 + N.z * 31.0;
  float s0 = ih(vec3(cell, wallId)), s1 = ih(vec3(cell + 7.3, wallId)), s2 = ih(vec3(cell - 3.1, wallId + 5.0));
  vec3 tt = vec3(((d.x > 0.0 ? uRoom.x : 0.0) - p.x) / d.x, ((d.y > 0.0 ? uRoom.y : 0.0) - p.y) / d.y, uRoom.z / d.z);
  // どの面に当たったか（浮動小数の == で比べると、最適化で値が揺れて縞になる）
  float t = tt.z; int face = 2;
  if (tt.x < t) { t = tt.x; face = 0; }
  if (tt.y < t) { t = tt.y; face = 1; }
  vec3 h = p + d * t;
  float depth = h.z / uRoom.z;
  // 細かい模様は遠くでちらつくので、距離で消す
  float fine = 1.0 - smoothstep(4.0, 14.0, length(vIWP - cameraPosition));
  vec3 col;
  // 部屋ごとの灯り（消えている部屋もある）
  bool on = uKind > 2.5 || s0 > (uKind > 1.5 ? 0.22 : uKind > 0.5 ? 0.0 : 0.45);
  float light = on ? 1.0 : 0.5;
  if (uKind < 0.5) {
    // 家: 漆喰の壁・木の天井・畳か板の床、奥に箪笥や本棚
    vec3 wall = mix(vec3(0.55, 0.5, 0.42), vec3(0.5, 0.52, 0.5), step(0.6, s1));
    vec3 floorC = s1 < 0.55 ? vec3(0.42, 0.38, 0.2) : vec3(0.3, 0.19, 0.1);
    if (face == 2) {
      col = wall;
      float fx = h.x / uRoom.x;
      // 家具（箪笥・本棚）: 奥の壁の一部
      float a = 0.1 + s2 * 0.45, b = a + 0.25 + s1 * 0.2;
      if (fx > a && fx < b && h.y < 1.1 + s0 * 0.8) {
        col = s2 > 0.5 ? vec3(0.2, 0.12, 0.06) : vec3(0.36, 0.3, 0.22);
        col *= 1.0 - 0.15 * fine * step(0.5, fract(h.y * 2.2));
      }
      // 襖の引手の線
      if (s1 < 0.5 && fx > b) col *= 1.0 - 0.08 * fine * (1.0 - step(0.03, abs(fract(h.x / 0.9) - 0.5)));
    } else if (face == 1) {
      col = d.y < 0.0 ? floorC : vec3(0.36, 0.28, 0.2);
      if (d.y < 0.0 && s1 < 0.55) col *= 1.0 - 0.1 * fine * (1.0 - step(0.04, abs(fract(h.z / 0.9) - 0.5)));
      if (d.y > 0.0) col *= 1.0 - 0.2 * fine * (1.0 - step(0.05, fract(h.x / 0.45)));
    } else col = wall * 0.9;
    col *= mix(1.0, 0.45, depth) * 0.3 * light;
    // 窓ぎわの床に外の光
    if (face == 1 && d.y < 0.0) col += vec3(0.5, 0.46, 0.38) * (1.0 - smoothstep(0.0, 1.4, h.z)) * 0.2;
  } else if (uKind < 1.5) {
    // 店: あたたかい灯り、板の壁、奥に厨房の白い壁と棚
    vec3 wall = vec3(0.62, 0.48, 0.32);
    if (face == 2) {
      col = vec3(0.8, 0.76, 0.66);
      if (h.y > 1.0 && h.y < 1.9 && fract(h.x / 1.3) < 0.8) col = mix(col, vec3(0.3, 0.2, 0.12), 0.6);
      if (h.y < 0.95) col = vec3(0.45, 0.4, 0.34);
      // 品書きの短冊
      if (h.y > 1.95 && h.y < 2.35) col = mix(vec3(0.7, 0.6, 0.45), vec3(0.95, 0.9, 0.78), mix(0.72, step(fract(h.x / 0.28), 0.72), fine));
    } else if (face == 1) {
      col = d.y < 0.0 ? vec3(0.33, 0.3, 0.27) : vec3(0.5, 0.38, 0.24);
      // 天井の灯り
      if (d.y > 0.0) col += vec3(3.0, 2.5, 1.7) * (1.0 - smoothstep(0.12, 0.2, length(fract(h.xz / 1.6) - 0.5)));
    } else col = wall * (1.0 - 0.15 * fine * (1.0 - step(0.03, fract(h.z / 0.3))));
    col *= mix(1.1, 0.7, depth) * 0.6;
    // 手前のテーブルと椅子の影（奥行きの中ほどの低い板）
    float tz = 1.2 + s1 * 0.8;
    float tp = tz / d.z;
    vec3 q = p + d * tp;
    if (tp < t && q.y < 0.75 && q.y > 0.0 && fract(q.x / 1.8) < 0.62) col = mix(vec3(0.3, 0.18, 0.09), vec3(0.42, 0.28, 0.15), step(0.72, q.y));
  } else {
    // 研究所: 白い壁・灰色の床・格子の天井照明・机の仕切り
    if (face == 2) {
      col = vec3(0.62, 0.64, 0.64);
      float fx = h.x / uRoom.x;
      if (s2 > 0.4 && h.y < 2.1 && fract(fx * 3.0) < 0.8) col = mix(vec3(0.5, 0.53, 0.55), vec3(0.28, 0.32, 0.36), step(0.5, s1)); // 棚・ロッカー
    } else if (face == 1) {
      if (d.y < 0.0) col = vec3(0.3, 0.32, 0.33);
      else {
        col = vec3(0.6, 0.6, 0.58);
        vec2 g = abs(fract(h.xz / vec2(1.8, 2.4)) - 0.5);
        if (on && g.x < 0.3 && g.y < 0.12) col = vec3(8.0, 8.0, 7.6);
      }
    } else col = vec3(0.6, 0.61, 0.6);
    col *= mix(1.0, 0.45, depth) * (on ? 0.2 : 0.08);
    // 机の仕切り（部屋の中ほど、高さ 1.2 m）
    float pz = 2.2 + s1 * 2.0, tp = pz / d.z;
    vec3 q = p + d * tp;
    if (tp < t && q.y < 1.2 && fract(q.x / 2.7) < 0.85) col = mix(vec3(0.34, 0.4, 0.46), vec3(0.72, 0.74, 0.74), step(1.12, q.y)) * (on ? 0.17 : 0.07);
  }
  // 窓のすぐ内側: カーテン・ブラインド
  float cz = 0.1, tc = cz / d.z;
  vec3 c = p + d * tc;
  if (uKind < 0.5) {
    // レースのカーテン（すき間をあけて引いてある）と、端の厚いカーテン
    float gap0 = s2 * 0.6, gap1 = gap0 + 0.15 + s0 * 0.4;
    float fx = c.x / uRoom.x;
    bool lace = !(fx > gap0 && fx < gap1) && s1 > 0.25;
    float near = 1.0 - smoothstep(6.0, 30.0, length(vIWP - cameraPosition));
    float fold = 1.0 + 0.12 * sin(c.x * 14.0) * near;
    if (lace) col = mix(col, vec3(0.36, 0.36, 0.34) * fold, 0.72);
    if (fx < 0.08 || fx > 0.92) col = mix(vec3(0.35, 0.3, 0.24), vec3(0.3, 0.36, 0.42), step(0.5, s0)) * fold * 0.45;
  } else if (uKind > 1.5 && uKind < 2.5) {
    float drop = s2 < 0.35 ? 0.0 : (s2 - 0.35) * 1.3 * uRoom.y;
    float near = 1.0 - smoothstep(8.0, 40.0, length(vIWP - cameraPosition));
    if (c.y > uRoom.y - drop) col = vec3(0.2, 0.21, 0.21) * (1.0 - 0.2 * near * step(0.35, fract(c.y / 0.05)));
  }
  return col;
}
`;

const cache = {};
export function windowMaterial(kind = 'home') {
  if (cache[kind]) return cache[kind];
  const R = ROOM[kind];
  const m = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.06, metalness: 0, ior: R.ior, specularIntensity: 1, envMapIntensity: 1.25 });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uRoom = { value: new THREE.Vector3(...R.size) };
    sh.uniforms.uKind = { value: R.k };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vIWP;\nvarying vec3 vIWN;\nvarying vec2 vIUv;')
      .replace('#include <project_vertex>', `#include <project_vertex>
        vIWP = (modelMatrix * vec4(transformed, 1.0)).xyz;
        vIWN = normalize(mat3(modelMatrix) * objectNormal);
        vIUv = uv;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + GLSL)
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec3 glassTint = diffuseColor.rgb / max(max(diffuseColor.r, diffuseColor.g), max(diffuseColor.b, 0.04));
        vec3 roomC = roomColor() * mix(vec3(1.0), glassTint, 0.35);
        diffuseColor.rgb = vec3(0.0);`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += roomC;`);
  };
  m.customProgramCacheKey = () => 'interior-' + kind;
  cache[kind] = m;
  return m;
}
