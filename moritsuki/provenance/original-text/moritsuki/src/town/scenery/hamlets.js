// 田んぼの中の集落・農家・林・一本木（歩いては行かない田園。遠く・空から見る景色）
// ・田んぼの区画はそのまま。その上に屋敷の盛り土（少し高い平らな地面）をかぶせ、家と木を置く（砺波の散居村のような形）
// ・盛り土は中心から放射状にのばし、道・川・土手・町並み・田の外（森など）の手前で止める。道ぞいの集落は道に沿った辺になる
// ・集落（3〜7 軒・屋敷林）は大きな道ぞい・山すそに、農家（1〜2 軒）・林（鎮守の森のようなこんもりした木立）・一本木は田の中に
// ・木の樹冠は山の森と同じ形・色（buildForest の extra に渡す）。幹だけここで描く
import * as THREE from 'three';
import { M, roadW } from '../layout.js';
import { rng, hash2, fbm2, segDist } from '../data.js';
import { paint } from '../materials.js';
import { ZONES } from './plan.js';
import { inRing } from './paddies.js';
import { farmhouse, FarmGeo } from './farms.js';

const REACH = 1700;
const AWAY = 70;             // 町並み（歩いて行ける所）の輪から離す
const RAYS = 48;             // 盛り土のふちの細かさ
const STEP = 1.5;            // ふちを探す刻み
const LIFT = 0.45;           // 田の面から盛り土の上まで
const KINDS = {
  hamlet: { n: 16, R: [42, 62], space: 320, houses: [3, 7] },
  farm: { n: 24, R: [20, 28], space: 150, houses: [1, 2] },
  grove: { n: 20, R: [13, 26], space: 130 },
  tree: { n: 40, R: [3.2, 4.2], space: 70 },
};
const OBST = M.ROAD | M.WATER | M.RAIL | M.BLD | M.TOWN | M.KEEP | M.HARBOR | M.BEACH | M.LEVEE | M.PAVE | M.LOT | M.AREA;
const C = (h) => new THREE.Color(h);

export function buildHamlets(ctx, paddies) {
  const { data, mask, ground } = ctx;
  const { core, V } = data;
  const t0 = performance.now();
  const r = rng(7707);
  const covered = paddies.userData.covered;

  // ---------- 田の面の高さ（区画の中なら面の高さ） ----------
  const PC = 60, pcells = new Map();
  for (const pc of paddies.userData.parcels) {
    const pts = pc.ring.map(([a, b]) => pc.W(a, b));
    let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
    for (const [x, z] of pts) { x0 = Math.min(x0, x); z0 = Math.min(z0, z); x1 = Math.max(x1, x); z1 = Math.max(z1, z); }
    pc._bb = [x0, z0, x1, z1];
    for (let j = Math.floor(z0 / PC); j <= Math.floor(z1 / PC); j++) for (let i = Math.floor(x0 / PC); i <= Math.floor(x1 / PC); i++) {
      const k = i + ',' + j;
      if (!pcells.has(k)) pcells.set(k, []);
      pcells.get(k).push(pc);
    }
  }
  const surf = (x, z) => {
    let y = null;
    for (const pc of pcells.get(Math.floor(x / PC) + ',' + Math.floor(z / PC)) || []) {
      const [x0, z0, x1, z1] = pc._bb;
      if (x < x0 || x > x1 || z < z0 || z > z1) continue;
      const dx = x - pc.sx, dz = z - pc.sz, u = dx * pc.ux + dz * pc.uz, v = dx * pc.vx + dz * pc.vz;
      if (inRing(pc.ring, u, v)) { const h = pc.y + pc.gu * u + pc.gv * v + 0.14; y = y === null ? h : Math.max(y, h); }
    }
    return y;
  };
  const top = (x, z) => { const s = surf(x, z); return Math.max(ground(x, z) + 0.2, s === null ? -Infinity : s + LIFT); };
  const low = (x, z) => { const s = surf(x, z); return Math.min(ground(x, z), s === null ? Infinity : s) - 0.5; };

  // ---------- 盛り土を置けない所（道・川・水面・町並み・田の外） ----------
  const SC = 40, segs = new Map();
  const addLine = (p, half) => {
    for (let k = 0; k + 1 < p.length; k++) {
      const [ax, az] = p[k], [bx, bz] = p[k + 1];
      const s = [ax, az, bx, bz, half];
      for (let j = Math.floor((Math.min(az, bz) - half) / SC); j <= Math.floor((Math.max(az, bz) + half) / SC); j++)
        for (let i = Math.floor((Math.min(ax, bx) - half) / SC); i <= Math.floor((Math.max(ax, bx) + half) / SC); i++) {
          const key = i + ',' + j;
          if (!segs.has(key)) segs.set(key, []);
          segs.get(key).push(s);
        }
    }
  };
  for (const rd of V.roads) addLine(rd.p, roadW(rd.k) / 2 + 1.5);
  for (const st of V.streams) addLine(st.p, st.k === 'river' ? 7 : 3.5);
  for (const w of V.water) addLine([...w.p, w.p[0]], 2);
  const ok = (x, z) => {
    if (x * x + z * z > REACH * REACH || !covered(x, z)) return false;
    if (core.inside(x, z, 2) && (mask.get(x, z) & OBST)) return false;
    for (const [ax, az, bx, bz, h] of segs.get(Math.floor(x / SC) + ',' + Math.floor(z / SC)) || []) if (segDist(x, z, ax, az, bx, bz) < h) return false;
    for (const Z of ZONES) if (Math.hypot(x - Z.x, z - Z.z) < Z.r + AWAY * 0.6) return false;
    return true;
  };
  // いちばん近い大きな道までの距離（集落は道ぞいに）
  const major = V.roads.filter((rd) => ['trunk', 'primary', 'secondary', 'tertiary'].includes(rd.k));
  const roadDist = (x, z) => {
    let d = Infinity;
    for (const rd of major) for (let k = 0; k + 1 < rd.p.length; k++) d = Math.min(d, segDist(x, z, rd.p[k][0], rd.p[k][1], rd.p[k + 1][0], rd.p[k + 1][1]));
    return d;
  };

  // 中心から放射状にふちを探す（星形の多角形）
  const outline = (cx, cz, R, seed) => {
    const rad = [];
    for (let a = 0; a < RAYS; a++) {
      const th = (a / RAYS) * Math.PI * 2, dx = Math.cos(th), dz = Math.sin(th);
      const want = R * (0.82 + 0.36 * fbm2(Math.cos(th) * 1.3 + seed, Math.sin(th) * 1.3 + seed * 0.7));
      let d = 0;
      while (d + STEP <= want && ok(cx + dx * (d + STEP), cz + dz * (d + STEP))) d += STEP;
      rad.push(Math.max(0, d - (d + STEP <= want ? 1.2 : 0)));
    }
    // とがりをならす（となりより大きく飛び出さない）
    for (let it = 0; it < 2; it++) for (let a = 0; a < RAYS; a++) {
      const p = rad[(a + RAYS - 1) % RAYS], n = rad[(a + 1) % RAYS];
      rad[a] = Math.min(rad[a], Math.max(p, n) + STEP * 1.5, (p + n) / 2 + R * 0.35);
    }
    return rad;
  };
  const radAt = (s, x, z) => {
    let th = Math.atan2(z - s.z, x - s.x);
    if (th < 0) th += Math.PI * 2;
    const f = (th / (Math.PI * 2)) * RAYS, a = Math.floor(f) % RAYS, t = f - Math.floor(f);
    return s.rad[a] * (1 - t) + s.rad[(a + 1) % RAYS] * t;
  };
  const inside = (s, x, z, m = 0) => Math.hypot(x - s.x, z - s.z) < radAt(s, x, z) - m;

  // ---------- 場所を決める ----------
  const cands = [];
  const G = 26;
  for (let z = -REACH; z < REACH; z += G) for (let x = -REACH; x < REACH; x += G) {
    const px = x + (r() - 0.5) * G * 0.9, pz = z + (r() - 0.5) * G * 0.9;
    if (!ok(px, pz)) continue;
    if (ZONES.some((Z) => Math.hypot(px - Z.x, pz - Z.z) < Z.r + AWAY)) continue;
    // 山すそ: 60m 先が田の外（森）の向きがいくつか
    let edge = 0;
    for (let a = 0; a < 8; a++) { const th = (a / 8) * Math.PI * 2; if (!covered(px + Math.cos(th) * 60, pz + Math.sin(th) * 60)) edge++; }
    cands.push({ x: px, z: pz, road: roadDist(px, pz), edge, v: r() });
  }
  const sites = [];
  const place = (kind, score) => {
    const K = KINDS[kind];
    const list = cands.map((c) => ({ c, s: score(c) })).filter((q) => q.s > 0).sort((a, b) => b.s - a.s);
    let n = 0;
    for (const { c } of list) {
      if (n >= K.n) break;
      // 同じ種類どうしは space、ちがう種類とは盛り土が重ならない程度に
      if (sites.some((s) => Math.hypot(s.x - c.x, s.z - c.z) < (s.kind === kind ? K.space : Math.max(s.R + K.R[1] + 30, 0.45 * Math.max(K.space, KINDS[s.kind].space))))) continue;
      const R = K.R[0] + r() * (K.R[1] - K.R[0]);
      const s = { kind, x: c.x, z: c.z, R, seed: r() * 50 };
      s.rad = outline(c.x, c.z, R, s.seed);
      const mean = s.rad.reduce((a, b) => a + b, 0) / RAYS;
      if (mean < R * (kind === 'tree' ? 0.9 : 0.6) || Math.min(...s.rad) < R * 0.25) continue;
      // 坂の途中はやめる（盛り土の上の高さの差が大きい所）
      s.plane = padHeight(c.x, c.z, Math.max(...s.rad) + 2, top);
      const ys = [];
      for (let a = 0; a < RAYS; a++) { const th = (a / RAYS) * Math.PI * 2; for (const f of [0, 0.5, 1]) ys.push(s.plane(c.x + Math.cos(th) * s.rad[a] * f, c.z + Math.sin(th) * s.rad[a] * f)); }
      if (Math.max(...ys) - Math.min(...ys) > (kind === 'hamlet' ? 2.6 : 1.8)) continue;
      sites.push(s);
      n++;
    }
  };
  // 集落: 大きな道ぞい（道から 20〜55m）か山すそ
  place('hamlet', (c) => (c.road > 18 && c.road < 55 ? 1 : 0) + (c.edge >= 1 && c.edge <= 4 ? 0.8 : 0) + c.v * 0.6 - (c.road < 18 ? 2 : 0));
  // 農家: どこでも（道・山すそに少し寄る）
  place('farm', (c) => 0.2 + c.v + (c.road < 80 ? 0.3 : 0) + (c.edge ? 0.2 : 0));
  // 林: 田の中ほど・山すそ
  place('grove', (c) => 0.2 + c.v + (c.edge === 0 ? 0.3 : 0.1));
  // 一本木: 田の真ん中
  place('tree', (c) => (c.edge === 0 ? 1 : 0.3) + c.v);

  // ---------- 家 ----------
  const houses = [];
  for (const s of sites) {
    if (!KINDS[s.kind].houses) continue;
    const [h0, h1] = KINDS[s.kind].houses;
    const want = h0 + Math.floor(r() * (h1 - h0 + 1));
    // 家の向き: 南（z+）寄り、ときどき道の方
    const face = (r() - 0.5) * 0.8;
    let placed = 0;
    for (let t = 0; t < 80 && placed < want; t++) {
      const a = r() * Math.PI * 2, d = placed || s.kind === 'hamlet' ? r() * s.R * 0.75 : r() * 4;
      const x = s.x + Math.cos(a) * d, z = s.z + Math.sin(a) * d;
      const w = 10 + r() * 4, dd = 7 + r() * 2.5;
      if (houses.some((q) => Math.hypot(q.x - x, q.z - z) < 18)) continue;
      const yaw = face + (r() - 0.5) * 0.3 + (r() < 0.2 ? Math.PI / 2 : 0);
      const cs = Math.cos(yaw), sn = Math.sin(yaw);
      let fit = true;
      for (const [aa, bb] of [[-w / 2 - 7, -dd / 2 - 5], [w / 2 + 7, -dd / 2 - 5], [w / 2 + 7, dd / 2 + 4], [-w / 2 - 7, dd / 2 + 4]]) {
        if (!inside(s, x + aa * cs + bb * sn, z - aa * sn + bb * cs, 1)) { fit = false; break; }
      }
      if (!fit) continue;
      let y = -Infinity;
      for (const [aa, bb] of [[-w / 2, -dd / 2], [w / 2, -dd / 2], [w / 2, dd / 2], [-w / 2, dd / 2], [0, 0]]) y = Math.max(y, s.plane(x + aa * cs + bb * sn, z - aa * sn + bb * cs));
      houses.push({ x, z, yaw, w, d: dd, y: y + 0.3, r: rng(Math.floor(hash2(x, z) * 1e9) + 3), site: s });
      placed++;
    }
    s.houses = houses.filter((h) => h.site === s);
  }

  // ---------- 木（樹冠は森と同じ形。[x, y, z, s, 種類] ＋ 幹） ----------
  const crowns = [], trunks = [];
  const nearHouse = (x, z, m) => houses.some((h) => Math.hypot(h.x - x, h.z - z) < Math.max(h.w, h.d) * 0.5 + m);
  const tree = (x, y, z, s, sp, th) => {
    // 杉（円すいの下の端が幹の上）
    if (sp === 1) { crowns.push([x, y + th + 0.3 * s, z, s, 1]); if (th > 0.5) trunks.push([x, y - 0.1, z, th + 0.8, 0.2]); return; }
    crowns.push([x, y + th + s * 0.38, z, s, sp]);
    if (th > 0.5) {
      trunks.push([x, y - 0.1, z, th + s * 0.35, 0.16 + s * 0.035]);
      // 幹のある広葉樹は、横と上に小さい房を足して丸い石のように見せない
      if (sp === 0 && s > 2.6) {
        const a0 = hash2(x * 3.1, z * 1.7) * 6.28, n = s > 4.5 ? 4 : 2;
        for (let k = 0; k < n; k++) {
          const a = a0 + (k / n) * 6.28 + (hash2(z + k, x) - 0.5) * 0.8;
          crowns.push([x + Math.cos(a) * s * 0.62, y + th + s * (0.2 + hash2(x + k, z) * 0.35), z + Math.sin(a) * s * 0.62, s * (0.55 + hash2(x, z + k) * 0.15), 0]);
        }
        crowns.push([x, y + th + s * 0.85, z, s * 0.6, 0]);
      }
    }
  };
  for (const s of sites) {
    const tr = rng(Math.floor(s.seed * 1e5) + 11);
    if (s.kind === 'tree') {
      // ケヤキのような大きな一本木
      tree(s.x, s.plane(s.x, s.z), s.z, 4.2 + tr() * 1.4, 0, 2.2 + tr() * 0.8);
      continue;
    }
    if (s.kind === 'grove') {
      // こんもりした木立（ふちは低く、まん中は高く）。杉が混じることも
      const sugi = tr() < 0.35;
      for (let k = 0; k < 400; k++) {
        const a = tr() * Math.PI * 2, d = Math.sqrt(tr()) * s.R;
        const x = s.x + Math.cos(a) * d, z = s.z + Math.sin(a) * d;
        const q = Math.hypot(x - s.x, z - s.z) / Math.max(1, radAt(s, x, z));
        if (q > 0.92 || crowns.some((c) => Math.abs(c[0] - x) < 4.2 && Math.abs(c[2] - z) < 4.2)) continue;
        const big = 1 - q * 0.45;
        const sp = sugi && tr() < 0.6 ? 1 : 0;
        tree(x, s.plane(x, z), z, (sp ? 2.3 + tr() * 0.8 : 3.6 + tr() * 1.6) * big, sp, (sp ? 2.2 : 1.8 + tr() * 1.8) * big);
      }
      continue;
    }
    // 集落・農家: 家の後ろ（北 z-）に屋敷林、まわりに庭木
    for (const h of s.houses) {
      const n = 6 + Math.floor(h.r() * 6);
      for (let k = 0; k < n; k++) {
        const a = Math.PI + (h.r() - 0.5) * 2.6, d = Math.max(h.w, h.d) * 0.5 + 3.5 + h.r() * 7;
        const x = h.x + Math.sin(h.yaw + a) * d, z = h.z + Math.cos(h.yaw + a) * d;
        if (!inside(s, x, z, 4) || nearHouse(x, z, 2.5)) continue;
        const sp = h.r() < 0.4 ? 1 : 0;
        tree(x, s.plane(x, z), z, sp ? 2.2 + h.r() * 0.7 : 3 + h.r() * 1.8, sp, sp ? 2 + h.r() : 1.6 + h.r() * 1.6);
      }
    }
    // 盛り土のふちに点々と
    const m = s.kind === 'hamlet' ? 14 : 5;
    for (let k = 0; k < m; k++) {
      const a = tr() * Math.PI * 2, rr = radAt(s, s.x + Math.cos(a), s.z + Math.sin(a)) - 4.5 - tr() * 3;
      const x = s.x + Math.cos(a) * rr, z = s.z + Math.sin(a) * rr;
      if (rr < 4 || nearHouse(x, z, 3.5)) continue;
      const sp = tr() < 0.25 ? 2 : 0; // ときどき竹やぶ
      tree(x, s.plane(x, z), z, sp ? 2.6 + tr() : 2.8 + tr() * 1.6, sp, sp ? 0 : 1.5 + tr() * 1.4);
    }
  }

  // ---------- 形 ----------
  const group = new THREE.Group();
  group.name = 'hamlets';
  group.add(padMesh(sites, radAt, low, houses));
  const FG = new FarmGeo();
  for (const h of houses) farmhouse(FG, h);
  const hm = new THREE.Mesh(FG.build(), paint(new THREE.MeshLambertMaterial({ vertexColors: true }), { amp: 0.08, scale: 0.8, key: 'farmhouse' }));
  hm.castShadow = true; hm.receiveShadow = true;
  group.add(hm);
  if (trunks.length) {
    const im = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.62, 1, 1, 6).translate(0, 0.5, 0), new THREE.MeshLambertMaterial({ color: '#4f443b' }), trunks.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3();
    trunks.forEach(([x, y, z, hh, w], i) => im.setMatrixAt(i, m4.compose(v.set(x, y, z), q, sc.set(w, hh, w))));
    im.computeBoundingSphere();
    im.castShadow = true;
    group.add(im);
  }
  // 草を生やさない（盛り土の下の地面から草が突き抜けないように）
  for (const s of sites) {
    const R = Math.max(...s.rad) + 2;
    for (let dz = -R; dz <= R; dz += 1) for (let dx = -R; dx <= R; dx += 1) {
      const x = s.x + dx, z = s.z + dz;
      if (!inside(s, x, z, -1.5)) continue;
      const c = mask.cell(x, z);
      if (c >= 0) mask.a[c] |= M.FARMSTEAD;
    }
  }
  const count = (k) => sites.filter((s) => s.kind === k).length;
  group.userData.stats = { hamlets: count('hamlet'), farms: count('farm'), groves: count('grove'), trees: count('tree'), houses: houses.length, crowns: crowns.length, ms: Math.round(performance.now() - t0) };
  group.userData.sites = sites;
  group.userData.crowns = crowns;
  return group;
}

// 盛り土の上の面の高さ: まわり 4m でいちばん高い所（田の面・地面より少し上）を、なだらかにならした面
// 1 枚の平面にすると、低い側のふちが高い土手になってしまうので、地面なりにゆるく傾ける
function padHeight(cx, cz, R, top) {
  const S = 3, n = Math.ceil(R / S) * 2 + 5, x0 = cx - ((n - 1) / 2) * S, z0 = cz - ((n - 1) / 2) * S;
  let a = new Float32Array(n * n);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) a[j * n + i] = top(x0 + i * S, z0 + j * S);
  const pass = (src, f) => {
    const out = new Float32Array(n * n);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      let m = f === 'max' ? -Infinity : 0, c = 0;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        const ii = Math.min(n - 1, Math.max(0, i + di)), jj = Math.min(n - 1, Math.max(0, j + dj)), v = src[jj * n + ii];
        if (f === 'max') m = Math.max(m, v); else { m += v; c++; }
      }
      out[j * n + i] = f === 'max' ? m : m / c;
    }
    return out;
  };
  a = pass(pass(a, 'max'), 'max');
  for (let k = 0; k < 3; k++) a = pass(a, 'avg');
  return (x, z) => {
    const fx = Math.min(n - 1.001, Math.max(0, (x - x0) / S)), fz = Math.min(n - 1.001, Math.max(0, (z - z0) / S));
    const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j, k = j * n + i;
    const h = (a[k] * (1 - u) + a[k + 1] * u) * (1 - v) + (a[k + n] * (1 - u) + a[k + n + 1] * u) * v;
    return Math.max(h, top(x, z));
  };
}

// 盛り土: 上の面（中心から放射状の三角形）＋ ふちから田の面の下までの土手
function padMesh(sites, radAt, low, houses) {
  const P = [], Cc = [];
  const grassA = C('#5b8636'), grassB = C('#7f9c45'), yard = C('#b3a88f'), bank = C('#6a8a3a'), stone = C('#8a8577');
  const colAt = (s, x, z) => {
    const n = fbm2(x * 0.06, z * 0.06);
    const c = grassA.clone().lerp(grassB, n);
    if (s.kind === 'grove') c.multiplyScalar(0.72); // 木の下は暗い
    for (const h of s.houses || []) {
      const d = Math.hypot(h.x - x, h.z - z) - Math.max(h.w, h.d) * 0.5;
      if (d < 7) c.lerp(yard, THREE.MathUtils.smoothstep(7 - d, 0, 5) * 0.85); // 家のまわりの庭（砂利）
    }
    return c;
  };
  const push = (x, y, z, c) => { P.push(x, y, z); Cc.push(c.r, c.g, c.b); };
  for (const s of sites) {
    const RINGS = s.kind === 'tree' ? 2 : 5;
    const dir = (a) => { const th = (a / RAYS) * Math.PI * 2; return [Math.cos(th), Math.sin(th)]; };
    // ふちは法面（上の面の端から田の面まで斜めに下ろす。高いほど幅を取る）
    const slope = s.rad.map((rr, a) => {
      const [dx, dz] = dir(a), x = s.x + dx * rr, z = s.z + dz * rr;
      return Math.min(rr * 0.3, Math.max(0.5, (s.plane(x, z) - low(x, z)) * 1.1));
    });
    const at = (a, k) => {
      const [dx, dz] = dir(a), f = k / RINGS, d = (s.rad[a % RAYS] - slope[a % RAYS]) * f;
      return [s.x + dx * d, s.z + dz * d];
    };
    const foot = (a) => { const [dx, dz] = dir(a); return [s.x + dx * s.rad[a % RAYS], s.z + dz * s.rad[a % RAYS]]; };
    for (let a = 0; a < RAYS; a++) for (let k = 0; k < RINGS; k++) {
      const q = [at(a, k), at(a + 1, k), at(a + 1, k + 1), at(a, k + 1)];
      const v = q.map(([x, z]) => [x, s.plane(x, z), z, colAt(s, x, z)]);
      const tri = (i, j, l) => { for (const t of [v[i], v[j], v[l]]) push(t[0], t[1], t[2], t[3]); };
      if (k === 0) tri(0, 2, 3);
      else { tri(0, 1, 2); tri(0, 2, 3); }
    }
    // ふちの土手（高い所は石垣）
    for (let a = 0; a < RAYS; a++) {
      const [ax, az] = at(a, RINGS), [bx, bz] = at(a + 1, RINGS);
      const [fx, fz] = foot(a), [gx, gz] = foot(a + 1);
      const ay = s.plane(ax, az), by = s.plane(bx, bz);
      const al = low(fx, fz), bl = low(gx, gz);
      const c = Math.max(ay - al, by - bl) > 1.6 ? stone : bank;
      const ct = colAt(s, ax, az).lerp(c, 0.5), cd = c.clone().multiplyScalar(0.8);
      push(ax, ay, az, ct); push(gx, bl, gz, cd); push(fx, al, fz, cd);
      push(ax, ay, az, ct); push(bx, by, bz, ct); push(gx, bl, gz, cd);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(Cc, 3));
  g.computeVertexNormals();
  g.computeBoundingSphere();
  const mesh = new THREE.Mesh(g, paint(new THREE.MeshLambertMaterial({ vertexColors: true }), { amp: 0.12, scale: 0.5, key: 'hamletpad' }));
  mesh.receiveShadow = true;
  mesh.name = 'hamlet-pads';
  return mesh;
}
