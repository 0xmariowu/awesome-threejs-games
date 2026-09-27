// 髪の房のメッシュ（three.js に依存しない）: 曲線に沿って平たい楕円の断面を流し、先を尖らせる。
// kid/hair.js と同じ考え方で、外向きの向きを房ごとに決められる（ポニーテールは束の軸から外）。
// 毛の流れの向き（hairDir）も頂点ごとに返す（シェーダーのつや・溝に使う）。

function bez(p0, p1, p2, t, out, tan) {
  const a = (1 - t) * (1 - t), b = 2 * (1 - t) * t, c = t * t;
  for (let k = 0; k < 3; k++) {
    out[k] = a * p0[k] + b * p1[k] + c * p2[k];
    tan[k] = 2 * (1 - t) * (p1[k] - p0[k]) + 2 * t * (p2[k] - p1[k]);
  }
}
const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; v[0] /= l; v[1] /= l; v[2] /= l; return v; };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

// locks: [{ p: [p0, p1, p2], w: 付け根の半幅, t: 付け根の半分の厚み, twist?, out?(c) → 外向きの基準点, taper? }]
export function sweepStrands(locks, { along = 14, around = 10 } = {}) {
  const P = [], N = [], T = [], I = [];
  const c = [0, 0, 0], tan = [0, 0, 0];
  for (const L of locks) {
    const base = P.length / 3;
    const [p0, p1, p2] = L.p;
    const o = L.o || [0, 0.01, 0];
    for (let j = 0; j <= along; j++) {
      const u = j / along;
      bez(p0, p1, p2, u, c, tan);
      norm(tan);
      const oc = typeof o === 'function' ? o(u, c) : o;
      let n = [c[0] - oc[0], c[1] - oc[1], c[2] - oc[2]];
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
      const tp = L.taper ?? 0.9;
      const prof = Math.pow(1 - u, tp) * (0.8 + 0.2 * Math.sin(Math.min(u * 2.2, 1) * Math.PI / 2));
      const W = L.w * prof + 1e-5, Th = L.t * prof + 1e-5;
      for (let i = 0; i <= around; i++) {
        const f = (i / around) * Math.PI * 2;
        const cf = Math.cos(f), sf = Math.sin(f);
        const tt = sf > 0 ? Th : Th * 0.45;
        P.push(c[0] + b[0] * W * cf + n[0] * tt * sf, c[1] + b[1] * W * cf + n[1] * tt * sf, c[2] + b[2] * W * cf + n[2] * tt * sf);
        const nx = b[0] * cf / W + n[0] * sf / tt, ny = b[1] * cf / W + n[1] * sf / tt, nz = b[2] * cf / W + n[2] * sf / tt;
        const l = Math.hypot(nx, ny, nz) || 1;
        N.push(nx / l, ny / l, nz / l);
        T.push(tan[0], tan[1], tan[2]);
      }
    }
    for (let j = 0; j < along; j++) for (let i = 0; i < around; i++) {
      const a = base + j * (around + 1) + i, b2 = a + 1, cc = a + around + 1, dd = cc + 1;
      I.push(a, cc, b2, b2, cc, dd);
    }
  }
  return { pos: new Float32Array(P), nrm: new Float32Array(N), dir: new Float32Array(T), idx: new Uint32Array(I), count: P.length / 3 };
}

// メッシュ配列をつなぐ（dir・color があればそれも）
export function mergeMeshes(list) {
  const count = list.reduce((s, m) => s + m.count, 0);
  const nIdx = list.reduce((s, m) => s + m.idx.length, 0);
  const pos = new Float32Array(count * 3), nrm = new Float32Array(count * 3), idx = new Uint32Array(nIdx);
  const hasDir = list.some((m) => m.dir), hasCol = list.some((m) => m.color);
  const dir = hasDir ? new Float32Array(count * 3) : null, color = hasCol ? new Float32Array(count * 3) : null;
  let v = 0, i = 0;
  for (const m of list) {
    pos.set(m.pos, v * 3); nrm.set(m.nrm, v * 3);
    if (dir && m.dir) dir.set(m.dir, v * 3);
    if (color && m.color) color.set(m.color, v * 3);
    for (let k = 0; k < m.idx.length; k++) idx[i + k] = m.idx[k] + v;
    v += m.count; i += m.idx.length;
  }
  const out = { pos, nrm, idx, count };
  if (dir) out.dir = dir;
  if (color) out.color = color;
  return out;
}

// 距離関数のメッシュに毛の流れを付ける: flow(x, y, z) → [tx, ty, tz]（面に沿うように法線の成分を抜く）
export function flowDir(m, flow) {
  const d = new Float32Array(m.count * 3);
  for (let v = 0; v < m.count; v++) {
    const x = m.pos[v * 3], y = m.pos[v * 3 + 1], z = m.pos[v * 3 + 2];
    const nx = m.nrm[v * 3], ny = m.nrm[v * 3 + 1], nz = m.nrm[v * 3 + 2];
    let [tx, ty, tz] = flow(x, y, z);
    const k = tx * nx + ty * ny + tz * nz;
    tx -= nx * k; ty -= ny * k; tz -= nz * k;
    const l = Math.hypot(tx, ty, tz) || 1;
    d[v * 3] = tx / l; d[v * 3 + 1] = ty / l; d[v * 3 + 2] = tz / l;
  }
  m.dir = d;
  return m;
}
