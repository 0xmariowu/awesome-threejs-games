// 砂の上の跡
// ・突いた跡: 爪 25 本の小さな穴（波で少しずつ消える）
// ・水管の穴: 生きた二枚貝の上に並ぶ 2 つの小さな穴（水が澄んだ一瞬に見える手がかり）
// ・掘った穴: 地面をくりぬいて、すり鉢の穴と、まわりに盛った砂（波で埋まっていく）
import * as THREE from 'three';
import { U, COMMON_GLSL } from './shade.js';
import { sandMaterial, groundColor } from './beach.js';
import { GRID } from './rod.js';

const MAX_STAB = 600, MAX_SIPHON = 500;

const DECAL_VS = /* glsl */ `
  attribute vec4 aInfo; // 種類, 生まれた時刻, 大きさ, 乱数
  varying vec4 vInfo;
  varying vec2 vUv2;
  varying vec3 vWP;
  void main() {
    vInfo = aInfo;
    vUv2 = uv - 0.5;
    vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
    vWP = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;
const DECAL_FS = /* glsl */ `
  ${COMMON_GLSL}
  varying vec4 vInfo;
  varying vec2 vUv2;
  varying vec3 vWP;
  uniform float uLife;
  void main() {
    float age = uTime - vInfo.y;
    float fade = 1.0 - smoothstep(uLife * 0.35, uLife, age + vInfo.w * uLife * 0.3);
    if (fade <= 0.0) discard;
    float dark = 0.0, rim = 0.0;
    if (vInfo.x < 0.5) {
      // 突いた跡: 格子の 25 個の穴（4cm 間隔）。四角い範囲 0.2m を uv で
      vec2 p = vUv2 * 0.2 / ${GRID.toFixed(3)};
      vec2 id = floor(p + 0.5);
      if (abs(id.x) > 2.0 || abs(id.y) > 2.0) discard;
      vec2 f = p - id;
      float d = length(f) * ${GRID.toFixed(3)};
      float r = 0.0028 * (0.85 + 0.3 * hm_h21(id + vInfo.w * 31.0));
      dark = 1.0 - smoothstep(r * 0.5, r, d);
      rim = smoothstep(r * 0.9, r * 1.3, d) * (1.0 - smoothstep(r * 1.4, r * 2.4, d));
      dark *= 0.85;
    } else {
      // 水管の穴: 2 つ並んだ小さな穴と、まわりのうすい盛り上がり
      // 入水管と出水管: 少しちがう大きさの 2 つの穴と、まわりのくぼみ
      float s = vInfo.z;
      vec2 p = vUv2 * 0.1 / 1.8;
      float d1 = length((p - vec2(0.0062 * s, 0.0)) * vec2(1.0, 1.25));
      float d2 = length((p + vec2(0.0058 * s, 0.0)) * vec2(1.0, 1.25));
      float r1 = 0.0036 * s, r2 = 0.003 * s;
      dark = max(1.0 - smoothstep(r1 * 0.35, r1, d1), 1.0 - smoothstep(r2 * 0.35, r2, d2));
      float dip = 1.0 - smoothstep(0.004 * s, 0.014 * s, length(p * vec2(0.8, 1.3)));
      rim = max((1.0 - smoothstep(r1, r1 * 2.2, min(d1, d2))) * 0.8, dip * 0.5);
      dark = max(dark * 0.95, dip * 0.22);
    }
    float a = max(dark * 0.8, rim * 0.12) * fade;
    if (a < 0.01) discard;
    vec3 col = mix(vec3(0.8, 0.74, 0.6), vec3(0.2, 0.17, 0.12), dark / max(dark + rim * 0.12, 1e-3));
    // 日なたの明るさに合わせる（水の下の吸収は水面の処理で）
    col *= 0.55 + 0.45 * max(uSunDir.y, 0.0);
    gl_FragColor = vec4(col, a);
  }
`;

class DecalSet {
  constructor(scene, max, life, size) {
    this.max = max;
    const geo = new THREE.PlaneGeometry(size, size).rotateX(-Math.PI / 2);
    this.info = new Float32Array(max * 4);
    geo.setAttribute('aInfo', new THREE.InstancedBufferAttribute(this.info, 4));
    const mat = new THREE.ShaderMaterial({
      uniforms: { ...U, uLife: { value: life } }, vertexShader: DECAL_VS, fragmentShader: DECAL_FS,
      transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    });
    this.mesh = new THREE.InstancedMesh(geo, mat, max);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 2;
    scene.add(this.mesh);
    this.i = 0;
    this.m = new THREE.Matrix4();
    this.q = new THREE.Quaternion();
  }
  put(x, y, z, yaw, info, normal) {
    const k = this.i % this.max;
    this.i++;
    this.q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    if (normal) this.q.premultiply(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal));
    this.m.compose(new THREE.Vector3(x, y, z), this.q, new THREE.Vector3(1, 1, 1));
    this.mesh.setMatrixAt(k, this.m);
    this.info.set(info, k * 4);
    this.mesh.count = Math.min(this.i, this.max);
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.geometry.attributes.aInfo.needsUpdate = true;
  }
  clear() { this.i = 0; this.mesh.count = 0; }
}

export const MAX_HOLES = 6;
const _gc = new THREE.Color();

export class Marks {
  constructor(scene, beach) {
    this.scene = scene;
    this.beach = beach;
    this.stabs = new DecalSet(scene, MAX_STAB, 70, 0.22);
    this.sip = new DecalSet(scene, MAX_SIPHON, 1e9, 0.1);
    this.sip.mesh.material.uniforms.uLife.value = 1e9;
    this.sipCenter = null;
    this.holes = [];
    // 地面の材質に「掘った穴の所は描かない」を渡す
    this.holeU = beach.material.userData.holes;
    this.holeMat = sandMaterial({ vcol: true });
  }

  stab(x, z, yaw, t) {
    const y = this.beach.heightAt(x, z) + 0.002;
    this.stabs.put(x, y, z, yaw, [0, t, 1, Math.random()], this.beach.normalAt(x, z));
  }

  /** 主人公のまわりの水管の穴を並べ直す（3m 動くごと） */
  updateSiphons(field, x, z) {
    if (this.sipCenter && Math.hypot(x - this.sipCenter[0], z - this.sipCenter[1]) < 3) return;
    this.sipCenter = [x, z];
    this.sip.clear();
    for (const [sx, sz, yaw, s] of field.siphons(x, z, 11)) {
      const y = this.beach.heightAt(sx, sz) + 0.002;
      this.sip.put(sx, y, sz, yaw, [1, -1e6, s, 0], null);
    }
  }
  refreshSiphons() { this.sipCenter = null; }

  // ───── 掘った穴 ─────
  /** 穴を開ける（半径 R の範囲の地面を作り直す）。{ x, z, depth, r, R, mesh } */
  openHole(x, z, R = 0.3) {
    if (this.holes.length >= MAX_HOLES) this.removeHole(this.holes[0]);
    // 同心円の格子（中心に細かく）
    const NR = 26, NA = 72;
    const pos = [], col = [], idx = [], base = [];
    pos.push(0, 0, 0); col.push(1, 1, 1); base.push(0, 0);
    for (let i = 1; i <= NR; i++) {
      const r = R * Math.pow(i / NR, 1.35);
      for (let j = 0; j < NA; j++) {
        const a = (j / NA) * Math.PI * 2;
        pos.push(Math.cos(a) * r, 0, Math.sin(a) * r); col.push(1, 1, 1); base.push(Math.cos(a) * r, Math.sin(a) * r);
      }
    }
    for (let j = 0; j < NA; j++) idx.push(0, 1 + ((j + 1) % NA), 1 + j);
    for (let i = 1; i < NR; i++) for (let j = 0; j < NA; j++) {
      const a = 1 + (i - 1) * NA + j, b = 1 + (i - 1) * NA + ((j + 1) % NA), c = a + NA, d = b + NA;
      idx.push(a, b, c, b, d, c);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.setIndex(idx);
    geo.userData.base = base;
    const mesh = new THREE.Mesh(geo, this.holeMat);
    mesh.receiveShadow = true;
    mesh.position.set(x, 0, z);
    this.scene.add(mesh);
    const h = { x, z, R, depth: 0, rin: 0.05, pile: 0, mesh, t: 0 };
    this.holes.push(h);
    this.shapeHole(h);
    this.syncHoles();
    return h;
  }
  shapeHole(h) {
    const geo = h.mesh.geometry;
    const p = geo.attributes.position, c = geo.attributes.color, base = geo.userData.base;
    for (let i = 0; i < p.count; i++) {
      const lx = base[i * 2], lz = base[i * 2 + 1];
      const r = Math.hypot(lx, lz);
      const g = this.beach.heightAt(h.x + lx, h.z + lz);
      let y = g, dk = 1;
      if (r < h.rin) {
        const k = Math.pow(1 - (r / h.rin) ** 2, 0.7);
        y -= h.depth * k;
        // 穴の底ほど暗く、濡れて締まった色
        dk = 1 - Math.min(0.45, h.depth * k * 6);
      }
      // まわりに盛った砂（少し明るい）
      const t = (r - h.rin) / Math.max(h.R - h.rin, 0.01);
      if (t > 0 && t < 1) { const m = Math.sin(Math.PI * t) * (1 - t * 0.4); y += h.pile * m; dk = 1 + m * Math.min(0.12, h.pile * 5); }
      p.setXYZ(i, lx, y, lz);
      // まわりの地面と同じ色（河口の黒い砂の所では黒く）に、穴の底の暗さをかける
      const gc = groundColor(h.x + lx, h.z + lz, g, _gc);
      c.setXYZ(i, gc.r * dk, gc.g * dk * 0.98, gc.b * dk * 0.95);
    }
    p.needsUpdate = true;
    c.needsUpdate = true;
    geo.computeVertexNormals();
  }
  syncHoles() {
    const arr = this.holeU.value;
    for (let i = 0; i < MAX_HOLES; i++) {
      const h = this.holes[i];
      if (h) arr[i].set(h.x, h.z, h.R * 0.94, 1); else arr[i].set(0, 0, 0, 0);
    }
  }
  removeHole(h) {
    this.scene.remove(h.mesh);
    h.mesh.geometry.dispose();
    this.holes = this.holes.filter((x) => x !== h);
    this.syncHoles();
  }
  /** 波で穴が埋まっていく（掘っている穴は keep） */
  update(dt, keep) {
    for (const h of [...this.holes]) {
      if (h === keep) continue;
      h.t += dt;
      h.depth = Math.max(0, h.depth - dt * 0.004);
      h.pile = Math.max(0, h.pile - dt * 0.0012);
      h.re = (h.re || 0) + dt;
      if (h.t > 3 && h.re > 0.4) { h.re = 0; this.shapeHole(h); }
      if (h.depth <= 0.002 && h.pile <= 0.001) this.removeHole(h);
    }
  }
}
