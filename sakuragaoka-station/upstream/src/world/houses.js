// 住宅街 — houses module: every residential lot on the main street (W3, W5, W7–W13, E4, E7–E13),
// the residential blocks (NW, NE, SWB, SEB, N1W/N1E/N2W/N2E) with their own lanes, an apartment,
// fields and the low-detail far town. Publishes ctx.services.houses = { gardenSpots, bikeSpots, wallTops }.
import * as THREE from 'three';
import { GB, Frame, slab, poly } from './houses/gb.js';
import { makeHouseTextures, makeHouseMaterials } from './houses/tex.js';
import { makeProps, blobRaw } from './houses/props.js';
import { Laundry } from './houses/laundry.js';
import { buildLot, boundarySeg, boundarySegZ, PAL } from './houses/lot.js';
import { buildApartment } from './houses/apartment.js';
import { buildFarTown } from './houses/far.js';
import { buildHouse } from './houses/house.js';
import { foliageMaterial } from './lib/foliage.js';

export async function build(ctx) {
  const L = ctx.L;
  const tex = makeHouseTextures(ctx);
  const M = makeHouseMaterials(ctx, tex);
  M.foliage = foliageMaterial(ctx); // smooth shrubs / hedges / tree clouds (vertex colours + leaf-clump shading)
  M.meshFence = ctx.mat.decal('#ffffff', { map: tex.decal.texture, vertexColors: true, transparent: true, side: 'double' });
  const root = new THREE.Group(); root.name = 'houses'; ctx.addStatic(root);
  const gb = new GB(ctx);
  const H = { ctx, L, M, tex, A: tex.atlas, gb, slab, poly, blobRaw, lod: 2 };
  H.antennaAz = Math.atan2(-0.62, -0.78) + Math.PI / 2; // Yagi booms point toward the NW transmitter
  H.dishAz = 0.7;  // BS dishes face south-west
  H.P = H.props = makeProps(H);
  H.laundry = new Laundry(H);
  H.bnd = { boundarySeg, boundarySegZ };
  const phys = ctx.physics;

  // ------------------------------------------------------------------ helpers
  H.gy = (fr, x, z) => { const p = fr.w(x, 0, z); return L.heightAt(p.x, p.z) - p.y; };
  H.col = (fr, x, z, w, d, ry, y0, y1) => { const p = fr.w(x, 0, z); phys.addBox(p.x, p.z, w, d, fr.ry + ry, p.y + y0, p.y + y1); };
  H.colC = (fr, x, z, rad, y0, y1) => { const p = fr.w(x, 0, z); phys.addCylinder(p.x, p.z, rad, p.y + y0, p.y + y1); };
  H.walk = (fr, x, z, w, d, ry, top, bottom) => { const p = fr.w(x, 0, z); phys.addWalkBox(p.x, p.z, w, d, fr.ry + ry, p.y + top, bottom !== undefined ? p.y + bottom : p.y + top - 0.6); };
  const quadsMesh = (fr, mat, col, quads, fl) => {
    const P = [], N = [], U = [], I = [];
    for (const q of quads) {
      const k = P.length / 3;
      for (let i = 0; i < 4; i++) { P.push(...q.p[i]); N.push(...q.n); U.push(...(q.uv ? q.uv[i] : [0, 0])); }
      const a = q.p[0], b = q.p[1], c = q.p[2];
      const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
      const cx = e1[1] * e2[2] - e1[2] * e2[1], cy = e1[2] * e2[0] - e1[0] * e2[2], cz = e1[0] * e2[1] - e1[1] * e2[0];
      if (cx * q.n[0] + cy * q.n[1] + cz * q.n[2] >= 0) I.push(k, k + 1, k + 2, k, k + 2, k + 3); else I.push(k, k + 2, k + 1, k, k + 3, k + 2);
    }
    if (quads.length) gb.mesh(mat, col, P, N, U, I, fr.M(0, 0, 0), fl);
  };
  H.quads = quadsMesh;
  /** wall along local x (a..b) at z whose top follows the ground (+h); bottom at ground-0.3 or ground+base */
  H.slopedWall = (fr, a, b, z, h, t, mat, col, uS, vS, base) => {
    const L2 = b - a; if (L2 <= 0.01) return;
    const n = Math.max(1, Math.ceil(L2 / 2.5));
    const quads = [];
    const z0 = z - t / 2, z1 = z + t / 2;
    for (let i = 0; i < n; i++) {
      const x0 = a + L2 * i / n, x1 = a + L2 * (i + 1) / n;
      const g0 = H.gy(fr, x0, z), g1 = H.gy(fr, x1, z);
      const bo = base === undefined ? -0.3 : base;
      const b0 = g0 + bo, b1 = g1 + bo, t0 = g0 + h, t1 = g1 + h;
      const uv = (x, dy) => (uS ? [x / uS, dy / vS] : [0.5, 0.5]);
      quads.push({ p: [[x0, b0, z1], [x1, b1, z1], [x1, t1, z1], [x0, t0, z1]], n: [0, 0, 1], uv: [uv(x0, bo), uv(x1, bo), uv(x1, h), uv(x0, h)] });
      quads.push({ p: [[x1, b1, z0], [x0, b0, z0], [x0, t0, z0], [x1, t1, z0]], n: [0, 0, -1], uv: [uv(-x1, bo), uv(-x0, bo), uv(-x0, h), uv(-x1, h)] });
      quads.push({ p: [[x0, t0, z1], [x1, t1, z1], [x1, t1, z0], [x0, t0, z0]], n: [0, 1, 0], uv: [uv(x0, 0), uv(x1, 0), uv(x1, t), uv(x0, t)] });
      if (i === 0) quads.push({ p: [[x0, b0, z0], [x0, b0, z1], [x0, t0, z1], [x0, t0, z0]], n: [-1, 0, 0], uv: [uv(0, bo), uv(t, bo), uv(t, h), uv(0, h)] });
      if (i === n - 1) quads.push({ p: [[x1, b1, z1], [x1, b1, z0], [x1, t1, z0], [x1, t1, z1]], n: [1, 0, 0], uv: [uv(0, bo), uv(t, bo), uv(t, h), uv(0, h)] });
    }
    quadsMesh(fr, mat, col, quads);
  };
  /** terrain-following ground cover rectangle in frame-local coords; world-space UVs (uvS m per repeat) */
  H.groundRect = (fr, x0, z0, x1, z1, mat, col, lift = 0.02, uvS = 2) => {
    if (x1 - x0 < 0.05 || z1 - z0 < 0.05) return;
    const nx = Math.max(1, Math.ceil((x1 - x0) / 2.2)), nz = Math.max(1, Math.ceil((z1 - z0) / 2.2));
    const P = [], N = [], U = [], I = [];
    for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
      const x = x0 + (x1 - x0) * i / nx, z = z0 + (z1 - z0) * j / nz;
      const w = fr.w(x, 0, z);
      P.push(x, L.heightAt(w.x, w.z) - w.y + lift, z); N.push(0, 1, 0); U.push(w.x / uvS, -w.z / uvS);
    }
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 1, d = c + 1; I.push(a, c, b, b, c, d); }
    gb.mesh(mat, col, P, N, U, I, fr.M(0, 0, 0), { shadow: false });
  };
  /** decal quad (moss / streak / crack / dirt / stain) facing +z of fr, or on the floor */
  H.decal = (fr, name, x, y, w, h, z, col, o = {}) => {
    const rc = tex.decal.rects[name]; if (!rc) return;
    const uv = [[rc[0], rc[1]], [rc[2], rc[1]], [rc[2], rc[3]], [rc[0], rc[3]]];
    if (o.floor) {
      const zz = o.z, g = (xx, zv) => (o.gy ? o.gy(xx, zv) : H.gy(fr, xx, zv)) + 0.066;
      quadsMesh(fr, M.decal, col, [{ p: [[x - w / 2, g(x - w / 2, zz + h / 2), zz + h / 2], [x + w / 2, g(x + w / 2, zz + h / 2), zz + h / 2], [x + w / 2, g(x + w / 2, zz - h / 2), zz - h / 2], [x - w / 2, g(x - w / 2, zz - h / 2), zz - h / 2]], n: [0, 1, 0], uv }], { shadow: false, noOutline: true });
      return;
    }
    quadsMesh(fr, M.decal, col, [{ p: [[x - w / 2, y - h / 2, z], [x + w / 2, y - h / 2, z], [x + w / 2, y + h / 2, z], [x - w / 2, y + h / 2, z]], n: [0, 0, 1], uv }], { shadow: false, noOutline: true });
  };
  /** see-through wire mesh panel between a..b at z (alpha) */
  H.meshPanel = (fr, a, b, z, y0, y1, col) => {
    const rc = tex.decal.rects.mesh;
    const n = Math.max(1, Math.round((b - a) / 1.0));
    const quads = [];
    for (let i = 0; i < n; i++) {
      const x0 = a + (b - a) * i / n, x1 = a + (b - a) * (i + 1) / n;
      const g0 = H.gy(fr, x0, z), g1 = H.gy(fr, x1, z);
      const rep = (y1 - y0) / (x1 - x0);
      quads.push({ p: [[x0, g0 + y0, z], [x1, g1 + y0, z], [x1, g1 + y1, z], [x0, g0 + y1, z]], n: [0, 0, 1], uv: [[rc[0], rc[1]], [rc[2], rc[1]], [rc[2], rc[3]], [rc[0], rc[3]]] });
    }
    quadsMesh(fr, M.meshFence, col, quads, { shadow: false, noOutline: true });
  };
  /** asphalt / gravel strip along a world polyline (x,z) with half width */
  H.strip = (pts, hw, mat, col, lift = 0.018, uvS = 4) => {
    const P = [], N = [], U = [], I = [];
    // resample every ~2 m
    const rs = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
      const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 2));
      for (let k = 0; k < n; k++) rs.push([ax + (bx - ax) * k / n, az + (bz - az) * k / n]);
    }
    rs.push(pts[pts.length - 1]);
    let dist = 0;
    for (let i = 0; i < rs.length; i++) {
      const p = rs[i], q = rs[Math.min(rs.length - 1, i + 1)], o = rs[Math.max(0, i - 1)];
      let tx = q[0] - o[0], tz = q[1] - o[1]; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
      const nx = -tz, nz = tx;
      if (i > 0) dist += Math.hypot(p[0] - rs[i - 1][0], p[1] - rs[i - 1][1]);
      for (const s of [-1, 1]) {
        const x = p[0] + nx * hw * s, z = p[1] + nz * hw * s;
        P.push(x, L.heightAt(x, z) + lift, z); N.push(0, 1, 0); U.push(x / uvS, -z / uvS);
      }
      if (i > 0) { const k = (i - 1) * 2; I.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
    }
    // fix winding: make sure triangles face up
    for (let i = 0; i < I.length; i += 3) {
      const a = I[i], b = I[i + 1], c = I[i + 2];
      const e1x = P[b * 3] - P[a * 3], e1z = P[b * 3 + 2] - P[a * 3 + 2], e2x = P[c * 3] - P[a * 3], e2z = P[c * 3 + 2] - P[a * 3 + 2];
      if (e1z * e2x - e1x * e2z < 0) { I[i + 1] = c; I[i + 2] = b; }
    }
    gb.mesh(mat, col, P, N, U, I, new THREE.Matrix4(), { shadow: false });
  };
  // geometry accumulates across the whole module and is emitted once per material at the end: a few
  // large meshes (core batching leaves >60 m meshes whole) instead of hundreds of 40 m cells -> far fewer draw calls.
  const flush = () => {};

  const services = { gardenSpots: [], bikeSpots: [], wallTops: [] };
  const collect = (res, pri = 1) => {
    if (!res) return;
    for (const s of res.gardenSpots || []) services.gardenSpots.push({ ...s, pri });
    for (const s of res.bikeSpots || []) services.bikeSpots.push({ ...s, pri });
    for (const s of res.wallTops || []) services.wallTops.push({ ...s, pri });
  };

  // ================================================================== main street lots
  const houseLots = new Set(L.LOTS.filter(l => l.owner === 'houses').map(l => l.id));
  const PLAN = {
    W5: { layout: 'yard', frontStyle: 'hedge', gardenSpot: true, floors: 2 },
    W7: { layout: 'sidePark', floors: 3, roofType: 'shed' },
    W8: { layout: 'yard', traditional: true, frontStyle: 'block', gardenSpot: true },
    W9: { layout: 'frontPark', floors: 2 },
    W10: { layout: 'yard', frontStyle: 'fence', floors: 2, gardenSpot: true },
    W11: { layout: 'sidePark', floors: 2 },
    W12: { layout: 'yard', frontStyle: 'plasterWall', floors: 2, koinobori: true },
    W13: { layout: 'sidePark', floors: 2, gardenSpot: false },
    E4: { layout: 'yard', frontStyle: 'block', floors: 2, gardenSpot: true },
    E7: { layout: 'frontPark', floors: 2 },
    E8: { layout: 'yard', frontStyle: 'hedge', floors: 2, gardenSpot: true },
    E9: { layout: 'sidePark', floors: 3 },
    E10: { layout: 'yard', traditional: true, frontStyle: 'plasterWall', gardenSpot: true },
    E11: { layout: 'sidePark', floors: 2 },
    E12: { layout: 'yard', frontStyle: 'lattice', floors: 2 },
    E13: { layout: 'frontPark', floors: 2 },
  };
  const idx = (id) => L.LOTS.findIndex(l => l.id === id);
  for (const lot of L.LOTS) {
    if (lot.owner !== 'houses') continue;
    const f = L.lotFrame(lot);
    const F = Frame.at(gb, f.x, f.y, f.z, f.rotY);
    if (lot.id === 'W3') { collect(buildW3(H, F, f), 3); flush('houses-W3'); continue; }
    // right neighbour (+lx): W lots -> north (previous index), E lots -> south (next index)
    const i = idx(lot.id);
    const rightN = lot.side < 0 ? L.LOTS[i - 1] : L.LOTS[i + 1];
    const rightIsHouse = rightN && rightN.side === lot.side && houseLots.has(rightN.id) && rightN.id !== 'W3';
    const plan = PLAN[lot.id] || {};
    const res = buildLot(H, { F, w: f.w, depth: f.depth, seed: 'main-' + lot.id, lod: 2, walls: { left: true, right: !rightIsHouse, back: true }, ...plan, antennaP: 0.7, balconyP: 0.85, laundryP: 0.75 });
    if (plan.koinobori) { const p = res.houseRect; const kx = p.hx1 + 0.55 > f.w / 2 - 0.3 ? p.hx0 - 0.6 : p.hx1 + 0.55; H.laundry.koinobori(F, kx, H.gy(F, kx, -2.0), -2.0, 7.2); H.colC(F, kx, -2.0, 0.08, -1, 8); }
    collect(res, 3);
    flush('houses-' + lot.id);
  }

  // ================================================================== residential blocks
  const rowS = (id, xa, xb, zf, depth, o = {}) => { // lots facing south along z = zf, spanning x a..b
    const r = ctx.rng('row-' + id);
    const out = [];
    let x = xa;
    let k = 0;
    const widths = [];
    while (x < xb - 7.5) { let w = o.w ? o.w : 9 + r() * 2.4; if (xb - (x + w) < 7.5) w = xb - x; widths.push([x, w]); x += w; }
    for (const [x0, w] of widths) {
      const cx = x0 + w / 2;
      const F = Frame.at(gb, cx, L.heightAt(cx, zf), zf, 0);
      out.push({ F, w, depth, id: id + '-' + (k++), cx });
    }
    return out;
  };
  const rowE = (id, xf, za, zb, depth, face = 1, o = {}) => { // lots facing east (face=1) or west (-1) along x = xf, spanning z a..b
    const r = ctx.rng('rowE-' + id);
    const out = [];
    let z = za, k = 0;
    while (z < zb - 7.5) {
      let w = 9.2 + r() * 2.0; if (zb - (z + w) < 7.5) w = zb - z;
      const cz = z + w / 2;
      const xx = typeof xf === 'function' ? xf(cz) : xf;
      const ry = face > 0 ? Math.PI / 2 : -Math.PI / 2;
      const F = Frame.at(gb, xx, L.heightAt(xx, cz), cz, ry + (o.slope ? o.slope(cz) : 0));
      out.push({ F, w, depth, id: id + '-' + (k++), cz });
      z += w;
    }
    return out;
  };
  const doRow = (lots, o = {}) => {
    lots.forEach((d, i) => {
      if (o.skip && o.skip(d, i)) return;
      const res = buildLot(H, {
        F: d.F, w: d.w, depth: d.depth, seed: d.id, lod: o.lod ?? 1,
        walls: { left: true, right: i === lots.length - 1 || (o.skip && o.skip(lots[i + 1], i + 1)), back: o.back !== false },
        gardenSpot: o.gardenSpot ? o.gardenSpot(d, i) : false,
        traditional: o.trad ? o.trad(d, i) : false,
        ...(o.per ? o.per(d, i) : {}),
      });
      collect(res, o.pri ?? 1);
      if (o.after) o.after(d, i, res);
      flush('houses-' + d.id);
    });
  };

  // --- NW block (south of the tracks, west of R2)
  doRow(rowS('NWs', -62, -15.7, -5.8, 11.2), { lod: 2, pri: 2, gardenSpot: (d, i) => i === 1 || i === 3, trad: (d, i) => i === 2 });
  // lane between the rows
  H.strip([[-14.9, -18.6], [-62.5, -18.6]], 1.5, M.asphalt, '#8a8c90', 0.018, 4);
  const nwN = rowS('NWn', -62, -24.5, -20.1, 10.8);
  doRow(nwN, { lod: 2, pri: 2, per: (d, i) => ({ floors: i === nwN.length - 1 ? 2 : undefined }), gardenSpot: (d, i) => i === 0 });
  // NW corner by R2 / V5: small garden with a sakura spot, low hedge, bench-free
  {
    const F = Frame.at(gb, -21.0, 0, -25.5, 0);
    H.groundRect(F, -3.4, -5.4, 3.35, 5.3, M.lawn, '#b9cf98', 0.02, 2);
    boundarySeg(H, F, -3.4, 3.35, 5.25, 'low', 0.4, '#c9c7c0', ctx.rng('nwc'), (x, z) => H.gy(F, x, z), 2, null, true);
    boundarySegZ(H, F, 3.35, 5.0, -3.0, 'hedge', 1.0, '#c9c7c0', ctx.rng('nwc2'), (x, z) => H.gy(F, x, z));
    H.P.bush(F, -2.2, H.gy(F, -2.2, -3.8), -3.8, 0.5, ctx.rng('nwc3'), { pal: 'green', flowers: 'azalea' });
    H.P.bush(F, 1.8, H.gy(F, 1.8, -4.4), -4.4, 0.45, ctx.rng('nwc4'), { pal: 'dark' });
    services.gardenSpots.push({ x: -20.6, z: -26.2, r: 2.0, pri: 3 });
    flush('houses-NWcorner');
  }

  // --- NE block (east of the plaza)
  {
    // corner plot (disaster cabinet stays at (29.5,-7.2)): gravel + shrubs + a sakura spot
    const F = Frame.at(gb, 29.6, 0, -11.4, 0);
    H.groundRect(F, -2.5, -5.6, 2.5, 5.5, M.gravel, '#d6d0c4', 0.02, 1.5);
    H.groundRect(F, -2.2, -5.3, 2.2, -1.6, M.lawn, '#b9cf98', 0.03, 2);
    boundarySegZ(H, F, 2.45, 5.4, -5.6, 'mesh', 1.1, '#c9c7c0', ctx.rng('nec'), (x, z) => H.gy(F, x, z));
    H.P.bush(F, -1.8, 0, 1.2, 0.4, ctx.rng('nec2'), { pal: 'green', flowers: 'azalea' });
    H.P.bush(F, 1.7, 0, 0.5, 0.35, ctx.rng('nec3'), { pal: 'dark' });
    services.gardenSpots.push({ x: 29.5, z: -14.8, r: 1.8, pri: 3 });
    flush('houses-NEcorner');
  }
  doRow(rowS('NEs', 32.2, 62, -5.8, 11.2), { lod: 2, pri: 2, gardenSpot: (d, i) => i === 1 });
  H.strip([[26.05, -18.6], [62.5, -18.6]], 1.5, M.asphalt, '#8a8c90', 0.018, 4);
  {
    const w = 17.0, cx = 27.2 + w / 2;
    const F = Frame.at(gb, cx, L.heightAt(cx, -20.1), -20.1, 0);
    collect(buildApartment(H, F, w, 10.8, ctx.rng('apt')), 2);
    flush('houses-apartment');
  }
  doRow(rowS('NEn', 44.4, 62, -20.1, 10.8), { lod: 2, pri: 2 });

  // --- north residential rows
  const n1w = rowS('N1W', -85, -15.7, -57.9, 10.9);
  doRow(n1w, { lod: 1, pri: 1, gardenSpot: (d, i) => i === 2 || i === 5, trad: (d, i) => i === 4 });
  const n1e = rowS('N1E', -7.4, 85, -57.9, 10.9);
  doRow(n1e, { lod: 2, pri: 2, gardenSpot: (d, i) => i === 1 || i === 4 || i === 7, trad: (d, i) => i === 3, after: (d, i, res) => { if (i === 5) { const p = res.houseRect; H.laundry.koinobori(d.F, p.hx1 + 0.6 < d.w / 2 - 0.3 ? p.hx1 + 0.6 : p.hx0 - 0.6, 0, -1.8, 7.0); } } });
  const n2w = rowS('N2W', -85, -15.7, -72.7, 10.8);
  doRow(n2w, { lod: 1, pri: 1, gardenSpot: (d, i) => i === 3, trad: (d, i) => i === 1 || i === 5, back: true, per: () => ({ backStyle: 'block', backH: 1.1 }) });
  const n2e = rowS('N2E', -8.5, 85, -72.7, 10.8);
  doRow(n2e, { lod: 1, pri: 1, gardenSpot: (d, i) => i === 2 || i === 6, trad: (d, i) => i === 4 || i === 8, per: () => ({ backStyle: 'block', backH: 1.1 }) });

  // --- SWB / SEB back blocks: lane A behind the main-street lots, lane B further out, connectors
  const cX = L.streetCenterX;
  const laneA = (s) => { const pts = []; for (let z = 1.05; z <= 128.01; z += 3) pts.push([cX(z) + s * 20.6, z]); return pts; };
  H.strip(laneA(-1), 1.7, M.asphalt, '#8a8c90', 0.018, 4);
  H.strip(laneA(1), 1.7, M.asphalt, '#8a8c90', 0.018, 4);
  H.strip([[-43.5, 1.05], [-43.5, 128]], 1.5, M.asphalt, '#8d8f93', 0.018, 4);
  H.strip([[43.5, 1.05], [43.5, 128]], 1.5, M.asphalt, '#8d8f93', 0.018, 4);
  for (const zc of [46, 96]) {
    H.strip([[cX(zc) - 22.2, zc], [-42.0, zc]], 1.5, M.asphalt, '#8d8f93', 0.02, 4);
    H.strip([[cX(zc) + 22.2, zc], [42.0, zc]], 1.5, M.asphalt, '#8d8f93', 0.02, 4);
  }
  flush('houses-lanes');
  const segsA = [[3.0, 44.4], [47.6, 94.4], [97.6, 128]];
  for (const side of [-1, 1]) {
    const tag = side < 0 ? 'SWB' : 'SEB';
    for (let s = 0; s < segsA.length; s++) {
      const [za, zb] = segsA[s];
      const lots = rowE(tag + 'A' + s, (z) => cX(z) + side * 22.3, za, zb, 12, -side, { slope: (z) => -Math.atan(L.streetSlopeX(z)) * 0 });
      // orient with the curve: use streetFrame rotation
      for (const d of lots) { const f = L.streetFrame(d.cz, side, 22.3); d.F = Frame.at(gb, f.x, f.y, f.z, f.rotY); }
      doRow(lots, { lod: 1, pri: 1, gardenSpot: (d, i) => (i + s) % 3 === 1, trad: (d, i) => (i + s * 2) % 4 === 2 });
    }
    // lane B row (outer): fewer houses, fields in between
    const lotsB = rowE(tag + 'B', side * 45.0, 3.0, 128, 13.5, -side);
    doRow(lotsB, { lod: 1, pri: 0, skip: (d, i) => d && (i === 3 || i === 8), gardenSpot: (d, i) => i === 5 || i === 10, trad: (d, i) => i % 4 === 1 });
    // fields & vacant plots between row A backs and lane B (and the skipped B lots)
    const r = ctx.rng('fields-' + tag);
    for (let z = 3.2; z < 127; ) {
      const len = 12 + r() * 12;
      const z1 = Math.min(127.5, z + len);
      if (Math.abs((z + z1) / 2 - 46) < len / 2 + 1.6 || Math.abs((z + z1) / 2 - 96) < len / 2 + 1.6) { z = z1 + 0.1; continue; }
      const xa = side < 0 ? -42.1 : cX(z) + 34.4, xb = side < 0 ? cX(z1) - 34.4 : 42.1;
      if (xb - xa > 3) plot(H, r, xa, xb, z + 0.2, z1 - 0.2, r() < 0.45 ? 'field' : r() < 0.5 ? 'parking' : 'vacant');
      z = z1 + 0.1;
    }
    for (const i of [3, 8]) { const d = lotsB[i]; if (!d) continue; const cz = d.cz; plot(H, r, side < 0 ? -58.4 : 45.2, side < 0 ? -45.2 : 58.4, cz - d.w / 2 + 0.2, cz + d.w / 2 - 0.2, i === 3 ? 'field' : 'parking'); }
    flush('houses-fields-' + tag);
  }

  // ================================================================== far town
  gb.flush(root, 'houses');
  const far = buildFarTown(H);

  // ================================================================== laundry (dynamic, swaying)
  H.laundry.build();

  // ================================================================== services
  const sortPick = (arr, n) => arr.sort((a, b) => b.pri - a.pri).slice(0, n).map(({ pri, ...s }) => s);
  // spread bike spots: keep high priority first, then every other
  const pub = {
    gardenSpots: sortPick(services.gardenSpots, 25),
    bikeSpots: sortPick(services.bikeSpots, 25),
    wallTops: sortPick(services.wallTops, 60),
  };
  ctx.services.houses = pub;
  ctx.__housesStats = { far: far.count, laundry: H.laundry.count };
}

// ====================================================================================
//  Special fields / vacant plots
// ====================================================================================
function plot(H, r, x0, x1, z0, z1, kind) {
  const { M, P, L } = H;
  const F = Frame.at(H.gb, 0, 0, 0, 0);
  if (kind === 'field') { // 畑: soil with green rows, a few stakes and a small shed
    H.groundRect(F, x0, z0, x1, z1, M.soil, '#c9b89c', 0.02, 1.5);
    const along = (x1 - x0) > (z1 - z0);
    const n = Math.floor(((along ? z1 - z0 : x1 - x0) - 1) / 0.9);
    for (let i = 0; i < n; i++) {
      const t = 0.6 + i * 0.9;
      const col = r.pick(['#8fb86f', '#7aa564', '#a9c77c', '#6f9a5a']);
      const leafy = r() < 0.7;
      if (along) { const zz = z0 + t; H.groundRect(F, x0 + 0.5, zz - 0.18, x1 - 0.5, zz + 0.18, M.soil, '#b5a283', 0.05, 1.5); if (leafy) for (let x = x0 + 0.8; x < x1 - 0.6; x += 0.8 + r() * 0.3) F.raw(M.plain, col, H.blobRaw(Math.floor(r() * 6), 0), x, L.heightAt(x, zz) + 0.12, zz, { sx: 0.5, sy: 0.22, sz: 0.36 }); }
      else { const xx = x0 + t; H.groundRect(F, xx - 0.18, z0 + 0.5, xx + 0.18, z1 - 0.5, M.soil, '#b5a283', 0.05, 1.5); if (leafy) for (let z = z0 + 0.8; z < z1 - 0.6; z += 0.8 + r() * 0.3) F.raw(M.plain, col, H.blobRaw(Math.floor(r() * 6), 0), xx, L.heightAt(xx, z) + 0.12, z, { sx: 0.36, sy: 0.22, sz: 0.5 }); }
    }
    // low mesh fence on the lane side + a small shed & hose
    const sx = (x0 + x1) / 2, sz = z1 - 1.0;
    if (r() < 0.6) { P.shed(F.sub(x1 - 1.2, 0, z0 + 0.8, 0), 0, L.heightAt(x1 - 1.2, z0 + 0.8), 0, r, 1.4); H.col(F, x1 - 1.2, z0 + 0.8, 1.6, 1.0, 0, -1, L.heightAt(x1 - 1.2, z0 + 0.8) + 2); }
    if (r() < 0.5) { // greenhouse (ビニールハウス) tunnel
      const gx = x0 + 2.5, gz0 = z0 + 1, gz1 = Math.min(z1 - 1, z0 + 7);
      const g = L.heightAt(gx, (gz0 + gz1) / 2);
      F.cyl(M.poly, null, 1.3, gz1 - gz0, gx, g, (gz0 + gz1) / 2, { rx: Math.PI / 2, seg: 10, open: true, noOutline: true, shadow: false });
      for (let z = gz0; z <= gz1 + 0.01; z += 1.2) F.cyl(M.plain, '#c9ccd1', 1.31, 0.03, gx, g, z, { rx: Math.PI / 2, seg: 10, open: true });
    }
    for (let k = 0; k < 4; k++) { const x = x0 + 1 + r() * (x1 - x0 - 2), z = z0 + 1 + r() * (z1 - z0 - 2); F.boxB(M.plain, '#b48a62', 0.03, 0.9, 0.03, x, L.heightAt(x, z), z); }
  } else if (kind === 'parking') { // 月極駐車場 (gravel, rope lines, sign)
    H.groundRect(F, x0, z0, x1, z1, M.gravel, '#cfc9bd', 0.025, 1.5);
    const along = (x1 - x0) > (z1 - z0);
    const n = Math.floor((along ? x1 - x0 : z1 - z0) / 2.6);
    for (let i = 0; i <= n; i++) {
      if (along) { const x = x0 + i * (x1 - x0) / n; H.groundRect(F, x - 0.05, z0 + 0.3, x + 0.05, z0 + 4.8, M.plain, '#ece8df', 0.035, 1); }
      else { const z = z0 + i * (z1 - z0) / n; H.groundRect(F, x0 + 0.3, z - 0.05, x0 + 4.8, z + 0.05, M.plain, '#ece8df', 0.035, 1); }
    }
    const px = x0 + 0.4, pz = z1 - 0.4, g = L.heightAt(px, pz);
    F.boxB(M.plain, '#8e949b', 0.06, 1.3, 0.06, px, g, pz);
    F.box(M.atlas, '#ffffff', 0.7, 0.26, 0.03, px, g + 1.3, pz + 0.04, { uv: { rect: H.A.rects.kotatsu_sign, white: H.A.white } });
    for (let k = 0; k < 3; k++) { const x = x0 + 1.5 + r() * (x1 - x0 - 3), z = z0 + 1 + r() * (z1 - z0 - 2); F.boxB(M.concrete, '#b9b8b2', 0.6, 0.12, 0.15, x, L.heightAt(x, z), z, { uv: { world: 2 } }); }
  } else { // vacant lot with weeds and a couple of bushes
    H.groundRect(F, x0, z0, x1, z1, M.lawn, '#b4c98f', 0.02, 2);
    for (let k = 0; k < 8; k++) { const x = x0 + 0.8 + r() * (x1 - x0 - 1.6), z = z0 + 0.8 + r() * (z1 - z0 - 1.6); P.bush(F, x, L.heightAt(x, z) - 0.05, z, 0.25 + r() * 0.3, r, { pal: 'young', n: 2, flowers: r() < 0.4 ? 'flowers' : null, fn: 4 }); }
    if (r() < 0.5) { const x = (x0 + x1) / 2, z = (z0 + z1) / 2; P.tree(F, x, L.heightAt(x, z), z, 1.3, r, 'round'); H.colC(F, x, z, 0.15, -1, 5); }
  }
}

// ====================================================================================
//  W3 — the hero garden house (white cat on the wall, garden sakura leaning over the street)
// ====================================================================================
function buildW3(H, F, f) {
  const { ctx, L, M, P } = H;
  const r = ctx.rng('W3');
  const SP = L.SPOTS.w3Wall;
  const gy = (x, z) => H.gy(F, x, z);
  const res = { gardenSpots: [], bikeSpots: [], wallTops: [] };
  const W = f.w, Dp = f.depth;
  const wz = SP.lz, wh = SP.h, wt = 0.22;
  // --- frontage wall: plaster over a stone base, dark flat coping; gate opening at lx -1.8..-0.8
  const segs = [[SP.lx0, -2.1], [-0.5, SP.lx1]];
  const wallC = '#e6dccb', baseC = '#b9b19c', capC = '#6f6b67';
  for (const [a, b] of segs) {
    H.slopedWall(F, a, b, wz, wh - 0.06, wt, M.plaster, wallC, 3, 3);
    H.slopedWall(F, a - 0.005, b + 0.005, wz, 0.38, wt + 0.03, M.block, baseC, 1.6, 0.8);
    H.slopedWall(F, a - 0.03, b + 0.03, wz, wh, wt + 0.08, M.plain, capC, 0, 0, wh - 0.06);
    H.decal(F, 'moss', (a + b) / 2, gy((a + b) / 2, wz) + 0.1, (b - a) * 0.95, 0.28, wz + wt / 2 + 0.022, '#ffffff');
    H.decal(F, 'streak', a + (b - a) * 0.3, gy(a, wz) + wh - 0.4, 0.6, 0.7, wz + wt / 2 + 0.006, '#ffffff');
    H.col(F, (a + b) / 2, wz, b - a, wt + 0.08, 0, gy(a, wz) - 1, Math.max(gy(a, wz), gy(b, wz)) + wh);
    const m = F.w((a + b) / 2, 0, wz);
    res.wallTops.push({ x: m.x, z: m.z, y: +(L.heightAt(m.x, m.z) + wh).toFixed(3), rotY: F.ry, len: +(b - a).toFixed(2) });
  }
  H.decal(F, 'crack', 2.6, gy(2.6, wz) + 0.75, 0.3, 0.45, wz + wt / 2 + 0.007, '#ffffff');
  // gate pillars (wood-capped plaster) + wooden lattice gate (木戸), ajar
  for (const px of [-1.95, -0.65]) {
    const g = gy(px, wz);
    F.boxB(M.plaster, wallC, 0.3, 1.62, 0.3, px, g - 0.1, wz, { uv: { world: 3 } });
    F.boxB(M.plain, '#5a4032', 0.38, 0.07, 0.38, px, g + 1.52, wz);
    F.box(M.plain, capC, 0.42, 0.05, 0.42, px, g + 1.6, wz);
    H.col(F, px, wz, 0.32, 0.32, 0, g - 1, g + 1.6);
  }
  H.P.plate(F.sub(-0.65, 0, wz + 0.15, 0), 0, gy(-0.65, wz) + 1.15, 0.0, 'plateV1');
  F.box(M.atlas, '#ffffff', 0.09, 0.15, 0.03, -0.65, gy(-0.65, wz) + 0.86, wz + 0.165, { uv: { rect: H.A.rects.intercom, white: H.A.white } });
  F.box(M.atlas, '#ffffff', 0.3, 0.24, 0.08, -1.95, gy(-1.95, wz) + 1.0, wz + 0.18, { uv: { rect: H.A.rects.mailbox_red, white: H.A.white } });
  for (const s of [-1, 1]) {
    const hinge = -1.3 + s * 0.5;
    const GF = F.sub(hinge, gy(hinge, wz), wz - 0.05, s * 0.9);
    const lw = 0.48;
    GF.box(M.plain, '#6b4f3c', lw, 0.05, 0.04, -s * lw / 2, 1.1, 0); GF.box(M.plain, '#6b4f3c', lw, 0.05, 0.04, -s * lw / 2, 0.12, 0);
    for (let k = 0; k < 6; k++) GF.box(M.plain, '#7a5a43', 0.035, 1.0, 0.035, -s * (0.03 + k * (lw - 0.06) / 5), 0.6, 0);
  }
  // --- ground: moss lawn + gravel + stepping stones
  H.groundRect(F, -W / 2 + 0.05, -Dp + 0.05, W / 2 - 0.05, wz - wt / 2 - 0.02, M.gravel, '#d8d2c6', 0.02, 1.5);
  H.groundRect(F, -0.2, -4.6, 4.25, wz - wt / 2 - 0.05, M.lawn, '#a9c48a', 0.03, 2);
  H.groundRect(F, -4.25, -4.4, -2.3, -0.5, M.lawn, '#b0c890', 0.03, 2);
  H.groundRect(F, -W / 2 + 0.02, wz - wt / 2, W / 2 - 0.02, 0, M.concrete, '#c9c7c0', 0.03, 2);
  P.steppingStones(F, -1.3, -0.6, -1.25, -3.6, gy, r);
  // --- house: traditional 2F, plaster + dark wood trim, hip kawara roof with 下屋 skirt
  const hx0 = -4.0, hx1 = 3.9, hz0 = -12.4, hz1 = -5.3;
  const hcx = (hx0 + hx1) / 2, hcz = (hz0 + hz1) / 2, hw = hx1 - hx0, hd = hz1 - hz0;
  const HF = F.sub(hcx, 0, hcz, 0);
  let gmin = 1e9, gmax = -1e9;
  for (const [x, z] of [[hx0, hz0], [hx1, hz0], [hx0, hz1], [hx1, hz1]]) { const g = gy(x, z); gmin = Math.min(gmin, g); gmax = Math.max(gmax, g); }
  const S = {
    rng: r, w: hw, d: hd, floors: 2, fh: 2.85, lod: 2, floorY: gmax + 0.55, groundMin: gmin, groundFront: gy(hcx, hz1 + 1), baseY: HF.origin.y,
    wall: { kind: 'plaster', color: '#ede3cf' }, wall2: null, trim: '#5a4032', traditional: true,
    roof: { type: 'hip', mat: 'kawara', color: '#4f555f', pitch: 0.46, over: 0.62 }, ridgeColor: '#4a4f58',
    frameColor: '#5e4636', sillColor: '#5e4636', grilleColor: '#6b5a4c', fasciaColor: '#5a4032', soffitColor: '#e9e1cf', gutterColor: '#6b5242', flashColor: '#8a8f96', foundColor: '#bdbcb5',
    shutterColor: '#8e8a82', shutterStyle: 'tobukuro', shutterClosed: 0, hoods: false, hoodColor: '#6b7079',
    belt: true, cornerTrim: false, porchColor: '#b9b1a4', canopyColor: '#5a4032', balconySlab: '#d8d2c4', railColor: '#5e4636', poleColor: '#8fb3c9',
    bigFront: true, antenna: true, solar: false, propane: false, interiors: ['int_shoji', 'int_lace', 'int_shoji', 'int_room'],
    door: { u: -1.3 - hcx, style: 'door_slide', canopy: 'none', porchD: 1.2 }, skirt: { depth: 0.95 }, plate: 'plateV1', gatePlate: true,
  };
  S.ridgeColor = '#4a4f58';
  const hout = buildHouseW3(H, HF, S);
  // futon on the 2F window railing + wind chime under the skirt eave
  const FF = HF.sub(0, 0, hd / 2, 0);
  H.P.futon(FF, 1.9, S.floorY + 2.85 + 1.03, 0.24, r);
  H.laundry.chime(FF, 2.9, S.floorY + 2.85 - 0.05, 0.8);
  // --- garden: sakura spot kept open (lx 1.8, lz -2.2, r 1.5); pine, lantern, azaleas, bonsai, nandina
  const sk = { x: 1.8, z: -2.2 };
  const clear = (x, z, rr) => Math.hypot(x - sk.x, z - sk.z) > 1.5 + rr;
  P.pine(F, 3.35, gy(3.35, -3.9), -3.9, 1.25, r);
  P.lantern(F, -3.35, gy(-3.35, -2.6), -2.6);
  for (const [x, z, s, fl] of [[-3.9, -0.75, 0.42, 'azalea'], [-3.1, -0.8, 0.36, 'azalea'], [-2.45, -0.8, 0.3, null], [3.9, -0.8, 0.4, 'azalea'], [-0.1, -0.85, 0.32, 'azalea'], [-3.9, -4.2, 0.38, null]]) {
    if (clear(x, z, s)) P.bush(F, x, gy(x, z), z, s, r, { pal: fl ? 'green' : 'dark', flowers: fl, fn: 8 });
  }
  P.nandina(F, -0.3, gy(-0.3, -1.4), -1.4, 1.0, r);
  P.bonsaiShelf(F, -3.1, gy(-3.1, -4.5), -4.5, r);
  P.bush(F, 3.6, gy(3.6, -5.0), -5.0, 0.3, r, { pal: 'green', flowers: 'hydrangea', fn: 5, fsize: 0.16 });
  // stones around the future tree
  for (let k = 0; k < 5; k++) { const a = k * 1.3 + 0.4, d = 1.25 + r() * 0.3; const x = sk.x + Math.cos(a) * d, z = sk.z + Math.sin(a) * d; if (z < wz - 0.4 && z > -4.6) F.raw(M.concrete, '#a8a59c', H.blobRaw(k, 0), x, gy(x, z) + 0.05, z, { sx: 0.35, sy: 0.18, sz: 0.3, ry: a }); }
  res.gardenSpots.push({ ...(() => { const p = F.w(sk.x, 0, sk.z); return { x: p.x, z: p.z }; })(), r: 1.5 });
  // --- side + back boundaries (neighbours are shops)
  boundarySegZ(H, F, -W / 2 + 0.07, wz - 0.1, -Dp + 0.08, 'block', 1.2, '#c9c7c0', r, gy);
  boundarySegZ(H, F, W / 2 - 0.07, wz - 0.1, -Dp + 0.08, 'block', 1.2, '#c9c7c0', r, gy);
  boundarySeg(H, F, -W / 2 + 0.07, W / 2 - 0.07, -Dp + 0.08, 'block', 1.2, '#c9c7c0', r, gy, 2, null, false);
  // bike by the house side (north, visible through the gate?) and laundry stand behind
  // bike parked along the house front, right of the entrance (clear of the sakura circle and the porch)
  { const p = F.w(1.3, 0, -4.72); res.bikeSpots.push({ x: p.x, z: p.z, rotY: F.ry + Math.PI / 2 }); }
  return res;
}
function buildHouseW3(H, HF, S) { return buildHouse(H, HF, S); }
