// Both platforms: concrete bodies + wear, edge coping / white line / tactile strip / door marks,
// shelters (steel columns, light roof, fluorescent tubes, hanging boards), 駅名標 (orientation-correct),
// benches, bins, clocks, speakers, timetables, fences, platform ends (立入禁止, departure indicator,
// equipment box, number plate, crew mirror, safety gate), east ramps + 構内踏切 walkway, north exit.
import * as THREE from 'three';

export function buildPlatforms(A) {
  const { ctx, k, kd, U, M, P, L } = A;
  const PY = L.PLATFORM.y, PI = Math.PI;
  const r = ctx.rng('station-platforms');
  const S = { ...L.PLATFORM.south, t: -1, name: 'S' }; // t = direction toward the track (z)
  const N = { ...L.PLATFORM.north, t: 1, name: 'N' };
  const backZ = (p) => (p.name === 'S' ? p.z1 : p.z0); // -35.5 / -50.5
  const zAt = (p, d) => p.edgeZ - p.t * d;               // z at distance d from the track edge (inland)
  const GROUND = L.RAIL.groundY - 0.05;
  const yellow = ctx.mat.toon('#e3b93a', { paint: 0.02 });

  // ------------------------------------------------------------------ platform bodies + surface markings
  for (const p of [S, N]) {
    const bz = backZ(p), e = p.edgeZ, x0 = p.x0, x1 = p.x1, cx = (x0 + x1) / 2, len = x1 - x0;
    const zmin = Math.min(bz, e), zmax = Math.max(bz, e);
    U.worldUV(k.box(len, 0.16, zmax - zmin, M.concrete, [cx, PY - 0.08, (zmin + zmax) / 2]), [8, 4]);
    // body recessed under the coping on the track side
    const eIn = e - p.t * 0.14;
    const bmin = Math.min(bz, eIn), bmax = Math.max(bz, eIn);
    k.box(len, PY - 0.16 - GROUND, bmax - bmin, M.concreteSide, [cx, (PY - 0.16 + GROUND) / 2, (bmin + bmax) / 2]);
    // vertical joints & a little grime on the track face
    for (let x = x0 + 3; x < x1; x += 3) k.box(0.03, PY - 0.2 - GROUND, 0.02, M.concreteDark, [x, (PY - 0.2 + GROUND) / 2, eIn + p.t * 0.008]);
    for (let x = x0 + 1; x < x1 - 1; x += 2.3 + r() * 2) { const g = k.plane(1.4 + r(), 0.5, M.grime, [x, GROUND + 0.3, eIn + p.t * 0.012], [0, p.t > 0 ? 0 : PI, 0]); g.receiveShadow = true; }
    P.addWalkBox(cx, (zmin + zmax) / 2, len, zmax - zmin, 0, PY);
    // outer (back) face: coping lip, panel joints, rain streaks, foot grime, weep holes
    {
      const out = -p.t, fz = bz + out * 0.01, rot = out > 0 ? 0 : PI;
      const segs = p.name === 'S' ? [[x0, -4.0], [12.0, x1]] : [[7.4, x1]];
      for (const [a, b] of segs) {
        k.box(b - a, 0.1, 0.05, M.coping, [(a + b) / 2, PY - 0.06, bz + out * 0.025]);
        for (let x = a + 3; x < b - 0.5; x += 3) k.box(0.03, PY - 0.2 - GROUND, 0.02, M.concreteDark, [x, (PY - 0.2 + GROUND) / 2, fz]);
        for (let x = a + 0.9; x < b - 0.9; x += 2.0 + r() * 1.6) k.plane(1.5 + r(), 0.55, M.grime, [x, GROUND + 0.33, bz + out * 0.014], [0, rot, 0]).receiveShadow = true;
        for (let x = a + 1.4; x < b - 1.0; x += 2.6 + r() * 2.5) k.plane(0.9 + r() * 0.9, 0.5 + r() * 0.3, M.streak, [x, PY - 0.42, bz + out * 0.016], [0, rot, 0]).receiveShadow = true;
        for (let x = a + 1.6; x < b - 0.5; x += 4.5) k.cyl(0.045, 0.045, 0.1, M.equipDark, [x, GROUND + 0.5, bz + out * 0.04], [PI / 2, 0, 0], 8);
      }
    }
    // invisible edge barrier (player cannot step onto the tracks)
    P.addAABB(x0, Math.min(e, e + p.t * 0.35), x1, Math.max(e, e + p.t * 0.35), 0.9, 4);
    // coping band, white safety line, tactile warning strip + inner line
    const band = (d0, d1, h, m, tile) => { const z0 = zAt(p, d0), z1 = zAt(p, d1); const b = k.box(len, h, Math.abs(z1 - z0), m, [cx, PY + h / 2, (z0 + z1) / 2]); if (tile) U.worldUV(b, tile); return b; };
    band(0, 0.3, 0.008, M.coping);
    const wl = k.plane(len, 0.09, M.whiteLine, [cx, PY + 0.0045, zAt(p, 0.42)], [-PI / 2, 0, 0]); wl.receiveShadow = true;
    band(0.8, 1.1, 0.012, M.tactDot, 0.3);
    band(1.1, 1.14, 0.014, yellow);
    // tactile warning across the ramp top (east end)
    const tz0 = zAt(p, 1.14), tz1 = bz;
    U.worldUV(k.box(0.3, 0.012, Math.abs(tz1 - tz0) - 0.3, M.tactDot, [x1 - 0.2, PY + 0.006, (tz0 + tz1) / 2 + p.t * 0.15]), 0.3);
    // painted boarding-position marks at every door of a stopped 2-car train
    const dm = A.tx.misc.r('doorMark');
    for (const dx of L.TRAIN_DOORS_X) {
      const m = new THREE.Mesh(U.rectPlane(1.3, 0.6, dm), M.doorMark);
      m.position.set(dx, PY + 0.005, zAt(p, 1.5));
      m.rotation.set(-PI / 2, 0, p.name === 'S' ? 0 : PI);
      m.receiveShadow = true; A.root.add(m);
    }
    // occasional darker patches / rain stains on the surface
    for (let i = 0; i < 9; i++) {
      const x = x0 + 2 + r() * (len - 4), d = 0.4 + r() * 3.2;
      const m = k.plane(0.8 + r() * 1.6, 0.4 + r() * 0.7, M.grime, [x, PY + 0.003, zAt(p, d)], [-PI / 2, 0, r() * PI]); m.receiveShadow = true;
    }
    // petal / dust drift along the back fence
    // (petals module adds real petals; here only a soft grey dust line)
    const dust = k.plane(len - 1, 0.25, M.grime, [cx, PY + 0.003, bz + p.t * 0.2], [-PI / 2, 0, 0]); dust.receiveShadow = true;
  }

  // ------------------------------------------------------------------ east ramps (x 40..46 → y 0.15) + 構内踏切 walkway
  const RX0 = L.PLATFORM.rampX0, RX1 = L.PLATFORM.rampX1, WX0 = L.PLATFORM.walkCrossing.x0, WX1 = L.PLATFORM.walkCrossing.x1;
  const WY = L.RAIL.railTopY;
  for (const p of [S, N]) {
    const bz = backZ(p), e = p.edgeZ, zmin = Math.min(bz, e), zmax = Math.max(bz, e), w = zmax - zmin, cz = (zmin + zmax) / 2;
    const g = ctx.geo.extrude([[RX0, GROUND], [RX1, GROUND], [RX1, WY], [RX0, PY]], w);
    k.mesh(g, M.concreteSide, [0, 0, cz]);
    const Ls = Math.hypot(RX1 - RX0, PY - WY), ang = Math.atan2(WY - PY, RX1 - RX0);
    U.worldUV(k.box(Ls, 0.02, w, M.concrete, [(RX0 + RX1) / 2, (PY + WY) / 2 - 0.002, cz], [0, 0, ang]), [8, 4]);
    // non-slip stripes across the ramp
    for (let x = RX0 + 0.6; x < RX1 - 0.3; x += 0.6) { const y = PY + (x - RX0) / (RX1 - RX0) * (WY - PY); k.box(0.05, 0.01, w - 0.3, M.concreteDark, [x, y + 0.008, cz], [0, 0, ang]); }
    P.addWalkRamp((RX0 + RX1) / 2, cz, w, RX1 - RX0, -PI / 2, WY, PY);
    // landing at walkway level
    U.worldUV(k.box(WX1 - WX0 + 0.3, WY - GROUND, w, M.concreteSide, [(WX0 + WX1 + 0.3) / 2, (WY + GROUND) / 2, cz]), 2);
    U.worldUV(k.box(WX1 - WX0 + 0.3, 0.02, w, M.concrete, [(WX0 + WX1 + 0.3) / 2, WY - 0.008, cz]), [8, 4]);
    P.addWalkBox((WX0 + WX1 + 0.3) / 2, cz, WX1 - WX0 + 0.3, w, 0, WY);
    // track-side safety fence along the ramp, following its slope
    const fz = e - p.t * 0.12;
    const rampY = (x) => (x <= RX0 ? PY : x >= RX1 ? WY : PY + (x - RX0) / (RX1 - RX0) * (WY - PY));
    U.railing(k, [[RX0 - 0.02, fz], [RX1, fz]], (x) => rampY(x), { h: 1.1, post: 1.5, rails: [1, 0.55, 0.12], bar: 0.15, barLo: 0.14, mat: M.fenceWhite, postW: 0.06 });
    P.addBox((RX0 + RX1) / 2, fz, RX1 - RX0, 0.12, 0, -1, 4);
    // east end fence of the landing
    U.railing(k, [[WX1 + 0.12, bz], [WX1 + 0.12, e - p.t * 0.25]], WY, { h: 1.1, post: 1.3, rails: [1, 0.55, 0.12], bar: 0.15, barLo: 0.14, mat: M.fenceWhite, postW: 0.06 });
    P.addBox(WX1 + 0.12, cz, 0.12, w, 0, -1, 4);
    // tactile warning where the landing meets the tracks
    U.worldUV(k.box(WX1 - WX0 - 0.1, 0.012, 0.3, M.tactDot, [(WX0 + WX1) / 2, WY + 0.006, e - p.t * 0.35]), 0.3);
  }
  // walkway boards between / around the rails (top = rail top)
  {
    const zA = L.RAIL.zA, zB = L.RAIL.zB, hg = L.RAIL.gauge / 2, head = 0.065, fl = 0.07;
    const outer = (zc, s) => zc + s * (hg + head + 0.005); // outer rail face
    const inner = (zc, s) => zc + s * (hg - fl);             // inner board edge (flangeway)
    const boards = [
      [S.edgeZ, outer(zA, 1), M.stone], [inner(zA, 1), inner(zA, -1), M.rubber], [outer(zA, -1), outer(zB, 1), M.stone],
      [inner(zB, 1), inner(zB, -1), M.rubber], [outer(zB, -1), N.edgeZ, M.stone],
    ];
    for (const [za, zb, m] of boards) {
      const z0 = Math.min(za, zb), z1 = Math.max(za, zb);
      const b = k.box(WX1 - WX0, 0.12, z1 - z0 - 0.01, m, [(WX0 + WX1) / 2, WY - 0.06, (z0 + z1) / 2]);
      U.worldUV(b, m === M.rubber ? 1.25 : 1.8);
      k.box(WX1 - WX0, 0.006, 0.05, M.signYellow, [(WX0 + WX1) / 2, WY + 0.003, z0 + 0.06]);
      k.box(WX1 - WX0, 0.006, 0.05, M.signYellow, [(WX0 + WX1) / 2, WY + 0.003, z1 - 0.06]);
    }
    P.addWalkBox((WX0 + WX1) / 2, (S.edgeZ + N.edgeZ) / 2, WX1 - WX0, S.edgeZ - N.edgeZ, 0, WY);
    // keep the player on the walkway (no wandering along the tracks from here)
    P.addAABB(WX0 - 0.15, N.edgeZ, WX0, S.edgeZ, -1, 3);
    P.addAABB(WX1, N.edgeZ, WX1 + 0.15, S.edgeZ, -1, 3);
    // warning lights + 列車に注意 左右確認 signs at both walkway entrances
    for (const [z, rot, face] of [[S.edgeZ + 0.25, 0, 1], [N.edgeZ - 0.25, PI, -1]]) {
      const x = WX1 - 0.1;
      k.cyl(0.045, 0.05, 2.5, M.fenceWhite, [x, WY + 1.25, z], null, 10);
      for (let i = 0; i < 6; i++) k.box(0.1, 0.12, 0.1, i % 2 ? M.ink : M.signYellow, [x, WY + 0.1 + i * 0.12, z]);
      A.board('misc', 'crossWarn', 0.46, 0.593, [x - 0.35, WY + 1.55, z + face * 0.04], rot, { frame: M.fenceWhite, border: 0.02 });
      const lampY = WY + 2.35;
      k.box(0.22, 0.22, 0.14, M.ink, [x, lampY, z + face * 0.02]);
      k.cyl(0.07, 0.07, 0.03, ctx.mat.toon('#7a3030'), [x, lampY, z + face * 0.1], [PI / 2, 0, 0], 16);
      const lit = kd.cyl(0.07, 0.07, 0.032, ctx.mat.emissive('#ff4a3a', 2.2), [x, lampY, z + face * 0.101], [PI / 2, 0, 0], 16);
      k.box(0.24, 0.03, 0.12, M.ink, [x, lampY + 0.14, z + face * 0.1]);
      A.blinkers.push({ mesh: lit, fn: (t) => trainNear(t) && (Math.floor(t * 2.2) % 2 === 0) });
      P.addCylinder(x, z, 0.08, -1, 3);
    }
  }
  function trainNear(t) {
    const trains = ctx.services.rail?.trains;
    if (trains && trains.length) return trains.some(tr => Math.abs(tr.x - 47.25) < tr.length / 2 + 45 && Math.abs(tr.speed || 0) > 0.2);
    const m = ((t % 120) + 120) % 120, SA = L.SCHEDULE.A, SB = L.SCHEDULE.B;
    return (m > SA.arriveFromEast[0] && m < SA.arriveFromEast[0] + 12) || (m > SB.depart && m < SB.depart + 10);
  }

  // ------------------------------------------------------------------ fences on the outer sides
  // south: white railing at z -35.52 (x -7..-4 and 12..48.5); north: green mesh at z -50.48
  const southFenceZ = S.z1 - 0.02, northFenceZ = N.z0 + 0.02;
  const baseY = (x) => (x <= RX0 ? PY : x >= RX1 ? WY : PY + (x - RX0) / (RX1 - RX0) * (WY - PY));
  const whiteFence = (xa, xb, z) => {
    U.railing(k, [[xa, z], [xb, z]], baseY, { h: 1.1, post: 2.0, rails: [1, 0.55, 0.1], bar: 0.15, barLo: 0.12, mat: M.fenceWhite, postW: 0.06 });
    P.addBox((xa + xb) / 2, z, xb - xa, 0.14, 0, -1, 5);
  };
  whiteFence(S.x0, -4.0, southFenceZ);
  for (const [a, b] of [[12.0, 26.0], [26.0, RX0], [RX0, RX1], [RX1, WX1 + 0.12]]) whiteFence(a, b, southFenceZ);
  const meshFence = (xa, xb, z) => {
    const h = 1.25, n = Math.max(1, Math.round((xb - xa) / 2.4));
    for (let i = 0; i <= n; i++) { const x = xa + (xb - xa) * i / n; k.box(0.06, h + 0.05, 0.06, M.fenceGreen, [x, baseY(x) + (h + 0.05) / 2, z]); }
    for (let i = 0; i < n; i++) {
      const a = xa + (xb - xa) * i / n, b = xa + (xb - xa) * (i + 1) / n, ya = baseY(a), yb = baseY(b);
      U.beam(k, [a, ya + h, z], [b, yb + h, z], 0.045, 0.045, M.fenceGreen, true);
      U.beam(k, [a, ya + 0.08, z], [b, yb + 0.08, z], 0.035, 0.035, M.fenceGreen, true);
      // wire mesh panel (alpha, follows ramp slope)
      const g = new THREE.PlaneGeometry(b - a, h - 0.1);
      const pos = g.attributes.position, uv = g.attributes.uv;
      for (let j = 0; j < pos.count; j++) { const lx = pos.getX(j), ly = pos.getY(j); const t = (lx + (b - a) / 2) / (b - a); pos.setY(j, ly + (ya + (yb - ya) * t) + h / 2 + 0.03); uv.setXY(j, uv.getX(j) * (b - a) / 0.12, uv.getY(j) * (h - 0.1) / 0.12); }
      g.computeBoundingSphere();
      const m = new THREE.Mesh(g, M.wireMesh); m.position.set((a + b) / 2, 0, z); ctx.noOutline(m); A.root.add(m);
    }
    P.addBox((xa + xb) / 2, z, xb - xa, 0.14, 0, -1, 5);
  };
  meshFence(N.x0, -5.95, northFenceZ);
  for (const [a, b] of [[-4.05, 16.0], [16.0, RX0], [RX0, RX1], [RX1, WX1 + 0.12]]) meshFence(a, b, northFenceZ);

  // ------------------------------------------------------------------ platform ends (west): safety gate + keep-out + equipment
  for (const p of [S, N]) {
    const bz = backZ(p), x = p.x0 + 0.06;
    const zGate0 = p.edgeZ - p.t * 0.3, zGate1 = bz;
    U.railing(k, [[x, zGate0], [x, (zGate0 + zGate1) / 2 - p.t * 0.55]], PY, { h: 1.15, post: 1.0, rails: [1, 0.55, 0.1], bar: 0.12, mat: M.fenceWhite, postW: 0.07 });
    U.railing(k, [[x, (zGate0 + zGate1) / 2 + p.t * 0.55], [x, zGate1]], PY, { h: 1.15, post: 1.0, rails: [1, 0.55, 0.1], bar: 0.12, mat: M.fenceWhite, postW: 0.07 });
    // swing gate (closed) with a keep-out sign
    const gz = (zGate0 + zGate1) / 2;
    U.railing(k, [[x, gz - 0.53], [x, gz + 0.53]], PY, { h: 1.05, post: 1.06, rails: [1, 0.5, 0.1], bar: 0.1, mat: M.signYellow, postW: 0.05 });
    A.board('misc', 'keepOut', 0.5, 0.37, [x + 0.05, PY + 0.8, gz], PI / 2, { frame: M.fenceWhite, border: 0.02 });
    A.board('misc', p.name === 'S' ? 'platNo1' : 'platNo2', 0.26, 0.26, [x + 0.05, PY + 1.35, gz + p.t * 1.1], PI / 2, { frame: M.fenceWhite, border: 0.02 });
    P.addAABB(p.x0, Math.min(zGate0, zGate1), p.x0 + 0.15, Math.max(zGate0, zGate1), -1, 5);
    // equipment box on legs near the end
    const ez = zAt(p, 3.3);
    { const kk = ctx.kit(k.group([p.x0 + 0.75, PY, ez], p.name === 'S' ? PI : 0)); kk.box(0.7, 1.0, 0.42, M.equip, [0, 0.62, 0]); kk.box(0.74, 0.04, 0.46, M.equipDark, [0, 1.13, 0]); for (const dx of [-0.3, 0.3]) kk.box(0.05, 0.12, 0.4, M.equipDark, [dx, 0.06, 0]); kk.box(0.01, 0.8, 0.02, M.equipDark, [0, 0.62, 0.215]); const lb = new THREE.Mesh(U.rectPlane(0.3, 0.12, A.tx.misc.r('equipLabel')), A.signMat('misc', false)); lb.position.set(0, 0.95, 0.213); kk.parent.add(lb); }
    P.addBox(p.x0 + 0.75, ez, 0.74, 0.46, 0, -1, 3);
  }
  // departure indicators (出発反応標識): A leaves westward (west end of 1番線), B eastward (east end of 2番線)
  const depInd = (x, z, rot, fn) => {
    k.cyl(0.05, 0.05, 2.4, M.steelDark, [x, PY + 1.2, z], null, 10);
    const g = k.group([x, PY + 2.4, z], rot); const kk = ctx.kit(g);
    kk.box(0.34, 0.34, 0.16, M.ink, [0, 0, 0]); kk.box(0.4, 0.04, 0.2, M.ink, [0, 0.2, 0.02]);
    kk.cyl(0.1, 0.1, 0.02, ctx.mat.toon('#b8bcc4'), [0, 0, 0.085], [PI / 2, 0, 0], 16);
    const lamp = new THREE.Mesh(ctx.geo.G.cyl(16), ctx.mat.emissive('#f4fbff', 2.4)); lamp.scale.set(0.2, 0.022, 0.2);
    const wp = new THREE.Vector3(0, 0, 0.098).applyAxisAngle(new THREE.Vector3(0, 1, 0), rot).add(new THREE.Vector3(x, PY + 2.4, z));
    lamp.position.copy(wp); lamp.rotation.set(PI / 2, rot, 0, 'YXZ'); A.dyn.add(lamp);
    A.blinkers.push({ mesh: lamp, fn });
    P.addCylinder(x, z, 0.08, -1, 4);
  };
  const tm = (t) => ((t % 120) + 120) % 120;
  depInd(S.x0 + 0.6, zAt(S, 0.5), PI / 2, (t) => { const m = tm(t); return m > L.SCHEDULE.A.departMelody && m < L.SCHEDULE.A.depart + 3; });
  depInd(N.x1 - 0.6, zAt(N, 0.5), -PI / 2, (t) => { const m = tm(t); return m > L.SCHEDULE.B.departMelody && m < L.SCHEDULE.B.depart + 3; });
  // crew mirrors (ホームミラー) ahead of each train's front: A front at x=-1 (west), B front at x=35 (east)
  const mirror = (x, z, rot) => {
    k.cyl(0.05, 0.06, 2.9, M.fenceWhite, [x, PY + 1.45, z], null, 10);
    for (let i = 0; i < 5; i++) k.box(0.13, 0.12, 0.13, i % 2 ? M.ink : M.signYellow, [x, PY + 0.1 + i * 0.12, z]);
    const g = k.group([x, PY + 2.55, z], rot); const kk = ctx.kit(g);
    kk.box(0.72, 1.02, 0.08, M.signYellow, [0, 0, 0]); kk.box(0.12, 0.08, 0.2, M.steelDark, [0, 0, -0.1]);
    const mm = kk.box(0.62, 0.92, 0.02, M.mirror, [0, 0, 0.045]); mm.castShadow = false;
    P.addCylinder(x, z, 0.1, -1, 4);
  };
  mirror(-3.2, zAt(S, 0.45), PI / 2 - 0.35);
  mirror(37.4, zAt(N, 0.45), -PI / 2 + 0.35 + PI * 0);
  // stop-position markers (停止位置 2両)
  const stopMark = (x, z, rot) => { k.cyl(0.03, 0.03, 1.2, M.steelDark, [x, PY + 0.6, z], null, 8); A.board('misc', 'stopPos', 0.22, 0.275, [x, PY + 1.35, z], rot, { frame: M.ink, border: 0.015 }); P.addCylinder(x, z, 0.05, -1, 3); };
  stopMark(-1.3, zAt(S, 0.2), PI / 2);
  stopMark(35.3, zAt(N, 0.2), -PI / 2);

  // ------------------------------------------------------------------ shelters
  const shelter = (p, xa, xb, cols) => {
    const bz = backZ(p), zBack = bz + p.t * 0.1, zFront = zAt(p, 0.6), zCol = bz + p.t * 0.6;
    const yB = PY + 3.17, yF = PY + 3.35; // roof top back / front
    const yAtZ = (z) => yB + (z - zBack) / (zFront - zBack) * (yF - yB);
    const ang = Math.atan2(yF - yB, Math.abs(zFront - zBack)) * (p.t < 0 ? 1 : -1);
    const depth = Math.abs(zFront - zBack), zc = (zBack + zFront) / 2;
    // roof deck
    const deck = k.box(xb - xa, 0.07, depth / Math.cos(Math.abs(ang)), M.shelterRoof, [(xa + xb) / 2, (yB + yF) / 2 - 0.035, zc], [ang, 0, 0]);
    k.box(xb - xa, 0.01, depth - 0.05, M.shelterUnder, [(xa + xb) / 2, (yB + yF) / 2 - 0.075, zc], [ang, 0, 0]);
    void deck;
    // corrugation ribs on top
    for (let x = xa + 0.25; x < xb; x += 0.5) k.box(0.04, 0.03, depth / Math.cos(Math.abs(ang)) - 0.04, M.shelterFascia, [x, (yB + yF) / 2 + 0.01, zc], [ang, 0, 0]);
    // front fascia with a thin line-colour band, back gutter
    k.box(xb - xa + 0.04, 0.24, 0.05, M.shelterFascia, [(xa + xb) / 2, yF - 0.08, zFront - p.t * 0.02]);
    k.box(xb - xa + 0.05, 0.04, 0.055, M.pinkBand, [(xa + xb) / 2, yF - 0.15, zFront - p.t * 0.02]);
    k.box(xb - xa, 0.1, 0.13, M.gutter, [(xa + xb) / 2, yB - 0.1, zBack - p.t * 0.02]);
    // purlins
    for (const f of [0.15, 0.5, 0.85]) { const z = zBack + (zFront - zBack) * f; k.box(xb - xa, 0.1, 0.06, M.shelterCol, [(xa + xb) / 2, yAtZ(z) - 0.14, z]); }
    // columns with cantilever beams, base plates, a few downpipes
    cols.forEach((x, i) => {
      const top = yAtZ(zCol) - 0.2;
      k.cyl(0.075, 0.075, top - PY, M.shelterCol, [x, (PY + top) / 2, zCol], null, 12);
      k.box(0.26, 0.03, 0.26, M.shelterCol, [x, PY + 0.015, zCol]);
      U.beam(k, [x, yAtZ(zBack) - 0.16, zBack], [x, yAtZ(zFront) - 0.16, zFront], 0.1, 0.2, M.shelterCol);
      U.beam(k, [x, top - 0.55, zCol], [x, yAtZ(zCol - p.t * -1.4) - 0.24, zCol + p.t * 1.4], 0.06, 0.08, M.shelterCol);
      if (i % 2 === 0) U.beam(k, [x + 0.12, yB - 0.12, zBack], [x + 0.12, PY + 0.05, zBack], 0.07, 0.07, M.gutter, true);
      P.addCylinder(x, zCol, 0.1, -1, 5);
    });
    // fluorescent tubes under the middle purlin
    const zl = zBack + (zFront - zBack) * 0.5;
    for (let x = xa + 1.2; x < xb - 0.8; x += 2.4) {
      k.box(1.3, 0.06, 0.16, M.shelterFascia, [x, yAtZ(zl) - 0.22, zl]);
      const tb = k.box(1.22, 0.025, 0.07, M.tube, [x, yAtZ(zl) - 0.255, zl]); tb.castShadow = false;
    }
    return { yAtZ, zBack, zFront, zCol };
  };
  const shS = shelter(S, 12.5, 28.5, [13.3, 16.6, 20.0, 23.4, 26.8]);
  const shN = shelter(N, 5.0, 25.0, [6.0, 9.6, 13.2, 16.8, 20.4, 24.0]);
  // light fixtures under the building's north eave too
  for (let x = -2.6; x < 12; x += 2.8) { k.box(1.3, 0.06, 0.16, M.shelterFascia, [x, 4.06, -36.1]); const tb = k.box(1.22, 0.025, 0.07, M.tube, [x, 4.025, -36.1]); tb.castShadow = false; }

  // ------------------------------------------------------------------ 駅名標 (standing ×2 + hanging ×1 per platform)
  // South platform boards face north (read looking south: east=春日野 on the LEFT, west=花見台 on the RIGHT → 'ekiS').
  // North platform boards face south (read looking north: west=花見台 on the left → 'ekiN'). Physically correct.
  const standing = (x, p) => {
    const faceN = p.name === 'S';
    const z = backZ(p) + p.t * 0.32, rot = faceN ? PI : 0, id = faceN ? 'ekiS' : 'ekiN';
    const w = 2.3, h = w * 360 / 1016, yc = PY + 1.25 + h / 2;
    for (const dx of [-w / 2 + 0.15, w / 2 - 0.15]) { k.box(0.08, yc + h / 2 - PY + 0.05, 0.08, M.shelterCol, [x + dx, (PY + yc + h / 2 + 0.05) / 2, z - p.t * 0.05]); k.box(0.2, 0.03, 0.2, M.shelterCol, [x + dx, PY + 0.015, z - p.t * 0.05]); P.addCylinder(x + dx, z - p.t * 0.05, 0.08, -1, 4); }
    A.board('signs', id, w, h, [x, yc, z + p.t * 0.01], rot, { frame: M.shelterFascia, border: 0.04, depth: 0.05 });
    k.box(w + 0.12, 0.06, 0.12, M.shelterFascia, [x, yc + h / 2 + 0.07, z]);
  };
  standing(-5.5, S); standing(35.3, S);
  standing(1.0, N); standing(30.6, N);
  const hanging = (x, p, sh) => {
    const z = zAt(p, 1.9), w = 1.9, h = w * 360 / 1016, yc = PY + 2.45;
    const g = k.group([x, yc, z], 0); const kk = ctx.kit(g);
    kk.box(w + 0.08, h + 0.08, 0.08, M.shelterFascia, [0, 0, 0]);
    const f1 = new THREE.Mesh(U.rectPlane(w, h, A.tx.signs.r('ekiN')), A.signMat('signs', 0.95)); f1.position.z = 0.043; g.add(f1);   // faces south
    const f2 = new THREE.Mesh(U.rectPlane(w, h, A.tx.signs.r('ekiS')), A.signMat('signs', 0.95)); f2.position.z = -0.043; f2.rotation.y = PI; g.add(f2); // faces north
    for (const dx of [-w * 0.38, w * 0.38]) U.beam(k, [x + dx, yc + h / 2 + 0.04, z], [x + dx, sh.yAtZ(z) - 0.14, z], 0.02, 0.02, M.steelDark, true);
  };
  hanging(21.7, S, shS); hanging(11.4, N, shN);

  // ------------------------------------------------------------------ hanging perpendicular signs, clocks, speakers, timetables
  const perp = (x, p, sh, idE, idW, atlas = 'signs', w = 1.4) => { // double-sided, faces east & west
    const z = zAt(p, 2.2), h = w * 128 / 500, yc = PY + 2.55;
    const g = k.group([x, yc, z], PI / 2); const kk = ctx.kit(g);
    kk.box(w + 0.06, h + 0.06, 0.06, M.shelterFascia, [0, 0, 0]);
    const aE = typeof idE === 'string' ? [atlas, idE] : idE, aW = typeof idW === 'string' ? [atlas, idW] : idW;
    const fE = new THREE.Mesh(U.rectPlane(w, h, A.tx[aE[0] === 'signs' ? 'signs' : aE[0]].r(aE[1])), A.signMat(aE[0], 0.95)); fE.position.z = 0.033; g.add(fE);
    const fW = new THREE.Mesh(U.rectPlane(w, h, A.tx[aW[0] === 'signs' ? 'signs' : aW[0]].r(aW[1])), A.signMat(aW[0], 0.95)); fW.position.z = -0.033; fW.rotation.y = PI; g.add(fW);
    for (const dz of [-w * 0.38, w * 0.38]) U.beam(k, [x, yc + h / 2 + 0.03, z + dz], [x, sh.yAtZ(z + dz) - 0.14, z + dz], 0.02, 0.02, M.steelDark, true);
  };
  perp(14.4, S, shS, ['face', 'exitUp'], 'toTrack2');
  perp(25.2, S, shS, 'plat1', 'plat1');
  perp(7.2, N, shN, ['misc', 'northExit'], ['face', 'exitUp']);
  perp(18.6, N, shN, 'plat2', 'plat2');
  // double-faced platform clocks (face east & west)
  const hClock = (x, p, sh) => { const z = zAt(p, 2.2), y = PY + 2.6; A.clock([x, y, z], PI / 2, 0.24, { double: true, lit: false, frame: M.shelterFascia }); U.beam(k, [x, y + 0.26, z], [x, sh.yAtZ(z) - 0.14, z], 0.03, 0.03, M.steelDark, true); };
  hClock(18.2, S, shS); hClock(14.9, N, shN);
  // small departure boards (発車標) near the building / north shelter start
  const dep = (x, p, sh, id) => { const z = zAt(p, 2.2), y = PY + 2.45, w = 1.0, h = 0.42; const g = k.group([x, y, z], p.name === 'S' ? -PI / 2 : PI / 2); const kk = ctx.kit(g); kk.box(w + 0.08, h + 0.08, 0.12, M.darkPanel, [0, 0, 0]); const f = new THREE.Mesh(U.rectPlane(w, h, A.tx.TVM.r(id)), A.signMat('TVM', 1.1)); f.position.z = 0.062; g.add(f); for (const dz of [-0.35, 0.35]) U.beam(k, [x, y + h / 2 + 0.04, z + dz], [x, sh.yAtZ(z + dz) - 0.14, z + dz], 0.02, 0.02, M.steelDark, true); };
  dep(13.1, S, shS, 'depSmall'); dep(5.6, N, shN, 'depSmall2');
  // horn speakers on columns
  for (const [x, p, sh] of [[16.6, S, shS], [23.4, S, shS], [9.6, N, shN], [16.8, N, shN], [24.0, N, shN]]) {
    const z = sh.zCol, y = PY + 2.75;
    const g = k.group([x, y, z - p.t * 0.12], p.name === 'S' ? PI : 0); const kk = ctx.kit(g);
    kk.box(0.08, 0.12, 0.1, M.shelterFascia, [0, 0, -0.04]);
    kk.cyl(0.11, 0.04, 0.22, M.shelterFascia, [0, 0, 0.1], [PI / 2 + 0.25, 0, 0], 12);
  }
  for (const x of [2.0, 9.2]) { const g = k.group([x, 3.85, -35.62], PI); ctx.kit(g).cyl(0.11, 0.04, 0.22, M.shelterFascia, [0, 0, 0.1], [PI / 2 + 0.3, 0, 0], 12); }
  // timetables on columns (facing the walkers from the building / west side)
  A.board('I', 'tt1', 0.44, 0.616, [13.3 - 0.085, PY + 1.55, shS.zCol], -PI / 2, { frame: M.shelterFascia, border: 0.02 });
  A.board('I', 'tt2', 0.44, 0.616, [6.0 - 0.085, PY + 1.55, shN.zCol], -PI / 2, { frame: M.shelterFascia, border: 0.02 });
  // building north wall (platform side): timetable, poster, 1番線 plate
  A.board('I', 'tt1', 0.5, 0.7, [0.2, PY + 1.5, -35.52], PI, { frame: M.fascia, border: 0.02 });
  A.board('P', 'safety', 0.42, 0.595, [-3.45, PY + 1.55, -35.52], PI, { frame: null });
  A.board('P', 'wantedPoster', 0.42, 0.6, [5.2, PY + 1.55, -35.52], PI, { frame: null });

  // ------------------------------------------------------------------ benches
  const benchA = (x, z, rot, len = 1.8) => { // wooden slats, dark green cast frame
    const g = k.group([x, PY, z], rot); const kk = ctx.kit(g);
    for (let i = 0; i < 4; i++) kk.rbox(len, 0.035, 0.09, 0.012, M.benchSlat, [0, 0.425, -0.15 + i * 0.1]);
    for (let i = 0; i < 3; i++) kk.rbox(len, 0.08, 0.03, 0.012, M.benchSlat, [0, 0.58 + i * 0.12, -0.24 - i * 0.02], [-0.18, 0, 0]);
    for (const dx of [-len / 2 + 0.14, len / 2 - 0.14]) {
      kk.box(0.05, 0.42, 0.06, M.benchGreen, [dx, 0.21, 0.14]); kk.box(0.05, 0.84, 0.06, M.benchGreen, [dx, 0.42, -0.2], [-0.12, 0, 0]);
      kk.box(0.05, 0.05, 0.44, M.benchGreen, [dx, 0.4, -0.03]); kk.box(0.05, 0.04, 0.34, M.benchGreen, [dx, 0.64, 0.02]);
      kk.box(0.05, 0.2, 0.04, M.benchGreen, [dx, 0.54, 0.18]);
    }
    const c = Math.cos(rot), s = Math.sin(rot);
    P.addBox(x, z, len, 0.5, rot, -1, PY + 0.8);
    A.benches.push({ x, z, y: PY + 0.445, rotY: rot, len });
    void c; void s;
  };
  const benchB = (x, z, rot, n = 4, m = M.benchBlue) => { // FRP bucket seats on a steel beam
    const pitch = 0.48, len = n * pitch;
    const g = k.group([x, PY, z], rot); const kk = ctx.kit(g);
    kk.box(len, 0.06, 0.08, M.steelDark, [0, 0.3, -0.05]);
    for (const dx of [-len / 2 + 0.3, len / 2 - 0.3]) { kk.box(0.06, 0.3, 0.06, M.steelDark, [dx, 0.15, -0.05]); kk.box(0.3, 0.02, 0.36, M.steelDark, [dx, 0.01, -0.05]); }
    for (let i = 0; i < n; i++) {
      const sx = -len / 2 + pitch * (i + 0.5);
      kk.rbox(0.44, 0.06, 0.42, 0.03, m, [sx, 0.42, 0.0]);
      kk.rbox(0.44, 0.4, 0.05, 0.03, m, [sx, 0.66, -0.2], [-0.14, 0, 0]);
      kk.box(0.06, 0.1, 0.08, M.steelDark, [sx, 0.36, -0.05]);
    }
    P.addBox(x, z, len, 0.5, rot, -1, PY + 0.8);
    A.benches.push({ x, z, y: PY + 0.45, rotY: rot, len });
  };
  const B1 = L.PLATFORM.benchB1;
  benchA(B1.x, B1.z, B1.rotY, 1.8);
  benchB(-2.0, -35.84, PI, 4, M.benchBlue);
  benchA(25.1, -36.15, PI, 1.8);
  benchB(33.4, -35.84, PI, 3, M.benchBrown);
  benchA(7.8, -49.85, 0, 1.8);
  benchB(15.0, -49.84, 0, 4, M.benchBlue);
  benchA(22.2, -49.85, 0, 1.8);
  benchB(31.0, -49.84, 0, 3, M.benchGreen);

  // ------------------------------------------------------------------ sorted bin units (カン・ビン / ペットボトル / 燃えるゴミ)
  const binUnit = (x, z, rot) => {
    const g = k.group([x, PY, z], rot); const kk = ctx.kit(g);
    const ms = [M.binBlue, M.binGreen, M.binRed], labs = ['binCan', 'binPet', 'binBurn'];
    for (let i = 0; i < 3; i++) {
      const bx = (i - 1) * 0.42;
      kk.rbox(0.4, 0.9, 0.38, 0.04, ms[i], [bx, 0.45, 0]); kk.box(0.42, 0.05, 0.4, M.binGrey, [bx, 0.92, 0]);
      kk.box(0.2, 0.07, 0.03, M.darkPanel, [bx, 0.8, 0.19]);
      const lb = new THREE.Mesh(U.rectPlane(0.28, 0.14, A.tx.B.r(labs[i])), A.signMat('B', false)); lb.position.set(bx, 0.58, 0.192); g.add(lb);
    }
    kk.box(1.3, 0.04, 0.42, M.binGrey, [0, 0.02, 0]);
    P.addBox(x, z, 1.3, 0.42, rot, -1, 3);
  };
  if (A.X) { // modelled bins (lids with round holes / flap slot) shared with the concourse
    A.X.binUnit(21.8, -35.8, PI, { y: PY, warm: false });
    A.X.binUnit(11.5, -50.2, 0, { y: PY, warm: false });
    A.X.binUnit(-0.9, -35.78, PI, { y: PY, warm: false });
  } else { binUnit(21.8, -35.84, PI); binUnit(11.5, -50.16, 0); binUnit(-0.9, -35.8, PI); }

  // ------------------------------------------------------------------ column fittings: ホーム非常停止ボタン boxes + extinguisher boxes
  if (A.X) {
    const X = A.X, C = X.C;
    const red = ctx.mat.toon('#cc4a42', { paint: 0.03 }), ylw = ctx.mat.toon('#e8c24a', { paint: 0.03 }), wht = ctx.mat.toon('#e2e3df', { paint: 0.03 });
    const emStop = (x, zc, face) => { // mounted on a shelter column, facing along x (toward walkers)
      const g = X.grp(x + face * 0.08, PY + 1.35, zc, face > 0 ? PI / 2 : -PI / 2); const kk = X.K(g);
      kk.rb(0.24, 0.3, 0.1, 0.015, ylw, [0, 0, 0.0]);
      X.lab(g, 'N', 'emStop', 0.2, 0.2, [0, 0.03, 0.0505], null, false);
      kk.rb(0.12, 0.08, 0.05, 0.012, wht, [0, -0.1, 0.06]); kk.cz(0.035, 0.03, red, [0, -0.1, 0.095], 16);
      kk.box(0.26, 0.03, 0.12, ylw, [0, 0.165, 0.005]);
      for (const y of [-0.08, 0.08]) kk.box(0.18, 0.02, 0.04, C.steelDk, [0, y, -0.065]);
    };
    const fireCol = (x, zc, face) => {
      const g = X.grp(x + face * 0.1, PY + 0.42, zc, face > 0 ? PI / 2 : -PI / 2); const kk = X.K(g);
      kk.box(0.3, 0.02, 0.2, red, [0, -0.41, 0]); kk.box(0.3, 0.62, 0.02, red, [0, -0.1, -0.09]);
      for (const s of [-1, 1]) kk.box(0.02, 0.62, 0.2, red, [s * 0.14, -0.1, 0]);
      kk.rb(0.32, 0.03, 0.22, 0.008, red, [0, 0.22, 0]); kk.box(0.26, 0.12, 0.012, red, [0, 0.14, 0.095]);
      X.lab(g, 'N', 'fireSign', 0.22, 0.07, [0, 0.14, 0.102], null, false);
      X.fireExtinguisher(kk, 0, -0.4, -0.01, 0.85);
    };
    emStop(16.6, shS.zCol, -1); emStop(23.4, shS.zCol, -1); emStop(9.6, shN.zCol, -1); emStop(20.4, shN.zCol, -1);
    fireCol(20.0, shS.zCol, 1); fireCol(13.2, shN.zCol, 1);
    P.addBox(20.2, shS.zCol, 0.3, 0.3, 0, -1, PY + 1); P.addBox(13.4, shN.zCol, 0.3, 0.3, 0, -1, PY + 1);
  }

  // ------------------------------------------------------------------ tactile guide line on platform 1 (from the gate opening)
  U.worldUV(k.box(0.3, 0.01, Math.abs(zAt(S, 1.14) - S.z1) - 0.02, M.tactLine, [7.05, PY + 0.005, (zAt(S, 1.14) + S.z1) / 2]), 0.3);

  // ------------------------------------------------------------------ north exit (北口): IC stand, landing, ramp down behind the platform to R4
  {
    const nz0 = -52.0, nz1 = N.z0; // strip behind the north platform
    const lx0 = -6.4, lx1 = -3.6, rx1 = 7.4, yFoot = L.heightAt(7.4, -51.25) + 0.02;
    // landing deck at platform level
    U.worldUV(k.box(lx1 - lx0, PY - GROUND, nz1 - nz0, M.concreteSide, [(lx0 + lx1) / 2, (PY + GROUND) / 2, (nz0 + nz1) / 2]), 2);
    U.worldUV(k.box(lx1 - lx0, 0.02, nz1 - nz0, M.concrete, [(lx0 + lx1) / 2, PY - 0.008, (nz0 + nz1) / 2]), [8, 4]);
    P.addWalkBox((lx0 + lx1) / 2, (nz0 + nz1) / 2, lx1 - lx0, nz1 - nz0, 0, PY);
    // ramp body + surface
    const g = ctx.geo.extrude([[lx1, GROUND], [rx1, GROUND], [rx1, yFoot], [lx1, PY]], nz1 - nz0);
    k.mesh(g, M.concreteSide, [0, 0, (nz0 + nz1) / 2]);
    const Ls = Math.hypot(rx1 - lx1, PY - yFoot), ang = Math.atan2(yFoot - PY, rx1 - lx1);
    U.worldUV(k.box(Ls, 0.02, nz1 - nz0, M.concrete, [(lx1 + rx1) / 2, (PY + yFoot) / 2 - 0.002, (nz0 + nz1) / 2], [0, 0, ang]), [8, 4]);
    P.addWalkRamp((lx1 + rx1) / 2, (nz0 + nz1) / 2, nz1 - nz0, rx1 - lx1, -PI / 2, yFoot, PY);
    // paved path from the ramp foot north to the lane
    U.worldUV(k.box(1.6, 0.04, 2.0, M.paving, [8.2, L.heightAt(8.2, -52.5) + 0.0, -52.3]), 2.4);
    U.worldUV(k.box(1.0, 0.04, 1.5, M.paving, [7.9, yFoot - 0.01, -51.25]), 2.4);
    // railings: outer (north) side of landing + ramp, west side of landing
    const rampY = (x) => (x <= lx1 ? PY : PY + (x - lx1) / (rx1 - lx1) * (yFoot - PY));
    U.railing(k, [[lx0 + 0.05, nz0 + 0.06], [lx1, nz0 + 0.06], [rx1, nz0 + 0.06]], (x) => rampY(x), { h: 1.1, post: 1.8, rails: [1, 0.55, 0.1], bar: 0.15, barLo: 0.12, mat: M.fenceWhite, postW: 0.06 });
    U.railing(k, [[lx0 + 0.05, nz1], [lx0 + 0.05, nz0 + 0.06]], PY, { h: 1.1, post: 1.5, rails: [1, 0.55, 0.1], bar: 0.15, mat: M.fenceWhite, postW: 0.06 });
    P.addAABB(lx0, nz0 - 0.1, rx1, nz0 + 0.12, -1, 5);
    P.addAABB(lx0 - 0.05, nz0, lx0 + 0.12, nz1, -1, 5);
    // handrail on the platform wall side
    for (const h of [0.85, 0.65]) U.beam(k, [lx1, PY + h, nz1 - 0.08], [rx1, yFoot + h, nz1 - 0.08], 0.04, 0.04, M.stainless, true);
    // simple IC gate stand (2 pedestals) in the fence opening
    for (const x of [-5.6, -4.45]) {
      const kk = ctx.kit(k.group([x, PY, -50.55], 0));
      kk.rbox(0.26, 1.0, 0.4, 0.04, M.gateBody, [0, 0.5, 0]); kk.box(0.28, 0.03, 0.42, M.gateTop, [0, 1.015, 0]);
      const p1 = new THREE.Mesh(U.rectPlane(0.16, 0.16, A.tx.face.r('icPad')), A.signMat('face', 1.15)); p1.position.set(0, 1.035, 0.08); p1.rotation.x = -PI / 2; kk.parent.add(p1);
      const p2 = new THREE.Mesh(U.rectPlane(0.16, 0.16, A.tx.face.r('icPad')), A.signMat('face', 1.15)); p2.position.set(0, 1.035, -0.1); p2.rotation.set(-PI / 2, 0, PI); kk.parent.add(p2);
      const ind = new THREE.Mesh(U.rectPlane(0.08, 0.08, A.tx.face.r('gateGo')), A.signMat('face', 1.2)); ind.position.set(0, 0.85, 0.202); kk.parent.add(ind);
      P.addBox(x, -50.55, 0.28, 0.42, 0, -1, 3);
    }
    // small canopy + 北口 sign
    for (const x of [-6.2, -3.8]) k.cyl(0.05, 0.05, 2.35, M.shelterCol, [x, PY + 1.175, -51.9], null, 10);
    k.box(2.8, 0.08, 2.2, M.shelterRoof, [-5.0, PY + 2.4, -51.0]);
    k.box(2.84, 0.18, 0.05, M.shelterFascia, [-5.0, PY + 2.33, -49.9]);
    k.box(2.84, 0.035, 0.055, M.pinkBand, [-5.0, PY + 2.27, -49.9]);
    A.board('misc', 'northExit', 1.2, 0.307, [-5.0, PY + 2.05, -49.93], 0, { frame: M.shelterFascia, border: 0.03, lit: 0.95 });
    const tb = k.box(1.22, 0.025, 0.07, M.tube, [-5.0, PY + 2.34, -51.0]); tb.castShadow = false;
  }
}
