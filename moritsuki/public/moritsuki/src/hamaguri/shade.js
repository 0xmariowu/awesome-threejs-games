// ハマグリ突きの共通シェーダー部品
// ・全マテリアルが共有する uniform（時刻・太陽・空の色・潮位）
// ・水の下の砂に落ちる光の網目（コースティクス）
// ・空気のかすみ
// 水面そのものは water.js の画面処理で描く（ここは水の「下」と「上」の物の光だけ）
import * as THREE from 'three';

export const U = {
  uTime: { value: 0 },
  uSunDir: { value: new THREE.Vector3(0.25, 0.9, 0.35).normalize() },
  uSunCol: { value: new THREE.Color('#fff4e2') },
  uSkyZenith: { value: new THREE.Color('#2a68c4') },
  uSkyHorizon: { value: new THREE.Color('#bfdcef') },
  uAirFogCol: { value: new THREE.Color('#cadfea') },
  uAirFog: { value: 0.0011 },
  uTide: { value: 0 },        // 平均の水面の高さ（潮位）
  uCaustic: { value: 1 },
  uWaterTint: { value: new THREE.Color('#2f8f86') },
  // 水の下の砂の見え方（波で揺れる水面の高さは画面処理で。ここでは影と光の網目だけ）
  uPlayer: { value: new THREE.Vector3() },
};

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
vec3 skyColor(vec3 d) {
  float y = max(d.y, 0.0);
  vec3 col = mix(uSkyHorizon, uSkyZenith, pow(y, 0.45));
  float sd = max(dot(d, uSunDir), 0.0);
  col += uSunCol * (pow(sd, 6.0) * 0.22 + pow(sd, 48.0) * 0.5);
  return col;
}
`;

/**
 * MeshStandardMaterial に「水の下の光」と「空気のかすみ」を足す。
 * opts.fx = { key, decl?, vdecl?, vcode?, color?, normal?, rough?, light? }（色・法線・粗さ・光への追加処理）
 * opts.caustics: 水の下に光の網目を落とす
 */
export function patchMaterial(material, opts = {}) {
  const { caustics = true, fx = null, uniforms = null, fog = true } = opts;
  material.onBeforeCompile = (shader) => {
    for (const k in U) shader.uniforms[k] = U[k];
    if (uniforms) for (const k in uniforms) shader.uniforms[k] = uniforms[k];
    let vs = shader.vertexShader;
    vs = vs.replace('#include <common>', `#include <common>\n${COMMON_GLSL}\nvarying vec3 vWPos;\n${fx?.vdecl || ''}`);
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
        // 水の下: 直射は光の網目で明暗がつき、赤から先に弱まる
        float wd = uTide - vWPos.y;
        float under = smoothstep(-0.02, 0.06, wd);
        if (under > 0.0) {
          vec3 ab = exp(-max(wd, 0.0) * vec3(0.32, 0.075, 0.06));
          #ifdef HM_CAUSTICS
            vec3 sd = normalize(uSunDir);
            float cdist = length(vWPos - cameraPosition);
            float cf = uCaustic * smoothstep(0.0, 0.12, wd) * (1.0 - smoothstep(18.0, 32.0, cdist));
            float c = 0.55;
            if (cf > 0.001) {
              vec2 cp = vWPos.xz - sd.xz / max(sd.y, 0.3) * max(wd, 0.0);
              c = hm_caustics(cp * 2.1, uTime * 1.25, max(wd, 0.0));
            }
            reflectedLight.directDiffuse *= mix(vec3(1.0), ab * mix(0.62, 0.3 + c * 1.35, cf), under);
          #else
            reflectedLight.directDiffuse *= mix(vec3(1.0), ab, under);
          #endif
          reflectedLight.directSpecular *= mix(1.0, 0.35, under);
          reflectedLight.indirectDiffuse *= mix(vec3(1.0), mix(vec3(1.0), ab, 0.5) * 1.05, under);
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
  material.customProgramCacheKey = () => `hm|${caustics ? 1 : 0}|${fog ? 1 : 0}|${fx?.key || '-'}`;
  return material;
}
