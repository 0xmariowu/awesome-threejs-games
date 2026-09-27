// sdf.js
const clamp01$1 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

function smin$2(a, b, k) {
  const h = clamp01$1(0.5 + (0.5 * (b - a)) / k);
  return b + (a - b) * h - k * h * (1 - h);
}

function sdSphere(px, py, pz, cx, cy, cz, r) {
  return Math.hypot(px - cx, py - cy, pz - cz) - r;
}

function sdCone$1(px, py, pz, a, b, ra, rb) {
  const pax = px - a[0], pay = py - a[1], paz = pz - a[2];
  const bax = b[0] - a[0], bay = b[1] - a[1], baz = b[2] - a[2];
  const h = clamp01$1((pax * bax + pay * bay + paz * baz) / (bax * bax + bay * bay + baz * baz));
  return Math.hypot(pax - bax * h, pay - bay * h, paz - baz * h) - (ra + (rb - ra) * h);
}

function sdEllipsoid$1(px, py, pz, c, r) {
  const x = (px - c[0]) / r[0], y = (py - c[1]) / r[1], z = (pz - c[2]) / r[2];
  const k0 = Math.hypot(x, y, z);
  const k1 = Math.hypot(x / r[0], y / r[1], z / r[2]);
  return k1 > 1e-9 ? (k0 * (k0 - 1)) / k1 : -Math.min(r[0], r[1], r[2]);
}

function surfaceNets$2(sdf, min, max, step) {
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
  const cellVert = new Int32Array((nx - 1) * (ny - 1) * (nz - 1)).fill(-1);
  const pos = [];
  const CO = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
  const ED = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  const cv = new Float32Array(8);
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
        for (let e = 0; e < 12; e++) {
          const a = ED[e][0], b = ED[e][1];
          const va = cv[a], vb = cv[b];
          if ((va < 0) !== (vb < 0)) {
            const t = va / (va - vb);
            sx += CO[a][0] + (CO[b][0] - CO[a][0]) * t;
            sy += CO[a][1] + (CO[b][1] - CO[a][1]) * t;
            sz += CO[a][2] + (CO[b][2] - CO[a][2]) * t;
            cnt++;
          }
        }
        cellVert[cidx(x, y, z)] = pos.length / 3;
        pos.push(min[0] + (x + sx / cnt) * step, min[1] + (y + sy / cnt) * step, min[2] + (z + sz / cnt) * step);
      }
    }
  }
  const tris = [];
  const quad = (a, b, c, d) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    tris.push(a, b, c, a, c, d);
  };
  for (let z = 1; z < nz - 1; z++) {
    for (let y = 1; y < ny - 1; y++) {
      for (let x = 1; x < nx - 1; x++) {
        const s0 = vals[idx(x, y, z)] < 0;
        if (s0 !== (vals[idx(x + 1, y, z)] < 0)) {
          quad(cellVert[cidx(x, y - 1, z - 1)], cellVert[cidx(x, y, z - 1)], cellVert[cidx(x, y, z)], cellVert[cidx(x, y - 1, z)]);
        }
        if (s0 !== (vals[idx(x, y + 1, z)] < 0)) {
          quad(cellVert[cidx(x - 1, y, z - 1)], cellVert[cidx(x, y, z - 1)], cellVert[cidx(x, y, z)], cellVert[cidx(x - 1, y, z)]);
        }
        if (s0 !== (vals[idx(x, y, z + 1)] < 0)) {
          quad(cellVert[cidx(x - 1, y - 1, z)], cellVert[cidx(x, y - 1, z)], cellVert[cidx(x, y, z)], cellVert[cidx(x - 1, y, z)]);
        }
      }
    }
  }
  const nrm = new Float32Array(pos.length);
  const e = step * 0.5;
  for (let i = 0; i < pos.length; i += 3) {
    const x = pos[i], y = pos[i + 1], z = pos[i + 2];
    let gx = sdf(x + e, y, z) - sdf(x - e, y, z);
    let gy = sdf(x, y + e, z) - sdf(x, y - e, z);
    let gz = sdf(x, y, z + e) - sdf(x, y, z - e);
    const l = Math.hypot(gx, gy, gz) || 1;
    nrm[i] = gx / l; nrm[i + 1] = gy / l; nrm[i + 2] = gz / l;
  }
  for (let t = 0; t < tris.length; t += 3) {
    const a = tris[t] * 3, b = tris[t + 1] * 3, c = tris[t + 2] * 3;
    const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2];
    const vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
    const fx = uy * vz - uz * vy, fy = uz * vx - ux * vz, fz = ux * vy - uy * vx;
    const nx2 = nrm[a] + nrm[b] + nrm[c], ny2 = nrm[a + 1] + nrm[b + 1] + nrm[c + 1], nz2 = nrm[a + 2] + nrm[b + 2] + nrm[c + 2];
    if (fx * nx2 + fy * ny2 + fz * nz2 < 0) { const tmp = tris[t + 1]; tris[t + 1] = tris[t + 2]; tris[t + 2] = tmp; }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  geo.setIndex(tris);
  return geo;
}

