// 粒の効果: 水の中の砂煙・泡・夜光虫の青い光（水面の処理の前に描く）と、水の上のしぶき・しずく（あとから重ねる）
import * as THREE from 'three';
import { U, COMMON_GLSL } from './shade.js';

const VS = /* glsl */ `
  attribute vec4 aData;   // 大きさ, 残り時間の割合, 種類, 乱数
  varying vec4 vData;
  varying float vLight;
  uniform float uPR;
  uniform vec3 uHeadPos; uniform vec3 uHeadDir; uniform float uHeadI; uniform vec2 uHeadCone;
  void main() {
    vData = aData;
    {
      vec3 v = position - uHeadPos;
      float d2 = max(dot(v, v), 0.01);
      vLight = uHeadI * smoothstep(uHeadCone.x, uHeadCone.y, dot(v * inversesqrt(d2), uHeadDir)) / pow(d2, 0.7) * 0.35;
    }
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aData.x * uPR * 900.0 / max(-mv.z, 0.05);
  }
`;
const FS = /* glsl */ `
  ${COMMON_GLSL}
  varying vec4 vData;
  varying float vLight;
  void main() {
    vec2 p = gl_PointCoord - 0.5;
    float d = length(p);
    if (d > 0.5) discard;
    float life = vData.y;
    float kind = vData.z;
    vec4 c;
    if (kind < 0.5) {
      // 砂煙: やわらかい茶色のもや（夜はヘッドライトに照らされた所だけ見える）
      float a = (1.0 - smoothstep(0.1, 0.5, d)) * 0.16 * smoothstep(0.0, 0.25, life) * smoothstep(1.0, 0.8, life);
      c = vec4(vec3(0.62, 0.55, 0.42) * (0.02 + min(vLight, 0.45)), a);
    } else if (kind < 1.5) {
      // 泡: ふちが明るい輪
      float ring = smoothstep(0.32, 0.45, d) * (1.0 - smoothstep(0.45, 0.5, d));
      float hi = 1.0 - smoothstep(0.0, 0.12, length(p - vec2(-0.14, -0.14)));
      c = vec4(vec3(0.9, 0.97, 1.0) * (0.04 + vLight * 1.5), (ring * 0.7 + hi * 0.8) * smoothstep(0.0, 0.2, life));
    } else if (kind < 2.5) {
      // しずく・しぶき: ヘッドライトに光る水の玉
      float body = 1.0 - smoothstep(0.3, 0.5, d);
      float hi = 1.0 - smoothstep(0.0, 0.15, length(p - vec2(-0.12, -0.15)));
      vec3 col = mix(vec3(0.72, 0.85, 0.88), vec3(1.0), hi);
      c = vec4(col * (0.04 + vLight * 1.2), body * (0.45 + hi * 0.5) * smoothstep(0.0, 0.15, life));
    } else {
      // 夜光虫: 水をかき回すと青く光る（加算）
      float k = exp(-d * d * 30.0) + exp(-d * d * 6.0) * 0.25;
      float fl = 0.6 + 0.4 * sin(uTime * 23.0 + vData.w * 40.0);
      float env = smoothstep(0.0, 0.35, life) * smoothstep(1.0, 0.85, life);
      c = vec4(vec3(0.25, 0.75, 1.0) * k * fl * env * 2.2, 1.0);
    }
    gl_FragColor = c;
  }
`;

class Particles {
  constructor(scene, max, { overlay = false, additive = false } = {}) {
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
    this.uniforms = { ...U, uPR: { value: 1 } };
    const mat = new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: VS, fragmentShader: FS, transparent: true, depthWrite: false, depthTest: !overlay, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending });
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
  update(dt, { waterY, gravity = 0 } = {}) {
    const P = this.pos, V = this.vel, D = this.data;
    for (let k = 0; k < this.max; k++) {
      if (this.life[k] <= 0) { D[k * 4] = 0; continue; }
      this.life[k] -= dt;
      const kind = D[k * 4 + 2];
      if (kind < 0.5) { V[k * 3] *= 1 - dt * 1.4; V[k * 3 + 1] *= 1 - dt * 2.2; V[k * 3 + 2] *= 1 - dt * 1.4; V[k * 3 + 1] -= dt * 0.015; }
      else if (kind < 1.5) {
        V[k * 3 + 1] += dt * 0.9;
        V[k * 3] *= 1 - dt * 2; V[k * 3 + 2] *= 1 - dt * 2;
        if (waterY && P[k * 3 + 1] > waterY(P[k * 3], P[k * 3 + 2]) - 0.005) this.life[k] = 0;
      } else if (kind < 2.5) V[k * 3 + 1] -= dt * 9.8;
      else { V[k * 3] *= 1 - dt * 3; V[k * 3 + 1] *= 1 - dt * 3; V[k * 3 + 2] *= 1 - dt * 3; }
      P[k * 3] += V[k * 3] * dt; P[k * 3 + 1] += V[k * 3 + 1] * dt; P[k * 3 + 2] += V[k * 3 + 2] * dt;
      if (kind > 1.5 && kind < 2.5 && waterY && P[k * 3 + 1] < waterY(P[k * 3], P[k * 3 + 2])) { this.life[k] = 0; this.onLand?.(P[k * 3], P[k * 3 + 2]); }
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
    this.glowP = new Particles(scene, 700, { additive: true });
    this.air = new Particles(overlay, 400, { overlay: true });
  }
  setPR(pr) { for (const p of [this.under, this.glowP, this.air]) p.uniforms.uPR.value = pr; }
  /** 夜光虫の光（水の中をかき回した所）。k = 強さ */
  glow(x, y, z, n = 6, spread = 0.08, k = 1) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, r = Math.random() * spread;
      this.glowP.emit(x + Math.cos(a) * r, y + Math.random() * 0.03, z + Math.sin(a) * r,
        (Math.random() - 0.5) * 0.12, (Math.random() - 0.3) * 0.08, (Math.random() - 0.5) * 0.12,
        (0.0035 + Math.random() * 0.004) * k, 0.5 + Math.random() * 0.9, 3);
    }
  }
  /** 砂煙（突いた所・掘った所） */
  sandPuff(x, y, z, n = 10, spread = 0.12, strength = 1) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, r = Math.random() * spread;
      this.under.emit(x + Math.cos(a) * r, y + Math.random() * 0.02, z + Math.sin(a) * r,
        Math.cos(a) * 0.12 * strength * Math.random(), (0.05 + Math.random() * 0.12) * strength, Math.sin(a) * 0.12 * strength * Math.random(),
        0.035 + Math.random() * 0.05, 1.4 + Math.random() * 1.6, 0, 0.04 + Math.random() * 0.05);
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
      this.air.emit(x, y, z, Math.cos(a) * s, up * (0.4 + Math.random() * 0.8), Math.sin(a) * s, 0.006 + Math.random() * 0.01, 1.2, 2);
    }
  }
  /** しずく（手・貝から落ちる） */
  drip(x, y, z) {
    this.air.emit(x + (Math.random() - 0.5) * 0.02, y, z + (Math.random() - 0.5) * 0.02, 0, -0.1, 0, 0.005 + Math.random() * 0.004, 2, 2);
  }
  update(dt, waterY) {
    this.under.update(dt, { waterY });
    this.glowP.update(dt, {});
    this.air.update(dt, { waterY });
  }
}
