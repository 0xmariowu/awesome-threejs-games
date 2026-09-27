// W6 サイクル丸山 — workshop interior: workbench with vise, bench grinder, toolbox, truing stand with
// a wheel, clamp lamp, oil can & spray cans; pegboard with modelled spanners, screwdrivers, pliers,
// hammer, hacksaw, allen keys, tyre levers, cable coils; steel parts-drawer cabinet; parts shelf with
// tyres, tube boxes, helmets, locks, baskets; tyre rack + hanging inner tubes; wheels hung from the
// ceiling; repair stand with a clamped bike, tool cart, stool, puncture tub; bikes for sale; air
// compressor with hose; office with a glass-top accessory counter + register, desk, phone, key box.
import * as THREE from 'three';
import * as PR from './props.js';

export const TEXTS = ['タイヤ各種', '24・26・27インチ', 'チューブ', '新車', '¥24,800', '¥21,800', '¥14,800', '修理受付', 'ベル', 'ライト', 'カギ', '部品', '整備済み', 'お気軽にどうぞ', '丸山', '4月'];

/** Wheel lying in its local XY plane (axle = local Z), built from instanced tyre, rim, hub and spokes. */
export function wheel(p, K, x, y, z, R, rotY = 0, o = {}) {
  const g = PR.grp(p, x, y, z, rotY), I = K.I;
  I.add('tyre', g, [0, 0, 0], R * 2, o.tyre || '#3f3a44');
  I.add('ring', g, [0, 0, 0], (R - 0.03) * 2, '#c9ccd0');
  I.add('cylc', g, [0, 0, 0], [0.05, 0.1, 0.05], '#9aa1a8', [Math.PI / 2, 0, 0]);
  for (let i = 0; i < 8; i++) I.add('boxc', g, [0, 0, 0], [0.004, (R - 0.03) * 2, 0.004], '#d9dde0', [0, 0, i / 8 * Math.PI]);
  return g;
}
/** City bicycle (ママチャリ); local forward +Z, origin on the ground between the wheels. */
export function bicycle(p, K, x, y, z, rotY, o = {}) {
  const g = PR.grp(p, x, y, z, rotY);
  const f = (c) => K.im(c, 0.28);
  const R = 0.33, wb = 1.08;
  const fm = f(o.frame || '#e9e2cf'), dark = f('#3a3346'), steel = f('#c9ccd0');
  wheel(g, K, 0, R, wb / 2, R, Math.PI / 2); wheel(g, K, 0, R, -wb / 2, R, Math.PI / 2);
  const hub = [0, R, -wb / 2], crank = [0, 0.3, -0.05], head = [0, 0.9, 0.36], headLo = [0, 0.72, 0.4];
  PR.tube(g, crank, headLo, 0.022, fm); PR.tube(g, crank, [0, 0.82, -0.28], 0.022, fm); PR.tube(g, crank, hub, 0.014, fm); PR.tube(g, [0, 0.72, -0.3], hub, 0.012, fm);
  PR.tube(g, headLo, [0, R, wb / 2], 0.016, fm); PR.tube(g, headLo, head, 0.02, fm);
  PR.tube(g, head, [0, 1.02, 0.28], 0.015, steel);
  PR.tube(g, [-0.28, 1.02, 0.26], [0.28, 1.02, 0.26], 0.012, steel);
  for (const s of [-1, 1]) K.cyl(g, 0.018, 0.1, dark, [s * 0.26, 1.02, 0.26], 8, [0, 0, Math.PI / 2]);
  K.rbox(g, 0.12, 0.05, 0.24, 0.3, dark, [0, 0.86, -0.3]);
  K.cyl(g, 0.07, 0.02, steel, [0, 0.3, -0.05], 12, [0, 0, Math.PI / 2]);
  for (const s of [-1, 1]) { K.I.add('boxc', g, [s * 0.07, 0.3, -0.05], [0.02, 0.16, 0.02], '#6d747c', [0.9, 0, 0]); K.I.add('boxc', g, [s * 0.1, 0.3 + (s > 0 ? 0.06 : -0.06), -0.05 + (s > 0 ? -0.05 : 0.05)], [0.08, 0.015, 0.03], '#3a3346'); }
  for (const zz of [wb / 2, -wb / 2]) { const mg = new THREE.Mesh(new THREE.TorusGeometry(R + 0.03, 0.02, 3, 12, Math.PI * 0.8), steel); mg.position.set(0, R, zz); mg.rotation.set(0, Math.PI / 2, zz > 0 ? 0.25 : 0.35); g.add(mg); }
  K.box(g, 0.02, 0.08, 0.5, fm, [0.05, 0.32, -0.3]);
  K.box(g, 0.14, 0.012, 0.32, steel, [0, 0.72, -0.55]);
  if (o.basket) { const bm = f('#b9bfc4'); K.box(g, 0.34, 0.012, 0.26, bm, [0, 0.78, 0.62]); for (const s of [-1, 1]) { K.box(g, 0.34, 0.2, 0.01, bm, [0, 0.88, 0.62 + s * 0.13]); K.box(g, 0.01, 0.2, 0.26, bm, [s * 0.17, 0.88, 0.62]); } }
  if (o.light) K.cyl(g, 0.03, 0.05, f('#e8c547'), [0, 0.8, 0.52], 10, [Math.PI / 2, 0, 0]);
  if (!o.noKick) PR.tube(g, [0.05, 0.3, -0.45], [0.12, 0.0, -0.55], 0.01, steel);
  return g;
}

export function buildBikeInterior(ctx, K, S, P) {
  const { FL, ZF, ZI, WT, X0, X1 } = P;
  const g = S.g, I = K.I, { T, F } = K;
  const B = (w, h, d, m, p, r) => K.box(g, w, h, d, m, p, r);
  const xi0 = X0 + WT, xi1 = 2.45, zi0 = ZF - WT, CH = FL + 2.9, xo1 = X1 - WT;
  const rnd = ctx.rng('sb-bike-int');
  const iWall = K.im('#e5ddcc', 0.3, { map: T.plaster });
  const iWood = K.im('#a1774f', 0.3, { map: T.grain });
  const iWoodDark = K.im('#6a4c3a', 0.26, { map: T.grain });
  const iSteel = K.im('#9aa1a8', 0.26), iSteelL = K.im('#c9ccd0', 0.3), iGreen = K.im('#6f8a7a', 0.26);
  const iCeil = K.im('#dcd6ca', 0.28);

  // ------------------------------------------------------------------ shell
  B(X1 - X0 - 2 * WT, 0.04, zi0 - ZI, iCeil, [0, CH + 0.02, (zi0 + ZI) / 2]);
  K.tbox(g, X1 - X0 - 2 * WT, CH - FL, 0.02, iWall, [0, (CH + FL) / 2, ZI + 0.01], 2.5);
  K.tbox(g, 0.02, CH - FL, zi0 - ZI, iWall, [xi0 + 0.01, (CH + FL) / 2, (zi0 + ZI) / 2], 2.5);
  K.tbox(g, 0.1, CH - FL, zi0 - ZI - 1.2, iWall, [xi1 + 0.05, (CH + FL) / 2, (zi0 + ZI - 1.2) / 2], 2.5);   // partition to the office
  S.box(xi1, ZI, xi1 + 0.1, zi0 - 1.2, FL, CH);
  K.tbox(g, xo1 - xi1 - 0.1, CH - FL, 0.02, iWall, [(xi1 + 0.1 + xo1) / 2, (CH + FL) / 2, zi0 - 0.01], 2.5);
  K.tbox(g, 0.02, CH - FL, zi0 - ZI, iWall, [xo1 - 0.01, (CH + FL) / 2, (zi0 + ZI) / 2], 2.5);
  const oil = K.memo('decal', '#ffffff', { map: oilTex(K) });
  for (const [x, z, s, r] of [[-1.2, -5.2, 0.9, 0.4], [0.9, -4.6, 0.7, 2.1], [-2.6, -6.8, 0.6, 1.0]]) ctx.noOutline(K.plane(g, s, s * 0.8, oil, [x, FL + 0.004, z], r, -Math.PI / 2));
  for (const z of [-3.6, -6.2]) for (const x of [-2.4, 0.6]) { B(1.25, 0.05, 0.12, K.im('#dcd9d2', 0.3), [x, CH - 0.03, z]); K.cylX(g, 0.018, 1.18, K.lamp(1.45, '#f4f7ff'), [x, CH - 0.07, z], 8); K.lightPool(g, x, FL + 0.012, z, 2.4, 1.8, { opacity: 0.1, color: '#f4f7ff' }); }

  // ------------------------------------------------------------------ back wall: drawer cabinet, workbench, pegboard, parts shelf
  {  // steel parts-drawer cabinet (4 × 10 small drawers)
    const cg = PR.grp(g, -3.64, FL, ZI + 0.02, 0);
    K.box(cg, 0.7, 1.6, 0.45, iGreen, [0, 0.8, 0.225]);
    for (let c = 0; c < 4; c++) for (let r = 0; r < 10; r++) {
      const dx = -0.255 + c * 0.17, dy = 0.1 + r * 0.148;
      I.add('box', cg, [dx, dy, 0.45], [0.155, 0.13, 0.012], (c + r) % 7 === 0 ? '#8fa89a' : '#7f9a8a');
      I.add('box', cg, [dx, dy + 0.02, 0.462], [0.05, 0.014, 0.014], '#c9ccd0');
      I.add('box', cg, [dx, dy + 0.075, 0.4625], [0.07, 0.03, 0.002], '#f2eee4');
    }
    for (let i = 0; i < 3; i++) I.add('box', cg, [-0.2 + i * 0.2, 1.6, 0.22], [0.17, 0.12 - i * 0.02, 0.3], ['#e9a23b', '#e9e2cf', '#d9463b'][i]);
    S.box(-4.05, ZI, -3.27, ZI + 0.5, FL, FL + 1.8);
  }
  {  // workbench
    const bx0 = -3.2, bx1 = 0.2, bz0 = ZI + 0.02, bz1 = ZI + 0.72, top = FL + 0.91, bmx = (bx0 + bx1) / 2;
    K.tbox(g, bx1 - bx0, 0.06, bz1 - bz0, K.im('#9a7654', 0.3, { map: T.grain }), [bmx, top - 0.03, (bz0 + bz1) / 2], 1);
    for (const x of [bx0 + 0.04, bmx, bx1 - 0.04]) for (const z of [bz0 + 0.04, bz1 - 0.04]) B(0.05, 0.85, 0.05, iSteel, [x, FL + 0.425, z]);
    B(bx1 - bx0 - 0.04, 0.03, bz1 - bz0 - 0.06, iSteel, [bmx, FL + 0.25, (bz0 + bz1) / 2]);
    B(bx1 - bx0, 0.1, 0.03, iSteel, [bmx, top - 0.1, bz1 - 0.015]);
    // under-shelf: bins, bucket, oil cans, a tub of bolts
    for (let i = 0; i < 4; i++) I.add('box', g, [bx0 + 0.3 + i * 0.36, FL + 0.265, bz0 + 0.3], [0.3, 0.16, 0.36], ['#3f7fb5', '#e8c547', '#d9463b', '#3f7fb5'][i]);
    I.add('cup', g, [-1.25, FL + 0.265, bz0 + 0.3], [0.28, 0.26, 0.28], '#9aa1a8');
    for (let i = 0; i < 3; i++) { I.add('cyl', g, [-0.8 + i * 0.14, FL + 0.265, bz0 + 0.4], [0.1, 0.16, 0.1], ['#d9463b', '#3f7fb5', '#e8c547'][i]); I.add('cyl', g, [-0.8 + i * 0.14, FL + 0.425, bz0 + 0.4], [0.03, 0.03, 0.03], '#3a3346'); }
    I.add('cyl16', g, [-0.25, FL + 0.265, bz0 + 0.35], [0.26, 0.12, 0.26], '#6d747c');
    // vise on the front-right corner
    const vg = PR.grp(g, bx1 - 0.18, top, bz1 - 0.05, 0);
    I.add('box', vg, [0, 0, 0], [0.16, 0.03, 0.16], '#2f4f86');
    I.add('box', vg, [0, 0.03, -0.02], [0.1, 0.08, 0.2], '#2f4f86');
    I.add('box', vg, [0, 0.03, 0.09], [0.1, 0.07, 0.04], '#2f4f86');
    for (const dz of [0.066, 0.112]) I.add('boxc', vg, [0, 0.13, dz], [0.15, 0.05, 0.014], '#6d747c');
    I.add('cylc', vg, [0, 0.07, 0.15], [0.02, 0.12, 0.02], '#c9ccd0', [Math.PI / 2, 0, 0]);
    I.add('cylc', vg, [0, 0.07, 0.21], [0.014, 0.22, 0.014], '#c9ccd0', [0, 0, Math.PI / 2]);
    for (const s of [-1, 1]) I.add('sph', vg, [s * 0.11, 0.07, 0.21], 0.028, '#c9ccd0');
    // bench grinder
    const gg = PR.grp(g, bx0 + 0.35, top, bz0 + 0.3, 0);
    I.add('box', gg, [0, 0, 0], [0.18, 0.06, 0.14], '#4f5a60');
    I.add('cylc', gg, [0, 0.12, 0], [0.13, 0.2, 0.13], '#3f7fb5', [0, 0, Math.PI / 2]);
    for (const s of [-1, 1]) { I.add('disc', gg, [s * 0.14, 0.12, 0], [0.16, 0.025, 0.16], '#9aa1a8', [0, 0, Math.PI / 2]); I.add('box', gg, [s * 0.15, 0.1, 0.02], [0.05, 0.14, 0.12], '#3f7fb5'); }
    // red toolbox
    const tg = PR.grp(g, -1.35, top, bz0 + 0.3, 0.1);
    I.add('box', tg, [0, 0, 0], [0.46, 0.18, 0.22], '#c9463e'); I.add('box', tg, [0, 0.18, 0], [0.47, 0.04, 0.225], '#b8423c');
    for (const s of [-1, 1]) I.add('box', tg, [s * 0.1, 0.22, 0], [0.02, 0.05, 0.02], '#3a3346');
    I.add('cylc', tg, [0, 0.265, 0], [0.024, 0.22, 0.024], '#3a3346', [0, 0, Math.PI / 2]);
    I.add('box', tg, [0.08, 0.13, 0.112], [0.06, 0.02, 0.008], '#c9ccd0');
    // truing stand with a wheel
    const ts = PR.grp(g, -2.25, top, bz0 + 0.36, 0);
    I.add('box', ts, [0, 0, 0], [0.5, 0.04, 0.16], '#4f5a60');
    for (const s of [-1, 1]) I.add('box', ts, [s * 0.22, 0.04, 0], [0.03, 0.34, 0.03], '#4f5a60');
    I.add('box', ts, [0, 0.3, 0.02], [0.03, 0.08, 0.04], '#d9463b');
    wheel(ts, K, 0, 0.36, 0, 0.3, 0);
    // oil can, spray cans, rags, parts trays with bolts, wrenches lying
    I.add('cyl', g, [-0.55, top, bz0 + 0.5], [0.1, 0.08, 0.1], '#d9a441'); I.add('cone', g, [-0.55, top + 0.08, bz0 + 0.5], [0.1, 0.06, 0.1], '#d9a441');
    PR.tube(g, [-0.55, top + 0.13, bz0 + 0.5], [-0.42, top + 0.26, bz0 + 0.6], 0.005, K.im('#c9ccd0', 0.3), 5);
    for (let i = 0; i < 3; i++) { I.add('cyl', g, [-0.75 + i * 0.07, top, bz0 + 0.14], [0.062, 0.2, 0.062], ['#d9463b', '#3f7fb5', '#e9e2cf'][i]); I.add('cyl', g, [-0.75 + i * 0.07, top + 0.2, bz0 + 0.14], [0.05, 0.03, 0.05], '#f4efe6'); }
    I.add('sph', g, [-1.85, top + 0.015, bz0 + 0.5], [0.24, 0.04, 0.18], '#c9463e', [0, 0.4, 0]);
    for (let i = 0; i < 3; i++) { const tx = -1.8 + i * 0.16; I.add('box', g, [tx, top, bz0 + 0.18], [0.14, 0.03, 0.1], '#6d747c'); for (let k = 0; k < 5; k++) I.add('ball', g, [tx + rnd.range(-0.05, 0.05), top + 0.035, bz0 + 0.18 + rnd.range(-0.03, 0.03)], 0.018, ['#c9ccd0', '#d1ad5c', '#9aa1a8'][i]); }
    for (let i = 0; i < 2; i++) I.add('boxc', g, [-0.95 + i * 0.06, top + 0.006, bz0 + 0.55], [0.022, 0.012, 0.2], '#c9ccd0', [0, 0.3 + i * 0.4, 0]);
    // clamp lamp over the vise
    PR.tube(g, [bx1 - 0.08, top, bz0 + 0.06], [bx1 - 0.08, top + 0.45, bz0 + 0.1], 0.012, iSteel, 6);
    PR.tube(g, [bx1 - 0.08, top + 0.45, bz0 + 0.1], [bx1 - 0.18, top + 0.55, bz0 + 0.45], 0.012, iSteel, 6);
    K.cyl(g, 0.02, 0.12, K.im('#2f4f86', 0.3), [bx1 - 0.18, top + 0.5, bz0 + 0.5], 12, [0.5, 0, 0], 0.08);
    K.sph(g, 0.03, K.lamp(1.6, '#fff1d4'), [bx1 - 0.18, top + 0.45, bz0 + 0.53], 8);
    K.lightPool(g, bx1 - 0.2, top + 0.003, bz1 - 0.1, 0.9, 0.7, { opacity: 0.22 });
    S.box(bx0 - 0.05, ZI, bx1 + 0.05, bz1 + 0.05, FL, FL + 1.0);
    // pegboard with modelled tools
    K.tbox(g, bx1 - bx0, 1.2, 0.03, K.im('#d9cfb9', 0.3, { map: T.peg }), [bmx, FL + 1.75, ZI + 0.035], 0.8);
    pegboardTools(K, g, bmx, FL + 1.75, ZI + 0.05, rnd);
  }
  {  // steel parts shelf right of the bench
    const sg = PR.shelfUnit(g, K, 1.4, FL, ZI + 0.02, 0, 1.9, 0.45, 1.9, [0.45, 0.9, 1.35], { mat: iSteelL, dark: iSteel, backMat: K.im('#bfc4c6', 0.26) });
    for (let s = 0; s < 3; s++) for (let k = 0; k < 4; k++) I.add('tyre', sg, [-0.62 + s * 0.6, 0.12 + k * 0.058, 0.23], 0.56, '#3f3a44', [Math.PI / 2, 0, 0]);
    for (let i = 0; i < 8; i++) { const x = -0.8 + i * 0.22; I.add('box', sg, [x, 0.45, 0.24], [0.19, 0.12, 0.28], ['#e9a23b', '#e9e2cf', '#d9463b', '#5f8fcf'][i % 4]); I.add('box', sg, [x, 0.49, 0.381], [0.16, 0.04, 0.002], '#f7f3ea'); }
    for (let i = 0; i < 4; i++) { const x = -0.7 + i * 0.3; I.add('sph', sg, [x, 0.98, 0.22], [0.22, 0.16, 0.27], ['#d9463b', '#f4efe6', '#3f7fb5', '#e8c547'][i]); I.add('box', sg, [x, 0.9, 0.22], [0.2, 0.02, 0.24], '#3a3346'); }
    for (let i = 0; i < 3; i++) { const x = 0.55 + i * 0.13; I.add('tyre', sg, [x, 1.02, 0.25], [0.14, 0.2, 0.3], '#3a3346', [0, 0, 0]); I.add('box', sg, [x, 0.9, 0.25], [0.1, 0.05, 0.04], '#c9ccd0'); }
    for (let i = 0; i < 2; i++) { const x = -0.45 + i * 0.5; I.add('box', sg, [x, 1.35, 0.23], [0.34, 0.012, 0.26], '#b9bfc4'); for (const s of [-1, 1]) { I.add('box', sg, [x, 1.35, 0.23 + s * 0.125], [0.34, 0.22, 0.008], '#b9bfc4'); I.add('box', sg, [x + s * 0.165, 1.35, 0.23], [0.008, 0.22, 0.26], '#b9bfc4'); } }
    for (let i = 0; i < 4; i++) { const x = 0.35 + i * 0.14; I.add('box', sg, [x, 1.35, 0.25], [0.08, 0.06, 0.1], '#3a3346'); I.add('disc', sg, [x, 1.38, 0.3], [0.05, 0.005, 0.05], '#f6ecb0', [Math.PI / 2, 0, 0]); I.add('sph', sg, [x, 1.46, 0.3], 0.05, i % 2 ? '#c9ccd0' : '#e8c547'); }
    for (let i = 0; i < 4; i++) I.add('box', sg, [-0.7 + i * 0.45, 1.9, 0.22], [0.4, 0.2 - (i % 2) * 0.05, 0.36], ['#c8b28a', '#e9e2cf', '#c8b28a', '#d9d0bb'][i]);
    K.plane(sg, 0.5, 0.12, K.im('#ffffff', 0.35, { map: K.card(['部品 ・ チューブ'], { w: 256, h: 64, bg: '#f4efe2', fg: '#2f4f86', font: F.round, size0: 34 }) }), [0, 1.62, 0.455]);
    S.box(0.45, ZI, 2.35, ZI + 0.5, FL, FL + 2.0);
  }

  // ------------------------------------------------------------------ left wall: tyre rack, hanging inner tubes, tube boxes
  {
    const rx = xi0 + 0.12;
    for (const y of [1.25, 2.1]) {
      I.add('cylc', g, [rx + 0.1, FL + y, -5.0], [0.04, 3.6, 0.04], '#9aa1a8', [Math.PI / 2, 0, 0]);
      for (const zz of [-6.5, -3.5]) I.add('boxc', g, [rx, FL + y, zz], [0.2, 0.03, 0.03], '#9aa1a8');
      for (let i = 0; i < 9; i++) I.add('tyre', g, [rx + 0.14, FL + y - 0.3, -6.6 + i * 0.4], 0.6, i % 3 === 0 ? '#4a4450' : '#3f3a44', [0, Math.PI / 2 + 0.25, 0]);
    }
    K.plane(g, 0.5, 0.2, K.im('#ffffff', 0.3, { map: K.card(['タイヤ各種', '24・26・27インチ'], { w: 256, h: 100, bg: '#f4efe2', fg: '#2f4f86', fg2: '#3a3346' }) }), [xi0 + 0.025, FL + 2.55, -5.0], Math.PI / 2);
    for (let i = 0; i < 4; i++) { const z = -7.0 - i * 0.14; I.add('cylc', g, [xi0 + 0.04, FL + 1.95, z], [0.012, 0.08, 0.012], '#8d949b', [0, 0, Math.PI / 2]); I.add('ring', g, [xi0 + 0.1, FL + 1.65, z], [0.3, 0.62, 0.9], '#3a3346', [0, Math.PI / 2, 0.1 * (i % 2 ? 1 : -1)]); }
    for (let i = 0; i < 6; i++) { I.add('box', g, [rx + 0.1, FL + (i % 3) * 0.12, -3.2 - Math.floor(i / 3) * 0.34], [0.22, 0.12, 0.3], ['#e9a23b', '#e9e2cf', '#d9463b'][i % 3]); I.add('box', g, [rx + 0.211, FL + (i % 3) * 0.12 + 0.03, -3.2 - Math.floor(i / 3) * 0.34], [0.002, 0.05, 0.2], '#f7f3ea'); }
    K.plane(g, 0.42, 0.6, K.im('#ffffff', 0.3, { map: P.safetyPoster }), [xi0 + 0.025, FL + 1.55, -7.75], Math.PI / 2);
    S.box(xi0, -7.5, xi0 + 0.48, -2.95, FL, FL + 2.5);
  }
  // wheels hanging from the ceiling
  for (let i = 0; i < 5; i++) { const zz = -3.4 - i * 0.5; K.cyl(g, 0.006, 0.25, iSteel, [-1.0, CH - 0.12, zz], 4); wheel(g, K, -1.0, CH - 0.6, zz, 0.3, Math.PI / 2); }
  // air compressor at the front-left pier (feeds the free pump outside)
  {
    const cg = PR.grp(g, -3.45, FL, -2.98, 0);
    I.add('cylc', cg, [0, 0.22, 0], [0.3, 0.52, 0.3], '#c9463e', [0, 0, Math.PI / 2]);
    for (const s of [-1, 1]) I.add('sph', cg, [s * 0.26, 0.22, 0], [0.12, 0.3, 0.3], '#c9463e');
    I.add('box', cg, [0.02, 0.37, 0], [0.26, 0.16, 0.2], '#3a3346');
    I.add('cylc', cg, [-0.12, 0.45, 0], [0.1, 0.1, 0.1], '#6d747c', [0, 0, Math.PI / 2]);
    I.add('disc', cg, [0.2, 0.43, 0.02], [0.07, 0.02, 0.07], '#c9ccd0', [Math.PI / 2, 0, 0]);
    K.plane(cg, 0.058, 0.058, K.im('#ffffff', 0.4, { map: gaugeTex(K) }), [0.2, 0.43, 0.041]);
    for (const s of [-1, 1]) I.add('disc', cg, [-0.28, 0.07, s * 0.14], [0.14, 0.04, 0.14], '#3a3346', [Math.PI / 2, 0, 0]);
    I.add('box', cg, [0.26, 0, 0], [0.05, 0.1, 0.2], '#3a3346');
    PR.tube(cg, [0.3, 0.3, 0], [0.42, 0.62, 0], 0.012, K.im('#3a3346', 0.2), 6); I.add('cylc', cg, [0.42, 0.66, 0], [0.012, 0.22, 0.012], '#3a3346', [Math.PI / 2, 0, 0]);
    I.add('ring', g, [xi0 + 0.06, FL + 1.25, -2.98], 0.34, '#2f4f86', [0, Math.PI / 2, 0]);
    I.add('ring', g, [xi0 + 0.07, FL + 1.25, -2.98], 0.3, '#2f4f86', [0, Math.PI / 2, 0.3]);
    I.add('cylc', g, [xi0 + 0.04, FL + 1.42, -2.98], [0.014, 0.08, 0.014], '#8d949b', [0, 0, Math.PI / 2]);
    PR.tube(g, [xi0 + 0.08, FL + 1.08, -2.98], [-3.2, FL + 0.45, -2.98], 0.01, K.im('#2f4f86', 0.3), 5);
    S.box(-3.85, -3.2, -3.05, -2.72, FL, FL + 0.8);
  }
  // repair stand with a clamped bike, rubber mat, tool cart, stool, puncture tub
  {
    const sx = 0.3, sz = -4.3;
    I.add('box', g, [0.55, FL, sz], [2.2, 0.012, 1.1], '#4f5a60');
    K.cyl(g, 0.3, 0.03, iSteel, [sx, FL + 0.027, sz], 14);
    K.cyl(g, 0.03, 1.15, K.im('#d9463b', 0.3), [sx, FL + 0.6, sz], 10);
    K.box(g, 0.08, 0.5, 0.08, K.im('#d9463b', 0.3), [sx + 0.18, FL + 1.1, sz], [0, 0, -0.9]);
    K.box(g, 0.12, 0.1, 0.1, K.im('#3a3346', 0.2), [sx + 0.38, FL + 1.25, sz]);
    bicycle(g, K, sx + 0.35, FL + 0.28, sz, Math.PI / 2, { frame: '#8fd1c1', noKick: true });
    S.cyl(sx, sz, 0.35, FL, FL + 1.3);
    S.box(sx - 0.6, sz - 0.2, sx + 1.3, sz + 0.2, FL + 0.2, FL + 1.3);
    // steel tool cart
    const tc = PR.grp(g, -0.65, FL, -5.05, 0.2);
    for (const y of [0.18, 0.55, 0.85]) { K.box(tc, 0.56, 0.02, 0.38, iSteelL, [0, y, 0]); for (const s of [-1, 1]) I.add('box', tc, [0, y, s * 0.185], [0.56, 0.04, 0.01], '#b9bfc4'); }
    for (const [lx, lz] of [[-0.27, -0.18], [0.27, -0.18], [-0.27, 0.18], [0.27, 0.18]]) { I.add('box', tc, [lx, 0.06, lz], [0.02, 0.8, 0.02], '#9aa1a8'); I.add('disc', tc, [lx, 0.03, lz], [0.05, 0.02, 0.05], '#3a3346', [Math.PI / 2, 0, 0]); }
    for (let i = 0; i < 6; i++) I.add('boxc', tc, [-0.2 + i * 0.08, 0.87, 0.02], [0.022, 0.012, 0.18 - (i % 3) * 0.02], '#c9ccd0', [0, 0.1 * (i % 2), 0]);
    for (let i = 0; i < 3; i++) I.add('box', tc, [0.12 + i * 0.05, 0.56, -0.05], [0.03, 0.012, 0.12], ['#d9463b', '#e8c547', '#3f7fb5'][i], [0, 0.3, 0]);
    I.add('cyl16', tc, [-0.12, 0.56, 0.02], [0.14, 0.08, 0.14], '#e8c547'); I.add('cyl16', tc, [-0.12, 0.64, 0.02], [0.145, 0.015, 0.145], '#3a3346');
    I.add('rbox', tc, [0.0, 0.19, 0.0], [0.4, 0.1, 0.26], '#c9463e');
    S.box(-0.98, -5.3, -0.32, -4.8, FL, FL + 0.9);
    PR.stool(g, K, -0.25, FL, -3.55, { h: 0.5, color: '#8a6446' });
    S.cyl(-0.25, -3.55, 0.2, FL, FL + 0.55);
    const tb = PR.grp(g, 0.75, FL, -5.65, 0.1);
    K.box(tb, 0.5, 0.25, 0.3, K.im('#3f7fb5', 0.3), [0, 0.28, 0]);
    K.box(tb, 0.46, 0.02, 0.26, K.im('#bcd6e2', 0.45), [0, 0.39, 0]);
    for (const [lx, lz] of [[-0.21, 0.12], [-0.21, -0.12], [0.21, 0.12], [0.21, -0.12]]) K.box(tb, 0.04, 0.16, 0.04, iSteel, [lx, 0.08, lz]);
    I.add('ring', tb, [0.05, 0.4, 0], [0.3, 0.3, 0.6], '#3a3346', [Math.PI / 2, 0, 0]);
    S.box(0.48, -5.83, 1.02, -5.47, FL, FL + 0.45);
  }
  // bikes for sale along the partition (+ price tags)
  [['#e9e2cf', '¥24,800', -4.4], ['#f2b5c8', '¥21,800', -6.3]].forEach(([c, pr, bz], i) => {
    bicycle(g, K, 1.95, FL, bz, i ? 0.06 : -0.04, { frame: c, basket: true, light: true });
    K.plane(g, 0.14, 0.1, K.im('#ffffff', 0.35, { map: K.card(['新車', pr], { w: 160, h: 112, bg: '#fbf6ea', fg: '#c9463e', fg2: '#3a3346', border: '#c9463e' }) }), [2.07, FL + 1.0, bz + 0.64], 0, -0.2);
    S.box(1.62, bz - 0.9, 2.3, bz + 0.9, FL, FL + 1.1);
  });
  K.plane(g, 0.36, 0.5, K.im('#ffffff', 0.3, { map: calTex(K) }), [2.2, FL + 1.9, ZI + 0.025]);

  // ------------------------------------------------------------------ office: accessory counter + register, desk & phone, key box, shelf, noren
  {
    const ox0 = 2.6, ox1 = 4.0, oz0 = -4.85, oz1 = -4.4, ch = FL + 0.95;
    K.tbox(g, ox1 - ox0, 0.6, oz1 - oz0, iWoodDark, [(ox0 + ox1) / 2, FL + 0.3, (oz0 + oz1) / 2], 1);
    K.box(g, ox1 - ox0 + 0.02, 0.02, oz1 - oz0 + 0.02, K.im('#f2ece0', 0.42), [(ox0 + ox1) / 2, FL + 0.61, (oz0 + oz1) / 2]);
    const gx1 = 3.45;
    for (const [z, w] of [[oz1, 0.006], [oz0, 0.006]]) { const gp = B(gx1 - ox0, 0.33, w, K.glass({ opacity: 0.1, streaks: z === oz1 }), [(ox0 + gx1) / 2, FL + 0.785, z]); gp.castShadow = false; ctx.noOutline(gp); }
    const gt = B(gx1 - ox0, 0.006, oz1 - oz0, K.glass({ opacity: 0.1 }), [(ox0 + gx1) / 2, ch - 0.003, (oz0 + oz1) / 2]); gt.castShadow = false; ctx.noOutline(gt);
    B(0.025, 0.34, oz1 - oz0, iWoodDark, [ox0 + 0.0125, FL + 0.785, (oz0 + oz1) / 2]);
    for (const z of [oz0, oz1]) B(gx1 - ox0, 0.02, 0.02, iWoodDark, [(ox0 + gx1) / 2, ch - 0.01, z]);
    K.tbox(g, ox1 - gx1, 0.34, oz1 - oz0, iWoodDark, [(gx1 + ox1) / 2, FL + 0.78, (oz0 + oz1) / 2], 1);
    B(ox1 - gx1 + 0.03, 0.03, oz1 - oz0 + 0.04, iWood, [(gx1 + ox1) / 2, ch - 0.015, (oz0 + oz1) / 2]);
    // accessories under the glass: bells, lamps, locks, reflectors, grips, valve caps
    const bed = FL + 0.62;
    for (let i = 0; i < 4; i++) { const x = 2.72 + i * 0.1; I.add('sph', g, [x, bed + 0.025, -4.72], [0.055, 0.045, 0.055], i % 2 ? '#c9ccd0' : '#e8c547'); I.add('box', g, [x + 0.02, bed, -4.72], [0.03, 0.008, 0.02], '#3a3346'); }
    for (let i = 0; i < 3; i++) { const x = 2.75 + i * 0.13; I.add('box', g, [x, bed, -4.55], [0.07, 0.05, 0.09], '#3a3346'); I.add('disc', g, [x, bed + 0.025, -4.5], [0.05, 0.006, 0.05], '#f6ecb0', [Math.PI / 2, 0, 0]); }
    for (let i = 0; i < 3; i++) I.add('disc', g, [3.18 + i * 0.08, bed, -4.72], [0.06, 0.012, 0.06], ['#d9463b', '#e9a23b', '#d9463b'][i]);
    for (let i = 0; i < 2; i++) { I.add('box', g, [3.3, bed, -4.55 - i * 0.08], [0.1, 0.04, 0.05], '#9aa1a8'); I.add('ring', g, [3.3, bed + 0.07, -4.55 - i * 0.08], [0.08, 0.1, 0.4], '#c9ccd0'); }
    K.plane(g, 0.3, 0.08, K.im('#ffffff', 0.36, { map: K.card(['ベル・ライト・カギ'], { w: 256, h: 64, bg: '#f4efe2', fg: '#2f4f86', font: F.round, size0: 30 }) }), [3.02, FL + 0.5, oz1 + 0.004]);
    PR.register(g, K, 3.72, ch, -4.62, Math.PI, { color: '#9aa39a' });
    PR.calculator(g, K, 3.55, ch, -4.47, 0.1);
    S.box(ox0, oz0, ox1, oz1, FL, FL + 1.1);
    // desk with rotary phone + ledger against the side wall, key box above, stool
    const dg = PR.grp(g, 3.76, FL, -5.75, -Math.PI / 2);
    K.tbox(dg, 0.8, 0.04, 0.5, iWood, [0, 0.72, 0], 1);
    for (const sx of [-0.36, 0.36]) K.box(dg, 0.04, 0.7, 0.46, iWoodDark, [sx, 0.35, 0]);
    K.box(dg, 0.3, 0.2, 0.44, iWoodDark, [0.2, 0.55, 0]);
    const ph = PR.grp(dg, -0.18, 0.74, 0.05, 0.3);
    I.add('rbox', ph, [0, 0, 0], [0.2, 0.09, 0.22], '#3a3346'); I.add('disc', ph, [0, 0.065, 0.05], [0.12, 0.012, 0.12], '#c9ccd0', [-0.6, 0, 0]);
    I.add('rbox', ph, [0, 0.09, -0.02], [0.22, 0.05, 0.06], '#3a3346'); for (const s of [-1, 1]) I.add('sph', ph, [s * 0.1, 0.1, -0.02], [0.07, 0.05, 0.07], '#3a3346');
    I.add('box', dg, [0.15, 0.74, 0.05], [0.24, 0.02, 0.32], '#e9e0cc', [0, 0.2, 0]);
    I.add('cyl', dg, [0.32, 0.74, -0.12], [0.06, 0.1, 0.06], '#6a8a58');
    for (let k = 0; k < 3; k++) I.add('stick', dg, [0.32 + (k - 1) * 0.01, 0.8, -0.12], [0.008, 0.12, 0.008], ['#d9463b', '#3a3346', '#3f7fb5'][k]);
    const kb = PR.grp(g, xo1 - 0.01, FL + 1.55, -5.75, -Math.PI / 2);
    K.box(kb, 0.5, 0.4, 0.06, K.im('#8a6446', 0.3), [0, 0, 0.03]);
    for (let i = 0; i < 12; i++) { const kx = -0.19 + (i % 6) * 0.076, ky = 0.08 - Math.floor(i / 6) * 0.16; I.add('cylc', kb, [kx, ky, 0.07], [0.008, 0.03, 0.008], '#c9ccd0', [Math.PI / 2, 0, 0]); if (i % 3 !== 2) { I.add('ring', kb, [kx, ky - 0.035, 0.078], 0.03, '#d1ad5c', [0, 0, 0]); I.add('box', kb, [kx, ky - 0.1, 0.078], [0.03, 0.045, 0.004], ['#e8c547', '#3f7fb5', '#d9463b'][i % 3]); } }
    PR.stool(g, K, 3.15, FL, -5.75, { h: 0.45, color: '#8a6446' });
    S.box(3.5, -6.2, xo1, -5.3, FL, FL + 0.8); S.cyl(3.15, -5.75, 0.2, FL, FL + 0.5);
    // shelf of boxed parts on the side wall
    const sh = PR.shelfUnit(g, K, xo1 - 0.02, FL, -6.95, -Math.PI / 2, 1.2, 0.4, 1.9, [0.5, 0.95, 1.4], { mat: iWood, dark: iWoodDark });
    for (const y of [0.08, 0.5, 0.95, 1.4]) for (let i = 0; i < 4; i++) I.add('box', sh, [-0.42 + i * 0.28, y, 0.2], [0.24, 0.12 + ((i + y * 10) % 3) * 0.06, 0.3], ['#c8b28a', '#e9e2cf', '#d9d0bb', '#e9a23b'][(i + Math.round(y * 5)) % 4]);
    S.box(xo1 - 0.44, -7.55, xo1, -6.35, FL, FL + 1.95);
    // doorway to the house with a noren
    K.box(g, 0.86, 1.9, 0.02, K.im('#5a4a3e', 0.14, { map: T.plaster }), [3.05, FL + 0.95, ZI + 0.021]);
    for (const x of [2.6, 3.5]) B(0.06, 1.95, 0.05, iWoodDark, [x, FL + 0.975, ZI + 0.03]);
    B(0.96, 0.06, 0.05, iWoodDark, [3.05, FL + 1.95, ZI + 0.03]);
    K.noren(S, { x: 3.05, y: FL + 1.86, z: ZI + 0.08, w: 0.84, h: 0.95, n: 2, tex: innerNorenTex(K), rodColor: '#6a4c3a' });
    K.plane(g, 0.34, 0.5, K.im('#ffffff', 0.3, { map: P.safetyPoster }), [2.556, FL + 1.55, -4.2], Math.PI / 2);
    K.plane(g, 0.36, 0.12, K.im('#ffffff', 0.35, { map: K.card(['修理受付'], { w: 192, h: 64, bg: '#2f4f86', fg: '#fdf8ee', font: F.round, size0: 36 }) }), [3.3, FL + 2.2, zi0 - 0.025], Math.PI);
    B(0.8, 0.05, 0.14, K.lamp(1.3, '#fff1d8'), [3.3, CH - 0.03, -4.2]);
    K.lightPool(g, 3.3, FL + 0.012, -3.8, 1.6, 1.8, { opacity: 0.18 });
  }
}

// ============================================================================ pegboard tools
function pegboardTools(K, p, x, y, z, rnd) {
  const I = K.I, hook = (hx, hy) => I.add('cylc', p, [hx, hy, z + 0.02], [0.008, 0.05, 0.008], '#8d949b', [Math.PI / 2, 0, 0]);
  const st = '#c9ccd0';
  // combination spanners (ring end up, open end down)
  for (let i = 0; i < 7; i++) {
    const L = 0.14 + i * 0.022, sx = x - 1.5 + i * 0.07, top = y + 0.45;
    hook(sx, top + 0.01);
    I.add('ring', p, [sx, top - 0.02, z + 0.01], 0.034 + i * 0.002, st);
    I.add('boxc', p, [sx, top - 0.02 - L / 2, z + 0.01], [0.016, L, 0.006], st);
    for (const s of [-1, 1]) I.add('boxc', p, [sx + s * 0.013, top - 0.03 - L, z + 0.01], [0.009, 0.03, 0.006], st);
  }
  // screwdrivers
  for (let i = 0; i < 6; i++) { const sx = x - 0.95 + i * 0.075, top = y + 0.45; hook(sx, top + 0.02); I.add('cylc', p, [sx, top - 0.05, z + 0.02], [0.03, 0.1, 0.03], ['#d9463b', '#3f7fb5', '#e8c547'][i % 3]); I.add('cylc', p, [sx, top - 0.17, z + 0.02], [0.007, 0.14 + (i % 2) * 0.04, 0.007], st); }
  // pliers & nippers
  for (let i = 0; i < 3; i++) {
    const sx = x - 0.4 + i * 0.13, top = y + 0.45; hook(sx, top + 0.02);
    for (const s of [-1, 1]) { I.add('boxc', p, [sx + s * 0.006, top - 0.03, z + 0.012], [0.014, 0.07, 0.008], st, [0, 0, s * 0.15]); I.add('boxc', p, [sx + s * 0.025, top - 0.13, z + 0.012], [0.018, 0.13, 0.01], ['#d9463b', '#3f7fb5', '#e8c547'][i], [0, 0, -s * 0.18]); }
  }
  // hammer
  { const sx = x + 0.05, top = y + 0.46; hook(sx, top - 0.06); I.add('boxc', p, [sx, top - 0.14, z + 0.015], [0.03, 0.26, 0.02], '#a1774f'); I.add('boxc', p, [sx, top, z + 0.02], [0.12, 0.04, 0.034], '#6d747c'); }
  // hacksaw
  { const sx = x + 0.35, top = y + 0.42; hook(sx, top + 0.03); I.add('boxc', p, [sx, top, z + 0.012], [0.34, 0.016, 0.01], '#2f4f86'); for (const s of [-1, 1]) I.add('boxc', p, [sx + s * 0.16, top - 0.05, z + 0.012], [0.016, 0.1, 0.01], '#2f4f86'); I.add('boxc', p, [sx, top - 0.09, z + 0.012], [0.32, 0.012, 0.003], st); I.add('rbox', p, [sx + 0.2, top - 0.12, z + 0.012], [0.04, 0.1, 0.02], '#d9463b'); }
  // allen key holder + keys
  { const sx = x + 0.72, top = y + 0.44; I.add('box', p, [sx, top - 0.02, z + 0.015], [0.16, 0.04, 0.03], '#3a3346'); for (let i = 0; i < 6; i++) { I.add('boxc', p, [sx - 0.06 + i * 0.024, top - 0.07, z + 0.03], [0.006, 0.08 + i * 0.01, 0.006], '#6d747c'); I.add('boxc', p, [sx - 0.052 + i * 0.024, top - 0.11 - i * 0.005, z + 0.03], [0.02, 0.006, 0.006], '#6d747c'); } }
  // tyre levers, spoke wrenches (discs), cable coils, tape rolls
  for (let i = 0; i < 3; i++) { const sx = x + 1.0 + i * 0.04; hook(sx, y + 0.46); I.add('boxc', p, [sx, y + 0.39, z + 0.015], [0.022, 0.12, 0.006], ['#e8c547', '#d9463b', '#3f7fb5'][i], [0, 0, 0.1]); }
  for (let i = 0; i < 4; i++) { const sx = x - 1.45 + i * 0.1; hook(sx, y - 0.05); I.add('disc', p, [sx, y - 0.1, z + 0.01], [0.06, 0.006, 0.06], ['#d9463b', '#2f4f86', '#e8c547', '#6f9a6a'][i], [Math.PI / 2, 0, 0]); }
  for (let i = 0; i < 3; i++) { const sx = x - 0.95 + i * 0.2; hook(sx, y + 0.02); I.add('ring', p, [sx, y - 0.08, z + 0.02], 0.18 - i * 0.02, i === 1 ? '#3a3346' : '#6d747c', [0, 0, 0.2 * i]); I.add('ring', p, [sx, y - 0.08, z + 0.024], 0.16 - i * 0.02, i === 1 ? '#3a3346' : '#6d747c', [0, 0, -0.2]); }
  { I.add('cylc', p, [x - 0.2, y - 0.02, z + 0.02], [0.01, 0.34, 0.01], '#8d949b', [0, 0, Math.PI / 2]); for (let i = 0; i < 4; i++) I.add('cylc', p, [x - 0.32 + i * 0.08, y - 0.02, z + 0.02], [0.07, 0.03, 0.07], ['#3a3346', '#e8c547', '#f4efe6', '#3f7fb5'][i], [0, 0, Math.PI / 2]); }
  // small shelf with spray cans + grease tins
  I.add('box', p, [x + 0.55, y - 0.25, z + 0.06], [0.9, 0.02, 0.12], '#8a6446');
  for (let i = 0; i < 6; i++) { const sx = x + 0.17 + i * 0.13; if (i % 3 === 2) { I.add('cyl16', p, [sx, y - 0.23, z + 0.06], [0.09, 0.06, 0.09], '#e8c547'); } else { I.add('cyl', p, [sx, y - 0.23, z + 0.06], [0.06, 0.18, 0.06], ['#d9463b', '#3f7fb5'][i % 2]); I.add('cyl', p, [sx, y - 0.05, z + 0.06], [0.045, 0.03, 0.045], '#f4efe6'); } }
  // hand pump on two hooks
  { const sx = x + 1.3; hook(sx, y + 0.35); hook(sx, y - 0.2); I.add('cylc', p, [sx, y + 0.08, z + 0.035], [0.035, 0.5, 0.035], '#3f7fb5'); I.add('cylc', p, [sx, y + 0.36, z + 0.035], [0.02, 0.12, 0.02], '#3a3346', [0, 0, Math.PI / 2]); }
}

// ============================================================================ textures
function oilTex(K) {
  return K.tex.draw(128, 128, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    const r = K.ctx.rng('oil');
    for (let i = 0; i < 5; i++) { const x = 34 + r() * 60, y = 34 + r() * 60, rad = 12 + r() * 20; const gr = g.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, 'rgba(60,55,70,0.2)'); gr.addColorStop(1, 'rgba(60,55,70,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }
  }, { key: 'sb-oil2' });
}
function gaugeTex(K) {
  return K.tex.draw(64, 64, (g, w, h) => {
    g.clearRect(0, 0, w, h); g.fillStyle = '#f7f3ea'; g.beginPath(); g.arc(32, 32, 30, 0, 7); g.fill();
    g.strokeStyle = '#3a3346'; g.lineWidth = 2; for (let i = 0; i < 9; i++) { const a = -2.4 + i * 0.6; g.beginPath(); g.moveTo(32 + Math.sin(a) * 22, 32 - Math.cos(a) * 22); g.lineTo(32 + Math.sin(a) * 27, 32 - Math.cos(a) * 27); g.stroke(); }
    g.strokeStyle = '#d9463b'; g.lineWidth = 3; g.beginPath(); g.moveTo(32, 32); g.lineTo(46, 20); g.stroke();
  }, { key: 'sb-gauge' });
}
function calTex(K) {
  return K.tex.draw(160, 224, (g, w, h) => {
    g.fillStyle = '#f5f0e6'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#9cc4ea'; g.fillRect(6, 6, w - 12, 76);
    K.text(g, '丸山', w / 2, 44, 100, 30, K.F.round, 900, '#fdf8ee');
    K.text(g, '4月', w / 2, 100, 80, 24, K.F.serif, 700, '#3a3346');
    for (let d = 1; d <= 30; d++) { const c = (d + 2) % 7, rr = Math.floor((d + 2) / 7); K.text(g, String(d), 14 + c * 22, 124 + rr * 19, 20, 12, K.F.sans, 500, c === 0 ? '#c9463e' : '#3a3346'); }
  }, { key: 'sb-bike-cal' });
}
function innerNorenTex(K) {
  return K.tex.draw(384, 300, (g, w, h) => {
    g.fillStyle = '#e9e2d0'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#2f4f86'; g.fillRect(0, 0, w, 18);
    g.fillStyle = '#6f9a6a'; for (let i = 0; i < 8; i++) { g.beginPath(); g.ellipse(40 + (i % 4) * 100, 150 + Math.floor(i / 4) * 70, 22, 9, 0.6, 0, 7); g.fill(); }
  }, { key: 'sb-bike-innernoren2' });
}
