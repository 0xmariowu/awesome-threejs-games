// wreck.js
const TAU$8 = Math.PI * 2;
const UP = [0, 1, 0];
const smax$1 = (a, b, k) => -smin$2(-a, -b, k);
const fmt = (x) => { const s = String(Math.round(x * 1e5) / 1e5); return /[.e]/.test(s) ? s : s + '.0'; };
const CUR = [0.8, 0, 0.6];
const SITE = { shelters: [], den: -1, sponges: [] };

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const mad = (a, b, s) => [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
function perp(n) {
  const t1 = norm(cross(Math.abs(n[1]) < 0.9 ? UP : [1, 0, 0], n));
  return [t1, cross(n, t1)];
}

const qAxis = (ax, ang) => { const n = norm(ax), s = Math.sin(ang / 2); return [n[0] * s, n[1] * s, n[2] * s, Math.cos(ang / 2)]; };
const qConj = (q) => [-q[0], -q[1], -q[2], q[3]];
function qMul(a, b) {
  return [
    a[0] * b[3] + a[3] * b[0] + a[1] * b[2] - a[2] * b[1],
    a[1] * b[3] + a[3] * b[1] + a[2] * b[0] - a[0] * b[2],
    a[2] * b[3] + a[3] * b[2] + a[0] * b[1] - a[1] * b[0],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
  ];
}
function qRot(q, v) {
  const tx = 2 * (q[1] * v[2] - q[2] * v[1]), ty = 2 * (q[2] * v[0] - q[0] * v[2]), tz = 2 * (q[0] * v[1] - q[1] * v[0]);
  return [v[0] + q[3] * tx + q[1] * tz - q[2] * ty, v[1] + q[3] * ty + q[2] * tx - q[0] * tz, v[2] + q[3] * tz + q[0] * ty - q[1] * tx];
}
function qNorm(q) { const l = Math.hypot(q[0], q[1], q[2], q[3]) || 1; return [q[0] / l, q[1] / l, q[2] / l, q[3] / l]; }
function qFromTo(u, v) {
  const r = dot(u, v) + 1;
  if (r < 1e-8) return qNorm(Math.abs(u[0]) > Math.abs(u[2]) ? [-u[1], u[0], 0, 0] : [0, -u[2], u[1], 0]);
  return qNorm([u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0], r]);
}
function qBasis(x, y, z) {
  const m11 = x[0], m21 = x[1], m31 = x[2], m12 = y[0], m22 = y[1], m32 = y[2], m13 = z[0], m23 = z[1], m33 = z[2];
  const tr = m11 + m22 + m33;
  let s;
  if (tr > 0) { s = 0.5 / Math.sqrt(tr + 1); return qNorm([(m32 - m23) * s, (m13 - m31) * s, (m21 - m12) * s, 0.25 / s]); }
  if (m11 > m22 && m11 > m33) { s = 2 * Math.sqrt(1 + m11 - m22 - m33); return qNorm([0.25 * s, (m12 + m21) / s, (m13 + m31) / s, (m32 - m23) / s]); }
  if (m22 > m33) { s = 2 * Math.sqrt(1 + m22 - m11 - m33); return qNorm([(m12 + m21) / s, 0.25 * s, (m23 + m32) / s, (m13 - m31) / s]); }
  s = 2 * Math.sqrt(1 + m33 - m11 - m22);
  return qNorm([(m13 + m31) / s, (m23 + m32) / s, 0.25 * s, (m21 - m12) / s]);
}
const xp = (x, v) => add(x.p, qRot(x.q, mul(v, x.s === undefined ? 1 : x.s)));
function compose(out, o, p, q, s) {
  const [x, y, z, w] = q, sx = Array.isArray(s) ? s[0] : s, sy = Array.isArray(s) ? s[1] : s, sz = Array.isArray(s) ? s[2] : s;
  const x2 = x + x, y2 = y + y, z2 = z + z, xx = x * x2, xy = x * y2, xz = x * z2, yy = y * y2, yz = y * z2, zz = z * z2;
  const wx = w * x2, wy = w * y2, wz = w * z2;
  out[o] = (1 - (yy + zz)) * sx; out[o + 1] = (xy + wz) * sx; out[o + 2] = (xz - wy) * sx; out[o + 3] = 0;
  out[o + 4] = (xy - wz) * sy; out[o + 5] = (1 - (xx + zz)) * sy; out[o + 6] = (yz + wx) * sy; out[o + 7] = 0;
  out[o + 8] = (xz + wy) * sz; out[o + 9] = (yz - wx) * sz; out[o + 10] = (1 - (xx + yy)) * sz; out[o + 11] = 0;
  out[o + 12] = p[0]; out[o + 13] = p[1]; out[o + 14] = p[2]; out[o + 15] = 1;
}

const TG_SEG = 360, TG_HALF = 150, TG_AA = 0.45;
const TG_X = (() => {
  const xs = new Float64Array(TG_SEG + 1);
  for (let i = 0; i <= TG_SEG; i++) { const u = -1 + (2 * i) / TG_SEG; xs[i] = TG_HALF * (TG_AA * u + (1 - TG_AA) * u * u * u); }
  return xs;
})();
const tgCache = new Map();
function tgH(i, j) {
  const k = i * 4096 + j;
  let h = tgCache.get(k);
  if (h === undefined) { h = floorHeight(TG_X[i], TG_X[j]); tgCache.set(k, h); }
  return h;
}
function tgCell(v) {
  if (v <= TG_X[0]) return 0;
  if (v >= TG_X[TG_SEG]) return TG_SEG - 1;
  let lo = 0, hi = TG_SEG;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (TG_X[m] <= v) lo = m; else hi = m; }
  return lo;
}
function terrainY(x, z) {
  const i = tgCell(x), j = tgCell(z);
  const fx = (x - TG_X[i]) / (TG_X[i + 1] - TG_X[i]), fz = (z - TG_X[j]) / (TG_X[j + 1] - TG_X[j]);
  if (fx + fz <= 1) { const a = tgH(i, j); return a + (tgH(i + 1, j) - a) * fx + (tgH(i, j + 1) - a) * fz; }
  const d = tgH(i + 1, j + 1);
  return d + (tgH(i, j + 1) - d) * (1 - fx) + (tgH(i + 1, j) - d) * (1 - fz);
}
function terrainN(x, z) {
  const e = 0.3;
  return norm([terrainY(x - e, z) - terrainY(x + e, z), 2 * e, terrainY(x, z - e) - terrainY(x, z + e)]);
}
function clearOf(x, z, pad = 0) {
  for (const f of LAYOUT.frags) if (Math.hypot(x - f.x, z - f.z) < 2.5 + pad) return false;
  return Math.hypot(x - LAYOUT.assembly.x, z - LAYOUT.assembly.z) >= 6 + pad;
}

class MB {
  constructor(spec = {}) {
    this.spec = spec;
    this.P = []; this.N = []; this.I = []; this.A = {};
    for (const k in spec) this.A[k] = [];
  }
  get count() { return this.P.length / 3; }
  v(p, n, a) {
    this.P.push(p[0], p[1], p[2]);
    this.N.push(n[0], n[1], n[2]);
    for (const k in this.spec) {
      const sz = this.spec[k], val = a[k], arr = this.A[k];
      if (sz === 1) arr.push(val); else for (let i = 0; i < sz; i++) arr.push(val[i]);
    }
    return this.P.length / 3 - 1;
  }
  tri(a, b, c) { this.I.push(a, b, c); }
  quad(a, b, c, d) { this.I.push(a, b, c, a, c, d); }
  fixWinding(i0 = 0) {
    const P = this.P, N = this.N, I = this.I;
    for (let t = i0; t < I.length; t += 3) {
      const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3;
      const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2];
      const vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
      const fx = uy * vz - uz * vy, fy = uz * vx - ux * vz, fz = ux * vy - uy * vx;
      if (fx * (N[a] + N[b] + N[c]) + fy * (N[a + 1] + N[b + 1] + N[c + 1]) + fz * (N[a + 2] + N[b + 2] + N[c + 2]) < 0) {
        const tmp = I[t + 1]; I[t + 1] = I[t + 2]; I[t + 2] = tmp;
      }
    }
  }
  smooth(v0 = 0, i0 = 0) {
    const P = this.P, N = this.N, I = this.I, s0 = v0 * 3;
    for (let i = s0; i < N.length; i++) N[i] = 0;
    for (let t = i0; t < I.length; t += 3) {
      const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3;
      const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2];
      const vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
      const fx = uy * vz - uz * vy, fy = uz * vx - ux * vz, fz = ux * vy - uy * vx;
      if (a >= s0) { N[a] += fx; N[a + 1] += fy; N[a + 2] += fz; }
      if (b >= s0) { N[b] += fx; N[b + 1] += fy; N[b + 2] += fz; }
      if (c >= s0) { N[c] += fx; N[c + 1] += fy; N[c + 2] += fz; }
    }
    for (let i = s0; i < N.length; i += 3) {
      const l = Math.hypot(N[i], N[i + 1], N[i + 2]);
      if (l > 0) { N[i] /= l; N[i + 1] /= l; N[i + 2] /= l; } else N[i + 1] = 1;
    }
  }
  append(o, xf, extra = {}) {
    const base = this.count;
    for (let i = 0; i < o.count; i++) {
      const lp = [o.P[i * 3], o.P[i * 3 + 1], o.P[i * 3 + 2]], ln = [o.N[i * 3], o.N[i * 3 + 1], o.N[i * 3 + 2]];
      const wp = xf ? xp(xf, lp) : lp, a = {};
      for (const k in this.spec) {
        if (k in extra) a[k] = typeof extra[k] === 'function' ? extra[k](i, lp, wp) : extra[k];
        else { const sz = this.spec[k]; a[k] = sz === 1 ? o.A[k][i] : o.A[k].slice(i * sz, i * sz + sz); }
      }
      this.v(wp, xf ? qRot(xf.q, ln) : ln, a);
    }
    for (let t = 0; t < o.I.length; t++) this.I.push(o.I[t] + base);
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.P, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.N, 3));
    for (const k in this.spec) g.setAttribute(k, new THREE.Float32BufferAttribute(this.A[k], this.spec[k]));
    g.setIndex(this.I);
    g.computeBoundingSphere();
    return g;
  }
}

function crSample(pts, perSeg) {
  const n = pts.length, dim = pts[0].length, out = [];
  const P = (i) => {
    if (i < 0) return pts[0].map((v, k) => 2 * v - pts[1][k]);
    if (i >= n) return pts[n - 1].map((v, k) => 2 * v - pts[n - 2][k]);
    return pts[i];
  };
  const kn = (a, b) => { let s = 0; for (let k = 0; k < dim; k++) s += (a[k] - b[k]) ** 2; return Math.sqrt(Math.sqrt(s)) || 1e-4; };
  for (let i = 0; i < n - 1; i++) {
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
    const t1 = kn(p0, p1), t2 = t1 + kn(p1, p2), t3 = t2 + kn(p2, p3);
    for (let s = 0; s < perSeg; s++) {
      const t = t1 + (t2 - t1) * (s / perSeg), q = new Array(dim);
      for (let k = 0; k < dim; k++) {
        const a1 = ((t1 - t) * p0[k] + t * p1[k]) / t1;
        const a2 = ((t2 - t) * p1[k] + (t - t1) * p2[k]) / (t2 - t1);
        const a3 = ((t3 - t) * p2[k] + (t - t2) * p3[k]) / (t3 - t2);
        const b1 = ((t2 - t) * a1 + t * a2) / t2;
        const b2 = ((t3 - t) * a2 + (t - t1) * a3) / (t3 - t1);
        q[k] = ((t2 - t) * b1 + (t - t1) * b2) / (t2 - t1);
      }
      out.push(q);
    }
  }
  out.push(pts[n - 1].slice());
  return out;
}
function pathNormals(pts) {
  return pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const dr = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dr, dy) || 1;
    return { r: p[0], y: p[1], nr: dy / l, ny: -dr / l };
  });
}
function makeProfile$1(ctrl) {
  const pts = crSample(ctrl, 10), n = pts.length, nrm = pathNormals(pts), cum = [0];
  for (let i = 1; i < n; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const total = cum[n - 1];
  const at = (t) => {
    const s = clamp$9(t, 0, 1) * total;
    let lo = 0, hi = n - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cum[m] <= s) lo = m; else hi = m; }
    const f = cum[hi] > cum[lo] ? (s - cum[lo]) / (cum[hi] - cum[lo]) : 0, A = nrm[lo], B = nrm[hi];
    const nr = A.nr + (B.nr - A.nr) * f, ny = A.ny + (B.ny - A.ny) * f, l = Math.hypot(nr, ny) || 1;
    return { r: A.r + (B.r - A.r) * f, y: A.y + (B.y - A.y) * f, nr: nr / l, ny: ny / l, tr: -ny / l, ty: nr / l };
  };
  const adaptive = (maxLen = 0.02, maxTurn = 0.1) => {
    maxLen *= PROF_K; maxTurn *= PROF_K;
    const ts = [0];
    let last = 0, turn = 0;
    for (let i = 1; i < n - 1; i++) {
      let da = Math.abs(Math.atan2(nrm[i].ny, nrm[i].nr) - Math.atan2(nrm[i - 1].ny, nrm[i - 1].nr));
      if (da > Math.PI) da = TAU$8 - da;
      turn += da;
      if (turn >= maxTurn || cum[i] - last >= maxLen) { ts.push(cum[i] / total); last = cum[i]; turn = 0; }
    }
    ts.push(1);
    return ts;
  };
  const tAtY = (yy) => { for (let i = 0; i < n; i++) if (pts[i][1] >= yy) return cum[i] / total; return 1; };
  return { at, adaptive, tAtY, total };
}
let LATHE_K = 1;
let PROF_K = 1;
function lathe$1(mb, path, segs, attrFn, disp) {
  segs = Math.max(8, Math.round(segs * LATHE_K));
  const v0 = mb.count, i0 = mb.I.length;
  for (let i = 0; i < path.length; i++) {
    const p = path[i];
    for (let j = 0; j < segs; j++) {
      const ph = (j / segs) * TAU$8, c = Math.cos(ph), s = Math.sin(ph);
      const r = p.r + (disp ? disp(ph, p, i) : 0), pos = [r * c, p.y, r * s];
      mb.v(pos, [p.nr * c, p.ny, p.nr * s], attrFn(p, pos, ph, i));
    }
  }
  for (let i = 0; i < path.length - 1; i++) {
    for (let j = 0; j < segs; j++) {
      const a = v0 + i * segs + j, b = v0 + i * segs + ((j + 1) % segs);
      mb.quad(a, a + segs, b + segs, b);
    }
  }
  mb.fixWinding(i0);
  return { v0, i0 };
}
function sweepRings(mb, rings, capA, capB) {
  const v0 = mb.count, i0 = mb.I.length, m = rings[0].pts.length;
  const idx = rings.map((r) => r.pts.map((p, k) => mb.v(p, norm(sub(p, r.c)), r.attrs[k])));
  for (let i = 0; i < rings.length - 1; i++) {
    for (let k = 0; k < m; k++) {
      const k2 = (k + 1) % m;
      mb.quad(idx[i][k], idx[i + 1][k], idx[i + 1][k2], idx[i][k2]);
    }
  }
  const cap = (r, prev) => {
    const dir = norm(sub(r.c, prev.c));
    const ci = mb.v(mad(r.c, dir, r.tip || 0), dir, r.attrs[0]);
    const ring = r.pts.map((p, k) => mb.v(p, dir, r.attrs[k]));
    for (let k = 0; k < m; k++) mb.tri(ci, ring[k], ring[(k + 1) % m]);
  };
  if (capA) cap(rings[0], rings[1]);
  if (capB) cap(rings[rings.length - 1], rings[rings.length - 2]);
  mb.fixWinding(i0);
  mb.smooth(v0, i0);
}
function sweep(mb, ctrl, radius, nRad, perSeg, attr, capA = false, capB = false, tipB = 0, ov = null) {
  const pts = crSample(ctrl, perSeg), n = pts.length, oF = ov ? ov[0] : 1, oB = ov ? ov[1] : 1;
  const T = pts.map((p, i) => norm(sub(pts[Math.min(n - 1, i + 1)], pts[Math.max(0, i - 1)])));
  const ref = Math.abs(T[0][1]) < 0.9 ? UP : [1, 0, 0];
  const F = [norm(sub(ref, mul(T[0], dot(ref, T[0]))))];
  for (let i = 1; i < n; i++) F.push(norm(sub(F[i - 1], mul(T[i], dot(F[i - 1], T[i])))));
  const rings = pts.map((c, i) => {
    const u = i / (n - 1), r = radius(u), B = cross(T[i], F[i]), rp = [], ra = [];
    for (let j = 0; j < nRad; j++) {
      const a = (j / nRad) * TAU$8, p = mad(c, add(mul(F[i], Math.cos(a) * oF), mul(B, Math.sin(a) * oB)), r);
      rp.push(p); ra.push(attr(u, p));
    }
    return { pts: rp, attrs: ra, c };
  });
  rings[n - 1].tip = tipB;
  sweepRings(mb, rings, capA, capB);
  return pts;
}
function splinter(rings, rng, amt) {
  for (const [r, prev] of [[rings[0], rings[1]], [rings[rings.length - 1], rings[rings.length - 2]]]) {
    const dir = norm(sub(r.c, prev.c));
    let sum = 0;
    r.pts = r.pts.map((p) => { const k = rng(), d = amt * k * k * (1.4 - 0.4 * k); sum += d; return mad(p, dir, d); });
    r.tip = (sum / Math.max(1, r.pts.length)) * 1.05;
  }
}
function box8(mb, P, hx, hy, hz, attr) {
  const v0 = mb.count, i0 = mb.I.length, c = P(0, 0, 0);
  const F = [
    [[1, -1, -1], [1, 1, -1], [1, 1, 1], [1, -1, 1]], [[-1, -1, -1], [-1, -1, 1], [-1, 1, 1], [-1, 1, -1]],
    [[-1, 1, -1], [-1, 1, 1], [1, 1, 1], [1, 1, -1]], [[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1]],
    [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]], [[-1, -1, -1], [-1, 1, -1], [1, 1, -1], [1, -1, -1]],
  ];
  for (const f of F) {
    const pts = f.map(([a, b, d]) => P(a * hx, b * hy, d * hz));
    const n = norm(sub(mul(add(add(pts[0], pts[1]), add(pts[2], pts[3])), 0.25), c));
    const id = pts.map((p, k) => mb.v(p, n, attr(f[k][0] * hx, f[k][1] * hy, f[k][2] * hz, p)));
    mb.quad(id[0], id[1], id[2], id[3]);
  }
  mb.fixWinding(i0);
  mb.smooth(v0, i0);
}
function plaque(mb, c, u, v, n, hu, hv, attr) {
  const H = 0.0015, NS = 28, i0 = mb.I.length, ol = [];
  for (let k = 0; k < NS; k++) {
    const a = (k / NS) * TAU$8, ca = Math.cos(a), sa = Math.sin(a);
    ol.push([Math.sign(ca) * Math.pow(Math.abs(ca), 0.3), Math.sign(sa) * Math.pow(Math.abs(sa), 0.3)]);
  }
  const vert = (x, y, h, nn, top) => { const p = add(add(add(c, mul(u, x * hu)), mul(v, y * hv)), mul(n, h)); return mb.v(p, nn, attr(x, y, top, p)); };
  const ctr = vert(0, 0, H, n, 1);
  const r1 = ol.map(([x, y]) => vert(x * 0.5, y * 0.5, H, n, 1));
  const r2 = ol.map(([x, y]) => vert(x * 0.92, y * 0.92, H, n, 1));
  for (let k = 0; k < NS; k++) {
    const k2 = (k + 1) % NS;
    mb.tri(ctr, r1[k], r1[k2]);
    mb.quad(r1[k], r2[k], r2[k2], r1[k2]);
  }
  const s0 = mb.count, si0 = mb.I.length;
  const side = (x, y) => norm(add(add(mul(u, x), mul(v, (y * hu) / hv)), mul(n, 0.3)));
  const e1 = ol.map(([x, y]) => vert(x * 0.92, y * 0.92, H, side(x, y), 0));
  const e2 = ol.map(([x, y]) => vert(x, y, H * 0.3, side(x, y), 0));
  const e3 = ol.map(([x, y]) => vert(x * 1.03, y * 1.03, -45e-4, side(x, y), 0));
  for (let k = 0; k < NS; k++) {
    const k2 = (k + 1) % NS;
    mb.quad(e1[k], e2[k], e2[k2], e1[k2]);
    mb.quad(e2[k], e3[k], e3[k2], e2[k2]);
  }
  mb.fixWinding(i0);
  mb.smooth(s0, si0);
}

function segSegDist2(p1, q1, p2, q2) {
  const d1 = sub(q1, p1), d2 = sub(q2, p2), r = sub(p1, p2);
  const a = dot(d1, d1), e = dot(d2, d2), f = dot(d2, r);
  let s = 0, t = 0;
  if (a <= 1e-9 && e <= 1e-9) return dot(r, r);
  if (a <= 1e-9) t = clamp$9(f / e, 0, 1);
  else {
    const c = dot(d1, r);
    if (e <= 1e-9) s = clamp$9(-c / a, 0, 1);
    else {
      const b = dot(d1, d2), den = a * e - b * b;
      s = den > 1e-12 ? clamp$9((b * f - c * e) / den, 0, 1) : 0;
      t = (b * s + f) / e;
      if (t < 0) { t = 0; s = clamp$9(-c / a, 0, 1); } else if (t > 1) { t = 1; s = clamp$9((b - c) / a, 0, 1); }
    }
  }
  const d = sub(mad(p1, d1, s), mad(p2, d2, t));
  return dot(d, d);
}
function segDistXZ(x, z, a, b) {
  const abx = b[0] - a[0], abz = b[2] - a[2], l2 = abx * abx + abz * abz;
  const t = l2 > 1e-9 ? clamp$9(((x - a[0]) * abx + (z - a[2]) * abz) / l2, 0, 1) : 0;
  return Math.hypot(x - a[0] - abx * t, z - a[2] - abz * t);
}
class Proxies {
  constructor(cell = 0.8) { this.cell = cell; this.map = new Map(); }
  _cells(x0, x1, z0, z1, fn) {
    const c = this.cell;
    for (let i = Math.floor(x0 / c); i <= Math.floor(x1 / c); i++) {
      for (let j = Math.floor(z0 / c); j <= Math.floor(z1 / c); j++) fn(i * 8192 + j);
    }
  }
  add(cap) {
    const r = cap.r;
    this._cells(Math.min(cap.a[0], cap.b[0]) - r, Math.max(cap.a[0], cap.b[0]) + r, Math.min(cap.a[2], cap.b[2]) - r, Math.max(cap.a[2], cap.b[2]) + r, (k) => {
      let l = this.map.get(k);
      if (!l) this.map.set(k, (l = []));
      l.push(cap);
    });
  }
  hits(caps, lift) {
    for (const cp of caps) {
      const a = [cp.a[0], cp.a[1] + lift, cp.a[2]], b = [cp.b[0], cp.b[1] + lift, cp.b[2]], r = cp.r;
      let hit = false;
      this._cells(Math.min(a[0], b[0]) - r - 0.2, Math.max(a[0], b[0]) + r + 0.2, Math.min(a[2], b[2]) - r - 0.2, Math.max(a[2], b[2]) + r + 0.2, (k) => {
        if (hit) return;
        const l = this.map.get(k);
        if (l) for (const o of l) { const rr = r + o.r; if (segSegDist2(a, b, o.a, o.b) < rr * rr) { hit = true; break; } }
      });
      if (hit) return true;
    }
    return false;
  }
  topAt(x, z, rad) {
    let top = -Infinity;
    this._cells(x - rad - 0.3, x + rad + 0.3, z - rad - 0.3, z + rad + 0.3, (k) => {
      const l = this.map.get(k);
      if (!l) return;
      for (const o of l) {
        const abx = o.b[0] - o.a[0], abz = o.b[2] - o.a[2], l2 = abx * abx + abz * abz;
        const t = l2 > 1e-9 ? clamp$9(((x - o.a[0]) * abx + (z - o.a[2]) * abz) / l2, 0, 1) : 0;
        if (Math.hypot(x - o.a[0] - abx * t, z - o.a[2] - abz * t) < rad + o.r) top = Math.max(top, o.a[1] + (o.b[1] - o.a[1]) * t + o.r);
      }
    });
    return top;
  }
  surfAt(x, z) {
    let top = -Infinity;
    const l = this.map.get(Math.floor(x / this.cell) * 8192 + Math.floor(z / this.cell));
    if (!l) return top;
    for (const o of l) {
      if (!o.sup) continue;
      const abx = o.b[0] - o.a[0], abz = o.b[2] - o.a[2], l2 = abx * abx + abz * abz, r = o.rs || o.r;
      const t = l2 > 1e-9 ? clamp$9(((x - o.a[0]) * abx + (z - o.a[2]) * abz) / l2, 0, 1) : 0;
      const dx = x - o.a[0] - abx * t, dz = z - o.a[2] - abz * t, d2 = dx * dx + dz * dz;
      if (d2 < r * r) top = Math.max(top, o.a[1] + (o.b[1] - o.a[1]) * t + Math.sqrt(r * r - d2));
    }
    return top;
  }
  nearXZ(x, z, r) {
    let hit = false;
    this._cells(x - r - 0.3, x + r + 0.3, z - r - 0.3, z + r + 0.3, (k) => {
      if (hit) return;
      const l = this.map.get(k);
      if (l) for (const o of l) if (segDistXZ(x, z, o.a, o.b) < r + o.r) { hit = true; break; }
    });
    return hit;
  }
}

const RH_OUT = [
  [0.000, 0.000], [0.011, 0.001], [0.020, 0.006], [0.0245, 0.016], [0.0225, 0.026], [0.0185, 0.036],
  [0.019, 0.055], [0.022, 0.080], [0.033, 0.104], [0.056, 0.135], [0.086, 0.175], [0.116, 0.228],
  [0.140, 0.292], [0.156, 0.362], [0.164, 0.430], [0.165, 0.480], [0.160, 0.530], [0.148, 0.572],
  [0.128, 0.606], [0.100, 0.632], [0.074, 0.652], [0.058, 0.672], [0.051, 0.705], [0.048, 0.760],
  [0.047, 0.800], [0.048, 0.830], [0.052, 0.846], [0.0595, 0.854], [0.0625, 0.864], [0.059, 0.873], [0.052, 0.8765],
];
const RH_IN = [[0.052, 0.8765], [0.045, 0.875], [0.0405, 0.866], [0.0385, 0.84], [0.0375, 0.79], [0.0375, 0.74], [0.039, 0.70], [0.032, 0.668], [0.016, 0.66], [0.0, 0.658]];
const RH_HANDLE = [[0.042, 0.792], [0.058, 0.803], [0.077, 0.820], [0.093, 0.830], [0.106, 0.826], [0.115, 0.806], [0.119, 0.770], [0.121, 0.720], [0.124, 0.668], [0.126, 0.630], [0.119, 0.598]];
const KO_OUT = [
  [0.000, 0.000], [0.012, 0.001], [0.022, 0.007], [0.0255, 0.020], [0.022, 0.032], [0.0195, 0.046],
  [0.020, 0.075], [0.026, 0.100], [0.040, 0.125], [0.066, 0.160], [0.095, 0.212], [0.120, 0.280],
  [0.137, 0.355], [0.146, 0.430], [0.149, 0.500], [0.148, 0.548], [0.143, 0.572], [0.130, 0.588], [0.100, 0.602],
  [0.072, 0.615], [0.054, 0.632], [0.047, 0.670], [0.044, 0.740], [0.044, 0.800], [0.046, 0.835], [0.051, 0.852],
  [0.0565, 0.862], [0.056, 0.871], [0.049, 0.8745],
];
const KO_IN = [[0.049, 0.8745], [0.042, 0.873], [0.038, 0.862], [0.037, 0.82], [0.037, 0.74], [0.038, 0.68], [0.03, 0.645], [0.014, 0.638], [0.0, 0.636]];
const KO_HANDLE = [[0.041, 0.842], [0.060, 0.855], [0.080, 0.856], [0.097, 0.842], [0.107, 0.810], [0.112, 0.750], [0.117, 0.680], [0.122, 0.618], [0.118, 0.590]];
let PROFS = null;
const profiles = () => PROFS || (PROFS = [makeProfile$1(RH_OUT), makeProfile$1(KO_OUT)]);

const AMPH_CAPS = [[[0, -0.23, 0], [0, 0.1, 0], 0.155], [[0, -0.42, 0], [0, -0.24, 0], 0.04], [[0, 0.16, 0], [0, 0.44, 0], 0.1]];
const BROKEN_CAPS = [[[0, -0.23, 0], [0, 0.06, 0], 0.155], [[0, -0.42, 0], [0, -0.24, 0], 0.04]];

function stampOn(mb, pts, sx, at, off = 0.0135 * 0.9) {
  let pk = 0;
  for (let i = 1; i < pts.length; i++) if (pts[i][1] > pts[pk][1]) pk = i;
  let u = norm(sub(pts[Math.min(pts.length - 1, pk + 1)], pts[Math.max(0, pk - 1)]));
  if (u[0] * sx < 0) u = mul(u, -1);
  const v = [0, 0, -sx], n = norm(cross(u, v));
  plaque(mb, mad(pts[pk], n, off), u, v, n, 0.017, 0.0075, (x, y, top, p) => at(p, 2, top, x, y));
}
const HANDLE = [{ rad: 0.0165, ov: [0.82, 1.18] }, { rad: 0.0098, ov: [0.92, 1.08] }];
const handleR = (rad, cut) => (u) => rad * (1 + 0.85 * Math.exp(-u * 9) + (cut ? 0 : 0.75 * Math.exp(-(1 - u) * 8)));
function handlesOn(mb, kind, at, cut = 0) {
  const R = kind === 0, { rad, ov } = HANDLE[R ? 0 : 1];
  for (const sx of [-1, 1]) {
    for (const oz of R ? [0] : [-92e-4, 0.0092]) {
      let ctrl = (R ? RH_HANDLE : KO_HANDLE).map(([r, y]) => [sx * r, y - 0.42, oz]);
      if (cut) ctrl = ctrl.slice(0, ctrl.length - cut);
      const pts = sweep(mb, ctrl, handleR(rad, cut), R ? 10 : 7, 4, (u, p) => at(p, 1, u), false, cut > 0, cut ? rad * 0.5 : 0, ov);
      if (R) stampOn(mb, pts, sx, at, rad * ov[0] * 0.9);
    }
  }
}
const COM_WHOLE = [0, -0.03, 0], COM_BROKEN = [0, -0.1, 0];
function handleOne(mb, kind, at, sx) {
  const R = kind === 0, { rad, ov } = HANDLE[R ? 0 : 1];
  for (const oz of R ? [0] : [-92e-4, 0.0092]) {
    const ctrl = (R ? RH_HANDLE : KO_HANDLE).map(([r, y]) => [sx * r, y - 0.42, oz]);
    const pts = sweep(mb, ctrl, handleR(rad, 0), R ? 10 : 7, 4, (u, p) => at(p, 1, u), false, false, 0, ov);
    if (R) stampOn(mb, pts, sx, at, rad * ov[0] * 0.9);
  }
}
function vesselSamples(kind, nT, nA) {
  const prof = profiles()[kind], out = [], rad = HANDLE[kind === 0 ? 0 : 1].rad;
  for (let i = 0; i <= nT; i++) {
    const q = prof.at(i / nT), n = q.r < 0.012 ? 1 : Math.max(5, Math.round(nA * Math.min(1, q.r / 0.12)));
    for (let j = 0; j < n; j++) {
      const a = ((j + (i % 2) * 0.5) / n) * TAU$8;
      out.push([q.r * Math.cos(a), q.y - 0.42, q.r * Math.sin(a)]);
    }
  }
  const hz = kind === 0 ? rad : 0.0085 + rad;
  for (const sx of [-1, 1]) for (const [r, y] of kind === 0 ? RH_HANDLE : KO_HANDLE) for (const dz of [-hz, 0, hz]) out.push([sx * (r + rad * 0.9), y - 0.42, dz]);
  return out;
}
function amphoraMB(kind) {
  const prof = profiles()[kind], mb = new MB({ aLoc: 3, aPart: 4, aVar: 1 });
  const at = (p, part, w, sx = 0, sy = 0) => ({ aLoc: p, aPart: [part, sx, sy, w], aVar: 0 });
  const path = prof.adaptive(0.03, 0.18).map((t) => { const q = prof.at(t); return { r: q.r, y: q.y - 0.42, nr: q.nr, ny: q.ny, part: 0 }; });
  const inn = pathNormals(crSample(kind === 0 ? RH_IN : KO_IN, 2));
  for (let i = 1; i < inn.length; i++) path.push({ ...inn[i], y: inn[i].y - 0.42, part: 4 });
  lathe$1(mb, path, 32, (p, pos) => at(pos, p.part, 0));
  handlesOn(mb, kind, at, 0);
  {
    const yS = 0.425, rS = (kind === 0 ? 0.0392 : 0.0372) * 0.985, v0 = mb.count, i0 = mb.I.length, NS = 18;
    const c = mb.v([0, yS + 0.004, 0], UP, at([0, yS + 0.004, 0], 5, 0));
    const ring = [];
    for (let j = 0; j < NS; j++) { const a = (j / NS) * TAU$8, p = [Math.cos(a) * rS, yS, Math.sin(a) * rS]; ring.push(mb.v(p, UP, at(p, 5, 1))); }
    for (let j = 0; j < NS; j++) mb.tri(c, ring[(j + 1) % NS], ring[j]);
    mb.fixWinding(i0);
    mb.smooth(v0, i0);
  }
  return mb;
}

function amphoraCasterMB(kind) {
  const prof = profiles()[kind], mb = new MB({}), none = () => ({});
  const path = prof.adaptive(0.06, 0.3).map((t) => { const q = prof.at(t); return { r: q.r, y: q.y - 0.42, nr: q.nr, ny: q.ny }; });
  lathe$1(mb, path, 16, none);
  handlesOn(mb, kind, none, 0);
  return mb;
}

function wallPiece(mb, prof, cols, o) {
  const { ring = false, thick = 0.0095, yOff = 0.42, attr, rng, top = null, bottom = null, sides = false, capIn = false } = o;
  const nc = cols.length, J = ring ? nc : nc - 1, nx = (j) => (ring ? (j + 1) % nc : j + 1), i0 = mb.I.length;
  const thAt = (c, k) => (typeof c.th === 'number' ? c.th : c.th[k]);
  const pt = (t, th, inner) => {
    const q = prof.at(t), ca = Math.cos(th), sa = Math.sin(th), n = [q.nr * ca, q.ny, q.nr * sa], p = [q.r * ca, q.y - yOff, q.r * sa];
    return { p: inner ? mad(p, n, -thick) : p, n: inner ? mul(n, -1) : n, tan: [q.tr * ca, q.ty, q.tr * sa], th };
  };
  const Og = cols.map((c) => c.ts.map((t, k) => pt(t, thAt(c, k), false)));
  const Ig = cols.map((c) => (c.tsIn || c.ts).map((t, k) => pt(t, thAt(c, k), true)));
  const emit = (G, part) => G.map((col) => col.map((q) => mb.v(q.p, q.n, attr(q.p, part, 0))));
  const O = emit(Og, 0), I = emit(Ig, 4);
  for (const G of [O, I]) {
    for (let j = 0; j < J; j++) for (let k = 0; k < G[j].length - 1; k++) mb.quad(G[j][k], G[j][k + 1], G[nx(j)][k + 1], G[nx(j)][k]);
  }
  if (capIn) {
    const row = Ig.map((c) => c[0]), cp = [0, row.reduce((s, q) => s + q.p[1], 0) / row.length - 0.004, 0];
    const ci = mb.v(cp, UP, attr(cp, 4, 0)), rv = row.map((q) => mb.v(q.p, UP, attr(q.p, 4, 0)));
    for (let j = 0; j < J; j++) mb.tri(ci, rv[j], rv[nx(j)]);
  }
  const s0 = mb.count, si0 = mb.I.length;
  const strip = (A, B, dirs, part, wrap) => {
    const rows = A.map((a, k) => {
      const d = dirs[k], mid = mad(lerp3(a.p, B[k].p, 0.5), d, (rng() - 0.5) * 0.003);
      return [mb.v(a.p, d, attr(a.p, part, 0)), mb.v(mid, d, attr(mid, part, 0.5)), mb.v(B[k].p, d, attr(B[k].p, part, 1))];
    });
    const m = rows.length;
    for (let k = 0; k < (wrap ? m : m - 1); k++) {
      const r0 = rows[k], r1 = rows[(k + 1) % m];
      mb.quad(r0[0], r0[1], r1[1], r1[0]);
      mb.quad(r0[1], r0[2], r1[2], r1[1]);
    }
  };
  const partOf = (e) => (e === 'lip' ? 0 : 3);
  if (top) strip(Og.map((c) => c[c.length - 1]), Ig.map((c) => c[c.length - 1]), Og.map((c) => c[c.length - 1].tan), partOf(top), ring);
  if (bottom) strip(Og.map((c) => c[0]), Ig.map((c) => c[0]), Og.map((c) => mul(c[0].tan, -1)), partOf(bottom), ring);
  if (sides && !ring) {
    for (const j of [0, nc - 1]) {
      const sg = j === 0 ? -1 : 1;
      strip(Og[j], Ig[j], Og[j].map((q) => mul([-Math.sin(q.th), 0, Math.cos(q.th)], sg)), 3, false);
    }
  }
  mb.fixWinding(i0);
  mb.smooth(s0, si0);
}
function jaggedEdge(rng, nk, amp, bites) {
  const knots = [];
  for (let i = 0; i < nk; i++) knots.push([((i + 0.2 + rng() * 0.6) / nk) * TAU$8, (rng() - 0.5) * amp]);
  for (let b = 0; b < bites; b++) knots[Math.floor(rng() * nk)][1] -= amp * (1.2 + rng() * 1.4);
  return (th) => {
    const t = th < knots[0][0] ? th + TAU$8 : th;
    for (let i = 0; i < nk; i++) {
      const a = knots[i], b0 = i + 1 < nk ? knots[i + 1][0] : knots[0][0] + TAU$8, bv = knots[(i + 1) % nk][1];
      if (t >= a[0] && t <= b0) return a[1] + (bv - a[1]) * ((t - a[0]) / (b0 - a[0]));
    }
    return 0;
  };
}
function brokenCols(prof, rng, tBase, amp, bites, J) {
  J = Math.max(10, Math.round(J * LATHE_K));
  const tIn = prof.tAtY(0.125), edge = jaggedEdge(rng, 6 + Math.floor(rng() * 5), amp, bites), t1 = [];
  for (let j = 0; j < J; j++) t1.push(Math.max(tIn + 0.03, tBase + edge((j / J) * TAU$8) + (rng() - 0.5) * 0.01));
  const tB = Math.min(...t1), all = prof.adaptive(0.034, 0.15);
  const below = all.filter((t) => t < tIn - 0.002), mid = all.filter((t) => t > tIn + 0.002 && t < tB - 0.012);
  const t0 = mid.length ? mid[mid.length - 1] : tIn;
  return t1.map((te, j) => {
    const band = [];
    const NB = LATHE_K < 1 ? 3 : 5;
    for (let k = 1; k <= NB; k++) band.push(t0 + (te - t0) * (k / NB));
    return { th: (j / J) * TAU$8, ts: [...below, tIn, ...mid, ...band], tsIn: [tIn, ...mid, ...band] };
  });
}
function neckCols(prof, rng, J) {
  J = Math.max(10, Math.round(J * LATHE_K));
  const tb = prof.tAtY(0.585), edge = jaggedEdge(rng, 5 + Math.floor(rng() * 4), 0.06, 0), t0 = [];
  for (let j = 0; j < J; j++) t0.push(tb + edge((j / J) * TAU$8) + (rng() - 0.5) * 0.008);
  const tA = Math.max(...t0), all = prof.adaptive(0.03, 0.13).filter((t) => t > tA + 0.008);
  return t0.map((s, j) => {
    const band = [];
    for (let k = 0; k < 4; k++) band.push(s + (tA - s) * (k / 4));
    return { th: (j / J) * TAU$8, ts: [...band, ...all] };
  });
}
function sherdPiece(mb, prof, rng, attr, thick) {
  const tc = 0.24 + rng() * 0.5, q0 = prof.at(tc), size = 0.08 + rng() * 0.09, th0 = rng() * TAU$8, R0 = Math.max(0.06, q0.r);
  const nc = 5 + Math.floor(rng() * 3), corners = [];
  for (let k = 0; k < nc; k++) {
    const ang = ((k + 0.2 + rng() * 0.6) / nc) * TAU$8, rad = size * 0.5 * (0.65 + 0.45 * rng());
    corners.push([Math.cos(ang) * rad, Math.sin(ang) * rad]);
  }
  const outline = [];
  for (let k = 0; k < nc; k++) {
    const a = corners[k], b = corners[(k + 1) % nc], ex = b[0] - a[0], ey = b[1] - a[1], el = Math.hypot(ex, ey) || 1;
    for (let s = 0; s < 4; s++) { const f = s / 4, w = s ? (rng() - 0.5) * 0.004 : 0; outline.push([a[0] + ex * f - (ey / el) * w, a[1] + ey * f + (ex / el) * w]); }
  }
  const at = (u, v, inner) => {
    const q = prof.at(clamp$9(tc + v / prof.total, 0.02, 0.98)), th = th0 + u / R0, c = Math.cos(th), s = Math.sin(th);
    const n = [q.nr * c, q.ny, q.nr * s], p = [q.r * c, q.y - 0.42, q.r * s];
    return { p: inner ? mad(p, n, -thick) : p, n: inner ? mul(n, -1) : n };
  };
  const i0 = mb.I.length, RINGS = [0.34, 0.68, 1.0], m = outline.length;
  for (const inner of [false, true]) {
    const part = inner ? 4 : 0, ctr = at(0, 0, inner), ci = mb.v(ctr.p, ctr.n, attr(ctr.p, part, 0));
    const rings = RINGS.map((sc) => outline.map(([u, v]) => { const q = at(u * sc, v * sc, inner); return mb.v(q.p, q.n, attr(q.p, part, 0)); }));
    for (let k = 0; k < m; k++) {
      const k2 = (k + 1) % m;
      mb.tri(ci, rings[0][k], rings[0][k2]);
      for (let r = 0; r < RINGS.length - 1; r++) mb.quad(rings[r][k], rings[r + 1][k], rings[r + 1][k2], rings[r][k2]);
    }
  }
  const s0 = mb.count, si0 = mb.I.length, cO = at(0, 0, false).p;
  const rows = outline.map(([u, v]) => {
    const o = at(u, v, false), n = at(u, v, true), d = norm(sub(o.p, cO)), mid = mad(lerp3(o.p, n.p, 0.5), d, (rng() - 0.3) * 0.004);
    return [mb.v(o.p, d, attr(o.p, 3, 0)), mb.v(mid, d, attr(mid, 3, 0.5)), mb.v(n.p, d, attr(n.p, 3, 1))];
  });
  for (let k = 0; k < m; k++) {
    const r0 = rows[k], r1 = rows[(k + 1) % m];
    mb.quad(r0[0], r0[1], r1[1], r1[0]);
    mb.quad(r0[1], r0[2], r1[2], r1[1]);
  }
  mb.fixWinding(i0);
  mb.smooth(s0, si0);
  const c0 = at(0, 0, false);
  return { c: c0.p, n: c0.n };
}

const PIECE_KINDS = [
  { kind: 0, type: 'broken', tBase: 0.64, bites: 1 },
  { kind: 0, type: 'broken', tBase: 0.5, bites: 2 },
  { kind: 1, type: 'broken', tBase: 0.6, bites: 1 },
  { kind: 0, type: 'toe' },
  { kind: 0, type: 'neck' },
  { kind: 1, type: 'neck' },
  { kind: 0, type: 'handle' },
  { kind: 1, type: 'handle' },
];
const N_SHERD = 8;
function ceramicKit(rng) {
  const mk = () => new MB({ aLoc: 3, aPart: 4, aVar: 1 });
  const kit = {
    intact: [amphoraMB(0), amphoraMB(1)], pieces: [mk(), mk()], sherds: mk(), pieceInfo: [], sherdInfo: [],
    samp: [0, 1].map((k) => ({ coarse: vesselSamples(k, 12, 7), fine: vesselSamples(k, 22, 12) })),
    pieceRanges: [[], []], sherdRanges: [],
  };
  const sparse = (mb, v0) => { const out = []; for (let i = v0; i < mb.count; i += 4) out.push([mb.P[i * 3], mb.P[i * 3 + 1], mb.P[i * 3 + 2]]); return out; };
  const counters = [0, 0];
  PIECE_KINDS.forEach((pk) => {
    const group = pk.type === 'broken' ? 0 : 1, v = counters[group]++, prof = profiles()[pk.kind], mb = kit.pieces[group], v0 = mb.count, i0 = mb.I.length;
    const at = (p, part, w, sx = 0, sy = 0) => ({ aLoc: p, aPart: [part, sx, sy, w], aVar: v });
    if (pk.type === 'broken') wallPiece(mb, prof, brokenCols(prof, rng, pk.tBase, 0.12, pk.bites, 32), { ring: true, attr: at, rng, top: 'frac', capIn: true });
    else if (pk.type === 'toe') wallPiece(mb, prof, brokenCols(prof, rng, 0.23, 0.05, 0, 24), { ring: true, attr: at, rng, top: 'frac', capIn: true });
    else if (pk.type === 'handle') {
      const tA = prof.tAtY(0.59), tB = prof.tAtY(0.84);
      const ts = [tA, ...prof.adaptive(0.02, 0.12).filter((t) => t > tA + 0.01 && t < tB - 0.01), tB];
      const e0 = ts.map(() => -0.5 + (rng() - 0.5) * 0.3), e1 = ts.map(() => 0.5 + (rng() - 0.5) * 0.3), cols = [];
      for (let j = 0; j <= 8; j++) cols.push({ th: ts.map((t, k) => lerp$4(e0[k], e1[k], j / 8)), ts });
      wallPiece(mb, prof, cols, { attr: at, rng, top: 'frac', bottom: 'frac', sides: true });
      handleOne(mb, pk.kind, at, 1);
    } else {
      wallPiece(mb, prof, neckCols(prof, rng, 24), { ring: true, attr: at, rng, top: 'lip', bottom: 'frac' });
      handlesOn(mb, pk.kind, at, 2);
    }
    kit.pieceInfo.push({ ...pk, group, v, pts: sparse(mb, v0) });
    kit.pieceRanges[group][v] = [i0, mb.I.length - i0];
  });
  for (let v = 0; v < N_SHERD; v++) {
    const prof = profiles()[v % 2], tmp = new MB({ aLoc: 3, aPart: 4, aVar: 1 });
    const sh = sherdPiece(tmp, prof, rng, (p, part, w) => ({ aLoc: p, aPart: [part, 0, 0, w], aVar: v }), 0.02 + rng() * 0.008);
    const q = qFromTo(norm(sh.n), UP), v0 = kit.sherds.count, i0 = kit.sherds.I.length;
    kit.sherds.append(tmp, { p: mul(qRot(q, sh.c), -1), q, s: 1 });
    kit.sherdInfo.push({ kind: v % 2, pts: sparse(kit.sherds, v0) });
    kit.sherdRanges[v] = [i0, kit.sherds.I.length - i0];
  }
  return kit;
}

const HULL = { STERN: -21, BOW: 12, S0: -20.1, DS: 0.95, NF: 34, SIG0: 0.2, PW: 0.3, PT: 0.07, FS: 0.16, FM: 0.16 };
const HMID = (HULL.STERN + HULL.BOW) / 2, HHALF = (HULL.BOW - HULL.STERN) / 2;
const HC = [LAYOUT.hull.x, LAYOUT.hull.z];
const HA = [Math.sin(LAYOUT.hull.rot), 0, Math.cos(LAYOUT.hull.rot)];
const HB = [Math.cos(LAYOUT.hull.rot), 0, -Math.sin(LAYOUT.hull.rot)];
const hullXZ = (s, b) => [HC[0] + HA[0] * s + HB[0] * b, HC[1] + HA[2] * s + HB[2] * b];
const toHull = (x, z) => { const dx = x - HC[0], dz = z - HC[1]; return [dx * HA[0] + dz * HA[2], dx * HB[0] + dz * HB[2]]; };
const SEC = (() => {
  const make = (thB, thS, s0, s1) => {
    const ds = 0.02, B = [0], H = [0], TH = [thB];
    let b = 0, h = 0;
    for (let i = 1; i <= 300; i++) {
      const th = thB + (thS - thB) * smoothstep(s0, s1, (i - 0.5) * ds);
      b += Math.cos(th) * ds; h += Math.sin(th) * ds;
      B.push(b); H.push(h); TH.push(thB + (thS - thB) * smoothstep(s0, s1, i * ds));
    }
    return { B, H, TH, ds };
  };
  return { hi: make(0.04, 1.45, 1.5, 2.9), lo: make(0.02, 0.75, 1.9, 3.2) };
})();
const secScale = (s) => 1 - 0.72 * Math.pow(smoothstep(0.35, 1.0, Math.abs(s - HMID) / HHALF), 1.3);
function secAt(side, s, sg) {
  const tab = side < 0 ? SEC.hi : SEC.lo, f = secScale(s);
  const u = clamp$9(sg / f / tab.ds, 0, tab.B.length - 1.001), i = Math.floor(u), fr = u - i;
  const th = tab.TH[i] + (tab.TH[i + 1] - tab.TH[i]) * fr;
  return {
    b: side * (tab.B[i] + (tab.B[i + 1] - tab.B[i]) * fr) * f,
    h: (tab.H[i] + (tab.H[i + 1] - tab.H[i]) * fr) * f,
    nb: -side * Math.sin(th), nh: Math.cos(th),
  };
}
function secAtB(side, s, bAbs) {
  const tab = side < 0 ? SEC.hi : SEC.lo, f = secScale(s), bb = bAbs / f, B = tab.B;
  if (bb >= B[B.length - 1]) return null;
  let lo = 0, hi = B.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (B[m] <= bb) lo = m; else hi = m; }
  const fr = (bb - B[lo]) / (B[hi] - B[lo]);
  return { h: (tab.H[lo] + (tab.H[hi] - tab.H[lo]) * fr) * f, sg: (lo + fr) * tab.ds * f };
}
function secLean(side, s, sg, lean) {
  const sc = secAt(side, s, sg);
  return sc;
}
const hullOff = (s, b) => -0.035 + 0.05 * noise3(s * 0.3 + 4.1, b * 0.5 - 1.3, 2.3);
function hullPt(s, b, h) {
  const x = HC[0] + HA[0] * s + HB[0] * b, z = HC[1] + HA[2] * s + HB[2] * b;
  return [x, terrainY(x, z) + h + hullOff(s, b), z];
}
const PLANK = { ready: false, runs: { '-1': [], 1: [] }, keel: [] };
function plankAt(side, s, sg) {
  if (sg < HULL.SIG0) return PLANK.keel.some(([a, b]) => s >= a && s <= b);
  const list = PLANK.runs[side][Math.floor((sg - HULL.SIG0) / HULL.PW)];
  return !!list && list.some(([a, b]) => s >= a - 0.02 && s <= b + 0.02);
}
function supportY(x, z) {
  const t = terrainY(x, z), [s, b] = toHull(x, z);
  if (s < HULL.STERN + 0.8 || s > HULL.BOW - 0.8) return t;
  const side = b < 0 ? -1 : 1, sec = secAtB(side, s, Math.abs(b));
  if (!sec || sec.sg > (side < 0 ? 3.0 : 3.3)) return t;
  if (PLANK.ready && !plankAt(side, s, sec.sg)) return t;
  return Math.max(t, t + sec.h + HULL.PT + hullOff(s, b));
}
const seamGap = (side, k, s) => 0.005 + 0.03 * smoothstep(0.25, 0.6, noise3(s * 0.45 + (k + (side > 0 ? 50 : 0)) * 3.7, k * 1.3, 0.5));
const RECT12 = [[0.08, 0], [0.36, 0], [0.64, 0], [0.92, 0], [1, 0.1], [1, 0.9], [0.92, 1], [0.64, 1], [0.36, 1], [0.08, 1], [0, 0.9], [0, 0.1]];
const RECT16 = [[0.03, 0], [0.1, 0], [0.9, 0], [0.97, 0], [1, 0.04], [1, 0.14], [1, 0.86], [1, 0.96], [0.97, 1], [0.9, 1], [0.1, 1], [0.03, 1], [0, 0.96], [0, 0.86], [0, 0.14], [0, 0.04]];
const arrisWear = (a, w, u, sd, amt = 1) => (Math.abs(a - 0.5) > 0.45 && Math.abs(w - 0.5) > 0.44
  ? amt * (0.005 + 0.025 * smoothstep(-0.25, 0.55, noise3(u * 2.3 + a * 3.7, w * 3.1 + sd * 11, sd * 5.3))) : 0);
function moundY(x, z) {
  const [s, b] = toHull(x, z);
  return terrainY(x, z) + moundLift(moundAt(s, b));
}
const BANKF = { map: null };
function bankH(x, z) {
  const M = BANKF.map;
  if (!M) return 0;
  const u = x / 0.05, v = z / 0.05, i = Math.floor(u), j = Math.floor(v), fu = u - i, fv = v - j;
  const a = M.get(bankKey(i, j)), b = M.get(bankKey(i + 1, j)), c = M.get(bankKey(i, j + 1)), d = M.get(bankKey(i + 1, j + 1));
  if (!a && !b && !c && !d) return 0;
  return ((a ? a.h : 0) * (1 - fu) + (b ? b.h : 0) * fu) * (1 - fv) + ((c ? c.h : 0) * (1 - fu) + (d ? d.h : 0) * fu) * fv;
}
function groundAt(x, z) {
  const f = floorHeight(x, z);
  if (!MG.H) return f;
  const dx = x - HC[0], dz = z - HC[1];
  const h = moundAt(dx * HA[0] + dz * HA[2], dx * HB[0] + dz * HB[2]), hb = bankH(x, z);
  if (h < 0.021 && hb < 0.021) return f;
  const y = terrainY(x, z) + Math.max(moundLift(h), moundLift(hb));
  return y > f ? y : f;
}
const moundTop = (x, z) => Math.max(terrainY(x, z), moundY(x, z));
const groundM = (x, z) => Math.max(supportY(x, z), moundTop(x, z));
const woodAttr = (kind, sd, strake, endD, loc, hw, ht, p) => ({ aLoc: loc, aWood: [kind, sd, strake, endD], aWoodB: [hw, ht, moundTop(p[0], p[2])] });
function clearRuns(a, b, test, step = 0.25) {
  const out = [];
  let start = null;
  for (let s = a; s <= b + 1e-6; s += step) {
    const ok = test(Math.min(s, b));
    if (ok && start === null) start = s;
    if (!ok && start !== null) { out.push([start, s - step]); start = null; }
  }
  if (start !== null) out.push([start, b]);
  return out.filter(([x, y]) => y - x > 0.5);
}

function frameTimber(ctx, s, from, to, leanHi, leanLo, fa = 0) {
  const { wood: W, rng } = ctx, H = HULL, sd = rng(), cDw = H.PT + 0.5 * H.FM;
  const sec = (sg) => (sg < 0 ? secLean(-1, s, -sg) : secLean(1, s, sg));
  const sag = (sg) => fa * Math.max(0, Math.abs(sg) - 2.2);
  const centre = (sg) => { const sc = sec(sg); return hullPt(s + sag(sg), sc.b + sc.nb * cDw, sc.h + sc.nh * cDw); };
  const n = Math.max(4, Math.ceil((to - from) / 0.07)), rings = [];
  for (let k = 0; k <= n; k++) {
    const sg = from + (to - from) * (k / n), sc = sec(sg);
    const endD = Math.min(sg - from, to - sg), taper = 0.55 + 0.45 * smoothstep(0, 0.4, endD), pts = [], attrs = [];
    const mv = 1 + 0.16 * noise3(sg * 0.9 + sd * 7, s * 0.3, 1.7), sv = 1 + 0.12 * noise3(sg * 1.1 + sd * 3, s * 0.3, 5.3);
    for (const [a, w] of RECT16) {
      const ero = noise3(s * 5.1 + a * 2.3, sg * 3.7, w * 2.9 + sd * 13) * 0.012 * (1.6 - taper) + 0.012 * noise3(sg * 2.6 + a * 1.9 + sd * 5, w * 2.3, s * 0.9);
      const wr = Math.min(arrisWear(a, w, sg, sd, 1.9 - taper), 0.3 * H.FS * taper);
      const da = (a - 0.5) * H.FS * taper * sv - Math.sign(a - 0.5) * wr + 0.01 * noise3(sg * 2.9 + sd * 3, a * 3.3, w * 1.7);
      const dw = H.PT + w * H.FM * mv * (0.75 + 0.25 * taper) + ero - Math.sign(w - 0.5) * wr;
      const p = hullPt(s + da + sag(sg), sc.b + sc.nb * dw, sc.h + sc.nh * dw);
      pts.push(p);
      attrs.push(woodAttr(1, sd, 0, endD, [sg, da, (w - 0.5) * H.FM], H.FS / 2, H.FM / 2, p));
    }
    rings.push({ pts, attrs, c: centre(sg) });
  }
  splinter(rings, rng, 0.08);
  sweepRings(W, rings, true, true);
  const m = Math.max(1, Math.ceil((to - from) / 0.45));
  let prev = centre(from);
  for (let k = 1; k <= m; k++) {
    const cur = centre(from + (to - from) * (k / m)), hh = Math.max(prev[1] - terrainY(prev[0], prev[2]), cur[1] - terrainY(cur[0], cur[2]));
    const cap = { a: prev, b: cur, r: 0.1, sup: hh < 0.3 };
    ctx.px.add(cap);
    if (hh > 0.3) ctx.caps.push(cap);
    prev = cur;
  }
  for (const e of [from, to]) {
    if (Math.abs(e) > 2.8) { const p = centre(e); ctx.tops.push({ p, n: norm(sub(p, centre(e - Math.sign(e) * 0.12))) }); }
  }
}
function plankTimber(ctx, side, k, sA, sB, jit = null, nbc = null) {
  const { wood: W, rng } = ctx, H = HULL, sd = rng(), id = k + (side > 0 ? 50 : 0);
  const n = Math.max(3, Math.ceil((sB - sA) / 0.1)), rings = [], jd = jit ? jit.dw : 0, jt = jit ? jit.tw : 0;
  for (let i = 0; i <= n; i++) {
    const s = sA + (sB - sA) * (i / n), u = i / n, endD = Math.min(s - sA, sB - s), ero = 1 - smoothstep(0, 0.6, endD);
    const fL = nbc && nbc(k - 1, s) ? 0.12 : 1, fH = nbc && nbc(k + 1, s) ? 0.12 : 1;
    const eL = (0.005 + 0.024 * smoothstep(-0.2, 0.6, noise3(s * 2.3 + id * 1.7, 0.5, 2.1))) * fL, eH = (0.005 + 0.024 * smoothstep(-0.2, 0.6, noise3(s * 2.3 + id * 1.7, 4.5, 2.1))) * fH;
    let lo = H.SIG0 + k * H.PW + seamGap(side, k, s) * 0.5 + eL + jt * (u - 0.5), hi = H.SIG0 + (k + 1) * H.PW - seamGap(side, k + 1, s) * 0.5 - eH + jt * (u - 0.5);
    lo += ero * 0.11 * (0.35 + 0.65 * (0.5 + 0.5 * noise3(s * 9, id, 1.7)));
    hi -= ero * 0.11 * (0.35 + 0.65 * (0.5 + 0.5 * noise3(s * 9, id, 4.1)));
    if (hi - lo < 0.03) { const m = (lo + hi) / 2; lo = m - 0.015; hi = m + 0.015; }
    const th = H.PT * (1 - 0.5 * ero) * (0.9 + 0.1 * noise3(s * 1.7, id * 0.3, 6.1)), wd = hi - lo, pts = [], attrs = [];
    for (const [a, w] of RECT12) {
      const sg = lo + a * wd, sc = secAt(side, s, sg), dw = w * th + jd + noise3(s * 3.3 + id, sg * 11, w * 3) * 0.007;
      const p = hullPt(s, sc.b + sc.nb * dw, sc.h + sc.nh * dw);
      pts.push(p);
      attrs.push(woodAttr(0, sd, id, endD, [s, (a - 0.5) * wd, (w - 0.5) * th], wd / 2, th / 2, p));
    }
    const sm = secAt(side, s, (lo + hi) / 2);
    rings.push({ pts, attrs, c: hullPt(s, sm.b + sm.nb * th * 0.5, sm.h + sm.nh * th * 0.5) });
  }
  splinter(rings, rng, 0.12);
  sweepRings(W, rings, true, true);
  if (k >= 3) {
    const m = Math.max(1, Math.round((sB - sA) / 1.2)), sg = H.SIG0 + (k + 0.5) * H.PW;
    const at = (s) => { const sc = secAt(side, s, sg); return hullPt(s, sc.b + sc.nb * H.PT * 0.5, sc.h + sc.nh * H.PT * 0.5); };
    for (let i = 0; i < m; i++) ctx.px.add({ a: at(sA + (sB - sA) * (i / m)), b: at(sA + (sB - sA) * ((i + 1) / m)), r: 0.045 });
  }
}
function tenonBlock(ctx, side, ks, u, id) {
  const H = HULL, sg = H.SIG0 + ks * H.PW;
  const P = (du, ds, dw) => { const sc = secAt(side, u + du, sg + ds), w = H.PT * 0.5 + dw; return hullPt(u + du, sc.b + sc.nb * w, sc.h + sc.nh * w); };
  box8(ctx.wood, P, 0.03, 0.045, 0.005, (du, ds, dw, p) => woodAttr(3, (id * 0.371) % 1, id, 1, [u + du, ds, dw], 0.045, 0.005, p));
}
function spineTimber(ctx, base, height, width, sA, sB) {
  const { wood: W, rng } = ctx, sd = rng(), n = Math.ceil((sB - sA) / 0.12), rings = [];
  for (let i = 0; i <= n; i++) {
    const s = sA + (sB - sA) * (i / n), endD = Math.min(s - sA, sB - s), tp = 0.6 + 0.4 * smoothstep(0, 0.45, endD), pts = [], attrs = [];
    for (const [a, w] of RECT16) {
      const ero = noise3(s * 3.1 + sd * 9, a * 3.1, w * 3.3) * 0.01;
      const wr = arrisWear(a, w, s, sd, 1.2);
      const p = hullPt(s, (a - 0.5) * width * tp + ero - Math.sign(a - 0.5) * wr, base + w * height * tp + ero - Math.sign(w - 0.5) * wr);
      pts.push(p);
      attrs.push(woodAttr(2, sd, 0, endD, [s, (a - 0.5) * width * tp, (w - 0.5) * height * tp], (width * tp) / 2, (height * tp) / 2, p));
    }
    rings.push({ pts, attrs, c: hullPt(s, 0, base + height * tp * 0.5) });
  }
  splinter(rings, rng, 0.07);
  sweepRings(W, rings, true, true);
}
function timberAlong(ctx, ctrl, w, h, lat, tip = 0.08) {
  const { rng } = ctx, sd = rng(), pts = crSample(ctrl, 5), n = pts.length, len = [0];
  for (let i = 1; i < n; i++) len.push(len[i - 1] + Math.hypot(...sub(pts[i], pts[i - 1])));
  const total = len[n - 1], W = typeof w === 'function' ? w : () => w, Hh = typeof h === 'function' ? h : () => h;
  const rings = pts.map((c, i) => {
    const T = norm(sub(pts[Math.min(n - 1, i + 1)], pts[Math.max(0, i - 1)]));
    const hint = lat || cross(T, UP), side = norm(sub(hint, mul(T, dot(hint, T)))), up = cross(side, T);
    const endD = Math.min(len[i], total - len[i]), tp = 0.62 + 0.38 * smoothstep(0, 0.5, endD), u = len[i] / total;
    const wi = W(u) * tp * (1 + 0.1 * noise3(len[i] * 1.3 + sd * 5, 0.5, 2.2)), hi = Hh(u) * tp * (1 + 0.1 * noise3(len[i] * 1.1 + sd * 7, 4.5, 2.2)), ptsR = [], attrs = [];
    for (const [a, wv] of RECT16) {
      const ero = noise3(len[i] * 2.3 + a * 2.1, wv * 3.3, sd * 17) * 0.012 * (1.5 - tp) + 0.012 * noise3(len[i] * 3.1 + a * 1.7 + sd * 3, wv * 2.9, 0.7);
      const wr = Math.min(arrisWear(a, wv, len[i], sd, 1.8 - tp), 0.3 * Math.min(wi, hi));
      const p = add(add(c, mul(side, (a - 0.5) * wi + ero - Math.sign(a - 0.5) * wr)), mul(up, (wv - 0.5) * hi + ero - Math.sign(wv - 0.5) * wr));
      ptsR.push(p);
      attrs.push(woodAttr(5, sd, 0, endD, [len[i], (a - 0.5) * wi, (wv - 0.5) * hi], wi / 2, hi / 2, p));
    }
    return { pts: ptsR, attrs, c };
  });
  splinter(rings, rng, tip);
  sweepRings(ctx.wood, rings, true, true);
  return pts;
}
function stumpTimber(ctx, ctrl, w, h) {
  const { rng } = ctx, sd = rng(), pts = crSample(ctrl, 14), n = pts.length, len = [0], NS = 28;
  for (let i = 1; i < n; i++) len.push(len[i - 1] + Math.hypot(...sub(pts[i], pts[i - 1])));
  const total = len[n - 1], teeth = [], split = rng() * TAU$8;
  for (let t = 0, nt = 3 + Math.floor(rng() * 3); t < nt; t++) teeth.push([rng() * TAU$8, 0.06 + rng() * 0.22, 0.2 + rng() * 0.4]);
  const rings = pts.map((c, i) => {
    const T = norm(sub(pts[Math.min(n - 1, i + 1)], pts[Math.max(0, i - 1)]));
    const side = norm(sub(HB, mul(T, dot(HB, T)))), up = cross(side, T), fromTop = total - len[i], topK = 1 - smoothstep(0.0, 0.45, fromTop);
    const tw = 1 - 0.3 * (1 - smoothstep(0.0, 0.7, fromTop));
    const ptsR = [], attrs = [];
    for (let j = 0; j < NS; j++) {
      const a = (j / NS) * TAU$8, ca = Math.cos(a), sa = Math.sin(a);
      const ex = Math.sign(ca) * Math.pow(Math.abs(ca), 0.55), ey = Math.sign(sa) * Math.pow(Math.abs(sa), 0.55);
      const ero = 0.03 * noise3(len[i] * 2.7 + ca * 1.3, sa * 1.3 + sd * 7, 0.7) + 0.014 * noise3(len[i] * 8.3, ca * 3 + sd, sa * 3) + 0.022 * noise3(len[i] * 1.2 + ca * 0.8, sa * 0.8 + sd * 3, 2.2) - 0.05 * topK * (0.5 + 0.5 * noise3(ca * 2 + sd, sa * 2, len[i] * 4));
      const da = Math.atan2(Math.sin(a - split), Math.cos(a - split)), spl = 0.05 * Math.exp(-(da * da) / 0.012) * (1 - smoothstep(0.0, 0.7, fromTop));
      let p = add(add(c, mul(side, ex * (w * 0.5 * tw + ero - spl))), mul(up, ey * (h * 0.5 * tw + ero - spl)));
      if (i === n - 1) {
        let tooth = 0;
        for (const [ta, th, tw] of teeth) { const d = Math.atan2(Math.sin(a - ta), Math.cos(a - ta)); tooth += th * Math.exp(-(d * d) / (tw * tw)); }
        p = mad(p, T, tooth - 0.03 + 0.02 * noise3(a * 3, sd * 5, 1.1));
      }
      ptsR.push(p);
      attrs.push(woodAttr(5, sd, 0, Math.min(len[i], fromTop), [len[i], ex * w * 0.5, ey * h * 0.5], w / 2, h / 2, p));
    }
    return { pts: ptsR, attrs, c };
  });
  rings[n - 1].tip = -0.02;
  sweepRings(ctx.wood, rings, true, true);
  return pts;
}
function roundTimber(ctx, ctrl, r0, r1) {
  const { rng } = ctx, sd = rng(), pts = crSample(ctrl, 6), n = pts.length, len = [0], nr = 14;
  for (let i = 1; i < n; i++) len.push(len[i - 1] + Math.hypot(...sub(pts[i], pts[i - 1])));
  const total = len[n - 1], T0 = norm(sub(pts[1], pts[0]));
  let F = norm(sub(Math.abs(T0[1]) < 0.9 ? UP : [1, 0, 0], mul(T0, Math.abs(T0[1]) < 0.9 ? T0[1] : T0[0])));
  const rings = pts.map((c, i) => {
    const T = norm(sub(pts[Math.min(n - 1, i + 1)], pts[Math.max(0, i - 1)]));
    F = norm(sub(F, mul(T, dot(F, T))));
    const Bv = cross(T, F), endD = Math.min(len[i], total - len[i]), r = lerp$4(r0, r1, len[i] / total) * (0.8 + 0.2 * smoothstep(0, 0.5, endD));
    const ptsR = [], attrs = [];
    for (let j = 0; j < nr; j++) {
      const a = (j / nr) * TAU$8, ca = Math.cos(a), sa = Math.sin(a);
      const flat = 0.2 * Math.pow(Math.max(0, ca), 3) * (0.6 + 0.4 * noise3(len[i] * 1.3, sd * 3, 0.3));
      const chk = 0.13 * Math.exp(-(Math.atan2(Math.sin(a - 2.2 - sd * 2), Math.cos(a - 2.2 - sd * 2)) ** 2) / 0.012) * smoothstep(-0.2, 0.3, noise3(len[i] * 0.9, sd * 7, 1.9));
      const rr = r * (1 + 0.08 * noise3(len[i] * 2.3, ca * 1.7 + sd * 9, sa * 1.7) + 0.04 * noise3(len[i] * 7.1, ca * 3 + sd, sa * 3) - flat - chk);
      const p = add(c, add(mul(F, ca * rr), mul(Bv, sa * rr)));
      ptsR.push(p);
      attrs.push(woodAttr(5, sd, 0, endD, [len[i], ca * rr, sa * rr], r, r, p));
    }
    return { pts: ptsR, attrs, c };
  });
  splinter(rings, rng, r0 * 0.6);
  sweepRings(ctx.wood, rings, true, true);
  return pts;
}
const collide = (ctx, a, b, r) => { const cap = { a, b, r, sup: true }; ctx.caps.push(cap); ctx.px.add(cap); };
function sheathing(ctx, sA, sB, gA, gB) {
  const { misc: M, rng } = ctx, sd = rng(), ns = Math.ceil((sB - sA) / 0.05), ng = Math.ceil((gB - gA) / 0.05);
  const v0 = M.count, i0 = M.I.length, id = [];
  for (let i = 0; i <= ns; i++) {
    id.push([]);
    const u = i / ns;
    for (let j = 0; j <= ng; j++) {
      const v = j / ng;
      const sAj = sA + 0.35 * (0.5 + 0.5 * noise3(v * 2.3, sd * 3, 2.2)), sBj = sB - 0.35 * (0.5 + 0.5 * noise3(v * 2.3, sd * 3, 5.1));
      const s = sAj + (sBj - sAj) * u;
      const top = gB - (gB - gA) * (0.1 + 0.3 * (0.5 + 0.5 * noise3(s * 2.1, sd * 5, 1.7)) + 0.07 * noise3(s * 7.3, sd * 9, 0.4));
      const sg = gA + (top - gA) * v, sc = secAt(-1, s, sg);
      const off = 0.004 - 0.008 * smoothstep(0.15, 0.7, noise3(s * 4.3, sg * 4.3, sd * 5)) - 0.002 * noise3(s * 17, sg * 17, 1.3);
      const p = hullPt(s, sc.b - sc.nb * off, sc.h - sc.nh * off);
      id[i].push(M.v(p, norm([-HB[0] * sc.nb, -sc.nh, -HB[2] * sc.nb]), { aLoc: [s, sg, 0], aMisc: [0, sd, s, sg - HULL.SIG0], aFloor: moundTop(p[0], p[2]), color: [0.42, 0.44, 0.47] }));
    }
  }
  for (let i = 0; i < ns; i++) {
    for (let j = 0; j < ng; j++) {
      if (noise3(i * 0.45 + sd * 10, j * 0.45, 3.3) > 0.45) continue;
      M.quad(id[i][j], id[i + 1][j], id[i + 1][j + 1], id[i][j + 1]);
    }
  }
  M.fixWinding(i0);
  M.smooth(v0, i0);
}
function buildHull(ctx) {
  const { rng } = ctx, H = HULL;
  PLANK.ready = false;
  PLANK.runs = { '-1': [], 1: [] };
  PLANK.keel = [[H.STERN + 0.4, -9.3], [-8.5, 2.9], [3.8, H.BOW - 0.35]];
  const brHi = pathCrossings(-2.4), brLo = pathCrossings(2.6);
  const nearB = (s, list, w = 1.3) => list.some((c) => Math.abs(c - s) < w);
  const cutRuns = (a, b, list) => {
    let runs = [[a, b]];
    for (const c of list) runs = runs.flatMap(([x, y]) => (c + 1.3 <= x || c - 1.3 >= y ? [[x, y]] : [[x, c - 1.3], [c + 1.3, y]]));
    return runs;
  };
  const reach = (s, side, want, lean) => {
    let ok = 0;
    for (let sg = 0.1; sg <= want + 1e-6; sg += 0.1) {
      const sc = secLean(side, s, sg), p = hullPt(s, sc.b, sc.h);
      if (!clearOf(p[0], p[2], 0.2) || sc.h > (side < 0 ? 1.45 : 0.9)) break;
      ok = sg;
    }
    return Math.min(ok, want);
  };
  const MAST = [[-1, 0.4], [6.5, 5.4]];
  const underMast = (s) => {
    const t = (s - MAST[0][0]) / (MAST[1][0] - MAST[0][0]);
    if (t < -0.07 || t > 1.07) return Infinity;
    const bm = lerp$4(MAST[0][1], MAST[1][1], clamp$9(t, 0, 1)) - 0.45;
    if (bm <= 0.05) return 0;
    const sc = secAtB(1, s, bm);
    return sc ? sc.sg : Infinity;
  };
  const alive = (s) => noise3(s * 0.31 + 1.7, 3.1, 0.6) + 0.3 * noise3(s * 1.07, 7.7, 2.2);
  const cDw = H.PT + 0.5 * H.FM;
  const expo = (s, sg) => {
    const side = sg < 0 ? -1 : 1, sc = secAt(side, s, Math.abs(sg)), p = hullPt(s, sc.b + sc.nb * cDw, sc.h + sc.nh * cDw);
    return p[1] - (terrainY(p[0], p[2]) + moundAt(s, sc.b));
  };
  const held = (s, side, want, eMax) => {
    let ok = 0;
    for (let sg = 0.05; sg <= want + 1e-6; sg += 0.05) { if (expo(s, side * sg) > eMax) break; ok = sg; }
    return ok;
  };
  for (let i = 0; i < H.NF; i++) {
    const s = H.S0 + i * H.DS + (rng() - 0.5) * 0.8, e = Math.abs(s - HMID) / HHALF, r = rng(), r2 = rng();
    let hi = r < 0.07 ? 3.3 + rng() * 0.5 : r < 0.34 ? 2.65 + rng() * 0.55 : 1.8 + rng() * 0.75;
    let lo = 0.5 + rng() * 1.5;
    const gone = rng();
    rng(); rng(); rng();
    const fa = (rng() - 0.5) * 0.3, pair = rng(), u = rng(), deep = smoothstep(0.1, 0.35, moundAt(s, 0));
    const eHi = u < 0.45 ? -0.12 : 0.04 + deep * (u < 0.85 ? 0.08 + rng() * 0.3 : 0.45 + rng() * 0.35);
    const eLo = rng() < 0.88 ? -0.12 : 0.04 + deep * (0.03 + rng() * 0.16);
    if (r2 < 0.2 || gone < 0.3 || e > 0.82 || alive(s) < -0.06) continue;
    if ((nearB(s, brHi, 1.1) || nearB(s, brLo, 1.1)) && r2 < 0.75) continue;
    hi *= 1 - 0.4 * e * e;
    if (nearB(s, brHi)) hi = Math.min(hi, 1.2);
    if (nearB(s, brLo)) lo = Math.min(lo, 1.5);
    hi = Math.min(reach(s, -1, hi), held(s, -1, hi, eHi));
    lo = Math.min(reach(s, 1, lo), underMast(s), held(s, 1, lo, eLo));
    const from = -hi, to = r2 > 0.9 ? -Math.min(hi - 0.4, 0.3 + rng() * 0.6) : lo;
    if (to - from < 0.5) continue;
    if (expo(s, from) < -0.02 && expo(s, to) < -0.02 && expo(s, (from + to) / 2) < -0.02) continue;
    frameTimber(ctx, s, from, to, 0, 0, fa);
    ctx.ship.frames++;
    if (hi > 3.2) ctx.ship.tall++;
    if (pair < 0.2 && to - from > 1.4) {
      const s2 = s + (pair < 0.1 ? -1 : 1) * (0.19 + pair * 0.3);
      const f2 = Math.max(from, -Math.min(reach(s2, -1, hi * (0.35 + pair * 2.5)), held(s2, -1, hi, eHi * 0.7))), t2 = Math.min(to, reach(s2, 1, Math.min(lo, 1.3)), held(s2, 1, lo, eLo));
      if (t2 - f2 > 0.6) { frameTimber(ctx, s2, f2, t2, 0, 0, fa * 0.8); ctx.ship.frames++; }
    }
  }
  const runs = { '-1': [], 1: [] }, todo = [];
  for (const side of [-1, 1]) {
    const nk = side < 0 ? 8 : 11, panels = [];
    for (let s = H.STERN + 1.0 + rng() * 1.5; s < H.BOW - 1.6;) {
      const len = side > 0 ? 5 + rng() * 8 : 2.5 + rng() * 4.5;
      panels.push([s, Math.min(H.BOW - 1.0, s + len), rng()]);
      s += len + (side > 0 ? 0.8 + rng() * 2.2 : 1.0 + rng() * 3.0);
    }
    for (let k = 0; k < nk; k++) {
      const sgMid = H.SIG0 + (k + 0.5) * H.PW;
      const test = (ss) => {
        const sc = secAt(side, ss, sgMid), p = hullPt(ss, sc.b, sc.h);
        if (!clearOf(p[0], p[2], 0.15) || sc.h > (side < 0 ? 0.62 : 0.8)) return false;
        return p[1] - (terrainY(p[0], p[2]) + moundAt(ss, sc.b)) < 0.03 + 0.13 * (0.5 + 0.5 * noise3(ss * 0.25 + side * 7.7, k * 0.23, 3.3));
      };
      const br = side < 0 ? (k >= 3 ? brHi : []) : (k >= 5 ? brLo : []);
      for (const [pa, pb, ps] of panels) {
        const a = pa + 0.2 * noise3(k * 0.61, ps * 9.1, 1.3) + (rng() - 0.5) * 0.9, b = pb + 0.2 * noise3(k * 0.61, ps * 9.1, 7.9) + (rng() - 0.5) * 0.9;
        if (b - a < 0.6) continue;
        for (const [a0, b0] of clearRuns(a, b, test, 0.2)) {
          for (const [a1, b1] of cutRuns(a0, b0, br)) {
            if (b1 - a1 <= 1.0) continue;
            const jit = rng() < 0.3 ? { dw: 0.004 + rng() * 0.014, tw: (rng() - 0.5) * 0.06 } : null;
            todo.push([side, k, a1, b1, jit]);
            runs[side].push([k, a1, b1]);
            ctx.ship.strakeRuns++;
            ctx.ship.plankMetres += b1 - a1;
          }
        }
      }
    }
  }
  for (const [side, k, a1, b1, jit] of todo) plankTimber(ctx, side, k, a1, b1, jit, (kk, s) => runs[side].some(([k2, a2, b2]) => k2 === kk && s >= a2 && s <= b2));
  for (const side of [-1, 1]) {
    for (const [k, a, b] of runs[side]) {
      for (const [k2, a2, b2] of runs[side]) {
        if (k2 !== k + 1) continue;
        const lo = Math.max(a, a2) + 0.15, hi = Math.min(b, b2) - 0.15, id = k + 1 + (side > 0 ? 50 : 0), off = (id * 0.618034) % 1;
        for (let m = Math.floor(lo / 0.21 - off) - 1; (m + 0.5 + off) * 0.21 <= hi; m++) {
          const u = (m + 0.5 + off) * 0.21;
          if (u >= lo && seamGap(side, k + 1, u) > 0.01) { tenonBlock(ctx, side, k + 1, u, id); ctx.ship.tenons++; }
        }
      }
    }
  }
  for (const side of [-1, 1]) for (const [k, a, b] of runs[side]) (PLANK.runs[side][k] || (PLANK.runs[side][k] = [])).push([a, b]);
  PLANK.ready = true;
  for (const [a, b, dh] of [[H.STERN + 0.4, -9.3, -0.02], [-8.5, 2.9, 0.0], [3.8, H.BOW - 0.35, -0.05]]) spineTimber(ctx, -0.35 + dh, 0.42, 0.34, a, b);
  const kTop = H.PT + H.FM + 0.3;
  for (const [a, b] of [[-17.2, -11.4], [-10.5, -3.3], [-2.4, 3.3], [5.1, 8.6]]) {
    spineTimber(ctx, H.PT + H.FM, 0.3, 0.3, a, b);
    for (let s = a; s < b - 0.05; s += 2.0) collide(ctx, hullPt(s, 0, kTop - 0.15), hullPt(Math.min(s + 2.0, b), 0, kTop - 0.15), 0.16);
  }
  {
    const ms = -1.4;
    for (const bb of [-0.2, 0.2]) {
      const pts = [[ms - 0.62, bb, kTop - 0.1], [ms - 0.1, bb * 1.05, kTop - 0.04], [ms + 0.58, bb, kTop - 0.12]].map(([s, b, h]) => hullPt(s, b, h));
      timberAlong(ctx, pts, 0.12, 0.2, HB, 0.07);
    }
  }
  const sb = H.BOW, ss = H.STERN;
  const stem = timberAlong(ctx, [[sb - 1.2, 0, -0.32], [sb - 0.4, 0, -0.06], [sb + 0.12, 0.08, 0.45], [sb + 0.34, 0.18, 0.95]].map(([s, b, h]) => hullPt(s, b, h)), 0.3, 0.34, HB, 0.18);
  collide(ctx, stem[Math.floor(stem.length / 2)], stem[stem.length - 1], 0.18);
  embed(ctx, slabSamples(stem[Math.floor(stem.length * 0.3)], stem[Math.floor(stem.length * 0.6)], 0.3, 0.34), stem[Math.floor(stem.length * 0.45)][0], stem[Math.floor(stem.length * 0.45)][2], BANK.timber);
  const post = stumpTimber(ctx, [[ss + 1.1, 0, -0.42], [ss + 0.35, 0, -0.2], [ss - 0.25, 0.12, 0.32], [ss - 0.7, 0.3, 0.82], [ss - 0.95, 0.42, 1.18]].map(([s, b, h]) => hullPt(s, b, h)), 0.3, 0.36);
  collide(ctx, post[Math.floor(post.length / 3)], post[post.length - 1], 0.19);
  ctx.tops.push({ p: post[post.length - 1], n: norm(sub(post[post.length - 1], post[post.length - 3])) });
  {
    const k0 = Math.floor(post.length * 0.3), k1 = Math.floor(post.length * 0.55), m = post[Math.floor(post.length * 0.42)];
    embed(ctx, slabSamples(post[k0], post[k1], 0.3, 0.36), m[0], m[2], { ...BANK.timber, capW: 0.12, scour: 0.4 });
  }
  ctx.decals.push({ x: post[2][0], z: post[2][2], dir: HA, len: 2.0, wid: 1.2, str: 0.55 });
  for (const [s, b, yaw, len, dip] of [[-13.6, 0.4, 0.62, 2.4, 0.16], [-6.9, -0.9, -0.95, 1.7, 0.1], [6.3, 1.0, -0.72, 2.1, 0.14]]) {
    const [x, z] = hullXZ(s, b), d = [Math.cos(LAYOUT.hull.rot + yaw), 0, -Math.sin(LAYOUT.hull.rot + yaw)];
    const A = [x - d[0] * len * 0.5, z - d[2] * len * 0.5], B = [x + d[0] * len * 0.5, z + d[2] * len * 0.5];
    if (!clearOf(A[0], A[1], 0.3) || !clearOf(B[0], B[1], 0.3) || pathDist(x, z) < 1.4) continue;
    const yA = groundM(A[0], A[1]) - dip, yB = groundM(B[0], B[1]) + 0.04;
    const yM = Math.min((yA + yB) / 2, groundM(x, z) + 0.05);
    const ctrl = [[A[0], yA, A[1]], [x, yM, z], [B[0], yB, B[1]]];
    timberAlong(ctx, ctrl, 0.24, 0.22, null, 0.16);
    ctx.px.add({ a: ctrl[0], b: ctrl[2], r: 0.12, sup: true });
    if (yB - terrainY(B[0], B[1]) > 0.35) ctx.caps.push({ a: ctrl[1], b: ctrl[2], r: 0.13 });
    ctx.ship.beams.push([+(yA - terrainY(A[0], A[1])).toFixed(2), +(yB - terrainY(B[0], B[1])).toFixed(2)]);
    ctx.decals.push({ x, z, dir: d, len: len + 0.6, wid: 0.7, str: 0.3 });
  }
  for (const [s, b, yaw] of [[-12.5, 4.2, 0.4], [4.2, -3.4, -0.3]]) {
    const [x, z] = hullXZ(s, b), d = [Math.cos(LAYOUT.hull.rot + yaw), 0, -Math.sin(LAYOUT.hull.rot + yaw)];
    const A = [x - d[0] * 2.1, z - d[2] * 2.1], B = [x + d[0] * 2.1, z + d[2] * 2.1];
    if (!clearOf(A[0], A[1], 0.3) || !clearOf(B[0], B[1], 0.3) || !clearOf(x, z, 0.3)) continue;
    const bw = (rng() - 0.5) * 0.16;
    const ctrl = [A, [x - d[2] * bw, z + d[0] * bw], B].map(([px, pz]) => [px, terrainY(px, pz) + 0.05, pz]);
    timberAlong(ctx, ctrl, 0.24, 0.22, null, 0.14);
    ctx.px.add({ a: ctrl[0], b: ctrl[2], r: 0.13, sup: true });
    embed(ctx, slabSamples(ctrl[0], ctrl[2], 0.24, 0.22), x, z, BANK.timber);
    ctx.decals.push({ x, z, dir: d, len: 4.6, wid: 0.8, str: 0.45 });
  }
  {
    const A = hullXZ(...MAST[0]), B = hullXZ(...MAST[1]), d = norm([B[0] - A[0], 0, B[1] - A[1]]), kink = [-d[2] * 0.22, d[0] * 0.22];
    const at = (t, dx = 0, dz = 0) => [lerp$4(A[0], B[0], t) + dx, lerp$4(A[1], B[1], t) + dz];
    const pieces = [[at(0.03), at(0.47), 0.25, 0.225], [at(0.55, kink[0], kink[1]), at(0.93, kink[0] * 0.4, kink[1] * 0.4), 0.215, 0.195]];
    ctx.ship.mast = [];
    for (const [P0, P1, r0, r1] of pieces) {
      if (!clearOf(P0[0], P0[1], 0.4) || !clearOf(P1[0], P1[1], 0.4)) continue;
      const ctrl = [];
      for (let k = 0; k <= 4; k++) {
        const t = k / 4, x = lerp$4(P0[0], P1[0], t), z = lerp$4(P0[1], P1[1], t), r = lerp$4(r0, r1, t);
        ctrl.push([x, groundM(x, z) + r * (0.08 + 0.14 * (0.5 + 0.5 * noise3(x * 1.7, z * 1.7, 4.4))), z]);
      }
      roundTimber(ctx, ctrl, r0, r1);
      for (let k = 0; k < 4; k++) collide(ctx, ctrl[k], ctrl[k + 1], lerp$4(r0, r1, (k + 0.5) / 4));
      ctx.ship.mast.push([+(ctrl[0][1] - terrainY(P0[0], P0[1])).toFixed(2), +(ctrl[4][1] - terrainY(P1[0], P1[1])).toFixed(2)]);
    }
    for (let t = 0.1; t < 1; t += 0.2) ctx.decals.push({ x: lerp$4(A[0], B[0], t), z: lerp$4(A[1], B[1], t), dir: d, len: 2.4, wid: 0.9, str: 0.3 });
  }
  {
    const [x, z] = hullXZ(ss + 2.6, 3.1), yaw = LAYOUT.hull.rot + 0.9, d = [Math.cos(yaw), 0, -Math.sin(yaw)];
    if (clearOf(x, z, 1.5)) {
      const at = (t, lift) => { const px = x + d[0] * t, pz = z + d[2] * t; return [px, terrainY(px, pz) + lift, pz]; };
      timberAlong(ctx, [at(-1, 0.03), at(-0.3, 0.035), at(0.4, 0.03), at(0.95, 0.02)], (u) => 0.26 + 0.3 * smoothstep(0, 0.4, u) - 0.14 * smoothstep(0.86, 1, u), (u) => 0.1 - 0.05 * u, null, 0.05);
      roundTimber(ctx, [at(-1, 0.07), at(-1.8, 0.08), at(-2.5, 0.09)], 0.1, 0.09);
      ctx.ship.oar = true;
      ctx.px.add({ a: at(-2.5, 0.05), b: at(0.95, 0.03), r: 0.2 });
      ctx.decals.push({ x, z, dir: d, len: 3.8, wid: 0.9, str: 0.45 });
    }
  }
  {
    const [cx, cz] = hullXZ(5.4, 1.1), sd = rng(), turns = 2.7;
    if (clearOf(cx, cz, 0.6)) {
      let run = [], y0 = null;
      const flush = () => {
        if (run.length > 4) {
          const tmp = new MB({ aLoc: 3, aMisc: 4, color: 3 });
          sweep(tmp, run, (u) => 0.034 * (0.8 + 0.35 * noise3(u * 24, sd * 5, 1.1)), 7, 2, (u, p) => ({ aLoc: p, aMisc: [6, sd, 0, 0], color: [0.27, 0.28, 0.23] }), true, true, 0.01);
          ctx.misc.append(tmp, null, floorAttrM);
        }
        run = [];
      };
      for (let k = 0; k <= 44; k++) {
        const th = (k / 44) * turns * TAU$8, r = 0.11 + 0.25 * (k / 44), x = cx + Math.cos(th) * r, z = cz + Math.sin(th) * r;
        if (noise3(k * 0.31, sd * 7, 2.1) > 0.3) { flush(); continue; }
        const y = groundM(x, z) + 0.004 + 0.01 * noise3(x * 5, z * 5, sd * 9);
        if (y0 === null) y0 = y;
        run.push([x, y, z]);
      }
      flush();
      ctx.ship.rope = true;
      ctx.discs.push([cx, cz, 0.45]);
      ctx.px.add({ a: [cx - 0.3, y0 === null ? groundM(cx, cz) : y0, cz], b: [cx + 0.3, y0 === null ? groundM(cx, cz) : y0, cz], r: 0.33 });
      ctx.decals.push({ x: cx, z: cz, dir: HA, len: 0.9, wid: 0.9, str: 0.3 });
    }
  }
  for (const [a, b, g0, g1] of [[-13.6, -11.2, 1.7, 2.3], [-7.8, -5.6, 1.75, 2.35], [5.4, 7.2, 1.65, 2.2]]) {
    const sc = secAt(-1, (a + b) / 2, (g0 + g1) / 2), p = hullPt((a + b) / 2, sc.b, sc.h);
    if (clearOf(p[0], p[2], 1.3)) { sheathing(ctx, a, b, g0, g1); ctx.ship.lead++; }
  }
  for (let s = H.STERN + 2; s <= H.BOW - 2; s += 3.5) {
    const sc = secAt(-1, s, 3.0), p = hullPt(s, sc.b, sc.h);
    ctx.fishObs.push({ x: p[0], y: p[1], z: p[2], r: 0.15 });
  }
  for (let s = H.STERN + 0.6; s <= H.BOW - 0.6; s += 1.2) {
    for (const side of [-1, 1]) {
      const sc = secAt(side, s, side < 0 ? 2.7 : 3.3), [x, z] = hullXZ(s, sc.b);
      if (clearOf(x, z, 0)) ctx.decals.push({ x, z, dir: HA, len: 1.9, wid: side < 0 ? 1.2 : 0.9, str: side < 0 ? 0.5 : 0.35 });
    }
  }
}

function pathCrossings(bLine) {
  const out = [], pts = LAYOUT.frags.map((f) => toHull(f.x, f.z));
  for (let i = 0; i < pts.length; i++) {
    for (let j = i + 1; j < pts.length; j++) {
      const [s1, b1] = pts[i], [s2, b2] = pts[j];
      if ((b1 - bLine) * (b2 - bLine) < 0) out.push(s1 + (s2 - s1) * ((bLine - b1) / (b2 - b1)));
    }
  }
  return out;
}
function pathDist(x, z) {
  let best = Infinity;
  for (let i = 0; i < LAYOUT.frags.length; i++) {
    for (let j = i + 1; j < LAYOUT.frags.length; j++) {
      const a = LAYOUT.frags[i], b = LAYOUT.frags[j];
      best = Math.min(best, segDistXZ(x, z, [a.x, 0, a.z], [b.x, 0, b.z]));
    }
  }
  return best;
}

const moundRag = (s, b) => 0.35 * noise3(s * 0.5 + 1.1, b * 0.5 - 2.7, 5.3) + 0.15 * noise3(s * 1.6, b * 1.6, 8.8);
function moundBody(s, b, rag) {
  const H = HULL;
  const along = smoothstep(H.STERN - 1.8, H.STERN + 2.2, s + rag * 2) * (1 - smoothstep(H.BOW - 2.2, H.BOW + 1.8, s + rag * 2));
  if (along <= 0) return 0;
  const sw = Math.max(secScale(s), 0.6), half = 2.4 * sw + 0.7;
  const core = 1 - smoothstep(half * 0.45, half * 1.2, Math.abs(b - 0.2) + rag);
  const bankHi = smoothstep(-0.6, 1.3 * sw, -b) * (1 - smoothstep(2.35 * sw + 0.3, 2.35 * sw + 1.9, -b + rag * 1.1));
  const bankLo = smoothstep(0.0, 1.5 * sw, b) * (1 - smoothstep(2.6 * sw + 0.35, 2.6 * sw + 2.2, b + rag * 1.1));
  const spill = smoothstep(-6, -2.5, s) * (1 - smoothstep(6.5, 10, s)) * smoothstep(-0.5, 1.5, b) * (1 - smoothstep(2.2, 5.8, b + rag));
  const lump = 0.72 + 0.38 * noise3(s * 0.45 + 2.3, b * 0.6, 4.1) + 0.14 * noise3(s * 1.7, b * 1.9, 7.7);
  const hp = Math.max(0, 1 - ((s + 10.5) / 2.4) ** 2 - (b / 1.55) ** 2), heap = hp * hp * (3 - 2 * hp);
  return along * (Math.max(core * 0.5, bankHi * 0.42, bankLo * 0.34, spill * 0.22) * lump + 0.32 * heap);
}
function moundMask(x, z, rag) {
  let d = Math.hypot(x - LAYOUT.assembly.x, z - LAYOUT.assembly.z) - 6;
  for (const f of LAYOUT.frags) d = Math.min(d, Math.hypot(x - f.x, z - f.z) - 2.5);
  return smoothstep(0.3, 2.4, d + rag) * smoothstep(0.7, 3.2, pathDist(x, z) + rag);
}
const MG = { S0: HULL.STERN - 3.0, B0: -6, ds: 0.25, db: 0.2, ns: 0, nb: 0, H: null, D: null };
const SKIRT = 0.02;
function bakeMound() {
  if (MG.H) return;
  const ds = MG.ds, db = MG.db;
  const ns = Math.round((HULL.BOW + 3.0 - MG.S0) / ds), nb = Math.round((8.6 - MG.B0) / db), W = nb + 1, n = (ns + 1) * W;
  MG.ns = ns; MG.nb = nb;
  const R = new Float32Array(n), MK = new Float32Array(n);
  for (let i = 0; i <= ns; i++) {
    for (let j = 0; j <= nb; j++) {
      const s = MG.S0 + i * ds, b = MG.B0 + j * db, [x, z] = hullXZ(s, b), rag = moundRag(s, b), k = i * W + j;
      MK[k] = moundMask(x, z, rag);
      R[k] = MK[k] > 0 ? moundBody(s, b, rag) * MK[k] : 0;
    }
  }
  const gauss = (src, alongS, sig) => {
    const r = Math.ceil(sig * 3), wt = [];
    let sum = 0;
    for (let o = -r; o <= r; o++) { const w = Math.exp(-(o * o) / (2 * sig * sig)); wt.push(w); sum += w; }
    for (let o = 0; o < wt.length; o++) wt[o] /= sum;
    const out = new Float32Array(n);
    for (let i = 0; i <= ns; i++) {
      for (let j = 0; j <= nb; j++) {
        let acc = 0;
        for (let o = -r; o <= r; o++) {
          const ii = alongS ? clamp$9(i + o, 0, ns) : i, jj = alongS ? j : clamp$9(j + o, 0, nb);
          acc += src[ii * W + jj] * wt[o + r];
        }
        out[i * W + j] = acc;
      }
    }
    return out;
  };
  const Hb = gauss(gauss(R, true, 0.45 / ds), false, 0.45 / db);
  const D = new Float32Array(n), dd = Math.hypot(ds, db);
  for (let k = 0; k < n; k++) D[k] = Hb[k] * MK[k] < 0.012 ? 0 : 1e9;
  for (let i = 0; i <= ns; i++) {
    for (let j = 0; j <= nb; j++) {
      const k = i * W + j;
      let d = D[k];
      if (d === 0) continue;
      if (i > 0) { d = Math.min(d, D[k - W] + ds); if (j > 0) d = Math.min(d, D[k - W - 1] + dd); if (j < nb) d = Math.min(d, D[k - W + 1] + dd); }
      if (j > 0) d = Math.min(d, D[k - 1] + db);
      D[k] = d;
    }
  }
  for (let i = ns; i >= 0; i--) {
    for (let j = nb; j >= 0; j--) {
      const k = i * W + j;
      let d = D[k];
      if (d === 0) continue;
      if (i < ns) { d = Math.min(d, D[k + W] + ds); if (j > 0) d = Math.min(d, D[k + W - 1] + dd); if (j < nb) d = Math.min(d, D[k + W + 1] + dd); }
      if (j < nb) d = Math.min(d, D[k + 1] + db);
      D[k] = d;
    }
  }
  const Hf = new Float32Array(n);
  for (let k = 0; k < n; k++) Hf[k] = Hb[k] * MK[k] * smoothstep(0, 1.6, D[k]);
  MG.H = Hf;
  MG.D = D;
}
function moundAt(s, b) {
  if (!MG.H) return 0;
  const u = (s - MG.S0) / MG.ds, v = (b - MG.B0) / MG.db;
  if (!(u >= 0 && v >= 0 && u < MG.ns && v < MG.nb)) return 0;
  const i = u | 0, j = v | 0, fu = u - i, fv = v - j, W = MG.nb + 1, k = i * W + j, H = MG.H;
  return (H[k] * (1 - fv) + H[k + 1] * fv) * (1 - fu) + (H[k + W] * (1 - fv) + H[k + W + 1] * fv) * fu;
}
const moundLift = (h) => h - SKIRT * (1 - smoothstep(0, 0.04, h));
const TA = new Float32Array(13), SA3 = [0, 0, 0];
function sedAttrs(x, z, h, out) {
  terrainAttrs(x, z, out);
  const cv = smoothstep(0.0, 0.06, h);
  if (cv <= 0) return out;
  sandAlbedo(x, z, out[9], SA3);
  out[0] += (SA3[0] - out[0]) * cv; out[1] += (SA3[1] - out[1]) * cv; out[2] += (SA3[2] - out[2]) * cv;
  out[3] += (1 - out[3]) * cv; out[4] *= 1 - cv; out[5] *= 1 - cv;
  out[8] += (clamp$9(1 - 0.9 * out[7], 0, 1) - out[8]) * cv;
  return out;
}
function sedimentMound(extra) {
  const src = SEDIMENT.material;
  if (!src || !MG.H) return null;
  const { ns, nb, H: M, D, S0, B0, ds, db } = MG, W = nb + 1, n = (ns + 1) * W;
  const P = [], C = [], T = [], T2 = [], I = [], NB = [], vid = new Int32Array(n).fill(-1);
  const vert = (k) => {
    if (vid[k] >= 0) return vid[k];
    const i = Math.floor(k / W), j = k - i * W, [x, z] = hullXZ(S0 + i * ds, B0 + j * db), h = M[k];
    sedAttrs(x, z, h, TA);
    const inner = smoothstep(0.4, 1.8, D[k]) * smoothstep(0.03, 0.22, h);
    const org = clamp$9(TA[9] + inner * (0.08 + 0.1 * clamp$9(0.5 + noise3(x * 0.7, z * 0.7, 3.3), 0, 1)), 0, 1);
    P.push(x, terrainY(x, z) + moundLift(h), z);
    C.push(TA[0], TA[1], TA[2]);
    T.push(TA[3], TA[4], TA[5], TA[6] * (1 - 0.04 * inner));
    T2.push(TA[7], TA[8] * (1 - 0.12 * inner), org);
    NB.push(1 - smoothstep(0.02, 0.22, h), TA[10], TA[11], TA[12]);
    return (vid[k] = P.length / 3 - 1);
  };
  for (let i = 0; i < ns; i++) {
    for (let j = 0; j < nb; j++) {
      const a = i * W + j, b = a + 1, c = a + W, d = c + 1;
      if (Math.max(M[a], M[b], M[c], M[d]) < 0.004) continue;
      const va = vert(a), vb = vert(b), vc = vert(c), vd = vert(d);
      I.push(va, vc, vb, vb, vc, vd);
    }
  }
  if (extra && extra.I.length) {
    const base = P.length / 3;
    for (let k = 0; k < extra.P.length; k++) P.push(extra.P[k]);
    for (let k = 0; k < extra.C.length; k++) C.push(extra.C[k]);
    for (let k = 0; k < extra.T.length; k++) T.push(extra.T[k]);
    for (let k = 0; k < extra.T2.length; k++) T2.push(extra.T2[k]);
    for (let k = 0; k < extra.NB.length; k++) NB.push(extra.NB[k]);
    for (let k = 0; k < extra.I.length; k++) I.push(extra.I[k] + base);
  }
  if (!I.length) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
  g.setAttribute('aTer', new THREE.Float32BufferAttribute(T, 4));
  g.setAttribute('aTer2', new THREE.Float32BufferAttribute(T2, 3));
  g.setIndex(I);
  g.computeVertexNormals();
  {
    const NA = g.attributes.normal.array;
    for (let v = 0; v < NB.length / 4; v++) {
      const w = NB[v * 4];
      if (w <= 0) continue;
      const nx = NA[v * 3] * (1 - w) + NB[v * 4 + 1] * w, ny = NA[v * 3 + 1] * (1 - w) + NB[v * 4 + 2] * w, nz = NA[v * 3 + 2] * (1 - w) + NB[v * 4 + 3] * w;
      const l = Math.hypot(nx, ny, nz) || 1;
      NA[v * 3] = nx / l; NA[v * 3 + 1] = ny / l; NA[v * 3 + 2] = nz / l;
    }
  }
  const mat = src.clone();
  mat.onBeforeCompile = src.onBeforeCompile;
  mat.customProgramCacheKey = src.customProgramCacheKey;
  mat.polygonOffset = true;
  mat.polygonOffsetFactor = 1;
  mat.polygonOffsetUnits = 1;
  const mesh = new THREE.Mesh(g, mat);
  mesh.name = 'wreck-sediment';
  mesh.receiveShadow = true;
  return mesh;
}

function armSDF() {
  const S = [0.0, -0.32, 0.0], E = [0.10, 0.30, 0.04], W = [0.21, 0.72, 0.17];
  const d = norm(sub(W, E)), s = norm(cross(d, [0, 0, 1])), n = cross(s, d);
  const comb = (...t) => t.reduce((acc, [v, k]) => mad(acc, v, k), [0, 0, 0]);
  const cones = [[S, E, 0.085, 0.072, 0.03], [E, W, 0.07, 0.048, 0.03]];
  const lens = [[0.030, 0.025], [0.033, 0.028], [0.031, 0.025], [0.024, 0.02]];
  for (let i = 0; i < 4; i++) {
    const K = comb([W, 1], [d, 0.095], [s, -0.036 + 0.024 * i]), Wp = comb([W, 1], [s, -0.02 + 0.013 * i], [d, 0.01]);
    const F1 = comb([K, 1], [d, lens[i][0]], [n, 0.010]), F2 = comb([F1, 1], [d, lens[i][1]], [n, 0.018]);
    cones.push([Wp, K, 0.026, 0.021, 0.02], [K, F1, 0.0125, 0.0112, 0.008], [F1, F2, 0.0112, 0.0092, 0.006]);
  }
  const T0 = comb([W, 1], [d, 0.025], [s, -0.04], [n, 0.012]), T1 = comb([T0, 1], [d, 0.035], [s, -0.03], [n, 0.02]), T2 = comb([T1, 1], [d, 0.03], [s, -0.012], [n, 0.012]);
  cones.push([T0, T1, 0.016, 0.013, 0.012], [T1, T2, 0.013, 0.010, 0.008]);
  const far = comb([W, 1], [d, 0.2]);
  const sdf = (x, y, z) => {
    const coarse = Math.min(sdCone$1(x, y, z, S, E, 0.1, 0.1), sdCone$1(x, y, z, E, far, 0.12, 0.12));
    if (coarse > 0.06) return coarse;
    const core = Math.min(sdCone$1(x, y, z, S, E, 0.06, 0.05), sdCone$1(x, y, z, E, W, 0.045, 0.03));
    if (core < -0.012 && y > -0.2) return core;
    let dd = 1e9;
    for (const [a, b, ra, rb, k] of cones) dd = smin$2(dd, sdCone$1(x, y, z, a, b, ra, rb), k);
    if (Math.abs(dd) < 0.012) dd += noise3(x * 38, y * 38, z * 38) * 0.0022 + noise3(x * 11, y * 11, z * 11) * 0.004;
    return Math.max(dd, -(y + 0.22));
  };
  return { sdf, min: [-0.14, -0.26, -0.12], max: [0.42, 1.02, 0.42], step: 0.0072, S, E, W };
}
const headSDF = (() => {
  const B0 = [0, -0.025, 0.005], B1 = [0.125, 0.2, 0.15], K0 = [0, 0.02, 0.0], K1 = [0.05, 0.07, 0.06];
  const SK = [[0, 0.045, -0.012], [0.079, 0.093, 0.098]], FC = [[0, -0.012, 0.035], [0.066, 0.088, 0.07]], JW = [[0.034, -0.05, 0.03], [0.036, 0.048, 0.052]];
  const BR = [[0.004, 0.036, 0.087], [0.046, 0.034, 0.074]], CH = [[0.045, 0.0, 0.062], [0.02, 0.014, 0.022]], SO = [[0.031, 0.014, 0.092], [0.019, 0.012, 0.017]];
  const LID = [[0.018, 0.022, 0.087], [0.045, 0.02, 0.078]], NO = [[0, 0.026, 0.094], [0, -0.018, 0.121]], AL = [[0.013, -0.02, 0.107], [0.011, 0.008, 0.01]];
  const CR = [[0, 0.05, 0.095], [0, 0.03, 0.098]], MU = [[0.003, -0.032, 0.109], [0.034, -0.052, 0.094]], LL = [[0, -0.047, 0.102], [0.014, 0.005, 0.007]];
  const BD = [[0, -0.085, 0.052], [0.063, 0.068, 0.055]], BF = [[0.018, -0.14, 0.05], [0.032, 0.05, 0.038]], HA = [[0, 0.05, -0.028], [0.094, 0.1, 0.104]];
  const HS = [[0.062, -0.01, -0.03], [0.04, 0.07, 0.06]], NK = [[0, -0.06, -0.035], [0, -0.2, -0.05]];
  return (x, y, z) => {
    const bound = sdEllipsoid$1(x, y, z, B0, B1);
    if (bound > 0.022) return bound;
    const core = sdEllipsoid$1(x, y, z, K0, K1);
    if (core < -0.01) return core;
    const ax = Math.abs(x);
    let d = sdEllipsoid$1(x, y, z, SK[0], SK[1]);
    d = smin$2(d, sdEllipsoid$1(x, y, z, FC[0], FC[1]), 0.035);
    d = smin$2(d, sdEllipsoid$1(ax, y, z, JW[0], JW[1]), 0.025);
    d = smin$2(d, sdCone$1(ax, y, z, BR[0], BR[1], 0.015, 0.012), 0.016);
    d = smin$2(d, sdEllipsoid$1(ax, y, z, CH[0], CH[1]), 0.014);
    d = smax$1(d, -sdEllipsoid$1(ax, y, z, SO[0], SO[1]), 0.01);
    d = smin$2(d, sdSphere(ax, y, z, 0.03, 0.012, 0.075, 0.0125), 0.004);
    d = smin$2(d, sdCone$1(ax, y, z, LID[0], LID[1], 0.004, 0.004), 0.006);
    d = smin$2(d, sdCone$1(x, y, z, NO[0], NO[1], 0.0095, 0.0145), 0.012);
    d = smin$2(d, sdEllipsoid$1(ax, y, z, AL[0], AL[1]), 0.007);
    d = smax$1(d, -sdSphere(ax, y, z, 0.008, -0.026, 0.112, 0.0035), 0.003);
    d = smax$1(d, -sdCone$1(x, y, z, CR[0], CR[1], 0.003, 0.003), 0.004);
    d = smin$2(d, sdCone$1(ax, y, z, MU[0], MU[1], 0.0085, 0.006), 0.009);
    d = smin$2(d, sdEllipsoid$1(x, y, z, LL[0], LL[1]), 0.005);
    d = smin$2(d, sdEllipsoid$1(x, y, z, BD[0], BD[1]), 0.03);
    d = smin$2(d, sdEllipsoid$1(ax, y, z, BF[0], BF[1]), 0.03);
    let hair = smin$2(sdEllipsoid$1(x, y, z, HA[0], HA[1]), sdEllipsoid$1(ax, y, z, HS[0], HS[1]), 0.03);
    hair = smax$1(hair, z - 0.03 - 0.4 * Math.max(0, y - 0.02), 0.02);
    if (Math.abs(hair) < 0.03) {
      const lk = Math.sin(Math.atan2(x, -z) * 11 + noise3(x * 24, y * 24, z * 24) * 3 + y * 30);
      hair += -4e-3 * lk - 0.009 * noise3(x * 13 + 3, y * 13, z * 13) - 0.003 * noise3(x * 45, y * 45, z * 45);
    }
    d = smin$2(d, hair, 0.012);
    if (y < -0.025 && Math.abs(d) < 0.012) d += 0.0028 * Math.sin(x * 190 + noise3(x * 30, y * 30, z * 30) * 4) * smoothstep(-0.03, -0.07, y);
    d += 0.0011 * Math.sin(y * 480) * smoothstep(0.034, 0.05, y) * (1 - smoothstep(0.075, 0.09, y)) * smoothstep(0.06, 0.085, z);
    d = smin$2(d, sdCone$1(x, y, z, NK[0], NK[1], 0.05, 0.056), 0.03);
    d = Math.max(d, -(y + 0.19));
    return Math.abs(d) < 0.008 ? d + noise3(x * 70, y * 70, z * 70) * 0.0011 : d;
  };
})();
const torsoSDF = (() => {
  const CA = [0, -0.3, 0.01], CB = [0, 0.56, 0], CS = [0, 0.44, 0], CT = [0.26, 0.36, 0];
  const K0 = [[0, 0.3, 0], [0.11, 0.16, 0.065]], K1 = [[0, -0.03, 0], [0.1, 0.09, 0.055]];
  const RIB = [[0, 0.33, -5e-3], [0.155, 0.19, 0.105]], PEC = [[0.068, 0.365, 0.064], [0.085, 0.058, 0.044]], LAT = [[0.118, 0.3, -0.02], [0.05, 0.12, 0.075]];
  const DEL = [[0.175, 0.435, 0.0], [0.07, 0.066, 0.068]], UA = [[0.19, 0.43, 0.0], [0.245, 0.33, 0.012]], TRA = [[0.064, 0.462, -0.03], [0.085, 0.045, 0.06]];
  const NEK = [[0, 0.45, -6e-3], [0, 0.585, 0.01]], ABD = [[0, 0.16, 0.0], [0.128, 0.16, 0.094]], OBL = [[0.104, 0.12, 0.02], [0.046, 0.085, 0.07]];
  const RA = [[[0.034, 0.238, 0.077], [0.03, 0.028, 0.026]], [[0.034, 0.172, 0.077], [0.03, 0.028, 0.028]], [[0.034, 0.106, 0.077], [0.03, 0.028, 0.028]]];
  const PEL = [[0, -0.04, 0.0], [0.155, 0.10, 0.10]], GLU = [[0.07, -0.07, -0.056], [0.085, 0.095, 0.07]], THI = [[0.085, -0.1, 0.012], [0.105, -0.3, 0.03]];
  const GA = [0.125, 0.075, 0.055], GB = [0.035, -0.07, 0.085], SA = [0.19, 0.43, 0.0], SB = [0.382, 0.082, 0.04];
  return (x, y, z) => {
    const ax = Math.abs(x);
    const coarse = Math.min(sdCone$1(x, y, z, CA, CB, 0.21, 0.21), sdCone$1(ax, y, z, CS, CT, 0.09, 0.09));
    if (coarse > 0.03) return coarse;
    const core = Math.min(sdEllipsoid$1(x, y, z, K0[0], K0[1]), sdEllipsoid$1(x, y, z, K1[0], K1[1]));
    if (core < -0.015) return core;
    let d = sdEllipsoid$1(x, y, z, RIB[0], RIB[1]);
    d = smin$2(d, sdEllipsoid$1(ax, y, z, PEC[0], PEC[1]), 0.022);
    d = smin$2(d, sdEllipsoid$1(ax, y, z, LAT[0], LAT[1]), 0.04);
    d = smin$2(d, sdEllipsoid$1(ax, y, z, DEL[0], DEL[1]), 0.04);
    d = smin$2(d, sdCone$1(ax, y, z, UA[0], UA[1], 0.057, 0.051), 0.02);
    d = smin$2(d, sdEllipsoid$1(ax, y, z, TRA[0], TRA[1]), 0.04);
    d = smin$2(d, sdCone$1(x, y, z, NEK[0], NEK[1], 0.057, 0.053), 0.03);
    d = smin$2(d, sdEllipsoid$1(x, y, z, ABD[0], ABD[1]), 0.05);
    for (const [c, r] of RA) d = smin$2(d, sdEllipsoid$1(ax, y, z, c, r), 0.011);
    d = smin$2(d, sdEllipsoid$1(ax, y, z, OBL[0], OBL[1]), 0.03);
    d = smin$2(d, sdEllipsoid$1(x, y, z, PEL[0], PEL[1]), 0.05);
    d = smin$2(d, sdEllipsoid$1(ax, y, z, GLU[0], GLU[1]), 0.03);
    d = smin$2(d, sdCone$1(ax, y, z, THI[0], THI[1], 0.085, 0.074), 0.035);
    d += 0.0045 * Math.exp(-(x * x) / 0.0004) * smoothstep(0.0, 0.05, z) * smoothstep(-0.02, 0.06, y) * (1 - smoothstep(0.3, 0.36, y));
    d += 0.006 * Math.exp(-(x * x) / 0.0006) * smoothstep(0.0, -0.05, z) * smoothstep(0.0, 0.1, y);
    const dg = sdCone$1(ax, y, z, GA, GB, 0, 0);
    d += 0.005 * Math.exp(-(dg * dg) / 0.00012);
    const stump = sdCone$1(ax, y, z, SA, SB, 0, 0), pn = y - 0.56, pt = -(y + 0.262), pa = (ax - 0.222) * 0.48 - (y - 0.38) * 0.87 + z * 0.1;
    const chip = pn > -0.03 || pt > -0.03 || (stump < 0.12 && pa > -0.03) ? noise3(x * 20, y * 20, z * 20) * 0.011 + noise3(x * 55, y * 55, z * 55) * 0.004 : 0;
    d = Math.max(d, pn + chip, pt + chip, Math.min(pa + chip, 0.09 - stump));
    return Math.abs(d) < 0.008 ? d + noise3(x * 48, y * 48, z * 48) * 0.0012 : d;
  };
})();
function lampSDF(x, y, z) {
  let d = sdEllipsoid$1(x, y, z, [0, 0.0, 0], [0.036, 0.017, 0.036]);
  d = smin$2(d, sdCone$1(x, y, z, [0.02, 0.0, 0], [0.066, 0.002, 0], 0.012, 0.0105), 0.012);
  d = Math.max(d, x - 0.073);
  d = smax$1(d, -sdCone$1(x, y, z, [0.062, 0.03, 0], [0.062, -2e-3, 0], 0.0042, 0.0042), 0.002);
  d = smax$1(d, -sdEllipsoid$1(x, y, z, [0, 0.02, 0], [0.024, 0.006, 0.024]), 0.004);
  d = smax$1(d, -sdCone$1(x, y, z, [0, 0.03, 0], [0, 0.0, 0], 0.0075, 0.0065), 0.002);
  d = smin$2(d, Math.hypot(Math.hypot(x + 0.041, y - 0.006) - 0.011, z) - 0.0042, 0.004);
  return smin$2(d, sdCone$1(x, y, z, [0, -0.016, 0], [0, -0.019, 0], 0.02, 0.02), 0.004);
}
function cavityAt(sdf, x, y, z, nx, ny, nz) {
  let occ = 0;
  const D = [0.007, 0.016, 0.03, 0.05], Wt = [0.4, 0.3, 0.2, 0.1];
  for (let k = 0; k < 4; k++) occ += (Math.max(0, D[k] - sdf(x + nx * D[k], y + ny * D[k], z + nz * D[k])) / D[k]) * Wt[k];
  return clamp$9(1 - occ * 1.4, 0, 1);
}
function addSculpt(mb, sdf, min, max, step, q, s, x, z, bury, sd) {
  const geo = surfaceNets$2(sdf, min, max, step);
  const P = geo.attributes.position.array, N = geo.attributes.normal.array, I = geo.index.array, n = P.length / 3;
  let low = Infinity;
  for (let i = 0; i < n; i += 7) {
    const w = qRot(q, [P[i * 3] * s, P[i * 3 + 1] * s, P[i * 3 + 2] * s]);
    low = Math.min(low, w[1] - terrainY(x + w[0], z + w[2]));
  }
  const xf = { p: [x, -low - bury, z], q, s }, base = mb.count;
  for (let i = 0; i < n; i++) {
    const lx = P[i * 3], ly = P[i * 3 + 1], lz = P[i * 3 + 2], wp = xp(xf, [lx, ly, lz]);
    const a = { aLoc: [lx * s, ly * s, lz * s], aCav: cavityAt(sdf, lx, ly, lz, N[i * 3], N[i * 3 + 1], N[i * 3 + 2]), aFloor: terrainY(wp[0], wp[2]) };
    if ('aSeed' in mb.spec) a.aSeed = sd;
    mb.v(wp, qRot(q, [N[i * 3], N[i * 3 + 1], N[i * 3 + 2]]), a);
  }
  for (let t = 0; t < I.length; t++) mb.I.push(I[t] + base);
  return xf;
}

const KLINE = [[0.0, 0.0], [0.02, 0.0], [0.027, 0.006], [0.028, 0.014], [0.022, 0.02], [0.018, 0.028], [0.019, 0.04], [0.025, 0.05],
  [0.036, 0.068], [0.044, 0.088], [0.047, 0.108], [0.043, 0.126], [0.03, 0.14], [0.02, 0.15], [0.017, 0.162], [0.025, 0.17],
  [0.032, 0.176], [0.032, 0.184], [0.022, 0.19], [0.016, 0.2], [0.017, 0.222], [0.025, 0.245], [0.034, 0.268], [0.037, 0.29],
  [0.034, 0.305], [0.024, 0.312], [0.02, 0.318], [0.026, 0.326], [0.029, 0.334], [0.024, 0.342], [0.014, 0.348], [0.012, 0.37], [0.0, 0.372]];
function klineLeg(sd) {
  const mb = new MB({ aLoc: 3, aCav: 1, aSeed: 1 }), path = pathNormals(crSample(KLINE, 3));
  const cav = path.map((p, i) => { const a = path[Math.max(0, i - 2)], b = path[Math.min(path.length - 1, i + 2)]; return clamp$9(1 - ((a.r + b.r) / 2 - p.r) * 45, 0.25, 1); });
  lathe$1(mb, path, 28, (p, pos, ph, i) => ({ aLoc: pos, aCav: cav[i], aSeed: sd }));
  return mb;
}
const PLATE_OUT = [[0.0, 0.0045], [0.028, 0.0045], [0.033, 0.0008], [0.037, 0.0], [0.042, 0.0], [0.045, 0.004], [0.06, 0.008], [0.085, 0.017], [0.105, 0.026], [0.114, 0.031], [0.1155, 0.035]];
function coinGeometry() {
  const mb = new MB({}), seg = 30;
  const prof = [[0, 0.5], [0.3, 0.495], [0.62, 0.482], [0.86, 0.455], [0.96, 0.38], [1.0, 0.2], [1.0, -0.2], [0.96, -0.38], [0.86, -0.455], [0.62, -0.482], [0.3, -0.495], [0, -0.5]];
  const rim = (ph) => 1 + 0.035 * Math.sin(3 * ph + 1.3) + 0.022 * Math.sin(5 * ph + 0.4) + 0.012 * Math.sin(9 * ph + 2.0);
  for (const [r, y] of prof) {
    for (let j = 0; j < seg; j++) {
      const ph = (j / seg) * TAU$8, c = Math.cos(ph), s = Math.sin(ph), rr = r * rim(ph);
      mb.v([rr * c, y, rr * s], [c * r, y * 2, s * r], {});
    }
  }
  for (let i = 0; i < prof.length - 1; i++) {
    for (let j = 0; j < seg; j++) { const a = i * seg + j, b = i * seg + ((j + 1) % seg); mb.quad(a, a + seg, b + seg, b); }
  }
  mb.fixWinding(0);
  mb.smooth(0, 0);
  return mb.geometry();
}
const BOWL = [[0.0, 0.0], [0.03, 0.0012], [0.055, 0.008], [0.072, 0.02], [0.082, 0.035], [0.087, 0.05], [0.089, 0.062], [0.0875, 0.066],
  [0.0845, 0.064], [0.083, 0.05], [0.078, 0.035], [0.068, 0.022], [0.052, 0.0115], [0.028, 0.0055], [0.0, 0.0045]];
function bowlGeometry() {
  const mb = new MB({ aSide: 1 }), pts = pathNormals(crSample(BOWL, 4));
  let top = 0;
  pts.forEach((p, i) => { if (p.y > pts[top].y) top = i; });
  const path = pts.map((p, i) => ({ ...p, side: i > top ? 1 : 0 }));
  const rib = (ph, p) => (p.side ? 0 : 0.0026 * Math.pow(Math.max(0, Math.cos(ph * 13)), 2) * smoothstep(0.004, 0.012, p.y) * (1 - smoothstep(0.042, 0.054, p.y)));
  lathe$1(mb, path, 104, (p) => ({ aSide: p.side }), rib);
  mb.smooth(0, 0);
  return mb.geometry();
}
function stoneMB(rng, size, colour, sd) {
  const mb = new MB({ aLoc: 3, aMisc: 4, color: 3 }), rows = 10, seg = 16, o = rng() * 50;
  const sx = size * (0.8 + rng() * 0.5), sy = size * (0.45 + rng() * 0.28), sz = size * (0.8 + rng() * 0.4);
  const planes = [];
  for (let f = 0, nf = 2 + Math.floor(rng() * 3); f < nf; f++) {
    const t = rng() * TAU$8, u = rng() * 1.6 - 0.8, r = Math.sqrt(1 - u * u);
    planes.push([r * Math.cos(t), u, r * Math.sin(t), 0.74 + rng() * 0.18]);
  }
  for (let i = 0; i <= rows; i++) {
    const th = (i / rows) * Math.PI;
    for (let j = 0; j < seg; j++) {
      const ph = (j / seg) * TAU$8, dd = [Math.sin(th) * Math.cos(ph), -Math.cos(th), Math.sin(th) * Math.sin(ph)];
      let k = 1 + 0.2 * noise3(dd[0] * 1.6 + o, dd[1] * 1.6, dd[2] * 1.6) + 0.1 * noise3(dd[0] * 4 + o, dd[1] * 4, dd[2] * 4)
        + 0.04 * noise3(dd[0] * 9 + o, dd[1] * 9, dd[2] * 9) - 0.12 * Math.max(0, noise3(dd[0] * 2.2 - o, dd[1] * 2.2, dd[2] * 2.2) - 0.15)
        - 0.05 * Math.max(0, noise3(dd[0] * 13 + o, dd[1] * 13, dd[2] * 13) - 0.2);
      for (const [px, py, pz, pd] of planes) { const c = dd[0] * px + dd[1] * py + dd[2] * pz; if (c > 0.2) k = Math.min(k, pd / c); }
      const p = [dd[0] * sx * k, dd[1] * sy * k, dd[2] * sz * k];
      mb.v(p, dd, { aLoc: p, aMisc: [1, sd, 0, 0], color: colour });
    }
  }
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < seg; j++) { const a = i * seg + j, b = i * seg + ((j + 1) % seg); mb.quad(a, a + seg, b + seg, b); }
  }
  mb.fixWinding(0);
  mb.smooth(0, 0);
  return mb;
}
function layPiece(pts, c, q, x, z, sink, s = 1, ground = terrainY) {
  let top = -Infinity;
  for (const v of pts) {
    const w = qRot(q, mul(sub(v, c), s));
    top = Math.max(top, ground(x + w[0], z + w[2]) - w[1]);
  }
  const p = sub([x, top - sink, z], qRot(q, mul(c, s)));
  return { p, q, s };
}
function gndAt(x, z) {
  const e = 0.25;
  return [(terrainY(x + e, z) - terrainY(x - e, z)) / (2 * e), (terrainY(x, z + e) - terrainY(x, z - e)) / (2 * e), 0, 0];
}

function insideHull2(pts, x, z, m) {
  const P = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const p of P) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  for (let i = P.length - 1; i >= 0; i--) { const p = P[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
  const H = lo.slice(0, -1).concat(up.slice(0, -1));
  if (H.length < 3) return false;
  for (let i = 0; i < H.length; i++) {
    const a = H[i], b = H[(i + 1) % H.length], ex = b[0] - a[0], ez = b[1] - a[1], l = Math.hypot(ex, ez) || 1;
    if ((ex * (z - a[1]) - ez * (x - a[0])) / l < m) return false;
  }
  return true;
}
function makeSupport(px, cx, cz, half) {
  const C = 0.04, n = Math.ceil((2 * half) / C) + 1, x0 = cx - half, z0 = cz - half;
  const G = new Float32Array(n * n), F = new Float32Array(n * n);
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const x = x0 + i * C, z = z0 + j * C, g = supportY(x, z), k = j * n + i;
      G[k] = g;
      F[k] = Math.max(g, px.surfAt(x, z));
    }
  }
  const look = (A) => (x, z) => {
    const u = clamp$9((x - x0) / C, 0, n - 1.001), v = clamp$9((z - z0) / C, 0, n - 1.001);
    const i = Math.floor(u), j = Math.floor(v), fu = u - i, fv = v - j, k = j * n + i;
    return (A[k] * (1 - fu) + A[k + 1] * fu) * (1 - fv) + (A[k + n] * (1 - fu) + A[k + n + 1] * fu) * fv;
  };
  return { full: look(F), ground: look(G) };
}
function axisBasis(yaw, pitch, roll) {
  const cp = Math.cos(pitch), ax = [Math.cos(yaw) * cp, Math.sin(pitch), Math.sin(yaw) * cp];
  const sl = Math.hypot(ax[0], ax[2]) || 1, side = [-ax[2] / sl, 0, ax[0] / sl], upv = cross(side, ax);
  const cr = Math.cos(roll), sr = Math.sin(roll);
  const X = [side[0] * cr + upv[0] * sr, side[1] * cr + upv[1] * sr, side[2] * cr + upv[2] * sr];
  return [X, ax, cross(X, ax)];
}
function settle(sup, coarse, fine, com, x, z, yaw, roll0, p0, p1) {
  const M = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  const set = (pitch, roll) => {
    const [X, A, Z] = axisBasis(yaw, pitch, roll);
    M[0] = X[0]; M[1] = X[1]; M[2] = X[2]; M[3] = A[0]; M[4] = A[1]; M[5] = A[2]; M[6] = Z[0]; M[7] = Z[1]; M[8] = Z[2];
  };
  const drop = (P, S) => {
    let top = -Infinity;
    for (let i = 0; i < P.length; i++) {
      const p = P[i];
      const h = S(x + M[0] * p[0] + M[3] * p[1] + M[6] * p[2], z + M[2] * p[0] + M[5] * p[1] + M[8] * p[2]) - (M[1] * p[0] + M[4] * p[1] + M[7] * p[2]);
      if (h > top) top = h;
    }
    return top;
  };
  let best = null;
  const test = (pitch, roll, P) => {
    set(pitch, roll);
    const y = drop(P, sup.full), e = y + M[1] * com[0] + M[4] * com[1] + M[7] * com[2] + 0.004 * Math.abs(roll - roll0);
    if (!best || e < best.e) best = { e, y, pitch, roll };
  };
  const dp = (p1 - p0) / 8;
  for (let a = 0; a <= 8; a++) for (let r = -4; r <= 4; r++) test(p0 + a * dp, roll0 + r * 0.3, coarse);
  const b0 = best;
  best = null;
  for (let a = -3; a <= 3; a++) for (let r = -3; r <= 3; r++) test(clamp$9(b0.pitch + (a * dp) / 3, p0, p1), b0.roll + r * 0.1, fine);
  set(best.pitch, best.roll);
  const yg = drop(fine, sup.ground);
  const [X, A, Z] = axisBasis(yaw, best.pitch, best.roll);
  return { q: qBasis(X, A, Z), y: best.y, held: best.y - yg, pitch: best.pitch, roll: best.roll };
}

let LATHE_R = null;
function latheR(kind, y) {
  if (!LATHE_R) {
    LATHE_R = [0, 1].map((k) => {
      const prof = profiles()[k], out = new Float32Array(224);
      for (let i = 0; i < out.length; i++) out[i] = prof.at(prof.tAtY(i * 0.004)).r;
      return out;
    });
  }
  const T = LATHE_R[kind], u = (y + 0.42) / 0.004;
  if (u < 0 || u >= T.length - 1) return 0;
  const i = Math.floor(u), f = u - i;
  return T[i] + (T[i + 1] - T[i]) * f;
}
const UB_N = 16;
function unitBand(pts, whole = null) {
  const B = new Float32Array(UB_N * 2);
  for (let b = 0; b < UB_N; b++) { B[b * 2] = whole ? whole[0] : Infinity; B[b * 2 + 1] = whole ? whole[1] : -Infinity; }
  if (!whole) {
    for (const p of pts) {
      const b = Math.floor((Math.atan2(p[2], p[0]) / TAU$8 + 1) * UB_N) % UB_N;
      if (p[1] < B[b * 2]) B[b * 2] = p[1];
      if (p[1] > B[b * 2 + 1]) B[b * 2 + 1] = p[1];
    }
  }
  return B;
}
function unclipCargo(ctx, kit, amph) {
  const units = [];
  const vis = (x, z) => Math.max(moundTop(x, z), supportY(x, z));
  const frame = (U) => {
    const [x, y, z, w] = U.pose.q, R = U.Rm, p = U.pose.p, S = U.samp, W = U.W;
    R[0] = 1 - 2 * (y * y + z * z); R[1] = 2 * (x * y - z * w); R[2] = 2 * (x * z + y * w);
    R[3] = 2 * (x * y + z * w); R[4] = 1 - 2 * (x * x + z * z); R[5] = 2 * (y * z - x * w);
    R[6] = 2 * (x * z - y * w); R[7] = 2 * (y * z + x * w); R[8] = 1 - 2 * (x * x + y * y);
    for (let i = 0; i < S.length; i++) {
      const v = S[i];
      W[i * 3] = p[0] + R[0] * v[0] + R[1] * v[1] + R[2] * v[2];
      W[i * 3 + 1] = p[1] + R[3] * v[0] + R[4] * v[1] + R[5] * v[2];
      W[i * 3 + 2] = p[2] + R[6] * v[0] + R[7] * v[1] + R[8] * v[2];
    }
  };
  const add1 = (pose, samp, o) => {
    let R = 0;
    for (const p of samp) R = Math.max(R, Math.hypot(p[0], p[1], p[2]));
    const S = o.piece ? samp.filter((_, i) => i % 2 === 0) : samp;
    const U = Object.assign({ pose, samp: S, W: new Float64Array(S.length * 3), Rm: new Float64Array(9), R, order: units.length, p0: pose.p.slice(), q0: pose.q.slice(), mv: [0, 0, 0], tilt: 0, hit: 0 }, o);
    frame(U);
    units.push(U);
  };
  const dense = [vesselSamples(0, 34, 18), vesselSamples(1, 34, 18)];
  for (const pl of ctx.placed) {
    if (pl.lathe === undefined) continue;
    const whole = pl.kind !== 2, pts = whole ? dense[pl.kind] : pl.info.pts;
    add1(pl.pose, pts, { pl, lathe: pl.lathe, fixed: pl.mode !== 'lie', held: pl.lift > 0.015, piece: whole ? 0 : 1, band: unitBand(pts, whole ? [-0.42, (pl.kind === 0 ? 0.8765 : 0.8745) - 0.42] : null) });
  }
  for (const lp of ctx.loose) add1(lp.pose, lp.info.pts, { pl: lp, lathe: lp.lathe, fixed: lp.mode !== 'loose', held: false, piece: 2, band: lp.info.type === 'handle' ? null : unitBand(lp.info.pts) });
  const LQ = [0, 0, 0];
  const inside = (B, x, y, z) => {
    if (!B.band) return 0;
    const R = B.Rm, dx = x - B.pose.p[0], dy = y - B.pose.p[1], dz = z - B.pose.p[2];
    const lx = R[0] * dx + R[3] * dy + R[6] * dz, ly = R[1] * dx + R[4] * dy + R[7] * dz, lz = R[2] * dx + R[5] * dy + R[8] * dz;
    LQ[0] = lx; LQ[1] = ly; LQ[2] = lz;
    const b = (Math.floor((Math.atan2(lz, lx) / TAU$8 + 1) * UB_N) % UB_N) * 2;
    if (ly < B.band[b] || ly > B.band[b + 1]) return 0;
    const d = latheR(B.lathe, ly) * 0.97 - 0.003 - Math.hypot(lx, lz);
    return d > 0 ? d : 0;
  };
  const CQ = [0, 0, 0, 0];
  const pen = (A, B, dir) => {
    let depth = 0;
    dir[0] = dir[1] = dir[2] = 0;
    CQ[0] = CQ[1] = CQ[2] = CQ[3] = 0;
    for (let pass = 0; pass < 2; pass++) {
      const S = pass ? B : A, O = pass ? A : B, sg = pass ? -1 : 1;
      if (!O.band) continue;
      const op = O.pose.p, R2 = O.R * O.R, W = S.W, R = O.Rm;
      for (let i = 0; i < W.length; i += 3) {
        const x = W[i], y = W[i + 1], z = W[i + 2], dx = x - op[0], dy = y - op[1], dz = z - op[2];
        if (dx * dx + dy * dy + dz * dz > R2) continue;
        const d = inside(O, x, y, z);
        if (d <= 0 || y < vis(x, z) + 0.01) continue;
        if (d > depth) depth = d;
        const r = Math.hypot(LQ[0], LQ[2]) || 1e-6, ux = LQ[0] / r, uz = LQ[2] / r;
        dir[0] += sg * (R[0] * ux + R[2] * uz) * d; dir[1] += sg * (R[3] * ux + R[5] * uz) * d; dir[2] += sg * (R[6] * ux + R[8] * uz) * d;
        CQ[0] += x * d; CQ[1] += y * d; CQ[2] += z * d; CQ[3] += d;
      }
    }
    return depth;
  };
  const move = (M, dx, dy, dz) => {
    const p = M.pose.p, g0 = M.held ? 0 : vis(p[0], p[2]);
    p[0] += dx; p[1] += dy; p[2] += dz;
    if (!M.held && !dy) p[1] += vis(p[0], p[2]) - g0;
    M.mv[0] = p[0] - M.p0[0]; M.mv[1] = p[1] - M.p0[1]; M.mv[2] = p[2] - M.p0[2];
    frame(M);
    M.hit = 1;
  };
  const lean = (M, depth) => {
    if (CQ[3] <= 0 || M.tilt > 0.4) return false;
    const cx = CQ[0] / CQ[3], cz = CQ[2] / CQ[3], W = M.W;
    let px = 0, py = 0, pz = 0, far = 0;
    for (let i = 0; i < W.length; i += 3) {
      if (W[i + 1] - vis(W[i], W[i + 2]) > 0.02) continue;
      const h = Math.hypot(W[i] - cx, W[i + 2] - cz);
      if (h > far) { far = h; px = W[i]; py = W[i + 1]; pz = W[i + 2]; }
    }
    if (far < 0.12) return false;
    const th = Math.atan((depth + 0.004) / far), r = qAxis([-(cz - pz) / far, 0, (cx - px) / far], th);
    const p = M.pose.p, q = M.pose.q, v = qRot(r, [p[0] - px, p[1] - py, p[2] - pz]), q2 = qNorm(qMul(r, q));
    p[0] = px + v[0]; p[1] = py + v[1]; p[2] = pz + v[2];
    q[0] = q2[0]; q[1] = q2[1]; q[2] = q2[2]; q[3] = q2[3];
    M.tilt += th;
    M.mv[0] = p[0] - M.p0[0]; M.mv[1] = p[1] - M.p0[1]; M.mv[2] = p[2] - M.p0[2];
    frame(M);
    M.hit = 1;
    return true;
  };
  const wood = [...new Set([].concat(...ctx.px.map.values()))].filter((c) => c.sup && c.rs === undefined);
  const woodIn = (c, x, y, z) => {
    const ux = c.b[0] - c.a[0], uy = c.b[1] - c.a[1], uz = c.b[2] - c.a[2], u2 = ux * ux + uy * uy + uz * uz;
    const t = u2 > 1e-9 ? clamp$9(((x - c.a[0]) * ux + (y - c.a[1]) * uy + (z - c.a[2]) * uz) / u2, 0, 1) : 0;
    const dx = x - c.a[0] - ux * t, dy = y - c.a[1] - uy * t, dz = z - c.a[2] - uz * t, d = Math.hypot(dx, dy, dz), R = c.r - 0.015;
    if (d >= R) return 0;
    LQ[0] = d > 1e-6 ? dx / d : 0; LQ[1] = d > 1e-6 ? dy / d : 1; LQ[2] = d > 1e-6 ? dz / d : 0;
    return R - d;
  };
  const nearWood = (M) => wood.filter((c) => Math.hypot((c.a[0] + c.b[0]) / 2 - M.pose.p[0], (c.a[2] + c.b[2]) / 2 - M.pose.p[2]) < M.R + c.r + Math.hypot(c.b[0] - c.a[0], c.b[2] - c.a[2]) / 2);
  const unwood = (M) => {
    const W = M.W, near = nearWood(M);
    if (!near.length) return;
    let depth = 0, nx = 0, ny = 0, nz = 0;
    for (let i = 0; i < W.length; i += 3) {
      for (const c of near) {
        const d = woodIn(c, W[i], W[i + 1], W[i + 2]);
        if (d > 0) { if (d > depth) depth = d; nx += LQ[0] * d; ny += LQ[1] * d; nz += LQ[2] * d; }
      }
    }
    if (depth < 0.006) return;
    if (!M.held && ny < 0.5 * Math.hypot(nx, ny, nz)) ny = 0;
    const nl = Math.hypot(nx, ny, nz) || 1, k = Math.min(depth + 0.004, 0.06) / nl;
    move(M, nx * k, ny * k, nz * k);
  };
  const dir = [0, 0, 0];
  const unclip = (rounds) => {
    for (let round = 0; round < rounds; round++) {
      let any = false;
      for (const U of units) { U.was = round === 0 ? 1 : U.hit; U.hit = 0; }
      for (let i = 0; i < units.length; i++) {
        const A = units[i];
        for (let j = i + 1; j < units.length; j++) {
          const B = units[j];
          if ((!A.was && !B.was) || (A.fixed && B.fixed) || (!A.band && !B.band)) continue;
          const ex = A.pose.p[0] - B.pose.p[0], ey = A.pose.p[1] - B.pose.p[1], ez = A.pose.p[2] - B.pose.p[2], rr = A.R + B.R;
          if (ex * ex + ey * ey + ez * ez > rr * rr) continue;
          const depth = pen(A, B, dir);
          if (depth < 0.006) continue;
          let M = A, O = B, sg = 1;
          if (A.fixed || (!B.fixed && (B.piece > A.piece || (B.piece === A.piece && B.order > A.order)))) { M = B; O = A; sg = -1; }
          if (Math.hypot(M.mv[0], M.mv[1], M.mv[2]) > 0.2) continue;
          let nx = dir[0] * sg, ny = dir[1] * sg, nz = dir[2] * sg, nl = Math.hypot(nx, ny, nz);
          if (ny > 0.5 * nl && !M.held && lean(M, depth)) { any = true; continue; }
          if (!(M.held && ny > 0.5 * nl)) ny = 0;
          nl = Math.hypot(nx, ny, nz);
          if (nl < 1e-6) { nx = M.pose.p[0] - O.pose.p[0]; ny = 0; nz = M.pose.p[2] - O.pose.p[2]; nl = Math.hypot(nx, nz) || 1; }
          const k = Math.min(depth + 0.004, 0.06) / nl;
          move(M, nx * k, ny * k, nz * k);
          any = true;
        }
      }
      for (const U of units) if (U.hit && !U.fixed) unwood(U);
      if (!any) break;
    }
  };
  unclip(10);
  for (const M of units) {
    if (M.fixed || M.piece === 2) continue;
    const p = M.pose.p, W = M.W;
    let clear = Infinity;
    for (let i = 0; i < W.length; i += 3) if (W[i + 1] < p[1]) clear = Math.min(clear, W[i + 1] - vis(W[i], W[i + 2]));
    if (clear < 0.012) continue;
    const near = units.filter((B) => B !== M && B.band && Math.hypot(B.pose.p[0] - p[0], B.pose.p[2] - p[2]) < B.R + M.R), wn = nearWood(M);
    let gap = Infinity, low = Infinity;
    for (let i = 1; i < W.length; i += 3) low = Math.min(low, W[i]);
    for (let i = 0; i < W.length; i += 3) {
      const x = W[i], y = W[i + 1], z = W[i + 2];
      if (y > low + 0.2) continue;
      let s = vis(x, z);
      for (const c of wn) {
        const ux = c.b[0] - c.a[0], uz = c.b[2] - c.a[2], l2 = ux * ux + uz * uz, R = c.r - 0.015;
        const t = l2 > 1e-9 ? clamp$9(((x - c.a[0]) * ux + (z - c.a[2]) * uz) / l2, 0, 1) : 0, dx = x - c.a[0] - ux * t, dz = z - c.a[2] - uz * t, d2 = dx * dx + dz * dz;
        if (d2 < R * R) { const top = c.a[1] + (c.b[1] - c.a[1]) * t + Math.sqrt(R * R - d2); if (top < y + 0.005 && top > s) s = top; }
      }
      for (const B of near) {
        if (Math.hypot(B.pose.p[0] - x, B.pose.p[2] - z) > B.R) continue;
        for (let yy = y; yy > s; yy -= 0.01) {
          if (inside(B, x, yy, z) <= 0) continue;
          let lo = yy, hi = Math.min(y, yy + 0.01);
          for (let it = 0; it < 3; it++) { const m = 0.5 * (lo + hi); if (inside(B, x, m, z) > 0) lo = m; else hi = m; }
          s = lo;
          break;
        }
      }
      gap = Math.min(gap, y - s);
    }
    if (gap > 0.012 && gap < 0.5) move(M, 0, -(gap - 0.004), 0);
  }
  for (const U of units) U.hit = 1;
  unclip(4);
  let moved = 0;
  for (const M of units) {
    const [mx, my, mz] = M.mv;
    if (!mx && !my && !mz && !M.tilt) continue;
    moved++;
    const p = M.pose.p, p0 = M.p0, qd = qMul(M.pose.q, [-M.q0[0], -M.q0[1], -M.q0[2], M.q0[3]]);
    const to = (x, y, z) => { const v = qRot(qd, [x - p0[0], y - p0[1], z - p0[2]]); return [p[0] + v[0], p[1] + v[1], p[2] + v[2]]; };
    if (M.pl.ai !== undefined) { amph[M.pl.ai].position.set(p[0], p[1], p[2]); amph[M.pl.ai].quaternion.set(M.pose.q[0], M.pose.q[1], M.pose.q[2], M.pose.q[3]); }
    if (M.pl.dec) for (let i = M.pl.dec[0]; i < M.pl.dec[1]; i++) { const d = ctx.decals[i], w = to(d.x, p0[1], d.z); d.x = w[0]; d.z = w[2]; }
    if (M.pl.emb) {
      for (let i = M.pl.emb[0]; i < M.pl.emb[1]; i++) {
        const e = ctx.embeds[i], c = to(e.cx, p0[1], e.cz);
        e.cx = c[0]; e.cz = c[2];
        for (const q of e.pts) { const w = to(q[0], q[1], q[2]); q[0] = w[0]; q[1] = w[1]; q[2] = w[2]; q[3] = q[1] - terrainY(q[0], q[2]); }
      }
    }
  }
  return moved;
}

const BANK = {
  vessel: { capW: 0.14, capL: 0.03, slopeW: 0.48, slopeL: 1.25, berm: 0.022, scour: 0.26 },
  broken: { capW: 0.1, capL: 0.025, slopeW: 0.55, slopeL: 1.3, berm: 0.018, scour: 0.22 },
  slant: { capW: 0.13, capL: 0.035, slopeW: 0.5, slopeL: 1.2, berm: 0.024, scour: 0.28 },
  upright: { capW: 0.14, capL: 0.07, slopeW: 0.5, slopeL: 0.9, berm: 0.026, scour: 0.24 },
  small: { capW: 0.035, capL: 0.014, slopeW: 0.9, slopeL: 1.6, berm: 0, scour: 0 },
  stone: { capW: 0.05, capL: 0.015, slopeW: 0.7, slopeL: 1.4, berm: 0.01, scour: 0.12 },
  timber: { capW: 0.07, capL: 0.02, slopeW: 0.5, slopeL: 1.3, berm: 0.016, scour: 0.22 },
  statue: { capW: 0.1, capL: 0.03, slopeW: 0.5, slopeL: 1.2, berm: 0.022, scour: 0.3 },
};
function bankDir(x, z) {
  const g = gndAt(x, z), gl = Math.hypot(g[0], g[1]), s = smoothstep(0.015, 0.06, gl);
  const dx = s * (gl > 1e-6 ? g[0] / gl : 0) - (1 - s) * CUR[0], dz = s * (gl > 1e-6 ? g[1] / gl : 0) - (1 - s) * CUR[2], l = Math.hypot(dx, dz) || 1;
  return [dx / l, dz / l];
}
function embed(ctx, pts, cx, cz, o) {
  const [bx, bz] = bankDir(cx, cz), low = [], ax = -bz, az = bx;
  let u0 = Infinity, u1 = -Infinity, v0 = Infinity;
  for (const p of pts) {
    const h = p[1] - terrainY(p[0], p[2]);
    if (h < -0.035 || h > o.capW + 0.04) continue;
    low.push([p[0], p[1], p[2], h]);
    const u = (p[0] - cx) * ax + (p[2] - cz) * az, v = (p[0] - cx) * bx + (p[2] - cz) * bz;
    u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v);
  }
  if (!low.length) return;
  ctx.embeds.push({ pts: low, cx, cz, bx, bz, o });
  if (o.scour > 0) {
    const um = (u0 + u1) / 2, vm = v0 - o.scour * 0.5;
    ctx.decals.push({ x: cx + ax * um + bx * vm, z: cz + az * um + bz * vm, dir: [-bx, 0, -bz], len: o.scour * 1.9, wid: u1 - u0 + o.scour, str: 0.6, type: 1 });
  }
}
const bankKey = (i, j) => (i + 32768) * 65536 + (j + 32768);
function bankField(embeds) {
  const G = 0.05, map = new Map();
  for (const { pts, cx, cz, bx, bz, o } of embeds) {
    const sMin = Math.min(o.slopeW, o.slopeL), capM = Math.max(o.capW, o.capL), reachC = 0.22 + G;
    const pad = Math.max(capM / sMin + G, reachC) + G;
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const p of pts) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); z0 = Math.min(z0, p[2]); z1 = Math.max(z1, p[2]); }
    const i0 = Math.floor((x0 - pad) / G), j0 = Math.floor((z0 - pad) / G), ni = Math.ceil((x1 + pad) / G) - i0 + 1, nj = Math.ceil((z1 + pad) / G) - j0 + 1;
    const n = ni * nj, Wd = new Float32Array(n), CAP = new Float32Array(n), SL = new Float32Array(n), B = new Float32Array(n), DM = new Float32Array(n).fill(9);
    for (let a = 0; a < ni; a++) {
      for (let b = 0; b < nj; b++) {
        const k = a * nj + b, dx = (i0 + a) * G - cx, dz = (j0 + b) * G - cz, dl = Math.hypot(dx, dz);
        const w = dl > 1e-4 ? smoothstep(-0.35, 0.55, (dx * bx + dz * bz) / dl) : 1;
        Wd[k] = w; CAP[k] = lerp$4(o.capL, o.capW, w); SL[k] = lerp$4(o.slopeL, o.slopeW, w);
      }
    }
    for (const p of pts) {
      const contact = p[3] < 0.05, hc = Math.min(p[3], capM), r = Math.max(hc > 0 ? hc / sMin + G : 0, contact ? reachC : 0);
      if (r <= 0) continue;
      const a0 = Math.max(0, Math.floor((p[0] - r) / G) - i0), a1 = Math.min(ni - 1, Math.ceil((p[0] + r) / G) - i0);
      const b0 = Math.max(0, Math.floor((p[2] - r) / G) - j0), b1 = Math.min(nj - 1, Math.ceil((p[2] + r) / G) - j0);
      for (let a = a0; a <= a1; a++) {
        const dx = p[0] - (i0 + a) * G;
        for (let b = b0; b <= b1; b++) {
          const dz = p[2] - (j0 + b) * G, d = Math.sqrt(dx * dx + dz * dz), k = a * nj + b;
          if (d > r) continue;
          if (contact && d < DM[k]) DM[k] = d;
          const hc = Math.min(p[3], CAP[k]), u = hc > 0 ? 1 - (SL[k] * d) / hc : 0;
          if (u > 0) { const v = hc * Math.pow(u, 1.7); if (v > B[k]) B[k] = v; }
        }
      }
    }
    for (let a = 0; a < ni; a++) {
      for (let b = 0; b < nj; b++) {
        const k = a * nj + b, dmin = DM[k];
        const lee = o.scour > 0 ? 1 - Wd[k] : 0;
        if (B[k] <= 0 && dmin > 1) continue;
        const i = i0 + a, j = j0 + b, key = bankKey(i, j);
        let c = map.get(key);
        if (!c) map.set(key, (c = { i, j, h: 0, d: 9, lee: 0 }));
        c.h = Math.max(c.h, B[k]);
        c.d = Math.min(c.d, dmin);
        c.lee = Math.max(c.lee, lee * (1 - smoothstep(0.08, 0.3, dmin)));
      }
    }
  }
  return map;
}
function bankMesh(field) {
  const G = 0.05, P = [], C = [], T = [], T2 = [], I = [], NB = [], vid = new Map();
  const vert = (c) => {
    let id = vid.get(c);
    if (id !== undefined) return id;
    const x = c.i * G, z = c.j * G, g = terrainY(x, z), h = c.h;
    sedAttrs(x, z, h, TA);
    const near = Math.exp(-c.d / 0.045), body = smoothstep(0.006, 0.05, h), hol = c.lee * (1 - body);
    const org = clamp$9(TA[9] + 0.45 * near + 0.2 * hol, 0, 1);
    P.push(x, g + moundLift(h), z);
    C.push(TA[0], TA[1], TA[2]);
    T.push(TA[3], TA[4], TA[5], clamp$9(TA[6] * (1 - 0.3 * near - 0.08 * hol), 0.3, 1));
    T2.push(TA[7], TA[8] * (1 - 0.8 * near - 0.3 * hol), org);
    NB.push(1 - smoothstep(0.012, 0.06, h), TA[10], TA[11], TA[12]);
    id = P.length / 3 - 1;
    vid.set(c, id);
    return id;
  };
  for (const c of field.values()) {
    const b = field.get(bankKey(c.i + 1, c.j)), d = field.get(bankKey(c.i, c.j + 1)), e = field.get(bankKey(c.i + 1, c.j + 1));
    if (!b || !d || !e || Math.max(c.h, b.h, d.h, e.h) < 0.004) continue;
    const va = vert(c), vb = vert(b), vd = vert(d), ve = vert(e);
    I.push(va, vd, vb, vb, vd, ve);
  }
  return { P, C, T, T2, I, NB };
}
function slabSamples(a, b, w, h) {
  const d = norm([b[0] - a[0], 0, b[2] - a[2]]), s = [-d[2], 0, d[0]], out = [];
  for (let t = 0; t <= 1.0001; t += 0.1) {
    const c = lerp3(a, b, t);
    for (const sd of [-1, 1]) for (const v of [-0.45, -0.2, 0.05, 0.3, 0.5]) out.push([c[0] + s[0] * sd * w * 0.5, c[1] + v * h, c[2] + s[2] * sd * w * 0.5]);
  }
  return out;
}

let ICO3 = null;
function icoSphere3() {
  if (ICO3) return ICO3;
  const t = (1 + Math.sqrt(5)) / 2;
  const V = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]].map(norm);
  let F = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
    [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
  for (let s = 0; s < 3; s++) {
    const mid = new Map(), NF = [];
    const m = (a, b) => {
      const k = a < b ? a * 65536 + b : b * 65536 + a;
      let i = mid.get(k);
      if (i === undefined) { i = V.length; V.push(norm(lerp3(V[a], V[b], 0.5))); mid.set(k, i); }
      return i;
    };
    for (const [a, b, c] of F) { const ab = m(a, b), bc = m(b, c), ca = m(c, a); NF.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]); }
    F = NF;
  }
  return (ICO3 = { V, F });
}
function bathSponge(mb, base, n, R, type, col, rng) {
  const { V, F } = icoSphere3(), [t1, t2] = perp(n), sd = rng(), v0 = mb.count, i0 = mb.I.length;
  const H = R * (type === 2 ? 0.55 + rng() * 0.2 : 0.8 + rng() * 0.35), o1 = rng() * 50, o2 = rng() * 50, osc = [];
  const nO = type === 0 ? 2 + Math.floor(rng() * 4) : type === 1 ? 3 + Math.floor(rng() * 4) : 1 + Math.floor(rng() * 2);
  for (let k = 0, tries = 0; k < nO && tries < 40; tries++) {
    const a = rng() * TAU$8, e = 0.5 + rng() * 0.5, s = Math.sqrt(1 - e * e), d = [Math.cos(a) * s, e, Math.sin(a) * s];
    const r = type === 0 ? 0.13 + rng() * 0.07 : type === 1 ? 0.18 + rng() * 0.1 : 0.07 + rng() * 0.03;
    if (osc.some((o) => Math.acos(clamp$9(dot(o.d, d), -1, 1)) < (o.r + r) * 1.4)) continue;
    osc.push({ d, r, dep: type === 2 ? 0.08 : 0.25 + rng() * 0.2 });
    k++;
  }
  for (const u of V) {
    let r = 1 + 0.16 * noise3(u[0] * 1.3 + o1, u[1] * 1.3, u[2] * 1.3 + o2) + 0.07 * noise3(u[0] * 3.3 + o2, u[1] * 3.3 + o1, u[2] * 3.3);
    if (type === 1) r += 0.14 * noise3(u[0] * 2.4 + o1, u[1] * 2.4 - o2, u[2] * 2.4);
    let od = 9;
    for (const o of osc) {
      const a = Math.acos(clamp$9(dot(u, o.d), -1, 1)) / o.r;
      if (a < od) od = a;
      if (a < 1) r *= 1 - o.dep * (1 - a * a);
      else if (a < 1.6) r *= 1 + 0.06 * Math.sin(((a - 1) / 0.6) * Math.PI);
    }
    let y = H * (0.42 + 0.62 * u[1] * r), hr = R * r * (u[1] < 0 ? 1 + 0.12 * u[1] : 1);
    if (y < 0) { hr *= 1 + 0.05 * (y / H); y = -0.012 + 0.01 * u[1]; }
    const p = add(add(add(base, mul(t1, u[0] * hr)), mul(n, y)), mul(t2, u[2] * hr));
    const shade = 0.88 + 0.24 * noise3(u[0] * 4 + o2, u[1] * 4, u[2] * 4 + o1);
    mb.v(p, norm(add(add(mul(t1, u[0]), mul(n, u[1])), mul(t2, u[2]))), { color: [col[0] * shade, col[1] * shade, col[2] * shade], aSp: [type, sd, clamp$9(y / (H * 1.04), 0, 1), od] });
  }
  for (const [a, b, c] of F) mb.tri(v0 + a, v0 + b, v0 + c);
  mb.fixWinding(i0);
  mb.smooth(v0, i0);
}
function crustSponge(mb, base, n, R, col, rng) {
  const [t1, t2] = perp(n), sd = rng(), NS = 30, NR = 7, v0 = mb.count, i0 = mb.I.length, o = rng() * 40;
  const T = 0.006 + R * (0.04 + rng() * 0.05);
  const edge = (a) => R * (0.72 + 0.28 * noise3(Math.cos(a) * 1.6 + o, Math.sin(a) * 1.6, 1.7) + 0.12 * noise3(Math.cos(a) * 4.5 + o, Math.sin(a) * 4.5, 3.1));
  const at = (a, f) => {
    const r = edge(a) * f, lx = Math.cos(a) * r, lz = Math.sin(a) * r;
    const th = T * Math.sqrt(Math.max(0, 1 - f ** 3)) * (0.8 + 0.4 * noise3(lx * 18 + o, lz * 18, 0.5)) - 0.004;
    return add(add(add(base, mul(t1, lx)), mul(t2, lz)), mul(n, th));
  };
  const ci = mb.v(at(0, 0), n, { color: col, aSp: [3, sd, 1, 9] }), rings = [];
  for (let k = 1; k <= NR; k++) {
    const f = k / NR, row = [];
    for (let j = 0; j < NS; j++) { const sh = 0.9 + 0.2 * rng(); row.push(mb.v(at((j / NS) * TAU$8, f), n, { color: [col[0] * sh, col[1] * sh, col[2] * sh], aSp: [3, sd, 1 - f, 9] })); }
    rings.push(row);
  }
  for (let j = 0; j < NS; j++) mb.tri(ci, rings[0][j], rings[0][(j + 1) % NS]);
  for (let k = 0; k < NR - 1; k++) for (let j = 0; j < NS; j++) mb.quad(rings[k][j], rings[k + 1][j], rings[k + 1][(j + 1) % NS], rings[k][(j + 1) % NS]);
  mb.fixWinding(i0);
  mb.smooth(v0, i0);
}

function timberStub(ctx, x, z, yaw, tilt, len, w, h, kind) {
  const { rng } = ctx, sd = rng(), dir = [Math.cos(yaw) * Math.sin(tilt), Math.cos(tilt), Math.sin(yaw) * Math.sin(tilt)];
  const side = norm(cross(dir, Math.abs(dir[1]) > 0.97 ? [1, 0, 0] : UP)), up = cross(side, dir);
  const g = terrainY(x, z), deep = 0.3, total = len + deep, base = mad([x, g, z], dir, -deep), n = Math.ceil(total / 0.05), rings = [];
  for (let i = 0; i <= n; i++) {
    const u = total * (i / n), c = mad(base, dir, u), endD = total - u, tp = 0.5 + 0.5 * smoothstep(0, 0.4, endD), pts = [], attrs = [];
    for (const [a, wv] of RECT16) {
      const ero = noise3(u * 7.1 + a * 2.3, wv * 3.1, sd * 13) * 0.012 * (1.5 - tp);
      const wr = Math.min(arrisWear(a, wv, u, sd, 1.6 - tp), 0.3 * Math.min(w, h) * tp);
      const p = add(add(c, mul(side, (a - 0.5) * w * tp + ero - Math.sign(a - 0.5) * wr)), mul(up, (wv - 0.5) * h * tp + ero - Math.sign(wv - 0.5) * wr));
      pts.push(p);
      attrs.push(woodAttr(kind, sd, 0, endD, [u, (a - 0.5) * w * tp, (wv - 0.5) * h * tp], (w * tp) / 2, (h * tp) / 2, p));
    }
    rings.push({ pts, attrs, c });
  }
  splinter(rings, rng, 0.1);
  sweepRings(ctx.wood, rings, true, true);
  const top = mad(base, dir, total);
  ctx.px.add({ a: [x, g, z], b: top, r: Math.max(w, h) * 0.6 });
  if (top[1] - g > 0.3) ctx.caps.push({ a: [x, g + 0.1, z], b: top, r: Math.max(w, h) * 0.55 });
  embed(ctx, rings.flatMap((r) => r.pts), x, z, BANK.timber);
  ctx.decals.push({ x, z, dir: [dir[0], 0, dir[2]], len: 0.45 + len * Math.sin(tilt), wid: 0.35, str: 0.4 });
  ctx.discs.push([x, z, 0.3]);
  ctx.tops.push({ p: top, n: dir });
}

const FOOT = {
  B0: [0, 0.08, 0.02], B1: [0.08, 0.15, 0.19], BODY: [[0.004, 0.034, 0.035], [0.044, 0.033, 0.095]], HEEL: [[0, 0.043, -0.068], [0.035, 0.041, 0.045]],
  SHIN: [[0, 0.05, -0.055], [0.003, 0.2, -0.045]], ANK: [[0.024, 0.047, -0.032], [0.017, 0.019, 0.028]],
  TOES: [[0.028, 0.0115, 0.028], [0.012, 0.0095, 0.024], [-2e-3, 0.0088, 0.021], [-0.016, 0.008, 0.018], [-0.029, 0.0075, 0.014]].map(([tx, r, l]) => [[tx, 0.021, 0.1], [tx * 1.08, 0.016, 0.1 + l], r]),
  SOLE: [[0.002, 0, 0.028], [0.053, 1, 0.142]],
};
function footSDF(x, y, z) {
  const bound = sdEllipsoid$1(x, y, z, FOOT.B0, FOOT.B1);
  if (bound > 0.03) return bound;
  const body = sdEllipsoid$1(x, y, z, FOOT.BODY[0], FOOT.BODY[1]);
  let d = smin$2(body, sdEllipsoid$1(x, y, z, FOOT.HEEL[0], FOOT.HEEL[1]), 0.03);
  d = smin$2(d, sdCone$1(x, y, z, FOOT.SHIN[0], FOOT.SHIN[1], 0.037, 0.033), 0.035);
  d = smin$2(d, sdEllipsoid$1(x, y, z, FOOT.ANK[0], FOOT.ANK[1]), 0.012);
  for (const [a, b, r] of FOOT.TOES) d = smin$2(d, sdCone$1(x, y, z, a, b, r, r * 0.85), 0.006);
  d = smin$2(d, Math.max(Math.abs(y - 0.005) - 0.0075, sdEllipsoid$1(x, 0, z, FOOT.SOLE[0], FOOT.SOLE[1])), 0.004);
  d = Math.min(d, Math.max(Math.abs(z - 0.03) - 0.009, body - 0.0045));
  d = Math.max(d, y - 0.172 - 0.012 * noise3(x * 30, z * 30, 1.3));
  return Math.abs(d) < 0.008 ? d + noise3(x * 60, y * 60, z * 60) * 0.0012 : d;
}
function drapeSDF(x, y, z) {
  const fold = 0.032 * Math.sin(x * 21 + 0.7 * Math.sin(z * 8)) + 0.012 * Math.sin(x * 55 + z * 9);
  const sheet = Math.abs(y - fold) - 0.0065;
  if (sheet > 0.02) return sheet;
  return Math.max(sheet, (Math.hypot(x / 0.17, z / 0.12) - 1 + 0.2 * noise3(x * 9, z * 9, 2.2) + 0.07 * noise3(x * 30, z * 30, 5.1)) * 0.1);
}
const PLINTH_FEET = [-1, 1].map((sx) => {
  const fx = sx * 0.065;
  return {
    sx, c: [fx, 0.074, 0.03],
    toes: [[0.024, 0.011], [0.01, 0.009], [-4e-3, 0.0085], [-0.017, 0.008], [-0.028, 0.0072]].map(([tx, r]) => [[fx + tx * sx, 0.056, 0.085], [fx + tx * sx * 1.05, 0.052, 0.112], r]),
  };
});
const PLINTH_FR = [0.04, 0.03, 0.075];
function plinthSDF(x, y, z) {
  const qx = Math.abs(x) - 0.19, qy = Math.abs(y) - 0.045, qz = Math.abs(z) - 0.12;
  let d = Math.min(Math.max(qx, qy, qz), 0) + Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) - 0.012;
  d = Math.max(d, -(z + 0.06) + 0.025 * noise3(x * 11, y * 11, 4.2));
  if (y > 0.02) {
    for (const f of PLINTH_FEET) {
      let e = sdEllipsoid$1(x, y, z, f.c, PLINTH_FR);
      for (const [a, b, r] of f.toes) e = smin$2(e, sdCone$1(x, y, z, a, b, r, r * 0.85), 0.005);
      e = Math.max(e, y - 0.1 - 0.008 * noise3(x * 25, z * 25, f.sx));
      d = smin$2(d, e, 0.008);
    }
  }
  return Math.abs(d) < 0.006 ? d + noise3(x * 50, y * 50, z * 50) * 0.001 : d;
}
const ARM_A = [0, 0, -0.13], ARM_B = [0, 0.004, 0.11], ARM_H = [[0.003, -2e-3, 0.152], [0.042, 0.019, 0.05]];
function forearmSDF(x, y, z) {
  let d = sdCone$1(x, y, z, ARM_A, ARM_B, 0.047, 0.031);
  d = smin$2(d, sdEllipsoid$1(x, y, z, ARM_H[0], ARM_H[1]), 0.02);
  d = Math.max(d, -(z + 0.12) + 0.012 * noise3(x * 25, y * 25, 3.3), z - 0.18 + 0.012 * noise3(x * 30, y * 30, 7.1));
  return Math.abs(d) < 0.006 ? d + noise3(x * 45, y * 45, z * 45) * 0.0012 : d;
}
function turnedMB(prof, segs, colour, kind, sd) {
  const mb = new MB({ aLoc: 3, aMisc: 4, color: 3 }), path = pathNormals(crSample(prof, 3));
  lathe$1(mb, path, segs, (p, pos) => ({ aLoc: pos, aMisc: [kind, sd, 0.5, 0.5], color: colour }));
  mb.smooth(0, 0);
  return mb;
}
const SOUNDING = [[0, 0.008], [0.02, 0.009], [0.03, 0.004], [0.037, 0.0], [0.04, 0.006], [0.036, 0.035], [0.029, 0.07], [0.021, 0.095], [0.014, 0.108], [0.009, 0.114], [0.007, 0.124], [0.0085, 0.13], [0.006, 0.136], [0, 0.137]];
const UNGUENT = [[0, 0.0], [0.007, 0.0], [0.01, 0.005], [0.008, 0.013], [0.01, 0.024], [0.019, 0.042], [0.024, 0.06], [0.022, 0.077], [0.013, 0.094], [0.0068, 0.106], [0.0058, 0.138], [0.0092, 0.15], [0.0078, 0.156], [0.0045, 0.154], [0.0035, 0.13]];

function revolve(mb, c0, axis, prof, segs) {
  const [t1, t2] = perp(axis), v0 = mb.count, i0 = mb.I.length, pn = pathNormals(prof.map((q) => [q[0], q[1]]));
  prof.forEach(([r, h, col, sw], i) => {
    for (let j = 0; j < segs; j++) {
      const a = (j / segs) * TAU$8, d = add(mul(t1, Math.cos(a)), mul(t2, Math.sin(a)));
      mb.v(add(mad(c0, axis, h), mul(d, r)), add(mul(d, pn[i].nr), mul(axis, pn[i].ny)), { color: col, aSway: sw });
    }
  });
  for (let i = 0; i < prof.length - 1; i++) {
    for (let j = 0; j < segs; j++) { const a = v0 + i * segs + j, b = v0 + i * segs + ((j + 1) % segs); mb.quad(a, a + segs, b + segs, b); }
  }
  mb.fixWinding(i0);
  mb.smooth(v0, i0);
}
const ringDir = (t1, t2, a) => add(mul(t1, Math.cos(a)), mul(t2, Math.sin(a)));
function tubeSponge(mb, base, n, rng) {
  const [t1, t2] = perp(n), k = 2 + Math.floor(rng() * 4), Y = [0.5, 0.42, 0.17], Yd = [0.38, 0.3, 0.11], D = [0.12, 0.09, 0.04];
  for (let i = 0; i < k; i++) {
    const dir = ringDir(t1, t2, rng() * TAU$8), off = i === 0 ? 0 : 0.018 + rng() * 0.02;
    const ax = norm(mad(n, dir, 0.1 + rng() * 0.25)), r = 0.011 + rng() * 0.007, h = 0.05 + rng() * 0.08;
    revolve(mb, mad(mad(base, dir, off), n, -6e-3), ax, [
      [r * 1.3, 0, Yd, 0], [r * 1.05, h * 0.25, Y, 0.06], [r * 0.95, h * 0.6, Y, 0.14], [r * 1.02, h * 0.92, Y, 0.2],
      [r * 0.92, h, Y, 0.22], [r * 0.72, h * 0.97, Yd, 0.22], [r * 0.66, h * 0.8, D, 0.18], [0, h * 0.74, D, 0.17],
    ], 10);
  }
}
function axinella(mb, base, n, rng) {
  const [t1, t2] = perp(n), k = 3 + Math.floor(rng() * 3), O = [0.6, 0.31, 0.12];
  for (let i = 0; i < k; i++) {
    const dir = ringDir(t1, t2, rng() * TAU$8), h = 0.1 + rng() * 0.1, lean = 0.25 + rng() * 0.35, p0 = mad(mad(base, n, -5e-3), dir, 0.01);
    const ctrl = [p0, add(mad(p0, n, h * 0.4), mul(dir, h * lean * 0.3)), add(mad(p0, n, h * 0.75), mul(dir, h * lean * 0.7)), add(mad(p0, n, h), mul(dir, h * lean))];
    sweep(mb, ctrl, (u) => 0.009 * (1 - 0.35 * u), 7, 4, (u) => ({ color: [O[0], O[1] + 0.1 * u, O[2]], aSway: 0.12 + 0.4 * u }), false, true, 0.008);
  }
}
function anemone(mb, base, n, rng) {
  const [t1, t2] = perp(n), G = [0.3, 0.55, 0.2], V = [0.62, 0.22, 0.55];
  revolve(mb, mad(base, n, -6e-3), n, [[0.017, 0, [0.35, 0.3, 0.2], 0], [0.017, 0.014, [0.36, 0.4, 0.22], 0.03], [0.013, 0.02, G, 0.05], [0, 0.021, [0.5, 0.45, 0.3], 0.05]], 10);
  for (let k = 0; k < 36; k++) {
    const dir = ringDir(t1, t2, rng() * TAU$8), rr = 0.004 + Math.sqrt(rng()) * 0.01, len = 0.05 + rng() * 0.05, out = 0.4 + rng() * 0.6;
    const p0 = mad(mad(base, n, 0.015), dir, rr);
    const ctrl = [p0, add(mad(p0, n, len * 0.4), mul(dir, len * out * 0.2)), add(mad(p0, n, len * 0.72), mul(dir, len * out * 0.6)), add(mad(p0, n, len * 0.8), mul(dir, len * out))];
    sweep(mb, ctrl, (u) => 0.0023 * (1 - 0.55 * u), 4, 3, (u) => ({ color: lerp3(G, V, smoothstep(0.7, 1, u)), aSway: 0.25 + 0.75 * u }), false, true, 0.002);
  }
}
function protula(mb, base, n, rng) {
  const [t1, t2] = perp(n), bend = ringDir(t1, t2, rng() * TAU$8), W = [0.62, 0.6, 0.55], E = add(mad(base, n, 0.075), mul(bend, 0.03));
  const tube = sweep(mb, [mad(base, n, -0.01), add(mad(base, n, 0.03), mul(bend, 0.005)), add(mad(base, n, 0.06), mul(bend, 0.02)), E], () => 0.0048, 7, 4, (u) => ({ color: W, aSway: 0.1 * u }), false, false);
  const ax = norm(sub(tube[tube.length - 1], tube[tube.length - 3])), [u1, u2] = perp(ax), R = [0.86, 0.12, 0.08], Wb = [0.9, 0.86, 0.82];
  for (const sd of [-1, 1]) {
    for (let k = 0; k < 14; k++) {
      const out = ringDir(u1, u2, sd * (0.15 + (k / 13) * 2.6)), len = 0.028 + rng() * 0.008, p0 = mad(E, out, 0.003);
      const ctrl = [p0, add(mad(p0, ax, len * 0.45), mul(out, len * 0.25)), add(mad(p0, ax, len * 0.8), mul(out, len * 0.6)), add(mad(p0, ax, len * 0.95), mul(out, len))];
      sweep(mb, ctrl, (u) => 0.0011 * (1 - 0.4 * u), 3, 3, (u) => ({ color: Math.floor(u * 6) % 2 ? Wb : R, aSway: 0.3 + 0.6 * u }), false, true, 0.001);
    }
  }
}
function sabella(mb, base, n, rng) {
  const [t1, t2] = perp(n), bend = ringDir(t1, t2, rng() * TAU$8), h = 0.14 + rng() * 0.06, E = add(mad(base, n, h), mul(bend, h * 0.25));
  const tube = sweep(mb, [mad(base, n, -0.01), add(mad(base, n, h * 0.35), mul(bend, h * 0.03)), add(mad(base, n, h * 0.7), mul(bend, h * 0.12)), E],
    (u) => 0.0065 * (1 - 0.2 * u), 7, 4, (u) => ({ color: [0.4, 0.36, 0.3], aSway: 0.5 * u }), false, false);
  const ax = norm(sub(tube[tube.length - 1], tube[tube.length - 3])), [u1, u2] = perp(ax);
  const BAND = [[0.5, 0.3, 0.14], [0.86, 0.82, 0.74], [0.85, 0.46, 0.12]];
  for (let k = 0; k < 30; k++) {
    const f = k / 29, out = ringDir(u1, u2, f * TAU$8 * 1.25), p0 = add(mad(E, ax, f * 0.01), mul(out, 0.004 + f * 0.012)), len = 0.045 + rng() * 0.015;
    const ctrl = [p0, add(mad(p0, ax, len * 0.35), mul(out, len * 0.3)), add(mad(p0, ax, len * 0.6), mul(out, len * 0.72)), add(mad(p0, ax, len * 0.62), mul(out, len))];
    sweep(mb, ctrl, (u) => 0.0012 * (1 - 0.3 * u), 3, 3, (u) => ({ color: BAND[Math.floor(u * 7) % 3], aSway: 0.55 + 0.45 * u }), false, true, 0.001);
  }
}
function seaSquirt(mb, base, n, rng) {
  const [t1] = perp(n), Rc = [0.62, 0.2, 0.12], Rd = [0.44, 0.12, 0.08], h = 0.04 + rng() * 0.025;
  revolve(mb, mad(base, n, -4e-3), n, [[0.012, 0, Rd, 0], [0.017, h * 0.3, Rc, 0.03], [0.016, h * 0.75, Rc, 0.06], [0.009, h * 0.98, Rc, 0.08], [0, h, Rc, 0.08]], 12);
  for (const s of [-1, 1]) {
    revolve(mb, add(mad(base, n, h * 0.82), mul(t1, s * 0.006)), norm(add(n, mul(t1, s * 0.5))),
      [[0.0055, 0, Rc, 0.08], [0.005, 0.012, Rc, 0.1], [0.0058, 0.018, [0.9, 0.5, 0.3], 0.11], [0.003, 0.016, Rd, 0.11], [0, 0.012, [0.15, 0.05, 0.04], 0.1]], 8);
  }
}

const GL_LIB = `
#define WK_SAND vec3(0.74, 0.66, 0.50)
vec4 wkHash4(vec3 p) {
  vec4 q = fract(vec4(p.xyzx) * vec4(0.1031, 0.1030, 0.0973, 0.1099));
  q += dot(q, q.wzxy + 33.33);
  return fract((q.xxyz + q.yzzw) * q.zywx);
}
vec4 wkNoiseD(vec3 x) {
  vec3 i = floor(x);
  vec3 w = fract(x);
  vec3 u = w * w * (3.0 - 2.0 * w);
  vec3 du = 6.0 * w * (1.0 - w);
  float a = uwHash13(i);
  float b = uwHash13(i + vec3(1.0, 0.0, 0.0));
  float c = uwHash13(i + vec3(0.0, 1.0, 0.0));
  float d = uwHash13(i + vec3(1.0, 1.0, 0.0));
  float e = uwHash13(i + vec3(0.0, 0.0, 1.0));
  float f = uwHash13(i + vec3(1.0, 0.0, 1.0));
  float g = uwHash13(i + vec3(0.0, 1.0, 1.0));
  float h = uwHash13(i + vec3(1.0, 1.0, 1.0));
  float k1 = b - a;
  float k2 = c - a;
  float k3 = e - a;
  float k4 = a - b - c + d;
  float k5 = a - c - e + g;
  float k6 = a - b - e + f;
  float k7 = -a + b + c - d + e - f - g + h;
  return vec4(a + k1 * u.x + k2 * u.y + k3 * u.z + k4 * u.x * u.y + k5 * u.y * u.z + k6 * u.z * u.x + k7 * u.x * u.y * u.z,
    du * vec3(k1 + k4 * u.y + k6 * u.z + k7 * u.y * u.z,
              k2 + k5 * u.z + k4 * u.x + k7 * u.z * u.x,
              k3 + k6 * u.x + k5 * u.y + k7 * u.x * u.y));
}
vec4 wkNoise4(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  vec4 a = mix(wkHash4(i), wkHash4(i + vec3(1.0, 0.0, 0.0)), f.x);
  vec4 b = mix(wkHash4(i + vec3(0.0, 1.0, 0.0)), wkHash4(i + vec3(1.0, 1.0, 0.0)), f.x);
  vec4 c = mix(wkHash4(i + vec3(0.0, 0.0, 1.0)), wkHash4(i + vec3(1.0, 0.0, 1.0)), f.x);
  vec4 d = mix(wkHash4(i + vec3(0.0, 1.0, 1.0)), wkHash4(i + vec3(1.0, 1.0, 1.0)), f.x);
  return mix(mix(a, b, f.y), mix(c, d, f.y), f.z);
}
float wkAA(float freq, float fw) { return 1.0 - smoothstep(0.25, 0.6, freq * fw); }
float wkSsD(float e0, float e1, float x) {
  float t = clamp((x - e0) / (e1 - e0), 0.0, 1.0);
  return 6.0 * t * (1.0 - t) / (e1 - e0);
}
vec4 wkFbmD(vec3 p, float f0, float fw) {
  vec4 s = vec4(0.0);
  float a = 0.5;
  float f = 1.0;
  for (int i = 0; i < 3; i++) {
    vec4 n = wkNoiseD(p * f + float(i) * 7.31);
    float k = a * wkAA(f0 * f, fw);
    s += vec4((n.x - 0.5) * k, n.yzw * (k * f));
    a *= 0.5;
    f *= 2.03;
  }
  return vec4(s.x * 1.1429 + 0.5, s.yzw * 1.1429);
}
vec4 wkCell(vec3 p, float rMax, out vec4 h) {
  vec3 ci = floor(p);
  h = wkHash4(ci);
  float r = rMax * (0.55 + 0.45 * h.w);
  vec3 q = p - (ci + 0.5 + (h.xyz - 0.5) * (1.0 - 2.0 * rMax));
  return vec4(length(q) / r, q);
}
float wkSeg(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}
vec3 wkPerturb(vec3 n, vec2 dH, float fd) {
  vec3 sp = -vViewPosition;
  vec3 sx = dFdx(sp);
  vec3 sy = dFdy(sp);
  vec3 r1 = cross(sy, n);
  vec3 r2 = cross(n, sx);
  float det = dot(sx, r1) * fd;
  vec3 o = abs(det) * n - sign(det) * (dH.x * r1 + dH.y * r2);
  float l = length(o);
  return l > 1e-20 ? o / l : n;
}
`;

const GL_GROWTH = `
void wkGrowth(vec3 p, vec3 N, float fw, float amt, float expo, float sd, inout vec3 col, inout float rough, inout vec3 g, inout float ao) {
  float a = amt * expo;
  if (a < 0.02) return;
  float up = N.y;
  float top = smoothstep(-0.2, 0.7, up);
  vec4 w4 = wkNoise4(p * 8.0 + sd * 3.7);
  vec3 q = p + (w4.xyz - 0.5) * 0.06;
  vec4 m = wkNoise4(q * 7.0 + sd * 17.0);
  vec4 m2 = wkNoise4(q * 23.0 + sd * 5.3 + 3.1);
  float far = 1.0 - wkAA(23.0, fw);
  vec4 lw = wkNoise4(p * 3.1 + sd * 9.3);
  vec3 qc = p + (lw.xyz - 0.5) * 0.12;
  vec4 pfd = wkNoiseD(qc * 5.5 + sd * 2.9);
  float pf = pfd.x * 0.62 + m.x * 0.38 + 0.12 * (top - 0.5);
  float covT = mix(0.6, 0.47, top);
  float cov = smoothstep(covT - 0.06, covT + 0.06, pf);
  float kP = wkNoise4(qc * 2.3 + sd * 13.0).y;
  vec3 pc = mix(vec3(0.25, 0.27, 0.15), vec3(0.62, 0.38, 0.14), smoothstep(0.56, 0.72, kP));
  pc = mix(pc, vec3(0.56, 0.37, 0.4), smoothstep(0.32, 0.18, kP));
  pc *= 0.8 + 0.32 * m2.x;
  float cw = cov * a * 0.62;
  col = mix(col, pc, cw);
  rough = mix(rough, 0.93, cw);
  g += 0.0014 * a * (1.0 - far) * wkSsD(covT - 0.06, covT + 0.06, pf) * pfd.yzw * 5.5 * 0.62;
  ao *= 1.0 - 0.1 * cw * (1.0 - m2.y);
  float turfM = smoothstep(0.3, 0.85, m.x * 0.6 + m2.x * 0.4);
  float turf = smoothstep(0.3, 0.95, up) * mix(turfM, 0.45, far) * a;
  col = mix(col, vec3(0.2, 0.25, 0.11) * (0.85 + 0.3 * m2.y), turf * 0.5);
  rough = mix(rough, 0.95, turf);
  float bryM = smoothstep(0.66, 0.95, m2.z * 0.7 + uwNoise3(q * 60.0 + sd) * 0.3);
  float bry = mix(bryM, 0.12, far) * a;
  if (bry > 0.002) {
    float lace = mix(0.5, uwNoise3(p * 420.0 + sd), wkAA(420.0, fw));
    col = mix(col, mix(col * 0.82, vec3(0.47, 0.42, 0.33), lace), bry * 0.3);
    rough = mix(rough, 0.92, bry);
    ao *= 1.0 - 0.1 * bry * (1.0 - lace);
  }
  vec4 cf = wkFbmD(q * 22.0 + sd * 3.0, 22.0, fw);
  float cm = cf.x + 0.16 * (m.z - 0.5) + 0.1 * (m2.w - 0.5);
  float corE = smoothstep(0.56, 0.76, cm);
  float cor = mix(corE, 0.14 * smoothstep(0.35, 0.75, m.z), far) * a * (0.25 + 0.75 * top);
  if (cor > 0.002) {
    float centre = smoothstep(0.68, 0.86, cm);
    vec3 cc = mix(vec3(0.68, 0.38, 0.44), vec3(0.58, 0.3, 0.38), m2.w);
    cc = mix(cc, cc * 0.8, centre);
    float margin = smoothstep(0.56, 0.62, cm) * (1.0 - smoothstep(0.62, 0.7, cm)) * (1.0 - far);
    cc = mix(cc, vec3(0.8, 0.66, 0.64), margin * 0.4);
    col = mix(col, mix(col, cc, 0.7), cor * 0.45);
    rough = mix(rough, 0.88, cor);
    g += 0.0011 * a * (1.0 - far) * wkSsD(0.56, 0.76, cm) * cf.yzw * 22.0;
    vec4 kn = wkNoiseD(p * 260.0 + sd * 7.0);
    g += 0.0006 * cor * wkAA(260.0, fw) * kn.yzw * 260.0;
    ao *= 1.0 - 0.12 * cor * (1.0 - centre);
  }
  {
    vec4 hs;
    vec4 sc = wkCell(p * 40.0 + sd * 2.0, 0.3, hs);
    float spot = (1.0 - smoothstep(0.55, 1.0, sc.x)) * step(hs.y, 0.06 * a) * (1.0 - smoothstep(0.1, 0.7, up)) * wkAA(80.0, fw);
    col = mix(col, fract(hs.z * 7.0) > 0.5 ? vec3(0.8, 0.32, 0.08) : vec3(0.82, 0.62, 0.12), spot * 0.75);
    rough = mix(rough, 0.7, spot);
  }
  float wm = smoothstep(0.56, 0.74, m2.y) * smoothstep(0.52, 0.72, lw.w) * a * (0.25 + 0.75 * top);
  if (wm > 0.01) {
    vec4 wn = wkNoiseD(p * 55.0 + sd * 9.0);
    vec3 gw = wn.yzw * 55.0;
    float gl = length(gw) + 1e-3;
    float dist = abs(wn.x - 0.5) / gl;
    float R = 0.0006 + 0.0008 * m.w;
    float aa = wkAA(1.0 / (2.5 * R), fw);
    float seg = smoothstep(0.56, 0.7, uwNoise3(p * 62.0 + sd * 3.0)) * wm;
    float tube = 1.0 - smoothstep(R * 0.5, R, dist);
    vec3 tc = mix(col, vec3(0.84, 0.82, 0.76), 0.85);
    col = mix(col, tc, mix(0.02 * seg, tube * seg * 0.8, aa));
    ao *= 1.0 - 0.35 * aa * seg * smoothstep(R, R * 1.4, dist) * (1.0 - smoothstep(R * 1.4, R * 2.4, dist));
    if (dist < R) g += (-2.0 * dist / R) * sign(wn.x - 0.5) * (gw / gl) * seg * aa * 0.6;
  }
  float bm = smoothstep(0.55, 0.75, m.x * 0.5 + m2.w * 0.5) * smoothstep(0.5, 0.72, lw.z) * a * top;
  if (bm > 0.01) {
    vec4 hb;
    vec4 cb = wkCell(p * 85.0 + sd * 11.0, 0.3, hb);
    float aa = wkAA(255.0, fw);
    col = mix(col, vec3(0.45), 0.03 * bm * (1.0 - aa));
    if (hb.y < bm * 0.22 && cb.x < 1.0) {
      float rho = cb.x / (0.55 + 0.6 * hb.x);
      float outer = smoothstep(0.0, 0.6, 1.0 - rho);
      float crater = 1.0 - smoothstep(0.15, 0.32, rho);
      vec3 drho = cb.yzw / (max(length(cb.yzw), 1e-4) * 0.3 * (0.55 + 0.45 * hb.w)) * 85.0;
      g += 0.0026 * (0.6 + 0.4 * hb.z) * (0.9 * wkSsD(0.15, 0.32, rho) - wkSsD(0.0, 0.6, 1.0 - rho)) * drho * aa;
      col = mix(col, mix(vec3(0.42, 0.41, 0.38), vec3(0.49, 0.48, 0.45), smoothstep(0.35, 0.75, rho)), outer * aa * step(rho, 1.0));
      col = mix(col, vec3(0.12, 0.10, 0.10), crater * aa);
      rough = mix(rough, 0.8, outer * aa);
    }
  }
}
void wkOver(vec3 p, vec3 N, float fw, float amt, float sd, inout vec3 col, inout float rough, inout vec3 g, inout float ao) {
  if (amt < 0.02) return;
  vec4 w = wkNoise4(p * 2.6 + sd * 4.3);
  vec3 q = p + (w.xyz - 0.5) * 0.18;
  vec4 a1 = wkNoise4(q * 4.2 + sd * 7.7);
  vec4 a2 = wkNoiseD(q * 13.0 + sd * 2.1);
  vec4 a3 = wkNoise4(q * 31.0 + sd * 5.9);
  float far = 1.0 - wkAA(31.0, fw);
  float up = N.y;
  float f = a1.x * 0.6 + a2.x * 0.28 + mix(a3.x, 0.5, far) * 0.12 + 0.1 * (up - 0.2);
  float sheet = smoothstep(0.5 - 0.22 * amt, 0.58 - 0.22 * amt, f);
  vec3 cc = mix(vec3(0.5, 0.21, 0.15), vec3(0.54, 0.33, 0.34), smoothstep(0.42, 0.58, a1.y));
  cc = mix(cc, vec3(0.32, 0.29, 0.17), smoothstep(0.62, 0.74, a1.z) * 0.8);
  cc = mix(cc, vec3(0.6, 0.42, 0.16), smoothstep(0.3, 0.2, a1.z) * 0.7);
  cc = mix(cc, vec3(0.62, 0.46, 0.46), (smoothstep(0.5 - 0.22 * amt, 0.54 - 0.22 * amt, f) - smoothstep(0.54 - 0.22 * amt, 0.6 - 0.22 * amt, f)) * 0.5 * (1.0 - far));
  float spg = smoothstep(0.62, 0.72, a1.z + 0.1 * (a3.y - 0.5)) * (1.0 - smoothstep(0.0, 0.6, up));
  cc = mix(cc, mix(vec3(0.68, 0.32, 0.1), vec3(0.56, 0.15, 0.1), step(0.5, fract(a1.w * 5.0))), spg);
  float tf = smoothstep(0.35, 0.85, up) * smoothstep(0.35, 0.6, a1.w + 0.2 * (a3.z - 0.5));
  cc = mix(cc, vec3(0.24, 0.23, 0.13) * (0.85 + 0.3 * a3.w), tf * 0.85);
  cc *= 0.82 + 0.3 * mix(a3.w, 0.5, far);
  float k = sheet * amt;
  col = mix(col, cc, k * 0.74);
  rough = mix(rough, 0.93, k);
  g += 0.0016 * k * (1.0 - far) * a2.yzw * 13.0 * 0.28;
  ao *= 1.0 - 0.14 * k * (1.0 - a3.y);
}
`;

const CLAY_VDECL = `
attribute vec4 aInst;
attribute vec3 aLoc;
attribute vec4 aPart;
attribute float aVar;
attribute vec4 aGnd;
varying vec4 vWkInst;
varying vec3 vWkLoc;
varying vec4 vWkPart;
varying float vWkChip;
varying vec3 vWkGnd;
varying float vWkUp;
`;
const CLAY_VBEGIN = `
vWkInst = aInst;
vWkLoc = aLoc;
vWkPart = aPart;
vWkChip = 0.0;
#ifdef USE_INSTANCING
vWkGnd = vec3(aGnd.xy, aInst.y - aGnd.x * instanceMatrix[3].x - aGnd.y * instanceMatrix[3].z);
#else
vWkGnd = vec3(0.0, 0.0, aInst.y);
#endif
if (abs(aVar - aInst.w) > 0.5) transformed = vec3(0.0);
#ifdef USE_INSTANCING
{
  vec3 wkAx = mat3(instanceMatrix) * vec3(0.0, 1.0, 0.0);
  vWkUp = wkAx.y / max(length(wkAx), 1e-5);
  if (aPart.x > 4.5) {
    if (vWkUp < 0.62) transformed = vec3(0.0);
    else {
      vec3 wkMy = vec3(instanceMatrix[0][1], instanceMatrix[1][1], instanceMatrix[2][1]);
      transformed.y -= (wkMy.x * transformed.x + wkMy.z * transformed.z) / max(wkMy.y, 0.3);
    }
  }
}
#else
vWkUp = 0.0;
if (aPart.x > 4.5) transformed = vec3(0.0);
#endif
#ifdef WK_CHIP
{
  float wkTh = atan(position.z, position.x + 1e-5);
  float wkSd = aInst.x;
  if (aPart.x < 0.5) {
    float wkRim = smoothstep(0.395, 0.44, position.y);
    float wkN = 0.5 * sin(wkTh * 3.0 + wkSd * 40.0) + 0.3 * sin(wkTh * 7.0 + wkSd * 13.0) + 0.2 * sin(wkTh * 17.0 + wkSd * 71.0);
    float wkC = smoothstep(0.28, 0.62, wkN) * step(0.3, fract(wkSd * 7.31)) * wkRim;
    transformed.y -= wkC * 0.024;
    transformed.xz *= 1.0 - wkC * 0.05;
    vWkChip = wkC;
  }
  float wkB = 0.016 * sin(wkTh + wkSd * 30.0) * smoothstep(-0.36, -0.05, position.y) * (1.0 - smoothstep(0.08, 0.3, position.y));
  transformed.xz *= 1.0 + wkB;
}
#endif
`;
const CLAY_FDECL = `
varying vec4 vWkInst;
varying vec3 vWkLoc;
varying vec4 vWkPart;
varying float vWkChip;
varying vec3 vWkGnd;
varying float vWkUp;
${GL_LIB}
${GL_GROWTH}
float wkGlyphs(vec2 q, float sd) {
  float cx = floor((q.x + 6.0) / 4.0);
  if (cx < 0.0 || cx > 4.0 || abs(q.y) > 4.0) return 0.0;
  vec2 lp = vec2(q.x + 6.0 - cx * 4.0 - 2.0, q.y);
  vec4 h = wkHash4(vec3(cx, sd * 17.0, 3.0));
  float d = 100.0;
  if (h.x > 0.35) d = min(d, wkSeg(lp, vec2(-1.2, -2.9), vec2(-1.2, 2.9)));
  if (h.y > 0.55) d = min(d, wkSeg(lp, vec2(1.2, -2.9), vec2(1.2, 2.9)));
  if (h.z > 0.5) d = min(d, wkSeg(lp, vec2(-1.2, 2.9), vec2(1.2, 2.9)));
  if (h.w > 0.6) d = min(d, wkSeg(lp, vec2(-1.2, 0.0), vec2(1.2, 0.0)));
  if (h.x < 0.3) d = min(d, abs(length(lp * vec2(1.0, 0.72)) - 1.5));
  if (h.z < 0.25) d = min(d, wkSeg(lp, vec2(-1.2, -2.9), vec2(1.2, 2.9)));
  if (h.y < 0.2) d = min(d, wkSeg(lp, vec2(-1.2, -2.9), vec2(1.2, -2.9)));
  return 1.0 - smoothstep(0.3, 0.55, d);
}
float wkRose(vec2 q) {
  vec2 r = q - vec2(-11.0, 0.6);
  float rad = length(r);
  float petal = 2.4 * (0.78 + 0.22 * cos(5.0 * atan(r.y, r.x + 1e-4)));
  float flower = 1.0 - smoothstep(petal - 0.35, petal, rad);
  float boss = 1.0 - smoothstep(0.5, 0.8, rad);
  float stem = 1.0 - smoothstep(0.25, 0.45, wkSeg(q, vec2(-11.0, -1.6), vec2(-10.4, -4.9)));
  float bud = 1.0 - smoothstep(0.5, 0.8, length(q - vec2(-8.9, -3.3)));
  return max(max(flower * 0.8 + boss * 0.35, stem * 0.8), bud * 0.8);
}
float wkStampH(vec2 q, float sd) {
  vec2 a = abs(q);
  float fr = max(a.x - 15.0, (a.y - 5.4) * 2.0);
  float border = smoothstep(-0.2, 0.3, fr) * (1.0 - smoothstep(1.0, 1.6, fr));
  float inField = 1.0 - smoothstep(-0.2, 0.3, fr);
  return 0.32 * border + inField * (-0.12 + 0.34 * max(wkRose(q), wkGlyphs(q, sd)));
}
vec3 wkStamp(vec2 uv, float sd, float fw) {
  vec2 q = uv * vec2(17.0, 7.5);
  float e = 0.12;
  float h0 = wkStampH(q, sd);
  float hx = wkStampH(q + vec2(e, 0.0), sd) - wkStampH(q - vec2(e, 0.0), sd);
  float hy = wkStampH(q + vec2(0.0, e), sd) - wkStampH(q - vec2(0.0, e), sd);
  return vec3(h0 * 0.001, vec2(hx * 17.0, hy * 7.5) * (0.001 / (2.0 * e)) * wkAA(800.0, fw));
}
`;
const CLAY_FCOLOR = `
vec3 wkP = vWkLoc;
vec3 wkPdx = dFdx(wkP);
vec3 wkPdy = dFdy(wkP);
vec2 wkUV = vWkPart.yz;
vec2 wkUVdx = dFdx(wkUV);
vec2 wkUVdy = dFdy(wkUV);
float wkFw = max(length(wkPdx), length(wkPdy)) + 1e-5;
vec3 wkG = vec3(0.0);
vec2 wkGuv = vec2(0.0);
float wkRough = 0.84;
float wkAo = 1.0;
{
  float part = vWkPart.x;
  float sd = vWkInst.x;
  float above = vWPos.y - (vWkGnd.z + dot(vWkGnd.xy, vWPos.xz));
  vec3 N = normalize(vWNrm);
  vec3 c = diffuseColor.rgb;
  vec4 n4 = wkNoise4(wkP * 4.3 + sd * 31.7);
  vec4 m4 = wkNoise4(wkP * 15.0 + sd * 13.1);
  c *= 0.88 + 0.24 * (n4.x * 0.65 + m4.x * 0.35);
  c = mix(c, c * vec3(0.74, 0.62, 0.54), smoothstep(0.6, 0.8, n4.y) * 0.35);
  float slip = smoothstep(0.45, 0.65, n4.z * 0.7 + m4.z * 0.3);
  c = mix(c, c * 0.82 + vec3(0.12, 0.07, 0.03), slip * 0.3);
  float spk = uwHash13(floor(wkP * 850.0) + sd);
  float spkA = wkAA(425.0, wkFw);
  c = mix(c, vec3(0.82, 0.76, 0.64), step(0.986, spk) * spkA * 0.8);
  c = mix(c, c * 0.45, step(spk, 0.010) * spkA * 0.7);
  float groove = 0.0;
  if (part < 0.5) {
    vec4 wn = wkNoiseD(wkP * vec3(7.0, 2.2, 7.0) + sd * 7.0);
    float k = 560.0;
    float ph = wkP.y * k + wn.x * 6.0 + sd * 50.0 + 2.0 * sin(wkP.y * 150.0 + sd * 9.0);
    float fa = wkAA(k / 6.2832, wkFw) * smoothstep(0.05, 0.15, wkP.y) * smoothstep(0.2, 0.75, uwNoise3(vec3(wkP.y * 60.0, sd * 13.0, 0.5)));
    wkG += 0.00012 * (0.45 + wn.x) * fa * cos(ph) * (vec3(0.0, k, 0.0) + 6.0 * wn.yzw * vec3(7.0, 2.2, 7.0));
    groove = fa * (0.5 - 0.5 * sin(ph));
    c *= 1.0 - 0.015 * groove;
    c = mix(c, vec3(0.70, 0.38, 0.22), smoothstep(0.15, 0.6, vWkChip) * 0.8);
  } else if (part < 1.5) {
    c *= 1.04;
  } else if (part < 2.5) {
    if (vWkPart.w > 0.5) {
      vec3 st = wkStamp(wkUV, sd + sign(wkP.x) * 0.37, wkFw);
      wkGuv += st.yz;
      c *= 0.88 + 0.12 * clamp(st.x / 0.0004, 0.0, 1.0);
    }
  } else if (part < 3.5) {
    float t = vWkPart.w;
    float core = smoothstep(0.22, 0.4, t) * (1.0 - smoothstep(0.6, 0.78, t));
    c = mix(vec3(0.40, 0.23, 0.14), vec3(0.20, 0.18, 0.17), core * 0.85) * (0.85 + 0.3 * m4.y);
    wkRough = 0.95;
    vec4 fr = wkNoiseD(wkP * 900.0);
    wkG += 0.00025 * fr.yzw * 900.0 * wkAA(900.0, wkFw);
  } else if (part < 4.5) {
    vec3 pitch = mix(vec3(0.13, 0.10, 0.075), vec3(0.22, 0.17, 0.12), m4.x);
    c = mix(c * vec3(0.66, 0.56, 0.5), pitch, smoothstep(0.4, 0.65, n4.w) * 0.8);
    float fill = smoothstep(0.55, 0.8, vWkUp) * (1.0 - smoothstep(0.405, 0.43, wkP.y));
    c = mix(c, WK_SAND * (0.72 + 0.18 * m4.y), max(fill, smoothstep(0.3, 0.8, N.y) * 0.65));
    wkRough = mix(0.6 + 0.3 * m4.y, 0.95, fill);
  } else {
    c = WK_SAND * (0.68 + 0.16 * m4.y + 0.08 * n4.x) * (1.0 - 0.15 * vWkPart.w);
    wkRough = 0.95;
  }
  {
    vec4 hp;
    vec4 cp = wkCell(wkP * 380.0 + sd * 3.0, 0.3, hp);
    float pa = wkAA(760.0, wkFw);
    if (cp.x < 1.0 && hp.y < 0.35 + 0.3 * n4.w && pa > 0.01) {
      float s2 = cp.x * cp.x;
      wkG += 4.0 * 0.0005 * cp.x * (1.0 - s2) * cp.yzw / (max(length(cp.yzw), 1e-5) * 0.3 * (0.55 + 0.45 * hp.w)) * 380.0 * pa;
      wkAo *= 1.0 - 0.3 * (1.0 - s2) * pa;
    }
  }
  float bur = 1.0 - smoothstep(0.0, 0.16, above);
  c = mix(c, c * vec3(0.72, 0.62, 0.52), bur * 0.45);
  float low = 1.0 - smoothstep(0.02, 0.3, above);
  c = mix(c, vec3(0.50, 0.45, 0.37), clamp(groove * 1.4 + 0.2, 0.0, 1.0) * low * 0.45);
  float cont = 1.0 - smoothstep(-0.01, 0.12, above);
  c *= 1.0 - 0.38 * cont;
  wkAo *= 1.0 - 0.4 * cont * smoothstep(0.2, -0.7, N.y);
  float sandLine = 1.0 - smoothstep(0.0, 0.03 + 0.03 * n4.w, above);
  float expo = smoothstep(0.03, 0.14, above) * (part > 2.5 && part < 3.5 ? 0.15 : 1.0) * step(part, 3.5);
  float film = smoothstep(0.1, 0.8, N.y) * smoothstep(0.38, 0.72, n4.z * 0.6 + m4.y * 0.4) * vWkInst.z * expo;
  c = mix(c, mix(vec3(0.17, 0.3, 0.1), vec3(0.26, 0.26, 0.12), m4.z) * (0.8 + 0.4 * m4.x), film * 0.42);
  float dust = smoothstep(0.2, 0.95, N.y) * (0.34 + 0.16 * m4.w + 0.08 * (n4.x - 0.5)) * 0.5;
  c = mix(c, WK_SAND * (0.9 + 0.2 * m4.y), clamp(sandLine * 0.9 + dust, 0.0, 1.0));
  wkRough = mix(wkRough, 0.95, dust);
  wkGrowth(wkP, N, wkFw, 0.3 + vWkInst.z * 0.6, expo, sd, c, wkRough, wkG, wkAo);
  wkOver(wkP, N, wkFw, (0.5 + 0.5 * vWkInst.z) * expo * (0.55 + 0.45 * smoothstep(-0.4, 0.5, N.y)), sd, c, wkRough, wkG, wkAo);
  diffuseColor.rgb = c * wkAo;
}
`;
const CLAY_FROUGH = 'roughnessFactor = wkRough;\nmetalnessFactor = 0.0;';
const CLAY_FNORMAL = 'normal = wkPerturb(normal, vec2(dot(wkG, wkPdx) + dot(wkGuv, wkUVdx), dot(wkG, wkPdy) + dot(wkGuv, wkUVdy)), faceDirection);';

const ROUGH_METAL = 'roughnessFactor = wkRough;\nmetalnessFactor = wkMetal;';
const NORMAL_G = 'normal = wkPerturb(normal, vec2(dot(wkG, wkPdx), dot(wkG, wkPdy)), faceDirection);';
const HEAD = (src) => `
vec3 wkP = ${src};
vec3 wkPdx = dFdx(wkP);
vec3 wkPdy = dFdy(wkP);
float wkFw = max(length(wkPdx), length(wkPdy)) + 1e-5;
vec3 wkG = vec3(0.0);
float wkRough = 0.85;
float wkMetal = 0.0;
float wkAo = 1.0;
`;

const WOOD_VDECL = 'attribute vec3 aLoc;\nattribute vec4 aWood;\nattribute vec3 aWoodB;\nvarying vec3 vWkLoc;\nvarying vec4 vWkWood;\nvarying vec3 vWkWoodB;\n';
const WOOD_VBEGIN = 'vWkLoc = aLoc;\nvWkWood = aWood;\nvWkWoodB = aWoodB;\n';
const WOOD_FDECL = `varying vec3 vWkLoc;\nvarying vec4 vWkWood;\nvarying vec3 vWkWoodB;\n${GL_LIB}\n${GL_GROWTH}\n`;
const WOOD_FCOLOR = HEAD('vWkLoc') + `
{
  float kind = vWkWood.x;
  float sd = vWkWood.y;
  float strake = vWkWood.z;
  float endD = vWkWood.w;
  float hw = vWkWoodB.x;
  float ht = vWkWoodB.y;
  float above = vWPos.y - vWkWoodB.z;
  vec3 N = normalize(vWNrm);
  vec2 pith = kind > 4.5 ? vec2(0.02, -0.015) : vec2((fract(sd * 13.13) - 0.5) * hw, -ht - 0.04 - fract(sd * 7.77) * 0.2);
  vec4 wob = wkNoiseD(vec3(wkP.x * 0.8, wkP.y * 6.0, wkP.z * 6.0) + sd * 11.0);
  vec2 dvw = wkP.yz - pith;
  float rr = max(length(dvw), 1e-4);
  vec4 wob2 = wkNoiseD(vec3(wkP.x * 2.2, wkP.y * 1.5, wkP.z * 1.5) + sd * 5.0);
  float rad = rr + 0.02 * (wob.x - 0.5) + 0.03 * (wob2.x - 0.5);
  vec3 drad = vec3(0.0, dvw / rr) + 0.02 * wob.yzw * vec3(0.8, 6.0, 6.0) + 0.03 * wob2.yzw * vec3(2.2, 1.5, 1.5);
  float F = 1200.0 * (0.8 + 0.4 * wob2.x);
  float ph = rad * F;
  float ringA = wkAA(191.0, wkFw);
  float s = 0.5 + 0.5 * sin(ph);
  vec4 lo = wkNoise4(wkP * vec3(1.6, 7.0, 7.0) + sd * 5.0);
  float ringK = kind > 4.5 ? 0.4 : 0.6;
  vec3 c = mix(vec3(0.25, 0.18, 0.11), vec3(0.18, 0.13, 0.08), mix(0.38, 0.3 + 0.2 * s * s * s, ringA * ringK));
  c *= 0.84 + 0.32 * lo.z;
  float fib = uwNoise3(vec3(wkP.x * 16.0, wkP.y * 650.0, wkP.z * 650.0) + sd * 3.0);
  c *= 0.9 + 0.2 * mix(0.5, fib, wkAA(650.0, wkFw));
  float chn = uwNoise3(vec3(wkP.x * 2.6, wkP.y * 70.0, wkP.z * 70.0) + sd * 9.0);
  c *= 1.0 - 0.16 * smoothstep(0.6, 0.85, chn) * wkAA(70.0, wkFw);
  wkG += 0.00012 * ringA * ringK * 1.5 * s * s * cos(ph) * F * drad;
  vec4 fb = wkNoiseD(vec3(wkP.x * 14.0, wkP.y * 260.0, wkP.z * 260.0) + sd);
  wkG += 0.00016 * wkAA(260.0, wkFw) * fb.yzw * vec3(14.0, 260.0, 260.0);
  float endF = 1.0 - smoothstep(0.04, 0.45, endD);
  c = mix(c, vec3(0.34, 0.32, 0.27) * (0.85 + 0.3 * lo.y), smoothstep(0.5, 0.8, lo.x) * 0.22);
  c = mix(c, vec3(0.56, 0.5, 0.4) * (0.85 + 0.3 * lo.y), endF * 0.6);
  wkRough = 0.9;
  float ted = clamp(0.015 + 0.5 * endF + 0.25 * smoothstep(0.6, 0.9, lo.w), 0.0, 0.7) * smoothstep(-0.05, 0.12, above);
  {
    mat3 tm = mat3(0.82, 0.39, -0.42, -0.23, 0.89, 0.39, 0.52, -0.23, 0.82);
    vec3 tp = tm * wkP;
    for (int li = 0; li < 2; li++) {
      float fl = float(li);
      float cs = mix(0.016, 0.042, fl);
      vec3 cq = tp / cs + vec3(fl * 17.3, sd * 5.0, fl * 3.1);
      vec3 ci = floor(cq);
      vec4 th = wkHash4(ci + sd * 3.0);
      vec4 th2 = wkHash4(ci + 11.7);
      if (th.w < ted * mix(1.0, 0.3, fl)) {
        float r = mix(0.035 + 0.075 * th.x * th.x * th.x, 0.06 + 0.05 * th.x, fl);
        float hl = 0.08 + 0.18 * th2.x;
        vec3 dir = tm * normalize(th2.w < 0.2 ? vec3(0.3, th.y - 0.5, 1.0) : vec3(1.0, (th.y - 0.5) * 1.6, (th.z - 0.5) * 1.6));
        vec3 cen = ci + 0.5 + (th2.yzw - 0.5) * max(0.0, 1.0 - 2.0 * (hl + r));
        vec3 bq = cq - cen;
        vec3 ev = bq - dir * clamp(dot(bq, dir), -hl, hl);
        float dd = length(ev);
        float ta = wkAA(0.5 / (r * cs), wkFw);
        if (dd < r * 1.4 && ta > 0.01) {
          float hole = 1.0 - smoothstep(r * 0.72, r, dd);
          float lining = smoothstep(r * 0.7, r * 0.95, dd) * (1.0 - smoothstep(r, r * 1.35, dd)) * fl;
          c = mix(c, vec3(0.03, 0.025, 0.02), hole * ta);
          c = mix(c, vec3(0.8, 0.78, 0.72), lining * ta * 0.5);
          wkG += 0.003 * ta * wkSsD(r * 0.72, r, dd) * ((ev / max(dd, 1e-5) / cs) * tm);
          wkAo *= 1.0 - 0.45 * hole * ta;
        }
      }
    }
    c *= 1.0 - 0.18 * ted * (1.0 - wkAA(60.0, wkFw));
  }
  if (kind < 0.5 || (kind > 3.5 && kind < 4.5)) {
    float seam = wkP.y > 0.0 ? strake + 1.0 : strake;
    float off = fract(seam * 0.618034);
    float pcell = floor(wkP.x / 0.21 - off);
    float pj = fract(sin(pcell * 45.164 + seam * 94.673) * 43758.5453);
    float uc = (pcell + 0.5 + off) * 0.21 + (pj - 0.5) * 0.08;
    vec2 pq = vec2(wkP.x - uc, abs(wkP.y) - (hw - 0.03));
    float pd = length(pq);
    float face = smoothstep(0.55, 0.9, abs(wkP.z) / ht);
    float pgh = fract(sin(uc * 12.9898 + seam * 78.233) * 43758.5453);
    float peg = (1.0 - smoothstep(0.0065, 0.0085, pd)) * face * step(0.68, pgh);
    c = mix(c, c * mix(0.7, 0.88, pgh), peg * 0.7);
    wkG += 0.00025 * face * step(0.68, pgh) * wkSsD(0.0065, 0.0085, pd) * vec3(pq.x, sign(wkP.y) * pq.y, 0.0) / max(pd, 1e-5);
    wkAo *= 1.0 - 0.45 * smoothstep(hw - 0.012, hw - 0.002, abs(wkP.y));
    float fi = floor((wkP.x - (${fmt(HULL.S0)})) / ${fmt(HULL.DS)} + 0.5);
    vec2 nq = vec2(wkP.x - (${fmt(HULL.S0)}) - fi * ${fmt(HULL.DS)}, wkP.y);
    float nd = length(nq);
    float outer = smoothstep(0.55, 0.9, -wkP.z / ht) * step(kind, 0.5);
    c = mix(c, vec3(0.18, 0.38, 0.30), (1.0 - smoothstep(0.008, 0.035, nd)) * outer * 0.55);
    c = mix(c, vec3(0.05, 0.08, 0.06), (1.0 - smoothstep(0.006, 0.009, nd)) * outer);
    wkG -= 0.004 * outer * wkSsD(0.006, 0.009, nd) * vec3(nq, 0.0) / max(nd, 1e-5);
  } else if (kind < 1.5) {
    float au = abs(wkP.x);
    float kk = floor((au - ${fmt(HULL.SIG0)}) / ${fmt(HULL.PW)});
    vec2 nq = vec2(au - ${fmt(HULL.SIG0)} - (kk + 0.5) * ${fmt(HULL.PW)}, wkP.y);
    float nd = length(nq);
    float inner = smoothstep(0.5, 0.9, wkP.z / ht) * step(0.0, kk);
    c = mix(c, vec3(0.16, 0.36, 0.28), (1.0 - smoothstep(0.01, 0.045, nd)) * inner * 0.5);
    c = mix(c, vec3(0.07, 0.10, 0.08) + vec3(0.09, 0.2, 0.14) * lo.x, (1.0 - smoothstep(0.008, 0.016, nd)) * inner);
    wkG -= 0.006 * inner * wkSsD(0.008, 0.016, nd) * vec3(sign(wkP.x) * nq.x, nq.y, 0.0) / max(nd, 1e-5);
  } else if (kind < 2.5) {
    float fi = floor((wkP.x - (${fmt(HULL.S0)})) / ${fmt(HULL.DS)} + 0.5);
    vec2 bq = vec2(wkP.x - (${fmt(HULL.S0)}) - fi * ${fmt(HULL.DS)}, wkP.y);
    float bd = length(bq);
    float top = smoothstep(0.5, 0.9, wkP.z / ht);
    c = mix(c, vec3(0.46, 0.23, 0.09) * (0.8 + 0.4 * lo.y), (1.0 - smoothstep(0.012, 0.05, bd)) * top * 0.85);
    wkG -= 0.006 * top * wkSsD(0.01, 0.03, bd) * vec3(bq, 0.0) / max(bd, 1e-5);
  } else if (kind < 3.5) {
    c = mix(c, vec3(0.44, 0.33, 0.2), 0.6);
  }
  float bur = 1.0 - smoothstep(0.0, 0.12, above);
  c = mix(c, c * vec3(0.72, 0.68, 0.62), bur * 0.5);
  float sandLine = 1.0 - smoothstep(0.0, 0.025 + 0.03 * lo.y, above);
  float dust = smoothstep(0.65, 0.95, N.y) * smoothstep(0.35, 0.8, lo.y) * (0.35 + 0.65 * (1.0 - s)) * 0.3;
  c = mix(c, WK_SAND * (0.78 + 0.15 * lo.x), clamp(sandLine * 0.85 + dust, 0.0, 1.0));
  wkRough = mix(wkRough, 0.95, dust);
  wkGrowth(wkP + sd * 3.1, N, wkFw, 0.8, smoothstep(0.03, 0.15, above), sd, c, wkRough, wkG, wkAo);
  wkOver(wkP + sd * 3.1, N, wkFw, 0.85 * smoothstep(0.05, 0.2, above), sd, c, wkRough, wkG, wkAo);
  diffuseColor.rgb = c * wkAo;
}
`;

const MISC_VDECL = 'attribute vec3 aLoc;\nattribute vec4 aMisc;\nattribute float aFloor;\nvarying vec3 vWkLoc;\nvarying vec4 vWkMisc;\nvarying float vWkFloor;\n';
const MISC_VBEGIN = 'vWkLoc = aLoc;\nvWkMisc = aMisc;\nvWkFloor = aFloor;\n';
const MISC_FDECL = `varying vec3 vWkLoc;\nvarying vec4 vWkMisc;\nvarying float vWkFloor;\n${GL_LIB}\n${GL_GROWTH}\n`;
const MISC_FCOLOR = HEAD('vWkLoc') + `
vec2 wkUV = vWkMisc.zw;
vec2 wkUVdx = dFdx(wkUV);
vec2 wkUVdy = dFdy(wkUV);
vec2 wkGuv = vec2(0.0);
{
  float kind = vWkMisc.x;
  float sd = vWkMisc.y;
  float above = vWPos.y - vWkFloor;
  vec3 N = normalize(vWNrm);
  vec3 c = diffuseColor.rgb;
  vec4 n4 = wkNoise4(wkP * 5.0 + sd * 7.0);
  vec4 m4 = wkNoise4(wkP * 19.0 + sd * 3.0);
  float grow = 0.6;
  if (kind < 0.5 || (kind > 4.5 && kind < 5.5)) {
    c = vec3(0.38, 0.39, 0.41) * (0.85 + 0.3 * n4.x);
    c = mix(c, vec3(0.28, 0.29, 0.31), smoothstep(0.45, 0.85, m4.x) * 0.5);
    float wc = smoothstep(0.45, 0.85, n4.y * 0.7 + m4.y * 0.3);
    c = mix(c, vec3(0.56, 0.56, 0.53) * (0.9 + 0.2 * m4.z), wc * 0.5);
    wkMetal = 0.45 * (1.0 - wc);
    wkRough = mix(0.5, 0.92, wc);
    grow = kind > 4.5 ? 0.8 : 0.45;
    vec4 dn = wkNoiseD(wkP * 70.0 + sd);
    wkG += 0.0004 * wkAA(70.0, wkFw) * dn.yzw * 70.0;
    if (kind < 0.5) {
      vec2 tq = (fract(wkUV / vec2(0.045, 0.235)) - 0.5) * vec2(0.045, 0.235);
      float td = length(tq);
      c = mix(c, vec3(0.16, 0.30, 0.24), (1.0 - smoothstep(0.0035, 0.0055, td)) * 0.8);
      wkGuv -= 0.0015 * wkSsD(0.0035, 0.0055, td) * tq / max(td, 1e-5);
    }
  } else if (kind < 1.5) {
    c *= 0.78 + 0.44 * n4.x * (0.7 + 0.6 * m4.x);
    c = mix(c, c * vec3(0.62, 0.58, 0.54), smoothstep(0.4, 0.75, m4.z) * 0.5);
    float spk = uwHash13(floor(wkP * 600.0));
    c = mix(c, c * 1.12 + 0.015, step(0.95, spk) * wkAA(300.0, wkFw) * 0.5);
    vec4 sf = wkFbmD(wkP * 22.0 + sd, 22.0, wkFw);
    wkG += 0.004 * sf.yzw * 22.0;
    vec4 pf = wkNoiseD(wkP * 90.0 + sd * 3.0);
    wkG += 0.0005 * wkAA(90.0, wkFw) * pf.yzw * 90.0;
    wkRough = 0.9;
    grow = 0.95;
  } else if (kind > 5.5) {
    c *= 0.8 + 0.4 * n4.x;
    vec4 sf = wkFbmD(wkP * 40.0 + sd, 40.0, wkFw);
    wkG += 0.003 * sf.yzw * 40.0;
    wkRough = 0.95;
    grow = 1.0;
  } else {
    float worn = max(smoothstep(0.55, 0.72, n4.z * 0.6 + m4.z * 0.4), step(0.5, wkUV.x));
    c = mix(c, vec3(0.64, 0.43, 0.28) * (0.9 + 0.2 * m4.x), worn);
    wkRough = mix(0.22 + 0.1 * m4.y, 0.85, worn);
    grow = 0.55;
  }
  float bur = 1.0 - smoothstep(0.0, 0.1, above);
  c = mix(c, c * vec3(0.7, 0.66, 0.6), bur * 0.5);
  float sandLine = 1.0 - smoothstep(0.0, 0.02 + 0.02 * n4.w, above);
  float dust = smoothstep(0.6, 0.95, N.y) * smoothstep(0.35, 0.75, m4.w) * 0.55;
  c = mix(c, WK_SAND * (0.82 + 0.2 * m4.y), clamp(sandLine * 0.85 + dust, 0.0, 1.0));
  if (kind > 0.5 && kind < 1.5) c = mix(c, WK_SAND * (0.56 + 0.14 * m4.y), smoothstep(0.35, 0.9, N.y) * (0.3 + 0.35 * smoothstep(0.3, 0.7, m4.w)));
  wkMetal *= 1.0 - clamp(sandLine + dust, 0.0, 1.0);
  wkGrowth(wkP, N, wkFw, grow, smoothstep(0.02, 0.12, above), sd, c, wkRough, wkG, wkAo);
  diffuseColor.rgb = c * wkAo;
}
`;
const MISC_FNORMAL = 'normal = wkPerturb(normal, vec2(dot(wkG, wkPdx) + dot(wkGuv, wkUVdx), dot(wkG, wkPdy) + dot(wkGuv, wkUVdy)), faceDirection);';

const BRONZE_VDECL = 'attribute vec3 aLoc;\nattribute float aCav;\nattribute float aFloor;\nattribute float aSeed;\nvarying vec3 vWkLoc;\nvarying float vWkCav;\nvarying float vWkFloor;\nvarying float vWkSeed;\n';
const BRONZE_VBEGIN = 'vWkLoc = aLoc;\nvWkCav = aCav;\nvWkFloor = aFloor;\nvWkSeed = aSeed;\n';
const BRONZE_FDECL = `varying vec3 vWkLoc;\nvarying float vWkCav;\nvarying float vWkFloor;\nvarying float vWkSeed;\n${GL_LIB}\n${GL_GROWTH}\n`;
const BRONZE_FCOLOR = HEAD('vWkLoc') + `
{
  float cav = vWkCav;
  float sd = vWkSeed;
  float above = vWPos.y - vWkFloor;
  vec3 N = normalize(vWNrm);
  vec4 n1 = wkNoise4(wkP * 6.5 + sd * 5.0);
  vec4 n2 = wkNoise4(wkP * 21.0 + sd * 3.0);
  vec4 wf = wkFbmD(wkP * 26.0 + sd, 26.0, wkFw);
  float pt = n1.x * 0.55 + n2.x * 0.2 + wf.x * 0.25 + (1.0 - cav) * 0.45 - 0.06;
  float bare = 1.0 - smoothstep(0.34, 0.44, pt);
  float cup = smoothstep(0.30, 0.40, pt) * (1.0 - smoothstep(0.44, 0.54, pt));
  float green = smoothstep(0.44, 0.54, pt);
  vec3 metal = vec3(0.52, 0.34, 0.18) * (0.75 + 0.5 * n2.y);
  vec3 cuprite = vec3(0.32, 0.15, 0.1) * (0.8 + 0.4 * n2.z);
  vec3 pat = mix(mix(vec3(0.1, 0.3, 0.24), vec3(0.24, 0.45, 0.37), n2.w), mix(vec3(0.12, 0.26, 0.34), vec3(0.2, 0.36, 0.44), n2.y), smoothstep(0.7, 0.86, n1.y) * 0.5);
  pat = mix(pat, vec3(0.05, 0.07, 0.06), smoothstep(0.66, 0.84, n1.z) * 0.55);
  pat = mix(pat, vec3(0.42, 0.48, 0.4), smoothstep(0.72, 0.9, n2.x) * 0.25);
  vec3 c = mix(metal, cuprite, clamp(cup + green * 0.2, 0.0, 1.0));
  c = mix(c, pat, green);
  wkMetal = bare * 0.95 + cup * 0.25;
  wkRough = mix(0.30, 0.78, 1.0 - bare) + 0.08 * n2.z;
  wkG += 0.0009 * green * wf.yzw * 26.0;
  {
    vec4 hp;
    vec4 cp = wkCell(wkP * 140.0 + sd * 3.0, 0.32, hp);
    float pa = wkAA(280.0, wkFw);
    if (cp.x < 1.0 && hp.y < 0.45 && pa > 0.01) {
      float s2 = cp.x * cp.x;
      wkG += 4.0 * 0.0008 * cp.x * (1.0 - s2) * cp.yzw / (max(length(cp.yzw), 1e-5) * 0.32 * (0.55 + 0.45 * hp.w)) * 140.0 * pa;
      float pit = (1.0 - s2) * pa;
      c = mix(c, mix(vec3(0.05, 0.06, 0.05), vec3(0.3, 0.42, 0.32), 1.0 - smoothstep(0.0, 0.3, cp.x)), pit * 0.7);
      wkMetal *= 1.0 - pit;
      wkAo *= 1.0 - 0.3 * pit;
    }
  }
  float conc = clamp((1.0 - smoothstep(0.25, 0.6, cav)) * 0.8 + smoothstep(0.1, 0.85, N.y) * 0.75 + 0.2, 0.0, 1.0) * smoothstep(0.38, 0.62, n1.w + 0.25);
  c = mix(c, vec3(0.4, 0.4, 0.35) * (0.85 + 0.3 * n2.x), conc * 0.65);
  wkMetal *= 1.0 - conc;
  wkRough = mix(wkRough, 0.95, conc);
  float sandLine = 1.0 - smoothstep(0.0, 0.03, above);
  c = mix(c, WK_SAND, sandLine * 0.85);
  wkMetal *= 1.0 - sandLine;
  wkGrowth(wkP, N, wkFw, 0.55, smoothstep(0.03, 0.15, above) * (0.4 + 0.6 * conc), sd, c, wkRough, wkG, wkAo);
  diffuseColor.rgb = c * wkAo;
}
`;

const MARBLE_VDECL = 'attribute vec3 aLoc;\nattribute float aCav;\nattribute float aFloor;\nvarying vec3 vWkLoc;\nvarying float vWkCav;\nvarying float vWkFloor;\n';
const MARBLE_VBEGIN = 'vWkLoc = aLoc;\nvWkCav = aCav;\nvWkFloor = aFloor;\n';
const MARBLE_FDECL = `varying vec3 vWkLoc;\nvarying float vWkCav;\nvarying float vWkFloor;\n${GL_LIB}\n${GL_GROWTH}\n`;
const MARBLE_FCOLOR = HEAD('vWkLoc') + `
vec3 wkSSS = vec3(0.0);
{
  float cav = vWkCav;
  float above = vWPos.y - vWkFloor;
  vec3 N = normalize(vWNrm);
  vec3 c = vec3(0.76, 0.71, 0.6);
  vec4 wv = wkNoise4(wkP * 2.6 + 3.0);
  vec4 wv2 = wkNoise4(wkP * 9.0 + 1.0);
  float vein = abs(sin(dot(wkP, vec3(2.9, 1.3, 2.1)) * 7.0 + (wv.x * 1.6 + wv.y * 0.8 + wv2.x * 0.35) * 4.2));
  c = mix(c, vec3(0.5, 0.51, 0.52), (1.0 - smoothstep(0.0, 0.06 + 0.12 * wv.z, vein)) * 0.3);
  c *= 0.94 + 0.08 * wv2.y;
  c = mix(c, vec3(0.52, 0.42, 0.29), smoothstep(0.42, 0.78, wv.w) * 0.4);
  c = mix(c, vec3(0.29, 0.29, 0.26), smoothstep(0.5, 0.82, wv2.z) * 0.3);
  float gr = uwHash13(floor(wkP * 700.0));
  float ga = wkAA(350.0, wkFw);
  c *= 1.0 + 0.05 * (gr - 0.5) * ga;
  wkRough = 0.55 + 0.12 * gr * ga;
  float wth = smoothstep(-0.35, 0.5, N.y) * smoothstep(0.02, 0.16, above);
  vec4 wf = wkFbmD(wkP * 14.0, 14.0, wkFw);
  vec4 wf2 = wkFbmD(wkP * 5.0 + 2.0, 5.0, wkFw);
  c = mix(c, vec3(0.5, 0.46, 0.37) * (0.85 + 0.3 * wv2.z), wth * 0.6);
  c = mix(c, vec3(0.23, 0.25, 0.18), wth * smoothstep(0.45, 0.8, wv.w) * 0.5);
  c = mix(c, c * 0.62, smoothstep(0.45, 0.72, wv.y) * wth * 0.6);
  c *= 1.0 - 0.22 * wth * smoothstep(0.35, 0.8, wv2.w * 0.6 + wf.x * 0.4);
  wkRough = mix(wkRough, 0.95, wth);
  wkG += (0.0022 * wf.yzw * 14.0 + 0.004 * wf2.yzw * 5.0) * (0.35 + wth);
  {
    vec4 hb;
    vec4 cb = wkCell(wkP * 260.0, 0.3, hb);
    float ba = wkAA(520.0, wkFw);
    if (cb.x < 1.0 && hb.y < 0.2 + wth * 0.55) {
      float hole = 1.0 - smoothstep(0.55, 0.9, cb.x);
      c = mix(c, vec3(0.13, 0.12, 0.1), hole * ba * 0.85);
      wkAo *= 1.0 - 0.4 * hole * ba;
      wkG += 0.0012 * wkSsD(0.55, 0.9, cb.x) * cb.yzw / (max(length(cb.yzw), 1e-5) * 0.3 * (0.55 + 0.45 * hb.w)) * 260.0 * ba;
    }
    c *= 1.0 - 0.12 * (0.3 + wth) * (1.0 - ba);
    vec4 hl;
    vec4 cl = wkCell(wkP * 38.0 + 7.0, 0.3, hl);
    float la = wkAA(76.0, wkFw);
    if (cl.x < 1.0 && hl.y < 0.45 * smoothstep(0.58, 0.82, wv.z) * (0.3 + wth)) {
      float hole = 1.0 - smoothstep(0.6, 0.85, cl.x);
      float rim = smoothstep(0.55, 0.8, cl.x) * (1.0 - smoothstep(0.85, 1.0, cl.x));
      c = mix(c, vec3(0.15, 0.14, 0.12), hole * la);
      c = mix(c, c * 0.78, rim * la);
      wkAo *= 1.0 - 0.5 * hole * la;
      wkG += 0.006 * wkSsD(0.6, 0.85, cl.x) * cl.yzw / (max(length(cl.yzw), 1e-5) * 0.3 * (0.55 + 0.45 * hl.w)) * 38.0 * la;
    }
  }
  float crev = 1.0 - smoothstep(0.3, 0.75, cav);
  c = mix(c, WK_SAND * 0.62, crev * 0.75);
  wkAo *= 1.0 - 0.3 * crev;
  wkRough = mix(wkRough, 0.95, crev);
  float bur = 1.0 - smoothstep(0.0, 0.14, above);
  c = mix(c, c * vec3(0.7, 0.64, 0.56), bur * 0.55);
  float sandLine = 1.0 - smoothstep(0.0, 0.035, above);
  float dust = smoothstep(0.5, 0.95, N.y) * smoothstep(0.35, 0.8, wv2.x) * 0.5;
  c = mix(c, WK_SAND * 0.9, clamp(sandLine * 0.85 + dust, 0.0, 1.0));
  wkGrowth(wkP, N, wkFw, 1.6, wth * 0.85 + crev * 0.4 + 0.15, 0.37, c, wkRough, wkG, wkAo);
  wkSSS = c * 0.012 * (1.0 - wth) * uLight;
  diffuseColor.rgb = c * wkAo;
}
`;

const COIN_VDECL = 'attribute vec4 aCoin;\nvarying vec4 vWkCoin;\n';
const COIN_VBEGIN = 'vWkCoin = aCoin;\n';
const COIN_FDECL = `varying vec4 vWkCoin;\n${GL_LIB}\n` + `
float wkCoinH(vec2 uv, float side) {
  float r = length(uv);
  float a = atan(uv.y, uv.x + 1e-5);
  float ab = floor(a / 6.2831853 * 44.0 + 0.5) / 44.0 * 6.2831853;
  float h = max(1.0 - smoothstep(0.035, 0.06, length(uv - vec2(cos(ab), sin(ab)) * 0.86)), smoothstep(0.93, 0.97, r) * 0.7);
  if (side > 0.0) {
    float face = 1.0 - smoothstep(0.30, 0.34, length((uv - vec2(0.0, -0.02)) * vec2(1.0, 0.82)));
    float hair = 1.0 - smoothstep(0.45, 0.49, length((uv - vec2(0.0, 0.03)) * vec2(1.0, 0.9)));
    float rays = step(0.45, r) * (1.0 - smoothstep(0.62, 0.66, r)) * smoothstep(0.55, 0.85, cos(a * 16.0));
    float curls = (hair - face) * (0.62 + 0.38 * sin(uv.x * 62.0) * sin(uv.y * 58.0));
    float eyes = 1.0 - smoothstep(0.028, 0.05, length(vec2(abs(uv.x) - 0.11, uv.y - 0.06)));
    float nose = 1.0 - smoothstep(0.022, 0.045, wkSeg(uv, vec2(0.0, 0.07), vec2(0.0, -0.08)));
    float mouth = 1.0 - smoothstep(0.012, 0.03, wkSeg(uv, vec2(-0.07, -0.16), vec2(0.07, -0.16)));
    h = max(h, max(face * (0.82 - 0.28 * eyes + 0.18 * nose - 0.22 * mouth), max(curls * 0.7, rays * 0.6)));
  } else {
    vec2 q = uv - vec2(0.0, 0.1);
    float rr = length(q);
    float petals = 0.30 * (0.8 + 0.2 * cos(atan(q.y, q.x + 1e-5) * 6.0));
    float flower = 1.0 - smoothstep(petals - 0.03, petals, rr);
    float stem = 1.0 - smoothstep(0.022, 0.045, wkSeg(uv, vec2(0.0, -0.18), vec2(0.03, -0.62)));
    float buds = max(1.0 - smoothstep(0.06, 0.09, length(uv - vec2(0.24, -0.36))), 1.0 - smoothstep(0.05, 0.08, length(uv - vec2(-0.21, -0.46))));
    float twig = 1.0 - smoothstep(0.016, 0.034, min(wkSeg(uv, vec2(0.02, -0.30), vec2(0.21, -0.35)), wkSeg(uv, vec2(0.02, -0.40), vec2(-0.19, -0.45))));
    float rho = 1.0 - smoothstep(0.015, 0.03, min(wkSeg(uv, vec2(-0.62, -0.12), vec2(-0.62, 0.2)), abs(length((uv - vec2(-0.55, 0.12)) * vec2(1.0, 1.2)) - 0.075)));
    float omi = 1.0 - smoothstep(0.015, 0.03, abs(length((uv - vec2(0.58, 0.04)) * vec2(1.0, 0.8)) - 0.1));
    h = max(h, max(flower * (0.75 + 0.25 * cos(rr * 42.0)), max(max(stem, twig), buds) * 0.65));
    h = max(h, max(rho, omi) * 0.55);
  }
  return h;
}
`;
const COIN_FCOLOR = HEAD('vObjPos') + `
{
  float type = vWkCoin.x;
  float sd = vWkCoin.y;
  float corr = vWkCoin.z;
  float above = vWPos.y - vWkCoin.w;
  float fwu = max(length(wkPdx.xz), length(wkPdy.xz)) + 1e-5;
  float side = wkP.y > 0.25 ? 1.0 : (wkP.y < -0.25 ? -1.0 : 0.0);
  float mir = side < 0.0 ? -1.0 : 1.0;
  vec2 uv = vec2(wkP.x * mir, wkP.z);
  float h = 0.0;
  if (side != 0.0) {
    float e = 0.012;
    h = wkCoinH(uv, side);
    float hx = wkCoinH(uv + vec2(e, 0.0), side) - wkCoinH(uv - vec2(e, 0.0), side);
    float hy = wkCoinH(uv + vec2(0.0, e), side) - wkCoinH(uv - vec2(0.0, e), side);
    vec2 gg = vec2(hx, hy) / (2.0 * e) * 0.00045 * wkAA(8.0, fwu);
    wkG = vec3(gg.x * mir, 0.0, gg.y);
  }
  vec4 n = wkNoise4(wkP * 3.5 + sd * 17.0);
  vec3 c;
  if (type < 1.5) {
    float cr = clamp(corr * (0.6 + 0.6 * n.y) - h * 0.5, 0.0, 1.0);
    float crust = smoothstep(0.25, 0.55, cr);
    c = mix(vec3(0.78, 0.78, 0.80), mix(vec3(0.42, 0.39, 0.46), vec3(0.27, 0.25, 0.30), n.x), crust);
    c = mix(c, vec3(0.09, 0.09, 0.10), smoothstep(0.6, 0.8, n.z) * cr * 0.7);
    c = mix(c, vec3(0.20, 0.44, 0.34), smoothstep(0.7, 0.85, n.w) * cr * 0.6);
    wkMetal = 1.0 - crust * 0.9;
    wkRough = mix(0.22, 0.85, crust);
  } else if (type < 2.5) {
    c = vec3(0.95, 0.72, 0.32) * (0.92 + 0.12 * n.x);
    c = mix(c, WK_SAND * 0.8, (1.0 - h) * smoothstep(0.55, 0.8, n.y) * 0.25);
    wkMetal = 1.0;
    wkRough = 0.18 + 0.1 * n.z;
  } else {
    c = mix(vec3(0.50, 0.31, 0.17), mix(vec3(0.11, 0.38, 0.27), vec3(0.25, 0.52, 0.38), n.y), smoothstep(0.2, 0.5, corr * n.x + 0.3));
    wkMetal = 0.3;
    wkRough = 0.7;
  }
  float sandLine = 1.0 - smoothstep(0.0, 0.004, above);
  c = mix(c, WK_SAND, sandLine * 0.7);
  wkMetal *= 1.0 - sandLine * 0.7;
  diffuseColor.rgb = c;
}
`;

const GLASS_VDECL = 'attribute vec4 aGlass;\nattribute float aSide;\nvarying vec4 vWkGlass;\nvarying float vWkSide;\n';
const GLASS_VBEGIN = 'vWkGlass = aGlass;\nvWkSide = aSide;\n';
const GLASS_FDECL = `varying vec4 vWkGlass;\nvarying float vWkSide;\n${GL_LIB}\n`;
const GLASS_FCOLOR = `
float wkCrust = 0.0;
float wkIri = 0.5;
float wkIriT = 400.0;
vec3 wkEmit = vec3(0.0);
{
  vec3 p = vObjPos;
  float sd = vWkGlass.x;
  float above = vWPos.y - vWkGlass.z;
  vec4 n = wkNoise4(p * 38.0 + sd * 13.0);
  vec4 n2 = wkNoise4(p * 130.0 + sd * 3.0);
  wkCrust = smoothstep(0.3, 0.58, n.x * 0.7 + n2.x * 0.3);
  vec3 c = mix(diffuseColor.rgb * 0.75, vec3(0.5, 0.5, 0.46) * (0.85 + 0.2 * n2.z), wkCrust * 0.9);
  float a = mix(diffuseColor.a, 0.96, wkCrust);
  wkIri = smoothstep(0.55, 0.8, n.y) * (1.0 - wkCrust) * 0.1;
  wkIriT = mix(240.0, 760.0, n2.y);
  float sand = max((1.0 - smoothstep(vWkGlass.y - 0.004, vWkGlass.y, p.y)) * step(0.5, vWkSide), 1.0 - smoothstep(0.0, 0.012, above));
  c = mix(c, WK_SAND * (0.9 + 0.2 * n2.z), sand);
  a = mix(a, 1.0, sand);
  wkCrust = max(wkCrust, sand);
  wkEmit = c * 0.025 * (1.0 - wkCrust) * uLight;
  diffuseColor = vec4(c, a);
}
`;
const GLASS_FROUGH = 'roughnessFactor = mix(0.06, 0.8, wkCrust);\nmetalnessFactor = 0.0;';
const GLASS_FPHYS = '#ifdef USE_IRIDESCENCE\nmaterial.iridescence = wkIri * (1.0 - wkCrust * 0.6);\nmaterial.iridescenceThickness = wkIriT;\n#endif';

const LIFE_VDECL = 'attribute float aSway;\nuniform float uTime;\nuniform vec3 uSurge;\n';
const LIFE_VBEGIN = `
{
  float wkS = aSway * aSway;
  float wkPh = dot(position.xz, vec2(0.37, 0.29)) + position.y * 2.0;
  vec3 wkOff = vec3(uSurge.x, 0.0, uSurge.z) * 0.35 + vec3(sin(uTime * 1.7 + wkPh), 0.0, cos(uTime * 1.3 + wkPh * 1.2)) * 0.012;
  transformed += wkOff * wkS;
  transformed.y -= length(wkOff.xz) * wkS * 0.3;
}
`;
const LIFE_FEMIT = 'totalEmissiveRadiance += diffuseColor.rgb * 0.03 * uLight;';

const SPONGE_VDECL = 'attribute vec4 aSp;\nvarying vec4 vWkSp;\nvarying vec3 vWkLoc;\n';
const SPONGE_VBEGIN = 'vWkSp = aSp;\nvWkLoc = position;\n';
const SPONGE_FDECL = `varying vec4 vWkSp;\nvarying vec3 vWkLoc;\n${GL_LIB}\n`;
const SPONGE_FCOLOR = HEAD('vWkLoc') + `
{
  float type = vWkSp.x;
  float sd = vWkSp.y;
  float hh = vWkSp.z;
  float osc = vWkSp.w;
  vec3 N = normalize(vWNrm);
  vec3 c = diffuseColor.rgb;
  vec4 n4 = wkNoise4(wkP * 11.0 + sd * 13.0);
  if (type < 1.5) {
    float f = type < 0.5 ? 75.0 : 48.0;
    vec4 hc;
    vec4 cc = wkCell(wkP * f + sd * 7.0, 0.42, hc);
    float aa = wkAA(f * 2.0, wkFw);
    float bump = max(0.0, 1.0 - cc.x);
    vec3 drho = cc.yzw / (max(length(cc.yzw), 1e-5) * 0.42 * (0.55 + 0.45 * hc.w)) * f;
    wkG -= 0.005 * bump * drho * aa;
    c *= mix(1.0, 0.8 + 0.55 * bump * bump, aa);
    float pore = step(0.955, uwHash13(floor(wkP * 380.0) + sd)) * wkAA(190.0, wkFw);
    c = mix(c, c * 0.3, pore * 0.8);
    if (type > 0.5) {
      vec4 hl;
      vec4 cl = wkCell(wkP * 20.0 + sd * 3.0, 0.38, hl);
      float lac = (1.0 - smoothstep(0.5, 0.85, cl.x)) * step(hl.y, 0.6) * wkAA(40.0, wkFw);
      c = mix(c, c * 0.2, lac * 0.9);
      wkAo *= 1.0 - 0.45 * lac;
    }
    wkRough = 0.93;
  } else if (type < 2.5) {
    c *= 0.82 + 0.36 * n4.x;
    c = mix(c, c * 1.3 + 0.03, smoothstep(0.6, 0.9, n4.y) * 0.4);
    wkRough = 0.5;
  } else {
    vec4 vn = wkNoiseD(wkP * 26.0 + sd * 5.0);
    float va = wkAA(52.0, wkFw);
    float vein = 1.0 - smoothstep(0.0, 0.07, abs(vn.x - 0.5));
    c = mix(c, c * 0.62, vein * 0.55 * va);
    wkG += 0.0005 * vn.yzw * 26.0 * va;
    vec4 ho;
    vec4 co = wkCell(wkP * 30.0 + sd * 9.0, 0.3, ho);
    float oa = wkAA(60.0, wkFw);
    if (ho.y < 0.22 && co.x < 1.0) {
      c = mix(c, vec3(0.03, 0.02, 0.015), (1.0 - smoothstep(0.35, 0.6, co.x)) * oa);
      c = mix(c, c * 1.3, smoothstep(0.55, 0.75, co.x) * (1.0 - smoothstep(0.75, 1.0, co.x)) * oa);
    }
    c *= 0.88 + 0.24 * n4.y;
    wkRough = 0.78;
  }
  float hole = 1.0 - smoothstep(0.7, 0.98, osc);
  float lip = smoothstep(0.92, 1.05, osc) * (1.0 - smoothstep(1.05, 1.45, osc));
  c = mix(c, c * 1.2 + 0.01, lip * 0.25);
  c = mix(c, vec3(0.012, 0.01, 0.009), hole);
  wkAo *= 1.0 - 0.55 * hole;
  float silt = smoothstep(0.55, 0.95, N.y) * smoothstep(0.45, 0.85, n4.z) * 0.3 * (1.0 - hole);
  c = mix(c, WK_SAND * 0.75, silt);
  wkAo *= 0.62 + 0.38 * smoothstep(0.0, 0.3, hh);
  diffuseColor.rgb = c * wkAo;
}
`;

const DECAL_VERT = `
attribute vec2 aDec;
varying vec2 vUv;
varying float vStr;
varying float vType;
void main() {
  vUv = uv;
  vStr = aDec.x;
  vType = aDec.y;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;
const DECAL_FRAG = `
uniform float uStr;
varying vec2 vUv;
varying float vStr;
varying float vType;
void main() {
  float d = length(vUv * 2.0 - 1.0);
  if (vType > 0.5) {
    float dish = (1.0 - smoothstep(0.2, 1.0, d)) * (0.8 - 0.3 * (vUv.x * 2.0 - 1.0));
    gl_FragColor = vec4(0.0, 0.0, 0.0, dish * 0.5 * vStr * uStr);
    return;
  }
  float inner = 1.0 - smoothstep(0.05, 0.85, d);
  float trough = smoothstep(0.45, 0.72, d) * (1.0 - smoothstep(0.72, 1.0, d));
  gl_FragColor = vec4(0.0, 0.0, 0.0, (inner * inner * 0.85 + trough * 0.35) * vStr * uStr);
}
`;

function wkMaterial(mat, key, s) {
  mat.onBeforeCompile = (shader) => {
    if (s.uniforms) Object.assign(shader.uniforms, s.uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\n' + (s.vdecl || ''))
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n' + (s.vbegin || ''));
    let fs = shader.fragmentShader.replace('#include <common>', '#include <common>\n' + (s.fdecl || ''));
    if (s.fcolor) fs = fs.replace('#include <color_fragment>', '#include <color_fragment>\n' + s.fcolor);
    if (s.frough) fs = fs.replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\n' + s.frough);
    if (s.fnormal) fs = fs.replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n' + s.fnormal);
    if (s.femit) fs = fs.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n' + s.femit);
    if (s.fphys) fs = fs.replace('#include <lights_physical_fragment>', '#include <lights_physical_fragment>\n' + s.fphys);
    shader.fragmentShader = fs;
  };
  mat.customProgramCacheKey = () => key;
  return patchMaterial(mat);
}
function makeMaterials() {
  const clay = (chip) => {
    const m = new THREE.MeshStandardMaterial({ roughness: 0.84, metalness: 0 });
    if (chip) m.defines = { WK_CHIP: '' };
    return wkMaterial(m, chip ? 'wk-clay-vessel' : 'wk-clay-piece', { vdecl: CLAY_VDECL, vbegin: CLAY_VBEGIN, fdecl: CLAY_FDECL, fcolor: CLAY_FCOLOR, frough: CLAY_FROUGH, fnormal: CLAY_FNORMAL });
  };
  return {
    vessel: clay(true),
    piece: clay(false),
    wood: wkMaterial(new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0 }), 'wk-wood',
      { vdecl: WOOD_VDECL, vbegin: WOOD_VBEGIN, fdecl: WOOD_FDECL, fcolor: WOOD_FCOLOR, frough: ROUGH_METAL, fnormal: NORMAL_G }),
    misc: wkMaterial(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, metalness: 0 }), 'wk-misc',
      { vdecl: MISC_VDECL, vbegin: MISC_VBEGIN, fdecl: MISC_FDECL, fcolor: MISC_FCOLOR, frough: ROUGH_METAL, fnormal: MISC_FNORMAL }),
    bronze: wkMaterial(new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0.5 }), 'wk-bronze',
      { vdecl: BRONZE_VDECL, vbegin: BRONZE_VBEGIN, fdecl: BRONZE_FDECL, fcolor: BRONZE_FCOLOR, frough: ROUGH_METAL, fnormal: NORMAL_G }),
    marble: wkMaterial(new THREE.MeshStandardMaterial({ roughness: 0.4, metalness: 0 }), 'wk-marble',
      { vdecl: MARBLE_VDECL, vbegin: MARBLE_VBEGIN, fdecl: MARBLE_FDECL, fcolor: MARBLE_FCOLOR, frough: ROUGH_METAL, fnormal: NORMAL_G, femit: 'totalEmissiveRadiance += wkSSS;' }),
    coin: wkMaterial(new THREE.MeshStandardMaterial({ roughness: 0.3, metalness: 1 }), 'wk-coin',
      { vdecl: COIN_VDECL, vbegin: COIN_VBEGIN, fdecl: COIN_FDECL, fcolor: COIN_FCOLOR, frough: ROUGH_METAL, fnormal: NORMAL_G }),
    glass: wkMaterial(new THREE.MeshPhysicalMaterial({
      roughness: 0.06, metalness: 0, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false,
      iridescence: 0.2, iridescenceIOR: 1.6, iridescenceThicknessRange: [200, 800],
    }), 'wk-glass', { vdecl: GLASS_VDECL, vbegin: GLASS_VBEGIN, fdecl: GLASS_FDECL, fcolor: GLASS_FCOLOR, frough: GLASS_FROUGH, femit: 'totalEmissiveRadiance += wkEmit;', fphys: GLASS_FPHYS }),
    life: wkMaterial(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0 }), 'wk-life',
      { vdecl: LIFE_VDECL, vbegin: LIFE_VBEGIN, femit: LIFE_FEMIT, uniforms: { uSurge: U.uSurge } }),
    decal: new THREE.ShaderMaterial({
      uniforms: { uStr: { value: 0.62 } }, vertexShader: DECAL_VERT, fragmentShader: DECAL_FRAG,
      transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    }),
    sponge: wkMaterial(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0 }), 'wk-sponge',
      { vdecl: SPONGE_VDECL, vbegin: SPONGE_VBEGIN, fdecl: SPONGE_FDECL, fcolor: SPONGE_FCOLOR, frough: ROUGH_METAL, fnormal: NORMAL_G }),
  };
}
function instanced(geo, mat, items, instName, withColour, cast, gnd = false) {
  const n = items.length, cnt = Math.max(1, n), mesh = new THREE.InstancedMesh(geo, mat, cnt);
  const arr = mesh.instanceMatrix.array;
  const inst = instName ? new Float32Array(cnt * 4) : null, col = withColour ? new Float32Array(cnt * 3) : null;
  const gd = gnd ? new Float32Array(cnt * 4) : null;
  items.forEach((it, i) => {
    compose(arr, i * 16, it.p, it.q, it.s === undefined ? 1 : it.s);
    if (inst) inst.set(it.inst, i * 4);
    if (col) col.set(it.c, i * 3);
    if (gd && it.g) gd.set(it.g, i * 4);
  });
  if (gd) geo.setAttribute('aGnd', new THREE.InstancedBufferAttribute(gd, 4));
  if (inst) geo.setAttribute(instName, new THREE.InstancedBufferAttribute(inst, 4));
  if (col) mesh.instanceColor = new THREE.InstancedBufferAttribute(col, 3);
  mesh.count = n;
  mesh.instanceMatrix.needsUpdate = true;
  mesh.castShadow = cast;
  mesh.receiveShadow = true;
  mesh.computeBoundingSphere();
  return mesh;
}
function instancedKit(mb, ranges, mat, items, instName, withColour, cast, gnd = false) {
  const kit = mb.geometry(), out = [];
  ranges.forEach(([start, count], v) => {
    const mine = items.filter((it) => it.inst[3] === v);
    if (!mine.length) return;
    const g = new THREE.BufferGeometry();
    for (const k in kit.attributes) g.setAttribute(k, kit.attributes[k]);
    g.setIndex(kit.index);
    g.setDrawRange(start, count);
    g.boundingSphere = kit.boundingSphere;
    out.push(instanced(g, mat, mine, instName, withColour, cast, gnd));
  });
  return out;
}

const sparsePts = (mb, step = 3) => { const out = []; for (let i = 0; i < mb.count; i += step) out.push([mb.P[i * 3], mb.P[i * 3 + 1], mb.P[i * 3 + 2]]); return out; };
const floorAttr = { aFloor: (i, lp, wp) => terrainY(wp[0], wp[2]) };
const floorAttrM = { aFloor: (i, lp, wp) => moundTop(wp[0], wp[2]) };
function anchorStock(ctx, x, z, yaw, tilt = 0, sink = 0.04) {
  const tmp = new MB({ aLoc: 3, aMisc: 4, color: 3 }), sd = ctx.rng(), at = (p) => ({ aLoc: p, aMisc: [5, sd, 0, 0], color: [0.42, 0.44, 0.47] });
  for (const sg of [-1, 1]) {
    const rings = [];
    for (let i = 0; i <= 14; i++) {
      const t = i / 14, x0 = sg * (0.07 + t * 0.59), hy = lerp$4(0.045, 0.024, t), hz = lerp$4(0.04, 0.022, t), dy = -0.03 * t * t;
      const pts = RECT12.map(([a, w]) => [x0, dy + (w - 0.5) * 2 * hy, (a - 0.5) * 2 * hz]);
      rings.push({ pts, attrs: pts.map(at), c: [x0, dy, 0] });
    }
    sweepRings(tmp, rings, false, true);
  }
  const bar = (x0, x1, y0, y1) => box8(tmp, (dx, dy, dz) => [(x0 + x1) / 2 + dx, (y0 + y1) / 2 + dy, dz], (x1 - x0) / 2, (y1 - y0) / 2, 0.052, (dx, dy, dz, p) => at(p));
  bar(-0.075, 0.075, 0.034, 0.066); bar(-0.075, 0.075, -0.066, -0.034); bar(-0.075, -0.04, -0.034, 0.034); bar(0.04, 0.075, -0.034, 0.034);
  const pose = layPiece(sparsePts(tmp), [0, 0, 0], qMul(qAxis(UP, yaw), qAxis([0, 0, 1], tilt)), x, z, sink);
  ctx.misc.append(tmp, pose, floorAttr);
  ctx.decals.push({ x, z, dir: [Math.cos(yaw), 0, -Math.sin(yaw)], len: 1.5, wid: 0.3, str: 0.5 });
  ctx.discs.push([x, z, 0.7]);
  const e = qRot(pose.q, [0.66, 0, 0]);
  ctx.caps.push({ a: sub(pose.p, e), b: add(pose.p, e), r: 0.06 });
  ctx.px.add({ a: sub(pose.p, e), b: add(pose.p, e), r: 0.07 });
  embed(ctx, sparsePts(tmp, 2).map((p) => xp(pose, p)), x, z, BANK.timber);
  return pose;
}
function loosePlank(ctx, x0, z0, yaw, len, id) {
  const { rng } = ctx, sd = rng(), d = [Math.cos(yaw), 0, Math.sin(yaw)], pp = [-d[2], 0, d[0]];
  const wd = 0.2 + rng() * 0.06, th = 0.045, n = Math.ceil(len / 0.1), rings = [];
  for (let i = 0; i <= n; i++) {
    const u = -len / 2 + len * (i / n), endD = Math.min(u + len / 2, len / 2 - u), ero = 1 - smoothstep(0, 0.35, endD);
    const w2 = wd * (1 - 0.3 * ero), t2 = th * (1 - 0.4 * ero), cx = x0 + d[0] * u, cz = z0 + d[2] * u, lift = 0.012 * noise3(u * 1.3, id, 0.5) - 0.03;
    const pts = [], attrs = [];
    for (const [a, w] of RECT12) {
      const x = cx + pp[0] * (a - 0.5) * w2, z = cz + pp[2] * (a - 0.5) * w2, p = [x, terrainY(x, z) + lift + w * t2, z];
      pts.push(p);
      attrs.push(woodAttr(4, sd, id, endD, [u, (a - 0.5) * w2, (w - 0.5) * t2], w2 / 2, t2 / 2, p));
    }
    rings.push({ pts, attrs, c: [cx, terrainY(cx, cz) + lift + t2 * 0.5, cz] });
  }
  splinter(rings, rng, 0.06);
  sweepRings(ctx.wood, rings, true, true);
  ctx.decals.push({ x: x0, z: z0, dir: d, len: len + 0.2, wid: wd + 0.25, str: 0.45 });
  ctx.discs.push([x0, z0, len * 0.5]);
  ctx.px.add({ a: [x0 - d[0] * len * 0.5, terrainY(x0, z0), z0 - d[2] * len * 0.5], b: [x0 + d[0] * len * 0.5, terrainY(x0, z0), z0 + d[2] * len * 0.5], r: wd * 0.5 });
  embed(ctx, rings.flatMap((r) => r.pts), x0, z0, BANK.timber);
}
function looseFrame(ctx, x0, z0, yaw) {
  const { rng } = ctx, sd = rng(), R = 1.0, span = 1.3, n = 22, rings = [], H = HULL;
  for (let i = 0; i <= n; i++) {
    const ph = yaw + span * (i / n), rad = [Math.cos(ph), 0, Math.sin(ph)], endD = Math.min(i, n - i) * (R * span / n);
    const cx = x0 + rad[0] * R, cz = z0 + rad[2] * R, pts = [], attrs = [], sink = 0.055 + 0.02 * noise3(i * 0.4, sd * 5, 0.7);
    for (const [a, w] of RECT16) {
      const wr = arrisWear(a, w, i * 0.06, sd, 1.4), aa = a - Math.sign(a - 0.5) * wr / H.FS, ww = w - Math.sign(w - 0.5) * wr / H.FM;
      const x = cx + rad[0] * (ww - 0.5) * H.FM, z = cz + rad[2] * (ww - 0.5) * H.FM, p = [x, terrainY(x, z) - sink + aa * H.FS, z];
      pts.push(p);
      attrs.push(woodAttr(1, sd, 0, endD, [H.SIG0 + R * span * (i / n), (a - 0.5) * H.FS, (w - 0.5) * H.FM], H.FS / 2, H.FM / 2, p));
    }
    rings.push({ pts, attrs, c: [cx, terrainY(cx, cz) - sink + H.FS * 0.5, cz] });
  }
  splinter(rings, rng, 0.05);
  sweepRings(ctx.wood, rings, true, true);
  embed(ctx, rings.flatMap((r) => r.pts), x0 + Math.cos(yaw + span / 2) * R, z0 + Math.sin(yaw + span / 2) * R, BANK.timber);
  const mid = yaw + span / 2;
  ctx.discs.push([x0 + Math.cos(mid) * R, z0 + Math.sin(mid) * R, 0.75]);
}
function leadSheet(ctx, x0, z0, yaw) {
  const { rng, misc: M } = ctx, sd = rng(), nu = 16, nv = 11, c = Math.cos(yaw), s = Math.sin(yaw), v0 = M.count, i0 = M.I.length, id = [];
  for (let i = 0; i <= nu; i++) {
    id.push([]);
    for (let j = 0; j <= nv; j++) {
      const u = -0.36 + 0.72 * (i / nu), v = -0.23 + 0.46 * (j / nv), x = x0 + c * u - s * v, z = z0 + s * u + c * v;
      const y = terrainY(x, z) + 0.004 + 0.04 * Math.exp(-(((u - 0.08) / 0.045) ** 2)) * (0.6 + 0.4 * Math.sin(v * 9)) + 0.008 * noise3(u * 9, v * 9, sd * 7);
      id[i].push(M.v([x, y, z], UP, { aLoc: [u, v, 0], aMisc: [0, sd, u, v + 0.3], aFloor: terrainY(x, z), color: [0.42, 0.44, 0.47] }));
    }
  }
  for (let i = 0; i < nu; i++) {
    for (let j = 0; j < nv; j++) if (Math.min(i, nu - 1 - i, j, nv - 1 - j) > 1.2 * (0.5 + 0.5 * noise3(i * 0.7, j * 0.7, sd * 9)) - 0.2) M.quad(id[i][j], id[i + 1][j], id[i + 1][j + 1], id[i][j + 1]);
  }
  M.fixWinding(i0);
  M.smooth(v0, i0);
  ctx.discs.push([x0, z0, 0.45]);
}

let BOWL_PTS = null;
const bowlPts = () => BOWL_PTS || (BOWL_PTS = BOWL.flatMap(([r, y]) => Array.from({ length: 12 }, (_, j) => [r * Math.cos((j / 12) * TAU$8), y, r * Math.sin((j / 12) * TAU$8)])));
const centroid = (pts) => mul(pts.reduce((s, p) => add(s, p), [0, 0, 0]), 1 / Math.max(1, pts.length));
const GLASS_COLOURS = [[0.14, 0.2, 0.36], [0.46, 0.33, 0.14], [0.17, 0.33, 0.24], [0.3, 0.19, 0.32], [0.24, 0.38, 0.38], [0.44, 0.38, 0.2]];

class Wreck {
  constructor(scene, { detail = 1 } = {}) {
    LATHE_K = Math.min(1, Math.max(0.3, +detail || 1));
    PROF_K = 1 + (1 - LATHE_K);
    const rng = makeRng$1(1901);
    this.group = new THREE.Group();
    this.group.name = 'wreck';
    scene.add(this.group);
    this.obstacles = [];
    this.fishObstacles = [];
    this.capsules = [];
    this.amphorae = [];
    const ctx = {
      rng, px: new Proxies(0.8), caps: [], obstacles: this.obstacles, fishObs: this.fishObstacles, tops: [], decals: [], discs: [], embeds: [],
      wood: new MB({ aLoc: 3, aWood: 4, aWoodB: 3 }), misc: new MB({ aLoc: 3, aMisc: 4, aFloor: 1, color: 3 }),
      bronze: new MB({ aLoc: 3, aCav: 1, aFloor: 1, aSeed: 1 }), marble: new MB({ aLoc: 3, aCav: 1, aFloor: 1 }),
      life: new MB({ color: 3, aSway: 1 }), sponge: new MB({ color: 3, aSp: 4 }),
      vessels: [[], []], pieces: [[], []], sherds: [], coins: [], glass: [], placed: [], loose: [],
      ship: { frames: 0, tall: 0, leaning: 0, strakeRuns: 0, plankMetres: 0, tenons: 0, beams: [], mast: null, oar: false, rope: false, lead: 0 },
    };
    const ms = {};
    let t = Date.now();
    const lap = (name) => { const now = Date.now(); ms[name] = now - t; t = now; };
    ctx.lap = lap;
    SITE.shelters.length = 0;
    SITE.sponges.length = 0;
    SITE.den = -1;
    const kit = ceramicKit(makeRng$1(77));
    lap('kit');
    withBaseFinds(() => {
      bakeMound();
      lap('mound');
      buildHull(ctx);
      lap('hull');
    });
    ctx.rng = varyRng(1901);
    this._cargo(ctx, kit);
    lap('cargo');
    this._galley(ctx);
    lap('galley');
    this._statues(ctx);
    lap('statues');
    this._finds(ctx);
    this._embedded(ctx);
    lap('finds');
    this._life(ctx);
    this._sponges(ctx);
    lap('life+sponges');
    this._shelters(ctx);
    this._build(ctx, kit);
    lap('build');
    this.stats.ms = ms;
    this.capsules.push(...ctx.caps.map((c) => ({ ax: c.a[0], ay: c.a[1], az: c.a[2], bx: c.b[0], by: c.b[1], bz: c.b[2], r: c.r })));
    if (WRECK_LIFE.grow) {
      const hosts = ctx.tops.map((t) => ({ x: t.p[0], y: t.p[1], z: t.p[2], nx: t.n[0], ny: t.n[1], nz: t.n[2], h: t.p[1] - groundM(t.p[0], t.p[2]) }));
      for (const c of ctx.caps) {
        const l = Math.hypot(...sub(c.b, c.a));
        if (!c.sup || l < 0.5 || c.r < 0.05) continue;
        for (let k = 0, m = Math.max(2, Math.round(l / 0.7)); k < m; k++) {
          const a = lerp3(c.a, c.b, (k + 0.5) / m), y = a[1] + c.r * 0.9, h = y - groundM(a[0], a[2]);
          if (h > 0.2) hosts.push({ x: a[0], y, z: a[2], nx: 0, ny: 1, nz: 0, h });
        }
      }
      for (const v of this.amphorae) {
        const y = v.position.y + 0.14, h = y - groundM(v.position.x, v.position.z);
        if (h > 0.18) hosts.push({ x: v.position.x, y, z: v.position.z, nx: 0, ny: 1, nz: 0, h: Math.min(h, 0.29), jar: true });
      }
      WRECK_LIFE.grow(hosts);
    }
  }

  _free(ctx, x, z, r) {
    return clearOf(x, z, 0) && !ctx.px.nearXZ(x, z, r) && !ctx.discs.some(([a, b, rr]) => Math.hypot(x - a, z - b) < r + rr);
  }
  _spot(ctx, x, z, r) {
    for (let k = 0; k < 40; k++) {
      const a = k * 2.4, d = 0.09 * Math.sqrt(k) * (1 + r * 3), px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d;
      if (this._free(ctx, px, pz, r)) return [px, pz];
    }
    return null;
  }

  _cargo(ctx, kit) {
    const { rng, px } = ctx, yawB = Math.atan2(HB[2], HB[0]), yawA = Math.atan2(HA[2], HA[0]), RB = [0.165, 0.149];
    const colour = (kind) => {
      const sh = 0.82 + rng() * 0.23, h = rng();
      return kind === 1 ? [lerp$4(0.66, 0.52, h) * sh, 0.27 * sh, lerp$4(0.13, 0.17, h) * sh]
        : [lerp$4(0.72, 0.56, h) * sh, lerp$4(0.37, 0.33, h) * sh, lerp$4(0.17, 0.21, h) * sh];
    };
    const shadow = (pose, len, wid, str) => {
      const a = qRot(pose.q, UP), h = Math.hypot(a[0], a[2]);
      ctx.decals.push({ x: pose.p[0], z: pose.p[2], dir: h > 0.2 ? [a[0] / h, 0, a[2] / h] : [1, 0, 0], len: h > 0.2 ? len : wid, wid, str });
    };
    const record = (kind, pose, lift, growth, upright, colourKind) => {
      const m = xp(pose, [0, 0.45, 0]), open = kind === 2 || (!upright && m[1] > terrainY(m[0], m[2]) + 0.1);
      this.amphorae.push({ kind, position: new THREE.Vector3(...pose.p), quaternion: new THREE.Quaternion(...pose.q), open });
      ctx.placed.push({ kind, pose, growth, upright, lift, R: RB[colourKind] });
    };
    const RS = [0.148, 0.032, 0.056];
    const capsOf = (caps0, pose, sc, shrink = 0) => caps0.map(([a, b, r], i) => ({ a: xp(pose, a), b: xp(pose, b), r: r * sc - shrink, rs: RS[i] * sc }));
    const visSup = (x, z) => Math.max(moundTop(x, z), supportY(x, z), px.surfAt(x, z));
    const restsOn = (pose, fine, com) => {
      const cp = [];
      for (const p of fine) { const w = xp(pose, p); if (w[1] - visSup(w[0], w[2]) < 0.02) cp.push([w[0], w[2]]); }
      if (cp.length < 3) return false;
      const c = xp(pose, com);
      return insideHull2(cp, c[0], c[2], 0.012);
    };
    const clearAll = (cs, pad) => cs.every((c) => clearOf(c.a[0], c.a[2], pad) && clearOf(c.b[0], c.b[2], pad));
    const onSand = (x, z) => supportY(x, z) - terrainY(x, z) < 0.02;
    const brokenSamp = kit.pieceInfo.filter((p) => p.group === 0).map((p) => ({ coarse: p.pts.filter((_, i) => i % 3 === 0), fine: p.pts }));
    const place = (x, z, o = {}) => {
      const kind = o.kind !== undefined ? o.kind : rng() < 0.6 ? 0 : 1;
      const isBroken = o.broken !== undefined ? o.broken : rng() < 0.12;
      const growth = o.growth !== undefined ? o.growth : 0.35 + rng() * 0.65;
      const pad = o.pad !== undefined ? o.pad : 0.5, maxHeld = o.maxHeld !== undefined ? o.maxHeld : 0.34;
      let mode = isBroken || pathDist(x, z) < 1.4 ? 'lie' : o.mode || 'lie';
      if (mode === 'slant' && !onSand(x, z)) mode = 'lie';
      const sc = kind === 1 ? 0.93 : 1, v = isBroken ? (kind === 1 ? 2 : rng() < 0.5 ? 0 : 1) : 0;
      const caps0 = isBroken ? BROKEN_CAPS : AMPH_CAPS, samp = isBroken ? brokenSamp[v] : kit.samp[kind];
      const yaw = o.yaw !== undefined ? o.yaw : yawB + (rng() - 0.5) * 1.6;
      if (!clearOf(x, z, pad * 0.6)) return -1;
      const g = terrainY(x, z);
      let pose, held = 0, bank = null;
      if (mode === 'upright') {
        const [hs, hb] = toHull(x, z), m = moundAt(hs, hb), tilt = 0.14 + rng() * 0.32, dir = rng() * TAU$8;
        if (m < 0.1) return -1;
        const ax = norm([Math.cos(dir) * Math.sin(tilt), Math.cos(tilt), Math.sin(dir) * Math.sin(tilt)]);
        pose = { p: [x, g + m - (kind === 0 ? 0.17 : 0.16) * Math.cos(tilt) + (rng() - 0.5) * 0.04, z], q: qMul(qFromTo(UP, ax), qAxis(UP, rng() * TAU$8)), s: 1 };
        if (px.hits(capsOf(caps0, pose, sc, 0.025), 0)) return -1;
        bank = BANK.upright;
      } else if (mode === 'slant') {
        const pitch = (rng() < 0.55 ? 1 : -1) * (0.3 + rng() * 0.38), [X, A, Z] = axisBasis(yaw, pitch, (rng() - 0.5) * 0.8);
        pose = { p: [x, g - 0.01 - rng() * 0.07, z], q: qBasis(X, A, Z), s: 1 };
        const hi = xp(pose, [0, pitch > 0 ? 0.45 : -0.42, 0]);
        if (hi[1] - terrainY(hi[0], hi[2]) < 0.1 || px.hits(capsOf(caps0, pose, sc, 0.025), 0)) return -1;
        bank = BANK.slant;
      } else {
        if (px.surfAt(x, z) > supportY(x, z) + maxHeld + 0.2) return -1;
        const sup = makeSupport(px, x, z, 0.62), roll0 = o.roll !== undefined ? o.roll : (rng() - 0.5) * 0.6;
        const pr = o.pitch || (isBroken ? [-0.45, 0.45] : [-0.5, 0.5]);
        const st = settle(sup, samp.coarse, samp.fine, isBroken ? COM_BROKEN : COM_WHOLE, x, z, yaw, roll0, pr[0], pr[1]);
        if (st.held > maxHeld) return -1;
        held = st.held > 0.015 ? st.held : 0;
        let bury = held || !onSand(x, z) ? 0 : o.bury !== undefined ? o.bury : isBroken ? 0.1 + rng() * 0.12 : 0.06 + rng() * 0.12;
        pose = { p: [x, st.y - bury, z], q: st.q, s: 1 };
        while (bury > 0.004 && px.hits(capsOf(caps0, pose, sc, 0.03), 0)) { bury *= 0.6; pose.p[1] = st.y - bury; }
        if (!restsOn(pose, samp.fine, isBroken ? COM_BROKEN : COM_WHOLE)) return -1;
        bank = held ? null : isBroken ? BANK.broken : BANK.vessel;
      }
      const cs = capsOf(caps0, pose, sc);
      if (!clearAll(cs, pad * 0.6)) return -1;
      for (const c of cs) { c.sup = mode === 'lie'; px.add(c); }
      const it = { p: pose.p, q: pose.q, c: colour(kind), inst: [rng(), g, growth, isBroken ? v : 0], g: gndAt(x, z) };
      if (isBroken) ctx.pieces[0].push(it); else ctx.vessels[kind].push(it);
      record(isBroken ? 2 : kind, pose, held, growth, mode === 'upright', kind);
      const pl = ctx.placed[ctx.placed.length - 1], d0 = ctx.decals.length, e0 = ctx.embeds.length;
      Object.assign(pl, { mode, lathe: isBroken ? PIECE_KINDS[v].kind : kind, info: isBroken ? kit.pieceInfo[v] : null, ai: this.amphorae.length - 1 });
      if (mode === 'upright') shadow(pose, 0.55, 0.55, 0.45);
      else shadow(pose, isBroken ? 0.75 : 1.0, isBroken ? 0.42 : 0.46, held > 0.05 ? 0.18 : 0.5);
      if (bank && onSand(x, z)) embed(ctx, samp.coarse.map((p) => xp(pose, p)), pose.p[0], pose.p[2], bank);
      pl.dec = [d0, ctx.decals.length]; pl.emb = [e0, ctx.embeds.length];
      return this.amphorae.length - 1;
    };
    {
      const dir = norm([HB[0] + HA[0] * 0.3, 0, HB[2] + HA[2] * 0.3]), ds = (rng() - 0.5) * 0.9, db = (rng() - 0.5) * 0.6, dy = (rng() - 0.5) * 0.3;
      const den = (s, b, y) => { const [x, z] = hullXZ(s, b); return place(x, z, { kind: 0, broken: false, mode: 'lie', yaw: Math.atan2(dir[2], dir[0]) + y, roll: 0, pitch: [-0.2, -0.08], bury: 0.03, growth: 0.95, maxHeld: 0.01, pad: 0.6 }); };
      let i = den(3.2 + ds, 6.3 + db, dy);
      if (i < 0) i = den(3.2, 6.3, 0);
      if (i >= 0) {
        SITE.den = i;
        const a = this.amphorae[i], m = a.position.clone().add(new THREE.Vector3(0, 0.45, 0).applyQuaternion(a.quaternion));
        const ah = new THREE.Vector3(0, 1, 0).applyQuaternion(a.quaternion).setY(0).normalize();
        px.add({ a: [m.x + ah.x * 0.15, m.y, m.z + ah.z * 0.15], b: [m.x + ah.x * 0.8, m.y, m.z + ah.z * 0.8], r: 0.32 });
        ctx.discs.push([m.x + ah.x * 0.45, m.z + ah.z * 0.45, 0.42]);
      }
    }
    for (const [b, flip] of [[-1.15, 0], [-0.72, 1], [0.72, 0], [1.15, 1]]) {
      for (let s = -8.9 + rng() * 0.4; s < -3.9; s += 0.6 + rng() * 0.46) {
        if (rng() < 0.22) continue;
        const [x, z] = hullXZ(s, b + (rng() - 0.5) * 0.34), up = rng() < 0.55;
        place(x, z, { yaw: yawA + flip * Math.PI + (rng() - 0.5) * 0.8, broken: rng() < 0.15, maxHeld: 0.3, growth: 0.3 + rng() * 0.4, pad: 0.4, pitch: up ? [0.22, 0.5] : [-0.1, 0.3] });
      }
    }
    for (let k = 0, got = 0; k < 60 && got < 7; k++) {
      const s = -9 + rng() * 5.4, b = (rng() < 0.5 ? -1 : 1) * (0.4 + rng() * 0.9), [x, z] = hullXZ(s, b);
      if (place(x, z, { mode: 'upright', broken: false, growth: 0.5 + rng() * 0.5, pad: 0.4 }) >= 0) got++;
    }
    const HEAPS = [[-2.6, 3.3], [-0.4, 3.5], [1.6, 3.3], [3.4, 3.7], [5.4, 3.4], [0.6, 4.8], [2.6, 5.2], [4.6, 4.9], [-1.8, 4.6]].map(([hs, hb]) => [hs + (rng() - 0.5) * 0.8, hb + (rng() - 0.5) * 0.5]);
    const SPILL = 94 + Math.floor(rng() * 13);
    let whole = 0, nBroken = 0;
    for (const [hs, hb] of HEAPS) {
      const n = 4 + Math.floor(rng() * 5), rad = 0.5 + rng() * 0.45, ya = yawB + (rng() - 0.5) * 0.9;
      for (let got = 0, tries = 0; got < n && tries < n * 6; tries++) {
        const a = rng() * TAU$8, r = rad * Math.sqrt(rng()), [x, z] = hullXZ(hs + Math.cos(a) * r, hb + Math.sin(a) * r * 0.8);
        const br = rng() < 0.3, m = rng();
        const mode = br ? 'lie' : m < 0.16 ? 'slant' : m < 0.26 ? 'upright' : 'lie';
        if (place(x, z, { broken: br, yaw: ya + (rng() - 0.5) * 0.8 + (rng() < 0.3 ? Math.PI : 0), mode, maxHeld: 0.1 }) >= 0) { got++; if (br) nBroken++; else whole++; }
      }
    }
    for (let n = 0; n < 1500 && whole + nBroken < SPILL; n++) {
      const s = clamp$9(1.5 + rng.gauss() * 3.6, -4.2, 8), b = 3.1 + Math.abs(rng.gauss()) * 1.8 + rng() * 0.6, [x, z] = hullXZ(s, b);
      const br = rng() < 0.32, m = rng(), far = b > 5;
      const mode = br ? 'lie' : m < (far ? 0.3 : 0.2) ? 'slant' : !far && m < 0.26 ? 'upright' : 'lie';
      if (place(x, z, { broken: br, yaw: far ? rng() * TAU$8 : undefined, mode, maxHeld: 0.06, bury: far ? 0.09 + rng() * 0.12 : undefined }) >= 0) { if (br) nBroken++; else whole++; }
    }
    for (const [dx, dz] of [[-2.4, -1.2], [2.2, 1.8]]) place(LAYOUT.torso.x + dx, LAYOUT.torso.z + dz, { pad: 0.8, broken: false, mode: rng() < 0.5 ? 'slant' : 'lie', bury: 0.08 });
    { const [x, z] = hullXZ(-17.5 + (rng() - 0.5) * 1.0, 3.6 + (rng() - 0.5) * 0.6); place(x, z, { pad: 0.8, broken: false, growth: 0.9, bury: 0.1 }); }
    const nearRock = (x, z) => LAYOUT.rockClusters.some((c) => Math.hypot(x - c.x, z - c.z) < c.s * 2.6);
    const frag = (pi, x, z) => {
      const info = kit.pieceInfo[pi];
      if (!info.c) info.c = centroid(info.pts);
      if (!clearOf(x, z, 0.3) || px.nearXZ(x, z, 0.12) || nearRock(x, z)) return false;
      const q = qMul(qAxis(UP, rng() * TAU$8), qAxis([1, 0, 0], Math.PI / 2 + (rng() - 0.5) * 0.5));
      const pose = layPiece(info.pts, info.c, q, x, z, 0.02 + rng() * 0.04);
      ctx.pieces[info.group].push({ p: pose.p, q, s: 1, c: colour(info.kind), inst: [rng(), terrainY(x, z), 0.3 + rng() * 0.6, info.v], g: gndAt(x, z) });
      const d0 = ctx.decals.length, e0 = ctx.embeds.length;
      ctx.decals.push({ x, z, dir: [1, 0, 0], len: 0.34, wid: 0.3, str: 0.35 });
      px.add({ a: [x, terrainY(x, z), z], b: [x, terrainY(x, z) + 0.05, z], r: 0.1 });
      embed(ctx, info.pts.map((p) => xp(pose, p)), x, z, BANK.small);
      ctx.loose.push({ info, pose, mode: 'loose', lathe: info.kind, dec: [d0, ctx.decals.length], emb: [e0, ctx.embeds.length] });
      return true;
    };
    const stick = (pi, x, z) => {
      const info = kit.pieceInfo[pi];
      if (!clearOf(x, z, 0.3) || px.nearXZ(x, z, 0.16) || nearRock(x, z) || pathDist(x, z) < 0.9) return false;
      const lean = 0.12 + rng() * 0.45, dir = rng() * TAU$8, spin = rng() * TAU$8, s1 = Math.sin(lean), c1 = Math.cos(lean);
      let q, keep;
      if (info.type === 'neck') { q = qMul(qFromTo(UP, [Math.cos(dir) * s1, c1, Math.sin(dir) * s1]), qAxis(UP, spin)); keep = [0, 0.27, 0]; }
      else if (info.type === 'toe') { q = qMul(qFromTo(UP, [Math.cos(dir) * s1, -c1, Math.sin(dir) * s1]), qAxis(UP, spin)); keep = [0, -0.35, 0]; }
      else {
        const hs = s1 * 0.6;
        q = qMul(qFromTo([1, 0, 0], [Math.cos(dir) * hs, Math.sqrt(1 - hs * hs), Math.sin(dir) * hs]), qAxis([1, 0, 0], spin));
        keep = [0.095, 0.27, 0];
      }
      const k = qRot(q, keep), pose = { p: [x - k[0], terrainY(x, z) - 0.012 - k[1], z - k[2]], q, s: 1 };
      ctx.pieces[1].push({ p: pose.p, q, s: 1, c: colour(info.kind), inst: [rng(), terrainY(x, z), 0.4 + rng() * 0.55, info.v], g: gndAt(x, z) });
      px.add({ a: [x, terrainY(x, z), z], b: [x, terrainY(x, z) + 0.2, z], r: 0.1 });
      ctx.discs.push([x, z, 0.14]);
      ctx.decals.push({ x, z, dir: [1, 0, 0], len: 0.3, wid: 0.3, str: 0.3 });
      embed(ctx, info.pts.map((p) => xp(pose, p)), x, z, BANK.small);
      ctx.loose.push({ info, pose, mode: 'stuck', lathe: info.kind });
      return true;
    };
    for (let k = 0, got = 0; k < 300 && got < 12; k++) {
      const [x, z] = hullXZ(clamp$9(1.5 + rng.gauss() * 3.5, -4, 8), 2.4 + Math.abs(rng.gauss()) * 2.2);
      if (frag(3 + Math.floor(rng() * 3), x, z)) got++;
    }
    for (const [pis, want] of [[[4, 5], 14], [[3], 6], [[6, 7], 14]]) {
      for (let k = 0, got = 0; k < 400 && got < want; k++) {
        const [x, z] = hullXZ(clamp$9(1.5 + rng.gauss() * 4.2, -9, 10), 2.0 + Math.abs(rng.gauss()) * 3.0);
        if (stick(pis[Math.floor(rng() * pis.length)], x, z)) got++;
      }
    }
    const sherd = (x, z, edge) => {
      if (!clearOf(x, z, 0) || px.nearXZ(x, z, 0.08) || nearRock(x, z)) return;
      const v = Math.floor(rng() * N_SHERD), info = kit.sherdInfo[v], sc = 0.9 + rng() * 0.35, ta = rng() * TAU$8;
      let q, sink;
      if (edge) {
        q = qMul(qAxis(UP, rng() * TAU$8), qAxis([1, 0, 0], Math.PI / 2 + (rng() - 0.5) * 0.7));
        sink = 0.03 + rng() * 0.035;
      } else {
        q = qMul(qAxis(UP, rng() * TAU$8), qAxis([Math.cos(ta), 0, Math.sin(ta)], (rng() - 0.5) * 0.35));
        if (rng() < 0.4) q = qMul(q, qAxis([1, 0, 0], Math.PI));
        sink = 0.002 + rng() * 0.012;
      }
      const pose = layPiece(info.pts, [0, 0, 0], q, x, z, sink, sc);
      ctx.sherds.push({ p: pose.p, q, s: sc, c: colour(info.kind), inst: [rng(), terrainY(x, z), 0.2 + rng() * 0.6, v], g: gndAt(x, z) });
      if (edge) {
        px.add({ a: [x, terrainY(x, z), z], b: [x, terrainY(x, z) + 0.06, z], r: 0.07 });
        embed(ctx, info.pts.map((p) => xp(pose, p)), x, z, BANK.small);
      }
    };
    for (const pl of ctx.placed) {
      if (pl.kind !== 2) continue;
      for (let k = 1 + Math.floor(rng() * 2); k > 0; k--) { const a = rng() * TAU$8, r = 0.3 + rng() * 0.9; sherd(pl.pose.p[0] + Math.cos(a) * r, pl.pose.p[2] + Math.sin(a) * r, rng() < 0.3); }
    }
    for (let k = 0; k < 500 && ctx.sherds.length < 96; k++) {
      const [x, z] = hullXZ(clamp$9(1.5 + rng.gauss() * 4.5, -8, 9), 2.2 + Math.abs(rng.gauss()) * 3.0);
      sherd(x, z, false);
    }
    for (let k = 0, n0 = ctx.sherds.length; k < 500 && ctx.sherds.length < n0 + 44; k++) {
      const [x, z] = hullXZ(clamp$9(1.5 + rng.gauss() * 4.5, -8, 9), 2.0 + Math.abs(rng.gauss()) * 3.4);
      sherd(x, z, true);
    }
    ctx.unclipped = unclipCargo(ctx, kit, this.amphorae);
    for (const pl of ctx.placed) if (pl.pose.p[1] - terrainY(pl.pose.p[0], pl.pose.p[2]) > 0.42) ctx.caps.push({ a: xp(pl.pose, [0, -0.3, 0]), b: xp(pl.pose, [0, 0.35, 0]), r: 0.17 });
  }

  _galley(ctx) {
    const { rng } = ctx;
    const ROCK = [[0.25, 0.23, 0.21], [0.17, 0.17, 0.18], [0.28, 0.21, 0.16], [0.31, 0.29, 0.26], [0.2, 0.22, 0.19]];
    const hp = (s, b) => Math.max(0, 1 - ((s + 10.5) / 2.4) ** 2 - (b / 1.55) ** 2);
    const R0 = hullXZ(-10.5, 0), HG = 0.03, hx0 = R0[0] - 3.2, hz0 = R0[1] - 3.2, hn = Math.ceil(6.4 / HG) + 1;
    const HR = new Float32Array(hn * hn).fill(-1e9);
    const hrAt = (x, z) => { const i = Math.round((x - hx0) / HG), j = Math.round((z - hz0) / HG); return i < 0 || j < 0 || i >= hn || j >= hn ? -1e9 : HR[j * hn + i]; };
    const mGround = (px, pz) => Math.max(supportY(px, pz), moundTop(px, pz), hrAt(px, pz));
    ctx.heapTop = mGround;
    const clusters = [];
    for (let c = 0; c < 10; c++) clusters.push([-10.5 + rng.gauss() * 1.0, rng.gauss() * 0.55, 0.22 + rng() * 0.3]);
    for (let n = 0, got = 0; n < 1600 && got < 190; n++) {
      const cl = clusters[Math.floor(rng() * clusters.length)], s = cl[0] + rng.gauss() * cl[2], b = cl[1] + rng.gauss() * cl[2] * 0.8;
      if (hp(s, b) <= 0.03) continue;
      const [x, z] = hullXZ(s, b), size = clamp$9(Math.exp(Math.log(0.07) + rng.gauss() * 0.4), 0.04, 0.15);
      if (!clearOf(x, z, 0)) continue;
      const st = stoneMB(rng, size, ROCK[Math.floor(rng() * ROCK.length)].map((v) => v * (0.85 + rng() * 0.3)), rng());
      const lift = hrAt(x, z) - moundTop(x, z);
      if (lift > 0.1) continue;
      const onStone = lift > -0.02;
      const pose = layPiece(sparsePts(st, 2), [0, 0, 0], qMul(qAxis(UP, rng() * TAU$8), qAxis([1, 0, 0], (rng() - 0.5) * 0.9)), x, z, size * (onStone ? 0.35 + 0.15 * rng() : 0.5 + 0.25 * rng()), 1, mGround);
      ctx.misc.append(st, pose, floorAttrM);
      for (let v = 0; v < st.count; v += 2) {
        const w = xp(pose, [st.P[v * 3], st.P[v * 3 + 1], st.P[v * 3 + 2]]), i = Math.round((w[0] - hx0) / HG), j = Math.round((w[2] - hz0) / HG);
        for (let di = -1; di <= 1; di++) {
          for (let dj = -1; dj <= 1; dj++) {
            const ii = i + di, jj = j + dj;
            if (ii >= 0 && jj >= 0 && ii < hn && jj < hn && w[1] > HR[jj * hn + ii]) HR[jj * hn + ii] = w[1];
          }
        }
      }
      got++;
    }
    {
      const [x, z] = hullXZ(-10.5, 0);
      ctx.decals.push({ x, z, dir: HA, len: 4.4, wid: 3.0, str: 0.5 });
      ctx.px.add({ a: hullPt(-12.2, 0, 0.15), b: hullPt(-8.8, 0, 0.15), r: 1.1 });
      ctx.discs.push([x, z, 1.7]);
    }
    const at = (s, b, r) => this._spot(ctx, ...hullXZ(s + (rng() - 0.5) * 0.3, b + (rng() - 0.5) * 0.3), r);
    for (const [s, b, kind, broken] of [[-14.6, 0.5, 2, false], [-15.3, -0.4, 3, false], [-13.7, 0.8, 2, true], [-13.5, 0.55, 2, true], [-15.8, 0.35, 3, true]]) {
      const p = at(s, b, 0.12);
      if (p) this._plate(ctx, p[0], p[1], kind, broken);
    }
    const lp = at(-15, 0.1, 0.07);
    if (lp) this._lamp(ctx, lp[0], lp[1]);
    const purse = at(-14.2, -0.35, 0.05);
    if (purse) {
      for (let k = 0; k < 38; k++) {
        const a = rng() * TAU$8, r = Math.sqrt(rng()) * 0.32, x = purse[0] + Math.cos(a) * r, z = purse[1] + Math.sin(a) * r;
        if (this._free(ctx, x, z, 0.012)) this._coin(ctx, x, z, rng() < 0.8 ? 0 : 1, { ground: supportY });
      }
      for (let k = 0; k < 3; k++) { const p = at(-14.2 + (rng() - 0.5) * 0.4, -0.35 + (rng() - 0.5) * 0.4, 0.03); if (p) this._stack(ctx, p[0], p[1], supportY); }
    }
    for (const [s, b, c] of [[-15.6, -0.5, 0], [-13.4, -0.6, 1]]) { const p = at(s, b, 0.1); if (p) this._bowl(ctx, p[0], p[1], GLASS_COLOURS[c], supportY); }
  }
  _plate(ctx, x, z, kind, broken) {
    const { rng } = ctx, prof = makeProfile$1(PLATE_OUT), tmp = new MB({ aLoc: 3, aMisc: 4, color: 3 }), sd = rng();
    const col = kind === 2 ? [0.05, 0.05, 0.055] : [0.46, 0.17, 0.1];
    const attr = (p, part) => ({ aLoc: p, aMisc: [kind, sd, part === 3 ? 1 : 0, 0], color: col });
    const ts = prof.adaptive(0.012, 0.12);
    if (!broken) {
      const cols = [];
      for (let j = 0; j < 40; j++) cols.push({ th: (j / 40) * TAU$8, ts });
      wallPiece(tmp, prof, cols, { ring: true, thick: 0.005, yOff: 0, attr, rng, top: 'lip' });
    } else {
      const th0 = rng() * TAU$8, span = 1.5 + rng() * 1.2, thL = ts.map(() => th0 + (rng() - 0.5) * 0.25), thR = ts.map(() => th0 + span + (rng() - 0.5) * 0.25), cols = [];
      for (let j = 0; j <= 14; j++) cols.push({ th: ts.map((t, k) => lerp$4(thL[k], thR[k], j / 14)), ts });
      wallPiece(tmp, prof, cols, { thick: 0.005, yOff: 0, attr, rng, top: 'lip', sides: true });
    }
    let q = qMul(qAxis(UP, rng() * TAU$8), qAxis([1, 0, 0], (rng() - 0.5) * 0.12));
    if (rng() < 0.2) q = qMul(q, qAxis([1, 0, 0], Math.PI));
    ctx.misc.append(tmp, layPiece(sparsePts(tmp, 2), [0, 0.018, 0], q, x, z, 0.004, 1, supportY), floorAttr);
    ctx.discs.push([x, z, 0.13]);
    ctx.decals.push({ x, z, dir: [1, 0, 0], len: 0.3, wid: 0.3, str: 0.35 });
  }
  _lamp(ctx, x, z) {
    const g = surfaceNets$2(lampSDF, [-0.06, -0.025, -0.042], [0.078, 0.03, 0.042], 0.0022), sd = ctx.rng();
    const tmp = new MB({ aLoc: 3, aMisc: 4, color: 3 }), P = g.attributes.position.array, N = g.attributes.normal.array;
    for (let i = 0; i < P.length / 3; i++) {
      const p = [P[i * 3], P[i * 3 + 1], P[i * 3 + 2]];
      tmp.v(p, [N[i * 3], N[i * 3 + 1], N[i * 3 + 2]], { aLoc: p, aMisc: [4, sd, 0, 0], color: [0.055, 0.05, 0.045] });
    }
    tmp.I = Array.from(g.index.array);
    const q = qMul(qAxis(UP, ctx.rng() * TAU$8), qAxis([1, 0, 0], 0.25));
    ctx.misc.append(tmp, layPiece(sparsePts(tmp, 5), [0, 0, 0], q, x, z, 0.008, 1, supportY), floorAttr);
    ctx.discs.push([x, z, 0.08]);
    ctx.decals.push({ x, z, dir: [1, 0, 0], len: 0.2, wid: 0.16, str: 0.35 });
  }
  _coin(ctx, x, z, type, o = {}) {
    const { rng } = ctx, R = [0.0125, 0.0086, 0.0093, 0.0102][type], T = [0.0032, 0.0023, 0.0022, 0.0026][type];
    const tl = o.tilt !== undefined ? o.tilt : 0.3, ax = norm(add(terrainN(x, z), [(rng() - 0.5) * tl, 0, (rng() - 0.5) * tl]));
    const q = qMul(qFromTo(UP, rng() < 0.5 ? ax : mul(ax, -1)), qAxis(UP, rng() * TAU$8));
    const y = (o.ground || terrainY)(x, z) + T * 0.5 - rng() * T * 0.7;
    ctx.coins.push({ p: [x, y, z], q, s: [R, T, R], inst: [type, rng(), type === 2 ? 0 : 0.35 + rng() * 0.6, terrainY(x, z)] });
  }
  _stack(ctx, x, z, ground = terrainY) {
    const { rng } = ctx, n = 5 + Math.floor(rng() * 5), yaw = rng() * TAU$8, lean = 0.5 + rng() * 0.9, R = 0.0125, T = 0.0032;
    const ax = norm([Math.cos(yaw) * Math.sin(lean), Math.cos(lean), Math.sin(yaw) * Math.sin(lean)]), q0 = qFromTo(UP, ax);
    const base = [x, ground(x, z) + R * Math.sin(lean) * 0.8 + T * 0.5 * Math.cos(lean) - 0.002, z];
    for (let k = 0; k < n; k++) {
      ctx.coins.push({ p: add(mad(base, ax, k * T * 1.02), [(rng() - 0.5) * 0.002, 0, (rng() - 0.5) * 0.002]), q: qMul(q0, qAxis(UP, rng() * TAU$8)), s: [R, T, R], inst: [0, rng(), 0.85 + rng() * 0.15, terrainY(x, z)] });
    }
  }
  _bowl(ctx, x, z, colour, ground = terrainY) {
    const { rng } = ctx, r = rng();
    let ax, fill = -1;
    if (r < 0.62) { ax = norm(add(terrainN(x, z), [(rng() - 0.5) * 0.4, 0, (rng() - 0.5) * 0.4])); fill = 0.006 + rng() * 0.02; }
    else if (r < 0.8) ax = norm([(rng() - 0.5) * 0.3, -1, (rng() - 0.5) * 0.3]);
    else { const a = rng() * TAU$8; ax = norm([Math.cos(a), 0.35, Math.sin(a)]); fill = 0.004; }
    const q = qMul(qFromTo(UP, ax), qAxis(UP, rng() * TAU$8));
    const pose = layPiece(bowlPts(), [0, 0.03, 0], q, x, z, 0.004 + rng() * 0.012, 1, ground);
    ctx.glass.push({ p: pose.p, q, s: 1, c: colour, inst: [rng(), fill, terrainY(x, z), 0] });
    ctx.discs.push([x, z, 0.1]);
  }

  _statues(ctx) {
    const { rng } = ctx;
    const bank = (mb, v0, cx, cz, o) => {
      const pts = [];
      for (let i = v0; i < mb.count; i += 5) pts.push([mb.P[i * 3], mb.P[i * 3 + 1], mb.P[i * 3 + 2]]);
      embed(ctx, pts, cx, cz, o);
    };
    const arm = armSDF(), to = norm([LAYOUT.wreck.x - LAYOUT.arm.x, 0, LAYOUT.wreck.z - LAYOUT.arm.z]);
    const yawA = Math.atan2(to[2], to[0]) + 2.2, el = 0.08;
    const Ta = [Math.cos(yawA) * Math.cos(el), Math.sin(el), Math.sin(yawA) * Math.cos(el)];
    const q1 = qFromTo(norm(sub(arm.W, arm.S)), Ta);
    let qa = q1;
    {
      const dW = norm(sub(arm.W, arm.E)), sW = norm(cross(dW, [0, 0, 1])), nW = qRot(q1, cross(sW, dW));
      const dn = norm(sub([0, -1, 0], mul(Ta, -Ta[1]))), np = norm(sub(nW, mul(Ta, dot(nW, Ta))));
      const r = Math.atan2(dot(cross(np, dn), Ta), dot(np, dn)) + (rng() - 0.5) * 0.5;
      qa = qMul(qAxis(Ta, r), q1);
    }
    let v0 = ctx.bronze.count;
    const xa = addSculpt(ctx.bronze, arm.sdf, arm.min, arm.max, arm.step, qa, 1.35, LAYOUT.arm.x, LAYOUT.arm.z, 0.11, 0.21);
    bank(ctx.bronze, v0, LAYOUT.arm.x, LAYOUT.arm.z, BANK.statue);
    ctx.lap('arm');
    const hand = mad(arm.W, norm(sub(arm.W, arm.E)), 0.14);
    for (const [a, b, r] of [[arm.S, arm.E, 0.11], [arm.E, arm.W, 0.09], [arm.W, hand, 0.07]]) ctx.caps.push({ a: xp(xa, a), b: xp(xa, b), r });
    const am = xp(xa, arm.E), a0 = xp(xa, arm.S), a1 = xp(xa, hand), amid = lerp3(a0, a1, 0.5);
    this.obstacles.push({ x: am[0], y: am[1], z: am[2], r: 0.3 });
    ctx.px.add({ a: a0, b: a1, r: 0.14 });
    ctx.decals.push({ x: amid[0], z: amid[2], dir: [Ta[0], 0, Ta[2]], len: Math.hypot(a1[0] - a0[0], a1[2] - a0[2]) + 0.45, wid: 0.5, str: 0.5 });
    const hx = LAYOUT.torso.x - 1.35, hz = LAYOUT.torso.z + 1.1, look = norm([LAYOUT.torso.x - hx, 0, LAYOUT.torso.z - hz]);
    const F = norm(add(mul(look, 0.7), [0, 0.72, 0])), X0 = norm(add([0, -1, 0], mul(F, F[1]))), Y0 = cross(F, X0), rl = 0.35;
    const X = add(mul(X0, Math.cos(rl)), mul(Y0, Math.sin(rl))), qh = qBasis(X, cross(F, X), F);
    v0 = ctx.bronze.count;
    const xh = addSculpt(ctx.bronze, headSDF, [-0.13, -0.215, -0.15], [0.13, 0.165, 0.155], 0.005, qh, 1.2, hx, hz, 0.15, 0.53);
    bank(ctx.bronze, v0, hx, hz, BANK.statue);
    ctx.lap('head');
    ctx.caps.push({ a: xp(xh, [0, -0.1, 0.02]), b: xp(xh, [0, 0.08, 0]), r: 0.14 });
    this.obstacles.push({ x: xh.p[0], y: xh.p[1], z: xh.p[2], r: 0.2 });
    ctx.decals.push({ x: hx, z: hz, dir: look, len: 0.6, wid: 0.5, str: 0.55 });
    ctx.discs.push([hx, hz, 0.3]);
    const kl = klineLeg(0.77), bx = LAYOUT.torso.x + 1.45, bz = LAYOUT.torso.z - 1.0, yaw = rng() * TAU$8;
    const qk = qMul(qAxis(UP, yaw), qAxis([0, 0, 1], Math.PI / 2 + 0.08)), xk = layPiece(sparsePts(kl, 3), [0, 0.186, 0], qk, bx, bz, 0.045);
    v0 = ctx.bronze.count;
    ctx.bronze.append(kl, xk, floorAttr);
    bank(ctx.bronze, v0, bx, bz, BANK.small);
    ctx.caps.push({ a: xp(xk, [0, 0, 0]), b: xp(xk, [0, 0.37, 0]), r: 0.05 });
    ctx.decals.push({ x: bx, z: bz, dir: [Math.cos(yaw), 0, -Math.sin(yaw)], len: 0.5, wid: 0.2, str: 0.45 });
    ctx.discs.push([bx, bz, 0.25]);
    const D = [Math.sin(0.7), 0, Math.cos(0.7)], side = norm(cross(D, UP)), C = norm(add(mul(UP, Math.cos(0.95)), mul(side, Math.sin(0.95))));
    v0 = ctx.marble.count;
    const xt = addSculpt(ctx.marble, torsoSDF, [-0.3, -0.34, -0.2], [0.3, 0.62, 0.2], 0.0085, qBasis(cross(D, C), D, C), 1.3, LAYOUT.torso.x, LAYOUT.torso.z, 0.25, 0);
    bank(ctx.marble, v0, LAYOUT.torso.x, LAYOUT.torso.z, BANK.statue);
    ctx.lap('torso');
    ctx.caps.push({ a: xp(xt, [0, -0.25, 0]), b: xp(xt, [0, 0.5, 0]), r: 0.25 });
    for (const yy of [-0.1, 0.35]) { const p = xp(xt, [0, yy, 0]); this.obstacles.push({ x: p[0], y: p[1], z: p[2], r: 0.3 }); }
    ctx.decals.push({ x: LAYOUT.torso.x, z: LAYOUT.torso.z, dir: D, len: 1.35, wid: 0.8, str: 0.55 });
    ctx.discs.push([LAYOUT.torso.x, LAYOUT.torso.z, 0.7]);
    const piece = (mb, sdf, min, max, step, q, x, z, bury, sd, o, r) => {
      const v1 = mb.count, xf = addSculpt(mb, sdf, min, max, step, q, 1, x, z, bury, sd);
      bank(mb, v1, x, z, o);
      ctx.decals.push({ x, z, dir: [1, 0, 0], len: r * 2.2, wid: r * 2, str: 0.45 });
      ctx.discs.push([x, z, r]);
      ctx.px.add({ a: [x, terrainY(x, z), z], b: [x, terrainY(x, z) + 0.1, z], r });
      return xf;
    };
    piece(ctx.bronze, footSDF, [-0.07, -0.012, -0.13], [0.07, 0.2, 0.16], 0.0055, qMul(qAxis(UP, rng() * TAU$8), qAxis([0, 0, 1], 1.4)), LAYOUT.arm.x + 1.25, LAYOUT.arm.z + 0.75, 0.04, 0.37, BANK.statue, 0.2);
    piece(ctx.bronze, drapeSDF, [-0.21, -0.05, -0.16], [0.21, 0.05, 0.16], 0.0055, qMul(qAxis(UP, rng() * TAU$8), qAxis([1, 0, 0], 0.18)), LAYOUT.arm.x - 0.9, LAYOUT.arm.z + 1.1, 0.03, 0.61, BANK.small, 0.2);
    {
      const x = LAYOUT.torso.x + 1.3, z = LAYOUT.torso.z + 0.8;
      const xf = piece(ctx.marble, plinthSDF, [-0.22, -0.07, -0.1], [0.22, 0.12, 0.15], 0.006, qMul(qAxis(UP, rng() * TAU$8), qAxis([1, 0, 0], 0.3)), x, z, 0.11, 0, BANK.statue, 0.28);
      ctx.caps.push({ a: xp(xf, [-0.15, 0.02, 0.02]), b: xp(xf, [0.15, 0.02, 0.02]), r: 0.1 });
    }
    piece(ctx.marble, forearmSDF, [-0.06, -0.06, -0.14], [0.06, 0.06, 0.2], 0.005, qMul(qAxis(UP, rng() * TAU$8), qAxis([0, 0, 1], (rng() - 0.5) * 0.4)), LAYOUT.torso.x - 1.3, LAYOUT.torso.z - 1.2, 0.06, 0, BANK.statue, 0.16);
    ctx.lap('pieces');
  }

  _finds(ctx) {
    const { rng } = ctx;
    const off = (s, b, js = 1.2, jb = 0.5) => hullXZ(s + (rng() - 0.5) * js, b + (rng() - 0.5) * jb);
    const as = this._spot(ctx, ...off(13.3, 1.9, 0.8, 0.4), 0.7);
    if (as && clearOf(as[0], as[1], 1.0)) anchorStock(ctx, as[0], as[1], rng() * TAU$8, 0.2, 0.07);
    const LD = LAYOUT.landing, toLand = (x, z, yaw, len) => {
      const dx = Math.cos(yaw), dz = Math.sin(yaw), t = clamp$9((LD.x - x) * dx + (LD.z - z) * dz, -len / 2, len / 2);
      return Math.hypot(LD.x - x - dx * t, LD.z - z - dz * t);
    };
    [[-8.4, -3.5, 0.3, 2.6], [-15.2, -3.1, 1.9, 1.9], [6.2, -3.2, 0.9, 1.6]].forEach(([s, b, yaw, len], i) => {
      const [x0, z0] = hullXZ(s, b), y0 = LAYOUT.hull.rot + yaw, dy = (rng() - 0.5) * 0.5, d0 = toLand(x0, z0, y0, len);
      const fits = (x, z, y) => clearOf(x, z, len * 0.5 + 0.2) && this._free(ctx, x, z, 0.3) && toLand(x, z, y, len) >= Math.min(d0, 1.5) - 1e-6;
      let [x, z] = off(s, b, 1.4, 0.5), y = y0 + dy;
      if (!fits(x, z, y)) { x = x0; z = z0; y = y0; }
      if (fits(x, z, y)) loosePlank(ctx, x, z, y, len, 90 + i);
    });
    let lf = off(-17.8, 3.5, 1.0, 0.6);
    if (!clearOf(lf[0], lf[1], 1.4)) lf = hullXZ(-17.8, 3.5);
    if (clearOf(lf[0], lf[1], 1.4)) looseFrame(ctx, lf[0] - 0.7, lf[1] - 0.3, rng() * TAU$8);
    const ls = this._spot(ctx, ...off(-6.2, -3.4, 1.0, 0.5), 0.45);
    if (ls && clearOf(ls[0], ls[1], 0.5)) leadSheet(ctx, ls[0], ls[1], rng() * TAU$8);
    for (let k = 0; k < 70; k++) {
      const [x, z] = hullXZ(1.5 + (rng() - 0.5) * 10, 2.2 + rng() * 4.0);
      if (this._free(ctx, x, z, 0.015)) this._coin(ctx, x, z, rng() < 0.7 ? 0 : rng() < 0.5 ? 1 : 3);
    }
    for (let k = 0; k < 4; k++) { const [x, z] = hullXZ(1.5 + (rng() - 0.5) * 8, 2.4 + rng() * 3); const p = this._spot(ctx, x, z, 0.03); if (p) this._stack(ctx, p[0], p[1]); }
    for (let k = 0; k < 14; k++) {
      const a = rng() * TAU$8, r = 0.5 + rng() * 1.6, x = LAYOUT.torso.x + Math.cos(a) * r, z = LAYOUT.torso.z + Math.sin(a) * r;
      if (this._free(ctx, x, z, 0.015)) this._coin(ctx, x, z, rng() < 0.6 ? 2 : 0);
    }
    let g = 2;
    for (const [s, b] of [[0.8, 3.4], [-2.3, 4.0], [3.8, 2.8], [-0.4, 5.4], [5.2, 3.0]]) {
      const p = this._spot(ctx, ...off(s, b, 1.0, 0.8), 0.1);
      if (p) this._bowl(ctx, p[0], p[1], GLASS_COLOURS[g++ % GLASS_COLOURS.length]);
    }
    const hb = this._spot(ctx, LAYOUT.torso.x - 0.6 + (rng() - 0.5) * 0.6, LAYOUT.torso.z + 1.9 + (rng() - 0.5) * 0.6, 0.1);
    if (hb) this._bowl(ctx, hb[0], hb[1], GLASS_COLOURS[0]);
  }

  _embedded(ctx) {
    const { rng, px } = ctx;
    const onSand = (x, z) => supportY(x, z) - terrainY(x, z) < 0.02;
    const ROCK = [[0.25, 0.23, 0.21], [0.17, 0.17, 0.18], [0.28, 0.21, 0.16], [0.31, 0.29, 0.26], [0.2, 0.22, 0.19]];
    for (let n = 0, got = 0; n < 400 && got < 34; n++) {
      const s = -10.5 + rng.gauss() * 3.4, b = rng.gauss() * 1.4 + (rng() < 0.45 ? 2.4 : 0), [x, z] = hullXZ(s, b), size = clamp$9(Math.exp(Math.log(0.065) + rng.gauss() * 0.4), 0.04, 0.14);
      if (!clearOf(x, z, 0.2) || pathDist(x, z) < 0.8 || !this._free(ctx, x, z, size)) continue;
      const st = stoneMB(rng, size, ROCK[Math.floor(rng() * ROCK.length)].map((v) => v * (0.85 + rng() * 0.3)), rng());
      const pose = layPiece(sparsePts(st, 2), [0, 0, 0], qMul(qAxis(UP, rng() * TAU$8), qAxis([1, 0, 0], (rng() - 0.5) * 0.8)), x, z, size * (0.42 + rng() * 0.3), 1, groundM);
      ctx.misc.append(st, pose, floorAttrM);
      px.add({ a: [x, terrainY(x, z), z], b: [x, terrainY(x, z) + size, z], r: size * 0.8 });
      if (size > 0.08 && onSand(x, z)) embed(ctx, sparsePts(st, 3).map((p) => xp(pose, p)), x, z, BANK.stone);
      got++;
    }
    for (const [s, b, kind] of [[-6.8, 2.7, 1], [-3.3, 3.5, 4], [4.8, 3.9, 1], [7.2, 2.6, 4], [-12.4, 2.6, 1], [-15.6, -2.9, 4], [9.6, -2.4, 1], [-8.8, 3.7, 4], [1.2, 5.7, 1], [-18.6, 1.8, 1]]) {
      const [x, z] = hullXZ(s + (rng() - 0.5) * 1.0, b + (rng() - 0.5) * 0.6);
      if (!clearOf(x, z, 0.5) || pathDist(x, z) < 1.2 || px.nearXZ(x, z, 0.25) || !onSand(x, z)) continue;
      timberStub(ctx, x, z, rng() * TAU$8, 0.35 + rng() * 0.75, 0.22 + rng() * 0.45, kind === 1 ? 0.15 : 0.22, kind === 1 ? 0.14 : 0.06, kind);
    }
    {
      let [x, z] = hullXZ(-19.4 + (rng() - 0.5) * 1.0, -3.6 + (rng() - 0.5) * 0.6);
      if (!(clearOf(x, z, 1.0) && this._free(ctx, x, z, 0.6))) [x, z] = hullXZ(-19.4, -3.6);
      if (clearOf(x, z, 1.0) && this._free(ctx, x, z, 0.6)) anchorStock(ctx, x, z, rng() * TAU$8, 0.42, 0.1);
    }
    {
      const p = this._spot(ctx, ...hullXZ(10.4 + (rng() - 0.5) * 1.0, 2.8 + (rng() - 0.5) * 0.5), 0.1);
      if (p) {
        const mb = turnedMB(SOUNDING, 24, [0.42, 0.44, 0.47], 5, rng()), q = qMul(qAxis(UP, rng() * TAU$8), qAxis([0, 0, 1], Math.PI / 2 - 0.25));
        const pose = layPiece(sparsePts(mb, 2), [0, 0.06, 0], q, p[0], p[1], 0.03);
        ctx.misc.append(mb, pose, floorAttr);
        embed(ctx, sparsePts(mb, 2).map((v) => xp(pose, v)), p[0], p[1], BANK.small);
        ctx.discs.push([p[0], p[1], 0.12]);
        ctx.decals.push({ x: p[0], z: p[1], dir: [1, 0, 0], len: 0.3, wid: 0.22, str: 0.4 });
      }
    }
    for (const [s, b] of [[-14.8, 1.9], [-16.2, -1.2], [-13.1, 2.6]]) {
      const p = this._spot(ctx, ...hullXZ(s + (rng() - 0.5) * 0.6, b + (rng() - 0.5) * 0.4), 0.08);
      if (!p) continue;
      const mb = turnedMB(UNGUENT, 18, [0.56, 0.33, 0.2].map((v) => v * (0.9 + rng() * 0.2)), 3, rng());
      const q = qMul(qAxis(UP, rng() * TAU$8), qAxis([0, 0, 1], Math.PI / 2 + (rng() - 0.5) * 0.5));
      const pose = layPiece(sparsePts(mb, 2), [0, 0.07, 0], q, p[0], p[1], 0.012 + rng() * 0.012, 1, supportY);
      ctx.misc.append(mb, pose, floorAttr);
      if (onSand(p[0], p[1])) embed(ctx, sparsePts(mb, 2).map((v) => xp(pose, v)), p[0], p[1], BANK.small);
      ctx.discs.push([p[0], p[1], 0.1]);
    }
  }

  _life(ctx) {
    const { rng, life: M } = ctx;
    const hosts = ctx.placed.filter((a) => !a.upright && a.kind !== 2 && a.growth > 0.5 && a.lift < 0.05);
    for (let i = hosts.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [hosts[i], hosts[j]] = [hosts[j], hosts[i]]; }
    const spot = (a, y) => {
      const upL = qRot(qConj(a.pose.q), UP), rad = norm([upL[0], 0, upL[2]]), r = y > 0.1 ? 0.12 : a.R * 0.98;
      return { p: xp(a.pose, [rad[0] * r, y, rad[2] * r]), n: qRot(a.pose.q, rad) };
    };
    let i = 0;
    for (const [fn, count, y] of [[tubeSponge, 9, 0.02], [axinella, 4, 0.02], [seaSquirt, 7, -0.05], [protula, 7, 0.15], [anemone, 5, 0.13]]) {
      for (let k = 0; k < count && i < hosts.length; k++, i++) { const s = spot(hosts[i], y); fn(M, s.p, s.n, rng); }
    }
    ctx.hosts = hosts.slice(i);
    ctx.tops.forEach((t, k) => {
      if (k % 3 === 0) sabella(M, t.p, t.n, rng);
      else if (k % 3 === 1) protula(M, t.p, t.n, rng);
      else if (k % 6 === 2) axinella(M, t.p, t.n, rng);
    });
  }

  _sponges(ctx) {
    const rng = varyRng(5101), S = ctx.sponge, used = [], W0 = [LAYOUT.wreck.x, LAYOUT.wreck.z];
    const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
    const free = (x, z, r) => used.every(([a, b, rr]) => Math.hypot(x - a, z - b) > r + rr);
    const ok = (x, z, r) => clearOf(x, z, 0.3) && pathDist(x, z) > 0.9 && free(x, z, r);
    const BATH = [[0.2, 0.17, 0.14], [0.27, 0.22, 0.17], [0.23, 0.22, 0.21], [0.3, 0.23, 0.16]];
    const HORSE = [[0.27, 0.2, 0.13], [0.22, 0.16, 0.11], [0.3, 0.21, 0.13]];
    const CRUST = [[0.62, 0.3, 0.1], [0.56, 0.18, 0.1], [0.62, 0.5, 0.16], [0.64, 0.38, 0.12]];
    const vary = (c, a, b) => { const k = a + rng() * (b - a); return [c[0] * k, c[1] * k, c[2] * k]; };
    const count = { timber: 0, ballast: 0, vessel: 0, rock: 0, kidney: 0, boulder: 0, crust: 0, tube: 0 };
    const bath = (p, n, R) => {
      const t = rng() < 0.6 ? 0 : 1, pal = t ? HORSE : BATH;
      bathSponge(S, p, n, R * (t ? 1.15 : 1), t, vary(pal[Math.floor(rng() * pal.length)], 0.85, 1.15), rng);
      used.push([p[0], p[2], R * 1.2]);
      SITE.sponges.push([p[0], p[1], p[2], R, t]);
    };
    const kidney = (p, n, R) => { bathSponge(S, p, n, R, 2, vary([0.34, 0.3, 0.26], 0.85, 1.2), rng); used.push([p[0], p[2], R]); };
    const crust = (p, n, R) => { crustSponge(S, p, n, R, vary(CRUST[Math.floor(rng() * CRUST.length)], 0.85, 1.1), rng); used.push([p[0], p[2], R * 0.8]); count.crust++; };
    const perch = shuffle(ctx.caps.filter((c) => { if (!c.sup) return false; const l = Math.hypot(...sub(c.b, c.a)); return l > 0.6 && Math.abs(c.b[1] - c.a[1]) < 0.5 * l; }));
    for (const c of perch) {
      if (count.timber >= 9 && count.crust >= 5) break;
      const a = lerp3(c.a, c.b, 0.15 + rng() * 0.7), p = [a[0], a[1] + c.r * 0.9, a[2]], R = 0.065 + rng() * 0.065;
      if (!ok(p[0], p[2], R)) continue;
      if (count.timber < 9 && rng() < 0.75) { bath(mad(p, UP, -0.01), UP, R); count.timber++; }
      else if (count.crust < 5) crust(p, UP, R * 1.3);
    }
    ctx.tops.forEach((tp, k) => {
      if (k % 6 !== 5 || tp.n[1] < 0.55 || !ok(tp.p[0], tp.p[2], 0.06)) return;
      bath(mad(tp.p, tp.n, -0.02), norm(tp.n), 0.05 + rng() * 0.035);
      count.timber++;
    });
    for (const [s, b] of [[-10.2, 0.3], [-11.1, -0.45], [-9.6, -0.2]]) {
      const [x, z] = hullXZ(s, b), y = ctx.heapTop ? ctx.heapTop(x, z) : supportY(x, z) + 0.42 * Math.max(0, 1 - ((s + 10.5) / 1.9) ** 2 - (b / 1.25) ** 2);
      if (ok(x, z, 0.08)) { bath([x, y - 0.012, z], UP, 0.07 + rng() * 0.04); count.ballast++; }
    }
    for (const a of shuffle((ctx.hosts || []).slice())) {
      if (count.vessel >= 4) break;
      const upL = qRot(qConj(a.pose.q), UP), rad = norm([upL[0], 0, upL[2]]);
      const p = xp(a.pose, [rad[0] * a.R * 0.9, -0.02, rad[2] * a.R * 0.9]), n = qRot(a.pose.q, rad);
      if (n[1] < 0.7 || !ok(p[0], p[2], 0.07)) continue;
      bath(p, n, 0.05 + rng() * 0.03);
      count.vessel++;
    }
    const tops = shuffle(HARD.tops.slice()), centres = [];
    for (const t0 of tops) {
      if (centres.length >= 8) break;
      if (Math.hypot(t0.x - W0[0], t0.z - W0[1]) > 34 || centres.some((c) => Math.hypot(c[0] - t0.x, c[1] - t0.z) < 3.5)) continue;
      centres.push([t0.x, t0.z]);
      const near = tops.filter((e) => Math.hypot(e.x - t0.x, e.z - t0.z) < 0.9 && Math.abs(e.y - t0.y) < 0.35);
      for (let m = 0, got = 0, want = 2 + Math.floor(rng() * 3); m < near.length * 2 && got < want; m++) {
        const e = near[Math.floor(rng() * near.length)], R = 0.08 + rng() * 0.085;
        if (!free(e.x, e.z, R)) continue;
        const n = norm([e.nx * 0.4, e.ny * 0.4 + 0.6, e.nz * 0.4]);
        if (rng() < 0.18) { kidney([e.x, e.y - 0.015, e.z], n, R * 0.9); count.kidney++; } else { bath([e.x, e.y - 0.015, e.z], n, R); count.rock++; }
        got++;
      }
    }
    for (const e of shuffle(HARD.sides.slice())) {
      if (count.crust >= 20) break;
      if (Math.hypot(e.x - W0[0], e.z - W0[1]) > 32 || !free(e.x, e.z, 0.12)) continue;
      crust([e.x, e.y, e.z], [e.nx, e.ny, e.nz], 0.05 + rng() * 0.06);
    }
    const doneB = new Set();
    for (const e of shuffle(HARD.boulderTops.slice())) {
      if (count.boulder >= 8) break;
      if (doneB.has(e.b) || e.ny < 0.8 || !free(e.x, e.z, 0.2)) continue;
      doneB.add(e.b);
      const R = Math.min(0.07 + rng() * 0.09, e.s * 0.25);
      if (rng() < 0.8) bath([e.x, e.y - 0.012, e.z], norm([e.nx * 0.5, e.ny * 0.5 + 0.5, e.nz * 0.5]), R);
      else crust([e.x, e.y, e.z], [e.nx, e.ny, e.nz], R * 1.2);
      count.boulder++;
    }
    for (const c of perch) {
      if (count.tube >= 4) break;
      const a = lerp3(c.a, c.b, 0.1 + rng() * 0.8), p = [a[0], a[1] + c.r * 0.92, a[2]];
      if (!ok(p[0], p[2], 0.05)) continue;
      tubeSponge(ctx.life, p, UP, rng);
      used.push([p[0], p[2], 0.05]);
      count.tube++;
    }
    ctx.spongeCount = count;
  }

  _shelters(ctx) {
    const out = [];
    for (const c of ctx.caps) {
      if (!c.sup) continue;
      const d = sub(c.b, c.a), l = Math.hypot(...d);
      if (l < 1 || Math.abs(d[1]) > 0.6 * l) continue;
      const side = norm([-d[2], 0, d[0]]);
      for (let t = 0.2; t <= 0.81; t += 0.1) {
        const a = lerp3(c.a, c.b, t), [hs, hb] = toHull(a[0], a[2]);
        const g = Math.max(supportY(a[0], a[2]), terrainY(a[0], a[2]) + moundAt(hs, hb, a[0], a[2])), under = a[1] - c.r - g;
        if (under < 0.55 || under > 1.6 || !clearOf(a[0], a[2], 1.0) || pathDist(a[0], a[2]) < 1.0) continue;
        const open = (sd) => [0.6, 1.2, 1.8].filter((r) => !ctx.px.nearXZ(a[0] + side[0] * sd * r, a[2] + side[2] * sd * r, 0.15)).length;
        const sd = open(1) >= open(-1) ? 1 : -1;
        out.push({ x: a[0], y: g + clamp$9(under * 0.42, 0.3, 0.55), z: a[2], ox: side[0] * sd, oz: side[2] * sd, under, score: -Math.abs(under - 0.85) });
      }
    }
    out.sort((p, q) => q.score - p.score);
    for (const s of out) if (SITE.shelters.length < 4 && SITE.shelters.every((o) => Math.hypot(o.x - s.x, o.z - s.z) > 4)) SITE.shelters.push(s);
  }

  _build(ctx, kit) {
    const M = makeMaterials(), G = this.group;
    const put = (m, order) => { if (order) m.renderOrder = order; G.add(m); return m; };
    const mesh = (mb, mat, cast) => { const m = new THREE.Mesh(mb.geometry(), mat); m.castShadow = cast; m.receiveShadow = true; return put(m); };
    const castOnly = new THREE.ShaderMaterial({
      vertexShader: 'void main() { gl_Position = vec4(0.0, 0.0, 2.0, 1.0); }',
      fragmentShader: 'void main() { gl_FragColor = vec4(0.0); }',
      colorWrite: false, depthWrite: false,
    });
    for (const k of [0, 1]) {
      put(instanced(kit.intact[k].geometry(), M.vessel, ctx.vessels[k], 'aInst', true, false, true));
      put(instanced(amphoraCasterMB(k).geometry(), castOnly, ctx.vessels[k], null, false, true));
    }
    for (const m of instancedKit(kit.pieces[0], kit.pieceRanges[0], M.piece, ctx.pieces[0], 'aInst', true, true, true)) put(m);
    const half = (list) => (LATHE_K < 1 ? list.filter((_, i) => i % 2 === 0) : list);
    for (const m of instancedKit(kit.pieces[1], kit.pieceRanges[1], M.piece, half(ctx.pieces[1]), 'aInst', true, false, true)) put(m);
    for (const m of instancedKit(kit.sherds, kit.sherdRanges, M.piece, half(ctx.sherds), 'aInst', true, false, true)) put(m);
    mesh(ctx.wood, M.wood, true);
    mesh(ctx.misc, M.misc, true);
    mesh(ctx.bronze, M.bronze, true);
    mesh(ctx.marble, M.marble, true);
    BANKF.map = bankField(ctx.embeds);
    const banks = bankMesh(BANKF.map);
    ctx.lap('banks');
    const sed = sedimentMound(banks);
    if (sed) put(sed);
    mesh(ctx.life, M.life, false);
    if (ctx.sponge.count) mesh(ctx.sponge, M.sponge, true);
    put(instanced(coinGeometry(), M.coin, ctx.coins, 'aCoin', false, false));
    put(instanced(bowlGeometry(), M.glass, ctx.glass, 'aGlass', true, false), 2);
    const top = (x, z) => { const t = terrainY(x, z); return Math.max(t, moundY(x, z), t + moundLift(bankH(x, z))); };
    const dP = [], dUV = [], dA = [], dI = [];
    for (const d of ctx.decals) {
      const l = Math.hypot(d.dir[0], d.dir[2]) || 1, ux = d.dir[0] / l, uz = d.dir[2] / l;
      const nu = Math.min(40, Math.max(3, Math.ceil(d.len / 0.14))), nv = Math.min(40, Math.max(3, Math.ceil(d.wid / 0.14))), v0 = dP.length / 3;
      for (let j = 0; j <= nv; j++) {
        for (let i = 0; i <= nu; i++) {
          const u = i / nu, v = j / nv, lx = (u - 0.5) * d.len, lz = (v - 0.5) * d.wid;
          const x = d.x + ux * lx - uz * lz, z = d.z + uz * lx + ux * lz;
          dP.push(x, top(x, z) + 0.01, z);
          dUV.push(u, v);
          dA.push(d.str, d.type || 0);
        }
      }
      for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const a = v0 + j * (nu + 1) + i, b = a + 1, c = a + nu + 1, e = c + 1; dI.push(a, c, b, b, c, e); }
    }
    const dg = new THREE.BufferGeometry();
    dg.setAttribute('position', new THREE.Float32BufferAttribute(dP, 3));
    dg.setAttribute('uv', new THREE.Float32BufferAttribute(dUV, 2));
    dg.setAttribute('aDec', new THREE.Float32BufferAttribute(dA, 2));
    dg.setIndex(dI);
    dg.computeBoundingSphere();
    const dm = put(new THREE.Mesh(dg, M.decal), 1);
    dm.receiveShadow = false;
    dm.castShadow = false;
    this.stats = {
      vessels: ctx.vessels[0].length + ctx.vessels[1].length, broken: ctx.placed.filter((a) => a.kind === 2).length,
      upright: ctx.placed.filter((a) => a.upright).length, held: ctx.placed.filter((a) => a.lift > 0.015).length,
      pieces: ctx.pieces[0].length + ctx.pieces[1].length, sherds: ctx.sherds.length, coins: ctx.coins.length, glass: ctx.glass.length,
      decals: ctx.decals.length, capsules: ctx.caps.length, embeds: ctx.embeds.length, bankTris: banks.I.length / 3,
      spongeVerts: ctx.sponge.count, sponges: ctx.spongeCount, shelters: SITE.shelters.length, den: SITE.den, unclipped: ctx.unclipped,
      drawCalls: G.children.length + 1, breach: { high: pathCrossings(-2.4), low: pathCrossings(2.6) }, ship: ctx.ship,
    };
  }
}

