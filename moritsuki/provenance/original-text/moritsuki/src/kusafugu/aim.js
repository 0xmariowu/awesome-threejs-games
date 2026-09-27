// 砂の上に見せるもの
// ・ねらいの輪: クリックで手を突っ込む所（光っている物の上では、輪が少し色づく。眼でも石でも同じ）
// ・手を突っ込んだ跡: 小さなくぼみ（しばらくで消える）
// どれも水の下の砂に置くので、水面の処理で屈折して見える
// （ガザミ拾いの sense.js から、輪と跡だけを写したもの）
import * as THREE from 'three';
import { U, COMMON_GLSL } from './shade.js';

export class Aim {
  constructor(scene) {
    this.scene = scene;
    this.buildReticle();
    this.buildHoles();
  }
  update(dt, groundAt) {
    this.updateReticle(dt, groundAt);
  }

  // ───── ねらいの輪 ─────
  buildReticle() {
    const mat = new THREE.ShaderMaterial({
      uniforms: { ...U, uHot: { value: 0 }, uK: { value: 1 }, uFar: { value: 0 } },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        ${COMMON_GLSL}
        uniform float uHot; uniform float uK; uniform float uFar;
        varying vec2 vUv;
        void main() {
          vec2 p = (vUv - 0.5) * 2.0;
          float r = length(p);
          float a = atan(p.y, p.x);
          float ring = exp(-pow((r - 0.62) / 0.05, 2.0));
          // 4 つの切れ目
          ring *= smoothstep(0.1, 0.3, abs(sin(a * 2.0 + uTime * 0.8 * uHot)));
          // まん中には何も描かない（小さな赤い光を隠さないように）
          vec3 cold = vec3(0.6, 0.72, 0.85);
          vec3 hot = vec3(0.95, 0.97, 1.0);
          vec3 col = mix(cold, hot, uHot) * ring * (0.32 + uHot * 0.35) * (1.0 - uFar * 0.65);
          gl_FragColor = vec4(col * uK, 1.0);
        }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.reticle = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.15).rotateX(-Math.PI / 2), mat);
    this.reticle.visible = false;
    this.reticle.renderOrder = 5;
    this.reticle.frustumCulled = false;
    this.scene.add(this.reticle);
    this.ret = { x: 0, z: 0, on: 0, hot: 0, want: false, wantHot: 0 };
  }
  setReticle(on, x = 0, z = 0, hot = 0, far = 0) { const r = this.ret; r.want = on; if (on) { r.x = x; r.z = z; } r.wantHot = hot; r.far = far; }
  updateReticle(dt, groundAt) {
    const r = this.ret, m = this.reticle;
    r.on += ((r.want ? 1 : 0) - r.on) * (1 - Math.exp(-10 * dt));
    r.hot += (r.wantHot - r.hot) * (1 - Math.exp(-12 * dt));
    m.visible = r.on > 0.02;
    if (!m.visible) return;
    m.position.set(r.x, groundAt(r.x, r.z) + 0.006, r.z);
    const s = 1 + r.hot * 0.35;
    m.scale.set(s, 1, s);
    m.material.uniforms.uHot.value = r.hot;
    m.material.uniforms.uFar.value = r.far || 0;
    m.material.uniforms.uK.value = r.on;
  }

  // ───── 手を突っ込んだ跡 ─────
  buildHoles() {
    const MAX = 40;
    const geo = new THREE.PlaneGeometry(0.16, 0.16).rotateX(-Math.PI / 2);
    this.holeInfo = new Float32Array(MAX * 2);
    geo.setAttribute('aInfo', new THREE.InstancedBufferAttribute(this.holeInfo, 2));
    const mat = new THREE.ShaderMaterial({
      uniforms: { ...U },
      vertexShader: `attribute vec2 aInfo; varying vec2 vUv; varying vec2 vInfo; void main(){ vUv = uv; vInfo = aInfo; gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        ${COMMON_GLSL}
        varying vec2 vUv; varying vec2 vInfo;
        void main() {
          float age = uTime - vInfo.x;
          float fade = 1.0 - smoothstep(12.0, 30.0, age);
          vec2 p = (vUv - 0.5) * 2.0;
          p.x *= 1.0 + 0.15 * sin(vInfo.y * 9.0);
          float r = length(p) * (1.0 + 0.12 * hm_vn(p * 3.0 + vInfo.y * 7.0));
          float dark = smoothstep(0.62, 0.15, r);
          float rim = exp(-pow((r - 0.75) / 0.12, 2.0));
          float a = (dark * 0.55 + rim * 0.2) * fade;
          if (a < 0.01) discard;
          vec3 col = mix(vec3(0.62, 0.57, 0.46), vec3(0.12, 0.1, 0.08), dark / max(dark + rim, 1e-3));
          gl_FragColor = vec4(col * 0.35, a);
        }`,
      transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    });
    this.holes = new THREE.InstancedMesh(geo, mat, MAX);
    this.holes.count = 0;
    this.holes.frustumCulled = false;
    this.holes.renderOrder = 2;
    this.scene.add(this.holes);
    this.holeI = 0;
    this.holeMax = MAX;
  }
  hole(x, y, z) {
    const k = this.holeI++ % this.holeMax;
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y + 0.002, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.random() * 6.28), new THREE.Vector3(1, 1, 1).multiplyScalar(0.8 + Math.random() * 0.4));
    this.holes.setMatrixAt(k, m);
    this.holeInfo.set([U.uTime.value, Math.random()], k * 2);
    this.holes.count = Math.min(this.holeI, this.holeMax);
    this.holes.instanceMatrix.needsUpdate = true;
    this.holes.geometry.attributes.aInfo.needsUpdate = true;
  }
  clearHoles() { this.holeI = 0; this.holes.count = 0; }
  updateHoles() {}
}
