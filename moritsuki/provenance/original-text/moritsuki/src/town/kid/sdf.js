// 距離関数（SDF）の部品と、そこから滑らかなメッシュを作る Surface Nets
// three.js に依存しない（数値の配列だけを返す）

export const smin = (a, b, k) => {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
};
export const smax = (a, b, k) => -smin(-a, -b, k);
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const sstep = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export const mix = (a, b, t) => a + (b - a) * t;

// 回転（オイラー XYZ, ラジアン）の逆行列。点を部品のローカルへ移す
function rotInv(e) {
  if (!e) return null;
  const [x, y, z] = e;
  const cx = Math.cos(x), sx = Math.sin(x), cy = Math.cos(y), sy = Math.sin(y), cz = Math.cos(z), sz = Math.sin(z);
  // R = Rx * Ry * Rz（three.js の 'XYZ' と同じ）
  const m = [
    cy * cz, -cy * sz, sy,
    cx * sz + sx * sy * cz, cx * cz - sx * sy * sz, -sx * cy,
    sx * sz - cx * sy * cz, sx * cz + cx * sy * sz, cx * cy,
  ];
  // 転置 = 逆
  return [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];
}

const local = (m, c, x, y, z, out) => {
  const px = x - c[0], py = y - c[1], pz = z - c[2];
  if (!m) { out[0] = px; out[1] = py; out[2] = pz; return; }
  out[0] = m[0] * px + m[1] * py + m[2] * pz;
  out[1] = m[3] * px + m[4] * py + m[5] * pz;
  out[2] = m[6] * px + m[7] * py + m[8] * pz;
};

// 両端で太さの違うカプセル
export function capsule(a, b, ra, rb = ra) {
  const ax = a[0], ay = a[1], az = a[2];
  const bx = b[0] - ax, by = b[1] - ay, bz = b[2] - az;
  const l2 = bx * bx + by * by + bz * bz;
  return (x, y, z) => {
    const px = x - ax, py = y - ay, pz = z - az;
    let t = (px * bx + py * by + pz * bz) / l2;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const dx = px - bx * t, dy = py - by * t, dz = pz - bz * t;
    return Math.sqrt(dx * dx + dy * dy + dz * dz) - (ra + (rb - ra) * t);
  };
}

// 楕円体（近似距離）
export function ellipsoid(c, r, e) {
  const m = rotInv(e), q = [0, 0, 0];
  const [r0, r1, r2] = r, rmin = Math.min(r0, r1, r2);
  return (x, y, z) => {
    local(m, c, x, y, z, q);
    const a = q[0] / r0, b = q[1] / r1, cc = q[2] / r2;
    const k0 = Math.sqrt(a * a + b * b + cc * cc);
    const k1 = Math.sqrt((a * a) / (r0 * r0) + (b * b) / (r1 * r1) + (cc * cc) / (r2 * r2));
    return k1 > 1e-9 ? (k0 * (k0 - 1)) / k1 : -rmin;
  };
}

// 角の丸い箱
export function roundBox(c, half, rad, e) {
  const m = rotInv(e), q = [0, 0, 0];
  return (x, y, z) => {
    local(m, c, x, y, z, q);
    const dx = Math.abs(q[0]) - half[0] + rad, dy = Math.abs(q[1]) - half[1] + rad, dz = Math.abs(q[2]) - half[2] + rad;
    const ox = Math.max(dx, 0), oy = Math.max(dy, 0), oz = Math.max(dz, 0);
    return Math.sqrt(ox * ox + oy * oy + oz * oz) + Math.min(Math.max(dx, dy, dz), 0) - rad;
  };
}

// ドーナツ（ローカル y 軸まわり）
export function torus(c, R, r, e) {
  const m = rotInv(e), q = [0, 0, 0];
  return (x, y, z) => {
    local(m, c, x, y, z, q);
    const a = Math.hypot(q[0], q[2]) - R;
    return Math.hypot(a, q[1]) - r;
  };
}

// 箱 [x0,y0,z0,x1,y1,z1] から margin 以上離れていたら、中身を計算せず箱までの距離（真の距離以下）を返す
export function bounded(f, box, margin = 0.06) {
  const [x0, y0, z0, x1, y1, z1] = box;
  return (x, y, z) => {
    const dx = Math.max(x0 - x, 0, x - x1), dy = Math.max(y0 - y, 0, y - y1), dz = Math.max(z0 - z, 0, z - z1);
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    return d > margin ? d : f(x, y, z);
  };
}

// 平面の表側までの距離（n の向きが外）
export function plane(p, n) {
  const l = Math.hypot(n[0], n[1], n[2]);
  const nx = n[0] / l, ny = n[1] / l, nz = n[2] / l;
  return (x, y, z) => (x - p[0]) * nx + (y - p[1]) * ny + (z - p[2]) * nz;
}

// ---------------------------------------------------------------
// Surface Nets。表面の近くだけ細かく評価し、頂点は表面へ投影して法線は勾配から取る
// opts.cull(x,y,z) が真を返す頂点だけで出来た三角形は捨てる（服の下の肌など）
export function meshSDF(f, bounds, h, opts = {}) {
  const C = 4;
  const [x0, y0, z0] = bounds;
  const cells = (a, b) => Math.ceil((b - a) / (h * C)) * C;
  const cx = cells(bounds[0], bounds[3]), cy = cells(bounds[1], bounds[4]), cz = cells(bounds[2], bounds[5]);
  const nx = cx + 1, ny = cy + 1, nz = cz + 1;
  const sxy = nx * ny;
  const val = new Float32Array(nx * ny * nz).fill(NaN);
  const idx = (i, j, k) => i + j * nx + k * sxy;
  const at = (i, j, k) => f(x0 + i * h, y0 + j * h, z0 + k * h);

  // 粗い格子で表面から遠いブロックを見分ける
  const bx = cx / C, by = cy / C, bz = cz / C;
  const cnx = bx + 1, cny = by + 1;
  const coarse = new Float32Array(cnx * cny * (bz + 1));
  for (let k = 0; k <= bz; k++) for (let j = 0; j <= by; j++) for (let i = 0; i <= bx; i++) {
    coarse[i + j * cnx + k * cnx * cny] = at(i * C, j * C, k * C);
  }
  const thr = C * h * 1.9;
  const far = new Uint8Array(bx * by * bz);
  for (let k = 0; k < bz; k++) for (let j = 0; j < by; j++) for (let i = 0; i < bx; i++) {
    let mn = Infinity, pos = 0, neg = 0;
    for (let c = 0; c < 8; c++) {
      const v = coarse[(i + (c & 1)) + (j + ((c >> 1) & 1)) * cnx + (k + (c >> 2)) * cnx * cny];
      mn = Math.min(mn, Math.abs(v));
      if (v > 0) pos++; else neg++;
    }
    const b = i + j * bx + k * bx * by;
    if (mn > thr && (pos === 8 || neg === 8)) far[b] = pos === 8 ? 1 : 2;
  }
  // 近いブロックは細かく（先に全部）、遠いブロックは符号だけ埋める
  for (let pass = 0; pass < 2; pass++) {
    for (let k = 0; k < bz; k++) for (let j = 0; j < by; j++) for (let i = 0; i < bx; i++) {
      const fb = far[i + j * bx + k * bx * by];
      if ((pass === 0) !== (fb === 0)) continue;
      const fill = fb === 1 ? thr : -thr;
      for (let kk = k * C; kk <= k * C + C; kk++) for (let jj = j * C; jj <= j * C + C; jj++) for (let ii = i * C; ii <= i * C + C; ii++) {
        const q = idx(ii, jj, kk);
        if (val[q] === val[q]) continue;
        val[q] = pass === 0 ? at(ii, jj, kk) : fill;
      }
    }
  }

  // 各セルに頂点を 1 つ
  const vmap = new Int32Array(cx * cy * cz).fill(-1);
  const cidx = (i, j, k) => i + j * cx + k * cx * cy;
  const P = [];
  const EDGES = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  const cv = new Float32Array(8);
  for (let k = 0; k < cz; k++) for (let j = 0; j < cy; j++) for (let i = 0; i < cx; i++) {
    if (far[((i / C) | 0) + ((j / C) | 0) * bx + ((k / C) | 0) * bx * by]) continue;
    let mask = 0;
    for (let c = 0; c < 8; c++) {
      const v = val[idx(i + (c & 1), j + ((c >> 1) & 1), k + (c >> 2))];
      cv[c] = v;
      if (v < 0) mask |= 1 << c;
    }
    if (mask === 0 || mask === 255) continue;
    let sx = 0, sy = 0, sz = 0, n = 0;
    for (const [a, b] of EDGES) {
      const va = cv[a], vb = cv[b];
      if ((va < 0) === (vb < 0)) continue;
      const t = va / (va - vb);
      sx += (a & 1) + (((b & 1) - (a & 1)) * t);
      sy += ((a >> 1) & 1) + ((((b >> 1) & 1) - ((a >> 1) & 1)) * t);
      sz += (a >> 2) + (((b >> 2) - (a >> 2)) * t);
      n++;
    }
    vmap[cidx(i, j, k)] = P.length / 3;
    P.push(x0 + (i + sx / n) * h, y0 + (j + sy / n) * h, z0 + (k + sz / n) * h);
  }

  // 表面へ投影し、法線を勾配から
  const nv = P.length / 3;
  const pos = new Float32Array(P), nrm = new Float32Array(nv * 3);
  const e = h * 0.25;
  for (let v = 0; v < nv; v++) {
    let x = pos[v * 3], y = pos[v * 3 + 1], z = pos[v * 3 + 2];
    let gx = 0, gy = 0, gz = 0;
    // 正四面体の 4 点で値と勾配をまとめて取る
    for (let it = 0; it < 3; it++) {
      const f1 = f(x + e, y - e, z - e), f2 = f(x - e, y - e, z + e), f3 = f(x - e, y + e, z - e), f4 = f(x + e, y + e, z + e);
      gx = f1 - f2 - f3 + f4; gy = -f1 - f2 + f3 + f4; gz = -f1 + f2 - f3 + f4;
      const d = (f1 + f2 + f3 + f4) * 0.25;
      const g2 = (gx * gx + gy * gy + gz * gz) / (16 * e * e);
      if (it === 2 || g2 < 1e-8) break;
      let s = d / g2 / (4 * e);
      const step = Math.abs(s) * Math.sqrt(g2) * 4 * e;
      if (step > h * 0.7) s *= (h * 0.7) / step;
      x -= gx * s; y -= gy * s; z -= gz * s;
    }
    pos[v * 3] = x; pos[v * 3 + 1] = y; pos[v * 3 + 2] = z;
    const l = Math.hypot(gx, gy, gz) || 1;
    nrm[v * 3] = gx / l; nrm[v * 3 + 1] = gy / l; nrm[v * 3 + 2] = gz / l;
  }

  // 符号の変わる辺ごとに四角形（短い対角線で三角形 2 つ）
  const I = [];
  const dist2 = (a, b) => {
    const dx = pos[a * 3] - pos[b * 3], dy = pos[a * 3 + 1] - pos[b * 3 + 1], dz = pos[a * 3 + 2] - pos[b * 3 + 2];
    return dx * dx + dy * dy + dz * dz;
  };
  const quad = (a, b, c, d, flip) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    if (flip) { const t = b; b = d; d = t; }
    if (dist2(a, c) < dist2(b, d)) I.push(a, b, c, a, c, d);
    else I.push(a, b, d, b, c, d);
  };
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const v0 = val[idx(i, j, k)];
    const in0 = v0 < 0;
    // x 方向の辺
    if (i < cx && j > 0 && k > 0 && j < cy && k < cz) {
      const in1 = val[idx(i + 1, j, k)] < 0;
      if (in0 !== in1) quad(vmap[cidx(i, j - 1, k - 1)], vmap[cidx(i, j, k - 1)], vmap[cidx(i, j, k)], vmap[cidx(i, j - 1, k)], !in0);
    }
    // y 方向の辺
    if (j < cy && i > 0 && k > 0 && i < cx && k < cz) {
      const in1 = val[idx(i, j + 1, k)] < 0;
      if (in0 !== in1) quad(vmap[cidx(i - 1, j, k - 1)], vmap[cidx(i - 1, j, k)], vmap[cidx(i, j, k)], vmap[cidx(i, j, k - 1)], !in0);
    }
    // z 方向の辺
    if (k < cz && i > 0 && j > 0 && i < cx && j < cy) {
      const in1 = val[idx(i, j, k + 1)] < 0;
      if (in0 !== in1) quad(vmap[cidx(i - 1, j - 1, k)], vmap[cidx(i, j - 1, k)], vmap[cidx(i, j, k)], vmap[cidx(i - 1, j, k)], !in0);
    }
  }

  let index = I;
  if (opts.cull) {
    const hide = new Uint8Array(nv);
    for (let v = 0; v < nv; v++) hide[v] = opts.cull(pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]) ? 1 : 0;
    index = [];
    for (let t = 0; t < I.length; t += 3) if (!(hide[I[t]] && hide[I[t + 1]] && hide[I[t + 2]])) index.push(I[t], I[t + 1], I[t + 2]);
  }
  return { pos, nrm, idx: new Uint32Array(index), count: nv };
}
