// 夜の砂の上で赤く光る点: フグの眼の照り返しと、まぎらわしい物（濡れた赤い小石・茶色いガラス・貝殻のかけら）の反射
//
// 光り方のちがいは「ほんのちょっとだけ」（ユーザー指定）。どちらもヘッドライトの光を返しているだけで、
//  ・眼（輝板）: 来た光をほぼそのまま来た方へ返す（再帰反射）。眼が向いている範囲なら、見る角度が少し変わっても明るさはあまり変わらない。
//                水面のさざ波で光の道すじがゆれても、行きと帰りで同じ道を通るので、ちらつかない。眼玉がときどき動くので、ゆっくり明るさが変わる
//  ・石・ガラス・貝殻: 濡れてつるつるの面の鏡の反射。
//                平たい面（ガラス・貝殻・割れた石）は、面の向きがライトと目のまん中を向いた時だけ光る（歩くと、ついたり消えたり）。
//                丸い小石は、どこから見ても表面のどこかが光る（眼とほとんど区別がつかない）。ただ、水面のさざ波で光が集まったり散ったりして、
//                ほんのわずかにまたたく（眼はまたたかない）
//  ・色はどちらも赤〜橙。眼は深い赤、物はほんの少し橙寄り（物によっては眼と同じ）
// どれも水の下の砂にあるので、水面の処理より前に描く（屈折でゆがみ、水の中の道のりで弱まる）。深度は比べるが書かない
import * as THREE from 'three';
import { U, COMMON_GLSL } from './shade.js';

export const EYE_COL = [1.0, 0.13, 0.05];

const VS = /* glsl */ `
  ${COMMON_GLSL}
  attribute vec3 aDir;     // 眼の向き・面の向き
  attribute vec4 aPar;     // 種類（0 眼 / 1 物）, 鋭さ, 乱数, 強さ
  attribute vec3 aCol;
  uniform float uPR;
  uniform float uViewH;
  uniform float uGain;
  uniform float uWob;
  uniform float uSize;
  uniform float uShim;
  varying vec3 vCol;
  void main() {
    vec3 p = position;
    vec3 toH = normalize(uHeadPos - p);
    vec3 toC = normalize(cameraPosition - p);
    float irr = headIrr(p);
    float seed = aPar.z;
    // 水面のさざ波で、水の中に届く光の向きが少しずつゆれる（水の下の物だけ）
    float wd = uTide - p.y;
    float under = smoothstep(0.0, 0.05, wd);
    vec3 wob = vec3(
      sin(uTime * 2.1 + seed * 41.0 + p.x * 7.3) + 0.6 * sin(uTime * 3.7 + seed * 13.0 + p.z * 11.0),
      0.0,
      cos(uTime * 1.7 + seed * 23.0 + p.z * 8.1) + 0.6 * cos(uTime * 3.1 + seed * 7.0 + p.x * 12.0)
    ) * uWob * under;
    float lobe;
    if (aPar.x < 0.5) {
      // 眼: 行きも帰りも同じ道なので、さざ波のゆれはほとんど効かない
      lobe = pow(max(dot(aDir, normalize(toH + wob * 0.08)), 0.0), 1.6);
    } else {
      vec3 h = normalize(toH + toC + wob);
      // 鋭い面ほど、向きが合った時は強く光る（光る向きのせまさと、明るさのつり合い）
      lobe = pow(max(dot(aDir, h), 0.0), aPar.y) * max((aPar.y + 2.0) / 8.0, 0.5);
      // さざ波で、ほんのわずかにまたたく
      lobe *= 1.0 + 0.22 * uShim * under * sin(uTime * (6.0 + seed * 5.0) + seed * 60.0) * sin(uTime * (2.3 + seed * 1.7) + seed * 17.0);
    }
    float B = irr * lobe * aPar.w * uGain;
    vCol = aCol * B;
    // 深度で隠れすぎないよう、少しだけ手前に置く
    vec3 pr = p + toC * 0.008;
    vec4 mv = viewMatrix * vec4(pr, 1.0);
    gl_Position = projectionMatrix * mv;
    float px = uSize * projectionMatrix[1][1] * uViewH * 0.5 / max(-mv.z, 0.05);
    float minPx = 2.6 * uPR;
    // 点は光る芯のまわりに、にじみの分だけ大きく描く（芯は 3 分の 1）
    gl_PointSize = max(px, minPx) * 3.2;
    // 点が小さすぎる分は明るさで補う（遠くても見える）
    vCol *= min(1.0, px / minPx + 0.5);
    if (B < 0.002) gl_PointSize = 0.0;
  }
`;
const FS = /* glsl */ `
  varying vec3 vCol;
  void main() {
    vec2 p = gl_PointCoord - 0.5;
    float d = length(p);
    if (d > 0.5) discard;
    // 芯（まん中の 3 分の 1）・にじみ・うすい光の輪
    float core = exp(-d * d * 420.0);
    float halo = exp(-d * d * 60.0) * 0.16;
    float wide = exp(-d * d * 14.0) * 0.035;
    // 芯は白っぽくならないよう、赤のまま強く（にじみはもっと赤く）
    vec3 c = vCol * core + vCol * vec3(1.0, 0.7, 0.7) * (halo + wide);
    gl_FragColor = vec4(c, 1.0);
  }
`;

export class Shine {
  constructor(scene, max = 700) {
    this.max = max;
    this.pos = new Float32Array(max * 3);
    this.dir = new Float32Array(max * 3);
    this.par = new Float32Array(max * 4);
    this.col = new Float32Array(max * 3);
    const g = new THREE.BufferGeometry();
    const dyn = (a, n) => new THREE.BufferAttribute(a, n).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', dyn(this.pos, 3));
    g.setAttribute('aDir', dyn(this.dir, 3));
    g.setAttribute('aPar', dyn(this.par, 4));
    g.setAttribute('aCol', dyn(this.col, 3));
    this.uniforms = { ...U, uPR: { value: 1 }, uViewH: { value: 720 }, uGain: { value: 30 }, uWob: { value: 0.1 }, uSize: { value: 0.0055 }, uShim: { value: 1 } };
    const m = new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: VS, fragmentShader: FS, transparent: true, depthTest: true, depthWrite: false, blending: THREE.AdditiveBlending });
    this.points = new THREE.Points(g, m);
    this.points.frustumCulled = false;
    this.points.renderOrder = 4;
    scene.add(this.points);
    this.n = 0;
  }
  setPR(pr) { this.uniforms.uPR.value = pr; }
  setViewH(h) { this.uniforms.uViewH.value = h; }
  begin() { this.n = 0; }
  /** 光る点を 1 つ足す（kind: 0 = 眼, 1 = 物） */
  add(x, y, z, dx, dy, dz, kind, sharp, seed, strength, col) {
    if (this.n >= this.max) return;
    const i = this.n++;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.dir[i * 3] = dx; this.dir[i * 3 + 1] = dy; this.dir[i * 3 + 2] = dz;
    this.par[i * 4] = kind; this.par[i * 4 + 1] = sharp; this.par[i * 4 + 2] = seed; this.par[i * 4 + 3] = strength;
    this.col[i * 3] = col[0]; this.col[i * 3 + 1] = col[1]; this.col[i * 3 + 2] = col[2];
  }
  end() {
    const g = this.points.geometry;
    g.setDrawRange(0, this.n);
    for (const k of ['position', 'aDir', 'aPar', 'aCol']) g.attributes[k].needsUpdate = true;
  }
}
