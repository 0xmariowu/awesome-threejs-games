// 大きな建物（集合住宅・公共施設・倉庫・駅など）を置く: 位置と向きから行列を作り、当たり判定も登録する
import * as THREE from 'three';
import { obb, polyArea, rng, hash2 } from './data.js';
import { M } from './layout.js';
import { buildBlock } from './assets/house.js';

const C = (h) => new THREE.Color(h);

// desc: { cx, cz, ux, uz（幅の向き）, w, d, ...buildBlock の spec }。正面（ローカル +z）は u × 上
export function placeBlock(ctx, kit, desc, r) {
  const { ground, segs, mask } = ctx;
  const { cx, cz, ux, uz, w, d } = desc;
  const vx = -uz, vz = ux;
  const corners = [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]].map(([a, b]) => [cx + ux * a + vx * b, cz + uz * a + vz * b]);
  let base = -Infinity;
  for (const [x, z] of [...corners, [cx, cz]]) base = Math.max(base, ground(x, z));
  const xA = new THREE.Vector3(ux, 0, uz), yA = new THREE.Vector3(0, 1, 0), zA = new THREE.Vector3().crossVectors(xA, yA);
  const Mx = new THREE.Matrix4().makeBasis(xA, yA, zA).setPosition(cx, base, cz);
  kit.chunk(cx, cz);
  const res = buildBlock(kit, Mx, { fh: 3.0, ...desc }, r || rng(Math.floor(hash2(cx, cz) * 1e9) + 1));
  segs.addPoly(corners, base + res.H);
  mask.fillPoly(corners, M.BLD);
  return { base: base + 0.3, yTop: base + res.H, M: Mx };
}

// OSM の大きな建物
export function osmBlocks(ctx, kit, V) {
  const { mask } = ctx;
  for (const b0 of V.buildings) {
    const k = 1.4;
    const [mx, mz] = b0.p.reduce((a, q) => [a[0] + q[0] / b0.p.length, a[1] + q[1] / b0.p.length], [0, 0]);
    const p = b0.p.map(([x, z]) => [mx + (x - mx) * k, mz + (z - mz) * k]);
    const realArea = Math.abs(polyArea(b0.p)) * 4;
    const tagBig = ['school', 'university', 'public', 'civic', 'townhall', 'warehouse', 'industrial', 'train_station', 'commercial', 'retail'].includes(b0.b);
    if (!(realArea > 380 || tagBig) || b0.a === 'place_of_worship') continue;
    const box = obb(p);
    if (!box || box.w < 4 || mask.anyInRect(box.cx, box.cz, box.ux, box.uz, box.w, box.d, M.ROAD | M.BLD | M.KEEP | M.WATER | M.RAIL)) continue;
    const r = rng(Math.floor(hash2(box.cx * 3.1, box.cz * 1.7) * 1e9) + 7);
    const inHarbor = mask.get(box.cx, box.cz) & M.HARBOR;
    // 正面は道のある側へ
    let ux = box.ux, uz = box.uz;
    const vx = -uz, vz = ux;
    const probe = (s) => { let n = 0; for (let t = 1; t < 8; t++) if (mask.get(box.cx + vx * s * (box.d / 2 + t), box.cz + vz * s * (box.d / 2 + t)) & M.ROAD) n++; return n; };
    if (probe(-1) > probe(1)) { ux = -ux; uz = -uz; }
    const kind = ['warehouse', 'industrial'].includes(b0.b) || inHarbor ? 'warehouse' : b0.b === 'apartments' || (realArea < 700 && r() < 0.5) ? 'apt' : 'inst';
    const desc = { cx: box.cx, cz: box.cz, ux, uz, w: box.w, d: box.d, kind };
    if (kind === 'warehouse') Object.assign(desc, { floors: 1, fh: realArea > 300 ? 6 : 4, wallCol: [C('#c9ccce'), C('#b7bec4'), C('#d3d0c6'), C('#9fb0b8')][Math.floor(r() * 4)], roofCol: C('#9aa3aa') });
    else if (kind === 'apt') Object.assign(desc, { floors: b0.lv || 2 + Math.floor(r() * 2), fh: 2.9, wall: r() < 0.5 ? 'siding' : 'mortar', wallCol: [C('#f0eee8'), C('#e9e4da'), C('#dcd8d0'), C('#e8dcc8')][Math.floor(r() * 4)], balcony: true, corridor: true });
    else Object.assign(desc, { floors: b0.lv || (realArea > 900 ? 3 : 2), fh: 3.4, wall: 'mortar', wallCol: [C('#f1f1ee'), C('#e8e6e0'), C('#eae7de')][Math.floor(r() * 3)] });
    placeBlock(ctx, kit, desc, r);
  }
}
