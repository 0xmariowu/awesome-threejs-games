// E6: 桜ヶ丘稲荷神社 — a tiny neighbourhood Inari shrine on a raised gravel terrace.
// Lot frame: origin at the frontage centre, +Z faces the main street, lot = x∈[-4.25,4.25], z∈[-14,0].
// Local +x of this lot points south (world +z). SPOTS.shrineSakura (lot -2.5,-6.5) is left clear.
import * as THREE from 'three';
import { mergeAll, xf, backSide, waveSheet, bentBox, emaGeo, DEG } from './common.js';
import { makeShrineTextures, EMA } from './shrinetex.js';
import { fireBox } from './scatter.js';
import { shrubGeometry, flowerGeometry, foliageMaterial } from '../lib/foliage.js';

export function buildShrine(ctx, H) {
  const { L, mat, physics } = ctx;
  const lot = L.lotById('E6'); if (!lot) return;
  const f = L.lotFrame(lot);
  const tx = makeShrineTextures(ctx);
  const G = ctx.geo.G;
  const root = H.place(f.x, 0, f.z, f.rotY);
  const K = ctx.kit(root);
  const W = (lx, lz) => L.lotToWorld(lot, lx, lz);
  const gy = (lx, lz) => { const p = W(lx, lz); return L.heightAt(p.x, p.z); };
  const cBox = (lx, lz, w, d, lrot, y0, y1) => { const p = W(lx, lz); physics.addBox(p.x, p.z, w, d, f.rotY + lrot, y0, y1); };
  const cCyl = (lx, lz, r, y0, y1) => { const p = W(lx, lz); physics.addCylinder(p.x, p.z, r, y0, y1); };
  const cWalk = (lx, lz, w, d, lrot, top) => { const p = W(lx, lz); physics.addWalkBox(p.x, p.z, w, d, f.rotY + lrot, top); };
  const sub = (lx, y, lz, rot = 0) => { const g = new THREE.Group(); g.position.set(lx, y, lz); g.rotation.y = rot; root.add(g); return g; };
  const rnd = ctx.rng('props.shrine');

  // ---------------------------------------------------------------- materials
  const M = {
    wall: mat.toon('#ffffff', { map: tx.stoneWall, paint: 0.05 }),
    stone: mat.toon('#ffffff', { map: tx.stone, paint: 0.06 }),
    coping: mat.toon('#dedad2', { map: tx.stone, paint: 0.05 }),
    slabA: mat.toon('#ece9e2', { map: tx.stone, paint: 0.05 }),
    slabB: mat.toon('#dcd8cf', { map: tx.stone, paint: 0.05 }),
    slabC: mat.toon('#d2cdc3', { map: tx.stone, paint: 0.05 }),
    statue: mat.toon('#ecebe5', { map: tx.stone, paint: 0.05 }),
    gravel: mat.toon('#ffffff', { map: tx.gravel, paint: 0.04 }),
    verm: mat.toon('#e2623f', { paint: 0.035 }),
    black: mat.toon('#453d4b', { paint: 0.02 }),
    wood: mat.toon('#ffffff', { map: tx.wood, paint: 0.04 }),
    woodDark: mat.toon('#7e5f45', { paint: 0.05 }),
    woodMid: mat.toon('#9c7a58', { paint: 0.05 }),
    copper: mat.toon('#8bb6a4', { paint: 0.05 }),
    copperDark: mat.toon('#6f9a8a', { paint: 0.04 }),
    slate: mat.toon('#667083', { paint: 0.05 }),
    red: mat.toon('#d9503f', { side: 'double', paint: 0.03 }),
    redKnit: mat.toon('#c9463d', { paint: 0.06 }),
    shide: mat.toon('#f6f3ec', { side: 'double', paint: 0.01 }),
    gold: mat.toon('#dcbb66', { paint: 0.02 }),
    rope: mat.toon('#ffffff', { map: tx.rope, paint: 0.02 }),
    bellRope: mat.toon('#e0a090', { map: tx.rope, paint: 0.02 }),
    ink: mat.toon('#3a3346', { paint: 0 }),
    porcelain: mat.toon('#f1efe9', { paint: 0.01 }),
    bamboo: mat.toon('#c9bb86', { paint: 0.04 }),
    bambooDark: mat.toon('#a8996a', { paint: 0.04 }),
    water: mat.toon('#ffffff', { map: tx.water, paint: 0.01 }),
    stream: mat.emissive('#e3f3f8', 0.95),
    leafDark: mat.toon('#4c7a52', { paint: 0.08 }),
    leafMid: mat.toon('#5f8e5b', { paint: 0.08 }),
    leafLight: mat.toon('#80aa68', { paint: 0.08 }),
    camellia: mat.toon('#d9434f', { paint: 0.03 }),
    trunk: mat.toon('#6b5546', { paint: 0.07 }),
    ema: mat.toon('#ffffff', { map: tx.ema, paint: 0.02 }),
    cord: mat.toon('#c9453d', { paint: 0 }),
    notice: mat.toon('#ffffff', { map: tx.notice, paint: 0.02 }),
    noticeHead: mat.toon('#ffffff', { map: tx.noticeHead, paint: 0.02 }),
    roofTin: mat.toon('#5f6670', { paint: 0.04 }),
    moss: mat.decal('#ffffff', { map: mossTex(ctx), transparent: true }),
  };
  const tiledBox = (w, h, d, tu, tv = tu) => {
    const g = new THREE.BoxGeometry(w, h, d);
    const n = g.attributes.normal, uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) {
      const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i));
      const su = ax > 0.5 ? d : w, sv = ay > 0.5 ? d : h;
      uv.setXY(i, uv.getX(i) * su / tu, uv.getY(i) * sv / tv);
    }
    return g;
  };
  const ell = (k, m, pos, size, rot) => k.mesh(G.sphere(14), m, pos, rot, size);

  // ---------------------------------------------------------------- terrace, steps, gravel
  const TY = f.y + 0.30;
  let gMin = Infinity; for (const lx of [-4.25, 4.25]) for (const lz of [0, -14]) gMin = Math.min(gMin, gy(lx, lz));
  const tb = gMin - 0.15, tt = TY - 0.03;
  K.mesh(tiledBox(8.4, tt - tb, 13.35, 2.0, 1.0), M.wall, [0, (tt + tb) / 2, -7.275]);
  // coping stones (笠石) on the retaining wall
  const cop = (cx, cz, w, d) => K.mesh(tiledBox(w, 0.1, d, 0.8), M.coping, [cx, TY - 0.015, cz]);
  cop((-4.2 - 0.75) / 2, -0.76, 4.2 - 0.75, 0.32);
  cop((1.55 + 4.2) / 2, -0.76, 4.2 - 1.55, 0.32);
  cop(-4.04, -7.275, 0.32, 12.71); cop(4.04, -7.275, 0.32, 12.71);
  cop(0, -13.79, 8.4, 0.32);
  // gravel
  { const pg = new THREE.PlaneGeometry(7.76, 12.71); const uv = pg.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 7.76 / 1.6, uv.getY(i) * 12.71 / 1.6);
    const m = K.mesh(pg, M.gravel, [0, TY, -7.275], [-Math.PI / 2, 0, 0]); m.castShadow = false; }
  // front steps (2 steps + terrace), cheek stones
  const yS = gy(0.4, -0.05), rise = (TY + 0.03 - yS) / 3;
  K.mesh(tiledBox(2.3, rise + 0.14, 0.58, 0.8), M.coping, [0.4, yS - 0.14 + (rise + 0.14) / 2, -0.31]);
  K.mesh(tiledBox(2.3, rise + 0.02, 0.29, 0.8), M.coping, [0.4, yS + rise - 0.02 + (rise + 0.02) / 2, -0.455]);
  for (const s of [-1, 1]) { const x = 0.4 + s * 1.23; const h = TY + 0.08 - (yS - 0.12); K.mesh(tiledBox(0.16, h, 0.62, 0.8), M.coping, [x, yS - 0.12 + h / 2, -0.3]); }
  cWalk(0.4, -0.175, 2.3, 0.29, 0, yS + rise);
  cWalk(0.4, -0.455, 2.3, 0.29, 0, yS + 2 * rise);
  cWalk(0, -7.275, 8.4, 13.35, 0, TY + 0.03);
  for (const s of [-1, 1]) cBox(0.4 + s * 1.23, -0.3, 0.16, 0.62, 0, tb, TY + 0.08);

  // ---------------------------------------------------------------- stone path (参道) + apron + stepping stones
  const slabMats = [M.slabA, M.slabB, M.slabC];
  let z = -0.6;
  const slab = (cx, cz, w, d) => {
    const m = K.mesh(tiledBox(w, 0.05, d, 0.9), slabMats[(rnd() * 3) | 0], [cx, TY + 0.005 + rnd() * 0.006, cz], [(rnd() - 0.5) * 0.008, (rnd() - 0.5) * 0.02, (rnd() - 0.5) * 0.008]);
    m.castShadow = false;
  };
  slab(0.4, -0.86, 2.28, 0.5); z = -1.14;
  while (z > -11.0) {
    const d = 0.46 + rnd() * 0.08;
    if (rnd() < 0.35) { slab(0.4 - 0.28, z - d / 2, 0.54, d); slab(0.4 + 0.28, z - d / 2, 0.54, d); }
    else slab(0.4 + (rnd() - 0.5) * 0.04, z - d / 2, 1.1, d);
    z -= d + 0.035;
  }
  for (let i = 0; i < 3; i++) slab(-0.08 + i * 0.64, -11.45, 0.6, 0.62);
  const step = (lx, lz, r) => { const m = K.cyl(r, r * 1.06, 0.034, slabMats[(rnd() * 3) | 0], [lx, TY + 0.006, lz], [0, rnd() * 3, 0], 10); m.scale.z *= 0.8; m.castShadow = false; };
  [[-0.5, -9.25, 0.2], [-1.1, -9.45, 0.18], [-1.7, -9.35, 0.19], [-2.3, -9.55, 0.17]].forEach(([a, b, r]) => step(a, b, r));
  [[1.3, -7.9, 0.19], [1.86, -8.08, 0.17], [2.42, -7.95, 0.18]].forEach(([a, b, r]) => step(a, b, r));

  // ---------------------------------------------------------------- 玉垣 fence (stone posts + rails)
  const postG = mergeAll([xf(new THREE.BoxGeometry(0.11, 0.6, 0.11), [0, 0.3, 0]), xf(new THREE.CylinderGeometry(0.004, 0.078, 0.07, 4), [0, 0.635, 0], [0, Math.PI / 4, 0])]);
  const FB = TY + 0.035; // fence base (coping top)
  const fence = (a, b, n, skipA, skipB) => {
    const dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz), ang = Math.atan2(dx, dz);
    for (let i = 0; i <= n; i++) {
      if ((i === 0 && skipA) || (i === n && skipB)) continue;
      const t = i / n; K.mesh(postG, M.stone, [a[0] + dx * t, FB, a[1] + dz * t]);
    }
    for (const h of [0.17, 0.47]) K.mesh(tiledBox(0.055, 0.06, len, 0.8), M.stone, [(a[0] + b[0]) / 2, FB + h, (a[1] + b[1]) / 2], [0, ang, 0]);
    const p = W((a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
    physics.addBox(p.x, p.z, 0.16, len, f.rotY + ang, tb, FB + 0.68);
  };
  fence([-4.04, -0.76], [-1.13, -0.76], 3, false, true);
  fence([1.9, -0.76], [4.04, -0.76], 2, true, false);
  fence([-4.04, -0.76], [-4.04, -13.79], 13, true, false);
  fence([4.04, -0.76], [4.04, -13.79], 13, true, false);
  fence([-4.04, -13.79], [4.04, -13.79], 8, true, true);
  // donor names on a few front posts (奉納 …)
  [[-4.04, 0], [-3.07, 1], [2.97, 2], [4.04, 3]].forEach(([lx, i]) => K.plane(0.075, 0.3, mat.decal('#ffffff', { map: tx.kennoTex[i], transparent: true }), [lx, FB + 0.3, -0.76 + 0.057]));
  // 社号標 (shrine-name pillar) and the south gate pillar
  K.mesh(tiledBox(0.44, 0.12, 0.44, 0.8), M.coping, [-1.0, FB + 0.06, -0.76]);
  K.mesh(tiledBox(0.27, 1.34, 0.27, 0.8), M.stone, [-1.0, FB + 0.12 + 0.67, -0.76]);
  K.mesh(new THREE.CylinderGeometry(0.01, 0.19, 0.08, 4).rotateY(Math.PI / 4), M.stone, [-1.0, FB + 0.12 + 1.34 + 0.04, -0.76]);
  K.plane(0.19, 1.14, mat.decal('#ffffff', { map: tx.shagou, transparent: true }), [-1.0, FB + 0.12 + 0.69, -0.76 + 0.1375]);
  cBox(-1.0, -0.76, 0.44, 0.44, 0, tb, FB + 1.55);
  K.mesh(tiledBox(0.3, 0.1, 0.3, 0.8), M.coping, [1.8, FB + 0.05, -0.76]);
  K.mesh(tiledBox(0.2, 0.86, 0.2, 0.8), M.stone, [1.8, FB + 0.1 + 0.43, -0.76]);
  K.mesh(new THREE.CylinderGeometry(0.008, 0.14, 0.07, 4).rotateY(Math.PI / 4), M.stone, [1.8, FB + 0.1 + 0.86 + 0.035, -0.76]);
  cBox(1.8, -0.76, 0.3, 0.3, 0, tb, FB + 1.0);

  // ---------------------------------------------------------------- torii (稲荷鳥居: vermilion, black kasagi, daiwa rings)
  {
    const g = sub(0.4, TY, -1.3); const k = ctx.kit(g);
    const lean = 1.4 * DEG;
    for (const s of [-1, 1]) {
      const x = s * 1.05;
      k.mesh(new THREE.CylinderGeometry(0.094, 0.108, 2.64, 18), M.verm, [x - s * Math.sin(lean) * 1.32, 1.32, 0], [0, 0, s * lean]);
      k.cyl(0.124, 0.13, 0.32, M.black, [x, 0.14, 0], null, 18);
      k.cyl(0.134, 0.134, 0.07, M.black, [x - s * Math.sin(lean) * 2.64, 2.64, 0], null, 18);
      cCyl(0.4 + x, -1.3, 0.14, TY - 0.2, TY + 3.0);
    }
    k.box(2.72, 0.12, 0.09, M.verm, [0, 2.2, 0]);
    for (const s of [-1, 1]) k.box(0.035, 0.15, 0.12, M.black, [s * 1.2, 2.2, 0]);
    k.mesh(bentBox(3.08, 0.12, 0.22, 20, (t) => 0.05 * Math.pow(Math.abs(t), 2.6)), M.verm, [0, 2.735, 0]);
    k.mesh(bentBox(3.56, 0.13, 0.3, 24, (t) => 0.12 * Math.pow(Math.abs(t), 2.6)), M.black, [0, 2.86, 0]);
    k.box(0.12, 0.42, 0.085, M.verm, [0, 2.47, 0]);
    k.box(0.27, 0.38, 0.035, M.black, [0, 2.47, 0.058]);
    k.plane(0.235, 0.35, mat.toon('#ffffff', { map: tx.gaku, paint: 0.01 }), [0, 2.47, 0.0765]);
    // shimenawa + shide on the torii
    ropeWithShide(ctx, k, M, [-0.96, 2.05, 0.075], [0.96, 2.05, 0.075], 0.13, 0.03, [-0.5, 0, 0.5]);
  }

  // ---------------------------------------------------------------- stone lanterns (石灯籠)
  for (const lx of [-0.82, 1.62]) {
    const g = sub(lx, TY, -2.95); const k = ctx.kit(g);
    k.cyl(0.3, 0.32, 0.13, M.stone, [0, 0.065, 0], null, 6);
    k.cyl(0.22, 0.26, 0.1, M.stone, [0, 0.18, 0], null, 6);
    k.cyl(0.085, 0.095, 0.62, M.stone, [0, 0.54, 0], null, 12);
    k.cyl(0.105, 0.105, 0.04, M.stone, [0, 0.55, 0], null, 12);
    k.cyl(0.26, 0.15, 0.14, M.stone, [0, 0.92, 0], null, 6);
    k.cyl(0.17, 0.17, 0.28, M.ink, [0, 1.13, 0], null, 6);
    for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3 + Math.PI / 6; k.box(0.055, 0.28, 0.055, M.stone, [Math.sin(a) * 0.19, 1.13, Math.cos(a) * 0.19], [0, a, 0]); }
    k.cyl(0.22, 0.22, 0.035, M.stone, [0, 0.9975 + 0.0, 0], null, 6);
    k.cyl(0.22, 0.22, 0.035, M.stone, [0, 1.2875, 0], null, 6);
    k.cyl(0.07, 0.4, 0.2, M.stone, [0, 1.4, 0], null, 6);
    k.cyl(0.4, 0.4, 0.04, M.stone, [0, 1.3, 0], null, 6);
    for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; k.sphere(0.035, M.stone, [Math.sin(a) * 0.39, 1.34, Math.cos(a) * 0.39], 6); }
    k.cyl(0.075, 0.075, 0.045, M.stone, [0, 1.52, 0], null, 10);
    k.sphere(0.07, M.stone, [0, 1.6, 0], 10);
    k.mesh(new THREE.CylinderGeometry(0.0, 0.05, 0.07, 10), M.stone, [0, 1.68, 0]);
    k.mesh(G.sphere(10), M.leafLight, [0.12, 1.43, 0.05], [0, 0, 0.3], [0.18, 0.05, 0.14]); // moss on the roof
    cCyl(lx, -2.95, 0.3, TY - 0.2, TY + 1.7);
  }

  // ---------------------------------------------------------------- nobori (正一位稲荷大明神)
  [[1.72, -4.35, -0.45, 0], [1.72, -6.95, -0.45, 1], [-0.95, -4.35, 0.45, 2], [-0.95, -8.15, 0.45, 3]].forEach(([lx, lz, rot, i]) => {
    const g = sub(lx, TY, lz, rot); const k = ctx.kit(g);
    k.box(0.15, 0.12, 0.15, M.stone, [0, 0.06, 0]);
    k.cyl(0.014, 0.014, 2.32, M.bamboo, [0, 1.16, 0], null, 8);
    k.cyl(0.007, 0.007, 0.34, M.bamboo, [0.165, 2.2, 0], [0, 0, Math.PI / 2], 6);
    const sheet = waveSheet(0.3, 1.22, 0.02, 0.9, i * 0.37);
    const fm = mat.toon('#ffffff', { map: tx.noboriTex[i], paint: 0.02 });
    k.mesh(sheet, fm, [0.168, 2.19 - 0.62, 0]); k.mesh(backSide(sheet), fm, [0.168, 2.19 - 0.62, 0]);
    cCyl(lx, lz, 0.09, TY - 0.2, TY + 2.3);
  });

  // ---------------------------------------------------------------- 手水鉢 (hand-washing basin)
  {
    const g = sub(2.95, TY, -2.35, -Math.PI / 2); const k = ctx.kit(g);
    k.mesh(tiledBox(1.0, 0.2, 0.62, 0.8), M.coping, [0, 0.1, 0]);
    const bw = mat.toon('#ffffff', { map: tx.stone, paint: 0.05 });
    for (const s of [-1, 1]) k.mesh(tiledBox(0.9, 0.42, 0.07, 0.8), bw, [0, 0.41, s * 0.225]);
    for (const s of [-1, 1]) k.mesh(tiledBox(0.07, 0.42, 0.38, 0.8), bw, [s * 0.415, 0.41, 0]);
    k.box(0.76, 0.12, 0.38, bw, [0, 0.26, 0]);
    k.plane(0.76, 0.38, M.water, [0, 0.57, 0], [-Math.PI / 2, 0, 0]).castShadow = false;
    k.plane(0.5, 0.25, mat.decal('#ffffff', { map: tx.chozu, transparent: true }), [0, 0.42, 0.2615]);
    for (const zz of [-0.1, 0.12]) k.cyl(0.011, 0.011, 0.9, M.bambooDark, [0, 0.631, zz], [0, 0, Math.PI / 2], 8);
    [-0.22, 0.0, 0.22].forEach((x, i) => {
      const a = (i - 1) * 0.06;
      k.cyl(0.034, 0.031, 0.055, M.bamboo, [x, 0.667, -0.1], null, 12);
      k.cyl(0.03, 0.03, 0.004, M.bambooDark, [x, 0.696, -0.1], null, 12);
      k.cyl(0.0075, 0.0075, 0.4, M.bamboo, [x + Math.sin(a) * 0.2, 0.65, 0.1], [Math.PI / 2 - 0.05, a, 0], 6);
    });
    k.cyl(0.03, 0.034, 0.96, M.bamboo, [0.3, 0.48, -0.34], null, 10);
    const a = new THREE.Vector3(0.3, 0.86, -0.34), b = new THREE.Vector3(0.08, 0.78, -0.06);
    const mid = a.clone().add(b).multiplyScalar(0.5), dir = b.clone().sub(a);
    const pipe = k.mesh(new THREE.CylinderGeometry(0.021, 0.021, dir.length(), 10), M.bamboo, [mid.x, mid.y, mid.z]);
    pipe.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    k.cyl(0.005, 0.005, 0.2, M.stream, [0.07, 0.675, -0.055], null, 6).castShadow = false;
    cBox(2.95, -2.35, 0.64, 1.02, 0, TY - 0.2, TY + 0.75);
  }

  // ---------------------------------------------------------------- hokora on a stone base + offering box + bell
  {
    K.mesh(tiledBox(1.9, 0.28, 1.5, 0.8), M.coping, [0.4, TY + 0.14, -12.55]);
    K.mesh(tiledBox(1.5, 0.34, 1.16, 0.8), M.stone, [0.4, TY + 0.28 + 0.17, -12.7]);
    cBox(0.4, -12.55, 1.9, 1.5, 0, TY - 0.2, TY + 1.8);
    const g = sub(0.4, TY + 0.62, -12.74); g.scale.setScalar(1.18); const k = ctx.kit(g);
    k.box(1.0, 0.06, 0.9, M.woodDark, [0, 0.03, 0]);
    k.box(0.7, 0.6, 0.5, M.wood, [0, 0.36, -0.08]);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box(0.05, 0.62, 0.05, M.woodDark, [sx * 0.36, 0.37, -0.08 + sz * 0.26]);
    k.plane(0.56, 0.5, mat.toon('#ffffff', { map: tx.doors, paint: 0.02 }), [0, 0.35, 0.1735]);
    k.box(0.78, 0.04, 0.58, M.woodDark, [0, 0.68, -0.08]);
    for (const sx of [-1, 1]) { k.box(0.025, 0.12, 0.025, M.woodDark, [sx * 0.46, 0.12, 0.4]); k.box(0.02, 0.02, 0.4, M.woodMid, [sx * 0.46, 0.17, 0.22]); }
    k.box(0.3, 0.02, 0.02, M.woodMid, [-0.31, 0.17, 0.4]); k.box(0.3, 0.02, 0.02, M.woodMid, [0.31, 0.17, 0.4]);
    // gable infill + nagare roof (long front slope)
    const gable = ctx.geo.extrude([[0.2, 0.66], [-0.36, 0.66], [-0.36, 0.8], [-0.12, 0.985], [0.2, 0.84]], 0.68).rotateY(-Math.PI / 2);
    k.mesh(gable, M.wood, [0, 0, 0]);
    const slabF = { len: Math.hypot(0.66, 0.31), ang: Math.atan2(0.31, 0.66) };
    const slabB = { len: Math.hypot(0.4, 0.29), ang: Math.atan2(0.29, 0.4) };
    k.box(1.14, 0.055, slabF.len, M.copper, [0, 0.855 + 0.02, (0.54 - 0.12) / 2], [slabF.ang, 0, 0]);
    k.box(1.14, 0.055, slabB.len, M.copper, [0, 0.855 + 0.02, (-0.12 - 0.52) / 2], [-slabB.ang, 0, 0]);
    k.box(1.18, 0.05, 0.08, M.copperDark, [0, 1.03, -0.12]);
    for (const x of [-0.3, 0, 0.3]) { k.cyl(0.024, 0.024, 0.14, M.copperDark, [x, 1.075, -0.12], [Math.PI / 2, 0, 0], 10); k.cyl(0.026, 0.026, 0.012, M.gold, [x, 1.075, -0.05], [Math.PI / 2, 0, 0], 10); k.cyl(0.026, 0.026, 0.012, M.gold, [x, 1.075, -0.19], [Math.PI / 2, 0, 0], 10); }
    ropeWithShide(ctx, k, M, [-0.37, 0.64, 0.24], [0.37, 0.64, 0.24], 0.05, 0.024, [-0.2, 0.2]);
    // bell + bell rope
    k.cyl(0.004, 0.004, 0.06, M.ink, [0, 0.75, 0.47], null, 4);
    k.sphere(0.045, M.gold, [0, 0.69, 0.47], 12);
    k.cyl(0.011, 0.013, 0.62, M.bellRope, [0, 0.35, 0.47], null, 8);
    for (const dx of [-0.02, 0.02]) k.cyl(0.006, 0.006, 0.12, M.red, [dx, 0.0, 0.47], null, 5);
    // offerings on the base
    for (const sx of [-1, 1]) {
      k.cyl(0.028, 0.034, 0.12, M.porcelain, [sx * 0.42, 0.06, 0.3], null, 12);
      for (let i = 0; i < 4; i++) k.mesh(G.sphere(8), M.leafDark, [sx * 0.42 + (i - 1.5) * 0.02, 0.17 + (i % 2) * 0.03, 0.3 + ((i * 7) % 3 - 1) * 0.015], [0.3, i, 0.4], [0.05, 0.1, 0.03]);
      k.cyl(0.02, 0.028, 0.08, M.porcelain, [sx * 0.2, 0.04, 0.36], null, 10); k.cyl(0.009, 0.012, 0.035, M.porcelain, [sx * 0.2, 0.097, 0.36], null, 8);
    }
    k.cyl(0.06, 0.05, 0.02, M.porcelain, [0, 0.01, 0.36], null, 14);
    k.sphere(0.035, M.porcelain, [0, 0.025, 0.36], 10).scale.y = 0.5;
    // 賽銭箱
    const sb = sub(0.4, TY + 0.03, -11.43); const s = ctx.kit(sb);
    s.box(0.62, 0.34, 0.38, M.woodDark, [0, 0.2, 0]);
    s.box(0.66, 0.035, 0.42, M.woodMid, [0, 0.385, 0]);
    for (let i = 0; i < 6; i++) s.box(0.56, 0.035, 0.035, M.woodMid, [0, 0.41, -0.15 + i * 0.06], [Math.PI / 4, 0, 0]);
    for (const x of [-0.29, 0.29]) s.box(0.06, 0.03, 0.4, M.gold, [x, 0.405, 0]);
    s.box(0.64, 0.04, 0.4, M.woodDark, [0, 0.02, 0]);
    s.plane(0.58, 0.3, mat.toon('#ffffff', { map: tx.saisen, paint: 0.02 }), [0, 0.2, 0.1915]);
    cBox(0.4, -11.43, 0.68, 0.44, 0, TY - 0.2, TY + 0.45);
  }

  // ---------------------------------------------------------------- inari fox pair (key / jewel) on pedestals
  [[-0.85, 0.32, 'jewel'], [1.65, -0.32, 'key']].forEach(([lx, rot, holds]) => {
    const g = sub(lx, TY + 0.02, -10.35); const k = ctx.kit(g);
    k.mesh(tiledBox(0.52, 0.12, 0.52, 0.8), M.coping, [0, 0.06, 0]);
    k.mesh(tiledBox(0.38, 0.58, 0.38, 0.8), M.stone, [0, 0.12 + 0.29, 0]);
    k.mesh(tiledBox(0.46, 0.08, 0.46, 0.8), M.coping, [0, 0.74, 0]);
    const fg = new THREE.Group(); fg.position.set(0, 0.78, 0); fg.rotation.y = rot; fg.scale.setScalar(1.12); g.add(fg);
    fox(ctx, ctx.kit(fg), M, ell, holds);
    cBox(lx, -10.35, 0.52, 0.52, 0, TY - 0.2, TY + 1.5);
  });

  // ---------------------------------------------------------------- jizo shelter (地蔵堂) with three jizo, pinwheels
  {
    const JX = 3.3, JZ = -8.0, JR = -Math.PI / 2;
    const g = sub(JX, TY, JZ, JR); const k = ctx.kit(g);
    k.mesh(tiledBox(1.7, 0.2, 0.86, 0.8), M.coping, [0, 0.1, 0]);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box(0.07, 1.45, 0.07, M.woodDark, [sx * 0.76, 0.2 + 0.725, sz * 0.36]);
    k.box(1.52, 1.34, 0.03, M.wood, [0, 0.2 + 0.67, -0.365]);
    for (const sx of [-1, 1]) k.box(0.03, 0.8, 0.7, M.wood, [sx * 0.765, 0.2 + 0.4, 0]);
    k.box(1.64, 0.09, 0.08, M.woodDark, [0, 1.62, 0.36]); k.box(1.64, 0.09, 0.08, M.woodDark, [0, 1.62, -0.36]);
    for (const sx of [-1, 1]) k.box(0.06, 0.06, 0.8, M.woodDark, [sx * 0.76, 1.62, 0]);
    const gab = ctx.geo.extrude([[-0.4, 1.66], [0.4, 1.66], [0, 1.99]], 0.05).rotateY(-Math.PI / 2);
    for (const sx of [-1, 1]) k.mesh(gab, M.wood, [sx * 0.76, 0, 0]);
    const ra = Math.atan2(0.36, 0.64), rl = Math.hypot(0.64, 0.36);
    k.box(1.98, 0.05, rl, M.slate, [0, 1.84, 0.315], [ra, 0, 0]);
    k.box(1.98, 0.05, rl, M.slate, [0, 1.84, -0.315], [-ra, 0, 0]);
    k.box(2.0, 0.06, 0.09, M.roofTin, [0, 2.03, 0]);
    k.box(0.14, 0.36, 0.02, M.woodDark, [0, 1.38, 0.395]);
    k.plane(0.113, 0.34, mat.toon('#ffffff', { map: tx.jizoPlaque, paint: 0.02 }), [0, 1.38, 0.4065]);
    // jizo statues
    [[-0.5, 0.86, false], [0.0, 1.0, true], [0.5, 0.78, false]].forEach(([x, s, cap], i) => {
      const jg = new THREE.Group(); jg.position.set(x, 0.2, -0.04); jg.rotation.y = (i - 1) * -0.08; g.add(jg);
      jizo(ctx, ctx.kit(jg), M, ell, s, cap);
    });
    // offerings: flower vases, a cup, a small incense stand
    for (const [x, cols] of [[-0.25, ['#f2b5c8', '#f7e3a0', '#ffffff']], [0.27, ['#e9a1c0', '#b9d6f0', '#f7e3a0']]]) {
      k.cyl(0.03, 0.036, 0.1, M.bambooDark, [x, 0.25, 0.28], null, 10);
      cols.forEach((c, j) => { k.sphere(0.028, mat.toon(c, { paint: 0.02 }), [x + (j - 1) * 0.03, 0.34 + (j % 2) * 0.03, 0.28 + (j - 1) * 0.01], 8); });
      for (let j = 0; j < 3; j++) k.mesh(G.sphere(6), M.leafMid, [x + (j - 1) * 0.035, 0.31, 0.29], [0, j, 0.5], [0.03, 0.06, 0.02]);
    }
    k.cyl(0.025, 0.02, 0.05, M.porcelain, [-0.66, 0.225, 0.28], null, 10);
    k.box(0.14, 0.05, 0.08, M.stone, [0.0, 0.225, 0.3]);
    // pinwheels (spinning, dynamic)
    [[-0.7, 0.3, 0], [0.7, 0.3, 1]].forEach(([x, zz, i]) => {
      k.cyl(0.02, 0.02, 0.16, M.bamboo, [x, 0.28, zz], null, 8);
      k.cyl(0.004, 0.004, 0.46, M.bambooDark, [x, 0.43, zz], null, 5);
      pinwheel(ctx, g, [x, 0.66, zz + 0.012], i);
    });
    const p = W(JX, JZ); physics.addBox(p.x, p.z, 1.8, 0.95, f.rotY + JR, TY - 0.2, TY + 2.1);
  }

  // ---------------------------------------------------------------- ema rack (絵馬掛所)
  {
    const EX = -3.25, EZ = -9.7, ER = Math.PI / 2;
    const g = sub(EX, TY, EZ, ER); const k = ctx.kit(g);
    for (const sx of [-1, 1]) { k.mesh(tiledBox(0.2, 0.1, 0.2, 0.8), M.coping, [sx * 0.74, 0.05, 0]); k.box(0.08, 1.82, 0.08, M.woodDark, [sx * 0.74, 0.1 + 0.91, 0]); }
    const ra = Math.atan2(0.15, 0.32), rl = Math.hypot(0.32, 0.15);
    k.box(1.84, 0.04, rl, M.woodDark, [0, 1.99, 0.16], [ra, 0, 0]);
    k.box(1.84, 0.04, rl, M.woodDark, [0, 1.99, -0.16], [-ra, 0, 0]);
    k.box(1.86, 0.05, 0.07, M.woodMid, [0, 2.07, 0]);
    k.box(1.56, 0.08, 0.06, M.woodDark, [0, 1.9, 0]);
    k.box(0.54, 0.14, 0.02, M.woodMid, [0, 1.76, 0.03]);
    k.plane(0.5, 0.125, mat.toon('#ffffff', { map: tx.emaSign, paint: 0.02 }), [0, 1.76, 0.0405]);
    const bars = [0.95, 1.24, 1.53];
    for (const y of bars) k.box(1.44, 0.035, 0.035, M.woodMid, [0, y, 0]);
    let cell = 0;
    const emaGeos = new Map();
    const getEma = (c) => { if (!emaGeos.has(c)) { const x = (c % EMA.cols) * EMA.cw, y = Math.floor(c / EMA.cols) * EMA.ch; emaGeos.set(c, emaGeo(0.17, 0.114, 0.008, [x, y, EMA.cw, EMA.ch], tx.emaBack, EMA.W, EMA.H)); } return emaGeos.get(c); };
    bars.forEach((by, bi) => {
      for (const side of [1, -1]) {
        const n = side > 0 ? 12 : 11;
        for (let i = 0; i < n; i++) {
          if (rnd() < (side < 0 ? 0.15 : 0.06)) continue;
          const x = -0.64 + (i + (side < 0 ? 0.5 : 0)) * (1.28 / (n - 0.5)) + (rnd() - 0.5) * 0.03;
          const c = (cell++ * 7 + bi * 3) % tx.wishes;
          const e = k.mesh(getEma(c), M.ema, [x, by - 0.108 - (i % 3) * 0.006, side * (0.024 + (i % 2) * 0.009)], [side * 0.06 + (rnd() - 0.5) * 0.06, side < 0 ? Math.PI + (rnd() - 0.5) * 0.2 : (rnd() - 0.5) * 0.2, (rnd() - 0.5) * 0.22]);
          e.castShadow = false;
          k.cyl(0.0025, 0.0025, 0.06, M.cord, [x, by - 0.025, side * 0.022], [side * 0.3, 0, 0], 4).castShadow = false;
        }
      }
    });
    const p = W(EX, EZ); physics.addBox(p.x, p.z, 1.7, 0.42, f.rotY + ER, TY - 0.2, TY + 2.1);
  }

  // ---------------------------------------------------------------- community notice board (last year's 夏まつり poster)
  {
    const g = sub(-3.0, TY, -1.38, 0.06); const k = ctx.kit(g);
    for (const sx of [-1, 1]) k.box(0.07, 1.95, 0.07, M.woodDark, [sx * 0.7, 0.975, -0.02]);
    k.box(1.34, 0.86, 0.035, M.woodMid, [0, 1.25, 0]);
    k.plane(1.26, 0.78, M.notice, [0, 1.25, 0.0185]);
    k.box(1.4, 0.05, 0.06, M.woodDark, [0, 1.7, 0.01]); k.box(1.4, 0.05, 0.06, M.woodDark, [0, 0.8, 0.01]);
    for (const sx of [-1, 1]) k.box(0.05, 0.95, 0.06, M.woodDark, [sx * 0.675, 1.25, 0.01]);
    k.box(0.96, 0.13, 0.03, M.woodDark, [0, 1.8, 0]);
    k.plane(0.9, 0.1125, M.noticeHead, [0, 1.8, 0.0155]);
    k.box(1.6, 0.035, 0.36, M.roofTin, [0, 1.92, 0.03], [0.16, 0, 0]);
    const p = W(-3.0, -1.38); physics.addBox(p.x, p.z, 1.5, 0.16, f.rotY + 0.06, TY - 0.2, TY + 1.95);
  }

  // ---------------------------------------------------------------- fire-extinguisher box (south front corner)
  { const p = W(3.72, -1.3); fireBox(ctx, H, { x: p.x, z: p.z, rotY: f.rotY }, TY + 0.03); }

  // ---------------------------------------------------------------- evergreen trees (鎮守の森) + shrubs, moss
  tree(ctx, K, M, [-3.2, TY, -12.95], 2.5, 1.0, rnd, 0);
  tree(ctx, K, M, [3.2, TY, -12.85], 2.9, 1.15, rnd, 1);
  cCyl(-3.2, -12.95, 0.2, TY - 0.2, TY + 2.5); cCyl(3.2, -12.85, 0.22, TY - 0.2, TY + 2.9);
  [[3.45, -4.3, 0.55, true], [-3.55, -3.9, 0.5, true], [3.55, -10.9, 0.6, true], [-0.95, -13.2, 0.42, false], [1.85, -13.2, 0.42, false], [-3.55, -11.5, 0.45, false], [2.55, -13.25, 0.38, true]].forEach(([lx, lz, s, flowers]) => {
    bush(ctx, K, M, [lx, TY, lz], s, rnd, flowers);
    cCyl(lx, lz, s * 0.7, TY - 0.2, TY + s * 1.6);
  });
  [[-3.6, -12.1, 1.2], [3.6, -6.1, 0.9], [-1.25, -3.35, 0.7], [2.15, -3.25, 0.6], [0.4, -11.95, 1.6], [-3.5, -1.2, 0.8], [3.65, -9.4, 1.0], [-2.1, -13.4, 1.1]].forEach(([lx, lz, s]) => {
    K.plane(s, s * 0.7, M.moss, [lx, TY + 0.004, lz], [-Math.PI / 2, 0, rnd() * 3]).castShadow = false;
  });
}

// ------------------------------------------------------------------ pieces
function mossTex(ctx) {
  return ctx.tex.draw(128, 128, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    let s = 9; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 26; i++) {
      const x = w / 2 + (r() - 0.5) * w * 0.7, y = h / 2 + (r() - 0.5) * h * 0.7, rad = 8 + r() * 20;
      const gr = g.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, 'rgba(118,146,86,0.55)'); gr.addColorStop(1, 'rgba(118,146,86,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2); g.fill();
    }
  }, { key: 'props.shrine.moss' });
}

/** Straw rope along a sagging curve with zig-zag paper streamers (shide). Coordinates in the kit's frame. */
function ropeWithShide(ctx, k, M, a, b, sag, r, shideX) {
  const pts = ctx.geo.catenary(a, b, sag, 16);
  const curve = new THREE.CatmullRomCurve3(pts);
  k.mesh(new THREE.TubeGeometry(curve, 20, r, 8, false), M.rope, [0, 0, 0]);
  for (const s of [a, b]) k.sphere(r * 1.15, M.rope, s, 8);
  for (const x of shideX) {
    const t = (x - a[0]) / (b[0] - a[0]);
    const y = a[1] + (b[1] - a[1]) * t - sag * 4 * t * (1 - t) - r;
    const zz = a[2] + r * 0.6;
    for (let i = 0; i < 4; i++) k.plane(0.034, 0.05, M.shide, [x + (i % 2 ? 0.014 : -0.006), y - 0.03 - i * 0.047, zz + i * 0.002], [0, 0.15, (i % 2 ? -0.06 : 0.06)]).castShadow = false;
  }
}

function fox(ctx, k, M, ell, holds) {
  const m = M.statue;
  const limb = (a, b, r0, r1) => { const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A); const c = k.mesh(new THREE.CylinderGeometry(r1, r0, d.length(), 10), m, A.clone().add(B).multiplyScalar(0.5).toArray()); c.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); return c; };
  k.box(0.28, 0.05, 0.36, m, [0, 0.025, 0]);
  ell(k, m, [0, 0.12, -0.05], [0.23, 0.19, 0.29]);                       // haunches
  for (const s of [-1, 1]) ell(k, m, [s * 0.1, 0.05, 0.03], [0.07, 0.06, 0.15]); // hind feet
  limb([0, 0.14, -0.04], [0, 0.44, 0.02], 0.1, 0.055);                  // slender torso
  ell(k, m, [0, 0.31, 0.06], [0.12, 0.22, 0.1]);                        // chest
  for (const s of [-1, 1]) {
    limb([s * 0.038, 0.03, 0.115], [s * 0.035, 0.3, 0.07], 0.026, 0.03);  // front legs
    ell(k, m, [s * 0.038, 0.03, 0.13], [0.05, 0.035, 0.07]);
    k.mesh(new THREE.CylinderGeometry(0.004, 0.03, 0.115, 8), m, [s * 0.042, 0.62, 0.05], [-0.12, 0, -s * 0.24]);
    k.mesh(ctx.geo.G.sphere(8), M.ink, [s * 0.034, 0.555, 0.112], [0, 0, s * 0.42], [0.028, 0.008, 0.01]);
  }
  limb([0, 0.42, 0.02], [0, 0.52, 0.05], 0.05, 0.045);                 // neck
  ell(k, m, [0, 0.545, 0.06], [0.11, 0.1, 0.12]);                       // head
  k.mesh(new THREE.CylinderGeometry(0.011, 0.04, 0.13, 10), m, [0, 0.52, 0.165], [Math.PI / 2 + 0.2, 0, 0]);
  k.sphere(0.01, M.ink, [0, 0.508, 0.232], 6);
  [[0, 0.1, -0.2, 0.065], [0.02, 0.22, -0.23, 0.08], [0.035, 0.35, -0.22, 0.078], [0.045, 0.47, -0.18, 0.06], [0.045, 0.56, -0.13, 0.038], [0.04, 0.61, -0.09, 0.02]].forEach(([x, y, z, r]) => ell(k, m, [x, y, z], [r * 2, r * 2.3, r * 2]));
  k.mesh(new THREE.CylinderGeometry(0.05, 0.1, 0.11, 16, 1, true, -Math.PI * 0.56, Math.PI * 1.12), M.red, [0, 0.42, 0.035]);
  if (holds === 'key') { k.cyl(0.008, 0.008, 0.1, M.gold, [0, 0.495, 0.2], [0, 0, Math.PI / 2], 8); k.mesh(new THREE.TorusGeometry(0.015, 0.005, 6, 12), M.gold, [0.062, 0.495, 0.2]); }
  else k.sphere(0.022, M.gold, [0, 0.49, 0.222], 10);
}

function jizo(ctx, k, M, ell, s, cap) {
  const m = M.statue;
  k.cyl(0.15 * s, 0.13 * s, 0.07 * s, M.stone, [0, 0.035 * s, 0], null, 12);
  k.mesh(new THREE.CylinderGeometry(0.1 * s, 0.135 * s, 0.34 * s, 14), m, [0, 0.07 * s + 0.17 * s, 0]);
  ell(k, m, [0, 0.41 * s, 0], [0.2 * s, 0.13 * s, 0.19 * s]);
  k.sphere(0.086 * s, m, [0, 0.53 * s, 0.005], 14);
  k.mesh(new THREE.CylinderGeometry(0.1 * s, 0.152 * s, 0.16 * s, 16, 1, true, -Math.PI * 0.56, Math.PI * 1.12), M.red, [0, 0.37 * s, 0.004]);
  k.mesh(new THREE.TorusGeometry(0.083 * s, 0.014 * s, 6, 16), M.red, [0, 0.452 * s, 0.0], [Math.PI / 2, 0, 0]);
  for (const sx of [-1, 1]) k.box(0.024 * s, 0.005 * s, 0.006, M.ink, [sx * 0.03 * s, 0.535 * s, 0.083 * s]);
  if (cap) k.mesh(new THREE.SphereGeometry(0.093 * s, 14, 7, 0, Math.PI * 2, 0, Math.PI * 0.52), M.redKnit, [0, 0.54 * s, 0.0]);
}

function pinwheel(ctx, parent, pos, i) {
  // static proxy in the jizo frame -> world transform for the dynamic head
  const proxy = new THREE.Object3D(); proxy.position.set(...pos); parent.add(proxy);
  proxy.updateWorldMatrix(true, false);
  const outer = new THREE.Group();
  proxy.matrixWorld.decompose(outer.position, outer.quaternion, outer.scale);
  const spin = new THREE.Group(); outer.add(spin);
  const cols = (i ? ['#f3a6c0', '#9fd0f0', '#f7df86', '#a7dcb5'] : ['#f7df86', '#f3a6c0', '#a7dcb5', '#9fd0f0']).map((h) => new THREE.Color(h));
  // 4 blades + a pin head merged into ONE vertex-coloured mesh (one draw call per pinwheel)
  const P = [], C = [];
  for (let b = 0; b < 4; b++) {
    const a = b * Math.PI / 2, ca = Math.cos(a), sa = Math.sin(a);
    const rot = (x, y) => [x * ca - y * sa, x * sa + y * ca];
    const tri = [[0, 0, 0], [0.075, 0.0, 0.012], [0.075, 0.075, 0.0]];
    for (const [x, y, z] of tri) { const [rx, ry] = rot(x, y); P.push(rx, ry, z); C.push(cols[b].r, cols[b].g, cols[b].b); }
  }
  const pinG = new THREE.OctahedronGeometry(0.011, 0); const pp = pinG.attributes.position; const cw = new THREE.Color('#f6f3ec');
  for (let j = 0; j < pp.count; j++) { P.push(pp.getX(j), pp.getY(j), pp.getZ(j) + 0.006); C.push(cw.r, cw.g, cw.b); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(P.length / 3 * 2), 2));
  geo.computeVertexNormals();
  const head = new THREE.Mesh(geo, ctx.mat.toon('#ffffff', { vertexColors: true, side: 'double', paint: 0.02 }));
  head.castShadow = true; spin.add(head);
  ctx.add(outer);
  const w0 = 3.2 + i * 0.9;
  ctx.onUpdate((dt, t) => { spin.rotation.z = -(t * w0 + Math.sin(t * 0.63 + i) * 1.6); });
}

// Evergreen foliage (鎮守の森 camphor / oak, camellia bushes): smooth puff-scalloped clouds from lib/foliage
// (welded surfaces, blended normals, baked colour + procedural leaf clumps) instead of faceted icospheres.
const EVERGREEN = {
  light: { top: '#b3d38a', mid: '#80aa68', base: '#57835a' },
  mid: { top: '#94bd72', mid: '#5f8e5b', base: '#416b51' },
  dark: { top: '#7fa865', mid: '#4c7a52', base: '#34594a' },
};
const _lobes = new Map();
/** unit-radius canopy lobe (centred), cached per tone/variant */
function lobeGeo(tone, v) {
  const k = tone + v;
  if (!_lobes.has(k)) _lobes.set(k, shrubGeometry({ rx: 1, ry: 1, rz: 1, detail: 3, flatBottom: false, cutBottom: false, lumps: 0.26, freq: 1.7, puff: 0.42, puffAmp: 0.36, seed: 90 + v * 13 + tone.length, colors: EVERGREEN[tone], normalBlend: 0.55 }).clone().translate(0, -0.55, 0));
  return _lobes.get(k);
}

function tree(ctx, K, M, pos, trunkH, s, rnd, seed) {
  const [x, y, z] = pos;
  const fm = foliageMaterial(ctx);
  K.mesh(new THREE.CylinderGeometry(0.09 * s, 0.16 * s, trunkH, 10), M.trunk, [x, y + trunkH / 2, z]);
  for (let i = 0; i < 2; i++) { const a = i * 2.6 + seed; K.mesh(new THREE.CylinderGeometry(0.03 * s, 0.06 * s, 1.0 * s, 7), M.trunk, [x + Math.sin(a) * 0.3, y + trunkH * 0.75, z + Math.cos(a) * 0.3], [Math.cos(a) * 0.7, 0, -Math.sin(a) * 0.7]); }
  const n = 12;
  for (let i = 0; i < n; i++) {
    const a = i * 2.399 + seed, rr = (0.3 + 0.7 * ((i * 37) % 11) / 11) * 1.1 * s, hy = trunkH + 0.3 + ((i * 53) % 13) / 13 * 2.2 * s;
    const r = (0.62 + rnd() * 0.35) * s * (1.1 - 0.25 * (hy - trunkH) / (2.4 * s));
    const cx = x + Math.sin(a) * rr, cz = z + Math.cos(a) * rr * 0.8;
    const lit = Math.sin(a) < -0.2 || hy > trunkH + 1.6 * s; // west / top side catches the sun
    const rot = [rnd(), rnd(), rnd()];
    K.mesh(lobeGeo(lit ? 'light' : (i % 3 ? 'mid' : 'dark'), i % 3), fm, [cx, y + hy, cz], [0, rot[1] * 6.28, 0], [r, r * 0.86, r]);
  }
  K.mesh(lobeGeo('mid', 1), fm, [x, y + trunkH + 2.3 * s, z], [0, 0.5, 0], [0.6 * s, 0.7 * s, 0.6 * s]);
}

function bush(ctx, K, M, pos, s, rnd, flowers) {
  const [x, y, z] = pos;
  for (let i = 0; i < 4; i++) { rnd(); rnd(); rnd(); } // same RNG draws as the old 4-lobe bush
  const v = Math.floor(s * 100) % 3;
  // camellia / evergreen mound matching the old 4-lobe footprint (~1.1 s wide, ~1.2 s tall)
  const geo = shrubGeometry({ rx: 0.72, ry: 0.7, rz: 0.66, seed: 120 + v * 5, detail: 5, lumps: 0.2, puff: 0.26, colors: EVERGREEN.mid });
  const m = K.mesh(geo, foliageMaterial(ctx), [x, y - 0.02, z], [0, v * 2.1, 0], [s, s, s]);
  if (flowers) { // red / white camellia blossoms
    for (let i = 0; i < 9; i++) { rnd(); rnd(); rnd(); }
    const fl = new THREE.Mesh(flowerGeometry(geo, { density: 9, size: 0.045, petals: 5, colors: ['#d9434f', '#e0606f', '#d9434f', '#f1efe9'], seed: 7 + v, minY: 0.25 }), ctx.mat.toon('#ffffff', { vertexColors: true, paint: 0.02 }));
    fl.castShadow = false; ctx.noOutline(fl); m.add(fl);
  }
}
