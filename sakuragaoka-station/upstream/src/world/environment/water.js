// environment/water.js — 桜川: toon water surface, rip-rap stones at the waterline, a low weir,
// stepping stones, a small gravel bar and the road bridge far west (x≈-160).
import * as L from '../layout.js';
import { terrainH, vnoise, fbm, BRIDGE, smoothstep } from './common.js';
import { waterMaterial } from './shaders.js';

export const WATER_Y = L.RIVER.waterY;
export const WEIR_X = 76;
export const STONES_X = -45;

export function buildRiver(ctx, tx) {
  const { THREE } = ctx;
  const kit = ctx.kit(new THREE.Group());
  ctx.addStatic(kit.parent); kit.parent.name = 'env-river';

  // ---------------------------------------------------------------- water surface
  const water = waterMaterial(ctx, { mode: 0, weirX: WEIR_X + 0.9, stonesX: STONES_X });
  {
    const xs = [], zs = [-99.55, -101.5, -104.5, -108.5, -112.5, -115.5, -118.0];
    for (let x = -700; x <= 700; x += 10) xs.push(x);
    const pos = [], uv = [], idx = [];
    for (let j = 0; j < zs.length; j++) for (let i = 0; i < xs.length; i++) { pos.push(xs[i], WATER_Y, zs[j]); uv.push(xs[i], zs[j]); }
    const nx = xs.length;
    for (let j = 0; j < zs.length - 1; j++) for (let i = 0; i < nx - 1; i++) {
      const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1;
      idx.push(a, b, d, a, d, c); // faces +Y (z decreasing along j)
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(new Float32Array(pos.length).map((v, i) => (i % 3 === 1 ? 1 : 0)), 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeBoundingSphere();
    const m = new THREE.Mesh(g, water); m.name = 'env-river-water';
    m.receiveShadow = false; m.castShadow = false;
    ctx.noBatch(m);
    ctx.addStatic(m);
  }

  // ---------------------------------------------------------------- rip-rap stones at the waterline (instanced, faceted)
  {
    const geo = new THREE.IcosahedronGeometry(0.5, 0).toNonIndexed(); geo.computeVertexNormals();
    const mat = ctx.mat.toon('#ffffff', { paint: 0.06, name: 'env-riprap' });
    const r = ctx.rng('env-riprap');
    const list = [];
    const bankLines = [
      { z: -99.95, dir: 1, x0: -135, x1: 135, step: 1.0 },  // near bank (inside the river the z decreases)
      { z: -117.33, dir: -1, x0: -135, x1: 135, step: 1.35 },
    ];
    for (const b of bankLines) {
      for (let x = b.x0; x < b.x1; x += b.step * (0.6 + r() * 0.8)) {
        if (Math.abs(x - STONES_X) < 1.2 || Math.abs(x - WEIR_X) < 2.2 || Math.abs(x - BRIDGE.x) < 5) continue;
        const s = 0.28 + r() * 0.42 + (r() < 0.08 ? 0.35 : 0);
        const z = b.z - b.dir * (r() * 0.9 - 0.25);
        list.push({ x, z, y: WATER_Y - s * 0.18 + r() * 0.08, s });
        if (r() < 0.35) list.push({ x: x + (r() - 0.5) * 0.6, z: z - b.dir * (0.4 + r() * 0.5), y: WATER_Y - 0.12, s: s * 0.6 });
      }
    }
    const im = new THREE.InstancedMesh(geo, mat, list.length);
    const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), S = new THREE.Vector3(), V = new THREE.Vector3(), col = new THREE.Color();
    const tones = ['#cfc9bc', '#bdb7aa', '#d8d3c7', '#aea99f', '#c7bfae'];
    list.forEach((s, i) => {
      E.set(r() * 3, r() * 3, r() * 3); Q.setFromEuler(E);
      S.set(s.s * (1 + r() * 0.5), s.s * (0.55 + r() * 0.3), s.s * (0.9 + r() * 0.4));
      M.compose(V.set(s.x, s.y, s.z), Q, S); im.setMatrixAt(i, M);
      col.set(tones[i % tones.length]); im.setColorAt(i, col);
    });
    im.castShadow = true; im.receiveShadow = true; im.name = 'env-riprap';
    im.computeBoundingSphere();
    ctx.addStatic(im);
  }

  // ---------------------------------------------------------------- weir (低い堰) at x≈76
  {
    const conc = ctx.mat.toon('#cfcbc0', { paint: 0.07 });
    const concD = ctx.mat.toon('#a9a699', { paint: 0.06 });
    const zc = (-99.3 + -117.9) / 2, len = 18.6;
    kit.box(1.3, 0.9, len, conc, [WEIR_X, WATER_Y + 0.06 - 0.45, zc]);        // crest (top just above the water)
    kit.box(3.2, 0.3, len, concD, [WEIR_X + 2.1, WATER_Y - 0.28, zc], [0, 0, -0.08]); // apron under the tumbling water
    // fishway notch blocks
    for (const dz of [-3.4, -2.2]) kit.box(1.5, 0.35, 0.35, concD, [WEIR_X, WATER_Y + 0.08, -104 + dz]);
  }

  // ---------------------------------------------------------------- stepping stones (飛び石) at x≈-45
  {
    const stone = ctx.mat.toon('#d3cec2', { paint: 0.08 });
    const stoneG = new THREE.IcosahedronGeometry(0.5, 1); // flattened rounded river stone (smooth normals)
    { const pa = stoneG.attributes.position, na = stoneG.attributes.normal; for (let i = 0; i < pa.count; i++) { const x = pa.getX(i), y = pa.getY(i), z = pa.getZ(i); const l = Math.hypot(x, y, z); na.setXYZ(i, x / l, y / l, z / l); pa.setY(i, y > 0 ? y * 0.75 + 0.05 : y); } }
    const r = ctx.rng('env-steps');
    for (let z = -100.7; z > -117.0; z -= 1.28) {
      const w = 0.95 + r() * 0.2, d = 0.72 + r() * 0.12;
      const m = kit.mesh(stoneG, stone, [STONES_X + (r() - 0.5) * 0.25, WATER_Y + 0.02 + r() * 0.04, z], [0, r() * 3, 0], [w * 1.05, 0.42, d * 1.1]);
      m.castShadow = true;
    }
  }

  // ---------------------------------------------------------------- small gravel bar (中州) with reeds (reeds added by flora)
  {
    const g = new THREE.SphereGeometry(1, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    const bar = new THREE.Mesh(g, ctx.mat.toon('#c9c1ad', { paint: 0.08, map: tx.ground }));
    bar.scale.set(9.5, 0.5, 2.1); bar.position.set(26, WATER_Y - 0.28, -112.4); bar.rotation.y = 0.06;
    bar.receiveShadow = true; bar.castShadow = false;
    kit.parent.add(bar);
    const g2 = new THREE.SphereGeometry(1, 16, 6, 0, Math.PI * 2, 0, Math.PI / 2);
    const grass = new THREE.Mesh(g2, ctx.mat.toon('#9dbf78', { paint: 0.06, map: tx.levee }));
    grass.scale.set(6.2, 0.32, 1.25); grass.position.set(25.2, WATER_Y - 0.05, -112.5);
    grass.receiveShadow = true; kit.parent.add(grass);
  }

  buildBridge(ctx, tx);
  // the river can't be entered (play bounds already stop at z=-97; this also covers fly->walk transitions)
  for (let x = -130; x < 130; x += 20) ctx.physics.addBox(x + 10, -99.5, 20, 0.6, 0, -5, 20);
  return { bars: [{ x: 26, z: -112.4, rx: 9, rz: 1.8 }] };
}

function buildBridge(ctx, tx) {
  const { THREE } = ctx;
  const grp = new THREE.Group(); grp.name = 'env-bridge'; ctx.addStatic(grp);
  const k = ctx.kit(grp);
  const X = BRIDGE.x, top = BRIDGE.deckY;
  const conc = ctx.mat.toon('#d6d2c7', { paint: 0.07 });
  const concS = ctx.mat.toon('#c4c0b4', { paint: 0.06 });
  const asphalt = ctx.mat.toon('#77797e', { paint: 0.05 });
  const walk = ctx.mat.toon('#c9c5ba', { paint: 0.05 });
  const steel = ctx.mat.toon('#e3e6e6', { paint: 0.03 });
  const line = ctx.mat.decal('#ecebe5');
  const z0 = -91.6, z1 = -121.2, zl = (z0 + z1) / 2, len = z0 - z1;
  // deck slab + girders
  k.box(9.2, 0.32, len, conc, [X, top - 0.16, zl]);
  for (const dx of [-3.1, 0, 3.1]) k.box(0.7, 1.0, -94.2 - z1 + 0.3, concS, [X + dx, top - 0.82, (-94.2 + z1) / 2]);
  // road + sidewalks
  k.box(6.0, 0.03, len, asphalt, [X, top + 0.015, zl]);
  for (const s of [-1, 1]) {
    k.box(1.45, 0.18, len, walk, [X + s * 3.72, top + 0.09, zl]);
    k.box(0.12, 0.012, len, line, [X + s * 2.75, top + 0.036, zl]);
  }
  k.box(0.12, 0.012, len, ctx.mat.decal('#e9c54a'), [X, top + 0.036, zl]);
  // piers (wall type, rounded) and the far abutment
  for (const zp of [-104.6, -112.3]) {
    k.rbox(7.4, 3.35, 1.25, 0.55, concS, [X, (-1.2 + top - 1.3) / 2, zp]);
  }
  k.box(9.4, top + 1.6, 1.4, concS, [X, (top - 1.6 - 0.2) / 2 + 0.1 - 0.1, -120.6]);
  // railings: posts + top rail + alpha panel
  const panelMat = ctx.mat.foliage('#ffffff', tx.railing, { alphaTest: 0.5, name: 'env-railing' });
  for (const s of [-1, 1]) {
    const xr = X + s * 4.45;
    k.box(0.1, 0.1, len, steel, [xr, top + 1.18, zl]);
    for (let z = z0 - 0.2; z > z1; z -= 2.5) k.box(0.1, 1.0, 0.1, steel, [xr, top + 0.68, z]);
    const pg = new THREE.PlaneGeometry(len, 0.95); pg.rotateY(Math.PI / 2);
    const uvA = pg.attributes.uv; for (let i = 0; i < uvA.count; i++) uvA.setX(i, uvA.getX(i) * len / 2.4);
    const p = new THREE.Mesh(pg, panelMat); p.position.set(xr, top + 0.66, zl); ctx.noOutline(p); grp.add(p);
    // 親柱 (name posts) at both ends
    for (const ze of [z0 - 0.3, z1 + 0.3]) k.rbox(0.55, 1.45, 0.55, 0.06, conc, [xr, top + 0.72, ze]);
    // lamps
    for (const zlmp of [-99.5, -113.5]) {
      k.cyl(0.07, 0.09, 6.2, ctx.mat.toon('#8f979c'), [xr + s * 0.1, top + 3.1, zlmp], null, 8);
      k.box(0.9, 0.1, 0.12, ctx.mat.toon('#8f979c'), [xr - s * 0.4, top + 6.1, zlmp]);
      k.box(0.5, 0.12, 0.26, ctx.mat.toon('#e9ecef'), [xr - s * 0.8, top + 6.02, zlmp]);
    }
  }
  // name plates on the posts (bridge name, kanji + kana)
  const plate = ctx.tex.draw(256, 128, (g, w, h) => {
    g.fillStyle = '#8b8577'; g.fillRect(0, 0, w, h); g.fillStyle = '#e8e4d8';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    ctx.tex.fitText(g, '桜川橋', w / 2, h * 0.42, w * 0.86, 62, ctx.tex.FONTS.serif, 700);
    ctx.tex.fitText(g, 'さくらがわばし', w / 2, h * 0.82, w * 0.86, 22, ctx.tex.FONTS.serif, 700);
  }, { key: 'env-bridge-plate' });
  const pm = ctx.mat.toon('#ffffff', { map: plate, paint: 0.02 });
  for (const s of [-1, 1]) {
    const pl = k.plane(0.44, 0.22, pm, [X + s * 4.45, top + 1.1, z0 - 0.3 + 0.281], [0, 0, 0]);
    pl.rotation.y = 0; // faces south (toward the levee path)
  }
  // approach asphalt on the levee top and the ramp down the town-side slope toward the west
  const ramp = [];
  for (let i = 0; i <= 24; i++) {
    const t = i / 24; const x = X - 1 - t * 42, z = -92.2 + t * 8.4;
    ramp.push([x, z]);
  }
  const pos = [], idx = [];
  for (let i = 0; i < ramp.length; i++) {
    const [x, z] = ramp[i];
    const [nx, nz] = i < ramp.length - 1 ? ramp[i + 1] : ramp[i - 1];
    let dx = nx - x, dz = nz - z; if (i === ramp.length - 1) { dx = -dx; dz = -dz; }
    const l = Math.hypot(dx, dz); const px = -dz / l * 2.8, pz = dx / l * 2.8;
    for (const s of [-1, 1]) { const xx = x + px * s, zz = z + pz * s; pos.push(xx, Math.max(L.heightAt(xx, zz), terrainH(xx, zz)) + 0.035, zz); }
    if (i) { const a = (i - 1) * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  }
  const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); rg.setIndex(idx); rg.computeVertexNormals();
  // make sure it faces up
  const nrm = rg.attributes.normal; if (nrm.getY(0) < 0) { for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; } rg.setIndex(idx); rg.computeVertexNormals(); }
  const rm = new THREE.Mesh(rg, asphalt); rm.receiveShadow = true; grp.add(rm);
  k.box(7.0, 0.04, 3.4, asphalt, [X, 3.22, -93]);
}
