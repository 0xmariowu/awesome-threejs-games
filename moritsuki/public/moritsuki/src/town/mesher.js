// 頂点を数値のまま積んでいく軽いジオメトリビルダー
import * as THREE from 'three';

export class Mesher {
  constructor(extra = {}) {
    this.p = []; this.n = []; this.c = []; this.i = [];
    this.extra = {};
    for (const k in extra) this.extra[k] = { size: extra[k], a: [] };
  }
  get count() { return this.p.length / 3; }
  v(x, y, z, nx, ny, nz, c, ex) {
    this.p.push(x, y, z); this.n.push(nx, ny, nz); this.c.push(c.r, c.g, c.b);
    for (const k in this.extra) {
      const e = this.extra[k], val = ex && ex[k];
      if (e.size === 1) e.a.push(val ?? 0); else for (let q = 0; q < e.size; q++) e.a.push(val ? val[q] : 0);
    }
    return this.count - 1;
  }
  tri(a, b, c) { this.i.push(a, b, c); }
  quad(a, b, c, d) { this.i.push(a, b, c, a, c, d); }
  // 平らな四角形（4 点は反時計回り、法線は自動）
  face(pts, c, ex) {
    const [a, b, d] = pts;
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = d[0] - a[0], vy = d[1] - a[1], vz = d[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    const base = this.count;
    pts.forEach((q, k) => this.v(q[0], q[1], q[2], nx, ny, nz, c, Array.isArray(ex) ? ex[k] : ex));
    if (pts.length === 4) this.quad(base, base + 1, base + 2, base + 3); else this.tri(base, base + 1, base + 2);
  }
  // 軸に沿った直方体（中心・大きさ・y 回転）
  box(cx, cy, cz, sx, sy, sz, yaw, c, ex, faces = 63) {
    const s = Math.sin(yaw), co = Math.cos(yaw);
    const P = (x, y, z) => [cx + x * co + z * s, cy + y, cz - x * s + z * co];
    const hx = sx / 2, hy = sy / 2, hz = sz / 2;
    const F = [
      [[-hx, -hy, hz], [hx, -hy, hz], [hx, hy, hz], [-hx, hy, hz]],
      [[hx, -hy, -hz], [-hx, -hy, -hz], [-hx, hy, -hz], [hx, hy, -hz]],
      [[hx, -hy, hz], [hx, -hy, -hz], [hx, hy, -hz], [hx, hy, hz]],
      [[-hx, -hy, -hz], [-hx, -hy, hz], [-hx, hy, hz], [-hx, hy, -hz]],
      [[-hx, hy, hz], [hx, hy, hz], [hx, hy, -hz], [-hx, hy, -hz]],
      [[-hx, -hy, -hz], [hx, -hy, -hz], [hx, -hy, hz], [-hx, -hy, hz]],
    ];
    F.forEach((f, k) => { if (faces & (1 << k)) this.face(f.map((q) => P(...q)), c, ex); });
  }
  // 既存ジオメトリを取り込む
  merge(geo, m, c, ex) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    const P = g.attributes.position, N = g.attributes.normal, nm = new THREE.Matrix3().getNormalMatrix(m);
    const v = new THREE.Vector3(), n = new THREE.Vector3(), base = this.count;
    const gc = g.attributes.color;
    const tmp = new THREE.Color();
    for (let k = 0; k < P.count; k++) {
      v.fromBufferAttribute(P, k).applyMatrix4(m);
      n.fromBufferAttribute(N, k).applyMatrix3(nm).normalize();
      const cc = typeof c === 'function' ? c(v, n, k) : gc ? tmp.fromBufferAttribute(gc, k).multiply(c) : c;
      this.v(v.x, v.y, v.z, n.x, n.y, n.z, cc, typeof ex === 'function' ? ex(v, n, k) : ex);
    }
    for (let k = 0; k < P.count; k++) this.i.push(base + k);
  }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    for (const k in this.extra) g.setAttribute(k, new THREE.Float32BufferAttribute(this.extra[k].a, this.extra[k].size));
    g.setIndex(this.count > 65535 ? new THREE.Uint32BufferAttribute(this.i, 1) : new THREE.Uint16BufferAttribute(this.i, 1));
    g.computeBoundingSphere();
    return g;
  }
}

// 折れ線を間隔 s で打ち直す（各点に進行方向と累積距離）
export function resample(p, s) {
  const out = [];
  let acc = 0;
  for (let k = 0; k < p.length - 1; k++) {
    const [ax, az] = p[k], [bx, bz] = p[k + 1];
    const l = Math.hypot(bx - ax, bz - az);
    if (l < 1e-3) continue;
    const n = Math.max(1, Math.ceil(l / s));
    for (let q = 0; q < n; q++) out.push({ x: ax + (bx - ax) * q / n, z: az + (bz - az) * q / n, d: acc + l * q / n, seg: k });
    acc += l;
  }
  const [lx, lz] = p[p.length - 1];
  out.push({ x: lx, z: lz, d: acc, seg: p.length - 2 });
  // 左右の法線（角ではならす）
  for (let k = 0; k < out.length; k++) {
    const a = out[Math.max(0, k - 1)], b = out[Math.min(out.length - 1, k + 1)];
    const dx = b.x - a.x, dz = b.z - a.z, l = Math.hypot(dx, dz) || 1;
    out[k].tx = dx / l; out[k].tz = dz / l;
    out[k].nx = -dz / l; out[k].nz = dx / l;
  }
  return out;
}
