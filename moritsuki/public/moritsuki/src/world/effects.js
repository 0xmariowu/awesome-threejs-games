// 光の筋・マリンスノー・泡などのパーティクル
import * as THREE from 'three';
import { U, COMMON_GLSL } from '../core/shaderPatch.js';

// ───────── 光の筋 (ゴッドレイ) ─────────
export class GodRays {
  constructor(count = 34) {
    this.count = count;
    const geo = new THREE.PlaneGeometry(1, 1, 1, 8);
    geo.translate(0, -0.5, 0); // 上端が原点
    const seeds = new Float32Array(count);
    for (let i = 0; i < count; i++) seeds[i] = Math.random() * 100;
    geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: { ...U },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      vertexShader: /* glsl */ `
        attribute float aSeed;
        varying vec2 vUv;
        varying float vSeed;
        varying float vInt;
        varying vec3 vWPos;
        void main() {
          vUv = uv;
          vSeed = aSeed;
          vInt = instanceColor.r;
          vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
          vWPos = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: /* glsl */ `
        ${COMMON_GLSL}
        varying vec2 vUv;
        varying float vSeed;
        varying float vInt;
        varying vec3 vWPos;
        void main() {
          float x = vUv.x;
          float sx = sin(x * 3.14159);
          float edge = sx * sx;
          float s1 = 0.5 + 0.5 * sin(x * 9.0 + vSeed + uTime * 0.35);
          float s2 = 0.5 + 0.5 * sin(x * 23.0 - vSeed * 1.7 + uTime * 0.6);
          float stripes = mix(s1, s1 * s2, 0.6);
          float along = vUv.y; // 1 = 上端, 0 = 下端
          float fall = smoothstep(0.0, 0.7, along) * (1.0 - smoothstep(0.93, 1.0, along));
          float flick = 0.75 + 0.25 * sin(uTime * 0.9 + vSeed * 3.0);
          float a = edge * stripes * fall * flick * vInt;
          vec3 col = mix(uWaterShallow * 1.6, uSunCol, 0.45) * uwAbsorb(vWPos.y * 0.6);
          gl_FragColor = vec4(col * a * 0.16 * uUnder, 1.0);
        }
      `,
    });
    this.mesh = new THREE.InstancedMesh(geo, mat, count);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 3;
    this.rays = [];
    for (let i = 0; i < count; i++) this.rays.push({ x: 0, z: 0, w: 1, len: 30, life: 0, max: 1, alive: false });
    this._m = new THREE.Matrix4();
    this._x = new THREE.Vector3();
    this._y = new THREE.Vector3();
    this._z = new THREE.Vector3();
    this._p = new THREE.Vector3();
  }

  respawn(r, cam, initial) {
    const a = Math.random() * Math.PI * 2;
    const d = 4 + Math.random() * 30;
    r.x = cam.position.x + Math.cos(a) * d;
    r.z = cam.position.z + Math.sin(a) * d;
    r.w = 0.6 + Math.random() * 3.2;
    r.len = 22 + Math.random() * 28;
    r.max = 6 + Math.random() * 10;
    r.life = initial ? Math.random() * r.max : 0;
    r.alive = true;
  }

  update(dt, cam, sunDir, strength) {
    // 屈折で太陽より鉛直に近い向き
    const down = this._y.set(-sunDir.x * 0.45, -1, -sunDir.z * 0.45).normalize();
    const up = this._p.copy(down).negate();
    for (let i = 0; i < this.count; i++) {
      const r = this.rays[i];
      if (!r.alive) this.respawn(r, cam, true);
      r.life += dt;
      const dx = r.x - cam.position.x, dz = r.z - cam.position.z;
      const dist = Math.hypot(dx, dz);
      if (r.life > r.max || dist > 40) this.respawn(r, cam, false);
      const lifeFade = Math.sin(Math.PI * Math.min(r.life / r.max, 1));
      const near = THREE.MathUtils.smoothstep(dist, 2.5, 8);
      // 遠くは霧に溶けるように消す（入れ替わりの瞬間が見えないように）
      const far = 1 - THREE.MathUtils.smoothstep(dist, 18, 36);
      const inten = lifeFade * near * far * strength;
      // 円筒ビルボード
      const toCam = this._z.set(cam.position.x - r.x, 0, cam.position.z - r.z).normalize();
      const xAxis = this._x.crossVectors(up, toCam).normalize();
      const zAxis = toCam.crossVectors(xAxis, up).normalize();
      this._m.makeBasis(xAxis.multiplyScalar(r.w), up.clone().multiplyScalar(r.len), zAxis);
      this._m.setPosition(r.x, 0.2, r.z);
      this.mesh.setMatrixAt(i, this._m);
      this.mesh.instanceColor.setX(i, inten);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.instanceColor.needsUpdate = true;
  }
}

// ───────── マリンスノー ─────────
export class MarineSnow {
  constructor(count = 2600) {
    const box = 36;
    const pos = new Float32Array(count * 3);
    const sz = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = Math.random() * box;
      pos[i * 3 + 1] = Math.random() * box;
      pos[i * 3 + 2] = Math.random() * box;
      sz[i] = Math.random() < 0.06 ? 1.4 + Math.random() * 1.2 : 0.45 + Math.random() * 0.7;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(sz, 1));
    this.uniforms = { ...U, uBox: { value: box }, uPR: { value: 1 } };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        ${COMMON_GLSL}
        uniform float uBox;
        uniform float uPR;
        attribute float aSize;
        varying float vA;
        void main() {
          vec3 p = position;
          p += vec3(sin(uTime * 0.13 + p.y) * 0.6, -uTime * 0.08, cos(uTime * 0.11 + p.x) * 0.6);
          vec3 c = cameraPosition;
          p = mod(p - c + uBox * 0.5, uBox) - uBox * 0.5 + c;
          vec4 mv = viewMatrix * vec4(p, 1.0);
          float d = -mv.z;
          gl_PointSize = aSize * uPR * 42.0 / max(d, 0.8);
          gl_Position = projectionMatrix * mv;
          float edge = 1.0 - smoothstep(uBox * 0.3, uBox * 0.5, length(p - c));
          vA = edge * smoothstep(0.3, 1.2, d) * step(p.y, -0.2) * uUnder * exp(p.y * 0.02);
        }
      `,
      fragmentShader: /* glsl */ `
        ${COMMON_GLSL}
        varying float vA;
        void main() {
          vec2 q = gl_PointCoord - 0.5;
          float a = 1.0 - smoothstep(0.0, 0.5, length(q));
          gl_FragColor = vec4(mix(uWaterShallow, vec3(0.9, 0.95, 1.0), 0.5) * a * vA * 0.38, 1.0);
        }
      `,
    });
    this.mesh = new THREE.Points(geo, mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 4;
  }
}

// ───────── 汎用パーティクル ─────────
// kind: 0=泡 1=砂煙 2=墨 3=しぶき 4=きらめき 5=煙
export class Particles {
  constructor(max = 1400) {
    this.max = max;
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 4);
    this.size = new Float32Array(max);
    this.kind = new Float32Array(max);
    this.list = [];
    for (let i = 0; i < max; i++) this.list.push({ alive: false });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aCol', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aKind', new THREE.BufferAttribute(this.kind, 1).setUsage(THREE.DynamicDrawUsage));
    this.geo = geo;
    this.uniforms = { ...U, uPR: { value: 1 } };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      transparent: true,
      depthWrite: false,
      vertexShader: /* glsl */ `
        uniform float uPR;
        attribute vec4 aCol;
        attribute float aSize;
        attribute float aKind;
        varying vec4 vCol;
        varying float vKind;
        void main() {
          vCol = aCol;
          vKind = aKind;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aSize * uPR * 520.0 / max(-mv.z, 0.05);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec4 vCol;
        varying float vKind;
        void main() {
          vec2 q = gl_PointCoord - 0.5;
          float r = length(q) * 2.0;
          if (r > 1.0) discard;
          float a;
          vec3 c = vCol.rgb;
          if (vKind < 0.5) {
            // 泡: 縁が明るく、ハイライト付き
            float rim = smoothstep(0.6, 0.95, r) * (1.0 - smoothstep(0.95, 1.0, r));
            float hl = (1.0 - smoothstep(0.0, 0.28, length(q - vec2(-0.15, -0.15))));
            a = rim * 0.85 + hl * 0.9 + 0.08;
            c = vec3(0.85, 0.97, 1.0);
          } else if (vKind < 3.5 || vKind > 4.5) {
            a = pow(1.0 - r, 1.6);
          } else {
            a = pow(1.0 - r, 3.0) * 1.6;
          }
          gl_FragColor = vec4(c, a * vCol.a);
        }
      `,
    });
    this.mesh = new THREE.Points(geo, mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 5;
    this.cursor = 0;
  }

  spawn(o) {
    for (let n = 0; n < this.max; n++) {
      this.cursor = (this.cursor + 1) % this.max;
      const p = this.list[this.cursor];
      if (!p.alive) {
        Object.assign(p, {
          alive: true, x: o.x, y: o.y, z: o.z,
          vx: o.vx || 0, vy: o.vy || 0, vz: o.vz || 0,
          life: 0, max: o.life || 2, size: o.size || 0.03, grow: o.grow || 0,
          kind: o.kind || 0, r: o.r ?? 1, g: o.g ?? 1, b: o.b ?? 1, a: o.a ?? 1,
          drag: o.drag ?? 1.5, buoy: o.buoy ?? 0, wob: Math.random() * 6.28, grav: o.grav || 0,
        });
        return p;
      }
    }
    return null;
  }

  bubbles(x, y, z, n = 6, spread = 0.12, big = 1) {
    for (let i = 0; i < n; i++) {
      this.spawn({
        x: x + (Math.random() - 0.5) * spread, y: y + (Math.random() - 0.5) * spread, z: z + (Math.random() - 0.5) * spread,
        vx: (Math.random() - 0.5) * 0.3, vy: 0.4 + Math.random() * 0.6, vz: (Math.random() - 0.5) * 0.3,
        size: (0.008 + Math.random() * 0.022) * big, life: 6, kind: 0, buoy: 1.4 + Math.random(), drag: 2.0,
      });
    }
  }

  sandPuff(x, y, z, n = 18, scale = 1) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = (0.4 + Math.random() * 1.4) * scale;
      this.spawn({
        x, y: y + 0.05, z, vx: Math.cos(a) * s, vy: Math.random() * 0.6 * scale, vz: Math.sin(a) * s,
        size: 0.12 * scale, grow: 0.35 * scale, life: 2.5 + Math.random() * 2, kind: 1,
        r: 0.78, g: 0.72, b: 0.58, a: 0.42, drag: 2.2,
      });
    }
  }

  ink(x, y, z, n = 28) {
    for (let i = 0; i < n; i++) {
      this.spawn({
        x: x + (Math.random() - 0.5) * 0.3, y: y + (Math.random() - 0.5) * 0.3, z: z + (Math.random() - 0.5) * 0.3,
        vx: (Math.random() - 0.5) * 1.2, vy: (Math.random() - 0.3) * 0.6, vz: (Math.random() - 0.5) * 1.2,
        size: 0.15, grow: 0.6, life: 4 + Math.random() * 2, kind: 2, r: 0.04, g: 0.03, b: 0.06, a: 0.85, drag: 1.6,
      });
    }
  }

  spray(x, y, z, n = 30) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = 0.5 + Math.random() * 2;
      this.spawn({
        x, y, z, vx: Math.cos(a) * s, vy: 1.5 + Math.random() * 2.5, vz: Math.sin(a) * s,
        size: 0.02 + Math.random() * 0.03, life: 1.2, kind: 3, r: 0.95, g: 0.98, b: 1, a: 0.8, drag: 0.4, grav: 9.8,
      });
    }
  }

  sparkle(x, y, z, n = 20) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, e = (Math.random() - 0.5) * 2, s = 0.6 + Math.random() * 1.6;
      this.spawn({
        x, y, z, vx: Math.cos(a) * s, vy: e * s, vz: Math.sin(a) * s,
        size: 0.03 + Math.random() * 0.03, life: 0.9 + Math.random() * 0.5, kind: 4, r: 1, g: 0.9, b: 0.55, a: 1, drag: 3,
      });
    }
  }

  smoke(x, y, z) {
    this.spawn({
      x: x + (Math.random() - 0.5) * 0.3, y, z: z + (Math.random() - 0.5) * 0.3,
      vx: 0.3 + Math.random() * 0.2, vy: 0.9 + Math.random() * 0.4, vz: 0.1,
      size: 0.4, grow: 1.4, life: 6, kind: 5, r: 0.75, g: 0.74, b: 0.72, a: 0.32, drag: 0.2,
    });
  }

  update(dt, waterLevelFn) {
    let n = 0;
    for (let i = 0; i < this.max; i++) {
      const p = this.list[i];
      if (!p.alive) { this.size[i] = 0; this.col[i * 4 + 3] = 0; continue; }
      p.life += dt;
      if (p.life >= p.max) { p.alive = false; this.size[i] = 0; this.col[i * 4 + 3] = 0; continue; }
      const k = Math.exp(-p.drag * dt);
      p.vx *= k; p.vy *= k; p.vz *= k;
      p.vy += (p.buoy - p.grav) * dt;
      if (p.kind === 0) {
        p.wob += dt * 9;
        p.vx += Math.sin(p.wob) * 0.6 * dt;
        p.vz += Math.cos(p.wob * 1.3) * 0.6 * dt;
        if (p.y > waterLevelFn(p.x, p.z) - 0.02) { p.alive = false; this.size[i] = 0; continue; }
      }
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      const t = p.life / p.max;
      const fade = p.kind === 0 ? 1 - Math.pow(t, 6) : (1 - t) * Math.min(1, p.life * 6);
      this.pos[i * 3] = p.x; this.pos[i * 3 + 1] = p.y; this.pos[i * 3 + 2] = p.z;
      this.col[i * 4] = p.r; this.col[i * 4 + 1] = p.g; this.col[i * 4 + 2] = p.b; this.col[i * 4 + 3] = p.a * fade;
      this.size[i] = p.size + p.grow * p.life;
      this.kind[i] = p.kind;
      n++;
    }
    const g = this.geo.attributes;
    g.position.needsUpdate = true; g.aCol.needsUpdate = true; g.aSize.needsUpdate = true; g.aKind.needsUpdate = true;
    return n;
  }
}
