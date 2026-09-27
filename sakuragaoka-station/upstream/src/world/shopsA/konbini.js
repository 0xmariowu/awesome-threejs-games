// W1 — ひだまりマート HIDAMARI MART (corner konbini, faces the main street (east) and R3 (north)).
// Lot-local: +z = street (east), +x = north (R3 side). Enterable: automatic doors open as you approach.
import * as THREE from 'three';
import { buildKonbiniInterior } from './intKonbini.js';

const TEAL = '#2c9a91', TEAL_D = '#227c75', YEL = '#f3c14b', CREAM = '#f6f3ea', INK = '#3a3346';

// ---------------------------------------------------------------- canvas painters (shared with other shops)
export function drawProduct(g, kind, x, y, w, h, c, rr) {
  const light = 'rgba(255,255,255,0.55)';
  g.save();
  if (kind === 'bag') {
    g.fillStyle = c; roundR(g, x, y, w, h, Math.min(w, h) * 0.18); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(x + 1, y + 1, w - 2, h * 0.1);
    g.fillStyle = '#fbf8f0'; g.beginPath(); g.ellipse(x + w / 2, y + h * 0.52, w * 0.32, h * 0.2, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = rr.pick(['#e36b5d', '#3f7fb5', '#5a9e58', '#e9a23b']); g.fillRect(x + w * 0.3, y + h * 0.48, w * 0.4, h * 0.07);
  } else if (kind === 'cup') {
    g.fillStyle = c; g.beginPath(); g.moveTo(x, y + h * 0.12); g.lineTo(x + w, y + h * 0.12); g.lineTo(x + w * 0.88, y + h); g.lineTo(x + w * 0.12, y + h); g.closePath(); g.fill();
    g.fillStyle = '#f4f1e8'; g.fillRect(x - 1, y, w + 2, h * 0.14);
    g.fillStyle = '#fbf8f0'; g.fillRect(x + w * 0.2, y + h * 0.36, w * 0.6, h * 0.26);
    g.fillStyle = rr.pick(['#e36b5d', '#d98a2b', '#3f7fb5']); g.fillRect(x + w * 0.25, y + h * 0.44, w * 0.5, h * 0.08);
  } else if (kind === 'box') {
    g.fillStyle = c; g.fillRect(x, y, w, h);
    g.fillStyle = light; g.fillRect(x, y + h * 0.18, w, h * 0.12);
    g.fillStyle = '#fbf8f0'; g.beginPath(); g.arc(x + w / 2, y + h * 0.6, Math.min(w, h) * 0.2, 0, Math.PI * 2); g.fill();
  } else if (kind === 'bottle') {
    const nw = w * 0.38;
    g.fillStyle = c; roundR(g, x, y + h * 0.3, w, h * 0.7, w * 0.25); g.fill();
    g.beginPath(); g.moveTo(x + w * 0.1, y + h * 0.34); g.lineTo(x + (w - nw) / 2, y + h * 0.12); g.lineTo(x + (w + nw) / 2, y + h * 0.12); g.lineTo(x + w * 0.9, y + h * 0.34); g.fill();
    g.fillStyle = rr.pick(['#f4f1e8', '#e9e4d8', '#3a3346', '#e36b5d']); g.fillRect(x + (w - nw) / 2, y, nw, h * 0.13);
    g.fillStyle = '#fbf8f0'; g.fillRect(x, y + h * 0.5, w, h * 0.2);
    g.fillStyle = 'rgba(255,255,255,0.45)'; g.fillRect(x + w * 0.16, y + h * 0.36, w * 0.12, h * 0.55);
  } else if (kind === 'can') {
    g.fillStyle = c; roundR(g, x, y, w, h, w * 0.15); g.fill();
    g.fillStyle = '#d9dde2'; g.fillRect(x, y, w, h * 0.08);
    g.fillStyle = light; g.fillRect(x + w * 0.2, y + h * 0.1, w * 0.12, h * 0.8);
    g.fillStyle = '#fbf8f0'; g.fillRect(x + w * 0.1, y + h * 0.45, w * 0.8, h * 0.14);
  } else if (kind === 'onigiri') {
    g.fillStyle = '#f7f4ec'; g.beginPath(); g.moveTo(x + w / 2, y); g.lineTo(x + w, y + h); g.lineTo(x, y + h); g.closePath(); g.fill();
    g.fillStyle = '#3d4a44'; g.fillRect(x + w * 0.3, y + h * 0.55, w * 0.4, h * 0.45);
    g.fillStyle = c; g.fillRect(x + w * 0.1, y + h * 0.82, w * 0.8, h * 0.1);
  } else if (kind === 'bento') {
    g.fillStyle = '#3a3346'; g.fillRect(x, y + h * 0.1, w, h * 0.9);
    g.fillStyle = '#f7f4ec'; g.fillRect(x + w * 0.06, y + h * 0.2, w * 0.45, h * 0.7);
    g.fillStyle = '#f2b5c8'; g.fillRect(x + w * 0.12, y + h * 0.35, w * 0.12, h * 0.1);
    g.fillStyle = '#b86a3a'; g.fillRect(x + w * 0.55, y + h * 0.22, w * 0.38, h * 0.3);
    g.fillStyle = '#f2c230'; g.fillRect(x + w * 0.55, y + h * 0.56, w * 0.18, h * 0.3);
    g.fillStyle = '#6fa55a'; g.fillRect(x + w * 0.75, y + h * 0.56, w * 0.18, h * 0.3);
    g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(x, y, w, h * 0.14);
  } else if (kind === 'sand') {
    g.fillStyle = '#f3e3bf'; g.beginPath(); g.moveTo(x, y + h); g.lineTo(x + w * 0.5, y); g.lineTo(x + w, y + h); g.closePath(); g.fill();
    g.fillStyle = c; g.fillRect(x + w * 0.22, y + h * 0.55, w * 0.56, h * 0.12);
    g.fillStyle = '#7cc576'; g.fillRect(x + w * 0.18, y + h * 0.7, w * 0.64, h * 0.08);
  }
  g.restore();
}
function roundR(g, x, y, w, h, r) { r = Math.max(0, Math.min(r, w / 2, h / 2)); g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }

const GOODS = {
  snacks: { kinds: ['bag', 'bag', 'bag', 'box'], cols: ['#e36b5d', '#f2b53b', '#58a8d8', '#7cc576', '#f28db2', '#e9d27a', '#8e7cc3', '#f08a4b'] },
  food: { kinds: ['cup', 'cup', 'box', 'can'], cols: ['#e36b5d', '#f2c230', '#f4f1e8', '#58a8d8', '#d98a2b', '#b8d98e'] },
  daily: { kinds: ['box', 'box', 'bottle'], cols: ['#8fc3e8', '#f4f1e8', '#b7e0c8', '#f7c7d6', '#c9b8e8', '#f6e3a0'] },
  sweets: { kinds: ['box', 'bag', 'can'], cols: ['#f28db2', '#8a5a44', '#f2c230', '#e36b5d', '#fbe9ef', '#7cc576', '#b48a62'] },
  sakura: { kinds: ['box', 'bag', 'bottle'], cols: ['#f2b5c8', '#eb9db6', '#fbe9ef', '#dd7f9d', '#f7d3de', '#cfe0c8'] },
  drinks: { kinds: ['bottle', 'bottle', 'can'], cols: ['#7cc576', '#b8d98e', '#8fc3e8', '#f08a4b', '#f28db2', '#e8e4d0', '#e36b5d', '#f2c230'] },
};

/** Paint shelves full of goods. rows = number of shelf levels. */
export function paintShelf(g, w, h, rows, set, rr, o = {}) {
  const G = GOODS[set];
  g.fillStyle = o.back ?? '#efece4'; g.fillRect(0, 0, w, h);
  const rh = h / rows;
  for (let i = 0; i < rows; i++) {
    const top = i * rh, lip = (i + 1) * rh - 7;
    const sh = g.createLinearGradient(0, top, 0, lip); sh.addColorStop(0, 'rgba(90,80,110,0.28)'); sh.addColorStop(0.5, 'rgba(90,80,110,0.06)'); sh.addColorStop(1, 'rgba(90,80,110,0.0)');
    g.fillStyle = sh; g.fillRect(0, top, w, lip - top);
    let x = 2;
    const kind = rr.pick(G.kinds);
    while (x < w - 4) {
      const c = rr.pick(G.cols);
      const ph = (lip - top) * (kind === 'bottle' ? 0.86 : kind === 'can' ? 0.55 : kind === 'cup' ? 0.6 : 0.72 + rr() * 0.12);
      const pw = kind === 'bottle' ? ph * 0.36 : kind === 'can' ? ph * 0.55 : kind === 'cup' ? ph * 0.95 : ph * (0.62 + rr() * 0.3);
      const n = 1 + rr.int(1, 3);
      for (let j = 0; j < n && x < w - 4; j++) { drawProduct(g, kind, x, lip - ph, Math.min(pw, w - 4 - x), ph, c, rr); x += pw + 1.5; }
      x += 2;
    }
    g.fillStyle = o.lip ?? '#f7f5ef'; g.fillRect(0, lip, w, 7);
    g.fillStyle = o.lipAccent ?? '#f2d774';
    for (let x2 = 6; x2 < w - 14; x2 += 26 + rr() * 16) g.fillRect(x2, lip + 1.5, 12, 4);
  }
}

// ---------------------------------------------------------------- build
export function buildKonbini(ctx, C) {
  const { M, P, U, A, F, T } = C;
  const S = C.space('W1');
  const k = S.k;
  const rr = ctx.rng('shopsA.konbini');
  const FY = 0.30, CY = 3.15, TOP = 4.35;
  const X0 = -6.0, X1 = 6.0, ZB = -12.0, ZF = -2.6, WT = 0.2;
  const mWall = M.wall('#e8e7e2'), mWall2 = M.wall('#dedcd5'), mAlu = M.t('#b8bdc2'), mAluD = M.t('#8f969d');
  const mTeal = M.t(TEAL), mYel = M.t(YEL);
  const mIn = M.inner('#efece4', 0.45), mInW = M.inner('#f3f1eb', 0.45);
  const glass = M.glass({ opacity: 0.2 });
  const H = FY; // floor

  // ---------------- ground / foundation
  const mPave = M.concrete('#cfcdc6');
  C.pave(S, -6.5, 6.5, ZF, 0, mPave, { uv: 2 });
  C.pave(S, 6.0, 6.5, -14, ZF, mPave, { uv: 2 });
  C.pave(S, -6.5, 6.5, -14, ZB, mPave, { uv: 2 });
  C.pave(S, -6.5, -6.0, ZB, ZF, mPave, { uv: 2 });
  C.plinth(S, X0 - 0.04, X1 + 0.04, ZB - 0.04, ZF + 0.02, FY, M.concrete('#b4b3ad'), 1);

  // ---------------- shell
  const wallH = TOP - FY;
  S.ubox(X1 - X0, wallH, WT, mWall, [0, FY + wallH / 2, ZB + WT / 2], null, 2.5);            // back
  S.ubox(WT, wallH, ZF - ZB, mWall, [X0 + WT / 2, FY + wallH / 2, (ZB + ZF) / 2], null, 2.5); // south
  const NW0 = -9.1, NW1 = -2.9;                                                                 // north window span (lz)
  S.ubox(WT, wallH, NW0 - ZB, mWall, [X1 - WT / 2, FY + wallH / 2, (ZB + NW0) / 2], null, 2.5);
  S.ubox(WT, wallH, ZF - NW1, mWall, [X1 - WT / 2, FY + wallH / 2, (NW1 + ZF) / 2], null, 2.5);
  const WTOP = 3.05; // top of glazing
  S.ubox(WT, TOP - WTOP, NW1 - NW0, mWall, [X1 - WT / 2, (WTOP + TOP) / 2, (NW0 + NW1) / 2], null, 2.5);
  // front: piers + head wall
  S.ubox(0.3, wallH, WT, mWall, [X0 + 0.15, FY + wallH / 2, ZF - WT / 2], null, 2.5);
  S.ubox(0.3, wallH, WT, mWall, [X1 - 0.15, FY + wallH / 2, ZF - WT / 2], null, 2.5);
  S.ubox(X1 - X0 - 0.6, TOP - WTOP, WT, mWall, [0, (WTOP + TOP) / 2, ZF - WT / 2], null, 2.5);
  // grey skirt band at the foot of the walls
  S.ubox(X1 - X0 + 0.02, 0.16, 0.03, M.t('#a9aaa8'), [0, FY + 0.08, ZB - 0.01]);
  S.ubox(0.03, 0.16, ZF - ZB, M.t('#a9aaa8'), [X0 - 0.01, FY + 0.08, (ZB + ZF) / 2]);
  // coping
  k.box(X1 - X0 + 0.26, 0.06, 0.3, mAlu, [0, TOP + 0.03, ZF + 0.03]);
  k.box(X1 - X0 + 0.06, 0.06, 0.26, mAlu, [0, TOP + 0.03, ZB + 0.1]);
  k.box(0.26, 0.06, ZF - ZB + 0.2, mAlu, [X0 + 0.1, TOP + 0.03, (ZB + ZF) / 2]);
  k.box(0.3, 0.06, ZF - ZB + 0.24, mAlu, [X1 + 0.03, TOP + 0.03, (ZB + ZF) / 2 + 0.02]);
  // roof slab (inside parapet)
  k.box(X1 - X0 - 0.4, 0.1, ZF - ZB - 0.4, M.t('#a8aab0'), [0, 4.0, (ZB + ZF) / 2]);

  // ---------------- glazing (front + north)
  const mullion = (x, z, h, alongZ) => k.box(alongZ ? 0.08 : 0.07, h, alongZ ? 0.07 : 0.08, mAlu, [x, FY + h / 2, z]);
  const frontPanes = [[-5.7, -3.83], [-3.83, -1.97], [-1.97, -0.1], [2.1, 3.9], [3.9, 5.7]];
  const gz = ZF - 0.1;
  for (const [a, b] of frontPanes) { const gl = k.plane(b - a, WTOP - FY - 0.08, glass, [(a + b) / 2, FY + 0.08 + (WTOP - FY - 0.08) / 2, gz]); gl.castShadow = false; }
  for (const x of [-5.7, -3.83, -1.97, -0.1, 2.1, 3.9, 5.7]) mullion(x, gz, WTOP - FY, false);
  k.box(X1 - X0 - 0.6, 0.1, 0.12, mAlu, [0, FY + 0.05, gz]);          // bottom rail
  k.box(X1 - X0 - 0.6, 0.08, 0.12, mAlu, [0, WTOP - 0.02, gz]);       // head rail
  // door transom
  k.box(2.2, 0.08, 0.1, mAlu, [1.0, FY + 2.24, gz]);
  { const gl = k.plane(2.2, WTOP - FY - 2.28, glass, [1.0, FY + 2.28 + (WTOP - FY - 2.28) / 2, gz]); gl.castShadow = false; }
  // north glazing
  const gx = X1 - 0.1;
  const northPanes = [[-9.1, -7.03], [-7.03, -4.97], [-4.97, -2.9]];
  for (const [a, b] of northPanes) { const gl = k.plane(b - a, WTOP - FY - 0.08, glass, [gx, FY + 0.08 + (WTOP - FY - 0.08) / 2, (a + b) / 2], [0, Math.PI / 2, 0]); gl.castShadow = false; }
  for (const z of [-9.1, -7.03, -4.97, -2.9]) mullion(gx, z, WTOP - FY, true);
  k.box(0.12, 0.1, NW1 - NW0, mAlu, [gx, FY + 0.05, (NW0 + NW1) / 2]);
  k.box(0.12, 0.08, NW1 - NW0, mAlu, [gx, WTOP - 0.02, (NW0 + NW1) / 2]);

  // ---------------- sign band (lit)
  const bandY0 = 3.22, bandY1 = 4.02, bandH = bandY1 - bandY0;
  k.box(X1 - X0 + 0.18, bandH + 0.06, 0.18, mAlu, [0.09, (bandY0 + bandY1) / 2, ZF + 0.09]);
  k.box(0.18, bandH + 0.06, ZF - ZB + 0.18, mAlu, [X1 + 0.09, (bandY0 + bandY1) / 2, (ZB + ZF + 0.18) / 2]);
  const PXM = 128; // px per metre of band
  const bandStripes = (g, w, h) => {
    g.fillStyle = CREAM; g.fillRect(0, 0, w, h);
    g.fillStyle = TEAL; g.fillRect(0, 0, w, h * 0.27);
    g.fillStyle = YEL; g.fillRect(0, h * 0.27, w, h * 0.075);
    g.fillStyle = TEAL; g.fillRect(0, h * 0.925, w, h * 0.075);
  };
  const logo = (g, x, y, s) => { // sun-in-window mark
    g.fillStyle = TEAL; U.rr(g, x, y, s, s, s * 0.22); g.fill();
    g.fillStyle = CREAM; U.rr(g, x + s * 0.12, y + s * 0.12, s * 0.76, s * 0.76, s * 0.14); g.fill();
    U.sun(g, x + s / 2, y + s * 0.55, s * 0.2, YEL, true);
    g.fillStyle = TEAL; g.fillRect(x + s * 0.12, y + s * 0.74, s * 0.76, s * 0.14);
  };
  const bandLogo = (g, w, h) => {
    bandStripes(g, w, h);
    U.text(g, 'HIDAMARI MART', w * 0.5, h * 0.14, h * 0.19, F.en, '#f6f3ea', { weight: 900 });
    const s = h * 0.56;
    logo(g, w * 0.08, h * 0.35, s);
    U.text(g, 'ひだまりマート', w * 0.58, h * 0.64, h * 0.46, F.round, TEAL_D, { weight: 900, maxW: w * 0.72 });
  };
  const band24 = (g, w, h) => {
    bandStripes(g, w, h);
    U.text(g, '24時間営業', w * 0.36, h * 0.64, h * 0.32, F.round, TEAL_D, { weight: 900 });
    U.text(g, 'OPEN 24H', w * 0.78, h * 0.64, h * 0.26, F.en, '#d99a1f', { weight: 900 });
  };
  const bandPlain = (g, w, h) => { bandStripes(g, w, h); for (let x = w * 0.5; x < w; x += 9999) U.sun(g, x, h * 0.62, h * 0.12, YEL, false); };
  const seg = (fn, len) => A.glow.region(len * PXM, bandH * PXM, fn);
  const rLogo = seg(bandLogo, 4.4), r24 = seg(band24, 3.2), rPlainA = seg(bandPlain, 4.4);
  const fz = ZF + 0.185;
  S.card(rPlainA, 4.4, bandH, [-3.8, (bandY0 + bandY1) / 2, fz]);
  S.card(rLogo, 4.4, bandH, [0.6, (bandY0 + bandY1) / 2, fz]);
  S.card(r24, 3.2, bandH, [4.4, (bandY0 + bandY1) / 2, fz]);
  const fx = X1 + 0.185, nb0 = ZB, nb1 = ZF + 0.18;
  // north face: plain | logo | plain   (runs from front (+z) to back (-z) = viewer's left to right)
  const nLen = nb1 - nb0, nSide = (nLen - 4.4) / 2;
  const rPlainN2 = seg(bandPlain, nSide);
  S.card(rPlainN2, nSide, bandH, [fx, (bandY0 + bandY1) / 2, nb1 - nSide / 2], [0, Math.PI / 2, 0]);
  S.card(rLogo, 4.4, bandH, [fx, (bandY0 + bandY1) / 2, nb1 - nSide - 2.2], [0, Math.PI / 2, 0]);
  S.card(rPlainN2, nSide, bandH, [fx, (bandY0 + bandY1) / 2, nb0 + nSide / 2], [0, Math.PI / 2, 0]);

  // ---------------- entrance canopy (庇) with downlights
  const CANY = FY + 2.45;
  k.box(3.4, 0.1, 1.15, M.t('#e6e5e0'), [1.0, CANY, ZF + 0.575]);
  k.box(3.4, 0.14, 0.04, mAlu, [1.0, CANY, ZF + 1.15]);
  for (const x of [0.0, 1.0, 2.0]) k.cyl(0.07, 0.07, 0.01, M.glow('#fff1d8', 1.25), [x, CANY - 0.055, ZF + 0.62], null, 12);
  // auto-door sensor
  k.box(0.4, 0.07, 0.08, M.t('#d9d9d4'), [1.0, FY + 2.32, ZF + 0.02]);
  k.box(0.2, 0.03, 0.01, M.t('#3a3346'), [1.0, FY + 2.3, ZF + 0.065]);

  // ---------------- automatic doors (dynamic)
  const dg = S.dyn(); const panels = [];
  const dz = ZF - 0.18;
  const mDoorGlass = M.glass({ opacity: 0.16 });
  const rAuto = A.lit.region(96, 40, (g, w, h) => { g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h); U.text(g, '自動ドア', w / 2, h * 0.36, 17, F.sans, '#2c6aa0', { weight: 700 }); U.text(g, 'AUTOMATIC DOOR', w / 2, h * 0.78, 8.5, F.en, '#2c6aa0', { weight: 700 }); });
  for (const s of [-1, 1]) {
    const pg = new THREE.Group(); pg.position.set(1.0 + s * 0.5, FY, dz); dg.add(pg); const kk = ctx.kit(pg);
    kk.box(1.0, 0.06, 0.05, mAlu, [0, 2.17, 0]);
    kk.box(1.0, 0.12, 0.05, mAlu, [0, 0.06, 0]);
    kk.box(0.05, 2.2, 0.05, mAlu, [-0.475, 1.1, 0]);
    kk.box(0.05, 2.2, 0.05, mAlu, [0.475, 1.1, 0]);
    const gl = kk.plane(0.9, 2.0, mDoorGlass, [0, 1.12, 0]); gl.castShadow = false;
    const st = kk.mesh(C.regionGeo(rAuto, 0.24, 0.1), rAuto.m, [s * -0.2, 1.05, 0.004]); st.castShadow = false;
    kk.box(0.9, 0.012, 0.004, M.t('#f3c14b'), [0, 1.3, 0.003]);
    panels.push({ g: pg, s, x0: 1.0 + s * 0.5 });
  }
  const doorW = S.world(1.0, FY, ZF);
  let open = 0, prevT = 0;
  ctx.onUpdate((dt) => {
    const p = ctx.player.position;
    const d = Math.hypot(p.x - doorW.x, p.z - doorW.z);
    const target = d < 2.7 && Math.abs(p.y - doorW.y) < 2.5 ? 1 : 0;
    if (dt <= 0) open = target; else open += Math.sign(target - open) * Math.min(Math.abs(target - open), dt * 1.5);
    if (target && !prevT && dt > 0 && ctx.audio && ctx.audio.play) ctx.audio.play('doorChime', { position: doorW, volume: 0.45 });
    prevT = target;
    const e = open * open * (3 - 2 * open);
    for (const pn of panels) pn.g.position.x = pn.x0 + pn.s * 0.95 * e;
  });
  ctx.physics.addDynamic(() => {
    if (open > 0.55) return [];
    const p = S.toW(1.0, dz);
    return [{ cx: p.x, cz: p.z, w: 2.0 * (1 - open), d: 0.1, rotY: S.f.rotY, y0: S.f.y + FY, y1: S.f.y + FY + 2.2 }];
  });

  // ---------------- entrance landing, steps, ramp, rails, tactile tiles
  const mStep = M.concrete('#c9c7c0');
  const lgY = S.gy(0, -2);
  S.ubox(4.8, FY - lgY + 0.2, 1.2, mStep, [0.2, (FY + lgY - 0.2) / 2, -2.0], null, 2);
  const stepTop = 0.14;
  S.ubox(2.6, stepTop - lgY + 0.2, 0.36, mStep, [1.0, (stepTop + lgY - 0.2) / 2, -1.22], null, 2);
  // ramp (lx -4.4 .. -2.2)
  const rampLo = S.gy(-4.4, -2.0) + 0.02;
  {
    const len = 2.2, rise = FY - rampLo, ang = Math.atan2(rise, len);
    const L2 = Math.hypot(len, rise);
    S.ubox(L2, 0.12, 1.2, mStep, [-3.3, (FY + rampLo) / 2 - 0.06, -2.0], [0, 0, ang], 2);
    // side skirt under the ramp (street side)
    S.ubox(len, 0.3, 0.1, mStep, [-3.3, (FY + rampLo) / 2 - 0.25, -1.45], [0, 0, ang], 2);
  }
  // handrail along the ramp + landing edge
  const mRail = M.t('#c3c7cb');
  for (const x of [-4.3, -3.3, -2.25]) { const y0 = rampLo + (FY - rampLo) * ((x + 4.4) / 2.2); k.cyl(0.022, 0.022, 0.85, mRail, [x, y0 + 0.425, -1.47], null, 8); }
  {
    const a = new THREE.Vector3(-4.3, rampLo + 0.05 + 0.85, -1.47), b = new THREE.Vector3(-2.25, FY + 0.85, -1.47);
    const len = a.distanceTo(b); k.cyl(0.025, 0.025, len, mRail, [(a.x + b.x) / 2, (a.y + b.y) / 2, -1.47], [0, 0, Math.PI / 2 + Math.atan2(b.y - a.y, b.x - a.x)], 8);
    k.cyl(0.025, 0.025, 1.9, mRail, [-1.3, FY + 0.85, -1.47], [0, 0, Math.PI / 2], 8);
    for (const x of [-1.3, -0.4]) k.cyl(0.022, 0.022, 0.85, mRail, [x, FY + 0.425, -1.47], null, 8);
  }
  // tactile tiles
  const tileReg = (bars) => A.lit.region(64, 64, (g, w, h) => {
    g.fillStyle = '#efc233'; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,0.45)'; g.fillRect(0, 0, w, 2); g.fillRect(0, 0, 2, h);
    g.fillStyle = 'rgba(150,110,20,0.5)'; g.fillRect(0, h - 2, w, 2); g.fillRect(w - 2, 0, 2, h);
    if (bars) { for (let i = 0; i < 4; i++) { g.fillStyle = '#d9a71e'; U.rr(g, 8 + i * 13.5, 6, 8, h - 12, 4); g.fill(); g.fillStyle = 'rgba(255,245,200,0.7)'; g.fillRect(9 + i * 13.5, 8, 2, h - 16); } }
    else { for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) { g.fillStyle = '#d9a71e'; g.beginPath(); g.arc(8 + i * 12, 8 + j * 12, 4.2, 0, 6.3); g.fill(); g.fillStyle = 'rgba(255,245,200,0.8)'; g.beginPath(); g.arc(7 + i * 12, 7 + j * 12, 1.4, 0, 6.3); g.fill(); } }
  }, { bg: '#efc233' });
  const rDots = tileReg(false), rBars = tileReg(true);
  const tile = (reg, x, y, z, rot = 0) => S.card(reg, 0.3, 0.3, [x, y + 0.006, z], [-Math.PI / 2, 0, rot]);
  for (let x = -0.05; x < 2.2; x += 0.3) tile(rDots, x + 0.15, FY, -1.58);            // top of the step
  for (let x = 0.55; x < 1.5; x += 0.3) tile(rDots, x + 0.15, FY, -2.4);             // before the doors
  tile(rDots, 1.0, stepTop, -1.22); // on step: warning
  for (let z = -0.93; z < -0.05; z += 0.3) tile(rBars, 1.0, S.gy(1.0, z) + 0.02, z + 0.15);   // guide to the sidewalk
  for (let z = -2.6; z < -1.5; z += 0.3) tile(rDots, -2.05, FY, z + 0.15);
  for (const z of [-2.0, -1.7]) tile(rDots, -4.57, S.gy(-4.57, z) + 0.02, z);

  // ---------------- bike parking paint (SPOTS.konbiniBikes at lx 4.6 / 3.85)
  const mLine = M.decal('#eeece6');
  for (const x of [3.475, 4.225, 4.975, 5.725]) {
    const y = S.gy(x, -1.2) + 0.026;
    k.plane(0.06, 2.1, mLine, [x, y, -1.2], [-Math.PI / 2, 0, 0]);
  }
  k.plane(2.31, 0.06, mLine, [4.6, S.gy(4.6, -2.28) + 0.026, -2.28], [-Math.PI / 2, 0, 0]);
  const rBikeIcon = A.cut.region(128, 96, (g, w, h) => {
    g.strokeStyle = '#eeece6'; g.lineWidth = 7; g.lineCap = 'round'; g.lineJoin = 'round';
    g.beginPath(); g.arc(30, 62, 22, 0, 6.3); g.stroke(); g.beginPath(); g.arc(98, 62, 22, 0, 6.3); g.stroke();
    g.beginPath(); g.moveTo(30, 62); g.lineTo(52, 30); g.lineTo(86, 30); g.lineTo(98, 62); g.moveTo(52, 30); g.lineTo(64, 62); g.lineTo(30, 62); g.moveTo(86, 30); g.lineTo(80, 16); g.lineTo(92, 16); g.moveTo(48, 22); g.lineTo(60, 22); g.stroke();
  });
  { const m = S.card(rBikeIcon, 0.62, 0.46, [5.35, S.gy(5.35, -1.2) + 0.03, -1.3], [-Math.PI / 2, 0, Math.PI / 2]); ctx.noOutline(m); }

  // ---------------- window posters (face the street / R3)
  const poster = (w, h, fn) => A.lit.region(w, h, fn);
  const pDrink = poster(220, 310, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#bfe3f4'); gr.addColorStop(1, '#f6f3ea'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 7; i++) U.sakura(g, 20 + (i * 53) % w, 40 + (i * 97) % (h - 80), 10 + (i % 3) * 3, 'rgba(242,181,200,0.7)');
    g.fillStyle = '#e8506a'; g.beginPath(); g.arc(46, 46, 34, 0, 6.3); g.fill(); U.text(g, '新発売', 46, 47, 21, F.round, '#fff', { weight: 900 });
    // bottle
    g.fillStyle = '#f2b5c8'; U.rr(g, w * 0.5, h * 0.3, w * 0.28, h * 0.5, 16); g.fill();
    g.fillStyle = '#f2b5c8'; g.fillRect(w * 0.58, h * 0.22, w * 0.12, h * 0.1); g.fillStyle = '#fbf8f0'; g.fillRect(w * 0.57, h * 0.19, w * 0.14, h * 0.04);
    g.fillStyle = '#fbf8f0'; g.fillRect(w * 0.5, h * 0.46, w * 0.28, h * 0.14); U.sakura(g, w * 0.64, h * 0.53, 12, '#eb9db6', '#f2c230');
    g.fillStyle = 'rgba(255,255,255,0.6)'; g.fillRect(w * 0.53, h * 0.33, 6, h * 0.4);
    U.vtext(g, '春色さくらソーダ', w * 0.24, h * 0.2, 22, F.round, '#c2476a', 900, 1.0);
    U.text(g, '¥160', w * 0.64, h * 0.9, 34, F.round, '#c2476a', { weight: 900 });
    U.text(g, '(税込)', w * 0.88, h * 0.93, 12, F.sans, '#c2476a', { weight: 700 });
  });
  const pBento = poster(220, 310, (g, w, h) => {
    g.fillStyle = '#fbf1dc'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#e9a23b'; g.fillRect(0, 0, w, 58); U.text(g, 'できたて', w / 2, 30, 30, F.round, '#fff', { weight: 900 });
    // bento
    g.fillStyle = '#3a3346'; U.rr(g, 22, 86, w - 44, 120, 10); g.fill();
    g.fillStyle = '#f7f4ec'; g.fillRect(32, 96, 78, 100); U.sakura(g, 60, 128, 12, '#f2b5c8', '#f7d3de'); U.sakura(g, 84, 160, 10, '#f2b5c8');
    g.fillStyle = '#b86a3a'; U.rr(g, 118, 96, 70, 46, 12); g.fill();
    g.fillStyle = '#f2c230'; g.fillRect(118, 148, 32, 48); g.fillStyle = '#6fa55a'; g.fillRect(156, 148, 32, 48);
    U.text(g, '春の彩り弁当', w / 2, 236, 28, F.round, '#8a4b2a', { weight: 900, maxW: w - 20 });
    U.text(g, '¥498', w / 2, 278, 36, F.round, '#d9463b', { weight: 900 });
  });
  const pIce = poster(220, 310, (g, w, h) => {
    g.fillStyle = '#cfeee4'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 12; i++) { g.fillStyle = 'rgba(255,255,255,0.6)'; g.beginPath(); g.arc((i * 71) % w, (i * 43) % h, 6 + (i % 4) * 3, 0, 6.3); g.fill(); }
    U.text(g, 'アイス', w / 2, 44, 52, F.round, '#2c8a7e', { weight: 900 });
    g.fillStyle = '#d9a86a'; g.beginPath(); g.moveTo(w * 0.36, h * 0.5); g.lineTo(w * 0.64, h * 0.5); g.lineTo(w * 0.5, h * 0.82); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(140,90,40,0.5)'; g.lineWidth = 2; for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(w * 0.38 + i * 12, h * 0.5); g.lineTo(w * 0.5, h * 0.8); g.stroke(); }
    g.fillStyle = '#f7d3de'; g.beginPath(); g.arc(w * 0.5, h * 0.44, w * 0.17, 0, 6.3); g.fill();
    g.fillStyle = '#fbf3e8'; g.beginPath(); g.arc(w * 0.5, h * 0.33, w * 0.13, 0, 6.3); g.fill();
    U.sakura(g, w * 0.6, h * 0.3, 11, '#eb9db6', '#f2c230');
    U.text(g, '新作 さくらもち味', w / 2, h * 0.9, 24, F.round, '#2c8a7e', { weight: 900, maxW: w - 16 });
  });
  const pFair = poster(220, 310, (g, w, h) => {
    g.fillStyle = '#fbe3ea'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 16; i++) U.sakura(g, (i * 61 + 13) % w, (i * 37 + 9) % h, 9 + (i % 4) * 5, i % 2 ? '#f2b5c8' : '#f7d3de', '#f6e3a0');
    g.fillStyle = 'rgba(255,255,255,0.85)'; U.rr(g, 16, 70, w - 32, 170, 18); g.fill();
    U.text(g, '春の', w / 2, 100, 30, F.round, '#d9718f', { weight: 900 });
    U.text(g, 'さくらフェア', w / 2, 146, 40, F.round, '#c2476a', { weight: 900, maxW: w - 44 });
    U.text(g, '3/15〜4/20', w / 2, 192, 24, F.en, '#6d6a80', { weight: 700 });
    U.text(g, '対象商品でポイント2倍', w / 2, 222, 17, F.sans, '#c2476a', { weight: 700, maxW: w - 44 });
    g.fillStyle = TEAL; g.fillRect(0, h - 40, w, 40); U.text(g, 'ひだまりマート', w / 2, h - 19, 22, F.round, '#fff', { weight: 900 });
  });
  const pKaraage = poster(220, 310, (g, w, h) => {
    g.fillStyle = '#fff4c8'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#e9a23b'; for (let i = 0; i < 10; i++) { g.save(); g.translate(w / 2, h * 0.45); g.rotate(i * 0.628); g.fillRect(-4, 0, 8, w); g.restore(); }
    g.fillStyle = '#fff4c8'; g.beginPath(); g.arc(w / 2, h * 0.45, 70, 0, 6.3); g.fill();
    for (const [x, y] of [[-24, -10], [20, -16], [0, 18], [-30, 26], [30, 22]]) { g.fillStyle = '#b86a3a'; g.beginPath(); g.ellipse(w / 2 + x, h * 0.45 + y, 26, 21, x * 0.02, 0, 6.3); g.fill(); g.fillStyle = 'rgba(255,220,150,0.6)'; g.beginPath(); g.arc(w / 2 + x - 8, h * 0.45 + y - 8, 6, 0, 6.3); g.fill(); }
    U.text(g, 'からあげ', w / 2, 40, 44, F.round, '#d9463b', { weight: 900, stroke: 6, strokeColor: '#fff' });
    U.text(g, '増量中!', w / 2, h * 0.78, 42, F.round, '#d9463b', { weight: 900, stroke: 6, strokeColor: '#fff' });
    U.text(g, '5個入り ¥238', w / 2, h * 0.92, 22, F.round, INK, { weight: 700 });
  });
  const pz = gz + 0.012;
  S.card(pDrink, 0.55, 0.78, [-4.9, FY + 1.55, pz]);
  S.card(pBento, 0.55, 0.78, [-2.95, FY + 1.55, pz]);
  S.card(pFair, 0.62, 0.88, [3.05, FY + 1.6, pz]);
  S.card(pIce, 0.55, 0.78, [4.85, FY + 1.55, pz]);
  S.card(pKaraage, 0.55, 0.78, [gx + 0.012, FY + 1.55, -8.1], [0, Math.PI / 2, 0]);
  // small stickers on the door-side glass
  const rStick = A.lit.region(200, 120, (g, w, h) => {
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
    g.fillStyle = TEAL; g.fillRect(0, 0, w, 28); U.text(g, 'ご利用いただけます', w / 2, 15, 15, F.sans, '#fff', { weight: 700 });
    const marks = [['#e36b5d', 'IC'], ['#3f7fb5', 'QR'], ['#f2b53b', 'Pay'], ['#5a9e58', 'ATM']];
    marks.forEach(([c, t], i) => { g.fillStyle = c; U.rr(g, 10 + i * 47, 40, 40, 32, 6); g.fill(); U.text(g, t, 30 + i * 47, 57, 14, F.en, '#fff', { weight: 900 }); });
    U.text(g, '各種電子マネー · クレジットカード', w / 2, 96, 12.5, F.sans, INK, { weight: 700, maxW: w - 10 });
  });
  S.card(rStick, 0.3, 0.18, [-0.4, FY + 1.3, pz]);
  const r24s = A.lit.region(120, 120, (g, w, h) => { g.fillStyle = TEAL; U.rr(g, 0, 0, w, h, 60); g.fill(); g.fillStyle = CREAM; g.beginPath(); g.arc(60, 60, 50, 0, 6.3); g.fill(); U.text(g, '24', 60, 54, 46, F.en, TEAL_D, { weight: 900 }); U.text(g, '時間営業', 60, 90, 17, F.sans, TEAL_D, { weight: 900 }); });
  S.card(r24s, 0.2, 0.2, [2.4, FY + 1.35, pz]);
  // local mascot sticker (さくらん) low on the glass + fire extinguisher inside by the door
  const rMascot = A.lit.region(128, 128, (g, w, h) => {
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(64, 64, 62, 0, 6.3); g.fill();
    g.fillStyle = '#f7c3d3'; g.beginPath(); g.arc(64, 60, 44, 0, 6.3); g.fill();
    for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * 1.2566; g.fillStyle = '#f2b5c8'; g.beginPath(); g.ellipse(64 + Math.cos(a) * 40, 60 + Math.sin(a) * 40, 16, 11, a, 0, 6.3); g.fill(); }
    g.fillStyle = '#fbe9ef'; g.beginPath(); g.arc(64, 62, 30, 0, 6.3); g.fill();
    g.fillStyle = INK; g.beginPath(); g.arc(53, 58, 4, 0, 6.3); g.fill(); g.beginPath(); g.arc(75, 58, 4, 0, 6.3); g.fill();
    g.strokeStyle = INK; g.lineWidth = 2.5; g.beginPath(); g.arc(64, 66, 7, 0.3, Math.PI - 0.3); g.stroke();
    g.fillStyle = '#f28db2'; g.beginPath(); g.arc(46, 68, 5, 0, 6.3); g.fill(); g.beginPath(); g.arc(82, 68, 5, 0, 6.3); g.fill();
    U.text(g, 'さくらん', 64, 112, 17, F.round, '#c2476a', { weight: 900 });
  });
  S.card(rMascot, 0.16, 0.16, [-1.25, FY + 0.95, pz]);
  const rATMs = A.lit.region(140, 60, (g, w, h) => { g.fillStyle = '#3f7fb5'; U.rr(g, 0, 0, w, h, 8); g.fill(); U.text(g, 'ATM', 45, 31, 30, F.en, '#fff', { weight: 900 }); U.text(g, 'あります', 105, 32, 16, F.sans, '#fff', { weight: 700 }); });
  S.card(rATMs, 0.28, 0.12, [2.4, FY + 1.08, pz]);

  // ---------------- interior shell skins (walls, ceiling) + modelled contents (intKonbini.js)
  const IX0 = X0 + WT, IX1 = X1 - WT, IZ0 = ZB + WT, IZ1 = ZF - WT;
  k.plane(IX1 - IX0, IZ1 - IZ0 + 0.1, mInW, [(IX0 + IX1) / 2, CY, (IZ0 + IZ1) / 2], [Math.PI / 2, 0, 0]);
  k.plane(IX1 - IX0, CY - FY, mIn, [(IX0 + IX1) / 2, (FY + CY) / 2, IZ0 + 0.005]);
  k.plane(IZ1 - IZ0, CY - FY, mIn, [IX0 + 0.005, (FY + CY) / 2, (IZ0 + IZ1) / 2], [0, Math.PI / 2, 0]);
  k.plane(NW0 - IZ0, CY - FY, mIn, [IX1 - 0.005, (FY + CY) / 2, (IZ0 + NW0) / 2], [0, -Math.PI / 2, 0]);
  k.box(IX1 - IX0, 0.12, 0.02, M.inner('#b9bcc0', 0.2), [(IX0 + IX1) / 2, FY + 0.06, IZ0 + 0.012]);
  k.box(0.02, 0.12, IZ1 - IZ0, M.inner('#b9bcc0', 0.2), [IX0 + 0.012, FY + 0.06, (IZ0 + IZ1) / 2]);
  buildKonbiniInterior(ctx, C, S, { FY, CY, IX0, IX1, IZ0, IZ1, NW0, NW1, gx, gz, TEAL, TEAL_D, YEL, CREAM, INK });

  // ---------------- exterior: bins, umbrella stand, flags, signs
  {
    const x0 = -5.95, bw = 0.42, z = -2.33;
    const BY = Math.max(S.gy(x0, z), S.gy(x0 + bw * 3, z)) + 0.05, padH = BY - Math.min(S.gy(x0, z), S.gy(x0 + bw * 3, z)) + 0.2;
    S.ubox(bw * 3 + 0.2, padH, 0.56, M.concrete('#c9c7c0'), [x0 + bw * 1.5, BY - padH / 2, z], null, 2);
    const labels = [['もやせるごみ', '#e36b5d'], ['かん・びん', '#3f7fb5'], ['ペットボトル', '#5a9e58']];
    k.box(bw * 3 + 0.04, 0.95, 0.44, M.t('#e3e1da'), [x0 + bw * 1.5, BY + 0.475, z]);
    k.box(bw * 3 + 0.08, 0.05, 0.48, M.t(TEAL), [x0 + bw * 1.5, BY + 0.975, z]);
    labels.forEach(([t, c], i) => {
      const reg = A.lit.region(96, 96, (g, w, h) => {
        g.fillStyle = '#fbf8f0'; g.fillRect(0, 0, w, h); g.fillStyle = c; g.fillRect(0, 0, w, 34); U.text(g, t, w / 2, 18, 14, F.sans, '#fff', { weight: 900, maxW: w - 6 });
        g.fillStyle = '#3a3346'; U.rr(g, 18, 46, 60, 22, 11); g.fill();
        U.text(g, i === 0 ? 'Burnable' : i === 1 ? 'Cans & Bottles' : 'PET Bottles', w / 2, 84, 10, F.en, c, { weight: 700, maxW: w - 6 });
      });
      S.card(reg, 0.36, 0.36, [x0 + bw * (i + 0.5), BY + 0.68, z + 0.225]);
    });
    S.box(x0 + bw * 1.5, z, bw * 3 + 0.08, 0.48, -1, BY + 1.0);
    P.umbrellaStand(S, 2.35, FY, -2.4, 0, { umbrellas: ['#7ea6c9', '#e8e6df'] });
    S.box(2.35, -2.4, 0.5, 0.24, -1, FY + 0.6);
    const flag = (txt, sub, bg, fg) => A.lit.region(96, 340, (g, w, h) => {
      g.fillStyle = bg; g.fillRect(0, 0, w, h);
      g.fillStyle = fg; g.fillRect(0, 0, w, 10); g.fillRect(0, h - 10, w, 10);
      U.vtext(g, txt, w / 2, 24, 40, F.round, fg, 900, 1.0);
      if (sub) { g.fillStyle = fg; g.fillRect(6, h - 70, w - 12, 50); U.text(g, sub, w / 2, h - 45, 20, F.round, bg, { weight: 900, maxW: w - 16 }); }
    });
    const fSakura = flag('さくらフェア', '開催中', '#fbe3ea', '#c2476a');
    const fIce = flag('ソフトクリーム', null, '#f6f3ea', '#3f7fb5');
    P.nobori(S, -6.15, S.gy(-6.15, -0.45), -0.45, 0.25, fSakura, { w: 0.42, h: 1.55 });
    P.nobori(S, 2.95, S.gy(2.95, -0.3), -0.3, -0.35, fIce, { w: 0.42, h: 1.55 });
    S.cyl(-6.15, -0.45, 0.17, -1, 2.2); S.cyl(2.95, -0.3, 0.17, -1, 2.2);
    // bicycle parking sign on the corner pier
    const rBikeSign = A.lit.region(120, 96, (g, w, h) => { g.fillStyle = '#fbf8f0'; g.fillRect(0, 0, w, h); g.fillStyle = TEAL; g.fillRect(0, 0, w, 30); U.text(g, '駐輪場', w / 2, 16, 20, F.sans, '#fff', { weight: 900 }); U.text(g, '自転車は', w / 2, 50, 15, F.sans, INK, { weight: 700 }); U.text(g, '枠内にお願いします', w / 2, 72, 12, F.sans, INK, { weight: 700, maxW: w - 8 }); });
    S.card(rBikeSign, 0.3, 0.24, [X1 - 0.15, FY + 1.5, ZF + 0.005]);
    // ATM lit box sign on the north wall
    k.box(0.12, 0.5, 0.9, M.t('#e6e5e0'), [X1 + 0.06, 2.3, -10.4]);
    const rATMbox = A.glow.region(180, 100, (g, w, h) => { g.fillStyle = '#3f7fb5'; g.fillRect(0, 0, w, h); U.text(g, 'ATM', w / 2, 40, 48, F.en, '#fff', { weight: 900 }); U.text(g, '24時間 · 年中無休', w / 2, 80, 17, F.sans, '#fff', { weight: 700 }); });
    S.card(rATMbox, 0.84, 0.46, [X1 + 0.125, 2.3, -10.4], [0, Math.PI / 2, 0]);
    // 営業時間 plate by the door
    const rHours = A.lit.region(100, 130, (g, w, h) => { g.fillStyle = '#fbf8f0'; g.fillRect(0, 0, w, h); g.fillStyle = TEAL; g.fillRect(0, 0, w, 26); U.text(g, '営業時間', w / 2, 14, 15, F.sans, '#fff', { weight: 900 }); U.text(g, '24', w / 2, 62, 40, F.en, TEAL_D, { weight: 900 }); U.text(g, '時間', w / 2, 96, 17, F.sans, TEAL_D, { weight: 900 }); U.text(g, '年中無休', w / 2, 118, 13, F.sans, INK, { weight: 700 }); });
    S.card(rHours, 0.2, 0.26, [-0.25, FY + 1.7, pz]);
  }

  // ---------------- back yard + side services
  {
    // back door with step
    const bdX = -1.2;
    const bST = FY - 0.15, bSB = S.gy(bdX, -12.3) - 0.2;
    S.ubox(1.3, bST - bSB, 0.55, M.concrete('#c4c2bb'), [bdX, (bST + bSB) / 2, ZB - 0.27], null, 2);
    const rStaffD = A.lit.region(96, 32, (g, w, h) => { g.fillStyle = '#fbf8f0'; g.fillRect(0, 0, w, h); U.text(g, '従業員出入口', w / 2, h / 2 + 1, 14, F.sans, INK, { weight: 700 }); });
    P.backDoor(S, bdX, FY, ZB, Math.PI, '#9aa6ad', { label: rStaffD });
    S.walk(bdX, ZB - 0.27, 1.3, 0.55, bST);
    // AC outdoor units (業務用) against the back wall
    for (const [x, big] of [[1.2, true], [2.35, true], [-3.3, false]]) {
      const w = big ? 0.95 : 0.8, h = big ? 1.1 : 0.62;
      P.acUnit(S, x, S.gy(x, -12.35), -12.28, Math.PI, { w, h, d: 0.34, ductH: big ? 2.6 : 1.4 });
      S.box(x, -12.28, w + 0.1, 0.4, -1, h + 0.2);
    }
    // meters and pipes
    P.meter(S, -4.6, 1.6, ZB, Math.PI);
    P.gasMeter(S, -5.3, 1.1, ZB, Math.PI);
    for (const x of [-4.1, -3.95]) P.pipe(S, x, ZB - 0.06, 0.1, TOP - 0.1, 0.03, M.t('#bdbab1'));
    P.downpipe(S, X0 + 0.1, ZB - 0.06, TOP - 0.05, undefined, [0, 1]);
    P.downpipe(S, X1 - 0.12, ZB - 0.06, TOP - 0.05, undefined, [0, 1]);
    // garbage cage (網のゴミ置き場) with bags
    const cg = { x0: 3.6, x1: 5.7, z0: -13.9, z1: -12.65 };
    const cgc = [(cg.x0 + cg.x1) / 2, (cg.z0 + cg.z1) / 2];
    const cgy = S.gy(cgc[0], cgc[1]);
    const mCage = M.t('#6f8a7c');
    for (const [x, z] of [[cg.x0, cg.z0], [cg.x1, cg.z0], [cg.x0, cg.z1], [cg.x1, cg.z1]]) k.box(0.05, 1.2, 0.05, mCage, [x, cgy + 0.6, z]);
    for (const y of [0.05, 1.18]) { k.box(cg.x1 - cg.x0, 0.04, 0.04, mCage, [cgc[0], cgy + y, cg.z0]); k.box(cg.x1 - cg.x0, 0.04, 0.04, mCage, [cgc[0], cgy + y, cg.z1]); k.box(0.04, 0.04, cg.z1 - cg.z0, mCage, [cg.x0, cgy + y, cgc[1]]); k.box(0.04, 0.04, cg.z1 - cg.z0, mCage, [cg.x1, cgy + y, cgc[1]]); }
    const rMesh = A.cut.region(128, 128, (g, w, h) => { g.strokeStyle = '#6f8a7c'; g.lineWidth = 3.2; for (let i = 0; i <= 16; i++) { g.beginPath(); g.moveTo(i * 8, 0); g.lineTo(i * 8, h); g.stroke(); g.beginPath(); g.moveTo(0, i * 8); g.lineTo(w, i * 8); g.stroke(); } });
    const meshCard = (w, h, pos, rot) => { const m = S.card(rMesh, w, h, pos, rot); ctx.noOutline(m); return m; };
    meshCard(cg.x1 - cg.x0, 1.12, [cgc[0], cgy + 0.62, cg.z1], null);
    meshCard(cg.x1 - cg.x0, 1.12, [cgc[0], cgy + 0.62, cg.z0], null);
    meshCard(cg.z1 - cg.z0, 1.12, [cg.x0, cgy + 0.62, cgc[1]], [0, Math.PI / 2, 0]);
    meshCard(cg.x1 - cg.x0, cg.z1 - cg.z0, [cgc[0], cgy + 1.2, cgc[1]], [-Math.PI / 2, 0, 0]);
    for (let i = 0; i < 6; i++) C.scatter.add('bush', S, [cg.x0 + 0.35 + (i % 3) * 0.6 + rr() * 0.1, cgy + 0.25 + Math.floor(i / 3) * 0.3, cgc[1] + (rr() - 0.5) * 0.4], [0.28, 0.25, 0.26], rr.pick(['#e8e6df', '#dfe6ea', '#f0ecd8']));
    S.box(cgc[0], cgc[1], cg.x1 - cg.x0 + 0.06, cg.z1 - cg.z0 + 0.06, -1, 1.3);
    // delivery crates (番重) + milk crates + flattened cartons by the back door
    const cy0 = S.gy(0.1, -12.9);
    for (let i = 0; i < 4; i++) P.crate(S, 0.05, cy0 + i * 0.16, -12.95, 0.05 * (i % 2), '#3f9a92', { w: 0.62, h: 0.16, d: 0.46 });
    for (let i = 0; i < 2; i++) P.crate(S, -0.55 + i * 0.02, cy0 + i * 0.3, -13.4, 0.1 * i, i ? '#e9c34b' : '#4f8fc0', { bottles: i ? '#f4f1e8' : null });
    P.crate(S, 0.7, S.gy(0.7, -13.4), -13.5, -0.3, '#e36b5d');
    for (let i = 0; i < 5; i++) P.carton(S, -2.35, S.gy(-2.35, -12.2) + i * 0.035, -12.15 - i * 0.003, 0.9, 0.03, 0.62, 0.02 * i);
    k.box(0.9, 0.9, 0.05, M.carton(), [-2.35, S.gy(-2.35, -12.2) + 0.45, -12.08], [0.12, 0, 0]);
    S.box(0.0, -13.1, 1.9, 1.0, -1, 0.8);
    // mop & bucket
    k.cyl(0.14, 0.12, 0.28, M.t('#4f8fc0'), [-5.4, S.gy(-5.4, -12.5) + 0.14, -12.5], null, 10);
    k.cyl(0.012, 0.012, 1.3, M.t('#d9d6ce'), [-5.62, S.gy(-5.6, -12.2) + 0.65, -12.15], [0.12, 0, 0.1], 5);
    // side fence closing the yard toward R3 (north)
    const fy = S.gy(6.35, -13);
    for (const z of [-13.95, -12.8]) k.box(0.05, 1.5, 0.05, mCage, [6.35, fy + 0.75, z]);
    meshCard(1.15, 1.35, [6.35, fy + 0.78, -13.37], [0, Math.PI / 2, 0]);
    k.box(0.04, 0.04, 1.15, mCage, [6.35, fy + 1.47, -13.37]);
    S.box(6.35, -13.37, 0.08, 1.25, -1, 1.6);
  }
  // south wall: downpipe + meter box (faces the flower shop gap)
  P.downpipe(S, X0 - 0.06, ZF - 0.35, TOP - 0.05, undefined, [1, 0]);
  // roof top: AC condensers + vent
  for (const [x, z] of [[-3.8, -10.4], [-2.6, -10.4], [-1.4, -10.4]]) P.acUnit(S, x, 4.05, z, 0, { w: 0.95, h: 0.8, d: 0.36, duct: false });
  k.box(0.6, 0.5, 0.6, M.t('#b9bcc0'), [3.5, 4.3, -9.5]);
  k.cyl(0.2, 0.2, 0.3, M.t('#9aa1a8'), [3.5, 4.7, -9.5], null, 10);

  // ---------------- physics: shell
  S.box(0, ZB + WT / 2, X1 - X0, WT, -1, TOP);
  S.box(X0 + WT / 2, (ZB + ZF) / 2, WT, ZF - ZB, -1, TOP);
  S.box(X1 - WT / 2, (ZB + ZF) / 2, WT, ZF - ZB, -1, TOP);
  S.box((X0 + 0.0) / 2, ZF - WT / 2, 0.0 - X0, WT, -1, TOP);
  S.box((2.0 + X1) / 2, ZF - WT / 2, X1 - 2.0, WT, -1, TOP);
  S.box(1.0, ZF - WT / 2, 2.2, WT, FY + 2.25, TOP);
  S.walk(0, (ZB + ZF) / 2, X1 - X0, ZF - ZB, FY);
  S.walk(0.2, -2.0, 4.8, 1.2, FY);
  S.walk(1.0, -1.22, 2.6, 0.36, stepTop);
  S.ramp(-3.3, -2.0, 1.2, 2.2, rampLo, FY, Math.PI / 2);
  S.box(-3.3, -1.47, 2.2, 0.08, -1, FY + 0.9);
  S.box(-1.3, -1.47, 1.9, 0.08, -1, FY + 0.9);

  return { S };
}
