// 全マテリアル共通の水中シェーダーパッチ
// ・水深による光の吸収（赤→緑→青の順に消える）
// ・太陽方向から投影されるコースティクス
// ・水中／水上で切り替わる独自フォグ
// ・魚の泳ぎ／海藻の揺れの頂点アニメーション
import * as THREE from 'three';

export const U = {
  uTime: { value: 0 },
  uSunDir: { value: new THREE.Vector3(0.3, 0.85, 0.2).normalize() },
  uSunCol: { value: new THREE.Color(1, 0.95, 0.88) },
  uUnder: { value: 1 },
  uFogDensity: { value: 0.034 },
  uAirFog: { value: 0.0014 },
  uAirFogCol: { value: new THREE.Color('#bcd6e6') },
  uWaterShallow: { value: new THREE.Color('#2aa6b0') },
  uWaterDeep: { value: new THREE.Color('#06324a') },
  uCaustic: { value: 1 },
  uSkyZenith: { value: new THREE.Color('#2f6fc4') },
  uSkyHorizon: { value: new THREE.Color('#c4e2f2') },
};

export const COMMON_GLSL = /* glsl */ `
uniform float uTime;
uniform vec3 uSunDir;
uniform vec3 uSunCol;
uniform float uUnder;
uniform float uFogDensity;
uniform float uAirFog;
uniform vec3 uAirFogCol;
uniform vec3 uWaterShallow;
uniform vec3 uWaterDeep;
uniform float uCaustic;
uniform vec3 uSkyZenith;
uniform vec3 uSkyHorizon;

vec3 uwAbsorb(float y) {
  float d = max(-y, 0.0);
  return exp(-d * vec3(0.12, 0.05, 0.034)) * 0.82;
}
vec3 uwFogColor(float y) {
  float k = exp(min(y, 0.0) * 0.06);
  return mix(uWaterDeep, uWaterShallow, k);
}
vec2 uwHash2(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return fract(sin(p) * 43758.5453);
}
// ボロノイの境界 = 光の網目
float uwVoro(vec2 p, float t) {
  vec2 ip = floor(p), fp = fract(p);
  float d1 = 8.0, d2 = 8.0;
  for (int y = -1; y <= 1; y++)
  for (int x = -1; x <= 1; x++) {
    vec2 g = vec2(float(x), float(y));
    vec2 o = uwHash2(ip + g);
    o = 0.5 + 0.42 * sin(t + 6.2831 * o);
    vec2 r = g + o - fp;
    float d = dot(r, r);
    if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) { d2 = d; }
  }
  return sqrt(d2) - sqrt(d1);
}
float uwCaustics(vec2 p, float t) {
  float a = uwVoro(p, t * 0.9);
  float b = uwVoro(p * 1.43 + vec2(3.7, 1.3), t * 1.17 + 2.0);
  float ca = exp(-a * 7.0);
  float cb = exp(-b * 8.0);
  return ca * 0.55 + cb * 0.45 + ca * cb * 1.6;
}
vec3 skyColor(vec3 d) {
  float y = max(d.y, 0.0);
  vec3 col = mix(uSkyHorizon, uSkyZenith, pow(y, 0.45));
  float sd = max(dot(d, uSunDir), 0.0);
  col += uSunCol * (pow(sd, 6.0) * 0.22 + pow(sd, 48.0) * 0.5);
  return col;
}
`;

const SWAY = {
  fish: {
    decl: `attribute float aBody; uniform float uPhase; uniform float uAmp; uniform float uBend;`,
    code: `
      float bw = aBody * aBody * 0.95 + 0.04;
      transformed.x += sin(uPhase - aBody * 4.6) * uAmp * bw;
      transformed.x += uBend * aBody * aBody;
    `,
  },
  // 突ける魚をまとめて描く用（個体ごとの泳ぎ位相・振幅・曲がりをインスタンス属性で渡す）
  fishI: {
    decl: `attribute float aBody; attribute vec3 iSwim;`,
    code: `
      float bw = aBody * aBody * 0.95 + 0.04;
      transformed.x += sin(iSwim.x - aBody * 4.6) * iSwim.y * bw;
      transformed.x += iSwim.z * aBody * aBody;
    `,
  },
  fishInst: {
    decl: `attribute float aBody; attribute float aPhase;`,
    code: `
      float bw = aBody * aBody * 0.95 + 0.04;
      transformed.x += sin(uTime * 13.0 + aPhase - aBody * 4.6) * 0.075 * bw;
    `,
  },
  plant: {
    decl: `attribute float aSway; uniform float uSwayAmp;`,
    code: `
      vec3 ip = vec3(0.0);
      #ifdef USE_INSTANCING
        ip = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
      #endif
      float ph = uTime * 0.9 + ip.x * 0.23 + ip.z * 0.19;
      float s2 = aSway * aSway;
      transformed.x += (sin(ph) * 0.7 + sin(ph * 2.3 + 1.7) * 0.3) * s2 * uSwayAmp;
      transformed.z += (cos(ph * 0.8 + 0.5) * 0.5 + sin(ph * 1.9) * 0.2) * s2 * uSwayAmp;
    `,
  },
  octo: {
    decl: `attribute float aBody; attribute float aArm; uniform float uAmp; uniform float uCurl;`,
    code: `
      float ph = uTime * 1.7 + aArm * 1.31;
      float a2 = aBody * aBody;
      transformed.x += sin(ph + aBody * 4.0) * a2 * uAmp;
      transformed.z += cos(ph * 0.9 + aBody * 3.3) * a2 * uAmp;
      transformed.y += (sin(ph * 1.3 + aBody * 5.0) * 0.5 + uCurl) * a2 * uAmp;
    `,
  },
};

/**
 * MeshStandardMaterial 等に水中表現を注入する。
 * @param {THREE.Material} material
 * sway は SWAY の名前か、{decl, code, ncode?} の定義そのもの。
 * fx は {key, decl, color?, normal?, rough?, light?, vdecl?, vcode?}：色・法線・粗さ・光への追加処理（頂点側の受け渡しも可）。
 * @param {{caustics?:boolean, sway?:string|object, uniforms?:object, sandRipple?:boolean, fx?:object}} opts
 */
export function patchMaterial(material, opts = {}) {
  const { caustics = true, sway = null, uniforms = null, sandRipple = false, fx = null } = opts;
  const swayDef = typeof sway === 'string' ? SWAY[sway] : sway;
  material.userData.uw = true;
  material.onBeforeCompile = (shader) => {
    for (const k in U) shader.uniforms[k] = U[k];
    if (uniforms) for (const k in uniforms) shader.uniforms[k] = uniforms[k];
    if (sway === 'plant' && !(uniforms && uniforms.uSwayAmp)) shader.uniforms.uSwayAmp = { value: 0.25 };

    let vs = shader.vertexShader;
    vs = vs.replace('#include <common>', `#include <common>\n${COMMON_GLSL}\nvarying vec3 vWPos;\n${swayDef ? swayDef.decl : ''}\n${sandRipple ? 'attribute float aSand; varying float vSand;' : ''}\n${fx?.vdecl || ''}`);
    if (fx?.vcode) vs = vs.replace('#include <begin_vertex>', `#include <begin_vertex>\n${fx.vcode}`);
    if (swayDef) vs = vs.replace('#include <begin_vertex>', `#include <begin_vertex>\n${swayDef.code}`);
    if (swayDef?.ncode) vs = vs.replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>\n${swayDef.ncode}`);
    vs = vs.replace('#include <project_vertex>', `#include <project_vertex>
      {
        vec4 uwWp = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          uwWp = instanceMatrix * uwWp;
        #endif
        vWPos = (modelMatrix * uwWp).xyz;
        ${sandRipple ? 'vSand = aSand;' : ''}
      }`);
    shader.vertexShader = vs;

    let fs = shader.fragmentShader;
    fs = fs.replace('#include <common>', `#include <common>\n${COMMON_GLSL}\nvarying vec3 vWPos;\n${sandRipple ? 'varying float vSand;' : ''}\n${caustics ? '#define UW_CAUSTICS' : ''}\n${fx?.decl || ''}`);
    if (fx) {
      if (fx.color) fs = fs.replace('#include <color_fragment>', `#include <color_fragment>\n${fx.color}`);
      if (fx.normal) fs = fs.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>\n${fx.normal}`);
      if (fx.rough) fs = fs.replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>\n${fx.rough}`);
    }

    if (sandRipple) {
      // 地面の色むら（近くで見ても平坦にならないように）
      fs = fs.replace('#include <color_fragment>', `#include <color_fragment>
        {
          vec2 q = vWPos.xz;
          // 格子の出ない、うねった色むら
          float w1 = sin(q.x * 0.83 + sin(q.y * 0.61) * 1.7) * sin(q.y * 0.97 + sin(q.x * 0.47) * 1.3);
          float w2 = sin(q.x * 2.3 - q.y * 1.7 + sin(q.y * 1.9) * 0.8) * 0.5;
          float vn = 0.5 + 0.35 * w1 + 0.15 * w2;
          diffuseColor.rgb *= 0.88 + vn * 0.2;
        }`);
      // 砂紋: 法線を揺らして細かな陰影を作る
      fs = fs.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        {
          vec2 q = vWPos.xz;
          float w1 = q.x * 0.9 + q.y * 0.35 + sin(q.y * 0.21 + q.x * 0.07) * 2.2;
          float w2 = q.x * 0.31 - q.y * 1.1 + sin(q.x * 0.17) * 1.6;
          vec2 g = vec2(0.9, 0.35) * cos(w1 * 2.6) * 0.55 + vec2(0.31, -1.1) * cos(w2 * 2.1) * 0.25;
          float m = vSand * (1.0 - smoothstep(-1.2, 0.3, vWPos.y));
          vec3 gw = vec3(-g.x, 0.0, -g.y) * m * 1.1;
          normal = normalize(normal + (viewMatrix * vec4(gw, 0.0)).xyz);
        }`);
    }

    fs = fs.replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
      {
        if (vWPos.y < 0.0) {
          vec3 upV = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
          float facing = clamp(dot(normal, upV) * 0.65 + 0.35, 0.0, 1.0);
          vec3 ab = uwAbsorb(vWPos.y);
          #ifdef UW_CAUSTICS
            vec3 sd = normalize(uSunDir);
            vec2 cp = vWPos.xz - sd.xz / max(sd.y, 0.25) * vWPos.y * 0.75;
            float c = uwCaustics(cp * 0.38, uTime * 1.1);
            float cf = uCaustic * facing * exp(vWPos.y * 0.05) * (1.0 - smoothstep(-0.8, 0.0, vWPos.y));
            reflectedLight.directDiffuse *= ab * mix(1.0, 0.42 + c * 1.9, cf) * 0.85;
          #else
            reflectedLight.directDiffuse *= ab * 0.85;
          #endif
          reflectedLight.indirectDiffuse *= mix(vec3(1.0), ab, 0.55) * 1.15;
          // 水に散乱した光（影が黒ではなく青緑になる）
          reflectedLight.indirectDiffuse += diffuseColor.rgb * uWaterShallow * (0.55 + 0.45 * facing) * 0.55 * exp(vWPos.y * 0.045);
          reflectedLight.directSpecular *= ab;
        }
      }
      ${fx?.light || ''}`);

    fs = fs.replace('#include <fog_fragment>', `
      #ifdef USE_FOG
      {
        vec3 toF = vWPos - cameraPosition;
        float dist = length(toF);
        if (uUnder > 0.5) {
          gl_FragColor.rgb *= exp(-dist * vec3(0.1, 0.036, 0.026));
          float ff = 1.0 - exp(-uFogDensity * dist);
          gl_FragColor.rgb = mix(gl_FragColor.rgb, uwFogColor(vWPos.y), ff);
        } else {
          if (vWPos.y < 0.0) {
            float vy = max(abs(toF.y) / max(dist, 0.001), 0.12);
            float path = -vWPos.y / vy;
            float wf = 1.0 - exp(-0.13 * path);
            gl_FragColor.rgb = mix(gl_FragColor.rgb * uwAbsorb(vWPos.y * 1.5), uWaterDeep * 1.2, wf);
          }
          float af = 1.0 - exp(-uAirFog * dist);
          gl_FragColor.rgb = mix(gl_FragColor.rgb, uAirFogCol, af);
        }
      }
      #endif`);
    shader.fragmentShader = fs;
    material.userData.shader = shader;
  };
  const swayKey = typeof sway === 'string' ? sway : swayDef?.key || (swayDef ? 'custom' : '-');
  material.customProgramCacheKey = () => `uw|${swayKey}|${caustics ? 1 : 0}|${sandRipple ? 1 : 0}|${fx?.key || '-'}`;
  return material;
}
