// 田園の集落: 山すそ・大きな道ぞいに、農家が何軒かずつ固まって建つ（遠く・空から見る軽い形）
// ・母屋（寄棟の瓦屋根 or トタン屋根）・納屋（切妻のトタン）・ときどきビニールハウス・屋敷林
// ・場所は田んぼより先に決めて、田んぼを置かないようにする（planFarms → buildPaddies → buildFarms）
import * as THREE from 'three';
import { M } from '../layout.js';
import { rng, hash2, polylineDist } from '../data.js';
import { paint } from '../materials.js';
import { landKind } from './landscape.js';
import { inTown } from './plan.js';
import { crownGeo } from './river.js';

const REACH = 1450;
const SPACING = 170;   // 集落どうしの間
const C = (h) => new THREE.Color(h);
const ROOF_KAWARA = [C('#3d4550'), C('#4a525c'), C('#353c46'), C('#565a60')];
const ROOF_TIN = [C('#8a3a2e'), C('#35506e'), C('#3f6b58'), C('#7a4a3a'), C('#6b6f73')];
const WALL = [C('#efe9dc'), C('#e6dfcf'), C('#d9d2c2'), C('#f3f0e8'), C('#9a7e5f'), C('#8a7056')];

// ---------- 場所を決める ----------
export function planFarms(ctx) {
  const { data, mask, ground } = ctx;
  const { core, outer, V } = data;
  const r = rng(5150);
  const slopeAt = (x, z) => Math.hypot(ground(x + 6, z) - ground(x - 6, z), ground(x, z + 6) - ground(x, z - 6)) / 12;
  const kindAt = (x, z) => landKind(ground(x, z), slopeAt(x, z));
  const bad = (x, z) => {
    if (core.inside(x, z, 2)) return (mask.get(x, z) & (M.ROAD | M.WATER | M.BLD | M.LEVEE | M.TOWN | M.HARBOR | M.BEACH | M.WOOD)) !== 0;
    return !outer.inside(x, z, 30);
  };
  const mainRoads = V.roads.filter((rd) => rd.k === 'trunk' || rd.k === 'tertiary').map((rd) => rd.p);
  const cands = [];
  for (let z = -REACH; z < REACH; z += 28) for (let x = -REACH; x < REACH; x += 28) {
    const px = x + (r() - 0.5) * 20, pz = z + (r() - 0.5) * 20;
    if (px * px + pz * pz > REACH * REACH || inTown(px, pz, 90) || bad(px, pz)) continue;
    const h = ground(px, pz);
    if (h < 1.2 || h > 30 || slopeAt(px, pz) > 0.07 || kindAt(px, pz) !== 'paddy') continue;
    // 山すそ: 30〜50m 先に森がある
    let forest = 0;
    for (let a = 0; a < 8; a++) {
      const ang = (a / 8) * Math.PI * 2;
      if (kindAt(px + Math.cos(ang) * 40, pz + Math.sin(ang) * 40) === 'forest') forest++;
    }
    const road = core.inside(px, pz) && mainRoads.some((p) => polylineDist(px, pz, p) < 30);
    if (!(forest >= 1 && forest <= 5) && !road) continue;
    cands.push({ x: px, z: pz, score: r() + (forest ? 0.6 : 0) + (road ? 0.3 : 0), forest: forest > 0 });
  }
  cands.sort((a, b) => b.score - a.score);
  const sites = [];
  for (const c of cands) {
    if (sites.some((s) => Math.hypot(s.x - c.x, s.z - c.z) < SPACING)) continue;
    sites.push(c);
  }
  // 集落の中の家（1 軒ずつ置き場所を探す）
  const houses = [];
  for (const s of sites) {
    const n = s.forest ? 3 + Math.floor(r() * 4) : 1 + Math.floor(r() * 3);
    // 家の向き: 下り坂の方（山を背に）
    const gx = ground(s.x + 30, s.z) - ground(s.x - 30, s.z), gz = ground(s.x, s.z + 30) - ground(s.x, s.z - 30);
    const face = Math.hypot(gx, gz) > 0.3 ? Math.atan2(-gx, -gz) : Math.atan2(0, 1) + (r() - 0.5);
    let placed = 0;
    for (let t = 0; t < 40 && placed < n; t++) {
      const a = r() * Math.PI * 2, d = placed ? 12 + r() * 26 : 0;
      const x = s.x + Math.cos(a) * d, z = s.z + Math.sin(a) * d;
      if (houses.some((q) => Math.hypot(q.x - x, q.z - z) < 17) || bad(x, z)) continue;
      const w = 10 + r() * 4, dd = 7 + r() * 2.5;
      const yaw = face + (r() - 0.5) * 0.35 + (r() < 0.25 ? Math.PI / 2 : 0);
      // 敷地の四隅が平ら
      const cs = Math.cos(yaw), sn = Math.sin(yaw);
      let hmin = Infinity, hmax = -Infinity, ok = true;
      for (const [aa, bb] of [[-w / 2 - 6, -dd / 2 - 8], [w / 2 + 6, -dd / 2 - 8], [w / 2 + 6, dd / 2 + 6], [-w / 2 - 6, dd / 2 + 6]]) {
        const qx = x + aa * cs + bb * sn, qz = z - aa * sn + bb * cs;
        if (bad(qx, qz)) { ok = false; break; }
        const y = ground(qx, qz);
        hmin = Math.min(hmin, y); hmax = Math.max(hmax, y);
      }
      if (!ok || hmax - hmin > 1.6) continue;
      houses.push({ x, z, yaw, w, d: dd, y: hmax, r: rng(Math.floor(hash2(x, z) * 1e9) + 3), site: s });
      placed++;
    }
  }
  // 田んぼを置かない所（家と庭）
  const reserved = houses.map((h) => [h.x, h.z, Math.max(h.w, h.d) * 0.5 + 11]);
  for (const [x, z, rad] of reserved) {
    for (let dz = -rad; dz <= rad; dz += 1) for (let dx = -rad; dx <= rad; dx += 1) {
      if (dx * dx + dz * dz > rad * rad) continue;
      const c = mask.cell(x + dx, z + dz);
      if (c >= 0) mask.a[c] |= M.FARMSTEAD;
    }
  }
  return { sites, houses, reserved };
}

// ---------- 形 ----------
export class FarmGeo {
  constructor() { this.p = []; this.n = []; this.c = []; }
  tri(a, b, c, col) {
    const ab = new THREE.Vector3().subVectors(b, a), ac = new THREE.Vector3().subVectors(c, a);
    const n = ab.cross(ac).normalize();
    for (const v of [a, b, c]) { this.p.push(v.x, v.y, v.z); this.n.push(n.x, n.y, n.z); this.c.push(col.r, col.g, col.b); }
  }
  quad(a, b, c, d, col) { this.tri(a, b, c, col); this.tri(a, c, d, col); }
  // 箱（下の中心が原点のローカル → 行列）
  box(Mx, w, h, d, col, y0 = 0) {
    const V = (x, y, z) => new THREE.Vector3(x, y, z).applyMatrix4(Mx);
    const x0 = -w / 2, x1 = w / 2, z0 = -d / 2, z1 = d / 2, y1 = y0 + h;
    const p = [V(x0, y0, z1), V(x1, y0, z1), V(x1, y1, z1), V(x0, y1, z1), V(x0, y0, z0), V(x1, y0, z0), V(x1, y1, z0), V(x0, y1, z0)];
    this.quad(p[0], p[1], p[2], p[3], col); // 前 +z
    this.quad(p[5], p[4], p[7], p[6], col); // 後
    this.quad(p[4], p[0], p[3], p[7], col); // 左
    this.quad(p[1], p[5], p[6], p[2], col); // 右
  }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.computeBoundingSphere();
    return g;
  }
}

// 寄棟の屋根（軒の高さ e、四方に o 出す）
function hipRoof(G, Mx, w, d, e, rise, o, col) {
  const V = (x, y, z) => new THREE.Vector3(x, y, z).applyMatrix4(Mx);
  const W = w / 2 + o, D = d / 2 + o, R = Math.max(0.3, W - D);
  const a = V(-W, e, D), b = V(W, e, D), c = V(W, e, -D), dd = V(-W, e, -D);
  const r0 = V(-R, e + rise, 0), r1 = V(R, e + rise, 0);
  G.quad(a, b, r1, r0, col);        // 前
  G.quad(c, dd, r0, r1, col);       // 後
  G.tri(dd, a, r0, col.clone().multiplyScalar(0.92));  // 妻側
  G.tri(b, c, r1, col.clone().multiplyScalar(0.92));
  // 軒の裏（下から見たときの厚み）
  const k = col.clone().multiplyScalar(0.45);
  G.quad(V(-W, e - 0.25, D), V(W, e - 0.25, D), b, a, k);
  G.quad(V(W, e - 0.25, -D), V(-W, e - 0.25, -D), dd, c, k);
}

// 切妻の屋根（棟は x 方向）
function gableRoof(G, Mx, w, d, e, rise, o, col) {
  const V = (x, y, z) => new THREE.Vector3(x, y, z).applyMatrix4(Mx);
  const W = w / 2 + o, D = d / 2 + o;
  const a = V(-W, e, D), b = V(W, e, D), c = V(W, e, -D), dd = V(-W, e, -D), r0 = V(-W, e + rise, 0), r1 = V(W, e + rise, 0);
  G.quad(a, b, r1, r0, col);
  G.quad(c, dd, r0, r1, col);
  const wall = col.clone().lerp(C('#cfc8b8'), 0.5);
  G.tri(V(-w / 2, e, d / 2), V(-w / 2, e + rise * (d / 2) / D, 0), V(-w / 2, e, -d / 2), wall);
  G.tri(V(w / 2, e, -d / 2), V(w / 2, e + rise * (d / 2) / D, 0), V(w / 2, e, d / 2), wall);
}

export function farmhouse(G, h) {
  const { r } = h;
  const Mx = new THREE.Matrix4().makeRotationY(h.yaw).setPosition(h.x, h.y - 0.3, h.z);
  const tin = r() < 0.35;
  const wall = WALL[Math.floor(r() * WALL.length)];
  const roof = (tin ? ROOF_TIN : ROOF_KAWARA)[Math.floor(r() * (tin ? ROOF_TIN.length : ROOF_KAWARA.length))];
  const e = 3.2 + (r() < 0.35 ? 2.6 : 0); // 2 階建てのこともある
  // 土台・壁・腰壁
  G.box(Mx, h.w + 0.3, 1.6, h.d + 0.3, C('#8e8a80'), -1); // 少し傾いた地面でも浮かないように下までのばす
  G.box(Mx, h.w, e, h.d, wall, 0.5);
  G.box(Mx, h.w + 0.04, 0.9, h.d + 0.04, wall.clone().multiplyScalar(0.62), 0.5);
  // 正面の窓・縁側の帯（暗いガラス・障子）
  const win = C('#2c3238'), shoji = C('#e8e2d0');
  const band = (y, hh, col, frac) => {
    const V = (x, yy, z) => new THREE.Vector3(x, yy, z).applyMatrix4(Mx);
    const x0 = -h.w * frac / 2, x1 = h.w * frac / 2, z = h.d / 2 + 0.03;
    G.quad(V(x0, y, z), V(x1, y, z), V(x1, y + hh, z), V(x0, y + hh, z), col);
    const zb = -h.d / 2 - 0.03;
    G.quad(V(x1 * 0.6, y, zb), V(x0 * 0.6, y, zb), V(x0 * 0.6, y + hh, zb), V(x1 * 0.6, y + hh, zb), col);
  };
  band(1.3, 1.5, r() < 0.5 ? win : shoji.clone().lerp(win, 0.3), 0.72);
  if (e > 4) band(4.1, 1.1, win, 0.5);
  hipRoof(G, Mx, h.w, h.d, e + 0.5, h.d * 0.36, 0.75, roof);
  // 納屋（横か後ろ）
  if (r() < 0.8) {
    const side = r() < 0.5 ? 1 : -1;
    const bw = 5.5 + r() * 3, bd = 5 + r() * 2;
    const Mb = Mx.clone().multiply(new THREE.Matrix4().makeRotationY(r() < 0.5 ? Math.PI / 2 : 0).setPosition(side * (h.w / 2 + bw / 2 + 2.5), 0, -h.d / 2 - 1 + r() * 3));
    const bc = r() < 0.5 ? C('#8a8a86') : C('#6e5a48');
    G.box(Mb, bw, 3.2, bd, bc, 0.3);
    gableRoof(G, Mb, bw, bd, 3.5, 1.3, 0.4, ROOF_TIN[Math.floor(r() * ROOF_TIN.length)].clone().multiplyScalar(0.9));
  }
  // ビニールハウス（家の前の方に）
  if (r() < 0.3) {
    const Mg = Mx.clone().multiply(new THREE.Matrix4().makeRotationY(Math.PI / 2).setPosition((r() - 0.5) * h.w, 0, h.d / 2 + 12));
    const L = 14 + r() * 8, R = 2.6, seg = 7;
    const V = (x, y, z) => new THREE.Vector3(x, y, z).applyMatrix4(Mg);
    const col = C('#e9eef0');
    for (let k = 0; k < seg; k++) {
      const a0 = (k / seg) * Math.PI, a1 = ((k + 1) / seg) * Math.PI;
      const p = (a, x) => V(x, Math.sin(a) * R * 1.05, Math.cos(a) * R);
      G.quad(p(a0, -L / 2), p(a0, L / 2), p(a1, L / 2), p(a1, -L / 2), col);
    }
  }
}

export function buildFarms(ctx, plan) {
  const G = new FarmGeo();
  for (const h of plan.houses) farmhouse(G, h);
  const group = new THREE.Group();
  group.name = 'farms';
  const mesh = new THREE.Mesh(G.build(), paint(new THREE.MeshLambertMaterial({ vertexColors: true }), { amp: 0.08, scale: 0.8, key: 'farmhouse' }));
  mesh.castShadow = true; mesh.receiveShadow = true;
  group.add(mesh);
  // 屋敷林（家の後ろ）と庭木
  const { ground } = ctx;
  const trees = [];
  for (const h of plan.houses) {
    const n = 2 + Math.floor(h.r() * 4);
    for (let k = 0; k < n; k++) {
      const a = h.yaw + Math.PI + (h.r() - 0.5) * 2.2, d = Math.max(h.w, h.d) * 0.5 + 4 + h.r() * 5;
      const x = h.x + Math.sin(a) * d, z = h.z + Math.cos(a) * d;
      trees.push([x, ground(x, z), z, 2.8 + h.r() * 2.2, h.r()]);
    }
  }
  if (trees.length) {
    const im = new THREE.InstancedMesh(crownGeo(1), paint(new THREE.MeshLambertMaterial({ vertexColors: true }), { amp: 0.2, scale: 1.2, key: 'farmtree' }), trees.length);
    const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.15, 0.24, 1, 5).translate(0, 0.5, 0), new THREE.MeshLambertMaterial({ color: '#5a4c42' }), trees.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3();
    const greens = [new THREE.Color(0.06, 0.16, 0.035), new THREE.Color(0.09, 0.2, 0.04), new THREE.Color(0.12, 0.24, 0.05)];
    trees.forEach(([x, y, z, s, t], i) => {
      const th = 1.8 + t * 1.5;
      trunk.setMatrixAt(i, m4.compose(v.set(x, y - 0.2, z), q.identity(), sc.set(1, th + s * 0.3, 1)));
      im.setMatrixAt(i, m4.compose(v.set(x, y + th + s * 0.4, z), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), t * 6.28), sc.set(s, s * 1.1, s)));
      im.setColorAt(i, greens[Math.floor(t * 3) % 3]);
    });
    im.instanceColor.needsUpdate = true;
    for (const m of [im, trunk]) { m.computeBoundingSphere(); m.castShadow = true; m.receiveShadow = true; group.add(m); }
  }
  group.userData.stats = { villages: plan.sites.length, houses: plan.houses.length, trees: trees.length };
  return group;
}
