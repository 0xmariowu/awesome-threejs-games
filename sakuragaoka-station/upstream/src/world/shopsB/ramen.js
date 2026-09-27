// E5 らーめん 春風 (はるかぜ) — small neighbourhood ramen shop: dark wooden front, red paper
// lanterns, red noren, menu board with prices, lattice window, tanuki statue, kitchen exhaust
// with steam on the side wall; enterable interior with ticket machine, counter and stools.
import * as THREE from 'three';
import { buildRamenInterior } from './ramenInt.js';

export const TEXTS = ['らーめん', 'ラーメン', '春風', 'はるかぜ', 'お品書き', '醤油らーめん', '味噌らーめん', '塩らーめん', 'チャーシューメン', 'つけ麺', '餃子', '6個', '半チャーハン', 'ライス', '大盛り', '味玉', '750円', '850円', '780円', '980円', '880円', '400円', '380円', '150円', '+100円', '+120円',
  '食券', '食券をお買い求めください', '千円札', '硬貨', 'おつり', '中華そば', '創業昭和四十五年', '11:30〜14:30', '17:00〜21:00', '定休日 月曜日', '営業中', '準備中', '本日のおすすめ', 'スープ', '自家製麺', '特製', '冷やし中華', 'はじめました', 'ビール', '桜川ビール', '生ビール', '一番', 'サイン', '水はセルフサービスです', '替え玉', '100円', '味', 'ご来店ありがとうございます', 'ようこそ'];

export function buildRamen(ctx, K, lot) {
  const { mat } = ctx; const { C, T, F } = K;
  const S = K.space(lot); const g = S.g;
  const B = (w, h, d, m, p, r) => K.box(g, w, h, d, m, p, r);
  const rnd = ctx.rng('shopsB-ramen');

  const X0 = -3.95, X1 = 3.7, ZF = -1.5, ZB = -11.0, ZI = -7.9;
  const [gmin, gmax] = K.gRange(S, X0, X1, ZB, 0);
  const FL = gmax + 0.12;
  const H1 = 3.0, Y1 = FL + H1, H2 = 2.5, YE = Y1 + H2;
  const PITCH = 0.32, OV = 0.6, zR = (ZF + ZB) / 2, yR = YE + 0.06 + PITCH * (ZF - zR);
  const WT = 0.15;

  // ---------------------------------------------------------------- materials
  const mYaki = K.mt('#5b4a3e', T.vboards, { paint: 0.06 });           // 焼杉 dark boards
  const mPlaster = K.mt('#ece0c9', T.plaster, { paint: 0.07 });
  const mSide = K.mt('#e3dccd', T.plaster, { paint: 0.08 });
  const mSideLow = K.mt('#b7ada0', T.concrete, { paint: 0.08 });
  const mFrame = K.mt('#4e3a2e', T.grain);
  const mPost = K.mt('#43332a', T.grain);
  const mBase = K.mt('#a9a399', T.concrete, { paint: 0.08 });
  const mRoof = K.mt('#627589', T.corr, { paint: 0.06 });
  const mRoofDark = K.m('#4f5f70');
  const mApron = K.mt('#c4c1b8', T.concrete, { paint: 0.07 });
  const mGravel = K.mt('#b4ad9f', T.gravel);
  const mGlass = K.glass({ opacity: 0.2 });
  const mFrost = K.glass({ frost: true });
  const mSteel = K.m('#b8bec4'), mSteelDark = K.m('#8d949b');
  const mGutter = K.m('#8d949b', { side: 'double' });
  const iFloor = K.im('#a79486', 0.22, { map: T.tile });
  const iWall = K.im('#eadbc0', 0.32, { map: T.plaster });
  const iWood = K.im('#a1774f', 0.32, { map: T.grain });
  const iWoodDark = K.im('#6a4c3a', 0.28, { map: T.grain });
  const iCeil = K.im('#c7a47c', 0.28, { map: T.vboards });
  const iRed = K.im('#c9463e', 0.3);
  const iSteel = K.im('#b9bfc4', 0.28);

  // ---------------------------------------------------------------- ground + foundation
  K.slab(S, -4.25, 4.25, ZF - 0.05, 0, 0.035, mApron, 4);
  K.slab(S, X1, 4.25, ZB, ZF - 0.05, 0.02, mGravel, 1.5);
  K.slab(S, -4.25, X0, ZB, ZF - 0.05, 0.02, mGravel, 1.5);
  K.slab(S, -4.25, 4.25, -14, ZB, 0.02, mGravel, 1.5);
  K.tbox(g, X1 - X0, FL - 0.02 - (gmin - 0.25), ZF - ZB, mBase, [0, (FL - 0.02 + gmin - 0.25) / 2, (ZF + ZB) / 2], 3);
  K.tbox(g, X1 - X0 - 2 * WT, 0.03, ZF - ZI - WT, iFloor, [0, FL - 0.015, (ZF - WT + ZI) / 2], 2.4);
  S.walk(X0 + WT, ZI, X1 - WT, ZF + 0.02, FL);
  const stepTop = (FL + S.gl(-0.3, ZF + 0.2) + 0.035) / 2;
  K.tbox(g, 1.9, stepTop - gmin + 0.12, 0.34, K.mt('#9f9b93', T.concrete), [-0.3, (stepTop + gmin - 0.12) / 2, ZF + 0.17], 2);
  S.walk(-1.25, ZF, 0.65, ZF + 0.34, stepTop);

  // ---------------------------------------------------------------- ground floor front
  const openW = { a0: -3.75, a1: -1.45, y0: FL + 0.85, y1: FL + 2.2 };    // lattice window
  const openD = { a0: -1.25, a1: 0.65, y0: FL, y1: FL + 2.02 };            // door
  const openS = { a0: 2.85, a1: 3.45, y0: FL + 1.35, y1: FL + 2.15 };       // small window
  K.wall(g, mYaki, { axis: 'x', a0: X0, a1: X1, y0: FL - 0.02, y1: Y1, c: ZF - WT / 2, t: WT, holes: [openW, openD, openS], tile: 1.5 });
  for (const x of [X0 + 0.08, openD.a0 - 0.08, openD.a1 + 0.08, X1 - 0.08]) B(0.15, H1, 0.2, mPost, [x, FL + H1 / 2, ZF - 0.06]);
  K.tbox(g, X1 - X0 + 0.02, 0.22, 0.2, mPost, [0, FL + 2.45, ZF - 0.06], 1);
  B(X1 - X0, 0.12, 0.2, K.mt('#8f8a80', T.concrete), [0, FL + 0.06, ZF - 0.06]); // concrete skirting
  // lattice window (格子窓): frosted lower sashes, clear upper, vertical lattice outside
  {
    const w = openW.a1 - openW.a0, h = openW.y1 - openW.y0, cx = (openW.a0 + openW.a1) / 2;
    K.window(g, { x: cx, y0: openW.y0, z: ZF - 0.08, w, h, frame: mFrame, glass: mGlass, panes: 3, sill: false });
    const fr = B(w - 0.04, h * 0.45, 0.006, mFrost, [cx, openW.y0 + h * 0.225, ZF - 0.06]); fr.castShadow = false; ctx.noOutline(fr);
    for (let i = 0; i <= 26; i++) B(0.028, h + 0.06, 0.035, mFrame, [openW.a0 + i * w / 26, openW.y0 + h / 2, ZF + 0.03]);
    for (const y of [openW.y0 - 0.02, openW.y1 + 0.02]) B(w + 0.12, 0.05, 0.08, mFrame, [cx, y, ZF + 0.02]);
  }
  K.window(g, { x: (openS.a0 + openS.a1) / 2, y0: openS.y0, z: ZF - 0.08, w: openS.a1 - openS.a0, h: openS.y1 - openS.y0, frame: mFrame, glass: mFrost, panes: 1 });
  // wooden sliding door (格子戸): when you approach, the left panel slides right over the right one and both
  // park in the wall pocket behind the right-hand post, leaving ~1.25 m clear (a0 .. a1 - pw + pocket).
  B(openD.a1 - openD.a0, 0.04, 0.16, mFrame, [(openD.a0 + openD.a1) / 2, FL + 0.005, ZF - 0.06]);
  B(openD.a1 - openD.a0 + 0.1, 0.08, 0.16, mFrame, [(openD.a0 + openD.a1) / 2, FL + 2.0 + 0.04, ZF - 0.06]);
  const pw = (openD.a1 - openD.a0) / 2 + 0.04, pocket = 0.36;
  const dOpt = { w: pw, h: 1.98, d: 0.045, frame: mFrame, glass: mGlass, stile: 0.055, top: 0.06, bottom: 0.1, bars: [0.33, 0.66], vbars: [-0.34, 0.34], kick: { h: 0.4, mat: K.mt('#6a5242', T.vboards), tile: 1.5 } };
  const fixed = K.panel(S.d, dOpt); fixed.position.set(openD.a1 - pw / 2, FL + 0.02, ZF - 0.03);
  const slider = K.panel(S.d, dOpt); slider.position.set(openD.a0 + pw / 2, FL + 0.02, ZF - 0.085);
  K.eigyoPlate(fixed, 0, 1.43, 0.025, 0, '営業中', '');
  K.decal(fixed, K.hoursSticker(['11:30〜14:30', '17:00〜21:00', '定休日 月曜日'], '#b8423c'), 0.22, 0.165, [0, 0.93, 0.024]);
  K.autoSlide(S, fixed, { cx: -0.3, cz: ZF, r: 2.6, dx: pocket, rest: 1 });   // open during business hours
  K.autoSlide(S, slider, { cx: -0.3, cz: ZF, r: 2.6, dx: pw - 0.1 + pocket, rest: 1 });
  S.box(openD.a1 - pw + pocket, ZF - 0.12, openD.a1, ZF, FL, FL + 2.0);         // open-state footprint of the parked panels
  S.box(X0, ZF - WT, openD.a0, ZF, FL - 0.1, Y1);
  S.box(openD.a1, ZF - WT, X1, ZF, FL - 0.1, Y1);
  K.decal(slider, K.cashless(), 0.34, 0.107, [0, 1.0, 0.026]);

  // pent roof (metal) + roof sign board + lanterns + noren
  K.pent(g, { x0: X0 - 0.05, x1: X1 + 0.05, zWall: ZF, depth: 0.95, drop: 0.24, y: Y1 - 0.2, mat: mRoof, tile: 1.2, fascia: K.m('#4f5f70'), fasciaH: 0.12, brackets: [X0 + 0.08, openD.a0 - 0.08, openD.a1 + 0.08, X1 - 0.08], bracketMat: mPost });
  K.gutterX(g, X0, X1, Y1 - 0.2 - 0.24 - 0.07, ZF + 1.0, mGutter);
  K.downpipe(g, X1 + 0.08, ZF + 0.95, Y1 - 0.5, S.gl(X1 + 0.08, ZF + 0.95), mGutter, 0.9);
  {
    const sw = 4.6, sh = 0.78, sy = Y1 + 0.42;
    B(sw + 0.14, sh + 0.14, 0.1, mPost, [0.2, sy, ZF + 0.08]);
    K.plane(g, sw, sh, K.toonMemo('#ffffff', { map: roofSignTex(K) }), [0.2, sy, ZF + 0.132]);
    for (const x of [-1.6, 2.0]) B(0.08, 0.5, 0.08, mPost, [x, sy - 0.55, ZF + 0.15]);
    for (const x of [-1.9, 0.2, 2.3]) { B(0.04, 0.04, 0.3, mSteelDark, [x, sy + sh / 2 + 0.18, ZF + 0.22]); K.cyl(g, 0.05, 0.1, K.m('#5c6168'), [x, sy + sh / 2 + 0.18, ZF + 0.38], 10, [Math.PI / 2 - 0.5, 0, 0], 0.09); }
  }
  const lTex = lanternTex(K);
  for (const x of [openD.a0 - 0.42, openD.a1 + 0.42]) {
    B(0.03, 0.14, 0.03, mSteelDark, [x, Y1 - 0.35, ZF + 0.45]);
    K.lantern(S, { x, y: Y1 - 0.42, z: ZF + 0.45, r: 0.2, h: 0.56, tex: lTex, glow: 1.08 });
  }
  K.noren(S, { x: (openD.a0 + openD.a1) / 2, y: FL + 2.2, z: ZF + 0.1, w: 1.95, h: 0.78, n: 4, tex: norenTex(K, 1.95, 4), rodColor: '#43332a' });
  // menu board (お品書き) right of the door + stand sign
  {
    const mx = 1.85, my = FL + 1.48;
    B(1.5, 1.14, 0.06, mPost, [mx, my, ZF + 0.03]);
    K.plane(g, 1.4, 1.04, K.toonMemo('#ffffff', { map: menuTex(K) }), [mx, my, ZF + 0.062]);
    K.tbox(g, 1.7, 0.05, 0.22, mRoof, [mx, my + 0.65, ZF + 0.1], 1.2, [0.25, 0, 0]);
  }
  // tanuki (信楽焼) by the door
  {
    const tx = 0.98, tz = -1.02, y0 = S.gl(tx, tz) + 0.035;
    K.cyl(g, 0.22, 0.1, K.mt('#9f9b93', T.concrete), [tx, y0 + 0.05, tz], 12);
    tanuki(g, K, tx, y0 + 0.1, tz, 0.62, -0.25);
    S.cyl(tx, tz, 0.24, y0, y0 + 0.8);
  }
  // A-board: 本日のおすすめ
  {
    const x = -3.1, z = -0.55, y0 = S.gl(x, z) + 0.035;
    const bg = new THREE.Group(); bg.position.set(x, y0, z); bg.rotation.y = 0.4; g.add(bg);
    for (const s of [1, -1]) { const leg = K.box(bg, 0.05, 0.86, 0.03, mFrame, [0, 0.43, s * 0.15]); leg.rotation.x = -s * 0.18; }
    const face = new THREE.Group(); face.position.set(0, 0.5, 0.175); face.rotation.x = -0.18; bg.add(face);
    K.box(face, 0.52, 0.72, 0.03, mFrame, [0, 0, 0]);
    K.plane(face, 0.46, 0.66, K.toonMemo('#ffffff', { map: osusumeTex(K) }), [0, 0, 0.017]);
    S.box(x - 0.3, z - 0.25, x + 0.3, z + 0.25, y0, y0 + 1.0);
  }
  K.plant(g, -1.5, S.gl(-1.5, -1.0) + 0.035, -1.0, { r: 0.15, h: 0.26, pot: '#8a8f94', leaf: '#4f7a4a', leaf2: '#6f9a5a', n: 6, tall: 1.4 });

  // ---------------------------------------------------------------- upper floor
  const win2 = [{ a0: -2.9, a1: -0.9, y0: Y1 + 0.8, y1: Y1 + 1.85 }, { a0: 0.9, a1: 2.9, y0: Y1 + 0.8, y1: Y1 + 1.85 }];
  K.wall(g, mPlaster, { axis: 'x', a0: X0, a1: X1, y0: Y1, y1: YE, c: ZF - WT / 2, t: WT, holes: win2, tile: 2.5 });
  B(X1 - X0 + 0.04, 0.16, 0.18, mPost, [0, YE - 0.08, ZF - 0.05]);
  for (const o of win2) {
    const w = o.a1 - o.a0, h = o.y1 - o.y0, cx = (o.a0 + o.a1) / 2;
    K.window(g, { x: cx, y0: o.y0, z: ZF - 0.07, w, h, frame: K.m(C.aluDark), glass: mGlass, panes: 2, behind: K.curtain(cx < 0 ? '#e5d7c8' : '#e0e3dc'), behindD: 0.1, sillMat: K.m('#9d968a') });
    // small railing
    const iron = K.m('#5a5f66');
    K.box(g, w + 0.1, 0.03, 0.03, iron, [cx, o.y0 + 0.45, ZF + 0.14]);
    for (let i = 0; i <= 8; i++) K.box(g, 0.016, 0.45, 0.016, iron, [cx - w / 2 - 0.05 + i * (w + 0.1) / 8, o.y0 + 0.225, ZF + 0.14]);
    for (const sx of [-1, 1]) K.box(g, 0.03, 0.03, 0.16, iron, [cx + sx * (w / 2 + 0.04), o.y0 + 0.2, ZF + 0.07]);
  }
  K.acUnit(g, -2.95, Y1 + 0.05, ZF + 0.25, 0, false);        // on the pent roof... actually on a bracket
  B(0.9, 0.04, 0.35, mSteelDark, [-2.95, Y1 + 0.03, ZF + 0.2]);
  K.cyl(g, 0.035, 0.9, K.m('#e7e1d1'), [-2.55, Y1 + 0.9, ZF + 0.05], 8);
  // futon airing on the right railing — lived-in
  {
    const ft = K.tex.draw(256, 256, (gg, w, h) => {   // cotton futon cover: pale pink with a small white flower print + piping
      const r = ctx.rng('sb-futon');
      gg.fillStyle = '#f6dfe3'; gg.fillRect(0, 0, w, h);
      gg.fillStyle = 'rgba(255,255,255,0.85)';
      for (let i = 0; i < 7; i++) for (let j = 0; j < 7; j++) {
        const x = (i + (j % 2) * 0.5) * w / 7 + 12, y = j * h / 7 + 14;
        for (let k = 0; k < 5; k++) { const a = k * 1.2566 + r() * 0.2; gg.beginPath(); gg.arc(x + Math.cos(a) * 5, y + Math.sin(a) * 5, 3.6, 0, 7); gg.fill(); }
      }
      gg.fillStyle = 'rgba(200,120,140,0.55)'; for (let i = 0; i < 7; i++) for (let j = 0; j < 7; j++) { gg.beginPath(); gg.arc((i + (j % 2) * 0.5) * w / 7 + 12, j * h / 7 + 14, 2, 0, 7); gg.fill(); }
      gg.fillStyle = '#d98fa0'; gg.fillRect(0, 0, w, 7); gg.fillRect(0, h - 7, w, 7);
    }, { key: 'sb-futon' });
    const fm = K.mt('#ffffff', ft, { paint: 0.05 });
    K.rbox(g, 1.34, 0.6, 0.06, 0.12, fm, [1.9, Y1 + 0.98, ZF + 0.19]);           // front drape
    K.cylX(g, 0.05, 1.34, fm, [1.9, Y1 + 1.3, ZF + 0.14], 10);                    // fold over the rail
    K.rbox(g, 1.34, 0.3, 0.06, 0.12, fm, [1.9, Y1 + 1.15, ZF + 0.09]);            // back drape
    for (const x of [1.4, 2.4]) {                                               // 布団ばさみ clips
      K.box(g, 0.05, 0.16, 0.13, K.m('#6fa3c8'), [x, Y1 + 1.28, ZF + 0.14]);
      K.cylX(g, 0.03, 0.05, K.m('#6fa3c8'), [x, Y1 + 1.37, ZF + 0.14], 8);
    }
  }
  K.sodeSign(g, { x: X1 - 0.3, y: Y1 + 0.3, z: ZF, w: 0.5, h: 1.7, tex: sodeTex(K), frame: '#e2ddd2', glow: 1.0 });

  // ---------------------------------------------------------------- side + back walls, roof
  const exhaustZ = -6.6;
  for (const x of [X0 + WT / 2, X1 - WT / 2]) {
    K.wall(g, mSideLow, { axis: 'z', a0: ZB, a1: ZF - WT, y0: FL - 0.05, y1: FL + 0.9, c: x, t: WT, tile: 3 });
    K.wall(g, mSide, { axis: 'z', a0: ZB, a1: ZF - WT, y0: FL + 0.9, y1: YE, c: x, t: WT, holes: x > 0 ? [{ a0: -9.9, a1: -9.0, y0: FL, y1: FL + 1.95 }, { a0: -4.6, a1: -3.6, y0: Y1 + 0.8, y1: Y1 + 1.7 }] : [{ a0: -5.0, a1: -3.8, y0: Y1 + 0.8, y1: Y1 + 1.7 }], tile: 2.5 });
    K.gableEnd(g, mSide, x, ZB, ZF, YE - 0.001, zR, yR - 0.08, WT, 2.5);
    S.box(x - WT / 2, ZB, x + WT / 2, ZF, FL - 0.1, YE);
  }
  // south side: back door, window, exhaust hood + duct + fan, grease stain, LPG cylinders, crates
  {
    const sx = X1 + 0.005;
    const wg = new THREE.Group(); wg.position.set(sx, 0, 0); wg.rotation.y = Math.PI / 2; g.add(wg); // local x = -z
    K.box(wg, 0.92, 1.95, 0.05, K.m('#8d949b'), [9.45, FL + 0.975, 0.0]);
    K.box(wg, 0.06, 0.3, 0.03, K.m('#6d747c'), [9.1, FL + 1.0, 0.04]);
    K.window(wg, { x: 4.1, y0: Y1 + 0.8, z: 0.0, w: 1.0, h: 0.9, frame: K.m(C.aluDark), glass: mGlass, panes: 2, behind: K.curtain('#e7ddd0') });
    // exhaust fan housing (換気扇) with hood
    K.box(wg, 0.6, 0.6, 0.12, mSteel, [-exhaustZ, FL + 2.15, 0.06]);
    K.box(wg, 0.66, 0.08, 0.34, mSteelDark, [-exhaustZ, FL + 2.5, 0.17], [0.35, 0, 0]);
    for (let i = 0; i < 5; i++) K.box(wg, 0.52, 0.03, 0.05, mSteelDark, [-exhaustZ, FL + 1.95 + i * 0.1, 0.13], [0.5, 0, 0]);
    // duct up the wall to above the eave
    K.box(wg, 0.26, 0.26, 0.3, mSteel, [-exhaustZ + 0.55, FL + 2.8, 0.15]);
    K.box(wg, 0.26, YE + 0.8 - (FL + 2.8), 0.26, mSteel, [-exhaustZ + 0.55, (YE + 0.8 + FL + 2.8) / 2, 0.28]);
    K.cyl(wg, 0.2, 0.08, mSteelDark, [-exhaustZ + 0.55, YE + 0.85, 0.28], 12);
    for (let y = FL + 3.2; y < YE; y += 0.9) K.box(wg, 0.34, 0.03, 0.34, mSteelDark, [-exhaustZ + 0.55, y, 0.28]);
    // grease / soot streak
    K.plane(wg, 0.8, 1.4, K.memo('decal', '#ffffff', { map: stainTex(K) }), [-exhaustZ, FL + 1.3, 0.004]);
    K.meter(wg, 7.8, FL + 1.55, 0.0);
    // LPG cylinders chained to the wall
    for (const lx of [7.2, 6.7]) {
      const lz = -lx, cx = sx + 0.27, y0 = S.gl(cx, lz);
      K.cyl(g, 0.18, 1.0, K.m('#c9ccc8'), [cx, y0 + 0.58, lz], 14);
      K.sph(g, 0.18, K.m('#c9ccc8'), [cx, y0 + 1.08, lz], 12, [1, 0.5, 1]);
      K.cyl(g, 0.07, 0.12, K.m('#8d949b'), [cx, y0 + 1.2, lz], 10);
      K.cyl(g, 0.16, 0.08, K.m('#8d949b'), [cx, y0 + 0.04, lz], 14);
      K.box(g, 0.012, 0.1, 0.08, K.m('#e0d8c6'), [cx + 0.18, y0 + 0.8, lz]);
    }
    ctx.wires.add([[S.w2(sx + 0.46, -7.45).x, S.f.y + FL + 0.9, S.w2(sx + 0.46, -7.45).z], [S.w2(sx + 0.46, -6.45).x, S.f.y + FL + 0.9, S.w2(sx + 0.46, -6.45).z]], { width: 0.012, color: '#6d747c' });
    K.cyl(g, 0.02, 1.2, K.m('#b8a36a'), [sx + 0.08, FL + 1.3, -6.95], 6);
    S.box(X1, -7.45, X1 + 0.47, -6.45, 0, 1.4);
    // beer crates + mop bucket by the back door
    for (let i = 0; i < 3; i++) K.crate(g, sx + 0.27, S.gl(sx + 0.3, -8.4) + i * 0.3, -8.4, ['#d9463b', '#e8c547', '#d9463b'][i], Math.PI / 2 + (i % 2) * 0.05, i === 2, '#8a5a3a');
    S.box(X1, -8.65, X1 + 0.5, -8.15, 0, 0.9);
    K.cyl(g, 0.15, 0.28, K.m('#3f7fb5'), [sx + 0.25, S.gl(sx, -9.0) + 0.14, -8.95], 12, null, 0.13);
    K.cyl(g, 0.012, 1.2, K.m('#c9a36a'), [sx + 0.18, S.gl(sx, -9.0) + 0.7, -8.95], 6, [0, 0, 0.15]);
  }
  // steam from the exhaust fan (drifts with the wind toward +x)
  K.steam(S, { x: X1 + 0.35, y: FL + 2.2, z: exhaustZ, n: 7, rise: 1.6, drift: [0.9, 0.2], size: 0.45, life: 4.0, alpha: 0.8 });
  // back wall
  K.wall(g, mSide, { axis: 'x', a0: X0 + WT, a1: X1 - WT, y0: FL - 0.05, y1: YE, c: ZB + WT / 2, t: WT, holes: [{ a0: -1.5, a1: 0.0, y0: Y1 + 0.8, y1: Y1 + 1.8 }], tile: 2.5 });
  K.window(g, { x: -0.75, y0: Y1 + 0.8, z: ZB - 0.03, w: 1.5, h: 1.0, frame: K.m(C.aluDark), glass: mGlass, panes: 2, rotY: Math.PI, behind: K.curtain('#dfe0e6') });
  S.box(X0, ZB, X1, ZI, FL - 0.1, YE);
  // main roof (metal, 平入り)
  K.gableX(g, { x0: X0 - 0.28, x1: X1 + 0.35, zf: ZF + OV, zb: ZB - OV, yE: YE + 0.06 - PITCH * OV, yR, zR, t: 0.09, mat: mRoof, tile: 1.2, fascia: K.m('#e2ddd2') });
  B(X1 - X0 + 0.63, 0.12, 0.3, mRoofDark, [(X0 + X1) / 2 + 0.035, yR + 0.05, zR]);
  for (const x of [X0 - 0.26, X1 + 0.33]) for (const side of [1, -1]) {
    const ze = side > 0 ? ZF + OV : ZB - OV; const y0 = YE + 0.06 - PITCH * OV; const run = Math.abs(ze - zR), rise = yR - y0, len = Math.hypot(run, rise), ang = Math.atan2(rise, run);
    B(0.04, 0.16, len, K.m('#e2ddd2'), [x, (yR + y0) / 2 - 0.02, (ze + zR) / 2], [side * ang, 0, 0]);
  }
  K.gutterX(g, X0 - 0.26, X1 + 0.3, YE + 0.06 - PITCH * OV - 0.1, ZF + OV + 0.05, mGutter);
  K.downpipe(g, X0 - 0.15, ZF + 0.35, YE - 0.1, Y1 - 0.2, mGutter, 0.1);
  // TV antenna on the ridge
  {
    const ax = -2.2, ay = yR + 0.1;
    K.cyl(g, 0.02, 1.8, mSteelDark, [ax, ay + 0.9, zR - 0.4], 6);
    for (let i = 0; i < 4; i++) K.box(g, 0.9 - i * 0.12, 0.015, 0.015, mSteelDark, [ax, ay + 1.3 + i * 0.14, zR - 0.4]);
    K.box(g, 0.015, 0.015, 0.8, mSteelDark, [ax, ay + 1.5, zR - 0.4]);
  }

  // ---------------------------------------------------------------- interior (see ramenInt.js)
  buildRamenInterior(ctx, K, S, { FL, ZF, ZI, WT, X0, X1 });
  return { S, FL };
}

// ============================================================================ props
function tanuki(p, K, x, y, z, s = 0.62, rotY = 0) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rotY; g.scale.setScalar(s / 0.62); p.add(g);
  const brown = K.m('#8a6446'), dark = K.m('#5e4636'), belly = K.m('#d8bd94'), straw = K.m('#cdb27a'), white = K.m('#f2ede2'), ink = K.m('#3a3346'), red = K.m('#b8423c');
  K.sph(g, 0.17, brown, [0, 0.2, 0], 14, [1, 1.05, 0.95]);                    // body
  K.sph(g, 0.14, belly, [0, 0.19, 0.07], 14, [1, 1, 0.8]);                  // belly
  K.sph(g, 0.12, brown, [0, 0.43, 0.02], 14);                                // head
  for (const sx of [-1, 1]) { K.sph(g, 0.05, white, [sx * 0.045, 0.45, 0.1], 10); K.sph(g, 0.022, ink, [sx * 0.045, 0.45, 0.14], 8); }
  K.sph(g, 0.04, belly, [0, 0.4, 0.12], 10, [1.2, 0.8, 1]);                  // muzzle
  K.sph(g, 0.015, ink, [0, 0.415, 0.16], 6);
  for (const sx of [-1, 1]) K.sph(g, 0.03, dark, [sx * 0.08, 0.53, 0.0], 8);  // ears
  K.cyl(g, 0.18, 0.035, straw, [0, 0.56, 0.0], 18, null, 0.2);              // straw hat (笠)
  K.cyl(g, 0.02, 0.08, straw, [0, 0.61, 0.0], 12, null, 0.1);
  K.sph(g, 0.05, dark, [0.14, 0.2, 0.08], 8);                                // right hand
  K.cyl(g, 0.045, 0.15, K.m('#e9e0cc'), [0.17, 0.12, 0.1], 10, null, 0.055); // sake bottle (徳利)
  K.cyl(g, 0.02, 0.05, K.m('#e9e0cc'), [0.17, 0.215, 0.1], 8);
  K.box(g, 0.05, 0.05, 0.004, red, [0.17, 0.12, 0.155]);
  K.sph(g, 0.05, dark, [-0.14, 0.24, 0.08], 8);                              // left hand
  K.box(g, 0.08, 0.12, 0.02, K.m('#e9e0cc'), [-0.16, 0.2, 0.13], [0.2, 0.3, 0]); // ledger (通帳)
  K.sph(g, 0.06, dark, [0.0, 0.1, -0.17], 8, [0.8, 1, 1.4]);                // tail
  for (const sx of [-1, 1]) K.sph(g, 0.06, dark, [sx * 0.08, 0.03, 0.08], 8, [1, 0.6, 1.3]); // feet
}
function lanternTex(K) {
  return K.tex.draw(512, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, w, 0);
    gr.addColorStop(0, '#9e3a33'); gr.addColorStop(0.3, '#d9544a'); gr.addColorStop(0.5, '#ef6a5a'); gr.addColorStop(0.7, '#d9544a'); gr.addColorStop(1, '#9e3a33');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(80,20,20,0.25)'; for (let y = 8; y < h; y += 14) g.fillRect(0, y, w, 2);
    g.fillStyle = '#2a1f22'; g.font = `400 58px ${K.F.brush}`; K.vtext(g, 'らーめん', w * 0.5, 18, 54, 0.96);
    g.fillStyle = '#2a1f22'; g.fillRect(0, 0, w, 10); g.fillRect(0, h - 10, w, 10);
  }, { key: 'sb-ramen-lantern' });
}
function norenTex(K, W, n) {
  return K.tex.draw(768, 308, (g, w, h) => {
    const r = K.ctx.rng('sb-ramen-noren');
    g.fillStyle = '#9e3b35'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 1800; i++) { g.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.03)' : 'rgba(40,0,0,0.05)'; g.fillRect(r() * w, r() * h, 2, 2); }
    g.fillStyle = 'rgba(240,232,215,0.9)'; g.fillRect(0, 0, w, 18);
    const gap = 0.014, sw = (W - gap * (n - 1)) / n, chars = ['ら', 'ー', 'め', 'ん'];
    for (let i = 0; i < n; i++) { const cx = (i * (sw + gap) + sw / 2) / W * w; K.text(g, chars[i], cx, h * 0.5, w / n * 0.85, 150, K.F.brush, 400, '#f5eee0'); }
    K.text(g, '春風', w * 0.9, h * 0.86, 90, 34, K.F.brush, 400, '#f5eee0');
  }, { key: 'sb-ramen-noren' });
}
function roofSignTex(K) {
  return K.tex.draw(1024, 174, (g, w, h) => {
    g.fillStyle = '#f3ead6'; g.fillRect(0, 0, w, h);
    const r = K.ctx.rng('ramen-sign'); K.blotch(g, w, h, r, 16, 0.08);
    g.strokeStyle = '#9e3b35'; g.lineWidth = 8; g.strokeRect(10, 10, w - 20, h - 20);
    g.fillStyle = '#b8423c'; K.rr(g, 30, 30, 150, h - 60, 12); g.fill();
    K.text(g, '中華そば', 105, h / 2, 130, 36, K.F.brush, 400, '#fdf8ee');
    K.text(g, 'らーめん', w * 0.44, h * 0.53, 420, 110, K.F.brush, 400, '#b8423c');
    K.text(g, '春風', w * 0.82, h * 0.52, 200, 100, K.F.brush, 400, '#2a211d');
    K.text(g, '創業昭和四十五年', w * 0.82, h * 0.86, 220, 18, K.F.serif, 700, '#5a4238');
  }, { key: 'sb-ramen-roofsign' });
}
function sodeTex(K) {
  return K.tex.draw(160, 544, (g, w, h) => {
    g.fillStyle = '#b8423c'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#f5eee0'; g.lineWidth = 5; g.strokeRect(9, 9, w - 18, h - 18);
    g.fillStyle = '#f5eee0'; g.font = `900 92px ${K.F.round}`; K.vtext(g, 'ラーメン', w / 2, 26, 92, 1.02);
    K.text(g, '春風', w / 2, h - 44, w - 30, 40, K.F.brush, 400, '#f7e28a');
  }, { key: 'sb-ramen-sode' });
}
const MENU = [['醤油らーめん', '750円'], ['味噌らーめん', '850円'], ['塩らーめん', '780円'], ['チャーシューメン', '980円'], ['つけ麺', '880円'], ['餃子（6個）', '400円'], ['半チャーハン', '380円'], ['ライス', '150円']];
function menuTex(K) {
  return K.tex.draw(512, 380, (g, w, h) => {
    g.fillStyle = '#f1e8d2'; g.fillRect(0, 0, w, h);
    const r = K.ctx.rng('ramen-menu'); K.blotch(g, w, h, r, 12, 0.07);
    g.fillStyle = '#3a2a22'; g.fillRect(0, 0, w, 58);
    K.text(g, 'お品書き', w / 2, 30, w * 0.6, 40, K.F.brush, 400, '#f1e8d2');
    MENU.forEach(([a, b], i) => {
      const y = 86 + i * 34;
      K.text(g, a, 30, y, 290, 26, K.F.serif, 700, '#2a211d', 'left');
      g.fillStyle = 'rgba(58,42,34,0.35)'; for (let x = 300; x < 400; x += 10) g.fillRect(x, y + 4, 4, 3);
      K.text(g, b, w - 30, y, 110, 26, K.F.serif, 700, '#b8423c', 'right');
    });
    K.text(g, '大盛り +100円 ・ 味玉 +120円 ・ 替え玉 100円', w / 2, h - 22, w - 40, 20, K.F.sans, 700, '#5a4238');
  }, { key: 'sb-ramen-menu' });
}
function osusumeTex(K) {
  return K.tex.draw(256, 368, (g, w, h) => {
    g.fillStyle = '#2f3a36'; g.fillRect(0, 0, w, h);
    const r = K.ctx.rng('ramen-chalk'); K.blotch(g, w, h, r, 14, 0.12, true);
    K.text(g, '本日のおすすめ', w / 2, 38, w - 24, 30, K.F.hand, 400, '#f4efe2');
    K.text(g, '特製', w / 2, 92, w - 24, 30, K.F.hand, 400, '#f7e28a');
    K.text(g, '味噌らーめん', w / 2, 136, w - 24, 34, K.F.hand, 400, '#f4efe2');
    // bowl doodle
    g.strokeStyle = '#f4efe2'; g.lineWidth = 3; g.beginPath(); g.arc(w / 2, 200, 56, 0, Math.PI); g.stroke(); g.beginPath(); g.moveTo(w / 2 - 62, 200); g.lineTo(w / 2 + 62, 200); g.stroke();
    g.strokeStyle = '#f7e28a'; for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(w / 2 - 20 + i * 20, 190); g.bezierCurveTo(w / 2 - 30 + i * 20, 170, w / 2 - 10 + i * 20, 160, w / 2 - 20 + i * 20, 140); g.stroke(); }
    K.text(g, '850円', w / 2, 290, w - 24, 40, K.F.hand, 400, '#f4b6c8');
    K.text(g, '自家製麺', w / 2, 336, w - 24, 22, K.F.hand, 400, '#bfe0b0');
  }, { key: 'sb-ramen-osusume' });
}
function stainTex(K) {
  return K.tex.draw(128, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(70,55,50,0.45)'); gr.addColorStop(1, 'rgba(70,55,50,0)');
    g.fillStyle = gr;
    for (let i = 0; i < 7; i++) { const x = 18 + i * 15; g.beginPath(); g.moveTo(x - 6, 0); g.lineTo(x + 6, 0); g.lineTo(x + 2, h * (0.4 + (i * 37 % 50) / 100)); g.lineTo(x - 2, h * (0.4 + (i * 37 % 50) / 100)); g.fill(); }
  }, { key: 'sb-stain' });
}
