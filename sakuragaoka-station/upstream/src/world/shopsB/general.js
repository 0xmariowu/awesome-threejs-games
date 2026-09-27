// E3 よろず屋 山田商店 — Showa 看板建築 general store: copper-plate false front with a crowned
// parapet, canvas awning, big signboard, open storefront with goods spilling onto the apron,
// ice-cream chest freezer + nobori, enamel signs, retro toys & magazines in the window.
import * as THREE from 'three';
import { buildGeneralInterior } from './generalInt.js';

export const TEXTS = ['よろず屋', '山田商店', '食料品', '日用雑貨', '米穀', 'たばこ', 'お米', 'TEL 24-3156', 'ヒバリ印', '蚊とり線香', '桜川醤油', '醤油', 'コトリ石鹸', 'お肌すべすべ', '春日ラムネ', 'つめた〜い', 'アイスクリーム', 'つめたい', 'おいしい',
  '桜ヶ丘産', 'コシヒカリ', '5kg', '10kg', '新米', '精米', '月刊', 'はるかぜ', '週刊', 'ハナビ', 'ひだまり', '少年', 'ソラマメ', 'まんが', '夏まつり', '桜ヶ丘', '盆踊り', '花火大会', '8月15日', '16日', '本日の特売', 'たまご', '1パック', '198円',
  'キャベツ', '1玉', '128円', '7:00〜20:00', '年中無休', 'さくまる', '桜ヶ丘町', 'マスコット', 'カレー', 'せんべい', '洗剤', 'のり', 'ティッシュ', 'うどん', 'マッチ', 'キャラメル', 'サイダー', 'しょうゆ', 'みそ', 'お茶', 'ラーメン', 'クッキー', 'ビスケット', 'だがし',
  '冷たいお飲み物', '駄菓子', '10円', '20円', '30円', 'ほうき', 'バケツ', 'ご自由にお取りください', '町内会', 'お知らせ', '春の交通安全運動', '4月6日', '15日', 'やまだ', '山'];

export function buildGeneral(ctx, K, lot) {
  const { mat } = ctx; const { C, T, F } = K;
  const S = K.space(lot); const g = S.g;
  const B = (w, h, d, m, p, r) => K.box(g, w, h, d, m, p, r);
  const rnd = ctx.rng('shopsB-general');

  const X0 = -4.0, X1 = 4.0, ZF = -2.0, ZB = -11.2, ZI = -7.4;
  const [gmin, gmax] = K.gRange(S, X0, X1, ZB, 0);
  const FL = gmax + 0.1;
  const H1 = 3.1, Y1 = FL + H1, YE = FL + 5.75, YP = FL + 6.3, YC = FL + 6.8;
  const WT = 0.15;

  // ---------------------------------------------------------------- materials
  const mCopper = K.mt(C.copper, T.copper, { paint: 0.07 });
  const mCopperDark = K.m('#6f9c88');
  const mMortar = K.mt('#d9d1c1', T.plaster, { paint: 0.07 });
  const mMosaic = K.mt('#ffffff', mosaicTex(K), { paint: 0.04 });
  const mCorr = K.mt('#94aab6', T.corr, { paint: 0.08 });
  const mCorrBack = K.mt('#a6b3ae', T.corr, { paint: 0.08 });
  const mAlu = K.m(C.alu), mAluDark = K.m(C.aluDark);
  const mRoof = K.mt('#8d5d50', T.corr, { paint: 0.07 });
  const mBase = K.mt('#aaa59b', T.concrete, { paint: 0.08 });
  const mApron = K.mt('#c9c6bd', T.concrete, { paint: 0.06 });
  const mGravel = K.mt('#b9b2a5', T.gravel);
  const mGlass = K.glass({ opacity: 0.18 });
  const mFrost = K.glass({ frost: true });
  const mGutter = K.m('#9aa1a8', { side: 'double' });
  const iFloor = K.im('#b9bab0', 0.22, { map: T.tile });
  const iWall = K.im('#ece3cf', 0.3, { map: T.plaster });
  const iCeil = K.im('#e6e1d6', 0.3);
  const iWood = K.im('#a57c58', 0.3, { map: T.grain });
  const iWoodDark = K.im('#6e5040', 0.26, { map: T.grain });
  const iShelf = K.im('#d5d2c8', 0.28);

  // ---------------------------------------------------------------- ground
  K.slab(S, -4.25, 4.25, ZF - 0.05, 0, 0.035, mApron, 4);
  K.slab(S, X1, 4.25, ZB, ZF - 0.05, 0.02, mGravel, 1.5);
  K.slab(S, -4.25, X0, ZB, ZF - 0.05, 0.02, mGravel, 1.5);
  K.slab(S, -4.25, 4.25, -14, ZB, 0.02, mGravel, 1.5);
  K.tbox(g, X1 - X0, FL - 0.02 - (gmin - 0.2), ZF - ZB, mBase, [0, (FL - 0.02 + gmin - 0.2) / 2, (ZF + ZB) / 2], 3);
  K.tbox(g, X1 - X0 - 2 * WT, 0.03, ZF - ZI - WT, iFloor, [0, FL - 0.015, (ZF - WT + ZI) / 2], 2.4);
  S.walk(X0 + WT, ZI, X1 - WT, ZF + 0.02, FL);
  // entrance step (low concrete sill)
  const stepTop = (FL + S.gl(0.1, ZF + 0.2) + 0.035) / 2;
  K.tbox(g, 2.3, stepTop - gmin + 0.1, 0.3, K.mt('#b3afa6', T.concrete), [0.12, (stepTop + gmin - 0.1) / 2, ZF + 0.15], 2);

  // ---------------------------------------------------------------- facade: ground floor
  const openL = { a0: -3.8, a1: -2.3, y0: FL + 0.72, y1: FL + 2.4 };   // display window
  const openM = { a0: -2.1, a1: 2.3, y0: FL, y1: FL + 2.45 };           // open storefront
  K.wall(g, mMortar, { axis: 'x', a0: X0, a1: X1, y0: FL + 0.6, y1: Y1, c: ZF - WT / 2, t: WT, holes: [openL, openM], tile: 2.5 });
  K.wall(g, mMosaic, { axis: 'x', a0: X0, a1: X1, y0: FL - 0.02, y1: FL + 0.6, c: ZF - WT / 2 + 0.005, t: WT + 0.01, holes: [openM], tile: 0.4 });
  // pilasters
  for (const x of [X0 + 0.1, -2.2, 2.38, X1 - 0.1]) K.tbox(g, 0.2, H1, 0.22, K.mt('#cfc6b3', T.plaster), [x, FL + H1 / 2, ZF - 0.06], 2.5);
  B(openM.a1 - openM.a0, 0.05, 0.2, mAluDark, [(openM.a0 + openM.a1) / 2, FL + 0.01, ZF - 0.08]);
  B(openM.a1 - openM.a0 + 0.1, 0.12, 0.2, mAluDark, [(openM.a0 + openM.a1) / 2, openM.y1 + 0.02, ZF - 0.08]);
  // aluminium sliding doors pushed aside (2 stacks) — open storefront during business hours
  const pw = 1.1, dh = 2.4;
  const dOpt = { w: pw, h: dh, d: 0.035, frame: mAlu, glass: mGlass, stile: 0.04, top: 0.05, bottom: 0.1, bars: [0.42] };
  [[openM.a0 + pw / 2, ZF - 0.03], [openM.a0 + pw / 2 + 0.08, ZF - 0.08], [openM.a1 - pw / 2, ZF - 0.03], [openM.a1 - pw / 2 - 0.08, ZF - 0.08]].forEach(([x, z]) => { const p = K.panel(g, dOpt); p.position.set(x, FL + 0.02, z); });
  S.box(openM.a0, ZF - 0.12, openM.a0 + pw + 0.08, ZF, FL, FL + 2.4);
  S.box(openM.a1 - pw - 0.08, ZF - 0.12, openM.a1, ZF, FL, FL + 2.4);
  S.box(X0, ZF - WT, openM.a0, ZF, FL - 0.1, Y1);
  S.box(openM.a1, ZF - WT, X1, ZF, FL - 0.1, Y1);
  // display window (left)
  {
    const w = openL.a1 - openL.a0, h = openL.y1 - openL.y0, cx = (openL.a0 + openL.a1) / 2;
    K.window(g, { x: cx, y0: openL.y0, z: ZF - 0.07, w, h, frame: mAluDark, glass: mGlass, panes: 1, sill: true, sillMat: K.m('#b3aca0') });
  }
  // signs on the right pier: enamel signs
  enamel(g, K, 'soy', 3.12, FL + 1.95, ZF + 0.012, 0.7, 0.95);
  enamel(g, K, 'kayari', 3.12, FL + 0.95, ZF + 0.012, 0.62, 0.62);

  // ---------------------------------------------------------------- awning (テント) + valance
  {
    const ax0 = -3.95, ax1 = 3.95, yT = FL + 2.95, dep = 1.25, drop = 0.42;
    const len = Math.hypot(dep, drop), ang = Math.atan2(drop, dep);
    const cloth = K.m('#6f9d8f', { paint: 0.06 });
    const stripe = awningTex(K);
    K.tbox(g, ax1 - ax0, 0.02, len, K.mt('#ffffff', stripe, { side: 'double' }), [0, yT - drop / 2, ZF + dep / 2], 1.0, [ang, 0, 0]);
    K.plane(g, ax1 - ax0, 0.32, K.toonMemo('#ffffff', { map: valanceTex(K), side: 'double' }), [0, yT - drop - 0.16, ZF + dep + 0.004]);
    for (const x of [ax0, ax1]) {
      const sg = new THREE.Group(); sg.position.set(x, yT, ZF); g.add(sg);
      const side = K.extrude(sg, [[0, 0], [dep, -drop], [dep, -drop - 0.32], [dep - 0.05, -drop - 0.32]], 0.01, cloth, [0, 0, 0], [0, -Math.PI / 2, 0]);
    }
    for (const x of [ax0 + 0.1, 0, ax1 - 0.1]) B(0.03, 0.03, dep, mAluDark, [x, yT - drop / 2 - 0.03, ZF + dep / 2], [ang, 0, 0]);
    B(ax1 - ax0, 0.05, 0.05, mAluDark, [0, yT - drop - 0.02, ZF + dep - 0.02]);
    B(ax1 - ax0, 0.08, 0.08, mAluDark, [0, yT + 0.02, ZF + 0.04]);
  }
  // big signboard band
  {
    const sy = FL + 3.42, sh = 0.72, sw = 7.6;
    K.rboxR(g, sw + 0.1, sh + 0.1, 0.1, 0.02, K.m('#6d5a4a'), [0, sy, ZF + 0.05]);
    K.plane(g, sw, sh, K.toonMemo('#ffffff', { map: bigSignTex(K), paint: 0.03 }), [0, sy, ZF + 0.102]);
    for (const x of [-3.2, 0, 3.2]) { B(0.04, 0.04, 0.22, mAluDark, [x, sy + sh / 2 + 0.2, ZF + 0.15]); K.cyl(g, 0.05, 0.1, K.m('#5c6168'), [x, sy + sh / 2 + 0.2, ZF + 0.3], 10, [Math.PI / 2 - 0.5, 0, 0], 0.09); }
  }

  // ---------------------------------------------------------------- facade: upper floor (copper plates) + parapet + crown
  const win2 = [{ a0: -3.25, a1: -0.95, y0: FL + 4.15, y1: FL + 5.2 }, { a0: 0.95, a1: 3.25, y0: FL + 4.15, y1: FL + 5.2 }];
  K.wall(g, mCopper, { axis: 'x', a0: X0, a1: X1, y0: Y1, y1: YP, c: ZF - WT / 2, t: WT, holes: win2, tile: 1.8 });
  K.wall(g, mCopper, { axis: 'x', a0: -1.25, a1: 1.25, y0: YP, y1: YC, c: ZF - WT / 2, t: WT, tile: 1.8 });
  B(X1 - X0 + 0.16, 0.1, 0.24, mCopperDark, [0, Y1 + 0.02, ZF - 0.03]);
  // cornice (stepped) + 七宝 band + crown with 屋号
  B(X1 - X0 + 0.2, 0.1, 0.28, mCopperDark, [0, YP - 0.02, ZF - 0.02]);
  B(X1 - X0 + 0.28, 0.06, 0.34, K.m('#7fa895'), [0, YP + 0.06, ZF - 0.02]);
  K.plane(g, X1 - X0 - 0.3, 0.26, K.toonMemo('#ffffff', { map: shippoTex(K) }), [0, YP - 0.3, ZF + 0.004]);
  B(2.62, 0.08, 0.3, K.m('#7fa895'), [0, YC + 0.02, ZF - 0.02]);
  for (const x of [-1.3, 1.3]) B(0.12, YC - YP, 0.22, mCopperDark, [x, (YC + YP) / 2, ZF - 0.04]);
  K.cyl(g, 0.24, 0.05, K.m('#e9e2cf'), [0, YC - 0.25, ZF + 0.01], 24, [Math.PI / 2, 0, 0]);
  K.plane(g, 0.42, 0.42, K.toonMemo('#ffffff', { map: yagoTex(K), transparent: true }), [0, YC - 0.25, ZF + 0.038]);
  for (const o of win2) {
    const w = o.a1 - o.a0, h = o.y1 - o.y0, cx = (o.a0 + o.a1) / 2;
    K.window(g, { x: cx, y0: o.y0, z: ZF - 0.07, w, h, frame: mAlu, glass: mGlass, panes: 2, behind: K.curtain(cx < 0 ? '#e9dccb' : '#dfe6ea'), behindD: 0.1, sillMat: mCopperDark });
    // iron railing (手すり) with flower box
    const rg = new THREE.Group(); rg.position.set(cx, o.y0 - 0.12, ZF + 0.18); g.add(rg);
    const iron = K.m('#4f5a60');
    K.box(rg, w + 0.1, 0.03, 0.03, iron, [0, 0.62, 0]); K.box(rg, w + 0.1, 0.02, 0.02, iron, [0, 0.08, 0]);
    for (let i = 0; i <= 12; i++) K.box(rg, 0.014, 0.54, 0.014, iron, [-w / 2 - 0.05 + i * (w + 0.1) / 12, 0.35, 0]);
    for (const sx of [-1, 1]) K.box(rg, 0.03, 0.03, 0.2, iron, [sx * (w / 2 + 0.04), 0.3, -0.1]);
    K.box(rg, w * 0.6, 0.14, 0.16, K.m('#b98a6a'), [0.1, 0.16, -0.1]);
    K.hedge(rg, 0.1, 0.2, -0.1, w * 0.58, 0.16, 0.15, cx < 0 ? 4 : 5);
    for (let i = 0; i < 5; i++) K.sph(rg, 0.03, K.m(['#f2b5c8', '#f7e28a', '#f4efe6'][i % 3]), [-w * 0.22 + i * w * 0.11, 0.35, -0.03], 6);
  }

  // ---------------------------------------------------------------- side walls (corrugated tin), back wall, roof (妻入り metal)
  for (const x of [X0 + WT / 2, X1 - WT / 2]) {
    K.wall(g, mCorr, { axis: 'z', a0: ZB, a1: ZF - WT, y0: FL - 0.05, y1: YE, c: x, t: WT, holes: x > 0 ? [{ a0: -6.5, a1: -5.3, y0: FL + 3.9, y1: FL + 4.9 }] : [], tile: 1.2 });
    S.box(x - WT / 2, ZB, x + WT / 2, ZF, FL - 0.1, YE);
  }
  K.window(g, { x: X1 + 0.005, y0: FL + 3.9, z: -5.9, w: 1.2, h: 1.0, frame: mAluDark, glass: mGlass, panes: 2, rotY: Math.PI / 2, behind: K.curtain('#efe0cf') });
  // painted enamel ad on the south side wall (visible from the street to the south)
  {
    const sg = new THREE.Group(); sg.position.set(X1 + 0.02, FL + 2.3, -4.2); sg.rotation.y = Math.PI / 2; g.add(sg);
    enamel(sg, K, 'ramune', 0, 0, 0, 1.0, 1.4);
    const sg2 = new THREE.Group(); sg2.position.set(X1 + 0.02, FL + 2.1, -7.4); sg2.rotation.y = Math.PI / 2; g.add(sg2);
    enamel(sg2, K, 'soap', 0, 0, 0, 1.3, 0.45);
  }
  K.wall(g, mCorrBack, { axis: 'x', a0: X0 + WT, a1: X1 - WT, y0: FL - 0.05, y1: YE, c: ZB + WT / 2, t: WT, holes: [{ a0: -3.0, a1: -2.1, y0: FL, y1: FL + 1.9 }, { a0: 0.5, a1: 2.0, y0: FL + 3.7, y1: FL + 4.7 }], tile: 1.2 });
  B(0.9, 1.9, 0.05, K.m('#8d949b'), [-2.55, FL + 0.95, ZB - 0.02]);
  K.window(g, { x: 1.25, y0: FL + 3.7, z: ZB - 0.03, w: 1.5, h: 1.0, frame: mAluDark, glass: mGlass, panes: 2, rotY: Math.PI, behind: K.curtain('#d9e0d2') });
  S.box(X0, ZB, X1, ZI, FL - 0.1, YE);
  // roof: gable with ridge along z (hidden behind the false front)
  {
    const rg = new THREE.Group(); rg.rotation.y = Math.PI / 2; g.add(rg);
    const ov = 0.12, pitch = 0.17, yR = YE + 0.05 + pitch * (X1 - X0) / 2;
    K.gableX(rg, { x0: -(ZF - 0.1), x1: -(ZB - ov), zf: X1 + ov, zb: X0 - ov, yE: YE + 0.05 - pitch * ov, yR, zR: 0, t: 0.08, mat: mRoof, tile: 1.2, fascia: K.m('#c9c2b2') });
    K.box(rg, (ZF - 0.1) - (ZB - ov), 0.1, 0.24, K.m('#7a4f44'), [-((ZF - 0.1) + (ZB - ov)) / 2, yR + 0.06, 0]);
    // gable end (back) triangle
    K.gableEnd(rg, mCorrBack, -(ZB + WT / 2) + 0.0, X0, X1, YE - 0.01, 0, yR - 0.05, WT, 1.2);
    K.gutterX(rg, -(ZF - 0.1), -(ZB - ov), YE + 0.05 - pitch * ov - 0.08, X1 + ov + 0.05, mGutter);
    K.gutterX(rg, -(ZF - 0.1), -(ZB - ov), YE + 0.05 - pitch * ov - 0.08, -(X1 + ov + 0.05), mGutter);
  }
  K.downpipe(g, X1 + 0.17, ZB + 0.3, YE - 0.05, S.gl(X1 + 0.17, ZB + 0.3), mGutter, 0.17, [-1, 0]);
  K.downpipe(g, X0 - 0.17, ZB + 0.3, YE - 0.05, S.gl(X0 - 0.17, ZB + 0.3), mGutter, 0.17, [1, 0]);
  // side-gap utilities on the south wall
  {
    const wg = new THREE.Group(); wg.position.set(X1 + 0.005, 0, 0); wg.rotation.y = Math.PI / 2; g.add(wg);
    K.meter(wg, 9.3, FL + 1.6, 0); K.gasMeter(wg, 8.7, FL + 1.0, 0);
    // propane-free: water pipe + TV cable
    K.cyl(g, 0.02, YE - FL - 1.0, K.m('#d9d4c6'), [X1 + 0.05, (YE + FL) / 2 + 0.3, -8.3], 6);
  }
  K.acUnit(g, X1 + 0.03, S.gl(X1, -9.5) + 0.02, -9.6, Math.PI / 2);
  S.box(X1, -10, 4.25, -9.2, 0, 0.7);

  // ---------------------------------------------------------------- interior (see generalInt.js)
  buildGeneralInterior(ctx, K, S, { FL, ZF, ZI, WT, X0, X1 });
  // display window contents: retro toys + magazines + festival poster
  {
    const cx = (openL.a0 + openL.a1) / 2, z0 = ZF - WT;
    K.box(g, 1.5, 0.72, 0.6, iWoodDark, [cx, FL + 0.36, z0 - 0.3]);
    K.box(g, 1.52, 0.03, 0.62, K.im('#c9463e', 0.25), [cx, FL + 0.735, z0 - 0.3]);
    K.box(g, 1.5, 0.03, 0.3, iWood, [cx, FL + 1.25, z0 - 0.45]);
    for (const x of [openL.a0 + 0.05, openL.a1 - 0.05]) K.box(g, 0.03, 0.5, 0.3, iWoodDark, [x, FL + 1.0, z0 - 0.45]);
    retroToys(g, K, cx, FL + 0.75, z0 - 0.2, rnd);
    magazines(g, K, cx, FL + 1.265, z0 - 0.45);
    K.decal(g, festivalTex(K), 0.42, 0.6, [openL.a1 - 0.3, FL + 1.8, ZF - 0.1]);
    K.decal(g, mascotTex(K), 0.2, 0.2, [openL.a0 + 0.22, FL + 2.1, ZF - 0.066]);
    S.box(openL.a0, z0 - 0.7, openL.a1, ZF, FL, FL + 1.3);
  }
  // stickers on the door glass
  K.decal(g, K.hoursSticker(['7:00〜20:00', '年中無休'], '#3f8f5b'), 0.22, 0.165, [openM.a0 + 0.35, FL + 1.35, ZF + 0.0]);
  K.decal(g, K.cashless(), 0.36, 0.113, [openM.a1 - 0.45, FL + 1.3, ZF + 0.0]);
  K.decal(g, mascotTex(K), 0.16, 0.16, [openM.a1 - 0.7, FL + 1.62, ZF + 0.0]);

  // ---------------------------------------------------------------- apron goods
  const ag = (x, z) => S.gl(x, z) + 0.035;
  // wooden bench with backrest in front of the window
  K.bench(g, -3.1, ag(-3.1, -1.62), -1.62, 1.4, 0, { color: '#8fa9b8', leg: '#6a7f8c', back: true, d: 0.4 });
  S.box(-3.82, -1.85, -2.38, -1.4, ag(-3.1, -1.6), ag(-3.1, -1.6) + 0.46);
  // drink crates
  {
    const cols = ['#e8c547', '#d9463b', '#e8c547', '#3f7fb5'];
    let i = 0;
    for (const [x, z, n] of [[-1.95, -1.75, 3], [-1.45, -1.8, 2], [-1.75, -1.15, 1]]) {
      for (let k = 0; k < n; k++) K.crate(g, x, ag(x, z) + k * 0.3, z, cols[(i++) % cols.length], (k % 2) * 0.06 - 0.03, k === n - 1, k % 2 ? '#6f9a6a' : '#8a5a3a');
      S.box(x - 0.24, z - 0.18, x + 0.24, z + 0.18, ag(x, z), ag(x, z) + n * 0.3);
    }
  }
  // ice-cream chest freezer + nobori
  {
    const fx = 1.78, fz = -1.62, y0 = ag(fx, fz);
    freezer(g, K, fx, y0, fz);
    S.box(fx - 0.53, fz - 0.33, fx + 0.53, fz + 0.33, y0, y0 + 0.9);
    K.nobori(S, { x: 2.0, z: -0.2, rot: -0.35, tex: iceNoboriTex(K), w: 0.45, h: 1.6, poleH: 2.5, flip: true, baseColor: '#8d949b' });
  }
  // rice bags on a pallet + brooms + buckets at the right pier (behind the gashapon spot)
  {
    const px = 2.95, pz = -1.72, y0 = ag(px, pz);
    K.box(g, 0.9, 0.1, 0.5, K.mt('#b89468', T.grain), [px, y0 + 0.05, pz]);
    for (let i = 0; i < 3; i++) riceBag(g, K, px - 0.18 + (i % 2) * 0.36, y0 + 0.1 + Math.floor(i / 2) * 0.15, pz, 0.05 * (i - 1), i === 2 ? '10kg' : '5kg', false);
    riceBag(g, K, px, y0 + 0.4, pz, 0.12, '5kg', false);
    S.box(px - 0.48, pz - 0.28, px + 0.48, pz + 0.28, y0, y0 + 0.6);
    brooms(g, K, 3.72, ag(3.72, -1.85), -1.85);
    buckets(g, K, 3.95, ag(3.95, -1.2), -1.2);
    S.box(3.5, -2.0, 4.2, -0.95, y0, y0 + 1.4);
  }
  // small blackboard (本日の特売) by the entrance
  {
    const x = -0.85, z = -0.55, y0 = ag(x, z);
    const bg = new THREE.Group(); bg.position.set(x, y0, z); bg.rotation.y = 0.35; g.add(bg);
    const wood = K.m('#8a6446');
    for (const s of [1, -1]) { const leg = K.box(bg, 0.04, 0.8, 0.03, wood, [0, 0.4, s * 0.14]); leg.rotation.x = -s * 0.2; }
    const face = new THREE.Group(); face.position.set(0, 0.44, 0.16); face.rotation.x = -0.2; bg.add(face);
    K.box(face, 0.5, 0.66, 0.03, wood, [0, 0, 0]);
    K.plane(face, 0.44, 0.6, K.toonMemo('#ffffff', { map: chalkTex(K) }), [0, 0, 0.017]);
    S.box(x - 0.28, z - 0.25, x + 0.28, z + 0.25, y0, y0 + 0.9);
  }
  return { S, FL };
}

// ============================================================================ props
function riceBag(p, K, x, y, z, rot, size = '5kg', interior = true) {
  const t = riceTex(K, size);
  const m = interior ? K.im('#ffffff', 0.3, { map: t }) : K.mt('#ffffff', t);
  const w = size === '10kg' ? 0.46 : 0.38, d = size === '10kg' ? 0.3 : 0.26, h = 0.14;
  const b = K.rbox(p, w, h, d, 0.3, m, [x, y + h / 2, z]); b.rotation.y = rot;
  return b;
}
function riceTex(K, size) {
  return K.tex.draw(256, 160, (g, w, h) => {
    g.fillStyle = '#e8dcc0'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#6f9a5a'; g.fillRect(0, 0, w, 26); g.fillRect(0, h - 22, w, 22);
    g.fillStyle = '#c9463e'; g.beginPath(); g.arc(46, 88, 30, 0, 7); g.fill();
    K.text(g, '新米', 46, 88, 52, 26, K.F.brush, 400, '#f7efe0');
    K.text(g, 'お米', w * 0.62, 72, 140, 58, K.F.brush, 400, '#3a3346');
    K.text(g, '桜ヶ丘産 コシヒカリ', w * 0.62, 118, 150, 20, K.F.sans, 700, '#3a3346');
    K.text(g, size, w - 34, h - 11, 60, 18, K.F.en, 900, '#f7efe0');
    K.text(g, '精米', 40, h - 11, 60, 16, K.F.sans, 700, '#f7efe0');
  }, { key: 'sb-rice-' + size });
}
function brooms(p, K, x, y, z) {
  const handle = K.m('#c9a36a'), straw = K.m('#b59a5a'), bamboo = K.m('#9a8a52');
  // bamboo broom (竹ぼうき) + room broom (座敷ほうき) leaning on the wall, in a holder
  const b1 = new THREE.Group(); b1.position.set(x, y, z); b1.rotation.set(-0.12, 0, 0.1); p.add(b1);
  K.cyl(b1, 0.016, 1.35, handle, [0, 0.9, 0], 6);
  K.cyl(b1, 0.03, 0.5, bamboo, [0, 0.25, 0], 8, null, 0.16).scale.set(1, 0.5, 0.45);
  const b2 = new THREE.Group(); b2.position.set(x - 0.2, y, z + 0.05); b2.rotation.set(-0.14, 0, -0.08); p.add(b2);
  K.cyl(b2, 0.014, 1.0, handle, [0, 0.75, 0], 6);
  K.box(b2, 0.28, 0.3, 0.07, straw, [0, 0.16, 0]);
  K.box(b2, 0.29, 0.03, 0.08, K.m('#c9463e'), [0, 0.3, 0]);
  const b3 = new THREE.Group(); b3.position.set(x + 0.18, y, z + 0.02); b3.rotation.set(-0.1, 0, 0.16); p.add(b3);
  K.cyl(b3, 0.015, 1.1, handle, [0, 0.8, 0], 6);
  K.box(b3, 0.22, 0.24, 0.05, K.m('#d8c27a'), [0, 0.13, 0]);
  K.plane(p, 0.2, 0.08, K.mt('#ffffff', K.card(['ほうき', '980円'], { w: 160, h: 72, bg: '#f4efe2', fg: '#3a3346', fg2: '#c9463e' })), [x, y + 0.95, z + 0.12]);
}
function buckets(p, K, x, y, z) {
  const cols = ['#3f7fb5', '#d9463b', '#e8c547', '#6f9a6a'];
  for (let i = 0; i < 4; i++) {
    K.cyl(p, 0.15, 0.24, K.m(cols[i]), [x, y + 0.12 + i * 0.06, z], 14, [Math.PI, 0, 0], 0.12);
  }
  K.cyl(p, 0.16, 0.02, K.m(cols[3]), [x, y + 0.36, z], 14);
  K.plane(p, 0.16, 0.08, K.mt('#ffffff', K.card(['バケツ', '380円'], { w: 160, h: 72, bg: '#f4efe2', fg: '#3a3346', fg2: '#c9463e' })), [x, y + 0.2, z + 0.155], 0, 0.1);
}
function freezer(p, K, x, y, z) {
  const g = new THREE.Group(); g.position.set(x, y, z); p.add(g);
  const body = K.m('#eeeae2'), trim = K.m('#3f7fb5');
  K.rboxR(g, 1.02, 0.78, 0.62, 0.05, body, [0, 0.45, 0]);
  K.box(g, 1.03, 0.07, 0.63, trim, [0, 0.12, 0]);
  K.box(g, 0.94, 0.02, 0.54, K.lamp(1.05, '#dbe9f2'), [0, 0.84, 0]);                // lit interior seen through the lid
  // ice cream packs inside (under the glass)
  const cols = ['#f2b5c8', '#f7e28a', '#a9cfc0', '#e9c7a0', '#b9c7ea', '#f4efe6'];
  const rr = K.ctx.rng('freezer');
  for (let i = 0; i < 12; i++) K.box(g, 0.12, 0.03, 0.08, K.m(cols[i % 6]), [-0.38 + (i % 6) * 0.15, 0.86, -0.12 + Math.floor(i / 6) * 0.2 + rr.range(-0.02, 0.02)]).rotation.y = rr.range(-0.3, 0.3);
  for (const zz of [-0.13, 0.13]) { const lid = K.box(g, 0.98, 0.012, 0.27, K.glass({ opacity: 0.25 }), [0, 0.88, zz]); lid.castShadow = false; K.ctx.noOutline(lid); }
  K.box(g, 1.0, 0.03, 0.03, K.m('#b9bfc4'), [0, 0.885, 0.3]); K.box(g, 1.0, 0.03, 0.03, K.m('#b9bfc4'), [0, 0.885, -0.3]);
  K.plane(g, 0.8, 0.26, K.mt('#ffffff', freezerTex(K)), [0, 0.5, 0.313]);
  for (const sx of [-0.45, 0.45]) K.box(g, 0.06, 0.06, 0.5, K.m('#6d747c'), [sx, 0.03, 0]);
}
function freezerTex(K) {
  return K.tex.draw(512, 168, (g, w, h) => {
    g.fillStyle = '#f4f1ea'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#3f7fb5'; K.rr(g, 8, 8, w - 16, h - 16, 18); g.fill();
    K.text(g, 'アイスクリーム', w * 0.58, h * 0.44, w * 0.66, 64, K.F.round, 900, '#fdf8ee');
    K.text(g, 'つめたい・おいしい', w * 0.58, h * 0.78, w * 0.6, 26, K.F.round, 700, '#fbe3ea');
    // cone
    g.fillStyle = '#e0b070'; g.beginPath(); g.moveTo(60, 70); g.lineTo(100, 70); g.lineTo(80, 146); g.closePath(); g.fill();
    g.fillStyle = '#f2b5c8'; g.beginPath(); g.arc(80, 62, 26, 0, 7); g.fill();
    g.fillStyle = '#fdf8ee'; g.beginPath(); g.arc(72, 50, 12, 0, 7); g.fill();
  }, { key: 'sb-freezer' });
}
function iceNoboriTex(K) {
  return K.tex.draw(160, 570, (g, w, h) => {
    g.fillStyle = '#f3f1ea'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#f7f5ef'; g.fillRect(w - 18, 0, 18, h);
    g.fillStyle = '#2f64b5'; g.fillRect(0, 0, w - 18, 64);
    K.text(g, 'つめたい', (w - 18) / 2, 33, w - 30, 32, K.F.round, 900, '#fdf8ee');
    g.fillStyle = '#d9463b'; g.font = `900 64px ${K.F.round}`; K.vtext(g, 'アイスクリーム', (w - 18) / 2, 76, 58, 0.98);
    g.fillStyle = '#e0b070'; g.beginPath(); g.moveTo(52, h - 70); g.lineTo(90, h - 70); g.lineTo(71, h - 14); g.closePath(); g.fill();
    g.fillStyle = '#f2b5c8'; g.beginPath(); g.arc(71, h - 78, 22, 0, 7); g.fill();
    g.fillStyle = '#a9cfc0'; g.beginPath(); g.arc(71, h - 104, 18, 0, 7); g.fill();
  }, { key: 'sb-ice-nobori' });
}
function mosaicTex(K) {
  return K.tex.draw(256, 256, (g, w, h) => {
    const r = K.ctx.rng('sb-mosaic'); const n = 16, s = w / n;
    g.fillStyle = '#a9aca6'; g.fillRect(0, 0, w, h);
    const cols = ['#bcd6d2', '#a9cfc0', '#dfe8e0', '#c6d9e0', '#e9e2cf', '#9fc3b8'];
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { g.fillStyle = cols[Math.floor(r() * cols.length)]; g.fillRect(i * s + 1.5, j * s + 1.5, s - 3, s - 3); }
  }, { key: 'sb-mosaic', repeat: [1, 1] });
}
function awningTex(K) {
  return K.tex.draw(256, 64, (g, w, h) => {
    g.fillStyle = '#6f9d8f'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 4; i++) { g.fillStyle = '#e9e4d6'; g.fillRect(i * 64 + 40, 0, 20, h); }
    g.fillStyle = 'rgba(40,40,60,0.08)'; for (let i = 0; i < 40; i++) g.fillRect((i * 37) % w, (i * 17) % h, 6, 3);
  }, { key: 'sb-awning', repeat: [1, 1] });
}
function valanceTex(K) {
  return K.tex.draw(1024, 64, (g, w, h) => {
    g.fillStyle = '#6f9d8f'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#e9e4d6'; g.fillRect(0, h - 5, w, 5);
    for (let i = 0; i < 32; i++) { g.fillStyle = '#e9e4d6'; g.beginPath(); g.arc(i * 32 + 16, h, 9, Math.PI, 0); g.fill(); }
    K.text(g, 'たばこ ・ 食料品 ・ 日用雑貨 ・ お米', w / 2, h * 0.42, w * 0.8, 38, K.F.round, 900, '#f7f3ea');
  }, { key: 'sb-valance' });
}
function bigSignTex(K) {
  return K.tex.draw(1024, 100, (g, w, h) => {
    g.fillStyle = '#f0e6cf'; g.fillRect(0, 0, w, h);
    const r = K.ctx.rng('bigsign'); K.blotch(g, w, h, r, 20, 0.08);
    g.strokeStyle = '#b8423c'; g.lineWidth = 4; g.strokeRect(6, 6, w - 12, h - 12);
    g.fillStyle = '#b8423c'; g.beginPath(); g.arc(70, h / 2, 34, 0, 7); g.fill();
    K.text(g, '山', 70, h / 2 + 2, 50, 46, K.F.brush, 400, '#f7efe0');
    K.text(g, 'よろず屋', 190, h * 0.55, 150, 40, K.F.brush, 400, '#3a2a22');
    K.text(g, '山田商店', w * 0.53, h * 0.54, 380, 78, K.F.brush, 400, '#2a211d');
    K.text(g, '食料品・日用雑貨・米穀', w * 0.86, h * 0.36, 230, 22, K.F.sans, 700, '#5a4238');
    K.text(g, 'TEL 24-3156', w * 0.86, h * 0.7, 200, 24, K.F.en, 700, '#b8423c');
  }, { key: 'sb-yamada-sign' });
}
function shippoTex(K) {
  return K.tex.draw(1024, 64, (g, w, h) => {
    g.fillStyle = '#8fb7a3'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(245,240,225,0.8)'; g.lineWidth = 4;
    for (let i = 0; i < 34; i++) { g.beginPath(); g.arc(i * 31 + 15, h / 2, 21, 0, 7); g.stroke(); }
    g.fillStyle = 'rgba(40,60,55,0.35)'; g.fillRect(0, 0, w, 4); g.fillRect(0, h - 4, w, 4);
  }, { key: 'sb-shippo' });
}
function yagoTex(K) {
  return K.tex.draw(128, 128, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.strokeStyle = '#6b4a35'; g.lineWidth = 8; g.beginPath(); g.arc(w / 2, h / 2, 54, 0, 7); g.stroke();
    // ヤマ mark over the character
    g.strokeStyle = '#6b4a35'; g.lineWidth = 9; g.beginPath(); g.moveTo(28, 52); g.lineTo(64, 26); g.lineTo(100, 52); g.stroke();
    K.text(g, '田', w / 2, h * 0.64, 60, 52, K.F.serif, 700, '#6b4a35');
  }, { key: 'sb-yago' });
}
const ENAMEL = {
  soy: { bg: '#b8423c', fg: '#f6efe2', lines: ['桜川醤油'], sub: 'しょうゆ', vertical: true },
  kayari: { bg: '#2f5f9e', fg: '#f6efe2', lines: ['ヒバリ印', '蚊とり線香'] },
  soap: { bg: '#3f8f5b', fg: '#f6efe2', lines: ['コトリ石鹸'], sub: 'お肌すべすべ' },
  ramune: { bg: '#f1ece0', fg: '#2f5f9e', lines: ['春日ラムネ'], sub: 'つめた〜い', vertical: true, bottle: true },
};
function enamelTex(K, kind) {
  const e = ENAMEL[kind];
  const vertical = !!e.vertical;
  const W = vertical ? 256 : (kind === 'soap' ? 512 : 256), H = vertical ? 384 : (kind === 'soap' ? 160 : 256);
  return K.tex.draw(W, H, (g, w, h) => {
    const r = K.ctx.rng('enamel' + kind);
    g.fillStyle = e.bg; K.rr(g, 0, 0, w, h, 18); g.fill();
    g.strokeStyle = e.fg; g.lineWidth = 6; K.rr(g, 12, 12, w - 24, h - 24, 12); g.stroke();
    if (vertical) {
      g.fillStyle = e.fg; g.font = `400 ${kind === 'ramune' ? 64 : 70}px ${K.F.brush}`;
      K.vtext(g, e.lines[0], kind === 'ramune' ? w * 0.64 : w * 0.5, 34, kind === 'ramune' ? 60 : 64, 1.0);
      if (e.bottle) {
        g.fillStyle = '#8fd1c1'; K.rr(g, 44, 150, 44, 150, 16); g.fill(); g.fillRect(56, 116, 20, 40);
        g.fillStyle = 'rgba(255,255,255,0.7)'; g.beginPath(); g.arc(66, 150, 9, 0, 7); g.fill();
        K.text(g, e.sub, w / 2, h - 40, w - 40, 30, K.F.round, 900, '#d9463b');
      } else { K.text(g, e.sub, w / 2, h - 42, w - 50, 30, K.F.sans, 900, e.fg); }
    } else if (kind === 'kayari') {
      g.fillStyle = '#f2c230'; g.beginPath(); g.ellipse(w / 2, 70, 34, 22, 0, 0, 7); g.fill(); g.beginPath(); g.moveTo(w / 2 + 26, 64); g.lineTo(w / 2 + 62, 50); g.lineTo(w / 2 + 34, 78); g.fill();
      g.fillStyle = '#3a3346'; g.beginPath(); g.arc(w / 2 - 16, 64, 4, 0, 7); g.fill();
      K.text(g, e.lines[0], w / 2, 136, w - 40, 40, K.F.sans, 900, e.fg);
      K.text(g, e.lines[1], w / 2, 190, w - 40, 44, K.F.brush, 400, e.fg);
    } else {
      K.text(g, e.lines[0], w * 0.45, h * 0.48, w * 0.6, 70, K.F.brush, 400, e.fg);
      K.text(g, e.sub, w * 0.82, h * 0.5, w * 0.26, 30, K.F.round, 900, '#f7e28a');
    }
    // mounting holes, chips, rust
    g.fillStyle = 'rgba(40,35,45,0.8)'; for (const [x, y] of [[20, 20], [w - 20, 20], [20, h - 20], [w - 20, h - 20]]) { g.beginPath(); g.arc(x, y, 5, 0, 7); g.fill(); }
    for (let i = 0; i < 9; i++) { const edge = r() < 0.5; const x = edge ? (r() < 0.5 ? 6 : w - 6) : r() * w, y = edge ? r() * h : (r() < 0.5 ? 6 : h - 6); g.fillStyle = 'rgba(70,50,55,0.75)'; g.beginPath(); g.arc(x, y, 3 + r() * 5, 0, 7); g.fill(); g.fillStyle = 'rgba(150,90,60,0.35)'; g.beginPath(); g.arc(x, y + 8, 3 + r() * 4, 0, 7); g.fill(); }
    K.blotch(g, w, h, r, 8, 0.1, true);
  }, { key: 'sb-enamel-' + kind });
}
function enamel(p, K, kind, x, y, z, w, h) {
  const m = K.plane(p, w, h, K.mt('#ffffff', enamelTex(K, kind), { paint: 0.03 }), [x, y, z]);
  K.box(p, w + 0.01, h + 0.01, 0.008, K.m('#6d747c'), [x, y, z - 0.006]);
  return m;
}
function retroToys(p, K, x, y, z, rnd) {
  const m = (c) => K.im(c, 0.32);
  // daruma
  K.sph(p, 0.09, m('#c9463e'), [x - 0.5, y + 0.09, z], 12, [1, 1.05, 0.95]);
  K.sph(p, 0.05, m('#f3ead8'), [x - 0.5, y + 0.11, z + 0.055], 10, [1, 1, 0.5]);
  K.sph(p, 0.012, m('#3a3346'), [x - 0.47, y + 0.12, z + 0.075], 6);
  // kendama
  K.cyl(p, 0.012, 0.18, m('#c9a36a'), [x - 0.27, y + 0.09, z + 0.05], 6);
  K.box(p, 0.1, 0.035, 0.035, m('#c9a36a'), [x - 0.27, y + 0.15, z + 0.05]);
  K.sph(p, 0.035, m('#d9463b'), [x - 0.27, y + 0.215, z + 0.05], 10);
  // tin robot
  const rx = x - 0.05;
  K.box(p, 0.09, 0.12, 0.06, m('#9aa6b3'), [rx, y + 0.1, z]); K.box(p, 0.07, 0.06, 0.06, m('#b9c3cc'), [rx, y + 0.19, z]);
  K.box(p, 0.03, 0.05, 0.03, m('#9aa6b3'), [rx - 0.025, y + 0.025, z]); K.box(p, 0.03, 0.05, 0.03, m('#9aa6b3'), [rx + 0.025, y + 0.025, z]);
  K.box(p, 0.05, 0.012, 0.01, m('#e8c547'), [rx, y + 0.195, z + 0.032]); K.cyl(p, 0.004, 0.04, m('#6d747c'), [rx, y + 0.24, z], 4); K.sph(p, 0.01, m('#d9463b'), [rx, y + 0.265, z], 6);
  // spinning tops (独楽)
  for (let i = 0; i < 3; i++) { K.cyl(p, 0.0, 0.05, m(['#d9463b', '#3f7fb5', '#e8c547'][i]), [x + 0.14 + i * 0.09, y + 0.035, z + 0.09], 10, [Math.PI, 0, 0], 0.045); K.cyl(p, 0.006, 0.03, m('#6e5040'), [x + 0.14 + i * 0.09, y + 0.075, z + 0.09], 5); }
  // toy train (local line colours)
  K.rbox(p, 0.26, 0.08, 0.07, 0.25, m('#f5f0e6'), [x + 0.35, y + 0.05, z - 0.08]);
  K.box(p, 0.262, 0.018, 0.072, m('#ef9fbe'), [x + 0.35, y + 0.045, z - 0.08]);
  for (const dx of [-0.08, 0.08]) K.cyl(p, 0.018, 0.075, m('#3a3346'), [x + 0.35 + dx, y + 0.015, z - 0.08], 8, [Math.PI / 2, 0, 0]);
  // pinwheel (風車)
  K.cyl(p, 0.004, 0.3, m('#6f9a6a'), [x + 0.6, y + 0.15, z - 0.05], 4);
  for (let i = 0; i < 4; i++) { const b = K.box(p, 0.06, 0.012, 0.004, m(['#f2b5c8', '#f7e28a', '#a9cfc0', '#b9c7ea'][i]), [x + 0.6, y + 0.3, z - 0.05 + 0.004]); b.rotation.z = i * Math.PI / 2 + 0.4; b.position.x += Math.cos(i * Math.PI / 2 + 0.4) * 0.03; b.position.y += Math.sin(i * Math.PI / 2 + 0.4) * 0.03; }
  // menko cards / marbles jar
  for (let i = 0; i < 4; i++) K.box(p, 0.06, 0.004, 0.06, m(['#e9a23b', '#5f8fcf', '#d9463b', '#8fb86f'][i]), [x + 0.1 + i * 0.07, y + 0.004, z - 0.12]).rotation.y = rnd.range(-0.5, 0.5);
}
const MAGS = [['月刊', 'はるかぜ', '#f2b5c8', '#8e3b36'], ['週刊', 'ハナビ', '#5f8fcf', '#fdf8ee'], ['少年', 'ソラマメ', '#e8c547', '#2f3f6e'], ['まんが', 'ひだまり', '#a9cfc0', '#3a3346']];
function magTex(K, i) {
  const [a, b, bg, fg] = MAGS[i % MAGS.length];
  return K.tex.draw(128, 176, (g, w, h) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    K.text(g, a, w * 0.25, 18, 50, 18, K.F.sans, 900, fg);
    K.text(g, b, w / 2, 44, w - 12, 34, K.F.round, 900, fg);
    g.fillStyle = 'rgba(255,255,255,0.6)'; g.beginPath(); g.arc(w * 0.55, h * 0.64, 34, 0, 7); g.fill();
    g.fillStyle = fg; g.beginPath(); g.arc(w * 0.55, h * 0.6, 14, 0, 7); g.fill(); g.fillRect(w * 0.55 - 20, h * 0.68, 40, 30);
    g.fillStyle = 'rgba(40,30,50,0.25)'; g.fillRect(6, h - 22, w - 12, 12);
  }, { key: 'sb-mag' + (i % MAGS.length) });
}
function magazines(p, K, x, y, z) {
  for (let i = 0; i < 5; i++) {
    const mg = K.plane(p, 0.2, 0.275, K.im('#ffffff', 0.3, { map: magTex(K, i) }), [x - 0.52 + i * 0.26, y + 0.14, z + 0.02]);
    mg.rotation.x = -0.22; mg.rotation.y = (i - 2) * 0.05;
    K.box(p, 0.2, 0.275, 0.008, K.im('#e9e4d8', 0.3), [x - 0.52 + i * 0.26, y + 0.14, z + 0.015], [-0.22, (i - 2) * 0.05, 0]);
  }
}
function festivalTex(K) {
  return K.tex.draw(256, 368, (g, w, h) => {
    g.fillStyle = '#e9dfcf'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#40507a'; g.fillRect(0, 0, w, h * 0.62);
    g.fillStyle = 'rgba(245,200,120,0.55)';
    for (let i = 0; i < 3; i++) { const cx = 70 + i * 60, cy = 90 + (i % 2) * 40; for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2; g.fillRect(cx + Math.cos(a) * 30, cy + Math.sin(a) * 30, 5, 5); } }
    K.text(g, '桜ヶ丘', w / 2, 36, w - 40, 26, K.F.sans, 900, '#f1e8d2');
    g.fillStyle = '#f1d9a0'; g.font = `400 72px ${K.F.brush}`; K.vtext(g, '夏まつり', w * 0.8, 50, 44, 1.0);
    K.text(g, '8月15日・16日', w / 2, h * 0.7, w - 30, 30, K.F.sans, 900, '#8e3b36');
    K.text(g, '盆踊り ・ 花火大会', w / 2, h * 0.8, w - 30, 26, K.F.sans, 700, '#3a3346');
    K.text(g, '桜ヶ丘町 町内会', w / 2, h * 0.92, w - 60, 18, K.F.sans, 700, '#5a5260');
    // faded / sun-bleached
    g.fillStyle = 'rgba(240,232,215,0.4)'; g.fillRect(0, 0, w, h);
  }, { key: 'sb-festival' });
}
function mascotTex(K) {
  return K.tex.draw(128, 128, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = '#fbf6ee'; g.beginPath(); g.arc(w / 2, h / 2, 60, 0, 7); g.fill();
    for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2 - Math.PI / 2; g.fillStyle = '#f2b5c8'; g.beginPath(); g.ellipse(w / 2 + Math.cos(a) * 24, h / 2 - 6 + Math.sin(a) * 24, 20, 15, a, 0, 7); g.fill(); }
    g.fillStyle = '#f7d3de'; g.beginPath(); g.arc(w / 2, h / 2 - 6, 22, 0, 7); g.fill();
    g.fillStyle = '#3a3346'; g.beginPath(); g.arc(w / 2 - 8, h / 2 - 8, 3.5, 0, 7); g.arc(w / 2 + 8, h / 2 - 8, 3.5, 0, 7); g.fill();
    g.strokeStyle = '#3a3346'; g.lineWidth = 2; g.beginPath(); g.arc(w / 2, h / 2 - 3, 6, 0.2, Math.PI - 0.2); g.stroke();
    K.text(g, 'さくまる', w / 2, h - 18, 90, 18, K.F.round, 900, '#d9718f');
  }, { key: 'sb-mascot' });
}
function chalkTex(K) {
  return K.tex.draw(256, 352, (g, w, h) => {
    g.fillStyle = '#3f5a4e'; g.fillRect(0, 0, w, h);
    const r = K.ctx.rng('chalk'); K.blotch(g, w, h, r, 16, 0.12, true);
    K.text(g, '本日の特売', w / 2, 40, w - 30, 36, K.F.hand, 400, '#f4efe2');
    g.strokeStyle = 'rgba(244,239,226,0.7)'; g.lineWidth = 2; g.beginPath(); g.moveTo(30, 66); g.lineTo(w - 30, 66); g.stroke();
    K.text(g, 'たまご 1パック', w / 2, 108, w - 30, 30, K.F.hand, 400, '#f7e28a');
    K.text(g, '198円', w / 2, 148, w - 30, 40, K.F.hand, 400, '#f4b6c8');
    K.text(g, 'キャベツ 1玉', w / 2, 212, w - 30, 30, K.F.hand, 400, '#bfe0b0');
    K.text(g, '128円', w / 2, 252, w - 30, 40, K.F.hand, 400, '#f4b6c8');
    sakura(g, 40, 310); sakura(g, 200, 318);
    function sakura(gg, x, y) { for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2; gg.fillStyle = '#f2b5c8'; gg.beginPath(); gg.ellipse(x + Math.cos(a) * 9, y + Math.sin(a) * 9, 7, 5, a, 0, 7); gg.fill(); } }
  }, { key: 'sb-chalk' });
}
