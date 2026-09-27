// life.js
const TAU$3 = Math.PI * 2;
const clamp$4 = (x, a, b) => (x < a ? a : x > b ? b : x);
const sstep$3 = (a, b, x) => {
  const t = clamp$4((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

let seed = 1;
function rand$1() {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const rr = (a, b) => a + (b - a) * rand$1();
function hash01(a, b) {
  let h = Math.imul(a ^ 0x2c1b3c6d, 0x297a2d39) ^ Math.imul((b + 0x68e31da4) | 0, 0x1b56c4e9);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  h = Math.imul(h, 0x297a2d39);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

const gf$1 = (x) => (+x).toFixed(4);
const gm = (x) => (+x).toFixed(8);
const _col = new THREE.Color();
const gc$1 = (hex) => {
  _col.set(hex);
  return `vec3(${gf$1(_col.r)}, ${gf$1(_col.g)}, ${gf$1(_col.b)})`;
};

class GeoBuilder {
  constructor() {
    this.p = []; this.sp = []; this.fin = []; this.fi = []; this.uv = []; this.ex = []; this.ix = [];
  }
  get count() { return this.p.length / 3; }
  v(x, y, z, s, fin, type, edge, u, w, w2 = 0, extra = 0) {
    this.p.push(x, y, z); this.sp.push(s); this.fin.push(fin);
    this.fi.push(type, edge); this.uv.push(u, w, w2); this.ex.push(extra);
    return this.p.length / 3 - 1;
  }
  tri(a, b, c) { this.ix.push(a, b, c); }
  quad(a, b, c, d) { this.ix.push(a, b, c, a, c, d); }
  build(extraName) {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(this.p);
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(vertexNormals(pos, this.ix), 3));
    g.setAttribute('aSpine', new THREE.BufferAttribute(new Float32Array(this.sp), 1));
    g.setAttribute('aFin', new THREE.BufferAttribute(new Float32Array(this.fin), 1));
    g.setAttribute('aFinInfo', new THREE.BufferAttribute(new Float32Array(this.fi), 2));
    g.setAttribute('aUV', new THREE.BufferAttribute(new Float32Array(this.uv), 3));
    if (extraName) g.setAttribute(extraName, new THREE.BufferAttribute(new Float32Array(this.ex), 1));
    const Idx = this.count > 65535 ? Uint32Array : Uint16Array;
    g.setIndex(new THREE.BufferAttribute(new Idx(this.ix), 1));
    return g;
  }
}

function vertexNormals(pos, ix) {
  const n = new Float32Array(pos.length);
  for (let i = 0; i < ix.length; i += 3) {
    const a = ix[i] * 3, b = ix[i + 1] * 3, c = ix[i + 2] * 3;
    const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2];
    const vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    n[a] += nx; n[a + 1] += ny; n[a + 2] += nz;
    n[b] += nx; n[b + 1] += ny; n[b + 2] += nz;
    n[c] += nx; n[c + 1] += ny; n[c + 2] += nz;
  }
  for (let i = 0; i < n.length; i += 3) {
    const l = Math.sqrt(n[i] * n[i] + n[i + 1] * n[i + 1] + n[i + 2] * n[i + 2]);
    if (l > 1e-14) { n[i] /= l; n[i + 1] /= l; n[i + 2] /= l; } else { n[i] = 0; n[i + 1] = 1; n[i + 2] = 0; }
  }
  return n;
}

function makeProfile(keys) {
  const n = keys.length;
  return (t, out) => {
    if (t <= keys[0][0]) { out[0] = keys[0][1]; out[1] = keys[0][2]; out[2] = keys[0][3]; return out; }
    if (t >= keys[n - 1][0]) { const k = keys[n - 1]; out[0] = k[1]; out[1] = k[2]; out[2] = k[3]; return out; }
    let i = 0;
    while (i < n - 2 && t > keys[i + 1][0]) i++;
    const k0 = keys[Math.max(i - 1, 0)], k1 = keys[i], k2 = keys[i + 1], k3 = keys[Math.min(i + 2, n - 1)];
    const dt = k2[0] - k1[0], u = (t - k1[0]) / dt, u2 = u * u, u3 = u2 * u;
    const h00 = 2 * u3 - 3 * u2 + 1, h10 = u3 - 2 * u2 + u, h01 = 3 * u2 - 2 * u3, h11 = u3 - u2;
    for (let c = 1; c <= 3; c++) {
      const m1 = ((k2[c] - k0[c]) / Math.max(k2[0] - k0[0], 1e-6)) * dt;
      const m2 = ((k3[c] - k1[c]) / Math.max(k3[0] - k1[0], 1e-6)) * dt;
      out[c - 1] = h00 * k1[c] + h10 * m1 + h01 * k2[c] + h11 * m2;
    }
    out[0] = Math.max(out[0], 0.001); out[1] = Math.max(out[1], 0.001);
    return out;
  };
}

const outline = (sEnd, rows) => rows.map(([s, top, bot, w]) => [s / sEnd, (top - bot) / 2, w, (top + bot) / 2]);

function finCurve(pts) {
  return (v) => {
    if (v <= pts[0][0]) return pts[0][1];
    for (let i = 1; i < pts.length; i++) {
      if (v <= pts[i][0]) {
        const a = pts[i - 1], b = pts[i], u = (v - a[0]) / (b[0] - a[0]);
        return a[1] + (b[1] - a[1]) * u * u * (3 - 2 * u);
      }
    }
    return pts[pts.length - 1][1];
  };
}

const sectionX = (w, sn, cs, egg, ridge) => w * cs * (1 - egg * sn) * (1 - ridge * sn * sn * sn * sn);

function surfaceX(prof, g, y, z, o) {
  prof(clamp$4((0.5 - z) / g.sEnd, 0, 1), o);
  const sn = clamp$4((y - o[2]) / o[0], -0.98, 0.98);
  return sectionX(o[1], sn, Math.sqrt(1 - sn * sn), g.egg, g.ridge || 0);
}

function addBody(b, prof, g) {
  const R = g.radial, NS = g.stations, sEnd = g.sEnd, egg = g.egg, ridge = g.ridge || 0, hk = g.headK || 1.2;
  const o = [0, 0, 0];
  prof(0, o);
  const apex = b.v(0, o[2], 0.5 + 0.002, 0, 0, 0, 0, 0, 0, 1);
  let prev = -1;
  for (let i = 1; i <= NS; i++) {
    const t = Math.pow(i / NS, hk);
    prof(t, o);
    const h = o[0], w = o[1], c = o[2];
    const s = t * sEnd, z = 0.5 - s;
    const ring = b.count;
    for (let j = 0; j < R; j++) {
      const th = (j / R) * TAU$3, sn = Math.sin(th), cs = Math.cos(th);
      b.v(sectionX(w, sn, cs, egg, ridge), c + h * sn, z, s, 0, 0, 0, s, sn, cs);
    }
    for (let j = 0; j < R; j++) {
      const jn = (j + 1) % R;
      if (prev < 0) b.tri(apex, ring + j, ring + jn);
      else b.quad(prev + j, ring + j, ring + jn, prev + jn);
    }
    prev = ring;
  }
  prof(1, o);
  const tail = b.v(0, o[2], 0.5 - sEnd - 0.003, sEnd, 0, 0, 0, sEnd, 0, 1);
  for (let j = 0; j < R; j++) b.tri(prev + j, tail, prev + ((j + 1) % R));
}

function addEyes(b, prof, g) {
  const ez = g.eyePos[0], ey = g.eyePos[1], er = g.eyePos[2], o = [0, 0, 0], S = g.radial <= 14 ? 10 : 14, sEye = 0.5 - ez;
  const bulge = er * (g.eye.bulge !== undefined ? g.eye.bulge : 0.22);
  for (let side = -1; side <= 1; side += 2) {
    const apex = b.v(side * (surfaceX(prof, g, ey, ez, o) + bulge), ey, ez, sEye, 0, 6, 0, sEye, 0, 0);
    let prev = -1;
    for (let k = 1; k <= 3; k++) {
      const t = k / 3, ring = b.count;
      for (let j = 0; j < S; j++) {
        const a = (j / S) * TAU$3, y = ey + Math.sin(a) * er * t, z = ez + Math.cos(a) * er * t;
        const x = surfaceX(prof, g, y, z, o) * (k === 3 ? 0.985 : 1) + bulge * (1 - t * t);
        b.v(side * x, y, z, clamp$4(0.5 - z, 0, 1), 0, 6, t, sEye, 0, 0);
      }
      for (let j = 0; j < S; j++) {
        const jn = (j + 1) % S;
        if (prev < 0) b.tri(apex, ring + j, ring + jn);
        else b.quad(prev + j, ring + j, ring + jn, prev + jn);
      }
      prev = ring;
    }
  }
}

function addFlaps(b, prof, g, flaps) {
  const o = [0, 0, 0];
  for (const f of flaps) {
    for (const side of f.sides) {
      prof(f.t, o);
      const z = 0.5 - f.t * g.sEnd, y = o[2] + f.yv * o[0];
      const sn = clamp$4(f.yv, -0.98, 0.98), cs = Math.sqrt(1 - sn * sn);
      const x = side === 0 ? 0 : side * surfaceX(prof, g, y, z, o) * 0.92;
      let nx = side * cs, ny = side === 0 ? 1 : sn;
      const nl = Math.sqrt(nx * nx + ny * ny) || 1;
      nx /= nl; ny /= nl;
      const base = b.count;
      for (let i = 0; i <= 2; i++) {
        const u = i / 2, wid = f.w * (1 - u * 0.85), k = f.len * u;
        for (let j = 0; j <= 1; j++) {
          const zz = z - f.back * k + (j - 0.5) * wid;
          b.v(x + nx * k, y + ny * k, zz, clamp$4(0.5 - zz, 0, 1), 1, 7, u, u, j, 0);
        }
      }
      for (let i = 0; i < 2; i++) b.quad(base + i * 2, base + i * 2 + 1, base + i * 2 + 3, base + i * 2 + 2);
    }
  }
}

function gridQuads(b, base, nv, nu) {
  for (let i = 0; i < nv; i++) {
    for (let j = 0; j < nu; j++) {
      const a = base + i * (nu + 1) + j;
      b.quad(a, a + 1, a + nu + 2, a + nu + 1);
    }
  }
}

function addMedianFin(b, prof, sEnd, f, nv = 12) {
  const o = [0, 0, 0], nu = 3, base = b.count;
  const type = f.dir > 0 ? (f.soft ? 2.3 : 2) : 3;
  for (let i = 0; i <= nv; i++) {
    const v = i / nv, t = f.t0 + (f.t1 - f.t0) * v;
    prof(t, o);
    const z0 = 0.5 - t * sEnd, y0 = o[2] + f.dir * o[0] * 0.9, H = f.h(v);
    for (let j = 0; j <= nu; j++) {
      const u = j / nu, z = z0 - f.rake * H * u;
      b.v(0, y0 + f.dir * H * u, z, clamp$4(0.5 - z, 0, 1.15), 1, type, u, u, v, y0);
    }
  }
  gridQuads(b, base, nv, nu);
}

function addCaudal(b, prof, sEnd, c, nv = 14) {
  const o = [0, 0, 0];
  prof(1, o);
  const hb = o[0] * 0.85, cy = o[2];
  const zb = 0.5 - sEnd + 0.02, len = 1 - sEnd + 0.02;
  const nu = 6, base = b.count;
  for (let i = 0; i <= nv; i++) {
    const v = i / nv, vv = v * 2 - 1, a = Math.abs(vv);
    let f;
    if (c.shape === 'round') f = 0.8 + 0.2 * (1 - vv * vv);
    else if (c.shape === 'truncate') f = 0.93 + 0.07 * a;
    else if (c.shape === 'lunate') f = 1 - c.fork * (1 - a * a) + (c.fil || 0) * Math.pow(a, 8);
    else f = 1 - c.fork * (1 - Math.pow(a, 1.5));
    for (let j = 0; j <= nu; j++) {
      const u = j / nu, z = zb - u * len * f;
      const y = cy + vv * (hb + (c.span - hb) * Math.pow(u, 0.8));
      b.v(0, y, z, clamp$4(0.5 - z, 0, 1.15), 1, 1, u, u, v);
    }
  }
  gridQuads(b, base, nv, nu);
}

function addPairedFin(b, prof, sEnd, f, small) {
  const o = [0, 0, 0], o2 = [0, 0, 0];
  prof(f.t, o);
  const h = o[0], w = o[1], cy = o[2];
  const z0 = 0.5 - f.t * sEnd, xs = w * Math.sqrt(Math.max(0, 1 - f.yv * f.yv)) * 0.9, y0 = cy + h * f.yv;
  const nv = f.shape === 'fan' ? 8 : small ? 3 : 5, nu = small ? 3 : 4;
  for (let side = -1; side <= 1; side += 2) {
    let dx = f.dir[0] * side, dy = -f.dir[1], dz = -f.dir[2];
    const dl = Math.sqrt(dx * dx + dy * dy + dz * dz);
    dx /= dl; dy /= dl; dz /= dl;
    const base = b.count;
    for (let i = 0; i <= nv; i++) {
      const v = i / nv;
      let rx = side * xs, ry = y0, rz = z0;
      if (f.rootAxis === 'z') rz += (v - 0.5) * 2 * f.root; else ry += (v - 0.5) * 2 * f.root;
      let L, fan = (v - 0.5) * 0.3;
      if (f.shape === 'round') L = f.len * (0.55 + 0.45 * Math.sin(Math.PI * (0.15 + 0.7 * v)));
      else if (f.shape === 'fan') { L = f.len * (0.5 + 0.5 * Math.sin(Math.PI * v)); fan = (v - 0.5) * 1.6; }
      else if (f.shape === 'streamer') L = f.len * (0.2 + 0.8 * Math.pow(v, 3));
      else L = f.len * (0.35 + 0.65 * Math.pow(v, 1.4));
      for (let j = 0; j <= nu; j++) {
        const u = j / nu, k = L * u;
        const x = rx + dx * k, y = ry + dy * k + fan * k, z = rz + dz * k;
        const tt = (0.5 - z) / sEnd;
        let onB = 0;
        if (tt > 0.02 && tt < 0.98) { prof(tt, o2); onB = clamp$4((o2[0] * 0.95 - Math.abs(y - o2[2])) / (o2[0] * 0.15), 0, 1); }
        b.v(x, y, z, clamp$4(0.5 - z, 0, 1.15), 1, f.type, u, u, v, onB);
      }
    }
    gridQuads(b, base, nv, nu);
  }
}

function buildFish(g) {
  const prof = makeProfile(g.keys);
  const pt = (t, yv) => {
    const o = prof(t, [0, 0, 0]);
    return [0.5 - t * g.sEnd, o[2] + yv * o[0]];
  };
  const e = pt(g.eye.t, g.eye.yv);
  g.eyePos = [e[0], e[1], g.eye.r];
  const b = new GeoBuilder();
  addBody(b, prof, g);
  addEyes(b, prof, g);
  const nv = g.radial > 14 ? 12 : 8;
  for (const f of g.median) addMedianFin(b, prof, g.sEnd, f, nv);
  addCaudal(b, prof, g.sEnd, g.caudal, nv + 2);
  for (const f of g.paired) addPairedFin(b, prof, g.sEnd, f, g.radial <= 14);
  if (g.flaps) addFlaps(b, prof, g, g.flaps);
  return { geo: b.build(), eye: g.eyePos, pt };
}

const FISH_VDECL =  `
attribute float aSpine;
attribute float aFin;
attribute vec2 aFinInfo;
attribute vec3 aUV;
attribute float aPhase;
attribute vec4 aSwim;
uniform float uLfTime;
uniform vec4 uLfWave;
uniform vec4 uLfFin;
float lfLat(float s) {
  float ph = aSwim.x - uLfWave.x * s;
  float hs = 1.0 - s;
  float bs = s - 0.3;
  return aSwim.y * (s * s * sin(ph) - uLfWave.y * hs * hs * sin(aSwim.x)) + aSwim.z * bs * bs;
}
float lfLatSlope(float s) {
  float ph = aSwim.x - uLfWave.x * s;
  float hs = 1.0 - s;
  return aSwim.y * (2.0 * s * sin(ph) - s * s * uLfWave.x * cos(ph) + 2.0 * uLfWave.y * hs * sin(aSwim.x)) + 2.0 * aSwim.z * (s - 0.3);
}
`;

const LF_VARY =  `
varying vec3 vLfPos;
varying vec3 vLfUV;
varying vec3 vLfFin;
varying float vLfWY;
`;

const LF_SETVARY =  `
vLfPos = position;
vLfUV = aUV;
vLfFin = vec3(aFin, aFinInfo.x, aFinInfo.y);
#ifdef USE_INSTANCING
vLfWY = (modelMatrix * instanceMatrix * vec4(position, 1.0)).y;
#else
vLfWY = (modelMatrix * vec4(position, 1.0)).y;
#endif
`;

const FISH_NORMAL =  `
{
  float lfM = -lfLatSlope(aSpine);
  float lfIn = inversesqrt(1.0 + lfM * lfM);
  float lfSn = lfM * lfIn;
  objectNormal = vec3(objectNormal.x * lfIn + objectNormal.z * lfSn, objectNormal.y, objectNormal.z * lfIn - objectNormal.x * lfSn);
}
`;

const FISH_DEFORM =  `
{
  float lfEdge = aFinInfo.y;
  float lfT = aFinInfo.x;
  if (lfT > 1.5 && lfT < 3.5) {
    float lfUp = 1.0 - uLfFin.z * (1.0 - aSwim.w);
    float lfDy = transformed.y - aUV.z;
    transformed.y = aUV.z + lfDy * lfUp;
    transformed.z -= abs(lfDy) * (1.0 - lfUp) * 0.7;
  }
  transformed.x += lfLat(aSpine);
  float lfFl = uLfTime * uLfFin.y + aPhase * 6.2832 + aSpine * 12.0 - lfEdge * 2.2;
  transformed.x += aFin * lfEdge * uLfWave.z * (0.5 + 0.5 * aSwim.w) * sin(lfFl);
  if (lfT > 3.5 && lfT < 4.5) {
    float lfSide = position.x >= 0.0 ? 1.0 : -1.0;
    float lfOpen = aSwim.w;
    float lfPh = uLfTime * uLfFin.x + aPhase * 6.2832 + lfSide * 0.9;
    transformed.x += lfSide * lfEdge * uLfWave.w * (lfOpen * (0.35 + 0.65 * sin(lfPh)) - (1.0 - lfOpen) * 0.55);
    transformed.z += lfEdge * uLfWave.w * 0.55 * lfOpen * cos(lfPh);
  }
}
`;

const LF_FDECL =  `
varying vec3 vLfPos;
varying vec3 vLfUV;
varying vec3 vLfFin;
varying float vLfWY;
uniform float uLfTime;
uniform vec4 uLfScene;
float lfHash(vec2 q) { return fract(sin(dot(q, vec2(127.1, 311.7))) * 43758.5453); }
float lfNoise(vec2 q) {
  vec2 i = floor(q);
  vec2 f = fract(q);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(lfHash(i), lfHash(i + vec2(1.0, 0.0)), u.x), mix(lfHash(i + vec2(0.0, 1.0)), lfHash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float lfFbm(vec2 q) { return lfNoise(q) * 0.55 + lfNoise(q * 2.13 + 7.1) * 0.3 + lfNoise(q * 4.37 - 3.3) * 0.15; }
float lfLine(float d, float w) { return 1.0 - smoothstep(w * 0.5, w, abs(d)); }
float lfLineAA(float d, float w) {
  float fw = max(fwidth(d), 1e-5);
  return (1.0 - smoothstep(0.5 * (w - fw), 0.5 * (w + fw), abs(d))) * min(1.0, w / fw);
}
float lfAA(float x) { return clamp(1.5 - 2.0 * fwidth(x), 0.0, 1.0); }
float lfGill(vec3 p, vec3 e, float rad, float w) {
  float r = length(vec2(p.z - e.x, (p.y - e.y) * 0.75));
  return lfLineAA(r - rad, w) * (1.0 - smoothstep(e.x - rad * 0.35, e.x - rad * 0.1, p.z)) * (1.0 - smoothstep(rad * 0.5, rad * 1.0, p.y - e.y));
}
float lfLLine(float fs, float fv, float s0, float s1, float v0, float v1, float w) {
  float t = clamp((fs - s0) / (s1 - s0), 0.0, 1.0);
  float vl = mix(v0, v1, smoothstep(0.35, 1.0, t));
  return lfLineAA(fv - vl, w) * smoothstep(s0 - 0.02, s0 + 0.02, fs) * (1.0 - smoothstep(s1, s1 + 0.04, fs));
}
vec3 lfCS(vec3 belly, vec3 flank, vec3 back, float fv, float fl, float bk) {
  vec3 c = mix(belly, flank, smoothstep(-0.95, fl, fv));
  return mix(c, back, smoothstep(bk - 0.3, bk + 0.22, fv));
}
float lfScale(vec2 p, out float rim, out float rnd, out vec2 sd, out vec2 grad) {
  rim = 0.0;
  rnd = 0.5;
  sd = vec2(0.0);
  grad = vec2(0.0);
  float wa = 0.061 * cos(p.y * 0.61 + 1.1), wb = 0.0406 * cos(p.x * 0.29 + 0.7) + 0.0581 * cos(p.x * 0.83 + 2.3);
  p += vec2(0.1 * sin(p.y * 0.61 + 1.1), 0.14 * sin(p.x * 0.29 + 0.7) + 0.07 * sin(p.x * 0.83 + 2.3));
  float cx0 = floor(p.x);
  for (int k = -1; k <= 1; k++) {
    float cx = cx0 + float(k);
    float off = 0.5 * mod(cx, 2.0);
    float cy0 = floor(p.y - off);
    for (int m = -1; m <= 1; m++) {
      vec2 cell = vec2(cx + 0.5, cy0 + float(m) + 0.5 + off);
      float h = lfHash(cell);
      vec2 c = cell + 0.18 * vec2(h - 0.5, fract(h * 7.13) - 0.5);
      float s = 0.68 / (0.8 + 0.08 * fract(h * 3.97));
      vec2 d = (p - c) * s;
      float r = length(d * vec2(0.95, 1.1));
      if (r < 0.68) {
        rim = smoothstep(0.5, 0.68, r) * smoothstep(-0.1, 0.25, d.x) * (0.45 + 0.55 * fract(h * 5.31));
        rnd = h;
        sd = d;
        float A = 0.35 + 0.65 * clamp(d.x * 0.735 + 0.5, 0.0, 1.0), B = 1.0 - 0.35 * r * r;
        vec2 t = vec2(h - 0.5, fract(h * 17.31) - 0.5) * 0.35;
        vec2 g = (vec2(0.47775 * step(abs(d.x), 0.68) * B - 0.63175 * A * d.x, -0.847 * A * d.y) + t) * s;
        grad = vec2(g.x + wb * g.y, wa * g.x + g.y);
        return A * B + dot(t, d);
      }
    }
  }
  return 0.0;
}
vec3 lfPerturb(vec3 pos, vec3 n, vec2 dh, float fd) {
  vec3 sx = dFdx(pos);
  vec3 sy = dFdy(pos);
  vec3 r1 = cross(sy, n);
  vec3 r2 = cross(n, sx);
  float det = dot(sx, r1) * fd;
  vec3 grad = sign(det) * (dh.x * r1 + dh.y * r2);
  return abs(det) > 1e-12 ? normalize(abs(det) * n - grad) : n;
}
`;

const LF_WATER =  `
uniform float uLfLight;
vec3 lfWaterBehind(vec3 vp) {
  vec3 vw = normalize((vec4(vp, 0.0) * viewMatrix).xyz);
  float d = length(vp);
  vec3 s = mix(vec3(0.0, 0.05, 0.15), vec3(0.02, 0.31, 0.52), smoothstep(-0.55, 0.95, vw.y)) * exp(-max(0.0, -cameraPosition.y) * 0.016) * uLfLight;
  vec3 bg = s;
  if (vw.y < -0.03) {
    float bd = clamp((cameraPosition.y - uLfScene.x) / -vw.y, d + 0.3, 80.0);
    vec3 sea = uLfScene.yzw * uLfLight * exp(-vec3(0.2, 0.046, 0.034) * bd) + s * (1.0 - exp(-0.024 * bd));
    bg = mix(s, sea, 1.0 - smoothstep(-0.12, -0.03, vw.y));
  }
  return max((bg - s * (1.0 - exp(-0.024 * d))) / exp(-vec3(0.2, 0.046, 0.034) * d), 0.0);
}
`;

const LF_FRAG_PRE =  `
vec3 lfCol = diffuseColor.rgb;
float lfMet = metalness;
float lfRou = roughness;
vec3 lfEmi = vec3(0.0);
float lfIri = 0.0;
float lfIriT = 300.0;
float lfAlpha = 1.0;
float lfTrim = 0.0;
float lfBack = 0.0;
float lfEnvK = 1.0;
float lfCatch = 0.0;
float lfFinSee = 0.0;
vec3 lfTint = vec3(0.0);
float lfFinOp = 0.8;
float lfFinTip = 0.6;
float lfRays = 16.0;
float lfRayK = 0.82;
float lfSpN = 0.0;
float lfSpEnd = 0.5;
float lfNotch = 0.0;
float lfPectK = 0.55;
vec2 lfDH = vec2(0.0);
vec3 lfFlu = vec3(0.0);
vec3 lfAtt = exp(-vec3(0.105, 0.036, 0.021) * max(0.0, -vLfWY));
{
  vec3 fp = vLfPos;
  float fs = vLfUV.x;
  float fv = vLfUV.y;
  float fphi = atan(vLfUV.z, vLfUV.y + 0.00001);
  float isFin = vLfFin.x;
  float ftype = vLfFin.y;
  float fedge = vLfFin.z;
  float isEye = step(5.5, ftype) * step(ftype, 6.5);
  float body = (1.0 - isFin) * (1.0 - isEye);
  vec3 lfN = normalize(vNormal);
  vec3 lfV = normalize(vViewPosition);
  float ndv = abs(dot(lfN, lfV));
  float sRim = 0.0;
  float sRnd = 0.5;
  float sAA = 0.0;
  vec2 sD = vec2(0.0);
  float hH = 0.0;
`;

const LF_EYE = (e, iris, pupil = 0.56) =>  `
  if (isEye > 0.5) {
    vec3 skin = lfCol;
    vec2 eq = vec2(fp.z - ${gf$1(e[0])}, fp.y - ${gf$1(e[1])});
    float er = length(eq) / ${gf$1(e[2])};
    float ea = atan(eq.y, eq.x);
    vec3 ir = ${gc$1(iris)};
    float irisM = smoothstep(${gf$1(pupil - 0.03)}, ${gf$1(pupil + 0.03)}, er);
    float stri = 0.78 + 0.22 * lfNoise(vec2(ea * 6.0 + 11.0, er * 4.0));
    vec3 ec = mix(vec3(0.005, 0.006, 0.008), ir * stri * mix(0.65, 1.0, smoothstep(${gf$1(pupil)}, 0.82, er)), irisM);
    ec = mix(ec, ir * 0.16, smoothstep(0.82, 0.92, er));
    lfCol = mix(ec, skin, smoothstep(0.94, 1.02, er));
    lfMet = 0.0;
    lfRou = mix(0.05, 0.35, smoothstep(0.92, 1.0, er));
    lfIri = 0.0;
    lfEnvK = 1.8;
    vec3 lfR = reflect(-lfV, lfN);
    vec3 lfUpV = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
    lfCatch = pow(max(dot(lfR, lfUpV), 0.0), 40.0) * (1.0 - smoothstep(0.8, 0.95, er));
  }
`;

const LF_FRAG_FIN =  `
  if (isFin > 0.5) {
    float rq = fv * lfRays + 0.22 * (lfNoise(vec2(fv * lfRays * 0.35, ftype * 3.7 + 1.3)) - 0.5);
    float rd = abs(fract(rq) - 0.5) * 2.0;
    float rayM = smoothstep(0.68, 0.94, rd) * clamp(1.5 - 2.0 * fwidth(rq), 0.0, 1.0);
    float tip = smoothstep(0.3, 1.0, fedge);
    lfCol *= mix(1.0, lfRayK, rayM * (0.4 + 0.6 * fedge));
    lfMet = 0.0;
    lfRou = 0.5;
    lfIri = 0.0;
    lfEnvK = 1.0;
    float op = lfFinOp * (ftype > 3.5 && ftype < 4.5 ? lfPectK : 1.0);
    if (ftype < 1.5) op = min(1.0, op + 0.2);
    op = mix(op, op * lfFinTip, tip);
    op = mix(op, min(1.0, op + 0.18), rayM);
    float a = 1.0 - step(1.0 - 0.012 * (1.0 - rayM) - 0.03 * lfNoise(vec2(fv * 11.0, ftype * 5.1 + 0.7)), fedge);
    if (ftype > 1.5 && ftype < 2.15 && fv < lfSpEnd) {
      float k = fv / lfSpEnd * lfSpN;
      float d = abs(k - floor(k + 0.5)) * 2.0;
      float top = 1.0 - lfNotch * pow(d, 0.65);
      a = min(a, 1.0 - step(top, fedge));
      float sp = (1.0 - smoothstep(0.0, 0.2, d)) * clamp(1.5 - 2.0 * fwidth(k), 0.0, 1.0);
      op = mix(op, 1.0, sp * 0.7);
    }
    float onB = ftype > 3.5 && ftype < 5.5 ? clamp(vLfUV.z, 0.0, 1.0) : 0.0;
    lfTint = lfCol;
    lfFinSee = (1.0 - op) * (1.0 - onB);
    lfCol *= mix(op, 1.0, onB);
    lfAlpha = a * mix(1.0, max(op, 0.45), onB) * (1.0 - lfTrim);
    lfBack = 0.45 + 0.55 * tip;
  }
  lfRou = clamp(lfRou + (sRnd - 0.5) * 0.06 * sAA, 0.03, 1.0);
  lfMet = clamp(lfMet + (sRnd - 0.5) * 0.06 * sAA, 0.0, 1.0);
`;

const LF_FRAG_POST =  `
}
diffuseColor.rgb = lfCol;
diffuseColor.a = lfAlpha;
`;

const SCALES = (nAlong, nAround, relief, rimDark, head, lenM) =>  `
  vec2 sq = vec2(fs * ${gf$1(nAlong)}, fphi * ${gf$1(nAround)});
  vec2 sG;
  float sH = lfScale(sq, sRim, sRnd, sD, sG);
  vec2 sqx = dFdx(sq), sqy = dFdy(sq);
  sqx.y -= sign(sqx.y) * step(${gf$1(Math.PI * nAround)}, abs(sqx.y)) * ${gf$1(2 * Math.PI * nAround)};
  sqy.y -= sign(sqy.y) * step(${gf$1(Math.PI * nAround)}, abs(sqy.y)) * ${gf$1(2 * Math.PI * nAround)};
  sAA = clamp(1.5 - 1.6 * max(abs(sqx.x) + abs(sqy.x), abs(sqx.y) + abs(sqy.y)), 0.0, 1.0) * body * smoothstep(${gf$1(head)}, ${gf$1(head + 0.06)}, fs);
  lfDH = vec2(dot(sG, sqx), dot(sG, sqy)) * ${gm((relief * lenM) / nAlong)} * sAA;
  sRim *= sAA;
  lfCol *= (1.0 - ${gf$1(rimDark)} * sRim) * (1.0 + (sRnd - 0.5) * 0.05 * sAA);
`;

const IRIDESCENCE = (amount, lo = -0.8, hi = 0.65) =>  `
  lfIri = smoothstep(${gf$1(lo)}, ${gf$1(lo + 0.35)}, fv) * (1.0 - smoothstep(${gf$1(hi - 0.3)}, ${gf$1(hi)}, fv)) * body * ${gf$1(amount)};
  lfIriT = 260.0 + 160.0 * lfNoise(vec2(fs * 7.0, fv * 3.0 + 2.0)) + 70.0 * (sRnd - 0.5) * sAA;
`;

const FINS = (o) => {
  const r = o.rays;
  let s =  `
  lfFinOp = ${gf$1(o.op)};
  lfFinTip = ${gf$1(o.tip)};
  lfRayK = ${gf$1(o.rayK)};
  lfRays = ftype < 1.5 ? ${gf$1(r[0])} : ftype < 2.5 ? ${gf$1(r[1])} : ftype < 3.5 ? ${gf$1(r[2])} : ftype < 4.5 ? ${gf$1(r[3])} : ${gf$1(r[4])};
`;
  if (o.spines) {
    s +=  `
  lfSpN = ${gf$1(o.spines[0])};
  lfSpEnd = ${gf$1(o.spines[1])};
  lfNotch = ${gf$1(o.spines[2])};
`;
  }
  return s;
};

const HEADBUMP = (m) =>  `
  lfDH += vec2(dFdx(hH), dFdy(hH)) * ${gm(m)};
`;

const LF_NORMAL =  `
normal = lfPerturb(-vViewPosition, normal, lfDH, faceDirection);
`;

const LF_EMISSIVE =  `
totalEmissiveRadiance += lfEmi;
metalnessFactor = lfMet;
roughnessFactor = lfRou;
#if NUM_DIR_LIGHTS > 0
if (lfBack > 0.0) {
  vec3 lfL = directionalLights[0].direction;
  float lfTr = max(0.0, -dot(normal, lfL));
  float lfFw = pow(max(0.0, dot(-normalize(vViewPosition), lfL)), 8.0);
  totalEmissiveRadiance += lfCol * directionalLights[0].color * lfAtt * lfBack * (0.16 * lfTr + 0.45 * lfFw);
}
#endif
`;

const FISH_EMISSIVE =  `
totalEmissiveRadiance += lfEmi;
metalnessFactor = lfMet;
roughnessFactor = lfRou;
{
  vec3 lfV2 = normalize(vViewPosition);
#if NUM_DIR_LIGHTS > 0
  if (lfBack > 0.0) {
    vec3 lfL = directionalLights[0].direction;
    float lfTr = max(0.0, -dot(normal, lfL));
    float lfFw = pow(max(0.0, dot(-lfV2, lfL)), 6.0);
    totalEmissiveRadiance += lfTint * directionalLights[0].color * lfAtt * lfBack * (0.08 * lfTr + 0.3 * lfFw);
  }
  if (lfFlu.r + lfFlu.g + lfFlu.b > 0.0) {
    float lfFi = dot(directionalLights[0].color * lfAtt, vec3(0.0, 0.5, 0.5)) * (0.3 + 0.7 * max(dot(normal, directionalLights[0].direction), 0.0));
    float lfFd = length(vViewPosition);
    totalEmissiveRadiance += lfFlu * (lfFi * exp(-lfFd * 0.045) * (1.0 - smoothstep(2.0, 5.5, lfFd)));
  }
#endif
#if NUM_HEMI_LIGHTS > 0
  totalEmissiveRadiance += lfCatch * hemisphereLights[0].skyColor * 2.5 * (1.0 - smoothstep(3.0, 9.0, length(vViewPosition)));
#endif
  if (lfFinSee > 0.001) totalEmissiveRadiance += lfWaterBehind(-vViewPosition) * lfFinSee;
}
`;

const FISH_ENV =  `
#if defined( RE_IndirectSpecular )
radiance *= lfEnvK * 2.2;
#endif
`;

const FISH_WARM =  `
{
  float lfDeep = clamp((1.0 - lfAtt.r / lfAtt.g) / 0.7, 0.0, 1.0);
  vec3 lfWarm = mix(vec3(1.0), vec3(1.45, 0.92, 0.72), (1.0 - smoothstep(3.0, 8.0, length(vViewPosition))) * lfDeep);
  lfWarm *= mix(vec3(1.0), vec3(0.24, 0.62, 0.88), smoothstep(3.0, 7.5, length(vViewPosition)) * lfDeep);
  reflectedLight.directDiffuse *= lfWarm;
  reflectedLight.indirectDiffuse *= lfWarm;
  reflectedLight.directSpecular *= mix(vec3(1.0), lfWarm, metalnessFactor);
  reflectedLight.indirectSpecular *= mix(vec3(1.0), lfWarm, metalnessFactor);
}
`;

const LF_IRIDESCENCE =  `
#ifdef USE_IRIDESCENCE
material.iridescence *= lfIri;
material.iridescenceThickness = lfIriT;
#endif
`;

const DOL_VDECL =  `
attribute float aSpine;
attribute float aFin;
attribute vec2 aFinInfo;
attribute vec3 aUV;
attribute vec4 aSwim;
uniform float uLfTime;
uniform vec4 uLfWave;
float lfDolAmp(float s) {
  float x = clamp((s - 0.3) / 0.7, 0.0, 1.0);
  return uLfWave.y + (1.0 - uLfWave.y) * x * x;
}
float lfDolY(float s) { return aSwim.y * lfDolAmp(s) * sin(aSwim.x - uLfWave.x * s); }
float lfDolSlope(float s) {
  float x = clamp((s - 0.3) / 0.7, 0.0, 1.0);
  float dx = (s > 0.3 && s < 1.0) ? 2.0 * x / 0.7 : 0.0;
  float ph = aSwim.x - uLfWave.x * s;
  return aSwim.y * ((1.0 - uLfWave.y) * dx * sin(ph) - lfDolAmp(s) * uLfWave.x * cos(ph));
}
`;

const DOL_NORMAL =  `
{
  float lfM = -lfDolSlope(aSpine);
  float lfIn = inversesqrt(1.0 + lfM * lfM);
  float lfSa = -lfM * lfIn;
  objectNormal = vec3(objectNormal.x, objectNormal.y * lfIn - objectNormal.z * lfSa, objectNormal.y * lfSa + objectNormal.z * lfIn);
}
`;

const DOL_DEFORM =  `
transformed.y += lfDolY(aSpine);
if (aFinInfo.x > 3.5 && aFinInfo.x < 4.5) {
  transformed.y += aFinInfo.y * 0.018 * sin(aSwim.x + 1.3);
}
`;

const JELLY_VDECL =  `
attribute vec3 aUV;
attribute float aPart;
attribute float aPhase;
uniform float uLfTime;
varying vec3 vLfPos;
varying vec3 vLfUV;
varying float vLfPart;
varying float vLfPulse;
varying float vLfWY;
float lfPulse(float t) {
  float p = fract(t);
  return smoothstep(0.0, 0.2, p) * (1.0 - smoothstep(0.2, 1.0, p));
}
`;

const JELLY_DEFORM =  `
vLfPos = position;
vLfUV = aUV;
vLfPart = aPart;
#ifdef USE_INSTANCING
vLfWY = (modelMatrix * instanceMatrix * vec4(position, 1.0)).y;
#else
vLfWY = (modelMatrix * vec4(position, 1.0)).y;
#endif
{
  float lfC = lfPulse(uLfTime / 1.8 + aPhase);
  vLfPulse = lfC;
  float lfRn = clamp(length(position.xz) / 0.5, 0.0, 1.0);
  if (aPart < 0.5) {
    transformed.xz *= 1.0 - 0.15 * lfC * lfRn;
    transformed.y += 0.025 * lfC * (1.0 - lfRn) - 0.055 * lfC * lfRn * lfRn;
  } else {
    float lfC2 = lfPulse(uLfTime / 1.8 + aPhase - 0.07);
    float lfDep = clamp(-position.y / 0.3, 0.0, 1.0);
    transformed.xz *= 1.0 - 0.1 * lfC2 * lfDep;
    transformed.y += 0.02 * lfC2;
    transformed.x += 0.015 * lfDep * sin(uLfTime * 1.3 + aPhase * 6.2832 + position.z * 18.0);
    transformed.z += 0.015 * lfDep * cos(uLfTime * 1.1 + aPhase * 6.2832 + position.x * 18.0);
  }
}
`;

const JELLY_FDECL =  `
varying vec3 vLfPos;
varying vec3 vLfUV;
varying float vLfPart;
varying float vLfPulse;
varying float vLfWY;
uniform vec4 uLfScene;
float lfAA(float x) { return clamp(1.5 - 2.0 * fwidth(x), 0.0, 1.0); }
`;

const BELL_FRAG =  `
vec3 lfCol = diffuseColor.rgb;
float lfMet = 0.0;
float lfRou = 0.3;
vec3 lfEmi = vec3(0.0);
float lfBack = 0.55;
float lfA = 1.0;
vec3 lfAtt = exp(-vec3(0.105, 0.036, 0.021) * max(0.0, -vLfWY));
{
  float rn = vLfUV.x;
  float ang = atan(vLfPos.z, vLfPos.x + 0.000001);
  float dome = 1.0 - smoothstep(0.24, 0.42, rn);
  vec3 c = mix(${gc$1(0xcbbd8e)}, ${gc$1(0x9c6a30)}, dome);
  float warts = smoothstep(0.55, 0.85, sin(ang * 23.0 + rn * 40.0) * sin(rn * 61.0)) * lfAA(rn * 12.0);
  c = mix(c, ${gc$1(0xd6c39a)}, warts * dome * 0.3);
  c = mix(c, ${gc$1(0x76501f)}, (1.0 - smoothstep(0.0, 0.04, abs(rn - 0.4))) * 0.35);
  float aa = lfAA(ang * 2.55);
  float canal = smoothstep(0.75, 1.0, abs(sin(ang * 8.0))) * smoothstep(0.42, 0.6, rn) * aa;
  float groove = smoothstep(0.55, 1.0, sin(ang * 16.0)) * smoothstep(0.55, 0.8, rn) * aa;
  c *= 1.0 - 0.18 * canal - 0.12 * groove;
  c = mix(c, c * ${gc$1(0xf2e6cc)}, step(0.1, vLfPart) * 0.5);
  float ndv = abs(dot(normalize(vNormal), normalize(vViewPosition)));
  float fr = (1.0 - ndv) * (1.0 - ndv);
  float a = mix(0.1, 0.36, dome) + 0.34 * fr + 0.08 * canal;
  a *= 1.0 - 0.8 * smoothstep(0.84, 1.0, rn);
  a *= 0.9 + 0.2 * vLfPulse;
  lfA = clamp(a, 0.0, 0.85);
  lfCol = c;
  lfRou = mix(0.32, 0.45, dome);
}
diffuseColor.rgb = lfCol * lfA * 0.7;
`;

const ARMS_FRAG =  `
vec3 lfCol = diffuseColor.rgb;
float lfMet = 0.0;
float lfRou = 0.45;
vec3 lfEmi = vec3(0.0);
float lfBack = 0.35;
float lfA = 1.0;
vec3 lfAtt = exp(-vec3(0.105, 0.036, 0.021) * max(0.0, -vLfWY));
{
  float along = vLfUV.x;
  vec3 c = mix(${gc$1(0xb99c62)}, ${gc$1(0xd6c9a4)}, along);
  float a = 0.45;
  if (vLfPart > 1.5) { c = mix(${gc$1(0xcfc4a8)}, ${gc$1(0xe2dccb)}, along); a = 0.32; }
  if (vLfPart > 2.5) { c = mix(${gc$1(0x6f64a6)}, ${gc$1(0xcfcbe0)}, smoothstep(0.35, 0.8, vLfUV.y)); a = 0.42; }
  a *= 1.0 - smoothstep(5.0, 14.0, length(vViewPosition));
  if (a < 0.02) discard;
  lfA = a;
  lfCol = c;
}
diffuseColor.rgb = lfCol * lfA * 0.75;
`;

const JELLY_EMISSIVE =  `
totalEmissiveRadiance += lfEmi;
metalnessFactor = lfMet;
roughnessFactor = lfRou;
{
  vec3 lfVp = -vViewPosition;
  float lfUp = smoothstep(0.1, 0.3, normalize((vec4(lfVp, 0.0) * viewMatrix).xyz).y);
#if NUM_DIR_LIGHTS > 0
  vec3 lfL = directionalLights[0].direction;
  float lfFw = pow(max(0.0, dot(normalize(lfVp), lfL)), 6.0);
  float lfTr = max(0.0, -dot(normal, lfL));
  totalEmissiveRadiance += lfCol * directionalLights[0].color * lfAtt * lfBack * (0.1 * lfTr + 0.4 * lfFw) * lfA;
#endif
  totalEmissiveRadiance += lfWaterBehind(lfVp) * (1.0 - lfA) * (1.0 - lfUp);
  diffuseColor.a = mix(1.0, lfA, lfUp);
}
`;

const K_VORTEX = 0, K_SCHOOL = 1, K_MEADOW = 2, K_CLOUD = 3, K_HOVER = 4, K_DART = 5, K_GROUPER = 6;
const K_BALL = 7, K_GRAZE = 8, K_REST = 9;
const CUR_FACE = Math.atan2(-0.6, -0.8);

const ev = (e) => `vec3(${gf$1(e[0])}, ${gf$1(e[1])}, ${gf$1(e[2])})`;
const MOUTH = (y0, rise, len, w) =>
  `lfLineAA(fp.y - (${gf$1(y0)} + ${gf$1(rise)} * (0.5 - fp.z)), ${gf$1(w)}) * step(${gf$1(0.5 - len)}, fp.z) * body`;

const BARRACUDA = {
  key: 'barracuda', id: 1, kind: K_VORTEX, shadow: true,
  geo: {
    sEnd: 0.86, stations: 34, radial: 18, egg: 0.06, ridge: 0.15, headK: 1.3,
    keys: outline(0.86, [
      [0.0, -3e-3, -0.011, 0.003], [0.02, 0.007, -0.017, 0.008], [0.06, 0.018, -0.025, 0.016],
      [0.12, 0.032, -0.034, 0.025], [0.2, 0.043, -0.042, 0.033], [0.3, 0.052, -0.05, 0.039],
      [0.42, 0.055, -0.053, 0.04], [0.55, 0.05, -0.048, 0.035], [0.68, 0.038, -0.037, 0.026],
      [0.78, 0.026, -0.025, 0.016], [0.84, 0.021, -0.02, 0.011], [0.86, 0.023, -0.022, 0.01],
    ]),
    median: [
      { t0: 0.43, t1: 0.51, dir: 1, rake: 0.9, h: finCurve([[0, 0.058], [0.3, 0.05], [1, 0.012]]) },
      { t0: 0.73, t1: 0.82, dir: 1, rake: 0.7, soft: true, h: finCurve([[0, 0.045], [1, 0.012]]) },
      { t0: 0.745, t1: 0.83, dir: -1, rake: 0.7, h: finCurve([[0, 0.04], [1, 0.012]]) },
    ],
    caudal: { shape: 'fork', fork: 0.52, span: 0.085 },
    paired: [
      { type: 4, t: 0.3, yv: -0.35, len: 0.065, root: 0.01, dir: [0.45, 0.25, 1], shape: 'point' },
      { type: 5, t: 0.47, yv: -0.92, len: 0.045, root: 0.008, rootAxis: 'z', dir: [0.3, 0.5, 1], shape: 'point' },
    ],
    eye: { t: 0.2, yv: 0.38, r: 0.016, bulge: 0.2 },
  },
  mat: { physical: true, metal: 0.8, rough: 0.25, iri: 0.6, iriRange: [200, 440], k: 6.2, head: 0.12, flutter: 0.006, pect: 0.015, scull: 6, ripple: 7, fold: 0.45 },
  frag: (e) =>  `
  lfCol = lfCS(${gc$1(0xe4e8ea)}, ${gc$1(0xbcc5cb)}, ${gc$1(0x36454f)}, fv, -0.3, 0.5);
  float bx = (fs - 0.2) / 0.6;
  float barM = step(0.0, bx) * step(bx, 1.0) * smoothstep(-0.2, 0.3, fv) * (1.0 - smoothstep(0.7, 0.95, fv)) * body;
  float bars = smoothstep(0.2, 0.9, sin(bx * 125.66 + fv * 1.2)) * lfAA(bx * 20.0);
  lfCol = mix(lfCol, ${gc$1(0x3a4852)}, bars * barM * 0.38);
  lfCol = mix(lfCol, ${gc$1(0x2f3b44)}, (1.0 - smoothstep(0.05, 0.16, fs)) * smoothstep(0.1, 0.6, fv) * body * 0.5);
  float jaw = ${MOUTH(-8e-3, 0.035, 0.14, 0.003)};
  lfCol = mix(lfCol, ${gc$1(0x262b2f)}, jaw * 0.7);
  hH -= jaw;
  float gl = lfGill(fp, ${ev(e)}, ${gf$1(e[2] * 3.4)}, 0.004);
  lfCol = mix(lfCol, ${gc$1(0x55616a)}, gl * body * 0.2);
  hH += gl * body;
  lfCol = mix(lfCol, ${gc$1(0x76828b)}, lfLLine(fs, fv, 0.2, 0.84, 0.12, 0.0, 0.035) * body * 0.5);
  ${SCALES(150, 11, 0.04, 0.06, 0.16, 0.9)}
  ${HEADBUMP(0.00025)}
  float up = smoothstep(0.35, 0.75, fv);
  lfMet = mix(mix(0.92, 0.35, up), 0.6, smoothstep(0.45, 0.95, -fv));
  lfRou = mix(0.2, 0.34, up) + 0.06 * sRim;
  lfEnvK = mix(2.4, 1.1, up);
  ${IRIDESCENCE(0.45)}
  ${FINS({ op: 0.4, tip: 0.5, rayK: 0.85, rays: [22, 10, 10, 14, 6], spines: [5, 1.0, 0.25] })}
  if (isFin > 0.5) {
    vec3 fc = ${gc$1(0x5e666c)};
    if (ftype < 1.5) fc = mix(${gc$1(0x6a6b5e)}, ${gc$1(0x4a4e52)}, smoothstep(0.75, 1.0, fedge));
    else if (ftype > 3.5) fc = ${gc$1(0x7e8480)};
    lfCol = fc;
  }
  ${LF_EYE(e, 0xb9b08c, 0.55)}
`,
  beh: {
    len: [0.8, 1.0], v: [0.5, 1.1, 2.4], acc: 1.6, turn: 1.0, head: 2.2,
    nbrR: 1.5, sepR: 0.8, maxN: 9, wSep: 2.4, wAli: 1.2, wCoh: 0.12, wGoal: 0.9, flee: 5, fleeW: 5, startle: 6,
    floorM: 0.8, margin: 0.6, obsBuf: 1.2, look: 0.8, pitch: 30, vAlign: 0.2,
    f0: 0.7, stride: 0.8, fMax: 3.2, aMin: 0.035, aMax: 0.1, pect: 0, wander: 0.08, bankK: 0.5, bendK: 0.05, vDamp: 0.8,
    glint: [6, 16, 0.25, 0.5, 0.9],
  },
};

const BREAM = {
  key: 'bream', id: 2, kind: K_SCHOOL, shadow: true,
  geo: {
    sEnd: 0.8, stations: 30, radial: 20, egg: 0.12, ridge: 0.35, headK: 1.3,
    keys: outline(0.8, [
      [0.0, -4e-3, -0.03, 0.006], [0.02, 0.02, -0.05, 0.016], [0.05, 0.055, -0.075, 0.026],
      [0.1, 0.105, -0.105, 0.038], [0.16, 0.145, -0.13, 0.046], [0.24, 0.178, -0.155, 0.052],
      [0.32, 0.19, -0.168, 0.054], [0.42, 0.182, -0.165, 0.052], [0.52, 0.16, -0.15, 0.046],
      [0.62, 0.12, -0.118, 0.036], [0.71, 0.075, -0.075, 0.024], [0.77, 0.05, -0.05, 0.015],
      [0.8, 0.055, -0.055, 0.012],
    ]),
    median: [
      { t0: 0.35, t1: 0.95, dir: 1, rake: 0.5, h: finCurve([[0, 0.035], [0.12, 0.095], [0.24, 0.1], [0.5, 0.078], [0.56, 0.076], [0.85, 0.064], [1, 0.02]]) },
      { t0: 0.7, t1: 0.95, dir: -1, rake: 0.5, h: finCurve([[0, 0.05], [0.25, 0.075], [0.7, 0.06], [1, 0.02]]) },
    ],
    caudal: { shape: 'fork', fork: 0.55, span: 0.14 },
    paired: [
      { type: 4, t: 0.33, yv: -0.3, len: 0.19, root: 0.024, dir: [0.3, 0.1, 1], shape: 'point' },
      { type: 5, t: 0.37, yv: -0.95, len: 0.09, root: 0.012, rootAxis: 'z', dir: [0.3, 0.8, 1], shape: 'point' },
    ],
    eye: { t: 0.13, yv: 0.45, r: 0.028, bulge: 0.2 },
  },
  mat: { physical: true, metal: 0.6, rough: 0.28, iri: 0.4, iriRange: [200, 440], k: 5.6, head: 0.18, flutter: 0.01, pect: 0.04, scull: 7, ripple: 7, fold: 0.4 },
  frag: (e) =>  `
  lfCol = lfCS(${gc$1(0xe4e8ea)}, ${gc$1(0xaab5bc)}, ${gc$1(0x2e3a42)}, fv, -0.3, 0.32);
  float bx = (fs - 0.17) / 0.52;
  float bandM = step(0.0, bx) * step(bx, 1.0) * smoothstep(-0.6, 0.0, fv) * body;
  float bands = smoothstep(0.45, 0.95, sin(bx * 56.55 - 1.2)) * mix(0.55, 1.0, step(0.0, sin(bx * 28.27)));
  lfCol = mix(lfCol, ${gc$1(0x4b5359)}, bands * bandM * lfAA(bx * 9.0) * 0.22);
  float sad = (1.0 - smoothstep(0.016, 0.03, abs(fs - 0.742))) * smoothstep(-0.85, -0.45, fv) * body;
  lfCol = mix(lfCol, ${gc$1(0x17181a)}, sad * 0.92);
  lfCol = mix(lfCol, ${gc$1(0x505a61)}, (1.0 - smoothstep(0.02, 0.08, fs)) * smoothstep(-0.2, 0.5, fv) * body * 0.5);
  float lip = ${MOUTH(-0.017, -0.1, 0.05, 0.005)};
  lfCol = mix(lfCol, ${gc$1(0x3c4146)}, lip * 0.6);
  hH -= lip;
  float gl = lfGill(fp, ${ev(e)}, ${gf$1(e[2] * 3.2)}, 0.004);
  lfCol = mix(lfCol, ${gc$1(0x6f787f)}, gl * body * 0.12);
  hH += gl * body;
  lfCol = mix(lfCol, ${gc$1(0x70797f)}, lfLLine(fs, fv, 0.16, 0.76, 0.58, 0.0, 0.03) * body * 0.5);
  ${SCALES(75, 9, 0.035, 0.07, 0.19, 0.31)}
  ${HEADBUMP(0.0001)}
  float up = smoothstep(0.4, 0.85, fv);
  lfMet = mix(mix(0.88, 0.3, up), 0.08, sad);
  lfMet = mix(lfMet, 0.55, smoothstep(0.5, 0.95, -fv));
  lfRou = mix(0.2, 0.36, max(up, sad)) + 0.06 * sRim;
  lfEnvK = mix(2.3, 1.1, max(up, sad));
  ${IRIDESCENCE(0.4)}
  lfIri *= 1.0 - sad;
  ${FINS({ op: 0.5, tip: 0.6, rayK: 0.8, rays: [20, 26, 16, 15, 6], spines: [12, 0.5, 0.25] })}
  if (isFin > 0.5) {
    vec3 fc = ${gc$1(0x9aa1a5)};
    if (ftype < 1.5) fc = mix(fc, ${gc$1(0x202326)}, smoothstep(0.82, 0.97, fedge));
    else if (ftype < 2.5) fc = mix(${gc$1(0x8f969a)}, ${gc$1(0x43484c)}, smoothstep(0.7, 1.0, fedge));
    else if (ftype < 3.5) fc = mix(${gc$1(0x8a9094)}, ${gc$1(0x3a3e41)}, smoothstep(0.5, 1.0, fedge));
    else if (ftype < 4.5) fc = ${gc$1(0x9e9a86)};
    else fc = ${gc$1(0x2e3134)};
    lfCol = fc;
  }
  ${LF_EYE(e, 0x9d8e66, 0.62)}
`,
  beh: {
    len: [0.28, 0.35], v: [0.35, 1.2, 2.9], acc: 3.2, turn: 2.4, head: 4.5,
    nbrR: 1.3, sepR: 0.42, maxN: 8, wSep: 2.4, wAli: 1.1, wCoh: 0.45, wGoal: 0.75, flee: 4, fleeW: 6, startle: 5,
    floorM: 0.5, margin: 0.35, obsBuf: 1.0, look: 0.6, pitch: 40, vAlign: 0.2, bc: [0.35, 0.6, 0.5, 1.1],
    f0: 1.5, stride: 0.7, fMax: 7, aMin: 0.05, aMax: 0.14, pect: 0, wander: 0.18, bankK: 0.55, bendK: 0.06, vDamp: 0.6,
    glint: [4, 11, 0.35, 0.65, 0.7],
  },
};

const SALEMA = {
  key: 'salema', id: 3, kind: K_MEADOW, shadow: true,
  geo: {
    sEnd: 0.81, stations: 28, radial: 18, egg: 0.1, ridge: 0.25, headK: 1.3,
    keys: outline(0.81, [
      [0.0, 0.004, -0.022, 0.008], [0.02, 0.03, -0.04, 0.02], [0.05, 0.06, -0.06, 0.032],
      [0.1, 0.095, -0.085, 0.044], [0.18, 0.125, -0.11, 0.054], [0.28, 0.14, -0.125, 0.058],
      [0.4, 0.138, -0.125, 0.056], [0.52, 0.12, -0.11, 0.048], [0.63, 0.09, -0.085, 0.036],
      [0.73, 0.055, -0.052, 0.022], [0.78, 0.042, -0.04, 0.014], [0.81, 0.045, -0.043, 0.012],
    ]),
    median: [
      { t0: 0.33, t1: 0.95, dir: 1, rake: 0.5, h: finCurve([[0, 0.03], [0.12, 0.072], [0.3, 0.07], [0.45, 0.058], [0.8, 0.055], [1, 0.018]]) },
      { t0: 0.72, t1: 0.95, dir: -1, rake: 0.5, h: finCurve([[0, 0.04], [0.25, 0.06], [1, 0.018]]) },
    ],
    caudal: { shape: 'fork', fork: 0.5, span: 0.115 },
    paired: [
      { type: 4, t: 0.31, yv: -0.3, len: 0.13, root: 0.018, dir: [0.35, 0.12, 1], shape: 'point' },
      { type: 5, t: 0.37, yv: -0.95, len: 0.07, root: 0.01, rootAxis: 'z', dir: [0.3, 0.8, 1], shape: 'point' },
    ],
    eye: { t: 0.105, yv: 0.4, r: 0.025, bulge: 0.22 },
  },
  mat: { physical: true, metal: 0.62, rough: 0.28, iri: 0.5, iriRange: [200, 420], k: 5.6, head: 0.16, flutter: 0.01, pect: 0.035, scull: 7, ripple: 7, fold: 0.45 },
  frag: (e, pt) => {
    const sp = pt(0.31, -0.16);
    return  `
  lfCol = lfCS(${gc$1(0xe2e6e8)}, ${gc$1(0xa9b4bc)}, ${gc$1(0x5a6a78)}, fv, -0.35, 0.62);
  float sy = (fv + 0.9) * 34.9;
  float stripes = smoothstep(0.1, 0.75, sin(sy)) * lfAA(sy * 0.159);
  float sMask = smoothstep(0.04, 0.1, fs) * (1.0 - smoothstep(0.72, 0.8, fs)) * (1.0 - smoothstep(0.8, 0.95, -fv)) * body;
  float gold = stripes * sMask;
  lfCol = mix(lfCol, ${gc$1(0xf6c43a)}, gold * 0.9);
  float spot = 1.0 - smoothstep(0.009, 0.015, length(vec2(fp.z - ${gf$1(sp[0])}, fp.y - ${gf$1(sp[1])})));
  lfCol = mix(lfCol, ${gc$1(0x141518)}, spot * body);
  float lip = ${MOUTH(-9e-3, -0.1, 0.035, 0.004)};
  lfCol = mix(lfCol, ${gc$1(0x3a4250)}, lip * 0.6);
  hH -= lip;
  float gl = lfGill(fp, ${ev(e)}, ${gf$1(e[2] * 3.2)}, 0.005);
  lfCol = mix(lfCol, ${gc$1(0x6d7a86)}, gl * body * 0.15);
  hH += gl * body;
  lfCol = mix(lfCol, ${gc$1(0x6e7a84)}, lfLLine(fs, fv, 0.14, 0.78, 0.55, 0.0, 0.03) * body * 0.4);
  ${SCALES(90, 8, 0.035, 0.06, 0.18, 0.27)}
  ${HEADBUMP(0.00008)}
  float up = smoothstep(0.45, 0.85, fv);
  lfMet = mix(mix(0.8, 0.3, up), 0.35, gold);
  lfRou = mix(0.22, 0.36, max(up, gold * 0.6)) + 0.06 * sRim;
  lfEnvK = mix(2.1, 1.1, max(up, gold * 0.5));
  ${IRIDESCENCE(0.3)}
  lfIri *= 1.0 - gold * 0.7;
  ${FINS({ op: 0.45, tip: 0.55, rayK: 0.82, rays: [20, 26, 16, 15, 6], spines: [11, 0.45, 0.22] })}
  if (isFin > 0.5) {
    vec3 fc = ${gc$1(0xa3a288)};
    if (ftype < 1.5) fc = mix(${gc$1(0x9c9a82)}, ${gc$1(0x6c6e66)}, smoothstep(0.7, 1.0, fedge));
    lfCol = fc;
  }
  ${LF_EYE(e, 0xf0c030, 0.55)}
`;
  },
  beh: {
    len: [0.25, 0.3], v: [0.1, 0.65, 2.3], acc: 2.2, turn: 1.8, head: 3.2,
    nbrR: 1.3, sepR: 0.55, maxN: 7, wSep: 2.0, wAli: 0.55, wCoh: 0.2, wGoal: 0.9, flee: 3.5, fleeW: 5, startle: 4,
    floorM: 0.3, margin: 0.3, obsBuf: 0.8, look: 0.6, pitch: 40, vAlign: 0.2,
    f0: 1.2, stride: 0.7, fMax: 6, aMin: 0.05, aMax: 0.14, pect: 0.1, wander: 0.12, bankK: 0.55, bendK: 0.06, vDamp: 0.6,
    glint: [4, 11, 0.35, 0.65, 0.7],
  },
};

const CHROMIS_KEYS = outline(0.76, [
  [0.0, 0.01, -0.012, 0.008], [0.03, 0.05, -0.045, 0.024], [0.08, 0.1, -0.09, 0.042],
  [0.15, 0.148, -0.132, 0.056], [0.25, 0.178, -0.16, 0.064], [0.36, 0.174, -0.157, 0.062],
  [0.48, 0.142, -0.132, 0.052], [0.6, 0.094, -0.09, 0.036], [0.7, 0.054, -0.052, 0.02],
  [0.76, 0.05, -0.048, 0.014],
]);
const chromisGeo = (fork, span, eyeR) => ({
  sEnd: 0.76, stations: 18, radial: 14, egg: 0.1, ridge: 0.3, headK: 1.25, keys: CHROMIS_KEYS,
  median: [
    { t0: 0.3, t1: 0.94, dir: 1, rake: 0.45, h: finCurve([[0, 0.03], [0.1, 0.07], [0.55, 0.06], [0.8, 0.1], [0.92, 0.08], [1, 0.03]]) },
    { t0: 0.72, t1: 0.94, dir: -1, rake: 0.45, h: finCurve([[0, 0.04], [0.3, 0.085], [0.6, 0.095], [1, 0.03]]) },
  ],
  caudal: { shape: 'fork', fork, span },
  paired: [
    { type: 4, t: 0.32, yv: -0.2, len: 0.15, root: 0.02, dir: [0.4, 0.1, 1], shape: 'point' },
    { type: 5, t: 0.36, yv: -0.95, len: 0.12, root: 0.01, rootAxis: 'z', dir: [0.25, 0.9, 1], shape: 'streamer' },
  ],
  eye: { t: 0.11, yv: 0.35, r: eyeR, bulge: 0.2 },
});
const chromisBeh = (len, sepR, fMax) => ({
  len, v: [0, 0.3, 1.7], acc: 6, turn: 7, head: 8,
  nbrR: 0.7, sepR, maxN: 6, wSep: 1.6, wAli: 0.25, wCoh: 0, wGoal: 1.2, flee: 2.5, fleeW: 6, startle: 3,
  floorM: 0.3, margin: 0.15, obsBuf: 0.35, look: 0.3, pitch: 35, vAlign: 0.25,
  f0: 3, stride: 0.6, fMax, aMin: 0.03, aMax: 0.14, pect: 0.4, wander: 0.2, bankK: 0.2, bendK: 0.03, vDamp: 0.3,
});

const CHROMIS_J = {
  key: 'chromisJ', id: 4, kind: K_CLOUD, shadow: false,
  geo: chromisGeo(0.7, 0.14, 0.04),
  mat: { physical: true, metal: 0.6, rough: 0.3, iri: 0.9, iriRange: [300, 440], k: 5.5, head: 0.14, flutter: 0.012, pect: 0.045, scull: 11, ripple: 9, fold: 0.15 },
  frag: (e) =>  `
  lfCol = lfCS(${gc$1(0x2f7bff)}, ${gc$1(0x1f64f2)}, ${gc$1(0x123fa6)}, fv, -0.3, 0.55);
  float l1 = lfLineAA(fv - (0.62 - 0.45 * fs), 0.07);
  float l2 = lfLineAA(fv - (0.28 - 0.25 * fs), 0.06);
  float lines = max(l1, l2) * (1.0 - smoothstep(0.3, 0.55, fs)) * body;
  lfCol = mix(lfCol, ${gc$1(0x8fe2ff)}, lines * 0.85);
  ${SCALES(35, 4.2, 0.1, 0.1, 0.2, 0.06)}
  lfMet = 0.7;
  lfRou = 0.3 - 0.1 * lines;
  lfEnvK = 2.6;
  lfIri = body * 0.8;
  lfIriT = 380.0 + 40.0 * sin(fs * 9.0 + fv * 3.0) + 40.0 * lines;
  ${FINS({ op: 0.6, tip: 0.55, rayK: 0.85, rays: [18, 24, 12, 16, 6], spines: [13, 0.55, 0.2] })}
  if (isFin > 0.5) lfCol = mix(${gc$1(0x2462dc)}, ${gc$1(0x6aa4f4)}, 0.45 * fedge);
  ${LF_EYE(e, 0x3b5f9c, 0.6)}
`,
  beh: chromisBeh([0.05, 0.07], 0.16, 12),
};

const CHROMIS_A = {
  key: 'chromisA', id: 5, kind: K_CLOUD, shadow: false,
  geo: chromisGeo(0.8, 0.155, 0.036),
  mat: { physical: false, metal: 0.12, rough: 0.46, k: 5.5, head: 0.14, flutter: 0.012, pect: 0.045, scull: 10, ripple: 9, fold: 0.15 },
  frag: (e) =>  `
  lfCol = lfCS(${gc$1(0x6a5a52)}, ${gc$1(0x4a3a34)}, ${gc$1(0x2a2a3a)}, fv, -0.4, 0.5);
  ${SCALES(35, 4.2, 0.12, 0.28, 0.2, 0.12)}
  float scC = sAA * (1.0 - smoothstep(0.0, 0.35, length(sD)));
  lfCol = mix(lfCol * (1.0 + 0.3 * scC), ${gc$1(0x5a6e96)}, scC * 0.35);
  float gl = lfGill(fp, ${ev(e)}, ${gf$1(e[2] * 2.6)}, 0.006);
  lfCol = mix(lfCol, ${gc$1(0x16100b)}, gl * body * 0.5);
  hH += gl * body;
  ${HEADBUMP(0.00012)}
  lfMet = 0.12;
  lfRou = 0.46 - 0.1 * sRim;
  lfEnvK = 1.3;
  ${FINS({ op: 0.85, tip: 0.7, rayK: 0.8, rays: [18, 24, 12, 16, 6], spines: [13, 0.55, 0.2] })}
  if (isFin > 0.5) {
    vec3 fc = mix(${gc$1(0x33251b)}, ${gc$1(0x1f150e)}, fedge * 0.5);
    if (ftype < 1.5) fc = mix(${gc$1(0x4c4034)}, ${gc$1(0x1f150e)}, smoothstep(0.35, 0.85, abs(fv * 2.0 - 1.0)));
    lfCol = fc;
  }
  ${LF_EYE(e, 0x5e4c34, 0.6)}
`,
  beh: chromisBeh([0.11, 0.13], 0.24, 10),
};

const ANTHIAS = {
  key: 'anthias', id: 6, kind: K_HOVER, shadow: false,
  geo: {
    sEnd: 0.76, stations: 24, radial: 16, egg: 0.1, ridge: 0.3, headK: 1.25,
    keys: outline(0.76, [
      [0.0, 0.006, -0.014, 0.007], [0.03, 0.04, -0.045, 0.022], [0.08, 0.085, -0.085, 0.038],
      [0.15, 0.13, -0.12, 0.05], [0.25, 0.158, -0.145, 0.058], [0.36, 0.16, -0.145, 0.056],
      [0.48, 0.135, -0.125, 0.048], [0.6, 0.09, -0.085, 0.034], [0.7, 0.052, -0.05, 0.02],
      [0.76, 0.05, -0.048, 0.015],
    ]),
    median: [
      { t0: 0.29, t1: 0.94, dir: 1, rake: 0.4, h: (v) => { const q = (v - 0.12) / 0.05; return 0.075 + 0.12 * Math.exp(-q * q) - 0.01 * v; } },
      { t0: 0.72, t1: 0.94, dir: -1, rake: 0.45, h: finCurve([[0, 0.04], [0.3, 0.08], [0.7, 0.07], [1, 0.03]]) },
    ],
    caudal: { shape: 'lunate', fork: 0.55, span: 0.15, fil: 0.5 },
    paired: [
      { type: 4, t: 0.31, yv: -0.2, len: 0.12, root: 0.02, dir: [0.45, 0.1, 1], shape: 'point' },
      { type: 5, t: 0.36, yv: -0.95, len: 0.3, root: 0.012, rootAxis: 'z', dir: [0.25, 1.1, 1], shape: 'streamer' },
    ],
    eye: { t: 0.11, yv: 0.4, r: 0.033, bulge: 0.2 },
  },
  mat: { physical: true, metal: 0.12, rough: 0.36, iri: 0.4, iriRange: [220, 420], k: 5.6, head: 0.12, flutter: 0.018, pect: 0.04, scull: 9, ripple: 8, fold: 0.1 },
  vary: 'varying float vLfVar;\n',
  setVary: 'vLfVar = aPhase;\n',
  frag: (e, pt) => {
    const cs = pt(0.71, 0.0);
    return  `
  lfCol = lfCS(${gc$1(0xffb0b4)}, ${gc$1(0xf2607a)}, ${gc$1(0xd83c5a)}, fv, -0.4, 0.6);
  float yl = fp.y + 0.3 * (0.5 - fp.z);
  float hd = 1.0 - smoothstep(0.2, 0.27, fs);
  float stp = max(lfLineAA(yl - 0.045, 0.01), max(lfLineAA(yl - 0.018, 0.01), lfLineAA(yl + 0.012, 0.009))) * hd * body;
  lfCol = mix(lfCol, ${gc$1(0xffd23c)}, stp * 0.9);
  float ca = step(vLfVar, 0.3);
  vec3 caC = lfCS(${gc$1(0xe29a80)}, ${gc$1(0xcc5236)}, ${gc$1(0xa33428)}, fv, -0.4, 0.6);
  caC = mix(caC, ${gc$1(0x2a0e0a)}, (1.0 - smoothstep(0.014, 0.021, length(vec2(fp.z - ${gf$1(cs[0])}, fp.y - ${gf$1(cs[1])})))) * 0.9);
  caC *= 1.0 - 0.3 * step(0.93, lfNoise(vec2(fs * 160.0, fv * 40.0)));
  lfCol = mix(lfCol, caC, ca * body);
  ${SCALES(50, 6, 0.09, 0.08, 0.2, 0.18)}
  lfCol = mix(lfCol, ${gc$1(0xffc060)}, (1.0 - smoothstep(0.1, 0.35, length(sD))) * sAA * 0.3 * (1.0 - ca));
  float lip = ${MOUTH(-4e-3, -0.3, 0.045, 0.004)};
  lfCol = mix(lfCol, ${gc$1(0x9a4638)}, lip * 0.6);
  hH -= lip;
  float gl = lfGill(fp, ${ev(e)}, ${gf$1(e[2] * 3.0)}, 0.005);
  lfCol = mix(lfCol, ${gc$1(0xb05a48)}, gl * body * 0.5);
  hH += gl * body;
  ${HEADBUMP(0.00015)}
  lfCol = mix(lfCol, ${gc$1(0xb86a55)}, lfLLine(fs, fv, 0.16, 0.72, 0.62, 0.05, 0.03) * body * 0.35);
  lfMet = 0.12;
  lfRou = 0.36 + 0.05 * sRim;
  lfEnvK = 1.4;
  ${IRIDESCENCE(0.25)}
  ${FINS({ op: 0.7, tip: 0.6, rayK: 0.85, rays: [22, 24, 12, 14, 5], spines: [10, 0.45, 0.35] })}
  if (isFin > 0.5) {
    vec3 fc = mix(${gc$1(0xf06a80)}, ${gc$1(0xffd050)}, 0.45 * fedge);
    if (ftype > 4.5) fc = ${gc$1(0xffd23c)};
    if (ftype < 1.5) fc = mix(${gc$1(0xe8506c)}, ${gc$1(0xff98a4)}, fedge * 0.5);
    lfCol = fc;
    if (ca > 0.5) {
      lfCol = mix(${gc$1(0xe0503a)}, ${gc$1(0xf2a08c)}, fedge * 0.5);
      float fa = abs(fv * 2.0 - 1.0);
      if (ftype < 1.5) lfTrim = step(0.72 + 0.12 * fa, fedge * (0.45 + 0.55 * fa * fa + 0.5 * pow(fa, 8.0)));
      else if (ftype < 2.5) lfTrim = max(step(0.085, fedge * (0.075 + 0.12 * exp(-pow((fv - 0.12) / 0.05, 2.0)) - 0.01 * fv)), step(0.15, fedge) * step(0.42, fv) * step(fv, 0.5));
      else if (ftype > 4.5) lfTrim = step(0.3, fedge * (0.2 + 0.8 * fv * fv * fv));
    }
  }
  lfFlu = lfCol * vec3(1.0, 0.3, 0.35) * (0.22 * (1.0 - isEye)) * (1.0 - 0.8 * ca);
  ${LF_EYE(e, 0xc2645a, 0.58)}
`;
  },
  beh: {
    len: [0.16, 0.2], v: [0, 0.2, 1.5], acc: 3.5, turn: 3.5, head: 2.5,
    nbrR: 0.8, sepR: 0.3, maxN: 6, wSep: 1.6, wAli: 0.15, wCoh: 0, wGoal: 1.0, flee: 2.0, fleeW: 5, startle: 2.5,
    floorM: 0.3, margin: 0.2, obsBuf: 0.4, look: 0.4, pitch: 30, vAlign: 0.2,
    f0: 2, stride: 0.65, fMax: 8, aMin: 0.025, aMax: 0.12, pect: 0.5, wander: 0.06, bankK: 0.2, bendK: 0.03, vDamp: 0.8,
  },
};

const WRASSE = {
  key: 'wrasse', id: 7, kind: K_DART, shadow: false,
  geo: {
    sEnd: 0.84, stations: 24, radial: 16, egg: 0.08, ridge: 0.2, headK: 1.25,
    keys: outline(0.84, [
      [0.0, 0.003, -0.01, 0.006], [0.03, 0.026, -0.03, 0.018], [0.08, 0.058, -0.06, 0.034],
      [0.15, 0.09, -0.085, 0.046], [0.25, 0.112, -0.1, 0.054], [0.38, 0.118, -0.104, 0.054],
      [0.52, 0.106, -0.094, 0.048], [0.66, 0.08, -0.074, 0.036], [0.77, 0.056, -0.052, 0.024],
      [0.84, 0.05, -0.048, 0.018],
    ]),
    median: [
      { t0: 0.24, t1: 0.95, dir: 1, rake: 0.35, h: finCurve([[0, 0.03], [0.08, 0.045], [0.9, 0.05], [1, 0.02]]) },
      { t0: 0.6, t1: 0.95, dir: -1, rake: 0.35, h: finCurve([[0, 0.03], [0.1, 0.045], [0.9, 0.048], [1, 0.02]]) },
    ],
    caudal: { shape: 'lunate', fork: 0.12, span: 0.095, fil: 0.18 },
    paired: [
      { type: 4, t: 0.24, yv: -0.1, len: 0.1, root: 0.018, dir: [0.55, 0.08, 1], shape: 'round' },
      { type: 5, t: 0.33, yv: -0.95, len: 0.045, root: 0.008, rootAxis: 'z', dir: [0.25, 0.8, 1], shape: 'point' },
    ],
    eye: { t: 0.09, yv: 0.45, r: 0.02, bulge: 0.22 },
  },
  mat: { physical: true, metal: 0.15, rough: 0.34, iri: 0.5, iriRange: [300, 440], k: 6.2, head: 0.12, flutter: 0.012, pect: 0.05, scull: 9, ripple: 8, fold: 0.3 },
  vary: 'varying float vLfVar;\n',
  setVary: 'vLfVar = aPhase;\n',
  frag: (e, pt) => {
    const cs = pt(0.3, 0.3);
    return  `
  float cj = step(0.5, vLfVar);
  float hm = 1.0 - smoothstep(0.18, 0.27, fs - 0.025 * fv);
  vec3 grn = lfCS(${gc$1(0x8ee0b0)}, ${gc$1(0x34b87c)}, ${gc$1(0x1f8458)}, fv, -0.4, 0.55);
  vec3 blu = lfCS(${gc$1(0x7aa0ee)}, ${gc$1(0x4270de)}, ${gc$1(0x2c4cae)}, fv, -0.4, 0.55);
  lfCol = mix(grn, blu, hm);
  float wv = 0.006 * sin(fp.z * 90.0);
  float hl = max(lfLineAA(fp.y - 0.02 - 0.06 * (0.5 - fp.z) - wv, 0.007), lfLineAA(fp.y + 0.006 - 0.02 * (0.5 - fp.z) + wv, 0.007));
  lfCol = mix(lfCol, ${gc$1(0xf25a38)}, hl * hm * body * 0.85);
  float bd = abs(fs - 0.285);
  float tq = 1.0 - smoothstep(0.009, 0.015, bd);
  float rd = (1.0 - smoothstep(0.02, 0.026, bd)) * (1.0 - tq);
  float bandV = smoothstep(-0.9, -0.6, fv) * (1.0 - smoothstep(0.75, 0.95, fv)) * body;
  lfCol = mix(lfCol, ${gc$1(0xea4a30)}, rd * bandV * 0.9);
  lfCol = mix(lfCol, ${gc$1(0x3ae6dc)}, tq * bandV * 0.9);
  vec3 cjC = lfCS(${gc$1(0xf2f4f2)}, ${gc$1(0xd4ecf4)}, ${gc$1(0x2e5a44)}, fv, -0.15, 0.6);
  float zz = abs(fract(fs * 13.0) - 0.5) * 2.0;
  float cjB = lfLineAA(fv - (0.26 + 0.12 * zz - 0.12 * (fs - 0.5)), 0.32) * smoothstep(0.2, 0.26, fs) * (1.0 - smoothstep(0.74, 0.8, fs));
  cjC = mix(cjC, ${gc$1(0xff7a1e)}, cjB * 0.95);
  cjC = mix(cjC, ${gc$1(0x141c30)}, 1.0 - smoothstep(0.009, 0.014, length(vec2(fp.z - ${gf$1(cs[0])}, fp.y - ${gf$1(cs[1])}))));
  cjC = mix(cjC, ${gc$1(0x4a7a8a)}, hm * smoothstep(-0.3, 0.3, fv) * 0.6);
  lfCol = mix(lfCol, cjC, cj * body);
  ${SCALES(32, 3.0, 0.1, 0.1, 0.24, 0.2)}
  lfDH *= 0.5 + 0.9 * fract(sRnd * 3.71);
  float sb = lfLineAA(sD.x + 0.05, 0.14) * (1.0 - smoothstep(0.25, 0.42, abs(sD.y))) * sAA * step(0.3, fs) * step(fs, 0.82);
  sb *= (0.35 + 0.65 * fract(sRnd * 7.31)) * smoothstep(-0.85, -0.3, fv) * (1.0 - cj);
  lfCol = mix(lfCol, ${gc$1(0xd0603c)}, sb * 0.55);
  float lip = ${MOUTH(-35e-4, -0.05, 0.03, 0.004)};
  lfCol = mix(lfCol, ${gc$1(0x2e3a6a)}, lip * 0.6);
  hH -= lip;
  float gl = lfGill(fp, ${ev(e)}, ${gf$1(e[2] * 3.4)}, 0.005);
  lfCol = mix(lfCol, ${gc$1(0x2e3a6a)}, gl * body * 0.5);
  hH += gl * body;
  ${HEADBUMP(0.00015)}
  lfMet = 0.15;
  lfRou = 0.34 + 0.05 * sRim + 0.1 * (fract(sRnd * 5.37) - 0.5) * sAA;
  lfEnvK = 1.6;
  lfIri = body * (0.5 - hm * 0.2);
  lfIriT = 380.0 + 50.0 * sin(fs * 10.0 + fv * 2.0);
  ${FINS({ op: 0.75, tip: 0.6, rayK: 0.85, rays: [16, 20, 14, 13, 6], spines: [8, 0.4, 0.1] })}
  if (isFin > 0.5) {
    vec3 fc = mix(${gc$1(0x2f9a6a)}, ${gc$1(0x4a7ae0)}, smoothstep(0.55, 1.0, fedge));
    if (ftype > 3.5 && ftype < 4.5) fc = ${gc$1(0x8cc8c0)};
    vec3 fj = mix(${gc$1(0xc8d8d8)}, ${gc$1(0x6a9aa8)}, fedge);
    if (ftype > 1.5 && ftype < 2.5) fj = mix(mix(${gc$1(0xf06a2a)}, ${gc$1(0x3a6ad0)}, smoothstep(0.75, 0.95, fedge)), ${gc$1(0x101820)}, (1.0 - smoothstep(0.12, 0.2, fv)) * smoothstep(0.3, 0.5, fedge));
    lfCol = mix(fc, fj, cj);
  }
  lfFlu = vec3(1.0, 0.32, 0.18) * (((hl * hm + rd * bandV + sb * 0.6) * (1.0 - cj) + cjB * cj) * body * 0.22);
  ${LF_EYE(e, 0xb8582e, 0.55)}
`;
  },
  beh: {
    len: [0.18, 0.22], v: [0, 0.8, 2.5], acc: 6.5, turn: 5, head: 6,
    nbrR: 0, sepR: 0, maxN: 0, wSep: 0, wAli: 0, wCoh: 0, wGoal: 1.4, flee: 1.2, fleeW: 6,
    floorM: 0.22, margin: 0.25, obsBuf: 0.5, look: 0.35, pitch: 55, vAlign: 0.3,
    f0: 2, stride: 0.7, fMax: 9, aMin: 0.02, aMax: 0.13, pect: 0.55, wander: 0.1, bankK: 0.25, bendK: 0.07, vDamp: 0.5,
  },
};

const GROUPER = {
  key: 'grouper', id: 8, kind: K_GROUPER, shadow: true,
  geo: {
    sEnd: 0.82, stations: 32, radial: 22, egg: 0.08, ridge: 0.12, headK: 1.3,
    keys: outline(0.82, [
      [0.0, 0.004, -0.03, 0.012], [0.02, 0.03, -0.05, 0.032], [0.06, 0.065, -0.075, 0.054],
      [0.12, 0.1, -0.1, 0.072], [0.2, 0.13, -0.122, 0.086], [0.3, 0.148, -0.135, 0.09],
      [0.42, 0.148, -0.132, 0.086], [0.55, 0.13, -0.115, 0.074], [0.66, 0.1, -0.09, 0.056],
      [0.75, 0.072, -0.066, 0.04], [0.82, 0.068, -0.064, 0.032],
    ]),
    median: [
      { t0: 0.34, t1: 0.96, dir: 1, rake: 0.3, h: finCurve([[0, 0.03], [0.1, 0.055], [0.45, 0.05], [0.55, 0.07], [0.78, 0.085], [0.95, 0.06], [1, 0.03]]) },
      { t0: 0.72, t1: 0.95, dir: -1, rake: 0.3, h: finCurve([[0, 0.035], [0.35, 0.08], [0.75, 0.08], [1, 0.03]]) },
    ],
    caudal: { shape: 'round', span: 0.105 },
    paired: [
      { type: 4, t: 0.31, yv: -0.15, len: 0.15, root: 0.03, dir: [0.5, 0.15, 1], shape: 'round' },
      { type: 5, t: 0.36, yv: -0.95, len: 0.095, root: 0.014, rootAxis: 'z', dir: [0.3, 0.8, 1], shape: 'round' },
    ],
    eye: { t: 0.125, yv: 0.55, r: 0.019, bulge: 0.3 },
  },
  mat: { physical: false, metal: 0.03, rough: 0.52, k: 4.8, head: 0.1, flutter: 0.012, pect: 0.06, scull: 2.8, ripple: 3.2, fold: 0.2 },
  frag: (e) =>  `
  vec2 bp = vec2(fp.z * 13.0, fp.y * 15.0);
  float n1 = lfFbm(bp);
  float n2 = lfNoise(vec2(fp.z * 41.0 + 3.1, fp.y * 37.0 - 1.7));
  float cols = 0.5 + 0.5 * sin(fp.z * 52.0 + n1 * 3.0);
  float bl = smoothstep(0.56, 0.74, n1 * 0.8 + cols * 0.1 + n2 * 0.14);
  vec3 brn = mix(${gc$1(0x4a2f22)}, ${gc$1(0x5a4632)}, lfNoise(bp * 0.35));
  lfCol = mix(brn, ${gc$1(0xb4a07c)}, bl * 0.55);
  vec2 eq = vec2(fp.z - ${gf$1(e[0])}, fp.y - ${gf$1(e[1])});
  float streak = smoothstep(0.55, 0.95, sin(atan(eq.y, -eq.x) * 9.0 + n1 * 2.0)) * smoothstep(${gf$1(e[2] * 1.4)}, ${gf$1(e[2] * 2.0)}, length(eq)) * (1.0 - smoothstep(0.12, 0.2, fs));
  lfCol = mix(lfCol, ${gc$1(0xa89272)}, streak * body * 0.35);
  lfCol *= 1.0 - 0.3 * smoothstep(0.4, 1.0, fv);
  lfCol = mix(lfCol, ${gc$1(0x9c8058)}, smoothstep(0.3, 0.95, -fv) * 0.5);
  float jaw = ${MOUTH(-0.013, 0.05, 0.14, 0.006)};
  lfCol = mix(lfCol, ${gc$1(0x1f140e)}, jaw * 0.8);
  hH -= jaw;
  float gl = lfGill(fp, ${ev(e)}, ${gf$1(e[2] * 5.0)}, 0.006);
  lfCol = mix(lfCol, ${gc$1(0x2e1d14)}, gl * body * 0.45);
  hH += gl * body;
  lfCol = mix(lfCol, ${gc$1(0x3a281c)}, lfLLine(fs, fv, 0.2, 0.8, 0.55, 0.0, 0.03) * body * 0.3);
  ${SCALES(120, 13, 0.06, 0.08, 0.18, 1.05)}
  ${HEADBUMP(0.0012)}
  lfMet = 0.03;
  lfRou = 0.5 - 0.06 * sRim;
  lfEnvK = 1.2;
  ${FINS({ op: 0.92, tip: 0.8, rayK: 0.8, rays: [18, 26, 11, 17, 6], spines: [11, 0.46, 0.35] })}
  lfPectK = 1.0;
  if (isFin > 0.5) {
    vec3 fc = mix(brn * 0.85, ${gc$1(0x8a7050)}, bl * 0.3);
    float marg = smoothstep(0.9, 0.98, fedge);
    if (ftype < 1.5 || (ftype > 2.5 && ftype < 3.5)) fc = mix(fc, ${gc$1(0xd8d0c0)}, marg);
    if (ftype > 1.5 && ftype < 2.5) fc = mix(fc, ${gc$1(0xd8d0c0)}, marg * step(0.46, fv));
    if (ftype > 3.5 && ftype < 4.5) fc = mix(${gc$1(0x6a4630)}, ${gc$1(0x8a5c3a)}, fedge);
    lfCol = fc;
  }
  ${LF_EYE(e, 0x8f7338, 0.52)}
`,
  beh: {
    len: [0.9, 1.2], v: [0, 0.25, 0.6], acc: 0.5, turn: 0.8, head: 0.6,
    nbrR: 0, sepR: 0, maxN: 0, wSep: 0, wAli: 0, wCoh: 0, wGoal: 1.0, flee: 0, fleeW: 0,
    floorM: 0.35, margin: 0.7, obsBuf: 0.8, look: 0.8, pitch: 20, vAlign: 0.15,
    f0: 0.45, stride: 0.8, fMax: 1.8, aMin: 0.015, aMax: 0.07, pect: 0.85, wander: 0.03, bankK: 0.2, bendK: 0.04, vDamp: 1.0,
  },
};

const BOGUE = {
  key: 'bogue', id: 9, kind: K_BALL, shadow: false,
  geo: {
    sEnd: 0.8, stations: 18, radial: 12, egg: 0.08, ridge: 0.1, headK: 1.25,
    keys: outline(0.8, [
      [0.0, 0.004, -8e-3, 0.006], [0.03, 0.025, -0.028, 0.02], [0.08, 0.05, -0.05, 0.036],
      [0.15, 0.074, -0.068, 0.05], [0.26, 0.09, -0.083, 0.058], [0.38, 0.093, -0.086, 0.058],
      [0.5, 0.085, -0.078, 0.052], [0.62, 0.064, -0.06, 0.04], [0.72, 0.04, -0.038, 0.026],
      [0.8, 0.034, -0.032, 0.016],
    ]),
    median: [
      { t0: 0.38, t1: 0.94, dir: 1, rake: 0.5, h: finCurve([[0, 0.02], [0.15, 0.045], [0.55, 0.035], [0.9, 0.035], [1, 0.012]]) },
      { t0: 0.73, t1: 0.95, dir: -1, rake: 0.5, h: finCurve([[0, 0.02], [0.25, 0.038], [1, 0.012]]) },
    ],
    caudal: { shape: 'fork', fork: 0.55, span: 0.1 },
    paired: [
      { type: 4, t: 0.3, yv: -0.25, len: 0.09, root: 0.012, dir: [0.4, 0.12, 1], shape: 'point' },
      { type: 5, t: 0.4, yv: -0.95, len: 0.05, root: 0.008, rootAxis: 'z', dir: [0.3, 0.8, 1], shape: 'point' },
    ],
    eye: { t: 0.105, yv: 0.25, r: 0.03, bulge: 0.18 },
  },
  mat: { physical: true, metal: 0.8, rough: 0.22, iri: 0.6, iriRange: [200, 440], k: 6.2, head: 0.14, flutter: 0.01, pect: 0.03, scull: 8, ripple: 8, fold: 0.55 },
  frag: (e, pt) => {
    const sp = pt(0.3, -0.12);
    return  `
  lfCol = lfCS(${gc$1(0xe8ebea)}, ${gc$1(0xc2c9c4)}, ${gc$1(0x6c7350)}, fv, -0.35, 0.55);
  float gs = max(max(lfLineAA(fv - 0.5, 0.06), lfLineAA(fv - 0.3, 0.06)), max(lfLineAA(fv - 0.1, 0.05), lfLineAA(fv + 0.1, 0.045)));
  float gold = gs * smoothstep(0.1, 0.18, fs) * (1.0 - smoothstep(0.7, 0.78, fs)) * body;
  lfCol = mix(lfCol, ${gc$1(0xc9a852)}, gold * 0.6);
  float spot = 1.0 - smoothstep(0.007, 0.012, length(vec2(fp.z - ${gf$1(sp[0])}, fp.y - ${gf$1(sp[1])})));
  lfCol = mix(lfCol, ${gc$1(0x1c1c1c)}, spot * body);
  float gl = lfGill(fp, ${ev(e)}, ${gf$1(e[2] * 2.4)}, 0.005);
  lfCol = mix(lfCol, ${gc$1(0x5a6150)}, gl * body * 0.4);
  hH += gl * body;
  ${SCALES(88, 7, 0.04, 0.05, 0.16, 0.135)}
  ${HEADBUMP(0.00005)}
  lfCol = mix(lfCol, ${gc$1(0x7a8277)}, lfLLine(fs, fv, 0.14, 0.78, 0.45, 0.0, 0.03) * body * 0.35);
  float up = smoothstep(0.4, 0.8, fv);
  lfMet = mix(mix(0.9, 0.35, up), 0.4, gold);
  lfRou = mix(0.2, 0.34, max(up, gold * 0.5)) + 0.05 * sRim;
  lfEnvK = mix(2.4, 1.1, up);
  ${IRIDESCENCE(0.45)}
  lfIri *= 1.0 - gold * 0.6;
  ${FINS({ op: 0.35, tip: 0.5, rayK: 0.85, rays: [19, 22, 16, 15, 6], spines: [14, 0.55, 0.15] })}
  if (isFin > 0.5) lfCol = mix(${gc$1(0x8c8b76)}, ${gc$1(0x9c9680)}, 0.4 * fedge);
  ${LF_EYE(e, 0xc2bea8, 0.6)}
`;
  },
  beh: {
    len: [0.105, 0.17], v: [0.3, 0.9, 2.6], acc: 4, turn: 4, head: 6,
    nbrR: 0.55, sepR: 0.22, maxN: 6, wSep: 2.2, wAli: 0.9, wCoh: 0.1, wGoal: 1.2, flee: 3.2, fleeW: 7, startle: 5.5,
    floorM: 1.0, margin: 0.3, obsBuf: 0.6, look: 0.4, pitch: 35, vAlign: 0.2,
    f0: 2.5, stride: 0.6, fMax: 11, aMin: 0.045, aMax: 0.15, pect: 0, wander: 0.25, bankK: 0.5, bendK: 0.05, vDamp: 0.6,
    glint: [3, 10, 0.35, 0.7, 0.5],
  },
};

const PARROT = {
  key: 'parrot', id: 10, kind: K_GRAZE, shadow: true,
  geo: {
    sEnd: 0.8, stations: 28, radial: 18, egg: 0.1, ridge: 0.15, headK: 1.3,
    keys: outline(0.8, [
      [0.0, 0.012, -0.02, 0.014], [0.02, 0.045, -0.045, 0.032], [0.06, 0.085, -0.075, 0.05],
      [0.12, 0.125, -0.105, 0.066], [0.2, 0.152, -0.128, 0.076], [0.3, 0.165, -0.14, 0.078],
      [0.42, 0.16, -0.135, 0.074], [0.55, 0.135, -0.115, 0.062], [0.66, 0.1, -0.088, 0.046],
      [0.75, 0.075, -0.068, 0.034], [0.8, 0.074, -0.068, 0.028],
    ]),
    median: [
      { t0: 0.33, t1: 0.96, dir: 1, rake: 0.35, h: finCurve([[0, 0.03], [0.1, 0.05], [0.9, 0.055], [1, 0.025]]) },
      { t0: 0.74, t1: 0.96, dir: -1, rake: 0.35, h: finCurve([[0, 0.03], [0.2, 0.052], [1, 0.025]]) },
    ],
    caudal: { shape: 'truncate', span: 0.12 },
    paired: [
      { type: 4, t: 0.3, yv: -0.12, len: 0.12, root: 0.024, dir: [0.5, 0.08, 1], shape: 'round' },
      { type: 5, t: 0.38, yv: -0.95, len: 0.065, root: 0.01, rootAxis: 'z', dir: [0.3, 0.8, 1], shape: 'point' },
    ],
    eye: { t: 0.12, yv: 0.45, r: 0.022, bulge: 0.22 },
  },
  mat: { physical: false, metal: 0.06, rough: 0.42, k: 5.5, head: 0.12, flutter: 0.012, pect: 0.05, scull: 6, ripple: 6, fold: 0.3 },
  frag: (e, pt) => {
    const sp = pt(0.3, 0.02);
    return  `
  lfCol = lfCS(${gc$1(0xe8786a)}, ${gc$1(0xd8403a)}, ${gc$1(0xa02a28)}, fv, -0.4, 0.6);
  float grey = (1.0 - smoothstep(0.2, 0.34, fs)) * smoothstep(-0.25, 0.25, fv);
  lfCol = mix(lfCol, ${gc$1(0x6f6a67)}, grey * 0.8);
  float sad = smoothstep(0.62, 0.66, fs) * (1.0 - smoothstep(0.74, 0.78, fs)) * smoothstep(0.05, 0.35, fv) * body;
  lfCol = mix(lfCol, ${gc$1(0xf5c238)}, sad * 0.9);
  float spot = 1.0 - smoothstep(0.011, 0.018, length(vec2(fp.z - ${gf$1(sp[0])}, fp.y - ${gf$1(sp[1])})));
  lfCol = mix(lfCol, ${gc$1(0x1d1212)}, spot * body);
  float beak = (1.0 - smoothstep(0.012, 0.025, fs)) * body;
  lfCol = mix(lfCol, ${gc$1(0xd4cfc2)}, beak * 0.9);
  float gl = lfGill(fp, ${ev(e)}, ${gf$1(e[2] * 3.4)}, 0.007);
  lfCol = mix(lfCol, lfCol * 0.6, gl * body * 0.6);
  hH += gl * body;
  ${SCALES(30, 3.5, 0.12, 0.2, 0.2, 0.36)}
  ${HEADBUMP(0.0003)}
  lfMet = 0.06;
  lfRou = mix(0.42, 0.2, beak) - 0.05 * sRim;
  lfEnvK = 1.3;
  ${FINS({ op: 0.78, tip: 0.65, rayK: 0.82, rays: [15, 20, 12, 14, 6], spines: [9, 0.45, 0.12] })}
  if (isFin > 0.5) {
    vec3 fc = mix(${gc$1(0xd84a44)}, ${gc$1(0xf09a90)}, fedge * 0.5);
    if (ftype < 1.5) fc = mix(fc, ${gc$1(0xa02a28)}, smoothstep(0.85, 1.0, fedge));
    lfCol = fc;
  }
  lfFlu = lfCol * vec3(1.0, 0.3, 0.3) * (0.2 * (1.0 - isEye));
  ${LF_EYE(e, 0xc28a3a, 0.55)}
`;
  },
  beh: {
    len: [0.3, 0.42], v: [0, 0.45, 1.8], acc: 1.6, turn: 1.6, head: 2.2,
    nbrR: 0, sepR: 0, maxN: 0, wSep: 0, wAli: 0, wCoh: 0, wGoal: 1.2, flee: 2.0, fleeW: 4,
    floorM: 0.35, margin: 0.12, obsBuf: 0.08, look: 0.2, pitch: 55, vAlign: 0.15,
    f0: 1.2, stride: 0.75, fMax: 5, aMin: 0.02, aMax: 0.1, pect: 0.7, wander: 0.05, bankK: 0.2, bendK: 0.05, vDamp: 0.8,
  },
};

const SCORPION = {
  key: 'scorpion', id: 11, kind: K_REST, shadow: true,
  geo: {
    sEnd: 0.8, stations: 28, radial: 20, egg: 0.02, ridge: 0, headK: 1.3,
    keys: outline(0.8, [
      [0.0, 0.01, -0.03, 0.03], [0.02, 0.035, -0.05, 0.055], [0.06, 0.07, -0.08, 0.085],
      [0.12, 0.11, -0.105, 0.11], [0.2, 0.14, -0.125, 0.118], [0.3, 0.15, -0.13, 0.106],
      [0.42, 0.135, -0.115, 0.088], [0.55, 0.105, -0.09, 0.066], [0.66, 0.08, -0.07, 0.048],
      [0.75, 0.06, -0.054, 0.034], [0.8, 0.058, -0.052, 0.028],
    ]),
    median: [
      { t0: 0.24, t1: 0.96, dir: 1, rake: 0.25, h: finCurve([[0, 0.06], [0.1, 0.115], [0.25, 0.12], [0.5, 0.075], [0.6, 0.065], [0.66, 0.09], [0.88, 0.085], [1, 0.04]]) },
      { t0: 0.74, t1: 0.95, dir: -1, rake: 0.3, h: finCurve([[0, 0.05], [0.3, 0.085], [0.8, 0.075], [1, 0.035]]) },
    ],
    caudal: { shape: 'round', span: 0.1 },
    paired: [
      { type: 4, t: 0.33, yv: -0.35, len: 0.21, root: 0.05, dir: [0.65, 0.3, 1.0], shape: 'fan' },
      { type: 5, t: 0.37, yv: -0.95, len: 0.1, root: 0.02, rootAxis: 'z', dir: [0.5, 0.9, 0.6], shape: 'round' },
    ],
    eye: { t: 0.15, yv: 0.72, r: 0.027, bulge: 0.55 },
    flaps: [
      { t: 0.14, yv: 0.95, len: 0.06, w: 0.014, back: 0.25, sides: [-1, 1] },
      { t: 0.18, yv: 0.9, len: 0.035, w: 0.012, back: 0.4, sides: [-1, 1] },
      { t: 0.02, yv: -0.7, len: 0.03, w: 0.016, back: 0.1, sides: [-1, 1] },
      { t: 0.05, yv: -0.8, len: 0.035, w: 0.014, back: 0.2, sides: [-1, 1] },
      { t: 0.09, yv: -0.75, len: 0.025, w: 0.012, back: 0.3, sides: [-1, 1] },
      { t: 0.16, yv: -0.3, len: 0.028, w: 0.014, back: 0.35, sides: [-1, 1] },
      { t: 0.22, yv: -0.1, len: 0.025, w: 0.012, back: 0.4, sides: [-1, 1] },
      { t: 0.2, yv: 1.0, len: 0.035, w: 0.014, back: 0.5, sides: [0] },
      { t: 0.25, yv: 0.1, len: 0.03, w: 0.006, back: 0.6, sides: [-1, 1] },
      { t: 0.36, yv: 0.35, len: 0.022, w: 0.01, back: 0.5, sides: [-1, 1] },
      { t: 0.48, yv: 0.34, len: 0.02, w: 0.01, back: 0.5, sides: [-1, 1] },
      { t: 0.6, yv: 0.32, len: 0.018, w: 0.009, back: 0.5, sides: [-1, 1] },
      { t: 0.72, yv: 0.3, len: 0.016, w: 0.009, back: 0.5, sides: [-1, 1] },
    ],
  },
  mat: { physical: false, metal: 0.02, rough: 0.62, k: 4.5, head: 0.1, flutter: 0.008, pect: 0.03, scull: 3.5, ripple: 4, fold: 0 },
  frag: (e) =>  `
  vec2 mp = vec2(fp.z, fp.y + fp.x * 0.35);
  float n1 = lfFbm(mp * 20.0);
  float n2 = lfNoise(mp * 58.0 + 7.3);
  float n3 = lfFbm(mp * 8.0 - 2.0);
  vec3 c = mix(${gc$1(0xb8341e)}, ${gc$1(0xe8704a)}, smoothstep(0.35, 0.7, n1));
  c = mix(c, ${gc$1(0x5e1a10)}, smoothstep(0.52, 0.72, n3) * 0.6);
  c = mix(c, ${gc$1(0xecb49a)}, smoothstep(0.55, 0.75, n1 * 0.6 + n3 * 0.4) * 0.35);
  c = mix(c, ${gc$1(0xf0c8b0)}, smoothstep(0.62, 0.8, n2) * 0.5);
  c = mix(c, ${gc$1(0xf09a80)}, smoothstep(0.4, 0.95, -fv) * 0.4);
  lfCol = c;
  float jaw = ${MOUTH(-0.01, -0.2, 0.1, 0.008)};
  lfCol = mix(lfCol, ${gc$1(0x2a120c)}, jaw * 0.7);
  hH -= jaw;
  float gl = lfGill(fp, ${ev(e)}, ${gf$1(e[2] * 3.6)}, 0.008);
  lfCol = mix(lfCol, ${gc$1(0x3a1a10)}, gl * body * 0.4);
  hH += gl * body + n3 * 0.6 * (1.0 - smoothstep(0.1, 0.3, fs)) * body;
  ${SCALES(50, 6, 0.1, 0.12, 0.3, 0.36)}
  ${HEADBUMP(0.0006)}
  lfMet = 0.02;
  lfRou = 0.62;
  lfEnvK = 1.0;
  ${FINS({ op: 0.9, tip: 0.8, rayK: 0.75, rays: [14, 22, 8, 18, 3], spines: [12, 0.6, 0.45] })}
  lfPectK = 1.0;
  if (isFin > 0.5) {
    float band = smoothstep(0.35, 0.65, sin(fedge * 17.0 + n1 * 3.0));
    vec3 fc = mix(${gc$1(0xd04a2a)}, ${gc$1(0x5a1a10)}, band * 0.55);
    if (ftype > 1.5 && ftype < 2.5) fc = mix(fc, ${gc$1(0x1c0c08)}, smoothstep(0.3, 0.36, fv) * (1.0 - smoothstep(0.5, 0.56, fv)) * smoothstep(0.2, 0.5, fedge) * 0.8);
    if (ftype > 6.5) fc = mix(${gc$1(0xc84a2e)}, ${gc$1(0xf0c8a8)}, n2);
    lfCol = fc;
  }
  lfFlu = lfCol * vec3(1.0, 0.28, 0.22) * (0.25 * (1.0 - isEye));
  ${LF_EYE(e, 0xa8452e, 0.5)}
`,
  beh: {
    len: [0.3, 0.42], v: [0, 0.05, 1.8], acc: 6, turn: 6, head: 4,
    nbrR: 0, sepR: 0, maxN: 0, wSep: 0, wAli: 0, wCoh: 0, wGoal: 1.0, flee: 0, fleeW: 0,
    floorM: 0.05, margin: 0.1, obsBuf: 0.2, look: 0.3, pitch: 60, vAlign: 0.2,
    f0: 0.3, stride: 0.8, fMax: 6, aMin: 0.004, aMax: 0.1, pect: 0.25, wander: 0, bankK: 0, bendK: 0.03, vDamp: 1.0,
  },
};

const FISH_DEFS = [BARRACUDA, BREAM, SALEMA, CHROMIS_J, CHROMIS_A, ANTHIAS, WRASSE, GROUPER, BOGUE, PARROT, SCORPION];

function finishMaterial(mat, key, patch) {
  const m = patch(mat) || mat;
  const base = m.customProgramCacheKey;
  m.customProgramCacheKey = function () {
    return key + '|' + base.call(this);
  };
  return m;
}

function depthMaterial$1(uniforms, vdecl, deform, tag) {
  const m = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  m.defines = { LIFE_DEPTH: tag === 'fish' ? 1 : 2 };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\n' + vdecl)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n' + deform);
  };
  m.customProgramCacheKey = () => 'life-depth-' + tag;
  return m;
}

function fishMaterial(def, built, U, patch) {
  const M = def.mat;
  const params = { color: 0xffffff, metalness: M.metal, roughness: M.rough, side: THREE.DoubleSide };
  let mat;
  if (M.physical) {
    mat = new THREE.MeshPhysicalMaterial(params);
    if (M.iri) {
      mat.iridescence = M.iri;
      mat.iridescenceIOR = M.iriIOR || 1.6;
      mat.iridescenceThicknessRange = [M.iriRange[0], M.iriRange[1]];
    }
  } else {
    mat = new THREE.MeshStandardMaterial(params);
  }
  mat.defines = Object.assign({}, mat.defines, { LIFE_SPECIES: def.id });
  mat.alphaToCoverage = true;
  const wave = { value: new THREE.Vector4(M.k, M.head, M.flutter, M.pect) };
  const fin = { value: new THREE.Vector4(M.scull || 7, M.ripple || 7, M.fold || 0, 0) };
  const frag = LF_FRAG_PRE + def.frag(built.eye, built.pt) + LF_FRAG_FIN + LF_FRAG_POST;
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uLfTime = U.time;
    sh.uniforms.uLfWave = wave;
    sh.uniforms.uLfFin = fin;
    sh.uniforms.uLfScene = U.scene;
    sh.uniforms.uLfLight = U.light;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\n' + FISH_VDECL + LF_VARY + (def.vary || ''))
      .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\n' + FISH_NORMAL)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n' + LF_SETVARY + (def.setVary || '') + FISH_DEFORM);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + LF_FDECL + (def.vary || '') + LF_WATER)
      .replace('#include <color_fragment>', '#include <color_fragment>\n' + frag)
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n' + LF_NORMAL)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n' + FISH_EMISSIVE)
      .replace('#include <lights_fragment_maps>', '#include <lights_fragment_maps>\n' + FISH_ENV)
      .replace('#include <lights_physical_fragment>', '#include <lights_physical_fragment>\n' + LF_IRIDESCENCE)
      .replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\n' + FISH_WARM);
  };
  const depth = depthMaterial$1({ uLfTime: U.time, uLfWave: wave, uLfFin: fin }, FISH_VDECL, FISH_DEFORM, 'fish');
  return { mat: finishMaterial(mat, 'life-' + def.key, patch), depth };
}

const DOLPHIN_KEYS = [
  [0.0, 0.004, 0.004, 0.0], [0.02, 0.011, 0.011, -2e-3], [0.05, 0.017, 0.016, -4e-3], [0.072, 0.027, 0.026, -1e-3],
  [0.092, 0.047, 0.042, 0.011], [0.13, 0.069, 0.06, 0.012], [0.2, 0.088, 0.074, 0.008], [0.3, 0.1, 0.082, 0.004],
  [0.4, 0.103, 0.082, 0.0], [0.5, 0.094, 0.072, -2e-3], [0.6, 0.078, 0.056, -2e-3], [0.7, 0.058, 0.036, 0.0],
  [0.8, 0.04, 0.02, 0.002], [0.88, 0.024, 0.011, 0.002], [0.93, 0.012, 0.008, 0.002],
];

function addThickFin(b, nu, nv, type, fn) {
  const r = [0, 0, 0, 0, 0, 0, 0];
  for (let side = 0; side < 2; side++) {
    const sg = side ? -1 : 1, base = b.count;
    for (let i = 0; i <= nv; i++) {
      for (let j = 0; j <= nu; j++) {
        const u = j / nu, v = i / nv;
        fn(u, v, r);
        const t = r[6] * sg;
        const x = r[0] + r[3] * t, y = r[1] + r[4] * t, z = r[2] + r[5] * t;
        b.v(x, y, z, clamp$4(0.5 - z, 0, 1.1), 1, type, u, u, v);
      }
    }
    for (let i = 0; i < nv; i++) {
      for (let j = 0; j < nu; j++) {
        const a = base + i * (nu + 1) + j;
        if (sg > 0) b.quad(a, a + 1, a + nu + 2, a + nu + 1);
        else b.quad(a, a + nu + 1, a + nu + 2, a + 1);
      }
    }
  }
}

function buildDolphin() {
  const S_END = 0.93;
  const prof = makeProfile(DOLPHIN_KEYS.map((k) => [k[0] / S_END, k[1], k[2], k[3]]));
  const o = [0, 0, 0];
  const at = (s) => prof(clamp$4(s / S_END, 0, 1), o);
  at(0.105);
  const eye = [0.5 - 0.105, o[2] - 0.12 * o[0], 0.0095];
  const b = new GeoBuilder();
  addBody(b, prof, { radial: 32, stations: 60, sEnd: S_END, egg: 0.05 });
  addThickFin(b, 6, 6, 2, (u, v, r) => {
    const zA = 0.1, zB = -0.06, zT = -0.09;
    const zl = zA + (zT - zA) * Math.pow(u, 1.5);
    const zt = zB + (zT - zB) * u + 0.035 * Math.sin(Math.PI * u) * (1 - 0.3 * u);
    const z = zl + (zt - zl) * v;
    at(0.5 - z);
    r[0] = 0; r[1] = o[2] + o[0] * 0.94 + 0.108 * u; r[2] = z;
    r[3] = 1; r[4] = 0; r[5] = 0; r[6] = 0.012 * (1 - u) * 4 * v * (1 - v) + 0.0007;
  });
  for (let side = -1; side <= 1; side += 2) {
    addThickFin(b, 7, 4, 1, (u, v, r) => {
      const zl = -0.38 - 0.095 * Math.pow(u, 1.15);
      const zt = -0.462 - 0.03 * Math.sin(Math.PI * u * 0.85) - 0.012 * u * u;
      r[0] = side * 0.13 * u; r[1] = 0.002; r[2] = zl + (zt - zl) * v;
      r[3] = 0; r[4] = 1; r[5] = 0; r[6] = 0.01 * (1 - 0.8 * u) * 4 * v * (1 - v) + 0.0006;
    });
  }
  const rootPt = (s, side) => {
    at(s);
    const sn = -0.55, cs = Math.sqrt(1 - sn * sn);
    return [side * o[1] * cs * (1 - 0.05 * sn) * 0.95, o[2] + o[0] * sn * 0.95, 0.5 - s];
  };
  for (let side = -1; side <= 1; side += 2) {
    const pa = rootPt(0.2, side), pb = rootPt(0.255, side);
    let dx = 0.62 * side, dy = -0.5, dz = -0.6;
    const dl = Math.sqrt(dx * dx + dy * dy + dz * dz);
    dx /= dl; dy /= dl; dz /= dl;
    const nl = Math.sqrt(dx * dx + dy * dy);
    const nx = -dy / nl, ny = dx / nl;
    addThickFin(b, 5, 3, 4, (u, v, r) => {
      const L = 0.13 * u, ch = Math.sqrt(Math.max(0, 1 - u * u * u));
      const lx = pa[0] + dx * L, ly = pa[1] + dy * L, lz = pa[2] + dz * L;
      const tx = pb[0] + dx * L * 0.9, ty = pb[1] + dy * L * 0.9, tz = pb[2] + dz * L * 0.9 + 0.012 * u;
      const k = v * ch;
      r[0] = lx + (tx - lx) * k; r[1] = ly + (ty - ly) * k; r[2] = lz + (tz - lz) * k;
      r[3] = nx; r[4] = ny; r[5] = 0; r[6] = 0.008 * (1 - u) * 4 * v * (1 - v) + 0.0006;
    });
  }
  return { geo: b.build(), eye };
}

const DOLPHIN_FRAG = (e) =>  `
  vec3 cape = ${gc$1(0x15181d)};
  vec3 greyc = ${gc$1(0x9ba1a9)};
  vec3 white = ${gc$1(0xeef0f1)};
  float q1 = (fs - 0.47) / 0.085;
  float capeL = 0.36 - 0.5 * exp(-q1 * q1);
  float q2 = (fs - 0.47) / 0.12;
  float bellyL = -0.55 + 0.28 * exp(-q2 * q2);
  vec3 flank = mix(${gc$1(0xcca75a)}, greyc, smoothstep(0.44, 0.52, fs));
  flank = mix(flank, greyc * 0.8, smoothstep(0.8, 0.9, fs));
  vec3 c = mix(white, flank, smoothstep(bellyL - 0.035, bellyL + 0.035, fv));
  c = mix(c, cape, smoothstep(capeL - 0.03, capeL + 0.03, fv));
  float head = 1.0 - smoothstep(0.1, 0.17, fs);
  vec3 headC = mix(${gc$1(0x6f757d)}, cape, smoothstep(-0.25, 0.2, fv));
  headC = mix(headC, white, smoothstep(0.45, 0.8, -fv));
  c = mix(c, headC, head);
  float sY = mix(-0.3, -0.62, clamp((fs - 0.08) / 0.16, 0.0, 1.0));
  float chin = lfLine(fv - sY, 0.07) * step(0.08, fs) * (1.0 - step(0.24, fs));
  c = mix(c, ${gc$1(0x3a3f47)}, chin * 0.85);
  c = mix(c, ${gc$1(0x2b2f36)}, smoothstep(0.86, 0.93, fs) * smoothstep(-0.7, 0.1, fv));
  lfMet = 0.0;
  lfRou = 0.33;
  if (isFin > 0.5) {
    c = ${gc$1(0x1d2127)};
    if (ftype > 1.5 && ftype < 2.5) c = mix(c, ${gc$1(0x4a525c)}, smoothstep(0.25, 0.5, fedge) * (1.0 - smoothstep(0.65, 0.9, fedge)) * 0.8);
  } else {
    float ed = length(vec2(fp.z - ${gf$1(e[0])}, fp.y - ${gf$1(e[1])})) / ${gf$1(e[2])};
    c = mix(c, cape, (1.0 - smoothstep(1.6, 2.6, ed)) * 0.8);
    float eyeM = 1.0 - smoothstep(0.85, 1.0, ed);
    c = mix(c, vec3(0.005), eyeM);
    lfRou = mix(lfRou, 0.1, eyeM);
  }
  lfCol = c;
`;

function dolphinMaterial(eye, U, patch) {
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, roughness: 0.34, metalness: 0, clearcoat: 0.45, clearcoatRoughness: 0.3,
    side: THREE.DoubleSide, envMapIntensity: 1.1,
  });
  mat.defines = Object.assign({}, mat.defines, { LIFE_SPECIES: 20 });
  const wave = { value: new THREE.Vector4(3.2, 0.06, 0, 0) };
  const frag = LF_FRAG_PRE + DOLPHIN_FRAG(eye) + LF_FRAG_POST;
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uLfTime = U.time;
    sh.uniforms.uLfWave = wave;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\n' + DOL_VDECL + LF_VARY)
      .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\n' + DOL_NORMAL)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n' + LF_SETVARY + DOL_DEFORM);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + LF_FDECL)
      .replace('#include <color_fragment>', '#include <color_fragment>\n' + frag)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n' + LF_EMISSIVE);
  };
  const depth = depthMaterial$1({ uLfTime: U.time, uLfWave: wave }, DOL_VDECL, DOL_DEFORM, 'dolphin');
  return { mat: finishMaterial(mat, 'life-dolphin', patch), depth };
}

function buildJellyBell() {
  const b = new GeoBuilder();
  const NR = 20, NA = 64;
  const lap = (rn, an) => 1 - 0.035 * sstep$3(0.85, 1, rn) * (0.5 + 0.5 * Math.cos(an * 16));
  const droop = (rn) => -0.035 * Math.pow(sstep$3(0.8, 1, rn), 1.3);
  const yTop = (rn) => 0.085 * (1 - Math.pow(rn, 2.2)) + (rn < 0.36 ? 0.07 * Math.pow(1 - (rn / 0.36) * (rn / 0.36), 0.6) : 0) + droop(rn);
  const yBot = (rn) => 0.03 * (1 - rn * rn) + droop(rn);
  const ring = (rn, yf, part) => {
    const start = b.count;
    for (let j = 0; j < NA; j++) {
      const an = (j / NA) * TAU$3, r = 0.5 * rn * lap(rn, an);
      b.v(Math.cos(an) * r, yf(rn), Math.sin(an) * r, 0, 0, 0, 0, rn, j / NA, 0, part);
    }
    return start;
  };
  const topC = b.v(0, yTop(0), 0, 0, 0, 0, 0, 0, 0, 0);
  let prev = -1;
  for (let i = 1; i <= NR; i++) {
    const cur = ring(i / NR, yTop, 0);
    for (let j = 0; j < NA; j++) {
      const jn = (j + 1) % NA;
      if (prev < 0) b.tri(topC, cur + jn, cur + j);
      else b.quad(prev + j, prev + jn, cur + jn, cur + j);
    }
    prev = cur;
  }
  prev = -1;
  for (let i = NR; i >= 1; i--) {
    const cur = ring(i / NR, yBot, 0.3);
    if (prev >= 0) for (let j = 0; j < NA; j++) { const jn = (j + 1) % NA; b.quad(prev + j, prev + jn, cur + jn, cur + j); }
    prev = cur;
  }
  const botC = b.v(0, yBot(0), 0, 0, 0, 0, 0, 0, 0, 0, 0.3);
  for (let j = 0; j < NA; j++) b.tri(prev + j, prev + ((j + 1) % NA), botC);
  return b.build('aPart');
}

function addTube(b, pts, radii, sides, part) {
  const n = pts.length;
  let prev = -1;
  for (let i = 0; i < n; i++) {
    const p = pts[i], a = pts[Math.max(i - 1, 0)], c = pts[Math.min(i + 1, n - 1)];
    let tx = c[0] - a[0], ty = c[1] - a[1], tz = c[2] - a[2];
    const tl = Math.sqrt(tx * tx + ty * ty + tz * tz) || 1;
    tx /= tl; ty /= tl; tz /= tl;
    let hx = 1, hz = 0;
    if (Math.abs(tx) > 0.8) { hx = 0; hz = 1; }
    let ax = ty * hz, ay = tz * hx - tx * hz, az = -ty * hx;
    const al = Math.sqrt(ax * ax + ay * ay + az * az) || 1;
    ax /= al; ay /= al; az /= al;
    const bx = ty * az - tz * ay, by = tz * ax - tx * az, bz = tx * ay - ty * ax;
    const cur = b.count;
    for (let j = 0; j < sides; j++) {
      const an = (j / sides) * TAU$3, ca = Math.cos(an) * radii[i], sa = Math.sin(an) * radii[i];
      b.v(p[0] + ax * ca + bx * sa, p[1] + ay * ca + by * sa, p[2] + az * ca + bz * sa, 0, 0, 0, 0, i / (n - 1), j / sides, 0, part);
    }
    if (prev >= 0) for (let j = 0; j < sides; j++) { const jn = (j + 1) % sides; b.quad(prev + j, cur + j, cur + jn, prev + jn); }
    prev = cur;
  }
  const e = pts[n - 1];
  const tip = b.v(e[0], e[1], e[2], 0, 0, 0, 0, 1, 0, 0, part);
  for (let j = 0; j < sides; j++) b.tri(prev + j, tip, prev + ((j + 1) % sides));
}

function addDisc(b, c, nx, ny, nz, r, th, part) {
  let hx = 1, hz = 0;
  if (Math.abs(nx) > 0.8) { hx = 0; hz = 1; }
  let ax = ny * hz, ay = nz * hx - nx * hz, az = -ny * hx;
  const al = Math.sqrt(ax * ax + ay * ay + az * az) || 1;
  ax /= al; ay /= al; az /= al;
  const bx = ny * az - nz * ay, by = nz * ax - nx * az, bz = nx * ay - ny * ax;
  const top = b.v(c[0] + nx * th, c[1] + ny * th, c[2] + nz * th, 0, 0, 0, 0, 1, 0, 0, part);
  const bot = b.v(c[0] - nx * th * 0.6, c[1] - ny * th * 0.6, c[2] - nz * th * 0.6, 0, 0, 0, 0, 1, 0.2, 0, part);
  const ring = b.count, S = 10;
  for (let j = 0; j < S; j++) {
    const an = (j / S) * TAU$3, ca = Math.cos(an) * r, sa = Math.sin(an) * r;
    b.v(c[0] + ax * ca + bx * sa, c[1] + ay * ca + by * sa, c[2] + az * ca + bz * sa, 0, 0, 0, 0, 1, 1, 0, part);
  }
  for (let j = 0; j < S; j++) {
    const jn = (j + 1) % S;
    b.tri(top, ring + j, ring + jn);
    b.tri(bot, ring + jn, ring + j);
  }
}

function buildJellyArms() {
  const b = new GeoBuilder();
  const armPt = (ca, sa, t) => {
    const d = 0.04 + 0.11 * t;
    return [ca * d, 0.012 - 0.15 * t - 0.03 * t * t, sa * d];
  };
  for (let a = 0; a < 8; a++) {
    const an = (a / 8) * TAU$3 + 0.2, ca = Math.cos(an), sa = Math.sin(an);
    const pts = [], rad = [];
    for (let k = 0; k <= 5; k++) {
      pts.push(armPt(ca, sa, k / 5));
      rad.push(0.028 * (1 - 0.5 * (k / 5)));
    }
    addTube(b, pts, rad, 7, 1);
    for (let k = 0; k < 6; k++) {
      const s0 = armPt(ca, sa, 0.2 + 0.8 * (k / 5));
      const side = k % 2 ? 1 : -1;
      let dx = ca * 0.5 - sa * 0.55 * side + rr(-0.2, 0.2), dy = -0.75 + rr(-0.15, 0.2), dz = sa * 0.5 + ca * 0.55 * side + rr(-0.2, 0.2);
      const dl = Math.sqrt(dx * dx + dy * dy + dz * dz);
      dx /= dl; dy /= dl; dz /= dl;
      const L = rr(0.03, 0.065);
      const e = [s0[0] + dx * L, s0[1] + dy * L, s0[2] + dz * L];
      addTube(b, [s0, [s0[0] + dx * L * 0.5, s0[1] + dy * L * 0.5, s0[2] + dz * L * 0.5], e], [0.008, 0.006, 0.005], 5, 2);
      addDisc(b, e, dx, dy, dz, rr(0.012, 0.02), 0.006, 3);
    }
  }
  for (let k = 0; k < 14; k++) {
    const an = rand$1() * TAU$3, r0 = Math.sqrt(rand$1()) * 0.06;
    const s0 = [Math.cos(an) * r0, -5e-3, Math.sin(an) * r0];
    let dx = Math.cos(an) * 0.4 + rr(-0.2, 0.2), dy = -1, dz = Math.sin(an) * 0.4 + rr(-0.2, 0.2);
    const dl = Math.sqrt(dx * dx + dy * dy + dz * dz);
    dx /= dl; dy /= dl; dz /= dl;
    const L = rr(0.05, 0.1);
    const e = [s0[0] + dx * L, s0[1] + dy * L, s0[2] + dz * L];
    addTube(b, [s0, e], [0.009, 0.006], 5, 2);
    addDisc(b, e, dx, dy, dz, rr(0.014, 0.022), 0.007, 3);
  }
  return b.build('aPart');
}

function jellyMaterials(U, patch) {
  const mk = (id, frag) => {
    const m = new THREE.MeshStandardMaterial({
      color: 0xffffff, roughness: 0.35, metalness: 0, side: THREE.DoubleSide, transparent: true, depthWrite: true,
      blending: THREE.CustomBlending, blendEquation: THREE.AddEquation,
      blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
      blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
    });
    m.defines = Object.assign({}, m.defines, { LIFE_SPECIES: id });
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uLfTime = U.time;
      sh.uniforms.uLfScene = U.scene;
      sh.uniforms.uLfLight = U.light;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\n' + JELLY_VDECL)
        .replace('#include <begin_vertex>', '#include <begin_vertex>\n' + JELLY_DEFORM);
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\n' + JELLY_FDECL + LF_WATER)
        .replace('#include <color_fragment>', '#include <color_fragment>\n' + frag)
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n' + JELLY_EMISSIVE);
    };
    return finishMaterial(m, 'life-jelly-' + id, patch);
  };
  return { bell: mk(32, BELL_FRAG), arms: mk(33, ARMS_FRAG) };
}

function createLifeCore(opts = {}) {
  seed = (0x2f6b1d3 ^ (VARY && VARY.mix ? VARY.mix : 0)) | 0;
  const scene = opts.scene || null;
  const patch = typeof opts.patchMaterial === 'function' ? opts.patchMaterial : (m) => m;
  const floorFn = typeof opts.floorHeight === 'function' ? opts.floorHeight : () => -20;
  const floorAt = (x, z) => {
    const y = +floorFn(x, z);
    return Number.isFinite(y) ? y : -60;
  };
  const quality = clamp$4(Number.isFinite(+opts.quality) ? +opts.quality : 1, 0.1, 2);
  const qc = (n, min) => Math.max(min, Math.round(n * quality));
  const num = (v, d) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
  const P3 = [0, 0, 0];
  const TH = opts.threat || { on: false, x: 0, y: 0, z: 0, r: 0 };

  const spots = opts.spots || {};
  const sw = spots.wreck || {}, sh = spots.hull || {}, sm = spots.meadow || {};
  const wreck = { x: num(sw.x, 0), y: 0, z: num(sw.z, 0) };
  wreck.y = num(sw.y, floorAt(wreck.x, wreck.z));
  const hull = { x: num(sh.x, wreck.x + 5), y: 0, z: num(sh.z, wreck.z - 3) };
  hull.y = num(sh.y, floorAt(hull.x, hull.z) + 1);
  const meadow = { x: num(sm.x, wreck.x - 18), z: num(sm.z, wreck.z + 14), r: Math.max(3, num(sm.r, 10)) };
  let reefs = (Array.isArray(spots.reefs) ? spots.reefs : []).filter((r) => r && Number.isFinite(r.x) && Number.isFinite(r.z));
  if (!reefs.length) reefs = [{ x: wreck.x + 12, z: wreck.z + 8 }, { x: wreck.x - 10, z: wreck.z + 12 }, { x: wreck.x + 4, z: wreck.z - 14 }];
  reefs = reefs.map((r) => ({ x: r.x, z: r.z, y: num(r.y, floorAt(r.x, r.z) + 1.5) }));
  const avoid = (Array.isArray(opts.avoid) ? opts.avoid : []).filter((a) => a && Number.isFinite(a.x) && Number.isFinite(a.z));
  const avoided = (x, z) => avoid.some((a) => (x - a.x) ** 2 + (z - a.z) ** 2 < (num(a.r, 2) + 1) ** 2);

  const obsIn = (Array.isArray(opts.obstacles) ? opts.obstacles : []).filter(
    (o) => o && Number.isFinite(o.x) && Number.isFinite(o.y) && Number.isFinite(o.z) && Number.isFinite(o.r) && o.r > 0,
  );
  const NO = obsIn.length;
  const oX = new Float32Array(NO), oY = new Float32Array(NO), oZ = new Float32Array(NO), oR = new Float32Array(NO);
  for (let k = 0; k < NO; k++) { oX[k] = obsIn[k].x; oY[k] = obsIn[k].y; oZ[k] = obsIn[k].z; oR[k] = obsIn[k].r; }
  const OG = 8, ON = 24, OMIN = -96;
  const ogStart = new Int32Array(ON * ON + 1);
  const ogList = [];
  for (let cz = 0; cz < ON; cz++) {
    for (let cx = 0; cx < ON; cx++) {
      ogStart[cz * ON + cx] = ogList.length;
      const x0 = OMIN + cx * OG, z0 = OMIN + cz * OG;
      for (let k = 0; k < NO; k++) {
        const nx = clamp$4(oX[k], x0, x0 + OG), nz = clamp$4(oZ[k], z0, z0 + OG), pad = oR[k] + 5;
        if ((oX[k] - nx) * (oX[k] - nx) + (oZ[k] - nz) * (oZ[k] - nz) < pad * pad) ogList.push(k);
      }
    }
  }
  ogStart[ON * ON] = ogList.length;
  const ogItems = Int32Array.from(ogList);
  const ogCell = (x, z) => clamp$4(Math.floor((z - OMIN) / OG), 0, ON - 1) * ON + clamp$4(Math.floor((x - OMIN) / OG), 0, ON - 1);

  const capIn = (Array.isArray(opts.capsules) ? opts.capsules : []).filter((c) => c && Number.isFinite(c.ax + c.ay + c.az + c.bx + c.by + c.bz + c.r) && c.r > 0);
  const NC = capIn.length, CP = new Float32Array(NC * 7), CG = new Map(), CGS = 2;
  capIn.forEach((c, k) => { CP[k * 7] = c.ax; CP[k * 7 + 1] = c.ay; CP[k * 7 + 2] = c.az; CP[k * 7 + 3] = c.bx; CP[k * 7 + 4] = c.by; CP[k * 7 + 5] = c.bz; CP[k * 7 + 6] = c.r; });
  const cgKey = (i, j) => (i + 2048) * 4096 + (j + 2048);
  for (let k = 0; k < NC; k++) {
    const o = k * 7, r = CP[o + 6] + 0.5;
    for (let i = Math.floor((Math.min(CP[o], CP[o + 3]) - r) / CGS); i <= Math.floor((Math.max(CP[o], CP[o + 3]) + r) / CGS); i++) {
      for (let j = Math.floor((Math.min(CP[o + 2], CP[o + 5]) - r) / CGS); j <= Math.floor((Math.max(CP[o + 2], CP[o + 5]) + r) / CGS); j++) {
        const key = cgKey(i, j);
        let l = CG.get(key);
        if (!l) CG.set(key, (l = []));
        l.push(k);
      }
    }
  }
  const capCell = (x, z) => (NC ? CG.get(cgKey(Math.floor(x / CGS), Math.floor(z / CGS))) : undefined);
  const CN = new Float32Array(3);
  function capDist(k, x, y, z) {
    const o = k * 7, ax = CP[o], ay = CP[o + 1], az = CP[o + 2], bx = CP[o + 3] - ax, by = CP[o + 4] - ay, bz = CP[o + 5] - az;
    const b2 = bx * bx + by * by + bz * bz;
    let t = b2 > 1e-8 ? ((x - ax) * bx + (y - ay) * by + (z - az) * bz) / b2 : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const dx = x - ax - bx * t, dy = y - ay - by * t, dz = z - az - bz * t, d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (d > 1e-5) { CN[0] = dx / d; CN[1] = dy / d; CN[2] = dz / d; } else { CN[0] = 0; CN[1] = 1; CN[2] = 0; }
    return d;
  }
  function pickFloor(x, z) {
    let f = floorAt(x, z);
    const l = capCell(x, z);
    if (l) {
      for (const k of l) {
        const o = k * 7, ax = CP[o], az = CP[o + 2], bx = CP[o + 3] - ax, bz = CP[o + 5] - az, r = CP[o + 6], l2 = bx * bx + bz * bz;
        const t = l2 > 1e-8 ? clamp$4(((x - ax) * bx + (z - az) * bz) / l2, 0, 1) : 0, dx = x - ax - bx * t, dz = z - az - bz * t, d2 = dx * dx + dz * dz;
        if (d2 < r * r) f = Math.max(f, CP[o + 1] + (CP[o + 4] - CP[o + 1]) * t + Math.sqrt(r * r - d2));
      }
    }
    return f;
  }

  function pushOut(p, m) {
    for (let it = 0; it < 3; it++) {
      for (let k = 0; k < NO; k++) {
        const dx = p[0] - oX[k], dy = p[1] - oY[k], dz = p[2] - oZ[k], R = oR[k] + m;
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 < R * R) {
          const d = Math.sqrt(d2);
          if (d < 1e-4) p[1] = oY[k] + R;
          else { const s = R / d; p[0] = oX[k] + dx * s; p[1] = oY[k] + dy * s; p[2] = oZ[k] + dz * s; }
        }
      }
      const l = capCell(p[0], p[2]);
      if (l) {
        for (const k of l) {
          const R = CP[k * 7 + 6] + Math.min(m, 0.12), d = capDist(k, p[0], p[1], p[2]);
          if (d < R) { p[0] += CN[0] * (R - d); p[1] += CN[1] * (R - d); p[2] += CN[2] * (R - d); }
        }
      }
    }
    return p;
  }

  const RP = [];
  const addPts = (arr, top) => {
    if (!Array.isArray(arr)) return;
    for (const p of arr) {
      if (!p) continue;
      const v = [+p.x, +p.y, +p.z, +p.nx, +p.ny, +p.nz];
      if (!v.every(Number.isFinite)) continue;
      const l = Math.hypot(v[3], v[4], v[5]);
      if (l < 1e-6 || v[1] > -1.5 || Math.hypot(v[0], v[2]) > 62) continue;
      RP.push([v[0], v[1], v[2], v[3] / l, v[4] / l, v[5] / l, top ? 1 : 0]);
    }
  };
  addPts(opts.rockTops, true);
  addPts(opts.rockSides, false);
  if (!RP.length) {
    for (let k = 0; k < NO; k++) {
      const f = floorAt(oX[k], oZ[k]);
      if (oY[k] + oR[k] > f + 0.3 && oY[k] + oR[k] < -1.5) RP.push([oX[k], oY[k] + oR[k], oZ[k], 0, 1, 0, 1]);
      for (let a = 0; a < 6; a++) {
        const an = (a / 6) * TAU$3, l = Math.hypot(1, 0.3);
        const nx = Math.cos(an) / l, ny = 0.3 / l, nz = Math.sin(an) / l;
        const y = oY[k] + ny * oR[k];
        if (y > f + 0.3 && y < -1.5) RP.push([oX[k] + nx * oR[k], y, oZ[k] + nz * oR[k], nx, ny, nz, 0]);
      }
    }
  }
  const rockNear = (x, z, r, topsOnly) => {
    const out = [];
    for (let k = 0; k < RP.length; k++) {
      const p = RP[k];
      if (topsOnly && (p[6] !== 1 || p[4] < 0.8)) continue;
      if (p[4] < -0.2) continue;
      if ((p[0] - x) ** 2 + (p[2] - z) ** 2 < r * r) out.push(k);
    }
    return out;
  };

  const U$1 = {
    time: { value: 0 }, scene: { value: new THREE.Vector4(-20, 0.05, 0.3, 0.36) },
    light: (U && U.uLight) || { value: 1 },
  };
  const root = new THREE.Group();
  root.name = 'life';
  const disposables = [];
  const chromisN = qc(770, 42), chromisJN = Math.round(chromisN * 0.6);
  const COUNTS = {
    barracuda: qc(160, 16), bream: qc(176, 20), salema: qc(120, 12), chromisJ: chromisJN,
    chromisA: chromisN - chromisJN, anthias: qc(110, 10), wrasse: qc(60, 8), grouper: 4,
    bogue: qc(640, 60), parrot: quality >= 0.75 ? 3 : 2, scorpion: quality >= 0.75 ? 4 : 3,
  };
  const SP = [];
  let N = 0;
  for (let d = 0; d < FISH_DEFS.length; d++) {
    const def = FISH_DEFS[d], count = COUNTS[def.key], b = def.beh;
    const built = buildFish(def.geo);
    const geo = built.geo;
    const phase = new Float32Array(count);
    for (let k = 0; k < count; k++) phase[k] = rand$1();
    geo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phase, 1));
    const swimAttr = new THREE.InstancedBufferAttribute(new Float32Array(count * 4), 4);
    swimAttr.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aSwim', swimAttr);
    const fm = fishMaterial(def, built, U$1, patch);
    const mesh = new THREE.InstancedMesh(geo, fm.mat, count);
    mesh.name = 'life-' + def.key;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = true;
    mesh.castShadow = def.shadow;
    mesh.receiveShadow = false;
    if (def.shadow) mesh.customDepthMaterial = fm.depth;
    root.add(mesh);
    disposables.push(geo, fm.mat, fm.depth);
    SP.push({
      key: def.key, kind: def.kind, start: N, count, mesh, mat: mesh.instanceMatrix.array, swim: swimAttr.array, swimAttr,
      lenMin: b.len[0], lenMax: b.len[1], vMin: b.v[0], cruise: b.v[1], vMax: b.v[2],
      acc: b.acc, turn: b.turn, head: b.head, nbrR: b.nbrR, sepR: b.sepR, maxN: b.maxN,
      wSep: b.wSep, wAli: b.wAli, wCoh: b.wCoh, wGoal: b.wGoal, flee: b.flee, fleeW: b.fleeW, startle: b.startle || 0,
      floorM: b.floorM, margin: b.margin, obsBuf: b.obsBuf, look: b.look, pitch: Math.sin((b.pitch * Math.PI) / 180),
      vAlign: b.vAlign, f0: b.f0, stride: b.stride, fMax: b.fMax, aMin: b.aMin, aMax: b.aMax, pect: b.pect,
      wander: b.wander, bankK: b.bankK, bendK: b.bendK, vDamp: b.vDamp,
      bcOn: b.bc ? 1 : 0, bc0: b.bc ? b.bc[0] : 0, bc1: b.bc ? b.bc[1] : 0, bc2: b.bc ? b.bc[2] : 0, bc3: b.bc ? b.bc[3] : 0,
      cosTurn: 1, sinTurn: 0, cosHead: 1, sinHead: 0,
      glOn: b.glint ? 1 : 0, gI0: b.glint ? b.glint[0] : 0, gI1: b.glint ? b.glint[1] : 0,
      gA0: b.glint ? b.glint[2] : 0, gA1: b.glint ? b.glint[3] : 0, gDur: b.glint ? b.glint[4] : 1,
      flock: def.key === 'chromisA' ? d - 1 : d,
    });
    N += count;
  }

  const F = () => new Float32Array(N);
  const pX = F(), pY = F(), pZ = F(), vX = F(), vY = F(), vZ = F(), hX = F(), hY = F(), hZ = F();
  const hmX = F(), hmY = F(), hmZ = F(), tgX = F(), tgY = F(), tgZ = F(), spX = F(), spY = F(), spZ = F();
  const tnX = F(), tnY = F(), tnZ = F();
  const fcX = F(), fcZ = F(), pA = F(), pB = F(), tA = F(), tB = F();
  const nbX = F(), nbY = F(), nbZ = F();
  const alm = F(), bcT = F(), bcf = F();
  const glP = F(), glA = F();
  const scl = F(), nPh = F(), cruiseF = F(), fl = F(), tail = F(), amp = F(), bend = F(), hov = F(), bank = F();
  const spc = new Uint8Array(N), flk = new Uint8Array(N), st = new Uint8Array(N), grp = new Int16Array(N).fill(-1);
  const cand = new Array(N);
  const CELL = 1.25, INV_CELL = 1 / CELL, HSIZE = 8192, HMASK = HSIZE - 1;
  const cellStart = new Int32Array(HSIZE + 1), cellCur = new Int32Array(HSIZE);
  const fishCell = new Int32Array(N), sorted = new Int32Array(N);

  const GMAX = 21 + reefs.length;
  const G32 = () => new Float32Array(GMAX);
  const gX = G32(), gY = G32(), gZ = G32(), gVX = G32(), gVY = G32(), gVZ = G32();
  const gTX = G32(), gTY = G32(), gTZ = G32(), gTimer = G32(), gAlarm = G32(), gHide = G32(), gCount = G32();
  const gKind = new Uint8Array(GMAX), gReef = new Int16Array(GMAX).fill(-1), gWp = new Int16Array(GMAX);
  let G = 0;
  const addGroup = (kind, x, y, z) => {
    gKind[G] = kind;
    gX[G] = gTX[G] = x; gY[G] = gTY[G] = y; gZ[G] = gTZ[G] = z;
    return G++;
  };
  const vortexLo = Math.max(-13, wreck.y + 4.5), vortexHi = Math.min(-3.5, Math.max(-7, vortexLo + 4));
  const ballY = clamp$4(-9.5, wreck.y + 6.5, -4.5);
  const wbx = wreck.x + 0.5 + rr(-1, 1), wbz = wreck.z - 2 + rr(-1, 1);
  const gBall = addGroup(K_BALL, wbx, ballY, wbz);
  const gVortex = addGroup(K_VORTEX, wbx, (vortexLo + vortexHi) * 0.5, wbz);
  const DS = { a: [0, 0, 0], b: [0, 0, 0], spot: [0, 0, 0], hold: true, below: 0, f: [0, 0], fOn: false, far: null };
  function descentSpot() {
    const a = DS.a, b = DS.b;
    let hx = b[0] - a[0], hz = b[2] - a[2];
    const hl = Math.sqrt(hx * hx + hz * hz) || 1;
    hx /= hl; hz /= hl;
    const u = 0.36;
    DS.spot[0] = a[0] + (b[0] - a[0]) * u - hz * 1.6 + hx * 0.4;
    DS.spot[2] = a[2] + (b[2] - a[2]) * u + hx * 1.6 + hz * 0.4;
    if (DS.far) { DS.spot[0] = a[0] + (b[0] - a[0]) * u + DS.far[0] * 5; DS.spot[2] = a[2] + (b[2] - a[2]) * u + DS.far[1] * 5; }
    DS.spot[1] = Math.max(a[1] + (b[1] - a[1]) * u, floorAt(DS.spot[0], DS.spot[2]) + 3);
  }
  {
    const boat = (LAYOUT && LAYOUT.boat) || { x: wreck.x + 5, z: wreck.z + 16 };
    DS.a[0] = boat.x + 0.3; DS.a[1] = -0.6; DS.a[2] = boat.z + 3;
    DS.b[0] = wreck.x + 1; DS.b[2] = wreck.z + 4; DS.b[1] = Math.max(-16, floorAt(DS.b[0], DS.b[2]) + 2);
    descentSpot();
  }
  const BS = { spot: [0, 0, 0], hold: true, near: false, room: false, down: 0, px: 0, pz: 0, bx: 0, bz: 1 };
  function bottomSpot() {
    const b = DS.b;
    let hx = (DS.fOn ? DS.f[0] : wreck.x) - b[0], hz = (DS.fOn ? DS.f[1] : wreck.z) - b[2];
    const hl = Math.sqrt(hx * hx + hz * hz) || 1;
    hx /= hl; hz /= hl;
    P3[0] = b[0] + hx * 3.2 + hz * 0.6; P3[2] = b[2] + hz * 3.2 - hx * 0.6; P3[1] = 0;
    pushOut(P3, 1.5);
    BS.spot[0] = P3[0]; BS.spot[2] = P3[2]; BS.spot[1] = floorAt(P3[0], P3[2]) + 2.2;
    BS.px = P3[0]; BS.pz = P3[2]; BS.bx = hx; BS.bz = hz;
  }
  bottomSpot();
  const gBream = [0, 1].map((k) => {
    if (k === 0) {
      const g = addGroup(K_SCHOOL, DS.spot[0], DS.spot[1], DS.spot[2]);
      gTimer[g] = 40;
      return g;
    }
    const g = addGroup(K_SCHOOL, BS.spot[0], BS.spot[1], BS.spot[2]);
    gReef[g] = (k * Math.ceil(reefs.length / 2)) % reefs.length;
    gTimer[g] = 40;
    return g;
  });
  const gSalema = addGroup(K_MEADOW, meadow.x, floorAt(meadow.x, meadow.z) + 0.9, meadow.z);
  pickGroupTarget(gSalema);
  const gDesc = gBream[0], gBot = gBream[1];
  const DVR = { on: false, t: -1e9, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, esc: false, tE: 0, bx: 0, bz: 1, stop: false, sx: 0, sy: 0, sz: 0, nH: 0, hose: new Float32Array(7 * 6) };
  const cuS = new Uint8Array(N), cuT = new Float32Array(N), cuA = new Float32Array(N);
  const CU = new Int32Array(7), CUd = new Float32Array(7);
  function curious(g) {
    CU.fill(-1); CUd.fill(1e9);
    for (let i = 0; i < N; i++) {
      if (grp[i] !== g) continue;
      const d = (pX[i] - DVR.x) ** 2 + (pZ[i] - DVR.z) ** 2;
      let k = CU.length - 1;
      if (d >= CUd[k]) continue;
      while (k > 0 && d < CUd[k - 1]) { CUd[k] = CUd[k - 1]; CU[k] = CU[k - 1]; k--; }
      CUd[k] = d; CU[k] = i;
    }
    for (let k = 0; k < CU.length; k++) if (CU[k] >= 0) { const i = CU[k]; cuS[i] = 1; cuT[i] = 0.15 + 0.2 * k; cuA[i] = Math.atan2(pZ[i] - DVR.z, pX[i] - DVR.x); }
  }
  const gClouds = reefs.map((r) => addGroup(K_CLOUD, r.x, r.y, r.z));
  const HL = (LAYOUT && LAYOUT.hull) || { x: wreck.x, z: wreck.z, rot: 0 };
  const hullAt = (s, b) => [HL.x + Math.sin(HL.rot) * s + Math.cos(HL.rot) * b, HL.z + Math.cos(HL.rot) * s - Math.sin(HL.rot) * b];
  const gWreck = [[-5.5, -1.6], [1.2, 3.4], [-12.8, 0.6], [7.6, 0.2], [3.6, 5.2], [-2.4, 0.4]].map(([s, b]) => {
    const [x, z] = hullAt(s + rr(-0.6, 0.6), b + rr(-0.4, 0.4));
    return addGroup(K_CLOUD, x, floorAt(x, z) + 0.9, z);
  });
  const PATROL = [[-18, -4], [-8, -5.5], [2, -5], [10, -3.5], [13, 2], [8, 7.5], [0, 8], [-8, 6.5], [-17, 4.5], [-21, 0]].map(([s, b]) => hullAt(s + rr(-1, 1), b + Math.sign(b || 1) * rr(-0.3, 0.8)));
  const wp0 = Math.floor(rand$1() * PATROL.length);
  const gPatrol = [0, 1].map((k) => {
    const w = (wp0 + k * 5) % PATROL.length, p = PATROL[w], g = addGroup(K_SCHOOL, p[0], floorAt(p[0], p[1]) + 1.6, p[1]);
    gReef[g] = -2;
    gWp[g] = w;
    pickGroupTarget(g);
    return g;
  });
  const wrasseHomes = [[1.5, 3.8], [4.5, 4.8], [-1.5, 4.3], [-7, 2.8], [-12, 2.5], [9, 2.4], [-4.5, -2.8]].map(([s, b]) => {
    const [x, z] = hullAt(s + rr(-0.6, 0.6), b + rr(-0.4, 0.4));
    return { x, z };
  });
  if (LAYOUT && LAYOUT.torso) wrasseHomes.push({ x: LAYOUT.torso.x + 1, z: LAYOUT.torso.z + 0.8 });
  if (LAYOUT && LAYOUT.frags) {
    for (const f of LAYOUT.frags) {
      let dx = wreck.x - f.x, dz = wreck.z - f.z;
      const dl = Math.sqrt(dx * dx + dz * dz) || 1;
      dx /= dl; dz /= dl;
      wrasseHomes.push({ x: f.x + dx * 2.6 - dz * 0.8, z: f.z + dz * 2.6 + dx * 0.8 });
    }
  }
  const gNear = [];
  function nearSpots(out) {
    const f0 = LAYOUT && LAYOUT.frags && LAYOUT.frags[0];
    const ex = DS.b[0], ez = DS.b[2];
    let bx = DS.a[0] - ex, bz = DS.a[2] - ez;
    const bl = Math.sqrt(bx * bx + bz * bz) || 1;
    bx /= bl; bz /= bl;
    let k = 0;
    out[k++] = ex + bx * 2.2 + bz * 0.6; out[k++] = ez + bz * 2.2 - bx * 0.6;
    if (f0) { out[k++] = f0.x + bx * 3.2; out[k++] = f0.z + bz * 3.2; }
    const fr = LAYOUT && LAYOUT.frags;
    for (let j = 1; fr && j < fr.length; j++) {
      const f = fr[j];
      let dx = wreck.x - f.x, dz = wreck.z - f.z;
      const dl = Math.sqrt(dx * dx + dz * dz) || 1;
      dx /= dl; dz /= dl;
      out[k++] = f.x + dx * 1.4 + dz * 0.5; out[k++] = f.z + dz * 1.4 - dx * 0.5;
    }
    return k >> 1;
  }
  const NEAR = new Float32Array(4 + 2 * (LAYOUT && LAYOUT.frags ? LAYOUT.frags.length : 0));
  for (let k = 0, n = nearSpots(NEAR); k < n; k++) {
    const x = NEAR[k * 2], z = NEAR[k * 2 + 1];
    gNear.push(addGroup(K_CLOUD, x, floorAt(x, z) + 1.0, z));
  }
  const hullBase = Math.max(hull.y, floorAt(hull.x, hull.z) + 0.6);
  const gAnth = [addGroup(K_HOVER, hull.x, hullBase, hull.z), addGroup(K_HOVER, reefs[0].x, reefs[0].y, reefs[0].z)];
  const RES = (() => { const [x, z] = hullAt(1.8 + rr(-0.8, 0.8), 4.3 + rr(-0.4, 0.4)); return [x, floorAt(x, z), z]; })();
  const gRes = addGroup(K_SCHOOL, RES[0] + 2, RES[1] + 1.3, RES[2]);
  gReef[gRes] = -3;
  const gFeed = addGroup(K_CLOUD, wreck.x, wreck.y + 1, wreck.z);
  const FEED = { on: false, active: false, k: 0, hold: 0, x: 0, y: 0, z: 0, far: 0, farUsed: 0, school: -1, sX: 0, sY: 0, sZ: 0 };
  const fdr = new Uint8Array(N), fdG = new Int16Array(N), fdHX = new Float32Array(N), fdHY = new Float32Array(N), fdHZ = new Float32Array(N);
  const FRAGS = LAYOUT && LAYOUT.frags && LAYOUT.frags.length ? LAYOUT.frags : null;
  const fDone = new Uint8Array(FRAGS ? FRAGS.length : 0);

  const scorpSpots = [];
  {
    const tops = rockNear(wreck.x, wreck.z, 45, true).filter((k) => !avoided(RP[k][0], RP[k][2]));
    for (let k = tops.length - 1; k > 0; k--) { const j = Math.floor(rand$1() * (k + 1)); const t = tops[k]; tops[k] = tops[j]; tops[j] = t; }
    for (const k of tops) {
      if (scorpSpots.length >= COUNTS.scorpion) break;
      if (scorpSpots.every((j) => (RP[j][0] - RP[k][0]) ** 2 + (RP[j][2] - RP[k][2]) ** 2 > 36)) scorpSpots.push(k);
    }
  }
  const parrotHomes = reefs.slice().sort(() => rand$1() - 0.5);

  function initFish(i, s, x, y, z, hx, hy, hz, g, raw) {
    const S = SP[s];
    spc[i] = s; flk[i] = S.flock; grp[i] = g;
    scl[i] = rr(S.lenMin, S.lenMax);
    nPh[i] = rand$1() * TAU$3;
    cruiseF[i] = rr(0.88, 1.12);
    tail[i] = rand$1() * TAU$3;
    amp[i] = S.aMin;
    hov[i] = S.pect;
    bcT[i] = rand$1(); bcf[i] = 1;
    glP[i] = -(S.gI0 + (S.gI1 - S.gI0) * hash01(i, 7)); glA[i] = 0;
    const fa = CUR_FACE + rr(-0.4, 0.4);
    fcX[i] = Math.cos(fa); fcZ[i] = Math.sin(fa);
    P3[0] = x; P3[1] = y; P3[2] = z;
    const f = floorAt(P3[0], P3[2]);
    if (!raw) {
      pushOut(P3, S.margin + 0.1);
      P3[1] = clamp$4(P3[1], f + S.floorM, -1.6);
    }
    pX[i] = spX[i] = P3[0]; pY[i] = spY[i] = P3[1]; pZ[i] = spZ[i] = P3[2];
    fl[i] = f;
    let l = Math.sqrt(hx * hx + hy * hy + hz * hz);
    if (l < 1e-4) { hx = fcX[i]; hy = 0; hz = fcZ[i]; l = 1; }
    hX[i] = hx / l; hY[i] = hy / l; hZ[i] = hz / l;
    const v0 = S.vMin > 0 ? S.cruise * 0.8 : S.cruise * 0.2;
    vX[i] = hX[i] * v0; vY[i] = 0; vZ[i] = hZ[i] * v0;
  }

  for (let s = 0; s < SP.length; s++) {
    const S = SP[s];
    for (let k = 0; k < S.count; k++) {
      const i = S.start + k;
      if (S.kind === K_VORTEX) {
        const a = rand$1() * TAU$3, r = 3.8 + 2.4 * (rand$1() + rand$1()) * 0.5;
        const y = vortexLo + 1.2 + Math.max(0, vortexHi - vortexLo - 2.4) * rand$1();
        pA[i] = r; pB[i] = y;
        initFish(i, s, gX[gVortex] + Math.cos(a) * r, y, gZ[gVortex] + Math.sin(a) * r, -Math.sin(a), 0, Math.cos(a), gVortex);
      } else if (S.kind === K_BALL) {
        let rh = Math.sqrt(0.49 + rand$1() * 6.8);
        const a = rand$1() * TAU$3, th = 1.15 * Math.max(0.22, 1 - ((rh - 1.7) / 1.1) ** 2);
        let yo = rr(-1, 1) * th;
        const stray = rand$1() < 0.06;
        if (stray) { rh *= rr(1.35, 1.9); yo *= 1.6; }
        pA[i] = rh; pB[i] = yo;
        tA[i] = rand$1() * TAU$3;
        tB[i] = !stray && rand$1() < 0.16 ? rr(0.5, 1) : 0;
        initFish(i, s, gX[gBall] + Math.cos(a) * rh, gY[gBall] + yo, gZ[gBall] + Math.sin(a) * rh, Math.sin(a), 0, -Math.cos(a), gBall);
        if (stray) cruiseF[i] *= 0.8;
      } else if (S.kind === K_SCHOOL) {
        const pat = k < 40, res = !pat && k < 72, g = pat ? gPatrol[k % 2] : res ? gRes : gBream[k % 2], a = rand$1() * TAU$3, r = (pat ? 2.0 : res ? 1.7 : 2.4) * Math.cbrt(rand$1()), ha = rand$1() * TAU$3;
        hmX[i] = Math.cos(a) * r; hmZ[i] = Math.sin(a) * r; hmY[i] = rr(-0.9, 0.9);
        initFish(i, s, gX[g] + hmX[i], gY[g] + hmY[i], gZ[g] + hmZ[i], Math.cos(ha), 0, Math.sin(ha), g);
        tA[i] = rr(2, 14);
      } else if (S.kind === K_MEADOW) {
        const a = rand$1() * TAU$3, r = 3.8 * Math.sqrt(rand$1()), ha = rand$1() * TAU$3;
        hmX[i] = Math.cos(a) * r; hmZ[i] = Math.sin(a) * r; hmY[i] = rr(0.3, 1.5);
        const x = gX[gSalema] + hmX[i], z = gZ[gSalema] + hmZ[i];
        initFish(i, s, x, floorAt(x, z) + hmY[i], z, Math.cos(ha), 0, Math.sin(ha), gSalema);
        tA[i] = rr(1, 10);
        pB[i] = S.pitch;
      } else if (S.kind === K_CLOUD) {
        const nearN = (S.key === 'chromisJ' ? 7 : 5) * Math.max(2, gNear.length);
        const g = k < nearN && gNear.length ? gNear[k % gNear.length]
          : (k & 1) === 0 || !gClouds.length ? gWreck[(k >> 1) % gWreck.length] : gClouds[(k >> 1) % gClouds.length];
        const low = k < nearN && gNear.indexOf(g) >= 2;
        const hgt = low ? rr(-0.6, 0.3) : S.key === 'chromisJ' ? rr(0.5, 2.8) : rr(0.9, 4.0);
        const a = rand$1() * TAU$3, r = (low ? 1.0 : 1.9 * (1 - 0.3 * (hgt / 4))) * Math.sqrt(rand$1());
        P3[0] = gX[g] + Math.cos(a) * r; P3[1] = gY[g] + hgt; P3[2] = gZ[g] + Math.sin(a) * r;
        pushOut(P3, 0.3);
        P3[1] = Math.max(P3[1], floorAt(P3[0], P3[2]) + 0.4);
        hmX[i] = P3[0]; hmY[i] = P3[1]; hmZ[i] = P3[2];
        initFish(i, s, hmX[i] + rr(-0.2, 0.2), hmY[i] + rr(-0.1, 0.1), hmZ[i] + rr(-0.2, 0.2), 0, 0, 0, g);
        gCount[g]++;
        tB[i] = rr(0, 3);
      } else if (S.kind === K_HOVER) {
        const g = gAnth[k % 2], atHull = k % 2 === 0;
        const a = rand$1() * TAU$3, r = (atHull ? 2.2 : 1.4) * Math.sqrt(rand$1());
        const hgt = atHull ? rr(-0.2, 1.8) : rr(0.2, 1.4), off = atHull ? 0 : 0.8;
        P3[0] = gX[g] + Math.cos(a) * r + 0.8 * off; P3[1] = gY[g] + hgt; P3[2] = gZ[g] + Math.sin(a) * r + 0.6 * off;
        pushOut(P3, 0.35);
        P3[1] = Math.max(P3[1], floorAt(P3[0], P3[2]) + 0.4);
        hmX[i] = P3[0]; hmY[i] = P3[1]; hmZ[i] = P3[2];
        initFish(i, s, hmX[i], hmY[i], hmZ[i], 0, 0, 0, g);
      } else if (S.kind === K_DART) {
        const onW = k % 2 === 0, base = onW ? wrasseHomes[(k >> 1) % wrasseHomes.length] : reefs[(k >> 1) % reefs.length];
        const a = rand$1() * TAU$3, r = onW ? rr(0.6, 3) : rr(1.5, 5), ha = rand$1() * TAU$3;
        P3[0] = base.x + Math.cos(a) * r; P3[2] = base.z + Math.sin(a) * r;
        P3[1] = floorAt(P3[0], P3[2]) + rr(0.3, 1.5);
        pushOut(P3, 0.4);
        hmX[i] = tgX[i] = P3[0]; hmY[i] = tgY[i] = P3[1]; hmZ[i] = tgZ[i] = P3[2];
        cand[i] = rockNear(hmX[i], hmZ[i], 6, false);
        initFish(i, s, hmX[i], hmY[i], hmZ[i], Math.cos(ha), 0, Math.sin(ha), -1);
        tA[i] = rr(0.2, 2);
      } else if (S.kind === K_GRAZE) {
        const home = parrotHomes[k % parrotHomes.length];
        let c = rockNear(home.x, home.z, 8, false);
        if (c.length < 3) c = rockNear(home.x, home.z, 16, false);
        cand[i] = c;
        hmX[i] = home.x; hmY[i] = home.y; hmZ[i] = home.z;
        const ha = rand$1() * TAU$3;
        const x = home.x + rr(-2, 2), z = home.z + rr(-2, 2);
        initFish(i, s, x, Math.max(home.y + 0.5, floorAt(x, z) + 1.2), z, Math.cos(ha), 0, Math.sin(ha), -1);
        pickGrazeTarget(i);
        tA[i] = rr(0.5, 2);
      } else if (S.kind === K_GROUPER) {
        const sh = k < 2 && SITE && SITE.shelters ? SITE.shelters[k] : null;
        if (sh) {
          hmX[i] = sh.x; hmY[i] = sh.y; hmZ[i] = sh.z;
          initFish(i, s, sh.x, sh.y, sh.z, sh.ox, 0, sh.oz, -1, true);
          tnX[i] = sh.ox; tnY[i] = 1; tnZ[i] = sh.oz;
        } else {
          const base = k === 0 ? wreck : k === 2 ? { x: RES[0] + 0.8, z: RES[2] + 1.2 } : reefs[(k * 2 + 1) % reefs.length];
          const a = rand$1() * TAU$3, r = rr(1.4, 2.8);
          P3[0] = base.x + Math.cos(a) * r; P3[2] = base.z + Math.sin(a) * r;
          P3[1] = floorAt(P3[0], P3[2]) + rr(0.6, 1.2);
          pushOut(P3, 0.6);
          hmX[i] = P3[0]; hmY[i] = P3[1]; hmZ[i] = P3[2];
          initFish(i, s, hmX[i], hmY[i], hmZ[i], Math.cos(a), 0, Math.sin(a), -1);
        }
      } else if (S.kind === K_REST) {
        const kk = scorpSpots.length ? scorpSpots[k % scorpSpots.length] : -1;
        let px, py, pz, nx = 0, ny = 1, nz = 0;
        if (kk >= 0) { const p = RP[kk]; px = p[0]; py = p[1]; pz = p[2]; nx = p[3]; ny = p[4]; nz = p[5]; }
        else { const r = reefs[k % reefs.length]; px = r.x + 0.8; pz = r.z + 0.6; py = floorAt(px, pz); }
        if (kk >= 0 && k >= scorpSpots.length) { px += rr(-0.4, 0.4); pz += rr(-0.4, 0.4); }
        const ha = rand$1() * TAU$3;
        initFish(i, s, px, py, pz, Math.cos(ha), 0, Math.sin(ha), -1, true);
        const lift = 0.14 * scl[i];
        pX[i] += nx * lift; pY[i] += ny * lift; pZ[i] += nz * lift;
        tgX[i] = pX[i]; tgY[i] = pY[i]; tgZ[i] = pZ[i];
        hmX[i] = tnX[i] = nx; hmY[i] = tnY[i] = ny; hmZ[i] = tnZ[i] = nz;
        vX[i] = vY[i] = vZ[i] = 0;
        amp[i] = 0.004; hov[i] = 0.25;
      }
    }
  }

  const NJ = qc(8, 3);
  const jX = new Float32Array(NJ), jY = new Float32Array(NJ), jZ = new Float32Array(NJ), jVY = new Float32Array(NJ);
  const jTY = new Float32Array(NJ), jHd = new Float32Array(NJ), jYaw = new Float32Array(NJ), jS = new Float32Array(NJ);
  const jPh = new Float32Array(NJ);
  for (let k = 0; k < NJ; k++) {
    const a = rand$1() * TAU$3, r = 4 + 22 * Math.sqrt(rand$1());
    jX[k] = Math.cos(a) * r; jZ[k] = Math.sin(a) * r;
    jY[k] = jTY[k] = rr(-6, -2.5);
    jHd[k] = rand$1() * TAU$3; jYaw[k] = rand$1() * TAU$3; jS[k] = rr(0.2, 0.3); jPh[k] = rand$1();
  }
  const bellGeo = buildJellyBell(), armGeo = buildJellyArms();
  const jPhase = new THREE.InstancedBufferAttribute(jPh, 1);
  bellGeo.setAttribute('aPhase', jPhase);
  armGeo.setAttribute('aPhase', jPhase);
  const jm = jellyMaterials(U$1, patch);
  const bellMesh = new THREE.InstancedMesh(bellGeo, jm.bell, NJ);
  const armMesh = new THREE.InstancedMesh(armGeo, jm.arms, NJ);
  bellMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  armMesh.instanceMatrix = bellMesh.instanceMatrix;
  bellMesh.name = 'life-jelly-bell';
  armMesh.name = 'life-jelly-arms';
  bellMesh.renderOrder = 5;
  armMesh.renderOrder = 6;
  for (const m of [armMesh, bellMesh]) {
    m.frustumCulled = false; m.castShadow = false; m.receiveShadow = false;
    root.add(m);
  }
  disposables.push(bellGeo, armGeo, jm.bell, jm.arms);

  const ND = 4;
  const dol = buildDolphin();
  const dolSwim = new THREE.InstancedBufferAttribute(new Float32Array(ND * 4), 4);
  dolSwim.setUsage(THREE.DynamicDrawUsage);
  dol.geo.setAttribute('aSwim', dolSwim);
  const dm = dolphinMaterial(dol.eye, U$1, patch);
  const dolMesh = new THREE.InstancedMesh(dol.geo, dm.mat, ND);
  dolMesh.name = 'life-dolphins';
  dolMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  dolMesh.frustumCulled = false;
  dolMesh.castShadow = true;
  dolMesh.receiveShadow = false;
  dolMesh.customDepthMaterial = dm.depth;
  dolMesh.visible = false;
  root.add(dolMesh);
  disposables.push(dol.geo, dm.mat, dm.depth);
  const D = {
    active: false, arc: 0, len: 1, speed: 4.8, p0: [0, 0, 0], c: [0, 0, 0], p1: [0, 0, 0],
    off: [0, 0, 0], lf: [0, 0, 0], vel: [0, 0, 0],
    latS: 1,
    tab: new Float32Array(33), size: new Float32Array(ND), ph: new Float32Array(ND), bank: new Float32Array(ND),
    fx: new Float32Array(ND), fz: new Float32Array(ND),
  };
  for (let k = 0; k < ND; k++) D.size[k] = rr(2.0, 2.3);
  const DOL_LAG = [0, -2.6, -1.4, -4.3], DOL_LAT = [0, 1.3, 0.55, 1.9], DOL_VER = [0, -0.45, 0.4, 0.15];
  const A3 = [0, 0, 0], B3 = [0, 0, 0], T1 = [0, 0, 0], T2 = [0, 0, 0];

  const ENT_SHADE = 1, ENT_CLOUD = 2, ENT_RISE = 3;
  const ent = new Uint8Array(N), enS = new Uint8Array(N), enT = new Float32Array(N), enA = new Float32Array(N), enR = new Float32Array(N), enH = new Float32Array(N);
  const enF = new Float32Array(N), enW = new Float32Array(N), enHX = new Float32Array(N), enHY = new Float32Array(N), enHZ = new Float32Array(N), enG = new Int16Array(N);
  const enP = new Float32Array(N);
  const EN = {
    on: false, t0: 0, burst: -1e9, boots: -1e9, px: 0, py: 0, pz: 0, cx: 0, cy: 0, cz: 0, ax: 1, az: 0, ox: 0, oz: 1, mill: 1,
    kx: 0, ky: -11, kz: 0, krx: 3.8, kry: 2.2, kTop: -9, kBot: -13, lx: 0, ly: -20, lz: 0, fx: 0, fz: 1, rise: false, down: 0, gone: 0, curious: false,
  };
  const SPS = SP.findIndex((q) => q.key === 'salema'), SPB = SP.findIndex((q) => q.key === 'bogue'), SPA = SP.findIndex((q) => q.key === 'anthias');
  const SPJ = SP.findIndex((q) => q.key === 'chromisJ'), SPCA = SP.findIndex((q) => q.key === 'chromisA');
  const takeRole = (i, role) => { ent[i] = role; enS[i] = 0; enT[i] = 0; enHX[i] = hmX[i]; enHY[i] = hmY[i]; enHZ[i] = hmZ[i]; enG[i] = grp[i]; st[i] = 0; cuS[i] = 0; alm[i] = 0; };
  const endRole = (i) => { if (!ent[i]) return; hmX[i] = enHX[i]; hmY[i] = enHY[i]; hmZ[i] = enHZ[i]; grp[i] = enG[i]; ent[i] = 0; enS[i] = 0; };
  function shadeHome(i, t, out) {
    const a = enA[i] + EN.mill * (0.42 / Math.max(0.6, enR[i] * 1.6)) * (t - EN.t0), r = enR[i];
    out[0] = EN.cx + EN.ax * Math.cos(a) * 2.2 * r + EN.ox * Math.sin(a) * 1.0 * r;
    out[1] = enH[i];
    out[2] = EN.cz + EN.az * Math.cos(a) * 2.2 * r + EN.oz * Math.sin(a) * 1.0 * r;
    return a;
  }
  function setEntry(o) {
    if (!o || !o.station || !o.entry || !o.land) return;
    for (let i = 0; i < N; i++) endRole(i);
    if (Number.isFinite(o.seed)) seed = ((o.seed >>> 0) ^ 0x2f6b1d3) | 1;
    const t = simTime;
    EN.on = true; EN.t0 = t; EN.burst = -1e9; EN.boots = -1e9; EN.rise = false; EN.down = 0; EN.gone = 0; EN.curious = false;
    EN.mill = o.mill === -1 ? -1 : 1;
    let ox = o.out ? o.out.x : 1, oz = o.out ? o.out.z : 0;
    const ol = Math.hypot(ox, oz) || 1; ox /= ol; oz /= ol;
    EN.ox = ox; EN.oz = oz; EN.ax = -oz; EN.az = ox;
    EN.cx = o.station.x + ox * 1.6; EN.cz = o.station.z + oz * 1.6; EN.cy = -1.9;
    EN.px = o.entry.x; EN.py = o.entry.y; EN.pz = o.entry.z;
    EN.lx = o.land.x; EN.ly = o.land.y; EN.lz = o.land.z;
    let fx = o.face ? o.face.x - o.land.x : 0, fz = o.face ? o.face.z - o.land.z : 1;
    const fl0 = Math.hypot(fx, fz) || 1; EN.fx = fx / fl0; EN.fz = fz / fl0;
    let bx = o.lens ? o.entry.x - o.lens.x : EN.fx, bz = o.lens ? o.entry.z - o.lens.z : EN.fz;
    const bl = Math.hypot(bx, bz) || 1; bx /= bl; bz /= bl;
    let m = 0;
    const nS = Math.max(12, Math.round(45 * quality)), nB = Math.max(18, Math.round(80 * quality));
    for (const [s, n] of [[SPS, nS], [SPB, nB]]) {
      if (s < 0) continue;
      const S = SP[s];
      for (let k = 0; k < Math.min(n, S.count); k++) {
        const i = S.start + k;
        takeRole(i, ENT_SHADE);
        enA[i] = rand$1() * TAU$3; enR[i] = Math.sqrt(0.08 + 0.92 * rand$1()); enH[i] = clamp$4(EN.cy + rr(-0.9, 0.9), -3, -0.8);
        enT[i] = rr(0.4, 0.6);
        const a = shadeHome(i, t, P3);
        pX[i] = P3[0] + rr(-0.2, 0.2); pY[i] = P3[1]; pZ[i] = P3[2] + rr(-0.2, 0.2); fl[i] = floorAt(pX[i], pZ[i]);
        const tx = -EN.ax * Math.sin(a) + EN.ox * Math.cos(a), tz = -EN.az * Math.sin(a) + EN.oz * Math.cos(a), v = 0.4 * EN.mill;
        vX[i] = tx * v; vY[i] = 0; vZ[i] = tz * v; hX[i] = tx * EN.mill; hY[i] = 0; hZ[i] = tz * EN.mill;
        m++;
      }
    }
    const u = 0.36;
    EN.kx = o.entry.x + (o.land.x - o.entry.x) * u + bx * 0.4; EN.kz = o.entry.z + (o.land.z - o.entry.z) * u + bz * 0.4;
    EN.ky = Math.max(o.entry.y + (o.land.y - o.entry.y) * u, floorAt(EN.kx, EN.kz) + 5);
    EN.kTop = EN.ky + EN.kry; EN.kBot = EN.ky - EN.kry;
    const veil = (i) => {
      const y = EN.py - rr(1.6, 6.0), u2 = clamp$4((EN.py - y) / Math.max(1, EN.py - EN.ly), 0, 1);
      const a = Math.atan2(bz, bx) + rr(-1.8, 1.8), r = rr(0.9, 2.2);
      hmX[i] = EN.px + (EN.lx - EN.px) * u2 + Math.cos(a) * r; hmY[i] = y; hmZ[i] = EN.pz + (EN.lz - EN.pz) * u2 + Math.sin(a) * r;
      enP[i] = 0.8;
    };
    for (const [s, n, nV] of [[SPJ, Math.round(180 * quality), Math.round(40 * quality)], [SPCA, Math.round(70 * quality), Math.round(70 * quality)]]) {
      if (s < 0) continue;
      const S = SP[s], cand = [];
      for (let k = 0; k < S.count; k++) { const i = S.start + k, g = grp[i]; if (gClouds.indexOf(g) >= 0 && !fdr[i]) cand.push(i); }
      cand.sort((a, b) => (pX[b] - wreck.x) ** 2 + (pZ[b] - wreck.z) ** 2 - ((pX[a] - wreck.x) ** 2 + (pZ[a] - wreck.z) ** 2));
      for (let k = 0; k < Math.min(n, cand.length); k++) {
        const i = cand[k];
        takeRole(i, ENT_CLOUD);
        if (grp[i] >= 0) gCount[grp[i]] = Math.max(0, gCount[grp[i]] - 1);
        enP[i] = 1.5;
        if (k < nV) veil(i);
        else {
          let dx, dy, dz, d2;
          do { dx = rr(-1, 1); dy = rr(-1, 1); dz = rr(-1, 1); d2 = dx * dx + dy * dy + dz * dz; } while (d2 > 1);
          const sc = 0.35 + 0.65 * Math.sqrt(d2);
          hmX[i] = EN.kx + dx * EN.krx * sc; hmY[i] = EN.ky + dy * EN.kry * sc; hmZ[i] = EN.kz + dz * EN.krx * sc;
        }
        pX[i] = hmX[i]; pY[i] = hmY[i]; pZ[i] = hmZ[i]; fl[i] = floorAt(pX[i], pZ[i]);
        vX[i] = vY[i] = vZ[i] = 0;
        enT[i] = 0;
      }
    }
    if (SPA >= 0) {
      const S = SP[SPA], cand = [];
      for (let k = 0; k < S.count; k++) { const i = S.start + k; if (grp[i] === gAnth[0]) cand.push(i); }
      cand.sort((a, b) => (pX[a] - o.land.x) ** 2 + (pZ[a] - o.land.z) ** 2 - ((pX[b] - o.land.x) ** 2 + (pZ[b] - o.land.z) ** 2));
      const n = Math.min(cand.length, Math.max(8, Math.round(36 * quality)));
      for (let k = 0; k < n; k++) {
        const i = cand[k];
        takeRole(i, ENT_RISE);
        const a = Math.atan2(EN.fz, EN.fx) + rr(-1.4, 1.4), r = rr(1.6, 3.6);
        P3[0] = o.land.x + Math.cos(a) * r; P3[2] = o.land.z + Math.sin(a) * r; P3[1] = floorAt(P3[0], P3[2]) + rr(0.25, 0.8);
        pushOut(P3, 0.3);
        P3[1] = Math.max(P3[1], floorAt(P3[0], P3[2]) + 0.25);
        hmX[i] = P3[0]; hmY[i] = P3[1]; hmZ[i] = P3[2];
        pX[i] = P3[0]; pY[i] = P3[1]; pZ[i] = P3[2]; vX[i] = vY[i] = vZ[i] = 0; fl[i] = floorAt(P3[0], P3[2]);
        enA[i] = Math.atan2(bz, bx) + rr(-1.9, 1.9); enR[i] = rr(1.3, 2.4); enH[i] = rr(-0.6, 1.1);
      }
    }
    DS.far = [bx, bz]; descentSpot();
    return m;
  }
  function splash(p, k, boots) {
    if (!EN.on || !p) return;
    const t = simTime;
    if (boots) {
      EN.boots = t;
      const near = [];
      for (let i = 0; i < N; i++) if (ent[i] === ENT_SHADE) near.push(i);
      near.sort((a, b) => (pX[a] - p.x) ** 2 + (pY[a] - p.y) ** 2 + (pZ[a] - p.z) ** 2 - ((pX[b] - p.x) ** 2 + (pY[b] - p.y) ** 2 + (pZ[b] - p.z) ** 2));
      for (let k2 = 0; k2 < Math.min(12, near.length); k2++) {
        const i = near[k2], dx = pX[i] - p.x, dy = pY[i] - p.y, dz = pZ[i] - p.z, d = Math.sqrt(dx * dx + dy * dy + dz * dz) + 1e-4;
        alm[i] = Math.max(alm[i], 0.6);
        vX[i] += (dx / d) * 0.8; vY[i] += (dy / d) * 0.8 - 0.2; vZ[i] += (dz / d) * 0.8;
      }
      return;
    }
    EN.burst = t;
    for (let i = 0; i < N; i++) {
      if (ent[i] !== ENT_SHADE) continue;
      let dx = pX[i] - p.x, dy = pY[i] - p.y, dz = pZ[i] - p.z;
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz) + 1e-4;
      enS[i] = 1; enT[i] = rr(0.4, 0.6);
      if (d > 4.5) continue;
      dx /= d; dy = dy / d - 0.35; dz /= d;
      const l = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1, v = (0.6 + 2.4 * Math.sqrt(1 - d / 4.5)) * (0.85 + 0.3 * rand$1()) * clamp$4(k || 1, 0.6, 1.3);
      vX[i] += (dx / l) * v; vY[i] += (dy / l) * v; vZ[i] += (dz / l) * v;
      alm[i] = 1;
    }
  }
  function goalEntry(i, S) {
    const t = fT, x = pX[i], y = pY[i], z = pZ[i], role = ent[i];
    if (role === ENT_SHADE) {
      const since = t - EN.burst;
      if (enS[i] === 1 && since >= enT[i]) { enS[i] = 2; enA[i] = Math.atan2(z - DVR.z, x - DVR.x); enR[i] = rr(0.75, 1.5); enH[i] = rr(-1.1, 0.8); enT[i] = rr(0.55, 0.8); enW[i] = since; }
      if (enS[i] === 2 && (!fDv || since > 4.5 + 0.5 * hash01(i, 3) || y - DVR.y > 4.5)) { enS[i] = 3; enH[i] = clamp$4(EN.cy + rr(-0.9, 0.9), -3, -0.8); }
      if (enS[i] === 1) {
        enF[i] = 3.0; GO[8] = S.vMax * 1.9 * fSpd; GO[3] = 0.4;
        return;
      }
      if (enS[i] === 2) {
        enA[i] += EN.mill * enT[i] * fDt;
        const c = Math.cos(enA[i]), sn = Math.sin(enA[i]);
        const tx = DVR.x + c * enR[i], ty = DVR.y + enH[i], tz = DVR.z + sn * enR[i], w = EN.mill * enT[i] * enR[i];
        const vc = since - enW[i] < 1.5 ? 2.8 : 2.0;
        GO[0] = -sn * w + (tx - x) * 1.4 + DVR.vx; GO[2] = c * w + (tz - z) * 1.4 + DVR.vz;
        GO[1] = DVR.vy + (ty - y) * 1.2;
        const l = Math.sqrt(GO[0] * GO[0] + GO[1] * GO[1] + GO[2] * GO[2]);
        if (l > vc) { GO[0] *= vc / l; GO[1] *= vc / l; GO[2] *= vc / l; }
        GO[3] = 2.6; GO[8] = vc * fSpd; enF[i] = 0.9;
        return;
      }
      shadeHome(i, t, P3);
      const a = enA[i] + EN.mill * (0.42 / Math.max(0.6, enR[i] * 1.6)) * (t - EN.t0);
      const tx = -EN.ax * Math.sin(a) + EN.ox * Math.cos(a), tz = -EN.az * Math.sin(a) + EN.oz * Math.cos(a), vm = 0.35 + 0.15 * hash01(i, 11);
      let dvx = (P3[0] - x) * 0.8 + tx * vm * EN.mill, dvy = (P3[1] - y) * 0.8, dvz = (P3[2] - z) * 0.8 + tz * vm * EN.mill;
      const l = Math.sqrt(dvx * dvx + dvy * dvy + dvz * dvz), cap = enS[i] === 3 ? S.cruise * 1.2 : 0.9;
      if (l > cap) { dvx *= cap / l; dvy *= cap / l; dvz *= cap / l; }
      GO[0] = dvx; GO[1] = dvy; GO[2] = dvz; GO[3] = 1.2;
      enF[i] = enS[i] === 0 ? 0.8 : 2.0;
      return;
    }
    if (role === ENT_CLOUD) {
      const qx = x - DVR.x, qz = z - DVR.z, qy = y - DVR.y;
      const dBody = fDv ? Math.sqrt(qx * qx + qz * qz + Math.max(0, -qy - 1.7, qy) ** 2) : 99;
      const lx = x - fLx, ly = y - fLy, lz = z - fLz, dLens = Math.sqrt(lx * lx + ly * ly + lz * lz);
      if (enS[i] === 4) {
        enT[i] -= fDt;
        if (enT[i] <= 0 || !fDv) { enS[i] = 0; }
        else {
          const tx = DVR.x + Math.cos(enA[i]) * enR[i], ty = DVR.y + 0.1, tz = DVR.z + Math.sin(enA[i]) * enR[i];
          GO[0] = DVR.vx + (tx - x) * 1.6; GO[1] = clamp$4(DVR.vy + (ty - y) * 1.6, -2.4, 2.4); GO[2] = DVR.vz + (tz - z) * 1.6;
          GO[3] = 2.6; GO[8] = 2.6 * fSpd; GO[4] = 0.6; GO[5] = -qx; GO[6] = -qy * 0.3; GO[7] = -qz;
          enF[i] = 0.45;
          return;
        }
      }
      if (dBody < enP[i] || dLens < 1.0) { enS[i] = 1; enT[i] = rr(1.5, 2.5); }
      if (enS[i] === 1) {
        enT[i] -= fDt;
        if (enT[i] <= 0) enS[i] = 0;
        const near = dLens < 1.0 && dLens < dBody, ax = near ? lx : qx, az = near ? lz : qz, al = Math.sqrt(ax * ax + az * az) || 1;
        const k = dBody < enP[i] + 0.7 || dLens < 1.6 ? 1.3 : 0.35;
        GO[0] = (ax / al) * k; GO[1] = (hmY[i] - y) * 0.5; GO[2] = (az / al) * k; GO[3] = 2.0; GO[8] = 1.7 * fSpd;
        enF[i] = 1.5;
        return;
      }
      let dvx = (hmX[i] - x) * 0.9, dvy = (hmY[i] - y) * 0.9, dvz = (hmZ[i] - z) * 0.9;
      const l = Math.sqrt(dvx * dvx + dvy * dvy + dvz * dvz), cap = 0.35 * fSpd;
      if (l > cap) { dvx *= cap / l; dvy *= cap / l; dvz *= cap / l; }
      tB[i] -= fDt;
      if (tB[i] < -0.3) { tB[i] = rr(0.8, 3.5); pA[i] = rand$1() * TAU$3; pB[i] = rr(-0.25, 0.25); }
      if (tB[i] < 0) { dvx += Math.cos(pA[i]) * 0.5; dvz += Math.sin(pA[i]) * 0.5; dvy += pB[i]; }
      GO[0] = dvx; GO[1] = dvy; GO[2] = dvz;
      GO[4] = 1 - clamp$4(Math.sqrt(vX[i] * vX[i] + vY[i] * vY[i] + vZ[i] * vZ[i]) / S.vAlign, 0, 1); GO[5] = fcX[i]; GO[7] = fcZ[i];
      enF[i] = 1.5;
      return;
    }
    if (EN.rise && fDv && EN.down < 3) {
      const fl = floorAt(DVR.x, DVR.z), c = Math.cos(enA[i]), sn = Math.sin(enA[i]);
      const tx = DVR.x + c * enR[i], tz = DVR.z + sn * enR[i], ty = clamp$4(DVR.y - 0.9 + enH[i], floorAt(tx, tz) + 0.8, fl + 3.4);
      let dvx = (tx - x) * 0.8, dvy = (ty - y) * 0.8, dvz = (tz - z) * 0.8;
      const l = Math.sqrt(dvx * dvx + dvy * dvy + dvz * dvz), cap = (0.3 + 0.2 * hash01(i, 5)) * fSpd * (l > 1.5 ? 2.2 : 1);
      if (l > cap) { dvx *= cap / l; dvy *= cap / l; dvz *= cap / l; }
      GO[0] = dvx; GO[1] = dvy; GO[2] = dvz; GO[3] = 1.4; GO[8] = 1.2 * fSpd;
      GO[4] = 0.7; GO[5] = DVR.x - x; GO[6] = 0; GO[7] = DVR.z - z;
      enF[i] = 1.0;
      return;
    }
    goalHover(i, S);
    enF[i] = S.flee;
  }
  function stepEntry(dt) {
    if (!EN.on) return;
    if (fDv) {
      EN.gone = 0;
      if (!EN.rise && DVR.y - 1.8 - floorAt(DVR.x, DVR.z) < 5.5) EN.rise = true;
      if (EN.rise && Math.abs(DVR.vy) < 0.05 && DVR.y - floorAt(DVR.x, DVR.z) < 2.0) EN.down += dt;
      if (!EN.curious && DVR.y < EN.kTop + 0.5) {
        EN.curious = true;
        const near = [];
        for (let i = 0; i < N; i++) if (ent[i] === ENT_CLOUD && spc[i] === SPJ) near.push(i);
        near.sort((a, b) => (pX[a] - DVR.x) ** 2 + (pZ[a] - DVR.z) ** 2 - ((pX[b] - DVR.x) ** 2 + (pZ[b] - DVR.z) ** 2));
        const lb = Math.atan2(fLz - DVR.z, fLx - DVR.x);
        for (let k = 0; k < Math.min(6, near.length); k++) { const i = near[k]; enS[i] = 4; enT[i] = 1.2; enR[i] = rr(0.7, 0.9); enA[i] = lb + (k & 1 ? 1 : -1) * rr(1.6, 2.6); }
      }
    } else EN.gone += dt;
    if (EN.gone > 8) {
      for (let i = 0; i < N; i++) if (ent[i] === ENT_CLOUD || ent[i] === ENT_RISE) { if (ent[i] === ENT_CLOUD && enG[i] >= 0) gCount[enG[i]]++; endRole(i); }
    }
  }
  function entryFocus(p, r1, r2, out) {
    if (!EN.on || !p) return null;
    let n = 0, sx = 0, sy = 0, sz = 0;
    for (let i = 0; i < N; i++) {
      if (ent[i] !== ENT_SHADE) continue;
      const dx = pX[i] - p.x, dy = pY[i] - p.y, dz = pZ[i] - p.z;
      if (dx * dx + dy * dy + dz * dz < r1 * r1) { n++; sx += pX[i]; sy += pY[i]; sz += pZ[i]; }
    }
    if (n >= 4) return out.set(sx / n, sy / n, sz / n);
    if ((EN.kx - p.x) ** 2 + (EN.ky - p.y) ** 2 + (EN.kz - p.z) ** 2 < r2 * r2) return out.set(EN.kx, EN.ky, EN.kz);
    return null;
  }
  function entryStats() {
    const out = {};
    const q = LF.q, qx = -q[0], qy = -q[1], qz = -q[2], qw = q[3];
    for (const [nm, role] of [['shade', ENT_SHADE], ['cloud', ENT_CLOUD], ['rise', ENT_RISE]]) {
      let n15 = 0, n3 = 0, n25 = 0, nL = 0, on8 = 0, dH = 99, dL = 99, n = 0;
      for (let i = 0; i < N; i++) {
        if (ent[i] !== role) continue;
        n++;
        const hx = pX[i] - DVR.x, hy = pY[i] - DVR.y, hz = pZ[i] - DVR.z, h = Math.sqrt(hx * hx + hy * hy + hz * hz);
        const vx = pX[i] - LF.p[0], vy = pY[i] - LF.p[1], vz = pZ[i] - LF.p[2], l = Math.sqrt(vx * vx + vy * vy + vz * vz);
        if (h < 1.5) n15++; if (h < 2.5) n25++; if (h < 3) n3++; if (l < 0.9) nL++; if (h < dH) dH = h; if (l < dL) dL = l;
        if (l < 8) {
          const ix = qw * vx + qy * vz - qz * vy, iy = qw * vy + qz * vx - qx * vz, iz = qw * vz + qx * vy - qy * vx, iw = -qx * vx - qy * vy - qz * vz;
          const cx = ix * qw + iw * -qx + iy * -qz - iz * -qy, cy = iy * qw + iw * -qy + iz * -qx - ix * -qz, cz = iz * qw + iw * -qz + ix * -qy - iy * -qx;
          if (cz < -0.2 && Math.abs(cx / -cz) < LF.th && Math.abs(cy / -cz) < LF.tv) on8++;
        }
      }
      out[nm] = { n, n15, n25, n3, nL, on8, dH: +dH.toFixed(2), dL: +dL.toFixed(2) };
    }
    out.burst = EN.burst > -1e8 ? +(simTime - EN.burst).toFixed(2) : null;
    return out;
  }

  const LF = { on: false, p: [0, 0, 0], q: [0, 0, 0, 1], tv: 0.7, th: 0.9 };
  function setLensFrame(pos, quat, vfov, aspect) {
    if (!pos || !quat || !Number.isFinite(pos.x + pos.y + pos.z + quat.x + quat.y + quat.z + quat.w)) return;
    LF.on = true;
    LF.p[0] = pos.x; LF.p[1] = pos.y; LF.p[2] = pos.z;
    LF.q[0] = quat.x; LF.q[1] = quat.y; LF.q[2] = quat.z; LF.q[3] = quat.w;
    LF.tv = Math.tan(((Number.isFinite(vfov) ? vfov : 60) * Math.PI) / 360); LF.th = LF.tv * (Number.isFinite(aspect) ? aspect : 1.5);
  }
  function lensToWorld(vx, vy, vz, out, o) {
    const qx = LF.q[0], qy = LF.q[1], qz = LF.q[2], qw = LF.q[3];
    const ix = qw * vx + qy * vz - qz * vy, iy = qw * vy + qz * vx - qx * vz, iz = qw * vz + qx * vy - qy * vx, iw = -qx * vx - qy * vy - qz * vz;
    out[o] = ix * qw + iw * -qx + iy * -qz - iz * -qy + LF.p[0];
    out[o + 1] = iy * qw + iw * -qy + iz * -qx - ix * -qz + LF.p[1];
    out[o + 2] = iz * qw + iw * -qz + ix * -qy - iy * -qx + LF.p[2];
  }
  const DP = {
    on: false, t0: 0, tE: [0, 1, 2, 3], K: [], n: 3, rollDir: 1, half2: false, lag: [0, 0.8, 1.5], dd: [0, 1.1, 1.8], dy: [0, 0.07, 0.12],
    W: new Float32Array(ND * 3), Wp: new Float32Array(ND * 3), hd: new Float32Array(ND * 3), ok: new Uint8Array(ND), push: new Float32Array(ND), tv: 0.7,
  };
  const CR = [0, 0, 0];
  const sm5c = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * x * (x * (6 * x - 15) + 10));
  function passPoint(u, out) {
    const K = DP.K, t = DP.tE;
    if (u <= t[0] || u >= t[3]) {
      const e = u <= t[0] ? 0 : 3, a = e ? 2 : 0, b = e ? 3 : 1, dtK = t[b] - t[a], du = u - t[e];
      for (let j = 0; j < 3; j++) out[j] = K[e][j] + ((K[b][j] - K[a][j]) / dtK) * du;
      return out;
    }
    const i = u < t[1] ? 0 : u < t[2] ? 1 : 2;
    const t0 = i > 0 ? t[i - 1] : t[0] - (t[1] - t[0]), t1 = t[i], t2 = t[i + 1], t3 = i + 2 <= 3 ? t[i + 2] : t[3] + (t[3] - t[2]);
    for (let j = 0; j < 3; j++) {
      const P1 = K[i][j], P2 = K[i + 1][j], P0 = i > 0 ? K[i - 1][j] : 2 * K[0][j] - K[1][j], P3v = i + 2 <= 3 ? K[i + 2][j] : 2 * K[3][j] - K[2][j];
      const A1 = ((t1 - u) * P0 + (u - t0) * P1) / (t1 - t0), A2 = ((t2 - u) * P1 + (u - t1) * P2) / (t2 - t1), A3v = ((t3 - u) * P2 + (u - t2) * P3v) / (t3 - t2);
      const B1 = ((t2 - u) * A1 + (u - t0) * A2) / (t2 - t0), B2 = ((t3 - u) * A2 + (u - t1) * A3v) / (t3 - t1);
      out[j] = ((t2 - u) * B1 + (u - t1) * B2) / (t2 - t1);
    }
    return out;
  }
  function memberAt(k, u, out, o) {
    passPoint(u - DP.lag[k], CR);
    const z = CR[2] + DP.dd[k] + DP.push[k];
    lensToWorld(CR[0] * (z / CR[2]), CR[1] * (z / CR[2]) + DP.dy[k] * DP.tv * z, -z, out, o);
  }
  function startPass(plan) {
    const tv = Math.tan((((Number.isFinite(plan.vfov) ? plan.vfov : 0) || (LF.tv ? Math.atan(LF.tv) * 360 / Math.PI : 70)) * Math.PI) / 360);
    const th = tv * (Number.isFinite(plan.aspect) ? plan.aspect : LF.th / LF.tv);
    DP.tv = tv;
    DP.K = plan.P.map((k) => [k[0] * th * k[2], k[1] * tv * k[2], k[2]]);
    DP.tE = plan.tE.slice(0, 4);
    DP.t0 = simTime + (Number.isFinite(plan.at) ? plan.at : 0);
    DP.n = clamp$4(plan.n | 0, 1, ND); DP.rollDir = plan.rollDir < 0 ? -1 : 1; DP.half2 = !!plan.half2;
    if (plan.lag) DP.lag = plan.lag; if (plan.dd) DP.dd = plan.dd; if (plan.dy) DP.dy = plan.dy;
    const r = typeof plan.rng === 'function' ? plan.rng : rand$1;
    for (let k = 0; k < ND; k++) { D.size[k] = 2.0 + 0.3 * r(); D.bank[k] = 0; D.ph[k] = r() * TAU$3; DP.ok[k] = 0; DP.push[k] = 0; }
    DP.on = true; D.active = false;
    dolMesh.count = DP.n;
    dolMesh.visible = false;
    return plan.side || 1;
  }
  function updatePass(dt, t) {
    const u = t - DP.t0, uEnd = DP.tE[3] + DP.lag[DP.n - 1] + 1.2;
    if (u > uEnd) { DP.on = false; dolMesh.visible = false; dolMesh.count = ND; return; }
    if (u < -0.6 || !LF.on) { dolMesh.visible = false; return; }
    dolMesh.visible = true;
    const m = dolMesh.instanceMatrix.array, w = dolSwim.array, W = DP.W;
    for (let k = 0; k < DP.n; k++) {
      const o = k * 3;
      memberAt(k, u, W, o);
      let near = 99;
      if (fDv) {
        const qx = W[o] - DVR.x, qz = W[o + 2] - DVR.z, qy = W[o + 1] - DVR.y;
        near = Math.sqrt(qx * qx + qz * qz + Math.max(0, -qy - 1.8, qy) ** 2) - 0.35;
        for (let j = 0; j < DVR.nH; j++) { const H = DVR.hose, h = j * 7; const d = Math.hypot(W[o] - H[h], W[o + 1] - H[h + 1], W[o + 2] - H[h + 2]); if (d < near) near = d; }
      }
      const dl = Math.hypot(W[o] - LF.p[0], W[o + 1] - LF.p[1], W[o + 2] - LF.p[2]);
      DP.push[k] = clamp$4(DP.push[k] + (near < 1.2 || dl < 1.8 ? 0.8 : -0.3) * dt, 0, 3);
      W[o + 1] = clamp$4(W[o + 1], floorAt(W[o], W[o + 2]) + 1.2, -1.2);
      if (!DP.ok[k]) {
        memberAt(k, u + 0.05, T1, 0);
        DP.hd[o] = (T1[0] - W[o]) / 0.05; DP.hd[o + 1] = (T1[1] - W[o + 1]) / 0.05; DP.hd[o + 2] = (T1[2] - W[o + 2]) / 0.05;
        DP.ok[k] = 1;
      } else if (dt > 0) {
        const kk = 1 - Math.exp(-dt / 0.15);
        DP.hd[o] += ((W[o] - DP.Wp[o]) / dt - DP.hd[o]) * kk; DP.hd[o + 1] += ((W[o + 1] - DP.Wp[o + 1]) / dt - DP.hd[o + 1]) * kk; DP.hd[o + 2] += ((W[o + 2] - DP.Wp[o + 2]) / dt - DP.hd[o + 2]) * kk;
      }
      DP.Wp[o] = W[o]; DP.Wp[o + 1] = W[o + 1]; DP.Wp[o + 2] = W[o + 2];
      let fx = DP.hd[o], fy = DP.hd[o + 1], fz = DP.hd[o + 2];
      let fl2 = Math.sqrt(fx * fx + fy * fy + fz * fz);
      if (fl2 < 1e-4) { fx = D.fx[k]; fy = 0; fz = D.fz[k]; fl2 = Math.sqrt(fx * fx + fz * fz) || 1; }
      fx /= fl2; fy /= fl2; fz /= fl2;
      if (fy > 0.85 || fy < -0.85) {
        fy = fy > 0 ? 0.85 : -0.85;
        const xz = Math.sqrt(fx * fx + fz * fz) || 1, kk = Math.sqrt(1 - fy * fy) / xz;
        fx *= kk; fz *= kk;
      }
      let Lx = fz, Lz = -fx;
      const Ll = Math.sqrt(Lx * Lx + Lz * Lz) || 1;
      Lx /= Ll; Lz /= Ll;
      if (dt > 0) {
        const yawL = ((fx - D.fx[k]) * Lx + (fz - D.fz[k]) * Lz) / dt;
        D.bank[k] += (-clamp$4(yawL * 1.2, -0.6, 0.6) - D.bank[k]) * (1 - Math.exp(-dt * 3));
        D.ph[k] += TAU$3 * 2.1 * dt;
        if (D.ph[k] > TAU$3) D.ph[k] -= TAU$3;
      }
      D.fx[k] = fx; D.fz[k] = fz;
      let roll = D.bank[k] + 0.2 * Math.sin(t * 0.8 + k * 1.9);
      if (k === 0) roll += DP.rollDir * TAU$3 * sm5c((u - DP.tE[1]) / (DP.tE[2] - DP.tE[1]));
      if (k === 1 && DP.half2) { const v = (u - DP.tE[2] - 0.4) / 1.2; if (v > 0 && v < 1) roll += DP.rollDir * (Math.PI / 2) * Math.sin(Math.PI * v); }
      const Ux = fy * Lz, Uy = fz * Lx - fx * Lz, Uz = -fy * Lx;
      const cb = Math.cos(roll), sb = Math.sin(roll), s = D.size[k], mo = k * 16;
      m[mo] = (Lx * cb + Ux * sb) * s; m[mo + 1] = Uy * sb * s; m[mo + 2] = (Lz * cb + Uz * sb) * s; m[mo + 3] = 0;
      m[mo + 4] = (Ux * cb - Lx * sb) * s; m[mo + 5] = Uy * cb * s; m[mo + 6] = (Uz * cb - Lz * sb) * s; m[mo + 7] = 0;
      m[mo + 8] = fx * s; m[mo + 9] = fy * s; m[mo + 10] = fz * s; m[mo + 11] = 0;
      m[mo + 12] = W[o]; m[mo + 13] = W[o + 1]; m[mo + 14] = W[o + 2]; m[mo + 15] = 1;
      w[k * 4] = D.ph[k]; w[k * 4 + 1] = 0.075; w[k * 4 + 2] = 0; w[k * 4 + 3] = 0;
    }
    dolMesh.instanceMatrix.needsUpdate = true;
    dolSwim.needsUpdate = true;
  }
  function dolphinLead(out, lead = 0) {
    if (!DP.on || !LF.on) return null;
    const u = simTime - DP.t0 + (lead || 0);
    if (u < -0.3 || u > DP.tE[3] + 0.5) return null;
    memberAt(0, u, T2, 0);
    return out && out.set ? out.set(T2[0], T2[1], T2[2]) : [T2[0], T2[1], T2[2]];
  }
  function dolWay(i, S, x, y, z) {
    if (S.kind === K_REST || S.kind === K_GRAZE || S.kind === K_GROUPER) return;
    for (let k = 0; k < DP.n; k++) {
      const o = k * 3, dx = x - DP.W[o], dy = y - DP.W[o + 1], dz = z - DP.W[o + 2], d2 = dx * dx + dy * dy + dz * dz;
      if (d2 > 6.25) continue;
      const d = Math.sqrt(d2) + 1e-4, w2 = 1 - d / 2.5, k2 = (S.fleeW || 4) * w2 * (0.6 + w2) * fDt;
      vX[i] += (dx / d) * k2; vY[i] += (dy / d) * k2 * 0.4; vZ[i] += (dz / d) * k2;
      if (alm[i] < 0.5 * w2) alm[i] = 0.5 * w2;
    }
  }

  if (scene) scene.add(root);

  let simTime = 0, frame = 0, calm = 0, calmTarget = 0;

  function pickGroupTarget(g) {
    if (gKind[g] === K_SCHOOL && gReef[g] === -2) {
      const n = PATROL.length, w = (gWp[g] = (gWp[g] + (g & 1 ? 1 : n - 1)) % n), p = PATROL[w];
      P3[0] = p[0] + rr(-1.2, 1.2); P3[2] = p[1] + rr(-1.2, 1.2); P3[1] = floorAt(P3[0], P3[2]) + rr(1.1, 2.3);
      pushOut(P3, 1.2);
      gTimer[g] = 25;
    } else if (gKind[g] === K_SCHOOL) {
      let r = Math.floor(rand$1() * reefs.length);
      if (reefs.length > 1 && r === gReef[g]) r = (r + 1) % reefs.length;
      gReef[g] = r;
      P3[0] = reefs[r].x + rr(-2.5, 2.5); P3[1] = reefs[r].y + rr(1.2, 3.0); P3[2] = reefs[r].z + rr(-2.5, 2.5);
      pushOut(P3, 1.5);
      gTimer[g] = 40;
    } else {
      const a = rand$1() * TAU$3, r = Math.sqrt(rand$1()) * meadow.r * 0.6;
      P3[0] = meadow.x + Math.cos(a) * r; P3[2] = meadow.z + Math.sin(a) * r;
      P3[1] = floorAt(P3[0], P3[2]) + 0.9;
      gTimer[g] = 30;
    }
    gTX[g] = P3[0]; gTY[g] = P3[1]; gTZ[g] = P3[2];
  }

  function pickGrazeTarget(i) {
    const c = cand[i];
    if (c && c.length) {
      let k = c[Math.floor(rand$1() * c.length)];
      for (let tries = 0; tries < 4; tries++) {
        const q = RP[k];
        if ((q[0] - pX[i]) * (q[0] - pX[i]) + (q[2] - pZ[i]) * (q[2] - pZ[i]) < 16 || rand$1() < 0.3) break;
        k = c[Math.floor(rand$1() * c.length)];
      }
      const q = RP[k], off = 0.45 * scl[i] + 0.03;
      tgX[i] = q[0] + q[3] * off; tgY[i] = q[1] + q[4] * off; tgZ[i] = q[2] + q[5] * off;
      tnX[i] = q[3]; tnY[i] = q[4]; tnZ[i] = q[5];
    } else {
      const a = rand$1() * TAU$3, r = rr(1, 5);
      tgX[i] = hmX[i] + Math.cos(a) * r; tgZ[i] = hmZ[i] + Math.sin(a) * r;
      tgY[i] = floorAt(tgX[i], tgZ[i]) + 0.45;
      tnX[i] = 0; tnY[i] = 1; tnZ[i] = 0;
    }
    st[i] = 0;
  }

  const RZ = { on: false, placed: false, dir: 0, grp: -1, g: [-1, -1], spot: [0, 0, 0], gs: [0, 0, 0], tgt: [0, 0, 0], gt: [0, 0, 0, 0, 0, 0] };
  const rzF = new THREE.Frustum(), rzM = new THREE.Matrix4(), rzS = new THREE.Sphere(), rzL = new THREE.Vector3(), rzU = new THREE.Vector3();
  const rzSeen = (x, y, z, r) => { rzS.center.set(x, y, z); rzS.radius = r; return rzF.intersectsSphere(rzS); };
  const RZV = [0, 0, 0];
  function riseLine(c, o, y) {
    const lx = rzL.x - rzU.x * o, ly = rzL.y - rzU.y * o, lz = rzL.z - rzU.z * o, hl = Math.hypot(lx, lz) || 1;
    const D = (clamp$4((y - c.y) / Math.max(ly, 0.1), 0, 14) * hl) / (Math.hypot(lx, ly, lz) || 1);
    RZV[0] = c.x + (lx / hl) * D; RZV[1] = y; RZV[2] = c.z + (lz / hl) * D;
    return RZV;
  }
  function stepRise(player) {
    const cam = player && player.camera;
    if (!cam || player.state !== 'eclipse') { RZ.on = false; RZ.placed = false; RZ.dir = 0; RZ.grp = -1; return; }
    const c = cam.position;
    if (!(c.y < -1.2)) { RZ.on = false; return; }
    rzL.set(0, 0, -1).applyQuaternion(cam.quaternion);
    if (!RZ.placed && rzL.y < 0.6) return;
    cam.updateMatrixWorld();
    rzM.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
    rzF.setFromProjectionMatrix(rzM);
    rzU.set(0, 1, 0).applyQuaternion(cam.quaternion);
    let sx = -rzL.z, sz = rzL.x;
    const sl = Math.hypot(sx, sz) || 1;
    sx /= sl; sz /= sl;
    if (!RZ.placed) {
      const gs = !rzSeen(gX[gDesc], gY[gDesc], gZ[gDesc], 4.5) ? gDesc : !rzSeen(gX[gBream[1]], gY[gBream[1]], gZ[gBream[1]], 4.5) ? gBream[1] : -1;
      if (gs < 0) return;
      const bar = SP.find((q) => q.key === 'barracuda');
      RZ.g[0] = RZ.g[1] = -1;
      for (let k = 0, n = 0; bar && k < bar.count && n < 2; k++) {
        const i = bar.start + k;
        if (!rzSeen(pX[i], pY[i], pZ[i], 1.2)) RZ.g[n++] = i;
      }
      const yS = Math.min(-4.6, c.y + 9), yB = Math.min(-5.6, c.y + 5.5), side = rand$1() < 0.5 ? -1 : 1;
      const hl = Math.hypot(rzL.x, rzL.z) || 1, bx = -rzL.x / hl, bz = -rzL.z / hl;
      let ok = false, okB = false;
      for (let w = 0; w < 8 && !ok; w += 0.5) {
        const x = c.x + bx * w + sx * side * 1.5, z = c.z + bz * w + sz * side * 1.5;
        if (rzSeen(x, yS, z, 2.6) || yS < floorAt(x, z) + 2.5) continue;
        RZ.spot[0] = x; RZ.spot[1] = yS; RZ.spot[2] = z;
        ok = true;
      }
      for (let w = 0; w < 8 && ok && !okB; w += 0.5) {
        const x = c.x + bx * w - sx * side * 2.5, z = c.z + bz * w - sz * side * 2.5;
        if (rzSeen(x, yB, z, 1.2) || rzSeen(x + sx * side * 1.4, yB - 0.5, z + sz * side * 1.4, 1.2) || yB < floorAt(x, z) + 2) continue;
        RZ.gs[0] = x; RZ.gs[1] = yB; RZ.gs[2] = z;
        okB = true;
      }
      if (!okB) RZ.g[0] = RZ.g[1] = -1;
      if (!ok) return;
      const dx = RZ.spot[0] - gX[gs], dy = RZ.spot[1] - gY[gs], dz = RZ.spot[2] - gZ[gs];
      for (let i = 0; i < N; i++) {
        if (grp[i] !== gs) continue;
        pX[i] += dx; pY[i] += dy; pZ[i] += dz;
        vX[i] = rzL.x * 0.5 - sx * side * 0.4; vY[i] = 0; vZ[i] = rzL.z * 0.5 - sz * side * 0.4;
      }
      gX[gs] += dx; gY[gs] += dy; gZ[gs] += dz;
      gVX[gs] = rzL.x * 0.5 - sx * side * 0.4; gVY[gs] = 0; gVZ[gs] = rzL.z * 0.5 - sz * side * 0.4;
      gTimer[gs] = 40;
      RZ.grp = gs;
      for (let n = 0; n < 2; n++) {
        const i = RZ.g[n];
        if (i < 0) continue;
        pX[i] = RZ.gs[0] + sx * side * 1.4 * n; pY[i] = RZ.gs[1] - n * 0.5; pZ[i] = RZ.gs[2] + sz * side * 1.4 * n;
        vX[i] = -bx * 0.5 + sx * side * 0.5; vY[i] = 0; vZ[i] = -bz * 0.5 + sz * side * 0.5;
      }
      RZ.dir = -side;
      if (gs === gDesc) DS.hold = false;
      RZ.placed = true;
    }
    RZ.on = true;
    let V = riseLine(c, 0.22, RZ.spot[1]);
    RZ.tgt[0] = V[0] + sx * RZ.dir * 6; RZ.tgt[1] = RZ.spot[1]; RZ.tgt[2] = V[2] + sz * RZ.dir * 6;
    V = riseLine(c, 0.34, RZ.gs[1]);
    for (let n = 0; n < 2; n++) {
      const k = n * 3, w = -RZ.dir * (7 - n * 1.4);
      RZ.gt[k] = V[0] + sx * w; RZ.gt[k + 1] = RZ.gs[1] - n * 0.5; RZ.gt[k + 2] = V[2] + sz * w;
    }
  }

  function updateGroups(dt, t, spd, plx, ply, plz) {
    for (let g = 0; g < G; g++) {
      const kind = gKind[g];
      if (kind === K_BALL) {
        const tx = gTX[g] + 1.6 * Math.sin(t * 0.043), ty = gTY[g] + 0.6 * Math.sin(t * 0.061 + 1), tz = gTZ[g] + 1.6 * Math.cos(t * 0.037);
        let ex = (tx - gX[g]) * 0.25, ey = (ty - gY[g]) * 0.25, ez = (tz - gZ[g]) * 0.25;
        const dx = gX[g] - plx, dy = gY[g] - ply, dz = gZ[g] - plz, d2 = dx * dx + dy * dy + dz * dz;
        if (d2 < 49) { const d = Math.sqrt(d2) + 1e-4, k = (7 - d) * 0.35; ex += (dx / d) * k; ey += (dy / d) * k * 0.4; ez += (dz / d) * k; }
        const kk = Math.min(1, dt * 0.8);
        gVX[g] += (ex - gVX[g]) * kk; gVY[g] += (ey - gVY[g]) * kk; gVZ[g] += (ez - gVZ[g]) * kk;
        const v = Math.sqrt(gVX[g] * gVX[g] + gVY[g] * gVY[g] + gVZ[g] * gVZ[g]);
        if (v > 1.2) { gVX[g] *= 1.2 / v; gVY[g] *= 1.2 / v; gVZ[g] *= 1.2 / v; }
        gX[g] += gVX[g] * dt; gY[g] += gVY[g] * dt; gZ[g] += gVZ[g] * dt;
        gY[g] = clamp$4(gY[g], floorAt(gX[g], gZ[g]) + 5, -4);
        continue;
      }
      if (kind === K_VORTEX) {
        const k = Math.min(1, dt * 0.6);
        gX[g] += (gX[gBall] - gX[g]) * k; gZ[g] += (gZ[gBall] - gZ[g]) * k;
        continue;
      }
      if (kind !== K_SCHOOL && kind !== K_MEADOW) continue;
      const hold = (g === gDesc && DS.hold) || (g === gBot && BS.hold), feeding = g === FEED.school && FEED.k > 0.05, rise = g === RZ.grp && RZ.on && !feeding;
      let hv = 1, vFull = false;
      if (hold && g === gDesc) {
        const up = DVR.y - gY[g];
        if (fDv && !DVR.esc && !DS.far && (DVR.x - gX[g]) ** 2 + (DVR.z - gZ[g]) ** 2 < 64 && up < 9 && up > -1) {
          DVR.esc = true; DVR.tE = t; curious(g);
        }
        if (DVR.esc && fDv && !DVR.stop && t - DVR.tE < 6 && up > -7) {
          const bx = DVR.x - fLx, bz = DVR.z - fLz, bl = Math.sqrt(bx * bx + bz * bz);
          if (bl > 0.3) { DVR.bx = bx / bl; DVR.bz = bz / bl; }
          gTX[g] = DVR.x + DVR.bx * 1.5; gTZ[g] = DVR.z + DVR.bz * 1.5; gTY[g] = Math.min(DS.spot[1], DVR.y + 1.2);
          hv = 1.4; vFull = gTY[g] < DS.spot[1];
        } else if (DVR.esc) {
          if (!DVR.stop) { DVR.stop = true; DVR.sx = gX[g]; DVR.sy = gY[g]; DVR.sz = gZ[g]; }
          const an = t * 0.2;
          gTX[g] = DVR.sx + Math.cos(an) * 2.5; gTY[g] = DVR.sy; gTZ[g] = DVR.sz + Math.sin(an) * 2.5;
        } else {
          const an = t * 0.26;
          gTX[g] = DS.spot[0] + Math.cos(an) * 3.2; gTY[g] = DS.spot[1] + 0.5 * Math.sin(t * 0.13); gTZ[g] = DS.spot[2] + Math.sin(an) * 3.2;
        }
        gTimer[g] = 40;
      } else if (hold) {
        if (fDv && DVR.y - floorAt(DVR.x, DVR.z) < 14 && (DVR.x - BS.spot[0]) ** 2 + (DVR.z - BS.spot[2]) ** 2 < 144) BS.near = true;
        if (BS.near && fDv) {
          const bx = DVR.x - fLx, bz = DVR.z - fLz, bl = Math.sqrt(bx * bx + bz * bz);
          if (bl > 0.3 && fLy - DVR.y < 0.7 * bl) { BS.bx = bx / bl; BS.bz = bz / bl; }
          BS.px = DS.b[0] + BS.bx * 4.2; BS.pz = DS.b[2] + BS.bz * 4.2;
        }
        BS.room = fDv && DVR.y - floorAt(DVR.x, DVR.z) < 4.6;
        const an = t * 0.18 + 1.1, cx = BS.near ? BS.px : BS.spot[0], cz = BS.near ? BS.pz : BS.spot[2], r = BS.near ? 1.2 : 2.6;
        gTX[g] = cx + Math.cos(an) * r; gTZ[g] = cz + Math.sin(an) * r;
        gTY[g] = floorAt(gTX[g], gTZ[g]) + (BS.near ? 1.5 : 2.2) + 0.3 * Math.sin(t * 0.11);
        gTimer[g] = 40;
        hv = BS.near ? 1.6 : 1;
      } else if (feeding) {
        gTX[g] = FEED.sX; gTY[g] = FEED.sY; gTZ[g] = FEED.sZ;
        gTimer[g] = 40;
      } else if (rise) {
        gTX[g] = RZ.tgt[0]; gTY[g] = RZ.tgt[1]; gTZ[g] = RZ.tgt[2];
        gTimer[g] = 40;
      } else if (g === gRes) {
        const an = t * 0.045 + 1.3;
        gTX[g] = RES[0] + Math.cos(an) * 2.4; gTZ[g] = RES[2] + Math.sin(an) * 1.7;
        gTY[g] = floorAt(gTX[g], gTZ[g]) + 1.3 + 0.35 * Math.sin(t * 0.11);
        gTimer[g] = 40;
      }
      let dx = gTX[g] - gX[g], dy = gTY[g] - gY[g], dz = gTZ[g] - gZ[g];
      let d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      gTimer[g] -= dt;
      if (!hold && !feeding && !rise && g !== gRes && (d < (kind === K_SCHOOL ? 3 : 2) || gTimer[g] < 0)) {
        pickGroupTarget(g);
        dx = gTX[g] - gX[g]; dy = gTY[g] - gY[g]; dz = gTZ[g] - gZ[g];
        d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      }
      const inv = 1 / (d + 1e-5), v = rise ? 1.1 * Math.min(1, d / 2 + 0.3) : (feeding ? 1.1 : gReef[g] === -2 ? 0.55 : gReef[g] === -3 ? 0.4 : kind === K_SCHOOL ? 1.0 : 0.45) * spd * (hold ? hv * Math.min(1, d / 1.5 + 0.4) : feeding ? Math.min(1, d / 2 + 0.3) : 1);
      const mw = Math.sin(t * 0.21 + g * 1.7) * 0.35 * v;
      let ex = dx * inv * v - dz * inv * mw, ey = dy * inv * v * (vFull ? 1 : 0.5), ez = dz * inv * v + dx * inv * mw;
      for (let k = 0; k < NO; k++) {
        const ox = gX[g] - oX[k], oy = gY[g] - oY[k], oz = gZ[g] - oZ[k], R = oR[k] + 2.5;
        const d2 = ox * ox + oy * oy + oz * oz;
        if (d2 < R * R) {
          const od = Math.sqrt(d2) + 1e-5, f = ((R - od) / R) * 2.0;
          ex += (ox / od) * f; ey += (oy / od) * f; ez += (oz / od) * f;
        }
      }
      const kk = Math.min(1, dt * 0.6);
      gVX[g] += (ex - gVX[g]) * kk; gVY[g] += (ey - gVY[g]) * kk; gVZ[g] += (ez - gVZ[g]) * kk;
      gX[g] += gVX[g] * dt; gY[g] += gVY[g] * dt; gZ[g] += gVZ[g] * dt;
      const fy = floorAt(gX[g], gZ[g]) + (kind === K_SCHOOL ? 1.2 : 0.6);
      if (gY[g] < fy) { gY[g] = fy; if (gVY[g] < 0) gVY[g] = 0; }
      if (gY[g] > -2.5) gY[g] = -2.5;
    }
  }

  function buildHash() {
    cellCur.fill(0);
    for (let i = 0; i < N; i++) {
      const h = (Math.imul(Math.floor(pX[i] * INV_CELL), 73856093) ^ Math.imul(Math.floor(pY[i] * INV_CELL), 19349663) ^
        Math.imul(Math.floor(pZ[i] * INV_CELL), 83492791)) & HMASK;
      fishCell[i] = h;
      cellCur[h]++;
    }
    let acc = 0;
    for (let h = 0; h < HSIZE; h++) { cellStart[h] = acc; acc += cellCur[h]; cellCur[h] = cellStart[h]; }
    cellStart[HSIZE] = acc;
    for (let i = 0; i < N; i++) sorted[cellCur[fishCell[i]]++] = i;
  }

  function pickWrasseTarget(i, plx, ply, plz, d2p) {
    const c = cand[i];
    pA[i] = 0;
    if (fdr[i] === 1 && FEED.active) {
      const a = FEED.far + rr(-2.1, 2.1), r = rr(0.2, 0.6);
      let x = FEED.x + Math.cos(a) * r, z = FEED.z + Math.sin(a) * r;
      if (onFeedLine(x, z)) { x = FEED.x - Math.cos(a) * r; z = FEED.z - Math.sin(a) * r; }
      P3[0] = x; P3[2] = z; P3[1] = pickFloor(x, z) + (rand$1() < 0.75 ? 0.14 : rr(0.3, 0.8));
      pushOut(P3, 0.25);
      const f = pickFloor(P3[0], P3[2]);
      tgX[i] = P3[0]; tgY[i] = Math.max(P3[1], f + 0.13); tgZ[i] = P3[2];
      pA[i] = tgY[i] - f < 0.25 ? 1 : 0;
      const dx = tgX[i] - pX[i], dy = tgY[i] - pY[i], dz = tgZ[i] - pZ[i];
      pB[i] = Math.sqrt(dx * dx + dy * dy + dz * dz) + 1e-3;
      return;
    }
    if (d2p > 4 && rand$1() < 0.5) {
      const a = rand$1() * TAU$3, r = rr(0.5, 2.2);
      let x = pX[i] + Math.cos(a) * r, z = pZ[i] + Math.sin(a) * r;
      const hx = x - hmX[i], hz = z - hmZ[i], hd = Math.sqrt(hx * hx + hz * hz);
      if (hd > 6) { x = hmX[i] + (hx / hd) * 6 * rand$1(); z = hmZ[i] + (hz / hd) * 6 * rand$1(); }
      P3[0] = x; P3[2] = z; P3[1] = pickFloor(x, z) + 0.15;
      pushOut(P3, 0.3);
      tgX[i] = P3[0]; tgY[i] = Math.max(P3[1], pickFloor(P3[0], P3[2]) + 0.13); tgZ[i] = P3[2];
      pA[i] = 1;
      const dx = tgX[i] - pX[i], dy = tgY[i] - pY[i], dz = tgZ[i] - pZ[i];
      pB[i] = Math.sqrt(dx * dx + dy * dy + dz * dz) + 1e-3;
      return;
    }
    if (d2p < 64 && rand$1() < 0.3) {
      const dx = pX[i] - plx, dz = pZ[i] - plz, d = Math.sqrt(dx * dx + dz * dz) || 1;
      P3[0] = plx + (dx / d) * 1.6 + rr(-0.4, 0.4); P3[2] = plz + (dz / d) * 1.6 + rr(-0.4, 0.4);
      const f = floorAt(P3[0], P3[2]);
      P3[1] = clamp$4(ply + rr(-0.5, 0.3), f + 0.3, f + 2.5);
    } else if (c && c.length && rand$1() < 0.45) {
      const q = RP[c[Math.floor(rand$1() * c.length)]];
      P3[0] = q[0] + q[3] * 0.3; P3[1] = q[1] + q[4] * 0.3; P3[2] = q[2] + q[5] * 0.3;
    } else {
      const a = rand$1() * TAU$3, r = rr(1.5, 4.5);
      let x = pX[i] + Math.cos(a) * r, z = pZ[i] + Math.sin(a) * r;
      const hx = x - hmX[i], hz = z - hmZ[i], hd = Math.sqrt(hx * hx + hz * hz);
      if (hd > 7) { x = hmX[i] + (hx / hd) * 7 * rand$1(); z = hmZ[i] + (hz / hd) * 7 * rand$1(); }
      P3[0] = x; P3[2] = z; P3[1] = floorAt(x, z) + rr(0.3, 1.5);
    }
    pushOut(P3, 0.35);
    tgX[i] = P3[0]; tgY[i] = Math.max(P3[1], floorAt(P3[0], P3[2]) + 0.3); tgZ[i] = P3[2];
    const dx = tgX[i] - pX[i], dy = tgY[i] - pY[i], dz = tgZ[i] - pZ[i];
    pB[i] = Math.sqrt(dx * dx + dy * dy + dz * dz) + 1e-3;
  }

  function restFish(i, S, dt, t, d2p, plx, plz) {
    const L = scl[i];
    let x = pX[i], y = pY[i], z = pZ[i];
    if (st[i] === 0) {
      tB[i] -= dt;
      if (d2p < 1.0 && tB[i] <= 0) {
        let best = -1, bestS = -1e9;
        for (let k = 0; k < RP.length; k++) {
          const q = RP[k];
          if (q[6] !== 1 || q[4] < 0.7) continue;
          const dx = q[0] - x, dz = q[2] - z, d2 = dx * dx + dz * dz;
          if (d2 < 0.36 || d2 > 2.56) continue;
          const score = Math.sqrt((q[0] - plx) * (q[0] - plx) + (q[2] - plz) * (q[2] - plz)) - Math.abs(Math.sqrt(d2) - 1.1) * 4;
          if (score > bestS) { bestS = score; best = k; }
        }
        const lift = 0.14 * L;
        if (best >= 0) {
          const q = RP[best];
          tgX[i] = q[0] + q[3] * lift; tgY[i] = q[1] + q[4] * lift; tgZ[i] = q[2] + q[5] * lift;
          tnX[i] = q[3]; tnY[i] = q[4]; tnZ[i] = q[5];
        } else {
          let ax = x - plx, az = z - plz;
          const al = Math.sqrt(ax * ax + az * az) || 1;
          tgX[i] = x + (ax / al) * 1.1; tgZ[i] = z + (az / al) * 1.1;
          tgY[i] = Math.max(floorAt(tgX[i], tgZ[i]), y - lift - 0.3) + lift;
          tnX[i] = 0; tnY[i] = 1; tnZ[i] = 0;
        }
        st[i] = 1; tA[i] = 0;
      }
    }
    let beat = 0;
    if (st[i] === 1) {
      tA[i] += dt;
      const dx = tgX[i] - x, dy = tgY[i] - y, dz = tgZ[i] - z, d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const sp = Math.min(1.8, d * 5 + 0.3);
      if (d > 0.02) {
        x += (dx / d) * sp * dt; z += (dz / d) * sp * dt;
        y += (dy / d) * sp * dt + 0.35 * Math.cos(Math.min(1, tA[i] / 0.7) * Math.PI) * dt;
        const hx = dx / d, hz = dz / d, k = Math.min(1, dt * 8);
        hX[i] += (hx - hX[i]) * k; hZ[i] += (hz - hZ[i]) * k;
        beat = 1;
      }
      if (d < 0.03 || tA[i] > 1.6) { x = tgX[i]; y = tgY[i]; z = tgZ[i]; st[i] = 0; tB[i] = 3; }
    }
    const ku = Math.min(1, dt * (st[i] === 1 ? 6 : 2));
    let ux = hmX[i] + (tnX[i] - hmX[i]) * ku, uy = hmY[i] + (tnY[i] - hmY[i]) * ku, uz = hmZ[i] + (tnZ[i] - hmZ[i]) * ku;
    let ul = Math.sqrt(ux * ux + uy * uy + uz * uz) || 1;
    ux /= ul; uy /= ul; uz /= ul;
    hmX[i] = ux; hmY[i] = uy; hmZ[i] = uz;
    let lx = uy * hZ[i] - uz * hY[i], ly = uz * hX[i] - ux * hZ[i], lz = ux * hY[i] - uy * hX[i];
    ul = Math.sqrt(lx * lx + ly * ly + lz * lz);
    if (ul < 1e-4) { lx = 1; ly = 0; lz = 0; ul = 1; }
    lx /= ul; ly /= ul; lz /= ul;
    const fx = ly * uz - lz * uy, fy = lz * ux - lx * uz, fz = lx * uy - ly * ux;
    hX[i] = fx; hY[i] = fy; hZ[i] = fz;
    pX[i] = x; pY[i] = y; pZ[i] = z;
    const m = S.mat, o = (i - S.start) << 4;
    m[o] = lx * L; m[o + 1] = ly * L; m[o + 2] = lz * L; m[o + 3] = 0;
    m[o + 4] = ux * L; m[o + 5] = uy * L; m[o + 6] = uz * L; m[o + 7] = 0;
    m[o + 8] = fx * L; m[o + 9] = fy * L; m[o + 10] = fz * L; m[o + 11] = 0;
    m[o + 12] = x; m[o + 13] = y; m[o + 14] = z; m[o + 15] = 1;
    let tp = tail[i] + TAU$3 * (0.35 + 7 * beat) * dt;
    if (tp > TAU$3) tp -= TAU$3;
    tail[i] = tp;
    const kA = Math.min(1, dt * 6);
    amp[i] += ((beat ? 0.11 : 0.004) - amp[i]) * kA;
    hov[i] += ((beat ? 0 : 0.25) - hov[i]) * kA;
    const w = S.swim, wo = (i - S.start) << 2;
    w[wo] = tp; w[wo + 1] = amp[i]; w[wo + 2] = 0; w[wo + 3] = hov[i];
  }

  let fDt = 1 / 60, fT = 0, fSpd = 1, fPlx = 1e5, fPly = 1e5, fPlz = 1e5, fPvl = 0, fPnx = 0, fPny = 0, fPnz = 0;
  let fLx = 1e5, fLy = 1e5, fLz = 1e5, fDv = 0;
  let fLpx = 1e5, fLpy = 1e5, fLpz = 1e5, fLvx = 0, fLvy = 0, fLvz = 0;
  let fKHead = 0, fKBank = 0, fKAmp = 0, fKBc = 0, fAlmDecay = 1, fWander = 1;
  const GO = new Float64Array(12);

  function update(dt, time, player) {
    if (!(dt > 0)) return;
    if (dt > 0.05) dt = 0.05;
    simTime = Number.isFinite(time) ? time : simTime + dt;
    const t = simTime;
    U$1.time.value = t;
    frame++;
    stepRise(player);
    if (RZ.on && calmTarget > 0.2) calmTarget = 0.2;
    calm += (calmTarget - calm) * (1 - Math.exp(-dt * 1.2));
    fDt = dt; fT = t; fSpd = 1 - 0.6 * calm;
    fPlx = 1e5; fPly = 1e5; fPlz = 1e5;
    let pvx = 0, pvy = 0, pvz = 0;
    const pp = player && player.position, pv = player && player.velocity;
    if (pp && Number.isFinite(pp.x) && Number.isFinite(pp.y) && Number.isFinite(pp.z)) { fPlx = pp.x; fPly = pp.y; fPlz = pp.z; }
    if (pv && Number.isFinite(pv.x) && Number.isFinite(pv.y) && Number.isFinite(pv.z)) { pvx = pv.x; pvy = pv.y; pvz = pv.z; }
    fLx = fPlx; fLy = fPly; fLz = fPlz;
    {
      const jx = fLx - fLpx, jy = fLy - fLpy, jz = fLz - fLpz, k = 1 - Math.exp(-dt / 0.1);
      if (fLx < 1e4 && fLpx < 1e4 && jx * jx + jy * jy + jz * jz < 1) { fLvx += (jx / dt - fLvx) * k; fLvy += (jy / dt - fLvy) * k; fLvz += (jz / dt - fLvz) * k; }
      else { fLvx = 0; fLvy = 0; fLvz = 0; }
      fLpx = fLx; fLpy = fLy; fLpz = fLz;
    }
    fDv = DVR.on && t - DVR.t < 0.25 ? 1 : 0;
    if (fDv) { fPlx = DVR.x; fPly = DVR.y; fPlz = DVR.z; pvx = DVR.vx; pvy = DVR.vy; pvz = DVR.vz; }
    fPvl = Math.sqrt(pvx * pvx + pvy * pvy + pvz * pvz);
    fPnx = fPvl > 0.3 ? pvx / fPvl : 0; fPny = fPvl > 0.3 ? pvy / fPvl : 0; fPnz = fPvl > 0.3 ? pvz / fPvl : 0;
    if (fLx < 1e4) U$1.scene.value.x = floorAt(fLx, fLz);
    for (let s = 0; s < SP.length; s++) {
      const S = SP[s];
      S.cosTurn = Math.cos(S.turn * dt); S.sinTurn = Math.sin(S.turn * dt);
      S.cosHead = Math.cos(S.head * dt); S.sinHead = Math.sin(S.head * dt);
    }
    fKHead = 1 - Math.exp(-dt * 10); fKBank = 1 - Math.exp(-dt * 3); fKAmp = 1 - Math.exp(-dt * 4);
    fKBc = 1 - Math.exp(-dt * 6); fAlmDecay = Math.exp(-dt * 1.3); fWander = 1 + 1.5 * calm;
    if (!FEED.on && fPlx < 1e4 && FRAGS) {
      for (let k = 0; k < FRAGS.length; k++) {
        const f = FRAGS[k];
        if (fDone[k] || (fPlx - f.x) * (fPlx - f.x) + (fPlz - f.z) * (fPlz - f.z) > 100 || fPly - floorAt(f.x, f.z) > 5) continue;
        if (FEED.active && (FEED.x - f.x) * (FEED.x - f.x) + (FEED.z - f.z) * (FEED.z - f.z) > 9) releaseFeeders();
        FEED.x = f.x; FEED.z = f.z; FEED.y = floorAt(f.x, f.z);
        FEED.hold = Math.max(FEED.hold, 6);
        if (!FEED.active) takeFeeders();
        break;
      }
    }
    if (FEED.active) {
      if (fPlx < 1e4) {
        const qx = fPlx - FEED.x, qz = fPlz - FEED.z;
        if (qx * qx + qz * qz > 0.09) {
          FEED.far = Math.atan2(-qz, -qx);
          const dA = Math.atan2(Math.sin(FEED.far - FEED.farUsed), Math.cos(FEED.far - FEED.farUsed));
          if (FEED.on && (dA > 0.7 || dA < -0.7)) rehome();
        }
      }
      if (!FEED.on) FEED.hold -= dt;
      const want = FEED.on || FEED.hold > 0 ? 1 : 0;
      FEED.k += (want - FEED.k) * (1 - Math.exp(-dt * (want ? 0.9 : 0.45)));
      if (!want && FEED.k < 0.03) releaseFeeders();
    }
    updateGroups(dt, t, fSpd, fPlx, fPly, fPlz);
    if (DS.hold) {
      if (DVR.esc) {
        if (!fDv) DS.below += dt;
        if (DS.below > 10) { DS.hold = false; pickGroupTarget(gDesc); }
      } else {
        if (fPly < DS.spot[1] - 5) DS.below += dt; else DS.below = 0;
        if (DS.below > 9) { DS.hold = false; pickGroupTarget(gDesc); }
      }
    }
    if (BS.hold && BS.near && !fDv) { BS.down += dt; if (BS.down > 14) { BS.hold = false; pickGroupTarget(gBot); } }
    if (D.active && fLx < 1e4) {
      const dx = fLx - D.lf[0], dy = fLy - D.lf[1], dz = fLz - D.lf[2];
      if (dx * dx + dy * dy + dz * dz < 1) {
        const kv = 1 - Math.exp(-dt * 3);
        D.off[0] += dx; D.off[1] += dy; D.off[2] += dz;
        D.vel[0] += (dx / dt - D.vel[0]) * kv; D.vel[1] += (dy / dt - D.vel[1]) * kv; D.vel[2] += (dz / dt - D.vel[2]) * kv;
      }
      D.lf[0] = fLx; D.lf[1] = fLy; D.lf[2] = fLz;
    }
    stepEntry(dt);
    buildHash();
    for (let i = 0; i < N; i++) stepFish(i);
    for (let s = 0; s < SP.length; s++) {
      const S = SP[s], i0 = S.start, i1 = S.start + S.count;
      if (i1 <= i0) continue;
      let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
      for (let i = i0; i < i1; i++) {
        const x = pX[i], y = pY[i], z = pZ[i];
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; if (z < z0) z0 = z; if (z > z1) z1 = z;
      }
      const cx = (x0 + x1) * 0.5, cy = (y0 + y1) * 0.5, cz = (z0 + z1) * 0.5;
      let r2 = 0;
      for (let i = i0; i < i1; i++) { const dx = pX[i] - cx, dy = pY[i] - cy, dz = pZ[i] - cz, d2 = dx * dx + dy * dy + dz * dz; if (d2 > r2) r2 = d2; }
      const bs = S.mesh.boundingSphere || (S.mesh.boundingSphere = new THREE.Sphere());
      bs.center.set(cx, cy, cz);
      bs.radius = Math.sqrt(r2) + 1.2 * S.lenMax;
    }
    for (let g = 0; g < G; g++) {
      if (gKind[g] === K_CLOUD) { gAlarm[g] = gHide[g] / Math.max(1, gCount[g]); gHide[g] = 0; }
    }
    for (let s = 0; s < SP.length; s++) { SP[s].mesh.instanceMatrix.needsUpdate = true; SP[s].swimAttr.needsUpdate = true; }
    updateJellies(dt, t);
    updateDolphins(dt, t);
  }

  function stepFish(i) {
    const S = SP[spc[i]], kind = S.kind;
    const x = pX[i], y = pY[i], z = pZ[i];
    const qx = x - fPlx, qy = y - fPly, qz = z - fPlz, d2p = qx * qx + qy * qy + qz * qz;
    if (kind === K_REST) { restFish(i, S, fDt, fT, d2p, fPlx, fPlz); return; }
    if (y - fl[i] < 3 || ((frame + i) & 3) === 0) fl[i] = floorAt(x, z);
    const bold = (fdr[i] !== 0 && FEED.k > 0.3) || cuS[i] === 2;
    let al = alm[i] * fAlmDecay;
    const sR = ent[i] ? 0 : S.startle * (fDv && (grp[i] === gDesc || (grp[i] === gBot && !BS.room)) ? 0.6 : 1);
    if (!bold && S.startle > 0 && d2p < sR * sR) {
      const a = 1 - (Math.sqrt(d2p) / sR) * 0.6;
      if (a > al) al = a;
    }
    if (S.nbrR > 0 && ((i + frame) & 1) === 0) al = neighbours(i, S, x, y, z, al);
    if (bold && al > 0.1) al = 0.1;
    if (ent[i] && (enS[i] >= 2 || ent[i] === ENT_RISE) && al > 0.05) al = 0.05;
    alm[i] = al;
    if (TH.on) giveWay(i, S, x, y, z);
    if (DP.on && dolMesh.visible) dolWay(i, S, x, y, z);
    goal(i, S, kind, d2p, qx, qy, qz, al);
    move(i, S, d2p, qx, qy, qz, al);
    orient(i, S, kind, al);
  }

  function giveWay(i, S, x, y, z) {
    if (S.kind === K_REST || S.kind === K_GRAZE) return;
    const dx = x - TH.x, dy = y - TH.y, dz = z - TH.z, d2 = dx * dx + dy * dy + dz * dz, R = TH.r;
    if (d2 > R * R) return;
    const d = Math.sqrt(d2) + 1e-4, w = 1 - d / R, k = (S.fleeW || 4) * 0.6 * w * (0.5 + w) * fDt;
    vX[i] += (dx / d) * k; vY[i] += (dy / d) * k * 0.4; vZ[i] += (dz / d) * k;
  }

  function neighbours(i, S, x, y, z, al) {
    const R = S.nbrR, R2 = R * R, sepR = S.sepR, sep2 = sepR * sepR, me = flk[i], maxN = S.maxN;
    const vx0 = vX[i], vy0 = vY[i], vz0 = vZ[i];
    let sx = 0, sy = 0, sz = 0, alx = 0, aly = 0, alz = 0, chx = 0, chy = 0, chz = 0, cnt = 0, ma = 0;
    const x0 = Math.floor((x - R) * INV_CELL), x1 = Math.floor((x + R) * INV_CELL);
    const y0 = Math.floor((y - R) * INV_CELL), y1 = Math.floor((y + R) * INV_CELL);
    const z0 = Math.floor((z - R) * INV_CELL), z1 = Math.floor((z + R) * INV_CELL);
    scan: for (let cx = x0; cx <= x1; cx++) {
      for (let cy = y0; cy <= y1; cy++) {
        for (let cz = z0; cz <= z1; cz++) {
          const h = (Math.imul(cx, 73856093) ^ Math.imul(cy, 19349663) ^ Math.imul(cz, 83492791)) & HMASK;
          const end = cellStart[h + 1];
          for (let k = cellStart[h]; k < end; k++) {
            const j = sorted[k];
            if (j === i) continue;
            const dx = pX[j] - x, dy = pY[j] - y, dz = pZ[j] - z, d2 = dx * dx + dy * dy + dz * dz;
            if (d2 > R2) continue;
            if (d2 < sep2 && d2 > 1e-10) {
              const d = Math.sqrt(d2), f = (sepR / d - 1) / d;
              sx -= dx * f; sy -= dy * f; sz -= dz * f;
            }
            if (flk[j] === me) {
              alx += vX[j]; aly += vY[j]; alz += vZ[j]; chx += dx; chy += dy; chz += dz;
              if (alm[j] > ma) ma = alm[j];
              if (++cnt >= maxN) break scan;
            }
          }
        }
      }
    }
    if (S.startle > 0 && ma > 0.15 && ma * 0.8 > al) al = ma * 0.8;
    let nx = sx * S.wSep, ny = sy * S.wSep, nz = sz * S.wSep;
    if (cnt > 0) {
      const ic = 1 / cnt;
      nx += (alx * ic - vx0) * S.wAli + chx * ic * S.wCoh;
      ny += (aly * ic - vy0) * S.wAli + chy * ic * S.wCoh;
      nz += (alz * ic - vz0) * S.wAli + chz * ic * S.wCoh;
    }
    nbX[i] = nx; nbY[i] = ny; nbZ[i] = nz;
    return al;
  }

  function goal(i, S, kind, d2p, qx, qy, qz, al) {
    GO[0] = vX[i]; GO[1] = vY[i]; GO[2] = vZ[i]; GO[3] = S.wGoal; GO[4] = 0; GO[5] = 0; GO[6] = 0; GO[7] = 0; GO[10] = 1; GO[11] = 1;
    GO[8] = S.vMax * fSpd;
    if (ent[i]) goalEntry(i, S);
    else if (kind === K_VORTEX || kind === K_BALL) goalMill(i, S, kind);
    else if (kind === K_SCHOOL) goalSchool(i);
    else if (kind === K_MEADOW) goalMeadow(i, S, d2p);
    else if (kind === K_CLOUD) goalCloud(i, S, d2p);
    else if (kind === K_HOVER) goalHover(i, S);
    else if (kind === K_DART) goalDart(i, S, d2p);
    else if (kind === K_GRAZE) goalGraze(i, S, d2p);
    else goalGrouper(i, S, d2p, qx, qy, qz);
    if (RZ.on && (i === RZ.g[0] || i === RZ.g[1])) {
      const k = i === RZ.g[0] ? 0 : 3;
      const dx = RZ.gt[k] - pX[i], dy = RZ.gt[k + 1] - pY[i], dz = RZ.gt[k + 2] - pZ[i];
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz) + 1e-4, v = S.cruise * 0.8 * Math.min(1, d / 2 + 0.25);
      GO[0] = (dx / d) * v; GO[1] = (dy / d) * v * 0.5; GO[2] = (dz / d) * v; GO[4] = 0; GO[8] = S.vMax;
    }
    if (S.bcOn) {
      bcT[i] -= fDt;
      if (bcT[i] <= 0) { st[i] ^= 1; bcT[i] = st[i] ? rr(S.bc0, S.bc1) : rr(S.bc2, S.bc3); }
      bcf[i] += ((st[i] === 1 || al > 0.2 ? 1 : 0) - bcf[i]) * fKBc;
      const sf = 0.82 + 0.4 * bcf[i];
      GO[0] *= sf; GO[1] *= sf; GO[2] *= sf;
    }
  }

  function goalMill(i, S, kind) {
    const g = grp[i], x = pX[i], y = pY[i], z = pZ[i], cr = S.cruise * fSpd * cruiseF[i];
    let rx = x - gX[g], rz = z - gZ[g];
    const r = Math.sqrt(rx * rx + rz * rz);
    if (r < 0.05) { rx = 1; rz = 0; } else { rx /= r; rz /= r; }
    if (kind === K_VORTEX) {
      const er = clamp$4((pA[i] - r) * 0.45, -0.7, 0.7);
      const hy = pB[i] + 1.2 * Math.sin(fT * 0.11 + nPh[i]);
      GO[0] = -rz * cr + rx * er; GO[2] = rx * cr + rz * er; GO[1] = clamp$4((hy - y) * 0.35, -0.35, 0.35);
    } else {
      const th = Math.atan2(rz, rx);
      const lobe = 1 + 0.26 * Math.cos(2 * th - fT * 0.21) + 0.1 * Math.sin(3 * th + fT * 0.13 + 1.3) + 0.06 * Math.sin(fT * 0.31);
      let rib = 0;
      if (tB[i] > 0) { const w = Math.max(0, Math.sin(th - fT * 0.16 + tA[i])); rib = tB[i] * w * w * w * 1.7; }
      const er = clamp$4((pA[i] * lobe * (1 + rib) - r) * 1.2, -1.2, 1.2);
      const hy = gY[g] + pB[i] * (1 - 0.35 * rib) + 0.5 * (r / 2.7) * Math.sin(th - fT * 0.09) + 0.25 * Math.sin(fT * 0.4 + nPh[i]);
      const cm = cr * (0.55 + 0.45 * Math.min(1, r / 1.2));
      GO[0] = rz * cm + rx * er; GO[2] = -rx * cm + rz * er; GO[1] = clamp$4((hy - y) * 0.8, -0.6, 0.6);
    }
  }

  function goalSchool(i) {
    const g = grp[i], br = 0.8 + 0.2 * Math.sin(fT * 0.27 + nPh[i]);
    GO[0] = gVX[g] + (gX[g] + hmX[i] * br - pX[i]) * 0.45;
    GO[1] = gVY[g] + (gY[g] + hmY[i] * br - pY[i]) * 0.45;
    GO[2] = gVZ[g] + (gZ[g] + hmZ[i] * br - pZ[i]) * 0.45;
    if (cuS[i]) goalCurious(i);
    if (gReef[g] > -2) return;
    tA[i] -= fDt;
    if (pA[i] > 0.5) {
      GO[0] = gVX[g] * 0.25 + hX[i] * 0.1; GO[2] = gVZ[g] * 0.25 + hZ[i] * 0.1;
      GO[1] = (fl[i] + 0.3 - pY[i]) * 1.6;
      GO[4] = 0.85; GO[5] = hX[i]; GO[6] = -1.1; GO[7] = hZ[i];
      GO[10] = 0;
      if (tA[i] <= 0) { pA[i] = 0; tA[i] = rr(7, 18); }
    } else if (tA[i] <= 0) {
      if (calm < 0.5 && pY[i] - fl[i] < 3.2 && alm[i] < 0.1) { pA[i] = 1; tA[i] = rr(1.0, 2.4); } else tA[i] = rr(3, 8);
    }
  }

  function goalCurious(i) {
    if (!fDv || cuS[i] === 3) { if (!fDv) cuS[i] = 0; return; }
    cuT[i] -= fDt;
    if (cuS[i] === 1) { if (cuT[i] <= 0) { cuS[i] = 2; cuT[i] = rr(1.6, 2.6); } return; }
    const dx = fPlx - pX[i], dy = fPly - pY[i], dz = fPlz - pZ[i], d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (cuT[i] <= 0 || d > 6) { cuS[i] = 3; return; }
    cuA[i] += fDt * 0.5;
    const tx = fPlx + Math.cos(cuA[i]) * 1.1, ty = fPly + 0.3, tz = fPlz + Math.sin(cuA[i]) * 1.1;
    GO[0] = DVR.vx + (tx - pX[i]) * 1.4; GO[1] = clamp$4(DVR.vy + (ty - pY[i]) * 1.4, -1.2, 1.2); GO[2] = DVR.vz + (tz - pZ[i]) * 1.4;
    GO[3] = 2.2;
    GO[4] = 0.5 * clamp$4(1.8 - d, 0, 1); GO[5] = dx; GO[6] = dy * 0.3; GO[7] = dz;
  }

  function goalMeadow(i, S, d2p) {
    const g = grp[i];
    tA[i] -= fDt;
    if (st[i] === 1) {
      GO[0] = hX[i] * 0.08; GO[2] = hZ[i] * 0.08; GO[1] = (fl[i] + 0.22 - pY[i]) * 1.4;
      GO[4] = 1; GO[5] = hX[i]; GO[6] = -1.6; GO[7] = hZ[i];
      if (tA[i] <= 0) { st[i] = 0; tA[i] = rr(5, 13); }
    } else {
      GO[0] = gVX[g] + (gX[g] + hmX[i] - pX[i]) * 0.3;
      GO[2] = gVZ[g] + (gZ[g] + hmZ[i] - pZ[i]) * 0.3;
      GO[1] = (fl[i] + hmY[i] - pY[i]) * 0.7;
      if (tA[i] <= 0) {
        if (calm < 0.5 && d2p > 36) { st[i] = 1; tA[i] = rr(1.2, 2.6); } else tA[i] = rr(2, 5);
      }
    }
  }

  function goalCloud(i, S, d2p) {
    const g = grp[i], x = pX[i], y = pY[i], z = pZ[i], bold = fdr[i] === 1 && FEED.k > 0.3;
    if (!bold && (d2p < 6.25 || (st[i] === 0 && gAlarm[g] > 0.2 && d2p < 20.25))) { st[i] = 1; tA[i] = 1.4; }
    else if (st[i] === 1 && (bold || d2p > 16)) { tA[i] -= fDt; if (tA[i] <= 0 || bold) st[i] = 0; }
    if (st[i] === 1) {
      const hx = gX[g] + (hmX[i] - gX[g]) * 0.35, hz = gZ[g] + (hmZ[i] - gZ[g]) * 0.35;
      const hy = gY[g] + 0.15 + 0.1 * (hmY[i] - gY[g]);
      let dvx = (hx - x) * 3, dvy = (hy - y) * 3, dvz = (hz - z) * 3;
      const l = Math.sqrt(dvx * dvx + dvy * dvy + dvz * dvz);
      if (l > 1.6) { const k = 1.6 / l; dvx *= k; dvy *= k; dvz *= k; }
      GO[0] = dvx; GO[1] = dvy; GO[2] = dvz; GO[3] = 3.5; GO[8] = S.vMax;
      gHide[g] += 1;
    } else {
      let dvx = (hmX[i] - x) * 0.9, dvy = (hmY[i] - y) * 0.9, dvz = (hmZ[i] - z) * 0.9;
      const l = Math.sqrt(dvx * dvx + dvy * dvy + dvz * dvz), cap = 0.35 * fSpd * (fdr[i] === 1 && l > 0.9 ? 5 : 1);
      if (l > cap) { const k = cap / l; dvx *= k; dvy *= k; dvz *= k; }
      tB[i] -= fDt;
      if (tB[i] < -0.3) { tB[i] = rr(0.8, 3.5) * (1 + 2 * calm); pA[i] = rand$1() * TAU$3; pB[i] = rr(-0.25, 0.25); }
      if (tB[i] < 0) { const bs = 0.75 * fSpd; dvx += Math.cos(pA[i]) * bs; dvz += Math.sin(pA[i]) * bs; dvy += pB[i]; }
      GO[0] = dvx; GO[1] = dvy; GO[2] = dvz;
      GO[4] = 1 - clamp$4(Math.sqrt(vX[i] * vX[i] + vY[i] * vY[i] + vZ[i] * vZ[i]) / S.vAlign, 0, 1);
      GO[5] = fcX[i]; GO[7] = fcZ[i];
      if (bold) GO[11] = 0.1;
    }
  }

  function goalHover(i, S) {
    const sway = 0.25 * Math.sin(fT * 0.35 + nPh[i]);
    let dvx = (hmX[i] + sway * fcZ[i] - pX[i]) * 0.7;
    let dvy = (hmY[i] + 0.15 * Math.sin(fT * 0.5 + nPh[i] * 2) - pY[i]) * 0.7;
    let dvz = (hmZ[i] - sway * fcX[i] - pZ[i]) * 0.7;
    const l = Math.sqrt(dvx * dvx + dvy * dvy + dvz * dvz), cap = 0.22 * fSpd;
    if (l > cap) { const k = cap / l; dvx *= k; dvy *= k; dvz *= k; }
    GO[0] = dvx; GO[1] = dvy; GO[2] = dvz;
    GO[4] = 1 - clamp$4(Math.sqrt(vX[i] * vX[i] + vY[i] * vY[i] + vZ[i] * vZ[i]) / S.vAlign, 0, 1);
    GO[5] = fcX[i]; GO[7] = fcZ[i];
  }

  function goalDart(i, S, d2p) {
    const x = pX[i], y = pY[i], z = pZ[i], sp0 = Math.sqrt(vX[i] * vX[i] + vY[i] * vY[i] + vZ[i] * vZ[i]);
    if (st[i] === 0) {
      let dvx = (tgX[i] - x) * 1.2, dvy = (tgY[i] - y) * 1.2, dvz = (tgZ[i] - z) * 1.2;
      const l = Math.sqrt(dvx * dvx + dvy * dvy + dvz * dvz);
      if (l > 0.3) { const k = 0.3 / l; dvx *= k; dvy *= k; dvz *= k; }
      GO[0] = dvx; GO[1] = dvy; GO[2] = dvz;
      GO[4] = 1 - clamp$4(sp0 / S.vAlign, 0, 1); GO[5] = hX[i]; GO[7] = hZ[i];
      if (pA[i] > 0.5) {
        const pk = Math.pow(Math.max(0, Math.sin(fT * 9.0 + nPh[i] * 3.0)), 6);
        GO[1] = (tgY[i] - 0.05 * pk - y) * 2.5;
        GO[4] = 0.9; GO[5] = hX[i]; GO[6] = -1.4; GO[7] = hZ[i];
        GO[10] = 0;
      }
      bcf[i] += (0.3 - bcf[i]) * fKBc;
      tA[i] -= fDt * (1 - 0.5 * calm);
      if (tA[i] <= 0) { pickWrasseTarget(i, fPlx, fPly, fPlz, d2p); st[i] = 1; tB[i] = rr(0.75, 1.0); }
    } else {
      const dx = tgX[i] - x, dy = tgY[i] - y, dz = tgZ[i] - z, d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const burst = d > pB[i] * 0.6;
      bcf[i] += ((burst ? 1 : 0.15) - bcf[i]) * fKBc;
      if (d < 0.25) { st[i] = 0; tA[i] = pA[i] > 0.5 ? rr(1.2, 3.5) : rr(0.5, 2.4); GO[0] = 0; GO[1] = 0; GO[2] = 0; }
      else {
        const vt = burst ? Math.min(S.vMax * fSpd * tB[i], d * 2.2 + 0.25) : Math.min(Math.max(sp0 * 0.985, 0.25), d * 2.2 + 0.25);
        GO[0] = (dx / d) * vt; GO[1] = (dy / d) * vt; GO[2] = (dz / d) * vt;
      }
      GO[3] = burst ? 2.2 : 1.2;
      if (pA[i] > 0.5 && d < 0.8) GO[10] = 0;
    }
  }

  function goalGraze(i, S, d2p) {
    const dx = tgX[i] - pX[i], dy = tgY[i] - pY[i], dz = tgZ[i] - pZ[i], d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    GO[5] = -tnX[i]; GO[6] = -tnY[i]; GO[7] = -tnZ[i];
    if (st[i] === 0) {
      const v = Math.min(S.cruise * fSpd * cruiseF[i], d * 0.9 + 0.05) / (d + 1e-5);
      GO[0] = dx * v; GO[1] = dy * v; GO[2] = dz * v;
      GO[4] = clamp$4(1 - d / 1.2, 0, 1);
      tB[i] += fDt;
      if (d < 0.12) { st[i] = 1; tA[i] = rr(2, 5.5); }
      else if (tB[i] > 12) { pickGrazeTarget(i); tB[i] = 0; }
    } else {
      const peck = 0.035 * Math.max(0, Math.sin(fT * 7.0 + nPh[i]));
      GO[0] = (dx - tnX[i] * peck) * 2.0; GO[1] = (dy - tnY[i] * peck) * 2.0; GO[2] = (dz - tnZ[i] * peck) * 2.0;
      GO[4] = 1;
      tA[i] -= fDt;
      if (tA[i] <= 0 || d2p < 4) { pickGrazeTarget(i); tB[i] = 0; }
    }
  }

  function goalGrouper(i, S, d2p, qx, qy, qz) {
    const sh = tnY[i] > 0.5;
    let hx = hmX[i], hy = hmY[i], hz = hmZ[i];
    if (sh && d2p < 25) {
      const k = clamp$4(1.3 - Math.sqrt(d2p) / 3.5, 0, 1);
      hx -= tnX[i] * 0.9 * k; hz -= tnZ[i] * 0.9 * k; hy -= 0.06 * k;
    }
    const gain = sh ? 0.9 : 0.3;
    let dvx = (hx - pX[i]) * gain, dvy = (hy - pY[i]) * 0.35, dvz = (hz - pZ[i]) * gain;
    const l = Math.sqrt(dvx * dvx + dvy * dvy + dvz * dvz), cap = (sh ? 0.45 : 0.22) * fSpd;
    if (sh) GO[10] = 0;
    if (l > cap) { const k = cap / l; dvx *= k; dvy *= k; dvz *= k; }
    if (d2p < 49) {
      const d = Math.sqrt(d2p) + 1e-6;
      GO[4] = 1; GO[5] = -qx / d; GO[6] = (-qy / d) * 0.4; GO[7] = -qz / d;
      if (!sh && d < 2.2) { const k = (2.2 - d) * 0.5; dvx += (qx / d) * k; dvy += (qy / d) * k * 0.3; dvz += (qz / d) * k; }
    } else if (sh) {
      GO[4] = 0.85; GO[5] = tnX[i]; GO[6] = 0; GO[7] = tnZ[i];
    } else {
      GO[4] = 1 - clamp$4(Math.sqrt(vX[i] * vX[i] + vY[i] * vY[i] + vZ[i] * vZ[i]) / S.vAlign, 0, 1);
      GO[5] = hX[i]; GO[7] = hZ[i];
    }
    GO[0] = dvx; GO[1] = dvy; GO[2] = dvz;
  }

  const LENS_KEEP = 0.8;
  const KO = { caps: new Float32Array(7 * 40), n: 0, cx: 0, cy: 0, cz: 0, R: 0 }, KN = new Float32Array(3);
  const KO_STEER = 0.3, KO_BODY = 0.08;
  const LENS_R = 0.6, LENS_STEER = 0.6, LENS_AHEAD = 0.5, LN = new Float32Array(7);
  function setKeepOut(caps, n) {
    let m = caps ? Math.min(n | 0, KO.caps.length / 7) : 0;
    for (let k = 0; k < m * 7; k++) KO.caps[k] = caps[k];
    if (DVR.on && simTime - DVR.t < 0.25) for (let j = 0; j < DVR.nH && m < KO.caps.length / 7; j++, m++) for (let e = 0; e < 7; e++) KO.caps[m * 7 + e] = DVR.hose[j * 7 + e];
    else if (simTime - HOSE.t < 0.25) for (let j = 0; j < HOSE.n && m < KO.caps.length / 7; j++, m++) for (let e = 0; e < 7; e++) KO.caps[m * 7 + e] = HOSE.caps[j * 7 + e];
    KO.n = m;
    if (!m) return;
    const C = KO.caps;
    let x0 = 1e9, y0 = 1e9, z0 = 1e9, x1 = -1e9, y1 = -1e9, z1 = -1e9;
    for (let k = 0; k < m * 7; k += 7) {
      const r = C[k + 6];
      x0 = Math.min(x0, C[k] - r, C[k + 3] - r); x1 = Math.max(x1, C[k] + r, C[k + 3] + r);
      y0 = Math.min(y0, C[k + 1] - r, C[k + 4] - r); y1 = Math.max(y1, C[k + 1] + r, C[k + 4] + r);
      z0 = Math.min(z0, C[k + 2] - r, C[k + 5] - r); z1 = Math.max(z1, C[k + 2] + r, C[k + 5] + r);
    }
    KO.cx = 0.5 * (x0 + x1); KO.cy = 0.5 * (y0 + y1); KO.cz = 0.5 * (z0 + z1);
    KO.R = 0.5 * Math.sqrt((x1 - x0) * (x1 - x0) + (y1 - y0) * (y1 - y0) + (z1 - z0) * (z1 - z0)) + KO_STEER + KO_BODY;
  }
  function koNear(k, x, y, z) {
    const C = KO.caps, ax = C[k], ay = C[k + 1], az = C[k + 2], bx = C[k + 3] - ax, by = C[k + 4] - ay, bz = C[k + 5] - az;
    const b2 = bx * bx + by * by + bz * bz;
    let t = b2 > 1e-8 ? ((x - ax) * bx + (y - ay) * by + (z - az) * bz) / b2 : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const dx = x - ax - bx * t, dy = y - ay - by * t, dz = z - az - bz * t, d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (d > 1e-5) { KN[0] = dx / d; KN[1] = dy / d; KN[2] = dz / d; } else { KN[0] = 0; KN[1] = 1; KN[2] = 0; }
    return d;
  }
  function koBody(k, x, y, z, hx, hy, hz, hl) {
    const C = KO.caps, ax = C[k], ay = C[k + 1], az = C[k + 2], ux = C[k + 3] - ax, uy = C[k + 4] - ay, uz = C[k + 5] - az;
    const px = x - hx * hl, py = y - hy * hl, pz = z - hz * hl, vx = hx * 2 * hl, vy = hy * 2 * hl, vz = hz * 2 * hl;
    const rx = px - ax, ry = py - ay, rz = pz - az, a = vx * vx + vy * vy + vz * vz, e = ux * ux + uy * uy + uz * uz, f = ux * rx + uy * ry + uz * rz;
    const c = vx * rx + vy * ry + vz * rz, b = vx * ux + vy * uy + vz * uz, den = a * e - b * b;
    let s = 0, t = 0;
    if (e < 1e-9) s = a > 1e-9 ? clamp$4(-c / a, 0, 1) : 0;
    else {
      s = den > 1e-9 ? clamp$4((b * f - c * e) / den, 0, 1) : 0;
      t = (b * s + f) / e;
      if (t < 0) { t = 0; s = a > 1e-9 ? clamp$4(-c / a, 0, 1) : 0; } else if (t > 1) { t = 1; s = a > 1e-9 ? clamp$4((b - c) / a, 0, 1) : 0; }
    }
    const dx = px + vx * s - ax - ux * t, dy = py + vy * s - ay - uy * t, dz = pz + vz * s - az - uz * t, d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (d > 1e-5) { KN[0] = dx / d; KN[1] = dy / d; KN[2] = dz / d; } else { KN[0] = 0; KN[1] = 1; KN[2] = 0; }
    return d;
  }
  function lensNear(x, y, z) {
    const bx = fLvx * LENS_AHEAD, by = fLvy * LENS_AHEAD, bz = fLvz * LENS_AHEAD, b2 = bx * bx + by * by + bz * bz;
    let t = b2 > 1e-6 ? ((x - fLx) * bx + (y - fLy) * by + (z - fLz) * bz) / b2 : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    let nx = x - fLx - bx * t, ny = y - fLy - by * t, nz = z - fLz - bz * t;
    const d = Math.sqrt(nx * nx + ny * ny + nz * nz);
    if (d > 1e-5) { nx /= d; ny /= d; nz /= d; } else { nx = 0; ny = 1; nz = 0; }
    LN[3] = d; LN[4] = nx; LN[5] = ny; LN[6] = nz;
    if (b2 > 0.01) {
      const bl = Math.sqrt(b2), ux = bx / bl, uy = by / bl, uz = bz / bl;
      let a = nx * ux + ny * uy + nz * uz, sx = nx - ux * a, sy = ny - uy * a, sz = nz - uz * a, sl = Math.sqrt(sx * sx + sy * sy + sz * sz);
      if (sl < 0.3) { sx = x - fPlx; sy = 0; sz = z - fPlz; a = sx * ux + sz * uz; sx -= ux * a; sy -= uy * a; sz -= uz * a; sl = Math.sqrt(sx * sx + sy * sy + sz * sz); }
      if (sl > 1e-4) { nx = sx / sl; ny = sy / sl; nz = sz / sl; }
    }
    LN[0] = nx; LN[1] = ny; LN[2] = nz;
    return d;
  }
  function move(i, S, d2p, qx, qy, qz, al) {
    let x = pX[i], y = pY[i], z = pZ[i];
    const vx0 = vX[i], vy0 = vY[i], vz0 = vZ[i], sp0 = Math.sqrt(vx0 * vx0 + vy0 * vy0 + vz0 * vz0);
    GO[9] = sp0;
    const wG = GO[3];
    let ax = (GO[0] - vx0) * wG, ay = (GO[1] - vy0) * wG, az = (GO[2] - vz0) * wG;
    if (S.nbrR > 0) { ax += nbX[i]; ay += nbY[i]; az += nbZ[i]; }
    let vmax = GO[8], panic = 0;
    const fleeR = ent[i] ? enF[i] : cuS[i] === 2 ? S.flee * 0.25 : fdr[i] !== 0 && FEED.k > 0.3 ? S.flee * 0.35 : S.flee * (fDv && (grp[i] === gDesc || (grp[i] === gBot && !BS.room)) ? 0.6 : 1);
    if (fleeR > 0 && d2p < fleeR * fleeR) {
      const d = Math.sqrt(d2p) + 1e-5;
      let ux = qx / d, uy = qy / d, uz = qz / d;
      if (fPvl > 0.3) { const a = (ux * fPnx + uy * fPny + uz * fPnz) * 0.5; ux -= fPnx * a; uy -= fPny * a; uz -= fPnz * a; }
      const w = 1 - d / fleeR, f = S.fleeW * w * (0.6 + w);
      panic = w;
      ax += ux * f; ay += uy * f * 0.5; az += uz * f;
      vmax *= 1 + 0.9 * w;
    }
    if (al > 0.02) {
      const d = Math.sqrt(d2p) + 1e-4;
      if (d < 30) { const k = (S.fleeW * 0.5 * al) / d; ax += qx * k; ay += qy * k * 0.4; az += qz * k; }
      vmax *= 1 + 0.7 * al;
      if (al * 0.6 > panic) panic = al * 0.6;
    }
    if (FEED.k > 0.05) {
      const lx = FEED.x - fPlx, ly = FEED.y - fPly, lz = FEED.z - fPlz, l2 = lx * lx + ly * ly + lz * lz;
      if (l2 > 1e-4) {
        let tl = ((x - fPlx) * lx + (y - fPly) * ly + (z - fPlz) * lz) / l2;
        tl = tl < 0 ? 0 : tl;
        if (tl < 0.6) {
          const cx = x - fPlx - lx * tl, cy = y - fPly - ly * tl, cz = z - fPlz - lz * tl, c2 = cx * cx + cy * cy + cz * cz;
          if (c2 < 0.1225) { const c = Math.sqrt(c2) + 1e-4, f = (0.35 - c) * 12 * FEED.k; ax += (cx / c) * f; ay += (cy / c) * f; az += (cz / c) * f; }
        }
      }
      if (d2p < LENS_KEEP * LENS_KEEP) {
        const d = Math.sqrt(d2p) + 1e-4, w = 1 - d / LENS_KEEP, f = 10 * w * (0.5 + w) * FEED.k;
        ax += (qx / d) * f; ay += (qy / d) * f * 0.6; az += (qz / d) * f;
      }
    }
    const lR = ent[i] && scl[i] < 0.15 ? 0.5 : LENS_R;
    if (fDv && lensNear(x, y, z) < lR + KO_BODY + LENS_STEER) {
      const w = (lR + KO_BODY + LENS_STEER - LN[3]) / LENS_STEER, f = 14 * w * (0.5 + w);
      ax += LN[0] * f; ay += LN[1] * f; az += LN[2] * f;
      if (w * 0.5 > panic) panic = Math.min(1, w * 0.5);
    }
    if (KO.n) {
      const ex = x - KO.cx, ey = y - KO.cy, ez = z - KO.cz, RL = KO.R + 0.45 * scl[i];
      if (ex * ex + ey * ey + ez * ez < RL * RL) {
        for (let k = 0; k < KO.n * 7; k += 7) {
          const d = koNear(k, x, y, z), Rs = KO.caps[k + 6] + KO_BODY + KO_STEER + 0.3 * scl[i];
          if (d < Rs) { const w = (Rs - d) / KO_STEER, f = 14 * w * (0.5 + w); ax += KN[0] * f; ay += KN[1] * f; az += KN[2] * f; if (w * 0.5 > panic) panic = Math.min(1, w * 0.5); }
        }
      }
    }
    const wa = S.wander * fWander, ph = nPh[i];
    ax += Math.sin(fT * 0.73 + ph * 3.1) * wa;
    ay += Math.sin(fT * 0.51 + ph * 1.7) * wa * 0.35;
    az += Math.cos(fT * 0.67 + ph * 2.3) * wa;
    if (NO > 0) {
      const lx = x + vx0 * S.look, ly = y + vy0 * S.look, lz = z + vz0 * S.look;
      const c = ogCell(x, z), ce = ogStart[c + 1];
      for (let k = ogStart[c]; k < ce; k++) {
        const o = ogItems[k];
        const dx = lx - oX[o], dy = ly - oY[o], dz = lz - oZ[o], Rb = oR[o] + S.margin + S.obsBuf;
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 < Rb * Rb) {
          const d = Math.sqrt(d2) + 1e-5, pen = Rb - d, f = pen * pen * 3 + pen * 1.5;
          let nx = dx / d, ny = dy / d, nz = dz / d;
          if (sp0 > 0.05 && (nx * vx0 + ny * vy0 + nz * vz0) / sp0 < -0.85) { nx -= (vz0 / sp0) * 0.8; nz += (vx0 / sp0) * 0.8; }
          ax += nx * f; ay += ny * f; az += nz * f;
        }
      }
    }
    if (NC) {
      const lx = x + vx0 * S.look, ly = y + vy0 * S.look, lz = z + vz0 * S.look, l = capCell(lx, lz);
      if (l) {
        for (const k of l) {
          const Rb = CP[k * 7 + 6] + 0.45 * scl[i] + 0.2, d = capDist(k, lx, ly, lz);
          if (d < Rb) { const pen = Rb - d, f = pen * pen * 3 + pen * 1.5; ax += CN[0] * f; ay += CN[1] * f; az += CN[2] * f; }
        }
      }
    }
    const floorY = fl[i], fm = floorY + S.floorM, cu = GO[11];
    if (GO[10] > 0.5 && y < fm + cu) { const k = fm + cu - y; ay += k * k * 3; if (vy0 < 0) ay -= vy0 * 2 * Math.min(k, 1); }
    const sTop = ent[i] === ENT_SHADE ? -0.7 : -1.5, sSoft = ent[i] === ENT_SHADE ? -1 : -2.8;
    if (y > sSoft) ay -= (y - sSoft) * 3;
    const r2 = x * x + z * z;
    if (r2 > 3600) { const r = Math.sqrt(r2), k = (r - 60) * 0.5; ax -= (x / r) * k; az -= (z / r) * k; }
    const amax = S.acc * (1 + 2.5 * panic) * (1 - 0.3 * calm), a2 = ax * ax + ay * ay + az * az;
    if (a2 > amax * amax) { const k = amax / Math.sqrt(a2); ax *= k; ay *= k; az *= k; }
    const dt = fDt;
    let vx = vx0 + ax * dt, vy = vy0 + ay * dt, vz = vz0 + az * dt;
    vy -= vy * Math.min(1, S.vDamp * dt);
    let s1 = Math.sqrt(vx * vx + vy * vy + vz * vz);
    if (sp0 > 0.05 && s1 > 0.05) {
      const ox = vx0 / sp0, oy = vy0 / sp0, oz = vz0 / sp0;
      const c = (ox * vx + oy * vy + oz * vz) / s1;
      let cT = S.cosTurn, sT = S.sinTurn;
      if (panic > 0) { const ang = S.turn * dt * (1 + 2 * panic); cT = Math.cos(ang); sT = Math.sin(ang); }
      if (c < cT) {
        let wx = vx / s1 - ox * c, wy = vy / s1 - oy * c, wz = vz / s1 - oz * c;
        let wl = Math.sqrt(wx * wx + wy * wy + wz * wz);
        if (wl < 1e-5) { wx = -oz; wy = 0; wz = ox; wl = Math.sqrt(wx * wx + wz * wz); if (wl < 1e-5) { wx = 1; wl = 1; } }
        vx = (ox * cT + (wx / wl) * sT) * s1; vy = (oy * cT + (wy / wl) * sT) * s1; vz = (oz * cT + (wz / wl) * sT) * s1;
      }
    }
    const vmin = S.vMin * fSpd;
    if (s1 > vmax) { const k = vmax / s1; vx *= k; vy *= k; vz *= k; }
    else if (s1 < vmin) {
      if (s1 > 1e-4) { const k = vmin / s1; vx *= k; vy *= k; vz *= k; } else { vx = hX[i] * vmin; vy = hY[i] * vmin; vz = hZ[i] * vmin; }
    }
    x += vx * dt; y += vy * dt; z += vz * dt;
    if (NO > 0) {
      const c = ogCell(x, z), ce = ogStart[c + 1];
      for (let k = ogStart[c]; k < ce; k++) {
        const o = ogItems[k];
        const dx = x - oX[o], dy = y - oY[o], dz = z - oZ[o], R = oR[o] + S.margin * 0.5, d2 = dx * dx + dy * dy + dz * dz;
        if (d2 < R * R) {
          const d = Math.sqrt(d2);
          let nx = 0, ny = 1, nz = 0;
          if (d > 1e-4) { nx = dx / d; ny = dy / d; nz = dz / d; }
          x = oX[o] + nx * R; y = oY[o] + ny * R; z = oZ[o] + nz * R;
          const vn = vx * nx + vy * ny + vz * nz;
          if (vn < 0) { vx -= nx * vn; vy -= ny * vn; vz -= nz * vn; }
        }
      }
    }
    if (KO.n) {
      const hl = 0.42 * scl[i], ex = x - KO.cx, ey = y - KO.cy, ez = z - KO.cz, RL = KO.R + hl;
      if (ex * ex + ey * ey + ez * ez < RL * RL) {
        const s1 = Math.sqrt(vx * vx + vy * vy + vz * vz);
        const hdx = s1 > 0.05 ? vx / s1 : hX[i], hdy = s1 > 0.05 ? vy / s1 : hY[i], hdz = s1 > 0.05 ? vz / s1 : hZ[i];
        for (let k = 0; k < KO.n * 7; k += 7) {
          const R = KO.caps[k + 6] + KO_BODY, d = koNear(k, x, y, z);
          let push = 0;
          if (d < R) push = R - d;
          else if (d < R + hl) {
            const Rb = KO.caps[k + 6] + 0.02 + 0.09 * scl[i], sd = koBody(k, x, y, z, hdx, hdy, hdz, hl);
            if (sd < Rb) push = Rb - sd;
          }
          if (push > 0) {
            x += KN[0] * push; y += KN[1] * push; z += KN[2] * push;
            const vn = vx * KN[0] + vy * KN[1] + vz * KN[2];
            if (vn < 0) { vx -= KN[0] * vn; vy -= KN[1] * vn; vz -= KN[2] * vn; }
          }
        }
      }
    }
    if (NC) {
      const l = capCell(x, z);
      if (l) {
        for (const k of l) {
          const R = CP[k * 7 + 6] + 0.45 * scl[i], d = capDist(k, x, y, z);
          if (d < R) {
            x += CN[0] * (R - d); y += CN[1] * (R - d); z += CN[2] * (R - d);
            const vn = vx * CN[0] + vy * CN[1] + vz * CN[2];
            if (vn < 0) { vx -= CN[0] * vn; vy -= CN[1] * vn; vz -= CN[2] * vn; }
          }
        }
      }
    }
    if (fDv && lensNear(x, y, z) < lR + KO_BODY) {
      const e = lR + KO_BODY - LN[3];
      x += LN[4] * e; y += LN[5] * e; z += LN[6] * e;
      const vn = vx * LN[4] + vy * LN[5] + vz * LN[6];
      if (vn < 0) { vx -= LN[4] * vn; vy -= LN[5] * vn; vz -= LN[6] * vn; }
    }
    const minY = floorY + S.floorM * 0.6;
    if (y < minY) { y = minY; if (vy < 0) vy = 0; }
    if (y > sTop) { y = sTop; if (vy > 0) vy = 0; }
    if (!(x === x && y === y && z === z && vx === vx && vy === vy && vz === vz)) {
      x = spX[i]; y = spY[i]; z = spZ[i]; vx = 0; vy = 0; vz = 0;
    }
    pX[i] = x; pY[i] = y; pZ[i] = z; vX[i] = vx; vY[i] = vy; vZ[i] = vz;
  }

  function orient(i, S, kind, al) {
    const vx = vX[i], vy = vY[i], vz = vZ[i], s1 = Math.sqrt(vx * vx + vy * vy + vz * vz), sp0 = GO[9];
    let dhx = hX[i], dhy = hY[i], dhz = hZ[i];
    if (s1 > 1e-4) { dhx = vx / s1; dhy = vy / s1; dhz = vz / s1; }
    const faceW = GO[4];
    if (faceW > 0) {
      const fx = GO[5], fy = GO[6], fz = GO[7], fL = Math.sqrt(fx * fx + fy * fy + fz * fz);
      if (fL > 1e-5) {
        dhx = dhx * (1 - faceW) + (fx / fL) * faceW; dhy = dhy * (1 - faceW) + (fy / fL) * faceW; dhz = dhz * (1 - faceW) + (fz / fL) * faceW;
        const l = Math.sqrt(dhx * dhx + dhy * dhy + dhz * dhz);
        if (l > 1e-5) { dhx /= l; dhy /= l; dhz /= l; } else { dhx = hX[i]; dhy = hY[i]; dhz = hZ[i]; }
      }
    }
    const ohx = hX[i], ohz = hZ[i];
    let hx = ohx, hy = hY[i], hz = ohz;
    const hc = hx * dhx + hy * dhy + hz * dhz;
    if (hc < S.cosHead) {
      let wx = dhx - hx * hc, wy = dhy - hy * hc, wz = dhz - hz * hc;
      let wl = Math.sqrt(wx * wx + wy * wy + wz * wz);
      if (wl < 1e-5) { wx = -hz; wy = 0; wz = hx; wl = Math.sqrt(wx * wx + wz * wz) || 1; }
      hx = hx * S.cosHead + (wx / wl) * S.sinHead; hy = hy * S.cosHead + (wy / wl) * S.sinHead; hz = hz * S.cosHead + (wz / wl) * S.sinHead;
    } else {
      hx += (dhx - hx) * fKHead; hy += (dhy - hy) * fKHead; hz += (dhz - hz) * fKHead;
    }
    let hl = Math.sqrt(hx * hx + hy * hy + hz * hz) || 1;
    hx /= hl; hy /= hl; hz /= hl;
    let pmax = S.pitch;
    if (kind === K_MEADOW) {
      pB[i] += ((st[i] === 1 ? 0.88 : S.pitch) - pB[i]) * fKBank;
      pmax = pB[i];
    }
    if (hy > pmax || hy < -pmax) {
      hy = hy > 0 ? pmax : -pmax;
      const xz = Math.sqrt(hx * hx + hz * hz), k = Math.sqrt(1 - hy * hy);
      if (xz > 1e-5) { hx *= k / xz; hz *= k / xz; } else { hx = k; hz = 0; }
    }
    let Lx = hz, Lz = -hx;
    hl = Math.sqrt(Lx * Lx + Lz * Lz) || 1;
    Lx /= hl; Lz /= hl;
    const yawL = ((hx - ohx) * Lx + (hz - ohz) * Lz) / fDt;
    let bt = -clamp$4(S.bankK * s1 * yawL, -0.62, 0.62);
    if (al > 0.05) bt += al * 0.55 * (nPh[i] < Math.PI ? 1 : -1);
    bank[i] += (bt - bank[i]) * fKBank;
    bend[i] += (clamp$4(yawL * S.bendK, -0.12, 0.12) - bend[i]) * fKBank;
    const L = scl[i];
    const beat = 0.25 + 0.75 * bcf[i];
    const freq = Math.min(S.fMax, S.f0 + s1 / (S.stride * L)) * (0.55 + 0.45 * beat);
    let tp = tail[i] + TAU$3 * freq * fDt;
    if (tp > TAU$3) tp -= TAU$3;
    tail[i] = tp;
    const rel = s1 / (S.cruise + 1e-3);
    const at = (S.aMin + (S.aMax - S.aMin) * clamp$4(rel * 0.75, 0, 1) + clamp$4(((s1 - sp0) / fDt) * 0.015, 0, 0.035)) * beat;
    amp[i] += (at - amp[i]) * fKAmp;
    hov[i] += (Math.min(1, Math.max(S.pect, clamp$4(1 - rel * 1.3, 0, 1)) + (1 - beat) * 0.4) - hov[i]) * fKAmp;
    hX[i] = hx; hY[i] = hy; hZ[i] = hz;
    const Ux = hy * Lz, Uy = hz * Lx - hx * Lz, Uz = -hy * Lx;
    let roll = bank[i];
    if (S.glOn) {
      let p = glP[i];
      if (p < 0) {
        p += fDt;
        if (p >= 0) { p = 0; glA[i] = (hash01(i, frame) < 0.5 ? -1 : 1) * (S.gA0 + (S.gA1 - S.gA0) * hash01(i + 911, frame)); }
      } else {
        p += fDt / S.gDur;
        if (p >= 1) p = -(S.gI0 + (S.gI1 - S.gI0) * hash01(i + 373, frame));
        else roll += glA[i] * Math.sin(Math.PI * p) * (1 - 0.5 * calm);
      }
      glP[i] = p;
    }
    const cb = Math.cos(roll), sb = Math.sin(roll);
    const m = S.mat, o = (i - S.start) << 4;
    m[o] = (Lx * cb + Ux * sb) * L; m[o + 1] = Uy * sb * L; m[o + 2] = (Lz * cb + Uz * sb) * L; m[o + 3] = 0;
    m[o + 4] = (Ux * cb - Lx * sb) * L; m[o + 5] = Uy * cb * L; m[o + 6] = (Uz * cb - Lz * sb) * L; m[o + 7] = 0;
    m[o + 8] = hx * L; m[o + 9] = hy * L; m[o + 10] = hz * L; m[o + 11] = 0;
    m[o + 12] = pX[i]; m[o + 13] = pY[i]; m[o + 14] = pZ[i]; m[o + 15] = 1;
    const w = S.swim, wo = (i - S.start) << 2;
    w[wo] = tp; w[wo + 1] = amp[i]; w[wo + 2] = bend[i]; w[wo + 3] = hov[i];
  }

  function updateJellies(dt, t) {
    const m = bellMesh.instanceMatrix.array;
    for (let k = 0; k < NJ; k++) {
      const ph = jPh[k], pu = t / 1.8 + ph, pf = pu - Math.floor(pu);
      const thr = sstep$3(0, 0.08, pf) * (1 - sstep$3(0.08, 0.32, pf));
      const ty = jTY[k] + 0.8 * Math.sin(t * 0.05 + ph * 7);
      jVY[k] += (thr * 0.55 - 0.075 + (ty - jY[k]) * 0.03 - jVY[k] * 1.2) * dt;
      jY[k] = clamp$4(jY[k] + jVY[k] * dt, -7, -2);
      jHd[k] += Math.sin(t * 0.13 + ph * 9.1) * 0.25 * dt;
      const sp = 0.05 + 0.06 * thr;
      let vx = Math.cos(jHd[k]) * sp, vz = Math.sin(jHd[k]) * sp;
      const r = Math.sqrt(jX[k] * jX[k] + jZ[k] * jZ[k]);
      if (r > 24) { vx -= (jX[k] / r) * (r - 24) * 0.05; vz -= (jZ[k] / r) * (r - 24) * 0.05; }
      jX[k] += vx * dt; jZ[k] += vz * dt;
      jYaw[k] += (k & 1 ? 0.08 : -0.08) * dt;
      let ux = 0.12 * Math.sin(t * 0.37 + ph * 4) + vx * 1.5, uy = 1, uz = 0.12 * Math.cos(t * 0.29 + ph * 3) + vz * 1.5;
      const ul = Math.sqrt(ux * ux + uy * uy + uz * uz);
      ux /= ul; uy /= ul; uz /= ul;
      const sx = Math.sin(jYaw[k]), cz = Math.cos(jYaw[k]);
      let xx = uy * cz, xy = uz * sx - ux * cz, xz = -uy * sx;
      const xl = Math.sqrt(xx * xx + xy * xy + xz * xz) || 1;
      xx /= xl; xy /= xl; xz /= xl;
      const zx = xy * uz - xz * uy, zy = xz * ux - xx * uz, zz = xx * uy - xy * ux;
      const s = jS[k], o = k * 16;
      m[o] = xx * s; m[o + 1] = xy * s; m[o + 2] = xz * s; m[o + 3] = 0;
      m[o + 4] = ux * s; m[o + 5] = uy * s; m[o + 6] = uz * s; m[o + 7] = 0;
      m[o + 8] = zx * s; m[o + 9] = zy * s; m[o + 10] = zz * s; m[o + 11] = 0;
      m[o + 12] = jX[k]; m[o + 13] = jY[k]; m[o + 14] = jZ[k]; m[o + 15] = 1;
    }
    bellMesh.instanceMatrix.needsUpdate = true;
  }

  function bez(u, out) {
    const a = (1 - u) * (1 - u), b = 2 * u * (1 - u), c = u * u;
    for (let j = 0; j < 3; j++) out[j] = a * D.p0[j] + b * D.c[j] + c * D.p1[j];
  }
  function bezTan(u, out) {
    const a = 2 * (1 - u), b = 2 * u;
    for (let j = 0; j < 3; j++) out[j] = a * (D.c[j] - D.p0[j]) + b * (D.p1[j] - D.c[j]);
    const l = Math.sqrt(out[0] * out[0] + out[1] * out[1] + out[2] * out[2]) || 1;
    out[0] /= l; out[1] /= l; out[2] /= l;
  }
  function podPoint(k, arc, tt, out) {
    if (arc <= 0 || arc >= D.len) {
      const end = arc <= 0 ? 0 : 1, e = arc <= 0 ? arc : arc - D.len;
      bez(end, T1); bezTan(end, T2);
      T1[0] += T2[0] * e; T1[1] += T2[1] * e; T1[2] += T2[2] * e;
    } else {
      let j = 0;
      while (j < 31 && D.tab[j + 1] < arc) j++;
      const seg = D.tab[j + 1] - D.tab[j];
      const u = (j + (seg > 1e-6 ? (arc - D.tab[j]) / seg : 0)) / 32;
      bez(u, T1); bezTan(u, T2);
    }
    let nx = -T2[2], nz = T2[0];
    const nl = Math.sqrt(nx * nx + nz * nz) || 1;
    nx /= nl; nz /= nl;
    const lat = (DOL_LAT[k] + 0.3 * Math.sin(tt * 0.9 + k * 2.1)) * D.latS;
    const ver = DOL_VER[k] + 0.35 * Math.sin(tt * 2.2 + k * 1.3);
    out[0] = T1[0] + nx * lat; out[1] = T1[1] + ver; out[2] = T1[2] + nz * lat;
  }

  function updateDolphins(dt, t) {
    if (DP.on) { updatePass(dt, t); return; }
    if (!D.active) return;
    D.arc += D.speed * dt;
    if (D.arc > D.len + 9) { D.active = false; dolMesh.visible = false; return; }
    const m = dolMesh.instanceMatrix.array, w = dolSwim.array;
    for (let k = 0; k < ND; k++) {
      const a = D.arc + DOL_LAG[k];
      podPoint(k, a, t, A3);
      podPoint(k, a + D.speed * 0.05, t + 0.05, B3);
      let fx = B3[0] - A3[0] + D.vel[0] * 0.05, fy = B3[1] - A3[1] + D.vel[1] * 0.05, fz = B3[2] - A3[2] + D.vel[2] * 0.05;
      A3[0] += D.off[0]; A3[1] += D.off[1]; A3[2] += D.off[2];
      A3[1] = clamp$4(A3[1], floorAt(A3[0], A3[2]) + 1.2, -1.2);
      let fl2 = Math.sqrt(fx * fx + fy * fy + fz * fz);
      if (fl2 < 1e-6) { fx = D.fx[k]; fy = 0; fz = D.fz[k]; fl2 = Math.sqrt(fx * fx + fz * fz) || 1; }
      fx /= fl2; fy /= fl2; fz /= fl2;
      if (fy > 0.5 || fy < -0.5) {
        fy = fy > 0 ? 0.5 : -0.5;
        const xz = Math.sqrt(fx * fx + fz * fz) || 1, kk = Math.sqrt(1 - fy * fy) / xz;
        fx *= kk; fz *= kk;
      }
      let Lx = fz, Lz = -fx;
      const Ll = Math.sqrt(Lx * Lx + Lz * Lz) || 1;
      Lx /= Ll; Lz /= Ll;
      if (dt > 0) {
        const yawL = ((fx - D.fx[k]) * Lx + (fz - D.fz[k]) * Lz) / dt;
        D.bank[k] += (-clamp$4(yawL * 1.2, -0.6, 0.6) - D.bank[k]) * (1 - Math.exp(-dt * 3));
        D.ph[k] += TAU$3 * 2.1 * dt;
        if (D.ph[k] > TAU$3) D.ph[k] -= TAU$3;
      }
      D.fx[k] = fx; D.fz[k] = fz;
      let roll = D.bank[k] + 0.2 * Math.sin(t * 0.8 + k * 1.9);
      if (k === 2) roll += TAU$3 * sstep$3(0.42, 0.62, D.arc / D.len);
      const Ux = fy * Lz, Uy = fz * Lx - fx * Lz, Uz = -fy * Lx;
      const cb = Math.cos(roll), sb = Math.sin(roll), s = D.size[k], o = k * 16;
      m[o] = (Lx * cb + Ux * sb) * s; m[o + 1] = Uy * sb * s; m[o + 2] = (Lz * cb + Uz * sb) * s; m[o + 3] = 0;
      m[o + 4] = (Ux * cb - Lx * sb) * s; m[o + 5] = Uy * cb * s; m[o + 6] = (Uz * cb - Lz * sb) * s; m[o + 7] = 0;
      m[o + 8] = fx * s; m[o + 9] = fy * s; m[o + 10] = fz * s; m[o + 11] = 0;
      m[o + 12] = A3[0]; m[o + 13] = A3[1]; m[o + 14] = A3[2]; m[o + 15] = 1;
      w[k * 4] = D.ph[k]; w[k * 4 + 1] = 0.075; w[k * 4 + 2] = 0; w[k * 4 + 3] = 0;
    }
    dolMesh.instanceMatrix.needsUpdate = true;
    dolSwim.needsUpdate = true;
  }

  function startDolphins(camPos, camForward) {
    if (camPos && Array.isArray(camPos.P)) return startPass(camPos);
    DP.on = false; dolMesh.count = ND;
    const cx = camPos && Number.isFinite(camPos.x) ? camPos.x : 0;
    const cy = camPos && Number.isFinite(camPos.y) ? camPos.y : -2;
    const cz = camPos && Number.isFinite(camPos.z) ? camPos.z : 0;
    let fx = camForward && Number.isFinite(camForward.x) ? camForward.x : 0;
    let fz = camForward && Number.isFinite(camForward.z) ? camForward.z : -1;
    if ((cx - DS.a[0]) ** 2 + (cz - DS.a[2]) ** 2 < 225) { fx = DS.b[0] - DS.a[0]; fz = DS.b[2] - DS.a[2]; }
    const fl0 = Math.sqrt(fx * fx + fz * fz);
    if (fl0 < 1e-4) { fx = 0; fz = -1; } else { fx /= fl0; fz /= fl0; }
    const rx = -fz, rz = fx, side = rand$1() < 0.5 ? -1 : 1;
    const ahead = rr(9.0, 9.6), my = Math.min(cy, -0.3) - rr(1.5, 1.9);
    D.latS = -side;
    D.p0[0] = cx + fx * (ahead + 1.2) - rx * 16 * side; D.p0[1] = my + 0.4; D.p0[2] = cz + fz * (ahead + 1.2) - rz * 16 * side;
    D.p1[0] = cx + fx * (ahead + 1.8) + rx * 16 * side; D.p1[1] = my - 0.4; D.p1[2] = cz + fz * (ahead + 1.8) + rz * 16 * side;
    D.c[0] = 2 * (cx + fx * ahead) - 0.5 * (D.p0[0] + D.p1[0]);
    D.c[1] = 2 * my - 0.5 * (D.p0[1] + D.p1[1]);
    D.c[2] = 2 * (cz + fz * ahead) - 0.5 * (D.p0[2] + D.p1[2]);
    D.off[0] = D.off[1] = D.off[2] = 0;
    D.vel[0] = D.vel[1] = D.vel[2] = 0;
    D.lf[0] = cx; D.lf[1] = cy; D.lf[2] = cz;
    let len = 0;
    bez(0, A3);
    D.tab[0] = 0;
    for (let j = 1; j <= 32; j++) {
      bez(j / 32, B3);
      len += Math.sqrt((B3[0] - A3[0]) ** 2 + (B3[1] - A3[1]) ** 2 + (B3[2] - A3[2]) ** 2);
      D.tab[j] = len;
      A3[0] = B3[0]; A3[1] = B3[1]; A3[2] = B3[2];
    }
    D.len = Math.max(len, 1);
    D.speed = clamp$4(D.len / 6.2, 4.2, 6.5);
    D.arc = 0;
    bezTan(0, T2);
    for (let k = 0; k < ND; k++) { D.fx[k] = T2[0]; D.fz[k] = T2[2]; D.bank[k] = 0; D.ph[k] = rand$1() * TAU$3; }
    D.active = true;
    dolMesh.visible = true;
    updateDolphins(0, simTime);
    return -side;
  }

  function setDescent(from, to, face) {
    if (!from || !to || !Number.isFinite(from.x + from.y + from.z + to.x + to.y + to.z)) return;
    DS.a[0] = from.x; DS.a[1] = Math.min(from.y, -0.6); DS.a[2] = from.z;
    DS.b[0] = to.x; DS.b[1] = to.y; DS.b[2] = to.z;
    if (face && Number.isFinite(face.x + face.z)) { DS.f[0] = face.x; DS.f[1] = face.z; DS.fOn = true; }
    descentSpot();
    bottomSpot();
    if (BS.hold && !BS.near && !(DVR.on && simTime - DVR.t < 0.25)) {
      const dx = BS.spot[0] - gX[gBot], dy = BS.spot[1] - gY[gBot], dz = BS.spot[2] - gZ[gBot];
      gX[gBot] += dx; gY[gBot] += dy; gZ[gBot] += dz; gTX[gBot] = gX[gBot]; gTY[gBot] = gY[gBot]; gTZ[gBot] = gZ[gBot];
      for (let i = 0; i < N; i++) if (grp[i] === gBot) { pX[i] += dx; pY[i] += dy; pZ[i] += dz; }
    }
    const n = nearSpots(NEAR);
    for (let k = 0; k < n && k < gNear.length; k++) {
      const g = gNear[k], x = NEAR[k * 2], z = NEAR[k * 2 + 1], y = floorAt(x, z) + 1.0;
      const dx = x - gX[g], dy = y - gY[g], dz = z - gZ[g];
      if (dx * dx + dz * dz < 0.25) continue;
      gX[g] = x; gY[g] = y; gZ[g] = z;
      for (let i = 0; i < N; i++) if (grp[i] === g) { hmX[i] += dx; hmY[i] += dy; hmZ[i] += dz; }
    }
  }

  const HOSE = { t: -1e9, n: 0, caps: new Float32Array(7 * 16) };
  function setHose(pts) {
    HOSE.n = 0;
    if (!pts || pts.length < 6) return;
    HOSE.t = simTime;
    let ax = pts[0], ay = pts[1], az = pts[2];
    for (let i = 3; i + 2 < pts.length && HOSE.n < 16; i += 3) {
      const bx = pts[i], by = pts[i + 1], bz = pts[i + 2], seg = HOSE.n < 6 ? 0.7 : 1.5;
      if ((bx - ax) ** 2 + (by - ay) ** 2 + (bz - az) ** 2 < seg * seg && i + 5 < pts.length) continue;
      const o = HOSE.n * 7, H = HOSE.caps;
      H[o] = ax; H[o + 1] = ay; H[o + 2] = az; H[o + 3] = bx; H[o + 4] = by; H[o + 5] = bz; H[o + 6] = 0.03;
      HOSE.n++; ax = bx; ay = by; az = bz;
    }
  }

  function setDiver(p, v, hose) {
    if (!p || !Number.isFinite(p.x + p.y + p.z)) { DVR.on = false; return; }
    DVR.on = true; DVR.t = simTime;
    DVR.x = p.x; DVR.y = p.y; DVR.z = p.z;
    const vo = v && Number.isFinite(v.x + v.y + v.z);
    DVR.vx = vo ? v.x : 0; DVR.vy = vo ? v.y : 0; DVR.vz = vo ? v.z : 0;
    DVR.nH = 0;
    if (!hose || hose.length < 6) return;
    let ax = hose[0], ay = hose[1], az = hose[2];
    for (let i = 3; i + 2 < hose.length && DVR.nH < 6; i += 3) {
      const bx = hose[i], by = hose[i + 1], bz = hose[i + 2];
      if ((bx - ax) ** 2 + (by - ay) ** 2 + (bz - az) ** 2 < 0.64) continue;
      const o = DVR.nH * 7, H = DVR.hose;
      H[o] = ax; H[o + 1] = ay; H[o + 2] = az; H[o + 3] = bx; H[o + 4] = by; H[o + 5] = bz; H[o + 6] = 0.09;
      DVR.nH++; ax = bx; ay = by; az = bz;
    }
  }

  function setCalm(k) {
    calmTarget = clamp$4(Number.isFinite(+k) ? +k : 0, 0, 1);
  }

  const SPW = SP.findIndex((s) => s.key === 'wrasse');
  const SPC = [SP.findIndex((s) => s.key === 'chromisJ'), SP.findIndex((s) => s.key === 'chromisA')];
  const pickD = new Float32Array(24), pickI = new Int32Array(24);
  function nearest(s, n, r, x, z) {
    let m = 0;
    if (s < 0) return 0;
    const S = SP[s];
    for (let k = 0; k < S.count; k++) {
      const i = S.start + k;
      if (fdr[i]) continue;
      const dx = pX[i] - x, dz = pZ[i] - z, d2 = dx * dx + dz * dz;
      if (d2 > r * r || (m === n && d2 >= pickD[m - 1])) continue;
      let j = m < n ? m++ : m - 1;
      while (j > 0 && pickD[j - 1] > d2) { pickD[j] = pickD[j - 1]; pickI[j] = pickI[j - 1]; j--; }
      pickD[j] = d2; pickI[j] = i;
    }
    return m;
  }
  function onFeedLine(x, z) {
    const lx = FEED.x - fPlx, lz = FEED.z - fPlz, l2 = lx * lx + lz * lz;
    if (l2 < 1e-4) return false;
    let t = ((x - fPlx) * lx + (z - fPlz) * lz) / l2;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const cx = x - fPlx - lx * t, cz = z - fPlz - lz * t;
    return cx * cx + cz * cz < 0.16;
  }
  function takeFeeders() {
    FEED.active = true;
    const fx = FEED.x, fz = FEED.z, f0 = floorAt(fx, fz);
    let bx = fPlx < 1e4 ? fPlx - fx : 1, bz = fPlx < 1e4 ? fPlz - fz : 0;
    const bl = Math.sqrt(bx * bx + bz * bz) || 1;
    bx /= bl; bz /= bl;
    gX[gFeed] = fx; gY[gFeed] = f0 + 0.6; gZ[gFeed] = fz;
    FEED.far = Math.atan2(-bz, -bx);
    for (let k = 0, m = nearest(SPW, 6, 35, fx, fz); k < m; k++) {
      const i = pickI[k];
      fdr[i] = 1; fdHX[i] = hmX[i]; fdHY[i] = hmY[i]; fdHZ[i] = hmZ[i];
      hmX[i] = fx; hmY[i] = f0 + 0.3; hmZ[i] = fz;
      pickWrasseTarget(i, fPlx, fPly, fPlz, 100);
      st[i] = 1; tB[i] = rr(0.85, 1.0);
    }
    for (const s of SPC) {
      for (let k = 0, m = nearest(s, 4, 30, fx, fz); k < m; k++) {
        const i = pickI[k];
        fdr[i] = 1; fdG[i] = grp[i]; fdHX[i] = hmX[i]; fdHY[i] = hmY[i]; fdHZ[i] = hmZ[i];
        if (grp[i] >= 0) gCount[grp[i]] = Math.max(0, gCount[grp[i]] - 1);
        grp[i] = gFeed; gCount[gFeed]++;
        const a = FEED.far + rr(-2.1, 2.1), r = rr(0.2, 0.55);
        hmX[i] = fx + Math.cos(a) * r; hmZ[i] = fz + Math.sin(a) * r;
        hmY[i] = floorAt(hmX[i], hmZ[i]) + rr(0.3, 0.45);
        st[i] = 0;
      }
    }
    FEED.farUsed = FEED.far;
    let best = -1, bd = 1e9;
    for (let k = 0; k < 3; k++) { const g = k < 2 ? gPatrol[k] : gRes, dx = gX[g] - fx, dz = gZ[g] - fz, d = dx * dx + dz * dz; if (d < bd && d < 22 * 22) { bd = d; best = g; } }
    FEED.school = best;
    if (best >= 0) {
      FEED.sX = fx - bx * 1.8; FEED.sZ = fz - bz * 1.8; FEED.sY = floorAt(FEED.sX, FEED.sZ) + 0.8;
      for (let i = 0; i < N; i++) if (grp[i] === best) fdr[i] = 2;
    }
  }
  function releaseFeeders() {
    FEED.active = false;
    FEED.k = 0;
    for (let i = 0; i < N; i++) {
      if (!fdr[i]) continue;
      if (fdr[i] === 1) {
        hmX[i] = fdHX[i]; hmY[i] = fdHY[i]; hmZ[i] = fdHZ[i];
        if (grp[i] === gFeed) { grp[i] = fdG[i]; gCount[gFeed] = Math.max(0, gCount[gFeed] - 1); if (fdG[i] >= 0) gCount[fdG[i]]++; }
      }
      fdr[i] = 0;
    }
    if (FEED.school >= 0 && FEED.school !== gRes) pickGroupTarget(FEED.school);
    FEED.school = -1;
  }
  function rehome() {
    FEED.farUsed = FEED.far;
    const fx = FEED.x, fz = FEED.z;
    for (let i = 0; i < N; i++) {
      if (fdr[i] !== 1) continue;
      if (grp[i] === gFeed) {
        const a = FEED.far + rr(-2.1, 2.1), r = rr(0.2, 0.55);
        hmX[i] = fx + Math.cos(a) * r; hmZ[i] = fz + Math.sin(a) * r;
        hmY[i] = floorAt(hmX[i], hmZ[i]) + rr(0.3, 0.45);
      } else if (spc[i] === SPW) pickWrasseTarget(i, fPlx, fPly, fPlz, 100);
    }
    if (FEED.school >= 0) { FEED.sX = fx + Math.cos(FEED.far) * 1.8; FEED.sZ = fz + Math.sin(FEED.far) * 1.8; FEED.sY = floorAt(FEED.sX, FEED.sZ) + 0.8; }
  }
  function setFeed(pos, on) {
    if (on) {
      if (!pos || !Number.isFinite(pos.x + pos.y + pos.z)) return;
      if (FEED.active && Math.hypot(pos.x - FEED.x, pos.z - FEED.z) > 3) releaseFeeders();
      FEED.x = pos.x; FEED.y = pos.y; FEED.z = pos.z;
      FEED.on = true;
      FEED.hold = 0;
      if (!FEED.active) takeFeeders();
    } else {
      FEED.on = false;
      FEED.hold = 14;
      if (FRAGS) for (let k = 0; k < FRAGS.length; k++) if ((FRAGS[k].x - FEED.x) ** 2 + (FRAGS[k].z - FEED.z) ** 2 < 4) fDone[k] = 1;
    }
  }

  function dispose() {
    if (root.parent) root.parent.remove(root);
    for (let k = 0; k < disposables.length; k++) if (disposables[k] && disposables[k].dispose) disposables[k].dispose();
    disposables.length = 0;
    D.active = false;
  }

  update(1 / 60, 0, null);
  function peekRise() {
    const pts = [];
    const gs = RZ.grp >= 0 ? RZ.grp : gDesc;
    for (let i = 0; i < N; i++) if (grp[i] === gs || i === RZ.g[0] || i === RZ.g[1]) pts.push([pX[i], pY[i], pZ[i], i === RZ.g[0] || i === RZ.g[1] ? 1 : 0]);
    return { on: RZ.on, placed: RZ.placed, dir: RZ.dir, grp: gs, school: [gX[gs], gY[gs], gZ[gs]], tgt: RZ.tgt.slice(), gt: RZ.gt.slice(), pts };
  }
  return { update, startDolphins, setCalm, setDescent, setDiver, setHose, setFeed, setKeepOut, dispose, group: root, setEntry, splash, setLensFrame, dolphinLead, entryFocus, entryStats, peekRise };
}

function createLife(opts = {}) {
  const threat = { on: false, x: 0, y: 0, z: 0, r: 0 };
  const life = createLifeCore(Object.assign({}, opts, { threat }));
  let rare = null;
  try {
    rare = createRare({
      root: life.group, patch: opts.patchMaterial, floorAt: opts.floorHeight, quality: opts.quality, fx: opts.fx,
      threat, spots: opts.spots, obstacles: opts.obstacles, solids: opts.solids,
    });
  } catch (e) { console.warn('[antikythera] rare animals unavailable:', e); }
  if (!rare) return life;
  const up = life.update, ko = life.setKeepOut, sd = life.setDescent, dp = life.dispose;
  let ok = true;
  life.update = (dt, t, pl) => {
    up(dt, t, pl);
    if (ok) { try { rare.update(dt, t, pl); } catch (e) { console.warn(e); ok = false; threat.on = false; } }
  };
  life.setKeepOut = (caps, n) => { ko(caps, n); rare.setKeepOut(caps, n); };
  life.setDescent = (...a) => { sd(...a); rare.setDescent(a[0], a[1]); };
  life.dispose = () => { rare.dispose(); dp(); };
  life.rare = rare;
  return life;
}

var life = Object.freeze({
  __proto__: null,
  createLife: createLife
});

