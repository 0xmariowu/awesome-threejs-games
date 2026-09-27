// W2 — 花屋 はなのわ (7 m wide flower shop, flat above). Lot-local: +z = street (east), +x = north.
// Pale green walls, street-facing gable, striped awning with wind chimes, the front crowded with
// wooden crates, tin buckets and a tiered stand (instanced flower heads), warm interior (enterable).
import * as THREE from 'three';
import { buildFlowerInterior } from './intFlower.js';

const SAGE = '#9dbb8f', GREEN_D = '#4f7a5a', CREAM = '#f4efe4', INK = '#3a3346';

export function buildFlower(ctx, C) {
  const { M, P, U, A, F, T } = C;
  const SC = C.scatter;
  const S = C.space('W2');
  const k = S.k;
  const rr = ctx.rng('shopsA.flower');
  const FY = 0.16, F2 = 3.2, E = 5.9;
  const X0 = -3.15, X1 = 3.15, ZB = -11.2, ZF = -2.5, WT = 0.2;
  const mWall = M.wall('#d6e3cf'), mTrim = M.t('#f1ede2'), mWood = M.wood('#8a6446'), mWoodD = M.wood('#5e4636');
  const mIn = M.inner('#e4ecd9', 0.3);
  const glass = M.glass({ opacity: 0.18 });

  // ---------------- ground + foundation
  C.pave(S, -3.5, 3.5, ZF, 0, M.tiles('#cdbfa8'), { uv: 0.6 });
  C.pave(S, -3.5, 3.5, -14, ZB, M.concrete('#c9c6bd'), { uv: 2 });
  C.pave(S, X1, 3.5, ZB, ZF, M.concrete('#c9c6bd'), { uv: 2 });
  C.pave(S, -3.5, X0, ZB, ZF, M.concrete('#c9c6bd'), { uv: 2 });
  C.plinth(S, X0 - 0.03, X1 + 0.03, ZB - 0.03, ZF + 0.03, FY, M.concrete('#b9b6ad'), 1);

  // ---------------- shell
  S.ubox(X1 - X0, E - FY, WT, mWall, [0, (FY + E) / 2, ZB + WT / 2], null, 2.5);
  // side walls with a few openings
  const side = (sgn, ops) => {
    const xc = sgn < 0 ? X0 + WT / 2 : X1 - WT / 2;
    for (const [y0, y1] of [[FY, F2], [F2, E]]) {
      const o2 = ops.filter(o => o[2] >= y0 && o[3] <= y1).sort((a, b) => a[0] - b[0]);
      let z = ZB;
      const put = (a, b, ya, yb) => { if (b - a > 1e-3 && yb - ya > 1e-3) S.ubox(WT, yb - ya, b - a, mWall, [xc, (ya + yb) / 2, (a + b) / 2], null, 2.5); };
      for (const o of o2) { put(z, o[0], y0, y1); put(o[0], o[1], y0, o[2]); put(o[0], o[1], o[3], y1); z = o[1]; }
      put(z, ZF, y0, y1);
    }
  };
  const southOps = [[-6.2, -5.0, 3.9, 5.1], [-9.4, -8.6, FY + 1.3, FY + 2.2]];
  side(-1, southOps);
  side(1, [[-8.0, -7.0, 3.9, 5.1]]);
  // front: piers, header, upper wall with two windows
  const fz = ZF - WT / 2;
  const seg = (x0, x1, y0, y1, m = mWall) => S.ubox(x1 - x0, y1 - y0, WT, m, [(x0 + x1) / 2, (y0 + y1) / 2, fz], null, 2.5);
  const OX0 = -2.85, OX1 = 2.85, OH = 2.98, PW = (OX1 - OX0) / 4;
  seg(X0, OX0, FY, F2); seg(OX1, X1, FY, F2); seg(OX0, OX1, OH, F2);
  const up = [[-2.25, -0.65], [0.65, 2.25]], UY0 = 4.25, UY1 = 5.35;
  { let x = X0; for (const [a, b] of up) { seg(x, a, F2, E); seg(a, b, F2, UY0); seg(a, b, UY1, E); x = b; } seg(x, X1, F2, E); }
  k.box(X1 - X0 + 0.08, 0.1, 0.07, mTrim, [0, F2 + 0.02, ZF + 0.02]);
  for (const x of [X0, X1]) k.box(0.1, E - FY, 0.1, mTrim, [x + (x < 0 ? 0.03 : -0.03), (FY + E) / 2, ZF - 0.03]);

  // ---------------- roof: gable facing the street, metal (standing seam), white barge boards
  const pitch = 0.5, ov = 0.35, ovF = 0.45;
  const ridgeY = E + (X1 - X0) / 2 * pitch, half = (X1 - X0) / 2 + ov, eaveY = E - ov * pitch;
  {
    const len = Math.hypot(half, half * pitch), ang = Math.atan(pitch), RL = ZF - ZB + ovF + 0.25;
    const mRoof = M.seam('#6f8298');
    const zc = (ZB - 0.25 + ZF + ovF) / 2;
    for (const s of [1, -1]) {
      const xc = s * half / 2, yc = (ridgeY + eaveY) / 2;
      const g = new THREE.Group(); g.position.set(xc + s * Math.sin(ang) * 0.05, yc + Math.cos(ang) * 0.05, zc); g.rotation.set(0, 0, -s * ang); S.g.add(g);
      const kk = ctx.kit(g);
      kk.mesh(C.uvBox(RL, 0.1, len, 1.8), mRoof, [0, 0, 0], [0, Math.PI / 2, 0]);
      k.cyl(0.065, 0.065, RL, M.t('#9aa1a8'), [s * (half + 0.05), eaveY - 0.08, zc], [Math.PI / 2, 0, 0], 8);
    }
    k.box(0.22, 0.12, RL, M.t('#5d6d80'), [0, ridgeY + 0.1, zc]);
    // front gable (plaster) + round window + barge boards
    const triG = ctx.geo.extrude([[X0, 0], [X1, 0], [0, ridgeY - E]], WT);
    k.mesh(triG, mWall, [0, E, fz]);
    k.mesh(ctx.geo.extrude([[X0, 0], [X1, 0], [0, ridgeY - E]], WT), mWall, [0, E, ZB + WT / 2]);
    for (const s of [1, -1]) {
      const bl = Math.hypot(half, half * pitch);
      k.box(bl + 0.1, 0.2, 0.06, mTrim, [s * half / 2, (ridgeY + eaveY) / 2 + 0.02, ZF + ovF], [0, 0, -s * ang]);
    }
    k.cyl(0.3, 0.3, 0.06, mTrim, [0, E + 0.72, ZF + 0.01], [Math.PI / 2, 0, 0], 18);
    k.cyl(0.24, 0.24, 0.07, M.glass({ opacity: 0.5 }), [0, E + 0.72, ZF + 0.015], [Math.PI / 2, 0, 0], 18).castShadow = false;
    k.box(0.04, 0.48, 0.05, mTrim, [0, E + 0.72, ZF + 0.04]);
    P.downpipe(S, X0 - 0.07, ZF - 0.25, eaveY - 0.15, M.t('#9aa1a8'), [1, 0]);
    P.downpipe(S, X1 + 0.07, ZB + 0.3, eaveY - 0.15, M.t('#9aa1a8'), [-1, 0]);
  }

  // ---------------- shopfront: sliding glass doors (two slid open), transom
  {
    const mFr = M.t('#f1ede2'), dz = ZF - 0.12, ph = OH - FY - 0.36;
    k.box(OX1 - OX0, 0.08, 0.12, mFr, [0, FY + 0.04, dz]);
    k.box(OX1 - OX0, 0.08, 0.12, mFr, [0, FY + ph + 0.04, dz]);
    const panel = (cx, z) => { const g = S.k.group([cx, FY + 0.08, z]); const kk = ctx.kit(g); for (const x of [-PW / 2 + 0.03, PW / 2 - 0.03]) kk.box(0.06, ph - 0.08, 0.05, mFr, [x, (ph - 0.08) / 2, 0]); kk.box(PW, 0.06, 0.05, mFr, [0, ph - 0.11, 0]); kk.box(PW, 0.14, 0.05, mFr, [0, 0.07, 0]); kk.plane(PW - 0.12, ph - 0.28, glass, [0, (ph - 0.08) / 2 + 0.02, 0]).castShadow = false; };
    panel(OX0 + PW * 0.5, dz + 0.03); panel(OX1 - PW * 0.5, dz + 0.03); panel(OX0 + PW * 0.62, dz - 0.04); panel(OX1 - PW * 0.62, dz - 0.04);
    // transom glass
    k.plane(OX1 - OX0, OH - FY - ph - 0.1, glass, [0, FY + ph + 0.08 + (OH - FY - ph - 0.1) / 2, dz]).castShadow = false;
    for (const x of [OX0 + PW, 0, OX1 - PW]) k.box(0.05, OH - FY - ph - 0.1, 0.06, mFr, [x, FY + ph + 0.08 + (OH - FY - ph - 0.1) / 2, dz]);
    k.box(OX1 - OX0 + 0.1, 0.1, 0.16, M.t('#e6e0d0'), [0, OH - 0.02, ZF - 0.05]);
  }
  // upper windows (flat above the shop) with lace / plants
  const rCur = A.lit.region(128, 128, (g, w, h) => {
    g.fillStyle = '#655e72'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#f5efe2'; g.beginPath(); g.moveTo(0, 0); g.lineTo(w * 0.42, 0); g.quadraticCurveTo(w * 0.26, h * 0.5, w * 0.16, h); g.lineTo(0, h); g.fill();
    g.beginPath(); g.moveTo(w, 0); g.lineTo(w * 0.58, 0); g.quadraticCurveTo(w * 0.74, h * 0.5, w * 0.84, h); g.lineTo(w, h); g.fill();
    g.fillStyle = 'rgba(255,236,205,0.5)'; g.fillRect(w * 0.3, h * 0.08, w * 0.4, h * 0.35);
    g.fillStyle = '#6f9a5a'; g.beginPath(); g.arc(w * 0.5, h * 0.92, 18, Math.PI, 0); g.fill();
  });
  for (const [a, b] of up) {
    P.window(S, (a + b) / 2, UY0, ZF - 0.08, b - a, UY1 - UY0, { frameMat: mTrim, cols: 2, back: rCur, backZ: 0.14, sillD: 0.12 });
    S.uboxB(b - a, 0.18, 0.22, mWood, [(a + b) / 2, UY0 - 0.3, ZF + 0.12], null, 1);
    for (let i = 0; i < 4; i++) P.pot(S, a + 0.2 + i * (b - a - 0.4) / 3, UY0 - 0.12, ZF + 0.12, { r: 0.08, h: 0.02, color: '#8a6446', plant: 'flowers', n: 6, flowers: [['#e8506a', '#f2b5c8'], ['#f1e3b0', '#fbe9ef'], ['#c9b8e8', '#8e7cc3'], ['#f7d3de', '#fbe9ef']][i] });
  }
  // side windows
  P.window(S, X0 - 0.02 + 0.1, 3.9, -5.6, 1.2, 1.2, { rotY: -Math.PI / 2, frameMat: mTrim, cols: 2, back: rCur, backZ: 0.12 });
  P.window(S, X0 + 0.1, FY + 1.3, -9.0, 0.8, 0.9, { rotY: -Math.PI / 2, frameMat: mTrim, glass: M.glass({ frost: true }) });
  P.window(S, X1 - 0.1, 3.9, -7.5, 1.0, 1.2, { rotY: Math.PI / 2, frameMat: mTrim, glass: M.glass({ frost: true }) });
  // AC unit on the sunny south wall + pipe cover
  P.acUnit(S, X0 - 0.2, S.gy(X0 - 0.2, -7.2) + 0.02, -7.2, -Math.PI / 2, { ductH: 1.5 });
  S.box(X0 - 0.2, -7.2, 0.32, 0.9, -1, 0.8);
  P.meter(S, X0, 1.5, -10.2, -Math.PI / 2);

  // trellis with climbing roses on the south wall front
  {
    const tx = X0 - 0.06, z0 = -4.6, z1 = -2.7, y0 = S.gy(X0, -3.6) + 0.1, y1 = 2.9;
    const mT = M.wood('#e9e2d0');
    for (let z = z0; z <= z1 + 1e-3; z += 0.38) k.box(0.03, y1 - y0, 0.03, mT, [tx, (y0 + y1) / 2, z]);
    for (let y = y0 + 0.3; y < y1; y += 0.38) k.box(0.03, 0.03, z1 - z0, mT, [tx - 0.02, y, (z0 + z1) / 2]);
    k.box(0.28, 0.3, z1 - z0 + 0.1, M.wood('#8a6446'), [X0 - 0.16, S.gy(X0 - 0.16, -3.6) + 0.15, (z0 + z1) / 2]);
    for (let i = 0; i < 7; i++) { const zz = z0 + 0.15 + (i % 4) * 0.5, yy = y0 + 0.3 + Math.floor(i / 4) * 1.0 + (i % 2) * 0.35; C.shrub(S, tx - 0.07, yy, zz, { r: 0.13, h: 0.5, sx: 0.5, sz: 1.4, seed: 80 + i, kind: 'camellia', flatBottom: false }); }
    for (let i = 0; i < 44; i++) {
      const z = z0 + rr() * (z1 - z0), y = y0 + 0.2 + Math.pow(rr(), 0.8) * (y1 - y0 - 0.1);
      if (rr() < 0.45) SC.add('ball', S, [tx - 0.13, y + 0.03, z + 0.04], [0.035, 0.035, 0.035], rr.pick(['#e8819c', '#f2b5c8', '#fbe9ef', '#d9546f']), [rr(), rr(), 0]);
    }
  }

  // ---------------- awning + sign + projecting sign + wind chimes
  const aw = P.awning(S, {
    x0: X0, x1: X1, zWall: ZF, yTop: 3.08, depth: 1.45, drop: 0.5, stripe: ['#8fb58a', CREAM], n: 6, valance: GREEN_D, valH: 0.24, scallopW: 0.22,
    valReg: A.lit.region(1000, 32, (g, w, h) => { g.fillStyle = GREEN_D; g.fillRect(0, 0, w, h); U.text(g, '花屋 はなのわ  ·  flower shop HANANOWA  ·  花束 · 鉢花 · ギフト', w / 2, h / 2 + 1, 18, F.round, CREAM, { weight: 700, maxW: w - 16 }); }, { bg: GREEN_D }),
  });
  {
    const rSign = A.lit.region(512, 110, (g, w, h) => {
      g.fillStyle = '#fbf8f0'; g.fillRect(0, 0, w, h); g.strokeStyle = GREEN_D; g.lineWidth = 5; g.strokeRect(5, 5, w - 10, h - 10);
      // flower wreath (はなのわ = ring of flowers)
      const cx = 64, cy = h / 2;
      for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; g.fillStyle = i % 2 ? '#8fb58a' : '#6f9a5a'; g.beginPath(); g.ellipse(cx + Math.cos(a) * 30, cy + Math.sin(a) * 30, 9, 5, a + 1.2, 0, 6.3); g.fill(); }
      for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3 + 0.3; U.sakura(g, cx + Math.cos(a) * 30, cy + Math.sin(a) * 30, 10, ['#e8819c', '#f2c230', '#f7d3de'][i % 3], '#fbf8f0'); }
      U.text(g, '花屋', 160, h * 0.5, 44, F.round, GREEN_D, { weight: 900 });
      U.text(g, 'はなのわ', 330, h * 0.44, 52, F.round, '#d9718f', { weight: 900 });
      U.text(g, 'flower shop HANANOWA', 330, h * 0.82, 16, F.en, GREEN_D, { weight: 700 });
    });
    k.box(3.6, 0.62, 0.06, mTrim, [0, 3.53, ZF + 0.035]);
    S.card(rSign, 3.0, 0.58, [0, 3.53, ZF + 0.068]);
    // vertical projecting sign at the south corner (reads down the street)
    const rV = A.lit.region(128, 400, (g, w, h) => {
      g.fillStyle = '#fbf8f0'; g.fillRect(0, 0, w, h); g.fillStyle = GREEN_D; g.fillRect(0, 0, w, 12); g.fillRect(0, h - 12, w, 12);
      U.sakura(g, w / 2, 58, 34, '#e8819c', '#f2c230');
      U.vtext(g, 'はなのわ', w / 2, 112, 56, F.round, GREEN_D, 900, 1.02);
      for (const [x, y, c] of [[26, 350, '#f2c230'], [64, 364, '#e8819c'], [100, 350, '#c9b8e8']]) U.sakura(g, x, y, 14, c, '#fbf8f0');
    });
    const px = X0 - 0.02, py = 3.95, pzz = ZF + 0.45;
    k.box(0.1, 1.3, 0.44, mTrim, [px, py, pzz]);
    S.card(rV, 0.4, 1.25, [px - 0.052, py, pzz], [0, -Math.PI / 2, 0]);
    S.card(rV, 0.4, 1.25, [px + 0.052, py, pzz], [0, Math.PI / 2, 0]);
    for (const y of [py + 0.5, py - 0.5]) k.box(0.04, 0.04, 0.5, M.t('#6d747c'), [px, y, ZF + 0.2]);
  }
  // wind chimes (風鈴) hanging from the awning's front bar — sway with the wind (dynamic)
  {
    const dg = S.dyn(); const chimes = [];
    const colors = ['#bfe3f4', '#f7d3de', '#cfeee4', '#f6e3a0'];
    const rStrip = ['願', '春', '花', '風'].map((ch, i) => A.lit.region(32, 110, (g, w, h) => { g.fillStyle = ['#fbe9ef', '#e8f4ff', '#fbf3d8', '#e6f3e8'][i]; g.fillRect(0, 0, w, h); U.text(g, ch, w / 2, 26, 22, F.brush, '#8c3a45', { weight: 400 }); g.fillStyle = 'rgba(140,58,69,0.3)'; g.fillRect(4, 50, w - 8, 2); }));
    [-2.4, -0.8, 0.8, 2.4].forEach((x, i) => {
      const top = aw.yb + 0.02, z = aw.zf - 0.03;
      const pivot = new THREE.Group(); pivot.position.set(x, top, z); dg.add(pivot); const kk = ctx.kit(pivot);
      kk.cyl(0.003, 0.003, 0.12, M.t('#6d6a80'), [0, -0.06, 0], null, 3);
      kk.mesh(new THREE.SphereGeometry(0.055, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), M.t(colors[i], { transparent: true, opacity: 0.7, side: 'double' }), [0, -0.17, 0]);
      kk.cyl(0.002, 0.002, 0.14, M.t('#6d6a80'), [0, -0.24, 0], null, 3);
      kk.mesh(C.regionGeo(rStrip[i], 0.06, 0.2), M.t('#ffffff', { map: rStrip[i].m.map, side: 'double', paint: 0 }), [0, -0.42, 0]);
      chimes.push({ g: pivot, ph: i * 1.7 });
    });
    // handwritten bouquet price cards hanging between the chimes
    const cardTxt = [['花束', '¥1,000〜'], ['ミニブーケ', '¥800'], ['アレンジ', '¥3,000〜']];
    const cardRegs = cardTxt.map(([a, b]) => A.lit.region(96, 72, (g, w, h) => {
      g.fillStyle = '#e9d6b4'; g.fillRect(0, 0, w, h); g.strokeStyle = '#8a6446'; g.lineWidth = 2; g.strokeRect(3, 3, w - 6, h - 6);
      U.text(g, a, w / 2, 26, 18, F.hand, INK, { weight: 400, maxW: w - 12 }); U.text(g, b, w / 2, 52, 19, F.hand, '#c2476a', { weight: 400, maxW: w - 12 });
      g.fillStyle = '#6d6a80'; g.beginPath(); g.arc(w / 2, 8, 3, 0, 6.3); g.fill();
    }, { bg: '#e9d6b4' }));
    [-1.6, 0.0, 1.6].forEach((x, i) => {
      const pivot = new THREE.Group(); pivot.position.set(x, aw.yb + 0.02, aw.zf - 0.03); dg.add(pivot); const kk = ctx.kit(pivot);
      kk.cyl(0.002, 0.002, 0.14, M.t('#6d6a80'), [0, -0.07, 0], null, 3);
      kk.mesh(C.regionGeo(cardRegs[i], 0.17, 0.13), M.t('#ffffff', { map: cardRegs[i].m.map, side: 'double', paint: 0 }), [0, -0.2, 0]);
      chimes.push({ g: pivot, ph: i * 2.3 + 0.7 });
    });
    dg.traverse((o) => { if (o.isMesh) o.castShadow = false; });
    ctx.onUpdate((dt, t) => {
      const gust = ctx.shared.uGust.value;
      for (const c of chimes) { c.g.rotation.x = Math.sin(t * 2.1 + c.ph) * 0.12 * (0.4 + gust); c.g.rotation.z = Math.sin(t * 1.3 + c.ph * 2) * 0.08 * (0.4 + gust); }
    });
  }

  // ---------------- front display: buckets, crates, tiered stand, price tags (instanced flowers)
  const mTin = M.t('#b9c0c6'), mTinD = M.t('#9aa3ab');
  const priceTags = [['チューリップ', '1本 ¥200'], ['バラ', '1本 ¥300'], ['スイートピー', '¥350'], ['ラナンキュラス', '1本 ¥280'], ['かすみ草', '¥500'], ['マーガレット', '¥380'], ['桜の枝', '1本 ¥600'], ['春の花束', '¥1,500〜'], ['パンジー', '3ポット ¥500'], ['アジサイ', '鉢 ¥2,800']];
  const tagReg = {};
  for (const [n, p] of priceTags) tagReg[n] = A.lit.region(120, 80, (g, w, h) => { g.fillStyle = '#fbf8ee'; g.fillRect(0, 0, w, h); g.strokeStyle = '#d9718f'; g.lineWidth = 3; g.strokeRect(3, 3, w - 6, h - 6); U.text(g, n, w / 2, 26, 17, F.hand, INK, { weight: 400, maxW: w - 12 }); U.text(g, p, w / 2, 58, 21, F.hand, '#c2476a', { weight: 400, maxW: w - 12 }); }, { bg: '#fbf8ee' });
  const tag = (name, x, y, z, ry = 0) => {
    k.cyl(0.004, 0.004, 0.3, M.t('#8a6446'), [x, y + 0.15, z], null, 3);
    S.card(tagReg[name], 0.12, 0.08, [x, y + 0.33, z + 0.004], [-0.1, ry, 0]);
  };
  // flower bunch helpers (all local to S)
  const bunch = (kind, x, y, z, cols, n = 10, spread = 0.1, B = S) => {
    const r2 = ctx.rng(`fl|${kind}|${x.toFixed(2)}|${z.toFixed(2)}`);
    for (let i = 0; i < n; i++) {
      const a = r2() * 6.28, d = Math.sqrt(r2()) * spread, len = 0.26 + r2() * 0.14;
      const hx = x + Math.cos(a) * d * 1.3, hz = z + Math.sin(a) * d * 1.3, hy = y + len;
      const tilt = [Math.sin(a) * d * 2.2, 0, -Math.cos(a) * d * 2.2];
      SC.add('stem', B, [(x + hx) / 2, y + len / 2, (z + hz) / 2], [0.004, len, 0.004], '#5f8c4c', tilt);
      const c = cols && cols.length ? r2.pick(cols) : '#fbf8f2';
      if (kind === 'tulip') SC.add('cup', B, [hx, hy - 0.01, hz], [0.028, 0.056, 0.028], c, tilt);
      else if (kind === 'rose') SC.add('ball', B, [hx, hy, hz], [0.037, 0.033, 0.037], c, [r2(), r2(), r2()]);
      else if (kind === 'ranun') SC.add('ball', B, [hx, hy, hz], [0.04, 0.034, 0.04], c, [r2(), r2(), r2()]);
      else if (kind === 'daisy') { SC.add('disc', B, [hx, hy, hz], [0.036, 0.006, 0.036], c, tilt); SC.add('ball', B, [hx, hy + 0.005, hz], [0.012, 0.009, 0.012], '#f2c230'); }
      else if (kind === 'pea') { for (let j = 0; j < 3; j++) SC.add('ball', B, [hx + (j - 1) * 0.015, hy - j * 0.02, hz], [0.018, 0.014, 0.014], c, [r2(), r2(), 0]); }
      else if (kind === 'gyp') { for (let j = 0; j < 6; j++) SC.add('ball', B, [hx + (r2() - 0.5) * 0.08, hy + (r2() - 0.3) * 0.05, hz + (r2() - 0.5) * 0.08], [0.012, 0.012, 0.012], '#fbf8f2'); }
      if (i % 3 === 0) SC.add('blade', B, [x + Math.cos(a) * 0.04, y, z + Math.sin(a) * 0.04], [0.025, len * 0.7, 1], '#6f9a5a', [tilt[0] * 1.5, a, tilt[2] * 1.5]);
    }
  };
  const bucket = (x, y, z, kind, cols, o = {}) => {
    const r = o.r ?? 0.12, h = o.h ?? 0.26;
    k.cyl(r, r * 0.8, h, mTin, [x, y + h / 2, z], null, 12);
    k.cyl(r * 1.02, r * 1.02, 0.02, mTinD, [x, y + h - 0.01, z], null, 12);
    k.cyl(r * 0.95, r * 0.95, 0.01, M.t('#7f9aa8'), [x, y + h - 0.03, z], null, 10);
    if (kind === 'sakura') {
      for (let i = 0; i < 5; i++) {
        const a = i * 1.25 + 0.3, tilt = 0.12 + (i % 2) * 0.16, len = 1.0 + (i % 3) * 0.2;
        const br = new THREE.Group(); br.position.set(x, y + h - 0.05, z); br.rotation.set(Math.sin(a) * tilt, 0, Math.cos(a) * tilt); S.g.add(br);
        const kb = ctx.kit(br);
        kb.cyl(0.008, 0.014, len, M.t('#6a5048'), [0, len / 2, 0], null, 5);
        for (let j = 0; j < 3; j++) { const sb = new THREE.Group(); sb.position.set(0, len * (0.5 + j * 0.16), 0); sb.rotation.set(0.6 * Math.sin(j + a), 0, 0.7 * Math.cos(j * 2 + a)); br.add(sb); ctx.kit(sb).cyl(0.004, 0.006, 0.3, M.t('#6a5048'), [0, 0.15, 0], null, 4); for (let m = 0; m < 6; m++) SC.add('ball', sb, [(m % 2 - 0.5) * 0.03, 0.08 + m * 0.04, (m % 3 - 1) * 0.02], [0.03, 0.026, 0.03], m % 3 ? '#f7d3de' : '#fbe9ef', [m, m, 0]); }
        for (let j = 0; j < 12; j++) SC.add('ball', br, [(j % 2 - 0.5) * 0.035, len * (0.35 + j * 0.055), ((j * 7) % 3 - 1) * 0.025], [0.034, 0.03, 0.034], j % 4 ? '#f7d3de' : '#fbe9ef', [j, j * 2, 0]);
      }
      return;
    }
    if (kind) bunch(kind, x, y + h - 0.02, z, cols, o.n ?? 11, r * 0.8);
  };
  const potH = (x, y, z, cols) => { // hydrangea pot
    P.pot(S, x, y, z, { r: 0.17, h: 0.24, color: '#d9c9b0', plant: 'bush', greens: ['#5f8c5c', '#6f9a5a'] });
    const r2 = ctx.rng(`hyd|${x}|${z}`);
    for (let i = 0; i < 4; i++) { const a = i * 1.6 + r2(); C.shrub(S, x + Math.cos(a) * 0.08, y + 0.3 + r2() * 0.06, z + Math.sin(a) * 0.08, { r: 0.1, h: 0.16, colors: (() => { const c = r2.pick(cols); return { top: c, mid: c, base: '#6f8a9a' }; })(), seed: i + 3, lumps: 0.3 }); for (let j = 0; j < 5; j++) SC.add('ball', S, [x + Math.cos(a) * 0.08 + (r2() - 0.5) * 0.14, y + 0.42 + r2() * 0.08, z + Math.sin(a) * 0.08 + (r2() - 0.5) * 0.14], [0.024, 0.02, 0.024], r2.pick(cols), [r2(), r2(), 0]); }
  };
  const smallPot = (x, y, z, cols, kind = 'flowers') => P.pot(S, x, y, z, { r: 0.075, h: 0.09, color: rr.pick(['#3a3346', '#c7805d', '#4f5a66']), plant: kind, n: 7, flowers: cols });
  const crate = (x, y, z, w = 0.62, d = 0.42, h = 0.3, ry = 0) => {
    const g = S.k.group([x, y, z], ry); const kk = ctx.kit(g);
    for (const s of [-1, 1]) { kk.box(w, h * 0.3, 0.02, mWood, [0, h * 0.2, s * d / 2]); kk.box(w, h * 0.3, 0.02, mWood, [0, h * 0.7, s * d / 2]); kk.box(0.02, h * 0.3, d, mWood, [s * w / 2, h * 0.2, 0]); kk.box(0.02, h * 0.3, d, mWood, [s * w / 2, h * 0.7, 0]); for (const t of [-1, 1]) kk.box(0.04, h, 0.04, mWoodD, [s * (w / 2 - 0.02), h / 2, t * (d / 2 - 0.02)]); }
    kk.box(w - 0.02, 0.02, d - 0.02, mWood, [0, 0.03, 0]);
    return h;
  };
  // tiered stand (south side)
  {
    const cx = -2.25, w = 1.8;
    const steps = [[0.32, -1.1], [0.58, -1.55], [0.84, -2.0]];
    const mS = M.wood('#9c7650');
    for (const [h, z] of steps) {
      k.box(w, 0.04, 0.44, mS, [cx, S.gy(cx, z) + h, z]);
      for (const sx of [-w / 2 + 0.04, w / 2 - 0.04]) k.box(0.05, h, 0.05, M.wood('#6d5038'), [cx + sx, S.gy(cx, z) + h / 2, z]);
    }
    k.box(0.04, 0.9, 1.4, M.wood('#6d5038'), [cx - w / 2 + 0.02, S.gy(cx, -1.55) + 0.45, -1.55], [0.0, 0, 0]);
    k.box(0.04, 0.9, 1.4, M.wood('#6d5038'), [cx + w / 2 - 0.02, S.gy(cx, -1.55) + 0.45, -1.55]);
    const rows = [
      [['tulip', ['#e8506a', '#f28db2', '#f7d3de']], ['tulip', ['#f2c230', '#f6e3a0']], ['tulip', ['#fbf8f2', '#f7d3de']], ['pea', ['#c9b8e8', '#f2b5c8', '#fbe9ef']]],
      [['rose', ['#d9546f', '#e8819c']], ['ranun', ['#f08a4b', '#f6c58a', '#f7d3de']], ['rose', ['#fbe9ef', '#f7d3de']], ['daisy', ['#fbf8f2']]],
      [['gyp', ['#fbf8f2']], ['ranun', ['#e8506a', '#f28db2']], ['tulip', ['#8e7cc3', '#c9b8e8']]],
    ];
    const names = [['チューリップ', 'チューリップ', 'チューリップ', 'スイートピー'], ['バラ', 'ラナンキュラス', 'バラ', 'マーガレット'], ['かすみ草', 'ラナンキュラス', 'チューリップ']];
    rows.forEach((row, ri) => {
      const [h, z] = steps[ri];
      row.forEach(([kind, cols], i) => {
        const x = cx - w / 2 + 0.25 + i * (w - 0.5) / Math.max(1, row.length - 1);
        const y = S.gy(cx, z) + h + 0.02;
        bucket(x, y, z, kind, cols, { r: 0.11, h: 0.22 });
        if ((i + ri) % 2 === 0) tag(names[ri][i], x + 0.08, y, z + 0.13);
      });
    });
    S.box(cx, -1.55, w, 1.4, -1, 1.1);
    // ground buckets in front of the stand
    bucket(-2.9, S.gy(-2.9, -0.5), -0.5, 'tulip', ['#e8506a', '#f2c230', '#fbf8f2'], { r: 0.13, h: 0.3 });
    bucket(-2.3, S.gy(-2.3, -0.45), -0.45, 'daisy', ['#fbf8f2', '#f6e3a0'], { r: 0.13, h: 0.28, n: 14 });
    potH(-1.7, S.gy(-1.7, -0.55), -0.55, ['#7fa6d9', '#9aa9e0', '#b8a6de']);
    tag('マーガレット', -2.18, S.gy(-2.3, -0.45) + 0.28, -0.32);
    tag('アジサイ', -1.55, S.gy(-1.7, -0.55) + 0.24, -0.4);
    S.box(-2.3, -0.5, 1.6, 0.36, -1, 0.7);
  }
  // crates + pots (north side), sakura branches bucket, hydrangeas, chalkboard easel
  {
    const cx = 2.3;
    const y0 = S.gy(cx, -1.8);
    const h1 = crate(cx - 0.34, y0, -1.9, 0.62, 0.42, 0.3);
    crate(cx + 0.34, y0, -1.9, 0.62, 0.42, 0.3);
    crate(cx, y0 + h1, -2.05, 0.62, 0.42, 0.3, 0.04);
    const pansy = [['#8e7cc3', '#f2c230'], ['#f2c230', '#fbf8f2'], ['#e8506a', '#f7d3de'], ['#c9b8e8', '#fbf8f2'], ['#f08a4b', '#f2c230']];
    for (let i = 0; i < 6; i++) smallPot(cx - 0.58 + i * 0.23, y0 + h1, -1.8, pansy[i % pansy.length]);
    for (let i = 0; i < 3; i++) smallPot(cx - 0.2 + i * 0.2, y0 + h1 * 2, -2.05, pansy[(i + 2) % pansy.length]);
    tag('パンジー', cx + 0.62, y0 + h1, -1.66);
    for (let i = 0; i < 4; i++) smallPot(cx - 0.45 + i * 0.3, y0, -1.45, [['#fbf8f2', '#f2c230'], ['#f7d3de', '#fbf8f2']][i % 2], 'flowers');
    S.box(cx, -1.9, 1.3, 0.5, -1, 0.9);
    bucket(3.05, S.gy(3.05, -0.55), -0.55, 'sakura', null, { r: 0.16, h: 0.46 });
    tag('桜の枝', 2.86, S.gy(3.0, -0.4) + 0.3, -0.36);
    S.cyl(3.05, -0.55, 0.2, -1, 1.6);
    potH(2.35, S.gy(2.35, -0.5), -0.5, ['#f2b5c8', '#e8819c', '#f7d3de']);
    potH(1.75, S.gy(1.75, -0.8), -0.85, ['#7fa6d9', '#b8a6de']);
    S.cyl(2.35, -0.5, 0.22, -1, 0.7); S.cyl(1.75, -0.85, 0.22, -1, 0.7);
    bucket(1.4, S.gy(1.4, -2.1), -2.1, 'gyp', null, { r: 0.12, h: 0.3, n: 12 });
    tag('かすみ草', 1.52, S.gy(1.4, -2.1) + 0.3, -1.98);
    // chalkboard easel
    const rEasel = A.lit.region(200, 260, (g, w, h) => {
      g.fillStyle = '#34403b'; g.fillRect(0, 0, w, h);
      const ct = (s, x, y, size, c, o = {}) => U.text(g, s, x, y, size, F.hand, c, { weight: 400, ...o });
      ct('春の花', w / 2, 36, 34, '#f7c3d3'); ct('入荷しました', w / 2, 76, 24, '#f4efe4');
      ct('スイートピー', w / 2, 120, 20, '#f4efe4'); ct('ラナンキュラス', w / 2, 150, 20, '#f4efe4');
      ct('花束 ¥1,500〜', w / 2, 192, 24, '#f6e3a0'); ct('ご予約承ります', w / 2, 228, 17, '#bfe3d4');
      U.sakura(g, 26, 30, 12, '#f7c3d3'); U.sakura(g, w - 26, 30, 12, '#f7c3d3');
    });
    const eg = S.k.group([1.35, S.gy(1.35, -0.35), -0.35], 0.25); const ke = ctx.kit(eg);
    for (const s of [-1, 1]) ke.box(0.03, 1.1, 0.03, mWood, [s * 0.24, 0.55, 0.0], [-0.12, 0, s * -0.04]);
    ke.box(0.03, 1.05, 0.03, mWood, [0, 0.52, -0.22], [0.25, 0, 0]);
    ke.box(0.5, 0.64, 0.03, mWood, [0, 0.72, 0.02], [-0.12, 0, 0]);
    S.card(rEasel, 0.44, 0.58, [0, 0.72, 0.04], [-0.12, 0, 0], null, ke);
    ke.box(0.52, 0.03, 0.06, mWood, [0, 0.38, 0.06], [-0.12, 0, 0]);
    S.box(1.35, -0.4, 0.55, 0.35, -1, 1.1, 0.25);
  }
  // watering can + hose reel on the north pier
  {
    const x = 2.95, z = -2.3, y = S.gy(x, z);
    k.cyl(0.09, 0.1, 0.2, M.t('#6fa8a0'), [x, y + 0.1, z], null, 10);
    k.cyl(0.012, 0.018, 0.3, M.t('#6fa8a0'), [x + 0.14, y + 0.2, z], [0, 0, -0.9], 5);
    k.mesh(new THREE.TorusGeometry(0.08, 0.012, 4, 10, Math.PI), M.t('#6fa8a0'), [x, y + 0.2, z], [0, Math.PI / 2, 0]);
    k.cyl(0.2, 0.2, 0.1, M.t('#6f9a5a'), [X1 + 0.08, 0.9, -3.1], [0, 0, Math.PI / 2], 14);
    k.cyl(0.08, 0.08, 0.12, M.t('#e8e4d8'), [X1 + 0.08, 0.9, -3.1], [0, 0, Math.PI / 2], 10);
  }

  // ---------------- interior (warm)
  const IX0 = X0 + WT, IX1 = X1 - WT, IZ0 = ZB + WT, IZ1 = ZF - 0.2;
  { const fl = k.mesh(C.uvPlane(IX1 - IX0, IZ1 - IZ0, 0.6), M.innerMap('#c9a07c', T.tiles, 0.25), [0, FY + 0.004, (IZ0 + IZ1) / 2], [-Math.PI / 2, 0, 0]); fl.castShadow = false; }
  const CI = F2 - 0.05;
  k.plane(IX1 - IX0, IZ1 - IZ0, M.inner('#f1ece0', 0.3), [0, CI, (IZ0 + IZ1) / 2], [Math.PI / 2, 0, 0]);
  k.plane(IX1 - IX0, CI - FY, mIn, [0, (FY + CI) / 2, IZ0 + 0.005]);
  k.plane(IZ1 - IZ0, CI - FY, mIn, [IX0 + 0.005, (FY + CI) / 2, (IZ0 + IZ1) / 2], [0, Math.PI / 2, 0]);
  k.plane(IZ1 - IZ0, CI - FY, mIn, [IX1 - 0.005, (FY + CI) / 2, (IZ0 + IZ1) / 2], [0, -Math.PI / 2, 0]);
  buildFlowerInterior(ctx, C, S, { FY, CI, IX0, IX1, IZ0, IZ1 });
  // a sheet of spring posters on the inside of the glass
  {
    const rPost = A.lit.region(200, 280, (g, w, h) => {
      g.fillStyle = '#fbeef2'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 10; i++) U.sakura(g, (i * 57) % w, (i * 83 + 20) % h, 12 + (i % 3) * 4, i % 2 ? '#f2b5c8' : '#f7d3de');
      g.fillStyle = 'rgba(255,255,255,0.85)'; U.rr(g, 14, 60, w - 28, 150, 16); g.fill();
      U.text(g, '母の日', w / 2, 96, 36, F.round, '#c2476a', { weight: 900 });
      U.text(g, 'ご予約受付中', w / 2, 140, 24, F.round, GREEN_D, { weight: 900 });
      U.text(g, 'カーネーション', w / 2, 180, 18, F.round, '#d9718f', { weight: 700 });
      U.text(g, '全国配送OK', w / 2, h - 30, 18, F.sans, INK, { weight: 700 });
    });
    S.card(rPost, 0.42, 0.59, [-2.25, FY + 1.35, ZF - 0.14 + 0.02]);
  }

  // ---------------- back yard
  {
    P.backDoor(S, -1.6, FY, ZB, Math.PI, '#b9c7b4', { lamp: true });
    P.acUnit(S, 1.2, S.gy(1.2, -11.6), ZB - 0.25, Math.PI, { ductH: 2.4 });
    S.box(1.2, ZB - 0.25, 0.9, 0.36, -1, 0.8);
    const y0 = S.gy(2.4, -12.0);
    for (let i = 0; i < 5; i++) bucket(2.2 + (i % 3) * 0.3, y0 + Math.floor(i / 3) * 0.26, -12.0 - (i % 2) * 0.1, null, null, { r: 0.12, h: 0.26 });
    for (let i = 0; i < 3; i++) P.crate(S, 0.0, S.gy(0, -12.2) + i * 0.3, -12.2, 0.1 * i, '#c9a57a');
    P.carton(S, -0.8, S.gy(-0.8, -12.3), -12.3, 0.55, 0.35, 0.4, 0.3);
    S.box(1.2, -12.1, 3.0, 0.8, -1, 0.8);
  }

  // ---------------- physics
  S.box(0, ZB + WT / 2, X1 - X0, WT, -1, E);
  S.box(X0 + WT / 2, (ZB + ZF) / 2, WT, ZF - ZB, -1, E);
  S.box(X1 - WT / 2, (ZB + ZF) / 2, WT, ZF - ZB, -1, E);
  S.box((X0 + OX0 + PW * 1.14) / 2, ZF - 0.12, OX0 + PW * 1.14 - X0, 0.26, -1, E);
  S.box((OX1 - PW * 1.14 + X1) / 2, ZF - 0.12, X1 - OX1 + PW * 1.14, 0.26, -1, E);
  S.box(0, ZF - 0.12, OX1 - OX0, 0.26, OH, E);
  S.walk(0, (ZB + ZF) / 2, X1 - X0, ZF - ZB, FY);

  return { S };
}
