// rare.js
const TAU$4 = Math.PI * 2;
const DEG$2 = Math.PI / 180;
const clamp$5 = (x, a, b) => (x < a ? a : x > b ? b : x);
const lerp$2 = (a, b, t) => a + (b - a) * t;
const sstep$4 = (a, b, x) => {
  const t = clamp$5((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
let gseed = 0x51a7e;
function grand() {
  gseed = (gseed + 0x6d2b79f5) | 0;
  let t = gseed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const rnd = () => Math.random();
const rr$1 = (a, b) => a + (b - a) * Math.random();
const gf$2 = (x) => (+x).toFixed(4);
const _col$1 = new THREE.Color();
const gc$2 = (hex) => {
  _col$1.set(hex);
  return `vec3(${gf$2(_col$1.r)}, ${gf$2(_col$1.g)}, ${gf$2(_col$1.b)})`;
};

let Geo$1 = class Geo {
  constructor() { this.p = []; this.a = []; this.b = []; this.ix = []; }
  get n() { return this.p.length / 3; }
  v(x, y, z, a0 = 0, a1 = 0, a2 = 0, a3 = 0, b0 = 0, b1 = 0, b2 = 0, b3 = 0) {
    this.p.push(x, y, z); this.a.push(a0, a1, a2, a3); this.b.push(b0, b1, b2, b3);
    return this.n - 1;
  }
  tri(a, b, c) { this.ix.push(a, b, c); }
  quad(a, b, c, d) { this.ix.push(a, b, c, a, c, d); }
  rows(start, nu, nv, flip) {
    for (let j = 0; j < nv; j++) {
      for (let i = 0; i < nu; i++) {
        const a = start + j * (nu + 1) + i, b = a + 1, c = a + nu + 2, d = a + nu + 1;
        if (flip) this.quad(a, d, c, b); else this.quad(a, b, c, d);
      }
    }
  }
  build() {
    const pos = new Float32Array(this.p), ix = this.ix, nrm = new Float32Array(pos.length);
    for (let i = 0; i < ix.length; i += 3) {
      const a = ix[i] * 3, b = ix[i + 1] * 3, c = ix[i + 2] * 3;
      const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2];
      const vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      for (const k of [a, b, c]) { nrm[k] += nx; nrm[k + 1] += ny; nrm[k + 2] += nz; }
    }
    for (let i = 0; i < nrm.length; i += 3) {
      const l = Math.hypot(nrm[i], nrm[i + 1], nrm[i + 2]);
      if (l > 1e-14) { nrm[i] /= l; nrm[i + 1] /= l; nrm[i + 2] /= l; } else { nrm[i + 1] = 1; }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
    g.setAttribute('aA', new THREE.BufferAttribute(new Float32Array(this.a), 4));
    g.setAttribute('aB', new THREE.BufferAttribute(new Float32Array(this.b), 4));
    g.setIndex(new THREE.BufferAttribute(this.n > 65535 ? new Uint32Array(ix) : new Uint16Array(ix), 1));
    g.computeBoundingSphere();
    return g;
  }
};

function plate(b, nu, nv, fn, attr) {
  const r = [0, 0, 0, 0, 0, 0, 0];
  for (let side = 0; side < 2; side++) {
    const sg = side ? -1 : 1, base = b.n;
    for (let j = 0; j <= nv; j++) {
      for (let i = 0; i <= nu; i++) {
        const u = i / nu, v = j / nv;
        fn(u, v, r);
        const t = r[6] * sg, A = attr(u, v, sg);
        b.v(r[0] + r[3] * t, r[1] + r[4] * t, r[2] + r[5] * t, A[0], A[1], A[2], A[3], A[4], A[5], A[6], A[7]);
      }
    }
    b.rows(base, nu, nv, sg < 0);
  }
}

function tube$1(b, pts, radii, sides, attr, flatY = 1) {
  const radf = typeof radii === 'function' ? radii : null;
  const n = pts.length, base = b.n;
  for (let i = 0; i < n; i++) {
    const p = pts[i], a = pts[Math.max(i - 1, 0)], c = pts[Math.min(i + 1, n - 1)];
    let tx = c[0] - a[0], ty = c[1] - a[1], tz = c[2] - a[2];
    const tl = Math.hypot(tx, ty, tz) || 1;
    tx /= tl; ty /= tl; tz /= tl;
    let ux = 0, uy = 1, uz = 0;
    const d = ux * tx + uy * ty + uz * tz;
    ux -= tx * d; uy -= ty * d; uz -= tz * d;
    let ul = Math.hypot(ux, uy, uz);
    if (ul < 1e-4) { ux = 1; uy = 0; uz = 0; ul = 1; }
    ux /= ul; uy /= ul; uz /= ul;
    const sx = uy * tz - uz * ty, sy = uz * tx - ux * tz, sz = ux * ty - uy * tx;
    const t = i / (n - 1);
    for (let k = 0; k <= sides; k++) {
      const r0 = radf ? radf(t, k / sides) : radii[i];
      const an = (k / sides) * TAU$4, ca = Math.cos(an) * r0, sa = Math.sin(an) * r0 * flatY;
      const A = attr(t, k / sides);
      b.v(p[0] + sx * ca + ux * sa, p[1] + sy * ca + uy * sa, p[2] + sz * ca + uz * sa, A[0], A[1], A[2], A[3], A[4], A[5], A[6], A[7]);
    }
  }
  b.rows(base, sides, n - 1, false);
}

function blob(b, c, rad, nu, nv, attr, shape) {
  const base = b.n;
  for (let j = 0; j <= nv; j++) {
    const th = (j / nv) * Math.PI, st = Math.sin(th), ct = Math.cos(th);
    for (let i = 0; i <= nu; i++) {
      const ph = (i / nu) * TAU$4;
      let x = st * Math.cos(ph), y = ct, z = st * Math.sin(ph);
      if (shape) { const q = shape(x, y, z); x = q[0]; y = q[1]; z = q[2]; }
      const A = attr(x, y, z);
      b.v(c[0] + x * rad[0], c[1] + y * rad[1], c[2] + z * rad[2], A[0], A[1], A[2], A[3], A[4], A[5], A[6], A[7]);
    }
  }
  b.rows(base, nu, nv, true);
}

function keyed(keys) {
  const n = keys.length, m = keys[0].length - 1;
  return (t, out) => {
    if (t <= keys[0][0]) { for (let k = 0; k < m; k++) out[k] = keys[0][k + 1]; return out; }
    if (t >= keys[n - 1][0]) { for (let k = 0; k < m; k++) out[k] = keys[n - 1][k + 1]; return out; }
    let i = 0;
    while (i < n - 2 && keys[i + 1][0] < t) i++;
    const k0 = keys[Math.max(i - 1, 0)], k1 = keys[i], k2 = keys[i + 1], k3 = keys[Math.min(i + 2, n - 1)];
    const h = k2[0] - k1[0], u = (t - k1[0]) / h, u2 = u * u, u3 = u2 * u;
    for (let k = 1; k <= m; k++) {
      const m1 = ((k2[k] - k0[k]) / Math.max(k2[0] - k0[0], 1e-6)) * h;
      const m2 = ((k3[k] - k1[k]) / Math.max(k3[0] - k1[0], 1e-6)) * h;
      out[k - 1] = (2 * u3 - 3 * u2 + 1) * k1[k] + (u3 - 2 * u2 + u) * m1 + (-2 * u3 + 3 * u2) * k2[k] + (u3 - u2) * m2;
    }
    return out;
  };
}

const R_FCOMMON =  `
uniform float uRDetail;
float rHash(vec2 q) { return fract(sin(dot(q, vec2(127.1, 311.7))) * 43758.5453); }
float rNoise(vec2 q) {
  vec2 i = floor(q), f = fract(q);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(rHash(i), rHash(i + vec2(1.0, 0.0)), u.x), mix(rHash(i + vec2(0.0, 1.0)), rHash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float rFbm(vec2 q) { return rNoise(q) * 0.55 + rNoise(q * 2.13 + 7.1) * 0.3 + rNoise(q * 4.37 - 3.3) * 0.15; }
float rLine(float d, float w) {
  float fw = max(fwidth(d), 1e-5);
  return (1.0 - smoothstep(0.5 * (w - fw), 0.5 * (w + fw), abs(d))) * min(1.0, w / fw);
}
float rAA(float x) { return clamp(1.5 - 2.0 * fwidth(x), 0.0, 1.0); }
float rIGN(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
vec3 rCells(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  float d1 = 8.0, d2 = 8.0, h = 0.0;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 g = vec2(float(x), float(y));
    float hh = rHash(i + g);
    vec2 o = g + 0.5 + 0.38 * vec2(hh - 0.5, fract(hh * 7.31) - 0.5) - f;
    float d = dot(o, o);
    if (d < d1) { d2 = d1; d1 = d; h = hh; } else if (d < d2) d2 = d;
  }
  return vec3(sqrt(d1), sqrt(d2) - sqrt(d1), h);
}
`;

function rareMaterial(o, patch) {
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: o.rough || 0.6, metalness: 0, side: THREE.DoubleSide });
  mat.defines = Object.assign({}, mat.defines, { RARE_SPECIES: o.id });
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, o.uniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\n' + o.vdecl)
      .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\n' + (o.vnormal || ''))
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n' + o.vdeform);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + R_FCOMMON + o.fdecl)
      .replace('#include <color_fragment>', '#include <color_fragment>\nfloat rRough = roughness;\nfloat rMet = 0.0;\nvec3 rEmi = vec3(0.0);\n' + o.fcolor)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = rRough;')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = rMet;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += rEmi;');
    if (o.spec !== undefined) sh.fragmentShader = sh.fragmentShader.replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\nreflectedLight.indirectSpecular *= ' + gf$2(o.spec) + ';');
  };
  const m = (patch && patch(mat)) || mat;
  const base = m.customProgramCacheKey;
  m.customProgramCacheKey = function () { return 'rare-' + o.key + '|' + base.call(this); };
  const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  depth.defines = { RARE_DEPTH: o.id };
  depth.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, o.uniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\n' + o.vdecl)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n' + o.vdeform);
  };
  depth.customProgramCacheKey = () => 'rare-depth-' + o.key;
  return { mat: m, depth };
}

const R_FADE =  `
if (vRFade < 0.999 && rIGN(gl_FragCoord.xy) > vRFade) discard;
`;

class Path {
  constructor() { this.P = new Float64Array(12); this.tab = new Float64Array(65); this.len = 1; }
  set(p0, p1, p2, p3) {
    const P = this.P;
    for (let k = 0; k < 3; k++) { P[k] = p0[k]; P[3 + k] = p1[k]; P[6 + k] = p2[k]; P[9 + k] = p3[k]; }
    const a = [0, 0, 0], c = [0, 0, 0];
    this.point(0, a);
    this.tab[0] = 0;
    let L = 0;
    for (let j = 1; j <= 64; j++) {
      this.point(j / 64, c);
      L += Math.hypot(c[0] - a[0], c[1] - a[1], c[2] - a[2]);
      this.tab[j] = L;
      a[0] = c[0]; a[1] = c[1]; a[2] = c[2];
    }
    this.len = Math.max(L, 1e-3);
    return this;
  }
  point(u, out) {
    const P = this.P, w = 1 - u, b0 = w * w * w, b1 = 3 * w * w * u, b2 = 3 * w * u * u, b3 = u * u * u;
    for (let k = 0; k < 3; k++) out[k] = b0 * P[k] + b1 * P[3 + k] + b2 * P[6 + k] + b3 * P[9 + k];
    return out;
  }
  tangent(u, out) {
    const P = this.P, w = 1 - u, b0 = -3 * w * w, b1 = 3 * w * w - 6 * w * u, b2 = 6 * w * u - 3 * u * u, b3 = 3 * u * u;
    for (let k = 0; k < 3; k++) out[k] = b0 * P[k] + b1 * P[3 + k] + b2 * P[6 + k] + b3 * P[9 + k];
    const l = Math.hypot(out[0], out[1], out[2]) || 1;
    out[0] /= l; out[1] /= l; out[2] /= l;
    return out;
  }
  at(s, out, tan) {
    if (s <= 0 || s >= this.len) {
      const e = s <= 0 ? 0 : 1, x = s <= 0 ? s : s - this.len;
      this.point(e, out); this.tangent(e, tan);
      out[0] += tan[0] * x; out[1] += tan[1] * x; out[2] += tan[2] * x;
      return e;
    }
    let j = 0;
    while (j < 63 && this.tab[j + 1] < s) j++;
    const seg = this.tab[j + 1] - this.tab[j], u = (j + (seg > 1e-9 ? (s - this.tab[j]) / seg : 0)) / 64;
    this.point(u, out); this.tangent(u, tan);
    return u;
  }
}

function writeMatrix(m, o, fx, fy, fz, roll, sx, sy, sz, px, py, pz) {
  let lx = fz, ly = 0, lz = -fx;
  let ll = Math.hypot(lx, lz);
  if (ll < 1e-5) { lx = 1; lz = 0; ll = 1; }
  lx /= ll; lz /= ll;
  const ux = fy * lz - fz * ly, uy = fz * lx - fx * lz, uz = fx * ly - fy * lx;
  const cb = Math.cos(roll), sb = Math.sin(roll);
  const Xx = lx * cb + ux * sb, Xy = ly * cb + uy * sb, Xz = lz * cb + uz * sb;
  const Yx = ux * cb - lx * sb, Yy = uy * cb - ly * sb, Yz = uz * cb - lz * sb;
  m[o] = Xx * sx; m[o + 1] = Xy * sx; m[o + 2] = Xz * sx; m[o + 3] = 0;
  m[o + 4] = Yx * sy; m[o + 5] = Yy * sy; m[o + 6] = Yz * sy; m[o + 7] = 0;
  m[o + 8] = fx * sz; m[o + 9] = fy * sz; m[o + 10] = fz * sz; m[o + 11] = 0;
  m[o + 12] = px; m[o + 13] = py; m[o + 14] = pz; m[o + 15] = 1;
}

function speciesMesh(root, geo, mm, count, names, name) {
  const attrs = {};
  for (const nm of names) {
    const a = new THREE.InstancedBufferAttribute(new Float32Array(count * 4), 4);
    a.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute(nm, a);
    attrs[nm] = a;
  }
  const mesh = new THREE.InstancedMesh(geo, mm.mat, count);
  mesh.name = name;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;
  mesh.castShadow = true;
  mesh.receiveShadow = false;
  mesh.customDepthMaterial = mm.depth;
  mesh.visible = false;
  const m = mesh.instanceMatrix.array;
  for (let k = 0; k < count; k++) writeMatrix(m, k * 16, 0, 0, 1, 0, 1e-3, 1e-3, 1e-3, 0, -500, 0);
  root.add(mesh);
  return { mesh, attrs, count };
}

const RAY_LD = 0.82;
const RAY_EYE = [0.072, 0.2];
const RAY_SPI = [0.07, 0.262];
function rayHalfWidth(v) {
  const vc = 0.42;
  let F;
  if (v < vc) {
    const q = v / vc, f = Math.pow(q, 1.08) * (1 - 0.07 * Math.sin(Math.PI * q));
    const k = 0.09, h = clamp$5(0.5 + (0.5 * (1 - f)) / k, 0, 1);
    F = lerp$2(1, f, h) - k * h * (1 - h);
  } else {
    const q = (v - vc) / (1 - vc);
    F = 0.13 + 0.87 * Math.pow(Math.max(0, 1 - Math.pow(q, 1.75)), 0.78) - 0.02 * Math.sin(Math.PI * Math.min(1, q * 1.2));
  }
  return 0.5 * Math.max(F, 0.004);
}
function rayTop(r, v) {
  const along = Math.pow(Math.sin(Math.PI * clamp$5(v * 0.92 + 0.05, 0, 1)), 0.55);
  return 0.082 * Math.pow(Math.max(0, 1 - r * r), 1.7) * along + 0.002;
}
function rayBot(r, v) {
  const along = Math.pow(Math.sin(Math.PI * clamp$5(v * 0.9 + 0.06, 0, 1)), 0.7);
  return -(0.032 * Math.pow(Math.max(0, 1 - r * r), 1.2) * along + 0.001);
}
function buildStingray() {
  const b = new Geo$1();
  const NU = 16, NV = 26;
  for (let face = 0; face < 2; face++) {
    const base = b.n;
    for (let j = 0; j <= NV; j++) {
      const v = j / NV, hw = rayHalfWidth(v);
      for (let i = -NU; i <= NU; i++) {
        const rl = Math.abs(i) / NU, r = 1 - Math.pow(1 - rl, 1.15);
        const sd = i < 0 ? -1 : 1, x = sd * r * hw, z = RAY_LD * (0.5 - v);
        const y = face === 0 ? rayTop(r, v) : rayBot(r, v);
        b.v(x, y, z, r, v, face, 0, hw, i === 0 ? 1 : sd, 0, 0);
      }
    }
    b.rows(base, 2 * NU, NV, face === 1);
  }
  for (const sd of [-1, 1]) {
    const v = RAY_EYE[1], hw = rayHalfWidth(v), r = RAY_EYE[0] / hw;
    const cy = rayTop(r, v) - 0.004;
    blob(b, [sd * RAY_EYE[0], cy, RAY_LD * (0.5 - v)], [0.016, 0.013, 0.02], 10, 6,
      (x, y, z) => [r, v, 3, 0, hw, sd, y, 0]);
  }
  const tp = [], tr = [], NT = 18, TL = 1.2 * RAY_LD;
  for (let k = 0; k <= NT; k++) {
    const t = k / NT;
    tp.push([0, 0.004 - 0.004 * t, -RAY_LD * 0.47 - TL * t]);
    tr.push(0.028 * Math.pow(1 - t, 1.3) + 0.0025);
  }
  tube$1(b, tp, tr, 8, (t) => [0, 1, 2, t, 0, 0, 0, 0], 0.62);
  {
    const t0 = 0.34, z0 = -RAY_LD * 0.47 - TL * t0, rad = 0.028 * Math.pow(1 - t0, 1.3) + 0.0025;
    tube$1(b, [[0, rad * 0.5, z0 + 0.03], [0, rad * 0.75, z0 - 0.04], [0, rad * 0.8, z0 - 0.11]], [0.006, 0.004, 0.0006], 5,
      (t) => [0, 1, 4, t0 + t * 0.1, 0, 0, 0, 0], 0.5);
  }
  return b.build();
}

const RAY_VDECL =  `
attribute vec4 aA;
attribute vec4 aB;
attribute vec4 aRS;
attribute vec4 aRX;
varying vec4 vRA;
varying vec3 vRObj;
varying vec4 vRX;
varying float vRFade;
varying vec3 vRW;
float rayDisp(float r, float s, float side) {
  float env = pow(smoothstep(0.3, 1.0, r), 1.5) * mix(0.35, 1.0, smoothstep(0.1, 0.7, s));
  float A = aRS.y * (1.0 + 0.4 * aRS.z * side) * (1.0 - aRS.w);
  return A * env * sin(aRS.x - 8.168 * s + side * 0.35);
}
`;
const RAY_VNORMAL =  `
if (aA.z < 1.5) {
  float rN = aA.x, sN = aA.y, sd = aB.y;
  float r1 = min(rN + 0.015, 1.0), r0 = max(rN - 0.015, 0.0);
  float s1 = min(sN + 0.015, 1.0), s0 = max(sN - 0.015, 0.0);
  float dr = (rayDisp(r1, sN, sd) - rayDisp(r0, sN, sd)) / (r1 - r0);
  float ds = (rayDisp(rN, s1, sd) - rayDisp(rN, s0, sd)) / (s1 - s0);
  vec3 g = vec3(dr * sd / max(aB.x, 0.02), 0.0, -ds / ${gf$2(RAY_LD)});
  objectNormal = normalize(objectNormal - objectNormal.y * g);
}
`;
const RAY_VDEFORM =  `
vRA = aA;
vRObj = position;
vRX = vec4(aRS.w, aRX.z, aRX.y, 0.0);
vRFade = aRX.w;
if (aA.z < 1.5) {
  transformed.y += rayDisp(aA.x, aA.y, aB.y);
  transformed.y = transformed.y * (1.0 - 0.55 * aRS.w) - aRS.w * (0.01 + 0.02 * smoothstep(0.5, 1.0, aA.x));
} else if (aA.z > 1.5 && aA.z < 2.5 || aA.z > 3.5) {
  float t = aA.w, live = 1.0 - 0.9 * aRS.w;
  transformed.x += (0.035 * t * sin(aRX.x - 3.2 * t) + 0.16 * aRS.z * t * t) * live;
  transformed.y += 0.025 * t * sin(aRS.x * 0.5 - 2.2 * t) * live - aRS.w * 0.012 * t;
}
#ifdef USE_INSTANCING
vRW = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
#else
vRW = (modelMatrix * vec4(transformed, 1.0)).xyz;
#endif
`;
const RAY_FDECL =  `
uniform vec3 uRSand;
varying vec3 vRW;
varying vec4 vRA;
varying vec3 vRObj;
varying vec4 vRX;
varying float vRFade;
`;
const RAY_FCOLOR = R_FADE +  `
{
  float part = vRA.z, r = vRA.x, s = vRA.y;
  vec3 P = vRObj;
  vec3 c;
  float rough = 0.62;
  vec2 eq = vec2(abs(P.x) - ${gf$2(RAY_EYE[0])}, (P.z - ${gf$2(RAY_LD * (0.5 - RAY_EYE[1]))}) * 0.8);
  float nearEye = 1.0 - smoothstep(0.022, 0.05, length(eq));
  vec2 sq = vec2(abs(P.x) - ${gf$2(RAY_SPI[0])}, P.z - ${gf$2(RAY_LD * (0.5 - RAY_SPI[1]))});
  float nearSpi = 1.0 - smoothstep(0.02, 0.045, length(sq));
  if (part < 0.5) {
    float n = rFbm(P.xz * 6.0 + vRX.y * 17.0);
    c = mix(${gc$2(0x5a4f3f)}, ${gc$2(0x76684f)}, n);
    c *= 0.9 + 0.12 * smoothstep(0.08, 0.55, r);
    c = mix(c, c * 0.8, (1.0 - smoothstep(0.0, 0.06, abs(P.x))) * smoothstep(0.25, 0.4, s) * 0.5);
    float open = 0.5 + 0.5 * sin(vRX.z);
    float sp = 1.0 - smoothstep(0.75, 1.0, length(sq / vec2(0.017, 0.006 + 0.008 * open)));
    c = mix(c, vec3(0.025, 0.02, 0.016), sp * 0.92);
    c = mix(c, c * 0.72, (1.0 - smoothstep(0.018, 0.03, length(sq / vec2(1.0, 0.7)))) * (1.0 - sp) * 0.6);
  } else if (part < 1.5) {
    c = mix(${gc$2(0xe6e3d8)}, ${gc$2(0x4a443b)}, smoothstep(0.72, 0.88, r));
    float mouth = rLine(P.z - ${gf$2(RAY_LD * (0.5 - 0.2))} - 8.0 * P.x * P.x, 0.004) * (1.0 - smoothstep(0.03, 0.045, abs(P.x)));
    float gz = (P.z - ${gf$2(RAY_LD * (0.5 - 0.29))}) / 0.016;
    float gill = rLine(fract(gz) - 0.5, 0.18) * step(-2.5, gz) * step(gz, 2.5) * smoothstep(0.075, 0.085, abs(P.x)) * (1.0 - smoothstep(0.1, 0.11, abs(P.x)));
    c = mix(c, c * 0.45, max(mouth, gill * rAA(gz)) * 0.8);
  } else if (part < 2.5) {
    float up = smoothstep(-0.004, 0.004, P.y - 0.004 + 0.004 * vRA.w);
    c = mix(${gc$2(0x6d6556)}, ${gc$2(0x3f382e)}, 0.6 + 0.4 * vRA.w);
    c = mix(c * 1.35, c, up);
  } else if (part < 3.5) {
    vec3 d = P - vec3(sign(P.x) * ${gf$2(RAY_EYE[0])}, P.y, ${gf$2(RAY_LD * (0.5 - RAY_EYE[1]))});
    float er = length(d.xz / vec2(0.016, 0.02));
    c = mix(vec3(0.02), ${gc$2(0x8a7550)}, smoothstep(0.35, 0.5, er));
    c = mix(c, ${gc$2(0x5a4f3f)}, smoothstep(0.75, 0.95, er));
    rough = mix(0.12, 0.6, smoothstep(0.7, 0.95, er));
  } else {
    c = ${gc$2(0xb9ad94)};
    rough = 0.35;
  }
  if (vRX.x > 0.001 && part != 1.0) {
    float g = rFbm(P.xz * 6.0 + 3.1);
    float need = 0.22 + 0.55 * (part < 0.5 ? r : 0.8) + 0.3 * (g - 0.5);
    float cover = smoothstep(need - 0.1, need + 0.1, vRX.x * 1.15);
    cover *= 1.0 - max(nearEye, nearSpi * 0.85);
    float ph = dot(vRW.xz, vec2(0.97, -0.24)) * 52.0 + (rNoise(vRW.xz * 1.3) - 0.5) * 7.0 + (rNoise(vRW.xz * 0.4 + 2.0) - 0.5) * 16.0;
    float h3 = 0.5 + 0.5 * cos(ph + 0.5 * sin(ph));
    vec3 sandC = uRSand * 0.84 * (0.9 + 0.12 * rNoise(vRW.xz * 60.0)) * (1.0 + 0.3 * (h3 - 0.5) * rAA(ph / 6.2832));
    sandC *= 1.0 - 0.12 * (1.0 - smoothstep(0.0, 0.35, cover)) * cover;
    c = mix(c, sandC, cover);
    rough = mix(rough, 0.95, cover);
  }
  diffuseColor.rgb = c;
  rRough = rough;
}
`;

const EA_A0 = 0.16;
const EA_TAIL = 1.75;
const EA_AMP = 0.85;
const eaLE = (a) => 0.17 - 0.24 * Math.pow(a, 1.1);
const eaTE = (a) => lerp$2(-0.3, -0.085, a) + 0.03 * Math.sin(Math.PI * Math.pow(a, 0.9));
const eaSec = (c) => Math.pow(Math.max(0, Math.sin(Math.PI * Math.pow(clamp$5(c, 0, 1), 0.75))), 0.7);
const eaTop = (a, c) => (0.073 * Math.pow(1 - sstep$4(0, 0.34, a), 1.3) + 0.014 * Math.pow(1 - a, 1.4)) * eaSec(c) + 0.0008;
const eaBot = (a, c) => -((0.032 * Math.pow(1 - sstep$4(0, 0.3, a), 1.3) + 0.006 * Math.pow(1 - a, 1.4)) * eaSec(c) + 0.0006);
function buildEagleRay() {
  const b = new Geo$1();
  const NA = 24, NC = 12;
  for (let face = 0; face < 2; face++) {
    for (const sd of [-1, 1]) {
      const base = b.n;
      for (let j = 0; j <= NC; j++) {
        const c = j / NC;
        for (let i = 0; i <= NA; i++) {
          const a = Math.pow(i / NA, 0.9);
          const z = lerp$2(eaLE(a), eaTE(a), c);
          b.v(sd * a * 0.5, face === 0 ? eaTop(a, c) : eaBot(a, c), z, a, c, face, 0, sd, 0, 0, 0);
        }
      }
      b.rows(base, NA, NC, (face === 1) !== (sd < 0));
    }
  }
  blob(b, [0, 0.014, 0.19], [0.066, 0.05, 0.11], 16, 10, (x, y, z) => [0, 0, 2, 0, x < 0 ? -1 : 1, 0, 0, 0],
    (x, y, z) => { const f = Math.max(0, z); return [x * (1 - 0.2 * f), y * (1 - 0.32 * f) - 0.12 * f * f, z]; });
  for (const sd of [-1, 1]) {
    blob(b, [sd * 0.058, 0.03, 0.205], [0.012, 0.012, 0.015], 8, 5, () => [0, 0, 4, 0, sd, 0, 0, 0]);
  }
  const tp = [], tr = [], NT = 30;
  for (let k = 0; k <= NT; k++) {
    const t = k / NT;
    tp.push([0, 0.006 - 0.06 * t * t, -0.27 - EA_TAIL * t]);
    tr.push(0.015 * Math.pow(1 - t, 1.5) + 0.0014);
  }
  tube$1(b, tp, tr, 6, (t) => [0, 1, 3, t, 0, 0, 0, 0], 0.8);
  plate(b, 3, 2, (u, v, r) => {
    const z0 = -0.29 - EA_TAIL * 0.012, zl = z0 - 0.05 * v, h = 0.035 * (1 - v) * u;
    r[0] = 0; r[1] = 0.014 + h; r[2] = zl - 0.02 * u; r[3] = 1; r[4] = 0; r[5] = 0; r[6] = 0.0015;
  }, (u, v) => [0, 1, 5, 0.012 + 0.02 * v, 0, 0, 0, 0]);
  return b.build();
}

const EA_VDECL =  `
attribute vec4 aA;
attribute vec4 aB;
attribute vec4 aE;
attribute vec4 aEX;
varying vec4 vRA;
varying vec3 vRObj;
varying float vRFade;
varying float vRSeed;
float eaTheta(float c) {
  return aE.y * (1.0 - 0.3 * c) * sin(aE.x - 1.31 * c) - 0.5 * aE.w;
}
float eaAng(float c, float d) { return eaTheta(c) / ${gf$2((1 - EA_A0) * 0.5)} * d; }
`;
const EA_VNORMAL =  `
if (aA.z < 1.5 && aA.x > ${gf$2(EA_A0)}) {
  float ang = eaAng(aA.y, (aA.x - ${gf$2(EA_A0)}) * 0.5);
  float sd = aB.x, ca = cos(ang), sa = sin(ang);
  objectNormal = vec3(objectNormal.x * ca - sd * objectNormal.y * sa, objectNormal.y * ca + sd * objectNormal.x * sa, objectNormal.z);
}
`;
const EA_VDEFORM =  `
vRA = aA;
vRObj = position;
vRFade = aEX.z;
vRSeed = aEX.y;
float eaHeave = -0.022 * (aE.y / ${gf$2(EA_AMP)}) * sin(aE.x);
if (aA.z < 1.5 && aA.x > ${gf$2(EA_A0)}) {
  float sd = aB.x;
  float d = (aA.x - ${gf$2(EA_A0)}) * 0.5;
  float k = eaTheta(aA.y) / ${gf$2((1 - EA_A0) * 0.5)};
  float ang = k * d;
  float bx = abs(k) > 1e-4 ? sin(ang) / k : d;
  float by = abs(k) > 1e-4 ? (1.0 - cos(ang)) / k : 0.0;
  float y0 = transformed.y;
  transformed.x = sd * (${gf$2(EA_A0 * 0.5)} + bx - y0 * sin(ang));
  transformed.y = by + y0 * cos(ang);
}
transformed.y += eaHeave;
if (aA.z > 2.5 && aA.z < 3.5 || aA.z > 4.5) {
  float t = aA.w;
  transformed.x += aE.z * t * t * 1.6 + 0.035 * t * sin(aEX.x - 4.0 * t);
  transformed.y += -0.05 * t * (aE.y / ${gf$2(EA_AMP)}) * sin(aE.x - 2.2 - 3.0 * t) - eaHeave * t * (1.0 - t);
}
`;
const EA_FDECL =  `
varying vec4 vRA;
varying vec3 vRObj;
varying float vRFade;
varying float vRSeed;
`;
const EA_FCOLOR = R_FADE +  `
{
  float part = vRA.z;
  vec3 P = vRObj;
  vec3 c;
  float rough = 0.5;
  if (part < 0.5) {
    float n = rFbm(P.xz * 3.5 + vRSeed * 11.0);
    c = mix(${gc$2(0x3a2b1c)}, ${gc$2(0x5e4830)}, 0.3 + 0.6 * n);
    c = mix(c, ${gc$2(0x2a1f14)}, (1.0 - smoothstep(0.03, 0.24, vRA.x)) * 0.45);
    c *= 0.92 + 0.16 * smoothstep(0.3, 1.0, vRA.x) * (0.6 + 0.4 * vRA.y);
    rough = 0.42;
  } else if (part < 1.5) {
    float edge = max(smoothstep(0.8, 0.98, vRA.x), smoothstep(0.82, 1.0, vRA.y) * smoothstep(0.35, 0.7, vRA.x));
    c = mix(${gc$2(0xece8dd)}, ${gc$2(0x4f3e2c)}, edge * 0.8);
    rough = 0.55;
  } else if (part < 2.5) {
    float up = smoothstep(-0.015, 0.015, P.y - 0.008);
    c = mix(${gc$2(0xddd7c9)}, ${gc$2(0x3a2b1c)}, up);
  } else if (part < 4.5 && part > 3.5) {
    vec2 q = vec2(P.z - 0.205, P.y - 0.03) / 0.012;
    float er = length(q);
    c = mix(vec3(0.015), ${gc$2(0x7a6a45)}, smoothstep(0.45, 0.62, er));
    c = mix(c, ${gc$2(0x4a3420)}, smoothstep(0.8, 1.0, er));
    rough = mix(0.1, 0.5, smoothstep(0.7, 0.95, er));
  } else {
    c = mix(${gc$2(0x3b2c1c)}, ${gc$2(0x201810)}, vRA.w);
  }
  diffuseColor.rgb = c;
  rRough = rough;
}
`;

const SH_END = 0.8;
const SH_PROF = keyed([
  [0.0, 0.0, 0.0, -0.012], [0.012, 0.017, 0.022, -0.011], [0.035, 0.033, 0.04, -8e-3], [0.07, 0.05, 0.056, -5e-3],
  [0.12, 0.066, 0.066, -2e-3], [0.2, 0.079, 0.074, 0.002], [0.3, 0.085, 0.075, 0.004], [0.4, 0.081, 0.068, 0.004],
  [0.5, 0.069, 0.056, 0.003], [0.6, 0.051, 0.04, 0.004], [0.68, 0.035, 0.027, 0.006], [0.74, 0.027, 0.02, 0.01],
  [0.8, 0.02, 0.013, 0.015],
]);
function buildShark() {
  const b = new Geo$1();
  const pr = [0, 0, 0];
  const at = (s) => SH_PROF(s, pr);
  const NS = 56, NR = 22, base = b.n;
  for (let j = 0; j <= NS; j++) {
    const s = Math.pow(j / NS, 1.12) * SH_END;
    at(s);
    const hh = Math.max(pr[0], 0.0015), hw = Math.max(pr[1], 0.0015), yc = pr[2];
    for (let i = 0; i <= NR; i++) {
      const th = (i / NR) * TAU$4, st = Math.sin(th), ct = Math.cos(th);
      const y = yc + hh * st * (st < 0 ? 0.9 : 1);
      b.v(hw * ct, y, 0.5 - s, s, 0, st, 0, 0, 0, 0, yc);
    }
  }
  b.rows(base, NR, NS, false);
  const backY = (s) => { at(s); return pr[2] + pr[0] * 0.96; };
  const bellyY = (s) => { at(s); return pr[2] - pr[0] * 0.86; };
  plate(b, 8, 5, (u, v, r) => {
    const sl = 0.27 + 0.07 * Math.pow(u, 0.9), st = 0.405 - 0.06 * Math.pow(u, 1.25) + 0.02 * Math.sin(Math.PI * u) * (1 - u);
    const s = lerp$2(sl, st, v), yb = backY(s);
    r[0] = 0; r[1] = yb + 0.12 * u; r[2] = 0.5 - s; r[3] = 1; r[4] = 0; r[5] = 0;
    r[6] = 0.009 * (1 - u) * 4 * v * (1 - v) + 0.0006;
  }, (u, v) => { const s = lerp$2(0.27 + 0.07 * Math.pow(u, 0.9), 0.405 - 0.06 * Math.pow(u, 1.25), v); return [s, 1, 1, u, 0, backY(s), 0, 0]; });
  plate(b, 4, 3, (u, v, r) => {
    const s = lerp$2(0.615 + 0.02 * u, 0.665 - 0.012 * u, v), yb = backY(s);
    r[0] = 0; r[1] = yb + 0.028 * u; r[2] = 0.5 - s; r[3] = 1; r[4] = 0; r[5] = 0; r[6] = 0.003 * (1 - u) + 0.0005;
  }, (u, v) => [lerp$2(0.615, 0.665, v), 2, 1, u, 0, 0, 0, 0]);
  plate(b, 4, 3, (u, v, r) => {
    const s = lerp$2(0.63 + 0.02 * u, 0.675 - 0.01 * u, v), yb = bellyY(s);
    r[0] = 0; r[1] = yb - 0.026 * u; r[2] = 0.5 - s; r[3] = 1; r[4] = 0; r[5] = 0; r[6] = 0.003 * (1 - u) + 0.0005;
  }, (u, v) => [lerp$2(0.63, 0.675, v), 5, -1, u, 0, 0, 0, 0]);
  for (const sd of [-1, 1]) {
    at(0.22);
    const root = [sd * pr[1] * 0.78, pr[2] - pr[0] * 0.55, 0.5 - 0.22];
    plate(b, 8, 4, (u, v, r) => {
      const L = 0.2 * u, sweep = 0.1 * u * u + 0.03 * u;
      const lx = root[0] + sd * L * 0.92, ly = root[1] - L * 0.3, lz = root[2] + 0.025 - sweep;
      const chord = 0.085 * (1 - 0.75 * Math.pow(u, 1.4)) * (1 - 0.35 * u) + 0.004;
      r[0] = lx; r[1] = ly + 0.01 * v * (1 - u); r[2] = lz - chord * v - 0.02 * u * u * v;
      r[3] = sd * 0.3; r[4] = 0.95; r[5] = 0; r[6] = 0.006 * (1 - u) * 4 * v * (1 - v) + 0.0006;
    }, (u, v) => [0.22 + 0.06 * v, 3, -0.2, u, root[0], root[1], root[2], 0]);
    at(0.54);
    const pr0 = [sd * pr[1] * 0.5, pr[2] - pr[0] * 0.8, 0.5 - 0.54];
    plate(b, 4, 2, (u, v, r) => {
      r[0] = pr0[0] + sd * 0.03 * u; r[1] = pr0[1] - 0.012 * u; r[2] = pr0[2] - 0.035 * v - 0.02 * u;
      r[3] = 0; r[4] = 1; r[5] = 0; r[6] = 0.003 * (1 - u) + 0.0005;
    }, (u, v) => [0.54 + 0.035 * v, 4, -0.5, u, 0, 0, 0, 0]);
  }
  plate(b, 12, 4, (u, v, r) => {
    const sL = 0.735 + 0.235 * u, yL = backY(0.74) - 0.008 + 0.2 * Math.pow(u, 1.05);
    const sT = 0.8 + 0.17 * u, yT = 0.0 + 0.195 * Math.pow(u, 1.25) - 0.022 * Math.sin(Math.PI * u) - (u > 0.76 && u < 0.9 ? 0.014 * Math.sin((u - 0.76) / 0.14 * Math.PI) : 0);
    const s = lerp$2(sL, sT, v);
    r[0] = 0; r[1] = lerp$2(yL, yT, v); r[2] = 0.5 - s; r[3] = 1; r[4] = 0; r[5] = 0; r[6] = 0.0045 * (1 - u) + 0.0006;
  }, (u, v) => [lerp$2(0.735 + 0.235 * u, 0.8 + 0.17 * u, v), 6, 1, u, 0, 0, 0, 0]);
  plate(b, 6, 3, (u, v, r) => {
    const sL = 0.755 + 0.12 * u, yL = bellyY(0.76) + 0.005 - 0.085 * Math.pow(u, 0.95);
    const sT = 0.8 + 0.075 * u, yT = -4e-3 - 0.085 * Math.pow(u, 1.3);
    const s = lerp$2(sL, sT, v);
    r[0] = 0; r[1] = lerp$2(yL, yT, v); r[2] = 0.5 - s; r[3] = 1; r[4] = 0; r[5] = 0; r[6] = 0.004 * (1 - u) + 0.0006;
  }, (u, v) => [lerp$2(0.755 + 0.12 * u, 0.8 + 0.075 * u, v), 6, -1, u, 0, 0, 0, 0]);
  return b.build();
}

const SH_TWIST =  `
float shTwist(float s) { return aS.y * 0.3 * sin(aS.x - 6.2832 * s - 1.2); }
`;
const SH_VDECL =  `
attribute vec4 aA;
attribute vec4 aB;
attribute vec4 aS;
attribute vec4 aSh;
varying vec4 vRA;
varying vec3 vRObj;
varying vec4 vRSh;
varying float vRFade;
float shAmp(float s) { return 0.012 - 0.02 * s + 0.11 * s * s; }
float shLat(float s) {
  return aS.y * shAmp(s) * sin(aS.x - 6.2832 * s) + aS.z * (s - 0.3) * (s - 0.3);
}
float shSlope(float s) {
  float ph = aS.x - 6.2832 * s;
  return aS.y * ((-0.02 + 0.22 * s) * sin(ph) - shAmp(s) * 6.2832 * cos(ph)) + 2.0 * aS.z * (s - 0.3);
}
` + SH_TWIST;
const SH_VNORMAL =  `
{
  float sN = clamp(0.5 - position.z, 0.0, 1.0);
  float m = shSlope(sN);
  float inv = inversesqrt(1.0 + m * m), sn = m * inv;
  objectNormal = vec3(objectNormal.x * inv + objectNormal.z * sn, objectNormal.y, objectNormal.z * inv - objectNormal.x * sn);
  if (aA.y > 5.5) objectNormal = normalize(vec3(objectNormal.x, objectNormal.y - objectNormal.x * shTwist(sN), objectNormal.z));
}
`;
const SH_VDEFORM =  `
vRA = aA;
vRObj = position;
vRSh = aSh;
vRFade = aS.w;
if (aA.y > 0.5 && aA.y < 1.5) transformed.y = aB.y + (transformed.y - aB.y) * aSh.x;
if (aA.y > 2.5 && aA.y < 3.5) transformed = aB.xyz + (transformed - aB.xyz) * vec3(aSh.y, 1.0, mix(1.0, aSh.y, 0.6));
{
  float sN = clamp(0.5 - position.z, 0.0, 1.0);
  transformed.x += shLat(sN);
  if (aA.y > 5.5) transformed.x += shTwist(sN) * (position.y - 0.01);
}
`;
const SH_FDECL =  `
varying vec4 vRA;
varying vec3 vRObj;
varying vec4 vRSh;
varying float vRFade;
`;
const SH_FCOLOR = R_FADE +  `
{
  float s = vRA.x, part = vRA.y, fv = vRA.z, edge = vRA.w;
  vec3 P = vRObj;
  float blue = vRSh.z;
  vec3 back = mix(${gc$2(0x716c5f)}, ${gc$2(0x1c3977)}, blue);
  vec3 flank = mix(${gc$2(0x9a9585)}, ${gc$2(0x3b74c6)}, blue);
  vec3 belly = ${gc$2(0xdddbd3)};
  vec3 c;
  float rough = 0.6;
  float mot = (rFbm(vec2(s * 26.0, fv * 3.2) + vRSh.w * 9.0) - 0.5) * uRDetail;
  float fin = (rNoise(vec2(s * 140.0, fv * 22.0) + vRSh.w * 5.0) - 0.5) * rAA(s * 140.0) * uRDetail;
  if (part < 0.5) {
    float line = -0.28 + 0.1 * sin(s * 9.0 + 0.6) - 0.1 * smoothstep(0.45, 0.7, s);
    c = mix(flank, back, smoothstep(0.0, 0.7, fv));
    c = mix(mix(flank, belly, 0.72), c, smoothstep(line + 0.02, line + 0.55, fv));
    c = mix(belly, c, smoothstep(line - 0.1, line + 0.08, fv));
    c = mix(c, mix(c, belly, 0.25), (1.0 - blue) * smoothstep(0.35, 0.5, s) * (1.0 - smoothstep(0.62, 0.72, s)) * (1.0 - smoothstep(0.0, 0.07, abs(fv - line - 0.1))));
    c *= 1.0 - 0.06 * smoothstep(0.55, 0.95, fv) - 0.05 * (1.0 - smoothstep(0.0, 0.08, s)) - 0.04 * smoothstep(0.6, 0.78, s);
    c *= (1.0 + 0.22 * mot * smoothstep(line, line + 0.3, fv)) * (1.0 + 0.12 * fin);
    rough = mix(0.6, mix(0.56, 0.64, smoothstep(0.2, 0.8, fv)), smoothstep(line - 0.05, line + 0.1, fv)) + 0.04 * fin;
    float gq = (s - 0.165) / 0.0125;
    float gill = rLine(fract(gq) - 0.5, 0.16) * step(0.0, gq) * step(gq, 5.0) * (1.0 - smoothstep(0.35, 0.5, abs(fv + 0.02)));
    c = mix(c, c * 0.55, gill * rAA(gq) * 0.75);
    vec2 eq = vec2((s - 0.066) / 0.0075, (fv - 0.17) / 0.11);
    float er = length(eq);
    c = mix(c, mix(vec3(0.006), ${gc$2(0x2a3528)}, smoothstep(0.25, 0.75, er) * (1.0 - smoothstep(0.75, 1.0, er)) * 0.6), 1.0 - smoothstep(0.8, 1.1, er));
    rough = mix(rough, 0.3, 1.0 - smoothstep(0.7, 1.0, er));
    float mouth = rLine(s - 0.065 - 0.5 * P.x * P.x / 0.01, 0.006) * (1.0 - smoothstep(-0.55, -0.35, fv));
    c = mix(c, c * 0.6, mouth * 0.45);
  } else {
    float te = 0.0;
    if (part < 1.5) te = smoothstep(0.385 - 0.06 * pow(edge, 1.25), 0.405 - 0.06 * pow(edge, 1.25), s);
    else if (part > 2.5 && part < 3.5) te = smoothstep(0.72, 1.0, (s - 0.22) / 0.06);
    else if (part > 5.5) {
      float sL = fv > 0.0 ? 0.735 + 0.235 * edge : 0.755 + 0.12 * edge, sT = fv > 0.0 ? 0.8 + 0.17 * edge : 0.8 + 0.075 * edge;
      te = smoothstep(0.72, 1.0, (s - sL) / max(sT - sL, 0.01));
    }
    float dusk = max(smoothstep(0.68, 1.0, edge), te);
    c = mix(back * 1.1, back * 0.7, dusk * mix(0.65, 0.35, blue));
    c *= (1.0 + 0.1 * mot) * (1.0 + 0.1 * fin);
    if (part > 2.5 && part < 4.5) c = mix(c, mix(belly, flank, 0.35), smoothstep(-0.2, -0.6, P.y - (-0.02)) * 0.7);
    if (part > 4.5 && part < 5.5) c = mix(belly, c, 0.5);
    rough = 0.62;
  }
  diffuseColor.rgb = c;
  rRough = rough;
}
`;

const TU_HW = keyed([[0, 0.13], [0.05, 0.26], [0.15, 0.355], [0.3, 0.4], [0.48, 0.385], [0.66, 0.315], [0.82, 0.21], [0.93, 0.11], [1.0, 0.03]]);
const TU_H = keyed([[0, 0.055], [0.12, 0.145], [0.33, 0.205], [0.6, 0.18], [0.82, 0.105], [1, 0.022]]);
const TU_FP = [0.25, -0.03, 0.27], TU_RP = [0.17, -0.045, -0.33], TU_NP = [0, 0.0, 0.43];
const tuSerr = (v) => 1 - 0.045 * sstep$4(0.45, 0.65, v) * Math.pow(Math.abs(Math.sin(v * Math.PI * 11)), 0.7);
function buildTurtle() {
  const b = new Geo$1(), o = [0];
  const NU = 16, NV = 44;
  for (let face = 0; face < 2; face++) {
    const base = b.n;
    for (let j = 0; j <= NV; j++) {
      const v = j / NV, h = TU_H(v, o)[0];
      for (let i = -NU; i <= NU; i++) {
        const u = i / NU, au = Math.abs(u);
        const hw = TU_HW(v, o)[0] * lerp$2(1, tuSerr(v), sstep$4(0.8, 1, au));
        const y = face === 0 ? h * Math.pow(Math.max(0, 1 - au * au), 0.8) * (1 - 0.12 * sstep$4(0.82, 1, au)) + 0.012 * (1 - sstep$4(0, 0.14, au)) * Math.sin(Math.PI * v)
          : -0.072 * Math.pow(Math.max(0, 1 - u * u), 0.6) * Math.pow(Math.sin(Math.PI * clamp$5(v * 1.02, 0, 1)), 0.5);
        b.v(u * hw, y, 0.5 - v, face, u, v, 0);
      }
    }
    b.rows(base, 2 * NU, NV, face === 1);
  }
  tube$1(b, [[0, -0.01, 0.36], [0, -4e-3, 0.45], [0, 0.0, 0.52]], [0.085, 0.088, 0.09], 12, (t) => [2, t * 0.4, 0, 0]);
  blob(b, [0, 0.008, 0.6], [0.112, 0.092, 0.15], 16, 10, (x, y, z) => [2, 0.4 + 0.6 * clamp$5(z * 0.5 + 0.5, 0, 1), 0, 0],
    (x, y, z) => { const f = Math.max(0, z); return [x * (1 - 0.35 * f * f), y * (1 - 0.3 * f * f) - 0.12 * f * f * (y < 0 ? 0.6 : 0.2), z]; });
  for (const sd of [1, -1]) {
    const limb = sd > 0 ? 3 : 4;
    plate(b, 12, 6, (u, v, r) => {
      const zle = 0.04 - 0.3 * Math.pow(u, 1.6), ch = 0.215 * (1 - Math.pow(u, 1.9)) + 0.016;
      r[0] = sd * (TU_FP[0] + 0.72 * u); r[1] = TU_FP[1] - 0.03 * u * u + 0.018 * (1 - u) * Math.sin(Math.PI * v); r[2] = TU_FP[2] + zle - ch * v;
      r[3] = 0; r[4] = 1; r[5] = 0; r[6] = (0.022 * Math.pow(1 - u, 1.2) + 0.003) * 2.6 * Math.pow(v, 0.5) * Math.pow(1 - v, 1.1) + 0.0015;
    }, (u, v) => [limb, u, v, 0, 0, 0, 0, 0]);
    const rl = sd > 0 ? 5 : 6;
    plate(b, 6, 4, (u, v, r) => {
      const dx = 0.55, dz = -0.83, cx = 0.83, cz = 0.55, L = 0.24 * u, ch = 0.15 * (1 - 0.55 * u * u);
      r[0] = sd * (TU_RP[0] + dx * L + cx * ch * (v - 0.5)); r[1] = TU_RP[1] - 0.01 * u + 0.01 * (1 - u) * Math.sin(Math.PI * v);
      r[2] = TU_RP[2] + dz * L + cz * ch * (v - 0.5) * 0.4;
      r[3] = 0; r[4] = 1; r[5] = 0; r[6] = (0.015 * (1 - u) + 0.002) * 2.6 * Math.pow(v, 0.5) * Math.pow(1 - v, 1.1) + 0.0012;
    }, (u, v) => [rl, u, v, 0, 0, 0, 0, 0]);
  }
  tube$1(b, [[0, -0.012, -0.44], [0, -0.022, -0.52], [0, -0.03, -0.58]], [0.035, 0.022, 0.004], 8, (t) => [7, t, 0, 0]);
  return b.build();
}

const TU_VDECL =  `
attribute vec4 aA;
attribute vec4 aB;
attribute vec4 aT0;
attribute vec4 aT1;
varying vec4 vRA;
varying vec3 vRObj;
varying float vRFade;
varying float vRBlink;
mat3 tuRot(float E, float P, float Q) {
  float cq = cos(Q), sq = sin(Q), ce = cos(E), se = sin(E), cp = cos(P), sp = sin(P);
  mat3 RQ = mat3(1.0, 0.0, 0.0, 0.0, cq, sq, 0.0, -sq, cq);
  mat3 RE = mat3(ce, se, 0.0, -se, ce, 0.0, 0.0, 0.0, 1.0);
  mat3 RP = mat3(cp, 0.0, sp, 0.0, 1.0, 0.0, -sp, 0.0, cp);
  return RP * RE * RQ;
}
mat3 tuLimb(float limb, out vec3 piv) {
  piv = vec3(0.0);
  mat3 R = mat3(1.0);
  if (limb > 2.5 && limb < 4.5) { piv = vec3(${gf$2(TU_FP[0])}, ${gf$2(TU_FP[1])}, ${gf$2(TU_FP[2])}); R = tuRot(aT0.x, aT0.y, aT0.z); }
  else if (limb > 4.5 && limb < 6.5) { piv = vec3(${gf$2(TU_RP[0])}, ${gf$2(TU_RP[1])}, ${gf$2(TU_RP[2])}); R = tuRot(aT1.x, aT1.y, 0.0); }
  if (limb > 3.5 && limb < 4.5 || limb > 5.5 && limb < 6.5) {
    piv.x = -piv.x;
    mat3 M = mat3(-1.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0);
    R = M * R * M;
  }
  return R;
}
`;
const TU_VNORMAL =  `
{
  vec3 pv;
  mat3 R = tuLimb(aA.x, pv);
  objectNormal = R * objectNormal;
  if (aA.x > 1.5 && aA.x < 2.5) {
    float yaw = aT0.w * smoothstep(0.0, 0.5, aA.y);
    float c = cos(yaw), s = sin(yaw);
    objectNormal = vec3(objectNormal.x * c + objectNormal.z * s, objectNormal.y, -objectNormal.x * s + objectNormal.z * c);
  }
}
`;
const TU_VDEFORM =  `
vRA = aA;
vRObj = position;
vRFade = aT1.w;
vRBlink = aT1.z;
{
  vec3 pv;
  mat3 R = tuLimb(aA.x, pv);
  if (aA.x > 2.5 && aA.x < 6.5) transformed = pv + R * (transformed - pv);
  if (aA.x > 1.5 && aA.x < 2.5) {
    float yaw = aT0.w * smoothstep(0.0, 0.5, aA.y);
    vec3 q = transformed - vec3(${gf$2(TU_NP[0])}, ${gf$2(TU_NP[1])}, ${gf$2(TU_NP[2])});
    float c = cos(yaw), s = sin(yaw);
    transformed = vec3(${gf$2(TU_NP[0])}, ${gf$2(TU_NP[1])}, ${gf$2(TU_NP[2])}) + vec3(q.x * c + q.z * s, q.y, -q.x * s + q.z * c);
  }
}
`;
const TU_FDECL =  `
varying vec4 vRA;
varying vec3 vRObj;
varying float vRFade;
varying float vRBlink;
vec4 tuScute(float u, float v) {
  float au = abs(u);
  float rimU = 0.86 + 0.03 * sin(v * 3.1416);
  if (au > rimU) {
    float k = v * 12.0 + 0.3 * rNoise(vec2(v * 20.0, u < 0.0 ? 1.0 : 4.0));
    float f = fract(k);
    return vec4(min(min(f, 1.0 - f) / 12.0 * 2.2, (au - rimU) * 0.45), 20.0 + floor(k) + (u < 0.0 ? 13.0 : 0.0), (au - rimU - 0.06) / 0.07, f - 0.5);
  }
  vec2 q = vec2(u * 0.9, v + 0.1 * au);
  q += (vec2(rNoise(q * 11.0), rNoise(q * 11.0 + 5.2)) - 0.5) * 0.035;
  float d1 = 9.0, d2 = 9.0, id = 0.0;
  vec2 w1 = vec2(0.0);
  for (int k = 0; k < 16; k++) {
    float fk = float(k);
    vec2 c = k == 0 ? vec2(0.0, 0.03) : k < 6 ? vec2(0.0, 0.12 + 0.19 * (fk - 1.0)) : vec2(k < 11 ? 0.44 : -0.44, 0.22 + 0.19 * (fk - (k < 11 ? 6.0 : 11.0)));
    c += (vec2(rHash(vec2(fk, 1.3)), rHash(vec2(fk, 7.1))) - 0.5) * vec2(0.04, 0.03);
    vec2 w = q - c;
    float d = length(w);
    if (d < d1) { d2 = d1; d1 = d; id = fk; w1 = w; } else if (d < d2) d2 = d;
  }
  return vec4(0.5 * (d2 - d1), id, w1 / 0.1);
}
`;
const TU_FCOLOR = R_FADE +  `
{
  float limb = vRA.x;
  vec3 P = vRObj;
  vec3 c;
  float rough = 0.55;
  if (limb < 0.5) {
    float u = vRA.y, v = vRA.z;
    vec4 sc = tuScute(u, v);
    float h = rHash(vec2(sc.y, 3.7));
    float ang = atan(sc.w, sc.z), rad = length(sc.zw);
    float streak = rNoise(vec2(ang * 4.0 + h * 20.0, rad * 2.2)) * uRDetail;
    c = mix(${gc$2(0x352518)}, ${gc$2(0x644a30)}, 0.2 + 0.45 * h + 0.3 * streak);
    c = mix(c, ${gc$2(0x7a6547)}, smoothstep(0.03, 0.0, sc.x) * 0.3);
    c *= 1.0 - 0.55 * rLine(sc.x, 0.006);
    c *= 1.0 - 0.1 * rLine(fract(rad * 3.5) - 0.5, 0.25) * rAA(rad * 3.5) * uRDetail;
    float wear = smoothstep(0.55, 0.85, rFbm(P.xz * 6.0 + 3.0));
    c = mix(c, c * 1.15 + 0.015, wear * 0.35);
    float alg = smoothstep(0.45, 0.75, rFbm(P.xz * 4.5 + vec2(1.7, 4.2)) + 0.22 * v - 0.08);
    c = mix(c, mix(${gc$2(0x3a4226)}, ${gc$2(0x51562f)}, rNoise(P.xz * 30.0)), alg * 0.65);
    float bar = 0.0;
    for (int k = 0; k < 5; k++) {
      float fk = float(k);
      vec2 bc = (k < 3 ? vec2(0.35, 0.72) : vec2(-0.22, 0.48)) + (vec2(rHash(vec2(fk, 2.2)), rHash(vec2(fk, 9.4))) - 0.5) * vec2(0.14, 0.1);
      float br = 0.022 + 0.018 * rHash(vec2(fk, 5.5));
      float d = length(vec2(u - bc.x, (v - bc.y) * 1.6)) / br;
      bar = max(bar, (1.0 - smoothstep(0.8, 1.0, d)) * (0.55 + 0.45 * smoothstep(0.2, 0.5, d)));
    }
    c = mix(c, ${gc$2(0xc9c0aa)}, bar * 0.8);
    rough = mix(0.8, 0.92, max(alg, bar));
  } else if (limb < 1.5) {
    c = ${gc$2(0xc9b68a)};
    c *= 1.0 - 0.25 * rLine(fract(vRA.z * 6.0) - 0.5, 0.05) * rAA(vRA.z * 6.0);
    c *= 1.0 - 0.25 * rLine(vRA.y, 0.03);
    rough = 0.75;
  } else {
    bool head = limb > 1.5 && limb < 2.5;
    bool flip = limb > 2.5 && limb < 6.5;
    vec2 sp = head ? vec2(P.x * 30.0 + P.y * 13.0, P.z * 30.0 - P.y * 19.0) : flip ? vec2(vRA.y * 9.0, vRA.z * (3.0 + 3.0 * vRA.z)) : vec2(P.x + P.y * 0.7, P.z - P.y * 0.4) * 34.0;
    sp += (vec2(rNoise(sp * 0.7), rNoise(sp * 0.7 + 3.1)) - 0.5) * 0.8;
    vec3 ce = rCells(sp);
    float cen = 1.0 - smoothstep(0.05, 0.45, ce.x);
    c = mix(${gc$2(0x735a3c)}, ${gc$2(0x33261a)}, (0.3 + 0.6 * cen) * (0.55 + 0.45 * ce.z) * mix(0.5, 1.0, uRDetail));
    c = mix(c, ${gc$2(0xa8967a)}, (1.0 - smoothstep(0.0, 0.08, ce.y)) * 0.45 * uRDetail);
    c = mix(c, ${gc$2(0xc9b896)}, (1.0 - smoothstep(-0.06, 0.0, P.y - (head ? -0.02 : -0.035))) * 0.6);
    if (flip) c = mix(c, ${gc$2(0xc8b894)}, smoothstep(0.72, 0.95, vRA.z) * 0.7);
    rough = 0.72;
    if (head) {
      float beak = smoothstep(0.68, 0.73, P.z) * (1.0 - smoothstep(-0.01, 0.03, P.y));
      c = mix(c, ${gc$2(0x6a5a3e)}, beak);
      vec2 eq = vec2((P.z - 0.665) / 0.022, (P.y - 0.03) / 0.017);
      float er = length(eq) * step(0.05, abs(P.x));
      float lid = step(eq.y, mix(1.2, -1.2, vRBlink));
      float eye = 1.0 - smoothstep(0.8, 1.0, er);
      c = mix(c, mix(${gc$2(0x7a5f36)}, vec3(0.015), smoothstep(0.55, 0.3, er) * lid), eye);
      rough = mix(rough, 0.12, eye * lid);
    }
  }
  diffuseColor.rgb = c;
  rRough = rough;
}
`;

const SF_PROF = keyed([[0, 0.004, 0.003], [0.05, 0.045, 0.03], [0.15, 0.085, 0.052], [0.3, 0.1, 0.058], [0.5, 0.085, 0.046], [0.68, 0.05, 0.028], [0.8, 0.025, 0.014], [0.84, 0.02, 0.01]]);
function buildSmallFish() {
  const b = new Geo$1(), o = [0, 0];
  const NS = 16, NR = 10, base = b.n;
  for (let j = 0; j <= NS; j++) {
    const s = (j / NS) * 0.84;
    SF_PROF(s, o);
    for (let i = 0; i <= NR; i++) {
      const th = (i / NR) * TAU$4, st = Math.sin(th);
      b.v(Math.cos(th) * o[1], st * o[0], 0.5 - s, s, st, 0, 0);
    }
  }
  b.rows(base, NR, NS, false);
  plate(b, 4, 3, (u, v, r) => {
    const s = 0.8 + 0.2 * u, y = (v - 0.5) * (0.04 + 0.2 * u) * (1 - 0.55 * Math.pow(1 - Math.abs(v - 0.5) * 2, 2) * u);
    r[0] = 0; r[1] = y; r[2] = 0.5 - s + 0.06 * u * (1 - Math.abs(v - 0.5) * 2); r[3] = 1; r[4] = 0; r[5] = 0; r[6] = 0.002;
  }, (u, v) => [0.8 + 0.2 * u, v * 2 - 1, 1, u, 0, 0, 0, 0]);
  plate(b, 3, 2, (u, v, r) => {
    const s = lerp$2(0.3, 0.6, v);
    SF_PROF(s, o);
    r[0] = 0; r[1] = o[0] * 0.95 + 0.04 * u * (1 - v * 0.7); r[2] = 0.5 - s - 0.05 * u; r[3] = 1; r[4] = 0; r[5] = 0; r[6] = 0.0015;
  }, (u, v) => [lerp$2(0.3, 0.6, v), 1, 1, u, 0, 0, 0, 0]);
  return b.build();
}
const SF_VDECL =  `
attribute vec4 aA;
attribute vec4 aB;
attribute vec4 aF;
varying vec4 vRA;
varying vec3 vRObj;
varying float vRFade;
varying float vRLiv;
`;
const SF_VDEFORM =  `
vRA = aA;
vRObj = position;
vRFade = aF.w;
vRLiv = aF.z;
{
  float s = clamp(0.5 - position.z, 0.0, 1.0);
  transformed.x += aF.y * (s * s - 0.08 * (1.0 - s)) * sin(aF.x - 6.0 * s);
}
`;
const SF_FDECL =  `
varying vec4 vRA;
varying vec3 vRObj;
varying float vRFade;
varying float vRLiv;
`;
const SF_FCOLOR = R_FADE +  `
{
  float s = vRA.x, fv = vRA.y;
  vec3 c;
  if (vRLiv < 0.5) {
    c = mix(${gc$2(0xaec4d9)}, ${gc$2(0x5f7fa3)}, smoothstep(-0.3, 0.8, fv));
    float bar = smoothstep(0.38, 0.12, abs(fract((s - 0.14) * 9.0) - 0.5)) * smoothstep(0.1, 0.16, s) * (1.0 - smoothstep(0.74, 0.8, s));
    c = mix(c, ${gc$2(0x243750)}, bar * 0.7 * (vRA.z < 0.5 ? 1.0 : 0.0));
    if (vRA.z > 0.5) c = mix(${gc$2(0x2d3642)}, ${gc$2(0xe8eef2)}, smoothstep(0.75, 0.95, vRA.w) * step(0.4, abs(fv)));
    rMet = 0.35;
    rRough = 0.35;
  } else {
    c = mix(${gc$2(0xdfe6e8)}, ${gc$2(0x7d8d72)}, smoothstep(0.35, 0.8, fv));
    c = mix(c, c * 0.4, (1.0 - smoothstep(0.02, 0.035, length(vec2(s - 0.2, fv * 0.08 - 0.03)))));
    if (vRA.z > 0.5) c = ${gc$2(0xa9b3ae)};
    rMet = 0.75;
    rRough = 0.22;
  }
  diffuseColor.rgb = c;
}
`;

function buildBell(b, NR, NA, height, lappets, lapDepth) {
  const yTop = (rn) => height * (1 - Math.pow(rn, 2.1)) - 0.06 * Math.pow(sstep$4(0.75, 1, rn), 1.4);
  const yBot = (rn) => height * 0.45 * (1 - rn * rn) - 0.06 * Math.pow(sstep$4(0.75, 1, rn), 1.4) - 0.004;
  for (let face = 0; face < 2; face++) {
    const base = b.n;
    for (let j = 0; j <= NR; j++) {
      const rn = j / NR;
      for (let i = 0; i <= NA; i++) {
        const an = (i / NA) * TAU$4;
        const lap = 1 - lapDepth * sstep$4(0.85, 1, rn) * (0.5 + 0.5 * Math.cos(an * lappets));
        const r = 0.5 * rn * lap;
        b.v(Math.cos(an) * r, face === 0 ? yTop(rn) : yBot(rn), Math.sin(an) * r, rn, face, 0, i / NA);
      }
    }
    b.rows(base, NA, NR, face === 1);
  }
  return yBot;
}
function buildPelagia() {
  const b = new Geo$1();
  buildBell(b, 8, 24, 0.56, 16, 0.08);
  for (let k = 0; k < 8; k++) {
    const an = ((k + 0.5) / 8) * TAU$4, pts = [], rad = [];
    const L = 4 + 2 * grand(), ph = grand() * TAU$4, sw = 0.25 + 0.35 * grand(), dir = grand() < 0.5 ? -1 : 1, coil = 3.5 + 3 * grand();
    for (let i = 0; i <= 12; i++) {
      const t = i / 12, r0 = 0.46 * (1 - 0.12 * t);
      const cx = Math.cos(an) * r0 + sw * t * t * Math.cos(ph) + 0.14 * t * Math.sin(ph + dir * t * coil);
      const cz = Math.sin(an) * r0 + sw * t * t * Math.sin(ph) + 0.14 * t * Math.cos(ph + dir * t * coil);
      pts.push([cx, -0.04 - L * t, cz]);
      rad.push(0.008 * (1 - 0.6 * t) + 0.002);
    }
    tube$1(b, pts, rad, 3, (t) => [1, 2, t, k / 8, 0, 0, 0, 0]);
  }
  for (let k = 0; k < 4; k++) {
    const an = (k / 4) * TAU$4 + 0.4, pts = [], L = 2.6 + 0.8 * grand(), ph = grand() * TAU$4, sw = 0.15 + 0.2 * grand();
    for (let i = 0; i <= 16; i++) {
      const t = i / 16, r = 0.09 * (1 + 2.2 * t);
      pts.push([Math.cos(an) * r + sw * t * t * Math.cos(ph), -0.03 - L * t, Math.sin(an) * r + sw * t * t * Math.sin(ph)]);
    }
    const ruff = (t, a) => {
      const edge = Math.pow(Math.abs(Math.cos(a * TAU$4)), 3);
      return (0.055 * (1 - 0.55 * t) + 0.008) * (1 + edge * (0.4 * Math.sin(t * 46 + k * 1.3) + 0.22 * Math.sin(t * 97 + k * 2.1)));
    };
    tube$1(b, pts, ruff, 8, (t) => [0.2, 3, t, k / 4, 0, 0, 0, 0], 0.35);
  }
  return b.build();
}
function buildRhizostoma() {
  const b = new Geo$1();
  const yBot = buildBell(b, 14, 48, 0.48, 80, 0.035);
  const y0 = yBot(0) - 0.02, Y1 = y0 - 0.4;
  const col = [];
  for (let i = 0; i <= 20; i++) col.push([0, lerp$2(y0, Y1, i / 20), 0]);
  const colR = (t, a) => {
    const base = 0.13 + 0.1 * sstep$4(0.02, 0.22, t) * (1 - sstep$4(0.45, 0.9, t)) - 0.02 * sstep$4(0.75, 1, t);
    const crown = sstep$4(0.08, 0.2, t) * (1 - sstep$4(0.5, 0.72, t));
    const frill = 0.45 * Math.sin(a * TAU$4 * 28 + 2.5 * Math.sin(t * 26 + a * TAU$4 * 3)) + 0.3 * Math.sin(a * TAU$4 * 13 - t * 37) + 0.25 * Math.sin(a * TAU$4 * 44 + t * 71);
    return base * (1 + (0.13 * crown + 0.05) * frill);
  };
  tube$1(b, col, colR, 48, (t) => [0.15, 3, t * 0.36, 0, 0, 0, 0, 0]);
  for (let k = 0; k < 8; k++) {
    const an = (k / 8) * TAU$4 + 0.2, ca = Math.cos(an), sa = Math.sin(an), pts = [];
    for (let i = 0; i <= 12; i++) {
      const t = i / 12, sp = 0.08 + 0.12 * sstep$4(0, 0.8, t);
      pts.push([ca * sp, Y1 + 0.05 - 0.48 * t, sa * sp]);
    }
    const armR = (t, a) => {
      const wing = Math.pow(Math.abs(Math.cos(a * TAU$4 * 1.5)), 3);
      const frill = 0.35 * Math.sin(t * 64 + k * 1.7 + a * TAU$4 * 3) + 0.2 * Math.sin(t * 131 + k + a * TAU$4 * 5) + 0.12 * Math.sin(t * 211 - a * TAU$4 * 7);
      return (0.058 - 0.022 * t) * (1 + wing * (0.75 + frill * (1 - 0.5 * t)) + 0.08 * frill);
    };
    tube$1(b, pts, armR, 12, (t) => [0.15, 3, 0.36 + t * 0.34, k / 8, 0, 0, 0, 0]);
    const e = pts[pts.length - 1], cp = [], cr = [];
    for (let i = 0; i <= 12; i++) {
      const t = i / 12, end = t > 0.84 ? Math.sqrt(Math.max(0, 1 - Math.pow((t - 0.84) / 0.16, 2))) : 1;
      cp.push([e[0] + ca * 0.03 * t, e[1] + 0.02 - 0.5 * t, e[2] + sa * 0.03 * t]);
      cr.push(Math.max(0.002, (0.024 + 0.02 * Math.sin(Math.PI * Math.min(1, Math.pow(t, 0.8) * 1.15))) * end));
    }
    tube$1(b, cp, cr, 8, (t) => [0.15, 4, 0.7 + t * 0.3, k / 8, 0, 0, 0, 0]);
  }
  return b.build();
}

const R_WATER =  `
uniform vec4 uRScene;
uniform float uRLight;
vec3 rWaterBehind(vec3 vp) {
  vec3 vw = normalize((vec4(vp, 0.0) * viewMatrix).xyz);
  float d = length(vp);
  vec3 s = mix(vec3(0.0, 0.05, 0.15), vec3(0.02, 0.31, 0.52), smoothstep(-0.55, 0.95, vw.y)) * exp(-max(0.0, -cameraPosition.y) * 0.016) * uRLight;
  vec3 bg = s;
  if (vw.y < -0.03) {
    float bd = clamp((cameraPosition.y - uRScene.x) / -vw.y, d + 0.3, 80.0);
    vec3 sea = uRScene.yzw * uRLight * exp(-vec3(0.2, 0.046, 0.034) * bd) + s * (1.0 - exp(-0.024 * bd));
    bg = mix(s, sea, 1.0 - smoothstep(-0.12, -0.03, vw.y));
  }
  return max((bg - s * (1.0 - exp(-0.024 * d))) / exp(-vec3(0.2, 0.046, 0.034) * d), 0.0);
}
`;
const JE_VDECL =  `
attribute vec4 aA;
attribute vec4 aB;
attribute vec4 aJ;
uniform float uRTime;
uniform float uRFpx;
varying vec4 vRA;
varying vec3 vRObj;
varying float vRPulse;
varying float vRFade;
varying float vRWY;
varying float vRCov;
float rPulse(float t) { float p = fract(t); return smoothstep(0.0, 0.2, p) * (1.0 - smoothstep(0.2, 1.0, p)); }
`;
const JE_VDEFORM = (k, armA, tentA) =>  `
vRA = aA;
vRObj = position;
vRFade = aJ.w;
{
  float c = rPulse(uRTime / aJ.y + aJ.x);
  vRPulse = c;
  float rn = aA.x;
  if (aA.y < 1.5) {
    transformed.xz *= 1.0 - ${gf$2(k)} * c * rn;
    transformed.y += 0.03 * c * (1.0 - rn) - 0.06 * c * rn * rn;
  } else {
    float t = aA.z, c2 = rPulse(uRTime / aJ.y + aJ.x - 0.08 - 0.12 * t);
    transformed.xz *= 1.0 - ${gf$2(k * 0.7)} * c2 * (1.0 - 0.5 * t);
    transformed.y += 0.03 * c2 * (1.0 - t) + 0.05 * t * c2;
    float sw = t * t;
    float amp = aA.y > 2.5 ? ${gf$2(armA)} : ${gf$2(tentA)};
    float aw = aA.w * smoothstep(0.3, 0.6, t);
    transformed.x += sw * amp * (sin(uRTime * 0.7 + aJ.z * 9.0 + aw * 6.2832 + t * 2.5) + 0.5 * sin(uRTime * 1.6 + aw * 17.0 - t * 7.0));
    transformed.z += sw * amp * (cos(uRTime * 0.6 + aJ.z * 7.0 + aw * 5.1 + t * 2.1) + 0.5 * cos(uRTime * 1.3 + aw * 11.0 - t * 6.0));
  }
}
vRCov = 1.0;
if (aA.y > 1.5 && aA.y < 2.5) {
  float r0 = ${gf$2(0.008)} * (1.0 - 0.6 * aA.z) + ${gf$2(0.002)};
#ifdef USE_INSTANCING
  float sc = length(instanceMatrix[0].xyz);
  vec4 q = modelViewMatrix * instanceMatrix * vec4(transformed, 1.0);
#else
  float sc = 1.0;
  vec4 q = modelViewMatrix * vec4(transformed, 1.0);
#endif
  float px = r0 * sc * uRFpx / max(-q.z, 0.05);
  float grow = max(1.0, 0.65 / max(px, 1e-4));
  transformed += objectNormal * r0 * (grow - 1.0);
  vRCov = 1.0 / grow;
}
#ifdef USE_INSTANCING
vRWY = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).y;
#else
vRWY = (modelMatrix * vec4(transformed, 1.0)).y;
#endif
`;
const JE_FDECL =  `
varying vec4 vRA;
varying vec3 vRObj;
varying float vRPulse;
varying float vRFade;
varying float vRWY;
varying float vRCov;
`;
const JE_CULL =  `
if (!gl_FrontFacing && vRA.y > 1.5) discard;
`;
const PE_FCOLOR = JE_CULL +  `
float jA = 1.0;
vec3 jC;
{
  float part = vRA.y, rn = vRA.x;
  float ndv = abs(dot(normalize(vNormal), normalize(vViewPosition)));
  float fr = (1.0 - ndv) * (1.0 - ndv);
  if (part < 1.5) {
    vec3 ce = rCells(vec2(vRA.w * 26.0, rn * 7.5));
    float wart = (1.0 - smoothstep(0.04 + 0.14 * ce.z, 0.12 + 0.2 * ce.z, ce.x)) * (0.35 + 0.65 * fract(ce.z * 7.3)) * rAA(rn * 7.5);
    jC = mix(${gc$2(0xe39ac8)}, ${gc$2(0x9c3f86)}, wart * 0.8 + 0.15 * rn);
    jA = (0.3 + 0.28 * fr + 0.3 * wart) * (1.0 - 0.35 * smoothstep(0.9, 1.0, rn));
    if (part > 0.5) jA *= 0.6;
  } else if (part < 2.5) {
    jC = ${gc$2(0xd98cc0)};
    jA = 0.3 * (1.0 - 0.55 * vRA.z) * vRCov;
  } else {
    float ed = rNoise(vec2(vRA.z * 38.0, vRA.w * 7.0 + vRObj.y * 3.0));
    jC = mix(${gc$2(0xf6bde0)}, ${gc$2(0xcc76b3)}, 0.2 + 0.6 * ed);
    jA = 0.36 + 0.16 * ed + 0.18 * fr;
  }
  jA *= 1.0 - smoothstep(3.5, 9.0, length(vViewPosition)) * (part > 1.5 ? 0.8 : 0.35);
  jA *= (0.9 + 0.2 * vRPulse) * vRFade;
  if (jA < 0.004) discard;
  rRough = 0.62;
}
diffuseColor.rgb = jC * jA * 0.8;
`;
const RH_FCOLOR = JE_CULL +  `
float jA = 1.0;
vec3 jC;
{
  float part = vRA.y, rn = vRA.x;
  vec3 P = vRObj;
  float ndv = abs(dot(normalize(vNormal), normalize(vViewPosition)));
  float fr = pow(1.0 - ndv, 2.2);
  if (part < 1.5) {
    float ang = vRA.w * 6.2832;
    jC = mix(${gc$2(0xf1f4f8)}, ${gc$2(0xd9e2ee)}, rNoise(vec2(ang * 6.0, rn * 7.0)));
    float canal = rLine(fract(vRA.w * 16.0) - 0.5, 0.06) * smoothstep(0.25, 0.6, rn) * (1.0 - smoothstep(0.85, 0.95, rn)) * rAA(vRA.w * 16.0);
    float rim = smoothstep(0.945, 0.985, rn);
    float lap = (0.5 + 0.5 * cos(ang * 80.0)) * rAA(ang * 12.7);
    if (part < 0.5) {
      jC = mix(jC, mix(${gc$2(0x4b3f9c)}, ${gc$2(0x251f66)}, lap * 0.6 + 0.4 * smoothstep(0.975, 1.0, rn)), rim * 0.8);
      jA = 0.1 + 0.5 * fr + 0.1 * smoothstep(0.45, 0.9, rn) + 0.05 * canal + 0.3 * rim;
      if (!gl_FrontFacing) jA *= 0.45;
    } else {
      jA = 0.03 + 0.08 * fr;
    }
    rRough = 0.92;
  } else {
    float n2 = rFbm(vec2(vRA.w * 13.0 + P.x * 6.0, vRA.z * 24.0 + P.z * 6.0));
    if (part > 3.5) {
      jC = mix(${gc$2(0xf6f5f1)}, ${gc$2(0xe2e4e2)}, n2);
      jA = 0.26 + 0.34 * fr;
    } else {
      jC = mix(${gc$2(0xf1e9d8)}, ${gc$2(0xcdbd9e)}, n2);
      jA = 0.3 + 0.2 * n2 + 0.3 * fr;
    }
    rRough = 0.8;
  }
  jA *= (0.92 + 0.12 * vRPulse) * vRFade;
  if (jA < 0.004) discard;
}
diffuseColor.rgb = jC * jA * 0.9;
`;
const JE_EMISSIVE =  `
{
  vec3 jAtt = exp(-vec3(0.105, 0.036, 0.021) * max(0.0, -vRWY));
  vec3 jVp = -vViewPosition;
#if NUM_DIR_LIGHTS > 0
  vec3 jL = directionalLights[0].direction;
  float jF = max(0.0, dot(normalize(jVp), jL));
  float jFw = pow(jF, 6.0);
  float jTr = max(0.0, -dot(normal, jL));
  totalEmissiveRadiance += jC * directionalLights[0].color * jAtt * (0.1 + 0.1 * jTr + 0.2 * jFw + 0.12 * jF * jF) * jA;
#endif
  totalEmissiveRadiance += rWaterBehind(jVp) * jC * jA * 0.5;
  diffuseColor.a = jA;
}
`;
const JF_VERT =  `
#include <common>
` + JE_VDECL +  `
varying vec3 vRVp;
void main() {
  #include <beginnormal_vertex>
  #include <begin_vertex>
` + '%DEFORM%' +  `
  #include <project_vertex>
  vRVp = mvPosition.xyz;
  float zb = mvPosition.z - 6.0;
  gl_Position.z = (projectionMatrix[2][2] * zb + projectionMatrix[3][2]) / -zb * gl_Position.w;
}
`;
const JF_FRAG =  `
varying vec3 vRVp;
varying vec4 vRA;
varying float vRFade;
varying float vRCov;
` + R_WATER +  `
void main() {
  if (!gl_FrontFacing && vRA.y > 1.5) discard;
  float up = smoothstep(0.1, 0.3, normalize((vec4(vRVp, 0.0) * viewMatrix).xyz).y);
  float a = (1.0 - up) * vRFade * vRFade * min(vRCov, 1.0);
  if (a < 0.004) discard;
  gl_FragColor = vec4(rWaterBehind(vRVp), a);
}
`;
function jellyFill(key, k, uniforms, armA, tentA) {
  const m = new THREE.ShaderMaterial({
    uniforms, vertexShader: JF_VERT.replace('%DEFORM%', JE_VDEFORM(k, armA, tentA)), fragmentShader: JF_FRAG,
    side: THREE.DoubleSide, transparent: true, depthWrite: false, depthFunc: THREE.LessEqualDepth,
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
  });
  m.customProgramCacheKey = () => 'rare-behind-' + key;
  return m;
}
function jellyMaterial(key, id, k, fcolor, uniforms, patch, armA = 0.25, tentA = 0.7) {
  const m = new THREE.MeshStandardMaterial({
    color: 0xffffff, roughness: 0.32, metalness: 0, side: THREE.DoubleSide, transparent: true, depthWrite: true,
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation,
    blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
  });
  m.forceSinglePass = true;
  m.defines = Object.assign({}, m.defines, { RARE_SPECIES: id });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\n' + JE_VDECL)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n' + JE_VDEFORM(k, armA, tentA));
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + R_FCOMMON + JE_FDECL + R_WATER)
      .replace('#include <color_fragment>', '#include <color_fragment>\nfloat rRough = roughness;\n' + fcolor)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = rRough;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n' + JE_EMISSIVE);
  };
  const mm = (patch && patch(m)) || m;
  const base = mm.customProgramCacheKey;
  mm.customProgramCacheKey = function () { return 'rare-' + key + '|' + base.call(this); };
  return mm;
}

const CP_HS = 4.2;
const CP_VERT =  `
uniform float uTime;
uniform vec3 uCam;
uniform float uFpx;
uniform float uUnder;
uniform float uWaterY;
uniform float uLight;
uniform sampler2D uCaustics;
uniform float uCausticTile;
uniform vec3 uSunW;
attribute vec4 aSeed;
varying float vA;
varying vec3 vCol;
varying float vKind;
varying float vSeed;
varying float vSoft;
vec3 cpH3(float n) { return fract(sin(vec3(n, n + 1.7, n + 3.1) * vec3(43758.5453, 22578.145, 19642.349))) * 2.0 - 1.0; }
void main() {
  float s = aSeed.x, snow = aSeed.w;
  vec3 p;
  if (snow > 0.5) {
    p = position + vec3(sin(uTime * 0.23 + s * 40.0), 0.0, cos(uTime * 0.19 + s * 31.0)) * (0.05 + 0.08 * fract(s * 3.7))
      + vec3(0.0, -uTime * (0.006 + 0.01 * fract(s * 5.3)), 0.0);
  } else {
    float per = 1.2 + 2.2 * aSeed.y;
    float k = uTime / per + s * 7.0, cyc = floor(k), f = fract(k) * per;
    vec3 hop = mix(cpH3(cyc + s * 91.0), cpH3(cyc + 1.0 + s * 91.0), smoothstep(0.0, 0.06, f)) * vec3(0.02, 0.012, 0.02);
    p = position + hop + vec3(0.0, -uTime * 0.002, 0.0);
  }
  vec3 rel = mod(p - uCam + ${gf$2(CP_HS)}, ${gf$2(2 * CP_HS)}) - ${gf$2(CP_HS)};
  p = uCam + rel;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float d = max(-mv.z, 0.01);
  gl_Position = projectionMatrix * mv;
  float own = aSeed.z * 0.001 * uFpx / d;
  float coc = uFpx * 0.01 * abs(1.0 / d - 1.0 / 2.6);
  float px = max(max(own, coc * snow), 1.6);
  gl_PointSize = px + 1.0;
  vSoft = snow * smoothstep(1.5, 6.0, coc - own);
  float depth = max(uWaterY - p.y, 0.0);
  vec2 e = p.xz + uSunW.xz * (depth / max(uSunW.y, 0.2));
  float pat = textureLod(uCaustics, e / (uCausticTile * 4.2), 4.0).g;
  float shaft = smoothstep(0.16, 0.42, pat);
  vec3 tint = exp(-vec3(0.105, 0.036, 0.021) * depth);
  float tw = (1.0 - snow) * pow(max(0.0, sin(uTime * (1.1 + 2.0 * aSeed.y) + s * 61.0)), 16.0);
  vCol = mix(vec3(0.95, 0.9, 0.78), vec3(1.25, 1.22, 1.08), snow) * (tint * (0.45 + 2.4 * shaft * (1.0 + 2.5 * tw)) + vec3(0.04, 0.1, 0.12)) * uLight;
  float edge = max(abs(rel.x), max(abs(rel.y), abs(rel.z)));
#ifdef CP_SOLID
  vec3 vw = normalize(p - cameraPosition);
  vec3 wc = mix(vec3(0.0, 0.05, 0.15), vec3(0.02, 0.31, 0.52), smoothstep(-0.55, 0.95, vw.y)) * exp(-max(0.0, -cameraPosition.y) * 0.016) * uLight;
  vCol = wc * 1.3 + vec3(0.95, 0.93, 0.85) * tint * (0.12 + 1.1 * shaft) * uLight;
  gl_PointSize = min(px, 9.0) + 0.5;
  vA = smoothstep(0.45, 0.8, d) * (1.0 - smoothstep(${gf$2(CP_HS * 0.7)}, ${gf$2(CP_HS)}, edge)) * step(p.y, uWaterY - 0.3) * uUnder;
  vKind = 1.0;
  vSeed = s;
  vSoft = 0.0;
  return;
#endif
  float energy = (own * own + 0.5) * mix(1.0, 1.6, snow);
  float peak = min(energy / (px * px), 1.0);
  peak = mix(peak, 0.1, vSoft);
  vA = mix(0.55, 0.85, snow) * peak * smoothstep(0.2, 0.5, d) * (1.0 - smoothstep(${gf$2(CP_HS * 0.7)}, ${gf$2(CP_HS)}, edge))
     * mix(0.55 + 0.45 * shaft, 1.0, 1.0 - snow) * step(p.y, uWaterY - 0.3) * uUnder;
  vKind = snow;
  vSeed = s;
}
`;
const CP_FRAG =  `
varying float vA;
varying vec3 vCol;
varying float vKind;
varying float vSeed;
varying float vSoft;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float r = length(c) * 2.0;
  float a;
  if (vKind > 0.5) {
    float ang = atan(c.y, c.x);
    float rag = 0.7 + 0.15 * sin(ang * 3.0 + vSeed * 20.0) + 0.1 * sin(ang * 7.0 - vSeed * 11.0);
    a = (1.0 - smoothstep(rag - 0.35, rag, r)) * (0.75 + 0.25 * sin(c.x * 23.0 + vSeed * 9.0) * sin(c.y * 19.0));
    a = mix(a * 1.3, 1.0 - smoothstep(0.75, 1.0, r), vSoft);
  } else {
    a = exp(-r * r * 3.5);
  }
  a *= vA;
  if (a < 0.003) discard;
  gl_FragColor = vec4(vCol, a);
}
`;
const CP_SOLID_FRAG =  `
varying float vA;
varying vec3 vCol;
varying float vSeed;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float r = length(c) * 2.0;
  float ang = atan(c.y, c.x);
  float rag = 0.72 + 0.16 * sin(ang * 3.0 + vSeed * 20.0) + 0.1 * sin(ang * 7.0 - vSeed * 11.0);
  if (r > rag) discard;
  if (vA < 0.999 && fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715)))) > vA) discard;
  gl_FragColor = vec4(vCol * (0.9 + 0.2 * (1.0 - r / rag)), 1.0);
}
`;
function makeCopepods(root, n, snowShare = 0.35) {
  const pos = new Float32Array(n * 3), seed = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < 3; k++) pos[i * 3 + k] = (grand() - 0.5) * 2 * CP_HS;
    const snow = grand() < snowShare ? 1 : 0;
    seed[i * 4] = grand(); seed[i * 4 + 1] = grand();
    seed[i * 4 + 2] = snow ? 3 + 5 * Math.pow(grand(), 1.6) : 1 + grand() * 1.2;
    seed[i * 4 + 3] = snow;
  }
  const u = { uCam: { value: new THREE.Vector3() }, uFpx: { value: 600 }, uUnder: { value: 0 } };
  const uni = () => Object.assign({
    uTime: U.uTime, uLight: U.uLight, uWaterY: U.uWaterY, uCaustics: U.uCaustics,
    uCausticTile: U.uCausticTile, uSunW: U.uSunW,
  }, u);
  const setPx = (renderer, sc, cam) => {
    const rt = renderer.getRenderTarget();
    u.uFpx.value = cam.projectionMatrix.elements[5] * 0.5 * (rt ? rt.height : renderer.domElement.height);
  };
  const out = { u, geos: [], mats: [] };
  for (const solid of [false, true]) {
    const idx = [];
    for (let i = 0; i < n; i++) if ((seed[i * 4 + 3] > 0.5) === solid) idx.push(i);
    const P = new Float32Array(idx.length * 3), S = new Float32Array(idx.length * 4);
    idx.forEach((i, j) => { P.set(pos.subarray(i * 3, i * 3 + 3), j * 3); S.set(seed.subarray(i * 4, i * 4 + 4), j * 4); });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(P, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(S, 4));
    const mat = solid
      ? new THREE.ShaderMaterial({ uniforms: uni(), defines: { CP_SOLID: 1 }, vertexShader: CP_VERT, fragmentShader: CP_SOLID_FRAG })
      : new THREE.ShaderMaterial({ uniforms: uni(), vertexShader: CP_VERT, fragmentShader: CP_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    const pts = new THREE.Points(g, mat);
    pts.name = solid ? 'rare-snow' : 'rare-copepods';
    pts.frustumCulled = false;
    pts.renderOrder = 5;
    pts.onBeforeRender = setPx;
    root.add(pts);
    out.geos.push(g); out.mats.push(mat);
    out[solid ? 'snow' : 'pts'] = pts;
  }
  return out;
}

const BL_VERT =  `
uniform float uFpx;
uniform float uWaterY;
uniform float uLight;
uniform sampler2D uCaustics;
uniform float uCausticTile;
uniform vec3 uSunW;
uniform vec3 uSand;
attribute vec4 aB;
varying float vA;
varying vec3 vCol;
varying float vSeed;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  float d = max(-mv.z, 0.05);
  gl_Position = projectionMatrix * mv;
  float age = aB.x, haze = aB.w;
  float grow = 1.0 + (1.2 + 1.3 * haze) * sqrt(age);
  float px = aB.y * grow * uFpx / d;
  gl_PointSize = age < 1.0 ? clamp(px, 1.0, 160.0) : 0.0;
  float depth = max(uWaterY - position.y, 0.0);
  vec2 e = position.xz + uSunW.xz * (depth / max(uSunW.y, 0.2));
  float cst = min(textureLod(uCaustics, e / uCausticTile, clamp(0.35 + depth * 0.05, 0.35, 1.6)).g, 3.0) * exp(-depth * 0.011);
  vec3 sd = mix(uSand, vec3(dot(uSand, vec3(0.3, 0.5, 0.2))), 0.2);
  vCol = sd * (0.62 + 0.3 * cst) * mix(vec3(1.0), exp(-vec3(0.11, 0.033, 0.026) * depth), 0.15) * uLight;
  float fin = smoothstep(0.0, 0.05, age), fout = 1.0 - smoothstep(mix(0.45, 0.3, haze), 1.0, age);
  vA = fin * fout * mix(0.5, 0.13, haze) / grow * min(1.0, px * px / 6.0) * smoothstep(0.1, 0.4, d);
  vSeed = aB.z;
}
`;
const BL_FRAG =  `
varying float vA;
varying vec3 vCol;
varying float vSeed;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float r2 = dot(c, c);
  if (r2 > 0.25) discard;
  float lump = 0.8 + 0.2 * sin(atan(c.y, c.x) * 3.0 + vSeed * 40.0);
  float a = exp(-r2 * 14.0 / lump) * vA;
  if (a < 0.003) discard;
  gl_FragColor = vec4(vCol, a);
}
`;
function makeBillow(root, n) {
  const pos = new Float32Array(n * 3), ab = new Float32Array(n * 4);
  const vel = new Float32Array(n * 3), life = new Float32Array(n), gnd = new Float32Array(n);
  for (let i = 0; i < n; i++) { pos[i * 3 + 1] = -500; ab[i * 4] = 1; }
  const g = new THREE.BufferGeometry();
  const aP = new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage);
  const aB = new THREE.BufferAttribute(ab, 4).setUsage(THREE.DynamicDrawUsage);
  g.setAttribute('position', aP);
  g.setAttribute('aB', aB);
  const u = { uFpx: { value: 600 }, uSand: { value: new THREE.Vector3(0.6, 0.55, 0.45) } };
  const mat = new THREE.ShaderMaterial({
    uniforms: Object.assign({ uLight: U.uLight, uWaterY: U.uWaterY, uCaustics: U.uCaustics, uCausticTile: U.uCausticTile, uSunW: U.uSunW }, u),
    vertexShader: BL_VERT, fragmentShader: BL_FRAG, transparent: true, depthWrite: false,
  });
  const pts = new THREE.Points(g, mat);
  pts.name = 'rare-billow';
  pts.frustumCulled = false;
  pts.renderOrder = 6;
  pts.visible = false;
  pts.onBeforeRender = (renderer, sc, cam) => {
    const rt = renderer.getRenderTarget();
    u.uFpx.value = cam.projectionMatrix.elements[5] * 0.5 * (rt ? rt.height : renderer.domElement.height);
  };
  root.add(pts);
  let head = 0;
  const put = (x, y, z, vx, vy, vz, lf, size, haze, ground) => {
    const i = head;
    head = (head + 1) % n;
    pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
    vel[i * 3] = vx; vel[i * 3 + 1] = vy; vel[i * 3 + 2] = vz;
    life[i] = lf; gnd[i] = ground;
    ab[i * 4] = 0; ab[i * 4 + 1] = size; ab[i * 4 + 2] = Math.random(); ab[i * 4 + 3] = haze;
  };
  return {
    pts, mat, geo: g, u,
    spawn(x, f, z, W, k) {
      const ns = Math.round(260 * k) + 10, nh = Math.round(90 * k) + 6;
      for (let j = 0; j < ns + nh; j++) {
        const haze = j >= ns ? 1 : 0, th = Math.random() * TAU$4, r = W * (0.12 + 0.45 * Math.sqrt(Math.random()));
        const sp = (haze ? 0.06 + 0.12 * Math.random() : 0.12 + 0.4 * Math.random()) * (0.5 + 0.5 * k);
        put(x + Math.cos(th) * r, f + 0.015 + 0.05 * Math.random(), z + Math.sin(th) * r,
          Math.cos(th) * sp, (haze ? 0.03 + 0.06 * Math.random() : 0.05 + 0.2 * Math.random()) * (0.4 + 0.6 * k), Math.sin(th) * sp,
          haze ? 4.5 + 3.5 * Math.random() : 1.6 + 1.8 * Math.random(), haze ? 0.12 + 0.12 * Math.random() : 0.035 + 0.05 * Math.random(), haze, f);
      }
      pts.visible = true;
    },
    step(dt) {
      if (!pts.visible) return;
      let alive = 0;
      for (let i = 0; i < n; i++) {
        const a4 = i * 4;
        if (ab[a4] >= 1) continue;
        const i3 = i * 3, haze = ab[a4 + 3];
        ab[a4] = Math.min(1, ab[a4] + dt / life[i]);
        const drag = Math.exp(-dt * (haze ? 1.4 : 2.6));
        vel[i3] *= drag; vel[i3 + 2] *= drag;
        vel[i3 + 1] = vel[i3 + 1] * drag - (haze ? 0.004 : 0.16) * dt;
        pos[i3] += (vel[i3] + 0.035) * dt; pos[i3 + 1] += vel[i3 + 1] * dt; pos[i3 + 2] += (vel[i3 + 2] + 0.02) * dt;
        if (pos[i3 + 1] < gnd[i] + 0.008) { pos[i3 + 1] = gnd[i] + 0.008; vel[i3 + 1] = 0; }
        alive++;
      }
      aP.needsUpdate = true;
      aB.needsUpdate = true;
      if (!alive) pts.visible = false;
    },
  };
}

const KIND = {
  stingray: { v0: 0.5, vmin: 0.35, vmax: 1.0, dist: 4.5, clear: 1.5, bub: 0, lens: 2.2, hug: true, big: false },
  eagleRays: { v0: 0.9, vmin: 0.6, vmax: 1.5, dist: 9, clear: 2.8, bub: 1.2, lens: 3.2, hug: true, big: true },
  shark: { v0: 0.75, vmin: 0.5, vmax: 1.3, dist: 9.5, clear: 3.2, bub: 1.8, lens: 3.4, hug: true, big: true },
  blueShark: { v0: 0.6, vmin: 0.45, vmax: 1.2, dist: 13, clear: 3.4, bub: 1.8, lens: 3.4, hug: false, big: true },
  turtle: { v0: 0.45, vmin: 0.3, vmax: 0.9, dist: 6.5, clear: 3.0, bub: 1.0, lens: 3.2, hug: false, big: true },
};
const EDGE = 22.5;

function createRare(o = {}) {
  gseed = 0x51a7e;
  const parent = o.root || o.scene || null;
  const patch = typeof o.patch === 'function' ? o.patch : (m) => m;
  const floorFn = typeof o.floorAt === 'function' ? o.floorAt : () => -20;
  const floorAt = (x, z) => { const y = +floorFn(x, z); return Number.isFinite(y) ? y : -60; };
  const quality = clamp$5(Number.isFinite(+o.quality) ? +o.quality : 1, 0.1, 2);
  const qc = (n, m) => Math.max(m, Math.round(n * quality));
  const fx = o.fx || null;
  const TH = o.threat || { on: false, x: 0, y: 0, z: 0, r: 0 };
  const spots = o.spots || {};
  const obst = (Array.isArray(o.obstacles) ? o.obstacles : []).filter((b) => b && Number.isFinite(b.x + b.y + b.z + b.r));
  const wreck = spots.wreck && Number.isFinite(spots.wreck.x) ? spots.wreck : { x: 0, z: -4 };
  const hullC = spots.hull && Number.isFinite(spots.hull.x) ? spots.hull : wreck;
  const root = new THREE.Group();
  root.name = 'rare';
  if (parent) parent.add(root);
  const disposables = [];

  const uSand = { value: new THREE.Vector3(0.6, 0.55, 0.45) };
  const U_RAY = { uRDetail: { value: 1 }, uRSand: uSand }, U_EA = { uRDetail: { value: 1 } }, U_SH = { uRDetail: { value: 1 } };
  const U_TU = { uRDetail: { value: 1 } }, U_SF = { uRDetail: { value: 1 } };
  const U_J = { uRTime: { value: 0 }, uRScene: { value: new THREE.Vector4(-20, 0.05, 0.3, 0.36) }, uRLight: (U && U.uLight) || { value: 1 }, uRDetail: { value: 1 }, uRFpx: { value: 600 } };
  const mk = (key, id, vd, vn, vf, fd, fc, uni, rough, spec) => rareMaterial({ key, id, vdecl: vd, vnormal: vn, vdeform: vf, fdecl: fd, fcolor: fc, uniforms: uni, rough, spec }, patch);
  const RAY = speciesMesh(root, buildStingray(), mk('stingray', 60, RAY_VDECL, RAY_VNORMAL, RAY_VDEFORM, RAY_FDECL, RAY_FCOLOR, U_RAY, 0.6), 2, ['aRS', 'aRX'], 'rare-stingray');
  const EAG = speciesMesh(root, buildEagleRay(), mk('eagleray', 61, EA_VDECL, EA_VNORMAL, EA_VDEFORM, EA_FDECL, EA_FCOLOR, U_EA, 0.5), 3, ['aE', 'aEX'], 'rare-eaglerays');
  const SHK = speciesMesh(root, buildShark(), mk('shark', 62, SH_VDECL, SH_VNORMAL, SH_VDEFORM, SH_FDECL, SH_FCOLOR, U_SH, 0.6, 0.3), 1, ['aS', 'aSh'], 'rare-shark');
  const TUR = speciesMesh(root, buildTurtle(), mk('turtle', 63, TU_VDECL, TU_VNORMAL, TU_VDEFORM, TU_FDECL, TU_FCOLOR, U_TU, 0.55, 0.45), 1, ['aT0', 'aT1'], 'rare-turtle');
  const NPF = quality >= 0.75 ? 5 : 2, NJUV = quality >= 0.75 ? 10 : 5;
  const SMF = speciesMesh(root, buildSmallFish(), mk('smallfish', 64, SF_VDECL, '', SF_VDEFORM, SF_FDECL, SF_FCOLOR, U_SF, 0.35), NPF + 2 * NJUV, ['aF'], 'rare-smallfish');
  SMF.mesh.castShadow = false;
  RAY.U = U_RAY; EAG.U = U_EA; SHK.U = U_SH; TUR.U = U_TU; SMF.U = U_SF;
  const BIG = [RAY, EAG, SHK, TUR];
  for (const S of [...BIG, SMF]) {
    S.used = new Uint8Array(S.count);
    S.pos = new Float32Array(S.count * 3);
    S.live = new Uint8Array(S.count);
    disposables.push(S.mesh.geometry, S.mesh.material, S.mesh.customDepthMaterial);
  }
  const alloc = (S) => { for (let k = 0; k < S.count; k++) if (!S.used[k]) { S.used[k] = 1; return k; } return -1; };
  const park = (S, k) => {
    writeMatrix(S.mesh.instanceMatrix.array, k * 16, 0, 0, 1, 0, 1e-3, 1e-3, 1e-3, 0, -500, 0);
    S.mesh.instanceMatrix.needsUpdate = true;
    S.live[k] = 0;
  };
  const release = (S, k) => { if (k >= 0) { S.used[k] = 0; park(S, k); } };

  const NP = qc(22, 10), NRH = 2;
  const setJPx = (renderer, sc, cam) => {
    const rt = renderer.getRenderTarget();
    U_J.uRFpx.value = cam.projectionMatrix.elements[5] * 0.5 * (rt ? rt.height : renderer.domElement.height);
  };
  const jel = (geo, mat, fill, n, name, order) => {
    const a = new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4);
    geo.setAttribute('aJ', a);
    const m = new THREE.InstancedMesh(geo, mat, n);
    m.name = name;
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.frustumCulled = false; m.castShadow = false; m.receiveShadow = false;
    m.renderOrder = order;
    m.onBeforeRender = setJPx;
    root.add(m);
    const f = new THREE.InstancedMesh(geo, fill, n);
    f.instanceMatrix = m.instanceMatrix;
    f.name = name + '-behind';
    f.frustumCulled = false; f.castShadow = false; f.receiveShadow = false;
    f.renderOrder = order - 1;
    f.onBeforeRender = setJPx;
    root.add(f);
    disposables.push(geo, mat, fill);
    return { mesh: m, fill: f, aJ: a, n };
  };
  const PEL = jel(buildPelagia(), jellyMaterial('pelagia', 70, 0.18, PE_FCOLOR, U_J, patch, 0.22, 0.7), jellyFill('pelagia', 0.18, U_J, 0.22, 0.7), NP, 'rare-pelagia', 5);
  const RHI = jel(buildRhizostoma(), jellyMaterial('rhizostoma', 71, 0.11, RH_FCOLOR, U_J, patch, 0.06, 0.7), jellyFill('rhizostoma', 0.11, U_J, 0.06, 0.7), NRH, 'rare-rhizostoma', 5);
  const J = (n) => ({
    x: new Float32Array(n), y: new Float32Array(n), z: new Float32Array(n), vy: new Float32Array(n), hd: new Float32Array(n), ty: new Float32Array(n), s: new Float32Array(n), yaw: new Float32Array(n), ph: new Float32Array(n), per: new Float32Array(n),
    age: new Float32Array(n).fill(10), line: new Uint8Array(n), lo: new Float32Array(n), hi: new Float32Array(n),
  });
  const TIER_P = { near: 9.5, far: 12, keep: 1.8, ring: [6.5, 11.5], tl: 5.5 }, TIER_R = { near: 17, far: 21, keep: 2.5, ring: [0, 0], tl: 1.6 };
  const PJ = J(NP), RJ = J(NRH);
  {
    const ax = wreck.x, az = wreck.z;
    for (let k = 0; k < NP; k++) {
      const a = grand() * TAU$4, r = 1.5 + 11 * Math.sqrt(grand());
      PJ.x[k] = ax + Math.cos(a) * r; PJ.z[k] = az + Math.sin(a) * r;
      PJ.y[k] = PJ.ty[k] = -9 - 9 * grand();
      PJ.hd[k] = grand() * TAU$4; PJ.yaw[k] = grand() * TAU$4; PJ.s[k] = 0.06 + 0.03 * grand();
      PJ.ph[k] = grand(); PJ.per[k] = 0.9 * (0.88 + 0.24 * grand());
      PEL.aJ.array.set([PJ.ph[k], PJ.per[k], grand(), 1], k * 4);
    }
    for (let k = 0; k < NRH; k++) {
      RJ.x[k] = ax + 4 + 3 * k; RJ.z[k] = az + 8 - 5 * k; RJ.y[k] = RJ.ty[k] = -4.5 - 4 * k;
      RJ.hd[k] = grand() * TAU$4; RJ.yaw[k] = grand() * TAU$4; RJ.s[k] = 0.46 + 0.12 * grand();
      RJ.ph[k] = grand(); RJ.per[k] = 1.5 * (0.9 + 0.2 * grand());
      RHI.aJ.array.set([RJ.ph[k], RJ.per[k], grand(), 1], k * 4);
    }
  }
  const JV = { a: new Float32Array(NRH * NJUV), r: new Float32Array(NRH * NJUV), h: new Float32Array(NRH * NJUV), w: new Float32Array(NRH * NJUV), ph: new Float32Array(NRH * NJUV), dart: new Float32Array(NRH * NJUV), px: new Float32Array(NRH * NJUV * 3) };
  for (let k = 0; k < NRH * NJUV; k++) {
    JV.a[k] = grand() * TAU$4; JV.r[k] = 0.35 + 0.5 * grand(); JV.h[k] = -0.35 - 0.9 * grand();
    JV.w[k] = (grand() < 0.5 ? -1 : 1) * (0.25 + 0.35 * grand()); JV.ph[k] = grand() * TAU$4; JV.dart[k] = grand() * 6;
    SMF.used[NPF + k] = 1;
  }
  for (let k = 0; k < NPF; k++) SMF.used[k] = 1;

  const COP = makeCopepods(root, qc(2400, 900), 0.4);
  disposables.push(...COP.geos, ...COP.mats);

  const BIL = makeBillow(root, qc(900, 400));
  disposables.push(BIL.geo, BIL.mat);

  const L = { cam: [0, -2, 0], camF: [0, 0, -1], diver: [0, -2, 0], state: '', t: 0, camObj: null, camV: 0, still: 0, vel: [0, 0, 0], vs: 0, turn: 0 };
  const KO = { x: 0, y: 0, z: 0, n: 0, caps: new Float32Array(7 * 24), m: 0, hx: 0, hy: 0, hz: 0, helm: false };
  const DS = { set: false, a: [0, -0.6, 0], b: [0, -20, 0] };
  const pending = [], passes = [], listeners = [];
  const emit = (type, kind, info) => { for (const fn of listeners) { try { fn(type, kind, info); } catch (e) { console.warn(e); } } };
  const v3 = (p, d) => (p && Number.isFinite(p.x + p.y + p.z) ? [p.x, p.y, p.z] : Array.isArray(p) && p.length >= 3 && Number.isFinite(p[0] + p[1] + p[2]) ? [p[0], p[1], p[2]] : d.slice());
  const dist3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  function segDist(q, a, b) {
    const bx = b[0] - a[0], by = b[1] - a[1], bz = b[2] - a[2], b2 = bx * bx + by * by + bz * bz;
    const t = b2 > 1e-8 ? clamp$5(((q[0] - a[0]) * bx + (q[1] - a[1]) * by + (q[2] - a[2]) * bz) / b2, 0, 1) : 0;
    return Math.hypot(q[0] - a[0] - bx * t, q[1] - a[1] - by * t, q[2] - a[2] - bz * t);
  }
  function frameOf(near, cam, out) {
    let fx = near[0] - cam[0], fz = near[2] - cam[2], l = Math.hypot(fx, fz);
    if (l < 0.5) { fx = L.camF[0]; fz = L.camF[2]; l = Math.hypot(fx, fz); if (l < 1e-3) { fx = 0; fz = -1; l = 1; } }
    fx /= l; fz /= l;
    out.fx = fx; out.fz = fz; out.rx = -fz; out.rz = fx;
    return out;
  }
  const SO = o.solids || {};
  const SOL = { cells: null, n: 0, tmp: [] };
  const _sm = new THREE.Matrix4(), _si = new THREE.Matrix4(), _sv = new THREE.Vector3();
  function buildSolids() {
    const cells = new Map(), add = (x, z, r, top) => {
      if (!Number.isFinite(x + z + r + top) || r <= 0) return;
      const rec = { x, z, r, top };
      const i0 = Math.floor((x - r) / 2), i1 = Math.floor((x + r) / 2), j0 = Math.floor((z - r) / 2), j1 = Math.floor((z + r) / 2);
      for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { const k = i * 65536 + j; let c = cells.get(k); if (!c) cells.set(k, (c = [])); c.push(rec); }
      SOL.n++;
    };
    for (const b of obst) add(b.x, b.z, b.r, b.y + b.r);
    for (const c of Array.isArray(SO.capsules) ? SO.capsules : []) {
      if (!c || !Number.isFinite(c.ax + c.az + c.bx + c.bz + c.r)) continue;
      const n = Math.max(1, Math.ceil(Math.hypot(c.bx - c.ax, c.bz - c.az) / 0.5));
      for (let i = 0; i <= n; i++) { const t = i / n; add(lerp$2(c.ax, c.bx, t), lerp$2(c.az, c.bz, t), c.r, lerp$2(c.ay, c.by, t) + c.r); }
    }
    for (const b of HARD.boulders || []) add(b.x, b.z, 0.92 * b.s, Number.isFinite(b.top) ? b.top : b.y + 0.86 * b.sy);
    const C = [[0, 0, 0], [0, 0, 1], [0, 1, 0], [0, 1, 1], [1, 0, 0], [1, 0, 1], [1, 1, 0], [1, 1, 1]], CW = new Float64Array(16);
    for (const r0 of Array.isArray(SO.scatter) ? SO.scatter : []) {
      if (!r0 || !r0.traverse) continue;
      r0.updateMatrixWorld(true);
      r0.traverse((m) => {
        const mat = m.material;
        if (!m.isMesh || !mat || Array.isArray(mat) || mat.transparent || mat.side === THREE.DoubleSide || !m.geometry) return;
        const g = m.geometry;
        if (!g.boundingBox) g.computeBoundingBox();
        const bb = g.boundingBox;
        const inst = !!m.isInstancedMesh;
        if (!inst && bb.max.distanceTo(bb.min) * m.matrixWorld.getMaxScaleOnAxis() > 8) return;
        for (let j = 0; j < (inst ? m.count : 1); j++) {
          if (inst) { m.getMatrixAt(j, _si); _sm.multiplyMatrices(m.matrixWorld, _si); } else _sm.copy(m.matrixWorld);
          let top = -1e9, r = 0, px = 0, pz = 0;
          for (let q = 0; q < 8; q++) {
            _sv.set(C[q][0] ? bb.max.x : bb.min.x, C[q][1] ? bb.max.y : bb.min.y, C[q][2] ? bb.max.z : bb.min.z).applyMatrix4(_sm);
            CW[q * 2] = _sv.x; CW[q * 2 + 1] = _sv.z; px += _sv.x / 8; pz += _sv.z / 8;
            if (_sv.y > top) top = _sv.y;
          }
          for (let q = 0; q < 8; q++) r = Math.max(r, Math.hypot(CW[q * 2] - px, CW[q * 2 + 1] - pz));
          if (top > floorAt(px, pz) + 0.04) add(px, pz, 0.8 * r, top);
        }
      });
    }
    SOL.cells = cells;
  }
  function solidsNear(x, z, r, out) {
    if (!SOL.cells) buildSolids();
    out.length = 0;
    const i0 = Math.floor((x - r) / 2), i1 = Math.floor((x + r) / 2), j0 = Math.floor((z - r) / 2), j1 = Math.floor((z + r) / 2);
    for (let i = i0; i <= i1; i++) {
      for (let j = j0; j <= j1; j++) {
        const c = SOL.cells.get(i * 65536 + j);
        if (!c) continue;
        for (const s of c) if (out.indexOf(s) < 0 && Math.hypot(x - s.x, z - s.z) < r + s.r) out.push(s);
      }
    }
    return out;
  }
  const supportFn = typeof SO.support === 'function' ? SO.support : null;
  const RING5 = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]];
  function standsUp(x, z, r) {
    const f = floorAt(x, z);
    let h = 0;
    if (supportFn) {
      for (const [dx, dz] of RING5) {
        const s = +supportFn(x + dx * r, z + dz * r);
        if (Number.isFinite(s)) h = Math.max(h, s - floorAt(x + dx * r, z + dz * r));
      }
    }
    for (const s of solidsNear(x, z, r, SOL.tmp)) h = Math.max(h, s.top - f);
    return h;
  }
  function onSand(x, z) {
    if (Math.hypot(x - hullC.x, z - hullC.z) < 9.5 || Math.hypot(x - wreck.x, z - wreck.z) < 8) return false;
    const f = floorAt(x, z);
    for (const b of obst) if (b.y + b.r > f - 0.2 && Math.hypot(x - b.x, z - b.z) < b.r + 1.3) return false;
    if (standsUp(x, z, 0.75) > 0.03) return false;
    return Math.abs(floorAt(x + 0.6, z) - floorAt(x - 0.6, z)) < 0.3 && Math.abs(floorAt(x, z + 0.6) - floorAt(x, z - 0.6)) < 0.3;
  }
  const _ta = new Array(13).fill(0), _fq = [0, 0, 0];
  function groundTone(x, z, out) {
    try { terrainAttrs(x, z, _ta); } catch (e) { return sandAlbedo(x, z, 0.1, out); }
    if (!Number.isFinite(_ta[0] + _ta[1] + _ta[2])) return sandAlbedo(x, z, 0.1, out);
    out[0] = _ta[0]; out[1] = _ta[1]; out[2] = _ta[2];
    return out;
  }
  function sandSpot(x, z) {
    if (!onSand(x, z)) return false;
    try { terrainAttrs(x, z, _ta); } catch (e) { return true; }
    return !(_ta[3] < 0.55 || _ta[4] > 0.15 || _ta[7] > 0.3 || _ta[6] < 0.75);
  }
  function rockAt(x, z) {
    try { terrainAttrs(x, z, _ta); } catch (e) { return false; }
    return _ta[3] < 0.55 || _ta[6] < 0.75;
  }
  function obsNear(p) {
    const out = [], seen = new Set(), low = p.kind === 'stingray' ? 0.06 : 0.45;
    for (let j = 0; j <= 24; j++) {
      p.path.point(j / 24, _fq);
      for (const b of solidsNear(_fq[0] + p.off[0], _fq[2] + p.off[2], 6, SOL.tmp)) {
        if (seen.has(b)) continue;
        seen.add(b);
        if (b.top - floorAt(b.x, b.z) > low) out.push(b);
      }
    }
    return out;
  }

  const TT = [0, 0, 0], PA = [0, 0, 0], PB = [0, 0, 0], PH = [0, 1], _pv = new THREE.Vector3(), _kq = [0, 0, 0], _kt = [0, 0, 0];
  const CV = { R: 1e9, side: 1 };
  function curveAt(p, a) {
    p.path.at(a - 0.6, _kq, _kt);
    const ax = _kt[0], az = _kt[2];
    p.path.at(a + 0.6, _kq, _kt);
    const bx = _kt[0], bz = _kt[2], la = Math.hypot(ax, az), lb = Math.hypot(bx, bz);
    if (la < 1e-4 || lb < 1e-4) { CV.R = 1e9; CV.side = 1; return CV; }
    const turn = Math.atan2(ax * bz - az * bx, ax * bx + az * bz);
    CV.R = Math.abs(turn) > 1e-5 ? 1.2 / Math.abs(turn) : 1e9;
    CV.side = turn > 0 ? 1 : -1;
    return CV;
  }
  function poseAt(p, m, a, out, sh = 0) {
    const sp = p.spr === undefined ? 1 : p.spr;
    let o = m.lat * sp + sh;
    if (o > 0.05 || o < -0.05) {
      const C = curveAt(p, a);
      if (o * C.side > 0 && Math.abs(o) > 0.45 * C.R) o = Math.sign(o) * 0.45 * C.R;
    }
    const u = p.path.at(a, out, TT);
    let nx = -TT[2], nz = TT[0];
    const nl = Math.hypot(nx, nz) || 1;
    nx /= nl; nz /= nl;
    PH[0] = nz; PH[1] = -nx;
    out[0] += nx * o + p.off[0]; out[2] += nz * o + p.off[2];
    const f = floorAt(out[0], out[2]);
    if (p.hug) out[1] = f + p.h0 + (p.h1 - p.h0) * Math.sin(Math.PI * clamp$5(a / p.path.len, 0, 1));
    else out[1] = Math.min(Math.max(out[1] + p.off[1], f + p.minH), -1.2);
    out[1] += m.ver;
    if (p.obs && p.obs.length) {
      const clr = p.kind === 'stingray' ? 0.3 : 0.9, half = m.W ? 0.5 * m.W : m.L ? 0.12 * m.L : 0.3;
      for (const b of p.obs) {
        const dh = Math.hypot(out[0] - b.x, out[2] - b.z) - half;
        if (dh < b.r + 1.5) out[1] += sstep$4(b.r + 1.5, b.r, dh) * Math.max(0, b.top + clr - out[1]);
      }
    }
    return u;
  }
  function openSide(p) {
    if (Math.abs(L.turn) > 6 * DEG$2) return L.turn > 0 ? 1 : -1;
    const F = p.fr;
    if (DS.set) {
      const r = (DS.a[0] - p.near[0]) * F.rx + (DS.a[2] - p.near[2]) * F.rz;
      if (Math.abs(r) > 0.4) return r > 0 ? -1 : 1;
    }
    const cl = Math.hypot(L.camF[0], L.camF[2]) || 1, rx = -L.camF[2] / cl, rz = L.camF[0] / cl;
    const r = (p.near[0] - p.cam[0]) * rx + (p.near[2] - p.cam[2]) * rz;
    return r > 0 ? -1 : 1;
  }
  const FC = { dA: [0, 4, -4, 8, -8, 13, 18], dL: [0, -1, 1, -2, 2, 3.5, 5], dY: [0, 0.8, -0.8, 1.6, -1.6, 2.6] };
  function buildAngled(p) {
    const F = p.fr, s = p.side, c = p.cam, n = p.near, K = KIND[p.kind];
    const thP = clamp$5(p.o.angle, 8, 60) * DEG$2, LP = Number.isFinite(p.o.lensDist) ? clamp$5(p.o.lensDist, 3.5, 16) : 6.5;
    const at = (a, d, y) => [c[0] + (F.fx * Math.cos(a) + F.rx * s * Math.sin(a)) * d, y, c[2] + (F.fz * Math.cos(a) + F.rz * s * Math.sin(a)) * d];
    const hug = !!K.hug && !Number.isFinite(p.o.depth);
    const yOf = (Pc) => {
      const fl = floorAt(Pc[0], Pc[2]);
      if (hug) return fl + (p.kind === 'shark' ? 1.6 : p.kind === 'eagleRays' ? 2.0 : 0.8);
      return Number.isFinite(p.o.depth) ? p.o.depth : p.kind === 'blueShark' ? clamp$5(n[1] - 1.5, fl + 3, -3) : p.kind === 'turtle' ? clamp$5(n[1] + 0.3, fl + 2, -2) : fl + 2;
    };
    const Pc = [0, 0, 0];
    const put = (dA, dL, dY) => {
      const q = at(thP + dA * DEG$2, Math.max(3.5, LP + dL), 0);
      Pc[0] = q[0]; Pc[2] = q[2];
      const fl = floorAt(q[0], q[2]);
      Pc[1] = hug ? yOf(Pc) : clamp$5(yOf(Pc) + dY, fl + 1.5, -1.5);
    };
    const size = K.big ? (p.kind === 'shark' || p.kind === 'blueShark' ? 2.3 : p.kind === 'eagleRays' ? 1.8 + (p.count - 1) * 1.2 : 0.8) : 0.7;
    viewFor(p);
    const was = p.fc || [0, 0, 0];
    let pick = was, cost;
    put(pick[0], pick[1], pick[2]);
    cost = frameCost(p, Pc, size);
    if (cost > 0) {
      cost += 0.02 * Math.abs(pick[1]) + 0.004 * Math.abs(pick[0]) + 0.03 * Math.abs(pick[2]);
      for (const dL of FC.dL) {
        for (const dA of FC.dA) {
          for (const dY of hug ? [0] : FC.dY) {
            if (dA === was[0] && dL === was[1] && dY === was[2]) continue;
            put(dA, dL, dY);
            const k = frameCost(p, Pc, size) + 0.02 * Math.abs(dL) + 0.004 * Math.abs(dA) + 0.03 * Math.abs(dY) + 0.05;
            if (k < cost) { cost = k; pick = [dA, dL, dY]; }
          }
        }
        if (cost < 0.2) break;
      }
      put(pick[0], pick[1], pick[2]);
    }
    p.fc = pick;
    p.frameCost = cost;
    const th = thP + pick[0] * DEG$2, yc = Pc[1];
    const side = p.o.enter === 'side';
    const R0 = side ? 15 : EDGE + 1.5, R3 = side ? 22 : 18, th0 = side ? th + 16 * DEG$2 : th + 3 * DEG$2, th3 = th + (side ? 40 : 55) * DEG$2;
    const P0 = at(th0, R0, yc - (p.kind === 'blueShark' ? 1.5 : 0)), P3 = at(th3, R3, yc - (p.kind === 'blueShark' ? 0.8 : 0));
    let vx = Pc[2] - c[2], vz = -(Pc[0] - c[0]);
    const vl = Math.hypot(vx, vz) || 1;
    if (vx * (P3[0] - Pc[0]) + vz * (P3[2] - Pc[2]) < 0) { vx = -vx; vz = -vz; }
    const ch = Math.hypot(P3[0] - P0[0], P3[2] - P0[2]) / vl;
    const S = [0, 1, 2].map((k) => (8 * Pc[k] - P0[k] - P3[k]) / 3);
    const D = [(vx * ch) / 0.75 - (P3[0] - P0[0]), 0, (vz * ch) / 0.75 - (P3[2] - P0[2])];
    p.path.set(P0, [0, 1, 2].map((k) => (S[k] - D[k]) / 2), [0, 1, 2].map((k) => (S[k] + D[k]) / 2), P3);
  }
  const VW = { ok: false, box: [0, 0, 0, 0], sx: 1, sy: 1 };
  function viewFor(p) {
    const cam = L.camObj;
    VW.ok = !!(cam && cam.isPerspectiveCamera) && Math.hypot(p.cam[0] + p.off[0] - L.cam[0], p.cam[1] + p.off[1] - L.cam[1], p.cam[2] + p.off[2] - L.cam[2]) < 2;
    if (!VW.ok) return;
    cam.updateMatrixWorld();
    const B = VW.box;
    B[0] = B[1] = 1e9; B[2] = B[3] = -1e9;
    const ty = Math.tan((cam.fov * DEG$2) / 2);
    VW.sy = 1 / ty; VW.sx = 1 / (ty * (cam.aspect || 1));
    const pt = (x, y, z, r) => {
      _pv.set(x, y, z).applyMatrix4(cam.matrixWorldInverse);
      const d = -_pv.z;
      if (d < 0.1) { B[0] = -1e9; B[2] = 1e9; B[1] = -1e9; B[3] = 1e9; return; }
      const nx = (_pv.x / d) * VW.sx, ny = (_pv.y / d) * VW.sy, ex = (r / d) * VW.sx, ey = (r / d) * VW.sy;
      B[0] = Math.min(B[0], nx - ex); B[2] = Math.max(B[2], nx + ex); B[1] = Math.min(B[1], ny - ey); B[3] = Math.max(B[3], ny + ey);
    };
    if (KO.m) { const C = KO.caps; for (let k = 0; k < KO.m * 7; k += 7) { pt(C[k], C[k + 1], C[k + 2], C[k + 6]); pt(C[k + 3], C[k + 4], C[k + 5], C[k + 6]); } }
    else { pt(L.diver[0], L.diver[1] - 0.9, L.diver[2], 0.35); pt(L.diver[0], L.diver[1] + 0.9, L.diver[2], 0.35); }
  }
  function frameCost(p, q, size) {
    const K = KIND[p.kind];
    let k = 0;
    const dB = bodyDist(q[0] + p.off[0], q[1] + p.off[1], q[2] + p.off[2]);
    if (dB < K.clear + 0.6) k += (K.clear + 0.6 - dB) * 0.6;
    if (!VW.ok) return k;
    _pv.set(q[0] + p.off[0], q[1] + p.off[1], q[2] + p.off[2]).applyMatrix4(L.camObj.matrixWorldInverse);
    const d = -_pv.z;
    if (d < 0.5) return k + 5;
    const nx = (_pv.x / d) * VW.sx, ny = (_pv.y / d) * VW.sy, hx = (0.5 * size / d) * VW.sx, hy = (0.3 * size / d) * VW.sy;
    k += Math.max(0, Math.abs(nx) + hx - 0.8) + Math.max(0, Math.abs(ny) + hy - 0.8);
    const B = VW.box, m = 0.1;
    const ox = Math.min(nx + hx - (B[0] - m), B[2] + m - (nx - hx)), oy = Math.min(ny + hy - (B[1] - m), B[3] + m - (ny - hy));
    if (ox > 0 && oy > 0) k += Math.min(ox, oy);
    return k;
  }
  function buildPath(p) {
    if (Number.isFinite(p.o.angle) && p.kind !== 'stingray') {
      buildAngled(p);
      const K = KIND[p.kind];
      p.hug = !!K.hug && !Number.isFinite(p.o.depth);
      p.h0 = p.kind === 'shark' ? 1.1 : p.kind === 'eagleRays' ? 1.2 : 0.35;
      p.h1 = p.kind === 'shark' ? 1.6 : p.kind === 'eagleRays' ? 2.0 : 0.8;
      p.minH = p.kind === 'blueShark' ? 2.5 : 1.5;
      return;
    }
    const F = p.fr, s = p.side, n = p.near, c = p.cam, d = p.dist, K = KIND[p.kind];
    const cx = n[0] + F.fx * d, cz = n[2] + F.fz * d;
    const fl = floorAt(cx, cz);
    let a0 = 5, w0 = 15, a3 = 5, w3 = 15, y0, yc, y3;
    if (p.kind === 'shark') { a0 = 9; w0 = 12; a3 = 4; w3 = 20; }
    else if (p.kind === 'blueShark') { a0 = 6; w0 = 14; a3 = 3; w3 = 18; }
    else if (p.kind === 'turtle') { a0 = 4; w0 = 14; a3 = 5; w3 = 14; }
    else if (p.kind === 'stingray') { a0 = 3; w0 = 13; a3 = 4; w3 = 12; }
    yc = Number.isFinite(p.o.depth) ? p.o.depth : p.kind === 'blueShark' ? clamp$5(n[1] - 2.5, fl + 3, -4) : p.kind === 'turtle' ? clamp$5(n[1] + 0.3, fl + 2, -2) : fl + 2;
    y0 = yc - (p.kind === 'blueShark' ? 1.5 : 0); y3 = yc - (p.kind === 'blueShark' ? 0.8 : 0);
    const P0 = [cx + F.fx * a0 + F.rx * s * w0, y0, cz + F.fz * a0 + F.rz * s * w0];
    const P3 = [cx + F.fx * a3 - F.rx * s * w3, y3, cz + F.fz * a3 - F.rz * s * w3];
    for (let i = 0; i < 40 && dist3(P0, c) < EDGE; i++) { P0[0] += F.rx * s * 0.7 + F.fx * 0.3; P0[2] += F.rz * s * 0.7 + F.fz * 0.3; }
    for (let i = 0; i < 40 && dist3(P3, c) < EDGE; i++) { P3[0] -= F.rx * s * 0.7 - F.fx * 0.3; P3[2] -= F.rz * s * 0.7 - F.fz * 0.3; }
    const Pc = [cx, yc, cz];
    const M = [0, 1, 2].map((k) => (8 * Pc[k] - P0[k] - P3[k]) / 6);
    const k = 0.28 * Math.hypot(P3[0] - P0[0], P3[2] - P0[2]);
    p.path.set(P0, [M[0] + F.rx * s * k, M[1], M[2] + F.rz * s * k], [M[0] - F.rx * s * k, M[1], M[2] - F.rz * s * k], P3);
    p.hug = !!K.hug && !Number.isFinite(p.o.depth);
    p.h0 = p.kind === 'shark' ? 1.7 : p.kind === 'eagleRays' ? 1.7 : 0.35;
    p.h1 = p.kind === 'shark' ? 2.4 : p.kind === 'eagleRays' ? 2.8 : 0.8;
    p.minH = p.kind === 'blueShark' ? 2.5 : 1.5;
  }
  function spreadSide(p) {
    p.path.at(p.path.tab[32], _kq, _kt);
    const s = -_kt[2] * p.fr.fx + _kt[0] * p.fr.fz >= 0 ? 1 : -1;
    p.sprT = s;
    if (p.spr === undefined) p.spr = s;
  }
  function pathClear(p) {
    const K = KIND[p.kind], m = { lat: 0, ver: 0 }, q = [0, 0, 0];
    const lat = p.members ? Math.max(...p.members.map((mm) => mm.lat)) : 0;
    for (let j = 0; j <= 48; j++) {
      poseAt(p, m, (j / 48) * p.path.len, q);
      if (dist3(q, p.near) < K.clear || segDist(q, p.cam, p.near) < K.clear * 0.8 || dist3(q, p.cam) < K.clear + lat * 0.5) return false;
    }
    return true;
  }
  function rayFleePath(p, x, z, awayX, awayZ, latK = 1) {
    let ax = awayX, az = awayZ;
    const al = Math.hypot(ax, az) || 1;
    ax /= al; az /= al;
    const s = p.side;
    const f = floorAt(x, z);
    const set = (bx, bz, L) => {
      const px = -bz * s * latK, pz = bx * s * latK, k = L / 12.5;
      p.path.set([x, f, z], [x + (bx * 0.35 + px * 0.9) * 2.5 * k, f, z + (bz * 0.35 + pz * 0.9) * 2.5 * k],
        [x + (bx * 0.55 + px * 0.8) * 7 * k, f, z + (bz * 0.55 + pz * 0.8) * 7 * k], [x + (bx * 0.7 + px * 0.6) * L, f, z + (bz * 0.7 + pz * 0.6) * L]);
    };
    const W = p.members && p.members[0] ? p.members[0].W : 0.7;
    const clear = () => {
      for (let j = 1; j <= 24; j++) {
        p.path.point(j / 24, _fq);
        if (Math.hypot(_fq[0] - hullC.x, _fq[2] - hullC.z) < 7 || Math.hypot(_fq[0] - wreck.x, _fq[2] - wreck.z) < 5.5) return false;
        const fl = floorAt(_fq[0], _fq[2]);
        for (const b of obst) if (b.y + b.r > fl + 0.15 && Math.hypot(_fq[0] - b.x, _fq[2] - b.z) < b.r + 0.6) return false;
        if (j > 1 && (rockAt(_fq[0], _fq[2]) || rockAt(_fq[0] + 0.4, _fq[2]) || rockAt(_fq[0] - 0.4, _fq[2]) || rockAt(_fq[0], _fq[2] + 0.4) || rockAt(_fq[0], _fq[2] - 0.4))) return false;
        const hs = j >= 21 ? 0.04 : 0.25 + 0.5 * Math.sin((Math.PI * j) / 24) - 0.15;
        if (j > 1 && standsUp(_fq[0], _fq[2], 0.5 * W + 0.3) > hs) return false;
      }
      p.path.point(1, _fq);
      return sandSpot(_fq[0], _fq[2]);
    };
    const ANG = [0, 0.44, -0.44, 0.87, -0.87, 1.31, -1.31, 1.75, -1.75];
    let done = false;
    for (const L of [12.5, 9, 6, 4]) {
      for (const an of ANG) {
        const c = Math.cos(an), sn = Math.sin(an);
        set(ax * c - az * sn, ax * sn + az * c, L);
        if (clear()) { done = true; break; }
      }
      if (done) break;
    }
    if (!done) set(ax, az, 12.5);
    p.noSettle = !done;
    p.hug = true; p.h0 = 0.25; p.h1 = 0.75; p.minH = 0.2;
    p.obs = obsNear(p);
  }

  function schedule(kind, opts = {}) {
    if (!KIND[kind]) { console.warn('[rare] unknown kind', kind); return null; }
    const p = {
      kind, o: opts, delay: Math.max(0, +opts.at || 0), active: false, done: false, manual: opts.manual !== false && !opts.auto,
      path: new Path(), s: 0, v: 0, v0: KIND[kind].v0, t: 0, fr: { fx: 0, fz: -1, rx: 1, rz: 0 }, side: 1, dist: 0,
      near: L.diver.slice(), cam: L.cam.slice(), carry: clamp$5(+opts.carry || 0, 0, 1), off: [0, 0, 0], lf: L.cam.slice(),
      members: null, dmin: 1e9, dPrev: 1e9, entered: false, closest: false, fadeOut: 1, fadeGo: false, hug: false, h0: 0, h1: 0, minH: 1.5,
      av: { x: 0, v: 0, boost: 1, dBody: 1e9, dLens: 1e9 },
      count: kind === 'eagleRays' ? (+opts.count > 0 ? clamp$5(opts.count | 0, 1, 3) : rnd() < 0.55 ? 2 : 3) : 1,
    };
    const h = {
      kind,
      get eta() { return p.active || p.done ? 0 : p.delay; },
      get active() { return p.active && !p.done; },
      get done() { return p.done; },
      cancel() { if (!p.done) { if (p.active) p.fadeGo = true; else { p.done = true; const i = pending.indexOf(p); if (i >= 0) pending.splice(i, 1); } } },
      retime(sec) { if (Number.isFinite(sec) && sec > 0) { if (p.active) p.closeT = p.t + sec; else p.o.closeIn = sec + p.delay; } },
    };
    p.h = h;
    if (p.manual) {
      AUTO.manual = true; AUTO.plan = null;
      for (let i = pending.length - 1; i >= 0; i--) if (!pending[i].manual) { pending[i].done = true; pending.splice(i, 1); }
      if (opts.replace && KIND[kind].big) for (let i = pending.length - 1; i >= 0; i--) if (KIND[pending[i].kind].big) { pending[i].done = true; pending.splice(i, 1); }
    }
    pending.push(p);
    return h;
  }
  const bigActive = (except) => passes.some((q) => q !== except && !q.done && KIND[q.kind].big && q.fadeOut > 0.2 && !q.fadeGo);
  const SPECIES = { stingray: RAY, eagleRays: EAG, shark: SHK, blueShark: SHK, turtle: TUR };
  function roomFor(p) {
    const S = SPECIES[p.kind];
    let n = 0;
    for (let k = 0; k < S.count; k++) if (!S.used[k]) n++;
    return n >= p.count;
  }

  function member(S, extra) {
    const k = alloc(S);
    if (k < 0) return null;
    return Object.assign({ S, k, lag: 0, lat: 0, ver: 0, ph: rnd() * TAU$4, ph2: rnd() * TAU$4, bank: 0, psi: null, yr: 0, fade: 0, x: 0, y: -500, z: 0, fx: 0, fy: 0, fz: 1, seed: rnd() }, extra);
  }
  function activate(p) {
    const K = KIND[p.kind];
    const oc = p.o.camera;
    p.cam = oc ? v3(oc.position || oc, L.cam) : L.cam.slice();
    p.near = p.o.near ? v3(p.o.near, L.diver) : L.diver.slice();
    p.lf = L.cam.slice();
    frameOf(p.near, p.cam, p.fr);
    p.side = p.o.side === 'open' ? openSide(p) : p.o.side ? Math.sign(p.o.side) : rnd() < 0.5 ? -1 : 1;
    p.dist = Number.isFinite(p.o.dist) ? p.o.dist : K.dist * rr$1(0.92, 1.15);
    const ms = [];
    if (p.kind === 'stingray') {
      const m = member(RAY, { W: rnd() < 0.12 ? rr$1(0.85, 1.0) : rr$1(0.5, 0.72), bury: 1, amp: 0, st: 'buried', lt: 0, spir: 0 });
      if (m) ms.push(m);
    } else if (p.kind === 'eagleRays') {
      const n = p.count;
      const LAG = [0, -1.7, -3.1], LAT = [0, 1.0, 2.0], VER = [0, 0.35, -0.3];
      for (let i = 0; i < n; i++) {
        const m = member(EAG, { lag: LAG[i] + rr$1(-0.3, 0.3), lat: LAT[i], ver: VER[i], W: rr$1(0.7, 0.95), TH: 0.5, droop: 0, flap: true, beats: 3 + Math.floor(rnd() * 5), gT: 0, ph: rnd() * TAU$4 });
        if (m) ms.push(m);
      }
    } else if (p.kind === 'shark' || p.kind === 'blueShark') {
      const blue = p.kind === 'blueShark';
      const m = member(SHK, { L: blue ? rr$1(2.1, 2.6) : rr$1(1.9, 2.3), blue, dK: blue ? 0.62 : rr$1(0.95, 1.08), pK: blue ? 1.35 : 1.0 });
      if (m) ms.push(m);
    } else if (p.kind === 'turtle') {
      const m = member(TUR, { W: rr$1(0.62, 0.78), sp: 0.45, stage: 0, gT: rr$1(0.5, 1.5), g: 1, blinkT: rr$1(2, 5), blink: 0, head: 0 });
      if (m) {
        ms.push(m);
        p.pilots = [];
        const OFF = [[0, -0.08, 1.05], [0.42, -0.12, 0.35], [-0.45, -0.1, 0.2], [0.25, -0.3, -0.3], [-0.2, -0.28, 0.75]];
        for (let i = 0; i < NPF; i++) p.pilots.push({ k: i, o: OFF[i], p: [0, -500, 0], v: [0, 0, 0], ph: rnd() * TAU$4, sz: rr$1(0.24, 0.32), fx: 0, fy: 0, fz: 1, init: false });
      }
    }
    if (!ms.length) { p.done = true; return; }
    p.members = ms;
    if (p.kind === 'stingray') {
      let x = 0, z = 0, ok = false;
      if (p.o.spot) { const q = v3(p.o.spot, p.near); x = q[0]; z = q[2]; ok = true; }
      if (!ok && p.o.lower && L.camObj) {
        let best = 1e9;
        _pv.set(p.near[0], p.near[1], p.near[2]).project(L.camObj);
        const bx = _pv.x;
        for (let i = 0; i < 80; i++) {
          const d = -1 + 0.5 * (i % 10), lat = p.side * (0.6 + 0.4 * Math.floor(i / 10));
          const qx = p.near[0] + p.fr.fx * d + p.fr.rx * lat, qz = p.near[2] + p.fr.fz * d + p.fr.rz * lat;
          if (Math.hypot(qx - p.near[0], qz - p.near[2]) < 1.3) continue;
          _pv.set(qx, floorAt(qx, qz), qz).project(L.camObj);
          if (_pv.z > 1 || Math.abs(_pv.x) > 0.78 || _pv.y > -0.25 || _pv.y < -0.88 || (_pv.x - bx) * p.side < 0.15) continue;
          if (!sandSpot(qx, qz)) continue;
          const sc = Math.abs(_pv.y + 0.55) + 0.6 * Math.abs(_pv.x - 0.35 * p.side);
          if (sc < best) { best = sc; x = qx; z = qz; ok = true; }
        }
      }
      for (let i = 0; i < 24 && !ok; i++) {
        const d = p.dist + i * 0.6, lat = (i & 1 ? -1 : 1) * (0.8 + 0.4 * i) * (i ? 1 : 0.6);
        x = p.near[0] + p.fr.fx * d + p.fr.rx * lat; z = p.near[2] + p.fr.fz * d + p.fr.rz * lat;
        ok = sandSpot(x, z) || p.o.anywhere;
      }
      if (!ok) {
        if (p.manual) console.warn('[rare] no open sand for a stingray near', p.near.map((v) => +v.toFixed(1)));
        endPass(p);
        return;
      }
      const m = ms[0];
      m.x = x; m.z = z; m.y = floorAt(x, z);
      m.psi = rnd() * TAU$4; m.fx = Math.sin(m.psi); m.fz = Math.cos(m.psi);
      groundTone(x, z, SANDC);
      uSand.value.set(SANDC[0], SANDC[1], SANDC[2]);
      p.flushAt = Number.isFinite(p.o.flushIn) ? p.o.flushIn : null;
      p.flushR = Number.isFinite(p.o.flushR) ? p.o.flushR : 2.6;
      p.flushView = Number.isFinite(p.o.flushView) ? p.o.flushView : null;
      p.viewT = 0;
      if (p.o.glide) {
        m.st = 'skim'; m.bury = 0; m.amp = 0.07;
        buildPath(p);
        p.obs = obsNear(p);
        p.v = p.v0;
        poseAt(p, m, 0, PA, 0);
        m.x = PA[0]; m.y = PA[1]; m.z = PA[2];
        m.psi = Math.atan2(PH[0], PH[1]); m.fx = Math.sin(m.psi); m.fz = Math.cos(m.psi);
      }
    } else {
      for (let tries = 0; tries < 5; tries++) {
        buildPath(p);
        if (pathClear(p)) break;
        p.dist += 2;
      }
      p.obs = obsNear(p);
      spreadSide(p);
      if (Number.isFinite(p.o.dur) && p.o.dur > 0) p.v0 = clamp$5(p.path.len / p.o.dur, K.vmin, K.vmax);
      if (Number.isFinite(p.o.closeIn) && p.o.closeIn > 0) {
        const mid = p.path.tab[32];
        p.v0 = clamp$5(mid / p.o.closeIn, K.vmin, K.vmax);
        p.s = Math.max(0, mid - p.v0 * p.o.closeIn);
        p.closeT = p.o.closeIn;
      }
      p.track = !!p.o.track;
      p.v = p.v0;
      for (const m of ms) m.arc = m.lag;
    }
    p.active = true;
    p.t = 0;
  }
  function endPass(p) {
    if (p.done && !p.members) return;
    p.done = true;
    if (p.members) for (const m of p.members) release(m.S, m.k);
    if (p.pilots) for (const f of p.pilots) park(SMF, f.k);
    p.members = null;
    emit('exit', p.kind, { side: p.side });
  }
  const SANDC = [0.6, 0.55, 0.45];

  const set4 = (a, o, x, y, z, w) => { a[o] = x; a[o + 1] = y; a[o + 2] = z; a[o + 3] = w; };
  const live = (S, k, m) => { S.pos[k * 3] = m.x; S.pos[k * 3 + 1] = m.y; S.pos[k * 3 + 2] = m.z; S.live[k] = m.fade > 0.001 ? 1 : 0; };
  function orientTo(m, x, y, z, nx, ny, nz, dt, pm, tr = 1.3) {
    let fx = nx - x, fy = ny - y, fz = nz - z;
    const l = Math.hypot(fx, fy, fz);
    if (l < 1e-5) return;
    fx /= l; fy /= l; fz /= l;
    if (Math.abs(fy) > pm) {
      fy = Math.sign(fy) * pm;
      const h = Math.hypot(fx, fz) || 1, k = Math.sqrt(1 - fy * fy) / h;
      fx *= k; fz *= k;
    }
    let psi = Math.atan2(fx, fz);
    if (m.psi === null) m.psi = psi;
    let dp = Math.atan2(Math.sin(psi - m.psi), Math.cos(psi - m.psi));
    if (dt > 0 && Math.abs(dp) > tr * dt) {
      dp = Math.sign(dp) * tr * dt;
      psi = m.psi + dp;
      const h = Math.sqrt(1 - fy * fy);
      fx = Math.sin(psi) * h; fz = Math.cos(psi) * h;
    }
    m.psi = psi;
    if (dt > 0) m.yr += (dp / dt - m.yr) * (1 - Math.exp(-dt * 3));
    m.fx = fx; m.fy = fy; m.fz = fz;
  }
  function pathMember(p, m, dt) {
    const A = p.av;
    m.arc = p.s + m.lag;
    poseAt(p, m, m.arc, PA, A.x);
    poseAt(p, m, m.arc + 0.35, PB, A.x + (A.v * 0.35) / Math.max(fwdOf(p), 0.12));
    capTo(p, m, PA, dt);
    m.x = PA[0]; m.y = PA[1]; m.z = PA[2];
    orientTo(m, PA[0], PA[1], PA[2], PB[0], PB[1], PB[2], dt, 0.35, p.kind === 'eagleRays' ? 2.1 : 1.3);
  }
  function capTo(p, m, q, dt) {
    if (!(m.y > -400) || !(dt > 0)) return;
    const dO = p.dOff || _z3;
    const bx = m.x + dO[0], by = m.y + dO[1], bz = m.z + dO[2];
    const K = KIND[p.kind], dx = q[0] - bx, dy = q[1] - by, dz = q[2] - bz, d = Math.hypot(dx, dy, dz), c = 1.5 * K.v0 * dt;
    if (d <= c) return;
    const k = c / d;
    q[0] = bx + dx * k; q[1] = by + dy * k; q[2] = bz + dz * k;
    if (!p.track || p.locked) p.wait = Math.max(p.wait || 0, 1 - k);
  }
  const _z3 = [0, 0, 0];
  function waitFor(p, step) {
    if (p.wait > 0) { p.s -= step * Math.min(p.wait, 1); p.wait = 0; }
  }

  const SV = { lo: new Float64Array(3072), hi: new Float64Array(3072), n: 0 };
  const _sq = [0, 0, 0];
  const XMAX = 10;
  const RAY_MOVING = { lift: 1, skim: 1, settle: 1 };
  const fwdOf = (p) => Math.sqrt(Math.max(p.v * p.v - p.av.v * p.av.v, (0.0625 - 0.05 * (p.av.esc || 0)) * p.v * p.v));
  function forbid(qx, qy, qz, tx, tz, ax, ay, az, bx, by, bz, need) {
    const ux = bx - ax, uy = by - ay, uz = bz - az, uu = ux * ux + uy * uy + uz * uz;
    const k = uu > 1e-9 ? clamp$5(((qx - ax) * ux + (qy - ay) * uy + (qz - az) * uz) / uu, 0, 1) : 0;
    const rx = qx - ax - ux * k, ry = qy - ay - uy * k, rz = qz - az - uz * k;
    const ra = rx * tx + rz * tz, rl = rz * tx - rx * tz;
    const rem = need * need - ra * ra - ry * ry;
    if (rem <= 0 || SV.n >= SV.lo.length) return;
    const w = Math.sqrt(rem);
    SV.lo[SV.n] = -rl - w; SV.hi[SV.n] = -rl + w; SV.n++;
  }
  function bodyDist(x, y, z) {
    if (!KO.m) return Math.hypot(x - L.diver[0], Math.max(0, Math.abs(y - L.diver[1]) - 0.9), z - L.diver[2]) - 0.35;
    let d = 1e9;
    const C = KO.caps;
    for (let c = 0; c < KO.m * 7; c += 7) {
      const ux = C[c + 3] - C[c], uy = C[c + 4] - C[c + 1], uz = C[c + 5] - C[c + 2], uu = ux * ux + uy * uy + uz * uz;
      const k = uu > 1e-9 ? clamp$5(((x - C[c]) * ux + (y - C[c + 1]) * uy + (z - C[c + 2]) * uz) / uu, 0, 1) : 0;
      const e = Math.hypot(x - C[c] - ux * k, y - C[c + 1] - uy * k, z - C[c + 2] - uz * k) - C[c + 6];
      if (e < d) d = e;
    }
    return d;
  }
  function steer(p, dt) {
    const K = KIND[p.kind], A = p.av, ray = p.kind === 'stingray';
    SV.n = 0;
    const ahead = clamp$5(p.v * 7, 4, 9), N = 14;
    const bubTop = Math.max(KO.hy + 0.25, -0.3);
    let dB = 1e9, dL = 1e9;
    for (const m of p.members) {
      m.arc = p.s + (m.lag || 0);
      const back = p.kind === 'shark' || p.kind === 'blueShark' ? m.L * 0.5 : p.kind === 'eagleRays' ? m.W * 1.5 : p.kind === 'turtle' ? m.W * 0.6 : m.W;
      const clr = K.clear + 0.35 * (m.L || m.W || 1);
      for (let j = 0; j <= N; j++) {
        poseAt(p, m, m.arc + lerp$2(-back, ahead, j / N), _sq, 0);
        const qx = _sq[0], qy = _sq[1], qz = _sq[2], tx = PH[0], tz = PH[1];
        if (KO.m) {
          const C = KO.caps;
          for (let c = 0; c < KO.m * 7; c += 7) forbid(qx, qy, qz, tx, tz, C[c], C[c + 1], C[c + 2], C[c + 3], C[c + 4], C[c + 5], clr + C[c + 6]);
          if (L.vs > 0.15) {
            const k = Math.min(1.2, (j / N) * 1.6), ox = L.vel[0] * k, oz = L.vel[2] * k;
            for (let c = 0; c < KO.m * 7; c += 7) forbid(qx, qy, qz, tx, tz, C[c] + ox, C[c + 1], C[c + 2] + oz, C[c + 3] + ox, C[c + 4], C[c + 5] + oz, clr + C[c + 6]);
          }
        } else forbid(qx, qy, qz, tx, tz, L.diver[0], L.diver[1] - 0.9, L.diver[2], L.diver[0], L.diver[1] + 0.9, L.diver[2], clr + 0.35);
        if (K.bub > 0 && KO.helm && KO.hy < -0.5) forbid(qx, qy, qz, tx, tz, KO.hx, KO.hy + 0.25, KO.hz, KO.hx, bubTop, KO.hz, K.bub + 0.25);
        if (K.bub > 0 && KO.helm && DS.set && KO.hy < -0.5) forbid(qx, qy, qz, tx, tz, KO.hx, KO.hy + 0.3, KO.hz, DS.a[0], -0.3, DS.a[2], K.bub + 0.8);
        forbid(qx, qy, qz, tx, tz, L.cam[0], L.cam[1], L.cam[2], L.cam[0], L.cam[1], L.cam[2], K.lens);
      }
      if (m.y > -400) {
        dB = Math.min(dB, bodyDist(m.x, m.y, m.z));
        dL = Math.min(dL, Math.hypot(m.x - L.cam[0], m.y - L.cam[1], m.z - L.cam[2]));
      }
    }
    let x = A.x, lo = -XMAX, hi = XMAX, inside = false;
    for (let i = 0; i < SV.n; i++) if (SV.lo[i] < x && x < SV.hi[i]) { inside = true; break; }
    let xt = 0;
    if (inside) {
      let bl = x, bh = x, grew = true;
      while (grew) {
        grew = false;
        for (let i = 0; i < SV.n; i++) {
          if (SV.hi[i] <= bl || SV.lo[i] >= bh) continue;
          if (SV.lo[i] < bl) { bl = SV.lo[i]; grew = true; }
          if (SV.hi[i] > bh) { bh = SV.hi[i]; grew = true; }
        }
      }
      xt = x - bl < bh - x ? bl : bh;
    } else {
      for (let i = 0; i < SV.n; i++) {
        if (SV.hi[i] <= x && SV.hi[i] > lo) lo = SV.hi[i];
        if (SV.lo[i] >= x && SV.lo[i] < hi) hi = SV.lo[i];
      }
      xt = clamp$5(0, lo, hi);
    }
    xt = clamp$5(xt, -XMAX, XMAX);
    const w = dB < K.clear + 0.5 || dL < K.lens ? 4.0 : 1.5;
    A.v += (w * w * (xt - A.x) - 2 * w * A.v) * dt;
    const esc = ray ? 0 : 1 - sstep$4(K.clear - 1.2, K.clear, dB);
    const vm = 0.2 + 1.1 * p.v + 1.2 * esc;
    A.esc = esc;
    A.v = clamp$5(A.v, -vm, vm);
    A.x = clamp$5(A.x + A.v * dt, -XMAX, XMAX);
    A.dBody = dB; A.dLens = dL;
    A.boost = ray ? 1 : 1 + 0.8 * (1 - sstep$4(1.5, 5.0, dB));
  }
  function fadeOf(p, m) {
    m.d = Math.hypot(m.x - L.cam[0], m.y - L.cam[1], m.z - L.cam[2]);
    return Math.min(sstep$4(0, p.kind === 'stingray' ? 0.25 : 2.5, p.t), 1 - sstep$4(21, 24, m.d)) * p.fadeOut;
  }
  const _pp = new THREE.Vector3();
  function puff(m, k) {
    const f = floorAt(m.x, m.z);
    BIL.u.uSand.value.set(SANDC[0], SANDC[1], SANDC[2]);
    BIL.spawn(m.x, f, m.z, m.W, k);
    if (fx && fx.grains) {
      _pp.set(m.x, f + 0.02, m.z);
      fx.grains(_pp, Math.round(40 * k) + 6, { spread: m.W * 0.55, up: 0.3 * k + 0.06, ground: f });
    }
  }

  function overRock(x, z, fx, fz, W) {
    let y = -1e9;
    const fl = Math.hypot(fx, fz) || 1;
    for (let j = 0; j <= 3; j++) {
      const d = j * 0.5, ax = x + (fx / fl) * d, az = z + (fz / fl) * d, h = standsUp(ax, az, 0.5 * W + 0.2);
      if (h > 0.03) y = Math.max(y, floorAt(ax, az) + h + 0.08 - 0.5 * d);
    }
    return y;
  }
  const _rs = [0, 0, 0];
  function raySettles(p, m) {
    poseAt(p, m, p.s + fwdOf(p) / 2.5, _rs, p.av.x);
    return sandSpot(_rs[0], _rs[2]);
  }
  function rayOnward(p, m) {
    p.onward = (p.onward || 0) + 1;
    rayFleePath(p, m.x, m.z, m.fx, m.fz, 0.3);
    if (p.onward > 3) p.noSettle = true;
    p.s = 0; p.av.x = 0; p.av.v = 0;
  }

  function stepRay(p, dt) {
    const m = p.members[0], S = RAY, k = m.k;
    m.spir += TAU$4 * 0.75 * dt;
    const dDiv = Math.hypot(m.x - L.diver[0], m.y - L.diver[1], m.z - L.diver[2]);
    let freq = 1.3, amp = 0.07, lift = 1, moving = true;
    if (m.st === 'buried' || m.st === 'rest') {
      moving = false;
      m.bury += ((m.st === 'buried' ? 1 : 0.85) - m.bury) * (1 - Math.exp(-dt * 2));
      m.amp = 0;
      const vx = m.x - L.cam[0], vy = m.y - L.cam[1], vz = m.z - L.cam[2], vd = Math.hypot(vx, vy, vz) || 1;
      if (vd < 13 && (vx * L.camF[0] + vy * L.camF[1] + vz * L.camF[2]) / vd > 0.75) p.viewT += dt;
      const go = (m.st === 'buried' && p.flushAt !== null && p.t >= p.flushAt) || dDiv < (m.st === 'rest' ? 2.3 : p.flushR) ||
        (m.st === 'buried' && p.flushView !== null && p.viewT >= p.flushView);
      if (go) {
        let ax = m.x - L.diver[0], az = m.z - L.diver[2];
        if (Math.hypot(ax, az) < 0.8) { ax = p.fr.fx; az = p.fr.fz; }
        if (p.o.flee === 'deep') {
          const al = Math.hypot(ax, az) || 1;
          rayFleePath(p, m.x, m.z, p.fr.fx * 0.8 + (ax / al) * 0.2, p.fr.fz * 0.8 + (az / al) * 0.2, 0.3);
        } else rayFleePath(p, m.x, m.z, ax * 0.6 + p.fr.fx * 0.4, az * 0.6 + p.fr.fz * 0.4);
        m.st = 'lift'; m.lt = 0; m.puffed = false; p.s = 0; p.v = 0; p.av.x = 0; p.av.v = 0;
        puff(m, 1);
        emit('lift', 'stingray', { side: p.side });
      }
    }
    if (m.st === 'settle' && m.lt < 0.6 && standsUp(m.x, m.z, 0.5 * m.W + 0.1) > 0.03) {
      const l1 = 1 - sstep$4(0, 1.0, m.lt);
      let lo = 0.05, hi = 1.2;
      for (let i = 0; i < 12; i++) { const mid = 0.5 * (lo + hi); if (sstep$4(0.05, 1.2, mid) < l1) lo = mid; else hi = mid; }
      m.st = 'lift'; m.lt = 0.5 * (lo + hi);
      rayOnward(p, m);
    }
    if (m.st === 'lift') {
      m.lt += dt;
      m.bury = Math.min(m.bury, 1 - sstep$4(0, 0.7, m.lt));
      freq = 2.5; amp = 0.1 - 0.03 * sstep$4(0.6, 1.3, m.lt);
      lift = sstep$4(0.05, 1.2, m.lt);
      p.v += (p.v0 * 0.9 - p.v) * (1 - Math.exp(-dt * 2));
      p.s += fwdOf(p) * dt;
      if (m.lt > 1.3) m.st = 'skim';
    } else if (m.st === 'skim') {
      freq = 1.3 * clamp$5(p.v / 0.5, 0.7, 1.4); amp = 0.07;
      p.v += (p.v0 - p.v) * (1 - Math.exp(-dt));
      p.s += fwdOf(p) * dt;
      if (p.noSettle && p.s >= p.path.len * 0.8) p.fadeGo = true;
      else if (p.s >= p.path.len) {
        if (raySettles(p, m)) {
          m.st = 'settle'; m.lt = 0;
          groundTone(m.x, m.z, SANDC);
          uSand.value.set(SANDC[0], SANDC[1], SANDC[2]);
        } else rayOnward(p, m);
      }
    } else if (m.st === 'settle') {
      m.lt += dt;
      p.v *= Math.exp(-dt * 2.5);
      p.s += fwdOf(p) * dt;
      freq = 3.0; amp = 0.035 * (1 - sstep$4(1.4, 2.2, m.lt)) + 0.01;
      lift = 1 - sstep$4(0, 1.0, m.lt);
      m.bury = 0.85 * sstep$4(0.6, 2.0, m.lt);
      if (m.lt > 0.7 && !m.puffed) { puff(m, 0.35); m.puffed = true; }
      if (m.lt > 2.2) { m.st = 'rest'; p.restT = 0; }
    }
    m.amp += (amp - m.amp) * (1 - Math.exp(-dt * 4));
    if (moving) {
      const A = p.av;
      poseAt(p, m, p.s, PA, A.x);
      poseAt(p, m, p.s + 0.3, PB, A.x + (A.v * 0.3) / Math.max(fwdOf(p), 0.12));
      const f0 = floorAt(PA[0], PA[2]), yPlan = PA[1];
      PA[1] = lerp$2(f0 - 0.004, yPlan, lift);
      if (m.st !== 'settle') PA[1] = Math.max(PA[1], overRock(PA[0], PA[2], m.fx, m.fz, m.W));
      capTo(p, m, PA, dt);
      waitFor(p, fwdOf(p) * dt);
      m.x = PA[0]; m.z = PA[2]; m.y = PA[1];
      orientTo(m, PA[0], PA[1], PA[2], PB[0], PA[1] + (PB[1] - yPlan) * lift, PB[2], dt, 0.14);
    } else {
      m.y = floorAt(m.x, m.z) - 0.004;
      m.fy = 0;
      const l = Math.hypot(m.fx, m.fz) || 1;
      m.fx /= l; m.fz /= l;
      m.yr *= Math.exp(-dt * 3);
    }
    m.ph += TAU$4 * freq * dt;
    m.ph2 += TAU$4 * freq * 0.5 * dt;
    m.bank += (clamp$5(-m.yr * 0.5, -0.25, 0.25) * (moving ? 1 : 0) - m.bank) * (1 - Math.exp(-dt * 2));
    m.fade = fadeOf(p, m);
    writeMatrix(S.mesh.instanceMatrix.array, k * 16, m.fx, m.fy, m.fz, m.bank, m.W, m.W, m.W, m.x, m.y, m.z);
    set4(S.attrs.aRS.array, k * 4, m.ph, m.amp, clamp$5(m.yr * 0.8, -1, 1), m.bury);
    set4(S.attrs.aRX.array, k * 4, m.ph2, m.spir, m.seed, m.fade);
    live(S, k, m);
    if (m.st === 'rest') { p.restT += dt; if (m.d > 26 || p.restT > 120) endPass(p); }
    else if (m.st === 'buried' && p.t > 90 && m.d > 20) endPass(p);
  }

  function stepShark(p, dt) {
    const m = p.members[0], S = SHK, k = m.k, bo = p.av.boost;
    p.v += (p.v0 * bo * (1 + 0.05 * Math.sin(m.ph * 2)) - p.v) * (1 - Math.exp(-dt * (0.5 + 6 * (bo - 1))));
    const step = fwdOf(p) * dt;
    p.s += step;
    pathMember(p, m, dt);
    waitFor(p, step);
    m.ph += TAU$4 * (p.v / (0.65 * m.L)) * dt;
    m.bank += (clamp$5(-m.yr * 0.35, -0.17, 0.17) - m.bank) * (1 - Math.exp(-dt * 2));
    m.fade = fadeOf(p, m);
    let fy = m.fy + 0.035;
    const l = Math.hypot(m.fx, fy, m.fz);
    writeMatrix(S.mesh.instanceMatrix.array, k * 16, m.fx / l, fy / l, m.fz / l, m.bank, m.L * (m.blue ? 0.82 : 1), m.L * (m.blue ? 0.86 : 1), m.L, m.x, m.y, m.z);
    set4(S.attrs.aS.array, k * 4, m.ph, 1, clamp$5(m.yr * 0.9, -0.25, 0.25), m.fade);
    set4(S.attrs.aSh.array, k * 4, m.dK, m.pK, m.blue ? 1 : 0, m.seed);
    live(S, k, m);
    TH.on = m.fade > 0.05; TH.x = m.x; TH.y = m.y; TH.z = m.z; TH.r = 7;
    if (p.s > p.path.len + (Number.isFinite(p.o.angle) ? 12 : 2) || (p.s > p.path.len * 0.6 && m.d > 24.5)) endPass(p);
  }

  function stepEagles(p, dt) {
    let flapping = 0;
    for (const m of p.members) if (m.flap) flapping++;
    p.v += (p.v0 * p.av.boost * (flapping * 2 >= p.members.length ? 1.1 : 0.88) - p.v) * (1 - Math.exp(-dt * 0.7));
    const step = fwdOf(p) * dt;
    p.s += step;
    let far = true;
    for (const m of p.members) {
      const S = EAG, k = m.k;
      pathMember(p, m, dt);
      const prev = m.ph;
      m.ph += TAU$4 * (0.55 + 0.25 * clamp$5((p.v - 0.7) / 0.6, 0, 1)) * dt;
      if (m.flap) {
        if (Math.floor(m.ph / TAU$4) !== Math.floor(prev / TAU$4) && --m.beats <= 0) { m.flap = false; m.gT = rr$1(1.4, 3.4); }
      } else if ((m.gT -= dt) <= 0) { m.flap = true; m.beats = 3 + Math.floor(rnd() * 5); }
      m.TH += ((m.flap ? EA_AMP : 0.03) - m.TH) * (1 - Math.exp(-dt * 3));
      m.droop += ((m.flap ? 0 : 0.22) - m.droop) * (1 - Math.exp(-dt * 1.5));
      m.bank += (clamp$5(-m.yr * 1.6, -0.6, 0.6) - m.bank) * (1 - Math.exp(-dt * 2.5));
      m.fade = fadeOf(p, m);
      if (m.arc < p.path.len + 1 || m.d < 24) far = false;
      writeMatrix(S.mesh.instanceMatrix.array, k * 16, m.fx, m.fy, m.fz, m.bank, m.W, m.W, m.W, m.x, m.y, m.z);
      set4(S.attrs.aE.array, k * 4, m.ph, m.TH, clamp$5(m.yr * 0.5, -0.3, 0.3), m.droop);
      set4(S.attrs.aEX.array, k * 4, m.ph * 0.8 + m.seed * 5, m.seed, m.fade, 0);
      live(S, k, m);
    }
    waitFor(p, step);
    if (far) endPass(p);
  }

  const TP = [0, 0, 0], GLIDE = [-7 * DEG$2, -0.98, 0.1];
  function turtlePose(sp, out) {
    const e = (x) => x * x * (3 - 2 * x);
    if (sp < 0.4) { out[0] = lerp$2(12 * DEG$2, -44 * DEG$2, e(sp / 0.4)); out[2] = 0.5 * Math.sin((Math.PI * sp) / 0.4); }
    else { out[0] = lerp$2(-44 * DEG$2, 12 * DEG$2, e((sp - 0.4) / 0.6)); out[2] = -0.35 * Math.sin((Math.PI * (sp - 0.4)) / 0.6); }
    out[1] = 0.16 + 0.33 * Math.cos(TAU$4 * (sp - 0.12));
    return out;
  }
  function stepTurtle(p, dt) {
    const m = p.members[0], S = TUR, k = m.k;
    if (m.stage === 0) { m.g += (1 - m.g) * (1 - Math.exp(-dt * 4)); if ((m.gT -= dt) <= 0) { m.stage = 1; m.sp = 0.45; } }
    else if (m.stage === 1) { m.sp += dt * 0.69; m.g *= Math.exp(-dt * 5); if (m.sp >= 1) { m.sp -= 1; m.stage = 2; } }
    else { m.sp += dt * 0.82; m.g *= Math.exp(-dt * 5); if (m.sp >= 0.45) { m.sp = 0.45; m.stage = 0; m.gT = rr$1(1.0, 2.2); } }
    turtlePose(m.sp, TP);
    const E = lerp$2(TP[0], GLIDE[0], m.g), P = lerp$2(TP[1], GLIDE[1], m.g), Q = lerp$2(TP[2], GLIDE[2], m.g);
    p.v += (p.v0 * p.av.boost * (m.stage === 2 ? 1.3 : m.stage === 0 ? 0.88 : 0.95) - p.v) * (1 - Math.exp(-dt * 1.2));
    const step = fwdOf(p) * dt;
    p.s += step;
    pathMember(p, m, dt);
    waitFor(p, step);
    let lx = m.fz, lz = -m.fx;
    const ll = Math.hypot(lx, lz) || 1;
    lx /= ll; lz /= ll;
    const qx = L.diver[0] - m.x, qz = L.diver[2] - m.z, qd = Math.hypot(qx, qz) || 1;
    const look = clamp$5(Math.atan2(qx * lx + qz * lz, qx * m.fx + qz * m.fz), -0.45, 0.45) * sstep$4(9, 5, qd);
    m.head += (look + 0.18 * Math.sin(L.t * 0.35 + m.seed * 9) - m.head) * (1 - Math.exp(-dt * 1.5));
    if ((m.blinkT -= dt) <= 0) { m.blinkT = rr$1(2.5, 6); m.bl = 0; }
    if (m.bl !== undefined && m.bl < 0.25) { m.bl += dt; m.blink = Math.sin((m.bl / 0.25) * Math.PI); } else m.blink = 0;
    m.bank += (clamp$5(-m.yr * 0.8, -0.35, 0.35) - m.bank) * (1 - Math.exp(-dt * 2));
    m.fade = fadeOf(p, m);
    writeMatrix(S.mesh.instanceMatrix.array, k * 16, m.fx, m.fy, m.fz, m.bank, m.W, m.W, m.W, m.x, m.y, m.z);
    set4(S.attrs.aT0.array, k * 4, E, P, Q, m.head);
    set4(S.attrs.aT1.array, k * 4, -0.08 + 0.12 * Math.sin(TAU$4 * m.sp + 1) * (1 - m.g), clamp$5(-m.yr * 0.8, -0.35, 0.35), m.blink, m.fade);
    live(S, k, m);
    const ux = m.fy * lz, uy = m.fz * lx - m.fx * lz, uz = -m.fy * lx;
    const hv = [m.fx * p.v, m.fy * p.v, m.fz * p.v];
    for (const f of p.pilots) {
      const w = m.W * 1.3, o = f.o, wob = 0.08 * Math.sin(L.t * 0.9 + f.ph * 3);
      const tx = m.x + (lx * (o[0] + wob) + ux * o[1] + m.fx * o[2]) * w;
      const ty = m.y + (uy * o[1] + m.fy * o[2]) * w + 0.05 * Math.sin(L.t * 0.7 + f.ph);
      const tz = m.z + (lz * (o[0] + wob) + uz * o[1] + m.fz * o[2]) * w;
      if (!f.init) { f.p = [tx, ty, tz]; f.v = hv.slice(); f.init = true; }
      const dO = p.dOff || [0, 0, 0];
      f.p[0] += dO[0]; f.p[1] += dO[1]; f.p[2] += dO[2];
      const T = [tx, ty, tz];
      for (let i = 0; i < 3; i++) { f.v[i] += ((T[i] - f.p[i]) * 5 - (f.v[i] - hv[i]) * 3.2) * dt; f.p[i] += f.v[i] * dt; }
      const sp = Math.hypot(f.v[0], f.v[1], f.v[2]);
      let hx = m.fx, hy = m.fy, hz = m.fz;
      if (sp > 0.05) { const b = clamp$5(sp / 0.6, 0, 1); hx = lerp$2(hx, f.v[0] / sp, b); hy = lerp$2(hy, f.v[1] / sp, b) * 0.5; hz = lerp$2(hz, f.v[2] / sp, b); }
      const hl = Math.hypot(hx, hy, hz) || 1;
      f.ph += TAU$4 * (2.4 + 3.5 * sp) * dt;
      writeMatrix(SMF.mesh.instanceMatrix.array, f.k * 16, hx / hl, hy / hl, hz / hl, 0, f.sz, f.sz, f.sz, f.p[0], f.p[1], f.p[2]);
      set4(SMF.attrs.aF.array, f.k * 4, f.ph, 0.07, 0, m.fade);
      SMF.pos[f.k * 3] = f.p[0]; SMF.pos[f.k * 3 + 1] = f.p[1]; SMF.pos[f.k * 3 + 2] = f.p[2]; SMF.live[f.k] = m.fade > 0.001 ? 1 : 0;
    }
    if (p.s > p.path.len + (Number.isFinite(p.o.angle) ? 12 : 2) || (p.s > p.path.len * 0.6 && m.d > 24.5)) endPass(p);
  }

  const _tf = { fx: 0, fz: -1, rx: 1, rz: 0 }, _tc = [0, 0, 0], _td = [0, 0, 0];
  function framedNow(p) {
    p.path.point(0.5, _fq);
    viewFor(p);
    return frameCost(p, _fq, KIND[p.kind].big ? 2 : 0.7) < 0.08;
  }
  function retrack(p, dt) {
    let dmin = 1e9;
    for (const m of p.members) if (m.d !== undefined && m.d < dmin) dmin = m.d;
    const left = Number.isFinite(p.closeT) ? p.closeT - p.t : 99;
    const past = p.s > p.path.tab[32] + 2;
    if (((dmin < 6.5 && p.t > 0.3) || left < 0.8 || (L.still > 0.4 && dmin < 14 && L.state === 'dive')) && (past || framedNow(p))) { p.locked = true; p.obs = obsNear(p); return; }
    _tc[0] = L.cam[0] - p.off[0]; _tc[1] = L.cam[1] - p.off[1]; _tc[2] = L.cam[2] - p.off[2];
    _td[0] = L.diver[0] - p.off[0]; _td[1] = L.diver[1] - p.off[1]; _td[2] = L.diver[2] - p.off[2];
    frameOf(_td, _tc, _tf);
    const tau = dmin > 13 ? 0.3 : 0.4;
    const a0 = Math.atan2(p.fr.fx, p.fr.fz), da = Math.atan2(_tf.fx * p.fr.fz - _tf.fz * p.fr.fx, _tf.fx * p.fr.fx + _tf.fz * p.fr.fz);
    const a = a0 + da * (1 - Math.exp(-dt / tau));
    p.fr.fx = Math.sin(a); p.fr.fz = Math.cos(a); p.fr.rx = -p.fr.fz; p.fr.rz = p.fr.fx;
    p.cam[0] = _tc[0]; p.cam[1] = _tc[1]; p.cam[2] = _tc[2];
    if (p.o.side === 'open' && dmin > 22.5) p.side = openSide(p);
    const mid0 = p.path.tab[32];
    buildPath(p);
    spreadSide(p);
    p.s += p.path.tab[32] - mid0;
    if (Number.isFinite(p.closeT)) {
      const K = KIND[p.kind];
      p.v0 = clamp$5((p.path.tab[32] - p.s) / Math.max(left, 0.5), K.vmin, K.vmax);
    }
  }
  function stepPass(p, dt) {
    p.t += dt;
    const dO = p.dOff || (p.dOff = [0, 0, 0]);
    dO[0] = dO[1] = dO[2] = 0;
    if (p.carry > 0.001) {
      const dy = L.cam[1] - p.lf[1];
      if (Math.abs(dy) < 4 * dt) { dO[1] = dy * p.carry; p.off[1] += dO[1]; }
      if (L.state !== 'dive') p.carry *= Math.exp(-dt * 1.5);
    }
    p.lf[0] = L.cam[0]; p.lf[1] = L.cam[1]; p.lf[2] = L.cam[2];
    if (p.sprT !== undefined && p.spr !== p.sprT) p.spr += clamp$5(p.sprT - p.spr, -dt / 1.5, dt / 1.5);
    if (p.fadeGo) { p.fadeOut -= dt / 1.5; if (p.fadeOut <= 0) { endPass(p); return; } }
    if (p.track && p.locked && p.carry > 0.001 && p.members && p.s < p.path.tab[32] && ((p.rechk = (p.rechk || 0) + dt) > 0.25)) {
      p.rechk = 0;
      let dmin = 1e9;
      for (const m of p.members) if (m.d !== undefined && m.d < dmin) dmin = m.d;
      if (dmin > 20 && !framedNow(p)) p.locked = false;
    }
    if (p.track && !p.locked && p.members && p.kind !== 'stingray') retrack(p, dt);
    if (p.members && (p.kind !== 'stingray' || RAY_MOVING[p.members[0].st])) steer(p, dt);
    if (p.kind === 'stingray') stepRay(p, dt);
    else if (p.kind === 'eagleRays') stepEagles(p, dt);
    else if (p.kind === 'turtle') stepTurtle(p, dt);
    else stepShark(p, dt);
    if (p.done || !p.members) return;
    let d = 1e9;
    for (const m of p.members) if (m.d < d) d = m.d;
    if (!p.entered && d < 20) { p.entered = true; emit('enter', p.kind, { side: p.side, dist: d }); }
    if (p.entered && !p.closest && d > p.dmin + 0.3) { p.closest = true; emit('closest', p.kind, { side: p.side, dist: p.dmin }); }
    if (d < p.dmin) p.dmin = d;
    if (p.t > 200) endPass(p);
  }

  function jellyMatrix(m, k, x, y, z, s, yaw, t, ph, vx, vz) {
    let ux = 0.1 * Math.sin(t * 0.37 + ph * 4) + vx * 1.5, uy = 1, uz = 0.1 * Math.cos(t * 0.29 + ph * 3) + vz * 1.5;
    const ul = Math.hypot(ux, uy, uz);
    ux /= ul; uy /= ul; uz /= ul;
    const sx = Math.sin(yaw), cz = Math.cos(yaw);
    let xx = uy * cz, xy = uz * sx - ux * cz, xz = -uy * sx;
    const xl = Math.hypot(xx, xy, xz) || 1;
    xx /= xl; xy /= xl; xz /= xl;
    const zx = xy * uz - xz * uy, zy = xz * ux - xx * uz, zz = xx * uy - xy * ux, o = k * 16;
    m[o] = xx * s; m[o + 1] = xy * s; m[o + 2] = xz * s; m[o + 3] = 0;
    m[o + 4] = ux * s; m[o + 5] = uy * s; m[o + 6] = uz * s; m[o + 7] = 0;
    m[o + 8] = zx * s; m[o + 9] = zy * s; m[o + 10] = zz * s; m[o + 11] = 0;
    m[o + 12] = x; m[o + 13] = y; m[o + 14] = z; m[o + 15] = 1;
  }
  const JQ = [0, 0, 1e9];
  function segAway(x, y, z, ax, ay, az, bx, by, bz, r) {
    const ux = bx - ax, uy = by - ay, uz = bz - az, uu = ux * ux + uy * uy + uz * uz;
    const k = uu > 1e-9 ? clamp$5(((x - ax) * ux + (y - ay) * uy + (z - az) * uz) / uu, 0, 1) : 0;
    const ex = x - ax - ux * k, ey = y - ay - uy * k, ez = z - az - uz * k, d = Math.hypot(ex, ey, ez) - r;
    if (d < JQ[2]) { const h = Math.hypot(ex, ez) || 1e-4; JQ[0] = ex / h; JQ[1] = ez / h; JQ[2] = d; }
  }
  function clearJelly(Jn, k, dt, T) {
    const s = Jn.s[k], x = Jn.x[k], z = Jn.z[k], top = Jn.y[k] + 0.3 * s, bot = Jn.y[k] - T.tl * s;
    const need = 0.3 + 0.5 * s + 0.35 * T.tl * s;
    JQ[2] = 1e9;
    for (let j = 0; j < 4; j++) {
      const y = top + (bot - top) * (j / 3);
      if (KO.m) { const C = KO.caps; for (let c = 0; c < KO.m * 7; c += 7) segAway(x, y, z, C[c], C[c + 1], C[c + 2], C[c + 3], C[c + 4], C[c + 5], C[c + 6]); }
      if (KO.helm && KO.hy < -0.5) {
        segAway(x, y, z, KO.hx, KO.hy + 0.25, KO.hz, KO.hx, -0.3, KO.hz, 0.3);
        if (DS.set) segAway(x, y, z, KO.hx, KO.hy + 0.3, KO.hz, DS.a[0], -0.3, DS.a[2], 0.1);
      }
    }
    const room = need + 1.2;
    if (JQ[2] < room) {
      const push = Math.min(room - JQ[2], (0.25 + 1.5 * (1 - Math.max(JQ[2], 0) / room)) * dt);
      Jn.x[k] += JQ[0] * push; Jn.z[k] += JQ[1] * push;
    }
  }
  function stepJellies(dt, t, Jn, JM, n, lo, hi, wrap, T) {
    const m = JM.mesh.instanceMatrix.array, fa = JM.aJ.array, cx = L.cam[0], cy = L.cam[1], cz = L.cam[2];
    let shown = 0;
    for (let k = 0; k < n; k++) {
      const pu = t / Jn.per[k] + Jn.ph[k], pf = pu - Math.floor(pu);
      const thr = sstep$4(0, 0.08, pf) * (1 - sstep$4(0.08, 0.32, pf));
      const ty = Jn.ty[k] + 0.8 * Math.sin(t * 0.05 + Jn.ph[k] * 7);
      Jn.vy[k] += (thr * 0.5 - 0.07 + (ty - Jn.y[k]) * 0.03 - Jn.vy[k] * 1.2) * dt;
      Jn.y[k] = clamp$5(Jn.y[k] + Jn.vy[k] * dt, Jn.lo[k] || lo, Jn.hi[k] || hi);
      Jn.hd[k] += Math.sin(t * 0.13 + Jn.ph[k] * 9.1) * 0.25 * dt;
      const sp = 0.04 + 0.05 * thr;
      let vx = Math.cos(Jn.hd[k]) * sp + 0.03, vz = Math.sin(Jn.hd[k]) * sp + 0.02;
      Jn.x[k] += vx * dt; Jn.z[k] += vz * dt;
      Jn.age[k] += dt;
      if (wrap) {
        const dx = Jn.x[k] - cx, dz = Jn.z[k] - cz, dh = Math.hypot(dx, dz);
        if (dh > T.far + 0.5 && (!Jn.line[k] || L.state !== 'dive')) {
          const a = rnd() * TAU$4, r = T.ring[0] + (T.ring[1] - T.ring[0]) * Math.sqrt(rnd());
          Jn.x[k] = cx + Math.cos(a) * r; Jn.z[k] = cz + Math.sin(a) * r;
          Jn.line[k] = 0; Jn.lo[k] = 0; Jn.hi[k] = 0;
          Jn.y[k] = Jn.ty[k] = lerp$2(lo + 1, hi - 1, rnd());
          Jn.age[k] = 0;
        }
      }
      const qx = Jn.x[k] - cx, qy = Jn.y[k] - cy, qz = Jn.z[k] - cz, qd = Math.hypot(qx, qy, qz), keep = T.keep + 2 * Jn.s[k];
      if (qd < keep && qd > 1e-4) {
        const hq = Math.hypot(qx, qz) || 1e-4, push = Math.min(keep - qd, (0.3 + 1.2 * (1 - qd / keep)) * dt);
        Jn.x[k] += (qx / hq) * push; Jn.z[k] += (qz / hq) * push;
      }
      if (L.state === 'dive' || KO.m) clearJelly(Jn, k, dt, T);
      const fade = Math.min(1 - sstep$4(T.near, T.far, qd), sstep$4(0, 2, Jn.age[k]), sstep$4(keep * 0.3, keep * 0.55, qd));
      Jn.yaw[k] += (k & 1 ? 0.08 : -0.08) * dt;
      fa[k * 4 + 3] = fade;
      if (fade > 0.001) shown++;
      jellyMatrix(m, k, Jn.x[k], Jn.y[k], Jn.z[k], fade > 0.001 ? Jn.s[k] : 1e-5, Jn.yaw[k], t, Jn.ph[k], vx, vz);
    }
    JM.mesh.instanceMatrix.needsUpdate = true;
    JM.aJ.needsUpdate = true;
    JM.mesh.visible = JM.fill.visible = shown > 0;
    JM.shown = shown;
  }
  function stepJuveniles(dt, t) {
    const S = SMF;
    for (let j = 0; j < NRH; j++) {
      const sj = RJ.s[j], jx = RJ.x[j], jy = RJ.y[j], jz = RJ.z[j];
      const near = Math.hypot(jx - L.cam[0], jy - L.cam[1], jz - L.cam[2]) < 15;
      for (let q = 0; q < NJUV; q++) {
        const i = j * NJUV + q, k = NPF + i;
        if (!near) { if (S.live[k]) park(S, k); continue; }
        JV.a[i] += JV.w[i] * dt;
        JV.dart[i] -= dt;
        if (JV.dart[i] < -1.2) JV.dart[i] = rr$1(3, 9);
        const inn = JV.dart[i] < 0 ? Math.sin((-JV.dart[i] / 1.2) * Math.PI) : 0;
        const r = sj * (JV.r[i] * (1 - 0.75 * inn) + 0.05 * Math.sin(t * 1.3 + i));
        const a = JV.a[i], h = sj * (JV.h[i] + 0.06 * Math.sin(t * 0.9 + i * 1.7));
        const x = jx + Math.cos(a) * r, y = jy + h, z = jz + Math.sin(a) * r;
        const o = i * 3;
        let fx = -Math.sin(a) * Math.sign(JV.w[i]), fz = Math.cos(a) * Math.sign(JV.w[i]), fy = 0;
        if (inn > 0) { fx = lerp$2(fx, -Math.cos(a), inn * 0.6); fz = lerp$2(fz, -Math.sin(a), inn * 0.6); }
        const fl = Math.hypot(fx, fy, fz) || 1;
        JV.px[o] = x; JV.px[o + 1] = y; JV.px[o + 2] = z;
        JV.ph[i] += TAU$4 * (5 + 6 * inn) * dt;
        const sz = 0.035 + 0.02 * ((i * 0.618) % 1);
        writeMatrix(S.mesh.instanceMatrix.array, k * 16, fx / fl, fy / fl, fz / fl, 0, sz, sz, sz, x, y, z);
        set4(S.attrs.aF.array, k * 4, JV.ph[i], 0.09, 1, 1);
        S.pos[k * 3] = x; S.pos[k * 3 + 1] = y; S.pos[k * 3 + 2] = z; S.live[k] = 1;
      }
    }
  }

  function tiers() {
    const warm = L.state === '' || L.state === 'loading' || L.state === 'title';
    for (const S of [...BIG, SMF]) {
      let dmin = 1e9, any = false;
      for (let k = 0; k < S.count; k++) {
        if (!S.live[k]) continue;
        any = true;
        const d = Math.hypot(S.pos[k * 3] - L.cam[0], S.pos[k * 3 + 1] - L.cam[1], S.pos[k * 3 + 2] - L.cam[2]);
        if (d < dmin) dmin = d;
      }
      S.mesh.visible = any && dmin < 26;
      S.mesh.castShadow = S !== SMF && quality >= 0.75 && (dmin < 8 || warm);
      S.U.uRDetail.value = 1 - sstep$4(8, 18, dmin);
      S.dmin = dmin;
      if (any) {
        S.mesh.instanceMatrix.needsUpdate = true;
        for (const nm in S.attrs) S.attrs[nm].needsUpdate = true;
      }
    }
  }

  const BED = { first: [35, 80], pFirst: 0.33, next: [120, 240], pNext: 0.5 };
  const AUTO = { on: true, diveRolled: false, plan: null, bedT: rr$1(BED.first[0], BED.first[1]), bedN: 0, last: '', manual: false, force: null };
  try {
    const q = new URLSearchParams(location.search).get('rare') || new URLSearchParams(location.hash.slice(1)).get('rare');
    if (q && (q === 'none' || q === 'midShark' || KIND[q])) AUTO.force = q;
  } catch (e) {  }
  function rollDescent() {
    const f = AUTO.force;
    if (f) return f === 'none' ? null : f === 'midShark' ? { mid: 'blueShark', bed: null } : f === 'turtle' ? { mid: 'turtle', bed: null } : { mid: null, bed: f };
    const r = rnd();
    if (r < 0.4) { const q = rnd(); return { mid: null, bed: q < 0.4 ? 'stingray' : q < 0.72 ? (rnd() < 0.7 ? 'shark' : 'blueShark') : 'eagleRays' }; }
    if (r < 0.65) return { mid: rnd() < 0.65 ? 'blueShark' : 'turtle', bed: rnd() < 0.33 ? 'stingray' : null };
    return null;
  }
  function stepPlan() {
    const P = AUTO.plan, B = DS.set ? DS.b : L.diver;
    const fB = floorAt(B[0], B[2]), hd = L.diver[1] - fB, hb = Math.max(0, hd - 1.0);
    const at = [B[0], fB + 1.5, B[2]];
    const land = hb / 1.6 + 0.6;
    if (P.mid && !P.midH && L.cam[1] < -0.6 && hb > 8) {
      const tu = P.mid === 'turtle';
      P.midH = schedule(P.mid, { near: L.diver, camera: L.cam, carry: 1, angle: frameAngle() * (tu ? 1.1 : 1), lensDist: tu ? 6.5 : 7.5, side: 'open', enter: 'side', track: true, closeIn: 5.5, depth: Math.min(L.diver[1] + (tu ? -0.6 : 0.9), tu ? -3 : -2.5), auto: true });
    }
    if (!P.kind) { if (P.midH || !P.mid || hb <= 8) AUTO.plan = null; return; }
    if (P.kind === 'stingray') {
      if (hb < 3.2 && (L.still > 0.2 || hb < 0.4)) {
        schedule('stingray', { near: [B[0], fB, B[2]], camera: L.cam, lower: true, side: 'open', flee: 'deep', dist: rr$1(2.5, 3.5), flushIn: 0.3, flushR: 1.4, auto: true });
        AUTO.plan = null;
      }
    } else {
      if (!P.h) P.h = schedule(P.kind, { near: at, camera: L.cam, angle: frameAngle(), lensDist: P.kind === 'eagleRays' ? 7 : 6.5, side: 'open', track: true, closeIn: land + 0.8, auto: true });
      else if (hb > 0.2) P.h.retime(land + 0.8);
      if (P.h.done || hb <= 0.2) AUTO.plan = null;
    }
  }
  function frameAngle() {
    const c = L.camObj;
    if (!c || !c.isPerspectiveCamera) return 26;
    const half = Math.atan(Math.tan((c.fov * DEG$2) / 2) * (c.aspect || 1.5)) / DEG$2;
    return clamp$5(0.62 * half, 9, 31) * rr$1(0.95, 1.05);
  }
  const QUIET = { clean: 1, assemble: 1, crank: 1, eclipse: 1, end: 1 };
  function spawnBed() {
    const W = [['stingray', 45], ['eagleRays', 30], ['turtle', 12], ['shark', 8], ['blueShark', 5]].filter((w) => w[0] !== AUTO.last);
    let r = rnd() * W.reduce((a, w) => a + w[1], 0), kind = W[0][0];
    for (const w of W) { if ((r -= w[1]) <= 0) { kind = w[0]; break; } }
    AUTO.last = kind;
    const o = { near: L.diver, camera: L.cam, auto: true };
    if (kind === 'stingray') {
      if (rnd() < 0.7) { o.dist = rr$1(5, 7); o.flushView = rr$1(4, 8); } else o.glide = true;
    } else if (kind === 'turtle') o.depth = Math.min(L.diver[1] + rr$1(3, 5), -3);
    schedule(kind, o);
  }
  function autoStep(dt) {
    if (!AUTO.on) return;
    if (L.state === 'dive') {
      if (!AUTO.diveRolled && L.cam[1] < -1) {
        AUTO.diveRolled = true;
        if (!AUTO.manual) { const k = rollDescent(); if (k) AUTO.plan = { kind: k.bed, mid: k.mid }; }
      }
      if (AUTO.plan) stepPlan();
    } else if (L.state === 'explore') {
      AUTO.plan = null;
      if (busy()) return;
      if ((AUTO.bedT -= dt) <= 0) {
        if (rnd() < (AUTO.bedN ? BED.pNext : BED.pFirst)) spawnBed();
        AUTO.bedN++;
        AUTO.bedT = rr$1(BED.next[0], BED.next[1]);
      }
    }
  }
  const busy = () => passes.some((p) => !p.done && (KIND[p.kind].big || (p.members && p.members[0].st !== 'rest')));

  const _cd = new THREE.Vector3();
  function update(dt, t, pl) {
    if (!(dt > 0)) return;
    if (dt > 0.05) dt = 0.05;
    L.t = Number.isFinite(t) ? t : L.t + dt;
    U_J.uRTime.value = L.t;
    if (pl && typeof pl.state === 'string') L.state = pl.state;
    const cam = pl && pl.camera;
    if (cam && cam.position && Number.isFinite(cam.position.x + cam.position.y + cam.position.z)) {
      const sp = Math.hypot(cam.position.x - L.cam[0], cam.position.y - L.cam[1], cam.position.z - L.cam[2]) / dt;
      L.camV += (Math.min(sp, 20) - L.camV) * (1 - Math.exp(-dt / 0.15));
      L.still = L.camV < 0.3 ? L.still + dt : 0;
      L.cam[0] = cam.position.x; L.cam[1] = cam.position.y; L.cam[2] = cam.position.z;
      if (cam.getWorldDirection) {
        cam.getWorldDirection(_cd);
        const tw = Math.atan2(L.camF[0] * _cd.z - L.camF[2] * _cd.x, L.camF[0] * _cd.x + L.camF[2] * _cd.z) / dt;
        if (Number.isFinite(tw) && Math.abs(tw) < 20) L.turn += (tw - L.turn) * (1 - Math.exp(-dt / 0.5));
        L.camF[0] = _cd.x; L.camF[1] = _cd.y; L.camF[2] = _cd.z;
      }
      if (cam.isCamera) L.camObj = cam;
    } else if (pl && pl.position && Number.isFinite(pl.position.x + pl.position.y + pl.position.z)) {
      L.cam[0] = pl.position.x; L.cam[1] = pl.position.y; L.cam[2] = pl.position.z;
    }
    const d0x = L.diver[0], d0z = L.diver[2];
    if (KO.n) { L.diver[0] = KO.x; L.diver[1] = KO.y; L.diver[2] = KO.z; }
    else if (pl && pl.position && Number.isFinite(pl.position.x + pl.position.y + pl.position.z)) { L.diver[0] = pl.position.x; L.diver[1] = pl.position.y; L.diver[2] = pl.position.z; }
    {
      const pv = pl && pl.velocity, ok = pv && Number.isFinite(pv.x + pv.z) && Math.hypot(pv.x, pv.z) > 0.02;
      const vx = ok ? pv.x : (L.diver[0] - d0x) / dt, vz = ok ? pv.z : (L.diver[2] - d0z) / dt;
      const k = 1 - Math.exp(-dt / 0.25);
      L.vel[0] += (clamp$5(vx, -3, 3) - L.vel[0]) * k; L.vel[2] += (clamp$5(vz, -3, 3) - L.vel[2]) * k;
      L.vs = Math.hypot(L.vel[0], L.vel[2]);
    }
    U_J.uRScene.value.x = floorAt(L.cam[0], L.cam[2]);
    if (!SOL.cells && L.state === 'title') buildSolids();
    TH.on = false;
    autoStep(dt);
    for (let i = 0; i < pending.length; i++) {
      const p = pending[i];
      if (p.done) { pending.splice(i--, 1); continue; }
      p.delay -= dt;
      if (p.delay > 0) continue;
      if (KIND[p.kind].big && bigActive(null)) {
        if (!p.manual) continue;
        for (const q of passes) if (!q.done && KIND[q.kind].big && (!q.manual || p.o.replace)) q.fadeGo = true;
        continue;
      }
      if (p.kind === 'stingray' && passes.some((q) => !q.done && q.kind === 'stingray' && q.members && q.members[0].st !== 'rest' && q.members[0].st !== 'buried')) continue;
      if (!roomFor(p)) continue;
      pending.splice(i--, 1);
      activate(p);
      if (!p.done) passes.push(p);
    }
    const quiet = !!QUIET[L.state];
    for (let i = passes.length - 1; i >= 0; i--) {
      const p = passes[i];
      if (quiet && KIND[p.kind].big) p.fadeGo = true;
      if (!p.done) stepPass(p, dt);
      if (p.done) passes.splice(i, 1);
    }
    stepJellies(dt, L.t, PJ, PEL, NP, -19, -8, true, TIER_P);
    stepJellies(dt, L.t, RJ, RHI, NRH, -12, -3, false, TIER_R);
    stepJuveniles(dt, L.t);
    BIL.step(dt);
    COP.u.uCam.value.set(L.cam[0], L.cam[1], L.cam[2]);
    const under = L.cam[1] < -0.05;
    COP.u.uUnder.value = under ? 1 : 0;
    COP.pts.visible = COP.snow.visible = under;
    tiers();
  }

  function setKeepOut(caps, n) {
    const m = caps ? Math.min(n | 0, Math.floor(caps.length / 7), 24) : 0;
    if (!m) { KO.n = 0; KO.m = 0; KO.helm = false; return; }
    let x = 0, y = 0, z = 0, top = -1e9, hk = -1;
    for (let k = 0; k < m * 7; k += 7) {
      x += caps[k] + caps[k + 3]; y += caps[k + 1] + caps[k + 4]; z += caps[k + 2] + caps[k + 5];
      if (caps[k] === caps[k + 3] && caps[k + 1] === caps[k + 4] && caps[k + 2] === caps[k + 5] && caps[k + 6] > 0.15 && caps[k + 1] > top) { top = caps[k + 1]; hk = k; }
    }
    if (!Number.isFinite(x + y + z)) return;
    KO.x = x / (2 * m); KO.y = y / (2 * m); KO.z = z / (2 * m); KO.n = m;
    for (let k = 0; k < m * 7; k++) KO.caps[k] = caps[k];
    KO.m = m;
    KO.helm = hk >= 0;
    if (KO.helm) { KO.hx = caps[hk]; KO.hy = caps[hk + 1]; KO.hz = caps[hk + 2]; }
  }
  function peek(ahead = 0) {
    const out = [];
    for (const p of passes) {
      if (p.done || !p.members || !p.active) continue;
      for (const m of p.members) {
        const o = { kind: p.kind, x: m.x, y: m.y, z: m.z, fx: m.fx, fy: m.fy, fz: m.fz, size: m.L || m.W || 1, st: m.st || '', shift: +p.av.x.toFixed(3), closeIn: Number.isFinite(p.closeT) ? +(p.closeT - p.t).toFixed(2) : null, locked: !!p.locked, framing: p.fc ? p.fc.concat(+(p.frameCost || 0).toFixed(3), +(L.turn / DEG$2).toFixed(1)) : null };
        if (ahead > 0 && (p.kind !== 'stingray' || RAY_MOVING[m.st])) { const q = [0, 0, 0]; poseAt(p, m, (m.arc || p.s) + p.v * ahead, q, 0); o.ahead = q; }
        out.push(o);
      }
    }
    return out;
  }
  function setDescent(from, to) {
    const a = v3(from, DS.a), b = v3(to, DS.b);
    DS.a = a; DS.b = b; DS.set = true;
    let fxx = a[0] - L.cam[0], fzz = a[2] - L.cam[2];
    const fl = Math.hypot(fxx, fzz);
    if (fl < 0.5) { fxx = b[0] - a[0]; fzz = b[2] - a[2]; }
    const l = Math.hypot(fxx, fzz) || 1;
    fxx /= l; fzz /= l;
    RJ.x[0] = a[0] + fxx * 3.4 - fzz * 1.2; RJ.z[0] = a[2] + fzz * 3.4 + fxx * 1.2; RJ.y[0] = RJ.ty[0] = -3.8;
    const mx = lerp$2(a[0], b[0], 0.45), mz = lerp$2(a[2], b[2], 0.45);
    RJ.x[1] = mx - fxx * 0.8 + fzz * 3.6; RJ.z[1] = mz - fzz * 0.8 - fxx * 3.6;
    RJ.y[1] = RJ.ty[1] = clamp$5(lerp$2(a[1], b[1], 0.42), floorAt(RJ.x[1], RJ.z[1]) + 4, -6);
    const NL = Math.min(NP, qc(5, 3)), top = Math.min(a[1], -0.5);
    for (let i = 0; i < NL; i++) {
      const y = top - 1.3 - (i + 0.25 + 0.5 * rnd()) * (6.4 / NL);
      const tt = clamp$5((a[1] - y) / Math.max(1, a[1] - b[1]), 0, 1);
      const lx = lerp$2(a[0], b[0], tt), lz = lerp$2(a[2], b[2], tt), an = i * 2.39996 + rr$1(-0.4, 0.4), r = rr$1(1.5, 4);
      PJ.x[i] = lx + Math.cos(an) * r; PJ.z[i] = lz + Math.sin(an) * r;
      PJ.y[i] = PJ.ty[i] = y; PJ.vy[i] = 0;
      PJ.lo[i] = y - 1.2; PJ.hi[i] = Math.min(-0.9, y + 1.2);
      PJ.s[i] = rr$1(0.08, 0.12); PJ.line[i] = 1; PJ.age[i] = 10;
    }
    const NM = Math.min(NP - NL, qc(3, 2)), la = Math.atan2(L.cam[2] - a[2], L.cam[0] - a[0]) + Math.PI;
    for (let j = 0; j < NM; j++) {
      const i = NL + j, y = top - 8.5 - (j + 0.3 + 0.4 * rnd()) * (6 / NM);
      const tt = clamp$5((a[1] - y) / Math.max(1, a[1] - b[1]), 0, 1);
      const lx = lerp$2(a[0], b[0], tt), lz = lerp$2(a[2], b[2], tt), an = la + (j * TAU$4) / NM + rr$1(-0.3, 0.3), r = rr$1(2, 3);
      PJ.x[i] = lx + Math.cos(an) * r; PJ.z[i] = lz + Math.sin(an) * r;
      PJ.y[i] = PJ.ty[i] = y; PJ.vy[i] = 0;
      PJ.lo[i] = y - 1; PJ.hi[i] = y + 1;
      PJ.s[i] = rr$1(0.11, 0.14); PJ.line[i] = 1; PJ.age[i] = 10;
    }
  }

  function dispose() {
    for (const p of passes) endPass(p);
    passes.length = 0; pending.length = 0;
    if (root.parent) root.parent.remove(root);
    for (const d of disposables) if (d && d.dispose) d.dispose();
  }
  function stats() {
    const out = { passes: passes.map((p) => (p.done ? null : p.kind)).filter(Boolean), pending: pending.length, drawn: [], triangles: 0 };
    for (const S of [...BIG, SMF]) {
      if (!S.mesh.visible) continue;
      let n = 0;
      for (let k = 0; k < S.count; k++) n += S.live[k];
      const tri = (S.mesh.geometry.index.count / 3) * n;
      out.drawn.push({ name: S.mesh.name, instances: n, triangles: tri, shadow: S.mesh.castShadow, dmin: +S.dmin.toFixed(1) });
      out.triangles += tri;
    }
    out.jellies = [];
    for (const Jm of [PEL, RHI]) {
      const n = Jm.mesh.visible ? Jm.shown || 0 : 0, tri = (Jm.mesh.geometry.index.count / 3) * n;
      out.jellies.push({ name: Jm.mesh.name, shown: n, of: Jm.n, triangles: tri });
      out.triangles += tri;
    }
    return out;
  }

  update(1 / 60, 0, null);
  return {
    schedule,
    force: (kind = 'shark', opts = {}) => schedule(kind, Object.assign(kind === 'stingray' ? { flushIn: 3 } : {}, opts, { at: 0, replace: true })),
    auto: (on) => { if (on !== undefined) AUTO.on = !!on; return AUTO.on; },
    busy,
    onEvent: (fn) => { if (typeof fn === 'function') listeners.push(fn); return () => { const i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); }; },
    active: () => passes.filter((p) => !p.done).map((p) => p.kind),
    peek,
    solidsNear: (x, z, r = 1) => solidsNear(x, z, r, []).map((s) => Object.assign({}, s)),
    update, setKeepOut, setDescent, stats, dispose, threat: TH, group: root,
  };
}

