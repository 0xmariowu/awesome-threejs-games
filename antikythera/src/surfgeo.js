// surfgeo.js
const V3$2 = THREE.Vector3;

const _c$2 = new THREE.Color();
function lin(hex, k = 1) {
  _c$2.setHex(hex);
  return [_c$2.r * k, _c$2.g * k, _c$2.b * k];
}

class Builder {
  constructor(spec = {}) {
    this.spec = Object.assign({ color: 3 }, spec);
    this.keys = Object.keys(this.spec);
    this.defaults = { color: [1, 1, 1] };
    this.parts = [];
    this.nv = 0;
    this.ni = 0;
  }
  setDefault(name, v) { this.defaults[name] = v; return this; }
  add(geo, o = {}) {
    if (o.m) geo.applyMatrix4(o.m);
    if (!geo.attributes.normal) geo.computeVertexNormals();
    this.parts.push({ geo, o });
    this.nv += geo.attributes.position.count;
    this.ni += geo.index ? geo.index.count : geo.attributes.position.count;
    return this;
  }
  build() {
    const nv = this.nv;
    const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), uv = new Float32Array(nv * 2);
    const ex = this.keys.map((k) => new Float32Array(nv * this.spec[k]));
    const sizes = this.keys.map((k) => this.spec[k]);
    const idx = nv > 65535 ? new Uint32Array(this.ni) : new Uint16Array(this.ni);
    const p = new V3$2(), n = new V3$2(), t = new THREE.Vector2();
    let vo = 0, io = 0;
    for (const { geo, o } of this.parts) {
      const P = geo.attributes.position, N = geo.attributes.normal, U = geo.attributes.uv;
      const cnt = P.count;
      const su = o.uvs ? o.uvs[0] : 1, sv = o.uvs ? o.uvs[1] : 1;
      const srcs = this.keys.map((k) => (o[k] !== undefined ? o[k] : geo.attributes[k] ? geo.attributes[k] : this.defaults[k]));
      for (let i = 0; i < cnt; i++) {
        p.fromBufferAttribute(P, i);
        n.fromBufferAttribute(N, i);
        if (U) t.fromBufferAttribute(U, i); else t.set(0, 0);
        if (o.uvSwap) t.set(t.y, t.x);
        const j = vo + i;
        pos[j * 3] = p.x; pos[j * 3 + 1] = p.y; pos[j * 3 + 2] = p.z;
        nor[j * 3] = n.x; nor[j * 3 + 1] = n.y; nor[j * 3 + 2] = n.z;
        uv[j * 2] = t.x * su; uv[j * 2 + 1] = t.y * sv;
        for (let a = 0; a < sizes.length; a++) {
          let v = srcs[a];
          if (typeof v === 'function') v = v(p, n, t);
          const s = sizes[a], arr = ex[a];
          if (v === undefined || v === null) continue;
          if (v.isBufferAttribute) {
            const is = v.itemSize;
            for (let c = 0; c < s; c++) arr[j * s + c] = c < is ? v.array[i * is + c] : 0;
            continue;
          }
          if (typeof v === 'number') { arr[j * s] = v; for (let c = 1; c < s; c++) arr[j * s + c] = 0; }
          else for (let c = 0; c < s; c++) arr[j * s + c] = v[c] !== undefined ? v[c] : 0;
        }
      }
      if (geo.index) {
        const I = geo.index;
        for (let k = 0; k < I.count; k++) idx[io + k] = I.getX(k) + vo;
        io += I.count;
      } else {
        for (let k = 0; k < cnt; k++) idx[io + k] = vo + k;
        io += cnt;
      }
      vo += cnt;
      geo.dispose();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    this.keys.forEach((k, a) => g.setAttribute(k, new THREE.BufferAttribute(ex[a], this.spec[k])));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    g.computeBoundingSphere();
    g.computeBoundingBox();
    this.parts = [];
    return g;
  }
}

const _q$2 = new THREE.Quaternion(), _e$2 = new THREE.Euler(), _s$3 = new V3$2(1, 1, 1), _p$1 = new V3$2();
function mat(x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx, order = 'XYZ') {
  _e$2.set(rx, ry, rz, order);
  _q$2.setFromEuler(_e$2);
  _s$3.set(sx, sy, sz);
  _p$1.set(x, y, z);
  return new THREE.Matrix4().compose(_p$1, _q$2, _s$3);
}
const _up$1 = new V3$2(0, 1, 0), _d$2 = new V3$2();
function matAlong(a, b, sx = 1, sz = sx) {
  _d$2.subVectors(b, a);
  const len = _d$2.length();
  _q$2.setFromUnitVectors(_up$1, _d$2.multiplyScalar(1 / Math.max(len, 1e-9)));
  _s$3.set(sx, len, sz);
  _p$1.addVectors(a, b).multiplyScalar(0.5);
  return new THREE.Matrix4().compose(_p$1, _q$2, _s$3);
}

function sweep$1(points, opts) {
  const n = points.length, nk = opts.nk || 8;
  const T = [], N = [], B = [], S = [0];
  for (let i = 0; i < n; i++) {
    const a = points[Math.max(0, i - 1)], b = points[Math.min(n - 1, i + 1)];
    T.push(new V3$2().subVectors(b, a).normalize());
    if (i > 0) S.push(S[i - 1] + points[i].distanceTo(points[i - 1]));
  }
  const len = Math.max(S[n - 1], 1e-6);
  for (let i = 0; i < n; i++) {
    const t = T[i];
    let nn = opts.normals ? opts.normals[i].clone() : i === 0 ? (opts.up || new V3$2(0, 1, 0)).clone() : N[i - 1].clone();
    nn.addScaledVector(t, -nn.dot(t));
    if (nn.lengthSq() < 1e-10) {
      nn.set(Math.abs(t.y) < 0.9 ? 0 : 1, Math.abs(t.y) < 0.9 ? 1 : 0, 0);
      nn.addScaledVector(t, -nn.dot(t));
    }
    nn.normalize();
    N.push(nn);
    B.push(new V3$2().crossVectors(t, nn));
  }
  const capS = !!opts.capStart, capE = !!opts.capEnd;
  const ring = nk + 1;
  const total = n * ring + (capS ? nk + 1 : 0) + (capE ? nk + 1 : 0);
  const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3), uv = new Float32Array(total * 2);
  const idx = [];
  const o0 = [0, 0], o1 = [0, 0], o2 = [0, 0];
  const shape = opts.shape;
  for (let i = 0; i < n; i++) {
    const s = S[i] / len, P = points[i], Ni = N[i], Bi = B[i];
    for (let k = 0; k <= nk; k++) {
      const kk = k % nk;
      shape(s, kk, o0, i);
      shape(s, (kk + 1) % nk, o1, i);
      shape(s, (kk - 1 + nk) % nk, o2, i);
      const da = o1[0] - o2[0], db = o1[1] - o2[1];
      let na = db, nb = -da;
      const l = Math.hypot(na, nb) || 1;
      na /= l; nb /= l;
      const j = i * ring + k;
      pos[j * 3] = P.x + Ni.x * o0[0] + Bi.x * o0[1];
      pos[j * 3 + 1] = P.y + Ni.y * o0[0] + Bi.y * o0[1];
      pos[j * 3 + 2] = P.z + Ni.z * o0[0] + Bi.z * o0[1];
      nor[j * 3] = Ni.x * na + Bi.x * nb;
      nor[j * 3 + 1] = Ni.y * na + Bi.y * nb;
      nor[j * 3 + 2] = Ni.z * na + Bi.z * nb;
      uv[j * 2] = S[i];
      uv[j * 2 + 1] = k / nk;
    }
  }
  for (let i = 0; i < n - 1; i++) {
    for (let k = 0; k < nk; k++) {
      const a = i * ring + k, b = a + 1, c = a + ring, d = c + 1;
      idx.push(a, b, c, b, d, c);
    }
  }
  let base = n * ring;
  const cap = (i, sign) => {
    const P = points[i], Ni = N[i], Bi = B[i], t = T[i], s = S[i] / len;
    const c0 = base;
    pos[c0 * 3] = P.x; pos[c0 * 3 + 1] = P.y; pos[c0 * 3 + 2] = P.z;
    nor[c0 * 3] = t.x * sign; nor[c0 * 3 + 1] = t.y * sign; nor[c0 * 3 + 2] = t.z * sign;
    uv[c0 * 2] = S[i]; uv[c0 * 2 + 1] = 0.5;
    for (let k = 0; k < nk; k++) {
      shape(s, k, o0, i);
      const j = c0 + 1 + k;
      pos[j * 3] = P.x + Ni.x * o0[0] + Bi.x * o0[1];
      pos[j * 3 + 1] = P.y + Ni.y * o0[0] + Bi.y * o0[1];
      pos[j * 3 + 2] = P.z + Ni.z * o0[0] + Bi.z * o0[1];
      nor[j * 3] = t.x * sign; nor[j * 3 + 1] = t.y * sign; nor[j * 3 + 2] = t.z * sign;
      uv[j * 2] = S[i] + o0[0]; uv[j * 2 + 1] = o0[1];
    }
    for (let k = 0; k < nk; k++) {
      const a = c0 + 1 + k, b = c0 + 1 + ((k + 1) % nk);
      if (sign > 0) idx.push(c0, a, b); else idx.push(c0, b, a);
    }
    base += nk + 1;
  };
  if (capS) cap(0, -1);
  if (capE) cap(n - 1, 1);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.userData.length = len;
  return g;
}

function circle$1(r, nk) {
  const rf = typeof r === 'function' ? r : () => r;
  return (s, k, out) => {
    const a = (k / nk) * Math.PI * 2, rr = rf(s);
    out[0] = Math.cos(a) * rr;
    out[1] = Math.sin(a) * rr;
  };
}
function roundRect(hw, hh, cr, perCorner = 3) {
  const pts = [];
  const cs = [[hw - cr, hh - cr, 0], [-hw + cr, hh - cr, 1], [-hw + cr, -hh + cr, 2], [hw - cr, -hh + cr, 3]];
  for (const [cx, cy, q] of cs) {
    for (let i = 0; i <= perCorner; i++) {
      const a = (q + i / perCorner) * Math.PI * 0.5;
      pts.push([cx + Math.cos(a) * cr, cy + Math.sin(a) * cr]);
    }
  }
  const nk = pts.length;
  const f = (s, k, out) => { out[0] = pts[k][0]; out[1] = pts[k][1]; };
  f.nk = nk;
  return f;
}

function catenary(a, b, sag, n = 16) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const s = i / n;
    const p = new V3$2().lerpVectors(a, b, s);
    p.y -= sag * 4 * s * (1 - s);
    pts.push(p);
  }
  return pts;
}

function roundBox(w, h, d, r, inner = 2, bands = 4) {
  const half = [w / 2, h / 2, d / 2];
  const rr = Math.min(r, half[0] * 0.95, half[1] * 0.95, half[2] * 0.95);
  const coords = (a) => {
    const c = [];
    for (let i = 0; i <= bands; i++) c.push(-a + (rr * i) / bands);
    for (let i = 1; i < inner; i++) c.push(-a + rr + ((2 * (a - rr)) * i) / inner);
    for (let i = bands; i >= 0; i--) c.push(a - (rr * i) / bands);
    return c;
  };
  const C = [coords(half[0]), coords(half[1]), coords(half[2])];
  const pos = [], nor = [], uv = [], idx = [];
  const q = new V3$2(), p = new V3$2(), dn = new V3$2();
  const faces = [[0, 1, 1, 2], [0, -1, 2, 1], [1, 1, 2, 0], [1, -1, 0, 2], [2, 1, 0, 1], [2, -1, 1, 0]];
  for (const [a, s, b, c] of faces) {
    const base = pos.length / 3;
    const cb = C[b], cc = C[c];
    for (let i = 0; i < cb.length; i++) {
      for (let j = 0; j < cc.length; j++) {
        const v = [0, 0, 0];
        v[a] = s * half[a]; v[b] = cb[i]; v[c] = cc[j];
        p.set(v[0], v[1], v[2]);
        q.set(Math.max(-half[0] + rr, Math.min(half[0] - rr, p.x)),
          Math.max(-half[1] + rr, Math.min(half[1] - rr, p.y)),
          Math.max(-half[2] + rr, Math.min(half[2] - rr, p.z)));
        dn.subVectors(p, q);
        if (dn.lengthSq() < 1e-12) dn.set(a === 0 ? s : 0, a === 1 ? s : 0, a === 2 ? s : 0);
        dn.normalize();
        pos.push(q.x + dn.x * rr, q.y + dn.y * rr, q.z + dn.z * rr);
        nor.push(dn.x, dn.y, dn.z);
        uv.push(cb[i] + half[b], cc[j] + half[c]);
      }
    }
    const nc = cc.length;
    for (let i = 0; i < cb.length - 1; i++) {
      for (let j = 0; j < nc - 1; j++) {
        const i0 = base + i * nc + j, i1 = i0 + 1, i2 = i0 + nc, i3 = i2 + 1;
        idx.push(i0, i2, i1, i1, i2, i3);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

function lump(geo, f) {
  const P = geo.attributes.position, N = geo.attributes.normal;
  const p = new V3$2(), n = new V3$2();
  for (let i = 0; i < P.count; i++) {
    p.fromBufferAttribute(P, i);
    n.fromBufferAttribute(N, i);
    const d = f(p, n);
    P.setXYZ(i, p.x + n.x * d, p.y + n.y * d, p.z + n.z * d);
  }
  geo.computeVertexNormals();
  return geo;
}

class RopeBuilder {
  constructor() {
    this.pos = []; this.rib = []; this.rad = []; this.col = []; this.fol = []; this.swy = []; this.idx = [];
    this.n = 0;
  }
  add(points, radius, color, o = {}) {
    const n = points.length;
    if (n < 2) return this;
    const t = new V3$2();
    let total = 0;
    for (let i = 1; i < n; i++) total += points[i].distanceTo(points[i - 1]);
    let s = 0;
    for (let i = 0; i < n; i++) {
      const a = points[Math.max(0, i - 1)], b = points[Math.min(n - 1, i + 1)];
      t.subVectors(b, a).normalize();
      if (i > 0) s += points[i].distanceTo(points[i - 1]);
      const f = typeof o.follow === 'function' ? o.follow(s, i) : (o.follow || 0);
      const u = total > 0 ? s / total : 0;
      const sw = typeof o.swayFn === 'function' ? o.swayFn(u) : (o.sway ? 4.8 * u * (1 - u) * o.sway : 0);
      const p = points[i];
      for (let side = -1; side <= 1; side += 2) {
        this.pos.push(p.x, p.y, p.z);
        this.rib.push(t.x, t.y, t.z, side);
        this.rad.push(radius, s, o.twist !== undefined ? o.twist : 1);
        this.col.push(color[0], color[1], color[2]);
        this.fol.push(f);
        this.swy.push(sw);
      }
      if (i < n - 1) {
        const k = this.n + i * 2;
        this.idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
      }
    }
    this.n += n * 2;
    return this;
  }
  build() {
    const g = new THREE.BufferGeometry();
    const nrm = new Float32Array(this.n * 3);
    for (let i = 0; i < this.n; i++) nrm[i * 3 + 1] = 1;
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
    g.setAttribute('aRib', new THREE.Float32BufferAttribute(this.rib, 4));
    g.setAttribute('aRad', new THREE.Float32BufferAttribute(this.rad, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute('aFollow', new THREE.Float32BufferAttribute(this.fol, 1));
    g.setAttribute('aSway', new THREE.Float32BufferAttribute(this.swy, 1));
    g.setIndex(this.n > 65535 ? new THREE.BufferAttribute(new Uint32Array(this.idx), 1) : this.idx);
    g.computeBoundingSphere();
    return g;
  }
}

const ROPE_U = {
  uRbResY: { value: 1080 },
  uRbBowDelta: { value: new V3$2() },
  uRbSway: { value: new V3$2() },
  uRbSun: { value: new V3$2(0, 1, 0) },
  uRbKey: { value: new V3$2() },
};
const _rs$1 = new THREE.Vector2();
function trackResolution(mesh) {
  mesh.onBeforeRender = (renderer) => {
    const rt = renderer.getRenderTarget();
    ROPE_U.uRbResY.value = rt ? rt.height : renderer.getDrawingBufferSize(_rs$1).y;
  };
}

function ropeMaterial(o = {}) {
  const m = new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.9, metalness: 0, side: THREE.DoubleSide, alphaToCoverage: true,
  });
  const RU = { uRbMin: { value: o.min !== undefined ? o.min : 0.72 }, uRbFuzz: { value: o.fuzz || 0 } };
  m.userData.rb = RU;
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uRbResY = ROPE_U.uRbResY;
    shader.uniforms.uRbBowDelta = ROPE_U.uRbBowDelta;
    shader.uniforms.uRbSway = ROPE_U.uRbSway;
    shader.uniforms.uRbMin = RU.uRbMin;
    shader.uniforms.uRbFuzz = RU.uRbFuzz;
    shader.uniforms.uRbSun = ROPE_U.uRbSun;
    shader.uniforms.uRbKey = ROPE_U.uRbKey;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
attribute vec4 aRib;
attribute vec3 aRad;
attribute float aFollow;
attribute float aSway;
uniform float uRbResY;
uniform vec3 uRbBowDelta;
uniform vec3 uRbSway;
uniform float uRbMin;
varying vec3 vRbSide;
varying vec3 vRbView;
varying float vRbAcross;
varying float vRbCover;
varying float vRbAlong;
varying float vRbTwist;
varying float vRbPx;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
{
  vec3 rc = transformed + uRbBowDelta * aFollow + uRbSway * aSway;
  vec3 camObj = (inverse(modelViewMatrix) * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  float osc = max(length(modelViewMatrix[0].xyz), 1e-4);
  vec3 toCam = camObj - rc;
  vec3 tng = normalize(aRib.xyz);
  vec3 side = cross(tng, toCam);
  float sl = length(side);
  side = sl > 1e-6 ? side / sl : vec3(0.0, 1.0, 0.0);
  vec4 rv = modelViewMatrix * vec4(rc, 1.0);
  float zv = max(-rv.z, 0.01);
  float pix = 2.0 * zv / (projectionMatrix[1][1] * uRbResY) / osc;
  float hw = min(max(aRad.x, uRbMin * pix), aRad.x * 6.0);
  vRbCover = clamp(aRad.x / hw, 0.0, 1.0);
  vRbPx = hw / pix;
  transformed = rc + side * hw * aRib.w;
  vRbAcross = aRib.w;
  vRbSide = normalize((modelViewMatrix * vec4(side, 0.0)).xyz);
  vRbView = normalize(-rv.xyz);
  vRbAlong = aRad.y;
  vRbTwist = aRad.z;
}`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
uniform float uRbFuzz;
uniform vec3 uRbSun;
uniform vec3 uRbKey;
varying vec3 vRbSide;
varying vec3 vRbView;
varying float vRbAcross;
varying float vRbCover;
varying float vRbAlong;
varying float vRbTwist;
varying float vRbPx;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
{
  float ra = clamp(vRbAcross, -1.0, 1.0);
  float tf = 1.0 - smoothstep(0.3, 0.7, fwidth(vRbAlong) / 0.028);
  float strand = 0.5 + 0.5 * cos((vRbAlong / 0.028 + ra * 0.9) * 6.2831853);
  diffuseColor.rgb *= mix(1.0, 0.72 + 0.44 * strand, tf * vRbTwist);
  float fi = floor(vRbAlong * 1.7);
  float ff = fract(vRbAlong * 1.7);
  float fa = fract(sin(fi * 12.9898 + vRbTwist * 4.1) * 43758.5453);
  float fb = fract(sin((fi + 1.0) * 12.9898 + vRbTwist * 4.1) * 43758.5453);
  diffuseColor.rgb *= 0.86 + 0.26 * mix(fa, fb, ff * ff * (3.0 - 2.0 * ff));
  float soft = 1.0 / max(vRbPx, 1.0);
  float fz = uRbFuzz * (0.3 + 0.7 * fract(sin(floor(vRbAlong * 90.0) * 78.233 + floor(ra * 3.0)) * 43758.5453));
  float edge = 1.0 - smoothstep(1.0 - soft - 0.4 * fz, 1.0, abs(ra));
  float nearF = smoothstep(0.2, 0.7, length(vViewPosition));
  diffuseColor.a *= clamp(vRbCover * 1.15, 0.0, 1.0) * edge * nearF;
}`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
{
  float ra = clamp(vRbAcross, -1.0, 1.0);
  normal = normalize(vRbSide * ra + vRbView * sqrt(max(1.0 - ra * ra, 0.0)));
}`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
{
  vec3 rbL = normalize((viewMatrix * vec4(uRbSun, 0.0)).xyz);
  vec3 rbV = normalize(-vViewPosition);
  float rbLow = (1.0 - smoothstep(0.12, 0.4, normalize(uRbSun).y)) * smoothstep(-0.05, 0.02, normalize(uRbSun).y);
  float rbFr = pow(1.0 - clamp(abs(dot(normal, rbV)), 0.0, 1.0), 2.0);
  float rbBk = pow(max(dot(rbV, rbL), 0.0), 4.0);
  totalEmissiveRadiance += uRbKey * vec3(1.0, 0.72, 0.42) * rbFr * rbBk * rbLow * 0.4;
}`);
  };
  m.customProgramCacheKey = () => 'sg-rope-2';
  return m;
}

const GLSL_NOISE = `
float sgHash(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
float sgHash2(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float sgNoise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(sgHash(i), sgHash(i + vec3(1.0, 0.0, 0.0)), f.x),
                 mix(sgHash(i + vec3(0.0, 1.0, 0.0)), sgHash(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
             mix(mix(sgHash(i + vec3(0.0, 0.0, 1.0)), sgHash(i + vec3(1.0, 0.0, 1.0)), f.x),
                 mix(sgHash(i + vec3(0.0, 1.0, 1.0)), sgHash(i + vec3(1.0, 1.0, 1.0)), f.x), f.y), f.z);
}
float sgNoise2(vec2 x) {
  vec2 i = floor(x);
  vec2 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(sgHash2(i), sgHash2(i + vec2(1.0, 0.0)), f.x),
             mix(sgHash2(i + vec2(0.0, 1.0)), sgHash2(i + vec2(1.0, 1.0)), f.x), f.y);
}
float sgFbm(vec3 p) {
  float s = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) { s += a * sgNoise(p); p = p * 2.03 + vec3(1.7, 9.2, 3.1); a *= 0.5; }
  return s / 0.9375;
}
float sgFbm2(vec2 p) {
  float s = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) { s += a * sgNoise2(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; }
  return s / 0.9375;
}
vec3 sgBump(vec3 pos, vec3 nrm, float h, float fd) {
  vec3 sx = dFdx(pos);
  vec3 sy = dFdy(pos);
  vec3 r1 = cross(sy, nrm);
  vec3 r2 = cross(nrm, sx);
  float det = dot(sx, r1) * fd;
  vec3 g = sign(det) * (dFdx(h) * r1 + dFdy(h) * r2);
  vec3 r = abs(det) * nrm - g;
  return dot(r, r) > 1e-30 ? normalize(r) : nrm;
}
`;

const DIR_TARGET = 'getDirectionalLightInfo( directionalLight, directLight );';

const HAZE_U = {
  uSgSunBlend: { value: 0 },
};
const NIGHT_U = { uSgNight: { value: 0 } };

const SUN_A = new V3$2(-0.9355, 0.0958, 0.3407).normalize();
const SUN_B = new V3$2(0.30, 0.56, -0.77).normalize();
const _ab = new V3$2().subVectors(SUN_B, SUN_A);
const _ab2 = _ab.lengthSq();
const _t = new V3$2();
function sunBlend(sunDir) {
  _t.subVectors(sunDir, SUN_A);
  return Math.min(1, Math.max(0, _t.dot(_ab) / _ab2));
}
const SUN_TITLE$1 = SUN_A;
const SUN_FINALE = SUN_B;

