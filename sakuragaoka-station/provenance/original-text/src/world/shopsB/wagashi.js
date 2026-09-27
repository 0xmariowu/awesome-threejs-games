// E2 和菓子処 桜月堂 (おうげつどう) — Showa-era wooden confectioner with plaster upper floor,
// tiled pent roof, carved sign, indigo noren, lit showcase of sweets, enterable interior.
import * as THREE from 'three';
import { buildWagashiInterior } from './wagashiInt.js';

export const TEXTS = ['和菓子処', '桜月堂', 'おうげつどう', '創業昭和廿八年', '御菓子司', '和菓子', '春季限定', '桜もち', 'さくらもち', '一個', '円', '三色だんご', 'どら焼き', '柏もち', '豆大福', '草もち', 'みたらし', '煉羊羹',
  '一八〇円', '一五〇円', '二〇〇円', '一六〇円', '一三〇円', '八〇〇円', 'たい焼き', '焼きたて', 'あつあつ', 'つぶあん', 'お花見だんご', 'はじめました', '9:00〜18:00', '定休日 水曜日', '煎茶', '玄米茶', 'ほうじ茶', '抹茶', '贈答用', '詰め合わせ',
  'ご予約承ります', '4月', '卯月', '日月火水木金土', '桜', '三個入', '540円', '480円', '180円', '150円', 'お茶', '器'];

export function buildWagashi(ctx, K, lot) {
  const { THREE: T3, mat } = ctx; const { C, T, F } = K;
  const S = K.space(lot); const g = S.g;
  const B = (w, h, d, m, p, r) => K.box(g, w, h, d, m, p, r);
  const rnd = ctx.rng('shopsB-wagashi');

  // ---------------------------------------------------------------- dimensions (lot local; +Z = street)
  const X0 = -3.5, X1 = 3.5, ZF = -1.2, ZB = -10.4, ZI = -5.3; // facade, back wall, interior partition
  const [gmin, gmax] = K.gRange(S, X0, X1, ZB, 0);
  const FL = gmax + 0.14;                 // shop floor (土間) level
  const H1 = 3.0, H2 = 2.45, Y1 = FL + H1, YE = Y1 + H2;
  const PITCH = 0.4, OV = 0.7, zR = (ZF + ZB) / 2, yR = YE + 0.06 + PITCH * (ZF - zR);
  const WT = 0.14;                        // wall thickness

  // ---------------------------------------------------------------- materials
  const mPlaster = K.mt(C.plaster, T.plaster, { paint: 0.06 });
  const mPlasterSide = K.mt('#e6dcc8', T.plaster, { paint: 0.07 });
  const mBoard = K.mt('#7d5f49', T.vboards, { paint: 0.05 });
  const mSiding = K.mt('#8c735f', T.siding, { paint: 0.06 });
  const mFrame = K.mt(C.frame, T.grain);
  const mPost = K.mt(C.frameDeep, T.grain);
  const mBase = K.mt('#b3ada2', T.concrete, { paint: 0.08 });
  const mRoof = K.mt('#5f6b7b', T.kawara, { paint: 0.05 });
  const mRoofDark = K.m('#525b69');
  const mApron = K.mt(C.concrete, T.concrete, { paint: 0.06 });
  const mGravel = K.mt('#b9b2a5', T.gravel, { paint: 0.05 });
  const mGlass = K.glass({ opacity: 0.2 });
  const mGlassShow = K.glass({ opacity: 0.12, streaks: true });
  const mFrost = K.glass({ frost: true });
  const mGutter = K.m('#8d8a80', { side: 'double' });
  // interior (warm lit)
  const iFloor = K.im('#c9c0b0', 0.22, { map: T.tile });
  const iWall = K.im('#efe2c9', 0.3, { map: T.plaster });
  const iCeil = K.im('#b8946e', 0.26, { map: T.vboards });
  const iWood = K.im('#a57c58', 0.3, { map: T.grain });
  const iWoodDark = K.im('#6e5040', 0.28, { map: T.grain });
  const iRed = K.im('#b8423c', 0.26);
  const iPaper = K.im('#f1ead9', 0.3);

  // ---------------------------------------------------------------- ground: apron, side gaps, back yard
  K.slab(S, -3.75, 3.75, ZF - 0.05, 0, 0.035, mApron, 4);
  K.slab(S, X1, 3.75, ZB, ZF - 0.05, 0.02, mGravel, 1.5);
  K.slab(S, -3.75, X0, ZB, ZF - 0.05, 0.02, mGravel, 1.5);
  K.slab(S, -3.75, 3.75, -14, ZB, 0.02, mGravel, 1.5);
  // stone step at the door (沓脱石)
  const stepTop = (FL + S.gl(0.3, ZF + 0.2) + 0.035) / 2;
  K.tbox(g, 1.5, stepTop - gmin + 0.1, 0.36, K.mt('#a9a59c', T.concrete), [0.3, (stepTop + gmin - 0.1) / 2, ZF + 0.18], 2);
  S.walk(-0.45, ZF, 1.05, ZF + 0.36, stepTop);

  // ---------------------------------------------------------------- foundation + floor
  K.tbox(g, X1 - X0, FL - 0.02 - (gmin - 0.2), ZF - ZB, mBase, [0, (FL - 0.02 + gmin - 0.2) / 2, (ZF + ZB) / 2], 3);
  K.tbox(g, X1 - X0 - 2 * WT, 0.03, ZF - ZI - WT, iFloor, [0, FL - 0.015, (ZF - WT + ZI) / 2], 2.4);
  S.walk(X0 + WT, ZI, X1 - WT, ZF + 0.02, FL);

  // ---------------------------------------------------------------- ground-floor facade (wood) with openings
  const openA = { a0: -3.3, a1: -1.05, y0: FL + 0.72, y1: FL + 2.3 };   // display window
  const openB = { a0: -0.85, a1: 1.35, y0: FL, y1: FL + 2.6 };          // doors + transom
  const openC = { a0: 1.6, a1: 3.3, y0: FL + 0.9, y1: FL + 2.3 };       // side window
  K.wall(g, mBoard, { axis: 'x', a0: X0, a1: X1, y0: FL - 0.02, y1: Y1, c: ZF - WT / 2, t: WT, holes: [openA, openB, openC], tile: 1.5 });
  // posts (柱) and head beam (差鴨居)
  for (const x of [X0 + 0.08, -0.95, 1.475, X1 - 0.08]) B(0.16, H1 + 0.02, 0.2, mPost, [x, FL + H1 / 2, ZF - 0.07]);
  K.tbox(g, X1 - X0 + 0.02, 0.26, 0.2, mPost, [0, FL + 2.76, ZF - 0.06], 1);
  // sill + kick board under window A
  B(openA.a1 - openA.a0 + 0.12, 0.05, 0.18, mFrame, [(openA.a0 + openA.a1) / 2, openA.y0 - 0.02, ZF + 0.02]);
  B(openC.a1 - openC.a0 + 0.12, 0.05, 0.16, mFrame, [(openC.a0 + openC.a1) / 2, openC.y0 - 0.02, ZF + 0.02]);

  // display window A: frame, 3 panes, glass
  {
    const w = openA.a1 - openA.a0, h = openA.y1 - openA.y0, cx = (openA.a0 + openA.a1) / 2, cy = (openA.y0 + openA.y1) / 2;
    for (const x of [openA.a0 + 0.03, openA.a1 - 0.03, cx - w / 6, cx + w / 6]) B(0.05, h, 0.08, mFrame, [x, cy, ZF - 0.05]);
    B(w, 0.05, 0.08, mFrame, [cx, openA.y1 - 0.025, ZF - 0.05]); B(w, 0.05, 0.08, mFrame, [cx, openA.y0 + 0.025, ZF - 0.05]);
    B(w, 0.03, 0.06, mFrame, [cx, openA.y0 + h * 0.72, ZF - 0.05]);
    const gp = B(w - 0.06, h - 0.06, 0.006, mGlassShow, [cx, cy, ZF - 0.05]); gp.castShadow = false; ctx.noOutline(gp);
  }
  // side window C: two sliding sashes with a lattice + bamboo blind (すだれ)
  {
    const w = openC.a1 - openC.a0, h = openC.y1 - openC.y0, cx = (openC.a0 + openC.a1) / 2;
    K.window(g, { x: cx, y0: openC.y0, z: ZF - 0.06, w, h, frame: mFrame, glass: mGlass, sill: false, panes: 2, lattice: 0.085 });
    const sh = h * 0.62;
    K.tbox(g, w + 0.1, sh, 0.012, K.mt('#d9c08a', T.bamboo, { paint: 0.03 }), [cx, openC.y1 - sh / 2 + 0.02, ZF + 0.05], 0.5);
    K.cylX(g, 0.02, w + 0.14, K.m('#b8955e'), [cx, openC.y1 + 0.04, ZF + 0.05], 8);
    K.box(g, w + 0.1, 0.03, 0.02, K.m('#8a6a40'), [cx, openC.y1 - sh + 0.02, ZF + 0.05]);
    for (const x of [openC.a0 + 0.25, openC.a1 - 0.25]) ctx.wires.add([[S.w2(x, ZF + 0.062).x, S.f.y + openC.y1 + 0.04, S.w2(x, ZF + 0.062).z], [S.w2(x, ZF + 0.062).x, S.f.y + openC.y1 - sh + 0.02, S.w2(x, ZF + 0.062).z]], { width: 0.008, color: '#7a5d3a' });
  }
  // doors B: sliding glass panels (left fixed in outer track, right one slides open when you approach)
  const doorH = 2.05;
  B(openB.a1 - openB.a0, 0.04, 0.16, mFrame, [(openB.a0 + openB.a1) / 2, FL + 0.005, ZF - 0.06]); // 敷居
  B(openB.a1 - openB.a0, 0.08, 0.16, mFrame, [(openB.a0 + openB.a1) / 2, FL + doorH + 0.04, ZF - 0.06]); // 鴨居
  const pw = (openB.a1 - openB.a0) / 2 + 0.04;
  const doorOpts = { w: pw, h: doorH, d: 0.04, frame: mFrame, glass: mGlass, stile: 0.05, top: 0.06, bottom: 0.08, bars: [0.5], kick: { h: 0.34, mat: K.mt('#7d5f49', T.vboards), tile: 1.5 } };
  const leftDoor = K.panel(g, doorOpts); leftDoor.position.set(openB.a0 + pw / 2, FL + 0.02, ZF - 0.03);
  const rightDoor = K.panel(S.d, doorOpts); rightDoor.position.set(openB.a1 - pw / 2, FL + 0.02, ZF - 0.085);
  K.autoSlide(S, rightDoor, { cx: 0.8, cz: ZF, r: 2.4, dx: -(pw - 0.1), rest: 1 });   // open during business hours
  S.box(openB.a0, ZF - 0.12, openB.a0 + pw, ZF, FL, FL + 2.1);
  // transom (欄間): frosted glass + wooden lattice
  {
    const y0 = FL + doorH + 0.08, h = openB.y1 - y0, cx = (openB.a0 + openB.a1) / 2, w = openB.a1 - openB.a0;
    const gp = B(w, h, 0.006, mFrost, [cx, y0 + h / 2, ZF - 0.08]); gp.castShadow = false; ctx.noOutline(gp);
    for (let i = 0; i <= 22; i++) B(0.022, h, 0.03, mFrame, [openB.a0 + i * w / 22, y0 + h / 2, ZF - 0.05]);
    B(w, 0.03, 0.03, mFrame, [cx, y0 + h / 2, ZF - 0.05]);
  }

  // ---------------------------------------------------------------- upper floor facade (plaster between timbers)
  const win2 = [{ a0: -3.05, a1: -1.95, y0: Y1 + 0.75, y1: Y1 + 1.85 }, { a0: 1.95, a1: 3.05, y0: Y1 + 0.75, y1: Y1 + 1.85 }];
  K.wall(g, mPlaster, { axis: 'x', a0: X0, a1: X1, y0: Y1, y1: YE, c: ZF - WT / 2, t: WT, holes: win2, tile: 2.5 });
  for (const x of [X0 + 0.07, X1 - 0.07]) B(0.15, H2, 0.18, mPost, [x, Y1 + H2 / 2, ZF - 0.06]);
  K.tbox(g, X1 - X0 + 0.04, 0.2, 0.2, mPost, [0, YE - 0.1, ZF - 0.05], 1);       // 軒桁
  for (const o of win2) {
    const w = o.a1 - o.a0, h = o.y1 - o.y0, cx = (o.a0 + o.a1) / 2;
    K.window(g, { x: cx, y0: o.y0, z: ZF - 0.07, w, h, frame: mFrame, glass: mGlass, panes: 2, lattice: 0.075, behind: K.shoji(), behindD: 0.1 });
    B(w + 0.2, 0.05, 0.12, mFrame, [cx, o.y1 + 0.1, ZF + 0.02]);                        // small drip board
  }
  // carved signboard (彫り看板) with a small tiled cap
  {
    const sw = 3.3, sh = 0.84, sy = Y1 + 1.3;
    B(sw + 0.12, sh + 0.12, 0.08, mPost, [0, sy, ZF + 0.05]);
    K.plane(g, sw, sh, K.toonMemo('#ffffff', { map: signTex(K), paint: 0.03 }), [0, sy, ZF + 0.092]);
    K.tbox(g, sw + 0.4, 0.06, 0.28, mRoof, [0, sy + sh / 2 + 0.12, ZF + 0.08], 2.1, [0.18, 0, 0]);
    B(sw + 0.42, 0.05, 0.05, mRoofDark, [0, sy + sh / 2 + 0.1, ZF + 0.22]);
    for (const x of [-1.2, 1.2]) B(0.07, 0.07, 0.14, mPost, [x, sy + sh / 2 + 0.03, ZF + 0.02]);
  }
  // projecting vertical lightbox (袖看板) at the north end
  K.sodeSign(g, { x: X0 + 0.32, y: Y1 + 0.25, z: ZF, w: 0.5, h: 1.75, tex: sodeTex(K), frame: '#e9e2d4' });

  // ---------------------------------------------------------------- pent roof (庇) over the shop front
  K.pent(g, { x0: X0 - 0.06, x1: X1 + 0.06, zWall: ZF, depth: 1.0, drop: 0.32, y: Y1 + 0.12, mat: mRoof, tile: 2.1, fascia: mFrame, edgeTiles: mRoofDark, brackets: [X0 + 0.08, -0.95, 1.475, X1 - 0.08], bracketMat: mPost });
  B(X1 - X0 + 0.14, 0.12, 0.12, mRoofDark, [0, Y1 + 0.15, ZF + 0.04]); // flashing where it meets the wall
  K.gutterX(g, X0 - 0.02, X1 + 0.02, Y1 + 0.12 - 0.32 - 0.06, ZF + 1.05, mGutter);
  // small lightbox under the pent roof
  {
    const lb = K.rboxR(g, 1.05, 0.3, 0.1, 0.02, K.m('#e8e0d0'), [-2.18, FL + 2.76, ZF + 0.1]);
    K.plane(g, 0.98, 0.24, K.memo('emi', '#ffffff', { map: lightboxTex(K) }, 1.02), [-2.18, FL + 2.76, ZF + 0.152]);
  }
  // noren (暖簾) at the door
  K.noren(S, { x: (openB.a0 + openB.a1) / 2, y: FL + 2.55, z: ZF + 0.1, w: 2.05, h: 0.92, n: 3, tex: norenTex(K, 2.05, 3), rodColor: '#5a4032' });
  for (const x of [openB.a0 - 0.05, openB.a1 + 0.05]) B(0.04, 0.12, 0.12, mFrame, [x, FL + 2.57, ZF + 0.05]);
  // hand-written 営業中 plate + stickers on the fixed door
  K.eigyoPlate(g, leftDoor.position.x, FL + 1.52, ZF + 0.0, 0, '営業中', '');
  ctx.wires.add([S.w2(leftDoor.position.x - 0.1, ZF - 0.003), S.w2(leftDoor.position.x, ZF - 0.003), S.w2(leftDoor.position.x + 0.1, ZF - 0.003)].map((p, i) => [p.x, S.f.y + FL + 1.6 + (i === 1 ? 0.12 : 0), p.z]), { width: 0.006, color: '#5a4032' });
  K.decal(g, K.hoursSticker(['9:00〜18:00', '定休日 水曜日'], '#d9718f'), 0.2, 0.15, [leftDoor.position.x + 0.22, FL + 0.95, ZF - 0.004]);
  K.decal(rightDoor, K.cashless(), 0.34, 0.106, [0.0, 0.95, 0.024]);
  K.decal(g, springPosterTex(K, 'glass'), 0.36, 0.5, [-1.62, FL + 1.12, ZF - 0.045]);

  // ---------------------------------------------------------------- side & back walls
  for (const [x, m] of [[X0 + WT / 2, 1], [X1 - WT / 2, 1]]) {
    K.wall(g, mSiding, { axis: 'z', a0: ZB, a1: ZF - WT, y0: FL - 0.02, y1: FL + 1.3, c: x, t: WT, tile: 1.8 });
    K.wall(g, mPlasterSide, { axis: 'z', a0: ZB, a1: ZF - WT, y0: FL + 1.3, y1: YE, c: x, t: WT, tile: 2.5 });
    B(WT + 0.02, 0.05, ZF - ZB - WT, mFrame, [x, FL + 1.3, (ZF - WT + ZB) / 2]);
    K.gableEnd(g, mPlasterSide, x, ZB, ZF, YE - 0.001, zR, yR - 0.08, WT, 2.5);
    S.box(x - WT / 2, ZB, x + WT / 2, ZF, FL - 0.1, YE);
    const sx = x + Math.sign(x) * (WT / 2 + 0.015);
    for (let z = ZB + 0.08; z <= ZF - WT; z += (ZF - WT - ZB - 0.08) / 5) B(0.04, YE - FL - 1.3, 0.12, mPost, [sx, (YE + FL + 1.3) / 2, z]);
    B(0.05, 0.14, ZF - ZB, mPost, [sx, Y1 + 0.05, (ZF + ZB) / 2]);
    B(0.05, 0.16, ZF - ZB, mPost, [sx, YE - 0.08, (ZF + ZB) / 2]);
  }
  K.wall(g, mPlasterSide, { axis: 'x', a0: X0 + WT, a1: X1 - WT, y0: FL - 0.02, y1: YE, c: ZB + WT / 2, t: WT, holes: [{ a0: 1.6, a1: 2.5, y0: FL, y1: FL + 1.9 }, { a0: -2.6, a1: -1.4, y0: FL + 1.0, y1: FL + 1.8 }, { a0: -1.2, a1: 0.2, y0: Y1 + 0.7, y1: Y1 + 1.7 }], tile: 2.5 });
  B(0.9, 1.9, 0.05, K.mt('#7d6250', T.vboards), [2.05, FL + 0.95, ZB - 0.02]);                       // back door
  K.window(g, { x: -2.0, y0: FL + 1.0, z: ZB - 0.03, w: 1.2, h: 0.8, frame: K.m(C.aluDark), glass: mFrost, panes: 2, rotY: Math.PI });
  K.window(g, { x: -0.5, y0: Y1 + 0.7, z: ZB - 0.03, w: 1.4, h: 1.0, frame: K.m(C.aluDark), glass: mGlass, panes: 2, rotY: Math.PI, behind: K.curtain('#e9d9c9') });
  S.box(X0, ZB, X1, ZI, FL - 0.1, YE);                        // back rooms are solid
  S.box(X0, ZF - WT, openB.a0, ZF, FL - 0.1, Y1);            // facade left of the door
  S.box(openB.a1, ZF - WT, X1, ZF, FL - 0.1, Y1);            // facade right of the door

  // ---------------------------------------------------------------- main roof (平入り, kawara)
  K.gableX(g, { x0: X0 - 0.22, x1: X1 + 0.22, zf: ZF + OV, zb: ZB - OV, yE: YE + 0.06 - PITCH * OV, yR, zR, t: 0.12, mat: mRoof, tile: 2.1, fascia: mFrame, edgeTiles: mRoofDark });
  K.ridgeX(g, X0 - 0.22, X1 + 0.22, yR + 0.02, zR, mRoofDark, K.m('#4a525e'));
  for (const x of [X0 - 0.2, X1 + 0.2]) for (const side of [1, -1]) { // barge boards (破風)
    const ze = side > 0 ? ZF + OV : ZB - OV; const run = Math.abs(ze - zR), rise = yR - (YE + 0.06 - PITCH * OV), len = Math.hypot(run, rise), ang = Math.atan2(rise, run);
    B(0.05, 0.2, len, mFrame, [x, (yR + YE + 0.06 - PITCH * OV) / 2 - 0.02, (ze + zR) / 2], [side * ang, 0, 0]);
  }
  K.gutterX(g, X0 - 0.2, X1 + 0.2, YE + 0.06 - PITCH * OV - 0.1, ZF + OV + 0.05, mGutter);
  K.downpipe(g, X0 - 0.12, ZF + 0.25, YE - 0.1, S.gl(X0 - 0.12, ZF + 0.25) + 0.02, mGutter, 0.12);
  K.box(g, 0.07, 0.07, OV - 0.2, mGutter, [X0 - 0.12, YE - 0.2, ZF + 0.55]);

  // ---------------------------------------------------------------- side-gap clutter (AC unit, meters, pipes)
  K.acUnit(g, X1 + 0.02, S.gl(X1, -7) + 0.02, -7.0, Math.PI / 2);
  {
    const wallG = new T3.Group(); wallG.position.set(X1, 0, 0); wallG.rotation.y = Math.PI / 2; g.add(wallG);
    K.meter(wallG, 3.2, FL + 1.55, 0);            // on the +x side wall, local x along -z
    K.gasMeter(wallG, 4.4, FL + 0.95, 0);
    K.pipeRun(g, [[X1 + 0.05, S.gl(X1, -6.2) + 0.05, -6.2], [X1 + 0.05, FL + 0.6, -6.2], [X1 + 0.05, FL + 0.6, -5.4]], 0.018, K.m('#c9c2b0'));
  }
  S.box(X1, -7.4, 3.75, -6.6, 0, 0.7);

  // ---------------------------------------------------------------- interior
  buildInterior();
  function buildInterior() {
    buildWagashiInterior(ctx, K, S, { FL, ZF, ZI, WT, X0, X1 });
    // display window tiers (ひな壇) inside window A
    const dz0 = ZF - WT - 0.02;
    [[0.0, 0.62, 0.7], [0.22, 0.42, 0.95], [0.4, 0.26, 1.18]].forEach(([off, dep, y]) => {
      K.box(g, openA.a1 - openA.a0 + 0.1, 0.04, dep, iRed, [(openA.a0 + openA.a1) / 2, FL + y, dz0 - off - dep / 2]);
      K.box(g, openA.a1 - openA.a0 + 0.1, y - 0.02, 0.02, iWoodDark, [(openA.a0 + openA.a1) / 2, FL + y / 2, dz0 - off - dep]);
    });
    K.box(g, openA.a1 - openA.a0 + 0.1, 0.7, 0.62, iWoodDark, [(openA.a0 + openA.a1) / 2, FL + 0.34, dz0 - 0.31]);
    S.box(X0, dz0 - 0.7, openA.a1 + 0.05, ZF, FL, FL + 1.3);
    // items on the tiers
    giftBox(g, K, -2.9, FL + 0.72, dz0 - 0.2, 0.36, 0.1, 0.26, 20);
    giftBox(g, K, -2.9, FL + 0.82, dz0 - 0.2, 0.32, 0.08, 0.22, 21);
    giftBox(g, K, -1.45, FL + 0.72, dz0 - 0.22, 0.34, 0.12, 0.26, 22);
    platter(g, K, 'sakura', -2.2, FL + 0.72, dz0 - 0.22, rnd);
    platter(g, K, 'dango', -2.6, FL + 0.97, dz0 - 0.4, rnd);
    platter(g, K, 'kashiwa', -1.75, FL + 0.97, dz0 - 0.4, rnd);
    giftBox(g, K, -2.25, FL + 1.2, dz0 - 0.55, 0.4, 0.14, 0.2, 23);
    sakuraSpray(g, K, -1.3, FL + 1.2, dz0 - 0.55, 0.75, rnd);
    K.plane(g, 0.2, 0.1, K.im('#ffffff', 0.3, { map: K.card(['桜もち', '三個入 540円'], { w: 192, h: 96, font: F.serif, fg: '#4a2e2a', fg2: '#a33a36' }) }), [-2.2, FL + 0.8, dz0 - 0.02], 0, -0.2);
  }

  // ---------------------------------------------------------------- outside furniture
  const ag = (x, z) => S.gl(x, z) + 0.035;
  // red bench (縁台) with red felt (毛氈) + tea & dango
  {
    const bx = 2.45, bz = -0.78, len = 1.5, dep = 0.5, sh = 0.42, y0 = ag(bx, bz);
    const bg = new T3.Group(); bg.position.set(bx, y0, bz); g.add(bg);
    const wood = K.mt('#9a6a48', T.grain), felt = K.m('#cf5048', { paint: 0.07 });
    for (const sx of [-len / 2 + 0.1, len / 2 - 0.1]) for (const sz of [-dep / 2 + 0.07, dep / 2 - 0.07]) K.box(bg, 0.06, sh - 0.05, 0.06, wood, [sx, (sh - 0.05) / 2, sz]);
    for (const sx of [-len / 2 + 0.1, len / 2 - 0.1]) K.box(bg, 0.05, 0.05, dep - 0.1, wood, [sx, 0.1, 0]);
    K.tbox(bg, len, 0.04, dep, wood, [0, sh - 0.03, 0], 1);
    K.box(bg, len + 0.05, 0.012, dep + 0.05, felt, [0, sh - 0.004, 0]);
    K.box(bg, len + 0.05, 0.13, 0.012, felt, [0, sh - 0.07, dep / 2 + 0.025]);
    K.box(bg, len + 0.05, 0.13, 0.012, felt, [0, sh - 0.07, -dep / 2 - 0.025]);
    // tray with tea + dango
    K.box(bg, 0.3, 0.02, 0.2, K.m('#7a4a38'), [-0.3, sh + 0.012, 0.02]);
    K.cyl(bg, 0.032, 0.07, K.m('#8aa39a'), [-0.38, sh + 0.057, 0.03], 10, null, 0.028);
    K.cyl(bg, 0.027, 0.004, K.m('#9fb46a'), [-0.38, sh + 0.09, 0.03], 10);
    K.cyl(bg, 0.07, 0.012, K.m('#ece6d8'), [-0.24, sh + 0.028, 0.02], 14);
    dango(bg, K, -0.24, sh + 0.05, 0.02, 0.4, false);
    dango(bg, K, -0.23, sh + 0.05, 0.05, 0.25, false);
    S.box(bx - len / 2 - 0.03, bz - dep / 2 - 0.03, bx + len / 2 + 0.03, bz + dep / 2 + 0.03, y0, y0 + sh);
  }
  // wooden display stand (陳列台) in front of the show window
  {
    const x = -2.3, z = -0.62, w = 1.5, dep = 0.55, y0 = ag(x, z);
    const sg = new T3.Group(); sg.position.set(x, y0, z); g.add(sg);
    const wood = K.mt('#b08560', T.grain), dark = K.mt('#7a5a42', T.grain);
    for (const sx of [-w / 2 + 0.05, w / 2 - 0.05]) for (const sz of [-dep / 2 + 0.05, dep / 2 - 0.05]) K.box(sg, 0.05, 0.72, 0.05, dark, [sx, 0.36, sz]);
    K.tbox(sg, w, 0.04, dep, wood, [0, 0.72, 0], 1);
    K.tbox(sg, w, 0.04, 0.26, wood, [0, 0.92, -0.14], 1);
    for (const sx of [-w / 2 + 0.05, w / 2 - 0.05]) K.box(sg, 0.04, 0.2, 0.26, dark, [sx, 0.82, -0.14]);
    K.box(sg, w - 0.1, 0.04, dep - 0.1, dark, [0, 0.16, 0]);
    // packaged sakura-mochi in clear packs + gift boxes + price cards
    for (let i = 0; i < 4; i++) {
      const px = -0.52 + i * 0.3;
      K.box(sg, 0.22, 0.01, 0.15, K.m('#6a8a58'), [px, 0.745, 0.12]);
      for (let j = 0; j < 3; j++) sakuraMochi(sg, K, px - 0.06 + j * 0.06, 0.755, 0.12, 0.2 * j);
      const lid = K.box(sg, 0.23, 0.05, 0.16, K.glass({ opacity: 0.15, streaks: false }), [px, 0.765, 0.12]); lid.castShadow = false; ctx.noOutline(lid);
      K.box(sg, 0.08, 0.05, 0.002, K.m('#f3d7df'), [px + 0.07, 0.77, 0.201]);
    }
    for (let i = 0; i < 3; i++) giftBox(sg, K, -0.45 + i * 0.45, 0.94, -0.14, 0.34, 0.1, 0.2, 30 + i);
    for (let i = 0; i < 3; i++) K.box(sg, 0.14, 0.004, 0.14, K.m('#f7f3ea'), [-0.55 + i * 0.52, 0.745, -0.07]);
    K.plane(sg, 0.26, 0.14, K.mt('#ffffff', K.card(['桜もち', '三個入 540円'], { w: 192, h: 104, font: F.serif, fg: '#4a2e2a', fg2: '#a33a36', bg: '#fbeef2', border: '#e38aa6' })), [0.52, 1.03, 0.0], 0, -0.3);
    K.plane(sg, 0.26, 0.14, K.mt('#ffffff', K.card(['柏もち', '一個 160円'], { w: 192, h: 104, font: F.serif, fg: '#35502e', fg2: '#35502e', bg: '#eef2e4', border: '#7fa36b' })), [-0.52, 1.03, 0.0], 0, -0.3);
    S.box(x - w / 2, z - dep / 2, x + w / 2, z + dep / 2, y0, y0 + 1.0);
  }
  // maneki-neko by the door on a small stool
  {
    const x = -1.18, z = -0.98, y0 = ag(x, z);
    const st = K.mt('#8a6446', T.grain);
    K.box(g, 0.3, 0.04, 0.3, st, [x, y0 + 0.4, z]);
    for (const sx of [-0.12, 0.12]) for (const sz of [-0.12, 0.12]) K.box(g, 0.035, 0.38, 0.035, st, [x + sx, y0 + 0.19, z + sz]);
    K.box(g, 0.25, 0.03, 0.25, K.m('#c9463e'), [x, y0 + 0.435, z]);
    manekiNeko(g, K, x, y0 + 0.45, z, 0.35, 0.3);
    S.box(x - 0.16, z - 0.16, x + 0.16, z + 0.16, y0, y0 + 0.8);
  }
  // pink standing poster 春季限定 桜もち
  {
    const x = -3.45, z = -0.32, y0 = ag(x, z), rot = 0.55;
    const pg = new T3.Group(); pg.position.set(x, y0, z); pg.rotation.y = rot; g.add(pg);
    const fm = K.m('#e8e1d4');
    for (const sx of [-0.23, 0.23]) K.box(pg, 0.03, 1.2, 0.03, fm, [sx, 0.6, 0]);
    K.box(pg, 0.5, 0.03, 0.03, fm, [0, 1.19, 0]);
    K.box(pg, 0.44, 0.04, 0.3, K.m('#8d949b'), [0, 0.02, 0]);
    K.box(pg, 0.44, 0.64, 0.015, K.m('#f3e4e8'), [0, 0.84, -0.005]);
    K.plane(pg, 0.42, 0.62, K.toonMemo('#ffffff', { map: springPosterTex(K, 'stand') }), [0, 0.84, 0.004]);
    S.box(x - 0.25, z - 0.2, x + 0.25, z + 0.2, y0, y0 + 1.2);
  }
  // taiyaki nobori (animated) at the south corner
  K.nobori(S, { x: 3.52, z: -0.2, rot: -0.35, tex: taiyakiNoboriTex(K), w: 0.45, h: 1.65, poleH: 2.55, flip: true });
  // potted plants + wooden bucket (手桶) with ladle by the door
  K.plant(g, 1.55, ag(1.55, -0.95), -0.95, { r: 0.17, h: 0.28, pot: '#6f7f8f', leaf: '#5f8c5c', leaf2: '#78a466', flowers: '#f0a9bf', n: 6 });
  {
    const x = -0.95 + 3.9, z = -0.45;
    K.cyl(g, 0.14, 0.22, K.mt('#b89468', T.vboards), [-3.2, ag(-3.2, -1.05) + 0.11, -1.05], 14, null, 0.12);
    K.cyl(g, 0.145, 0.025, K.m('#6d747c'), [-3.2, ag(-3.2, -1.05) + 0.17, -1.05], 14);
    K.cyl(g, 0.008, 0.36, K.m('#a88a60'), [-3.14, ag(-3.2, -1.05) + 0.3, -1.05], 6, [0, 0, -0.5]);
    K.cyl(g, 0.035, 0.04, K.m('#a88a60'), [-3.07, ag(-3.2, -1.05) + 0.44, -1.05], 8);
    void x; void z;
  }

  return { FL, S };
}

// ============================================================================ sweets & small goods
function sweetName(k) { return { sakura: '桜もち', dango: '三色だんご', dora: 'どら焼き', kashiwa: '柏もち', daifuku: '豆大福', kusa: '草もち' }[k]; }
function sweetPrice(k) { return { sakura: '一八〇円', dango: '一五〇円', dora: '二〇〇円', kashiwa: '一六〇円', daifuku: '一八〇円', kusa: '一六〇円' }[k]; }

function sakuraMochi(p, K, x, y, z, rot = 0, interior = false) {
  const pink = interior ? K.im('#f1a9bd', 0.3) : K.m('#f1a9bd'), leaf = interior ? K.im('#8c8f4c', 0.25) : K.m('#8c8f4c');
  K.sph(p, 0.026, pink, [x, y + 0.017, z], 8, [1.3, 0.7, 0.9]);
  const l = K.sph(p, 0.028, leaf, [x + 0.004, y + 0.012, z - 0.006], 8, [1.35, 0.55, 1.0]); l.rotation.y = rot;
}
function dango(p, K, x, y, z, rot = 0, interior = true) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rot; p.add(g);
  const f = interior ? (c) => K.im(c, 0.3) : (c) => K.m(c);
  K.cylX(g, 0.003, 0.17, f('#d9c08a'), [0, 0.012, 0], 5);
  ['#f2a7bb', '#f3efe4', '#9cc27a'].forEach((c, i) => K.sph(g, 0.017, f(c), [-0.035 + i * 0.034, 0.014, 0], 8));
}
function sweetsTray(p, K, kind, x, y, z, w, d, rnd, interior) {
  const f = (c) => interior ? K.im(c, 0.3) : K.m(c);
  const cols = kind === 'dango' ? 2 : 3, rows = kind === 'dango' ? 4 : 3;
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
    const px = x - w / 2 + w * (i + 0.5) / cols + rnd.range(-0.008, 0.008), pz = z - d / 2 + d * (j + 0.5) / rows;
    if (kind === 'sakura') sakuraMochi(p, K, px, y, pz, rnd() * 0.5, interior);
    else if (kind === 'dango') dango(p, K, px, y, pz, 0.08 * (rnd() - 0.5), interior);
    else if (kind === 'dora') { K.sph(p, 0.038, f('#b8793f'), [px, y + 0.018, pz], 10, [1, 0.3, 1]); K.sph(p, 0.037, f('#c98a4e'), [px, y + 0.034, pz], 10, [1, 0.26, 1]); }
    else if (kind === 'kashiwa') { K.sph(p, 0.03, f('#6f8a4a'), [px, y + 0.012, pz], 8, [1.35, 0.5, 1.0]); K.sph(p, 0.024, f('#f1ede4'), [px + 0.005, y + 0.02, pz + 0.004], 8, [1.2, 0.7, 0.85]); }
    else if (kind === 'daifuku') { K.sph(p, 0.028, f('#f4f0e8'), [px, y + 0.018, pz], 10, [1, 0.72, 1]); K.sph(p, 0.005, f('#5a4050'), [px + 0.01, y + 0.03, pz + 0.012], 5); }
    else if (kind === 'kusa') { K.sph(p, 0.027, f('#8fae6a'), [px, y + 0.017, pz], 10, [1.1, 0.7, 1]); }
  }
}
function platter(p, K, kind, x, y, z, rnd) {
  K.cyl(p, 0.12, 0.018, K.im('#e9e4d8', 0.3), [x, y + 0.009, z], 16);
  K.cyl(p, 0.121, 0.006, K.im('#6b86a8', 0.3), [x, y + 0.019, z], 16);
  sweetsTray(p, K, kind, x, y + 0.02, z, 0.16, 0.12, rnd, true);
}
const WRAP = [['#f3c9d4', '#e28ea8'], ['#dfe8cf', '#7fa36b'], ['#efe2c8', '#c08a54'], ['#d7dfea', '#6b86a8'], ['#f5e6c8', '#d9a441'], ['#ecd3dd', '#b56a86']];
function wrapTex(K, i) {
  const [bg, fg] = WRAP[i % WRAP.length];
  return K.tex.draw(128, 128, (g, w, h) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.fillStyle = fg;
    for (let a = 0; a < 5; a++) for (let b = 0; b < 5; b++) { const cx = a * 28 + (b % 2) * 14, cy = b * 28; sakuraFlower(g, cx, cy, 5, fg); }
    g.fillStyle = 'rgba(250,246,236,0.95)'; g.fillRect(w * 0.36, 0, w * 0.28, h);           // noshi band
    g.fillStyle = '#b8423c'; g.fillRect(w * 0.36, h * 0.46, w * 0.28, 5);
  }, { key: 'sb-wrap' + (i % WRAP.length) });
}
function sakuraFlower(g, x, y, r, col) {
  g.fillStyle = col;
  for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2 - Math.PI / 2; g.beginPath(); g.ellipse(x + Math.cos(a) * r, y + Math.sin(a) * r, r * 0.75, r * 0.55, a, 0, 7); g.fill(); }
  g.fillStyle = 'rgba(255,255,255,0.7)'; g.beginPath(); g.arc(x, y, r * 0.35, 0, 7); g.fill();
}
function giftBox(p, K, x, y, z, w, h, d, i, rotY = 0) {
  const m = K.im('#ffffff', 0.28, { map: wrapTex(K, i) });
  const b = K.box(p, w, h, d, m, [x, y + h / 2, z]); b.rotation.y = rotY;
  const r = K.box(p, w + 0.004, 0.012, d * 0.2, K.im('#c9463e', 0.25), [x, y + h + 0.001, z]); r.rotation.y = rotY;
  return b;
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
  const m = K.im('#ffffff', 0.3, { map: t });
  const cy = K.cyl(p, 0.042, 0.14, m, [x, y + 0.07, z], 14); cy.rotation.y = -Math.PI / 2 + 0.6;
  K.cyl(p, 0.044, 0.035, K.im('#b9bfc4', 0.3), [x, y + 0.155, z], 14);
}
function ceramic(p, K, x, y, z, i, rnd) {
  const cols = ['#b7c7c9', '#c8a27a', '#e9e4d8', '#8aa39a', '#d8b9a8', '#6b86a8'];
  const c = K.im(cols[i % cols.length], 0.3);
  if (i % 3 === 0) { // teapot
    K.sph(p, 0.07, c, [x, y + 0.065, z], 12, [1, 0.85, 1]);
    K.cyl(p, 0.012, 0.08, c, [x, y + 0.08, z + 0.075], 6, [0.9, 0, 0]);
    K.cyl(p, 0.03, 0.02, c, [x, y + 0.13, z], 10);
  } else if (i % 3 === 1) { // cups (湯呑) pair
    for (const dz of [-0.06, 0.06]) K.cyl(p, 0.035, 0.08, c, [x, y + 0.04, z + dz], 10, null, 0.03);
  } else { // stacked plates
    for (let k = 0; k < 4; k++) K.cyl(p, 0.09, 0.012, c, [x, y + 0.006 + k * 0.013, z], 14);
  }
}
function sakuraSpray(p, K, x, y, z, h, rnd) {
  K.cyl(p, 0.04, 0.16, K.im('#6b86a8', 0.3), [x, y + 0.08, z], 12, null, 0.05);
  const bark = K.im('#6a5448', 0.2), pink = K.im('#f6c9d6', 0.35), pink2 = K.im('#f0b0c4', 0.3);
  const br = [[0, 0, 0.1, h, 0.05], [0.02, h * 0.45, 0.2, h * 0.85, -0.3], [-0.02, h * 0.3, -0.18, h * 0.7, 0.2]];
  for (const [x0, y0, x1, y1] of br) {
    const len = Math.hypot(x1 - x0, y1 - y0), ang = Math.atan2(x1 - x0, y1 - y0);
    K.cyl(p, 0.006, len, bark, [x + (x0 + x1) / 2, y + 0.16 + (y0 + y1) / 2, z], 5, [0, 0, -ang]);
    for (let k = 0; k < 12; k++) { const t = 0.25 + 0.75 * k / 11; K.sph(p, 0.012 + rnd() * 0.008, k % 2 ? pink : pink2, [x + x0 + (x1 - x0) * t + rnd.range(-0.035, 0.035), y + 0.16 + y0 + (y1 - y0) * t + rnd.range(-0.025, 0.025), z + rnd.range(-0.035, 0.035)], 6); }
  }
}
/** Maneki-neko (招き猫): calico, right paw raised, gold koban. */
function manekiNeko(p, K, x, y, z, s = 0.3, rotY = 0) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rotY; g.scale.setScalar(s / 0.3); p.add(g);
  const white = K.m('#f3efe6'), red = K.m('#c9463e'), gold = K.m('#e3bd52'), ink = K.m('#3a3346'), orange = K.m('#e2a04e'), pinkM = K.m('#f0a6b6');
  K.sph(g, 0.1, white, [0, 0.09, 0], 14, [1, 0.95, 0.85]);             // body
  K.sph(g, 0.085, white, [0, 0.23, 0.01], 14, [1.1, 0.95, 0.95]);      // head
  for (const sx of [-1, 1]) { const e = K.cyl(g, 0.0, 0.05, white, [sx * 0.055, 0.31, 0.0], 6, [0, 0, sx * -0.3], 0.03); e.scale.set(1, 0.06, 1); }
  for (const sx of [-1, 1]) K.sph(g, 0.012, pinkM, [sx * 0.056, 0.305, 0.018], 6);
  K.sph(g, 0.03, orange, [0.045, 0.285, 0.03], 8, [1.2, 0.6, 1]);      // calico patch
  K.sph(g, 0.03, ink, [-0.07, 0.12, 0.04], 8, [0.9, 1, 0.6]);
  for (const sx of [-1, 1]) K.box(g, 0.026, 0.008, 0.01, ink, [sx * 0.033, 0.235, 0.088], [0, 0, sx * 0.25]); // happy closed eyes
  K.sph(g, 0.008, pinkM, [0, 0.215, 0.093], 6);
  for (const sx of [-1, 1]) for (let k = 0; k < 2; k++) K.box(g, 0.035, 0.003, 0.003, ink, [sx * 0.07, 0.205 - k * 0.012, 0.085], [0, 0, sx * (0.12 - k * 0.2)]);
  K.cyl(g, 0.078, 0.018, red, [0, 0.16, 0.012], 14);                  // collar
  K.sph(g, 0.018, gold, [0, 0.145, 0.08], 8);                          // bell
  K.sph(g, 0.03, white, [0.085, 0.3, 0.035], 8, [0.9, 1.4, 0.9]);      // raised right paw
  K.sph(g, 0.012, pinkM, [0.085, 0.32, 0.06], 6);
  K.box(g, 0.08, 0.1, 0.012, gold, [-0.04, 0.09, 0.09], [0, 0, 0.1]);  // koban
  K.box(g, 0.05, 0.004, 0.004, K.m('#8a6a2a'), [-0.04, 0.1, 0.097], [0, 0, 0.1]);
  K.sph(g, 0.028, white, [-0.06, 0.1, 0.075], 8);                       // left paw holding koban
}

// ============================================================================ textures
function signTex(K) {
  return K.tex.draw(1024, 256, (g, w, h) => {
    const r = K.ctx.rng('sb-oug-sign');
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#5a4131'); gr.addColorStop(1, '#46321f');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(255,230,190,0.07)'; g.lineWidth = 2;
    for (let i = 0; i < 40; i++) { const y = r() * h; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(w * 0.3, y + r() * 12 - 6, w * 0.7, y + r() * 12 - 6, w, y + r() * 8 - 4); g.stroke(); }
    g.strokeStyle = 'rgba(20,10,5,0.5)'; g.lineWidth = 8; g.strokeRect(14, 14, w - 28, h - 28);
    g.strokeStyle = 'rgba(230,200,140,0.35)'; g.lineWidth = 2; g.strokeRect(22, 22, w - 44, h - 44);
    K.carve(g, '桜月堂', w * 0.5, h * 0.54, 168, K.F.brush, '#ead7a4', 400);
    g.font = `700 30px ${K.F.serif}`; g.fillStyle = '#e2cc93';
    K.vtext(g, '和菓子処', w * 0.9, h * 0.14, 38, 1.0);
    g.font = `700 22px ${K.F.serif}`; g.fillStyle = 'rgba(226,204,147,0.85)';
    K.vtext(g, '創業昭和廿八年', w * 0.09, h * 0.1, 26, 1.0);
    // small sakura crest
    sakuraFlower(g, w * 0.2, h * 0.5, 16, '#e9a3b8');
  }, { key: 'sb-oug-sign' });
}
function sodeTex(K) {
  return K.tex.draw(160, 560, (g, w, h) => {
    g.fillStyle = '#f5efe2'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#e9a3b8'; g.fillRect(0, 0, w, 60);
    sakuraFlower(g, w / 2, 30, 14, '#fbf4f0');
    g.strokeStyle = '#8e3b36'; g.lineWidth = 5; g.strokeRect(8, 68, w - 16, h - 76);
    g.fillStyle = '#8e3b36'; g.font = `400 100px ${K.F.brush}`; K.vtext(g, '和菓子', w / 2, 84, 100, 1.02);
    g.fillStyle = '#3a3346'; g.font = `700 44px ${K.F.serif}`; K.vtext(g, '桜月堂', w / 2, 402, 46, 1.02);
  }, { key: 'sb-oug-sode' });
}
function lightboxTex(K) {
  return K.tex.draw(512, 128, (g, w, h) => {
    g.fillStyle = '#f6efe0'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#e9a3b8'; g.fillRect(0, h - 14, w, 14);
    sakuraFlower(g, 50, h / 2 - 6, 18, '#e38aa6');
    K.text(g, '御菓子司 桜月堂', w * 0.56, h * 0.46, w * 0.78, 64, K.F.serif, 700, '#6b2e2a');
  }, { key: 'sb-oug-lightbox' });
}
function norenTex(K, W, n) {
  return K.tex.draw(768, 360, (g, w, h) => {
    const r = K.ctx.rng('sb-oug-noren');
    g.fillStyle = '#3f4f7e'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2000; i++) { g.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,30,0.05)'; g.fillRect(r() * w, r() * h, 2, 2); }
    g.fillStyle = 'rgba(240,235,222,0.92)'; g.fillRect(0, 0, w, 22);
    const gap = 0.014, sw = (W - gap * (n - 1)) / n;
    const chars = ['和', '菓', '子'];
    for (let i = 0; i < n; i++) {
      const cx = (i * (sw + gap) + sw / 2) / W * w;
      K.text(g, chars[i], cx, h * 0.5, w / n * 0.9, 170, K.F.brush, 400, '#f3eee2');
    }
    sakuraFlower(g, w * 0.86, h * 0.86, 13, '#f2b5c8');
    K.text(g, '桜月堂', w * 0.72, h * 0.87, 140, 28, K.F.serif, 700, '#f3eee2');
  }, { key: 'sb-oug-noren' });
}
function innerNorenTex(K) {
  return K.tex.draw(256, 180, (g, w, h) => {
    g.fillStyle = '#f0ebe0'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#e9e2d4'; g.fillRect(w / 2 - 2, 20, 4, h);
    sakuraFlower(g, w / 2, h * 0.52, 24, '#e38aa6');
  }, { key: 'sb-oug-innernoren' });
}
function springPosterTex(K, variant) {
  return K.tex.draw(256, 368, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#fbe3ea'); gr.addColorStop(1, '#f2b5c8');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    const r = K.ctx.rng('sb-spring' + variant);
    for (let i = 0; i < 14; i++) sakuraFlower(g, r() * w, r() * h, 6 + r() * 7, 'rgba(255,255,255,0.55)');
    g.fillStyle = '#d9718f'; K.rr(g, 18, 18, w - 36, 52, 26); g.fill();
    K.text(g, '春季限定', w / 2, 45, w - 60, 36, K.F.round, 900, '#fff8f4');
    if (variant === 'glass') {
      K.text(g, 'お花見だんご', w / 2, 118, w - 30, 40, K.F.round, 900, '#8e3b36');
      K.text(g, 'はじめました', w / 2, 160, w - 30, 30, K.F.round, 700, '#8e3b36');
      // dango drawing
      g.strokeStyle = '#b08a5a'; g.lineWidth = 5; g.beginPath(); g.moveTo(60, 300); g.lineTo(200, 200); g.stroke();
      [['#f2a7bb', 90, 278], ['#f7f2ea', 125, 253], ['#9cc27a', 160, 228]].forEach(([c, x, y]) => { g.fillStyle = c; g.beginPath(); g.arc(x, y, 24, 0, 7); g.fill(); g.strokeStyle = 'rgba(90,60,70,0.4)'; g.lineWidth = 2; g.stroke(); });
      K.text(g, '一本 150円', w / 2, 340, w - 40, 28, K.F.round, 700, '#6b2e2a');
    } else {
      g.fillStyle = '#8e3b36'; g.font = `400 88px ${K.F.brush}`; K.vtext(g, '桜もち', w * 0.7, 86, 88, 0.98);
      // sakura-mochi drawing
      g.fillStyle = '#8c8f4c'; g.beginPath(); g.ellipse(88, 214, 62, 40, -0.3, 0, 7); g.fill();
      g.fillStyle = '#f1a0b8'; g.beginPath(); g.ellipse(96, 206, 48, 32, -0.2, 0, 7); g.fill();
      g.strokeStyle = 'rgba(110,70,40,0.35)'; g.lineWidth = 2; for (let k = -2; k <= 2; k++) { g.beginPath(); g.moveTo(40, 230 + k * 6); g.lineTo(140, 190 + k * 10); g.stroke(); }
      K.text(g, '一個 180円', w * 0.4, 300, w * 0.7, 30, K.F.round, 900, '#6b2e2a');
      K.text(g, 'ご予約承ります', w / 2, 342, w - 40, 22, K.F.round, 700, '#6b2e2a');
    }
  }, { key: 'sb-spring-' + variant });
}
function taiyakiNoboriTex(K) {
  return K.tex.draw(160, 580, (g, w, h) => {
    g.fillStyle = '#f4ead2'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#f7f3ea'; g.fillRect(w - 18, 0, 18, h);        // sleeve side (pole on the right)
    g.fillStyle = '#c9463e'; g.fillRect(0, 0, w - 18, 70);
    K.text(g, '焼きたて', (w - 18) / 2, 36, w - 30, 34, K.F.round, 900, '#fff6ea');
    g.fillStyle = '#2f3f6e'; g.font = `400 112px ${K.F.brush}`; K.vtext(g, 'たい焼き', (w - 18) / 2, 84, 104, 0.98);
    // little taiyaki
    const fx = (w - 18) / 2, fy = 520;
    g.fillStyle = '#c98a4e'; g.beginPath(); g.ellipse(fx - 8, fy, 44, 24, 0, 0, 7); g.fill();
    g.beginPath(); g.moveTo(fx + 28, fy); g.lineTo(fx + 56, fy - 22); g.lineTo(fx + 56, fy + 22); g.closePath(); g.fill();
    g.strokeStyle = '#8e5a2c'; g.lineWidth = 2; for (let k = 0; k < 4; k++) { g.beginPath(); g.arc(fx - 10 + k * 12, fy, 9, -1, 1); g.stroke(); }
    g.fillStyle = '#3a3346'; g.beginPath(); g.arc(fx - 38, fy - 6, 4, 0, 7); g.fill();
    g.fillStyle = '#c9463e'; g.fillRect(0, h - 26, w - 18, 26);
    K.text(g, 'つぶあん', (w - 18) / 2, h - 13, w - 30, 20, K.F.round, 900, '#fff6ea');
  }, { key: 'sb-taiyaki-nobori' });
}
function menuTagsTex(K) {
  return K.tex.draw(1024, 228, (g, w, h) => {
    g.fillStyle = '#6e5040'; g.fillRect(0, 0, w, h);
    const items = [['桜もち', '一八〇円'], ['三色だんご', '一五〇円'], ['どら焼き', '二〇〇円'], ['柏もち', '一六〇円'], ['豆大福', '一八〇円'], ['草もち', '一六〇円'], ['みたらし', '一三〇円'], ['煉羊羹', '八〇〇円']];
    const n = items.length, tw = (w - 40) / n;
    items.forEach(([a, b], i) => {
      const x = 20 + i * tw + 6, cw = tw - 12;
      g.fillStyle = i === 0 ? '#f6dde4' : '#efe2c6'; g.fillRect(x, 10, cw, h - 20);
      g.strokeStyle = 'rgba(90,60,40,0.3)'; g.lineWidth = 2; g.strokeRect(x + 3, 13, cw - 6, h - 26);
      g.fillStyle = '#3a2a22'; g.font = `400 34px ${K.F.brush}`;
      const sz = Math.min(34, (h - 90) / [...a].length);
      g.font = `400 ${sz}px ${K.F.brush}`; K.vtext(g, a, x + cw * 0.62, 20, sz, 1.0);
      g.fillStyle = '#a33a36'; g.font = `700 17px ${K.F.serif}`; K.vtext(g, b, x + cw * 0.24, h - 20 - 17 * 4.4, 17, 1.0);
    });
  }, { key: 'sb-oug-menutags' });
}
function clockTex(K) {
  return K.tex.draw(128, 128, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = '#f4efe2'; g.beginPath(); g.arc(w / 2, h / 2, 60, 0, 7); g.fill();
    g.fillStyle = '#3a3346'; for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; g.fillRect(w / 2 + Math.sin(a) * 50 - 2, h / 2 - Math.cos(a) * 50 - 2, 4, 4); }
    g.strokeStyle = '#3a3346'; g.lineWidth = 4; g.beginPath(); g.moveTo(w / 2, h / 2); g.lineTo(w / 2 + 30, h / 2 + 10); g.stroke();   // 16:05
    g.lineWidth = 3; g.beginPath(); g.moveTo(w / 2, h / 2); g.lineTo(w / 2 + 20, h / 2 - 38); g.stroke();
  }, { key: 'sb-clock' });
}
function calendarTex(K) {
  return K.tex.draw(192, 280, (g, w, h) => {
    g.fillStyle = '#f5f0e6'; g.fillRect(0, 0, w, h);
    const gr = g.createLinearGradient(0, 0, 0, 120); gr.addColorStop(0, '#bcd6ea'); gr.addColorStop(1, '#f6dde4'); g.fillStyle = gr; g.fillRect(8, 8, w - 16, 112);
    const r = K.ctx.rng('sb-cal'); for (let i = 0; i < 12; i++) sakuraFlower(g, 20 + r() * (w - 40), 20 + r() * 90, 6 + r() * 5, '#f2a7bb');
    K.text(g, '4月', 40, 142, 60, 30, K.F.serif, 700, '#3a3346');
    K.text(g, '卯月', 100, 144, 60, 18, K.F.serif, 700, '#6d6a80');
    const days = '日月火水木金土';
    for (let i = 0; i < 7; i++) K.text(g, days[i], 18 + i * 26, 168, 22, 14, K.F.sans, 700, i === 0 ? '#c9463e' : '#3a3346');
    for (let d = 1; d <= 30; d++) { const c = (d + 2) % 7, rr = Math.floor((d + 2) / 7); K.text(g, String(d), 18 + c * 26, 190 + rr * 18, 24, 13, K.F.sans, 500, c === 0 ? '#c9463e' : '#3a3346'); }
  }, { key: 'sb-calendar' });
}
