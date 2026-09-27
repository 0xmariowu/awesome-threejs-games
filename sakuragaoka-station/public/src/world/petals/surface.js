// Surface index: bins every near-horizontal triangle of the static scenery (built by the modules
// before us) into a 2D grid so petals can be laid EXACTLY on what is rendered — asphalt (with its
// lift), curbs, sidewalks, plaza paving, platform tops, ballast, bench seats, table tops, vending
// machine tops — and so roofs / eaves / shelters can be detected (petals never lie or fall indoors).
// Excluded: sakura trees (their canopies must not count as roofs), instanced meshes, the no-outline
// layer (alpha cards), dynamic objects. With no scenery at all every query returns NaN and callers
// fall back to the analytic terrain.
import * as THREE from 'three';

export function createSurfaceIndex(ctx, { x0 = -135, x1 = 135, z0 = -122, z1 = 140, cell = 1.0, maxAbove = 11 } = {}) {
  const L = ctx.L;
  const nx = Math.ceil((x1 - x0) / cell), nz = Math.ceil((z1 - z0) / cell);
  let tris = new Float32Array(9 * 65536); let nt = 0;
  const grow = () => { const t = new Float32Array(tris.length * 2); t.set(tris); tris = t; };
  const root = ctx.staticRoot;
  root.updateMatrixWorld(true);
  const skip = (o) => {
    for (let p = o; p && p !== root; p = p.parent) {
      const n = p.name || '';
      if (n.startsWith('sakura') || n.startsWith('petals') || n === 'wires') return true;
    }
    return false;
  };
  const v = new THREE.Vector3();
  const meshes = [];
  root.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh) return;
    if (!(o.layers.mask & 1)) return;
    if (!o.visible) return;
    meshes.push(o);
  });
  for (const o of meshes) {
    if (skip(o)) continue;
    const g = o.geometry; const pa = g && g.attributes.position; if (!pa) continue;
    if (!g.boundingBox) g.computeBoundingBox();
    const bb = g.boundingBox.clone().applyMatrix4(o.matrixWorld);
    if (bb.max.x < x0 || bb.min.x > x1 || bb.max.z < z0 || bb.min.z > z1) continue;
    const n = pa.count; const W = new Float32Array(n * 3);
    const e = o.matrixWorld.elements;
    for (let i = 0; i < n; i++) {
      const x = pa.getX(i), y = pa.getY(i), z = pa.getZ(i);
      W[i * 3] = e[0] * x + e[4] * y + e[8] * z + e[12];
      W[i * 3 + 1] = e[1] * x + e[5] * y + e[9] * z + e[13];
      W[i * 3 + 2] = e[2] * x + e[6] * y + e[10] * z + e[14];
    }
    const idx = g.index ? g.index.array : null;
    const m = idx ? idx.length : n;
    const d0 = g.drawRange.start || 0, dc = Math.min(m, d0 + (Number.isFinite(g.drawRange.count) ? g.drawRange.count : m));
    for (let k = d0; k + 2 < dc; k += 3) {
      const a = idx ? idx[k] : k, b = idx ? idx[k + 1] : k + 1, c = idx ? idx[k + 2] : k + 2;
      const ax = W[a * 3], ay = W[a * 3 + 1], az = W[a * 3 + 2];
      const bx = W[b * 3], by = W[b * 3 + 1], bz = W[b * 3 + 2];
      const cx = W[c * 3], cy = W[c * 3 + 1], cz = W[c * 3 + 2];
      const ux = bx - ax, uy = by - ay, uz = bz - az, wx = cx - ax, wy = cy - ay, wz = cz - az;
      const Nx = uy * wz - uz * wy, Ny = uz * wx - ux * wz, Nz = ux * wy - uy * wx;
      const len = Math.hypot(Nx, Ny, Nz); if (len < 1e-9) continue;
      if (Math.abs(Ny) / len < 0.38) continue;           // walls / vertical faces
      const mnx = Math.min(ax, bx, cx), mxx = Math.max(ax, bx, cx), mnz = Math.min(az, bz, cz), mxz = Math.max(az, bz, cz);
      if (mxx < x0 || mnx > x1 || mxz < z0 || mnz > z1) continue;
      const my = Math.min(ay, by, cy);
      const hc = L.heightAt((mnx + mxx) / 2, (mnz + mxz) / 2);
      if (my > hc + maxAbove) continue;                  // high roofs / canopies are irrelevant
      if (nt * 9 + 9 > tris.length) grow();
      const q = nt * 9;
      tris[q] = ax; tris[q + 1] = ay; tris[q + 2] = az; tris[q + 3] = bx; tris[q + 4] = by; tris[q + 5] = bz;
      tris[q + 6] = cx; tris[q + 7] = cy; tris[q + 8] = cz; nt++;
    }
  }
  // CSR bins
  const counts = new Uint32Array(nx * nz + 1);
  const range = (t, fn) => {
    const o = t * 9;
    const mnx = Math.min(tris[o], tris[o + 3], tris[o + 6]), mxx = Math.max(tris[o], tris[o + 3], tris[o + 6]);
    const mnz = Math.min(tris[o + 2], tris[o + 5], tris[o + 8]), mxz = Math.max(tris[o + 2], tris[o + 5], tris[o + 8]);
    const i0 = Math.max(0, Math.floor((mnx - x0) / cell)), i1 = Math.min(nx - 1, Math.floor((mxx - x0) / cell));
    const j0 = Math.max(0, Math.floor((mnz - z0) / cell)), j1 = Math.min(nz - 1, Math.floor((mxz - z0) / cell));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) fn(j * nx + i);
  };
  for (let t = 0; t < nt; t++) range(t, (c) => counts[c + 1]++);
  for (let c = 0; c < nx * nz; c++) counts[c + 1] += counts[c];
  const list = new Uint32Array(counts[nx * nz]);
  const fill = counts.slice(0, nx * nz);
  for (let t = 0; t < nt; t++) range(t, (c) => { list[fill[c]++] = t; });

  /** visit y of every triangle covering (x,z) */
  function each(x, z, fn) {
    const i = Math.floor((x - x0) / cell), j = Math.floor((z - z0) / cell);
    if (i < 0 || j < 0 || i >= nx || j >= nz) return;
    const c = j * nx + i;
    for (let k = counts[c]; k < counts[c + 1]; k++) {
      const o = list[k] * 9;
      const ax = tris[o], az = tris[o + 2], bx = tris[o + 3], bz = tris[o + 5], cx = tris[o + 6], cz = tris[o + 8];
      const d = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
      if (Math.abs(d) < 1e-12) continue;
      const l1 = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / d;
      const l2 = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / d;
      const l3 = 1 - l1 - l2;
      if (l1 < -1e-6 || l2 < -1e-6 || l3 < -1e-6) continue;
      fn(l1 * tris[o + 1] + l2 * tris[o + 4] + l3 * tris[o + 7]);
    }
  }
  /** highest rendered surface at (x,z) with lo <= y <= hi (NaN if none) */
  function top(x, z, lo, hi) {
    let best = -Infinity;
    each(x, z, (y) => { if (y >= lo && y <= hi && y > best) best = y; });
    return best === -Infinity ? NaN : best;
  }
  /** lowest surface strictly above y0 (up to y1) — a roof, eave, shelter, table… (Infinity if none) */
  function cover(x, z, y0, y1 = y0 + 12) {
    let best = Infinity;
    each(x, z, (y) => { if (y > y0 && y <= y1 && y < best) best = y; });
    return best;
  }
  return { top, cover, count: nt, get empty() { return nt === 0; }, bounds: { x0, x1, z0, z1 } };
}
