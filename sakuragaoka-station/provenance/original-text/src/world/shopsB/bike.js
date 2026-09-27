// W6 サイクル丸山 — town bicycle shop: gable-front building with a wide garage opening behind a
// half-raised roll-up shutter, repair stand, tyre racks, pegboard tools, wheels hanging from the
// ceiling; outside a free air pump (空気入れ ご自由にどうぞ), 修理承ります sign, パンク修理 nobori.
// SPOTS.bikeShopBikes (lx -3.2/-2.4/-1.6, lz -1.0) are kept clear for the vehicles module.
import * as THREE from 'three';
import { buildBikeInterior } from './bikeInt.js';

export const TEXTS = ['サイクル丸山', 'MARUYAMA CYCLE', '自転車', '丸山', '空気入れ', 'ご自由にどうぞ', '修理承ります', 'パンク修理', 'タイヤ交換', 'ブレーキ調整', '点検', '防犯登録', '新車', '中古車', '¥1,000〜', '¥3,500〜', '¥800〜', '¥19,800〜', '¥8,000〜', '¥24,800', '¥21,800',
  '9:00〜19:00', '定休日 第2・第4火曜', '自転車は車道の左側を', '安全運転', 'ヘルメットをかぶろう', '桜ヶ丘警察署', '修理中', '整備済み', '事務所', 'お気軽にどうぞ', 'TEL 25-8812', '交通安全', 'チューブ', '各種', 'サイズ', '26インチ', '27インチ', '24インチ'];

export function buildBike(ctx, K, lot) {
  const { mat } = ctx; const { C, T, F } = K;
  const S = K.space(lot); const g = S.g;
  const B = (w, h, d, m, p, r) => K.box(g, w, h, d, m, p, r);
  const rnd = ctx.rng('shopsB-bike');

  const X0 = -4.2, X1 = 4.2, ZF = -2.5, ZB = -12.0, ZI = -8.2;
  const [gmin, gmax] = K.gRange(S, X0, X1, ZB, 0);
  const FL = gmax + 0.06;
  const H1 = 3.15, Y1 = FL + H1, YE = FL + 5.75, PITCH = 0.36, yR = YE + 0.05 + PITCH * (X1 - X0) / 2;
  const WT = 0.15;

  // ---------------------------------------------------------------- materials
  const mSiding = K.mt('#c2dacd', T.siding, { paint: 0.06 });
  const mMortar = K.mt('#e3dccb', T.plaster, { paint: 0.07 });
  const mSide = K.mt('#d9d5ca', T.corr, { paint: 0.08 });
  const mTrim = K.m('#f0ebe0');
  const mBase = K.mt('#aaa59b', T.concrete, { paint: 0.08 });
  const mRoof = K.mt('#5d7088', T.corr, { paint: 0.06 });
  const mApron = K.mt('#c3c0b7', T.concrete, { paint: 0.07 });
  const mGravel = K.mt('#b4ad9f', T.gravel);
  const mGlass = K.glass({ opacity: 0.2 });
  const mFrost = K.glass({ frost: true });
  const mAlu = K.m(C.alu), mAluDark = K.m(C.aluDark);
  const mShutter = K.mt('#c9d0d2', T.shutter, { paint: 0.05 });
  const mGutter = K.m('#8d949b', { side: 'double' });
  const iFloor = K.im('#aeaba3', 0.2, { map: T.concrete });
  const iWall = K.im('#e5ddcc', 0.3, { map: T.plaster });
  const iWood = K.im('#a1774f', 0.3, { map: T.grain });
  const iWoodDark = K.im('#6a4c3a', 0.26, { map: T.grain });
  const iSteel = K.im('#9aa1a8', 0.26);
  const iCeil = K.im('#dcd6ca', 0.28);

  // ---------------------------------------------------------------- ground + foundation (garage floor flush with the apron)
  K.slab(S, -4.5, 4.5, ZF - 0.05, 0, 0.035, mApron, 4);
  K.slab(S, X1, 4.5, ZB, ZF - 0.05, 0.02, mGravel, 1.5);
  K.slab(S, -4.5, X0, ZB, ZF - 0.05, 0.02, mGravel, 1.5);
  K.slab(S, -4.5, 4.5, -14, ZB, 0.02, mGravel, 1.5);
  K.tbox(g, X1 - X0, FL - 0.02 - (gmin - 0.25), ZF - ZB, mBase, [0, (FL - 0.02 + gmin - 0.25) / 2, (ZF + ZB) / 2], 3);
  K.tbox(g, X1 - X0 - 2 * WT, 0.03, ZF - ZI - WT, iFloor, [0, FL - 0.015, (ZF - WT + ZI) / 2], 3);
  S.walk(X0 + WT, ZI, X1 - WT, ZF + 0.02, FL);
  // concrete ramp in front of the garage (bikes roll in)
  {
    const r0 = -4.0, r1 = 2.35, zA = ZF + 0.9;
    const geo = K.boxGeo(r1 - r0, 1, 0.9, 2, [(r0 + r1) / 2, 0, ZF + 0.45]);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) { const lx = p.getX(i) + (r0 + r1) / 2, lz = p.getZ(i) + ZF + 0.45; const t = (lz - ZF) / 0.9; const top = FL * (1 - t) + (S.gl(lx, zA) + 0.035) * t; p.setY(i, p.getY(i) > 0 ? top : gmin - 0.15); }
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, K.mt('#b9b6ad', T.concrete)); m.position.set((r0 + r1) / 2, 0, ZF + 0.45); m.receiveShadow = true; g.add(m);
    const w0 = S.w2((r0 + r1) / 2, ZF + 0.45);
    ctx.physics.addWalkRamp(w0.x, w0.z, r1 - r0, 0.9, S.f.rotY, S.f.y + FL, S.f.y + S.gl(0, zA) + 0.035);
  }

  // ---------------------------------------------------------------- facade ground floor: garage + office door
  const openG = { a0: -4.0, a1: 2.35, y0: FL, y1: FL + 2.75 };
  const openO = { a0: 2.7, a1: 3.65, y0: FL, y1: FL + 2.05 };
  const openOW = { a0: 2.7, a1: 3.65, y0: FL + 2.2, y1: FL + 2.7 };
  K.wall(g, mMortar, { axis: 'x', a0: X0, a1: X1, y0: FL - 0.02, y1: Y1, c: ZF - WT / 2, t: WT, holes: [openG, openO, openOW], tile: 2.5 });
  for (const x of [X0 + 0.1, 2.52, X1 - 0.1]) K.tbox(g, 0.2, H1, 0.22, K.mt('#d4ccba', T.plaster), [x, FL + H1 / 2, ZF - 0.06], 2.5);
  B(X1 - X0 + 0.1, 0.14, 0.26, mTrim, [0, Y1 - 0.02, ZF - 0.04]);
  // shutter box + guide rails + half-raised curtain
  {
    const w = openG.a1 - openG.a0, cx = (openG.a0 + openG.a1) / 2, yb = FL + 1.98;
    K.rboxR(g, w + 0.16, 0.34, 0.36, 0.05, K.m('#b8bfc2'), [cx, openG.y1 + 0.16, ZF + 0.1]);
    for (const x of [openG.a0 + 0.03, openG.a1 - 0.03]) B(0.06, openG.y1 - FL, 0.08, mAluDark, [x, FL + (openG.y1 - FL) / 2, ZF + 0.02]);
    K.tbox(g, w - 0.04, openG.y1 - yb, 0.03, mShutter, [cx, (openG.y1 + yb) / 2, ZF + 0.02], 0.8);
    B(w - 0.04, 0.06, 0.06, K.m('#8d949b'), [cx, yb + 0.02, ZF + 0.03]);
    for (const x of [cx - 1.2, cx + 1.2]) B(0.12, 0.03, 0.05, K.m('#6d747c'), [x, yb + 0.05, ZF + 0.06]);
    S.box(openG.a0, ZF - 0.05, openG.a1, ZF + 0.06, FL + 1.98, openG.y1 + 0.3);
  }
  // office door (aluminium) + transom window
  {
    const w = openO.a1 - openO.a0, cx = (openO.a0 + openO.a1) / 2;
    const d = K.panel(g, { w, h: 2.03, d: 0.04, frame: mAlu, glass: mGlass, stile: 0.05, top: 0.06, bottom: 0.12, bars: [] });
    d.position.set(cx, FL + 0.01, ZF - 0.05);
    B(0.03, 0.18, 0.04, K.m('#6d747c'), [cx - w / 2 + 0.1, FL + 1.0, ZF - 0.01]);
    K.window(g, { x: cx, y0: openOW.y0, z: ZF - 0.07, w, h: openOW.y1 - openOW.y0, frame: mAluDark, glass: mFrost, panes: 1, sill: false });
    K.decal(g, K.hoursSticker(['9:00〜19:00', '定休日 第2・第4火曜'], '#2f64b5'), 0.22, 0.165, [cx + 0.18, FL + 1.35, ZF - 0.024]);
    K.decal(g, K.cashless(), 0.34, 0.107, [cx, FL + 0.95, ZF - 0.024]);
    K.eigyoPlate(g, cx, FL + 1.62, ZF - 0.022, 0, '営業中', '');
    S.box(openO.a0, ZF - WT, openO.a1, ZF, FL, FL + 2.05);
  }
  S.box(X0, ZF - WT, openG.a0, ZF, FL - 0.1, Y1);
  S.box(openG.a1, ZF - WT, openO.a0, ZF, FL - 0.1, Y1);
  S.box(openO.a1, ZF - WT, X1, ZF, FL - 0.1, Y1);
  // sign band
  {
    const sy = FL + 3.55, sh = 0.72, sw = 7.4;
    K.rboxR(g, sw + 0.12, sh + 0.12, 0.12, 0.03, K.m('#2f4f86'), [-0.1, sy, ZF + 0.06]);
    K.plane(g, sw, sh, K.toonMemo('#ffffff', { map: signTex(K) }), [-0.1, sy, ZF + 0.122]);
    for (const x of [-3.0, 0.0, 3.0]) { B(0.04, 0.04, 0.26, mAluDark, [x, sy + sh / 2 + 0.2, ZF + 0.16]); K.cyl(g, 0.05, 0.1, K.m('#5c6168'), [x, sy + sh / 2 + 0.2, ZF + 0.32], 10, [Math.PI / 2 - 0.5, 0, 0], 0.09); }
  }
  // posters / signs on piers
  K.plane(g, 0.5, 0.7, K.toonMemo('#ffffff', { map: safetyPosterTex(K) }), [X1 - 0.33, FL + 1.45, ZF + 0.004]);
  K.plane(g, 0.62, 0.42, K.toonMemo('#ffffff', { map: priceBoardTex(K) }), [2.52, FL + 1.55, ZF + 0.115]);
  K.sodeSign(g, { x: X1 - 0.3, y: Y1 + 0.45, z: ZF, w: 0.5, h: 1.55, tex: sodeTex(K), frame: '#e7ecef' });

  // ---------------------------------------------------------------- upper floor + gable front (妻入り)
  const win2 = [{ a0: -2.9, a1: -0.9, y0: Y1 + 0.95, y1: Y1 + 1.95 }, { a0: 0.9, a1: 2.9, y0: Y1 + 0.95, y1: Y1 + 1.95 }];
  K.wall(g, mSiding, { axis: 'x', a0: X0, a1: X1, y0: Y1 + 0.05, y1: YE, c: ZF - WT / 2, t: WT, holes: win2, tile: 1.8 });
  // gable triangle (front) + small vent
  {
    const gg = new THREE.Group(); gg.rotation.y = Math.PI / 2; g.add(gg);   // local x = -z
    K.gableEnd(gg, mSiding, -(ZF - WT / 2), X0, X1, YE - 0.001, 0, yR - 0.06, WT, 1.8);
    K.gableEnd(gg, K.mt('#d9d5ca', T.corr), -(ZB + WT / 2), X0, X1, YE - 0.001, 0, yR - 0.06, WT, 1.2);
  }
  K.rboxR(g, 0.5, 0.35, 0.06, 0.03, mTrim, [0, YE + 0.55, ZF + 0.02]);
  for (let i = 0; i < 4; i++) B(0.42, 0.025, 0.04, K.m('#9aa1a8'), [0, YE + 0.44 + i * 0.075, ZF + 0.05]);
  for (const o of win2) {
    const w = o.a1 - o.a0, h = o.y1 - o.y0, cx = (o.a0 + o.a1) / 2;
    K.window(g, { x: cx, y0: o.y0, z: ZF - 0.07, w, h, frame: mAluDark, glass: mGlass, panes: 2, behind: K.curtain(cx < 0 ? '#e8dfd2' : '#f0e2d8'), behindD: 0.1, sillMat: mTrim });
    B(w + 0.2, 0.05, 0.14, mTrim, [cx, o.y1 + 0.1, ZF + 0.04]);
    for (const sx of [-1, 1]) B(0.05, h + 0.1, 0.05, mTrim, [cx + sx * (w / 2 + 0.07), o.y0 + h / 2, ZF + 0.02]);
  }
  // flower boxes + a hanging towel on the south window — lived-in
  // planter on the left window sill (sits on the sill, in front of the glass)
  K.box(g, 1.3, 0.15, 0.16, K.m('#b98a6a'), [-1.9, Y1 + 0.97, ZF + 0.1]);
  K.hedge(g, -1.9, Y1 + 1.03, ZF + 0.1, 1.24, 0.17, 0.15, 7);
  for (let i = 0; i < 5; i++) K.sph(g, 0.033, K.m(['#f2b5c8', '#f7e28a', '#e9e2f2'][i % 3]), [-2.33 + i * 0.22, Y1 + 1.19, ZF + 0.17], 6);
  // AC outdoor unit on a wall bracket left of the window (clear of the sign band)
  K.acUnit(g, -3.58, Y1 + 0.98, ZF + 0.18, 0, false);
  B(0.84, 0.04, 0.34, mAluDark, [-3.58, Y1 + 0.96, ZF + 0.17]);
  for (const x of [-3.9, -3.26]) B(0.04, 0.3, 0.04, mAluDark, [x, Y1 + 0.84, ZF + 0.1], [0.8, 0, 0]);
  K.pipeRun(g, [[-3.26, Y1 + 1.3, ZF + 0.05], [-3.08, Y1 + 1.3, ZF + 0.05], [-3.08, Y1 + 2.3, ZF + 0.05]], 0.035, K.m('#e7e1d1'));

  // ---------------------------------------------------------------- side + back walls, roof (ridge along z)
  for (const x of [X0 + WT / 2, X1 - WT / 2]) {
    K.wall(g, mSide, { axis: 'z', a0: ZB, a1: ZF - WT, y0: FL - 0.05, y1: YE, c: x, t: WT, holes: x > 0 ? [{ a0: -7.0, a1: -6.0, y0: Y1 + 0.8, y1: Y1 + 1.7 }] : [], tile: 1.2 });
    S.box(x - WT / 2, ZB, x + WT / 2, ZF, FL - 0.1, YE);
  }
  K.window(g, { x: X1 + 0.005, y0: Y1 + 0.8, z: -6.5, w: 1.0, h: 0.9, frame: mAluDark, glass: mGlass, panes: 2, rotY: Math.PI / 2, behind: K.curtain('#e6e0d6') });
  K.wall(g, K.mt('#d9d5ca', T.corr), { axis: 'x', a0: X0 + WT, a1: X1 - WT, y0: FL - 0.05, y1: YE, c: ZB + WT / 2, t: WT, holes: [{ a0: -1.0, a1: 0.8, y0: Y1 + 0.8, y1: Y1 + 1.8 }], tile: 1.2 });
  K.window(g, { x: -0.1, y0: Y1 + 0.8, z: ZB - 0.03, w: 1.8, h: 1.0, frame: mAluDark, glass: mGlass, panes: 2, rotY: Math.PI, behind: K.curtain('#dfe0e6') });
  S.box(X0, ZB, X1, ZI, FL - 0.1, YE);
  {
    const rg = new THREE.Group(); rg.rotation.y = Math.PI / 2; g.add(rg);
    const ov = 0.18;
    K.gableX(rg, { x0: -(ZF + 0.55), x1: -(ZB - 0.4), zf: X1 + ov, zb: X0 - ov, yE: YE + 0.05 - PITCH * ov, yR, zR: 0, t: 0.09, mat: mRoof, tile: 1.2, fascia: mTrim });
    K.box(rg, Math.abs((ZB - 0.4) - (ZF + 0.55)), 0.12, 0.28, K.m('#4f5f70'), [-((ZF + 0.55) + (ZB - 0.4)) / 2, yR + 0.06, 0]);
    for (const side of [1, -1]) {
      const run = X1 + ov, rise = yR - (YE + 0.05 - PITCH * ov), len = Math.hypot(run, rise), ang = Math.atan2(rise, run);
      K.box(rg, 0.05, 0.2, len, mTrim, [-(ZF + 0.55) - 0.02, (yR + YE + 0.05 - PITCH * ov) / 2 - 0.03, side * run / 2], [side * ang, 0, 0]); // barge board (front)
    }
    K.gutterX(rg, -(ZF + 0.55), -(ZB - 0.4), YE + 0.05 - PITCH * ov - 0.1, X1 + ov + 0.05, mGutter);
    K.gutterX(rg, -(ZF + 0.55), -(ZB - 0.4), YE + 0.05 - PITCH * ov - 0.1, -(X1 + ov + 0.05), mGutter);
  }
  K.downpipe(g, X1 + 0.2, ZF - 0.4, YE - 0.2, S.gl(X1 + 0.2, ZF - 0.4) + 0.02, mGutter, 0.2, [-1, 0]);
  K.downpipe(g, X0 - 0.2, ZF - 0.4, YE - 0.2, S.gl(X0 - 0.2, ZF - 0.4) + 0.02, mGutter, 0.2, [1, 0]);
  // side utilities (north wall)
  {
    const wg = new THREE.Group(); wg.position.set(X1 + 0.005, 0, 0); wg.rotation.y = Math.PI / 2; g.add(wg);
    K.meter(wg, 4.2, FL + 1.6, 0); K.gasMeter(wg, 4.9, FL + 1.0, 0);
  }
  K.acUnit(g, X1 + 0.03, S.gl(X1, -8.8) + 0.02, -8.8, Math.PI / 2);
  S.box(X1, -9.2, 4.5, -8.4, 0, 0.7);

  // ---------------------------------------------------------------- interior workshop (see bikeInt.js)
  buildBikeInterior(ctx, K, S, { FL, ZF, ZI, WT, X0, X1, safetyPoster: safetyPosterTex(K) });

  // ---------------------------------------------------------------- outside: air pump, repair sign, nobori, tyres, chair
  const ag = (x, z) => S.gl(x, z) + 0.035;
  {
    const px = 3.9, pz = -1.25, y0 = ag(px, pz);
    // short post with the sign
    K.cyl(g, 0.035, 1.1, K.m('#e8e6e0'), [px + 0.25, y0 + 0.55, pz - 0.2], 8);
    K.box(g, 0.44, 0.3, 0.02, K.m('#e8e6e0'), [px + 0.25, y0 + 1.25, pz - 0.19]);
    K.plane(g, 0.42, 0.28, K.toonMemo('#ffffff', { map: pumpSignTex(K) }), [px + 0.25, y0 + 1.25, pz - 0.178]);
    // floor pump chained to the post
    const pg = new THREE.Group(); pg.position.set(px - 0.1, y0, pz); pg.rotation.y = 0.3; g.add(pg);
    K.box(pg, 0.26, 0.03, 0.1, K.m('#3a3346'), [0, 0.015, 0]);
    K.cyl(pg, 0.035, 0.62, K.m('#3f7fb5'), [0, 0.34, 0], 10);
    K.cyl(pg, 0.012, 0.12, K.m('#b9bfc4'), [0, 0.7, 0], 6);
    K.cylX(pg, 0.02, 0.3, K.m('#3a3346'), [0, 0.77, 0], 8);
    K.box(pg, 0.08, 0.03, 0.06, K.m('#e8e6e0'), [0.02, 0.45, 0.04]);
    ctx.wires.add([[0, 0.12, 0.03], [0.1, 0.05, 0.12], [0.2, 0.2, 0.1], [0.15, 0.5, 0.05]].map(([a, b, c]) => { const v = new THREE.Vector3(a, b, c).applyEuler(new THREE.Euler(0, 0.3, 0)); const w = S.w2(px - 0.1 + v.x, pz + v.z); return [w.x, S.f.y + y0 + b, w.z]; }), { width: 0.012, color: '#2f2a36' });
    ctx.wires.add([[S.w2(px + 0.22, pz - 0.18).x, S.f.y + y0 + 0.4, S.w2(px + 0.22, pz - 0.18).z], [S.w2(px - 0.08, pz + 0.02).x, S.f.y + y0 + 0.3, S.w2(px - 0.08, pz + 0.02).z]], { width: 0.008, color: '#8d949b' });
    S.box(px - 0.3, pz - 0.3, px + 0.35, pz + 0.15, y0, y0 + 1.4);
  }
  // 修理承ります stand sign
  {
    const x = 2.35, z = -0.55, y0 = ag(x, z);
    const sg = new THREE.Group(); sg.position.set(x, y0, z); sg.rotation.y = -0.35; g.add(sg);
    K.box(sg, 0.5, 0.05, 0.4, K.m('#6d747c'), [0, 0.025, 0]);
    K.box(sg, 0.05, 1.3, 0.05, K.m('#e8e6e0'), [0, 0.65, 0]);
    K.box(sg, 0.52, 1.0, 0.05, K.m('#e8e6e0'), [0, 1.0, 0]);
    K.plane(sg, 0.48, 0.96, K.toonMemo('#ffffff', { map: repairSignTex(K) }), [0, 1.0, 0.027]);
    K.plane(sg, 0.48, 0.96, K.toonMemo('#ffffff', { map: repairSignTex(K) }), [0, 1.0, -0.027], Math.PI);
    S.box(x - 0.28, z - 0.22, x + 0.28, z + 0.22, y0, y0 + 1.5);
  }
  K.nobori(S, { x: 4.25, z: -0.25, rot: 0.3, tex: punkNoboriTex(K), w: 0.45, h: 1.6, poleH: 2.5, flip: true, baseColor: '#8d949b' });
  // tyres leaning on the facade pier (south end), folding chair by the office door
  for (let i = 0; i < 3; i++) tyre(g, K, -4.05 + 0.02 * i, ag(-4.05, -2.3) + 0.32, -2.32 + i * 0.09, 0.32, '#3f3a44', 0.1 * i - 0.1, false);
  S.box(-4.4, -2.5, -3.7, -2.0, 0, 0.7);
  {
    const x = 3.93, z = -2.2, y0 = ag(x, z);
    const cg = new THREE.Group(); cg.position.set(x, y0, z); cg.rotation.y = -0.25; g.add(cg);
    const c = K.m('#3f7fb5'), st = K.m('#9aa1a8');
    K.box(cg, 0.42, 0.04, 0.4, c, [0, 0.44, 0]);
    K.box(cg, 0.42, 0.36, 0.04, c, [0, 0.66, -0.19], [-0.1, 0, 0]);
    for (const sx of [-0.19, 0.19]) { K.box(cg, 0.025, 0.46, 0.025, st, [sx, 0.22, 0.17], [0.15, 0, 0]); K.box(cg, 0.025, 0.86, 0.025, st, [sx, 0.43, -0.18], [-0.08, 0, 0]); }
    S.box(x - 0.25, z - 0.25, x + 0.25, z + 0.25, y0, y0 + 0.9);
  }
  return { S, FL };
}

// ============================================================================ bike parts
function tyre(p, K, x, y, z, R, color, rotY = 0, interior = true) {
  const m = new THREE.Mesh(new THREE.TorusGeometry(R, 0.028, 6, 22), interior ? K.im(color, 0.18) : K.m(color));
  m.position.set(x, y, z); m.rotation.y = rotY; m.castShadow = true; m.receiveShadow = true; p.add(m); return m;
}
// ============================================================================ textures
function bikeIcon(g, x, y, s, col) {
  g.strokeStyle = col; g.lineWidth = s * 0.08; g.lineCap = 'round'; g.lineJoin = 'round';
  g.beginPath(); g.arc(x - s * 0.55, y + s * 0.2, s * 0.32, 0, 7); g.stroke();
  g.beginPath(); g.arc(x + s * 0.55, y + s * 0.2, s * 0.32, 0, 7); g.stroke();
  g.beginPath(); g.moveTo(x - s * 0.55, y + s * 0.2); g.lineTo(x - s * 0.15, y - s * 0.25); g.lineTo(x + s * 0.3, y - s * 0.25); g.lineTo(x + s * 0.55, y + s * 0.2);
  g.moveTo(x - s * 0.15, y - s * 0.25); g.lineTo(x, y + s * 0.2); g.lineTo(x + s * 0.3, y - s * 0.25);
  g.moveTo(x - s * 0.2, y - s * 0.38); g.lineTo(x - s * 0.02, y - s * 0.38);
  g.moveTo(x + s * 0.3, y - s * 0.25); g.lineTo(x + s * 0.28, y - s * 0.45); g.lineTo(x + s * 0.42, y - s * 0.45); g.stroke();
}
function signTex(K) {
  return K.tex.draw(1024, 100, (g, w, h) => {
    g.fillStyle = '#f4f0e6'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#2f4f86'; g.fillRect(0, 0, 150, h);
    bikeIcon(g, 75, h / 2 + 2, 54, '#f4f0e6');
    K.text(g, '自転車', 238, h * 0.54, 150, 42, K.F.sans, 900, '#2f4f86');
    K.text(g, 'サイクル丸山', w * 0.56, h * 0.48, 420, 70, K.F.round, 900, '#2a3550');
    K.text(g, 'MARUYAMA CYCLE', w * 0.56, h * 0.86, 300, 16, K.F.en, 700, '#5a6680');
    K.text(g, 'TEL 25-8812', w * 0.88, h * 0.55, 190, 26, K.F.en, 700, '#c9463e');
  }, { key: 'sb-bike-sign' });
}
function sodeTex(K) {
  return K.tex.draw(160, 496, (g, w, h) => {
    g.fillStyle = '#f4f0e6'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#2f4f86'; g.fillRect(0, 0, w, 110);
    bikeIcon(g, w / 2, 58, 56, '#f4f0e6');
    g.fillStyle = '#2f4f86'; g.font = `900 84px ${K.F.round}`; K.vtext(g, '自転車', w / 2, 128, 84, 1.02);
    K.text(g, '丸山', w / 2, h - 36, w - 30, 40, K.F.round, 900, '#c9463e');
  }, { key: 'sb-bike-sode' });
}
function pumpSignTex(K) {
  return K.tex.draw(256, 168, (g, w, h) => {
    g.fillStyle = '#f7f3ea'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#3f7fb5'; g.fillRect(0, 0, w, 64);
    K.text(g, '空気入れ', w / 2, 34, w - 24, 44, K.F.round, 900, '#fdf8ee');
    K.text(g, 'ご自由にどうぞ', w / 2, 104, w - 24, 32, K.F.round, 900, '#3a3346');
    K.text(g, 'サイクル丸山', w / 2, 146, w - 60, 18, K.F.sans, 700, '#6d6a80');
  }, { key: 'sb-bike-pump' });
}
function repairSignTex(K) {
  return K.tex.draw(256, 512, (g, w, h) => {
    g.fillStyle = '#f7f3ea'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#c9463e'; g.fillRect(0, 0, w, 250);
    g.fillStyle = '#fdf8ee'; g.font = `400 62px ${K.F.brush}`; K.vtext(g, '修理承ります', w * 0.5, 14, 38, 0.98);
    const rows = [['パンク修理', '¥1,000〜'], ['タイヤ交換', '¥3,500〜'], ['ブレーキ調整', '¥800〜'], ['防犯登録', '承ります']];
    rows.forEach(([a, b], i) => { K.text(g, a, w * 0.36, 282 + i * 52, w * 0.6, 26, K.F.sans, 900, '#2a3550'); K.text(g, b, w * 0.8, 282 + i * 52, w * 0.38, 22, K.F.sans, 900, '#c9463e'); });
    K.text(g, 'お気軽にどうぞ', w / 2, h - 20, w - 30, 22, K.F.round, 700, '#3a3346');
  }, { key: 'sb-bike-repair' });
}
function punkNoboriTex(K) {
  return K.tex.draw(160, 570, (g, w, h) => {
    g.fillStyle = '#e8c547'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#f7f3ea'; g.fillRect(w - 18, 0, 18, h);
    g.fillStyle = '#2f4f86'; g.fillRect(0, 0, w - 18, 70);
    bikeIcon(g, (w - 18) / 2, 36, 40, '#fdf8ee');
    g.fillStyle = '#c9463e'; g.font = `900 80px ${K.F.round}`; K.vtext(g, 'パンク修理', (w - 18) / 2, 88, 80, 1.0);
    g.fillStyle = '#2f4f86'; g.fillRect(0, h - 30, w - 18, 30);
    K.text(g, '即日OK', (w - 18) / 2, h - 15, w - 30, 20, K.F.round, 900, '#fdf8ee');
  }, { key: 'sb-bike-nobori' });
}
function priceBoardTex(K) {
  return K.tex.draw(256, 174, (g, w, h) => {
    g.fillStyle = '#2f4f86'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#f7f3ea'; g.fillRect(8, 8, w - 16, h - 16);
    K.text(g, '新車', 60, 50, 90, 36, K.F.round, 900, '#c9463e');
    K.text(g, '¥19,800〜', 170, 52, 150, 32, K.F.sans, 900, '#2a3550');
    K.text(g, '中古車', 60, 108, 100, 30, K.F.round, 900, '#3f8f5b');
    K.text(g, '¥8,000〜', 170, 110, 150, 30, K.F.sans, 900, '#2a3550');
    K.text(g, '整備済み・防犯登録', w / 2, 148, w - 30, 18, K.F.sans, 700, '#6d6a80');
  }, { key: 'sb-bike-price' });
}
function safetyPosterTex(K) {
  return K.tex.draw(200, 280, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#cfe3f1'); gr.addColorStop(1, '#f6eed8'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = '#3f8f5b'; g.fillRect(0, 0, w, 44);
    K.text(g, '交通安全', w / 2, 23, w - 20, 28, K.F.round, 900, '#fdf8ee');
    bikeIcon(g, w / 2, 124, 60, '#2f4f86');
    g.fillStyle = '#e8c547'; g.beginPath(); g.arc(w / 2 - 6, 80, 16, Math.PI, 0); g.fill();
    K.text(g, '自転車は車道の左側を', w / 2, 196, w - 16, 18, K.F.sans, 900, '#2a3550');
    K.text(g, 'ヘルメットをかぶろう', w / 2, 226, w - 16, 18, K.F.sans, 900, '#c9463e');
    K.text(g, '桜ヶ丘警察署', w / 2, 262, w - 60, 14, K.F.sans, 700, '#6d6a80');
  }, { key: 'sb-bike-safety' });
}
