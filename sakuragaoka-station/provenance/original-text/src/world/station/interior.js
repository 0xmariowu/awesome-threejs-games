// Station interior (concourse, waiting room, paid side, 駅務室 shell). Everything is modelled geometry:
// T-bar ceiling with 逆富士 fixtures, cassette AC, detectors, speakers, CCTV domes, exit signs; skirting,
// wainscot, door / opening casings; 2 touch-screen ticket machines with recessed screens, slots and trays;
// raised-frame fare chart; staffed window; 改札ラッチ booth; 4 IC gate cabinets with reader heads,
// displays, flaps and sensors; waiting room with benches round a kerosene stove, えきなか文庫 bookshelf,
// pamphlet rack, potted plants, vending machine, stamp stand + stamp desk; umbrella rack, sorted bins,
// AED, extinguishers, notice boards with pinned sheets, 伝言板; modelled tactile paving; warm light pools.
import * as THREE from 'three';
import { B } from './building.js';
import { createProps } from './props3d.js';
import { buildOffice } from './office.js';

export function buildInterior(A) {
  const { ctx, k, U, M, P } = A;
  const { FY, CEIL } = B;
  const r = ctx.rng('station-interior');
  const PI = Math.PI;
  const X = createProps(A);
  const { C, grp, K } = X;
  A.X = X;

  // ================================================================ ceiling: slab, T-bar grid, fittings, lights + pools
  k.box(15.6, 0.08, 10.1, M.ceiling, [4.0, CEIL + 0.04, -30.25]);
  for (let x = -3.5; x < 11.7; x += 0.6) k.box(0.022, 0.016, 10.1, M.ceilingGrid, [x, CEIL - 0.008, -30.25]);
  for (let z = -35.0; z < -25.3; z += 0.6) k.box(15.6, 0.016, 0.022, M.ceilingGrid, [4.0, CEIL - 0.008, z]);
  const poolAt = (x, z, rx, rz) => X.pool(x, z, rx, rz);
  for (const z of [-26.4, -28.3]) for (const x of [-2.4, 0.8, 4.0, 7.2, 10.4]) { X.fixture(x, z, { tubes: 2 }); poolAt(x, z, 1.25, 0.95); }
  for (const z of [-30.9, -33.5]) { X.fixture(-1.7, z, { rot: PI / 2, tubes: 2 }); poolAt(-1.7, z, 0.95, 1.25); }
  for (const z of [-32.2, -34.3]) for (const x of [7.0, 10.2]) { X.fixture(x, z, { tubes: 2 }); poolAt(x, z, 1.2, 0.9); }
  for (const z of [-31.0, -33.6]) { X.fixture(2.9, z, { tubes: 2 }); poolAt(2.9, z, 1.1, 0.85); }
  X.cassette(5.6, -27.35); X.cassette(-0.8, -32.2); X.cassette(8.6, -33.25, 0.0);
  for (const [x, z] of [[1.6, -26.9], [9.0, -26.9], [-2.6, -32.2], [8.6, -31.5], [1.5, -32.3], [4.3, -32.3]]) X.smokeDetector(x, z);
  for (const [x, z] of [[3.0, -27.35], [-2.6, -29.6], [10.6, -33.25], [2.6, -34.4]]) X.ceilSpeaker(x, z);
  for (const [x, z] of [[6.2, -28.5], [1.6, -27.6], [6.1, -33.2]]) X.cctvDome(x, z);
  X.exitSign(4.0, 3.93, -25.2, PI);          // above the entrance, seen from inside
  X.exitSign(8.7, 3.93, -35.3, 0);           // above the platform opening
  // wall glows near the brightest fixtures (warm lift on the plaster)
  X.wallGlow(1.6, 3.35, -29.19, 0, 1.5, 0.9);
  X.wallGlow(-3.79, 3.2, -30.9, PI / 2, 1.5, 0.9);

  // ================================================================ office walls (駅務室 shell) + colliders
  const OX0 = 0.4, OX1 = 5.4, OZS = -29.2;
  U.wall(k, M.plasterInt, 'x', OZS - 0.2, OZS, OX0, OX1, FY - 0.01, CEIL, [{ a0: 3.0, a1: 5.0, y0: 2.25, y1: 3.35 }], 3);
  U.wall(k, M.plasterInt, 'z', OX0, OX0 + 0.2, -35.3, OZS, FY - 0.01, CEIL, [], 3);
  U.wall(k, M.plasterInt, 'z', OX1 - 0.2, OX1, -35.3, OZS - 0.2, FY - 0.01, CEIL, [{ a0: -30.75, a1: -29.95, y0: FY - 0.02, y1: 3.25 }], 3);
  P.addAABB(OX0, OZS - 0.2, OX1, OZS, -1, 6); P.addAABB(OX0, -35.4, OX0 + 0.2, OZS, -1, 6); P.addAABB(OX1 - 0.2, -35.4, OX1, OZS, -1, 6);
  // door frame of the office → booth door (east wall)
  for (const z of [-30.78, -29.92]) k.box(0.24, 2.06, 0.05, M.trimInt, [OX1 - 0.1, FY + 1.03, z]);
  k.box(0.24, 0.06, 0.92, M.trimInt, [OX1 - 0.1, FY + 2.03, -30.35]);

  // ================================================================ skirting boards + wainscot + casings
  const skirt = M.ic('#6a5a50', 0.02);
  const sk = (x0, z0, x1, z1) => { const w = Math.max(0.012, x1 - x0), d = Math.max(0.012, z1 - z0); k.box(w, 0.09, d, skirt, [(x0 + x1) / 2, FY + 0.045, (z0 + z1) / 2]); };
  sk(6.6, -25.212, 11.8, -25.2);                                          // south (east part; the west part has the wainscot)
  sk(11.788, -35.3, 11.8, -25.2);                                          // east
  sk(0.4, -29.2, 5.4, -29.188);                                            // office south face
  sk(0.388, -35.3, 0.4, -29.2); sk(5.4, -35.3, 5.412, -30.9);             // office west / east faces
  sk(0.6, -29.412, 5.2, -29.4); sk(0.6, -35.3, 0.612, -29.4);             // office inside
  sk(5.188, -35.3, 5.2, -30.8); sk(0.6, -35.288, 3.85, -35.3); sk(4.85, -35.288, 5.2, -35.3);
  // 腰板 wood wainscot round the waiting room (board-and-batten)
  const wains = (axis, c, a0, a1, face) => {
    const H = 0.9, len = a1 - a0, mid = (a0 + a1) / 2;
    const pos = axis === 'x' ? [mid, FY + H / 2, c + face * 0.01] : [c + face * 0.01, FY + H / 2, mid];
    const pan = axis === 'x' ? k.box(len, H, 0.02, M.grainWood, pos) : k.box(0.02, H, len, M.grainWood, pos);
    U.worldUV(pan, [1.0, 1.0]);
    const cap = axis === 'x' ? [len + 0.02, 0.04, 0.045] : [0.045, 0.04, len + 0.02];
    k.box(...cap, C.woodDk, axis === 'x' ? [mid, FY + H + 0.02, c + face * 0.022] : [c + face * 0.022, FY + H + 0.02, mid]);
    for (let a = a0 + 0.14; a < a1 - 0.05; a += 0.15) k.box(axis === 'x' ? 0.022 : 0.012, H - 0.12, axis === 'x' ? 0.012 : 0.022, C.wood, axis === 'x' ? [a, FY + 0.06 + (H - 0.12) / 2 + 0.03, c + face * 0.026] : [c + face * 0.026, FY + 0.06 + (H - 0.12) / 2 + 0.03, a]);
    k.box(axis === 'x' ? len : 0.03, 0.1, axis === 'x' ? 0.03 : len, C.woodDk, axis === 'x' ? [mid, FY + 0.05, c + face * 0.015] : [c + face * 0.015, FY + 0.05, mid]);
  };
  wains('z', -3.8, -35.3, -25.2, 1);
  wains('x', -35.3, -3.78, 0.4, 1);
  wains('x', -25.2, -3.78, 1.4, -1);
  // entrance opening casing (inside) + platform opening head trim
  for (const x of [1.36, 6.64]) k.box(0.08, 3.65 - FY + 0.04, 0.03, M.aluDark, [x, (FY + 3.69) / 2, -25.215]);
  k.box(5.36, 0.08, 0.03, M.aluDark, [4.0, 3.69, -25.215]);
  k.box(6.2, 0.1, 0.05, M.band, [8.6, 3.7, -35.27]);

  // ================================================================ floor: doormats either side of the guide line, tactile paving
  X.doormat(3.33, -25.72, 0.95, 0.9); X.doormat(4.67, -25.72, 0.95, 0.9);
  X.tactile('dot', [4.0, -25.2], [4.0, -25.5]);
  X.tactile('line', [4.0, -25.5], [4.0, -27.9]);
  X.tactile('dot', [4.0, -27.9], [4.0, -28.2]);
  X.tactile('line', [4.15, -28.05], [6.9, -28.05]);
  X.tactile('dot', [6.9, -28.05], [7.2, -28.05]);
  X.tactile('line', [7.05, -28.2], [7.05, -35.3]);
  X.tactile('line', [2.1, -28.05], [3.85, -28.05]);
  X.tactile('dot', [1.8, -28.05], [2.1, -28.05]);
  X.flushTactile();

  // ================================================================ staffed window (駅務室 窓口): frame, sliding panes, counter, grille, bell
  {
    const wz = OZS - 0.1;
    k.box(2.08, 0.06, 0.24, M.trimInt, [4.0, 3.38, wz]); k.box(0.06, 1.12, 0.24, M.trimInt, [2.97, 2.8, wz]); k.box(0.06, 1.12, 0.24, M.trimInt, [5.03, 2.8, wz]);
    k.box(2.0, 0.05, 0.24, M.trimInt, [4.0, 2.27, wz]);
    for (const [x, dz] of [[3.5, 0.03], [4.35, -0.03]]) {
      k.box(1.04, 0.04, 0.03, M.aluDark, [x, 3.32, wz + dz]); k.box(1.04, 0.04, 0.03, M.aluDark, [x, 2.32, wz + dz]);
      k.box(0.03, 1.0, 0.03, M.aluDark, [x - 0.5, 2.82, wz + dz]); k.box(0.03, 1.0, 0.03, M.aluDark, [x + 0.5, 2.82, wz + dz]);
      const g = k.plane(0.98, 0.96, M.glassIn, [x, 2.82, wz + dz]); g.castShadow = false;
    }
    // speaking grille in the fixed pane (ring frame + perforated disc) + pass-through slot under the glass
    { const gg = grp(3.5, 2.78, wz + 0.047, 0); const gk = K(gg); gk.torus(0.085, 0.008, M.aluDark, [0, 0, 0], null, PI * 2, 24); gk.cz(0.08, 0.004, M.aluDark, [0, 0, -0.002], 20); for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) if (i * i + j * j <= 5) gk.cz(0.008, 0.006, C.ink, [i * 0.025, j * 0.025, 0.0], 6); }
    U.worldUV(k.box(2.2, 0.05, 0.34, M.counterTop, [4.0, 2.25, OZS + 0.15]), 1);
    k.box(2.2, 0.04, 0.02, M.woodIntDark, [4.0, 2.21, OZS + 0.31]);
    for (const x of [3.1, 4.9]) { k.box(0.04, 0.3, 0.04, M.trimInt, [x, 2.08, OZS + 0.25]); k.box(0.04, 0.04, 0.26, M.trimInt, [x, 1.95, OZS + 0.14]); }
    k.box(0.36, 0.022, 0.2, M.aluDark, [4.3, 2.286, OZS + 0.16]); k.box(0.32, 0.01, 0.16, C.dark, [4.3, 2.3, OZS + 0.16]); // cash tray (dished)
    k.cyl(0.036, 0.042, 0.022, M.stainless, [4.85, 2.286, OZS + 0.16], null, 14); k.cyl(0.012, 0.012, 0.02, C.dark, [4.85, 2.307, OZS + 0.16], null, 8); // call bell
    // chained pen in a holder + small stand sign
    k.cyl(0.02, 0.02, 0.08, C.navy, [3.3, 2.315, OZS + 0.12], null, 10);
    { const pen = k.cyl(0.0055, 0.0055, 0.14, C.white, [3.42, 2.281, OZS + 0.2], null, 6); pen.rotation.set(0, 0, PI / 2 - 0.05); ctx.wires.add(ctx.geo.catenary([3.3, 2.35, OZS + 0.12], [3.36, 2.28, OZS + 0.2], 0.06, 8), { width: 0.004, color: '#9aa1a8' }); }
    { const sg = grp(3.72, 2.275, OZS + 0.14, 0); const skk = K(sg); skk.box(0.2, 0.008, 0.06, M.glassIn, [0, 0.004, 0]); skk.box(0.18, 0.12, 0.004, M.glassIn, [0, 0.07, -0.02], [-0.2, 0, 0]); skk.lab('N', 'lbCall', 0.14, 0.05, [0, 0.07, -0.017], [-0.2, 0, 0], 0.9); }
    A.board('face', 'windowSign', 1.15, 0.22, [4.0, 3.55, OZS + 0.02], 0, { lit: 0.85, border: 0.02, frame: M.trimInt });
    A.clock([4.0, 3.96, OZS + 0.04], 0, 0.19, { lit: true, frame: M.trimInt });
  }

  // ================================================================ 改札ラッチ (staffed gate booth) — staff stands at (6, -30)
  {
    const bx0 = 5.4, bx1 = 6.6, bz0 = -30.9, bz1 = -29.1, top = FY + 1.05;
    k.box(bx1 - bx0, top - FY, 0.06, M.boothPanel, [(bx0 + bx1) / 2, (FY + top) / 2, bz1 - 0.03]);
    k.box(bx1 - bx0, top - FY, 0.06, M.boothPanel, [(bx0 + bx1) / 2, (FY + top) / 2, bz0 + 0.03]);
    k.box(0.06, top - FY, bz1 - bz0, M.boothPanel, [bx1 - 0.03, (FY + top) / 2, (bz0 + bz1) / 2]);
    // panel mouldings + kick plates
    for (const z of [bz1 + 0.001, bz0 - 0.001]) { k.box(bx1 - bx0 - 0.1, 0.12, 0.006, C.steelDk, [(bx0 + bx1) / 2, FY + 0.06, z]); k.box(bx1 - bx0 - 0.16, 0.02, 0.008, C.greyLt, [(bx0 + bx1) / 2, FY + 0.72, z]); }
    k.box(0.006, 0.12, bz1 - bz0 - 0.1, C.steelDk, [bx1 + 0.001, FY + 0.06, (bz0 + bz1) / 2]); k.box(0.008, 0.02, bz1 - bz0 - 0.16, C.greyLt, [bx1 + 0.001, FY + 0.72, (bz0 + bz1) / 2]);
    k.box(bx1 - bx0 + 0.08, 0.04, 0.24, M.counterTop, [(bx0 + bx1) / 2, top + 0.02, bz1 - 0.06]);
    k.box(bx1 - bx0 + 0.08, 0.04, 0.24, M.counterTop, [(bx0 + bx1) / 2, top + 0.02, bz0 + 0.06]);
    k.box(0.28, 0.04, bz1 - bz0 + 0.08, M.counterTop, [bx1 - 0.08, top + 0.02, (bz0 + bz1) / 2]);
    const acr = (x, z, w, rot) => { const m = k.plane(w, 0.62, M.glassIn, [x, top + 0.36, z], [0, rot, 0]); m.castShadow = false; };
    acr((bx0 + bx1) / 2, bz1 - 0.02, bx1 - bx0 - 0.1, 0); acr((bx0 + bx1) / 2, bz0 + 0.02, bx1 - bx0 - 0.1, 0); acr(bx1 - 0.02, (bz0 + bz1) / 2 + 0.25, 1.1, PI / 2);
    for (const [x, z] of [[bx0 + 0.03, bz1 - 0.02], [bx1 - 0.02, bz1 - 0.02], [bx0 + 0.03, bz0 + 0.02], [bx1 - 0.02, bz0 + 0.02]]) k.box(0.04, 0.72, 0.04, M.aluDark, [x, top + 0.38, z]);
    k.box(bx1 - bx0, 0.05, 0.05, M.aluDark, [(bx0 + bx1) / 2, top + 0.72, bz1 - 0.02]); k.box(bx1 - bx0, 0.05, 0.05, M.aluDark, [(bx0 + bx1) / 2, top + 0.72, bz0 + 0.02]);
    A.board('face', 'mannedGate', 0.9, 0.28, [(bx0 + bx1) / 2, top + 0.95, bz1 - 0.02], 0, { lit: 0.85, frame: M.aluDark, border: 0.02 });
    k.box(0.04, 0.3, 0.04, M.aluDark, [5.6, top + 0.86, bz1 - 0.02]); k.box(0.04, 0.3, 0.04, M.aluDark, [6.4, top + 0.86, bz1 - 0.02]);
    // IC reader for the manned lane (east counter) + fare slip tray
    { const rg = grp(6.48, top + 0.04, -30.5, 0); const tg = new THREE.Group(); tg.rotation.z = -0.2; rg.add(tg); const rk = K(tg); rk.rb(0.18, 0.04, 0.18, 0.01, M.gateTop, [0, 0.02, 0]); rk.box(0.15, 0.006, 0.15, M.ledBlue, [0, 0.042, 0]).castShadow = false; rk.lab('face', 'icPad', 0.13, 0.13, [0, 0.0462, 0], [-PI / 2, 0, 0], 1.1); }
    k.box(0.3, 0.02, 0.2, M.sill, [5.8, top + 0.05, -30.75]);
    P.addAABB(bx0, bz0, bx1, bz1, -1, 3);
  }

  // ================================================================ IC gates (4 cabinets, 3 lanes) + railing
  const GZ0 = -30.85, GZ1 = -29.15, gTop = FY + 1.0;
  const cabinets = [[7.5, 7.8], [8.44, 8.74], [9.38, 9.68], [10.32, 10.62]];
  cabinets.forEach(([x0, x1], i) => {
    const hasS = i > 0, hasN = i < 3;
    X.gateCabinet((x0 + x1) / 2, (GZ0 + GZ1) / 2, {
      readS: hasS, readN: hasN, ticket: i === 1, flapE: i < 3, flapW: i > 0,
      goS: hasS, goN: hasN, labelS: hasS ? (i === 1 ? 'gateLabel2' : 'gateLabel') : null, labelN: hasN ? 'gateLabel' : null,
    });
    P.addAABB(x0 + 0.03, GZ0, x1 - 0.03, GZ1, -1, gTop + 0.15);
  });
  U.railing(k, [[10.66, -30.0], [11.78, -30.0]], FY, { h: 1.05, post: 0.55, rails: [1, 0.5], mat: M.stainless, round: true });
  k.plane(1.1, 0.45, M.frost, [11.22, FY + 0.3 + 0.225, -30.0]).castShadow = false;
  P.addAABB(10.62, -30.1, 11.8, -29.9, -1, 3);
  // hanging signs: gate / platforms sign and departure board (face the concourse), exit sign (faces the paid side)
  const hang = (x, y, z, w, h) => { for (const dx of [-w * 0.4, w * 0.4]) { U.beam(k, [x + dx, y + h / 2, z], [x + dx, CEIL, z], 0.015, 0.015, M.steelDark, true); k.box(0.06, 0.012, 0.06, M.steelDark, [x + dx, CEIL - 0.006, z]); } };
  A.board('face', 'gateSign', 3.6, 0.39, [8.4, 3.9, -28.95], 0, { lit: 0.95, frame: M.fascia, border: 0.03, depth: 0.06 });
  { const bk = new THREE.Mesh(U.rectPlane(3.6, 0.354, A.tx.B.r('gateBack')), A.signMat('B', 0.85)); bk.position.set(8.4, 3.9, -28.95 - 0.064); bk.rotation.y = PI; A.root.add(bk); }
  hang(8.4, 3.9, -28.98, 3.6, 0.39);
  A.board('face', 'depBoard', 1.25, 0.415, [8.4, 3.38, -28.95], 0, { lit: 1.0, frame: M.darkPanel, border: 0.04, depth: 0.1 });
  for (const dx of [-0.5, 0.5]) U.beam(k, [8.4 + dx, 3.6, -29.0], [8.4 + dx, 3.7, -29.0], 0.02, 0.02, M.steelDark, true);
  A.board('face', 'exitUp', 1.3, 0.33, [8.4, 3.75, -31.4], PI, { lit: 0.95, frame: M.fascia, border: 0.03, depth: 0.05 });
  hang(8.4, 3.75, -31.43, 1.3, 0.33);

  // ================================================================ ticket machines ×2 + raised-frame fare chart + projecting sign
  X.ticketMachine(1.15, -28.9, 0);
  X.ticketMachine(2.05, -28.9, 0);
  {
    const g = grp(1.6, 3.68, OZS, 0); const kk = K(g);
    kk.rb(2.16, 0.9, 0.07, 0.015, M.fascia, [0, 0, 0.035]);
    for (const [w, h, x, y] of [[2.1, 0.03, 0, 0.405], [2.1, 0.03, 0, -0.405], [0.03, 0.78, -1.035, 0], [0.03, 0.78, 1.035, 0]]) kk.rb(w, h, 0.03, 0.006, M.alu, [x, y, 0.085]);
    const f = new THREE.Mesh(U.rectPlane(2.0, 0.748, A.tx.I.r('fare')), A.signMat('I', 0.9)); f.position.set(0, 0, 0.0715); g.add(f);
    kk.box(2.16, 0.05, 0.14, M.fascia, [0, 0.475, 0.07]); kk.box(1.9, 0.012, 0.04, M.tubeLit, [0, 0.448, 0.1]).castShadow = false; // light hood
  }
  A.board('face', 'ticketHead', 0.94, 0.18, [0.62, 3.35, -28.62], PI / 2, { lit: 0.95, frame: M.fascia, back: 'ticketHead', depth: 0.04 });
  U.beam(k, [0.62, 3.35, -29.2], [0.62, 3.35, -29.1], 0.03, 0.03, M.fascia);
  X.wallSpeaker(0.62, 3.78, -29.2, 0);

  // ================================================================ office west face (waiting-room side): area map, timetables, route map
  const OW = OX0;
  A.board('I', 'area', 1.2, 0.84, [OW - 0.02, 2.78, -33.75], -PI / 2, { lit: 0.8, frame: M.trimInt });
  A.board('I', 'tt1', 0.5, 0.7, [OW - 0.02, 2.78, -32.75], -PI / 2, { lit: 0.8, frame: M.fascia, border: 0.02 });
  A.board('I', 'tt2', 0.5, 0.7, [OW - 0.02, 2.78, -32.15], -PI / 2, { lit: 0.8, frame: M.fascia, border: 0.02 });
  A.board('I', 'route', 2.2, 0.54, [OW - 0.02, 2.95, -30.75], -PI / 2, { lit: 0.8, frame: M.fascia, border: 0.03 });

  // ================================================================ waiting room (x -3.8..0.4)
  X.benchIn(-3.47, -30.8, PI / 2, 2.6);
  X.benchIn(0.1, -31.6, -PI / 2, 2.2, { slat: C.woodLt });
  X.stove(-1.7, -31.6);
  // children's drawings, pinned one by one on a cork board above the west bench
  X.corkBoard(-3.8, 2.95, -30.8, PI / 2, 1.34, 0.72, [
    ['N', 'dr0', -0.43, 0.12, 0.38, 0.263, -0.04, 0.008, 0.01, 2], ['N', 'dr1', 0.0, 0.14, 0.38, 0.263, 0.03, 0.01, 0, 2], ['N', 'dr2', 0.43, 0.11, 0.38, 0.263, -0.02, 0.008, 0.012, 2],
    ['N', 'dr3', -0.43, -0.18, 0.38, 0.263, 0.02, 0.01, 0, 2], ['N', 'dr4', 0.0, -0.17, 0.38, 0.263, -0.03, 0.012, 0.01, 2], ['N', 'dr5', 0.43, -0.19, 0.38, 0.263, 0.04, 0.01, 0, 2],
  ], { title: ['N', 1.1, 'drTitle'] });
  A.board('P', 'stampRally', 0.46, 0.65, [-3.78, 2.9, -34.45], PI / 2, { lit: 0.82, frame: null });
  A.board('P', 'manners', 0.46, 0.65, [-3.78, 2.9, -29.2], PI / 2, { lit: 0.82, frame: null });
  X.pottedPlant(-3.42, -34.92, { kind: 'topiary', potR: 0.19, potH: 0.4, trunk: 0.62, r: 0.26, seed: 9 });
  // ---- commemorative stamp stand (記念スタンプ台): cabinet, stamp box with the lid propped open, sign + sample print
  {
    const sx = -2.62, sz = -35.0;
    const g = grp(sx, FY, sz, 0); const kk = K(g);
    kk.box(0.52, 0.88, 0.38, M.woodIntDark, [0, 0.44, 0]);
    kk.box(0.46, 0.34, 0.01, M.woodInt, [0, 0.62, 0.195]); kk.box(0.46, 0.34, 0.01, M.woodInt, [0, 0.24, 0.195]);
    for (const y of [0.62, 0.24]) kk.box(0.08, 0.02, 0.02, C.gold, [0, y + 0.1, 0.205]);
    kk.rb(0.58, 0.04, 0.44, 0.01, M.counterTop, [0, 0.9, 0]);
    // wooden stamp box, lid hinged at the back and propped open
    kk.box(0.34, 0.12, 0.24, M.woodInt, [0, 0.98, 0.02]);
    kk.box(0.3, 0.004, 0.2, C.ink, [0, 1.041, 0.02]);
    const lid = new THREE.Group(); lid.position.set(0, 1.04, -0.1); lid.rotation.x = -1.9; g.add(lid); const lk = K(lid);
    lk.box(0.35, 0.02, 0.25, M.woodInt, [0, 0.01, 0.125]);
    const ab = new THREE.Mesh(U.rectPlane(0.2, 0.2, A.tx.B.r('stampArt')), A.signMat('B', 0.85)); ab.position.set(0, -0.001, 0.125); ab.rotation.x = PI / 2; lid.add(ab);
    // the stamp inside the box + a spare ink pad
    kk.rb(0.1, 0.04, 0.1, 0.01, M.woodIntDark, [-0.06, 1.06, 0.03]); kk.cy(0.022, 0.07, M.woodInt, [-0.06, 1.115, 0.03], 10); kk.sphere(0.035, M.woodInt, [-0.06, 1.16, 0.03], 10);
    kk.rb(0.11, 0.02, 0.08, 0.006, C.dark, [0.08, 1.05, 0.05]); kk.box(0.09, 0.004, 0.06, C.pinkDk, [0.08, 1.061, 0.05]);
    // sign standing behind
    kk.box(0.52, 0.26, 0.018, M.woodIntDark, [0, 1.36, -0.16]);
    kk.lab('B', 'stampSign', 0.48, 0.23, [0, 1.36, -0.15], null, 0.85);
    for (const x of [-0.2, 0.2]) kk.box(0.02, 0.3, 0.02, M.woodIntDark, [x, 1.1, -0.17]);
    P.addBox(sx, sz, 0.58, 0.44, 0, -1, 3);
  }
  // ---- stamp desk under the platform-side window: open visitor notebook, pens (one on a string), ink pad, slips, stool
  {
    const dx = -1.65, dz = -34.98;
    const g = grp(dx, FY, dz, 0); const d = K(g);
    d.rb(1.3, 0.04, 0.5, 0.01, M.counterTop, [0, 0.74, 0]);
    for (const [x, z] of [[-0.6, -0.2], [0.6, -0.2], [-0.6, 0.2], [0.6, 0.2]]) d.box(0.045, 0.72, 0.045, M.woodIntDark, [x, 0.36, z]);
    d.box(1.2, 0.04, 0.4, M.woodIntDark, [0, 0.2, 0]); d.box(1.2, 0.06, 0.02, M.woodIntDark, [0, 0.69, 0.22]);
    const ty = 0.76;
    // visitor notebook, open: cover + two page blocks rising to the spine
    const nb = new THREE.Group(); nb.position.set(-0.22, ty, 0.04); nb.rotation.y = 0.12; g.add(nb); const nk = K(nb);
    nk.box(0.44, 0.006, 0.3, M.ic('#b8403a'), [0, 0.003, 0]);
    for (const s of [-1, 1]) {
      const pg = new THREE.Group(); pg.position.set(s * 0.105, 0.006, 0); pg.rotation.z = -s * 0.05; nb.add(pg); const pk = K(pg);
      pk.box(0.2, 0.014, 0.28, C.paper, [0, 0.007, 0]);
      const pp = new THREE.Mesh(U.rectPlane(0.19, 0.27, A.tx.B.r('notePage')), A.signMat('B', 0.85)); pp.position.set(0, 0.0145, 0); pp.rotation.set(-PI / 2, 0, PI / 2); pg.add(pp);
    }
    // closed spare notebook + cover label
    { const cb = new THREE.Group(); cb.position.set(0.36, ty, -0.08); cb.rotation.y = -0.3; g.add(cb); const ck = K(cb); ck.box(0.2, 0.025, 0.15, M.ic('#e6d3a8'), [0, 0.0125, 0]); const cv = new THREE.Mesh(U.rectPlane(0.19, 0.14, A.tx.B.r('notebook')), A.signMat('B', 0.85)); cv.position.set(0, 0.0255, 0); cv.rotation.x = -PI / 2; cb.add(cv); }
    // pens: one on a string tied to the desk edge, one lying loose
    { const pn = d.cy(0.0055, 0.14, C.navy, [0.06, ty + 0.006, 0.17], 6); pn.rotation.set(0, 0.3, PI / 2); d.cy(0.0065, 0.03, C.red, [0.0, ty + 0.006, 0.19], 6).rotation.set(0, 0.3, PI / 2);
      const a = new THREE.Vector3(0.13, ty + 0.004, 0.14).add(g.position), b = new THREE.Vector3(0.2, 0.7, 0.25).add(g.position); ctx.wires.add(ctx.geo.catenary(a, b, 0.05, 8), { width: 0.003, color: '#e8e2d2' }); }
    { const pn = d.cy(0.005, 0.13, C.red, [-0.52, ty + 0.005, 0.18], 6); pn.rotation.set(0, -0.6, PI / 2); }
    // ink pad tin with its lid open
    d.rb(0.12, 0.022, 0.09, 0.006, C.dark, [0.22, ty + 0.011, 0.13]); d.box(0.1, 0.004, 0.07, C.pinkDk, [0.22, ty + 0.0235, 0.13]);
    { const lg = new THREE.Group(); lg.position.set(0.22, ty + 0.022, 0.085); lg.rotation.x = -1.8; g.add(lg); K(lg).rb(0.12, 0.012, 0.09, 0.005, C.dark, [0, 0.006, 0.045]); }
    // the big station stamp on a tray + a stack of stamp slips (top one printed)
    d.rb(0.18, 0.012, 0.14, 0.005, M.woodIntDark, [0.45, ty + 0.006, 0.12]);
    d.rb(0.09, 0.035, 0.09, 0.008, M.woodIntDark, [0.45, ty + 0.03, 0.12]); d.cy(0.02, 0.08, M.woodInt, [0.45, ty + 0.088, 0.12], 10); d.sphere(0.03, M.woodInt, [0.45, ty + 0.135, 0.12], 10);
    for (let i = 0; i < 8; i++) d.box(0.1, 0.003, 0.07, C.paper, [-0.52 + (r() - 0.5) * 0.01, ty + 0.0015 + i * 0.003, -0.12 + (r() - 0.5) * 0.01], [0, (r() - 0.5) * 0.2, 0]);
    { const sc = new THREE.Mesh(U.rectPlane(0.098, 0.068, A.atlases.N.r('stampCard')), A.signMat('N', 0.85)); sc.position.set(-0.52, ty + 0.0255, -0.12); sc.rotation.x = -PI / 2; g.add(sc); }
    // pen cup
    d.cy(0.03, 0.09, M.ic('#8fd1c1'), [-0.4, ty + 0.045, -0.15], 12); for (let i = 0; i < 3; i++) { const p = d.cy(0.005, 0.13, [C.red, C.blue, C.ink][i], [-0.4 + (i - 1) * 0.012, ty + 0.12, -0.15], 6); p.rotation.set((i - 1) * 0.2, 0, (i - 1) * -0.15); }
    // stool
    d.cy(0.17, 0.04, M.woodInt, [0.1, 0.46, 0.5], 16); d.cy(0.03, 0.44, C.steelDk, [0.1, 0.22, 0.5], 8); d.cy(0.16, 0.02, C.steelDk, [0.1, 0.01, 0.5], 14); d.torus(0.12, 0.008, C.steelDk, [0.1, 0.18, 0.5], [PI / 2, 0, 0], PI * 2, 16);
    P.addBox(dx, dz, 1.3, 0.5, 0, -1, 3); P.addCylinder(dx + 0.1, dz + 0.5, 0.18, -1, FY + 0.5);
  }
  // ---- vending corner (NE of the waiting room) + can / bottle recycle bin
  X.vendingMachine(-0.1, -34.92, 0);
  {
    const g = grp(-0.8, FY, -35.02, 0); const kk = K(g);
    kk.mesh(X.geo('recyc', () => new THREE.CylinderGeometry(0.155, 0.14, 0.72, 18)), C.blue, [0, 0.36, 0]);
    kk.cy(0.165, 0.06, C.greyLt, [0, 0.75, 0], 18); kk.cy(0.06, 0.004, C.ink, [-0.05, 0.782, 0], 14); kk.cy(0.06, 0.004, C.ink, [0.07, 0.782, 0.02], 14);
    X.lab(g, 'B', 'binCan', 0.13, 0.065, [0, 0.52, 0.156], null, 0.85);
    P.addCylinder(-0.8, -35.02, 0.18, -1, 3);
  }
  // ---- south part: えきなか文庫 bookshelf under the window, pamphlet rack, plant; AED + extinguisher by the door
  {
    const { kk, top } = X.bookshelf(-2.65, -25.39, PI, { w: 1.6, h: 0.86, d: 0.3, seed: 'ekinaka' });
    // acrylic sign stand, newspapers, a little plant on top
    kk.box(0.24, 0.01, 0.07, M.glassIn, [-0.45, top + 0.005, 0]); kk.box(0.23, 0.07, 0.004, M.glassIn, [-0.45, top + 0.04, -0.01], [-0.2, 0, 0]);
    kk.lab('N', 'bookSign', 0.22, 0.056, [-0.45, top + 0.04, -0.0075], [-0.2, 0, 0], 0.9);
    X.newspapers(kk, 0.1, top, 0.0, 5, 0.1);
    X.pottedPlant(-2.65 - 0.55, -25.39, { y: FY + top, potR: 0.07, potH: 0.11, r: 0.12, h: 0.22, seed: 14, shrubKind: 'young', col: false, saucer: false });
  }
  X.pamphletRack(-1.55, -25.35, PI);
  X.pottedPlant(-0.55, -25.55, { kind: 'topiary', potR: 0.17, potH: 0.34, trunk: 0.48, r: 0.22, seed: 31, pot: M.ic('#e2ddd0') });
  X.aedBox(0.8, FY + 1.28, -25.2, PI);
  X.fireBox(1.12, -25.4, PI);
  A.board('P', 'festival', 0.48, 0.68, [-1.55, 2.9, -25.22], PI, { lit: 0.82, frame: null });

  // ================================================================ east concourse: umbrella rack, bench, bins, 伝言板, posters
  X.umbrellaRack(7.25, -25.42, PI, { n: 6, filled: [0, 1, 2, 4, 5], seed: 'okigasa' });
  A.board('B', 'umbrellaSign', 0.48, 0.23, [7.25, FY + 1.28, -25.22], PI, { lit: 0.85, frame: null });
  A.board('P', 'noSmoking', 0.34, 0.34, [7.25, 3.12, -25.22], PI, { lit: 0.85, frame: null });
  A.board('P', 'safety', 0.42, 0.595, [9.7, 2.85, -25.22], PI, { lit: 0.82, frame: null });
  X.benchIn(8.75, -25.5, PI, 1.5);
  X.binUnit(11.55, -26.6, -PI / 2);
  X.chalkBoard(11.8, FY + 1.58, -28.35, -PI / 2, 1.2, 0.68);
  X.wallSpeaker(11.8, 3.75, -28.35, -PI / 2);
  X.wallSpeaker(6.95, 3.75, -25.2, PI);

  // ================================================================ paid side: fare adjustment machine, ramp, bench, notice board, posters
  {
    const g = grp(5.63, FY, -33.3, PI / 2); const kk = K(g);
    kk.box(0.6, 0.08, 0.42, M.tvmDark, [0, 0.04, 0]);
    kk.rb(0.62, 1.44, 0.46, 0.035, M.tvmBody, [0, 0.8, 0], null, 2);
    kk.box(0.64, 0.025, 0.48, M.tvmDark, [0, 1.535, 0]);
    // recessed screen (bezel frame proud of the face)
    for (const [w, h, x, y] of [[0.46, 0.03, 0, 1.335], [0.46, 0.03, 0, 1.025], [0.03, 0.28, -0.215, 1.18], [0.03, 0.28, 0.215, 1.18]]) kk.box(w, h, 0.014, M.tvmDark, [x, y, 0.237]);
    const sc = new THREE.Mesh(U.rectPlane(0.4, 0.28, A.tx.TVM.r('screen')), A.signMat('TVM', 0.95)); sc.position.set(0, 1.18, 0.232); g.add(sc);
    // ticket insert slot, coin & bill slots, change tray
    kk.rb(0.2, 0.05, 0.04, 0.01, M.tvmDark, [-0.14, 0.9, 0.245]); kk.box(0.14, 0.008, 0.006, C.ink, [-0.14, 0.9, 0.266]); X.lab(g, 'N', 'lbTicket', 0.2, 0.031, [-0.14, 0.955, 0.2315]);
    kk.rb(0.1, 0.08, 0.012, 0.004, M.stainless, [0.16, 0.9, 0.236]); kk.box(0.06, 0.01, 0.006, C.ink, [0.16, 0.9, 0.243]);
    kk.rb(0.18, 0.06, 0.04, 0.01, M.tvmDark, [0.12, 0.78, 0.245]); kk.box(0.13, 0.01, 0.006, C.ink, [0.12, 0.78, 0.266]); kk.box(0.13, 0.005, 0.004, M.ledGreen, [0.12, 0.8, 0.265]);
    kk.box(0.44, 0.02, 0.1, M.tvmDark, [0, 0.52, 0.27]); kk.box(0.4, 0.014, 0.09, M.stainless, [0, 0.38, 0.265]);
    for (const s of [-1, 1]) kk.box(0.02, 0.15, 0.1, M.tvmDark, [s * 0.21, 0.45, 0.27]);
    kk.box(0.44, 0.04, 0.02, M.tvmDark, [0, 0.39, 0.315]); kk.box(0.4, 0.13, 0.004, C.ink, [0, 0.45, 0.232]);
    X.lab(g, 'N', 'lbChange', 0.2, 0.031, [0, 0.555, 0.2315]);
    kk.box(0.6, 0.02, 0.012, M.pinkBand, [0, 1.49, 0.232]);
    A.board('face', 'fareAdj', 0.8, 0.154, [5.42, 2.95, -33.3], PI / 2, { lit: 0.95, frame: M.fascia, border: 0.02 });
    P.addBox(5.63, -33.3, 0.46, 0.62, 0, -1, 3);
  }
  { // folding wheelchair ramp (車いす用スロープ) leaning on the office wall
    const g = grp(5.62, FY, -31.85, PI / 2); const kk = K(g);
    const lean = new THREE.Group(); lean.rotation.x = -0.2; g.add(lean); const lk = K(lean);
    lk.rb(0.78, 0.9, 0.05, 0.012, M.alu, [0, 0.45, 0]);
    for (let i = 0; i < 8; i++) lk.box(0.7, 0.012, 0.006, M.aluDark, [0, 0.1 + i * 0.1, 0.027]);
    lk.box(0.78, 0.03, 0.06, M.aluDark, [0, 0.45, 0.0]);
    lk.box(0.12, 0.04, 0.03, C.dark, [0, 0.82, 0.04]);
    lk.lab('N', 'rampLabel', 0.2, 0.043, [0, 0.62, 0.0265], null, 0.9);
    P.addBox(5.55, -31.85, 0.3, 0.8, 0, -1, 2);
  }
  X.fireBox(5.82, -35.02, 0);
  A.board('I', 'tt1', 0.5, 0.7, [5.42, 2.8, -31.2], PI / 2, { lit: 0.8, frame: M.fascia, border: 0.02 });
  { // fire alarm transmitter (発信機) with its red indicator lamp
    const g = grp(5.4, FY + 0.88, -31.2, PI / 2); const kk = K(g);
    kk.rb(0.22, 0.3, 0.06, 0.012, C.red, [0, 0, 0.03]);
    X.lab(g, 'N', 'alarmLb', 0.18, 0.24, [0, 0, 0.0605], null, 0.95);
    kk.cz(0.045, 0.02, C.white, [0, -0.025, 0.07], 16); kk.cz(0.03, 0.014, C.red, [0, -0.025, 0.083], 14);
    kk.rb(0.12, 0.08, 0.06, 0.012, C.red, [0, 0.22, 0.03]); kk.cz(0.035, 0.03, M.ledRed, [0, 0.22, 0.07], 14);
  }
  X.benchIn(11.5, -33.4, -PI / 2, 1.5);
  A.board('P', 'manners', 0.44, 0.62, [5.42, 2.85, -34.5], PI / 2, { lit: 0.82, frame: null });
  A.board('P', 'sakuraFest', 0.44, 0.62, [5.42, 2.85, -31.9], PI / 2, { lit: 0.82, frame: null });
  A.board('P', 'wantedPoster', 0.44, 0.625, [11.78, 2.85, -34.75], -PI / 2, { lit: 0.82, frame: null });
  // notice board with individually pinned sheets (some curling at the corner)
  X.corkBoard(11.8, 2.8, -31.35, -PI / 2, 1.3, 0.76, [
    ['N', 'nDaiya', -0.5, 0.12, 0.2, 0.283, 0.02, 0.01, 0.008, 2],
    ['N', 'nCat', -0.24, 0.1, 0.2, 0.283, -0.05, 0.014, 0.012, 1],
    ['N', 'nClean', 0.02, 0.13, 0.2, 0.283, 0.03, 0.01, 0, 2],
    ['P', 'lostFound', 0.37, 0.18, 0.4, 0.282, -0.02, 0.012, 0.01, 4],
    ['N', 'nRec', -0.42, -0.2, 0.2, 0.283, 0.04, 0.012, 0.015, 1],
    ['N', 'nBus', -0.14, -0.2, 0.2, 0.283, -0.02, 0.008, 0, 2],
    ['N', 'nLib', 0.14, -0.19, 0.2, 0.283, 0.05, 0.016, 0.01, 1],
    ['N', 'nNoSmoke', 0.45, -0.2, 0.2, 0.283, -0.03, 0.01, 0, 2],
  ], { frame: C.woodDk });
  X.wallSpeaker(11.8, 3.75, -32.6, -PI / 2);
  A.board('signs', 'plat1', 1.2, 0.307, [7.1, 3.95, -35.27], 0, { lit: 0.9, frame: M.fascia, border: 0.02 }); // above the platform opening
  A.clock([10.3, 3.95, -35.27], 0, 0.2, { lit: true, frame: M.fascia });

  // ================================================================ the office interior + booth fittings
  buildOffice(A, X);
}
