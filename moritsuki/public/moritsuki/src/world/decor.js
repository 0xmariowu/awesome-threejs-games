// 岩・海藻・サンゴ・貝・島の小物のジオメトリ生成
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { GeoBuilder, col } from '../core/geo.js';
import { RNG, makeNoise3D, fbm3, smoothstep } from '../core/noise.js';

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

// ───────── 岩 ─────────
// 丸い塊に、平らな割れ面（節理）・細い割れ目・層を刻んで岩らしくする。
// 色は凹み（一つ隣の頂点との比較で求めた窪み）を暗く、角を明るく。上面に藻、側面に石灰藻。
export function makeRockGeometry(seed) {
  const rng = new RNG(seed * 7 + 3);
  const n3 = makeNoise3D(seed * 13 + 1);
  let g = new THREE.IcosahedronGeometry(1, 12);
  g.deleteAttribute('normal');
  g.deleteAttribute('uv');
  g = mergeVertices(g);
  const pos = g.attributes.position;
  const stretch = V3(rng.range(0.85, 1.25), rng.range(0.65, 1.0), rng.range(0.85, 1.25));
  const off = rng.range(0, 100);
  // 割れ面：横〜斜め上を向いた数枚の平面で角を削ぎ落とす
  const planes = [];
  for (let i = 0, np = rng.int(6, 9); i < np; i++) {
    const a = rng.range(0, Math.PI * 2), el = rng.range(-0.2, 0.95);
    planes.push({ n: V3(Math.cos(a) * Math.cos(el), Math.sin(el), Math.sin(a) * Math.cos(el)), d: rng.range(0.58, 0.82), k: rng.range(0.85, 1.0) });
  }
  const v = new THREE.Vector3();
  const crackAt = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const n = fbm3(n3, v.x * 1.1 + off, v.y * 1.1, v.z * 1.1, 5);
    const r = 1 - Math.abs(n3(v.x * 2.6 + off, v.y * 2.6, v.z * 2.6));
    // 層状の節理
    const strata = Math.sin(v.y * 9 + n * 4) * 0.022;
    v.multiplyScalar(1 + n * 0.42 + r * r * 0.1 + strata);
    // 細い割れ目
    const crack = 1 - smoothstep(0.0, 0.07, Math.abs(n3(v.x * 3.1 + off * 0.5, v.y * 3.1, v.z * 3.1 + 7)));
    v.multiplyScalar(1 - crack * 0.04);
    crackAt[i] = crack;
    for (const P of planes) {
      const dd = v.dot(P.n) - P.d;
      if (dd > 0) v.addScaledVector(P.n, -dd * P.k);
    }
    v.multiply(stretch);
    if (v.y < -0.2) v.y = -0.2 + (v.y + 0.2) * 0.3;
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  const nrm = g.attributes.normal;

  // 窪み度：隣接頂点の平均との差を法線方向に測る（正 = 凹み）
  const idx = g.index.array;
  const sum = new Float32Array(pos.count * 3), cnt = new Uint16Array(pos.count), elen = new Float32Array(pos.count);
  const a = new THREE.Vector3(), b = new THREE.Vector3();
  for (let t = 0; t < idx.length; t += 3) {
    for (let e = 0; e < 3; e++) {
      const i = idx[t + e], j = idx[t + (e + 1) % 3];
      a.fromBufferAttribute(pos, i); b.fromBufferAttribute(pos, j);
      const l = a.distanceTo(b);
      sum[i * 3] += b.x; sum[i * 3 + 1] += b.y; sum[i * 3 + 2] += b.z; cnt[i]++; elen[i] += l;
      sum[j * 3] += a.x; sum[j * 3 + 1] += a.y; sum[j * 3 + 2] += a.z; cnt[j]++; elen[j] += l;
    }
  }
  const cav = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const c = cnt[i] || 1;
    a.set(sum[i * 3] / c - v.x, sum[i * 3 + 1] / c - v.y, sum[i * 3 + 2] / c - v.z);
    cav[i] = (a.x * nrm.getX(i) + a.y * nrm.getY(i) + a.z * nrm.getZ(i)) / (elen[i] / c || 1);
  }
  // 1回ぼかして、点状のノイズを抑える
  const cav2 = new Float32Array(pos.count);
  const csum = new Float32Array(pos.count), ccnt = new Uint16Array(pos.count);
  for (let t = 0; t < idx.length; t += 3) {
    for (let e = 0; e < 3; e++) {
      const i = idx[t + e], j = idx[t + (e + 1) % 3];
      csum[i] += cav[j]; ccnt[i]++; csum[j] += cav[i]; ccnt[j]++;
    }
  }
  for (let i = 0; i < pos.count; i++) cav2[i] = (cav[i] + csum[i] / (ccnt[i] || 1)) * 0.5;

  const colors = new Float32Array(pos.count * 3);
  const cBase = col('#8a8274'), cWarm = col('#978468'), cDark = col('#4e4840'), cAlgae = col('#667a36'), cTurf = col('#7a6c36'),
    cPink = col('#c4919c'), cLight = col('#b0a896');
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const ny = nrm.getY(i);
    const nz = n3(v.x * 3 + 50, v.y * 3, v.z * 3) * 0.5 + 0.5;
    const nz2 = n3(v.x * 7 + 20, v.y * 7 + 5, v.z * 7) * 0.5 + 0.5;
    const band = Math.sin(v.y * 14 + nz * 3) * 0.5 + 0.5; // 地層の色の縞
    c.copy(cBase).lerp(cWarm, band * 0.35).lerp(cLight, nz2 * 0.4).lerp(cDark, smoothstep(0.1, -0.2, v.y) * 0.7);
    // 上面の藻（まだらに）
    const top = smoothstep(0.3, 0.75, ny) * smoothstep(0.35, 0.55, nz + nz2 * 0.3);
    c.lerp(nz2 > 0.5 ? cAlgae : cTurf, top * 0.8);
    // 側面の石灰藻（桃色のかさぶた）
    const side = 1 - Math.abs(ny);
    c.lerp(cPink, smoothstep(0.6, 0.72, nz2) * side * 0.75);
    // 凹みは暗く、角は明るく、割れ目は黒く
    const k = cav2[i];
    c.multiplyScalar((1 - smoothstep(0.0, 0.35, k) * 0.45) * (1 + smoothstep(0.0, 0.3, -k) * 0.22) * (1 - crackAt[i] * 0.5));
    const ao = smoothstep(-0.25, 0.25, fbm3(n3, v.x * 1.1 + off, v.y * 1.1, v.z * 1.1, 3));
    c.multiplyScalar(0.75 + ao * 0.3);
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  g.computeBoundingSphere();
  return g;
}

// ───────── ホンダワラ（背の高い海藻） ─────────
export function makeSargassum(seed) {
  const rng = new RNG(seed);
  const b = new GeoBuilder();
  const H = 3.2;
  const stems = rng.int(2, 3);
  for (let s = 0; s < stems; s++) {
    const path = [];
    const ox = rng.range(-0.08, 0.08), oz = rng.range(-0.08, 0.08);
    const h = H * rng.range(0.7, 1.0);
    const bend = rng.range(-0.3, 0.3), bend2 = rng.range(-0.3, 0.3);
    for (let i = 0; i <= 18; i++) {
      const t = i / 18;
      path.push(V3(ox + Math.sin(t * 3 + s) * 0.06 + bend * t * t, t * h, oz + Math.cos(t * 2.5 + s) * 0.06 + bend2 * t * t));
    }
    b.tube(path, (t) => 0.012 * (1 - t * 0.6), 3, (t) => col('#4e3c16').lerp(col('#76602a'), t), (t) => ({ aSway: t * h / H }));
    // 小葉
    for (let i = 2; i < 18; i++) {
      for (let k = 0; k < 3; k++) {
        const t = (i + rng.next()) / 18;
        const p0 = path[i].clone();
        const a = rng.range(0, Math.PI * 2);
        const dir = V3(Math.cos(a), rng.range(0.3, 0.9), Math.sin(a)).normalize();
        const len = rng.range(0.07, 0.14) * (1.1 - t * 0.4);
        const leaf = [p0, p0.clone().addScaledVector(dir, len * 0.5), p0.clone().addScaledVector(dir, len)];
        const side = V3(-dir.z, 0, dir.x).normalize();
        const cc = col('#6e561c').lerp(col('#957a30'), rng.next());
        b.ribbon(leaf, (u) => 0.035 * Math.sin(Math.PI * Math.min(u * 1.1 + 0.05, 1)), (u, T, out) => out.copy(side), () => cc, () => ({ aSway: (t * h) / H }));
        // 気胞
        if (rng.chance(0.25)) {
          const sp = new THREE.SphereGeometry(0.012, 5, 4);
          b.merge(sp, new THREE.Matrix4().makeTranslation(p0.x + dir.x * 0.03, p0.y + 0.02, p0.z + dir.z * 0.03), () => col('#8e7430'), () => ({ aSway: (t * h) / H }));
        }
      }
    }
  }
  return b.build();
}

// ───────── ワカメ（長い帯状の海藻） ─────────
export function makeWakame(seed) {
  const rng = new RNG(seed);
  const b = new GeoBuilder();
  const n = rng.int(4, 7);
  for (let k = 0; k < n; k++) {
    const a = rng.range(0, Math.PI * 2);
    const len = rng.range(0.9, 1.9);
    const lean = rng.range(0.1, 0.45);
    const ox = rng.range(-0.1, 0.1), oz = rng.range(-0.1, 0.1);
    const path = [];
    const N = 18;
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const wob = Math.sin(t * 6 + k) * 0.06 * t;
      path.push(V3(ox + Math.cos(a) * (lean * t * t * len + wob), t * len, oz + Math.sin(a) * (lean * t * t * len + wob)));
    }
    const side = V3(-Math.sin(a), 0, Math.cos(a));
    const w = rng.range(0.07, 0.13);
    const c0 = col('#33280e'), c1 = col('#6a5418').lerp(col('#55601e'), rng.next() * 0.7);
    b.ribbon(path,
      (t) => w * Math.pow(Math.sin(Math.PI * Math.min(0.05 + t * 0.95, 1)), 0.45) * (1 + 0.22 * Math.sin(t * 52 + k * 3)) + 0.006,
      (t, T, out) => out.copy(side).applyAxisAngle(T, Math.sin(t * 9 + k * 1.3) * 0.9),
      (t) => c0.clone().lerp(c1, Math.min(1, t * 1.6)), (t) => ({ aSway: t * len / 1.4 }));
  }
  return b.build();
}

// ───────── カジメ（昆布の仲間） ─────────
export function makeKelp(seed) {
  const rng = new RNG(seed);
  const b = new GeoBuilder();
  const stipeH = rng.range(0.6, 0.9);
  const stipe = [];
  for (let i = 0; i <= 5; i++) stipe.push(V3(Math.sin(i) * 0.01, (i / 5) * stipeH, 0));
  b.tube(stipe, (t) => 0.022 * (1 - t * 0.3), 5, () => col('#4d3f1c'), (t) => ({ aSway: t * 0.35 }));
  const blades = rng.int(9, 13);
  for (let k = 0; k < blades; k++) {
    const a = (k / blades) * Math.PI * 2 + rng.range(-0.3, 0.3);
    const len = rng.range(0.55, 1.05);
    const up = rng.range(0.5, 1.3);
    const droop = rng.range(0.25, 0.7);
    const path = [];
    for (let i = 0; i <= 14; i++) {
      const t = i / 14;
      const r = Math.sin(t * Math.PI * 0.5) * len * 0.75;
      const y = stipeH + Math.sin(t * Math.PI * 0.7) * up * len * 0.55 - t * t * droop * len;
      path.push(V3(Math.cos(a + Math.sin(t * 5 + k) * 0.12) * r, y, Math.sin(a + Math.sin(t * 5 + k) * 0.12) * r));
    }
    const side = V3(-Math.sin(a), 0, Math.cos(a));
    const cc0 = col('#3e3012'), cc1 = col('#745d1e').lerp(col('#5e6a22'), rng.next() * 0.6);
    const w = rng.range(0.11, 0.16);
    b.ribbon(path, (t) => w * Math.pow(Math.sin(Math.PI * Math.min(0.06 + t * 0.94, 1)), 0.6) * (1 + 0.18 * Math.sin(t * 38 + k)) + 0.008,
      (t, T, out) => out.copy(side).applyAxisAngle(T, Math.sin(t * 17 + k * 1.7) * 0.7),
      (t) => cc0.clone().lerp(cc1, Math.min(1, t * 1.4)), (t) => ({ aSway: 0.35 + t * 0.65 }));
  }
  return b.build();
}

// ───────── アマモ ─────────
export function makeSeagrass(seed) {
  const rng = new RNG(seed);
  const b = new GeoBuilder();
  const n = rng.int(5, 8);
  for (let k = 0; k < n; k++) {
    const a = rng.range(0, Math.PI * 2);
    const len = rng.range(0.4, 1.1);
    const lean = rng.range(0.05, 0.35);
    const ox = rng.range(-0.08, 0.08), oz = rng.range(-0.08, 0.08);
    const path = [];
    for (let i = 0; i <= 6; i++) {
      const t = i / 6;
      path.push(V3(ox + Math.cos(a) * lean * t * t * len, t * len, oz + Math.sin(a) * lean * t * t * len));
    }
    const side = V3(-Math.sin(a), 0, Math.cos(a));
    const tip = col('#9fb553').lerp(col('#c2b75a'), rng.next() * 0.6);
    b.ribbon(path, () => 0.014, (t, T, out) => out.copy(side), (t) => col('#3f6a26').lerp(tip, t * t), (t) => ({ aSway: t * len }));
  }
  return b.build();
}

// ───────── ヤギ（うちわ状のサンゴ） ─────────
let fanTex = null;
export function seaFanTexture() {
  if (fanTex) return fanTex;
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const g = c.getContext('2d');
  const rng = new RNG(99);
  g.strokeStyle = '#fff';
  g.lineCap = 'round';
  const branch = (x, y, a, len, w, d) => {
    if (d > 7 || len < 4) return;
    const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len;
    g.lineWidth = w;
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo((x + x2) / 2 + rng.range(-4, 4), (y + y2) / 2, x2, y2); g.stroke();
    const n = d < 2 ? 3 : 2;
    for (let i = 0; i < n; i++) branch(x2, y2, a + rng.range(-0.7, 0.7), len * rng.range(0.62, 0.82), Math.max(1, w * 0.72), d + 1);
  };
  branch(128, 255, -Math.PI / 2, 60, 7, 0);
  // 網目
  g.globalAlpha = 0.5;
  g.lineWidth = 1;
  for (let i = 0; i < 260; i++) {
    const x = rng.range(20, 236), y = rng.range(20, 220);
    const dx = x - 128, dy = y - 230;
    if (dx * dx / 1.1 + dy * dy > 215 * 215) continue;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + rng.range(-9, 9), y + rng.range(-9, 9)); g.stroke();
  }
  fanTex = new THREE.CanvasTexture(c);
  fanTex.colorSpace = THREE.SRGBColorSpace;
  return fanTex;
}
export function makeSeaFan() {
  const b = new GeoBuilder();
  const NX = 4, NY = 5;
  for (let j = 0; j <= NY; j++) {
    for (let i = 0; i <= NX; i++) {
      const u = i / NX, v = j / NY;
      const x = (u - 0.5) * 1.2;
      const y = v * 1.1;
      const z = Math.sin(u * Math.PI) * 0.08 * v;
      b.vert(V3(x, y, z), V3(0, 0, 1), col('#ffffff').lerp(col('#dddddd'), v), [u, v], { aSway: v * 0.6 });
    }
  }
  for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
    const a = j * (NX + 1) + i;
    b.quad(a, a + 1, a + NX + 2, a + NX + 1);
  }
  return b.build();
}

// ───────── テーブルサンゴ ─────────
export function makeTableCoral(seed) {
  const rng = new RNG(seed);
  const b = new GeoBuilder();
  const stalk = new THREE.CylinderGeometry(0.06, 0.12, 0.35, 7);
  b.merge(stalk, new THREE.Matrix4().makeTranslation(0, 0.17, 0), () => col('#b8a890'), () => ({ aSway: 0 }));
  const R = rng.range(0.5, 0.8);
  const seg = 28, rings = 5;
  const center = b.vert(V3(0, 0.38, 0), V3(0, 1, 0), col('#e0cfb0'), [0.5, 0.5], { aSway: 0 });
  const rowStart = [];
  for (let r = 1; r <= rings; r++) {
    rowStart.push(b.count);
    for (let s = 0; s < seg; s++) {
      const a = (s / seg) * Math.PI * 2;
      const rr = (r / rings) * R * (1 + Math.sin(a * 5 + seed) * 0.06);
      const y = 0.38 + (r / rings) ** 2 * 0.08 + Math.sin(a * 11) * 0.01;
      const c = col('#b8a888').lerp(col('#8a7658'), r / rings);
      b.vert(V3(Math.cos(a) * rr, y, Math.sin(a) * rr), V3(0, 1, 0), c, [0, 0], { aSway: 0 });
    }
  }
  for (let s = 0; s < seg; s++) b.tri(center, rowStart[0] + (s + 1) % seg, rowStart[0] + s);
  for (let r = 0; r < rings - 1; r++) for (let s = 0; s < seg; s++) {
    const a = rowStart[r] + s, a2 = rowStart[r] + (s + 1) % seg;
    const c = rowStart[r + 1] + s, c2 = rowStart[r + 1] + (s + 1) % seg;
    b.quad(a, a2, c2, c);
  }
  // 裏面
  const under = new THREE.CircleGeometry(R * 1.02, seg);
  under.rotateX(Math.PI / 2);
  b.merge(under, new THREE.Matrix4().makeTranslation(0, 0.36, 0), () => col('#4f4638'), () => ({ aSway: 0 }));
  return b.build();
}

// ───────── 枝サンゴ ─────────
export function makeBranchCoral(seed) {
  const rng = new RNG(seed);
  const b = new GeoBuilder();
  const grow = (p, dir, len, r, d) => {
    const end = p.clone().addScaledVector(dir, len);
    const mid = p.clone().lerp(end, 0.5).add(V3(rng.range(-0.02, 0.02), 0, rng.range(-0.02, 0.02)));
    b.tube([p, mid, end], (t) => r * (1 - t * 0.35), 5, (t) => col('#d9b8a0').lerp(col('#f2e6d8'), (d + t) / 4), () => ({ aSway: 0 }));
    if (d >= 3) {
      const tip = new THREE.SphereGeometry(r * 0.8, 5, 4);
      b.merge(tip, new THREE.Matrix4().makeTranslation(end.x, end.y, end.z), () => col('#fff4ea'), () => ({ aSway: 0 }));
      return;
    }
    const n = d === 0 ? 4 : rng.int(2, 3);
    for (let i = 0; i < n; i++) {
      const nd = dir.clone().add(V3(rng.range(-0.8, 0.8), rng.range(0.1, 0.5), rng.range(-0.8, 0.8))).normalize();
      grow(end, nd, len * rng.range(0.6, 0.85), r * 0.72, d + 1);
    }
  };
  grow(V3(0, 0, 0), V3(0, 1, 0), 0.18, 0.045, 0);
  return b.build();
}

// ───────── 脳サンゴ ─────────
export function makeBrainCoral(seed) {
  const n3 = makeNoise3D(seed);
  let g = new THREE.SphereGeometry(0.5, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2);
  g.deleteAttribute('uv');
  g = mergeVertices(g);
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = n3(v.x * 6, v.y * 6, v.z * 6);
    const groove = Math.abs(Math.sin(n * 9)) * 0.03;
    v.multiplyScalar(1 + groove);
    v.y *= 0.8;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  const b = new GeoBuilder();
  b.merge(g, new THREE.Matrix4(), (pp) => col('#d8c79a').lerp(col('#a89a6e'), Math.abs(Math.sin(n3(pp.x * 6, pp.y * 6, pp.z * 6) * 9))), () => ({ aSway: 0 }));
  return b.build();
}

// ───────── ソフトコーラル ─────────
export function makeSoftCoral(seed) {
  const rng = new RNG(seed);
  const b = new GeoBuilder();
  const grow = (p, dir, len, r, d) => {
    const end = p.clone().addScaledVector(dir, len);
    b.tube([p, p.clone().lerp(end, 0.5), end], (t) => r * (1 - t * 0.25), 6, () => col('#ffffff').lerp(col('#e8e8e8'), d / 3), (t) => ({ aSway: (d + t) * 0.12 }));
    if (d >= 2) {
      for (let k = 0; k < 5; k++) {
        const s = new THREE.SphereGeometry(r * rng.range(1.1, 1.6), 6, 5);
        const o = end.clone().add(V3(rng.range(-1, 1), rng.range(0, 1), rng.range(-1, 1)).multiplyScalar(r * 1.4));
        b.merge(s, new THREE.Matrix4().makeTranslation(o.x, o.y, o.z), () => col('#ffffff'), () => ({ aSway: 0.4 }));
      }
      return;
    }
    const n = rng.int(2, 4);
    for (let i = 0; i < n; i++) {
      const nd = dir.clone().add(V3(rng.range(-0.9, 0.9), rng.range(0.2, 0.8), rng.range(-0.9, 0.9))).normalize();
      grow(end, nd, len * 0.8, r * 0.7, d + 1);
    }
  };
  grow(V3(0, 0, 0), V3(0, 1, 0), 0.22, 0.07, 0);
  return b.build();
}

// ───────── イソギンチャク ─────────
export function makeAnemone(seed) {
  const rng = new RNG(seed);
  const b = new GeoBuilder();
  const base = new THREE.CylinderGeometry(0.16, 0.2, 0.14, 12, 1, true);
  b.merge(base, new THREE.Matrix4().makeTranslation(0, 0.07, 0), () => col('#c4a07a'), () => ({ aSway: 0 }));
  const disc = new THREE.CircleGeometry(0.16, 12);
  disc.rotateX(-Math.PI / 2);
  b.merge(disc, new THREE.Matrix4().makeTranslation(0, 0.14, 0), () => col('#8a7a6a'), () => ({ aSway: 0 }));
  for (let i = 0; i < 90; i++) {
    const a = rng.range(0, Math.PI * 2), rr = Math.sqrt(rng.next()) * 0.16;
    const p0 = V3(Math.cos(a) * rr, 0.14, Math.sin(a) * rr);
    const dir = V3(Math.cos(a) * (0.3 + rr * 3), 1, Math.sin(a) * (0.3 + rr * 3)).normalize();
    const len = rng.range(0.1, 0.2);
    const path = [p0, p0.clone().addScaledVector(dir, len * 0.5), p0.clone().addScaledVector(dir, len).add(V3(0, 0, 0))];
    b.tube(path, (t) => 0.011 * (1 - t * 0.5), 3, (t) => col('#ffffff').lerp(col('#fff6e0'), t), (t) => ({ aSway: 0.2 + t * 0.6 }));
  }
  return b.build();
}

// ───────── ウニ・サザエ・アワビ・ヒトデ（shells.js） ─────────
export { makeUrchin, makeTurban, makeAbalone, makeStarfish, pickupMaterial } from './shells.js';

// ───────── 島の植物 ─────────
// 幹・枝（木肌）と葉は別のジオメトリで返し、葉だけ葉脈と透過光のあるマテリアルで描く。
// 影は落とさないので、樹冠の内側・下側ほど頂点色を暗くして奥行きを出す。

// 先の尖った細い葉を1枚（中心線 pts に沿った帯、先端は1点に絞る）。uv.x = 幅 0〜1、uv.y = 根元→先
function blade(b, pts, widthFn, across, nrmFn, colFn, swayFn) {
  const n = pts.length;
  const base = b.count;
  for (let i = 0; i < n - 1; i++) {
    const t = i / (n - 1);
    const w = widthFn(t) * 0.5;
    const nn = nrmFn(pts[i], t), c = colFn(t), ex = swayFn(t);
    b.vert(pts[i].clone().addScaledVector(across, -w), nn, c, [0, t], ex);
    b.vert(pts[i].clone().addScaledVector(across, w), nn, c, [1, t], ex);
  }
  const tip = b.vert(pts[n - 1], nrmFn(pts[n - 1], 1), colFn(1), [0.5, 1], swayFn(1));
  for (let i = 0; i < n - 2; i++) {
    const a = base + i * 2;
    b.quad(a, a + 1, a + 3, a + 2);
  }
  b.tri(base + (n - 2) * 2, base + (n - 2) * 2 + 1, tip);
}

// 経路の弧長パラメータ s (0〜1) の位置と接線
function along(path, s, outP, outT) {
  const f = s * (path.length - 1);
  const i = Math.min(path.length - 2, Math.floor(f)), k = f - i;
  outP.lerpVectors(path[i], path[i + 1], k);
  outT.subVectors(path[i + 1], path[i]).normalize();
}

const UP = V3(0, 1, 0);

// ───────── 島: ヤシの木（ココヤシ） ─────────
// 根元が膨らんで節の輪が並ぶ、弓なりの幹。羽状の葉を 20 枚ほど放射状に広げ、
// 若い葉は立ち、古い葉ほど垂れる。枯れ葉が幹に垂れ、実が房になる。
export function makePalm(seed) {
  const rng = new RNG(seed * 31 + 7);
  const wood = new GeoBuilder(), leaves = new GeoBuilder();
  const H = rng.range(7.5, 10.5);
  const la = rng.range(0, Math.PI * 2), lean = rng.range(1.2, 3.4);
  const lx = Math.cos(la) * lean, lz = Math.sin(la) * lean;
  const wob = rng.range(0, 6.28);
  const NS = 30;
  const trunk = [];
  for (let i = 0; i <= NS; i++) {
    const t = i / NS;
    // 根元で大きく傾き、上に行くほど起き上がる弓なり
    const k = 0.7 * (1 - (1 - t) ** 2) + 0.3 * t * t;
    const w = Math.sin(t * Math.PI * 1.4 + wob) * 0.12;
    trunk.push(V3(lx * k + w * Math.sin(la), t * H, lz * k - w * Math.cos(la)));
  }
  const cBark = col('#6c6256'), cBarkHi = col('#86796a'), cBase = col('#4f463d');
  wood.tube(trunk, (t) => 0.15 - t * 0.04 + 0.16 * (1 - smoothstep(0, 0.07, t)) + 0.035 * smoothstep(0.9, 1, t), 9,
    (t) => {
      const ring = Math.round(t * NS) % 2 ? 0.8 : 1;
      return cBark.clone().lerp(cBarkHi, smoothstep(0.1, 0.8, t) * 0.7).lerp(cBase, 1 - smoothstep(0, 0.12, t)).multiplyScalar(ring * (1 - smoothstep(0.9, 1, t) * 0.35));
    },
    (t) => ({ aSway: t * 0.3 }));
  const top = trunk[NS].clone();
  const crown = top.clone().add(V3(0, -0.25, 0));
  // 葉の付け根の膨らみ
  const boot = new THREE.SphereGeometry(0.3, 9, 6);
  boot.scale(1, 0.9, 1);
  wood.merge(boot, new THREE.Matrix4().makeTranslation(top.x, top.y - 0.05, top.z), (p, n) => col('#5c5a34').lerp(col('#3a3526'), smoothstep(0.3, -0.6, n.y)), () => ({ aSway: 0.3 }));
  // 実の房
  const nuts = rng.int(4, 9);
  for (let i = 0; i < nuts; i++) {
    const a = rng.range(0, Math.PI * 2), rr = rng.range(0.2, 0.32);
    const s = new THREE.SphereGeometry(0.14, 8, 6);
    s.scale(1, 1.12, 1);
    const cn = rng.pick(['#5f7a2c', '#6f8a30', '#a8812e', '#6b4a2a']);
    wood.merge(s, new THREE.Matrix4().makeTranslation(top.x + Math.cos(a) * rr, top.y - 0.32 - rng.range(0, 0.22), top.z + Math.sin(a) * rr),
      (p, n) => col(cn).multiplyScalar(0.75 + Math.max(n.y, 0) * 0.35), () => ({ aSway: 0.3 }));
  }

  // 葉
  const cYoung = col('#86a83e'), cLeaf = col('#3f6f25'), cLeaf2 = col('#5d8c2f'), cOld = col('#a19a45'), cDead = col('#7c5d34'), cDead2 = col('#a8895a');
  const F = rng.int(18, 23);
  const NR = 18, NL = 30;
  const p = V3(0, 0, 0), T = V3(0, 0, 0), S = V3(0, 0, 0), N = V3(0, 0, 0), D = V3(0, 0, 0), A = V3(0, 0, 0);
  const frond = (az, elev, len, droop, age, dead) => {
    const path = [];
    const q = crown.clone().add(V3(Math.cos(az) * 0.15, 0.12, Math.sin(az) * 0.15));
    const tw = rng.range(-0.12, 0.12);
    for (let i = 0; i <= NR; i++) {
      const s = i / NR;
      path.push(q.clone());
      const e = elev - droop * s ** 1.5, a = az + tw * s;
      q.add(V3(Math.cos(a) * Math.cos(e), Math.sin(e), Math.sin(a) * Math.cos(e)).multiplyScalar(len / NR));
    }
    const base = dead ? cDead : age < 0.2 ? cYoung.clone().lerp(cLeaf2, age * 5) : cLeaf.clone().lerp(cLeaf2, rng.next() * 0.6).lerp(cOld, smoothstep(0.75, 1, age) * 0.7);
    // 葉軸
    leaves.tube(path, (t) => 0.05 * (1 - t * 0.85), 3, (t) => (dead ? cDead2 : col('#9b9148')).clone().multiplyScalar(0.8 + t * 0.2), (t) => ({ aSway: 0.3 + t * 0.7 }));
    const fold = dead ? 1.2 : 0.3 + age * 0.45;
    const lmax = len * rng.range(0.2, 0.24);
    for (let i = 0; i < NL; i++) {
      const s = 0.1 + (i + rng.range(-0.3, 0.3)) / NL * 0.9;
      along(path, Math.min(s, 0.995), p, T);
      S.crossVectors(T, UP);
      if (S.lengthSq() < 1e-4) S.set(1, 0, 0);
      S.normalize();
      N.crossVectors(S, T).normalize(); // 葉軸に垂直で上向き
      const l = lmax * Math.pow(Math.sin(Math.PI * (0.08 + 0.92 * s)), 0.6) * (1 - 0.3 * s);
      for (const sd of [-1, 1]) {
        if (rng.chance(dead ? 0.25 : 0.05)) continue; // ちぎれた小葉
        const f = fold + rng.range(-0.12, 0.12);
        D.copy(S).multiplyScalar(sd * Math.cos(f)).addScaledVector(N, -Math.sin(f)).addScaledVector(T, 0.6).normalize();
        A.copy(T).addScaledVector(D, -T.dot(D)).normalize();
        const sag = l * (0.18 + age * 0.15 + (dead ? 0.3 : 0));
        const pts = [p.clone(), p.clone().addScaledVector(D, l * 0.5).addScaledVector(UP, -sag * 0.3), p.clone().addScaledVector(D, l).addScaledVector(UP, -sag)];
        const cl = base.clone().lerp(dead ? cDead2 : cOld, rng.next() * 0.25);
        const occ = 0.62 + 0.38 * smoothstep(0, 0.6, s); // 樹冠の奥は暗く
        blade(leaves, pts, (t) => 0.075 * Math.pow(Math.sin(Math.PI * (0.15 + 0.85 * t)), 0.7), A,
          (pp) => pp.clone().sub(crown).normalize().add(V3(0, 0.9, 0)).normalize(),
          (t) => cl.clone().multiplyScalar(occ * (0.92 + t * 0.12)),
          (t) => ({ aSway: 0.3 + s * 0.7 + t * 0.12 }));
      }
    }
  };
  for (let k = 0; k < F; k++) {
    const u = (k + rng.next() * 0.8) / F; // 0 = 若い（立つ）→ 1 = 古い（垂れる）
    const az = k * 2.39996 + rng.range(-0.15, 0.15);
    frond(az, 1.05 - u * 1.55, rng.range(3.8, 4.9) * (u < 0.12 ? 0.75 : 1), rng.range(0.7, 1.2) + u * 0.5, u, false);
  }
  for (let k = 0, nd = rng.int(1, 3); k < nd; k++) frond(rng.range(0, 6.28), -1.25, rng.range(2.4, 3.2), 0.1, 1, true);
  return { wood: wood.build(), leaves: leaves.build() };
}

// ───────── 島: アダン（タコノキ） ─────────
// 支柱根で立ち、幹が二股・三股に分かれて、枝先に細長い葉をらせん状に束ねる。葉は途中で折れて垂れる。
export function makePandanus(seed) {
  const rng = new RNG(seed * 17 + 5);
  const wood = new GeoBuilder(), leaves = new GeoBuilder();
  const cWood = col('#6f6456'), cWood2 = col('#8d8270');
  const woodCol = (t) => cWood.clone().lerp(cWood2, t * 0.6 + rng.next() * 0.1);
  const h0 = rng.range(1.1, 1.7);
  const base = V3(rng.range(-0.2, 0.2), 0.9, rng.range(-0.2, 0.2));
  // 支柱根
  for (let i = 0, nr = rng.int(6, 9); i < nr; i++) {
    const a = (i / nr) * Math.PI * 2 + rng.range(-0.3, 0.3), rr = rng.range(0.45, 0.85);
    const g = V3(Math.cos(a) * rr, -0.1, Math.sin(a) * rr);
    const top = base.clone().add(V3(Math.cos(a) * 0.08, rng.range(-0.3, 0.4), Math.sin(a) * 0.08));
    const mid = g.clone().lerp(top, 0.5).add(V3(Math.cos(a) * 0.12, 0.15, Math.sin(a) * 0.12));
    wood.tube([g, mid, top], (t) => 0.035 + t * 0.018, 5, () => col('#7a6c58').lerp(col('#5c5244'), rng.next() * 0.5), () => ({ aSway: 0 }));
  }
  const rosette = (tip, dir) => {
    const nl = rng.int(28, 36);
    const hasFruit = rng.chance(0.25);
    for (let i = 0; i < nl; i++) {
      const az = i * 2.39996;
      const u = i / nl; // 内側（若い）→ 外側（古い）
      const up = 1.25 - u * 1.2 + rng.range(-0.1, 0.1);
      const d0 = V3(Math.cos(az) * Math.cos(up), Math.sin(up), Math.sin(az) * Math.cos(up)).addScaledVector(dir, 0.35).normalize();
      const len = rng.range(1.3, 1.9) * (u < 0.15 ? 0.7 : 1);
      const kink = rng.range(0.35, 0.55);
      const pts = [];
      const q = tip.clone(), d = d0.clone();
      for (let j = 0; j <= 7; j++) {
        const s = j / 7;
        pts.push(q.clone());
        // 途中で折れて垂れる
        const bend = s > kink ? 0.55 + u * 0.35 : 0.06;
        d.addScaledVector(UP, -bend).normalize();
        q.addScaledVector(d, len / 7);
      }
      const across = V3(-d0.z, 0, d0.x).normalize();
      const old = u > 0.85 && rng.chance(0.5);
      const cl = old ? col('#9a7d45') : col('#3f6b2a').lerp(col('#6c9a3a'), rng.next() * 0.5 + (1 - u) * 0.3);
      const occ = 0.7 + 0.3 * (1 - u);
      blade(leaves, pts, (t) => 0.12 * (1 - t * 0.7), across,
        (pp) => pp.clone().sub(tip).normalize().add(V3(0, 1, 0)).normalize(),
        (t) => cl.clone().multiplyScalar(occ * (0.9 + t * 0.15)),
        (t) => ({ aSway: 0.35 + t * 0.55 }));
    }
    if (hasFruit) {
      const f = new THREE.IcosahedronGeometry(0.16, 1);
      f.scale(1, 1.2, 1);
      wood.merge(f, new THREE.Matrix4().makeTranslation(tip.x + dir.x * 0.1, tip.y - 0.22, tip.z + dir.z * 0.1),
        (pp, n) => col('#d9822b').lerp(col('#e8b040'), Math.max(n.y, 0)), () => ({ aSway: 0.3 }));
    }
  };
  const branch = (from, dir, len, r, depth) => {
    const pts = [];
    const d = dir.clone();
    const q = from.clone();
    for (let j = 0; j <= 5; j++) {
      pts.push(q.clone());
      d.lerp(UP, 0.05).normalize();
      q.addScaledVector(d, len / 5);
    }
    wood.tube(pts, (t) => r * (1 - t * 0.35), 6, woodCol, (t) => ({ aSway: 0.1 + depth * 0.1 + t * 0.1 }));
    const end = pts[5], dEnd = d.clone();
    if (depth < 2 && (depth === 0 || rng.chance(0.85))) {
      const nb = depth === 0 ? 3 : 2;
      const a0 = rng.range(0, 6.28);
      for (let k = 0; k < nb; k++) {
        const a = a0 + (k / nb) * Math.PI * 2 + rng.range(-0.3, 0.3);
        const out = rng.range(0.8, 1.15);
        const nd = V3(Math.cos(a) * Math.sin(out), Math.cos(out), Math.sin(a) * Math.sin(out)).lerp(dEnd, 0.3).normalize();
        branch(end, nd, rng.range(0.8, 1.3) * (depth ? 0.75 : 1), r * 0.75, depth + 1);
      }
    } else {
      rosette(end, dEnd);
    }
  };
  branch(base, V3(rng.range(-0.25, 0.25), 1, rng.range(-0.25, 0.25)).normalize(), h0, 0.15, 0);
  return { wood: wood.build(), leaves: leaves.build() };
}

// ───────── 島: 低木 ─────────
// 丸い茂みの芯のまわりに葉を放射状に差して、輪郭をギザギザにする
export function makeBush(seed) {
  const rng = new RNG(seed);
  const n3 = makeNoise3D(seed);
  const b = new GeoBuilder();
  const cDark = col('#223f18'), cMid = col('#3d6a26'), cHi = col('#6c9a38');
  const blobs = rng.int(3, 5);
  const P = V3(0, 0, 0), Nn = V3(0, 0, 0), D = V3(0, 0, 0), A = V3(0, 0, 0);
  for (let i = 0; i < blobs; i++) {
    const R = rng.range(0.6, 1.05);
    const o = V3(rng.range(-0.8, 0.8), rng.range(0.25, 0.7), rng.range(-0.8, 0.8));
    let g = new THREE.IcosahedronGeometry(R * 0.88, 1);
    g.deleteAttribute('uv'); g.deleteAttribute('normal');
    g = mergeVertices(g);
    const p = g.attributes.position;
    const v = new THREE.Vector3();
    for (let k = 0; k < p.count; k++) {
      v.fromBufferAttribute(p, k);
      v.multiplyScalar(1 + n3(v.x * 3 + i * 10, v.y * 3, v.z * 3) * 0.2);
      if (v.y < 0) v.y *= 0.4;
      p.setXYZ(k, v.x, v.y, v.z);
    }
    g.computeVertexNormals();
    b.merge(g, new THREE.Matrix4().makeTranslation(o.x, o.y, o.z), (pp, nn) => cDark.clone().lerp(cMid, smoothstep(-0.4, 1, nn.y) * 0.7), () => ({ aSway: 0.1 }));
    // 表面の葉
    for (let k = 0, nl = Math.round(R * 70); k < nl; k++) {
      const u = rng.range(-0.35, 1), a = rng.range(0, Math.PI * 2);
      Nn.set(Math.cos(a) * Math.sqrt(1 - u * u), u, Math.sin(a) * Math.sqrt(1 - u * u));
      P.copy(Nn).multiplyScalar(R * 0.82);
      if (P.y < 0) P.y *= 0.4;
      P.add(o);
      D.set(rng.range(-1, 1), rng.range(-1, 1), rng.range(-1, 1)).addScaledVector(Nn, 1.6).normalize();
      A.crossVectors(D, Nn);
      if (A.lengthSq() < 1e-4) A.set(1, 0, 0);
      A.normalize();
      const L = rng.range(0.28, 0.42);
      const cl = cMid.clone().lerp(cHi, smoothstep(-0.2, 1, Nn.y) * 0.6 + rng.next() * 0.35).multiplyScalar(0.8 + 0.2 * smoothstep(-0.3, 0.6, Nn.y));
      const nrm = Nn.clone().add(V3(0, 0.6, 0)).normalize();
      blade(b, [P.clone(), P.clone().addScaledVector(D, L * 0.5), P.clone().addScaledVector(D, L).addScaledVector(UP, -L * 0.15)],
        (t) => 0.2 * Math.sin(Math.PI * (0.2 + 0.8 * t)), A, () => nrm, () => cl, () => ({ aSway: 0.25 }));
    }
  }
  return b.build();
}

// ───────── 島: 浜の草むら ─────────
export function makeGrassTuft(seed) {
  const rng = new RNG(seed * 13 + 1);
  const b = new GeoBuilder();
  const cG = col('#4f7a2a'), cG2 = col('#7f9c45'), cStraw = col('#b3a36a');
  for (let i = 0, n = rng.int(20, 28); i < n; i++) {
    const a = rng.range(0, Math.PI * 2), r0 = rng.range(0, 0.18);
    const root = V3(Math.cos(a) * r0, -0.02, Math.sin(a) * r0);
    const out = rng.range(0.2, 0.7), len = rng.range(0.35, 0.8);
    const d = V3(Math.cos(a) * Math.sin(out), Math.cos(out), Math.sin(a) * Math.sin(out));
    const pts = [];
    const q = root.clone(), dd = d.clone();
    for (let j = 0; j <= 3; j++) {
      pts.push(q.clone());
      dd.addScaledVector(UP, -0.28).normalize();
      q.addScaledVector(dd, len / 3);
    }
    const across = V3(-Math.sin(a), 0, Math.cos(a));
    const cl = cG.clone().lerp(cG2, rng.next()).lerp(cStraw, rng.chance(0.2) ? 0.7 : 0);
    blade(b, pts, (t) => 0.045 * (1 - t * 0.6), across, () => UP, (t) => cl.clone().multiplyScalar(0.7 + t * 0.35), (t) => ({ aSway: t * 0.8 }));
  }
  return b.build();
}

// ───────── 島: 拠点の小屋 ─────────
export function makeHut() {
  const b = new GeoBuilder();
  const wood = (h) => col('#7a6244').lerp(col('#9c8360'), h);
  const post = (x, z, h) => {
    const g = new THREE.CylinderGeometry(0.07, 0.09, h, 6);
    b.merge(g, new THREE.Matrix4().makeTranslation(x, h / 2, z), () => wood(Math.random() * 0.3));
  };
  post(-1.5, -1.1, 2.4); post(1.5, -1.1, 2.4); post(-1.5, 1.1, 1.2); post(1.5, 1.1, 1.2);
  const beam = new THREE.CylinderGeometry(0.06, 0.06, 3.4, 6);
  beam.rotateZ(Math.PI / 2);
  b.merge(beam, new THREE.Matrix4().makeTranslation(0, 2.35, -1.1), () => wood(0.2));
  b.merge(beam, new THREE.Matrix4().makeTranslation(0, 1.15, 1.1), () => wood(0.1));
  // 葉葺きの屋根
  const rng = new RNG(5);
  for (let i = 0; i < 26; i++) {
    const x = -1.7 + (i / 25) * 3.4;
    // 隣の葉と同じ平面に重ならないよう、交互に高さをずらす（ちらつき防止）
    const lift = (i % 2) * 0.035;
    const p0 = V3(x + rng.range(-0.05, 0.05), 2.45 + lift, -1.25);
    const p1 = V3(x + rng.range(-0.1, 0.1), 1.2 + lift, 1.35);
    const path = [p0, p0.clone().lerp(p1, 0.5).add(V3(0, 0.08, 0)), p1];
    const cc = col('#a38b52').lerp(col('#7d6a3a'), rng.next());
    b.ribbon(path, () => 0.2, (t, T, out) => out.set(1, 0, 0), () => cc, () => ({}));
  }
  // 物干しの魚（ご愛嬌）
  const line = new THREE.CylinderGeometry(0.008, 0.008, 2.2, 3);
  line.rotateZ(Math.PI / 2);
  b.merge(line, new THREE.Matrix4().makeTranslation(3.0, 1.5, 0), () => col('#ccc0a0'));
  post(1.9, 0, 1.6); post(4.1, 0, 1.6);
  for (let i = 0; i < 4; i++) {
    const f = new THREE.SphereGeometry(0.1, 8, 6);
    f.scale(0.35, 1.6, 0.9);
    b.merge(f, new THREE.Matrix4().makeTranslation(2.3 + i * 0.5, 1.28, 0), () => col('#b8a078'));
  }
  return b.build();
}

export function makeCampfire() {
  const b = new GeoBuilder();
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    const s = new THREE.IcosahedronGeometry(0.16, 1);
    s.scale(1, 0.7, 1);
    b.merge(s, new THREE.Matrix4().makeTranslation(Math.cos(a) * 0.55, 0.08, Math.sin(a) * 0.55), () => col('#6b6660').lerp(col('#3a3632'), Math.random() * 0.5));
  }
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const g = new THREE.CylinderGeometry(0.045, 0.06, 0.9, 6);
    const m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(0.55 * Math.cos(a), 0, 0.55 * Math.sin(a)));
    m.setPosition(Math.cos(a) * -0.17, 0.35, Math.sin(a) * 0.17);
    b.merge(g, m, (p) => col('#4a3a2a').lerp(col('#1a1612'), smoothstep(0.1, 0.6, p.y)));
  }
  return b.build();
}

export function makeDriftwood(seed) {
  const rng = new RNG(seed);
  const b = new GeoBuilder();
  const len = rng.range(1.5, 3.2);
  const path = [];
  for (let i = 0; i <= 6; i++) path.push(V3((i / 6 - 0.5) * len, 0.1 + Math.sin(i * 1.3) * 0.04, Math.sin(i * 0.9 + seed) * 0.12));
  b.tube(path, (t) => 0.09 + Math.sin(t * 7) * 0.02, 7, (t) => col('#c2b299').lerp(col('#9c8b72'), Math.abs(Math.sin(t * 20)) * 0.5));
  return b.build();
}

// 看板用テクスチャ「0円」
export function signTexture() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 256;
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, 256);
  grd.addColorStop(0, '#b89b6c'); grd.addColorStop(1, '#8e7248');
  g.fillStyle = grd; g.fillRect(0, 0, 512, 256);
  g.strokeStyle = 'rgba(60,40,20,0.35)';
  for (let i = 0; i < 40; i++) { g.lineWidth = Math.random() * 2; g.beginPath(); g.moveTo(0, Math.random() * 256); g.bezierCurveTo(170, Math.random() * 256, 340, Math.random() * 256, 512, Math.random() * 256); g.stroke(); }
  g.fillStyle = '#2a1a0e';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = '150px "Yuji Syuku", "Yu Mincho", serif';
  g.fillText('0円', 256, 118);
  g.font = '44px "Yuji Syuku", "Yu Mincho", serif';
  g.fillText('無人島 漁師小屋', 256, 212);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
