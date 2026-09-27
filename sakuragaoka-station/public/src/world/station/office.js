// 駅務室 (station office, x 0.6..5.2, z -35.3..-29.4) + 改札ラッチ booth fittings: every object modelled —
// window desk with ticket terminal, platform-window desk with PC / CCTV / PA mic, swivel chairs,
// steel shelving full of binders, lockers, key cabinet, coat hooks with the uniform cap and jacket,
// tea corner (thermos pot, kettle, cups), desk fan, radio, clipboards, whiteboard, safe, copier,
// filing cabinet, wall air-conditioner, signal flags + hand lamp, bin, broom.
import * as THREE from 'three';
import { B } from './building.js';

export function buildOffice(A, X) {
  const { ctx, M, P } = A;
  const { C, grp, K, lab, sheet } = X;
  const PI = Math.PI, FY = B.FY;
  const r = ctx.rng('station-office');
  const OX0 = 0.6, OX1 = 5.2, OZ0 = -35.3, OZ1 = -29.4; // interior faces

  // ---------------------------------------------------------------- furniture factories
  const laminate = M.ic('#d7d2c4'), deskGrey = M.ic('#9ea3aa'), fabric = M.ic('#34466e'), plastic = M.ic('#4a4b55', 0.02);
  function desk(x, z, rotY, w, d, o = {}) {
    const g = grp(x, FY, z, rotY); const kk = K(g);
    kk.rb(w, 0.03, d, 0.008, laminate, [0, 0.725, 0]);
    kk.box(w - 0.02, 0.04, d - 0.04, deskGrey, [0, 0.69, 0]);
    kk.box(0.03, 0.67, d - 0.06, deskGrey, [-w / 2 + 0.03, 0.335, 0]);
    kk.box(w - 0.1, 0.35, 0.02, deskGrey, [0, 0.45, -d / 2 + 0.04]); // modesty panel
    // pedestal with 3 drawers
    const px = w / 2 - 0.22;
    kk.box(0.42, 0.66, d - 0.06, deskGrey, [px, 0.34, 0]);
    for (let i = 0; i < 3; i++) { const y = 0.13 + i * 0.2; kk.box(0.38, 0.17, 0.012, M.ic('#b3b7bd'), [px, y, d / 2 - 0.024]); kk.box(0.12, 0.018, 0.018, C.steelDk, [px, y + 0.05, d / 2 - 0.012]); }
    kk.box(0.4, 0.02, d - 0.08, C.rubber, [px, 0.01, 0]);
    if (o.col !== false) P.addBox(x, z, w, d, rotY, -1, FY + 0.8);
    return { g, kk, top: 0.74 };
  }
  function chair(x, z, rotY, o = {}) {
    const g = grp(x, FY, z, rotY); const kk = K(g);
    for (let i = 0; i < 5; i++) {
      const a = i * PI * 2 / 5 + 0.3, lg = new THREE.Group(); lg.rotation.y = a; lg.position.y = 0.07; g.add(lg); const lk = K(lg);
      lk.box(0.035, 0.03, 0.3, plastic, [0, 0, 0.15], [0.12, 0, 0]);
      lk.sphere(0.026, C.ink, [0, -0.04, 0.29], 8);
    }
    kk.cy(0.035, 0.12, plastic, [0, 0.12, 0], 10); kk.cy(0.022, 0.2, C.steel, [0, 0.27, 0], 8);
    kk.box(0.2, 0.04, 0.22, plastic, [0, 0.39, 0]);
    kk.rb(0.48, 0.07, 0.46, 0.03, fabric, [0, 0.445, 0.02], null, 2);
    kk.box(0.06, 0.28, 0.025, plastic, [0, 0.55, -0.2], [-0.08, 0, 0]);
    kk.rb(0.44, 0.44, 0.06, 0.03, fabric, [0, 0.85, -0.23], [-0.1, 0, 0], 2);
    if (o.arms !== false) for (const s of [-1, 1]) { kk.box(0.03, 0.2, 0.03, plastic, [s * 0.23, 0.56, -0.02]); kk.rb(0.06, 0.03, 0.26, 0.012, plastic, [s * 0.23, 0.66, 0.01]); }
    P.addCylinder(x, z, 0.3, -1, FY + 1.0);
    return g;
  }
  function monitor(g, x, y, z, rotY, scr, o = {}) {
    const mg = new THREE.Group(); mg.position.set(x, y, z); mg.rotation.y = rotY; g.add(mg); const mk = K(mg);
    const w = o.w ?? 0.5, h = o.h ?? 0.31;
    mk.rb(0.2, 0.014, 0.16, 0.006, plastic, [0, 0.007, 0]);
    mk.box(0.045, 0.2, 0.03, plastic, [0, 0.11, -0.03]);
    const pg = new THREE.Group(); pg.position.set(0, 0.2 + h / 2, -0.005); pg.rotation.x = -0.08; mg.add(pg); const pk = K(pg);
    pk.rb(w, h, 0.03, 0.008, plastic, [0, 0, 0]);
    pk.box(w * 0.6, h * 0.6, 0.02, plastic, [0, 0, -0.025]);
    pk.lab('N', scr, w - 0.03, h - 0.03, [0, 0.004, 0.0155], null, 1.0);
    pk.box(0.012, 0.006, 0.004, M.ledBlue, [w / 2 - 0.03, -h / 2 + 0.008, 0.016]);
    return mg;
  }
  function keyboard(kk, x, y, z, rotY = 0) {
    kk.rb(0.42, 0.018, 0.14, 0.006, C.offWhite, [x, y + 0.009, z], [0.04, rotY, 0]);
    const cs = Math.cos(rotY), sn = Math.sin(rotY);
    for (let row = 0; row < 4; row++) for (let c = 0; c < 13; c++) {
      if (row === 3 && c > 3 && c < 9) continue;
      const lx = -0.186 + c * 0.031, lz = -0.045 + row * 0.03;
      kk.box(0.026, 0.008, 0.025, C.white, [x + lx * cs + lz * sn, y + 0.02 + row * 0.001, z - lx * sn + lz * cs], [0.04, rotY, 0]);
    }
    kk.box(0.15, 0.008, 0.025, C.white, [x + 0.0 * cs + 0.045 * sn, y + 0.023, z + 0.045 * cs], [0.04, rotY, 0]);
  }
  function deskPhone(kk, x, y, z, rotY = 0) {
    const pg = new THREE.Group(); pg.position.set(x, y, z); pg.rotation.y = rotY; kk.parent.add(pg); const pk = K(pg);
    pk.rb(0.2, 0.05, 0.2, 0.015, C.offWhite, [0, 0.025, 0]);
    pk.rb(0.2, 0.03, 0.12, 0.01, C.offWhite, [0, 0.06, 0.03], [-0.25, 0, 0]);
    for (let i = 0; i < 12; i++) pk.box(0.022, 0.008, 0.018, C.grey, [0.04 + (i % 3) * 0.028, 0.078 - Math.floor(i / 3) * 0.006, 0.075 - Math.floor(i / 3) * 0.022], [-0.25, 0, 0]);
    pk.box(0.06, 0.004, 0.03, M.screenDim, [-0.05, 0.078, 0.06], [-0.25, 0, 0]);
    // handset on the cradle
    pk.rb(0.07, 0.04, 0.2, 0.018, C.offWhite, [-0.055, 0.075, -0.035]);
    pk.rb(0.08, 0.045, 0.05, 0.02, C.offWhite, [-0.055, 0.08, -0.12]); pk.rb(0.08, 0.045, 0.05, 0.02, C.offWhite, [-0.055, 0.08, 0.05]);
    ctx.wires.add(ctx.geo.catenary(new THREE.Vector3(-0.09, 0.07, 0.07).applyMatrix4(worldOf(pg)), new THREE.Vector3(-0.1, 0.03, 0.1).applyMatrix4(worldOf(pg)), 0.03, 6), { width: 0.008, color: '#d8d4ca' });
    return pg;
  }
  function worldOf(o) { o.updateWorldMatrix(true, false); return o.matrixWorld; }
  function penCup(kk, x, y, z) {
    kk.cy(0.035, 0.1, C.navy, [x, y + 0.05, z], 12); kk.cy(0.03, 0.004, C.ink, [x, y + 0.1, z], 10);
    const pens = [C.blue, C.red, C.ink, C.yellow];
    pens.forEach((m, i) => { const p = kk.cy(0.005, 0.14, m, [x + Math.cos(i * 1.7) * 0.015, y + 0.12, z + Math.sin(i * 1.7) * 0.015], 6); p.rotation.set(Math.sin(i * 1.7) * 0.2, 0, -Math.cos(i * 1.7) * 0.2); });
  }
  function papers(kk, x, y, z, n = 5, rot = 0) {
    for (let i = 0; i < n; i++) kk.box(0.21, 0.003, 0.297, C.paper, [x + (r() - 0.5) * 0.01, y + 0.0015 + i * 0.003, z + (r() - 0.5) * 0.01], [0, rot + (r() - 0.5) * 0.08, 0]);
  }
  function mug(kk, x, y, z, m) {
    kk.cy(0.036, 0.085, m, [x, y + 0.0425, z], 12); kk.cy(0.03, 0.004, C.tea, [x, y + 0.083, z], 10);
    kk.torus(0.024, 0.006, m, [x + 0.04, y + 0.045, z], [0, 0, PI / 2], PI, 8);
  }
  function deskFan(kk, x, y, z, rotY) {
    const fg = new THREE.Group(); fg.position.set(x, y, z); fg.rotation.y = rotY; kk.parent.add(fg); const fk = K(fg);
    fk.cy(0.1, 0.03, C.white, [0, 0.015, 0], 16); fk.box(0.03, 0.012, 0.02, C.sky, [0.05, 0.034, 0.04]);
    fk.cy(0.016, 0.24, C.white, [0, 0.15, 0], 8);
    const hg = new THREE.Group(); hg.position.set(0, 0.3, 0); hg.rotation.x = 0.12; fg.add(hg); const hk = K(hg);
    hk.cz(0.055, 0.1, C.white, [0, 0, -0.04], 14);
    hk.torus(0.145, 0.005, C.greyLt, [0, 0, 0.06], null, PI * 2, 28); hk.torus(0.145, 0.005, C.greyLt, [0, 0, 0.0], null, PI * 2, 28);
    for (let i = 0; i < 8; i++) { const a = i * PI / 4; hk.box(0.004, 0.14, 0.004, C.greyLt, [Math.cos(a) * 0.072, Math.sin(a) * 0.072, 0.06], [0, 0, a + PI / 2]); }
    for (let i = 0; i < 3; i++) { const a = i * PI * 2 / 3 + 0.3; hk.box(0.05, 0.12, 0.004, C.sky, [Math.cos(a) * 0.06, Math.sin(a) * 0.06, 0.03], [0.25, 0, a - PI / 2]); }
    hk.cz(0.025, 0.02, C.sky, [0, 0, 0.065], 12);
    return fg;
  }
  function radio(kk, x, y, z, rotY) {
    const rg = new THREE.Group(); rg.position.set(x, y, z); rg.rotation.y = rotY; kk.parent.add(rg); const rk = K(rg);
    rk.rb(0.28, 0.15, 0.09, 0.015, M.ic('#c95a4a'), [0, 0.075, 0]);
    rk.box(0.12, 0.1, 0.004, C.dark, [-0.06, 0.075, 0.046]);
    for (let i = 0; i < 6; i++) rk.box(0.11, 0.006, 0.004, C.greyLt, [-0.06, 0.035 + i * 0.016, 0.049]);
    rk.lab('N', 'radioFace', 0.1, 0.033, [0.07, 0.1, 0.0455], null, 0.9);
    rk.cz(0.014, 0.018, C.cream, [0.045, 0.045, 0.052], 10); rk.cz(0.014, 0.018, C.cream, [0.1, 0.045, 0.052], 10);
    for (const s of [-1, 1]) rk.box(0.014, 0.04, 0.02, C.steel, [s * 0.11, 0.17, 0]);
    rk.box(0.24, 0.014, 0.02, C.steel, [0, 0.19, 0]);
    const ant = rk.cy(0.003, 0.36, C.steel, [0.12, 0.3, -0.03], 6); ant.rotation.z = -0.5;
    return rg;
  }
  function thermosPot(kk, x, y, z) {
    kk.cy(0.1, 0.02, C.dark, [x, y + 0.01, z], 16);
    kk.mesh(X.geo('pot', () => new THREE.CylinderGeometry(0.095, 0.1, 0.27, 18)), C.white, [x, y + 0.155, z]);
    kk.cy(0.1, 0.06, M.ic('#d9718f'), [x, y + 0.32, z], 18);
    kk.cy(0.04, 0.02, C.white, [x, y + 0.355, z], 12);
    kk.box(0.04, 0.03, 0.06, M.ic('#d9718f'), [x, y + 0.29, z + 0.1]);
    kk.box(0.05, 0.03, 0.01, M.screenDim, [x, y + 0.22, z + 0.098]);
    kk.torus(0.07, 0.01, C.dark, [x, y + 0.36, z], [0, PI / 2, 0], PI, 12);
  }
  function jugKettle(kk, x, y, z, rotY = 0) {
    kk.cy(0.09, 0.02, C.dark, [x, y + 0.01, z], 16);
    kk.mesh(X.geo('jug', () => new THREE.CylinderGeometry(0.075, 0.088, 0.2, 16)), C.steel, [x, y + 0.12, z]);
    kk.cy(0.07, 0.02, C.dark, [x, y + 0.23, z], 14);
    const hx = x - Math.cos(rotY) * 0.1, hz = z + Math.sin(rotY) * 0.1;
    kk.box(0.025, 0.17, 0.035, C.dark, [hx, y + 0.13, hz], [0, rotY, 0]);
    kk.box(0.045, 0.025, 0.035, C.steel, [x + Math.cos(rotY) * 0.085, y + 0.2, z - Math.sin(rotY) * 0.085], [0, rotY, -0.4]);
  }
  function lockers(x, z, rotY, n = 3, names = []) {
    const g = grp(x, FY, z, rotY); const kk = K(g);
    const w = 0.4, H = 1.8, D = 0.5, body = M.ic('#b9bec3');
    kk.box(n * w, 0.08, D - 0.04, C.dark, [0, 0.04, 0]);
    for (let i = 0; i < n; i++) {
      const lx = (i - (n - 1) / 2) * w;
      kk.box(w - 0.004, H - 0.08, D, body, [lx, 0.08 + (H - 0.08) / 2, 0]);
      kk.box(w - 0.04, H - 0.14, 0.012, M.ic('#c9cdd1'), [lx, 0.08 + (H - 0.08) / 2, D / 2 + 0.004]);
      for (const y0 of [1.55, 0.25]) for (let k = 0; k < 5; k++) kk.box(0.22, 0.01, 0.006, C.steelDk, [lx, y0 + k * 0.03, D / 2 + 0.012]);
      kk.box(0.02, 0.12, 0.03, C.steelDk, [lx + w / 2 - 0.06, 1.0, D / 2 + 0.02]);
      kk.box(0.1, 0.035, 0.004, C.paper, [lx, 1.42, D / 2 + 0.012]);
      if (names[i]) lab(g, 'N', names[i], 0.09, 0.03, [lx, 1.42, D / 2 + 0.0145], null, 0.9);
    }
    kk.box(n * w + 0.01, 0.02, D + 0.01, body, [0, H + 0.01, 0]);
    // a cardboard box and a helmet on top
    kk.box(0.4, 0.22, 0.3, M.ic('#c9a57a'), [-0.3, H + 0.13, 0]); kk.box(0.4, 0.004, 0.02, M.ic('#b88a5a'), [-0.3, H + 0.241, 0]);
    kk.mesh(X.geo('helmet', () => new THREE.SphereGeometry(0.13, 14, 7, 0, PI * 2, 0, PI / 2)), C.white, [0.3, H + 0.02, 0]); kk.box(0.2, 0.012, 0.1, C.white, [0.3, H + 0.026, 0.12]);
    P.addBox(x, z, n * w, D, rotY, -1, 3);
    return g;
  }
  function binderShelf(x, z, rotY, w = 0.9, o = {}) {
    const g = grp(x, FY, z, rotY); const kk = K(g);
    const H = 1.8, D = 0.35, frame = M.ic('#a9aeb4');
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) kk.box(0.03, H, 0.03, frame, [sx * (w / 2 - 0.015), H / 2, sz * (D / 2 - 0.015)]);
    const levels = [0.08, 0.5, 0.92, 1.34, 1.76];
    for (const y of levels) kk.box(w, 0.018, D, frame, [0, y, 0]);
    for (const sx of [-1, 1]) kk.box(0.006, 0.4, D - 0.04, frame, [sx * (w / 2 - 0.02), 0.3, 0]);
    const spines = A.atlases.N.r('spines');
    const cols = ['#3f6fb0', '#c9504a', '#3f8a5c', '#e2c05a', '#8e949b', '#ef9fbe', '#2f4068', '#ebe8e0'].map(h => M.ic(h));
    for (let s = 0; s < 4; s++) {
      const y = levels[s] + 0.009;
      let bx = -w / 2 + 0.04;
      const kind = (o.kinds || ['binder', 'binder', 'box', 'binder'])[s];
      while (bx < w / 2 - 0.1) {
        if (kind === 'box') { // box files + paper stacks
          if (r() < 0.3) { for (let i = 0; i < 4; i++) kk.box(0.21, 0.02, 0.28, C.paper, [bx + 0.12, y + 0.01 + i * 0.02, 0.01], [0, (r() - 0.5) * 0.1, 0]); bx += 0.26; continue; }
          const t = 0.09; kk.box(t, 0.32, 0.3, cols[Math.floor(r() * 4) + 4], [bx + t / 2, y + 0.16, 0.0]); kk.box(t * 0.7, 0.08, 0.004, C.paper, [bx + t / 2, y + 0.24, 0.151]); kk.cz(0.012, 0.006, C.ink, [bx + t / 2, y + 0.1, 0.151], 8); bx += t + 0.004; continue;
        }
        if (r() < 0.06) { bx += 0.05 + r() * 0.06; continue; }
        const t = 0.05 + r() * 0.03, m = cols[Math.floor(r() * cols.length)];
        const lean = (r() < 0.08) ? -0.14 : 0;
        const bgp = new THREE.Group(); bgp.position.set(bx + t / 2 + (lean ? 0.03 : 0), y, 0.005); bgp.rotation.z = lean; g.add(bgp); const bk = K(bgp);
        bk.box(t, 0.31, 0.28, m, [0, 0.155, 0]);
        // spine label (atlas cell) + finger hole
        const cell = Math.floor(r() * 8), u0 = spines.u0 + (spines.u1 - spines.u0) * cell / 8, u1 = spines.u0 + (spines.u1 - spines.u0) * (cell + 1) / 8;
        const lp = new THREE.Mesh(A.U.rectPlane(t * 0.7, 0.2, { u0, u1, v0: spines.v0, v1: spines.v1 }), A.signMat('N', 0.8)); lp.position.set(0, 0.19, 0.1415); bgp.add(lp);
        bk.cz(0.011, 0.004, C.ink, [0, 0.055, 0.141], 10);
        bx += t + 0.003 + (lean ? 0.06 : 0);
      }
    }
    // top level: rolled drawings + a document box
    kk.box(0.34, 0.25, 0.28, M.ic('#c9a57a'), [-w / 2 + 0.22, 1.77 + 0.125, 0]);
    for (let i = 0; i < 3; i++) kk.cx(0.035, 0.5, C.paper, [0.12, 1.805 + i * 0.001, -0.08 + i * 0.07], 10);
    P.addBox(x, z, w, D, rotY, -1, 3);
    return g;
  }
  function safe(x, z, rotY) {
    const g = grp(x, FY, z, rotY); const kk = K(g);
    kk.rb(0.42, 0.5, 0.42, 0.02, M.ic('#5a5e68'), [0, 0.25, 0]);
    kk.box(0.34, 0.4, 0.012, M.ic('#666a74'), [0, 0.26, 0.211]);
    kk.cz(0.045, 0.02, C.steel, [-0.06, 0.32, 0.222], 16); kk.box(0.008, 0.03, 0.012, C.ink, [-0.06, 0.35, 0.233]);
    kk.box(0.02, 0.1, 0.03, C.steel, [0.09, 0.28, 0.225]);
    kk.box(0.1, 0.03, 0.004, C.gold, [0, 0.12, 0.218]);
    P.addBox(x, z, 0.44, 0.44, rotY, -1, FY + 0.5);
    return { g, kk };
  }
  function copier(x, z, rotY) {
    const g = grp(x, FY, z, rotY); const kk = K(g);
    kk.box(0.6, 0.06, 0.55, C.dark, [0, 0.03, 0]);
    kk.rb(0.62, 0.62, 0.58, 0.02, C.offWhite, [0, 0.37, 0]);
    for (let i = 0; i < 3; i++) { kk.box(0.56, 0.14, 0.012, C.white, [0, 0.15 + i * 0.16, 0.292]); kk.box(0.18, 0.02, 0.02, C.grey, [0, 0.19 + i * 0.16, 0.302]); }
    kk.rb(0.64, 0.14, 0.58, 0.02, C.white, [0, 0.75, 0]);
    kk.box(0.52, 0.02, 0.2, C.greyLt, [0, 0.83, 0.1]); kk.box(0.52, 0.03, 0.38, C.white, [0, 0.845, -0.08]);
    kk.rb(0.24, 0.05, 0.1, 0.01, C.dark, [0.16, 0.86, 0.27], [-0.3, 0, 0]); kk.box(0.1, 0.004, 0.06, M.screenDim, [0.12, 0.886, 0.285], [-0.3, 0, 0]);
    kk.box(0.4, 0.012, 0.2, C.paper, [0, 0.7, 0.18]);
    P.addBox(x, z, 0.64, 0.6, rotY, -1, 3);
    return g;
  }
  function filingCabinet(x, z, rotY, h = 1.32) {
    const g = grp(x, FY, z, rotY); const kk = K(g);
    const body = M.ic('#b0b5bb'); kk.box(0.46, h, 0.62, body, [0, h / 2, 0]);
    const n = 4; for (let i = 0; i < n; i++) { const y = 0.05 + (i + 0.5) * (h - 0.08) / n; kk.box(0.42, (h - 0.08) / n - 0.02, 0.012, M.ic('#c3c7cc'), [0, y, 0.316]); kk.box(0.16, 0.025, 0.022, C.steelDk, [0, y + 0.06, 0.33]); kk.box(0.07, 0.03, 0.004, C.paper, [0, y + 0.1, 0.323]); }
    P.addBox(x, z, 0.48, 0.64, rotY, -1, 3);
    return { g, kk, top: h };
  }

  // ================================================================ 1. window counter desk (south wall) + staff chair
  {
    const { g, kk } = desk(3.82, -29.74, PI, 1.85, 0.62);  // faces north (toward the seated clerk)
    const y = 0.74;
    // ticket terminal (screen faces the clerk) + receipt printer + customer display facing the window
    monitor(g, 0.35, y, 0.05, 0, 'termScr', { w: 0.42, h: 0.27 });
    kk.rb(0.3, 0.12, 0.28, 0.02, C.offWhite, [-0.2, y + 0.06, -0.05]); kk.box(0.22, 0.012, 0.04, C.ink, [-0.2, y + 0.12, 0.07]); kk.box(0.18, 0.004, 0.12, C.paper, [-0.2, y + 0.125, 0.14], [-0.4, 0, 0]);
    { const cg = new THREE.Group(); cg.position.set(-0.55, y, -0.18); cg.rotation.y = PI; g.add(cg); const ck = K(cg); ck.box(0.05, 0.14, 0.04, plastic, [0, 0.07, 0]); ck.rb(0.2, 0.12, 0.03, 0.008, plastic, [0, 0.19, 0], [-0.15, 0, 0]); ck.lab('N', 'custScr', 0.17, 0.085, [0, 0.19, 0.0165], [-0.15, 0, 0], 1.0); }
    keyboard(kk, 0.35, y, 0.2);
    kk.rb(0.06, 0.03, 0.1, 0.012, C.offWhite, [0.65, y + 0.015, 0.2]);
    penCup(kk, 0.75, y, -0.05);
    papers(kk, -0.62, y, 0.12, 4, 0.2);
    // rubber stamps on a little rack + stamp pad, calculator
    kk.box(0.2, 0.02, 0.08, C.woodDk, [-0.35, y + 0.01, 0.2]); for (let i = 0; i < 4; i++) { kk.cy(0.012, 0.07, i % 2 ? C.red : C.dark, [-0.42 + i * 0.045, y + 0.055, 0.2], 8); }
    kk.rb(0.1, 0.02, 0.07, 0.006, C.ink, [-0.12, y + 0.01, 0.23]);
    kk.rb(0.1, 0.015, 0.16, 0.006, C.dark, [0.0, y + 0.0075, 0.24], [0.08, 0.3, 0]); kk.box(0.07, 0.004, 0.03, M.screenDim, [-0.005, y + 0.018, 0.195], [0.08, 0.3, 0]);
    mug(kk, 0.85, y, 0.2, M.ic('#8fd1c1'));
    chair(3.95, -30.45, 0.05);
    // intercom microphone to the window grille
    kk.box(0.1, 0.02, 0.08, C.dark, [0.0, y + 0.01, -0.2]);
    const mic = new THREE.Group(); mic.position.set(0.0, y + 0.02, -0.2); g.add(mic); const mk = K(mic);
    for (let i = 0; i < 5; i++) { const a = i * 0.25; mk.cy(0.007, 0.06, C.dark, [0, 0.03 + i * 0.055, -Math.sin(a) * 0.04 * i], 6).rotation.x = -a; }
    mk.cy(0.014, 0.05, C.dark, [0, 0.3, -0.2], 8).rotation.x = -1.2;
  }

  // ================================================================ 2. platform-window desk (north wall): PC, CCTV, PA mic, radio, fan
  {
    const { g, kk } = desk(2.3, -34.95, 0, 1.8, 0.68);
    const y = 0.74;
    monitor(g, -0.35, y, -0.12, 0.2, 'pcScr');
    monitor(g, 0.32, y, -0.14, -0.25, 'cctvScr', { w: 0.44, h: 0.28 });
    keyboard(kk, -0.3, y, 0.12, 0.2);
    kk.rb(0.06, 0.03, 0.1, 0.012, C.offWhite, [0.0, y + 0.015, 0.16]);
    deskPhone(kk, 0.66, y, 0.08, -0.3);
    radio(kk, -0.7, y, -0.18, 0.15);
    penCup(kk, 0.1, y, -0.22);
    papers(kk, 0.35, y, 0.14, 6, -0.25);
    // PA microphone (放送卓) on its base
    kk.rb(0.16, 0.04, 0.12, 0.01, C.dark, [-0.72, y + 0.02, 0.12]); kk.box(0.03, 0.01, 0.02, M.ledRed, [-0.68, y + 0.042, 0.15]);
    const pm = kk.cy(0.006, 0.22, C.dark, [-0.74, y + 0.15, 0.1], 6); pm.rotation.x = -0.35;
    kk.cy(0.018, 0.06, C.dark, [-0.74, y + 0.26, 0.06], 10).rotation.x = -0.9;
    mug(kk, 0.55, y, -0.2, M.ic('#ef9fbe'));
    chair(2.25, -34.2, PI + 0.15);
    // desk fan on the floor beside the desk + small bin
    { const fg = grp(3.55, FY, -34.55, -0.7); const fk = K(fg); fk.cy(0.14, 0.03, C.white, [0, 0.015, 0], 16); deskFan(fk, 0, 0.0, 0, 0).scale.set(1.35, 1.9, 1.35); }
    { const bg = grp(1.22, FY, -34.35, 0); const bk = K(bg); bk.mesh(X.geo('wbin', () => new THREE.CylinderGeometry(0.13, 0.11, 0.32, 16)), M.ic('#9aa0a6'), [0, 0.16, 0]); bk.cy(0.118, 0.004, C.ink, [0, 0.321, 0], 14); bk.torus(0.13, 0.008, C.greyLt, [0, 0.32, 0], [PI / 2, 0, 0], PI * 2, 16); for (let i = 0; i < 3; i++) bk.sphere(0.04, C.paper, [(r() - 0.5) * 0.1, 0.2 + i * 0.03, (r() - 0.5) * 0.1], 6); P.addCylinder(1.22, -34.35, 0.16, -1, FY + 0.4); }
  }

  // ================================================================ 3. west wall: binder shelving, safe, clipboards, calendar, wall AC
  binderShelf(OX0 + 0.18, -33.45, PI / 2, 0.9);
  binderShelf(OX0 + 0.18, -32.53, PI / 2, 0.9, { kinds: ['box', 'binder', 'binder', 'binder'] });
  { const { g, kk } = safe(OX0 + 0.22, -31.55, PI / 2); void g; kk.box(0.3, 0.08, 0.22, M.ic('#c9a57a'), [0, 0.54, 0]); }
  {
    const g = grp(OX0, FY, -30.6, PI / 2); const kk = K(g);
    kk.box(0.9, 0.05, 0.02, C.woodDk, [0, 1.9, 0.01]);
    X.clipboard(g, -0.3, 1.66, 0.018, 'clipPaper', 0.03);
    X.clipboard(g, 0.02, 1.66, 0.018, 'clipPaper2', -0.02);
    X.clipboard(g, 0.32, 1.64, 0.018, 'clipPaper', 0.05);
    for (const x of [-0.3, 0.02, 0.32]) kk.cz(0.006, 0.03, C.steel, [x, 1.85, 0.02], 6);
    sheet(g, 'B', 'calendar', 0.3, 0.4, [0.0, 2.3, 0.012], 0.01, { curl: 0.008 });
    kk.cz(0.005, 0.02, C.steel, [0.0, 2.49, 0.015], 6);
  }
  { // wall-mounted split air conditioner, high on the west wall
    const g = grp(OX0, FY + 2.55, -33.0, PI / 2); const kk = K(g);
    kk.rb(0.82, 0.28, 0.22, 0.04, C.white, [0, 0, 0.11], null, 2);
    kk.box(0.72, 0.05, 0.02, C.dark, [0, -0.11, 0.19], [0.5, 0, 0]);
    kk.box(0.7, 0.012, 0.03, C.offWhite, [0, -0.12, 0.2], [0.9, 0, 0]);
    kk.box(0.03, 0.012, 0.004, M.ledGreen, [0.3, -0.06, 0.221]);
  }
  // south wall inside (x 0.6..2.9): copier + filing cabinet with things on top
  copier(1.05, -29.72, PI);
  { const { kk, top } = filingCabinet(1.85, -29.74, PI); papers(kk, 0, top, 0, 3, 0.1); kk.box(0.3, 0.12, 0.22, M.ic('#c9a57a'), [0.02, top + 0.06 + 0.009, 0.05]); }

  // ================================================================ 4. east wall: lockers, tea corner under the whiteboard, key cabinet, coat hooks + cap
  lockers(OX1 - 0.25, -34.2, -PI / 2, 3, ['lockerA', 'lockerB', 'lockerC']);
  {
    const g = grp(OX1 - 0.225, FY, -32.9, -PI / 2); const kk = K(g);
    kk.box(0.9, 0.8, 0.45, M.ic('#d8d2c2'), [0, 0.4, 0]); kk.rb(0.94, 0.03, 0.48, 0.008, laminate, [0, 0.815, 0.01]);
    for (const s of [-1, 1]) { kk.box(0.43, 0.7, 0.012, M.ic('#e4dfd2'), [s * 0.222, 0.42, 0.228]); kk.box(0.015, 0.1, 0.02, C.steelDk, [s * 0.03, 0.5, 0.24]); }
    kk.box(0.88, 0.05, 0.43, C.dark, [0, 0.025, -0.005]);
    const y = 0.83;
    thermosPot(kk, -0.28, y, -0.02);
    jugKettle(kk, 0.02, y, -0.06, 0.4);
    kk.rb(0.32, 0.014, 0.22, 0.006, C.woodLt, [0.27, y + 0.007, 0.06]);
    [M.ic('#8fd1c1'), C.white, M.ic('#e8914a'), C.navy].forEach((m, i) => { const cx = 0.19 + (i % 2) * 0.1, cz = 0.02 + Math.floor(i / 2) * 0.09; kk.cy(0.032, 0.07, m, [cx, y + 0.014 + 0.035, cz], 12); kk.cy(0.027, 0.004, i < 2 ? C.tea : C.ink, [cx, y + 0.084, cz], 10); });
    kk.cy(0.04, 0.12, C.greenDk, [0.33, y + 0.06, -0.12], 12); kk.cy(0.042, 0.03, C.greenDk, [0.33, y + 0.135, -0.12], 12); // tea caddy
    kk.cy(0.035, 0.09, M.ic('#6e5140'), [0.42, y + 0.045, 0.1], 10); kk.cy(0.036, 0.02, C.red, [0.42, y + 0.1, 0.1], 10); // coffee jar
    P.addBox(OX1 - 0.225, -32.9, 0.94, 0.48, -PI / 2, -1, 2);
    // whiteboard with marker tray + magnets + a pinned paper
    const wb = grp(OX1, FY + 1.68, -32.9, -PI / 2); const wk = K(wb);
    wk.box(1.1, 0.72, 0.015, C.paper, [0, 0, 0.0075]);
    wk.lab('B', 'officeBoard', 1.04, 0.68, [0, 0, 0.0155], null, 0.85);
    for (const [w, h, x, yy] of [[1.14, 0.025, 0, 0.3725], [1.14, 0.025, 0, -0.3725], [0.025, 0.72, -0.5575, 0], [0.025, 0.72, 0.5575, 0]]) wk.box(w, h, 0.025, C.steel, [x, yy, 0.0125]);
    wk.box(0.6, 0.02, 0.05, C.steel, [0.1, -0.385, 0.03]);
    [C.blue, C.red, C.ink].forEach((m, i) => wk.cx(0.008, 0.12, m, [-0.05 + i * 0.13, -0.368, 0.035], 8));
    wk.rb(0.1, 0.03, 0.04, 0.008, C.navy, [0.3, -0.36, 0.035]);
    sheet(wb, 'N', 'nDaiya', 0.18, 0.25, [0.4, 0.12, 0.017], -0.04, { curl: 0.006 });
    wk.cz(0.012, 0.01, C.red, [0.4, 0.23, 0.024], 10); wk.cz(0.012, 0.01, C.blue, [-0.33, 0.2, 0.02], 10); wk.cz(0.012, 0.01, C.yellow, [-0.2, -0.18, 0.02], 10);
  }
  { // key cabinet (door open, keys + tags on hooks)
    const g = grp(OX1, FY + 1.75, -32.05, -PI / 2); const kk = K(g);
    const w = 0.36, h = 0.46, d = 0.08;
    kk.box(w, h, 0.01, M.ic('#b9bec3'), [0, 0, 0.005]);
    kk.box(w, 0.012, d, M.ic('#b9bec3'), [0, h / 2 - 0.006, d / 2]); kk.box(w, 0.012, d, M.ic('#b9bec3'), [0, -h / 2 + 0.006, d / 2]);
    kk.box(0.012, h, d, M.ic('#b9bec3'), [-w / 2 + 0.006, 0, d / 2]); kk.box(0.012, h, d, M.ic('#b9bec3'), [w / 2 - 0.006, 0, d / 2]);
    const tags = [C.red, C.blue, C.yellow, C.green, C.white];
    for (let row = 0; row < 4; row++) for (let c = 0; c < 5; c++) {
      const hx = -0.13 + c * 0.065, hy = 0.17 - row * 0.105;
      kk.cz(0.004, 0.03, C.steel, [hx, hy, 0.025], 6);
      if (r() < 0.8) { kk.box(0.012, 0.035, 0.004, C.gold, [hx, hy - 0.025, 0.036]); kk.rb(0.028, 0.045, 0.005, 0.006, tags[(row + c) % 5], [hx, hy - 0.065, 0.034]); }
    }
    // open door hinged on the right edge, swung ~110°
    const dg = new THREE.Group(); dg.position.set(-w / 2, 0, d); dg.rotation.y = -1.25; g.add(dg); const dk = K(dg);
    dk.box(w, h, 0.012, M.ic('#c3c8cc'), [w / 2, 0, 0.006]); dk.box(0.02, 0.05, 0.02, C.steelDk, [w - 0.04, 0, 0.02]);
    dk.lab('N', 'keyLabel', 0.12, 0.03, [w / 2, 0.16, 0.0125], null, 0.9);
  }
  { // coat hook rail: uniform jacket on a hanger + the uniform cap
    const g = grp(OX1, FY + 1.9, -31.35, -PI / 2); const kk = K(g);
    kk.rb(0.72, 0.08, 0.02, 0.006, C.wood, [0, 0, 0.01]);
    for (const x of [-0.25, 0.0, 0.25]) { kk.cz(0.008, 0.07, C.steel, [x, 0, 0.055], 6); kk.cy(0.008, 0.04, C.steel, [x, 0.02, 0.09], 6); }
    // jacket on a hanger (hangs from the middle hook)
    const jk = new THREE.Group(); jk.position.set(0.0, 0.04, 0.1); g.add(jk); const jj = K(jk);
    jj.torus(0.02, 0.004, C.steel, [0, 0.0, 0], [PI / 2, 0, 0], PI * 2, 10);
    jj.box(0.42, 0.018, 0.02, C.woodLt, [0, -0.05, 0], [0, 0, 0]);
    jj.rb(0.46, 0.2, 0.12, 0.05, C.navy, [0, -0.15, 0], null, 2);
    jj.rb(0.42, 0.52, 0.1, 0.04, C.navy, [0, -0.46, 0.005], null, 2);
    for (const s of [-1, 1]) jj.rb(0.1, 0.56, 0.1, 0.04, C.navy, [s * 0.25, -0.38, 0], [0, 0, s * 0.06], 2);
    jj.box(0.012, 0.5, 0.004, C.ink, [0, -0.45, 0.056]);
    for (let i = 0; i < 4; i++) jj.sphere(0.009, C.gold, [0.035, -0.28 - i * 0.1, 0.057], 6);
    jj.box(0.14, 0.05, 0.02, C.navy, [0, -0.06, 0.05], [0.4, 0, 0]);
    jj.box(0.06, 0.02, 0.004, C.gold, [-0.12, -0.2, 0.056]);
    // uniform cap on the left hook
    const cp = new THREE.Group(); cp.position.set(-0.25, -0.04, 0.12); cp.rotation.set(0.35, 0.2, 0.1); g.add(cp); const ck = K(cp);
    ck.mesh(X.geo('capCrown', () => new THREE.CylinderGeometry(0.125, 0.105, 0.075, 20)), C.navy, [0, 0.07, 0]);
    ck.cy(0.126, 0.012, C.navy, [0, 0.11, 0], 20);
    ck.cy(0.107, 0.035, C.ink, [0, 0.02, 0], 20);
    ck.cy(0.108, 0.006, C.gold, [0, 0.04, 0], 20);
    ck.mesh(X.geo('visor', () => new THREE.CylinderGeometry(0.105, 0.105, 0.008, 16, 1, false, -PI / 2, PI)), C.ink, [0, 0.0, 0.03], [0.3, 0, 0]);
    ck.cz(0.018, 0.006, C.gold, [0, 0.055, 0.108], 12);
    // a second cap sits on the right hook's shelf? a towel instead
    kk.box(0.16, 0.3, 0.012, C.white, [0.25, -0.16, 0.1]);
  }
  // broom + dustpan in the corner by the booth door
  { const g = grp(OX1 - 0.12, FY, -31.05, 0); const kk = K(g); const st = kk.cy(0.012, 1.2, C.woodLt, [0, 0.62, 0], 6); st.rotation.x = 0.12; kk.box(0.26, 0.12, 0.06, M.ic('#c9a07a'), [0, 0.06, -0.07]); kk.box(0.24, 0.02, 0.2, M.ic('#4f8f5f'), [-0.28, 0.01, 0.05]); kk.box(0.24, 0.1, 0.012, M.ic('#4f8f5f'), [-0.28, 0.05, -0.05]); kk.cy(0.01, 0.8, M.ic('#4f8f5f'), [-0.28, 0.45, -0.05], 6); }

  // ================================================================ 5. north wall: flags + hand lamp by the platform door, clock, door inside
  {
    const g = grp(3.55, FY, OZ0, 0); const kk = K(g);
    // flag holder (two rolled signal flags)
    kk.box(0.16, 0.06, 0.08, C.dark, [0, 1.3, 0.04]);
    for (const [dx, m] of [[-0.035, C.red], [0.035, C.green]]) { kk.cy(0.008, 0.62, C.woodLt, [dx, 1.5, 0.05], 6); kk.cy(0.02, 0.3, m, [dx, 1.62, 0.05], 8); }
    kk.lab('N', 'flagLabel', 0.1, 0.027, [0, 1.3, 0.0805], null, 0.9);
    // hand lamp (合図灯) on its charger shelf
    kk.box(0.24, 0.02, 0.16, C.dark, [0, 0.95, 0.08]); kk.box(0.2, 0.06, 0.12, C.dark, [0, 0.99, 0.08]);
    kk.box(0.04, 0.012, 0.004, M.ledGreen, [0.06, 1.0, 0.141]);
    kk.cy(0.035, 0.18, C.dark, [-0.02, 1.11, 0.08], 12); kk.cz(0.036, 0.02, M.ic('#e8e2c8'), [-0.02, 1.17, 0.115], 12); kk.box(0.02, 0.08, 0.03, C.dark, [-0.02, 1.22, 0.06]);
  }
  A.clock([2.3, FY + 2.7, OZ0 + 0.03], 0, 0.15, { frame: C.dark });
  // inner face of the platform-side steel door (x 3.9..4.8) + frame, lever, closer, notice
  {
    const g = grp(4.35, FY, OZ0, 0); const kk = K(g);
    kk.box(0.88, 1.99, 0.07, M.ic('#9fa6ae'), [0, 1.0, -0.08]);
    for (const s of [-1, 1]) kk.box(0.06, 2.06, 0.05, C.steelDk, [s * 0.47, 1.03, 0.01]);
    kk.box(1.0, 0.06, 0.05, C.steelDk, [0, 2.03, 0.01]);
    kk.box(0.12, 0.03, 0.03, C.steel, [0.3, 1.0, 0.0]); kk.box(0.04, 0.1, 0.02, C.steel, [0.35, 1.0, -0.01]);
    kk.box(0.3, 0.05, 0.05, C.steelDk, [-0.25, 1.94, 0.02]); kk.box(0.25, 0.02, 0.02, C.steel, [-0.1, 1.94, 0.055], [0, 0.4, 0]);
    sheet(g, 'N', 'clipPaper', 0.2, 0.27, [0, 1.5, -0.043], 0.0, { curl: 0.006 });
    kk.cz(0.008, 0.01, C.red, [0, 1.62, -0.038], 8);
  }
  // potted plant on the platform-window sill
  X.pottedPlant(1.6, -35.255, { y: FY + 0.95, potR: 0.05, potH: 0.09, r: 0.11, h: 0.18, seed: 21, shrubKind: 'young', col: false, saucer: false });
  // ceiling: smoke detector + fixtures are laid out by interior.js

  // ================================================================ 改札ラッチ booth: counter props
  {
    const top = FY + 1.09;
    const g = grp(6.0, top, -30.0, 0); const kk = K(g);
    // ticket collection box with slot (south counter), date stamper, pen stand, bell
    kk.rb(0.2, 0.14, 0.14, 0.01, C.woodDk, [0.45, 0.07, 0.4]); kk.box(0.1, 0.006, 0.012, C.ink, [0.45, 0.143, 0.4]);
    kk.lab('N', 'lbTicket', 0.18, 0.028, [0.45, 0.07, 0.4705], null, 0.9);
    kk.rb(0.08, 0.05, 0.06, 0.01, C.dark, [0.5, 0.025, 0.15]); kk.cy(0.012, 0.06, C.dark, [0.5, 0.08, 0.15], 8); kk.sphere(0.02, C.red, [0.5, 0.12, 0.15], 8);
    penCup(kk, 0.2, 0.0, -0.78);
    // mini monitor facing the staff, phone, clipboard, cup on the north counter
    monitor(g, 0.46, 0.0, -0.18, -PI / 2, 'custScr', { w: 0.24, h: 0.14 });
    deskPhone(kk, -0.35, 0.0, -0.83, 0.1);
    papers(kk, -0.1, 0.0, 0.84, 3, PI / 2);
    mug(kk, 0.5, 0.0, -0.1, M.ic('#9cc4ea'));
  }
}
