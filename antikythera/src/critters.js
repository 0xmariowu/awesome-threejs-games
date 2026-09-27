// critters.js
const TAU$2 = Math.PI * 2;
const clamp$3 = (x, a, b) => (x < a ? a : x > b ? b : x);
const lerp$1 = (a, b, t) => a + (b - a) * t;
const sstep$2 = (a, b, x) => {
  if (a === b) return x > a ? 1 : 0;
  const t = clamp$3((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const expK = (k, dt) => 1 - Math.exp(-k * dt);
const num$1 = (v, d) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const wrapPi = (a) => {
  a = (a + Math.PI) % TAU$2;
  if (a < 0) a += TAU$2;
  return a - Math.PI;
};
const approach = (a, b, step) => (a < b ? Math.min(b, a + step) : Math.max(b, a - step));

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const placeRng = (seed) => makeRng(((seed >>> 0) ^ (VARY && VARY.mix ? VARY.mix : 0)) >>> 0);
function makeRng(seed) {
  const r = mulberry32(seed);
  const f = () => r();
  f.range = (a, b) => a + (b - a) * r();
  f.pick = (arr) => arr[Math.min(arr.length - 1, Math.floor(r() * arr.length))];
  f.sign = () => (r() < 0.5 ? -1 : 1);
  f.gauss = () => {
    let u = 0, v = 0;
    while (u === 0) u = r();
    while (v === 0) v = r();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU$2 * v);
  };
  return f;
}

const gf = (x) => (Number.isFinite(+x) ? +x : 0).toFixed(5);
const _gcol = new THREE.Color();
const gc = (hex) => {
  _gcol.set(hex);
  return `vec3(${gf(_gcol.r)}, ${gf(_gcol.g)}, ${gf(_gcol.b)})`;
};
const g3 = (v) => `vec3(${gf(v[0])}, ${gf(v[1])}, ${gf(v[2])})`;
const linRGB = (hex) => {
  _gcol.set(hex);
  return [_gcol.r, _gcol.g, _gcol.b];
};
const mixRGB = (a, b, t) => [lerp$1(a[0], b[0], t), lerp$1(a[1], b[1], t), lerp$1(a[2], b[2], t)];

class Geo {
  constructor(extra = {}) {
    this.p = [];
    this.n = [];
    this.i = [];
    this.ex = {};
    this.exSize = {};
    for (const k in extra) {
      this.ex[k] = [];
      this.exSize[k] = extra[k];
    }
  }
  get count() {
    return this.p.length / 3;
  }
  v(px, py, pz, nx, ny, nz, ex) {
    this.p.push(px, py, pz);
    const l = Math.hypot(nx, ny, nz);
    if (l > 1e-12) this.n.push(nx / l, ny / l, nz / l);
    else this.n.push(0, 1, 0);
    for (const k in this.ex) {
      const s = this.exSize[k];
      const val = ex ? ex[k] : undefined;
      if (s === 1) this.ex[k].push(typeof val === 'number' ? val : 0);
      else for (let c = 0; c < s; c++) this.ex[k].push(val && typeof val[c] === 'number' ? val[c] : 0);
    }
    return this.p.length / 3 - 1;
  }
  tri(a, b, c) {
    this.i.push(a, b, c);
  }
  quad(a, b, c, d) {
    this.i.push(a, b, c, a, c, d);
  }
  grid(base, rows, cols, wrapCols = false) {
    const cc = wrapCols ? cols : cols - 1;
    for (let r = 0; r < rows - 1; r++) {
      for (let c = 0; c < cc; c++) {
        const c1 = (c + 1) % cols;
        this.quad(base + r * cols + c, base + (r + 1) * cols + c, base + (r + 1) * cols + c1, base + r * cols + c1);
      }
    }
  }
  fixWinding() {
    const p = this.p, n = this.n, I = this.i;
    for (let t = 0; t < I.length; t += 3) {
      const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3;
      const ux = p[b] - p[a], uy = p[b + 1] - p[a + 1], uz = p[b + 2] - p[a + 2];
      const vx = p[c] - p[a], vy = p[c + 1] - p[a + 1], vz = p[c + 2] - p[a + 2];
      const fx = uy * vz - uz * vy, fy = uz * vx - ux * vz, fz = ux * vy - uy * vx;
      const sx = n[a] + n[b] + n[c], sy = n[a + 1] + n[b + 1] + n[c + 1], sz = n[a + 2] + n[b + 2] + n[c + 2];
      if (fx * sx + fy * sy + fz * sz < 0) {
        const tmp = I[t + 1];
        I[t + 1] = I[t + 2];
        I[t + 2] = tmp;
      }
    }
  }
  smoothNormals() {
    const p = this.p, I = this.i;
    const acc = new Float64Array(p.length);
    for (let t = 0; t < I.length; t += 3) {
      const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3;
      const ux = p[b] - p[a], uy = p[b + 1] - p[a + 1], uz = p[b + 2] - p[a + 2];
      const vx = p[c] - p[a], vy = p[c + 1] - p[a + 1], vz = p[c + 2] - p[a + 2];
      const fx = uy * vz - uz * vy, fy = uz * vx - ux * vz, fz = ux * vy - uy * vx;
      for (const k of [a, b, c]) {
        acc[k] += fx;
        acc[k + 1] += fy;
        acc[k + 2] += fz;
      }
    }
    for (let k = 0; k < p.length; k += 3) {
      const l = Math.hypot(acc[k], acc[k + 1], acc[k + 2]);
      if (l > 1e-20) {
        this.n[k] = acc[k] / l;
        this.n[k + 1] = acc[k + 1] / l;
        this.n[k + 2] = acc[k + 2] / l;
      }
    }
  }
  orientOutward() {
    const p = this.p, n = this.n, c = this.count;
    if (!c) return;
    let cx = 0, cy = 0, cz = 0;
    for (let k = 0; k < p.length; k += 3) {
      cx += p[k];
      cy += p[k + 1];
      cz += p[k + 2];
    }
    cx /= c;
    cy /= c;
    cz /= c;
    let s = 0;
    for (let k = 0; k < p.length; k += 3) s += n[k] * (p[k] - cx) + n[k + 1] * (p[k + 1] - cy) + n[k + 2] * (p[k + 2] - cz);
    if (s < 0) for (let k = 0; k < n.length; k++) n[k] = -n[k];
  }
  orientTo(x, y, z) {
    const n = this.n;
    let s = 0;
    for (let k = 0; k < n.length; k += 3) s += n[k] * x + n[k + 1] * y + n[k + 2] * z;
    if (s < 0) for (let k = 0; k < n.length; k++) n[k] = -n[k];
  }
  append(g, m) {
    const base = this.count;
    const v = new THREE.Vector3(), nn = new THREE.Vector3();
    const nm = m ? new THREE.Matrix3().getNormalMatrix(m) : null;
    for (let k = 0; k < g.count; k++) {
      v.set(g.p[k * 3], g.p[k * 3 + 1], g.p[k * 3 + 2]);
      nn.set(g.n[k * 3], g.n[k * 3 + 1], g.n[k * 3 + 2]);
      if (m) {
        v.applyMatrix4(m);
        nn.applyMatrix3(nm).normalize();
      }
      this.p.push(v.x, v.y, v.z);
      this.n.push(nn.x, nn.y, nn.z);
    }
    for (const key in this.ex) {
      const src = g.ex[key];
      const s = this.exSize[key];
      if (src && src.length === g.count * s) for (let q = 0; q < src.length; q++) this.ex[key].push(src[q]);
      else for (let q = 0; q < g.count * s; q++) this.ex[key].push(0);
    }
    for (let q = 0; q < g.i.length; q++) this.i.push(g.i[q] + base);
    return base;
  }
  build(fix = true) {
    if (fix) this.fixWinding();
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    for (const k in this.ex) geo.setAttribute(k, new THREE.Float32BufferAttribute(this.ex[k], this.exSize[k]));
    geo.setIndex(this.i);
    geo.computeBoundingSphere();
    return geo;
  }
}

new THREE.Vector3(); new THREE.Vector3(); const _tT = new THREE.Vector3(), _tN = new THREE.Vector3(), _tU = new THREE.Vector3();
function tube(geo, pts, radii, radial, ex, opts = {}) {
  const m = pts.length;
  if (m < 2) return;
  const T = [], N = [], B = [];
  for (let j = 0; j < m; j++) {
    const a = pts[Math.max(0, j - 1)], b = pts[Math.min(m - 1, j + 1)];
    _tT.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]).normalize();
    T.push(_tT.clone());
  }
  _tU.set(...(opts.up || [0, 1, 0]));
  if (Math.abs(_tU.dot(T[0])) > 0.95) _tU.set(1, 0, 0);
  _tN.copy(_tU).addScaledVector(T[0], -_tU.dot(T[0])).normalize();
  for (let j = 0; j < m; j++) {
    if (j > 0) _tN.addScaledVector(T[j], -_tN.dot(T[j])).normalize();
    N.push(_tN.clone());
    B.push(new THREE.Vector3().crossVectors(_tN, T[j]));
  }
  const base = geo.count;
  const cols = radial + 1;
  for (let j = 0; j < m; j++) {
    const t = j / (m - 1);
    for (let k = 0; k <= radial; k++) {
      const a = (k / radial) * TAU$2;
      const c = Math.cos(a), s = Math.sin(a);
      const nx = B[j].x * c + N[j].x * s, ny = B[j].y * c + N[j].y * s, nz = B[j].z * c + N[j].z * s;
      const r = radii[j];
      geo.v(pts[j][0] + nx * r, pts[j][1] + ny * r, pts[j][2] + nz * r, nx, ny, nz, ex ? ex(j, k, t, a) : undefined);
    }
  }
  geo.grid(base, m, cols, false);
  const capLen = opts.capLen !== undefined ? opts.capLen : 0.6;
  if (opts.capEnd) {
    const e = pts[m - 1], te = T[m - 1];
    const cex = opts.capEx || (ex ? ex(m - 1, 0, 1, 0) : undefined);
    const cl = radii[m - 1] * capLen;
    const tip = geo.v(e[0] + te.x * cl, e[1] + te.y * cl, e[2] + te.z * cl, te.x, te.y, te.z, cex);
    const rb = base + (m - 1) * cols;
    for (let k = 0; k < radial; k++) geo.tri(rb + k, rb + k + 1, tip);
  }
  if (opts.capStart) {
    const e = pts[0], ts = T[0];
    const cl = radii[0] * capLen;
    const tip = geo.v(e[0] - ts.x * cl, e[1] - ts.y * cl, e[2] - ts.z * cl, -ts.x, -ts.y, -ts.z, ex ? ex(0, 0, 0, 0) : undefined);
    for (let k = 0; k < radial; k++) geo.tri(base + k + 1, base + k, tip);
  }
}

function cone(g, bx, by, bz, dx, dy, dz, len, r0, r1, radial, exFn) {
  const dl = Math.hypot(dx, dy, dz) || 1;
  dx /= dl;
  dy /= dl;
  dz /= dl;
  const pts = [[bx, by, bz], [bx + dx * len * 0.5, by + dy * len * 0.5, bz + dz * len * 0.5], [bx + dx * len, by + dy * len, bz + dz * len]];
  tube(g, pts, [r0, (r0 + r1) * 0.5, r1], radial, (j, k, t) => (exFn ? exFn(t) : undefined), { capEnd: true, capLen: 0.8 });
}

function sphere(geo, cx, cy, cz, rx, ry, rz, wSeg, hSeg, ex) {
  const base = geo.count;
  const cols = wSeg + 1;
  for (let j = 0; j <= hSeg; j++) {
    const v = j / hSeg, th = v * Math.PI;
    for (let k = 0; k <= wSeg; k++) {
      const u = k / wSeg, ph = u * TAU$2;
      const sx = Math.sin(th) * Math.cos(ph), sy = Math.cos(th), sz = Math.sin(th) * Math.sin(ph);
      geo.v(cx + sx * rx, cy + sy * ry, cz + sz * rz, sx / rx, sy / ry, sz / rz, ex ? ex(sx, sy, sz, u, v) : undefined);
    }
  }
  geo.grid(base, hSeg + 1, cols, false);
}

const CR_NOISE =  `
float crHash13(vec3 p3) {
  p3 = fract(p3 * 0.1031);
  p3 += dot(p3, p3.zyx + 31.32);
  return fract((p3.x + p3.y) * p3.z);
}
float crHash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
vec2 crHash22(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}
vec3 crHash33(vec3 p3) {
  p3 = fract(p3 * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yxz + 33.33);
  return fract((p3.xxy + p3.yxx) * p3.zyx);
}
float crNoise3(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  float n000 = crHash13(i);
  float n100 = crHash13(i + vec3(1.0, 0.0, 0.0));
  float n010 = crHash13(i + vec3(0.0, 1.0, 0.0));
  float n110 = crHash13(i + vec3(1.0, 1.0, 0.0));
  float n001 = crHash13(i + vec3(0.0, 0.0, 1.0));
  float n101 = crHash13(i + vec3(1.0, 0.0, 1.0));
  float n011 = crHash13(i + vec3(0.0, 1.0, 1.0));
  float n111 = crHash13(i + vec3(1.0, 1.0, 1.0));
  return mix(mix(mix(n000, n100, f.x), mix(n010, n110, f.x), f.y),
             mix(mix(n001, n101, f.x), mix(n011, n111, f.x), f.y), f.z);
}
float crFbm3(vec3 p) {
  float s = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    s += a * crNoise3(p);
    p = p * 2.03 + vec3(1.7, 9.2, 3.1);
    a *= 0.5;
  }
  return s / 0.9375;
}
vec2 crCell3(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  float d1 = 8.0;
  float id = 0.0;
  for (int z = -1; z <= 1; z++) {
    for (int y = -1; y <= 1; y++) {
      for (int x = -1; x <= 1; x++) {
        vec3 g = vec3(float(x), float(y), float(z));
        vec3 o = crHash33(i + g);
        vec3 r = g + o - f;
        float d = dot(r, r);
        if (d < d1) {
          d1 = d;
          id = crHash13(i + g + 17.17);
        }
      }
    }
  }
  return vec2(sqrt(d1), id);
}
vec2 crCell2(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float d1 = 8.0;
  float id = 0.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 g = vec2(float(x), float(y));
      vec2 o = crHash22(i + g);
      vec2 r = g + o - f;
      float d = dot(r, r);
      if (d < d1) {
        d1 = d;
        id = crHash12(i + g + 7.31);
      }
    }
  }
  return vec2(sqrt(d1), id);
}
`;

const CR_BUMP =  `
vec3 crPerturb(vec3 surfPos, vec3 surfNorm, float h) {
  vec3 dpx = dFdx(surfPos);
  vec3 dpy = dFdy(surfPos);
  float dhx = dFdx(h);
  float dhy = dFdy(h);
  vec3 r1 = cross(dpy, surfNorm);
  vec3 r2 = cross(surfNorm, dpx);
  float det = dot(dpx, r1);
  vec3 grad = sign(det) * (dhx * r1 + dhy * r2);
  vec3 nn = abs(det) * surfNorm - grad;
  float l2 = dot(nn, nn);
  return l2 > 1e-24 ? nn * inversesqrt(l2) : surfNorm;
}
`;

const CR_SURGE =  `
vec3 crSurge(float t) {
  float k = 6.2831853 / 7.5;
  return vec3(sin(t * k) * 0.16, 0.0, cos(t * k + 0.7) * 0.10);
}
`;

function injectLit(mat, inj, key) {
  mat.onBeforeCompile = (sh) => {
    if (inj.uniforms) Object.assign(sh.uniforms, inj.uniforms);
    let vs = sh.vertexShader, fs = sh.fragmentShader;
    if (inj.vDecl) vs = vs.replace('#include <common>', '#include <common>\n' + inj.vDecl);
    if (inj.vNormal) vs = vs.replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\n' + inj.vNormal);
    if (inj.vBegin) vs = vs.replace('#include <begin_vertex>', '#include <begin_vertex>\n' + inj.vBegin);
    if (inj.fDecl) fs = fs.replace('#include <common>', '#include <common>\n' + inj.fDecl);
    if (inj.fColor) fs = fs.replace('#include <color_fragment>', '#include <color_fragment>\n' + inj.fColor);
    if (inj.fNormal) fs = fs.replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n' + inj.fNormal);
    if (inj.fEmissive) fs = fs.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n' + inj.fEmissive);
    sh.vertexShader = vs;
    sh.fragmentShader = fs;
  };
  mat.customProgramCacheKey = () => 'crit-' + key;
  return mat;
}

function depthMaterial(uniforms, vDecl, vBegin, key) {
  const m = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\n' + vDecl)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n' + vBegin);
  };
  m.customProgramCacheKey = () => 'crit-depth-' + key;
  return m;
}

const TER_SIZE = 300, TER_SEG = 340, TER_STEP = TER_SIZE / TER_SEG, TER_MIN = -TER_SIZE / 2;

function makeGround(floorFn) {
  const cache = new Map();
  const exact = (x, z) => {
    const h = +floorFn(x, z);
    return Number.isFinite(h) ? h : -20;
  };
  const vh = (i, j) => {
    const k = i * 1024 + j;
    let h = cache.get(k);
    if (h === undefined) {
      h = exact(TER_MIN + i * TER_STEP, TER_MIN + j * TER_STEP);
      if (cache.size > 50000) cache.clear();
      cache.set(k, h);
    }
    return h;
  };
  function height(x, z) {
    const gx = (x - TER_MIN) / TER_STEP, gz = (z - TER_MIN) / TER_STEP;
    const i = Math.floor(gx), j = Math.floor(gz);
    if (!(i >= 0 && j >= 0 && i < TER_SEG && j < TER_SEG)) return exact(x, z);
    const fx = gx - i, fz = gz - j;
    if (fx + fz <= 1) {
      const a = vh(i, j), b = vh(i + 1, j), c = vh(i, j + 1);
      return a + (b - a) * fx + (c - a) * fz;
    }
    const b = vh(i + 1, j), c = vh(i, j + 1), d = vh(i + 1, j + 1);
    return d + (c - d) * (1 - fx) + (b - d) * (1 - fz);
  }
  function normal(x, z, out, e = 0.3) {
    const dx = (height(x + e, z) - height(x - e, z)) / (2 * e);
    const dz = (height(x, z + e) - height(x, z - e)) / (2 * e);
    out.set(-dx, 1, -dz).normalize();
    return out;
  }
  function slope(x, z, e = 0.35) {
    const dx = (exact(x + e, z) - exact(x - e, z)) / (2 * e);
    const dz = (exact(x, z + e) - exact(x, z - e)) / (2 * e);
    return Math.hypot(dx, dz);
  }
  return { height, normal, slope, exact };
}

function makeRockIndex(pts) {
  const CELL = 1.0;
  let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
  for (const p of pts) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.z < minZ) minZ = p.z;
    if (p.z > maxZ) maxZ = p.z;
  }
  if (!pts.length) {
    minX = minZ = 0;
    maxX = maxZ = 1;
  }
  const nx = Math.max(1, Math.ceil((maxX - minX) / CELL) + 1), nz = Math.max(1, Math.ceil((maxZ - minZ) / CELL) + 1);
  const cells = new Array(nx * nz);
  for (let k = 0; k < cells.length; k++) cells[k] = [];
  pts.forEach((p, idx) => {
    const cx = clamp$3(Math.floor((p.x - minX) / CELL), 0, nx - 1), cz = clamp$3(Math.floor((p.z - minZ) / CELL), 0, nz - 1);
    cells[cz * nx + cx].push(idx);
  });
  function each(x, z, r, fn) {
    const x0 = Math.floor((x - r - minX) / CELL), x1 = Math.floor((x + r - minX) / CELL);
    const z0 = Math.floor((z - r - minZ) / CELL), z1 = Math.floor((z + r - minZ) / CELL);
    for (let cz = Math.max(0, z0); cz <= Math.min(nz - 1, z1); cz++) {
      for (let cx = Math.max(0, x0); cx <= Math.min(nx - 1, x1); cx++) {
        const list = cells[cz * nx + cx];
        for (let q = 0; q < list.length; q++) {
          const p = pts[list[q]];
          const dx = p.x - x, dz = p.z - z;
          if (dx * dx + dz * dz <= r * r && fn(p)) return true;
        }
      }
    }
    return false;
  }
  function nearest3(x, y, z, r) {
    let best = r;
    each(x, z, r, (p) => {
      const d = Math.hypot(p.x - x, p.y - y, p.z - z);
      if (d < best) best = d;
      return false;
    });
    return best;
  }
  function blocked(x, z, h, clear, minH, cap, slope) {
    const r = clear + cap;
    const x0 = Math.max(0, Math.floor((x - r - minX) / CELL)), x1 = Math.min(nx - 1, Math.floor((x + r - minX) / CELL));
    const z0 = Math.max(0, Math.floor((z - r - minZ) / CELL)), z1 = Math.min(nz - 1, Math.floor((z + r - minZ) / CELL));
    for (let cz = z0; cz <= z1; cz++) {
      for (let cx = x0; cx <= x1; cx++) {
        const list = cells[cz * nx + cx];
        for (let q = 0; q < list.length; q++) {
          const p = pts[list[q]];
          const hp = p.y - h;
          if (hp <= minH) continue;
          const dx = p.x - x, dz = p.z - z;
          const lim = clear + Math.min(cap, hp * slope);
          if (dx * dx + dz * dz < lim * lim) return true;
        }
      }
    }
    return false;
  }
  return { each, nearest3, blocked, count: pts.length };
}

function jhash3(x, y, z) {
  let h = Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1) ^ Math.imul(z | 0, 0x2545f491);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function vnoise3$1(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  let u = x - xi, v = y - yi, w = z - zi;
  u = u * u * (3 - 2 * u);
  v = v * v * (3 - 2 * v);
  w = w * w * (3 - 2 * w);
  const a = lerp$1(jhash3(xi, yi, zi), jhash3(xi + 1, yi, zi), u);
  const b = lerp$1(jhash3(xi, yi + 1, zi), jhash3(xi + 1, yi + 1, zi), u);
  const c = lerp$1(jhash3(xi, yi, zi + 1), jhash3(xi + 1, yi, zi + 1), u);
  const d = lerp$1(jhash3(xi, yi + 1, zi + 1), jhash3(xi + 1, yi + 1, zi + 1), u);
  return lerp$1(lerp$1(a, b, v), lerp$1(c, d, v), w) * 2 - 1;
}
const smin$1 = (a, b, k) => {
  const h = clamp$3(0.5 + (0.5 * (b - a)) / k, 0, 1);
  return b + (a - b) * h - k * h * (1 - h);
};
function sdEllipsoid(px, py, pz, cx, cy, cz, rx, ry, rz) {
  const x = (px - cx) / rx, y = (py - cy) / ry, z = (pz - cz) / rz;
  const k0 = Math.sqrt(x * x + y * y + z * z);
  const k1 = Math.sqrt((x / rx) * (x / rx) + (y / ry) * (y / ry) + (z / rz) * (z / rz));
  return k1 > 1e-9 ? (k0 * (k0 - 1)) / k1 : -Math.min(rx, ry, rz);
}
function sdRoundCone(px, py, pz, ax, ay, az, bx, by, bz, ra, rb) {
  const pax = px - ax, pay = py - ay, paz = pz - az;
  const bax = bx - ax, bay = by - ay, baz = bz - az;
  const h = clamp$3((pax * bax + pay * bay + paz * baz) / (bax * bax + bay * bay + baz * baz), 0, 1);
  return Math.hypot(pax - bax * h, pay - bay * h, paz - baz * h) - (ra + (rb - ra) * h);
}
function surfaceNets$1(geo, sdf, min, max, step, exFn) {
  const nx = Math.ceil((max[0] - min[0]) / step) + 1;
  const ny = Math.ceil((max[1] - min[1]) / step) + 1;
  const nz = Math.ceil((max[2] - min[2]) / step) + 1;
  const vals = new Float32Array(nx * ny * nz);
  let k = 0;
  for (let z = 0; z < nz; z++) {
    const pz = min[2] + z * step;
    for (let y = 0; y < ny; y++) {
      const py = min[1] + y * step;
      for (let x = 0; x < nx; x++) vals[k++] = sdf(min[0] + x * step, py, pz);
    }
  }
  const idx = (x, y, z) => x + nx * (y + ny * z);
  const cx = nx - 1, cy = ny - 1;
  const cidx = (x, y, z) => x + cx * (y + cy * z);
  const cellVert = new Int32Array(cx * cy * (nz - 1)).fill(-1);
  const CO = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
  const ED = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  const cv = new Float32Array(8);
  const e = step * 0.5;
  for (let z = 0; z < nz - 1; z++) {
    for (let y = 0; y < ny - 1; y++) {
      for (let x = 0; x < nx - 1; x++) {
        let mask = 0;
        for (let c = 0; c < 8; c++) {
          const v = vals[idx(x + CO[c][0], y + CO[c][1], z + CO[c][2])];
          cv[c] = v;
          if (v < 0) mask |= 1 << c;
        }
        if (mask === 0 || mask === 255) continue;
        let sx = 0, sy = 0, sz = 0, cnt = 0;
        for (let q = 0; q < 12; q++) {
          const a = ED[q][0], b = ED[q][1];
          const va = cv[a], vb = cv[b];
          if ((va < 0) !== (vb < 0)) {
            const t = va / (va - vb);
            sx += CO[a][0] + (CO[b][0] - CO[a][0]) * t;
            sy += CO[a][1] + (CO[b][1] - CO[a][1]) * t;
            sz += CO[a][2] + (CO[b][2] - CO[a][2]) * t;
            cnt++;
          }
        }
        const px = min[0] + (x + sx / cnt) * step, py = min[1] + (y + sy / cnt) * step, pz = min[2] + (z + sz / cnt) * step;
        const gx = sdf(px + e, py, pz) - sdf(px - e, py, pz);
        const gy = sdf(px, py + e, pz) - sdf(px, py - e, pz);
        const gz = sdf(px, py, pz + e) - sdf(px, py, pz - e);
        cellVert[cidx(x, y, z)] = geo.v(px, py, pz, gx, gy, gz, exFn ? exFn(px, py, pz) : undefined);
      }
    }
  }
  const quad = (a, b, c, d) => {
    if (a >= 0 && b >= 0 && c >= 0 && d >= 0) geo.quad(a, b, c, d);
  };
  for (let z = 1; z < nz - 1; z++) {
    for (let y = 1; y < ny - 1; y++) {
      for (let x = 1; x < nx - 1; x++) {
        const s0 = vals[idx(x, y, z)] < 0;
        if (s0 !== vals[idx(x + 1, y, z)] < 0) quad(cellVert[cidx(x, y - 1, z - 1)], cellVert[cidx(x, y, z - 1)], cellVert[cidx(x, y, z)], cellVert[cidx(x, y - 1, z)]);
        if (s0 !== vals[idx(x, y + 1, z)] < 0) quad(cellVert[cidx(x - 1, y, z - 1)], cellVert[cidx(x, y, z - 1)], cellVert[cidx(x, y, z)], cellVert[cidx(x - 1, y, z)]);
        if (s0 !== vals[idx(x, y, z + 1)] < 0) quad(cellVert[cidx(x - 1, y - 1, z)], cellVert[cidx(x, y - 1, z)], cellVert[cidx(x, y, z)], cellVert[cidx(x - 1, y, z)]);
      }
    }
  }
}

const Y_UP$1 = new THREE.Vector3(0, 1, 0);
const _m4 = new THREE.Matrix4();
function basisQuat(xv, yv, zv, out) {
  _m4.makeBasis(xv, yv, zv);
  return out.setFromRotationMatrix(_m4);
}
function lookQuat(fwd, up, out, tx, tz) {
  tz.copy(fwd).addScaledVector(up, -fwd.dot(up));
  if (tz.lengthSq() < 1e-10) {
    tz.set(0, 0, 1).addScaledVector(up, -up.z);
    if (tz.lengthSq() < 1e-10) tz.set(1, 0, 0).addScaledVector(up, -up.x);
  }
  tz.normalize();
  tx.crossVectors(up, tz).normalize();
  return basisQuat(tx, up, tz, out);
}
function aimQuat(fwd, upHint, out, tx, ty) {
  ty.copy(upHint).addScaledVector(fwd, -upHint.dot(fwd));
  if (ty.lengthSq() < 1e-10) ty.set(1, 0, 0).addScaledVector(fwd, -fwd.x);
  ty.normalize();
  tx.crossVectors(ty, fwd).normalize();
  return basisQuat(tx, ty, fwd, out);
}
function writeSegment(arr, o, ax, ay, az, bx, by, bz, thickX, thickZ, rx, ry, rz) {
  let yx = bx - ax, yy = by - ay, yz = bz - az;
  const len = Math.hypot(yx, yy, yz) || 1e-6;
  yx /= len;
  yy /= len;
  yz /= len;
  let xx = yy * rz - yz * ry, xy = yz * rx - yx * rz, xz = yx * ry - yy * rx;
  let xl = Math.hypot(xx, xy, xz);
  if (xl < 1e-5) {
    xx = yy * 1 - yz * 0;
    xy = yz * 0 - yx * 1;
    xz = 0;
    xl = Math.hypot(xx, xy, xz);
    if (xl < 1e-5) {
      xx = 1;
      xy = 0;
      xz = 0;
      xl = 1;
    }
  }
  xx /= xl;
  xy /= xl;
  xz /= xl;
  const zx = xy * yz - xz * yy, zy = xz * yx - xx * yz, zz = xx * yy - xy * yx;
  arr[o] = xx * thickX;
  arr[o + 1] = xy * thickX;
  arr[o + 2] = xz * thickX;
  arr[o + 3] = 0;
  arr[o + 4] = yx * len;
  arr[o + 5] = yy * len;
  arr[o + 6] = yz * len;
  arr[o + 7] = 0;
  arr[o + 8] = zx * thickZ;
  arr[o + 9] = zy * thickZ;
  arr[o + 10] = zz * thickZ;
  arr[o + 11] = 0;
  arr[o + 12] = ax;
  arr[o + 13] = ay;
  arr[o + 14] = az;
  arr[o + 15] = 1;
  return len;
}
function solveKnee(hx, hy, hz, fx, fy, fz, a, b, px, py, pz, out) {
  let dx = fx - hx, dy = fy - hy, dz = fz - hz;
  let d = Math.hypot(dx, dy, dz);
  if (d < 1e-6) {
    dx = 0;
    dy = -1;
    dz = 0;
    d = 1e-6;
  } else {
    dx /= d;
    dy /= d;
    dz /= d;
  }
  const dl = clamp$3(d, Math.abs(a - b) + 1e-4, a + b - 1e-4);
  const x = (a * a - b * b + dl * dl) / (2 * dl);
  const y = Math.sqrt(Math.max(0, a * a - x * x));
  const pd = px * dx + py * dy + pz * dz;
  let qx = px - dx * pd, qy = py - dy * pd, qz = pz - dz * pd;
  let ql = Math.hypot(qx, qy, qz);
  if (ql < 1e-6) {
    qx = -dz;
    qy = 0;
    qz = dx;
    ql = Math.hypot(qx, qy, qz) || 1;
  }
  out[0] = hx + dx * x + (qx / ql) * y;
  out[1] = hy + dy * x + (qy / ql) * y;
  out[2] = hz + dz * x + (qz / ql) * y;
  return out;
}

const OC_NS = 32;
const OC_ARMS = 8;
const OC_RINGS = 44;
const OC_RADIAL = 12;
const OC_L = 0.52;
const OC_R0 = 0.0155;
const OC_CROWN_R = 0.017;
const OC_CROWN_Y = 0.004;
const OC_WEB = 0.17;
const OC_ANG = [-150, -106, -62, -20, 20, 62, 106, 150].map((d) => (d * Math.PI) / 180);
const OC_HEAD = { c: [0, 0.04, -4e-3], r: [0.04, 0.034, 0.036] };
const OC_MANTLE = { c: [0, 0.088, -0.1], r: [0.052, 0.045, 0.08], tilt: 0.28 };
const OC_PIVOT = [0, 0.06, -0.03];
const OC_SIPHON = [-0.045, 0.02, -0.013];
const OC_EYE = (() => {
  const d = [0.029, 0.022, 0.01], c = OC_HEAD.c, r = OC_HEAD.r;
  const k = 1 / Math.hypot(d[0] / r[0], d[1] / r[1], d[2] / r[2]);
  const E = [c[0] + d[0] * k, c[1] + d[1] * k, c[2] + d[2] * k];
  const n0 = [(E[0] - c[0]) / (r[0] * r[0]), (E[1] - c[1]) / (r[1] * r[1]), (E[2] - c[2]) / (r[2] * r[2])];
  const l = Math.hypot(n0[0], n0[1], n0[2]);
  const n = [n0[0] / l, n0[1] / l, n0[2] / l];
  return {
    n,
    ball: [E[0] + n[0] * 0.004, E[1] + n[1] * 0.004, E[2] + n[2] * 0.004],
    turret: [E[0] - n[0] * 0.003, E[1] - n[1] * 0.003, E[2] - n[2] * 0.003],
    rBall: 0.0112,
    rTurret: 0.0148,
  };
})();
const ocRadJS = (s) => OC_R0 * (0.1 + 0.9 * Math.pow(Math.max(1 - s, 0), 1.1)) * Math.sqrt(Math.max(0, 1 - sstep$2(0.955, 1, s)));

const OC_VDECL =  `
uniform sampler2D uOcCurve;
uniform mat4 uOcBody;
uniform vec4 uOcArm;
uniform vec4 uOcMantle;
attribute vec4 aOc;
varying vec4 vOcA;
varying vec3 vOcP;
varying vec3 vOcE;
${CR_NOISE}
const float OC_NSF = ${gf(OC_NS)};
const vec3 OC_MC = ${g3(OC_MANTLE.c)};
const vec3 OC_PV = ${g3(OC_PIVOT)};
vec3 ocSafeN(vec3 v, vec3 fb) {
  float l = dot(v, v);
  return l > 1e-14 ? v * inversesqrt(l) : fb;
}
vec4 ocTex(int i, int row) {
  return texelFetch(uOcCurve, ivec2(i, row), 0);
}
void ocCurve(float arm, float u, out vec3 P, out vec3 N, out vec3 B) {
  float fi = clamp(u, 0.0, 1.0) * (OC_NSF - 1.0);
  float fl = min(floor(fi), OC_NSF - 2.0);
  float f = fi - fl;
  int i1 = int(fl);
  int i0 = max(i1 - 1, 0);
  int i2 = i1 + 1;
  int i3 = min(i1 + 2, int(OC_NSF) - 1);
  int r = int(arm + 0.5) * 3;
  vec3 p0 = ocTex(i0, r).xyz;
  vec3 p1 = ocTex(i1, r).xyz;
  vec3 p2 = ocTex(i2, r).xyz;
  vec3 p3 = ocTex(i3, r).xyz;
  float f2 = f * f;
  float f3 = f2 * f;
  P = 0.5 * (2.0 * p1 + (p2 - p0) * f + (2.0 * p0 - 5.0 * p1 + 4.0 * p2 - p3) * f2 + (3.0 * p1 - p0 - 3.0 * p2 + p3) * f3);
  vec3 n = mix(ocTex(i1, r + 1).xyz, ocTex(i2, r + 1).xyz, f);
  vec3 b = mix(ocTex(i1, r + 2).xyz, ocTex(i2, r + 2).xyz, f);
  vec3 T = ocSafeN(cross(b, n), vec3(0.0, 0.0, 1.0));
  N = ocSafeN(cross(T, b), vec3(0.0, 1.0, 0.0));
  B = cross(N, T);
}
float ocRad(float s) {
  return uOcArm.y * (0.1 + 0.9 * pow(max(1.0 - s, 0.0), 1.1)) * sqrt(max(0.0, 1.0 - smoothstep(0.955, 1.0, s)));
}
void ocDeform(vec3 pos, vec3 nrm, out vec3 oP, out vec3 oN) {
  float part = aOc.w;
  if (part < 0.5 || (part > 1.5 && part < 2.5)) {
    vec3 lp = pos;
    vec3 ln = nrm;
    float w = part < 0.5 ? aOc.y : 0.0;
    float br = uOcMantle.y * w;
    lp = OC_MC + (lp - OC_MC) * vec3(1.0 + br, 1.0 + br, 1.0 + br * 0.3);
    float a = uOcMantle.x * w;
    float ca = cos(a);
    float sa = sin(a);
    vec3 q = lp - OC_PV;
    lp = OC_PV + vec3(q.x, q.y * ca - q.z * sa, q.y * sa + q.z * ca);
    ln = vec3(ln.x, ln.y * ca - ln.z * sa, ln.y * sa + ln.z * ca);
    if (part < 0.5) {
      float pap = crNoise3(pos * 110.0);
      lp += ln * (uOcMantle.z * smoothstep(0.62, 0.95, pap) * 0.0032);
    }
    oP = (uOcBody * vec4(lp, 1.0)).xyz;
    oN = ocSafeN(mat3(uOcBody) * ln, vec3(0.0, 1.0, 0.0));
  } else if (part < 1.5) {
    vec3 P;
    vec3 N;
    vec3 B;
    ocCurve(aOc.x, aOc.y, P, N, B);
    float c = cos(aOc.z);
    float sn = sin(aOc.z);
    float bo = sn < 0.0 ? 0.74 : 1.0;
    oP = P + (B * c + N * (sn * bo)) * ocRad(aOc.y);
    oN = ocSafeN(B * (c * bo) + N * sn, N);
  } else {
    float side = aOc.z > 1.5 ? 1.0 : 0.0;
    float v = aOc.z - 2.0 * side;
    vec3 PA;
    vec3 NA;
    vec3 BA;
    vec3 PB;
    vec3 NB;
    vec3 BB;
    ocCurve(aOc.x, aOc.y, PA, NA, BA);
    ocCurve(mod(aOc.x + 1.0, 8.0), aOc.y, PB, NB, BB);
    vec3 nw = ocSafeN(NA + NB, NA);
    float span = distance(PA, PB);
    float sgn = side > 0.5 ? -1.0 : 1.0;
    oP = mix(PA, PB, v) + nw * (sin(3.14159265 * v) * span * 0.05 + sgn * uOcArm.y * 0.1);
    oN = nw * sgn;
  }
}
`;

const OC_VNORMAL =  `
vec3 ocP;
vec3 ocN;
ocDeform(position, objectNormal, ocP, ocN);
objectNormal = ocN;
vOcA = vec4(aOc.w, aOc.y, aOc.z, 0.0);
vOcP = position * 16.0;
vOcE = vec3(0.0);
if (aOc.w > 0.5 && aOc.w < 1.5) {
  float sArm = clamp(aOc.y, 0.0, 1.0);
  vOcA.w = (uOcArm.x / (0.45 * max(uOcArm.y, 1e-4))) * (-log(1.0 - 0.9 * sArm) / 0.9);
  vOcP = vec3(sArm * 8.3 + aOc.x * 7.31, cos(aOc.z) * 0.3, sin(aOc.z) * 0.3);
} else if (aOc.w > 2.5) {
  vOcP = vec3(aOc.y * 8.3 + aOc.x * 7.31, (aOc.z - 2.0 * step(1.5, aOc.z)) * 0.5, 0.0);
} else if (aOc.w > 1.5) {
  vOcA.y = aOc.x;
  vOcE = normalize(position - vec3(aOc.x * ${gf(OC_EYE.ball[0])}, ${gf(OC_EYE.ball[1])}, ${gf(OC_EYE.ball[2])}));
}
`;

const OC_VDEPTH =  `
vec3 ocP;
vec3 ocN;
ocDeform(position, normal, ocP, ocN);
transformed = ocP;
`;

const OC_FDECL =  `
uniform vec4 uOcArm;
uniform vec4 uOcMantle;
uniform vec4 uOcColor;
uniform vec4 uOcGaze;
uniform vec3 uOcUp;
varying vec4 vOcA;
varying vec3 vOcP;
varying vec3 vOcE;
${CR_NOISE}
${CR_BUMP}
`;

const OC_FCOLOR =  `
float ocH = 0.0;
float ocRough = 0.5;
vec3 ocEmi = vec3(0.0);
float ocSigW = fwidth(vOcA.w);
{
  float part = vOcA.x;
  float t = uOcColor.w;
  vec3 p = vOcP;
  float m1 = crFbm3(p * 0.9 + vec3(0.0, 0.0, t * 0.06));
  float m2 = crNoise3(p * 2.1 - vec3(t * 0.045, 0.0, t * 0.03));
  vec2 cw = crCell3(p * 3.1 + vec3(0.0, t * 0.02, 0.0));
  vec2 ch = crCell3(p * 10.0);
  float blotch = 1.0 - smoothstep(0.26, 0.42, m1 + (m2 - 0.5) * 0.25);
  float patchy = smoothstep(0.55, 0.7, m1 + (m2 - 0.5) * 0.2);
  float spots = (1.0 - smoothstep(0.16, 0.26, cw.x)) * step(0.62, cw.y);
  float pulse = 0.5 + 0.5 * sin(t * 1.7 + ch.y * 37.0);
  float speck = 1.0 - smoothstep(0.1 + 0.14 * pulse, 0.24 + 0.14 * pulse, ch.x);
  vec3 relaxed = mix(${gc(0x8e4f35)}, ${gc(0x4a2217)}, blotch * 0.85);
  relaxed = mix(relaxed, ${gc(0xd8b791)}, patchy * 0.7);
  relaxed = mix(relaxed, ${gc(0xf1e7da)}, spots * 0.75);
  relaxed *= 1.0 - speck * 0.32;
  vec3 alarmC = mix(${gc(0x7a1e12)}, ${gc(0x7a1e12)} * 0.45, clamp(blotch * 0.8 + speck * 0.3, 0.0, 1.0));
  vec3 paleC = mix(${gc(0xd9cdbd)}, ${gc(0xd8b791)}, patchy * 0.5) * (1.0 - speck * 0.08);
  vec3 camoC = mix(${gc(0xb89e7a)}, ${gc(0x4a2217)} * 1.3, smoothstep(0.58, 0.74, m2 + blotch * 0.2));
  camoC = mix(camoC, ${gc(0xf1e7da)} * 0.9, spots * 0.4);
  vec3 col = mix(relaxed, camoC, uOcColor.z);
  col = mix(col, alarmC, uOcColor.x);
  col = mix(col, paleC, uOcColor.y);
  float papN = 1.0 - smoothstep(0.0, 0.38, crCell3(p * 5.5).x);
  ocH = papN * uOcMantle.w * 0.0014 * uOcArm.w;
  if (part > 0.5 && part < 1.5) {
    float th = vOcA.z;
    float oral = -sin(th);
    float sA = clamp(vOcA.y, 0.0, 1.0);
    col = mix(col, mix(${gc(0xe2c3ae)}, col, 0.3), smoothstep(0.2, 0.8, oral) * (1.0 - 0.5 * uOcColor.x));
    float sig = vOcA.w;
    float d1 = length(vec2(fract(sig) - 0.5, (th - 4.3726) / 0.45));
    float d2 = length(vec2(fract(sig + 0.5) - 0.5, (th - 5.0518) / 0.45));
    float dS = min(d1, d2);
    float aa = clamp(1.4 - ocSigW * 1.6, 0.0, 1.0);
    float cup = (1.0 - smoothstep(0.3, 0.4, dS)) * aa;
    float pit = (1.0 - smoothstep(0.1, 0.19, dS)) * aa;
    col = mix(col, ${gc(0xf0d8c8)}, cup * 0.85);
    col = mix(col, ${gc(0xf0d8c8)} * 0.5, pit * 0.75);
    float rArm = uOcArm.y * (0.1 + 0.9 * pow(max(1.0 - sA, 0.0), 1.1));
    ocH = ocH * (1.0 - cup) + (cup * 0.9 - pit * 1.3) * rArm * 0.22;
    ocRough = mix(0.5, 0.34, cup);
  } else if (part > 2.5) {
    col = mix(col, col * 1.2 + ${gc(0xd8b791)} * 0.05, 0.6);
    ocRough = 0.46;
  } else if (part > 1.5) {
    float side = vOcA.y;
    vec3 e = normalize(vOcE);
    vec3 nEye = normalize(vec3(side * ${gf(OC_EYE.n[0])}, ${gf(OC_EYE.n[1])}, ${gf(OC_EYE.n[2])}));
    vec3 lk = normalize(uOcGaze.xyz);
    float kk = 0.55 * smoothstep(-0.25, 0.35, dot(lk, nEye));
    vec3 g = normalize(mix(nEye, lk, kk));
    vec3 upE = uOcUp - g * dot(uOcUp, g);
    upE = dot(upE, upE) > 1e-6 ? normalize(upE) : vec3(0.0, 1.0, 0.0);
    vec3 rtE = cross(g, upE);
    vec2 q = vec2(dot(e, rtE), dot(e, upE));
    float cg = dot(e, g);
    float dil = uOcGaze.w;
    float px = abs(q.x) / (0.3 + 0.12 * dil);
    float py = abs(q.y) / (0.07 + 0.1 * dil);
    float pd = pow(pow(px, 3.0) + pow(py, 3.0), 0.33333);
    float pupil = (1.0 - smoothstep(0.82, 1.0, pd)) * step(0.0, cg);
    float ang = atan(q.y, q.x + 1e-5);
    float stri = 0.5 + 0.5 * sin(ang * 31.0 + crNoise3(e * 23.0) * 5.0);
    float irisM = smoothstep(0.35, 0.65, cg);
    vec3 iris = mix(${gc(0x5a3b16)}, ${gc(0xd6a441)}, 0.55 + 0.45 * stri);
    iris = mix(iris, ${gc(0x5a3b16)} * 0.6, (1.0 - smoothstep(0.45, 0.62, cg)) * 0.8);
    iris = mix(iris, ${gc(0xd6a441)} * 1.25, (1.0 - smoothstep(1.0, 1.35, pd)) * 0.5);
    vec3 ecol = mix(col * 0.55, iris, irisM);
    ecol = mix(ecol, vec3(0.006, 0.006, 0.008), pupil);
    col = ecol;
    ocRough = 0.07;
    ocEmi = iris * irisM * (1.0 - pupil) * 0.06;
    ocH = 0.0;
  }
  diffuseColor.rgb = col;
}
`;
const OC_FNORMAL =  `
normal = crPerturb(-vViewPosition, normal, ocH);
`;
const OC_FEMIS =  `
totalEmissiveRadiance += ocEmi;
roughnessFactor = ocRough;
`;

function buildOctopusGeometry() {
  const g = new Geo({ aOc: 4 });
  const H = OC_HEAD, M = OC_MANTLE, E = OC_EYE;
  const cg = Math.cos(M.tilt), sg = Math.sin(M.tilt);
  const axM = [0, sg, -cg];
  const sdf = (x, y, z) => {
    let d = sdEllipsoid(x, y, z, H.c[0], H.c[1], H.c[2], H.r[0], H.r[1], H.r[2]);
    const my = y - M.c[1], mz = z - M.c[2];
    const ly = my * cg + mz * sg, lz = -my * sg + mz * cg;
    d = smin$1(d, sdEllipsoid(x - M.c[0], ly, lz, 0, 0, 0, M.r[0], M.r[1], M.r[2]), 0.024);
    d = smin$1(d, sdEllipsoid(x, y, z, 0, 0.01, 0.004, 0.03, 0.013, 0.03), 0.014);
    for (let s = -1; s <= 1; s += 2) {
      d = smin$1(d, Math.hypot(x - s * E.turret[0], y - E.turret[1], z - E.turret[2]) - E.rTurret, 0.009);
      const bx = s * (E.turret[0] + E.n[0] * 0.004), by = E.turret[1] + E.n[1] * 0.004 + 0.0085, bz = E.turret[2] + E.n[2] * 0.004 - 0.002;
      d = smin$1(d, sdRoundCone(x, y, z, bx, by, bz, bx + s * 0.001, by + 0.0075, bz + 0.0015, 0.0024, 0.0005), 0.003);
    }
    d = smin$1(d, sdRoundCone(x, y, z, -0.03, 0.027, -0.03, OC_SIPHON[0], OC_SIPHON[1], OC_SIPHON[2], 0.0085, 0.0062), 0.006);
    d = Math.max(d, -(Math.hypot(x - (OC_SIPHON[0] - 0.002), y - (OC_SIPHON[1] - 0.001), z - (OC_SIPHON[2] + 0.002)) - 0.0034));
    d += vnoise3$1(x * 70, y * 70, z * 70) * 0.0009 + vnoise3$1(x * 160 + 3.1, y * 160, z * 160) * 0.00035;
    return d;
  };
  surfaceNets$1(g, sdf, [-0.075, -0.016, -0.205], [0.075, 0.155, 0.058], 0.0034, (x, y, z) => {
    const w = sstep$2(0.0, 0.035, (y - OC_PIVOT[1]) * axM[1] + (z - OC_PIVOT[2]) * axM[2]);
    return { aOc: [0, w, 0, 0] };
  });
  for (let s = -1; s <= 1; s += 2) {
    sphere(g, s * E.ball[0], E.ball[1], E.ball[2], E.rBall, E.rBall, E.rBall, 22, 16, () => ({ aOc: [s, 0, 0, 2] }));
  }
  const cols = OC_RADIAL + 1;
  for (let i = 0; i < OC_ARMS; i++) {
    const a = OC_ANG[i];
    const Tx = Math.sin(a), Tz = Math.cos(a);
    const Bx = Math.cos(a), Bz = -Math.sin(a);
    const base = g.count;
    for (let j = 0; j <= OC_RINGS; j++) {
      const s = 1 - Math.pow(1 - j / OC_RINGS, 1.35);
      const cx = Tx * (OC_CROWN_R + s * OC_L), cz = Tz * (OC_CROWN_R + s * OC_L);
      const r = ocRadJS(s);
      for (let k = 0; k <= OC_RADIAL; k++) {
        const th = (k / OC_RADIAL) * TAU$2;
        const c = Math.cos(th), sn = Math.sin(th);
        const bo = sn < 0 ? 0.74 : 1;
        g.v(cx + Bx * c * r, OC_CROWN_Y + sn * bo * r, cz + Bz * c * r, Bx * c * bo, sn, Bz * c * bo, { aOc: [i, s, th, 1] });
      }
    }
    g.grid(base, OC_RINGS + 1, cols, false);
  }
  const NA = 5, NV = 9;
  for (let i = 0; i < OC_ARMS; i++) {
    const a1 = OC_ANG[i], a2 = OC_ANG[(i + 1) % OC_ARMS];
    for (let side = 0; side < 2; side++) {
      const base = g.count;
      const sgn = side ? -1 : 1;
      for (let ia = 0; ia < NA; ia++) {
        for (let iv = 0; iv < NV; iv++) {
          const v = iv / (NV - 1);
          const sw = OC_WEB * (ia / (NA - 1)) * (1 - 0.45 * Math.sin(Math.PI * v));
          const rr = OC_CROWN_R + sw * OC_L;
          const x = lerp$1(Math.sin(a1) * rr, Math.sin(a2) * rr, v), z = lerp$1(Math.cos(a1) * rr, Math.cos(a2) * rr, v);
          g.v(x, OC_CROWN_Y + sgn * 0.001, z, 0, sgn, 0, { aOc: [i, sw, v + 2 * side, 3] });
        }
      }
      g.grid(base, NA, NV, false);
    }
  }
  return g.build(true);
}

function makeOctopus(ctx, geoSrc, den, idx) {
  const W = ctx.W;
  const ground = W.ground;
  const S = den.scale;
  const L = OC_L * S;
  const dsW = L / (OC_NS - 1);
  const rng = placeRng(0x0c7a + idx * 7919);
  const owner = 'octopus' + idx;

  const texData = new Float32Array(OC_NS * OC_ARMS * 3 * 4);
  const tex = new THREE.DataTexture(texData, OC_NS, OC_ARMS * 3, THREE.RGBAFormat, THREE.FloatType);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  const U = {
    uCrTime: ctx.time,
    uOcCurve: { value: tex },
    uOcBody: { value: new THREE.Matrix4() },
    uOcArm: { value: new THREE.Vector4(L, OC_R0 * S, 0, S) },
    uOcMantle: { value: new THREE.Vector4(-0.2, 0, 0.7, 0.7) },
    uOcColor: { value: new THREE.Vector4(0, 0, 0, 0) },
    uOcGaze: { value: new THREE.Vector4(0, 0.3, 0.95, 0.3) },
    uOcUp: { value: new THREE.Vector3(0, 1, 0) },
  };
  const mat = ctx.patch(
    injectLit(
      new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.5, metalness: 0, clearcoat: 0.3, clearcoatRoughness: 0.45, envMapIntensity: 0.6 }),
      { uniforms: U, vDecl: OC_VDECL, vNormal: OC_VNORMAL, vBegin: 'transformed = ocP;', fDecl: OC_FDECL, fColor: OC_FCOLOR, fNormal: OC_FNORMAL, fEmissive: OC_FEMIS },
      'octopus',
    ),
  );
  const depth = depthMaterial(U, OC_VDECL, OC_VDEPTH, 'octopus');
  const geo = new THREE.BufferGeometry();
  for (const k in geoSrc.attributes) geo.setAttribute(k, geoSrc.attributes[k]);
  geo.setIndex(geoSrc.index);
  geo.boundingSphere = new THREE.Sphere(den.crown0.clone(), L + 0.3 * S);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'critter-octopus';
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.customDepthMaterial = depth;
  mesh.matrixAutoUpdate = false;
  ctx.root.add(mesh);
  ctx.disposables.push(geo, mat, depth, tex);

  const A = den.A;
  const Ud = new THREE.Vector3().copy(Y_UP$1).addScaledVector(A, -A.y).normalize();
  const Ah = new THREE.Vector3(A.x, 0, A.z).normalize();
  const Xd = new THREE.Vector3().crossVectors(Ud, A).normalize();
  const qDen = basisQuat(Xd, Ud, A, new THREE.Quaternion());
  const qIn = qDen.clone().multiply(new THREE.Quaternion().setFromAxisAngle(Y_UP$1, Math.PI));
  const sVec = new THREE.Vector3(S, S, S);
  const M0 = new THREE.Matrix4().compose(den.crown0, qDen, sVec);
  const front = den.front;
  ctx.claim(owner, front.x, front.z, 0.6);

  const bodyP = den.crown0.clone(), bodyQ = qDen.clone();
  const bodyM = new THREE.Matrix4().compose(bodyP, bodyQ, sVec);
  const tP = new THREE.Vector3(), tQ = new THREE.Quaternion(), invQ = new THREE.Quaternion();
  const vA = new THREE.Vector3(), vB = new THREE.Vector3(), vC = new THREE.Vector3(), vD = new THREE.Vector3();
  const tX = new THREE.Vector3(), tZ = new THREE.Vector3();
  const Ub = new THREE.Vector3(), Fb = new THREE.Vector3(), Xb = new THREE.Vector3();
  const groundP = new THREE.Vector3(), crawlP = new THREE.Vector3(), enterFrom = new THREE.Vector3(), enterP = new THREE.Vector3();
  const jetP = new THREE.Vector3(), jetV = new THREE.Vector3(), jS = new THREE.Vector3(), jC = new THREE.Vector3(), jE = new THREE.Vector3();
  const landV = new THREE.Vector3();
  const gaze = new THREE.Vector3(0, 0.3, 0.95).normalize();
  const inkEm = { acc: 0 };
  const st = {
    mode: 'den', hide: 0, hideT: 0, panic: false, alarm: 0, alarmT: 0, pale: 0, camo: 0, pap: 0.8,
    clock: rng() * 40, br: rng() * TAU$2, wph: rng() * TAU$2, calm: 10, curious: 0, cool: 1.5, inkT: 0, settle: 0, calmG: 0,
    enterT: 0, jetT: 0, jetDur: 1, recentJet: 0, yaw: 0, omega: 0.9, mantle: -0.2, first: true, snap: false,
  };

  const NP = 8;
  const cur = new Float32Array(OC_ARMS * NP), tgt = new Float32Array(OC_ARMS * NP);
  const Q = new Float32Array(OC_ARMS * OC_NS * 3);
  const PATH = new Float32Array(OC_NS * 3), TG = new Float32Array(OC_NS * 3), TAN = new Float32Array(OC_NS * 3);
  const INS = new Uint8Array(OC_NS);
  const phase = new Float32Array(OC_ARMS), curl = new Float32Array(OC_ARMS);
  for (let i = 0; i < OC_ARMS; i++) {
    phase[i] = rng() * TAU$2;
    curl[i] = (i % 2 ? 1 : -1) * (rng() < 0.8 ? 1 : -1);
  }
  const rootsL = OC_ANG.map((a) => new THREE.Vector3(OC_CROWN_R * Math.sin(a), OC_CROWN_Y, OC_CROWN_R * Math.cos(a)));
  const siphonL = new THREE.Vector3(OC_SIPHON[0], OC_SIPHON[1], OC_SIPHON[2]);
  const headL = new THREE.Vector3(0, 0.05, 0);
  const rootW = new THREE.Vector3(), rootA = new THREE.Vector3();

  function armTargets(t) {
    const al = st.alarm;
    for (let i = 0; i < OC_ARMS; i++) {
      const o = i * NP, a = OC_ANG[i];
      const wander = 0.16 * Math.sin(0.17 * t + 1.3 * i + phase[i]) + 0.08 * Math.sin(0.41 * t + 2.1 * i);
      let hd, dr, pr, amp, tk, lf, rc, gn;
      if (st.mode === 'den') {
        if (i === 0 || i === OC_ARMS - 1) {
          hd = Math.sign(a) * 2.95; dr = 0.05; pr = 0; amp = 0; tk = 2; lf = 0; rc = 1; gn = 0;
        } else {
          hd = a * 0.74 + wander * (1 - al); dr = 0.42; pr = -3.4; amp = lerp$1(2.8, 0.7, al); tk = lerp$1(6.5, 9.5, al); lf = lerp$1(3.5, 6.5, al); rc = lerp$1(0.56, 0.3, Math.max(al, st.hide)); gn = 1;
        }
      } else if (st.mode === 'jet') {
        hd = a * 0.1; dr = 0; pr = 0; amp = 0.9; tk = 1.2; lf = 0; rc = 1; gn = 1;
      } else if (st.mode === 'enter') {
        hd = a * 0.16; dr = 0.1; pr = 0; amp = 0.8; tk = 1.5; lf = 0; rc = 1; gn = 0;
      } else if (st.mode === 'crawl') {
        hd = a * 0.8 + 0.25 * Math.sin(2.6 * t + phase[i]); dr = 0.5; pr = -4; amp = 3.2; tk = 5; lf = 2.5; rc = 0.7; gn = 1;
      } else {
        hd = a * 0.98 + wander * (1 - al); dr = 0.5; pr = -4.2; amp = lerp$1(2.4, 0.5, al); tk = lerp$1(5.5, 11, al); lf = lerp$1(3, 5, al); rc = lerp$1(0.62, 0.22, al); gn = 1;
      }
      tgt[o] = hd; tgt[o + 1] = dr; tgt[o + 2] = pr; tgt[o + 3] = amp;
      tgt[o + 4] = tk; tgt[o + 5] = lf; tgt[o + 6] = rc; tgt[o + 7] = gn;
    }
  }

  const _d = [0, 0, 0];
  function rot(ax, ay, az, ang) {
    if (ang === 0) return;
    const c = Math.cos(ang), s = Math.sin(ang);
    const dx = _d[0], dy = _d[1], dz = _d[2];
    const kd = (ax * dx + ay * dy + az * dz) * (1 - c);
    _d[0] = dx * c + (ay * dz - az * dy) * s + ax * kd;
    _d[1] = dy * c + (az * dx - ax * dz) * s + ay * kd;
    _d[2] = dz * c + (ax * dy - ay * dx) * s + az * kd;
  }
  function turtle(i, rx, ry, rz, Uv, Fv, Xv, t, wall) {
    const o = i * NP;
    const hd = cur[o], dr = cur[o + 1], pr = cur[o + 2] / S, amp = cur[o + 3] / S, tk = cur[o + 4] / S, lf = cur[o + 5] / S, rc = cur[o + 6];
    const gn = cur[o + 7] > 0.5;
    const ch = Math.cos(hd), sh = Math.sin(hd), cd = Math.cos(dr), sd = Math.sin(dr);
    _d[0] = (Fv.x * ch + Xv.x * sh) * cd - Uv.x * sd;
    _d[1] = (Fv.y * ch + Xv.y * sh) * cd - Uv.y * sd;
    _d[2] = (Fv.z * ch + Xv.z * sh) * cd - Uv.z * sd;
    let px = rx, py = ry, pz = rz;
    PATH[0] = px;
    PATH[1] = py;
    PATH[2] = pz;
    const ex = (Math.pow(Math.max(0, Math.sin(0.21 * t + 1.9 * i + phase[i])), 8) * 5) / S;
    for (let j = 1; j < OC_NS; j++) {
      const s = j / (OC_NS - 1);
      const rrel = ocRadJS(s) / OC_R0;
      const tipW = sstep$2(rc, 1, s);
      const kh = amp * Math.sin(TAU$2 * 1.25 * s - st.wph + phase[i]) * (0.3 + 0.7 * s) + (tk * tipW * curl[i]) / Math.max(0.14, rrel);
      const kv = pr * (1 - sstep$2(0, 0.3, s)) + (lf * tipW) / Math.max(0.3, rrel) + ex * Math.exp(-((s - 0.5) * (s - 0.5)) / 0.02);
      rot(Uv.x, Uv.y, Uv.z, kh * dsW);
      let ax = _d[1] * Uv.z - _d[2] * Uv.y, ay = _d[2] * Uv.x - _d[0] * Uv.z, az = _d[0] * Uv.y - _d[1] * Uv.x;
      const al = Math.hypot(ax, ay, az);
      if (al > 1e-5) {
        ax /= al; ay /= al; az /= al;
      } else {
        ax = Xv.x; ay = Xv.y; az = Xv.z;
      }
      rot(ax, ay, az, kv * dsW);
      let nx = px + _d[0] * dsW, ny = py + _d[1] * dsW, nz = pz + _d[2] * dsW;
      const rj = ocRadJS(s) * S;
      let hit = false;
      if (wall) {
        const e = (nx - den.O.x) * A.x + (ny - den.O.y) * A.y + (nz - den.O.z) * A.z - (rj + 0.004);
        if (e < 0) {
          nx -= A.x * e; ny -= A.y * e; nz -= A.z * e;
          hit = true;
        }
      }
      if (gn) {
        const gy = ground.height(nx, nz) + rj * 0.9 + 0.0015;
        if (ny < gy) {
          ny = gy;
          hit = true;
        }
      }
      if (hit) {
        const lx = nx - px, ly = ny - py, lz = nz - pz;
        const ll = Math.hypot(lx, ly, lz);
        if (ll > 1e-7) {
          _d[0] = lx / ll; _d[1] = ly / ll; _d[2] = lz / ll;
        }
      }
      px = nx; py = ny; pz = nz;
      PATH[j * 3] = px;
      PATH[j * 3 + 1] = py;
      PATH[j * 3 + 2] = pz;
    }
  }
  function samplePath(q, j3) {
    const f = clamp$3(q, 0, 1) * (OC_NS - 1);
    const k = Math.min(OC_NS - 2, Math.floor(f));
    const u = f - k, a = k * 3;
    TG[j3] = PATH[a] + (PATH[a + 3] - PATH[a]) * u;
    TG[j3 + 1] = PATH[a + 1] + (PATH[a + 4] - PATH[a + 1]) * u;
    TG[j3 + 2] = PATH[a + 2] + (PATH[a + 5] - PATH[a + 2]) * u;
  }
  function writeFrames(i, qo, Uv, Fv) {
    for (let j = 0; j < OC_NS; j++) {
      const a = qo + Math.max(0, j - 1) * 3, b = qo + Math.min(OC_NS - 1, j + 1) * 3;
      let tx = Q[b] - Q[a], ty = Q[b + 1] - Q[a + 1], tz = Q[b + 2] - Q[a + 2];
      const tl = Math.hypot(tx, ty, tz);
      if (tl < 1e-9) {
        if (j > 0) {
          tx = TAN[(j - 1) * 3]; ty = TAN[(j - 1) * 3 + 1]; tz = TAN[(j - 1) * 3 + 2];
        } else {
          tx = Fv.x; ty = Fv.y; tz = Fv.z;
        }
      } else {
        tx /= tl; ty /= tl; tz /= tl;
      }
      TAN[j * 3] = tx;
      TAN[j * 3 + 1] = ty;
      TAN[j * 3 + 2] = tz;
    }
    let nx = Uv.x, ny = Uv.y, nz = Uv.z;
    for (let j = 0; j < OC_NS; j++) {
      const tx = TAN[j * 3], ty = TAN[j * 3 + 1], tz = TAN[j * 3 + 2];
      const dp = nx * tx + ny * ty + nz * tz;
      let mx = nx - tx * dp, my = ny - ty * dp, mz = nz - tz * dp;
      let ml = Math.hypot(mx, my, mz);
      if (ml < 1e-6) {
        mx = ty * Fv.z - tz * Fv.y; my = tz * Fv.x - tx * Fv.z; mz = tx * Fv.y - ty * Fv.x;
        ml = Math.hypot(mx, my, mz);
        if (ml < 1e-6) {
          mx = -tz; my = 0; mz = tx;
          ml = Math.hypot(mx, my, mz) || 1;
        }
      }
      nx = mx / ml; ny = my / ml; nz = mz / ml;
      const bx = ny * tz - nz * ty, by = nz * tx - nx * tz, bz = nx * ty - ny * tx;
      const r0 = (i * 3 * OC_NS + j) * 4, r1 = ((i * 3 + 1) * OC_NS + j) * 4, r2 = ((i * 3 + 2) * OC_NS + j) * 4;
      const qj = qo + j * 3;
      texData[r0] = Q[qj]; texData[r0 + 1] = Q[qj + 1]; texData[r0 + 2] = Q[qj + 2]; texData[r0 + 3] = 1;
      texData[r1] = nx; texData[r1 + 1] = ny; texData[r1 + 2] = nz; texData[r1 + 3] = 0;
      texData[r2] = bx; texData[r2 + 1] = by; texData[r2 + 2] = bz; texData[r2 + 3] = 0;
    }
  }
  function updateArms(dt, t) {
    armTargets(t);
    const init = st.first || st.snap;
    const kpar = st.mode === 'jet' ? 10 : st.mode === 'enter' ? 5 : 2.4;
    const fp = init ? 1 : expK(kpar, dt);
    for (let k = 0; k < cur.length; k++) cur[k] += (tgt[k] - cur[k]) * fp;
    const denned = st.mode === 'den';
    let Uv, Fv, Xv;
    if (denned) {
      Uv = Ud; Fv = A; Xv = Xd;
    } else {
      Ub.set(0, 1, 0).applyQuaternion(bodyQ);
      Fb.set(0, 0, 1).applyQuaternion(bodyQ);
      Xb.set(1, 0, 0).applyQuaternion(bodyQ);
      Uv = Ub; Fv = Fb; Xv = Xb;
    }
    const reel = denned ? clamp$3((st.hide * den.depth) / L, 0, 1) : 0;
    const jet = st.mode === 'jet';
    const k0 = jet ? 9 : 16, k1 = jet ? 2.5 : 6;
    for (let i = 0; i < OC_ARMS; i++) {
      rootW.copy(rootsL[i]).applyMatrix4(bodyM);
      if (denned) rootA.copy(rootsL[i]).applyMatrix4(M0);
      else rootA.copy(rootW);
      const tucked = denned && (i === 0 || i === OC_ARMS - 1);
      const wall = denned && !tucked;
      turtle(i, rootA.x, rootA.y, rootA.z, Uv, Fv, Xv, t, wall);
      for (let j = 0; j < OC_NS; j++) {
        const q = j / (OC_NS - 1) - reel;
        const j3 = j * 3;
        if (q >= 0) {
          samplePath(q, j3);
          INS[j] = tucked ? 1 : 0;
        } else {
          TG[j3] = rootA.x + A.x * q * L;
          TG[j3 + 1] = rootA.y + A.y * q * L;
          TG[j3 + 2] = rootA.z + A.z * q * L;
          INS[j] = 1;
        }
      }
      const qo = i * OC_NS * 3;
      if (init) for (let k = 0; k < OC_NS * 3; k++) Q[qo + k] = TG[k];
      let px = rootW.x, py = rootW.y, pz = rootW.z;
      Q[qo] = px; Q[qo + 1] = py; Q[qo + 2] = pz;
      let lx = Fv.x, ly = Fv.y, lz = Fv.z;
      for (let j = 1; j < OC_NS; j++) {
        const s = j / (OC_NS - 1);
        const k = init ? 1 : expK(lerp$1(k0, k1, s), dt);
        const o3 = qo + j * 3, j3 = j * 3;
        const qx = Q[o3] + (TG[j3] - Q[o3]) * k, qy = Q[o3 + 1] + (TG[j3 + 1] - Q[o3 + 1]) * k, qz = Q[o3 + 2] + (TG[j3 + 2] - Q[o3 + 2]) * k;
        let dx = qx - px, dy = qy - py, dz = qz - pz;
        const dl = Math.hypot(dx, dy, dz);
        if (dl < 1e-7) {
          dx = lx; dy = ly; dz = lz;
        } else {
          dx /= dl; dy /= dl; dz /= dl;
        }
        let nx = px + dx * dsW, ny = py + dy * dsW, nz = pz + dz * dsW;
        if (!INS[j]) {
          const rj = ocRadJS(s) * S;
          if (wall) {
            const e = (nx - den.O.x) * A.x + (ny - den.O.y) * A.y + (nz - den.O.z) * A.z - (rj + 0.004);
            if (e < 0) {
              nx -= A.x * e; ny -= A.y * e; nz -= A.z * e;
            }
          }
          const gy = ground.height(nx, nz) + rj * 0.9 + 0.0015;
          if (ny < gy) ny = gy;
        }
        Q[o3] = nx; Q[o3 + 1] = ny; Q[o3 + 2] = nz;
        lx = dx; ly = dy; lz = dz;
        px = nx; py = ny; pz = nz;
      }
      writeFrames(i, qo, Uv, Fv);
    }
    tex.needsUpdate = true;
  }

  const LAND_A = [0, 0.45, -0.45, 0.9, -0.9, 1.35, -1.35];
  const LAND_D = [3.5, 2.8, 4.2];
  function findLanding(fx, fz, dx, dz, skip) {
    for (let a = 0; a < LAND_D.length; a++) {
      for (let b = 0; b < LAND_A.length; b++) {
        const c = Math.cos(LAND_A[b]), s = Math.sin(LAND_A[b]);
        const ex = dx * c - dz * s, ez = dx * s + dz * c;
        const x = fx + ex * LAND_D[a], z = fz + ez * LAND_D[a];
        if (!W.sandOK(x, z, 0.5)) continue;
        if (!W.pathClear(fx, fz, x, z, 0.3, skip)) continue;
        if (!ctx.free(x, z, 0.6, owner)) continue;
        return landV.set(x, ground.height(x, z), z);
      }
    }
    return null;
  }
  const siphonW = (out) => out.copy(siphonL).applyMatrix4(bodyM);
  function startJet(land, fromDen) {
    st.mode = 'jet';
    jS.copy(bodyP);
    jE.set(land.x, land.y + 0.012 * S, land.z);
    const dd = jS.distanceTo(jE);
    if (fromDen) jC.copy(den.O).addScaledVector(A, 0.55 * S + 0.25).addScaledVector(Y_UP$1, 0.18);
    else {
      jC.lerpVectors(jS, jE, 0.5);
      jC.y += 0.3 + 0.08 * dd;
    }
    st.jetT = 0;
    st.jetDur = 0.5 + dd / 3.3;
    st.cool = 3.5;
    st.inkT = 0.35;
    st.recentJet = 1;
    st.hide = 0;
    st.hideT = 0;
    st.panic = false;
    st.alarmT = 0.5;
    vA.subVectors(jE, jS).normalize();
    siphonW(vB);
    ctx.ink.burst(vB.x, vB.y, vB.z, -vA.x, 0.15 - vA.y, -vA.z, 18, 0.9);
    ctx.claim(owner, jE.x, jE.z, 0.7);
  }
  function jetEval(u) {
    const e = 1 - Math.pow(1 - u, 2.2);
    const a = (1 - e) * (1 - e), b = 2 * e * (1 - e), c = e * e;
    jetP.set(jS.x * a + jC.x * b + jE.x * c, jS.y * a + jC.y * b + jE.y * c, jS.z * a + jC.z * b + jE.z * c);
    jetV.set(
      2 * (1 - e) * (jC.x - jS.x) + 2 * e * (jE.x - jC.x),
      2 * (1 - e) * (jC.y - jS.y) + 2 * e * (jE.y - jC.y),
      2 * (1 - e) * (jC.z - jS.z) + 2 * e * (jE.z - jC.z),
    );
  }
  function modeDen(dt, dist, pl) {
    if (dist < 1.6 && st.cool <= 0) {
      vA.set(den.O.x - pl.p.x, 0, den.O.z - pl.p.z);
      if (vA.lengthSq() < 1e-6) vA.copy(Ah);
      vA.normalize();
      if (st.hide < 0.55 && vA.dot(Ah) > 0.15) {
        const land = findLanding(den.O.x, den.O.z, vA.x, vA.z, 0.8);
        if (land) {
          startJet(land, true);
          return;
        }
      }
      ctx.ink.burst(den.O.x + A.x * 0.07, den.O.y + A.y * 0.07 + 0.02, den.O.z + A.z * 0.07, A.x, A.y + 0.25, A.z, 16, 0.55);
      st.panic = true;
      st.cool = 6;
      st.hideT = 1;
      st.calm = 0;
      st.alarmT = 1;
      st.curious = 0;
    }
    const still = pl.has && pl.speed < 0.35;
    st.calm = dist > 5 ? st.calm + dt : 0;
    st.curious = still && dist > 2.2 && dist < 5.5 ? st.curious + dt : Math.max(0, st.curious - dt * 2);
    const peek = st.curious > 3 && !st.panic;
    if (dist < 4.0) {
      st.hideT = peek ? 0.35 : 1;
      st.alarmT = peek ? 0.4 : 1;
    } else if (st.calm > 2) {
      st.hideT = 0;
      st.alarmT = 0;
      if (st.cool <= 0) st.panic = false;
    }
    const rate = st.hideT > st.hide ? (st.panic ? 2.8 : 0.55) : 0.22;
    st.hide = approach(st.hide, st.hideT, rate * dt);
  }
  function modeJet(dt) {
    st.jetT += dt / st.jetDur;
    const u = Math.min(1, st.jetT);
    jetEval(u);
    if (st.inkT > 0) {
      st.inkT -= dt;
      siphonW(vB);
      vA.copy(jetV);
      if (vA.lengthSq() > 1e-10) vA.normalize();
      ctx.ink.trail(inkEm, vB.x, vB.y, vB.z, -vA.x, -vA.y, -vA.z, dt, 55);
    }
    if (u >= 1) {
      st.mode = 'ground';
      groundP.set(jE.x, ground.height(jE.x, jE.z), jE.z);
      st.settle = 0;
      st.calmG = 0;
      st.yaw = Math.atan2(-jetV.x, -jetV.z);
    }
  }
  function modeGround(dt, dist, pl) {
    st.settle += dt;
    if (dist < 1.6 && st.cool <= 0) {
      vA.set(bodyP.x - pl.p.x, 0, bodyP.z - pl.p.z);
      if (vA.lengthSq() < 1e-6) vA.set(1, 0, 0);
      vA.normalize();
      vB.set(front.x - bodyP.x, 0, front.z - bodyP.z);
      if (vB.lengthSq() > 1e-4) {
        vB.normalize();
        if (vB.dot(vA) > 0.2) vA.lerp(vB, 0.5).normalize();
      }
      const land = findLanding(bodyP.x, bodyP.z, vA.x, vA.z, 0);
      if (land) {
        startJet(land, false);
        return;
      }
      siphonW(vB);
      ctx.ink.burst(vB.x, vB.y, vB.z, -vA.x, 0.2, -vA.z, 12, 0.5);
      st.cool = 5;
    }
    if (dist < 4) st.alarmT = 1;
    else if (dist > 5.5) st.alarmT = 0.15;
    if (pl.has && dist < 12) {
      const ty = Math.atan2(pl.p.x - bodyP.x, pl.p.z - bodyP.z);
      st.yaw += clamp$3(wrapPi(ty - st.yaw), -1.2 * dt, 1.2 * dt);
    }
    st.calmG = dist > 6 && st.settle > 5 ? st.calmG + dt : 0;
    if (st.calmG > 4) {
      st.mode = 'crawl';
      crawlP.copy(groundP);
    }
  }
  function modeCrawl(dt, dist) {
    if (dist < 4) {
      st.mode = 'ground';
      groundP.copy(crawlP);
      st.settle = 2.5;
      st.calmG = 0;
      return;
    }
    vA.set(front.x - crawlP.x, 0, front.z - crawlP.z);
    const d = vA.length();
    if (d < 0.06) {
      st.mode = 'enter';
      st.enterT = 0;
      enterFrom.copy(bodyP);
      return;
    }
    vA.multiplyScalar(1 / d);
    const step = Math.min(d, 0.2 * Math.sqrt(S) * dt);
    crawlP.x += vA.x * step;
    crawlP.z += vA.z * step;
    crawlP.y = ground.height(crawlP.x, crawlP.z);
    st.yaw += clamp$3(wrapPi(Math.atan2(vA.x, vA.z) - st.yaw), -2 * dt, 2 * dt);
    st.alarmT = 0.1;
  }
  function modeEnter(dt, dist) {
    st.enterT += dt * (dist < 1.8 ? 2.5 : 1);
    const u = clamp$3(st.enterT / 2.4, 0, 1);
    enterP.lerpVectors(enterFrom, den.crown0, sstep$2(0, 0.5, u)).addScaledVector(A, -den.depth * 1.1 * sstep$2(0.5, 1, u));
    st.alarmT = 0.2;
    if (u >= 1) {
      st.mode = 'den';
      st.hide = 1;
      st.hideT = 1;
      st.calm = 0;
      st.panic = false;
      st.curious = 0;
      st.snap = true;
    }
  }
  function updateBody(dt) {
    let kP = 8, kQ = 5, mT = 0.3;
    if (st.mode === 'den') {
      tP.copy(den.crown0).addScaledVector(A, -st.hide * den.depth);
      tQ.copy(qDen);
      kP = 10; kQ = 6; mT = den.kind === 'amphora' ? -0.3 : -0.2;
    } else if (st.mode === 'jet') {
      tP.copy(jetP);
      vC.copy(jetV);
      if (vC.lengthSq() > 1e-10) {
        vC.normalize().negate();
        aimQuat(vC, Y_UP$1, tQ, tX, tZ);
      } else tQ.copy(bodyQ);
      kP = 60; kQ = 9; mT = -0.3;
    } else if (st.mode === 'enter') {
      tP.copy(enterP);
      tQ.copy(qIn);
      kP = 10; kQ = 4; mT = -0.25;
    } else {
      const src = st.mode === 'crawl' ? crawlP : groundP;
      tP.copy(src);
      tP.y = ground.height(src.x, src.z) + 0.012 * S;
      ground.normal(src.x, src.z, vD);
      vD.lerp(Y_UP$1, 0.4).normalize();
      vC.set(Math.sin(st.yaw), 0, Math.cos(st.yaw));
      lookQuat(vC, vD, tQ, tX, tZ);
      if (st.mode === 'crawl') {
        kP = 12; kQ = 3; mT = 0.2;
      } else {
        kP = 5; kQ = 2.2; mT = lerp$1(0.35, -0.05, st.alarm);
      }
    }
    if (st.first || st.snap) {
      bodyP.copy(tP);
      bodyQ.copy(tQ);
      st.mantle = mT;
    } else {
      bodyP.lerp(tP, expK(kP, dt));
      bodyQ.slerp(tQ, expK(kQ, dt));
      st.mantle += (mT - st.mantle) * expK(2.5, dt);
    }
    bodyM.compose(bodyP, bodyQ, sVec);
  }
  function updateColors(dt) {
    const aT = st.alarmT;
    st.alarm += (aT - st.alarm) * expK(aT > st.alarm ? 2.2 : 0.5, dt);
    const paleT = st.mode === 'jet' ? 1 : 0;
    st.pale += (paleT - st.pale) * expK(paleT > st.pale ? 7 : 0.7, dt);
    const camoT = st.mode === 'ground' || st.mode === 'crawl' ? 0.85 : 0;
    st.camo += (camoT - st.camo) * expK(0.45, dt);
    const papT = st.mode === 'jet' || st.mode === 'enter' ? 0 : st.mode === 'crawl' ? 0.35 : st.mode === 'ground' ? 1 - 0.6 * st.alarm : 0.85 - 0.5 * st.alarm;
    st.pap += (papT - st.pap) * expK(1.6, dt);
    st.clock += dt * (0.6 + 1.8 * st.alarm);
    st.br += (dt * TAU$2) / (2.7 - 1.3 * st.alarm);
    st.recentJet = Math.max(0, st.recentJet - dt * 0.15);
    const omT = st.mode === 'jet' ? 6 : st.mode === 'crawl' ? 3 : st.mode === 'enter' ? 2.2 : st.mode === 'ground' ? 0.8 : 0.9;
    st.omega += (omT - st.omega) * expK(2, dt);
    st.wph += st.omega * dt;
  }
  function updateLook(dt, t, pl) {
    vC.copy(headL).applyMatrix4(bodyM);
    invQ.copy(bodyQ).invert();
    if (pl.has && pl.p.distanceTo(vC) < 9) vA.subVectors(pl.p, vC).applyQuaternion(invQ);
    else vA.set(0.55 * Math.sin(t * 0.21 + idx * 2.0), 0.35, 1);
    if (vA.lengthSq() < 1e-8) vA.set(0, 0.3, 1);
    vA.normalize();
    gaze.lerp(vA, st.first ? 1 : expK(3, dt));
    if (gaze.lengthSq() < 1e-8) gaze.set(0, 0.3, 1);
    gaze.normalize();
    U.uOcGaze.value.set(gaze.x, gaze.y, gaze.z, 0.25 + 0.5 * st.alarm);
    U.uOcUp.value.copy(Y_UP$1).applyQuaternion(invQ);
  }

  function update(dt, t, pl) {
    const ref = st.mode === 'den' ? den.O : bodyP;
    const dist = pl.has ? pl.p.distanceTo(ref) : 1e4;
    st.cool = Math.max(0, st.cool - dt);
    if (st.mode === 'den') modeDen(dt, dist, pl);
    else if (st.mode === 'jet') modeJet(dt);
    else if (st.mode === 'ground') modeGround(dt, dist, pl);
    else if (st.mode === 'crawl') modeCrawl(dt, dist);
    else if (st.mode === 'enter') modeEnter(dt, dist);
    updateColors(dt);
    updateBody(dt);
    updateArms(dt, t);
    updateLook(dt, t, pl);
    const breath = (0.028 + 0.03 * st.alarm + 0.05 * st.recentJet) * Math.sin(st.br);
    U.uOcBody.value.copy(bodyM);
    U.uOcMantle.value.set(st.mantle, breath, st.pap, st.pap);
    U.uOcColor.value.set(st.alarm, st.pale, st.camo, st.clock);
    geo.boundingSphere.center.copy(bodyP);
    if (st.mode !== 'den') {
      const hgt = bodyP.y - ground.height(bodyP.x, bodyP.z);
      const k = clamp$3(1 - hgt / 0.8, 0, 1);
      const r = 0.26 * S * (1 + hgt);
      if (k > 0.02) ctx.shadows.add(bodyP.x, bodyP.z, r, r, st.yaw, 0.5 * k);
    }
    st.first = false;
    st.snap = false;
  }
  return {
    kind: 'octopus',
    update,
    info: () => ({ kind: 'octopus', den: den.kind, mode: st.mode, hide: +st.hide.toFixed(2), x: +bodyP.x.toFixed(2), y: +bodyP.y.toFixed(2), z: +bodyP.z.toFixed(2) }),
    arrays: () => [texData],
  };
}

const MO_NS = 40;
const MO_LEN = 1.0;
const MO_HEAD = 0.13;
const MO_SC = 0.078;
const MO_UP = 20;
const MO_LO = 12;
function moProfile(s) {
  const u = clamp$3(s / MO_HEAD, 0, 1);
  const f = s < MO_HEAD ? Math.sqrt(u) * (0.94 + 0.06 * u) : 1;
  const tail = sstep$2(0.55, 1.0, s);
  const hump = 1 + 0.07 * Math.exp(-(((s - 0.17) / 0.05) ** 2));
  return [0.0235 * f * (1 - 0.45 * tail) + 0.0004, 0.0355 * f * hump * (1 - 0.3 * tail) + 0.0004, -4e-3 * (1 - sstep$2(0, 0.1, s))];
}
const moFin = (s) => 0.008 * sstep$2(0.1, 0.22, s) * (1 - 0.3 * sstep$2(0.6, 1.0, s));
function moPoint(s, phi, out) {
  const pr = moProfile(s);
  const sp = Math.sin(phi), cp = Math.cos(phi);
  const cr = sp > 0.72 ? Math.pow((sp - 0.72) / 0.28, 1.6) : 0;
  out[0] = pr[0] * cp * (1 - 0.55 * cr * sstep$2(0.1, 0.22, s));
  out[1] = pr[2] + pr[1] * sp + moFin(s) * cr;
  out[2] = s;
  return out;
}
const moLipY = (s) => {
  const pr = moProfile(s);
  return pr[2] - 0.12 * pr[1];
};
const MO_EYE = (() => {
  const pr = moProfile(0.042);
  return [pr[0] * 0.8, pr[2] + pr[1] * 0.5, 0.042];
})();
const MO_HINGE = [MO_SC, moLipY(MO_SC)];
const _mA = [0, 0, 0], _mB = [0, 0, 0], _mC = [0, 0, 0], _mD = [0, 0, 0];
function moNormal(s, phi, out) {
  const es = 2e-4, ep = 2e-3;
  moPoint(s + es, phi, _mA);
  moPoint(Math.max(0, s - es), phi, _mB);
  moPoint(s, phi + ep, _mC);
  moPoint(s, phi - ep, _mD);
  const sx = _mA[0] - _mB[0], sy = _mA[1] - _mB[1], sz = _mA[2] - _mB[2];
  const px = _mC[0] - _mD[0], py = _mC[1] - _mD[1], pz = _mC[2] - _mD[2];
  let nx = py * sz - pz * sy, ny = pz * sx - px * sz, nz = px * sy - py * sx;
  const yc = moProfile(s)[2];
  moPoint(s, phi, _mA);
  if (nx * _mA[0] + ny * (_mA[1] - yc) < 0) {
    nx = -nx; ny = -ny; nz = -nz;
  }
  const l = Math.hypot(nx, ny, nz) || 1;
  out[0] = nx / l;
  out[1] = ny / l;
  out[2] = nz / l;
  return out;
}

function buildMorayGeometry() {
  const g = new Geo({ aMo: 4 });
  const NR = 72;
  const phiR = Math.asin(-0.12), phiL = Math.PI - phiR;
  const xLip = Math.cos(phiR);
  const upPhi = [], loPhi = [];
  for (let k = 0; k <= MO_UP; k++) upPhi.push(phiR + ((phiL - phiR) * k) / MO_UP);
  for (let k = 0; k <= MO_LO; k++) loPhi.push(phiL + ((phiR + TAU$2 - phiL) * k) / MO_LO);
  const fullPhi = upPhi.concat(loPhi.slice(1, MO_LO));
  const FULL = fullPhi.length;
  const P = [0, 0, 0], N = [0, 0, 0];
  const jawW = (s) => 1 - 0.5 * sstep$2(MO_SC - 0.02, MO_SC, s);
  const throatW = (s, phi) => sstep$2(0.04, 0.09, s) * (1 - sstep$2(0.15, 0.24, s)) * Math.pow(Math.max(0, -Math.sin(phi)), 1.5);
  const put = (s, phi, jw, tw) => {
    moPoint(s, phi, P);
    moNormal(s, phi, N);
    return g.v(P[0], P[1], P[2], N[0], N[1], N[2], { aMo: [jw, tw, 0, 0] });
  };
  const rings = [];
  for (let k = 1; k <= NR; k++) {
    const s = MO_LEN * Math.pow(k / NR, 1.6);
    const r = { s, split: s < MO_SC };
    if (r.split) {
      r.up = g.count;
      for (const phi of upPhi) put(s, phi, 0, 0);
      r.lo = g.count;
      const jw = jawW(s);
      for (const phi of loPhi) put(s, phi, jw, throatW(s, phi));
    } else {
      r.full = g.count;
      for (const phi of fullPhi) put(s, phi, 0.5 * (1 - sstep$2(MO_SC, MO_SC + 0.035, s)) * sstep$2(-0.1, -0.5, Math.sin(phi)), throatW(s, phi));
    }
    rings.push(r);
  }
  const tipU = g.v(0, moLipY(0) + 0.0006, 0, 0, 0.3, -1, { aMo: [0, 0, 0, 0] });
  const tipL = g.v(0, moLipY(0) - 0.0006, 0, 0, -0.3, -1, { aMo: [1, 0, 0, 0] });
  for (let k = 0; k < MO_UP; k++) g.tri(tipU, rings[0].up + k, rings[0].up + k + 1);
  for (let k = 0; k < MO_LO; k++) g.tri(tipL, rings[0].lo + k, rings[0].lo + k + 1);
  const loToFull = (j) => (j === 0 ? MO_UP : j === MO_LO ? 0 : MO_UP + j);
  for (let k = 0; k < rings.length - 1; k++) {
    const a = rings[k], b = rings[k + 1];
    if (a.split && b.split) {
      for (let j = 0; j < MO_UP; j++) g.quad(a.up + j, b.up + j, b.up + j + 1, a.up + j + 1);
      for (let j = 0; j < MO_LO; j++) g.quad(a.lo + j, b.lo + j, b.lo + j + 1, a.lo + j + 1);
    } else if (a.split) {
      for (let j = 0; j < MO_UP; j++) g.quad(a.up + j, b.full + j, b.full + j + 1, a.up + j + 1);
      for (let j = 0; j < MO_LO; j++) g.quad(a.lo + j, b.full + loToFull(j), b.full + loToFull(j + 1), a.lo + j + 1);
    } else {
      for (let j = 0; j < FULL; j++) {
        const j1 = (j + 1) % FULL;
        g.quad(a.full + j, b.full + j, b.full + j1, a.full + j1);
      }
    }
  }
  const last = rings[rings.length - 1];
  const tail = g.v(0, moProfile(MO_LEN)[2], MO_LEN + 0.004, 0, 0, 1, { aMo: [0, 0, 0, 0] });
  for (let j = 0; j < FULL; j++) g.tri(last.full + j, last.full + ((j + 1) % FULL), tail);

  const NX = 7;
  const pal = [], flo = [];
  for (const r of rings) {
    if (!r.split || r.s < 0.0025) continue;
    const s = r.s;
    const pr = moProfile(s);
    const yl = pr[2] - 0.12 * pr[1], xl = pr[0] * xLip;
    const ramp = sstep$2(0.0, 0.03, s);
    const jw = jawW(s);
    const a = g.count;
    for (let i = 0; i < NX; i++) {
      const u = -1 + (2 * i) / (NX - 1);
      g.v(xl * u, yl + 0.42 * pr[1] * (1 - u * u) * ramp, s, 0, -1, 0, { aMo: [0, 0, 3, 0] });
    }
    const b = g.count;
    for (let i = 0; i < NX; i++) {
      const u = -1 + (2 * i) / (NX - 1);
      g.v(xl * u, yl - 0.3 * pr[1] * (1 - u * u) * ramp, s, 0, 1, 0, { aMo: [jw, 0, 3, 0] });
    }
    pal.push(a);
    flo.push(b);
  }
  for (let k = 0; k < pal.length - 1; k++) {
    for (let i = 0; i < NX - 1; i++) {
      g.quad(pal[k] + i, pal[k + 1] + i, pal[k + 1] + i + 1, pal[k] + i + 1);
      g.quad(flo[k] + i, flo[k + 1] + i, flo[k + 1] + i + 1, flo[k] + i + 1);
    }
  }
  if (pal.length) {
    const kp = pal[pal.length - 1], kf = flo[flo.length - 1];
    const wa = g.count;
    for (let i = 0; i < NX; i++) {
      const q = (kp + i) * 3;
      g.v(g.p[q], g.p[q + 1], g.p[q + 2], 0, 0, -1, { aMo: [0, 0, 3, 0] });
    }
    const wb = g.count;
    for (let i = 0; i < NX; i++) {
      const q = (kf + i) * 3;
      g.v(g.p[q], g.p[q + 1], g.p[q + 2], 0, 0, -1, { aMo: [jawW(g.p[q + 2]), 0, 3, 0] });
    }
    for (let i = 0; i < NX - 1; i++) g.quad(wa + i, wb + i, wb + i + 1, wa + i + 1);
  }

  const tooth = (bx, by, bz, dx, dy, dz, len, rad, jw) => {
    const dl = Math.hypot(dx, dy, dz);
    dx /= dl; dy /= dl; dz /= dl;
    let ux = -dz, uy = 0, uz = dx;
    let ul = Math.hypot(ux, uy, uz);
    if (ul < 1e-4) {
      ux = 1; uy = 0; uz = 0; ul = 1;
    }
    ux /= ul; uy /= ul; uz /= ul;
    const vx = dy * uz - dz * uy, vy = dz * ux - dx * uz, vz = dx * uy - dy * ux;
    const base = g.count;
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * TAU$2, c = Math.cos(a), s = Math.sin(a);
      const ox = ux * c + vx * s, oy = uy * c + vy * s, oz = uz * c + vz * s;
      g.v(bx + ox * rad, by + oy * rad, bz + oz * rad, ox + dx * 0.3, oy + dy * 0.3, oz + dz * 0.3, { aMo: [jw, 0, 2, 0] });
    }
    const tip = g.v(bx + dx * len, by + dy * len, bz + dz * len, dx, dy, dz, { aMo: [jw, 0, 2, 0] });
    for (let k = 0; k < 4; k++) g.tri(base + k, base + ((k + 1) % 4), tip);
  };
  for (let sx = -1; sx <= 1; sx += 2) {
    for (let i = 0; i < 9; i++) {
      const s = 0.006 + i * 0.0072;
      const pr = moProfile(s);
      const yl = pr[2] - 0.12 * pr[1], xl = pr[0] * xLip;
      const len = i < 2 ? 0.0062 : 0.0046 - i * 0.00015;
      tooth(sx * xl * 0.8, yl + 0.0012, s, -sx * 0.25, -1, 0.35, len, 0.00085, 0);
      if (i < 8) {
        const s2 = s + 0.0035;
        const p2 = moProfile(s2);
        tooth(sx * p2[0] * xLip * 0.78, p2[2] - 0.12 * p2[1] - 0.0012, s2, -sx * 0.25, 1, 0.3, len * 0.85, 0.0008, jawW(s2));
      }
    }
    const pv = moProfile(0.014);
    tooth(sx * 0.0017, pv[2] - 0.12 * pv[1] + 0.3 * pv[1], 0.014, 0, -1, 0.3, 0.0085, 0.0011, 0);
  }
  for (let sx = -1; sx <= 1; sx += 2) sphere(g, sx * MO_EYE[0], MO_EYE[1], MO_EYE[2], 0.0058, 0.0058, 0.0058, 14, 10, () => ({ aMo: [0, 0, 1, 0] }));
  const nostril = (bx, by, bz, dx, dy, dz, len, r0, r1) => {
    const dl = Math.hypot(dx, dy, dz);
    const pts = [], radii = [];
    for (let i = 0; i <= 4; i++) {
      const t = i / 4;
      pts.push([bx + (dx / dl) * len * t, by + (dy / dl) * len * t, bz + (dz / dl) * len * t]);
      radii.push(lerp$1(r0, r1, t));
    }
    tube(g, pts, radii, 7, () => ({ aMo: [0, 0, 4, 0] }), { capEnd: true, capLen: 0.2, capEx: { aMo: [0, 0, 4, 1] } });
  };
  for (let sx = -1; sx <= 1; sx += 2) {
    const a = moProfile(0.007);
    nostril(sx * a[0] * 0.55, a[2] + a[1] * 0.55, 0.007, sx * 0.35, 0.25, -1, 0.011, 0.0019, 0.0015);
    const b = moProfile(0.031);
    nostril(sx * b[0] * 0.45, b[2] + b[1] * 0.8, 0.031, sx * 0.25, 1, -0.25, 0.0055, 0.0017, 0.0014);
  }
  return g.build(true);
}

const MO_VDECL =  `
uniform sampler2D uMoCurve;
uniform vec4 uMoJaw;
uniform vec4 uMoInfo;
attribute vec4 aMo;
varying vec3 vMoR;
varying vec4 vMoA;
const float MO_NSF = ${gf(MO_NS)};
vec3 moSafeN(vec3 v, vec3 fb) {
  float l = dot(v, v);
  return l > 1e-14 ? v * inversesqrt(l) : fb;
}
vec4 moTex(int i, int row) {
  return texelFetch(uMoCurve, ivec2(i, row), 0);
}
void moCurve(float sw, out vec3 P, out vec3 N, out vec3 B) {
  float fi = clamp(sw / max(uMoInfo.z, 1e-3), 0.0, 1.0) * (MO_NSF - 1.0);
  float fl = min(floor(fi), MO_NSF - 2.0);
  float f = fi - fl;
  int i1 = int(fl);
  int i0 = max(i1 - 1, 0);
  int i2 = i1 + 1;
  int i3 = min(i1 + 2, int(MO_NSF) - 1);
  vec3 p0 = moTex(i0, 0).xyz;
  vec3 p1 = moTex(i1, 0).xyz;
  vec3 p2 = moTex(i2, 0).xyz;
  vec3 p3 = moTex(i3, 0).xyz;
  float f2 = f * f;
  float f3 = f2 * f;
  P = 0.5 * (2.0 * p1 + (p2 - p0) * f + (2.0 * p0 - 5.0 * p1 + 4.0 * p2 - p3) * f2 + (3.0 * p1 - p0 - 3.0 * p2 + p3) * f3);
  vec3 n = mix(moTex(i1, 1).xyz, moTex(i2, 1).xyz, f);
  vec3 b = mix(moTex(i1, 2).xyz, moTex(i2, 2).xyz, f);
  vec3 T = moSafeN(cross(b, n), vec3(0.0, 0.0, 1.0));
  N = moSafeN(cross(T, b), vec3(0.0, 1.0, 0.0));
  B = cross(N, T);
}
void moDeform(vec3 pos, vec3 nrm, out vec3 oP, out vec3 oN) {
  vec3 rp = pos;
  vec3 rn = nrm;
  float a = uMoJaw.x * aMo.x;
  float ca = cos(a);
  float sa = sin(a);
  float dz = rp.z - uMoJaw.z;
  float dy = rp.y - uMoJaw.w;
  rp.z = uMoJaw.z + dz * ca - dy * sa;
  rp.y = uMoJaw.w + dz * sa + dy * ca;
  rn = vec3(rn.x, rn.z * sa + rn.y * ca, rn.z * ca - rn.y * sa);
  rp.y -= aMo.y * uMoJaw.y;
  float sc = uMoInfo.x;
  vec3 P;
  vec3 N;
  vec3 B;
  moCurve(rp.z * sc, P, N, B);
  vec3 T = cross(B, N);
  oP = P + (B * rp.x + N * rp.y) * sc;
  oN = moSafeN(B * rn.x + N * rn.y + T * rn.z, N);
}
`;
const MO_VNORMAL =  `
vec3 moP;
vec3 moN;
moDeform(position, objectNormal, moP, moN);
objectNormal = moN;
vMoR = position;
vMoA = aMo;
`;
const MO_VDEPTH =  `
vec3 moP;
vec3 moN;
moDeform(position, normal, moP, moN);
transformed = moP;
`;
const MO_FDECL =  `
uniform vec4 uMoInfo;
varying vec3 vMoR;
varying vec4 vMoA;
${CR_NOISE}
${CR_BUMP}
`;
const MO_FCOLOR =  `
float moH = 0.0;
float moRough = 0.42;
vec3 moEmi = vec3(0.0);
{
  vec3 r = vMoR;
  float part = vMoA.z;
  float s = r.z;
  float n1 = crFbm3(r * vec3(26.0, 26.0, 13.0));
  vec3 col = mix(${gc(0x2b1b14)}, ${gc(0x4d3222)}, smoothstep(0.35, 0.75, n1));
  col = mix(col, ${gc(0x5d4838)}, (1.0 - smoothstep(-0.03, 0.0, r.y)) * 0.3);
  float fq = mix(95.0, 42.0, smoothstep(0.03, 0.3, s));
  vec2 c = crCell3(vec3(r.x * 1.25, r.y, s) * fq);
  float rad = 0.28 + 0.14 * c.y;
  float spot = 1.0 - smoothstep(rad - 0.08, rad, c.x);
  float ctr = (1.0 - smoothstep(rad * 0.35 - 0.05, rad * 0.35, c.x)) * step(0.55, c.y) * smoothstep(0.2, 0.4, s);
  col = mix(col, mix(${gc(0xe6cf86)}, ${gc(0xf4e8c4)}, c.y), spot * 0.95);
  col = mix(col, ${gc(0x2b1b14)}, ctr * 0.8);
  float gill = 1.0 - smoothstep(0.0035, 0.0055, length(vec2(s - 0.152, r.y + 0.004)));
  col = mix(col, vec3(0.012, 0.01, 0.01), gill * step(0.012, abs(r.x)));
  moH = (crNoise3(r * 220.0) - 0.5) * 0.0005 + spot * 0.0003;
  if (part > 0.5 && part < 1.5) {
    vec3 ec = vec3(sign(r.x) * ${gf(MO_EYE[0])}, ${gf(MO_EYE[1])}, ${gf(MO_EYE[2])});
    vec3 e = normalize(r - ec);
    vec3 g = normalize(vec3(sign(r.x) * 0.78, 0.22, -0.58));
    float cg = dot(e, g);
    float irisM = smoothstep(0.55, 0.72, cg);
    float pup = smoothstep(0.86, 0.9, cg);
    col = mix(${gc(0x2b1b14)} * 0.8, ${gc(0xd9cf9c)}, irisM);
    col = mix(col, vec3(0.005), pup);
    moRough = 0.08;
    moH = 0.0;
    moEmi = ${gc(0xd9cf9c)} * irisM * (1.0 - pup) * 0.08;
  } else if (part > 1.5 && part < 2.5) {
    col = ${gc(0xefe7d4)};
    moRough = 0.25;
    moH = 0.0;
    moEmi = col * 0.05;
  } else if (part > 2.5 && part < 3.5) {
    col = mix(${gc(0xb86b6b)}, ${gc(0xb86b6b)} * 0.15, smoothstep(0.02, 0.075, s));
    moRough = 0.6;
    moH = 0.0;
  } else if (part > 3.5) {
    col = mix(col * 1.15, vec3(0.02), vMoA.w);
  }
  float q = uMoInfo.y - s * uMoInfo.x;
  col *= mix(0.18, 1.0, smoothstep(-0.03, 0.2, q));
  diffuseColor.rgb = col;
}
`;
const MO_FNORMAL =  `
normal = crPerturb(-vViewPosition, normal, moH);
`;
const MO_FEMIS =  `
totalEmissiveRadiance += moEmi;
roughnessFactor = moRough;
`;

function makeMoray(ctx, geoSrc, den, idx) {
  const W = ctx.W, ground = W.ground, S = den.scale;
  const Lw = MO_LEN * S;
  const rng = placeRng(0x3013 + idx * 131);
  const texData = new Float32Array(MO_NS * 3 * 4);
  const tex = new THREE.DataTexture(texData, MO_NS, 3, THREE.RGBAFormat, THREE.FloatType);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  const U = {
    uMoCurve: { value: tex },
    uMoJaw: { value: new THREE.Vector4(0.05, 0, MO_HINGE[0], MO_HINGE[1]) },
    uMoInfo: { value: new THREE.Vector4(S, 0.5, Lw, 0) },
  };
  const mat = ctx.patch(
    injectLit(
      new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.42, metalness: 0, clearcoat: 0.55, clearcoatRoughness: 0.3, envMapIntensity: 0.7 }),
      { uniforms: U, vDecl: MO_VDECL, vNormal: MO_VNORMAL, vBegin: 'transformed = moP;', fDecl: MO_FDECL, fColor: MO_FCOLOR, fNormal: MO_FNORMAL, fEmissive: MO_FEMIS },
      'moray',
    ),
  );
  const depth = depthMaterial(U, MO_VDECL, MO_VDEPTH, 'moray');
  const geo = new THREE.BufferGeometry();
  for (const k in geoSrc.attributes) geo.setAttribute(k, geoSrc.attributes[k]);
  geo.setIndex(geoSrc.index);
  geo.boundingSphere = new THREE.Sphere(den.O.clone(), 1.3 * S);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'critter-moray';
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.customDepthMaterial = depth;
  mesh.matrixAutoUpdate = false;
  ctx.root.add(mesh);
  ctx.disposables.push(geo, mat, depth, tex);

  const Ah = new THREE.Vector3(den.A.x, 0, den.A.z).normalize();
  const Sd = new THREE.Vector3().crossVectors(Y_UP$1, Ah).normalize();
  const OUTN = 48, OUTMAX = 0.95 * S, dq = OUTMAX / OUTN;
  const OUT = new Float32Array((OUTN + 1) * 3);
  const PTS = new Float32Array(MO_NS * 3);
  const st = { e: den.eMax * 0.7, eT: den.eMax, wait: 0, yaw: 0, pitch: 0, br: rng() * TAU$2, threat: 0 };

  function update(dt, t, pl) {
    const eh = Math.max(0, st.e);
    const hx = den.O.x + Ah.x * eh, hy = den.O.y + 0.05 * S, hz = den.O.z + Ah.z * eh;
    const dist = pl.has ? Math.hypot(pl.p.x - hx, pl.p.y - hy, pl.p.z - hz) : 1e4;
    if (dist < 2.5) {
      st.eT = -0.07 * S;
      st.wait = 3 + rng() * 2.5;
    } else if (dist > 3.2) {
      st.wait -= dt;
      if (st.wait <= 0) st.eT = den.eMax;
    }
    st.e = approach(st.e, st.eT, (st.eT < st.e ? 1.1 : 0.13) * S * dt);
    let yawT = 0.22 * Math.sin(0.13 * t + idx * 2.1), pitchT = 0.05 * Math.sin(0.09 * t + idx);
    if (pl.has && dist < 7) {
      const dx = pl.p.x - den.O.x, dz = pl.p.z - den.O.z;
      const fw = dx * Ah.x + dz * Ah.z, sd = dx * Sd.x + dz * Sd.z;
      yawT = clamp$3(Math.atan2(sd, Math.max(0.2, fw)), -0.45, 0.45);
      pitchT = clamp$3(Math.atan2(pl.p.y - hy, Math.hypot(fw, sd) + 0.3), -0.3, 0.45) * 0.6;
    }
    st.yaw += (yawT - st.yaw) * expK(1.6, dt);
    st.pitch += (pitchT - st.pitch) * expK(1.2, dt);
    st.threat += ((dist < 4.5 && dist > 2.5 ? 1 : 0) - st.threat) * expK(1.2, dt);
    st.br += (dt * TAU$2) / (3.1 - 0.8 * st.threat);
    const breath = 0.5 - 0.5 * Math.cos(st.br);
    U.uMoJaw.value.x = 0.04 + 0.2 * breath + 0.22 * st.threat * (0.6 + 0.4 * breath);
    U.uMoJaw.value.y = 0.0035 * Math.sin(st.br - 1.2);
    U.uMoInfo.value.y = st.e;

    let px = den.O.x, py = den.O.y, pz = den.O.z;
    OUT[0] = px; OUT[1] = py; OUT[2] = pz;
    for (let k = 1; k <= OUTN; k++) {
      const qs = ((k - 0.5) * dq) / S;
      const psi = st.yaw * sstep$2(0.08, 0.5, qs) + 0.2 * Math.sin((TAU$2 * qs) / 0.6 - 1.1 * t + idx * 1.7) * sstep$2(0.04, 0.3, qs) * (1 - 0.4 * sstep$2(0.4, 0.8, qs));
      const th = (0.26 + st.pitch) * sstep$2(0.0, 0.45, qs);
      const cth = Math.cos(th), sth = Math.sin(th), cps = Math.cos(psi), sps = Math.sin(psi);
      px += (Ah.x * cth * cps + Sd.x * cth * sps) * dq;
      py += sth * dq;
      pz += (Ah.z * cth * cps + Sd.z * cth * sps) * dq;
      const gy = ground.height(px, pz) + 0.05 * S;
      if (py < gy) py = gy;
      OUT[k * 3] = px; OUT[k * 3 + 1] = py; OUT[k * 3 + 2] = pz;
    }
    for (let j = 0; j < MO_NS; j++) {
      const q = st.e - (j / (MO_NS - 1)) * Lw;
      const j3 = j * 3;
      if (q <= 0) {
        PTS[j3] = den.O.x + Ah.x * q;
        PTS[j3 + 1] = den.O.y;
        PTS[j3 + 2] = den.O.z + Ah.z * q;
      } else {
        const f = Math.min(q / dq, OUTN - 1e-4);
        const k = Math.floor(f), u = f - k;
        PTS[j3] = lerp$1(OUT[k * 3], OUT[k * 3 + 3], u);
        PTS[j3 + 1] = lerp$1(OUT[k * 3 + 1], OUT[k * 3 + 4], u);
        PTS[j3 + 2] = lerp$1(OUT[k * 3 + 2], OUT[k * 3 + 5], u);
      }
    }
    for (let j = 0; j < MO_NS; j++) {
      const a = Math.max(0, j - 1) * 3, b = Math.min(MO_NS - 1, j + 1) * 3;
      let tx = PTS[b] - PTS[a], ty = PTS[b + 1] - PTS[a + 1], tz = PTS[b + 2] - PTS[a + 2];
      const tl = Math.hypot(tx, ty, tz);
      if (tl < 1e-9) {
        tx = -Ah.x; ty = 0; tz = -Ah.z;
      } else {
        tx /= tl; ty /= tl; tz /= tl;
      }
      let nx = -ty * tx, ny = 1 - ty * ty, nz = -ty * tz;
      const nl = Math.hypot(nx, ny, nz) || 1;
      nx /= nl; ny /= nl; nz /= nl;
      const bx = ny * tz - nz * ty, by = nz * tx - nx * tz, bz = nx * ty - ny * tx;
      const r0 = j * 4, r1 = (MO_NS + j) * 4, r2 = (2 * MO_NS + j) * 4;
      texData[r0] = PTS[j * 3]; texData[r0 + 1] = PTS[j * 3 + 1]; texData[r0 + 2] = PTS[j * 3 + 2]; texData[r0 + 3] = 1;
      texData[r1] = nx; texData[r1 + 1] = ny; texData[r1 + 2] = nz; texData[r1 + 3] = 0;
      texData[r2] = bx; texData[r2 + 1] = by; texData[r2 + 2] = bz; texData[r2 + 3] = 0;
    }
    tex.needsUpdate = true;
  }
  return {
    kind: 'moray',
    update,
    info: () => ({ kind: 'moray', e: +st.e.toFixed(3), x: +den.O.x.toFixed(2), y: +den.O.y.toFixed(2), z: +den.O.z.toFixed(2) }),
    arrays: () => [texData],
  };
}

const NB_VDECL =  `
attribute vec4 aNb;
uniform float uCrTime;
varying vec3 vNbL;
varying vec4 vNbA;
float nbSeed() {
  #ifdef USE_INSTANCING
    return fract(sin(dot(vec2(instanceMatrix[3][0], instanceMatrix[3][2]), vec2(12.9898, 78.233))) * 43758.5453);
  #else
    return 0.0;
  #endif
}
`;
const FLAB_VBEGIN =  `
vNbL = position;
vNbA = aNb;
{
  float sd = nbSeed() * 6.2831853;
  float w = aNb.x;
  float ph = aNb.y + sd;
  transformed.x += sin(uCrTime * 1.7 + ph) * 0.0012 * w;
  transformed.z += cos(uCrTime * 1.3 + ph * 1.3) * 0.0009 * w;
  transformed.y -= abs(sin(uCrTime * 0.9 + ph)) * 0.0003 * w;
  transformed.x += sin(position.z * 150.0 - uCrTime * 1.4 + sd) * 0.00035;
}
`;
const FELI_VBEGIN =  `
vNbL = position;
vNbA = aNb;
{
  float sd = nbSeed() * 6.2831853;
  float part = aNb.z;
  if (part > 0.5 && part < 2.0) {
    transformed.y += aNb.x * 0.0014 * sin(aNb.y * 5.0 + uCrTime * 2.1 + sd);
  } else if (part > 2.5 && part < 3.5) {
    transformed.x += sin(uCrTime * 1.3 + sd) * 0.0008 * aNb.w;
  } else if (part > 3.5) {
    float pulse = 1.0 + 0.1 * sin(uCrTime * 1.1 + sd);
    transformed.xz = vec2(0.0, -0.02) + (transformed.xz - vec2(0.0, -0.02)) * pulse;
  }
  transformed.x += sin(position.z * 120.0 - uCrTime * 1.2 + sd) * 0.0003;
}
`;
const NB_FDECL =  `
varying vec3 vNbL;
varying vec4 vNbA;
${CR_NOISE}
`;
const FLAB_FCOLOR =  `
float nbGlow = 0.16;
{
  float n = crNoise3(vNbL * 700.0);
  diffuseColor.rgb *= 0.88 + 0.24 * n;
  float tipGlow = (vNbA.z > 0.5 && vNbA.z < 1.5) ? smoothstep(0.55, 1.0, vNbA.w) : 0.0;
  nbGlow = 0.16 + 0.3 * tipGlow;
}
`;
const FELI_FCOLOR =  `
float nbGlow = 0.12;
{
  vec3 p = vNbL;
  float part = vNbA.z;
  vec3 col = diffuseColor.rgb;
  if (part > 0.5 && part < 1.3) {
    float xn = p.x / 0.0158;
    float zn = (p.z - 0.0015) / 0.0348;
    float rho = length(vec2(xn, zn));
    col = mix(${gc(0x2446b8)}, ${gc(0x10246e)}, smoothstep(0.2, 0.9, rho) * 0.45 + crNoise3(p * 900.0) * 0.12);
    float margin = smoothstep(0.86, 0.9, rho) * (1.0 - smoothstep(0.965, 0.995, rho));
    float lineM = 1.0 - smoothstep(0.035, 0.07, abs(xn));
    float lineS = 1.0 - smoothstep(0.03, 0.065, abs(abs(xn) - 0.5 - 0.06 * sin(zn * 9.0)));
    float dash = step(0.35, crNoise3(vec3(zn * 7.0, xn * 2.0, 1.3)));
    vec2 cc = crCell2(vec2(xn, zn) * 9.0);
    float dots = (1.0 - smoothstep(0.1, 0.2, cc.x)) * step(0.55, cc.y);
    float inner = 1.0 - smoothstep(0.78, 0.82, rho);
    float yel = max(margin, max(lineM * dash, max(lineS * dash, dots)) * inner);
    col = mix(col, ${gc(0xffd21a)}, yel);
    nbGlow = 0.12 + 0.22 * yel;
  } else if (part < 0.5) {
    float tailLine = (1.0 - smoothstep(0.0008, 0.0014, abs(p.x))) * step(p.z, -0.03) * smoothstep(0.002, 0.004, p.y);
    col = mix(col, ${gc(0xffd21a)}, tailLine);
  }
  diffuseColor.rgb = col;
}
`;
const NB_FEMIS =  `
totalEmissiveRadiance += diffuseColor.rgb * nbGlow;
`;

function buildFlabellinaGeo(rng) {
  const g = new Geo({ color: 3, aNb: 4 });
  const cBody = linRGB(0xb07cd8), cFoot = linRGB(0xd6b8ec), cCer = linRGB(0x8a3fb8), cOr = linRGB(0xff7a1a), cTip = linRGB(0xfff5ea), cRh = linRGB(0xa46ad0);
  const z0 = -0.034, z1 = 0.026, NZ = 26, NR = 12;
  const prof = (z) => {
    const zt = (z - z0) / (z1 - z0);
    const tail = sstep$2(0.0, 0.32, zt);
    const head = Math.sqrt(Math.max(0, 1 - Math.pow(Math.max(0, zt - 0.8) / 0.2, 2)));
    return [0.0046 * Math.pow(tail, 0.7) * head, 0.0056 * Math.pow(tail, 1.2) * head, zt];
  };
  const body = new Geo({ color: 3, aNb: 4 });
  for (let j = 0; j <= NZ; j++) {
    const z = z0 + ((z1 - z0) * j) / NZ;
    const pr = prof(z);
    for (let k = 0; k < NR; k++) {
      const ph = (k / NR) * TAU$2, sp = Math.sin(ph), cp = Math.cos(ph);
      const y = 0.12 * pr[1] + (sp >= 0 ? pr[1] * sp : 0.12 * pr[1] * sp);
      body.v(pr[0] * cp, y, z, cp, sp, 0, { color: sp < -0.2 ? cFoot : mixRGB(cBody, cFoot, 0.15 * (1 - sp)), aNb: [0, 0, 0, pr[2]] });
    }
  }
  body.grid(0, NZ + 1, NR, true);
  body.smoothNormals();
  body.orientOutward();
  g.append(body);
  for (let sx = -1; sx <= 1; sx += 2) {
    const zb = 0.017, pb = prof(zb);
    const pts = [], radii = [];
    for (let i = 0; i <= 9; i++) {
      const t = i / 9;
      pts.push([sx * (0.0019 + 0.004 * t), 1.02 * pb[1] + 0.0135 * t - 0.002 * t * t, zb + 0.004 * t]);
      radii.push(lerp$1(0.0011, 0.0005, t) * (t > 0.25 ? 1 + 0.16 * Math.sin(t * 38) : 1));
    }
    tube(g, pts, radii, 7, (j, k, t) => ({ color: mixRGB(cRh, cTip, sstep$2(0.75, 1, t)), aNb: [t * 0.6, sx * 1.3, 2, t] }), { capEnd: true });
    const pts2 = [], radii2 = [];
    for (let i = 0; i <= 7; i++) {
      const t = i / 7;
      pts2.push([sx * (0.0026 + 0.009 * t), 0.0022 - 0.0004 * t, 0.0235 + 0.013 * t - 0.002 * t * t]);
      radii2.push(lerp$1(0.00095, 0.0003, t));
    }
    tube(g, pts2, radii2, 6, (j, k, t) => ({ color: mixRGB(cRh, cTip, sstep$2(0.8, 1, t)), aNb: [t * 0.8, sx * 2.1, 2, t] }), { capEnd: true });
  }
  for (let sx = -1; sx <= 1; sx += 2) {
    for (let c = 0; c < 6; c++) {
      const zc = -0.0195 + c * 0.0058;
      const pc = prof(zc);
      const bx = sx * pc[0] * 0.72, by = 0.9 * pc[1], bz = zc;
      const n = c < 2 ? 4 : 5;
      for (let m = 0; m < n; m++) {
        let dx = sx * (0.25 + 0.55 * rng()), dy = 1, dz = -0.2 + 0.4 * rng();
        const dl = Math.hypot(dx, dy, dz);
        dx /= dl; dy /= dl; dz /= dl;
        const len = 0.0075 + 0.005 * rng();
        const ox = (rng() - 0.5) * 0.0016, oz = (rng() - 0.5) * 0.0016;
        const ph = rng() * TAU$2, sw = 0.8 + 0.4 * rng();
        const TS = [0, 0.25, 0.5, 0.66, 0.76, 0.88, 1];
        const pts = [], radii = [];
        for (const t of TS) {
          pts.push([bx + ox + dx * len * t + sx * len * 0.15 * t * t, by + dy * len * t, bz + oz + dz * len * t]);
          radii.push(lerp$1(0.00115, 0.00022, Math.pow(t, 1.2)) * (1 + 0.12 * (1 - t)));
        }
        tube(g, pts, radii, 5, (j) => {
          const t = TS[j];
          return { color: t < 0.62 ? mixRGB(cCer, cBody, 0.25 * (1 - t)) : t < 0.8 ? cOr : cTip, aNb: [t * t * sw, ph, 1, t] };
        }, { capEnd: true });
      }
    }
  }
  return g.build(true);
}

function buildFelimareGeo() {
  const g = new Geo({ color: 3, aNb: 4 });
  const blue = linRGB(0x1f3fb0), dblue = linRGB(0x10246e), yel = linRGB(0xffd21a);
  const z0 = -0.052, z1 = 0.03, NZ = 26, NR = 12;
  const foot = new Geo({ color: 3, aNb: 4 });
  for (let j = 0; j <= NZ; j++) {
    const z = z0 + ((z1 - z0) * j) / NZ;
    const zt = (z - z0) / (z1 - z0);
    const tail = sstep$2(0, 0.28, zt);
    const head = Math.sqrt(Math.max(0, 1 - Math.pow(Math.max(0, zt - 0.85) / 0.15, 2)));
    const w = 0.0072 * Math.pow(tail, 0.8) * head, h = 0.0046 * tail * head;
    for (let k = 0; k < NR; k++) {
      const ph = (k / NR) * TAU$2, sp = Math.sin(ph), cp = Math.cos(ph);
      foot.v(w * cp, 0.1 * h + (sp >= 0 ? h * sp : 0.1 * h * sp), z, cp, sp, 0, { color: blue, aNb: [0, 0, 0, zt] });
    }
  }
  foot.grid(0, NZ + 1, NR, true);
  foot.smoothNormals();
  foot.orientOutward();
  g.append(foot);
  const a = 0.0158, b = 0.0348, zc = 0.0015, yE = 0.0052;
  const NRr = 9, NP = 44;
  const topY = (rho) => yE + 0.0088 * Math.pow(Math.max(0, 1 - rho * rho), 0.75);
  for (let layer = 0; layer < 2; layer++) {
    const top = layer === 0;
    const m = new Geo({ color: 3, aNb: 4 });
    m.v(0, top ? topY(0) : yE - 0.0008, zc, 0, top ? 1 : -1, 0, { color: top ? blue : dblue, aNb: [0, 0, top ? 1 : 1.6, 0] });
    for (let ir = 1; ir <= NRr; ir++) {
      const rho = ir / NRr;
      for (let ip = 0; ip < NP; ip++) {
        const phi = (ip / NP) * TAU$2;
        const x = a * rho * Math.sin(phi), z = zc + b * rho * Math.cos(phi);
        const y = top ? topY(rho) : yE - 0.0008 * (1 - rho * rho);
        m.v(x, y, z, 0, top ? 1 : -1, 0, { color: top ? blue : dblue, aNb: [Math.pow(rho, 4), phi, top ? 1 : 1.6, rho] });
      }
    }
    for (let ip = 0; ip < NP; ip++) m.tri(0, 1 + ip, 1 + ((ip + 1) % NP));
    for (let ir = 1; ir < NRr; ir++) {
      for (let ip = 0; ip < NP; ip++) {
        const a0 = 1 + (ir - 1) * NP + ip, a1 = 1 + (ir - 1) * NP + ((ip + 1) % NP);
        m.quad(a0, a0 + NP, a1 + NP, a1);
      }
    }
    m.smoothNormals();
    m.orientTo(0, top ? 1 : -1, 0);
    g.append(m);
  }
  for (let sx = -1; sx <= 1; sx += 2) {
    const bx = sx * 0.0045, bz = zc + 0.021, by = topY(0.66) - 0.0006;
    const pts = [], radii = [];
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      pts.push([bx + sx * 0.0018 * t, by + 0.0105 * t, bz + 0.0034 * t]);
      radii.push(lerp$1(0.0021, 0.0006, t) * (t > 0.25 && t < 0.92 ? 1 + 0.2 * Math.sin(t * 55) : 1));
    }
    tube(g, pts, radii, 8, (j, k, t) => ({ color: t > 0.25 && Math.sin(t * 55) > 0.4 ? mixRGB(dblue, yel, 0.35) : dblue, aNb: [t, sx, 3, t] }), { capEnd: true, capEx: { color: yel, aNb: [1, sx, 3, 1] } });
  }
  const gcz = zc - 0.0215, gcy = topY(0.64) - 0.0004;
  for (let k = 0; k < 9; k++) {
    const ang = (k / 9) * TAU$2;
    const ox = Math.cos(ang), oz = Math.sin(ang);
    const bx = ox * 0.0036, bz = gcz + oz * 0.0036;
    const tx = -oz, tz = ox;
    for (let side = 1; side >= -1; side -= 2) {
      const base = g.count;
      for (let i = 0; i <= 6; i++) {
        const t = i / 6;
        const cx = bx + ox * 0.0045 * t * t, cy = gcy + 0.0082 * t, cz = bz + oz * 0.0045 * t * t;
        const wdt = 0.0013 * (1 - t) * (0.6 + 0.4 * Math.sin(Math.PI * Math.min(1, t * 1.4)));
        for (let e = -1; e <= 1; e++) {
          g.v(cx + tx * wdt * e, cy, cz + tz * wdt * e, ox * side, 0.3 * side, oz * side, { color: e === 0 ? dblue : mixRGB(dblue, yel, 0.6), aNb: [t, ang, 4, t] });
        }
      }
      for (let i = 0; i < 6; i++) {
        for (let e = 0; e < 2; e++) g.quad(base + i * 3 + e, base + i * 3 + 3 + e, base + i * 3 + 4 + e, base + i * 3 + 1 + e);
      }
    }
  }
  return g.build(true);
}

function makeNudibranchs(ctx) {
  const W = ctx.W, ground = W.ground, rng = placeRng(0xa11e);
  const N = Math.max(12, Math.round(34 * ctx.quality));
  const cands = [];
  const consider = (p) => {
    if (p.y < -33 || p.y > -3 || p.ny < -0.25) return;
    if (Math.hypot(p.x, p.z) > W.bound) return;
    if (p.y < ground.height(p.x, p.z) + 0.08) return;
    if (W.inAvoid(p.x, p.z, 0.5)) return;
    cands.push(p);
  };
  for (const p of W.tops) consider(p);
  for (const p of W.sides) consider(p);
  if (!cands.length) return null;
  for (let i = cands.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = cands[i];
    cands[i] = cands[j];
    cands[j] = tmp;
  }
  const chosen = [];
  for (const p of cands) {
    if (chosen.length >= N) break;
    if (chosen.some((q) => Math.hypot(p.x - q.p.x, p.y - q.p.y, p.z - q.p.z) < 0.9)) continue;
    chosen.push({ p, sp: chosen.length % 9 < 5 ? 0 : 1 });
  }
  const extra = [];
  for (const c of chosen) {
    if (rng() > 0.22) continue;
    for (const q of cands) {
      const d = Math.hypot(q.x - c.p.x, q.y - c.p.y, q.z - c.p.z);
      if (d > 0.06 && d < 0.25) {
        extra.push({ p: q, sp: c.sp });
        break;
      }
    }
  }
  const all = chosen.concat(extra);
  const geos = [buildFlabellinaGeo(makeRng(0xf1ab)), buildFelimareGeo()];
  const U = { uCrTime: ctx.time };
  const mats = [
    ctx.patch(injectLit(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.38, metalness: 0, envMapIntensity: 0.6 }), { uniforms: U, vDecl: NB_VDECL, vBegin: FLAB_VBEGIN, fDecl: NB_FDECL, fColor: FLAB_FCOLOR, fEmissive: NB_FEMIS }, 'flabellina')),
    ctx.patch(injectLit(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.28, metalness: 0, envMapIntensity: 0.7 }), { uniforms: U, vDecl: NB_VDECL, vBegin: FELI_VBEGIN, fDecl: NB_FDECL, fColor: FELI_FCOLOR, fEmissive: NB_FEMIS }, 'felimare')),
  ];
  ctx.disposables.push(geos[0], geos[1], mats[0], mats[1]);
  const groups = [[], []];
  for (const c of all) groups[c.sp].push(c);
  const meshes = [], slugs = [];
  for (let s = 0; s < 2; s++) {
    const list = groups[s];
    if (!list.length) continue;
    const mesh = new THREE.InstancedMesh(geos[s], mats[s], list.length);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.receiveShadow = true;
    mesh.name = s ? 'critter-felimare' : 'critter-flabellina';
    ctx.root.add(mesh);
    meshes.push(mesh);
    list.forEach((c, i) => {
      const n = new THREE.Vector3(c.p.nx, c.p.ny, c.p.nz).normalize();
      const t1 = new THREE.Vector3().crossVectors(n, Math.abs(n.y) < 0.95 ? Y_UP$1 : new THREE.Vector3(1, 0, 0)).normalize();
      const t2 = new THREE.Vector3().crossVectors(n, t1).normalize();
      slugs.push({ mesh, i, sp: s, hx: c.p.x, hy: c.p.y, hz: c.p.z, n, t1, t2, u: 0, v: 0, phi: rng() * TAU$2, speed: 0.004 + rng() * 0.003, sc: 1.5 * (s ? 0.72 : 0.8) * (0.85 + rng() * 0.3), seed: rng() * 10 });
    });
  }
  const R = 0.04;
  let bounded = false;
  function update(dt, t) {
    for (const s of slugs) {
      s.phi += Math.sin(t * 0.37 + s.seed * 13) * 0.5 * dt;
      if (s.u * s.u + s.v * s.v > R * R * 0.64) s.phi += clamp$3(wrapPi(Math.atan2(-s.v, -s.u) - s.phi), -1.2 * dt, 1.2 * dt);
      const cf = Math.cos(s.phi), sf = Math.sin(s.phi);
      s.u += cf * s.speed * dt;
      s.v += sf * s.speed * dt;
      const n = s.n, t1 = s.t1, t2 = s.t2, sc = s.sc;
      const fx = t1.x * cf + t2.x * sf, fy = t1.y * cf + t2.y * sf, fz = t1.z * cf + t2.z * sf;
      const xx = n.y * fz - n.z * fy, xy = n.z * fx - n.x * fz, xz = n.x * fy - n.y * fx;
      const A = s.mesh.instanceMatrix.array, o = s.i * 16;
      A[o] = xx * sc; A[o + 1] = xy * sc; A[o + 2] = xz * sc; A[o + 3] = 0;
      A[o + 4] = n.x * sc; A[o + 5] = n.y * sc; A[o + 6] = n.z * sc; A[o + 7] = 0;
      A[o + 8] = fx * sc; A[o + 9] = fy * sc; A[o + 10] = fz * sc; A[o + 11] = 0;
      A[o + 12] = s.hx + t1.x * s.u + t2.x * s.v - n.x * 0.0012 * sc;
      A[o + 13] = s.hy + t1.y * s.u + t2.y * s.v - n.y * 0.0012 * sc;
      A[o + 14] = s.hz + t1.z * s.u + t2.z * s.v - n.z * 0.0012 * sc;
      A[o + 15] = 1;
    }
    for (const m of meshes) m.instanceMatrix.needsUpdate = true;
    if (!bounded) {
      for (const m of meshes) {
        m.computeBoundingSphere();
        if (m.boundingSphere) m.boundingSphere.radius += 0.25;
      }
      bounded = true;
    }
  }
  return {
    kind: 'nudibranchs',
    update,
    info: () => ({ kind: 'nudibranchs', flabellina: groups[0].length, felimare: groups[1].length, sample: slugs.slice(0, 3).map((s) => [+s.hx.toFixed(2), +s.hy.toFixed(2), +s.hz.toFixed(2)]) }),
    arrays: () => meshes.map((m) => m.instanceMatrix.array),
    count: slugs.length,
  };
}

const SB_K = 40;
const SB_NT = 10;
function sbCrown(phi, t, sd, kf, out, nrm) {
  const rb = lerp$1(0.0012, 0.0062, kf), yb = 0.004 * kf, Lf = lerp$1(0.058, 0.088, kf);
  const b0 = lerp$1(0.3, 1.1, kf), b1 = 0.65, bt = b0 + b1 * t;
  const ax = (Math.cos(b0) - Math.cos(bt)) / b1, ay = (Math.sin(bt) - Math.sin(b0)) / b1;
  const rx = Math.cos(phi), rz = Math.sin(phi), tx = -Math.sin(phi), tz = Math.cos(phi);
  const wdt = lerp$1(0.0024, 0.0008, t);
  out[0] = rx * (rb + Lf * ax) + tx * sd * wdt;
  out[1] = yb + Lf * ay;
  out[2] = rz * (rb + Lf * ax) + tz * sd * wdt;
  const vx = rx * Math.sin(bt), vy = Math.cos(bt), vz = rz * Math.sin(bt);
  nrm[0] = vy * tz;
  nrm[1] = vz * tx - vx * tz;
  nrm[2] = -vy * tx;
}
function buildSbTubeGeo() {
  const g = new Geo({ aSbT: 2 });
  const RAD = 12, RINGS = 16;
  const rOut = (y) => 0.0086 * (1 + 0.14 * (1 - y));
  const bump = (a, y) => 1 + 0.07 * vnoise3$1(Math.cos(a) * 2.5, y * 14, Math.sin(a) * 2.5);
  for (let j = 0; j <= RINGS; j++) {
    const y = j / RINGS;
    for (let k = 0; k <= RAD; k++) {
      const a = (k / RAD) * TAU$2;
      const r = rOut(y) * bump(a, y);
      g.v(Math.cos(a) * r, y, Math.sin(a) * r, Math.cos(a), 0.02, Math.sin(a), { aSbT: [y, 0] });
    }
  }
  g.grid(0, RINGS + 1, RAD + 1, false);
  const lip0 = g.count;
  for (let k = 0; k <= RAD; k++) {
    const a = (k / RAD) * TAU$2, r = rOut(1) * bump(a, 1);
    g.v(Math.cos(a) * r, 1, Math.sin(a) * r, 0, 1, 0, { aSbT: [1, 0] });
  }
  const lip1 = g.count;
  for (let k = 0; k <= RAD; k++) {
    const a = (k / RAD) * TAU$2;
    g.v(Math.cos(a) * 0.0068, 1, Math.sin(a) * 0.0068, 0, 1, 0, { aSbT: [1, 0] });
  }
  for (let k = 0; k < RAD; k++) g.quad(lip0 + k, lip1 + k, lip1 + k + 1, lip0 + k + 1);
  const in0 = g.count;
  for (let j = 0; j <= 4; j++) {
    const y = 1 - 0.18 * (j / 4);
    for (let k = 0; k <= RAD; k++) {
      const a = (k / RAD) * TAU$2;
      g.v(Math.cos(a) * 0.0068, y, Math.sin(a) * 0.0068, -Math.cos(a), 0, -Math.sin(a), { aSbT: [y, 1] });
    }
  }
  g.grid(in0, 5, RAD + 1, false);
  const c = g.v(0, 0.82, 0, 0, 1, 0, { aSbT: [0.82, 1] });
  const fl = g.count;
  for (let k = 0; k <= RAD; k++) {
    const a = (k / RAD) * TAU$2;
    g.v(Math.cos(a) * 0.0068, 0.82, Math.sin(a) * 0.0068, 0, 1, 0, { aSbT: [0.82, 1] });
  }
  for (let k = 0; k < RAD; k++) g.tri(c, fl + k, fl + k + 1);
  const geo = g.build(true);
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.15, 0), 0.3);
  return geo;
}
function buildSbCrownGeo() {
  const g = new Geo({ aSbC: 4 });
  const P = [0, 0, 0], N = [0, 0, 0];
  for (let k = 0; k < SB_K; k++) {
    const kf = k / (SB_K - 1);
    const phi = kf * TAU$2 * 1.3 + 0.4;
    const base = g.count;
    for (let i = 0; i <= SB_NT; i++) {
      const t = i / SB_NT;
      for (let sd = -1; sd <= 1; sd += 2) {
        sbCrown(phi, t, sd, kf, P, N);
        g.v(P[0], P[1], P[2], N[0], N[1], N[2], { aSbC: [phi, t, sd, kf] });
      }
    }
    for (let i = 0; i < SB_NT; i++) g.quad(base + i * 2, base + i * 2 + 2, base + i * 2 + 3, base + i * 2 + 1);
  }
  const geo = g.build(false);
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.16, 0), 0.32);
  return geo;
}

const SB_VCOMMON =  `
attribute vec4 aSbI;
attribute vec4 aSbB;
uniform float uCrTime;
${CR_SURGE}
vec2 sbBend() {
  vec3 sw = crSurge(uCrTime);
  #ifdef USE_INSTANCING
    mat3 im = mat3(instanceMatrix);
    float s2 = max(dot(im[0], im[0]), 1e-6);
    sw = (transpose(im) * sw) / s2;
  #endif
  float sway = sin(uCrTime * 0.9 + aSbI.w * 6.2831853) * 0.03;
  return aSbB.xy * (aSbB.z + aSbB.w) + sw.xz * 0.25 + vec2(sway, sway * 0.6);
}
vec3 sbAlign(vec3 v, vec3 axis) {
  vec3 k = vec3(axis.z, 0.0, -axis.x);
  float s = length(k);
  if (s < 1e-5) return v;
  k /= s;
  float c = axis.y;
  return v * c + cross(k, v) * s + k * dot(k, v) * (1.0 - c);
}
`;
const SB_TUBE_VDECL = SB_VCOMMON +  `
attribute vec2 aSbT;
varying vec2 vSbT;
varying vec3 vSbL;
`;
const SB_TUBE_VBEGIN =  `
{
  float H = aSbI.z;
  vec2 bv = sbBend();
  float yf = position.y;
  float b2 = yf * yf * H;
  transformed = vec3(position.x + bv.x * b2, yf * H, position.z + bv.y * b2);
  vSbT = aSbT;
  vSbL = vec3(position.x, yf * H, position.z);
}
`;
const SB_TUBE_FDECL =  `
varying vec2 vSbT;
varying vec3 vSbL;
${CR_NOISE}
`;
const SB_TUBE_FCOLOR =  `
{
  float y = vSbL.y;
  float n = crNoise3(vSbL * vec3(300.0, 60.0, 300.0));
  vec3 col = mix(${gc(0x5c5042)}, ${gc(0x857563)}, n);
  float ring = smoothstep(0.7, 1.0, sin(y * 190.0 + n * 3.0));
  col *= 1.0 - 0.18 * ring;
  vec2 cc = crCell3(vSbL * 420.0);
  col = mix(col, ${gc(0xcfc2a8)}, (1.0 - smoothstep(0.12, 0.25, cc.x)) * step(0.7, cc.y) * 0.6);
  col = mix(col, col * 1.2, smoothstep(0.93, 1.0, vSbT.x) * (1.0 - vSbT.y));
  col = mix(col, col * 0.12, vSbT.y);
  diffuseColor.rgb = col;
}
`;
const SB_CROWN_VDECL = SB_VCOMMON +  `
attribute vec4 aSbC;
varying vec4 vSbC;
varying float vSbSeed;
`;
const SB_CROWN_VNORMAL =  `
vec3 sbPos;
{
  float c = aSbI.x;
  float r = aSbI.y;
  float H = aSbI.z;
  float phi = aSbC.x;
  float t = aSbC.y;
  float sd = aSbC.z;
  float kf = aSbC.w;
  vec3 radial = vec3(cos(phi), 0.0, sin(phi));
  vec3 tang = vec3(-sin(phi), 0.0, cos(phi));
  float rb = mix(0.0012, 0.0062, kf) * mix(1.0, 0.35, c);
  float yb = 0.004 * kf;
  float Lf = mix(0.058, 0.088, kf) * (0.92 + 0.16 * fract(aSbI.w * 13.7));
  float b0 = mix(mix(0.3, 1.1, kf), 0.03, c);
  float b1 = mix(0.65, 0.02, c);
  float bt = b0 + b1 * t;
  float ax = (cos(b0) - cos(bt)) / b1;
  float ay = (sin(bt) - sin(b0)) / b1;
  vec3 ctr = radial * (rb + Lf * ax) + vec3(0.0, yb + Lf * ay, 0.0);
  vec3 tanv = radial * sin(bt) + vec3(0.0, cos(bt), 0.0);
  float wdt = mix(0.0024, 0.0008, t) * mix(1.0, 0.55, c);
  vec3 sw = crSurge(uCrTime);
  float fl = sin(uCrTime * 2.3 + kf * 17.0 + aSbI.w * 6.2831853);
  ctr += (vec3(sw.x, 0.0, sw.z) * 0.05 + tang * (0.0016 * fl) + radial * (0.0012 * cos(uCrTime * 1.7 + kf * 9.0))) * t * t * (1.0 - c);
  vec3 cp = ctr + tang * (sd * wdt);
  cp.y -= r * (Lf + 0.025);
  vec2 bv = sbBend();
  vec3 top = vec3(bv.x * H, H, bv.y * H);
  vec3 axis = normalize(vec3(2.0 * bv.x, 1.0, 2.0 * bv.y));
  sbPos = top + sbAlign(cp, axis);
  objectNormal = normalize(sbAlign(cross(tanv, tang), axis));
  vSbC = aSbC;
  vSbSeed = aSbI.w;
}
`;
const SB_CROWN_FDECL =  `
varying vec4 vSbC;
varying float vSbSeed;
`;
const SB_CROWN_FCOLOR =  `
{
  float t = clamp(vSbC.y, 0.0, 1.0);
  float kf = clamp(vSbC.w, 0.0, 1.0);
  float band = fract(t * 5.2 + kf * 0.35 + vSbSeed * 3.0);
  vec3 col = mix(${gc(0xf4efe4)}, ${gc(0xf07a22)}, smoothstep(0.15, 0.3, band) - smoothstep(0.5, 0.65, band));
  col = mix(col, ${gc(0x6a2270)}, smoothstep(0.62, 0.72, band) * (1.0 - smoothstep(0.9, 0.98, band)));
  col = mix(col, col * vec3(1.05, 0.85, 1.15), fract(vSbSeed * 7.1));
  col = mix(${gc(0x6a4a30)}, col, smoothstep(0.0, 0.18, t));
  float pin = 0.5 + 0.5 * sin(t * 170.0);
  float aa = clamp(1.5 - fwidth(t * 27.0) * 2.0, 0.0, 1.0);
  col *= 1.0 - 0.28 * pin * aa;
  float edge = min(abs(vSbC.z), 1.0);
  col *= 1.0 - 0.3 * edge * edge;
  diffuseColor.rgb = max(col, vec3(0.0));
}
`;
const SB_CROWN_FEMIS =  `
totalEmissiveRadiance += diffuseColor.rgb * 0.16;
`;

function makeFanWorms(ctx) {
  const W = ctx.W, ground = W.ground, rng = placeRng(0x5ab), rrt = placeRng(0x5ac);
  const N = Math.max(10, Math.round(26 * ctx.quality));
  const items = [];
  const vN = new THREE.Vector3(), qT = new THREE.Quaternion(), qS = new THREE.Quaternion();
  const addWorm = (x, y, z, nx, ny, nz, upBias, sink) => {
    vN.set(nx, ny, nz).normalize().lerp(Y_UP$1, upBias);
    vN.x += (rng() - 0.5) * 0.25;
    vN.z += (rng() - 0.5) * 0.25;
    vN.normalize();
    qT.setFromUnitVectors(Y_UP$1, vN).multiply(qS.setFromAxisAngle(Y_UP$1, rng() * TAU$2));
    const ba = rng() * TAU$2;
    items.push({ x, y: y - sink, z, q: qT.clone(), up: vN.clone(), H: 0.15 + rng() * 0.1, bx: Math.cos(ba), bz: Math.sin(ba), bend: 0.05 + rng() * 0.15, seed: rng(), sc: 0.9 + rng() * 0.25 });
  };
  const sideC = W.sides.filter((p) => Math.abs(p.ny) < 0.5 && p.y - ground.height(p.x, p.z) < 0.6 && Math.hypot(p.x, p.z) < 40);
  let guard = 0;
  while (items.length < Math.round(N * 0.65) && guard++ < 400 && sideC.length) {
    const p = sideC[Math.floor(rng() * sideC.length)];
    const nh = Math.hypot(p.nx, p.nz) || 1;
    const d = 0.8 + rng() * 1.2;
    const cx = p.x + (p.nx / nh) * d, cz = p.z + (p.nz / nh) * d;
    if (!W.sandOK(cx, cz, 0.35) || !ctx.free(cx, cz, 0.5)) continue;
    const k = 2 + Math.floor(rng() * 3);
    for (let m = 0; m < k && items.length < N; m++) {
      const x = cx + (rng() - 0.5) * 0.5, z = cz + (rng() - 0.5) * 0.5;
      if (!W.sandOK(x, z, 0.2)) continue;
      if (items.some((it) => Math.hypot(it.x - x, it.z - z) < 0.09)) continue;
      ground.normal(x, z, vN);
      addWorm(x, ground.height(x, z), z, vN.x, vN.y, vN.z, 0.65, 0.025);
    }
    ctx.claim('sabella', cx, cz, 0.4);
  }
  const topC = W.tops.filter((p) => p.ny > 0.85 && p.y > -33 && Math.hypot(p.x, p.z) < 40 && !W.inAvoid(p.x, p.z, 0.5));
  guard = 0;
  while (items.length < N && guard++ < 400 && topC.length) {
    const p = topC[Math.floor(rng() * topC.length)];
    if (items.some((it) => Math.hypot(it.x - p.x, it.z - p.z) < 0.5)) continue;
    const k = 1 + Math.floor(rng() * 3);
    for (let m = 0; m < k && items.length < N; m++) {
      const ox = m ? (rng() - 0.5) * 0.14 : 0, oz = m ? (rng() - 0.5) * 0.14 : 0;
      const y = p.y - (ox * p.nx + oz * p.nz) / Math.max(0.5, p.ny);
      addWorm(p.x + ox, y, p.z + oz, p.nx, p.ny, p.nz, 0.45, 0.012);
    }
  }
  if (!items.length) return null;
  const n = items.length;
  const tubeGeo = buildSbTubeGeo(), crownGeo = buildSbCrownGeo();
  const aI = new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4).setUsage(THREE.DynamicDrawUsage);
  const aB = new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4).setUsage(THREE.DynamicDrawUsage);
  tubeGeo.setAttribute('aSbI', aI);
  tubeGeo.setAttribute('aSbB', aB);
  crownGeo.setAttribute('aSbI', aI);
  crownGeo.setAttribute('aSbB', aB);
  const U = { uCrTime: ctx.time };
  const tubeMat = ctx.patch(injectLit(new THREE.MeshStandardMaterial({ roughness: 0.92, metalness: 0 }), { uniforms: U, vDecl: SB_TUBE_VDECL, vBegin: SB_TUBE_VBEGIN, fDecl: SB_TUBE_FDECL, fColor: SB_TUBE_FCOLOR }, 'sabella-tube'));
  const tubeDepth = depthMaterial(U, SB_TUBE_VDECL, SB_TUBE_VBEGIN, 'sabella-tube');
  const crownMat = ctx.patch(
    injectLit(
      new THREE.MeshStandardMaterial({ roughness: 0.55, metalness: 0, side: THREE.DoubleSide }),
      { uniforms: U, vDecl: SB_CROWN_VDECL, vNormal: SB_CROWN_VNORMAL, vBegin: 'transformed = sbPos;', fDecl: SB_CROWN_FDECL, fColor: SB_CROWN_FCOLOR, fEmissive: SB_CROWN_FEMIS },
      'sabella-crown',
    ),
  );
  const tubes = new THREE.InstancedMesh(tubeGeo, tubeMat, n), crowns = new THREE.InstancedMesh(crownGeo, crownMat, n);
  tubes.name = 'critter-sabella-tubes';
  crowns.name = 'critter-sabella-crowns';
  const m4 = new THREE.Matrix4(), sv = new THREE.Vector3(), pv = new THREE.Vector3();
  const topX = new Float32Array(n), topY = new Float32Array(n), topZ = new Float32Array(n);
  items.forEach((it, i) => {
    m4.compose(pv.set(it.x, it.y, it.z), it.q, sv.setScalar(it.sc));
    tubes.setMatrixAt(i, m4);
    crowns.setMatrixAt(i, m4);
    aI.array[i * 4 + 2] = it.H;
    aI.array[i * 4 + 3] = it.seed;
    aB.array[i * 4] = it.bx;
    aB.array[i * 4 + 1] = it.bz;
    aB.array[i * 4 + 2] = it.bend;
    topX[i] = it.x + it.up.x * it.H * it.sc;
    topY[i] = it.y + it.up.y * it.H * it.sc;
    topZ[i] = it.z + it.up.z * it.H * it.sc;
  });
  tubes.castShadow = true;
  tubes.receiveShadow = true;
  tubes.customDepthMaterial = tubeDepth;
  crowns.receiveShadow = true;
  tubes.computeBoundingSphere();
  crowns.computeBoundingSphere();
  ctx.root.add(tubes, crowns);
  ctx.disposables.push(tubeGeo, crownGeo, tubeMat, crownMat, tubeDepth);

  const nbrs = items.map((a, i) => {
    const out = [];
    for (let j = 0; j < n; j++) if (j !== i && Math.hypot(topX[i] - topX[j], topZ[i] - topZ[j]) < 0.8) out.push(j);
    return out;
  });
  const cl = new Float32Array(n), rt = new Float32Array(n), timer = new Float32Array(n), delay = new Float32Array(n), wobT = new Float32Array(n).fill(9);
  const mode = new Uint8Array(n), aware = new Uint8Array(n);
  function snap(i) {
    if (mode[i] === 1 || mode[i] === 2) return;
    mode[i] = 1;
    timer[i] = 3 + rrt() * 2;
    aware[i] = 1;
    for (const j of nbrs[i]) {
      if ((mode[j] === 0 || mode[j] >= 3) && delay[j] === 0) delay[j] = 0.06 + (0.15 * Math.hypot(topX[i] - topX[j], topZ[i] - topZ[j])) / 0.8;
    }
  }
  function update(dt, t, pl) {
    const IA = aI.array, BA = aB.array;
    for (let i = 0; i < n; i++) {
      const d = pl.has ? Math.hypot(pl.p.x - topX[i], pl.p.y - topY[i], pl.p.z - topZ[i]) : 1e4;
      if (d > 2.4) aware[i] = 0;
      let alarm = d < 1.0 || (d < 2.0 && (!aware[i] || pl.speed > 0.9));
      if (delay[i] > 0) {
        delay[i] -= dt;
        if (delay[i] <= 0) {
          delay[i] = 0;
          alarm = true;
        }
      }
      switch (mode[i]) {
        case 0:
          if (alarm) snap(i);
          break;
        case 1:
          cl[i] = Math.min(1, cl[i] + dt / 0.06);
          if (cl[i] > 0.3) rt[i] = Math.min(1, rt[i] + dt / 0.11);
          if (rt[i] >= 1) {
            mode[i] = 2;
            wobT[i] = 0;
          }
          break;
        case 2:
          timer[i] -= dt;
          if (d < 2.0 && pl.speed > 0.9) timer[i] = Math.max(timer[i], 1.5);
          if (timer[i] <= 0 && (d > 2.2 || pl.speed < 0.5)) {
            mode[i] = 3;
            aware[i] = d < 2.4 ? 1 : 0;
          }
          break;
        case 3:
          rt[i] = Math.max(0, rt[i] - dt / 1.3);
          if (alarm) snap(i);
          else if (rt[i] <= 0) mode[i] = 4;
          break;
        default:
          cl[i] = Math.max(0, cl[i] - dt / 1.8);
          if (alarm) snap(i);
          else if (cl[i] <= 0) mode[i] = 0;
      }
      wobT[i] += dt;
      IA[i * 4] = cl[i];
      IA[i * 4 + 1] = rt[i];
      BA[i * 4 + 3] = 0.12 * Math.exp(-4 * wobT[i]) * Math.sin(22 * wobT[i]);
    }
    aI.needsUpdate = true;
    aB.needsUpdate = true;
  }
  return {
    kind: 'fanworms',
    update,
    info: () => ({ kind: 'fanworms', count: n, closed: Array.from(mode).filter((m) => m === 1 || m === 2).length, first: [+topX[0].toFixed(2), +topY[0].toFixed(2), +topZ[0].toFixed(2)] }),
    arrays: () => [aI.array, aB.array, tubes.instanceMatrix.array],
    tops: () => ({ x: topX, y: topY, z: topZ, mode, cl, rt }),
  };
}

const MAJA_BODY_H = 0.07;
const MAJA_LEGS = [];
for (let sd = -1; sd <= 1; sd += 2) {
  for (let k = 0; k < 4; k++) {
    const ang = [0.95, 1.35, 1.8, 2.25][k];
    MAJA_LEGS.push({
      sd,
      k,
      hip: [sd * 0.052, -6e-3, 0.036 - k * 0.028],
      home: [sd * Math.sin(ang) * 0.185, 0, Math.cos(ang) * 0.185],
      L1: [0.1, 0.105, 0.1, 0.092][k],
      L2: [0.128, 0.133, 0.128, 0.118][k],
      group: (k % 2 === 0) === (sd < 0) ? 0 : 1,
    });
  }
}
const MAJA_CLAWS = [-1, 1].map((sd) => ({
  sd,
  hip: [sd * 0.034, -8e-3, 0.068],
  L1: 0.07,
  L2: 0.085,
  rest: [sd * 0.036, -0.036, 0.145],
  mouth: [sd * 0.012, -0.024, 0.093],
  sand: [sd * 0.046, -0.068, 0.168],
  raise: [sd * 0.07, 0.045, 0.12],
}));

function buildMajaCarapace(rng) {
  const g = new Geo({ color: 3 });
  const base = linRGB(0xa3442a), dark = linRGB(0x6b2616), pale = linRGB(0xe3a57e), under = linRGB(0xe8c6a4), algae = linRGB(0x566f26), algae2 = linRGB(0x8aa048);
  const body = new Geo({ color: 3 });
  const WS = 36, HS = 22;
  const P = [0, 0, 0];
  const surf = (sx, sy, sz, out) => {
    const rx = 0.07 * (1 - 0.3 * sstep$2(-0.1, 0.95, sz)), ry = sy > 0 ? 0.036 : 0.021, rz = 0.085;
    const b = 1 + 0.06 * vnoise3$1(sx * 5 + 1.3, sy * 5, sz * 5) + 0.035 * Math.max(0, vnoise3$1(sx * 14, sy * 14 + 3.1, sz * 14));
    out[0] = sx * rx * b;
    out[1] = sy * ry * b;
    out[2] = sz * rz * b;
    return out;
  };
  for (let j = 0; j <= HS; j++) {
    const th = (j / HS) * Math.PI;
    for (let k = 0; k < WS; k++) {
      const ph = (k / WS) * TAU$2;
      const sx = Math.sin(th) * Math.cos(ph), sy = Math.cos(th), sz = Math.sin(th) * Math.sin(ph);
      surf(sx, sy, sz, P);
      const nz = vnoise3$1(sx * 4, sy * 4, sz * 4 + 7);
      body.v(P[0], P[1], P[2], sx, sy, sz, { color: sy > -0.1 ? mixRGB(base, dark, clamp$3(0.5 + 0.6 * nz, 0, 1) * 0.6) : under });
    }
  }
  body.grid(0, HS + 1, WS, true);
  body.smoothNormals();
  body.orientOutward();
  g.append(body);
  const spine = (t) => ({ color: mixRGB(base, pale, t) });
  const NSP = 90;
  for (let i = 0; i < NSP; i++) {
    const y = 1 - ((i + 0.5) / NSP) * 1.25;
    if (y < -0.08) continue;
    const r = Math.sqrt(Math.max(0, 1 - y * y)), th = i * 2.399963;
    surf(r * Math.cos(th), y, r * Math.sin(th), P);
    const margin = 1 - Math.abs(y);
    const n0x = P[0] / 0.0049, n0y = P[1] / 0.0013, n0z = P[2] / 0.0072;
    const nl = Math.hypot(n0x, n0y, n0z) || 1;
    const dx = n0x / nl, dy = n0y / nl + 0.15, dz = n0z / nl + 0.1;
    cone(g, P[0] - dx * 0.001, P[1] - dy * 0.001, P[2] - dz * 0.001, dx, dy, dz, 0.004 + 0.009 * margin + rng() * 0.003, 0.0028 + 0.0012 * margin, 0.0004, 5, spine);
  }
  for (let sx = -1; sx <= 1; sx += 2) {
    cone(g, sx * 0.006, 0.01, 0.078, sx * 0.35, 0.15, 1, 0.042, 0.0042, 0.0008, 6, spine);
    cone(g, sx * 0.016, 0.012, 0.066, sx * 0.6, 0.5, 0.6, 0.008, 0.0022, 0.0018, 6, () => ({ color: base }));
    sphere(g, sx * 0.0205, 0.0165, 0.0705, 0.0034, 0.0034, 0.0034, 10, 8, () => ({ color: [0.02, 0.018, 0.015] }));
  }
  for (let k = 0; k < 5; k++) {
    const th = rng() * TAU$2, yy = 0.55 + rng() * 0.4, r = Math.sqrt(1 - yy * yy);
    surf(r * Math.cos(th), yy, r * Math.sin(th), P);
    for (let m = 0; m < 6; m++) {
      cone(g, P[0] + (rng() - 0.5) * 0.008, P[1], P[2] + (rng() - 0.5) * 0.008, (rng() - 0.5) * 0.8, 1, (rng() - 0.5) * 0.8, 0.008 + rng() * 0.01, 0.0012, 0.0003, 4, (t) => ({ color: mixRGB(algae, algae2, t) }));
    }
  }
  return g.build(true);
}
function buildMajaSeg(lower) {
  const g = new Geo({ color: 3 });
  const base = linRGB(0xb0502e), dark = linRGB(0x7a2d18), pale = linRGB(0xe0a077);
  const pts = [], radii = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    pts.push([0, -0.03 + 1.06 * t, 0]);
    radii.push(lower ? (t < 0.78 ? lerp$1(0.82, 0.6, t / 0.78) : lerp$1(0.6, 0.06, (t - 0.78) / 0.22)) : lerp$1(1.0, 0.8, t) * (1 + 0.12 * Math.sin(t * Math.PI)));
  }
  tube(g, pts, radii, 8, (j, k, t) => ({ color: mixRGB(mixRGB(base, dark, Math.sin(t * 19) > 0.55 ? 0.45 : 0.1), pale, lower ? 0.25 * sstep$2(0.85, 1, t) : 0.5 * sstep$2(0.9, 1, t)) }), { capStart: true, capEnd: true, capLen: 0.02, up: [1, 0, 0] });
  return g.build(true);
}
function buildMajaHand() {
  const g = new Geo({ color: 3 });
  const base = linRGB(0xb85532), pale = linRGB(0xf0c9a0), dark = linRGB(0x40180c);
  const palm = [], pr = [];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    palm.push([0, 0.62 * t - 0.02, 0]);
    pr.push(0.55 + 0.5 * Math.sin(Math.PI * Math.min(1, t * 1.05)));
  }
  tube(g, palm, pr, 10, (j, k, t) => ({ color: mixRGB(base, pale, 0.15 * t) }), { capStart: true, capEnd: true, capLen: 0.05, up: [1, 0, 0] });
  const f = [], fr = [];
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    f.push([0.28 - 0.2 * t * t, 0.58 + 0.42 * t, 0]);
    fr.push(lerp$1(0.42, 0.05, t));
  }
  tube(g, f, fr, 8, (j, k, t) => ({ color: mixRGB(base, dark, sstep$2(0.75, 1, t)) }), { capEnd: true, capLen: 0.05, up: [1, 0, 0] });
  return g.build(true);
}
function buildMajaFinger() {
  const g = new Geo({ color: 3 });
  const base = linRGB(0xb85532), dark = linRGB(0x40180c);
  const f = [], fr = [];
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    f.push([0.3 * t * t, t, 0]);
    fr.push(lerp$1(0.45, 0.05, t));
  }
  tube(g, f, fr, 8, (j, k, t) => ({ color: mixRGB(base, dark, sstep$2(0.7, 1, t)) }), { capStart: true, capEnd: true, capLen: 0.05, up: [1, 0, 0] });
  return g.build(true);
}
const MJ_VDECL =  `
varying vec3 vMjL;
`;
const MJ_VBEGIN =  `
vMjL = position;
`;
const MJ_FDECL =  `
varying vec3 vMjL;
${CR_NOISE}
${CR_BUMP}
`;
const MJ_FNORMAL_CAR =  `
{
  vec2 cc = crCell3(vMjL * 260.0);
  float h = (1.0 - smoothstep(0.0, 0.5, cc.x)) * 0.0006 + crNoise3(vMjL * 900.0) * 0.00015;
  normal = crPerturb(-vViewPosition, normal, h);
}
`;
const MJ_FNORMAL_LIMB =  `
{
  float h = crNoise3(vec3(vMjL.x * 6.0, vMjL.y * 60.0, vMjL.z * 6.0)) * 0.0002;
  normal = crPerturb(-vViewPosition, normal, h);
}
`;

function makeSpiderCrabs(ctx) {
  const W = ctx.W, ground = W.ground, rng = placeRng(0x3a1a), rrt = placeRng(0x3a1b);
  const N = ctx.quality >= 0.75 ? 4 : 3;
  const homes = [];
  const cands = W.sides.filter((p) => p.y - ground.height(p.x, p.z) < 0.6 && Math.hypot(p.x, p.z) < 38 && Math.abs(p.ny) < 0.6);
  let guard = 0;
  while (homes.length < N && guard++ < 800 && cands.length) {
    const p = cands[Math.floor(rng() * cands.length)];
    const nh = Math.hypot(p.nx, p.nz) || 1;
    const d = 1.2 + rng() * 1.6;
    const x = p.x + (p.nx / nh) * d, z = p.z + (p.nz / nh) * d;
    if (!W.sandOK(x, z, 0.5)) continue;
    if (homes.some((h) => Math.hypot(h.x - x, h.z - z) < 6)) continue;
    if (!ctx.free(x, z, 1.0)) continue;
    let room = 0;
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * TAU$2;
      if (W.sandOK(x + Math.cos(a) * 1.5, z + Math.sin(a) * 1.5, 0.3)) room++;
    }
    if (room < 4) continue;
    homes.push({ x, z });
    ctx.claim('maja', x, z, 1.2);
  }
  if (!homes.length) return null;
  const n = homes.length;
  const carGeo = buildMajaCarapace(makeRng(0x3a20));
  const upGeo = buildMajaSeg(false), loGeo = buildMajaSeg(true), handGeo = buildMajaHand(), finGeo = buildMajaFinger();
  const carMat = ctx.patch(injectLit(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.72, metalness: 0 }), { vDecl: MJ_VDECL, vBegin: MJ_VBEGIN, fDecl: MJ_FDECL, fNormal: MJ_FNORMAL_CAR }, 'maja-carapace'));
  const limbMat = ctx.patch(injectLit(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.66, metalness: 0 }), { vDecl: MJ_VDECL, vBegin: MJ_VBEGIN, fDecl: MJ_FDECL, fNormal: MJ_FNORMAL_LIMB }, 'maja-limb'));
  const car = new THREE.InstancedMesh(carGeo, carMat, n);
  const up = new THREE.InstancedMesh(upGeo, limbMat, n * 10);
  const lo = new THREE.InstancedMesh(loGeo, limbMat, n * 8);
  const hand = new THREE.InstancedMesh(handGeo, limbMat, n * 2);
  const fin = new THREE.InstancedMesh(finGeo, limbMat, n * 2);
  const meshes = [car, up, lo, hand, fin];
  const names = ['carapace', 'legs-upper', 'legs-lower', 'claws', 'claw-fingers'];
  meshes.forEach((m, i) => {
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.frustumCulled = false;
    m.castShadow = true;
    m.receiveShadow = true;
    m.name = 'critter-maja-' + names[i];
    ctx.root.add(m);
  });
  ctx.disposables.push(carGeo, upGeo, loGeo, handGeo, finGeo, carMat, limbMat);
  const crabs = homes.map((h) => ({
    S: 0.9 + rng() * 0.25, hx: h.x, hz: h.z, x: h.x, z: h.z, yaw: rng() * TAU$2, speed: 0,
    tx: h.x, tz: h.z, mode: 'pause', timer: 1 + rng() * 3, flee: false, raise: 0, pickT: rng() * 10,
    stepping: false, stepT: 0, stepGroup: 0, lastGroup: 1, bodyY: ground.height(h.x, h.z) + MAJA_BODY_H,
    q: new THREE.Quaternion(), M: new THREE.Matrix4(),
    feet: MAJA_LEGS.map(() => ({ p: new THREE.Vector3(), from: new THREE.Vector3(), to: new THREE.Vector3(), des: new THREE.Vector3() })),
    init: true,
  }));
  const tint = new THREE.Color();
  crabs.forEach((c, ci) => {
    const k = 0.85 + rng() * 0.3, o = ci % 2;
    tint.setRGB(k * (1 + 0.08 * o), k * (0.93 + 0.1 * rng()) * (1 + 0.45 * o), k * 0.95 * (1 - 0.25 * o));
    car.setColorAt(ci, tint);
    for (let q = 0; q < 10; q++) up.setColorAt(ci * 10 + q, tint);
    for (let q = 0; q < 8; q++) lo.setColorAt(ci * 8 + q, tint);
    for (let q = 0; q < 2; q++) {
      hand.setColorAt(ci * 2 + q, tint);
      fin.setColorAt(ci * 2 + q, tint);
    }
  });
  for (const m of meshes) if (m.instanceColor) m.instanceColor.needsUpdate = true;

  const vN = new THREE.Vector3(), vF = new THREE.Vector3(), vP = new THREE.Vector3(), vS = new THREE.Vector3(), vU = new THREE.Vector3(), vR = new THREE.Vector3(), vH = new THREE.Vector3(), vT = new THREE.Vector3();
  const tX = new THREE.Vector3(), tZ = new THREE.Vector3();
  const KN = [0, 0, 0];
  function pickTarget(c) {
    for (let k = 0; k < 12; k++) {
      const a = rrt() * TAU$2, d = 0.6 + rrt() * 2.2;
      const x = c.hx + Math.cos(a) * d, z = c.hz + Math.sin(a) * d;
      if (!W.sandOK(x, z, 0.35) || !W.segmentSand(c.x, c.z, x, z, 0.25)) continue;
      c.tx = x;
      c.tz = z;
      return true;
    }
    return false;
  }
  const FLEE_A = [0, 0.5, -0.5, 1.0, -1, 1.5, -1.5];
  function pickFlee(c, pl) {
    const ax = c.x - pl.p.x, az = c.z - pl.p.z, al = Math.hypot(ax, az) || 1;
    for (const da of FLEE_A) {
      const ca = Math.cos(da), sa = Math.sin(da);
      const dx = (ax / al) * ca - (az / al) * sa, dz = (ax / al) * sa + (az / al) * ca;
      const x = c.x + dx * 1.2, z = c.z + dz * 1.2;
      if (W.sandOK(x, z, 0.3) && W.segmentSand(c.x, c.z, x, z, 0.22)) {
        c.tx = x;
        c.tz = z;
        return true;
      }
    }
    return false;
  }
  function updateCrab(c, ci, dt, t, pl) {
    const S = c.S;
    const dP = pl.has ? Math.hypot(pl.p.x - c.x, pl.p.z - c.z) : 1e4;
    const near = pl.has && dP < 2.0 && Math.abs(pl.p.y - c.bodyY) < 3;
    if (near && !c.flee && pickFlee(c, pl)) {
      c.flee = true;
      c.mode = 'walk';
    }
    if (c.flee && dP > 3.2 && c.mode === 'pause') c.flee = false;
    c.raise += ((pl.has && dP < 1.3 ? 1 : 0) - c.raise) * expK(3, dt);
    let spT = 0;
    if (c.mode === 'walk') {
      const dx = c.tx - c.x, dz = c.tz - c.z, d = Math.hypot(dx, dz);
      if (d < 0.08) {
        c.mode = 'pause';
        c.timer = c.flee ? 1.5 : 3 + rrt() * 4;
        c.pickT = 0;
      } else {
        const err = wrapPi(Math.atan2(dx, dz) - c.yaw);
        const tr = (c.flee ? 1.6 : 0.8) * dt;
        c.yaw = wrapPi(c.yaw + clamp$3(err, -tr, tr));
        spT = Math.abs(err) < 0.35 ? (c.flee ? 0.13 : 0.06) * S : 0;
      }
    } else {
      c.timer -= dt;
      c.pickT += dt;
      if (c.timer <= 0) {
        if (pickTarget(c)) c.mode = 'walk';
        else c.timer = 2;
      }
    }
    c.speed += (spT - c.speed) * expK(3, dt);
    if (c.speed > 1e-4) {
      const nx = c.x + Math.sin(c.yaw) * c.speed * dt, nz = c.z + Math.cos(c.yaw) * c.speed * dt;
      if (W.sandOK(nx, nz, 0.18)) {
        c.x = nx;
        c.z = nz;
      } else {
        c.speed = 0;
        if (!pickTarget(c)) {
          c.mode = 'pause';
          c.timer = 1 + rrt();
        }
      }
    }
    const gy = ground.height(c.x, c.z);
    ground.normal(c.x, c.z, vN).lerp(Y_UP$1, 0.5).normalize();
    const bodyT = gy + MAJA_BODY_H * S - (c.stepping ? 0.004 * S * Math.sin(Math.PI * c.stepT) : 0);
    c.bodyY = c.init ? bodyT : c.bodyY + (bodyT - c.bodyY) * expK(8, dt);
    vF.set(Math.sin(c.yaw), 0, Math.cos(c.yaw));
    lookQuat(vF, vN, c.q, tX, tZ);
    c.M.compose(vP.set(c.x, c.bodyY, c.z), c.q, vS.setScalar(S));
    c.M.toArray(car.instanceMatrix.array, ci * 16);
    const cy = Math.cos(c.yaw), sy = Math.sin(c.yaw);
    for (let l = 0; l < 8; l++) {
      const L = MAJA_LEGS[l], f = c.feet[l];
      const hx = L.home[0] * S, hz = L.home[2] * S;
      const wx = c.x + hx * cy + hz * sy, wz = c.z - hx * sy + hz * cy;
      f.des.set(wx, ground.height(wx, wz), wz);
      if (c.init) f.p.copy(f.des);
    }
    const stride = (c.flee ? 0.055 : 0.042) * S;
    const dur = c.flee ? 0.2 : 0.3;
    if (!c.stepping) {
      let needA = 0, needB = 0;
      const th = c.speed > 0.005 ? stride : 0.012 * S;
      for (let l = 0; l < 8; l++) {
        const f = c.feet[l];
        if (Math.hypot(f.p.x - f.des.x, f.p.z - f.des.z) > th) {
          if (MAJA_LEGS[l].group === 0) needA++;
          else needB++;
        }
      }
      let gsel = -1;
      if (needA && needB) gsel = c.lastGroup === 0 ? 1 : 0;
      else if (needA) gsel = 0;
      else if (needB) gsel = 1;
      if (gsel >= 0) {
        c.stepping = true;
        c.stepGroup = gsel;
        c.stepT = 0;
        const lead = c.speed * dur * 0.6;
        for (let l = 0; l < 8; l++) {
          if (MAJA_LEGS[l].group !== gsel) continue;
          const f = c.feet[l];
          f.from.copy(f.p);
          f.to.set(f.des.x + sy * lead, 0, f.des.z + cy * lead);
          f.to.y = ground.height(f.to.x, f.to.z);
        }
      }
    }
    if (c.stepping) {
      c.stepT = Math.min(1, c.stepT + dt / dur);
      const u = c.stepT, e = u * u * (3 - 2 * u);
      for (let l = 0; l < 8; l++) {
        if (MAJA_LEGS[l].group !== c.stepGroup) continue;
        const f = c.feet[l];
        f.p.lerpVectors(f.from, f.to, e);
        f.p.y += Math.sin(Math.PI * u) * 0.032 * S;
      }
      if (u >= 1) {
        c.stepping = false;
        c.lastGroup = c.stepGroup;
      }
    }
    vU.set(0, 1, 0).applyQuaternion(c.q);
    vR.set(1, 0, 0).applyQuaternion(c.q);
    const UA = up.instanceMatrix.array, LA = lo.instanceMatrix.array;
    for (let l = 0; l < 8; l++) {
      const L = MAJA_LEGS[l], f = c.feet[l];
      vH.set(L.hip[0], L.hip[1], L.hip[2]).applyMatrix4(c.M);
      const a = L.L1 * S, b = L.L2 * S;
      solveKnee(vH.x, vH.y, vH.z, f.p.x, f.p.y, f.p.z, a, b, vU.x + vR.x * L.sd * 0.7, vU.y + vR.y * L.sd * 0.7, vU.z + vR.z * L.sd * 0.7, KN);
      writeSegment(UA, (ci * 10 + l) * 16, vH.x, vH.y, vH.z, KN[0], KN[1], KN[2], 0.0068 * S, 0.0068 * S, vU.x, vU.y, vU.z);
      const dx = f.p.x - KN[0], dy = f.p.y - KN[1], dz = f.p.z - KN[2];
      const dl = Math.hypot(dx, dy, dz) || 1e-6, ll = Math.min(dl, b);
      writeSegment(LA, (ci * 8 + l) * 16, KN[0], KN[1], KN[2], KN[0] + (dx / dl) * ll, KN[1] + (dy / dl) * ll, KN[2] + (dz / dl) * ll, 0.0054 * S, 0.0054 * S, vU.x, vU.y, vU.z);
    }
    const HA = hand.instanceMatrix.array, FA = fin.instanceMatrix.array;
    for (let s2 = 0; s2 < 2; s2++) {
      const C = MAJA_CLAWS[s2];
      let tx = C.rest[0], ty = C.rest[1], tz = C.rest[2], open = 0.12;
      if (c.mode === 'pause' && !c.flee) {
        const ph = (((c.pickT * 0.9 + s2 * 0.5) % 1) + 1) % 1;
        let A0 = C.rest, A1 = C.sand, u = 0;
        if (ph < 0.35) {
          u = sstep$2(0, 0.35, ph); A0 = C.rest; A1 = C.sand; open = 0.5;
        } else if (ph < 0.5) {
          u = 1; A0 = C.rest; A1 = C.sand; open = lerp$1(0.5, 0.02, sstep$2(0.35, 0.45, ph));
        } else if (ph < 0.85) {
          u = sstep$2(0.5, 0.85, ph); A0 = C.sand; A1 = C.mouth; open = 0.02;
        } else {
          u = sstep$2(0.85, 1, ph); A0 = C.mouth; A1 = C.rest; open = lerp$1(0.02, 0.12, u);
        }
        tx = lerp$1(A0[0], A1[0], u); ty = lerp$1(A0[1], A1[1], u); tz = lerp$1(A0[2], A1[2], u);
      }
      tx = lerp$1(tx, C.raise[0], c.raise);
      ty = lerp$1(ty, C.raise[1], c.raise);
      tz = lerp$1(tz, C.raise[2], c.raise);
      open = lerp$1(open, 0.6, c.raise);
      vT.set(tx, ty, tz).applyMatrix4(c.M);
      vH.set(C.hip[0], C.hip[1], C.hip[2]).applyMatrix4(c.M);
      const a = C.L1 * S, b = C.L2 * S;
      solveKnee(vH.x, vH.y, vH.z, vT.x, vT.y, vT.z, a, b, vR.x * C.sd - vU.x * 0.4, vR.y * C.sd - vU.y * 0.4, vR.z * C.sd - vU.z * 0.4, KN);
      writeSegment(UA, (ci * 10 + 8 + s2) * 16, vH.x, vH.y, vH.z, KN[0], KN[1], KN[2], 0.0072 * S, 0.0072 * S, vU.x, vU.y, vU.z);
      const dx = vT.x - KN[0], dy = vT.y - KN[1], dz = vT.z - KN[2];
      const dl = Math.hypot(dx, dy, dz) || 1e-6, hl = Math.min(dl, b);
      const thx = 0.011 * S, thz = 0.0085 * S;
      const o = (ci * 2 + s2) * 16;
      writeSegment(HA, o, KN[0], KN[1], KN[2], KN[0] + (dx / dl) * hl, KN[1] + (dy / dl) * hl, KN[2] + (dz / dl) * hl, thx, thz, vU.x * C.sd, vU.y * C.sd, vU.z * C.sd);
      const Xx = HA[o] / thx, Xy = HA[o + 1] / thx, Xz = HA[o + 2] / thx;
      const Yx = HA[o + 4] / hl, Yy = HA[o + 5] / hl, Yz = HA[o + 6] / hl;
      const Zx = HA[o + 8] / thz, Zy = HA[o + 9] / thz, Zz = HA[o + 10] / thz;
      const ca = Math.cos(open), sa = Math.sin(open);
      const fl = hl * 0.42, ft = 0.85;
      FA[o] = (Xx * ca + Yx * sa) * thx * ft; FA[o + 1] = (Xy * ca + Yy * sa) * thx * ft; FA[o + 2] = (Xz * ca + Yz * sa) * thx * ft; FA[o + 3] = 0;
      FA[o + 4] = (Yx * ca - Xx * sa) * fl; FA[o + 5] = (Yy * ca - Xy * sa) * fl; FA[o + 6] = (Yz * ca - Xz * sa) * fl; FA[o + 7] = 0;
      FA[o + 8] = Zx * thz * ft; FA[o + 9] = Zy * thz * ft; FA[o + 10] = Zz * thz * ft; FA[o + 11] = 0;
      FA[o + 12] = KN[0] + Yx * hl * 0.58 - Xx * thx * 0.28;
      FA[o + 13] = KN[1] + Yy * hl * 0.58 - Xy * thx * 0.28;
      FA[o + 14] = KN[2] + Yz * hl * 0.58 - Xz * thx * 0.28;
      FA[o + 15] = 1;
    }
    ctx.shadows.add(c.x, c.z, 0.17 * S, 0.2 * S, c.yaw, 0.45);
    c.init = false;
  }
  function update(dt, t, pl) {
    for (let i = 0; i < n; i++) updateCrab(crabs[i], i, dt, t, pl);
    for (const m of meshes) m.instanceMatrix.needsUpdate = true;
  }
  return {
    kind: 'spidercrabs',
    update,
    info: () => ({ kind: 'spidercrabs', crabs: crabs.map((c) => ({ x: +c.x.toFixed(2), z: +c.z.toFixed(2), mode: c.mode, flee: c.flee })) }),
    arrays: () => meshes.map((m) => m.instanceMatrix.array),
    crabs,
  };
}

function buildHermitShell() {
  const Wg = 1.45, turns = 6.5, a = 0.55, b = 3.0, c = 0.5;
  const thMax = turns * TAU$2;
  const lnW = Math.log(Wg) / TAU$2;
  const NT = Math.round(turns * 18), NRad = 12;
  const cream = linRGB(0xd8c29c), brown = linRGB(0x86613e), band = linRGB(0x503620), lipC = linRGB(0xf4e9d6), pink = linRGB(0xc4859a);
  const sh = new Geo({ color: 3 });
  const Cth = (th, out) => {
    const gg = Math.exp(lnW * (th - thMax));
    out[0] = gg * a * Math.cos(th);
    out[1] = gg * a * Math.sin(th);
    out[2] = gg * b;
    return gg;
  };
  const Tth = (th, out) => {
    const gg = Math.exp(lnW * (th - thMax));
    out[0] = gg * (lnW * a * Math.cos(th) - a * Math.sin(th));
    out[1] = gg * (lnW * a * Math.sin(th) + a * Math.cos(th));
    out[2] = gg * lnW * b;
    const l = Math.hypot(out[0], out[1], out[2]) || 1;
    out[0] /= l; out[1] /= l; out[2] /= l;
  };
  const frame = (th, T, N1, N2) => {
    Tth(th, T);
    let x = Math.cos(th), y = Math.sin(th), z = 0;
    const dp = x * T[0] + y * T[1] + z * T[2];
    x -= T[0] * dp; y -= T[1] * dp; z -= T[2] * dp;
    const l = Math.hypot(x, y, z) || 1;
    N1[0] = x / l; N1[1] = y / l; N1[2] = z / l;
    N2[0] = T[1] * N1[2] - T[2] * N1[1];
    N2[1] = T[2] * N1[0] - T[0] * N1[2];
    N2[2] = T[0] * N1[1] - T[1] * N1[0];
  };
  const P = [0, 0, 0], T = [0, 0, 0], N1 = [0, 0, 0], N2 = [0, 0, 0];
  for (let i = 0; i <= NT; i++) {
    const th = (i / NT) * thMax;
    const gg = Cth(th, P);
    frame(th, T, N1, N2);
    for (let k = 0; k < NRad; k++) {
      const ph = (k / NRad) * TAU$2, cp = Math.cos(ph), sp = Math.sin(ph);
      const sculpt = 1 + 0.09 * Math.max(0, Math.sin(th * 9)) * (0.6 + 0.4 * cp) + 0.05 * Math.sin(ph * 5);
      const rr = gg * c * sculpt;
      const ox = N1[0] * cp + N2[0] * sp, oy = N1[1] * cp + N2[1] * sp, oz = N1[2] * cp + N2[2] * sp;
      let col = mixRGB(cream, brown, clamp$3(0.35 + 0.5 * vnoise3$1(th * 0.8, ph * 1.3, 2.7), 0, 1));
      col = mixRGB(col, band, Math.sin(ph * 3 + 0.8) > 0.55 ? 0.55 : 0);
      col = mixRGB(col, pink, sstep$2(0.35, 0.6, vnoise3$1(th * 0.5 + 9, ph, 1.1)) * 0.5);
      col = mixRGB(col, lipC, sstep$2(thMax - 0.8, thMax, th) * 0.7);
      sh.v(P[0] + ox * rr, P[1] + oy * rr, P[2] + oz * rr, ox, oy, oz, { color: col });
    }
  }
  sh.grid(0, NT + 1, NRad, true);
  {
    const th = thMax - 0.28;
    const gg = Cth(th, P);
    frame(th, T, N1, N2);
    const cidx = sh.v(P[0], P[1], P[2], T[0], T[1], T[2], { color: [0.03, 0.02, 0.018] });
    const r0 = sh.count;
    for (let k = 0; k < NRad; k++) {
      const ph = (k / NRad) * TAU$2;
      const ox = N1[0] * Math.cos(ph) + N2[0] * Math.sin(ph), oy = N1[1] * Math.cos(ph) + N2[1] * Math.sin(ph), oz = N1[2] * Math.cos(ph) + N2[2] * Math.sin(ph);
      sh.v(P[0] + ox * gg * c * 0.95, P[1] + oy * gg * c * 0.95, P[2] + oz * gg * c * 0.95, T[0], T[1], T[2], { color: [0.05, 0.035, 0.03] });
    }
    for (let k = 0; k < NRad; k++) sh.tri(cidx, r0 + k, r0 + ((k + 1) % NRad));
  }
  Tth(thMax, T);
  const e1 = new THREE.Vector3(0, 0, 1);
  const e2 = new THREE.Vector3(T[0], T[1], T[2]).addScaledVector(e1, -T[2]).normalize();
  const e3 = new THREE.Vector3().crossVectors(e1, e2);
  const f1 = new THREE.Vector3(0, -0.3, 0.95).normalize();
  const f2 = new THREE.Vector3(0, -1, 0).addScaledVector(f1, f1.y).normalize();
  const f3 = new THREE.Vector3().crossVectors(f1, f2);
  const Em = new THREE.Matrix4().makeBasis(e1, e2, e3);
  const Fm = new THREE.Matrix4().makeBasis(f1, f2, f3);
  const R = Fm.multiply(Em.transpose());
  const sc = 0.042 / 3.6;
  const M = new THREE.Matrix4().makeScale(sc, sc, sc).premultiply(R);
  const out = new Geo({ color: 3 });
  out.append(sh, M);
  let minY = Infinity;
  for (let k = 1; k < out.p.length; k += 3) minY = Math.min(minY, out.p[k]);
  Cth(thMax, P);
  const ac = new THREE.Vector3(P[0], P[1], P[2]).applyMatrix4(M);
  let maxZ = -Infinity;
  for (let k = 2; k < out.p.length; k += 3) maxZ = Math.max(maxZ, out.p[k]);
  const dx = -ac.x, dy = 0.0075 - minY, dz = 0.002 - ac.z;
  for (let k = 0; k < out.p.length; k += 3) {
    out.p[k] += dx;
    out.p[k + 1] += dy;
    out.p[k + 2] += dz;
  }
  ac.x += dx;
  ac.y += dy;
  ac.z += dz;
  return { geo: out.build(true), ac: [ac.x, ac.y, ac.z], len: maxZ - minY };
}
function buildHermitBody(AC) {
  const g = new Geo({ color: 3, aHc: 4, aHcP: 3 });
  const red = linRGB(0xd2461c), dred = linRGB(0x8e2a10), orange = linRGB(0xe8732a), white = linRGB(0xf2ede4), blue = linRGB(0x3a6ad0), black = [0.01, 0.01, 0.012];
  const [ax, ay, az] = AC;
  const P0 = [0, 0, 0];
  const ex = (col, id, t, side, lp, piv) => ({ color: col, aHc: [id, t, side, lp], aHcP: piv });
  const mid = (p, q, dy) => [lerp$1(p[0], q[0], 0.5), lerp$1(p[1], q[1], 0.5) + (dy || 0), lerp$1(p[2], q[2], 0.5)];
  sphere(g, ax, ay - 0.0015, az + 0.0055, 0.0047, 0.0035, 0.006, 12, 9, (sx, sy) => ex(mixRGB(red, dred, sy > 0 ? 0.3 : 0), 0, 0, 0, 0, P0));
  for (let sd = -1; sd <= 1; sd += 2) {
    const e0 = [ax + sd * 0.0021, ay + 0.0005, az + 0.0102], e1 = [ax + sd * 0.0035, ay + 0.0068, az + 0.0152];
    tube(g, [e0, mid(e0, e1), e1], [0.0008, 0.00075, 0.0007], 6, (j, k, t) => ex(t > 0.8 ? blue : orange, 7, t * 0.3, sd, 0, P0));
    sphere(g, e1[0], e1[1] + 0.0008, e1[2] + 0.0004, 0.0012, 0.0013, 0.0012, 8, 6, () => ex(black, 7, 0.3, sd, 0, P0));
    const a0 = [ax + sd * 0.0027, ay - 0.0005, az + 0.0108];
    tube(g, [a0, [a0[0] + sd * 0.003, a0[1] + 0.004, a0[2] + 0.006], [a0[0] + sd * 0.008, a0[1] + 0.0075, a0[2] + 0.016], [a0[0] + sd * 0.013, a0[1] + 0.0095, a0[2] + 0.026]], [0.00036, 0.0003, 0.00022, 0.00014], 4, (j, k, t) => ex(orange, 7, t, sd, 0, P0));
    const cid = sd > 0 ? 6 : 5;
    const c0 = [ax + sd * 0.0034, ay - 0.0038, az + 0.0092], c1 = [ax + sd * 0.0074, ay - 0.0048, az + 0.0168], c2 = [ax + sd * 0.0064, ay - 0.0062, az + 0.0262];
    tube(g, [c0, mid(c0, c1), c1], [0.0011, 0.001, 0.0012], 6, (j, k, t) => ex(red, cid, t * 0.5, sd, 0, c0));
    const q1 = [lerp$1(c1[0], c2[0], 0.35), lerp$1(c1[1], c2[1], 0.35) + 0.0004, lerp$1(c1[2], c2[2], 0.35)], q2 = [lerp$1(c1[0], c2[0], 0.7), lerp$1(c1[1], c2[1], 0.7), lerp$1(c1[2], c2[2], 0.7)];
    tube(g, [c1, q1, q2, c2], [0.0014, 0.0021, 0.0016, 0.0005], 8, (j, k, t) => ex(t > 0.8 ? white : mixRGB(dred, red, 0.5), cid, 0.5 + t * 0.5, sd, 0, c0), { capEnd: true, capLen: 0.8 });
    const legs = [
      { h: [0.0042, -35e-4, 0.0085], k: [0.012, 0.003, 0.0135], f: [0.0175, 0, 0.0175], id: 1, lp: sd < 0 ? 0 : Math.PI },
      { h: [0.0048, -38e-4, 0.0048], k: [0.013, 0.0025, 0.0055], f: [0.019, 0, 0.0035], id: 3, lp: sd < 0 ? Math.PI : 0 },
    ];
    for (const L of legs) {
      const hp = [ax + sd * L.h[0], ay + L.h[1], az + L.h[2]];
      const kp = [ax + sd * L.k[0], ay + L.k[1], az + L.k[2]];
      const fp = [ax + sd * L.f[0], 0.0003, az + L.f[2]];
      const idv = L.id + (sd > 0 ? 1 : 0);
      tube(g, [hp, mid(hp, kp, 0.0006), kp, mid(kp, fp, 0.0008), fp], [0.00105, 0.001, 0.0009, 0.0007, 0.00025], 6, (j, k, t) => ex(t > 0.85 ? dred : t > 0.45 && t < 0.55 ? white : red, idv, t, sd, L.lp, hp), { capEnd: true, capLen: 0.6 });
    }
  }
  return g.build(true);
}
const HC_VDECL = (ac) =>  `
attribute vec4 aHc;
attribute vec3 aHcP;
attribute vec4 aHcI;
uniform float uCrTime;
const vec3 HC_AP = ${g3(ac)};
`;
const HC_VBEGIN =  `
{
  float id = aHc.x;
  float walk = aHcI.y;
  if (id > 0.5 && id < 4.5) {
    float ph = aHcI.x + aHc.w;
    float sw = walk * 0.38 * sin(ph);
    vec3 d = transformed - aHcP;
    float cs = cos(sw);
    float sn = sin(sw);
    d = vec3(d.x * cs + d.z * sn, d.y, -d.x * sn + d.z * cs);
    d.y += walk * 0.0026 * max(0.0, cos(ph)) * aHc.y;
    transformed = aHcP + d;
  } else if (id > 4.5 && id < 6.5) {
    float ang = aHcI.w * 0.35 * sin(uCrTime * 3.0 + aHc.z * 1.3) + walk * 0.12 * sin(aHcI.x);
    vec3 d = transformed - aHcP;
    float cs = cos(ang);
    float sn = sin(ang);
    d = vec3(d.x, d.y * cs - d.z * sn, d.y * sn + d.z * cs);
    transformed = aHcP + d;
  } else if (id > 6.5) {
    transformed.x += sin(uCrTime * 2.2 + aHc.z * 2.0) * 0.0018 * aHc.y * aHc.y;
    transformed.y += cos(uCrTime * 1.7 + aHc.z) * 0.0012 * aHc.y * aHc.y;
  }
  transformed = mix(transformed, HC_AP + (transformed - HC_AP) * 0.28 + vec3(0.0, 0.004, -0.004), aHcI.z);
}
`;
const HC_FEMIS =  `
totalEmissiveRadiance += diffuseColor.rgb * 0.08;
`;

function makeHermits(ctx) {
  const W = ctx.W, ground = W.ground, rng = placeRng(0x4e2), rrt = placeRng(0x4e3);
  const N = ctx.quality >= 0.75 ? 6 : 4;
  const spots = [];
  let guard = 0;
  while (spots.length < N && guard++ < 1500) {
    let x, z;
    if (W.amph.length) {
      const a = W.amph[Math.floor(rng() * W.amph.length)];
      const ang = rng() * TAU$2, d = 0.4 + rng() * 0.7;
      x = a.p.x + Math.cos(ang) * d;
      z = a.p.z + Math.sin(ang) * d;
    } else {
      const ang = rng() * TAU$2, d = 3 + rng() * 6;
      x = Math.cos(ang) * d;
      z = Math.sin(ang) * d;
    }
    if (!W.sandOK(x, z, 0.1, { core: true })) continue;
    if (spots.some((s) => Math.hypot(s.x - x, s.z - z) < 1.5)) continue;
    if (!ctx.free(x, z, 0.3)) continue;
    spots.push({ x, z });
  }
  if (!spots.length) return null;
  const n = spots.length;
  const shell = buildHermitShell();
  const bodyGeo = buildHermitBody(shell.ac);
  const aI = new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4).setUsage(THREE.DynamicDrawUsage);
  bodyGeo.setAttribute('aHcI', aI);
  const U = { uCrTime: ctx.time };
  const shellMat = ctx.patch(injectLit(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0 }), {}, 'hermit-shell'));
  const bodyMat = ctx.patch(injectLit(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0 }), { uniforms: U, vDecl: HC_VDECL(shell.ac), vBegin: HC_VBEGIN, fEmissive: HC_FEMIS }, 'hermit-body'));
  const shells = new THREE.InstancedMesh(shell.geo, shellMat, n), bodies = new THREE.InstancedMesh(bodyGeo, bodyMat, n);
  shells.name = 'critter-hermit-shells';
  bodies.name = 'critter-hermit-bodies';
  for (const m of [shells, bodies]) {
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.frustumCulled = false;
    m.castShadow = true;
    m.receiveShadow = true;
    ctx.root.add(m);
  }
  ctx.disposables.push(shell.geo, bodyGeo, shellMat, bodyMat);
  const hs = spots.map((s) => ({ x: s.x, z: s.z, hx: s.x, hz: s.z, y: 0, yaw: rng() * TAU$2, mode: 'idle', timer: rng() * 3, tx: s.x, tz: s.z, speed: 0, phase: rng() * TAU$2, retract: 0, sc: 0.9 + rng() * 0.25 }));
  const vN = new THREE.Vector3(), vF = new THREE.Vector3(), vP = new THREE.Vector3(), vS = new THREE.Vector3(), tX = new THREE.Vector3(), tZ = new THREE.Vector3();
  const q = new THREE.Quaternion(), qr = new THREE.Quaternion(), M = new THREE.Matrix4();
  const Z_AX = new THREE.Vector3(0, 0, 1);
  function pickBurst(h) {
    for (let k = 0; k < 8; k++) {
      const a = h.yaw + (rrt() - 0.5) * 2.6;
      const d = 0.1 + rrt() * 0.25;
      const x = h.x + Math.sin(a) * d, z = h.z + Math.cos(a) * d;
      if (Math.hypot(x - h.hx, z - h.hz) > 1.2) continue;
      if (!W.sandOK(x, z, 0.08, { core: true })) continue;
      h.tx = x;
      h.tz = z;
      return true;
    }
    h.tx = h.hx;
    h.tz = h.hz;
    return true;
  }
  function update(dt, t, pl) {
    const SA = shells.instanceMatrix.array, BA = bodies.instanceMatrix.array, IA = aI.array;
    for (let i = 0; i < n; i++) {
      const h = hs[i];
      const d = pl.has ? Math.hypot(pl.p.x - h.x, pl.p.y - (h.y + 0.02), pl.p.z - h.z) : 1e4;
      if (d < 1.2 && h.mode !== 'hide') {
        h.mode = 'hide';
        h.timer = 3 + rrt() * 3;
      }
      let spT = 0;
      if (h.mode === 'hide') {
        if (d > 1.5) h.timer -= dt;
        if (h.timer <= 0) {
          h.mode = 'idle';
          h.timer = 0.6 + rrt();
        }
      } else if (h.mode === 'idle') {
        h.timer -= dt;
        if (h.timer <= 0 && pickBurst(h)) h.mode = 'run';
      } else {
        const dx = h.tx - h.x, dz = h.tz - h.z, dd = Math.hypot(dx, dz);
        if (dd < 0.015) {
          h.mode = 'idle';
          h.timer = 1 + rrt() * 3;
        } else {
          const err = wrapPi(Math.atan2(dx, dz) - h.yaw);
          h.yaw = wrapPi(h.yaw + clamp$3(err, -5 * dt, 5 * dt));
          spT = Math.abs(err) < 0.6 ? 0.16 : 0.03;
        }
      }
      h.speed += (spT - h.speed) * expK(10, dt);
      if (h.speed > 1e-4) {
        const nx = h.x + Math.sin(h.yaw) * h.speed * dt, nz = h.z + Math.cos(h.yaw) * h.speed * dt;
        if (W.sandOK(nx, nz, 0.06, { core: true })) {
          h.x = nx;
          h.z = nz;
        } else {
          h.mode = 'idle';
          h.timer = 0.5;
          h.speed = 0;
        }
      }
      h.phase += h.speed * dt * 524;
      h.retract += ((h.mode === 'hide' ? 1 : 0) - h.retract) * expK(h.mode === 'hide' ? 14 : 2.2, dt);
      const walk = clamp$3(h.speed / 0.16, 0, 1);
      h.y = ground.height(h.x, h.z);
      const lift = (-75e-4 * h.retract + 0.0008 * walk * Math.abs(Math.sin(h.phase))) * h.sc;
      ground.normal(h.x, h.z, vN).lerp(Y_UP$1, 0.3).normalize();
      vF.set(Math.sin(h.yaw), 0, Math.cos(h.yaw));
      lookQuat(vF, vN, q, tX, tZ);
      q.multiply(qr.setFromAxisAngle(Z_AX, 0.07 * walk * Math.sin(h.phase * 0.5)));
      M.compose(vP.set(h.x, h.y + lift, h.z), q, vS.setScalar(h.sc));
      M.toArray(SA, i * 16);
      M.toArray(BA, i * 16);
      IA[i * 4] = h.phase;
      IA[i * 4 + 1] = walk;
      IA[i * 4 + 2] = h.retract;
      IA[i * 4 + 3] = h.mode === 'idle' ? 1 : 0;
      ctx.shadows.add(h.x, h.z, 0.03 * h.sc, 0.04 * h.sc, h.yaw, 0.45);
    }
    shells.instanceMatrix.needsUpdate = true;
    bodies.instanceMatrix.needsUpdate = true;
    aI.needsUpdate = true;
  }
  return {
    kind: 'hermits',
    update,
    info: () => ({ kind: 'hermits', count: n, shellLen: +shell.len.toFixed(4), ac: shell.ac.map((v) => +v.toFixed(4)), crabs: hs.map((h) => ({ x: +h.x.toFixed(2), z: +h.z.toFixed(2), mode: h.mode })) }),
    arrays: () => [shells.instanceMatrix.array, bodies.instanceMatrix.array, aI.array],
    hs,
  };
}

const SC_R = 0.022;
const SC_HL = 0.12;
const SC_YC = SC_R * 0.85;
function buildCucumberGeo(rng) {
  const g = new Geo({ color: 3 });
  const dark = linRGB(0x3a1b1d), mid = linRGB(0x5c2e2b), belly = linRGB(0x7c5c4b), tip = linRGB(0xb39585);
  const rf = (z) => Math.pow(Math.max(0, 1 - Math.pow(Math.abs(z / SC_HL), 3.2)), 0.42);
  const body = new Geo({ color: 3 });
  const NZ = 44, NR = 20;
  for (let j = 0; j <= NZ; j++) {
    const z = -SC_HL + (2 * SC_HL * j) / NZ;
    for (let k = 0; k < NR; k++) {
      const ph = (k / NR) * TAU$2, sp = Math.sin(ph), cp = Math.cos(ph);
      const r = SC_R * rf(z) * (1 + 0.05 * vnoise3$1(cp * 2 + 3, z * 30, sp * 2));
      const nz = vnoise3$1(cp * 3, z * 40, sp * 3 + 5);
      body.v(r * cp, SC_YC + r * sp * (sp < 0 ? 0.72 : 1), z, cp, sp, 0, { color: sp < -0.35 ? belly : mixRGB(dark, mid, clamp$3(0.5 + 0.6 * nz, 0, 1)) });
    }
  }
  body.grid(0, NZ + 1, NR, true);
  body.smoothNormals();
  body.orientOutward();
  g.append(body);
  for (let i = 0; i < 95; i++) {
    const z = (rng() * 2 - 1) * SC_HL * 0.85;
    const ph = lerp$1(0.25, Math.PI - 0.25, rng());
    const r = SC_R * rf(z);
    const cp = Math.cos(ph), sp = Math.sin(ph);
    const len = 0.004 + rng() * 0.004, rad = 0.0024 + rng() * 0.0016;
    cone(g, r * cp - cp * 0.001, SC_YC + r * sp - sp * 0.001, z, cp, sp, 0, len, rad, rad * 0.15, 5, (t) => ({ color: mixRGB(dark, tip, t * t) }));
  }
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * TAU$2;
    cone(g, Math.cos(a) * 0.006, SC_YC + Math.sin(a) * 0.0045, SC_HL - 0.004, Math.cos(a) * 0.3, Math.sin(a) * 0.3, 1, 0.005, 0.0012, 0.0005, 4, () => ({ color: mid }));
  }
  return g.build(true);
}
const SC_VDECL =  `
uniform float uCrTime;
varying vec3 vScL;
`;
const SC_VBEGIN =  `
vScL = position;
{
  float ph = 0.0;
  #ifdef USE_INSTANCING
    ph = fract(sin(dot(vec2(instanceMatrix[3][0], instanceMatrix[3][2]), vec2(12.9898, 78.233))) * 43758.5453) * 6.2831853;
  #endif
  float yc = ${gf(SC_YC)};
  float wv = sin(position.z * 40.0 - uCrTime * 0.7 + ph);
  float rs = 1.0 + 0.07 * wv;
  transformed.x *= rs;
  transformed.y = yc + (transformed.y - yc) * rs;
  transformed.z += 0.004 * cos(position.z * 40.0 - uCrTime * 0.7 + ph);
  float e = position.z / ${gf(SC_HL)};
  transformed.x += 0.006 * sin(uCrTime * 0.21 + ph) * e * e;
}
`;
const SC_FDECL =  `
varying vec3 vScL;
${CR_NOISE}
`;
const SC_FCOLOR =  `
{
  vec3 p = vScL;
  float n = crFbm3(p * 60.0);
  diffuseColor.rgb *= 0.8 + 0.4 * n;
  vec2 cc = crCell3(p * 520.0);
  float grain = (1.0 - smoothstep(0.1, 0.22, cc.x)) * step(0.8, cc.y) * smoothstep(0.004, 0.02, p.y);
  diffuseColor.rgb = mix(diffuseColor.rgb, ${gc(0xd8c8a8)}, grain * 0.7);
  diffuseColor.rgb = max(diffuseColor.rgb, vec3(0.0));
}
`;
function makeCucumbers(ctx) {
  const W = ctx.W, ground = W.ground, rng = placeRng(0x5c5c);
  const N = Math.max(6, Math.round(10 * ctx.quality));
  const items = [];
  let guard = 0;
  while (items.length < N && guard++ < 3000) {
    let x, z;
    if (rng() < 0.35 && W.meadow) {
      const a = rng() * TAU$2, d = W.meadow.r * (0.85 + rng() * 0.3);
      x = W.meadow.x + Math.cos(a) * d * 1.25;
      z = W.meadow.z + Math.sin(a) * d;
    } else {
      const a = rng() * TAU$2, d = 5 + rng() * 30;
      x = Math.cos(a) * d;
      z = Math.sin(a) * d - 4;
    }
    if (!W.sandOK(x, z, 0.4) || !ctx.free(x, z, 0.8)) continue;
    if (items.some((it) => Math.hypot(it.x - x, it.z - z) < 3)) continue;
    items.push({ x, z, yaw: rng() * TAU$2, sc: 0.85 + rng() * 0.35, sp: 0.0008 + rng() * 0.0008, turn: (rng() - 0.5) * 0.02 });
    ctx.claim('holothuria', x, z, 0.35);
  }
  if (!items.length) return null;
  const n = items.length;
  const geo = buildCucumberGeo(makeRng(0x5c5d));
  const mat = ctx.patch(injectLit(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78, metalness: 0 }), { uniforms: { uCrTime: ctx.time }, vDecl: SC_VDECL, vBegin: SC_VBEGIN, fDecl: SC_FDECL, fColor: SC_FCOLOR }, 'holothuria'));
  const mesh = new THREE.InstancedMesh(geo, mat, n);
  mesh.name = 'critter-holothuria';
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  ctx.root.add(mesh);
  ctx.disposables.push(geo, mat);
  const vN = new THREE.Vector3(), vF = new THREE.Vector3(), vP = new THREE.Vector3(), vS = new THREE.Vector3(), tX = new THREE.Vector3(), tZ = new THREE.Vector3(), q = new THREE.Quaternion(), M = new THREE.Matrix4();
  let acc = 1;
  function place() {
    for (let i = 0; i < n; i++) {
      const it = items[i];
      ground.normal(it.x, it.z, vN);
      vF.set(Math.sin(it.yaw), 0, Math.cos(it.yaw));
      lookQuat(vF, vN, q, tX, tZ);
      M.compose(vP.set(it.x, ground.height(it.x, it.z) - 0.003 * it.sc, it.z), q, vS.setScalar(it.sc));
      M.toArray(mesh.instanceMatrix.array, i * 16);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }
  function update(dt) {
    acc += dt;
    if (acc >= 0.5) {
      for (const it of items) {
        it.yaw += it.turn * acc;
        const nx = it.x + Math.sin(it.yaw) * it.sp * acc, nz = it.z + Math.cos(it.yaw) * it.sp * acc;
        if (W.sandOK(nx, nz, 0.3)) {
          it.x = nx;
          it.z = nz;
        } else it.yaw += 0.6;
      }
      place();
      acc = 0;
    }
    for (const it of items) ctx.shadows.add(it.x, it.z, 0.045 * it.sc, 0.14 * it.sc, it.yaw, 0.4);
  }
  return {
    kind: 'cucumbers',
    update,
    info: () => ({ kind: 'cucumbers', count: n, first: [+items[0].x.toFixed(2), +items[0].z.toFixed(2)] }),
    arrays: () => [mesh.instanceMatrix.array],
  };
}

const CU_KEYS = [
  [-0.155, 0, 0], [-0.149, 0.011, 0.007], [-0.138, 0.024, 0.015], [-0.1, 0.046, 0.028], [-0.03, 0.062, 0.036],
  [0.04, 0.058, 0.034], [0.09, 0.048, 0.03], [0.105, 0.043, 0.027], [0.125, 0.05, 0.03], [0.145, 0.043, 0.026], [0.165, 0.028, 0.02],
];
function cuProfile(z) {
  const K = CU_KEYS;
  if (z <= K[0][0]) return [0, 0];
  if (z >= K[K.length - 1][0]) return [K[K.length - 1][1], K[K.length - 1][2]];
  let i = 0;
  while (i < K.length - 2 && z > K[i + 1][0]) i++;
  const t = (z - K[i][0]) / (K[i + 1][0] - K[i][0]);
  const p0 = K[Math.max(0, i - 1)], p1 = K[i], p2 = K[i + 1], p3 = K[Math.min(K.length - 1, i + 2)];
  const cr = (a, b, c, d) => 0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (3 * b - a - 3 * c + d) * t * t * t);
  return [Math.max(0, cr(p0[1], p1[1], p2[1], p3[1])), Math.max(0, cr(p0[2], p1[2], p2[2], p3[2]))];
}
const cuYc = (z) => -4e-3 * sstep$2(0.1, 0.13, z);
const CU_EYE = [0.046, 0.009, 0.126];
function buildCuttleGeo() {
  const g = new Geo({ aCu: 4 });
  const body = new Geo({ aCu: 4 });
  const NZ = 60, NR = 32;
  for (let j = 0; j <= NZ; j++) {
    const u = j / NZ;
    const z = -0.155 + 0.32 * (0.5 - 0.5 * Math.cos(Math.PI * u));
    const pr = cuProfile(z), yc = cuYc(z);
    for (let k = 0; k < NR; k++) {
      const ph = (k / NR) * TAU$2, sp = Math.sin(ph), cp = Math.cos(ph);
      body.v(pr[0] * cp, yc + pr[1] * sp * (sp < 0 ? 0.8 : 1), z, cp, sp, 0, { aCu: [0, 0, u, 0] });
    }
  }
  body.grid(0, NZ + 1, NR, true);
  const fc = body.v(0, cuYc(0.165), 0.168, 0, 0, 1, { aCu: [0, 0, 1, 0] });
  const lr = NZ * NR;
  for (let k = 0; k < NR; k++) body.tri(lr + k, lr + ((k + 1) % NR), fc);
  body.smoothNormals();
  body.orientOutward();
  g.append(body);
  const NZf = 44, NWf = 5;
  for (let s = -1; s <= 1; s += 2) {
    for (let layer = 0; layer < 2; layer++) {
      const base = g.count;
      const sgn = layer ? -1 : 1;
      for (let j = 0; j <= NZf; j++) {
        const u = j / NZf;
        const z = -0.14 + 0.235 * u;
        const w = cuProfile(z)[0], yc = cuYc(z);
        const wf = 0.017 * Math.pow(Math.sin(Math.PI * u), 0.6);
        for (let i = 0; i < NWf; i++) {
          const t = i / (NWf - 1);
          g.v(s * (w * 0.96 + wf * t), yc + sgn * 0.0008 * (1 - t) - 0.002 * t, z, 0, sgn, 0, { aCu: [1, t, u, s] });
        }
      }
      g.grid(base, NZf + 1, NWf, false);
    }
  }
  for (let s = -1; s <= 1; s += 2) sphere(g, s * CU_EYE[0], CU_EYE[1], CU_EYE[2], 0.0135, 0.0135, 0.0135, 18, 12, () => ({ aCu: [2, 0, 0, s] }));
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU$2 + Math.PI / 8;
    const bx = Math.cos(a) * 0.021, by = cuYc(0.16) + Math.sin(a) * 0.014, bz = 0.158;
    const cx = Math.cos(a) * 0.004, cy = -0.012 + Math.sin(a) * 0.003 + (Math.sin(a) > 0.5 ? 0.006 : 0), cz = 0.245 - (Math.sin(a) < -0.5 ? 0.012 : 0);
    const pts = [];
    for (let k = 0; k <= 7; k++) {
      const t = k / 7;
      pts.push([lerp$1(bx, cx, t) + Math.cos(a) * 0.006 * Math.sin(Math.PI * t), lerp$1(by, cy, t) + Math.sin(a) * 0.004 * Math.sin(Math.PI * t), lerp$1(bz, cz, t)]);
    }
    tube(g, pts, pts.map((p, k) => lerp$1(0.0062, 0.0012, k / 7)), 7, (j, k, t) => ({ aCu: [3, t, i, 0] }), { capEnd: true });
  }
  return g.build(true);
}
const CU_VDECL =  `
attribute vec4 aCu;
uniform float uCrTime;
uniform vec4 uCuFin;
varying vec3 vCuP;
varying vec4 vCuA;
`;
const CU_VBEGIN =  `
vCuP = position;
vCuA = aCu;
if (aCu.x > 0.5 && aCu.x < 1.5) {
  float t = aCu.y;
  float u = aCu.z;
  transformed.y += uCuFin.y * t * sin(u * 14.451 - uCuFin.x);
  transformed.x += aCu.w * uCuFin.y * 0.2 * t * cos(u * 14.451 - uCuFin.x);
} else if (aCu.x < 0.5) {
  float br = uCuFin.z * (1.0 - smoothstep(-0.05, 0.1, position.z));
  transformed.xy *= 1.0 + br;
} else if (aCu.x > 2.5) {
  float t = aCu.y;
  transformed.x += sin(uCrTime * 2.1 + aCu.z * 1.7) * 0.003 * t * t * uCuFin.w;
  transformed.y += cos(uCrTime * 1.7 + aCu.z * 2.3) * 0.002 * t * t * uCuFin.w;
}
`;
const CU_FDECL =  `
uniform vec4 uCuColor;
varying vec3 vCuP;
varying vec4 vCuA;
${CR_NOISE}
`;
const CU_FCOLOR =  `
float cuRough = 0.5;
vec3 cuEmi = vec3(0.0);
{
  vec3 p = vCuP;
  float part = vCuA.x;
  float dors = smoothstep(-0.004, 0.012, p.y);
  float n1 = crFbm3(p * 38.0);
  vec3 base = mix(${gc(0xb08a5e)}, ${gc(0x6a4a2e)}, smoothstep(0.35, 0.7, n1));
  vec2 cw = crCell3(p * 55.0);
  float wsp = (1.0 - smoothstep(0.15, 0.3, cw.x)) * step(0.6, cw.y);
  base = mix(base, ${gc(0xf2eadc)}, wsp * 0.55);
  float sq = (1.0 - smoothstep(0.012, 0.02, abs(p.x))) * (1.0 - smoothstep(0.015, 0.03, abs(p.z + 0.02)));
  base = mix(base, ${gc(0xf2eadc)}, sq * 0.5);
  float zb = smoothstep(0.2, 0.8, sin(p.z * 95.0 + n1 * 4.0 + abs(p.x) * 30.0));
  base = mix(base, mix(${gc(0x2a1a10)}, ${gc(0xf2eadc)}, zb), uCuColor.x * dors * 0.85);
  float cl = smoothstep(0.35, 0.95, sin(p.z * 42.0 - uCuColor.z + n1 * 2.0));
  base = mix(base, ${gc(0x2a1a10)}, cl * uCuColor.y * dors * 0.75);
  base *= 1.0 - uCuColor.w * 0.4;
  vec3 col = mix(${gc(0xe8e2d4)}, base, dors);
  if (part < 0.5) {
    float fline = (1.0 - smoothstep(0.0012, 0.0035, abs(p.y - 0.002))) * step(0.02, abs(p.x)) * step(p.z, 0.095) * step(-0.14, p.z);
    col = mix(col, ${gc(0xf6f2e8)}, fline * 0.85);
    cuEmi += ${gc(0x9fe0d0)} * fline * 0.12;
  } else if (part < 1.5) {
    float t = vCuA.y;
    col = mix(base * 1.05, ${gc(0xd9cbb0)}, 0.35 + 0.4 * t);
    col = mix(col, ${gc(0xf6f2e8)}, (1.0 - smoothstep(0.0, 0.16, t)) * 0.8);
    cuEmi += col * 0.06;
  } else if (part < 2.5) {
    vec3 ec = vec3(vCuA.w * ${gf(CU_EYE[0])}, ${gf(CU_EYE[1])}, ${gf(CU_EYE[2])});
    vec3 e = normalize(p - ec);
    vec3 g = normalize(vec3(vCuA.w, 0.08, 0.12));
    vec3 upE = normalize(vec3(0.0, 1.0, 0.0) - g * g.y);
    vec3 rtE = cross(g, upE);
    vec2 q = vec2(dot(e, rtE), dot(e, upE));
    float cg = dot(e, g);
    float ax = abs(q.x);
    float wLow = -0.06 - 0.17 * sin(3.14159 * clamp(ax / 0.42, 0.0, 1.0));
    float pup = (1.0 - smoothstep(0.4, 0.44, ax)) * (1.0 - smoothstep(0.15, 0.19, q.y)) * smoothstep(wLow - 0.02, wLow + 0.02, q.y) * step(0.0, cg);
    vec3 iris = mix(${gc(0xb8b08a)}, ${gc(0x6e7a58)}, 0.5 + 0.5 * sin(atan(q.y, q.x + 1e-5) * 24.0));
    float irisM = smoothstep(0.35, 0.6, cg);
    col = mix(base * 0.7, iris, irisM);
    col = mix(col, vec3(0.005), pup);
    cuRough = 0.08;
    cuEmi += iris * 0.05 * (1.0 - pup) * irisM;
  } else {
    float t = vCuA.y;
    float stp = smoothstep(0.3, 0.7, sin(t * 40.0 + vCuA.z));
    col = mix(base, mix(${gc(0x4a3220)}, ${gc(0xe8dcc4)}, stp), 0.5);
    col = mix(col, ${gc(0xe8e2d4)}, (vCuA.z > 4.5 && vCuA.z < 6.5) ? 0.3 : 0.0);
  }
  diffuseColor.rgb = col;
}
`;
const CU_FEMIS =  `
totalEmissiveRadiance += cuEmi;
roughnessFactor = cuRough;
`;
function makeCuttlefish(ctx) {
  const W = ctx.W, ground = W.ground, rng = placeRng(0xc077);
  const M = W.meadow;
  let home = null, best = Infinity;
  for (let k = 0; k < 72; k++) {
    const a = (k / 72) * TAU$2;
    for (const f of [0.85, 1.0, 1.12]) {
      const x = M.x + Math.cos(a) * M.r * f * 1.25, z = M.z + Math.sin(a) * M.r * f;
      if (Math.hypot(x, z) > 38 || W.inAvoid(x, z, 3.5) || !W.sandOK(x, z, 1.2)) continue;
      const d = W.spill ? Math.hypot(x - W.spill.x, z - W.spill.z) : Math.hypot(x, z);
      if (d < best) {
        best = d;
        home = { x, z };
      }
    }
  }
  for (let k = 0; k < 400 && !home; k++) {
    const a = rng() * TAU$2, d = 6 + rng() * 20;
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (!W.inAvoid(x, z, 3.5) && W.sandOK(x, z, 1.2)) home = { x, z };
  }
  if (!home) return null;
  ctx.claim('sepia', home.x, home.z, 1.5);
  const geo = buildCuttleGeo();
  const U = { uCrTime: ctx.time, uCuFin: { value: new THREE.Vector4(0, 0.005, 0, 1) }, uCuColor: { value: new THREE.Vector4(0, 0.3, 0, 0) } };
  const mat = ctx.patch(injectLit(new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0, envMapIntensity: 0.6 }), { uniforms: U, vDecl: CU_VDECL, vBegin: CU_VBEGIN, fDecl: CU_FDECL, fColor: CU_FCOLOR, fEmissive: CU_FEMIS }, 'sepia'));
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'critter-sepia';
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  ctx.root.add(mesh);
  ctx.disposables.push(geo, mat);
  const pos = new THREE.Vector3(home.x, ground.height(home.x, home.z) + 0.55, home.z);
  const vel = new THREE.Vector3(), des = new THREE.Vector3(), away = new THREE.Vector3(), acc = new THREE.Vector3();
  const eul = new THREE.Euler();
  const st = { yaw: rng() * TAU$2, finPh: 0, cloudPh: 0, zebra: 0, cloud: 0.3, drift: rng() * TAU$2, pitch: 0, roll: 0 };
  const ROT = [0, 0.5, -0.5, 1.0, -1, 1.6, -1.6];
  function update(dt, t, pl) {
    const d = pl.has ? pl.p.distanceTo(pos) : 1e4;
    st.drift += dt * 0.12;
    des.set(home.x + Math.cos(st.drift) * 1.2, 0, home.z + Math.sin(st.drift * 0.8) * 0.9);
    if (pl.has && d < 3.8) {
      away.set(pos.x - pl.p.x, 0, pos.z - pl.p.z);
      if (away.lengthSq() < 1e-6) away.set(1, 0, 0);
      away.normalize();
      let ok = false;
      for (let k = 0; k < ROT.length && !ok; k++) {
        const c = Math.cos(ROT[k]), s = Math.sin(ROT[k]);
        const ax = away.x * c - away.z * s, az = away.x * s + away.z * c;
        const x = pl.p.x + ax * 4.0, z = pl.p.z + az * 4.0;
        if (Math.hypot(x - home.x, z - home.z) < 12 && W.sandOK(x, z, 0.8)) {
          des.set(x, 0, z);
          ok = true;
        }
      }
    }
    const gy = ground.height(pos.x, pos.z);
    des.y = Math.max(ground.height(des.x, des.z), gy) + 0.48 + 0.08 * Math.sin(t * 0.37);
    acc.subVectors(des, pos).multiplyScalar(1.4).addScaledVector(vel, -1.7);
    const al = acc.length();
    if (al > 2.2) acc.multiplyScalar(2.2 / al);
    vel.addScaledVector(acc, dt);
    const vl = vel.length();
    if (vl > 1.3) vel.multiplyScalar(1.3 / vl);
    pos.addScaledVector(vel, dt);
    pos.y = Math.max(pos.y, ground.height(pos.x, pos.z) + 0.2);
    let yawT = st.yaw;
    if (pl.has && d < 9) yawT = Math.atan2(pl.p.x - pos.x, pl.p.z - pos.z);
    else if (vel.x * vel.x + vel.z * vel.z > 0.0025) yawT = Math.atan2(vel.x, vel.z);
    const dy = clamp$3(wrapPi(yawT - st.yaw), -1.5 * dt, 1.5 * dt);
    st.yaw = wrapPi(st.yaw + dy);
    st.pitch += (clamp$3(-vel.y * 0.8, -0.3, 0.3) - st.pitch) * expK(2, dt);
    st.roll += (clamp$3((-dy / Math.max(dt, 1e-4)) * 0.15, -0.25, 0.25) - st.roll) * expK(3, dt);
    mesh.position.copy(pos);
    mesh.quaternion.setFromEuler(eul.set(st.pitch, st.yaw, st.roll, 'YXZ'));
    const fwd = vel.x * Math.sin(st.yaw) + vel.z * Math.cos(st.yaw);
    const speed = vel.length();
    st.finPh += dt * (7 + speed * 9) * (fwd < -0.02 ? 1 : -1);
    U.uCuFin.value.set(st.finPh, 0.004 + Math.min(speed, 1.2) * 0.006, 0.012 * Math.sin(t * 2.2), 1);
    st.cloud += ((d < 6 ? 1 : 0.25) - st.cloud) * expK(1.2, dt);
    st.zebra += ((d < 3.2 ? 0.8 : 0) - st.zebra) * expK(1.5, dt);
    st.cloudPh += dt * (5 + 4 * st.cloud);
    U.uCuColor.value.set(st.zebra, st.cloud, st.cloudPh, 0.15 * st.cloud);
    const h = pos.y - gy;
    ctx.shadows.add(pos.x, pos.z, 0.14 + h * 0.2, 0.22 + h * 0.2, st.yaw, 0.3 * clamp$3(1 - h / 1.5, 0, 1));
  }
  return {
    kind: 'cuttlefish',
    update,
    info: () => ({ kind: 'cuttlefish', x: +pos.x.toFixed(2), y: +pos.y.toFixed(2), z: +pos.z.toFixed(2), home: [+home.x.toFixed(2), +home.z.toFixed(2)] }),
    arrays: () => [mesh.matrix.elements],
    pos,
  };
}

const INK_VS =  `
attribute vec3 iPos;
attribute vec4 iPar;
varying vec2 vUv;
varying vec2 vPar;
void main() {
  vUv = position.xy;
  vPar = vec2(iPar.y, iPar.z);
  vec4 mv = modelViewMatrix * vec4(iPos, 1.0);
  float ang = iPar.z * 6.2831853 + iPar.w;
  float c = cos(ang);
  float s = sin(ang);
  mv.xy += vec2(position.x * c - position.y * s, position.x * s + position.y * c) * iPar.x;
  gl_Position = projectionMatrix * mv;
}
`;
const INK_FS =  `
uniform float uCrTime;
varying vec2 vUv;
varying vec2 vPar;
float inkH(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float inkN(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(inkH(i), inkH(i + vec2(1.0, 0.0)), f.x), mix(inkH(i + vec2(0.0, 1.0)), inkH(i + vec2(1.0, 1.0)), f.x), f.y);
}
void main() {
  float r = length(vUv);
  float sd = vPar.y * 37.0;
  float n = inkN(vUv * 2.3 + vec2(sd, uCrTime * 0.2)) * 0.6 + inkN(vUv * 5.1 - vec2(uCrTime * 0.13, sd)) * 0.4;
  float a = (1.0 - smoothstep(0.25, 1.0, r + (n - 0.45) * 0.55)) * vPar.x;
  if (a < 0.004) discard;
  vec3 col = mix(vec3(0.028, 0.022, 0.02), vec3(0.09, 0.062, 0.045), n);
  gl_FragColor = vec4(col, a);
}
`;
function makeInk(ctx) {
  const MAX = 80;
  const geo = new THREE.InstancedBufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3));
  geo.setIndex([0, 1, 2, 0, 2, 3]);
  const posA = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 3), 3).setUsage(THREE.DynamicDrawUsage);
  const parA = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 4), 4).setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('iPos', posA);
  geo.setAttribute('iPar', parA);
  geo.instanceCount = 0;
  const mat = new THREE.ShaderMaterial({ uniforms: { uCrTime: ctx.time }, vertexShader: INK_VS, fragmentShader: INK_FS, transparent: true, depthWrite: false });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'critter-ink';
  mesh.frustumCulled = false;
  mesh.renderOrder = 4;
  mesh.visible = false;
  ctx.root.add(mesh);
  ctx.disposables.push(geo, mat);
  const F = () => new Float32Array(MAX);
  const px = F(), py = F(), pz = F(), vx = F(), vy = F(), vz = F(), age = F(), life = F(), s0 = F(), s1 = F(), a0 = F(), sd = F();
  let n = 0;
  const rng = makeRng(0x1a4c);
  function copy(d, s) {
    px[d] = px[s]; py[d] = py[s]; pz[d] = pz[s];
    vx[d] = vx[s]; vy[d] = vy[s]; vz[d] = vz[s];
    age[d] = age[s]; life[d] = life[s]; s0[d] = s0[s]; s1[d] = s1[s]; a0[d] = a0[s]; sd[d] = sd[s];
  }
  function spawn(x, y, z, dx, dy, dz, speed) {
    if (!Number.isFinite(x + y + z + dx + dy + dz + speed)) return;
    let i = 0;
    if (n < MAX) i = n++;
    else {
      let oa = -1;
      for (let k = 0; k < MAX; k++) {
        const r = age[k] / life[k];
        if (r > oa) {
          oa = r;
          i = k;
        }
      }
    }
    const ex = dx + (rng() - 0.5) * 0.7, ey = dy + (rng() - 0.5) * 0.7, ez = dz + (rng() - 0.5) * 0.7;
    const el = Math.hypot(ex, ey, ez) || 1;
    const sp = speed * (0.4 + 0.8 * rng());
    px[i] = x; py[i] = y; pz[i] = z;
    vx[i] = (ex / el) * sp; vy[i] = (ey / el) * sp; vz[i] = (ez / el) * sp;
    age[i] = 0;
    life[i] = 3.2 + rng() * 2.6;
    s0[i] = 0.035 + rng() * 0.035;
    s1[i] = 0.28 + rng() * 0.3;
    a0[i] = 0.75 + rng() * 0.2;
    sd[i] = rng();
  }
  const burst = (x, y, z, dx, dy, dz, count, speed) => {
    for (let k = 0; k < count; k++) spawn(x, y, z, dx, dy, dz, speed);
  };
  const trail = (em, x, y, z, dx, dy, dz, dt, rate) => {
    em.acc += rate * dt;
    while (em.acc >= 1) {
      em.acc -= 1;
      spawn(x, y, z, dx, dy, dz, 0.3);
    }
  };
  function update(dt) {
    if (!n) {
      if (mesh.visible) mesh.visible = false;
      return;
    }
    const kd = Math.exp(-2.3 * dt);
    const P = posA.array, Q = parA.array;
    let k = 0;
    while (k < n) {
      age[k] += dt;
      if (age[k] >= life[k]) {
        n--;
        if (k !== n) copy(k, n);
        continue;
      }
      vx[k] *= kd;
      vy[k] = vy[k] * kd + 0.02 * dt;
      vz[k] *= kd;
      px[k] += vx[k] * dt;
      py[k] += vy[k] * dt;
      pz[k] += vz[k] * dt;
      const a = age[k];
      const sz = s0[k] + (s1[k] - s0[k]) * (1 - Math.exp(-a * 1.3));
      const gy = ctx.W.ground.height(px[k], pz[k]) + sz * 0.35;
      if (py[k] < gy) {
        py[k] = gy;
        if (vy[k] < 0) vy[k] = 0;
      }
      P[k * 3] = px[k];
      P[k * 3 + 1] = py[k];
      P[k * 3 + 2] = pz[k];
      Q[k * 4] = sz;
      Q[k * 4 + 1] = a0[k] * sstep$2(0, 0.08, a) * (1 - sstep$2(0.35 * life[k], life[k], a));
      Q[k * 4 + 2] = sd[k];
      Q[k * 4 + 3] = a * (sd[k] - 0.5) * 0.6;
      k++;
    }
    geo.instanceCount = n;
    mesh.visible = n > 0;
    posA.needsUpdate = true;
    parA.needsUpdate = true;
  }
  return { burst, trail, update, count: () => n, arrays: () => [posA.array, parA.array] };
}

const CS_VS =  `
varying vec2 vUv;
varying float vS;
void main() {
  vUv = position.xz;
  vS = 1.0;
  vec4 p = vec4(position, 1.0);
  #ifdef USE_INSTANCING
    p = instanceMatrix * p;
  #endif
  #ifdef USE_INSTANCING_COLOR
    vS = instanceColor.r;
  #endif
  gl_Position = projectionMatrix * modelViewMatrix * p;
}
`;
const CS_FS =  `
varying vec2 vUv;
varying float vS;
void main() {
  float r = length(vUv);
  float a = 1.0 - smoothstep(0.0, 1.0, r);
  a = a * a * vS * 0.6;
  if (a < 0.003) discard;
  gl_FragColor = vec4(0.0, 0.0, 0.0, a);
}
`;
function makeContactShadows(ctx) {
  const MAX = 48;
  const geo = new THREE.PlaneGeometry(2, 2);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.ShaderMaterial({ vertexShader: CS_VS, fragmentShader: CS_FS, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const mesh = new THREE.InstancedMesh(geo, mat, MAX);
  mesh.name = 'critter-contact-shadows';
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 3), 3);
  mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
  mesh.count = 0;
  mesh.frustumCulled = false;
  mesh.renderOrder = 1;
  ctx.root.add(mesh);
  ctx.disposables.push(geo, mat);
  const nrm = new THREE.Vector3(), fwd = new THREE.Vector3(), q = new THREE.Quaternion(), m4 = new THREE.Matrix4(), p = new THREE.Vector3(), s = new THREE.Vector3(), tx = new THREE.Vector3(), tz = new THREE.Vector3();
  let n = 0;
  function add(x, z, rx, rz, yaw, strength) {
    if (n >= MAX || !(strength > 0.01) || !Number.isFinite(x + z + rx + rz + yaw)) return;
    const W = ctx.W;
    W.ground.normal(x, z, nrm);
    fwd.set(Math.sin(yaw), 0, Math.cos(yaw));
    lookQuat(fwd, nrm, q, tx, tz);
    m4.compose(p.set(x, W.ground.height(x, z) + 0.004, z), q, s.set(rx, 1, rz));
    m4.toArray(mesh.instanceMatrix.array, n * 16);
    mesh.instanceColor.setXYZ(n, Math.min(1, strength), 0, 0);
    n++;
  }
  function flush() {
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor.needsUpdate = true;
    n = 0;
  }
  return { add, flush, mesh };
}

function rockChunk(g, cx, cy, cz, r, seed, cA, cB, cPink, cAlg) {
  const sub = new Geo({ color: 3 });
  const WS = 12, HS = 8;
  for (let j = 0; j <= HS; j++) {
    const th = (j / HS) * Math.PI;
    for (let k = 0; k < WS; k++) {
      const ph = (k / WS) * TAU$2;
      const sx = Math.sin(th) * Math.cos(ph), sy = Math.cos(th), sz = Math.sin(th) * Math.sin(ph);
      let d = 1 + 0.3 * vnoise3$1(sx * 1.7 + seed, sy * 1.7, sz * 1.7) + 0.1 * vnoise3$1(sx * 4.1, sy * 4.1 + seed, sz * 4.1);
      if (sy < -0.3) d *= 0.8;
      let col = mixRGB(cA, cB, clamp$3(0.5 + 0.6 * vnoise3$1(sx * 3 + seed, sy * 3, sz * 3 + 1.7), 0, 1));
      col = mixRGB(col, cPink, sstep$2(0.2, 0.5, vnoise3$1(sx * 2.3, sy * 2.3 + seed, sz * 2.3)) * 0.6);
      col = mixRGB(col, cAlg, sstep$2(0.45, 0.85, sy) * 0.7);
      sub.v(cx + sx * r * d, cy + sy * r * d * 0.8, cz + sz * r * d, sx, sy, sz, { color: col });
    }
  }
  sub.grid(0, HS + 1, WS, true);
  sub.smoothNormals();
  sub.orientOutward();
  g.append(sub);
}
function addMidden(g, m, ground, seed) {
  const rng = makeRng(seed);
  const cols = [linRGB(0xefe6d6), linRGB(0xe4cfc0), linRGB(0xc9a79a), linRGB(0x8a6a58), linRGB(0xd8b0a8)];
  const pearl = [0.93, 0.91, 0.88], rib = [0.3, 0.22, 0.18];
  for (let i = 0; i < 12; i++) {
    const a = (rng() - 0.5) * 2.2, d = 0.12 + rng() * 0.4;
    const x = m.x + (m.dx * Math.cos(a) - m.dz * Math.sin(a)) * d, z = m.z + (m.dx * Math.sin(a) + m.dz * Math.cos(a)) * d;
    const gy = ground.height(x, z);
    const r = 0.011 + rng() * 0.008;
    const flip = rng() < 0.45;
    const yaw = rng() * TAU$2, cyw = Math.cos(yaw), syw = Math.sin(yaw);
    const col = cols[Math.floor(rng() * cols.length) % cols.length];
    const sub = new Geo({ color: 3 });
    const WS = 14, HS = 5;
    for (let j = 0; j <= HS; j++) {
      const th = (j / HS) * Math.PI * 0.5;
      for (let k = 0; k < WS; k++) {
        const ph = (k / WS) * TAU$2;
        const rb = 1 + 0.06 * Math.cos(ph * 9);
        const sx = Math.sin(th) * Math.cos(ph) * rb, sy = Math.cos(th), sz = Math.sin(th) * Math.sin(ph) * rb * 0.9;
        const hh = sy * 0.4 * r;
        const lx = sx * r, lz = sz * r;
        const ny = flip ? 0.4 * r - hh : hh;
        const nx0 = flip ? -sx : sx, ny0 = sy, nz0 = flip ? -sz : sz;
        const c = flip ? mixRGB(col, pearl, 0.6) : mixRGB(col, rib, Math.cos(ph * 9) > 0.6 ? 0.25 : 0);
        sub.v(x + lx * cyw + lz * syw, gy + 0.0015 + ny, z - lx * syw + lz * cyw, nx0 * cyw + nz0 * syw, ny0, -nx0 * syw + nz0 * cyw, { color: c });
      }
    }
    sub.grid(0, HS + 1, WS, true);
    g.append(sub);
  }
}
function buildDenProps(ctx) {
  const W = ctx.W, ground = W.ground;
  const g = new Geo({ color: 3 });
  const dark = [0.012, 0.01, 0.009];
  const rockA = linRGB(0x6b6155), rockB = linRGB(0x8a7f70), pink = linRGB(0xd66f93), algae = linRGB(0x4d7a2a);
  const U = new THREE.Vector3(), X = new THREE.Vector3(), A = new THREE.Vector3();
  let k2 = 0;
  for (const d of ctx.denProps) {
    k2++;
    A.copy(d.A).normalize();
    U.copy(Y_UP$1).addScaledVector(A, -A.y).normalize();
    X.crossVectors(U, A).normalize();
    if (d.type === 'hole') {
      const rng = makeRng(d.seed);
      const O = d.O, SEG = 24, RINGS = 4, off = rng() * 10;
      const c0 = g.v(O.x + A.x * 0.006, O.y + A.y * 0.006, O.z + A.z * 0.006, A.x, A.y, A.z, { color: dark });
      const ring0 = g.count;
      for (let k = 1; k <= RINGS; k++) {
        const rho = k / RINGS;
        for (let m = 0; m < SEG; m++) {
          const ang = (m / SEG) * TAU$2;
          const rr = 1 + 0.2 * vnoise3$1(Math.cos(ang) * 1.3 + off, Math.sin(ang) * 1.3, rho * 0.7);
          const lx = Math.cos(ang) * d.rx * rho * rr, ly = Math.sin(ang) * d.ry * rho * rr;
          const depth = 0.006 - 0.05 * rho * rho;
          const nx = A.x + (X.x * lx + U.x * ly) * 3, ny = A.y + (X.y * lx + U.y * ly) * 3, nz = A.z + (X.z * lx + U.z * ly) * 3;
          g.v(O.x + X.x * lx + U.x * ly + A.x * depth, O.y + X.y * lx + U.y * ly + A.y * depth, O.z + X.z * lx + U.z * ly + A.z * depth, nx, ny, nz, { color: mixRGB(dark, rockA, sstep$2(0.55, 1.0, rho) * 0.9) });
        }
      }
      for (let m = 0; m < SEG; m++) g.tri(c0, ring0 + m, ring0 + ((m + 1) % SEG));
      for (let k = 0; k < RINGS - 1; k++) {
        for (let m = 0; m < SEG; m++) {
          const a0 = ring0 + k * SEG + m, a1 = ring0 + k * SEG + ((m + 1) % SEG);
          g.quad(a0, a0 + SEG, a1 + SEG, a1);
        }
      }
      for (const ang of [0.45, 1.6, 2.7]) {
        const a2 = ang + (rng() - 0.5) * 0.4;
        const r = (0.05 + rng() * 0.04) * d.lip;
        const lx = Math.cos(a2) * d.rx * 1.08, ly = Math.sin(a2) * d.ry * 1.15;
        rockChunk(g, O.x + X.x * lx + U.x * ly + A.x * 0.015, O.y + X.y * lx + U.y * ly + A.y * 0.015, O.z + X.z * lx + U.z * ly + A.z * 0.015, r, rng() * 50, rockA, rockB, pink, algae);
      }
    } else if (d.type === 'amphora') {
      const C = new THREE.Vector3().copy(d.O).addScaledVector(A, -0.05);
      const c0 = g.v(C.x, C.y, C.z, A.x, A.y, A.z, { color: dark });
      const r0 = g.count;
      for (let m = 0; m < 16; m++) {
        const ang = (m / 16) * TAU$2;
        const lx = Math.cos(ang) * 0.036, ly = Math.sin(ang) * 0.036;
        g.v(C.x + X.x * lx + U.x * ly, C.y + X.y * lx + U.y * ly, C.z + X.z * lx + U.z * ly, A.x, A.y, A.z, { color: dark });
      }
      for (let m = 0; m < 16; m++) g.tri(c0, r0 + m, r0 + ((m + 1) % 16));
    }
    if (d.midden) addMidden(g, d.midden, ground, (0x51d + k2 * 17) ^ (VARY && VARY.mix ? VARY.mix : 0));
  }
  if (!g.count) return;
  const geo = g.build(true);
  const mat = ctx.patch(injectLit(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.86, metalness: 0, envMapIntensity: 0.5 }), {}, 'den'), { bump: 0.3, bumpScale: 9 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'critter-dens';
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  ctx.root.add(mesh);
  ctx.disposables.push(geo, mat);
}

function cleanPts(arr) {
  const out = [];
  if (!Array.isArray(arr)) return out;
  for (const p of arr) {
    if (!p) continue;
    const x = +p.x, y = +p.y, z = +p.z, nx = +p.nx, ny = +p.ny, nz = +p.nz;
    if (!Number.isFinite(x + y + z + nx + ny + nz)) continue;
    const l = Math.hypot(nx, ny, nz);
    if (l < 1e-6) continue;
    out.push({ x, y, z, nx: nx / l, ny: ny / l, nz: nz / l });
  }
  return out;
}
function cleanAmph(arr) {
  const out = [];
  if (!Array.isArray(arr)) return out;
  for (const a of arr) {
    if (!a || !a.position || !a.quaternion) continue;
    const p = a.position, q = a.quaternion;
    if (!Number.isFinite(p.x + p.y + p.z + q.x + q.y + q.z + q.w)) continue;
    const qq = new THREE.Quaternion(q.x, q.y, q.z, q.w);
    if (qq.lengthSq() < 1e-8) continue;
    qq.normalize();
    const pp = new THREE.Vector3(p.x, p.y, p.z);
    const axis = new THREE.Vector3(0, 1, 0).applyQuaternion(qq);
    out.push({ kind: a.kind | 0, p: pp, q: qq, axis, mouth: pp.clone().addScaledVector(axis, 0.45), toe: pp.clone().addScaledVector(axis, -0.42) });
  }
  return out;
}
function cleanAvoid(arr) {
  const out = [];
  if (!Array.isArray(arr)) return out;
  for (const c of arr) if (c && Number.isFinite(+c.x + +c.z + +c.r)) out.push({ x: +c.x, z: +c.z, r: Math.max(0, +c.r) });
  return out;
}
function cleanObs(arr) {
  const out = [];
  if (!Array.isArray(arr)) return out;
  for (const o of arr) if (o && Number.isFinite(+o.x + +o.y + +o.z + +o.r) && +o.r > 0) out.push({ x: +o.x, y: +o.y, z: +o.z, r: +o.r });
  return out;
}
function segDist2D(x, z, a) {
  const ax = a.toe.x, az = a.toe.z, dx = a.mouth.x - ax, dz = a.mouth.z - az;
  const l2 = dx * dx + dz * dz;
  const t = l2 > 1e-9 ? clamp$3(((x - ax) * dx + (z - az) * dz) / l2, 0, 1) : 0;
  return Math.hypot(x - (ax + dx * t), z - (az + dz * t));
}

function makeWorldQueries(opts, ground) {
  const tops = cleanPts(opts.rockTops), sides = cleanPts(opts.rockSides);
  const rocks = makeRockIndex(tops.concat(sides));
  const amph = cleanAmph(opts.amphorae);
  const avoid = cleanAvoid(opts.avoid);
  const obstacles = cleanObs(opts.obstacles);
  const m = opts.meadow;
  const meadow = m && Number.isFinite(+m.x + +m.z + +m.r) ? { x: +m.x, z: +m.z, r: Math.max(2, +m.r) } : { x: -6, z: 30, r: 24 };
  let spill = null;
  if (amph.length >= 3) {
    let cx = 0, cz = 0;
    for (const a of amph) {
      cx += a.p.x;
      cz += a.p.z;
    }
    cx /= amph.length;
    cz /= amph.length;
    let sxx = 0, szz = 0, sxz = 0;
    for (const a of amph) {
      const dx = a.p.x - cx, dz = a.p.z - cz;
      sxx += dx * dx;
      szz += dz * dz;
      sxz += dx * dz;
    }
    const ang = 0.5 * Math.atan2(2 * sxz, sxx - szz);
    spill = { x: cx, z: cz, ux: Math.cos(ang), uz: Math.sin(ang) };
  }
  const inEllipse = (x, z, a, b) => {
    if (!spill) return false;
    const dx = x - spill.x, dz = z - spill.z;
    const u = dx * spill.ux + dz * spill.uz, v = -dx * spill.uz + dz * spill.ux;
    return (u * u) / (a * a) + (v * v) / (b * b) < 1;
  };
  const W = { ground, tops, sides, rocks, amph, avoid, obstacles, meadow, spill, bound: 44 };
  W.inAvoid = (x, z, pad = 0) => {
    for (let i = 0; i < avoid.length; i++) if (Math.hypot(x - avoid[i].x, z - avoid[i].z) < avoid[i].r + pad) return true;
    return false;
  };
  W.inWreck = (x, z) => !obstacles.length && inEllipse(x, z, 8.0, 3.4);
  W.inWreckCore = (x, z) => !obstacles.length && inEllipse(x, z, 6.8, 2.1);
  W.sandOK = (x, z, clear = 0.4, opt) => {
    if (!Number.isFinite(x) || !Number.isFinite(z)) return false;
    if (x * x + z * z > W.bound * W.bound) return false;
    const h = ground.height(x, z);
    if (h < -33 || h > -3) return false;
    if (W.inAvoid(x, z, 0.3)) return false;
    if (opt && opt.core ? W.inWreckCore(x, z) : W.inWreck(x, z)) return false;
    const ign = opt && opt.ignore !== undefined ? opt.ignore : -1;
    for (let i = 0; i < amph.length; i++) {
      if (i === ign) continue;
      const a = amph[i];
      if (Math.abs(a.p.x - x) > 1.2 || Math.abs(a.p.z - z) > 1.2) continue;
      if (segDist2D(x, z, a) < 0.22 + clear * 0.6) return false;
    }
    for (let i = 0; i < obstacles.length; i++) {
      const o = obstacles[i];
      if (o.y - o.r > h + 0.5) continue;
      if (Math.hypot(x - o.x, z - o.z) < o.r + clear * 0.5) return false;
    }
    if (rocks.blocked(x, z, h, clear, 0.06, 0.6, 0.8)) return false;
    return ground.slope(x, z) <= 0.32;
  };
  W.pathClear = (x0, z0, x1, z1, clear, skip = 0) => {
    const d = Math.hypot(x1 - x0, z1 - z0);
    const n = Math.max(1, Math.ceil(d / 0.3));
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      if (t * d < skip) continue;
      const x = lerp$1(x0, x1, t), z = lerp$1(z0, z1, t);
      const h = ground.height(x, z);
      if (rocks.blocked(x, z, h, clear, 0.2, 0.3, 1e3)) return false;
      for (let k = 0; k < obstacles.length; k++) {
        const o = obstacles[k];
        if (Math.hypot(x - o.x, z - o.z) < o.r && o.y + o.r > h + 0.3) return false;
      }
    }
    return true;
  };
  W.segmentSand = (x0, z0, x1, z1, clear) => {
    const d = Math.hypot(x1 - x0, z1 - z0);
    const n = Math.max(1, Math.ceil(d / 0.2));
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      if (!W.sandOK(lerp$1(x0, x1, t), lerp$1(z0, z1, t), clear)) return false;
    }
    return true;
  };
  return W;
}

function pickAmphoraDen(ctx) {
  const W = ctx.W;
  let best = null, bestS = -Infinity;
  for (let i = 0; i < W.amph.length; i++) {
    const a = W.amph[i];
    if (a.kind === 2 || Math.abs(a.axis.y) > 0.22) continue;
    const m = a.mouth;
    const hm = m.y - W.ground.height(m.x, m.z);
    if (hm < 0.04 || hm > 0.21) continue;
    if (Math.hypot(m.x, m.z) > 40 || W.inAvoid(m.x, m.z, 1.8)) continue;
    const ah = new THREE.Vector3(a.axis.x, 0, a.axis.z);
    if (ah.lengthSq() < 1e-6) continue;
    ah.normalize();
    let ok = true;
    for (const d of [0.3, 0.55, 0.8]) {
      if (!W.sandOK(m.x + ah.x * d, m.z + ah.z * d, 0.15, { ignore: i, core: true })) {
        ok = false;
        break;
      }
    }
    for (let j = 0; j < W.amph.length && ok; j++) {
      if (j === i) continue;
      const b = W.amph[j];
      if (segDist2D(m.x, m.z, b) < 0.32 || segDist2D(m.x + ah.x * 0.35, m.z + ah.z * 0.35, b) < 0.5) ok = false;
    }
    if (!ok) continue;
    let score = a.kind === 0 ? 0.3 : 0;
    if (i === SITE.den) score += 10;
    if (W.inWreck(m.x, m.z)) score -= 3;
    if (W.spill) {
      const rx = m.x - W.spill.x, rz = m.z - W.spill.z, rl = Math.hypot(rx, rz) || 1;
      score += ((ah.x * rx + ah.z * rz) / rl) * 1.5 - Math.abs(rl - 5) * 0.25;
    }
    if (score > bestS) {
      bestS = score;
      best = { a, i, ah };
    }
  }
  if (!best) return null;
  const S = 0.85;
  const A = best.a.axis.clone().normalize();
  const Ud = new THREE.Vector3(0, 1, 0).addScaledVector(A, -A.y).normalize();
  const O = best.a.mouth.clone();
  const crown0 = O.clone().addScaledVector(A, 0.024 * S).addScaledVector(Ud, -0.04 * S);
  const fx = crown0.x + best.ah.x * 0.3, fz = crown0.z + best.ah.z * 0.3;
  return { kind: 'amphora', O, A, scale: S, depth: 0.46, crown0, front: new THREE.Vector3(fx, W.ground.height(fx, fz), fz) };
}
function pickRockDen(ctx, o) {
  const W = ctx.W;
  let best = null, bestS = -Infinity;
  for (const p of W.sides) {
    if (Math.abs(p.ny) > o.nyMax) continue;
    const gy = W.ground.height(p.x, p.z);
    const h = p.y - gy;
    if (h < o.hMin || h > o.hMax) continue;
    if (Math.hypot(p.x, p.z) > 40 || p.y < -33) continue;
    if (W.inAvoid(p.x, p.z, 2.5)) continue;
    const nh = Math.hypot(p.nx, p.nz);
    if (nh < 0.3) continue;
    const ax = p.nx / nh, az = p.nz / nh;
    if (o.exclude.some((d) => Math.hypot(d.O.x - p.x, d.O.z - p.z) < o.minSep)) continue;
    const blocked = W.rocks.each(p.x + ax * o.clearLen * 0.5, p.z + az * o.clearLen * 0.5, o.clearLen * 0.5 + 0.35, (q) => {
      const f = (q.x - p.x) * ax + (q.z - p.z) * az;
      if (f < 0.08) return false;
      if (q.y < p.y - 0.25 && q.y < W.ground.height(q.x, q.z) + 0.1) return false;
      const lat = Math.abs(-(q.x - p.x) * az + (q.z - p.z) * ax);
      return lat < 0.35 && f < o.clearLen && Math.abs(q.y - p.y) < 0.45;
    });
    if (blocked) continue;
    let behind = 0;
    W.rocks.each(p.x - ax * 0.6, p.z - az * 0.6, 0.9, (q) => {
      if ((q.x - p.x) * ax + (q.z - p.z) * az < -0.15) behind++;
      return false;
    });
    if (behind < o.minDepthPts) continue;
    if (o.moray) {
      let low = true;
      for (const d of [0.3, 0.6, 0.9]) if (W.ground.height(p.x + ax * d, p.z + az * d) > p.y - 0.08) low = false;
      if (!low) continue;
    } else {
      const fx = p.x + ax * 0.45, fz = p.z + az * 0.45;
      if (W.ground.slope(fx, fz) > 0.35 || W.inAvoid(fx, fz, 0.8) || !W.sandOK(fx, fz, 0.05)) continue;
    }
    const dW = W.spill ? Math.hypot(p.x - W.spill.x, p.z - W.spill.z) : Math.hypot(p.x, p.z);
    const score = -dW * 0.06 - Math.abs(h - o.hPref) * 1.5 + ctx.rngPlace() * 0.3;
    if (score > bestS) {
      bestS = score;
      best = { p, ax, az };
    }
  }
  return best;
}
function rockOctDen(ctx, r) {
  const W = ctx.W, S = 1.0;
  const A = new THREE.Vector3(r.ax, 0, r.az);
  const cx = r.p.x + r.ax * 0.03 * S, cz = r.p.z + r.az * 0.03 * S;
  const crown0 = new THREE.Vector3(cx, W.ground.height(cx, cz) + 0.012 * S, cz);
  const fx = crown0.x + r.ax * 0.32, fz = crown0.z + r.az * 0.32;
  return {
    kind: 'rock', O: new THREE.Vector3(r.p.x, r.p.y, r.p.z), A, scale: S, depth: 0.36, crown0,
    front: new THREE.Vector3(fx, W.ground.height(fx, fz), fz),
    holeC: new THREE.Vector3(r.p.x, crown0.y + 0.05 * S, r.p.z),
  };
}
function middenFor(den) {
  const ah = new THREE.Vector3(den.A.x, 0, den.A.z).normalize();
  return { x: den.crown0.x + ah.x * 0.12, z: den.crown0.z + ah.z * 0.12, dx: ah.x, dz: ah.z };
}

function createCritters(opts) {
  opts = opts || {};
  const scene = opts.scene && opts.scene.isObject3D ? opts.scene : null;
  const floorFn = typeof opts.floorHeight === 'function' ? opts.floorHeight : () => -20;
  const patchFn = typeof opts.patchMaterial === 'function' ? opts.patchMaterial : null;
  const quality = clamp$3(num$1(+opts.quality, 1), 0.25, 1.5);
  const ground = makeGround(floorFn);
  const W = makeWorldQueries(opts, ground);
  const root = new THREE.Group();
  root.name = 'critters';
  const claims = [];
  const warn = (name, e) => {
    try {
      console.warn('[critters] ' + name + ' unavailable:', e);
    } catch (_) {
    }
  };
  const ctx = {
    root, W, quality,
    time: { value: 0 },
    disposables: [],
    denProps: [],
    rngPlace: placeRng(0x9e37),
    patch: (m, o) => {
      if (!patchFn) return m;
      try {
        const r = patchFn(m, o);
        return r && r.isMaterial ? r : m;
      } catch (e) {
        return m;
      }
    },
    claim: (owner, x, z, r) => {
      claims.push({ owner, x, z, r });
    },
    free: (x, z, r, owner) => {
      for (let i = 0; i < claims.length; i++) {
        const c = claims[i];
        if (c.owner !== owner && Math.hypot(c.x - x, c.z - z) < c.r + r) return false;
      }
      return true;
    },
    ink: { burst() {}, trail() {}, update() {}, count: () => 0, arrays: () => [] },
    shadows: { add() {}, flush() {} },
  };
  try {
    ctx.shadows = makeContactShadows(ctx);
  } catch (e) {
    warn('contact shadows', e);
  }
  try {
    ctx.ink = makeInk(ctx);
  } catch (e) {
    warn('ink', e);
  }

  const octDens = [], morDens = [];
  try {
    const exclude = [];
    const aden = pickAmphoraDen(ctx);
    if (aden) {
      octDens.push(aden);
      exclude.push(aden);
      ctx.denProps.push({ type: 'amphora', O: aden.O, A: aden.A, midden: middenFor(aden) });
    }
    const octRock = { hMin: 0.05, hMax: 0.24, hPref: 0.12, nyMax: 0.3, clearLen: 0.75, minDepthPts: 6, minSep: 4, exclude, moray: false };
    for (let k = octDens.length; k < 2; k++) {
      const r = pickRockDen(ctx, octRock);
      if (!r) break;
      const den = rockOctDen(ctx, r);
      octDens.push(den);
      exclude.push(den);
      ctx.denProps.push({ type: 'hole', O: den.holeC, A: den.A, rx: 0.15, ry: 0.1, lip: 1.3, seed: 21 + k, midden: middenFor(den) });
    }
    for (let k = 0; k < 2; k++) {
      const r = pickRockDen(ctx, { hMin: 0.3, hMax: 1.3, hPref: 0.6, nyMax: 0.35, clearLen: 1.0, minDepthPts: 6, minSep: 4.5, exclude, moray: true });
      if (!r) break;
      const S = 0.92 + ctx.rngPlace() * 0.18;
      const A = new THREE.Vector3(r.ax, 0, r.az);
      const O = new THREE.Vector3(r.p.x + r.ax * 0.01, r.p.y, r.p.z + r.az * 0.01);
      const den = { O, A, scale: S, eMax: (0.62 + 0.13 * ctx.rngPlace()) * S };
      morDens.push(den);
      exclude.push(den);
      ctx.denProps.push({ type: 'hole', O: O.clone(), A, rx: 0.1 * S, ry: 0.075 * S, lip: 0.9, seed: 31 + k });
      ctx.claim('moray' + k, O.x + r.ax * 0.5, O.z + r.az * 0.5, 0.7);
    }
  } catch (e) {
    warn('dens', e);
  }

  const list = [];
  if (octDens.length) {
    try {
      const og = buildOctopusGeometry();
      ctx.disposables.push(og);
      octDens.forEach((d, i) => {
        try {
          list.push(makeOctopus(ctx, og, d, i));
        } catch (e) {
          warn('octopus', e);
        }
      });
    } catch (e) {
      warn('octopus', e);
    }
  }
  if (morDens.length) {
    try {
      const mg = buildMorayGeometry();
      ctx.disposables.push(mg);
      morDens.forEach((d, i) => {
        try {
          list.push(makeMoray(ctx, mg, d, i));
        } catch (e) {
          warn('moray', e);
        }
      });
    } catch (e) {
      warn('moray', e);
    }
  }
  const build = (name, fn) => {
    try {
      const c = fn(ctx);
      if (c) list.push(c);
    } catch (e) {
      warn(name, e);
    }
  };
  build('fan worms', makeFanWorms);
  build('spider crabs', makeSpiderCrabs);
  build('hermit crabs', makeHermits);
  build('sea cucumbers', makeCucumbers);
  build('nudibranchs', makeNudibranchs);
  build('cuttlefish', makeCuttlefish);
  try {
    buildDenProps(ctx);
  } catch (e) {
    warn('den dressing', e);
  }
  if (scene) scene.add(root);

  const pl = { has: false, p: new THREE.Vector3(), last: new THREE.Vector3(), speed: 0, init: false };
  let disposed = false;
  function update(dt, time, playerPos) {
    if (disposed) return;
    dt = clamp$3(num$1(+dt, 0), 0, 0.1);
    const t = Number.isFinite(+time) ? +time : ctx.time.value + dt;
    ctx.time.value = t;
    if (playerPos && Number.isFinite(playerPos.x + playerPos.y + playerPos.z)) {
      if (!pl.init) {
        pl.last.set(playerPos.x, playerPos.y, playerPos.z);
        pl.init = true;
      }
      pl.p.set(playerPos.x, playerPos.y, playerPos.z);
      if (dt > 1e-4) {
        const v = Math.min(12, pl.last.distanceTo(pl.p) / dt);
        pl.speed += (v - pl.speed) * expK(6, dt);
      }
      pl.last.copy(pl.p);
      pl.has = true;
    } else {
      pl.has = false;
      pl.speed = 0;
    }
    for (let i = 0; i < list.length; i++) {
      const c = list[i];
      if (c.dead) continue;
      try {
        c.update(dt, t, pl);
      } catch (e) {
        c.dead = true;
        warn(c.kind || 'critter', e);
      }
    }
    try {
      ctx.ink.update(dt);
    } catch (e) {
    }
    ctx.shadows.flush();
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    if (root.parent) root.parent.remove(root);
    for (const d of ctx.disposables) {
      try {
        if (d && d.dispose) d.dispose();
      } catch (e) {
      }
    }
    ctx.disposables.length = 0;
    list.length = 0;
  }
  function _debug() {
    const arrays = [];
    for (const c of list) if (c.arrays) for (const a of c.arrays()) arrays.push(a);
    for (const a of ctx.ink.arrays()) arrays.push(a);
    return { creatures: list.map((c) => (c.info ? c.info() : { kind: c.kind })), arrays, list, ink: ctx.ink, dens: { octopus: octDens.length, moray: morDens.length } };
  }
  function keepOut(x, z, r) { if (Number.isFinite(x + z + r)) W.avoid.push({ x, z, r }); }
  update(1 / 60, 0, null);
  return { update, dispose, group: root, _debug, keepOut };
}

var critters = Object.freeze({
  __proto__: null,
  createCritters: createCritters
});

