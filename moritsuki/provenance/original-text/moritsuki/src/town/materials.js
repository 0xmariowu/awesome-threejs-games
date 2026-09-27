// 町の共通マテリアル: ランバート + 世界座標のノイズで「塗り」のむらを出す
import * as THREE from 'three';

export const NOISE_GLSL = /* glsl */ `
float tnH(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float tnV(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(tnH(i), tnH(i + vec2(1, 0)), f.x), mix(tnH(i + vec2(0, 1)), tnH(i + vec2(1, 1)), f.x), f.y);
}
float tnF(vec2 p) { return tnV(p) * 0.55 + tnV(p * 2.3 + 7.1) * 0.3 + tnV(p * 5.1 + 3.3) * 0.15; }
`;

/**
 * @param {object} o
 *  amp: 塗りむらの強さ, scale: むらの細かさ(1/m)
 *  vars: 追加の varying 宣言, vtx: 頂点側で追加する処理, frag: 色を決めた後に追加する処理（diffuseColor を触る）
 *  vtxPre: 頂点を動かす処理（transformed を書き換える）
 *  attrs: 追加の attribute 宣言
 */
export function paint(mat, o = {}) {
  const amp = o.amp ?? 0.12, scale = o.scale ?? 0.4;
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = TIME;
    Object.assign(sh.uniforms, o.uniforms || {});
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vWP;\nvarying vec3 vWN;\n${o.attrs || ''}\n${o.vars || ''}\nuniform float uTime;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        ${o.vtxPre || ''}`)
      .replace('#include <project_vertex>', `#include <project_vertex>
        vec4 wp4 = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          wp4 = instanceMatrix * wp4;
        #endif
        vWP = (modelMatrix * wp4).xyz;
        vWN = normalize(mat3(modelMatrix) * objectNormal);
        ${o.vtx || ''}`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vWP;\nvarying vec3 vWN;\n${o.vars || ''}\nuniform float uTime;\n${NOISE_GLSL}\n${o.fragHead || ''}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        {
          vec3 q = vWP * ${scale.toFixed(3)};
          vec2 pp = abs(vWN.y) > 0.6 ? q.xz : (abs(vWN.x) > abs(vWN.z) ? q.zy : q.xy);
          diffuseColor.rgb *= 1.0 + (tnF(pp) - 0.5) * ${(amp * 2).toFixed(3)};
        }
        ${o.frag || ''}`);
    if (o.after) o.after(sh);
  };
  mat.customProgramCacheKey = () => (o.key || 'paint') + amp + scale;
  return mat;
}

export const TIME = { value: 0 };

// 世界座標の三面投影でテクスチャの「むら」を乗せる（UV のない形向け）
export function triplanarDetail(tex, avg, size = 2.5, strength = 0.9) {
  return {
    uniforms: { tDet: { value: tex }, aDet: { value: avg } },
    fragHead: 'uniform sampler2D tDet; uniform vec3 aDet;',
    frag: `
      {
        vec3 bw = pow(abs(vWN), vec3(4.0)); bw /= (bw.x + bw.y + bw.z);
        vec3 t = texture2D(tDet, vWP.zy / ${size.toFixed(2)}).rgb * bw.x + texture2D(tDet, vWP.xz / ${size.toFixed(2)}).rgb * bw.y + texture2D(tDet, vWP.xy / ${size.toFixed(2)}).rgb * bw.z;
        float dist = length(cameraPosition - vWP);
        diffuseColor.rgb *= mix(vec3(1.0), t / aDet, ${strength.toFixed(2)} * (1.0 - smoothstep(60.0, 200.0, dist)));
      }`,
  };
}

export function lambert(opts = {}, p = {}) {
  return paint(new THREE.MeshLambertMaterial({ vertexColors: true, ...opts }), p);
}

// 看板などの文字テクスチャ
export function textTexture(lines, { w = 512, h = 128, bg = '#fff', fg = '#222', font = '900 72px "Zen Kaku Gothic New", "Yu Gothic", sans-serif', border = null, vertical = false } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  if (border) { g.strokeStyle = border; g.lineWidth = Math.max(4, h * 0.05); g.strokeRect(g.lineWidth / 2, g.lineWidth / 2, w - g.lineWidth, h - g.lineWidth); }
  g.fillStyle = fg; g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle';
  const L = Array.isArray(lines) ? lines : [lines];
  if (vertical) {
    const s = L[0], n = s.length;
    for (let i = 0; i < n; i++) g.fillText(s[i], w / 2, h * (i + 0.5) / n);
  } else {
    L.forEach((s, i) => g.fillText(s, w / 2, h * (i + 0.5) / L.length));
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// ---------- カメラと主人公の間の葉を透かす ----------
// FOCUS.xyz = 主人公の頭、w = 1 で有効。カメラから主人公までの筒の中と、カメラのすぐ近くの葉を
// 画面の網点で抜く（半透明にすると並べ替えが要るので、ディザで抜く。市販のゲームと同じやり方）
export const FOCUS = { value: new THREE.Vector4(0, -1e5, 0, 0) };
export const OCCLUDE_HEAD = 'uniform vec4 uFocus;';
// 葉以外（幹など）にも同じ透かしを足す
export function occlude(mat, key) {
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    prev?.call(mat, sh, r);
    sh.uniforms.uFocus = FOCUS;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWP;')
      .replace('#include <project_vertex>', `#include <project_vertex>
        {
          vec4 wq = vec4(transformed, 1.0);
          #ifdef USE_INSTANCING
            wq = instanceMatrix * wq;
          #endif
          vWP = (modelMatrix * wq).xyz;
        }`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWP;\n' + OCCLUDE_HEAD)
      .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\n' + OCCLUDE_GLSL);
  };
  mat.customProgramCacheKey = () => 'occ-' + key;
  return mat;
}
export const OCCLUDE_GLSL = /* glsl */ `
  if (uFocus.w > 0.5) {
    vec3 seg = uFocus.xyz - cameraPosition;
    float L = length(seg);
    vec3 dir = seg / max(L, 1e-3);
    vec3 rel = vWP - cameraPosition;
    float t = dot(rel, dir);
    float perp = length(rel - dir * clamp(t, 0.0, L));
    // 筒は主人公の手前 0.5 m まで。主人公に近いほど細く、カメラ側は太く
    float r = mix(2.0, 1.1, clamp(t / max(L, 1e-3), 0.0, 1.0));
    // 網点になるのは境目の細い帯だけ（広い範囲を半分抜くと、画面全体がざらざらに見える）
    float fade = (t > -0.5 && t < L - 0.5) ? 1.0 - smoothstep(r * 0.8, r, perp) : 0.0;
    fade = max(fade, 1.0 - smoothstep(2.2, 2.7, length(rel)));
    float ign = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
    if (fade > ign) discard;
  }
`;
