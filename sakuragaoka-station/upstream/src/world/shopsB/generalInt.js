// E3 よろず屋 山田商店 — interior: wooden wall shelf and double-sided island packed with individually
// modelled goods (instanced cup noodles, cans, PET & glass bottles, snack bags, jars, detergent,
// toilet paper), a tiered dagashi stand with candy jars and hanging strips, household-goods shelf,
// glass-door drinks cooler, old counter with register / scale / candy jars, raised tatami chōba
// (desk, abacus, radio, zabuton) with noren to the house, chest freezer, rice sacks on a pallet,
// broom rack, buckets, basket stack, stool, sundries hanging from a bamboo pole, calendar, clock.
import * as THREE from 'three';
import * as PR from './props.js';

export const TEXTS = ['カレー', 'せんべい', '洗剤', 'のり', 'ティッシュ', 'うどん', 'マッチ', 'キャラメル', 'サイダー', 'しょうゆ', 'みそ', 'お茶', 'ラーメン', 'クッキー', 'ビスケット', 'だがし',
  'お米', '新米', '精米', '桜ヶ丘産 コシヒカリ', '5kg', '10kg', '冷凍食品', 'アイス', '冷たいお飲み物', '駄菓子', '10円', '20円', '30円', '50円', 'おやつ', '特売中', 'どれでも', '日用品', '調味料', '缶詰', 'インスタント',
  'ほうき', 'はたき', 'ちりとり', 'やまだ', '4月', '山田商店', '町内会', 'お知らせ', '春の交通安全運動', '桜ヶ丘町', 'きなこ棒', 'ラムネ', 'ガム', 'あめ', 'くじ', 'ご自由にお使いください', 'かご'];

const GOODS = ['カレー', 'せんべい', '洗剤', 'のり', 'ティッシュ', 'うどん', 'マッチ', 'キャラメル', 'サイダー', 'しょうゆ', 'みそ', 'お茶', 'ラーメン', 'クッキー', 'ビスケット', 'だがし'];
const GOODS_COL = ['#e9a23b', '#c98a4e', '#5f8fcf', '#3f5f4e', '#f1c9d4', '#e9e2cf', '#d9463b', '#e8c547', '#8fd1c1', '#8e3b36', '#c9a57a', '#6f9a6a', '#d9463b', '#b98a6a', '#f2c230', '#ef9fbe'];
const PACK = ['#d9463b', '#e8c547', '#3f7fb5', '#6f9a6a', '#e9a23b', '#ef9fbe', '#8fd1c1', '#f4efe6', '#b98a6a', '#5f8fcf'];

export function buildGeneralInterior(ctx, K, S, P) {
  const { FL, ZF, ZI, WT, X0, X1 } = P;
  const g = S.g, I = K.I, { T, F } = K;
  const B = (w, h, d, m, p, r) => K.box(g, w, h, d, m, p, r);
  const xi0 = X0 + WT, xi1 = X1 - WT, zi0 = ZF - WT, CH = FL + 2.75;
  const rnd = ctx.rng('sb-general-int');
  const iWall = K.im('#ece3cf', 0.3, { map: T.plaster });
  const iCeil = K.im('#e6e1d6', 0.3);
  const iWood = K.im('#a57c58', 0.3, { map: T.grain });
  const iWoodL = K.im('#c29a70', 0.3, { map: T.grain });
  const iWoodDark = K.im('#6e5040', 0.26, { map: T.grain });
  const iBeam = K.im('#5a4032', 0.26, { map: T.grain });
  const atlas = K.im('#ffffff', 0.32, { map: goodsAtlas(K) });
  const ctxG = { K, I, rnd, atlas };

  // ------------------------------------------------------------------ shell
  K.box(g, xi1 - xi0, 0.04, zi0 - ZI, iCeil, [0, CH + 0.02, (zi0 + ZI) / 2]);
  const dw = { a0: -0.25, a1: 0.85, y0: FL + 0.38, y1: FL + 2.15 };                   // doorway to the house (from the chōba)
  K.wall(g, iWall, { axis: 'x', a0: xi0, a1: xi1, y0: FL, y1: CH, c: ZI + 0.01, t: 0.02, holes: [dw], tile: 2.5 });
  for (const x of [xi0 + 0.01, xi1 - 0.01]) K.tbox(g, 0.02, CH - FL, zi0 - ZI, iWall, [x, (CH + FL) / 2, (zi0 + ZI) / 2], 2.5);
  for (const x of [xi0 + 0.025, xi1 - 0.025]) K.tbox(g, 0.03, 0.1, zi0 - ZI, iWoodDark, [x, FL + 0.05, (zi0 + ZI) / 2], 1);
  for (const z of [-3.3, -5.5]) B(xi1 - xi0, 0.1, 0.12, iBeam, [0, CH - 0.05, z]);
  // fluorescent fixtures
  for (const z of [-2.75, -4.4, -6.0]) for (const x of [-2.1, 1.9]) { B(1.25, 0.05, 0.12, K.im('#dcd9d2', 0.3), [x, CH - 0.03, z]); K.cylX(g, 0.018, 1.18, K.lamp(1.4, '#f4f7ff'), [x, CH - 0.07, z], 8); }
  for (const [x, z] of [[-2.1, -2.9], [1.9, -2.9], [-2.1, -4.5], [1.9, -4.5], [-0.4, -5.9]]) K.lightPool(g, x, FL + 0.012, z, 2.4, 1.8, { opacity: 0.12, color: '#fff4e0' });

  // ------------------------------------------------------------------ left wall shelf (x -3.85..-3.4, z -3.0..-6.4)
  {
    const lv = [0.42, 0.8, 1.18, 1.56];
    const sg = PR.shelfUnit(g, K, xi0 + 0.025, FL, -4.7, Math.PI / 2, 3.4, 0.45, 2.0, lv, { mat: iWood, dark: iWoodDark, lip: K.im('#d9463b', 0.3) });
    const w = 3.4 - 0.08;
    fillRow(ctxG, sg, -w / 2, w / 2, 0.08, 0.43, 0.33, ['bag', 'box']);
    fillRow(ctxG, sg, -w / 2, w / 2, lv[0], 0.43, 0.35, ['gbottle', 'gbottle', 'jar', 'box']);
    fillRow(ctxG, sg, -w / 2, w / 2, lv[1], 0.43, 0.35, ['can', 'can', 'jar']);
    fillRow(ctxG, sg, -w / 2, w / 2, lv[2], 0.43, 0.35, ['cup', 'cup', 'box']);
    fillRow(ctxG, sg, -w / 2, w / 2, lv[3], 0.43, 0.4, ['box', 'bag', 'box']);
    fillRow(ctxG, sg, -w / 2, w / 2, 2.0, 0.4, 0.3, ['tp', 'box']);
    for (const [lx, t] of [[-1.2, '調味料'], [0.0, '缶詰'], [1.2, 'インスタント']]) K.plane(sg, 0.2, 0.06, K.im('#ffffff', 0.36, { map: K.card([t], { w: 160, h: 48, bg: '#fbf4e4', fg: '#3a3346', font: F.round, size0: 30 }) }), [lx, lv[1] + 0.004, 0.447]);
    S.box(xi0, -6.4, xi0 + 0.5, -3.0, FL, FL + 2.0);
  }
  // ------------------------------------------------------------------ island A: double-sided wooden shelf + end cap
  {
    const lv = [0.4, 0.75, 1.1];
    for (const s of [-1, 1]) {
      const sg = PR.shelfUnit(g, K, -2.05 + s * 0.005, FL, -4.3, s * Math.PI / 2, 1.9, 0.4, 1.45, lv, { mat: iWood, dark: iWoodDark, lip: K.im('#d9463b', 0.3), back: s > 0 });
      const w = 1.9 - 0.08;
      if (s < 0) {   // west face (aisle L): cans, bottles, jars
        fillRow(ctxG, sg, -w / 2, w / 2, 0.08, 0.38, 0.3, ['box', 'bag']);
        fillRow(ctxG, sg, -w / 2, w / 2, lv[0], 0.38, 0.33, ['can', 'can', 'jar']);
        fillRow(ctxG, sg, -w / 2, w / 2, lv[1], 0.38, 0.33, ['gbottle', 'bottle']);
        fillRow(ctxG, sg, -w / 2, w / 2, lv[2], 0.38, 0.33, ['box', 'cup']);
      } else {       // east face (aisle M): snacks, cup noodles, boxes
        fillRow(ctxG, sg, -w / 2, w / 2, 0.08, 0.38, 0.3, ['box', 'box']);
        fillRow(ctxG, sg, -w / 2, w / 2, lv[0], 0.38, 0.33, ['cup']);
        fillRow(ctxG, sg, -w / 2, w / 2, lv[1], 0.38, 0.33, ['bag']);
        fillRow(ctxG, sg, -w / 2, w / 2, lv[2], 0.38, 0.33, ['box', 'bag']);
      }
    }
    // end cap facing the entrance
    const ec = PR.shelfUnit(g, K, -2.05, FL, -3.36, 0, 0.8, 0.3, 1.2, [0.42, 0.8], { mat: iWood, dark: iWoodDark, lip: K.im('#d9463b', 0.3) });
    fillRow(ctxG, ec, -0.36, 0.36, 0.08, 0.28, 0.3, ['bag']);
    fillRow(ctxG, ec, -0.36, 0.36, 0.42, 0.28, 0.34, ['cup']);
    fillRow(ctxG, ec, -0.36, 0.36, 0.8, 0.28, 0.36, ['box']);
    const pop = K.tex.draw(256, 96, (c, W, H) => {
      c.fillStyle = '#f7e36a'; K.rr(c, 0, 0, W, H, 14); c.fill();
      c.strokeStyle = '#d9463b'; c.lineWidth = 6; K.rr(c, 6, 6, W - 12, H - 12, 10); c.stroke();
      K.text(c, 'おやつ 特売中!', W / 2, H * 0.43, W - 30, 40, F.round, 900, '#d9463b');
      K.text(c, 'どれでも 3コ 200円', W / 2, H * 0.78, W - 40, 20, F.round, 700, '#3a3346');
    }, { key: 'sb-gen-pop' });
    B(0.02, 0.57, 0.02, K.im('#8d949b', 0.2), [-2.05, FL + 1.485, -3.2]);
    for (const s of [1, -1]) K.plane(g, 0.62, 0.23, K.im('#ffffff', 0.35, { map: pop }), [-2.05, FL + 1.88, -3.2 + s * 0.003], s > 0 ? 0 : Math.PI);
    S.box(-2.47, -5.27, -1.63, -3.05, FL, FL + 1.5);
  }
  // ------------------------------------------------------------------ island B: tiered dagashi stand
  dagashiStand(ctx, K, g, -0.2, FL, -4.35, rnd);
  S.box(-0.77, -4.87, 0.37, -3.33, FL, FL + 1.3);
  // ------------------------------------------------------------------ household-goods shelf (double sided)
  {
    const lv = [0.36, 0.72, 1.0];
    for (const s of [-1, 1]) {
      const sg = PR.shelfUnit(g, K, 1.7 + s * 0.005, FL, -4.35, s * Math.PI / 2, 1.8, 0.38, 1.3, lv, { mat: iWood, dark: iWoodDark, back: s > 0 });
      const w = 1.8 - 0.08;
      fillRow(ctxG, sg, -w / 2, w / 2, 0.08, 0.36, 0.28, ['tp', 'deter']);
      fillRow(ctxG, sg, -w / 2, w / 2, lv[0], 0.36, 0.34, ['deter', 'soap', 'soap']);
      fillRow(ctxG, sg, -w / 2, w / 2, lv[1], 0.36, 0.28, s > 0 ? ['sponge', 'box'] : ['soap', 'box']);
      fillRow(ctxG, sg, -w / 2, w / 2, lv[2], 0.36, 0.3, ['box', 'tp']);
    }
    K.plane(g, 0.3, 0.09, K.im('#ffffff', 0.36, { map: K.card(['日用品'], { w: 160, h: 48, bg: '#e8f2ee', fg: '#2f5f4e', font: F.round, size0: 32 }) }), [1.7, FL + 1.42, -3.44]);
    B(0.02, 0.14, 0.02, K.im('#8d949b', 0.2), [1.7, FL + 1.34, -3.45]);
    S.box(1.3, -5.27, 2.1, -3.43, FL, FL + 1.3);
  }
  // ------------------------------------------------------------------ drinks cooler on the right wall
  cooler(ctx, K, g, xi1 - 0.36, FL, -4.6, rnd);
  S.box(xi1 - 0.74, -5.9, xi1, -3.3, FL, FL + 2.1);

  // ------------------------------------------------------------------ back: chōba (raised tatami platform), counter, doorway
  {
    const px0 = xi0, px1 = 0.95, pz0 = -6.55, pz1 = ZI, ph = FL + 0.38;
    K.tbox(g, px1 - px0, 0.35, pz0 - pz1, iWoodDark, [(px0 + px1) / 2, FL + 0.175, (pz0 + pz1) / 2], 1);
    B(px1 - px0, 0.1, 0.1, iBeam, [(px0 + px1) / 2, ph - 0.05, pz0 - 0.04]);                         // 上がり框
    K.tbox(g, px1 - px0 - 0.02, 0.03, pz0 - pz1 - 0.12, K.im('#cdc38c', 0.3, { map: tatamiTex(K) }), [(px0 + px1) / 2, ph - 0.015, (pz0 + pz1) / 2 - 0.05], 0.9);
    for (const x of [px0 + 0.02, -1.4, px1 - 0.02]) B(0.03, 0.006, pz0 - pz1 - 0.12, K.im('#3f4a3a', 0.2), [x, ph + 0.001, (pz0 + pz1) / 2 - 0.05]);
    // doorway frame + noren to the house
    for (const x of [dw.a0 - 0.04, dw.a1 + 0.04]) B(0.08, dw.y1 - dw.y0 + 0.04, 0.16, iBeam, [x, (dw.y0 + dw.y1) / 2 + 0.02, ZI - 0.05]);
    B(dw.a1 - dw.a0 + 0.16, 0.08, 0.16, iBeam, [(dw.a0 + dw.a1) / 2, dw.y1 + 0.04, ZI - 0.05]);
    { const cw = K.im('#6a5a4a', 0.14, { map: T.plaster });                                               // dim corridor beyond
      K.box(g, dw.a1 - dw.a0 + 0.1, dw.y1 - dw.y0, 0.02, cw, [(dw.a0 + dw.a1) / 2, (dw.y0 + dw.y1) / 2, ZI - 0.9]);
      for (const x of [dw.a0 - 0.05, dw.a1 + 0.05]) K.box(g, 0.02, dw.y1 - dw.y0, 0.9, cw, [x, (dw.y0 + dw.y1) / 2, ZI - 0.45]);
      K.box(g, dw.a1 - dw.a0 + 0.1, 0.02, 0.9, K.im('#5a4636', 0.14, { map: T.grain }), [(dw.a0 + dw.a1) / 2, dw.y0 - 0.01, ZI - 0.45]);
      K.box(g, dw.a1 - dw.a0 + 0.1, 0.02, 0.9, cw, [(dw.a0 + dw.a1) / 2, dw.y1 + 0.01, ZI - 0.45]); }
    K.noren(S, { x: (dw.a0 + dw.a1) / 2, y: dw.y1 - 0.04, z: ZI + 0.07, w: 1.04, h: 0.9, n: 2, tex: houseNorenTex(K), rodColor: '#5a4032' });
    // desk (帳場机) with ledger, abacus, radio, tea
    const dg = PR.grp(g, -2.15, ph, -6.73, 0);
    const dk = K.im('#7a4a34', 0.3, { map: T.grain });
    K.box(dg, 0.9, 0.03, 0.34, dk, [0, 0.285, 0]);
    for (const sx of [-0.42, 0.42]) K.box(dg, 0.04, 0.27, 0.3, dk, [sx, 0.135, 0]);
    K.box(dg, 0.86, 0.12, 0.02, dk, [0, 0.21, -0.15]);
    PR.abacus(dg, K, -0.18, 0.3, 0.05, 0.1);
    I.add('box', dg, [0.12, 0.3, 0.02], [0.26, 0.02, 0.18], '#e9e0cc', [0, -0.2, 0]);                    // ledger (大福帳)
    I.add('box', dg, [0.12, 0.32, 0.02], [0.012, 0.003, 0.17], '#8a6446', [0, -0.2, 0]);
    PR.radio(dg, K, 0.3, 0.3, -0.08, -0.3, '#b8423c');
    PR.yunomi(dg, K, -0.36, 0.3, 0.06, '#8aa39a', 0.075, 0.03);
    PR.zabuton(g, K, -2.15, ph, -7.12, 0.05, '#6a5a8a');
    PR.zabuton(g, K, -3.35, ph, -6.95, 0.4, '#8e3b56');
    I.add('rbox', g, [-3.35, ph + 0.07, -6.95], [0.34, 0.06, 0.24], '#d8c9a8', [0, 0.4, 0]);        // folded newspaper
    // old wooden counter in front of the platform
    const cx0 = -2.85, cx1 = -0.75, cz0 = -6.52, cz1 = -6.1, cH = 0.9;
    K.tbox(g, cx1 - cx0, cH - 0.04, cz0 - cz1, iWoodDark, [(cx0 + cx1) / 2, FL + (cH - 0.04) / 2, (cz0 + cz1) / 2], 1);
    B(cx1 - cx0 + 0.06, 0.04, cz1 - cz0 + 0.06, iWoodL, [(cx0 + cx1) / 2, FL + cH - 0.02, (cz0 + cz1) / 2 + 0.01]);
    for (let i = 0; i < 3; i++) { const x = cx0 + 0.35 + i * 0.7; B(0.58, 0.62, 0.015, iWood, [x, FL + 0.46, cz1 + 0.008]); B(0.5, 0.54, 0.012, iWoodL, [x, FL + 0.46, cz1 + 0.018]); }
    B(cx1 - cx0, 0.08, 0.02, iBeam, [(cx0 + cx1) / 2, FL + 0.04, cz1 + 0.01]);
    const ct = FL + cH;
    PR.register(g, K, -1.25, ct, -6.31, Math.PI, { color: '#8f9a8c' });
    PR.scale(g, K, -2.45, ct, -6.28, 0.25);
    for (let i = 0; i < 3; i++) candyJar(K, g, -2.05 + i * 0.2, ct, -6.22, i, rnd);
    I.add('box', g, [-0.92, ct, -6.2], [0.14, 0.012, 0.1], '#3f5f8e');
    for (let i = 0; i < 3; i++) I.add('disc', g, [-0.95 + i * 0.03, ct + 0.012, -6.2], [0.022, 0.003, 0.022], i ? '#c9ccd0' : '#d1ad5c');
    PR.calculator(g, K, -0.9, ct, -6.38, 0.2);
    S.box(cx0, cz0, cx1, cz1, FL, FL + 1.1);
    S.box(px0, pz1, px1, pz0, FL, FL + 2.2);                          // platform: not walkable (keeper's seat)
    PR.calendar(g, K, -2.8, FL + 1.75, ZI + 0.02, 0, calendarTex(K), 0.4, 0.58);
    K.plane(g, 0.62, 0.44, K.im('#ffffff', 0.3, { map: noticeTex(K) }), [-1.2, FL + 1.8, ZI + 0.025]);
    PR.pendulumClock(g, K, 1.6, FL + 1.95, ZI + 0.02, 0);
    PR.manekiNeko(g, K, -3.6, ph + 0.0, -7.2, 0.26, 0.4, true);
  }
  // ------------------------------------------------------------------ back right: chest freezer + rice sacks
  chestFreezer(ctx, K, g, 1.72, FL, -7.02, rnd);
  S.box(1.1, -7.36, 2.34, -6.68, FL, FL + 0.9);
  {
    const px = 3.1, pz = -6.95;
    I.add('box', g, [px, FL, pz], [1.2, 0.1, 0.72], '#b89468');
    for (let i = 0; i < 3; i++) I.add('box', g, [px - 0.5 + i * 0.5, FL + 0.02, pz], [0.1, 0.08, 0.72], '#8a6a4a');
    let k = 0;
    for (let row = 0; row < 3; row++) for (let i = 0; i < 3 - row; i++) {
      const big = (i + row) % 2 === 0;
      riceSack(K, g, px - 0.36 + i * 0.4 + row * 0.2 + rnd.range(-0.02, 0.02), FL + 0.1 + row * 0.15, pz + (row % 2 ? 0.05 : -0.05), rnd.range(-0.1, 0.1), big ? '10kg' : '5kg');
      k++;
    }
    riceSack(K, g, px - 0.25, FL + 0.1, pz + 0.3, 0.4, '5kg');
    K.plane(g, 0.3, 0.14, K.im('#ffffff', 0.36, { map: K.card(['お米', '新米入荷'], { w: 192, h: 96, bg: '#fbf4e4', fg: '#3a3346', fg2: '#c9463e', font: F.brush }) }), [px, FL + 1.3, ZI + 0.03]);
    S.box(px - 0.62, -7.36, px + 0.62, -6.55, FL, FL + 0.7);
  }

  // ------------------------------------------------------------------ entry zone: broom rack, buckets, basket stack, stool, rice
  broomRack(K, g, 3.12, FL, zi0 - 0.02);
  S.box(2.45, zi0 - 0.3, 3.8, zi0, FL, FL + 2.0);
  bucketStack(K, g, 3.45, FL, -2.78);
  S.cyl(3.45, -2.78, 0.17, FL, FL + 0.5);
  basketStack(K, g, -1.9, FL, -2.6, 6, '#d9463b');
  basketStack(K, g, -1.35, FL, -2.55, 4, '#2f64b5');
  S.box(-2.15, -2.8, -1.1, -2.35, FL, FL + 0.6);
  K.plane(g, 0.24, 0.08, K.im('#ffffff', 0.36, { map: K.card(['かご', 'ご自由にお使いください'], { w: 256, h: 84, bg: '#fbf4e4', fg: '#2f64b5', fg2: '#3a3346', font: F.round }) }), [-1.9, FL + 0.62, -2.43], 0, -0.25);
  PR.stool(g, K, -0.45, FL, -6.32, { h: 0.45 });
  S.cyl(-0.45, -6.32, 0.2, FL, FL + 0.5);
  // sundries hanging from a bamboo pole under the ceiling (clear of heads: ≥ FL + 2.0)
  hangingPole(ctx, K, S, -1.25, 1.05, -2.75, CH, FL, rnd);
}

// ============================================================================ goods
/** Fill a shelf row (shelf-local: x along the shelf, front at +z = zFront) with random goods. */
function fillRow(C, sg, x0, x1, y, zFront, maxH, kinds) {
  const { rnd } = C;
  let x = x0 + 0.02;
  while (x < x1 - 0.06) {
    const kind = rnd.pick(kinds);
    const w = placeGood(C, sg, kind, x, y, zFront, maxH);
    if (x + w > x1) break;
    x += w + 0.012;
  }
}
function placeGood(C, p, kind, x, y, zf, maxH) {
  const { K, I, rnd, atlas } = C;
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  if (kind === 'cup') {
    const c = pick(['#d9463b', '#e8c547', '#3f7fb5', '#e9a23b', '#6f9a6a']), n = maxH > 0.24 ? 2 : 1, cx = x + 0.052;
    for (const dz of [-0.055, -0.17]) for (let k = 0; k < n; k++) { I.add('cup', p, [cx, y + k * 0.104, zf + dz], [0.1, 0.1, 0.1], c); I.add('disc', p, [cx, y + k * 0.104 + 0.1, zf + dz], [0.1, 0.004, 0.1], '#efe9dc'); }
    return 0.105;
  }
  if (kind === 'can') {
    const c = pick(['#d9463b', '#e8c547', '#6f9a6a', '#e9a23b', '#8e3b36', '#5f8fcf', '#f4efe6']), cx = x + 0.035;
    for (const dz of [-0.04, -0.115]) {
      if (maxH > 0.25 && dz > -0.05) { I.add('cyl', p, [cx, y, zf + dz], [0.066, 0.1, 0.066], c); I.add('cyl', p, [cx, y + 0.1, zf + dz], [0.066, 0.1, 0.066], c); I.add('cyl', p, [cx, y + 0.028, zf + dz], [0.0675, 0.045, 0.0675], '#f4efe6'); I.add('cyl', p, [cx, y + 0.128, zf + dz], [0.0675, 0.045, 0.0675], '#f4efe6'); }
      else { I.add('cyl', p, [cx, y, zf + dz], [0.066, 0.1, 0.066], c); if (dz > -0.05) I.add('cyl', p, [cx, y + 0.028, zf + dz], [0.0675, 0.045, 0.0675], '#f4efe6'); }
    }
    return 0.07;
  }
  if (kind === 'bottle') {
    const c = pick(['#e8a23b', '#9fc6a0', '#c9dce6', '#8e5a3a']), cx = x + 0.037, h = Math.min(0.26, maxH - 0.02);
    for (const dz of [-0.045, -0.13]) { I.add('bottle', p, [cx, y, zf + dz], [0.072, h, 0.072], c); I.add('cyl', p, [cx, y + h * 0.3, zf + dz], [0.074, h * 0.2, 0.074], pick(['#f4efe6', '#d9463b', '#3f7fb5'])); I.add('cyl', p, [cx, y + h * 0.9, zf + dz], [0.026, 0.022, 0.026], '#f4efe6'); }
    return 0.075;
  }
  if (kind === 'gbottle') {
    const c = pick(['#5a3a2e', '#6a4a2a', '#d9c07a', '#8a3a2e']), cx = x + 0.042, h = Math.min(0.3, maxH - 0.02);
    for (const dz of [-0.05, -0.14]) { I.add('gbottle', p, [cx, y, zf + dz], [0.082, h, 0.082], c); I.add('cyl', p, [cx, y + h * 0.2, zf + dz], [0.084, h * 0.25, 0.084], pick(['#f4efe6', '#e8c547', '#d9463b'])); I.add('cyl', p, [cx, y + h * 0.97, zf + dz], [0.034, 0.03, 0.034], '#c9463e'); }
    return 0.085;
  }
  if (kind === 'jar') {
    const c = pick(['#8e3b36', '#3f5f4e', '#e9a23b', '#c98a4e']), cx = x + 0.04;
    for (const dz of [-0.045, -0.13]) { I.add('cyl', p, [cx, y, zf + dz], [0.078, 0.1, 0.078], c); I.add('cyl', p, [cx, y + 0.1, zf + dz], [0.08, 0.022, 0.08], pick(['#e8c547', '#f4efe6', '#d9463b'])); }
    return 0.08;
  }
  if (kind === 'bag') {
    const c = pick(PACK), h = Math.min(0.26, maxH - 0.02) * (0.8 + rnd() * 0.2), w = 0.15 + rnd() * 0.04, cx = x + w / 2;
    for (const [dz, lean] of [[-0.05, -0.12], [-0.13, -0.08]]) {
      I.add('pillow', p, [cx, y, zf + dz], [w, h, 0.055], c, [lean, rnd.range(-0.06, 0.06), 0]);
    }
    I.add('sph', p, [cx, y + h * 0.5, zf - 0.02], [w * 0.55, h * 0.4, 0.012], pick(['#f7f3ea', '#f7e28a', '#fbd3dc']), [-0.12, 0, 0]);   // printed oval panel (front bag)
    return w;
  }
  if (kind === 'box' || kind === 'deter') {
    const big = kind === 'deter';
    const w = big ? 0.22 : 0.1 + rnd() * 0.12, h = Math.min(maxH - 0.02, big ? 0.24 : 0.12 + rnd() * 0.16), d = big ? 0.14 : 0.1 + rnd() * 0.12;
    const cell = big ? 2 : Math.floor(rnd() * 16);
    atlasBox(p, w, h, d, atlas, [x + w / 2, y + h / 2, zf - d / 2 - 0.02], cell);
    if (d < 0.14 && rnd() < 0.6) atlasBox(p, w, h, d, atlas, [x + w / 2, y + h / 2, zf - d * 1.5 - 0.035], cell);
    if (big) { I.add('box', p, [x + w * 0.5, y + h, zf - d / 2 - 0.02], [0.06, 0.03, 0.02], '#3f7fb5'); }
    return w;
  }
  if (kind === 'tp') {   // toilet paper 6-pack
    const cx = x + 0.12;
    for (let i = 0; i < 2; i++) for (let j = 0; j < 3; j++) I.add('cyl', p, [cx - 0.055 + i * 0.11, y, zf - 0.06 - j * 0.07], [0.105, 0.11, 0.105], '#f4f2ec');
    I.add('box', p, [cx, y + 0.04, zf - 0.005], [0.23, 0.04, 0.004], '#8fc0d8');
    return 0.24;
  }
  if (kind === 'soap') {
    const c = pick(['#8fd1c1', '#f2c230', '#ef9fbe', '#9fc6a0', '#5f8fcf']), cx = x + 0.032, h = Math.min(0.22, maxH - 0.03);
    for (const dz of [-0.035, -0.1]) { I.add('bottle', p, [cx, y, zf + dz], [0.062, h, 0.045], c); I.add('cyl', p, [cx, y + h * 0.88, zf + dz], [0.024, 0.04, 0.024], '#f4efe6'); }
    return 0.066;
  }
  if (kind === 'sponge') {
    const cx = x + 0.06;
    for (let k = 0; k < 3; k++) { I.add('box', p, [cx, y + k * 0.04, zf - 0.06], [0.11, 0.04, 0.08], k % 2 ? '#f2c230' : '#6fb56a'); }
    return 0.12;
  }
  return 0.1;
}
function goodsAtlas(K) {
  return K.tex.draw(512, 512, (g, w, h) => {
    const n = 4, s = w / n;
    for (let i = 0; i < 16; i++) {
      const cx = (i % n) * s, cy = Math.floor(i / n) * s;
      g.fillStyle = GOODS_COL[i]; g.fillRect(cx, cy, s, s);
      g.fillStyle = 'rgba(250,246,236,0.9)'; g.fillRect(cx + 10, cy + s * 0.34, s - 20, s * 0.34);
      K.text(g, GOODS[i], cx + s / 2, cy + s * 0.51, s - 26, 34, K.F.round, 900, '#3a3346');
      g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.arc(cx + s * 0.25, cy + s * 0.18, 12, 0, 7); g.fill();
      g.fillStyle = 'rgba(40,30,50,0.18)'; g.fillRect(cx, cy + s - 12, s, 12);
    }
  }, { key: 'sb-goods-atlas' });
}
function atlasBox(p, w, h, d, m, pos, cell) {
  const geo = new THREE.BoxGeometry(w, h, d); const uv = geo.attributes.uv;
  const cx = cell % 4, cy = 3 - Math.floor(cell / 4);
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (cx + 0.04 + uv.getX(i) * 0.92) / 4, (cy + 0.04 + uv.getY(i) * 0.92) / 4);
  const mesh = new THREE.Mesh(geo, m); mesh.position.set(...pos); mesh.castShadow = false; mesh.receiveShadow = true; p.add(mesh); return mesh;
}

// ============================================================================ fixtures
/** Tiered dagashi stand: three steps of shallow card trays, candy jars on top, clip strips at the back. */
function dagashiStand(ctx, K, p, x, y, z, rnd) {
  const g = PR.grp(p, x, y, z, 0), I = K.I;
  const wood = K.im('#a57c58', 0.3, { map: K.T.grain }), dark = K.im('#6e5040', 0.26, { map: K.T.grain });
  const W = 1.1, steps = [[0.55, 0.75, 0.5], [0.72, 0.25, 0.5], [0.9, -0.25, 0.5]];     // [height, z centre, depth]
  for (const [h, zc, d] of steps) { K.tbox(g, W, h, d, dark, [0, h / 2, zc], 1); K.box(g, W + 0.02, 0.025, d + 0.01, wood, [0, h - 0.012, zc]); }
  const cols = ['#f2b5c8', '#f7e28a', '#a9cfc0', '#e9a23b', '#b9c7ea', '#d9463b', '#8fb86f', '#f4efe6', '#c98a4e'];
  steps.forEach(([h, zc, d], si) => {
    for (let i = 0; i < 4; i++) {
      const tx = -0.405 + i * 0.27, tz = zc + (si === 2 ? 0.13 : 0);
      I.add('box', g, [tx, h, tz], [0.25, 0.035, 0.2], '#efe8da');
      for (const s of [-1, 1]) { I.add('box', g, [tx, h, tz + s * 0.096], [0.25, 0.05, 0.008], '#e0d6c2'); I.add('box', g, [tx + s * 0.121, h, tz], [0.008, 0.05, 0.2], '#e0d6c2'); }
      const k = (i + si * 4) % 6, c1 = cols[(i * 2 + si) % cols.length], c2 = cols[(i * 3 + si + 4) % cols.length];
      if (k === 0) for (let a = 0; a < 3; a++) for (let b = 0; b < 4; b++) I.add('cylc', g, [tx - 0.08 + a * 0.08, h + 0.045, tz - 0.066 + b * 0.044], [0.024, 0.07, 0.024], a % 2 ? c1 : c2, [0, 0, Math.PI / 2 + rnd.range(-0.2, 0.2)]);     // きなこ棒 / sticks
      else if (k === 1) for (let a = 0; a < 5; a++) for (let b = 0; b < 3; b++) I.add('ball', g, [tx - 0.09 + a * 0.045, h + 0.053, tz - 0.05 + b * 0.05], 0.036, cols[(a + b + i) % cols.length]);  // candy balls
      else if (k === 2) for (let a = 0; a < 4; a++) for (let b = 0; b < 2; b++) I.add('pillow', g, [tx - 0.075 + a * 0.05, h + 0.035, tz - 0.035 + b * 0.07], [0.045, 0.07, 0.02], a % 2 ? c1 : c2, [-1.3, rnd.range(-0.3, 0.3), 0]);      // tiny bags
      else if (k === 3) for (let a = 0; a < 4; a++) for (let b = 0; b < 3; b++) I.add('box', g, [tx - 0.08 + a * 0.054, h + 0.035, tz - 0.06 + b * 0.06], [0.044, 0.02, 0.05], a % 2 ? c1 : '#f4efe6', [0, rnd.range(-0.3, 0.3), 0]);  // gum / menko packs
      else if (k === 4) for (let a = 0; a < 5; a++) for (let b = 0; b < 3; b++) I.add('cyl', g, [tx - 0.09 + a * 0.045, h + 0.035, tz - 0.055 + b * 0.055], [0.03, 0.05, 0.03], b % 2 ? c1 : c2);        // ramune candy tubes
      else for (let a = 0; a < 3; a++) I.add('box', g, [tx - 0.075 + a * 0.075, h + 0.035, tz], [0.06, 0.1, 0.16], a % 2 ? c1 : c2, [-0.6, 0, 0]);  // cards leaning
      K.plane(g, 0.08, 0.04, K.im('#ffffff', 0.36, { map: K.card([['10円', '20円', '30円', '50円'][(i + si) % 4]], { w: 96, h: 48, bg: '#fbf4e4', fg: '#c9463e', font: K.F.round, size0: 30 }) }), [tx, h + 0.03, tz + 0.105], 0, -0.3);
    }
  });
  // candy jars on the top step (glass, lids, candy inside)
  for (let i = 0; i < 3; i++) candyJar(K, g, -0.35 + i * 0.35, 0.9, -0.33, i + 3, rnd, 1.25);
  // clip strip rack at the back (hanging strips of small snacks)
  const rk = K.im('#8d949b', 0.26);
  for (const sx of [-0.52, 0.52]) K.box(g, 0.025, 0.55, 0.025, rk, [sx, 1.17, -0.47]);
  K.box(g, 1.06, 0.025, 0.025, rk, [0, 1.43, -0.47]);
  for (let i = 0; i < 5; i++) {
    const sx = -0.4 + i * 0.2, c = cols[(i * 3) % cols.length];
    K.box(g, 0.012, 0.44, 0.004, K.im('#e9e2d0', 0.3), [sx, 1.2, -0.46]);
    for (let k = 0; k < 4; k++) I.add('pillow', g, [sx, 1.34 - k * 0.1, -0.45], [0.07, 0.085, 0.022], k % 2 ? c : '#f7f3ea', [0, 0, 0.05 * (k % 2 ? 1 : -1)]);
  }
  K.plane(g, 0.46, 0.14, K.im('#ffffff', 0.36, { map: K.card(['駄菓子', '10円・20円・30円'], { w: 256, h: 84, bg: '#fbf4e4', fg: '#c9463e', fg2: '#3a3346', font: K.F.round }) }), [0, 1.5, -0.455]);
}
function candyJar(K, p, x, y, z, i, rnd, s = 1) {
  const r = 0.07 * s, h = 0.17 * s;
  const jar = K.cyl(p, r, h, K.glass({ opacity: 0.16, streaks: false }), [x, y + h / 2, z], 14); jar.castShadow = false; K.ctx.noOutline(jar);
  K.cyl(p, r * 0.95, 0.02, K.im('#dfe6e6', 0.4), [x, y + 0.01, z], 14);
  K.cyl(p, r * 1.05, 0.035 * s, K.im(['#d9463b', '#e8c547', '#3f7fb5', '#6f9a6a', '#ef9fbe', '#e9a23b'][i % 6], 0.3), [x, y + h + 0.017 * s, z], 14);
  K.cyl(p, r * 0.5, 0.02 * s, K.im('#f4efe6', 0.35), [x, y + h + 0.04 * s, z], 10);
  const cols = ['#f2b5c8', '#f7e28a', '#a9cfc0', '#e9a23b', '#b9c7ea', '#d9463b', '#f4efe6'];
  const n = 14;
  for (let k = 0; k < n; k++) { const a = k * 2.4, rr = r * 0.62 * Math.sqrt((k % 5) / 5 + 0.1); K.I.add('ball', p, [x + Math.cos(a) * rr, y + 0.03 + Math.floor(k / 5) * 0.028 * s, z + Math.sin(a) * rr], 0.03 * s, cols[(k + i) % cols.length]); }
}
/** Glass-door drinks cooler along the wall; front faces -x (group rotY = -π/2), 2.4 m wide. */
function cooler(ctx, K, p, x, y, z, rnd) {
  const g = PR.grp(p, x, y, z, -Math.PI / 2), I = K.I;
  const body = K.im('#e6e3dc', 0.3), w = 2.4, h = 2.0, d = 0.7;
  K.box(g, w, h, 0.04, body, [0, h / 2, -d / 2]);
  for (const sx of [-w / 2, w / 2]) K.box(g, 0.06, h, d, body, [sx, h / 2, 0]);
  K.box(g, w, 0.3, d, K.im('#d9463b', 0.3), [0, h - 0.15, 0]);
  K.plane(g, w - 0.2, 0.22, K.memo('emi', '#ffffff', { map: coolerSign(K) }, 1.05), [0, h - 0.15, d / 2 + 0.003]);
  K.box(g, w, 0.22, d, body, [0, 0.11, 0]);
  K.box(g, w - 0.1, 0.04, d - 0.1, K.lamp(1.3, '#eef6ff'), [0, h - 0.33, 0]);
  K.box(g, w - 0.14, h - 0.6, 0.01, K.im('#dfe9ee', 0.5), [0, (h - 0.6) / 2 + 0.24, -d / 2 + 0.03]);             // lit back panel
  const cols = [['#e8a23b', '#f4efe6'], ['#9fc6a0', '#3f8f5b'], ['#c9dce6', '#3f7fb5'], ['#8e5a3a', '#e8c547'], ['#f2b5c8', '#f4efe6'], ['#dfe8cf', '#6f9a6a'], ['#e9e2cf', '#d9463b'], ['#5f8fcf', '#f4efe6']];
  for (let li = 0; li < 4; li++) {
    const yy = 0.26 + li * 0.38;
    K.box(g, w - 0.14, 0.02, d - 0.12, K.im('#b9bfc4', 0.3), [0, yy, 0]);
    K.box(g, w - 0.14, 0.035, 0.012, K.im('#f4efe6', 0.35), [0, yy + 0.005, d / 2 - 0.07]);
    for (let i = 0; i < 16; i++) {
      const [c, lab] = cols[(i + li * 3) % cols.length];
      const bx = -w / 2 + 0.16 + i * (w - 0.3) / 15;
      if (li === 3 && i % 4 === 0) {           // cans on the top shelf
        for (const dz of [0.12, 0.02]) { I.add('cyl', g, [bx, yy + 0.01, dz], [0.066, 0.12, 0.066], lab); I.add('cyl', g, [bx, yy + 0.05, dz], [0.068, 0.05, 0.068], c); }
        continue;
      }
      for (const dz of [0.14, 0.04]) {
        const hh = 0.24;
        I.add('bottle', g, [bx, yy + 0.01, dz], [0.068, hh, 0.068], c);
        if (dz > 0.1) I.add('cyl', g, [bx, yy + 0.01 + hh * 0.32, dz], [0.07, 0.06, 0.07], lab);
        I.add('cyl', g, [bx, yy + 0.01 + hh * 0.88, dz], [0.026, 0.022, 0.026], '#f4efe6');
      }
    }
  }
  for (let i = 0; i < 3; i++) {
    const gp = K.box(g, w / 3 - 0.04, h - 0.56, 0.01, K.glass({ opacity: 0.12 }), [-w / 3 + i * w / 3, (h - 0.56) / 2 + 0.23, d / 2]); gp.castShadow = false; ctx.noOutline(gp);
    K.box(g, 0.035, h - 0.5, 0.04, K.im('#b9bfc4', 0.3), [-w / 2 + (i + 1) * w / 3, (h - 0.5) / 2 + 0.22, d / 2]);
    K.box(g, 0.02, 0.5, 0.03, K.im('#8d949b', 0.3), [-w / 3 + i * w / 3 + w / 6 - 0.08, 1.0, d / 2 + 0.03]);            // door handles
  }
  K.lightPool(g, 0, 0.012, d / 2 + 0.6, 2.6, 1.2, { color: '#e8f4ff', opacity: 0.16 });
}
function coolerSign(K) {
  return K.tex.draw(512, 48, (g, w, h) => {
    g.fillStyle = '#d9463b'; g.fillRect(0, 0, w, h);
    K.text(g, '冷たいお飲み物', w / 2, h / 2 + 1, w * 0.8, 34, K.F.round, 900, '#fdf8ee');
  }, { key: 'sb-cooler-sign' });
}
/** Chest freezer (frozen food / ice) with sliding glass lids and packs inside. */
function chestFreezer(ctx, K, p, x, y, z, rnd) {
  const g = PR.grp(p, x, y, z, 0), I = K.I;
  const body = K.im('#eeeae2', 0.3), trim = K.im('#3f7fb5', 0.3);
  K.rboxR(g, 1.2, 0.8, 0.64, 0.04, body, [0, 0.42, 0]);
  K.box(g, 1.21, 0.07, 0.65, trim, [0, 0.1, 0]);
  K.box(g, 1.12, 0.02, 0.56, K.lamp(1.0, '#dbe9f2'), [0, 0.78, 0]);
  const cols = ['#f2b5c8', '#f7e28a', '#a9cfc0', '#e9c7a0', '#b9c7ea', '#f4efe6', '#d9463b', '#6f9a6a'];
  for (let i = 0; i < 20; i++) I.add('box', g, [-0.48 + (i % 10) * 0.105 + rnd.range(-0.01, 0.01), 0.79, -0.12 + Math.floor(i / 10) * 0.22 + rnd.range(-0.02, 0.02)], [0.09, 0.04 + rnd() * 0.03, 0.14], cols[i % cols.length], [0, rnd.range(-0.3, 0.3), 0]);
  for (let i = 0; i < 8; i++) I.add('pillow', g, [-0.45 + i * 0.13, 0.82, 0.05], [0.1, 0.12, 0.03], cols[(i + 3) % cols.length], [-1.45, rnd.range(-0.3, 0.3), 0]);
  for (const zz of [-0.14, 0.14]) { const lid = K.box(g, 1.14, 0.012, 0.29, K.glass({ opacity: 0.22 }), [0, 0.86 + (zz > 0 ? 0.012 : 0), zz]); lid.castShadow = false; ctx.noOutline(lid); }
  K.box(g, 1.16, 0.03, 0.03, K.im('#b9bfc4', 0.3), [0, 0.87, 0.31]); K.box(g, 1.16, 0.03, 0.03, K.im('#b9bfc4', 0.3), [0, 0.87, -0.31]);
  K.plane(g, 0.62, 0.2, K.im('#ffffff', 0.35, { map: K.card(['アイス・冷凍食品'], { w: 256, h: 80, bg: '#3f7fb5', fg: '#fdf8ee', font: K.F.round, size0: 36 }) }), [0, 0.5, 0.325]);
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
function riceSack(K, p, x, y, z, rot, size) {
  const w = size === '10kg' ? 0.46 : 0.38, d = size === '10kg' ? 0.3 : 0.26, h = 0.15;
  const b = K.rbox(p, w, h, d, 0.3, K.im('#ffffff', 0.3, { map: riceTex(K, size) }), [x, y + h / 2, z]); b.rotation.y = rot;
  K.I.add('box', p, [x + Math.cos(rot) * (w / 2 - 0.01), y + 0.03, z - Math.sin(rot) * (w / 2 - 0.01)], [0.03, 0.09, d * 0.6], '#d8c9a0', [0, rot, 0]);   // folded seam
}
function broomRack(K, p, x, y, z) {
  const g = PR.grp(p, x, y, z, Math.PI), I = K.I;       // back against the inner front wall, faces -z (into the shop)
  const rail = K.im('#6e5040', 0.26, { map: K.T.grain });
  K.box(g, 1.3, 0.06, 0.04, rail, [0, 1.95, 0.02]);
  const handle = '#c9a36a';
  const items = [['bamboo', -0.5], ['room', -0.25], ['room2', 0.0], ['hataki', 0.22], ['pan', 0.45]];
  for (const [k, bx] of items) {
    I.add('cyl', g, [bx, 1.93, 0.07], [0.016, 0.04, 0.016], '#8d949b', [Math.PI / 2, 0, 0]);          // hook
    if (k === 'bamboo') { I.add('stick', g, [bx, 0.55, 0.08], [0.028, 1.35, 0.028], handle); I.add('cone', g, [bx, 0.05, 0.08], [0.32, 0.6, 0.12], '#9a8a52'); I.add('box', g, [bx, 0.62, 0.08], [0.06, 0.03, 0.06], '#6a5448'); }
    else if (k === 'room' || k === 'room2') { I.add('stick', g, [bx, 0.9, 0.08], [0.024, 1.0, 0.024], handle); I.add('box', g, [bx, 0.52, 0.08], [0.26, 0.36, 0.06], k === 'room' ? '#c9ae6a' : '#d8c27a', [0.03, 0, 0]); I.add('box', g, [bx, 0.86, 0.08], [0.27, 0.035, 0.07], '#c9463e'); }
    else if (k === 'hataki') { I.add('stick', g, [bx, 1.2, 0.08], [0.018, 0.7, 0.018], '#9a7654'); for (let i = 0; i < 6; i++) I.add('box', g, [bx + (i - 2.5) * 0.012, 0.9 + (i % 2) * 0.02, 0.08], [0.02, 0.32, 0.004], ['#f2b5c8', '#f7e28a', '#a9cfc0'][i % 3], [0, 0, (i - 2.5) * 0.06]); }
    else { I.add('stick', g, [bx, 1.35, 0.08], [0.02, 0.55, 0.02], '#3f7fb5'); I.add('box', g, [bx, 1.05, 0.08], [0.26, 0.3, 0.02], '#3f7fb5', [0.15, 0, 0]); }
  }
  K.plane(g, 0.3, 0.1, K.im('#ffffff', 0.35, { map: K.card(['ほうき・はたき', 'ちりとり'], { w: 256, h: 84, bg: '#fbf4e4', fg: '#3a3346', fg2: '#c9463e', font: K.F.round }) }), [0, 2.08, 0.045]);
}
function bucketStack(K, p, x, y, z) {
  const cols = ['#3f7fb5', '#d9463b', '#e8c547', '#6f9a6a'];
  for (let i = 0; i < 4; i++) K.I.add('cup', p, [x, y + i * 0.06, z], [0.3, 0.26, 0.3], cols[i]);
  const hd = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.006, 4, 16, Math.PI), K.im('#8d949b', 0.3)); hd.position.set(x, y + 0.44, z); p.add(hd);
  K.plane(p, 0.16, 0.08, K.im('#ffffff', 0.35, { map: K.card(['バケツ', '380円'], { w: 160, h: 72, bg: '#f4efe2', fg: '#3a3346', fg2: '#c9463e' }) }), [x, y + 0.22, z + 0.155], 0, 0.1);
}
function basketStack(K, p, x, y, z, n, color) {
  const I = K.I;
  for (let i = 0; i < n; i++) {
    const yy = y + i * 0.07;
    I.add('box', p, [x, yy, z], [0.4, 0.012, 0.28], color);
    for (const s of [-1, 1]) { I.add('box', p, [x, yy, z + s * 0.16], [0.46, 0.16, 0.012], color, [s * 0.12, 0, 0]); I.add('box', p, [x + s * 0.22, yy, z], [0.012, 0.16, 0.3], color, [0, 0, -s * 0.12]); }
  }
  for (const s of [-1, 1]) I.add('box', p, [x + s * 0.12, y + n * 0.07 + 0.1, z], [0.03, 0.012, 0.34], color);
}
/** Bamboo pole hung from the ceiling with sandals, fly swatters, straw hats and snack strips. */
function hangingPole(ctx, K, S, x0, x1, z, CH, FL, rnd) {
  const g = S.g, I = K.I, py = CH - 0.12;
  K.cylX(g, 0.022, x1 - x0 + 0.2, K.im('#c9b07a', 0.35), [(x0 + x1) / 2, py, z], 8);
  for (const x of [x0 + 0.05, x1 - 0.05]) { const p = S.w2(x, z); ctx.wires.add([[p.x, S.f.y + CH, p.z], [p.x, S.f.y + py, p.z]], { width: 0.006, color: '#6d6a70' }); }
  let x = x0 + 0.1, i = 0;
  while (x < x1 - 0.05) {
    const k = i % 4; const str = (len) => { const p = S.w2(x, z); ctx.wires.add([[p.x, S.f.y + py, p.z], [p.x, S.f.y + py - len, p.z]], { width: 0.004, color: '#e9e2d0' }); };
    if (k === 0) {       // pair of zōri sandals
      str(0.12);
      for (const dx of [-0.05, 0.05]) { I.add('rbox', g, [x + dx, py - 0.4, z], [0.09, 0.26, 0.02], '#d8c9a0', [0, 0, dx * 0.6]); I.add('box', g, [x + dx, py - 0.2, z + 0.012], [0.05, 0.012, 0.012], '#b8423c'); }
      x += 0.24;
    } else if (k === 1) { // fly swatter
      str(0.05); I.add('stick', g, [x, py - 0.45, z], [0.012, 0.4, 0.012], '#e8e6e0'); I.add('box', g, [x, py - 0.58, z], [0.12, 0.13, 0.006], rnd.pick(['#3f7fb5', '#d9463b', '#e8c547']));
      x += 0.16;
    } else if (k === 2) { // straw hat
      str(0.1); I.add('cyl16', g, [x, py - 0.3, z], [0.36, 0.012, 0.36], '#d8bf7a', [Math.PI / 2 - 0.1, 0, 0]); I.add('sph', g, [x, py - 0.3, z + 0.012], [0.18, 0.18, 0.1], '#d0b36a'); I.add('cyl16', g, [x, py - 0.3, z + 0.02], [0.19, 0.03, 0.19], '#b8423c', [Math.PI / 2 - 0.1, 0, 0]);
      x += 0.42;
    } else {              // strip of clipped snack packs
      str(0.04); I.add('box', g, [x, py - 0.62, z], [0.014, 0.58, 0.004], '#e9e2d0');
      const c = rnd.pick(PACK);
      for (let j = 0; j < 5; j++) I.add('pillow', g, [x, py - 0.14 - j * 0.1, z + 0.01], [0.08, 0.09, 0.024], j % 2 ? c : '#f7f3ea');
      x += 0.14;
    }
    i++;
  }
}

// ============================================================================ textures
function houseNorenTex(K) {
  return K.tex.draw(384, 320, (g, w, h) => {
    g.fillStyle = '#5f7389'; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(240,235,222,0.9)'; g.fillRect(0, 0, w, 16);
    g.strokeStyle = '#eee8da'; g.lineWidth = 7; g.beginPath(); g.arc(w / 2, h * 0.52, 58, 0, 7); g.stroke();
    g.beginPath(); g.moveTo(w / 2 - 36, h * 0.47); g.lineTo(w / 2, h * 0.37); g.lineTo(w / 2 + 36, h * 0.47); g.stroke();
    K.text(g, '田', w / 2, h * 0.58, 60, 48, K.F.serif, 700, '#eee8da');
    K.text(g, 'やまだ', w / 2, h * 0.86, w * 0.5, 30, K.F.brush, 400, '#eee8da');
  }, { key: 'sb-yamada-noren2' });
}
function tatamiTex(K) {
  return K.tex.draw(256, 256, (g, w, h) => {
    const r = K.ctx.rng('sb-tatami');
    g.fillStyle = '#f2efe4'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 4) { g.fillStyle = `rgba(110,100,50,${0.06 + r() * 0.06})`; g.fillRect(0, y, w, 1.4); }
    K.blotch(g, w, h, r, 10, 0.06);
  }, { key: 'sb-tatami', repeat: [1, 1] });
}
function calendarTex(K) {
  return K.tex.draw(160, 232, (g, w, h) => {
    g.fillStyle = '#f5f0e6'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#a9cfc0'; g.fillRect(6, 6, w - 12, 80);
    g.fillStyle = '#f2b5c8'; for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(20 + i * 24, 60 - (i % 2) * 18, 9, 0, 7); g.fill(); }
    K.text(g, '4月', w / 2, 104, 80, 26, K.F.serif, 700, '#3a3346');
    for (let d = 1; d <= 30; d++) { const c = (d + 2) % 7, rr = Math.floor((d + 2) / 7); K.text(g, String(d), 14 + c * 22, 130 + rr * 20, 20, 12, K.F.sans, 500, c === 0 ? '#c9463e' : '#3a3346'); }
    K.text(g, '山田商店', w / 2, h - 10, 100, 14, K.F.sans, 700, '#6d6a80');
  }, { key: 'sb-yamada-cal' });
}
function noticeTex(K) {
  return K.tex.draw(256, 184, (g, w, h) => {
    g.fillStyle = '#f7f3ea'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#3f8f5b'; g.fillRect(0, 0, w, 34);
    K.text(g, '町内会 お知らせ', w / 2, 18, w - 20, 22, K.F.sans, 900, '#fdf8ee');
    K.text(g, '春の交通安全運動', w / 2, 70, w - 20, 26, K.F.sans, 900, '#3a3346');
    K.text(g, '4月6日〜15日', w / 2, 110, w - 20, 24, K.F.sans, 700, '#c9463e');
    K.text(g, '桜ヶ丘町', w / 2, 158, w - 40, 18, K.F.sans, 700, '#6d6a80');
  }, { key: 'sb-yamada-notice' });
}
