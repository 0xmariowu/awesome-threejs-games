// prints.js
const N = 24;
const NX = 6, NZ = 10;
const LEN = 0.305;
const HALF$1 = 0.06;
const PAD = 0.035;
const LIFT = 0.012;
const PRINT_HOLD = 5;
const PRINT_FADE = 4;

const f1 = (v) => (Number.isInteger(v) ? v.toFixed(1) : String(v));

const VERT$3 =  `
attribute vec2 aLoc;
attribute vec4 aInfo;
varying vec2 vLoc;
varying vec4 vInfo;
varying vec3 vW;
#include <common>
#include <logdepthbuf_pars_vertex>
void main() {
  vLoc = aLoc;
  vInfo = aInfo;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
  #include <logdepthbuf_vertex>
}`;

const FRAG$2 =  `
uniform float uTime;
uniform vec3 uCam;
uniform vec3 uSun;
uniform float uSunK;
varying vec2 vLoc;
varying vec4 vInfo;
varying vec3 vW;
#include <common>
#include <logdepthbuf_pars_fragment>
const float LEN = ${f1(LEN)};
float soleW(float t) {
  return 0.047 + 0.012 * sin(PI * min(1.0, t * 1.3)) - 0.014 * smoothstep(0.85, 1.0, t) - 0.006 * (1.0 - smoothstep(0.0, 0.12, t));
}
float sandH(float d, float depth, float k) {
  float h = -depth * (1.0 - smoothstep(-0.018, 0.003, d));
  h += mix(0.002, 0.004, k) * smoothstep(-0.003, 0.012, d) * (1.0 - smoothstep(0.012, 0.034, d));
  return h;
}
void main() {
  #include <logdepthbuf_fragment>
  float k = vInfo.y;
  if (k <= 0.0) discard;
  float a = -0.5 * LEN + soleW(0.0), b = 0.5 * LEN - soleW(1.0);
  float yc = clamp(vLoc.y, a, b);
  vec2 r = vec2(vLoc.x, vLoc.y - yc);
  float d = length(r) - soleW((yc + 0.5 * LEN) / LEN);
  if (d > 0.036) discard;
  float age = uTime - vInfo.x;
  float f = smoothstep(0.0, 0.25, age) * (1.0 - smoothstep(${f1(PRINT_HOLD)}, ${f1(PRINT_HOLD + PRINT_FADE)}, age));
  f *= 1.0 - smoothstep(6.0, 14.0, distance(vW, uCam));
  if (f <= 0.003) discard;
  float depth = mix(0.011, 0.018, k) * (1.0 + 0.4 * (1.0 - smoothstep(-0.12, 0.06, vLoc.y)));
  float hp = (sandH(d + 0.001, depth, k) - sandH(d - 0.001, depth, k)) / 0.002;
  vec2 n = r / max(length(r), 1e-4);
  vec2 ax = vInfo.zw, rt = vec2(-ax.y, ax.x);
  vec2 g = hp * (n.x * rt + n.y * ax);
  float s = 1.0 - uSunK * 0.9 * dot(g, uSun.xz) / max(uSun.y, 0.3);
  float inK = 1.0 - smoothstep(-0.018, 0.0, d);
  float footK = smoothstep(-0.03, -0.014, d) * (1.0 - smoothstep(-0.014, -0.004, d));
  s *= 1.0 - 0.12 * inK - 0.08 * footK;
  s = clamp(s, 0.5, 1.45);
  gl_FragColor = vec4(vec3(mix(1.0, s, f)), 1.0);
}`;

class Prints {
  constructor(scene, ground) {
    this.ground = ground;
    this.per = (NX + 1) * (NZ + 1);
    this.tris = NX * NZ * 2;
    this.next = 0;
    this.count = 0;
    this.newest = -Infinity;
    this.at = new Float32Array(N * 3);
    const V = N * this.per;
    const geo = new THREE.BufferGeometry();
    this.pos = new THREE.BufferAttribute(new Float32Array(V * 3), 3);
    this.loc = new THREE.BufferAttribute(new Float32Array(V * 2), 2);
    this.info = new THREE.BufferAttribute(new Float32Array(V * 4), 4);
    for (const at of [this.pos, this.loc, this.info]) at.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', this.pos);
    geo.setAttribute('aLoc', this.loc);
    geo.setAttribute('aInfo', this.info);
    const idx = [];
    for (let n = 0; n < N; n++) {
      const o = n * this.per;
      for (let j = 0; j < NZ; j++) {
        for (let i = 0; i < NX; i++) {
          const p = o + j * (NX + 1) + i, q = p + NX + 1;
          idx.push(p, p + 1, q, p + 1, q + 1, q);
        }
      }
    }
    geo.setIndex(idx);
    geo.setDrawRange(0, 0);
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 0);
    this.geo = geo;
    this.mat = new THREE.ShaderMaterial({
      vertexShader: VERT$3,
      fragmentShader: FRAG$2,
      uniforms: {
        uTime: { value: 0 },
        uCam: { value: new THREE.Vector3() },
        uSun: { value: new THREE.Vector3(0, 1, 0) },
        uSunK: { value: 1 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.DstColorFactor,
      blendDst: THREE.ZeroFactor,
      blendSrcAlpha: THREE.ZeroFactor,
      blendDstAlpha: THREE.OneFactor,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.name = 'bootPrints';
    this.mesh.renderOrder = -10;
    scene.add(this.mesh);
  }

  stamp(x, z, ax, az, k = 1, t = 0) {
    const n = this.next;
    this.next = (n + 1) % N;
    this.count = Math.min(N, this.count + 1);
    const rx = -az, rz = ax;
    const P = this.pos.array, L = this.loc.array, I = this.info.array;
    const o0 = n * this.per;
    let o = o0;
    for (let j = 0; j <= NZ; j++) {
      const v = (j / NZ - 0.5) * (LEN + 2 * PAD);
      for (let i = 0; i <= NX; i++, o++) {
        const u = (i / NX - 0.5) * 2 * (HALF$1 + PAD);
        const wx = x + rx * u + ax * v, wz = z + rz * u + az * v;
        P[o * 3] = wx;
        P[o * 3 + 1] = this.ground(wx, wz) + LIFT;
        P[o * 3 + 2] = wz;
        L[o * 2] = u;
        L[o * 2 + 1] = v;
        I[o * 4] = t;
        I[o * 4 + 1] = Math.max(0.05, Math.min(1, k));
        I[o * 4 + 2] = ax;
        I[o * 4 + 3] = az;
      }
    }
    for (const [at, w] of [[this.pos, 3], [this.loc, 2], [this.info, 4]]) {
      at.addUpdateRange(o0 * w, this.per * w);
      at.needsUpdate = true;
    }
    this.geo.setDrawRange(0, this.count * this.tris * 3);
    this.newest = t;
    const C = this.at;
    C[n * 3] = x;
    C[n * 3 + 1] = this.ground(x, z) + LIFT;
    C[n * 3 + 2] = z;
    _bb.makeEmpty();
    for (let i = 0; i < this.count; i++) _bb.expandByPoint(_bp.fromArray(C, i * 3));
    const s = this.geo.boundingSphere;
    _bb.getCenter(s.center);
    s.radius = 0.5 * _bb.getSize(_bp).length() + 0.25;
  }

  update(t, camera, sunDir) {
    const U = this.mat.uniforms;
    if (this.count > 0 && t - this.newest > PRINT_HOLD + PRINT_FADE) {
      this.count = 0;
      this.next = 0;
      this.geo.setDrawRange(0, 0);
    }
    U.uTime.value = t;
    U.uCam.value.copy(camera.position);
    const l = sunDir.lengthSq() > 0 ? sunDir : _up;
    const inv = 1 / Math.max(1e-6, l.length());
    const lx = l.x * inv * 0.75, lz = l.z * inv * 0.75;
    U.uSun.value.set(lx, Math.sqrt(Math.max(0.05, 1 - lx * lx - lz * lz)), lz);
    U.uSunK.value = Math.min(1, Math.max(0, (l.y * inv) / 0.1));
  }

  clear() {
    const I = this.info.array;
    for (let i = 1; i < I.length; i += 4) I[i] = 0;
    this.info.clearUpdateRanges();
    this.info.needsUpdate = true;
    this.count = 0;
    this.next = 0;
    this.newest = -Infinity;
    this.geo.setDrawRange(0, 0);
  }
}

const _up = new THREE.Vector3(0, 1, 0);
const _bb = new THREE.Box3(), _bp = new THREE.Vector3();

