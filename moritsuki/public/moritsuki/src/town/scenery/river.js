// 川の土手と並木: 町並みの外の川に、上が平らな土手を盛り、片側の土手に並木を植える
// ・並木は夏の葉桜。ところどころ百日紅（サルスベリ）の桃色の花
// ・遠くからも見えるように、幹 + 樹冠の塊のインスタンスで描く
import * as THREE from 'three';
import { M } from '../layout.js';
import { polylineDist, hash2 } from '../data.js';
import { resample } from '../mesher.js';
import { inTown } from './plan.js';
import { paint } from '../materials.js';

const REACH = 5.5;       // 土手の外側のすそ（川の中心から m）。田んぼがすぐそばまで来るように細い土手
const CREST = [3.3, 4.4]; // 土手の上の平らな所（並木が立つ）
const H = 0.9;           // 土手の高さ

// 土手の断面（川の中心からの距離 → 盛る高さ）
function profile(d) {
  if (d < 3) return 0;
  if (d < CREST[0]) return H * THREE.MathUtils.smoothstep(d, 3, CREST[0]);
  if (d <= CREST[1]) return H;
  return H * (1 - THREE.MathUtils.smoothstep(d, CREST[1], REACH));
}

// 地形の高さを書きかえる（carveWater のあと、道・地形のメッシュを作る前に呼ぶ）
export function buildLevees(data, mask, water) {
  const { core, V } = data;
  const rivers = V.streams.filter((s) => s.k === 'river' && s.p.length > 1);
  const raised = new Float32Array(core.h.length);
  const nearRoad = (x, z) => {
    for (const [dx, dz] of [[0, 0], [5, 0], [-5, 0], [0, 5], [0, -5], [4, 4], [-4, -4], [4, -4], [-4, 4]]) if (mask.get(x + dx, z + dz) & (M.ROAD | M.BLD)) return true;
    return false;
  };
  for (const rv of rivers) {
    const xs = rv.p.map((q) => q[0]), zs = rv.p.map((q) => q[1]);
    const i0 = Math.max(0, Math.floor((Math.min(...xs) - REACH - core.x0) / core.step)), i1 = Math.min(core.nx - 1, Math.ceil((Math.max(...xs) + REACH - core.x0) / core.step));
    const j0 = Math.max(0, Math.floor((Math.min(...zs) - REACH - core.z0) / core.step)), j1 = Math.min(core.nz - 1, Math.ceil((Math.max(...zs) + REACH - core.z0) / core.step));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const c = j * core.nx + i;
      if (water.kindAt[c]) continue;
      const x = core.xOf(i), z = core.zOf(j);
      if (inTown(x, z, 25)) continue;
      const d = polylineDist(x, z, rv.p);
      if (d > REACH) continue;
      if (nearRoad(x, z)) continue;
      raised[c] = Math.max(raised[c], profile(d));
    }
  }
  // 端（町並み・道の手前）はなだらかに落とす
  const src = raised.slice();
  for (let j = 1; j < core.nz - 1; j++) for (let i = 1; i < core.nx - 1; i++) {
    const c = j * core.nx + i;
    if (!src[c]) continue;
    let s = 0;
    for (const q of [c, c - 1, c + 1, c - core.nx, c + core.nx]) s += src[q];
    raised[c] = Math.min(src[c], s / 5 + 0.15);
  }
  for (let c = 0; c < raised.length; c++) if (raised[c] > 0.05) core.h[c] += raised[c];
  // 土手のマスク（田んぼを置かない・草地にする）
  for (let j = 0; j < mask.nz; j++) for (let i = 0; i < mask.nx; i++) {
    const x = mask.x0 + i + 0.5, z = mask.z0 + j + 0.5;
    const ci = Math.round((x - core.x0) / core.step), cj = Math.round((z - core.z0) / core.step);
    if (ci < 0 || cj < 0 || ci >= core.nx || cj >= core.nz) continue;
    if (raised[cj * core.nx + ci] > 0.05) mask.a[j * mask.nx + i] |= M.LEVEE;
  }
  return { rivers, raised };
}

// ---------- 並木 ----------
export function crownGeo(detail = 2) {
  const g = new THREE.IcosahedronGeometry(1, detail);
  const p = g.attributes.position, col = [];
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).normalize();
    const lump = 1 + Math.sin(v.x * 5.1 + v.z * 3.3) * 0.07 + Math.sin(v.y * 6.2 + v.x * 2.1) * 0.06;
    let y = v.y * 0.72;
    if (y < -0.2) y = -0.2 + (y + 0.2) * 0.4;
    p.setXYZ(i, v.x * lump * 1.15, y * lump, v.z * lump * 1.15);
    const ao = 0.5 + 0.5 * THREE.MathUtils.smoothstep(v.y, -0.6, 0.8);
    col.push(ao, ao, ao);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  const n = g.attributes.normal, a = new THREE.Vector3(), b = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    a.fromBufferAttribute(n, i); b.fromBufferAttribute(p, i).normalize();
    a.lerp(b, 0.5).normalize(); n.setXYZ(i, a.x, a.y, a.z);
  }
  return g;
}

export function buildRowTrees(ctx, levees) {
  const { ground, mask } = ctx;
  const spots = [];
  for (const rv of levees.rivers) {
    const pts = resample(rv.p, 1);
    // 並木は片側（川の流れに向かって左）の土手の上。ところどころ両側
    for (let t = 6; t < pts.length - 6; t += 8.5) {
      const q = pts[Math.floor(t)];
      for (const side of [1, -1]) {
        if (side < 0 && hash2(q.x * 0.013, q.z * 0.017) < 0.62) continue;
        const d = (CREST[0] + CREST[1]) / 2 + (hash2(q.x, q.z) - 0.5) * 0.8;
        const x = q.x + q.nx * side * d, z = q.z + q.nz * side * d;
        if (!(mask.get(x, z) & M.LEVEE) || (mask.get(x, z) & (M.ROAD | M.WATER))) continue;
        if (spots.some((s) => Math.abs(s[0] - x) < 5 && Math.abs(s[2] - z) < 5)) continue;
        spots.push([x, ground(x, z), z]);
      }
    }
  }
  const group = new THREE.Group();
  group.name = 'row-trees';
  if (!spots.length) return group;
  const trunkGeo = new THREE.CylinderGeometry(0.16, 0.26, 1, 6, 1);
  trunkGeo.translate(0, 0.5, 0);
  const trunks = new THREE.InstancedMesh(trunkGeo, paint(new THREE.MeshLambertMaterial({ color: '#5e5048' }), { amp: 0.1, scale: 2, key: 'rowtrunk' }), spots.length);
  const crowns = new THREE.InstancedMesh(crownGeo(), paint(new THREE.MeshLambertMaterial({ vertexColors: true }), {
    amp: 0, scale: 1, key: 'rowcrown',
    frag: /* glsl */ `
      {
        float dist = length(cameraPosition - vWP);
        float leaf = tnF(vWP.xz * 1.1 + vWP.y * 0.9);
        diffuseColor.rgb *= 1.0 + (leaf - 0.5) * 0.55 * (1.0 - smoothstep(150.0, 600.0, dist));
      }`,
    after: (sh) => {
      sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        {
          vec3 q = vWP * 1.1;
          vec3 nn = vec3(tnV(q.xz + q.y), tnV(q.zy + 5.1), tnV(q.xy + 9.7)) - 0.5;
          float fade = 1.0 - smoothstep(100.0, 500.0, length(cameraPosition - vWP));
          normal = normalize(normal + (viewMatrix * vec4(nn * 1.6, 0.0)).xyz * fade);
        }`);
    },
  }), spots.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3();
  const green = [new THREE.Color(0.08, 0.2, 0.04), new THREE.Color(0.11, 0.24, 0.05), new THREE.Color(0.07, 0.17, 0.045)];
  const pink = [new THREE.Color(0.5, 0.15, 0.3), new THREE.Color(0.58, 0.2, 0.36)];
  spots.forEach(([x, y, z], i) => {
    const h = hash2(x * 0.31, z * 0.29), s = 3.6 + h * 1.4;
    const crape = hash2(x * 0.071, z * 0.053) > 0.84; // 百日紅
    const th = crape ? 2.0 : 2.6 + h * 0.6;
    trunks.setMatrixAt(i, m4.compose(v.set(x, y - 0.2, z), q.identity(), sc.set(1, th + s * 0.3, 1)));
    e.set(0, h * 6.28, 0); q.setFromEuler(e);
    const cs = crape ? s * 0.72 : s;
    crowns.setMatrixAt(i, m4.compose(v.set(x, y + th + cs * 0.35, z), q, sc.set(cs, cs, cs)));
    crowns.setColorAt(i, (crape ? pink : green)[Math.floor(h * 7) % (crape ? 2 : 3)]);
  });
  crowns.instanceColor.needsUpdate = true;
  for (const im of [trunks, crowns]) { im.computeBoundingSphere(); im.castShadow = true; im.receiveShadow = true; group.add(im); }
  group.userData.count = spots.length;
  return group;
}
