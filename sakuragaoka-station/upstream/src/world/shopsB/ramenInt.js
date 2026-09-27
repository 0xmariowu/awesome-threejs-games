// E5 らーめん 春風 — interior: L-shaped wooden counter with steel stools, per-seat condiment sets
// (soy, vinegar, chili oil, pepper, ginger), chopstick boxes, tissue boxes, water pitchers & cups,
// served bowls; open kitchen with a 2-burner range (wok, pot), noodle boiler with tebo baskets,
// stock-pot range, steam hood with hanging ladles/strainers, work counter with bowls & garnish pans,
// fridge, sink, bowl shelves; dining side with modelled ticket machine, water station, table,
// wooden menu tags, CRT TV, wall fan, manga rack, lucky cat, WC door, noren to the kitchen.
import * as THREE from 'three';
import * as PR from './props.js';

const MENU = [['醤油らーめん', '750円'], ['味噌らーめん', '850円'], ['塩らーめん', '780円'], ['チャーシューメン', '980円'], ['つけ麺', '880円'], ['餃子（6個）', '400円'], ['半チャーハン', '380円'], ['ライス', '150円']];
export const TEXTS = ['醤油らーめん', '味噌らーめん', '塩らーめん', 'チャーシューメン', 'つけ麺', '餃子', '半チャーハン', 'ライス', '大盛り', '味玉', '替え玉', 'ビール', '瓶ビール', 'ぎょうざ', '冷やし中華',
  '750円', '850円', '780円', '980円', '880円', '400円', '380円', '150円', '+100円', '+120円', '100円', '550円', '食券', '食券をお買い求めください', '千円札', '硬貨', 'おつり', 'お手洗い', '水はセルフサービスです', 'ご来店ありがとうございます',
  '春風', '桜川ビール', '生ビール', '春風さんへ', 'おいしい！', '一番', 'ようこそ', '酢', '醤油', 'ラー油', 'こしょう', '厨房'];

export function buildRamenInterior(ctx, K, S, P) {
  const { FL, ZF, ZI, WT, X0, X1 } = P;
  const g = S.g, I = K.I, { T, F } = K;
  const B = (w, h, d, m, p, r) => K.box(g, w, h, d, m, p, r);
  const xi0 = X0 + WT, xi1 = X1 - WT, zi0 = ZF - WT, CH = FL + 2.55;
  const rnd = ctx.rng('sb-ramen-int');
  const iFloor = K.im('#a79486', 0.22, { map: T.tile });
  const iWall = K.im('#eadbc0', 0.32, { map: T.plaster });
  const iWood = K.im('#a1774f', 0.32, { map: T.grain });
  const iWoodL = K.im('#c29a70', 0.32, { map: T.grain });
  const iWoodDark = K.im('#6a4c3a', 0.28, { map: T.grain });
  const iBeam = K.im('#4e3a2e', 0.26, { map: T.grain });
  const iCeil = K.im('#c7a47c', 0.28, { map: T.vboards });
  const iSteel = K.im('#b9bfc4', 0.28), iSteelL = K.im('#d3d7da', 0.32), iSteelD = K.im('#8d949b', 0.26);
  const iTileW = K.im('#e9ece8', 0.3, { map: T.tile });

  // ------------------------------------------------------------------ shell
  K.tbox(g, xi1 - xi0, 0.04, zi0 - ZI, iCeil, [0, CH + 0.02, (zi0 + ZI) / 2], 1.5);
  for (const z of [-2.4, -5.0]) B(xi1 - xi0, 0.1, 0.12, iBeam, [0, CH - 0.05, z]);
  K.tbox(g, xi1 - xi0, CH - FL, 0.02, iWall, [0, (CH + FL) / 2, ZI + 0.01], 2.5);
  for (const x of [xi0 + 0.01, xi1 - 0.01]) K.tbox(g, 0.02, CH - FL, zi0 - ZI, iWall, [x, (CH + FL) / 2, (zi0 + ZI) / 2], 2.5);
  for (const [a0, a1] of [[xi0, -1.4], [0.8, xi1]]) K.tbox(g, a1 - a0, 0.82, 0.03, iWoodDark, [(a0 + a1) / 2, FL + 0.41, zi0 - 0.015], 1);   // wainscot inside the facade (kept clear of the door)
  K.tbox(g, 0.03, 1.0, zi0 - ZI, iWoodDark, [xi0 + 0.025, FL + 0.5, (zi0 + ZI) / 2], 1);
  B(0.05, 0.03, zi0 - ZI, iBeam, [xi0 + 0.03, FL + 1.01, (zi0 + ZI) / 2]);
  // kitchen walls tiled white (back + right wall behind the line)
  K.tbox(g, xi1 + 0.62, 1.2, 0.02, iTileW, [(xi1 - 0.65) / 2, FL + 1.3, ZI + 0.025], 0.9);
  K.tbox(g, 0.02, 1.4, 3.5, iTileW, [xi1 - 0.025, FL + 1.25, -6.15], 0.9);
  // partition between dining and kitchen (x -0.8..-0.65, z -4.85..ZI) with a noren doorway
  const pz0 = -4.85, dz0 = -5.4, dz1 = -6.2;
  K.wall(g, iWall, { axis: 'z', a0: ZI, a1: pz0, y0: FL, y1: CH, c: -0.725, t: 0.15, holes: [{ a0: dz1, a1: dz0, y0: FL, y1: FL + 1.95 }], tile: 2.5 });
  for (const z of [dz0 + 0.03, dz1 - 0.03]) B(0.19, 1.98, 0.06, iBeam, [-0.725, FL + 0.99, z]);
  B(0.19, 0.08, dz0 - dz1 + 0.12, iBeam, [-0.725, FL + 1.99, (dz0 + dz1) / 2]);
  I.add('cylc', g, [-0.815, FL + 1.93, (dz0 + dz1) / 2], [0.03, 0.9, 0.03], '#43332a', [Math.PI / 2, 0, 0]);
  ['厨', '房'].forEach((ch, i) => K.plane(g, 0.37, 0.78, K.im('#ffffff', 0.3, { map: kitchenNorenTex(K, ch), side: 'double' }), [-0.818, FL + 1.53, (dz0 + dz1) / 2 + (i ? -0.19 : 0.19)], -Math.PI / 2));
  S.box(-0.8, dz0, -0.65, pz0, FL, CH); S.box(-0.8, ZI, -0.65, dz1, FL, CH);

  // ------------------------------------------------------------------ L-shaped counter
  const cx0 = -0.8, cx1 = xi1, czF = -3.2, czL = -3.55, czB = -3.8, sz1 = -4.85, sxL = -0.5, sxB = -0.25;
  const seatY = FL + 0.76, ledgeY = FL + 1.04;
  K.tbox(g, cx1 - cx0, 0.72, czF - czB, iWoodDark, [(cx0 + cx1) / 2, FL + 0.36, (czF + czB) / 2], 1);     // long leg body
  K.tbox(g, sxB - cx0, 0.72, czB - sz1, iWoodDark, [(cx0 + sxB) / 2, FL + 0.36, (czB + sz1) / 2], 1);       // short leg body
  K.tbox(g, cx1 - cx0 + 0.05, 0.04, czF - czL + 0.06, iWood, [(cx0 + cx1) / 2 - 0.025, seatY - 0.02, (czF + czL) / 2 + 0.03], 1);   // seat tops
  K.tbox(g, sxL - cx0 + 0.06, 0.04, czL - sz1 - 0.01, iWood, [(cx0 + sxL) / 2 - 0.03, seatY - 0.02, (czL + sz1) / 2 - 0.005], 1);
  K.tbox(g, cx1 - sxL, 0.28, 0.05, iWoodDark, [(sxL + cx1) / 2, seatY + 0.14, czL - 0.025], 1);            // ledge fronts
  K.tbox(g, 0.05, 0.28, czL - sz1, iWoodDark, [sxL + 0.025, seatY + 0.14, (czL + sz1) / 2], 1);
  K.tbox(g, cx1 - sxL + 0.02, 0.04, 0.3, iWoodL, [(sxL + cx1) / 2, ledgeY - 0.02, czL - 0.14], 1);         // raised ledges (上がり台)
  K.tbox(g, 0.3, 0.04, czL - sz1 - 0.3, iWoodL, [sxL + 0.14, ledgeY - 0.02, (czL - 0.3 + sz1) / 2], 1);
  B(cx1 - cx0, 0.08, 0.03, iBeam, [(cx0 + cx1) / 2, FL + 0.04, czF + 0.012]);                               // kick rails
  B(0.03, 0.08, czF - sz1, iBeam, [cx0 - 0.012, FL + 0.04, (czF + sz1) / 2]);
  I.add('cylc', g, [(cx0 + cx1) / 2, FL + 0.22, czF + 0.09], [0.03, cx1 - cx0, 0.03], '#b9bfc4', [0, 0, Math.PI / 2]);   // foot rail
  for (let i = 0; i < 6; i++) I.add('box', g, [cx0 + 0.2 + i * 0.8, FL, czF + 0.02], [0.03, 0.22, 0.12], '#8d949b');
  S.box(cx0 - 0.05, czB, cx1, czF + 0.05, FL, FL + 1.1);
  S.box(cx0 - 0.05, sz1, sxB, czB, FL, FL + 1.1);
  // stools
  const stools = [...[0.3, 0.95, 1.6, 2.25, 2.9].map(x => [x, -2.78]), [-1.22, -3.75], [-1.22, -4.4]];
  for (const [x, z] of stools) { PR.stool(g, K, x, FL, z, { steel: true, h: 0.66, color: '#c9463e' }); S.cyl(x, z, 0.17, FL, FL + 0.7); }
  // counter items: condiments, chopsticks, tissues, pitchers & cups, menu stands, served bowls
  for (const x of [0.0, 1.3, 2.6]) condimentSet(K, g, x, seatY, -3.43, 0);
  condimentSet(K, g, -0.66, seatY, -4.25, Math.PI / 2);
  for (const x of [0.62, 1.95, 3.22]) chopBox(K, g, x, seatY, -3.45, rnd);
  chopBox(K, g, -0.66, seatY, -3.85, rnd, Math.PI / 2);
  PR.tissueBox(g, K, 0.3, seatY, -3.46, 0, '#f2b5c8'); PR.tissueBox(g, K, 2.3, seatY, -3.46, 0, '#a9cfc0');
  for (const x of [1.0, 3.4]) { PR.pitcher(g, K, x, seatY, -3.44, 0.4); for (let k = 0; k < 5; k++) I.add('tumbler', g, [x + 0.1, seatY + k * 0.018, -3.42], [0.062, 0.09, 0.062], '#e8b86a'); }
  for (const [x, z] of [[0.95, -3.32], [2.25, -3.32]]) servedBowl(K, g, x, seatY, z, rnd);
  for (const x of [0.95, 2.25]) { I.add('box', g, [x - 0.02, seatY, -3.24], [0.03, 0.01, 0.015], '#6a4c3a'); for (const dz of [-0.006, 0.006]) I.add('cylc', g, [x + 0.07, seatY + 0.016, -3.24 + dz], [0.006, 0.22, 0.006], '#e0c48a', [0, 0, Math.PI / 2]); }
  for (const x of [1.65]) menuStand(K, g, x, seatY, -3.46);
  // ledge: lucky cat on the corner, trays, a vase
  PR.manekiNeko(g, K, -0.36, ledgeY, -3.64, 0.3, 0.6, true);
  for (let k = 0; k < 4; k++) I.add('box', g, [2.95, ledgeY + k * 0.012, -3.68], [0.36, 0.011, 0.26], '#6a3e30');
  // menu tags hanging from the pass beam over the long leg
  B(cx1 - sxL, 0.5, 0.05, iWoodDark, [(sxL + cx1) / 2, CH - 0.25, czB + 0.0]);
  const allTags = MENU.concat([['大盛り', '+100円'], ['味玉', '+120円'], ['替え玉', '100円'], ['瓶ビール', '550円']]);
  allTags.forEach(([a, b], i) => { const x = sxL + 0.2 + i * 0.315; menuTag(K, g, x, CH - 0.52, czB + 0.035, 0, a, b, i); });

  // ------------------------------------------------------------------ kitchen
  // work counter behind the long leg
  const wz0 = czB, wz1 = -4.35, wTop = FL + 0.86;
  B(3.27, 0.04, 0.57, iSteelL, [(sxB + 3.0) / 2, wTop - 0.02, (wz0 + wz1) / 2]);
  B(3.25, 0.82, 0.02, iSteel, [(sxB + 3.0) / 2, FL + 0.41, wz0 - 0.012]);
  for (const x of [sxB + 0.03, 1.4, 2.97]) for (const z of [wz0 - 0.03, wz1 + 0.03]) B(0.04, 0.82, 0.04, iSteel, [x, FL + 0.41, z]);
  for (const y of [0.1, 0.35]) B(3.2, 0.02, 0.5, iSteelD, [(sxB + 3.0) / 2, FL + y, (wz0 + wz1) / 2 - 0.01]);        // open under-shelves
  for (let i = 0; i < 8; i++) bowlStack(K, g, sxB + 0.25 + i * 0.36, FL + 0.36, -4.14, 3);
  for (let i = 0; i < 5; i++) { const x = 0.05 + i * 0.28; I.add('bowl', g, [x, wTop, -4.12], [0.2, 0.13, 0.2], '#f3eee4'); I.add('disc', g, [x, wTop + 0.012, -4.12], [0.11, 0.004, 0.11], '#6a3e2a'); I.add('ring', g, [x, wTop + 0.074, -4.12], 0.2, '#c9463e', [Math.PI / 2, 0, 0]); }
  garnishTray(K, g, 1.85, wTop, -4.06, rnd);
  for (let k = 0; k < 7; k++) I.add('rbox', g, [2.72, wTop + k * 0.013, -4.02], [0.045, 0.012, 0.12], '#f4efe6', [0.08, 0, 0]);   // renge stack
  I.add('cyl16', g, [2.9, wTop, -4.18], [0.14, 0.2, 0.14], '#8d949b');                                                                 // ladle holder
  for (let k = 0; k < 3; k++) PR.tube(g, [2.9 + (k - 1) * 0.03, wTop + 0.12, -4.18], [2.9 + (k - 1) * 0.06, wTop + 0.5, -4.1], 0.008, iSteelL, 5);
  I.add('cyl16', g, [-0.16, wTop, -4.2], [0.15, 0.14, 0.15], '#6a4c3a');                                               // tare pot
  S.box(sxB, wz1, 3.02, wz0, FL, FL + 0.9);
  // back line: range, noodle boiler, stock-pot range, rice cooker
  const lz = -7.55;
  gasRange(K, g, -0.05, FL, lz, rnd);
  noodleBoiler(ctx, K, S, 1.2, FL, lz, rnd);
  stockRange(ctx, K, S, 2.45, FL, lz, rnd);
  {
    K.box(g, 0.48, 0.85, 0.65, iSteel, [3.3, FL + 0.425, lz]); B(0.5, 0.02, 0.67, iSteelL, [3.3, FL + 0.86, lz]);
    K.lathe(g, [[0, 0], [0.16, 0], [0.18, 0.05], [0.18, 0.2], [0.14, 0.26], [0, 0.27]], K.im('#e9e4d8', 0.32), [3.3, FL + 0.87, lz - 0.05], 14);
    K.cyl(g, 0.03, 0.03, K.im('#c9463e', 0.3), [3.3, FL + 1.15, lz - 0.05], 8);
  }
  S.box(-0.65, ZI, xi1, -7.18, FL, FL + 1.3);
  // steam hood with lamp strip + utensil rail
  const hz0 = -7.05;
  K.box(g, xi1 + 0.65, CH - (FL + 1.95), 0.9, iSteel, [(xi1 - 0.65) / 2, (CH + FL + 1.95) / 2, hz0 - 0.4]);
  B(xi1 + 0.55, 0.02, 0.8, K.lamp(1.15, '#fff4e2'), [(xi1 - 0.65) / 2, FL + 1.94, hz0 - 0.42]);
  for (let i = 0; i < 5; i++) B(xi1 + 0.6, 0.012, 0.02, iSteelD, [(xi1 - 0.65) / 2, FL + 1.99 + i * 0.1, hz0 + 0.052]);            // filter slats
  I.add('cylc', g, [(xi1 - 0.65) / 2, FL + 1.88, hz0 + 0.12], [0.02, xi1 + 0.5, 0.02], '#8d949b', [0, 0, Math.PI / 2]);
  for (let i = 0; i < 7; i++) hangTool(K, g, -0.35 + i * 0.52, FL + 1.88, hz0 + 0.12, i);
  // fridge, sink + dish rack, bowl shelves on the right wall
  {
    K.box(g, 0.64, 1.8, 0.8, iSteelL, [xi1 - 0.33, FL + 0.9, -4.9]);
    for (const zz of [-4.7, -5.1]) { B(0.012, 0.85, 0.38, iSteel, [xi1 - 0.655, FL + 1.35, zz]); B(0.02, 0.3, 0.03, iSteelD, [xi1 - 0.67, FL + 1.35, zz + (zz > -4.9 ? -0.15 : 0.15)]); }
    B(0.012, 0.8, 0.78, iSteel, [xi1 - 0.655, FL + 0.44, -4.9]);
    K.box(g, 0.6, 0.85, 1.2, iSteel, [xi1 - 0.31, FL + 0.425, -6.1]);
    B(0.62, 0.02, 1.22, iSteelL, [xi1 - 0.31, FL + 0.86, -6.1]);
    B(0.44, 0.004, 0.48, K.im('#5f666e', 0.16), [xi1 - 0.3, FL + 0.872, -5.9]);                            // basin (dark inset)
    for (const s of [-1, 1]) { B(0.46, 0.012, 0.015, iSteelL, [xi1 - 0.3, FL + 0.876, -5.9 + s * 0.245]); B(0.015, 0.012, 0.5, iSteelL, [xi1 - 0.3 + s * 0.225, FL + 0.876, -5.9]); }
    PR.tube(g, [xi1 - 0.05, FL + 0.86, -5.9], [xi1 - 0.05, FL + 1.15, -5.9], 0.015, iSteelL, 8);
    PR.tube(g, [xi1 - 0.05, FL + 1.15, -5.9], [xi1 - 0.25, FL + 1.1, -5.9], 0.012, iSteelL, 8);
    for (let k = 0; k < 4; k++) I.add('bowl', g, [xi1 - 0.3, FL + 0.97, -6.6 + k * 0.08], [0.18, 0.12, 0.18], '#f3eee4', [1.35, 0, 0]);    // drying rack
    I.add('box', g, [xi1 - 0.3, FL + 0.87, -6.48], [0.3, 0.02, 0.34], '#9aa1a8');
    for (const y of [1.55, 1.95]) { B(0.3, 0.025, 1.1, iSteelL, [xi1 - 0.17, FL + y, -6.1]); for (let i = 0; i < 5; i++) bowlStack(K, g, xi1 - 0.17, FL + y + 0.013, -6.55 + i * 0.22, y > 1.7 ? 2 : 3); }
    S.box(xi1 - 0.66, -6.72, xi1, -4.48, FL, FL + 1.85);
  }
  // kitchen floor mat + steam
  I.add('box', g, [1.2, FL, -5.8], [2.8, 0.012, 0.8], '#4f5a60');
  K.steam(S, { x: 1.2, y: FL + 1.0, z: lz, n: 6, rise: 0.8, drift: [0.05, 0.05], size: 0.32, life: 3.0, alpha: 0.75 });
  K.steam(S, { x: 2.2, y: FL + 1.0, z: lz, n: 5, rise: 0.8, drift: [-0.05, 0.05], size: 0.3, life: 3.4, alpha: 0.7 });
  K.lightPool(g, 1.4, FL + 0.87, lz, 3.6, 0.9, { opacity: 0.16 });

  // ------------------------------------------------------------------ dining side (left)
  ticketMachine(K, g, xi0 + 0.25, FL, -2.28, Math.PI / 2);
  S.box(xi0, -2.66, xi0 + 0.52, -1.9, FL, FL + 1.85);
  // water station
  {
    const wg = PR.grp(g, xi0 + 0.2, FL, -3.1, Math.PI / 2);
    K.box(wg, 0.62, 0.04, 0.36, iSteelL, [0, 0.84, 0]);
    for (const sx of [-0.28, 0.28]) for (const sz of [-0.15, 0.15]) K.box(wg, 0.03, 0.82, 0.03, iSteel, [sx, 0.41, sz]);
    K.box(wg, 0.58, 0.02, 0.32, iSteel, [0, 0.25, 0]);
    K.cyl(wg, 0.11, 0.38, K.im('#dfe9ee', 0.4), [-0.14, 1.05, -0.02], 16);                                   // water dispenser
    K.cyl(wg, 0.115, 0.04, iSteelD, [-0.14, 1.25, -0.02], 16);
    K.box(wg, 0.05, 0.05, 0.08, K.im('#3f7fb5', 0.3), [-0.14, 0.93, 0.12]);
    for (let k = 0; k < 8; k++) I.add('tumbler', wg, [0.12, 0.86 + k * 0.02, -0.04], [0.064, 0.09, 0.064], '#e8b86a');
    for (let k = 0; k < 6; k++) I.add('tumbler', wg, [0.22, 0.86 + k * 0.02, 0.05], [0.064, 0.09, 0.064], '#bcd6e2');
    K.plane(wg, 0.5, 0.24, K.im('#ffffff', 0.35, { map: waterSign(K) }), [0, 1.5, -0.17]);
    S.box(xi0, -3.44, xi0 + 0.4, -2.76, FL, FL + 1.3);
  }
  // table for four + stools
  {
    const tx = -2.75, tz = -4.9;
    K.tbox(g, 0.8, 0.04, 0.7, iWood, [tx, FL + 0.72, tz], 1);
    K.box(g, 0.08, 0.68, 0.08, K.im('#5c5a60', 0.2), [tx, FL + 0.36, tz]);
    K.box(g, 0.5, 0.03, 0.5, K.im('#5c5a60', 0.2), [tx, FL + 0.015, tz]);
    for (const [sx, sz] of [[-0.25, -0.62], [0.25, -0.62], [-0.25, 0.62], [0.25, 0.62]]) { PR.stool(g, K, tx + sx, FL, tz + sz, { steel: true, h: 0.46, color: '#c9463e' }); S.cyl(tx + sx, tz + sz, 0.16, FL, FL + 0.5); }
    condimentSet(K, g, tx + 0.18, FL + 0.74, tz - 0.12, 0);
    PR.tissueBox(g, K, tx - 0.2, FL + 0.74, tz + 0.18, 0.3, '#f2b5c8');
    chopBox(K, g, tx - 0.22, FL + 0.74, tz - 0.16, rnd);
    menuStand(K, g, tx + 0.2, FL + 0.74, tz + 0.2);
    S.box(tx - 0.42, tz - 0.37, tx + 0.42, tz + 0.37, FL, FL + 0.76);
  }
  // left wall: menu tags, shikishi, beer poster, wall fan; front corner: TV on bracket
  {
    const wg = PR.grp(g, xi0 + 0.04, 0, 0, Math.PI / 2);        // local x = -world z, faces +x
    B(0.035, 0.04, 2.5, iBeam, [xi0 + 0.055, FL + 2.3, -4.95]);
    const wtags = [['醤油らーめん', '750円'], ['味噌らーめん', '850円'], ['塩らーめん', '780円'], ['つけ麺', '880円'], ['餃子', '400円'], ['半チャーハン', '380円'], ['ライス', '150円'], ['冷やし中華', '850円'], ['ビール', '550円'], ['味玉', '+120円'], ['大盛り', '+100円'], ['替え玉', '100円']];
    wtags.forEach(([a, b], i) => menuTag(K, wg, 3.8 + i * 0.2, FL + 2.07, 0.02, 0, a, b, i + 3, 0.16, 0.42));
    for (let i = 0; i < 3; i++) { K.box(wg, 0.26, 0.29, 0.012, K.im('#d9b86a', 0.3), [2.85 + i * 0.3, FL + 1.95, 0.006]); K.plane(wg, 0.23, 0.26, K.im('#ffffff', 0.35, { map: shikishiTex(K, i) }), [2.85 + i * 0.3, FL + 1.95, 0.0135]); }
    K.plane(wg, 0.46, 0.64, K.im('#ffffff', 0.35, { map: beerPosterTex(K) }), [6.6, FL + 1.45, 0.004]);
    PR.fan(wg, K, 6.3, FL + 2.05, 0.0, 0, { color: '#ecebe4', blade: '#9fc6dc' });
    PR.calendar(wg, K, 7.2, FL + 1.55, 0.0, 0, calTex(K), 0.34, 0.48);
  }
  {
    const tv = PR.grp(g, xi0 + 0.34, FL + 2.0, zi0 - 0.36, Math.PI / 2 + 0.65);
    K.box(tv, 0.55, 0.03, 0.42, iWoodDark, [0, -0.015, 0]);
    PR.tube(g, [xi0 + 0.03, FL + 1.75, zi0 - 0.36], [xi0 + 0.3, FL + 1.985, zi0 - 0.36], 0.014, iSteelD, 6);
    PR.tube(g, [xi0 + 0.34, FL + 1.75, zi0 - 0.03], [xi0 + 0.34, FL + 1.985, zi0 - 0.3], 0.014, iSteelD, 6);
    PR.crtTV(tv, K, 0, 0, -0.04, 0, { glow: 1.0 });
  }
  // back wall: manga rack, WC door, coat hooks
  {
    const rg = PR.grp(g, -3.0, FL, ZI + 0.02, 0);
    K.tbox(rg, 1.4, 1.5, 0.02, iWoodDark, [0, 0.75, 0.01], 1);
    for (const sx of [-0.69, 0.69]) K.box(rg, 0.03, 1.5, 0.3, iWoodDark, [sx, 0.75, 0.15]);
    K.box(rg, 1.42, 0.03, 0.31, iWood, [0, 1.5, 0.155]);
    const spine = ['#d9463b', '#3f7fb5', '#e8c547', '#6f9a6a', '#f2b5c8', '#e9e2cf', '#5f8fcf', '#c98a4e', '#f4efe6'];
    for (const y of [0.08, 0.53, 0.98]) {
      K.box(rg, 1.36, 0.025, 0.28, iWood, [0, y - 0.012, 0.15]);
      let x = -0.64; let i = 0;
      while (x < 0.62) { const w = 0.03 + rnd() * 0.012, h = 0.17 + rnd() * 0.04; I.add('box', rg, [x + w / 2, y, 0.2], [w, h, 0.12], spine[(i * 7 + Math.round(y * 10)) % spine.length], [0, 0, rnd.range(-0.02, 0.02)]); x += w + 0.002; i++; if (rnd() < 0.05) x += 0.05; }
    }
    S.box(-3.72, ZI, -2.28, ZI + 0.34, FL, FL + 1.55);
    const dg = PR.grp(g, -1.55, FL, ZI + 0.02, 0);
    K.box(dg, 0.8, 1.95, 0.04, K.im('#b9ac98', 0.28, { map: T.vboards }), [0, 0.975, 0.02]);
    for (const sx of [-0.43, 0.43]) K.box(dg, 0.06, 2.0, 0.07, iBeam, [sx, 1.0, 0.035]); K.box(dg, 0.92, 0.06, 0.07, iBeam, [0, 2.0, 0.035]);
    K.cyl(dg, 0.025, 0.05, K.im('#c9a45a', 0.35), [0.3, 0.95, 0.06], 10, [Math.PI / 2, 0, 0]);
    K.plane(dg, 0.3, 0.12, K.im('#ffffff', 0.35, { map: K.card(['お手洗い'], { w: 192, h: 72, bg: '#f4efe2', fg: '#3a3346', font: F.sans, size0: 34 }) }), [0, 1.6, 0.045]);
  }
  // ------------------------------------------------------------------ lights
  for (let i = 0; i < 3; i++) {
    const lx = 0.3 + i * 1.3, p = S.w2(lx, -2.95);
    ctx.wires.add([[p.x, S.f.y + CH, p.z], [p.x, S.f.y + FL + 2.05, p.z]], { width: 0.006, color: '#3a3346' });
    K.lathe(g, [[0.02, 0.18], [0.08, 0.15], [0.17, 0.02], [0.18, 0]], K.im('#c9463e', 0.4, { side: 'double' }), [lx, FL + 1.88, -2.95], 14);
    K.sph(g, 0.06, K.lamp(1.5), [lx, FL + 1.92, -2.95], 10);
    K.lightPool(g, lx, seatY + 0.004, -3.35, 1.0, 0.5, { opacity: 0.18 });
  }
  for (const z of [-2.9, -5.6]) { B(1.25, 0.05, 0.12, K.im('#dcd9d2', 0.3), [-2.3, CH - 0.03, z]); K.cylX(g, 0.018, 1.18, K.lamp(1.4, '#fff4e6'), [-2.3, CH - 0.07, z], 8); K.lightPool(g, -2.3, FL + 0.012, z, 2.4, 1.8, { opacity: 0.14 }); }
  K.lightPool(g, 0.9, FL + 0.012, -2.6, 4.4, 1.2, { opacity: 0.12 });
  void iFloor;
}

// ============================================================================ props
function condimentSet(K, p, x, y, z, rotY) {
  const g = PR.grp(p, x, y, z, rotY), I = K.I;
  I.add('box', g, [0, 0, 0], [0.3, 0.015, 0.12], '#6a4c3a');
  // soy (glass cruet, red cap), vinegar (yellow cap), chili oil (jar + spoon), pepper shaker, ginger pot
  I.add('gbottle', g, [-0.11, 0.015, 0], [0.05, 0.13, 0.05], '#4a2e26'); I.add('cyl', g, [-0.11, 0.14, 0], [0.024, 0.022, 0.024], '#c9463e');
  I.add('gbottle', g, [-0.055, 0.015, 0], [0.05, 0.13, 0.05], '#d9c69a'); I.add('cyl', g, [-0.055, 0.14, 0], [0.024, 0.022, 0.024], '#e8c547');
  I.add('cyl', g, [0.0, 0.015, 0], [0.05, 0.07, 0.05], '#b8423c'); I.add('cyl', g, [0.0, 0.085, 0], [0.054, 0.012, 0.054], '#e9e4d8');
  PR.tube(g, [0.008, 0.07, 0], [0.02, 0.14, 0.01], 0.003, K.im('#c9ccd0', 0.35), 4);
  I.add('cyl', g, [0.055, 0.015, 0], [0.04, 0.08, 0.04], '#e9e4d8'); I.add('cyl', g, [0.055, 0.095, 0], [0.042, 0.02, 0.042], '#b9bfc4');
  I.add('cyl16', g, [0.11, 0.015, 0], [0.065, 0.06, 0.065], '#e9e4d8'); I.add('cyl16', g, [0.11, 0.075, 0], [0.068, 0.012, 0.068], '#c9463e');
  return g;
}
function chopBox(K, p, x, y, z, rnd, rotY = 0) {
  const g = PR.grp(p, x, y, z, rotY), I = K.I;
  I.add('box', g, [0, 0, 0], [0.09, 0.1, 0.09], '#8a5a3a');
  I.add('box', g, [0, 0.1, 0], [0.095, 0.012, 0.095], '#6a4c3a');
  for (let i = 0; i < 12; i++) I.add('stick', g, [-0.03 + (i % 4) * 0.02, 0.02, -0.02 + Math.floor(i / 4) * 0.02], [0.006, 0.2 + rnd() * 0.02, 0.006], '#e0c48a', [rnd.range(-0.05, 0.05), 0, rnd.range(-0.05, 0.05)]);
}
function menuStand(K, p, x, y, z) {
  const g = PR.grp(p, x, y, z, 0.2);
  K.box(g, 0.14, 0.012, 0.06, K.im('#6a4c3a', 0.3), [0, 0.006, 0]);
  K.box(g, 0.13, 0.18, 0.006, K.im('#f4efe2', 0.3), [0, 0.1, 0], [-0.12, 0, 0]);
  K.plane(g, 0.12, 0.17, K.im('#ffffff', 0.36, { map: K.card(['本日のおすすめ', '味噌らーめん', '850円'], { w: 128, h: 180, bg: '#f4efe2', fg: '#b8423c', fg2: '#3a3346', font: K.F.round }) }), [0, 0.1, 0.0045], 0, -0.12);
}
function servedBowl(K, p, x, y, z, rnd) {
  const I = K.I;
  I.add('bowl', p, [x, y, z], [0.21, 0.13, 0.21], '#f3eee4');
  I.add('ring', p, [x, y + 0.076, z], 0.21, '#c9463e', [Math.PI / 2, 0, 0]);
  I.add('disc', p, [x, y + 0.05, z], [0.19, 0.018, 0.19], '#d9a45a');
  for (let i = 0; i < 2; i++) I.add('disc', p, [x + 0.03 + i * 0.02, y + 0.066, z + 0.02 - i * 0.03], [0.06, 0.008, 0.06], '#e2b49a', [0.2, 0, 0.15]);
  I.add('sph', p, [x - 0.04, y + 0.07, z + 0.02], [0.035, 0.022, 0.042], '#f4d67a');
  I.add('disc', p, [x - 0.02, y + 0.066, z - 0.04], [0.035, 0.006, 0.035], '#f7f3ea'); I.add('disc', p, [x - 0.02, y + 0.07, z - 0.04], [0.016, 0.003, 0.016], '#ef9fbe');
  I.add('box', p, [x, y + 0.05, z - 0.075], [0.07, 0.07, 0.004], '#2f3a36', [-0.25, 0, 0]);
  for (let i = 0; i < 6; i++) I.add('ball', p, [x + rnd.range(-0.05, 0.05), y + 0.069, z + rnd.range(-0.04, 0.05)], [0.012, 0.006, 0.012], '#6f9a5a');
  I.add('rbox', p, [x + 0.08, y + 0.05, z + 0.03], [0.045, 0.014, 0.11], '#f4efe6', [0.35, 0.6, 0]);
}
function bowlStack(K, p, x, y, z, n) {
  for (let i = 0; i < n; i++) { K.I.add('bowl', p, [x, y + i * 0.05, z], [0.18, 0.12, 0.18], '#f3eee4'); K.I.add('ring', p, [x, y + 0.07 + i * 0.05, z], 0.18, '#c9463e', [Math.PI / 2, 0, 0]); }
}
function garnishTray(K, p, x, y, z, rnd) {
  const I = K.I;
  I.add('box', p, [x, y, z], [0.66, 0.02, 0.26], '#9aa1a8');
  const pans = [['#7fa35a', 'ball'], ['#b08a4e', 'box'], ['#e2b49a', 'disc'], ['#2f3a36', 'box']];
  pans.forEach(([c, k], i) => {
    const px = x - 0.24 + i * 0.16;
    I.add('box', p, [px, y + 0.02, z], [0.15, 0.05, 0.22], '#c9ced3');
    for (let j = 0; j < 9; j++) {
      const q = [px + rnd.range(-0.05, 0.05), y + 0.06, z + rnd.range(-0.08, 0.08)];
      if (k === 'ball') I.add('ball', p, q, [0.02, 0.012, 0.02], c);
      else if (k === 'disc') I.add('disc', p, q, [0.06, 0.01, 0.06], c, [rnd.range(-0.3, 0.3), 0, rnd.range(-0.3, 0.3)]);
      else I.add('box', p, q, c === '#2f3a36' ? [0.07, 0.004, 0.1] : [0.012, 0.012, 0.05], c, [0, rnd() * 3, 0]);
    }
  });
}
function hangTool(K, p, x, y, z, i) {
  const I = K.I;
  I.add('cylc', p, [x, y - 0.03, z], [0.008, 0.06, 0.008], '#6d747c');
  if (i % 3 === 0) { I.add('stick', p, [x, y - 0.5, z], [0.014, 0.46, 0.014], '#b9bfc4'); I.add('bowl', p, [x, y - 0.56, z], [0.1, 0.1, 0.1], '#c9ced3'); }                  // ladle (hishaku)
  else if (i % 3 === 1) { I.add('stick', p, [x, y - 0.42, z], [0.014, 0.38, 0.014], '#6a4c3a'); I.add('cone', p, [x, y - 0.62, z], [0.12, 0.2, 0.12], '#9aa1a8', [Math.PI, 0, 0]); }   // tebo strainer
  else { I.add('stick', p, [x, y - 0.4, z], [0.012, 0.36, 0.012], '#b9bfc4'); I.add('dish', p, [x, y - 0.46, z], [0.16, 0.1, 0.16], '#b9bfc4', [0, 0, 0]); }            // skimmer
}
function gasRange(K, p, x, y, z, rnd) {
  const g = PR.grp(p, x, y, z, 0), I = K.I;
  const st = K.im('#b9bfc4', 0.28);
  K.box(g, 1.1, 0.78, 0.65, st, [0, 0.39, 0]);
  K.box(g, 1.12, 0.03, 0.67, K.im('#6d747c', 0.2), [0, 0.795, 0]);
  for (let i = 0; i < 4; i++) K.cyl(g, 0.025, 0.04, K.im('#3a3346', 0.12), [-0.4 + i * 0.27, 0.6, 0.33], 10, [Math.PI / 2, 0, 0]);
  for (const bx of [-0.27, 0.27]) {
    I.add('cyl16', g, [bx, 0.81, 0], [0.16, 0.02, 0.16], '#3f3a44');
    I.add('ring', g, [bx, 0.83, 0], 0.2, '#4a4450', [Math.PI / 2, 0, 0]);
    for (let k = 0; k < 4; k++) I.add('box', g, [bx, 0.81, 0], [0.34, 0.02, 0.02], '#3f3a44', [0, k * Math.PI / 4, 0]);
  }
  K.lathe(g, [[0, 0], [0.12, 0.03], [0.2, 0.09], [0.21, 0.1]], K.im('#3f3a44', 0.18, { side: 'double' }), [-0.27, 0.835, 0], 16);   // wok
  PR.tube(g, [-0.07, 0.93, 0], [0.12, 0.98, 0.05], 0.012, K.im('#6a4c3a', 0.25), 6);
  I.add('cyl16', g, [0.27, 0.835, 0], [0.24, 0.16, 0.24], '#c9ced3'); I.add('cyl16', g, [0.27, 0.99, 0], [0.245, 0.012, 0.245], '#9aa1a8');
}
function noodleBoiler(ctx, K, S, x, y, z, rnd) {
  const g = PR.grp(S.g, x, y, z, 0), I = K.I;
  const st = K.im('#b9bfc4', 0.28);
  K.box(g, 1.1, 0.85, 0.66, st, [0, 0.425, 0]);
  K.box(g, 1.12, 0.03, 0.68, K.im('#d3d7da', 0.32), [0, 0.865, 0]);
  K.box(g, 0.9, 0.012, 0.46, K.im('#e6ecee', 0.5), [0, 0.86, 0]);                              // boiling water
  for (let i = 0; i < 6; i++) {
    const bx = -0.33 + (i % 3) * 0.33, bz = -0.1 + Math.floor(i / 3) * 0.2;
    I.add('cyl16', g, [bx, 0.74, bz], [0.14, 0.15, 0.14], '#8d949b');                          // tebo basket in the water
    I.add('ring', g, [bx, 0.892, bz], 0.14, '#b9bfc4', [Math.PI / 2, 0, 0]);
    PR.tube(g, [bx, 0.89, bz + 0.07], [bx + 0.05, 1.12, bz + 0.33], 0.009, K.im('#b9bfc4', 0.3), 5);   // long handle resting on the rim
  }
  for (let i = 0; i < 3; i++) K.cyl(g, 0.025, 0.04, K.im('#3a3346', 0.12), [-0.3 + i * 0.3, 0.55, 0.34], 10, [Math.PI / 2, 0, 0]);
}
function stockRange(ctx, K, S, x, y, z, rnd) {
  const g = PR.grp(S.g, x, y, z, 0), I = K.I;
  K.box(g, 1.1, 0.45, 0.66, K.im('#9aa1a8', 0.26), [0, 0.225, 0]);
  for (const bx of [-0.27, 0.27]) {
    I.add('ring', g, [bx, 0.47, 0], 0.4, '#3f3a44', [Math.PI / 2, 0, 0]);
    I.add('cyl16', g, [bx, 0.46, 0], [0.48, 0.5, 0.48], '#c9ccd0');
    I.add('cyl16', g, [bx, 0.955, 0], [0.49, 0.02, 0.49], '#9aa1a8');
    I.add('disc', g, [bx, 0.945, 0], [0.45, 0.004, 0.45], bx < 0 ? '#e6d2a6' : '#d9b380');
    PR.tube(g, [bx + 0.05, 0.9, 0.02], [bx + 0.2, 1.3, 0.12], 0.01, K.im('#b9bfc4', 0.3), 5);    // ladle handle
  }
}
function ticketMachine(K, p, x, y, z, rotY) {
  const g = PR.grp(p, x, y, z, rotY), I = K.I;
  const body = K.im('#d9dde0', 0.3);
  K.rboxR(g, 0.72, 1.6, 0.5, 0.05, body, [0, 0.8, 0]);
  K.box(g, 0.66, 0.96, 0.02, K.im('#2f3a48', 0.2), [0, 1.08, 0.25]);
  K.plane(g, 0.62, 0.9, K.memo('emi', '#ffffff', { map: ticketTex(K) }, 1.0), [0, 1.08, 0.262]);
  // push buttons under each menu cell (3 × 4 grid) + lit indicator lamps
  for (let i = 0; i < 12; i++) {
    const cxp = (10 + (i % 3) * 80 + 37) / 256, cyp = (36 + Math.floor(i / 3) * 70 + 54) / 372;
    const bx = (cxp - 0.5) * 0.62, by = 1.08 + (0.5 - cyp) * 0.9;
    I.add('cyl', g, [bx, by, 0.262], [0.05, 0.02, 0.022], i % 4 === 0 ? '#e8c547' : '#f4efe6', [Math.PI / 2, 0, 0]);
  }
  K.box(g, 0.5, 0.2, 0.06, K.im('#6d747c', 0.2), [0, 0.46, 0.26]);                         // coin / bill unit
  K.box(g, 0.18, 0.02, 0.02, K.im('#3a3346', 0.1), [-0.12, 0.5, 0.295]);                   // bill slot
  K.box(g, 0.02, 0.05, 0.02, K.im('#3a3346', 0.1), [0.14, 0.51, 0.295]);                   // coin slot
  K.cyl(g, 0.03, 0.02, K.im('#d9463b', 0.3), [0.2, 0.44, 0.295], 10, [Math.PI / 2, 0, 0]);   // return lever
  K.box(g, 0.26, 0.1, 0.1, K.im('#4f5358', 0.18), [0, 0.22, 0.26]);                        // change & ticket tray
  K.box(g, 0.22, 0.06, 0.06, K.im('#2f2a36', 0.1), [0, 0.23, 0.285]);
  K.box(g, 0.74, 0.2, 0.52, K.im('#b8423c', 0.3), [0, 1.68, 0]);
  K.plane(g, 0.66, 0.15, K.memo('emi', '#ffffff', { map: K.card(['食券'], { w: 256, h: 64, bg: '#b8423c', fg: '#fdf8ee', font: K.F.round, size0: 40 }) }, 1.0), [0, 1.68, 0.262]);
}
/** Wooden menu tag (木札) hanging from a rail: board + text plane (+Z faces out). */
function menuTag(K, p, x, y, z, rotY, a, b, i, w = 0.13, h = 0.4) {
  const g = PR.grp(p, x, y, z, rotY);
  K.box(g, w + 0.016, h + 0.016, 0.014, K.im('#c29a70', 0.32, { map: K.T.grain }), [0, 0, 0], [0, 0, 0.012 * ((i % 3) - 1)]);
  K.plane(g, w, h, K.im('#ffffff', 0.36, { map: tagTex(K, a, b, i === 0) }), [0, 0, 0.0075], 0).rotation.z = 0.012 * ((i % 3) - 1);
}

// ============================================================================ textures
function tagTex(K, a, b, hi) {
  return K.tex.draw(80, 240, (g, w, h) => {
    g.fillStyle = hi ? '#f6dde4' : '#efe2c6'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(90,60,40,0.3)'; g.lineWidth = 2; g.strokeRect(3, 3, w - 6, h - 6);
    const t = a.replace('（6個）', '');
    const sz = Math.min(32, (h - 86) / [...t].length);
    g.fillStyle = '#2a211d'; g.font = `400 ${sz}px ${K.F.brush}`; K.vtext(g, t, w * 0.6, 10, sz, 1.0);
    g.fillStyle = '#b8423c'; g.font = `700 14px ${K.F.serif}`; K.vtext(g, b, w * 0.22, h - 16 - 14 * [...b].length, 14, 1.0);
  }, { key: 'sb-ramen-tag|' + a + b });
}
function kitchenNorenTex(K, ch) {
  return K.tex.draw(128, 280, (g, w, h) => {
    g.fillStyle = '#f0ebe0'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#9e3b35'; g.fillRect(0, 0, w, 20); g.fillRect(0, h - 30, w, 30);
    K.text(g, ch, w * 0.5, h * 0.48, 100, 84, K.F.brush, 400, '#9e3b35');
  }, { key: 'sb-ramen-kitchen-noren|' + ch });
}
function ticketTex(K) {
  return K.tex.draw(256, 372, (g, w, h) => {
    g.fillStyle = '#2f3a48'; g.fillRect(0, 0, w, h);
    K.text(g, '食券をお買い求めください', w / 2, 18, w - 16, 16, K.F.sans, 700, '#e8f0f6');
    const cols = ['#f4efe2', '#f6dde4', '#f7e9b8', '#dfe8cf'];
    MENU.concat([['大盛り', '+100円'], ['味玉', '+120円'], ['替え玉', '100円'], ['ビール', '550円']]).forEach(([a, b], i) => {
      const x = 10 + (i % 3) * 80, y = 36 + Math.floor(i / 3) * 70;
      g.fillStyle = cols[Math.floor(i / 3) % 4]; K.rr(g, x, y, 74, 62, 6); g.fill();
      K.text(g, a.replace('（6個）', ''), x + 37, y + 16, 68, 14, K.F.sans, 700, '#2a211d');
      K.text(g, b, x + 37, y + 34, 68, 14, K.F.sans, 900, '#b8423c');
    });
    g.fillStyle = '#8fd1c1'; K.rr(g, 20, h - 50, 90, 36, 6); g.fill();
    K.text(g, '千円札', 65, h - 32, 80, 16, K.F.sans, 700, '#2a211d');
    g.fillStyle = '#e9e2cf'; K.rr(g, 140, h - 50, 90, 36, 6); g.fill();
    K.text(g, '硬貨', 185, h - 32, 80, 16, K.F.sans, 700, '#2a211d');
  }, { key: 'sb-ramen-ticket2' });
}
function shikishiTex(K, i) {
  return K.tex.draw(128, 144, (g, w, h) => {
    g.fillStyle = '#f6f1e6'; g.fillRect(0, 0, w, h);
    g.strokeStyle = ['#3a3346', '#2f5f9e', '#b8423c', '#3f8f5b'][i % 4]; g.lineWidth = 4;
    g.beginPath(); g.moveTo(24, 40 + i * 4); g.bezierCurveTo(50, 20, 70, 80, 100, 36); g.bezierCurveTo(80, 90, 40, 70, 30, 110); g.stroke();
    g.beginPath(); g.moveTo(40, 100); g.bezierCurveTo(60, 90, 90, 120, 104, 96); g.stroke();
    K.text(g, ['春風さんへ', 'おいしい！', '一番', 'ようこそ'][i % 4], w / 2, h - 20, w - 20, 13, K.F.hand, 400, '#5a4238');
  }, { key: 'sb-shikishi2-' + (i % 4) });
}
function beerPosterTex(K) {
  return K.tex.draw(200, 280, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#9cc4ea'); gr.addColorStop(1, '#f1e3b0'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = '#e9a23b'; K.rr(g, 60, 80, 80, 130, 10); g.fill();
    g.fillStyle = '#fbf6ea'; K.rr(g, 56, 64, 88, 30, 14); g.fill();
    g.strokeStyle = '#fbf6ea'; g.lineWidth = 8; g.beginPath(); g.arc(146, 140, 22, -1.2, 1.2); g.stroke();
    K.text(g, '桜川ビール', w / 2, 32, w - 20, 28, K.F.brush, 400, '#8e3b36');
    K.text(g, '生ビール', w / 2, 240, w - 20, 26, K.F.round, 900, '#3a3346');
  }, { key: 'sb-beer-poster' });
}
function waterSign(K) {
  return K.tex.draw(256, 124, (g, w, h) => {
    g.fillStyle = '#f6f1e6'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#3f7fb5'; g.lineWidth = 5; g.strokeRect(6, 6, w - 12, h - 12);
    K.text(g, '水はセルフサービスです', w / 2, h * 0.4, w - 30, 22, K.F.sans, 700, '#2f4d7a');
    K.text(g, 'ご来店ありがとうございます', w / 2, h * 0.72, w - 30, 18, K.F.sans, 500, '#3a3346');
  }, { key: 'sb-water-sign' });
}
function calTex(K) {
  return K.tex.draw(160, 224, (g, w, h) => {
    g.fillStyle = '#f5f0e6'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#e9a23b'; g.fillRect(6, 6, w - 12, 76);
    g.fillStyle = '#fdf8ee'; g.beginPath(); g.arc(w / 2, 44, 24, Math.PI, 0); g.fill();
    K.text(g, '4月', w / 2, 100, 80, 24, K.F.serif, 700, '#3a3346');
    for (let d = 1; d <= 30; d++) { const c = (d + 2) % 7, rr = Math.floor((d + 2) / 7); K.text(g, String(d), 14 + c * 22, 124 + rr * 19, 20, 12, K.F.sans, 500, c === 0 ? '#c9463e' : '#3a3346'); }
  }, { key: 'sb-ramen-cal' });
}
