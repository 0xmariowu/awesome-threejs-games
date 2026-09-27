// ウナギ掬いの共通シェーダー部品
// ・全マテリアルが共有する uniform（時刻・ヘッドライト・月・夜空・夜明け）
// ・側溝の水の下の物: ヘッドライトの光が水を通って届く（水の中の道のりで弱まり、さざ波で光の網目ができる）
// ・夜のかすみ（地面近くほど濃い）
// 水面そのものは water.js で描く（ここは水の「下」と「上」の物の光だけ）
import * as THREE from 'three';
import { LEVEL_GLSL, FLOW } from './ditch.js';

export const U = {
  uTime: { value: 0 },
  // ヘッドライト: 位置・向き・円錐（外の cos, 内の cos）・明るさ
  uLampPos: { value: new THREE.Vector3() },
  uLampDir: { value: new THREE.Vector3(0, -0.5, -1).normalize() },
  uLampCone: { value: new THREE.Vector2(Math.cos(0.5), Math.cos(0.2)) },
  uLampI: { value: 1 },
  uLampCone2: { value: new THREE.Vector2(Math.cos(1.05), Math.cos(0.4)) },  // 周りの弱い光（ふちのぼけ）
  uLampSpill: { value: 0.1 },
  uMoonDir: { value: new THREE.Vector3(0.8, 0.25, 0.2).normalize() },
  uMoonCol: { value: new THREE.Color('#8ea6d8') },
  uSkyZenith: { value: new THREE.Color('#050b1c') },
  uSkyHorizon: { value: new THREE.Color('#16223a') },
  uFogCol: { value: new THREE.Color('#0c1424') },
  uFog: { value: 0.012 },
  uDawn: { value: 0 },
  // 水の吸収（m あたり）: 少し茶色がかった田んぼの水
  uWaterSigma: { value: new THREE.Vector3(0.6, 0.48, 0.78) },
  uCaustic: { value: 1 },
};

export const COMMON_GLSL = /* glsl */ `
uniform float uTime;
uniform vec3 uLampPos;
uniform vec3 uLampDir;
uniform vec2 uLampCone;
uniform float uLampI;
uniform vec2 uLampCone2;
uniform float uLampSpill;
uniform vec3 uMoonDir;
uniform vec3 uMoonCol;
uniform vec3 uSkyZenith;
uniform vec3 uSkyHorizon;
uniform vec3 uFogCol;
uniform float uFog;
uniform float uDawn;
uniform vec3 uWaterSigma;
uniform float uCaustic;
${LEVEL_GLSL}
#define FLOW_V ${FLOW.toFixed(3)}

float un_h21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
vec2 un_h22(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}
float un_vn(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(un_h21(i), un_h21(i + vec2(1, 0)), f.x), mix(un_h21(i + vec2(0, 1)), un_h21(i + vec2(1, 1)), f.x), f.y);
}
float un_fbm(vec2 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { s += a * un_vn(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; }
  return s;
}
float un_voro(vec2 p, float t) {
  vec2 ip = floor(p), fp = fract(p);
  float d1 = 8.0, d2 = 8.0;
  for (int y = -1; y <= 1; y++)
  for (int x = -1; x <= 1; x++) {
    vec2 g = vec2(float(x), float(y));
    vec2 o = un_h22(ip + g);
    o = 0.5 + 0.42 * sin(t + 6.2831 * o);
    vec2 r = g + o - fp;
    float d = dot(r, r);
    if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) { d2 = d; }
  }
  return sqrt(d2) - sqrt(d1);
}
// ヘッドライトの光が水面のさざ波で集まってできる網目（流れに乗って下流へ動く）
float un_caustics(vec2 p, float t, float depth) {
  p.y -= t * FLOW_V;
  float sharp = mix(9.0, 4.5, clamp(depth / 0.6, 0.0, 1.0));
  float a = un_voro(p, t * 1.3);
  float b = un_voro(p * 1.41 + vec2(3.7, 1.3), t * 1.6 + 2.0);
  float ca = exp(-a * sharp);
  float cb = exp(-b * sharp * 1.1);
  return ca * 0.55 + cb * 0.45 + ca * cb * 1.6;
}
// ヘッドライトの円錐の中か（0..1）
float lampCone(vec3 p) {
  vec3 d = normalize(p - uLampPos);
  float c = dot(d, uLampDir);
  return smoothstep(uLampCone.x, uLampCone.y, c) + uLampSpill * smoothstep(uLampCone2.x, uLampCone2.y, c);
}
// 夜空の色（反射・かすみに使う簡単なもの。月のまわりが明るく、夜明けは北東から白む）
vec3 nightSky(vec3 d) {
  float y = max(d.y, 0.0);
  vec3 col = mix(uSkyHorizon, uSkyZenith, pow(y, 0.5));
  float m = max(dot(d, uMoonDir), 0.0);
  col += uMoonCol * (pow(m, 30.0) * 0.025 + pow(m, 900.0) * 0.18);
  vec3 dawnDir = normalize(vec3(0.7, 0.0, -0.7));
  float dd = max(dot(normalize(vec3(d.x, 0.0, d.z)), dawnDir), 0.0);
  col += vec3(0.55, 0.42, 0.5) * uDawn * pow(dd, 3.0) * exp(-y * 5.0) * 0.6;
  return col;
}
`;

/**
 * MeshStandardMaterial に「側溝の水の下の光」と「夜のかすみ」を足す。
 * opts.fx = { key, decl?, vdecl?, vcode?, color?, normal?, rough?, light? }（色・法線・粗さ・光への追加処理）
 * opts.water: 水の下の処理をするか（側溝の外の物は false で軽く）
 */
export function patchMaterial(material, opts = {}) {
  const { water = true, fx = null, uniforms = null, fog = true } = opts;
  material.onBeforeCompile = (shader) => {
    for (const k in U) shader.uniforms[k] = U[k];
    if (uniforms) for (const k in uniforms) shader.uniforms[k] = uniforms[k];
    let vs = shader.vertexShader;
    vs = vs.replace('#include <common>', `#include <common>\n${COMMON_GLSL}\nvarying vec3 vWPos;\n${fx?.vdecl || ''}`);
    if (fx?.vcode) vs = vs.replace('#include <begin_vertex>', `#include <begin_vertex>\n${fx.vcode}`);
    if (fx?.vnormal) vs = vs.replace('#include <beginnormal_vertex>', fx.vnormal);
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
    fs = fs.replace('#include <common>', `#include <common>\n${COMMON_GLSL}\nvarying vec3 vWPos;\n${water ? '#define UN_WATER' : ''}\n${fx?.decl || ''}`);
    if (fx?.color) fs = fs.replace('#include <color_fragment>', `#include <color_fragment>\n${fx.color}`);
    if (fx?.normal) fs = fs.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>\n${fx.normal}`);
    if (fx?.rough) fs = fs.replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>\n${fx.rough}`);
    fs = fs.replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
      {
        // ライトのすぐそば（85cm 以内）は、近づくほど明るくなる分をおさえる（手元 20〜30cm は白飛びさせず、掲げた網 60cm はよく見える）
        float dlamp = length(vWPos - uLampPos);
        float nearK = clamp(pow(dlamp / 0.85, 3.6), 0.02, 1.0);
        reflectedLight.directDiffuse *= nearK;
        reflectedLight.directSpecular *= nearK;
      }
      #ifdef UN_WATER
      {
        // 水の下: ライトの光は水の中を通る道のりの分だけ弱まり（赤から先に）、さざ波で網目ができる
        float lv = ditchLevel(vWPos);
        float wd = lv - vWPos.y;
        float under = smoothstep(-0.01, 0.03, wd);
        if (under > 0.0) {
          vec3 L = normalize(vWPos - uLampPos);
          float path = max(wd, 0.0) / max(-L.y, 0.22);
          vec3 ab = exp(-uWaterSigma * path);
          float c = 1.0;
          if (uCaustic > 0.0) {
            vec3 ps = vWPos - L * (max(wd, 0.0) / max(-L.y, 0.22));
            float cd = length(vWPos - uLampPos);
            float cf = uCaustic * smoothstep(0.0, 0.1, wd) * (1.0 - smoothstep(4.0, 9.0, cd));
            c = mix(1.0, 0.72 + un_caustics(ps.xz * 7.5, uTime * 1.4, wd) * 0.5, cf);
          }
          reflectedLight.directDiffuse *= mix(vec3(1.0), ab * c, under);
          reflectedLight.directSpecular *= mix(vec3(1.0), ab * 0.6, under);
          reflectedLight.indirectDiffuse *= mix(1.0, 0.7, under);
        }
      }
      #endif
      ${fx?.light || ''}`);
    if (fog) {
      fs = fs.replace('#include <fog_fragment>', `
        {
          float dist = length(vWPos - cameraPosition);
          // 地面近くほど濃い夜のもや
          float hk = exp(-max(vWPos.y - 0.6, 0.0) * 0.35);
          float af = 1.0 - exp(-uFog * dist * (0.35 + 0.65 * hk));
          gl_FragColor.rgb = mix(gl_FragColor.rgb, uFogCol, af);
        }`);
    }
    shader.fragmentShader = fs;
    material.userData.shader = shader;
  };
  material.customProgramCacheKey = () => `un|${water ? 1 : 0}|${fog ? 1 : 0}|${fx?.key || '-'}`;
  return material;
}
