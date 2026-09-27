// 空気のもや（空気遠近）と、絵の仕上げの色
// ・もやは低い所ほど濃い。カメラから見ている所までの道のりで濃さを積分するので、
//   地上から遠くを見ると白くかすみ、空から見下ろすと澄んで見える
// ・three.js の fog の部品を差しかえるので、fog: true のマテリアルすべてに効く（scene.fog は FogExp2、density = 地面の濃さ）
import * as THREE from 'three';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

const SUN = new THREE.Vector3(0.42, 0.78, 0.46).normalize(); // render.js の SUN_DIR と同じ
const f = (v) => v.toFixed(5);

export const HAZE_GLSL = /* glsl */ `
  // 見ている所までの、もやのかかり具合 0..1
  float hazeAmount(vec3 wp, vec3 cam, float dens) {
    vec3 r = wp - cam;
    float dist = length(r);
    float d = max(dist - 30.0, 0.0);          // 目の前はかすませない
    float k = 0.0085 * r.y;                   // 高さ 118m で 1/e になる
    float g = abs(k) > 1e-3 ? (1.0 - exp(-k)) / k : 1.0 - 0.5 * k;
    float od = dens * d * exp(-0.0085 * max(cam.y, -5.0)) * g;
    // 2 乗: 近くは澄んで、遠くほど急に白くなる
    return min(1.0 - exp(-od * od), 0.95);
  }
  // もやの色: 太陽の方はほんのり明るく暖かい
  vec3 hazeColor(vec3 wp, vec3 cam, vec3 base) {
    vec3 dir = normalize(wp - cam);
    float s = max(dot(dir, vec3(${f(SUN.x)}, ${f(SUN.y)}, ${f(SUN.z)})), 0.0);
    return base + vec3(1.0, 0.93, 0.8) * (pow(s, 5.0) * 0.16);
  }
`;

let installed = false;
export function installHaze() {
  if (installed) return;
  installed = true;
  const C = THREE.ShaderChunk;
  C.fog_pars_vertex = /* glsl */ `
    #ifdef USE_FOG
      varying float vFogDepth;
      varying vec3 vFogWP;
    #endif`;
  // 世界座標は視点座標から戻す（ビュー行列は回転 + 平行移動なので、逆は転置で済む）
  C.fog_vertex = /* glsl */ `
    #ifdef USE_FOG
      vFogDepth = - mvPosition.z;
      vFogWP = transpose(mat3(viewMatrix)) * (mvPosition.xyz - viewMatrix[3].xyz);
    #endif`;
  C.fog_pars_fragment = /* glsl */ `
    #ifdef USE_FOG
      uniform vec3 fogColor;
      varying float vFogDepth;
      varying vec3 vFogWP;
      #ifdef FOG_EXP2
        uniform float fogDensity;
      #else
        uniform float fogNear;
        uniform float fogFar;
      #endif
      ${HAZE_GLSL}
    #endif`;
  C.fog_fragment = /* glsl */ `
    #ifdef USE_FOG
      #ifdef FOG_EXP2
        gl_FragColor.rgb = mix(gl_FragColor.rgb, hazeColor(vFogWP, cameraPosition, fogColor), hazeAmount(vFogWP, cameraPosition, fogDensity));
      #else
        gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, smoothstep(fogNear, fogFar, vFogDepth));
      #endif
    #endif`;
}

// 仕上げの色: 彩度を少し落とし、暗い所を持ち上げて、夏の昼のやわらかい絵にする（OutputPass の後の sRGB に掛ける）
export function gradePass() {
  return new ShaderPass({
    uniforms: { tDiffuse: { value: null }, uAmount: { value: 1 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D tDiffuse;
      uniform float uAmount;
      varying vec2 vUv;
      void main() {
        vec4 t = texture2D(tDiffuse, vUv);
        vec3 c = t.rgb;
        float l = dot(c, vec3(0.299, 0.587, 0.114));
        vec3 g = mix(vec3(l), c, 0.9);                       // 彩度
        g = g * 0.97 + vec3(0.015, 0.02, 0.028);              // 暗部を青みのある明るさへ
        g = pow(max(g, 0.0), vec3(0.97, 1.0, 1.04));          // 中間をわずかに暖かく
        gl_FragColor = vec4(mix(c, g, uAmount), t.a);
      }`,
  });
}
