// Overhead catenary (架線): dark steel poles — centre poles with double cantilevers near the station,
// portal (門形) truss beams elsewhere — insulators, messenger / contact wire with zig-zag stagger,
// droppers, feeder wires and an overhead ground wire. All wires via ctx.wires (sagging ribbons).
import * as THREE from 'three';

const UP = new THREE.Vector3(0, 1, 0);
const _a = new THREE.Vector3(), _b = new THREE.Vector3();

export const CONTACT_Y = 5.15, MESSENGER_Y = 6.1, FEEDER_Y = 8.2, DIST_Y = 10.42, GROUND_WIRE_Y = 11.05;
const DIST_Z = [-42.5, -43.0, -43.5]; // 高圧配電線 (6.6 kV signal power) on the top crossarm

export function buildCatenary(ctx, root, T, E) {
  const { mat, geo, L } = ctx;
  const G = geo.G;
  const k = ctx.kit(root);
  const M = {
    pole: mat.toon('#5d616a', { paint: 0.08 }),
    arm: mat.toon('#8d939b', { paint: 0.05 }),
    dark: mat.toon('#4b4e57', { paint: 0.05 }),
    ins: mat.toon('#8f5d4a', { paint: 0.05 }),
    insW: mat.toon('#d9d6cd', { paint: 0.05 }),
    conc: mat.toon('#b9b7af', { paint: 0.08 }),
    plateW: mat.toon('#eeebe3'),
  };

  // ---------------------------------------------------------------- insulator (lathe, 0.3 m long along +y)
  const insGeo = (() => {
    const p = [[0.001, 0], [0.026, 0.0], [0.026, 0.035], [0.074, 0.07], [0.028, 0.105], [0.074, 0.15], [0.028, 0.19], [0.074, 0.235], [0.026, 0.27], [0.026, 0.3], [0.001, 0.3]];
    const g = new THREE.LatheGeometry(p.map(q => new THREE.Vector2(q[0], q[1])), 7);
    g.computeVertexNormals();
    return g;
  })();
  const pipe = (a, b, r, m, seg = 8) => {
    _a.set(a[0], a[1], a[2]); _b.set(b[0], b[1], b[2]);
    const d = _b.clone().sub(_a), len = d.length(); if (len < 1e-4) return null;
    const mesh = k.mesh(G.cyl(seg), m, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], null, [r * 2, len, r * 2]);
    mesh.quaternion.setFromUnitVectors(UP, d.normalize());
    return mesh;
  };
  const bar = (a, b, w, m) => { // square bar
    _a.set(a[0], a[1], a[2]); _b.set(b[0], b[1], b[2]);
    const d = _b.clone().sub(_a), len = d.length();
    const mesh = k.mesh(G.box(), m, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], null, [w, len, w]);
    mesh.quaternion.setFromUnitVectors(UP, d.normalize());
    return mesh;
  };
  const insulator = (a, b, m = M.ins) => {
    _a.set(a[0], a[1], a[2]); _b.set(b[0], b[1], b[2]);
    const d = _b.clone().sub(_a), len = d.length();
    const mesh = k.mesh(insGeo, m, [a[0], a[1], a[2]], null, [1, len / 0.3, 1]);
    mesh.quaternion.setFromUnitVectors(UP, d.normalize());
    return mesh;
  };
  const texPlate = (texture, w, h, pos, rotY, back = M.plateW) => {
    const g = k.group(pos, rotY);
    const kk = ctx.kit(g);
    kk.box(w + 0.02, h + 0.02, 0.012, back, [0, 0, 0]);
    T.signMesh(kk, texture, w, h, [0, 0, 0.0075]);
    return g;
  };

  const topCrossarm = (x, zc) => {
    // top crossarm with three pin insulators (distribution line) + ground-wire clamp on the tip
    k.box(0.09, 0.09, 1.5, M.dark, [x, DIST_Y - 0.2, zc]);
    for (const s of [-1, 1]) bar([x, DIST_Y - 0.62, zc], [x, DIST_Y - 0.22, zc + s * 0.6], 0.03, M.dark);
    for (const zd of DIST_Z) { pipe([x, DIST_Y - 0.16, zd], [x, DIST_Y - 0.12, zd], 0.02, M.dark, 6); insulator([x, DIST_Y - 0.14, zd], [x, DIST_Y - 0.005, zd], M.insW); }
    k.box(0.07, 0.12, 0.07, M.dark, [x, GROUND_WIRE_Y - 0.03, zc]);
  };

  // ---------------------------------------------------------------- pole plan
  const PLAN = [
    [-420, 'C'], [-385, 'P'], [-340, 'P'], [-295, 'C'], [-250, 'C'], [-205, 'P'], [-160, 'P'], [-115, 'C'], [-70, 'C'], [-25, 'C'],
    [20, 'C'], [62, 'P'], [84, 'P'], [106, 'P'], [150, 'C'], [195, 'C'], [240, 'P'], [285, 'P'], [330, 'C'], [375, 'C'], [420, 'P'],
  ];
  const poles = PLAN.map(([x, type], i) => ({ x, type, i, sA: i % 2 ? -0.2 : 0.2, sB: i % 2 ? 0.2 : -0.2, no: 61 + i }));
  const plateNo = (P) => (Math.abs(P.x) <= 200 ? P.no : 50 + (P.i % 3)); // far plates are unreadable: share 3
  const zA = E.zA, zB = E.zB;
  const zSouthPole = -37.6, zNorthPole = -48.4;
  const colliders = [];

  const armSet = (x, zBase, zT, s, side, hangFromY = null) => {
    // side: direction from the support toward the wire (+1 → +z)
    const zw = zT + s;
    const zEndUp = zw + side * 0.2;           // upper pipe reaches just past the wire
    const zV = zw - side * 0.32;              // vertical tie pipe / lower pipe end (pole side of the wire)
    // upper (messenger) pipe with insulator near the support
    pipe([x, 6.32, zBase], [x, 6.32, zBase + side * 0.1], 0.032, M.arm);
    insulator([x, 6.32, zBase + side * 0.1], [x, 6.32, zBase + side * 0.4]);
    pipe([x, 6.32, zBase + side * 0.4], [x, 6.32, zEndUp], 0.03, M.arm);
    // lower (registration) pipe with insulator
    pipe([x, 5.5, zBase], [x, 5.5, zBase + side * 0.1], 0.03, M.arm);
    insulator([x, 5.5, zBase + side * 0.1], [x, 5.5, zBase + side * 0.4]);
    if ((zV - (zBase + side * 0.4)) * side > 0.04) pipe([x, 5.5, zBase + side * 0.4], [x, 5.5, zV], 0.028, M.arm);
    // vertical tie between the two pipes
    pipe([x, 5.5, zV], [x, 6.32, zV], 0.022, M.arm);
    // diagonal stay from above
    if (hangFromY !== null) pipe([x, hangFromY, zBase], [x, 6.34, zEndUp - side * 0.12], 0.016, M.dark, 6);
    // messenger clamp + steady arm to the contact wire
    k.box(0.05, 0.16, 0.05, M.dark, [x, 6.22, zw]);
    pipe([x, 5.5, zV], [x + 0.35, CONTACT_Y + 0.03, zw], 0.012, M.dark, 6);
    k.box(0.08, 0.035, 0.035, M.dark, [x + 0.37, CONTACT_Y + 0.02, zw]);
  };

  for (const P of poles) {
    const x = P.x;
    if (P.type === 'C') {
      const zc = -43;
      k.boxB(0.52, 0.46, 0.46, M.conc, [x, -0.31, zc]);
      k.box(0.3, 0.03, 0.3, M.dark, [x, 0.165, zc]);
      k.cyl(0.098, 0.13, 10.95, M.pole, [x, 0.15 + 5.475, zc], null, 12);
      k.cyl(0.07, 0.1, 0.08, M.dark, [x, 11.14, zc], null, 10);
      topCrossarm(x, zc);
      for (const [zT, s, side] of [[zA, P.sA, 1], [zB, P.sB, -1]]) armSet(x, zc + side * 0.11, zT, s, side, 7.35);
      // stay brackets on the pole
      for (const y of [7.35, 6.32, 5.5]) k.box(0.26, 0.08, 0.26, M.dark, [x, y, zc]);
      // feeder crossarm + pin insulators, ground wire clamp
      k.box(0.08, 0.08, 1.36, M.dark, [x, 7.98, zc]);
      for (const zf of [-42.65, -43.35]) { pipe([x, 8.02, zf], [x, 8.06, zf], 0.02, M.dark, 6); insulator([x, 8.04, zf], [x, FEEDER_Y - 0.01, zf], M.insW); }
      colliders.push({ x, z: zc, r: 0.27 });
      // number plate (south face) + track number plates near the station
      texPlate(T.sign.plate([{ t: '桜川線', s: 26, wt: 700 }, { t: 'No.' + plateNo(P), s: 44 }], 'pole' + plateNo(P), 256, 128), 0.24, 0.12, [x, 1.9, zc + 0.125], 0);
      if (Math.abs(x) < 130) texPlate(T.sign.hv, 0.24, 0.18, [x, 2.65, zc + 0.125], 0, mat.toon('#35303c'));
      if (x === -25 || x === 20) {
        texPlate(T.sign.num('1', '#f4f2ec', '#35303c', '番線'), 0.26, 0.26, [x, 3.3, zc + 0.125], 0);
        texPlate(T.sign.num('2', '#f4f2ec', '#35303c', '番線'), 0.26, 0.26, [x, 3.3, zc - 0.125], Math.PI);
        texPlate(T.sign.plate([{ t: '桜川線', s: 26, wt: 700 }, { t: 'No.' + plateNo(P), s: 44 }], 'pole' + plateNo(P), 256, 128), 0.24, 0.12, [x, 1.9, zc - 0.125], Math.PI);
      }
    } else {
      // portal: two outside poles + lattice truss beam
      for (const zp of [zSouthPole, zNorthPole]) {
        const gy = L.heightAt(x, zp);
        k.boxB(0.64, 0.5, 0.64, M.conc, [x, gy - 0.35, zp]);
        k.box(0.34, 0.03, 0.34, M.dark, [x, gy + 0.165, zp]);
        k.cyl(0.13, 0.155, 7.9 - gy - 0.15, M.pole, [x, (7.9 + gy + 0.15) / 2, zp], null, 12);
        k.cyl(0.09, 0.135, 0.08, M.dark, [x, 7.94, zp], null, 10);
        colliders.push({ x, z: zp, r: 0.34 });
      }
      const z0 = zSouthPole + 0.3, z1 = zNorthPole - 0.3, yb = 7.3, yt = 7.72, hx = 0.16;
      for (const dx of [-hx, hx]) for (const y of [yb, yt]) k.box(0.055, 0.055, z0 - z1, M.pole, [x + dx, y, (z0 + z1) / 2]);
      const nPanel = 12;
      for (let i = 0; i < nPanel; i++) {
        const za = z0 - (z0 - z1) * i / nPanel, zb2 = z0 - (z0 - z1) * (i + 1) / nPanel;
        for (const dx of [-hx, hx]) bar([x + dx, i % 2 ? yt : yb, za], [x + dx, i % 2 ? yb : yt, zb2], 0.032, M.pole);
        if (i % 3 === 0) bar([x - hx, yb, za], [x + hx, yb, za], 0.03, M.pole);
      }
      for (const zp of [zSouthPole, zNorthPole]) k.box(0.42, 0.62, 0.36, M.dark, [x, (yb + yt) / 2, zp]);
      // registration drops for each track (drop pipe hangs from the beam on the pole side of the wire)
      for (const [zT, s, side] of [[zA, P.sA, -1], [zB, P.sB, 1]]) {
        const zDrop = zT + s - side * 0.95;
        pipe([x, yb, zDrop], [x, 5.46, zDrop], 0.034, M.arm);
        k.box(0.1, 0.12, 0.1, M.dark, [x, yb - 0.04, zDrop]);
        armSet(x, zDrop, zT, s, side, 7.05);
      }
      // crossover wire registration at x = 62 / 84 / 106
      if (x === 62 || x === 84 || x === 106) {
        const zx = x === 62 ? -41.65 : x === 84 ? E.xo.zc(84) : -44.6;
        const zDrop = zx + (x === 106 ? 0.95 : -0.95), xo = x + 0.4;
        bar([x - hx, yb, zDrop], [xo, yb - 0.02, zDrop], 0.05, M.pole);
        pipe([xo, yb, zDrop], [xo, 5.46, zDrop], 0.03, M.arm);
        armSet(xo, zDrop, zx, 0, x === 106 ? -1 : 1, 7.05);
      }
      // feeders + ground wire mast on top of the beam
      for (const zf of [-42.65, -43.35]) { pipe([x, yt, zf], [x, yt + 0.16, zf], 0.022, M.dark, 6); insulator([x, yt + 0.16, zf], [x, FEEDER_Y - 0.01, zf], M.insW); }
      pipe([x, yt, -43], [x, GROUND_WIRE_Y + 0.05, -43], 0.075, M.pole, 10);
      for (const s of [-1, 1]) bar([x, yt, -43 + s * 1.1], [x, yt + 1.1, -43 + s * 0.06], 0.045, M.pole);
      topCrossarm(x, -43);
      texPlate(T.sign.plate([{ t: '桜川線', s: 26, wt: 700 }, { t: 'No.' + plateNo(P), s: 44 }], 'pole' + plateNo(P), 256, 128), 0.24, 0.12, [x, 1.9, zSouthPole + 0.155], 0);
      if (Math.abs(x) < 130) texPlate(T.sign.hv, 0.24, 0.18, [x, 2.65, zSouthPole + 0.155], 0, mat.toon('#35303c'));
    }
  }

  // ---------------------------------------------------------------- wires
  const W = ctx.wires;
  const C = { contact: '#5a4943', messenger: '#4b4752', dropper: '#6b6570', feeder: '#3e3a46', ground: '#56525e' };
  for (const [zT, key] of [[zA, 'sA'], [zB, 'sB']]) {
    for (let i = 0; i < poles.length - 1; i++) {
      const a = poles[i], b = poles[i + 1], span = b.x - a.x;
      const za = zT + a[key], zb = zT + b[key];
      const sag = 0.47 * (span / 45) ** 2, pre = 0.03;
      W.add(geo.catenary([a.x, MESSENGER_Y, za], [b.x, MESSENGER_Y, zb], sag, 18), { width: 0.022, color: C.messenger });
      W.add(geo.catenary([a.x, CONTACT_Y, za], [b.x, CONTACT_Y, zb], pre, 8), { width: 0.024, color: C.contact });
      const n = Math.max(1, Math.round(span / 5) - 1);
      for (let j = 1; j <= n; j++) {
        const t = j / (n + 1), x = a.x + span * t, z = za + (zb - za) * t;
        const ym = MESSENGER_Y - sag * 4 * t * (1 - t), yc = CONTACT_Y - pre * 4 * t * (1 - t);
        W.add([[x, yc + 0.012, z], [x, ym - 0.01, z]], { width: 0.008, color: C.dropper });
      }
    }
  }
  // crossover overlap wire 62 -> 84 -> 106 (raised ends = out-of-running overlap)
  {
    const pts = [[62, -41.65, 0.16], [84, E.xo.zc(84), 0], [106, -44.6, 0.1]];
    for (let i = 0; i < 2; i++) {
      const [xa, za, ra] = pts[i], [xb, zb, rb] = pts[i + 1];
      const span = xb - xa, sag = 0.47 * (span / 45) ** 2;
      W.add(geo.catenary([xa, MESSENGER_Y + ra, za], [xb, MESSENGER_Y + rb, zb], sag, 12), { width: 0.022, color: C.messenger });
      W.add([[xa, CONTACT_Y + ra, za], [xb, CONTACT_Y + rb, zb]], { width: 0.024, color: C.contact });
      const n = Math.round(span / 5) - 1;
      for (let j = 1; j <= n; j++) {
        const t = j / (n + 1), x = xa + span * t, z = za + (zb - za) * t;
        W.add([[x, CONTACT_Y + ra + (rb - ra) * t + 0.012, z], [x, MESSENGER_Y + ra + (rb - ra) * t - sag * 4 * t * (1 - t) - 0.01, z]], { width: 0.008, color: C.dropper });
      }
    }
  }
  for (let i = 0; i < poles.length - 1; i++) {
    const a = poles[i], b = poles[i + 1], span = b.x - a.x;
    for (const zf of [-42.65, -43.35]) W.add(geo.catenary([a.x, FEEDER_Y, zf], [b.x, FEEDER_Y, zf], 0.75 * (span / 45) ** 2, 18), { width: 0.03, color: C.feeder });
    W.add(geo.catenary([a.x, GROUND_WIRE_Y, -43], [b.x, GROUND_WIRE_Y, -43], 0.55 * (span / 45) ** 2, 16), { width: 0.016, color: C.ground });
    for (const zd of DIST_Z) W.add(geo.catenary([a.x, DIST_Y, zd], [b.x, DIST_Y, zd], 0.9 * (span / 45) ** 2, 18), { width: 0.022, color: C.feeder });
  }
  return { poles, colliders, zSouthPole, zNorthPole };
}
