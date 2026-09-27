// Station building shell: plinth, two-skin walls with openings, windows, entrance storefront,
// canopy + name board, gable roof (standing seams, gutters, downpipes), entrance cross-gable with
// clock, exterior details, and the forecourt (terrace, 7-riser stairs, switch-back ramp).
import * as THREE from 'three';

export const B = {
  FY: 1.25, CEIL: 4.25, WT: 4.55, X0: -4, X1: 12, Z0: -35.5, Z1: -25,
  RIDGE_Z: -30.25, PITCH: Math.tan(20 * Math.PI / 180), ROOF_T: 0.18, ROOF_BASE: 4.75,
  GX0: 1.0, GX1: 7.0, GPITCH: Math.tan(30 * Math.PI / 180),
};
/** top surface height of the main roof at z */
export const roofTop = (z) => B.ROOF_BASE + (5.25 - Math.abs(z - B.RIDGE_Z)) * B.PITCH;

export function buildBuilding(A) {
  const { ctx, k, U, M, P, root } = A;
  const { FY, WT, X0, X1, Z0, Z1 } = B;
  const r = ctx.rng('station-building');

  // ------------------------------------------------------------------ plinth & floor
  const plinth = k.box(X1 - X0, FY - 0.01 + 0.4, Z1 - Z0, M.plinth, [(X0 + X1) / 2, (FY - 0.01 - 0.4) / 2, (Z0 + Z1) / 2]);
  plinth.name = 'plinth';
  // water-table band on S/E/W faces
  k.box(X1 - X0 + 0.1, 0.1, 0.06, M.band, [(X0 + X1) / 2, FY - 0.02, Z1 + 0.03]);
  k.box(0.06, 0.1, Z1 - Z0 + 0.06, M.band, [X1 + 0.03, FY - 0.02, (Z0 + Z1) / 2 + 0.03]);
  k.box(0.06, 0.1, Z1 - Z0 + 0.06, M.band, [X0 - 0.03, FY - 0.02, (Z0 + Z1) / 2 + 0.03]);
  U.worldUV(k.box(X1 - X0 - 0.3, 0.012, Z1 - Z0 - 0.3, M.floor, [(X0 + X1) / 2, FY - 0.006, (Z0 + Z1) / 2]), 2.4);
  P.addWalkBox((X0 + X1) / 2, (Z0 + Z1) / 2, X1 - X0, Z1 - Z0, 0, FY);

  // ------------------------------------------------------------------ walls (outer skin 0.12 plaster, inner skin 0.08)
  const tO = 0.12, tI = 0.08, y0 = FY - 0.01;
  const S = [ // south facade openings (along x)
    { a0: -3.3, a1: -1.9, y0: 2.2, y1: 3.55 }, { a0: -1.2, a1: 0.2, y0: 2.2, y1: 3.55 },
    { a0: 1.4, a1: 6.6, y0: FY - 0.02, y1: 3.65 },
    { a0: 7.8, a1: 9.4, y0: 2.2, y1: 3.55 }, { a0: 10.0, a1: 11.6, y0: 2.2, y1: 3.55 },
  ];
  const N = [ // north (platform side)
    { a0: -2.9, a1: -0.9, y0: 2.2, y1: 3.5 }, { a0: 1.3, a1: 3.3, y0: 2.2, y1: 3.5 },
    { a0: 3.9, a1: 4.8, y0: FY - 0.02, y1: 3.25 }, { a0: 5.6, a1: 11.6, y0: FY - 0.02, y1: 3.65 },
  ];
  const E = [{ a0: -34.2, a1: -32.6, y0: 2.2, y1: 3.55 }, { a0: -27.6, a1: -26.0, y0: 2.2, y1: 3.55 }];
  const W = [{ a0: -33.6, a1: -32.2, y0: 2.2, y1: 3.55 }, { a0: -28.3, a1: -26.9, y0: 2.2, y1: 3.55 }];
  const pt = 3.0; // plaster tile (m)
  U.wall(k, M.plasterExt, 'x', Z1 - tO, Z1, X0, X1, y0, WT, S, pt);
  U.wall(k, M.plasterInt, 'x', Z1 - tO - tI, Z1 - tO, X0 + tO, X1 - tO, y0, WT - 0.2, S, pt);
  U.wall(k, M.plasterExt, 'x', Z0, Z0 + tO, X0, X1, y0, WT, N, pt);
  U.wall(k, M.plasterInt, 'x', Z0 + tO, Z0 + tO + tI, X0 + tO, X1 - tO, y0, WT - 0.2, N, pt);
  U.wall(k, M.plasterExt, 'z', X1 - tO, X1, Z0, Z1, y0, WT, E, pt);
  U.wall(k, M.plasterInt, 'z', X1 - tO - tI, X1 - tO, Z0 + tO, Z1 - tO, y0, WT - 0.2, E, pt);
  U.wall(k, M.plasterExt, 'z', X0, X0 + tO, Z0, Z1, y0, WT, W, pt);
  U.wall(k, M.plasterInt, 'z', X0 + tO, X0 + tO + tI, Z0 + tO, Z1 - tO, y0, WT - 0.2, W, pt);
  // colliders (door opening on the south, platform opening on the north)
  const wc = (x0, z0, x1, z1) => P.addAABB(x0, z0, x1, z1, -1, 6);
  wc(X0, Z1 - 0.2, 1.4, Z1); wc(6.6, Z1 - 0.2, X1, Z1);
  wc(X0, Z0, 5.6, Z0 + 0.2); wc(11.6, Z0, X1, Z0 + 0.2);
  wc(X1 - 0.2, Z0, X1, Z1); wc(X0, Z0, X0 + 0.2, Z1);
  // storefront side lights block too (only the 2.44 m door gap is open)
  wc(1.4, Z1 - 0.2, 2.78, Z1); wc(5.22, Z1 - 0.2, 6.6, Z1);

  // corner pilasters + header band over the platform opening (north)
  for (const [x, z] of [[X0, Z1], [X1, Z1], [X0, Z0], [X1, Z0]]) k.box(0.3, WT - y0, 0.3, M.band, [x + (x < 4 ? 0.13 : -0.13), (WT + y0) / 2, z + (z > -30 ? -0.13 : 0.13)]);
  k.box(6.2, 0.14, 0.18, M.band, [8.6, 3.72, Z0 - 0.02]);
  k.box(0.22, 3.65 - y0, 0.3, M.band, [5.5, (3.65 + y0) / 2, Z0 + 0.1]);
  k.box(0.22, 3.65 - y0, 0.3, M.band, [11.7, (3.65 + y0) / 2, Z0 + 0.1]);

  // ------------------------------------------------------------------ windows
  function windowUnit(axis, cOut, nOut, a0, a1, wy0, wy1, o = {}) {
    // cOut = coordinate of the outer wall face, nOut = +1/-1 outward normal along the wall's normal axis
    const depth = tO + tI, cMid = cOut - nOut * depth * 0.45;
    const L = a1 - a0, H = wy1 - wy0, am = (a0 + a1) / 2, ym = (wy0 + wy1) / 2;
    const put = (along, y, across, w, h, d, m) => axis === 'x' ? k.box(w, h, d, m, [along, y, across]) : k.box(d, h, w, m, [across, y, along]);
    const fw = 0.06, fd = 0.09;
    put(am, wy1 - fw / 2, cMid, L, fw, fd, M.trim); put(am, wy0 + fw / 2, cMid, L, fw, fd, M.trim);
    put(a0 + fw / 2, ym, cMid, fw, H, fd, M.trim); put(a1 - fw / 2, ym, cMid, fw, H, fd, M.trim);
    const nMull = o.mullions ?? 1;
    for (let i = 1; i <= nMull; i++) put(a0 + L * i / (nMull + 1), ym, cMid + nOut * (i % 2 ? 0.02 : -0.02), 0.045, H - fw, fd * 0.8, M.trim);
    if (o.transom) put(am, wy0 + H * o.transom, cMid, L - fw, 0.04, fd * 0.8, M.trim);
    // glass (two panes of a sliding window sit at slightly different depths)
    const gl = o.frost ? M.frost : M.glass;
    const gm = axis === 'x' ? k.plane(L - fw * 2, H - fw * 2, gl, [am, ym, cMid], [0, 0, 0]) : k.plane(L - fw * 2, H - fw * 2, gl, [cMid, ym, am], [0, Math.PI / 2, 0]);
    gm.castShadow = false;
    // outer sill + small drip hood
    put(am, wy0 - 0.035, cOut + nOut * 0.05, L + 0.16, 0.07, 0.12, M.sill);
    if (!o.noHood) put(am, wy1 + 0.07, cOut + nOut * 0.05, L + 0.2, 0.06, 0.1, M.sill);
    // inner sill + apron, side casings and head casing on the room side
    put(am, wy0 - 0.02, cOut - nOut * (depth + 0.04), L + 0.06, 0.04, 0.1, M.trimInt);
    const ci = cOut - nOut * (depth + 0.009);
    put(am, wy0 - 0.085, ci, L + 0.02, 0.09, 0.018, M.trimInt);
    put(a0 - 0.035, ym + 0.02, ci, 0.07, H + 0.1, 0.018, M.trimInt); put(a1 + 0.035, ym + 0.02, ci, 0.07, H + 0.1, 0.018, M.trimInt);
    put(am, wy1 + 0.04, ci, L + 0.14, 0.08, 0.018, M.trimInt);
    // rain streaks under the sill (outside)
    if (!o.noStreak && r() < 0.8) {
      const h = 0.35 + r() * 0.5, w = L * (0.5 + r() * 0.4);
      const sp = axis === 'x' ? k.plane(w, h, M.streak, [am + (r() - 0.5) * 0.2, wy0 - 0.07 - h / 2, cOut + nOut * 0.006], [0, nOut > 0 ? 0 : Math.PI, 0])
        : k.plane(w, h, M.streak, [cOut + nOut * 0.006, wy0 - 0.07 - h / 2, am], [0, nOut > 0 ? Math.PI / 2 : -Math.PI / 2, 0]);
      sp.receiveShadow = true;
    }
  }
  for (const o of S) if (o.y0 > 2) windowUnit('x', Z1, 1, o.a0, o.a1, o.y0, o.y1, { transom: 0.72 });
  windowUnit('x', Z0, -1, -2.9, -0.9, 2.2, 3.5, { transom: 0.72 });
  windowUnit('x', Z0, -1, 1.3, 3.3, 2.2, 3.5, { transom: 0.72 });
  for (const o of E) windowUnit('z', X1, 1, o.a0, o.a1, o.y0, o.y1, { transom: 0.72 });
  for (const o of W) windowUnit('z', X0, -1, o.a0, o.a1, o.y0, o.y1, { transom: 0.72 });

  // office door on the platform side (steel door, closed) + staff-only plate
  k.box(0.9, 2.0, 0.05, M.aluDark, [4.35, FY + 1.0, Z0 + 0.06]);
  k.box(0.98, 0.05, 0.1, M.trim, [4.35, FY + 2.02, Z0 + 0.03]);
  k.box(0.04, 0.12, 0.05, M.stainless, [4.72, FY + 1.0, Z0 + 0.02]);
  k.box(0.3, 0.3, 0.02, M.frost, [4.35, FY + 1.62, Z0 + 0.03]);
  A.plane('misc', 'staffOnly', 0.42, 0.16, [4.35, FY + 1.25, Z0 + 0.03], Math.PI);

  // ------------------------------------------------------------------ entrance storefront (open automatic doors)
  const zs = Z1 - 0.07;
  const alu = (x, y, w, h, d = 0.08, z = zs) => k.box(w, h, d, M.alu, [x, y, z]);
  alu(1.43, (FY + 3.65) / 2, 0.06, 3.65 - FY); alu(6.57, (FY + 3.65) / 2, 0.06, 3.65 - FY);
  alu(4.0, 3.62, 5.2, 0.06); alu(4.0, 3.4, 5.2, 0.06);
  alu(2.75, (FY + 3.4) / 2, 0.06, 3.4 - FY); alu(5.25, (FY + 3.4) / 2, 0.06, 3.4 - FY);
  alu(2.09, FY + 0.06, 1.3, 0.12); alu(5.91, FY + 0.06, 1.3, 0.12);
  const gp = (x, y, w, h, z = zs) => { const m = k.plane(w, h, M.glass, [x, y, z]); m.castShadow = false; return m; };
  gp(2.09, (FY + 0.12 + 3.37) / 2, 1.28, 3.37 - FY - 0.12); gp(5.91, (FY + 0.12 + 3.37) / 2, 1.28, 3.37 - FY - 0.12);
  gp(4.0, 3.51, 5.1, 0.16);
  // sliding leaves, opened behind the fixed side lights (inside)
  for (const x of [2.12, 5.88]) {
    const zl = zs - 0.09;
    k.box(1.26, 0.05, 0.05, M.alu, [x, 3.33, zl]); k.box(1.26, 0.1, 0.05, M.alu, [x, FY + 0.05, zl]);
    k.box(0.05, 2.1, 0.05, M.alu, [x - 0.6, FY + 1.05, zl]); k.box(0.05, 2.1, 0.05, M.alu, [x + 0.6, FY + 1.05, zl]);
    gp(x, FY + 1.1, 1.16, 1.98, zl);
    A.plane('face', 'autoDoor', 0.3, 0.09, [x + (x < 4 ? 0.3 : -0.3), FY + 1.25, zs + 0.006], 0);
  }
  k.box(0.46, 0.1, 0.12, M.darkPanel, [4.0, 3.3, zs - 0.12]); // door sensor

  // posters beside the entrance (framed, facing the plaza)
  A.board('P', 'sakuraFest', 0.48, 0.68, [0.8, FY + 1.45, Z1 + 0.035], 0, { frame: M.trim, border: 0.03, depth: 0.03 });
  A.board('P', 'festival', 0.48, 0.68, [7.2, FY + 1.45, Z1 + 0.035], 0, { frame: M.trim, border: 0.03, depth: 0.03 });
  // ------------------------------------------------------------------ canopy (庇) + station name board
  const cz0 = Z1, cz1 = -23.25;
  U.worldUV(k.box(6.2, 0.13, cz1 - cz0, M.band, [4.0, 3.815, (cz0 + cz1) / 2]), 2);
  k.box(6.24, 0.2, 0.08, M.fascia, [4.0, 3.8, cz1 + 0.02]);
  k.box(6.24, 0.03, 0.09, M.pinkBand, [4.0, 3.72, cz1 + 0.025]);
  for (const x of [2.0, 4.0, 6.0]) {
    k.cyl(0.09, 0.09, 0.02, M.lampWarm, [x, 3.742, -24.15], null, 16);
  }
  // tie rods to the gable wall
  for (const x of [1.3, 6.7]) U.beam(k, [x, 3.9, cz1 - 0.12], [x, 4.45, Z1 + 0.02], 0.025, 0.025, M.steelDark, true);
  // name board standing on the canopy's front edge (faces the plaza)
  const nbW = 5.7, nbH = 0.9, nbY = 3.88 + 0.03 + nbH / 2;
  k.box(nbW + 0.1, nbH + 0.1, 0.1, M.fascia, [4.0, nbY, cz1 + 0.06]);
  A.plane('face', 'nameBoard', nbW, nbH, [4.0, nbY, cz1 + 0.113], 0);
  for (const x of [1.6, 6.4]) k.box(0.06, 0.12, 0.06, M.fascia, [x, 3.9, cz1 + 0.06]);
  // wall lanterns either side of the entrance
  for (const x of [0.6, 7.35]) {
    k.box(0.06, 0.06, 0.28, M.fascia, [x, 3.28, Z1 + 0.14]);
    k.box(0.2, 0.05, 0.2, M.fascia, [x, 3.42, Z1 + 0.3]);
    k.box(0.16, 0.24, 0.16, M.lampGlow, [x, 3.28, Z1 + 0.3]);
    k.box(0.2, 0.03, 0.2, M.fascia, [x, 3.15, Z1 + 0.3]);
  }

  // ------------------------------------------------------------------ main roof
  const { RIDGE_Z, PITCH, ROOF_T, ROOF_BASE } = B;
  const th = Math.atan(PITCH), cth = Math.cos(th);
  const roofX0 = X0 - 0.45, roofX1 = X1 + 0.45, zS = Z1 + 0.7, zN = Z0 - 1.1;
  function roofSlab(xa, xb, za, zb) { // za = ridge side z, zb = eave side z
    const south = zb > za;
    const zm = (za + zb) / 2, ytop = roofTop(zm), len = Math.abs(zb - za) / cth;
    const g = new THREE.Group(); g.position.set((xa + xb) / 2, ytop, zm); g.rotation.x = south ? th : -th; root.add(g);
    const kk = ctx.kit(g);
    kk.box(xb - xa, ROOF_T, len, M.roof, [0, -ROOF_T / 2, 0]);
    // standing seams
    const n = Math.floor((xb - xa) / 0.46);
    for (let i = 1; i < n; i++) kk.box(0.035, 0.045, len - 0.04, M.roofSeam, [-(xb - xa) / 2 + i * (xb - xa) / n, 0.02, 0]);
    return g;
  }
  roofSlab(roofX0, B.GX0, RIDGE_Z, zS);
  roofSlab(B.GX0, B.GX1, RIDGE_Z, Z1 - 0.12);
  roofSlab(B.GX1, roofX1, RIDGE_Z, zS);
  roofSlab(roofX0, roofX1, RIDGE_Z, zN);
  // ridge cap
  k.box(roofX1 - roofX0 + 0.04, 0.12, 0.34, M.fascia, [(roofX0 + roofX1) / 2, roofTop(RIDGE_Z) + 0.02, RIDGE_Z]);
  // soffits (flat boards under the eaves, from wall to fascia)
  const soff = (xa, xb, za, zb) => k.box(xb - xa, 0.03, Math.abs(zb - za), M.soffit, [(xa + xb) / 2, Math.min(roofTop(za), roofTop(zb)) - ROOF_T - 0.03, (za + zb) / 2]);
  soff(roofX0, B.GX0 - 0.3, Z1, zS - 0.05); soff(B.GX1 + 0.3, roofX1, Z1, zS - 0.05); soff(roofX0, roofX1, zN + 0.05, Z0);
  // fascia boards + gutters along the eaves
  const eave = (xa, xb, z, dir) => {
    const yt = roofTop(z);
    k.box(xb - xa, 0.26, 0.05, M.fascia, [(xa + xb) / 2, yt - 0.1, z + dir * 0.025]);
    k.box(xb - xa, 0.1, 0.13, M.gutter, [(xa + xb) / 2, yt - 0.2, z + dir * 0.11]);
    k.box(xb - xa, 0.02, 0.15, M.gutter, [(xa + xb) / 2, yt - 0.14, z + dir * 0.11]);
  };
  eave(roofX0, B.GX0 - 0.3, zS, 1); eave(B.GX1 + 0.3, roofX1, zS, 1); eave(roofX0, roofX1, zN, -1);
  // barge boards on the E/W gables
  for (const x of [roofX0 - 0.02, roofX1 + 0.02]) for (const [za, zb] of [[RIDGE_Z, zS], [RIDGE_Z, zN]]) {
    const south = zb > za, zm = (za + zb) / 2, len = Math.abs(zb - za) / cth;
    const g = new THREE.Group(); g.position.set(x, roofTop(zm), zm); g.rotation.x = south ? th : -th; root.add(g);
    ctx.kit(g).box(0.06, 0.3, len + 0.05, M.fascia, [0, -0.1, 0]);
  }
  // E/W gable triangles (plaster) + louvre vents
  const triH = roofTop(RIDGE_Z) - ROOF_T - WT;
  for (const [x, rot] of [[X1 - 0.06, -Math.PI / 2], [X0 + 0.06, -Math.PI / 2]]) {
    const pts = [[Z0 + 0.02, 0], [Z1 - 0.02, 0], [RIDGE_Z, triH + 0.02]];
    const m = k.mesh(ctx.geo.extrude(pts, 0.12), M.plasterExt, [x, WT, 0], [0, rot, 0]);
    U.worldUV(m, pt);
    const vx = x + (x > 4 ? 0.07 : -0.07);
    k.box(0.04, 0.5, 0.7, M.trim, [vx, WT + 0.75, RIDGE_Z]);
    for (let i = 0; i < 5; i++) k.box(0.05, 0.03, 0.62, M.sill, [vx + (x > 4 ? 0.01 : -0.01), WT + 0.56 + i * 0.09, RIDGE_Z]);
  }

  // ------------------------------------------------------------------ entrance cross gable + clock
  const { GX0, GX1, GPITCH } = B;
  const gph = Math.atan(GPITCH), cgp = Math.cos(gph);
  const gHalf = (GX1 - GX0) / 2 + 0.3, gRidgeY = ROOF_BASE + (GX1 - GX0) / 2 * GPITCH;
  const gz0 = Z1 + 0.55, gz1 = -29.9; // front overhang .. dies into the main roof
  for (const side of [-1, 1]) {
    const xm = 4.0 + side * gHalf / 2, ym = gRidgeY - gHalf / 2 * GPITCH;
    const g = new THREE.Group(); g.position.set(xm, ym, (gz0 + gz1) / 2); g.rotation.z = side < 0 ? gph : -gph; root.add(g);
    const kk = ctx.kit(g), len = gHalf / cgp;
    kk.box(len, ROOF_T, gz0 - gz1, M.roof, [0, -ROOF_T / 2, 0]);
    const n = Math.floor((gz0 - gz1) / 0.46);
    for (let i = 1; i < n; i++) kk.box(len - 0.04, 0.045, 0.035, M.roofSeam, [0, 0.02, -(gz0 - gz1) / 2 + i * (gz0 - gz1) / n]);
    kk.box(len + 0.04, 0.3, 0.06, M.fascia, [0, -0.1, (gz0 - gz1) / 2 + 0.02]); // barge board
  }
  k.box(0.3, 0.12, gz0 - gz1, M.fascia, [4.0, gRidgeY + 0.02, (gz0 + gz1) / 2]);
  {
    const pts = [[GX0 + 0.02, 0], [GX1 - 0.02, 0], [4.0, gRidgeY - ROOF_T - 0.04 - WT]];
    const m = k.mesh(ctx.geo.extrude(pts, 0.14), M.plasterExt, [0, WT, Z1 - 0.07], [0, 0, 0]);
    U.worldUV(m, pt);
    // decorative gable board (懸魚-like) + round clock
    k.box(0.36, 0.26, 0.06, M.fascia, [4.0, gRidgeY - 0.34, Z1 + 0.55 - 0.02]);
    k.box(0.22, 0.14, 0.07, M.pinkDeep, [4.0, gRidgeY - 0.36, Z1 + 0.55 - 0.01]);
    A.clock([4.0, 5.3, Z1 + 0.03], 0, 0.36, { frame: M.fascia });
  }
  // flashing where the gable meets the main roof
  for (const side of [-1, 1]) U.beam(k, [4.0 + side * 3.0, ROOF_BASE + 0.05, Z1 - 0.1], [4.0 + side * 0.05, gRidgeY + 0.02, gz1], 0.12, 0.05, M.fascia);

  // ------------------------------------------------------------------ downpipes
  function downpipe(xg, zg, yTop, xw, zw, yBot) {
    // from gutter end (xg,zg,yTop) with an offset down to the wall point (xw,zw) then vertical
    const yBend = yTop - 0.45;
    U.beam(k, [xg, yTop, zg], [xg, yBend + 0.1, zg], 0.08, 0.08, M.gutter, true);
    U.beam(k, [xg, yBend + 0.1, zg], [xw, yBend - 0.25, zw], 0.08, 0.08, M.gutter, true);
    U.beam(k, [xw, yBend - 0.25, zw], [xw, yBot + 0.12, zw], 0.08, 0.08, M.gutter, true);
    k.cyl(0.05, 0.07, 0.14, M.gutter, [xw, yBot + 0.07, zw], null, 10);
    for (let y = yBot + 0.8; y < yBend - 0.4; y += 1.2) k.box(0.12, 0.03, 0.1, M.steelDark, [xw, y, zw]);
  }
  const hL = ctx.L.heightAt;
  downpipe(roofX0 + 0.12, zS + 0.11, roofTop(zS) - 0.2, X0 - 0.07, Z1 - 0.2, hL(X0 - 0.07, Z1 - 0.2));
  downpipe(roofX1 - 0.12, zS + 0.11, roofTop(zS) - 0.2, X1 + 0.07, Z1 - 0.2, hL(X1 + 0.07, Z1 - 0.2));
  downpipe(roofX0 + 0.12, zN - 0.11, roofTop(zN) - 0.2, X0 - 0.07, Z0 + 0.25, hL(X0 - 0.07, Z0 + 0.25));
  downpipe(roofX1 - 0.12, zN - 0.11, roofTop(zN) - 0.2, X1 + 0.07, Z0 + 0.25, hL(X1 + 0.07, Z0 + 0.25));

  // ------------------------------------------------------------------ exterior life: AC units, meters, grime, streaks
  function acUnit(x, y, z, rotY) {
    const g = k.group([x, y, z], rotY); const kk = ctx.kit(g);
    kk.rbox(0.8, 0.6, 0.3, 0.03, M.sill, [0, 0.3, 0]);
    kk.cyl(0.22, 0.22, 0.02, M.fascia, [-0.12, 0.3, 0.155], [Math.PI / 2, 0, 0], 16);
    for (let i = -3; i <= 3; i++) kk.box(0.44, 0.012, 0.012, M.steel, [-0.12, 0.3 + i * 0.055, 0.168]);
    kk.box(0.06, 0.08, 0.34, M.steelDark, [-0.3, -0.04, 0]); kk.box(0.06, 0.08, 0.34, M.steelDark, [0.3, -0.04, 0]);
    return g;
  }
  acUnit(X1 + 0.2, 0.08, -30.6, Math.PI / 2); P.addBox(X1 + 0.2, -30.6, 0.4, 0.9, 0, 0, 1);
  U.beam(k, [X1 + 0.05, 0.5, -30.95], [X1 + 0.05, 2.6, -30.95], 0.06, 0.06, M.sill, true);
  acUnit(X0 - 0.2, 0.08, -30.4, -Math.PI / 2); P.addBox(X0 - 0.2, -30.4, 0.4, 0.9, 0, 0, 1);
  U.beam(k, [X0 - 0.05, 0.5, -30.05], [X0 - 0.05, 2.7, -30.05], 0.06, 0.06, M.sill, true);
  // meter boxes on the west wall
  k.box(0.08, 0.5, 0.36, M.sill, [X0 - 0.04, 2.0, -29.2]); k.box(0.02, 0.16, 0.2, M.glassIn, [X0 - 0.085, 2.05, -29.2]);
  k.box(0.08, 0.36, 0.28, M.steel, [X0 - 0.04, 1.2, -28.6]);
  // grime along the plinth bottom & streaks under the eaves
  const grimeStrip = (x, z, w, rotY, y = 0) => { const m = k.plane(w, 0.45, M.grime, [x, y + 0.24, z], [0, rotY, 0]); m.receiveShadow = true; };
  for (let z = -34.5; z < -25.5; z += 2.2) grimeStrip(X1 + 0.012, z + 1.1, 2.2, Math.PI / 2, hL(X1 + 0.1, z + 1.1));
  for (let z = -33.5; z < -25.5; z += 2.2) grimeStrip(X0 - 0.012, z + 1.1, 2.2, -Math.PI / 2, hL(X0 - 0.1, z + 1.1));
  for (const [x, z, rot] of [[-2.2, Z1 + 0.008, 0], [9.6, Z1 + 0.008, 0], [X1 + 0.008, -29.6, Math.PI / 2], [X0 - 0.008, -31.0, -Math.PI / 2], [0.4, Z0 - 0.008, Math.PI], [-3.2, Z0 - 0.008, Math.PI]]) {
    const m = k.plane(1.6 + r() * 1.2, 0.5 + r() * 0.4, M.streak, [x, WT - 0.35, z], [0, rot, 0]); m.receiveShadow = true;
  }

  buildForecourt(A);
}

// ====================================================================== forecourt
function buildForecourt(A) {
  const { ctx, k, U, M, P } = A;
  const FY = B.FY;
  const TZ0 = B.Z1, TZ1 = -22.92; // terrace z range (north edge = facade)
  const TX0 = B.X0, TX1 = 7.4;
  const STEP = FY / 7, TREAD = 0.32;
  // ---- terrace (walkable porch at floor level)
  const tb = k.box(TX1 - TX0, FY - 0.01, TZ1 - TZ0, M.stone, [(TX0 + TX1) / 2, (FY - 0.01) / 2, (TZ0 + TZ1) / 2]);
  U.worldUV(tb, 1.8);
  U.worldUV(k.box(TX1 - TX0, 0.02, TZ1 - TZ0, M.paving, [(TX0 + TX1) / 2, FY - 0.01, (TZ0 + TZ1) / 2]), 2.4);
  k.box(TX1 - TX0 + 0.04, 0.06, 0.1, M.band, [(TX0 + TX1) / 2, FY - 0.03, TZ1 - 0.03]); // edge cap
  P.addWalkBox((TX0 + TX1) / 2, (TZ0 + TZ1) / 2, TX1 - TX0, TZ1 - TZ0, 0, FY);
  // ---- stairs x 0.6..6.2, 6 treads below the terrace (7 risers)
  const SX0 = 0.6, SX1 = 6.2;
  for (let i = 1; i <= 6; i++) {
    const top = i * STEP, zf = -21.0 - (i - 1) * TREAD; // south (front) edge of tread i
    const zb = TZ1; // each step block runs back to the terrace
    const m = k.box(SX1 - SX0, top, zf - zb, M.stone, [(SX0 + SX1) / 2, top / 2, (zf + zb) / 2]);
    U.worldUV(m, 1.8);
    U.worldUV(k.box(SX1 - SX0, 0.015, TREAD, M.paving, [(SX0 + SX1) / 2, top - 0.005, zf - TREAD / 2]), 2.4);
    k.box(SX1 - SX0, 0.03, 0.05, M.aluDark, [(SX0 + SX1) / 2, top - 0.008, zf - 0.03]); // nosing
    P.addWalkBox((SX0 + SX1) / 2, zf - TREAD / 2, SX1 - SX0, TREAD, 0, top);
  }
  // stair cheek walls + handrails (both sides) + centre handrail
  const stairY = (z) => FY * Math.min(1, Math.max(0, (-21.0 + TREAD - z) / (TREAD * 6 + 0.001) * 6 / 7));
  for (const x of [SX0 - 0.08, SX1 + 0.08]) {
    const pts = [[-21.0 + 0.3, 0], [-21.0 - 6 * TREAD, 0], [TZ1, 0]];
    const g = ctx.geo.extrude([[-20.72, 0], [TZ1, 0], [TZ1, FY + 0.12], [-21.0 - 5 * TREAD, 6 * STEP + 0.12], [-21.0, STEP + 0.12], [-20.72, 0.22]], 0.16);
    const m = k.mesh(g, M.band, [x, 0, 0], [0, -Math.PI / 2, 0]); U.worldUV(m, 1.5);
    void pts;
    U.railing(k, [[x, -20.9], [x, -21.0 - 5 * TREAD], [x, TZ1 - 0.05]], (xx, z) => z < -21.0 - 5 * TREAD ? FY + 0.12 : z > -21.0 ? 0.22 : STEP + 0.12 + (-21.0 - z) / (5 * TREAD) * 5 * STEP, { h: 0.85, post: 0.9, rails: [1.0], mat: M.stainless, round: true, postW: 0.045 });
    P.addBox(x, -21.95, 0.18, 2.2, 0, -1, 2.3);
  }
  // centre handrail: posts stand on treads 1, 3 and 6
  { const zt = (i) => -21.0 - (i - 1) * TREAD - TREAD / 2;
    for (const i of [1, 3, 6]) U.beam(k, [3.4, i * STEP, zt(i)], [3.4, i * STEP + 0.86, zt(i)], 0.045, 0.045, M.stainless, true);
    for (const h of [0.85, 0.6]) U.beam(k, [3.4, STEP + h, zt(1) + 0.15], [3.4, 6 * STEP + h, zt(6) - 0.1], 0.04, 0.04, M.stainless, true);
    P.addBox(3.4, (zt(1) + zt(6)) / 2, 0.08, zt(1) - zt(6), 0, 0, 1.3); }
  void stairY;
  // ---- retaining walls: terrace faces south where there are no stairs; railings on top
  U.railing(k, [[TX0 + 0.06, TZ1 + 0.06], [SX0 - 0.1, TZ1 + 0.06]], FY, { h: 1.05, post: 1.4, rails: [1, 0.5], bar: 0.14, mat: M.stainless, round: true });
  U.railing(k, [[TX0 + 0.06, TZ0 + 0.1], [TX0 + 0.06, TZ1 + 0.06]], FY, { h: 1.05, post: 1.1, rails: [1, 0.5], bar: 0.14, mat: M.stainless, round: true });
  U.railing(k, [[SX1 + 0.1, TZ1 + 0.06], [TX1 - 0.06, TZ1 + 0.06]], FY, { h: 1.05, post: 1.2, rails: [1, 0.5], bar: 0.14, mat: M.stainless, round: true });
  P.addBox((TX0 + SX0) / 2, TZ1 + 0.06, SX0 - TX0, 0.12, 0, FY - 0.2, FY + 1.1);
  P.addBox(TX0 + 0.06, (TZ0 + TZ1) / 2, 0.12, TZ1 - TZ0, 0, FY - 0.2, FY + 1.1);
  P.addBox((SX1 + TX1) / 2, TZ1 + 0.06, TX1 - SX1, 0.12, 0, FY - 0.2, FY + 1.1);
  // planter along the terrace wall west of the stairs (plaza level)
  planter(A, -3.85, 0.35, TZ1 + 0.05, -22.3, 0.5, 'st-planter-w');
  // ---- switch-back ramp on the east (1/8): F1 along the facade, landing, F2 back west
  const F1 = { x0: 7.4, x1: 12.5, z0: -24.95, z1: -23.55, yW: FY, yE: 0.625 };
  const LD = { x0: 12.5, x1: 13.95, z0: -24.95, z1: -21.95, y: 0.625 };
  const F2 = { x0: 7.4, x1: 12.5, z0: -23.35, z1: -21.95, yW: 0.0, yE: 0.625 };
  const wedge = (f) => { // solid ramp body, profile extruded along z
    const g = ctx.geo.extrude([[f.x0, 0], [f.x1, 0], [f.x1, f.yE], [f.x0, f.yW]], f.z1 - f.z0);
    const m = k.mesh(g, M.stone, [0, 0, (f.z0 + f.z1) / 2]); U.worldUV(m, 1.8);
    // surface skin (non-slip paving)
    const L = Math.hypot(f.x1 - f.x0, f.yE - f.yW), ang = Math.atan2(f.yE - f.yW, f.x1 - f.x0);
    const s = k.box(L, 0.02, f.z1 - f.z0, M.paving, [(f.x0 + f.x1) / 2, (f.yW + f.yE) / 2 - 0.004, (f.z0 + f.z1) / 2], [0, 0, ang]);
    U.worldUV(s, 2.4);
    return m;
  };
  if (F1.yW > 0.01) wedge(F1);
  wedge(F2);
  U.worldUV(k.box(LD.x1 - LD.x0, LD.y, LD.z1 - LD.z0, M.stone, [(LD.x0 + LD.x1) / 2, LD.y / 2, (LD.z0 + LD.z1) / 2]), 1.8);
  U.worldUV(k.box(LD.x1 - LD.x0, 0.02, LD.z1 - LD.z0, M.paving, [(LD.x0 + LD.x1) / 2, LD.y - 0.006, (LD.z0 + LD.z1) / 2]), 2.4);
  // physics: F1 rises toward the west (local +z = -X => rotY -PI/2), F2 rises toward the east
  P.addWalkRamp((F1.x0 + F1.x1) / 2, (F1.z0 + F1.z1) / 2, F1.z1 - F1.z0, F1.x1 - F1.x0, -Math.PI / 2, F1.yE, F1.yW);
  P.addWalkRamp((F2.x0 + F2.x1) / 2, (F2.z0 + F2.z1) / 2, F2.z1 - F2.z0, F2.x1 - F2.x0, Math.PI / 2, F2.yW, F2.yE);
  P.addWalkBox((LD.x0 + LD.x1) / 2, (LD.z0 + LD.z1) / 2, LD.x1 - LD.x0, LD.z1 - LD.z0, 0, LD.y);
  // divider wall between the flights (profile: ground .. F1 surface + 0.9)
  {
    const g = ctx.geo.extrude([[F1.x0, 0], [F1.x1, 0], [F1.x1, F1.yE + 0.9], [F1.x0, F1.yW + 0.9]], 0.2);
    const m = k.mesh(g, M.plasterExt, [0, 0, -23.45]); U.worldUV(m, 3.0);
    U.beam(k, [F1.x0, F1.yW + 0.92, -23.45], [F1.x1, F1.yE + 0.92, -23.45], 0.22, 0.05, M.band);
    P.addBox((F1.x0 + F1.x1) / 2, -23.45, F1.x1 - F1.x0, 0.2, 0, -1, F1.yW + 0.95);
  }
  // parapets: F2 south side, landing north + east sides, F1 north side beyond the building
  const parapet = (pts, yFn, hgt = 0.9) => {
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
      const along = Math.abs(bx - ax) > Math.abs(bz - az);
      if (along) {
        const x0 = Math.min(ax, bx), x1 = Math.max(ax, bx), z = az;
        const g = ctx.geo.extrude([[x0, 0], [x1, 0], [x1, yFn(x1, z) + hgt], [x0, yFn(x0, z) + hgt]], 0.16);
        const m = k.mesh(g, M.plasterExt, [0, 0, z]); U.worldUV(m, 3.0);
        U.beam(k, [x0 - 0.02, yFn(x0, z) + hgt + 0.02, z], [x1 + 0.02, yFn(x1, z) + hgt + 0.02, z], 0.2, 0.05, M.band);
        P.addBox((x0 + x1) / 2, z, x1 - x0, 0.18, 0, -1, Math.max(yFn(x0, z), yFn(x1, z)) + hgt);
      } else {
        const z0 = Math.min(az, bz), z1 = Math.max(az, bz), x = ax, y = yFn(x, z0);
        const m = k.box(0.16, y + hgt, z1 - z0, M.plasterExt, [x, (y + hgt) / 2, (z0 + z1) / 2]); U.worldUV(m, 3.0);
        k.box(0.2, 0.05, z1 - z0 + 0.04, M.band, [x, y + hgt + 0.02, (z0 + z1) / 2]);
        P.addBox(x, (z0 + z1) / 2, 0.18, z1 - z0, 0, -1, y + hgt);
      }
    }
  };
  const f2y = (x) => F2.yW + (x - F2.x0) / (F2.x1 - F2.x0) * (F2.yE - F2.yW);
  parapet([[F2.x0 + 0.1, -21.87], [LD.x1, -21.87]], (x) => (x > LD.x0 ? LD.y : f2y(x)));
  parapet([[LD.x1 - 0.08, -21.95], [LD.x1 - 0.08, -24.95]], () => LD.y);
  parapet([[12.0, -24.87], [LD.x1, -24.87]], (x) => (x > LD.x0 ? LD.y : F1.yE + (F1.x1 - x) / (F1.x1 - F1.x0) * (F1.yW - F1.yE)));
  // stainless handrails on both sides of both flights (0.85 + 0.65)
  const f1y = (x) => F1.yE + (F1.x1 - x) / (F1.x1 - F1.x0) * (F1.yW - F1.yE);
  // wall-mounted rails: two heights, with brackets back to the wall face at zw
  const hr = (xa, xb, z, yf, zw) => {
    for (const h of [0.85, 0.65]) U.beam(k, [xa, yf(xa) + h, z], [xb, yf(xb) + h, z], 0.04, 0.04, M.stainless, true);
    const n = Math.max(1, Math.round((xb - xa) / 1.2));
    for (let i = 0; i <= n; i++) { const x = xa + (xb - xa) * i / n; for (const h of [0.85, 0.65]) U.beam(k, [x, yf(x) + h - 0.04, z], [x, yf(x) + h - 0.04, zw], 0.025, 0.025, M.stainless, true); }
  };
  hr(F1.x0 + 0.05, F1.x1, -24.8, f1y, -24.99); hr(F1.x0 + 0.05, F1.x1, -23.62, f1y, -23.55);
  hr(F2.x0 + 0.15, F2.x1, -23.28, f2y, -23.35); hr(F2.x0 + 0.15, F2.x1, -22.03, f2y, -21.95);
  // ---- forecourt ground at plaza level (paving) where the plaza module does not pave
  const pave = (x0, x1, z0, z1) => U.worldUV(k.box(x1 - x0, 0.03, z1 - z0, M.paving, [(x0 + x1) / 2, 0.012, (z0 + z1) / 2]), 2.4);
  pave(-4.0, 14.0, -21.0, -20.5);
  pave(-4.0, 0.52, -22.92, -21.0);
  pave(6.28, 7.4, -23.35, -21.0);
  pave(7.4, 14.0, -21.95, -21.0);
  // planter south of the lower ramp flight
  planter(A, 7.9, 13.6, -21.87 + 0.08, -21.3, 0.45, 'st-planter-e');
  // ---- tactile paving: stair top/bottom warning + guide line to the doors
  const tDot = (x, z, w, d, y) => U.worldUV(k.box(w, 0.01, d, M.tactDot, [x, y + 0.005, z]), 0.3);
  const tLine = (x, z, w, d, y, swap = false) => U.worldUV(k.box(w, 0.01, d, M.tactLine, [x, y + 0.005, z]), 0.3, [0, 0], swap);
  tDot(4.0, TZ1 - 0.3, 1.2, 0.6, FY); tDot(4.0, -20.8, 1.2, 0.3, 0.02);
  tLine(4.0, (TZ0 + TZ1 - 0.6) / 2 + 0.05, 0.3, (TZ1 - 0.6 - TZ0) - 0.3, FY);
  tDot(6.85, -21.2, 0.9, 0.3, 0.02); // ramp foot
}

function planter(A, x0, x1, z0, z1, h, seed) {
  const { ctx, k, U, M } = A;
  const r = ctx.rng(seed);
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, w = x1 - x0, d = Math.abs(z1 - z0);
  U.worldUV(k.box(w, h, d, M.stone, [cx, h / 2, cz]), 1.8);
  k.box(w + 0.06, 0.05, d + 0.06, M.band, [cx, h + 0.02, cz]);
  U.worldUV(k.box(w - 0.12, 0.02, d - 0.12, M.soil, [cx, h - 0.03, cz]), 1.5);
  const C = U.cards(), F = A.tx.FOL;
  const kinds = ['pansy', 'pansy', 'tulip', 'daisy'];
  const n = Math.floor(w * d * 16) + Math.floor(w / 0.3);
  for (let i = 0; i < n; i++) {
    const x = x0 + 0.12 + r() * (w - 0.24), z = cz + (r() - 0.5) * (d - 0.22);
    const kind = kinds[Math.floor(r() * kinds.length)];
    const s = kind === 'tulip' ? 0.42 : 0.3;
    C.cross(x, h - 0.03, z, s, s * (kind === 'tulip' ? 1.1 : 0.9), r() * 3, F.r(kind));
  }
  const mesh = C.build(M.foliage); if (mesh) { ctx.noOutline(mesh); A.root.add(mesh); }
  A.P.addBox(cx, cz, w, d, 0, -1, h);
}
