// 粒の効果: 水の中の泥煙・泡（水面の処理の前に描く）と、水の上のしぶき・しずく（あとから重ねる）
// 夜なので、ヘッドライトの光の中の粒だけが明るく光る
import * as THREE from 'three';
import { U, COMMON_GLSL } from './shade.js';
import { SCREEN, SCREEN_GLSL } from './water.js';

const VS = /* glsl */ `
  attribute vec4 aData;   // 大きさ, 残り時間の割合, 種類, 乱数
  varying vec4 vData;
  varying vec3 vW;
  uniform float uPR;
  void main() {
    vData = aData;
    vW = position;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aData.x * uPR * 900.0 / max(-mv.z, 0.05);
  }
`;
const FS = (overlay) => /* glsl */ `
  ${COMMON_GLSL}
  ${overlay ? SCREEN_GLSL : ''}
  varying vec4 vData;
  varying vec3 vW;
  void main() {
    vec2 p = gl_PointCoord - 0.5;
    float d = length(p);
    if (d > 0.5) discard;
    ${overlay ? `
    vec2 suv = gl_FragCoord.xy / uRes;
    float zs = texture2D(tDepth, suv).x;
    if (gl_FragCoord.z > zs + 1e-5) discard;` : ''}
    float life = vData.y;
    float kind = vData.z;
    vec3 L = vW - uLampPos;
    float dl = length(L);
    float lamp = lampCone(vW) * uLampI / (dl * dl + 0.2);
    vec4 c;
    if (kind < 0.5) {
      // 泥煙: ライトの中で茶色く浮かぶもや
      float a = (1.0 - smoothstep(0.1, 0.5, d)) * 0.28 * smoothstep(0.0, 0.25, life) * smoothstep(1.0, 0.8, life);
      c = vec4(vec3(0.5, 0.42, 0.28) * (0.004 + lamp * 0.012), a);
    } else if (kind < 1.5) {
      // 泡: ふちが光る輪
      float ring = smoothstep(0.32, 0.45, d) * (1.0 - smoothstep(0.45, 0.5, d));
      float hi = 1.0 - smoothstep(0.0, 0.12, length(p - vec2(-0.14, -0.14)));
      c = vec4(vec3(0.9, 0.97, 1.0) * (0.01 + lamp * 0.04), (ring * 0.7 + hi * 0.8) * smoothstep(0.0, 0.2, life));
    } else {
      // しずく・しぶき: ライトを受けて光る水の玉
      float body = 1.0 - smoothstep(0.3, 0.5, d);
      float hi = 1.0 - smoothstep(0.0, 0.15, length(p - vec2(-0.12, -0.15)));
      vec3 col = mix(vec3(0.72, 0.8, 0.82), vec3(1.0), hi);
      c = vec4(col * (0.02 + lamp * 0.06 + uDawn * 0.3), body * (0.45 + hi * 0.5) * smoothstep(0.0, 0.15, life));
    }
    gl_FragColor = c;
  }
`;

class Particles {
  constructor(scene, max, { overlay = false } = {}) {
    this.max = max;
    this.pos = new Float32Array(max * 3);
    this.data = new Float32Array(max * 4);
    this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.grow = new Float32Array(max);
    this.i = 0;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('aData', new THREE.BufferAttribute(this.data, 4));
    this.uniforms = { ...U, ...(overlay ? SCREEN : {}), uPR: { value: 1 } };
    const mat = new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: VS, fragmentShader: FS(overlay), transparent: true, depthWrite: false, depthTest: !overlay });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 3;
    scene.add(this.points);
  }
  emit(x, y, z, vx, vy, vz, size, life, kind, grow = 0) {
    const k = this.i++ % this.max;
    this.pos.set([x, y, z], k * 3);
    this.vel.set([vx, vy, vz], k * 3);
    this.data.set([size, 1, kind, Math.random()], k * 4);
    this.life[k] = life; this.maxLife[k] = life; this.grow[k] = grow;
  }
  update(dt, { waterY, flow = 0 } = {}) {
    const P = this.pos, V = this.vel, D = this.data;
    for (let k = 0; k < this.max; k++) {
      if (this.life[k] <= 0) { D[k * 4] = 0; continue; }
      this.life[k] -= dt;
      const kind = D[k * 4 + 2];
      if (kind < 0.5) { V[k * 3] *= 1 - dt * 1.4; V[k * 3 + 1] *= 1 - dt * 2.2; V[k * 3 + 2] *= 1 - dt * 1.4; V[k * 3 + 1] -= dt * 0.012; P[k * 3 + 2] += flow * dt; }
      else if (kind < 1.5) {
        V[k * 3 + 1] += dt * 0.9;
        V[k * 3] *= 1 - dt * 2; V[k * 3 + 2] *= 1 - dt * 2;
        P[k * 3 + 2] += flow * dt;
        if (waterY && P[k * 3 + 1] > waterY(P[k * 3], P[k * 3 + 2]) - 0.005) this.life[k] = 0;
      } else V[k * 3 + 1] -= dt * 9.8;
      P[k * 3] += V[k * 3] * dt; P[k * 3 + 1] += V[k * 3 + 1] * dt; P[k * 3 + 2] += V[k * 3 + 2] * dt;
      if (kind > 1.5 && waterY && P[k * 3 + 1] < waterY(P[k * 3], P[k * 3 + 2]) && Math.abs(P[k * 3]) < 0.6) { this.life[k] = 0; this.onLand?.(P[k * 3], P[k * 3 + 2]); }
      D[k * 4] += this.grow[k] * dt;
      D[k * 4 + 1] = Math.max(0, this.life[k] / this.maxLife[k]);
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.aData.needsUpdate = true;
  }
}

export class FX {
  constructor(scene, overlay) {
    this.under = new Particles(scene, 900);
    this.air = new Particles(overlay, 500, { overlay: true });
  }
  setPR(pr) { this.under.uniforms.uPR.value = pr; this.air.uniforms.uPR.value = pr; }
  /** 泥煙（足もと・生き物が逃げた所） */
  silt(x, y, z, n = 8, spread = 0.1, strength = 1) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, r = Math.random() * spread;
      this.under.emit(x + Math.cos(a) * r, y + Math.random() * 0.02, z + Math.sin(a) * r,
        Math.cos(a) * 0.1 * strength * Math.random(), (0.04 + Math.random() * 0.1) * strength, Math.sin(a) * 0.1 * strength * Math.random(),
        0.04 + Math.random() * 0.06, 2 + Math.random() * 2.5, 0, 0.05 + Math.random() * 0.06);
    }
  }
  bubbles(x, y, z, n = 5, spread = 0.05) {
    for (let i = 0; i < n; i++) {
      this.under.emit(x + (Math.random() - 0.5) * spread, y, z + (Math.random() - 0.5) * spread,
        (Math.random() - 0.5) * 0.05, 0.1 + Math.random() * 0.2, (Math.random() - 0.5) * 0.05, 0.004 + Math.random() * 0.006, 2.5, 1);
    }
  }
  /** しぶき（水面から上へ） */
  splash(x, y, z, n = 16, up = 1.2) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = Math.random() * 0.6;
      this.air.emit(x, y, z, Math.cos(a) * s, up * (0.4 + Math.random() * 0.8), Math.sin(a) * s, 0.005 + Math.random() * 0.009, 1.2, 2);
    }
  }
  /** しずく（網・手から落ちる） */
  drip(x, y, z) {
    this.air.emit(x + (Math.random() - 0.5) * 0.02, y, z + (Math.random() - 0.5) * 0.02, 0, -0.1, 0, 0.004 + Math.random() * 0.004, 2, 2);
  }
  update(dt, waterY, flow) {
    this.under.update(dt, { waterY, flow });
    this.air.update(dt, { waterY });
  }
}
