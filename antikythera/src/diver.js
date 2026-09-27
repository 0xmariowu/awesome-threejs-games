// diver.js
const DEG = Math.PI / 180;
const TAU = Math.PI * 2;
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
function smin(a, b, k) {
  const h = clamp(0.5 + (0.5 * (b - a)) / k, 0, 1);
  return b + (a - b) * h - k * h * (1 - h);
}
const smax = (a, b, k) => -smin(-a, -b, k);
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hash3(x, y, z, s) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(z | 0, 1440662683) + Math.imul(s | 0, 982451653)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function vnoise3(x, y, z, s = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
  const a = hash3(xi, yi, zi, s), b = hash3(xi + 1, yi, zi, s), c = hash3(xi, yi + 1, zi, s), d = hash3(xi + 1, yi + 1, zi, s);
  const e = hash3(xi, yi, zi + 1, s), f = hash3(xi + 1, yi, zi + 1, s), g = hash3(xi, yi + 1, zi + 1, s), h = hash3(xi + 1, yi + 1, zi + 1, s);
  const k0 = a + (b - a) * u, k1 = c + (d - c) * u, k2 = e + (f - e) * u, k3 = g + (h - g) * u;
  const l0 = k0 + (k1 - k0) * v, l1 = k2 + (k3 - k2) * v;
  return l0 + (l1 - l0) * w;
}

const vadd = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const vsub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const vmul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const vmad = (a, b, s) => [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s];
const vdot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const vcross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const vlen = (a) => Math.hypot(a[0], a[1], a[2]);
const vnorm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const vlerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

function profileTable(knots, n = 64) {
  const m = knots[0].length - 1;
  const tab = new Float32Array((n + 1) * m);
  const K = knots.length;
  for (let s = 0; s <= n; s++) {
    const t = s / n;
    let i = 0;
    while (i < K - 2 && t > knots[i + 1][0]) i++;
    const k0 = knots[Math.max(0, i - 1)], k1 = knots[i], k2 = knots[Math.min(K - 1, i + 1)], k3 = knots[Math.min(K - 1, i + 2)];
    const u = clamp((t - k1[0]) / Math.max(1e-6, k2[0] - k1[0]), 0, 1);
    for (let c = 1; c <= m; c++) {
      const p0 = k0[c], p1 = k1[c], p2 = k2[c], p3 = k3[c];
      tab[s * m + c - 1] = 0.5 * (2 * p1 + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u * u + (-p0 + 3 * p1 - 3 * p2 + p3) * u * u * u);
    }
  }
  return {
    at(t, out) {
      const x = clamp(t, 0, 1) * n;
      const i = Math.min(n - 1, x | 0), f = x - i;
      for (let c = 0; c < m; c++) out[c] = tab[i * m + c] * (1 - f) + tab[(i + 1) * m + c] * f;
      return out;
    },
  };
}

function prim(o, d, bw, bb) {
  return { g: o.g || 0, k: o.k ?? 0.03, sig: o.sig ?? 0.02, trunk: !!o.trunk, sub: !!o.sub, d, bw, bb };
}
const W1 = (bone) => (x, y, z, ob, ow) => { ob[0] = bone; ow[0] = 1; return 1; };
const WMIX = (pairs) => (x, y, z, ob, ow) => {
  for (let i = 0; i < pairs.length; i++) { ob[i] = pairs[i][0]; ow[i] = pairs[i][1]; }
  return pairs.length;
};
function boxOf(pts, r) {
  const bb = [1e9, 1e9, 1e9, -1e9, -1e9, -1e9];
  for (const p of pts) for (let c = 0; c < 3; c++) { bb[c] = Math.min(bb[c], p[c] - r); bb[c + 3] = Math.max(bb[c + 3], p[c] + r); }
  return bb;
}
function sdEll(px, py, pz, rx, ry, rz) {
  const lx = px / rx, ly = py / ry, lz = pz / rz;
  const k0 = Math.sqrt(lx * lx + ly * ly + lz * lz);
  const k1 = Math.sqrt((lx / rx) ** 2 + (ly / ry) ** 2 + (lz / rz) ** 2);
  return k1 > 1e-9 ? (k0 * (k0 - 1)) / k1 : -Math.min(rx, ry, rz);
}
function primEllipsoid(c, r, axes, bw, o = {}) {
  const [ax, ay, az] = axes || [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  return prim(o, (x, y, z) => {
    const px = x - c[0], py = y - c[1], pz = z - c[2];
    return sdEll(px * ax[0] + py * ax[1] + pz * ax[2], px * ay[0] + py * ay[1] + pz * ay[2], px * az[0] + py * az[1] + pz * az[2], r[0], r[1], r[2]);
  }, bw, boxOf([c], Math.max(r[0], r[1], r[2])));
}
function sdCone(x, y, z, a, b, ra, rb) {
  const bax = b[0] - a[0], bay = b[1] - a[1], baz = b[2] - a[2];
  const pax = x - a[0], pay = y - a[1], paz = z - a[2];
  const h = clamp((pax * bax + pay * bay + paz * baz) / (bax * bax + bay * bay + baz * baz), 0, 1);
  return Math.hypot(pax - bax * h, pay - bay * h, paz - baz * h) - (ra + (rb - ra) * h);
}
function primCone(a, b, ra, rb, bw, o = {}) {
  return prim(o, (x, y, z) => sdCone(x, y, z, a, b, ra, rb), bw, boxOf([a, b], Math.max(ra, rb)));
}
function primLimb(A, B, U, Vv, knots, bwT, o = {}, disp = null) {
  const ab = vsub(B, A), L = vlen(ab), W = vmul(ab, 1 / L);
  const u = vnorm(vsub(U, vmul(W, vdot(U, W))));
  let v = vsub(Vv, vmul(W, vdot(Vv, W)));
  v = vnorm(vsub(v, vmul(u, vdot(v, u))));
  const tab = profileTable(knots);
  const tmp = [0, 0, 0, 0];
  let rm = 0;
  for (const k of knots) rm = Math.max(rm, k[1] + Math.abs(k[3]), k[2] + Math.abs(k[4]));
  rm += 0.02;
  const tOf = (x, y, z) => ((x - A[0]) * W[0] + (y - A[1]) * W[1] + (z - A[2]) * W[2]) / L;
  const p = prim(o, (x, y, z) => {
    const px = x - A[0], py = y - A[1], pz = z - A[2];
    const t = (px * W[0] + py * W[1] + pz * W[2]) / L;
    tab.at(t, tmp);
    const a = tmp[0], b = tmp[1];
    const lu = px * u[0] + py * u[1] + pz * u[2] - tmp[2], lv = px * v[0] + py * v[1] + pz * v[2] - tmp[3];
    const qa = lu / a, qb = lv / b;
    const k0 = Math.sqrt(qa * qa + qb * qb), k1 = Math.sqrt((qa / a) ** 2 + (qb / b) ** 2);
    let d = k1 > 1e-9 ? (k0 * (k0 - 1)) / k1 : -Math.min(a, b);
    if (disp) d -= disp(clamp(t, 0, 1), Math.atan2(lv, lu), t * L);
    const ax = t < 0 ? -t * L : t > 1 ? (t - 1) * L : 0;
    if (ax > 0) d = d > 0 ? Math.hypot(d, ax) : Math.max(d, ax);
    return d;
  }, (x, y, z, ob, ow) => bwT(tOf(x, y, z), ob, ow), boxOf([A, B], rm));
  p.tOf = tOf;
  p.frame = { A, W, u, v, L };
  return p;
}
function primTorso(knots, bw, o = {}, disp = null) {
  const y0 = knots[0][0], y1 = knots[knots.length - 1][0], H = y1 - y0;
  const tab = profileTable(knots.map((k) => [(k[0] - y0) / H, k[1], k[2], k[3], k[4], k[5]]));
  const tmp = [0, 0, 0, 0, 0];
  let am = 0, bm = 0;
  for (const k of knots) { am = Math.max(am, k[1]); bm = Math.max(bm, k[2], k[3]); }
  return prim(o, (x, y, z) => {
    const t = (y - y0) / H;
    tab.at(t, tmp);
    const a = tmp[0], n = tmp[3], zz = z - tmp[4];
    const b = zz < 0 ? tmp[1] : tmp[2];
    const X = Math.abs(x) / a, Z = Math.abs(zz) / b;
    let d;
    if (X + Z < 1e-6) d = -Math.min(a, b);
    else {
      const r = Math.pow(Math.pow(X, n) + Math.pow(Z, n), 1 / n);
      const rr = Math.pow(r, 1 - n);
      const gx = (X > 0 ? Math.pow(X, n - 1) : 0) * rr / a;
      const gz = (Z > 0 ? Math.pow(Z, n - 1) : 0) * rr / b;
      d = (r - 1) / Math.max(1e-6, Math.hypot(gx, gz));
    }
    if (disp) d -= disp(x, y, z);
    const ax = t < 0 ? -t * H : t > 1 ? (t - 1) * H : 0;
    if (ax > 0) d = d > 0 ? Math.hypot(d, ax) : Math.max(d, ax);
    return d;
  }, bw, [-am - 0.03, y0, -bm - 0.05, am + 0.03, y1, bm + 0.05]);
}
function primTorus(c, nrm, R, r, bw, o = {}) {
  const n = vnorm(nrm);
  return prim(o, (x, y, z) => {
    const px = x - c[0], py = y - c[1], pz = z - c[2];
    const h = px * n[0] + py * n[1] + pz * n[2];
    return Math.hypot(Math.hypot(px - n[0] * h, py - n[1] * h, pz - n[2] * h) - R, h) - r;
  }, bw, boxOf([c], R + r));
}

function makeField(prims, opts = {}) {
  const O = opts.O || [-0.9, -1.1, -0.5], CELL = 0.06;
  const SZ = opts.S || [1.8, 2.1, 1.0];
  const NX = Math.ceil(SZ[0] / CELL), NY = Math.ceil(SZ[1] / CELL), NZ = Math.ceil(SZ[2] / CELL);
  const tmp = Array.from({ length: NX * NY * NZ }, () => []);
  prims.forEach((p, pi) => {
    const m = p.k + 0.035 + 3 * p.sig;
    const r = (v, o, n) => clamp(Math.floor((v - o) / CELL), 0, n - 1);
    for (let k = r(p.bb[2] - m, O[2], NZ); k <= r(p.bb[5] + m, O[2], NZ); k++)
      for (let j = r(p.bb[1] - m, O[1], NY); j <= r(p.bb[4] + m, O[1], NY); j++)
        for (let i = r(p.bb[0] - m, O[0], NX); i <= r(p.bb[3] + m, O[0], NX); i++) tmp[i + NX * (j + NY * k)].push(pi);
  });
  const lists = tmp.map((l) => Int32Array.from(l.sort((a, b) => (prims[a].sub ? 1 : 0) - (prims[b].sub ? 1 : 0))));
  const cellOf = (x, y, z) => {
    const i = Math.floor((x - O[0]) / CELL), j = Math.floor((y - O[1]) / CELL), k = Math.floor((z - O[2]) / CELL);
    if (i < 0 || j < 0 || k < 0 || i >= NX || j >= NY || k >= NZ) return -1;
    return i + NX * (j + NY * k);
  };
  const dist = new Float32Array(prims.length);
  const ob = new Int32Array(8), ow = new Float32Array(8);
  const gd = new Float64Array(4);
  const disp = opts.disp || [], post = opts.post || null;
  return {
    d(x, y, z, mask = 1, trunk = false) {
      const c = cellOf(x, y, z);
      if (c < 0) return 0.5;
      const l = lists[c];
      gd[0] = gd[1] = gd[2] = gd[3] = 1e3;
      for (let i = 0; i < l.length; i++) {
        const p = prims[l[i]];
        if (!((1 << p.g) & mask) || (trunk && !p.trunk)) continue;
        const di = p.d(x, y, z);
        if (p.sub) gd[p.g] = smax(gd[p.g], -di, p.k);
        else gd[p.g] = smin(gd[p.g], di, p.k);
      }
      let d = 1e3;
      for (let g = 0; g < 4; g++) {
        if (!((1 << g) & mask) || gd[g] >= 100) continue;
        let dg = gd[g];
        if (!trunk && disp[g]) dg -= disp[g](x, y, z);
        if (post) dg = post(g, dg, x, y, z);
        d = d >= 100 ? dg : smin(d, dg, 0.006);
      }
      return d;
    },
    nearest(x, y, z, g) {
      const c = cellOf(x, y, z);
      if (c < 0) return null;
      const l = lists[c];
      let best = null, bd = 1e9;
      for (let i = 0; i < l.length; i++) {
        const p = prims[l[i]];
        if (p.g !== g || p.sub) continue;
        const di = p.d(x, y, z);
        if (di < bd) { bd = di; best = p; }
      }
      return best;
    },
    weights(x, y, z, out, filter) {
      out.fill(0);
      const c = cellOf(x, y, z);
      if (c < 0) return;
      const l = lists[c];
      let dmin = 1e3;
      for (let i = 0; i < l.length; i++) {
        const p = prims[l[i]];
        if (p.sub || (filter && !filter(p))) { dist[i] = 1e3; continue; }
        const di = p.d(x, y, z);
        dist[i] = di;
        if (di < dmin) dmin = di;
      }
      let tot = 0;
      for (let i = 0; i < l.length; i++) {
        if (dist[i] >= 1e3) continue;
        const p = prims[l[i]];
        const a = Math.exp(-Math.max(0, dist[i] - dmin) / p.sig);
        if (a < 2e-3) continue;
        const n = p.bw(x, y, z, ob, ow);
        for (let k = 0; k < n; k++) out[ob[k]] += a * ow[k];
        tot += a;
      }
      if (tot > 0) for (let b = 0; b < out.length; b++) out[b] /= tot;
    },
  };
}

const EDGES = [0, 1, 2, 3, 4, 5, 6, 7, 0, 2, 1, 3, 4, 6, 5, 7, 0, 4, 1, 5, 2, 6, 3, 7];
function surfaceNets(f, b0, b1, h) {
  const nx = Math.ceil((b1[0] - b0[0]) / h) + 1, ny = Math.ceil((b1[1] - b0[1]) / h) + 1, nz = Math.ceil((b1[2] - b0[2]) / h) + 1;
  const vals = new Float32Array(nx * ny * nz);
  const id = (i, j, k) => i + nx * (j + ny * k);
  const C = 4;
  const cx = Math.ceil((nx - 1) / C) + 1, cy = Math.ceil((ny - 1) / C) + 1, cz = Math.ceil((nz - 1) / C) + 1;
  const coarse = new Float32Array(cx * cy * cz);
  for (let k = 0; k < cz; k++) for (let j = 0; j < cy; j++) for (let i = 0; i < cx; i++) {
    coarse[i + cx * (j + cy * k)] = f(b0[0] + Math.min(i * C, nx - 1) * h, b0[1] + Math.min(j * C, ny - 1) * h, b0[2] + Math.min(k * C, nz - 1) * h);
  }
  const thr = 1.15 * C * h;
  const exact = [];
  for (let ck = 0; ck < cz - 1; ck++) for (let cj = 0; cj < cy - 1; cj++) for (let ci = 0; ci < cx - 1; ci++) {
    let mn = 1e9, neg = 0;
    for (let c = 0; c < 8; c++) {
      const v = coarse[(ci + (c & 1)) + cx * ((cj + ((c >> 1) & 1)) + cy * (ck + (c >> 2)))];
      if (v < 0) neg++;
      mn = Math.min(mn, Math.abs(v));
    }
    const i0 = ci * C, j0 = cj * C, k0 = ck * C;
    const i1 = Math.min(i0 + C, nx - 1), j1 = Math.min(j0 + C, ny - 1), k1 = Math.min(k0 + C, nz - 1);
    if (mn > thr && (neg === 0 || neg === 8)) {
      const fv = neg ? -mn : mn;
      for (let k = k0; k <= k1; k++) for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) vals[id(i, j, k)] = fv;
    } else exact.push(i0, j0, k0, i1, j1, k1);
  }
  for (let e = 0; e < exact.length; e += 6) {
    for (let k = exact[e + 2]; k <= exact[e + 5]; k++) {
      const z = b0[2] + k * h;
      for (let j = exact[e + 1]; j <= exact[e + 4]; j++) {
        const y = b0[1] + j * h;
        for (let i = exact[e]; i <= exact[e + 3]; i++) vals[id(i, j, k)] = f(b0[0] + i * h, y, z);
      }
    }
  }
  const cxn = nx - 1, cyn = ny - 1;
  const cellV = new Int32Array((nx - 1) * (ny - 1) * (nz - 1)).fill(-1);
  const P = [];
  const cv = new Float32Array(8);
  for (let k = 0; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    let mask = 0;
    for (let c = 0; c < 8; c++) {
      const v = vals[id(i + (c & 1), j + ((c >> 1) & 1), k + (c >> 2))];
      cv[c] = v;
      if (v < 0) mask |= 1 << c;
    }
    if (mask === 0 || mask === 255) continue;
    let sx = 0, sy = 0, sz = 0, n = 0;
    for (let e = 0; e < 24; e += 2) {
      const a = EDGES[e], b = EDGES[e + 1];
      const va = cv[a], vb = cv[b];
      if ((va < 0) === (vb < 0)) continue;
      const t = va / (va - vb);
      sx += (a & 1) + ((b & 1) - (a & 1)) * t;
      sy += ((a >> 1) & 1) + (((b >> 1) & 1) - ((a >> 1) & 1)) * t;
      sz += (a >> 2) + ((b >> 2) - (a >> 2)) * t;
      n++;
    }
    cellV[i + cxn * (j + cyn * k)] = P.length / 3;
    P.push(b0[0] + (i + sx / n) * h, b0[1] + (j + sy / n) * h, b0[2] + (k + sz / n) * h);
  }
  const I = [];
  const cid = (i, j, k) => cellV[i + cxn * (j + cyn * k)];
  const d2 = (a, b) => (P[a * 3] - P[b * 3]) ** 2 + (P[a * 3 + 1] - P[b * 3 + 1]) ** 2 + (P[a * 3 + 2] - P[b * 3 + 2]) ** 2;
  const quad = (a, b, c, d, flip) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    if (d2(a, c) <= d2(b, d)) { if (flip) I.push(a, c, b, a, d, c); else I.push(a, b, c, a, c, d); }
    else if (flip) I.push(b, d, c, b, a, d); else I.push(b, c, d, b, d, a);
  };
  for (let k = 1; k < nz - 1; k++) for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
    const v0 = vals[id(i, j, k)] < 0;
    if (v0 !== (vals[id(i + 1, j, k)] < 0)) quad(cid(i, j - 1, k - 1), cid(i, j, k - 1), cid(i, j, k), cid(i, j - 1, k), !v0);
    if (v0 !== (vals[id(i, j + 1, k)] < 0)) quad(cid(i - 1, j, k - 1), cid(i, j, k - 1), cid(i, j, k), cid(i - 1, j, k), v0);
    if (v0 !== (vals[id(i, j, k + 1)] < 0)) quad(cid(i - 1, j - 1, k), cid(i, j - 1, k), cid(i, j, k), cid(i - 1, j, k), !v0);
  }
  return { P: Float32Array.from(P), I: Uint32Array.from(I) };
}

function projectVerts(f, P, h, steps = 2) {
  const n = P.length / 3, N = new Float32Array(P.length), e = h * 0.25;
  const grad = (x, y, z, g) => {
    g[0] = (f(x + e, y, z) - f(x - e, y, z)) / (2 * e);
    g[1] = (f(x, y + e, z) - f(x, y - e, z)) / (2 * e);
    g[2] = (f(x, y, z + e) - f(x, y, z - e)) / (2 * e);
  };
  const g = [0, 0, 0];
  for (let i = 0; i < n; i++) {
    let x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2];
    for (let s = 0; s < steps; s++) {
      const d = f(x, y, z);
      grad(x, y, z, g);
      const g2 = g[0] * g[0] + g[1] * g[1] + g[2] * g[2];
      if (g2 > 1e-6) {
        let k = d / g2;
        const step = Math.abs(k) * Math.sqrt(g2);
        if (step > h * 0.6) k *= (h * 0.6) / step;
        x -= g[0] * k; y -= g[1] * k; z -= g[2] * k;
      }
    }
    P[i * 3] = x; P[i * 3 + 1] = y; P[i * 3 + 2] = z;
    grad(x, y, z, g);
    const l = Math.hypot(g[0], g[1], g[2]) || 1;
    N[i * 3] = g[0] / l; N[i * 3 + 1] = g[1] / l; N[i * 3 + 2] = g[2] / l;
  }
  return N;
}

function bakeAO(P, N, f, step, n = 4, gain = 0.9) {
  const nv = P.length / 3, out = new Float32Array(nv);
  for (let i = 0; i < nv; i++) {
    const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2], nx = N[i * 3], ny = N[i * 3 + 1], nz = N[i * 3 + 2];
    let occ = 0, w = 1;
    for (let k = 1; k <= n; k++) { const d = step * k; occ += (w * Math.max(0, d - f(x + nx * d, y + ny * d, z + nz * d))) / d; w *= 0.6; }
    out[i] = clamp(occ * gain, 0, 1);
  }
  return out;
}
function adjacency(nv, I) {
  const deg = new Int32Array(nv + 1);
  for (let t = 0; t < I.length; t += 3) for (let e = 0; e < 3; e++) deg[I[t + e]] += 2;
  const start = new Int32Array(nv + 1);
  for (let v = 0; v < nv; v++) start[v + 1] = start[v] + deg[v];
  const fill = start.slice(0, nv);
  const nbr = new Int32Array(start[nv]);
  for (let t = 0; t < I.length; t += 3) {
    for (let e = 0; e < 3; e++) {
      const a = I[t + e], b = I[t + ((e + 1) % 3)], c = I[t + ((e + 2) % 3)];
      nbr[fill[a]++] = b; nbr[fill[a]++] = c;
    }
  }
  return { start, nbr };
}
function smoothWeights(W, nv, nb, I, iters) {
  const { start, nbr } = adjacency(nv, I);
  const used = new Uint8Array(nb);
  for (let i = 0; i < W.length; i++) if (W[i] > 1e-5) used[i % nb] = 1;
  const act = [];
  for (let b = 0; b < nb; b++) if (used[b]) act.push(b);
  let src = W, dst = new Float32Array(W.length);
  for (let it = 0; it < iters; it++) {
    for (let v = 0; v < nv; v++) {
      const s0 = start[v], s1 = start[v + 1], cnt = s1 - s0;
      for (let a = 0; a < act.length; a++) {
        const b = act[a];
        let acc = 0;
        for (let q = s0; q < s1; q++) acc += src[nbr[q] * nb + b];
        dst[v * nb + b] = cnt ? 0.5 * src[v * nb + b] + (0.5 * acc) / cnt : src[v * nb + b];
      }
    }
    const t = src; src = dst; dst = t;
  }
  if (src !== W) W.set(src);
}
function smoothScalar(S, nv, I, iters) {
  const { start, nbr } = adjacency(nv, I);
  let src = S, dst = new Float32Array(S.length);
  for (let it = 0; it < iters; it++) {
    for (let v = 0; v < nv; v++) {
      const s0 = start[v], s1 = start[v + 1], cnt = s1 - s0;
      let acc = 0;
      for (let q = s0; q < s1; q++) acc += src[nbr[q]];
      dst[v] = cnt ? 0.5 * src[v] + (0.5 * acc) / cnt : src[v];
    }
    const t = src; src = dst; dst = t;
  }
  if (src !== S) S.set(src);
}

function top4(row, si, sw, o) {
  const bi = [0, 0, 0, 0], bw = [-1, -1, -1, -1];
  for (let b = 0; b < row.length; b++) {
    const w = row[b];
    if (w <= bw[3]) continue;
    let k = 3;
    while (k > 0 && w > bw[k - 1]) { bw[k] = bw[k - 1]; bi[k] = bi[k - 1]; k--; }
    bw[k] = w; bi[k] = b;
  }
  let s = 0;
  for (let k = 0; k < 4; k++) { if (bw[k] < 0.01) bw[k] = 0; s += bw[k]; }
  for (let k = 0; k < 4; k++) { si[o + k] = bi[k]; sw[o + k] = s > 0 ? bw[k] / s : k === 0 ? 1 : 0; }
}

function gridIJ(ni, nj, fn) {
  const nv = (ni + 1) * (nj + 1);
  const P = new Float32Array(nv * 3), UV = new Float32Array(nv * 2);
  let k = 0;
  for (let j = 0; j <= nj; j++) for (let i = 0; i <= ni; i++) {
    const r = fn(i, j);
    P[k * 3] = r[0]; P[k * 3 + 1] = r[1]; P[k * 3 + 2] = r[2];
    UV[k * 2] = r.length > 3 ? r[3] : i / ni; UV[k * 2 + 1] = r.length > 4 ? r[4] : j / nj;
    k++;
  }
  const I = new Uint32Array(ni * nj * 6);
  let t = 0;
  for (let j = 0; j < nj; j++) for (let i = 0; i < ni; i++) {
    const a = j * (ni + 1) + i, b = a + 1, c = a + ni + 1, d = c + 1;
    I[t++] = a; I[t++] = b; I[t++] = d; I[t++] = a; I[t++] = d; I[t++] = c;
  }
  return { P, UV, I };
}
function flipWinding(pc) {
  for (let t = 0; t < pc.I.length; t += 3) { const b = pc.I[t + 1]; pc.I[t + 1] = pc.I[t + 2]; pc.I[t + 2] = b; }
  return pc;
}
function merge(parts) {
  let nv = 0, ni = 0;
  for (const p of parts) { nv += p.P.length / 3; ni += p.I.length; }
  const P = new Float32Array(nv * 3), UV = new Float32Array(nv * 2), I = new Uint32Array(ni);
  let ov = 0, oi = 0;
  for (const p of parts) {
    P.set(p.P, ov * 3);
    if (p.UV) UV.set(p.UV, ov * 2);
    for (let t = 0; t < p.I.length; t++) I[oi + t] = p.I[t] + ov;
    ov += p.P.length / 3; oi += p.I.length;
  }
  return { P, UV, I };
}
function computeNormals(pc) {
  const P = pc.P, I = pc.I, n = P.length / 3;
  const rep = new Int32Array(n);
  const map = new Map();
  for (let i = 0; i < n; i++) {
    const key = Math.round(P[i * 3] * 2e4) + ',' + Math.round(P[i * 3 + 1] * 2e4) + ',' + Math.round(P[i * 3 + 2] * 2e4);
    const r = map.get(key);
    if (r === undefined) { map.set(key, i); rep[i] = i; } else rep[i] = r;
  }
  const acc = new Float32Array(n * 3);
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3;
    const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2];
    const vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
    const fx = uy * vz - uz * vy, fy = uz * vx - ux * vz, fz = ux * vy - uy * vx;
    for (let e = 0; e < 3; e++) {
      const r = rep[I[t + e]] * 3;
      acc[r] += fx; acc[r + 1] += fy; acc[r + 2] += fz;
    }
  }
  const N = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const r = rep[i] * 3;
    const l = Math.hypot(acc[r], acc[r + 1], acc[r + 2]) || 1;
    N[i * 3] = acc[r] / l; N[i * 3 + 1] = acc[r + 1] / l; N[i * 3 + 2] = acc[r + 2] / l;
  }
  pc.N = N;
  return pc;
}
function xform(pc, m) {
  const e = m.elements, P = pc.P;
  for (let i = 0; i < P.length; i += 3) {
    const x = P[i], y = P[i + 1], z = P[i + 2];
    P[i] = e[0] * x + e[4] * y + e[8] * z + e[12];
    P[i + 1] = e[1] * x + e[5] * y + e[9] * z + e[13];
    P[i + 2] = e[2] * x + e[6] * y + e[10] * z + e[14];
  }
  if (pc.N) {
    const N = pc.N;
    for (let i = 0; i < N.length; i += 3) {
      const x = N[i], y = N[i + 1], z = N[i + 2];
      const nx = e[0] * x + e[4] * y + e[8] * z, ny = e[1] * x + e[5] * y + e[9] * z, nz = e[2] * x + e[6] * y + e[10] * z;
      const l = Math.hypot(nx, ny, nz) || 1;
      N[i] = nx / l; N[i + 1] = ny / l; N[i + 2] = nz / l;
    }
  }
  return pc;
}
function mirrorPiece(pc) {
  const q = { P: pc.P.slice(), I: pc.I.slice(), UV: pc.UV ? pc.UV.slice() : null };
  for (let i = 0; i < q.P.length; i += 3) q.P[i] = -q.P[i];
  if (pc.N) { q.N = pc.N.slice(); for (let i = 0; i < q.N.length; i += 3) q.N[i] = -q.N[i]; }
  for (const k of ['SI', 'SW', 'X', 'A']) if (pc[k]) q[k] = pc[k].slice();
  return flipWinding(q);
}
function basis(o, x, y, z) {
  return new THREE.Matrix4().makeBasis(new THREE.Vector3(...x), new THREE.Vector3(...y), new THREE.Vector3(...z)).setPosition(o[0], o[1], o[2]);
}
const T3 = (x, y, z) => new THREE.Matrix4().makeTranslation(x, y, z);
function orient(o, dir, up) {
  const y = vnorm(dir);
  let ref = (Math.abs(y[1]) > 0.9 ? [0, 0, 1] : [0, 1, 0]);
  if (Math.abs(vdot(vnorm(ref), y)) > 0.98) ref = Math.abs(y[0]) < 0.9 ? [1, 0, 0] : [0, 0, 1];
  const x = vnorm(vcross(y, ref));
  return basis(o, x, y, vcross(x, y));
}
function lathe(prof, seg, a0 = 0, a1 = TAU) {
  const pc = gridIJ(seg, prof.length - 1, (i, j) => {
    const a = a0 + ((a1 - a0) * i) / seg, r = prof[j][0], y = prof[j][1];
    return [r * Math.sin(a), y, r * Math.cos(a), a * Math.max(r, 0.005), y];
  });
  let area = 0;
  for (let k = 0; k < prof.length; k++) { const p = prof[k], q = prof[(k + 1) % prof.length]; area += p[0] * q[1] - q[0] * p[1]; }
  if (area < -1e-9) flipWinding(pc);
  return pc;
}
function torus(R, r, segR, segr) {
  const prof = [];
  for (let k = 0; k <= segr; k++) { const a = -Math.PI + (k / segr) * TAU; prof.push([R + r * Math.cos(a), r * Math.sin(a)]); }
  return lathe(prof, segR);
}
const cyl = (r0, r1, len, segs) => lathe([[0, 0], [r0, 0], [r1, len], [0, len]], segs);
function rbox(hx, hy, hz, r) {
  const H = [hx, hy, hz];
  const cs = (h) => { const i = Math.max(0, h - r); return [-h, -i, i, h]; };
  const parts = [];
  for (let a = 0; a < 3; a++) for (const s of [1, -1]) {
    const u = (a + 1) % 3, v = (a + 2) % 3;
    const cu = cs(H[u]), cv = cs(H[v]);
    const pc = gridIJ(cu.length - 1, cv.length - 1, (i, j) => {
      const p = [0, 0, 0];
      p[a] = s * H[a]; p[u] = cu[i]; p[v] = cv[j];
      const q = [clamp(p[0], -H[0] + r, H[0] - r), clamp(p[1], -H[1] + r, H[1] - r), clamp(p[2], -H[2] + r, H[2] - r)];
      const d = vsub(p, q), l = vlen(d);
      const pp = l > 1e-9 ? vmad(q, d, r / l) : p;
      return [pp[0], pp[1], pp[2], p[u] + H[u], p[v] + H[v]];
    });
    if (s < 0) flipWinding(pc);
    parts.push(pc);
  }
  return merge(parts);
}
function rotateAbout(v, k, a) {
  const c = Math.cos(a), s = Math.sin(a);
  return vadd(vadd(vmul(v, c), vmul(vcross(k, v), s)), vmul(k, vdot(k, v) * (1 - c)));
}
function tubeAlong(pts, rFn, secN, n0, closedEnds = false) {
  const M = pts.length;
  const T = [], N = [], arc = [0];
  for (let i = 1; i < M; i++) arc.push(arc[i - 1] + vlen(vsub(pts[i], pts[i - 1])));
  for (let i = 0; i < M; i++) T.push(vnorm(vsub(pts[Math.min(M - 1, i + 1)], pts[Math.max(0, i - 1)])));
  let n = n0 ? vsub(n0, vmul(T[0], vdot(n0, T[0]))) : [0, 0, 0];
  if (vlen(n) < 1e-3) n = vcross(vcross(T[0], Math.abs(T[0][1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]), T[0]);
  N.push(vnorm(n));
  for (let i = 1; i < M; i++) {
    const a = T[i - 1], b = T[i], ax = vcross(a, b), s = vlen(ax);
    let nn = N[i - 1];
    if (s > 1e-7) nn = rotateAbout(nn, vmul(ax, 1 / s), Math.atan2(s, vdot(a, b)));
    N.push(vnorm(vsub(nn, vmul(b, vdot(nn, b)))));
  }
  const pc = gridIJ(M - 1, secN, (i, j) => {
    const a = (j / secN) * TAU, t = T[i], nn = N[i], bb = vcross(t, nn);
    const r = rFn(arc[i], arc[M - 1], a);
    const p = vmad(pts[i], vsub(vmul(nn, Math.cos(a)), vmul(bb, Math.sin(a))), r);
    return [p[0], p[1], p[2], arc[i], a * r];
  });
  if (closedEnds) {
    const caps = [];
    for (const e of [0, M - 1]) {
      const ring = [];
      for (let j = 0; j <= secN; j++) ring.push(pc.P.slice(((e * 1) + j * M) * 3, ((e * 1) + j * M) * 3 + 3));
      const c = pts[e];
      const cap = gridIJ(secN, 1, (i, j) => (j === 0 ? [c[0], c[1], c[2], 0, 0] : [ring[i][0], ring[i][1], ring[i][2], 0, 0]));
      caps.push(e === 0 ? cap : flipWinding(cap));
    }
    const m = merge([pc, ...caps]);
    return m;
  }
  return pc;
}
function ribbon(path, width, thick, gap, closed, secN = 12) {
  const M = path.length;
  const sec = [];
  for (let k = 0; k <= secN; k++) {
    const a = (k / secN) * TAU, c = Math.cos(a), s = Math.sin(a);
    sec.push([Math.sign(c) * Math.abs(c) ** 0.35, Math.sign(s) * Math.abs(s) ** 0.35]);
  }
  const fr = path.map((q, i) => {
    const a = path[closed ? (i - 1 + M) % M : Math.max(0, i - 1)].p, b = path[closed ? (i + 1) % M : Math.min(M - 1, i + 1)].p;
    const T = vnorm(vsub(b, a));
    const N = vnorm(vsub(q.n, vmul(T, vdot(q.n, T))));
    return { T, N, S: vcross(T, N) };
  });
  const rows = closed ? M : M - 1;
  const arc = [0];
  for (let i = 1; i <= rows; i++) arc.push(arc[i - 1] + vlen(vsub(path[i % M].p, path[i - 1].p)));
  const pc = gridIJ(rows, secN, (i, j) => {
    const ii = i % M, f = fr[ii];
    const c = vmad(path[ii].p, f.N, gap + thick / 2);
    const p = vmad(vmad(c, f.S, (sec[j][0] * width) / 2), f.N, (sec[j][1] * thick) / 2);
    return [p[0], p[1], p[2], arc[i], (sec[j][0] * width) / 2];
  });
  pc.frames = fr;
  pc.arc = arc;
  return pc;
}
function smoothPath(ctrl, n, closed = false) {
  const m = ctrl.length, segs = closed ? m : m - 1, dense = [];
  const P = (k) => (closed ? ctrl[((k % m) + m) % m] : ctrl[clamp(k, 0, m - 1)]);
  const D = Math.max(8, n * 4);
  for (let s = 0; s <= D; s++) {
    if (closed && s === D) break;
    const t = (s / D) * segs;
    const i = Math.min(segs - 1, Math.floor(t)), u = t - i;
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
    const q = [0, 0, 0];
    for (let c = 0; c < 3; c++) q[c] = 0.5 * (2 * p1[c] + (-p0[c] + p2[c]) * u + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * u * u + (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * u * u * u);
    dense.push(q);
  }
  const L = dense.length, cs = closed ? L : L - 1, cum = [0];
  for (let i = 0; i < cs; i++) cum.push(cum[i] + vlen(vsub(dense[(i + 1) % L], dense[i])));
  const total = cum[cs], out = [];
  for (let k = 0; k < n; k++) {
    const s = closed ? (k / n) * total : (k / (n - 1)) * total;
    let i = 0;
    while (i < cs - 1 && cum[i + 1] < s) i++;
    out.push(vlerp(dense[i], dense[(i + 1) % L], (s - cum[i]) / Math.max(1e-9, cum[i + 1] - cum[i])));
  }
  return out;
}

function makeBuilder() {
  const A = { P: [], N: [], UV: [], C: [], M: [], R: [], X: [], SI: [], SW: [], I: [] };
  const tags = {};
  let n = 0;
  const val = (v, q) => (typeof v === 'function' ? v(q) : v);
  return {
    A,
    tags,
    get count() { return n; },
    add(pc, o) {
      if (!pc.N) computeNormals(pc);
      if (o.inside) {
        const c = o.inside, P = pc.P, N = pc.N;
        let s = 0;
        for (let i = 0; i < P.length; i += 3) s += N[i] * (P[i] - c[0]) + N[i + 1] * (P[i + 1] - c[1]) + N[i + 2] * (P[i + 2] - c[2]);
        if (o.invert ? s > 0 : s < 0) { flipWinding(pc); computeNormals(pc); }
      }
      const nv = pc.P.length / 3;
      const tag = o.tag || 'misc';
      tags[tag] = (tags[tag] || 0) + pc.I.length / 3;
      const q = { p: [0, 0, 0], u: 0, v: 0, i: 0, n: [0, 1, 0] };
      for (let i = 0; i < nv; i++) {
        const p = [pc.P[i * 3], pc.P[i * 3 + 1], pc.P[i * 3 + 2]];
        q.p = p; q.i = i;
        q.u = pc.UV ? pc.UV[i * 2] : 0; q.v = pc.UV ? pc.UV[i * 2 + 1] : 0;
        q.n = [pc.N[i * 3], pc.N[i * 3 + 1], pc.N[i * 3 + 2]];
        A.P.push(p[0], p[1], p[2]);
        A.N.push(q.n[0], q.n[1], q.n[2]);
        A.UV.push(q.u, q.v);
        const c = val(o.col, q); A.C.push(c[0], c[1], c[2]);
        const m = val(o.mat, q); A.M.push(m[0], m[1], m[2], m[3]);
        const x = pc.X ? [pc.X[i * 4], pc.X[i * 4 + 1], pc.X[i * 4 + 2], pc.X[i * 4 + 3]] : o.aux ? val(o.aux, q) : [0, 0, 0, 0];
        A.X.push(x[0], x[1] || 0, x[2] || 0, x[3] || 0);
        const rp = pc.R ? [pc.R[i * 3], pc.R[i * 3 + 1], pc.R[i * 3 + 2]] : p;
        A.R.push(rp[0], rp[1], rp[2]);
        if (pc.SI) {
          for (let k = 0; k < 4; k++) { A.SI.push(pc.SI[i * 4 + k]); A.SW.push(pc.SW[i * 4 + k]); }
        } else if (typeof o.skin === 'number') {
          A.SI.push(o.skin, 0, 0, 0); A.SW.push(1, 0, 0, 0);
        } else {
          const w = o.skin(q);
          A.SI.push(w[0], w[1], w[2], w[3]); A.SW.push(w[4], w[5], w[6], w[7]);
        }
      }
      for (let t = 0; t < pc.I.length; t++) A.I.push(pc.I[t] + n);
      n += nv;
    },
  };
}

const SIDES = ['R', 'L'];
const BONES = [];
const BI = {};
function defBone(name, parent, p, order = 'XZY') {
  BI[name] = BONES.length;
  BONES.push({ name, parent: parent ? BI[parent] : -1, p, order });
}
const FINGERS = [
  { n: 'I', k: [-1e-3, -0.093, -0.0265], L: [0.041, 0.024, 0.020], r: [0.0090, 0.0083, 0.0077, 0.0068], sp: -8 },
  { n: 'M', k: [-1e-3, -0.097, -88e-4], L: [0.045, 0.027, 0.021], r: [0.0092, 0.0085, 0.0079, 0.0070], sp: -2.5 },
  { n: 'R', k: [-1e-3, -0.094, 0.0088], L: [0.042, 0.026, 0.020], r: [0.0087, 0.0081, 0.0076, 0.0067], sp: 4.5 },
  { n: 'P', k: [0.000, -0.086, 0.0255], L: [0.033, 0.019, 0.017], r: [0.0078, 0.0073, 0.0068, 0.0060], sp: 12 },
];
const THUMB = { p: [[-0.012, -0.02, -0.023], [-0.024, -0.05, -0.045], [-0.032, -0.077, -0.056], [-0.037, -0.097, -0.06]], r: [0.0152, 0.0122, 0.0110, 0.0100, 0.0086] };

const HZ = 0.004;
const BONNET_PROF = [
  [0.1185, 0.565], [0.1205, 0.572], [0.127, 0.582], [0.137, 0.596], [0.1465, 0.613], [0.1535, 0.632], [0.1575, 0.652],
  [0.1592, 0.672], [0.1590, 0.694], [0.1570, 0.716], [0.1525, 0.738], [0.1450, 0.760], [0.1335, 0.781], [0.1170, 0.800],
  [0.0945, 0.816], [0.0680, 0.828], [0.0400, 0.8355], [0.0150, 0.8390], [0.0, 0.8395],
];
function bonnetR(y) {
  const P = BONNET_PROF;
  if (y <= P[0][1]) return P[0][0];
  for (let i = 0; i < P.length - 1; i++) {
    if (y <= P[i + 1][1]) {
      const t = (y - P[i][1]) / (P[i + 1][1] - P[i][1]);
      const p0 = P[Math.max(0, i - 1)][0], p1 = P[i][0], p2 = P[i + 1][0], p3 = P[Math.min(P.length - 1, i + 2)][0];
      return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t);
    }
  }
  return 0;
}
const LIGHT_Y = 0.668, FRONT_CLR = 0.061, FRONT_FR = 0.086, SIDE_CLR = 0.046, SIDE_FR = 0.064;
const SIDE_ANG = 76 * DEG, SIDE_DIP = 3 * DEG;
const FRONT_Z = HZ - bonnetR(LIGHT_Y) - 0.021;
const HINGE = [FRONT_FR + 0.006, LIGHT_Y, FRONT_Z + 0.004];
const RING_Y = 0.565, RING_R = 0.121;
const RIM_X = 0.206, RIM_ZF = 0.168, RIM_ZB = 0.176, RIM_YS = 0.448, RIM_YF = 0.342, RIM_YB = 0.358;
function rimAt(th) {
  const c = Math.cos(th), s = Math.sin(th);
  const rz = c > 0 ? RIM_ZF : RIM_ZB;
  const r = 1 / Math.sqrt((s / RIM_X) ** 2 + (c / rz) ** 2);
  const y = RIM_YS - (RIM_YS - RIM_YF) * Math.pow(Math.max(c, 0), 1.35) - (RIM_YS - RIM_YB) * Math.pow(Math.max(-c, 0), 1.35);
  return { x: s * r, z: HZ - c * r, y, r };
}
function corsAt(th, u) {
  const rm = rimAt(th);
  const f = Math.sin(u * Math.PI * 0.5) ** 0.85, g = Math.pow(u, 1.55);
  const r = lerp(RING_R, rm.r, f);
  const s = Math.sin(th), c = Math.cos(th);
  return [s * r, lerp(RING_Y - 0.004, rm.y, g), HZ - c * r];
}

defBone('root', null, [0, 0, 0], 'ZXY');
defBone('pelvis', 'root', [0, 0, 0.01]);
defBone('spine1', 'pelvis', [0, 0.10, 0.02]);
defBone('spine2', 'spine1', [0, 0.22, 0.025]);
defBone('chest', 'spine2', [0, 0.34, 0.02]);
defBone('cors', 'chest', [0, 0.50, HZ]);
defBone('plate', 'cors', HINGE);
defBone('wF', 'cors', [0, RIM_YF - 0.012, HZ - RIM_ZF - 0.006]);
defBone('wB', 'cors', [0, RIM_YB - 0.012, HZ + RIM_ZB + 0.006]);
defBone('neck', 'chest', [0, 0.515, 0.015]);
defBone('head', 'neck', [0, 0.605, 0.01]);
defBone('jaw', 'head', [0, 0.628, -0.016]);
defBone('brow', 'head', [0, 0.700, -0.07]);
for (const S of SIDES) {
  const s = S === 'R' ? 1 : -1;
  defBone('eye' + S, 'head', [s * 0.0325, 0.667, -0.0695]);
  defBone('lid' + S, 'head', [s * 0.0325, 0.667, -0.0695]);
}
for (const S of SIDES) {
  const s = S === 'R' ? 1 : -1;
  const hx = s * 0.172;
  defBone('clav' + S, 'chest', [s * 0.02, 0.482, 0.0]);
  defBone('shH' + S, 'clav' + S, [hx, 0.462, 0.012]);
  defBone('uarm' + S, 'clav' + S, [hx, 0.462, 0.012]);
  defBone('elH' + S, 'uarm' + S, [hx, 0.172, 0.012]);
  defBone('farm' + S, 'uarm' + S, [hx, 0.172, 0.012]);
  defBone('twist' + S, 'farm' + S, [hx, 0.05, 0.012]);
  defBone('hand' + S, 'farm' + S, [hx, -0.073, 0.012]);
  for (const f of FINGERS) {
    const k = [hx + s * f.k[0], -0.073 + f.k[1], 0.012 + f.k[2]];
    const sp = f.sp * DEG;
    defBone('f' + f.n + '1' + S, 'hand' + S, k);
    defBone('f' + f.n + '2' + S, 'f' + f.n + '1' + S, [k[0], k[1] - Math.cos(sp) * f.L[0], k[2] + Math.sin(sp) * f.L[0]]);
  }
  defBone('thumb1' + S, 'hand' + S, [hx + s * THUMB.p[0][0], -0.073 + THUMB.p[0][1], 0.012 + THUMB.p[0][2]]);
  defBone('thumb2' + S, 'thumb1' + S, [hx + s * THUMB.p[1][0], -0.073 + THUMB.p[1][1], 0.012 + THUMB.p[1][2]]);
  defBone('hipH' + S, 'pelvis', [s * 0.088, -0.035, 0.01]);
  defBone('thigh' + S, 'pelvis', [s * 0.088, -0.035, 0.01]);
  defBone('knH' + S, 'thigh' + S, [s * 0.088, -0.435, 0.0]);
  defBone('shin' + S, 'thigh' + S, [s * 0.088, -0.435, 0.0]);
  defBone('foot' + S, 'shin' + S, [s * 0.088, -0.835, 0.025]);
  defBone('toe' + S, 'foot' + S, [s * 0.092, -0.887, -0.112]);
}
defBone('bag', 'pelvis', [-0.193, 0.064, -0.03]);
defBone('knife', 'pelvis', [0.194, 0.022, 0.03]);
const NBB = BONES.length;

const BIND = { uarmR: [0, 0, 42], uarmL: [0, 0, -42], thighR: [0, 0, 5], thighL: [0, 0, -5], footR: [0, 0, -5], footL: [0, 0, 5] };
for (const f of FINGERS) {
  BIND['f' + f.n + '1R'] = [0, 0, -12]; BIND['f' + f.n + '1L'] = [0, 0, 12];
  BIND['f' + f.n + '2R'] = [0, 0, -14]; BIND['f' + f.n + '2L'] = [0, 0, 14];
}

const LIMB_HELP = [];
const TWIST = [];
for (const S of SIDES) {
  for (const [h, d] of [['shH', 'uarm'], ['elH', 'farm'], ['hipH', 'thigh'], ['knH', 'shin']]) {
    const e = BIND[d + S] || [0, 0, 0];
    LIMB_HELP.push({ h: BI[h + S], d: BI[d + S], be: [e[0] * DEG, e[1] * DEG, e[2] * DEG] });
  }
  TWIST.push(BI['hand' + S], BI['twist' + S]);
}
const _qI = new THREE.Quaternion();
function eulerQuat(q, E, o, zxy) {
  const hx = E[o] * 0.5, hy = E[o + 1] * 0.5, hz = E[o + 2] * 0.5;
  const c1 = Math.cos(hx), c2 = Math.cos(hy), c3 = Math.cos(hz), s1 = Math.sin(hx), s2 = Math.sin(hy), s3 = Math.sin(hz);
  q._x = s1 * c2 * c3 - c1 * s2 * s3;
  q._z = c1 * c2 * s3 + s1 * s2 * c3;
  if (zxy) { q._y = c1 * s2 * c3 + s1 * c2 * s3; q._w = c1 * c2 * c3 - s1 * s2 * s3; }
  else { q._y = c1 * s2 * c3 - s1 * c2 * s3; q._w = c1 * c2 * c3 + s1 * s2 * s3; }
}
const HE = new Float64Array(3);
function applyHelpers(Q, E) {
  for (let i = 0; i < LIMB_HELP.length; i++) {
    const H = LIMB_HELP[i], o = H.d * 3, be = H.be;
    HE[0] = ((E ? E[o] : be[0]) + be[0]) * 0.5;
    HE[1] = ((E ? E[o + 1] : be[1]) + be[1]) * 0.5;
    HE[2] = ((E ? E[o + 2] : be[2]) + be[2]) * 0.5;
    eulerQuat(Q[H.h], HE, 0, false);
  }
  let prev = TWP.get(Q);
  if (!prev) { prev = new Float64Array(TWIST.length); TWP.set(Q, prev); }
  for (let i = 0; i < TWIST.length; i += 2) {
    const h = Q[TWIST[i]], tw = Q[TWIST[i + 1]];
    const l = Math.sqrt(h._y * h._y + h._w * h._w);
    if (l < 1e-6) { tw.copy(_qI); continue; }
    let y = h._y / l, w = h._w / l;
    const py = prev[i], pw = prev[i + 1];
    if (py !== 0 || pw !== 0) { if (y * py + w * pw < 0) { y = -y; w = -w; } }
    else if (w < 0) { y = -y; w = -w; }
    prev[i] = y; prev[i + 1] = w;
    const a = 0.5 * Math.atan2(y, w);
    tw._x = 0; tw._y = Math.sin(a); tw._z = 0; tw._w = Math.cos(a);
  }
}
const TWP = new WeakMap();
const J3 = {};
for (const b of BONES) J3[b.name] = BI[b.name] * 3;
const ORDZ = BONES.map((bn) => bn.order === 'ZXY');

const BINDM = (() => {
  const ONE = new THREE.Vector3(1, 1, 1);
  const offs = BONES.map((bn) => new THREE.Vector3().fromArray(bn.parent < 0 ? bn.p : vsub(bn.p, BONES[bn.parent].p)));
  const e = new THREE.Euler();
  const q = BONES.map((bn) => {
    const a = BIND[bn.name] || [0, 0, 0];
    e.set(a[0] * DEG, a[1] * DEG, a[2] * DEG, bn.order);
    return new THREE.Quaternion().setFromEuler(e);
  });
  applyHelpers(q, null);
  const M = BONES.map(() => new THREE.Matrix4());
  const lm = new THREE.Matrix4();
  for (let i = 0; i < NBB; i++) {
    lm.compose(offs[i], q[i], ONE);
    const pa = BONES[i].parent;
    if (pa < 0) M[i].copy(lm); else M[i].multiplyMatrices(M[pa], lm);
  }
  return { offs, q, M, inv: M.map((m) => m.clone().invert()) };
})();
const J = (n) => { const e = BINDM.M[BI[n]].elements; return [e[12], e[13], e[14]]; };
const AX = (n, c) => { const e = BINDM.M[BI[n]].elements; return vnorm([e[c * 4], e[c * 4 + 1], e[c * 4 + 2]]); };
const toBind = (n, p) => { const v = new THREE.Vector3(p[0], p[1], p[2]).applyMatrix4(BINDM.M[BI[n]]); return [v.x, v.y, v.z]; };

const B_ = BI;
const trunkW = (x, y, z, ob, ow) => {
  const s1 = sstep(0.05, 0.16, y), s2 = sstep(0.17, 0.28, y), ch = sstep(0.30, 0.40, y);
  ob[0] = B_.pelvis; ow[0] = 1 - s1; ob[1] = B_.spine1; ow[1] = s1 - s2; ob[2] = B_.spine2; ow[2] = s2 - ch; ob[3] = B_.chest; ow[3] = ch;
  return 4;
};
function limbW(S, kind) {
  if (kind === 'uarm') return (t, ob, ow) => {
    const a = 1 - sstep(-0.05, 0.3, t), e = sstep(0.82, 1.02, t);
    ob[0] = B_['shH' + S]; ow[0] = a; ob[1] = B_['uarm' + S]; ow[1] = Math.max(0, 1 - a - e); ob[2] = B_['elH' + S]; ow[2] = e;
    return 3;
  };
  if (kind === 'farm') return (t, ob, ow) => {
    const e = 1 - sstep(-0.02, 0.15, t), tw = sstep(0.35, 0.92, t), h = sstep(0.97, 1.05, t);
    ob[0] = B_['elH' + S]; ow[0] = e; ob[1] = B_['farm' + S]; ow[1] = Math.max(0, 1 - e - tw); ob[2] = B_['twist' + S]; ow[2] = tw * (1 - h); ob[3] = B_['hand' + S]; ow[3] = tw * h;
    return 4;
  };
  if (kind === 'thigh') return (t, ob, ow) => {
    const h = 1 - sstep(-0.05, 0.25, t), k = sstep(0.85, 1.02, t);
    ob[0] = B_['hipH' + S]; ow[0] = h; ob[1] = B_['thigh' + S]; ow[1] = Math.max(0, 1 - h - k); ob[2] = B_['knH' + S]; ow[2] = k;
    return 3;
  };
  return (t, ob, ow) => {
    const k = 1 - sstep(-0.02, 0.14, t), f = sstep(0.93, 1.06, t);
    ob[0] = B_['knH' + S]; ow[0] = k; ob[1] = B_['shin' + S]; ow[1] = Math.max(0, 1 - k - f); ob[2] = B_['foot' + S]; ow[2] = f;
    return 3;
  };
}
const tagged = (p, tag) => { p.tag = tag; return p; };

function suitPrims(seed = 1) {
  const R = rng(seed * 7 + 3);
  const ph = [R() * 6, R() * 6, R() * 6, R() * 6, R() * 6, R() * 6];
  const prims = [];
  const drape = (x, y, z) => {
    const th = Math.atan2(x, -(z - 0.01));
    const below = sstep(-0.16, -0.06, y) * (1 - sstep(0.24, 0.34, y));
    let h = 0.0028 * Math.sin(th * 9 + 2.2 * Math.sin(y * 13 + ph[0]) + ph[1]) * below;
    const belt = Math.exp(-(((y - 0.075) / 0.045) ** 2));
    h += 0.0032 * Math.sin(th * 21 + 1.3 * Math.sin(th * 3 + ph[2])) * belt;
    const seat = sstep(0.0, 0.08, z - 0.02) * Math.exp(-(((y + 0.07) / 0.07) ** 2));
    h += 0.004 * Math.sin(x * 38 + ph[3] + 3 * y) * seat;
    return h;
  };
  prims.push(tagged(primTorso([
    [-0.165, 0.098, 0.085, 0.098, 2.0, 0.012],
    [-0.105, 0.160, 0.106, 0.132, 2.1, 0.016],
    [-0.035, 0.184, 0.113, 0.142, 2.2, 0.014],
    [0.040, 0.182, 0.117, 0.134, 2.3, 0.010],
    [0.120, 0.178, 0.121, 0.126, 2.35, 0.008],
    [0.200, 0.182, 0.125, 0.124, 2.4, 0.006],
    [0.280, 0.188, 0.129, 0.126, 2.45, 0.005],
    [0.360, 0.190, 0.127, 0.128, 2.45, 0.005],
    [0.430, 0.180, 0.115, 0.120, 2.3, 0.006],
    [0.490, 0.150, 0.093, 0.101, 2.1, 0.008],
    [0.540, 0.090, 0.066, 0.072, 2.0, 0.012],
    [0.585, 0.064, 0.060, 0.062, 2.0, 0.015],
  ], trunkW, { k: 0.03, sig: 0.03, trunk: true }, drape), 'suit'));
  prims.push(tagged(primEllipsoid([0, -0.125, 0.045], [0.12, 0.075, 0.085], null, WMIX([[B_.pelvis, 0.7], [B_.hipHR, 0.15], [B_.hipHL, 0.15]]), { k: 0.05, sig: 0.03, trunk: true }), 'suit'));
  for (const S of SIDES) {
    const s = S === 'R' ? 1 : -1;
    prims.push(tagged(primEllipsoid([s * 0.158, 0.442, 0.004], [0.072, 0.072, 0.088], null, WMIX([[B_.chest, 0.4], [B_['clav' + S], 0.3], [B_['shH' + S], 0.3]]), { k: 0.04, sig: 0.03, trunk: true }), 'suit'));
    const sh = J('uarm' + S), el = J('farm' + S), wr = J('hand' + S);
    const ux = AX('uarm' + S, 0), uz = AX('uarm' + S, 2);
    prims.push(tagged(primLimb(vmad(sh, AX('uarm' + S, 1), 0.02), el, ux, uz,
      [[0, 0.070, 0.074, 0, 0], [0.25, 0.068, 0.071, 0, 0.002], [0.55, 0.064, 0.066, 0, 0.002], [0.85, 0.060, 0.061, 0, 0], [1, 0.059, 0.060, 0, 0]],
      limbW(S, 'uarm'), { k: 0.025, sig: 0.02 },
      (t, ang, sl) => {
        const a0 = ph[4] + s * 0.8 + 1.22 * t;
        const d = Math.atan2(Math.sin(ang - a0), Math.cos(ang - a0)) * 0.066;
        return (0.007 * Math.exp(-((d / 0.021) ** 2)) - 0.003 * Math.exp(-(((d - 0.03) / 0.013) ** 2))) * sstep(0.08, 0.2, t) * (1 - sstep(0.8, 0.95, t));
      }), 'suit'));
    const fx = AX('farm' + S, 0), fz = AX('farm' + S, 2);
    const fa = primLimb(el, vmad(wr, AX('farm' + S, 1), -0.012), fx, fz,
      [[0, 0.059, 0.060, 0, 0], [0.2, 0.060, 0.062, 0, 0.001], [0.5, 0.063, 0.064, 0, 0], [0.7, 0.058, 0.060, 0, 0], [0.8, 0.046, 0.049, 0, 0], [0.86, 0.036, 0.040, 0, 0], [1, 0.033, 0.036, 0, 0]],
      limbW(S, 'farm'), { k: 0.02, sig: 0.02 },
      (t, ang, sl) => 0.006 * Math.exp(-(((t - 0.68) / 0.07) ** 2)) * (0.8 + 0.2 * Math.sin(ang * 2 + ph[5])));
    prims.push(tagged(fa, 'sleeve'));
    fa.cuffT = 0.8;
    const hp = J('thigh' + S), kn = J('shin' + S), an = J('foot' + S);
    const tx = AX('thigh' + S, 0), tz = AX('thigh' + S, 2);
    prims.push(tagged(primLimb(vadd(hp, [0, 0.035, 0]), kn, tx, tz,
      [[0, 0.108, 0.112, s * 0.004, 0.004], [0.2, 0.104, 0.108, s * 0.004, 0.003], [0.5, 0.094, 0.096, s * 0.002, 0.002], [0.8, 0.084, 0.086, 0, 0], [1, 0.081, 0.083, 0, 0]],
      limbW(S, 'thigh'), { k: 0.035, sig: 0.022 },
      (t, ang, sl) => 0.0032 * Math.sin(ang * 4 + 2.4 * Math.sin(sl * 7 + ph[s > 0 ? 0 : 3]) + s) * sstep(0.1, 0.25, t) * (1 - sstep(0.7, 0.9, t))), 'suit'));
    prims.push(tagged(primEllipsoid(vadd(kn, [s * 0.004, 0.004, -0.045]), [0.062, 0.07, 0.04], null, WMIX([[B_['knH' + S], 0.6], [B_['shin' + S], 0.4]]), { k: 0.03, sig: 0.02 }), 'suit'));
    const sx = AX('shin' + S, 0), sz = AX('shin' + S, 2);
    prims.push(tagged(primLimb(kn, vadd(an, [0, 0.03, 0]), sx, sz,
      [[0, 0.082, 0.083, 0, 0], [0.2, 0.077, 0.079, 0, 0.004], [0.45, 0.071, 0.073, 0, 0.004], [0.62, 0.066, 0.067, 0, 0.002], [0.74, 0.058, 0.060, 0, 0], [0.85, 0.048, 0.051, 0, 0], [1, 0.043, 0.046, 0, 0]],
      limbW(S, 'shin'), { k: 0.025, sig: 0.02 },
      (t, ang, sl) => {
        let h = 0;
        for (let i = 0; i < 3; i++) {
          const c = 0.55 + 0.09 * i + 0.012 * Math.sin(ph[i] * 3 + s);
          const m = -Math.PI / 2 + 0.9 * Math.sin(ph[(i + 2) % 6] + s * (i + 1));
          const x = (t - c - 0.028 * Math.sin(ang - m + ph[i])) / 0.05;
          h += (0.011 - 0.0015 * i) * Math.exp(-x * x) * sstep(-0.6, 0.6, Math.cos(ang - m));
        }
        return h;
      }), 'suit'));
  }
  return prims;
}

function headPrims(look) {
  const L = Object.assign({ nose: 1, brow: 1, jaw: 1, stache: 1, cheek: 1, ear: 1, width: 1, chin: 1, stacheDroop: 1 }, look || {});
  const HB = B_.head, JB = B_.jaw, BRB = B_.brow;
  const HW = W1(HB);
  const JW = WMIX([[JB, 0.85], [HB, 0.15]]);
  const JW2 = WMIX([[JB, 0.5], [HB, 0.5]]);
  const BW = WMIX([[BRB, 0.7], [HB, 0.3]]);
  const G = { g: 1, k: 0.02, sig: 0.012 };
  const w = L.width;
  const P = [];
  const add = (p, tag) => { p.tag = tag; P.push(p); return p; };
  add(primEllipsoid([0, 0.688, 0.014], [0.073 * w, 0.090, 0.094], null, HW, { ...G, k: 0.03 }), 'skin');
  add(primEllipsoid([0, 0.712, -0.03], [0.064 * w, 0.050, 0.056], null, WMIX([[HB, 0.8], [BRB, 0.2]]), { ...G, k: 0.03 }), 'skin');
  add(primEllipsoid([0, 0.660, 0.040], [0.062 * w, 0.058, 0.060], null, HW, { ...G, k: 0.03 }), 'skin');
  add(primEllipsoid([0, 0.690, -0.066], [0.054 * w, 0.0125 * L.brow, 0.020], null, BW, { ...G, k: 0.014 }), 'skin');
  for (const s of [1, -1]) add(primEllipsoid([s * 0.030 * w, 0.6935, -0.0705], [0.019, 0.0062 * L.brow, 0.0095], null, BW, { ...G, k: 0.008 }), 'brow');
  for (const s of [1, -1]) {
    add(primEllipsoid([s * 0.046 * w, 0.655, -0.051], [0.022, 0.015 * L.cheek, 0.028], null, HW, { ...G, k: 0.018 }), 'skin');
    add(primEllipsoid([s * 0.037 * w, 0.627, -0.058], [0.024, 0.024, 0.022], null, JW2, { ...G, k: 0.02 }), 'skin');
    add(primEllipsoid([s * 0.043 * w, 0.605, -0.03], [0.021 * L.jaw, 0.030, 0.040], [vnorm([1, 0, 0]), vnorm([0, 1, -0.35]), vnorm([0, 0.35, 1])], JW2, { ...G, k: 0.022 }), 'skin');
    add(primEllipsoid([s * 0.030 * w, 0.583, -0.058], [0.020 * L.jaw, 0.016, 0.022], null, JW, { ...G, k: 0.02 }), 'skin');
    add(primEllipsoid([s * 0.073 * w, 0.662, 0.008], [0.008, 0.029 * L.ear, 0.019 * L.ear], [vnorm([1, 0, 0.25]), [0, 1, 0], vnorm([-0.25, 0, 1])], HW, { ...G, k: 0.008 }), 'skin');
    add(primEllipsoid([s * 0.0325, 0.6685, -0.0835], [0.0185, 0.0128, 0.0145], null, HW, { ...G, k: 0.006, sub: true }), 'skin');
    add(primEllipsoid([s * 0.0325, 0.6575, -0.0795], [0.0145, 0.0048, 0.0065], null, HW, { ...G, k: 0.005 }), 'skin');
  }
  const nz = L.nose;
  add(primCone([0, 0.684, -0.078], [0, 0.638, -0.101 - 0.004 * (nz - 1)], 0.0078, 0.0098 * nz, HW, { ...G, k: 0.01 }), 'skin');
  add(primEllipsoid([0, 0.6345, -0.1005 - 0.004 * (nz - 1)], [0.0112 * nz, 0.0105, 0.0105], null, HW, { ...G, k: 0.008 }), 'skin');
  for (const s of [1, -1]) {
    add(primEllipsoid([s * 0.0125 * nz, 0.6315, -0.0915], [0.0082, 0.0072, 0.0078], null, HW, { ...G, k: 0.008 }), 'skin');
    add(primEllipsoid([s * 0.0062, 0.6268, -0.0968], [0.0036, 0.0022, 0.0045], null, HW, { ...G, k: 0.003, sub: true }), 'skin');
  }
  add(primEllipsoid([0, 0.612, -0.079], [0.029, 0.017, 0.020], null, JW2, { ...G, k: 0.016 }), 'skin');
  add(primEllipsoid([0, 0.5985, -0.0815], [0.0175, 0.0062, 0.0085], null, JW, { ...G, k: 0.006 }), 'lip');
  add(primEllipsoid([0, 0.6035, -0.0885], [0.0205, 0.0016, 0.012], null, JW2, { ...G, k: 0.002, sub: true }), 'lip');
  add(primEllipsoid([0, 0.5745 - 0.004 * (L.chin - 1), -0.072], [0.0215, 0.0185 * L.chin, 0.0185], null, JW, { ...G, k: 0.018 }), 'skin');
  const st = L.stache, dr = L.stacheDroop;
  const stache = [];
  stache.push(add(primEllipsoid([0, 0.6138, -0.0957], [0.025 * st, 0.0105 * st, 0.0115], null, JW2, { ...G, k: 0.007 }), 'stache'));
  for (const s of [1, -1]) {
    stache.push(add(primCone([s * 0.009, 0.6128, -0.0975], [s * 0.031 * st, 0.6015 - 0.006 * dr, -0.0862], 0.0095 * st, 0.007, JW2, { ...G, k: 0.009 }), 'stache'));
    stache.push(add(primCone([s * 0.031 * st, 0.6015 - 0.006 * dr, -0.0862], [s * 0.0355 * st, 0.5895 - 0.011 * dr, -0.0785], 0.007, 0.0045, JW, { ...G, k: 0.008 }), 'stache'));
  }
  add(primCone([0, 0.505, 0.018], [0, 0.625, 0.022], 0.050, 0.047, WMIX([[B_.neck, 0.7], [HB, 0.3]]), { ...G, k: 0.025, sig: 0.02 }), 'skin');
  add(primEllipsoid([0, 0.583, -0.035], [0.0095, 0.011, 0.0085], null, W1(B_.neck), { ...G, k: 0.012 }), 'skin');
  add(primEllipsoid([0, 0.595, -0.022], [0.034, 0.03, 0.025], null, WMIX([[JB, 0.4], [B_.neck, 0.6]]), { ...G, k: 0.025 }), 'skin');
  return { prims: P, stache };
}
function eyeParts(seg) {
  const R = 0.0113;
  const eprof = [];
  for (let k = 0; k <= 12; k++) { const a = -Math.PI / 2 + (k / 12) * Math.PI; eprof.push([R * Math.cos(a), R * Math.sin(a)]); }
  const eye = lathe(eprof, seg(18));
  xform(eye, new THREE.Matrix4().makeRotationX(-Math.PI / 2));
  const lprof = [[(R + 0.0004) * Math.cos(12 * DEG), (R + 0.0004) * Math.sin(12 * DEG)]];
  for (let k = 0; k <= 7; k++) { const a = (15 + (k / 7) * 73) * DEG; lprof.push([(R + 0.0024) * Math.cos(a), (R + 0.0024) * Math.sin(a)]); }
  const lid = lathe(lprof, seg(14), Math.PI - 72 * DEG, Math.PI + 72 * DEG);
  const lprof2 = [];
  for (let k = 0; k <= 6; k++) { const a = (-86 + (k / 6) * 58) * DEG; lprof2.push([(R + 0.0019) * Math.cos(a), (R + 0.0019) * Math.sin(a)]); }
  lprof2.push([(R + 0.0004) * Math.cos(-25 * DEG), (R + 0.0004) * Math.sin(-25 * DEG)]);
  const lidLo = lathe(lprof2, seg(14), Math.PI - 68 * DEG, Math.PI + 68 * DEG);
  return { eye, lid, lidLo, R };
}

function makeHand() {
  const c1 = -12 * DEG, c2 = -14 * DEG, c3 = -8 * DEG;
  const rz = (v, a) => [v[0] * Math.cos(a) - v[1] * Math.sin(a), v[0] * Math.sin(a) + v[1] * Math.cos(a), v[2]];
  const caps = [], tips = [];
  for (const f of FINGERS) {
    const sp = f.sp * DEG, d0 = [0, -Math.cos(sp), Math.sin(sp)];
    const P1 = vmad(f.k, rz(d0, c1), f.L[0]);
    const P2 = vmad(P1, rz(d0, c1 + c2), f.L[1]);
    const P3 = vmad(P2, rz(d0, c1 + c2 + c3), f.L[2]);
    caps.push([f.k, P1, f.r[0], f.r[1], 'f' + f.n + '1'], [P1, P2, f.r[1], f.r[2], 'f' + f.n + '2'], [P2, P3, f.r[2], f.r[3], 'f' + f.n + '2']);
    tips.push({ a: P2, b: P3, dir: vnorm(vsub(P3, P2)), up: rz([1, 0, 0], c1 + c2 + c3), r: f.r[3] });
  }
  const crownAt = (z) => { const u = (z + 0.003) / 0.041; return 0.006 * Math.max(0, 1 - u * u); };
  const knuck = [];
  for (const f of FINGERS) {
    const sp = f.sp * DEG, d0 = [0, -Math.cos(sp), Math.sin(sp)];
    const P1 = vmad(f.k, rz(d0, c1), f.L[0]);
    knuck.push([vadd(f.k, [0.0085 + 0.45 * crownAt(f.k[2]), 0.002, 0]), [0.0064, 0.0082, 0.0074]], [vadd(P1, rz([0.0058, 0, 0], c1)), [0.0046, 0.0056, 0.0056]]);
  }
  const TP = THUMB.p, TR = THUMB.r;
  const tcaps = [[TP[0], TP[1], TR[0], TR[1]], [TP[1], TP[2], TR[2], TR[2]], [TP[2], TP[3], TR[3], TR[4]]];
  tips.push({ a: TP[2], b: TP[3], dir: vnorm(vsub(TP[3], TP[2])), up: vnorm([1, 0, -0.6]), r: TR[4] });
  const ell = (x, y, z, c, r) => sdEll(x - c[0], y - c[1], z - c[2], r[0], r[1], r[2]);
  const ell2 = (x, z, a, b) => {
    const qa = x / a, qb = z / b, k0 = Math.hypot(qa, qb), k1 = Math.hypot(qa / a, qb / b);
    return k1 > 1e-9 ? (k0 * (k0 - 1)) / k1 : -Math.min(a, b);
  };
  const palm = (x, y, z) => {
    const r = 0.0115, xp = -0.0147, xb = 0.0106 + crownAt(z);
    const yd = -0.0962 + 9 * z * z + 0.06 * z, yp = -5e-3;
    const w = 0.0325 + 0.0065 * clamp((-y - 0.008) / 0.075, 0, 1);
    const qx = Math.abs(x - 0.5 * (xb + xp)) - 0.5 * (xb - xp) + r, qy = Math.abs(y - 0.5 * (yd + yp)) - 0.5 * (yp - yd) + r, qz = Math.abs(z) - w + r;
    return Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0) - r;
  };
  const thenar = (x, y, z) => ell(x, y, z, [-9e-3, -0.041, -0.027], [0.0165, 0.029, 0.0175]);
  const hypo = (x, y, z) => ell(x, y, z, [-65e-4, -0.056, 0.0265], [0.0125, 0.034, 0.0128]);
  const wrist = (x, y, z) => {
    const d = ell2(x, z, 0.0195, 0.0285), ax = y > 0.05 ? y - 0.05 : y < -0.012 ? -0.012 - y : 0;
    return ax > 0 ? (d > 0 ? Math.hypot(d, ax) : Math.max(d, ax)) : d;
  };
  const fingers = (x, y, z) => {
    let d = 1e3;
    for (let i = 0; i < caps.length; i += 3) {
      const a = caps[i], b = caps[i + 1], c = caps[i + 2];
      const df = smin(smin(sdCone(x, y, z, a[0], a[1], a[2], a[3]), sdCone(x, y, z, b[0], b[1], b[2], b[3]), 0.003), sdCone(x, y, z, c[0], c[1], c[2], c[3]), 0.003);
      d = Math.min(d, df);
    }
    return d;
  };
  const thumb = (x, y, z) => {
    let d = 1e3;
    for (const c of tcaps) d = smin(d, sdCone(x, y, z, c[0], c[1], c[2], c[3]), 0.004);
    return d;
  };
  const knuckles = (x, y, z) => {
    let d = 1e3;
    for (let i = 0; i < knuck.length; i++) d = Math.min(d, ell(x, y, z, knuck[i][0], knuck[i][1]));
    return d;
  };
  const tendons = (x, y, z) => {
    let d = 1e3;
    for (const f of FINGERS) d = Math.min(d, sdCone(x, y, z, [0.0105 + crownAt(f.k[2] * 0.35), -4e-3, f.k[2] * 0.35], [0.0098 + crownAt(f.k[2]), f.k[1] + 0.012, f.k[2]], 0.0022, 0.0018));
    return d;
  };
  const f = (x, y, z) => {
    let d = smin(smin(palm(x, y, z), thenar(x, y, z), 0.012), hypo(x, y, z), 0.012);
    d = smin(d, wrist(x, y, z), 0.014);
    d = smin(d, tendons(x, y, z), 0.004);
    d = smin(d, fingers(x, y, z), 0.0065);
    d = smin(d, knuckles(x, y, z), 0.004);
    return smin(d, thumb(x, y, z), 0.011);
  };
  const src = [[palm, [['hand', 1]]], [hypo, [['hand', 1]]], [thenar, [['hand', 0.5], ['thumb1', 0.5]]], [wrist, null], [tendons, [['hand', 1]]]];
  for (const c of caps) src.push([(x, y, z) => sdCone(x, y, z, c[0], c[1], c[2], c[3]), [[c[4], 1]]]);
  tcaps.forEach((c, i) => src.push([(x, y, z) => sdCone(x, y, z, c[0], c[1], c[2], c[3]), i === 0 ? [['thumb1', 0.75], ['hand', 0.25]] : [['thumb2', 1]]]));
  FINGERS.forEach((fg, i) => {
    const [ca, ra] = knuck[i * 2], [cb, rb] = knuck[i * 2 + 1];
    src.push([(x, y, z) => ell(x, y, z, ca, ra), [['hand', 0.7], ['f' + fg.n + '1', 0.3]]]);
    src.push([(x, y, z) => ell(x, y, z, cb, rb), [['f' + fg.n + '1', 0.5], ['f' + fg.n + '2', 0.5]]]);
  });
  const nailAt = (x, y, z) => {
    let m = 0;
    for (const t of tips) {
      const rel = [x - t.a[0], y - t.a[1], z - t.a[2]];
      const along = vdot(rel, t.dir) / vlen(vsub(t.b, t.a));
      if (along < 0.25 || along > 1.25) continue;
      const up = vdot(vnorm(rel), t.up);
      m = Math.max(m, sstep(0.35, 0.65, up) * sstep(0.28, 0.42, along) * (1 - sstep(1.02, 1.15, along)));
    }
    return m;
  };
  return { f, src, nailAt };
}

function handPiece(HAND, hand, S, WH, KEYS, NK, cav) {
  const nvH = hand.P.length / 3;
  const pc = S === 'R' ? { P: hand.P.slice(), N: hand.N.slice(), I: hand.I.slice(), UV: null } : mirrorPiece(hand);
  pc.SI = new Uint16Array(nvH * 4);
  pc.SW = new Float32Array(nvH * 4);
  pc.X = new Float32Array(nvH * 4);
  const map = KEYS.map((k) => BI[k + S]);
  const row = new Float32Array(NBB);
  for (let v = 0; v < nvH; v++) {
    row.fill(0);
    for (let k = 0; k < NK; k++) row[map[k]] += WH[v * NK + k];
    top4(row, pc.SI, pc.SW, v * 4);
    const x = hand.P[v * 3], y = hand.P[v * 3 + 1], z = hand.P[v * 3 + 2];
    const back = sstep(0.2, 0.7, hand.N[v * 3]);
    let kn = 0;
    for (const f of FINGERS) kn = Math.max(kn, Math.exp(-((x - 0.009) ** 2 + (y - f.k[1] - 0.001) ** 2 + (z - f.k[2]) ** 2) / 0.00005));
    pc.X[v * 4] = cav ? cav[v] : kn * back;
    pc.X[v * 4 + 1] = 2;
    pc.X[v * 4 + 2] = sstep(-0.2, -0.65, hand.N[v * 3]);
    pc.X[v * 4 + 3] = HAND.nailAt(x, y, z);
  }
  const m = BINDM.M[BI['hand' + S]];
  xform(pc, m);
  return pc;
}
function handWeights(HAND, hand) {
  const nvH = hand.P.length / 3;
  const KEYS = ['hand', 'twist', 'thumb1', 'thumb2'];
  for (const f of FINGERS) KEYS.push('f' + f.n + '1', 'f' + f.n + '2');
  const NK = KEYS.length, kIdx = {};
  KEYS.forEach((k, i) => { kIdx[k] = i; });
  const WH = new Float32Array(nvH * NK), dd = new Float32Array(HAND.src.length);
  for (let v = 0; v < nvH; v++) {
    const x = hand.P[v * 3], y = hand.P[v * 3 + 1], z = hand.P[v * 3 + 2];
    let dmin = 1e3;
    for (let i = 0; i < HAND.src.length; i++) { dd[i] = HAND.src[i][0](x, y, z); dmin = Math.min(dmin, dd[i]); }
    let tot = 0;
    for (let i = 0; i < HAND.src.length; i++) {
      const a = Math.exp(-Math.max(0, dd[i] - dmin) / 0.0045);
      if (a < 1e-3) continue;
      const tw = sstep(-0.01, 0.03, y);
      const shares = HAND.src[i][1] || [['twist', tw], ['hand', 1 - tw]];
      for (const [k, w] of shares) WH[v * NK + kIdx[k]] += a * w;
      tot += a;
    }
    for (let k = 0; k < NK; k++) WH[v * NK + k] /= tot || 1;
  }
  smoothWeights(WH, nvH, NK, hand.I, 1);
  return { WH, KEYS, NK };
}

function humanPrims(look) {
  const L = Object.assign({ build: 0.4, seed: 1 }, look || {});
  const R = rng(L.seed * 13 + 5);
  const ph = [R() * 6, R() * 6, R() * 6, R() * 6, R() * 6, R() * 6];
  const bw = lerp(0.94, 1.08, L.build);
  const prims = [];
  const P = (p, tag) => { p.tag = tag; prims.push(p); return p; };
  const shirtDisp = (x, y, z) => {
    const th = Math.atan2(x, -(z - 0.01));
    return 0.0026 * Math.sin(th * 7 + 2.5 * Math.sin(y * 11 + ph[0]) + ph[1]) * sstep(0.12, 0.2, y) * (1 - sstep(0.4, 0.48, y))
      + 0.003 * Math.sin(th * 15 + ph[2]) * Math.exp(-(((y - 0.16) / 0.03) ** 2));
  };
  P(primTorso([
    [0.10, 0.170 * bw, 0.112, 0.120, 2.3, 0.008],
    [0.20, 0.176 * bw, 0.120, 0.120, 2.4, 0.006],
    [0.28, 0.180 * bw, 0.124, 0.120, 2.45, 0.004],
    [0.36, 0.182 * bw, 0.118, 0.118, 2.45, 0.004],
    [0.43, 0.172 * bw, 0.100, 0.108, 2.3, 0.006],
    [0.49, 0.140 * bw, 0.080, 0.092, 2.1, 0.010],
    [0.53, 0.070, 0.058, 0.066, 2.0, 0.016],
  ], trunkW, { k: 0.03, sig: 0.03, trunk: true }, shirtDisp), 'shirt');
  P(primTorso([
    [0.00, 0.172 * bw, 0.112, 0.124, 2.3, 0.010],
    [0.04, 0.176 * bw, 0.116, 0.124, 2.3, 0.010],
    [0.08, 0.176 * bw, 0.118, 0.122, 2.3, 0.009],
    [0.12, 0.172 * bw, 0.116, 0.120, 2.3, 0.008],
  ], trunkW, { k: 0.008, sig: 0.03, trunk: true }, (x, y, z) => 0.002 * Math.sin(y * 170 + 2 * Math.sin(Math.atan2(x, z) * 3))), 'sash');
  const vrakaDisp = (x, y, z) => {
    const th = Math.atan2(x, -(z - 0.02));
    return 0.0045 * Math.sin(th * 8 + 3 * Math.sin(y * 9 + ph[3]) + ph[4]) * sstep(-0.35, -0.2, y) * (1 - sstep(-0.02, 0.05, y));
  };
  P(primTorso([
    [-0.16, 0.14 * bw, 0.11, 0.13, 2.1, 0.025],
    [-0.08, 0.195 * bw, 0.125, 0.155, 2.3, 0.02],
    [0.02, 0.186 * bw, 0.12, 0.136, 2.3, 0.012],
    [0.06, 0.175 * bw, 0.114, 0.126, 2.3, 0.010],
  ], WMIX([[B_.pelvis, 0.9], [B_.spine1, 0.1]]), { k: 0.04, sig: 0.03, trunk: true }, vrakaDisp), 'vraka');
  P(primEllipsoid([0, -0.29, 0.055], [0.058, 0.13, 0.072], null, WMIX([[B_.pelvis, 0.6], [B_.thighR, 0.2], [B_.thighL, 0.2]]), { k: 0.045, sig: 0.03 }), 'vraka');
  P(primEllipsoid([0, -0.47, -0.07], [0.034, 0.16, 0.07], null, W1(B_.pelvis), { k: 0.02, sub: true }), 'vraka');
  for (const S of SIDES) {
    const s = S === 'R' ? 1 : -1;
    P(primEllipsoid([s * 0.152, 0.438, 0.004], [0.066, 0.066, 0.08], null, WMIX([[B_.chest, 0.4], [B_['clav' + S], 0.3], [B_['shH' + S], 0.3]]), { k: 0.04, sig: 0.03, trunk: true }), 'shirt');
    const sh = J('uarm' + S), el = J('farm' + S), wr = J('hand' + S);
    P(primLimb(vmad(sh, AX('uarm' + S, 1), 0.02), el, AX('uarm' + S, 0), AX('uarm' + S, 2),
      [[0, 0.062 * bw, 0.066 * bw, 0, 0], [0.4, 0.058 * bw, 0.060 * bw, 0, 0.002], [0.8, 0.054 * bw, 0.056 * bw, 0, 0], [1, 0.052, 0.054, 0, 0]],
      limbW(S, 'uarm'), { k: 0.025, sig: 0.02 },
      (t, ang, sl) => 0.0025 * Math.sin(ang * 3 + sl * 30 + ph[5]) * sstep(0.1, 0.3, t) * (1 - sstep(0.7, 0.85, t))), 'shirt');
    P(primTorus(vlerp(sh, el, 0.93), AX('uarm' + S, 1), 0.050 * bw, 0.012, WMIX([[B_['uarm' + S], 0.6], [B_['elH' + S], 0.4]]), { k: 0.012, sig: 0.02 }), 'shirt');
    const fx = AX('farm' + S, 0), fz = AX('farm' + S, 2);
    P(primLimb(el, vmad(wr, AX('farm' + S, 1), -4e-3), fx, fz,
      [[0, 0.040 * bw, 0.042 * bw, 0, 0], [0.18, 0.043 * bw, 0.040 * bw, s * 0.002, 0.002], [0.45, 0.037 * bw, 0.034 * bw, s * 0.001, 0], [0.8, 0.028, 0.024, 0, 0], [1, 0.0245, 0.0205, 0, 0]],
      limbW(S, 'farm'), { k: 0.02, sig: 0.02 }), 'skin');
    const hp = J('thigh' + S), kn = J('shin' + S), an = J('foot' + S);
    P(primLimb(vadd(hp, [0, 0.03, 0]), vadd(kn, [0, -0.07, 0]), AX('thigh' + S, 0), AX('thigh' + S, 2),
      [[0, 0.108 * bw, 0.118, s * 0.012, 0.01], [0.3, 0.104 * bw, 0.114, s * 0.01, 0.012], [0.65, 0.094 * bw, 0.1, s * 0.004, 0.008], [0.86, 0.078, 0.082, 0, 0.004], [0.93, 0.056, 0.058, 0, 0], [1, 0.050, 0.052, 0, 0]],
      limbW(S, 'thigh'), { k: 0.03, sig: 0.022 },
      (t, ang, sl) => 0.005 * Math.sin(ang * 5 + 2.4 * Math.sin(sl * 6 + ph[s > 0 ? 1 : 2]) + s) * sstep(0.1, 0.3, t) * (1 - sstep(0.75, 0.9, t))
        + 0.003 * Math.sin(ang * 14 + ph[0]) * sstep(0.84, 0.92, t)), 'vraka');
    const sx = AX('shin' + S, 0), sz = AX('shin' + S, 2);
    P(primLimb(vadd(kn, [0, -0.04, 0]), vadd(an, [0, 0.012, 0]), sx, sz,
      [[0, 0.042, 0.046, 0, 0.006], [0.25, 0.045 * bw, 0.050 * bw, 0, 0.012], [0.55, 0.036, 0.040, 0, 0.008], [0.85, 0.026, 0.029, 0, 0.003], [1, 0.025, 0.028, 0, 0]],
      limbW(S, 'shin'), { k: 0.02, sig: 0.02 }), 'skin');
    const fm = BINDM.M[BI['foot' + S]];
    const fp = (p) => { const v = new THREE.Vector3(p[0] * s, p[1], p[2]).applyMatrix4(fm); return [v.x, v.y, v.z]; };
    const FW = W1(B_['foot' + S]), TW = WMIX([[B_['toe' + S], 0.8], [B_['foot' + S], 0.2]]);
    P(primEllipsoid(fp([0, -0.042, 0.035]), [0.030, 0.030, 0.036], null, FW, { k: 0.02, sig: 0.015 }), 'skin');
    P(primCone(fp([0, -0.035, 0.03]), fp([0.004, -0.052, -0.11]), 0.028, 0.035, FW, { k: 0.02, sig: 0.015 }), 'skin');
    P(primEllipsoid(fp([0.004, -0.052, -0.118]), [0.042, 0.018, 0.022], null, WMIX([[B_['foot' + S], 0.6], [B_['toe' + S], 0.4]]), { k: 0.015, sig: 0.012 }), 'skin');
    for (let i = 0; i < 5; i++) {
      const tx = 0.026 - i * 0.0135 + (i === 0 ? -4e-3 : 0), len = [0.036, 0.030, 0.027, 0.024, 0.02][i], r = [0.0115, 0.008, 0.0075, 0.007, 0.0065][i];
      P(primCone(fp([tx, -0.056, -0.125]), fp([tx * 1.05, -0.06, -0.125 - len]), r, r * 0.9, TW, { k: 0.004, sig: 0.01 }), 'skin');
    }
    for (const sx2 of [1, -1]) P(primEllipsoid(fp([sx2 * 0.024, -2e-3, 0.012]), [0.012, 0.014, 0.014], null, FW, { k: 0.014, sig: 0.012 }), 'skin');
  }
  return prims;
}

const K = {
  TWILL: 0, SKIN: 1, COPPER: 2, BRASS: 3, GUNMETAL: 4, RUBBER: 5, LEATHER: 6, LEAD: 7, ROPE: 8,
  EYE: 9, WOOD: 11, KNIT: 12, NET: 13, CLOTH: 14, TIN: 15};
const COL = {
  copper: [0.33, 0.135, 0.058], brass: [0.52, 0.36, 0.085], gun: [0.30, 0.20, 0.08], tin: [0.40, 0.40, 0.37],
  rubber: [0.085, 0.03, 0.017], leather: [0.052, 0.027, 0.012], belt: [0.105, 0.046, 0.017], lead: [0.09, 0.095, 0.1], twill: [0.47, 0.35, 0.20], rope: [0.55, 0.40, 0.18], jersey: [0.018, 0.024, 0.052], skin: [0.27, 0.125, 0.065]};
const MAT = {
  twill: [0.9, 0, 1, K.TWILL], rubber: [0.6, 0, 1, K.RUBBER], copper: [0.5, 1, 0, K.COPPER], brass: [0.45, 1, 0, K.BRASS],
  gun: [0.5, 1, 0, K.GUNMETAL], tin: [0.5, 1, 0, K.TIN], leather: [0.7, 0, 1, K.LEATHER], lead: [0.75, 0.3, 0.4, K.LEAD],
  rope: [0.95, 0, 0.5, K.ROPE], wood: [0.8, 0, 0.6, K.WOOD], net: [0.9, 0, 0.5, K.NET], skin: [0.5, 0, 0.6, K.SKIN], eye: [0.1, 0, 1, K.EYE]};

const DENTS = [[0.55, 0.74, 0.012, 0.022, 0.0026], [-0.95, 0.70, 0.010, 0.028, 0.0032], [2.6, 0.79, 0.009, 0.02, 0.002], [-2.2, 0.61, 0.012, 0.024, 0.0024], [1.7, 0.66, 0.01, 0.018, 0.0018]];
function bonnetDisp(th, y) {
  let d = 0;
  for (const [a, yy, , w, depth] of DENTS) {
    const r = bonnetR(yy);
    const dx = Math.atan2(Math.sin(th - a), Math.cos(th - a)) * r, dy = y - yy;
    d -= depth * Math.exp(-(dx * dx + dy * dy) / (w * w));
  }
  d += 0.00045 * (vnoise3(Math.cos(th) * 36, y * 36, Math.sin(th) * 36, 5) - 0.5);
  return d;
}
const LIGHTS = [
  { dir: [0, 0, -1], y: LIGHT_Y, clr: FRONT_CLR, fr: FRONT_FR, front: true },
  { dir: vnorm([Math.sin(SIDE_ANG), -Math.sin(SIDE_DIP), -Math.cos(SIDE_ANG)]), y: LIGHT_Y + 0.004, clr: SIDE_CLR, fr: SIDE_FR },
  { dir: vnorm([-Math.sin(SIDE_ANG), -Math.sin(SIDE_DIP), -Math.cos(SIDE_ANG)]), y: LIGHT_Y + 0.004, clr: SIDE_CLR, fr: SIDE_FR },
];
const INLET_TH = Math.PI + 0.12, INLET_Y = 0.742;
const VALVE_TH = Math.PI - 0.62, VALVE_Y = 0.648;
const SPIT_TH = 0.62, SPIT_Y = 0.604;
const onBonnet = (th, y, off = 0) => { const r = bonnetR(y) + off; return [Math.sin(th) * r, y, HZ - Math.cos(th) * r]; };
const bonnetN = (th, y) => {
  const e = 0.002, r0 = bonnetR(y - e), r1 = bonnetR(y + e), dr = (r1 - r0) / (2 * e);
  return vnorm([Math.sin(th), -dr, -Math.cos(th)]);
};

function buildHelmet(B, seg, low) {
  const CB = BI.cors, PB = BI.plate;
  const out = {};
  const NU = seg(128), NV = seg(56);
  const prof = BONNET_PROF;
  const y0 = prof[0][1], y1 = prof[prof.length - 1][1];
  LIGHTS.map((L) => ({ d: L.dir, c: [L.dir[0] * 0.1, L.y, HZ + L.dir[2] * 0.1], cos: 0, r: L.clr + 0.006 }));
  const bon = gridIJ(NU, NV, (i, j) => {
    const th = (i / NU) * TAU, v = j / NV;
    const y = y0 + (y1 - y0) * (0.5 - 0.5 * Math.cos(Math.PI * v)) * 0.98 + (y1 - y0) * 0.02 * v;
    const r = Math.max(0, bonnetR(y) + bonnetDisp(th, y) * sstep(y1, y1 - 0.02, y));
    return [Math.sin(th) * r, y, HZ - Math.cos(th) * r, th * 0.16, y];
  });
  {
    const I = bon.I, keep = [];
    const inHole = (x, y, z) => {
      for (let k = 0; k < LIGHTS.length; k++) {
        const L = LIGHTS[k];
        const px = x, py = y - L.y, pz = z - HZ;
        const along = px * L.dir[0] + py * L.dir[1] + pz * L.dir[2];
        if (along < 0.05) continue;
        const qx = px - L.dir[0] * along, qy = py - L.dir[1] * along, qz = pz - L.dir[2] * along;
        if (Math.hypot(qx, qy, qz) < L.clr + 0.004) return true;
      }
      return false;
    };
    const P = bon.P;
    for (let t = 0; t < I.length; t += 3) {
      const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3;
      const cx = (P[a] + P[b] + P[c]) / 3, cy = (P[a + 1] + P[b + 1] + P[c + 1]) / 3, cz = (P[a + 2] + P[b + 2] + P[c + 2]) / 3;
      if (!inHole(cx, cy, cz)) keep.push(I[t], I[t + 1], I[t + 2]);
    }
    bon.I = Uint32Array.from(keep);
  }
  const feat = [];
  for (const L of LIGHTS) feat.push({ c: [L.dir[0] * bonnetR(L.y), L.y, HZ + L.dir[2] * bonnetR(L.y)], r: L.fr + 0.003, w: 0.0045 });
  feat.push({ c: onBonnet(INLET_TH, INLET_Y), r: 0.026, w: 0.005 }, { c: onBonnet(VALVE_TH, VALVE_Y), r: 0.026, w: 0.005 }, { c: onBonnet(SPIT_TH, SPIT_Y), r: 0.01, w: 0.004 });
  const creviceAt = (p) => {
    let c = sstep(y0 + 0.01, y0, p[1]) * 0.9;
    for (const f of feat) {
      const d = vlen(vsub(p, f.c)) - f.r;
      c = Math.max(c, Math.exp(-Math.max(0, d) / f.w) * (d > -4e-3 ? 1 : 0));
    }
    return c;
  };
  const wearAt = (p, n) => {
    const crown = sstep(0.4, 0.95, n[1]);
    const grip = Math.exp(-((p[0] - 0.07) ** 2 + (p[1] - 0.80) ** 2 + (p[2] - 0.03) ** 2) / 0.0016);
    return clamp(crown * 0.6 + grip, 0, 1);
  };
  B.add(bon, { col: COL.copper, mat: MAT.copper, aux: (q) => [creviceAt(q.p), 3, wearAt(q.p, q.n), 0], skin: CB, tag: 'bonnet', inside: [0, 0.7, HZ] });
  {
    const inner = lathe(prof.map(([r, y]) => [Math.max(0, r - 0.004), y]), seg(48));
    xform(inner, T3(0, 0, HZ));
    B.add(inner, { col: [0.05, 0.03, 0.02], mat: [0.8, 0.3, 0, K.COPPER], aux: [1, 4, 0, 0], skin: CB, tag: 'bonnet-in', inside: [0, 0.7, HZ], invert: true });
  }
  const bead = (pts, r, n0) => {
    const pc = tubeAlong(pts, (s, tot, a) => r * (0.8 + 0.35 * vnoise3(s * 160, a, 0, 9)), 5, n0);
    B.add(pc, { col: COL.tin, mat: MAT.tin, aux: [0.6, 5, 0.3, 0], skin: CB, tag: 'solder' });
  };
  {
    const pts = [];
    for (let k = 0; k <= seg(72); k++) { const th = (k / seg(72)) * TAU; pts.push(onBonnet(th, 0.598, 0.0006)); }
    bead(pts, 0.0017);
  }
  const glassParts = [];
  LIGHTS.forEach((L, li) => {
    const d = L.dir, up0 = [0, 1, 0];
    const xAx = vnorm(vcross(up0, d)), yAx = vcross(d, xAx);
    const baseR = bonnetR(L.y);
    const planeD = L.front ? -(FRONT_Z - HZ) : baseR + 0.012;
    const center = [0, L.y, HZ];
    const at = (u, v, dd) => vadd(vadd(vadd(center, vmul(xAx, u)), vmul(yAx, v)), vmul(d, dd));
    const nA = seg(L.front ? 64 : 48);
    const collarR = L.clr + 0.012;
    const surfD = (u, v) => {
      let lo = 0.05, hi = 0.25;
      for (let it = 0; it < 24; it++) {
        const m = 0.5 * (lo + hi), p = at(u, v, m);
        const r = Math.hypot(p[0], p[2] - HZ);
        if (r < bonnetR(p[1])) lo = m; else hi = m;
      }
      return lo;
    };
    const rows = [];
    for (const [rr, dd0] of [[collarR + 0.006, -4e-3], [collarR + 0.004, 0.0], [collarR, 0.3], [collarR, 0.7], [collarR - 0.0015, 1], [L.clr + 0.0015, 1], [L.clr + 0.0015, 2]]) {
      const ring = [];
      for (let k = 0; k <= nA; k++) {
        const a = (k / nA) * TAU, u = Math.cos(a) * rr, v = Math.sin(a) * rr;
        const sd = surfD(u, v);
        ring.push(at(u, v, dd0 < 0 ? sd + dd0 : dd0 > 1.5 ? sd - 0.012 : lerp(sd, planeD - 0.004, dd0)));
      }
      rows.push(ring);
    }
    const collar = gridIJ(nA, rows.length - 1, (i, j) => [...rows[j][i], i / nA, j]);
    B.add(collar, { col: COL.copper, mat: MAT.copper, aux: (q) => [q.v < 1.5 ? 0.8 : 0.2, 3, q.v > 3 ? 0.6 : 0.1, 0], skin: CB, tag: 'collar', inside: at(0, 0, planeD * 0.6) });
    bead(rows[1].map((p) => vadd(p, vmul(d, 0.0005))), 0.0018);
    const fr = L.fr, bone = L.front ? PB : CB;
    const rp = [];
    const ringProf = L.front ? [[L.clr - 0.002, -3e-3], [L.clr - 0.002, 0.009], [L.clr + 0.003, 0.0145], [fr - 0.013, 0.0175], [fr - 0.003, 0.0165], [fr + 0.002, 0.0115], [fr + 0.002, 0.001], [fr - 0.002, -4e-3]]
      : [[L.clr - 0.001, 0.0], [L.clr - 0.001, 0.006], [L.clr + 0.002, 0.009], [fr - 0.012, 0.011], [fr - 0.004, 0.0105], [fr, 0.007], [fr, 0.002], [fr - 0.003, -2e-3]];
    for (const [r, h] of ringProf) rp.push([r, h]);
    const ringG = lathe(rp, seg(L.front ? 72 : 56));
    const M = basis(at(0, 0, planeD - 0.004), xAx, d, vmul(yAx, -1));
    xform(ringG, M);
    const rimWear = (q) => sstep(fr - 0.016, fr - 0.004, Math.hypot(q.p[0] - M.elements[12], q.p[1] - M.elements[13], q.p[2] - M.elements[14]));
    B.add(ringG, { col: COL.gun, mat: MAT.gun, aux: (q) => [0.25, 6, rimWear(q) * 0.8, 0], skin: bone, tag: 'frame' });
    const nS = L.front ? 0 : 6;
    for (let k = 0; k < nS; k++) {
      const a = (k / nS) * TAU + 0.3;
      const c = at(Math.cos(a) * (fr - 0.007), Math.sin(a) * (fr - 0.007), planeD + 0.007);
      const sc = lathe([[0, 0], [0.0042, 0], [0.0042, 0.0018], [0.0032, 0.0032], [0, 0.0034]], seg(10));
      xform(sc, orient(c, d));
      B.add(sc, { col: COL.brass, mat: MAT.brass, aux: [0.4, 7, 0.5, 0], skin: bone, tag: 'screws' });
    }
    if (L.front) {
      for (let k = 0; k < 4; k++) {
        const a = (k / 4) * TAU + Math.PI / 4;
        const c = at(Math.cos(a) * (fr + 0.007), Math.sin(a) * (fr + 0.007), planeD + 0.008);
        const lug = rbox(0.011, 0.008, 0.009, 0.003);
        xform(lug, basis(c, vnorm(vadd(vmul(xAx, Math.cos(a)), vmul(yAx, Math.sin(a)))), vcross(d, vnorm(vadd(vmul(xAx, Math.cos(a)), vmul(yAx, Math.sin(a))))), d));
        B.add(lug, { col: COL.gun, mat: MAT.gun, aux: [0.2, 6, 0.9, 0], skin: PB, tag: 'lugs' });
      }
      const hx = HINGE;
      for (const [dy, bone2] of [[-0.03, CB], [0, PB], [0.03, CB]]) {
        const kn = cyl(0.0085, 0.0085, 0.024, seg(14));
        xform(kn, T3(hx[0], hx[1] + dy - 0.011, hx[2]));
        B.add(kn, { col: COL.gun, mat: MAT.gun, aux: [0.5, 6, 0.4, 0], skin: bone2, tag: 'hinge' });
      }
      const pin = cyl(0.0028, 0.0028, 0.082, seg(8));
      xform(pin, T3(hx[0], hx[1] - 0.041, hx[2]));
      B.add(pin, { col: COL.brass, mat: MAT.brass, aux: [0.2, 7, 0.6, 0], skin: CB, tag: 'hinge' });
      const leaf = rbox(0.017, 0.015, 0.005, 0.002);
      xform(leaf, T3(hx[0] - 0.013, hx[1], hx[2] - 0.001));
      B.add(leaf, { col: COL.gun, mat: MAT.gun, aux: [0.3, 6, 0.5, 0], skin: PB, tag: 'hinge' });
      const wing = rbox(0.004, 0.012, 0.0035, 0.0015);
      xform(wing, T3(-fr - 0.004, L.y, FRONT_Z + 0.006));
      B.add(wing, { col: COL.brass, mat: MAT.brass, aux: [0.2, 7, 0.9, 0], skin: CB, tag: 'hinge' });
      const boss = cyl(0.006, 0.006, 0.012, seg(10));
      xform(boss, orient([-fr - 0.004, L.y, FRONT_Z - 0.004], [0, 0, -1]));
      B.add(boss, { col: COL.gun, mat: MAT.gun, aux: [0.4, 6, 0.4, 0], skin: CB, tag: 'hinge' });
    }
    const gl = gridIJ(seg(40), 6, (i, j) => {
      const a = (i / seg(40)) * TAU, rr = (j / 6) * (L.clr + 0.002);
      const dome = 0.003 * (1 - (rr / (L.clr + 0.002)) ** 2);
      const p = at(Math.cos(a) * rr, Math.sin(a) * rr, planeD + 0.003 + dome);
      return [p[0], p[1], p[2], Math.cos(a) * rr / L.clr, Math.sin(a) * rr / L.clr];
    });
    flipWinding(gl);
    let glP = gl;
    if (L.front) {
      const n40 = seg(40), R0 = L.clr + 0.002;
      const back = gridIJ(n40, 1, (i, j) => { const a = (i / n40) * TAU, rr = j ? R0 : 0; const p = at(Math.cos(a) * rr, Math.sin(a) * rr, planeD - 0.007); return [p[0], p[1], p[2], Math.cos(a) * rr / L.clr, Math.sin(a) * rr / L.clr]; });
      const edge = gridIJ(n40, 1, (i, j) => { const a = (i / n40) * TAU; const p = at(Math.cos(a) * R0, Math.sin(a) * R0, j ? planeD + 0.003 : planeD - 0.007); return [p[0], p[1], p[2], Math.cos(a) * 1.02, Math.sin(a) * 1.02]; });
      glP = merge([gl, back, edge]);
    }
    glP.bone = bone;
    glP.front = !!L.front;
    glassParts.push(glP);
    if (L.front) out.frontCenter = at(0, 0, planeD + 0.003);
  });
  for (const [th, y, n] of [[0.0, 0.833, [0, 1, 0]], [Math.PI, 0.79, null]]) {
    const p = onBonnet(th, y, 0.001), nn = n || bonnetN(th, y);
    const eye = torus(0.009, 0.0026, seg(16), 6);
    xform(eye, basis(vmad(p, nn, 0.008), [1, 0, 0], vcross(nn, [1, 0, 0]), nn).multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2)));
    B.add(eye, { col: COL.gun, mat: MAT.gun, aux: [0.3, 6, 0.5, 0], skin: CB, tag: 'eyes' });
    const foot = lathe([[0.012, 0], [0.011, 0.002], [0.006, 0.004], [0, 0.0045]], seg(12));
    xform(foot, orient(p, nn));
    B.add(foot, { col: COL.tin, mat: MAT.tin, aux: [0.5, 5, 0.3, 0], skin: CB, tag: 'eyes' });
  }
  {
    const p0 = onBonnet(INLET_TH, INLET_Y), n0 = bonnetN(INLET_TH, INLET_Y);
    const boss = lathe([[0.024, 0], [0.022, 0.004], [0.017, 0.008], [0.015, 0.014], [0, 0.015]], seg(20));
    xform(boss, orient(vmad(p0, n0, -3e-3), n0));
    B.add(boss, { col: COL.gun, mat: MAT.gun, aux: [0.6, 6, 0.3, 0], skin: CB, tag: 'inlet' });
    bead(smoothPath(Array.from({ length: 13 }, (_, k) => { const a = (k / 12) * TAU; const t1 = vnorm(vcross(n0, [0, 1, 0])), t2 = vcross(n0, t1); return vadd(vadd(p0, vmul(t1, Math.cos(a) * 0.0245)), vmul(t2, Math.sin(a) * 0.0245)); }), 40, false), 0.002);
    const back = vnorm([n0[0], 0, n0[2]]);
    const ctrl = [vmad(p0, n0, 0.006), vmad(p0, n0, 0.028), vadd(vmad(p0, n0, 0.048), [0, 0.024, 0]), vadd(vmad(p0, back, 0.07), [0, 0.04, 0]), vadd(vmad(p0, back, 0.092), [0, 0.056, 0])];
    const path = smoothPath(ctrl, seg(28));
    B.add(tubeAlong(path, () => 0.0158, seg(16)), { col: COL.gun, mat: MAT.gun, aux: [0.3, 6, 0.4, 0], skin: CB, tag: 'inlet' });
    const end = path[path.length - 1], dir = vnorm(vsub(end, path[path.length - 3]));
    const nut = lathe([[0.0, 0], [0.022, 0], [0.022, 0.024], [0.018, 0.028], [0, 0.028]], 6);
    xform(nut, orient(end, dir));
    B.add(nut, { col: COL.gun, mat: MAT.gun, aux: [0.3, 6, 0.8, 0], skin: CB, tag: 'inlet' });
    out.inlet = vmad(end, dir, 0.03);
    out.inletDir = dir;
    const nr = lathe([[0.0145, 0], [0.0155, 0.004], [0.0155, 0.02], [0.0145, 0.024]], seg(14));
    xform(nr, orient(path[Math.round(path.length * 0.45)], vnorm(vsub(path[Math.round(path.length * 0.45) + 1], path[Math.round(path.length * 0.45) - 1]))));
    B.add(nr, { col: COL.gun, mat: MAT.gun, aux: [0.3, 6, 0.5, 0], skin: CB, tag: 'inlet' });
  }
  {
    const p0 = onBonnet(VALVE_TH, VALVE_Y), n0 = bonnetN(VALVE_TH, VALVE_Y);
    const body = lathe([[0.025, -3e-3], [0.024, 0.002], [0.02, 0.006], [0.019, 0.022], [0.021, 0.025], [0.021, 0.03], [0.017, 0.034], [0.009, 0.036], [0.0, 0.037]], seg(20));
    xform(body, orient(p0, n0));
    B.add(body, { col: COL.gun, mat: MAT.gun, aux: (q) => [0.4, 6, 0.3, 0], skin: CB, tag: 'valve' });
    const wheel = gridIJ(seg(36), 4, (i, j) => {
      const a = (i / seg(36)) * TAU, pr = [[0.0, 0.036], [0.028, 0.037], [0.028, 0.045], [0.022, 0.047], [0.0, 0.047]][j];
      const r = pr[0] * (1 + 0.06 * Math.cos(a * 14));
      return [r * Math.sin(a), pr[1], r * Math.cos(a), a * 0.028, pr[1]];
    });
    xform(wheel, orient(p0, n0));
    B.add(wheel, { col: COL.brass, mat: MAT.brass, aux: [0.3, 7, 0.8, 0], skin: CB, tag: 'valve' });
    bead(smoothPath(Array.from({ length: 13 }, (_, k) => { const a = (k / 12) * TAU; const t1 = vnorm(vcross(n0, [0, 1, 0])), t2 = vcross(n0, t1); return vadd(vadd(p0, vmul(t1, Math.cos(a) * 0.026)), vmul(t2, Math.sin(a) * 0.026)); }), 40, false), 0.0019);
    out.exhaust = vadd(vmad(p0, n0, 0.022), [0, -0.022, 0]);
  }
  {
    const p0 = onBonnet(SPIT_TH, SPIT_Y), n0 = bonnetN(SPIT_TH, SPIT_Y);
    const body = lathe([[0.0085, 0], [0.008, 0.012], [0.006, 0.016], [0.0048, 0.022], [0, 0.022]], seg(12));
    xform(body, orient(p0, n0));
    B.add(body, { col: COL.gun, mat: MAT.gun, aux: [0.4, 6, 0.4, 0], skin: CB, tag: 'spitcock' });
    const tip = vmad(p0, n0, 0.018);
    const lever = tubeAlong(smoothPath([tip, vadd(tip, [0.004, -0.012, -2e-3]), vadd(tip, [0.006, -0.024, -4e-3])], 8), (s, tot) => 0.0022 + 0.0035 * sstep(0.4, 1, s / tot) * (1 - sstep(0.9, 1, s / tot)), 6, null, true);
    B.add(lever, { col: COL.brass, mat: MAT.brass, aux: [0.2, 7, 0.9, 0], skin: CB, tag: 'spitcock' });
    out.spitcock = vmad(p0, n0, 0.02);
  }
  {
    const ring = lathe([[0.1235, 0.548], [0.1275, 0.550], [0.1285, 0.556], [0.1265, 0.559], [0.1265, 0.563], [0.1275, 0.566], [0.1245, 0.570], [0.1195, 0.572]], seg(96));
    B.add(ring, { col: COL.gun, mat: MAT.gun, aux: (q) => [0.5, 6, sstep(0.555, 0.566, q.p[1]) * 0.6, 0], skin: CB, tag: 'neckring' });
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * TAU + 0.13, p = [Math.sin(a) * 0.1285, 0.561, HZ - Math.cos(a) * 0.1285];
      const lug = rbox(0.009, 0.0022, 0.0022, 0.001);
      xform(lug, basis(p, [Math.cos(a), 0, Math.sin(a)], [0, 1, 0], [Math.sin(a), 0, -Math.cos(a)]));
      B.add(lug, { col: COL.gun, mat: MAT.gun, aux: [0.6, 6, 0.4, 0], skin: CB, tag: 'neckring' });
    }
    const lp = [0, 0.556, HZ + 0.131];
    const latch = rbox(0.011, 0.012, 0.0035, 0.002);
    xform(latch, T3(lp[0], lp[1], lp[2]));
    B.add(latch, { col: COL.brass, mat: MAT.brass, aux: [0.4, 7, 0.6, 0], skin: CB, tag: 'lock' });
    const lpin = cyl(0.0024, 0.0024, 0.018, seg(8));
    xform(lpin, orient([0.009, 0.56, HZ + 0.134], [-1, 0, 0]));
    B.add(lpin, { col: COL.brass, mat: MAT.brass, aux: [0.3, 7, 0.6, 0], skin: CB, tag: 'lock' });
  }
  {
    const NT = seg(104), NR = seg(20);
    const shell = gridIJ(NT, NR, (i, j) => {
      const th = (i / NT) * TAU, u = j / NR;
      const p = corsAt(th, u);
      return [p[0], p[1], p[2], th * 0.2, u];
    });
    B.add(shell, { col: COL.copper, mat: MAT.copper, aux: (q) => [sstep(0.04, 0.0, q.v) * 0.8 + sstep(0.94, 1.0, q.v) * 0.6, 8, sstep(0.3, 0.7, q.v) * sstep(0.5, 0.9, Math.abs(Math.sin(q.u * 5))) * 0.35, 0], skin: CB, tag: 'corselet', inside: [0, 0.3, HZ] });
    const rimPts = [];
    for (let k = 0; k <= NT; k++) {
      const th = (k / NT) * TAU;
      const p = corsAt(th, 1.0);
      rimPts.push(p);
    }
    B.add(tubeAlong(rimPts, () => 0.0042, seg(8)), { col: COL.copper, mat: MAT.copper, aux: [0.5, 8, 0.8, 0], skin: CB, tag: 'corselet' });
    const coll = gridIJ(NT, 4, (i, j) => {
      const th = (i / NT) * TAU;
      const p = corsAt(th, 1.0), q = corsAt(th, 0.93);
      const out2 = vnorm(vsub(p, q));
      const sc = Math.abs(Math.sin(th * 6)) ** 0.7;
      const dd = [0.0, 0.007, 0.012, 0.014, 0.012][j], down = [-6e-3, -0.012, -0.016, -0.02, -0.024][j];
      const wav = (0.0022 * sc + 0.0005 * Math.sin(th * 23)) * (j / 4);
      return [p[0] + out2[0] * (dd + wav), p[1] + down - 0.004 * sc * (j / 4) ** 1.5, p[2] + out2[2] * (dd + wav), th * 0.2, j * 0.01];
    });
    B.add(coll, { col: COL.rubber, mat: MAT.rubber, aux: [0.6, 9, 0.2, 0], skin: CB, tag: 'collar-rubber', inside: [0, 0.3, HZ] });
    const studs = [];
    for (let k = 0; k < 12; k++) studs.push((k / 12) * TAU);
    for (let q = 0; q < 4; q++) {
      const c = (q / 4) * TAU, half = 42 * DEG, nb = seg(28);
      const path = [];
      for (let k = 0; k <= nb; k++) {
        const th = c - half + (2 * half * k) / nb;
        const p = corsAt(th, 0.955), n = vnorm(vcross(vsub(corsAt(th + 0.01, 0.955), corsAt(th - 0.01, 0.955)), vsub(corsAt(th, 0.99), corsAt(th, 0.92))));
        path.push({ p, n: vmul(n, -1) });
      }
      const br = ribbon(path, 0.03, 0.0045, 0.0015, false, 12);
      const L0 = br.arc[br.arc.length - 1];
      B.add(br, { col: COL.brass, mat: MAT.brass, aux: (qq) => [0.3, 10, sstep(0.009, 0.014, Math.abs(qq.v)) * 0.6 + sstep(L0 * 0.1, 0, Math.min(qq.u, L0 - qq.u)) * 0.5, 0], skin: CB, tag: 'brails' });
    }
    const R = rng(1901);
    out.studs = [];
    studs.forEach((th, k) => {
      const p = corsAt(th, 0.955);
      const n = vnorm(vcross(vsub(corsAt(th + 0.01, 0.955), corsAt(th - 0.01, 0.955)), vsub(corsAt(th, 0.99), corsAt(th, 0.92))));
      const nn = vmul(n, -1);
      const base = vmad(p, nn, 0.006);
      const stud = cyl(0.0033, 0.0033, 0.016, seg(8));
      xform(stud, orient(vmad(p, nn, 0.0), nn));
      B.add(stud, { col: COL.gun, mat: MAT.gun, aux: [0.7, 6, 0.3, 0], skin: CB, tag: 'studs' });
      const rot = (k === 7 ? 40 : (R() - 0.5) * 24) * DEG;
      const along = vnorm(vsub(corsAt(th + 0.02, 0.955), corsAt(th - 0.02, 0.955)));
      const wingDir = rotateAbout(along, nn, rot);
      const boss = lathe([[0.0095, 0], [0.0092, 0.0075], [0.007, 0.0105], [0, 0.011]], seg(10));
      xform(boss, orient(base, nn));
      B.add(boss, { col: COL.brass, mat: MAT.brass, aux: [0.8, 11, 0.5, 0], skin: CB, tag: 'wingnuts' });
      for (const s of [1, -1]) {
        const wing = rbox(0.0085, 0.0028, 0.007, 0.002);
        const c = vmad(vmad(base, nn, 0.0085), wingDir, s * 0.0135);
        xform(wing, basis(c, wingDir, vcross(nn, wingDir), nn));
        B.add(wing, { col: COL.brass, mat: MAT.brass, aux: [0.3, 11, 0.9, 0], skin: CB, tag: 'wingnuts' });
      }
      out.studs.push(base);
    });
    for (const s of [1, -1]) {
      const th = s * 0.52, a = corsAt(th, 0.55), b2 = corsAt(th, 0.75);
      const n = vnorm(vcross(vsub(corsAt(th + 0.01, 0.65), corsAt(th - 0.01, 0.65)), vsub(b2, a)));
      const nn = vmul(n, -1);
      const tp = [vmad(a, nn, 0.007), vmad(vlerp(a, b2, 0.5), nn, 0.009), vmad(b2, nn, 0.007)];
      B.add(tubeAlong(smoothPath(tp, 10), () => 0.0045, seg(10)), { col: COL.gun, mat: MAT.gun, aux: [0.6, 6, 0.4, 0], skin: CB, tag: 'tubes' });
      bead(smoothPath([vmad(a, nn, 0.002), vmad(vlerp(a, b2, 0.5), nn, 0.003), vmad(b2, nn, 0.002)], 12), 0.0022);
      if (s > 0) out.lifeline = vmad(vlerp(a, b2, 0.5), nn, 0.013);
    }
  }
  out.glassParts = glassParts;
  return out;
}

function buildBoots(B, seg, fSuit) {
  const out = {};
  const Z0 = 0.075, Z1 = -0.23;
  const SOLE_B = -0.115, SOLE_T = -0.074;
  const soleW = (z) => {
    const t = clamp((0.075 - z) / 0.305, 0, 1);
    return 0.047 + 0.012 * Math.sin(Math.PI * Math.min(1, t * 1.3)) - 0.014 * sstep(0.85, 1, t) - 0.006 * (1 - sstep(0, 0.12, t));
  };
  const outline = (k, n, grow) => {
    const u = k / n, zz = lerp(Z0, Z1, 0.5 - 0.5 * Math.cos(u * TAU));
    const endK = Math.max(sstep(0.08, 0, Math.min(u, 1 - u)), sstep(0.42, 0.5, u) * sstep(0.58, 0.5, u));
    return [(u < 0.5 ? 1 : -1) * (soleW(zz) + grow) * (1 - 0.65 * endK), zz];
  };
  const rocker = (z) => 0.0032 * sstep(-0.13, -0.235, z) ** 1.5 + 0.0018 * sstep(0.03, 0.082, z) ** 1.5;
  const yRim = (psi) => 0.087 - 0.006 * (0.5 - 0.5 * Math.cos(psi));
  for (const S of SIDES) {
    const s = S === 'R' ? 1 : -1, FB = BI['foot' + S], SB = BI['shin' + S];
    const XM = BINDM.M[FB].clone().multiply(new THREE.Matrix4().makeScale(s, 1, 1));
    const X = (pc) => xform(pc, XM);
    const inBoot = toBind('foot' + S, [0, -0.075, -0.075]);
    const add = (pc, o) => { if (s < 0) flipWinding(pc); B.add(X(pc), Object.assign({ inside: inBoot }, o)); };
    const kn = J('shin' + S);
    const knL = new THREE.Vector3(...kn).applyMatrix4(XM.clone().invert()), shU = knL.clone().normalize();
    const cx = (y) => (knL.x / knL.y) * y, cz = (y) => (knL.z / knL.y) * y;
    const NH = 9, NP = 32, LEG = new Float32Array(NH * NP), _q = new THREE.Vector3();
    for (let a = 0; a < NH; a++) for (let b = 0; b < NP; b++) {
      const y = 0.035 + 0.01 * a, psi = (b / NP) * TAU, dx = Math.sin(psi), dz = Math.cos(psi);
      let lo = 0.01, hi = 0.1;
      for (let k = 0; k < 20; k++) {
        const m = 0.5 * (lo + hi);
        _q.set(cx(y) + dx * m, y, cz(y) + dz * m).applyMatrix4(XM);
        if (fSuit(_q.x, _q.y, _q.z) < 0) lo = m; else hi = m;
      }
      LEG[a * NP + b] = 0.5 * (lo + hi);
    }
    const legR = (y, psi) => {
      const fa = clamp((y - 0.035) / 0.01, 0, NH - 1.0001), a = Math.floor(fa), ta = fa - a;
      const fb = ((((psi / TAU) % 1) + 1) % 1) * NP, b = Math.floor(fb) % NP, tb = fb - Math.floor(fb), b1 = (b + 1) % NP;
      return lerp(lerp(LEG[a * NP + b], LEG[a * NP + b1], tb), lerp(LEG[(a + 1) * NP + b], LEG[(a + 1) * NP + b1], tb), ta);
    };
    const clr = (y) => 0.0045 + 0.0045 * (1 - sstep(0.03, 0.075, y));
    const shaftPt = (psi, y) => { const R = legR(y, psi) + clr(y); return [cx(y) + Math.sin(psi) * R, y, cz(y) + Math.cos(psi) * R]; };
    const wfAt = (x, y, z) => {
      const ahead = cz(y) - z - legR(y, Math.PI), up = x * shU.x + y * shU.y + z * shU.z;
      return Math.max(1 - sstep(-0.01, 0.058, up), sstep(0.018, 0.045, ahead) * (1 - sstep(0.022, 0.042, y)));
    };
    const skinOf = (pc, wts = null) => {
      const nv = pc.P.length / 3;
      pc.SI = new Uint16Array(nv * 4); pc.SW = new Float32Array(nv * 4);
      for (let i = 0; i < nv; i++) {
        const wf = wts && wts[i] >= 0 ? wts[i] : wfAt(pc.P[i * 3], pc.P[i * 3 + 1], pc.P[i * 3 + 2]);
        pc.SI[i * 4] = FB; pc.SI[i * 4 + 1] = SB; pc.SW[i * 4] = wf; pc.SW[i * 4 + 1] = 1 - wf;
      }
      return pc;
    };

    {
      const rr = 0.004, grow = 0.004, NA = seg(44), NB = 4, zc = lerp(Z0, Z1, 0.5);
      const hs = [SOLE_B, SOLE_B + rr * 0.3, SOLE_B + rr, SOLE_T - rr, SOLE_T - rr * 0.3, SOLE_T];
      const inset = [rr, rr * 0.3, 0, 0, rr * 0.3, rr], lift = [1, 1, 1, 0, 0, 0];
      const at = (i, k, sc) => {
        const [x0, z0] = outline(i % NA, NA, grow), dz0 = z0 - zc, dl = Math.hypot(x0, dz0) || 1;
        return [(x0 - (x0 / dl) * k) * sc, zc + (dz0 - (dz0 / dl) * k) * sc];
      };
      const walls = gridIJ(NA, 5, (i, j) => { const [x, z] = at(i, inset[j], 1); return [x, hs[j] + lift[j] * rocker(z), z, (i / NA) * 0.7, hs[j]]; });
      const under = gridIJ(NA, NB, (i, j) => { const [x, z] = at(i, rr, j / NB); return [x, SOLE_B + rocker(z), z, x, z]; });
      const top = flipWinding(gridIJ(NA, 1, (i, j) => { const [x, z] = at(i, rr, j); return [x, SOLE_T, z, x, z]; }));
      const nW = walls.P.length / 3, nU = under.P.length / 3;
      const pc = merge([walls, under, top]), nv = pc.P.length / 3;
      pc.X = new Float32Array(nv * 4);
      for (let i = 0; i < nv; i++) {
        const x = pc.P[i * 3], y = pc.P[i * 3 + 1], z = pc.P[i * 3 + 2], bottom = i >= nW && i < nW + nU;
        const pads = Math.max(Math.exp(-(((z - 0.035) / 0.032) ** 2) - (x / 0.04) ** 2), Math.exp(-(((z + 0.15) / 0.042) ** 2) - (x / 0.045) ** 2));
        const edge = 1 - sstep(0, 0.006, y - SOLE_B - rocker(z));
        pc.X.set([0.3, 12, bottom ? pads : Math.max(0.5 * sstep(SOLE_T - 0.004, SOLE_T, y), 0.7 * edge), bottom ? 1 : 0], i * 4);
      }
      add(skinOf(pc), { col: COL.lead, mat: MAT.lead, tag: 'boots' });
    }

    const yJ = 0.048;
    const zR = cz(yRim(Math.PI)) - legR(yRim(Math.PI), Math.PI) - clr(yRim(Math.PI));
    const zT = Math.min(zR, cz(yJ) - legR(yJ, Math.PI) - clr(yJ));
    const uT = Math.acos(1 - 2 * ((Z0 - 0.004 - zR) / (Z0 - Z1 - 0.014))) / TAU;
    const ridgeY = (z) => yJ - (yJ - 0.021) * sstep(zT, -0.14, z) - 0.033 * sstep(-0.12, -0.22, z);
    const NU = seg(48), NV = seg(20);
    const capM = [];
    const upper = gridIJ(NU, NV, (i, j) => {
      const u = i / NU, v = j / NV, uu = Math.min(u, 1 - u);
      const zz = lerp(Z0 - 0.004, Z1 + 0.01, 0.5 - 0.5 * Math.cos(u * TAU));
      const side = clamp(Math.sin(u * TAU) / 0.2, -1, 1);
      const w0 = soleW(zz) - 0.001;
      const tFoot = clamp((Z0 - zz) / (Z0 - Z1), 0, 1);
      const endK = Math.max(sstep(0.08, 0, uu), sstep(0.42, 0.5, u) * sstep(0.58, 0.5, u));
      const bul = Math.sin(Math.PI * Math.min(1, v * 1.3)) * 0.006;
      const psi = (u < 0.5 ? 1 : -1) * Math.PI * clamp(uu / uT, 0, 1);
      const yr = lerp(SOLE_T - 0.001, yRim(psi), v);
      const sh = shaftPt(psi, yr), bl = sstep(-0.035, 0.03, yr);
      const wx = side * (w0 + 0.6 * bul) * (1 - 0.65 * endK);
      const xr = lerp(wx, sh[0], bl), zr = lerp(zz, sh[2], bl);
      const ridge = ridgeY(zz) - 0.004 * sstep(0.85, 1, tFoot);
      const a = v * Math.PI * 0.5;
      const xf = side * (w0 * (1 - 0.65 * endK) + bul) * Math.pow(Math.cos(a), 0.7);
      const yf = lerp(SOLE_T - 0.001, ridge, Math.sin(a));
      const zf = zz + 0.012 * v * v * sstep(0.8, 1, tFoot);
      const c = sstep(uT, uT + 0.045, uu);
      let x = lerp(xr, xf, c), z = lerp(zr, zf, c);
      let y = lerp(yr, yf, c);
      if (c > 0) {
        const k = sstep(yJ - 0.006, yJ + 0.004, y);
        if (k > 0) {
          y = lerp(y, Math.min(y, yJ + 0.003), k);
          const ax = x - cx(y), az = z - cz(y), r = Math.hypot(ax, az), R = legR(y, Math.atan2(ax, az)) + clr(y) - 0.0012;
          if (r > R) { const r2 = lerp(r, R, k); x = cx(y) + (ax / r) * r2; z = cz(y) + (az / r) * r2; }
        }
      }
      const capD = Z1 + 0.078 - z, f = sstep(-2e-3, 0.004, capD);
      capM.push(capD);
      x *= 1 + 0.035 * f;
      return [x, y + 0.002 * f, z - 0.002 * f, u * 0.7, v * 0.12];
    });
    const FP0 = Math.PI - 0.62, NFP = 496, FDP = 1.24 / NFP, FY0 = 0.03, NFY = 208, FDY = 0.00025;
    const reach = new Float32Array(NFP * NFY), reachT = new Int32Array(NFP * NFY).fill(-1), sideL = new Float32Array(NFY), sideR = new Float32Array(NFY);
    const UP = Float32Array.from(upper.P), UI = Uint32Array.from(upper.I);
    let yEnd = -1;
    {
      const P = upper.P, I = upper.I;
      for (let hi = 0; hi < NFY; hi++) {
        const y0 = FY0 + hi * FDY, ox = cx(y0), oz = cz(y0), row = hi * NFP;
        let t = 0;
        const put = (b, r) => { if (b >= 0 && b < NFP && r > reach[row + b]) { reach[row + b] = r; reachT[row + b] = t; } };
        for (t = 0; t < I.length; t += 3) {
          let n = 0, ax = 0, az = 0, bx = 0, bz = 0;
          for (let e = 0; e < 3; e++) {
            const p = I[t + e] * 3, q = I[t + ((e + 1) % 3)] * 3, ya = P[p + 1] - y0, yb = P[q + 1] - y0;
            if ((ya < 0) === (yb < 0)) continue;
            const f = ya / (ya - yb), x = P[p] + f * (P[q] - P[p]) - ox, z = P[p + 2] + f * (P[q + 2] - P[p + 2]) - oz;
            if (n++ === 0) { ax = x; az = z; } else { bx = x; bz = z; }
          }
          if (n !== 2) continue;
          let pa = Math.atan2(ax, az), pb = Math.atan2(bx, bz);
          if (pa < 0) pa += TAU;
          if (pb < 0) pb += TAU;
          if (Math.abs(pa - pb) > 1) continue;
          put(Math.floor((pa - FP0) / FDP), Math.hypot(ax, az)); put(Math.floor((pb - FP0) / FDP), Math.hypot(bx, bz));
          const ex = bx - ax, ez = bz - az;
          const b0 = Math.max(0, Math.ceil((Math.min(pa, pb) - FP0) / FDP - 0.5)), b1 = Math.min(NFP - 1, Math.floor((Math.max(pa, pb) - FP0) / FDP - 0.5));
          for (let b = b0; b <= b1; b++) {
            const ps = FP0 + (b + 0.5) * FDP, den = Math.sin(ps) * ez - Math.cos(ps) * ex;
            if (Math.abs(den) > 1e-12) put(b, (ax * ez - az * ex) / den);
          }
        }
      }
      const bC = Math.floor((Math.PI - FP0) / FDP);
      for (let hi = 0; hi < NFY; hi++) {
        const y0 = FY0 + hi * FDY, row = hi * NFP, over = (b) => reach[row + b] - legR(y0, FP0 + (b + 0.5) * FDP) - clr(y0);
        sideL[hi] = sideR[hi] = NaN;
        if (over(bC) < 0.001) continue;
        let l = bC, r = bC;
        while (l > 0 && over(l - 1) > 0.0005) l--;
        while (r < NFP - 1 && over(r + 1) > 0.0005) r++;
        sideL[hi] = FP0 + l * FDP; sideR[hi] = FP0 + (r + 1) * FDP; yEnd = y0;
      }
      for (let hi = NFY - 1; hi >= 0; hi--) if (!(sideL[hi] > 0)) { const up = hi + 1 < NFY && sideL[hi + 1] > 0; sideL[hi] = up ? sideL[hi + 1] : Math.PI - 0.1; sideR[hi] = up ? sideR[hi + 1] : Math.PI + 0.1; }
      for (let hi = Math.max(0, Math.round((yEnd - FY0) / FDY)) + 1; hi < NFY; hi++) { sideL[hi] = sideL[hi - 1]; sideR[hi] = sideR[hi - 1]; }
    }
    const sideAt = (A, y, out) => { const h = Math.floor(clamp((y - FY0) / FDY, 0, NFY - 1.0001)); return out < 0 ? Math.min(A[h], A[h + 1]) : Math.max(A[h], A[h + 1]); };
    const reachOver = (p0, p1, y) => {
      const f = (y - FY0) / FDY, h = Math.floor(f);
      if (h < 0 || h >= NFY - 1) return 0;
      let m = 0;
      for (let b = Math.max(0, Math.floor((p0 - FP0) / FDP)); b <= Math.min(NFP - 1, Math.floor((p1 - FP0) / FDP)); b++) m = Math.max(m, reach[h * NFP + b], reach[(h + 1) * NFP + b]);
      return m;
    };
    const wOn = (psi, y, q) => {
      const h = Math.round((y - FY0) / FDY), b = Math.floor((psi - FP0) / FDP);
      if (h < 0 || h >= NFY || b < 0 || b >= NFP || reachT[h * NFP + b] < 0) return -1;
      const t = reachT[h * NFP + b], c = [0, 1, 2].map((e) => { const k = UI[t + e] * 3; return [UP[k], UP[k + 1], UP[k + 2]]; });
      const e1 = vsub(c[1], c[0]), e2 = vsub(c[2], c[0]), n = vnorm(vcross(e1, e2)), d = vsub(q, c[0]);
      const d11 = vdot(e1, e1), d12 = vdot(e1, e2), d22 = vdot(e2, e2), den = d11 * d22 - d12 * d12;
      if (!(Math.abs(den) > 1e-16)) return -1;
      const l1 = Math.max(0, (d22 * vdot(d, e1) - d12 * vdot(d, e2)) / den), l2 = Math.max(0, (d11 * vdot(d, e2) - d12 * vdot(d, e1)) / den), l0 = Math.max(0, 1 - l1 - l2), ls = l0 + l1 + l2;
      const l = [l0 / ls, l1 / ls, l2 / ls], mm = [0, 0, 0];
      for (let e = 0; e < 3; e++) { const wk = wfAt(...c[e]) * l[e]; mm[0] += wk * c[e][0]; mm[1] += wk * c[e][1]; mm[2] += wk * c[e][2]; }
      const a = n[2] * q[1] - n[1] * q[2], bb = n[2] * mm[1] - n[1] * mm[2], beta = 0.05;
      return clamp((a * bb + beta * (q[1] * mm[1] + q[2] * mm[2])) / (a * a + beta * (q[1] * q[1] + q[2] * q[2])), 0, 1);
    };

    const yS = 0.066, NS = seg(56), cxS = cx(yS), czS = cz(yS), rS = new Float32Array(NS);
    {
      const raw = new Float32Array(NS);
      for (let q = 0; q < NS; q++) {
        const psi = (q / NS) * TAU;
        for (const dy of [-78e-4, -4e-3, 0, 0.004, 0.0078]) {
          const sp = shaftPt(psi, yS + dy);
          raw[q] = Math.max(raw[q], Math.hypot(sp[0] - cxS, sp[2] - czS));
        }
      }
      let sm = Float32Array.from(raw);
      for (let it = 0; it < 8; it++) {
        const t = new Float32Array(NS);
        for (let q = 0; q < NS; q++) t[q] = 0.25 * sm[(q + NS - 1) % NS] + 0.5 * sm[q] + 0.25 * sm[(q + 1) % NS];
        sm = t;
      }
      let lift = 0;
      for (let q = 0; q < NS; q++) lift = Math.max(lift, raw[q] - sm[q]);
      for (let q = 0; q < NS; q++) rS[q] = sm[q] + lift;
    }
    skinOf(upper);
    add(upper, { col: COL.leather, mat: MAT.leather, aux: (q) => [0.4, 14, sstep(0.05, 0.1, q.v) * 0.5, 1 + capM[q.i]], inside: null, tag: 'boots' });

    const NR = seg(48), NRs = seg(8);
    const rim = [];
    for (let k = 0; k <= NR; k++) {
      const psi = ((k % NR) / NR) * TAU, y = yRim(psi), R = legR(y, psi) + 0.0015;
      rim.push([[cx(y) + Math.sin(psi) * R, y, cz(y) + Math.cos(psi) * R], [Math.sin(psi), 0, Math.cos(psi)]]);
    }
    const roll = gridIJ(NR, NRs, (i, j) => {
      const [p, n] = rim[i], a = (j / NRs) * TAU;
      return [p[0] + n[0] * Math.cos(a) * 0.0032, p[1] + Math.sin(a) * 0.0036, p[2] + n[2] * Math.cos(a) * 0.0032, (i / NR) * 0.35, (j / NRs) * 0.02];
    });
    add(skinOf(roll), { col: COL.leather, mat: MAT.leather, aux: [0.35, 14, 0.45, 0], inside: null, tag: 'boots' });
    const lining = gridIJ(NR, 3, (i, j) => {
      const psi = ((i % NR) / NR) * TAU, y = yRim(psi) - 0.001 - 0.011 * j, R = legR(y, psi) + 0.002;
      return [cx(y) + Math.sin(psi) * R, y, cz(y) + Math.cos(psi) * R, (i / NR) * 0.35, j * 0.011];
    });
    add(skinOf(lining), { col: [0.03, 0.017, 0.008], mat: MAT.leather, aux: [0.9, 14, 0, 0], inside: null, tag: 'boots' });
    {
      const NB = seg(12), NBy = seg(10);
      const backing = gridIJ(NB, NBy, (i, j) => {
        const psi = Math.PI + ((2 * i) / NB - 1) * 0.32;
        if (j === NBy) { const y = yRim(psi), R = legR(y, psi) + 0.0022; return [cx(y) + Math.sin(psi) * R, y, cz(y) + Math.cos(psi) * R, 0.35 + (0.1 * i) / NB, y]; }
        const y = lerp(yJ - 0.002, yRim(psi) - 0.0026, j / (NBy - 1)), R = legR(y, psi) + clr(y) - 0.0018;
        return [cx(y) + Math.sin(psi) * R, y, cz(y) + Math.cos(psi) * R, 0.35 + (0.1 * i) / NB, y];
      });
      add(skinOf(backing), { col: COL.leather, mat: MAT.leather, aux: [0.9, 14, 0, 0], inside: null, tag: 'boots' });
      const NG = seg(36), NGy = seg(24), D = 0.5, iL = Math.round(NG / 3), iR = NG - iL, m = 0.004;
      const VP = new Float32Array((NG + 1) * NGy * 3), PW = new Float32Array((NG + 1) * NGy);
      for (let j = 0; j < NGy; j++) {
        const o = j * (NG + 1), tj = j / (NGy - 1), fj = tj * (0.5 + 0.5 * tj);
        for (let i = 0; i <= NG; i++) {
          const psiU = Math.PI + ((2 * i) / NG - 1) * D, q = i < iL ? (iL - i) / iL : i > iR ? (i - iR) / (NG - iR) : 0;
          const yb = yJ - 0.003 + 0.002 * q * q, y = lerp(yb, yRim(psiU) - 0.0026, fj);
          const sL = sideAt(sideL, y, -1) - m, sR = sideAt(sideR, y, 1) + m, onRidge = y < yEnd;
          let psi = i <= iL ? lerp(Math.PI - D, sL, i / iL) : i >= iR ? lerp(sR, Math.PI + D, (i - iR) / (NG - iR)) : lerp(sL, sR, (i - iL - 1) / (iR - iL - 2));
          psi = lerp(psi, psiU, sstep(yEnd, yEnd + 0.006, y));
          const Rr = onRidge && i === iL + 1 ? reachOver(sL + m, sL + m + 3 * FDP, y) : onRidge && i === iR - 1 ? reachOver(sR - m - 3 * FDP, sR - m, y) : reachOver(psi - 0.5 * FDP, psi + 0.5 * FDP, y);
          const Rs = legR(y, psi) + clr(y), off = lerp(0.0002, 0.0007, sstep(0, 0.01, y - yb));
          VP.set([psi, y, Math.max(Rs + 0.00015, Rr + off * sstep(-5e-4, 0.002, Rr - Rs))], (o + i) * 3);
          PW[o + i] = onRidge && i === iL + 1 ? sL + m + 1.5 * FDP : onRidge && i === iR - 1 ? sR - m - 1.5 * FDP : psi;
        }
        for (let i = iL + 1; i < iR - 1; i++) {
          const a = (o + i) * 3, b = a + 3, y = VP[a + 1];
          let need = 0;
          for (let k = Math.ceil((Math.min(VP[a], VP[b]) - FP0) / FDP - 0.5); k <= Math.floor((Math.max(VP[a], VP[b]) - FP0) / FDP - 0.5); k++) {
            const ps = FP0 + (k + 0.5) * FDP, t = (ps - VP[a]) / (VP[b] - VP[a] || 1);
            need = Math.max(need, reachOver(ps, ps, y) + 0.0002 - lerp(VP[a + 2], VP[b + 2], t));
          }
          if (need > 0) { VP[a + 2] += need; VP[b + 2] += need; }
        }
      }
      const lift = (a, b) => {
        let need = 0;
        for (let k = 1; k < 10; k++) {
          const t = k / 10, ps = lerp(VP[a], VP[b], t);
          need = Math.max(need, reachOver(ps - 0.5 * FDP, ps + 0.5 * FDP, lerp(VP[a + 1], VP[b + 1], t)) + 0.0002 - lerp(VP[a + 2], VP[b + 2], t));
        }
        if (need > 0) { VP[a + 2] += need; VP[b + 2] += need; }
      };
      let jTop = 0;
      while (jTop < NGy - 2 && VP[(jTop * (NG + 1) + (NG >> 1)) * 3 + 1] < yEnd + 0.004) jTop++;
      for (let it = 0; it < 2; it++) for (let j = 0; j < jTop; j++) {
        const o = j * (NG + 1);
        for (let i = iL + 1; i < iR; i++) { lift((o + i) * 3, (o + NG + 1 + i) * 3); if (i < iR - 1) lift((o + i) * 3, (o + NG + 2 + i) * 3); }
      }
      for (let it = 0; it < 6; it++) {
        const R0 = VP.slice();
        for (let j = 0; j <= jTop; j++) for (let i = iL + 2; i < iR - 1; i++) {
          const k = (j * (NG + 1) + i) * 3, up = j < NGy - 1 ? R0[k + (NG + 1) * 3 + 2] : R0[k + 2], dn = j > 0 ? R0[k - (NG + 1) * 3 + 2] : R0[k + 2];
          VP[k + 2] = Math.max(R0[k + 2], 0.5 * R0[k + 2] + 0.125 * (R0[k - 1] + R0[k + 5] + up + dn));
        }
      }
      const wts = [];
      const vamp = gridIJ(NG, NGy, (i, j) => {
        if (j === NGy) {
          const psi = Math.PI + ((2 * i) / NG - 1) * D, y = yRim(psi), R = legR(y, psi) + 0.003;
          wts.push(-1);
          return [cx(y) + Math.sin(psi) * R, y, cz(y) + Math.cos(psi) * R, 0.35 + (0.1 * i) / NG, y];
        }
        const k = (j * (NG + 1) + i) * 3, psi = VP[k], y = VP[k + 1], R = VP[k + 2], p = [cx(y) + Math.sin(psi) * R, y, cz(y) + Math.cos(psi) * R];
        const wm = wOn(PW[j * (NG + 1) + i], y, p);
        wts.push(wm < 0 ? -1 : lerp(wm, wfAt(...p), sstep(yEnd + 0.002, yEnd + 0.008, y)));
        return [...p, 0.35 + (0.1 * i) / NG, y];
      });
      add(skinOf(vamp, wts), { col: COL.leather, mat: MAT.leather, aux: [0.4, 14, 0.47, 0], inside: null, tag: 'boots' });
    }

    const strapAt = (q) => {
      const qq = ((q % NS) + NS) % NS, psi = (qq / NS) * TAU, r = rS[qq] + 0.0003, n = [Math.sin(psi), 0, Math.cos(psi)];
      return { p: [cxS + n[0] * r, yS, czS + n[2] * r], n };
    };
    const strapPath = [];
    for (let q = 0; q < NS; q++) strapPath.push(strapAt(q));
    add(skinOf(ribbon(strapPath, 0.014, 0.0026, 0, true, seg(8))), { col: COL.belt, mat: MAT.leather, aux: [0.4, 14, 0.35, 0], inside: null, tag: 'boots' });
    const qb = Math.round(((Math.PI / 2 + 0.3) / TAU) * NS);
    const tail = [];
    for (let q = qb; q <= qb + 7; q++) { const e = strapAt(q); tail.push({ p: vmad(e.p, e.n, 0.0026), n: e.n }); }
    add(skinOf(ribbon(tail, 0.0125, 0.0022, 0, false, seg(8))), { col: COL.belt, mat: MAT.leather, aux: [0.4, 14, 0.5, 0], inside: null, tag: 'boots' });
    {
      const e = strapAt(qb), Tb = vnorm(vsub(strapAt(qb + 1).p, strapAt(qb - 1).p)), Nb = e.n, Ub = vcross(Nb, Tb);
      const cb = vmad(e.p, Nb, 0.0026 + 0.0019), hx = 0.0075, hy = 0.0105, rc = 0.0028;
      const at = (x, y) => vadd(cb, vadd(vmul(Tb, x), vmul(Ub, y)));
      const rect = [];
      for (let k = 0; k < 4; k++) {
        const cx = (k === 0 || k === 3 ? 1 : -1) * (hx - rc), cy = (k < 2 ? 1 : -1) * (hy - rc);
        for (let m = 0; m <= 4; m++) { const an = (k + m / 4) * Math.PI * 0.5; rect.push(at(cx + Math.cos(an) * rc, cy + Math.sin(an) * rc)); }
      }
      rect.push(rect[0]);
      const brass = { col: COL.brass, mat: MAT.brass, aux: [0.3, 12, 0.55, 0], inside: null, tag: 'boots' };
      add(skinOf(tubeAlong(rect, () => 0.0015, seg(6))), brass);
      add(skinOf(tubeAlong([at(-hx + 0.0015, -hy), at(-hx + 0.0015, hy)], () => 0.0013, 5, null, true)), brass);
      add(skinOf(tubeAlong([vmad(at(-hx + 0.0015, 0), Nb, 0.0008), vmad(at(hx + 0.0012, 0), Nb, -8e-4)], () => 0.0009, 4, null, true)), brass);
    }

    const NWt = seg(44), NWs = seg(6);
    const wpt = (k) => outline(((k % NWt) + NWt) % NWt, NWt, 0.0004);
    const welt = gridIJ(NWt, NWs, (i, j) => {
      const [x, z] = wpt(i), [x1, z1] = wpt(i + 1), [x0, z0] = wpt(i - 1);
      const tl = Math.hypot(x1 - x0, z1 - z0) || 1, nx = -(z1 - z0) / tl, nz = (x1 - x0) / tl, a = (j / NWs) * TAU;
      return [x + nx * Math.cos(a) * 0.0022, SOLE_T + 0.0016 + Math.sin(a) * 0.0022, z + nz * Math.cos(a) * 0.0022, (i / NWt) * 0.7, (j / NWs) * 0.014];
    });
    add(skinOf(welt), { col: [0.04, 0.021, 0.01], mat: MAT.leather, aux: [0.5, 14, 0.3, 0], inside: null, tag: 'boots' });

    out['sole' + S] = toBind('foot' + S, [0, SOLE_B, -0.08]);
  }
  return out;
}

function buildWeights(B, seg) {
  const plate = (bone, front) => {
    const bm = BINDM.M[BI[bone]];
    const s = front ? 1 : -1;
    const NA = seg(48);
    const W = 0.118, HT = 0.02, HB = 0.2, CY = -0.085;
    const outline = (a) => {
      const c = Math.sin(a), co = Math.cos(a);
      let x, y;
      if (co >= 0) { x = Math.sign(c) * Math.abs(c) ** 0.4 * W; y = co ** 0.45 * HT; }
      else { const u = -co; x = Math.sign(c) * Math.abs(c) ** 0.75 * W * (1 - 0.18 * u); y = -(u ** 1.15) * HB; }
      y -= 0.012 * Math.exp(-((x / 0.028) ** 2)) * (co > 0 ? 1 : 0);
      return [x, y];
    };
    const pt = (a, grow) => {
      const [x, y] = outline(a), [x1, y1] = outline(a + 0.003), [x0, y0] = outline(a - 0.003);
      let nx = y1 - y0, ny = -(x1 - x0);
      const nl = Math.hypot(nx, ny) || 1;
      if (nx * x + ny * (y - CY) < 0) { nx = -nx; ny = -ny; }
      return [x + (nx / nl) * grow, y + (ny / nl) * grow];
    };
    const shrink = (a, k) => { const [x, y] = outline(a); return [x * k, CY + (y - CY) * k]; };
    const T = 0.03;
    const rows = [
      (a) => [...pt(a, -5e-3), -T / 2],
      (a) => [...pt(a, -12e-4), -T / 2 + 0.0012],
      (a) => [...pt(a, 0), -T / 2 + 0.005],
      (a) => [...pt(a, 0), T / 2 - 0.005],
      (a) => [...pt(a, -12e-4), T / 2 - 0.0008],
      (a) => [...pt(a, -4e-3), T / 2 + 0.0015],
      (a) => [...shrink(a, 0.9), T / 2 + 0.001],
      (a) => [...shrink(a, 0.865), T / 2 - 0.002],
      (a) => [...shrink(a, 0.6), T / 2 - 0.0015],
      (a) => [...shrink(a, 0.3), T / 2 - 0.001],
    ];
    const body = gridIJ(NA, rows.length - 1, (i, j) => { const a = (i / NA) * TAU; const [x, y, z] = rows[j](a); return [x, y, z, a * 0.1, j]; });
    const face = gridIJ(NA, 1, (i, j) => { const a = (i / NA) * TAU; const [x, y] = shrink(a, 0.3); return j ? [0, CY, T / 2 - 0.0008, 0, -1] : [x, y, T / 2 - 0.001, x, -1]; });
    const back = gridIJ(NA, 1, (i, j) => { const a = (i / NA) * TAU; const [x, y] = pt(a, -5e-3); return j ? [x, y, -T / 2, x, -1] : [0, CY, -T / 2 - 0.0005, 0, -1]; });
    const eye = torus(0.0115, 0.0042, seg(14), 7);
    xform(eye, T3(0, 0.019, 0));
    const pc = merge([body, back, face, eye]);
    const M = bm.clone().multiply(T3(0, 0.036, -s * 0.028)).multiply(new THREE.Matrix4().makeRotationY(front ? Math.PI : 0));
    xform(pc, M);
    const pcIn = new THREE.Vector3(0, CY, 0).applyMatrix4(M);
    B.add(pc, { col: COL.lead, mat: MAT.lead, aux: (q) => [0.2, 16, q.v > 3.5 && q.v < 6.5 ? 0.8 : 0.2, 0], skin: BI[bone], tag: 'weights', inside: [pcIn.x, pcIn.y, pcIn.z] });
    const holes = [];
    for (const hx of [-0.085, 0.085]) {
      const g = torus(0.008, 0.0028, seg(12), 6);
      const hp = new THREE.Vector3(hx * 0.95, -0.024, 0).applyMatrix4(M);
      xform(g, basis([hp.x, hp.y, hp.z], [1, 0, 0], [0, 0, 1], [0, -1, 0]).multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2)));
      B.add(g, { col: COL.lead, mat: MAT.lead, aux: [0.5, 16, 0.4, 0], skin: BI[bone], tag: 'weights' });
      holes.push([hp.x, hp.y, hp.z]);
    }
    return holes;
  };
  const hf = plate('wF', true), hb = plate('wB', false);
  for (let k = 0; k < 2; k++) {
    const s = k ? -1 : 1;
    const a = hf[k], b = hb[1 - k];
    const th0 = s * 0.62, th1 = Math.PI - s * 0.62;
    const ctrl = [a, vadd(corsAt(th0, 0.88), [0, 0.015, 0]), vadd(corsAt(s * 1.1, 0.5), [0, 0.02, 0]), vadd(corsAt(s * Math.PI / 2, 0.42), [0, 0.022, 0]), vadd(corsAt(s * 2.05, 0.5), [0, 0.02, 0]), vadd(corsAt(th1, 0.88), [0, 0.015, 0]), b];
    const pts = smoothPath(ctrl, seg(60));
    const pts2 = pts.map((p) => {
      const th = Math.atan2(p[0], -(p[2] - HZ));
      let best = p;
      const r = Math.hypot(p[0], p[2] - HZ);
      const rr = rimAt(th).r;
      if (r < rr * 1.05 && p[1] > 0.35) {
        let u = clamp((r - RING_R) / (rr - RING_R), 0, 1);
        const q = corsAt(th, u);
        if (p[1] < q[1] + 0.009) best = [p[0], q[1] + 0.009, p[2]];
      }
      return best;
    });
    const tube = tubeAlong(pts2, () => 0.0075, seg(8));
    const nv = tube.P.length / 3;
    tube.SI = new Uint16Array(nv * 4); tube.SW = new Float32Array(nv * 4);
    const Lr = tube.UV[(nv - 1) * 2];
    for (let v = 0; v < nv; v++) {
      const u = tube.UV[v * 2] / (Lr || 1);
      const wf = 1 - sstep(0.02, 0.2, u), wb = sstep(0.8, 0.98, u);
      tube.SI[v * 4] = BI.wF; tube.SW[v * 4] = wf;
      tube.SI[v * 4 + 1] = BI.cors; tube.SW[v * 4 + 1] = 1 - wf - wb;
      tube.SI[v * 4 + 2] = BI.wB; tube.SW[v * 4 + 2] = wb;
    }
    B.add(tube, { col: COL.rope, mat: MAT.rope, aux: (q) => [0.3, 17, 0.3, 1], tag: 'slings' });
  }
}

const DV_SHAPE_GLSL = `
float dvVHash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float dvVNoise(vec3 x) {
  vec3 i = floor(x), f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(dvVHash(i), dvVHash(i + vec3(1.0, 0.0, 0.0)), f.x), mix(dvVHash(i + vec3(0.0, 1.0, 0.0)), dvVHash(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
             mix(mix(dvVHash(i + vec3(0.0, 0.0, 1.0)), dvVHash(i + vec3(1.0, 0.0, 1.0)), f.x), mix(dvVHash(i + vec3(0.0, 1.0, 1.0)), dvVHash(i + vec3(1.0, 1.0, 1.0)), f.x), f.y), f.z);
}
float dvDrape(vec3 p) {
  float h = 0.0;
  float ax = abs(p.x);
  float torso = 1.0 - smoothstep(0.17, 0.22, ax);
  float band = smoothstep(0.12, 0.24, p.y) * (1.0 - smoothstep(0.29, 0.34, p.y)) * torso;
  if (band > 0.0) {
    float th = atan(p.x, -p.z);
    float ph = th * 7.0 + (0.3 - p.y) * 9.0 * sign(p.x) + 2.5 * dvVNoise(p * 9.0);
    h += 0.0036 * band * (0.5 + 0.5 * cos(ph));
  }
  float fork = (1.0 - smoothstep(0.05, 0.13, ax)) * smoothstep(-0.3, -0.21, p.y) * (1.0 - smoothstep(-0.12, -0.05, p.y));
  if (fork > 0.0) {
    float nf = dvVNoise(p * 13.0);
    float uu = p.y + 0.19 - 7.0 * ax * ax + 0.012 * (nf - 0.5);
    float fw = 0.5 + 0.5 * cos(uu * (105.0 + 35.0 * nf) + 1.3);
    h += 0.0024 * fork * fw * fw * (p.z > 0.0 ? 0.55 : 1.0);
  }
  return h;
}
float dvCorrect(vec3 p) {
  float h = 0.0;
  for (int i = 0; i < 6; i++) {
    float kb = clamp((uDvJB[i] - 0.35) / 0.65, 0.0, 1.0);
    if (kb < 0.02) continue;
    vec4 P = uDvJP[i];
    vec3 d = p - uDvJC[i];
    float s = dot(d, uDvJA[i]);
    vec3 q = d - uDvJA[i] * s;
    float r = length(q);
    if (r > P.y * 1.2) continue;
    float side = dot(q, uDvJN[i]) / max(r, 1e-4);
    float outside = smoothstep(0.2, -0.8, side);
    float along = 1.0 - smoothstep(0.0, 1.0, abs(s) / max(P.x, 1e-3));
    h += P.y * 0.15 * outside * along * kb * kb;
  }
  return h;
}
float dvBunch(vec3 p) {
  float h = 0.0;
  for (int i = 0; i < 10; i++) {
    float bend = uDvJB[i];
    if (bend < 0.02) continue;
    vec4 P = uDvJP[i];
    vec3 d = p - uDvJC[i];
    float s = dot(d, uDvJA[i]);
    if (abs(s) > P.x * 1.2) continue;
    vec3 q = d - uDvJA[i] * s;
    float r = length(q);
    if (r > P.y) continue;
    float side = dot(q, uDvJN[i]) / max(r, 1e-4);
    float along = 1.0 - smoothstep(0.35, 1.0, abs(s) / (P.x * 1.2));
    float inside = smoothstep(-0.2, 0.7, side), outside = smoothstep(0.1, -0.7, side);
    float lump = 0.55 + 0.45 * sin(6.2832 * s / (P.z * 1.7) + 3.0 * dvVNoise(p * 16.0));
    h += bend * along * (P.w * 1.1 * inside * lump - 0.0016 * outside);
  }
  return h;
}
`;
const DV_VERT_DECL = `
attribute vec4 aMat;
attribute vec3 aRest;
attribute vec4 aAux;
uniform float uDvSquish;
uniform float uDvBalloon;
uniform float uDvBreath;
uniform float uDvFill;
uniform vec3 uDvBagC;
uniform float uDvBagBone;
uniform vec4 uDvBagDent[8];
uniform float uDvFindK;
uniform vec3 uDvFindC;
uniform mat3 uDvFindM;
uniform vec2 uDvFindY;
uniform vec3 uDvUpR;
uniform float uDvPuff;
uniform vec3 uDvJC[10];
uniform vec3 uDvJA[10];
uniform vec3 uDvJN[10];
uniform vec4 uDvJP[10];
uniform float uDvJB[10];
uniform vec3 uDvCuffA[2];
uniform vec3 uDvCuffW[2];
uniform float uDvCuffL[2];
flat varying float vDvKind;
varying vec4 vDvMat;
varying vec3 vDvRest;
varying vec4 vDvAux;
varying vec2 vDvUv;
${DV_SHAPE_GLSL}
float dvNetH(vec2 i) { return fract(sin(dot(vec2(mod(i.x, 5.0), i.y), vec2(127.1, 311.7))) * 43758.5453); }
float dvNetN(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(dvNetH(i), dvNetH(i + vec2(1.0, 0.0)), f.x), mix(dvNetH(i + vec2(0.0, 1.0)), dvNetH(i + vec2(1.0, 1.0)), f.x), f.y);
}
vec2 dvStadium(float s, vec2 c, vec2 ea, float L, float R, out vec2 n) {
  vec2 eb = vec2(ea.y, -ea.x);
  float q = fract(s) * (4.0 * L + 6.2831853 * R), qa = 1.5707963 * R, iR = 1.0 / max(R, 1.0e-5), a;
  vec2 o;
  if (q < qa) { a = q * iR; o = L * ea; }
  else if (q < qa + 2.0 * L) { n = eb; return c + (L - (q - qa)) * ea + R * eb; }
  else if (q < 3.0 * qa + 2.0 * L) { a = 1.5707963 + (q - qa - 2.0 * L) * iR; o = -L * ea; }
  else if (q < 3.0 * qa + 4.0 * L) { n = -eb; return c + (q - 3.0 * qa - 3.0 * L) * ea - R * eb; }
  else { a = 4.712389 + (q - 3.0 * qa - 4.0 * L) * iR; o = L * ea; }
  n = cos(a) * ea + sin(a) * eb;
  return c + o + R * n;
}
`;
const DV_VERT = `
vDvMat = aMat;
vDvKind = aMat.w;
vDvRest = aRest;
vDvAux = aAux;
vDvUv = uv;
if (aMat.w < 0.5) {
  float legs = 1.0 - smoothstep(-0.12, 0.02, aRest.y);
  float arms = smoothstep(0.2, 0.28, abs(aRest.x)) * smoothstep(-0.2, 0.0, aRest.y);
  float upper = smoothstep(0.02, 0.22, aRest.y) * (1.0 - arms);
  float hN = clamp((dot(aRest - vec3(0.0, -0.05, 0.0), uDvUpR) + 0.95) / 1.55, 0.0, 1.0);
  float bootFree = smoothstep(-0.752, -0.70, aRest.y);
  float press = uDvSquish * (legs * 0.009 * bootFree + arms * 0.006) * (1.0 - smoothstep(0.55, 0.9, hN) * uDvBalloon);
  float puff = uDvBalloon * (0.004 + 0.02 * smoothstep(0.45, 0.93, hN)) * bootFree;
  float shape = dvDrape(aRest) + dvBunch(aRest);
  float belly = smoothstep(-0.07, -0.01, aRest.y) * (1.0 - smoothstep(0.09, 0.15, aRest.y)) * smoothstep(0.02, -0.06, aRest.z) * (1.0 - arms);
  belly *= 1.0 - smoothstep(0.035, 0.05, aRest.y) * (1.0 - smoothstep(0.105, 0.12, aRest.y));
  vec3 cd = aRest - uDvCuffA[aRest.x >= 0.0 ? 0 : 1];
  vec3 cw = uDvCuffW[aRest.x >= 0.0 ? 0 : 1];
  float rubV = smoothstep(-0.012, 0.0, dot(cd, cw) - uDvCuffL[aRest.x >= 0.0 ? 0 : 1]) * (1.0 - smoothstep(0.075, 0.09, length(cd - cw * dot(cd, cw))));
  transformed += normal * (puff - press + (upper * 0.0015 + belly * 0.006) * uDvBreath + shape * (1.0 - 0.6 * uDvSquish * legs) + dvCorrect(aRest)) * (1.0 - rubV);
} else if (aMat.w < 1.5 && aAux.y < 1.5) {
  vec2 ck = vec2(abs(aRest.x) - 0.041, aRest.y - 0.612) / 0.016;
  transformed += normal * uDvPuff * 0.0018 * exp(-dot(ck, ck)) * step(aRest.z, -0.04);
}
if (aAux.y > 19.5 && aAux.y < 21.5) transformed += normal * uDvFill * 0.03;
if (aAux.y > 19.5 && aAux.y < 22.5 && abs(skinIndex.x - uDvBagBone) < 0.5 && skinWeight.x > 0.99) {
  vec3 bp = transformed - uDvBagC;
  bool sponge = aAux.y > 20.5 && aAux.y < 21.5, cord = aAux.y > 21.5;
  float v = clamp(-bp.y / 0.37, 0.0, 1.0), bv = smoothstep(0.0, 0.45, v);
  float a = cord ? atan(bp.z, -2.0 * bp.y) : atan(bp.x, bp.z / 0.62);
  bp.x *= mix(1.0, 0.7, bv);
  if (!cord && !sponge) {
    float xm = mix(0.036, 0.076, smoothstep(0.1, 0.5, v)) - 0.008;
    if (bp.x > xm) bp.x = xm + 0.008 * (1.0 - exp(-(bp.x - xm) / 0.008));
  }
  if (uDvFindK > 0.001) {
    float hi = uDvFindY.x, lo = uDvFindY.y;
    float K = uDvFindK * smoothstep(0.04, 0.0, lo), ins = smoothstep(0.0, 0.05, -lo), full = smoothstep(0.2, 0.3, -lo);
    float D = max(0.34, 0.05 - lo), y = cord || sponge ? 0.0 : mix(-v * D, v < 0.82 ? v / 0.82 * lo : lo - (v - 0.82) / 0.18 * (D + lo), full);
    float jr = fract(sin(dot(aRest, vec3(127.1, 311.7, 74.7))) * 43758.5453), jq = fract(sin(dot(aRest, vec3(269.5, 183.3, 246.1))) * 43758.5453);
    if (!cord && !sponge) y += 0.009 * (2.0 * jr - 1.0) * smoothstep(0.03, 0.15, v);
    mat2 M2 = mat2(uDvFindM[0][0], uDvFindM[0][2], uDvFindM[0][2], uDvFindM[2][2]);
    vec2 m = vec2(uDvFindM[0][1], uDvFindM[1][2]);
    float det = M2[0][0] * M2[1][1] - M2[0][1] * M2[0][1];
    vec2 mm = (mat2(M2[1][1], -M2[0][1], -M2[0][1], M2[0][0]) / det) * m;
    float tr = 0.5 * (M2[0][0] + M2[1][1]), dq = sqrt(max(0.0, tr * tr - det)), l0 = max(tr - dq, 1.0e-6), l1 = max(tr + dq, 1.0e-6);
    vec2 e1 = vec2(M2[0][1], l0 - M2[0][0]), e2 = vec2(l0 - M2[1][1], M2[0][1]);
    vec2 ea = dot(e1, e1) > dot(e2, e2) ? e1 : e2;
    ea = dot(ea, ea) > 1.0e-12 ? normalize(ea) : vec2(0.0, 1.0);
    if (ea.y < 0.0) ea = -ea;
    float dy = clamp(y, lo, hi) - uDvFindC.y;
    float k = max(0.0, 1.0 - uDvFindM[1][1] * dy * dy + dy * dy * dot(m, mm)) * step(lo, y) * step(y, hi);
    float A = sqrt(k / l0), B = sqrt(k / l1);
    float t = hi < 0.0 ? clamp(y / hi, 0.0, 1.0) : 1.0;
    vec2 c = mix(vec2(0.0), uDvFindC.xz - dy * mm, ins) * mix(smoothstep(-0.03, 0.01, hi), 1.0, t);
    float s = fract(a / 6.2831853), sl = 0.003 + 0.005 * dvNetN(vec2(s * 5.0, y * 7.0 + 3.7));
    float sq = clamp((lo + D - 0.004) / 0.078, 0.55, 1.0), yS = -D + 0.002 + 0.039 * sq, hS = 0.039 * sq, rS = 0.036 * (1.15 - 0.15 * sq);
    vec2 cS = mix(vec2(0.0), uDvFindC.xz - (lo - uDvFindC.y) * mm, ins);
    float Rb = mix(0.1, 0.05, full), zb = (y - lo) / min(-D - lo, -1.0e-3), zs = (y - yS) / hS;
    float Ro = y < lo ? Rb * sqrt(max(0.0, 1.0 - zb * zb)) : max(0.1 * (1.0 - full), Rb * full * sqrt(max(0.0, 1.0 - (y - lo) * (y - lo) / 0.0025)));
    Ro = max(Ro, (rS + 0.008) * sqrt(max(0.0, 1.0 - zs * zs)));
    float shut = full * smoothstep(-0.005, -0.04, hi), Rm = mix(0.042, 0.015, shut);
    if (hi < y) Ro = max(Ro, Rm * (1.0 - t));
    if (cord) Ro = max(Ro, Rm);
    float R = max(B + sl, Ro), L = max(0.0, A + sl - R);
    vec2 n;
    vec2 q = dvStadium(s, c, ea, L, R, n);
    vec3 P = vec3(q.x, y, q.y);
    if (!cord && hi < y) P.y -= 0.01 * shut * sin(3.1415926 * t);
    if (cord) P += vec3(n.x, 0.0, n.y) * (length(vec2(bp.z, 2.0 * bp.y)) - 0.042) - vec3(0.0, bp.x, 0.0);
    vec3 sp = (bp + vec3(0.0, 0.28, 0.0)) * vec3(1.15 - 0.15 * sq, sq, 1.15 - 0.15 * sq);
    float qS = length(vec3(sp.x / rS, sp.y / hS, sp.z / rS));
    if (qS > 0.92) sp *= 0.92 / qS;
    if (sponge) P = vec3(cS.x + sp.x, yS + sp.y, cS.y + sp.z);
    float r0 = max(length(vec2(bp.x / mix(1.0, 0.7, bv), bp.z / 0.62)), 0.005);
    bp = mix(bp, P, K);
    if (!cord && !sponge) {
      float R0 = max(B + 0.011, Ro);
      vDvUv.x *= mix(1.0, max(1.0, (4.0 * max(0.0, A + 0.011 - R0) + 6.2831853 * R0) / (6.2831853 * r0 * 1.2)), K);
      vDvUv += K * (vec2(0.016, 0.012) * (vec2(dvNetN(vec2(s * 5.0 + 1.3, v * 6.0)), dvNetN(vec2(s * 5.0 + 3.1, v * 6.0 + 2.0))) * 2.0 - 1.0) + vec2(0.007, 0.009) * (vec2(jr, jq) * 2.0 - 1.0));
    }
    vec3 nf = vec3(n.x, y < lo ? -0.7 * sqrt(max(0.0, 1.0 - Ro * Ro / (Rb * Rb))) : 0.0, n.y) + 0.3 * vec3(2.0 * jr - 1.0, 2.0 * jq - 1.0, jr - jq);
    vec3 nb = mix(normal, nf * sign(dot(normal.xz, n) + 1.0e-4), K * (sponge ? 0.0 : 1.0));
#if defined( USE_SKINNING ) && defined( STANDARD ) && ! defined( FLAT_SHADED )
    vNormal = normalize(normalMatrix * (skinMatrix * vec4(normalize(nb), 0.0)).xyz);
#endif
  }
  vec3 pw = uDvBagC + bp;
  for (int k = 0; k < 14; k++) {
    int i = k - 7 * (k / 7);
    if (i == 4 || i == 7) continue;
    vec3 ca = uDvBagDent[i].xyz, cb = uDvBagDent[i + 1].xyz - ca;
    float ct = clamp(dot(pw - ca, cb) / max(dot(cb, cb), 1.0e-6), 0.0, 1.0);
    vec3 cd = pw - ca - cb * ct;
    float cr = mix(uDvBagDent[i].w, uDvBagDent[i + 1].w, ct), cl = length(cd);
    if (cl < cr) pw += (cl > 1.0e-5 ? cd / cl : vec3(-1.0, 0.0, 0.0)) * (cr - cl);
  }
  bp = pw - uDvBagC;
  transformed = uDvBagC + bp;
}
`;
const DV_VERT_CORS_DECL = `
uniform float uDvCorsBone;
float dvCorsR(float y, float c, float s, out float rmY) {
  float rz = c > 0.0 ? ${RIM_ZF.toFixed(4)} : ${RIM_ZB.toFixed(4)};
  float rmR = inversesqrt((s / ${RIM_X.toFixed(4)}) * (s / ${RIM_X.toFixed(4)}) + (c / rz) * (c / rz));
  rmY = ${RIM_YS.toFixed(4)} - ${(RIM_YS - RIM_YF).toFixed(4)} * pow(max(c, 0.0), 1.35) - ${(RIM_YS - RIM_YB).toFixed(4)} * pow(max(-c, 0.0), 1.35);
  float u = pow(clamp((${(RING_Y - 0.004).toFixed(4)} - y) / (${(RING_Y - 0.004).toFixed(4)} - rmY), 0.0, 1.0), 1.0 / 1.55);
  return ${RING_R.toFixed(4)} + pow(sin(u * 1.5707963), 0.85) * (rmR - ${RING_R.toFixed(4)});
}
`;
const DV_VERT_CORS = `
#ifdef USE_SKINNING
if (aMat.w < 0.5 && aRest.y > 0.2) {
  vec2 rq = vec2(aRest.x, aRest.z - ${HZ.toFixed(4)});
  float r0 = max(length(rq), 1.0e-5), rmY0;
  dvCorsR(aRest.y, -rq.y / r0, rq.x / r0, rmY0);
  float own = max(smoothstep(rmY0 - 0.02, rmY0 + 0.01, aRest.y), 1.0 - smoothstep(0.1, 0.16, distance(aRest, vec3(sign(aRest.x) * 0.172, 0.462, 0.012))));
  mat4 bc = getBoneMatrix(uDvCorsBone);
  mat3 br = mat3(bc);
  vec3 q = transpose(br) * (skinned.xyz - bc[3].xyz);
  vec2 qq = vec2(q.x, q.z - ${HZ.toFixed(4)});
  float r = max(length(qq), 1.0e-5), rmY;
  float rC = dvCorsR(q.y, -qq.y / r, qq.x / r, rmY) - 0.008;
  float k = own * smoothstep(rmY - 0.005, rmY + 0.01, q.y) * smoothstep(0.15, 0.17, r) * (1.0 - smoothstep(0.53, 0.55, q.y)) * (1.0 - smoothstep(0.07, 0.12, r - rC));
  if (k > 0.0 && r > rC) {
    qq *= mix(1.0, rC / r, k);
    q.x = qq.x; q.z = qq.y + ${HZ.toFixed(4)};
    transformed = (bindMatrixInverse * vec4(br * q + bc[3].xyz, 1.0)).xyz;
  }
}
#endif
`;
const DV_FRAG_DECL = `
uniform float uDvFade;
uniform float uDvUnder;
uniform float uDvFrame;
uniform float uDvWet;
uniform float uDvSalt;
uniform float uDvFaceAmb;
uniform float uDvFaceOpen;
uniform vec3 uDvWinV[3];
uniform float uDvSeed;
#define DV_NJ 10
uniform vec3 uDvJC[DV_NJ];
uniform vec3 uDvJA[DV_NJ];
uniform vec3 uDvJN[DV_NJ];
uniform vec4 uDvJP[DV_NJ];
uniform float uDvJB[DV_NJ];
uniform float uDvSquish;
uniform vec3 uDvSunE;
uniform float uDvBounce;
uniform float uDvWaterY;
uniform float uDvFloorY;
uniform vec3 uDvPA[5];
uniform vec3 uDvPW[5];
uniform vec3 uDvPB[5];
uniform vec3 uDvPO[5];
uniform vec4 uDvKn[2];
uniform vec4 uDvEl[2];
uniform vec3 uDvCuffA[2];
uniform vec3 uDvCuffW[2];
uniform float uDvCuffL[2];
uniform vec4 uDvLace[2];
uniform sampler2D uDvGrain;
uniform float uDvGrainK;
uniform float uDvLod;
flat varying float vDvKind;
varying vec4 vDvMat;
varying vec3 vDvRest;
varying vec4 vDvAux;
varying vec2 vDvUv;
${DV_SHAPE_GLSL}
int dvPanel(vec3 p) {
  int s = p.x >= 0.0 ? 0 : 1;
  vec3 d = p - uDvPA[3 + s];
  float u = dot(d, uDvPW[3 + s]);
  if (u > uDvPO[3 + s].z && length(d - uDvPW[3 + s] * u) < 0.1) return 3 + s;
  return p.y < uDvPO[1].z ? 1 + s : 0;
}
vec2 dvClothUV(vec3 p, int k, out vec3 W, out vec3 T, out float a, out float r) {
  W = uDvPW[k];
  vec3 d = p - uDvPA[k];
  float u = dot(d, W);
  vec3 q = d - W * u;
  r = max(length(q), 1e-4);
  vec3 B = uDvPB[k];
  a = atan(dot(q, cross(W, B)), dot(q, B));
  T = cross(W, q / r);
  return vec2(u, a * r);
}
float dvSqI(float x, float d) { return floor(x) * d + min(fract(x), d); }
float dvDash(float x, float w, float d) { w = max(w, 1e-4); return (dvSqI(x + 0.5 * w, d) - dvSqI(x - 0.5 * w, d)) / w; }
float dvBox(float d, float h, float w) { return max(0.0, min(d + 0.5 * w, h) - max(d - 0.5 * w, -h)) / w; }
vec3 dvPerturb(vec3 sp, vec3 sn, vec2 dH) {
  vec3 sx = dFdx(sp), sy = dFdy(sp);
  vec3 r1 = cross(sy, sn), r2 = cross(sn, sx);
  float det = dot(sx, r1);
  vec3 g = sign(det) * (dH.x * r1 + dH.y * r2);
  return normalize(abs(det) * sn - g);
}
vec2 dvHash22(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy); }
vec3 dvHash33(vec3 p) { p = fract(p * vec3(0.1031, 0.1030, 0.0973)); p += dot(p, p.yxz + 33.33); return fract((p.xxy + p.yxx) * p.zyx); }
vec2 dvCell(vec3 x) {
  vec3 n = floor(x), f = fract(x);
  float d1 = 8.0, d2 = 8.0;
  for (int k = -1; k <= 1; k++) for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec3 g = vec3(float(i), float(j), float(k));
    vec3 r = g + dvHash33(n + g) - f;
    float d = dot(r, r);
    if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
  }
  return vec2(sqrt(d1), sqrt(d2));
}
vec2 dvSeamD(vec3 p, int k, float a, float r, float u) {
  const float PI_ = 3.14159265;
  vec2 s = vec2(1.0, 0.0);
  if (k < 3) { float d = a * r; if (abs(d) < abs(s.x)) s = vec2(d, u); }
  { float d = (a > 0.0 ? a - PI_ : a + PI_) * r; if (abs(d) < abs(s.x)) s = vec2(d, u); }
  int sl = p.x >= 0.0 ? 3 : 4;
  { vec3 d3 = p - uDvPA[sl]; float ua = dot(d3, uDvPW[sl]), rq = length(d3 - uDvPW[sl] * ua); float d = ua - uDvPO[sl].z; if (rq < 0.1 && abs(d) < abs(s.x)) s = vec2(d, rq * atan(d3.z, d3.y)); }
  if (k < 3) { float d = p.y - uDvPO[1].z; if (abs(d) < abs(s.x)) s = vec2(d, p.x + 0.4 * p.z); }
  if (k == 1 || k == 2) { float d = p.x; if (abs(d) < abs(s.x)) s = vec2(d, p.y); }
  if (k == 0) {
    if (p.z > 0.03 && p.y < 0.37) { float d = p.x; if (abs(d) < abs(s.x)) s = vec2(d, p.y); }
    float ct = cos(atan(p.x, 0.004 - p.z));
    float d = p.y - (0.383 - 0.106 * pow(max(ct, 0.0), 1.35) - 0.09 * pow(max(-ct, 0.0), 1.35));
    if (abs(d) < abs(s.x)) s = vec2(d, a * r);
  }
  return s;
}
float dvWeave(vec2 ab, float P, vec2 k) {
  vec2 g = ab / P;
  vec2 c = floor(g), f = g - c;
  float jx = 0.85 + 0.3 * fract(sin(c.x * 12.9898) * 43758.5453), jy = 0.85 + 0.3 * fract(sin(c.y * 78.233) * 43758.5453);
  float up = step(mod(c.x + c.y, 3.0), 1.5);
  float warp = pow(max(sin(3.14159 * f.y), 0.0), 0.7) * jy;
  float weft = pow(max(sin(3.14159 * f.x), 0.0), 0.7) * jx * 0.8;
  float wv = (g.x + g.y) / 3.0;
  float wale = 0.5 * sin(6.2832 * wv) * (0.5 + fract(sin(floor(wv) * 37.719) * 43758.5453));
  return mix(wale * k.y, mix(weft, warp, up) - 0.55, k.x);
}
vec2 dvWeaveK(vec2 wx, vec2 wy, float P) {
  float fp = max(length(wx), length(wy)), fa = 0.7071 * max(abs(wx.x + wx.y), abs(wy.x + wy.y));
  return vec2(1.0 - smoothstep(0.3 * P, 0.6 * P, fp), 1.0 - smoothstep(0.3 * P, 0.5 * P, fa));
}
float dvPatchD(vec2 q, vec2 h, float rot, float seed) {
  q = mat2(cos(rot), sin(rot), -sin(rot), cos(rot)) * q;
  vec2 e = q / h;
  e *= e;
  float n = sqrt(sqrt(e.x * e.x + e.y * e.y));
  vec2 o = q / max(length(q), 1e-5);
  return (1.0 - n) * min(h.x, h.y) + 0.005 * (uwNoise3(vec3(o * 2.2, seed)) - 0.5);
}
vec3 dvCreases(vec2 st, vec2 sx, vec2 sy, float seed, float th0) {
  const float C = 0.024, CT = 0.1, W = 0.0018;
  vec3 o = vec3(0.0);
  float i0 = floor(st.x / C);
  for (int k = -1; k <= 1; k++) {
    float i = i0 + float(k);
    vec3 a = dvHash33(vec3(i, seed, 7.1));
    if (a.z < 0.33) continue;
    float tj = floor(st.y / CT - a.y);
    vec3 b = dvHash33(vec3(i, tj, seed + 3.3)), e = dvHash33(vec3(tj, i, seed + 9.7));
    if (b.z < 0.25) continue;
    float th = th0 + 0.87 * (b.x - 0.5), cs = cos(th), sn = sin(th), kb = 4.0 * (e.y - 0.5);
    vec2 d = st - vec2((i + 0.25 + 0.5 * a.x) * C, (tj + a.y + 0.5 + 0.2 * (b.y - 0.5)) * CT);
    float u = d.y * cs + d.x * sn, sg = e.z < 0.5 ? 1.0 : -1.0;
    float v = sg * (d.x * cs - d.y * sn + kb * u * u);
    float L = 0.015 + 0.025 * e.x, tp = (1.0 - smoothstep(0.45, 1.0, abs(u) / L)) * (0.45 + 0.55 * fract(a.x * 7.13 + b.y * 3.7));
    if (tp <= 0.0 || abs(v) > 4.0 * W) continue;
    float g0 = exp(-v * v / (W * W)), v1 = (v - 1.7 * W) / (1.2 * W), g1 = exp(-v1 * v1);
    float dh = 2.0 * v / (W * W) * g0 - 0.6 * v1 / (1.2 * W) * g1;
    vec2 gv = sg * vec2(cs + 2.0 * kb * u * sn, -sn + 2.0 * kb * u * cs);
    o.xy += 0.0004 * tp * dh * vec2(dot(gv, sx), dot(gv, sy));
    o.z = max(o.z, tp * g0);
  }
  return o;
}
float dvFolds(vec3 p, out float cav) {
  float h = 0.0;
  cav = 0.0;
  for (int i = 0; i < DV_NJ; i++) {
    float bend = uDvJB[i];
    if (bend < 0.02) continue;
    vec4 P = uDvJP[i];
    vec3 d = p - uDvJC[i];
    float s = dot(d, uDvJA[i]);
    if (abs(s) > P.x) continue;
    vec3 q = d - uDvJA[i] * s;
    float r = length(q);
    if (r > P.y) continue;
    float side = dot(q, uDvJN[i]) / max(r, 1e-4);
    float diag = dot(d, cross(uDvJA[i], uDvJN[i]));
    float w = smoothstep(-0.35, 0.65, side) * (1.0 - smoothstep(0.3, 1.0, abs(s) / P.x)) * bend;
    float nf = uwNoise3(vec3((s + 0.5 * diag) / (P.z * 1.2), side * 1.3 + float(i) * 2.7, diag * 14.0 + 0.6 * uwNoise3(p * 24.0 + float(i))));
    float v = 1.0 - abs(2.0 * nf - 1.0);
    v *= v;
    h -= P.w * 1.6 * w * v * v;
    cav = max(cav, w * v * v * v);
  }
  return h;
}
float dvSuitH(vec3 p, float free, float fw, float kf, out float cav) {
  float h = dvFolds(p, cav) + dvDrape(p) + 0.7 * dvBunch(p);
  if (kf > 0.0) h += kf * 0.0005 * (uwNoise3(p * 30.0) - 0.5);
  float legs = 1.0 - smoothstep(-0.2, -0.06, p.y);
  float sq = uDvSquish * free * (legs + 0.6 * smoothstep(0.24, 0.3, abs(p.x)) * (1.0 - smoothstep(0.15, 0.3, p.y)));
  if (sq > 0.01) {
    vec3 W, T;
    float a, r;
    int k = dvPanel(p);
    vec2 uv = dvClothUV(p, k, W, T, a, r);
    float ph = (uv.x + 0.35 * uv.y) / 0.055 + 1.3 * uwNoise3(vec3((uv + uDvPO[k].xy) * 9.0, float(k)));
    float i = floor(ph), f = ph - i;
    float keep = step(0.45, fract(sin(i * 12.9898 + float(k) * 78.233) * 43758.5453));
    float t = (uv.y - 0.35 * uv.x) / 0.16 + 7.0 * fract(sin(i * 4.1414) * 1753.3);
    float ti = floor(t), tf = t - ti;
    float run = smoothstep(0.25, 0.6, mix(fract(sin(ti * 91.7 + i * 3.3) * 4375.85), fract(sin((ti + 1.0) * 91.7 + i * 3.3) * 4375.85), tf * tf * (3.0 - 2.0 * tf)));
    float pa = sq * keep * run * smoothstep(0.35, 0.75, uwNoise3(p * 5.0 + 2.0));
    h += 0.002 * pa * smoothstep(0.0, 0.8, f) * (1.0 - smoothstep(0.8, 0.86, f));
    cav = max(cav, 0.2 * pa * smoothstep(0.82, 0.88, f) * (1.0 - smoothstep(0.88, 1.0, f)) * (1.0 - smoothstep(0.0025, 0.005, fw)));
  }
  return h;
}
float dvRelief(int k, vec3 q, vec3 tw, float fp, vec2 uv, vec4 aux) {
  float h = 0.0;
  if (k == 2 || k == 3 || k == 4) {
    vec2 c = dvCell(q * 72.0);
    h += (k == 2 ? 0.00022 : 0.00008) * (c.y - c.x);
    h += 0.00006 * (uwNoise3(q * 900.0) - 0.5) * (1.0 - smoothstep(0.0004, 0.001, fp));
  } else if (k == 15) {
    h += 0.0005 * uwNoise3(q * 420.0);
  } else if (k == 7) {
    h += 0.00035 * (uwNoise3(q * 160.0) - 0.5) - 0.0003 * smoothstep(0.7, 0.9, uwNoise3(q * 60.0));
    vec2 dc = dvCell(q * 30.0);
    h -= 0.0009 * (1.0 - smoothstep(0.0, 0.3, dc.x)) * smoothstep(0.6, 0.72, uwNoise3(q * 7.0 + 3.0));
  } else if (k == 8) {
    float r = max(aux.w, 0.003);
    float ang = uv.y / r;
    float st = sin(3.0 * ang - uv.x / r * 1.05);
    h += r * 0.12 * abs(st) + 0.00012 * (uwNoise3(vec3(uv.x * 900.0, ang * 3.0, 0.0)) - 0.5);
  } else if (k == 6) {
    float hl = 0.00012 * (uwNoise3(q * 700.0) - 0.5) - 0.0004 * smoothstep(0.62, 0.8, uwNoise3(q * vec3(90.0, 25.0, 90.0)));
    if (aux.y > 13.5 && aux.y < 14.5 && aux.w > 0.5) {
      vec2 cc = dvCell(q * 72.0);
      hl = mix(hl, 0.00008 * (cc.y - cc.x) + 0.00006 * (uwNoise3(q * 900.0) - 0.5), smoothstep(-0.0006, 0.0006, aux.w - 1.0));
    }
    h += hl;
  } else if (k == 1 || k == 17) {
    h += 0.00005 * (uwNoise3(q * 1300.0) - 0.5) * (1.0 - smoothstep(0.0003, 0.0008, fp));
    h += 0.00009 * (uwNoise3(q * 260.0) - 0.5);
    if (aux.y < 1.5 && q.z < -0.04) {
      float fh = smoothstep(0.698, 0.706, q.y) * (1.0 - smoothstep(0.728, 0.738, q.y)) * (1.0 - smoothstep(0.03, 0.045, abs(q.x)));
      float fw = max(0.0, 0.5 + 0.5 * sin(q.y * 820.0 + 3.0 * uwNoise3(q * 70.0)));
      fw *= fw;
      h -= 0.00016 * fh * fw * fw * fw;
      vec2 nl = vec2(abs(q.x) - 0.027 + (q.y - 0.61) * 0.35, q.y - 0.61);
      float nx = nl.x / 0.0028;
      h -= 0.0004 * exp(-nx * nx) * (1.0 - smoothstep(0.012, 0.024, abs(nl.y)));
      vec2 cf = vec2(abs(q.x) - 0.058, q.y - 0.662);
      float cfr = length(cf);
      float cw = max(0.0, 0.5 + 0.5 * sin(atan(cf.y, cf.x) * 14.0));
      cw *= cw;
      h -= 0.00008 * (1.0 - smoothstep(0.006, 0.014, cfr)) * cw * cw * step(0.0, cf.x);
    }
  } else if (k == 5) {
    float th = uv.x / 0.2;
    vec2 sv = vec2((th - 0.5236 * floor(th / 0.5236 + 0.5)) * 0.18, 0.011 + 0.45 * uv.y);
    float rr = length(sv);
    h += 0.0005 * sin(9.0 * atan(sv.x, sv.y) + 2.0 * uwNoise3(q * 60.0)) * smoothstep(0.004, 0.01, rr) * (1.0 - smoothstep(0.018, 0.034, rr));
    h += 0.00008 * (uwNoise3(q * 500.0) - 0.5) * (1.0 - smoothstep(0.0004, 0.001, fp));
  } else if (k == 10) {
    h += 0.00018 * (uwNoise3(q * vec3(900.0, 180.0, 900.0)) - 0.5);
  } else if (k == 12) {
    vec2 w2 = fract(vec2(atan(q.x, q.z) * 38.0, q.y * 240.0));
    h += 0.0003 * (1.0 - abs(w2.x - 0.5) * 2.0) * (0.6 + 0.4 * sin(w2.y * 6.2832));
  } else if (k == 14) {
    float cv;
    h += dvFolds(q, cv);
    h += 0.00045 * (uwNoise3(q * 45.0) - 0.5);
    h += 0.00005 * sin((q.x + q.y + q.z) * 2600.0) * (1.0 - smoothstep(0.0005, 0.0012, fp));
  } else if (k == 11) {
    h += 0.00015 * sin(q.z * 900.0 + 4.0 * uwNoise3(q * 60.0));
  }
  return h;
}
`;
const DV_FRAG_COLOR = `
int dvK = int(vDvKind + 0.5);
float dvRough = vDvMat.x;
float dvMetal = vDvMat.y;
float dvWetG = vDvMat.z;
float dvClear = 0.0, dvClearR = 0.25, dvSheen = 0.0, dvSheenR = 0.6;
float dvFace = 0.0;
float dvCav = 0.0;
vec3 dvQ = vDvRest;
vec3 dvQx = dFdx(dvQ), dvQy = dFdy(dvQ);
float dvFp = max(length(dvQx), length(dvQy));
vec3 dvCr = cross(dvQx, dvQy);
vec3 dvTw = pow(abs(dvCr / max(length(dvCr), 1e-12)), vec3(4.0));
dvTw /= (dvTw.x + dvTw.y + dvTw.z + 1e-5);
if (uDvFade < 0.999) {
  float dvN = fract(52.9829189 * fract(dot(gl_FragCoord.xy + 5.588238 * uDvFrame, vec2(0.06711056, 0.00583715))));
  if (dvN >= uDvFade) discard;
}
float dvH01 = clamp((vDvRest.y + 0.95) / 1.8, 0.0, 1.0);
float dvWN = uwNoise3(vDvRest * 9.0) - 0.5;
float dvFront = smoothstep(-0.025, 0.025, uDvWetY - vDvRest.y + 0.05 * dvWN + 0.012 * sin(vDvRest.x * 90.0 + vDvRest.z * 70.0));
float dvWet = dvFront * clamp((uDvWet - 0.4 * dvH01 + 0.25 * dvWN) / 0.6 + 0.4 * (1.0 - step(uDvWet, 0.999)) * 0.0, 0.0, 1.0);
dvWet = max(dvWet, dvFront * step(0.999, uDvWet));
float dvSaltM = 0.0;
if (uDvSalt > 0.001 && uDvUnder < 0.5) dvSaltM = uDvSalt * (1.0 - dvWet) * step(0.5, dvFront + 1.0 - step(2.5, uDvWetY + 3.0)) * smoothstep(0.55, 0.8, uwNoise3(vDvRest * vec3(14.0, 40.0, 14.0)) + 0.25 * uwNoise3(vDvRest * 60.0));
float dvHs = 0.0;
vec2 dvDHa = vec2(0.0);
float dvRub = 0.0, dvAniso = 0.0;
vec3 dvFib = vec3(0.0);
vec3 c = diffuseColor.rgb;
if (dvK == 0) {
  vec3 p = vDvRest;
  vec3 cW, cT;
  float ca, cr;
  int ck = dvPanel(p), cs = p.x >= 0.0 ? 0 : 1;
  vec2 cuv = dvClothUV(p, ck, cW, cT, ca, cr);
  vec2 guv = cuv + uDvPO[ck].xy;
  vec2 gx = vec2(dot(dvQx, cW), dot(dvQx, cT)), gy = vec2(dot(dvQy, cW), dot(dvQy, cT));
  float fw = max(dvFp, 0.0002);
  float nT = uwNoise3(p * 5.0 + uDvSeed), nM = uwNoise3(p * 23.0);
  float kFine = 1.0 - smoothstep(0.87, 1.45, length(vViewPosition) * uDvLod);
  vec3 cd3 = p - uDvCuffA[cs];
  float cu = dot(cd3, uDvCuffW[cs]);
  float cuffD = ck >= 3 && length(cd3 - uDvCuffW[cs] * cu) < 0.085 ? cu - uDvCuffL[cs] + 0.001 * (nM - 0.5) : -1.0;
  float fwc = max(0.0003, 0.7 * dvFp);
  dvRub = smoothstep(-fwc, fwc, cuffD);
  float cloth = 1.0 - dvRub;
  vec3 dry = mix(mix(vec3(0.46, 0.215, 0.06), vec3(0.45, 0.25, 0.085), dvWet), mix(vec3(0.49, 0.335, 0.09), vec3(0.48, 0.34, 0.11), dvWet), smoothstep(0.15, 0.85, nT)) * (0.95 + 0.1 * nM);
  vec2 gP = guv / 0.512;
  vec2 gCx = 0.2 * gx / 0.512, gCy = 0.2 * gy / 0.512;
  float gCk = max(1.0, 0.006 / max(max(length(gCx), length(gCy)), 1e-7));
  vec4 gB = textureGrad(uDvGrain, 0.2 * gP + 0.37, gCx * gCk, gCy * gCk);
  float gC = clamp(0.5 + 8.0 * (gB.b - 0.5), 0.0, 1.0);
  float gCa = clamp(0.5 + 2.2 * (gB.a - 0.5), 0.0, 1.0);
  dry *= (0.84 + 0.32 * gC) * mix(vec3(1.0), vec3(1.03, 0.97, 0.9), smoothstep(0.5, 0.7, gC));
  if (kFine > 0.0) {
    float nB = uwNoise3(p * 62.0 + 1.7);
    dry *= mix(vec3(1.0), vec3(0.9, 0.86, 0.82), kFine * smoothstep(0.55, 0.8, nB) * (0.6 + 0.4 * nM));
  }
  {
    vec3 sx = dFdx(-vViewPosition), sy = dFdy(-vViewPosition);
    vec3 fn = normalize(cross(sx, sy));
    vec3 tv = cross(sy, fn) * gx.x + cross(fn, sx) * gy.x;
    dvFib = tv / max(length(tv), 1e-9);
    dvAniso = kFine * (1.0 - smoothstep(0.0008, 0.0015, dvFp));
  }
  float sun = smoothstep(0.0, 0.1, p.z) * smoothstep(0.15, 0.35, p.y);
  if (ck >= 3) sun = max(sun, smoothstep(0.2, 0.9, cos(ca)) * (1.0 - smoothstep(0.12, 0.34, cuv.x)));
  float slv = ck >= 3 ? uDvUnder : 0.0;
  dry = mix(dry, vec3(0.56, 0.355, 0.15), sun * (0.25 + 0.2 * nM) * (1.0 - 0.6 * slv));
  dry *= mix(vec3(1.0), vec3(1.04, 0.965, 0.9), slv);
  float dull = max(smoothstep(0.0, -0.07, p.z) * (ck < 3 ? 0.12 : 0.0), 0.25 * (1.0 - smoothstep(-0.56, -0.4, p.y)));
  dry = mix(dry, vec3(0.32, 0.21, 0.09), dull);
  float pd = -1.0, pg = 0.0, pw = 0.0, apex = 0.0;
  if (ck == 1 || ck == 2) {
    vec4 K = uDvKn[cs];
    float da = ca - K.y;
    da -= 6.2832 * floor(da / 6.2832 + 0.5);
    vec2 q = vec2(cuv.x - K.x, da * cr);
    float d = dvPatchD(q, K.zw, cs == 0 ? 0.08 : -0.12, float(cs));
    if (d > pd) { pd = d; pg = 0.45; pw = 0.35; apex = 1.0 - smoothstep(0.0, 0.04, length(q)); }
  } else if (ck >= 3) {
    vec4 E = uDvEl[cs];
    float da = ca - E.y;
    da -= 6.2832 * floor(da / 6.2832 + 0.5);
    vec2 q = vec2(cuv.x - E.x, da * cr);
    float d = dvPatchD(q, E.zw, cs == 0 ? -0.1 : 0.07, 2.0 + float(cs));
    if (d > pd) { pd = d; pg = 0.45; pw = 0.35; apex = 0.7 * (1.0 - smoothstep(0.0, 0.035, length(q))); }
  }
  if (p.z > 0.04 && p.y > -0.3 && p.y < 0.1) {
    float d = dvPatchD(vec2(p.x + 0.006, p.y + 0.1), vec2(0.15, 0.125), 0.05, 4.0);
    if (d > pd) { pd = d; pg = 0.45; pw = 0.35; apex = 0.6 * (1.0 - smoothstep(0.0, 0.05, length(vec2(abs(p.x) - 0.065, p.y + 0.16)))); }
  }
  float rep = 0.0;
  if (p.z < -0.03 && p.x < -0.06) {
    float d = dvPatchD(mat2(0.97, -0.24, 0.24, 0.97) * vec2(p.x + 0.13, p.y + 0.2), vec2(0.034, 0.042), 0.0, 5.0);
    if (d > pd) { pd = d; pg = 0.0; pw = 0.2; rep = 1.0; }
  }
  float pm = smoothstep(-fw, fw, pd);
  float chest = ck == 0 ? smoothstep(0.09, 0.13, p.y) * (1.0 - smoothstep(0.28, 0.34, p.y)) : 0.0;
  float zone = max(pw * pm, 0.6 * (1.0 - smoothstep(-0.62, -0.45, p.y)) * smoothstep(0.0, -0.05, p.z));
  zone = max(zone, ck >= 3 ? 0.5 * smoothstep(0.1, 0.25, cuv.x) * (1.0 - smoothstep(-0.2, 0.3, sin(ca))) : 0.15 * chest);
  float nP = pm > 0.0 ? uwNoise3(p * 19.0 + 7.3) : 0.5;
  vec3 grP = mix(vec3(0.125, 0.085, 0.042), vec3(0.115, 0.094, 0.047), uDvUnder);
  vec3 old = mix(dry, grP, 0.15) * (0.92 + 0.12 * nP);
  vec3 pc = rep > 0.5 ? mix(dry, vec3(0.55, 0.4, 0.22), 0.35) * (0.96 + 0.08 * gC) : mix(old, grP, pg * 0.2 * (0.6 + 0.8 * gC));
  dry = mix(dry, pc, pm * (rep > 0.5 ? 1.0 : 1.0 - 0.65 * uDvUnder));
  vec4 gT = vec4(0.5);
  float gTr = 0.5, w0 = 0.0;
  float gAmp = mix(1.0, 1.1, smoothstep(0.0, 0.4, zone)) * (1.0 + 0.3 * uDvUnder * (1.0 - pm));
  if (kFine > 0.0) {
    vec2 wab = guv, wx = gx, wy = gy;
    if (pd > 0.0) {
      const mat2 DV_PR = mat2(0.921, 0.389, -0.389, 0.921);
      wab = DV_PR * guv + 0.37; wx = DV_PR * gx; wy = DV_PR * gy;
    }
    float kW = kFine * (1.0 - 0.15 * uDvUnder);
    vec2 wk = dvWeaveK(wx, wy, 0.0013) * vec2(1.0, kFine * kFine);
    w0 = dvWeave(wab, 0.0013, wk);
    vec2 dW = vec2(dvWeave(wab + wx, 0.0013, wk), dvWeave(wab + wy, 0.0013, wk)) - w0;
    dvDHa += 0.00011 * kW * (1.0 - smoothstep(0.00039, 0.00065, max(length(wx), length(wy)))) * dW * cloth;
    dry *= 1.0 + 0.1 * kW * w0;
    vec4 gF = textureGrad(uDvGrain, gP + step(0.0, pd) * vec2(0.5, 0.29), gx / 0.512, gy / 0.512);
    gTr = gF.a;
    gT = mix(gT, gF, kFine);
    dry *= 1.0 + gAmp * (gT.b - 0.5) * (1.0 + 0.3 * (1.0 - uDvUnder) * clamp(log2(dvFp / 0.0005), 0.0, 1.0));
    dvDHa += 4.0 * gAmp * (1.0 - 0.3 * smoothstep(0.0008, 0.0014, dvFp)) * uDvGrainK * vec2(dot(gT.rg * 2.0 - 1.0, gx), dot(gT.rg * 2.0 - 1.0, gy)) * cloth;
  }
  float kC = kFine * kFine * smoothstep(1.8, 3.0, 0.0015 / fw) * cloth;
  if (kC > 0.0) {
    vec2 st = vec2(p.y - 0.104, cuv.y);
    float mC = 0.0, th0 = 0.0, sd = 11.0;
    if (ck == 0) {
      mC = smoothstep(-0.006, 0.004, st.x) * (1.0 - smoothstep(0.05, 0.14, st.x));
    } else {
      int j = ck >= 3 ? cs : (cuv.x < 0.2 ? 4 + cs : 2 + cs);
      sd = float(j);
      vec3 N = uDvJN[j], B = uDvPB[ck];
      float da = ca - atan(dot(N, cross(cW, B)), dot(N, B));
      da -= 6.2832 * floor(da / 6.2832 + 0.5);
      st = vec2(cuv.x - dot(uDvJC[j] - uDvPA[ck], cW), da * cr);
      if (ck >= 3) mC = (1.0 - smoothstep(0.035, 0.065, abs(st.x))) * (1.0 - smoothstep(0.035, 0.07, abs(st.y)));
      else if (j < 4) mC = (1.0 - smoothstep(0.04, 0.075, abs(st.x))) * (1.0 - smoothstep(0.04, 0.08, abs(st.y)));
      else {
        mC = smoothstep(0.0, 0.03, st.x) * (1.0 - smoothstep(0.08, 0.13, st.x)) * (1.0 - smoothstep(0.03, 0.08, abs(st.y)));
        th0 = cs == 0 ? 0.35 : -0.35;
      }
    }
    if (mC > 0.0) {
      vec3 cz = dvCreases(st, gx, gy, sd, th0);
      dvDHa += kC * mC * cz.xy;
      dry *= 1.0 - 0.02 * kC * mC * cz.z;
    }
  }
  if (ck >= 3) {
    float ua = smoothstep(0.03, 0.09, cuv.x) * (1.0 - smoothstep(uDvEl[cs].x + 0.03, uDvEl[cs].x + 0.08, cuv.x)) * (1.0 - pm);
    if (ua > 0.0) dvHs += 0.0024 * ua * (uwNoise3(vec3(cuv.x * 26.0 + 0.8 * sin(ca), 1.3 * cos(ca), 1.3 * sin(ca) + float(cs) * 4.7)) - 0.5);
  }
  float rimW = 0.003 + 0.003 * nM + 0.002 * nT;
  float prim = rep > 0.5 ? 0.0 : (1.0 - pm) * (1.0 - smoothstep(0.0, rimW + fw, -pd)) * (0.65 + 0.35 * smoothstep(0.1, 0.35, nM + 0.15 * (nT - 0.5)));
  float lip = rep > 0.5 ? 0.0 : (1.0 - pm) * (1.0 - smoothstep(0.0, 0.0012 + fw, -pd));
  dvHs += 0.001 * smoothstep(-max(0.0015, fw), max(0.0015, fw), pd) * (1.0 - 0.5 * rep);
  float cav, cvx;
  float hF = dvSuitH(p, 1.0 - pm, fw, kFine, cav);
  dvDHa += (vec2(dvSuitH(p + dvQx, 1.0 - pm, fw, kFine, cvx), dvSuitH(p + dvQy, 1.0 - pm, fw, kFine, cvx)) - hF) * (0.3 + 0.7 * cloth);
  float gTa = 0.5 + (gTr - 0.5) * (1.0 + 0.3 * clamp(log2(dvFp / 0.0005), 0.0, 2.0));
  vec3 ej = p - uDvJC[cs];
  float grime = 0.5 * (1.0 - smoothstep(-0.72, -0.5, p.y)) + 0.45 * smoothstep(-0.05, -0.012, cuffD) * (1.0 - dvRub)
    + 0.4 * (1.0 - smoothstep(0.03, 0.09, length(ej))) * smoothstep(0.0, 0.6, dot(ej, uDvJN[cs]) / max(length(ej), 1e-4));
  float smr = chest * smoothstep(-0.02, -0.08, p.z) + (ck >= 3 ? smoothstep(uDvEl[cs].x, uDvEl[cs].x + 0.06, cuv.x) * smoothstep(0.0, -0.04, p.z) : 0.0);
  grime += 0.2 * smr * smoothstep(0.55, 0.85, gC + 0.3 * (nM - 0.5));
  grime += 0.3 * smoothstep(0.025, 0.05, p.y) * (1.0 - smoothstep(0.05, 0.058, p.y)) * smoothstep(0.3, 0.7, nM + 0.5 * (gC - 0.5));
  float bib = ck == 0 ? smoothstep(0.12, 0.24, p.y) * (1.0 - smoothstep(0.29, 0.34, p.y)) * (1.0 - smoothstep(0.17, 0.22, abs(p.x))) : 0.0;
  if (bib > 0.0) {
    float ph = atan(p.x, -p.z) * 7.0 + (0.3 - p.y) * 9.0 * sign(p.x) + 2.5 * dvVNoise(p * 9.0);
    float vl = 0.5 - 0.5 * cos(ph);
    grime += 0.28 * bib * vl * vl * vl * smoothstep(0.25, 0.6, nM + 0.4 * (nT - 0.5));
  }
  grime = clamp(grime * (1.0 + 0.6 * (vDvAux.x + cav)) * (0.75 + 0.5 * nM) * (1.3 - 0.6 * gCa), 0.0, 0.75);
  grime = max(grime, 0.36 * smoothstep(0.04, 0.3, cav) + 0.1 * zone * (1.0 - gCa));
  float shd = (1.0 - uDvUnder) * clamp(1.6 * cav + vDvAux.x, 0.0, 1.0);
  dry = mix(dry, mix(mix(vec3(0.135, 0.09, 0.045), vec3(0.15, 0.08, 0.035), shd), vec3(0.12, 0.095, 0.05), uDvUnder), grime);
  dry *= 1.0 - kFine * (1.0 - uDvUnder) * min(0.5, grime + 0.3 * zone) * 0.3 * max(-w0, 0.0);
  float ridge = 1.0 - clamp(1.5 * cav + vDvAux.x, 0.0, 1.0);
  vec3 pale = mix(vec3(0.6, 0.455, 0.25), vec3(0.62, 0.48, 0.3), uDvUnder);
  dry = mix(dry, pale, zone * ridge * (0.03 + 0.1 * smoothstep(0.3, 0.85, gCa)) * (0.8 + 0.4 * gC));
  if (kFine > 0.0) {
    float tf = p.y + 0.05 * (uwNoise3(p * vec3(6.0, 2.0, 6.0) + 2.3) - 0.5) + 0.014 * (uwNoise3(p * 27.0 + 5.1) - 0.5) + 0.004 * (uwNoise3(p * 95.0 + 8.9) - 0.5);
    float tl = 0.0, ts = 0.0;
    for (int i = 0; i < 4; i++) {
      float d = tf - (i == 0 ? -0.61 : i == 1 ? -0.37 : i == 2 ? -0.14 : 0.21);
      if (d < -0.035 || d > 0.004) continue;
      float on = smoothstep(0.35, 0.6, uwNoise3(p * 4.0 + float(i) * 3.7));
      tl = max(tl, on * clamp(0.5 - d / fw, 0.0, 1.0) * exp(min(d, 0.0) / 0.0025));
      ts = max(ts, on * smoothstep(-0.03, -0.006, d) * (1.0 - smoothstep(-0.003, 0.0, d)));
    }
    dry *= 1.0 - 0.1 * kFine * tl * (1.0 - 0.7 * dvWet);
    dry = mix(dry, vec3(0.62, 0.58, 0.5), 0.07 * kFine * ts * (1.0 - dvWet));
  }
  c = mix(dry, pow(dry, vec3(1.2)) * 0.62, dvWet);
  c *= mix(vec3(1.0), vec3(0.94, 1.0, 1.0), dvWet * uDvUnder);
  float thr = 0.94 - 0.12 * apex;
  float spk = zone * pm * smoothstep(0.0, 0.3, apex) * mix(clamp((0.3 * nM + 0.675 - thr) / 0.7, 0.0, 1.0), smoothstep(thr, thr + 0.05, 0.3 * nM + 0.7 * gTa), kFine);
  float apx = mix(clamp(0.575 + 0.3 * (nP - 0.5), 0.0, 1.0), smoothstep(0.3, 0.55, gTa + 0.3 * (nP - 0.5)), kFine);
  c = mix(c, vec3(0.019, 0.016, 0.015), clamp(spk + 0.3 * apex * apex * pm * pw * smoothstep(0.4, 0.7, nP) * apx, 0.0, 1.0));
  c = mix(c, vec3(0.03, 0.027, 0.024), max(prim * (0.62 + 0.2 * nT), 0.7 * lip));
  c *= 1.0 - 0.2 * pm * (1.0 - rep) * smoothstep(0.001, 0.003, pd) * (1.0 - smoothstep(0.004, 0.008 + fw, pd));
  float scuf = pm * (1.0 - rep) * (1.0 - smoothstep(0.0006, 0.0035 + fw, pd)) * (0.35 + 0.65 * smoothstep(0.3, 0.75, nM + 0.4 * (gCa - 0.5)));
  c = mix(c, c * 1.35 + vec3(0.014, 0.01, 0.006), 0.7 * scuf);
  c *= (1.0 - 0.35 * cav) * (1.0 - 0.42 * vDvAux.x) * mix(vec3(1.0), vec3(1.05, 0.97, 0.87), shd);
  dvCav = cav;
  vec2 sm = dvSeamD(p, ck, ca, cr, cuv.x);
  float sa = abs(sm.x);
  float band = 1.0 - smoothstep(0.0105 - fw, 0.0115 + fw, sa);
  vec3 cc = c;
  c *= 1.0 - 0.13 * band * (0.6 + 0.4 * dvWet);
  dvHs += (0.0005 * band + 0.0004 * (1.0 - smoothstep(0.0, 0.0005 + fw, abs(sm.x + 0.011)))) * cloth;
  if (sa < 0.03) {
    float pk = exp(-sa * sa / 0.00018) * smoothstep(0.25, 0.65, uwNoise3(vec3(sm.y * 9.0, float(ck), 5.3))) * cloth;
    dvHs += 0.0007 * pk * (uwNoise3(vec3(sm.y * 70.0, sa * 25.0, float(ck) + 1.9)) - 0.5);
  }
  c = mix(c, vec3(0.03, 0.026, 0.022), 0.4 * (1.0 - 0.6 * smoothstep(0.0006, 0.0012, fw)) * dvBox(sm.x - 0.0112, 0.0003, fw));
  float row = dvBox(sa - 0.008, 0.0003, fw);
  float dash = dvDash(sm.y / 0.0035, dvFp / 0.0035, 0.6);
  float kSt = 1.0 - smoothstep(0.001, 0.0018, dvFp);
  vec3 thr3 = cc * vec3(0.92, 0.95, 1.0) * mix(1.08, 0.92, dvWet);
  thr3 = mix(thr3, vec3(dot(thr3, vec3(0.2126, 0.7152, 0.0722))), 0.3);
  c = mix(c, thr3, row * mix(0.6, dash, kSt) * 0.75);
  dvHs += (0.0001 * dash - 0.00006) * row * kSt * cloth;
  if (rep > 0.5) {
    float hem = 1.0 - smoothstep(0.0004, 0.0004 + fw, abs(pd - 0.004));
    c *= 1.0 - 0.18 * (1.0 - smoothstep(0.0, 0.0008 + fw, abs(pd - 0.0075))) * pm;
    c = mix(c, vec3(0.05, 0.04, 0.03), hem * dvDash((p.x + p.y) / 0.003 + 0.3 * nM, dvFp / 0.003, 0.55) * pm);
    dvHs += 0.0008 * pm * (1.0 - smoothstep(0.0055, 0.0075, pd));
  }
  if (ck == 1 || ck == 2) {
    vec4 L = uDvLace[cs];
    float la = ca - (cs == 0 ? 1.5708 : -1.5708);
    la -= 6.2832 * floor(la / 6.2832 + 0.5);
    float dl = abs(la) * cr;
    float inP = max(step(L.x, cuv.x) * step(cuv.x, L.y), step(L.z, cuv.x) * step(cuv.x, L.w));
    if (inP > 0.0 && dl < 0.07) {
      float flap = 1.0 - smoothstep(0.0065, 0.0075 + fw, abs(dl - 0.017));
      float pr = 0.5 + 0.5 * cos(6.2832 * (dl / 0.015 + 0.8 * uwNoise3(vec3(cuv.x * 30.0, float(cs), 3.0))));
      float fade = smoothstep(0.022, 0.028, dl) * (1.0 - smoothstep(0.035, 0.065, dl)) * (0.4 + 0.6 * abs(sin(3.14159 * cuv.x / 0.03)));
      dvHs += 0.0015 * flap - 0.0025 * fade * pr * pr;
      c *= 1.0 - 0.25 * fade * pr * pr;
    }
  }
  if (cuffD > -0.11) {
    float cL = uDvCuffL[cs] / 0.76;
    dvHs += 0.002 * smoothstep(-0.0002 - fwc, 0.0015 + fwc, cuffD);
    dvHs += 0.003 * (1.0 - smoothstep(0.0085, 0.0095 + fw, abs(cu - 0.965 * cL)));
    float cf = min(abs(abs(ca) - 1.5708), 0.6) * cr;
    dvHs -= 0.0004 * dvRub * (1.0 - smoothstep(0.0, 0.001 + fw, cf)) * (1.0 - smoothstep(0.0, 0.05, cuffD));
    float hR = 0.0;
    for (int i = 0; i < 4; i++) {
      float fi = float(i);
      float xr = -cuffD - 0.012 - 0.019 * fi - 0.004 * sin(fi * 7.3 + uDvSeed) + 0.14 * cr * sin(ca + fi * 2.1);
      float arc = smoothstep(0.1, 0.4, 0.5 + 0.5 * cos(ca - fi * 2.4 - float(cs) * 1.3));
      hR += (0.0045 - 0.0008 * fi) * arc * exp(-xr * xr / (xr < 0.0 ? 0.000016 : 0.00005));
    }
    dvHs += hR * (1.0 - dvRub);
    vec3 rc = vec3(0.085, 0.03, 0.017) * (0.85 + 0.3 * nM);
    rc = mix(rc, vec3(0.2, 0.19, 0.18), max(smoothstep(0.62, 0.85, nM) * mix(0.35, 0.12, dvWet), mix(0.11, smoothstep(0.82, 0.96, gTa), kFine) * mix(0.45, 0.15, dvWet)));
    c = mix(c, rc, dvRub);
    c = mix(c, vec3(0.02, 0.016, 0.013), 0.8 * (1.0 - smoothstep(0.0003, 0.0003 + fwc, abs(cuffD + 0.0004))));
  }
  c = mix(c, vec3(0.62, 0.6, 0.55), dvSaltM * 0.6);
  float riv = 0.0;
  if (uDvUnder < 0.5) riv = smoothstep(0.8, 0.9, uwNoise3(p * vec3(70.0, 5.0, 70.0))) * (1.0 - uDvUnder);
  float glaze = zone * pm;
  dvRough = mix(0.95, 0.62, dvWet) + 0.04 * (nM - 0.5) + 0.06 * cav - 0.2 * glaze - 0.25 * riv * dvWet;
  dvRough = mix(dvRough, mix(0.6, 0.4, dvWet), max(dvRub, prim));
  dvSheen = mix(0.12, 0.05, dvWet) * (1.0 - dvRub) * (0.55 + 0.9 * gT.a);
  dvSheenR = 0.55;
  dvClear = mix(dvWet * (0.04 + 0.06 * cav + 0.3 * riv), 0.3 + 0.5 * dvWet, dvRub);
  dvClearR = 0.2;
} else if (dvK == 5) {
  float n = uwNoise3(vDvRest * 50.0);
  c *= 0.85 + 0.3 * n;
  c = mix(c, c * 0.8 + vec3(0.03, 0.03, 0.028), dvSaltM);
  dvRough = mix(0.62, 0.32, dvWet) + 0.1 * (n - 0.5);
  dvClear = 0.3 + 0.5 * dvWet;
  dvClearR = 0.25;
} else if (dvK == 1 || dvK == 17) {
  vec3 p = vDvRest;
  float part = vDvAux.y;
  float n = uwFbm3(p * 60.0), nf = uwNoise3(p * 420.0);
  vec3 base = vec3(0.225, 0.108, 0.056) * (0.86 + 0.28 * n);
  base *= 0.92 + 0.16 * uwNoise3(p * 180.0);
  if (part > 1.5 && part < 2.5) {
    base = mix(base, vec3(0.36, 0.2, 0.13), vDvAux.z * 0.8);
    base = mix(base, vec3(0.42, 0.3, 0.24), vDvAux.w);
    dvRough = mix(0.5, 0.35, vDvAux.w);
  } else {
    float face = smoothstep(-0.05, -0.08, p.z);
    float red = exp(-pow(length(vec2(p.x, p.y - 0.635) / vec2(0.012, 0.012)), 2.0)) * face
              + exp(-pow(length(vec2(abs(p.x) - 0.042, p.y - 0.64) / vec2(0.018, 0.012)), 2.0)) * 0.6
              + smoothstep(0.066, 0.078, abs(p.x)) * 0.8;
    base = mix(base, vec3(0.36, 0.1, 0.06), clamp(red, 0.0, 1.0) * 0.7);
    float jaw = smoothstep(0.64, 0.61, p.y) * smoothstep(-0.02, -0.06, p.z) * smoothstep(0.565, 0.585, p.y);
    float stub = 0.4 + 0.6 * step(0.5, uwNoise3(p * 1500.0));
    base = mix(base, vec3(0.03, 0.026, 0.026), jaw * stub * 0.62);
    base = mix(base, vec3(0.19, 0.07, 0.05) * (0.9 + 0.2 * n), smoothstep(0.2, 0.8, vDvAux.z));
    if (dvK == 17) base = vec3(0.19, 0.07, 0.05) * (0.9 + 0.2 * n);
    float hm = smoothstep(0.25, 0.75, vDvAux.w);
    if (hm > 0.0) {
      float strand = uwNoise3(p * vec3(1500.0, 260.0, 1500.0));
      vec3 hc = mix(vec3(0.02, 0.014, 0.01), vec3(0.06, 0.042, 0.028), strand);
      hc = mix(hc, vec3(0.22, 0.21, 0.2), step(0.94, uwNoise3(p * vec3(1100.0, 170.0, 1100.0) + uDvSeed)) * 0.6);
      float cover = hm * (0.75 + 0.25 * step(0.35, strand));
      base = mix(base, hc, cover);
      dvRough = mix(dvRough, 0.5, cover);
      dvSheen = 0.35 * cover;
    }
    dvFace = 1.0;
  }
  base = mix(base * (1.0 - 0.6 * vDvAux.x), vec3(0.17, 0.05, 0.03), vDvAux.x * 0.3);
  c = base;
  dvRough = mix(dvRough, 0.3, dvWet * 0.6);
  dvClear = dvWet * 0.25;
  dvSheen = max(dvSheen, 0.12);
  dvSheenR = 0.4;
} else if (dvK == 2) {
  vec3 p = vDvRest;
  float n1 = uwFbm3(p * 8.0), n2 = uwNoise3(p * vec3(26.0, 5.0, 26.0)), n3 = uwNoise3(p * 150.0);
  vec3 ox1 = vec3(0.12, 0.048, 0.022), ox2 = vec3(0.24, 0.095, 0.04);
  vec3 cu = mix(ox1, ox2, smoothstep(0.2, 0.85, n1));
  cu = mix(cu, cu * vec3(0.86, 0.74, 0.84), smoothstep(0.62, 0.86, n2) * 0.45);
  float wear = clamp(vDvAux.z * (0.8 + 0.5 * n3), 0.0, 1.0);
  cu = mix(cu, vec3(0.62, 0.3, 0.14) * (0.9 + 0.2 * n3), wear * 0.9);
  float vg = smoothstep(0.42, 0.88, vDvAux.x * (0.55 + 0.8 * uwNoise3(p * 95.0)));
  vg = max(vg, smoothstep(0.5, 0.9, vDvAux.x) * smoothstep(0.55, 0.8, uwNoise3(p * vec3(160.0, 18.0, 160.0))) * 0.8);
  vec3 verd = mix(vec3(0.05, 0.13, 0.085), vec3(0.14, 0.28, 0.2), uwNoise3(p * 230.0));
  c = mix(cu, verd, vg);
  dvMetal = mix(0.45, 1.0, wear) * (1.0 - vg);
  dvRough = mix(mix(0.52, 0.32, wear), 0.9, vg) + 0.06 * (n1 - 0.5);
  if (vDvAux.y > 7.5 && vDvAux.y < 8.5) {
    vec2 s = (p.xy - vec2(0.0, 0.482)) / vec2(0.043, 0.0135);
    float ov = abs(length(s) - 1.0);
    float letters = step(abs(s.y), 0.42) * step(abs(s.x), 0.8) * step(0.35, fract(s.x * 5.5)) * step(0.3, uwHash12(floor(vec2(s.x * 5.5, s.y * 3.0)) + 3.0));
    float mark = (1.0 - smoothstep(0.03, 0.08, ov)) + letters;
    c *= 1.0 - 0.14 * clamp(mark, 0.0, 1.0) * step(p.z, -0.1);
    dvRough += 0.08 * clamp(mark, 0.0, 1.0) * step(p.z, -0.1);
  }
  if (vDvAux.y > 3.5 && vDvAux.y < 4.5) { c = vec3(0.04, 0.025, 0.018); dvMetal = 0.2; dvRough = 0.8; }
  c = mix(c, vec3(0.5, 0.52, 0.5), dvSaltM * 0.4);
} else if (dvK == 3) {
  vec3 p = vDvRest;
  float n = uwFbm3(p * 30.0);
  bool boot = vDvAux.y > 11.5 && vDvAux.y < 12.5;
  vec3 br = mix(vec3(0.19, 0.13, 0.045), vec3(0.34, 0.24, 0.075), smoothstep(0.3, 0.7, n));
  br = mix(br, vec3(0.7, 0.52, 0.19), clamp(vDvAux.z, 0.0, 1.0) * 0.8);
  float vg = smoothstep(0.55, 0.95, vDvAux.x * (0.5 + uwNoise3(p * 90.0)));
  if (vDvAux.y > 9.5 && vDvAux.y < 10.5) vg = max(vg, smoothstep(0.0112, 0.0142, abs(vDvUv.y)) * smoothstep(0.3, 0.6, uwNoise3(p * vec3(150.0, 40.0, 150.0))));
  if (boot) {
    br = mix(vec3(0.07, 0.055, 0.03), vec3(0.13, 0.1, 0.05), smoothstep(0.3, 0.7, n));
    br = mix(br, vec3(0.3, 0.23, 0.1), clamp(vDvAux.z, 0.0, 1.0) * 0.45 * smoothstep(0.4, 0.7, uwNoise3(p * 220.0)));
    vg = max(vg, smoothstep(0.62, 0.9, uwNoise3(p * 70.0) * 0.55 + vDvAux.x * 0.6) * 0.8);
  }
  br *= mix(1.0, 0.9, uDvUnder);
  c = mix(br, vec3(0.06, 0.13, 0.09), vg * 0.6);
  dvMetal = (boot ? 1.0 : mix(0.55, 1.0, clamp(vDvAux.z, 0.0, 1.0))) * (1.0 - vg * 0.7);
  dvRough = (boot ? mix(0.66, 0.36, vDvAux.z * 0.4) : mix(0.45, 0.22, clamp(vDvAux.z, 0.0, 1.0))) + 0.1 * (n - 0.5) + 0.3 * vg;
} else if (dvK == 4) {
  vec3 p = vDvRest;
  float n = uwFbm3(p * 28.0);
  c = mix(vec3(0.11, 0.07, 0.03), vec3(0.24, 0.16, 0.07), smoothstep(0.25, 0.75, n));
  c = mix(c, vec3(0.42, 0.3, 0.14), clamp(vDvAux.z, 0.0, 1.0) * 0.75);
  c *= mix(1.0, 0.9, uDvUnder);
  float vg = smoothstep(0.55, 0.95, vDvAux.x * (0.5 + uwNoise3(p * 80.0)));
  c = mix(c, vec3(0.07, 0.15, 0.1), vg * 0.6);
  dvMetal = mix(0.5, 1.0, clamp(vDvAux.z, 0.0, 1.0)) * (1.0 - vg * 0.6);
  dvRough = mix(0.6, 0.42, vDvAux.z) + 0.25 * vg;
} else if (dvK == 15) {
  c = vec3(0.30, 0.30, 0.28) * (0.8 + 0.4 * uwNoise3(vDvRest * 300.0));
  dvMetal = 0.9; dvRough = 0.55;
} else if (dvK == 6) {
  vec3 p = vDvRest;
  float n = uwFbm3(p * 40.0);
  if (vDvAux.y > 13.5 && vDvAux.y < 14.5) {
    float nL = uwFbm3(p * 9.0), nM = uwNoise3(p * 55.0);
    float cr = smoothstep(0.7, 0.84, uwNoise3(p * vec3(90.0, 25.0, 90.0)));
    c *= 1.9 * (0.84 + 0.32 * nL) * (0.92 + 0.16 * nM);
    float dry = clamp(clamp(vDvAux.z, 0.0, 1.0) * 0.7 * (0.6 + 0.8 * nM) + smoothstep(0.55, 0.85, nL) * 0.3, 0.0, 1.0);
    c = mix(c, c * vec3(1.5, 1.45, 1.38) + vec3(0.016, 0.011, 0.007), dry * 0.6);
    c *= 1.0 - 0.18 * cr;
    float low = 1.0 - smoothstep(-0.915, -0.875, p.y);
    c = mix(c, vec3(0.15, 0.13, 0.1) * (0.85 + 0.3 * nM), low * 0.45 * smoothstep(0.3, 0.7, uwNoise3(p * 30.0) + 0.3));
    c = mix(c, vec3(0.3, 0.29, 0.26), dvSaltM * 0.5);
    dvRough = mix(0.88, 0.64, dvWet) + 0.08 * (n - 0.5) + 0.06 * dry;
    dvClear = dvWet * 0.12;
    if (vDvAux.w > 0.5) {
      float cd = vDvAux.w - 1.0;
      float cm = smoothstep(-1.0, 1.0, cd / max(fwidth(cd) * 0.75, 1e-6));
      float nb = uwFbm3(p * 16.0 + vec3(3.1, 0.0, 5.3));
      float tn = smoothstep(0.38, 0.72, uwFbm3(p * vec3(21.0, 26.0, 19.0) + vec3(7.0, 2.0, 1.0)));
      vec3 br = mix(vec3(0.2, 0.145, 0.065), vec3(0.34, 0.25, 0.1), smoothstep(0.3, 0.72, nb));
      br = mix(br, vec3(0.1, 0.075, 0.04), 0.6 * tn);
      float vg = tn * smoothstep(0.6, 0.8, uwFbm3(p * 34.0 + 11.0)) * 0.5;
      vg = max(vg, (1.0 - smoothstep(0.0, 0.0022, cd)) * 0.6 * cm);
      br *= mix(1.0, 0.9, uDvUnder);
      br = mix(br, vec3(0.07, 0.11, 0.075), vg * 0.55);
      c = mix(c, br, cm);
      dvMetal = cm * (1.0 - vg * 0.7);
      dvRough = mix(dvRough, 0.36 + 0.18 * tn + 0.06 * (nb - 0.5) + 0.3 * vg + 0.1 * uDvUnder, cm);
      dvClear *= 1.0 - cm;
    }
  } else {
    c *= 0.8 + 0.5 * n;
    c = mix(c, c * 1.45 + vec3(0.012, 0.009, 0.006), clamp(vDvAux.z, 0.0, 1.0) * 0.6);
    c = mix(c, vec3(0.3, 0.29, 0.26), dvSaltM * 0.5);
    dvRough = mix(0.84, 0.38, dvWet) + 0.1 * (n - 0.5);
    dvClear = dvWet * 0.4;
  }
} else if (dvK == 7) {
  vec3 p = vDvRest;
  float n = uwFbm3(p * 22.0), bl = smoothstep(0.66, 0.95, uwNoise3(p * 48.0) * 0.7 + uwNoise3(p * 11.0) * 0.3 + 0.25 * vDvAux.x);
  c = mix(vec3(0.042, 0.043, 0.045), vec3(0.064, 0.065, 0.067), n);
  c = mix(c, vec3(0.24, 0.24, 0.23), bl * 0.5);
  float knock = clamp(vDvAux.z, 0.0, 1.0) * smoothstep(0.45, 0.75, uwNoise3(p * 130.0));
  c = mix(c, vec3(0.2, 0.205, 0.215), knock * 0.6);
  dvMetal = 0.35 * knock; dvRough = mix(0.8, 0.95, bl) - 0.3 * knock;
  if (vDvAux.y > 11.5 && vDvAux.y < 12.5) {
    float nM = uwNoise3(p * 90.0);
    c = mix(vec3(0.088, 0.09, 0.094), vec3(0.13, 0.132, 0.135), n) * (0.9 + 0.2 * nM);
    c = mix(c, vec3(0.3, 0.3, 0.29), bl * 0.45);
    c = mix(c, vec3(0.16, 0.145, 0.115), smoothstep(0.45, 0.75, uwNoise3(p * 35.0 + 7.0)) * 0.35);
    c = mix(c, vec3(0.27, 0.275, 0.285), knock * 0.7);
    dvMetal = 0.1 + 0.15 * knock; dvRough = mix(0.84, 0.95, bl) - 0.2 * knock;
  }
  if (vDvAux.w > 0.5) {
    float sc = uwNoise3(vec3(p.x * 700.0, p.y * 40.0, p.z * 45.0));
    float wr = clamp(vDvAux.z, 0.0, 1.0) * (0.85 + 0.15 * sc);
    float gr = uwNoise3(p * 160.0);
    c = mix(vec3(0.12, 0.11, 0.09), vec3(0.2, 0.18, 0.14), smoothstep(0.3, 0.8, n) * 0.7) * (0.88 + 0.24 * gr);
    c = mix(c, vec3(0.4, 0.405, 0.41) * (0.93 + 0.14 * sc), smoothstep(0.1, 0.65, wr));
    dvMetal = 0.15 * wr; dvRough = mix(0.92, 0.58, wr);
  }
} else if (dvK == 8) {
  float r = max(vDvAux.w, 0.003);
  float f = uwNoise3(vec3(vDvUv.x * 500.0, vDvUv.y / r * 2.0, 0.0));
  vec3 dry = vec3(0.55, 0.40, 0.18) * (0.8 + 0.35 * f), wetc = vec3(0.235, 0.162, 0.072) * (0.85 + 0.3 * f);
  c = mix(dry, wetc, dvWet);
  if (vDvAux.y > 14.5 && vDvAux.y < 15.5) c = mix(vec3(0.4, 0.34, 0.25), vec3(0.156, 0.114, 0.07), dvWet) * (0.85 + 0.3 * f);
  dvRough = mix(0.95, 0.7, dvWet);
  dvSheen = 0.25;
} else if (dvK == 9) {
  float t = vDvUv.y / 0.0119;
  float iris = smoothstep(0.80, 0.83, t), pupil = smoothstep(0.945, 0.955, t);
  vec3 scl = vec3(0.34, 0.29, 0.24);
  vec3 ir = mix(vec3(0.05, 0.028, 0.012), vec3(0.11, 0.06, 0.025), uwNoise3(vec3(vDvUv.x * 900.0, t * 30.0, 0.0)));
  ir *= mix(0.55, 1.0, smoothstep(0.83, 0.86, t));
  c = mix(scl, ir, iris);
  c = mix(c, vec3(0.005), pupil);
  c = mix(c, c * vec3(1.0, 0.8, 0.75), smoothstep(0.3, 0.0, t) * 0.4);
  dvRough = 0.05; dvClear = 1.0; dvClearR = 0.03;
  dvFace = 1.0;
} else if (dvK == 10) {
  float n = uwNoise3(vDvRest * vec3(1400.0, 200.0, 1400.0));
  c = mix(vec3(0.014, 0.01, 0.007), vec3(0.05, 0.035, 0.025), n);
  c = mix(c, vec3(0.25, 0.24, 0.22), step(0.93, uwNoise3(vDvRest * vec3(1100.0, 150.0, 1100.0) + uDvSeed)) * 0.5);
  c *= 1.0 - 0.5 * vDvAux.x;
  dvRough = mix(0.55, 0.35, dvWet);
  dvSheen = 0.4; dvSheenR = 0.35;
  dvFace = 1.0;
} else if (dvK == 11) {
  c *= 0.75 + 0.5 * uwNoise3(vDvRest * vec3(40.0, 40.0, 400.0));
  dvRough = mix(0.8, 0.55, dvWet);
} else if (dvK == 12) {
  c = vec3(0.018, 0.024, 0.052) * (0.8 + 0.4 * uwNoise3(vDvRest * 300.0));
  dvRough = 0.95; dvSheen = 0.5; dvSheenR = 0.7;
  dvFace = 1.0;
} else if (dvK == 13) {
  vec2 u = vec2(vDvUv.x, vDvUv.y) / 0.03;
  vec2 g = abs(fract(vec2(u.x + u.y, u.x - u.y) * 0.7071) - 0.5);
  float line = min(g.x, g.y);
  float fw = fwidth(line) * 1.2 + 0.001;
  if (line > 0.058 + fw) discard;
  c = mix(vec3(0.2, 0.1, 0.042), vec3(0.12, 0.052, 0.022), dvWet) * (0.8 + 0.4 * uwNoise3(vec3(u * 9.0, 1.0)));
  dvRough = 0.9;
} else if (dvK == 14) {
  vec3 p = vDvRest;
  float nL = uwFbm3(p * 6.0), nM = uwNoise3(p * 30.0);
  float cav;
  dvFolds(p, cav);
  c *= (0.84 + 0.3 * nL) * (0.94 + 0.12 * nM);
  c = mix(c, c * 1.18 + 0.01, smoothstep(0.1, 0.4, vDvAux.z) * 0.4);
  if (vDvAux.w > 0.5) c = mix(c, vec3(0.025, 0.04, 0.11) * (0.9 + 0.2 * nM), smoothstep(0.45, 0.55, fract(p.y * 26.0 + 0.3 * uwNoise3(p * 20.0))));
  c *= (1.0 - 0.4 * cav) * (1.0 - 0.35 * vDvAux.x);
  dvRough = 0.92;
  dvSheen = 0.4; dvSheenR = 0.65;
  float skinM = smoothstep(0.3, 0.7, vDvAux.z);
  if (skinM > 0.0) {
    vec3 sk = diffuseColor.rgb * (0.86 + 0.28 * uwFbm3(p * 60.0)) * (0.92 + 0.16 * uwNoise3(p * 180.0));
    sk = mix(sk * (1.0 - 0.55 * vDvAux.x), vec3(0.17, 0.05, 0.03), vDvAux.x * 0.3);
    c = mix(c, sk, skinM);
    dvRough = mix(dvRough, 0.5, skinM);
    dvSheen = mix(dvSheen, 0.12, skinM); dvSheenR = mix(dvSheenR, 0.4, skinM);
  }
} else if (dvK == 16) {
  c = vec3(0.3, 0.3, 0.31);
  dvRough = 0.4;
}
diffuseColor.rgb = c;
`;
const DV_FRAG_ROUGH = `
roughnessFactor = clamp(dvRough, 0.045, 1.0);
metalnessFactor = clamp(dvMetal, 0.0, 1.0);
`;
const DV_FRAG_NORMAL = `
{
  vec2 dvDH = vec2(dFdx(dvHs), dFdy(dvHs)) + dvDHa;
  if (dvK == 0) {
    normal = dvPerturb(-vViewPosition, normal, dvDH);
  } else {
    vec4 dvA = vDvAux;
    float dvH0 = dvRelief(dvK, dvQ, dvTw, dvFp, vDvUv, dvA);
    float dvHx = dvRelief(dvK, dvQ + dvQx, dvTw, dvFp, vDvUv + dFdx(vDvUv), dvA) - dvH0;
    float dvHy = dvRelief(dvK, dvQ + dvQy, dvTw, dvFp, vDvUv + dFdy(vDvUv), dvA) - dvH0;
    normal = dvPerturb(-vViewPosition, normal, vec2(dvHx, dvHy));
  }
}
`;
const DV_FRAG_PHYS = `
if (dvK == 0 || dvK == 14 || dvK == 12 || dvK == 8 || dvK == 13) {
  float dry = (1.0 - dvWet * (dvK == 0 ? 1.0 : 0.5)) * (1.0 - dvRub);
  material.specularColor *= mix(1.0, 0.3, dry);
  material.specularF90 *= mix(1.0, 0.2, dry);
} else if (dvK == 6) {
  material.specularF90 *= mix(0.45, 1.0, dvWet);
} else if (dvK == 7) {
  material.specularColor *= 0.45;
  material.diffuseColor *= 0.45;
  material.specularF90 *= 0.5;
}
{
  float dvUw = mix(1.0, dvK == 0 ? mix(0.1, 0.15, dvRub) : 0.35, uDvUnder);
  float dvUw90 = mix(1.0, dvK == 0 ? 0.3 : 0.35, uDvUnder);
  material.specularColor = mix(material.specularColor * dvUw, material.specularColor, metalnessFactor);
  material.diffuseColor *= mix(dvUw, 1.0, metalnessFactor);
  material.specularF90 = mix(material.specularF90 * dvUw90, material.specularF90, metalnessFactor);
  dvClear *= mix(1.0, dvK == 0 ? 0.08 * dvRub : 0.08, uDvUnder);
  if (dvK >= 2 && dvK <= 4) material.roughness = min(1.0, material.roughness + (dvK == 2 ? 0.04 : 0.1) * uDvUnder);
  dvSheen *= mix(1.0, dvK == 0 ? 0.18 : 0.35, uDvUnder);
}
material.specularColorBlended = mix(material.specularColor, material.diffuseColor, metalnessFactor);
#ifdef USE_CLEARCOAT
  material.clearcoat = clamp(dvClear, 0.0, 1.0);
  material.clearcoatRoughness = clamp(dvClearR + geometryRoughness, 0.0525, 1.0);
#endif
#ifdef USE_SHEEN
  material.sheenColor = diffuseColor.rgb * dvSheen * 1.5 + vec3(dvSheen * 0.05);
  #if NUM_DIR_LIGHTS > 0
    if (dvAniso > 0.0) {
      float dvTh = dot(dvFib, normalize(directionalLights[0].direction + normalize(vViewPosition)));
      material.sheenColor *= mix(1.0, 0.4 + 1.9 * pow(max(1.0 - dvTh * dvTh, 0.0), 8.0), dvAniso);
    }
  #endif
  material.sheenRoughness = clamp(dvSheenR, 0.07, 1.0);
#endif
`;
const DV_FRAG_LIGHTS = `
if (dvK == 0 && uDvUnder < 0.99) {
  float dvId = dot(reflectedLight.indirectDiffuse, vec3(0.2126, 0.7152, 0.0722));
  float dvSh = dvId / max(dvId + dot(reflectedLight.directDiffuse, vec3(0.2126, 0.7152, 0.0722)), 1e-5);
  reflectedLight.indirectDiffuse *= mix(vec3(1.0), vec3(1.16, 1.0, 0.78), dvSh * dvSh * (1.0 - uDvUnder));
}
if (uDvUnder > 0.01) {
  vec3 dvNw = inverseTransformDirection(normal, viewMatrix);
  float dvWy = cameraPosition.y + (inverseTransformDirection(-vViewPosition, viewMatrix) * length(vViewPosition)).y;
  vec3 dvKa = vec3(0.11, 0.033, 0.026);
  vec3 dvDn = exp(-dvKa * max(0.0, uDvWaterY - uDvFloorY));
  dvDn = mix(dvDn, vec3(dot(dvDn, vec3(0.2126, 0.7152, 0.0722))), uAdapt);
  vec3 dvEb = uDvSunE * dvDn * vec3(0.62, 0.64, 0.56) * uDvBounce
    * exp(-(dvKa + 0.12) * max(0.0, dvWy - uDvFloorY));
  vec3 dvIrr = dvEb * (0.5 - 0.5 * dvNw.y);
  reflectedLight.indirectDiffuse += dvIrr * BRDF_Lambert(material.diffuseContribution) * uDvUnder * (1.0 - 0.55 * clamp(vDvAux.x, 0.0, 1.0)) * (1.0 - dvFace);
  float dvDeep = clamp((1.0 - exp(-(dvKa.r - dvKa.g) * max(0.0, uDvWaterY - dvWy))) / 0.7, 0.0, 1.0);
  vec3 dvWarmK = dvK == 0 ? mix(vec3(1.26, 0.96, 0.84), vec3(1.45, 0.92, 0.72), dvRub) : vec3(1.45, 0.92, 0.72);
  vec3 dvWarm = mix(vec3(1.0), dvWarmK, (1.0 - smoothstep(3.5, 12.0, length(vViewPosition))) * uDvUnder * dvDeep);
  reflectedLight.directDiffuse *= dvWarm;
  reflectedLight.indirectDiffuse *= dvWarm;
  reflectedLight.directSpecular *= mix(vec3(1.0), dvWarm, metalnessFactor);
  reflectedLight.indirectSpecular *= mix(vec3(1.0), dvWarm, metalnessFactor);
}
if (dvFace > 0.5 && uDvFaceAmb < 0.999) {
  float vis = 0.0;
  #if NUM_DIR_LIGHTS > 0
    vec3 dvL = directionalLights[0].direction;
    for (int i = 0; i < 3; i++) {
      float cw = i == 0 ? mix(0.8, 0.2, uDvFaceOpen) : 0.86;
      vis = max(vis, smoothstep(cw, cw + 0.1, dot(dvL, uDvWinV[i])));
    }
  #endif
  reflectedLight.directDiffuse *= vis;
  reflectedLight.directSpecular *= vis;
  float amb = mix(uDvFaceAmb, 1.0, uDvFaceOpen * 0.8);
  float win = mix(0.3 + 1.0 * max(dot(normal, uDvWinV[0]), 0.0), 1.0, uDvFaceOpen * 0.7);
  reflectedLight.indirectDiffuse *= amb * win * vec3(1.15, 0.92, 0.78);
  reflectedLight.indirectSpecular *= amb * win;
  if (dvK == 9) {
    vec3 dvR = reflect(-normalize(vViewPosition), normal);
    float cl = pow(max(dot(dvR, uDvWinV[0]), 0.0), 180.0);
    reflectedLight.directSpecular += vec3(0.9, 0.95, 1.0) * cl * mix(1.2, 0.55, uDvUnder);
  }
}
`;
const DV_GLASS_DECL = `
uniform float uDvFade;
uniform float uDvFog;
uniform float uDvSalt;
uniform float uDvUnder;
uniform float uDvFrame;
varying vec2 vDvGUv;
`;
const DV_GLASS_FRAG = `
{
  float r = length(vDvGUv);
  float edge = smoothstep(0.75, 1.0, r);
  float fn = uwNoise3(vec3(vDvGUv * 7.0, 0.3)) * 0.6 + uwNoise3(vec3(vDvGUv * 23.0, 1.7)) * 0.4;
  float fog = clamp(uDvFog * 1.4 * smoothstep(0.66, 1.0, r + 0.22 * (fn - 0.5)) * mix(1.0, 0.7, uDvUnder), 0.0, 1.0);
  float salt = uDvSalt * (1.0 - uDvUnder) * step(0.82, uwNoise3(vec3(vDvGUv * 60.0, 5.0)));
  diffuseColor.rgb = mix(vec3(0.004, 0.012, 0.01), vec3(0.4, 0.42, 0.42), fog * 0.8) + edge * vec3(0.0, 0.03, 0.02);
  diffuseColor.a = clamp(0.05 + 0.22 * edge + fog * 0.6 + salt * 0.5, 0.0, 0.95);
  if (uDvFade < 0.999) {
    float dvN = fract(52.9829189 * fract(dot(gl_FragCoord.xy + 5.588238 * uDvFrame, vec2(0.06711056, 0.00583715))));
    if (dvN >= uDvFade) discard;
  }
}
`;
const DV_GLASS_OUT = `
float dvFr = pow(1.0 - clamp(abs(dot(normalize(vViewPosition), normal)), 0.0, 1.0), 5.0);
float dvKs = mix(1.0, 0.06 + 0.94 * dvFr, uDvUnder);
gl_FragColor = vec4(totalDiffuse * diffuseColor.a + totalSpecular * dvKs + totalEmissiveRadiance, clamp(diffuseColor.a + dvFr * 0.3 * (1.0 - uDvUnder), 0.0, 1.0));
`;
const DV_TETHER_VERT = `
attribute float aTk;
attribute float aTw;
flat varying float vTk;
varying float vTw;
varying vec2 vTUv;
`;
const DV_TETHER_VSET = `
vTk = aTk; vTw = aTw; vTUv = uv;
`;
const DV_TETHER_DECL = `
uniform float uDvFade;
uniform float uDvTFade;
uniform float uDvTFocus;
uniform float uDvFrame;
uniform float uDvWet;
flat varying float vTk;
varying float vTw;
varying vec2 vTUv;
vec3 dvTPerturb(vec3 sp, vec3 sn, vec2 dH) {
  vec3 sx = dFdx(sp), sy = dFdy(sp);
  vec3 r1 = cross(sy, sn), r2 = cross(sn, sx);
  float det = dot(sx, r1);
  vec3 g = sign(det) * (dH.x * r1 + dH.y * r2);
  return normalize(abs(det) * sn - g);
}
uniform vec3 uTwAbs;
uniform vec3 uTwKd;
uniform vec3 uTwDeep;
uniform vec3 uTwMid;
uniform vec3 uTwUp;
uniform vec3 uTwSun;
uniform float uTwLightK;
vec3 dvTVeil() {
  vec3 V = vWPos - cameraPosition;
  float d = max(length(V), 1e-3);
  V /= d;
  float camDepth = max(uWaterY - cameraPosition.y, 0.0);
  float u = V.y + 0.05;
  vec3 c = u >= 0.0 ? mix(uTwMid, uTwUp, smoothstep(0.0, 0.8, u)) : mix(uTwMid, uTwDeep, smoothstep(0.0, 0.8, -u));
  float mu = dot(V, uSunW);
  c += uTwSun * (0.3 * pow(0.5 + 0.5 * mu, 4.0) + 0.7 * pow(max(mu, 0.0), 24.0));
  c *= exp(-camDepth * uTwKd) * uLight * uTwLightK;
  vec3 ce = max(uTwAbs - uTwKd * V.y, uTwAbs * 0.35);
  vec3 tau = uTwAbs * d;
  tau.r *= d / (d + 12.0);
  return min(c * (uTwAbs / ce) * exp(min(tau - ce * d, vec3(8.0))), vec3(24.0));
}
float dvTRel(vec2 uv, float tk) {
  float a = uv.y * 6.2832;
  return 0.0001 * smoothstep(0.6, 1.0, sin(uv.x * 6.2832 / 0.035 + a)) + 0.00012 * uwNoise3(vec3(uv.x * 90.0, a * 3.0, 1.0)) + 0.00003 * sin(uv.x * 6.2832 / 0.0025 + a * 40.0);
}
`;
const DV_TETHER_OUT = `
if (uDvTFade < 0.999 && cameraPosition.y <= uWaterY - 0.05) gl_FragColor.rgb = mix(dvTVeil(), gl_FragColor.rgb, uDvTFade);
`;
const DV_TETHER_COLOR = `
{
  float dvZ = length(vViewPosition);
  float dvA = smoothstep(0.12, 0.3, dvZ);
  if (cameraPosition.y > uWaterY - 0.05) dvA *= uDvTFade;
#ifdef DV_TBLEND
  if (dvA >= 0.999 || dvA < 0.004) discard;
  diffuseColor.a *= dvA;
#else
  if (dvA < 0.999) discard;
#endif
}
if (uDvFade < 0.999 && vTUv.x < 3.0) {
  float dvN = fract(52.9829189 * fract(dot(gl_FragCoord.xy + 5.588238 * uDvFrame, vec2(0.06711056, 0.00583715))));
  if (dvN >= mix(uDvFade, 1.0, smoothstep(1.0, 3.0, vTUv.x))) discard;
}
float dvTWet = max(uDvWet, vTw);
float dvTRough = 0.6;
float dvTMetal = 0.0;
{
  float n = uwNoise3(vec3(vTUv.x * 30.0, vTUv.y * 4.0, 2.0));
  diffuseColor.rgb = vec3(0.028, 0.026, 0.024) * (0.8 + 0.4 * n);
  dvTRough = mix(0.7, 0.45, dvTWet);
  float cp = max(step(fract((vTUv.x + 0.2) / 15.0), 0.012), 1.0 - smoothstep(0.026, 0.04, vTUv.x));
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.26, 0.19, 0.075) * (0.8 + 0.4 * n), cp);
  dvTMetal = cp; dvTRough = mix(dvTRough, 0.45, cp);
}
`;
const DV_TETHER_ROUGH = `
roughnessFactor = dvTRough;
metalnessFactor = dvTMetal;
`;
const DV_TETHER_NORMAL = `
{
  vec2 duvx = dFdx(vTUv), duvy = dFdy(vTUv);
  float h0 = dvTRel(vTUv, vTk);
  normal = dvTPerturb(-vViewPosition, normal, vec2(dvTRel(vTUv + duvx, vTk) - h0, dvTRel(vTUv + duvy, vTk) - h0));
}
`;

const ONE3 = new THREE.Vector3(1, 1, 1);
const L1 = 0.29, L2 = 0.245;
const TUG_REACH = 0.64;
const TUG_BACK = 0.08, TUG_BACK_UP = 0.3, TUG_IN = 0.32, SINK_BACK = 0.04, SINK_BACK_UP = 0.55;
const LT = 0.40, LS = Math.hypot(0.40, 0.025), KNEE_OFF = Math.atan2(0.025, 0.40);
const THIGH_OFF = Math.atan2(0.01, 0.40), THC = Math.cos(THIGH_OFF), THS = Math.sin(THIGH_OFF);
const ANCH = [new THREE.Vector3(-0.018, -0.066, -4e-3), new THREE.Vector3(0.018, -0.066, -4e-3)];
const AML = [[[0, 0, -1], [0, -1, 0], [-1, 0, 0]], [[0, 0, 1], [0, -1, 0], [1, 0, 0]]].map(([x, y, z], a) =>
  new THREE.Matrix4().makeBasis(new THREE.Vector3(...x), new THREE.Vector3(...y), new THREE.Vector3(...z)).setPosition(ANCH[a]));
const THUMB_SQ = 2.1;
const CK_DIP = [0.03, 0.02, 5, 3];
const CK_SINK = 0.25;
const THUMB_EXT = -0.9;
const FCAP = 6 * Math.PI / 180, FCAP_O = 6 * Math.PI / 180, TCAP = 0.1;
const FDEEP = 0.003, FCAP_D = 6 * Math.PI / 180, TCAP_D = 0.11;
const FHOLD = 0.002;
const FRZ_T = 0.3;
const FMARGIN = 0.0025, FMARGIN_IN = 0.0011, TMARGIN_IN = -3e-4;
const SNUG = { mg: 0.0012, hold: 0.0012, deep: 0.0008, tdeep: 0, fit: 9, tk: 2.5, lo: 0.0002, hi: 0.0028, ts: 0.01, tr: 0.12 };
const WRIST_FL = 60 * Math.PI / 180, WRIST_DV = 28 * Math.PI / 180, WRIST_V = 5 * Math.PI / 180, WRIST_EASE = 0.12, WRIST_EASE_T = 0.05;
const TW_ACC = 1.5 * Math.PI / 180;
const FEASE = 0.09;
const GOAL_BLEND = 0.3, GOAL_V = 0.6;
const CURL_T = 0.4, CURL_T_O = 0.4;
const FJ_CAP = 5.8 * Math.PI / 180, TJ_CAP = 0.09;
const FJ_ACC = 1.3 * Math.PI / 180, TJ_ACC = 0.02;
let _spV = 0;
function springTo(x, v, x1, vmax, acc, k60) {
  const d = x1 - x;
  const vw = Math.sign(d) * Math.min(vmax, Math.sqrt(2 * acc * Math.abs(d)));
  let nv = v + clamp(vw - v, -acc * k60, acc * k60);
  nv = clamp(nv, -vmax, vmax);
  let s = nv * k60;
  if (s * d > 0 && Math.abs(s) > Math.abs(d)) { s = d; nv = d / k60; }
  _spV = nv;
  return x + s;
}
const REST_W_OMEGA = 9;
function makeRig(opts = {}) {
  const bones = BONES.map((bn) => { const o = new THREE.Bone(); o.name = 'dv_' + bn.name; return o; });
  BONES.forEach((bn, i) => {
    bones[i].position.copy(BINDM.offs[i]);
    bones[i].quaternion.copy(BINDM.q[i]);
    if (bn.parent >= 0) bones[bn.parent].add(bones[i]);
  });
  const Qf = BONES.map(() => new THREE.Quaternion());
  const Pf = BINDM.offs.map((v) => v.clone());
  const Mm = BONES.map(() => new THREE.Matrix4());
  const TB = new Float32Array(NBB * 3), EB = new Float32Array(NBB * 3), EV = new Float32Array(NBB * 3);
  const RT = new Float32Array(3), RS = new Float32Array(3), RV = new Float32Array(3);
  const SPW = new Float32Array(NBB), SPZ = new Float32Array(NBB), VCAP = new Float32Array(NBB);
  const IKP = new Float32Array(NBB * 3), IKF = new Int32Array(NBB).fill(-9);
  const SPR = Object.assign({ root: [8, 0.85], pelvis: [12, 0.85], spine1: [11, 0.85], spine2: [10, 0.85], chest: [9, 0.85], neck: [10, 0.8], head: [11, 0.8],
    jaw: [18, 0.7], brow: [16, 0.7], clav: [11, 0.8], uarm: [9, 0.72], farm: [9, 0.7], hand: [10, 0.68], thumb1: [14, 0.8], thumb2: [14, 0.8], finger: [14, 0.75],
    thigh: [14, 0.85], shin: [14, 0.8], foot: [14, 0.75], toe: [16, 0.8] }, opts.springs || {});
  BONES.forEach((bn, i) => {
    let key = bn.name.replace(/[RL]$/, '');
    if (/^f[IMRP][12]$/.test(key)) key = 'finger';
    const v = SPR[key];
    if (v) { SPW[i] = v[0]; SPZ[i] = v[1]; }
    VCAP[i] = key === 'thigh' ? 3.14 : key === 'shin' ? 4.19 : key === 'uarm' || key === 'farm' ? 5.24 : 0;
  });
  const F = { dt: 0, t: 0, snap: true, stiff: 1, under: 0, frame: 0, mG: new THREE.Matrix4(), mInv: new THREE.Matrix4(), qG: new THREE.Quaternion(), qGi: new THREE.Quaternion() };
  const _lm = new THREE.Matrix4(), _m1 = new THREE.Matrix4();
  const _qd = new THREE.Quaternion(), _qe = new THREE.Quaternion(), _qc = new THREE.Quaternion(), _qT = new THREE.Quaternion();
  const _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _q3 = new THREE.Quaternion();
  const _p1 = new THREE.Vector3(), _p2 = new THREE.Vector3(), _p3 = new THREE.Vector3(), _u = new THREE.Vector3(), _vv = new THREE.Vector3();
  const _xA = new THREE.Vector3(), _yA = new THREE.Vector3(), _zA = new THREE.Vector3(), _tg = new THREE.Vector3(), _gG = new THREE.Vector3(), _gB = new THREE.Vector3();
  const _mC = new THREE.Matrix4(), _e = new THREE.Euler(), _XH = new THREE.Vector3(1, 0, 0);
  const _qe2 = new THREE.Quaternion(), _p1w = new THREE.Vector3(), _zw = new THREE.Vector3(), _ew = new THREE.Euler();
  const fkOne = (i) => {
    _lm.compose(Pf[i], Qf[i], ONE3);
    const pa = BONES[i].parent;
    if (pa < 0) Mm[i].copy(_lm); else Mm[i].multiplyMatrices(Mm[pa], _lm);
  };
  const fkAll = () => { for (let i = 0; i < NBB; i++) fkOne(i); };
  const fkFrom = (i0) => {
    fkOne(i0);
    for (let i = i0 + 1; i < NBB; i++) {
      let p = BONES[i].parent, under = false;
      while (p >= 0) { if (p === i0) { under = true; break; } p = BONES[p].parent; }
      if (under) fkOne(i);
    }
  };
  const applyModelRot = (i, qm) => {
    _m1.extractRotation(Mm[BONES[i].parent]);
    _qe.setFromRotationMatrix(_m1);
    _qd.copy(_qe).invert().multiply(qm).multiply(_qe);
    Qf[i].premultiply(_qd);
  };
  const TAU_ = Math.PI * 2;
  const wrapNear = (x, r) => x - Math.round((x - r) / TAU_) * TAU_;
  function eulerNear(q, ref, ro, out, oo) {
    _e.setFromQuaternion(q, 'XZY');
    const px = ref[ro], py = ref[ro + 1], pz = ref[ro + 2];
    let x = wrapNear(_e.x, px), y = wrapNear(_e.y, py), z = wrapNear(_e.z, pz);
    const x2 = wrapNear(_e.x + Math.PI, px), y2 = wrapNear(_e.y + Math.PI, py), z2 = wrapNear(Math.PI - _e.z, pz);
    if ((x2 - px) ** 2 + (y2 - py) ** 2 + (z2 - pz) ** 2 < (x - px) ** 2 + (y - py) ** 2 + (z - pz) ** 2) { x = x2; y = y2; z = z2; }
    out[oo] = x; out[oo + 1] = y; out[oo + 2] = z;
  }
  function ikHand(b, W) {
    const o = b * 3, fresh = IKF[b] !== F.frame || F.snap || F.dt < 1e-4;
    for (let c = o; c < o + 3; c++) {
      if (fresh) EV[c] *= 1 - W;
      else { let v = (EB[c] - IKP[c]) / F.dt; v = v > 6 ? 6 : v < -6 ? -6 : v; EV[c] += (v - EV[c]) * W; }
      IKP[c] = EB[c];
    }
    IKF[b] = F.frame + 1;
  }
  function stepSprings() {
    F.frame++;
    const dt = F.dt, st = F.stiff;
    if (F.snap) {
      EB.set(TB); EV.fill(0);
      RS[0] = RT[0]; RS[1] = RT[1]; RS[2] = RT[2]; RV.fill(0);
    } else if (dt > 0) {
      const n = Math.min(12, Math.ceil(dt * 120)), h = dt / n;
      const uw = F.under;
      for (let i = 0; i < NBB; i++) {
        const w0 = SPW[i] * st, o = i * 3;
        if (w0 <= 0) { EB[o] = TB[o]; EB[o + 1] = TB[o + 1]; EB[o + 2] = TB[o + 2]; continue; }
        const K2 = w0 * w0, D = 2 * (SPZ[i] + (1 - SPZ[i]) * uw) * w0, cap = VCAP[i] > 0 && uw > 0.5 ? VCAP[i] : 1e9;
        for (let c = o; c < o + 3; c++) {
          let x = EB[c], v = EV[c];
          const tg = TB[c];
          for (let k = 0; k < n; k++) { v += (K2 * (tg - x) - D * v) * h; v = v > cap ? cap : v < -cap ? -cap : v; x += v * h; }
          EB[c] = x; EV[c] = v;
        }
      }
      const rw = 9 * st, K2 = rw * rw, D = 2 * 0.9 * rw;
      for (let c = 0; c < 3; c++) {
        let x = RS[c], v = RV[c];
        const tg = RT[c];
        for (let k = 0; k < n; k++) { v += (K2 * (tg - x) - D * v) * h; x += v * h; }
        RS[c] = x; RV[c] = v;
      }
    }
    for (let i = 0; i < NBB; i++) eulerQuat(Qf[i], EB, i * 3, ORDZ[i]);
    Pf[0].set(RS[0], RS[1], RS[2]);
  }
  function helpers() { applyHelpers(Qf, EB); }
  function writeBones() {
    for (let i = 0; i < NBB; i++) {
      const bo = bones[i], p = Pf[i], q = Qf[i], bp = bo.position, bq = bo.quaternion;
      bp.x = p.x; bp.y = p.y; bp.z = p.z;
      bq._x = q._x; bq._y = q._y; bq._z = q._z; bq._w = q._w;
    }
  }

  const LEG = [0, 1].map((a) => {
    const S = SIDES[a];
    return { side: a ? -1 : 1, thigh: BI['thigh' + S], shin: BI['shin' + S], foot: BI['foot' + S], qa: new THREE.Quaternion(), qk: new THREE.Quaternion(), reach: 1 };
  });
  function solveLeg(a, T, pole, footQ, W) {
    const L = LEG[a];
    _m1.extractRotation(Mm[BI.pelvis]);
    _qe.setFromRotationMatrix(_m1);
    _p1.setFromMatrixPosition(Mm[L.thigh]);
    let ux = T.x - _p1.x, uy = T.y - _p1.y, uz = T.z - _p1.z;
    const D = Math.sqrt(ux * ux + uy * uy + uz * uz);
    if (D < 1e-5) return;
    ux /= D; uy /= D; uz /= D;
    const Dmax = (LT + LS) * 0.9985, Dc = D < 0.2 ? 0.2 : D > Dmax ? Dmax : D;
    L.reach = D / Dmax;
    if (W <= 1e-3) return;
    const pd = pole.x * ux + pole.y * uy + pole.z * uz;
    let vx = pole.x - ux * pd, vy = pole.y - uy * pd, vz = pole.z - uz * pd;
    const vl = Math.sqrt(vx * vx + vy * vy + vz * vz) || 1;
    vx /= vl; vy /= vl; vz /= vl;
    let ca0 = (LT * LT + Dc * Dc - LS * LS) / (2 * LT * Dc);
    ca0 = ca0 < -1 ? -1 : ca0 > 1 ? 1 : ca0;
    const sa0 = Math.sqrt(1 - ca0 * ca0), ca = ca0 * THC + sa0 * THS, sa = sa0 * THC - ca0 * THS;
    _yA.x = -ux * ca - vx * sa; _yA.y = -uy * ca - vy * sa; _yA.z = -uz * ca - vz * sa;
    _zA.x = ux * sa - vx * ca; _zA.y = uy * sa - vy * ca; _zA.z = uz * sa - vz * ca;
    _xA.crossVectors(_yA, _zA);
    _m1.makeBasis(_xA, _yA, _zA);
    L.qa.setFromRotationMatrix(_m1);
    let cg = (LT * LT + LS * LS - Dc * Dc) / (2 * LT * LS);
    cg = cg < -1 ? -1 : cg > 1 ? 1 : cg;
    const kh = 0.5 * Math.max(0, Math.PI - Math.acos(cg) - KNEE_OFF - THIGH_OFF);
    L.qk._x = -Math.sin(kh); L.qk._y = 0; L.qk._z = 0; L.qk._w = Math.cos(kh);
    _qc.copy(_qe).invert().multiply(L.qa);
    Qf[L.thigh].slerp(_qc, W);
    Qf[L.shin].slerp(L.qk, W);
    if (footQ) {
      _qc.copy(_qe).multiply(Qf[L.thigh]).multiply(Qf[L.shin]).invert().multiply(footQ);
      Qf[L.foot].slerp(_qc, W);
    }
    eulerNear(Qf[L.thigh], EB, L.thigh * 3, EB, L.thigh * 3);
    eulerNear(Qf[L.shin], EB, L.shin * 3, EB, L.shin * 3);
    ikHand(L.thigh, W); ikHand(L.shin, W);
    if (footQ && !ORDZ[L.foot]) { eulerNear(Qf[L.foot], EB, L.foot * 3, EB, L.foot * 3); ikHand(L.foot, W); }
  }

  const POLE = [new THREE.Vector3(0.55, -0.78, 0.22).normalize(), new THREE.Vector3(-0.55, -0.78, 0.22).normalize()];
  const RCH = [0, 1].map((a) => {
    const S = SIDES[a];
    return {
      side: a ? -1 : 1, sg: a ? 1 : -1, has: false, touched: false, req: 0, w: 0, grip: -1, hasPalm: false, hold: false, holdW: 0,
      poleInit: false, reachable: 0, tw: NaN, twv: 0, pw: new THREE.Vector3(), pwOk: false, spd: 0,
      src: -1, gbT: 9, gbD: 0, gFrom: new THREE.Vector3(), gUsed: new THREE.Vector3(), euOk: false, eu: new Float32Array(3), active: false, latch: false,
      restW: 0, restOn: false, restGrip: 0.5, offT: 9, twKeep: NaN, rtm: new THREE.Vector3(), rpalm: new THREE.Vector3(), cf: new Float32Array(4), unreach: 0,
      touch: null, inHand: false, squeeze: false, snug: false, toTouch: new THREE.Matrix4(), dev: 0, devS: 0, xPole: false, xPoleV: new THREE.Vector3(),
      k1: new Float32Array(4), k2: new Float32Array(4), k1b: new Float32Array(4), k2b: new Float32Array(4),
      t1: new Float32Array(4), t2: new Float32Array(4), tp: 0, tpb: 0, tpt: 0, fOk: false, fresh: false, gS: -1, tgS: 0, hT: 0, still: false,
      tight: false, follow: null, curlOn: false, curlRef: null, curlT: -9, cW: 0, lc1: new Float32Array(4), lc2: new Float32Array(4), lv1: new Float32Array(4), lv2: new Float32Array(4), tpv: 0, lcOk: false, ck1: new Float32Array(4), ck2: new Float32Array(4), ctp: 0, cf1: new Float32Array(4), cf2: new Float32Array(4), cftp: 0,
      gW: 0, gOn: false, gGrip: 0.4, gtm: new THREE.Vector3(), gpalm: new THREE.Vector3(), gPole: new THREE.Vector3(), gPoleW: 0, gSpd: 0,
      gprev: new THREE.Vector3(), gavg: new THREE.Vector3(), graw: new THREE.Vector3(), gspd: 0, aW: 0,
      info: { weight: 0, reachable: false, contact: 0, holding: 0 },
      target: new THREE.Vector3(), tm: new THREE.Vector3(), ts: new THREE.Vector3(), palm: new THREE.Vector3(), elbow: new THREE.Vector3(),
      clavQ: new THREE.Quaternion(), qa: new THREE.Quaternion(), qf: new THREE.Quaternion(), qh: new THREE.Quaternion(),
      fing: new THREE.Vector3(), hasFing: false, edge: false, fingW: 0, fsg: 0, wfl: 0, wdv: 0, wfl0: 0, wdv0: 0, wtw: NaN, wtw0: NaN,
      qflex: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -(a ? -1 : 1) * 10 * DEG),
      clav: BI['clav' + S], uarm: BI['uarm' + S], farm: BI['farm' + S], hand: BI['hand' + S], thumb1: BI['thumb1' + S], thumb2: BI['thumb2' + S],
      f1: FINGERS.map((f) => BI['f' + f.n + '1' + S]), f2: FINGERS.map((f) => BI['f' + f.n + '2' + S]),
    };
  });
  const turnQ = new THREE.Quaternion();
  const IK = { w: 0, a: -1 };
  function reach(hand, worldPos, weight = 1, opts2) {
    const R = RCH[hand === 'left' ? 1 : 0];
    R.touched = true;
    if (worldPos && Number.isFinite(worldPos.x) && Number.isFinite(worldPos.y) && Number.isFinite(worldPos.z)) {
      R.has = true;
      R.target.copy(worldPos);
      R.req = clamp(typeof weight === 'number' && Number.isFinite(weight) ? weight : 1, 0, 1);
    } else { R.has = false; R.req = 0; }
    R.grip = opts2 && typeof opts2.grip === 'number' && Number.isFinite(opts2.grip) ? clamp(opts2.grip, 0, 1) : -1;
    if (opts2 && opts2.palm && Number.isFinite(opts2.palm.x)) { R.hasPalm = true; R.palm.copy(opts2.palm).normalize(); } else R.hasPalm = false;
    R.touch = opts2 && typeof opts2.touch === 'function' ? opts2.touch : null;
    R.inHand = !!(R.touch && opts2.inHand);
    R.still = !!(R.touch && opts2.still);
    R.squeeze = !!(R.touch && opts2.squeeze);
    R.snug = !!(R.touch && opts2.snug);
    R.dev = opts2 && Number.isFinite(opts2.dev) ? clamp(opts2.dev, 0, 0.45) : 0;
    if (opts2 && opts2.pole && Number.isFinite(opts2.pole.x)) { R.xPole = true; R.xPoleV.copy(opts2.pole).normalize(); } else R.xPole = false;
    R.tight = !!(opts2 && opts2.tight);
    R.follow = opts2 && opts2.follow && opts2.follow.isMatrix4 ? opts2.follow : null;
    const cu = opts2 && opts2.curl;
    if (cu && cu.k1 && cu.k2 && Number.isFinite(cu.tp)) {
      if (!R.curlOn || R.curlRef !== cu) {
        for (let fi = 0; fi < 4; fi++) { R.cf1[fi] = curlOf(bones[R.f1[fi]].quaternion); R.cf2[fi] = curlOf(bones[R.f2[fi]].quaternion); }
        R.cftp = R.tp; R.cW = 0;
      }
      R.curlOn = true; R.curlRef = cu;
      for (let fi = 0; fi < 4; fi++) { R.ck1[fi] = cu.k1[fi]; R.ck2[fi] = cu.k2[fi]; }
      R.ctp = cu.tp;
      R.touch = null; R.still = false;
    } else R.curlOn = false;
    const fg = opts2 && (opts2.fingers || opts2.edge);
    if (R.hasPalm && fg && Number.isFinite(fg.x)) { R.hasFing = true; R.edge = !opts2.fingers; R.fing.copy(fg).normalize(); } else R.hasFing = false;
  }
  function hold(hand, on) { RCH[hand === 'left' ? 1 : 0].hold = !!on; }
  function reachInfo(hand) { return RCH[hand === 'left' ? 1 : 0].info; }
  function leanRot(pivot, tip, tm, lo, hi, W, out) {
    _p1.setFromMatrixPosition(Mm[pivot]);
    _p2.setFromMatrixPosition(Mm[tip]);
    const over = clamp((tm.distanceTo(_p2) - 0.5) / 0.25, 0, 1);
    _p2.sub(_p1).normalize();
    _p3.copy(tm).sub(_p1).normalize();
    const ang = _p2.angleTo(_p3), maxA = (lo + (hi - lo) * over) * DEG * W * sstep(0, 0.35, Math.PI - ang);
    _qd.setFromUnitVectors(_p2, _p3);
    if (ang > maxA) out.copy(_qI).slerp(_qd, ang > 1e-6 ? maxA / ang : 0); else out.copy(_qd);
    return out;
  }
  function solveArm(R, a, W) {
    const dt = F.dt;
    const ext = R.w > 1e-3 && (R.active || (R.restW < 1e-3 && R.gW < 1e-3));
    const ges = !ext && R.gW > 1e-3;
    R.gOn = ges;
    R.restOn = !ext && !ges;
    let rawGoal = ext ? R.tm : ges ? R.gtm : R.rtm;
    const src = ext ? 0 : ges ? 1 : 2;
    if (src !== R.src) {
      R.gFrom.copy(R.gUsed);
      R.gbD = Math.max(GOAL_BLEND, R.gFrom.distanceTo(rawGoal) / GOAL_V);
      R.gbT = R.src >= 0 && R.poleInit && !F.snap ? 0 : R.gbD;
      R.src = src;
    }
    if (R.gbT < R.gbD) { R.gbT += dt; rawGoal = _gB.copy(R.gFrom).lerp(rawGoal, sstep(0, R.gbD, R.gbT)); }
    R.gUsed.copy(rawGoal);
    if (!R.poleInit || F.snap) { R.gavg.copy(rawGoal); R.graw.copy(rawGoal); R.gspd = 0; }
    {
      const rx = rawGoal.x - R.graw.x, ry = rawGoal.y - R.graw.y, rz = rawGoal.z - R.graw.z;
      const sp = Math.sqrt(rx * rx + ry * ry + rz * rz) / (dt > 1e-4 ? dt : 1e-4);
      R.gspd += ((sp < 60 ? sp : 60) - R.gspd) * (1 - Math.exp(-dt * 10));
      R.graw.copy(rawGoal);
      R.gavg.lerp(rawGoal, 1 - Math.exp(-dt / 0.12));
    }
    const goal = _gG.copy(rawGoal).lerp(R.gavg, sstep(3.2, 5.0, R.gspd));
    _mC.extractRotation(Mm[BI.chest]);
    if (!R.poleInit) { R.ts.copy(ANCH[a]).applyMatrix4(Mm[R.hand]); R.spd = 0; R.gprev.copy(goal); }
    if (F.snap) { R.ts.copy(goal); R.gprev.copy(goal); R.spd = 0; }
    {
      const cx = goal.x - R.gprev.x, cy = goal.y - R.gprev.y, cz = goal.z - R.gprev.z, jd = cx * cx + cy * cy + cz * cz;
      const lim = 3.5 * dt + 0.004;
      if (R.latch && (!ext || R.w < 0.5 || R.grip < 0.8 || jd > 0.0625)) R.latch = false;
      if (R.latch) R.ts.copy(goal);
      else if (jd < lim * lim) { R.ts.x += cx; R.ts.y += cy; R.ts.z += cz; }
      R.gprev.copy(goal);
    }
    _vv.copy(goal).sub(R.ts);
    const dd = _vv.length(), vmax = ges && R.gSpd > 0 ? R.gSpd : opts.handSpeed || 1.6;
    if (dd <= 1.2 * dt) { R.ts.copy(goal); R.spd = dt > 0 ? dd / dt : 0; }
    else {
      R.spd = Math.min(R.spd + 8 * dt, vmax, Math.sqrt(16 * dd) + 0.5);
      const stp = R.spd * dt;
      if (stp >= dd) R.ts.copy(goal); else R.ts.addScaledVector(_vv, stp / dd);
    }
    const gap = R.ts.distanceTo(goal);
    _p1.setFromMatrixPosition(Mm[R.uarm]);
    _tg.copy(R.ts).sub(_p1);
    const dT = _tg.length();
    if (dT < 0.18) { if (dT > 1e-5) _tg.multiplyScalar(0.18 / dT); else _tg.set(0, 0, -0.18).applyMatrix4(_mC); }
    _tg.add(_p1);
    _u.copy(_tg).sub(_p1).normalize();
    _p2.copy(_tg).addScaledVector(_u, -0.07);
    _vv.copy(ext && R.xPole ? R.xPoleV : POLE[a]);
    if (ges && R.gPoleW > 0) _vv.lerp(R.gPole, R.gPoleW).normalize();
    _vv.applyMatrix4(_mC);
    _p3.copy(_vv).addScaledVector(_u, -_vv.dot(_u));
    const conf = _p3.length();
    if (conf > 1e-6) _p3.divideScalar(conf);
    if (!R.poleInit) {
      if (conf > 1e-3) R.elbow.copy(_p3); else R.elbow.set(R.side, 0, 0).applyMatrix4(_mC);
      const keep = R.offT < 0.5 && Number.isFinite(R.twKeep) && !F.snap;
      R.poleInit = true; R.tw = keep ? R.twKeep : NaN; R.twv = 0; R.pwOk = keep && R.pwOk; R.euOk = false; R.hfP = NaN; R.twKeep = NaN;
    } else {
      R.elbow.addScaledVector(_u, -R.elbow.dot(_u));
      if (R.elbow.lengthSq() < 1e-8) R.elbow.copy(_p3);
      R.elbow.normalize();
      if (conf > 1e-4) {
        _xA.crossVectors(R.elbow, _p3);
        const ang = Math.atan2(_xA.dot(_u), R.elbow.dot(_p3)), lim = (R.latch ? 20 : 7) * DEG * dt * 60;
        R.elbow.applyAxisAngle(_u, clamp(ang * (1 - Math.exp(-dt * 10)) * sstep(0.04, 0.3, conf), -lim, lim));
      }
    }
    _m1.extractRotation(Mm[R.clav]);
    _qe.setFromRotationMatrix(_m1);
    let tw = 0, hfL = NaN, twvL = 0;
    for (let it = 0; it < 3; it++) {
      let ux = _p2.x - _p1.x, uy = _p2.y - _p1.y, uz = _p2.z - _p1.z;
      const D = Math.sqrt(ux * ux + uy * uy + uz * uz), iD = D > 1e-9 ? 1 / D : 1;
      ux *= iD; uy *= iD; uz *= iD;
      _u.x = ux; _u.y = uy; _u.z = uz;
      const Dmax = (L1 + L2) * 0.985, Dc = D < 0.15 ? 0.15 : D > Dmax ? Dmax : D;
      const E = R.elbow;
      let ed = E.x * ux + E.y * uy + E.z * uz;
      let vx = E.x - ux * ed, vy = E.y - uy * ed, vz = E.z - uz * ed;
      if (vx * vx + vy * vy + vz * vz < 1e-8) {
        _vv.set(R.side, 0, 0).applyMatrix4(_mC);
        ed = _vv.x * ux + _vv.y * uy + _vv.z * uz;
        vx = _vv.x - ux * ed; vy = _vv.y - uy * ed; vz = _vv.z - uz * ed;
      }
      const vl = Math.sqrt(vx * vx + vy * vy + vz * vz) || 1;
      vx /= vl; vy /= vl; vz /= vl;
      let ca = (L1 * L1 + Dc * Dc - L2 * L2) / (2 * L1 * Dc);
      ca = ca < -1 ? -1 : ca > 1 ? 1 : ca;
      const sa = Math.sqrt(1 - ca * ca);
      _yA.x = -ux * ca - vx * sa; _yA.y = -uy * ca - vy * sa; _yA.z = -uz * ca - vz * sa;
      _zA.x = -ux * sa + vx * ca; _zA.y = -uy * sa + vy * ca; _zA.z = -uz * sa + vz * ca;
      _xA.crossVectors(_yA, _zA);
      _m1.makeBasis(_xA, _yA, _zA);
      R.qa.setFromRotationMatrix(_m1);
      let cg = (L1 * L1 + L2 * L2 - Dc * Dc) / (2 * L1 * L2);
      cg = cg < -1 ? -1 : cg > 1 ? 1 : cg;
      let hf = 0.5 * (Math.PI - Math.acos(cg));
      if (!R.latch && Number.isFinite(R.hfP) && !F.snap && it === 2) {
        const hl = R.hfP + clamp(hf - R.hfP, -2.6 * dt, 2.6 * dt);
        if (hl !== hf) {
          hf = hl;
          const Dl = Math.sqrt(Math.max(1e-6, L1 * L1 + L2 * L2 + 2 * L1 * L2 * Math.cos(2 * hf)));
          const cl = clamp((L1 * L1 + Dl * Dl - L2 * L2) / (2 * L1 * Dl), -1, 1), sl = Math.sqrt(1 - cl * cl);
          _yA.x = -ux * cl - vx * sl; _yA.y = -uy * cl - vy * sl; _yA.z = -uz * cl - vz * sl;
          _zA.x = -ux * sl + vx * cl; _zA.y = -uy * sl + vy * cl; _zA.z = -uz * sl + vz * cl;
          _xA.crossVectors(_yA, _zA);
          _m1.makeBasis(_xA, _yA, _zA);
          R.qa.setFromRotationMatrix(_m1);
        }
      }
      hfL = hf;
      R.qf._x = Math.sin(hf); R.qf._y = 0; R.qf._z = 0; R.qf._w = Math.cos(hf);
      _qc.copy(R.qa).multiply(R.qf);
      _yA.set(0, 1, 0).applyQuaternion(_qc);
      _xA.set(-R.side, 0, 0).applyQuaternion(_qc);
      if (!ext) _p3.copy(ges ? R.gpalm : R.rpalm);
      else if (R.hasPalm) _p3.copy(R.palm).applyQuaternion(F.qGi);
      else {
        _p3.set(0, -1, 0).applyQuaternion(F.qGi);
        _vv.set(-0.3 * R.side, 0, -0.4).applyMatrix4(_mC);
        _p3.add(_vv);
      }
      const pn = _p3.length();
      _p3.addScaledVector(_yA, -_p3.dot(_yA));
      const kc = pn > 1e-6 ? sstep(0.2, 0.5, _p3.length() / pn) : 0;
      if (kc < 1 && R.pwOk && Number.isFinite(R.tw)) {
        _vv.copy(R.pw).addScaledVector(_yA, -R.pw.dot(_yA));
        const ql = _vv.length(), pl = _p3.length();
        if (ql > 1e-4) { _p3.multiplyScalar(pl > 1e-8 ? kc / pl : 0).addScaledVector(_vv, (1 - kc) / ql); }
      }
      let want = R.tw;
      if (_p3.lengthSq() > 1e-8) {
        _p3.normalize();
        _zA.crossVectors(_xA, _p3);
        want = Math.atan2(_zA.dot(_yA), _xA.dot(_p3));
      }
      if (!Number.isFinite(want)) want = 0;
      let twv = 0;
      if (Number.isFinite(R.tw)) {
        let wc = want - Math.round(want / TAU_) * TAU_;
        if (wc < -105 * DEG || wc > 105 * DEG) {
          const rP = wc - 105 * DEG, rN = wc + 105 * DEG;
          const cP = Math.abs(rP - Math.round(rP / TAU_) * TAU_) + Math.abs(105 * DEG - R.tw);
          const cN = Math.abs(rN - Math.round(rN / TAU_) * TAU_) + Math.abs(-105 * DEG - R.tw);
          wc = cP <= cN ? 105 * DEG : -105 * DEG;
        }
        const d = wc - R.tw;
        const k60 = dt * 60 > 1e-3 ? dt * 60 : 1e-3, lim = (R.latch ? 40 : 12) * DEG;
        const vw = Math.sign(d) * Math.min(lim, Math.sqrt(2 * TW_ACC * Math.abs(d)));
        twv = R.twv + clamp(vw - R.twv, -TW_ACC * k60, TW_ACC * k60);
        let s = twv * k60;
        if (s * d > 0 && Math.abs(s) > Math.abs(d)) { s = d; twv = d / k60; }
        tw = R.tw + s;
      } else tw = want;
      if (tw < -105 * DEG || tw > 105 * DEG) { tw = tw < 0 ? -105 * DEG : 105 * DEG; twv = 0; }
      twvL = twv;
      _qT._x = 0; _qT._y = Math.sin(tw * 0.5); _qT._z = 0; _qT._w = Math.cos(tw * 0.5);
      R.qh.copy(_qT).multiply(R.qflex);
      if (R.devS > 1e-4) { _qd.setFromAxisAngle(_XH, -R.devS); R.qh.multiply(_qd); }
      if (R.fingW > 1e-3) {
        _vv.copy(R.fing).applyQuaternion(F.qGi).applyQuaternion(_qe2.copy(_qc).invert());
        if (R.edge) { const ey = _vv.y; _vv.multiplyScalar(ey); _vv.y -= 1; }
        _p1w.copy(R.palm).applyQuaternion(F.qGi).applyQuaternion(_qe2);
        _p1w.addScaledVector(_vv, -_p1w.dot(_vv));
        if (_p1w.lengthSq() > 1e-8 && _vv.lengthSq() > 1e-8) {
          _p1w.normalize().multiplyScalar(-R.side); _vv.normalize().negate();
          _zw.crossVectors(_p1w, _vv);
          _m1.makeBasis(_p1w, _vv, _zw);
          _ew.setFromRotationMatrix(_m1, 'YZX');
          const k60 = dt * 60, ke = 1 - Math.exp(-dt / (R.tight ? WRIST_EASE_T : WRIST_EASE)), wv = (R.tight ? 1.6 : 1) * WRIST_V * k60;
          let twF = clamp(_ew.y, -105 * DEG, 105 * DEG);
          if (Number.isFinite(R.wtw0)) {
            let d = _ew.y - R.wtw0;
            d -= Math.round(d / TAU_) * TAU_;
            const near = R.wtw0 + d, far = near - Math.sign(d) * TAU_;
            twF = Math.abs(near) <= 105 * DEG || Math.abs(far) > 105 * DEG ? clamp(near, -105 * DEG, 105 * DEG) : far;
            twF = R.wtw0 + clamp((twF - R.wtw0) * ke, -12 * DEG * k60, 12 * DEG * k60);
          }
          R.wtw = twF;
          const fl = R.wfl0 + clamp((clamp(_ew.z, -WRIST_FL, WRIST_FL) - R.wfl0) * ke, -wv, wv);
          const dv = R.wdv0 + clamp((clamp(_ew.x, -WRIST_DV, WRIST_DV) - R.wdv0) * ke, -wv, wv);
          R.wfl = fl; R.wdv = dv;
          _ew.set(dv, twF, fl, 'YZX');
          _qe2.setFromEuler(_ew);
          let dq = R.qh.x * _qe2.x + R.qh.y * _qe2.y + R.qh.z * _qe2.z + R.qh.w * _qe2.w;
          const sg = R.fsg && Math.abs(dq) < 0.35 ? R.fsg : dq < 0 ? -1 : 1;
          R.fsg = sg;
          if (sg < 0) { _qe2.set(-_qe2.x, -_qe2.y, -_qe2.z, -_qe2.w); dq = -dq; }
          if (dq >= 0) R.qh.slerp(_qe2, R.fingW);
          else {
            const th = Math.acos(Math.max(-1, dq)), st = Math.sin(th), fw = R.fingW;
            const a0 = st > 1e-6 ? Math.sin((1 - fw) * th) / st : 1 - fw, b0 = st > 1e-6 ? Math.sin(fw * th) / st : fw;
            R.qh.set(R.qh.x * a0 + _qe2.x * b0, R.qh.y * a0 + _qe2.y * b0, R.qh.z * a0 + _qe2.z * b0, R.qh.w * a0 + _qe2.w * b0).normalize();
          }
        }
      }
      if (it < 2) {
        _qd.copy(_qc).multiply(R.qh);
        _p3.set(0, -L1, 0).applyQuaternion(R.qa).add(_p1);
        _vv.set(0, -L2, 0).applyQuaternion(_qc);
        _p3.add(_vv);
        _vv.copy(ANCH[a]).applyQuaternion(_qd);
        _p3.add(_vv);
        _p2.add(_vv.copy(_tg).sub(_p3));
      } else {
        R.reachable = (1 - sstep(0.53, 0.55, D)) * (1 - sstep(0.01, 0.06, gap));
        if (ext && R.grip >= 0.8 && R.w > 0.9 && R.reachable > 0.9) R.latch = true;
        if (R.latch) R.reachable = Math.max(R.reachable, 1 - sstep(0.545, 0.59, D));
      }
    }
    R.tw = tw; R.twv = twvL; R.hfP = hfL;
    R.wfl0 = R.wfl; R.wdv0 = R.wdv; R.wtw0 = R.fingW > 1e-3 ? R.wtw : NaN;
    R.pw.set(-R.side, 0, 0).applyQuaternion(_qd.copy(_qc).multiply(R.qh)); R.pwOk = true;
    _qc.copy(_qe).invert().multiply(R.qa);
    Qf[R.uarm].slerp(_qc, W);
    Qf[R.farm].slerp(R.qf, W);
    Qf[R.hand].slerp(R.qh, W);
    const o = R.uarm * 3, of = R.farm * 3;
    if (R.euOk) eulerNear(Qf[R.uarm], R.eu, 0, EB, o); else eulerNear(Qf[R.uarm], EB, o, EB, o);
    nearPose(R.uarm);
    R.eu[0] = EB[o]; R.eu[1] = EB[o + 1]; R.eu[2] = EB[o + 2];
    R.euOk = true;
    eulerNear(Qf[R.farm], EB, of, EB, of);
    nearPose(R.farm);
    ikHand(R.uarm, W); ikHand(R.farm, W);
    if (!ORDZ[R.hand]) { eulerNear(Qf[R.hand], EB, R.hand * 3, EB, R.hand * 3); nearPose(R.hand); ikHand(R.hand, W); }
  }
  const _qnp = new THREE.Quaternion(), _enp = new Float64Array(3), _enq = new Float64Array(3);
  function nearPose(b) {
    const o = b * 3;
    eulerQuat(_qnp, TB, o, false);
    if (Math.abs(_qnp.dot(Qf[b])) < 0.866) return;
    eulerNear(Qf[b], TB, o, _enp, 0);
    let dA = 0, dB = 0;
    for (let c = 0; c < 3; c++) { dA += (EB[o + c] - TB[o + c]) ** 2; dB += (_enp[c] - TB[o + c]) ** 2; }
    if (dB > dA - 1e-6) return;
    const flip = Math.abs(Math.round((_enp[0] - EB[o]) / Math.PI)) % 2 === 1;
    if (IKF[b] === F.frame + 1 || IKF[b] === F.frame) {
      eulerQuat(_qnp, IKP, o, false);
      eulerNear(_qnp, _enp, 0, _enq, 0);
      IKP[o] = _enq[0]; IKP[o + 1] = _enq[1]; IKP[o + 2] = _enq[2];
    }
    if (flip) EV[o + 2] = -EV[o + 2];
    EB[o] = _enp[0]; EB[o + 1] = _enp[1]; EB[o + 2] = _enp[2];
    LIM.np++;
  }
  const ELB_MAX = 150 * DEG, WR_FLEX = 80 * DEG, WR_EXT = 70 * DEG, WR_DEV = 30 * DEG, WR_TW = 105 * DEG;
  const ARM_BK = [60 * DEG, 25 * DEG], ARM_BK_E = [-30 * DEG, 60 * DEG], ARM_BK_K = 8 * DEG;
  const _le = new THREE.Euler(), _ld = new THREE.Vector3(), _ld2 = new THREE.Vector3(), _lq = new THREE.Quaternion(), _lq2 = new THREE.Quaternion(), _lq3 = new THREE.Quaternion(), _lq4 = new THREE.Quaternion(), _lmA = new THREE.Matrix4();
  const LIM = { n: 0, elb: 0, wr: 0, sh: 0, np: 0 };
  function limitArms() {
    let any = false;
    for (let a = 0; a < 2; a++) {
      const R = RCH[a];
      _lq2.setFromRotationMatrix(_lmA.extractRotation(Mm[BI.chest]));
      _lq.setFromRotationMatrix(_lmA.extractRotation(Mm[R.clav])).multiply(Qf[R.uarm]);
      _ld.set(0, -1, 0).applyQuaternion(_lq).applyQuaternion(_lq3.copy(_lq2).invert());
      const el = Math.asin(clamp(_ld.y, -1, 1)), bk = Math.asin(clamp(_ld.z, -1, 1));
      const B = lerp(ARM_BK[0], ARM_BK[1], clamp((el - ARM_BK_E[0]) / (ARM_BK_E[1] - ARM_BK_E[0]), 0, 1)), B0 = B - ARM_BK_K;
      if (bk > B0) {
        const b1 = B0 + ARM_BK_K * (1 - Math.exp(-(bk - B0) / ARM_BK_K));
        const h = Math.hypot(_ld.x, _ld.y);
        if (h > 1e-5 && bk - b1 > 1e-5) {
          const c = Math.cos(b1) / h;
          _ld2.set(_ld.x * c, _ld.y * c, Math.sin(b1));
          _lq3.setFromUnitVectors(_ld, _ld2);
          _lq4.copy(_lq2).invert();
          _lq.copy(_lq2).multiply(_lq3).multiply(_lq4);
          applyModelRot(R.uarm, _lq);
          const o = R.uarm * 3;
          eulerNear(Qf[R.uarm], EB, o, EB, o);
          LIM.sh++; any = true;
        }
      }
      _le.setFromQuaternion(Qf[R.farm], 'XZY');
      if (_le.x < 0 || _le.x > ELB_MAX) {
        _le.x = clamp(_le.x, 0, ELB_MAX);
        Qf[R.farm].setFromEuler(_le);
        const o = R.farm * 3;
        eulerNear(Qf[R.farm], EB, o, EB, o);
        LIM.elb++; any = true;
      }
      _le.setFromQuaternion(Qf[R.hand], 'YZX');
      const fl = -R.side * _le.z;
      if (fl > WR_FLEX || fl < -WR_EXT || Math.abs(_le.x) > WR_DEV || Math.abs(_le.y) > WR_TW) {
        _le.z = -R.side * clamp(fl, -WR_EXT, WR_FLEX); _le.x = clamp(_le.x, -WR_DEV, WR_DEV); _le.y = clamp(_le.y, -WR_TW, WR_TW);
        Qf[R.hand].setFromEuler(_le);
        if (!ORDZ[R.hand]) { const o = R.hand * 3; eulerNear(Qf[R.hand], EB, o, EB, o); }
        LIM.wr++; any = true;
      }
    }
    LIM.n++;
    return any;
  }
  function poseFingers(R) {
    const We = sstep(0, 1, R.w), Hh = sstep(0, 1, R.holdW);
    const auto = R.restOn || R.gOn;
    const cE = auto ? 0 : R.latch ? 1 : sstep(0.8, 1.0, We) * R.reachable;
    const cR = R.restOn ? R.restW * R.reachable : R.gOn ? R.gW * R.reachable : 0;
    const contact = cE > cR ? cE : cR;
    R.info.weight = R.w;
    R.info.reachable = R.w > 1e-3 && R.reachable > 0.5 && !auto;
    R.info.contact = cE;
    R.info.holding = Hh;
    R.unreach = !auto && We > 0.3 && R.reachable < 0.5 ? R.unreach + F.dt : 0;
    const relax = sstep(0.3, 0.5, R.unreach);
    const g0 = R.gOn ? R.gGrip : R.restOn ? R.restGrip : R.grip >= 0 ? R.grip : 0.45;
    const kg = F.snap || R.gS < 0 ? 1 : 1 - Math.exp(-F.dt / FEASE);
    R.gS += (g0 - R.gS) * kg;
    const tg0 = Math.max(contact * g0, Hh) * (R.squeeze ? THUMB_SQ : 1);
    R.tgS += (tg0 - R.tgS) * (F.snap ? 1 : 1 - Math.exp(-F.dt / FEASE));
    R.cW = R.curlOn ? (F.snap ? 1 : Math.min(1, R.cW + F.dt / CURL_T)) : F.snap ? 0 : Math.max(0, R.cW - F.dt / CURL_T_O);
    const cS = R.cW * R.cW * (3 - 2 * R.cW);
    if (!R.curlOn && R.cW < 1e-3 && We < 1e-3 && Hh < 1e-3 && contact < 1e-3 && R.tgS < 1e-3 && !(Math.abs(R.tp) > 0.02) && Math.max(R.cf[0], R.cf[1], R.cf[2], R.cf[3]) < 1e-3) { R.cf.fill(0); R.fOk = false; { const k60 = Math.max(F.dt * 60, 1e-3); for (let fi = 0; fi < 4; fi++) { const a1 = curlOf(Qf[R.f1[fi]]), a2 = curlOf(Qf[R.f2[fi]]); R.lv1[fi] = R.lcOk && !F.snap ? clamp((a1 - R.lc1[fi]) / k60, -FJ_CAP, FJ_CAP) : 0; R.lv2[fi] = R.lcOk && !F.snap ? clamp((a2 - R.lc2[fi]) / k60, -FJ_CAP, FJ_CAP) : 0; R.lc1[fi] = a1; R.lc2[fi] = a2; } } R.tpv = 0; R.lcOk = !F.snap; return false; }
    const open = auto ? 0 : sstep(0.05, 0.5, We) * (1 - cE) * R.reachable * R.reachable * (1 - relax);
    const g = R.gS;
    const feel = R.touch && !R.curlOn && R.cW < 1e-3 && (R.w > 1e-3 || (R.inHand && Hh > 1e-3));
    if (feel) {
      if (R.inHand) R.toTouch.multiplyMatrices(Mm[R.hand], AML[R.side > 0 ? 0 : 1]).invert();
      else R.toTouch.copy(F.mG);
    }
    const cont = feel && R.fOk && !F.snap;
    R.fresh = feel && !cont;
    for (let fi = 0; fi < 4; fi++) {
      const i1 = R.f1[fi], i2 = R.f2[fi], sc = 1 + 0.08 * fi;
      const tc = contact > R.cf[fi] ? 0.02 + 0.04 * (3 - fi) : 0.07 + 0.04 * fi;
      R.cf[fi] += (contact - R.cf[fi]) * (F.snap ? 1 : 1 - Math.exp(-F.dt / tc));
      const cfi = R.cf[fi];
      let c1 = EB[i1 * 3 + 2], c2 = EB[i2 * 3 + 2];
      c1 = lerp(c1, R.sg * (5 + 4.3 * fi) * DEG, open); c2 = lerp(c2, R.sg * (6 + 3 * fi) * DEG, open);
      c1 = lerp(c1, R.sg * lerp(10, 64, g) * sc * DEG, cfi); c2 = lerp(c2, R.sg * lerp(12, 84, g) * sc * DEG, cfi);
      c1 = lerp(c1, R.sg * (30 + 4 * fi) * DEG, relax * (1 - cfi)); c2 = lerp(c2, R.sg * (40 + 4 * fi) * DEG, relax * (1 - cfi));
      c1 = lerp(c1, R.sg * 66 * sc * DEG, Hh); c2 = lerp(c2, R.sg * 86 * sc * DEG, Hh);
      if (R.squeeze) { c1 = lerp(c1, R.sg * 92 * DEG, Hh); c2 = lerp(c2, R.sg * 105 * DEG, Hh); }
      if (R.curlOn) { c1 = lerp(R.cf1[fi], R.ck1[fi], cS); c2 = lerp(R.cf2[fi], R.ck2[fi], cS); }
      else if (cS > 0) { c1 = lerp(c1, R.ck1[fi], cS); c2 = lerp(c2, R.ck2[fi], cS); }
      setCurl(Qf[i1], c1); setCurl(Qf[i2], c2);
      R.t1[fi] = c1; R.t2[fi] = c2;
      if (!feel) continue;
      if (cont) { R.k1b[fi] = R.k1[fi]; R.k2b[fi] = R.k2[fi]; stepFinger(R, fi); } else wrapFinger(R, fi, c1, c2);
    }
    {
      const k60 = Math.max(F.dt * 60, 1e-3);
      for (let fi = 0; fi < 4; fi++) {
        const q1 = Qf[R.f1[fi]], q2 = Qf[R.f2[fi]], a1 = curlOf(q1), a2 = curlOf(q2);
        if (R.lcOk && !F.snap) {
          const b1 = springTo(R.lc1[fi], R.lv1[fi], a1, FJ_CAP, FJ_ACC, k60); R.lv1[fi] = _spV;
          const b2 = springTo(R.lc2[fi], R.lv2[fi], a2, FJ_CAP, FJ_ACC, k60); R.lv2[fi] = _spV;
          if (b1 !== a1) setCurl(q1, b1);
          if (b2 !== a2) setCurl(q2, b2);
          R.lc1[fi] = b1; R.lc2[fi] = b2;
        } else { R.lc1[fi] = a1; R.lc2[fi] = a2; R.lv1[fi] = 0; R.lv2[fi] = 0; }
      }
      R.lcOk = true;
    }
    R.tpt = R.tgS;
    if (R.curlOn || cS > 0) {
      const tp1 = R.curlOn ? lerp(R.cftp, R.ctp, cS) : lerp(R.tpt, R.ctp, cS), capT = TJ_CAP * Math.max(F.dt * 60, 1e-3);
      if (F.snap || !Number.isFinite(R.tp)) { R.tp = tp1; R.tpv = 0; } else { R.tp = springTo(R.tp, Number.isFinite(R.tpv) ? R.tpv : 0, tp1, capT / Math.max(F.dt * 60, 1e-3), TJ_ACC, Math.max(F.dt * 60, 1e-3)); R.tpv = _spV; }
      poseThumb(R, R.tp);
    } else if (cont) { const tq = R.tp; R.tpb = R.tp; stepThumb(R); R.tpv = Number.isFinite(tq) && Number.isFinite(R.tp) ? clamp((R.tp - tq) / Math.max(F.dt * 60, 1e-3), -TJ_CAP, TJ_CAP) : 0; } else {
      const tp0 = R.tp;
      closeThumb(R, feel);
      const k60 = Math.max(F.dt * 60, 1e-3);
      if (!F.snap && Number.isFinite(tp0) && Number.isFinite(R.tp)) {
        const tp2 = springTo(tp0, Number.isFinite(R.tpv) ? R.tpv : 0, R.tp, TJ_CAP, TJ_ACC, k60);
        R.tpv = _spV;
        if (tp2 !== R.tp) { R.tp = tp2; poseThumb(R, R.tp); fkOne(R.thumb1); fkOne(R.thumb2); }
      } else R.tpv = 0;
    }
    if (feel && R.snug && !R.inHand) keepSnug(R);
    R.fOk = feel;
    return true;
  }
  function keepSnug(R) {
    const mg = SNUG.mg, lo = SNUG.lo, hi = SNUG.hi, NB = 12;
    for (let fi = 0; fi < 4; fi++) {
      const i1 = R.f1[fi], i2 = R.f2[fi], c1 = curlOf(Qf[i1]), c2 = curlOf(Qf[i2]);
      const m = fingerMargin(R, fi, c1, c2) + mg;
      if (m >= lo && m <= hi) continue;
      const far = m > hi, goal = far ? hi - 0.0002 : lo + 0.0002;
      const e1 = R.sg * (far ? 92 : 5 + 4.3 * fi) * DEG, e2 = R.sg * (far ? 105 : 6 + 3 * fi) * DEG;
      const past = (s) => { const v = fingerMargin(R, fi, lerp(c1, e1, s), lerp(c2, e2, s)) + mg; return far ? v > goal : v < goal; };
      let a = 0, b = 1;
      const s1 = past(1);
      if (!s1) for (let k = 0; k < NB; k++) { const s = 0.5 * (a + b); if (past(s)) a = s; else b = s; }
      const s = s1 ? 1 : b, k1 = lerp(c1, e1, s), k2 = lerp(c2, e2, s);
      setCurl(Qf[i1], k1); setCurl(Qf[i2], k2); fkOne(i1); fkOne(i2);
      R.k1[fi] = k1; R.k2[fi] = k2; R.lc1[fi] = k1; R.lc2[fi] = k2;
    }
    const m = thumbMargin(R) + mg;
    if (Number.isFinite(R.tp) && (m < lo || m > hi)) {
      const t0 = R.tp, g0 = lo + 0.0002, g1 = hi - 0.0002;
      let best = NaN;
      for (let k = 1; k * SNUG.ts <= SNUG.tr + 1e-9 && !Number.isFinite(best); k++) {
        for (let j = 0; j < 2; j++) {
          const t = t0 + (j ? -1 : 1) * k * SNUG.ts;
          if (t > THUMB_SQ || t < THUMB_EXT) continue;
          poseThumb(R, t);
          const v = thumbMargin(R) + mg;
          if (v >= g0 && v <= g1) { best = t; break; }
        }
      }
      if (!Number.isFinite(best)) {
        const far = m > hi, goal = far ? g1 : g0, e = far ? THUMB_SQ : THUMB_EXT;
        const past = (s) => { poseThumb(R, lerp(t0, e, s)); const v = thumbMargin(R) + mg; return far ? v > goal : v < goal; };
        let a = 0, b = 1;
        const s1 = past(1);
        if (!s1) for (let k = 0; k < NB; k++) { const s = 0.5 * (a + b); if (past(s)) a = s; else b = s; }
        best = lerp(t0, e, s1 ? 1 : b);
      }
      R.tp = best;
      poseThumb(R, R.tp); fkOne(R.thumb1); fkOne(R.thumb2);
    }
  }
  function curlOf(q) { return 2 * Math.atan2(q._z, q._w); }
  const _cv = new THREE.Vector3(), _cb = new THREE.Vector3(), _ct = new THREE.Vector3();
  function solveCurl(hand, touch, out, face = null, up = null, center = null, fist = false) {
    const R = RCH[hand === 'left' ? 1 : 0];
    const o = out || { k1: new Float32Array(4), k2: new Float32Array(4), tp: 0, m: new Float32Array(5) };
    if (!o.m) o.m = new Float32Array(5);
    const t0 = R.touch, i0 = R.inHand, a1s = [...R.k1], a2s = [...R.k2], tpa = R.tp, p0 = R.tpt;
    fkAll();
    if (fist) {
      R.touch = touch; R.inHand = true; R.toTouch.multiplyMatrices(Mm[R.hand], AML[R.side > 0 ? 0 : 1]).invert();
      for (let fi = 0; fi < 4; fi++) { wrapFinger(R, fi, R.sg * 92 * DEG, R.sg * 105 * DEG); o.k1[fi] = R.k1[fi]; o.k2[fi] = R.k2[fi]; }
      R.tpt = THUMB_SQ; closeThumb(R, true);
      if (R.tp >= 0.35) {
        for (let k = 1; k <= 42; k++) {
          const tg = k * 0.05;
          if (tg >= R.tp) break;
          poseThumb(R, tg); fkOne(R.thumb1); fkOne(R.thumb2);
          if (!thumbClear(R)) { R.tp = tg - 0.1; break; }
        }
        poseThumb(R, R.tp); fkOne(R.thumb1); fkOne(R.thumb2);
      }
      if (R.tp < 0.35) {
        for (let k = 0; k <= 36; k++) {
          const tg = THUMB_SQ - k * 0.05;
          if (tg < 0.35) break;
          poseThumb(R, tg); fkOne(R.thumb1); fkOne(R.thumb2);
          const m = thumbMargin(R);
          if (m >= 0 && m < 0.004) { R.tp = tg; break; }
        }
        poseThumb(R, R.tp); fkOne(R.thumb1); fkOne(R.thumb2);
      }
      o.tp = R.tp;
      for (let fi = 0; fi < 4; fi++) { R.k1[fi] = a1s[fi]; R.k2[fi] = a2s[fi]; setCurl(Qf[R.f1[fi]], curlOf(bones[R.f1[fi]].quaternion)); setCurl(Qf[R.f2[fi]], curlOf(bones[R.f2[fi]].quaternion)); }
      R.tp = tpa; R.tpt = p0; R.touch = t0; R.inHand = i0;
      poseThumb(R, tpa);
      fkAll();
      return o;
    }
    R.touch = touch; R.inHand = false; R.toTouch.copy(F.mG);
    const tipAt = (fi) => marginAt(R, R.f2[fi], FT2[fi][3]) + FMARGIN;
    for (let fi = 0; fi < 4; fi++) {
      const sg = R.sg, lo1 = (5 + 4.3 * fi) * DEG, lo2 = (6 + 3 * fi) * DEG;
      const base = Math.min(0, fingerMargin(R, fi, sg * lo1, sg * lo2) + FMARGIN);
      let best = null, bs = 1e9;
      for (let i = 0; i <= 22; i++) for (let j = 0; j <= 20; j++) {
        const k1 = lo1 + (i / 22) * (92 * DEG - lo1), k2 = lo2 + (j / 20) * (105 * DEG - lo2);
        const m = fingerMargin(R, fi, sg * k1, sg * k2) + FMARGIN;
        if (m < base - 0.0005) continue;
        const d = tipAt(fi) - 0.0015;
        const sc = Math.abs(d) * 1000 - (Math.abs(d) < 0.002 ? 0.02 * (k1 + k2) / DEG : 0);
        if (sc < bs) { bs = sc; best = [k1, k2, d + 0.0015]; }
      }
      if (!best) best = [lo1, lo2, 9];
      o.k1[fi] = sg * best[0]; o.k2[fi] = sg * best[1]; o.m[fi] = best[2];
    }
    {
      let best = NaN, bs = 1e9, bm = 9, fb = 0, fbm = -9;
      const T2 = R.thumb2, P3 = THUMB.p[3], P1 = THUMB.p[1];
      for (let k = 0; k <= 60; k++) {
        const tg = THUMB_EXT + (k / 60) * (THUMB_SQ - THUMB_EXT);
        poseThumb(R, tg);
        fkOne(R.thumb1); fkOne(R.thumb2);
        const m = thumbMargin(R) + FMARGIN;
        if (m > fbm) { fbm = m; fb = tg; }
        if (m < -1e-3) continue;
        _ct.set(R.side * (P3[0] - P1[0]), P3[1] - P1[1], P3[2] - P1[2]).applyMatrix4(Mm[T2]).applyMatrix4(F.mG);
        _cb.setFromMatrixPosition(Mm[T2]).applyMatrix4(F.mG);
        _cv.subVectors(_ct, _cb).normalize();
        let sc = Math.abs(m - 0.0015) * 1000;
        if (up) sc += 60 * Math.max(0, _cv.dot(up) - 0.42);
        if (face && center) sc += _ct.sub(center).dot(face) < 0 ? 30 : 0;
        if (sc < bs) { bs = sc; best = tg; bm = m; }
      }
      if (!Number.isFinite(best)) {
        for (let k = 1; k <= 14; k++) {
          const tg = THUMB_EXT - k * 0.06;
          poseThumb(R, tg); fkOne(R.thumb1); fkOne(R.thumb2);
          const m = thumbMargin(R) + FMARGIN;
          if (m > fbm) { fbm = m; fb = tg; }
          if (m >= 0) break;
        }
        best = fb; bm = fbm;
      }
      else if (bm > 0.008) {
        for (let k = 60; k >= 0; k--) {
          const tg = THUMB_EXT + (k / 60) * (THUMB_SQ - THUMB_EXT);
          if (tg <= best) break;
          poseThumb(R, tg);
          fkOne(R.thumb1); fkOne(R.thumb2);
          const m = thumbMargin(R) + FMARGIN;
          if (m < 0) continue;
          _ct.set(R.side * (P3[0] - P1[0]), P3[1] - P1[1], P3[2] - P1[2]).applyMatrix4(Mm[T2]).applyMatrix4(F.mG);
          _cb.setFromMatrixPosition(Mm[T2]).applyMatrix4(F.mG);
          if (up && _cv.subVectors(_ct, _cb).normalize().dot(up) > 0.42) continue;
          best = tg; bm = m; break;
        }
      }
      o.tp = best; o.m[4] = bm;
    }
    for (let fi = 0; fi < 4; fi++) { R.k1[fi] = a1s[fi]; R.k2[fi] = a2s[fi]; setCurl(Qf[R.f1[fi]], curlOf(bones[R.f1[fi]].quaternion)); setCurl(Qf[R.f2[fi]], curlOf(bones[R.f2[fi]].quaternion)); }
    R.tp = tpa; R.touch = t0; R.inHand = i0;
    poseThumb(R, tpa);
    fkAll();
    return o;
  }

  function closeThumb(R, feel) {
    const tgp = R.tpt;
    poseThumb(R, tgp);
    R.tp = tgp;
    if (feel && !thumbClear(R)) {
      let lo = Math.min(0, tgp), hi = tgp;
      poseThumb(R, lo);
      while (!thumbClear(R) && lo > THUMB_EXT) { hi = lo; lo = Math.max(THUMB_EXT, lo - 0.3); poseThumb(R, lo); }
      if (thumbClear(R)) {
        for (let k = 0, nb = R.snug ? SNUG.fit : 6; k < nb; k++) { const m = 0.5 * (lo + hi); poseThumb(R, m); if (thumbClear(R)) lo = m; else hi = m; }
        poseThumb(R, lo);
      }
      R.tp = lo;
      fkOne(R.thumb1); fkOne(R.thumb2);
    }
  }
  function handClear(hand, out) {
    const R = RCH[hand === 'left' ? 1 : 0];
    if (!R.touch || R.inHand || !R.fOk) return 9;
    R.toTouch.copy(F.mG);
    const mg = R.snug ? SNUG.mg : FMARGIN;
    let m = thumbMargin(R);
    if (out) out[0] = m + mg;
    for (let fi = 0; fi < 4; fi++) { const f = fingerMargin(R, fi, curlOf(Qf[R.f1[fi]]), curlOf(Qf[R.f2[fi]])); if (out) out[fi + 1] = f + mg; m = Math.min(m, f); }
    return m + mg;
  }
  function refit() {
    let did = false;
    for (let a = 0; a < 2; a++) {
      const R = RCH[a];
      if (!R.touch || R.inHand || !(R.w > 1e-3) || !R.fOk) continue;
      R.toTouch.copy(F.mG);
      for (let fi = 0; fi < 4; fi++) { if (R.fresh) wrapFinger(R, fi, R.t1[fi], R.t2[fi]); else stepFinger(R, fi); }
      if (R.fresh) closeThumb(R, true); else stepThumb(R);
      did = true;
    }
    return did;
  }
  function setCurl(q, c) { const h = c * 0.5; q._x = 0; q._y = 0; q._z = Math.sin(h); q._w = Math.cos(h); }
  function poseThumb(R, tgp) {
    const o = R.thumb1 * 3, o2 = R.thumb2 * 3;
    HE[0] = lerp(EB[o], 16 * DEG, tgp); HE[1] = lerp(EB[o + 1], -R.sg * 50 * DEG, tgp); HE[2] = lerp(EB[o + 2], -R.sg * 8 * DEG, tgp);
    eulerQuat(Qf[R.thumb1], HE, 0, false);
    HE[0] = lerp(EB[o2], 10 * DEG, tgp); HE[1] = EB[o2 + 1]; HE[2] = lerp(EB[o2 + 2], -R.sg * 30 * DEG, tgp);
    eulerQuat(Qf[R.thumb2], HE, 0, false);
  }
  const _tp = new THREE.Vector3();
  const FT1 = FINGERS.map((f) => {
    const sp = f.sp * DEG, dy = -Math.cos(sp), dz = Math.sin(sp), L = f.L[0];
    return [[0, dy * L * 0.5, dz * L * 0.5, 0.5 * (f.r[0] + f.r[1])], [0, dy * L, dz * L, f.r[1]]];
  });
  const FT2 = FINGERS.map((f) => {
    const sp = f.sp * DEG, dy = -Math.cos(sp), dz = Math.sin(sp), L1 = f.L[1], L2 = f.L[2];
    const bx = -dy * Math.sin(-8 * DEG), by = dy * Math.cos(-8 * DEG), jy = dy * L1, jz = dz * L1;
    return [[0, jy * 0.5, jz * 0.5, 0.5 * (f.r[1] + f.r[2])], [0, jy, jz, f.r[2]],
      [bx * L2 * 0.5, jy + by * L2 * 0.5, jz + dz * L2 * 0.5, 0.5 * (f.r[2] + f.r[3])], [bx * L2, jy + by * L2, jz + dz * L2, f.r[3] + 0.0008]];
  });
  function marginAt(R, i, p) {
    _tp.set(R.side * p[0], p[1], p[2]).applyMatrix4(Mm[i]).applyMatrix4(R.toTouch);
    return R.touch(_tp.x, _tp.y, _tp.z) - p[3] - (R.inHand ? FMARGIN_IN : R.snug ? SNUG.mg : FMARGIN);
  }
  function fingerMargin(R, fi, k1, k2, distal = false) {
    const i1 = R.f1[fi], i2 = R.f2[fi];
    setCurl(Qf[i1], k1); setCurl(Qf[i2], k2); fkOne(i1); fkOne(i2);
    let m = 9;
    if (!distal) for (const p of FT1[fi]) m = Math.min(m, marginAt(R, i1, p));
    for (const p of FT2[fi]) m = Math.min(m, marginAt(R, i2, p));
    return m;
  }
  function wrapFinger(R, fi, c1, c2) {
    const i1 = R.f1[fi], i2 = R.f2[fi];
    const a1 = R.sg * (5 + 4.3 * fi) * DEG, a2 = R.sg * (6 + 3 * fi) * DEG, nb = R.snug ? SNUG.fit : 6;
    const clear1 = (k1) => fingerMargin(R, fi, k1, a2) >= 0;
    let k1 = c1;
    if (!clear1(c1)) {
      if (!clear1(a1)) k1 = a1;
      else { let lo = 0, hi = 1; for (let k = 0; k < nb; k++) { const m = 0.5 * (lo + hi); if (clear1(lerp(a1, c1, m))) lo = m; else hi = m; } k1 = lerp(a1, c1, lo); }
    }
    const clear2 = (k2) => fingerMargin(R, fi, k1, k2, true) >= 0;
    let k2 = c2;
    if (!clear2(c2)) {
      if (!clear2(a2)) k2 = a2;
      else { let lo = 0, hi = 1; for (let k = 0; k < nb; k++) { const m = 0.5 * (lo + hi); if (clear2(lerp(a2, c2, m))) lo = m; else hi = m; } k2 = lerp(a2, c2, lo); }
    }
    setCurl(Qf[i1], k1); setCurl(Qf[i2], k2); fkOne(i1); fkOne(i2);
    R.k1[fi] = k1; R.k2[fi] = k2;
  }
  const THP = [[0, 0.5, 1], [1, 0, 1], [1, 0.5, 2], [1, 1, 2], [1, 1.5, 3], [1, 2, 4]].map(([b, t, ri]) => {
    const P = THUMB.p, o = b ? P[1] : P[0], seg = t <= 1 ? [P[b], P[b + 1], t] : [P[2], P[3], t - 1];
    const q = [0, 1, 2].map((c) => seg[0][c] + (seg[1][c] - seg[0][c]) * seg[2] - o[c]);
    return [b, q, THUMB.r[ri]];
  });
  function thumbMargin(R) {
    fkOne(R.thumb1); fkOne(R.thumb2);
    const s = R.side, mg = R.inHand ? TMARGIN_IN : R.snug ? SNUG.mg : FMARGIN;
    let m = 9;
    for (const [b, q, r] of THP) {
      _tp.set(s * q[0], q[1], q[2]).applyMatrix4(Mm[b ? R.thumb2 : R.thumb1]).applyMatrix4(R.toTouch);
      m = Math.min(m, R.touch(_tp.x, _tp.y, _tp.z) - r - mg);
    }
    return m;
  }
  function stepFinger(R, fi) {
    if (R.t1[fi] * R.sg >= R.k1b[fi] * R.sg - 1e-4 && R.t2[fi] * R.sg >= R.k2b[fi] * R.sg - 1e-4) {
      const m0 = fingerMargin(R, fi, R.k1b[fi], R.k2b[fi]);
      if (m0 >= (R.inHand ? 0 : -deepOf(R)) && m0 <= holdBand(R)) { R.k1[fi] = R.k1b[fi]; R.k2[fi] = R.k2b[fi]; return; }
    }
    wrapFinger(R, fi, R.t1[fi], R.t2[fi]);
    const sg = R.sg, i1 = R.f1[fi], i2 = R.f2[fi], v1 = R.k1[fi] * sg, v2 = R.k2[fi] * sg;
    const ok = fingerMargin(R, fi, R.k1[fi], R.k2[fi]) >= 0;
    const k60 = F.dt * 60, cap = FCAP * k60, capO = FCAP_O * k60;
    let u1 = R.k1b[fi] * sg, u2 = R.k2b[fi] * sg;
    u1 += clamp(v1 - u1, -capO, cap); u2 += clamp(v2 - u2, -capO, cap);
    if (ok && fingerMargin(R, fi, u1 * sg, u2 * sg) < (R.inHand ? 0 : -deepOf(R))) {
      const capD = FCAP_D * k60;
      u1 = Math.max(Math.min(u1, v1), R.k1b[fi] * sg - capD); u2 = Math.max(Math.min(u2, v2), R.k2b[fi] * sg - capD);
    }
    setCurl(Qf[i1], u1 * sg); setCurl(Qf[i2], u2 * sg); fkOne(i1); fkOne(i2);
    R.k1[fi] = u1 * sg; R.k2[fi] = u2 * sg;
  }
  function stepThumb(R) {
    if (R.tpt >= R.tpb - 1e-4) {
      poseThumb(R, R.tpb);
      const m0 = thumbMargin(R);
      if (m0 >= (R.inHand ? 0 : -deepOf(R, true)) && m0 <= holdBand(R)) { R.tp = R.tpb; return; }
    }
    closeThumb(R, true);
    const v = R.tp, ok = thumbMargin(R) >= 0, k60 = F.dt * 60 * (R.snug ? SNUG.tk : 1);
    let u = R.tpb + clamp(v - R.tpb, -0.1 * k60, TCAP * k60);
    poseThumb(R, u);
    if (ok && u > v && thumbMargin(R) < -deepOf(R, true)) { u = Math.max(v, R.tpb - TCAP_D * k60); poseThumb(R, u); }
    R.tp = u;
    fkOne(R.thumb1); fkOne(R.thumb2);
  }
  function thumbClear(R) { return thumbMargin(R) >= 0; }
  function holdBand(R) { return R.still && R.touch && R.hT > FRZ_T ? 1e9 : R.snug ? SNUG.hold : FHOLD; }
  function deepOf(R, thumb = false) { return R.snug ? (thumb ? SNUG.tdeep : SNUG.deep) : FDEEP; }

  function solveArms(restW0, restW1, turnChest = 1, leanHi = 18) {
    const dt = F.dt;
    IK.w = 0; IK.a = -1;
    for (let a = 0; a < 2; a++) {
      const R = RCH[a];
      R.active = R.has && R.touched;
      if (!R.active) R.snug = false;
      const want = R.active ? R.req : 0;
      R.touched = false;
      if (R.curlOn) R.curlT = F.t;
      R.w = want > R.w ? Math.min(want, R.w + dt / 0.3) : Math.max(want, R.w - dt / (F.t - R.curlT < 1.2 ? 0.8 : 0.45));
      R.holdW = R.hold ? Math.min(1, R.holdW + dt / 0.25) : Math.max(0, R.holdW - dt / 0.3);
      R.hT = R.hold && R.holdW >= 1 ? R.hT + dt : 0;
      R.devS += ((R.active ? R.dev : 0) - R.devS) * (F.snap ? 1 : 1 - Math.exp(-dt * 8));
      R.fingW = F.snap ? (R.active && R.hasFing ? 1 : 0) : R.active && R.hasFing ? Math.min(1, R.fingW + dt / 0.3) : Math.max(0, R.fingW - dt / 0.6);
      if (R.fingW < 1e-3) { R.wfl = R.wfl0 = 0; R.wdv = R.wdv0 = 0; R.fsg = 0; }
      if (F.snap) { R.w = want; R.holdW = R.hold ? 1 : 0; }
      {
        const rw = a ? restW1 : restW0;
        if (F.snap || !Number.isFinite(R.restWv)) { R.restW = rw; R.restWv = 0; }
        else {
          const w0 = REST_W_OMEGA, h = Math.min(dt, 0.05);
          R.restWv += (w0 * w0 * (rw - R.restW) - 2 * w0 * R.restWv) * h;
          R.restW = clamp(R.restW + R.restWv * h, 0, 1);
          if (R.restW <= 0 || R.restW >= 1) R.restWv = 0;
          if (rw <= 0 && R.restW < 2e-3 && Math.abs(R.restWv) < 0.05) { R.restW = 0; R.restWv = 0; }
        }
      }
      if (R.w > IK.w) { IK.w = R.w; IK.a = a; }
    }
    let dirty = false;
    _qT.identity();
    for (let a = 0; a < 2; a++) {
      const R = RCH[a];
      if (R.w <= 1e-3) continue;
      R.tm.copy(R.target).applyMatrix4(F.mInv);
      _qT.premultiply(leanRot(BI.spine2, R.uarm, R.tm, 6, leanHi, sstep(0, 1, R.w) * turnChest, _qc));
    }
    turnQ.slerp(_qT, F.snap ? 1 : 1 - Math.exp(-dt * 5));
    if (1 - Math.abs(turnQ.w) > 1e-7) {
      _qc.copy(_qI).slerp(turnQ, 0.5);
      applyModelRot(BI.spine2, _qc);
      fkAll();
      applyModelRot(BI.chest, _qc);
      fkAll();
      dirty = true;
    }
    for (let a = 0; a < 2; a++) {
      const R = RCH[a];
      if (R.w > 1e-3) leanRot(R.clav, R.uarm, R.tm, 5, 14, sstep(0, 1, R.w), _qT); else _qT.identity();
      R.clavQ.slerp(_qT, F.snap ? 1 : 1 - Math.exp(-dt * 7));
      if (1 - Math.abs(R.clavQ.w) > 1e-7) { applyModelRot(R.clav, R.clavQ); dirty = true; }
    }
    if (dirty) fkAll();
    {
      const H = RCH[0], Fh = RCH[1];
      let want = 0;
      if (H.hold && !H.inHand && H.holdW > 0.4 && H.w > 0.5 && !Fh.active && Fh.w < 0.05 && !Fh.hold && Fh.gW < 0.05) {
        _p1.setFromMatrixPosition(Mm[Fh.uarm]);
        _p2.copy(ANCH[0]).applyMatrix4(Mm[H.hand]);
        want = sstep(0.1, 0.35, H.holdW) * (1 - sstep(0.46, 0.56, _p1.distanceTo(_p2)));
      }
      Fh.aW += (want - Fh.aW) * (F.snap ? 1 : 1 - Math.exp(-dt * 3.5));
      if (Fh.aW > 1e-3) {
        const t = F.t, u = 0.3 * Math.sin(t * 0.47) + 0.12 * Math.sin(t * 1.13 + 1);
        Fh.gW = Math.max(Fh.gW, Fh.aW); Fh.gGrip = 0.55;
        Fh.gtm.set(-0.08, -0.066 + 0.03 * u, -4e-3 + 0.03 * Math.sin(t * 0.31 + 0.6)).applyMatrix4(Mm[H.hand]);
        _m1.extractRotation(Mm[H.hand]);
        Fh.gpalm.set(1, 0.2 * u, 0.15 * Math.sin(t * 0.29)).normalize().applyMatrix4(_m1);
      }
    }
    for (let a = 0; a < 2; a++) {
      const R = RCH[a];
      if (a === 1 && RCH[1].aW > 1e-3) fkAll();
      if (a === 1 && R.follow && R.active && RCH[0].w > 1e-3) {
        fkAll();
        _m1.multiplyMatrices(F.mG, Mm[RCH[0].hand]).multiply(AML[0]).multiply(R.follow);
        const e = _m1.elements;
        R.target.set(e[12], e[13], e[14]);
        R.tm.copy(R.target).applyMatrix4(F.mInv);
        R.palm.set(e[8], e[9], e[10]).normalize();
        if (R.hasFing) R.fing.set(e[4], e[5], e[6]).normalize();
      }
      const Wt = Math.max(sstep(0, 1, R.w), R.restW, R.gW);
      if (Wt <= 1e-3) { if (R.poleInit) { R.offT = 0; R.twKeep = F.t - R.curlT < 2 ? R.tw : NaN; } else R.offT += dt; R.poleInit = false; R.reachable = 0; R.restOn = false; R.gOn = false; R.hfP = NaN; continue; }
      solveArm(R, a, Wt);
      dirty = true;
    }
    if ((RCH[0].touch && (RCH[0].w > 1e-3 || RCH[0].holdW > 1e-3)) || (RCH[1].touch && (RCH[1].w > 1e-3 || RCH[1].holdW > 1e-3))) fkAll();
    for (let a = 0; a < 2; a++) if (poseFingers(RCH[a])) dirty = true;
    return dirty;
  }

  const LK = { yaw: 0, pitch: 0, yv: 0, pv: 0, init: false };
  function lookHead(yawT, pitchT, neckShare, rate = 64) {
    const dt = F.dt;
    if (!LK.init || F.snap) { LK.yaw = yawT; LK.pitch = pitchT; LK.yv = LK.pv = 0; LK.init = true; }
    else if (dt > 0) {
      const n = Math.min(8, Math.ceil(dt * 120)), hs = dt / n, d = 2 * Math.sqrt(rate) * 0.9;
      for (let i = 0; i < n; i++) {
        LK.yv += (rate * (yawT - LK.yaw) - d * LK.yv) * hs; LK.yaw += LK.yv * hs;
        LK.pv += (rate * (pitchT - LK.pitch) - d * LK.pv) * hs; LK.pitch += LK.pv * hs;
      }
    }
    if (Math.abs(LK.yaw) + Math.abs(LK.pitch) < 1e-5) return;
    const hp = LK.pitch * 0.5, hy = LK.yaw * 0.5;
    _q1._x = Math.sin(hp); _q1._y = 0; _q1._z = 0; _q1._w = Math.cos(hp);
    _q2._x = 0; _q2._y = Math.sin(hy); _q2._z = 0; _q2._w = Math.cos(hy);
    _q2.multiply(_q1);
    _m1.extractRotation(Mm[BI.chest]);
    _q3.setFromRotationMatrix(_m1);
    const q4 = _qT.copy(_q3).invert().multiply(_q2).multiply(_q3);
    const qn = Qf[BI.neck], qh = Qf[BI.head];
    _q2.copy(qn);
    _q1.copy(_qI).slerp(q4, neckShare);
    qn.premultiply(_q1);
    _q3.copy(qn).invert().multiply(q4).multiply(_q2).multiply(qh);
    qh.copy(_q3);
    fkFrom(BI.neck);
  }
  const EYE = { yaw: 0, pitch: 0, ty: 0, tp: 0, sacc: 0, blink: 0, blinkT: 2, blinkDur: 0.3, lid: 0, req: false, squint: 0 };
  function eyes(dir, tension, rand) {
    const dt = F.dt;
    let yawT = 0, pitchT = 0;
    if (dir) {
      _m1.extractRotation(Mm[BI.head]);
      _q1.setFromRotationMatrix(_m1).invert();
      _vv.copy(dir).applyQuaternion(_q1).normalize();
      yawT = clamp(Math.atan2(-_vv.x, -_vv.z), -0.5, 0.5);
      pitchT = clamp(Math.asin(clamp(_vv.y, -1, 1)), -0.4, 0.35);
    }
    if (Math.abs(yawT - EYE.yaw) + Math.abs(pitchT - EYE.pitch) > 0.44 && EYE.blink <= 0 && rand() < 0.6) EYE.req = true;
    EYE.sacc -= dt;
    if (EYE.sacc <= 0) { EYE.ty = (rand() - 0.5) * 0.035; EYE.tp = (rand() - 0.5) * 0.025; EYE.sacc = 0.4 + rand() * 1.4; }
    yawT += EYE.ty; pitchT += EYE.tp;
    const k = F.snap ? 1 : 1 - Math.exp(-dt * 28);
    EYE.yaw += (yawT - EYE.yaw) * k; EYE.pitch += (pitchT - EYE.pitch) * k;
    EYE.blinkT -= dt;
    if (EYE.blinkT <= 0 || EYE.req) {
      EYE.req = false;
      if (EYE.blink <= 0) EYE.blink = EYE.blinkDur;
      const gz = (rand() + rand() + rand() - 1.5) * 1.15;
      EYE.blinkT = rand() < 0.12 ? 0.28 : clamp(3.1 * Math.exp(0.45 * gz), 1.5, 8);
    }
    let close = 0;
    if (EYE.blink > 0) {
      EYE.blink -= dt;
      const u = EYE.blinkDur - Math.max(0, EYE.blink);
      close = u < 0.08 ? (u / 0.08) * (u / 0.08) : u < 0.12 ? 1 : (1 - Math.min(1, (u - 0.12) / 0.18)) ** 2;
    }
    for (let a = 0; a < 2; a++) {
      const S = SIDES[a];
      const q = Qf[BI['eye' + S]];
      _e.set(EYE.pitch, EYE.yaw, 0, 'YXZ');
      q.setFromEuler(_e);
      const lidA = Math.max(-1.05, EYE.pitch * 0.55 - 0.12 - 0.08 * tension - 0.25 * EYE.squint - close * 0.95);
      const ql = Qf[BI['lid' + S]];
      ql._x = Math.sin(lidA * 0.5); ql._y = 0; ql._z = 0; ql._w = Math.cos(lidA * 0.5);
    }
    fkFrom(BI.head);
  }

  return {
    bones, Qf, Pf, Mm, TB, EB, EV, RT, RS, RV, SPW, SPZ, F, RCH, IK, LEG, LK, EYE, turnQ,
    fkAll, fkOne, fkFrom, applyModelRot, eulerNear, stepSprings, helpers, writeBones,
    solveLeg, solveArms, limitArms, LIM, reach, hold, reachInfo, lookHead, eyes, refit, handClear, solveCurl,
    snap() {
      F.snap = true;
      LK.init = false;
      turnQ.identity();
      for (let a = 0; a < 2; a++) { const R = RCH[a]; R.poleInit = false; R.clavQ.identity(); R.latch = false; R.spd = 0; }
    },
  };
}

const TN = 128;
const TNEAR = 40, TNEARL = 0.09;
const TR_SUB = 2;
const NUT_SINK = 0.004;
const HOSE_KL = 1.1;
const LEN_BAND = 0.15;
const RAIL_CLR = 0.05;
const DECK_ITERS = 18;
const HOSE_VREL = 8;
const DECK_NECK = 0.3;
const DECK_R = 0.07;
const DECK_RUN = 0.2;
const DECK_RMIN = 0.06;
const DECK_LINK = 0.05;
const SLACK_IN = 0.9, SLACK_IN_V = 2.5;
const DECK_LET = 0.5, DECK_OPEN = 0.3;
function makeTethers(seg) {
  const ROPES = [
    { name: 'hose', r: 0.0135, sides: seg(8), g: -0.8, kb: 4.9, kbW: 2.2, kbF: 11, rmin: 0.2, rmin0: 0.25, rminF: 0.4, rmin0W: 0.6, rminW: 0.45, cN: 20, kind: 0 },
  ];
  const NP = TN + 1, NR = TN * TR_SUB + 1;
  for (const R of ROPES) {
    R.X = new Float32Array(NP * 3); R.Xp = new Float32Array(NP * 3); R.W = new Float32Array(NP);
    R.rest = new Float32Array(TN); R.pre = new Float32Array(NP);
    R.len = 0; R.lenS = 0; R.maxLen = 60; R.init = false; R.tension = 0; R.dir = new THREE.Vector3(); R.on = false;
    R.payOnly = false; R.distP = -1; R.inRate = 1; R.inRateT = 0; R.dcK = 0; R.dcKd = 0; R.dcD = new THREE.Vector3(0, -1, 0); R.dcDk = 0; R.X0 = new Float32Array(NP * 3); R.guardN = 0;
    R.a = new THREE.Vector3(); R.b = new THREE.Vector3(); R.bSet = new THREE.Vector3(); R.aPrev = new THREE.Vector3(); R.aS = new THREE.Vector3();
    R.aDir = new THREE.Vector3(0, 1, 0); R.hasDir = false; R.dvK = 0; R.mouth = new THREE.Vector3(0, 1, 0);
    R.pinOn = false; R.pinS = 0.3; R.pinP = new THREE.Vector3(); R.pinPrev = new THREE.Vector3(); R.pinOk = false; R.pinK = -1; R.pinFrom = new THREE.Vector3(); R.pinT = 1; R.pinMode = null;
    R.pub = { tension: 0, length: 0, points: R.X };
    R.ring = new Float32Array(NR * 3); R.tang = new Float32Array(NR * 3); R.norm = new Float32Array(NR * 3); R.arc = new Float32Array(NR); R.wetR = new Float32Array(NR);
  }
  let nv = 0, ni = 0;
  for (const R of ROPES) { R.v0 = nv; R.i0 = ni; nv += NR * (R.sides + 1); ni += (NR - 1) * R.sides * 6; }
  const pos = new Float32Array(nv * 3), nrm = new Float32Array(nv * 3), uv = new Float32Array(nv * 2), tk = new Float32Array(nv), tw = new Float32Array(nv);
  const idx = new Uint32Array(ni);
  for (const R of ROPES) {
    let t = R.i0;
    const S1 = R.sides + 1;
    for (let i = 0; i < NR - 1; i++) for (let j = 0; j < R.sides; j++) {
      const a = R.v0 + i * S1 + j, b = a + 1, c = a + S1, d = c + 1;
      idx[t++] = a; idx[t++] = c; idx[t++] = b; idx[t++] = b; idx[t++] = c; idx[t++] = d;
    }
    for (let i = 0; i < NR; i++) for (let j = 0; j <= R.sides; j++) { const v = R.v0 + i * S1 + j; tk[v] = R.kind; uv[v * 2 + 1] = j / R.sides; }
  }
  const geo = new THREE.BufferGeometry();
  const aPos = new THREE.BufferAttribute(pos, 3), aNrm = new THREE.BufferAttribute(nrm, 3), aUv = new THREE.BufferAttribute(uv, 2), aTw = new THREE.BufferAttribute(tw, 1);
  for (const at of [aPos, aNrm, aUv, aTw]) at.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('position', aPos);
  geo.setAttribute('normal', aNrm);
  geo.setAttribute('uv', aUv);
  geo.setAttribute('aTk', new THREE.BufferAttribute(tk, 1));
  geo.setAttribute('aTw', aTw);
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);

  const _b = new THREE.Vector3(), _n = new THREE.Vector3(), _t0 = new THREE.Vector3(), _t1 = new THREE.Vector3(), _q = new THREE.Quaternion();
  function restLengths(R) {
    const near = Math.min(TNEARL, R.lenS / TN);
    const far = Math.max(near, (R.lenS - near * TNEAR) / (TN - TNEAR));
    let s = 0;
    for (let i = 0; i < TN; i++) { R.rest[i] = i < TNEAR ? near : far; R.pre[i] = s; s += R.rest[i]; }
    R.pre[TN] = s;
  }
  const rminAt = (R, i, y, waterY) => {
    const r = R.payOnly && y < waterY && R.rmin0W ? (R.pre[i] < 0.5 ? R.rminF : R.pre[i] < 1.6 ? R.rmin0W : R.rminW) : R.pre[i] < 1 ? R.rmin0 : y < waterY && R.rminW ? R.rminW : R.rmin;
    return R.dcK > 0 && R.pre[i] < DECK_NECK + 0.05 ? r + (Math.min(r, DECK_RMIN) - r) * R.dcK : r;
  };
  function constrain(R, env, iters) {
    const X = R.X, Xp = R.Xp, oN = TN * 3, pinK = R.pinK, dirK = R.hasDir ? 1 : -1;
    const Kd = deckArc(R, R.aS), wd = _dcW, kp = _dcP;
    R.dcKd = 0;
    for (let i = 2; i <= Kd; i++) { const k = deckHold(R, i, Kd); wd[i] = 1 - k; kp[i] = k >= 1 ? 1 : 1 - Math.pow(1 - k, 1 / iters); if (k > 0.5) R.dcKd = i; }
    const pinD = () => { for (let i = 2; i <= Kd; i++) { const o = i * 3, kd = kp[i]; X[o] += (_dcT[o] - X[o]) * kd; X[o + 1] += (_dcT[o + 1] - X[o + 1]) * kd; X[o + 2] += (_dcT[o + 2] - X[o + 2]) * kd; } };
    const fr = 1 - Math.pow(0.5, 1 / iters);
    if (env.boat) env.boat.fr = fr;
    if (env.body) env.body.fr = fr;
    for (let c = 0; c < env.nCols; c++) env.cols[c].fr = fr * 0.1;
    for (let it = 0; it < iters; it++) {
      X[0] = R.aS.x; X[1] = R.aS.y; X[2] = R.aS.z;
      X[oN] = R.b.x; X[oN + 1] = R.b.y; X[oN + 2] = R.b.z;
      if (dirK > 0) { const r0 = R.rest[0]; X[3] = X[0] + R.aDir.x * r0; X[4] = X[1] + R.aDir.y * r0; X[5] = X[2] + R.aDir.z * r0; }
      if (pinK > 0) { const o = pinK * 3; X[o] = R.pinP.x; X[o + 1] = R.pinP.y; X[o + 2] = R.pinP.z; }
      if (Kd > 0) pinD();
      for (let i = 0; i < TN; i++) {
        const o = i * 3, p = o + 3;
        const dx = X[p] - X[o], dy = X[p + 1] - X[o + 1], dz = X[p + 2] - X[o + 2];
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6;
        const diff = (d - R.rest[i]) / d;
        const wa = i === 0 || i === dirK || i === pinK ? 0 : i <= Kd ? wd[i] : 1, wb = i + 1 === TN || i + 1 === dirK || i + 1 === pinK ? 0 : i + 1 <= Kd ? wd[i + 1] : 1, ws = wa + wb;
        if (ws === 0) continue;
        const ka = (wa / ws) * diff, kb = (wb / ws) * diff;
        X[o] += dx * ka; X[o + 1] += dy * ka; X[o + 2] += dz * ka;
        X[p] -= dx * kb; X[p + 1] -= dy * kb; X[p + 2] -= dz * kb;
      }
      {
        for (let i = 1; i < TN; i++) {
          if (i === dirK && !R.payOnly) continue;
          const o = i * 3;
          const l = 0.5 * (R.rest[i - 1] + R.rest[i]), rmin = rminAt(R, i, X[o + 1], env.waterY);
          const th = Math.min(0.6, l / rmin), cmin = 2 * l * Math.cos(th * 0.5);
          const ex = X[o + 3] - X[o - 3], ey = X[o + 4] - X[o - 2], ez = X[o + 5] - X[o - 1];
          const ch = Math.sqrt(ex * ex + ey * ey + ez * ez) || 1e-6;
          if (ch < cmin) {
            const fa0 = i - 1 === 0 || i - 1 === dirK || i - 1 === pinK ? 0 : i - 1 <= Kd ? wd[i - 1] : 1, fb0 = i + 1 === TN || i + 1 === pinK ? 0 : i + 1 <= Kd ? wd[i + 1] : 1, ws = fa0 + fb0;
            if (ws > 0) {
              const f = ((cmin - ch) / ch) * 0.5, fa = f * (fa0 / ws) * 2, fb = f * (fb0 / ws) * 2;
              X[o - 3] -= ex * fa * 0.5; X[o - 2] -= ey * fa * 0.5; X[o - 1] -= ez * fa * 0.5;
              X[o + 3] += ex * fb * 0.5; X[o + 4] += ey * fb * 0.5; X[o + 5] += ez * fb * 0.5;
            }
          }
        }
      }
      {
        const kW = Math.max(1, Math.min(8, Math.round(0.08 / Math.max(1e-3, R.rest[0]))));
        if (kW > 1) {
          for (let i = kW; i + kW <= TN && R.pre[i] < 1.2; i++) {
            const ia = i - kW, ib = i + kW, oa = ia * 3, ob = ib * 3;
            const arc = R.pre[ib] - R.pre[ia], rmin = rminAt(R, i, X[i * 3 + 1], env.waterY), half = Math.min(1.5, arc / (2 * rmin));
            const cmin = 2 * rmin * Math.sin(half);
            const ex = X[ob] - X[oa], ey = X[ob + 1] - X[oa + 1], ez = X[ob + 2] - X[oa + 2];
            const ch = Math.sqrt(ex * ex + ey * ey + ez * ez) || 1e-6;
            if (ch >= cmin) continue;
            const wa = ia === 0 || ia === dirK || ia === pinK ? 0 : ia <= Kd ? wd[ia] : 1, wb = ib === TN || ib === pinK ? 0 : ib <= Kd ? wd[ib] : 1, ws = wa + wb;
            if (ws === 0) continue;
            const f = Math.min(0.5, (cmin - ch) / ch) * 0.5;
            X[oa] -= ex * f * (wa / ws) * 2; X[oa + 1] -= ey * f * (wa / ws) * 2; X[oa + 2] -= ez * f * (wa / ws) * 2;
            X[ob] += ex * f * (wb / ws) * 2; X[ob + 1] += ey * f * (wb / ws) * 2; X[ob + 2] += ez * f * (wb / ws) * 2;
          }
        }
      }
      for (let i = 1; i < TN; i++) {
        if (i === pinK) continue;
        const o = i * 3;
        if (env.floorFn && X[o + 1] < env.waterY) {
          const f = env.floorFn(X[o], X[o + 2]) + R.r;
          if (X[o + 1] < f) { X[o + 1] = f; Xp[o] += (X[o] - Xp[o]) * fr; Xp[o + 2] += (X[o + 2] - Xp[o + 2]) * fr; }
        } else if (!env.boat && env.floorY !== null && env.floorY !== undefined) {
          const f = env.floorY + R.r;
          if (X[o + 1] < f && Math.hypot(X[o] - env.fx, X[o + 2] - env.fz) < env.floorR) {
            X[o + 1] = f; Xp[o] += (X[o] - Xp[o]) * fr; Xp[o + 1] = X[o + 1]; Xp[o + 2] += (X[o + 2] - Xp[o + 2]) * fr;
          }
        }
        if (env.boat) boatContact(R, o, env.boat);
        if (env.body && R.pre[i] > 0.25) { if (env.body.nc > 0) { if (R.pre[TN] - R.pre[i] > 0.3) capsContact(R, o, env.body); } else bodyContact(R, o, env.body); }
        for (let c = 0; c < env.nCols; c++) boxContact(R, o, env.cols[c]);
      }
    }
    if (Kd > 0) pinD();
  }
  function boatContact(R, o, B) {
    const X = R.X, e = B.inv.elements, m = B.mat.elements;
    const x = X[o], y = X[o + 1], z = X[o + 2];
    const lx = e[0] * x + e[4] * y + e[8] * z + e[12], ly = e[1] * x + e[5] * y + e[9] * z + e[13], lz = e[2] * x + e[6] * y + e[10] * z + e[14];
    const dx = lx - B.rx, dz = lz - B.rz;
    const s = dx * B.ox + dz * B.oz, al = dx * B.px + dz * B.pz;
    if (Math.abs(al - B.al0) > B.halfLen || ly > B.ry + 0.4 || ly < B.yLow) return;
    const hw = B.halfW + R.r;
    let ns = s, ny = ly;
    if (s < -hw) {
      if (s < -hw - B.beam || ly >= B.deckY + R.r || ly < B.deckY - 0.3) return;
      ny = B.deckY + R.r;
    } else if (ly > B.ry - 0.03) {
      if (s > hw || ly >= B.ry + R.r) return;
      ny = B.ry + R.r;
    } else {
      const sh = B.hn ? Math.max(hw, hullS(B, ly) + R.r) : hw;
      if (s >= sh) return;
      const Xp = R.Xp, px = Xp[o], py = Xp[o + 1], pz = Xp[o + 2];
      const ps = (e[0] * px + e[4] * py + e[8] * pz + e[12] - B.rx) * B.ox + (e[2] * px + e[6] * py + e[10] * pz + e[14] - B.rz) * B.oz;
      ns = ps < 0.5 * (sh - hw) ? -hw : sh;
    }
    const nlx = B.rx + ns * B.ox + al * B.px, nlz = B.rz + ns * B.oz + al * B.pz;
    X[o] = m[0] * nlx + m[4] * ny + m[8] * nlz + m[12];
    X[o + 1] = m[1] * nlx + m[5] * ny + m[9] * nlz + m[13];
    X[o + 2] = m[2] * nlx + m[6] * ny + m[10] * nlz + m[14];
    const cx = X[o] - x, cy = X[o + 1] - y, cz = X[o + 2] - z, cl = Math.sqrt(cx * cx + cy * cy + cz * cz);
    if (cl > 1e-7) restOn(R, o, cx / cl, cy / cl, cz / cl, B.fr); else restOn(R, o, 0, 0, 0, B.fr);
  }
  function hullS(B, ly) {
    let y0 = B.ry, s0 = B.halfW;
    for (let k = 0; k < B.hn; k++) {
      const y1 = B.hy[k], s1 = B.hs[k];
      if (ly >= y1) return s0 + ((s1 - s0) * (y0 - ly)) / Math.max(1e-4, y0 - y1);
      y0 = y1; s0 = s1;
    }
    return s0;
  }
  function boxContact(R, o, C) {
    const X = R.X, Xp = R.Xp, e = C.inv.elements, m = C.mat.elements, rr = R.r / C.scale, mn = C.min, mx = C.max;
    const x = X[o], y = X[o + 1], z = X[o + 2];
    const lx = e[0] * x + e[4] * y + e[8] * z + e[12], ly = e[1] * x + e[5] * y + e[9] * z + e[13], lz = e[2] * x + e[6] * y + e[10] * z + e[14];
    if (lx < mn.x - rr || lx > mx.x + rr || ly < mn.y - rr || ly > mx.y + rr || lz < mn.z - rr || lz > mx.z + rr) return;
    let best = lx - (mn.x - rr), ax = 0, hi = false, d;
    if ((d = mx.x + rr - lx) < best) { best = d; ax = 0; hi = true; }
    if ((d = ly - (mn.y - rr)) < best) { best = d; ax = 1; hi = false; }
    if ((d = mx.y + rr - ly) < best) { best = d; ax = 1; hi = true; }
    if ((d = lz - (mn.z - rr)) < best) { best = d; ax = 2; hi = false; }
    if ((d = mx.z + rr - lz) < best) { best = d; ax = 2; hi = true; }
    let nx = lx, ny = ly, nz = lz;
    if (ax === 0) nx = hi ? mx.x + rr : mn.x - rr; else if (ax === 1) ny = hi ? mx.y + rr : mn.y - rr; else nz = hi ? mx.z + rr : mn.z - rr;
    X[o] = m[0] * nx + m[4] * ny + m[8] * nz + m[12];
    X[o + 1] = m[1] * nx + m[5] * ny + m[9] * nz + m[13];
    X[o + 2] = m[2] * nx + m[6] * ny + m[10] * nz + m[14];
    Xp[o] += (X[o] - Xp[o]) * C.fr; Xp[o + 1] += (X[o + 1] - Xp[o + 1]) * C.fr; Xp[o + 2] += (X[o + 2] - Xp[o + 2]) * C.fr;
  }
  function bodyContact(R, o, Bd) {
    const X = R.X;
    let cx = X[o] - Bd.x, cz = X[o + 2] - Bd.z;
    const y = X[o + 1];
    if (y > Bd.y0 && y < Bd.y1) {
      const rr = Bd.r + R.r, d2 = cx * cx + cz * cz;
      if (d2 < rr * rr) {
        let d = Math.sqrt(d2);
        if (d < 1e-4) { cx = 1; cz = 0; d = 1; }
        cx /= d; cz /= d;
        X[o] = Bd.x + cx * rr; X[o + 2] = Bd.z + cz * rr;
        restOn(R, o, cx, 0, cz, Bd.fr);
      }
    }
    const hx = X[o] - Bd.hx, hy = X[o + 1] - Bd.hy, hz = X[o + 2] - Bd.hz, hr = Bd.hr + R.r, h2 = hx * hx + hy * hy + hz * hz;
    if (h2 < hr * hr && h2 > 1e-8) {
      const d = Math.sqrt(h2), nx = hx / d, ny = hy / d, nz = hz / d;
      X[o] = Bd.hx + nx * hr; X[o + 1] = Bd.hy + ny * hr; X[o + 2] = Bd.hz + nz * hr;
      restOn(R, o, nx, ny, nz, Bd.fr);
    }
  }
  function capsContact(R, o, Bd, full) {
    const X = R.X, C = Bd.caps, bb = Bd.bb, rr0 = R.r;
    const x = X[o], y = X[o + 1], z = X[o + 2];
    if (x < bb[0] || x > bb[3] || y < bb[1] || y > bb[4] || z < bb[2] || z > bb[5]) return;
    const Bt = Bd.rail;
    if (Bt) {
      const e = Bt.inv.elements;
      if (e[1] * x + e[5] * y + e[9] * z + e[13] < Bt.ry + RAIL_CLR) return;
    }
    for (let c = 0; c < Bd.nc; c++) {
      const sk = c >= Bd.skip0 && c < Bd.skip1 ? Bd.skipK : 1;
      if (sk < 0.01) continue;
      const k = c * 7, ax = C[k], ay = C[k + 1], az = C[k + 2], abx = C[k + 3] - ax, aby = C[k + 4] - ay, abz = C[k + 5] - az, rr = (C[k + 6] + rr0) * sk;
      const px = X[o] - ax, py = X[o + 1] - ay, pz = X[o + 2] - az, l2 = abx * abx + aby * aby + abz * abz;
      let h = l2 > 1e-9 ? (px * abx + py * aby + pz * abz) / l2 : 0;
      h = h < 0 ? 0 : h > 1 ? 1 : h;
      let dx = px - abx * h, dy = py - aby * h, dz = pz - abz * h;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 >= rr * rr) continue;
      let d = Math.sqrt(d2);
      if (d < 1e-5) { dx = 0; dy = 1; dz = 0; d = 1; }
      const nx = dx / d, ny = dy / d, nz = dz / d;
      const pu = full ? rr - d : Math.min(rr - d, 0.02);
      X[o] += nx * pu; X[o + 1] += ny * pu; X[o + 2] += nz * pu;
      restOn(R, o, nx, ny, nz, Bd.fr);
    }
  }
  function restOn(R, o, nx, ny, nz, fr) {
    const X = R.X, Xp = R.Xp;
    let vx = X[o] - Xp[o], vy = X[o + 1] - Xp[o + 1], vz = X[o + 2] - Xp[o + 2];
    const vn = vx * nx + vy * ny + vz * nz, kt = 1 - (fr || 0);
    vx = (vx - vn * nx) * kt; vy = (vy - vn * ny) * kt; vz = (vz - vn * nz) * kt;
    Xp[o] = X[o] - vx; Xp[o + 1] = X[o + 1] - vy; Xp[o + 2] = X[o + 2] - vz;
  }
  function bendLimit(R, sweeps, waterY) {
    const X = R.X, dirK = R.hasDir ? 1 : -1, pinK = R.pinK;
    for (let sw = 0; sw < sweeps; sw++) {
      const fwd = (sw & 1) === 0;
      for (let jj = 1; jj < TN; jj++) {
        const i = fwd ? jj : TN - jj;
        if (i === pinK) continue;
        const o = i * 3;
        let ax = X[o] - X[o - 3], ay = X[o + 1] - X[o - 2], az = X[o + 2] - X[o - 1];
        const al = Math.sqrt(ax * ax + ay * ay + az * az) || 1e-6; ax /= al; ay /= al; az /= al;
        let bx = X[o + 3] - X[o], by = X[o + 4] - X[o + 1], bz = X[o + 5] - X[o + 2];
        const bl = Math.sqrt(bx * bx + by * by + bz * bz) || 1e-6; bx /= bl; by /= bl; bz /= bl;
        const cs = ax * bx + ay * by + az * bz, th = Math.acos(cs < -1 ? -1 : cs > 1 ? 1 : cs);
        const l = 0.5 * (R.rest[i - 1] + R.rest[i]);
        const tmax = Math.min(0.6, l / rminAt(R, i, X[o + 1], waterY));
        const sn = Math.sin(th);
        if (th <= tmax + 1e-4 || sn < 1e-5) continue;
        const wa = i - 1 === 0 || i - 1 === dirK || i - 1 === pinK ? 0 : 1, wb = i + 1 === TN || i + 1 === pinK ? 0 : 1;
        if (wa + wb === 0) continue;
        const exW = R.payOnly && i <= 2 ? 0.04 : 0.005;
        const ex = Math.min((th - tmax) * 0.5, X[o + 1] < waterY ? exW : 0.06), ta = (ex * wa) / (wa + wb), tb = (ex * wb) / (wa + wb);
        if (tb > 0) {
          const k0 = Math.sin(th - tb) / sn, k1 = Math.sin(tb) / sn;
          X[o + 3] = X[o] + (bx * k0 + ax * k1) * bl; X[o + 4] = X[o + 1] + (by * k0 + ay * k1) * bl; X[o + 5] = X[o + 2] + (bz * k0 + az * k1) * bl;
        }
        if (ta > 0) {
          const k0 = Math.sin(th - ta) / sn, k1 = Math.sin(ta) / sn;
          X[o - 3] = X[o] - (ax * k0 + bx * k1) * al; X[o - 2] = X[o + 1] - (ay * k0 + by * k1) * al; X[o - 1] = X[o + 2] - (az * k0 + bz * k1) * al;
        }
      }
    }
  }
  function nearSolve(R, iters, waterY) {
    if (!R.hasDir) return;
    const X = R.X, pinK = R.pinK;
    let K = 3;
    while (K < TN - 1 && R.pre[K] < 1.0) K++;
    for (let it = 0; it < iters; it++) {
      for (let i = 1; i < K; i++) {
        const o = i * 3, q = o + 3;
        const dx = X[q] - X[o], dy = X[q + 1] - X[o + 1], dz = X[q + 2] - X[o + 2];
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6, diff = (d - R.rest[i]) / d;
        const wa = i === 1 || i === pinK ? 0 : 1, wb = i + 1 === K || i + 1 === pinK ? 0 : 1, ws = wa + wb;
        if (ws === 0) continue;
        const ka = (wa / ws) * diff, kb = (wb / ws) * diff;
        X[o] += dx * ka; X[o + 1] += dy * ka; X[o + 2] += dz * ka;
        X[q] -= dx * kb; X[q + 1] -= dy * kb; X[q + 2] -= dz * kb;
      }
      for (let i = R.payOnly ? 1 : 2; i < K; i++) {
        const o = i * 3, l = 0.5 * (R.rest[i - 1] + R.rest[i]), th = Math.min(0.6, l / rminAt(R, i, X[o + 1], waterY)), cmin = 2 * l * Math.cos(th * 0.5);
        const ex = X[o + 3] - X[o - 3], ey = X[o + 4] - X[o - 2], ez = X[o + 5] - X[o - 1];
        const ch = Math.sqrt(ex * ex + ey * ey + ez * ez) || 1e-6;
        if (ch >= cmin) continue;
        const fa0 = i - 1 <= 1 || i - 1 === pinK ? 0 : 1, fb0 = i + 1 === K || i + 1 === pinK ? 0 : 1, ws = fa0 + fb0;
        if (ws === 0) continue;
        const f = ((cmin - ch) / ch) * 0.5, fa = f * (fa0 / ws), fb = f * (fb0 / ws);
        X[o - 3] -= ex * fa; X[o - 2] -= ey * fa; X[o - 1] -= ez * fa;
        X[o + 3] += ex * fb; X[o + 4] += ey * fb; X[o + 5] += ez * fb;
      }
    }
  }
  function bendStep(R, h, waterY) {
    const X = R.X, dirK = R.hasDir ? 1 : -1, pinK = R.pinK, kh = R.kb * h * h, khW = (R.kbW || R.kb) * h * h;
    const khF = R.payOnly && R.kbF ? R.kbF * h * h : khW;
    for (let i = 1; i < TN; i++) {
      if (i === dirK || i === pinK) continue;
      const o = i * 3, l = 0.5 * (R.rest[i - 1] + R.rest[i]);
      const k = Math.min(0.25, (X[o + 1] < waterY ? (R.pre[i] < 1.6 ? khF : khW) : kh) / (l * l));
      X[o] += ((X[o - 3] + X[o + 3]) * 0.5 - X[o]) * k;
      X[o + 1] += ((X[o - 2] + X[o + 4]) * 0.5 - X[o + 1]) * k;
      X[o + 2] += ((X[o - 1] + X[o + 5]) * 0.5 - X[o + 2]) * k;
    }
  }
  function nearCurve(R, waterY, k) {
    const X = R.X, Xp = R.Xp;
    let K = 3;
    while (K < TN - 1 && R.pre[K] < 1.6) K++;
    const oK = K * 3, L = R.pre[K] - R.pre[1];
    if (L < 0.3 || X[oK + 1] > waterY || X[4] > waterY) return;
    let tx = X[oK + 3] - X[oK - 3], ty = X[oK + 4] - X[oK - 2], tz = X[oK + 5] - X[oK - 1];
    const tl = Math.sqrt(tx * tx + ty * ty + tz * tz) || 1;
    tx *= L / tl; ty *= L / tl; tz *= L / tl;
    const ax = R.aDir.x * L * 0.7, ay = R.aDir.y * L * 0.7, az = R.aDir.z * L * 0.7;
    for (let i = 2; i < K; i++) {
      const s = (R.pre[i] - R.pre[1]) / L, s2 = s * s, s3 = s2 * s;
      const h00 = 2 * s3 - 3 * s2 + 1, h10 = s3 - 2 * s2 + s, h01 = 3 * s2 - 2 * s3, h11 = s3 - s2, o = i * 3;
      const dx = (h00 * X[3] + h10 * ax + h01 * X[oK] + h11 * tx - X[o]) * k;
      const dy = (h00 * X[4] + h10 * ay + h01 * X[oK + 1] + h11 * ty - X[o + 1]) * k;
      const dz = (h00 * X[5] + h10 * az + h01 * X[oK + 2] + h11 * tz - X[o + 2]) * k;
      X[o] += dx; X[o + 1] += dy; X[o + 2] += dz;
      Xp[o] += dx; Xp[o + 1] += dy; Xp[o + 2] += dz;
    }
  }
  const _dcT = new Float32Array((TN + 1) * 3), _dcW = new Float32Array(TN + 1), _dcP = new Float32Array(TN + 1);
  function deckHold(R, i, K) {
    const u = (R.pre[i] - R.pre[1]) / Math.max(1e-4, R.pre[K] - R.pre[1]);
    return sstep(0, 1, 1 - (1 - R.dcK) * (1 + 2 * u));
  }
  function deckArc(R, a) {
    if (!(R.dcK > 0.01) || !R.hasDir) { R.dcDk = 0; return 0; }
    const X = R.X;
    let K = 3;
    while (K < TN - 1 && R.pre[K] < DECK_NECK) K++;
    if (R.pinK > 0) K = Math.min(K, R.pinK - 2);
    if (K < 3 || R.pre[K] - R.pre[1] < 0.1) return 0;
    const ax = R.aDir.x, ay = R.aDir.y, az = R.aDir.z, r0 = R.rest[0];
    const x1 = a.x + ax * r0, y1 = a.y + ay * r0, z1 = a.z + az * r0;
    let K2 = K + 1;
    while (K2 < TN && R.pre[K2] < R.pre[K] + DECK_RUN) K2++;
    let dx = X[K2 * 3] - X[K * 3], dy = X[K2 * 3 + 1] - X[K * 3 + 1], dz = X[K2 * 3 + 2] - X[K * 3 + 2];
    let dl = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (dl < 1e-4) { dx = 0; dy = -1; dz = 0; dl = 1; }
    const D = R.dcD;
    if (!(R.dcDk > 0)) D.set(dx / dl, dy / dl, dz / dl);
    else { D.x += (dx / dl - D.x) * 0.25; D.y += (dy / dl - D.y) * 0.25; D.z += (dz / dl - D.z) * 0.25; D.normalize(); }
    R.dcDk = 1;
    dx = D.x; dy = D.y; dz = D.z;
    const c = clamp(ax * dx + ay * dy + az * dz, -1, 1), th = Math.acos(c);
    let nx = dx - c * ax, ny = dy - c * ay, nz = dz - c * az;
    let nl = Math.sqrt(nx * nx + ny * ny + nz * nz);
    if (nl < 1e-3) { nx = ay * ax; ny = ay * ay - 1; nz = ay * az; nl = Math.sqrt(nx * nx + ny * ny + nz * nz); }
    if (nl < 1e-3) { nx = 1; ny = 0; nz = 0; nl = 1; }
    nx /= nl; ny /= nl; nz /= nl;
    const L = R.pre[K] - R.pre[1], rc = th > 1e-3 ? Math.min(DECK_R + (1 - R.dcK) * DECK_OPEN, L / th) : 0, sa = rc * th;
    const ex = x1 + (ax * Math.sin(th) + nx * (1 - Math.cos(th))) * rc, ey = y1 + (ay * Math.sin(th) + ny * (1 - Math.cos(th))) * rc;
    const ez = z1 + (az * Math.sin(th) + nz * (1 - Math.cos(th))) * rc;
    for (let i = 2; i <= K; i++) {
      const sl = R.pre[i] - R.pre[1], o = i * 3;
      if (sl <= sa && rc > 0) {
        const u = sl / rc, su = Math.sin(u) * rc, cu = (1 - Math.cos(u)) * rc;
        _dcT[o] = x1 + ax * su + nx * cu; _dcT[o + 1] = y1 + ay * su + ny * cu; _dcT[o + 2] = z1 + az * su + nz * cu;
      } else {
        const q = sl - sa;
        _dcT[o] = ex + dx * q; _dcT[o + 1] = ey + dy * q; _dcT[o + 2] = ez + dz * q;
      }
    }
    return K;
  }
  function deckCurve(R) {
    const K = deckArc(R, R.a);
    const X = R.X, Xp = R.Xp;
    for (let i = 2; i <= K; i++) {
      const k = deckHold(R, i, K);
      if (k <= 0) continue;
      const o = i * 3, mx = (_dcT[o] - X[o]) * k, my = (_dcT[o + 1] - X[o + 1]) * k, mz = (_dcT[o + 2] - X[o + 2]) * k;
      X[o] += mx; X[o + 1] += my; X[o + 2] += mz;
      Xp[o] += mx; Xp[o + 1] += my; Xp[o + 2] += mz;
    }
  }
  const _tv = new Float32Array((TN + 1) * 3);
  function innerDamp(R, waterY, k) {
    const X = R.X, Xp = R.Xp, V = _tv, dirK = R.hasDir ? 1 : -1, pinK = R.pinK;
    for (let o = 0; o < V.length; o++) V[o] = X[o] - Xp[o];
    for (let i = 1; i < TN; i++) {
      if (i === dirK || i === pinK) continue;
      const o = i * 3;
      if (X[o + 1] < waterY) continue;
      const fa = i - 1 === 0 || i - 1 === dirK || i - 1 === pinK, fb = i + 1 === TN || i + 1 === pinK;
      if (fa && fb) continue;
      const pa = fa ? o + 3 : o - 3, pb = fb ? o - 3 : o + 3;
      Xp[o] = X[o] - (V[o] + k * ((V[pa] + V[pb]) * 0.5 - V[o]));
      Xp[o + 1] = X[o + 1] - (V[o + 1] + k * ((V[pa + 1] + V[pb + 1]) * 0.5 - V[o + 1]));
      Xp[o + 2] = X[o + 2] - (V[o + 2] + k * ((V[pa + 2] + V[pb + 2]) * 0.5 - V[o + 2]));
    }
  }
  function layOut(R, env) {
    const X = R.X, Xp = R.Xp, L = R.pre[TN];
    const dx = R.b.x - R.a.x, dy = R.b.y - R.a.y, dz = R.b.z - R.a.z, d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-3;
    const h = L > d ? Math.min(0.5 * L, Math.sqrt((3 * d * (L - d)) / 8)) : 0;
    for (let i = 0; i <= TN; i++) {
      const u = L > 0 ? R.pre[i] / L : i / TN;
      const px = R.a.x + dx * u, pz = R.a.z + dz * u;
      let py = R.a.y + dy * u - 4 * h * u * (1 - u);
      if (env.floorFn) { const f = env.floorFn(px, pz) + R.r; if (py < f) py = f; }
      X[i * 3] = px; X[i * 3 + 1] = py; X[i * 3 + 2] = pz;
      R.W[i] = py < env.waterY ? 1 : 0;
    }
    Xp.set(X);
    constrain(R, env, 60);
    Xp.set(X);
    R.aPrev.copy(R.a);
    R.init = true;
  }
  function carry(R) {
    const X = R.X, Xp = R.Xp;
    const jx = R.a.x - R.aPrev.x, jy = R.a.y - R.aPrev.y, jz = R.a.z - R.aPrev.z;
    for (let i = 0; i <= TN; i++) {
      const k = (1 - i / TN) * (1 - i / TN), o = i * 3;
      X[o] += jx * k; X[o + 1] += jy * k; X[o + 2] += jz * k;
      Xp[o] += jx * k; Xp[o + 1] += jy * k; Xp[o + 2] += jz * k;
    }
  }
  function critSlack(a, b) {
    const d = Math.hypot(b.x - a.x, b.z - a.z), h = b.y - a.y;
    if (h < 0.01 || d < 0.01) return 0;
    const r = h / d;
    let lo = 1e-4, hi = 40;
    for (let k = 0; k < 40; k++) { const u = 0.5 * (lo + hi); if ((Math.cosh(u) - 1) / u < r) lo = u; else hi = u; }
    const u = 0.5 * (lo + hi);
    return Math.max(0, (d / u) * Math.sinh(u) - Math.sqrt(d * d + h * h));
  }
  function ropeOk(R) { const X = R.X; for (let i = 0; i < X.length; i++) if (!Number.isFinite(X[i])) return false; return Number.isFinite(R.len); }
  function step(env) {
    const dt = Math.min(env.dt, 1 / 30);
    for (const R of ROPES) {
      if (!R.on && !R.init) continue;
      if (R.init && !ropeOk(R)) R.init = false;
      const dist = R.a.distanceTo(R.b);
      const want = clamp(dist * (env.deck ? 1.05 : R.kind ? 1.02 : env.under ? 1.05 : 1.03) + (env.deck ? 0.15 : R.kind ? 0.5 : env.slack), 0.6, R.maxLen);
      const band = env.deck ? LEN_BAND : 0, goal = clamp(R.len, want - band, want + band);
      if (!R.init) R.len = want;
      else if (R.payOnly) {
        const dd = dt > 0 && R.distP >= 0 ? Math.max(0, (dist - R.distP) / dt) : 0, kp = R.pinOn ? 0.96 : 0.94;
        const kc = env.check || 0, rate = lerp(dd + 0.1, Math.min(dd + 0.1, Math.max(0, env.checkV || 0) + 0.02), kc);
        if (dist > kp * R.len) R.len = Math.min(R.maxLen, R.len + Math.min(dist / kp - R.len, rate * dt));
        if (R.dcK > 0.01 && !env.under && dist < SLACK_IN * R.len) R.len = Math.max(0.5, dist / SLACK_IN, R.len - SLACK_IN_V * dt);
      } else {
        if (R.inRateT > 0) R.inRateT = Math.max(0, R.inRateT - dt); else R.inRate = 1;
        const outR = 2.2 + 3.8 * clamp((dist / Math.max(1e-3, R.len) - 0.91) / 0.06, 0, 1);
        R.len = clamp(R.len + clamp(goal - R.len, -R.inRate * dt, outR * dt), 0.5, R.maxLen);
      }
      const hang = env.under && !env.deck && !R.payOnly && R.init;
      const goalS = hang ? Math.min(R.len, dist + 0.4 * critSlack(R.a, R.b) + 0.1) : R.len;
      const haul = 0.6 + 0.9 * clamp(R.lenS - goalS, 0, 1);
      R.lenS = hang && R.lenS > 0 ? clamp(R.lenS + clamp(goalS - R.lenS, -haul * dt, 3 * dt), Math.min(dist, R.len), R.len) : R.len;
      R.distP = dist;
      restLengths(R);
      R.pinK = R.pinOn && R.init ? Math.max(2, Math.min(TNEAR - 2, Math.round(R.pinS / Math.max(1e-3, R.rest[0])))) : -1;
      R.aS.copy(R.a);
      if (!R.init) layOut(R, env);
      else if (env.snap) { carry(R); R.aPrev.copy(R.a); if (R.pinK > 0) R.pinPrev.copy(R.pinP); }
      if (dt <= 0) { R.aPrev.copy(R.a); continue; }
      R.dcK = env.deck && !R.payOnly ? 1 : R.dcK * Math.exp(-dt / DECK_LET);
      R.X0.set(R.X);
      const X = R.X, Xp = R.Xp;
      const n = Math.max(2, Math.min(8, Math.ceil(dt * 240))), h = dt / n;
      const dmA = Math.exp(-3.4 * h), kI = 1 - Math.exp(-100 * h);
      const cx = env.current ? env.current.x : 0, cz = env.current ? env.current.z : 0;
      const ck = R.payOnly ? env.check || 0 : 0;
      for (let sub = 0; sub < n; sub++) {
        R.aS.lerpVectors(R.aPrev, R.a, (sub + 1) / n);
        for (let i = 1; i < TN; i++) {
          const o = i * 3;
          const under = X[o + 1] < env.waterY;
          const g = under ? R.g : -9.8;
          let vx = (X[o] - Xp[o]) / h, vy = (X[o + 1] - Xp[o + 1]) / h, vz = (X[o + 2] - Xp[o + 2]) / h;
          if (under) {
            let rx = vx - cx, ry = vy, rz = vz - cz;
            let tx = X[o + 3] - X[o - 3], ty = X[o + 4] - X[o - 2], tz = X[o + 5] - X[o - 1];
            const tl = Math.sqrt(tx * tx + ty * ty + tz * tz) || 1;
            tx /= tl; ty /= tl; tz /= tl;
            const vt = rx * tx + ry * ty + rz * tz;
            let nx = rx - vt * tx, ny = ry - vt * ty, nz = rz - vt * tz;
            const vn = Math.sqrt(nx * nx + ny * ny + nz * nz);
            const kn = Math.min(0.95, R.cN * vn * h), kt = Math.min(0.95, R.cN * 0.02 * Math.abs(vt) * h), kl = (HOSE_KL + (R.pre[i] < 3 ? 5 * ck : 0)) * h;
            nx *= 1 - kn; ny *= 1 - kn; nz *= 1 - kn;
            const vt2 = vt * (1 - kt);
            rx = (nx + vt2 * tx) * (1 - kl); ry = (ny + vt2 * ty) * (1 - kl); rz = (nz + vt2 * tz) * (1 - kl);
            vx = rx + cx; vy = ry; vz = rz + cz;
            R.W[i] = 1;
          } else {
            vx *= dmA; vy *= dmA; vz *= dmA;
          }
          let mx = vx * h, my = vy * h + g * h * h, mz = vz * h;
          const ml = Math.sqrt(mx * mx + my * my + mz * mz);
          if (ml > 0.03) { const s = 0.03 / ml; mx *= s; my *= s; mz *= s; }
          Xp[o] = X[o]; Xp[o + 1] = X[o + 1]; Xp[o + 2] = X[o + 2];
          X[o] += mx; X[o + 1] += my; X[o + 2] += mz;
        }
        if (X[1] < env.waterY) R.W[0] = 1;
        if (X[TN * 3 + 1] < env.waterY) R.W[TN] = 1;
        bendStep(R, h, env.waterY);
        constrain(R, env, 6 + Math.round((DECK_ITERS - 6) * Math.max(R.dcK, clamp((DECK_LINK - R.rest[0]) / DECK_LINK, 0, 1))));
        nearSolve(R, Math.round(8 * clamp(R.lenS - 2.0, 0, 1)), env.waterY);
        bendLimit(R, 2, env.waterY);
        innerDamp(R, env.waterY, kI);
        if (env.body && env.body.nc > 0) for (let i = 1; i < TN; i++) if (i !== R.pinK && R.pre[i] > 0.25 && R.pre[TN] - R.pre[i] > 0.3) capsContact(R, i * 3, env.body);
        if (R.hasDir) { Xp[3] = X[3]; Xp[4] = X[4]; Xp[5] = X[5]; }
        if (R.dcKd > 1) {
          const fx = (R.a.x - R.aPrev.x) / n, fy = (R.a.y - R.aPrev.y) / n, fz = (R.a.z - R.aPrev.z) / n;
          for (let i = 2; i <= R.dcKd; i++) { const o = i * 3; Xp[o] = X[o] - fx; Xp[o + 1] = X[o + 1] - fy; Xp[o + 2] = X[o + 2] - fz; }
        }
        if (R.pinK > 0) {
          const o = R.pinK * 3, u = sub / n;
          Xp[o] = R.pinPrev.x + (R.pinP.x - R.pinPrev.x) * u; Xp[o + 1] = R.pinPrev.y + (R.pinP.y - R.pinPrev.y) * u; Xp[o + 2] = R.pinPrev.z + (R.pinP.z - R.pinPrev.z) * u;
        }
      }
      if (R.dcK > 0.01 && R.hasDir) {
        deckCurve(R);
        if (env.body && env.body.nc > 0) for (let i = 2; i < TN; i++) if (i !== R.pinK && R.pre[i] > 0.25 && R.pre[TN] - R.pre[i] > 0.3) capsContact(R, i * 3, env.body);
      }
      if (R.payOnly && env.under && R.hasDir) {
        nearCurve(R, env.waterY, 1 - Math.exp(-dt / 0.1));
        if (env.body && env.body.nc > 0) for (let i = 2; i < TN; i++) if (i !== R.pinK && R.pre[i] > 0.25 && R.pre[TN] - R.pre[i] > 0.3) capsContact(R, i * 3, env.body);
      }
      {
        const jx = R.a.x - R.aPrev.x, jy = R.a.y - R.aPrev.y, jz = R.a.z - R.aPrev.z, cap = HOSE_VREL * dt, X0 = R.X0;
        for (let i = 1; i < TN && R.pre[i] < 3; i++) {
          const o = i * 3, dx = X[o] - X0[o] - jx, dy = X[o + 1] - X0[o + 1] - jy, dz = X[o + 2] - X0[o + 2] - jz, d = Math.sqrt(dx * dx + dy * dy + dz * dz);
          if (d <= cap) continue;
          const k = cap / d - 1, cx = dx * k, cy = dy * k, cz = dz * k;
          X[o] += cx; X[o + 1] += cy; X[o + 2] += cz; Xp[o] += cx; Xp[o + 1] += cy; Xp[o + 2] += cz;
          R.guardN++;
        }
      }
      const tn = sstep(0.92, 1.0, dist / Math.max(1e-3, R.len)) * (R.len >= R.maxLen - 0.01 ? 1 : 0.6);
      R.tension += (tn - R.tension) * (1 - Math.exp(-dt * 6));
      R.dir.set(X[6] - X[0], X[7] - X[1], X[8] - X[2]).normalize();
      R.pub.tension = R.tension; R.pub.length = R.len;
      R.aPrev.copy(R.a);
      if (R.pinK > 0) R.pinPrev.copy(R.pinP);
    }
  }
  function mesh(inv, visible) {
    for (const R of ROPES) {
      const S1 = R.sides + 1;
      if (!R.on || !R.init || !visible) {
        for (let v = R.v0; v < R.v0 + NR * S1; v++) { pos[v * 3] = pos[v * 3 + 1] = pos[v * 3 + 2] = 0; }
        continue;
      }
      const X = R.X, P = R.ring, T = R.tang, N = R.norm, A = R.arc;
      for (let i = 0; i < TN; i++) {
        const i0 = Math.max(0, i - 1) * 3, i1 = i * 3, i2 = (i + 1) * 3, i3 = Math.min(TN, i + 2) * 3;
        for (let s = 0; s < TR_SUB; s++) {
          const u = s / TR_SUB, u2 = u * u, u3 = u2 * u, k = (i * TR_SUB + s) * 3;
          for (let c = 0; c < 3; c++) {
            const p0 = X[i0 + c], p1 = X[i1 + c], p2 = X[i2 + c], p3 = X[i3 + c];
            P[k + c] = 0.5 * (2 * p1 + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u2 + (-p0 + 3 * p1 - 3 * p2 + p3) * u3);
          }
        }
        R.wetR[i * TR_SUB] = R.W[i];
      }
      { const k = (NR - 1) * 3; P[k] = X[TN * 3]; P[k + 1] = X[TN * 3 + 1]; P[k + 2] = X[TN * 3 + 2]; R.wetR[NR - 1] = R.W[TN]; }
      const mk = R.hasDir ? 1 : 0;
      if (mk > 0) {
        const l = Math.hypot(X[3] - X[0], X[4] - X[1], X[5] - X[2]) + Math.hypot(X[6] - X[3], X[7] - X[4], X[8] - X[5]), NS = 2 * TR_SUB;
        for (let s = 1; s < NS; s++) {
          const u = s / NS, u2 = u * u, u3 = u2 * u, h00 = 2 * u3 - 3 * u2 + 1, h10 = u3 - 2 * u2 + u, h01 = 3 * u2 - 2 * u3, h11 = u3 - u2;
          for (let c = 0; c < 3; c++) {
            const hp = h00 * X[c] + h10 * R.mouth.getComponent(c) * l + h01 * X[6 + c] + h11 * (X[9 + c] - X[3 + c]);
            P[s * 3 + c] += (hp - P[s * 3 + c]) * mk;
          }
        }
        P[0] = X[0] - R.mouth.x * NUT_SINK; P[1] = X[1] - R.mouth.y * NUT_SINK; P[2] = X[2] - R.mouth.z * NUT_SINK;
      }
      for (let i = 0; i < NR; i++) {
        const a = Math.max(0, i - 1) * 3, b = Math.min(NR - 1, i + 1) * 3;
        let tx = P[b] - P[a], ty = P[b + 1] - P[a + 1], tz = P[b + 2] - P[a + 2];
        if (i === 0 && mk > 0) { tx = R.mouth.x; ty = R.mouth.y; tz = R.mouth.z; }
        const tl = Math.sqrt(tx * tx + ty * ty + tz * tz) || 1;
        T[i * 3] = tx / tl; T[i * 3 + 1] = ty / tl; T[i * 3 + 2] = tz / tl;
        A[i] = i ? A[i - 1] + Math.hypot(P[i * 3] - P[i * 3 - 3], P[i * 3 + 1] - P[i * 3 - 2], P[i * 3 + 2] - P[i * 3 - 1]) : 0;
        if (i % TR_SUB) { const i0 = i - (i % TR_SUB), u = (i % TR_SUB) / TR_SUB; R.wetR[i] = R.wetR[i0] + (R.wetR[Math.min(NR - 1, i0 + TR_SUB)] - R.wetR[i0]) * u; }
      }
      _t0.set(T[0], T[1], T[2]);
      _n.set(0, 1, 0);
      if (Math.abs(_n.dot(_t0)) > 0.9) _n.set(1, 0, 0);
      _n.addScaledVector(_t0, -_n.dot(_t0)).normalize();
      N[0] = _n.x; N[1] = _n.y; N[2] = _n.z;
      for (let i = 1; i < NR; i++) {
        _t0.set(T[i * 3 - 3], T[i * 3 - 2], T[i * 3 - 1]);
        _t1.set(T[i * 3], T[i * 3 + 1], T[i * 3 + 2]);
        _q.setFromUnitVectors(_t0, _t1);
        _n.applyQuaternion(_q);
        _n.addScaledVector(_t1, -_n.dot(_t1)).normalize();
        N[i * 3] = _n.x; N[i * 3 + 1] = _n.y; N[i * 3 + 2] = _n.z;
      }
      const e = inv.elements;
      for (let i = 0; i < NR; i++) {
        _t1.set(T[i * 3], T[i * 3 + 1], T[i * 3 + 2]);
        _n.set(N[i * 3], N[i * 3 + 1], N[i * 3 + 2]);
        _b.crossVectors(_t1, _n);
        const px = P[i * 3], py = P[i * 3 + 1], pz = P[i * 3 + 2];
        for (let j = 0; j <= R.sides; j++) {
          const ang = (j / R.sides) * TAU, ca = Math.cos(ang), sa = Math.sin(ang);
          const nx = _n.x * ca + _b.x * sa, ny = _n.y * ca + _b.y * sa, nz = _n.z * ca + _b.z * sa;
          const wx = px + nx * R.r, wy = py + ny * R.r, wz = pz + nz * R.r;
          const v = R.v0 + i * S1 + j;
          pos[v * 3] = e[0] * wx + e[4] * wy + e[8] * wz + e[12];
          pos[v * 3 + 1] = e[1] * wx + e[5] * wy + e[9] * wz + e[13];
          pos[v * 3 + 2] = e[2] * wx + e[6] * wy + e[10] * wz + e[14];
          const lx = e[0] * nx + e[4] * ny + e[8] * nz, ly = e[1] * nx + e[5] * ny + e[9] * nz, lz = e[2] * nx + e[6] * ny + e[10] * nz;
          const ll = Math.sqrt(lx * lx + ly * ly + lz * lz) || 1;
          nrm[v * 3] = lx / ll; nrm[v * 3 + 1] = ly / ll; nrm[v * 3 + 2] = lz / ll;
          uv[v * 2] = A[i];
          tw[v] = R.wetR[i];
        }
      }
    }
    aPos.needsUpdate = true; aNrm.needsUpdate = true; aUv.needsUpdate = true; aTw.needsUpdate = true;
  }
  function pointAt(ri, s, out) {
    const R = ROPES[ri];
    let acc = 0;
    for (let i = 0; i < TN; i++) {
      const l = R.rest[i];
      if (acc + l >= s) {
        const u = (s - acc) / (l || 1), o = i * 3;
        return out.set(lerp(R.X[o], R.X[o + 3], u), lerp(R.X[o + 1], R.X[o + 4], u), lerp(R.X[o + 2], R.X[o + 5], u));
      }
      acc += l;
    }
    return out.set(R.X[TN * 3], R.X[TN * 3 + 1], R.X[TN * 3 + 2]);
  }
  function clearBody(env) {
    const Bd = env.body;
    if (!Bd || !(Bd.nc > 0)) return;
    for (const R of ROPES) {
      if (!R.init) continue;
      for (let i = 1; i < TN; i++) if (i !== R.pinK && R.pre[i] > 0.25 && R.pre[TN] - R.pre[i] > 0.3) capsContact(R, i * 3, Bd, true);
    }
  }
  return { ROPES, geo, step, mesh, pointAt, clearBody };
}

function buildBeltKit(B, seg, field, fSuit) {
  const gw = new Float32Array(NBB), gsi = new Uint16Array(4), gsw = new Float32Array(4);
  const g0 = (p) => p.g === 0;
  const gradAt = (fn, p, e = 0.0015) => vnorm([
    fn(p[0] + e, p[1], p[2]) - fn(p[0] - e, p[1], p[2]),
    fn(p[0], p[1] + e, p[2]) - fn(p[0], p[1] - e, p[2]),
    fn(p[0], p[1], p[2] + e) - fn(p[0], p[1], p[2] - e),
  ]);
  const onSurf = (fn, p, it = 6) => {
    let q = p.slice();
    for (let i = 0; i < it; i++) q = vmad(q, gradAt(fn, q), -fn(q[0], q[1], q[2]));
    return { p: q, n: gradAt(fn, q) };
  };
  const skinAt = (q) => {
    const s = onSurf(fSuit, q.p, 3);
    field.weights(s.p[0], s.p[1], s.p[2], gw, g0);
    top4(gw, gsi, gsw, 0);
    return [gsi[0], gsi[1], gsi[2], gsi[3], gsw[0], gsw[1], gsw[2], gsw[3]];
  };
  const trunkRay = (y, th) => {
    const dx = Math.sin(th), dz = -Math.cos(th);
    let lo = 0, hi = 0.36;
    for (let i = 0; i < 24; i++) { const m = 0.5 * (lo + hi); if (fSuit(dx * m, y, 0.01 + dz * m) < 0) lo = m; else hi = m; }
    const r = 0.5 * (lo + hi), p = [dx * r, y, 0.01 + dz * r];
    return { p, n: gradAt(fSuit, p) };
  };
  const out = {};
  const NB = seg(56), BY = 0.078;
  const beltPath = [];
  for (let k = 0; k < NB; k++) beltPath.push(trunkRay(BY + 0.004 * Math.sin((k / NB) * TAU * 3), (k / NB) * TAU));
  const belt = ribbon(beltPath, 0.046, 0.005, 0.0015, true, 10);
  B.add(belt, { col: COL.belt, mat: MAT.leather, aux: (q) => [0.2, 18, sstep(0.018, 0.023, Math.abs(q.v)) * 0.7, 0], skin: skinAt, tag: 'belt' });
  {
    const f = belt.frames[0], c = vmad(beltPath[0].p, f.N, 0.009);
    const frame = merge([rbox(0.028, 0.03, 0.0035, 0.004)]);
    xform(frame, basis(c, f.S, f.T, f.N));
    B.add(frame, { col: COL.brass, mat: MAT.brass, aux: [0.3, 7, 0.7, 0], skin: skinAt, tag: 'belt' });
    const hole = rbox(0.02, 0.022, 0.004, 0.003);
    xform(hole, basis(vmad(c, f.N, 0.001), f.S, f.T, f.N));
    B.add(hole, { col: COL.belt, mat: MAT.leather, aux: [0.5, 18, 0.2, 0], skin: skinAt, tag: 'belt' });
  }
  {
    const KB = BI.knife; J('knife');
    const hip = trunkRay(BY, 90 * DEG);
    const top = vadd(vmad(hip.p, hip.n, 0.04), [0, -0.05, 0]);
    const down = vnorm([0.15, -1, -0.22]);
    const side = vnorm(vcross(down, [0, 0, 1]));
    const fwd = vcross(side, down);
    const sheath = gridIJ(seg(16), seg(18), (i, j) => {
      const a = (i / seg(16)) * TAU, v = j / seg(18);
      const w = lerp(0.027, 0.009, v ** 1.4) * (v > 0.97 ? Math.sqrt(Math.max(0, 1 - ((v - 0.97) / 0.03) ** 2)) : 1);
      const th = lerp(0.013, 0.006, v);
      const x = Math.cos(a) * w, z = Math.sin(a) * th;
      const p = vadd(vadd(vmad(top, down, v * 0.27), vmul(side, x)), vmul(fwd, z));
      return [p[0], p[1], p[2], a * 0.02, v * 0.27];
    });
    B.add(sheath, { col: COL.brass, mat: MAT.brass, aux: (q) => [0.35, 7, sstep(0.3, 0.9, Math.abs(Math.cos(q.u / 0.02))) * 0.6, 0], skin: KB, tag: 'knife', inside: vmad(top, down, 0.1) });
    for (const v of [0.04, 0.2]) {
      const c = vmad(top, down, v * 0.27);
      const band = torus(lerp(0.027, 0.009, v ** 1.4) * 1.02, 0.0024, seg(14), 5);
      xform(band, basis(c, side, down, fwd).multiply(new THREE.Matrix4().makeScale(1, 1, 0.55)));
      B.add(band, { col: COL.gun, mat: MAT.gun, aux: [0.5, 6, 0.7, 0], skin: KB, tag: 'knife' });
    }
    const hb = vmad(top, down, -4e-3);
    const handle = lathe([[0.0, 0], [0.014, 0], [0.015, 0.022], [0.0132, 0.06], [0.015, 0.095], [0.0, 0.1]], seg(12));
    xform(handle, orient(hb, vmul(down, -1)));
    B.add(handle, { col: [0.12, 0.058, 0.024], mat: MAT.wood, aux: [0.2, 19, 0.6, 0], skin: KB, tag: 'knife' });
    const pommel = lathe([[0, 0], [0.014, 0], [0.012, 0.01], [0, 0.014]], seg(12));
    xform(pommel, orient(vmad(hb, down, -0.098), vmul(down, -1)));
    B.add(pommel, { col: COL.brass, mat: MAT.brass, aux: [0.2, 7, 0.9, 0], skin: KB, tag: 'knife' });
    const frog = rbox(0.018, 0.03, 0.004, 0.002);
    xform(frog, basis(vmad(hip.p, hip.n, 0.01), vnorm(vcross([0, 1, 0], hip.n)), [0, 1, 0], hip.n));
    B.add(frog, { col: COL.belt, mat: MAT.leather, aux: [0.3, 18, 0.5, 0], skin: (q) => { const w = skinAt(q); return w; }, tag: 'knife' });
    out.knifeTop = top;
  }
  {
    const GB = BI.bag; J('bag');
    const hip = trunkRay(BY, -95 * DEG);
    const ringC = vadd(vmad(hip.p, hip.n, 0.045), [0, -0.027, 0]);
    const ring = torus(0.042, 0.0038, seg(24), 6);
    xform(ring, basis(ringC, [0, 0, 1], [0, 1, 0], [-1, 0, 0]).multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2)).multiply(new THREE.Matrix4().makeScale(1, 1, 0.5)));
    B.add(ring, { col: [0.16, 0.085, 0.035], mat: [0.9, 0, 0.5, K.CLOTH], aux: [0.3, 22, 0, 0], skin: GB, tag: 'bag' });
    {
      const nh = vnorm([hip.n[0], 0, hip.n[2]]);
      const topB = trunkRay(BY + 0.027, -95 * DEG), footB = trunkRay(BY - 0.027, -95 * DEG);
      const onBelt = (r, k) => ({ p: vmad(r.p, r.n, 0.0068), n: r.n, k });
      const rim = vmad(ringC, nh, -0.041);
      const ctrl = [onBelt(topB, 0), onBelt(footB, 0), { p: vadd(vmad(rim, nh, 0.001), [0, -4e-3, 0]), n: vnorm(vadd(nh, [0, -0.3, 0])), k: 1 }, { p: vadd(vmad(rim, nh, 0.008), [0, -9e-3, 0]), n: vnorm(vadd(nh, [0, -1, 0])), k: 1 }];
      const pts = smoothPath(ctrl.map((c) => c.p), 12);
      const path = pts.map((p) => {
        let bi = 0, bd = Infinity;
        for (let i = 0; i < ctrl.length; i++) { const d = vlen(vsub(p, ctrl[i].p)); if (d < bd) { bd = d; bi = i; } }
        return { p, n: ctrl[bi].n };
      });
      const strap = ribbon(path, 0.02, 0.0035, 0, false, 10);
      const y0 = footB.p[1] + 0.004, y1 = ringC[1] - 0.003;
      B.add(strap, {
        col: COL.belt, mat: MAT.leather, aux: [0.3, 18, 0.45, 0], tag: 'bag',
        skin: (q) => {
          const t = sstep(y0, y1, q.p[1]), w = skinAt(q);
          if (t <= 0) return w;
          if (t >= 1) return [GB, 0, 0, 0, 1, 0, 0, 0];
          let slot = 0;
          for (let k = 1; k < 4; k++) if (w[4 + k] < w[4 + slot]) slot = k;
          for (let k = 0; k < 4; k++) w[4 + k] *= 1 - t;
          w[slot] = GB; w[4 + slot] = t;
          return w;
        },
      });
    }
    const prof = [];
    for (let k = 0; k <= 16; k++) {
      const v = k / 16;
      const r = 0.042 + 0.078 * Math.sin(Math.PI * Math.min(1, v * 1.12)) ** 0.8 * (1 - 0.3 * v) - 0.035 * sstep(0.84, 1, v);
      prof.push([Math.max(0.004, r), -0.37 * v]);
    }
    prof.reverse();
    const bag = lathe(prof, seg(24));
    const flat = new THREE.Matrix4().makeScale(1, 1, 0.62);
    const M = T3(ringC[0], ringC[1], ringC[2]).multiply(flat);
    xform(bag, M);
    for (let i = 0; i < bag.UV.length / 2; i++) bag.UV[i * 2 + 1] = -bag.UV[i * 2 + 1] * 1.0;
    B.add(bag, { col: [0.3, 0.22, 0.1], mat: MAT.net, aux: [0.3, 20, 0, 0], skin: GB, tag: 'bag' });
    const inner = { P: bag.P.slice(), I: bag.I.slice(), UV: bag.UV.slice() };
    flipWinding(inner);
    B.add(inner, { col: [0.3, 0.22, 0.1], mat: MAT.net, aux: [0.3, 20, 0, 0], skin: GB, tag: 'bag' });
    const sp = lathe([[0.0, -0.04], [0.03, -0.035], [0.04, -0.01], [0.036, 0.02], [0.02, 0.035], [0.0, 0.038]], seg(14));
    for (let i = 0; i < sp.P.length; i += 3) { const n = 0.8 + 0.4 * vnoise3(sp.P[i] * 90, sp.P[i + 1] * 90, sp.P[i + 2] * 90, 3); sp.P[i] *= n; sp.P[i + 2] *= n; }
    xform(sp, T3(ringC[0], ringC[1] - 0.28, ringC[2]).multiply(new THREE.Matrix4().makeScale(1.05, 1, 0.65)));
    B.add(sp, { col: [0.03, 0.025, 0.018], mat: [0.95, 0, 0.4, K.CLOTH], aux: [0.6, 21, 0, 0], skin: GB, tag: 'bag' });
    out.bagBottom = [ringC[0], ringC[1] - 0.34, ringC[2]];
    out.bagMouth = ringC;
  }
  for (const S of SIDES) {
    const hp = J('thigh' + S), kn = J('shin' + S), an = J('foot' + S);
    const legX = (y) => (y > kn[1] ? lerp(hp[0], kn[0], clamp((hp[1] - y) / (hp[1] - kn[1]), 0, 1)) : lerp(kn[0], an[0], clamp((kn[1] - y) / (kn[1] - an[1]), 0, 1)));
    for (const [yT, yB] of lacePanels(S)) {
      const N = Math.max(2, Math.round((yT - yB) / 0.03));
      const eye = (k, sd) => {
        const y = lerp(yT, yB, k / N);
        const cx = legX(y) + sd * 0.017;
        let lo = 0, hi = 0.25;
        for (let i = 0; i < 22; i++) { const m = 0.5 * (lo + hi); if (fSuit(cx, y, 0.2 - m) > 0) lo = m; else hi = m; }
        const p = [cx, y, 0.2 - lo];
        return { p, n: gradAt(fSuit, p) };
      };
      const rows = [];
      for (let k = 0; k <= N; k++) rows.push([eye(k, -1), eye(k, 1)]);
      for (let sd = 0; sd < 2; sd++) {
        const pts = [];
        for (let k = 0; k <= N; k++) {
          const e = rows[k][(k + sd) % 2];
          pts.push(vmad(e.p, e.n, 0.0035));
          if (k < N) { const e2 = rows[k + 1][(k + 1 + sd) % 2]; pts.push(vmad(vlerp(e.p, e2.p, 0.5), vnorm(vadd(e.n, e2.n)), 0.005 + sd * 0.002)); }
        }
        B.add(tubeAlong(smoothPath(pts, seg(30)), () => 0.0025, seg(8)), { col: [0.36, 0.28, 0.14], mat: MAT.rope, aux: [0.3, 15, 0.2, 0.0025], skin: skinAt, tag: 'lacing' });
      }
      for (let k = 0; k <= N; k++) for (const e of rows[k]) {
        const ey = torus(0.0041, 0.0014, seg(10), 5);
        xform(ey, orient(vmad(e.p, e.n, 0.0008), e.n).multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2)));
        B.add(ey, { col: COL.brass, mat: MAT.brass, aux: [0.5, 7, 0.5, 0], skin: skinAt, tag: 'lacing' });
      }
    }
  }
  return out;
}
function lacePanels(S) {
  const kn = J('shin' + S), an = J('foot' + S);
  return [[kn[1] + 0.37, kn[1] + 0.1], [kn[1] - 0.08, an[1] + 0.105]];
}
function* suitGrainSteps(N) {
  const NN = N * N, TX = 0.512 / N, M = N - 1;
  let sd = 0x2545f491;
  const rnd = () => { sd ^= sd << 13; sd ^= sd >>> 17; sd ^= sd << 5; return (sd >>> 0) / 4294967296; };
  const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-9)) * Math.cos(TAU * rnd());
  const al = new Float32Array(NN), hh = new Float32Array(NN), wr = new Float32Array(NN);
  const cells = (m) => Math.max(2, Math.round(0.512 / m));
  const px = new Float64Array(96), pk = new Int32Array(96);
  const stamp = (cx, cy, L, W, da, dh, dw) => {
    let c = 0;
    for (let x = Math.floor(cx - L); x <= Math.ceil(cx + L) && c < 96; x++) {
      const ax = (x + 0.5 - cx) / L;
      if (ax <= -1 || ax >= 1) continue;
      px[c] = Math.cos(1.5708 * ax) ** 2;
      pk[c++] = x & M;
    }
    for (let y = Math.floor(cy - W - 1); y <= Math.ceil(cy + W + 1); y++) {
      const ay = (y + 0.5 - cy) / (W + 0.5);
      if (ay <= -1 || ay >= 1) continue;
      const py = Math.cos(1.5708 * ay) ** 2, row = (y & M) * N;
      for (let i = 0; i < c; i++) {
        const pr = py * px[i], k = row + pk[i];
        al[k] += da * pr; hh[k] += dh * pr; wr[k] += dw * pr;
      }
    }
  };
  for (let s = 0; s < 800; s++) {
    const L = Math.min(0.012, Math.max(0.003, 0.005 * Math.exp(0.45 * gauss()))) / TX / 2;
    const dark = rnd() < 0.25;
    stamp(rnd() * N, rnd() * N, L, Math.max(0.35, (0.0003 + 0.0002 * rnd()) / TX), dark ? -0.03 : 0.035 + 0.02 * rnd(), 4e-5, 0.25);
  }
  for (let s = 0; s < 110; s++) {
    const L = (0.008 + 0.01 * rnd()) / TX / 2;
    stamp(rnd() * N, rnd() * N, L, Math.max(0.4, (0.00045 + 0.00025 * rnd()) / TX), 0.05 + 0.03 * rnd(), 6e-5, 0.35);
  }
  for (let s = 0; s < 2600; s++) {
    const R = Math.max(0.5, (0.0003 + 0.0004 * rnd()) / TX);
    stamp(rnd() * N, rnd() * N, R, R * 0.8, 0.01, 1.2e-5, 0.15);
  }
  for (let s = 0; s < 2000; s++) {
    const R = Math.max(0.5, (0.0002 + 0.0004 * rnd()) / TX);
    stamp(rnd() * N, rnd() * N, R * (1 + rnd()), R, -0.01, -5e-6, -0.15);
  }
  yield;
  const axis = (g) => {
    const i0 = new Int32Array(N), i1 = new Int32Array(N), w = new Float32Array(N);
    for (let x = 0; x < N; x++) { const f = (x * g) / N, c = Math.floor(f), t = f - c; i0[x] = (c % g) * N; i1[x] = ((c + 1) % g) * N; w[x] = t * t * (3 - 2 * t); }
    return { i0, i1, w };
  };
  const rows = (gx, gy) => {
    const v = new Float32Array(gx), R = new Float32Array(gy * N);
    const f = new Float32Array(N), c0 = new Int32Array(N), c1 = new Int32Array(N);
    for (let x = 0; x < N; x++) { const u = (x * gx) / N, c = Math.floor(u), t = u - c; c0[x] = c % gx; c1[x] = (c + 1) % gx; f[x] = t * t * (3 - 2 * t); }
    for (let j = 0; j < gy; j++) {
      for (let i = 0; i < gx; i++) v[i] = rnd() - 0.5;
      const r = j * N;
      for (let x = 0; x < N; x++) { const a = v[c0[x]]; R[r + x] = a + (v[c1[x]] - a) * f[x]; }
    }
    return { R, Y: axis(gy) };
  };
  const cP = rows(cells(0.085), cells(0.013));
  const c32 = rows(cells(0.032), cells(0.032)), c8 = rows(cells(0.008), cells(0.008));
  const cT = rows(cells(0.04), cells(0.0025));
  const c3 = rows(cells(0.003), cells(0.003));
  const cW = rows(cells(0.001), cells(0.02));
  const yarn = rows(cells(0.024), 64), yarn2 = rows(cells(0.009), 64);
  yield;
  const ta = N >= 1024 ? 0.045 : 0.03;
  let h = sd | 1;
  const nrow = () => { const r = new Float32Array(N); for (let x = 0; x < N; x++) { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; r[x] = (h >>> 0) / 4294967296 - 0.5; } return r; };
  const rL2 = nrow(), rL1 = nrow(), rF0 = nrow(), rF1 = nrow();
  let rP2 = rL2, rP = rL1, rC = rF0, rN = rF1, rN2 = nrow();
  const HB = 2048, lo = -2.5, sc = HB / 6, hist = new Float32Array(HB + 1);
  let yi = 0, yo = 0, ya = 0, left = 0;
  for (let y = 0; y < N; y++) {
    if (left <= 0) {
      yi = ((rnd() * 64) | 0) * N; yo = (rnd() * N) | 0; ya = 0.024 * (0.4 + 1.2 * rnd());
      left = Math.max(1, Math.round((0.0004 + 0.0011 * rnd()) / TX));
    }
    left--;
    const row = y * N;
    const pa = cP.Y.i0[y], pb = cP.Y.i1[y], pw = cP.Y.w[y];
    const aa = c32.Y.i0[y], ab = c32.Y.i1[y], aw = c32.Y.w[y];
    const ba = c8.Y.i0[y], bb = c8.Y.i1[y], bw = c8.Y.w[y];
    const ta0 = cT.Y.i0[y], tb0 = cT.Y.i1[y], tw = cT.Y.w[y];
    const ka = c3.Y.i0[y], kb = c3.Y.i1[y], kw = c3.Y.w[y];
    const wa = cW.Y.i0[y], wb = cW.Y.i1[y], ww = cW.Y.w[y];
    const PR = cP.R, AR = c32.R, BR = c8.R, TR = cT.R, KR = c3.R, WR = cW.R, Y1 = yarn.R, Y2 = yarn2.R;
    for (let x = 0; x < N; x++) {
      let q = PR[pa + x]; const sP = q + (PR[pb + x] - q) * pw;
      q = AR[aa + x]; const s32 = q + (AR[ab + x] - q) * aw;
      q = BR[ba + x]; const s8 = q + (BR[bb + x] - q) * bw;
      q = TR[ta0 + x]; const sT = q + (TR[tb0 + x] - q) * tw;
      q = KR[ka + x]; const s3 = q + (KR[kb + x] - q) * kw;
      q = WR[wa + x]; const sW = q + (WR[wb + x] - q) * ww;
      const xs = yi + ((x + yo) & M), sY = ya * (Y1[xs] + 0.6 * Y2[xs]) * 2.5;
      const tt = rC[x] + 0.4 * rC[(x - 1) & M] + 0.8 * (rN[(x + 2) & M] + rP[(x - 2) & M]) + 0.25 * (rN2[(x + 4) & M] + rP2[(x - 4) & M]);
      const k = row + x;
      al[k] += 0.09 * sP + 0.07 * s32 + 0.035 * s8 + 0.035 * s3 + 0.06 * sT + 0.05 * sW + 0.35 * sY + ta * tt;
      hh[k] += 2e-5 * sT + 2.2e-5 * s3 + 0.5e-5 * sW + 0.15e-3 * sY + 0.8e-5 * tt;
      const w = (wr[k] += 0.15 * sP + 0.3 * s32 + 0.45 * s8 + 0.8 * s3 + 0.3 * sT + 0.03 * sW + 1.5 * sY + 0.05 * tt);
      const bi = ((w - lo) * sc) | 0;
      hist[(bi < 0 ? 0 : bi >= HB ? HB - 1 : bi) + 1]++;
    }
    const y3 = y + 3;
    rP2 = rP; rP = rC; rC = rN; rN = rN2;
    rN2 = y3 === N - 2 ? rL2 : y3 === N - 1 ? rL1 : y3 === N ? rF0 : y3 === N + 1 ? rF1 : y3 < N - 2 ? nrow() : rN2;
    if ((y & 127) === 127) yield;
  }
  for (let i = 1; i <= HB; i++) hist[i] += hist[i - 1];
  for (let i = 0; i <= HB; i++) hist[i] *= 255 / NN;
  const i2 = 1 / (2 * TX);
  let gmax = 1e-6;
  for (let y = 0; y < N; y += 4) {
    const r0 = y * N, ru = ((y + 1) & M) * N, rd = ((y - 1) & M) * N;
    for (let x = 0; x < N; x++) {
      const a = Math.abs(hh[r0 + ((x + 1) & M)] - hh[r0 + ((x - 1) & M)]), b = Math.abs(hh[ru + x] - hh[rd + x]);
      if (a > gmax) gmax = a;
      if (b > gmax) gmax = b;
    }
  }
  yield;
  const d = new Uint8Array(NN * 4), g2 = 127.5 / gmax;
  for (let y = 0; y < N; y++) {
    const r0 = y * N, ru = ((y + 1) & M) * N, rd = ((y - 1) & M) * N;
    for (let x = 0; x < N; x++) {
      const k = r0 + x, o = k * 4;
      const sa = 128 + (hh[r0 + ((x + 1) & M)] - hh[r0 + ((x - 1) & M)]) * g2, sb = 128 + (hh[ru + x] - hh[rd + x]) * g2;
      d[o] = sa < 0 ? 0 : sa > 255 ? 255 : sa | 0;
      d[o + 1] = sb < 0 ? 0 : sb > 255 ? 255 : sb | 0;
      const b = 128 + 255 * al[k];
      d[o + 2] = b < 0 ? 0 : b > 255 ? 255 : b | 0;
      const f = Math.min(HB - 0.001, Math.max(0, (wr[k] - lo) * sc)), i = f | 0;
      d[o + 3] = (0.5 + hist[i] + (hist[i + 1] - hist[i]) * (f - i)) | 0;
    }
    if ((y & 255) === 255) yield;
  }
  return { data: d, N, gmax: gmax * i2 };
}

const POSE_NAMES = ['stand', 'walk', 'bound', 'sink', 'land', 'kneel', 'present', 'crank', 'climb', 'step', 'brace', 'deck', 'perch'];
const PI_ = { stand: 0, walk: 1, bound: 2, sink: 3, land: 4, kneel: 5, present: 6, crank: 7, climb: 8, step: 9, brace: 10, deck: 11, perch: 12 };
const PLANT = [1, 1, 0, 0, 1, 0.5, 1, 1, 0, 0, 1, 1, 0];
function createDiver({ patchMaterial, envMap = null, quality = 'high' } = {}) {
  const buildT0 = performance.now();
  const low = quality === 'low' || (typeof quality === 'number' && quality < 0.75);
  const seg = (n) => Math.max(3, Math.round(n * (low ? 0.55 : 1)));
  const patch = typeof patchMaterial === 'function' ? patchMaterial : (m) => m;
  const B = makeBuilder();

  const sp = suitPrims(1);
  const HP = headPrims({ nose: 1.06, brow: 1.2, jaw: 1.05, stache: 1.25, stacheDroop: 1.2, width: 0.98, cheek: 1.08, chin: 1.02 });
  const knit = primTorus([0, 0.527, 0.016], [0, 1, 0.12], 0.052, 0.0135, WMIX([[BI.neck, 0.6], [BI.chest, 0.4]]), { g: 1, k: 0.014, sig: 0.02 });
  knit.tag = 'knit';
  const prims = [...sp, ...HP.prims, knit];
  const field = makeField(prims);
  const fSuit = (x, y, z) => field.d(x, y, z, 1);
  const fHead = (x, y, z) => field.d(x, y, z, 2);
  const skinSDF = (pc, g, iters) => {
    const nv = pc.P.length / 3;
    const W = new Float32Array(nv * NBB), row = new Float32Array(NBB), filt = (p) => p.g === g;
    for (let i = 0; i < nv; i++) {
      field.weights(pc.P[i * 3], pc.P[i * 3 + 1], pc.P[i * 3 + 2], row, filt);
      W.set(row, i * NBB);
    }
    smoothWeights(W, nv, NBB, pc.I, iters);
    pc.SI = new Uint16Array(nv * 4);
    pc.SW = new Float32Array(nv * 4);
    for (let i = 0; i < nv; i++) top4(W.subarray(i * NBB, (i + 1) * NBB), pc.SI, pc.SW, i * 4);
  };
  const hBody = low ? 0.018 : 0.0112;
  const body = surfaceNets(fSuit, [-0.72, -0.84, -0.27], [0.72, 0.61, 0.28], hBody);
  body.N = projectVerts(fSuit, body.P, hBody);
  {
    const P = body.P, keep = [];
    const hid = (i) => {
      const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2];
      const rm = rimAt(Math.atan2(x, -(z - HZ)));
      return y > rm.y + 0.03 && Math.hypot(x, z - HZ) < rm.r - 0.02;
    };
    for (let t = 0; t < body.I.length; t += 3) if (!(hid(body.I[t]) && hid(body.I[t + 1]) && hid(body.I[t + 2]))) keep.push(body.I[t], body.I[t + 1], body.I[t + 2]);
    body.I = Uint32Array.from(keep);
  }
  const bodyAO = bakeAO(body.P, body.N, fSuit, 0.014, 4, 1.1);
  skinSDF(body, 0, 2);
  B.add(body, { col: COL.twill, mat: MAT.twill, aux: (q) => [bodyAO[q.i], 0, 0, 0], tag: 'suit' });
  const hHead = low ? 0.0088 : 0.0048;
  const head = surfaceNets(fHead, [-0.098, 0.488, -0.128], [0.098, 0.8, 0.128], hHead);
  head.N = projectVerts(fHead, head.P, hHead, 3);
  const headAO = bakeAO(head.P, head.N, fHead, 0.005, 4, 1.25);
  skinSDF(head, 1, 2);
  {
    const nv = head.P.length / 3;
    const cls = new Uint8Array(nv);
    for (let i = 0; i < nv; i++) {
      const x = head.P[i * 3], y = head.P[i * 3 + 1], z = head.P[i * 3 + 2];
      const p = field.nearest(x, y, z, 1);
      const tag = p ? p.tag : 'skin';
      let c = 0;
      if (tag === 'stache') c = 2;
      else if (tag === 'lip') c = 3;
      else if (tag === 'knit') c = 4;
      else if (tag === 'brow') c = 5;
      else if (Math.abs(x) < 0.066 && ((y > 0.708 && z > -0.05) || (y > 0.64 && z > 0.035))) c = 1;
      cls[i] = c;
    }
    const hairM = new Float32Array(nv), lipM = new Float32Array(nv);
    for (let i = 0; i < nv; i++) { const c = cls[i]; hairM[i] = c === 1 || c === 2 ? 1 : c === 5 ? 0.8 : 0; lipM[i] = c === 3 ? 1 : 0; }
    smoothScalar(hairM, nv, head.I, 2);
    smoothScalar(lipM, nv, head.I, 1);
    B.add(head, {
      col: (q) => (cls[q.i] === 4 ? COL.jersey : COL.skin),
      mat: (q) => (cls[q.i] === 4 ? [0.95, 0, 0.3, K.KNIT] : [0.5, 0, 0.6, K.SKIN]),
      aux: (q) => [headAO[q.i], 1, lipM[q.i], hairM[q.i]], tag: 'head',
    });
  }
  {
    const { eye, lid, lidLo } = eyeParts(seg);
    for (const S of SIDES) {
      const c = J('eye' + S);
      const l3 = { P: lidLo.P.slice(), I: lidLo.I.slice(), UV: lidLo.UV.slice() };
      xform(l3, T3(c[0], c[1], c[2]));
      B.add(l3, { col: COL.skin, mat: MAT.skin, aux: [0.35, 1, 0, 0], skin: BI.head, tag: 'eyes' });
      const e2 = { P: eye.P.slice(), I: eye.I.slice(), UV: eye.UV.slice() };
      xform(e2, T3(c[0], c[1], c[2]));
      B.add(e2, { col: [0.5, 0.47, 0.42], mat: MAT.eye, aux: [0, 1, 0, 0], skin: BI['eye' + S], tag: 'eyes' });
      const l2 = { P: lid.P.slice(), I: lid.I.slice(), UV: lid.UV.slice() };
      xform(l2, T3(c[0], c[1], c[2]));
      B.add(l2, { col: COL.skin, mat: MAT.skin, aux: [0, 1, 0, 0], skin: BI['lid' + S], tag: 'eyes' });
    }
  }
  {
    const HAND = makeHand();
    const hHand = low ? 0.0066 : 0.0034;
    const hand = surfaceNets(HAND.f, [-0.058, -0.2, -0.085], [0.05, 0.062, 0.062], hHand);
    hand.N = projectVerts(HAND.f, hand.P, hHand, 3);
    const handAO = bakeAO(hand.P, hand.N, HAND.f, 0.004, 4, 1.2);
    const { WH, KEYS, NK } = handWeights(HAND, hand);
    for (const S of SIDES) B.add(handPiece(HAND, hand, S, WH, KEYS, NK, handAO), { col: COL.skin, mat: MAT.skin, tag: 'hands' });
  }
  const HELM = buildHelmet(B, seg);
  const BOOT = buildBoots(B, seg, fSuit);
  buildWeights(B, seg);
  const KIT = buildBeltKit(B, seg, field, fSuit);

  const A = B.A;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(A.P, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(A.N, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(A.UV, 2));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(A.C, 3));
  geo.setAttribute('aMat', new THREE.Float32BufferAttribute(A.M, 4));
  geo.setAttribute('aRest', new THREE.Float32BufferAttribute(A.R, 3));
  geo.setAttribute('aAux', new THREE.Float32BufferAttribute(A.X, 4));
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(A.SI, 4));
  geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(A.SW, 4));
  geo.setIndex(A.I);
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 2.2);
  geo.boundingBox = new THREE.Box3(new THREE.Vector3(-2.2, -2.2, -2.2), new THREE.Vector3(2.2, 2.2, 2.2));
  const glassGeo = (() => {
    const parts = HELM.glassParts;
    const m = merge(parts);
    computeNormals(m);
    let nv = 0;
    const SI = new Uint16Array(m.P.length / 3 * 4), SW = new Float32Array(m.P.length / 3 * 4);
    for (const p of parts) { const n = p.P.length / 3; for (let v = 0; v < n; v++) { SI[(nv + v) * 4] = p.bone; SW[(nv + v) * 4] = 1; } nv += n; }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(m.P, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(m.N, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(m.UV, 2));
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(SI, 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(SW, 4));
    g.setIndex(new THREE.BufferAttribute(m.I, 1));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 2.2);
    return g;
  })();

  const JC = [], JA = [], JN = [], JP = [];
  const addJ = (c, a, n, prm) => { JC.push(new THREE.Vector3(...c)); JA.push(new THREE.Vector3(...vnorm(a))); JN.push(new THREE.Vector3(...vnorm(n))); JP.push(new THREE.Vector4(...prm)); };
  for (const S of SIDES) addJ(J('farm' + S), AX('uarm' + S, 1), vmul(AX('uarm' + S, 2), -1), [0.095, 0.09, 0.024, 0.0052]);
  for (const S of SIDES) addJ(J('shin' + S), AX('thigh' + S, 1), AX('thigh' + S, 2), [0.11, 0.12, 0.028, 0.006]);
  for (const S of SIDES) addJ(J('thigh' + S), AX('thigh' + S, 1), vmul(AX('thigh' + S, 2), -1), [0.1, 0.15, 0.032, 0.005]);
  for (const S of SIDES) addJ(J('foot' + S), AX('shin' + S, 1), vmul(AX('shin' + S, 2), -1), [0.05, 0.075, 0.018, 0.0026]);
  addJ([0, 0.1, -0.06], [0, 1, 0], [0, 0, -1], [0.1, 0.24, 0.032, 0.003]);
  addJ([0, 0.12, 0.09], [0, 1, 0], [0, 0, 1], [0.1, 0.24, 0.03, 0.0026]);
  const PA = [], PW = [], PB = [], PO = [];
  const addP = (a, w, b, o) => {
    w = vnorm(w);
    PA.push(new THREE.Vector3(...a)); PW.push(new THREE.Vector3(...w)); PB.push(new THREE.Vector3(...vnorm(vmad(b, w, -vdot(b, w))))); PO.push(new THREE.Vector3(...o));
  };
  addP([0, 0, 0.01], [0, 1, 0], [1, 0, 0], [0.131, 0.307, 0]);
  for (const S of SIDES) addP(J('thigh' + S), vsub(J('foot' + S), J('thigh' + S)), [S === 'R' ? 1 : -1, 0, 0], [S === 'R' ? 0.217 : 0.389, S === 'R' ? 0.061 : 0.443, 0.078]);
  for (const S of SIDES) addP(J('uarm' + S), vsub(J('hand' + S), J('uarm' + S)), [0, 1, 0], [S === 'R' ? 0.173 : 0.029, S === 'R' ? 0.281 : 0.137, 0.02]);
  const pv = (k, V) => [V[k].x, V[k].y, V[k].z];
  const angOf = (k, dir) => { const w = pv(k, PW), b = pv(k, PB), o = vnorm(vmad(dir, w, -vdot(dir, w))); return Math.atan2(vdot(o, vcross(w, b)), vdot(o, b)); };
  const Kn = SIDES.map((S, i) => new THREE.Vector4(vdot(vsub(J('shin' + S), J('thigh' + S)), pv(1 + i, PW)) - 0.01 - 0.012 * i, angOf(1 + i, [i ? -0.08 : 0.08, 0, -1]), i ? 0.122 : 0.13, i ? 0.067 : 0.072));
  const El = SIDES.map((S, i) => new THREE.Vector4(vdot(vsub(J('farm' + S), J('uarm' + S)), pv(3 + i, PW)) + 0.012 * i, 0.55 * angOf(3 + i, AX('uarm' + S, 2)), i ? 0.076 : 0.08, i ? 0.052 : 0.055));
  const CF = sp.filter((p) => p.tag === 'sleeve');
  const LC = SIDES.map((S, i) => {
    const a = J('thigh' + S), uOf = (y) => (y - a[1]) / PW[1 + i].y;
    const [[t1, b1], [t2, b2]] = lacePanels(S);
    return new THREE.Vector4(uOf(t1), uOf(b1), uOf(t2), uOf(b2));
  });
  const GN = low ? 512 : 1024, GR = { data: new Uint8Array(GN * GN * 4).fill(128), N: GN, gmax: 0 };
  const grain = new THREE.DataTexture(GR.data, GR.N, GR.N, THREE.RGBAFormat, THREE.UnsignedByteType);
  grain.wrapS = grain.wrapT = THREE.RepeatWrapping;
  grain.magFilter = THREE.LinearFilter;
  grain.minFilter = THREE.LinearMipmapLinearFilter;
  grain.generateMipmaps = true;
  grain.anisotropy = 8;
  grain.needsUpdate = true;
  const U = {
    uDvFade: { value: 1 }, uDvUnder: { value: 0 }, uDvFrame: { value: 0 }, uDvWet: { value: 1 }, uDvWetY: { value: -3 }, uDvSalt: { value: 0 },
    uDvFaceAmb: { value: 0.3 }, uDvFaceOpen: { value: 0 }, uDvWinV: { value: [new THREE.Vector3(0, 0, 1), new THREE.Vector3(1, 0, 0), new THREE.Vector3(-1, 0, 0)] },
    uDvSeed: { value: 3.7 }, uDvTWet: { value: 0 }, uDvSquish: { value: 0 }, uDvBalloon: { value: 0 }, uDvBreath: { value: 0 }, uDvFill: { value: 0 }, uDvBagC: { value: new THREE.Vector3(...KIT.bagMouth) }, uDvBagBone: { value: BI.bag }, uDvBagDent: { value: [0, 1, 2, 3, 4, 5, 6, 7].map(() => new THREE.Vector4()) }, uDvCorsBone: { value: BI.cors }, uDvFindK: { value: 0 }, uDvFindC: { value: new THREE.Vector3() }, uDvFindM: { value: new THREE.Matrix3() }, uDvFindY: { value: new THREE.Vector2() }, uDvFog: { value: 0.2 }, uDvUpR: { value: new THREE.Vector3(0, 1, 0) }, uDvPuff: { value: 0 }, uDvTFade: { value: 1 }, uDvTFocus: { value: 0 }, uDvSunE: { value: new THREE.Vector3(1, 1, 1) }, uDvBounce: { value: 1.0 }, uDvWaterY: { value: 0 }, uDvFloorY: { value: -20 },
    uDvJC: { value: JC }, uDvJA: { value: JA }, uDvJN: { value: JN }, uDvJP: { value: JP }, uDvJB: { value: new Float32Array(10) },
    uDvPA: { value: PA }, uDvPW: { value: PW }, uDvPB: { value: PB }, uDvPO: { value: PO }, uDvKn: { value: Kn }, uDvEl: { value: El }, uDvLace: { value: LC },
    uDvGrain: { value: grain }, uDvGrainK: { value: GR.gmax }, uDvLod: { value: 0.577 },
    uDvCuffA: { value: CF.map((p) => new THREE.Vector3(...p.frame.A)) }, uDvCuffW: { value: CF.map((p) => new THREE.Vector3(...p.frame.W)) }, uDvCuffL: { value: CF.map((p) => p.frame.L * 0.76) },
  };
  {
    const steps = suitGrainSteps(GN), ch = new MessageChannel();
    ch.port1.onmessage = () => {
      const t0 = performance.now();
      for (;;) {
        const r = steps.next();
        if (r.done) { grain.image.data = r.value.data; U.uDvGrainK.value = r.value.gmax; grain.needsUpdate = true; ch.port1.close(); return; }
        if (performance.now() - t0 > 12) break;
      }
      ch.port2.postMessage(0);
    };
    ch.port2.postMessage(0);
  }
  const uber = new THREE.MeshPhysicalMaterial({
    vertexColors: true, roughness: 1, metalness: 1, clearcoat: 1, clearcoatRoughness: 0.3,
    sheen: 1, sheenColor: new THREE.Color(0.2, 0.2, 0.2), sheenRoughness: 0.6,
  });
  uber.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, U);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\n' + DV_VERT_DECL + DV_VERT_CORS_DECL)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n' + DV_VERT)
      .replace('#include <skinning_vertex>', '#include <skinning_vertex>\n' + DV_VERT_CORS);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uDvWetY;\n' + DV_FRAG_DECL)
      .replace('#include <color_fragment>', '#include <color_fragment>\n' + DV_FRAG_COLOR)
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\n' + DV_FRAG_ROUGH)
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n' + DV_FRAG_NORMAL)
      .replace('#include <lights_physical_fragment>', '#include <lights_physical_fragment>\n' + DV_FRAG_PHYS)
      .replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\n' + DV_FRAG_LIGHTS);
  };
  uber.customProgramCacheKey = () => 'diver1901-uber-1';
  uber.dvGrain = grain;
  patch(uber);
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0.01, 0.014, 0.013), roughness: 0.03, metalness: 0, transparent: true, depthWrite: false,
    blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
  });
  glassMat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, { uDvFade: U.uDvFade, uDvFog: U.uDvFog, uDvSalt: U.uDvSalt, uDvUnder: U.uDvUnder, uDvFrame: U.uDvFrame });
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vDvGUv;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvDvGUv = uv;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n' + DV_GLASS_DECL)
      .replace('#include <color_fragment>', '#include <color_fragment>\n' + DV_GLASS_FRAG)
      .replace('#include <opaque_fragment>', '#include <opaque_fragment>\n' + DV_GLASS_OUT);
  };
  glassMat.customProgramCacheKey = () => 'diver1901-glass-1';
  patch(glassMat);
  const TT = makeTethers(seg);
  const TW = {
    uTwAbs: { value: new THREE.Vector3(0.40, 0.105, 0.085) }, uTwKd: { value: new THREE.Vector3(0.07, 0.042, 0.026) },
    uTwDeep: { value: new THREE.Vector3(0.003, 0.034, 0.068) }, uTwMid: { value: new THREE.Vector3(0.004, 0.074, 0.128) },
    uTwUp: { value: new THREE.Vector3(0.030, 0.270, 0.380) }, uTwSun: { value: new THREE.Vector3(0.050, 0.250, 0.190) },
    uTwLightK: { value: 1 },
  };
  let twSrc = null;
  const twPull = () => {
    if (!twSrc) return;
    const S = twSrc;
    if (S.uAbs) TW.uTwAbs.value.copy(S.uAbs.value);
    if (S.uKd) TW.uTwKd.value.copy(S.uKd.value);
    if (S.uWaterDeep) TW.uTwDeep.value.copy(S.uWaterDeep.value);
    if (S.uWaterMid) TW.uTwMid.value.copy(S.uWaterMid.value);
    if (S.uWaterUp) TW.uTwUp.value.copy(S.uWaterUp.value);
    if (S.uWaterSun) TW.uTwSun.value.copy(S.uWaterSun.value);
    if (S.uLightK) TW.uTwLightK.value = S.uLightK.value;
  };
  const tetherPass = (blend) => {
    const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, metalness: 0 });
    if (blend) { m.transparent = true; m.depthWrite = false; m.defines = { DV_TBLEND: 1 }; }
    m.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, { uDvFade: U.uDvFade, uDvFrame: U.uDvFrame, uDvWet: U.uDvTWet, uDvTFade: U.uDvTFade, uDvTFocus: U.uDvTFocus }, TW);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\n' + DV_TETHER_VERT)
        .replace('#include <begin_vertex>', '#include <begin_vertex>\n' + DV_TETHER_VSET);
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\n' + DV_TETHER_DECL)
        .replace('#include <color_fragment>', '#include <color_fragment>\n' + DV_TETHER_COLOR)
        .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\n' + DV_TETHER_ROUGH)
        .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n' + DV_TETHER_NORMAL)
        .replace('#include <opaque_fragment>', '#include <opaque_fragment>\n' + DV_TETHER_OUT);
    };
    m.customProgramCacheKey = () => (blend ? 'diver1901-tether-7b' : 'diver1901-tether-7');
    patch(m);
    return m;
  };
  const tetherMat = tetherPass(false), tetherMatT = tetherPass(true);

  const rig = makeRig({ handSpeed: 1.25 });
  const { bones, Qf, Pf, Mm, TB, EB, RT, F, RCH } = rig;
  const mesh = new THREE.SkinnedMesh(geo, uber);
  mesh.name = 'diver-body';
  mesh.add(bones[0]);
  mesh.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(bones);
  mesh.bind(skeleton);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 2.2);
  const glass = new THREE.SkinnedMesh(glassGeo, glassMat);
  glass.name = 'diver-glass';
  glass.bind(skeleton, mesh.bindMatrix);
  glass.renderOrder = 2;
  glass.frustumCulled = false;
  const tether = new THREE.Mesh(TT.geo, tetherMat);
  tether.name = 'diver-tethers';
  tether.frustumCulled = false;
  tether.castShadow = true;
  tether.visible = false;
  const tetherT = new THREE.Mesh(TT.geo, tetherMatT);
  tetherT.name = 'diver-tethers-fade';
  tetherT.frustumCulled = false;
  tetherT.visible = false;
  const envFor = (mat, scene, boost, cap) => {
    const env = (scene && scene.environment) || envMap || null;
    if (mat.envMap !== env) { mat.envMap = env; mat.needsUpdate = true; }
    mat.envMapIntensity = Math.min(cap, (scene && scene.environment ? scene.environmentIntensity : 1) * boost);
  };
  const _wv = new THREE.Vector3(), _wq = new THREE.Quaternion();
  let SUN = null, sunLook = 0;
  const _sd = new THREE.Vector3();
  mesh.onBeforeRender = (r, scene, camera) => {
    envFor(uber, scene, 1.0, 0.9);
    if (camera.isPerspectiveCamera) U.uDvLod.value = 1 / camera.projectionMatrix.elements[5];
    if ((!SUN || !SUN.parent) && sunLook-- <= 0) { SUN = null; sunLook = 120; scene.traverse((o) => { if (!SUN && o.isDirectionalLight) SUN = o; }); }
    if (SUN) {
      _sd.setFromMatrixPosition(SUN.matrixWorld).sub(_wv.setFromMatrixPosition(SUN.target.matrixWorld)).normalize();
      const k = SUN.intensity * Math.max(0.3, _sd.y);
      U.uDvSunE.value.set(SUN.color.r * k, SUN.color.g * k, SUN.color.b * k);
    }
    _wq.setFromRotationMatrix(_m1.extractRotation(bones[BI.cors].matrixWorld));
    const cq = camera.matrixWorldInverse;
    for (let i = 0; i < 3; i++) {
      const L = LIGHTS[i];
      _wv.set(L.dir[0], L.dir[1], L.dir[2]);
      if (i === 0) _wv.applyAxisAngle(_Y, -1.9 * st.plateK);
      _wv.applyQuaternion(_wq).transformDirection(cq);
      U.uDvWinV.value[i].copy(_wv);
    }
  };
  glass.onBeforeRender = (r, scene) => envFor(glassMat, scene, 6, 3);
  tether.onBeforeRender = (r, scene) => { envFor(tetherMat, scene, 1.2, 1); twPull(); };
  tetherT.onBeforeRender = (r, scene) => { envFor(tetherMatT, scene, 1.2, 1); twPull(); };

  const group = new THREE.Group();
  group.name = 'diver';
  group.add(mesh, glass, tether, tetherT);
  const anchors = {};
  const addAnchor = (name, bone, p, q) => {
    const o = new THREE.Object3D();
    o.name = 'dv_' + name;
    const inv = BINDM.inv[bone];
    const v = new THREE.Vector3(p[0], p[1], p[2]).applyMatrix4(inv);
    o.position.copy(v);
    bones[bone].add(o);
    anchors[name] = o;
    return o;
  };
  addAnchor('exhaust', BI.cors, HELM.exhaust);
  anchors.mouth = anchors.exhaust;
  addAnchor('helmet', BI.cors, [0, 0.69, HZ]);
  anchors.torch = anchors.helmet;
  addAnchor('head', BI.head, [0, 0.668, -0.06]);
  addAnchor('inlet', BI.cors, HELM.inlet);
  addAnchor('lifeline', BI.cors, HELM.lifeline);
  addAnchor('spitcock', BI.cors, HELM.spitcock);
  addAnchor('chest', BI.cors, [0, 0.45, -0.17]);
  addAnchor('bag', BI.bag, KIT.bagBottom);
  addAnchor('bagMouth', BI.bag, KIT.bagMouth);
  addAnchor('rightFoot', BI.footR, BOOT.soleR);
  addAnchor('leftFoot', BI.footL, BOOT.soleL);
  addAnchor('wFbottom', BI.wF, [0, 0.12, -0.2]);
  addAnchor('wBbottom', BI.wB, [0, 0.13, 0.21]);
  addAnchor('cuffR', BI.handR, toBind('handR', [0, 0.02, 0]));
  addAnchor('cuffL', BI.handL, toBind('handL', [0, 0.02, 0]));
  addAnchor('rimF', BI.cors, corsAt(0, 1));
  addAnchor('rimB', BI.cors, corsAt(Math.PI, 1));
  const gripQ = (x, z) => new THREE.Quaternion().setFromRotationMatrix(basis([0, 0, 0], x, [0, -1, 0], z));
  {
    const hr = new THREE.Object3D(); hr.name = 'dv_rightHand'; hr.position.copy(ANCH[0]); hr.quaternion.copy(gripQ([0, 0, -1], [-1, 0, 0])); bones[BI.handR].add(hr); anchors.rightHand = hr;
    const hl = new THREE.Object3D(); hl.name = 'dv_leftHand'; hl.position.copy(ANCH[1]); hl.quaternion.copy(gripQ([0, 0, 1], [1, 0, 0])); bones[BI.handL].add(hl); anchors.leftHand = hl;
  }

  const V3 = THREE.Vector3;
  const _Y = new V3(0, 1, 0);
  const _m1 = new THREE.Matrix4(), _m3 = new THREE.Matrix4();
  const _v1 = new V3(), _v2 = new V3(), _v3 = new V3(), _v4 = new V3(), _v5 = new V3(), _v6 = new V3(), _v7 = new V3();
  const _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion(); new THREE.Quaternion();
  const _e1 = new THREE.Euler();
  const LASTP = new V3();
  const EMPTY = {};
  const num = (v, d) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
  const NP = POSE_NAMES.length;
  const w = new Float32Array(NP), we = new Float32Array(NP);
  w[PI_.deck] = 1;
  const st = {
    t: 0, dt: 0, first: true, snapReq: false, target: PI_.deck, rate: 1.6, forced: -1, forcedRate: 0,
    under: 0, line: -3, wetY: -3, wet: 1, wasWet: 0, salt: 0, forceWet: -1,
    grounded: true, gap: 0, gapS: 0, floorC: 0, hasFloor: false, plantW: 1,
    speed: 0, speedK: 0, vy: 0, walkW: 0, phase: 0, phaseErr: 0, stride: 1.2, duty: 0.6, lift: 0.1, cad: 1.5,
    lt: 9, air: 0, airT: 0, wasAir: false,
    dvU: -1, stepT: 0,
    brPh: 0.1, brLen: 5, lung: 0, evIn: false, evEx: false, brSeed: 777,
    pumpT: 0, dump: 0, suitAir: 0,
    effort: 0, fog: 0.2, fogClear: 0,
    plateK: 0, plateT: 0,
    fill: 0, fillT: 0, bagHold: 0, bagBack: 0, bagKick: 0, bagLoad: 0, bagIn: 0,
    tugN: 0, tugNx: 0, tugT: 0, tugPull: 0, tugG: 0, tugS: 0.6, tugUp: false, tgK: -1, tgOk: false, tgP: new V3(), tgD: 1, tgR: new V3(), tgE: false, tgJ: new V3(), tgJt: 9, tgQ: new V3(), tgL: false, tgH: new V3(),
    gKind: 0, gT: 0, gDur: 1, gNext: 7, still: 0,
    glY: 0, glP: 0, glNext: 3, glEnd: 0, lookUp: 0,
    wside: 1, wsideT: 1, wsideV: 0,
    upQ: new THREE.Quaternion(), clunkCD: 0, dripT: 0, rs: 12345,
    tetherOn: 0, lastPose: '',
    deep: 0, deepQ: false, sighQ: false, nodT: -1, nodV: false, nodNext: 20, stumbleT: -1, stumble: 0, shiftNext: 4, crankHold: 0, noticeT: 0, notice: new THREE.Vector3(),
    plantWS: 1, plantWV: 0, entryT: -1, solesUnder: false, entrySink: false, landK: 0.6, vyMin: 0, intent: 0, dvSet: false, forcedName: '',
    kneelPrep: 0, kneelWas: 0, kneelGo: false, kneelCalm: 0, kneeToeOn: false, kneeToe: new V3(), kneeGn: new V3(0, 1, 0), kneeYaw: 0, kneeX: 0, kneeX0: 0, kneeXg: 0, fatigue: 0, sighNext: 120, bal: 0, balV: 0, drain: 0, lineP: -3, ventAcc: 0, pumpNext: 1.1,
    dlF: 0, dlFv: 0, dlS: 0, dlSv: 0, lookUpT: 0, lastHoseT: 0, recoverT: 0, recoverNext: 0, ckT: new THREE.Vector3(),
    holdK: [0, 0], holdNow: [0, 0], holdT: [0, 0], holdDur: [4, 6], holdSw: -9,
    upR: new THREE.Vector3(0, 1, 0), curV: new THREE.Vector3(), JBS: new Float32Array(10), valve: -1, blowup: 0,
    dive: false, divePerch: false, brHold: false, seepAcc: 0, shK: 0, lk: 0, lkV: 0, entK: 1, lpHand: -1, lpS: 0.4, underP: 0, gBurst: false, gBurstN: 12, landDipM: 0, check: 0, checkV: 0,
    hipY: 0, hipYV: 0, hipT: 0, hipC: 0, hipInit: false, stepN: 9, lag: 0, hdg: NaN, hdgRate: 0, hsP: 0.2, pTO: 0.9, hoff: 0.3, leanZ: 0,
    hh: 0, hhV: 0, hhOn: false, hhT: 0, hhNext: 25, hhWas: 0, stepDn: false, dec: 0, clamber: false, turnStep: false,
    standT: 0, walkP: 0, goT: 0, go0: false, goP: false, goPT: 0, goF: false, goH: -1, stopM: 0, noGoT: 0, wantW: false, tsT: 1, imp: 0, impV: 0, impS: 1, jS: new Float32Array(6), hLag: 0, hLagT: 0, bowCap: 40,
    armCap: 0, armLimW: 0, armLim: new Float64Array(6),
  };
  const rand = () => { st.rs = (st.rs * 16807) % 2147483647; return st.rs / 2147483647; };
  const CTX = { hop: 0, jS: new Float32Array(6), t: 0, v: 0, phase: 0, walkAmp: 0, speedK: 0, vy: 0, lt: 0, u: 0, wside: 1, sroll: 0, lung: 0, slopeDeg: 0, lookUp: 0, under: 0, deep: 0, stumble: 0, landK: 0.6, intent: 0, wS: 5, step: 0.4, dive: 0, proll: 0, ldK: -1, bow: 0, hose: 0, tug: 0 };
  const cbs = { exhale: [], inhale: [], vent: [], step: [], clunk: [], drip: [] };
  const addCb = (list, cb) => {
    if (typeof cb !== 'function') return () => {};
    list.push(cb);
    return () => { const i = list.indexOf(cb); if (i >= 0) list.splice(i, 1); };
  };
  const fire = (list, a, b, c) => { for (let i = 0; i < list.length; i++) { try { list[i](a, b, c); } catch (e) { console.warn('[diver] callback failed:', e); } } };
  const breathInfo = { duration: 0 };
  const EV = { step: [0, 0], stepP: [new V3(), new V3()], stepK: [0, 0], clunk: 0, dripP: new V3(), burst: 0, knee: 0, kneeP: new V3() };

  const S3 = (E, name, x, y, z) => { const o = J3[name]; E[o] = x * DEG; E[o + 1] = y * DEG; E[o + 2] = z * DEG; };
  const LR = (E, base, x, y, z) => { S3(E, base + 'R', x, y, z); S3(E, base + 'L', x, -y, -z); };
  const CUR1 = [0.5, 0.73, 1.0, 1.27], CUR2 = [0.6, 0.83, 1.0, 1.19];
  const curl = (E, a, b) => {
    for (let s = 0; s < 2; s++) {
      const S = SIDES[s], sg = s ? 1 : -1;
      for (let fi = 0; fi < 4; fi++) {
        const f = FINGERS[fi];
        E[J3['f' + f.n + '1' + S] + 2] = sg * a * CUR1[fi] * DEG;
        E[J3['f' + f.n + '2' + S] + 2] = sg * b * CUR2[fi] * DEG;
      }
    }
  };
  const thumbs = (E, x, y, z) => { S3(E, 'thumb1R', x, y, z); S3(E, 'thumb1L', x, -y, -z); S3(E, 'thumb2R', 4, 0, -10); S3(E, 'thumb2L', 4, 0, 10); };
  const hoseGrip = (E, hk) => {
    if (hk < 1e-3) return;
    const g = sstep(0.55, 0.95, hk);
    for (let fi = 0; fi < 4; fi++) {
      const o1 = J3['f' + FINGERS[fi].n + '1L'] + 2, o2 = J3['f' + FINGERS[fi].n + '2L'] + 2;
      E[o1] = lerp(E[o1], 62 * CUR1[fi] * DEG, g); E[o2] = lerp(E[o2], 80 * CUR2[fi] * DEG, g);
    }
    S3(E, 'thumb1L', lerp(12, 16, g), lerp(-14, -50, g), lerp(0, -8, g));
    S3(E, 'thumb2L', lerp(4, 10, g), 0, lerp(10, -30, g));
  };
  const breathe = (E, k) => {
    const b = (2 * CTX.lung - 1) * k * DEG;
    E[J3.spine2] -= 0.2 * b; E[J3.chest] -= 0.4 * b; E[J3.neck] += 0.3 * b;
    E[J3.clavR + 2] += 2.5 * b; E[J3.clavL + 2] -= 2.5 * b;
  };
  const LEAD = { p: 0, g: 1 };
  function leadAt(k, z, w) {
    const a = k * k - w * w, b = 2 * z * k * w;
    LEAD.p = Math.atan2(b, a); LEAD.g = Math.min(3, Math.hypot(a, b) / Math.max(1e-6, k * k));
    return LEAD;
  }
  const lead = (b, w) => leadAt(rig.SPW[b] * F.stiff, rig.SPZ[b] + (1 - rig.SPZ[b]) * F.under, w);
  const leadT = (w) => leadAt(9 * F.stiff, 0.9, w);
  function evalPose(p, E, rp) {
    E.fill(0); rp[0] = rp[1] = rp[2] = 0;
    const c = CTX, t = c.t;
    LR(E, 'uarm', 8, 0, 17); LR(E, 'farm', 26, 0, 0); LR(E, 'hand', 0, 12, -4);
    curl(E, 30, 42); thumbs(E, 12, 14, 0);
    switch (p) {
      case PI_.stand: case PI_.deck: case PI_.crank: case PI_.present: {
        const dry = p === PI_.deck, ck = p === PI_.crank;
        S3(E, 'root', dry ? -3 : ck ? -6 : -2, 0, 0);
        S3(E, 'spine1', dry ? 3 : 1.5, 0, 0); S3(E, 'chest', dry ? 1 : 0.5, 0, 0); S3(E, 'neck', -2, 0, 0);
        if (dry) LR(E, 'clav', 0, 0, -5);
        const ws = c.wside, sr = c.sroll;
        S3(E, 'pelvis', 0, 0, 1.6 * ws + sr);
        E[J3.spine1 + 2] -= (0.8 * ws + 0.45 * sr) * DEG; E[J3.chest + 2] -= (1 * ws + 0.55 * sr) * DEG;
        rp[0] = (dry ? 0.045 : 0.026) * ws;
        rp[1] = ck ? -0.036 : dry ? -0.023 : -0.026;
        if (p === PI_.present) {
          S3(E, 'root', -6, 0, 0); S3(E, 'spine1', -2, 0, 0); S3(E, 'chest', -5, 0, 0); S3(E, 'neck', -14, 0, 0);
          LR(E, 'uarm', 32, 8, 12); LR(E, 'farm', 88, 0, 0); LR(E, 'hand', 0, 45, 0);
          curl(E, 30, 40);
        }
        breathe(E, (dry ? 1.5 : 1) * (1 + 1.8 * c.deep));
        break;
      }
      case PI_.walk: {
        const ph = c.phase * TAU, A = c.walkAmp, sk = c.speedK, w = c.wS;
        S3(E, 'root', -(4 - 2 * c.under + 12 * sk * (1 - c.under)) - (c.slopeDeg > 0 ? 0.3 * Math.min(c.slopeDeg, 30) : -0.05 * Math.min(-c.slopeDeg, 40)) - 6 * c.stumble - A * (0.6 * Math.sin(t * 0.37 + 0.9) + 0.4 * Math.sin(t * 0.83 + 2.4)), 0, 0);
        const v = c.v, dr = (a, b) => 0.6 * Math.sin(t * a + b) + 0.4 * Math.sin(t * 2.3 * a + 1.7 * b);
        const J = c.jS, pR = 1 + 0.05 * dr(0.47, 0.8) + J[0], pO = 1 + 0.05 * dr(0.59, 2.2) + J[1], pS = 1 + 0.05 * dr(0.41, 1.1) + J[2], cR = 1 + 0.05 * dr(0.53, 4.0) + J[3];
        const pp = ph + TAU * (0.015 * dr(0.37, 3.3) + J[4]), cp = ph + TAU * (0.015 * dr(0.43, 5.1) + J[5]);
        let L = lead(BI.pelvis, w);
        S3(E, 'pelvis', 0, 4 * A * pR * L.g * Math.cos(pp + L.p), A * pO * L.g * (2.9 * Math.sin(pp + L.p) + 0.7 * Math.sin(2 * pp + L.p)));
        L = lead(BI.spine1, w);
        S3(E, 'spine1', 1.5, 2.5 * A * cR * L.g * Math.cos(cp - 2.744 + L.p), -A * pO * L.g * (1.5 * Math.sin(pp + L.p) + 0.35 * Math.sin(pp - 0.31 + L.p)));
        L = lead(BI.chest, w);
        S3(E, 'chest', 0.5 - A * Math.cos(2 * ph - 0.88), 3.76 * A * cR * L.g * Math.cos(cp - 2.744 + L.p), -A * pO * L.g * (1.4 * Math.sin(pp + L.p) + 0.45 * Math.sin(pp - 0.31 + L.p)));
        S3(E, 'neck', -2, 0, 0);
        const dA = 1 + 0.05 * (0.6 * Math.sin(t * 0.61 + 0.4) + 0.4 * Math.sin(t * 1.37 + 2.1)), dO = 2 * (0.6 * Math.sin(t * 0.43 + 1.2) + 0.4 * Math.sin(t * 0.97 + 0.3));
        const dE = 3 * (0.6 * Math.sin(t * 0.53 + 2.6) + 0.4 * Math.sin(t * 1.19 + 1.4));
        const aS = A * (5.3 + 8.4 * v) * dA, pf = TAU * (0.46 + 0.075 * v), e0 = 18 + 10 * v + A * dE, eS = A * (3.5 + 5 * v);
        L = lead(BI.uarmR, w);
        const ca = L.g * Math.cos(ph - pf + L.p), cb = Math.cos(ph - pf);
        S3(E, 'uarmR', 3 + A * dO + aS * ca, 3, 12 + 1.5 * A * (1 - cb));
        L = lead(BI.farmR, w);
        const cf = L.g * Math.cos(ph - pf - 0.41 + L.p);
        S3(E, 'farmR', e0 + eS * cf, 0, 0);
        curl(E, 18, 26);
        const hk = c.hose, hU = sstep(0, 0.7, hk), hF = sstep(0.15, 1, hk), sL = 1 - 0.92 * sstep(0, 0.5, hk);
        S3(E, 'uarmL', lerp(3 + A * dO, 15 - 30 * c.tug, hU) - 1.07 * aS * ca * sL, lerp(-3, -12, hU), -lerp(12 + 1.5 * A * (1 + cb), 14, hU));
        S3(E, 'farmL', lerp(e0, 119 - 14 * c.tug, hF) - 1.07 * eS * cf * sL, 0, 0);
        hoseGrip(E, hk);
        rp[1] = -0.012 * A;
        L = leadT(w);
        rp[0] = 0.021 * A * pS * L.g * Math.sin(pp - 0.31 + L.p);
        breathe(E, 0.8);
        break;
      }
      case PI_.bound: {
        const tk = sstep(0.14, 0.42, c.gap), dn = 1 - sstep(-0.3, 0.3, c.vy), rch = dn * (1 - tk);
        S3(E, 'root', -13 + 3 * dn, 0, 0);
        S3(E, 'spine1', -4, 0, 0); S3(E, 'chest', -4, 0, 0); S3(E, 'neck', -6 - 8 * dn, 0, 0);
        S3(E, 'thighR', lerp(8 + 22 * dn, 44, tk), 0, 4); S3(E, 'thighL', lerp(4 + 22 * dn, 36, tk), 0, -5);
        S3(E, 'shinR', -lerp(8, 48, tk), 0, 0); S3(E, 'shinL', -lerp(10, 42, tk), 0, 0);
        S3(E, 'footR', -10 * (1 - dn) * (1 - tk) + 8 * rch, 0, 0); S3(E, 'footL', -12 * (1 - dn) * (1 - tk) + 6 * rch, 0, 0);
        LR(E, 'uarm', lerp(26, 17, dn), 6, lerp(31, 25, dn)); LR(E, 'farm', lerp(38, 46, dn), 0, 0);
        curl(E, 12, 18);
        break;
      }
      case PI_.sink: {
        S3(E, 'thighR', 3, 0, 2); S3(E, 'thighL', 2, 0, -2);
        S3(E, 'shinR', -13, 0, 0); S3(E, 'shinL', -12, 0, 0);
        S3(E, 'footR', -24, 0, 0); S3(E, 'footL', -26, 0, 0);
        if (c.dive) { S3(E, 'uarmR', 25, 5, 25); S3(E, 'farmR', 35, 0, 0); S3(E, 'uarmL', 25, -5, -25); S3(E, 'farmL', 35, 0, 0); }
        else {
          const hp = c.hop;
          S3(E, 'uarmR', lerp(150, 16, hp), lerp(10, 5, hp), lerp(16, 31, hp)); S3(E, 'farmR', lerp(26, 40, hp), 0, 0);
          S3(E, 'uarmL', lerp(18, 16, hp), lerp(-6, -5, hp), lerp(-40, -31, hp)); S3(E, 'farmL', lerp(34, 40, hp), 0, 0);
        }
        S3(E, 'neck', -10 + 16 * c.lookUp, 0, 0);
        curl(E, 30, 42);
        breathe(E, 1);
        break;
      }
      case PI_.land: {
        const u = clamp(c.lt / (0.5 + 0.6 * c.landK), 0, 1);
        const k = (Math.sin(Math.PI * Math.min(1, u * 1.3)) * (1 - 0.3 * u) + 0.2 * Math.sin(Math.PI * clamp((u - 0.68) / 0.32, 0, 1))) * (0.4 + 0.6 * c.landK);
        if (c.ldK >= 0) {
          const kd = c.ldK * (0.4 + 0.6 * c.landK);
          S3(E, 'root', -3 - 1.5 * kd, 0, 0);
          S3(E, 'neck', -4 * kd, 0, 0);
          LR(E, 'uarm', 20 + 20 * kd, 5, 22 + 16 * kd); LR(E, 'farm', 30 + 14 * kd, 0, 0);
          curl(E, 14, 20);
          break;
        }
        S3(E, 'root', -8 - 13 * k, 0, 0);
        S3(E, 'spine1', -4 * k, 0, 0); S3(E, 'chest', -5 * k, 0, 0); S3(E, 'neck', -10 * k, 0, 0);
        LR(E, 'uarm', 18 + 10 * k, 5, 22 + 14 * k); LR(E, 'farm', 30 + 16 * k, 0, 0);
        rp[1] = -0.21 * k;
        curl(E, 14, 20);
        break;
      }
      case PI_.kneel: {
        S3(E, 'root', -2, 0, 0);
        S3(E, 'pelvis', -4, 0, 0); S3(E, 'spine1', -6, 0, 0); S3(E, 'spine2', -5, 0, 0); S3(E, 'chest', -4, 0, 0); S3(E, 'neck', -16, 0, 0);
        S3(E, 'thighR', 6, 0, 4); S3(E, 'shinR', -96, 0, 0); S3(E, 'footR', 6, 0, 0);
        S3(E, 'thighL', 84, 0, -6); S3(E, 'shinL', -92, 0, 0); S3(E, 'footL', 8, 0, 0);
        LR(E, 'uarm', 36, 0, 14); LR(E, 'farm', 48, 0, 0);
        rp[1] = -0.5; rp[2] = 0.02;
        curl(E, 20, 30);
        breathe(E, 1);
        break;
      }
      case PI_.climb: {
        const ph = c.phase * TAU;
        S3(E, 'root', -8, 0, 0);
        LR(E, 'uarm', 105, 0, 20); LR(E, 'farm', 70, 0, 0);
        S3(E, 'thighR', 35 + 35 * Math.sin(ph), 0, 4); S3(E, 'shinR', -40 - 40 * Math.sin(ph), 0, 0);
        S3(E, 'thighL', 35 - 35 * Math.sin(ph), 0, -4); S3(E, 'shinL', -40 + 40 * Math.sin(ph), 0, 0);
        curl(E, 50, 62);
        break;
      }
      case PI_.step: {
        const u = c.u, air = sstep(0, 0.1, u), onRail = 1 - air;
        const pre = sstep(-0.6, -0.4, u), over = sstep(-0.35, -0.12, u), dip = sstep(-0.25, -0.1, u) * (1 - sstep(-0.06, 0, u));
        const dv = c.dive ? 1 : 0;
        const eo = (x) => { const m = 1 - clamp(x, 0, 1); return 1 - m * m * m; };
        const ex = c.ext >= 0 ? c.ext : eo((u - 0.18) / 0.12);
        const a1 = dv ? Math.min(1, 1.12 * ex) : sstep(0.18, 0.38, u), a2 = dv ? ex : sstep(0.22, 0.5, u), give = dv ? 0 : sstep(0.22, 0.34, u) * (1 - sstep(0.4, 0.75, u));
        rp[0] = -0.05 * pre * onRail;
        rp[1] = -0.06 * dip * onRail;
        S3(E, 'root', (2 * pre - 3 * dip) * onRail - air * (10 * (1 - a2) + 1), 0, 0);
        S3(E, 'pelvis', 0, 0, -4 * pre * onRail);
        const rl = over * onRail, down = sstep(-0.22, -0.1, u);
        S3(E, 'thighR', 55 * rl * (1 - 0.7 * down) + air * ((dv ? 65 : 50) * (1 - a1) + (dv ? 13 : 6) + 10 * give), 0, 5 * rl - 4 * dv * air);
        S3(E, 'shinR', -65 * rl * (1 - 0.75 * down) - air * ((dv ? 68 : 42) * (1 - a1) + (dv ? 22 : 10) + 16 * give), 0, 0);
        S3(E, 'footR', -8 * rl - air * ((dv ? 14 : 20) * (1 - a1) + 12), 0, 0);
        S3(E, 'thighL', air * ((dv ? 66 : 78) * (1 - a2) + (dv ? 10 : 7) + 8 * give), 0, dv ? -2 * (1 - air) + 5.5 * air : -2);
        S3(E, 'shinL', -air * ((dv ? 66 : 92) * (1 - a2) + (dv ? 18 : 13) + 14 * give), 0, 0);
        S3(E, 'footL', -20 * sstep(-0.06, 0.02, u) * onRail - air * (10 * (1 - a2) + 12), 0, 0);
        S3(E, 'neck', -18, 0, 0);
        const ab = dv ? 16 + 40 * air : 16 + (54 + 8 * Math.sin(t * 1.7)) * air;
        LR(E, 'uarm', 12 - 4 * air, 0, ab); LR(E, 'farm', dv ? 40 + 10 * air : 40 - 18 * air, 0, 0); LR(E, 'hand', 0, 0, -10 * air);
        curl(E, 30, 42);
        breathe(E, 1);
        break;
      }
      case PI_.brace: {
        S3(E, 'root', -7, 0, 0); S3(E, 'spine1', -4, 0, 0); S3(E, 'chest', -4, 0, 0); S3(E, 'neck', -9, 0, 0);
        LR(E, 'uarm', 24, 0, 18); LR(E, 'farm', 42, 0, 0);
        rp[1] = -0.11;
        if (c.intent > 0.5) { rp[1] = -0.17; LR(E, 'uarm', -20, 0, 22); S3(E, 'neck', -14, 0, 0); }
        curl(E, 30, 40);
        breathe(E, 1);
        break;
      }
      case PI_.perch: {
        const sw = Math.sin(t * 0.61), sw2 = Math.sin(t * 0.47 + 1.3), go = c.go || 0, dv = c.dive ? 1 : 0, ld = dv * (c.load || 0);
        rp[1] = 0.035 + 0.02 * go * (1 - dv); rp[2] = -0.02 - 0.06 * go * (1 - dv);
        rp[1] -= 0.03 * ld;
        S3(E, 'root', 3 + 1.5 * Math.sin(t * 0.23) - (dv ? 0.76 * c.bow : 13 * go), 0, dv * c.proll);
        S3(E, 'spine1', -3 - 0.12 * dv * c.bow, 0, 0); S3(E, 'spine2', -2 - 0.12 * dv * c.bow, 0, 0); S3(E, 'neck', -12 - 8 * go, 0, 0);
        S3(E, 'thighR', 84 - (dv ? 6 : 34) * go + 8 * ld, 0, 7 - 6 * dv * go); S3(E, 'thighL', 82 - 6 * dv * go + 8 * ld, 0, -7 + 3 * dv * go);
        S3(E, 'shinR', -100 + 5 * sw * (1 - go) + (dv ? 10 : 58) * go - 12 * ld, 0, 0); S3(E, 'shinL', -96 + 5 * sw2 * (1 - dv * go) + 12 * dv * go - 12 * ld, 0, 0);
        S3(E, 'footR', 14 - (dv ? 14 : 34) * go + 6 * ld, 0, 0); S3(E, 'footL', 12 - 12 * dv * go + 6 * ld, 0, 0);
        LR(E, 'uarm', 32, 0, 12); LR(E, 'farm', (dv ? 62 - 50 * sstep(0.3, 1, go) : 62) + 18 * ld, 0, 0); LR(E, 'hand', 0, 20, 0);
        curl(E, 30, 42);
        breathe(E, 1.2);
        break;
      }
    }
    if (c.under > 0.01 && p !== PI_.crank && p !== PI_.present && p !== PI_.climb && p !== PI_.kneel && p !== PI_.walk) {
      const fl = c.under;
      E[J3.uarmR + 2] += 7 * fl * DEG; E[J3.uarmL + 2] -= 7 * fl * DEG;
      E[J3.uarmR] += 5 * fl * DEG; E[J3.uarmL] += 5 * fl * DEG;
      E[J3.farmR] += 9 * fl * DEG; E[J3.farmL] += 9 * fl * DEG;
    }
    if (c.hose > 1e-3 && c.under > 0.5 && (p === PI_.stand || p === PI_.land)) {
      const hk = c.hose, hU = sstep(0, 0.7, hk), hF = sstep(0.15, 1, hk), o = J3.uarmL;
      E[o] = lerp(E[o], (15 - 30 * c.tug) * DEG, hU); E[o + 1] = lerp(E[o + 1], -12 * DEG, hU); E[o + 2] = lerp(E[o + 2], -14 * DEG, hU);
      E[J3.farmL] = lerp(E[J3.farmL], (119 - 14 * c.tug) * DEG, hF);
      hoseGrip(E, hk);
    }
    if (c.stumble > 0.01 && p === PI_.walk) {
      const k = c.stumble;
      E[J3.uarmR + 2] += 8 * k * DEG; E[J3.uarmL + 2] -= 8 * k * DEG;
      E[J3.uarmR] += 26 * k * DEG; E[J3.uarmL] += 20 * k * DEG;
      E[J3.spine1] -= 4 * k * DEG; E[J3.neck] -= 6 * k * DEG;
    }
  }

  const MOT = { init: false, p: new V3(), v: new V3(), a: new V3(), vS: new V3(), vyP: 0 };
  function trackMotion(s) {
    const dt = st.dt;
    _v1.setFromMatrixPosition(F.mG);
    if (!MOT.init || F.snap || dt < 1e-4) { MOT.p.copy(_v1); MOT.v.set(0, 0, 0); MOT.a.set(0, 0, 0); MOT.vS.set(0, 0, 0); MOT.vyP = 0; MOT.init = true; if (s.vel && Number.isFinite(s.vel.x)) { MOT.v.copy(s.vel); MOT.vS.copy(s.vel); } return; }
    MOT.vyP += ((_v1.y - MOT.p.y) / dt - MOT.vyP) * (1 - Math.exp(-dt / 0.1));
    if (s.vel && Number.isFinite(s.vel.x) && Number.isFinite(s.vel.y) && Number.isFinite(s.vel.z)) _v2.copy(s.vel);
    else _v2.subVectors(_v1, MOT.p).divideScalar(dt);
    _v3.subVectors(_v2, MOT.v).divideScalar(dt);
    _v3.clampLength(0, 30);
    MOT.a.lerp(_v3, 1 - Math.exp(-dt / 0.09));
    MOT.v.copy(_v2);
    MOT.vS.lerp(_v2, 1 - Math.exp(-dt / 0.12));
    MOT.p.copy(_v1);
  }
  const floorAt = (s, x, z, fb) => {
    const f = s.floor;
    if (typeof f === 'function') { const y = f(x, z); return Number.isFinite(y) ? y : fb; }
    if (typeof f === 'number' && Number.isFinite(f)) return f;
    return fb;
  };
  function entry(k = 1) {
    const EVv = rig.EV;
    st.entryT = 0; st.entrySink = false;
    EVv[J3.shinR] -= 2 * k; EVv[J3.shinL] -= 2 * k; EVv[J3.neck] -= 1.5 * k;
    rig.EYE.req = true;
    st.suitAir = Math.max(st.suitAir, 0.8);
    st.balV += 1.2 * k;
    if (st.dive) { EVv[J3.root] -= 1.0 * k; EV.burst += Math.round(10 * k); st.seepAcc = 0; st.entK = k; }
  }
  function stepWater(s) {
    const wy = num(s.waterY, 0), gy = MOT.p.y, dt = st.dt;
    st.line = wy - gy;
    const solesUnder = gy - 0.95 < wy;
    if (solesUnder && !st.solesUnder && MOT.vS.y < -1 && dt > 0 && !F.snap && !s.dive) entry();
    st.solesUnder = solesUnder;
    if (st.entryT >= 0) st.entryT = Math.min(60, st.entryT + dt);
    const shUnder = gy + 0.45 < wy;
    if (shUnder && !st.shUnder && MOT.vS.y < -0.5 && dt > 0 && !F.snap) {
      const EVv = rig.EV;
      EVv[J3.uarmR + 2] += 3.2; EVv[J3.uarmL + 2] -= 3.2; EVv[J3.uarmR] += 2.2; EVv[J3.uarmL] += 2.2;
      st.liftT = 0;
    }
    st.shUnder = shUnder;
    const u = sstep(0.45, 0.95, st.line);
    st.under = F.snap ? u : st.under + (u - st.under) * (1 - Math.exp(-dt * 4));
    if (st.forceWet >= 0) {
      st.wet = st.forceWet; st.wetY = st.forceWet > 0 ? 3 : -3;
    } else if (st.dt > 0) {
      if (st.line > st.wetY) { st.wetY = st.line; st.wet = 1; }
      if (st.line > -1 && st.wetY < st.line + 0.1) st.wetY = Math.min(st.line + 0.1, st.wetY + dt * 0.03);
      if (st.line > 0.95) st.wetY = 3;
      if (st.line < -0.95 && st.wetY > -0.9) { st.wasWet = 1; st.wet = Math.max(0, st.wet - dt / 160); }
    }
    if (st.line < -0.95 && st.lineP >= -0.95 && st.wetY > -0.9) st.drain = 1;
    st.lineP = st.line;
    st.drain *= Math.exp(-dt / 20);
    st.salt = st.wasWet * (1 - st.wet);
    U.uDvWetY.value = st.wetY; U.uDvWet.value = st.wet; U.uDvSalt.value = st.salt * 0.8; U.uDvUnder.value = st.under;
    U.uDvTWet.value = st.under > 0.5 ? 1 : 0;
  }
  const ALIAS = { sit: 'perch', seat: 'perch', gunwale: 'perch', swim: 'walk', hover: 'stand', streamline: 'step', crouch: 'brace', reach: 'stand', idle: 'stand', lift: 'present', hold: 'present', turn: 'crank', ladder: 'climb', fall: 'sink', descend: 'sink', float: 'sink' };
  function stepInputs(s) {
    const dt = st.dt;
    st.dive = !!s.dive; st.divePerch = !!(s.dive && s.dive.perch);
    const hv = Math.hypot(MOT.vS.x, MOT.vS.z);
    st.speed += (hv - st.speed) * (F.snap ? 1 : 1 - Math.exp(-dt * 8));
    st.speedK = clamp(st.speed / 1.4, 0, 1);
    st.vy += (MOT.vS.y - st.vy) * (F.snap ? 1 : 1 - Math.exp(-dt * 5));
    const gx = MOT.p.x, gy = MOT.p.y, gz = MOT.p.z;
    st.hasFloor = typeof s.floor === 'function' || (typeof s.floor === 'number' && Number.isFinite(s.floor));
    st.floorP = st.hasFloor ? s : null;
    st.floorC = floorAt(s, gx, gz, gy - 0.95);
    st.gap = gy - 0.95 - st.floorC;
    st.gapS += (st.gap - st.gapS) * (F.snap ? 1 : 1 - Math.exp(-dt * 6));
    let name = typeof s.pose === 'string' ? s.pose : '';
    if (st.forced >= 0) name = st.forcedName || POSE_NAMES[st.forced];
    const airPose = name === 'sink' || name === 'bound' || name === 'step' || name === 'climb' || name === 'streamline';
    if (typeof s.grounded === 'boolean') st.grounded = s.grounded;
    else if (st.hasFloor) {
      if (st.grounded) st.grounded = name === 'kneel' || !(st.gap > 0.08 || st.vy > 0.3);
      else st.grounded = st.gapS < 0.05 && st.vy < 0.15;
      if (name === 'step' || name === 'streamline') st.grounded = false;
    } else if (st.line < -0.5) st.grounded = !airPose;
    else st.grounded = false;
    st.clamber = name === 'climb' && st.hasFloor && st.under > 0.5 && !st.dive;
    if (st.clamber) { st.grounded = true; name = 'walk'; }
    st.stepDn = !st.grounded && st.hasFloor && st.under > 0.5 && !st.dive && name !== 'bound' && MOT.vS.y < 0.2 && st.gap < 0.65 && (st.stepDn || st.walkW > 0.3);
    if (st.stepDn) { st.grounded = true; if (name === 'sink' || name === 'bound' || name === 'fall') name = 'walk'; }
    const hop = st.hasFloor && st.gapS < 1.2 && st.airT < 1.2;
    if (name === 'swim') name = st.grounded ? 'walk' : st.vy > 0.2 || hop ? 'bound' : 'sink';
    else if (name === 'hover') name = st.grounded ? 'stand' : hop ? 'bound' : 'sink';
    else if (ALIAS[name]) name = ALIAS[name];
    if (!(name in PI_)) name = st.under < 0.4 && st.line < -0.5 ? 'deck' : !st.grounded ? (st.vy > 0.2 || hop ? 'bound' : 'sink') : st.speed > 0.12 ? 'walk' : 'stand';
    if (name === 'stand' && st.line < -0.5 && st.under < 0.3) name = 'deck';
    if ((name === 'walk' || name === 'stand') && !st.grounded) name = st.vy > 0.2 || hop ? 'bound' : 'sink';
    st.wantW = name === 'walk' && st.grounded;
    if (name === 'walk' && st.speed < 0.06 && st.walkW < 0.05) name = 'stand';
    if (st.entryT >= 0.25 && st.entryT < 60 && st.under > 0.3 && (name === 'step' || name === 'brace')) { name = 'sink'; st.entrySink = true; }
    st.intent = s.intent === 'bound' ? 1 : 0;
    st.perchGo = clamp(num(s.perchGo, 0), 0, 1);
    if (st.intent && st.grounded) name = 'brace';
    const inAir = !st.grounded;
    if (inAir) st.airT += dt;
    if (st.under > 0.5 && st.underP <= 0.5) st.vyMin = 0;
    st.underP = st.under;
    if (inAir) st.vyMin = Math.min(st.vyMin, MOT.vS.y);
    if (st.wasAir && !inAir && st.airT > 0.5 && st.under > 0.5 && st.hasFloor && st.gap < 0.1) {
      st.lt = 0; st.dump = 1; st.nodT = 0; st.nodV = true;
      const lv = s.dive && Number.isFinite(s.dive.landV) && s.dive.landV ? s.dive.landV : st.vyMin;
      st.landK = clamp(Math.abs(lv) / 1.2, 0.2, 1); st.balV -= st.landK; rig.EYE.req = true;
    }
    if (!inAir) { st.airT = 0; st.vyMin = 0; }
    st.wasAir = inAir;
    st.lt += dt;
    if (st.lt < 0.5 + 0.6 * st.landK && st.grounded && name !== 'kneel' && name !== 'crank' && !(st.intent && name === 'brace')) name = 'land';
    let tgt = PI_[name];
    if (FP.active && (tgt === PI_.step || tgt === PI_.brace)) tgt = st.target;
    if (tgt !== st.target) {
      if (tgt === PI_.step) st.stepT = 0;
      let bl = st.forced >= 0 ? st.forcedRate : tgt === PI_.land ? (st.dive ? 0.04 : 0.12) : tgt === PI_.step ? (w[PI_.perch] > 0.4 ? (st.dive ? 0.12 : 0.1) : 0.25) : tgt === PI_.sink ? (st.entrySink ? 0.35 : 0.5) : tgt === PI_.kneel ? 0.85 : tgt === PI_.bound ? 0.3 : 0.55;
      const gather = tgt === PI_.brace && st.intent && st.under > 0.5 && !st.dive;
      if (gather) bl = 0.1;
      if (st.under > 0.5 && !(st.dive && tgt === PI_.land) && !gather) bl = Math.max(bl, 0.25);
      st.rate = 1 / Math.max(0.05, bl);
      st.target = tgt;
    }
    if (F.snap) { w.fill(0); w[st.target] = 1; }
    const tg = st.target;
    if (w[tg] < 1) {
      const f0 = FT[0], kc = !st.kneelGo ? 0 : f0.swing && !f0.wk ? 0.08 + 0.37 * sstep(0.25, 1, f0.swT / f0.swDur) : 0.08;
      const nt = Math.min(tg === PI_.kneel && !st.kneelPrep ? Math.max(w[tg], kc) : 1, w[tg] + dt * st.rate), others = 1 - w[tg], k = others > 1e-6 ? (1 - nt) / others : 0;
      for (let p = 0; p < NP; p++) if (p !== tg) w[p] *= k;
      w[tg] = nt;
    }
    const ez = sstep(0, 1, w[tg]), rest = w[tg] < 1 ? (1 - ez) / (1 - w[tg]) : 0;
    let plant = 0;
    for (let p = 0; p < NP; p++) { we[p] = p === tg ? ez : w[p] * rest; plant += we[p] * PLANT[p]; }
    st.plantW = st.grounded ? plant : 0;
    if (F.snap) { st.plantWS = st.plantW; st.plantWV = 0; }
    else if (dt > 0) {
      const n2 = Math.min(8, Math.ceil(dt * 240)), h2 = dt / n2;
      for (let i = 0; i < n2; i++) { st.plantWV += (169 * (st.plantW - st.plantWS) - 26 * st.plantWV) * h2; st.plantWS += st.plantWV * h2; }
      st.plantWS = clamp(st.plantWS, 0, 1);
    }
    const walking = st.grounded && (tg === PI_.walk || tg === PI_.land) ? sstep(0.05, 0.25, st.speed) : 0;
    st.walkW += (walking - st.walkW) * (F.snap ? 1 : 1 - Math.exp(-dt * 3));
    const vS = clamp(st.speed, 0, 1.4);
    const wob = 1 + 0.0214 * (Math.sin(st.t * 0.503 + 0.3) + 0.7 * Math.sin(st.t * 1.005 + 1.7) + 0.5 * Math.sin(st.t * 2.01 + 4.1));
    const gr = Math.abs(Math.tan(clamp(num(s.slope, 0), -0.9, 0.9)));
    const stepLen = Math.max(0.2, Math.min(0.34 + 0.29 * Math.min(vS, 1.1) + 0.1 * Math.max(0, vS - 1.1), vS / 1.1)) / wob / (1 + 0.7 * Math.min(1.2, gr));
    st.stride = 2 * stepLen;
    st.cad = vS / stepLen;
    st.duty = clamp(0.67 - 0.05 * vS, 0.6, 0.66);
    st.lift = 0.05;
    st.hsP = clamp(8 + 5.7 * (vS - 0.6), 6, 12.5) * DEG;
    st.pTO = clamp(42 + 18 * (vS - 0.6), 34, 56) * DEG;
    st.hoff = clamp(0.38 - 0.17 * (vS - 0.6), 0.26, 0.42);
    st.standT; const down2 = FT[0].init && FT[1].init && !FT[0].swing && !FT[1].swing;
    st.standT = down2 && st.speed < 0.1 ? st.standT + dt : 0;
    const goT0 = st.goT;
    st.goT = st.wantW && (tg === PI_.walk || tg === PI_.stand) ? st.goT + dt : 0;
    st.noGoT = st.clamber || CLB.on || st.stepDn || !st.grounded ? 0 : st.noGoT + dt;
    st.stopM = st.noGoT < 1 ? 0 : st.dec > 0.6 && st.speed > 0.08 && !st.go0 ? 1.2 : Math.max(0, st.stopM - dt);
    const grounded2 = st.grounded && !st.turnStep && !st.clamber && !CLB.on && !st.kneelGo;
    if (!st.goP && !st.go0 && grounded2 && st.wantW && ((st.goT >= 0.09 && goT0 < 0.09 && st.walkW < 0.3) || (st.stopM > 0 && st.dec < -0.3 && st.speed < 0.75))) { st.goP = true; st.goPT = 0; st.stopM = 0; }
    st.goF = false;
    if (st.goP) {
      st.goPT += dt;
      if (!st.wantW || !grounded2 || st.goPT > 0.7 || st.speed > 0.9) st.goP = false;
      else if (down2) { st.goP = false; st.go0 = true; st.goF = true; st.goH = 0; }
    }
    if (st.go0 && st.goH >= 0) { st.goH += dt; if (st.goH > 0.35 || (st.goH > dt * 1.5 && (FT[0].swing || FT[1].swing))) st.goH = -1; }
    if ((st.goT === 0 || st.walkW > 0.3) && !(st.goH >= 0)) st.go0 = false;
    if (typeof s.stepPhase === 'number' && Number.isFinite(s.stepPhase)) st.phase = ((s.stepPhase % 1) + 1) % 1;
    else {
      if (st.goF || ((walking > 0.02 || st.go0) && st.walkP <= 0.02 && (st.walkW < 0.15 || st.standT > 0.35 || st.go0))) {
        const q = F.qG, fx = -2 * (q.x * q.z + q.w * q.y), fz = 2 * (q.x * q.x + q.y * q.y) - 1;
        const d = FT[0].init && FT[1].init ? (FT[1].plant.x - FT[0].plant.x) * fx + (FT[1].plant.z - FT[0].plant.z) * fz : 0;
        const s0 = FT[0].stT, s1 = FT[1].stT, fresh = Math.min(s0, s1) < 0.25 && Math.abs(s0 - s1) > 0.1 && Math.abs(d) < 0.2;
        const first = fresh ? (s0 > s1 ? 0 : 1) : Math.abs(d) > 0.08 ? (d > 0 ? 0 : 1) : st.wside < 0 ? 0 : 1;
        st.phase = ((first ? st.duty - 0.502 : st.duty - 0.002) + 1) % 1; st.stepN = 0;
        for (let a = 0; a < 2; a++) {
          const f = FT[a];
          if (f.swing && !f.wk && !FT[1 - a].swing) st.phase = (st.duty + (1 - st.duty) * clamp(f.swT / f.swDur, 0, 1) - (a ? 0.5 : 0) + 2) % 1;
        }
      }
      let adv = st.walkW > 0.05 ? (st.speed * dt) / st.stride : 0;
      const inDouble = (st.phase % 0.5) < st.duty - 0.5 + 0.02;
      if (st.walkW < 0.3 && (!inDouble || st.lag > 0.15)) adv = Math.max(adv, dt / 1.1);
      if (st.go0) adv = Math.max(adv, dt / 1.1);
      const pc = st.phaseErr * (1 - Math.exp(-dt / 0.15));
      st.phaseErr -= pc;
      st.phase = (st.phase + adv + pc + 1) % 1;
    }
    st.walkP = st.go0 ? Math.max(walking, 0.03) : walking;
    const reachW = Math.max(RCH[0].w, RCH[1].w);
    const eff = clamp(Math.max(st.speedK * 0.75, reachW * 0.45, num(s.effort, 0), num(s.thrust, 0) * 0.6, tg === PI_.crank ? 0.4 + 0.5 * clamp(num(s.crankLoad, 0.6), 0, 1) : 0), 0, 1);
    st.effort += (eff - st.effort) * (1 - Math.exp(-dt * (eff > st.effort ? 0.8 : 0.12)));
    st.fatigue += ((st.effort - st.fatigue) / (st.effort > st.fatigue ? 25 : 45)) * dt;
    if (tg === PI_.step) { st.stepT += dt; }
    if (st.t >= st.shiftNext) {
      st.shiftNext = st.t + 3.5 + 4.5 * rand();
      if (we[PI_.stand] + we[PI_.deck] > 0.6 && st.speed < 0.1) st.wsideT = st.wsideT > 0 ? -1 : 1;
    }
    if (Math.abs(st.sroll || 0) > 1.5) st.wsideT = st.sroll > 0 ? 1 : -1;
    st.wsideV += (2.5 * (st.wsideT - st.wside) - 3.5 * st.wsideV) * dt;
    st.wside += st.wsideV * dt;
    if (st.t >= st.sighNext) { st.sighQ = true; st.sighNext = st.t + 90 + 150 * rand(); }
    const ph0 = st.brPh;
    if (st.brHold) {
      if (st.brPh >= 0.42) {
        const lr0 = st.brPh < 0.9 ? 1 - sstep(0.42, 0.9, st.brPh) : 0;
        let lo = 0, hi = 0.34;
        for (let i = 0; i < 14; i++) { const m = 0.5 * (lo + hi); if (sstep(0, 0.34, m) < lr0) lo = m; else hi = m; }
        st.brPh = 0.5 * (lo + hi);
        st.evIn = true;
      }
      st.brPh = Math.min(0.38, st.brPh + (dt * 3) / st.brLen);
    } else st.brPh += dt / st.brLen;
    if (st.brPh >= 1) {
      st.brPh -= 1;
      st.brSeed = (st.brSeed * 16807) % 2147483647;
      st.brLen = lerp(4.6, 2.6, Math.max(st.effort, st.fatigue)) * (0.88 + 0.24 * (st.brSeed / 2147483647));
      st.deep = st.deepQ ? 1 : st.sighQ ? 0.8 : 0;
      if (st.deepQ) st.brLen *= 1.5;
      if (st.sighQ) st.brLen *= 1.9;
      st.deepQ = st.sighQ = false;
      st.evIn = true;
    }
    if (ph0 < 0.42 && st.brPh >= 0.42) st.evEx = true;
    const ph = st.brPh;
    const lr = (ph < 0.34 ? sstep(0, 0.34, ph) : ph < 0.42 ? 1 : ph < 0.9 ? 1 - sstep(0.42, 0.9, ph) : 0) * (1 + 0.4 * st.fatigue) * (1 + 0.3 * st.deep);
    st.lung += (lr - st.lung) * (F.snap ? 1 : 1 - Math.exp(-dt / 0.12));
    let airT = st.under * (0.12 + 0.55 * sstep(0.1, 0.8, st.vy) + (tg === PI_.sink ? 0.3 : 0) + (tg === PI_.bound ? 0.25 : 0));
    if (st.entryT >= 0 && st.entryT < 2.5) airT = Math.max(airT, st.under * (0.25 + 0.55 * (1 - sstep(0.2, 2.0, st.entryT))));
    airT = Math.max(airT, st.under * st.blowup);
    if (s.dive && !s.dive.perch && Number.isFinite(s.dive.suitAir)) airT = Math.max(s.dive.suitAir, st.entryT >= 0 && st.entryT < 2.5 ? 0.25 + 0.55 * (1 - sstep(0.2, 2.0, st.entryT)) : 0);
    st.suitAir += (airT - st.suitAir) * (1 - Math.exp(-dt * (airT > st.suitAir ? 0.8 : 2.5)));
    if (st.dump > 0) st.suitAir *= Math.exp(-dt * 4);
    if (st.under > 0.5 && st.stumbleT < 0 && st.walkW > 0.3 && st.speed > 0.3) {
      const hv2 = Math.hypot(MOT.vS.x, MOT.vS.z) || 1;
      if (-(MOT.a.x * MOT.vS.x + MOT.a.z * MOT.vS.z) / hv2 > 3.0) st.stumbleT = 0;
    }
    if (st.stumbleT >= 0) {
      st.stumbleT += dt;
      st.stumble = Math.sin(Math.PI * Math.min(1, st.stumbleT / 0.8));
      if (st.stumbleT >= 0.8) { st.stumbleT = -1; st.stumble = 0; }
    }
    CTX.dive = st.dive ? 1 : 0; CTX.proll = num(s.perchRoll, 0); CTX.load = clamp(num(s.perchLoad, 0), 0, 1);
    CTX.bow = s.dive && s.dive.perch ? clamp(num(s.dive.bow, 0), 0, 45) : 0;
    CTX.ext = s.dive && !s.dive.perch && Number.isFinite(s.dive.ext) ? clamp(s.dive.ext, 0, 1) : -1;
    CTX.ldK = s.dive && Number.isFinite(s.dive.landDip) && s.dive.landDip >= 0 ? clamp(s.dive.landDip, 0, 1.5) : -1;
    CTX.go = st.perchGo || 0; CTX.t = st.t; CTX.phase = st.phase; CTX.walkAmp = st.walkW; CTX.speedK = st.speedK; CTX.v = clamp(st.speed, 0.5, 1.3); CTX.vy = st.vy; CTX.lt = st.lt; CTX.wside = st.wside; CTX.sroll = st.sroll || 0; CTX.lung = st.lung;
    CTX.under = st.under; CTX.deep = st.deep; CTX.stumble = st.stumble; CTX.landK = st.landK; CTX.intent = st.intent; CTX.hose = st.hh; CTX.tug = st.tugPull;
    CTX.hop = !st.dive && st.hasFloor && st.under > 0.5 ? 1 - sstep(3.2, 4.5, st.gapS) : 0;
    const jk = F.snap ? 1 : 1 - Math.exp(-dt / 0.25);
    for (let i = 0; i < 6; i++) CTX.jS[i] += (st.jS[i] - CTX.jS[i]) * jk;
    CTX.slopeDeg = num(s.slope, 0) / DEG;
    CTX.wS = Math.PI * st.cad; CTX.step = 0.5 * st.stride;
    CTX.u = st.dvSet ? st.dvU : clamp(st.stepT / 0.9, 0, 1);
    const R0t = TT.ROPES[0].tension;
    if (R0t - st.lastHoseT > 0.02 && R0t > 0.6) st.lookUpT = 1.5;
    st.lastHoseT = R0t;
    st.lookUpT = Math.max(0, st.lookUpT - dt);
    const luT = st.lookUpT > 0 ? 1 : we[PI_.sink] > 0.5 ? ((st.dive && !st.divePerch) || (st.hasFloor && st.gapS < 3) ? 0 : 0.7) : 0.5;
    st.lookUp += (luT - st.lookUp) * (1 - Math.exp(-dt * 1.2));
    CTX.lookUp = st.lookUp;
    CTX.gap = st.gap;
  }
  const WH = 32, WHB = new Float32Array(WH * NP), WHT = new Float32Array(WH).fill(-99);
  let whI = 0;
  const DELS = [0, 0.05, 0.09, 0.14, 0.2, 0.26];
  const BGR = new Uint8Array(NBB);
  BONES.forEach((bn, i) => {
    const k = bn.name.replace(/[RL]$/, '');
    BGR[i] = /^f[IMRP][12]$/.test(k) ? 5 : k === 'farm' || k === 'hand' || k === 'thumb1' || k === 'thumb2' ? 4 : k === 'clav' || k === 'uarm' ? 3 : k === 'chest' || k === 'neck' || k === 'head' || k === 'jaw' || k === 'brow' ? 2 : k === 'spine1' || k === 'spine2' ? 1 : 0;
  });
  const EPA = new Float32Array(NP * NBB * 3), RPA = new Float32Array(NP * 3), USED = new Float32Array(NP), WG = new Float32Array(6 * NP);
  const EPV = [], RPV = [], WGV = [];
  for (let p = 0; p < NP; p++) { EPV.push(EPA.subarray(p * NBB * 3, (p + 1) * NBB * 3)); RPV.push(RPA.subarray(p * 3, p * 3 + 3)); }
  for (let g = 0; g < 6; g++) WGV.push(WG.subarray(g * NP, (g + 1) * NP));
  function weightsAt(ago, out) {
    const tw = st.t - ago;
    for (let k = 0; k < WH; k++) {
      const i = (whI - k + WH) % WH;
      if (WHT[i] <= tw + 1e-4) { for (let p = 0; p < NP; p++) out[p] = WHB[i * NP + p]; return; }
    }
    out.set(we);
  }
  function blendPoses() {
    whI = (whI + 1) % WH; WHT[whI] = st.t;
    for (let p = 0; p < NP; p++) WHB[whI * NP + p] = we[p];
    if (F.snap) for (let k = 0; k < WH; k++) { WHT[k] = st.t; for (let p = 0; p < NP; p++) WHB[k * NP + p] = we[p]; }
    for (let g = 0; g < 6; g++) weightsAt(DELS[g], WGV[g]);
    USED.fill(0);
    for (let g = 0; g < 6; g++) for (let p = 0; p < NP; p++) USED[p] = Math.max(USED[p], WGV[g][p]);
    for (let p = 0; p < NP; p++) if (USED[p] > 1e-4) evalPose(p, EPV[p], RPV[p]);
    for (let b = 0; b < NBB; b++) {
      const wv = WGV[BGR[b]], o = b * 3;
      let x = 0, y = 0, z = 0;
      for (let p = 0; p < NP; p++) {
        const k = wv[p];
        if (k < 1e-4) continue;
        const e = EPV[p];
        x += e[o] * k; y += e[o + 1] * k; z += e[o + 2] * k;
      }
      TB[o] = x; TB[o + 1] = y; TB[o + 2] = z;
    }
    const w0 = WGV[0];
    let rx = 0, ry = 0, rz = 0;
    for (let p = 0; p < NP; p++) { const k = w0[p]; if (k < 1e-4) continue; rx += RPA[p * 3] * k; ry += RPA[p * 3 + 1] * k; rz += RPA[p * 3 + 2] * k; }
    RT[0] = rx; RT[1] = ry; RT[2] = rz;
  }
  const LOOK = { yaw: 0, pitch: 0, yv: 0, pv: 0, dy: 0, dp: 0, rawYaw: 0, rawPitch: 0, ok: false, ty: 0, tp: 0 };
  function addLook(s) {
    const dt = st.dt, t = st.t;
    let yaw = 0, pitch = 0, ok = false;
    const ld = s.lookDir;
    if (ld && Number.isFinite(ld.x) && Number.isFinite(ld.y) && Number.isFinite(ld.z)) {
      _v1.set(ld.x, ld.y, ld.z).applyQuaternion(F.qGi);
      const l = _v1.length();
      if (l > 1e-6) { _v1.multiplyScalar(1 / l); ok = true; yaw = Math.atan2(-_v1.x, -_v1.z); pitch = Math.asin(clamp(_v1.y, -1, 1)); }
    }
    if (t >= st.glNext) {
      const idle = we[PI_.stand] + we[PI_.deck] + we[PI_.sink] * 0.6;
      if ((idle > 0.5 && Math.max(RCH[0].w, RCH[1].w) < 0.1) || (s.dive && s.dive.glances && !s.dive.perch && st.under > 0.5)) {
        const pts = s.interest, pk = pts && pts.length ? pts[Math.floor(rand() * pts.length)] : null;
        if (pk && Number.isFinite(pk.x)) {
          _v2.subVectors(pk, MOT.p).applyQuaternion(F.qGi); _v2.y -= 0.62;
          const l2 = _v2.length() || 1;
          st.glY = Math.atan2(-_v2.x, -_v2.z) - yaw; st.glY -= Math.round(st.glY / TAU) * TAU;
          st.glP = Math.asin(clamp(_v2.y / l2, -1, 1)) - pitch;
        } else {
          st.glY = (rand() < 0.5 ? -1 : 1) * (0.25 + 0.5 * rand()) * (we[PI_.deck] > 0.5 ? 1.2 : 1);
          st.glP = st.under > 0.5 && rand() < 0.3 ? 0.5 + 0.2 * rand() : (rand() - 0.6) * 0.3;
        }
        st.glEnd = t + 2.5 + 4.5 * rand();
      }
      st.glNext = t + 3.5 + 5 * rand();
    }
    if (st.glEnd > 0 && t >= st.glEnd) { st.glY = 0; st.glP = 0; st.glEnd = 0; }
    if (st.noticeT > 0) {
      st.noticeT -= dt;
      _v2.subVectors(st.notice, MOT.p).applyQuaternion(F.qGi);
      _v2.y -= 0.62;
      const l2 = _v2.length();
      if (l2 > 0.2) {
        _v2.multiplyScalar(1 / l2);
        const k2 = sstep(0, 0.3, st.noticeT) * (1 - clamp(Number.isFinite(s.face) ? s.face : 0, 0, 1));
        yaw = lerp(yaw, Math.atan2(-_v2.x, -_v2.z), k2); pitch = lerp(pitch, Math.asin(clamp(_v2.y, -1, 1)), k2);
      }
    }
    yaw = clamp(yaw, -1.3, 1.3) + st.glY;
    pitch = clamp(pitch, -0.9, 0.7) + st.glP;
    const av = s.avoid;
    if (av && Number.isFinite(av.x)) {
      _v2.subVectors(av, MOT.p).applyQuaternion(F.qGi); _v2.y -= 0.62;
      const l2 = _v2.length() || 1;
      const ay = Math.atan2(-_v2.x, -_v2.z), ap = Math.asin(clamp(_v2.y / l2, -1, 1));
      let dyv = yaw - ay; dyv -= Math.round(dyv / TAU) * TAU;
      if (Math.abs(dyv) < 0.26 && Math.abs(pitch - ap) < 0.26) yaw = ay + (dyv >= 0 ? 0.35 : -0.35);
    }
    LOOK.rawYaw = yaw; LOOK.rawPitch = pitch; LOOK.ok = ok;
    if (F.snap) { LOOK.dy = LOOK.yaw = yaw; LOOK.dp = LOOK.pitch = pitch; LOOK.yv = LOOK.pv = 0; }
    else if (dt > 0) {
      const kd = 1 - Math.exp(-dt / 0.15);
      LOOK.dy += (yaw - LOOK.dy) * kd; LOOK.dp += (pitch - LOOK.dp) * kd;
      const n2 = Math.min(8, Math.ceil(dt * 240)), h2 = dt / n2, vcap = we[PI_.deck] > 0.5 ? 1.5 : 4;
      for (let i = 0; i < n2; i++) {
        LOOK.yv += (49 * (LOOK.dy - LOOK.yaw) - 14 * LOOK.yv) * h2; LOOK.yv = clamp(LOOK.yv, -vcap, vcap); LOOK.yaw += LOOK.yv * h2;
        LOOK.pv += (49 * (LOOK.dp - LOOK.pitch) - 14 * LOOK.pv) * h2; LOOK.pv = clamp(LOOK.pv, -vcap, vcap); LOOK.pitch += LOOK.pv * h2;
      }
    }
    const fk = (st.face = clamp(Number.isFinite(s.face) ? s.face : 0, 0, 1));
    const ty = lerp(clamp(LOOK.yaw * 0.45, -0.26, 0.26), clamp(LOOK.yaw, -1.15, 1.15), fk);
    const tp = lerp(clamp((LOOK.pitch + 0.2) * 0.3, -(0.15 + 0.25 * we[PI_.kneel]) * (1 - 0.85 * (st.clamber ? 1 : st.walkW)), 0.06), clamp(LOOK.pitch, -0.4, 0.6), fk);
    TB[J3.pelvis + 1] += ty * lerp(0.06, 0.12, fk); TB[J3.spine1 + 1] += ty * lerp(0.2, 0.22, fk);
    TB[J3.spine2 + 1] += ty * lerp(0.32, 0.3, fk); TB[J3.chest + 1] += ty * lerp(0.42, 0.36, fk);
    TB[J3.spine2] += tp * 0.5; TB[J3.chest] += tp * 0.5;
    if (fk > 0) { const kb = fk * we[PI_.kneel]; TB[J3.spine1] += 5 * DEG * kb; TB[J3.spine2] += 5 * DEG * kb; TB[J3.chest] += 4 * DEG * kb; }
    if (fk > 0 && ok && anchors.helmet && !F.snap) {
      _v3.set(ld.x, ld.y, ld.z).applyQuaternion(F.qGi).normalize();
      anchors.helmet.getWorldQuaternion(_q1);
      _v4.set(0, 0, -1).applyQuaternion(_q1).applyQuaternion(F.qGi);
      const eP = Math.asin(clamp(_v3.y, -1, 1)) - Math.asin(clamp(_v4.y, -1, 1));
      let eY = Math.atan2(-_v3.x, -_v3.z) - Math.atan2(-_v4.x, -_v4.z);
      eY -= Math.round(eY / TAU) * TAU;
      const kf = Math.min(1, dt * 3) * fk;
      st.fcP = clamp((st.fcP || 0) + eP * kf, -0.3, 0.7);
      st.fcY = clamp((st.fcY || 0) + eY * kf, -0.5, 0.5);
    } else if (st.fcP || st.fcY) { const kd = Math.exp(-dt * 3); st.fcP *= kd; st.fcY *= kd; }
    if (st.fcP || st.fcY) {
      TB[J3.spine2] += st.fcP * 0.5; TB[J3.chest] += st.fcP * 0.5;
      TB[J3.spine2 + 1] += st.fcY * 0.45; TB[J3.chest + 1] += st.fcY * 0.55;
    }
    LOOK.ty = ty; LOOK.tp = tp;
  }
  function addInertia() {
    _v1.copy(MOT.a);
    _v1.y += 9.8 * (1 - Math.max(st.plantWS, we[PI_.perch])) * (1 - st.under);
    _v1.applyQuaternion(F.qGi);
    const af = clamp(-_v1.z, -5, 5), ax = clamp(_v1.x, -5, 5), ay = clamp(_v1.y, -8, 8);
    const kw = lerp(0.6, 0.45, st.under) * DEG;
    for (let s2 = 0; s2 < 2; s2++) {
      const u = s2 ? J3.uarmL : J3.uarmR, f = s2 ? J3.farmL : J3.farmR, th = s2 ? J3.thighL : J3.thighR, sh = s2 ? J3.shinL : J3.shinR;
      TB[u] += (-2.4 * af + 1.4 * ay) * kw;
      TB[u + 2] += (s2 ? 1 : -1) * 1.5 * ax * kw;
      TB[f] += 1.2 * ay * kw;
      if (st.plantWS < 0.5) { TB[th] += (-1.2 * af + 1.4 * ay) * kw; TB[sh] -= 1.5 * Math.abs(ay) * kw; }
    }
    TB[J3.neck] -= 0.8 * af * kw;
    TB[J3.root] += 0.8 * af * kw;
    RT[0] -= clamp(ax * 0.004, -0.02, 0.02);
    RT[2] += clamp(af * 0.004, -0.02, 0.02);
  }
  function hangLegs(s) {
    const tuck = we[PI_.bound];
    const hw = (1 - st.plantWS) * (1 - st.intent) * (1 - tuck) * st.under * (1 - we[PI_.kneel]) * (1 - we[PI_.climb]) * (1 - we[PI_.present]);
    if (s && s.dive && s.dive.legs && !s.dive.perch) {
      const hwD = (1 - st.plantWS) * (1 - st.intent) * (1 - tuck) * sstep(0.05, 0.45, st.line) * (1 - we[PI_.kneel]) * (1 - we[PI_.climb]) * (1 - we[PI_.present]);
      const eT = st.entryT, ek = st.entK || 1;
      const e1 = eT >= 0 ? sstep(0, 0.06, eT) * (1 - sstep(0.25, 0.65, eT)) : 0, e2 = eT >= 0 ? sstep(0.1, 0.22, eT) * (1 - sstep(0.3, 0.7, eT)) : 0;
      TB[J3.root] += (-6 * e1 + 3.5 * e2) * ek * DEG;
      TB[J3.neck] -= 8 * e1 * ek * DEG;
      if (hwD < 1e-3) return;
      const t = st.t, dt = st.dt, ph = TAU * 0.3 * (t - 0.3), sn = Math.sin(ph);
      const kU = clamp(num(s.dive.knees, 0), 0, 1), pre = clamp(num(s.dive.prep, 0), 0, 1);
      const brt = (2.6 * (st.lung - 0.5) + 1.8 * Math.sin(TAU * 0.23 * t + 0.7) + 1.1 * Math.sin(TAU * 0.41 * t + 2.3)) * DEG * hwD;
      TB[J3.root] -= 0.5 * brt; TB[J3.spine2] -= 0.3 * brt; TB[J3.chest] -= 0.4 * brt;
      _v1.copy(MOT.a).applyQuaternion(F.qGi);
      if (dt > 0) { st.lkV += (-36 * st.lk - 7 * st.lkV - clamp(_v1.z, -3, 3) * 0.08 - clamp(_v1.x, -3, 3) * 0.04) * dt; st.lk += st.lkV * dt; }
      for (let a = 0; a < 2; a++) {
        const S = SIDES[a], th = J3['thigh' + S], sh = J3['shin' + S], ft = J3['foot' + S], sg = a ? -1 : 1;
        const sl = Math.sin(TAU * 0.17 * t + (a ? Math.PI : 0) + 0.5 * Math.sin(TAU * 0.07 * t + 1.1));
        const fl = (12 * sl + 3 * Math.sin(TAU * 0.53 * t + a * 2.1)) * (1 - 0.7 * kU);
        TB[th] = lerp(TB[th], (8 + 2 * sn * sg * (1 - kU) + 5 * e1 * ek + 18 * kU - 4 * pre + 0.45 * fl) * DEG + st.lk, hwD); TB[th + 1] *= 1 - hwD; TB[th + 2] = lerp(TB[th + 2], sg * (4.5 + 1.5 * Math.sin(TAU * 0.11 * t + a * 1.7) + 2 * kU) * DEG, hwD);
        const kn = Math.max(3, lerp(15 + fl, 10, e1)) + 15 * kU + 5 * pre;
        TB[sh] = lerp(TB[sh], -kn * DEG - 0.6 * st.lk, hwD);
        TB[ft] = lerp(TB[ft], -lerp(25, 4, Math.max(pre, 0.6 * kU)) * DEG, hwD);
      }
      return;
    }
    if (hw < 1e-3) return;
    const pre = st.hasFloor && st.vy < 0 ? sstep(0.6, 0.15, st.gapS) : 0;
    for (let a = 0; a < 2; a++) {
      const S = SIDES[a], th = J3['thigh' + S], sh = J3['shin' + S], ft = J3['foot' + S];
      TB[th] = lerp(TB[th], 3 * DEG, hw); TB[th + 1] *= 1 - hw; TB[th + 2] = lerp(TB[th + 2], (a ? -2 : 2) * DEG, hw);
      TB[sh] = lerp(TB[sh], -lerp(13, 15, pre) * DEG, hw);
      TB[ft] = lerp(TB[ft], -lerp(25, 4, pre) * DEG, hw);
    }
    if (st.blowup > 0.01) for (let a = 0; a < 2; a++) { const S = SIDES[a]; TB[J3['thigh' + S]] += 30 * DEG * st.blowup * hw; TB[J3['shin' + S]] -= 25 * DEG * st.blowup * hw; }
  }
  function addDrag(s) {
    const dt = st.dt, uw = st.under;
    const flowArm = !!(s.dive && !s.dive.perch);
    if (st.liftT >= 0 && flowArm) st.liftT = -1;
    if (st.liftT >= 0) {
      st.liftT += dt;
      const e = sstep(0, 0.18, st.liftT) * (1 - sstep(0.45, 1.5, st.liftT)) * (1 - we[PI_.crank]);
      TB[J3.uarmR + 2] += 38 * DEG * e; TB[J3.uarmL + 2] -= 38 * DEG * e;
      TB[J3.uarmR] += 22 * DEG * e; TB[J3.uarmL] += 22 * DEG * e;
      if (st.liftT > 1.5) st.liftT = -1;
    }
    _v1.copy(MOT.vS);
    if (s.current && Number.isFinite(s.current.x)) _v1.sub(s.current);
    if (s.surge && Number.isFinite(s.surge.x)) _v1.sub(s.surge);
    _v1.applyQuaternion(F.qGi).multiplyScalar(uw);
    const vh = Math.hypot(_v1.x, _v1.z);
    const th = Math.min(25 * DEG, Math.atan(vh * vh));
    let tf = vh > 1e-4 ? (-_v1.z / vh) * th : 0, ts = vh > 1e-4 ? (_v1.x / vh) * th : 0;
    if (typeof s.lean === 'number' && Number.isFinite(s.lean)) {
      tf = 9 * Math.tanh((s.lean - 3) / 18) * DEG;
      ts = (-0.18 / 0.4) * Math.atan(clamp(st.hdgRate * Math.hypot(MOT.vS.x, MOT.vS.z), -3, 3) / 9.8);
    }
    if (flowArm && st.plantWS < 0.5) { tf *= 0.2; ts *= 0.2; }
    const wn = 6, z = 1;
    if (F.snap) { st.dlF = tf; st.dlS = ts; st.dlFv = st.dlSv = 0; }
    else if (dt > 0) {
      const n2 = Math.min(8, Math.ceil(dt * 240)), h2 = dt / n2;
      for (let i = 0; i < n2; i++) {
        st.dlFv += (wn * wn * (tf - st.dlF) - 2 * z * wn * st.dlFv) * h2; st.dlF += st.dlFv * h2;
        st.dlSv += (wn * wn * (ts - st.dlS) - 2 * z * wn * st.dlSv) * h2; st.dlS += st.dlSv * h2;
      }
    }
    if (uw < 0.02) return;
    TB[J3.root] -= st.dlF;
    TB[J3.root + 2] -= st.dlS * 0.4;
    st.leanZ = Math.sin(st.dlF) * 0.45 * st.plantWS;
    RT[2] -= st.leanZ; RT[0] -= Math.sin(st.dlS) * 0.03;
    TB[J3.pelvis + 1] += clamp(st.hdgRate * 0.07, -0.1, 0.1) * st.plantWS;
    const onSpot = st.speed < 0.25 && st.walkW < 0.3 && Math.abs(st.hdgRate) > 0.3 && !st.clamber && !SUP && FT[0].init && FT[1].init && we[PI_.kneel] < 0.05;
    if (!onSpot || F.snap || dt < 1e-4) st.hLagT *= F.snap ? 0 : Math.exp(-dt / 0.2);
    else {
      const f = FT[0].swing ? FT[0] : FT[1].swing ? FT[1] : null;
      if (!f) st.hLagT += (5 / 6) * st.hdgRate * dt;
      else st.hLagT -= st.hLagT * Math.min(1, dt / Math.max(dt, f.swDur - f.swT));
      st.hLagT = clamp(st.hLagT, -0.35, 0.35);
    }
    st.hLag = F.snap ? st.hLagT : st.hLag + (st.hLagT - st.hLag) * (1 - Math.exp(-dt / 0.05));
    const free = 1 - st.plantWS;
    if (free > 0.01) {
      const fwd = -_v1.z, up = clamp(-_v1.y, 0, 3);
      for (let a = 0; a < 2; a++) {
        const S = SIDES[a], sg = a ? -1 : 1;
        TB[J3['thigh' + S]] += 0.3 * st.dlF * free;
        TB[J3['shin' + S]] -= 5 * vh * DEG * free;
        TB[J3['uarm' + S]] -= 8 * DEG * fwd * free;
        TB[J3['farm' + S]] += 6 * DEG * Math.abs(fwd) * free;
        TB[J3['uarm' + S]] += Math.min(45, 20 * up) * DEG * free * 0.5;
        TB[J3['uarm' + S] + 2] += sg * Math.min(30, 14 * up) * DEG * free;
      }
    }
    if (flowArm) {
      const go = s.dive.armGo !== undefined ? !!s.dive.armGo : !!st.shUnder;
      st.shK += ((go ? 1 : 0) - st.shK) * (1 - Math.exp(-dt / 0.03));
      const spr = clamp(num(s.dive.knees, 0), 0, 1);
      const vUp = Math.max(0, -MOT.vS.y), ab0 = clamp(32 + 4 * vUp, 32, 46);
      const dA = 1.5 * Math.sin(TAU * 0.13 * st.t + 1.1) + 0.8 * Math.sin(TAU * 0.21 * st.t + 0.4);
      const dE = 2 * Math.sin(TAU * 0.11 * st.t + 2.2);
      const abdT = lerp(ab0, 36 + dA, spr), elbT = lerp(32, 45 + dE, spr);
      const rA = 60 * dt;
      if (!(st.faA > 0)) { st.faA = abdT; st.faE = elbT; }
      st.faA += clamp(abdT - st.faA, -rA, rA); st.faE += clamp(elbT - st.faE, -rA, rA);
      const abd = st.faA, elb = st.faE;
      for (let a = 0; a < 2; a++) {
        const kT = s.dive.touch ? 0 : (1 - clamp(RCH[a].w, 0, 1)) * st.shK;
        if (!st.faK) st.faK = [0, 0];
        st.faK[a] += clamp(kT - st.faK[a], -1.5 * dt, 1.5 * dt);
        const k = st.faK[a];
        if (k < 1e-3) continue;
        const sg = a ? -1 : 1;
        const ua = J3[a ? 'uarmL' : 'uarmR'], fa = J3[a ? 'farmL' : 'farmR'];
        TB[ua + 2] = lerp(TB[ua + 2], sg * abd * DEG, k);
        TB[ua] = lerp(TB[ua], lerp(12, 22, spr) * DEG, k);
        TB[fa] = lerp(TB[fa], elb * DEG, k);
      }
    }
  }
  function capArms() {
    const dt = st.dt, off = !st.dive && st.hasFloor && st.under > 0.5;
    const on = off && (st.intent || !st.grounded || we[PI_.bound] > 0.02 || (we[PI_.land] > 0.02 && st.lt < 2)) ? 1 : 0;
    st.armCap = F.snap ? on : st.armCap + (on - st.armCap) * (1 - Math.exp(-dt / 0.2));
    st.armLimW = F.snap || on ? on : st.armLimW * Math.exp(-dt / 0.25);
    const w = st.armCap, wl = st.armLimW, L = st.armLim;
    if (w >= 1e-3) for (let a = 0; a < 2; a++) {
      const o = a ? J3.uarmL : J3.uarmR, sg = a ? -1 : 1;
      const x = TB[o], z = sg * TB[o + 2], cz = Math.cos(z);
      const fw = cz * Math.sin(x), ou = Math.sin(z), h = Math.hypot(fw, ou);
      const e = Math.acos(clamp(cz * Math.cos(x), -1, 1));
      if (h < 1e-6) continue;
      const f2 = (fw / h) * (fw / h), kn = 14 * DEG, e0 = (52 - 9 * f2) * DEG - kn;
      if (e <= e0) continue;
      const ec = lerp(e, e0 + kn * Math.tanh((e - e0) / kn), w), se = Math.sin(ec) / h;
      TB[o] = Math.atan2(fw * se, Math.cos(ec));
      TB[o + 2] = sg * Math.asin(clamp(ou * se, -1, 1));
    }
    for (let a = 0; a < 2; a++) {
      const u = a ? J3.uarmL : J3.uarmR, f = a ? J3.farmL : J3.farmR, i = a * 3;
      if (wl < 1e-3 || F.snap || !(dt > 0)) { L[i] = TB[u]; L[i + 1] = TB[u + 2]; L[i + 2] = TB[f]; continue; }
      const dx = TB[u] - L[i], dz = TB[u + 2] - L[i + 1], df = TB[f] - L[i + 2];
      const v = (0.55 * Math.hypot(dx, dz) + 0.35 * Math.abs(df)) / dt, k = v > 0.5 ? 0.5 / v : 1;
      L[i] += dx * k; L[i + 1] += dz * k; L[i + 2] += df * k;
      TB[u] = lerp(TB[u], L[i], wl); TB[u + 2] = lerp(TB[u + 2], L[i + 1], wl); TB[f] = lerp(TB[f], L[i + 2], wl);
    }
  }
  function addStride() {
    const dt = st.dt;
    if (F.snap) { st.imp = st.impV = 0; return; }
    if (dt > 0) {
      const n = Math.min(8, Math.ceil(dt * 240)), h = dt / n;
      for (let i = 0; i < n; i++) { st.impV += (-256 * st.imp - 22.4 * st.impV) * h; st.imp += st.impV * h; }
    }
    const x = st.imp * st.walkW;
    if (Math.abs(x) < 1e-5) return;
    TB[J3.spine2] -= 2.5 * DEG * x; TB[J3.chest] -= 4 * DEG * x; TB[J3.neck] += 2 * DEG * x;
    TB[J3.chest + 2] -= st.impS * 2.5 * DEG * x;
    TB[J3.clavR + 2] -= 3 * DEG * x; TB[J3.clavL + 2] += 3 * DEG * x;
    TB[J3.farmR] += 5 * DEG * x; TB[J3.farmL] += 4 * DEG * x;
  }
  const NZF = new Float32Array(NBB * 6), NZP = new Float32Array(NBB * 6), NZA = new Float32Array(NBB * 3);
  {
    const AMP = { uarm: [1.2, 0.5, 1.4], farm: [2, 0, 0], hand: [0.8, 1, 0.6], thumb1: [2, 3, 1.5], finger: [0, 0, 4] };
    const R = rng(9173);
    BONES.forEach((bn, i) => {
      let key = bn.name.replace(/[RL]$/, '');
      if (/^f[IMRP][12]$/.test(key)) key = 'finger';
      const a = AMP[key];
      for (let c = 0; c < 3; c++) {
        const j = i * 3 + c;
        NZA[j] = a ? a[c] * DEG : 0;
        NZF[j * 2] = TAU * (0.08 + 0.14 * R()); NZF[j * 2 + 1] = TAU * (0.22 + 0.2 * R());
        NZP[j * 2] = R() * 6.283; NZP[j * 2 + 1] = R() * 6.283;
      }
    });
  }
  function addDetail() {
    const t = st.t, g = 1 + st.fatigue;
    for (let j = 0; j < NBB * 3; j++) {
      const a = NZA[j];
      if (a === 0) continue;
      TB[j] += a * g * (0.65 * Math.sin(NZF[j * 2] * t + NZP[j * 2]) + 0.35 * Math.sin(NZF[j * 2 + 1] * t + NZP[j * 2 + 1]));
    }
    const sa = lerp(0.006, 0.009, st.under) * (1 - 0.7 * st.walkW);
    const sx = (0.6 * Math.sin(t * 1.37 + 0.4) + 0.4 * Math.sin(t * 2.11 + 2.2)) * sa, sz = (0.6 * Math.sin(t * 1.61 + 1.3) + 0.4 * Math.sin(t * 0.93 + 0.2)) * sa;
    RT[0] += sx; RT[2] += sz;
    TB[J3.chest + 2] += sx * 1.2; TB[J3.chest] -= sz * 1.2;
    const exB = st.brPh > 0.42 && st.brPh < 0.9 ? Math.sin(Math.PI * (st.brPh - 0.42) / 0.48) : 0;
    TB[J3.jaw] -= (0.4 + 4.5 * st.effort * exB + 2.2 * exB * we[PI_.deck]) * DEG;
    if (st.gKind === 3) {
      const u = st.gT / st.gDur, bump = Math.sin(Math.PI * clamp(u, 0, 1));
      const S = st.gSide ? 'L' : 'R', sg = st.gSide ? 1 : -1;
      for (const f of FINGERS) { TB[J3['f' + f.n + '1' + S] + 2] += sg * 18 * bump * DEG; TB[J3['f' + f.n + '2' + S] + 2] += sg * 26 * bump * DEG; }
    }
    if (st.gKind === 5) {
      const u = st.gT / st.gDur, env = Math.sin(Math.PI * clamp(u, 0, 1)), w2 = st.t * 17;
      TB[J3.uarmR + 2] += 18 * env * DEG; TB[J3.uarmR] -= 10 * env * DEG;
      TB[J3.farmR] += (12 + 30 * Math.sin(w2)) * env * DEG;
      TB[J3.handR] += 50 * Math.sin(w2 + 0.8) * env * DEG; TB[J3.handR + 2] += 30 * Math.sin(w2 + 1.6) * env * DEG;
    }
    if (st.under > 0.6 && st.nodT < 0 && st.t >= st.nodNext) { st.nodT = 0; st.nodV = false; st.nodNext = st.t + 16 + 22 * rand(); }
    if (st.nodT >= 0) {
      st.nodT += st.dt;
      const u = st.nodT / 0.75, nd = u < 0.3 ? sstep(0, 0.3, u) : 1 - sstep(0.45, 1, u);
      TB[J3.head] += 17 * nd * DEG; TB[J3.neck] += 5 * nd * DEG;
      if (u >= 0.3 && !st.nodV) { st.nodV = true; EV.burst = 10 + Math.floor(6 * rand()); }
      if (u >= 1) { st.nodT = -1; st.nodV = false; }
    }
    if (st.fatigue > 0.45 && st.speed < 0.1 && st.grounded && st.recoverT <= 0 && st.t >= st.recoverNext && st.tugN === 0 && st.hh < 0.05) { st.recoverT = 2.5; st.recoverNext = st.t + 14; }
    if (st.recoverT > 0) {
      st.recoverT -= st.dt;
      const env = Math.sin(Math.PI * clamp(1 - st.recoverT / 2.5, 0, 1));
      TB[J3.root] -= 12 * DEG * env; TB[J3.neck] -= 10 * DEG * env;
    }
  }
  function rootAdjust() {
    const wgt = Math.max(st.plantWS, we[PI_.kneel], we[PI_.step] * (CTX.u < 0 && st.hasFloor && st.line < -0.5 ? 1 : 0), st.grounded && st.lt < 1.2 ? sstep(0, 0.08, st.lt) : 0);
    if (wgt < 1e-3) return;
    let fC = st.floorC;
    if (st.clamber) for (let a = 0; a < 2; a++) if (FT[a].init && !FT[a].swing) fC = Math.max(fC, FT[a].plant.y);
    const floorLocal = fC - MOT.p.y;
    const dvDip = st.dive && CTX.ldK >= 0 ? CTX.ldK * 0.1 : Math.max(0, st.landDipM);
    const off = clamp(floorLocal + 0.95 - 0.012 - dvDip, -0.45, 0.16);
    RT[1] += off * wgt;
    let ex = -0.05;
    if (st.grounded && we[PI_.kneel] < 0.5 && we[PI_.step] < 0.5 && !F.snap) {
      for (let a = 0; a < 2; a++) if (FT[a].init && !FT[a].swing) ex = Math.max(ex, rig.LEG[a].reach - 0.9995);
    }
    st.hipDrop = F.snap ? 0 : clamp((st.hipDrop || 0) + ex * 0.8 * 18 * st.dt, 0, 0.07);
    RT[1] -= st.hipDrop * wgt;
  }
  function leanIn() {
    if (st.plantWS < 0.3 || we[PI_.crank] > 0.5 || st.clamber) return;
    let sx = 0, sz = 0, dn = 0;
    for (let a = 0; a < 2; a++) {
      const R = RCH[a];
      if (!R.has || !R.touched || R.req < 0.05) continue;
      _v1.copy(R.target).applyMatrix4(F.mInv);
      const shx = a ? -0.17 : 0.17, shy = 0.46;
      const dx = _v1.x - shx, dy = _v1.y - shy, dz = _v1.z;
      const d = Math.hypot(dx, dy, dz), over = d - 0.5;
      if (over <= 0) continue;
      const h = Math.hypot(dx, dz) || 1, rq = R.req * R.req;
      sx += (dx / h) * over * rq; sz += (dz / h) * over * rq;
      if (dy < -0.2 && we[PI_.kneel] < 0.5) dn = Math.max(dn, Math.min(0.15, -dy - 0.2) * rq);
    }
    if (Math.abs(sx) + Math.abs(sz) + dn < 1e-5) return;
    const kn = we[PI_.kneel], bend = Math.min(0.4 - 0.2 * kn, Math.max(0, -sz) * 2.2) * (1 - (st.face || 0));
    TB[J3.root] -= bend * (1 - kn);
    TB[J3.spine1] -= 0.5 * bend * kn; TB[J3.spine2] -= 0.5 * bend * kn;
    RT[2] += 0.4 * 0.46 * Math.sin(bend) * (1 - kn);
    RT[0] -= clamp(sx * 0.15, -0.04, 0.04);
    RT[1] -= dn;
  }
  function upright() {
    _v1.copy(_Y).applyQuaternion(F.qGi);
    _q1.setFromUnitVectors(_Y, _v1);
    st.upQ.copy(_q1);
    Qf[0].premultiply(st.upQ);
    Pf[0].applyQuaternion(st.upQ);
  }

  const FT = [0, 1].map((a) => ({ side: a ? -1 : 1, plant: new V3(), plantL: new V3(), from: new V3(), to: new V3(), cur: new V3(), swing: false, swT: 0, swDur: 0.5, init: false, lastPsi: 0, yaw: 0, pitch: 0, p0: 0, psi0: 0, land: 0, stT: 1, rel: 0, over: 0, ext: new V3(), extReq: 0, extW: 0, extT: false, gn: new V3(0, 1, 0), wk: false, y0: 0, gx: 0, gz: 0, pe: 0.22, sat: false, go: 1, pOn: false, rT: 0.14, rH: 0.14, jw: 0, jy: 0, jl: 0, jc: 0, jp: 0 }));
  const _fw = new V3(), _rt = new V3(), _home = new V3(), _ank = new V3(), _pole = new V3(), _sup = new V3(), _fq = new THREE.Quaternion(), _fqm = new THREE.Quaternion(), _sq = new THREE.Quaternion();
  const _sm = new THREE.Matrix4(), _smi = new THREE.Matrix4();
  const HEEL = new V3(0, 0.115, 0.077);
  const CLB = { on: false, lip: false, up: [false, false], ex: 0, ez: 0, top: 0, rise: 0 };
  function clamberLip(s) {
    const b = Math.min(FT[0].plant.y, FT[1].plant.y);
    for (let d = 0.1; d <= 1.4; d += 0.05) {
      const x = MOT.p.x + _fw.x * d, z = MOT.p.z + _fw.z * d, y = floorAt(s, x, z, b);
      if (y < b + 0.25) continue;
      let edge = 0;
      for (let e = 0; e <= 0.2; e += 0.05) edge = Math.max(edge, floorAt(s, x - _fw.x * e, z - _fw.z * e, y) - floorAt(s, x - _fw.x * (e + 0.1), z - _fw.z * (e + 0.1), y));
      let top = y;
      if (edge < 0.15) top = Math.max(y, floorAt(s, x + _fw.x * 0.3, z + _fw.z * 0.3, y));
      else for (let e = 0.05; e <= 0.6; e += 0.05) top = Math.max(top, floorAt(s, x + _fw.x * e, z + _fw.z * e, y));
      CLB.ex = x; CLB.ez = z; CLB.top = top; CLB.rise = top - b;
      return true;
    }
    return false;
  }
  let SUP = null;
  function setPlant(f, p) { f.plant.copy(p); if (SUP) f.plantL.copy(p).applyMatrix4(_smi); }
  const HM = [new V3(), new V3()], NEED = new Float32Array(2), KNEEL_AT = [-0.5, 0.22];
  function homeAt(s, a, kneelGoal, ckS, deckS, out) {
    const side = a ? -1 : 1;
    out.copy(MOT.p).addScaledVector(_rt, side * lerp(lerp(0.095, 0.108, st.walkW), 0.155, deckS)).addScaledVector(_fw, 0.012 + (st.leanZ || 0));
    if (kneelGoal) out.addScaledVector(_fw, KNEEL_AT[a]);
    if (ckS > 0.3) out.addScaledVector(_rt, side * 0.03).addScaledVector(_fw, (a ? 0.12 : -0.1) * ckS);
    out.y = floorAt(s, out.x, out.z, MOT.p.y - 0.95);
    return out;
  }
  const ROCK = 0.14, _rk = new V3(), _rq = new THREE.Quaternion();
  const SINK = 0.025, sinkOf = (f, ld = 0) => f.sk > 0 ? f.sk * (1 - sstep(0, 0.1, f.stT + ld)) : 0;
  function rock(f, p, out) {
    const r = p > 0 ? f.rH : f.rT, k = r * (1 - Math.cos(p)) * (p > 0 ? 1 : -1);
    return out.set(k * Math.sin(f.yaw), r * Math.abs(Math.sin(p)), k * Math.cos(f.yaw)).applyQuaternion(_rq.setFromUnitVectors(_Y, f.gn));
  }
  const tipOf = (f) => Math.max(-58 * DEG, Math.min(-5 * DEG, -60 * DEG - Math.atan2(f.gn.x * Math.sin(f.yaw) + f.gn.z * Math.cos(f.yaw), f.gn.y)));
  function soleOn(s, f, out) {
    const fx = f.cur.x, fz = f.cur.z, y = f.cur.y, sy = Math.sin(f.yaw), cy = Math.cos(f.yaw);
    const m = floorAt(s, fx, fz, y), t = floorAt(s, fx - sy * ROCK, fz - cy * ROCK, y), h = floorAt(s, fx + sy * ROCK, fz + cy * ROCK, y);
    const oT = Math.abs(t - m) < 0.2, oH = Math.abs(m - h) < 0.2;
    const ga = oT && oH ? (m > 0.5 * (h + t) + 0.005 ? (t > h ? t - m : m - h) / ROCK : (t - h) / (2 * ROCK)) : oT ? (t - m) / ROCK : oH ? (m - h) / ROCK : 0;
    const edge = (sg) => {
      let lo = 0, hi = ROCK;
      for (let i = 0; i < 6; i++) { const d = 0.5 * (lo + hi); if (Math.abs(floorAt(s, fx - sg * sy * d, fz - sg * cy * d, y) - m - sg * ga * d) < 0.03) lo = d; else hi = d; }
      return Math.max(0.04, lo);
    };
    f.rT = oT ? ROCK : edge(1); f.rH = oH ? ROCK : edge(-1);
    const r = floorAt(s, fx + cy * 0.08, fz - sy * 0.08, y), l = floorAt(s, fx - cy * 0.08, fz + sy * 0.08, y), oR = Math.abs(r - m) < 0.11, oL = Math.abs(m - l) < 0.11;
    const gc = oR && oL ? (r - l) / 0.16 : oR ? (r - m) / 0.08 : oL ? (m - l) / 0.08 : 0;
    return out.set(ga * sy - gc * cy, 1, ga * cy + gc * sy).normalize();
  }
  function landStep(a, f, k) {
    if (f.clb && CLB.on) CLB.up[a] = true;
    f.swing = false; setPlant(f, f.to); f.clb = 0; f.fly = false;
    f.stT = 0; f.land = f.pitch; f.pOn = false; f.sk = f.wk && !SUP ? SINK : 0;
    EV.step[a] = 1; EV.stepP[a].copy(f.plant); EV.stepK[a] = k;
    if (f.wk && st.walkW > 0.3) { st.impV += 4.2 * clamp(st.speed / 1.25, 0.3, 1.15) * (0.8 + 0.4 * rand()); st.impS = f.side; }
    if (f.wk) { const tri = () => rand() + rand() - 1, J = st.jS; J[0] = 3 * f.jl + 0.13 * tri(); J[1] = 0.13 * tri(); J[2] = 3 * f.jw + 0.1 * tri(); J[3] = 2 * f.jl + 0.1 * tri(); J[4] = 0.03 * tri(); J[5] = 0.03 * tri(); }
    if (st.under > 0.5 && st.stumbleT < 0 && st.walkW > 0.3 && st.floorP) {
      const o2 = FT[1 - a].plant, e = 0.3, fb = o2.y, fp = st.floorP;
      const gx = (floorAt(fp, o2.x + e, o2.z, fb) - floorAt(fp, o2.x - e, o2.z, fb)) / (2 * e);
      const gz = (floorAt(fp, o2.x, o2.z + e, fb) - floorAt(fp, o2.x, o2.z - e, fb)) / (2 * e);
      const pred = o2.y + gx * (f.plant.x - o2.x) + gz * (f.plant.z - o2.z);
      if (Math.abs(f.plant.y - pred) > 0.06) st.stumbleT = 0;
    }
  }
  const KNEE_R = 0.055;
  const TOE_A = new V3(0, HEEL.y, HEEL.z + ROCK);
  const KNEE_X = -122 * DEG, TOE_UP = -58 * DEG;
  const _kT = new V3(), _kA = new V3(), _kK = new V3(), _kb = new V3(), _kv = new V3(), _kq = new THREE.Quaternion(), _kq2 = new THREE.Quaternion(), _ke = new THREE.Euler(0, 0, 0, 'YXZ');
  function kneeRot(x, out) { _ke.set(x, st.kneeYaw, 0, 'YXZ'); return out.setFromEuler(_ke).premultiply(_kq2.setFromUnitVectors(_Y, st.kneeGn)); }
  function kneeAnk(x, out) { return out.copy(TOE_A).applyQuaternion(kneeRot(x, _kq)).add(st.kneeToe); }
  function kneeOf(H, A, out) {
    _kv.subVectors(A, H);
    const d0 = _kv.length(), d = clamp(d0, 0.2, (LT + LS) * 0.9985);
    _kv.multiplyScalar(1 / Math.max(1e-6, d0));
    const ca = clamp((LT * LT + d * d - LS * LS) / (2 * LT * d), -1, 1);
    out.copy(_kb).addScaledVector(_kv, -_kb.dot(_kv)).normalize().multiplyScalar(LT * Math.sqrt(1 - ca * ca));
    return out.addScaledVector(_kv, LT * ca).add(H);
  }
  function kneelLeg(P, k, f) {
    _kb.set(-Math.sin(f.yaw), 0, -Math.cos(f.yaw));
    if (!st.kneeToeOn) {
      st.kneeToe.set(0, 0, -ROCK).applyQuaternion(_fq).add(f.cur);
      st.kneeGn.copy(f.gn); st.kneeYaw = f.yaw; st.kneeX = st.kneeX0 = st.kneeXg = f.pitch; st.kneeToeOn = true;
    }
    _kT.setFromMatrixPosition(Mm[BI.thighR]).applyMatrix4(F.mG);
    const hOf = (x) => { kneeOf(_kT, kneeAnk(x, _kA), _kK); return _kK.y - floorAt(P, _kK.x, _kK.z, _kK.y) - KNEE_R - 0.03; };
    let x1 = st.kneeX0;
    if (hOf(x1) > 0) {
      let xp = x1, xb = x1, hb = 1e9;
      for (let i = 1; i <= 8; i++) {
        const x = lerp(st.kneeX0, KNEE_X, i / 8), h = hOf(x);
        if (h <= 0) { let lo = x, hi = xp; for (let j = 0; j < 8; j++) { const m = 0.5 * (lo + hi); if (hOf(m) <= 0) lo = m; else hi = m; } xb = 0.5 * (lo + hi); break; }
        if (h < hb) { xb = x; hb = h; }
        xp = x;
      }
      x1 = xb;
    }
    st.kneeXg = st.kneeX + clamp(lerp(st.target === PI_.kneel ? st.kneeX0 : TOE_UP, x1, k) - st.kneeX, -5.2 * st.dt, 5.2 * st.dt);
    kneeRot(st.kneeXg, _fq);
    kneeAnk(st.kneeXg, _ank);
  }
  function unkneel(f) {
    f.pitch = f.pk = st.kneeX; f.gn.copy(st.kneeGn); f.yaw = st.kneeYaw; f.rT = f.rH = ROCK;
    setPlant(f, _kA.set(0, 0, ROCK).applyQuaternion(kneeRot(0, _kq)).add(st.kneeToe));
    f.cur.copy(f.plant).add(rock(f, f.pitch, _rk));
    st.kneeToeOn = false;
  }
  const LS_ = [0, 1].map(() => ({ ank: new V3(), fqm: new THREE.Quaternion(), pole: new V3(), fw: new V3(), pb: 0, W: 0, kn: false, psi: 0, kP: NaN }));
  const _kb4 = new Float64Array(6);
  const KN_ST = [[0, 8], [0.05, 12.5], [0.08, 14.5], [0.1, 15.5], [0.15, 14], [0.2, 10.5], [0.25, 7.5], [0.3, 6], [0.35, 6.5], [0.4, 9], [0.45, 13], [0.5, 18.5], [0.55, 25], [0.6, 33], [0.615, 36]];
  const BOB = [[0, -2.1], [0.1, -2.2], [0.2, -1.9], [0.3, -0.9], [0.4, -0.4], [0.5, -0.6], [0.6, -1.1], [0.7, -1.4], [0.8, -1.6], [0.9, -1.8], [1, -2.1]];
  const tabAt = (T, x) => {
    if (x <= T[0][0]) return T[0][1];
    for (let i = 1; i < T.length; i++) if (x <= T[i][0]) { const p = T[i - 1], q = T[i]; return p[1] + ((q[1] - p[1]) * (x - p[0])) / (q[0] - p[0]); }
    return T[T.length - 1][1];
  };
  const kneeAt = (x) => tabAt(KN_ST, x);
  const legD = (k) => Math.sqrt(LT * LT + LS * LS + 2 * LT * LS * Math.cos(k * DEG + KNEE_OFF));
  const _hp = new V3(), _hk = new V3(), _hq = new THREE.Quaternion(), _he = new THREE.Euler();
  function hipUp(a, T, k) {
    _hp.setFromMatrixPosition(Mm[a ? BI.thighL : BI.thighR]);
    const dx = T.x - _hp.x, dz = T.z - _hp.z, Dk = legD(k);
    return T.y + Math.sqrt(Math.max(0.05, Dk * Dk - dx * dx - dz * dz)) - _hp.y;
  }
  function ankleAt(f, c, p, out) {
    _he.set(p, f.yaw, 0, 'YXZ');
    _hq.setFromEuler(_he).premultiply(_q1.setFromUnitVectors(_Y, f.gn));
    return out.copy(HEEL).applyQuaternion(_hq).add(c).applyMatrix4(F.mInv);
  }
  const faceOff = (s, p) => {
    const yb = MOT.p.y - 0.95;
    const str = (d) => {
      let mn = 1e9, mx = -1e9, y0 = floorAt(s, p.x + _fw.x * (d - 0.14), p.z + _fw.z * (d - 0.14), yb);
      for (let i = 1; i <= 5; i++) { const q = d - 0.14 + 0.065 * i, y = floorAt(s, p.x + _fw.x * q, p.z + _fw.z * q, yb), dy = y - y0; y0 = y; if (dy < mn) mn = dy; if (dy > mx) mx = dy; }
      return mx > 0.12 && mx - Math.max(0, mn) > 0.12;
    };
    if (!str(0)) return 0;
    let b = 0, fw = 0;
    for (let i = 0; i < 7 && str(b); i++) b -= 0.05;
    for (let i = 0; i < 7 && str(fw); i++) fw += 0.05;
    const bOk = !str(b), fOk = !str(fw) && floorAt(s, p.x + _fw.x * fw, p.z + _fw.z * fw, yb) - p.y < 0.15;
    if (!bOk && !fOk) return 0;
    const useF = fOk && (!bOk || fw < -b * 0.6);
    let lo = useF ? fw - 0.05 : b + 0.05, hi = useF ? fw : b;
    for (let i = 0; i < 6; i++) { const m = 0.5 * (lo + hi); if (str(m)) lo = m; else hi = m; }
    return hi;
  };
  const soRear = (a) => {
    const f = FT[a], o = FT[1 - a];
    if (st.stepN > 3 || f.swing || !o.swing || !(o.wk || st.speed > 0.25 || (st.wantW && st.speed > 0.08)) || CLB.on || st.clamber) return false;
    if (o.to.y - f.plant.y - o.gx * (o.to.x - f.plant.x) - o.gz * (o.to.z - f.plant.z) > 0.08) return false;
    return -((f.plant.x - MOT.p.x) * _fw.x + (f.plant.z - MOT.p.z) * _fw.z) > (st.stepN < 1 ? 0.03 : 0.05);
  };
  function carry(walking, pw, kneelW, D) {
    const k0 = pw * (1 - sstep(0.05, 0.4, kneelW)) * (1 - we[PI_.land]) * (1 - we[PI_.step]) * (1 - we[PI_.perch]) * (1 - 0.7 * we[PI_.crank]) * (SUP ? 0 : 1);
    if (k0 < 1e-3 || !FT[0].init || !FT[1].init) { st.hipInit = false; st.hipWP = NaN; return; }
    const dt = st.dt, wkT = walking ? st.walkW : 0;
    st.wkC = F.snap || !Number.isFinite(st.wkC) ? wkT : st.wkC + clamp(wkT - st.wkC, -dt / 0.15, dt / 0.15);
    const wk = st.wkC;
    let lo = 1e9, cap = 1e9, capH = 1e9, capE = 1e9, capS = 1e9, gy = 0, gw = 0, gm = 1e9, gt = -1e9, flK = -1e9, clbLo = false;
    for (let a = 0; a < 2; a++) {
      const f = FT[a], L = LS_[a];
      if (L.W < 0.5) continue;
      if (!f.swing) {
        const so = soRear(a);
        if (!so) lo = Math.min(lo, hipUp(a, L.ank, wk < 0.05 && FT[1 - a].swing && !FT[1 - a].wk ? 9 : 6));
        gm = Math.min(gm, f.plant.y); gt = Math.max(gt, f.plant.y);
        flK = Math.max(flK, hipUp(a, L.ank, 118));
        if (CLB.on && CLB.lip && f.plant.y < CLB.top - 0.12) { capH = Math.min(capH, hipUp(a, ankleAt(f, f.plant, 0, _v7), 5) + 0.08); clbLo = true; }
        else if ((!(wk > 0.5 && L.psi > st.hoff && L.psi < D) && !so) || ((f.sat || rig.LEG[a].reach > 1.004) && FT[1 - a].swing)) capH = Math.min(capH, hipUp(a, L.ank, 6.5));
        const au = f.stT < 0.1 ? 1 : 1 - wk * sstep(st.hoff, 0.55, L.psi);
        gy += (f.plant.y + sinkOf(f, 0.025)) * au; gw += au;
      } else if (wk > 0.05 && f.wk) {
        const sN = clamp(f.swT / f.swDur, 0, 1);
        const edge = FT[1 - a].init && !FT[1 - a].swing && FT[1 - a].plant.y - f.to.y > 0.2;
        if (sN >= 0.5 || edge) {
          gm = Math.min(gm, f.to.y);
          _v7.copy(f.to).add(rock(f, st.hsP, _rk)); if (!SUP) _v7.y += SINK;
          ankleAt(f, _v7, st.hsP, _hk);
          const tl = Math.max(0, f.swDur - f.swT), tq = 0.5 * st.hdgRate * tl, cq = Math.cos(tq), sq = Math.sin(tq);
          _v7.set(MOT.vS.x * cq + MOT.vS.z * sq, 0, MOT.vS.z * cq - MOT.vS.x * sq).applyQuaternion(F.qGi); _hk.x -= _v7.x * tl; _hk.z -= _v7.z * tl;
          const hu = hipUp(a, _hk, 9);
          if (sN >= 0.5) cap = Math.min(cap, hu + 0.3 * (1 - sstep(0.5, 0.8, sN)));
          if (edge) { cap = Math.min(cap, hu + 1.4 * tl); capE = Math.min(capE, hu); }
        }
        const au = sstep(0.45, 1, sN);
        gy += (f.to.y + (SUP ? 0 : SINK)) * au; gw += au;
      } else if (!f.wk) {
        const sN = clamp(f.swT / f.swDur, 0, 1);
        gm = Math.min(gm, f.to.y);
        const hu = hipUp(a, ankleAt(f, f.to, 0, _hk), 9);
        cap = Math.min(cap, hu + 0.1 * (1 - sstep(0.3, 0.8, sN)));
        if (f.clb) capS = Math.min(capS, hu);
      }
    }
    if (lo > 1e8 && gw < 1e-3) {
      if (st.hipInit && !wk && FT[0].swing && FT[1].swing) { Pf[0].y += (st.hipY - Pf[0].y) * k0; rig.fkAll(); return; }
      if (st.hipInit && Number.isFinite(st.hipWP) && Number.isFinite(st.hipMP) && !F.snap && dt > 1e-4 && k0 > 0.5) {
        const y1 = st.hipWP - MOT.p.y, m = Math.min(2.4 * dt, 0.045);
        Pf[0].y = clamp(Pf[0].y, y1 - m, y1 + Math.max(MOT.p.y - st.hipMP, m));
        st.hipY = Pf[0].y; st.hipYV = 0; st.hipWP = MOT.p.y + Pf[0].y; st.hipMP = MOT.p.y; rig.fkAll(); return;
      }
      st.hipInit = false; st.hipWP = NaN; return;
    }
    _hp.setFromMatrixPosition(Mm[BI.thighR]); _hk.setFromMatrixPosition(Mm[BI.thighL]);
    const hm = 0.5 * (_hp.y + _hk.y);
    let dy = lo < 1e8 ? lo : 0;
    if (wk > 1e-3 && gw > 1e-3) {
      const bob = -1.3 + ((tabAt(BOB, 2 * (st.phase % 0.5)) + 1.3) * (1.2 + 1.43 * (clamp(st.speed, 0.6, 1.3) - 0.6))) / 1.7;
      dy = lerp(dy, gy / gw - MOT.p.y + 0.915 + 0.01 * bob - hm, lo < 1e8 ? wk : 1);
    }
    if (clbLo && (FT[0].clb || FT[1].clb || CLB.up[0] || CLB.up[1])) dy = Math.max(dy, capH);
    const g0 = Math.min(gm, gw > 1e-3 ? gy / gw : 1e9), fl = g0 < 1e8 ? g0 - MOT.p.y + 0.845 - hm : -1e9;
    const dnU = clamp(gt - MOT.p.y + 0.95 - 0.1, 0, 0.25);
    const y0 = Pf[0].y, yT = y0 + clamp(Math.max(Math.min(dy, cap, capH), fl, Math.min(flK, cap, capH)), Math.min(-0.25, Math.max(-0.55, Math.min(capE, capS))), 0.1 + dnU), yC = y0 + Math.max(capH, fl);
    if (!st.hipInit || F.snap || dt < 1e-4) {
      st.hipT = Math.min(yT, yC); st.hipYV = 0; st.hipInit = true;
      st.hipY = F.snap || dt < 1e-4 ? st.hipT : Pf[0].y; st.hipC = Math.max(yC, st.hipY);
    }
    else {
      st.hipC = Math.max(yC, Math.min(st.hipC, st.hipY) - (0.24 + 0.56 * wk) * dt);
      st.hipT = Math.min(st.hipT + clamp(yT - st.hipT, -Math.max(0.8 + Math.max(0, MOT.vyP), capE < 1e8 || y0 + capS < st.hipT - 0.02 ? 1.5 + MOT.vyP : 0) * dt, (0.3 + 4 * dnU + Math.max(0, -MOT.vS.y) + Math.max(0, MOT.vyP) + 2.5 * Math.max(0, yT - st.hipT - 0.03)) * dt), st.hipC);
      const n = Math.min(8, Math.ceil(dt * 240)), h = dt / n;
      for (let i = 0; i < n; i++) { st.hipYV += (2500 * (st.hipT - st.hipY) - 100 * st.hipYV) * h; st.hipY += st.hipYV * h; }
      if (st.hipY > st.hipC) { st.hipY = st.hipC; st.hipYV = Math.min(0, st.hipYV); }
    }
    if (!F.snap && dt > 1e-4 && k0 > 0.5) {
      const B = _kb4;
      let n = 0;
      for (let a = 0; a < 2; a++) {
        const L = LS_[a], f = FT[a];
        if (f.swing || L.kn || L.W < 0.5 || !Number.isFinite(L.kP)) continue;
        _hp.setFromMatrixPosition(Mm[a ? BI.thighL : BI.thighR]);
        const c = 7.3 * dt, h2 = (L.ank.x - _hp.x) ** 2 + (L.ank.z - _hp.z) ** 2, d0 = legD((L.kP + c) / DEG), d1 = legD(Math.max(0, L.kP - c) / DEG);
        const i = n && f.stT > B[2] ? 0 : n;
        if (i === 0 && n) { B[3] = B[0]; B[4] = B[1]; }
        B[3 * i] = d0 * d0 > h2 ? L.ank.y + Math.sqrt(d0 * d0 - h2) - _hp.y : -1e9;
        B[3 * i + 1] = d1 * d1 > h2 && !(wk > 0.05 && (f.pOn || (L.psi > st.hoff && L.psi < D && f.pitch < -3 * DEG))) ? L.ank.y + Math.sqrt(d1 * d1 - h2) - _hp.y : 1e9;
        B[3 * i + 2] = f.stT;
        n++;
      }
      if (n) {
        let y = st.hipY - Pf[0].y;
        if (n > 1) y = clamp(y, B[3], Math.max(B[3], B[4]));
        y = clamp(y, B[0], Math.max(B[0], B[1]));
        if (Math.abs(Pf[0].y + y - st.hipY) > 1e-5) { st.hipY = Pf[0].y + y; st.hipYV = 0; }
      }
    }
    if (Number.isFinite(st.hipWP) && !F.snap && dt > 1e-4 && k0 > 0.5) { const m = st.hipWP - MOT.p.y - 2.4 * dt; if (st.hipY < m) { st.hipY = m; st.hipYV = Math.max(0, st.hipYV); } }
    if (Number.isFinite(st.hipWP) && Number.isFinite(st.hipMP) && !F.snap && dt > 1e-4 && k0 > 0.5) { const m = st.hipWP - MOT.p.y + Math.max(MOT.p.y - st.hipMP, Math.min(2.4 * dt, 0.045)); if (st.hipY > m) { st.hipY = m; st.hipYV = Math.min(0, st.hipYV); } }
    Pf[0].y += (st.hipY - Pf[0].y) * k0;
    st.hipWP = k0 > 0.5 ? MOT.p.y + Pf[0].y : NaN; st.hipMP = MOT.p.y;
    rig.fkAll();
    FT[0].sat = FT[1].sat = false; FT[0].lift = FT[1].lift = 0;
    if (wk < 0.05 && !(CLB.on && CLB.lip) && !soRear(0) && !soRear(1)) return;
    for (let a = 0; a < 2; a++) {
      const f = FT[a], L = LS_[a], psi = L.psi;
      const late = f.pOn && (psi >= D || psi < 0.15);
      const clbLo = CLB.on && CLB.lip && f.plant.y < CLB.top - 0.12;
      if (f.swing || L.kn || L.W < 0.5 || f.extW > 1e-3 || (!late && !clbLo && !soRear(a) && (psi < 0.15 || psi >= D))) continue;
      if (!late && !clbLo && !f.pOn && psi < st.hoff && (f.plant.x - MOT.p.x) * _fw.x + (f.plant.z - MOT.p.z) * _fw.z > -0.05) continue;
      const ps = late ? D : psi;
      const Dk = Math.max(legD(clbLo || ps < st.hoff ? 3 : lerp(3, kneeAt((Math.min(ps, D) * 0.615) / D), f.go * sstep(0.2, 0.4, wk))), Number.isFinite(L.kP) ? legD((L.kP + 7.3 * dt) / DEG) : 0);
      _hp.setFromMatrixPosition(Mm[a ? BI.thighL : BI.thighR]);
      if (_hp.distanceTo(L.ank) <= Dk) continue;
      f.pOn = true;
      const tipL = tipOf(f);
      let lo2 = tipL, hi2 = f.pitch;
      for (let i = 0; i < 10; i++) {
        const m = 0.5 * (lo2 + hi2);
        _v7.copy(f.plant).add(rock(f, m, _rk));
        if (_hp.distanceTo(ankleAt(f, _v7, m, _hk)) > Dk) hi2 = m; else lo2 = m;
      }
      const pk = Number.isFinite(f.pk) ? f.pk : f.pitch;
      f.pitch = Math.max(0.5 * (lo2 + hi2), Math.min(f.pitch, pk - 4.7 * dt));
      f.cur.copy(f.plant).add(rock(f, f.pitch, _rk));
      ankleAt(f, f.cur, f.pitch, L.ank);
      f.sat = f.pitch < tipL + 0.5 * DEG || _hp.distanceTo(L.ank) > Dk + 0.01;
      _v7.subVectors(L.ank, _hp);
      const dsc = _v7.y * _v7.y - _v7.lengthSq() + Dk * Dk;
      if (f.sat && dsc > 0) { const dy = Math.max(0, -_v7.y - Math.sqrt(dsc)); L.ank.y += dy; f.cur.addScaledVector(_Y, dy); f.lift = dy; }
      L.fqm.copy(F.qGi).multiply(_hq);
    }
    let dn = 0;
    for (let a = 0; a < 2; a++) {
      const f = FT[a], L = LS_[a];
      if (f.swing || !f.pOn || L.kn || L.W < 0.5 || !Number.isFinite(L.kP)) continue;
      _hp.setFromMatrixPosition(Mm[a ? BI.thighL : BI.thighR]);
      const d1 = legD(Math.max(0, L.kP - 7.3 * dt) / DEG), h2 = (L.ank.x - _hp.x) ** 2 + (L.ank.z - _hp.z) ** 2;
      if (_hp.distanceTo(L.ank) > d1 && d1 * d1 > h2) dn = Math.min(dn, L.ank.y + Math.sqrt(d1 * d1 - h2) - _hp.y);
    }
    if (dn < -1e-4) { dn = Math.max(dn, -0.03); Pf[0].y += dn; st.hipY += dn; st.hipYV = 0; if (Number.isFinite(st.hipWP)) st.hipWP += dn; rig.fkAll(); }
  }
  const SWING = [[0, -52, 0], [0.09, -55, 0.016], [0.22, -55, 0.024], [0.32, -51, 0.026], [0.43, -40.5, 0.021], [0.48, -34.5, 0.019], [0.61, -19, 0.012], [0.69, -9, 0.013], [0.74, -2, 0.022], [0.87, 9.5, 0.008], [0.94, 11, 0.003], [1, 11, 0]];
  const SWING_E = [[0, 0], [0.091, 0.061], [0.221, 0.175], [0.325, 0.275], [0.429, 0.379], [0.481, 0.44], [0.61, 0.61], [0.688, 0.71], [0.74, 0.78], [0.8, 0.845], [0.87, 0.91], [0.94, 0.96], [1, 1]];
  const swingE = (x) => {
    if (x < 0.8) return tabAt(SWING_E, x);
    const u = Math.min(1, (x - 0.8) / 0.2);
    return 0.845 + 0.155 * u * (1.47 + u * (0.06 - 0.53 * u));
  };
  const swingAt = (c, x) => {
    for (let i = 1; i < SWING.length; i++) if (x <= SWING[i][0]) { const p = SWING[i - 1], q = SWING[i]; return p[c] + ((q[c] - p[c]) * (x - p[0])) / (q[0] - p[0]); }
    return SWING[SWING.length - 1][c];
  };
  function goUp(s, f, psi, dur, wk) {
    f.swing = true; f.from.copy(f.cur); f.swT = 0; f.swDur = dur; f.p0 = f.pitch; f.psi0 = psi; f.wk = wk; f.bes = false; f.cy0 = f.cur.y; f.pOn = false; f.fcD = NaN;
    if (wk) {
      const tri = () => rand() + rand() - 1;
      f.jw = 0.025 * tri(); f.jy = 0.035 * tri(); f.jl = 0.012 * tri() - 0.003 * f.side; f.jc = 0.2 * tri(); f.jp = 1.5 * DEG * tri();
    } else f.jw = f.jy = f.jl = f.jc = f.jp = 0;
    if (f === FT[0]) st.kneeToeOn = false;
    f.cls = wk && st.speed < 0.4 && st.dec > 0.25;
    f.pe = 0.22 + 0.6 * clamp(Math.abs(f.p0 + st.pTO) / (50 * DEG) - 0.2, 0, 1);
    f.y0 = f.cur.y - floorAt(s, f.cur.x, f.cur.z, f.cur.y) - ROCK * Math.abs(Math.sin(f.pitch));
    const e = 0.3, fx = f.plant.x, fz = f.plant.z, fb = f.plant.y;
    f.gx = (floorAt(s, fx + e, fz, fb) - floorAt(s, fx - e, fz, fb)) / (2 * e);
    f.gz = (floorAt(s, fx, fz + e, fb) - floorAt(s, fx, fz - e, fb)) / (2 * e);
  }
  function feet(s) {
    const pw = st.plantWS, dt = st.dt;
    st.kneelCalm = st.target === PI_.kneel && Math.abs(st.hdgRate) < 0.3 ? st.kneelCalm + dt : 0;
    if (st.target !== PI_.kneel) st.kneelGo = false;
    else if (!st.kneelPrep && !(st.kneelGo && FT[0].swing)) st.kneelGo = st.kneelGo ? Math.abs(st.hdgRate) < 0.6 : st.kneelCalm > 0.25;
    const kneelW = we[PI_.kneel], kneelGoal = st.target === PI_.kneel && st.kneelGo;
    if (F.snap) st.kneeToeOn = false;
    const stepW = we[PI_.step], u = CTX.u, onBoard = st.hasFloor && st.line < -0.5;
    const sp0 = onBoard ? stepW * (u < -0.35 ? 1 : 0) : 0, sp1 = onBoard ? stepW * (u < 0 ? 1 : 0) : 0;
    for (let a = 0; a < 2; a++) { const f = FT[a]; f.extW = f.extT ? Math.min(f.extReq, f.extW + dt / 0.25) : Math.max(0, f.extW - dt / 0.3); f.extT = false; }
    if (pw < 1e-3 && kneelW < 1e-3 && sp0 + sp1 < 1e-3 && FT[0].extW + FT[1].extW < 1e-3) {
      FT[0].init = FT[1].init = false; FT[0].swing = FT[1].swing = false; FT[0].clb = FT[1].clb = 0; CLB.on = false; SUP = null; return;
    }
    SUP = st.line < -0.5 ? (s.support && s.support.isObject3D ? s.support : group) : null;
    if (SUP) { SUP.updateWorldMatrix(true, false); _sm.copy(SUP.matrixWorld); _smi.copy(_sm).invert(); SUP.getWorldQuaternion(_sq); }
    _fw.set(0, 0, -1).applyQuaternion(F.qG); _fw.y = 0;
    if (_fw.lengthSq() < 1e-6) _fw.set(0, 0, -1);
    _fw.normalize();
    _rt.set(-_fw.z, 0, _fw.x);
    const heading = Math.atan2(-_fw.x, -_fw.z);
    if (!Number.isFinite(st.hdg) || F.snap || dt < 1e-4) st.hdgRate = 0;
    else st.hdgRate += (Math.atan2(Math.sin(heading - st.hdg), Math.cos(heading - st.hdg)) / dt - st.hdgRate) * (1 - Math.exp(-dt * 10));
    st.hdg = heading;
    const vx = MOT.vS.x, vz = MOT.vS.z, hv0 = Math.hypot(vx, vz);
    st.dec = hv0 > 0.05 ? -(MOT.a.x * vx + MOT.a.z * vz) / hv0 : 0;
    const T = st.stride / Math.max(0.08, st.speed);
    const D = st.duty;
    const tsW = st.speed < (st.turnStep ? 0.35 : 0.25) && Math.abs(st.hdgRate) > (st.turnStep ? 0.5 : 0.9);
    st.tsT += dt;
    if (tsW !== st.turnStep && (st.tsT > 0.3 || F.snap)) {
      if (st.turnStep && !tsW && !F.snap && FT[0].init && FT[1].init) {
        let ph = -1;
        for (let a = 0; a < 2; a++) { const f = FT[a]; if (f.swing && !FT[1 - a].swing) ph = (D + (1 - D) * clamp(f.swT / f.swDur, 0, 1) - (a ? 0.5 : 0) + 2) % 1; }
        if (ph < 0 && !FT[0].swing && !FT[1].swing) {
          const b0 = -((FT[0].plant.x - MOT.p.x) * _fw.x + (FT[0].plant.z - MOT.p.z) * _fw.z), b1 = -((FT[1].plant.x - MOT.p.x) * _fw.x + (FT[1].plant.z - MOT.p.z) * _fw.z);
          ph = (D - 0.03 - (b1 > b0 ? 0.5 : 0) + 2) % 1;
        }
        if (ph >= 0) { st.phase = ph; st.phaseErr = 0; }
      }
      st.turnStep = tsW; st.tsT = 0;
    }
    const ckS = we[PI_.crank], deckS = we[PI_.deck], walking = (st.walkW > 0.05 || st.go0) && !st.turnStep && !(kneelGoal && st.speed < 0.3);
    const stepDown = st.stepDn || (st.walkW > 0.3 && st.under > 0.5 && !st.dive && st.gap < 0.65 && MOT.vS.y < 0.2);
    const leaving = !stepDown && !st.clamber && ((Math.abs(MOT.vS.y) > 0.4 && (!st.grounded || (st.gap > 0.15 && MOT.vS.y < 0))) || (Math.hypot(vx, vz) > 1.2 && st.walkW < 0.05));
    const fastT = Math.abs(st.hdgRate) > 1, still = st.speed < 0.12, inStep = (f) => f.swing || (still && Math.abs(st.hdgRate) > 0.3 && f.stT < 0.1);
    let restepping = (inStep(FT[0]) || inStep(FT[1])) && !walking;
    const tStep = fastT ? (st.kneeToeOn || !still ? 0.35 : 0.6) : 0.45;
    const yawAim = (f, wk) => {
      const tin = f.side * st.hdgRate < 0;
      return heading - f.side * 0.1 + (wk ? clamp(st.hdgRate * 0.25, -0.45, 0.45) : clamp(st.hdgRate * (tin ? 0.65 : 0.12), -0.8, 0.8));
    };
    for (let a = 0; a < 2; a++) {
      const f = FT[a];
      if (SUP && f.init) f.plant.copy(f.plantL).applyMatrix4(_sm);
      homeAt(s, a, kneelGoal, ckS, deckS, HM[a]);
      const lim = ckS > 0.3 ? 0.07 : SUP || deckS > 0.5 ? 0.12 : kneelGoal && a === 0 ? 0.09 : 0.2, yT = yawAim(f, false);
      NEED[a] = f.init && !f.swing ? Math.max(Math.hypot(f.plant.x - HM[a].x, f.plant.z - HM[a].z) / lim, Math.abs(Math.atan2(Math.sin(yT - f.yaw), Math.cos(yT - f.yaw))) / tStep) : 0;
    }
    if (st.clamber && !CLB.on) {
      CLB.on = true; CLB.lip = !SUP && FT[0].init && FT[1].init && clamberLip(s); CLB.up[0] = CLB.up[1] = false;
      for (let a = 0; a < 2; a++) {
        const f = FT[a];
        if (CLB.lip && f.swing && f.wk && f.swT < 0.5 * f.swDur && !FT[1 - a].swing) { goUp(s, f, f.psi0, 0.4 + 0.25 * clamp(CLB.rise, 0, 1.2), false); f.clb = 1; }
      }
    }
    else if (!st.clamber && CLB.on && !(FT[0].swing && FT[0].clb) && !(FT[1].swing && FT[1].clb)) { CLB.on = false; FT[0].clb = FT[1].clb = 0; }
    const clbOn = CLB.on && CLB.lip;
    if (clbOn && st.clamber && !FT[0].swing && !FT[1].swing) {
      for (let a = 0; a < 2; a++) if (FT[a].plant.y > CLB.top - 0.12) CLB.up[a] = true;
      let a = -1;
      if (!CLB.up[0] && !CLB.up[1]) a = FT[0].stT >= FT[1].stT ? 0 : 1;
      else if (CLB.up[0] !== CLB.up[1]) {
        const b = CLB.up[0] ? 1 : 0;
        if (FT[1 - b].stT > 0.2 && (rig.LEG[b].reach > 0.97 || MOT.p.y - 0.95 > FT[b].plant.y + 0.3 * CLB.rise)) a = b;
      }
      if (a >= 0) { const f = FT[a]; goUp(s, f, (st.phase + (a ? 0.5 : 0)) % 1, 0.4 + 0.25 * clamp(CLB.rise, 0, 1.2), false); f.clb = CLB.up[1 - a] ? 2 : 1; restepping = true; }
    }
    for (let a = 0; a < 2; a++) {
      const f = FT[a];
      _home.copy(HM[a]);
      if (!f.swing) f.stT += dt;
      const psi = (st.phase + (a ? 0.5 : 0)) % 1;
      if (!f.init || F.snap) {
        setPlant(f, _home); f.cur.copy(_home); f.swing = false; f.init = true; f.lastPsi = psi; f.clb = 0;
        f.yaw = heading - f.side * 0.1; f.pitch = 0; f.land = 0; f.stT = 1; f.rel = 0; f.over = 0;
      }
      const landing = st.lt < 1.2 && st.grounded;
      f.over = !f.swing && !landing && !clbOn && (walking ? rig.LEG[a].reach > 1.03 && psi > 0.15 : rig.LEG[a].reach > 0.9995 && Math.hypot(f.plant.x - _home.x, f.plant.z - _home.z) > 0.05) ? f.over + 1 : 0;
      f.rel = (leaving && !landing) || f.over >= 30 ? Math.min(1, f.rel + dt / 0.15) : Math.max(0, f.rel - dt / 0.3);
      if (f.rel > 0.99) { setPlant(f, _home); f.cur.copy(_home); f.swing = false; f.pitch = 0; f.land = 0; f.clb = 0; }
      const yawT = yawAim(f, walking) - (f.swing && f.wk ? f.side * f.jy : 0);
      const dyaw = Math.atan2(Math.sin(yawT - f.yaw), Math.cos(yawT - f.yaw));
      if (!f.swing && walking) {
        const bh = -((f.plant.x - MOT.p.x) * _fw.x + (f.plant.z - MOT.p.z) * _fw.z), going = st.stepN < 1 ? 1 : Math.max(sstep(0.08, 0.35, st.speed), sstep(0.1, 0.2, bh));
        const oB = FT[1 - a], bhO = -((oB.plant.x - MOT.p.x) * _fw.x + (oB.plant.z - MOT.p.z) * _fw.z), psiO = (psi + 0.5) % 1;
        const rear = bh > bhO - 0.03 && !(psiO >= D && psiO < 0.97);
        const early = ((psi > 0.6 * D && psi < D && (rig.LEG[a].reach > 1.02 || f.sat)) || f.over >= 3 || (psi > 0.25 && LS_[a].kP > 100 * DEG) || (psi < 0.6 * D && bh > 0.2 && rear && rig.LEG[a].reach > 0.995 && oB.stT > 0.15) ||
          (st.stepN === 1 && bh > 0.14 && rear && oB.stT > 0.08 && !st.clamber && !CLB.on)) && !oB.swing;
        f.go = going;
        const due = psi >= D && psi < 0.97 && (f.lastPsi < D || f.stT > 0.15);
        const o2 = FT[1 - a], drop = !clbOn && o2.swing && o2.wk && o2.swT > 0.75 * o2.swDur && f.stT > 0.2 && ((f.plant.y - o2.to.y > 0.3 && rig.LEG[a].reach > 1.0) || f.over >= 3 || f.lift > 0.02);
        if (!clbOn && (((due || early) && going > 0.5 && !o2.swing && f.stT > 0.2) || drop)) { goUp(s, f, psi, st.stepN ? clamp((1 - D) * T, 0.4, st.stepN > 1 ? 0.6 : 0.46) : 0.44, true); f.fly = drop && o2.swing; }
        else {
          const u = psi < D ? clamp((psi - st.hoff) / Math.max(0.05, D - st.hoff), 0, 1) : 0;
          const pT = clbOn ? 0 : (f.land * (1 - sstep(0, 0.08, psi < 0.5 ? psi : psi > 0.9 ? 0 : 1)) - st.pTO * Math.min(u * u, sstep(0.03, 0.3, bh))) * sstep(0.05, 0.4, st.walkW) * going;
          const kF = Number.isFinite(LS_[a].kP) ? clamp((LS_[a].kP / DEG - 4) / 26, 0.3, 1) : 1;
          const pC = Math.max(pT, tipOf(f));
          const rk = st.walkW > 0.05 && Number.isFinite(st.wkC) ? clamp(st.wkC / st.walkW, 0.25, 1) : 1;
          const keep = bh > 0.22 && f.pitch < -3 * DEG && !clbOn;
          f.pitch = pC > f.pitch ? (keep ? f.pitch : Math.min(pC, f.pitch + 3.6 * kF * dt)) : Math.max(pC, f.pitch - 5.5 * rk * dt);
          const hu = sstep(0.12, 0.3, -f.pitch);
          if (hu > 0 && !SUP) {
            const ry = Math.atan2(Math.sin(f.yaw - heading), Math.cos(f.yaw - heading)) * f.side;
            const over = ry > 0.35 ? ry - 0.35 : ry < -0.4 ? ry + 0.4 : 0;
            if (over !== 0) {
              const dy = -f.side * Math.sign(over) * Math.min(Math.abs(over), 3.5 * hu * dt), r = f.rT;
              const ex = f.plant.x - r * Math.sin(f.yaw), ez = f.plant.z - r * Math.cos(f.yaw);
              f.yaw += dy;
              _v6.set(ex + r * Math.sin(f.yaw), f.plant.y, ez + r * Math.cos(f.yaw));
              setPlant(f, _v6);
            }
          }
          f.cur.copy(f.plant).add(rock(f, f.pitch, _rk)); f.cur.y += sinkOf(f);
        }
      } else if (!f.swing) {
        f.pOn = false;
        const off = Math.hypot(f.plant.x - _home.x, f.plant.z - _home.z);
        const lim = ckS > 0.3 ? 0.07 : SUP || deckS > 0.5 ? 0.12 : kneelGoal && a === 0 ? 0.09 : 0.2;
        const vmis = !SUP && deckS > 0.5 && Math.abs(f.plant.y - _home.y) > 0.02;
        const o2 = FT[1 - a], sx = f.plant.x - o2.plant.x, sz = f.plant.z - o2.plant.z, sb = sx * _fw.x + sz * _fw.z;
        const lf = ((f.plant.x - MOT.p.x) * _rt.x + (f.plant.z - MOT.p.z) * _rt.z) * f.side, lo = ((o2.plant.x - MOT.p.x) * _rt.x + (o2.plant.z - MOT.p.z) * _rt.z) * o2.side;
        const dw = Number.isFinite(LS_[a].kP) && LS_[a].kP > 55 * DEG ? 0.12 : 0.5;
        const split = !SUP && deckS < 0.5 && ckS < 0.3 && !kneelGoal && !o2.swing && st.speed < 0.1 && f.stT > dw && o2.stT > dw && (sb < -0.1 || (Math.abs(sx * _rt.x + sz * _rt.z) > 0.25 && lf >= lo) || lf < 0.03);
        const bent = !SUP && deckS < 0.5 && ckS < 0.3 && !kneelGoal && !o2.swing && st.speed < 0.1 && f.stT > 0.6 && o2.stT > 0.3 && off > 0.06 && Number.isFinite(LS_[a].kP) && LS_[a].kP > 22 * DEG;
        const worse = !o2.swing && NEED[1 - a] >= 1 && NEED[1 - a] > NEED[a];
        const rise = a === 0 && st.kneeToeOn && !kneelGoal;
        if (!clbOn && !(rise && kneelW > 0.12 && rig.LEG[0].reach < 0.99) && !restepping && !worse && !(landing && st.lt < 0.6) && (off > lim || Math.abs(dyaw) > tStep || vmis || f.over >= 2 || split || bent || rise) && Math.max(pw, a ? kneelW : 0, rise ? 1 : 0) > 0.5) {
          if (rise) unkneel(f);
          goUp(s, f, psi, rise ? 0.6 : kneelGoal && a === 0 ? clamp(0.25 + 0.5 * off, 0.36, 0.7) : Math.abs(st.hdgRate) > 0.2 ? 0.45 - 0.11 * sstep(0.9, 1.8, Math.abs(st.hdgRate)) : 0.36, false); restepping = true;
          f.bes = split && off <= lim && Math.abs(dyaw) <= 0.45 && lf >= 0.03;
        } else {
          const kF = Number.isFinite(LS_[a].kP) ? clamp((LS_[a].kP / DEG - 4) / 26, 0.3, 1) : 1;
          f.pitch -= clamp(f.pitch * (1 - Math.exp(-dt * 10)), -3.6 * kF * dt, 3.6 * kF * dt);
          f.cur.copy(f.plant).add(rock(f, f.pitch, _rk)); f.cur.y += sinkOf(f);
        }
      }
      if (f.swing) {
        f.swT += dt;
        if (f.wk) {
          let dp = psi - f.psi0;
          if (dp < -0.5) dp += 1;
          f.swT = Math.max(f.swT, Math.min(clamp(dp / Math.max(0.05, 1 - f.psi0), 0, 1) * f.swDur, f.swT + 0.5 * dt));
          if (!FT[1 - a].swing) f.swT += dt * clamp((rig.LEG[1 - a].reach - 1.002) * 30, 0, 1);
        }
        const sN = clamp(f.swT / f.swDur, 0, 1);
        f.to.copy(_home);
        if (f.wk && kneelGoal) f.to.addScaledVector(_fw, -KNEEL_AT[a]);
        if (f.bes && !f.wk) { const o2 = FT[1 - a].plant; f.to.addScaledVector(_fw, clamp((o2.x - _home.x) * _fw.x + (o2.z - _home.z) * _fw.z, -0.12, 0.12)); }
        if (f.clb) {
          f.to.set(CLB.ex, 0, CLB.ez).addScaledVector(_fw, f.clb === 1 ? 0.2 : 0.26).addScaledVector(_rt, f.side * 0.1);
          const ah = (f.to.x - MOT.p.x) * _fw.x + (f.to.z - MOT.p.z) * _fw.z;
          if (ah < 0.05) f.to.addScaledVector(_fw, 0.05 - ah);
        }
        if (f.wk) {
          const hv = Math.max(1e-3, Math.hypot(vx, vz)), tl = Math.max(0, f.swDur - f.swT);
          let ahead = tl * hv + (0.1625 * st.stride + 0.075 + 0.5 * st.stride * f.jl) * (st.stepN < 2 ? (st.stepN ? 0.75 : 0.9) : 1) * sstep(0.1, 0.45, st.speed) * (1 - 0.2 * clamp(Math.abs(st.hdgRate) / 1.5, 0, 1));
          const dec = -(MOT.a.x * vx + MOT.a.z * vz) / hv, brk = sstep(0.25, 0.7, dec);
          if (brk > 0) ahead = lerp(ahead, Math.min(ahead, (hv * hv) / (2 * Math.max(0.9, 1.25 * dec))), brk);
          const ta = clamp(st.hdgRate * (0.5 * tl + 0.12), -0.45, 0.45), ca = Math.cos(ta), sa = Math.sin(ta);
          let ox = ((vx * ca + vz * sa) / hv) * ahead, oz = ((vz * ca - vx * sa) / hv) * ahead;
          const ol = Math.hypot(ox, oz), cap = 0.5 * st.stride * 1.05;
          if (ol > cap) { ox *= cap / ol; oz *= cap / ol; }
          f.to.x += ox; f.to.z += oz;
          f.to.addScaledVector(_rt, f.side * f.jw * sstep(0.2, 0.6, st.speed));
          if (f.side * st.hdgRate > 0) f.to.addScaledVector(_rt, f.side * 0.03 * sstep(0.7, 1.2, Math.abs(st.hdgRate)));
          const o2 = FT[1 - a];
          if (!o2.swing || o2.fly) {
            const ddx = f.to.x - o2.plant.x, ddz = f.to.z - o2.plant.z, dd = Math.hypot(ddx, ddz), mx = Math.max(0.6, 0.55 * st.stride + 0.08);
            if (dd > mx) { f.to.x = o2.plant.x + (ddx * mx) / dd; f.to.z = o2.plant.z + (ddz * mx) / dd; }
            if (f.cls) { const t0 = (f.to.x - _home.x) * _fw.x + (f.to.z - _home.z) * _fw.z; f.to.addScaledVector(_fw, clamp((o2.plant.x - _home.x) * _fw.x + (o2.plant.z - _home.z) * _fw.z, -0.12, 0.12) - t0); }
          }
          _v6.setFromMatrixPosition(Mm[a ? BI.thighL : BI.thighR]).applyMatrix4(F.mG).addScaledVector(MOT.vS, tl);
          const rch = legD(10) + HEEL.y + 0.01, fx = f.to.x, fz = f.to.z;
          if (!o2.swing && o2.plant.y - floorAt(s, fx, fz, o2.plant.y) > 0.1 && Math.hypot(fx - _v6.x, floorAt(s, fx, fz, _v6.y - 1) - _v6.y, fz - _v6.z) > rch) {
            let lo = 0, hi = 1;
            for (let i = 0; i < 7; i++) {
              const m = 0.5 * (lo + hi), x = lerp(_v6.x, fx, m), z = lerp(_v6.z, fz, m);
              if (Math.hypot(x - _v6.x, floorAt(s, x, z, _v6.y - 1) - _v6.y, z - _v6.z) > rch) hi = m; else lo = m;
            }
            f.to.x = lerp(_v6.x, fx, lo); f.to.z = lerp(_v6.z, fz, lo);
          }
        }
        f.to.y = floorAt(s, f.to.x, f.to.z, MOT.p.y - 0.95);
        if (f.wk && !clbOn && !SUP) {
          if (!Number.isFinite(f.fcD) && sN >= 0.3) { f.fcD = faceOff(s, f.to); f.fcL = (f.to.x * _fw.x + f.to.z * _fw.z) + f.fcD; }
          if (f.fcD) {
            const c = f.to.x * _fw.x + f.to.z * _fw.z, w = f.fcD < 0 ? Math.max(Math.min(c, f.fcL), c + f.fcD - 0.06) : Math.min(Math.max(c, f.fcL), c + f.fcD + 0.06);
            f.to.addScaledVector(_fw, (w - c) * sstep(0.3, 0.6, sN)); f.to.y = floorAt(s, f.to.x, f.to.z, MOT.p.y - 0.95);
          }
        }
        let hx0 = 0, hy0 = 0, hz0 = 0, bhF = 0;
        if (f.clb) {
          _v6.setFromMatrixPosition(Mm[a ? BI.thighL : BI.thighR]).applyMatrix4(F.mG);
          hx0 = _v6.x; hy0 = _v6.y + Math.max(0, MOT.vyP, MOT.vS.y) * 2 * dt; hz0 = _v6.z;
          bhF = -((f.from.x - hx0) * _fw.x + (f.from.z - hz0) * _fw.z);
        }
        const e = f.wk ? swingE(sN) : f.clb ? lerp(sstep(0.3, 1, sN), sstep(0, 0.95, sN), sstep(0.05, 0.25, bhF)) : sstep(0, 1, sN);
        f.cur.lerpVectors(f.from, f.to, e);
        const rise = f.to.y - f.plant.y - f.gx * (f.to.x - f.plant.x) - f.gz * (f.to.z - f.plant.z);
        const up = Math.min(0.03, 0.6 * Math.max(0, rise)) * sstep(0.02, 0.05, rise) * sstep(0, 0.25, sN) * (1 - sstep(0.75, 1, sN));
        _v6.lerpVectors(f.cur, f.to, 0.35);
        const gH = Math.max(floorAt(s, f.cur.x, f.cur.z, f.cur.y), floorAt(s, _v6.x, _v6.z, f.cur.y), lerp(f.plant.y, f.to.y, f.to.y > f.plant.y + 0.1 ? sstep(0, 0.55, e) : e) - 0.05);
        if (f.wk) {
          const k = (st.pTO / (52 * DEG)) * (1 - 0.4 * clamp((f.pe - 0.22) / 0.5, 0, 1) * (1 - sstep(0.6, 0.8, sN)));
          f.pitch = (swingAt(1, sN) * k + (f.p0 / DEG - SWING[0][1] * k) * (1 - sstep(0, f.pe, sN)) + ((st.hsP + f.jp) / DEG - SWING[SWING.length - 1][1]) * sstep(0.74, 0.94, sN)) * DEG;
          if (Number.isFinite(f.pk)) f.pitch = f.pk + clamp(f.pitch - f.pk, -6.2 * dt, 6.2 * dt);
        } else {
          const pt = f.p0 * (1 - sstep(0, 0.5, sN)) + (kneelGoal && a === 0 ? -30 : 3) * DEG * sstep(0.55, 1, sN);
          f.pitch = Number.isFinite(f.pk) ? f.pk + clamp(pt - f.pk, -5.8 * dt, 5.8 * dt) : pt;
        }
        const clr = (f.wk ? (swingAt(2, sN) + 0.022 * sstep(0, 0.2, sN) * (1 - sstep(0.5, 1, sN))) * sstep(0, 0.15 + 0.5 * (f.pe - 0.22), sN) * (1 + f.jc) + SINK * sstep(0.55, 0.85, sN) : 0.05 * Math.pow(Math.sin(Math.PI * sN), 0.85)) + up;
        const sp = Math.abs(Math.sin(f.pitch)), wv = f.wk ? sstep(0.4, 0.6, sN) * (1 - sstep(0.85, 0.97, sN)) : 0;
        f.cur.y = gH + ROCK * (sp + (Math.sqrt(sp * sp + 0.0049) - sp) * wv) + clr + f.y0 * (1 - sstep(0, 0.2, sN));
        if (f.clb) f.cur.y = Math.max(f.cur.y, f.from.y + (f.to.y - f.from.y) * sstep(0, 0.5, sN) + 0.08 * sstep(0, 0.4, sN) * (1 - sstep(0.75, 1, sN)));
        if (f.clb && sN < 0.85) {
          const fa = (f.cur.x - hx0) * _fw.x + (f.cur.z - hz0) * _fw.z;
          const cy = hy0 - 0.45 - HEEL.y + (fa > 0 ? 2 * fa : 0.5 * fa) + 1.5 * sstep(0.6, 0.85, sN);
          if (f.cur.y > cy) f.cur.y = Math.max(cy, floorAt(s, f.cur.x, f.cur.z, f.cur.y) + 0.03);
          const rch = legD(22) + HEEL.y, hd = Math.hypot(f.cur.x - hx0, f.cur.y - hy0, f.cur.z - hz0);
          if (hd > rch && fa < 0.1) {
            const qx = hx0 + 0.15 * _fw.x, qy = hy0 - 0.5, qz = hz0 + 0.15 * _fw.z;
            let lo = 0, hi = 1;
            for (let i = 0; i < 8; i++) { const m = 0.5 * (lo + hi); if (Math.hypot(lerp(f.cur.x, qx, m) - hx0, lerp(f.cur.y, qy, m) - hy0, lerp(f.cur.z, qz, m) - hz0) > rch) lo = m; else hi = m; }
            const k = hi * (1 - sstep(0.45, 0.8, sN));
            f.cur.x += (qx - f.cur.x) * k; f.cur.y += (qy - f.cur.y) * k; f.cur.z += (qz - f.cur.z) * k;
            f.cur.y = Math.max(f.cur.y, floorAt(s, f.cur.x, f.cur.z, f.cur.y) + 0.03);
          }
        }
        if (f.wk) { const b = sstep(0.8, 1, sN); if (b > 0) f.cur.lerp(_v6.copy(f.to).add(rock(f, f.pitch, _rk)).addScaledVector(_Y, SINK), b); }
        const yS = f.cur.y, dn = (1.5 + 1.5 * Math.max(0, -MOT.vS.y)) * dt;
        if (f.cur.y < f.cy0 - dn) f.cur.y = f.cy0 - dn;
        else if (f.cur.y > f.cy0 + 2.4 * dt) f.cur.y = f.cy0 + 2.4 * dt;
        f.cy0 = f.cur.y;
        f.yaw += dyaw * (1 - Math.exp(-dt * 11));
        const gp = f.to.y - f.cur.y, hold = sN >= 1 && gp > 0.03 && gp < 0.45;
        f.hT = hold ? (f.hT || 0) + dt : 0;
        if (sN >= 1 && f.cur.y < yS + 0.015 && (!hold || f.hT > 0.25) && (!(f.wk || (kneelGoal && a === 0)) || rig.LEG[a].reach < 1.003 || f.swT > f.swDur + 0.25) && (Math.abs(f.kLag || 0) < 0.07 || f.swT > f.swDur + 0.25 || rig.LEG[1 - a].reach > 1.0)) {
          landStep(a, f, f.wk ? 0.35 + 0.65 * st.speedK : 0.3);
          if (walking) { const e = (a ? 0.5 : 0) - st.phase; st.phaseErr = e - Math.round(e); }
          if (f.wk) st.stepN = Math.min(9, st.stepN + 1);
        }
      }
      f.lastPsi = psi;
      if (f.extW > 1e-3) f.cur.lerp(f.ext, f.extW);
      if (a === 0) st.kneelPrep = kneelGoal && !f.swing && Math.hypot(f.plant.x - _home.x, f.plant.z - _home.z) < 0.1 ? 1 : 0;
      if (!SUP && typeof s.floor === 'function') {
        if (f.swing || F.snap || f.rel > 0.01) {
          const sN = f.swing ? clamp(f.swT / f.swDur, 0, 1) : 1;
          soleOn(s, f, _v7);
          if (f.swing) _v7.lerp(_Y, 0.6 * Math.sin(Math.PI * Math.min(1, sN / 0.8))).normalize();
          const gM = f.swing && f.wk && Number.isFinite(f.pk) ? clamp(7.2 * dt - Math.abs(f.pitch - f.pk), 1 * dt, 5.2 * dt) : 5.2 * dt;
          const gk = F.snap ? 1 : 1 - Math.exp(-dt * (12 + 36 * sstep(0.5, 0.85, sN))), gA = f.gn.angleTo(_v7);
          f.gn.lerp(_v7, !F.snap && gA * gk > gM ? gM / gA : gk).normalize();
        }
      } else f.gn.set(0, 1, 0);
      if (a === 0 && st.kneeToeOn && !f.swing && !(kneelW > 1e-3 && !SUP && f.extW < 1e-3)) unkneel(f);
      _e1.set(f.pitch, f.yaw, 0, 'YXZ');
      _fq.setFromEuler(_e1);
      if (SUP) { _sup.set(0, 1, 0).applyQuaternion(_sq); _q1.setFromUnitVectors(_Y, _sup); _fq.premultiply(_q1); }
      else { _q1.setFromUnitVectors(_Y, f.gn); _fq.premultiply(_q1); }
      _ank.copy(HEEL).applyQuaternion(_fq).add(f.cur);
      const kneeling = a === 0 && kneelW > 1e-3 && !f.swing && !SUP && f.extW < 1e-3;
      if (kneeling) kneelLeg(s, sstep(0.3, 0.9, kneelW), f);
      _ank.applyMatrix4(F.mInv);
      _fqm.copy(F.qGi).multiply(_fq);
      const kw = SUP ? 0 : sstep(0, 0.3, kneelW);
      let ky = Math.atan2(Math.sin(f.yaw - heading), Math.cos(f.yaw - heading));
      ky = heading + f.side * clamp(ky * f.side, -0.8, 0.45) * (1 - kw);
      _pole.set(Math.cos(ky), 0, -Math.sin(ky)).applyQuaternion(F.qGi);
      let W = a === 0 ? Math.max(pw * (1 - sstep(0.3, 0.9, kneelW)), sp0) : Math.max(pw, kneelW > 1e-3 && !SUP ? 1 : 0, sp1);
      W = Math.max(W * (1 - f.rel), f.extW);
      if (kneeling) W = Math.max(W, 1 - f.rel);
      if (landing && !f.swing) W = Math.max(W, sstep(0, 0.08, st.lt) * (1 - f.rel));
      const L = LS_[a];
      L.ank.copy(_ank); L.fqm.copy(_fqm); L.pole.copy(_pole); L.W = W; L.kn = kneeling; L.psi = psi; L.pb = 0.02 * f.side * (1 - kw);
      L.fw.set(-Math.sin(ky), 0, -Math.cos(ky)).applyQuaternion(F.qGi);
    }
    const both = FT[0].init && FT[1].init && !FT[0].swing && !FT[1].swing && st.speed < 0.1 && !kneelGoal && kneelW < 0.05 && !SUP && deckS < 0.5;
    const fa = both ? Math.abs((FT[0].plant.x - FT[1].plant.x) * _fw.x + (FT[0].plant.z - FT[1].plant.z) * _fw.z) : 1;
    const srT = both && fa < 0.15 ? clamp(Math.atan2(FT[0].plant.y - FT[1].plant.y, 0.19) / DEG, -12, 12) : 0;
    st.sroll = F.snap || !Number.isFinite(st.sroll) ? srT : st.sroll + (srT - st.sroll) * (1 - Math.exp(-dt * 6));
    st.lag = 0;
    for (let a = 0; a < 2; a++) {
      const f = FT[a];
      if (!f.swing) st.lag = Math.max(st.lag, -((f.plant.x - MOT.p.x) * _fw.x + (f.plant.z - MOT.p.z) * _fw.z));
    }
    carry(walking, pw, kneelW, D);
    for (let a = 0; a < 2; a++) {
      const L = LS_[a];
      _hp.setFromMatrixPosition(Mm[a ? BI.thighL : BI.thighR]);
      const d0 = _hp.distanceTo(L.ank), d = clamp(d0, 0.2, (LT + LS) * 0.9985);
      let k = Math.acos(clamp((d * d - LT * LT - LS * LS) / (2 * LT * LS), -1, 1)) - KNEE_OFF;
      const sw = FT[a].swing, ko = (sw && FT[a].swT >= 0.7 * FT[a].swDur && !(kneelGoal && a === 0) ? 8.2 : 6.8) * dt, kMx = (FT[a].clb ? 138 : 120) * DEG;
      if (L.kn && L.W > 0.5 && !F.snap && Number.isFinite(L.kP) && Math.abs(k - L.kP) > 6.8 * dt) {
        _kT.copy(_hp).applyMatrix4(F.mG);
        const kOf = (x) => { const dd = clamp(_kT.distanceTo(kneeAnk(x, _kA)), 0.2, (LT + LS) * 0.9985); return Math.acos(clamp((dd * dd - LT * LT - LS * LS) / (2 * LT * LS), -1, 1)) - KNEE_OFF; };
        const kc = L.kP + clamp(k - L.kP, -6.8 * dt, 6.8 * dt), s0 = kOf(st.kneeX) - kc;
        let lo = st.kneeX, hi = st.kneeXg;
        for (let i = 0; i < 10; i++) { const m = 0.5 * (lo + hi); if ((kOf(m) - kc) * s0 > 0) lo = m; else hi = m; }
        st.kneeXg = 0.5 * (lo + hi);
        kneeAnk(st.kneeXg, L.ank).applyMatrix4(F.mInv);
        L.fqm.copy(F.qGi).multiply(kneeRot(st.kneeXg, _kq));
        k = kOf(st.kneeXg);
      } else if (sw && L.W > 0.5 && !F.snap && ((Number.isFinite(L.kP) && (k > L.kP + 6.8 * dt || k < L.kP - ko)) || k > kMx)) {
        const kD = k;
        k = Math.min(Number.isFinite(L.kP) ? L.kP + clamp(k - L.kP, -ko, 6.8 * dt) : k, kMx);
        L.ank.sub(_hp).multiplyScalar(legD(k / DEG) / d0).add(_hp);
        FT[a].kLag = kD - k;
      } else FT[a].kLag = 0;
      if (L.kn) st.kneeX = st.kneeXg;
      L.kP = L.W > 0.5 ? k : NaN;
      if (!L.adir) { L.adir = new V3(); L.adOk = false; }
      const dl = _hp.distanceTo(L.ank);
      if (dl > 1e-4) {
        _hk.subVectors(L.ank, _hp).divideScalar(dl);
        if (FT[a].swing && L.adOk && L.W > 0.5 && !F.snap && dt > 1e-4) {
          const c = clamp(_hk.dot(L.adir), -1, 1), an = Math.acos(c), mA = 0.245 * dt * 60;
          if (an > mA) {
            _v7.copy(_hk).addScaledVector(L.adir, -c);
            if (_v7.lengthSq() > 1e-10) { _v7.normalize(); _hk.copy(L.adir).multiplyScalar(Math.cos(mA)).addScaledVector(_v7, Math.sin(mA)); L.ank.copy(_hp).addScaledVector(_hk, dl); }
          }
        }
        L.adir.copy(_hk); L.adOk = L.W > 0.5;
      }
    }
    for (let a = 0; a < 2; a++) {
      const L = LS_[a];
      _hp.setFromMatrixPosition(Mm[a ? BI.thighL : BI.thighR]);
      _hk.subVectors(L.ank, _hp).normalize();
      _pole.crossVectors(L.pole, _hk).addScaledVector(L.pole, L.pb).addScaledVector(L.fw, 0.1);
      FT[a].pk = FT[a].pitch; rig.solveLeg(a, L.ank, _pole, L.fqm, L.W);
    }
    rig.fkAll();
    st.footGap = Math.min(FT[0].cur.y, FT[1].cur.y) - st.floorC;
    if (kneelW > 0.9 && st.kneelWas <= 0.9) { EV.knee = 1; EV.kneeP.setFromMatrixPosition(Mm[BI.shinR]).applyMatrix4(F.mG); }
    st.kneelWas = kneelW;
  }

  const _pr = new V3(), _pu = new V3(), _pq2 = new THREE.Quaternion();
  function perchFeet(s, W) {
    if (st.dive && !st.divePerch) return;
    const sp = s.support && s.support.isObject3D ? s.support : null, ds = sp && sp.userData ? sp.userData.diverSpot : null;
    if (!ds || !ds.rungs || !ds.rungs.length) return;
    sp.updateWorldMatrix(true, false);
    sp.getWorldQuaternion(_pq2);
    _pu.set(0, 1, 0).applyQuaternion(_pq2);
    _v1.setFromMatrixPosition(Mm[BI.thighR]).applyMatrix4(F.mG);
    let best = 0, bd = 1e9;
    for (let k = 0; k < ds.rungs.length; k++) {
      _pr.copy(ds.rungs[k]).applyMatrix4(sp.matrixWorld).addScaledVector(_pu, 0.1);
      const d = Math.abs(_pr.distanceTo(_v1) - 0.62);
      if (d < bd) { bd = d; best = k; }
    }
    _pr.copy(ds.rungs[best]).applyMatrix4(sp.matrixWorld);
    _fw.set(0, 0, -1).applyQuaternion(F.qG); _fw.y = 0;
    if (_fw.lengthSq() < 1e-6) _fw.set(0, 0, -1);
    _fw.normalize();
    _rt.set(-_fw.z, 0, _fw.x);
    const heading = Math.atan2(-_fw.x, -_fw.z);
    for (let a = 0; a < 2; a++) {
      const side = a ? -1 : 1;
      _ank.copy(_pr).addScaledVector(_rt, side * 0.1).addScaledVector(_fw, 0.02).addScaledVector(_pu, 0.1);
      _ank.applyMatrix4(F.mInv);
      _e1.set(-8 * DEG, heading + side * 0.12, 0, 'YXZ');
      _fq.setFromEuler(_e1);
      _fqm.copy(F.qGi).multiply(_fq);
      _pole.copy(_fw).applyQuaternion(F.qGi);
      rig.solveLeg(a, _ank, _pole, _fqm, a === 0 ? W * (1 - (st.perchGo || 0)) : st.dive ? W * (1 - sstep(0.12, 0.55, st.perchGo || 0)) : W);
    }
    rig.fkAll();
  }
  const LEG_APART_ANK = 0.15, LEG_APART_KNEE = 0.18;
  const _la = new V3(), _lb = new V3(), _lx = new V3(), _lo = new V3(), _lr = new V3(), _lk = new V3(), _lax = new V3(), _laq = new THREE.Quaternion();
  function legsApart() {
    const wF = (1 - st.plantWS) * (1 - we[PI_.kneel]) * (1 - we[PI_.perch]) * (1 - we[PI_.climb]);
    if (wF < 1e-3) return;
    _lx.setFromMatrixColumn(Mm[BI.pelvis], 0).normalize();
    for (let it = 0; it < 2; it++) {
      _la.setFromMatrixPosition(Mm[BI.footR]); _lb.setFromMatrixPosition(Mm[BI.footL]);
      const gA = LEG_APART_ANK - _la.sub(_lb).dot(_lx);
      _la.setFromMatrixPosition(Mm[BI.shinR]); _lb.setFromMatrixPosition(Mm[BI.shinL]);
      const gK = LEG_APART_KNEE - _la.sub(_lb).dot(_lx);
      if (gA < 1e-4 && gK < 1e-4) return;
      for (let a = 0; a < 2; a++) {
        const S = SIDES[a], th = BI['thigh' + S];
        _lo.copy(_lx).multiplyScalar(a ? -1 : 1);
        _la.setFromMatrixPosition(Mm[th]);
        _lr.setFromMatrixPosition(Mm[BI['foot' + S]]).sub(_la);
        _lk.setFromMatrixPosition(Mm[BI['shin' + S]]).sub(_la);
        _lax.crossVectors(_lr, _lo);
        const lev = _lax.length();
        if (lev < 0.05) continue;
        _lax.divideScalar(lev);
        const levK = _lb.crossVectors(_lk, _lo).dot(_lax);
        const ang = Math.min(0.35, Math.max(gA > 0 ? 0.5 * gA / lev : 0, gK > 0 && levK > 0.05 ? 0.5 * gK / levK : 0)) * wF;
        if (ang < 1e-5) continue;
        rig.applyModelRot(th, _laq.setFromAxisAngle(_lax, ang));
        rig.fkFrom(th);
        rig.eulerNear(Qf[th], EB, th * 3, EB, th * 3);
      }
    }
  }
  const knifeTopL = new V3(...KIT.knifeTop).applyMatrix4(BINDM.inv[BI.knife]);
  const inletC = new V3(...HELM.inlet).applyMatrix4(BINDM.inv[BI.cors]);
  const spitL = new V3(...HELM.spitcock).applyMatrix4(BINDM.inv[BI.cors]);
  const frontCL = new V3(...HELM.frontCenter).applyMatrix4(BINDM.inv[BI.plate]);
  const rimTouchL = [new V3(...corsAt(0.55, 0.97)).applyMatrix4(BINDM.inv[BI.cors]), new V3(...corsAt(-0.55, 0.97)).applyMatrix4(BINDM.inv[BI.cors])];
  const H_HANG = 0, H_KNIFE = 1, H_ROPE = 3, H_PLATE = 4, H_THIGH = 5, H_RAIL = 6;
  const HOLD_R = [H_HANG], HOLD_L = [H_HANG];
  function holdTarget(a, k, R, s) {
    const sg = a ? -1 : 1, lung = 0.004 * st.lung;
    _m1.extractRotation(Mm[BI.cors]);
    switch (k) {
      case H_KNIFE:
        R.rtm.copy(knifeTopL).applyMatrix4(Mm[BI.knife]).add(_v2.set(-0.012, 0.03, -0.01));
        R.rpalm.set(-0.3, -1, 0.2).normalize(); R.restGrip = 0.55; return 0.8;
      case H_ROPE:
        R.rtm.set(sg * 0.075, 0.07 + lung, -0.035).applyMatrix4(Mm[BI.wF]);
        R.rpalm.set(-sg * 0.3, 0, 1).applyMatrix4(_m1).normalize(); R.restGrip = 0.6; return 0.8;
      case H_PLATE:
        R.rtm.set(sg * 0.035, -0.045 + lung, -0.055).applyMatrix4(Mm[BI.wF]);
        R.rpalm.set(0, 0, 1).applyMatrix4(_m1).normalize(); R.restGrip = 0.25; return 0.75;
      case H_THIGH: {
        const Sd = a ? 'L' : 'R';
        _v2.setFromMatrixPosition(Mm[BI['thigh' + Sd]]); _v3.setFromMatrixPosition(Mm[BI['shin' + Sd]]);
        R.rtm.lerpVectors(_v2, _v3, 0.55).add(_v4.set(sg * 0.015, 0, -0.085));
        R.rpalm.set(-sg * 0.25, -0.1, 1).normalize(); R.restGrip = 0.3; return 0.8;
      }
      case H_RAIL:
        if (s.hold && Number.isFinite(s.hold.x)) { R.rtm.copy(s.hold).applyMatrix4(F.mInv); R.rpalm.set(0, -1, 0); R.restGrip = 0.95; return 0.9; }
        return 0;
      default: return 0;
    }
  }
  const TUG_DIR = new V3(-0.3, 0.25, -0.92).normalize(), TUG_R0 = 0.4, TUG_BOW = 0.2, _tga = new V3(), _tgb = new V3();
  function tugArc(a, b, s, out) {
    const la = a.length(), lb = b.length(), s1 = 1 - s, A = s1 * s1, B = 2 * s * s1, C = s * s;
    _tga.copy(a).divideScalar(la > 1e-6 ? la : 1); _tgb.copy(b).divideScalar(lb > 1e-6 ? lb : 1);
    out.set(A * _tga.x + B * TUG_DIR.x + C * _tgb.x, A * _tga.y + B * TUG_DIR.y + C * _tgb.y, A * _tga.z + B * TUG_DIR.z + C * _tgb.z);
    const l = out.length();
    return l > 1e-6 ? out.multiplyScalar(Math.max(TUG_R0, lerp(la, lb, s) - TUG_BOW * B) / l) : out.copy(b);
  }
  function hoseAtK(X, kf, out) {
    const k0 = Math.floor(kf), f = kf - k0, a = k0 * 3, b = a + 3;
    return out.set(X[a] + (X[b] - X[a]) * f, X[a + 1] + (X[b + 1] - X[a + 1]) * f, X[a + 2] + (X[b + 2] - X[a + 2]) * f).applyMatrix4(F.mInv);
  }
  function hosePreK(R0, kf) { const k0 = Math.floor(kf); return lerp(R0.pre[k0], R0.pre[k0 + 1], kf - k0); }
  function tugReach() {
    const R0 = TT.ROPES[0];
    st.tgK = -1;
    if (!R0.on || !R0.init) return;
    _v1.setFromMatrixPosition(Mm[BI.uarmL]);
    _m3.extractRotation(Mm[BI.chest]).transpose();
    const X = R0.X;
    for (let k = 7; k >= 3; k -= 0.25) {
      hoseAtK(X, k, _v2);
      _v3.copy(_v2).sub(_v1).applyMatrix4(_m3);
      if (_v3.y > 0.1 && _v3.z < TUG_BACK + TUG_BACK_UP * _v3.y && _v3.x < TUG_IN && _v3.length() < TUG_REACH) { st.tgK = k; return; }
    }
  }
  let _hoseK = -1;
  function hoseNear(p) {
    const R0 = TT.ROPES[0];
    _hoseK = -1;
    if (!R0.on || !R0.init) return Infinity;
    const X = R0.X;
    let best = Infinity;
    for (let k = 3; k < 18; k++) {
      _v7.set(X[k * 3], X[k * 3 + 1], X[k * 3 + 2]).applyMatrix4(F.mInv);
      const d = _v7.distanceTo(p);
      if (d < best) { best = d; _hoseK = k; }
    }
    return best;
  }
  const _kx = new V3(), _kp = new V3(), _ku = new V3();
  const kneeOut = () => { _ku.setFromMatrixColumn(Mm[BI.cors], 1).normalize().applyQuaternion(rig.turnQ); return sstep(0.55, 0.95, Math.acos(clamp(_ku.y, -1, 1))); };
  function arms(s) {
    const t = st.t, dt = st.dt;
    const RR = RCH[0], RLf = RCH[1];
    const standW = we[PI_.stand] + we[PI_.deck] + we[PI_.crank] * 0.3;
    const sinkW = we[PI_.sink] * (st.hasFloor ? sstep(0.9, 1.8, st.gapS) : 1) * (1 - CTX.hop), presW = we[PI_.present], stW = we[PI_.step];
    for (let a = 0; a < 2; a++) {
      st.holdT[a] += dt;
      if (st.holdT[a] >= st.holdDur[a] && t - st.holdSw > 1) {
        const L = a ? HOLD_L : HOLD_R;
        let k = L[Math.floor(rand() * L.length)];
        if (k === st.holdK[a]) k = L[(L.indexOf(k) + 2) % L.length];
        st.holdK[a] = k; st.holdT[a] = 0; st.holdDur[a] = 3 + 6 * Math.pow(rand(), 1.5); st.holdSw = t;
      }
    }
    let kR = st.holdK[0], kL = st.holdK[1];
    if (SUP && s.hold) { _v7.set(0, 1, 0).applyQuaternion(_sq); if (_v7.y < Math.cos(6 * DEG)) kL = H_RAIL; }
    if (st.recoverT > 0) kR = kL = H_THIGH;
    st.holdNow[0] = kR; st.holdNow[1] = kL;
    let wR = standW * holdTarget(0, kR, RR, s), wL = standW * holdTarget(1, kL, RLf, s);
    RR.restGrip = lerp(0.12, RR.restGrip, 1 - sstep(0.03, 0.12, RR.ts.distanceTo(RR.rtm)));
    RLf.restGrip = lerp(0.12, RLf.restGrip, 1 - sstep(0.03, 0.12, RLf.ts.distanceTo(RLf.rtm)));
    if (sinkW > 1e-3 && !(s.dive && !s.dive.perch)) {
      _v4.set(0.12, 0.98, -0.08);
      if (TT.ROPES[0].on && TT.ROPES[0].init) {
        TT.pointAt(0, 0.42, _v5).applyMatrix4(F.mInv);
        const dx = _v5.x - 0.17, dy = _v5.y - 0.46, dl = Math.hypot(dx, dy, _v5.z);
        const zB = SINK_BACK + SINK_BACK_UP * Math.max(0, dy);
        _v4.lerp(_v5, sstep(0.2, 0.35, dy) * (1 - sstep(0.5, 0.56, dl)) * (1 - sstep(zB - 0.06, zB, _v5.z)));
      }
      RR.rtm.lerp(_v4, sinkW);
      RR.rpalm.lerp(_v5.set(-1, 0, 0.2).normalize(), sinkW).normalize();
      RR.restGrip = lerp(RR.restGrip, 1, sinkW);
      wR = Math.max(wR, sinkW);
    }
    if (presW > 1e-3) {
      _v4.set(0.055, 0.29, -0.36); _v5.set(-0.06, 0.27, -0.34);
      RR.rtm.lerp(_v4, presW); RLf.rtm.lerp(_v5, presW);
      RR.rpalm.lerp(_v6.set(-0.4, 0.8, 0), presW).normalize(); RLf.rpalm.lerp(_v6.set(0.4, 0.8, 0), presW).normalize();
      RR.restGrip = lerp(RR.restGrip, 0.5, presW); RLf.restGrip = lerp(RLf.restGrip, 0.5, presW);
      wR = Math.max(wR, presW); wL = Math.max(wL, presW);
    }
    if (stW > 1e-3 && CTX.u < 0 && s.hold && Number.isFinite(s.hold.x)) {
      RR.rtm.copy(s.hold).applyMatrix4(F.mInv); RR.rpalm.set(0, -1, 0); RR.restGrip = 0.95;
      wR = Math.max(wR, stW);
    }
    RR.gW = 0; RLf.gW = 0; RLf.gPoleW = RLf.gSpd = 0;
    if (we[PI_.crank] > 0.3 && RR.w > 0.5) st.crankHold += dt;
    else if (st.crankHold > 0 && RR.w < 0.1) {
      if (st.crankHold > 4 && st.gKind === 0) { st.gKind = 5; st.gT = 0; st.gDur = 1.5; st.gSide = 0; }
      st.crankHold = 0;
    }
    const quiet = standW > 0.7 && RR.w < 0.05 && RLf.w < 0.05 && !RR.hold && !RLf.hold && st.recoverT <= 0;
    st.still = quiet && st.speed < 0.1 ? st.still + dt : 0;
    if (st.gKind === 0 && t >= st.gNext) {
      st.gNext = t + 4 + 6 * rand();
      if (quiet) {
        const r = rand(), shut = st.plateK < 0.05;
        if (we[PI_.deck] > 0.5) st.gKind = r < 0.3 && st.plateK > 0.5 ? 8 : r < 0.5 ? 4 : r < 0.65 ? 3 : r < 0.8 ? 5 : 7;
        else st.gKind = st.under > 0.5 && st.still > 6 && r < 0.25 ? 1 : r < 0.4 && st.tugN === 0 && st.still > 5 && TT.ROPES[0].on ? 2 : r < 0.55 ? 3 : r < 0.75 ? 4 : r < 0.9 && shut ? 6 : 7;
        st.gT = 0; st.gDur = [1, 2.6, 1.6, 1.1, 2.0, 1.5, 2.2, 1.6, 1.4][st.gKind]; st.gSide = st.gKind === 5 || st.gKind === 8 || st.hh > 0.02 || st.tugN > 0 ? 0 : rand() < 0.5 ? 0 : 1;
        if (st.gKind === 2) { st.tugN = 1; st.tugT = 0; }
      }
    }
    if (st.gKind) {
      st.gT += dt;
      const u = st.gT / st.gDur;
      if (u >= 1 || (!quiet && st.gKind !== 3 && st.gKind !== 5 && st.gKind !== 9)) st.gKind = 0;
      else if (st.gKind === 9) {
        const R = st.gSide ? RLf : RR, env = sstep(0, 0.4, u) * (1 - sstep(0.55, 1, u));
        R.gW = env; R.gGrip = 0.6;
        anchors.exhaust.getWorldPosition(R.gtm).applyMatrix4(F.mInv);
        R.gtm.y += 0.004 * Math.sin(u * 22);
        R.gpalm.copy(helmC).applyMatrix4(Mm[BI.cors]).sub(R.gtm).normalize();
        if (u >= 0.4 && !st.gBurst) { st.gBurst = true; EV.burst += st.gBurstN; }
      } else if (st.gKind === 1) {
        const env = sstep(0, 0.3, u) * (1 - sstep(0.75, 1, u));
        RR.gW = env; RR.gGrip = 0.7;
        RR.gtm.copy(spitL).applyMatrix4(Mm[BI.cors]).add(_v4.set(0.012, -0.012, -0.012 + 0.006 * Math.sin(u * 20)));
        _m1.extractRotation(Mm[BI.cors]);
        RR.gpalm.set(-0.4, 0.3, 0.85).normalize().applyMatrix4(_m1);
        if (u > 0.45 && u < 0.5) st.fogClear = 1;
      } else if (st.gKind === 4 || st.gKind === 7) {
        const R = st.gSide ? RLf : RR, sg = st.gSide ? -1 : 1;
        const env = sstep(0, 0.25, u) * (1 - sstep(0.75, 1, u));
        R.gW = env; R.gGrip = st.gKind === 4 ? 0.95 : 0.35;
        _m1.extractRotation(Mm[BI.cors]);
        if (st.gKind === 4) {
          R.gtm.set(sg * 0.075, 0.06 + 0.02 * sstep(0.35, 0.6, u) - 0.02 * sstep(0.6, 0.8, u), -0.04).applyMatrix4(Mm[BI.wF]);
          R.gpalm.set(-sg * 0.3, 0, 1).applyMatrix4(_m1).normalize();
        } else {
          R.gtm.copy(rimTouchL[st.gSide]).applyMatrix4(Mm[BI.cors]);
          R.gtm.y += 0.006 * Math.sin(u * 18);
          R.gpalm.set(-sg * 0.2, -0.3, 1).applyMatrix4(_m1).normalize();
        }
      } else if (st.gKind === 6) {
        const env = sstep(0, 0.22, u) * (1 - sstep(0.8, 1, u)), ang = u * TAU * 1.5;
        RR.gW = env; RR.gGrip = 0.15;
        _m1.extractRotation(Mm[BI.plate]);
        RR.gtm.copy(frontCL).applyMatrix4(Mm[BI.plate]).add(_v4.set(0.028 * Math.cos(ang), 0.022 * Math.sin(ang), -0.045).applyMatrix4(_m1));
        RR.gpalm.set(0, 0, 1).applyMatrix4(_m1).normalize();
      } else if (st.gKind === 8) {
        const env = sstep(0, 0.25, u) * (1 - sstep(0.75, 1, u));
        RR.gW = env; RR.gGrip = 0.4;
        _v1.setFromMatrixPosition(Mm[BI.head]);
        _m1.extractRotation(Mm[BI.head]);
        RR.gtm.copy(_v1).add(_v4.set(0.05 - 0.1 * sstep(0.3, 0.75, u), 0.075, -0.11).applyMatrix4(_m1));
        RR.gpalm.set(0, 0, 1).applyMatrix4(_m1).normalize();
      }
    }
    if (FP.active && !FP.noHands) {
      const u = FP.t / FP.dur, cl = FP.dir < 0;
      const wS = cl ? sstep(0.0, 0.16, u) * (1 - sstep(0.62, 0.78, u)) : sstep(0.3, 0.42, u) * (1 - sstep(0.86, 1, u));
      const wW = cl ? sstep(0.5, 0.64, u) * (1 - sstep(0.9, 1, u)) : sstep(0.0, 0.1, u) * (1 - sstep(0.34, 0.46, u));
      if (wS > 1e-3) {
        RR.gW = Math.max(RR.gW, wS); RR.gGrip = 0.75;
        RR.gtm.copy(plateFreeL).applyMatrix4(Mm[BI.plate]);
        _v5.copy(helmC).applyMatrix4(Mm[BI.cors]);
        RR.gpalm.subVectors(_v5, RR.gtm).normalize();
      }
      if (wW > 1e-3) {
        const ph = (cl ? (u - 0.64) / 0.26 : u / 0.34) * TAU * 0.9;
        RLf.gW = Math.max(RLf.gW, wW); RLf.gGrip = 0.85;
        _m1.extractRotation(Mm[BI.cors]);
        _v5.set(-0.012 * Math.cos(ph), 0.012 * Math.sin(ph), -4e-3).applyMatrix4(_m1);
        RLf.gtm.copy(wingL).applyMatrix4(Mm[BI.cors]).add(_v5);
        RLf.gpalm.set(0.6, 0, 0.8).applyMatrix4(_m1).normalize();
      }
    }
    st.tugG = 0;
    const upright = st.under > 0.5 && !st.dive && st.grounded && we[PI_.walk] + we[PI_.stand] + we[PI_.land] > 0.5 && RLf.w < 0.05 && !RLf.hold;
    let tugOn = false;
    if (st.tugN > 0) {
      if (st.tugT === 0) {
        st.tugUp = st.under > 0.5 && !st.dive;
        st.tgK = -1; st.tgOk = false; st.tgE = false; st.tgJt = 9; st.tgL = false;
        if (st.tugUp && RLf.w < 0.05 && !RLf.hold) {
          tugReach();
          if (st.tgK >= 0) st.hhOn = false;
          _m3.extractRotation(Mm[BI.chest]).transpose();
          _v1.setFromMatrixPosition(Mm[BI.uarmL]);
          st.tgR.copy(ANCH[1]).applyMatrix4(Mm[BI.handL]).sub(_v1).applyMatrix4(_m3);
          st.tgQ.copy(st.tgR);
        }
      }
      st.tugT += dt;
      const up = st.tugUp, u0 = up ? 1.2 : 0.4, u = st.tugT, pe = u0 + st.tugN * 0.5, endT = pe + (up ? 1.5 : 0.3), k = (u - u0) / 0.5, x = k % 1;
      const pull = k > 0 && k < st.tugN ? (up ? (x < 0.4 ? sstep(0, 0.4, x) : 1 - sstep(0.4, 1, x)) : Math.sin(Math.PI * x) ** 2) : 0;
      st.tugPull = up ? 0 : pull;
      if (up) {
        if (st.tgK < 0) { st.tugN = 0; st.tugT = 0; st.tugNx = 0; }
        else {
          const R0 = TT.ROPES[0], X = R0.X, g0 = RLf.gW;
          let uu = u;
          const env = sstep(0, 0.45, uu) * (1 - sstep(endT - 0.35, endT, uu));
          _m1.extractRotation(Mm[BI.chest]); _m3.copy(_m1).transpose();
          _v1.setFromMatrixPosition(Mm[BI.uarmL]);
          hoseAtK(X, st.tgK, _v2);
          _v4.copy(_v2).sub(_v1).applyMatrix4(_m3);
          if (!st.tgOk && !st.tgL && uu < pe) {
            const zB = TUG_BACK + TUG_BACK_UP * Math.max(0, _v4.y);
            if (_v4.z > zB + 0.05 || _v4.x > TUG_IN + 0.05 || _v4.y < 0.05 || _v4.length() > TUG_REACH + 0.06) {
              const k0 = st.tgK;
              st.tgJ.copy(_v4); st.tgJt = 0;
              tugReach();
              if (st.tgK < 0) { st.tgK = k0; st.tgL = true; st.tgH.copy(st.tgJ); st.tgJt = 9; }
              _m3.copy(_m1).transpose();
              _v1.setFromMatrixPosition(Mm[BI.uarmL]);
              hoseAtK(X, st.tgK, _v2);
              _v4.copy(_v2).sub(_v1).applyMatrix4(_m3);
            }
          }
          _v3.copy(ANCH[1]).applyMatrix4(Mm[BI.handL]);
          if (!st.tgOk && uu < pe) {
            st.tgJt += dt;
            _v7.copy(st.tgL ? st.tgH : _v4).lerp(st.tgJ, 1 - sstep(0, 0.3, st.tgJt));
            tugArc(st.tgR, _v7, sstep(0.05, u0 - 0.1, uu), _v7);
            st.tgQ.copy(_v7);
            RLf.gtm.copy(_v7).applyMatrix4(_m1).add(_v1);
            if (!st.tgL && uu >= u0 - 0.15 && _v3.distanceTo(_v2) < 0.07) {
              st.tgOk = true;
              st.tgD = 0;
              st.tgP.copy(_v3).sub(_v1).applyMatrix4(_m3);
              st.tgH.copy(st.tgQ);
            } else if (uu >= (st.tgL ? u0 - 0.1 : u0 + 0.3)) st.tugT = uu = pe;
          } else if (uu < pe) {
            st.tgD = Math.min(1, st.tgD + dt / 0.2);
            _v7.copy(st.tgP).add(_v5.set(0.01, -0.08, -0.02).multiplyScalar(pull)).lerp(st.tgH, 1 - sstep(0, 1, st.tgD));
            st.tgQ.copy(_v7);
            RLf.gtm.copy(_v7).applyMatrix4(_m1).add(_v1);
          }
          RLf.gpalm.set(_v2.x - _v1.x, 0, _v2.z - _v1.z);
          if (RLf.gpalm.lengthSq() < 1e-6) RLf.gpalm.set(1, 0, 0);
          RLf.gpalm.normalize();
          let dn = 0;
          if (uu >= pe) {
            if (!st.tgE) { st.tgE = true; st.tgP.copy(st.tgQ); }
            dn = sstep(pe + 0.05, endT - 0.4, uu);
            tugArc(st.tgP, st.tgR, dn, _v7);
            RLf.gtm.copy(_v7).applyMatrix4(_m1).add(_v1);
            RLf.gpalm.lerp(_v5.set(1, 0, -0.2).applyMatrix4(_m1), dn).normalize();
          }
          RLf.gW = Math.max(env, g0 * (1 - sstep(0, 0.45, uu)));
          RLf.gGrip = lerp(0.2, 1, sstep(u0 - 0.2, u0 - 0.04, uu) * (1 - sstep(pe + 0.02, pe + 0.18, uu)));
          RLf.gPole.set(-0.55, -0.3, -0.78).normalize().lerp(_v5.set(-0.55, -0.78, 0.22).normalize(), sstep(0.75, 1, dn)).normalize();
          RLf.gPoleW = env; RLf.gSpd = !st.tgOk && uu < pe ? 0.45 + 1.05 * sstep(0.03, 0.25, _v3.distanceTo(_v2)) : 1.5;
          st.tugG = st.tgOk && uu < pe + 0.06 ? 1 : 0;
          st.tugS = hosePreK(R0, st.tgK);
        }
      } else {
        st.tugG = u > 0.34 && u < endT - 0.24 ? 1 : 0;
        _m1.extractRotation(Mm[BI.chest]);
        _v1.setFromMatrixPosition(Mm[BI.uarmL]);
        RLf.gtm.set(-0.03, -0.12 - 0.09 * pull, -0.24 + 0.02 * pull).applyMatrix4(_m1).add(_v1);
        RLf.gpalm.set(0.75, 0.1, 0.65).applyMatrix4(_m1).normalize();
        RLf.gW = sstep(0, 0.3, u) * (1 - sstep(endT - 0.3, endT, u));
        RLf.gGrip = lerp(0.25, 1, sstep(0.22, 0.36, u) * (1 - sstep(endT - 0.28, endT - 0.12, u)));
        if (u < 0.36) {
          _v2.copy(inletC).applyMatrix4(Mm[BI.cors]);
          _v3.set(-0.05, 0.14, 0.02).applyMatrix4(_m1).add(_v1);
          st.tugS = clamp(1.06 * (_v2.distanceTo(_v3) + _v3.distanceTo(RLf.gtm)), 0.3, 0.9);
        }
      }
      if (u >= endT) { st.tugN = st.tugNx; st.tugNx = 0; st.tugT = 0; st.tugPull = 0; st.tugG = 0; }
    }
    {
      const wlk = upright && we[PI_.walk] > 0.5 && st.walkW > 0.3;
      if (wlk && !st.hhOn && !tugOn && !(st.tugN > 0 && st.tugUp)) {
        const off = st.hhWas < 0.3 && st.walkW >= 0.3 && rand() < 1 / 3, snatch = st.lookUpT > 1.45;
        if (off || snatch || t >= st.hhNext) {
          _m1.extractRotation(Mm[BI.chest]);
          _v1.setFromMatrixPosition(Mm[BI.uarmL]);
          _v2.set(-0.03, -0.12, -0.24).applyMatrix4(_m1).add(_v1);
          if (hoseNear(_v2) < 0.1) { st.hhOn = true; st.hhT = 3 + 5 * rand(); }
          st.hhNext = t + (st.hhOn ? st.hhT : 0) + 20 + 20 * rand();
        }
      }
      if (st.hhOn) {
        st.hhT -= dt;
        const sx = Math.sin(TAU * (st.phase - 0.46 - 0.075 * CTX.v));
        if ((st.hhT <= 0 && (sx < -0.8 || st.hhT < -1)) || !wlk) st.hhOn = false;
      }
      if (!wlk && t >= st.hhNext - 20) st.hhNext = Math.max(st.hhNext, t + 20 * rand());
      st.hhWas = st.walkW;
      const on = st.hhOn || tugOn, wn = on ? 8.5 : 6;
      st.hhV += (wn * wn * ((on ? 1 : 0) - st.hh) - 2 * wn * st.hhV) * dt; st.hh = clamp(st.hh + st.hhV * dt, 0, 1);
      if (st.hh > 0.85 && st.tugG === 0 && RLf.gW < 0.05) {
        const R0 = TT.ROPES[0];
        if (R0.pinOn && R0.pinMode === 1) st.tugG = 1;
        else {
          _v4.copy(ANCH[1]).applyMatrix4(Mm[BI.handL]);
          if (hoseNear(_v4) < 0.04) { st.tugG = 1; st.tugS = R0.pre[_hoseK]; }
        }
      }
    }
    const knW = sstep(0.5, 1, we[PI_.kneel]);
    if (knW > 1e-3 && RLf.gW < 0.05) {
      RLf.gW = knW; RLf.gGrip = 0.5;
      _v4.setFromMatrixPosition(Mm[BI.thighL]);
      RLf.gtm.setFromMatrixPosition(Mm[BI.shinL]).lerp(_v4, 0.18);
      RLf.gtm.y += 0.1;
      RLf.gpalm.set(0, -1, 0).applyQuaternion(F.qGi);
      const ko = kneeOut();
      if (ko > 1e-3) {
        _kx.setFromMatrixColumn(Mm[BI.thighL], 0).normalize();
        _kp.setFromMatrixPosition(Mm[BI.footL]).sub(_v5.setFromMatrixPosition(Mm[BI.shinL]));
        _kp.multiplyScalar(0.22).add(_v5).addScaledVector(_kx, -0.1).lerp(_v4, 0.06);
        RLf.gtm.lerp(_kp, ko);
        RLf.gpalm.lerp(_kx, ko).normalize();
      }
    }
    if (st.gKind === 5) wR *= 1 - Math.sin(Math.PI * clamp(st.gT / st.gDur, 0, 1));
    const hk = sstep(0.02, 0.3, st.hh);
    if (hk > 0) { wL *= 1 - hk; if (!(st.tugN > 0 && st.tugUp && st.tgK >= 0)) RLf.gW *= 1 - hk; }
    st.bowWant = num(s.bow, 0);
    rig.solveArms(wR, wL, st.clamber ? 0.3 : 1, Math.max(lerp(lerp(18, 34, we[PI_.kneel]), 8, we[PI_.crank]), Math.min(clamp(num(s.bow, 0), 0, 90), st.bowCap) * we[PI_.kneel]));
  }

  const _look = new V3();
  function headAndEyes() {
    const yawIn = clamp(LOOK.yaw - LOOK.ty, -0.55, 0.55), pitchIn = clamp(LOOK.pitch - LOOK.tp, -0.4, 0.3);
    let hy = yawIn, hp = pitchIn;
    const IKs = rig.IK;
    const Ro = IKs.a >= 0 ? RCH[1 - IKs.a] : null, both = Ro && Ro.w > 0.5 && Ro.tm.distanceToSquared(RCH[IKs.a].tm) < 0.36 ? 0.5 * sstep(0.5, 1, Ro.w) : 0;
    if (IKs.a >= 0 && IKs.w > 0.05) {
      _v1.setFromMatrixPosition(Mm[BI.head]);
      _v2.copy(RCH[IKs.a].tm).lerp(Ro.tm, both).sub(_v1).normalize();
      _m1.extractRotation(Mm[BI.chest]);
      _q1.setFromRotationMatrix(_m1).invert();
      _v2.applyQuaternion(_q1);
      const W = sstep(0, 1, IKs.w);
      hy = lerp(hy, clamp(Math.atan2(-_v2.x, -_v2.z), -0.55, 0.55), W);
      hp = lerp(hp, clamp(Math.asin(clamp(_v2.y, -1, 1)), -0.45, 0.3), W);
    }
    rig.lookHead(hy, hp, 0.3, 40);
    const cy = Math.cos(LOOK.rawPitch);
    _look.set(-Math.sin(LOOK.rawYaw) * cy, Math.sin(LOOK.rawPitch), -Math.cos(LOOK.rawYaw) * cy);
    if (IKs.a >= 0 && IKs.w > 0.3) { _v1.setFromMatrixPosition(Mm[BI.head]); _look.copy(RCH[IKs.a].tm).lerp(Ro.tm, both).sub(_v1).normalize(); }
    rig.EYE.squint = 0.4 * (1 - st.under) * sstep(0.3, 0.8, st.plateK);
    rig.eyes(_look, st.effort, rand);
    const Pb = Pf[BI.brow], ob = BINDM.offs[BI.brow];
    const raise = 0.0022 * st.effort - 0.0018 * sstep(0.3, 0.8, IKs.w) - 0.0015 * rig.EYE.squint / 0.4;
    Pb.set(ob.x, ob.y + raise, ob.z);
    rig.fkFrom(BI.brow);
  }
  const FP = { active: false, dir: 0, t: 0, dur: 1.3, cb: null, resolve: null, explicit: false, doneQ: false, doneCb: null, doneRes: null, noHands: false };
  const plateFreeL = new V3(-FRONT_FR - 0.006, LIGHT_Y, FRONT_Z + 0.004).applyMatrix4(BINDM.inv[BI.plate]);
  const wingL = new V3(-FRONT_FR - 0.004, LIGHT_Y, FRONT_Z + 0.006).applyMatrix4(BINDM.inv[BI.cors]);
  const helmC = new V3(0, 0.69, HZ).applyMatrix4(BINDM.inv[BI.cors]);
  function startPlate(dir, dur, cb) {
    if (FP.active && FP.resolve) { FP.doneQ = true; FP.doneCb = FP.cb; FP.doneRes = FP.resolve; }
    FP.explicit = true;
    FP.cb = typeof cb === 'function' ? cb : null;
    const p = new Promise((res) => { FP.resolve = res; });
    if ((dir < 0 && st.plateK < 0.01) || (dir > 0 && st.plateK > 0.99)) {
      st.plateT = dir > 0 ? 1 : 0; FP.active = false; FP.doneQ = true; FP.doneCb = FP.cb; FP.doneRes = FP.resolve; FP.cb = null; FP.resolve = null;
      return p;
    }
    FP.active = true; FP.dir = dir; FP.t = 0; FP.dur = clamp(num(dur, 1.3), 0.4, 6); FP.noHands = false;
    st.plateT = dir > 0 ? 1 : 0;
    return p;
  }
  function faceplate() {
    const dt = st.dt;
    if (!FP.explicit && !FP.active) {
      const want = we[PI_.deck] > 0.5 && st.line < -0.5 ? 1 : 0;
      if (want !== st.plateT) {
        if (F.snap || st.first) st.plateT = want;
        else if (want === 0 && st.line < -0.5) { startPlate(-1, 1.1, null); FP.explicit = false; }
        else st.plateT = want;
      }
    }
    if (st.line > -0.2 && st.plateT > 0) { st.plateT = 0; if (FP.active && FP.dir > 0) FP.active = false; }
    if (FP.active && (st.target === PI_.sink || (st.target === PI_.step && CTX.u >= 0) || (!st.grounded && st.line > -0.5))) FP.noHands = true;
    if (FP.active && FP.noHands) {
      st.plateK += clamp(st.plateT - st.plateK, -dt / 0.3, dt / 0.3);
      if (Math.abs(st.plateT - st.plateK) < 1e-3) {
        FP.active = false; FP.noHands = false; st.plateK = st.plateT;
        FP.doneQ = true; FP.doneCb = FP.cb; FP.doneRes = FP.resolve; FP.cb = null; FP.resolve = null;
      }
    } else if (FP.active) {
      FP.t += dt;
      const u = FP.t / FP.dur;
      st.plateK = FP.dir < 0 ? 1 - sstep(0.16, 0.6, u) : sstep(0.38, 0.85, u);
      if (u >= 1) {
        FP.active = false; st.plateK = st.plateT;
        FP.doneQ = true; FP.doneCb = FP.cb; FP.doneRes = FP.resolve; FP.cb = null; FP.resolve = null;
      }
    } else {
      const d = st.plateT - st.plateK;
      st.plateK = F.snap ? st.plateT : st.plateK + clamp(d, -dt / 0.9, dt / 0.9);
    }
    const e = sstep(0, 1, st.plateK);
    const a = -1.9 * e;
    const q = Qf[BI.plate];
    q._x = 0; q._y = Math.sin(a * 0.5); q._z = 0; q._w = Math.cos(a * 0.5);
    rig.fkFrom(BI.plate);
    U.uDvFaceOpen.value = e;
  }

  const PD = [
    { b: BI.wF, pb: BI.cors, L: 0.1, g: 8.9, drag: 3.2, sgn: -1, clunk: 1, plate: true, fa: 15 * DEG, sa: 8 * DEG },
    { b: BI.wB, pb: BI.cors, L: 0.1, g: 8.9, drag: 3.2, sgn: 1, clunk: 1, plate: true, fa: 15 * DEG, sa: 8 * DEG },
    { b: BI.bag, pb: BI.pelvis, L: 0.2, g: 3.6, drag: 0.9, sgn: 0, lat: 1, clunk: 0, fa: 55 * DEG, sa: 14 * DEG },
    { b: BI.knife, pb: BI.pelvis, L: 0.13, g: 5, drag: 9, sgn: 0, lat: -1, clunk: 0, stiff: 30, fa: 8 * DEG, sa: 8 * DEG },
  ].map((d) => Object.assign(d, { X: new V3(), Xp: new V3(), V: new V3(), init: false, hang: new V3(0, -1, 0), fa1: NaN, px1: 0, held: false, pen: 0 }));
  const _pq = new THREE.Quaternion(), _cw = new V3(), _bl = new V3(), _bm = new V3(), _bn = new V3();
  const BAG_RUB = 6, BAG_RUB_AIR = 4, BAG_SHOVE = 1.2, BAG_SHOVE_RING = 0.25, BAG_ARM = 0.4, BAG_JERK = 40;
  const BAG_QUAD = 8, BAG_SQUARE = 1.5;
  const _bP0 = new V3(), _bPp = new V3(), _bpk = new V3(), _bpv = new V3(), _bx0 = new V3(), _bx1 = new V3(), _bpu = new V3();
  const _bq = new THREE.Quaternion(); new THREE.Quaternion(); const _bqT = new THREE.Quaternion();
  let bagP0 = false, bagQ = false;
  const _bj = (b) => new V3().setFromMatrixPosition(BINDM.M[b]);
  const BAG_DENT = [[BI.uarmL, _bj(BI.uarmL), 0.085], [BI.farmL, _bj(BI.farmL), 0.074], [BI.handL, _bj(BI.handL), 0.064], [BI.fM1L, _bj(BI.fM1L), 0.07],
    [BI.fM2L, _bj(BI.fM2L).lerp(_bj(BI.fM1L), -0.8), 0.045],
    [BI.pelvis, _bj(BI.thighL).add(new V3(0, 0.155, 0)), 0.113], [BI.thighL, _bj(BI.thighL), 0.12], [BI.shinL, _bj(BI.shinL), 0.086]];
  const BAG_PRESS = 0.03;
  const BAG_OFF = 0.075, BAG_OUT = 0.03;
  const BAG_PTS = [[-0.17, 0.07], [0, 0.045]].map(([dy, r]) => { const p = new V3(...KIT.bagMouth).applyMatrix4(BINDM.inv[BI.bag]).add(new V3(0, dy, 0)); return { p, m: p.length() / 0.2, r }; });
  const O3 = [0, 0, 0];
  const BAG_CAPS = [[BI.uarmL, O3, BI.farmL, O3, 1, 0.07], [BI.farmL, O3, BI.fM2L, O3, 1, 0.062], [BI.thighL, O3, BI.shinL, O3, 0.3, 0.115],
    [BI.pelvis, [-0.1, 0.03, 0.02], BI.pelvis, [-0.1, -0.12, 0.04], 1, 0.1, true]];
  const PL_PTS = [];
  for (const [y, xs] of [[0.01, [-0.1, -0.05, 0, 0.05, 0.1]], [-0.045, [-0.1, -0.05, 0, 0.05, 0.1]], [-0.1, [-0.075, -0.035, 0, 0.035, 0.075]], [-0.15, [-0.04, 0, 0.04]], [-0.185, [0]]]) for (const x of xs) PL_PTS.push(x, y + 0.036);
  for (let k = 0; k < 14; k++) {
    const a = (k / 14) * TAU, c = Math.sin(a), co = Math.cos(a);
    const x = co >= 0 ? Math.sign(c) * Math.abs(c) ** 0.4 * 0.118 : Math.sign(c) * Math.abs(c) ** 0.75 * 0.118 * (1 + 0.18 * co);
    const y = co >= 0 ? co ** 0.45 * 0.02 : -((-co) ** 1.15) * 0.2;
    PL_PTS.push(x * 0.93, (y + 0.085) * 0.93 - 0.085 + 0.036);
  }
  const PL_R = 0.02, PL_RATE = 4, PL_OUT = 60 * DEG, PL_CAUGHT = 0.05, PL_CLEAR = 0.015, PL_KA = 2.5;
  const PL_LIMB = [];
  for (const S of SIDES) PL_LIMB.push([BI['uarm' + S], BI['farm' + S], 0.07], [BI['farm' + S], BI['hand' + S], 0.062], [BI['hand' + S], BI['fM2' + S], 0.045]);
  const PL_CAP = new Float32Array(PL_LIMB.length * 7), _pa = new V3(), _pb = new V3(), _pc = new V3();
  let plN = 0;
  const PL_M = 0.008, PL_HW = new Float32Array(46);
  for (let k = 0; k < 46; k++) {
    const y = 0.02 - k * 0.005;
    if (y >= 0) { const co = Math.pow(y / 0.02, 1 / 0.45); PL_HW[k] = Math.pow(Math.sqrt(Math.max(0, 1 - co * co)), 0.4) * 0.118; }
    else { const u = Math.min(1, Math.pow(-y / 0.2, 1 / 1.15)); PL_HW[k] = Math.pow(Math.sqrt(Math.max(0, 1 - u * u)), 0.75) * 0.118 * (1 - 0.18 * u); }
  }
  const PLB = (() => {
    const P = body.P, SI = body.SI, SW = body.SW, nv = P.length / 3, seen = new Set(), bo = [], wt = [], lp = [], k = [];
    for (let i = 0; i < nv; i++) {
      const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2], belly = y > -0.1 && y < 0.3 && z < -0.02 && Math.abs(x) < 0.19;
      if (!(belly || (y <= -0.1 && y > -0.36 && z < 0.02))) continue;
      const key = Math.floor(x / 0.03) * 1e6 + Math.floor(y / 0.03) * 1e3 + Math.floor(z / 0.03);
      if (seen.has(key)) continue;
      seen.add(key);
      k.push(belly ? 0.35 : 3);
      for (let j = 0; j < 4; j++) {
        const b = SI[i * 4 + j], w = SW[i * 4 + j];
        bo.push(b); wt.push(w);
        _v1.set(x, y, z).applyMatrix4(BINDM.inv[b]); lp.push(_v1.x, _v1.y, _v1.z);
      }
    }
    return { n: bo.length / 4, bo: Uint16Array.from(bo), wt: Float32Array.from(wt), lp: Float32Array.from(lp), k: Float32Array.from(k), q: new Float32Array(bo.length / 4 * 3), on: new Uint8Array(bo.length / 4) };
  })();
  let plbN = 0;
  const _pinv = new THREE.Matrix4();
  function plateBody(D) {
    _pinv.copy(Mm[D.pb]).invert();
    const o = BINDM.offs[D.b], ie = _pinv.elements, Q = PLB.q, on = PLB.on;
    plbN = 0;
    for (let i = 0; i < PLB.n; i++) {
      let x = 0, y = 0, z = 0;
      for (let j = 0; j < 4; j++) {
        const w = PLB.wt[i * 4 + j];
        if (w < 1e-4) continue;
        const e = Mm[PLB.bo[i * 4 + j]].elements, l = (i * 4 + j) * 3, lx = PLB.lp[l], ly = PLB.lp[l + 1], lz = PLB.lp[l + 2];
        x += w * (e[0] * lx + e[4] * ly + e[8] * lz + e[12]); y += w * (e[1] * lx + e[5] * ly + e[9] * lz + e[13]); z += w * (e[2] * lx + e[6] * ly + e[10] * lz + e[14]);
      }
      const qx = ie[0] * x + ie[4] * y + ie[8] * z + ie[12] - o.x, qy = ie[1] * x + ie[5] * y + ie[9] * z + ie[13] - o.y, qz = ie[2] * x + ie[6] * y + ie[10] * z + ie[14] - o.z;
      on[i] = qx * qx + qy * qy + qz * qz < 0.1 ? 1 : 0;
      if (!on[i]) continue;
      Q[i * 3] = qx; Q[i * 3 + 1] = qy; Q[i * 3 + 2] = qz;
      plbN++;
    }
  }
  function plateCaps(D) {
    _pc.set(0, -0.05, D.sgn * 0.028).add(BINDM.offs[D.b]).applyMatrix4(Mm[D.pb]);
    plN = 0;
    const add = (r) => {
      const dx = _pb.x - _pa.x, dy = _pb.y - _pa.y, dz = _pb.z - _pa.z, l2 = dx * dx + dy * dy + dz * dz;
      const t = l2 > 1e-9 ? clamp(((_pc.x - _pa.x) * dx + (_pc.y - _pa.y) * dy + (_pc.z - _pa.z) * dz) / l2, 0, 1) : 0;
      if (Math.hypot(_pa.x + dx * t - _pc.x, _pa.y + dy * t - _pc.y, _pa.z + dz * t - _pc.z) > r + 0.25) return;
      const o = plN * 7;
      PL_CAP[o] = _pa.x; PL_CAP[o + 1] = _pa.y; PL_CAP[o + 2] = _pa.z; PL_CAP[o + 3] = dx; PL_CAP[o + 4] = dy; PL_CAP[o + 5] = dz; PL_CAP[o + 6] = r;
      plN++;
    };
    for (const [a, b, r] of PL_LIMB) { _pa.setFromMatrixPosition(Mm[a]); _pb.setFromMatrixPosition(Mm[b]); add(r); }
    if (D.sgn < 0) plateBody(D); else plbN = 0;
  }
  function platePen(D, fa, sx) {
    const e = Mm[D.pb].elements, o = BINDM.offs[D.b], c = Math.cos(fa), s = Math.sin(fa), z0 = D.sgn * 0.028;
    let pen = 0;
    if (plbN) {
      const Q = PLB.q, on = PLB.on;
      for (let i = 0; i < PLB.n; i++) {
        if (!on[i]) continue;
        const qx = Q[i * 3] - sx, qy = Q[i * 3 + 1], qz = Q[i * 3 + 2];
        const yl = qy * c - qz * s - 0.036, zl = Math.abs(qy * s + qz * c - z0);
        if (zl > 0.015 + PL_M || yl > 0.02 + PL_M || yl < -0.2 - PL_M) continue;
        const k = clamp(Math.round((0.02 - yl) / 0.005), 0, 45), dx = PL_HW[k] + PL_M - Math.abs(qx);
        if (dx <= 0) continue;
        pen += PLB.k[i] * Math.min(dx, 0.015 + PL_M - zl);
      }
    }
    if (!plN) return pen;
    for (let i = 0; i < PL_PTS.length; i += 2) {
      const lx = PL_PTS[i] + o.x + sx, ly = PL_PTS[i + 1] * c + z0 * s + o.y, lz = -PL_PTS[i + 1] * s + z0 * c + o.z;
      const x = e[0] * lx + e[4] * ly + e[8] * lz + e[12], y = e[1] * lx + e[5] * ly + e[9] * lz + e[13], z = e[2] * lx + e[6] * ly + e[10] * lz + e[14];
      for (let k = 0; k < plN; k++) {
        const q = k * 7, dx = PL_CAP[q + 3], dy = PL_CAP[q + 4], dz = PL_CAP[q + 5], px = x - PL_CAP[q], py = y - PL_CAP[q + 1], pz = z - PL_CAP[q + 2];
        const l2 = dx * dx + dy * dy + dz * dz, t = l2 > 1e-9 ? clamp((px * dx + py * dy + pz * dz) / l2, 0, 1) : 0;
        const d = PL_CAP[q + 6] + PL_R - Math.hypot(px - dx * t, py - dy * t, pz - dz * t);
        if (d > 0) pen += PL_KA * d;
      }
    }
    return pen;
  }
  const PL_SLIDE = 0.5, PL_PX = 0.02, PL_NEAR = [[], []];
  for (let s = 0; s < 2; s++) {
    for (let k = -40; k <= 40; k++) for (let j = -4; j <= 4; j++) PL_NEAR[s].push([k, j, Math.abs(k) + ((j > 0) === !s ? 1.2 : 3) * Math.abs(j)]);
    PL_NEAR[s].sort((p, q) => p[2] - q[2]);
    PL_NEAR[s].length = 140;
  }
  function plateClear(D, fa, faL, sx) {
    plateCaps(D);
    const live = D.fa1 === D.fa1 && !F.snap && st.dt > 0, p1 = live ? D.px1 : 0;
    let bf = faL, bx = 0, rel = 2;
    if (platePen(D, faL, sx) > 1e-5) {
      rel = 1;
      const lo = D.sgn < 0 ? -PL_OUT : -0.06, hi = D.sgn < 0 ? 0.06 : PL_OUT, f0 = clamp(fa, lo, hi), x0 = clamp(Math.round(p1 / PL_PX), -4, 4);
      const way = Mm[BI.shinL].elements[13] > Mm[BI.shinR].elements[13] ? 0 : 1;
      let bp = 9;
      for (const [k, j] of PL_NEAR[way]) {
        const f = f0 + k * 2.5 * DEG, jx = x0 + j;
        if (f < lo || f > hi || jx < -4 || jx > 4) continue;
        const p = platePen(D, f, sx + jx * PL_PX);
        if (p < bp - 1e-5) { bp = p; bf = f; bx = jx * PL_PX; if (p <= 1e-5) break; }
      }
    }
    if (live) {
      const mf = rel * PL_RATE * st.dt, mp = rel * PL_SLIDE * st.dt;
      bf = fa + clamp(bf - fa, -mf, mf); bx = p1 + clamp(bx - p1, -mp, mp);
    }
    D.held = Math.abs(bf - faL) > 1e-4; D.px1 = bx;
    D.pen = platePen(D, bf, sx + bx);
    return bf;
  }
  function stepPendulums() {
    const dt = st.dt, uw = st.under;
    st.clunkCD = Math.max(0, st.clunkCD - dt);
    _cw.copy(st.curV).multiplyScalar(uw);
    for (const D of PD) {
      _v1.setFromMatrixPosition(Mm[D.b]).applyMatrix4(F.mG);
      _m1.extractRotation(Mm[D.pb]);
      _pq.setFromRotationMatrix(_m1).premultiply(F.qG);
      _v2.copy(D.hang).applyQuaternion(_pq);
      const bag = D.b === BI.bag;
      if (!D.init || F.snap) { D.X.copy(_v1).addScaledVector(bag ? _v3.set(0, -1, 0) : _v2, D.L); D.V.set(0, 0, 0); D.init = true; if (bag) bagP0 = bagQ = false; }
      if (bag && st.bagKick) { D.V.y -= st.bagKick; st.bagKick = 0; }
      if (bag) {
        _bPp.copy(bagP0 ? _bP0 : _v1);
        if (bagP0 && dt > 0) {
          _bpk.subVectors(_v1, _bP0).addScaledVector(_bpv, -dt);
          const jl = _bpk.length(), jm = BAG_JERK * dt * dt;
          if (jl > jm) { _bpk.multiplyScalar(1 - jm / jl); D.X.add(_bpk); _bPp.add(_bpk); }
          _bpv.subVectors(_v1, _bPp).divideScalar(dt);
        } else _bpv.set(0, 0, 0);
        _bP0.copy(_v1); bagP0 = true;
      }
      if (dt > 0) {
        const n = dt > 1 / 45 ? 3 : 2, h = dt / n;
        const g = lerp(9.8, D.g + (bag ? 3 * st.fill + 4 * st.bagLoad : 0), uw), drag = lerp(1.5, D.drag + (bag ? 3 * st.bagLoad : 0), uw);
        const rub = bag ? lerp(BAG_RUB_AIR, BAG_RUB, uw) : 0;
        for (let k = 0; k < n; k++) {
          const Pv = bag ? _bpk.copy(_bPp).lerp(_v1, (k + 1) / n) : _v1;
          D.Xp.copy(D.X);
          D.V.y -= g * h;
          if (D.stiff) { _v3.copy(Pv).addScaledVector(_v2, D.L).sub(D.X); D.V.addScaledVector(_v3, D.stiff * D.stiff * h * 0.25); }
          if (bag && st.bagHold > 0) {
            _v3.set(-Math.tan(0.2) * D.lat, -1, Math.tan(st.bagBack)).normalize().applyQuaternion(_pq).multiplyScalar(D.L).add(Pv).sub(D.X);
            D.V.addScaledVector(_v3, 196 * st.bagHold * h).multiplyScalar(Math.exp(-3.2 * st.bagHold * h));
          }
          D.V.sub(_cw).multiplyScalar(Math.exp(-drag * h)).add(_cw);
          if (bag) {
            D.V.sub(_bpv).multiplyScalar(Math.exp(-rub * h));
            const s = D.V.length();
            D.V.multiplyScalar(1 / (1 + BAG_QUAD * s * h)).add(_bpv);
          }
          D.X.addScaledVector(D.V, h);
          if (bag) _bx0.copy(D.X);
          if (bag) {
            _bl.set(-D.lat, 0, 0).applyQuaternion(_pq);
            for (let c = 0; c < 2; c++) {
              const a0 = Mm[c ? BI.shinL : BI.thighL], b0 = Mm[c ? BI.footL : BI.shinL];
              _bm.setFromMatrixPosition(b0).applyMatrix4(F.mG);
              _bn.setFromMatrixPosition(a0).applyMatrix4(F.mG);
              if (!c) _bn.lerp(_bm, 0.2);
              _bm.sub(_bn);
              const l2 = Math.max(_bm.lengthSq(), 1e-8);
              const load = st.bagIn > 0;
              for (let j = 0; j < (load ? 1 : 2); j++) {
                const m = j ? 0.5 : 1, r = (c ? 0.07 : 0.085) + (load ? Math.max(0.03, st.bagIn - BAG_PRESS) : BAG_OFF - BAG_OUT);
                _v3.copy(D.X).sub(Pv).multiplyScalar(m).add(Pv).sub(_bn);
                _v3.addScaledVector(_bm, -clamp(_v3.dot(_bm) / l2, 0, 1));
                const d = _v3.length();
                if (d < r) D.X.addScaledVector(_bl, Math.min((r - d) / m, 0.03));
                else if (load && !c && d > r + 0.006) D.X.addScaledVector(_bl, -Math.min(d - r - 0.006, 0.004));
              }
            }
            _v4.subVectors(D.X, Pv).normalize().applyQuaternion(_q1.copy(_pq).invert());
            _q2.setFromUnitVectors(D.hang, _v4).premultiply(_pq);
            _bx1.copy(D.X);
            for (let ci = 0; ci < BAG_CAPS.length; ci++) {
              if (ci === 2) { const va = BAG_ARM * (1 - 0.8 * we[PI_.crank]) * h; _bpu.subVectors(D.X, _bx1); const pl = _bpu.length(); if (pl > va) D.X.copy(_bx1).addScaledVector(_bpu, va / pl); }
              const [a0, pa, b0, pb, f, rc, mid] = BAG_CAPS[ci], wc = ci === 1 ? 1 - st.bagHold : 1;
              if (wc <= 0) continue;
              _bn.fromArray(pa).applyMatrix4(Mm[a0]).applyMatrix4(F.mG);
              _bm.fromArray(pb).applyMatrix4(Mm[b0]).applyMatrix4(F.mG).sub(_bn).multiplyScalar(f);
              const l2 = Math.max(_bm.lengthSq(), 1e-8);
              for (let j = 0; j < (mid || ci < 2 ? 1 : 2); j++) {
                const P = BAG_PTS[j], r = rc + P.r;
                _v3.copy(P.p).applyQuaternion(_q2).add(Pv).sub(_bn);
                _v3.addScaledVector(_bm, -clamp(_v3.dot(_bm) / l2, 0, 1));
                const d = _v3.length();
                if (d < r && d > 1e-5) D.X.addScaledVector(_v3, (wc * Math.min((r - d) / P.m, j ? BAG_SHOVE_RING * h : 0.03)) / d);
              }
            }
            _bpu.subVectors(D.X, _bx0);
            const pl = _bpu.length();
            if (pl > BAG_SHOVE * h) { _bpu.multiplyScalar((BAG_SHOVE * h) / pl); D.X.copy(_bx0).add(_bpu); }
          }
          _v3.subVectors(D.X, Pv);
          const l = _v3.length() || 1;
          D.X.copy(Pv).addScaledVector(_v3, D.L / l);
          D.V.subVectors(D.X, D.Xp).divideScalar(h);
          if (bag) {
            const pl = _bpu.length();
            if (pl > 1e-7) {
              D.V.addScaledVector(_bpu, -1 / h);
              _bpu.divideScalar(pl);
              const vn = D.V.dot(_bpu) - _bpv.dot(_bpu);
              if (vn < 0) D.V.addScaledVector(_bpu, -vn);
            }
            _v3.subVectors(D.X, Pv).divideScalar(D.L);
            D.V.addScaledVector(_v3, _bpv.dot(_v3) - D.V.dot(_v3));
          }
        }
      }
      _v3.subVectors(D.X, _v1).normalize();
      _q1.copy(_pq).invert();
      _v4.copy(_v3).applyQuaternion(_q1);
      let fa = Math.atan2(_v4.z, Math.max(1e-4, -_v4.y)), sa = Math.atan2(_v4.x, Math.max(1e-4, -_v4.y));
      let hit = 0;
      if (D.sgn < 0 && fa > 0.06) { hit = fa - 0.06; fa = 0.06; }
      if (D.sgn > 0 && fa < -0.06) { hit = -0.06 - fa; fa = -0.06; }
      const fa0 = fa, sa0 = sa, faM = bag ? lerp(D.fa, 25 * DEG, st.bagLoad) : D.fa, faL = clamp(fa, -faM, faM);
      fa = D.held ? clamp(fa, Math.min(-faM, D.fa1), Math.max(faM, D.fa1)) : faL; sa = clamp(sa, -D.sa, D.sa);
      if (D.lat > 0 && sa > 0.22) sa = 0.22;
      if (D.lat < 0 && sa < -0.22) sa = -0.22;
      if (D.plate) { fa = plateClear(D, fa, faL, D.L * Math.sin(sa) * 0.6); D.fa1 = fa; }
      if (hit > 0 || fa !== fa0 || sa !== sa0) {
        _v4.set(Math.tan(sa), -1, Math.tan(fa)).normalize();
        _v5.copy(_v4).applyQuaternion(_pq);
        const sp = D.V.length();
        D.X.copy(_v1).addScaledVector(_v5, D.L);
        if (hit > 0) {
          if (D.clunk && sp > 0.22 && st.clunkCD <= 0) { EV.clunk = Math.max(EV.clunk, clamp((sp - 0.2) / 0.8, 0.1, 1)); st.clunkCD = 0.35; }
          D.V.multiplyScalar(0.1);
        } else if (bag) {
          _bpu.copy(_v3).multiplyScalar(-D.L).add(D.X).sub(_v1);
          const pl = _bpu.length();
          if (pl > 1e-7) { _bpu.divideScalar(pl); const vn = D.V.dot(_bpu) - _bpv.dot(_bpu); if (vn < 0) D.V.addScaledVector(_bpu, -vn); }
        } else D.V.multiplyScalar(0.6);
      }
      if (D.plate) {
        _e1.set(-fa, 0, 0, 'XYZ');
        Qf[D.b].setFromEuler(_e1);
        Pf[D.b].copy(BINDM.offs[D.b]); Pf[D.b].x += D.L * Math.sin(sa) * 0.6 + D.px1;
      } else {
        _v4.set(Math.tan(sa), -1, Math.tan(fa)).normalize();
        Qf[D.b].setFromUnitVectors(D.hang, _v4);
        if (bag) {
          if (bagQ && dt > 0) {
            _v5.copy(D.hang).applyQuaternion(_bqT);
            _bq.setFromUnitVectors(_v5, _v4);
            _bqT.premultiply(_bq).slerp(Qf[D.b], 1 - Math.exp(-(BAG_SQUARE + 6 * st.bagHold) * dt));
            Qf[D.b].copy(_bqT);
          } else _bqT.copy(Qf[D.b]);
          bagQ = true;
        }
      }
      rig.fkFrom(D.b);
    }
    const sq = PD[0].pen || 0;
    if (F.snap || we[PI_.kneel] < 0.5) st.bowCap = 40;
    else if (sq > PL_CLEAR && !(st.bowWant > 75)) st.bowCap = Math.max(20, Math.min(st.bowCap, 2 * Math.acos(Math.min(1, Math.abs(rig.turnQ.w))) / DEG + 2) - (sq > PL_CAUGHT ? 30 * dt : 0));
    else st.bowCap = Math.min(90, st.bowCap + 12 * dt);
  }

  const _ta = new V3(), _tdir = new V3(), _tup = new V3();
  const inletL = new V3(...HELM.inlet).applyMatrix4(BINDM.inv[BI.cors]);
  const inletDirL = new V3(...HELM.inletDir).transformDirection(BINDM.inv[BI.cors]);
  const TENV = { dt: 0, waterY: 0, floorFn: null, floorY: null, current: null, slack: 3, deck: false, under: false, snap: false, fx: 0, fz: 0, floorR: 2.5, boat: null, body: null };
  const TBOAT = { mat: new THREE.Matrix4(), inv: new THREE.Matrix4(), rx: 0, ry: 0, rz: 0, ox: 1, oz: 0, px: 0, pz: 1, al0: 0, deckY: 0, halfW: 0.035, beam: 2, halfLen: 5, hy: new Float32Array(8), hs: new Float32Array(8), hn: 0, yLow: -0.15 };
  const TBODY = { x: 0, z: 0, y0: 0, y1: 0, r: 0.2, hx: 0, hy: 0, hz: 0, hr: 0.2, fr: 0, caps: new Float32Array(16 * 7), nc: 0, skip0: 0, skip1: 0, skipK: 1, skipArm: -1, bb: new Float32Array(6), rail: null };
  const TCUR = new V3();
  const TCOLS = [0, 1, 2, 3].map(() => ({ mat: new THREE.Matrix4(), inv: new THREE.Matrix4(), min: new V3(), max: new V3(), scale: 1, fr: 0.5 }));
  TENV.cols = TCOLS; TENV.nCols = 0;
  const COLBB = new WeakMap(), _cbm = new THREE.Matrix4(), _cbi = new THREE.Matrix4();
  function localBounds(obj) {
    const box = new THREE.Box3(), bb = new THREE.Box3();
    obj.updateWorldMatrix(true, true);
    _cbi.copy(obj.matrixWorld).invert();
    obj.traverse((o) => {
      if (!o.isMesh || !o.geometry) return;
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      _cbm.multiplyMatrices(_cbi, o.matrixWorld);
      bb.copy(o.geometry.boundingBox).applyMatrix4(_cbm);
      box.union(bb);
    });
    return box;
  }
  function tethers(s) {
    const R0 = TT.ROPES[0];
    if (st.tetherOn > 0) st.tetherOn -= st.dt;
    R0.on = st.tetherOn > 0;
    if (!R0.on && !R0.init) { tether.visible = tetherT.visible = false; return; }
    _ta.copy(inletL).applyMatrix4(bones[BI.cors].matrixWorld);
    R0.a.copy(_ta);
    _tdir.copy(inletDirL).transformDirection(bones[BI.cors].matrixWorld);
    _tdir.addScaledVector(_Y, 1.4 * sstep(0.3, 0.8, st.under)).normalize();
    if (R0.init) {
      const X = R0.X;
      let k = 8;
      while (k < TN - 2 && R0.pre[k] < 0.7) k++;
      _v6.set(X[k * 3] - X[0], X[k * 3 + 1] - X[1], X[k * 3 + 2] - X[2]);
      const l6 = _v6.length(), wU = sstep(0.3, 0.8, st.under);
      if (l6 > 1e-3 && wU > 0) { _v6.y = Math.max(_v6.y, -0.25 * l6); _tdir.addScaledVector(_v6, (0.8 * wU) / _v6.length()).normalize(); }
    }
    _tup.copy(R0.bSet).sub(_ta).normalize();
    _tdir.addScaledVector(_tup, 0.6 * sstep(0.3, 0.8, st.under)).normalize();
    R0.dvK += ((R0.payOnly && st.under > 0.5 && !st.grounded ? 1 : 0) - R0.dvK) * (1 - Math.exp(-st.dt / 0.5));
    R0.mouth.copy(inletDirL).transformDirection(bones[BI.cors].matrixWorld);
    if (R0.dvK > 1e-3) {
      _v6.set(R0.mouth.x, 0, R0.mouth.z);
      if (_v6.lengthSq() > 1e-6) {
        _v6.normalize();
        if (R0.init) {
          const X = R0.X;
          let k = 8;
          while (k < TN - 2 && R0.pre[k] < 1.0) k++;
          const hx = X[k * 3] - X[0], hz = X[k * 3 + 2] - X[2], hl = Math.hypot(hx, hz);
          if (hl > 0.05) { _v6.x += hx / hl; _v6.z += hz / hl; if (_v6.lengthSq() > 1e-6) _v6.normalize(); }
        }
        _v6.y = 2.0; _v6.normalize().add(R0.mouth).normalize();
      } else _v6.copy(R0.mouth);
      _tdir.lerp(_v6, R0.dvK).normalize();
    }
    R0.aDir.copy(_tdir); R0.hasDir = true;
    R0.b.copy(R0.bSet);
    {
      const RLf = RCH[1];
      const dvPin = st.lpHand >= 0 && st.dive;
      const hold = (dvPin || (st.tugG > 0 && RLf.w < 0.5)) && R0.init && R0.on;
      if (hold) R0.relT = -1; else if (R0.pinOk && !(R0.relT >= 0)) R0.relT = 0;
      const letGo = !hold && R0.relT >= 0 && R0.relT < 0.25 && R0.init && R0.on && R0.pinK > 0;
      R0.pinOn = hold || letGo;
      const mode = dvPin ? 2 + st.lpHand : 1;
      if (hold && (!R0.pinOk || R0.pinMode !== mode)) R0.pinS = dvPin ? st.lpS : st.tugS;
      if (letGo) {
        R0.relT += st.dt;
        const X = R0.X, o0 = Math.max(0, R0.pinK - 3) * 3, o1 = (R0.pinK + 3) * 3;
        _v6.set((X[o0] + X[o1]) * 0.5, (X[o0 + 1] + X[o1 + 1]) * 0.5, (X[o0 + 2] + X[o1 + 2]) * 0.5);
        R0.pinP.lerp(_v6, Math.min(1, st.dt / 0.08));
      }
      if (hold) {
        if (dvPin) anchors[st.lpHand ? 'leftHand' : 'rightHand'].getWorldPosition(_v6);
        else anchors.leftHand.getWorldPosition(_v6);
        if (!R0.pinOk || R0.pinMode !== mode) {
          const k = Math.max(2, Math.min(TNEAR - 2, Math.round(R0.pinS / Math.max(1e-3, R0.rest[0])))) * 3;
          R0.pinT = 0; R0.pinFrom.set(R0.X[k], R0.X[k + 1], R0.X[k + 2]); R0.pinPrev.copy(R0.pinFrom); R0.pinMode = mode;
        }
        R0.pinT = Math.min(1, R0.pinT + st.dt / 0.15);
        R0.pinP.lerpVectors(R0.pinFrom, _v6, sstep(0, 1, R0.pinT));
      }
      if (R0.pinOn) {
        const pm = R0.pinP.distanceTo(R0.pinPrev), px = (dvPin && !st.divePerch ? 5 : 1.5) * Math.max(st.dt, 1e-3);
        if (pm > px) R0.pinP.lerpVectors(R0.pinPrev, R0.pinP, px / pm);
      }
      R0.pinOk = R0.pinOn;
    }
    TENV.dt = st.dt; TENV.waterY = num(s.waterY, 0);
    TENV.floorFn = typeof s.floor === 'function' ? s.floor : null;
    TENV.floorY = typeof s.floor === 'number' ? s.floor : st.line < -0.5 ? MOT.p.y - 0.95 : null;
    TENV.fx = MOT.p.x; TENV.fz = MOT.p.z;
    const sp = s.support && s.support.isObject3D ? s.support : null, ds = sp && sp.userData ? sp.userData.diverSpot : null;
    if (ds && ds.rail && ds.pos) {
      sp.updateWorldMatrix(true, false);
      TBOAT.mat.copy(sp.matrixWorld); TBOAT.inv.copy(TBOAT.mat).invert();
      let ox = ds.out ? ds.out.x : 1, oz = ds.out ? ds.out.z : 0;
      const ol = Math.hypot(ox, oz) || 1; ox /= ol; oz /= ol;
      TBOAT.ox = ox; TBOAT.oz = oz; TBOAT.px = -oz; TBOAT.pz = ox;
      TBOAT.rx = ds.rail.x; TBOAT.ry = ds.rail.y; TBOAT.rz = ds.rail.z; TBOAT.deckY = ds.pos.y;
      TBOAT.beam = 2 * Math.abs(ds.rail.x * ox + ds.rail.z * oz);
      TBOAT.al0 = -(ds.rail.x * TBOAT.px + ds.rail.z * TBOAT.pz);
      TBOAT.hn = 0; TBOAT.yLow = -0.15;
      const rg = ds.rungs;
      if (rg && rg.length) {
        for (let k = 0; k < rg.length && TBOAT.hn < 8; k++) {
          const q = rg[k], off = 0.075 + 0.05 * Math.max(0, -q.y);
          TBOAT.hy[TBOAT.hn] = q.y; TBOAT.hs[TBOAT.hn] = (q.x - ds.rail.x) * ox + (q.z - ds.rail.z) * oz - off; TBOAT.hn++;
        }
        TBOAT.yLow = TBOAT.hy[TBOAT.hn - 1] - 0.1;
      }
      TENV.boat = TBOAT;
    } else TENV.boat = null;
    TBODY.x = MOT.p.x; TBODY.z = MOT.p.z; TBODY.y0 = MOT.p.y - (we[PI_.perch] > 0.5 ? 0.3 : 0.85); TBODY.y1 = MOT.p.y + 0.5;
    anchors.helmet.getWorldPosition(_v1); TBODY.hx = _v1.x; TBODY.hy = _v1.y; TBODY.hz = _v1.z;
    {
      const Cp = TBODY.caps;
      const onRail = we[PI_.perch] > 0.5 || !!st.divePerch;
      _bc.setFromMatrixPosition(Mm[BI.pelvis]).applyMatrix4(F.mG); _bd.setFromMatrixPosition(Mm[BI.neck]).applyMatrix4(F.mG);
      let o = capOut(Cp, 0, _bc, _bd, 0.2);
      o = capOut(Cp, o, _bc.setFromMatrixPosition(Mm[BI.uarmR]).applyMatrix4(F.mG), _bd.setFromMatrixPosition(Mm[BI.uarmL]).applyMatrix4(F.mG), 0.1);
      o = capOut(Cp, o, _v1, _v1, 0.2);
      for (const c of BODY_CAPS) {
        o = capOut(Cp, o, _bc.setFromMatrixPosition(Mm[c[0]]).applyMatrix4(F.mG), _bd.setFromMatrixPosition(Mm[c[1]]).applyMatrix4(F.mG), c[2]);
      }
      TBODY.nc = o / 7;
      TBODY.rail = onRail && TENV.boat ? TBOAT : null;
      const hold = R0.pinOn ? (st.lpHand >= 0 && st.dive ? st.lpHand : 1) : st.tugN > 0 && st.tugUp && st.tgK >= 0 ? 1 : -1;
      if (hold >= 0) { TBODY.skipArm = hold; TBODY.skipK = 0; }
      else if (TBODY.skipArm >= 0) { TBODY.skipK = Math.min(1, TBODY.skipK + st.dt / 0.4); if (TBODY.skipK >= 1) TBODY.skipArm = -1; }
      const ska = hold >= 0 ? hold : TBODY.skipArm;
      TBODY.skip0 = ska === 0 ? 3 : ska === 1 ? 6 : 0; TBODY.skip1 = ska >= 0 ? TBODY.skip0 + 3 : 0;
      const bb = TBODY.bb;
      bb[0] = bb[1] = bb[2] = Infinity; bb[3] = bb[4] = bb[5] = -Infinity;
      for (let k = 0; k < o; k += 7) {
        const r = Cp[k + 6] + 0.03;
        for (let e = 0; e < 3; e++) {
          const a = Cp[k + e], b = Cp[k + 3 + e];
          bb[e] = Math.min(bb[e], a - r, b - r); bb[3 + e] = Math.max(bb[3 + e], a + r, b + r);
        }
      }
    }
    TENV.body = TBODY;
    const curOk = s.current && Number.isFinite(s.current.x);
    if (curOk) { TCUR.copy(s.current); st.curSet = true; }
    TENV.current = curOk || (st.curSet && st.under > 0.3) ? TCUR : null;
    TENV.nCols = 0;
    const cl = s.colliders;
    if (cl && cl.length) {
      for (let k = 0; k < cl.length && TENV.nCols < TCOLS.length; k++) {
        const c = cl[k], C = TCOLS[TENV.nCols];
        if (c && c.isBox3) { C.mat.identity(); C.inv.identity(); C.min.copy(c.min); C.max.copy(c.max); C.scale = 1; }
        else if (c && c.isObject3D) {
          c.updateWorldMatrix(true, false);
          let bb = COLBB.get(c);
          if (!bb || bb.isEmpty()) { bb = localBounds(c); COLBB.set(c, bb); }
          if (bb.isEmpty()) continue;
          C.mat.copy(c.matrixWorld); C.inv.copy(C.mat).invert(); C.min.copy(bb.min); C.max.copy(bb.max);
          C.scale = Math.cbrt(Math.abs(C.mat.determinant())) || 1;
        } else continue;
        TENV.nCols++;
      }
    }
    TENV.deck = st.line < -0.5;
    TENV.under = st.under > 0.5;
    TENV.check = st.check; TENV.checkV = st.checkV;
    TENV.slack = 0.4 + 0.01 * Math.max(0, st.line);
    TENV.snap = F.snap;
    TT.step(TENV);
    TT.clearBody(TENV);
    TT.mesh(F.mInv, true);
    tether.visible = tetherT.visible = R0.on && U.uDvTFade.value > 0.003;
  }
  const _jbT = new Float32Array(10);
  function folds() {
    const JB = U.uDvJB.value, JS = st.JBS, dt = st.dt, T2 = _jbT;
    T2[0] = clamp(0.35 + EB[J3.farmR] / (110 * DEG), 0, 1); T2[1] = clamp(0.35 + EB[J3.farmL] / (110 * DEG), 0, 1);
    T2[2] = clamp(0.3 - EB[J3.shinR] / (90 * DEG), 0, 1); T2[3] = clamp(0.3 - EB[J3.shinL] / (90 * DEG), 0, 1);
    T2[4] = clamp(0.25 + EB[J3.thighR] / (85 * DEG), 0, 1); T2[5] = clamp(0.25 + EB[J3.thighL] / (85 * DEG), 0, 1);
    T2[6] = clamp((EB[J3.footR] + 5 * DEG) / (30 * DEG), 0, 1); T2[7] = clamp((EB[J3.footL] + 5 * DEG) / (30 * DEG), 0, 1);
    const spx = EB[J3.spine1] + EB[J3.spine2] + EB[J3.root] * 0.5;
    T2[8] = clamp(-spx / (22 * DEG), 0, 1); T2[9] = clamp(spx / (14 * DEG), 0, 1);
    for (let i = 0; i < 10; i++) {
      const k = F.snap ? 1 : 1 - Math.exp(-dt / (T2[i] > JS[i] ? 0.1 : 0.8));
      JS[i] += (T2[i] - JS[i]) * k; JB[i] = JS[i];
    }
  }
  function uniforms() {
    const dt = st.dt;
    U.uDvBreath.value = st.lung;
    U.uDvSquish.value = st.under * (1 - 0.7 * sstep(0.2, 0.7, st.suitAir));
    if (F.snap) { st.bal = st.suitAir; st.balV = 0; }
    else if (dt > 0) { st.balV += (158 * (st.suitAir - st.bal) - 10 * st.balV) * dt; st.bal += st.balV * dt; }
    U.uDvBalloon.value = clamp(st.bal, 0, 1.2);
    const exB = st.brPh > 0.42 && st.brPh < 0.95 ? Math.sin(Math.PI * clamp((st.brPh - 0.42) / 0.5, 0, 1)) : 0;
    let fogT = (0.12 + 0.28 * st.effort + 0.3 * exB) * (1 - U.uDvFaceOpen.value);
    if (st.fogClear > 0) { st.fogClear = Math.max(0, st.fogClear - dt / 3); fogT *= 1 - st.fogClear; }
    st.fog += (fogT - st.fog) * (1 - Math.exp(-dt * (fogT > st.fog ? 2.2 : 0.9)));
    U.uDvFog.value = st.fog;
    U.uDvFaceAmb.value = lerp(0.42, 0.62, st.under);
    U.uDvWaterY.value = MOT.p.y + st.line; U.uDvFloorY.value = st.hasFloor ? st.floorC : MOT.p.y + st.line - 20;
    U.uDvPuff.value = exB * (0.35 + 0.65 * st.effort);
    st.fill += (st.fillT - st.fill) * (1 - Math.exp(-dt * 2));
    U.uDvFill.value = st.fill;
    _m1.multiplyMatrices(Mm[BI.bag], BINDM.inv[BI.bag]).invert();
    for (let i = 0; i < BAG_DENT.length; i++) { const [b, p, r] = BAG_DENT[i]; _v1.copy(p).applyMatrix4(BINDM.inv[b]).applyMatrix4(Mm[b]).applyMatrix4(_m1); U.uDvBagDent.value[i].set(_v1.x, _v1.y, _v1.z, r); }
    _q1.copy(F.qG).multiply(Qf[0]).invert();
    _v1.copy(_Y).applyQuaternion(_q1);
    if (F.snap) st.upR.copy(_v1); else st.upR.lerp(_v1, 1 - Math.exp(-dt / 0.45)).normalize();
    U.uDvUpR.value.copy(st.upR);
  }
  const _ep = new V3();
  const DRIP = ['rightFoot', 'leftFoot', 'cuffR', 'cuffL', 'wFbottom', 'wBbottom', 'rimF', 'rimB', 'bag', 'rightHand', 'leftHand'];
  function events() {
    const dt = st.dt;
    if (st.evIn) { st.evIn = false; breathInfo.duration = 0.34 * st.brLen; fire(cbs.inhale, breathInfo); }
    if (st.evEx) { st.evEx = false; breathInfo.duration = 0.48 * st.brLen; fire(cbs.exhale, breathInfo); }
    for (let a = 0; a < 2; a++) {
      if (EV.step[a]) { EV.step[a] = 0; fire(cbs.step, a ? 'left' : 'right', EV.stepP[a], EV.stepK[a]); }
    }
    if (EV.knee) { EV.knee = 0; fire(cbs.step, 'right', EV.kneeP, 0.6); }
    if (st.dump > 0 && st.lt < 0.05 && st.under > 0.5) {
      for (let a = 0; a < 2; a++) fire(cbs.step, a ? 'left' : 'right', FT[a].init ? FT[a].cur : anchors[a ? 'leftFoot' : 'rightFoot'].getWorldPosition(_ep), st.landK);
      anchors.exhaust.getWorldPosition(_ep);
      fire(cbs.vent, _ep, Math.round(8 + 40 * st.suitAir));
      st.dump = 0;
    }
    if (st.under > 0.6 && group.visible) {
      const exh = st.brPh > 0.42 && st.brPh < 0.9 ? 1 : 0;
      let rate = 22 * (1 + 0.35 * exh) * (st.valve >= 0 ? 0.3 + 0.7 * st.valve : st.vy > 0.25 ? 0.3 : 1) * (st.dive ? 1 + 1.5 * exh : 1);
      if (st.entryT >= 0 && st.entryT < 2) rate *= 3;
      st.ventAcc += rate * dt * (0.6 + 0.8 * rand());
      if (st.ventAcc >= 1) { const n = Math.floor(st.ventAcc); st.ventAcc -= n; anchors.exhaust.getWorldPosition(_ep); fire(cbs.vent, _ep, n); }
      st.pumpT += dt;
      if (st.pumpT >= st.pumpNext) { st.pumpT = 0; st.pumpNext = 1.0 + 0.3 * rand(); anchors.exhaust.getWorldPosition(_ep); fire(cbs.vent, _ep, 1 + Math.floor(rand() * 3)); }
      if (st.dive && st.entryT >= 0 && st.entryT < 2.5) {
        st.seepAcc += 50 * dt;
        while (st.seepAcc >= 1) { st.seepAcc -= 1; const o = anchors[DRIP[Math.floor(rand() * 8)]]; if (o) { o.getWorldPosition(_ep); fire(cbs.vent, _ep, 1, 'seep'); } }
      } else if (st.entryT >= 0 && st.entryT < 2.5 && rand() < dt * 6) { const o = anchors[DRIP[Math.floor(rand() * 8)]]; if (o) { o.getWorldPosition(_ep); fire(cbs.vent, _ep, 1); } }
    }
    if (EV.clunk > 0) { fire(cbs.clunk, EV.clunk); EV.clunk = 0; }
    if (EV.burst > 0 && (st.under > 0.5 || !st.dive || st.divePerch)) { anchors.exhaust.getWorldPosition(_ep); if (st.under > 0.5) fire(cbs.vent, _ep, EV.burst); EV.burst = 0; }
    if (FP.doneQ) {
      FP.doneQ = false;
      const cb = FP.doneCb, res = FP.doneRes;
      FP.doneCb = null; FP.doneRes = null;
      if (cb) { try { cb(); } catch (e) { console.warn('[diver] faceplate callback failed:', e); } }
      if (res) res();
    }
    if (st.under < 0.3 && st.wetY > -0.9 && (st.drain > 0.01 || st.wet > 0.3) && cbs.drip.length && group.visible) {
      st.dripT -= dt * (0.4 + 40 * st.drain * st.drain);
      while (st.dripT <= 0) {
        st.dripT += 1;
        const nm = DRIP[Math.floor(rand() * DRIP.length)];
        const o = anchors[nm];
        if (!o) continue;
        o.getWorldPosition(_ep);
        if (_ep.y > num(TENV.waterY, 0) + 0.05) fire(cbs.drip, _ep, 0.002 + 0.004 * rand() * Math.max(st.wet, st.drain));
      }
    }
  }

  function snapNow() {
    MOT.init = false;
    rig.snap();
    for (const f of FT) { f.init = false; f.restep = -1; f.swing = false; }
    for (const D of PD) D.init = false;
    st.gKind = 0; st.glY = st.glP = 0; st.glEnd = 0;
    st.gNext = st.t + 4 + 4 * rand(); st.glNext = st.t + 2 + 2 * rand();
  }
  function setPose(name, blendSeconds = 0.6) {
    const raw = typeof name === 'string' ? name : '';
    let n = raw;
    if (n === 'swim') n = 'walk';
    if (n === 'hover') n = 'stand';
    if (ALIAS[n]) n = ALIAS[n];
    if (!(n in PI_)) return false;
    if (n === 'step') st.stepT = 0;
    st.forced = PI_[n];
    st.forcedName = raw === 'swim' || raw === 'hover' ? raw : n;
    st.forcedRate = Math.max(0.05, num(blendSeconds, 0.6));
    if (!(blendSeconds > 0)) { w.fill(0); w[PI_[n]] = 1; }
    return true;
  }
  const DBG = { st: null, hook: null };
  function update(dt, t, s) {
    s = s || EMPTY;
    if (DBG.hook) s = DBG.hook(group, s, dt, t) || s;
    st.dt = F.dt = clamp(num(dt, 0), 0, 0.1);
    st.t = F.t = num(t, st.t + st.dt);
    U.uDvFrame.value = (U.uDvFrame.value + 1) % 64;
    group.updateWorldMatrix(true, false);
    F.mG.copy(group.matrixWorld);
    F.mInv.copy(F.mG).invert();
    F.mG.decompose(_v1, F.qG, _v2);
    F.qGi.copy(F.qG).invert();
    if (typeof s.pose === 'string' && s.pose !== st.lastPose) { if (st.lastPose) st.forced = -1; st.lastPose = s.pose; }
    const jump = MOT.init && _v1.distanceToSquared(LASTP) > 0.25;
    F.snap = st.first || st.snapReq || !group.visible || jump;
    if (F.snap) snapNow();
    st.first = false; st.snapReq = false;
    LASTP.copy(_v1);
    F.stiff = lerp(1.2, 1.05, st.under) * (st.dive && !st.divePerch && we[PI_.step] > 0.3 && st.under < 0.3 ? 1.5 : 1); F.under = st.under;
    trackMotion(s);
    st.curV.set(0, 0, 0);
    if (s.current && Number.isFinite(s.current.x)) st.curV.copy(s.current);
    st.valve = typeof s.valve === 'number' && Number.isFinite(s.valve) ? clamp(s.valve, 0, 1) : -1;
    st.blowup = typeof s.blowup === 'number' && Number.isFinite(s.blowup) ? clamp(s.blowup, 0, 1) : 0;
    stepWater(s);
    stepInputs(s);
    blendPoses();
    addLook(s);
    hangLegs(s);
    addInertia();
    addDrag(s);
    addDetail();
    addStride();
    rootAdjust();
    leanIn();
    RT[1] += 0.004 * st.lung * (1 - we[PI_.sink]);
    for (let ri = 0; ri < TT.ROPES.length; ri++) {
      const R = TT.ROPES[ri];
      if (!R.on || R.tension < 0.05) continue;
      _v1.copy(R.dir).applyQuaternion(F.qGi);
      const k = R.tension * (ri ? 0.7 : 1);
      RT[0] += _v1.x * 0.03 * k; RT[2] += _v1.z * 0.03 * k;
      TB[J3.root] += -_v1.z * 5 * DEG * k;
      TB[J3.chest] += -_v1.z * 4 * DEG * k; TB[J3.spine2 + 2] += _v1.x * 3 * DEG * k;
    }
    {
      const ckW = we[PI_.crank] * RCH[0].w;
      if (ckW > 0.05 && typeof s.crankPhase === 'number' && Number.isFinite(s.crankPhase)) {
        const ph = s.crankPhase, sn = Math.sin(ph), cs = Math.cos(ph);
        const dip = 0.5 + 0.5 * cs;
        TB[J3.chest + 1] += 7 * DEG * sn * ckW; TB[J3.spine2 + 1] += 3 * DEG * sn * ckW; TB[J3.pelvis + 1] -= 3 * DEG * sn * ckW;
        TB[J3.chest] -= (4 * Math.max(0, cs) + CK_DIP[2] * dip * dip) * DEG * ckW;
        TB[J3.spine2] -= CK_DIP[3] * dip * dip * DEG * ckW;
        RT[2] -= (0.03 * cs + CK_DIP[1] * dip * dip) * ckW;
        RT[1] -= (0.012 * Math.abs(sn) + CK_DIP[0] * dip * dip) * ckW;
        const sk = Number.isFinite(s.crankSink) ? clamp(s.crankSink, 0, CK_SINK) : 0;
        if (sk > 0) { RT[1] -= sk * ckW; TB[J3.spine2] -= sk * 15 * DEG * ckW; }
      } else if (ckW > 0.05 && RCH[0].has) {
        _v1.copy(RCH[0].target).applyMatrix4(F.mInv);
        st.ckT.lerp(_v1, 1 - Math.exp(-st.dt / 0.5));
        const hx = clamp((st.ckT.x - 0.12) * 1.6, -0.3, 0.3);
        TB[J3.chest + 1] -= hx * 0.4 * ckW; TB[J3.pelvis + 1] += hx * 0.12 * ckW;
      }
    }
    capArms();
    rig.stepSprings();
    if (Math.abs(st.hLag) > 1e-5) Qf[0].premultiply(_q1.setFromAxisAngle(_Y, -st.hLag * st.plantWS));
    if (s.dive && s.dive.free && !s.dive.perch) st.upQ.identity(); else upright();
    rig.helpers();
    rig.fkAll();
    feet(s);
    if (we[PI_.perch] > 1e-3) perchFeet(s, we[PI_.perch]);
    legsApart();
    arms(s);
    rig.limitArms();
    rig.helpers();
    rig.fkAll();
    headAndEyes();
    faceplate();
    stepPendulums();
    rig.writeBones();
    group.updateMatrixWorld(true);
    tethers(s);
    folds();
    uniforms();
    events();
    F.snap = false;
  }
  function setFade(a) {
    const v = clamp(num(a, 1), 0, 1);
    U.uDvFade.value = v;
    group.visible = v > 0.003;
  }
  const tetherPub = { hose: TT.ROPES[0].pub, lifeline: TT.ROPES[0].pub };
  function dispose() {
    group.removeFromParent();
    geo.dispose(); glassGeo.dispose(); TT.geo.dispose();
    uber.dispose(); grain.dispose(); glassMat.dispose(); tetherMat.dispose(); tetherMatT.dispose();
    skeleton.dispose();
  }

  const BODY_CAPS = [[BI.uarmR, BI.farmR, 0.075], [BI.farmR, BI.handR, 0.065], [BI.handR, BI.fM2R, 0.06],
    [BI.uarmL, BI.farmL, 0.075], [BI.farmL, BI.handL, 0.065], [BI.handL, BI.fM2L, 0.06],
    [BI.thighR, BI.shinR, 0.1], [BI.shinR, BI.footR, 0.08], [BI.footR, BI.toeR, 0.075],
    [BI.thighL, BI.shinL, 0.1], [BI.shinL, BI.footL, 0.08], [BI.footL, BI.toeL, 0.075]];
  const _bc = new V3(), _bd = new V3(), _bfM = new THREE.Matrix4(), _bfR = new THREE.Matrix4(), _bfQ = new THREE.Quaternion(), _bfS = new V3();
  function capOut(out, o, a, b, r) {
    out[o] = a.x; out[o + 1] = a.y; out[o + 2] = a.z; out[o + 3] = b.x; out[o + 4] = b.y; out[o + 5] = b.z; out[o + 6] = r;
    return o + 7;
  }
  update(0, 0, EMPTY);
  const buildMs = +(performance.now() - buildT0).toFixed(1);
  const tris = A.I.length / 3 + glassGeo.index.count / 3 + TT.geo.index.count / 3;
  return {
    group,
    anchors,
    update,
    setPose,
    setFade,
    setTetherFade(k) { U.uDvTFade.value = clamp(typeof k === 'number' && Number.isFinite(k) ? k : 1, 0, 1); },
    setTetherFocus(z) { U.uDvTFocus.value = typeof z === 'number' && Number.isFinite(z) && z > 0 ? z : 0; },
    setTetherWater(w) { twSrc = w && typeof w === 'object' ? w : null; twPull(); },
    reach: rig.reach,
    hold: rig.hold,
    reachInfo: rig.reachInfo,
    solveCurl: rig.solveCurl,
    refit() { if (rig.refit()) { rig.writeBones(); group.updateMatrixWorld(true); } },
    handClear: rig.handClear,
    snap() { st.snapReq = true; },
    onExhale(cb) { return addCb(cbs.exhale, cb); },
    onInhale(cb) { return addCb(cbs.inhale, cb); },
    onVent(cb) { return addCb(cbs.vent, cb); },
    onStep(cb) { return addCb(cbs.step, cb); },
    onClunk(cb) { return addCb(cbs.clunk, cb); },
    onDrip(cb) { return addCb(cbs.drip, cb); },
    get exhaling() { return st.brPh >= 0.42 && st.brPh < 0.9; },
    get breath() { return st.lung; },
    get finPhase() { return st.phase * TAU; },
    get stepPhase() { return st.phase; },
    get pose() { return POSE_NAMES[st.target]; },
    get grounded() { return st.grounded; },
    get wetness() { return st.wet * clamp((st.wetY + 0.95) / 1.8, 0, 1); },
    get footing() { return { gap: st.footGap || 0, floor: st.floorC }; },
    standHeight: 0.95,
    bodyCapsules(out, o = 0) {
      o = capOut(out, o, _bc.setFromMatrixPosition(Mm[BI.pelvis]).applyMatrix4(F.mG), _bd.setFromMatrixPosition(Mm[BI.neck]).applyMatrix4(F.mG), 0.21);
      anchors.helmet.getWorldPosition(_bc);
      o = capOut(out, o, _bc, _bc, 0.23);
      for (const c of BODY_CAPS) o = capOut(out, o, _bc.setFromMatrixPosition(Mm[c[0]]).applyMatrix4(F.mG), _bd.setFromMatrixPosition(Mm[c[1]]).applyMatrix4(F.mG), c[2]);
      return o;
    },
    diveProgress(k) {
      if (typeof k !== 'number' || !Number.isFinite(k)) { st.dvSet = false; return; }
      st.dvU = clamp(k, -0.6, 1); st.dvSet = true;
    },
    setTether(p1) {
      if (p1 && Number.isFinite(p1.x) && Number.isFinite(p1.y) && Number.isFinite(p1.z)) { TT.ROPES[0].bSet.copy(p1); st.tetherOn = 0.5; }
    },
    setTetherLength(a) { TT.ROPES[0].maxLen = clamp(num(a, 60), 2, 400); },
    setLinePin(hand, s = 0.4) { st.lpHand = hand === 'left' ? 1 : hand === 'right' ? 0 : -1; st.lpS = clamp(num(s, 0.4), 0.15, 1.5); },
    setLandDip(m) { st.landDipM = Number.isFinite(m) ? clamp(m, 0, 0.2) : 0; },
    setTetherCheck(k, v) { st.check = clamp(num(k, 0), 0, 1); st.checkV = Math.max(0, num(v, 0)); },
    setTetherPayOnly(on, opts) {
      const pay = !!on, rate = opts && Number.isFinite(opts.rate) ? Math.max(0.05, opts.rate) : 1, dur = opts && Number.isFinite(opts.dur) ? Math.max(0, opts.dur) : 0;
      for (const R of TT.ROPES) { R.payOnly = pay; if (!pay && dur > 0) { R.inRate = rate; R.inRateT = dur; } }
    },
    tether: tetherPub,
    setFaceplate(k) { FP.explicit = k !== null && k !== undefined; if (FP.explicit) { FP.active = false; st.plateT = clamp(num(k, 0), 0, 1); } },
    closeFaceplate(dur = 1.3, onDone) { return startPlate(-1, dur, onDone); },
    openFaceplate(dur = 1.3, onDone) { return startPlate(1, dur, onDone); },
    get faceplate() { return st.plateK; },
    setWet(k) { st.forceWet = k === null || k === undefined ? -1 : clamp(num(k, 0), 0, 1); },
    bagFill(k, kick = 0) { st.fillT = clamp(num(k, 0), 0, 1); st.bagKick = clamp(num(kick, 0), 0, 1); },
    bagFind(m, h, k = 1, load = 0) {
      const K = clamp(num(k, 0), 0, 1);
      U.uDvFindK.value = m && m.isMatrix4 && h ? K : 0;
      st.bagLoad = U.uDvFindK.value > 0 ? clamp(num(load, 0), 0, 1) : 0;
      st.bagIn = 0;
      if (!(U.uDvFindK.value > 0)) return;
      const A = anchors.bagMouth;
      A.updateWorldMatrix(true, false);
      _bfM.copy(A.matrixWorld).invert().multiply(m).decompose(U.uDvFindC.value, _bfQ, _bfS);
      _bfR.makeRotationFromQuaternion(_bfQ);
      const e = _bfR.elements, hx = h.x * _bfS.x, hy = h.y * _bfS.y, hz = h.z * _bfS.z, H2 = [1 / (hx * hx), 1 / (hy * hy), 1 / (hz * hz)];
      const M = U.uDvFindM.value.elements;
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) M[j * 3 + i] = e[i] * e[j] * H2[0] + e[4 + i] * e[4 + j] * H2[1] + e[8 + i] * e[8 + j] * H2[2];
      const ry = Math.sqrt(e[1] * e[1] * hx * hx + e[5] * e[5] * hy * hy + e[9] * e[9] * hz * hz), c = U.uDvFindC.value;
      U.uDvFindY.value.set(c.y + ry, c.y - ry);
      U.uDvFindK.value *= 1 - sstep(2, 3.5, Math.sqrt(Math.max(0, M[0] * c.x * c.x + 2 * M[6] * c.x * c.z + M[8] * c.z * c.z)));
      if (st.bagLoad > 0.5) st.bagIn = c.x + Math.sqrt(e[0] * e[0] * hx * hx + e[4] * e[4] * hy * hy + e[8] * e[8] * hz * hz) + 0.006;
    },
    bagHold(w, back = 0) { st.bagHold = clamp(num(w, 0), 0, 1); st.bagBack = clamp(num(back, 0), 0, 0.8); },
    tug(n = 1) { const m = clamp(Math.round(num(n, 1)), 1, 4); if (st.tugN > 0 && st.tugT > 0) st.tugNx = Math.max(st.tugNx, m); else { st.tugN = m; st.tugT = 0; } },
    breathe(kind = 'deep') {
      if (kind === 'hold') { st.brHold = true; return; }
      if (kind === 'release') { if (st.brHold) { st.brHold = false; st.brPh = 0.42; st.evEx = true; EV.burst += 14; } return; }
      if (kind === 'sigh') st.sighQ = true; else st.deepQ = true;
    },
    plunge(v) { entry(clamp(num(v, 3) / 3, 0.5, 1.3)); st.solesUnder = true; },
    gesture(kind, dur = 1, opts = null) {
      if (kind !== 'valve') return false;
      st.gKind = 9; st.gT = 0; st.gDur = clamp(num(dur, 0.9), 0.4, 3); st.gBurst = false;
      st.gSide = opts && opts.side === 'left' ? 1 : opts && opts.side === 'right' ? 0 : RCH[1].w < RCH[0].w ? 1 : 0;
      st.gBurstN = opts && Number.isFinite(opts.burst) ? Math.max(0, Math.round(opts.burst)) : 12;
      return true;
    },
    deepBreath() { st.deepQ = true; },
    notice(pos, secs = 1.6) { if (pos && Number.isFinite(pos.x) && Number.isFinite(pos.y) && Number.isFinite(pos.z)) { st.notice.copy(pos); st.noticeT = clamp(num(secs, 1.6), 0.3, 6); } },
    foot(side, worldPos, weight = 1) {
      const f = FT[side === 'left' ? 1 : 0];
      if (worldPos && Number.isFinite(worldPos.x) && Number.isFinite(worldPos.y) && Number.isFinite(worldPos.z)) { f.ext.copy(worldPos); f.extReq = clamp(num(weight, 1), 0, 1); f.extT = true; }
    },
    get buoyancy() { return clamp((st.suitAir - 0.2) / 0.6, 0, 1); },
    get fatigue() { return st.fatigue; },
    caps: { lean: true, valve: true, blowup: true, support: true, hold: true, foot: true, slopeFeet: true, interest: true, avoid: true, intent: true, crankPhase: true, tetherFade: true, perch: true, colliders: true },
    crankStance(center, axis, out) {
      const o = out || new V3();
      if (!center || !axis) return o;
      _v1.set(axis.x, 0, axis.z);
      if (_v1.lengthSq() < 1e-8) _v1.set(0, 0, 1);
      _v1.normalize();
      o.set(center.x + _v1.x * 0.52 - _v1.z * 0.15, center.y, center.z + _v1.z * 0.52 + _v1.x * 0.15);
      o.yaw = Math.atan2(_v1.x, _v1.z);
      return o;
    },
    info: { triangles: tris, vertices: A.P.length / 3, bones: NBB, drawCalls: 3, buildMs, parts: B.tags },
    dispose,
    _debug: Object.assign(DBG, { st, rig, TT, U, FT, PD, LOOK }),
  };
}

const HUMAN_POSES = ['idle', 'pump', 'hold', 'payout', 'tiller', 'sit'];
const SOLE_H = 0.905;
function createHuman({ patchMaterial, envMap = null, quality = 'high', seed = 1, role = 'sailor', shirt, vraka, cap, moustache = true, build } = {}) {
  const buildT0 = performance.now();
  const low = quality === 'low' || (typeof quality === 'number' && quality < 0.75);
  const seg = (n) => Math.max(3, Math.round(n * (low ? 0.5 : 1)));
  const patch = typeof patchMaterial === 'function' ? patchMaterial : (m) => m;
  const R = rng((seed | 0) * 7919 + 17);
  const pick = (arr) => arr[Math.floor(R() * arr.length) % arr.length];
  const bld = typeof build === 'number' ? clamp(build, 0, 1) : 0.2 + 0.6 * R();
  const shirtK = shirt || (role === 'pumper' ? pick(['white', 'white', 'striped']) : pick(['white', 'striped', 'white']));
  const vrakaK = vraka || pick(['indigo', 'indigo', 'black', 'brown']);
  const capK = cap || (role === 'captain' ? 'wool' : pick(['wool', 'red', 'headcloth', 'wool', 'straw', 'none']));
  const B = makeBuilder();
  const look = {
    nose: 0.92 + 0.22 * R(), brow: 0.9 + 0.3 * R(), jaw: 0.92 + 0.2 * R(), stache: moustache ? 0.85 + 0.35 * R() : 0.001, stacheDroop: 0.8 + 0.5 * R(),
    width: 0.95 + 0.08 * R(), cheek: 0.9 + 0.25 * R(), chin: 0.9 + 0.2 * R(), ear: 0.95 + 0.1 * R(),
  };
  const HP = headPrims(look);
  const BP = humanPrims({ build: bld, seed });
  const collar = primTorus([0, 0.522, 0.012], [0, 1, 0.18], 0.062, 0.011, WMIX([[BI.chest, 0.7], [BI.neck, 0.3]]), { g: 0, k: 0.012, sig: 0.02 });
  collar.tag = 'shirt';
  const prims = [...BP, collar, ...HP.prims.filter((p) => moustache || p.tag !== 'stache')];
  const field = makeField(prims, {
    post: (g, d, x, y, z) => (g === 0 && y < -0.86 ? smax(d, -(y + SOLE_H), 0.006) : d),
  });
  const fBody = (x, y, z) => field.d(x, y, z, 1);
  const fHead = (x, y, z) => field.d(x, y, z, 2);
  const skinSDF = (pc, g, iters) => {
    const nv = pc.P.length / 3;
    const W = new Float32Array(nv * NBB), row = new Float32Array(NBB), filt = (p) => p.g === g;
    for (let i = 0; i < nv; i++) { field.weights(pc.P[i * 3], pc.P[i * 3 + 1], pc.P[i * 3 + 2], row, filt); W.set(row, i * NBB); }
    smoothWeights(W, nv, NBB, pc.I, iters);
    pc.SI = new Uint16Array(nv * 4); pc.SW = new Float32Array(nv * 4);
    for (let i = 0; i < nv; i++) top4(W.subarray(i * NBB, (i + 1) * NBB), pc.SI, pc.SW, i * 4);
  };
  const lin = (hex) => { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; };
  const CLOTHC = {
    shirt: shirtK === 'striped' ? [0.7, 0.66, 0.56] : lin('#e6ddc8').map((v) => v * (0.9 + 0.1 * R())),
    vraka: vrakaK === 'black' ? [0.02, 0.02, 0.021] : vrakaK === 'brown' ? lin('#5a4633') : lin('#3b4a66'),
    sash: pick([lin('#8e2b25'), lin('#8e2b25'), lin('#232323'), lin('#3b4a66')]),
  };
  const skinT = 0.85 + 0.3 * R();
  const SKINC = [COL.skin[0] * skinT, COL.skin[1] * skinT, COL.skin[2] * skinT];
  const hB = low ? 0.021 : 0.0135;
  const body = surfaceNets(fBody, [-0.72, -0.92, -0.3], [0.72, 0.6, 0.3], hB);
  body.N = projectVerts(fBody, body.P, hB);
  skinSDF(body, 0, 2);
  {
    const nv = body.P.length / 3, cls = new Uint8Array(nv);
    for (let i = 0; i < nv; i++) {
      const p = field.nearest(body.P[i * 3], body.P[i * 3 + 1], body.P[i * 3 + 2], 0);
      const tg = p ? p.tag : 'skin';
      cls[i] = tg === 'shirt' ? 1 : tg === 'vraka' ? 2 : tg === 'sash' ? 3 : 0;
    }
    const skinM = new Float32Array(nv), strM = new Float32Array(nv);
    for (let i = 0; i < nv; i++) { skinM[i] = cls[i] === 0 ? 1 : 0; strM[i] = cls[i] === 1 && shirtK === 'striped' ? 1 : 0; }
    smoothScalar(skinM, nv, body.I, 1);
    const bodyAO = bakeAO(body.P, body.N, fBody, 0.014, 4, 1.1);
    B.add(body, {
      col: (q) => [SKINC, CLOTHC.shirt, CLOTHC.vraka, CLOTHC.sash][cls[q.i]],
      mat: [0.9, 0, 0.3, K.CLOTH],
      aux: (q) => [bodyAO[q.i], 0, skinM[q.i], strM[q.i]], tag: 'body',
    });
  }
  const hH = low ? 0.0105 : 0.0058;
  const head = surfaceNets(fHead, [-0.098, 0.488, -0.128], [0.098, 0.8, 0.128], hH);
  head.N = projectVerts(fHead, head.P, hH, 3);
  skinSDF(head, 1, 2);
  {
    const nv = head.P.length / 3, cls = new Uint8Array(nv);
    for (let i = 0; i < nv; i++) {
      const x = head.P[i * 3], y = head.P[i * 3 + 1], z = head.P[i * 3 + 2];
      const p = field.nearest(x, y, z, 1);
      const tag = p ? p.tag : 'skin';
      let c = 0;
      if (tag === 'stache') c = 2;
      else if (tag === 'lip') c = 3;
      else if (tag === 'brow') c = 5;
      else if (Math.abs(x) < 0.068 && ((y > 0.708 && z > -0.05) || (y > 0.64 && z > 0.035))) c = 1;
      cls[i] = c;
    }
    const hairM = new Float32Array(nv), lipM = new Float32Array(nv);
    for (let i = 0; i < nv; i++) { const c = cls[i]; hairM[i] = c === 1 || c === 2 ? 1 : c === 5 ? 0.8 : 0; lipM[i] = c === 3 ? 1 : 0; }
    smoothScalar(hairM, nv, head.I, 2);
    smoothScalar(lipM, nv, head.I, 1);
    const headAO = bakeAO(head.P, head.N, fHead, 0.005, 4, 1.2);
    B.add(head, { col: SKINC, mat: [0.5, 0, 0.6, K.SKIN], aux: (q) => [headAO[q.i], 1, lipM[q.i], hairM[q.i]], tag: 'head' });
  }
  {
    const { eye, lid, lidLo } = eyeParts(seg);
    for (const S of SIDES) {
      const c = J('eye' + S);
      const l3 = { P: lidLo.P.slice(), I: lidLo.I.slice(), UV: lidLo.UV.slice() };
      xform(l3, T3(c[0], c[1], c[2]));
      B.add(l3, { col: SKINC, mat: MAT.skin, aux: [0.35, 1, 0, 0], skin: BI.head, tag: 'eyes' });
      const e2 = { P: eye.P.slice(), I: eye.I.slice(), UV: eye.UV.slice() };
      xform(e2, T3(c[0], c[1], c[2]));
      B.add(e2, { col: [0.5, 0.47, 0.42], mat: MAT.eye, aux: [0, 1, 0, 0], skin: BI['eye' + S], tag: 'eyes' });
      const l2 = { P: lid.P.slice(), I: lid.I.slice(), UV: lid.UV.slice() };
      xform(l2, T3(c[0], c[1], c[2]));
      B.add(l2, { col: SKINC, mat: MAT.skin, aux: [0, 1, 0, 0], skin: BI['lid' + S], tag: 'eyes' });
    }
  }
  {
    const HAND = makeHand();
    const hh = low ? 0.0075 : 0.0048;
    const hand = surfaceNets(HAND.f, [-0.058, -0.2, -0.085], [0.05, 0.062, 0.062], hh);
    hand.N = projectVerts(HAND.f, hand.P, hh, 3);
    const { WH, KEYS, NK } = handWeights(HAND, hand);
    for (const S of SIDES) B.add(handPiece(HAND, hand, S, WH, KEYS, NK), { col: SKINC, mat: MAT.skin, tag: 'hands' });
  }
  if (capK !== 'none') {
    const HB = BI.head;
    const na = seg(40);
    const capCol = capK === 'red' ? lin('#8e2b25') : capK === 'headcloth' ? lin('#e6ddc8') : capK === 'straw' ? [0.52, 0.42, 0.22] : [0.02, 0.02, 0.022];
    const tiltM = new THREE.Matrix4().makeRotationX(capK === 'wool' ? 0.2 : capK === 'straw' ? 0.06 : 0.12).premultiply(T3(0, 0.0, 0.0));
    let pc;
    if (capK === 'straw') {
      const prof = [[0.0, 0.79], [0.082, 0.79], [0.086, 0.786], [0.088, 0.74], [0.09, 0.724], [0.135, 0.722], [0.137, 0.717], [0.09, 0.719], [0.083, 0.722]];
      pc = gridIJ(na, prof.length - 1, (i, j) => { const a = (i / na) * TAU, [r, y] = prof[prof.length - 1 - j]; return [Math.sin(a) * r * 0.92, y, 0.012 - Math.cos(a) * r * 1.02, a * 0.1, y]; });
    } else if (capK === 'headcloth') {
      pc = gridIJ(na, 10, (i, j) => {
        const a = (i / na) * TAU, v = j / 10;
        const r = 0.082 + 0.012 * Math.sin(Math.PI * v) + 0.004 * Math.sin(a * 7 + v * 5);
        const y = 0.705 + 0.05 * v + 0.006 * Math.sin(a * 3);
        const rr = r * (1 - 0.55 * sstep(0.75, 1, v));
        return [Math.sin(a) * rr * 0.92, y + 0.02 * sstep(0.7, 1, v), 0.012 - Math.cos(a) * rr * 1.05, a * 0.08, v * 0.06];
      });
    } else {
      const red = capK === 'red';
      pc = gridIJ(na, 14, (i, j) => {
        const a = (i / na) * TAU, v = j / 14;
        const roll = v < 0.2;
        let r = roll ? 0.086 + 0.008 * Math.sin(Math.PI * v / 0.2) : 0.086 * Math.cos((v - 0.2) / 0.8 * Math.PI * 0.5) ** 0.7;
        let y = roll ? 0.702 + 0.03 * v / 0.2 : 0.732 + (red ? 0.1 : 0.075) * Math.sin((v - 0.2) / 0.8 * Math.PI * 0.5);
        let x = Math.sin(a) * r * 0.92, z = 0.012 - Math.cos(a) * r * 1.04;
        if (red) { const k = sstep(0.5, 1, v); x += 0.05 * k; y -= 0.03 * k * k; }
        return [x, y, z, a * 0.09, v * 0.1];
      });
    }
    xform(pc, T3(0, 0.7, 0.012).multiply(tiltM).multiply(T3(0, -0.7, -0.012)));
    B.add(pc, { col: capCol, mat: [0.92, 0, 0.3, K.CLOTH], aux: [0, 22, 0, 0], skin: HB, tag: 'cap', inside: [0, 0.7, 0.012] });
    if (capK === 'straw') {
      const band = lathe([[0.0892, 0.724], [0.0894, 0.742]], seg(40));
      xform(band, new THREE.Matrix4().makeScale(0.92, 1, 1.02).premultiply(T3(0, 0, 0.012)));
      xform(band, T3(0, 0.7, 0.012).multiply(tiltM).multiply(T3(0, -0.7, -0.012)));
      B.add(band, { col: [0.02, 0.02, 0.025], mat: [0.8, 0, 0.3, K.CLOTH], aux: [0, 22, 0, 0], skin: HB, tag: 'cap', inside: [0, 0.7, 0.012] });
    }
  }
  {
    const pts = [[-0.17, 0.05, -0.04], [-0.185, -0.03, -0.05], [-0.19, -0.12, -0.045], [-0.185, -0.2, -0.04]];
    const tail = tubeAlong(smoothPath(pts, 14), (s, tot, a) => 0.022 * (1 + 0.3 * Math.cos(a) ** 2) * (1 - 0.3 * s / tot), seg(8));
    xform(tail, new THREE.Matrix4().makeScale(1, 1, 0.35).premultiply(T3(0, 0, -0.022)));
    B.add(tail, { col: CLOTHC.sash, mat: [0.9, 0, 0.3, K.CLOTH], aux: [0, 23, 0, 0], skin: () => [BI.pelvis, BI.thighL, 0, 0, 0.7, 0.3, 0, 0], tag: 'sash' });
  }
  const A = B.A;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(A.P, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(A.N, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(A.UV, 2));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(A.C, 3));
  geo.setAttribute('aMat', new THREE.Float32BufferAttribute(A.M, 4));
  geo.setAttribute('aRest', new THREE.Float32BufferAttribute(A.R, 3));
  geo.setAttribute('aAux', new THREE.Float32BufferAttribute(A.X, 4));
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(A.SI, 4));
  geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(A.SW, 4));
  geo.setIndex(A.I);
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 2.2);
  const JC = [], JA = [], JN = [], JP = [];
  const addJ = (c, a, n, prm) => { JC.push(new THREE.Vector3(...c)); JA.push(new THREE.Vector3(...vnorm(a))); JN.push(new THREE.Vector3(...vnorm(n))); JP.push(new THREE.Vector4(...prm)); };
  for (const S of SIDES) addJ(J('farm' + S), AX('uarm' + S, 1), vmul(AX('uarm' + S, 2), -1), [0.08, 0.08, 0.024, 0.003]);
  for (const S of SIDES) addJ(J('shin' + S), AX('thigh' + S, 1), AX('thigh' + S, 2), [0.1, 0.13, 0.03, 0.004]);
  for (const S of SIDES) addJ(J('thigh' + S), AX('thigh' + S, 1), vmul(AX('thigh' + S, 2), -1), [0.1, 0.15, 0.034, 0.004]);
  for (let i = 0; i < 4; i++) addJ([0, 0, 0], [0, 1, 0], [0, 0, 1], [0.0, 0.0, 1, 0]);
  const U = {
    uDvFade: { value: 1 }, uDvUnder: { value: 0 }, uDvFrame: { value: 0 }, uDvWet: { value: 1 }, uDvWetY: { value: -3 }, uDvSalt: { value: 0 },
    uDvFaceAmb: { value: 1 }, uDvFaceOpen: { value: 1 }, uDvWinV: { value: [new THREE.Vector3(0, 0, 1), new THREE.Vector3(1, 0, 0), new THREE.Vector3(-1, 0, 0)] },
    uDvSeed: { value: seed * 1.37 }, uDvSquish: { value: 0 }, uDvBalloon: { value: 0 }, uDvBreath: { value: 0 }, uDvFill: { value: 0 },
    uDvJC: { value: JC }, uDvJA: { value: JA }, uDvJN: { value: JN }, uDvJP: { value: JP }, uDvJB: { value: new Float32Array(10) },
  };
  const mat = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 1, metalness: 1, clearcoat: 1, clearcoatRoughness: 0.3, sheen: 1, sheenColor: new THREE.Color(0.2, 0.2, 0.2), sheenRoughness: 0.6 });
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, U);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\n' + DV_VERT_DECL)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n' + DV_VERT);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uDvWetY;\n' + DV_FRAG_DECL)
      .replace('#include <color_fragment>', '#include <color_fragment>\n' + DV_FRAG_COLOR)
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\n' + DV_FRAG_ROUGH)
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n' + DV_FRAG_NORMAL)
      .replace('#include <lights_physical_fragment>', '#include <lights_physical_fragment>\n' + DV_FRAG_PHYS)
      .replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\n' + DV_FRAG_LIGHTS);
  };
  mat.customProgramCacheKey = () => 'diver1901-uber-1';
  patch(mat);
  const rig = makeRig({ handSpeed: 2.2, springs: { uarm: [13, 0.78], farm: [13, 0.75], hand: [14, 0.72] } });
  const { bones, Qf, Pf, Mm, TB, EB, RT, F, RCH } = rig;
  const mesh = new THREE.SkinnedMesh(geo, mat);
  mesh.name = 'crewman';
  mesh.add(bones[0]);
  mesh.position.y = SOLE_H;
  const hs = 0.97 + 0.06 * R();
  mesh.scale.setScalar(hs);
  mesh.position.y = SOLE_H * hs;
  mesh.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(bones);
  mesh.bind(skeleton);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 2.2);
  mesh.onBeforeRender = (r, scene) => {
    const env = (scene && scene.environment) || envMap || null;
    if (mat.envMap !== env) { mat.envMap = env; mat.needsUpdate = true; }
    mat.envMapIntensity = Math.min(1.1, (scene && scene.environment ? scene.environmentIntensity : 1) * 1.3);
  };
  const group = new THREE.Group();
  group.name = 'crewman';
  group.add(mesh);
  const anchors = {};
  const addAnchor = (name, bone, p) => { const o = new THREE.Object3D(); o.position.copy(new THREE.Vector3(...p).applyMatrix4(BINDM.inv[bone])); bones[bone].add(o); anchors[name] = o; };
  addAnchor('head', BI.head, [0, 0.668, -0.06]);
  addAnchor('chest', BI.chest, [0, 0.4, -0.13]);
  {
    const gripQ = (x, z) => new THREE.Quaternion().setFromRotationMatrix(basis([0, 0, 0], x, [0, -1, 0], z));
    const hr = new THREE.Object3D(); hr.position.copy(ANCH[0]); hr.quaternion.copy(gripQ([0, 0, -1], [-1, 0, 0])); bones[BI.handR].add(hr); anchors.rightHand = hr;
    const hl = new THREE.Object3D(); hl.position.copy(ANCH[1]); hl.quaternion.copy(gripQ([0, 0, 1], [1, 0, 0])); bones[BI.handL].add(hl); anchors.leftHand = hl;
  }

  const V3 = THREE.Vector3;
  const _v1 = new V3(), _v2 = new V3(), _v3 = new V3(), _v4 = new V3(), _q1 = new THREE.Quaternion(); new THREE.Matrix4(); const _e1 = new THREE.Euler();
  const _Y = new V3(0, 1, 0);
  const NP = HUMAN_POSES.length;
  const w = new Float32Array(NP), we = new Float32Array(NP);
  const defPose = role === 'pumper' ? 1 : role === 'tender' ? 2 : role === 'captain' ? 4 : 0;
  w[defPose] = 1;
  const EP = new Float32Array(NBB * 3), RP = new Float32Array(3);
  const st = { t: 0, dt: 0, first: true, snapReq: false, target: defPose, rate: 2, forced: -1, lastPose: '', rs: (seed | 0) * 31 + 7, lung: 0, brPh: R(), brLen: 4.2, wside: 1, wsideT: 1, wsideV: 0, glY: 0, glP: 0, glNext: 2, glEnd: 0, upQ: new THREE.Quaternion(), tension: 0, phase: 0, payT: 0};
  const rand = () => { st.rs = (st.rs * 16807) % 2147483647; return st.rs / 2147483647; };
  const S3 = (E, name, x, y, z) => { const o = J3[name]; E[o] = x * DEG; E[o + 1] = y * DEG; E[o + 2] = z * DEG; };
  const LR = (E, base, x, y, z) => { S3(E, base + 'R', x, y, z); S3(E, base + 'L', x, -y, -z); };
  const curl = (E, a, b) => {
    for (let s = 0; s < 2; s++) {
      const S = SIDES[s], sg = s ? 1 : -1;
      for (let fi = 0; fi < 4; fi++) { const f = FINGERS[fi]; E[J3['f' + f.n + '1' + S] + 2] = sg * a * (1 + 0.07 * fi) * DEG; E[J3['f' + f.n + '2' + S] + 2] = sg * b * (1 + 0.1 * fi) * DEG; }
    }
  };
  function evalPose(p, E, rp) {
    E.fill(0); rp[0] = rp[1] = rp[2] = 0;
    const t = st.t, b = (2 * st.lung - 1) * DEG;
    LR(E, 'uarm', 4, 0, 7); LR(E, 'farm', 14, 0, 0); LR(E, 'hand', 0, 8, -3);
    curl(E, 22, 30);
    S3(E, 'thumb1R', 8, 10, 0); S3(E, 'thumb1L', 8, -10, 0);
    E[J3.chest] -= 1.1 * b; E[J3.spine2] -= 0.5 * b;
    switch (p) {
      case 0: {
        const ws = st.wside, sw = Math.sin(t * 0.7);
        S3(E, 'pelvis', 0, 1.5 * Math.sin(t * 0.21), 3.5 * ws + 0.6 * sw);
        E[J3.spine1 + 2] -= 1.4 * ws * DEG; E[J3.chest + 2] -= 1.8 * ws * DEG;
        rp[0] = 0.026 * ws;
        S3(E, 'root', -1, 0, 0);
        break;
      }
      case 1: {
        const ph = st.phase;
        S3(E, 'root', -8 - 7 * Math.sin(ph), 0, 0);
        S3(E, 'spine1', -3 - 3 * Math.sin(ph), 0, 0); S3(E, 'chest', -3 - 4 * Math.sin(ph + 0.4), 0, 0);
        rp[2] = -0.05 * Math.sin(ph); rp[1] = -0.04 - 0.03 * (0.5 + 0.5 * Math.cos(ph * 2));
        LR(E, 'uarm', 40, 0, 12); LR(E, 'farm', 50, 0, 0);
        curl(E, 60, 80);
        break;
      }
      case 2: case 3: {
        const tn = st.tension;
        S3(E, 'root', 4 + 10 * tn, 0, 0);
        S3(E, 'spine1', 2, 0, 0); S3(E, 'chest', -6 - 4 * tn, 0, 0); S3(E, 'neck', 6, 0, 0);
        rp[2] = 0.05 * tn; rp[1] = -0.03 * tn;
        LR(E, 'uarm', 36, 0, 10); LR(E, 'farm', 60, 0, 0);
        curl(E, 60, 80);
        break;
      }
      case 4: {
        S3(E, 'root', 0, 0, 0);
        S3(E, 'pelvis', 0, -6, 2);
        S3(E, 'chest', -2, 8, 0);
        S3(E, 'uarmR', 22, 0, 18); S3(E, 'farmR', 40, 0, 0);
        S3(E, 'uarmL', 6, 0, -12); S3(E, 'farmL', 20, 0, 0);
        break;
      }
      case 5: {
        S3(E, 'root', -2, 0, 0);
        S3(E, 'thighR', 86, 0, 6); S3(E, 'thighL', 82, 0, -8);
        S3(E, 'shinR', -88, 0, 0); S3(E, 'shinL', -70, 0, 0);
        S3(E, 'spine1', -6, 0, 0); S3(E, 'chest', -6, 0, 0);
        LR(E, 'uarm', 40, 0, 14); LR(E, 'farm', 60, 0, 0);
        break;
      }
    }
  }
  const FT = [0, 1].map((a) => ({ side: a ? -1 : 1, plant: new V3(), init: false, step: -1, from: new V3(), cur: new V3() }));
  const _fw = new V3(), _rt = new V3(), _home = new V3(), _ank = new V3(), _pole = new V3(), _fq = new THREE.Quaternion(), _fqm = new THREE.Quaternion();
  const HEEL_H = new V3(0, 0.072, 0.07);
  function update(dt, t, s) {
    s = s || {};
    st.dt = F.dt = clamp(typeof dt === 'number' && Number.isFinite(dt) ? dt : 0, 0, 0.1);
    st.t = F.t = typeof t === 'number' && Number.isFinite(t) ? t : st.t + st.dt;
    U.uDvFrame.value = (U.uDvFrame.value + 1) % 64;
    group.updateWorldMatrix(true, false);
    mesh.updateMatrixWorld(true);
    F.mG.copy(mesh.matrixWorld);
    F.mInv.copy(F.mG).invert();
    F.mG.decompose(_v1, F.qG, _v2);
    F.qGi.copy(F.qG).invert();
    F.snap = st.first || st.snapReq || !group.visible;
    if (F.snap) { rig.snap(); FT[0].init = FT[1].init = false; }
    st.first = false; st.snapReq = false;
    let name = typeof s.pose === 'string' ? s.pose : '';
    if (name && name !== st.lastPose) { st.forced = -1; st.lastPose = name; }
    let tg = HUMAN_POSES.indexOf(name);
    if (st.forced >= 0) tg = st.forced;
    if (tg < 0) tg = st.target;
    if (tg !== st.target) { st.target = tg; st.rate = 1 / 0.6; }
    if (F.snap) { w.fill(0); w[tg] = 1; }
    if (w[tg] < 1) { const nt = Math.min(1, w[tg] + st.dt * st.rate), o = 1 - w[tg], k = o > 1e-6 ? (1 - nt) / o : 0; for (let p = 0; p < NP; p++) if (p !== tg) w[p] *= k; w[tg] = nt; }
    const ez = sstep(0, 1, w[tg]), rest = w[tg] < 1 ? (1 - ez) / (1 - w[tg]) : 0;
    for (let p = 0; p < NP; p++) we[p] = p === tg ? ez : w[p] * rest;
    st.phase = typeof s.phase === 'number' && Number.isFinite(s.phase) ? s.phase : st.phase + st.dt * 2.9;
    const tn = clamp(typeof s.lineTension === 'number' ? s.lineTension : 0.2, 0, 1);
    st.tension += (tn - st.tension) * (1 - Math.exp(-st.dt * 4));
    st.brPh += st.dt / st.brLen;
    if (st.brPh >= 1) { st.brPh -= 1; st.brLen = 3.6 + 1.6 * rand() - (we[1] > 0.5 ? 1 : 0); }
    st.lung = st.brPh < 0.4 ? sstep(0, 0.4, st.brPh) : 1 - sstep(0.45, 0.95, st.brPh);
    st.wsideV += (6.5 * (st.wsideT - st.wside) - 5 * st.wsideV) * st.dt; st.wside += st.wsideV * st.dt;
    if (rand() < st.dt * 0.08) st.wsideT = -st.wsideT;
    TB.fill(0);
    let rx = 0, ry = 0, rz = 0;
    for (let p = 0; p < NP; p++) {
      const k = we[p];
      if (k < 1e-4) continue;
      evalPose(p, EP, RP);
      for (let o = 0; o < NBB * 3; o++) TB[o] += EP[o] * k;
      rx += RP[0] * k; ry += RP[1] * k; rz += RP[2] * k;
    }
    const floorY = typeof s.floor === 'number' && Number.isFinite(s.floor) ? s.floor : group.matrixWorld.elements[13];
    if (we[5] > 1e-3) {
      const seatY = typeof s.seat === 'number' && Number.isFinite(s.seat) ? s.seat : floorY + 0.45;
      _v1.set(0, seatY + 0.07, 0).applyMatrix4(F.mInv);
      ry += (_v1.y - (-0.05)) * we[5];
    }
    _v1.set(0, floorY, 0).applyMatrix4(F.mInv);
    ry += clamp(_v1.y + SOLE_H, -0.2, 0.2) * (1 - we[5]);
    RT[0] = rx; RT[1] = ry; RT[2] = rz;
    const tt = st.t;
    TB[J3.head] += 1.5 * Math.sin(tt * 0.31) * DEG; TB[J3.head + 1] += 2 * Math.sin(tt * 0.23 + 1) * DEG;
    for (let a = 0; a < 2; a++) { const S = SIDES[a]; TB[J3['uarm' + S]] += 2 * Math.sin(tt * (0.4 + 0.1 * a) + a) * DEG; TB[J3['farm' + S]] += 3 * Math.sin(tt * 0.33 + a * 2) * DEG; }
    F.stiff = 1.3;
    rig.stepSprings();
    _v1.copy(_Y).applyQuaternion(F.qGi);
    _q1.setFromUnitVectors(_Y, _v1);
    if (F.snap) st.upQ.copy(_q1); else st.upQ.slerp(_q1, 1 - Math.exp(-st.dt * 6));
    Qf[0].premultiply(st.upQ); Pf[0].applyQuaternion(st.upQ);
    rig.helpers(); rig.fkAll();
    const standW = 1 - we[5];
    if (standW > 1e-3) {
      _fw.set(0, 0, -1).applyQuaternion(F.qG); _fw.y = 0; _fw.normalize();
      _rt.set(-_fw.z, 0, _fw.x);
      const heading = Math.atan2(-_fw.x, -_fw.z);
      const wide = we[1] * 0.06 + we[2] * 0.04 + we[3] * 0.04;
      for (let a = 0; a < 2; a++) {
        const f = FT[a];
        _v2.setFromMatrixPosition(group.matrixWorld);
        _home.copy(_v2).addScaledVector(_rt, f.side * (0.11 + wide)).addScaledVector(_fw, (we[1] + we[2]) * (a ? 0.12 : -0.1));
        _home.y = floorY;
        if (!f.init) { f.plant.copy(_home); f.cur.copy(_home); f.init = true; f.step = -1; }
        const off = Math.hypot(f.plant.x - _home.x, f.plant.z - _home.z);
        if (f.step < 0 && off > 0.22 && FT[1 - a].step < 0) { f.step = 0; f.from.copy(f.plant); }
        if (f.step >= 0) {
          f.step += st.dt / 0.45;
          const u = clamp(f.step, 0, 1);
          f.cur.lerpVectors(f.from, _home, sstep(0, 1, u)); f.cur.y += 0.06 * Math.sin(Math.PI * u);
          if (u >= 1) { f.plant.copy(_home); f.step = -1; }
        } else { f.cur.copy(f.plant); f.cur.y = floorY; }
        _e1.set(0, heading + f.side * 0.14, 0, 'YXZ');
        _fq.setFromEuler(_e1);
        _ank.copy(HEEL_H).applyQuaternion(_fq).add(f.cur).applyMatrix4(F.mInv);
        _fqm.copy(F.qGi).multiply(_fq);
        _pole.copy(_fw).addScaledVector(_rt, f.side * 0.2).applyQuaternion(F.qGi);
        rig.solveLeg(a, _ank, _pole, _fqm, standW);
      }
      rig.fkAll();
    }
    const hands = s.hands || null;
    if (hands && hands.right) rig.reach('right', hands.right, 1, { grip: 1 });
    if (hands && hands.left) rig.reach('left', hands.left, 1, { grip: 1 });
    const lineW = we[2] + we[3];
    if (lineW > 1e-3 && s.line && Number.isFinite(s.line.x)) {
      _v3.copy(s.line);
      _fw.set(0, 0, -1).applyQuaternion(F.qG);
      st.payT += st.dt * we[3];
      const c = (st.payT / 1.3) % 1;
      const fwdR = we[3] > 0.5 ? 0.18 * Math.sin(TAU * c) : 0.05, fwdL = we[3] > 0.5 ? 0.18 * Math.sin(TAU * c + Math.PI) : -0.28;
      if (!(hands && hands.right)) rig.reach('right', _v4.copy(_v3).addScaledVector(_fw, fwdR), lineW, { grip: 1 });
      if (!(hands && hands.left)) rig.reach('left', _v4.copy(_v3).addScaledVector(_fw, fwdL).addScaledVector(_Y, -0.04), lineW, { grip: 1 });
    }
    rig.solveArms(0, 0, 0.6);
    rig.helpers(); rig.fkAll();
    let yaw = 0, pitch = 0;
    if (tt >= st.glNext) { st.glY = (rand() - 0.5) * 1.2; st.glP = (rand() - 0.6) * 0.3; st.glEnd = tt + 0.8 + 1.5 * rand(); st.glNext = tt + 3 + 5 * rand(); }
    if (st.glEnd && tt > st.glEnd) { st.glY = st.glP = 0; st.glEnd = 0; }
    const la = s.lookAt;
    _v4.set(0, 0, -1);
    if (la && Number.isFinite(la.x)) {
      _v1.setFromMatrixPosition(Mm[BI.head]).applyMatrix4(F.mG);
      _v4.copy(la).sub(_v1).applyQuaternion(F.qGi).normalize();
      yaw = Math.atan2(-_v4.x, -_v4.z); pitch = Math.asin(clamp(_v4.y, -1, 1));
    }
    yaw = clamp(yaw + st.glY * (la ? 0.3 : 1), -1.3, 1.3); pitch = clamp(pitch + st.glP, -0.7, 0.5);
    rig.lookHead(yaw, pitch, 0.45, 30);
    rig.eyes(_v4, 0.2, rand);
    rig.writeBones();
    group.updateMatrixWorld(true);
    const JB = U.uDvJB.value;
    JB[0] = clamp(EB[J3.farmR] / (130 * DEG), 0, 1); JB[1] = clamp(EB[J3.farmL] / (130 * DEG), 0, 1);
    JB[2] = clamp(-EB[J3.shinR] / (110 * DEG), 0, 1); JB[3] = clamp(-EB[J3.shinL] / (110 * DEG), 0, 1);
    JB[4] = clamp(EB[J3.thighR] / (95 * DEG), 0, 1); JB[5] = clamp(EB[J3.thighL] / (95 * DEG), 0, 1);
    U.uDvBreath.value = st.lung;
    F.snap = false;
  }
  update(0, 0, {});
  const buildMs = +(performance.now() - buildT0).toFixed(1);
  return {
    group, anchors, update,
    setPose(name, blendSeconds = 0.6) { const i = HUMAN_POSES.indexOf(name); if (i < 0) return false; st.forced = i; st.rate = 1 / Math.max(0.05, blendSeconds); return true; },
    reach: rig.reach, hold: rig.hold, reachInfo: rig.reachInfo,
    setFade(a) { const v = clamp(typeof a === 'number' ? a : 1, 0, 1); U.uDvFade.value = v; group.visible = v > 0.003; },
    snap() { st.snapReq = true; },
    get pose() { return HUMAN_POSES[st.target]; },
    info: { triangles: A.I.length / 3, vertices: A.P.length / 3, drawCalls: 1, buildMs, role, cap: capK, shirt: shirtK, vraka: vrakaK },
    dispose() { group.removeFromParent(); geo.dispose(); mat.dispose(); skeleton.dispose(); },
  };
}

var diver = Object.freeze({
  __proto__: null,
  createDiver: createDiver,
  createHuman: createHuman
});

