// Plaza paving: light-grey 0.5 m tiles (world UV), granite border bands, forecourt band, bike-area paving,
// curbs along R2 / R3 (with lowered cuts), tactile guide path crosswalk -> bus stop / station steps,
// drain grates, a decorative manhole, soft dust stains.
import * as THREE from 'three';
import { rect, circlePts, flatShape, boxUV, put } from './util.js';

export function buildGround(ctx, root, T, S, P) {
  const { mat, physics } = ctx;
  const g = new THREE.Group(); g.name = 'plaza-ground'; root.add(g);
  const Y = P.yPave;
  const r = ctx.rng('plaza-ground');
  const flat = (geo, m) => put(g, geo, m, [0, 0, 0], null, { cast: false });

  // ---------------------------------------------------------------- main tile field
  const tiles = mat.toon('#ffffff', { map: T.tiles, paint: 0.08 });
  const outer = [[-8.75, -5.5], [26, -5.5], [26, -25], [14.6, -25], [14.6, -19.9], [-4.6, -19.9], [-4.6, -25], [-8.75, -25]];
  const b = P.bikeArea;
  const holes = [circlePts(P.tree.x, P.tree.z, P.circleR + 0.02, 72), rect(b.x0, b.z0, b.x1, b.z1)];
  flat(flatShape(outer, holes, Y, (x, z) => [x, -z]), tiles);

  // bike-area paving (same tiles, darker tint) + white lines
  flat(flatShape(rect(b.x0, b.z0, b.x1, b.z1), [], Y, (x, z) => [x + 0.25, -z]), mat.toon('#d3d4cf', { map: T.tiles, paint: 0.07 }));
  const lineM = mat.decal('#ecebe4', { paint: 0.02, depthWrite: true });
  const line = (x0, z0, x1, z1) => { const m = put(g, ctx.geo.G.plane(), lineM, [(x0 + x1) / 2, Y + 0.004, (z0 + z1) / 2], [-Math.PI / 2, 0, 0], { cast: false }); m.scale.set(x1 - x0, z1 - z0, 1); return m; };
  line(b.x0 + 0.1, b.z1 - 0.18, b.x1 - 0.1, b.z1 - 0.1);
  line(b.x0 + 0.1, b.z0 + 0.1, b.x1 - 0.1, b.z0 + 0.18);
  line(b.x0 + 0.1, b.z0 + 0.1, b.x0 + 0.18, b.z1 - 0.1);
  for (const row of ctx.L.PLAZA.bikeRows) {
    for (let x = row.x0 - 0.375; x <= row.x1 + 0.376; x += row.step) line(x - 0.03, row.z - 0.2, x + 0.03, row.z + 0.85);
  }

  // ---------------------------------------------------------------- granite bands
  const gran = mat.toon('#ffffff', { map: T.granite, paint: 0.05 });
  flat(flatShape(rect(-9.05, -5.5, 26, -5.2), [], Y, (x, z) => [x, -5.2 - z]), gran);                 // along R3
  flat(flatShape(rect(-9.05, -25, -8.75, -5.5), [], Y, (x, z) => [z, x + 9.05]), gran);               // along R2
  flat(flatShape(rect(-4.6, -20.5, 14.6, -19.9), [], Y, (x, z) => [x, -19.9 - z]), gran);             // forecourt foot
  flat(flatShape(rect(-4.6, -25, -4.0, -20.5), [], Y, (x, z) => [z, x + 4.6]), gran);
  flat(flatShape(rect(14.0, -25, 14.6, -20.5), [], Y, (x, z) => [z, 14.6 - x]), gran);

  // ---------------------------------------------------------------- curbs (0.6 m stones, lowered at cuts)
  const curbMats = ['#ffffff', '#f3f1ec', '#e8e7e1'].map(c => mat.toon(c, { map: T.curb, paint: 0.05 }));
  const TOP = 0.1, LOW = 0.04, CW = P.curbW;
  const runX = (x0, x1, zc, top) => { // stones along x
    const n = Math.max(1, Math.round((x1 - x0) / 0.6)), L = (x1 - x0) / n;
    for (let i = 0; i < n; i++) {
      const h = top + 0.03;
      put(g, boxUV(L - 0.006, h, CW, 1), curbMats[r.int(0, 2)], [x0 + L * (i + 0.5), h / 2 - 0.03, zc]);
    }
    physics.addWalkBox((x0 + x1) / 2, zc, x1 - x0, CW, 0, top);
  };
  const runZ = (z0, z1, xc, top) => {
    const n = Math.max(1, Math.round((z1 - z0) / 0.6)), L = (z1 - z0) / n;
    for (let i = 0; i < n; i++) {
      const h = top + 0.03;
      put(g, boxUV(CW, h, L - 0.006, 1), curbMats[r.int(0, 2)], [xc, h / 2 - 0.03, z0 + L * (i + 0.5)]);
    }
    physics.addWalkBox(xc, (z0 + z1) / 2, CW, z1 - z0, 0, top);
  };
  const zc3 = -5.0 - CW / 2, xc2 = -9.25 + CW / 2;
  let x = -9.25;
  for (const [c0, c1] of P.curbCutsR3) { runX(x, c0, zc3, TOP); runX(c0, c1, zc3, LOW); x = c1; }
  runX(x, 26, zc3, TOP);
  let z = -25;
  for (const [c0, c1] of P.curbCutsR2) { runZ(z, c0, xc2, TOP); runZ(c0, c1, xc2, LOW); z = c1; }
  runZ(z, -5.2, xc2, TOP);

  // ---------------------------------------------------------------- tactile paving (raised 12 mm yellow blocks)
  const tacM = { dots: mat.toon('#ffffff', { map: T.tacDots, paint: 0.03 }), v: mat.toon('#ffffff', { map: T.tacBarsV, paint: 0.03 }), u: mat.toon('#ffffff', { map: T.tacBarsU, paint: 0.03 }) };
  for (const [x0, z0, x1, z1, kind] of P.tactile) {
    const w = x1 - x0, d = z1 - z0;
    put(g, boxUV(w, 0.012, d, 1), tacM[kind], [(x0 + x1) / 2, Y + 0.006 - 0.001, (z0 + z1) / 2], null, { cast: false });
  }

  // ---------------------------------------------------------------- drain grates + decorative manhole
  const grateM = mat.toon('#ffffff', { map: S.grate, paint: 0.03 });
  for (const [gx, gz] of P.grates) put(g, boxUV(0.44, 0.006, 0.3, 1), grateM, [gx, Y + 0.002, gz], null, { cast: false });
  {
    const mh = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.012, 32), [mat.toon('#7a797d'), mat.toon('#ffffff', { map: S.manhole, paint: 0.03 }), mat.toon('#7a797d')]);
    mh.position.set(P.manhole.x, Y + 0.005, P.manhole.z); mh.rotation.y = 0.4; mh.receiveShadow = true; g.add(mh);
    ctx.noBatch(mh);
  }

  // ---------------------------------------------------------------- sakura-flower inlay around the clock pillar
  {
    const m = put(g, ctx.geo.G.plane(), mat.decal('#ffffff', { map: T.inlay, alphaTest: 0.5, transparent: false, depthWrite: true, paint: 0.04 }), [P.inlay.x, Y + 0.003, P.inlay.z], [-Math.PI / 2, 0, 0.12], { cast: false });
    m.scale.set(P.inlay.d, P.inlay.d, 1);
  }

  // ---------------------------------------------------------------- taxi boarding position marking (read facing the road)
  {
    const tx = ctx.tex.draw(256, 128, (c, w, h) => {
      c.clearRect(0, 0, w, h);
      c.strokeStyle = '#e8c547'; c.lineWidth = 9; c.strokeRect(8, 8, w - 16, h - 16);
      c.fillStyle = '#e8c547'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.font = `900 40px ${ctx.tex.FONTS.sans}`; c.fillText('タクシー', w / 2, 48);
      c.font = `900 30px ${ctx.tex.FONTS.sans}`; c.fillText('乗車位置', w / 2, 90);
    }, { key: 'plaza-taxi-mark' });
    const m = put(g, ctx.geo.G.plane(), mat.decal('#ffffff', { map: tx, opacity: 0.85 }), [P.taxiMark.x, Y + 0.004, P.taxiMark.z], [-Math.PI / 2, 0, Math.PI], { cast: false });
    m.scale.set(1.1, 0.55, 1);
  }

  // ---------------------------------------------------------------- replaced tiles (slightly different batch colour)
  const patchM = [mat.decal('#b9bab4', { transparent: true, opacity: 0.45 }), mat.decal('#d8d2c2', { transparent: true, opacity: 0.4 })];
  for (const [px, pz, nx, nz, k] of P.patches) {
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
      if (r.chance(0.18)) continue;
      const cx = Math.floor(px * 2) / 2 + 0.25 + i * 0.5, cz = Math.floor(pz * 2) / 2 + 0.25 + j * 0.5;
      const m = put(g, ctx.geo.G.plane(), patchM[k], [cx, Y + 0.002, cz], [-Math.PI / 2, 0, 0], { cast: false });
      m.scale.set(0.47, 0.47, 1);
    }
  }

  // ---------------------------------------------------------------- soft dust / wear stains (decals)
  const dustM = mat.decal('#8a8477', { alphaMap: T.dust, opacity: 0.32 });
  const wearM = mat.decal('#9b968a', { alphaMap: T.dust, opacity: 0.22 });
  for (const [dx, dz, s, kind] of P.stains) {
    const m = put(g, ctx.geo.G.plane(), kind ? wearM : dustM, [dx, Y + 0.003 + r.range(0, 0.002), dz], [-Math.PI / 2, 0, r() * 6], { cast: false });
    m.scale.set(s, s * r.range(0.6, 1.0), 1); m.renderOrder = 1;
  }
}
