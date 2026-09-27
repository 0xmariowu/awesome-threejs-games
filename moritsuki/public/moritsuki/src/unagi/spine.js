// 背骨にそって曲がる体（ウナギ・ドジョウ・ナマズ・スズキ）
// ・形は「体の長さ = 1」の座標で作る: x = 右、y = 上、z = 前（頭の先より前へ出るひげなど）、aS = 頭(0)→尾(1)
// ・動きは CPU が関節の位置と上向きを毎コマ計算してテクスチャに書き、頂点シェーダーで体を曲げる
// ・1 種類 = 1 つの InstancedMesh（1 匹 = 1 行）
import * as THREE from 'three';
import { patchMaterial } from './shade.js';

const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

// 関節の読み出しと、背骨の座標への変形（GLSL）
export const SPINE_GLSL = (J) => /* glsl */ `
  uniform sampler2D tSpine;
  attribute float aS;
  attribute float aPart;
  attribute vec4 aInst;     // 行, 長さ(m), 乱数, 見えるか
  varying float vS;
  varying float vPart;
  varying vec3 vLoc;
  varying float vSeed;
  vec3 spP(float row, int j) { return texelFetch(tSpine, ivec2(clamp(j, 0, ${J - 1}), int(row)), 0).xyz; }
  vec3 spU(float row, int j) { return texelFetch(tSpine, ivec2(clamp(j, 0, ${J - 1}) + ${J}, int(row)), 0).xyz; }
  void spineFrame(float s, float row, out vec3 P, out vec3 F, out vec3 Up) {
    float f = clamp(s, 0.0, 1.0) * ${(J - 1).toFixed(1)};
    int j = int(min(floor(f), ${(J - 2).toFixed(1)}));
    float t = f - float(j);
    vec3 p0 = spP(row, j - 1), p1 = spP(row, j), p2 = spP(row, j + 1), p3 = spP(row, j + 2);
    if (j == 0) p0 = p1 + (p1 - p2);
    if (j >= ${J - 2}) p3 = p2 + (p2 - p1);
    float t2 = t * t, t3 = t2 * t;
    P = 0.5 * ((2.0 * p1) + (-p0 + p2) * t + (2.0 * p0 - 5.0 * p1 + 4.0 * p2 - p3) * t2 + (-p0 + 3.0 * p1 - 3.0 * p2 + p3) * t3);
    vec3 d = 0.5 * ((-p0 + p2) + 2.0 * (2.0 * p0 - 5.0 * p1 + 4.0 * p2 - p3) * t + 3.0 * (-p0 + 3.0 * p1 - 3.0 * p2 + p3) * t2);
    F = -normalize(d + vec3(1e-6));
    vec3 u = normalize(mix(spU(row, j), spU(row, j + 1), t));
    Up = normalize(u - F * dot(u, F));
  }
`;
export const DEFORM = /* glsl */ `
  vec3 spPos, spF, spUp;
  spineFrame(aS, aInst.x, spPos, spF, spUp);
  vec3 spR = normalize(cross(spF, spUp));
  float spL = aInst.y;
  vS = aS; vPart = aPart; vLoc = position; vSeed = aInst.z;
`;

/**
 * 背骨の体の種類
 * opts: { J: 関節の数, max: 最大の数, geo: 形（buildBody の結果）, paint: 色の GLSL, mat: マテリアルの設定, flutter: 胸びれを動かすか }
 */
export class SpineSet {
  constructor(scene, { J, max, geo, paint, mat = {}, key, makeMaterial = null }) {
    this.J = J; this.max = max;
    this.data = new Float32Array(J * 2 * max * 4);
    this.tex = new THREE.DataTexture(this.data, J * 2, max, THREE.RGBAFormat, THREE.FloatType);
    this.tex.needsUpdate = true;
    this.inst = new Float32Array(max * 4);
    const g = geo.clone();
    g.setAttribute('aInst', new THREE.InstancedBufferAttribute(this.inst, 4).setUsage(THREE.DynamicDrawUsage));
    const uniforms = { tSpine: { value: this.tex } };
    const vtx = /* glsl */ `
      // 胸びれのゆらぎ
      vec3 lp = position;
      if (aPart > 3.5 && aPart < 4.5) lp.y += sin(uTime * 7.0 + aInst.z * 20.0) * 0.1 * abs(lp.x);
      transformed = spPos + (spR * lp.x + spUp * lp.y + spF * lp.z) * spL;
      if (aInst.w < 0.5) transformed = vec3(0.0, -50.0, 0.0);
    `;
    // 法線の計算（begin_vertex より前）で背骨の向きを求めておき、位置でも使う
    const nrm = /* glsl */ `
      ${DEFORM}
      vec3 objectNormal = normalize(spR * normal.x + spUp * normal.y + spF * normal.z);
      #ifdef USE_TANGENT
        vec3 objectTangent = vec3( tangent.xyz );
      #endif
    `;
    const m = makeMaterial ? makeMaterial({ uniforms, vdecl: SPINE_GLSL(J), vnormal: nrm }) : patchMaterial(new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.35, side: THREE.DoubleSide, ...mat }), {
      uniforms,
      fx: {
        key: 'spine-' + key,
        vdecl: SPINE_GLSL(J),
        vnormal: nrm,
        vcode: vtx,
        decl: 'varying float vS; varying float vPart; varying vec3 vLoc; varying float vSeed; float spRough; float spMetal;',
        color: `spRough = -1.0; spMetal = -1.0;
${paint}
        // ひれの膜: すじ（鰭条）の間は薄く透ける（点描で抜く）
        if ((vPart > 0.5 && vPart < 1.5) || vPart > 4.5) {
          float ray = smoothstep(0.35, 0.0, abs(fract(vS * (vPart > 4.5 ? 70.0 : 55.0)) - 0.5) * 2.0 - 0.6);
          float edge = smoothstep(0.0, 0.01, abs(vLoc.y));
          if (ray < 0.5 && un_h21(floor(gl_FragCoord.xy)) > 0.55 + 0.25 * (1.0 - edge)) discard;
        }`,
        rough: 'if (spRough >= 0.0) roughnessFactor = spRough; if (spMetal >= 0.0) metalnessFactor = spMetal;',
      },
    });
    this.material = m;
    this.mesh = new THREE.InstancedMesh(g, m, max);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    const id = new THREE.Matrix4();
    for (let i = 0; i < max; i++) this.mesh.setMatrixAt(i, id);
    // 影にも同じ変形
    const dm = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
    dm.onBeforeCompile = (sh) => {
      sh.uniforms.tSpine = uniforms.tSpine;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', `#include <common>\n${SPINE_GLSL(J)}`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>\n${DEFORM}\ntransformed = spPos + (spR * position.x + spUp * position.y + spF * position.z) * spL;\nif (aInst.w < 0.5) transformed = vec3(0.0, -50.0, 0.0);`);
    };
    dm.customProgramCacheKey = () => 'spineDepth' + J;
    this.mesh.customDepthMaterial = dm;
    scene.add(this.mesh);
    this.used = 0;
    for (let i = 0; i < max; i++) this.inst[i * 4] = i;
  }
  /** 行を 1 つ借りる */
  alloc(len, seed) {
    const i = this.used++;
    this.inst[i * 4 + 1] = len;
    this.inst[i * 4 + 2] = seed;
    this.inst[i * 4 + 3] = 1;
    this.mesh.count = this.used;
    this.mesh.geometry.attributes.aInst.needsUpdate = true;
    return i;
  }
  reset() { this.used = 0; this.mesh.count = 0; }
  setVisible(i, v) { this.inst[i * 4 + 3] = v ? 1 : 0; this.mesh.geometry.attributes.aInst.needsUpdate = true; }
  setLen(i, len) { this.inst[i * 4 + 1] = len; this.mesh.geometry.attributes.aInst.needsUpdate = true; }
  /** 関節（pts: Vector3[J]、ups: Vector3[J]）を書く */
  write(i, pts, ups) {
    const J = this.J, d = this.data;
    const row = i * J * 2 * 4;
    for (let j = 0; j < J; j++) {
      const p = pts[j], u = ups[j];
      d[row + j * 4] = p.x; d[row + j * 4 + 1] = p.y; d[row + j * 4 + 2] = p.z;
      d[row + (J + j) * 4] = u.x; d[row + (J + j) * 4 + 1] = u.y; d[row + (J + j) * 4 + 2] = u.z;
    }
    this.dirty = true;
  }
  commit() { if (this.dirty) { this.tex.needsUpdate = true; this.dirty = false; } }
}

/** CPU で背骨の上の点（体の座標 x, y, z）を世界へ（目の位置などに使う） */
export function spinePoint(pts, ups, len, s, lx, ly, lz, out = V3()) {
  const J = pts.length;
  const f = Math.min(Math.max(s, 0), 1) * (J - 1);
  const j = Math.min(Math.floor(f), J - 2), t = f - j;
  const P = pts[j].clone().lerp(pts[j + 1], t);
  const F = pts[j].clone().sub(pts[j + 1]).normalize();
  const U = ups[j].clone().lerp(ups[j + 1], t);
  U.addScaledVector(F, -U.dot(F)).normalize();
  const R = new THREE.Vector3().crossVectors(F, U).normalize();
  return out.copy(P).addScaledVector(R, lx * len).addScaledVector(U, ly * len).addScaledVector(F, lz * len);
}
