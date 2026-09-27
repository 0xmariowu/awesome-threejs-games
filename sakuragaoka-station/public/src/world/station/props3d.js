// Modelled interior props for 桜ヶ丘駅 — real geometry for every object (textures only for genuine flat
// graphics: screens, printed labels, notices). Each factory builds a Group at world (x, y, z) facing
// local +Z (rotY like three.js) under A.root, so the core batcher merges everything by material.
// Colliders are added here for floor-standing furniture (callers pass { col: false } to skip).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeShrub, makeTopiary } from '../lib/foliage.js';
import { B } from './building.js';

export function createProps(A) {
  const { ctx, M, U, P } = A;
  const PI = Math.PI, FY = B.FY;
  const ic = M.ic;
  const gcache = new Map();
  const geo = (key, make) => { if (!gcache.has(key)) gcache.set(key, make()); return gcache.get(key); };

  // ---------------------------------------------------------------- palette (all share the warm signature => baked & merged)
  const C = {
    white: ic('#ebe8e0'), offWhite: ic('#ddd8cb'), cream: ic('#efe5cf'), paper: ic('#f1eee6', 0.01),
    steel: ic('#bfc5ca', 0.02), steelDk: ic('#7b828a', 0.02), dark: ic('#4c4d57', 0.02), ink: ic('#3a3346', 0.0), black: ic('#403e49', 0.02),
    red: ic('#cc4a42'), redDk: ic('#a83a36'), orange: ic('#e8914a'), yellow: ic('#e8c24a'), green: ic('#4f8f5f'), greenDk: ic('#3e6b52'),
    blue: ic('#3f6fb0'), navy: ic('#2f4068'), sky: ic('#9cc4ea'), pink: ic('#ef9fbe'), pinkDk: ic('#d9718f'),
    wood: ic('#a67a52'), woodDk: ic('#6e5140'), woodLt: ic('#c9a57a'), rubber: ic('#57555c', 0.03), gold: ic('#d6b04a', 0.02),
    grey: ic('#9aa0a6'), greyLt: ic('#c9ccd0'), beige: ic('#d9cdb4'), tea: ic('#8a6a3a', 0.0), soil: ic('#6e5a48', 0.06),
  };
  const PIN = [C.red, C.blue, C.yellow, C.green, C.white, C.pink];

  // ---------------------------------------------------------------- basic helpers
  function grp(x, y, z, rotY = 0, parent = A.root) { const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rotY; parent.add(g); return g; }
  /** kit for a group + extras: rb (cached rounded box), cz / cx (cylinders along z / x), lab (atlas label plane) */
  function K(g) {
    const kk = ctx.kit(g);
    kk.rb = (w, h, d, r, m, pos, rot, seg = 1) => kk.mesh(geo(`rb|${w}|${h}|${d}|${r}|${seg}`, () => new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2, h / 2, d / 2))), m, pos, rot);
    kk.cz = (r, len, m, pos, seg = 10, rot = null) => kk.mesh(U.cylZ(seg), m, pos, rot, [r * 2, r * 2, len]);
    kk.cx = (r, len, m, pos, seg = 10) => kk.mesh(U.cylZ(seg), m, pos, [0, PI / 2, 0], [r * 2, r * 2, len]);
    kk.cy = (r, h, m, pos, seg = 12) => kk.mesh(U.cyl(seg), m, pos, null, [r * 2, h, r * 2]);
    kk.lab = (atlas, id, w, h, pos, rot = null, lit = 0.85) => lab(g, atlas, id, w, h, pos, rot, lit);
    kk.torus = (R, r, m, pos, rot, arc = PI * 2, seg = 20) => kk.mesh(geo(`tor|${R}|${r}|${arc}|${seg}`, () => new THREE.TorusGeometry(R, r, 6, seg, arc)), m, pos, rot);
    return kk;
  }
  function lab(g, atlas, id, w, h, pos, rot = null, lit = 0.85) {
    const a = A.atlases[atlas];
    const m = new THREE.Mesh(U.rectPlane(w, h, a.r(id)), A.signMat(atlas, lit));
    m.position.set(pos[0], pos[1], pos[2]); if (rot) m.rotation.set(rot[0] || 0, rot[1] || 0, rot[2] || 0);
    m.receiveShadow = true; m.castShadow = false; g.add(m); return m;
  }
  /** a paper sheet whose lower edge / corner curls off the board (atlas UVs) */
  function sheetGeo(w, h, r, curl = 0.012, corner = 0.0) {
    const g = new THREE.PlaneGeometry(w, h, 3, 6);
    const p = g.attributes.position, uv = g.attributes.uv;
    for (let i = 0; i < p.count; i++) {
      const u = uv.getX(i), v = uv.getY(i);
      const t = Math.max(0, 0.42 - v) / 0.42, c = Math.max(0, u - 0.55) / 0.45;
      p.setZ(i, curl * t * t + corner * c * c * t);
      uv.setXY(i, r.u0 + u * (r.u1 - r.u0), r.v0 + v * (r.v1 - r.v0));
    }
    g.computeVertexNormals();
    return g;
  }
  function sheet(g, atlas, id, w, h, pos, rotZ = 0, o = {}) {
    const a = A.atlases[atlas];
    const m = new THREE.Mesh(sheetGeo(w, h, a.r(id), o.curl ?? 0.012, o.corner ?? 0), A.signMat(atlas, o.lit ?? 0.82));
    m.position.set(pos[0], pos[1], pos[2]); m.rotation.set(o.rx || 0, o.ry || 0, rotZ); m.receiveShadow = true; m.castShadow = false; g.add(m);
    return m;
  }
  const col = (x, z, w, d, rotY = 0, h = 2.2) => P.addBox(x, z, w, d, rotY, -1, FY + h);
  /** merge many small (geometry, matrix) pieces into one static mesh */
  function merged(parts, mat) {
    if (!parts.length) return null;
    const gs = parts.map(([gg, m]) => { const c = gg.clone(); c.applyMatrix4(m); if (c.index) return c.toNonIndexed(); return c; });
    for (const c of gs) { for (const k of Object.keys(c.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') c.deleteAttribute(k); }
    const mg = mergeGeometries(gs, false);
    const mesh = new THREE.Mesh(mg, mat); mesh.castShadow = false; mesh.receiveShadow = true;
    return mesh;
  }
  const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
  const mtx = (pos, rot = [0, 0, 0], scl = [1, 1, 1]) => new THREE.Matrix4().compose(_p.set(...pos), _q.setFromEuler(_e.set(rot[0], rot[1], rot[2])), _s.set(...scl));

  // ================================================================ ceiling fittings
  const fixGeo = (len) => geo('fix' + len, () => { const g = ctx.geo.extrude([[-0.11, 0], [0.11, 0], [0.045, -0.07], [-0.045, -0.07]], len); g.rotateY(PI / 2); return g; });
  /** 逆富士 surface fluorescent fixture (length along local x). */
  function fixture(x, z, o = {}) {
    const len = o.len ?? 1.25, y = o.y ?? B.CEIL;
    const g = grp(x, y, z, o.rot || 0); const kk = K(g);
    kk.mesh(fixGeo(len), M.fixtureBody, [0, 0, 0]);
    for (const s of [-1, 1]) kk.box(0.03, 0.075, 0.09, M.fixtureBody, [s * (len / 2 - 0.02), -0.105, 0]);
    const n = o.tubes ?? 1;
    for (let i = 0; i < n; i++) { const t = kk.cx(0.0145, len - 0.1, o.tube || M.tubeLit, [0, -0.108, n === 1 ? 0 : (i - 0.5) * 0.075], 10); t.castShadow = false; }
    return g;
  }
  /** soft pool of light on the floor (additive-looking warm lift). */
  function pool(x, z, rx, rz, o = {}) {
    const m = new THREE.Mesh(ctx.geo.G.plane(), o.mat || M.pool);
    m.position.set(x, o.y ?? FY + 0.019, z); m.rotation.set(-PI / 2, 0, o.rot || 0); m.scale.set(rx * 2, rz * 2, 1);
    m.castShadow = false; m.receiveShadow = false; m.renderOrder = 3; A.root.add(m); ctx.noOutline(m);
    return m;
  }
  /** wall glow (vertical pool) facing local +z */
  function wallGlow(x, y, z, rotY, rx, ry) {
    const m = new THREE.Mesh(ctx.geo.G.plane(), M.poolWall);
    m.position.set(x, y, z); m.rotation.y = rotY; m.scale.set(rx * 2, ry * 2, 1); m.castShadow = false; m.renderOrder = 3; A.root.add(m); ctx.noOutline(m); return m;
  }
  /** 4-way ceiling cassette air conditioner */
  function cassette(x, z, rot = 0) {
    const g = grp(x, B.CEIL, z, rot); const kk = K(g);
    kk.rb(0.9, 0.035, 0.9, 0.012, C.white, [0, -0.0175, 0]);
    for (let i = 0; i < 4; i++) {
      const a = i * PI / 2, s = Math.sin(a), c = Math.cos(a);
      const sg = new THREE.Group(); sg.position.set(s * 0.345, 0, c * 0.345); sg.rotation.y = a; g.add(sg);
      const sk = K(sg);
      sk.box(0.6, 0.006, 0.075, C.dark, [0, -0.037, 0]);
      sk.box(0.58, 0.006, 0.062, C.offWhite, [0, -0.044, 0.004], [0.35, 0, 0]);
    }
    kk.box(0.52, 0.006, 0.52, C.offWhite, [0, -0.038, 0]);
    for (let i = -3; i <= 3; i++) kk.box(0.5, 0.004, 0.008, C.greyLt, [0, -0.042, i * 0.07]);
    kk.box(0.1, 0.008, 0.04, M.ledGreen, [0.3, -0.037, 0.3]).castShadow = false;
    return g;
  }
  function smokeDetector(x, z) { const g = grp(x, B.CEIL, z); const kk = K(g); kk.cy(0.06, 0.028, C.white, [0, -0.014, 0], 14); kk.cy(0.038, 0.016, C.offWhite, [0, -0.034, 0], 12); kk.box(0.012, 0.006, 0.012, M.ledRed, [0.03, -0.029, 0]); return g; }
  function ceilSpeaker(x, z) { const g = grp(x, B.CEIL, z); const kk = K(g); kk.cy(0.13, 0.02, C.white, [0, -0.01, 0], 18); kk.cy(0.105, 0.006, C.grey, [0, -0.022, 0], 18); for (const r of [0.08, 0.055, 0.03]) kk.cy(r, 0.004, C.steelDk, [0, -0.026, 0], 16); return g; }
  function cctvDome(x, z) {
    const g = grp(x, B.CEIL, z); const kk = K(g);
    kk.cy(0.09, 0.035, C.white, [0, -0.0175, 0], 16);
    kk.mesh(geo('dome', () => new THREE.SphereGeometry(0.07, 14, 7, 0, PI * 2, PI / 2, PI / 2)), M.smoked, [0, -0.035, 0]);
    kk.cy(0.074, 0.012, C.offWhite, [0, -0.038, 0], 16);
    return g;
  }
  /** 避難口誘導灯 (lit green exit sign) mounted on a wall face (local +z out of the wall) */
  function exitSign(x, y, z, rotY) {
    const g = grp(x, y, z, rotY); const kk = K(g);
    kk.rb(0.42, 0.17, 0.07, 0.01, C.white, [0, 0, 0.035]);
    kk.lab('N', 'exitGreen', 0.37, 0.14, [0, 0, 0.0715], null, 1.05);
    return g;
  }

  // ================================================================ floor: doormat, tactile paving
  function doormat(x, z, w, d, rotY = 0) {
    const g = grp(x, FY, z, rotY); const kk = K(g);
    kk.rb(w, 0.014, d, 0.006, C.rubber, [0, 0.007, 0]);
    const n = Math.floor((d - 0.08) / 0.045);
    for (let i = 0; i < n; i++) kk.box(w - 0.1, 0.006, 0.022, i % 4 === 1 ? C.greenDk : C.dark, [0, 0.016, -d / 2 + 0.06 + i * 0.045]);
    return g;
  }
  /** raised tactile blocks: kind 'line' (4 bars along the run) or 'dot' (5×5 domes). a,b = [x,z] run ends (axis aligned). */
  const tactParts = [];
  const barGeo = geo('tbar', () => new RoundedBoxGeometry(1, 1, 1, 1, 0.3));
  const dotGeo = geo('tdot', () => new THREE.CylinderGeometry(0.0095, 0.0125, 0.0055, 8, 1));
  function tactile(kind, a, b, y = FY) {
    const dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz), alongX = Math.abs(dx) > Math.abs(dz);
    const n = Math.max(1, Math.round(len / 0.3));
    const base = new THREE.Mesh(G_box(), M.tactBase);
    base.position.set((a[0] + b[0]) / 2, y + 0.003, (a[1] + b[1]) / 2);
    base.scale.set(alongX ? n * 0.3 : 0.3, 0.006, alongX ? 0.3 : n * 0.3); base.receiveShadow = true; A.root.add(base);
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n, cx = a[0] + dx * t, cz = a[1] + dz * t;
      // block joints
      tactParts.push([G_box(), mtx([alongX ? cx - 0.15 : cx, y + 0.0062, alongX ? cz : cz - 0.15], [0, 0, 0], alongX ? [0.006, 0.0006, 0.3] : [0.3, 0.0006, 0.006]), 'joint']);
      if (kind === 'line') for (const o of [-0.1125, -0.0375, 0.0375, 0.1125]) tactParts.push([barGeo, mtx([alongX ? cx : cx + o, y + 0.0085, alongX ? cz + o : cz], [0, 0, 0], alongX ? [0.26, 0.005, 0.026] : [0.026, 0.005, 0.26]), 'bump']);
      else for (let u = -2; u <= 2; u++) for (let v = -2; v <= 2; v++) tactParts.push([dotGeo, mtx([cx + u * 0.058, y + 0.0088, cz + v * 0.058]), 'bump']);
    }
  }
  function G_box() { return ctx.geo.G.box(); }
  function flushTactile() {
    const bumps = merged(tactParts.filter(p => p[2] === 'bump').map(p => [p[0], p[1]]), M.tactBump);
    const joints = merged(tactParts.filter(p => p[2] === 'joint').map(p => [p[0], p[1]]), M.tactJoint);
    for (const m of [bumps, joints]) if (m) { A.root.add(m); ctx.noOutline(m); }
    tactParts.length = 0;
  }

  // ================================================================ ticket machine (touch-screen TVM)
  const tvmProf = [[0.29, 0.08], [0.29, 1.02], [0.07, 1.40], [0.07, 1.92], [-0.29, 1.92], [-0.29, 0.08]];
  function ticketMachine(x, z, rotY = 0, o = {}) {
    const g = grp(x, FY, z, rotY); const kk = K(g);
    const W = 0.8;
    kk.mesh(geo('tvmBody', () => { const gg = ctx.geo.extrude(tvmProf, W - 0.024, { bevel: 0.012 }); gg.rotateY(-PI / 2); return gg; }), M.tvmBody, [0, 0, 0]);
    kk.box(W - 0.05, 0.08, 0.54, M.tvmDark, [0, 0.04, 0]);
    kk.rb(W + 0.012, 0.028, 0.39, 0.008, M.tvmDark, [0, 1.935, -0.11]);
    // side seam + vent
    for (const s of [-1, 1]) { kk.box(0.004, 1.6, 0.012, M.tvmDark, [s * (W / 2 + 0.011), 0.95, -0.2]); for (let i = 0; i < 5; i++) kk.box(0.004, 0.012, 0.16, M.tvmDark, [s * (W / 2 + 0.011), 0.25 + i * 0.03, 0.05]); }
    // header + status lamp
    kk.box(W - 0.06, 0.15, 0.008, M.tvmDark, [0, 1.77, 0.086]);
    kk.lab('N', 'tvmHead', 0.62, 0.124, [0, 1.775, 0.0905], null, 1.0);
    kk.box(W, 0.018, 0.012, M.pinkBand, [0, 1.675, 0.088]);
    kk.lab('N', 'tvmLamp', 0.12, 0.032, [0.26, 1.555, 0.0835], null, 1.1);
    kk.lab('N', 'lbIC', 0.07, 0.033, [-0.27, 1.555, 0.0835], null, 1.0);
    // console (slanted face) — normal (0.866, 0.5) in (z, y)
    const th = Math.atan2(0.22, 0.38);
    const sg = new THREE.Group(); sg.position.set(0, 1.21 + 0.012 * Math.sin(th) + 0.0, 0.18 + 0.012 * Math.cos(th)); sg.rotation.x = -th; g.add(sg);
    const sk = K(sg);
    // recessed screen: bezel frame proud of the face, screen set back inside it
    const sw = 0.44, sh = 0.27, sx = -0.1, sy = 0.012;
    sk.box(sw + 0.06, 0.03, 0.016, M.tvmDark, [sx, sy + sh / 2 + 0.015, 0.008]); sk.box(sw + 0.06, 0.03, 0.016, M.tvmDark, [sx, sy - sh / 2 - 0.015, 0.008]);
    sk.box(0.03, sh, 0.016, M.tvmDark, [sx - sw / 2 - 0.015, sy, 0.008]); sk.box(0.03, sh, 0.016, M.tvmDark, [sx + sw / 2 + 0.015, sy, 0.008]);
    const scr = new THREE.Mesh(U.rectPlane(sw, sh, A.tx.TVM.r('screen')), A.signMat('TVM', 1.0)); scr.position.set(sx, sy, 0.002); sg.add(scr);
    // coin slot plate + funnel lip, IC reader
    sk.rb(0.13, 0.095, 0.014, 0.004, M.stainless, [0.285, 0.1, 0.007]);
    sk.box(0.075, 0.012, 0.006, C.ink, [0.285, 0.098, 0.0145]);
    sk.box(0.085, 0.01, 0.018, M.stainless, [0.285, 0.083, 0.014], [0.6, 0, 0]);
    sk.lab('N', 'lbCoin', 0.1, 0.031, [0.285, 0.172, 0.0015]);
    sk.box(0.12, 0.12, 0.01, C.dark, [0.285, -0.075, 0.005]);
    const pad = sk.lab('face', 'icPad', 0.1, 0.1, [0.285, -0.075, 0.0105], null, 1.1); void pad;
    // ---- vertical front (z 0.302)
    const fz = 0.302;
    // bill acceptor (protruding mouth with a lit guide)
    kk.rb(0.24, 0.085, 0.055, 0.01, M.tvmDark, [0.19, 0.9, fz + 0.026]);
    kk.box(0.17, 0.012, 0.01, C.ink, [0.19, 0.9, fz + 0.053]);
    kk.box(0.17, 0.006, 0.004, M.ledGreen, [0.19, 0.924, fz + 0.051]).castShadow = false;
    kk.lab('N', 'lbBill', 0.1, 0.031, [0.19, 0.975, fz + 0.001]);
    // call button
    kk.box(0.075, 0.075, 0.012, C.dark, [-0.29, 0.9, fz + 0.006]);
    kk.cz(0.024, 0.02, C.yellow, [-0.29, 0.9, fz + 0.02], 14);
    kk.lab('N', 'lbCall', 0.08, 0.029, [-0.29, 0.965, fz + 0.001]);
    // ticket / receipt outlet: a real pocket with a smoked flap
    kk.box(0.5, 0.025, 0.06, M.tvmDark, [0, 0.79, fz + 0.03]);
    kk.box(0.5, 0.03, 0.075, M.tvmDark, [0, 0.655, fz + 0.037]);
    for (const s of [-1, 1]) kk.box(0.025, 0.11, 0.06, M.tvmDark, [s * 0.2375, 0.722, fz + 0.03]);
    kk.box(0.45, 0.11, 0.004, C.ink, [0, 0.722, fz + 0.002]);
    kk.box(0.45, 0.085, 0.006, M.smoked, [0, 0.735, fz + 0.04], [-0.3, 0, 0]);
    kk.lab('N', 'lbTicket', 0.2, 0.031, [0, 0.822, fz + 0.001]);
    // change tray (U-shaped cavity under a hood)
    kk.box(0.5, 0.02, 0.11, M.tvmDark, [0, 0.49, fz + 0.055]);
    kk.box(0.46, 0.015, 0.1, M.stainless, [0, 0.33, fz + 0.05]);
    for (const s of [-1, 1]) kk.box(0.02, 0.17, 0.11, M.tvmDark, [s * 0.24, 0.41, fz + 0.055]);
    kk.box(0.5, 0.05, 0.02, M.tvmDark, [0, 0.35, fz + 0.1]);
    kk.box(0.46, 0.15, 0.004, C.ink, [0, 0.41, fz + 0.002]);
    kk.lab('N', 'lbChange', 0.2, 0.031, [0, 0.527, fz + 0.001]);
    // ten-key pad (braille / numeric), speaker slots, kick plate
    kk.rb(0.13, 0.17, 0.012, 0.004, M.stainless, [0.33, 0.6, fz + 0.006]);
    for (let r_ = 0; r_ < 4; r_++) for (let c = 0; c < 3; c++) kk.box(0.024, 0.024, 0.012, r_ === 3 && c !== 1 ? (c ? C.green : C.red) : C.white, [0.33 + (c - 1) * 0.034, 0.653 - r_ * 0.035, fz + 0.016]);
    for (let i = 0; i < 4; i++) kk.box(0.09, 0.008, 0.004, C.ink, [-0.32, 0.56 + i * 0.022, fz + 0.002]);
    kk.box(W - 0.06, 0.06, 0.01, M.tvmDark, [0, 0.13, fz + 0.004]);
    if (o.col !== false) P.addBox(x, z, W + 0.04, 0.62, rotY, -1, 3);
    return g;
  }

  // ================================================================ automatic IC gate cabinet
  const headGeo = (L, H, s) => geo(`ghead|${L}|${s}`, () => {
    const pts = [[L / 2 - 0.01, H + 0.02], [L / 2 - 0.4, H + 0.02], [L / 2 - 0.4, H + 0.13], [L / 2 - 0.05, H + 0.075]].map(([z, y]) => [z * s, y]);
    const gg = ctx.geo.extrude(pts, 0.3 - 0.016, { bevel: 0.008 }); gg.rotateY(-PI / 2); return gg;
  });
  /** o: { readS, readN, ticket (slot at S end + outlet near N), flapE, flapW, labelS, labelN, goS, goN } */
  function gateCabinet(cx, cz, o = {}) {
    const L = o.L ?? 1.7, w = 0.3, H = 1.0;
    const g = grp(cx, FY, cz, 0); const kk = K(g);
    kk.box(w - 0.06, 0.1, L - 0.14, M.gateBase, [0, 0.05, 0]);
    kk.rb(w, H - 0.1, L, 0.05, M.gateBody, [0, 0.1 + (H - 0.1) / 2, 0], null, 2);
    kk.rb(w + 0.014, 0.03, L + 0.014, 0.012, M.gateTop, [0, H + 0.01, 0]);
    // light band + seam along both long sides
    for (const s of [-1, 1]) { kk.box(0.004, 0.012, L - 0.2, M.gateTop, [s * (w / 2 + 0.001), 0.28, 0]); kk.box(0.004, 0.012, L - 0.2, M.gateTop, [s * (w / 2 + 0.001), H - 0.06, 0]); }
    const th = Math.atan2(0.055, 0.35);
    for (const [end, has] of [[1, o.readS], [-1, o.readN]]) {
      const zEnd = end * L / 2;
      if (has) {
        kk.mesh(headGeo(L, H, end), M.gateTop, [0, 0, 0]);
        // reader: blue glow ring (on the slanted top) + IC pad + mini LED screen
        const hg = new THREE.Group(); hg.position.set(0, H + 0.1145, end * (L / 2 - 0.23)); hg.rotation.set(-PI / 2 + th, end > 0 ? 0 : PI, 0, 'YXZ'); g.add(hg);
        const hk = K(hg);
        hk.box(0.2, 0.2, 0.006, M.ledBlue, [0, 0, 0.001]).castShadow = false;
        hk.lab('face', 'icPad', 0.17, 0.17, [0, 0, 0.0045], null, 1.15);
        hk.lab('N', end > 0 ? 'gateScr' : 'gateScr2', 0.12, 0.045, [0, 0.145, 0.0045], null, 1.0);
      } else {
        kk.rb(w, 0.04, 0.34, 0.012, M.gateTop, [0, H + 0.035, end * (L / 2 - 0.17)]);
      }
      // end face: direction indicator + lane label + rubber bumper
      const ef = new THREE.Group(); ef.position.set(0, 0, zEnd + end * 0.004); ef.rotation.y = end > 0 ? 0 : PI; g.add(ef);
      const ek = K(ef);
      ek.rb(0.15, 0.15, 0.014, 0.01, C.ink, [0, H - 0.14, 0.002]);
      ek.lab('face', (end > 0 ? o.goS : o.goN) ? 'gateGo' : 'gateNo', 0.1, 0.1, [0, H - 0.14, 0.0095], null, 1.25);
      const labId = end > 0 ? o.labelS : o.labelN; if (labId) ek.lab('face', labId, 0.2, 0.06, [0, H - 0.29, 0.001], null, 1.0);
      ek.rb(0.2, 0.012, 0.012, 0.004, M.gateTop, [0, 0.2, 0.004]);
      if (o.ticket && end > 0) { ek.rb(0.15, 0.05, 0.045, 0.01, M.gateTop, [0, H - 0.04, 0.02]); ek.box(0.1, 0.008, 0.006, C.ink, [0, H - 0.04, 0.043]); }
    }
    if (o.ticket) { kk.rb(0.16, 0.035, 0.1, 0.01, M.gateTop, [0, H + 0.04, -(L / 2 - 0.55)]); kk.box(0.1, 0.004, 0.012, C.ink, [0, H + 0.058, -(L / 2 - 0.55)]); }
    // retracted flap doors: dark slot with the orange flap edge inside + sensor windows
    for (const [s, has] of [[1, o.flapE], [-1, o.flapW]]) {
      if (!has) continue;
      kk.box(0.006, 0.44, 0.06, C.ink, [s * (w / 2 + 0.001), 0.64, 0]);
      kk.rb(0.1, 0.36, 0.026, 0.012, M.flap, [s * (w / 2 + 0.04), 0.64, 0]);
      kk.rb(0.02, 0.34, 0.03, 0.008, C.rubber, [s * (w / 2 + 0.087), 0.64, 0]);
      for (const zz of [-0.66, -0.46, -0.26, 0.26, 0.46, 0.66]) for (const yy of [0.5, 0.86]) kk.rb(0.006, 0.028, 0.04, 0.003, M.smoked, [s * (w / 2 + 0.0015), yy, zz]);
    }
    return g;
  }

  // ================================================================ sorted bin unit (lids with real openings)
  const rimGeo = geo('binRim', () => new THREE.TorusGeometry(0.07, 0.009, 6, 20).rotateX(PI / 2));
  function binUnit(x, z, rotY, o = {}) {
    const g = grp(x, o.y ?? FY, z, rotY); const kk = K(g);
    const kinds = o.kinds || [['binCan', o.warm === false ? M.binBlue : M.binBlueI, 'round'], ['binPet', o.warm === false ? M.binGreen : M.binGreenI, 'round'], ['binBurn', o.warm === false ? M.binRed : M.binRedI, 'slot']];
    const n = kinds.length, pitch = 0.43, bw = 0.4, bd = 0.38, bh = 0.86;
    kk.rb(n * pitch + 0.04, 0.05, bd + 0.06, 0.01, C.steelDk, [0, 0.025, 0]);
    kinds.forEach(([labId, m, hole], i) => {
      const bx = (i - (n - 1) / 2) * pitch;
      kk.rb(bw, bh, bd, 0.035, m, [bx, 0.05 + bh / 2, 0], null, 1);
      // front door outline + keyhole
      kk.box(bw - 0.07, 0.006, 0.004, C.ink, [bx, 0.14, bd / 2 + 0.001]); kk.box(0.004, bh - 0.22, 0.004, C.ink, [bx - bw / 2 + 0.035, 0.05 + bh / 2 - 0.03, bd / 2 + 0.001]); kk.box(0.004, bh - 0.22, 0.004, C.ink, [bx + bw / 2 - 0.035, 0.05 + bh / 2 - 0.03, bd / 2 + 0.001]);
      kk.cz(0.01, 0.006, M.stainless, [bx + 0.13, 0.72, bd / 2 + 0.003], 8);
      lab(g, 'B', labId, 0.28, 0.14, [bx, 0.56, bd / 2 + 0.002], null, o.warm === false ? false : 0.85);
      // lid (grey) with its opening
      const ly = 0.05 + bh;
      kk.rb(bw + 0.02, 0.05, bd + 0.02, 0.012, M.binGrey, [bx, ly + 0.025, 0]);
      if (hole === 'round') {
        kk.cy(0.068, 0.004, C.ink, [bx, ly + 0.051, 0], 18);
        kk.mesh(rimGeo, C.greyLt, [bx, ly + 0.052, 0]);
      } else {
        kk.box(0.27, 0.004, 0.09, C.ink, [bx, ly + 0.051, 0.02]);
        for (const s of [-1, 1]) { kk.box(0.3, 0.014, 0.014, C.greyLt, [bx, ly + 0.056, 0.02 + s * 0.052]); kk.box(0.014, 0.014, 0.09, C.greyLt, [bx + s * 0.142, ly + 0.056, 0.02]); }
        kk.box(0.26, 0.008, 0.07, M.binGrey, [bx, ly + 0.046, 0.01], [0.35, 0, 0]);
      }
    });
    if (o.col !== false) P.addBox(x, z, n * pitch + 0.06, bd + 0.08, rotY, -1, 3);
    return g;
  }

  // ================================================================ umbrella rack (置き傘) with modelled folded umbrellas
  const umbGeo = geo('umbCanopy', () => {
    const g = new THREE.CylinderGeometry(0.046, 0.01, 0.6, 8, 3);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), a = Math.atan2(z, x); const k = (Math.round(a / (PI / 4)) % 2 === 0) ? 1 : 0.7; p.setX(i, x * k); p.setZ(i, z * k); }
    g.computeVertexNormals(); return g;
  });
  function umbrella(g, x, y, z, m, o = {}) {
    const ug = new THREE.Group(); ug.position.set(x, y, z); ug.rotation.set(o.rx || 0, o.ry || 0, o.rz || 0); g.add(ug);
    const uk = K(ug);
    uk.cy(0.005, 0.07, C.ink, [0, 0.035, 0], 6);                         // tip
    uk.mesh(umbGeo, m, [0, 0.37, 0]);                                  // folded canopy (wide end up)
    uk.cy(0.043, 0.03, m === M.vinyl ? C.white : m, [0, 0.52, 0], 8);    // strap band
    uk.cy(0.007, 0.16, C.steel, [0, 0.74, 0], 6);                        // shaft
    if (o.straight) uk.cy(0.016, 0.1, o.handle || C.woodDk, [0, 0.86, 0], 8);
    else { uk.cy(0.012, 0.05, o.handle || C.woodDk, [0, 0.84, 0], 8); uk.torus(0.035, 0.011, o.handle || C.woodDk, [0.035, 0.865, 0], [0, 0, 0], PI, 10); }
    return ug;
  }
  function umbrellaRack(x, z, rotY, o = {}) {
    const g = grp(x, FY, z, rotY); const kk = K(g);
    const n = o.n ?? 6, cw = 0.12, W = n * cw, D = 0.2;
    // drip tray
    kk.box(W + 0.06, 0.02, D + 0.06, M.stainless, [0, 0.03, 0]);
    for (const s of [-1, 1]) { kk.box(W + 0.06, 0.04, 0.012, M.stainless, [0, 0.05, s * (D / 2 + 0.03)]); kk.box(0.012, 0.04, D + 0.06, M.stainless, [s * (W / 2 + 0.03), 0.05, 0]); }
    kk.box(W + 0.03, 0.002, D + 0.03, C.steelDk, [0, 0.041, 0]);
    // posts + top grid of cells
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) kk.box(0.02, 0.62, 0.02, M.stainless, [sx * W / 2, 0.35, sz * D / 2]);
    for (const sz of [-1, 1]) { kk.box(W + 0.02, 0.025, 0.012, M.stainless, [0, 0.66, sz * D / 2]); kk.box(W + 0.02, 0.012, 0.012, M.stainless, [0, 0.3, sz * D / 2]); }
    for (let i = 0; i <= n; i++) kk.box(0.01, 0.025, D, M.stainless, [-W / 2 + i * cw, 0.66, 0]);
    const r = ctx.rng(o.seed || 'umb');
    const cols = [M.umbrellaCols[0], M.vinyl, M.umbrellaCols[1], M.umbrellaCols[3], M.vinyl, M.umbrellaCols[4], M.umbrellaCols[5], M.umbrellaCols[2]];
    const filled = o.filled ?? [0, 1, 2, 4, 5];
    for (const i of filled) {
      const ux = -W / 2 + cw * (i + 0.5);
      umbrella(g, ux, 0.04, (r() - 0.5) * 0.04, cols[i % cols.length], { rx: (r() - 0.5) * 0.12, rz: (r() - 0.5) * 0.12, ry: r() * PI * 2, straight: r() < 0.3, handle: r() < 0.4 ? C.black : C.woodDk });
    }
    if (o.col !== false) P.addBox(x, z, W + 0.1, D + 0.1, rotY, -1, 3);
    return g;
  }

  // ================================================================ waiting-room bench (wood slats on a steel frame, armrests)
  function benchIn(x, z, rotY, len = 2.2, o = {}) {
    const g = grp(x, FY, z, rotY); const kk = K(g);
    const slat = o.slat || C.wood, frame = o.frame || C.dark;
    for (let i = 0; i < 4; i++) kk.rb(len, 0.032, 0.088, 0.01, slat, [0, 0.43, -0.16 + i * 0.104]);
    for (let i = 0; i < 3; i++) kk.rb(len, 0.085, 0.028, 0.01, slat, [0, 0.58 + i * 0.12, -0.235 - i * 0.017], [-0.14, 0, 0]);
    const nLeg = Math.max(2, Math.round(len / 1.1) + 1);
    for (let j = 0; j < nLeg; j++) {
      const lx = -len / 2 + 0.12 + (len - 0.24) * j / (nLeg - 1);
      kk.box(0.045, 0.41, 0.045, frame, [lx, 0.205, 0.17]);
      kk.box(0.045, 0.86, 0.045, frame, [lx, 0.43, -0.24], [-0.1, 0, 0]);
      kk.box(0.045, 0.04, 0.46, frame, [lx, 0.395, -0.03]);
      kk.box(0.045, 0.03, 0.4, frame, [lx, 0.05, -0.03]);
      kk.box(0.05, 0.012, 0.06, C.rubber, [lx, 0.006, 0.17]); kk.box(0.05, 0.012, 0.06, C.rubber, [lx, 0.006, -0.2]);
      if (j === 0 || j === nLeg - 1) { kk.rb(0.06, 0.035, 0.44, 0.012, slat, [lx, 0.66, -0.01]); kk.box(0.04, 0.22, 0.04, frame, [lx, 0.55, 0.16]); }
    }
    if (o.col !== false) P.addBox(x, z, len + 0.06, 0.55, rotY, -1, FY + 0.55);
    return g;
  }

  // ================================================================ kerosene convection stove with guard + kettle (off: spring)
  function stove(x, z) {
    const g = grp(x, FY, z, 0.4); const kk = K(g);
    kk.rb(1.0, 0.012, 1.0, 0.005, C.steelDk, [0, 0.006, 0]);                  // fire-proof floor plate
    kk.cy(0.27, 0.05, C.dark, [0, 0.045, 0], 20);                              // base
    for (let i = 0; i < 3; i++) { const a = i * PI * 2 / 3; kk.box(0.05, 0.02, 0.05, C.ink, [Math.cos(a) * 0.23, 0.01, Math.sin(a) * 0.23]); }
    kk.cy(0.235, 0.5, C.greyLt, [0, 0.32, 0], 22);                             // body
    kk.cy(0.24, 0.03, C.dark, [0, 0.085, 0], 22); kk.cy(0.24, 0.02, C.dark, [0, 0.575, 0], 22);
    kk.cy(0.25, 0.04, C.steel, [0, 0.605, 0], 22);                             // top rim
    kk.cy(0.215, 0.006, C.ink, [0, 0.626, 0], 20);                             // top grille
    for (let i = -3; i <= 3; i++) kk.box(0.4 * Math.cos(Math.asin(Math.abs(i) / 3.6)), 0.01, 0.014, C.steel, [0, 0.63, i * 0.055]);
    // flame window (dark glass) + wick knob + fuel gauge
    const wg = new THREE.Group(); wg.position.set(0, 0.3, 0); g.add(wg);
    const wk = K(wg);
    wk.rb(0.2, 0.14, 0.03, 0.01, C.ink, [0, 0, 0.225]);
    wk.rb(0.16, 0.1, 0.02, 0.008, M.smoked, [0, 0, 0.235]);
    kk.cz(0.03, 0.03, C.ink, [0.12, 0.14, 0.24], 12); kk.box(0.012, 0.05, 0.012, C.red, [0.12, 0.14, 0.258]);
    kk.cz(0.022, 0.012, C.white, [-0.12, 0.14, 0.235], 12);
    // carrying handles
    for (const s of [-1, 1]) { kk.box(0.02, 0.06, 0.02, C.steel, [s * 0.2, 0.66, -0.06]); kk.box(0.02, 0.06, 0.02, C.steel, [s * 0.2, 0.66, 0.06]); kk.box(0.02, 0.018, 0.14, C.steel, [s * 0.2, 0.69, 0]); }
    // kettle (やかん)
    const kt = new THREE.Group(); kt.position.set(0.02, 0.63, 0); kt.rotation.y = -0.9; g.add(kt);
    const tk = K(kt);
    tk.mesh(geo('kettle', () => new THREE.CylinderGeometry(0.1, 0.12, 0.13, 18)), C.steel, [0, 0.065, 0]);
    tk.mesh(geo('kettleTop', () => new THREE.SphereGeometry(0.1, 18, 6, 0, PI * 2, 0, PI / 2)), C.steel, [0, 0.13, 0]);
    tk.cy(0.04, 0.02, C.steelDk, [0, 0.225, 0], 12); tk.sphere(0.015, C.black, [0, 0.24, 0], 8);
    const sp = tk.cy(0.014, 0.12, C.steel, [0.13, 0.12, 0], 8); sp.rotation.z = -0.9;
    tk.torus(0.085, 0.009, C.black, [0, 0.2, 0], [0, 0, 0], PI, 12);
    // cylindrical guard (ストーブガード)
    const R = 0.5;
    for (const y of [0.06, 0.45, 0.78]) kk.torus(R, 0.01, C.steel, [0, y, 0], [PI / 2, 0, 0], PI * 2, 32);
    for (let i = 0; i < 14; i++) { const a = i * PI * 2 / 14; kk.cy(0.007, 0.74, C.steel, [Math.cos(a) * R, 0.42, Math.sin(a) * R], 6); }
    P.addCylinder(x, z, R + 0.04, -1, FY + 1.0);
    return g;
  }

  // ================================================================ bookshelf (えきなか文庫) with individual books
  const bookCols = ['#c9504a', '#3f6fb0', '#e8c24a', '#4f8f5f', '#ef9fbe', '#8a6446', '#ebe8e0', '#6d747c', '#9cc4ea', '#d9718f', '#b48a62', '#2f4068'].map(h => ic(h));
  function fillBooks(kk, r, x0, x1, y, depth, hmax, z = 0) {
    let bx = x0 + 0.01;
    while (bx < x1 - 0.03) {
      const q = r();
      if (q < 0.08 && x1 - bx > 0.25) { // lying stack
        const n = 2 + Math.floor(r() * 3); let yy = y;
        for (let i = 0; i < n; i++) { const t = 0.02 + r() * 0.02, bw = 0.17 + r() * 0.05; kk.box(bw, t, depth * 0.8, bookCols[Math.floor(r() * bookCols.length)], [bx + 0.11, yy + t / 2, z], [0, (r() - 0.5) * 0.15, 0]); yy += t; }
        bx += 0.24; continue;
      }
      if (q < 0.14) { bx += 0.03 + r() * 0.05; continue; } // gap
      const t = 0.018 + r() * 0.035, h = hmax * (0.62 + r() * 0.36), d = depth * (0.75 + r() * 0.2);
      const lean = (q > 0.9 && bx > x0 + 0.1) ? -0.22 : 0;
      const m = bookCols[Math.floor(r() * bookCols.length)];
      kk.box(t, h, d, m, [bx + t / 2 + (lean ? h * 0.1 : 0), y + h / 2 - (lean ? 0.005 : 0), z], [0, 0, lean]);
      if (r() < 0.55) kk.box(t + 0.002, 0.018, 0.004, C.paper, [bx + t / 2 + (lean ? h * 0.1 : 0), y + h * 0.72, z + d / 2], [0, 0, lean]);
      bx += t + 0.002 + (lean ? h * 0.22 : 0);
    }
  }
  function bookshelf(x, z, rotY, o = {}) {
    const W = o.w ?? 1.6, H = o.h ?? 0.86, D = o.d ?? 0.3, t = 0.02;
    const g = grp(x, FY, z, rotY); const kk = K(g);
    const wood = C.woodLt, dk = C.wood;
    kk.box(t, H, D, wood, [-W / 2 + t / 2, H / 2, 0]); kk.box(t, H, D, wood, [W / 2 - t / 2, H / 2, 0]);
    kk.rb(W + 0.02, 0.025, D + 0.02, 0.008, wood, [0, H + 0.0125, 0]);
    kk.box(W - 2 * t, 0.06, D - 0.01, dk, [0, 0.03, 0.005]);
    kk.box(W - 2 * t, 0.01, D - 0.01, dk, [0, 0.065, 0]);
    kk.box(W, H - 0.02, 0.01, dk, [0, H / 2, -D / 2 + 0.005]);
    const shelves = o.shelves ?? 2, span = (H - 0.08) / shelves;
    const r = ctx.rng(o.seed || 'books');
    for (let s = 0; s < shelves; s++) {
      const y = 0.07 + s * span;
      if (s > 0) kk.box(W - 2 * t, 0.018, D - 0.02, wood, [0, y - 0.009, 0]);
      const mid = s === 0 && W > 1.2 ? [-W / 2 + t, 0, W / 2 - t] : null;
      if (mid) { kk.box(t, span - 0.01, D - 0.02, wood, [0, y + span / 2, 0]); fillBooks(kk, r, -W / 2 + t, -t / 2, y, D - 0.06, span - 0.04); fillBooks(kk, r, t / 2, W / 2 - t, y, D - 0.06, span - 0.04); }
      else fillBooks(kk, r, -W / 2 + t, W / 2 - t, y, D - 0.06, span - 0.04);
    }
    if (o.col !== false) P.addBox(x, z, W, D + 0.04, rotY, -1, 3);
    return { g, kk, top: H + 0.025 };
  }
  /** folded newspaper stack */
  function newspapers(kk, x, y, z, n = 4, rot = 0) {
    for (let i = 0; i < n; i++) kk.box(0.3, 0.008, 0.21, C.paper, [x + (i % 2) * 0.004, y + 0.004 + i * 0.008, z + (i % 3) * 0.003], [0, rot + (i % 2 ? 0.03 : -0.02), 0]);
    const top = kk.lab('N', 'news', 0.29, 0.2, [x, y + n * 0.008 + 0.0015, z], [-PI / 2, 0, rot], 0.85); void top;
  }
  /** pamphlet stand with slanted pockets (acrylic lips) */
  function pamphletRack(x, z, rotY) {
    const g = grp(x, FY, z, rotY); const kk = K(g);
    const W = 0.46, H = 1.3;
    kk.box(W, H, 0.02, C.woodDk, [0, H / 2, -0.1]);
    for (const s of [-1, 1]) kk.box(0.02, H, 0.2, C.woodDk, [s * (W / 2 - 0.01), H / 2, 0]);
    kk.box(W, 0.05, 0.22, C.woodDk, [0, 0.025, 0]);
    const ids = [['pamA', 'pamB', 'pamC'], ['freePaper', 'pamC', 'pamA'], ['pamB', 'pamA', 'freePaper'], ['pamC', 'freePaper', 'pamB']];
    for (let s = 0; s < 4; s++) {
      const y = 0.3 + s * 0.27;
      kk.box(W - 0.04, 0.012, 0.16, C.woodDk, [0, y, -0.01], [0.35, 0, 0]);
      kk.box(W - 0.04, 0.06, 0.006, M.glassIn, [0, y + 0.03, 0.07]).castShadow = false;
      ids[s].forEach((id, i) => {
        const px = (i - 1) * 0.135, pg = new THREE.Group(); pg.position.set(px, y + 0.09, 0.0); pg.rotation.x = -0.35; g.add(pg);
        const pk = K(pg); pk.box(0.1, 0.14, 0.012, C.paper, [0, 0, 0]);
        pk.lab(id === 'freePaper' ? 'B' : 'N', id, 0.098, 0.136, [0, 0, 0.0065], null, 0.85);
      });
    }
    kk.lab('N', 'paperSign', 0.4, 0.107, [0, H - 0.08, -0.089], null, 0.9);
    P.addBox(x, z, W, 0.24, rotY, -1, 3);
    return g;
  }

  // ================================================================ drinks vending machine (display cavity with modelled drinks)
  const canGeo = geo('can', () => new THREE.CylinderGeometry(0.032, 0.032, 0.12, 12));
  const botGeo = geo('bottle', () => { const pts = [[0, 0], [0.033, 0], [0.034, 0.1], [0.022, 0.13], [0.014, 0.15], [0.014, 0.165], [0, 0.165]].map(([a, b]) => new THREE.Vector2(a, b)); return new THREE.LatheGeometry(pts, 10); });
  function vendingMachine(x, z, rotY, o = {}) {
    const g = grp(x, FY, z, rotY); const kk = K(g);
    const body = o.body || ic('#f1ecef'), trim = o.trim || C.pink;
    kk.box(0.96, 0.08, 0.68, C.dark, [0, 0.04, -0.02]);
    kk.rb(1.0, 1.77, 0.52, 0.025, body, [0, 0.08 + 0.885, -0.1]);           // cabinet
    kk.box(1.0, 0.85, 0.2, body, [0, 0.08 + 0.425, 0.26]);                  // lower front block
    kk.box(1.0, 0.3, 0.2, body, [0, 1.55 + 0.15, 0.26]);                    // header block
    kk.box(0.06, 0.62, 0.2, body, [-0.47, 1.24, 0.26]);                    // left jamb
    kk.box(0.3, 0.62, 0.2, body, [0.35, 1.24, 0.26]);                      // payment column
    kk.lab('N', 'vmHead', 0.9, 0.253, [0, 1.7, 0.3615], null, 1.05);
    kk.box(1.0, 0.02, 0.012, trim, [0, 1.56, 0.36]); kk.box(1.0, 0.02, 0.012, trim, [0, 0.93, 0.36]);
    // display cavity: lit back, shelves + drinks + tags + buttons, glass front
    kk.box(0.64, 0.62, 0.01, M.lampGlow, [-0.12, 1.24, 0.165]).castShadow = false;
    const r = ctx.rng(o.seed || 'vm');
    const drinkCols = ['#8a5a3a', '#4f8f5f', '#ef9fbe', '#e8914a', '#e8e4dc', '#3f6fb0', '#c9504a', '#e8c24a', '#8fd1c1', '#6e5140'].map(h => ic(h));
    for (let row = 0; row < 3; row++) {
      const yb = 0.975 + row * 0.2;
      kk.box(0.64, 0.012, 0.18, C.steel, [-0.12, yb - 0.006, 0.26]);
      for (let i = 0; i < 6; i++) {
        const dx = -0.39 + i * 0.108, m = drinkCols[Math.floor(r() * drinkCols.length)];
        if (row === 2 || (row === 1 && i % 2 === 0)) { kk.mesh(botGeo, m, [dx, yb, 0.27]); kk.cy(0.035, 0.03, C.white, [dx, yb + 0.07, 0.27], 10); }
        else { kk.mesh(canGeo, m, [dx, yb + 0.06, 0.27]); kk.cy(0.0325, 0.03, i % 3 ? C.white : C.steel, [dx, yb + 0.07, 0.27], 10); kk.cy(0.026, 0.006, C.steel, [dx, yb + 0.123, 0.27], 10); }
        kk.box(0.05, 0.016, 0.01, row === 0 && i < 2 ? M.ledRed : M.ledBlue, [dx, yb - 0.022, 0.357]).castShadow = false;
      }
      kk.lab('N', 'vmTags', 0.64, 0.024, [-0.12, yb + 0.0, 0.352], null, 0.95);
    }
    const gl = kk.plane(0.64, 0.62, M.glass, [-0.12, 1.24, 0.358]); gl.castShadow = false;
    for (const yy of [1.555, 0.925]) kk.box(0.66, 0.03, 0.03, C.greyLt, [-0.12, yy, 0.35]);
    // payment column: coin slot, bill slot, IC pad, change lever, credit display
    kk.rb(0.2, 0.26, 0.014, 0.006, C.greyLt, [0.35, 1.3, 0.367]);
    kk.box(0.02, 0.07, 0.008, C.ink, [0.3, 1.36, 0.376]); kk.lab('N', 'vmCoin', 0.07, 0.021, [0.3, 1.42, 0.3745], null, 0.9);
    kk.rb(0.1, 0.05, 0.03, 0.006, C.dark, [0.39, 1.36, 0.38]); kk.box(0.08, 0.008, 0.006, C.ink, [0.39, 1.36, 0.396]);
    kk.box(0.1, 0.035, 0.006, M.ledAmber, [0.35, 1.24, 0.376]).castShadow = false;
    kk.box(0.09, 0.09, 0.008, C.dark, [0.35, 1.13, 0.37]); lab(g, 'face', 'icPad', 0.075, 0.075, [0.35, 1.13, 0.3745], null, 1.1);
    kk.box(0.03, 0.06, 0.03, C.greyLt, [0.44, 1.22, 0.38]);
    kk.rb(0.1, 0.08, 0.05, 0.01, C.greyLt, [0.39, 0.62, 0.385]); kk.box(0.07, 0.04, 0.02, C.ink, [0.39, 0.62, 0.405]);  // change cup
    // pickup flap
    kk.box(0.62, 0.05, 0.05, C.greyLt, [-0.12, 0.44, 0.385]); kk.box(0.62, 0.04, 0.06, C.greyLt, [-0.12, 0.18, 0.39]);
    for (const s of [-1, 1]) kk.box(0.03, 0.26, 0.05, C.greyLt, [-0.12 + s * 0.31, 0.31, 0.385]);
    kk.box(0.58, 0.22, 0.004, C.ink, [-0.12, 0.31, 0.362]);
    kk.box(0.58, 0.2, 0.01, M.smoked, [-0.12, 0.32, 0.395], [-0.12, 0, 0]);
    kk.lab('N', 'vmTake', 0.2, 0.029, [-0.12, 0.5, 0.3615], null, 0.9);
    kk.box(0.04, 0.3, 0.004, trim, [-0.47, 0.5, 0.362]);
    if (o.col !== false) P.addBox(x, z, 1.02, 0.78, rotY, -1, 3);
    return g;
  }

  // ================================================================ boards: cork notice board, chalk message board
  /** cork board on a wall (local +z out of the wall). sheets: [[atlas, id, lx, ly, w, h, rotZ, curl, corner, pins]] */
  function corkBoard(x, y, z, rotY, w, h, sheets = [], o = {}) {
    const g = grp(x, y, z, rotY); const kk = K(g);
    const fr = o.frame || C.woodDk, ft = 0.045;
    kk.box(w, h, 0.012, C.woodDk, [0, 0, 0.006]);
    const cork = kk.box(w, h, 0.012, M.cork, [0, 0, 0.018]); U.worldUV(cork, 0.5);
    kk.rb(w + ft * 2, ft, 0.035, 0.008, fr, [0, h / 2 + ft / 2, 0.0175]); kk.rb(w + ft * 2, ft, 0.035, 0.008, fr, [0, -h / 2 - ft / 2, 0.0175]);
    kk.rb(ft, h, 0.035, 0.008, fr, [-w / 2 - ft / 2, 0, 0.0175]); kk.rb(ft, h, 0.035, 0.008, fr, [w / 2 + ft / 2, 0, 0.0175]);
    if (o.title) { kk.rb(o.title[1], 0.09, 0.015, 0.005, C.cream, [0, h / 2 + 0.1, 0.02]); kk.lab(o.title[0], o.title[2], o.title[1] - 0.02, 0.07, [0, h / 2 + 0.1, 0.0285], null, 0.9); }
    let pi = 0;
    for (const s of sheets) {
      const [atlas, id, lx, ly, sw, sh, rz = 0, curl = 0.012, corner = 0, pins = 1] = s;
      sheet(g, atlas, id, sw, sh, [lx, ly, 0.0255], rz, { curl, corner });
      const cs = Math.cos(rz), sn = Math.sin(rz);
      const pinAt = (px, py) => { const wx = lx + px * cs - py * sn, wy = ly + px * sn + py * cs; kk.cz(0.0075, 0.012, PIN[pi++ % PIN.length], [wx, wy, 0.034], 8); kk.cz(0.004, 0.01, C.steel, [wx, wy, 0.028], 6); };
      if (pins >= 1) pinAt(0, sh / 2 - 0.014);
      if (pins >= 2) { pinAt(-sw / 2 + 0.014, sh / 2 - 0.014); pinAt(sw / 2 - 0.014, sh / 2 - 0.014); }
      if (pins >= 4) { pinAt(-sw / 2 + 0.014, -sh / 2 + 0.014); pinAt(sw / 2 - 0.014, -sh / 2 + 0.014); }
    }
    return g;
  }
  function chalkBoard(x, y, z, rotY, w = 1.2, h = 0.68) {
    const g = grp(x, y, z, rotY); const kk = K(g);
    kk.box(w, h, 0.015, C.greenDk, [0, 0, 0.0075]);
    kk.lab('N', 'dengon', w, h, [0, 0, 0.0155], null, 0.72);
    const ft = 0.04;
    kk.rb(w + ft * 2, ft, 0.03, 0.008, C.woodDk, [0, h / 2 + ft / 2, 0.015]);
    kk.rb(ft, h, 0.03, 0.008, C.woodDk, [-w / 2 - ft / 2, 0, 0.015]); kk.rb(ft, h, 0.03, 0.008, C.woodDk, [w / 2 + ft / 2, 0, 0.015]);
    // chalk tray with chalk + eraser
    kk.rb(w + ft * 2, 0.03, 0.09, 0.008, C.woodDk, [0, -h / 2 - 0.015, 0.045]);
    kk.box(w + ft * 2, 0.025, 0.012, C.woodDk, [0, -h / 2 + 0.005, 0.085]);
    const chalk = [C.white, C.pink, C.yellow, C.white];
    chalk.forEach((m, i) => kk.cx(0.0055, 0.07, m, [-0.35 + i * 0.09, -h / 2 + 0.006, 0.05 + (i % 2) * 0.012], 8));
    kk.rb(0.13, 0.03, 0.05, 0.008, C.navy, [0.32, -h / 2 + 0.015, 0.05]); kk.box(0.13, 0.01, 0.05, C.beige, [0.32, -h / 2 - 0.0, 0.05]);
    return g;
  }

  // ================================================================ wall safety devices
  function wallSpeaker(x, y, z, rotY) {
    const g = grp(x, y, z, rotY); const kk = K(g);
    kk.box(0.06, 0.08, 0.06, C.white, [0, 0.07, 0.03]);
    const sp = new THREE.Group(); sp.position.set(0, 0, 0.1); sp.rotation.x = 0.25; g.add(sp); const sk = K(sp);
    sk.rb(0.26, 0.17, 0.1, 0.02, C.white, [0, 0, 0]);
    sk.box(0.2, 0.12, 0.004, C.grey, [0, 0, 0.051]);
    for (let i = 0; i < 6; i++) sk.box(0.18, 0.008, 0.004, C.dark, [0, -0.05 + i * 0.02, 0.0535]);
    return g;
  }
  function fireExtinguisher(kk, x, y, z, s = 1) {
    kk.cy(0.075 * s, 0.42 * s, C.red, [x, y + 0.21 * s, z], 14);
    kk.sphere(0.075 * s, C.red, [x, y + 0.42 * s, z], 12).scale.y *= 0.5;
    kk.cy(0.022 * s, 0.05 * s, C.ink, [x, y + 0.47 * s, z], 8);
    kk.box(0.1 * s, 0.018 * s, 0.03 * s, C.ink, [x + 0.03 * s, y + 0.505 * s, z]);
    kk.box(0.09 * s, 0.014 * s, 0.028 * s, C.ink, [x + 0.03 * s, y + 0.48 * s, z], [0, 0, -0.35]);
    kk.cz(0.02 * s, 0.01 * s, C.white, [x, y + 0.36 * s, z + 0.074 * s], 10);
    kk.box(0.08 * s, 0.12 * s, 0.004 * s, C.paper, [x, y + 0.22 * s, z + 0.075 * s]);
    const hose = kk.cy(0.011 * s, 0.34 * s, C.ink, [x - 0.08 * s, y + 0.28 * s, z + 0.02 * s], 6); hose.rotation.z = 0.12;
    kk.cy(0.016 * s, 0.05 * s, C.ink, [x - 0.1 * s, y + 0.1 * s, z + 0.02 * s], 8);
  }
  /** floor-standing red extinguisher box (open front) */
  function fireBox(x, z, rotY) {
    const g = grp(x, FY, z, rotY); const kk = K(g);
    kk.box(0.34, 0.02, 0.26, C.red, [0, 0.01, 0]);
    kk.box(0.34, 0.6, 0.02, C.red, [0, 0.3, -0.12]);
    for (const s of [-1, 1]) kk.box(0.02, 0.6, 0.26, C.red, [s * 0.16, 0.3, 0]);
    kk.rb(0.36, 0.03, 0.28, 0.008, C.redDk, [0, 0.615, 0]);
    kk.box(0.3, 0.14, 0.012, C.red, [0, 0.52, 0.125]);
    kk.lab('N', 'fireSign', 0.26, 0.082, [0, 0.52, 0.132], null, 0.95);
    fireExtinguisher(kk, 0, 0.02, 0.0, 0.9);
    P.addBox(x, z, 0.36, 0.3, rotY, -1, 2);
    return g;
  }
  function aedBox(x, y, z, rotY) {
    const g = grp(x, y, z, rotY); const kk = K(g);
    kk.rb(0.44, 0.5, 0.2, 0.02, C.white, [0, 0, 0.1]);
    for (const [w, h, px, py] of [[0.38, 0.03, 0, 0.19], [0.38, 0.03, 0, -0.19], [0.03, 0.35, -0.175, 0], [0.03, 0.35, 0.175, 0]]) kk.box(w, h, 0.02, C.greyLt, [px, py, 0.205]);
    kk.box(0.34, 0.34, 0.004, C.offWhite, [0, 0, 0.012]);
    kk.rb(0.26, 0.2, 0.09, 0.02, C.orange, [0, -0.04, 0.07]); kk.box(0.12, 0.03, 0.03, C.dark, [0, 0.07, 0.07]);
    kk.box(0.16, 0.08, 0.004, C.dark, [0, -0.04, 0.1155]);
    const gl = kk.plane(0.32, 0.34, M.glassIn, [0, 0, 0.2]); gl.castShadow = false;
    kk.box(0.03, 0.08, 0.02, C.greyLt, [0.2, 0, 0.21]);
    kk.box(0.02, 0.02, 0.01, M.ledGreen, [0.16, 0.2, 0.2]).castShadow = false;
    kk.rb(0.46, 0.18, 0.03, 0.008, C.white, [0, 0.36, 0.015]);
    kk.lab('N', 'aedSign', 0.42, 0.168, [0, 0.36, 0.031], null, 1.0);
    return g;
  }

  // ================================================================ plants (smooth cel shrubs from lib/foliage)
  function pottedPlant(x, z, o = {}) {
    const g = grp(x, o.y ?? FY, z, o.rot || 0); const kk = K(g);
    const pr = o.potR ?? 0.2, ph = o.potH ?? 0.36;
    kk.mesh(geo(`pot|${pr}|${ph}`, () => new THREE.CylinderGeometry(pr, pr * 0.78, ph, 16)), o.pot || M.plantPot, [0, ph / 2, 0]);
    kk.cy(pr * 1.04, 0.035, o.pot || M.plantPot, [0, ph - 0.012, 0], 16);
    kk.cy(pr * 0.94, 0.01, C.soil, [0, ph - 0.03, 0], 14);
    if (o.saucer !== false) kk.cy(pr * 0.95, 0.025, C.offWhite, [0, 0.0125, 0], 16);
    if (o.kind === 'topiary') { const t = makeTopiary(ctx, { trunk: o.trunk ?? 0.55, r: o.r ?? 0.24, seed: o.seed ?? 7 }); t.position.y = ph - 0.03; g.add(t); }
    else { const s = makeShrub(ctx, { r: o.r ?? 0.28, h: o.h ?? 0.5, seed: o.seed ?? 3, kind: o.shrubKind || 'camellia', lumps: 0.28 }); s.position.y = ph - 0.04; g.add(s); }
    if (o.col !== false) P.addCylinder(x, z, pr + 0.05, -1, (o.y ?? FY) + 1.2);
    return g;
  }

  // ================================================================ misc small objects shared with the office
  function clipboard(g, x, y, z, id, rz = 0) {
    const cg = new THREE.Group(); cg.position.set(x, y, z); cg.rotation.z = rz; g.add(cg); const ck = K(cg);
    ck.cz(0.004, 0.02, C.steel, [0, 0.175, 0.006], 6);
    ck.rb(0.23, 0.32, 0.006, 0.01, C.woodLt, [0, 0, 0.004]);
    sheet(cg, 'N', id, 0.21, 0.28, [0, -0.012, 0.0075], 0, { curl: 0.01 });
    ck.rb(0.1, 0.03, 0.016, 0.004, C.steel, [0, 0.14, 0.012]); ck.box(0.03, 0.012, 0.012, C.steel, [0, 0.162, 0.018]);
    return cg;
  }

  return { C, grp, K, lab, sheet, merged, mtx, geo, col,
    fixture, pool, wallGlow, cassette, smokeDetector, ceilSpeaker, cctvDome, exitSign,
    doormat, tactile, flushTactile,
    ticketMachine, gateCabinet, binUnit, umbrella, umbrellaRack, benchIn, stove, bookshelf, fillBooks, newspapers, pamphletRack, vendingMachine,
    corkBoard, chalkBoard, wallSpeaker, fireExtinguisher, fireBox, aedBox, pottedPlant, clipboard };
}
