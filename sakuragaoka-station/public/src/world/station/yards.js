// Station yards: STATION.sideYard (x 12..27) — station garden with brick flower beds, azalea /
// yukiyanagi shrubs, a retired-wheelset monument, the public toilet block, a drinking fountain,
// a tool shed and the staff bicycle shed; STATION.westYard (x -9.25..-4) — LOW things only
// (hedge, planters, notice board, pots); and the weeds / dandelions / daisies / nanohana / low
// shrubs growing outside both platform fences.
import * as THREE from 'three';

export function buildYards(A) {
  const { ctx, k, U, M, P, L } = A;
  const PI = Math.PI;
  const r = ctx.rng('station-yards');
  const hAt = L.heightAt;
  const F = A.tx.FOL;
  const C = U.cards(); // every vegetation card of the yards -> ONE mesh

  const azalea = ctx.mat.toon('#f0aac8', { paint: 0.08 });
  const azaleaDeep = ctx.mat.toon('#e493b6', { paint: 0.08 });
  const wheelRed = ctx.mat.toon('#94504a', { paint: 0.05 });
  const hoseGreen = ctx.mat.toon('#4f8a5c', { paint: 0.03 });
  const bucketBlue = ctx.mat.toon('#4f86c0', { paint: 0.03 });
  const tileLow = ctx.mat.toon('#a9c6b4', { paint: 0.05 });
  const tileIn = ctx.mat.toon('#7f958b', { paint: 0.04 });
  const floorDark = ctx.mat.toon('#8f9690', { paint: 0.04 });

  /** cloud-like bush: a big core lobe + 3–5 smaller lobes on a dome (clean cel silhouette).
   *  bloom: optional material for the upper lobes (azalea / yukiyanagi flowering on green) */
  const bush = (x, z, s, m, bloom = null, y = null) => {
    const yb = y ?? hAt(x, z);
    const core = k.sphere(s * 0.78, m, [x, yb + s * 0.5, z], 8); core.scale.y *= 0.8;
    const n = 3 + Math.floor(r() * 3), a0 = r() * PI * 2;
    for (let i = 0; i < n; i++) {
      const a = a0 + i * PI * 2 / n + (r() - 0.5) * 0.5, d = s * (0.5 + r() * 0.15), rr = s * (0.42 + r() * 0.16);
      const fl = bloom && i % 2 === 0, up = fl ? 0.3 : 0.12 + r() * 0.2;
      const b = k.sphere(fl ? rr * 0.72 : rr, fl ? bloom : m, [x + Math.cos(a) * d * (fl ? 1.05 : 1), yb + s * (0.38 + up), z + Math.sin(a) * d * (fl ? 1.05 : 1)], 8);
      b.scale.y *= 0.82;
    }
    if (bloom && r() < 0.6) { const t = k.sphere(s * 0.34, bloom, [x + (r() - 0.5) * s * 0.3, yb + s * 0.95, z + (r() - 0.5) * s * 0.3], 8); t.scale.y *= 0.75; }
  };
  /** weed / flower strip along x at centre z (half width hw), ground from heightAt or y */
  const weeds = (x0, x1, zc, hw, o = {}) => {
    const dens = o.dens ?? 5; // tufts per metre
    const n = Math.round((x1 - x0) * dens);
    for (let i = 0; i < n; i++) {
      const x = x0 + (x1 - x0) * (i + r()) / n, z = zc + (r() * 2 - 1) * hw;
      const y = (o.y ?? hAt(x, z)) - 0.01;
      const q = r();
      let id, s, h;
      if (q < (o.flowers ?? 0.3) * 0.35) { id = 'dandelion'; s = 0.26; h = 0.24; }
      else if (q < (o.flowers ?? 0.3) * 0.7) { id = 'daisy'; s = 0.24; h = 0.2; }
      else if (q < (o.flowers ?? 0.3)) { id = o.nanohana ? 'nanohana' : 'tsukushi'; s = o.nanohana ? 0.42 : 0.26; h = o.nanohana ? 0.55 : 0.22; }
      else { id = r() < 0.5 ? 'grass' : 'grass2'; s = 0.3 + r() * 0.22; h = s * (0.8 + r() * 0.5) * (o.tall ?? 1); }
      C.cross(x, y, z, s, h, r() * PI, F.r(id), (r() - 0.5) * 0.08);
    }
  };

  // ==================================================================== SIDE YARD (x 12..27, z -35.5..-25)
  const SY = L.STATION.sideYard;
  // ---- ground: gravel on the flat part, grass on the slope down to the platform wall
  A.root.add(U.groundPatch(SY.x0 + 0.02, SY.x1, -33.0, SY.z1 - 0.04, M.gravel, 0.012, 1.0));
  { const m = U.groundPatch(SY.x0 + 0.02, SY.x1, SY.z0 + 0.02, -33.0, M.grass, 0.014, 0.5); A.root.add(m); }
  for (const m of A.root.children.slice(-2)) U.worldUV(m, 1.6);
  // paved path from the plaza to the toilet + fountain apron
  const pave = (x0, x1, z0, z1) => U.worldUV(k.box(x1 - x0, 0.03, z1 - z0, M.paving, [(x0 + x1) / 2, 0.015, (z0 + z1) / 2]), 2.4);
  pave(16.2, 22.2, -26.4, -25.03);
  pave(15.9, 17.0, -27.9, -26.4);

  // ---- public toilet block (お手洗い) x 17.2..21.8, z -30.6..-26.4, faces the plaza
  {
    const X0 = 17.2, X1 = 21.8, Z0 = -30.6, Z1 = -26.4, B0 = 0.15, WT = 2.85, OT = 2.05, T = 0.15;
    k.box(X1 - X0 + 0.1, B0, Z1 - Z0 + 0.1, M.plinth, [(X0 + X1) / 2, B0 / 2, (Z0 + Z1) / 2]);
    const openS = [{ a0: 17.6, a1: 18.5, y0: 0, y1: OT }, { a0: 19.05, a1: 19.95, y0: 0, y1: OT }, { a0: 20.5, a1: 21.4, y0: 0, y1: OT }];
    // lower wainscot of pale green tile, cream plaster above, thin band between
    const skin = (m, y0, y1, tile) => {
      U.wall(k, m, 'x', Z1 - T, Z1, X0, X1, y0, y1, openS, tile);
      U.wall(k, m, 'x', Z0, Z0 + T, X0, X1, y0, y1, [], tile);
      U.wall(k, m, 'z', X0, X0 + T, Z0 + T, Z1 - T, y0, y1, [], tile);
      U.wall(k, m, 'z', X1 - T, X1, Z0 + T, Z1 - T, y0, y1, [], tile);
    };
    skin(tileLow, B0, 1.15, null);
    skin(M.plasterExt, 1.15, WT, 3.0);
    k.box(X1 - X0 + 0.03, 0.06, 0.03, M.band, [(X0 + X1) / 2, 1.15, Z1 + 0.012]);
    k.box(X1 - X0 + 0.03, 0.06, 0.03, M.band, [(X0 + X1) / 2, 1.15, Z0 - 0.012]);
    k.box(0.03, 0.06, Z1 - Z0 + 0.03, M.band, [X0 - 0.012, 1.15, (Z0 + Z1) / 2]);
    k.box(0.03, 0.06, Z1 - Z0 + 0.03, M.band, [X1 + 0.012, 1.15, (Z0 + Z1) / 2]);
    // vestibules behind the two open doorways (closed boxes so the hollow shell is never seen)
    for (const [a0, a1] of [[17.6, 18.5], [20.5, 21.4]]) {
      const zb = Z1 - 1.0, cx = (a0 + a1) / 2;
      k.box(a1 - a0 + 0.3, OT - B0, 0.08, tileIn, [cx, (B0 + OT) / 2, zb]);
      k.box(0.06, OT - B0, Z1 - T - zb, tileIn, [a0 + 0.03, (B0 + OT) / 2, (Z1 - T + zb) / 2]);
      k.box(0.06, OT - B0, Z1 - T - zb, tileIn, [a1 - 0.03, (B0 + OT) / 2, (Z1 - T + zb) / 2]);
      k.box(a1 - a0, 0.05, Z1 - zb, M.sill, [cx, OT + 0.025, (Z1 + zb) / 2]);
      k.box(a1 - a0, 0.02, Z1 - zb, floorDark, [cx, B0 + 0.01, (Z1 + zb) / 2]);
      k.box(a1 - a0 + 0.08, 0.06, 0.1, M.trim, [cx, OT + 0.03, Z1 + 0.03]); // lintel trim
      for (const x of [a0, a1]) k.box(0.05, OT - B0, 0.1, M.trim, [x, (B0 + OT) / 2, Z1 + 0.02]);
    }
    // multipurpose (多目的) toilet: closed sliding door
    {
      const a0 = 19.05, a1 = 19.95, cx = (a0 + a1) / 2;
      k.box(a1 - a0, OT - B0, 0.05, M.sill, [cx, (B0 + OT) / 2, Z1 - 0.08]);
      k.box(a1 - a0 + 0.08, 0.06, 0.1, M.alu, [cx, OT + 0.03, Z1 + 0.03]);
      for (const x of [a0, a1]) k.box(0.05, OT - B0, 0.1, M.alu, [x, (B0 + OT) / 2, Z1 + 0.02]);
      k.box(0.04, 0.5, 0.05, M.stainless, [a1 - 0.14, 1.05, Z1 - 0.03]);
      A.plane('misc', 'wcMulti', 0.26, 0.26, [cx, 1.5, Z1 - 0.05], 0);
      k.box(0.32, 0.12, 0.02, M.signRed, [cx, 1.2, Z1 - 0.05]); // 使用中 indicator (off-red)
    }
    A.plane('misc', 'wcMen', 0.24, 0.24, [18.05, 2.2, Z1 + 0.008], 0);
    A.plane('misc', 'wcWomen', 0.24, 0.24, [20.95, 2.2, Z1 + 0.008], 0);
    A.board('misc', 'toilet', 1.7, 0.374, [19.5, 2.6, Z1 + 0.035], 0, { frame: M.trim, border: 0.03 });
    // frosted high windows on the side walls
    for (const [x, rot] of [[X0 - 0.012, -PI / 2], [X1 + 0.012, PI / 2]]) for (const z of [-29.6, -27.6]) {
      k.plane(1.0, 0.34, M.frost, [x, 2.35, z], [0, rot, 0]);
      k.box(0.04, 0.05, 1.08, M.trim, [x, 2.55, z]); k.box(0.04, 0.05, 1.08, M.trim, [x, 2.15, z]);
      k.box(0.06, 0.04, 1.14, M.sill, [x + (x > 19 ? 0.02 : -0.02), 2.12, z]);
    }
    // flat roof with overhang, dark fascia, vent stack, gutter + downpipe
    const rx0 = X0 - 0.35, rx1 = X1 + 0.35, rz0 = Z0 - 0.3, rz1 = Z1 + 0.55;
    k.box(rx1 - rx0, 0.14, rz1 - rz0, M.roof, [(rx0 + rx1) / 2, WT + 0.07, (rz0 + rz1) / 2]);
    k.box(rx1 - rx0 + 0.04, 0.24, 0.05, M.fascia, [(rx0 + rx1) / 2, WT + 0.06, rz1]);
    k.box(rx1 - rx0 + 0.04, 0.24, 0.05, M.fascia, [(rx0 + rx1) / 2, WT + 0.06, rz0]);
    k.box(0.05, 0.24, rz1 - rz0, M.fascia, [rx0, WT + 0.06, (rz0 + rz1) / 2]);
    k.box(0.05, 0.24, rz1 - rz0, M.fascia, [rx1, WT + 0.06, (rz0 + rz1) / 2]);
    k.box(rx1 - rx0 - 0.1, 0.02, rz1 - Z1 - 0.05, M.soffit, [(rx0 + rx1) / 2, WT - 0.01, (Z1 + rz1) / 2]);
    k.cyl(0.07, 0.07, 0.6, M.gutter, [21.0, WT + 0.44, -29.8], null, 10);
    k.cyl(0.1, 0.1, 0.06, M.gutter, [21.0, WT + 0.76, -29.8], null, 10);
    U.beam(k, [rx1 - 0.1, WT + 0.02, rz0 + 0.1], [X1 + 0.07, WT - 0.3, Z0 + 0.12], 0.08, 0.08, M.gutter, true);
    U.beam(k, [X1 + 0.07, WT - 0.3, Z0 + 0.12], [X1 + 0.07, 0.1, Z0 + 0.12], 0.08, 0.08, M.gutter, true);
    // ceiling lamp under the front eave (daytime: off-white, faintly lit)
    k.box(0.5, 0.06, 0.12, M.shelterFascia, [19.5, WT - 0.05, Z1 + 0.3]);
    k.box(0.44, 0.02, 0.07, M.tubeWarm, [19.5, WT - 0.085, Z1 + 0.3]).castShadow = false;
    // grime at the plinth + a few streaks
    for (const [x, z, rot, w] of [[19.5, Z1 + 0.01, 0, 4.4], [19.5, Z0 - 0.01, PI, 4.4], [X1 + 0.01, -28.5, PI / 2, 4.0]]) k.plane(w, 0.4, M.grime, [x, 0.36, z], [0, rot, 0]).receiveShadow = true;
    P.addBox((X0 + X1) / 2, (Z0 + Z1) / 2, X1 - X0 + 0.1, Z1 - Z0 + 0.1, 0, -1, 4);
    // shrubs framing the toilet front
    bush(16.7, -29.9, 0.42, M.shrub); bush(22.35, -27.0, 0.38, M.shrubLight, M.yukiyanagi);
  }

  // ---- drinking fountain / hand-wash (水飲み場) next to the path
  {
    const x = 16.45, z = -27.25;
    k.rbox(0.32, 0.78, 0.32, 0.04, M.stoneGrey, [x, 0.03 + 0.39, z]);
    k.box(0.52, 0.1, 0.4, M.stainless, [x, 0.85, z]);
    k.box(0.44, 0.02, 0.32, M.steelDark, [x, 0.9, z]);
    k.cyl(0.018, 0.018, 0.16, M.stainless, [x, 0.98, z - 0.12], null, 8);
    U.beam(k, [x, 1.05, z - 0.12], [x, 1.05, z - 0.02], 0.03, 0.03, M.stainless, true);
    k.box(0.06, 0.03, 0.03, M.signBlue ?? M.navy, [x, 1.07, z - 0.14]);
    A.plane('misc', 'tapSign', 0.24, 0.12, [x, 0.6, z + 0.165], 0);
    P.addCylinder(x, z, 0.3, -1, 1.1);
    // hose reel + blue bucket + broom beside it
    const hk = ctx.kit(k.group([16.2, 0.03, -28.55], 0.3));
    hk.cyl(0.16, 0.16, 0.1, hoseGreen, [0, 0.24, 0], [PI / 2, 0, 0], 14);
    hk.box(0.03, 0.4, 0.12, M.steelDark, [-0.1, 0.2, 0]); hk.box(0.03, 0.4, 0.12, M.steelDark, [0.1, 0.2, 0]);
    hk.box(0.36, 0.03, 0.2, M.steelDark, [0, 0.015, 0]);
    k.cyl(0.14, 0.11, 0.26, bucketBlue, [16.95, 0.16, -27.95], null, 14);
    k.cyl(0.12, 0.12, 0.01, M.steelDark, [16.95, 0.28, -27.95], null, 14);
    P.addCylinder(16.2, -28.55, 0.28, -1, 1);
  }

  // ---- tool shed (物置) + staff bicycle shed (職員用駐輪場)
  {
    const x0 = 23.0, x1 = 25.4, z0 = -30.1, z1 = -28.7, H = 2.0;
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    k.box(x1 - x0 + 0.1, 0.08, z1 - z0 + 0.1, M.plinth, [cx, 0.04, cz]);
    k.rbox(x1 - x0, H - 0.08, z1 - z0, 0.02, M.pastelGreen, [cx, 0.08 + (H - 0.08) / 2, cz]);
    // sliding doors with ribs, handles, label
    for (const [dx, dz] of [[-0.55, 0.012], [0.5, 0.03]]) {
      k.box(1.12, H - 0.35, 0.02, M.sill, [cx + dx, 0.2 + (H - 0.35) / 2, z1 + dz]);
      for (let i = -2; i <= 2; i++) k.box(0.025, H - 0.4, 0.015, M.band, [cx + dx + i * 0.2, 0.2 + (H - 0.35) / 2, z1 + dz + 0.012]);
    }
    k.box(0.1, 0.04, 0.04, M.steelDark, [cx - 0.08, 1.0, z1 + 0.05]);
    A.plane('misc', 'shedLabel', 0.4, 0.12, [cx + 0.5, 1.62, z1 + 0.058], 0);
    k.box(x1 - x0, 0.03, 0.04, M.aluDark, [cx, 0.19, z1 + 0.03]);
    // pent roof
    const g = k.group([cx, H + 0.06, cz], 0); g.rotation.x = 0.08;
    ctx.kit(g).box(x1 - x0 + 0.24, 0.07, z1 - z0 + 0.3, M.roofSeam, [0, 0, 0]);
    for (let i = 0; i < 7; i++) ctx.kit(g).box(0.03, 0.03, z1 - z0 + 0.3, M.roof, [-1.2 + i * 0.4, 0.045, 0]);
    P.addBox(cx, cz, x1 - x0 + 0.1, z1 - z0 + 0.1, 0, -1, 3);
    // watering can + broom leaning on the shed
    const wk = ctx.kit(k.group([22.75, 0.02, -28.9], -0.4));
    wk.cyl(0.1, 0.12, 0.26, hoseGreen, [0, 0.13, 0], null, 12);
    U.beam(wk, [0.1, 0.12, 0], [0.3, 0.3, 0], 0.03, 0.03, hoseGreen, true);
    U.beam(wk, [-0.08, 0.3, 0], [0.06, 0.3, 0], 0.02, 0.02, hoseGreen, true);
    U.beam(k, [25.6, 0.05, -28.72], [25.52, 1.35, -28.93], 0.03, 0.03, M.woodLight, true);
    k.box(0.26, 0.2, 0.06, M.woodDark, [25.605, 0.12, -28.7], [0, 0, 0.05]);
  }
  {
    const x0 = 22.3, x1 = 26.7, zB = -32.85, zF = -30.95, yB = 2.05, yF = 2.3;
    const posts = [[x0 + 0.1, zB], [x1 - 0.1, zB], [x0 + 0.1, zF], [x1 - 0.1, zF], [(x0 + x1) / 2, zB], [(x0 + x1) / 2, zF]];
    for (const [x, z] of posts) {
      const top = z === zB ? yB : yF;
      k.box(0.08, top, 0.08, M.steelDark, [x, top / 2, z]); k.box(0.2, 0.04, 0.2, M.stoneGrey, [x, 0.02, z]);
      P.addBox(x, z, 0.12, 0.12, 0, -1, 3);
    }
    const ang = Math.atan2(yF - yB, zF - zB), len = Math.hypot(yF - yB, zF - zB) + 0.5;
    const rg = k.group([(x0 + x1) / 2, (yB + yF) / 2 + 0.06, (zB + zF) / 2], 0); rg.rotation.x = -ang;
    const rk = ctx.kit(rg);
    rk.box(x1 - x0 + 0.3, 0.05, len, M.shelterRoof, [0, 0, 0]);
    for (let i = 0; i < 12; i++) rk.box(0.03, 0.03, len, M.shelterFascia, [-(x1 - x0) / 2 + i * 0.4, 0.035, 0]);
    k.box(x1 - x0 + 0.3, 0.12, 0.06, M.steelDark, [(x0 + x1) / 2, yF - 0.02, zF]);
    k.box(x1 - x0 + 0.3, 0.12, 0.06, M.steelDark, [(x0 + x1) / 2, yB - 0.02, zB]);
    // wheel rack (front-wheel slots)
    k.box(x1 - x0 - 0.3, 0.05, 0.05, M.steel, [(x0 + x1) / 2, 0.32, zB + 0.45]);
    k.box(x1 - x0 - 0.3, 0.04, 0.04, M.steel, [(x0 + x1) / 2, 0.06, zB + 0.25]);
    for (let x = x0 + 0.45; x < x1 - 0.3; x += 0.62) { k.box(0.03, 0.3, 0.36, M.steel, [x - 0.07, 0.2, zB + 0.35]); k.box(0.03, 0.3, 0.36, M.steel, [x + 0.07, 0.2, zB + 0.35]); }
    P.addBox((x0 + x1) / 2, zB + 0.35, x1 - x0 - 0.3, 0.4, 0, -1, 0.9);
    A.board('misc', 'staffBike', 0.9, 0.253, [(x0 + x1) / 2, yF - 0.28, zF + 0.04], 0, { frame: M.steelDark, border: 0.02 });
  }

  // ---- station garden: brick beds, welcome board, wheelset monument, shrubs
  const bed = (x0, x1, z0, z1, kinds, dens = 9, h = 0.22) => {
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, w = x1 - x0, d = z1 - z0, t = 0.11;
    k.box(w, h, t, M.brick, [cx, h / 2, z0 + t / 2]); k.box(w, h, t, M.brick, [cx, h / 2, z1 - t / 2]);
    k.box(t, h, d - 2 * t, M.brick, [x0 + t / 2, h / 2, cz]); k.box(t, h, d - 2 * t, M.brick, [x1 - t / 2, h / 2, cz]);
    k.box(w + 0.02, 0.03, t + 0.02, M.brickLight, [cx, h + 0.012, z0 + t / 2]); k.box(w + 0.02, 0.03, t + 0.02, M.brickLight, [cx, h + 0.012, z1 - t / 2]);
    U.worldUV(k.box(w - 2 * t, 0.02, d - 2 * t, M.soil, [cx, h - 0.04, cz]), 1.5);
    const n = Math.round(w * d * dens);
    for (let i = 0; i < n; i++) {
      const x = x0 + t + 0.08 + r() * (w - 2 * t - 0.16), z = z0 + t + 0.08 + r() * (d - 2 * t - 0.16);
      const id = kinds[Math.floor(r() * kinds.length)];
      const s = id === 'tulip' ? 0.36 : id === 'nanohana' ? 0.42 : 0.3;
      const hh = id === 'tulip' ? 0.42 : id === 'nanohana' ? 0.55 : 0.26;
      C.cross(x, h - 0.04, z, s, hh * (0.85 + r() * 0.3), r() * PI, F.r(id));
    }
    P.addBox(cx, cz, w, d, 0, -1, 0.5);
  };
  bed(12.35, 15.9, -26.45, -25.2, ['tulip', 'tulip', 'pansy', 'pansy'], 22);
  bed(22.6, 26.8, -26.3, -25.2, ['pansy', 'tulip', 'daisy', 'pansy'], 20);   // along the plaza edge
  bed(12.9, 15.7, -30.1, -28.2, ['nanohana', 'pansy', 'daisy', 'tulip'], 16);    // centre bed
  // welcome board standing in the centre bed
  for (const x of [13.75, 14.85]) k.box(0.06, 0.95, 0.06, M.woodDark, [x, 0.475, -29.2]);
  A.board('misc', 'welcome', 1.1, 0.55, [14.3, 0.92, -29.16], 0, { frame: M.woodDark, border: 0.03, depth: 0.04 });
  // garden care sign on a stake in the front bed
  k.box(0.04, 0.55, 0.04, M.woodDark, [12.8, 0.275, -25.7]);
  A.board('misc', 'gardenSign', 0.44, 0.19, [12.8, 0.6, -25.67], 0, { frame: M.woodDark, border: 0.015, depth: 0.02 });
  // retired wheelset monument (動輪の記念碑)
  {
    const x = 14.3, z = -31.9;
    U.worldUV(k.box(1.8, 0.35, 0.9, M.stone, [x, 0.175, z]), 1.8);
    k.box(1.86, 0.04, 0.96, M.band, [x, 0.37, z]);
    const top = 0.39;
    for (const s of [-1, 1]) {
      k.box(0.07, 0.12, 0.88, M.steelDark, [x + s * 0.56, top + 0.06, z]);            // rail sections
      const wy = top + 0.12 + 0.43;
      k.cyl(0.43, 0.43, 0.12, wheelRed, [x + s * 0.56, wy, z], [0, 0, PI / 2], 22);   // wheel web
      k.cyl(0.44, 0.44, 0.06, M.steel, [x + s * 0.53, wy, z], [0, 0, PI / 2], 22);    // tread
      k.cyl(0.47, 0.47, 0.025, M.steel, [x + s * 0.49, wy, z], [0, 0, PI / 2], 22);   // flange (inner side)
      k.cyl(0.14, 0.14, 0.2, M.steelDark, [x + s * 0.58, wy, z], [0, 0, PI / 2], 12);  // hub
    }
    k.cyl(0.075, 0.075, 1.45, M.steelDark, [x, top + 0.55, z], [0, 0, PI / 2], 12);    // axle
    // plaque on a slanted stand
    k.box(0.06, 0.62, 0.06, M.woodDark, [x, 0.31, z + 0.75]);
    const pg = k.group([x, 0.72, z + 0.78], 0); pg.rotation.x = -0.5;
    ctx.kit(pg).box(0.6, 0.28, 0.04, M.woodDark, [0, 0, -0.02]);
    const pl = new THREE.Mesh(U.rectPlane(0.55, 0.24, A.tx.misc.r('wheelPlaque')), A.signMat('misc', false)); pl.position.z = 0.002; pg.add(pl);
    P.addBox(x, z, 1.9, 1.0, 0, -1, 1.5);
    bush(12.75, -31.9, 0.44, M.shrub, azalea); bush(15.85, -31.75, 0.4, M.shrubDark, azaleaDeep);
  }
  // shrubs & a small hedge against the building east wall and along the platform wall
  bush(12.5, -27.5, 0.38, M.shrubLight, M.yukiyanagi); bush(12.5, -33.2, 0.42, M.shrubDark);
  bush(16.4, -30.7, 0.36, M.shrub, azalea);
  for (let x = 12.6; x < 27; x += 1.15 + r() * 0.5) {
    const q = r(), m = q < 0.5 ? M.shrub : q < 0.8 ? M.shrubLight : M.shrubDark;
    bush(x, -34.85 + (r() - 0.5) * 0.2, 0.42 + r() * 0.2, m, r() < 0.3 ? (r() < 0.5 ? M.yukiyanagi : azalea) : null);
  }
  // clover & tsukushi in the gravel, weeds at the wall foots
  for (let i = 0; i < 70; i++) {
    const x = 12.3 + r() * 14.5, z = -33 + r() * 7.8;
    if (x > 16.9 && x < 22.3 && z > -31 && z < -25.9) continue;
    if (x > 22.2 && x < 26.8 && z > -33 && z < -28.5) continue;
    if (x > 12.8 && x < 16 && z > -32.5 && z < -25) continue;
    C.cross(x, 0.0, z, 0.24, 0.18, r() * PI, F.r(r() < 0.15 ? 'tsukushi' : r() < 0.3 ? 'daisy' : 'grass2'));
  }
  weeds(17.2, 21.8, -30.75, 0.08, { dens: 4, flowers: 0.25, y: 0.0, tall: 0.8 });

  // ==================================================================== WEST YARD (x -9.25..-4) — keep LOW
  const WY = L.STATION.westYard;
  { const m = U.groundPatch(WY.x0 + 0.02, WY.x1 - 0.02, WY.z0, WY.z1 - 0.04, M.gravel, 0.012, 0.7); A.root.add(m); U.worldUV(m, 1.6); }
  // trimmed hedge (生け垣) along the road side, 0.75 m
  {
    const z0 = -33.7, z1 = -25.4, x = -8.95;
    k.rbox(0.5, 0.72, z1 - z0, 0.18, M.shrub, [x, 0.36, (z0 + z1) / 2]);
    for (let z = z0 + 0.4; z < z1 - 0.3; z += 0.9) { const b = k.sphere(0.28, M.shrubLight, [x + (r() - 0.5) * 0.1, 0.66, z + r() * 0.3], 8); b.scale.y *= 0.55; }
    P.addBox(x, (z0 + z1) / 2, 0.5, z1 - z0, 0, -1, 1.0);
  }
  // planters along the building wall (low)
  const planterLow = (x0, x1, z0, z1, kinds) => {
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, w = x1 - x0, d = z1 - z0, h = 0.42;
    U.worldUV(k.rbox(w, h, d, 0.03, M.stone, [cx, h / 2, cz]), 1.8);
    U.worldUV(k.box(w - 0.1, 0.02, d - 0.1, M.soil, [cx, h - 0.03, cz]), 1.5);
    const n = Math.round(w * d * 14);
    for (let i = 0; i < n; i++) C.cross(x0 + 0.1 + r() * (w - 0.2), h - 0.03, z0 + 0.1 + r() * (d - 0.2), 0.28, 0.26, r() * PI, F.r(kinds[Math.floor(r() * kinds.length)]));
    P.addBox(cx, cz, w, d, 0, -1, h + 0.1);
  };
  planterLow(-5.0, -4.35, -33.6, -31.4, ['pansy', 'pansy', 'daisy']);
  planterLow(-5.0, -4.35, -28.2, -26.3, ['pansy', 'tulip', 'pansy']);
  // flower pots by the south corner
  for (const [x, z, s] of [[-4.6, -25.65, 0.16], [-4.95, -25.55, 0.13], [-4.62, -26.0, 0.12]]) {
    k.cyl(s, s * 0.75, s * 1.6, M.plantPot, [x, s * 0.8, z], null, 12);
    C.cross(x, s * 1.5, z, s * 2.2, s * 2.0, r() * PI, F.r('pansy'));
  }
  // "no bicycle parking" notice (low, 1.05 m) + a low bike stop bar
  {
    const x = -7.5, z = -25.55;
    for (const dx of [-0.2, 0.2]) k.box(0.05, 0.9, 0.05, M.steelDark, [x + dx, 0.45, z]);
    A.board('misc', 'bikeNotice', 0.5, 0.35, [x, 0.85, z + 0.03], 0, { frame: M.fenceWhite, border: 0.02 });
    P.addBox(x, z, 0.5, 0.1, 0, -1, 1.1);
  }
  bush(-7.4, -31.8, 0.32, M.shrubLight); bush(-6.3, -28.6, 0.3, M.shrub, azalea);
  for (let i = 0; i < 40; i++) {
    const x = -8.5 + r() * 3.4, z = -33.6 + r() * 8;
    C.cross(x, hAt(x, z), z, 0.24, 0.18, r() * PI, F.r(r() < 0.3 ? 'daisy' : r() < 0.4 ? 'tsukushi' : 'grass2'));
  }

  // ==================================================================== weeds outside the platform fences
  const S = L.PLATFORM.south, N = L.PLATFORM.north;
  weeds(-6.9, -4.3, S.z1 + 0.35, 0.28, { dens: 6, flowers: 0.35 });
  weeds(12.2, 46.5, S.z1 + 0.3, 0.25, { dens: 5, flowers: 0.3 });
  weeds(27.0, 46.5, S.z1 + 0.85, 0.4, { dens: 4, flowers: 0.4, nanohana: true });
  weeds(9.3, 48.3, N.z0 - 0.35, 0.3, { dens: 6, flowers: 0.35, nanohana: true });
  weeds(9.3, 48.3, N.z0 - 1.05, 0.35, { dens: 3, flowers: 0.3, tall: 1.2 });
  weeds(-6.9, -6.45, N.z0 - 0.7, 0.6, { dens: 10, flowers: 0.3 });
  // low shrubs here and there outside the fences
  for (let x = 28.5; x < 46; x += 3.2 + r() * 2.4) bush(x, S.z1 + 0.9 + r() * 0.4, 0.34 + r() * 0.2, r() < 0.3 ? M.shrubLight : M.shrub, r() < 0.2 ? M.yukiyanagi : null);
  for (let x = 9.8; x < 47; x += 3.0 + r() * 2.6) bush(x, N.z0 - 0.95 - r() * 0.3, 0.32 + r() * 0.22, r() < 0.3 ? M.shrubDark : M.shrub);

  const fol = C.build(M.foliage);
  if (fol) { ctx.noOutline(fol); A.root.add(fol); }
}
