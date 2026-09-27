// クサフグ拾いの共通シェーダー部品（夜の浜。ガザミ拾いの部品を写したもの）
// ・全マテリアルが共有する uniform（時刻・月・夜空の色・潮位・ヘッドライト）
// ・水の下の砂に落ちる、ヘッドライトの光の網目（水面の波で集まった光）
// ・空気のかすみ
// 水面そのものは water.js の画面処理で描く（ここは水の「下」と「上」の物の光だけ）
import * as THREE from 'three';

export const U = {
  uTime: { value: 0 },
  // 月（昼の太陽の代わり。名前は蛤突きの部品とそろえて uSun のまま）
  uSunDir: { value: new THREE.Vector3(0.3, 0.42, 0.85).normalize() },
  uSunCol: { value: new THREE.Color('#9fb2d6') },
  uSkyZenith: { value: new THREE.Color('#03060e') },
  uSkyHorizon: { value: new THREE.Color('#141d31') },
  uAirFogCol: { value: new THREE.Color('#0b111d') },
  uAirFog: { value: 0.0018 },
  uTide: { value: 0 },        // 平均の水面の高さ（潮位）
  uCaustic: { value: 0.45 },  // 光の網目の強さ（赤い光る点が網目にまぎれないよう、ガザミ拾いより弱く）
  uWaterTint: { value: new THREE.Color('#1f5a5e') },
  uPlayer: { value: new THREE.Vector3() },
  // ヘッドライト: 位置・向き・明るさ（光度）・円すいの内外の cos
  uHeadPos: { value: new THREE.Vector3(0, 1, 0) },
  uHeadDir: { value: new THREE.Vector3(0, -1, 0) },
  uHeadI: { value: 0 },
  uHeadCone: { value: new THREE.Vector2(Math.cos(0.5), Math.cos(0.2)) },
};

// 沖の漁火（水平線ぎりぎりの向き: 方位（北から時計回り, 度）・仰角・明るさ・色の緑み）
export const BOATS = [
  [148, 0.0035, 1.0, 0.55], [161, 0.003, 0.7, 0.2], [176, 0.0042, 1.25, 0.7],
  [190, 0.0031, 0.55, 0.3], [203, 0.0038, 0.9, 0.62], [214, 0.0028, 0.45, 0.1],
];
const f5 = (v) => v.toFixed(5);
const boatGLSL = BOATS.map(([az, el, k, g]) => {
  const a = (az * Math.PI) / 180;
  const d = new THREE.Vector3(Math.sin(a) * Math.cos(el), Math.sin(el), -Math.cos(a) * Math.cos(el)).normalize();
  return `{
    float c = dot(d, vec3(${f5(d.x)}, ${f5(d.y)}, ${f5(d.z)}));
    float a = max(1.0 - c, 0.0);
    col += mix(vec3(1.0, 0.93, 0.78), vec3(0.72, 1.0, 0.82), ${f5(g)}) * ${f5(k)} * (exp(-a * 2.6e6) * 26.0 + exp(-a * 6.0e4) * 0.35);
  }`;
}).join('\n');

export const COMMON_GLSL = /* glsl */ `
uniform float uTime;
uniform vec3 uSunDir;
uniform vec3 uSunCol;
uniform vec3 uSkyZenith;
uniform vec3 uSkyHorizon;
uniform vec3 uAirFogCol;
uniform float uAirFog;
uniform float uTide;
uniform float uCaustic;
uniform vec3 uWaterTint;
uniform vec3 uPlayer;
uniform vec3 uHeadPos;
uniform vec3 uHeadDir;
uniform float uHeadI;
uniform vec2 uHeadCone;

float hm_h21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
vec2 hm_h22(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}
float hm_vn(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hm_h21(i), hm_h21(i + vec2(1, 0)), f.x), mix(hm_h21(i + vec2(0, 1)), hm_h21(i + vec2(1, 1)), f.x), f.y);
}
float hm_fbm(vec2 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { s += a * hm_vn(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; }
  return s;
}
// ボロノイの境界 = 光の網目
float hm_voro(vec2 p, float t) {
  vec2 ip = floor(p), fp = fract(p);
  float d1 = 8.0, d2 = 8.0;
  for (int y = -1; y <= 1; y++)
  for (int x = -1; x <= 1; x++) {
    vec2 g = vec2(float(x), float(y));
    vec2 o = hm_h22(ip + g);
    o = 0.5 + 0.42 * sin(t + 6.2831 * o);
    vec2 r = g + o - fp;
    float d = dot(r, r);
    if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) { d2 = d; }
  }
  return sqrt(d2) - sqrt(d1);
}
// 浅い水の底の光の網目（深いほどぼやけて弱く、浅いほど細く明るい）
float hm_caustics(vec2 p, float t, float depth) {
  float sharp = mix(10.0, 4.0, clamp(depth / 1.6, 0.0, 1.0));
  float a = hm_voro(p, t * 0.9);
  float b = hm_voro(p * 1.37 + vec2(3.7, 1.3), t * 1.13 + 2.0);
  float ca = exp(-a * sharp);
  float cb = exp(-b * sharp * 1.1);
  return ca * 0.5 + cb * 0.4 + ca * cb * 1.7;
}
// ヘッドライトの照度（p の所。円すいの中だけ、距離で弱まる。弱まり方は world.js の HEAD_DECAY = 1.4 とそろえる）
float headIrr(vec3 p) {
  vec3 v = p - uHeadPos;
  float d2 = max(dot(v, v), 0.01);
  float c = dot(v * inversesqrt(d2), uHeadDir);
  return uHeadI * smoothstep(uHeadCone.x, uHeadCone.y, c) / pow(d2, 0.7);
}
// 夜空（水面の映り込みにも使う）: 地平のほのかな明るさ・月のかさ・沖の漁火
vec3 skyColor(vec3 d) {
  float y = max(d.y, 0.0);
  vec3 col = mix(uSkyHorizon, uSkyZenith, pow(y, 0.42));
  // 北（陸・町の方）の地平は、町の明かりでほんのり暖かい
  col += vec3(0.05, 0.035, 0.02) * exp(-y * 14.0) * smoothstep(0.2, -0.9, d.z);
  float md = max(dot(d, uSunDir), 0.0);
  col += uSunCol * (pow(md, 6.0) * 0.035 + pow(md, 60.0) * 0.12 + pow(md, 900.0) * 0.5);
  col += vec3(1.0, 0.98, 0.92) * smoothstep(0.99990, 0.99993, md) * 3.0;
  ${boatGLSL}
  return col;
}
`;

/**
 * MeshStandardMaterial に「水の下の光」と「空気のかすみ」を足す。
 * opts.fx = { key, decl?, vdecl?, vnormal?, vcode?, color?, normal?, rough?, light? }（色・法線・粗さ・光への追加処理）
 * vnormal: 頂点の法線を変える処理（ふくらんだ形への切りかえなど）
 * opts.caustics: 水の下に光の網目を落とす
 */
export function patchMaterial(material, opts = {}) {
  const { caustics = true, fx = null, uniforms = null, fog = true } = opts;
  material.onBeforeCompile = (shader) => {
    for (const k in U) shader.uniforms[k] = U[k];
    if (uniforms) for (const k in uniforms) shader.uniforms[k] = uniforms[k];
    let vs = shader.vertexShader;
    vs = vs.replace('#include <common>', `#include <common>\n${COMMON_GLSL}\nvarying vec3 vWPos;\n${fx?.vdecl || ''}`);
    if (fx?.vnormal) vs = vs.replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>\n${fx.vnormal}`);
    if (fx?.vcode) vs = vs.replace('#include <begin_vertex>', `#include <begin_vertex>\n${fx.vcode}`);
    vs = vs.replace('#include <project_vertex>', `#include <project_vertex>
      {
        vec4 hmWp = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          hmWp = instanceMatrix * hmWp;
        #endif
        vWPos = (modelMatrix * hmWp).xyz;
      }`);
    shader.vertexShader = vs;

    let fs = shader.fragmentShader;
    fs = fs.replace('#include <common>', `#include <common>\n${COMMON_GLSL}\nvarying vec3 vWPos;\n${caustics ? '#define HM_CAUSTICS' : ''}\n${fx?.decl || ''}`);
    if (fx?.color) fs = fs.replace('#include <color_fragment>', `#include <color_fragment>\n${fx.color}`);
    if (fx?.normal) fs = fs.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>\n${fx.normal}`);
    if (fx?.rough) fs = fs.replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>\n${fx.rough}`);
    fs = fs.replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
      {
        // 水の下: ヘッドライトの光は波の水面で集まって網目になり、赤から先に弱まる
        float wd = uTide - vWPos.y;
        float under = smoothstep(-0.02, 0.06, wd);
        if (under > 0.0) {
          vec3 L = normalize(vWPos - uHeadPos);
          float slant = max(-L.y, 0.25);
          vec3 ab = exp(-max(wd, 0.0) / slant * vec3(0.42, 0.1, 0.085));
          #ifdef HM_CAUSTICS
            float cdist = length(vWPos - cameraPosition);
            float cf = uCaustic * smoothstep(0.0, 0.08, wd) * (1.0 - smoothstep(4.0, 9.0, cdist));
            float c = 0.55;
            if (cf > 0.001) {
              // 光が水面を通った所（そこの波の形で網目が決まる）
              vec2 cp = vWPos.xz + L.xz / slant * max(wd, 0.0);
              c = hm_caustics(cp * 6.5, uTime * 0.9, max(wd, 0.0) + 0.25);
            }
            reflectedLight.directDiffuse *= mix(vec3(1.0), ab * mix(0.75, 0.55 + c * 0.6, cf), under);
          #else
            reflectedLight.directDiffuse *= mix(vec3(1.0), ab, under);
          #endif
          reflectedLight.directSpecular *= mix(1.0, 0.4, under);
          reflectedLight.indirectDiffuse *= mix(vec3(1.0), mix(vec3(1.0), ab, 0.5), under);
        }
      }
      ${fx?.light || ''}`);
    if (fog) {
      fs = fs.replace('#include <fog_fragment>', `
        {
          float dist = length(vWPos - cameraPosition);
          float af = 1.0 - exp(-uAirFog * dist);
          gl_FragColor.rgb = mix(gl_FragColor.rgb, uAirFogCol, af);
        }`);
    }
    shader.fragmentShader = fs;
    material.userData.shader = shader;
  };
  material.customProgramCacheKey = () => `kf|${caustics ? 1 : 0}|${fog ? 1 : 0}|${fx?.key || '-'}`;
  return material;
}
