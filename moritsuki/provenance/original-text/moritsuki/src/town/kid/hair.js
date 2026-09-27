// 髪の房: 曲線に沿って平たい楕円の断面を流し、先を尖らせたメッシュ（three.js に依存しない）
// 頭の中心（原点）から外向きの方向に薄く、頭の表面に沿って広い

// 2 次ベジェの点と接線
function bez(p0, p1, p2, t, out, tan) {
  const a = (1 - t) * (1 - t), b = 2 * (1 - t) * t, c = t * t;
  for (let k = 0; k < 3; k++) {
    out[k] = a * p0[k] + b * p1[k] + c * p2[k];
    tan[k] = 2 * (1 - t) * (p1[k] - p0[k]) + 2 * t * (p2[k] - p1[k]);
  }
}
const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; v[0] /= l; v[1] /= l; v[2] /= l; return v; };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

// locks: [{ p: [p0, p1, p2], w: 付け根の半幅, t: 付け根の半分の厚み, twist? }]
export function sweepLocks(locks, { along = 14, around = 14 } = {}) {
  const P = [], N = [], I = [];
  const c = [0, 0, 0], tan = [0, 0, 0];
  for (const L of locks) {
    const base = P.length / 3;
    const [p0, p1, p2] = L.p;
    for (let j = 0; j <= along; j++) {
      const u = j / along;
      bez(p0, p1, p2, u, c, tan);
      norm(tan);
      // 外向き（頭の中心から）を接線に直交させる
      let n = [c[0], c[1] + 0.01, c[2]];
      const d = n[0] * tan[0] + n[1] * tan[1] + n[2] * tan[2];
      n = norm([n[0] - tan[0] * d, n[1] - tan[1] * d, n[2] - tan[2] * d]);
      let b = norm(cross(tan, n));
      if (L.twist) {
        const a = L.twist * u, ca = Math.cos(a), sa = Math.sin(a);
        const nn = [n[0] * ca + b[0] * sa, n[1] * ca + b[1] * sa, n[2] * ca + b[2] * sa];
        b = [b[0] * ca - n[0] * sa, b[1] * ca - n[1] * sa, b[2] * ca - n[2] * sa];
        n = nn;
      }
      // 幅: 付け根から少しふくらみ、先で 0 に
      const prof = Math.pow(1 - u, 0.9) * (0.82 + 0.18 * Math.sin(Math.min(u * 2.2, 1) * Math.PI / 2));
      const W = L.w * prof + 1e-5, T = L.t * prof + 1e-5;
      for (let i = 0; i <= around; i++) {
        const f = (i / around) * Math.PI * 2;
        const cf = Math.cos(f), sf = Math.sin(f);
        // 外側（sf > 0）はふっくら、内側は平ら
        const tt = sf > 0 ? T : T * 0.45;
        P.push(c[0] + b[0] * W * cf + n[0] * tt * sf, c[1] + b[1] * W * cf + n[1] * tt * sf, c[2] + b[2] * W * cf + n[2] * tt * sf);
        const nx = b[0] * cf / W + n[0] * sf / tt, ny = b[1] * cf / W + n[1] * sf / tt, nz = b[2] * cf / W + n[2] * sf / tt;
        const l = Math.hypot(nx, ny, nz) || 1;
        N.push(nx / l, ny / l, nz / l);
      }
    }
    for (let j = 0; j < along; j++) for (let i = 0; i < around; i++) {
      const a = base + j * (around + 1) + i, b2 = a + 1, cc = a + around + 1, dd = cc + 1;
      I.push(a, cc, b2, b2, cc, dd);
    }
  }
  return { pos: new Float32Array(P), nrm: new Float32Array(N), idx: new Uint32Array(I), count: P.length / 3 };
}

// 2 つのメッシュ配列をつなぐ
export function mergeMesh(a, b) {
  const idx = new Uint32Array(a.idx.length + b.idx.length);
  idx.set(a.idx);
  for (let i = 0; i < b.idx.length; i++) idx[a.idx.length + i] = b.idx[i] + a.count;
  const pos = new Float32Array(a.pos.length + b.pos.length); pos.set(a.pos); pos.set(b.pos, a.pos.length);
  const nrm = new Float32Array(a.nrm.length + b.nrm.length); nrm.set(a.nrm); nrm.set(b.nrm, a.nrm.length);
  return { pos, nrm, idx, count: a.count + b.count };
}
