// environment/far.js — everything beyond the river and beyond the town:
//  spring fields (flooded paddies mirroring the sky, dry paddies, レンゲ, wheat, vegetable rows, 菜の花),
//  farm roads, farmhouses with 屋敷林, greenhouses, a shrine forest (鎮守の森), a hillside town with a school,
//  lattice power pylons with sagging lines, tree clumps on the hills and 3 layered distant ridge rings.
import * as L from '../layout.js';
import { terrainH, hillMask, fbm, vnoise, ridged, smoothstep, clamp, lerp, BRIDGE, lin, mix3, smoothBlob } from './common.js';
import { distantMaterial, waterMaterial } from './shaders.js';
import { shrubGeometry } from '../lib/foliage.js';

const W = L.WORLD.visual;

// ------------------------------------------------------------------ small geometry helpers
function gableRoofGeo(THREE) {
  // unit gable prism: width 1 (x), depth 1 (z), ridge along x at y=1, eaves at y=0
  const p = [-0.5, 0, 0.5, 0.5, 0, 0.5, 0.5, 1, 0, -0.5, 1, 0, -0.5, 0, -0.5, 0.5, 0, -0.5];
  const idx = [0, 1, 2, 0, 2, 3, 5, 4, 3, 5, 3, 2, 0, 3, 4, 1, 5, 2, 0, 4, 5, 0, 5, 1];
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.setIndex(idx);
  const ng = g.toNonIndexed(); ng.computeVertexNormals(); return ng;
}
function hipRoofGeo(THREE, w, d, h) {
  const r = Math.max(0, (w - d) / 2);
  const p = [-w / 2, 0, d / 2, w / 2, 0, d / 2, w / 2, 0, -d / 2, -w / 2, 0, -d / 2, -r, h, 0, r, h, 0];
  const idx = [0, 1, 5, 0, 5, 4, 2, 3, 4, 2, 4, 5, 1, 2, 5, 3, 0, 4, 0, 3, 2, 0, 2, 1];
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.setIndex(idx);
  const ng = g.toNonIndexed(); ng.computeVertexNormals(); return ng;
}

export function buildFar(ctx, tx) {
  const { THREE } = ctx;
  const root = new THREE.Group(); root.name = 'env-far'; ctx.addStatic(root);
  const k = ctx.kit(root);
  const r = ctx.rng('env-far');
  const out = { plots: [], nanoEdges: [], fieldZones: [] };

  // ================================================================ farm roads (draped strips)
  const roadMat = ctx.mat.toon('#c5bfb1', { map: tx.ground, paint: 0.05, name: 'env-farmroad' });
  const asphaltMat = ctx.mat.toon('#85878b', { map: tx.path, paint: 0.04, name: 'env-farmasphalt' });
  function drape(x0, z0, x1, z1, w, mat, seg = 4) {
    const len = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.ceil(len / seg));
    const dx = (x1 - x0) / len, dz = (z1 - z0) / len, px = -dz * w / 2, pz = dx * w / 2;
    const pos = [], idx = [];
    for (let i = 0; i <= n; i++) {
      const x = x0 + (x1 - x0) * i / n, z = z0 + (z1 - z0) * i / n;
      for (const s of [-1, 1]) { const xx = x + px * s, zz = z + pz * s; pos.push(xx, terrainH(xx, zz) + 0.045, zz); }
      if (i) { const a = (i - 1) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    if (g.attributes.normal.getY(0) < 0) { const ia = g.index.array; for (let i = 0; i < ia.length; i += 3) { const t = ia[i + 1]; ia[i + 1] = ia[i + 2]; ia[i + 2] = t; } g.computeVertexNormals(); }
    const uv = new Float32Array(pos.length / 3 * 2); for (let i = 0; i < pos.length / 3; i++) { uv[i * 2] = pos[i * 3] / 5; uv[i * 2 + 1] = -pos[i * 3 + 2] / 5; }
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    const m = new THREE.Mesh(g, mat); m.receiveShadow = true; root.add(m); return m;
  }
  const ZR = [-120.6, -123.4];               // river-side farm road
  drape(-700, -122, BRIDGE.x - 9, -122, 2.8, roadMat, 8);
  drape(BRIDGE.x + 9, -122, 700, -122, 2.8, roadMat, 8);
  drape(-700, -206.5, 700, -206.5, 3.0, roadMat, 8);
  const NS = [-410, 55, 250, 460];
  for (const x of NS) drape(x, -123.5, x, -292, 3.0, roadMat, 8);
  drape(BRIDGE.x, -178, BRIDGE.x, -300, 6.0, asphaltMat, 6);
  drape(BRIDGE.x, -121, BRIDGE.x, -178, 6.0, asphaltMat, 3);

  // ================================================================ fields
  const EXCL = [];
  const shrine = { x: -78, z: -168, r: 19 };
  EXCL.push({ x0: shrine.x - 22, x1: shrine.x + 22, z0: shrine.z - 22, z1: shrine.z + 24 });
  EXCL.push({ x0: shrine.x - 2.2, x1: shrine.x + 2.2, z0: shrine.z, z1: -121 });
  EXCL.push({ x0: -262 - 17, x1: -262 + 17, z0: -300, z1: -255 });
  const farms = [{ x: -300, z: -150, rot: 0.05 }, { x: 128, z: -165, rot: -0.04 }, { x: 340, z: -245, rot: 0.1 }, { x: -525, z: -240, rot: -0.08 }, { x: -18, z: -255, rot: 0.02 }, { x: 560, z: -150, rot: 0.06 }];
  for (const f of farms) EXCL.push({ x0: f.x - 18, x1: f.x + 18, z0: f.z - 16, z1: f.z + 14 });
  const greenhouses = [{ x: 205, z: -140, n: 5 }, { x: -250, z: -252, n: 4 }, { x: 420, z: -175, n: 3 }];
  for (const gh of greenhouses) EXCL.push({ x0: gh.x - 3.5, x1: gh.x + gh.n * 7 + 1, z0: gh.z - 17, z1: gh.z + 17 });
  EXCL.push({ x0: BRIDGE.x - 16, x1: BRIDGE.x + 16, z0: -182, z1: -118 });
  const excluded = (x0, x1, z0, z1) => EXCL.some((e) => x0 < e.x1 && x1 > e.x0 && z0 < e.z1 && z1 > e.z0);

  const typeW = [['flood', 0.34], ['dry', 0.12], ['renge', 0.16], ['wheat', 0.1], ['veg', 0.1], ['nano', 0.1], ['grass', 0.08]];
  const pickType = (x, z) => {
    const n = fbm(x / 90, z / 70, 2, 201) * 0.65 + r() * 0.35; // clustered
    let acc = 0; for (const [t, w] of typeW) { acc += w; if (n * 1.02 < acc) return t; }
    return 'grass';
  };
  const tops = {}; const addTop = (t) => (tops[t] || (tops[t] = { pos: [], uv: [], idx: [], size: [] }));
  const sides = { pos: [], col: [], idx: [] };
  const cSide = lin(THREE, '#9d9573'), cSideG = lin(THREE, '#93b56c'), cSideG2 = lin(THREE, '#a3bf75'), cSoil = lin(THREE, '#9a8766');
  function addPlot(x0, x1, z0, z1, type) {
    // z0 < z1 ; plot level = highest terrain on the plot (north edge) + 5 cm
    const lv = Math.max(terrainH(x0, z0), terrainH(x1, z0), terrainH(x0, z1), terrainH(x1, z1)) + 0.05;
    const T = addTop(type), b = T.pos.length / 3;
    const rotRows = (type === 'veg' || type === 'wheat') && r() < 0.5;
    for (const [x, z] of [[x0, z1], [x1, z1], [x1, z0], [x0, z0]]) {
      T.pos.push(x, lv, z);
      if (type === 'flood') { T.uv.push(x - x0, z1 - z); T.size.push(x1 - x0, z1 - z0); }
      else if (rotRows) T.uv.push(-z / 4, x / 4); else T.uv.push(x / 4, -z / 4);
    }
    T.idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
    // 畦 (earth ridges): inner lip, grassy top strip, outer wall down into the terrain
    const corners = [[x0, z1], [x1, z1], [x1, z0], [x0, z0], [x0, z1]];
    const cxm = (x0 + x1) / 2, czm = (z0 + z1) / 2, rh = lv + 0.13, RW = 0.36;
    const quad = (p0, p1, p2, p3, c0, c1) => {
      const s0 = sides.pos.length / 3;
      sides.pos.push(...p0, ...p1, ...p2, ...p3);
      for (const c of [c0, c0, c1, c1]) sides.col.push(c[0], c[1], c[2]);
      sides.idx.push(s0, s0 + 1, s0 + 2, s0, s0 + 2, s0 + 3);
    };
    const gT = r() < 0.5 ? cSideG : cSideG2;
    for (let i = 0; i < 4; i++) {
      const [ax, az] = corners[i], [bx, bz] = corners[i + 1];
      let ox = (ax + bx) / 2 - cxm, oz = (az + bz) / 2 - czm; const ol = Math.hypot(ox, oz); ox /= ol; oz /= ol;
      const ex = ax + ox * RW, ez = az + oz * RW, fx = bx + ox * RW, fz = bz + oz * RW;
      // extend the strip along the edge so neighbouring edges close the corners
      const ux = (bx - ax) / Math.hypot(bx - ax, bz - az), uz = (bz - az) / Math.hypot(bx - ax, bz - az);
      const e2x = ex - ux * RW, e2z = ez - uz * RW, f2x = fx + ux * RW, f2z = fz + uz * RW;
      quad([ax, lv - 0.05, az], [bx, lv - 0.05, bz], [bx, rh, bz], [ax, rh, az], cSoil, cSoil);
      quad([ax, rh, az], [bx, rh, bz], [f2x, rh, f2z], [e2x, rh, e2z], gT, gT);
      quad([e2x, terrainH(e2x, e2z) - 0.2, e2z], [f2x, terrainH(f2x, f2z) - 0.2, f2z], [f2x, rh, f2z], [e2x, rh, e2z], cSide, gT);
    }
    out.plots.push({ x0, x1, z0, z1, type, y: lv });
    if (type === 'nano') out.nanoEdges.push({ x0, x1, z: z1, y: lv });
  }
  const colsX = [-700, -410, BRIDGE.x, 55, 250, 460, 700];
  const rowsZ = [-123.6, -206.5, -292];
  for (let ci = 0; ci < colsX.length - 1; ci++) for (let ri = 0; ri < rowsZ.length - 1; ri++) {
    const bx0 = colsX[ci] + (colsX[ci] === BRIDGE.x ? 3.4 : 1.8), bx1 = colsX[ci + 1] - (colsX[ci + 1] === BRIDGE.x ? 3.4 : 1.8);
    const bz0 = rowsZ[ri + 1] + 1.8, bz1 = rowsZ[ri] - 1.8;
    let x = bx0;
    while (x < bx1 - 6) {
      const w = Math.min(bx1 - x, 20 + r() * 16);
      let z = bz1;
      while (z > bz0 + 5) {
        const d = Math.min(z - bz0, 14 + r() * 9);
        const px0 = x + 0.35, px1 = x + w - 0.35, pz0 = z - d + 0.35, pz1 = z - 0.35;
        if (!excluded(px0, px1, pz0, pz1) && Math.abs((px0 + px1) / 2) < 690) addPlot(px0, px1, pz0, pz1, pickType((px0 + px1) / 2, (pz0 + pz1) / 2));
        z -= d;
      }
      x += w;
    }
  }
  const FT = tx.fields;
  const topMats = {
    dry: ctx.mat.toon('#ffffff', { map: FT.dry, paint: 0.05, name: 'env-f-dry' }),
    renge: ctx.mat.toon('#ffffff', { map: FT.renge, paint: 0.04, name: 'env-f-renge' }),
    wheat: ctx.mat.toon('#ffffff', { map: FT.wheat, paint: 0.04, name: 'env-f-wheat' }),
    veg: ctx.mat.toon('#ffffff', { map: FT.veg, paint: 0.05, name: 'env-f-veg' }),
    nano: ctx.mat.toon('#ffffff', { map: FT.nano, paint: 0.04, name: 'env-f-nano' }),
    grass: ctx.mat.toon('#ffffff', { map: FT.grass, paint: 0.05, name: 'env-f-grass' }),
    flood: waterMaterial(ctx, { mode: 1, mud: '#a9ab91', bank: '#88a06f' }),
  };
  for (const [t, T] of Object.entries(tops)) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(T.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(new Float32Array(T.pos.length).map((v, i) => (i % 3 === 1 ? 1 : 0)), 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(T.uv, 2));
    if (t === 'flood') g.setAttribute('aSize', new THREE.Float32BufferAttribute(T.size, 2));
    g.setIndex(T.idx); g.computeBoundingSphere();
    const m = new THREE.Mesh(g, topMats[t]); m.receiveShadow = t !== 'flood'; m.name = 'env-fields-' + t;
    if (t === 'flood') ctx.noBatch(m);
    root.add(m);
  }
  {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(sides.pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(sides.col, 3));
    g.setIndex(sides.idx); g.computeVertexNormals(); g.computeBoundingSphere();
    const m = new THREE.Mesh(g, ctx.mat.toon('#ffffff', { vertexColors: true, side: 'double', paint: 0.04, name: 'env-aze' }));
    m.receiveShadow = true; root.add(m);
  }

  // ================================================================ farmhouses, barns, 屋敷林, greenhouses
  const roofG = gableRoofGeo(THREE);
  const treeMat = ctx.mat.toon('#628f5b', { paint: 0.08, name: 'env-tree' });
  const treeMatD = ctx.mat.toon('#4f7650', { paint: 0.07, name: 'env-treeD' });
  const treeMatL = ctx.mat.toon('#8fb56f', { paint: 0.07, name: 'env-treeL' });
  const blobG = smoothBlob(THREE, 1);
  // nearer broadleaf crowns (shrine forest, the two closest farms): smooth lumpy clouds (lib/foliage) — no facets at 70–250 m
  const blobHi = [0, 1, 2].map((v) => shrubGeometry({ rx: 1, ry: 1, rz: 1, detail: 2, flatBottom: false, cutBottom: false, lumps: 0.24, freq: 1.4, puff: 0, seed: 150 + v * 9, colors: { top: '#ffffff', mid: '#f2f2f2', base: '#d0d0d0' }, normalBlend: 0.85 }).clone().translate(0, -0.55, 0));
  let blobN = 0;
  const coneG = new THREE.ConeGeometry(1, 1, 8, 1);
  const trunkMat = ctx.mat.toon('#6f5a4c', { paint: 0.05 });
  function tree(x, z, h, kind, grp = root, hi = false) {
    const y = terrainH(x, z);
    if (kind === 'cedar') {
      const m = new THREE.Mesh(coneG, treeMatD); m.scale.set(h * 0.2, h * 0.86, h * 0.2); m.position.set(x, y + h * 0.14 + h * 0.43, z); m.castShadow = true; m.receiveShadow = true; grp.add(m);
      k.cyl(h * 0.025, h * 0.03, h * 0.2, trunkMat, [x, y + h * 0.1, z], null, 6);
    } else {
      const bg = hi ? blobHi[blobN++ % 3] : blobG;
      const m = new THREE.Mesh(bg, kind === 'light' ? treeMatL : treeMat); m.scale.set(h * 0.34, h * 0.3, h * 0.34); m.position.set(x, y + h * 0.66, z); m.castShadow = true; m.receiveShadow = true; grp.add(m);
      const m2 = new THREE.Mesh(hi ? blobHi[blobN++ % 3] : blobG, kind === 'light' ? treeMatL : treeMat); m2.scale.set(h * 0.22, h * 0.2, h * 0.22); m2.position.set(x + h * 0.17, y + h * 0.5, z + h * 0.08); m2.castShadow = true; grp.add(m2);
      k.cyl(h * 0.03, h * 0.04, h * 0.45, trunkMat, [x, y + h * 0.22, z], null, 6);
    }
  }
  const wallCols = ['#ece5d6', '#e4d9c4', '#d9d3c6', '#efe9dc', '#cdb89a'];
  const roofCols = ['#4a4f58', '#56677a', '#4d6457', '#5a5553', '#6a5448'];
  for (const f of farms) {
    const g = k.group([f.x, 0, f.z], f.rot); const kg = ctx.kit(g);
    const base = Math.min(terrainH(f.x - 10, f.z - 8), terrainH(f.x + 10, f.z + 8), terrainH(f.x, f.z)) - 0.1;
    g.position.y = base;
    const wc = ctx.mat.toon(r.pick(wallCols), { paint: 0.08 }), rc = ctx.mat.toon(r.pick(roofCols), { paint: 0.06 });
    // main house (2 storeys) with a big hip roof
    kg.boxB(13, 5.6, 9, wc, [0, 0, 0]);
    const hr = new THREE.Mesh(hipRoofGeo(THREE, 14.8, 10.8, 3.0), rc); hr.position.set(0, 5.6, 0); hr.castShadow = true; hr.receiveShadow = true; g.add(hr);
    kg.boxB(13.1, 0.14, 9.1, ctx.mat.toon('#8b8378'), [0, 2.75, 0]);
    // window band + dark doorway (south)
    kg.box(9, 1.0, 0.05, ctx.mat.toon('#7d8f9c', { paint: 0.02 }), [0.6, 3.9, 4.52]);
    kg.box(2.2, 2.0, 0.05, ctx.mat.toon('#5d5048', { paint: 0.02 }), [-3.5, 1.0, 4.52]);
    kg.box(8, 1.1, 0.05, ctx.mat.toon('#8fa2ae', { paint: 0.02 }), [1.5, 1.3, 4.52]);
    // barn (納屋) with a metal gable roof
    const bc = ctx.mat.toon(r.pick(['#b9ad98', '#a39684', '#c9c2b2']), { paint: 0.08 });
    kg.boxB(8, 4.2, 6, bc, [-12.5, 0, -3]);
    const br = new THREE.Mesh(roofG, ctx.mat.toon(r.pick(['#7b8691', '#8a5a44', '#56677a']), { paint: 0.05 }));
    br.scale.set(8.8, 1.8, 6.8); br.position.set(-12.5, 4.2, -3); br.castShadow = true; g.add(br);
    // hedge
    kg.boxB(26, 1.2, 0.9, treeMat, [-3, 0, 9.5]);
    // 屋敷林 (windbreak trees) behind (north)
    for (let i = 0; i < 6; i++) {
      const lx = -14 + i * 5.6 + (r() - 0.5) * 2, lz = -10 - r() * 3;
      const c = Math.cos(f.rot), s = Math.sin(f.rot);
      tree(f.x + lx * c + lz * s, f.z - lx * s + lz * c, 10 + r() * 7, r() < 0.55 ? 'cedar' : 'broad', root, Math.hypot(f.x, f.z) < 260);
    }
  }
  const ghMat = ctx.mat.toon('#e7edef', { paint: 0.03, name: 'env-greenhouse' });
  const ghEnd = ctx.mat.toon('#d5dde0', { paint: 0.03 });
  const ghG = new THREE.CylinderGeometry(1, 1, 1, 10, 1, true, 0, Math.PI); ghG.rotateZ(Math.PI / 2);
  for (const gh of greenhouses) for (let i = 0; i < gh.n; i++) {
    const x = gh.x + i * 7, y = terrainH(x, gh.z) - 0.05;
    const m = new THREE.Mesh(ghG, ghMat); m.scale.set(30, 2.8, 2.7); m.rotation.y = Math.PI / 2; m.position.set(x, y, gh.z);
    m.castShadow = true; m.receiveShadow = true; root.add(m);
    for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.CircleGeometry(1, 10, 0, Math.PI), ghEnd); e.scale.set(2.7, 2.8, 1); e.position.set(x, y, gh.z + s * 15); e.rotation.y = s > 0 ? 0 : Math.PI; root.add(e); }
  }

  // ================================================================ 鎮守の森 shrine forest with a torii
  {
    const cx = shrine.x, cz = shrine.z;
    for (let i = 0; i < 26; i++) {
      const a = r() * Math.PI * 2, d = Math.sqrt(r()) * shrine.r;
      const x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d * 0.85;
      if (z > cz + 12 && Math.abs(x - cx) < 4) continue; // keep the approach open
      tree(x, z, (i < 12 ? 17 : 13) + r() * 7, i < 12 ? 'cedar' : (r() < 0.3 ? 'light' : 'broad'), root, true);
    }
    const ver = ctx.mat.toon('#d8603f', { paint: 0.05, name: 'env-torii' });
    const blk = ctx.mat.toon('#3f3a40', { paint: 0.03 });
    const tz = cz + 19, ty = terrainH(cx, tz);
    for (const s of [-1, 1]) { k.cyl(0.22, 0.25, 4.6, ver, [cx + s * 1.9, ty + 2.3, tz], null, 10); k.cyl(0.3, 0.3, 0.35, blk, [cx + s * 1.9, ty + 0.17, tz], null, 10); }
    k.box(5.4, 0.28, 0.42, blk, [cx, ty + 4.78, tz]);
    k.box(5.0, 0.26, 0.36, ver, [cx, ty + 4.5, tz]);
    k.box(4.4, 0.2, 0.26, ver, [cx, ty + 3.7, tz]);
    k.box(0.22, 0.6, 0.2, ver, [cx, ty + 4.1, tz]);
    // hokora roof glimpsed between the trees
    k.boxB(2.4, 1.8, 2.2, ctx.mat.toon('#b89a78', { paint: 0.07 }), [cx, terrainH(cx, cz + 6), cz + 6]);
    const hr = new THREE.Mesh(roofG, ctx.mat.toon('#4f5560', { paint: 0.05 })); hr.scale.set(3.2, 1.1, 3.0); hr.rotation.y = Math.PI / 2; hr.position.set(cx, terrainH(cx, cz + 6) + 1.8, cz + 6); hr.castShadow = true; root.add(hr);
    // sandō (gravel approach) from the E-W farm road
    drape(cx, tz + 0.5, cx, -123.3, 2.2, roadMat, 4);
    // stone lanterns
    for (const s of [-1, 1]) { const lx = cx + s * 2.3, lz = tz + 3; const ly = terrainH(lx, lz); k.boxB(0.5, 0.9, 0.5, ctx.mat.toon('#c9c4b8'), [lx, ly, lz]); k.boxB(0.75, 0.3, 0.75, ctx.mat.toon('#b7b2a6'), [lx, ly + 0.9, lz]); }
  }

  // ================================================================ hillside town + school (on the foot of the hills, NE and NW)
  {
    const bodyG = new THREE.BoxGeometry(1, 1, 1); bodyG.translate(0, 0.5, 0);
    const houses = [];
    const cluster = (cx, cz, n, rx, rz) => {
      for (let i = 0; i < n; i++) {
        const x = cx + (r() - 0.5) * 2 * rx, z = cz + (r() - 0.5) * 2 * rz;
        if (houses.some((h) => Math.abs(h.x - x) < 11 && Math.abs(h.z - z) < 10)) continue;
        const w = 8 + r() * 4, d = 7 + r() * 3, h = r() < 0.75 ? 5.8 : 3.2;
        const y = Math.min(terrainH(x - w / 2, z - d / 2), terrainH(x + w / 2, z - d / 2), terrainH(x - w / 2, z + d / 2), terrainH(x + w / 2, z + d / 2)) - 0.3;
        const yTop = Math.max(terrainH(x - w / 2, z - d / 2), terrainH(x + w / 2, z - d / 2), terrainH(x, z)) + 0.2;
        houses.push({ x, z, w, d, h, y, yTop, rot: (r() - 0.5) * 0.3, wall: r.pick(wallCols), roof: r.pick(roofCols) });
      }
    };
    cluster(215, -318, 34, 95, 22);
    cluster(-392, -314, 22, 62, 17);
    cluster(520, -345, 14, 60, 18);
    const bm = new THREE.InstancedMesh(bodyG, ctx.mat.toon('#ffffff', { map: tx.facade, paint: 0.05, name: 'env-farhouse' }), houses.length);
    const baseM = new THREE.InstancedMesh(bodyG, ctx.mat.toon('#ffffff', { paint: 0.06, name: 'env-farbase' }), houses.length);
    const rm = new THREE.InstancedMesh(roofG, ctx.mat.toon('#ffffff', { paint: 0.05, name: 'env-farroof' }), houses.length);
    const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), S = new THREE.Vector3(), E = new THREE.Euler(), c = new THREE.Color();
    houses.forEach((h, i) => {
      Q.setFromEuler(E.set(0, h.rot, 0));
      // concrete terrace base (擁壁) on the downhill side, then the house body and a generous roof
      M.compose(V.set(h.x, h.y, h.z), Q, S.set(h.w + 1.6, h.yTop - h.y, h.d + 1.6)); baseM.setMatrixAt(i, M); baseM.setColorAt(i, c.set('#c3c0b6'));
      M.compose(V.set(h.x, h.yTop - 0.05, h.z), Q, S.set(h.w, h.h, h.d)); bm.setMatrixAt(i, M); bm.setColorAt(i, c.set(h.wall));
      M.compose(V.set(h.x, h.yTop - 0.05 + h.h, h.z), Q, S.set(h.w + 1.3, 2.6, h.d + 1.3)); rm.setMatrixAt(i, M); rm.setColorAt(i, c.set(h.roof));
    });
    for (const im of [bm, rm, baseM]) { im.castShadow = false; im.receiveShadow = true; im.computeBoundingSphere(); root.add(im); }
    // school (校舎) — long white 3-storey building with a clock
    const sx = -262, sz = -305, sy = Math.min(terrainH(sx - 26, sz - 7), terrainH(sx + 26, sz + 7)) - 0.4;
    const sg = k.group([sx, sy, sz], 0.04); const ks = ctx.kit(sg);
    const sch = ctx.mat.toon('#f0eee7', { paint: 0.05 });
    ks.boxB(52, 12.4, 12, sch, [0, 0, 0]);
    ks.plane(51.6, 11.2, ctx.mat.toon('#ffffff', { map: tx.school, paint: 0.02 }), [0, 6.3, 6.02]);
    ks.boxB(52.6, 0.5, 12.6, ctx.mat.toon('#cfcac0'), [0, 12.4, 0]);
    ks.boxB(8, 3, 8, sch, [0, 12.9, 0]);
    ks.cyl(1.2, 1.2, 0.2, ctx.mat.toon('#fbfaf6'), [0, 14.4, 4.05], [Math.PI / 2, 0, 0], 16);
    drape(sx, -298, sx, -258, 30, ctx.mat.toon('#d3c09c', { map: tx.ground, paint: 0.06, name: 'env-schoolground' }), 5);
    
  }

  // ================================================================ trees on the hills (instanced blobs + cedar cones, painted distant shading)
  const hillTreeMat = distantMaterial(ctx, { mistY0: 0, mistY1: 26, mistAmt: 0.25, fogMul: 0.5, hazeK: 0.0008, hazeMax: 0.5, haze: '#c3d3e6' });
  {
    const blob0 = new THREE.IcosahedronGeometry(1, 0);
    { const pa = blob0.attributes.position, na = blob0.attributes.normal; for (let i = 0; i < pa.count; i++) { const l = Math.hypot(pa.getX(i), pa.getY(i), pa.getZ(i)); na.setXYZ(i, pa.getX(i) / l, pa.getY(i) / l, pa.getZ(i) / l); } }
    blob0.scale(1, 0.8, 1);
    const cone0 = new THREE.ConeGeometry(1, 1, 7, 1); cone0.translate(0, 0.5, 0);
    const blobs = [], cones = [];
    for (let i = 0; i < 2600 && blobs.length + cones.length < 640; i++) {
      const x = (r() - 0.5) * 1400, z = -300 - r() * 520;
      const m = hillMask(x, z); if (m < 0.5) continue;
      const h = terrainH(x, z);
      const n = fbm(x / 60, z / 60, 2, 301);
      if (n < 0.42) continue;
      const crest = terrainH(x, z) - (terrainH(x, z - 25) + terrainH(x, z + 25)) / 2; // >0 on ridges
      if (crest < -1.5 && r() < 0.6) continue;
      const cedar = fbm(x / 140, z / 140, 2, 302) > 0.55;
      if (!cedar && crest < 0.6) continue;
      const s = cedar ? 5 + r() * 5 : 4 + r() * 3;
      (cedar ? cones : blobs).push({ x, z, y: h, s, c: cedar ? r.pick(['#5b7d5e', '#557a5c', '#62836a']) : r.pick(['#739b64', '#6a9160', '#7ea56a', '#779f66']) });
    }
    const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), S = new THREE.Vector3(), c = new THREE.Color();
    const make = (geo, list, cone) => {
      const im = new THREE.InstancedMesh(geo, hillTreeMat, list.length);
      list.forEach((t, i) => {
        Q.setFromAxisAngle(V.set(0, 1, 0), r() * 6.28);
        if (cone) M.compose(V.set(t.x, t.y - 0.5, t.z), Q, S.set(t.s * 0.45, t.s * 2.2, t.s * 0.45));
        else M.compose(V.set(t.x, t.y + t.s * 0.35, t.z), Q, S.set(t.s, t.s, t.s));
        im.setMatrixAt(i, M); im.setColorAt(i, c.set(t.c));
      });
      im.castShadow = false; im.receiveShadow = false; im.computeBoundingSphere(); root.add(im);
    };
    make(blob0, blobs, false); make(cone0, cones, true);
  }

  // ================================================================ power pylons (lattice drawn with the wire system) + lines
  {
    const pylons = [[-650, -300], [-470, -286], [-290, -278], [-108, -274], [74, -276], [262, -281], [446, -290], [640, -312]];
    const branch = [[74, -276], [112, -410], [150, -545], [190, -690]];
    const steel = '#7f8994', wire = '#59606a';
    const built = new Map();
    const pylon = (x, z, rot) => {
      const key = x + ',' + z; if (built.has(key)) return built.get(key);
      const y = terrainH(x, z) - 0.2, H = 44;
      const c = Math.cos(rot), s = Math.sin(rot);
      const P = (lx, ly, lz) => [x + lx * c + lz * s, y + ly, z - lx * s + lz * c];
      const lv = [[0, 4.2], [13, 3.0], [26, 1.9], [33, 1.5], [38.5, 1.3], [H, 0.8]];
      const legs = [[1, 1], [1, -1], [-1, -1], [-1, 1]];
      for (const [sx, sz] of legs) ctx.wires.add(lv.map(([ly, hw]) => P(sx * hw, ly, sz * hw)), { width: 0.34, color: steel });
      for (let i = 0; i < lv.length; i++) {
        const [ly, hw] = lv[i];
        ctx.wires.add([...legs, legs[0]].map(([sx, sz]) => P(sx * hw, ly, sz * hw)), { width: 0.22, color: steel });
        if (i < lv.length - 1) {
          const [ly2, hw2] = lv[i + 1];
          for (let f = 0; f < 4; f++) {
            const [ax, az] = legs[f], [bx, bz] = legs[(f + 1) % 4];
            ctx.wires.add([P(ax * hw, ly, az * hw), P(bx * hw2, ly2, bz * hw2)], { width: 0.16, color: steel });
            ctx.wires.add([P(bx * hw, ly, bz * hw), P(ax * hw2, ly2, az * hw2)], { width: 0.16, color: steel });
          }
        }
      }
      const arms = [[26, 7.6], [33, 8.4], [38.5, 7.0]];
      const tips = [];
      for (const [ly, len] of arms) for (const sd of [-1, 1]) {
        const hw = lv.find((l) => l[0] === ly)[1];
        ctx.wires.add([P(sd * hw, ly, 0.9), P(sd * len, ly + 0.3, 0), P(sd * hw, ly, -0.9)], { width: 0.2, color: steel });
        ctx.wires.add([P(sd * hw, ly + 1.8, 0), P(sd * len, ly + 0.3, 0)], { width: 0.16, color: steel });
        const tip = P(sd * (len - 0.3), ly + 0.2, 0), ins = P(sd * (len - 0.3), ly - 2.4, 0);
        ctx.wires.add([tip, ins], { width: 0.12, color: '#c9cdd2' });
        tips.push(ins);
      }
      ctx.wires.add([P(0.8, H, 0.8), P(0, H + 3.2, 0), P(-0.8, H, -0.8)], { width: 0.18, color: steel });
      const res = { tips, peak: P(0, H + 3.1, 0) };
      built.set(key, res); return res;
    };
    const run = (pts) => {
      let prev = null;
      for (let i = 0; i < pts.length; i++) {
        const [x, z] = pts[i]; const [nx, nz] = pts[Math.min(i + 1, pts.length - 1)]; const [px, pz] = pts[Math.max(i - 1, 0)];
        const rot = Math.atan2(nx - px, nz - pz) + Math.PI / 2;
        const p = pylon(x, z, rot);
        if (prev) {
          const pairs = p.tips.map((tp, j) => [prev.tips[j], tp]);
          // match tips by distance (the arms may be mirrored between towers)
          for (let j = 0; j < 6; j++) {
            const a = prev.tips[j]; let best = p.tips[0], bd = 1e9;
            for (const b of p.tips) { const d = (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2; if (d < bd) { bd = d; best = b; } }
            const span = Math.sqrt(bd);
            ctx.wires.add(ctx.geo.catenary(a, best, span * 0.028, 18), { width: 0.045, color: wire });
          }
          ctx.wires.add(ctx.geo.catenary(prev.peak, p.peak, Math.hypot(prev.peak[0] - p.peak[0], prev.peak[2] - p.peak[2]) * 0.022, 18), { width: 0.035, color: wire });
          void pairs;
        }
        prev = p;
      }
    };
    run(pylons); run(branch);
    out.pylons = pylons;
  }

  // ================================================================ distant ridge rings (layered aerial perspective)
  const rings = [
    { ax: 745, azN: 705, azS: 760, H0: 48, H1: 150, W: 75, col: '#6f9483', col2: '#7c9d88', haze: '#b4c6dc', hazeMin: 0.06, crown: 15, crownAmt: 0.75, pink: 0.0, young: 0.35, dark: 0.45, seed: 401, mist: 0.22, fogMul: 0.36 },
    { ax: 900, azN: 880, azS: 905, H0: 70, H1: 230, W: 95, col: '#7d97b2', col2: '#86a0b9', haze: '#aabfd8', hazeMin: 0.12, crown: 24, crownAmt: 0.35, pink: 0.0, young: 0.15, dark: 0.25, seed: 402, mist: 0.18, fogMul: 0.3 },
    { ax: 1120, azN: 1140, azS: 1130, H0: 95, H1: 330, W: 130, col: '#94a8c8', col2: '#9aadcc', haze: '#adbfdb', hazeMin: 0.2, crown: 30, crownAmt: 0.0, pink: 0.0, young: 0.0, dark: 0.0, seed: 403, mist: 0.15, fogMul: 0.26 },
  ];
  const clampW = (x, z) => [clamp(x, W.x0, W.x1), clamp(z, W.z0, W.z1)];
  for (const R of rings) {
    const K = Math.round(Math.PI * 2 * R.ax / R.crown);
    const mat = distantMaterial(ctx, { arc: true, wrap: K, vertexColors: true, crown: R.crown, crownAmt: R.crownAmt, pinkAmt: R.pink, youngAmt: R.young, darkAmt: R.dark, patch: 160, haze: R.haze, hazeMin: R.hazeMin, hazeMax: 0.72, hazeK: 0.0009, mist: '#dfe8f2', mistY0: 0, mistY1: 60 + R.H0, mistAmt: R.mist, fogMul: R.fogMul, rim: 1 });
    const N = 420, rowsF = [-1, -0.62, -0.3, -0.08, 0.1, 0.45, 1];
    const shape = [-0.18, 0.3, 0.72, 0.97, 1.0, 0.7, 0.15];
    const pos = [], col = [], idx = [], uv = [], tan = [];
    const cA = lin(THREE, R.col), cB = lin(THREE, R.col2);
    for (let i = 0; i <= N; i++) {
      const th = i / N * Math.PI * 2;
      const dx = Math.sin(th), dz = -Math.cos(th);
      const az = dz < 0 ? R.azN : R.azS;
      const Rr = 1 / Math.pow(Math.pow(Math.abs(dx) / R.ax, 4) + Math.pow(Math.abs(dz) / az, 4), 0.25);
      const nb = smoothstep(0.0, 0.85, (1 + Math.cos(th)) / 2);
      const s = th * Rr;
      const ux = dx * Rr, uz = dz * Rr; void s;
      const peaks = 0.42 + 0.58 * (0.55 * fbm(ux / 300, uz / 300, 3, R.seed + 3) + 0.45 * ridged(ux / 340, uz / 340, 3, R.seed));
      const Hc = lerp(R.H0, R.H1, nb) * peaks * (0.8 + 0.4 * fbm(ux / 700, uz / 700, 2, R.seed + 1));
      for (let j = 0; j < rowsF.length; j++) {
        const f = rowsF[j];
        const spur = (j >= 1 && j <= 3) ? (fbm(ux / 55 + j * 37, uz / 55, 3, R.seed + 5) - 0.5) : 0;
        const off = R.W * f + spur * R.W * 0.5;
        const x = dx * (Rr + off), z = dz * (Rr + off);
        const [bx, bz] = clampW(x, z);
        const base = terrainH(bx, bz) - 6;
        const y = base + Hc * shape[j] * (1 + spur * 0.5) + (j === 0 ? -8 : 0);
        pos.push(x, y, z);
        uv.push(th / (Math.PI * 2) * K * R.crown, y);
        tan.push(Math.cos(th), 0, Math.sin(th));
        const cc = mix3(cA, cB, fbm(ux / 180, uz / 180 + j, 2, R.seed + 9)); col.push(cc[0], cc[1], cc[2]);
      }
      if (i) {
        const nr = rowsF.length, a = (i - 1) * nr, b = i * nr;
        for (let j = 0; j < nr - 1; j++) idx.push(a + j, b + j, a + j + 1, a + j + 1, b + j, b + j + 1);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setAttribute('aTan', new THREE.Float32BufferAttribute(tan, 3));
    g.setIndex(idx); g.computeVertexNormals();
    // the town-facing slope (row 1 of the north column) must face the town (+z there)
    if (g.attributes.normal.getZ(1) < 0) {
      for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; }
      g.setIndex(idx); g.computeVertexNormals();
    }
    g.computeBoundingSphere();
    const m = new THREE.Mesh(g, mat); m.name = 'env-ring'; m.frustumCulled = false;
    mat.side = THREE.DoubleSide;
    ctx.noBatch(m); root.add(m);
  }

  out.shrine = shrine; out.farms = farms;
  return out;
}
