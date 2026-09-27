// flare.js
const VERT$2 = `
uniform vec3 uFlSun;
uniform float uFlVis;
uniform float uFlGhost;
attribute vec2 aCorner;
attribute vec4 aEl;
attribute vec3 aCol;
varying vec2 vQ;
varying float vShape;
varying vec3 vCol;
void main() {
  vec4 c = projectionMatrix * vec4(mat3(viewMatrix) * uFlSun, 0.0);
  float vis = uFlVis;
  if (c.w <= 1e-4) vis = 0.0;
  vec2 s = c.xy / max(c.w, 1e-4);
  float edge = max(abs(s.x), abs(s.y));
  vis *= 1.0 - smoothstep(0.72, 1.12, edge);
  float aspect = projectionMatrix[1][1] / projectionMatrix[0][0];
  vec2 p = s * (1.0 - aEl.x);
  float rot = aEl.z > 0.5 && aEl.z < 1.5 ? s.x * 0.35 : 0.0;
  vec2 cr = vec2(cos(rot) * aCorner.x - sin(rot) * aCorner.y, sin(rot) * aCorner.x + cos(rot) * aCorner.y);
  vec2 off = cr * aEl.y * vec2(1.0 / aspect, 1.0);
  vQ = aCorner;
  vShape = aEl.z;
  vCol = aCol * aEl.w * vis * (aEl.x > 0.0 ? uFlGhost : 1.0);
  gl_Position = vis > 0.001 ? vec4(p + off, 0.0, 1.0) : vec4(2.0, 2.0, 2.0, 1.0);
}
`;

const FRAG$1 = `
varying vec2 vQ;
varying float vShape;
varying vec3 vCol;
float flHex(vec2 p) { p = abs(p); return max(p.x * 0.8660254 + p.y * 0.5, p.y); }
void main() {
  float r = length(vQ);
  float a = 0.0;
  if (vShape < 0.5) {
    a = exp(-r * r * 5.0) * 0.8 + exp(-r * 3.2) * 0.2;
    a *= 1.0 - smoothstep(0.8, 1.0, r);
  } else if (vShape < 1.5) {
    float ang = atan(vQ.y, vQ.x);
    float rays = pow(abs(cos(ang * 3.0)), 60.0) + 0.35 * pow(abs(cos(ang * 3.0 + 0.5235988)), 90.0);
    a = rays * exp(-r * 3.4) * (1.0 - smoothstep(0.7, 1.0, r));
    a += exp(-r * r * 60.0) * 0.4;
  } else if (vShape < 2.5) {
    a = 1.0 - smoothstep(0.2, 1.0, r);
  } else if (vShape < 3.5) {
    a = 1.0 - smoothstep(0.45, 1.0, flHex(vQ));
  } else {
    a = smoothstep(0.35, 0.75, r) * (1.0 - smoothstep(0.75, 1.0, r));
  }
  gl_FragColor = vec4(vCol * a, 1.0);
}
`;

const ELEMENTS = [
  [0.0, 0.55, 0, 0.14, [1.0, 0.86, 0.66]],
  [0.0, 0.16, 0, 0.3, [1.0, 0.94, 0.84]],
  [0.0, 0.42, 1, 0.12, [1.0, 0.93, 0.82]],
  [0.38, 0.05, 2, 0.045, [1.0, 0.72, 0.42]],
  [0.62, 0.028, 3, 0.06, [0.55, 0.9, 1.0]],
  [0.86, 0.09, 3, 0.026, [0.9, 0.75, 0.5]],
  [1.22, 0.06, 2, 0.035, [0.45, 0.85, 0.95]],
  [1.45, 0.14, 3, 0.02, [0.6, 0.8, 1.0]],
  [1.78, 0.035, 2, 0.045, [1.0, 0.65, 0.4]],
  [2.05, 0.22, 4, 0.016, [0.55, 0.85, 1.0]],
];

const smooth$1 = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

class Flare {
  constructor() {
    const n = ELEMENTS.length;
    const corner = new Float32Array(n * 8), el = new Float32Array(n * 16), col = new Float32Array(n * 12), pos = new Float32Array(n * 12);
    const idx = [];
    const cs = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
    ELEMENTS.forEach(([t, size, shape, inten, c], i) => {
      for (let k = 0; k < 4; k++) {
        const v = i * 4 + k;
        corner[v * 2] = cs[k][0]; corner[v * 2 + 1] = cs[k][1];
        el.set([t, size, shape, inten], v * 4);
        col.set(c, v * 3);
      }
      idx.push(i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3);
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aCorner', new THREE.BufferAttribute(corner, 2));
    g.setAttribute('aEl', new THREE.BufferAttribute(el, 4));
    g.setAttribute('aCol', new THREE.BufferAttribute(col, 3));
    g.setIndex(idx);
    this.uniforms = { uFlSun: { value: new THREE.Vector3(0, 1, 0) }, uFlVis: { value: 0 }, uFlGhost: { value: 1 } };
    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms, vertexShader: VERT$2, fragmentShader: FRAG$1,
      transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    });
    this.mesh = new THREE.Mesh(g, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 1e6;
    this.mesh.castShadow = false;
    this.mesh.receiveShadow = false;
    this.vis = 0;
  }
  update(dt, sunDir, eclipse, camUp) {
    this.uniforms.uFlSun.value.copy(sunDir);
    const e = Math.min(1, Math.max(0, eclipse));
    const target = smooth$1(-0.01, 0.07, sunDir.y) * smooth$1(0.2, 0.5, camUp) * (1 - e) * (1 - e);
    const k = 1 - Math.exp(-Math.min(dt, 0.1) * (target < this.vis ? 14 : 5));
    this.vis += (target - this.vis) * k;
    if (target === 0 && this.vis < 1e-3) this.vis = 0;
    this.uniforms.uFlVis.value = this.vis;
    this.uniforms.uFlGhost.value = smooth$1(0.03, 0.25, sunDir.y);
  }
}

