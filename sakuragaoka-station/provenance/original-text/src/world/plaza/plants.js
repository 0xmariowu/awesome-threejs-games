// Flower beds (tulips, pansies, daisies, smooth low shrubs; brick or light-concrete edging), the east hedge,
// and small weeds / dandelions in joints and along curbs. Repeated plants are instanced.
import * as THREE from 'three';
import { boxUV, put, instanced, mtx, GeoBuilder, TAU, addSway } from './util.js';
import { crossQuads } from './tree.js';
import { makeShrub, makeHedge, FLOWER_COLORS } from '../lib/foliage.js';

export function buildPlants(ctx, root, T, P) {
  const { mat, physics } = ctx;
  const r = ctx.rng('plaza-plants');
  const g = new THREE.Group(); g.name = 'plaza-plants'; root.add(g);
  const I = { bloom: [], bloomC: [], green: [], pLeaf: [], pLeafC: [], pansy: [], pansyC: [], daisy: [], daisyC: [], rosette: [], shrub: [], shrubC: [], azalea: [], azaleaC: [], tuft: [], tuftC: [], dand: [], clump: [], clumpC: [] };
  const col = (hex) => new THREE.Color(hex);
  const TULIP = ['#e0514a', '#f09bb4', '#f2cd4a', '#f7c7d4', '#e0514a', '#f09bb4', '#f5ede2'];
  const PANSY = ['#8a70c8', '#f1d04b', '#f4f1f6', '#f2a347', '#6e87d6', '#b0487a', '#d9c4f0'];

  // ---------------------------------------------------------------- plant emitters
  const tulipClump = (x, z, y, color, n = 6) => {
    for (let i = 0; i < n; i++) {
      const a = r() * TAU, d = Math.sqrt(r()) * 0.14;
      const h = r.range(0.2, 0.3), lean = r.range(-0.12, 0.12), rot = r() * TAU;
      const px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d;
      const sm = mtx(px, y, pz, lean, rot, lean * 0.5, [1, h / 0.32, 1]);
      I.green.push(sm);
      // bloom sits on top of the (leaned) stem
      const top = new THREE.Vector3(0, 0.318, 0).applyMatrix4(sm);
      I.bloom.push(mtx(top.x, top.y - 0.006, top.z, lean, rot, lean * 0.5, r.range(1.35, 1.6)));
      I.bloomC.push(col(color).offsetHSL(r.range(-0.01, 0.01), 0, r.range(-0.04, 0.03)));
    }
  };
  const pansy = (x, z, y) => {
    const s = r.range(0.8, 1.15);
    I.clump.push(mtx(x, y - 0.005, z, 0, r() * TAU, 0, [0.2 * s, 0.1 * s, 0.2 * s]));
    I.clumpC.push(col('#ffffff').offsetHSL(0, 0, r.range(-0.12, 0.0)));
    const c = r.pick(PANSY), n = r.int(3, 5);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + r.range(-0.4, 0.4), d = r.range(0.02, 0.06) * s;
      I.pansy.push(mtx(x + Math.cos(a) * d, y + r.range(0.045, 0.075) * s, z + Math.sin(a) * d, -r.range(0.5, 1.0), -a + Math.PI / 2, 0, r.range(0.05, 0.065) * s));
      I.pansyC.push(col(c).offsetHSL(0, 0, r.range(-0.03, 0.03)));
    }
  };
  const daisy = (x, z, y, n = 5) => {
    I.rosette.push(mtx(x, y + 0.006, z, 0, r() * TAU, 0, [0.16, 1, 0.16]));
    for (let i = 0; i < n; i++) {
      const a = r() * TAU, d = r.range(0.0, 0.07);
      I.daisy.push(mtx(x + Math.cos(a) * d, y + r.range(0.05, 0.12), z + Math.sin(a) * d, r.range(-0.35, 0.35), r() * TAU, r.range(-0.35, 0.35), r.range(0.035, 0.05)));
      I.daisyC.push(col(r.chance(0.2) ? '#f7dbe5' : '#ffffff'));
    }
  };
  const cover = (x, z, y, s = 1) => {
    I.clump.push(mtx(x, y - 0.005, z, 0, r() * TAU, 0, [0.36 * s, 0.12 * s, 0.36 * s]));
    I.clumpC.push(col('#e8f0dc').offsetHSL(0, 0, r.range(-0.15, 0.0)));
  };
  // soft boxwood / azalea (ツツジ) mounds: one smooth puff-scalloped shrub each (lib/foliage — welded,
  // smooth normals, baked colour, leaf-clump shading, shared material). bloom: pink / white blossoms.
  // The RNG draws of the old multi-blob version are kept so every other plant stays where it was.
  let shrubN = 0;
  const shrub = (x, z, y, s = 1, hue = 0, bloom = false) => {
    const n = r.int(2, 3);
    let v0 = 0, v1 = 0;
    for (let i = 0; i < n; i++) {
      const a = r.range(-0.12, 0.12), b = r.range(-0.12, 0.12); r.range(0.19, 0.26); const rot = r() * 3; r(); r();
      if (bloom && i < 2) r.range(-0.06, 0.0); else { r.range(-0.015, 0.015); r.range(-0.04, 0.04); r.range(-0.07, 0.03); }
      if (i === 0) { v0 = a; v1 = rot; } else v0 += b * 0.3;
    }
    const seed = (shrubN++ % 4) + (bloom ? 11 : 1);
    const m = makeShrub(ctx, { r: 0.33 * s, h: 0.4 * s, sx: 1.05 + v0, sz: 0.98, seed, kind: bloom ? 'azalea' : hue > 0.01 ? 'young' : 'boxwood', spacing: 0.07, flowers: bloom ? { colors: FLOWER_COLORS.azaleaMix, density: 1.4 } : null });
    m.position.set(x, y - 0.02, z); m.rotation.y = v1 * 2.1;
    g.add(m);
  };
  const tuft = (x, z, y = P.yPave, s = 1) => {
    const h = r.range(0.06, 0.13) * s;
    I.tuft.push(mtx(x, y - 0.005, z, r.range(-0.2, 0.2), r() * TAU, 0, [h * r.range(1.0, 1.6), h, h]));
    I.tuftC.push(new THREE.Color().setHSL(0.23 + r.range(-0.03, 0.04), 0.38, 0.5 + r.range(-0.08, 0.08)));
  };
  const dandelion = (x, z, y = P.yPave) => {
    I.rosette.push(mtx(x, y + 0.004, z, 0, r() * TAU, 0, [0.13, 1, 0.13]));
    const n = r.int(1, 2);
    for (let i = 0; i < n; i++) I.dand.push(mtx(x + r.range(-0.03, 0.03), y + r.range(0.05, 0.1), z + r.range(-0.03, 0.03), r.range(-0.4, 0.4), r() * TAU, r.range(-0.4, 0.4), r.range(0.04, 0.055)));
  };

  // ---------------------------------------------------------------- beds
  const brick = mat.toon('#ffffff', { map: T.brick, paint: 0.05 });
  const conc = mat.toon('#ffffff', { map: T.concrete, paint: 0.05 });
  const capBrick = mat.toon('#c7c2b6', { map: T.concrete, paint: 0.04 });
  const soil = mat.toon('#ffffff', { map: T.soil, paint: 0.06 });
  for (const b of P.beds) {
    const { x0, z0, x1, z1 } = b, h = b.h ?? 0.3, t = 0.12;
    const w = x1 - x0, d = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const em = b.edge === 'brick' ? brick : conc;
    put(g, boxUV(w, h, t, 1), em, [cx, h / 2, z0 + t / 2]);
    put(g, boxUV(w, h, t, 1), em, [cx, h / 2, z1 - t / 2]);
    put(g, boxUV(t, h, d - 2 * t, 1), em, [x0 + t / 2, h / 2, cz]);
    put(g, boxUV(t, h, d - 2 * t, 1), em, [x1 - t / 2, h / 2, cz]);
    if (b.edge === 'brick') { // light coping stones on the brick walls
      put(g, boxUV(w + 0.02, 0.035, t + 0.02, 1), capBrick, [cx, h + 0.0175, z0 + t / 2]);
      put(g, boxUV(w + 0.02, 0.035, t + 0.02, 1), capBrick, [cx, h + 0.0175, z1 - t / 2]);
      put(g, boxUV(t + 0.02, 0.035, d - 2 * t - 0.02, 1), capBrick, [x0 + t / 2, h + 0.0175, cz]);
      put(g, boxUV(t + 0.02, 0.035, d - 2 * t - 0.02, 1), capBrick, [x1 - t / 2, h + 0.0175, cz]);
    }
    const sy = h - 0.05;
    const sg = new THREE.PlaneGeometry(w - 2 * t, d - 2 * t).rotateX(-Math.PI / 2);
    { const uv = sg.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (w - 2 * t), uv.getY(i) * (d - 2 * t)); }
    put(g, sg, soil, [cx, sy, cz], null, { cast: false });
    physics.addBox(cx, cz, w, d, 0, 0, 1.0);
    // planting
    const ix0 = x0 + t + 0.08, ix1 = x1 - t - 0.08, iz0 = z0 + t + 0.08, iz1 = z1 - t - 0.08;
    const iw = ix1 - ix0, id = iz1 - iz0;
    if (b.kind === 'tulips') {
      // edge ring of pansies / daisies, clumps of tulips inside
      const per = 2 * (iw + id), nEdge = Math.round(per / 0.2);
      for (let i = 0; i < nEdge; i++) {
        let u = (i + r.range(-0.2, 0.2)) / nEdge * per, x, z;
        if (u < iw) { x = ix0 + u; z = iz1; } else if ((u -= iw) < id) { x = ix1; z = iz1 - u; } else if ((u -= id) < iw) { x = ix1 - u; z = iz0; } else { u -= iw; x = ix0; z = iz0 + u; }
        if (r.chance(0.72)) pansy(x, z, sy); else daisy(x, z, sy, 4);
      }
      const nx = Math.max(1, Math.round((iw - 0.3) / 0.3)), nz = Math.max(1, Math.round((id - 0.3) / 0.3));
      let ci = r.int(0, 6);
      for (let i = 0; i < nx; i++) for (let k = 0; k < nz; k++) {
        const x = ix0 + 0.15 + (nx > 1 ? (iw - 0.3) * i / (nx - 1) : (iw - 0.3) / 2) + r.range(-0.05, 0.05);
        const z = iz0 + 0.15 + (nz > 1 ? (id - 0.3) * k / (nz - 1) : (id - 0.3) / 2) + r.range(-0.05, 0.05);
        if (b.shrubEnds && (i === 0 || i === nx - 1) && k === nz - 1 && nz > 1) { shrub(x, z, sy, 1.1, 0, true); continue; }
        tulipClump(x, z, sy, TULIP[(ci++) % TULIP.length], r.int(7, 10));
      }
      for (let i = 0; i < Math.round(iw * id / 0.07); i++) cover(ix0 + r() * iw, iz0 + r() * id, sy, r.range(0.8, 1.2));
    } else if (b.kind === 'border') {
      // long narrow bed: shrubs every ~1.3 m with pansies/daisies/tulips between
      const long = d > w; const L0 = long ? iz0 : ix0, L1 = long ? iz1 : ix1, mid = long ? (ix0 + ix1) / 2 : (iz0 + iz1) / 2;
      const len = L1 - L0; const ns = Math.max(2, Math.round(len / 1.3));
      for (let i = 0; i <= ns; i++) { const u = L0 + len * i / ns; shrub(long ? mid : u, long ? u : mid, sy, 0.95, 0, i % 2 === 1); }
      for (let i = 0; i < ns; i++) {
        const u = L0 + len * (i + 0.5) / ns;
        const p = (du, dv) => (long ? [mid + dv, u + du] : [u + du, mid + dv]);
        if (i % 2 === 0) { const [x, z] = p(0, 0); tulipClump(x, z, sy, TULIP[(i / 2) % TULIP.length], 6); }
        else { const [x, z] = p(0, 0); daisy(x, z, sy, 6); }
        for (const [du, dv] of [[-0.35, -0.2], [0.35, 0.2], [-0.35, 0.2], [0.35, -0.2]]) { const [x, z] = p(du, dv); pansy(x, z, sy); }
      }
      for (let i = 0; i < Math.round(iw * id / 0.06); i++) cover(ix0 + r() * iw, iz0 + r() * id, sy, r.range(0.8, 1.2));
    }
    // weeds at the bed foot
    const perim = 2 * (w + d);
    for (let i = 0; i < Math.round(perim / 1.4); i++) {
      const u = r() * perim; let x, z;
      if (u < w) { x = x0 + u; z = z1 + 0.03; } else if (u < w + d) { x = x1 + 0.03; z = z0 + (u - w); } else if (u < 2 * w + d) { x = x0 + (u - w - d); z = z0 - 0.03; } else { x = x0 - 0.03; z = z0 + (u - 2 * w - d); }
      tuft(x, z, P.yPave, 0.9);
    }
  }

  // ---------------------------------------------------------------- round planters: a small shrub ringed with pansies
  for (const [px, pz] of P.planters) {
    shrub(px, pz, 0.46, 1.0, 0.02);
    for (let i = 0; i < 7; i++) { const a = i / 7 * TAU + r.range(-0.2, 0.2); pansy(px + Math.cos(a) * 0.3, pz + Math.sin(a) * 0.3, 0.46); }
  }

  // ---------------------------------------------------------------- east hedge (boxwood) with a cloud-like top
  {
    const hd = P.hedge; const len = hd.z1 - hd.z0, cx = (hd.x0 + hd.x1) / 2, cz = (hd.z0 + hd.z1) / 2, w = hd.x1 - hd.x0;
    // one continuous clipped boxwood hedge (flat top, rounded edges/ends, soft leaf puffs) — length along z
    const n = Math.round(len / 0.5);
    for (let i = 0; i <= n; i++) { r.range(0.28, 0.36); r.range(-0.05, 0.05); r.range(-0.03, 0.05); r(); r(); r(); r.range(-0.015, 0.015); r.range(-0.05, 0.03); } // keep RNG draws
    // (+ white spirea / ユキヤナギ blossoms along the south end, local x = -z)
    const hm = makeHedge(ctx, { length: len, h: 0.78, d: w + 0.12, seed: 7, kind: 'boxwood', spacing: 0.1, flowers: { colors: FLOWER_COLORS.spirea, density: 2.2, size: 0.8, top: 0.25, xRange: [len / 2 - 3.2, len / 2 - 0.4] } });
    hm.position.set(cx, P.yPave - 0.03, cz); hm.rotation.y = Math.PI / 2;
    g.add(hm);
    physics.addBox(cx, cz, w + 0.1, len, 0, 0, 1.0);
    for (let i = 0; i < 22; i++) tuft(hd.x0 - 0.04, hd.z0 + r() * len, P.yPave, 1.1);
  }

  // ---------------------------------------------------------------- weeds / dandelions in joints and along the curbs
  for (let i = 0; i < 46; i++) { const x = r.range(P.x0 + 0.3, P.x1 - 0.8); if (Math.abs(x) < 2.2 || (x > 16.8 && x < 18.8)) continue; tuft(x, -5.24 - r.range(0, 0.05)); }
  for (let i = 0; i < 26; i++) tuft(-9.02 - r.range(0, 0.02), r.range(-24.8, -5.6));
  for (let i = 0; i < 12; i++) tuft(r.range(-4.4, 14.4), -19.92 + r.range(-0.02, 0.02), P.yPave, 0.8);
  for (const [x, z] of P.bollards) if (r.chance(0.6)) tuft(x + r.range(-0.1, 0.1), z + r.range(-0.1, 0.1));
  for (const [x, z] of P.lamps) { tuft(x + 0.14, z + 0.05); tuft(x - 0.1, z - 0.12, P.yPave, 0.8); }
  for (const [x, z] of P.dandelions) dandelion(x, z);
  // random joint weeds on the 0.5 m grid (sparse), away from paths
  for (let i = 0; i < 40; i++) {
    const x = Math.round(r.range(-8.5, 25) * 2) / 2, z = Math.round(r.range(-24.5, -5.8) * 2) / 2;
    if (P.isBusy && P.isBusy(x, z)) continue;
    tuft(x + r.range(-0.03, 0.03), z, P.yPave, 0.55);
  }

  // ---------------------------------------------------------------- instanced meshes
  const add = (geo, m, mats, cols, outline, cast = false) => {
    if (!mats.length) return;
    const im = instanced(geo, m, mats, cols, { cast });
    if (!outline) ctx.noOutline(im);
    g.add(im); return im;
  };
  // tulip bloom (lathe cup) + stem/leaves
  const bloomGeo = new THREE.LatheGeometry([[0, 0], [0.021, 0.006], [0.029, 0.025], [0.027, 0.047], [0.013, 0.064]].map(([a, b]) => new THREE.Vector2(a, b)), 6); // 6 petals, rounded cup profile
  add(bloomGeo, mat.toon('#ffffff', { paint: 0.03 }), I.bloom, I.bloomC, true, true);
  add(tulipGreenGeo(), mat.toon('#6f9e56', { side: 'double', paint: 0.04 }), I.green, null, false, true);
  add(clumpGeo(), addSway(ctx, mat.foliage('#ffffff', T.leafClump, { name: 'plaza-sway-clump' }), 0.02, 'up'), I.clump, I.clumpC, false);
  const flat = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const upright = new THREE.PlaneGeometry(1, 1);
  add(upright, addSway(ctx, mat.foliage('#ffffff', T.pansy, { name: 'plaza-sway-pansy' }), 0.006, 'flat'), I.pansy, I.pansyC, false);
  add(flat, addSway(ctx, mat.foliage('#ffffff', T.daisy, { name: 'plaza-sway-daisy' }), 0.008, 'flat'), I.daisy, I.daisyC, false);
  add(flat, mat.foliage('#ffffff', T.rosette), I.rosette, null, false);
  add(crossQuads(1, 1, 3), addSway(ctx, mat.foliage('#ffffff', T.grass, { name: 'plaza-sway-grass' }), 0.018, 'up'), I.tuft, I.tuftC, false);
  add(flat, addSway(ctx, mat.foliage('#ffffff', T.dandelion, { name: 'plaza-sway-dand' }), 0.008, 'flat'), I.dand, null, false);
}

// three splayed leaf cards around a centre (unit: 1 wide, 1 tall), up-facing normals for even light
function clumpGeo() {
  const pos = [], nor = [], uv = [], idx = [];
  for (let i = 0; i < 3; i++) {
    const a = i / 3 * Math.PI + 0.3, ca = Math.cos(a), sa = Math.sin(a);
    for (const side of [1, -1]) {
      // each card leans outward from the centre on one side
      const o = pos.length / 3;
      const lean = 0.55 * side;
      const bx = 0, bz = 0;
      const tx = -sa * side * lean, tz = ca * side * lean;   // top offset (outward)
      const corners = [[-0.5, 0], [0.5, 0], [0.5, 1], [-0.5, 1]];
      for (const [u, v] of corners) {
        pos.push(bx + ca * u + tx * v, v, bz + sa * u + tz * v);
        nor.push(0, 1, 0); uv.push(u + 0.5, side > 0 ? v : v);
      }
      idx.push(o, o + 1, o + 2, o, o + 2, o + 3);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

// stem (thin box) + two arching leaves, unit height 0.32
function tulipGreenGeo() {
  const B = new GeoBuilder();
  const stem = (h) => {
    const w = 0.005;
    const corners = [[-w, -w], [w, -w], [w, w], [-w, w]];
    for (let i = 0; i < 4; i++) {
      const [ax, az] = corners[i], [bx, bz] = corners[(i + 1) % 4];
      const nx = (ax + bx) / 2, nz = (az + bz) / 2, l = Math.hypot(nx, nz);
      const a = B.v(ax, 0, az, nx / l, 0, nz / l), b = B.v(bx, 0, bz, nx / l, 0, nz / l), c = B.v(bx, h, bz, nx / l, 0, nz / l), d = B.v(ax, h, az, nx / l, 0, nz / l);
      B.quad(a, b, c, d);
    }
  };
  stem(0.32);
  const leaf = (dir, len, width, lift) => {
    const segs = 4; const ca = Math.cos(dir), sa = Math.sin(dir);
    let prev = null;
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      const out = t * len * 0.45, up = lift + t * len * (1 - 0.55 * t);
      const hw = width * Math.sin(Math.PI * Math.min(1, t * 1.15 + 0.05)) * (1 - t * 0.6);
      const px = ca * out, pz = sa * out;
      const tx = -sa * hw, tz = ca * hw;
      const nx = ca * 0.6, ny = 0.8, nz = sa * 0.6;
      const a = B.v(px - tx, up, pz - tz, nx, ny, nz), b = B.v(px + tx, up, pz + tz, nx, ny, nz);
      if (prev) B.quad(prev[0], prev[1], b, a);
      prev = [a, b];
    }
  };
  leaf(0, 0.2, 0.022, 0.0);
  leaf(Math.PI * 0.9, 0.17, 0.02, 0.02);
  return B.build();
}
