// E1 — 喫茶 はるいろ Café Haruiro (corner lot: faces the main street (west) and the plaza (north)).
// Lot-local: +z = street (world -X), +x = south. Cream plaster + dark brown wood, 2 storeys (flat above),
// gable roof, fabric awning, terrace deck with two bistro tables, enterable interior.
import * as THREE from 'three';
import { buildCafeInterior } from './intCafe.js';

const MOSS = '#6f8455', BURG = '#8c3a45', OFFW = '#efe9dc', CREAM = '#efe3c8', WOOD = '#5a4032', INK = '#3a3346';

export function buildCafe(ctx, C) {
  const { M, P, U, A, F, T } = C;
  const S = C.space('E1');
  const k = S.k;
  const rr = ctx.rng('shopsA.cafe');
  const FY = 0.32, C1 = 3.3, F2 = 3.45, E = 6.1;
  const X0 = -5.4, X1 = 5.4, ZB = -12.8, ZF = -3.8, WT = 0.22;
  const DY = 0.24; // terrace deck top
  const mPl = M.wall(CREAM), mPl2 = M.wall('#e8d9bb'), mWood = M.wood(WOOD), mWoodL = M.wood('#8a6446');
  const mIn = M.inner('#f0e4cb', 0.3), mInWood = M.inner('#6b4a37', 0.22, { map: T.wood });
  const glass = M.glass({ opacity: 0.2, tint: '#a9bcc4' });

  // ---------------- ground
  C.pave(S, -6.0, 6.0, -14, ZB, M.concrete('#c9c6bd'), { uv: 2 });
  C.pave(S, 5.4, 6.0, ZB, ZF, M.concrete('#c9c6bd'), { uv: 2 });
  C.pave(S, -6.0, 6.0, -1.0, 0, M.tiles('#d8cbb5'), { uv: 0.6 });
  // planting strip along the plaza-side (north) wall
  C.pave(S, -6.0, X0, ZB, ZF, M.t('#8b7560'), { uv: 1, lift: 0.03 });
  k.box(0.08, 0.14, ZF - ZB, M.concrete('#bdb9ae'), [-5.96, S.gy(-5.96, -8) + 0.05, (ZB + ZF) / 2]);
  C.pave(S, -6.0, X0, ZF, -1.0, M.tiles('#d8cbb5'), { uv: 0.6 });
  C.plinth(S, X0 - 0.03, X1 + 0.03, ZB - 0.03, ZF + 0.03, FY, M.brick(), 1);

  // ---------------- terrace deck + step
  {
    const z0 = ZF, z1 = -1.0, x0 = -5.25, x1 = 5.25;
    const lo = Math.min(S.gy(x0, z1), S.gy(x1, z1)) - 0.15;
    S.ubox(x1 - x0, DY - lo, z1 - z0, M.planks('#b8906a'), [(x0 + x1) / 2, (DY + lo) / 2, (z0 + z1) / 2], [0, Math.PI / 2, 0].map((v, i) => i === 1 ? 0 : v), 1.6);
    k.box(x1 - x0 + 0.04, 0.14, 0.04, mWood, [(x0 + x1) / 2, DY - 0.08, z1 + 0.01]);
    k.box(0.04, 0.14, z1 - z0, mWood, [x0 - 0.01, DY - 0.08, (z0 + z1) / 2]);
    const st = 0.12;
    S.ubox(2.6, st - (S.gy(-2.9, -0.8) - 0.15), 0.4, M.planks('#b08864'), [-2.9, (st + S.gy(-2.9, -0.8) - 0.15) / 2, -0.8], null, 1.6);
    S.walk(0, (z0 + z1) / 2, x1 - x0, z1 - z0, DY);
    S.walk(-2.9, -0.8, 2.6, 0.4, st);
  }

  // ---------------- shell (ground floor)
  const h1 = F2 - FY; // ground storey wall height
  // back + side walls (full height to eaves)
  const BWIN = [-3.4, -2.0, 4.2, 5.4], BDOOR = [1.3, 2.9, F2 + 0.12, 5.5];
  {
    const bz = ZB + WT / 2;
    const bseg = (x0, x1, y0, y1) => S.ubox(x1 - x0, y1 - y0, WT, mPl, [(x0 + x1) / 2, (y0 + y1) / 2, bz], null, 2.5);
    bseg(X0, X1, FY, F2);
    bseg(X0, BWIN[0], F2, E); bseg(BWIN[0], BWIN[1], F2, BWIN[2]); bseg(BWIN[0], BWIN[1], BWIN[3], E);
    bseg(BWIN[1], BDOOR[0], F2, E); bseg(BDOOR[0], BDOOR[1], F2, BDOOR[2]); bseg(BDOOR[0], BDOOR[1], BDOOR[3], E); bseg(BDOOR[1], X1, F2, E);
  }
  // north wall with two ground windows + one upper window: build as solid with window cut-outs via panels
  const sideWall = (x, sgn) => {
    // sgn: -1 north (outer face at X0), +1 south
    const xc = x - sgn * WT / 2;
    const openings = sgn < 0 ? [[-9.2, -7.6, FY + 0.8, FY + 2.35], [-6.6, -5.0, FY + 0.8, FY + 2.35], [-9.0, -7.4, 4.1, 5.5]] : [[-9.0, -7.6, 4.2, 5.4]];
    // simple approach: vertical strips between openings + lintels/sills
    const zs = [ZB];
    const segs = [];
    // ground floor band [FY, F2] and upper band [F2, E] separately
    for (const [y0, y1] of [[FY, F2], [F2, E]]) {
      const ops = openings.filter(o => o[2] >= y0 && o[3] <= y1).sort((a, b) => a[0] - b[0]);
      let z = ZB;
      for (const o of ops) {
        if (o[0] > z) segs.push([z, o[0], y0, y1]);
        segs.push([o[0], o[1], y0, o[2]]); segs.push([o[0], o[1], o[3], y1]);
        z = o[1];
      }
      if (z < ZF) segs.push([z, ZF, y0, y1]);
    }
    for (const [a, b, y0, y1] of segs) if (b - a > 0.001 && y1 - y0 > 0.001) S.ubox(WT, y1 - y0, b - a, mPl, [xc, (y0 + y1) / 2, (a + b) / 2], null, 2.5);
    void zs;
    return openings;
  };
  const nOpen = sideWall(X0, -1);
  sideWall(X1, 1);
  // front wall (ground floor): piers + door + small window + big window
  const fz = ZF - WT / 2;
  const BW0 = -1.9, BW1 = 4.9, BWY0 = FY + 0.55, BWY1 = FY + 2.45; // big window
  const SW0 = -4.85, SW1 = -3.85, SWY0 = FY + 0.95, SWY1 = FY + 2.35;  // small window
  const D0 = -3.55, D1 = -2.6, DH = FY + 2.25;                         // door
  const TR1 = FY + 2.95;                                                // transom top
  const seg = (x0, x1, y0, y1, m = mPl) => S.ubox(x1 - x0, y1 - y0, WT, m, [(x0 + x1) / 2, (y0 + y1) / 2, fz], null, 2.5);
  seg(X0, SW0, FY, F2); seg(SW1, D0, FY, F2); seg(D1, BW0, FY, F2); seg(BW1, X1, FY, F2);
  seg(SW0, SW1, FY, SWY0); seg(SW0, SW1, SWY1, F2);
  seg(D0, D1, TR1, F2);
  seg(BW0, BW1, TR1, F2);
  // brick wainscot under the big window (outer skin)
  S.ubox(BW1 - BW0, BWY0 - FY - 0.05, WT + 0.02, M.brick(), [(BW0 + BW1) / 2, (FY + BWY0 - 0.05) / 2, fz], null, 1);
  // upper floor front wall with three windows
  const up = [[-4.2, -2.6], [-0.8, 0.8], [2.6, 4.2]], UY0 = 4.2, UY1 = 5.5;
  { let x = X0; for (const [a, b] of up) { seg(x, a, F2, E); seg(a, b, F2, UY0); seg(a, b, UY1, E); x = b; } seg(x, X1, F2, E); }
  // belt course, corner boards, plinth cap
  const mTrim = M.wood('#5e4636');
  k.box(X1 - X0 + 0.1, 0.16, 0.08, mTrim, [0, F2 + 0.02, ZF + 0.02]);
  k.box(0.08, 0.16, ZF - ZB + 0.1, mTrim, [X0 - 0.02, F2 + 0.02, (ZB + ZF) / 2]);
  k.box(0.08, 0.16, ZF - ZB + 0.1, mTrim, [X1 + 0.02, F2 + 0.02, (ZB + ZF) / 2]);
  for (const [x, z] of [[X0, ZF], [X1, ZF], [X0, ZB], [X1, ZB]]) k.box(0.14, E - FY, 0.14, mTrim, [x + (x < 0 ? 0.04 : -0.04), (FY + E) / 2, z + (z > -8 ? -0.04 : 0.04)]);

  // ---------------- glazing & frames (front)
  const fw = (x0, x1, y0, y1, o = {}) => P.window(S, (x0 + x1) / 2, y0, ZF - 0.08, x1 - x0, y1 - y0, { frameMat: mWood, fd: 0.12, ft: 0.07, glass, ...o });
  fw(BW0, BW1, BWY0, BWY1, { cols: 3, sill: true, sillD: 0.2 });
  // transom lights above the big window + door
  fw(BW0, BW1, BWY1 + 0.08, TR1 - 0.02, { cols: 6, sill: false, ft: 0.05 });
  fw(SW0, SW1, SWY0, SWY1, { cols: 1, rows: 2 });
  fw(D0, D1, DH + 0.08, TR1 - 0.02, { cols: 1, sill: false, ft: 0.05 });
  // door frame + open door (swung inward, hinged at D0)
  k.box(0.08, DH - FY, 0.14, mWood, [D0 - 0.04, (FY + DH) / 2, fz]);
  k.box(0.08, DH - FY, 0.14, mWood, [D1 + 0.04, (FY + DH) / 2, fz]);
  k.box(D1 - D0 + 0.16, 0.08, 0.14, mWood, [(D0 + D1) / 2, DH + 0.04, fz]);
  {
    const dg = S.k.group([D0 + 0.02, FY, ZF - WT + 0.02], 1.45); const kd = ctx.kit(dg); // swung inward
    const dw = D1 - D0 - 0.04;
    kd.box(dw, DH - FY - 0.02, 0.05, M.wood('#6b4a37'), [dw / 2, (DH - FY) / 2, -0.03]);
    kd.plane(dw - 0.24, 1.1, M.glass({ opacity: 0.3 }), [dw / 2, 1.35, 0.0]).castShadow = false;
    kd.box(0.03, 0.03, 0.12, M.t('#c8a04a'), [dw - 0.1, 1.0, 0.0]);
    const rOpen = A.lit.region(120, 64, (g, w, h) => { g.fillStyle = '#f4ecd8'; U.rr(g, 2, 2, w - 4, h - 4, 10); g.fill(); g.strokeStyle = WOOD; g.lineWidth = 3; U.rr(g, 4, 4, w - 8, h - 8, 8); g.stroke(); U.text(g, 'OPEN', w / 2, 26, 26, F.serif, BURG, { weight: 700 }); U.text(g, '営業中', w / 2, 50, 15, F.sans, WOOD, { weight: 700 }); });
    S.card(rOpen, 0.3, 0.16, [dw / 2, 1.62, 0.03], null, null, kd);
  }
  // door mat + threshold
  k.box(D1 - D0, 0.03, 0.3, M.concrete('#b4b0a6'), [(D0 + D1) / 2, FY - 0.0, ZF - 0.08]);

  // ---------------- upper floor windows (flat above the café) + north windows
  const rLace = A.lit.region(128, 128, (g, w, h) => {
    g.fillStyle = '#6d6478'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#f2ece0'; g.fillRect(0, 0, w * 0.32, h); g.fillRect(w * 0.68, 0, w * 0.32, h);
    g.fillStyle = 'rgba(180,160,150,0.35)'; for (let x = 6; x < w * 0.32; x += 9) g.fillRect(x, 0, 2, h); for (let x = w * 0.68 + 5; x < w; x += 9) g.fillRect(x, 0, 2, h);
    g.fillStyle = 'rgba(255,240,215,0.55)'; g.fillRect(w * 0.32, 0, w * 0.36, h * 0.45);
    g.fillStyle = 'rgba(250,245,235,0.5)'; g.fillRect(0, 0, w, 10);
  });
  const rBlind = A.lit.region(128, 128, (g, w, h) => { g.fillStyle = '#e9e2d2'; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(120,100,90,0.25)'; for (let y = 0; y < h * 0.62; y += 6) g.fillRect(0, y, w, 2); g.fillStyle = '#6d6478'; g.fillRect(0, h * 0.62, w, h * 0.38); g.fillStyle = 'rgba(255,238,210,0.5)'; g.fillRect(w * 0.1, h * 0.7, w * 0.3, h * 0.3); });
  up.forEach(([a, b], i) => fw(a, b, UY0, UY1, { cols: 2, back: i === 1 ? rBlind : rLace, backZ: 0.14, sillD: 0.1 }));
  // french balcony railing on the middle upper window + flower boxes on the others
  {
    const mIron = M.t('#3f3d45');
    k.box(1.8, 0.03, 0.03, mIron, [0, UY0 + 0.72, ZF + 0.22]);
    k.box(1.8, 0.03, 0.03, mIron, [0, UY0 + 0.08, ZF + 0.22]);
    for (let i = 0; i <= 12; i++) k.box(0.015, 0.66, 0.015, mIron, [-0.9 + i * 0.15, UY0 + 0.4, ZF + 0.22]);
    for (const x of [-0.9, 0.9]) k.box(0.03, 0.03, 0.26, mIron, [x, UY0 + 0.72, ZF + 0.1]);
    for (const [a, b] of [up[0], up[2]]) {
      const cx = (a + b) / 2;
      S.uboxB(b - a, 0.2, 0.24, mWoodL, [cx, UY0 - 0.28, ZF + 0.14], null, 1);
      P.pot(S, cx - 0.45, UY0 - 0.1, ZF + 0.14, { r: 0.1, h: 0.02, color: '#8a6446', plant: 'flowers', flowers: ['#f2b5c8', '#fbe9ef', '#f7d3de'] });
      P.pot(S, cx, UY0 - 0.1, ZF + 0.14, { r: 0.1, h: 0.02, color: '#8a6446', plant: 'flowers', flowers: ['#f1e3b0', '#fbe9ef'] });
      P.pot(S, cx + 0.45, UY0 - 0.1, ZF + 0.14, { r: 0.1, h: 0.02, color: '#8a6446', plant: 'flowers', flowers: ['#d9718f', '#f2b5c8'] });
    }
  }
  // north (plaza side) windows
  nOpen.forEach(([a, b, y0, y1], i) => {
    P.window(S, X0 + 0.09, y0, (a + b) / 2, b - a, y1 - y0, { rotY: -Math.PI / 2, frameMat: mWood, fd: 0.12, ft: 0.07, glass, cols: 2, rows: i < 2 ? 1 : 1, back: i === 2 ? rLace : null, backZ: 0.14, sillD: 0.1 });
  });
  // flower boxes under the north ground windows
  for (const [a, b] of [nOpen[0], nOpen[1]]) {
    const cz = (a + b) / 2;
    S.uboxB(0.24, 0.2, b - a, mWoodL, [X0 - 0.14, FY + 0.55, cz], null, 1);
    for (let i = 0; i < 4; i++) P.pot(S, X0 - 0.14, FY + 0.75, cz - 0.55 + i * 0.37, { r: 0.09, h: 0.02, color: '#8a6446', plant: 'flowers', flowers: [['#f2b5c8', '#fbe9ef'], ['#f1e3b0', '#e9a23b'], ['#c9b8e8', '#fbe9ef'], ['#d9718f', '#f7d3de']][i] });
  }
  // shrubs in the plaza-side strip
  for (let i = 0; i < 6; i++) { const z = ZB + 0.9 + i * 1.5; C.shrub(S, -5.7, S.gy(-5.7, z) - 0.02, z, { r: 0.3, h: 0.6, sz: 1.7, seed: 60 + i, kind: i % 2 ? 'azalea' : 'boxwood' }); }

  // ---------------- roof (gable, ridge parallel to the street) + gables + gutters
  {
    const pitch = 0.36, ov = 0.5, ovG = 0.4;
    const midZ = (ZB + ZF) / 2, half = (ZF - ZB) / 2 + ov;
    const rise = half * pitch, ridgeY = E + ((ZF - ZB) / 2) * pitch;
    const eaveY = E - ov * pitch;
    const len = Math.hypot(half, rise), ang = Math.atan(pitch);
    const mRoof = M.roofTile('#6d5a50', {});
    const RL = X1 - X0 + ovG * 2;
    for (const s of [1, -1]) {
      const zc = midZ + s * half / 2, yc = (ridgeY + eaveY) / 2;
      const nrm = [0, Math.cos(ang), s * Math.sin(ang)];
      S.ubox(RL, 0.12, len, mRoof, [0, yc + nrm[1] * 0.06, zc + nrm[2] * 0.06], [s * ang, 0, 0], 1.2);
      // fascia board + gutter along the eave
      const ez = midZ + s * half;
      k.box(RL, 0.16, 0.05, mWood, [0, eaveY - 0.02, ez + s * 0.02]);
      k.cyl(0.07, 0.07, RL, M.t('#8a7d70'), [0, eaveY - 0.1, ez + s * 0.1], [0, 0, Math.PI / 2], 8);
    }
    k.box(RL, 0.14, 0.2, M.t('#5c4c44'), [0, ridgeY + 0.12, midZ]);
    // gable triangles (plaster) + barge boards
    for (const x of [X0 + WT / 2, X1 - WT / 2]) {
      const tri = C.profileX([[ZB - midZ, 0], [ZF - midZ, 0], [0, ridgeY - E]], WT);
      k.mesh(tri, mPl, [x, E, midZ]);
    }
    for (const x of [X0 - ovG + 0.03, X1 + ovG - 0.03]) for (const s of [1, -1]) {
      const zc = midZ + s * half / 2, yc = (ridgeY + eaveY) / 2;
      k.box(0.06, 0.22, len + 0.04, mWood, [x, yc - 0.02, zc], [s * ang, 0, 0]);
    }
    // half-timber accents + round vent window on the plaza gable
    const gx = X0 - 0.02;
    k.box(0.06, 0.1, ZF - ZB, mTrim, [gx, E + 0.05, midZ]);
    k.box(0.06, ridgeY - E - 0.25, 0.1, mTrim, [gx, E + (ridgeY - E - 0.25) / 2, midZ]);
    for (const s of [1, -1]) k.box(0.06, 0.1, 2.4, mTrim, [gx, E + 0.62, midZ + s * 1.95], [-s * 0.34, 0, 0]);
    k.cyl(0.36, 0.36, 0.08, mWood, [gx - 0.01, E + 0.95, midZ], [0, 0, Math.PI / 2], 18);
    k.cyl(0.29, 0.29, 0.09, M.glass({ opacity: 0.5 }), [gx - 0.015, E + 0.95, midZ], [0, 0, Math.PI / 2], 18).castShadow = false;
    k.box(0.1, 0.58, 0.04, mWood, [gx - 0.03, E + 0.95, midZ]);
    k.box(0.1, 0.04, 0.58, mWood, [gx - 0.03, E + 0.95, midZ]);
    // downpipes
    P.downpipe(S, X0 + 0.1, ZF + ov + 0.1, eaveY - 0.1, M.t('#8a7d70'), [0, -1]);
    P.downpipe(S, X1 - 0.1, ZB - ov - 0.1, eaveY - 0.1, M.t('#8a7d70'), [0, 1]);
    // small chimney flue for the roaster
    k.box(0.35, 1.2, 0.35, M.wall('#c9b79a'), [3.2, ridgeY - 0.6, midZ - 2.4]);
    k.box(0.45, 0.08, 0.45, M.t('#6d5a50'), [3.2, ridgeY + 0.02, midZ - 2.4]);
  }

  // ---------------- awning + signs
  P.awning(S, {
    x0: -3.9, x1: 5.05, zWall: ZF, yTop: 3.25, depth: 1.6, drop: 0.55,
    stripe: [MOSS, OFFW], n: 4, valance: BURG, valH: 0.26, scallopW: 0.2,
    valReg: A.lit.region(900, 32, (g, w, h) => { g.fillStyle = BURG; g.fillRect(0, 0, w, h); U.text(g, 'Café Haruiro  ·  喫茶 はるいろ  ·  COFFEE & SWEETS  ·  since 1987', w / 2, h / 2 + 1, 19, F.serif, '#f4ecd8', { weight: 700, maxW: w - 20 }); }, { bg: BURG }),
  });
  // main wooden board sign above the awning
  {
    const rBoard = A.lit.region(512, 96, (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#5e4636'); gr.addColorStop(1, '#4b3729'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
      g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 1; for (let y = 8; y < h; y += 11) { g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(w * 0.3, y + 3, w * 0.6, y - 3, w, y + 1); g.stroke(); }
      g.strokeStyle = '#c8a04a'; g.lineWidth = 3; g.strokeRect(7, 7, w - 14, h - 14);
      U.text(g, '喫茶 はるいろ', w * 0.47, h * 0.46, 52, F.serif, '#f4ecd8', { weight: 700 });
      U.text(g, 'Café Haruiro', w * 0.47, h * 0.82, 16, F.serif, '#e7c98a', { weight: 700 });
      U.sakura(g, w * 0.1, h * 0.5, 18, '#f2b5c8', '#f6e3a0'); U.sakura(g, w * 0.88, h * 0.5, 14, '#f2b5c8', '#f6e3a0');
    });
    k.box(3.2, 0.62, 0.06, mWood, [0.6, 3.72, ZF + 0.04]);
    S.card(rBoard, 3.1, 0.56, [0.6, 3.72, ZF + 0.075]);
    for (const x of [-0.8, 2.0]) { k.cyl(0.015, 0.015, 0.14, M.t('#3f3d45'), [x, 4.1, ZF + 0.12], null, 5); k.cyl(0.05, 0.08, 0.06, M.t('#3f3d45'), [x, 4.15, ZF + 0.2], [Math.PI / 2, 0, 0], 8); k.sphere(0.03, M.glow('#ffe2b0', 1.1), [x, 4.13, ZF + 0.23], 6); }
  }
  // projecting bracket sign (visible down the street) at the south end of the facade
  {
    const rOval = A.lit.region(200, 200, (g, w, h) => {
      g.fillStyle = OFFW; g.beginPath(); g.ellipse(w / 2, h / 2, w / 2 - 4, h / 2 - 4, 0, 0, 6.3); g.fill();
      g.strokeStyle = MOSS; g.lineWidth = 8; g.beginPath(); g.ellipse(w / 2, h / 2, w / 2 - 10, h / 2 - 10, 0, 0, 6.3); g.stroke();
      // cup
      g.fillStyle = BURG; g.beginPath(); g.moveTo(62, 70); g.lineTo(128, 70); g.lineTo(120, 118); g.quadraticCurveTo(95, 128, 70, 118); g.closePath(); g.fill();
      g.strokeStyle = BURG; g.lineWidth = 7; g.beginPath(); g.arc(132, 88, 13, -1.4, 1.4); g.stroke();
      g.fillStyle = BURG; g.fillRect(52, 124, 90, 7);
      g.strokeStyle = 'rgba(140,100,80,0.8)'; g.lineWidth = 4; for (const x of [80, 96, 112]) { g.beginPath(); g.moveTo(x, 62); g.bezierCurveTo(x - 8, 50, x + 8, 44, x, 32); g.stroke(); }
      U.text(g, '喫茶 はるいろ', w / 2, 156, 25, F.serif, WOOD, { weight: 700 });
      U.sakura(g, 146, 46, 12, '#f2b5c8', '#f6e3a0');
    });
    const sx = 5.15, sy = 3.95;
    k.box(0.05, 0.05, 1.05, M.t('#3f3d45'), [sx, sy + 0.42, ZF + 0.5]);
    k.box(0.04, 0.55, 0.04, M.t('#3f3d45'), [sx, sy + 0.18, ZF + 0.05]);
    k.mesh(new THREE.TorusGeometry(0.1, 0.012, 4, 10, Math.PI), M.t('#3f3d45'), [sx, sy + 0.32, ZF + 0.18], [0, Math.PI / 2, 0]);
    k.cyl(0.36, 0.36, 0.04, M.wood(WOOD), [sx, sy, ZF + 0.58], [0, 0, Math.PI / 2], 24);
    S.card(rOval, 0.66, 0.66, [sx + 0.022, sy, ZF + 0.58], [0, Math.PI / 2, 0]);
    S.card(rOval, 0.66, 0.66, [sx - 0.022, sy, ZF + 0.58], [0, -Math.PI / 2, 0]);
    for (const dz of [0.33, 0.83]) ctx.wires.add([S.world(sx, sy + 0.42, ZF + dz), S.world(sx, sy + 0.34, ZF + dz)], { width: 0.008, color: '#3f3d45' });
  }
  // wall lamp + plaza-side painted sign
  {
    const rSide = A.lit.region(256, 128, (g, w, h) => {
      g.fillStyle = OFFW; U.rr(g, 2, 2, w - 4, h - 4, 18); g.fill(); g.strokeStyle = MOSS; g.lineWidth = 5; U.rr(g, 8, 8, w - 16, h - 16, 14); g.stroke();
      U.text(g, 'Café Haruiro', w / 2, 46, 34, F.serif, BURG, { weight: 700 });
      U.text(g, 'コーヒーと季節のお菓子', w / 2, 86, 19, F.sans, WOOD, { weight: 700 });
    });
    k.box(0.05, 0.64, 1.28, mWood, [X0 - 0.03, FY + 1.6, -7.1]);
    // an old, sun-faded summer festival poster still taped to the plaza-side wall
    const rFest = A.lit.region(200, 280, (g, w, h) => {
      g.fillStyle = '#efe6d6'; g.fillRect(0, 0, w, h);
      const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#a9c3d9'); gr.addColorStop(1, '#e9d8c4'); g.fillStyle = gr; g.fillRect(8, 8, w - 16, h - 60);
      for (const [x, y, r, c] of [[60, 70, 30, '#e7b4b8'], [140, 56, 22, '#e9d19a'], [110, 110, 36, '#d9a6c0']]) { g.strokeStyle = c; g.lineWidth = 3; for (let i = 0; i < 12; i++) { const a = i * 0.5236; g.beginPath(); g.moveTo(x + Math.cos(a) * r * 0.3, y + Math.sin(a) * r * 0.3); g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); g.stroke(); } }
      for (let i = 0; i < 6; i++) { g.fillStyle = '#e3a79a'; g.beginPath(); g.ellipse(28 + i * 29, 176, 10, 13, 0, 0, 6.3); g.fill(); g.fillStyle = '#c9b8a0'; g.fillRect(27 + i * 29, 160, 2, 6); }
      U.text(g, '第38回', w / 2, 140, 18, F.brush, '#8a6a70', { weight: 400 });
      U.text(g, '桜ヶ丘 夏まつり', w / 2, 234, 28, F.brush, '#9a5a60', { weight: 400, maxW: w - 20 });
      U.text(g, '8月12日(土)・13日(日)  盆踊り・屋台・花火', w / 2, 262, 11, F.sans, '#7d7a86', { weight: 700, maxW: w - 16 });
      g.fillStyle = 'rgba(255,250,240,0.35)'; g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(240,235,220,0.8)'; g.fillRect(w - 34, -6, 44, 22); g.fillRect(-8, h - 16, 40, 22);
    });
    S.card(rFest, 0.4, 0.56, [X0 - 0.012, FY + 1.55, -10.7], [0, -Math.PI / 2, 0]);
    S.card(rSide, 1.2, 0.6, [X0 - 0.06, FY + 1.6, -7.1], [0, -Math.PI / 2, 0]);
    for (const [x, z, ry] of [[X0, -4.4, -Math.PI / 2], [D1 + 0.45, ZF, 0]]) {
      const lg = S.k.group([x, FY + 2.15, z], ry); const kl = ctx.kit(lg);
      kl.box(0.1, 0.16, 0.04, M.t('#3f3d45'), [0, 0, 0.02]);
      kl.box(0.02, 0.02, 0.2, M.t('#3f3d45'), [0, 0.05, 0.12]);
      kl.cyl(0.05, 0.08, 0.12, M.t('#3f3d45'), [0, 0.0, 0.22], null, 8);
      kl.sphere(0.045, M.glow('#ffe2b0', 1.2), [0, -0.05, 0.22], 8);
    }
  }

  // ---------------- exterior sill (pots, bottles, menu cards) + planters by the door
  {
    const sy = BWY0 - 0.07 + 0.03, sz = ZF + 0.12;
    const rMenuCard = A.lit.region(96, 128, (g, w, h) => { g.fillStyle = '#fbf6ea'; g.fillRect(0, 0, w, h); g.strokeStyle = BURG; g.lineWidth = 3; g.strokeRect(5, 5, w - 10, h - 10); U.text(g, 'MENU', w / 2, 24, 18, F.serif, BURG, { weight: 700 }); g.fillStyle = WOOD; for (let i = 0; i < 6; i++) { g.fillRect(14, 44 + i * 13, 44, 3); g.fillRect(66, 44 + i * 13, 16, 3); } U.sakura(g, w / 2, 118, 6, '#f2b5c8'); });
    const items = ['pot', 'bottle', 'pot', 'card', 'bottle', 'pot', 'bottle', 'pot', 'card', 'bottle', 'pot'];
    items.forEach((it, i) => {
      const x = BW0 + 0.35 + i * (BW1 - BW0 - 0.7) / (items.length - 1);
      if (it === 'pot') P.pot(S, x, sy, sz, { r: 0.07, h: 0.1, color: rr.pick(['#c7805d', '#d9c9b0', '#8fa6a0']), plant: rr.pick(['bush', 'succulent', 'grass', 'flowers']), flowers: ['#f2b5c8', '#fbe9ef', '#f1e3b0'], n: 5 });
      else if (it === 'bottle') {
        const c = rr.pick(['#7fb3c4', '#8fbf9a', '#c9a060', '#b7c7e6']);
        k.cyl(0.035, 0.035, 0.16, M.t(c, { transparent: true, opacity: 0.75 }), [x, sy + 0.08, sz], null, 8);
        k.cyl(0.013, 0.02, 0.07, M.t(c, { transparent: true, opacity: 0.75 }), [x, sy + 0.195, sz], null, 6);
        k.cyl(0.003, 0.003, 0.18, M.t('#6f9a5a'), [x, sy + 0.28, sz], null, 3);
        C.scatter.add('ball', S, [x, sy + 0.37, sz], [0.025, 0.02, 0.025], rr.pick(['#f2b5c8', '#fbe9ef', '#f7d3de']));
      } else { S.card(rMenuCard, 0.12, 0.16, [x, sy + 0.08, sz], [-0.15, 0, 0]); }
    });
    // big planters flanking the door + an olive tree
    P.pot(S, -4.75, DY, -3.35, { r: 0.26, h: 0.5, color: '#b9a58a', plant: 'tall', th: 1.1, greens: ['#7f9a6a', '#95ad7a', '#6d8a60'] });
    S.cyl(-4.75, -3.35, 0.3, -1, 1.2);
    P.pot(S, -2.2, DY, -3.45, { r: 0.17, h: 0.34, color: '#c7805d', plant: 'flowers', flowers: ['#f2b5c8', '#fbe9ef', '#f1e3b0', '#d9718f'], n: 14 });
    S.cyl(-2.2, -3.45, 0.2, -1, 0.8);
    // umbrella stand by the door
    P.umbrellaStand(S, -4.2, DY, -3.55, 0.1, { color: '#6b4a37', umbrellas: ['#8c3a45'] });
    // menu display case on a post
    k.box(0.05, 1.05, 0.05, mWood, [-1.85, DY + 0.53, -3.55]);
    k.box(0.52, 0.4, 0.1, mWood, [-1.85, DY + 1.25, -3.55]);
    const rMenu = A.lit.region(208, 160, (g, w, h) => {
      g.fillStyle = '#fbf6ea'; g.fillRect(0, 0, w, h);
      U.text(g, 'Drink & Sweets', w / 2, 18, 17, F.serif, BURG, { weight: 700 });
      const lines = [['ブレンドコーヒー', '450'], ['さくらラテ', '550'], ['クリームソーダ', '580'], ['ショートケーキ', '480'], ['小倉トースト', '420'], ['ナポリタン', '780']];
      lines.forEach(([a, b], i) => { U.text(g, a, 16, 44 + i * 19, 14, F.sans, INK, { weight: 700, align: 'left' }); U.text(g, '¥' + b, w - 14, 44 + i * 19, 14, F.sans, INK, { weight: 700, align: 'right' }); });
    });
    S.card(rMenu, 0.46, 0.34, [-1.85, DY + 1.25, -3.495]);
    k.plane(0.48, 0.36, M.glass({ opacity: 0.25 }), [-1.85, DY + 1.25, -3.49]).castShadow = false;
    S.box(-1.85, -3.55, 0.55, 0.14, -1, 1.5);
  }

  // ---------------- outdoor tables + chairs (on the deck)
  const cafeTables = [];
  const mTableTop = M.t('#e8e2d6'), mIron = M.t('#3f4a44');
  for (const [tx, tz, chairs] of [[0.7, -2.35, [[-0.62, 0, Math.PI / 2], [0.62, 0, -Math.PI / 2]]], [3.5, -2.35, [[-0.62, 0, Math.PI / 2], [0.62, 0, -Math.PI / 2], [0.0, 0.66, Math.PI]]]]) {
    const top = P.bistroTable(S, tx, DY, tz, { r: 0.34, topMat: mTableTop, legMat: mIron });
    cafeTables.push({ x: top.x, z: top.z, y: top.y });
    S.cyl(tx, tz, 0.36, -1, 0.8);
    for (const [cx, cz, ry] of chairs) { P.bistroChair(S, tx + cx, DY, tz + cz, ry, { mat: mIron }); S.cyl(tx + cx, tz + cz, 0.2, -1, 0.9); }
    // sugar pot + menu stand + a small vase on each table
    k.cyl(0.03, 0.03, 0.06, M.t('#f4f1e8'), [tx + 0.12, DY + 0.75, tz - 0.08], null, 8);
    k.cyl(0.018, 0.022, 0.1, M.t('#b7c7e6', { transparent: true, opacity: 0.8 }), [tx - 0.1, DY + 0.77, tz + 0.05], null, 6);
    C.scatter.add('ball', S, [tx - 0.1, DY + 0.86, tz + 0.05], [0.03, 0.025, 0.03], '#f2b5c8');
    // a few sakura petals blown onto the table top
    const pr = ctx.rng('cafe.petals' + tx);
    for (let i = 0; i < 9; i++) { const a = pr() * 6.28, d = 0.08 + Math.sqrt(pr()) * 0.24; C.scatter.add('disc', S, [tx + Math.cos(a) * d, DY + 0.7215, tz + Math.sin(a) * d], [0.012, 0.002, 0.009], pr.pick(['#f2b5c8', '#eb9db6', '#f7c3d3']), [0, pr() * 6.28, 0]); }
  }
  // petals caught on the deck boards (drifted against the wall and the step)
  {
    const pr = ctx.rng('cafe.deckpetals');
    for (let i = 0; i < 46; i++) {
      const edge = pr() < 0.6;
      const x = -5.1 + pr() * 10.2, z = edge ? ZF + 0.05 + pr() * 0.35 : -3.7 + pr() * 2.6;
      C.scatter.add('disc', S, [x, DY + 0.0015, z], [0.011, 0.002, 0.008], pr.pick(['#f7d3de', '#fbe9ef', '#f2b5c8', '#eb9db6']), [0, pr() * 6.28, 0]);
    }
  }

  // ---------------- chalkboard A-frame exactly at SPOTS.cafeBoard (on the sidewalk)
  {
    const sp = S.toL(ctx.L.SPOTS.cafeBoard.x, ctx.L.SPOTS.cafeBoard.z);
    const chalk = (front) => A.lit.region(256, 384, (g, w, h) => {
      g.fillStyle = '#34403b'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 30; i++) C.blot(g, w, h, (i * 83) % w, (i * 131) % h, 30, '255,255,255', 0.03);
      const chalkT = (s, x, y, size, c, o = {}) => U.text(g, s, x, y, size, F.hand, c, { weight: 400, ...o });
      if (front) {
        chalkT('喫茶 はるいろ', w / 2, 36, 28, '#f4efe4');
        g.strokeStyle = 'rgba(244,239,228,0.7)'; g.lineWidth = 2; g.beginPath(); g.moveTo(30, 58); g.lineTo(w - 30, 58); g.stroke();
        chalkT('〜 春限定 〜', w / 2, 88, 26, '#f7c3d3');
        U.sakura(g, 40, 88, 12, 'rgba(247,195,211,0.9)'); U.sakura(g, w - 40, 88, 12, 'rgba(247,195,211,0.9)');
        chalkT('さくらラテ', 22, 134, 24, '#f4efe4', { align: 'left' }); chalkT('¥550', w - 18, 134, 24, '#f6e3a0', { align: 'right' });
        chalkT('いちごのショートケーキ', 22, 186, 19, '#f4efe4', { align: 'left', maxW: 170 }); chalkT('¥480', w - 18, 186, 24, '#f6e3a0', { align: 'right' });
        chalkT('小倉トースト', 22, 238, 24, '#f4efe4', { align: 'left' }); chalkT('¥420', w - 18, 238, 24, '#f6e3a0', { align: 'right' });
        // doodles: latte cup, strawberry shortcake
        g.strokeStyle = '#f4efe4'; g.lineWidth = 3; g.beginPath(); g.moveTo(50, 290); g.lineTo(98, 290); g.lineTo(92, 336); g.lineTo(56, 336); g.closePath(); g.stroke();
        g.beginPath(); g.arc(102, 308, 9, -1.4, 1.4); g.stroke();
        U.sakura(g, 74, 300, 9, '#f7c3d3');
        g.beginPath(); g.moveTo(150, 336); g.lineTo(220, 336); g.lineTo(220, 306); g.lineTo(150, 318); g.closePath(); g.stroke();
        g.fillStyle = '#e8506a'; g.beginPath(); g.arc(200, 300, 9, 0, 6.3); g.fill();
        chalkT('本日のおすすめ ♪', w / 2, 366, 18, '#bfe3d4');
      } else {
        chalkT('Today\'s Coffee', w / 2, 38, 26, '#f4efe4');
        chalkT('ブレンド', 22, 96, 24, '#f4efe4', { align: 'left' }); chalkT('¥450', w - 18, 96, 24, '#f6e3a0', { align: 'right' });
        chalkT('自家製プリン', 22, 148, 24, '#f4efe4', { align: 'left' }); chalkT('¥380', w - 18, 148, 24, '#f6e3a0', { align: 'right' });
        chalkT('クリームソーダ', 22, 200, 22, '#f4efe4', { align: 'left' }); chalkT('¥580', w - 18, 200, 24, '#f6e3a0', { align: 'right' });
        chalkT('OPEN 10:00 – 18:00', w / 2, 270, 20, '#bfe3d4');
        chalkT('定休日 水曜日', w / 2, 302, 20, '#bfe3d4');
        for (let i = 0; i < 5; i++) U.sakura(g, 40 + i * 44, 350, 10, 'rgba(247,195,211,0.9)');
      }
    });
    const rot = Math.PI / 2 - 0.4; // front faces south (toward the hero view), angled to the street
    P.aFrame(S, sp.x, S.gy(sp.x, sp.z), sp.z, rot, chalk(true), chalk(false), { w: 0.56, h: 0.9 });
    const bw = S.toW(sp.x, sp.z);
    ctx.physics.addBox(bw.x, bw.z, 0.6, 0.5, S.f.rotY + rot, S.f.y - 1, S.f.y + 1.0);
  }

  // ---------------- interior
  const IX0 = X0 + WT, IX1 = X1 - WT, IZ0 = ZB + WT, IZ1 = ZF - WT;
  const mFloor = M.innerMap('#a67c58', T.planks, 0.22);
  { const fl = k.mesh(C.uvPlane(IX1 - IX0, IZ1 - IZ0, 1.6), mFloor, [(IX0 + IX1) / 2, FY + 0.004, (IZ0 + IZ1) / 2], [-Math.PI / 2, 0, 0]); fl.castShadow = false; }
  k.plane(IX1 - IX0, IZ1 - IZ0, M.inner('#efe3c8', 0.3), [(IX0 + IX1) / 2, C1, (IZ0 + IZ1) / 2], [Math.PI / 2, 0, 0]);
  for (let x = IX0 + 0.9; x < IX1; x += 1.8) k.box(0.14, 0.16, IZ1 - IZ0, mInWood, [x, C1 - 0.08, (IZ0 + IZ1) / 2]);
  // inner wall skins (+ dark wood wainscot)
  const inWall = (w, pos, ry) => { k.plane(w, C1 - FY, mIn, [pos[0], (FY + C1) / 2, pos[2]], [0, ry, 0]); k.plane(w, 0.95, mInWood, [pos[0] + Math.sin(ry) * 0.004, FY + 0.475, pos[2] + Math.cos(ry) * 0.004], [0, ry, 0]); };
  inWall(IX1 - IX0, [(IX0 + IX1) / 2, 0, IZ0 + 0.005], 0);
  inWall(IZ1 - IZ0, [IX1 - 0.005, 0, (IZ0 + IZ1) / 2], -Math.PI / 2);
  // north inner wall: skip window openings by using short panels between them
  for (const [a, b] of [[IZ0, -9.2], [-7.6, -6.6], [-5.0, IZ1]]) inWall(b - a, [IX0 + 0.005, 0, (a + b) / 2], Math.PI / 2);
  for (const [a, b] of [[-9.2, -7.6], [-6.6, -5.0]]) { k.plane(b - a, 0.95 - 0.47, mInWood, [IX0 + 0.005, FY + 0.47 + (0.95 - 0.47) / 2, (a + b) / 2], [0, Math.PI / 2, 0]); k.plane(b - a, FY + 0.8 - FY - 0.95 > 0 ? 0 : 0.01, mIn, [IX0 + 0.005, FY + 1, (a + b) / 2], [0, Math.PI / 2, 0]); k.plane(b - a, C1 - (FY + 2.35), mIn, [IX0 + 0.005, (FY + 2.35 + C1) / 2, (a + b) / 2], [0, Math.PI / 2, 0]); }
  // front inner wall pieces above windows
  k.plane(IX1 - IX0, C1 - TR1, mIn, [(IX0 + IX1) / 2, (TR1 + C1) / 2, IZ1 - 0.005], [0, Math.PI, 0]);
  k.plane(BW1 - BW0, BWY0 - FY, mInWood, [(BW0 + BW1) / 2, (FY + BWY0) / 2, IZ1 - 0.005], [0, Math.PI, 0]);

  buildCafeInterior(ctx, C, S, { FY, C1, IX0, IX1, IZ0, IZ1 });
  // café lighting spill onto the deck (soft warm patches)
  const cafeWindow = (() => { const p = S.toW((BW0 + BW1) / 2, ZF - 0.08); return { x: p.x, y: S.f.y + (BWY0 + BWY1) / 2, z: p.z, rotY: S.f.rotY, w: BW1 - BW0, h: BWY1 - BWY0 }; })();

  // ---------------- back + side services
  {
    const rBack = A.lit.region(96, 32, (g, w, h) => { g.fillStyle = '#fbf8f0'; g.fillRect(0, 0, w, h); U.text(g, '勝手口', w / 2, h / 2 + 1, 16, F.sans, INK, { weight: 700 }); });
    const bst = FY - 0.16, bsb = S.gy(1.6, -13.1) - 0.2;
    S.ubox(1.2, bst - bsb, 0.5, M.concrete('#c4c2bb'), [1.6, (bst + bsb) / 2, ZB - 0.25], null, 2);
    S.walk(1.6, ZB - 0.25, 1.2, 0.5, bst);
    P.backDoor(S, 1.6, FY, ZB, Math.PI, '#7d6a58', { label: rBack });
    P.propane(S, -1.2, S.gy(-1.2, -13.1), ZB - 0.22, Math.PI);
    S.box(-1.2, ZB - 0.22, 0.8, 0.4, -1, 1.3);
    P.gasMeter(S, -0.3, 1.25, ZB, Math.PI);
    P.meter(S, 3.4, 1.7, ZB, Math.PI);
    for (const x of [-3.6, -2.5]) { P.acUnit(S, x, S.gy(x, -13.1), ZB - 0.25, Math.PI, { ductH: 2.2 }); S.box(x, ZB - 0.25, 0.9, 0.36, -1, 0.8); }
    // milk-bottle crates + beer-style crates + trash bins
    const y0 = S.gy(3.2, -13.4);
    for (let i = 0; i < 3; i++) P.crate(S, 3.0, y0 + i * 0.3, -13.35, 0.06 * i, i === 2 ? '#e9c34b' : '#4f8fc0', { bottles: i === 2 ? '#f4f1e8' : null });
    P.crate(S, 3.6, S.gy(3.6, -13.4), -13.45, -0.2, '#6aa87a');
    for (const [x, c] of [[4.4, '#6f8a7c'], [4.95, '#8c9aa6']]) { k.cyl(0.24, 0.22, 0.7, M.t(c), [x, S.gy(x, -13.3) + 0.35, -13.3], null, 12); k.cyl(0.26, 0.26, 0.06, M.t(c), [x, S.gy(x, -13.3) + 0.72, -13.3], null, 12); }
    S.box(3.9, -13.35, 2.6, 0.7, -1, 1.0);
    P.carton(S, 2.3, S.gy(2.3, -13.5), -13.5, 0.5, 0.35, 0.4, 0.2);
    P.carton(S, 2.35, S.gy(2.3, -13.5) + 0.35, -13.5, 0.4, 0.25, 0.32, -0.1, '#d4b286');
    // flat upstairs: back window + balcony door, small steel balcony with a laundry pole and washing
    P.window(S, (BWIN[0] + BWIN[1]) / 2, BWIN[2], ZB + 0.08, BWIN[1] - BWIN[0], BWIN[3] - BWIN[2], { rotY: Math.PI, frameMat: mWood, fd: 0.12, ft: 0.07, glass, cols: 2, back: rLace, backZ: 0.14, sillD: 0.1 });
    P.window(S, (BDOOR[0] + BDOOR[1]) / 2, BDOOR[2], ZB + 0.08, BDOOR[1] - BDOOR[0], BDOOR[3] - BDOOR[2], { rotY: Math.PI, frameMat: mWood, fd: 0.12, ft: 0.07, glass, cols: 2, back: rBlind, backZ: 0.14, sill: false });
    {
      const bx0 = 1.0, bx1 = 3.2, bd = 0.85, by = F2 + 0.06, cxb = (bx0 + bx1) / 2, zb0 = ZB - bd;
      const mSteel = M.t('#6d747c'), mSteelL = M.t('#b9bcc0');
      k.box(bx1 - bx0, 0.1, bd, M.concrete('#c4c2bb'), [cxb, by, ZB - bd / 2]);
      k.box(bx1 - bx0, 0.05, 0.05, mSteel, [cxb, by + 1.0, zb0 + 0.02]);
      for (const x of [bx0 + 0.02, bx1 - 0.02]) k.box(0.05, 0.05, bd, mSteel, [x, by + 1.0, ZB - bd / 2]);
      for (let x = bx0 + 0.02; x <= bx1 - 0.01; x += 0.12) k.box(0.02, 0.95, 0.02, mSteel, [x, by + 0.5, zb0 + 0.02]);
      for (const x of [bx0 + 0.02, bx1 - 0.02]) for (let z = zb0 + 0.14; z < ZB; z += 0.12) k.box(0.02, 0.95, 0.02, mSteel, [x, by + 0.5, z]);
      for (const x of [bx0 + 0.2, bx1 - 0.2]) k.box(0.06, 0.5, 0.06, mSteel, [x, by - 0.3, ZB - 0.3], [-0.9, 0, 0]);
      for (const x of [bx0 + 0.1, bx1 - 0.1]) k.box(0.03, 0.5, 0.03, mSteelL, [x, by + 1.25, zb0 + 0.06]);
      k.cyl(0.015, 0.015, bx1 - bx0 - 0.1, mSteelL, [cxb, by + 1.5, zb0 + 0.06], [0, 0, Math.PI / 2], 6);
      let cx2 = bx0 + 0.22;
      for (const [c, w, h] of [['#f4efe4', 0.36, 0.62], ['#bcd6ea', 0.34, 0.55], ['#f7d3de', 0.4, 0.48], ['#e9e2d0', 0.3, 0.7]]) { k.box(w, h, 0.012, M.t(c), [cx2 + w / 2, by + 1.49 - h / 2, zb0 + 0.06], [0.05, 0, 0]); k.box(0.03, 0.05, 0.02, M.t('#e8c547'), [cx2 + 0.05, by + 1.5, zb0 + 0.06]); cx2 += w + 0.12; }
      P.pot(S, bx1 - 0.3, by + 0.05, ZB - 0.3, { r: 0.12, h: 0.2, color: '#c7805d', plant: 'bush' });
    }
    // kitchen: frosted window + ventilation hood (換気扇) over it
    P.window(S, 0.4, 1.45, ZB - 0.03, 0.8, 0.7, { rotY: Math.PI, frameMat: M.t('#b8bdc2'), ft: 0.04, fd: 0.06, glass: M.glass({ frost: true }), sillD: 0.04 });
    k.box(0.34, 0.34, 0.16, M.t('#d9d6ce'), [0.4, 2.62, ZB - 0.08]);
    for (let i = 0; i < 4; i++) k.box(0.3, 0.02, 0.06, M.t('#a9aaa8'), [0.4, 2.5 + i * 0.075, ZB - 0.17], [0.5, 0, 0]);
    // south side: AC unit on bracket (upper floor) + pipes
    P.acUnit(S, X1 + 0.18, 3.9, -10.4, Math.PI / 2, { ductH: 1.2 });
    k.box(0.4, 0.04, 0.9, M.t('#8e9298'), [X1 + 0.2, 3.9, -10.4]);
    P.pipe(S, X1 + 0.06, -11.2, S.gy(X1, -11.2), 5.8, 0.035, M.t('#c9c3b4'));
  }

  // ---------------- physics: shell
  S.box(0, ZB + WT / 2, X1 - X0, WT, -1, E);
  S.box(X0 + WT / 2, (ZB + ZF) / 2, WT, ZF - ZB, -1, E);
  S.box(X1 - WT / 2, (ZB + ZF) / 2, WT, ZF - ZB, -1, E);
  S.box((X0 + D0) / 2, ZF - WT / 2, D0 - X0, WT, -1, E);
  S.box((D1 + X1) / 2, ZF - WT / 2, X1 - D1, WT, -1, E);
  S.box((D0 + D1) / 2, ZF - WT / 2, D1 - D0, WT, DH, E);
  S.walk(0, (ZB + ZF) / 2, X1 - X0, ZF - ZB, FY);
  S.box(D0 + 0.02 + 0.45 * Math.cos(1.45), ZF - WT + 0.02 - 0.45 * Math.sin(1.45), 0.9, 0.08, -1, DH, 1.45); // open door leaf

  // music
  if (ctx.audio && ctx.audio.loop) { try { ctx.audio.loop('cafeMusic', { position: S.world(1.5, 1.6, -7.5), volume: 0.35 }); } catch (e) { /* audio optional */ } }

  return { S, cafeWindow, cafeTables };
}
