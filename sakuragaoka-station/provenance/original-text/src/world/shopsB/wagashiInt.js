// E2 和菓子処 桜月堂 — interior: slanted-glass showcase with trays of individually modelled sweets,
// register counter (register, abacus, calculator, coin tray), back hutch with wrapping station,
// gift boxes & tea canisters, right-wall ceramics shelf (teapots, cups, plates on stands),
// tea cabinet + tetsubin, pendulum clock, kamidana, wooden menu tags, inner noren to a tatami
// back room (chabudai, zabuton, tansu, shoji, pendant lamp), waiting bench, umbrella stand.
import * as THREE from 'three';
import { SWEETS, lacquerTray, fillTray, tentCard, sakuraBranch } from './sweets.js';
import * as PR from './props.js';

export const TEXTS = ['桜もち', '三色だんご', 'どら焼き', '柏もち', '豆大福', 'いちご大福', '草もち', '煉羊羹', '酒まんじゅう', '練り切り', 'もなか', 'みたらし',
  '一八〇円', '一五〇円', '二〇〇円', '一六〇円', '二六〇円', '八〇〇円', '一三〇円', '二五〇円', '三〇〇円', '詰め合わせ', '御進物', '包装承ります', '桜月堂', '4月', '卯月',
  '煎茶', '玄米茶', 'ほうじ茶', '抹茶', '桜', '湯呑', '急須', '日月火水木金土', '商売繁盛', '和菓子'];

export function buildWagashiInterior(ctx, K, S, P) {
  const { FL, ZF, ZI, WT, X0, X1 } = P;
  const g = S.g, I = K.I, { T, F } = K;
  const B = (w, h, d, m, p, r) => K.box(g, w, h, d, m, p, r);
  const xi0 = X0 + WT, xi1 = X1 - WT, zi0 = ZF - WT, CH = FL + 2.62;
  const rnd = ctx.rng('sb-wagashi-int');
  const noOut = (m) => { m.castShadow = false; ctx.noOutline(m); return m; };

  const iFloor = K.im('#c9c0b0', 0.22, { map: T.tile });
  const iWall = K.im('#efe2c9', 0.3, { map: T.plaster });
  const iCeil = K.im('#b8946e', 0.26, { map: T.vboards });
  const iWood = K.im('#a57c58', 0.3, { map: T.grain });
  const iWoodL = K.im('#c29a70', 0.3, { map: T.grain });
  const iWoodDark = K.im('#6e5040', 0.28, { map: T.grain });
  const iBeam = K.im('#5a4032', 0.26, { map: T.grain });
  const glass = K.glass({ opacity: 0.1, streaks: true });
  const glassPlain = K.glass({ opacity: 0.08, streaks: false });

  // ------------------------------------------------------------------ shell: ceiling, beams, walls, doorway
  K.tbox(g, xi1 - xi0, 0.04, zi0 - ZI, iCeil, [0, CH + 0.02, (zi0 + ZI) / 2], 1.5);
  for (const z of [-2.15, -3.8]) B(xi1 - xi0, 0.12, 0.13, iBeam, [0, CH - 0.06, z]);
  const dw = { a0: 0.75, a1: 2.15, y0: FL, y1: FL + 1.95 };
  K.wall(g, iWall, { axis: 'x', a0: xi0, a1: xi1, y0: FL, y1: CH, c: ZI + 0.01, t: 0.02, holes: [dw], tile: 2.5 });
  for (const x of [xi0 + 0.01, xi1 - 0.01]) K.tbox(g, 0.02, CH - FL, zi0 - ZI, iWall, [x, (CH + FL) / 2, (zi0 + ZI) / 2], 2.5);
  K.wall(g, iWoodDark, { axis: 'x', a0: xi0, a1: xi1, y0: FL, y1: FL + 0.1, c: ZI + 0.03, t: 0.03, holes: [dw], tile: 1 });
  // left-wall wainscot (腰板) with a rail, behind the staff passage
  K.tbox(g, 0.025, 0.9, 2.95, iWoodL, [xi0 + 0.0325, FL + 0.45, -3.8], 1);
  B(0.045, 0.035, 2.95, iBeam, [xi0 + 0.04, FL + 0.915, -3.8]);
  // doorway frame (jambs, lintel, threshold)
  for (const x of [dw.a0 - 0.04, dw.a1 + 0.04]) B(0.08, 1.99, 0.16, iBeam, [x, FL + 0.995, ZI - 0.05]);
  B(dw.a1 - dw.a0 + 0.16, 0.08, 0.16, iBeam, [(dw.a0 + dw.a1) / 2, FL + 1.99, ZI - 0.05]);
  B(dw.a1 - dw.a0, 0.03, 0.18, iBeam, [(dw.a0 + dw.a1) / 2, FL + 0.015, ZI - 0.05]);
  K.noren(S, { x: (dw.a0 + dw.a1) / 2, y: FL + 1.9, z: ZI + 0.07, w: 1.32, h: 0.72, n: 2, tex: innerNorenTex(K), rodColor: '#5a4032' });

  // ------------------------------------------------------------------ showcase (slanted glass front)
  const sx0 = -2.3, sx1 = 0.75, rx1 = 1.55, szF = -2.95, szB = -3.55, baseH = 0.58, bedY = FL + 0.6, topY = FL + 1.02;
  const smid = (sx0 + sx1) / 2, slen = sx1 - sx0;
  K.tbox(g, slen, baseH, szF - szB, iWoodDark, [smid, FL + baseH / 2, (szF + szB) / 2], 1);
  B(slen, 0.07, 0.02, iBeam, [smid, FL + 0.035, szF + 0.006]);                               // plinth
  for (const y of [0.13, 0.52]) B(slen - 0.02, 0.035, 0.015, iWood, [smid, FL + y, szF + 0.006]);   // raised panel rails
  for (const x of [sx0 + 0.02, -1.28, -0.26, sx1 - 0.02]) B(0.035, 0.42, 0.015, iWood, [x, FL + 0.325, szF + 0.006]);
  B(slen - 0.04, 0.02, szF - szB - 0.04, K.im('#f2ece0', 0.45), [smid, bedY - 0.01, (szF + szB) / 2]);   // lit bed board
  const endPts = [[2.95, 0.58], [3.55, 0.58], [3.55, 1.045], [3.07, 1.045], [2.95, 0.6]];
  for (const x of [sx0 + 0.015, sx1 - 0.015]) K.extrude(g, endPts, 0.03, iWoodDark, [x, FL, 0], [0, Math.PI / 2, 0]);
  const slant = -Math.atan2(0.12, 0.42), slantL = Math.hypot(0.12, 0.42);
  noOut(B(slen - 0.03, slantL, 0.006, glass, [smid, FL + 0.81, -3.01], [slant, 0, 0]));
  noOut(B(slen - 0.03, 0.006, 0.47, glass, [smid, topY + 0.004, -3.31]));
  for (const x of [-1.28, -0.26]) B(0.018, slantL, 0.018, iWoodDark, [x, FL + 0.81, -3.01], [slant, 0, 0]);
  B(slen, 0.03, 0.03, iWoodDark, [smid, topY + 0.01, -3.07]);
  B(slen, 0.035, 0.035, iWoodDark, [smid, topY + 0.01, szB + 0.018]);
  B(slen, 0.03, 0.03, iWoodDark, [smid, bedY + 0.005, szF - 0.004]);
  // staff-side sliding glass doors
  for (let i = 0; i < 4; i++) {
    const pw = slen / 4 + 0.03, px = sx0 + slen / 4 * (i + 0.5);
    const pnl = K.panel(g, { w: pw, h: topY - bedY - 0.02, d: 0.018, frame: iWoodDark, glass: glassPlain, stile: 0.025, top: 0.025, bottom: 0.03 });
    const pz = szB + 0.025 + (i % 2) * 0.02;
    pnl.position.set(px, bedY, pz);
    B(0.05, 0.02, 0.006, iBeam, [px + (i % 2 ? -1 : 1) * (pw / 2 - 0.06), bedY + 0.2, pz - 0.012]);
  }
  B(slen - 0.1, 0.016, 0.03, K.lamp(1.3, '#fff3dc'), [smid, topY - 0.02, -3.47]);
  // upper glass tier on brackets
  const tierY = FL + 0.8, tierZ = -3.4;
  noOut(B(slen - 0.06, 0.008, 0.17, glassPlain, [smid, tierY - 0.004, tierZ]));
  for (const x of [sx0 + 0.08, -1.33, -1.23, -0.31, -0.21, sx1 - 0.08]) { I.add('box', g, [x, bedY, tierZ + 0.05], [0.012, tierY - bedY - 0.008, 0.012], '#b9bfc4'); I.add('box', g, [x, tierY - 0.012, tierZ], [0.012, 0.008, 0.16], '#b9bfc4'); }
  // trays of sweets (3 bays × 2 trays)
  const bays = [(sx0 + 0.02 - 1.29) / 2, (-1.27 - 0.27) / 2, (-0.25 + sx1 - 0.02) / 2];
  const trayZ = -3.16, trayW = 0.44, trayD = 0.24;
  const trays = [
    { kind: 'sakura', cols: 5, rows: 3, col: '#7a2e2e' }, { kind: 'dango', cols: 3, rows: 4, col: '#3a2a2e', mix: ['sanshoku', 'sanshoku', 'mitarashi', 'an'] },
    { kind: 'dora', cols: 4, rows: 2, col: '#7a2e2e' }, { kind: 'manju', cols: 6, rows: 3, col: '#3a2a2e' },
    { kind: 'daifuku', cols: 6, rows: 3, col: '#7a2e2e', split: 'ichigo' }, { kind: 'kashiwa', cols: 4, rows: 2, col: '#3a2a2e', split: 'kusa' },
  ];
  const cardTex = (a, b, bg = '#fbf6ea') => K.card([a, b], { w: 128, h: 72, font: F.serif, size0: 26, size1: 22, fg: '#4a2e2a', fg2: '#a33a36', bg });
  trays.forEach((t, i) => {
    const tx = bays[Math.floor(i / 2)] + (i % 2 ? 0.245 : -0.245);
    const y = lacquerTray(g, K, tx, bedY, trayZ, trayW, trayD, t.col);
    const w = trayW - 0.06, d = trayD - 0.05;
    if (t.kind === 'dango') {
      for (let r = 0; r < t.rows; r++) for (let c = 0; c < t.cols; c++) SWEETS.dango(g, K, tx - w / 2 + w * (c + 0.5) / t.cols, y, trayZ - d / 2 + d * (r + 0.5) / t.rows, rnd.range(-0.05, 0.05), t.mix[r]);
    } else if (t.kind === 'manju') {
      for (let r = 0; r < t.rows; r++) for (let c = 0; c < t.cols; c++) SWEETS.manju(g, K, tx - w / 2 + w * (c + 0.5) / t.cols, y, trayZ - d / 2 + d * (r + 0.5) / t.rows, 0, c >= 3);
    } else if (t.split) {
      const hw = w / 2;
      fillTray(g, K, t.kind, tx - hw / 2, y, trayZ, hw, d, t.cols / 2, t.rows, rnd);
      fillTray(g, K, t.split, tx + hw / 2, y, trayZ, hw, d, t.cols / 2, t.rows, rnd);
      I.add('box', g, [tx, y, trayZ], [0.006, 0.012, d], '#6f8a4a');                       // bamboo-leaf divider (baran)
    } else fillTray(g, K, t.kind, tx, y, trayZ, w, d, t.cols, t.rows, rnd);
    const names = { sakura: ['桜もち', '一八〇円'], dango: ['三色だんご', '一五〇円'], dora: ['どら焼き', '二〇〇円'], manju: ['酒まんじゅう', '一三〇円'], daifuku: ['豆大福', '一八〇円'], kashiwa: ['柏もち', '一六〇円'] };
    tentCard(g, K, tx - (t.split ? 0.1 : 0), bedY, -2.998, 0, cardTex(...names[t.kind], t.kind === 'sakura' ? '#fbe6ec' : '#fbf6ea'));
    if (t.split) tentCard(g, K, tx + 0.12, bedY, -2.998, 0, cardTex(...({ ichigo: ['いちご大福', '二六〇円'], kusa: ['草もち', '一六〇円'] })[t.split]));
  });
  // upper tier: yokan bars, sliced yokan, boxed assortments, monaka, nerikiri on dishes
  ['neri', 'sakura', 'matcha'].forEach((k, i) => SWEETS.yokan(g, K, bays[0] - 0.33 + i * 0.22, tierY, tierZ, 0, k));
  SWEETS.yokanSlices(g, K, bays[0] + 0.36, tierY, tierZ, 0.2);
  for (let i = 0; i < 2; i++) giftBox(g, K, bays[1] - 0.3 + i * 0.26, tierY, tierZ, 0.22, 0.05, 0.15, i + 2, 0);
  for (let i = 0; i < 4; i++) SWEETS.monaka(g, K, bays[1] + 0.16 + (i % 2) * 0.08, tierY, tierZ - 0.04 + Math.floor(i / 2) * 0.08, 0.3 * i);
  ['#f6c3d2', '#f4efe4', '#cfe0b0', '#f6c3d2'].forEach((c, i) => { const x = bays[2] - 0.33 + i * 0.22; I.add('dish', g, [x, tierY, tierZ], [0.1, 0.1, 0.1], '#e9e4d8'); SWEETS.nerikiri(g, K, x, tierY + 0.006, tierZ, i * 0.4, c); });
  tentCard(g, K, bays[0], tierY, tierZ + 0.075, 0, cardTex('煉羊羹', '八〇〇円'));
  tentCard(g, K, bays[2], tierY, tierZ + 0.075, 0, cardTex('練り切り', '二五〇円', '#fbe6ec'));
  sakuraBranch(g, K, -2.12, topY + 0.01, -3.3, 0.42, rnd);

  // ------------------------------------------------------------------ register counter (right end of the case)
  K.tbox(g, rx1 - sx1, 0.88, szF - szB, iWoodDark, [(sx1 + rx1) / 2, FL + 0.44, (szF + szB) / 2], 1);
  B(rx1 - sx1 + 0.04, 0.035, szF - szB + 0.05, iWoodL, [(sx1 + rx1) / 2, FL + 0.8975, (szF + szB) / 2 + 0.005]);
  B(rx1 - sx1, 0.07, 0.02, iBeam, [(sx1 + rx1) / 2, FL + 0.035, szF + 0.006]);
  for (const y of [0.13, 0.8]) B(rx1 - sx1 - 0.04, 0.035, 0.015, iWood, [(sx1 + rx1) / 2, FL + y, szF + 0.006]);
  const cTop = FL + 0.915;
  PR.register(g, K, 1.2, cTop, -3.31, Math.PI, { color: '#d6ccb8' });
  PR.calculator(g, K, 0.9, cTop, -3.4, Math.PI + 0.15);
  PR.abacus(g, K, 1.22, cTop, -3.02, 0.04);
  I.add('box', g, [0.9, cTop, -3.08], [0.15, 0.012, 0.1], '#3f5f8e');                          // coin tray (カルトン)
  for (let i = 0; i < 3; i++) I.add('disc', g, [0.87 + i * 0.03, cTop + 0.012, -3.08 + (i % 2) * 0.02], [0.022, 0.003, 0.022], i ? '#c9ccd0' : '#d1ad5c');
  K.plane(g, 0.3, 0.12, K.im('#ffffff', 0.35, { map: K.card(['包装承ります', 'ご贈答に'], { w: 256, h: 104, font: F.brush, size0: 40, size1: 26, bg: '#f4ead8', fg: '#6b2e2a', fg2: '#3a3346' }) }), [1.15, FL + 0.5, szF + 0.016]);

  // ------------------------------------------------------------------ back hutch (水屋): cabinet + wrapping counter + open shelves
  const hx0 = -3.25, hx1 = 0.45, hzB = ZI + 0.02, hzF = -4.8, hcH = 0.85, hmid = (hx0 + hx1) / 2;
  K.tbox(g, hx1 - hx0, hcH, hzF - hzB, iWoodDark, [hmid, FL + hcH / 2, (hzF + hzB) / 2], 1);
  B(hx1 - hx0 + 0.04, 0.035, hzF - hzB + 0.04, iWoodL, [hmid, FL + hcH + 0.0175, (hzF + hzB) / 2 + 0.01]);
  for (let i = 0; i < 4; i++) {
    const pw = (hx1 - hx0) / 4, px = hx0 + pw * (i + 0.5), pz = hzF + (i % 2 ? 0.004 : 0.013);
    B(pw + 0.01, hcH - 0.13, 0.012, iWood, [px, FL + 0.075 + (hcH - 0.13) / 2, pz]);
    B(0.035, 0.09, 0.006, iBeam, [px + (i % 2 ? -1 : 1) * (pw / 2 - 0.08), FL + 0.5, pz + 0.008]);
  }
  const hTop = FL + hcH + 0.035;
  for (const x of [hx0 + 0.02, hmid, hx1 - 0.02]) B(0.04, 2.1 - hcH - 0.035, 0.3, iWoodDark, [x, (hTop + FL + 2.1) / 2, hzB + 0.15]);
  const hLv = [1.28, 1.66, 2.07];
  for (const y of hLv) B(hx1 - hx0, 0.03, 0.3, iWood, [hmid, FL + y - 0.015, hzB + 0.15]);
  // wrapping station on the counter
  {
    const wx = -2.7;
    for (const s of [-1, 1]) B(0.03, 0.2, 0.2, iBeam, [wx + s * 0.34, hTop + 0.1, -4.98]);
    K.cylX(g, 0.055, 0.64, K.im('#f2c9d3', 0.35), [wx, hTop + 0.14, -4.98], 16);
    K.cylX(g, 0.012, 0.72, K.im('#8d949b', 0.3), [wx, hTop + 0.14, -4.98], 6);
    B(0.62, 0.002, 0.15, K.im('#f2c9d3', 0.35), [wx, hTop + 0.001, -4.9]);                      // sheet pulled out
    for (let i = 0; i < 6; i++) I.add('box', g, [-2.0 + rnd.range(-0.01, 0.01), hTop + i * 0.012, -4.98], [0.36, 0.011, 0.26], i % 2 ? '#efe6d2' : '#e8dcc2', [0, rnd.range(-0.04, 0.04), 0]); // flat boxes
    for (let i = 0; i < 8; i++) I.add('box', g, [-1.1, hTop + i * 0.006, -4.98], [0.26, 0.005, 0.34], '#f1e8d6', [0, 0.02 * (i % 3), 0]);   // paper bags
    const hdl = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.004, 4, 10, Math.PI), K.im('#b8423c', 0.3)); hdl.position.set(-1.1, hTop + 0.05, -4.84); hdl.rotation.x = -Math.PI / 2; g.add(hdl);
    K.cyl(g, 0.045, 0.06, K.im('#e9e2d0', 0.3), [-0.78, hTop + 0.03, -4.96], 12);               // string spool
    K.cyl(g, 0.047, 0.012, K.im('#c9463e', 0.3), [-0.78, hTop + 0.035, -4.96], 12);
    K.cyl(g, 0.015, 0.08, K.im('#6e5040', 0.3), [-0.78, hTop + 0.04, -4.96], 6);
    const tape = PR.grp(g, -0.52, hTop, -4.95, 0.3);                                             // tape dispenser
    K.rboxR(tape, 0.14, 0.06, 0.06, 0.015, K.im('#4f5a60', 0.25), [0, 0.03, 0]);
    K.cyl(tape, 0.035, 0.02, K.im('#e9e2cf', 0.4), [0, 0.07, 0], 12, [0, 0, Math.PI / 2]);
    const sc = PR.grp(g, -0.26, hTop + 0.004, -4.9, 0.6);                                        // scissors
    for (const s of [-1, 1]) { K.box(sc, 0.12, 0.004, 0.012, K.im('#c9ccd0', 0.35), [0.04, 0, 0], [0, s * 0.12, 0]); const r = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.006, 4, 10), K.im('#c9463e', 0.3)); r.rotation.x = Math.PI / 2; r.position.set(-0.04, 0, s * 0.02); sc.add(r); }
    for (let i = 0; i < 6; i++) { const px = 0.02 + (i % 3) * 0.13, pz = -5.08 + Math.floor(i / 3) * 0.14; I.add('box', g, [px, hTop, pz], [0.12, 0.004, 0.1], '#6a8a58'); for (let k = 0; k < 2; k++) SWEETS.sakura(g, K, px - 0.025 + k * 0.05, hTop + 0.004, pz, 0.1); const lid = B(0.12, 0.04, 0.1, K.glass({ opacity: 0.14, streaks: false }), [px, hTop + 0.024, pz]); noOut(lid); }
  }
  // upper shelves: gift boxes, tea canisters, furoshiki bundles
  for (let i = 0; i < 5; i++) giftBox(g, K, -3.05 + i * 0.34, FL + hLv[0], -5.12, 0.28, 0.08 + (i % 2) * 0.03, 0.22, i, 0);
  for (let i = 0; i < 4; i++) giftBox(g, K, -3.02 + i * 0.36, FL + hLv[0] + 0.09 + (i % 2) * 0.03, -5.12, 0.25, 0.06, 0.19, i + 3, 0.04 * (i % 2 ? 1 : -1));
  for (let i = 0; i < 6; i++) teaCan(g, K, -1.25 + i * 0.27, FL + hLv[0], -5.13, i);
  for (let i = 0; i < 4; i++) giftBox(g, K, -3.0 + i * 0.38, FL + hLv[1], -5.12, 0.32, 0.12, 0.24, i + 6, 0.02 * i);
  for (let i = 0; i < 3; i++) furoshiki(g, K, -1.1 + i * 0.45, FL + hLv[1], -5.12, ['#3f4f7e', '#b8423c', '#6f8a5a'][i]);
  for (let i = 0; i < 8; i++) giftBox(g, K, (i < 4 ? -3.05 : -2.78) + i * 0.4, FL + hLv[2], -5.12, 0.3, 0.07 + (i % 3) * 0.02, 0.22, i + 9, 0);
  S.box(hx0, ZI, hx1, hzF, FL, FL + 2.1);
  K.plane(g, 1.4, 0.32, K.im('#ffffff', 0.3, { map: gakuTex(K) }), [-1.4, FL + 2.37, ZI + 0.034]);         // framed name board (扁額)
  B(1.48, 0.4, 0.02, iBeam, [-1.4, FL + 2.37, ZI + 0.02]);

  // ------------------------------------------------------------------ left wall: menu tags, kamidana, calendar
  {
    const wg = PR.grp(g, xi0 + 0.02, 0, 0, Math.PI / 2);      // wall frame: local x = -world z, front +x
    B(0.035, 0.04, 1.75, iBeam, [xi0 + 0.035, FL + 2.33, -3.1]);
    const tags = [['桜もち', '一八〇円'], ['三色だんご', '一五〇円'], ['どら焼き', '二〇〇円'], ['柏もち', '一六〇円'], ['豆大福', '一八〇円'], ['いちご大福', '二六〇円'], ['草もち', '一六〇円'], ['煉羊羹', '八〇〇円']];
    tags.forEach(([a, b], i) => {
      const lx = 2.35 + i * 0.2;                                   // local x → world z = -lx
      K.box(wg, 0.16, 0.42, 0.014, iWoodL, [lx, FL + 2.1, 0.02], [0, 0, 0.01 * (i % 3 - 1)]);
      K.plane(wg, 0.145, 0.4, K.im('#ffffff', 0.34, { map: tagTex(K, a, b, i === 0) }), [lx, FL + 2.1, 0.0275], 0).rotation.z = 0.01 * (i % 3 - 1);
      K.cyl(wg, 0.004, 0.03, K.im('#8d949b', 0.3), [lx, FL + 2.325, 0.03], 5);
    });
    PR.kamidana(wg, K, 4.45, FL + 2.2, 0, 0, 0.8);
    PR.calendar(wg, K, 4.45, FL + 1.42, 0.005, 0, calendarTex(K), 0.34, 0.5);
  }

  // ------------------------------------------------------------------ right wall: ceramics & tea shelf
  {
    const sg = PR.shelfUnit(g, K, xi1 - 0.025, FL, -2.9, -Math.PI / 2, 2.6, 0.42, 1.9, [0.46, 0.92, 1.38], { mat: iWood, dark: iWoodDark });
    // L0: big paulownia gift boxes (桐箱)
    for (let i = 0; i < 4; i++) { const x = -0.9 + i * 0.6; I.add('box', sg, [x, 0.08, 0.21], [0.42, 0.16, 0.3], '#e3cfa8'); I.add('box', sg, [x, 0.24, 0.21], [0.43, 0.025, 0.31], '#d9c296'); I.add('box', sg, [x, 0.08, 0.21], [0.02, 0.19, 0.312], '#6a8a58'); }
    // L1: plates on stands + yunomi pairs in open boxes
    for (let i = 0; i < 3; i++) plateOnStand(sg, K, -0.95 + i * 0.36, 0.46, 0.2, ['#6b86a8', '#c8a27a', '#b7c7c9'][i]);
    for (let i = 0; i < 2; i++) {
      const x = 0.28 + i * 0.44;
      I.add('box', sg, [x, 0.46, 0.22], [0.34, 0.012, 0.2], '#f2ecdf');
      for (const s of [-1, 1]) { I.add('box', sg, [x, 0.46, 0.22 + s * 0.094], [0.34, 0.07, 0.012], '#e3cfa8'); I.add('box', sg, [x + s * 0.164, 0.46, 0.22], [0.012, 0.07, 0.176], '#e3cfa8'); }
      for (const dz of [-0.08, 0.08]) PR.yunomi(sg, K, x + dz, 0.47, 0.22, i ? '#8aa39a' : '#c9a07a', 0.085, 0.034);
      I.add('box', sg, [x, 0.53, 0.06], [0.35, 0.012, 0.21], '#d9c296', [1.2, 0, 0]);          // lid leaning at the back
    }
    // L2: kyusu teapots + price cards
    ['#8a5a44', '#6f7f5a', '#b7c7c9', '#4f5a78'].forEach((c, i) => { const x = -1.0 + i * 0.6; PR.kyusu(sg, K, x, 0.92, 0.22, -0.5 + i * 0.2, c); PR.yunomi(sg, K, x + 0.2, 0.92, 0.26, c, 0.07, 0.03); K.plane(sg, 0.1, 0.055, K.im('#ffffff', 0.35, { map: K.card(['急須', ['二八〇〇円', '三二〇〇円', '二五〇〇円', '四五〇〇円'][i]], { w: 128, h: 72, font: F.serif, fg: '#3a3346', fg2: '#a33a36' }) }), [x, 0.95, 0.415], 0, -0.2); });
    // L3: tea canisters + standing tea packs
    for (let i = 0; i < 7; i++) teaCan(sg, K, -1.1 + i * 0.2, 1.38, 0.22, i + 1);
    for (let i = 0; i < 5; i++) I.add('pillow', sg, [0.36 + i * 0.17, 1.38, 0.2], [0.13, 0.2, 0.05], ['#6f9a6a', '#c98aa0', '#9a6a48', '#7fa36b', '#3e4d78'][i]);
    K.plane(sg, 0.36, 0.1, K.im('#ffffff', 0.35, { map: K.card(['煎茶 ・ ほうじ茶', '玄米茶 ・ 抹茶'], { w: 256, h: 72, font: F.serif, fg: '#3a3346', fg2: '#3f6a4a' }) }), [0.7, 1.43, 0.425], 0, -0.1);
    // top: large bowls & a vase
    for (let i = 0; i < 3; i++) I.add('bowl', sg, [-0.8 + i * 0.5, 1.9, 0.2], [0.24, 0.2, 0.24], ['#c8a27a', '#6b86a8', '#e9e4d8'][i]);
    K.plane(g, 0.34, 0.2, K.im('#ffffff', 0.3, { map: K.card(['お茶', '器'], { w: 192, h: 112, font: F.brush, bg: '#efe6d2', size0: 44, size1: 38, fg: '#3a3346', fg2: '#3a3346' }) }), [xi1 - 0.026, FL + 2.2, -2.9], -Math.PI / 2);
    S.box(xi1 - 0.44, -4.2, xi1, -1.6, FL, FL + 1.95);
  }

  // ------------------------------------------------------------------ tea cabinet (茶箪笥) + tetsubin, pendulum clock
  {
    const cg = PR.grp(g, 2.88, FL, ZI + 0.02, 0);
    K.tbox(cg, 0.9, 0.5, 0.42, iWoodDark, [0, 0.25, 0.21], 1);                                   // drawer base
    K.tbox(cg, 0.9, 0.62, 0.02, iWoodDark, [0, 0.81, 0.01], 1);                                  // back
    for (const s of [-1, 1]) K.tbox(cg, 0.025, 0.62, 0.42, iWoodDark, [s * 0.4375, 0.81, 0.21], 1);
    K.box(cg, 0.94, 0.035, 0.45, iWoodL, [0, 1.1375, 0.215]);
    K.box(cg, 0.85, 0.02, 0.38, iWood, [0, 0.83, 0.2]);                                           // inner shelf
    for (const s of [-1, 1]) { const pnl = K.panel(cg, { w: 0.44, h: 0.6, d: 0.018, frame: iBeam, glass: glassPlain, stile: 0.025, top: 0.025, bottom: 0.03 }); pnl.position.set(s * 0.215, 0.505, 0.415 + (s > 0 ? 0 : 0.02)); }
    for (let i = 0; i < 2; i++) { K.box(cg, 0.86, 0.2, 0.012, iWood, [0, 0.13 + i * 0.23, 0.426]); K.box(cg, 0.1, 0.02, 0.02, K.im('#c9a45a', 0.35), [0, 0.19 + i * 0.23, 0.44]); }
    for (let i = 0; i < 3; i++) PR.yunomi(cg, K, -0.3 + i * 0.12, 0.5, 0.2, ['#c9a07a', '#8aa39a', '#e9e4d8'][i], 0.08, 0.03);
    for (let k = 0; k < 4; k++) I.add('dish', cg, [0.22, 0.5 + k * 0.014, 0.2], [0.2, 0.1, 0.2], '#e9e4d8');
    PR.kyusu(cg, K, -0.2, 0.84, 0.2, 0.4, '#6f7f5a');
    for (let i = 0; i < 3; i++) I.add('bowl', cg, [0.15 + i * 0.1, 0.84, 0.18], [0.09, 0.07, 0.09], ['#b7c7c9', '#c8a27a', '#e9e4d8'][i]);
    // tetsubin kettle + tray
    I.add('box', cg, [0.05, 1.155, 0.22], [0.36, 0.015, 0.26], '#7a4a38');
    K.lathe(cg, [[0, 0], [0.07, 0], [0.095, 0.03], [0.1, 0.07], [0.085, 0.11], [0.04, 0.125], [0, 0.125]], K.im('#3f3a3c', 0.18), [0.0, 1.17, 0.22], 16);
    const hd = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.008, 5, 16, Math.PI), K.im('#3f3a3c', 0.18)); hd.position.set(0, 1.3, 0.22); cg.add(hd);
    PR.tube(cg, [0.08, 1.23, 0.22], [0.15, 1.28, 0.22], 0.012, K.im('#3f3a3c', 0.18), 6);
    PR.yunomi(cg, K, 0.17, 1.17, 0.26, '#8aa39a', 0.07, 0.028);
    S.box(2.42, ZI, xi1, ZI + 0.46, FL, FL + 1.2);
    PR.pendulumClock(g, K, 2.82, FL + 1.85, ZI + 0.02, 0);
  }

  // ------------------------------------------------------------------ customer side: waiting bench, umbrella stand, entrance mat
  {
    const bg = PR.grp(g, 2.28, FL, -1.62, 0);
    const len = 1.1, dep = 0.36, sh = 0.42;
    for (const sx of [-len / 2 + 0.08, len / 2 - 0.08]) for (const sz of [-dep / 2 + 0.05, dep / 2 - 0.05]) K.box(bg, 0.05, sh - 0.04, 0.05, iWoodDark, [sx, (sh - 0.04) / 2, sz]);
    for (const sx of [-len / 2 + 0.08, len / 2 - 0.08]) K.box(bg, 0.04, 0.04, dep - 0.08, iWoodDark, [sx, 0.1, 0]);
    K.tbox(bg, len, 0.04, dep, iWood, [0, sh - 0.02, 0], 1);
    K.box(bg, len + 0.03, 0.012, dep + 0.03, K.im('#cf5048', 0.3), [0, sh + 0.006, 0]);
    K.box(bg, len + 0.03, 0.1, 0.01, K.im('#cf5048', 0.3), [0, sh - 0.045, dep / 2 + 0.018]);
    I.add('box', bg, [-0.22, sh + 0.012, 0.02], [0.28, 0.016, 0.18], '#6a3e30');
    PR.yunomi(bg, K, -0.3, sh + 0.028, 0.03, '#8aa39a', 0.07, 0.028);
    I.add('dish', bg, [-0.15, sh + 0.028, 0.02], [0.1, 0.1, 0.1], '#e9e4d8');
    SWEETS.sakura(bg, K, -0.15, sh + 0.034, 0.02, 0.4);
    S.box(1.7, -1.82, 2.86, -1.42, FL, FL + 0.46);
  }
  PR.umbrellaStand(g, K, -0.62, FL, -1.58);
  S.cyl(-0.62, -1.58, 0.14, FL, FL + 0.6);
  I.add('rbox', g, [0.25, FL, -1.72], [1.1, 0.012, 0.5], '#8a6a4e');                       // coir entrance mat
  I.add('rbox', g, [0.25, FL + 0.002, -1.72], [0.98, 0.011, 0.4], '#a8865e');

  // ------------------------------------------------------------------ lights
  PR.pendant(S, K, -1.3, CH, FL + 2.02, -2.45);
  PR.pendant(S, K, 0.45, CH, FL + 2.02, -2.45);
  PR.pendant(S, K, -1.2, CH, FL + 2.12, -4.25, { kind: 'shade', color: '#e8d9b8' });
  for (const x of [-1.3, 0.45]) K.lightPool(g, x, FL + 0.012, -2.35, 2.0, 1.8, { opacity: 0.2 });
  K.lightPool(g, -1.2, FL + 0.012, -4.2, 2.2, 1.3, { opacity: 0.16 });
  K.lightPool(g, -1.4, FL + 1.5, ZI + 0.035, 3.2, 1.6, { rotX: 0, opacity: 0.12 });

  // ------------------------------------------------------------------ colliders
  S.box(sx0, szB, rx1, szF, FL, FL + 1.05);

  buildBackRoom(ctx, K, S, { FL, ZI, dw });
}

// ============================================================================ tatami back room (glimpse)
function buildBackRoom(ctx, K, S, { FL, ZI, dw }) {
  const g = S.g, I = K.I, { T } = K;
  const B = (w, h, d, m, p, r) => K.box(g, w, h, d, m, p, r);
  const rnd = ctx.rng('sb-wagashi-room');
  const rw = K.im('#eadcc0', 0.32, { map: T.plaster }), rc = K.im('#b8946e', 0.28, { map: T.vboards });
  const beam = K.im('#5a4032', 0.26, { map: T.grain }), board = K.im('#9a7654', 0.3, { map: T.grain });
  const x0 = 0.32, x1 = 3.3, zb = -8.02, top = FL + 0.36, RH = FL + 2.45, cx = (x0 + x1) / 2;
  for (const x of [x0 - 0.02, x1 + 0.02]) K.tbox(g, 0.04, RH - FL, ZI - zb, rw, [x, (RH + FL) / 2, (ZI + zb) / 2], 2.5);
  K.tbox(g, x1 - x0 + 0.08, RH - FL, 0.04, rw, [cx, (RH + FL) / 2, zb], 2.5);
  K.tbox(g, x1 - x0 + 0.08, 0.04, ZI - zb, rc, [cx, RH + 0.02, (ZI + zb) / 2], 1.5);
  B(x1 - x0, 0.1, 0.1, beam, [cx, RH - 0.05, -7.25]);
  // doma strip + stone step + slippers
  K.tbox(g, x1 - x0, 0.03, 0.3, K.im('#c9c0b0', 0.22, { map: T.tile }), [cx, FL - 0.015, ZI - 0.15], 2.4);
  K.tbox(g, 0.62, 0.16, 0.24, K.im('#a9a59c', 0.25, { map: T.concrete }), [(dw.a0 + dw.a1) / 2, FL + 0.08, ZI - 0.16], 1);
  for (const dx of [-0.08, 0.08]) { I.add('rbox', g, [(dw.a0 + dw.a1) / 2 + dx, FL + 0.16, ZI - 0.16], [0.1, 0.025, 0.24], '#6f7fa6', [0, dx * 1.5, 0]); I.add('box', g, [(dw.a0 + dw.a1) / 2 + dx, FL + 0.18, ZI - 0.11], [0.09, 0.012, 0.07], '#586890', [0, dx * 1.5, 0]); }
  // raised floor + 上がり框
  K.tbox(g, x1 - x0, 0.33, -5.6 - zb, K.im('#6e5040', 0.26, { map: T.grain }), [cx, FL + 0.165, (-5.6 + zb) / 2], 1);
  B(x1 - x0, 0.1, 0.1, beam, [cx, top - 0.05, -5.6]);
  // tatami mats (1.8 × 0.9) with heri borders + wooden boards
  const tm = K.im('#cdc38c', 0.3, { map: tatamiTex(K) }), heri = K.im('#3f4a3a', 0.2);
  const mat = (ax0, ax1, az0, az1, alongX) => {
    K.tbox(g, ax1 - ax0 - 0.004, 0.03, az0 - az1 - 0.004, tm, [(ax0 + ax1) / 2, top - 0.015, (az0 + az1) / 2], 0.9);
    if (alongX) for (const z of [az0 - 0.014, az1 + 0.014]) B(ax1 - ax0 - 0.004, 0.006, 0.028, heri, [(ax0 + ax1) / 2, top + 0.001, z]);
    else for (const x of [ax0 + 0.014, ax1 - 0.014]) B(0.028, 0.006, az0 - az1 - 0.004, heri, [x, top + 0.001, (az0 + az1) / 2]);
  };
  mat(x0 + 0.02, x0 + 1.82, -5.65, -6.55, true);
  mat(x0 + 0.02, x0 + 1.82, -6.55, -7.45, true);
  mat(x0 + 1.82, x0 + 2.72, -5.65, -7.45, false);
  K.tbox(g, x1 - (x0 + 2.72), 0.03, 1.8, board, [(x1 + x0 + 2.72) / 2, top - 0.015, -6.55], 1);
  K.tbox(g, x1 - x0, 0.03, -7.45 - zb, board, [cx, top - 0.015, (-7.45 + zb) / 2], 1);
  // chabudai with tea, mikan, sweets, newspaper
  const tx = 1.24, tz = -6.55;
  PR.chabudai(g, K, tx, top, tz, 0.38, 0.33);
  const ty = top + 0.33;
  PR.kyusu(g, K, tx - 0.16, ty, tz + 0.07, 0.6, '#8a5a44');
  PR.yunomi(g, K, tx + 0.14, ty, tz + 0.13, '#8aa39a', 0.07, 0.028);
  PR.yunomi(g, K, tx + 0.06, ty, tz - 0.17, '#c9a07a', 0.07, 0.028);
  I.add('dish', g, [tx + 0.21, ty, tz - 0.07], [0.16, 0.2, 0.16], '#e9e4d8');
  for (let i = 0; i < 4; i++) I.add('sph', g, [tx + 0.21 + [-0.03, 0.03, 0, 0.0][i], ty + 0.03 + (i === 3 ? 0.035 : 0), tz - 0.07 + [0.02, 0.02, -0.03, 0][i]], [0.058, 0.05, 0.058], '#eb9a3a');
  I.add('dish', g, [tx - 0.18, ty, tz - 0.16], [0.12, 0.1, 0.12], '#6b86a8');
  SWEETS.sakura(g, K, tx - 0.2, ty + 0.006, tz - 0.16, 0.3); SWEETS.sakura(g, K, tx - 0.15, ty + 0.006, tz - 0.15, -0.2);
  I.add('box', g, [tx + 0.02, ty, tz + 0.24], [0.26, 0.008, 0.18], '#ece8dc', [0, 0.35, 0]);
  PR.zabuton(g, K, tx, top, tz + 0.58, 0, '#8e3b56');
  PR.zabuton(g, K, tx, top, tz - 0.58, 0.1, '#8e3b56');
  PR.zabuton(g, K, tx + 0.78, top, tz, Math.PI / 2, '#5f6f8e');
  // tansu with radio, photo frame and a sakura branch
  {
    const tg = PR.grp(g, 0.92, top, zb + 0.02, 0);
    const tw = K.im('#8a5a3a', 0.3, { map: T.grain });
    K.tbox(tg, 0.9, 0.9, 0.4, tw, [0, 0.45, 0.2], 1);
    K.box(tg, 0.94, 0.03, 0.42, K.im('#6e4632', 0.28), [0, 0.915, 0.21]);
    const rows = [[0.12, 1], [0.34, 2], [0.56, 2], [0.77, 1]];
    for (const [y, n] of rows) for (let i = 0; i < n; i++) {
      const w = 0.86 / n, dx = -0.43 + w * (i + 0.5);
      K.box(tg, w - 0.02, 0.19, 0.012, K.im('#9a6a44', 0.3, { map: T.grain }), [dx, y, 0.405]);
      I.add('box', tg, [dx, y - 0.005, 0.415], [0.08, 0.012, 0.012], '#3f3a3c');
      for (const s of [-1, 1]) I.add('box', tg, [dx + s * 0.045, y - 0.012, 0.413], [0.012, 0.025, 0.008], '#3f3a3c');
    }
    PR.radio(tg, K, -0.22, 0.93, 0.22, 0.2, '#6f8a9a');
    const fr = PR.grp(tg, 0.12, 0.93, 0.2, -0.2);
    K.box(fr, 0.16, 0.2, 0.015, K.im('#6e4632', 0.28), [0, 0.1, 0], [-0.12, 0, 0]);
    K.plane(fr, 0.12, 0.155, K.im('#ffffff', 0.35, { map: photoTex(K) }), [0, 0.1, 0.009], 0, -0.12);
    sakuraBranch(tg, K, 0.33, 0.93, 0.2, 0.38, rnd, '#e9e4d8');
  }
  // shoji window on the back wall (lit paper, modelled kumiko)
  {
    const wx0 = 1.75, wx1 = 3.15, wy0 = FL + 1.0, wy1 = FL + 1.95, wz = zb + 0.025;
    K.box(g, wx1 - wx0, wy1 - wy0, 0.01, K.lamp(0.95, '#f6ecd6'), [(wx0 + wx1) / 2, (wy0 + wy1) / 2, wz]);
    const kw = K.im('#c9a67a', 0.35);
    for (const x of [wx0, wx1]) B(0.04, wy1 - wy0 + 0.04, 0.05, beam, [x, (wy0 + wy1) / 2, wz + 0.01]);
    for (const y of [wy0, wy1]) B(wx1 - wx0 + 0.04, 0.04, 0.05, beam, [(wx0 + wx1) / 2, y, wz + 0.01]);
    for (let i = 1; i < 6; i++) I.add('boxc', g, [wx0 + (wx1 - wx0) * i / 6, (wy0 + wy1) / 2, wz + 0.012], [0.012, wy1 - wy0, 0.014], '#c9a67a');
    for (let j = 1; j < 5; j++) I.add('boxc', g, [(wx0 + wx1) / 2, wy0 + (wy1 - wy0) * j / 5, wz + 0.012], [wx1 - wx0, 0.012, 0.014], '#c9a67a');
    B(0.03, wy1 - wy0, 0.03, kw, [(wx0 + wx1) / 2, (wy0 + wy1) / 2, wz + 0.02]);
  }
  PR.calendar(PR.grp(g, x0, 0, 0, Math.PI / 2), K, 6.95, FL + 1.5, 0.0, 0, calendarTex(K), 0.3, 0.44);
  PR.pendant(S, K, tx, RH, FL + 1.78, tz, { kind: 'shade', color: '#efe3c4', pullCord: true });
  K.lightPool(g, tx, ty + 0.002, tz, 1.0, 1.0, { opacity: 0.2 });
  K.lightPool(g, tx, top + 0.004, tz, 2.6, 2.4, { opacity: 0.16 });
}

// ============================================================================ goods
const WRAP = [['#f3c9d4', '#e28ea8'], ['#dfe8cf', '#7fa36b'], ['#efe2c8', '#c08a54'], ['#d7dfea', '#6b86a8'], ['#f5e6c8', '#d9a441'], ['#ecd3dd', '#b56a86']];
function wrapTex(K, i) {
  const [bg, fg] = WRAP[i % WRAP.length];
  return K.tex.draw(128, 128, (g, w, h) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    for (let a = 0; a < 5; a++) for (let b = 0; b < 5; b++) flower(g, a * 28 + (b % 2) * 14, b * 28, 5, fg);
  }, { key: 'sb-wrap2-' + (i % WRAP.length) });
}
function flower(g, x, y, r, col) {
  g.fillStyle = col;
  for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2 - Math.PI / 2; g.beginPath(); g.ellipse(x + Math.cos(a) * r, y + Math.sin(a) * r, r * 0.75, r * 0.55, a, 0, 7); g.fill(); }
  g.fillStyle = 'rgba(255,255,255,0.7)'; g.beginPath(); g.arc(x, y, r * 0.35, 0, 7); g.fill();
}
/** Gift box: wrapped body (paper pattern texture), modelled lid lip, ribbon cross + noshi band. */
export function giftBox(p, K, x, y, z, w, h, d, i, rotY = 0) {
  const g = PR.grp(p, x, y, z, rotY);
  K.box(g, w, h - 0.012, d, K.im('#ffffff', 0.28, { map: wrapTex(K, i) }), [0, (h - 0.012) / 2, 0]);
  const [, fg] = WRAP[i % WRAP.length];
  K.I.add('box', g, [0, h - 0.014, 0], [w + 0.006, 0.014, d + 0.006], fg);
  K.I.add('box', g, [0, 0, 0], [0.018, h + 0.002, d + 0.008], '#c9463e');
  if (i % 2) K.I.add('box', g, [0, 0, 0], [w + 0.008, h + 0.002, 0.016], '#c9463e');
  else K.I.add('box', g, [-w * 0.18, h, 0], [w * 0.26, 0.003, d * 0.82], '#f7f3ea');
  return g;
}
function furoshiki(p, K, x, y, z, color) {
  const g = PR.grp(p, x, y, z, 0.2);
  K.I.add('rbox', g, [0, 0, 0], [0.26, 0.14, 0.2], color);
  K.I.add('sph', g, [0, 0.16, 0], [0.09, 0.05, 0.06], color);
  for (const s of [-1, 1]) K.I.add('sph', g, [s * 0.05, 0.17, 0], [0.07, 0.03, 0.035], color, [0, 0, s * 0.6]);
}
function teaCan(p, K, x, y, z, i) {
  const texs = [['#6f9a6a', '煎茶'], ['#c98aa0', '桜'], ['#3e4d78', '玄米茶'], ['#9a6a48', 'ほうじ茶'], ['#7fa36b', '抹茶']];
  const [c, s] = texs[i % texs.length];
  const t = K.tex.draw(128, 128, (g, w, h) => {
    g.fillStyle = c; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,0.18)'; for (let k = 0; k < 8; k++) { g.beginPath(); g.arc((k * 37) % w, (k * 53) % h, 10, 0, 7); g.fill(); }
    g.fillStyle = '#f4efe2'; g.fillRect(w * 0.62, h * 0.12, w * 0.3, h * 0.76);
    g.fillStyle = '#3a3346'; g.font = `700 22px ${K.F.serif}`; K.vtext(g, s, w * 0.77, h * 0.16, 22, 1.0);
  }, { key: 'sb-teacan' + (i % texs.length) });
  const cy = K.cyl(p, 0.042, 0.14, K.im('#ffffff', 0.3, { map: t }), [x, y + 0.07, z], 14); cy.rotation.y = -Math.PI / 2 + 0.6;
  K.I.add('cyl16', p, [x, y + 0.135, z], [0.088, 0.035, 0.088], '#b9bfc4');
  K.I.add('disc', p, [x, y + 0.17, z], [0.03, 0.006, 0.03], '#9aa1a8');
}
function plateOnStand(p, K, x, y, z, color) {
  const g = PR.grp(p, x, y, z, 0);
  K.I.add('box', g, [0, 0, -0.02], [0.12, 0.01, 0.1], '#6e5040');
  K.I.add('box', g, [0, 0, -0.06], [0.1, 0.16, 0.01], '#6e5040', [-0.3, 0, 0]);
  K.I.add('dish', g, [0, 0.13, -0.03], [0.26, 0.16, 0.26], color, [Math.PI / 2 - 0.3, 0, 0]);
  K.I.add('disc', g, [0, 0.135, -0.018], [0.12, 0.004, 0.12], '#f2efe8', [Math.PI / 2 - 0.3, 0, 0]);
}

// ============================================================================ textures (flat graphics only)
function tagTex(K, a, b, pink) {
  return K.tex.draw(80, 224, (g, w, h) => {
    g.fillStyle = pink ? '#f6dde4' : '#efe2c6'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(90,60,40,0.3)'; g.lineWidth = 2; g.strokeRect(3, 3, w - 6, h - 6);
    g.fillStyle = '#3a2a22';
    const sz = Math.min(34, (h - 84) / [...a].length);
    g.font = `400 ${sz}px ${K.F.brush}`; K.vtext(g, a, w * 0.6, 10, sz, 1.0);
    g.fillStyle = '#a33a36'; g.font = `700 15px ${K.F.serif}`; K.vtext(g, b, w * 0.22, h - 18 - 15 * 4.2, 15, 1.0);
  }, { key: 'sb-oug-tag|' + a });
}
function innerNorenTex(K) {
  return K.tex.draw(512, 280, (g, w, h) => {
    g.fillStyle = '#f0ebe0'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#e9d4db'; g.fillRect(0, h - 40, w, 40);
    flower(g, w * 0.25, h * 0.46, 34, '#e38aa6'); flower(g, w * 0.75, h * 0.46, 34, '#e38aa6');
    K.text(g, '桜月堂', w * 0.5, h - 20, w * 0.5, 26, K.F.serif, 700, '#8e3b56');
  }, { key: 'sb-oug-innernoren2' });
}
function gakuTex(K) {
  return K.tex.draw(512, 128, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#6a4a36'); gr.addColorStop(1, '#503624'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    K.carve(g, '商売繁盛', w / 2, h * 0.54, 78, K.F.brush, '#e6cf96', 400);
  }, { key: 'sb-oug-gaku' });
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
  return K.tex.draw(192, 280, (g, w, h) => {
    g.fillStyle = '#f5f0e6'; g.fillRect(0, 0, w, h);
    const gr = g.createLinearGradient(0, 0, 0, 120); gr.addColorStop(0, '#bcd6ea'); gr.addColorStop(1, '#f6dde4'); g.fillStyle = gr; g.fillRect(8, 8, w - 16, 112);
    const r = K.ctx.rng('sb-cal'); for (let i = 0; i < 12; i++) flower(g, 20 + r() * (w - 40), 20 + r() * 90, 6 + r() * 5, '#f2a7bb');
    K.text(g, '4月', 40, 142, 60, 30, K.F.serif, 700, '#3a3346');
    K.text(g, '卯月', 100, 144, 60, 18, K.F.serif, 700, '#6d6a80');
    const days = '日月火水木金土';
    for (let i = 0; i < 7; i++) K.text(g, days[i], 18 + i * 26, 168, 22, 14, K.F.sans, 700, i === 0 ? '#c9463e' : '#3a3346');
    for (let d = 1; d <= 30; d++) { const c = (d + 2) % 7, rr = Math.floor((d + 2) / 7); K.text(g, String(d), 18 + c * 26, 190 + rr * 18, 24, 13, K.F.sans, 500, c === 0 ? '#c9463e' : '#3a3346'); }
  }, { key: 'sb-calendar' });
}
function photoTex(K) {
  return K.tex.draw(96, 128, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#cfe0ea'); gr.addColorStop(1, '#e9dcc4'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = '#f2b5c8'; for (let i = 0; i < 9; i++) { g.beginPath(); g.arc(10 + i * 10, 20 + (i % 3) * 8, 9, 0, 7); g.fill(); }
    g.fillStyle = '#5a4a5a'; g.beginPath(); g.arc(34, 70, 10, 0, 7); g.fill(); g.fillRect(26, 80, 16, 36);
    g.fillStyle = '#6a5a4a'; g.beginPath(); g.arc(62, 72, 9, 0, 7); g.fill(); g.fillRect(55, 81, 14, 34);
    g.strokeStyle = '#f7f3ea'; g.lineWidth = 6; g.strokeRect(0, 0, w, h);
  }, { key: 'sb-photo' });
}
