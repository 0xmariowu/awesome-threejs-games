// E1 喫茶 はるいろ — interior, modelled: bentwood chairs, marble / wood tables with cups, saucers, spoons,
// standing menus, sugar pots and bud vases; counter with siphon bar, pour-over kettle + dripper, retro
// register, cake dome; back bar with espresso machine (group heads, portafilters, steam wand, gauges),
// grinder, cup shelves, bean jars, canisters; cake showcase with individual cakes; pendant lamps with
// shades, cords, canopies and warm light pools; corner shelf with books, jars, radio and plants; record
// player sideboard with speakers and records; coat hooks with coat/scarf/hat; rug; framed pictures.
import * as THREE from 'three';
import { makeTopiary } from '../lib/foliage.js';
import { poolMat } from './intBooks.js';

const MOSS = '#6f8455', BURG = '#8c3a45', WOOD = '#5a4032', INK = '#3a3346';

export function buildCafeInterior(ctx, C, S, D) {
  const { M, A, U, F, T, P } = C; const G = C.G; const k = S.k;
  const { FY, C1, IX0, IX1, IZ0, IZ1 } = D;
  G.setShop('E1', 0.4);
  const rr = ctx.rng('cafe.int2');
  const white = (r, lo = 0.9) => new THREE.Color().setScalar(lo + r() * (1 - lo));
  const mWoodD = M.inner('#6b4a37', 0.22, { map: T.wood }), mWoodL = M.inner('#b48a62', 0.28, { map: T.wood }), mWoodM = M.inner('#8a6446', 0.25, { map: T.wood });
  const mIron = M.inner('#3f3d45', 0.12), mBrass = M.inner('#c8a04a', 0.3), mSteel = M.inner('#c9ced3', 0.3), mSteelD = M.inner('#8f969d', 0.2);
  const mGlass = M.glass({ opacity: 0.3 }), mCoffee = M.inner('#4a2c1e', 0.1), mMarble = M.inner('#ece8e0', 0.36), mMoss = M.inner(MOSS, 0.25);
  const pool = poolMat(ctx, C);
  const ccupC = ['#f4f1e8', '#f4f1e8', '#e8d5c0', '#b7c7e6', '#f2d0d8', '#cfe0c8'];

  // ---------------- furniture builders
  function chair(x, z, ry) {
    const g = S.k.group([x, FY, z], ry); const kc = ctx.kit(g);
    kc.cyl(0.2, 0.19, 0.035, mWoodD, [0, 0.45, 0], null, 16);
    kc.cyl(0.175, 0.175, 0.03, mMoss, [0, 0.482, 0.005], null, 16);
    for (const [lx, lz] of [[-0.14, -0.14], [0.14, -0.14], [-0.14, 0.14], [0.14, 0.14]]) kc.cyl(0.013, 0.016, 0.45, mWoodD, [lx * 1.05, 0.225, lz * 1.05], [lz * 0.14, 0, -lx * 0.14], 6);
    kc.mesh(new THREE.TorusGeometry(0.158, 0.009, 4, 14), mWoodD, [0, 0.2, 0], [Math.PI / 2, 0, 0]);
    for (const s of [-1, 1]) kc.cyl(0.012, 0.014, 0.46, mWoodD, [s * 0.15, 0.69, -0.15], [-0.12, 0, 0], 6);
    kc.mesh(new THREE.TorusGeometry(0.155, 0.014, 4, 12, Math.PI), mWoodD, [0, 0.9, -0.18], [-0.12 - Math.PI / 2 + Math.PI / 2, 0, 0]);
    kc.mesh(new THREE.TorusGeometry(0.15, 0.01, 4, 12, Math.PI), mWoodD, [0, 0.72, -0.16], [-0.12, 0, 0]);
    for (const dx of [-0.05, 0.05]) kc.cyl(0.008, 0.008, 0.2, mWoodD, [dx, 0.8, -0.168], [-0.12, 0, 0], 5);
    S.cyl(x, z, 0.22, -1, FY + 0.95);
  }
  function roundTable(x, z, r = 0.3) {
    k.cyl(r, r, 0.03, mMarble, [x, FY + 0.72, z], null, 24);
    k.cyl(r + 0.006, r + 0.006, 0.012, mBrass, [x, FY + 0.7, z], null, 24);
    k.cyl(0.028, 0.028, 0.66, mIron, [x, FY + 0.37, z], null, 8);
    k.cyl(0.07, 0.04, 0.05, mIron, [x, FY + 0.68, z], null, 10);
    for (const a of [0, Math.PI / 2]) k.box(0.46, 0.035, 0.05, mIron, [x, FY + 0.02, z], [0, a + 0.4, 0]);
    S.cyl(x, z, r, -1, FY + 0.76);
    return FY + 0.735;
  }
  function squareTable(x, z, w = 0.8) {
    k.rbox(w, 0.045, w, 0.012, mWoodM, [x, FY + 0.72, z]);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) k.box(0.05, 0.7, 0.05, mWoodD, [x + sx * (w / 2 - 0.06), FY + 0.35, z + sz * (w / 2 - 0.06)]);
    for (const s of [-1, 1]) { k.box(w - 0.12, 0.08, 0.025, mWoodD, [x, FY + 0.65, z + s * (w / 2 - 0.06)]); k.box(0.025, 0.08, w - 0.12, mWoodD, [x + s * (w / 2 - 0.06), FY + 0.65, z]); }
    S.box(x, z, w, w, -1, FY + 0.76);
    return FY + 0.743;
  }
  const rMenu = A.inner.region(96, 128, (g, w, h) => { g.fillStyle = '#fbf6ea'; g.fillRect(0, 0, w, h); g.strokeStyle = BURG; g.lineWidth = 3; g.strokeRect(5, 5, w - 10, h - 10); U.text(g, 'MENU', w / 2, 22, 17, F.serif, BURG, { weight: 700 }); g.fillStyle = WOOD; for (let i = 0; i < 6; i++) { g.fillRect(14, 42 + i * 12, 44, 3); g.fillRect(66, 42 + i * 12, 16, 3); } U.sakura(g, w / 2, 116, 6, '#f2b5c8'); });
  function setting(x, z, ty, a, o = {}) { // cup on saucer + spoon, pointing toward angle a
    const px = x + Math.sin(a) * 0.17, pz = z + Math.cos(a) * 0.17;
    G.add('saucer', S, [px, ty, pz], [0.13, 0.1, 0.13], '#f4f1e8');
    G.add('ccup', S, [px, ty + 0.013, pz], [0.075, 0.065, 0.075], rr.pick(ccupC), [0, a + Math.PI / 2 + (rr() - 0.5) * 0.6, 0]);
    G.add('slab', S, [px + Math.cos(a) * 0.055, ty + 0.018, pz - Math.sin(a) * 0.055], [0.008, 0.003, 0.09], '#c9ced3', [0, a, 0]);
    if (o.cake) { G.add('plate', S, [px + Math.cos(a) * 0.17, ty, pz - Math.sin(a) * 0.17], [0.16, 0.015, 0.16], '#f4f1e8'); cake(S, px + Math.cos(a) * 0.17, ty + 0.012, pz - Math.sin(a) * 0.17, o.cake, a); }
  }
  function tableTop(x, z, ty, n, o = {}) {
    for (let i = 0; i < n; i++) setting(x, z, ty, (o.a0 ?? 0) + i * Math.PI * 2 / n, { cake: i === 0 && o.cake ? o.cake : null });
    // standing folded menu, sugar pot, bud vase
    const mg = S.k.group([x - 0.08, ty, z + 0.04], rr() * 3); const km = ctx.kit(mg);
    for (const s of [-1, 1]) { const c = S.card(rMenu, 0.07, 0.1, [0, 0.048, s * 0.012], [s * 0.24, s > 0 ? 0 : Math.PI, 0], null, km); c.castShadow = true; }
    k.cyl(0.03, 0.028, 0.055, M.inner('#f4f1e8', 0.4), [x + 0.07, ty + 0.028, z - 0.05], null, 12);
    k.cyl(0.032, 0.032, 0.008, M.inner('#f4f1e8', 0.4), [x + 0.07, ty + 0.058, z - 0.05], null, 12);
    k.sphere(0.009, mBrass, [x + 0.07, ty + 0.068, z - 0.05], 6);
    k.cyl(0.014, 0.02, 0.09, M.glass({ opacity: 0.45 }), [x + 0.02, ty + 0.045, z - 0.09], null, 8).castShadow = false;
    G.add('stem', S, [x + 0.02, ty + 0.05, z - 0.09], [0.004, 0.14, 0.004], '#5f8c4c', [0.1, 0, 0.06]);
    G.add('rose', S, [x + 0.028, ty + 0.18, z - 0.08], [0.035, 0.03, 0.035], rr.pick(['#f2b5c8', '#f7d3de', '#e8819c']));
    const ps = o.pool ?? 0.56; const p = k.plane(ps, ps, pool, [x, ty + 0.004, z], [-Math.PI / 2, 0, 0]); p.receiveShadow = false; ctx.noOutline(p);
  }
  function pendant(x, z, yb, shade = MOSS) {
    ctx.wires.add([S.world(x, C1, z), S.world(x, yb + 0.2, z)], { width: 0.007, color: '#3a3640' });
    k.cyl(0.05, 0.05, 0.025, mIron, [x, C1 - 0.013, z], null, 12);
    k.cyl(0.018, 0.022, 0.06, mBrass, [x, yb + 0.21, z], null, 8);
    k.mesh(new THREE.LatheGeometry([[0.2, 0], [0.19, 0.03], [0.15, 0.1], [0.06, 0.19], [0.02, 0.2]].map(p => new THREE.Vector2(p[0], p[1])), 18), M.inner(shade, 0.22, { side: 'double' }), [x, yb, z]);
    k.mesh(new THREE.TorusGeometry(0.2, 0.007, 4, 20), mBrass, [x, yb, z], [Math.PI / 2, 0, 0]);
    k.sphere(0.045, M.glow('#fff0d0', 1.6), [x, yb + 0.045, z], 10);
    k.cyl(0.18, 0.18, 0.004, M.glow('#ffe2b0', 1.25), [x, yb + 0.012, z], null, 18);
  }
  function cake(par, x, y, z, kind, a = 0) {
    const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = a; (par.g || par).add(g); const kc = ctx.kit(g);
    const wedge = (r, h, c, yy, th = Math.PI / 3) => kc.mesh(new THREE.CylinderGeometry(r, r, h, 5, 1, false, -th / 2, th), M.inner(c, 0.38), [-r * 0.45, yy + h / 2, 0], [0, Math.PI / 2, 0]);
    if (kind === 'short') { wedge(0.075, 0.025, '#f3e3bf', 0); wedge(0.075, 0.01, '#fbf6ee', 0.025); wedge(0.075, 0.025, '#f3e3bf', 0.035); wedge(0.075, 0.012, '#fbf6ee', 0.06); G.add('blob', g, [0, 0.07, 0], [0.028, 0.03, 0.028], '#e8506a'); }
    else if (kind === 'choco') { wedge(0.075, 0.06, '#6b3f28', 0); wedge(0.077, 0.008, '#3a2418', 0.06); G.add('blob', g, [0, 0.068, 0], [0.018, 0.012, 0.018], '#f2c230'); }
    else if (kind === 'cheese') { wedge(0.075, 0.05, '#f5e3a0', 0); wedge(0.075, 0.006, '#c98a4a', 0.05); }
    else if (kind === 'roll') { kc.cyl(0.04, 0.04, 0.05, M.inner('#f3d9a0', 0.38), [0, 0.04, 0], [Math.PI / 2, 0, 0], 12); kc.cyl(0.022, 0.022, 0.052, M.inner('#fbf6ee', 0.42), [0, 0.042, 0], [Math.PI / 2, 0, 0], 10); G.add('blob', g, [0, 0.075, 0], [0.018, 0.018, 0.018], '#e8506a'); }
    else if (kind === 'mont') { kc.cyl(0.04, 0.042, 0.015, M.inner('#f3e3bf', 0.38), [0, 0.008, 0], null, 12); kc.mesh(new THREE.LatheGeometry([[0.04, 0], [0.045, 0.02], [0.035, 0.05], [0.018, 0.075], [0.001, 0.08]].map(p => new THREE.Vector2(p[0], p[1])), 12), M.inner('#c9a060', 0.36), [0, 0.015, 0]); G.add('blob', g, [0, 0.09, 0], [0.022, 0.02, 0.022], '#8a5a44'); }
    else if (kind === 'pudding') { kc.mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.045, 12), M.inner('#f2d060', 0.38), [0, 0.022, 0]); kc.cyl(0.03, 0.03, 0.006, M.inner('#8a4b2a', 0.25), [0, 0.047, 0], null, 12); G.add('blob', g, [0, 0.048, 0], [0.024, 0.02, 0.024], '#fbf6ee'); G.add('blob', g, [0.01, 0.064, 0], [0.012, 0.012, 0.012], '#e8506a'); }
    else if (kind === 'tart') { kc.cyl(0.05, 0.045, 0.02, M.inner('#d9a05a', 0.36), [0, 0.01, 0], null, 14); for (let i = 0; i < 7; i++) G.add('blob', g, [Math.cos(i) * 0.028 * (i % 2 + 0.3), 0.018, Math.sin(i) * 0.028 * (i % 2 + 0.3)], [0.02, 0.016, 0.02], ['#e8506a', '#f2c230', '#7cc576', '#8e7cc3'][i % 4]); }
    else if (kind === 'mochi') { G.add('blob', g, [0, 0, 0], [0.06, 0.04, 0.045], '#f2b5c8'); G.add('leaf', g, [0, 0.005, 0.02], [0.05, 0.07, 1], '#6f9a5a', [-1.2, 0, 0]); }
    return g;
  }

  // ---------------- rug under the four-top (woven edge + fringe)
  {
    const rRug = A.inner.region(256, 256, (g, w, h) => {
      g.fillStyle = '#a8584e'; g.fillRect(0, 0, w, h); g.strokeStyle = '#e9d6b4'; g.lineWidth = 8; g.strokeRect(14, 14, w - 28, h - 28); g.lineWidth = 3; g.strokeRect(30, 30, w - 60, h - 60);
      g.fillStyle = '#5a6b7a'; for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { g.save(); g.translate(58 + i * 47, 58 + j * 47); g.rotate(Math.PI / 4); g.fillRect(-12, -12, 24, 24); g.restore(); }
      g.fillStyle = '#e9d6b4'; for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { g.beginPath(); g.arc(58 + i * 47, 58 + j * 47, 5, 0, 6.3); g.fill(); }
    });
    k.box(2.0, 0.008, 1.9, M.inner('#a8584e', 0.2), [-3.9, FY + 0.004, -7.1]);
    S.card(rRug, 1.98, 1.88, [-3.9, FY + 0.0085, -7.1], [-Math.PI / 2, 0, 0]);
    for (let i = 0; i < 26; i++) for (const s of [-1, 1]) G.add('slab', S, [-4.86 + i * 0.075, FY, -7.1 + s * 0.97], [0.02, 0.004, 0.05], '#e9d6b4', [0, (rr() - 0.5) * 0.3, 0]);
  }

  // ---------------- tables, chairs, settings, pendants
  for (const [x, n] of [[-0.9, 2], [1.5, 1], [3.9, 2]]) {
    const ty = roundTable(x, -4.85, 0.3);
    chair(x - 0.56, -4.85, Math.PI / 2); chair(x + 0.56, -4.85, -Math.PI / 2);
    tableTop(x, -4.85, ty, n, { a0: -Math.PI / 2, cake: x === 1.5 ? 'short' : x === 3.9 ? 'mont' : null });
    pendant(x, -4.85, FY + 1.72);
  }
  {
    const ty = squareTable(-3.9, -7.1, 0.82);
    for (const [dx, dz, ry] of [[-0.64, 0, Math.PI / 2], [0.64, 0, -Math.PI / 2], [0, -0.64, 0], [0, 0.64, Math.PI]]) chair(-3.9 + dx, -7.1 + dz, ry);
    tableTop(-3.9, -7.1, ty, 3, { a0: 0.3, cake: 'choco', pool: 0.74 });
    pendant(-3.9, -7.1, FY + 1.72, BURG);
  }
  for (const [x, n, ck] of [[1.2, 2, 'tart'], [3.9, 0, null]]) {
    const ty = roundTable(x, -7.4, 0.32);
    chair(x - 0.56, -7.4, Math.PI / 2); chair(x + 0.56, -7.4, -Math.PI / 2);
    tableTop(x, -7.4, ty, n, { a0: -Math.PI / 2, cake: ck, pool: 0.6 });
    pendant(x, -7.4, FY + 1.72);
  }
  // reserved card on the empty table
  const rRes = A.inner.region(96, 48, (g, w, h) => { g.fillStyle = '#fbf6ea'; g.fillRect(0, 0, w, h); g.strokeStyle = WOOD; g.lineWidth = 2; g.strokeRect(3, 3, w - 6, h - 6); U.text(g, 'Reserved', w / 2, 18, 15, F.serif, BURG, { weight: 700 }); U.text(g, 'ご予約席', w / 2, 36, 12, F.sans, WOOD, { weight: 700 }); });
  for (const s of [-1, 1]) S.card(rRes, 0.1, 0.05, [3.9, FY + 0.765, -7.4 + s * 0.012], [s * 0.3, s > 0 ? 0 : Math.PI, 0]);

  // ---------------- counter with siphon bar, pour-over, register, cake dome
  {
    const x0 = -0.6, x1 = 4.9, z0 = -10.95, z1 = -10.25, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    k.box(x1 - x0, 1.0, z1 - z0, mWoodD, [cx, FY + 0.5, cz]);
    for (let x = x0 + 0.15; x < x1; x += 0.3) k.box(0.02, 0.9, 0.012, M.inner('#4f3628', 0.15), [x, FY + 0.5, z1 + 0.006]);
    k.rbox(x1 - x0 + 0.1, 0.06, z1 - z0 + 0.14, 0.02, mWoodL, [cx, FY + 1.03, cz + 0.04]);
    k.cyl(0.018, 0.018, x1 - x0 - 0.2, mBrass, [cx, FY + 0.22, z1 + 0.16], [0, 0, Math.PI / 2], 8);
    for (let x = x0 + 0.3; x < x1 - 0.2; x += 1.2) k.box(0.02, 0.02, 0.16, mBrass, [x, FY + 0.22, z1 + 0.08]);
    S.box(cx, cz + 0.04, x1 - x0 + 0.1, z1 - z0 + 0.14, -1, FY + 1.06);
    for (const x of [0.7, 1.9, 3.1, 4.2]) {
      k.cyl(0.17, 0.17, 0.06, M.inner(BURG, 0.25), [x, FY + 0.76, z1 + 0.5], null, 16);
      k.cyl(0.025, 0.025, 0.72, mIron, [x, FY + 0.38, z1 + 0.5], null, 8);
      k.cyl(0.2, 0.2, 0.03, mIron, [x, FY + 0.015, z1 + 0.5], null, 14);
      k.mesh(new THREE.TorusGeometry(0.15, 0.01, 4, 14), mBrass, [x, FY + 0.3, z1 + 0.5], [Math.PI / 2, 0, 0]);
      S.cyl(x, z1 + 0.5, 0.2, -1, FY + 0.8);
    }
    const ty = FY + 1.06;
    // siphons on halogen heaters
    for (const x of [0.5, 0.95, 1.4]) {
      k.rbox(0.18, 0.08, 0.18, 0.02, mIron, [x, ty + 0.04, cz], null);
      k.cyl(0.055, 0.055, 0.01, M.glow('#ffb35a', 1.6), [x, ty + 0.085, cz], null, 14);
      k.cyl(0.008, 0.008, 0.5, mSteel, [x - 0.1, ty + 0.3, cz - 0.07], null, 6);
      k.box(0.1, 0.015, 0.02, mSteel, [x - 0.05, ty + 0.32, cz - 0.05], [0, 0.6, 0]);
      k.sphere(0.072, mGlass, [x, ty + 0.17, cz], 14).castShadow = false;
      k.sphere(0.055, mCoffee, [x, ty + 0.155, cz], 12);
      k.mesh(new THREE.CylinderGeometry(0.05, 0.022, 0.16, 12, 1, true), M.glass({ opacity: 0.45 }), [x, ty + 0.33, cz]).castShadow = false;
      k.cyl(0.008, 0.008, 0.14, M.glass({ opacity: 0.45 }), [x, ty + 0.23, cz], null, 6).castShadow = false;
      k.cyl(0.054, 0.054, 0.02, mSteel, [x, ty + 0.42, cz], null, 12);
    }
    // pour-over: scale, server carafe, dripper, gooseneck kettle
    {
      const x = 2.25;
      k.box(0.16, 0.02, 0.16, mIron, [x, ty + 0.01, cz]);
      k.mesh(new THREE.LatheGeometry([[0.001, 0], [0.05, 0.002], [0.055, 0.04], [0.045, 0.1], [0.035, 0.12]].map(p => new THREE.Vector2(p[0], p[1])), 14), mGlass, [x, ty + 0.02, cz]).castShadow = false;
      k.cyl(0.042, 0.042, 0.04, mCoffee, [x, ty + 0.042, cz], null, 12);
      k.mesh(new THREE.LatheGeometry([[0.025, 0], [0.03, 0.005], [0.06, 0.07], [0.064, 0.075]].map(p => new THREE.Vector2(p[0], p[1])), 14), M.inner('#f4f1e8', 0.4, { side: 'double' }), [x, ty + 0.14, cz]);
      const kg = S.k.group([x + 0.26, ty, cz], -0.4); const kk = ctx.kit(kg);
      kk.mesh(new THREE.LatheGeometry([[0.001, 0], [0.07, 0.002], [0.075, 0.03], [0.07, 0.1], [0.045, 0.13], [0.03, 0.135]].map(p => new THREE.Vector2(p[0], p[1])), 16), mSteel, [0, 0, 0]);
      kk.cyl(0.02, 0.02, 0.02, mIron, [0, 0.145, 0], null, 10);
      kk.mesh(new THREE.TorusGeometry(0.05, 0.008, 4, 12, Math.PI), mIron, [-0.07, 0.08, 0], [0, 0, Math.PI / 2]);
      const sp = [[0.065, 0.02], [0.1, 0.08], [0.12, 0.15], [0.16, 0.17]];
      for (let i = 0; i < sp.length - 1; i++) { const a = sp[i], b = sp[i + 1], len = Math.hypot(b[0] - a[0], b[1] - a[1]); kk.cyl(0.006, 0.008, len, mSteel, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 0], [0, 0, -Math.atan2(b[0] - a[0], b[1] - a[1])], 6); }
    }
    // retro cash register
    {
      const rg = S.k.group([4.35, ty, cz], Math.PI); const kr = ctx.kit(rg);
      kr.box(0.42, 0.12, 0.4, M.inner('#8a8e94', 0.22), [0, 0.06, 0]);
      kr.box(0.4, 0.14, 0.26, M.inner('#b48a62', 0.28), [0, 0.18, -0.04], [-0.35, 0, 0]);
      for (let i = 0; i < 20; i++) G.add('cyl6', rg, [-0.14 + (i % 5) * 0.07, 0.22 + Math.floor(i / 5) * 0.01, -0.12 + Math.floor(i / 5) * 0.045], [0.03, 0.02, 0.03], i % 5 === 4 ? '#d9463b' : '#f4f1e8', [-0.35, 0, 0]);
      kr.box(0.2, 0.12, 0.06, M.inner('#8a8e94', 0.22), [0, 0.32, 0.12]);
      const rDisp = A.glow.region(64, 24, (g, w, h) => { g.fillStyle = '#1f2a24'; g.fillRect(0, 0, w, h); U.text(g, '¥ 1,030', w / 2, h / 2 + 1, 14, F.en, '#9ff0a0', { weight: 900 }); });
      S.card(rDisp, 0.16, 0.06, [0, 0.33, 0.151], null, null, kr);
      S.card(rDisp, 0.16, 0.06, [0, 0.33, 0.089], [0, Math.PI, 0], null, kr);
      kr.box(0.38, 0.05, 0.02, M.inner('#6d747c', 0.2), [0, 0.04, 0.205]);
    }
    // cake dome on a stand
    k.cyl(0.14, 0.14, 0.015, M.inner('#e8e2d6', 0.4), [-0.25, ty + 0.1, cz], null, 18);
    k.cyl(0.02, 0.05, 0.1, M.inner('#e8e2d6', 0.4), [-0.25, ty + 0.05, cz], null, 10);
    k.mesh(new THREE.SphereGeometry(0.135, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), M.glass({ opacity: 0.3 }), [-0.25, ty + 0.108, cz]).castShadow = false;
    k.sphere(0.018, M.glass({ opacity: 0.45 }), [-0.25, ty + 0.25, cz], 8);
    k.cyl(0.1, 0.1, 0.07, M.inner('#f4ecd8', 0.4), [-0.25, ty + 0.143, cz], null, 16);
    for (let i = 0; i < 8; i++) G.add('blob', S, [-0.25 + Math.cos(i * 0.785) * 0.07, ty + 0.178, cz + Math.sin(i * 0.785) * 0.07], [0.022, 0.022, 0.022], '#e8506a');
    // sugar jar, milk pitchers, water glasses on a tray
    k.cyl(0.04, 0.04, 0.1, mGlass, [2.8, ty + 0.05, cz + 0.1], null, 12).castShadow = false;
    for (let i = 0; i < 9; i++) G.add('slab', S, [2.8 + ((i % 3) - 1) * 0.02, ty + 0.002 + Math.floor(i / 3) * 0.018, cz + 0.1 + ((i % 2) - 0.5) * 0.02], [0.016, 0.016, 0.016], '#fbfbf8', [0, i, 0]);
    k.box(0.36, 0.012, 0.22, mWoodM, [3.3, ty + 0.006, cz + 0.05]);
    for (let i = 0; i < 4; i++) k.mesh(new THREE.CylinderGeometry(0.03, 0.026, 0.1, 10, 1, true), M.glass({ opacity: 0.45 }), [3.18 + (i % 2) * 0.1, ty + 0.062, cz + (Math.floor(i / 2) - 0.5) * 0.1]).castShadow = false;
    for (const x of [3.65, 3.75]) { k.cyl(0.028, 0.034, 0.07, mSteel, [x, ty + 0.035, cz - 0.1], null, 10); }
  }

  // ---------------- back bar: cabinet with doors, espresso machine, grinder, shelves of cups / jars
  {
    const bx0 = -0.8, bx1 = 4.8, bcx = (bx0 + bx1) / 2, bz = IZ0 + 0.25;
    k.box(bx1 - bx0, 0.9, 0.5, mWoodD, [bcx, FY + 0.45, bz]);
    for (let i = 0; i < 7; i++) { const x = bx0 + (i + 0.5) * (bx1 - bx0) / 7; k.box((bx1 - bx0) / 7 - 0.04, 0.72, 0.012, mWoodM, [x, FY + 0.47, bz + 0.256]); k.sphere(0.014, mBrass, [x + ((bx1 - bx0) / 7) * 0.35, FY + 0.55, bz + 0.27], 8); }
    k.box(bx1 - bx0 + 0.04, 0.04, 0.55, mWoodL, [bcx, FY + 0.92, bz + 0.02]);
    S.box(bcx, bz, bx1 - bx0, 0.56, -1, FY + 1.9);
    const tb = FY + 0.94;
    // espresso machine (faces the counter / customers)
    {
      const eg = S.k.group([3.3, tb, bz + 0.02], 0); const ke = ctx.kit(eg);
      ke.rbox(0.72, 0.38, 0.46, 0.04, mSteel, [0, 0.25, 0]);
      ke.box(0.74, 0.07, 0.48, M.inner(BURG, 0.25), [0, 0.065, 0]);
      ke.box(0.66, 0.02, 0.4, mSteelD, [0, 0.45, 0]);
      for (const s of [-1, 1]) ke.box(0.66, 0.04, 0.012, mSteel, [0, 0.47, s * 0.2]);
      for (let i = 0; i < 8; i++) G.add('ccup', eg, [-0.26 + (i % 4) * 0.17, 0.52, -0.09 + Math.floor(i / 4) * 0.17], [0.07, 0.06, 0.07], rr.pick(ccupC), [Math.PI, i * 0.7, 0]);
      for (const s of [-1, 1]) {
        ke.cyl(0.045, 0.05, 0.06, mSteelD, [s * 0.17, 0.19, 0.25], null, 12);
        ke.cyl(0.042, 0.038, 0.035, mIron, [s * 0.17, 0.145, 0.26], null, 12);
        ke.box(0.03, 0.025, 0.14, mIron, [s * 0.17, 0.14, 0.34], [0.15, 0, 0]);
        ke.cyl(0.035, 0.035, 0.012, M.glow('#f4f1e8', 0.8), [s * 0.12, 0.33, 0.232], [Math.PI / 2, 0, 0], 14);
        ke.mesh(new THREE.TorusGeometry(0.036, 0.006, 4, 14), mBrass, [s * 0.12, 0.33, 0.236]);
      }
      ke.cyl(0.006, 0.006, 0.2, mSteel, [0.34, 0.18, 0.26], [0.3, 0, 0.2], 6);
      ke.box(0.64, 0.025, 0.14, mSteelD, [0, 0.013, 0.3]);
      for (let i = 0; i < 9; i++) ke.box(0.6, 0.006, 0.008, mIron, [0, 0.028, 0.245 + i * 0.013]);
      for (const s of [-1, 1]) G.add('ccup', eg, [s * 0.17, 0.03, 0.27], [0.06, 0.05, 0.06], '#f4f1e8', [0, s, 0]);
    }
    // grinder (hopper with beans)
    {
      const x = 2.55, z = bz + 0.05;
      k.rbox(0.18, 0.3, 0.24, 0.03, M.inner(BURG, 0.25), [x, tb + 0.15, z]);
      k.cyl(0.06, 0.06, 0.03, mSteel, [x, tb + 0.31, z], null, 12);
      k.mesh(new THREE.CylinderGeometry(0.09, 0.045, 0.16, 14, 1, true), M.glass({ opacity: 0.45, tint: '#6b4a37' }), [x, tb + 0.4, z]).castShadow = false;
      k.cyl(0.07, 0.04, 0.1, mCoffee, [x, tb + 0.37, z], null, 12);
      k.cyl(0.092, 0.092, 0.015, mIron, [x, tb + 0.485, z], null, 14);
      k.box(0.08, 0.02, 0.08, mSteelD, [x, tb + 0.04, z + 0.14]);
    }
    // canisters + knock box + milk pitchers on the bar top
    for (let i = 0; i < 4; i++) { const x = 0.2 + i * 0.28, c = [MOSS, BURG, '#c9a060', '#5a6b7a'][i]; k.cyl(0.07, 0.07, 0.16, M.inner(c, 0.25), [x, tb + 0.08, bz + 0.05], null, 14); k.cyl(0.072, 0.072, 0.03, mSteel, [x, tb + 0.175, bz + 0.05], null, 14); }
    const rTin = A.inner.region(64, 40, (g, w, h) => { g.fillStyle = '#f4ecd8'; g.fillRect(0, 0, w, h); U.text(g, ['BLEND', 'MOCHA', 'KILIM', 'DARK'][0], w / 2, h / 2, 12, F.serif, WOOD, { weight: 700 }); });
    for (let i = 0; i < 4; i++) S.card(rTin, 0.07, 0.045, [0.2 + i * 0.28, tb + 0.08, bz + 0.121]);
    k.box(0.14, 0.12, 0.14, mIron, [1.5, tb + 0.06, bz + 0.05]);
    // two wall shelves: rows of cups on saucers, bean jars, bottles
    const shelfY = [FY + 1.4, FY + 1.8];
    for (const y of shelfY) { k.box(bx1 - bx0, 0.04, 0.3, mWoodM, [bcx, y, IZ0 + 0.16]); for (const x of [bx0 + 0.3, bcx, bx1 - 0.3]) k.box(0.03, 0.12, 0.2, mIron, [x, y - 0.08, IZ0 + 0.1], [0.5, 0, 0]); }
    for (let i = 0; i < 16; i++) { const x = bx0 + 0.2 + i * 0.16; G.add('saucer', S, [x, shelfY[0] + 0.02, IZ0 + 0.18], [0.12, 0.1, 0.12], '#f4f1e8'); G.add('ccup', S, [x, shelfY[0] + 0.033, IZ0 + 0.18], [0.075, 0.065, 0.075], ccupC[i % ccupC.length], [0, 0.4 + i * 0.1, 0]); }
    for (let i = 0; i < 7; i++) {
      const x = bx0 + 0.3 + i * 0.78;
      k.mesh(new THREE.LatheGeometry([[0.001, 0], [0.06, 0.002], [0.065, 0.02], [0.065, 0.16], [0.045, 0.18], [0.045, 0.19]].map(p => new THREE.Vector2(p[0], p[1])), 14), mGlass, [x, shelfY[1] + 0.02, IZ0 + 0.16]).castShadow = false;
      k.cyl(0.058, 0.058, 0.12, M.inner(rr.pick(['#4a2c1e', '#6b3f28', '#3a2418', '#8a5a44']), 0.1), [x, shelfY[1] + 0.08, IZ0 + 0.16], null, 12);
      k.cyl(0.05, 0.05, 0.03, mWoodD, [x, shelfY[1] + 0.225, IZ0 + 0.16], null, 12);
      if (i < 6) for (let j = 0; j < 2; j++) { const bxx = x + 0.3 + j * 0.13; k.mesh(new THREE.LatheGeometry([[0.001, 0], [0.032, 0.002], [0.034, 0.16], [0.012, 0.21], [0.012, 0.25]].map(p => new THREE.Vector2(p[0], p[1])), 10), M.inner(rr.pick([MOSS, BURG, '#c9a060', '#6b3f28']), 0.2), [bxx, shelfY[1] + 0.02, IZ0 + 0.16]); }
    }
  }

  // ---------------- cake showcase (glass case with individual cakes + price cards)
  {
    const x0 = -3.3, x1 = -1.1, z0 = -10.95, z1 = -10.25, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, w = x1 - x0, d = z1 - z0;
    k.box(w, 0.62, d, mWoodD, [cx, FY + 0.31, cz]);
    k.box(w + 0.02, 0.03, d + 0.02, mWoodL, [cx, FY + 0.635, cz]);
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) k.box(0.025, 0.5, 0.025, mBrass, [cx + dx * (w / 2 - 0.013), FY + 0.9, cz + dz * (d / 2 - 0.013)]);
    k.box(w, 0.03, d + 0.02, mWoodL, [cx, FY + 1.165, cz]);
    k.box(w - 0.1, 0.012, 0.03, M.glow('#fff3dc', 1.3), [cx, FY + 1.14, cz - 0.28]);
    k.plane(w - 0.03, 0.5, M.glass({ opacity: 0.18 }), [cx, FY + 0.9, z1], null).castShadow = false;
    for (const s of [-1, 1]) k.plane(d - 0.03, 0.5, M.glass({ opacity: 0.18 }), [cx + s * w / 2, FY + 0.9, cz], [0, Math.PI / 2, 0]).castShadow = false;
    k.box(w - 0.05, 0.01, d - 0.08, M.glass({ opacity: 0.3 }), [cx, FY + 0.9, cz]).castShadow = false;
    const kinds = ['short', 'choco', 'cheese', 'roll', 'mont', 'pudding', 'tart', 'mochi'];
    const rTag = kinds.map((kd, i) => A.inner.region(64, 32, (g, ww, hh) => { g.fillStyle = '#fbf6ea'; g.fillRect(0, 0, ww, hh); U.text(g, ['ショート', 'ガトーショコラ', 'チーズケーキ', 'ロール', 'モンブラン', 'プリン', 'フルーツタルト', '桜もち'][i], ww / 2, 11, 10, F.sans, WOOD, { weight: 700, maxW: ww - 4 }); U.text(g, '¥' + [480, 520, 480, 420, 550, 380, 580, 300][i], ww / 2, 24, 11, F.en, BURG, { weight: 900 }); }));
    for (let lvl = 0; lvl < 2; lvl++) for (let i = 0; i < 6; i++) {
      const idx = (i + lvl * 3) % kinds.length, x = x0 + 0.22 + i * (w - 0.44) / 5, y = FY + 0.652 + lvl * 0.255, z = cz + 0.04;
      G.add('cyl', S, [x, y, z], [0.13, 0.003, 0.13], '#fbf8f0');
      cake(S, x, y + 0.003, z, kinds[idx], Math.PI / 2 + (rr() - 0.5) * 0.4);
      S.card(rTag[idx], 0.08, 0.04, [x, y + 0.02, z + 0.12], [-0.4, 0, 0]);
    }
    const rShow = A.inner.region(200, 36, (g, ww, hh) => { g.fillStyle = '#f4ecd8'; g.fillRect(0, 0, ww, hh); U.text(g, '本日のケーキ', ww / 2, hh / 2 + 1, 20, F.serif, BURG, { weight: 700 }); });
    S.card(rShow, 0.9, 0.16, [cx, FY + 0.45, z1 + 0.006]);
    S.box(cx, cz, w, d, -1, FY + 1.18);
  }

  // ---------------- menu board + clock on the back wall
  {
    const rMB = A.inner.region(320, 180, (g, w, h) => {
      g.fillStyle = '#2f3a35'; g.fillRect(0, 0, w, h); g.strokeStyle = '#8a6446'; g.lineWidth = 10; g.strokeRect(0, 0, w, h);
      U.text(g, 'MENU', w / 2, 30, 28, F.hand, '#f4efe4', { weight: 400 });
      [['ブレンド', '450'], ['カフェラテ', '500'], ['さくらラテ', '550'], ['紅茶', '450'], ['ケーキセット', '850']].forEach(([a, b], i) => { U.text(g, a, 28, 64 + i * 22, 17, F.hand, '#f4efe4', { weight: 400, align: 'left' }); U.text(g, b, w - 26, 64 + i * 22, 17, F.hand, '#f6e3a0', { weight: 400, align: 'right' }); });
      U.sakura(g, w - 40, 30, 12, '#f7c3d3');
    });
    k.box(1.66, 0.8, 0.04, mWoodD, [2.0, FY + 2.52, IZ0 + 0.02]);
    S.card(rMB, 1.6, 0.74, [2.0, FY + 2.52, IZ0 + 0.043]);
    k.cyl(0.2, 0.2, 0.05, mWoodD, [4.4, FY + 2.45, IZ0 + 0.03], [Math.PI / 2, 0, 0], 24);
    const rClock = A.inner.region(96, 96, (g, w, h) => { g.fillStyle = '#f7f0e0'; g.beginPath(); g.arc(48, 48, 46, 0, 6.3); g.fill(); g.fillStyle = INK; for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; g.fillRect(48 + Math.sin(a) * 38 - 2, 48 - Math.cos(a) * 38 - 2, 4, 4); } g.strokeStyle = INK; g.lineCap = 'round'; g.lineWidth = 5; g.beginPath(); g.moveTo(48, 48); g.lineTo(48 + 22 * Math.sin(4 * Math.PI / 6 + 0.1), 48 - 22 * Math.cos(4 * Math.PI / 6 + 0.1)); g.stroke(); g.lineWidth = 3; g.beginPath(); g.moveTo(48, 48); g.lineTo(48, 14); g.stroke(); });
    S.card(rClock, 0.34, 0.34, [4.4, FY + 2.45, IZ0 + 0.057]);
    k.mesh(new THREE.TorusGeometry(0.18, 0.012, 4, 24), mBrass, [4.4, FY + 2.45, IZ0 + 0.06]);
    for (const x of [0.6, 2.3, 4.0]) {
      ctx.wires.add([S.world(x, C1, -10.6), S.world(x, FY + 2.17, -10.6)], { width: 0.007, color: '#3a3640' });
      k.sphere(0.12, M.glow('#ffe2b0', 1.25), [x, FY + 2.07, -10.6], 14);
      k.cyl(0.03, 0.03, 0.05, mBrass, [x, FY + 2.2, -10.6], null, 10);
      const p = k.plane(1.0, 0.8, pool, [x, FY + 1.066, -10.6], [-Math.PI / 2, 0, 0]); p.receiveShadow = false; ctx.noOutline(p);
    }
  }

  // ---------------- corner shelf unit (NW): books, jars, radio, plants
  {
    const x0 = -5.12, x1 = -3.62, z = IZ0 + 0.0, cx = (x0 + x1) / 2, w = x1 - x0, d = 0.36, Hs = 2.1;
    const g = S.k.group([cx, FY, z], 0); const kg = ctx.kit(g);
    kg.box(w, Hs, 0.015, mWoodD, [0, Hs / 2, 0.008]);
    for (const s of [-1, 1]) kg.box(0.03, Hs, d, mWoodM, [s * (w / 2 - 0.015), Hs / 2, d / 2]);
    const ys = [0.06, 0.5, 0.95, 1.4, 1.85];
    for (const y of ys) kg.box(w - 0.04, 0.03, d - 0.01, mWoodM, [0, y, d / 2]);
    kg.box(w + 0.04, 0.035, d + 0.02, mWoodM, [0, Hs, d / 2]);
    const r = ctx.rng('cafe.shelf');
    let x = -w / 2 + 0.05; const PAL = ['#8c3a45', '#3f5f4f', '#e9dfc8', '#2f4f7a', '#c9a060', '#6d6478', '#e6c9cf'];
    while (x < 0.3) { const t = 0.02 + r() * 0.025, h = 0.19 + r() * 0.06; G.add('book', g, [x + t / 2, 0.515, d - 0.14], [t, h, 0.2], r.pick(PAL), null, r.int(0, 15)); x += t + 0.002; }
    for (let j = 0; j < 4; j++) G.add('book', g, [0.62, 0.515 + j * 0.03 + 0.015, d - 0.14], [0.03, 0.24, 0.17], r.pick(PAL), [0, 0.1, Math.PI / 2], r.int(0, 15));
    for (let i = 0; i < 5; i++) { const xx = -w / 2 + 0.16 + i * 0.28; kg.mesh(new THREE.LatheGeometry([[0.001, 0], [0.05, 0.002], [0.055, 0.02], [0.055, 0.15], [0.04, 0.17], [0.04, 0.18]].map(p => new THREE.Vector2(p[0], p[1])), 12), mGlass, [xx, 0.965, d / 2]).castShadow = false; kg.cyl(0.048, 0.048, 0.1, M.inner(['#4a2c1e', '#e8d6b8', '#f2c230', '#6b3f28', '#c9574a'][i], 0.25), [xx, 1.03, d / 2], null, 10); kg.cyl(0.042, 0.042, 0.02, mWoodD, [xx, 1.155, d / 2], null, 10); }
    // retro radio
    {
      kg.rbox(0.42, 0.26, 0.2, 0.03, mWoodM, [-0.25, 1.545, d / 2]);
      kg.box(0.22, 0.17, 0.01, M.inner('#d8c8a8', 0.3), [-0.33, 1.55, d / 2 + 0.101]);
      for (let i = 0; i < 7; i++) kg.box(0.2, 0.008, 0.006, M.inner('#8a6446', 0.2), [-0.33, 1.48 + i * 0.022, d / 2 + 0.107]);
      const rDial = A.glow.region(64, 32, (gg, ww, hh) => { gg.fillStyle = '#f2d9a0'; gg.fillRect(0, 0, ww, hh); gg.strokeStyle = '#6b4a37'; gg.lineWidth = 1; for (let i = 0; i < 12; i++) { gg.beginPath(); gg.moveTo(6 + i * 4.6, 20); gg.lineTo(6 + i * 4.6, i % 3 ? 25 : 28); gg.stroke(); } gg.fillStyle = '#d9463b'; gg.fillRect(30, 8, 2, 20); U.text(gg, 'AM  FM', ww / 2, 8, 8, F.en, '#6b4a37', { weight: 700 }); });
      S.card(rDial, 0.12, 0.06, [-0.12, 1.59, d / 2 + 0.103], null, null, kg);
      for (const dx of [-0.16, -0.08]) kg.cyl(0.02, 0.02, 0.025, M.inner('#e8dcc6', 0.35), [dx + 0.04, 1.5, d / 2 + 0.11], [Math.PI / 2, 0, 0], 12);
    }
    C.shrub(g, 0.35, 1.495, d / 2, { r: 0.12, h: 0.18, green: '#6f9a5a', seed: 12 });
    kg.cyl(0.07, 0.055, 0.1, M.inner('#e8e2d6', 0.35), [0.35, 1.465, d / 2], null, 12);
    // pothos on top with trailing clumps
    kg.cyl(0.09, 0.07, 0.12, M.inner('#c7805d', 0.3), [0.4, Hs + 0.08, d / 2], null, 12);
    C.shrub(g, 0.4, Hs + 0.11, d / 2, { r: 0.16, h: 0.2, green: '#5f8c5c', seed: 7 });
    for (let i = 0; i < 4; i++) C.shrub(g, 0.58 + (i % 2) * 0.03, Hs - 0.12 - i * 0.2, d + 0.05, { r: 0.07, h: 0.14, green: i % 2 ? '#6f9a5a' : '#5f8c5c', seed: 30 + i, flatBottom: false });
    // photo frame on the bottom shelf + stacked board games
    kg.box(0.18, 0.22, 0.02, mWoodD, [0.1, 0.19, d / 2], [-0.15, 0, 0]);
    const rPh = A.inner.region(64, 80, (gg, ww, hh) => { gg.fillStyle = '#bcd6ea'; gg.fillRect(0, 0, ww, hh); gg.fillStyle = '#a7c48b'; gg.fillRect(0, hh * 0.6, ww, hh * 0.4); for (let i = 0; i < 6; i++) U.sakura(gg, 12 + i * 9, 20 + (i % 2) * 10, 6, '#f2b5c8'); });
    S.card(rPh, 0.14, 0.18, [0.1, 0.19, d / 2 + 0.012], [-0.15, 0, 0], null, kg);
    for (let j = 0; j < 3; j++) kg.box(0.3, 0.05, 0.22, M.inner(['#3f7fb5', '#e9a23b', '#5a9e58'][j], 0.28), [-0.4, 0.1 + j * 0.05, d / 2], [0, j * 0.08, 0]);
    S.box(cx, z + d / 2, w, d + 0.02, -1, FY + Hs + 0.3);
  }

  // ---------------- sideboard with record player, speakers, records (south wall)
  {
    const z0 = -9.25, z1 = -8.2, cz = (z0 + z1) / 2, x = IX1 - 0.22, len = z1 - z0;
    const g = S.k.group([x, FY, cz], -Math.PI / 2); const kg = ctx.kit(g);
    kg.box(len, 0.03, 0.42, mWoodD, [0, 0.075, 0]); kg.box(len, 0.6, 0.02, mWoodD, [0, 0.37, -0.2]);
    for (const s of [-1, 1]) kg.box(0.03, 0.62, 0.42, mWoodD, [s * (len / 2 - 0.015), 0.37, 0]);
    kg.box(0.03, 0.58, 0.4, mWoodD, [0.12, 0.37, 0]);
    for (let i = 0; i < 3; i++) kg.box(0.34, 0.16, 0.39, mWoodM, [0.3, 0.19 + i * 0.18, 0.015]), kg.box(0.08, 0.015, 0.01, mBrass, [0.3, 0.2 + i * 0.18, 0.21]);
    for (const s of [-1, 1]) for (const zz of [-1, 1]) kg.cyl(0.015, 0.01, 0.06, mWoodD, [s * (len / 2 - 0.05), 0.03, zz * 0.16], null, 6);
    kg.box(len + 0.02, 0.03, 0.44, mWoodL, [0, 0.685, 0]);
    // records in the open bay
    const r = ctx.rng('cafe.rec');
    for (let i = 0; i < 14; i++) G.add('album', g, [-len / 2 + 0.06 + i * 0.024, 0.09, 0.02], [0.012, 0.3, 0.3], white(r), [0, Math.PI / 2, (r() - 0.5) * 0.05], r.int(0, 15));
    // turntable
    kg.box(0.44, 0.1, 0.34, mWoodM, [0, 0.75, 0]);
    kg.cyl(0.15, 0.15, 0.02, mSteelD, [-0.04, 0.81, 0], null, 24);
    kg.cyl(0.148, 0.148, 0.004, M.inner('#2a2630', 0.05), [-0.04, 0.822, 0], null, 24);
    kg.cyl(0.045, 0.045, 0.002, M.inner('#e9a23b', 0.3), [-0.04, 0.825, 0], null, 14);
    kg.cyl(0.018, 0.018, 0.05, mSteel, [0.16, 0.825, -0.1], null, 8);
    kg.cyl(0.004, 0.004, 0.22, mSteel, [0.1, 0.845, -0.02], [Math.PI / 2, 0, 0.55], 5);
    kg.box(0.03, 0.012, 0.04, mIron, [0.04, 0.84, 0.07], [0, 0.4, 0]);
    // speakers
    for (const s of [-1, 1]) { kg.box(0.18, 0.28, 0.16, mWoodD, [s * 0.36, 0.84, 0]); kg.box(0.14, 0.22, 0.01, M.inner('#6d5a50', 0.15), [s * 0.36, 0.84, 0.081]); kg.cyl(0.04, 0.04, 0.012, mIron, [s * 0.36, 0.8, 0.085], [Math.PI / 2, 0, 0], 12); }
    S.box(x, cz, 0.44, len, -1, FY + 1.0);
    // wall shelf above with jars / books + framed picture
    k.box(0.22, 0.03, 0.9, mWoodM, [IX1 - 0.11, FY + 1.3, cz]);
    for (let i = 0; i < 3; i++) k.cyl(0.04, 0.04, 0.12, mGlass, [IX1 - 0.11, FY + 1.375, cz - 0.3 + i * 0.12], null, 10).castShadow = false;
    let bzz = cz + 0.05; for (let i = 0; i < 8; i++) { const t = 0.022 + rr() * 0.015; G.add('book', S, [IX1 - 0.1, FY + 1.315, bzz + t / 2], [t, 0.2 + rr() * 0.04, 0.15], rr.pick(['#8c3a45', '#3f5f4f', '#e9dfc8', '#2f4f7a', '#c9a060']), [0, -Math.PI / 2, 0], rr.int(0, 15)); bzz += t + 0.002; }
  }

  // ---------------- framed pictures (south wall)
  {
    const pic = (seed, a, b) => A.inner.region(96, 72, (g, w, h) => { g.fillStyle = a; g.fillRect(0, 0, w, h); g.fillStyle = b; g.fillRect(0, h * 0.62, w, h * 0.38); g.fillStyle = '#6a5048'; g.fillRect(w * 0.3, h * 0.35, 4, h * 0.3); for (let i = 0; i < 9; i++) { g.fillStyle = i % 2 ? '#f2b5c8' : '#f7d3de'; g.beginPath(); g.arc(w * 0.3 + Math.cos(i + seed) * 16, h * 0.32 + Math.sin(i * 1.7) * 9, 9, 0, 6.3); g.fill(); } });
    for (const [z, y, rg] of [[-5.9, FY + 1.75, pic(1, '#bcd6ea', '#a7c48b')], [-8.72, FY + 1.95, pic(4, '#f1e3cf', '#c9b8a0')]]) {
      k.box(0.04, 0.46, 0.6, M.inner('#5e4636', 0.2), [IX1 - 0.02, y, z]);
      k.box(0.01, 0.4, 0.54, M.inner('#f4efe4', 0.4), [IX1 - 0.045, y, z]);
      S.card(rg, 0.44, 0.32, [IX1 - 0.052, y, z], [0, -Math.PI / 2, 0]);
    }
  }

  // ---------------- coat hooks by the door (north wall) with coat, scarf, hat, tote
  {
    const x = IX0 + 0.02, z0 = -4.25, z1 = -4.92, cz = (z0 + z1) / 2, y = FY + 1.78;
    k.box(0.03, 0.12, z0 - z1 + 0.1, mWoodD, [x, y, cz]);
    const hooks = [-4.33, -4.53, -4.73, -4.9];
    for (const hz of hooks) { k.cyl(0.008, 0.008, 0.08, mBrass, [x + 0.05, y - 0.01, hz], [0, 0, Math.PI / 2 - 0.4], 6); k.sphere(0.013, mBrass, [x + 0.085, y + 0.02, hz], 8); }
    // coat
    const cg = S.k.group([x + 0.09, y - 0.03, hooks[0]], Math.PI / 2); const kc = ctx.kit(cg);
    kc.mesh(ctx.geo.extrude([[-0.1, 0], [0.1, 0], [0.24, -0.25], [0.26, -0.95], [-0.26, -0.95], [-0.24, -0.25]], 0.1), M.inner('#c9b28a', 0.3), [0, 0, 0]);
    kc.box(0.22, 0.08, 0.12, M.inner('#b89e76', 0.28), [0, -0.05, 0.01]);
    kc.box(0.4, 0.04, 0.11, M.inner('#8a6446', 0.22), [0, -0.52, 0.0]);
    // scarf
    for (const s of [-1, 1]) k.box(0.012, 0.55, 0.07, M.inner('#8c3a45', 0.22), [x + 0.085, y - 0.3, hooks[1] + s * 0.035], [0, 0, 0.04 * s]);
    // straw hat
    k.mesh(new THREE.LatheGeometry([[0.001, 0.09], [0.07, 0.085], [0.08, 0.02], [0.17, 0.0], [0.18, -0.01]].map(p => new THREE.Vector2(p[0], p[1])), 18), M.inner('#e3cf9a', 0.34, { side: 'double' }), [x + 0.1, y - 0.1, hooks[2]], [0, 0, -Math.PI / 2 + 0.25]);
    k.cyl(0.075, 0.075, 0.02, M.inner('#3f5f4f', 0.2), [x + 0.1 + 0.04, y - 0.1, hooks[2]], [0, 0, -Math.PI / 2 + 0.25], 14);
    // tote bag
    k.box(0.04, 0.27, 0.24, M.inner('#d8c8a8', 0.34), [x + 0.06, y - 0.29, hooks[3]]);
    k.box(0.005, 0.1, 0.1, M.inner('#6f8455', 0.25), [x + 0.083, y - 0.3, hooks[3]]);
    k.mesh(new THREE.TorusGeometry(0.07, 0.008, 4, 12, Math.PI), M.inner('#d8c8a8', 0.34), [x + 0.06, y - 0.155, hooks[3]], [0, Math.PI / 2, 0]);
    S.box(IX0 + 0.14, cz, 0.24, 0.8, -1, FY + 1.9);
  }

  // ---------------- plants (smooth foliage): fiddle-leaf fig by the window, topiary at the counter end, sill pots
  P.pot(S, -4.8, FY, -5.7, { r: 0.22, h: 0.4, color: '#e8e2d6', plant: 'tall', th: 1.25, greens: ['#5f8c5c', '#6f9a5a', '#4d7a52'] });
  S.cyl(-4.8, -5.7, 0.26, -1, 2);
  P.pot(S, 4.82, FY, -9.62, { r: 0.2, h: 0.36, color: '#c7805d', plant: 'tall', th: 0.9, greens: ['#6f9a5a', '#86ad68'] });
  S.cyl(4.82, -9.62, 0.24, -1, 2);
  {
    k.cyl(0.16, 0.13, 0.3, M.inner('#8a8e94', 0.22), [-0.9, FY + 0.15, -10.3], null, 14);
    const tp = makeTopiary(ctx, { trunk: 0.55, r: 0.2, seed: 21 }); tp.position.set(-0.9, FY + 0.28, -10.3); S.g.add(tp);
    S.cyl(-0.9, -10.3, 0.2, -1, 1.3);
  }
  for (const [a, b] of [[-9.2, -7.6], [-6.6, -5.0]]) {
    const cz = (a + b) / 2;
    k.box(0.2, 0.03, b - a, mWoodL, [IX0 + 0.08, FY + 0.8, cz]);
    if (a > -7) continue;
    P.pot(S, IX0 + 0.09, FY + 0.815, cz - 0.4, { r: 0.07, h: 0.1, color: '#e8e2d6', plant: 'bush', greens: ['#6f9a5a'] });
    P.pot(S, IX0 + 0.09, FY + 0.815, cz + 0.35, { r: 0.06, h: 0.09, color: '#c7805d', plant: 'flowers', flowers: ['#f2b5c8', '#fbe9ef'], n: 6 });
  }
}
