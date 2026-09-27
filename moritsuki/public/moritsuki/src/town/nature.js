// 木: 広葉樹・黒松・ヤシ・桜（夏は葉桜）。インスタンスで大量に並べ、区画ごとに視錐台カリング
import * as THREE from 'three';
import { Mesher } from './mesher.js';
import { rng, hash2 } from './data.js';
import { lambert } from './materials.js';
import { M } from './layout.js';
import { CROWN } from './assets/trees2.js';
import { townWeight } from './scenery/plan.js';

const C = (h) => new THREE.Color(h);

// ふんわりした葉の塊: 法線を塊の中心から外向きにして柔らかく見せる
function blob(m, cx, cy, cz, r, col, colDark, detail = 0, squash = 0.85) {
  const g = new THREE.IcosahedronGeometry(1, detail).toNonIndexed();
  const P = g.attributes.position;
  const base = m.count;
  for (let i = 0; i < P.count; i++) {
    const x = P.getX(i), y = P.getY(i), z = P.getZ(i);
    const wob = 1 + (hash2(x * 13 + cx * 5, z * 11 + y * 7) - 0.5) * 0.28;
    const c = col.clone().lerp(colDark, THREE.MathUtils.clamp(0.55 - y * 0.6, 0, 1));
    m.v(cx + x * r * wob, cy + y * r * squash * wob, cz + z * r * wob, x, y * 0.8 + 0.25, z, c);
  }
  for (let i = 0; i < P.count; i++) m.i.push(base + i);
}

function trunk(m, x0, z0, h, r0, r1, col, lean = [0, 0], seg = 5) {
  const g = new THREE.CylinderGeometry(r1, r0, h, seg, 1, true);
  g.translate(0, h / 2, 0);
  const mat = new THREE.Matrix4().makeShear(0, 0, lean[0] / h, lean[1] / h, 0, 0).setPosition(x0, 0, z0);
  m.merge(g, mat, col);
}

export const TREE = {
  broad() {
    const m = new Mesher();
    trunk(m, 0, 0, 3.2, 0.22, 0.14, C('#6b5642'));
    const leaf = C('#5f9440'), dark = C('#2f5a2a');
    blob(m, 0, 3.9, 0, 2.1, leaf, dark, 1);
    blob(m, 1.1, 3.4, 0.5, 1.5, leaf, dark, 1);
    blob(m, -0.9, 3.5, -0.6, 1.6, leaf, dark, 1);
    blob(m, 0.2, 4.9, -0.2, 1.4, leaf.clone().offsetHSL(0.01, 0, 0.05), dark, 1);
    return m.build();
  },
  // 森の縁用（遠くから見るので軽く）
  wild() {
    const m = new Mesher();
    trunk(m, 0, 0, 3.2, 0.22, 0.14, C('#6b5642'));
    const leaf = C('#5a8f3e'), dark = C('#2c5429');
    blob(m, 0, 3.9, 0, 2.2, leaf, dark);
    blob(m, 1.1, 3.3, 0.6, 1.6, leaf, dark);
    blob(m, -1.0, 3.4, -0.5, 1.7, leaf, dark);
    return m.build();
  },
  // 黒松: くねった幹に、平たい葉の段
  pine() {
    const m = new Mesher();
    const bark = C('#5a4a3e');
    trunk(m, 0, 0, 4.2, 0.28, 0.2, bark, [0.9, 0.3], 6);
    const g2 = new THREE.CylinderGeometry(0.14, 0.2, 3.2, 5, 1, true);
    g2.translate(0, 1.6, 0);
    m.merge(g2, new THREE.Matrix4().makeShear(0, 0, -0.35, 0.2, 0, 0).setPosition(0.9, 4.1, 0.3), bark);
    const leaf = C('#3f6b3a'), dark = C('#23402a');
    for (const [x, y, z, r] of [[0.9, 4.6, 0.3, 1.5], [-0.3, 5.6, 0.5, 1.3], [0.2, 7.0, 0.9, 1.35], [1.6, 5.9, -0.4, 1.1], [-0.7, 7.3, 0.2, 0.9], [0.8, 6.4, 1.3, 0.9]]) {
      blob(m, x, y, z, r, leaf, dark, 1, 0.45);
    }
    return m.build();
  },
  palm() {
    const m = new Mesher();
    const bark = C('#8a7458');
    const g = new THREE.CylinderGeometry(0.2, 0.32, 6, 6, 4, true);
    g.translate(0, 3, 0);
    m.merge(g, new THREE.Matrix4().makeShear(0, 0, 0.12, 0, 0, 0), bark);
    const leaf = C('#4f8a3a');
    for (let k = 0; k < 9; k++) {
      const a = (k / 9) * Math.PI * 2, L = 2.6;
      const cx = 0.72, cy = 6.0;
      for (let s = 0; s < 3; s++) {
        const t0 = s / 3, t1 = (s + 1) / 3;
        const P = (t, side) => {
          const r = t * L, y = cy + Math.sin(t * 2.2) * 0.8 - t * t * 1.6;
          const w = Math.sin(Math.PI * Math.min(1, t * 1.1)) * 0.45 * side;
          return [cx + Math.cos(a) * r - Math.sin(a) * w, y, Math.sin(a) * r + Math.cos(a) * w];
        };
        m.face([P(t0, -1), P(t1, -1), P(t1, 1), P(t0, 1)], leaf.clone().offsetHSL(0, 0, -0.06 * s));
      }
    }
    return m.build();
  },
  cherry() {
    const m = new Mesher();
    trunk(m, 0, 0, 2.6, 0.26, 0.16, C('#4f3f38'), [0.3, 0]);
    const leaf = C('#6a9c45'), dark = C('#3a6330');
    blob(m, 0.3, 3.4, 0, 2.3, leaf, dark, 1, 0.7);
    blob(m, -1.4, 3.0, 0.6, 1.5, leaf, dark, 1, 0.7);
    blob(m, 1.8, 3.1, -0.5, 1.5, leaf, dark, 1, 0.7);
    return m.build();
  },
  shrub() {
    const m = new Mesher();
    const leaf = C('#5a8f3e'), dark = C('#2f5a2a');
    blob(m, 0, 0.55, 0, 0.8, leaf, dark, 1, 0.75);
    blob(m, 0.6, 0.45, 0.3, 0.55, leaf, dark, 1, 0.75);
    return m.build();
  },
};

export class Forest {
  constructor() {
    this.list = {}; // type -> [[x,y,z,scale,yaw,tint]]
  }
  add(type, x, y, z, s = 1, yaw = null, tint = null) {
    (this.list[type] ||= []).push([x, y, z, s, yaw ?? hash2(x * 3, z * 5) * 6.28, tint ?? hash2(z * 2, x * 7)]);
  }
  build(chunk = 220) {
    const group = new THREE.Group();
    const mat = lambert({ side: THREE.DoubleSide }, { amp: 0.14, scale: 0.9, key: 'tree' });
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3(), col = new THREE.Color();
    for (const type in this.list) {
      const geo = TREE[type]();
      const cells = new Map();
      for (const t of this.list[type]) {
        const k = Math.floor(t[0] / chunk) + ',' + Math.floor(t[2] / chunk);
        if (!cells.has(k)) cells.set(k, []);
        cells.get(k).push(t);
      }
      for (const items of cells.values()) {
        const im = new THREE.InstancedMesh(geo, mat, items.length);
        items.forEach(([x, y, z, s, yaw, tint], i) => {
          e.set(0, yaw, 0); q.setFromEuler(e);
          sc.set(s * (0.9 + tint * 0.2), s, s * (0.9 + (1 - tint) * 0.2));
          im.setMatrixAt(i, m4.compose(v.set(x, y, z), q, sc));
          im.setColorAt(i, col.setRGB(0.88 + tint * 0.22, 0.9 + tint * 0.18, 0.86 + (1 - tint) * 0.22));
        });
        im.instanceColor.needsUpdate = true;
        im.computeBoundingSphere();
        im.castShadow = true; im.receiveShadow = false;
        group.add(im);
      }
    }
    return group;
  }
}

// 森の縁・町なかに木を置く
export function scatterTrees(ctx, forest, terrainInfo, gardenTrees) {
  const { data, ground } = ctx;
  const { core } = data, { forestDist, canopy } = terrainInfo;
  const r = rng(4242);
  for (let j = 1; j < core.nz - 1; j++) for (let i = 1; i < core.nx - 1; i++) {
    const k = j * core.nx + i, d = forestDist[k];
    if (d < 1 || d > 3 || (i + j) % 2) continue;
    const p = d === 1 ? 0.8 : d === 2 ? 0.4 : 0.15;
    if (r() > p) continue;
    const x = core.xOf(i) + (r() - 0.5) * 4, z = core.zOf(j) + (r() - 0.5) * 4;
    // 一本ずつの木は町並みのまわりだけ（遠くの森は scenery/forest.js の樹冠）
    if (townWeight(x, z) <= 0) continue;
    const y = ground(x, z);
    if (y < 0.5) continue;
    const s = 0.85 + Math.min(canopy[k], 10) * 0.04 + r() * 0.35;
    forest.add(hash2(x, z) > 0.93 ? 'pine' : 'wild', x, y - 0.2, z, s);
  }
  for (const [x, z, s] of gardenTrees) {
    const y = ground(x, z);
    forest.add(hash2(x * 2, z) > 0.7 ? 'pine' : hash2(x, z * 3) > 0.5 ? 'shrub' : 'broad', x, y, z, s * (hash2(z, x) > 0.5 ? 1 : 0.7));
  }
}

// 木の種類を新しい木（trees2.js）に置きかえ、家に埋もれないように決める
// ・幹のまわりに家があれば置かない
// ・樹冠が家に大きくかかるなら小さくする → だめなら細い木・庭木に替える → それでもだめなら置かない
//   （樹冠のふちが少し家にかかるのはよい）
export function fitTree(ctx) {
  const { mask } = ctx;
  const stats = { kept: 0, shrunk: 0, swapped: 0, dropped: 0, same: 0 };
  const bld = (x, z) => (mask.get(x, z) & M.BLD) !== 0;
  const RING = (n) => Array.from({ length: n }, (_, k) => [Math.cos((k / n) * Math.PI * 2), Math.sin((k / n) * Math.PI * 2)]);
  const R8 = RING(8), R16 = RING(16);
  const fits = (kind, x, z, s) => {
    const R = CROWN[kind][0] * s, rt = Math.max(0.9, R * 0.2);
    if (bld(x, z)) return false;
    for (const [c, d] of R8) if (bld(x + c * rt, z + d * rt)) return false;
    let hit = 0;
    for (const [c, d] of R8) if (bld(x + c * R * 0.45, z + d * R * 0.45)) hit += 2;
    for (const [c, d] of R16) if (bld(x + c * R * 0.8, z + d * R * 0.8)) hit++;
    return hit <= 5; // 32 点中（内側は 2 倍に数える）
  };
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  // 旧版の種類 → 候補（先に書いた方から試す）
  const candidates = (kind, x, z, s) => {
    const h = hash2(x * 3.7, z * 5.3);
    const garden = ['b-garden', clamp(s * 1.6, 0.8, 1.2)];
    switch (kind) {
      case 'wild': return [[h < 0.3 ? 'b-sugi' : h < 0.45 ? 'b-keyaki' : 'b-oak', s], ['b-sugi', s]];
      case 'pine': return s < 0.9 ? [garden] : [['b-sugi', s], garden];
      case 'broad': return h < 0.6 ? [garden] : [[h < 0.8 ? 'b-oak' : 'b-keyaki', s * 0.85], garden];
      case 'cherry': return [['b-cherry', s * 0.85], garden];
      default: return kind in CROWN ? [[kind, s], garden] : null; // 新しい木はそのまま調べる。ヤシ・植え込みはそのまま
    }
  };
  const fit = (kind, x, z, s) => {
    const cs = candidates(kind, x, z, s);
    if (!cs) { stats.same++; return [kind, s]; }
    for (let i = 0; i < cs.length; i++) {
      const [k, s0] = cs[i];
      for (const f of [1, 0.85, 0.72, 0.6]) {
        if (!fits(k, x, z, s0 * f)) continue;
        stats[i ? 'swapped' : f < 1 ? 'shrunk' : 'kept']++;
        return [k, s0 * f];
      }
    }
    stats.dropped++;
    return null;
  };
  fit.stats = stats;
  return fit;
}
