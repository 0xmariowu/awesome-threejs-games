// 車と自転車
// 車: 前後に並べた断面（下回り・側面・肩・屋根）を張った一枚の車体。窓・灯火・バンパーは面の位置で塗り分ける
// 自転車: ママチャリ（U 字フレーム・前かご・荷台・泥よけ・チェーンケース・両立スタンド）
import * as THREE from 'three';

const C = (h) => new THREE.Color(h);
const pick = (a, r) => a[Math.floor(r() * a.length) % a.length];
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const within = (z, p) => z >= p[0] && z <= p[1];

// 折れ線 [[z, y], ...]（z 昇順）の補間。角は少しならす
function polyAt(pts, z) {
  if (typeof pts === 'number') return pts;
  if (z <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) if (z <= pts[i][0]) {
    const [z0, y0] = pts[i - 1], [z1, y1] = pts[i];
    return y0 + (y1 - y0) * (z - z0) / (z1 - z0);
  }
  return pts[pts.length - 1][1];
}
function smoothAt(pts, z, w = 0.07) {
  let s = 0;
  for (let q = -2; q <= 2; q++) s += polyAt(pts, z + q * w * 0.5);
  return s / 5;
}

// ---------- 車種 ----------
// 座標: +z = 前、x = 幅、y = 上。wz = 前輪・後輪の z
const KINDS = {
  // 軽のハイトワゴン（全長 3.4 m・背が高く、後ろはほぼ垂直）
  kei: {
    L: 3.395, W: 1.475, sill: 0.3, wr: 0.275, ww: 0.155, wz: [1.1, -1.24], wheel: 'cap',
    top: [[-1.6975, 1.5], [-1.66, 1.68], [-1.5, 1.75], [0.62, 1.76], [1.3, 1.1], [1.5, 1.05], [1.64, 1.01], [1.6975, 0.97]],
    belt: [[-1.7, 1.06], [1.2, 1.01], [1.7, 0.99]],
    tum: 0.1, step: 0.03, tuck: 0.05, rs: 0.1, rr: 0.07, Rc: [0.2, 0.36], crown: 0.02,
    ws: [0.64, 1.31], side: [-1.54, 1.3], pillars: [[-0.06, 0.07], [-1.12, -1.0]], roofY: 1.45,
    rearGlass: { y0: 1.08, y1: 1.44, x: 0.5 },
    head: { d: 0.26, y0: 0.76, y1: 0.9, xIn: 0.3 },
    tail: { d: 0.1, y0: 0.72, y1: 1.3, xIn: 0.54 },
    bump: { f: 0.62, r: 0.6, d: 0.3, lip: 0.36 },
    grille: { y0: 0.6, y1: 0.72, w: 0.5 }, intake: { y0: 0.38, y1: 0.46, w: 0.7 },
    plate: [0.47, 0.5],
    seams: [[[0.74, 0.4], [0.74, 0.8], [1.06, 1.0]], [[0.0, 0.33], [0.0, 1.0]], [[-1.06, 0.62], [-1.06, 1.05]]],
    handles: [0.12, -0.14], rail: [-0.06, -1.25], spoiler: true,
  },
  // 小さなハッチバック
  compact: {
    L: 4.0, W: 1.695, sill: 0.3, wr: 0.3, ww: 0.185, wz: [1.3, -1.25], wheel: 'alloy',
    top: [[-2.0, 1.0], [-1.95, 1.2], [-1.78, 1.38], [-1.45, 1.47], [0.15, 1.49], [1.1, 1.0], [1.75, 0.88], [1.95, 0.8], [2.0, 0.76]],
    belt: [[-2.0, 1.04], [-1.2, 1.02], [1.1, 0.96], [2.0, 0.92]],
    tum: 0.14, step: 0.025, tuck: 0.06, rs: 0.09, rr: 0.06, Rc: [0.3, 0.42], crown: 0.035,
    ws: [0.18, 1.12], rw: [-1.9, -1.5], side: [-1.28, 1.1], pillars: [[-0.3, -0.19]], roofY: 1.3,
    head: { d: 0.36, y0: 0.6, y1: 0.72, xIn: 0.4 },
    tail: { d: 0.26, y0: 0.84, y1: 1.02, xIn: 0.44 },
    bump: { f: 0.57, r: 0.6, d: 0.36, lip: 0.34 },
    grille: { y0: 0.4, y1: 0.55, w: 0.8 },
    plate: [0.5, 0.62],
    seams: [[[0.78, 0.36], [0.78, 0.8], [1.02, 0.97]], [[-0.25, 0.33], [-0.25, 0.97]], [[-1.2, 0.62], [-1.2, 1.0]]],
    handles: [-0.08, -1.05],
  },
  // ミニバン（背が高く長い、後ろはスライドドア）
  minivan: {
    L: 4.69, W: 1.695, sill: 0.32, wr: 0.315, ww: 0.195, wz: [1.52, -1.33], wheel: 'alloy',
    top: [[-2.345, 1.6], [-2.3, 1.8], [-2.1, 1.87], [0.72, 1.87], [1.62, 1.12], [2.05, 1.0], [2.25, 0.95], [2.345, 0.84]],
    belt: [[-2.35, 1.12], [1.5, 1.06], [2.35, 1.0]],
    tum: 0.1, step: 0.03, tuck: 0.05, rs: 0.1, rr: 0.08, Rc: [0.24, 0.42], crown: 0.02,
    ws: [0.74, 1.64], side: [-2.12, 1.62], pillars: [[0.28, 0.4], [-1.02, -0.9]], roofY: 1.55,
    rearGlass: { y0: 1.14, y1: 1.64, x: 0.6 },
    head: { d: 0.32, y0: 0.82, y1: 0.96, xIn: 0.44 },
    tail: { d: 0.12, y0: 0.8, y1: 1.4, xIn: 0.64 },
    bump: { f: 0.66, r: 0.62, d: 0.34, lip: 0.4 },
    grille: { y0: 0.64, y1: 0.86, w: 0.84, chrome: true }, intake: { y0: 0.42, y1: 0.5, w: 0.9 },
    plate: [0.5, 0.52],
    seams: [[[1.0, 0.38], [1.0, 0.82], [1.4, 1.03]], [[0.34, 0.35], [0.34, 1.06]], [[-0.96, 0.35], [-0.96, 1.08]]],
    handles: [0.44, 0.22], rail: [0.3, -1.9], roofRails: true,
  },
  // 軽トラ（キャブだけ車体、後ろは荷台）
  truck: {
    L: 3.395, W: 1.475, za: 0.2, sill: 0.38, wr: 0.27, ww: 0.145, wz: [1.08, -0.86], wheel: 'steel',
    top: [[0.2, 1.62], [0.27, 1.76], [1.26, 1.78], [1.56, 1.14], [1.65, 1.06], [1.6975, 0.96]],
    belt: 1.1,
    tum: 0.08, step: 0.025, tuck: 0.03, rs: 0.08, rr: 0.05, Rc: [0.06, 0.2], crown: 0.02,
    ws: [1.28, 1.58], side: [0.42, 1.56], pillars: [], roofY: 1.5,
    rearGlass: { y0: 1.24, y1: 1.56, x: 0.52 },
    head: { d: 0.14, y0: 0.8, y1: 0.97, xIn: 0.45 },
    bump: { f: 0.56, r: 0, d: 0.2, lip: 0 },
    grille: { y0: 0.62, y1: 0.76, w: 0.66 },
    plate: [0.5, 0.46],
    seams: [[[0.44, 0.44], [0.44, 1.1]], [[1.44, 0.44], [1.44, 0.98]]],
    handles: [0.56],
    bumperCol: '#4a4c50',
  },
};

// z における断面の寸法
function sectionAt(S, z) {
  const dF = S.zb - z, dR = z - S.za, d = Math.min(dF, dR);
  const Rc = dF < dR ? S.Rc[1] : S.Rc[0];
  let hw = S.W / 2;
  if (d < Rc) hw -= Rc - Math.sqrt(Rc * Rc - (Rc - d) ** 2);
  const e = d < S.rr ? S.rr - Math.sqrt(S.rr * S.rr - (S.rr - d) ** 2) : 0;
  const top = smoothAt(S.top, z) - e;
  let bot = S.sill + e * 0.6;
  // バンパーの下はすこし上がる
  if (d < 0.3) bot += 0.05 * (1 - d / 0.3) ** 2;
  // タイヤハウス
  for (const wz of S.wz) {
    const R = S.wr + 0.05, dz = z - wz;
    if (Math.abs(dz) < R) bot = Math.max(bot, S.wr + Math.sqrt(R * R - dz * dz) * 0.97);
  }
  return { hw, top, bot, belt: polyAt(S.belt, z) };
}
// 側面の x（高さ y で）
function sideX(S, s, y) {
  if (y <= s.belt) { const t = clamp((s.belt - y) / (s.belt - S.sill), 0, 1.4); return s.hw - S.tuck * t * t; }
  return s.hw - S.step - S.tum * (y - s.belt) / 0.7;
}
// 右半分の断面（下の中心 → 外 → 上 → 上の中心）
// 側面の段は灯火・バンパーの高さに合わせる（塗り分けの境目をまっすぐに）
const NLOW = 6, NUP = 4;
const HALF_CLS = ['under', 'under', 'under', 'under', ...Array(NLOW).fill('low'), 'ledge', ...Array(NUP - 1).fill('up'), 'edge', 'edge', 'edge', 'edge', 'top', 'top'];
function levels(y0, y1, targets, n) {
  const ys = [y0, ...targets.filter((y) => y > y0 + 0.012 && y < y1 - 0.012), y1];
  while (ys.length > n) { let k = 1, best = 1e9; for (let q = 1; q < ys.length - 1; q++) { const g = ys[q + 1] - ys[q - 1]; if (g < best) { best = g; k = q; } } ys.splice(k, 1); }
  while (ys.length < n) { let k = 0; for (let q = 1; q < ys.length - 1; q++) if (ys[q + 1] - ys[q] > ys[k + 1] - ys[k]) k = q; ys.splice(k + 1, 0, (ys[k] + ys[k + 1]) / 2); }
  return ys;
}
function halfSection(S, s) {
  const rb = 0.06;
  const rs = Math.min(S.rs, (s.top - s.bot) * 0.25);
  const yA = s.bot + rb, yTop = Math.max(yA, s.top - rs);
  const ySplit = clamp(s.belt, yA, yTop);
  const X = (y) => sideX(S, s, y);
  const xb = X(yA) - rb;
  const P = [[0, s.bot], [xb * 0.5, s.bot], [xb, s.bot]];
  for (const a of [-Math.PI / 3, -Math.PI / 6]) P.push([xb + rb * Math.cos(a), yA + rb * Math.sin(a)]);
  for (const y of levels(yA, ySplit, S.levels, NLOW)) P.push([X(y), y]);
  const yu = Math.min(ySplit + 0.02, yTop);
  for (const y of levels(yu, yTop, S.levels, NUP)) P.push([X(y), y]);
  const xs = X(yTop), cx = xs - rs;
  for (const a of [1, 2, 3, 4]) { const t = a * Math.PI / 8; P.push([cx + rs * Math.cos(t), yTop + rs * Math.sin(t)]); }
  P.push([cx * 0.5, s.top + S.crown * 0.75], [0, s.top + S.crown]);
  return P;
}

// 面の場所 → 塗り分け
function roleOf(S, cls, x, y, z) {
  const dF = S.zb - z, dR = z - S.za;
  if (cls === 'under') return 'under';
  const B = S.bump;
  if (B && ((dF < B.d && y < B.f) || (dR < B.d && y < B.r))) return y < B.lip ? 'black' : 'bumper';
  if (cls === 'up' && within(z, S.side)) return S.pillars.some((p) => within(z, p)) ? 'black' : 'glass';
  if (cls === 'top' && (within(z, S.ws) || (S.rw && within(z, S.rw)))) return 'glass';
  if ((cls === 'edge' || cls === 'top') && y > S.roofY) return 'roof';
  return 'body';
}

// 断面の外側の x（高さ y で）
function outerX(S, s, y) {
  const P = halfSection(S, s);
  if (y <= P[2][1]) return P[2][0];
  for (let i = 2; i < P.length - 1; i++) {
    const [x0, y0] = P[i], [x1, y1] = P[i + 1];
    if (y >= y0 && y <= y1) return y1 - y0 < 1e-6 ? Math.max(x0, x1) : x0 + (x1 - x0) * (y - y0) / (y1 - y0);
  }
  return 0;
}
// 灯火: 車体の角に沿って貼る帯（前後の面 → 角 → 側面）。f0..f1 は帯の長さ方向の範囲
function ribbon(S, zs, front, xIn, d, y0, y1, off, f0 = 0, f1 = 1) {
  const zEnd = front ? S.zb : S.za;
  const path = [];
  for (const t of [0, 0.25, 0.5, 0.75]) path.push((y) => [xIn + (outerX(S, sectionAt(S, zEnd), y) - xIn) * t, zEnd]);
  const near = zs.filter((z) => (front ? S.zb - z : z - S.za) <= d).sort((a, b) => (front ? b - a : a - b));
  for (const z of near) path.push((y) => [outerX(S, sectionAt(S, z), y), z]);
  const a = Math.round(f0 * (path.length - 1)), b = Math.round(f1 * (path.length - 1));
  const NY = 4, pos = [], idx = [];
  for (let i = a; i <= b; i++) {
    const z = path[i](y0)[1], top = sectionAt(S, z).top - 0.004;
    for (let q = 0; q < NY; q++) {
      const y = Math.min(y0 + (y1 - y0) * q / (NY - 1), top);
      pos.push(path[i](y)[0], y, z);
    }
  }
  const n = b - a + 1;
  for (let i = 0; i < n - 1; i++) for (let q = 0; q < NY - 1; q++) {
    const p = i * NY + q, r = (i + 1) * NY + q;
    if (front) idx.push(p, r, r + 1, p, r + 1, p + 1); else idx.push(p, r + 1, r, p, p + 1, r + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  const P = g.attributes.position, N = g.attributes.normal;
  for (let k = 0; k < P.count; k++) P.setXYZ(k, P.getX(k) + N.getX(k) * off, P.getY(k) + N.getY(k) * off, P.getZ(k) + N.getZ(k) * off);
  // 左右
  const L = g.clone().applyMatrix4(new THREE.Matrix4().makeScale(-1, 1, 1));
  const Li = L.index.array; for (let k = 0; k < Li.length; k += 3) { const t = Li[k + 1]; Li[k + 1] = Li[k + 2]; Li[k + 2] = t; }
  L.computeVertexNormals();
  return [g, L];
}

// 断面を並べる z（形の変わり目は必ず入れる）
function stations(S) {
  const keys = [S.za, S.zb];
  for (const d of [0.015, 0.045, 0.1, 0.18, 0.28]) keys.push(S.za + d, S.zb - d);
  for (const [z] of S.top) keys.push(z);
  for (const p of [S.ws, S.rw, S.side, ...S.pillars]) if (p) keys.push(p[0], p[1]);
  for (const wz of S.wz) { const R = S.wr + 0.05; for (const f of [-1, -0.88, -0.6, -0.25, 0.25, 0.6, 0.88, 1]) keys.push(wz + R * f); }
  if (S.head) keys.push(S.zb - S.head.d);
  if (S.tail) keys.push(S.za + S.tail.d);
  if (S.bump) keys.push(S.zb - S.bump.d, S.za + S.bump.d);
  const zs = keys.filter((z) => z >= S.za && z <= S.zb).sort((a, b) => a - b);
  const out = [];
  for (const z of zs) {
    if (out.length && z - out[out.length - 1] < 0.008) continue;
    while (out.length && z - out[out.length - 1] > 0.17) out.push(out[out.length - 1] + Math.min(0.16, (z - out[out.length - 1]) / 2));
    out.push(z);
  }
  return out;
}

// 車体（役割ごとのジオメトリ）を一度だけ作る
const BODY = new Map();
function carBody(kind) {
  if (BODY.has(kind)) return BODY.get(kind);
  const S = KINDS[kind];
  const zs = stations(S);
  const H = HALF_CLS.length + 1, R = 2 * H - 2;
  const rings = zs.map((z) => {
    const s = sectionAt(S, z), h = halfSection(S, s);
    const ring = h.map(([x, y]) => [x, y, z]);
    for (let j = H - 2; j >= 1; j--) ring.push([-h[j][0], h[j][1], z]);
    return { ring, s };
  });
  // 滑らかな法線
  const pos = new Float32Array(zs.length * R * 3), idx = [];
  rings.forEach(({ ring }, i) => ring.forEach((p, j) => pos.set(p, (i * R + j) * 3)));
  for (let i = 0; i < zs.length - 1; i++) for (let j = 0; j < R; j++) {
    const a = i * R + j, b = i * R + (j + 1) % R, c = (i + 1) * R + (j + 1) % R, d = (i + 1) * R + j;
    idx.push(a, b, c, a, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  const nor = g.attributes.normal.array;
  const parts = {};
  const put = (role, ps, ns) => { const o = (parts[role] ||= { p: [], n: [] }); for (let q = 0; q < 3; q++) { o.p.push(...ps[q]); o.n.push(...ns[q]); } };
  const segCls = (j) => (j < H - 1 ? HALF_CLS[j] : HALF_CLS[R - j - 1]);
  const P = (i, j) => Array.from(pos.subarray((i * R + j) * 3, (i * R + j) * 3 + 3));
  const N = (i, j) => Array.from(nor.subarray((i * R + j) * 3, (i * R + j) * 3 + 3));
  for (let i = 0; i < zs.length - 1; i++) for (let j = 0; j < R; j++) {
    const j1 = (j + 1) % R;
    const a = P(i, j), b = P(i, j1), c = P(i + 1, j1), d = P(i + 1, j);
    const role = roleOf(S, segCls(j), (a[0] + b[0] + c[0] + d[0]) / 4, (a[1] + b[1] + c[1] + d[1]) / 4, (a[2] + c[2]) / 2);
    put(role, [a, b, c], [N(i, j), N(i, j1), N(i + 1, j1)]);
    put(role, [a, c, d], [N(i, j), N(i + 1, j1), N(i + 1, j)]);
  }
  // 前後のふた（断面を縮めながら中心へ）
  for (const [i, sgn] of [[0, -1], [zs.length - 1, 1]]) {
    const { ring, s } = rings[i];
    const cy = (s.top + s.bot) / 2, z = zs[i], n = [0, 0, sgn];
    const sc = [1, 0.66, 0.33, 0];
    const at = (k, j) => { const p = ring[j]; return [p[0] * sc[k], cy + (p[1] - cy) * sc[k], z]; };
    for (let k = 0; k < sc.length - 1; k++) for (let j = 0; j < R; j++) {
      const j1 = (j + 1) % R;
      const a = at(k, j), b = at(k, j1), c = at(k + 1, j1), d = at(k + 1, j);
      const role = roleOf(S, 'cap', (a[0] + b[0] + c[0] + d[0]) / 4, (a[1] + b[1] + c[1] + d[1]) / 4, z);
      // 外向きに巻く
      if (sgn > 0) { put(role, [a, b, c], [n, n, n]); put(role, [a, c, d], [n, n, n]); }
      else { put(role, [a, c, b], [n, n, n]); put(role, [a, d, c], [n, n, n]); }
    }
  }
  const out = { S, parts: {}, lamps: [] };
  const HD = S.head, TL = S.tail;
  if (HD) {
    out.lamps.push(['plastic', C('#141619'), ribbon(S, zs, true, HD.xIn - 0.02, HD.d + 0.03, HD.y0 - 0.02, HD.y1 + 0.012, 0.003)]);
    out.lamps.push(['glass', C('#e4ebf0'), ribbon(S, zs, true, HD.xIn, HD.d, HD.y0, HD.y1, 0.006, 0, 0.72)]);
    out.lamps.push(['glass', C('#f0a040'), ribbon(S, zs, true, HD.xIn, HD.d, HD.y0, HD.y1, 0.006, 0.72, 1)]);
    out.lamps.push(['chrome', C('#9aa4ac'), ribbon(S, zs, true, HD.xIn + 0.04, HD.d * 0.3, HD.y0 + (HD.y1 - HD.y0) * 0.3, HD.y1 - (HD.y1 - HD.y0) * 0.25, 0.008, 0.1, 0.5)]);
  }
  if (TL) {
    out.lamps.push(['glass', C('#a0121a'), ribbon(S, zs, false, TL.xIn, TL.d, TL.y0, TL.y1, 0.005)]);
    out.lamps.push(['glass', C('#e8e8e6'), ribbon(S, zs, false, TL.xIn, TL.d, TL.y0 + (TL.y1 - TL.y0) * 0.42, TL.y0 + (TL.y1 - TL.y0) * 0.58, 0.007, 0, 0.35)]);
  }
  for (const role in parts) {
    const bg = new THREE.BufferGeometry();
    bg.setAttribute('position', new THREE.Float32BufferAttribute(parts[role].p, 3));
    bg.setAttribute('normal', new THREE.Float32BufferAttribute(parts[role].n, 3));
    out.parts[role] = bg;
  }
  BODY.set(kind, out);
  return out;
}
for (const k in KINDS) {
  const S = KINDS[k];
  S.za ??= -S.L / 2; S.zb ??= S.L / 2;
  const t = [];
  if (S.head) t.push(S.head.y0, S.head.y1, S.head.y0 - 0.035);
  if (S.tail) t.push(S.tail.y0, S.tail.y1);
  if (S.bump) t.push(S.bump.f, S.bump.r, S.bump.lip);
  S.levels = [...new Set(t.filter((y) => y > 0))].sort((a, b) => a - b);
}

// ---------- ホイール ----------
const WHEELS = new Map();
function lathe(pts, seg) { return new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg).rotateZ(-Math.PI / 2); }
function wheelParts(S) {
  const key = S.wr + '|' + S.ww + '|' + S.wheel;
  if (WHEELS.has(key)) return WHEELS.get(key);
  const r = S.wr, w = S.ww, h = w / 2, rim = r * 0.63;
  const parts = [];
  // タイヤ（断面を回す）
  parts.push({ mat: 'rubber', col: C('#1d1d1f'), geo: lathe([[rim, h - 0.012], [r - 0.04, h + 0.002], [r - 0.012, h - 0.012], [r, h - 0.04], [r, -h + 0.04], [r - 0.012, -h + 0.012], [r - 0.04, -h - 0.002], [rim, -h + 0.012]], 14) });
  // 奥の暗い穴
  parts.push({ mat: 'dark', col: C('#141414'), geo: lathe([[rim, -h + 0.02], [0.001, -h + 0.02]].reverse(), 12) });
  const face = h - 0.012;
  if (S.wheel === 'alloy') {
    parts.push({ mat: 'dark', col: C('#232427'), geo: lathe([[0.001, face - 0.05], [rim * 0.98, face - 0.03]], 16) });
    const g = [];
    for (let q = 0; q < 5; q++) {
      const a = q * Math.PI * 2 / 5, b = new THREE.BoxGeometry(0.02, rim * 0.8, 0.05);
      b.translate(face - 0.02, rim * 0.52, 0).rotateX(a);
      g.push(b);
    }
    for (const b of g) parts.push({ mat: 'chrome', col: C('#c6cacf'), geo: b });
    parts.push({ mat: 'chrome', col: C('#d4d7da'), geo: new THREE.TorusGeometry(rim * 0.97, 0.014, 4, 16).rotateY(Math.PI / 2).translate(face - 0.01, 0, 0) });
    parts.push({ mat: 'chrome', col: C('#b8bcc0'), geo: lathe([[0.001, face + 0.004], [0.045, face], [0.055, face - 0.03]].reverse(), 12) });
  } else {
    // ホイールキャップ（皿形）
    const col = S.wheel === 'steel' ? C('#c4c6c4') : C('#c9ccd0');
    parts.push({ mat: 'metal', col, geo: lathe([[0.001, face + 0.006], [rim * 0.22, face + 0.006], [rim * 0.32, face - 0.006], [rim * 0.8, face - 0.014], [rim * 0.97, face - 0.004], [rim * 1.02, face - 0.02]].reverse(), 14) });
    const n = S.wheel === 'steel' ? 4 : 8;
    for (let q = 0; q < n; q++) {
      const a = (q + 0.5) * Math.PI * 2 / n;
      const b = S.wheel === 'steel' ? new THREE.CylinderGeometry(0.028, 0.028, 0.01, 10).rotateZ(Math.PI / 2) : new THREE.BoxGeometry(0.01, 0.055, 0.02);
      b.translate(face - (S.wheel === 'steel' ? 0.004 : 0.006), rim * (S.wheel === 'steel' ? 0.55 : 0.72), 0).rotateX(a);
      parts.push({ mat: 'dark', col: C('#1a1a1a'), geo: b });
    }
    parts.push({ mat: 'chrome', col: C('#dadcde'), geo: lathe([[0.001, face + 0.012], [0.035, face + 0.008], [0.04, face]].reverse(), 12) });
  }
  WHEELS.set(key, parts);
  return parts;
}

// ---------- ナンバープレート（左半分 = 白、右半分 = 黄色） ----------
let plateTex = null;
export function plateTexture() {
  if (plateTex) return plateTex;
  const c = document.createElement('canvas');
  c.width = 512; c.height = 128;
  const g = c.getContext('2d');
  for (const [x0, bg, fg] of [[0, '#f4f4ee', '#1f5a34'], [256, '#f2d23a', '#1a1a1a']]) {
    g.fillStyle = bg; g.fillRect(x0, 0, 256, 128);
    g.strokeStyle = fg; g.lineWidth = 5; g.strokeRect(x0 + 5, 5, 246, 118);
    g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '700 30px "Zen Kaku Gothic New", "Yu Gothic", sans-serif';
    g.fillText(x0 ? '吉山 580' : '吉山 500', x0 + 128, 30);
    g.font = '700 30px sans-serif'; g.fillText(x0 ? 'ら' : 'さ', x0 + 34, 86);
    g.font = '800 64px "Arial Narrow", Arial, sans-serif'; g.fillText(x0 ? '26-15' : '72-38', x0 + 148, 86);
  }
  plateTex = new THREE.CanvasTexture(c);
  plateTex.colorSpace = THREE.SRGBColorSpace;
  plateTex.anisotropy = 4;
  return plateTex;
}
function plate(k, x, y, z, facing, yellow) {
  const w = 0.33, h = 0.165, u0 = yellow ? 0.5 : 0, u1 = u0 + 0.5;
  k.color(C('#2a2a2a')); k.box('dark', x, y, z - facing * 0.006, w + 0.02, h + 0.02, 0.012);
  k.color(C('#ffffff'));
  const s = facing, zz = z + 0.001 * s;
  const pts = [[x - w / 2 * s, y - h / 2, zz], [x + w / 2 * s, y - h / 2, zz], [x + w / 2 * s, y + h / 2, zz], [x - w / 2 * s, y + h / 2, zz]];
  k.face('plate', pts, [[u0, 0], [u1, 0], [u1, 1], [u0, 1]]);
}

// ---------- 網（かご・荷台の鳥居） ----------
let wireTex = null;
export function wireTexture() {
  if (wireTex) return wireTex;
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const g = c.getContext('2d');
  g.fillStyle = '#fff';
  g.fillRect(0, 0, 32, 3); g.fillRect(0, 0, 3, 32);
  wireTex = new THREE.CanvasTexture(c);
  wireTex.wrapS = wireTex.wrapT = THREE.RepeatWrapping;
  wireTex.repeat.set(26, 26);
  wireTex.anisotropy = 4;
  return wireTex;
}

// ---------- 車 ----------
const PAINT = {
  kei: ['#f3f3ef', '#f3f3ef', '#c9ccd0', '#26282c', '#e6d9bf', '#b9d7cf', '#f0c8c0', '#e8d67a', '#9a2b2a', '#3a4a66', '#6f7a64'],
  compact: ['#f3f3ef', '#c9ccd0', '#26282c', '#a8262a', '#2f5a9a', '#8c9094', '#f3f3ef'],
  minivan: ['#f3f3ef', '#f3f3ef', '#1c1d20', '#c9ccd0', '#2c3a52', '#6e7378'],
  truck: ['#f3f3ef', '#f3f3ef', '#f3f3ef', '#f3f3ef', '#c9ccd0', '#8fb2c8', '#3e6048'],
};
export const CAR_KINDS = Object.keys(KINDS);

export function car(k, M, r, kind = null) {
  kind ||= (() => { const t = r(); return t < 0.4 ? 'kei' : t < 0.6 ? 'truck' : t < 0.8 ? 'compact' : 'minivan'; })();
  const { S, parts, lamps } = carBody(kind);
  const col = C(pick(PAINT[kind], r));
  const twoTone = kind === 'kei' && r() < 0.35;
  const roofCol = twoTone ? C(col.getHSL({}).l > 0.6 ? '#2a2b2e' : '#f3f3ef') : col;
  const bumper = S.bumperCol ? C(S.bumperCol) : col;
  const roles = {
    body: ['carPaint', col], roof: ['carPaint', roofCol], bumper: [S.bumperCol ? 'plastic' : 'carPaint', bumper],
    glass: ['glass', C('#10161c')], black: ['plastic', C('#141517')], under: ['dark', C('#161718')],
    head: ['glass', C('#e9eef2')], turn: ['glass', C('#f0a040')], tail: ['glass', C('#b0141c')],
  };
  k.at(M);
  for (const role in parts) { const [mat, c] = roles[role]; k.color(c).geo(mat, parts[role]); }
  for (const [mat, c, gs] of lamps) for (const g of gs) k.color(c).geo(mat, g);

  const sec = (z) => sectionAt(S, z);
  const sx = (z, y) => sideX(S, sec(z), y);
  const zf = S.zb, zr = S.za;
  // 下回り（タイヤハウスの奥を暗く）
  k.color(C('#141516'));
  const inW = S.W - 2 * (S.ww + 0.1);
  k.box('dark', 0, 0.42, (Math.max(zr, -S.L / 2) + zf) / 2, inW, 0.36, zf - Math.max(zr, -S.L / 2) - 0.3);
  // ホイール
  for (const wz of S.wz) for (const sd of [1, -1]) {
    const Mw = new THREE.Matrix4().makeRotationY(sd > 0 ? 0 : Math.PI).setPosition(sd * (S.W / 2 - S.ww / 2 - 0.035), S.wr, wz);
    for (const p of wheelParts(S)) k.color(p.col).geo(p.mat, p.geo, Mw);
  }
  // ドアの継ぎ目
  k.color(C('#0e0f10'));
  for (const seam of S.seams) for (const sd of [1, -1]) for (let q = 1; q < seam.length; q++) {
    const [z0, y0] = seam[q - 1], [z1, y1] = seam[q];
    const n = Math.max(1, Math.ceil(Math.hypot(z1 - z0, y1 - y0) / 0.25));
    for (let t = 0; t < n; t++) {
      const za = z0 + (z1 - z0) * t / n, ya = y0 + (y1 - y0) * t / n, zb = z0 + (z1 - z0) * (t + 1) / n, yb = y0 + (y1 - y0) * (t + 1) / n;
      k.rod('dark', [sd * (sx(za, ya) + 0.001), ya, za], [sd * (sx(zb, yb) + 0.001), yb, zb], 0.008);
    }
  }
  // スライドドアのレール
  if (S.rail) for (const sd of [1, -1]) {
    const y = polyAt(S.belt, S.rail[1]) - 0.015;
    k.rod('dark', [sd * (sx(S.rail[0], y) + 0.002), y, S.rail[0]], [sd * (sx(S.rail[1], y) + 0.002), y, S.rail[1]], 0.016);
  }
  // ドアの取っ手
  for (const z of S.handles) for (const sd of [1, -1]) {
    const y = polyAt(S.belt, z) - 0.09;
    k.color(kind === 'compact' ? C('#d0d3d6') : col);
    k.box(kind === 'compact' ? 'chrome' : 'carPaint', sd * (sx(z, y) + 0.012), y, z, 0.022, 0.032, 0.15);
  }
  // ドアミラー
  {
    const z = S.ws[1] - 0.1, y = polyAt(S.belt, z) + 0.09, x0 = sx(z, y - 0.09);
    for (const sd of [1, -1]) {
      k.color(C('#16171a')); k.box('plastic', sd * (x0 + 0.03), y - 0.03, z, 0.07, 0.05, 0.1);
      k.color(kind === 'truck' ? C('#16171a') : roofCol);
      k.box(kind === 'truck' ? 'plastic' : 'carPaint', sd * (x0 + 0.1), y, z - 0.01, 0.15, 0.11, 0.09);
      k.color(C('#9fb3c0')); k.box('chrome', sd * (x0 + 0.1), y, z - 0.058, 0.12, 0.08, 0.006);
    }
  }
  // ワイパー
  {
    const z = S.ws[1] - 0.07, y = smoothAt(S.top, z) + S.crown + 0.012;
    k.color(C('#111'));
    k.rod('dark', [-0.62, y, z + 0.01], [0.02, y + 0.02, z - 0.02], 0.014);
    k.rod('dark', [0.06, y, z + 0.01], [0.62, y + 0.02, z - 0.02], 0.014);
  }
  // グリル・エンブレム
  {
    const G = S.grille, gy = (G.y0 + G.y1) / 2;
    k.color(C('#18191b')); k.box('plastic', 0, gy, zf + 0.004, G.w, G.y1 - G.y0, 0.03);
    const nb = G.chrome ? 4 : 2;
    k.color(G.chrome ? C('#dfe2e5') : C('#303236'));
    for (let q = 1; q <= nb; q++) k.box(G.chrome ? 'chrome' : 'plastic', 0, G.y0 + (G.y1 - G.y0) * q / (nb + 1), zf + 0.022, G.w - 0.03, G.chrome ? 0.018 : 0.012, 0.012);
    if (S.intake) { const I = S.intake; k.color(C('#141517')); k.box('plastic', 0, (I.y0 + I.y1) / 2, zf + 0.002, I.w, I.y1 - I.y0, 0.03); }
    k.color(C('#dfe2e5'));
    k.geo('chrome', new THREE.CylinderGeometry(0.035, 0.035, 0.012, 14).rotateX(Math.PI / 2), new THREE.Matrix4().setPosition(0, G.y1 + 0.03, zf + 0.012));
  }
  // ナンバー
  const yellow = kind === 'kei' || kind === 'truck';
  plate(k, 0, S.plate[0], zf + 0.03, 1, yellow);
  if (kind !== 'truck') plate(k, 0, S.plate[1], zr - 0.03, -1, yellow);
  // 後ろのガラス
  if (S.rearGlass) {
    const G = S.rearGlass;
    k.color(C('#10161c')); k.box('glass', 0, (G.y0 + G.y1) / 2, zr - 0.004, G.x * 2, G.y1 - G.y0, 0.012);
    if (kind !== 'truck') { k.color(C('#111')); k.rod('dark', [0, G.y1 - 0.03, zr - 0.014], [-G.x * 0.8, G.y0 + 0.08, zr - 0.014], 0.012); }
    if (kind !== 'truck') { k.color(C('#b0141c')); k.box('glass', 0, G.y1 + 0.035, zr - 0.006, 0.26, 0.03, 0.012); }
  }
  if (S.spoiler) {
    const y = smoothAt(S.top, zr + 0.1) + S.crown;
    k.color(roofCol); k.box('carPaint', 0, y - 0.03, zr - 0.02, S.W - 0.36, 0.05, 0.14);
  }
  // アンテナ・ルーフレール
  {
    const z = zr + (kind === 'truck' ? 0.3 : 0.45), y = smoothAt(S.top, z) + S.crown;
    k.color(C('#18191b')); k.box('plastic', 0, y + 0.03, z, 0.05, 0.06, 0.16);
  }
  if (S.roofRails && r() < 0.6) {
    const y = polyAt(S.top, 0) + S.crown * 0.3, x = S.W / 2 - 0.22;
    k.color(C('#26282b'));
    for (const sd of [1, -1]) {
      k.rod('plastic', [sd * x, y + 0.06, S.ws[0] - 0.1], [sd * x, y + 0.06, zr + 0.25], 0.035);
      for (const z of [S.ws[0] - 0.14, (S.ws[0] + zr) / 2, zr + 0.28]) k.box('plastic', sd * x, y + 0.03, z, 0.04, 0.06, 0.08);
    }
  }
  if (kind === 'truck') truckBed(k, S, col, r);
  return { L: S.L, W: S.W, kind };
}

// 軽トラの荷台
function truckBed(k, S, col, r) {
  const hl = S.L / 2, W = S.W, zF = 0.16, zR = -hl + 0.01, fy = 0.66, gh = 0.28, zc = (zF + zR) / 2, len = zF - zR;
  const dark = C('#161718');
  // 床とリブ
  k.color(col); k.box('carPaint', 0, fy - 0.05, zc, W - 0.04, 0.1, len);
  k.color(col.clone().multiplyScalar(0.86));
  for (let x = -0.56; x <= 0.57; x += 0.16) k.box('carPaint', x, fy + 0.006, zc, 0.035, 0.012, len - 0.08);
  // あおり（左右と後ろ）
  k.color(col);
  for (const sd of [1, -1]) {
    k.box('carPaint', sd * (W / 2 - 0.02), fy + gh / 2, zc, 0.035, gh, len);
    k.box('carPaint', sd * (W / 2 - 0.001), fy + gh * 0.32, zc, 0.006, 0.035, len - 0.12);
    k.box('carPaint', sd * (W / 2 - 0.001), fy + gh * 0.72, zc, 0.006, 0.035, len - 0.12);
    k.box('carPaint', sd * (W / 2 - 0.02), fy + gh + 0.012, zc, 0.05, 0.024, len);
  }
  k.box('carPaint', 0, fy + gh / 2, zR + 0.018, W - 0.08, gh, 0.035);
  k.box('carPaint', 0, fy + gh * 0.5, zR - 0.001, W - 0.2, 0.035, 0.006);
  k.box('carPaint', 0, fy + gh + 0.012, zR + 0.018, W - 0.04, 0.024, 0.05);
  // あおりの留め金
  k.color(C('#9a9ea2'));
  for (const sd of [1, -1]) {
    k.box('metal', sd * (W / 2 + 0.004), fy + gh - 0.06, zR + 0.06, 0.012, 0.05, 0.05);
    k.box('metal', sd * (W / 2 + 0.004), fy + gh - 0.06, zF - 0.04, 0.012, 0.05, 0.05);
    for (const z of [zR + 0.4, zF - 0.5]) k.box('metal', sd * (W / 2 - 0.02), fy - 0.02, z, 0.05, 0.04, 0.08);
  }
  // 鳥居（キャブを守る枠）
  const top = 1.86, zg = zF - 0.03;
  const gcol = r() < 0.5 ? col : C('#1e1f22');
  k.color(gcol);
  for (const sd of [1, -1]) k.box('carPaint', sd * (W / 2 - 0.05), (fy + top) / 2, zg, 0.05, top - fy, 0.05);
  k.box('carPaint', 0, top, zg, W - 0.06, 0.05, 0.06);
  k.box('carPaint', 0, top - 0.005, zg + 0.08, W - 0.1, 0.03, 0.14);
  k.box('carPaint', 0, fy + gh + 0.01, zg, W - 0.1, 0.04, 0.05);
  k.box('carPaint', 0, (fy + fy + gh) / 2, zg + 0.005, W - 0.1, gh, 0.02);
  for (let x = -0.5; x <= 0.51; x += 0.125) k.box('carPaint', x, (fy + gh + top) / 2, zg, 0.02, top - fy - gh, 0.02);
  // 下回り: フレーム・燃料タンク・後ろの車軸・泥よけ
  k.color(dark);
  for (const sd of [1, -1]) k.box('dark', sd * 0.4, 0.46, (zR + 0.5) / 2, 0.07, 0.12, 0.5 - zR);
  k.box('dark', 0.1, 0.42, -0.2, 0.5, 0.2, 0.4);
  k.geo('dark', new THREE.CylinderGeometry(0.05, 0.05, W - 0.4, 10).rotateZ(Math.PI / 2), new THREE.Matrix4().setPosition(0, S.wr, S.wz[1]));
  for (const sd of [1, -1]) k.box('rubber', sd * (W / 2 - S.ww / 2 - 0.035), 0.3, S.wz[1] - S.wr - 0.08, S.ww + 0.02, 0.3, 0.012);
  // ホイール（後ろの）: キャブ側と同じものを car() が置く
  // 後ろのバンパー・テールランプ・ナンバー
  k.color(C('#2a2b2e')); k.box('plastic', 0, 0.4, zR - 0.03, W - 0.1, 0.06, 0.06);
  for (const sd of [1, -1]) {
    k.color(C('#2a2b2e')); k.box('plastic', sd * 0.56, 0.5, zR - 0.02, 0.24, 0.13, 0.05);
    k.color(C('#b0141c')); k.box('glass', sd * 0.6, 0.5, zR - 0.048, 0.14, 0.1, 0.012);
    k.color(C('#f0a040')); k.box('glass', sd * 0.49, 0.5, zR - 0.048, 0.07, 0.1, 0.012);
  }
  plate(k, 0, 0.5, zR - 0.05, -1, true);
  // 積み荷
  const t = r();
  if (t < 0.3) {
    // 黄色いコンテナ
    const cc = pick([C('#e8b820'), C('#2f6fb0'), C('#e05030')], r);
    for (let q = 0; q < 3; q++) {
      const x = -0.35 + (q % 2) * 0.62, z = zR + 0.35 + Math.floor(q / 2) * 0.46, y = fy;
      k.color(cc); k.box('plastic', x, y + 0.14, z, 0.55, 0.28, 0.4);
      k.color(cc.clone().multiplyScalar(0.55)); k.box('plastic', x, y + 0.281, z, 0.49, 0.004, 0.34);
      k.color(cc.clone().multiplyScalar(0.8)); k.box('plastic', x, y + 0.2, z + 0.201, 0.14, 0.05, 0.004);
    }
  } else if (t < 0.55) {
    // クーラーボックス
    for (let q = 0; q < 2; q++) {
      const x = -0.3 + q * 0.58, z = zR + 0.45 + q * 0.2;
      k.color(C('#f2f2ee')); k.box('plastic', x, fy + 0.17, z, 0.55, 0.34, 0.36);
      k.color(q ? C('#2f7fc0') : C('#d84a36')); k.box('plastic', x, fy + 0.36, z, 0.57, 0.05, 0.38);
      k.color(C('#8a8c8e')); k.box('metal', x, fy + 0.2, z + 0.185, 0.2, 0.04, 0.012);
    }
  } else if (t < 0.7) {
    // 青いシート
    k.color(C('#2e62b4')); k.box('cloth', 0, fy + 0.12, zc - 0.1, W - 0.2, 0.22, len - 0.5);
    k.color(C('#e8e8e0'));
    for (const z of [zc - 0.5, zc + 0.3]) k.rod('cloth', [-(W / 2 - 0.1), fy + 0.235, z], [W / 2 - 0.1, fy + 0.235, z], 0.012);
  }
}

// ---------- 自転車（ママチャリ） ----------
// ローカル: +x = 前、y = 上、z = 横。原点 = 前後の車輪の間の地面
const TUBE = new Map();
function tubeGeo(seg) { if (!TUBE.has(seg)) TUBE.set(seg, new THREE.CylinderGeometry(1, 1, 1, seg, 1, true)); return TUBE.get(seg); }
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _q = new THREE.Quaternion(), _up = new THREE.Vector3(0, 1, 0);
function tube(k, mat, a, b, rad, seg = 6) {
  _a.set(...a); _b.set(...b);
  const L = _a.distanceTo(_b);
  if (L < 1e-4) return;
  _q.setFromUnitVectors(_up, _b.clone().sub(_a).divideScalar(L));
  const m = new THREE.Matrix4().compose(_a.clone().add(_b).multiplyScalar(0.5), _q, new THREE.Vector3(rad, L, rad));
  k.geo(mat, tubeGeo(seg), m);
}
// 2 次ベジェに沿った管
function bend(k, mat, a, c, b, rad, n = 5, seg = 6) {
  let prev = a;
  for (let q = 1; q <= n; q++) {
    const t = q / n, u = 1 - t;
    const p = [0, 1, 2].map((i) => u * u * a[i] + 2 * u * t * c[i] + t * t * b[i]);
    tube(k, mat, prev, p, rad, seg);
    prev = p;
  }
}
function bikeWheel(k, x, R) {
  const y = R;
  k.color(C('#1c1c1e')); k.geo('rubber', new THREE.TorusGeometry(R - 0.019, 0.019, 5, 24), new THREE.Matrix4().setPosition(x, y, 0));
  k.color(C('#cfd2d5')); k.geo('chrome', new THREE.TorusGeometry(R - 0.042, 0.009, 3, 24).scale(1, 1, 1.6), new THREE.Matrix4().setPosition(x, y, 0));
  k.color(C('#b8bbbe'));
  tube(k, 'chrome', [x, y, -0.05], [x, y, 0.05], 0.018, 8);
  for (let q = 0; q < 16; q++) {
    const a = q * Math.PI / 8, sd = q % 2 ? 1 : -1, rr = R - 0.048;
    k.rod('chrome', [x + Math.cos(a + sd * 0.25) * 0.02, y + Math.sin(a + sd * 0.25) * 0.02, sd * 0.035], [x + Math.cos(a) * rr, y + Math.sin(a) * rr, 0], 0.004);
  }
}
function fender(k, x, R, a0, arc, col) {
  const g = new THREE.TorusGeometry(R + 0.022, 0.02, 3, 16, arc).scale(1, 1, 1.9).rotateZ(a0);
  k.color(col).geo('chrome', g, new THREE.Matrix4().setPosition(x, R, 0));
}

export function bicycle(k, M, col, r = Math.random) {
  k.at(M);
  const R = 0.335, xr = -0.54, xf = 0.53;
  const bb = [-0.1, 0.29, 0], st = [-0.26, 0.74, 0], ht0 = [0.37, 0.66, 0], ht1 = [0.41, 0.84, 0];
  const silver = C('#c8cbce'), black = C('#1a1a1b');
  bikeWheel(k, xr, R);
  bikeWheel(k, xf, R);
  // フレーム
  k.color(col);
  bend(k, 'paint', [0.385, 0.72, 0], [0.12, 0.3, 0], bb, 0.022, 6);
  bend(k, 'paint', [0.39, 0.77, 0], [0.02, 0.42, 0], [-0.2, 0.5, 0], 0.014, 5);
  tube(k, 'paint', bb, st, 0.02);
  tube(k, 'paint', ht0, ht1, 0.024, 8);
  for (const sd of [1, -1]) {
    tube(k, 'paint', [bb[0], bb[1], sd * 0.035], [xr, R, sd * 0.055], 0.011);
    tube(k, 'paint', [st[0] + 0.01, st[1] - 0.04, sd * 0.02], [xr, R, sd * 0.055], 0.011);
    bend(k, 'paint', [0.37, 0.63, sd * 0.03], [0.45, 0.5, sd * 0.05], [xf, R, sd * 0.052], 0.013, 3);
  }
  tube(k, 'paint', [0.36, 0.64, -0.035], [0.38, 0.64, 0.035], 0.02);
  // BB と クランク・ペダル
  k.color(black);
  tube(k, 'metal', [bb[0], bb[1], -0.06], [bb[0], bb[1], 0.06], 0.03, 8);
  const ca = r() * Math.PI * 2;
  for (const sd of [1, -1]) {
    const a = ca + (sd > 0 ? 0 : Math.PI), px = bb[0] + Math.cos(a) * 0.16, py = bb[1] + Math.sin(a) * 0.16;
    k.color(silver); tube(k, 'chrome', [bb[0], bb[1], sd * 0.08], [px, py, sd * 0.09], 0.01, 4);
    k.color(black); k.box('rubber', px, py, sd * 0.14, 0.09, 0.025, 0.1);
  }
  // チェーンケース（右側）
  {
    const pts = [];
    for (let q = 0; q < 20; q++) { const a = q / 20 * Math.PI * 2; pts.push([bb[0] + Math.cos(a) * 0.115, bb[1] + Math.sin(a) * 0.115], [xr + Math.cos(a) * 0.065, R + Math.sin(a) * 0.065]); }
    pts.sort((p, q) => p[0] - q[0] || p[1] - q[1]);
    const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lo = [], hi = [];
    for (const p of pts) { while (lo.length > 1 && cross(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
    for (const p of pts.slice().reverse()) { while (hi.length > 1 && cross(hi[hi.length - 2], hi[hi.length - 1], p) <= 0) hi.pop(); hi.push(p); }
    const hull = lo.slice(0, -1).concat(hi.slice(0, -1));
    const g = new THREE.ExtrudeGeometry(new THREE.Shape(hull.map(([x, y]) => new THREE.Vector2(x, y))), { depth: 0.02, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 1, curveSegments: 4 });
    k.color(r() < 0.55 ? black : r() < 0.5 ? C('#8e9296') : col).geo('paint', g, new THREE.Matrix4().setPosition(0, 0, 0.075));
  }
  // 泥よけ
  const fc = r() < 0.6 ? silver : col;
  fender(k, xf, R, 0.25, 2.45, fc);
  fender(k, xr, R, 0.55, 2.7, fc);
  k.color(C('#c02020')); k.box('glass', xr - R * 0.95, R + 0.07, 0, 0.012, 0.05, 0.035);
  // サドルとシートポスト
  k.color(silver); tube(k, 'chrome', st, [-0.29, 0.86, 0], 0.013);
  k.color(black);
  k.geo('rubber', new THREE.SphereGeometry(1, 10, 6).scale(0.14, 0.05, 0.11).translate(-0.02, 0, 0), new THREE.Matrix4().setPosition(-0.3, 0.895, 0));
  k.geo('rubber', new THREE.SphereGeometry(1, 8, 5).scale(0.09, 0.035, 0.05), new THREE.Matrix4().setPosition(-0.2, 0.892, 0));
  k.color(silver);
  for (const sd of [1, -1]) tube(k, 'chrome', [-0.36, 0.85, sd * 0.05], [-0.36, 0.88, sd * 0.05], 0.012, 6);
  // ハンドル（手前に大きく曲がる）
  k.color(silver);
  tube(k, 'chrome', ht1, [0.42, 0.97, 0], 0.013);
  for (const sd of [1, -1]) {
    bend(k, 'chrome', [0.42, 0.97, 0], [0.43, 0.985, sd * 0.2], [0.27, 0.985, sd * 0.28], 0.011, 4);
    k.color(black); tube(k, 'rubber', [0.27, 0.985, sd * 0.28], [0.15, 0.975, sd * 0.3], 0.016, 8);
    k.color(silver); tube(k, 'chrome', [0.36, 0.98, sd * 0.25], [0.24, 0.94, sd * 0.3], 0.006, 4);
  }
  k.color(C('#d8d8d4')); k.geo('chrome', new THREE.SphereGeometry(0.022, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.Matrix4().setPosition(0.33, 1.0, 0.2));
  // 前かご
  {
    const bx = 0.6, by = 0.8, bw = 0.3, bh = 0.24, bd = 0.36, bc = r() < 0.7 ? silver : black;
    k.color(bc);
    k.box('wire', bx, by + bh / 2, 0, bw, bh, bd, 0b101111);
    for (const y of [by, by + bh]) {
      tube(k, 'chrome', [bx - bw / 2, y, -bd / 2], [bx + bw / 2, y, -bd / 2], 0.006, 4);
      tube(k, 'chrome', [bx - bw / 2, y, bd / 2], [bx + bw / 2, y, bd / 2], 0.006, 4);
      tube(k, 'chrome', [bx - bw / 2, y, -bd / 2], [bx - bw / 2, y, bd / 2], 0.006, 4);
      tube(k, 'chrome', [bx + bw / 2, y, -bd / 2], [bx + bw / 2, y, bd / 2], 0.006, 4);
    }
    for (const sd of [1, -1]) tube(k, 'chrome', [bx + 0.05, by, sd * 0.1], [xf, R, sd * 0.06], 0.006, 4);
    tube(k, 'chrome', [bx - bw / 2, by + 0.1, 0], [0.43, 0.92, 0], 0.01, 4);
  }
  // ライト
  k.color(black); tube(k, 'plastic', [0.44, 0.6, 0.075], [0.52, 0.6, 0.075], 0.028, 10);
  k.color(C('#f4f2e8')); k.geo('lamp', new THREE.CircleGeometry(0.024, 10).rotateY(Math.PI / 2), new THREE.Matrix4().setPosition(0.522, 0.6, 0.075));
  // 後ろ: 荷台 か 子ども乗せ
  const rack = r() < 0.8;
  k.color(r() < 0.6 ? silver : black);
  const ry = 0.8;
  for (const sd of [1, -1]) {
    tube(k, 'chrome', [-0.3, ry, sd * 0.07], [-0.78, ry, sd * 0.07], 0.008, 4);
    tube(k, 'chrome', [-0.74, ry, sd * 0.07], [xr, R, sd * 0.065], 0.008, 4);
  }
  tube(k, 'chrome', [-0.3, ry, 0], [-0.24, 0.72, 0], 0.008, 4);
  if (rack) {
    for (const x of [-0.34, -0.48, -0.62, -0.76]) tube(k, 'chrome', [x, ry, -0.07], [x, ry, 0.07], 0.007, 4);
    tube(k, 'chrome', [-0.3, ry, 0], [-0.78, ry, 0], 0.007, 4);
  } else {
    // 子ども乗せ
    const sc = pick([C('#2a2b2e'), C('#8a8d90'), C('#6f4a3a')], r);
    k.color(sc);
    k.box('plastic', -0.55, ry + 0.06, 0, 0.3, 0.05, 0.26);
    k.geo('plastic', new THREE.BoxGeometry(0.035, 0.34, 0.27), new THREE.Matrix4().makeRotationZ(0.14).setPosition(-0.69, ry + 0.22, 0));
    for (const sd of [1, -1]) {
      k.box('plastic', -0.58, ry + 0.13, sd * 0.125, 0.22, 0.1, 0.02);
      k.box('plastic', -0.43, ry - 0.16, sd * 0.12, 0.07, 0.2, 0.025);
    }
    k.color(C('#1a1a1b')); tube(k, 'rubber', [-0.46, ry + 0.18, -0.12], [-0.46, ry + 0.18, 0.12], 0.012, 6);
  }
  // 両立スタンド
  k.color(silver);
  for (const sd of [1, -1]) tube(k, 'chrome', [xr, R, sd * 0.07], [xr - 0.08, 0.01, sd * 0.13], 0.008, 4);
  tube(k, 'chrome', [xr - 0.08, 0.01, -0.13], [xr - 0.08, 0.01, 0.13], 0.008, 4);
  // リング錠
  k.color(C('#2a2b2e')); k.box('plastic', xr + 0.14, R + 0.1, 0, 0.05, 0.08, 0.06);
}
