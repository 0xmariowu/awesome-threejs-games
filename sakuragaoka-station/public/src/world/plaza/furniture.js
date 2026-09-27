// Plaza furniture: boards, bus stop + shelter, taxi sign, postbox, phone booth, bicycle racks + roof,
// bollards, chain fences, sorted bins, lamps (off), clock pillar, 90th-anniversary monument.
import * as THREE from 'three';
import { put, boxUV } from './util.js';

export function buildFurniture(ctx, root, T, S, P) {
  const { mat, physics, L } = ctx;
  const PH = physics;
  const out = { benches: [] };

  // ---------------------------------------------------------------- shared materials
  const M = {
    slate: mat.toon('#4a5667', { paint: 0.04 }),
    frame: mat.toon('#56615e', { paint: 0.04 }),
    steel: mat.toon('#b3bac1', { paint: 0.03 }),
    steelD: mat.toon('#7d858d', { paint: 0.03 }),
    concrete: mat.toon('#ffffff', { map: T.concrete, paint: 0.06 }),
    wood: mat.toon('#8a6446', { paint: 0.06 }),
    woodL: mat.toon('#ffffff', { map: T.wood, paint: 0.05 }),
    woodPanel: mat.toon('#b58c64', { map: T.wood, paint: 0.05 }),
    roofGreen: mat.toon('#4d6457', { paint: 0.05 }),
    roofBlue: mat.toon('#56677a', { paint: 0.05 }),
    cream: mat.toon('#e6e1d4', { paint: 0.04 }),
    dark: mat.toon('#3a3346'),
    white: mat.toon('#ebe8e0', { paint: 0.03 }),
  };
  const faceMat = (tex) => mat.toon('#ffffff', { map: tex, paint: 0.012, polygonOffset: -1 });
  const face = (parent, w, h, tex, pos, rotY = 0, material) => {
    const m = new THREE.Mesh(ctx.geo.G.plane(), material || faceMat(tex));
    m.scale.set(w, h, 1); m.position.set(pos[0], pos[1], pos[2]); m.rotation.y = rotY;
    m.receiveShadow = true; m.castShadow = false; parent.add(m); return m;
  };
  const group = (x, z, rotY = 0, y = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rotY; root.add(g); return g; };

  // ================================================================ 駅周辺案内図 (map board, double sided)
  {
    const { x, z, rotY } = P.mapBoard;
    const g = group(x, z, rotY), k = ctx.kit(g);
    for (const s of [-1, 1]) { k.boxB(0.08, 2.18, 0.08, M.slate, [s * 0.87, 0, 0]); k.boxB(0.18, 0.06, 0.18, M.concrete, [s * 0.87, 0, 0]); k.sphere(0.05, M.slate, [s * 0.87, 2.2, 0], 10); }
    k.rbox(1.76, 1.36, 0.08, 0.025, M.slate, [0, 1.35, 0]);
    face(g, 1.6, 1.2, S.map, [0, 1.35, 0.045]);
    face(g, 1.6, 1.2, S.plazaGuide, [0, 1.35, -0.045], Math.PI);
    k.rbox(1.9, 0.07, 0.16, 0.025, M.slate, [0, 2.07, 0]);
    k.box(1.62, 0.05, 0.02, mat.toon('#ef9fbe'), [0, 2.0, 0.05]);
    PH.addBox(x, z, 1.95, 0.24, rotY, 0, 2.3);
  }

  // ================================================================ 桜ヶ丘 観光案内 (wooden tourist board with a small roof)
  {
    const { x, z, rotY } = P.tourBoard;
    const g = group(x, z, rotY), k = ctx.kit(g);
    for (const s of [-1, 1]) { k.boxB(0.1, 2.3, 0.1, M.wood, [s * 0.88, 0, 0]); k.boxB(0.2, 0.08, 0.2, M.concrete, [s * 0.88, 0, 0]); }
    k.box(1.78, 1.38, 0.07, M.wood, [0, 1.36, 0]);
    face(g, 1.6, 1.2, S.tourist, [0, 1.36, 0.04]);
    // back: plank panel
    const back = put(g, boxUV(1.66, 1.26, 0.01, 1), M.woodPanel, [0, 1.36, -0.04]);
    for (let i = 0; i < 5; i++) k.box(1.66, 0.008, 0.012, mat.toon('#6e5038'), [0, 0.8 + i * 0.25, -0.046]);
    // roof (two slopes + ridge)
    for (const s of [-1, 1]) k.box(1.08, 0.04, 0.44, M.roofGreen, [s * 0.5, 2.37, 0], [0, 0, -s * 0.36]);
    k.box(0.12, 0.06, 0.46, M.roofGreen, [0, 2.56, 0]);
    k.box(1.9, 0.08, 0.1, M.wood, [0, 2.2, 0]);
    k.box(0.9, 0.18, 0.02, mat.toon('#f1e6cf'), [0, 2.08, 0.05]);
    face(g, 0.88, 0.16, ctx.tex.sign({ w: 512, h: 96, bg: '#f1e6cf', fg: '#4a3438', text: 'さくらの町へ ようこそ', font: ctx.tex.FONTS.brush, weight: 400, key: 'plaza-welcome' }), [0, 2.08, 0.062]);
    PH.addBox(x, z, 1.95, 0.3, rotY, 0, 2.6);
  }

  // ================================================================ 町内会 掲示板 (community notice board)
  {
    const { x, z, rotY } = P.noticeBoard;
    const g = group(x, z, rotY), k = ctx.kit(g);
    const post = mat.toon('#5f6f6a', { paint: 0.04 });
    for (const s of [-1, 1]) { k.boxB(0.07, 2.25, 0.07, post, [s * 0.98, 0, 0]); k.boxB(0.16, 0.06, 0.16, M.concrete, [s * 0.98, 0, 0]); }
    k.box(1.96, 1.26, 0.05, M.wood, [0, 1.25, 0]);
    face(g, 1.8, 1.125, S.notice, [0, 1.25, 0.029]);
    k.box(1.96, 0.05, 0.08, M.wood, [0, 1.86, 0.01]);
    k.box(1.96, 0.05, 0.08, M.wood, [0, 0.64, 0.01]);
    k.box(1.04, 0.2, 0.03, M.wood, [0, 2.0, 0]);
    face(g, 1.0, 0.156, S.noticeHeader, [0, 2.0, 0.018]);
    k.box(2.2, 0.035, 0.46, M.roofBlue, [0, 2.2, 0.06], [0.2, 0, 0]);
    for (const s of [-1, 1]) k.box(0.04, 0.04, 0.34, post, [s * 0.98, 2.16, 0.08], [0.2, 0, 0]);
    PH.addBox(x, z, 2.1, 0.3, rotY, 0, 2.4);
  }

  // ================================================================ bus stop pole
  {
    const { x, z } = L.PLAZA.busStop;
    const g = group(x, z, 0), k = ctx.kit(g);
    k.cyl(0.25, 0.27, 0.1, M.concrete, [0, 0.05, 0], null, 20);
    k.cyl(0.12, 0.2, 0.04, mat.toon('#8e959d'), [0, 0.12, 0], null, 16);
    k.cyl(0.032, 0.032, 1.78, M.steel, [0, 0.99, 0], null, 10);
    // round sign on top of the pole (faces east & west, along the road)
    const disc = new THREE.CircleGeometry(0.25, 28);
    const sg = new THREE.Group(); sg.position.set(0, 2.12, 0); sg.rotation.y = Math.PI / 2; g.add(sg);
    k.box(0.05, 0.1, 0.05, M.steel, [0, 1.88, 0]);
    ctx.kit(sg).cyl(0.255, 0.255, 0.024, mat.toon('#e78fae'), [0, 0, 0], [Math.PI / 2, 0, 0], 28);
    for (const s of [1, -1]) { const m = new THREE.Mesh(disc, faceMat(S.busRound)); m.position.z = s * 0.0135; m.rotation.y = s > 0 ? 0 : Math.PI; sg.add(m); }
    // timetable box
    const tg = new THREE.Group(); tg.position.set(0, 1.28, 0); tg.rotation.y = Math.PI / 2; g.add(tg);
    ctx.kit(tg).box(0.36, 0.6, 0.1, M.white, [0, 0, 0]);
    face(tg, 0.32, 0.56, S.busTable, [0, 0, 0.052]);
    face(tg, 0.32, 0.56, S.busTable, [0, 0, -0.052], Math.PI);
    ctx.kit(tg).box(0.38, 0.03, 0.12, mat.toon('#e78fae'), [0, 0.31, 0]);
    PH.addCylinder(x, z, 0.28, 0, 2.4);
  }

  // ================================================================ bus shelter + bench
  {
    const { x, z, w } = P.shelter;           // centre of the back line, opening faces south (+Z)
    const g = group(x, z, 0), k = ctx.kit(g);
    const post = mat.toon('#5d6c70', { paint: 0.04 });
    const depth = 1.75, H = 2.42;
    for (const s of [-1, 1]) {
      k.boxB(0.1, H, 0.1, post, [s * (w / 2 - 0.1), 0, 0]);
      k.boxB(0.22, 0.05, 0.22, M.concrete, [s * (w / 2 - 0.1), 0, 0]);
      k.box(0.08, 0.12, depth - 0.1, post, [s * (w / 2 - 0.1), H - 0.02, depth / 2 - 0.08]);   // cantilever beams
    }
    // curved roof (arched profile extruded along x)
    const pts = [], th = 0.05, n = 10;
    for (let i = 0; i <= n; i++) { const u = i / n; pts.push([-depth / 2 - 0.08 + u * (depth + 0.16), 0.1 * Math.sin(Math.PI * u)]); }
    for (let i = n; i >= 0; i--) { const u = i / n; pts.push([-depth / 2 - 0.08 + u * (depth + 0.16), 0.1 * Math.sin(Math.PI * u) - th]); }
    const roofGeo = ctx.geo.extrude(pts, w + 0.2);
    const roof = put(g, roofGeo, mat.toon('#e3e0d8', { paint: 0.04 }), [0, H + 0.06, depth / 2 - 0.08], [0, Math.PI / 2, 0]);
    // fascia with the stop name
    k.box(w + 0.2, 0.26, 0.04, mat.toon('#f1ede4'), [0, H - 0.04, depth - 0.02]);
    face(g, w + 0.1, (w + 0.1) * 96 / 1024, S.shelterFascia, [0, H - 0.04, depth + 0.003]);
    // back glass wall + rails
    const gw = w - 0.3;
    const glass = new THREE.Mesh(ctx.geo.G.plane(), mat.glass({ tint: '#a9c1cf', opacity: 0.2 }));
    glass.scale.set(gw, 1.75, 1); glass.position.set(0, 1.2, 0); g.add(glass);
    k.box(gw, 0.05, 0.05, post, [0, 0.3, 0]); k.box(gw, 0.05, 0.05, post, [0, 2.08, 0]);
    k.box(0.04, 1.75, 0.04, post, [-0.35, 1.2, 0]);
    // route map on the back wall (inside, facing south)
    k.box(0.86, 0.4, 0.03, M.white, [0.75, 1.55, 0.04]);
    face(g, 0.8, 0.35, S.routeMap, [0.75, 1.55, 0.057]);
    // east side: lit advertising panel (both sides)
    const ag = new THREE.Group(); ag.position.set(w / 2 - 0.1, 0, 0.52); g.add(ag);
    const ak = ctx.kit(ag);
    ak.box(0.12, 1.86, 0.92, post, [0, 1.13, 0]);
    const adM = mat.emissive('#ffffff', 0.92, { map: S.shelterAd });
    for (const s of [-1, 1]) face(ag, 0.8, 1.6, S.shelterAd, [s * 0.062, 1.15, 0], s * Math.PI / 2, adM);
    // bench (slats on two legs) facing south
    const bz = 0.33, bl = w - 0.7;
    for (const s of [-1, 1]) { k.boxB(0.05, 0.4, 0.34, post, [s * (bl / 2 - 0.2), 0, bz]); }
    for (let i = 0; i < 3; i++) k.box(bl, 0.035, 0.1, M.woodL, [0, 0.4225, bz - 0.12 + i * 0.12]);
    k.box(bl, 0.08, 0.03, M.woodL, [0, 0.72, 0.1]);
    for (const s of [-1, 1]) k.box(0.04, 0.34, 0.04, post, [s * (bl / 2 - 0.2), 0.6, 0.1]);
    out.benches.push({ x: x, z: z + bz, y: 0.44, rotY: 0, len: +bl.toFixed(2) });
    // forgotten folding umbrella + folded newspaper on the bench
    const um = new THREE.Group(); um.position.set(0.55, 0.44 + 0.03, bz + 0.02); um.rotation.set(0, 0.25, Math.PI / 2); g.add(um);
    const uk = ctx.kit(um);
    uk.cyl(0.028, 0.02, 0.26, mat.toon('#5a6a92'), [0, 0, 0], null, 8);
    uk.cyl(0.012, 0.012, 0.06, M.steelD, [0, 0.16, 0], null, 6);
    uk.cyl(0.016, 0.016, 0.07, mat.toon('#3f3a44'), [0, -0.165, 0], null, 8);
    const np = new THREE.Group(); np.position.set(-0.62, 0.44, bz - 0.02); np.rotation.y = 0.15; g.add(np);
    ctx.kit(np).box(0.3, 0.012, 0.21, mat.toon('#e4e0d6'), [0, 0.006, 0]);
    face(np, 0.28, 0.19, newspaperTex(ctx), [0, 0.0125, 0], 0).rotation.set(-Math.PI / 2, 0, 0);
    // colliders
    PH.addBox(x, z, w, 0.14, 0, 0, 2.3);
    PH.addBox(x + w / 2 - 0.1, z + 0.52, 0.14, 0.95, 0, 0, 2.3);
    PH.addBox(x, z + bz, bl, 0.38, 0, 0, 0.62);
    for (const s of [-1, 1]) PH.addCylinder(x + s * (w / 2 - 0.1), z, 0.09, 0, 2.5);
  }

  // ================================================================ taxi stand sign
  {
    const { x, z } = L.PLAZA.taxiStand;
    const g = group(x, z, 0), k = ctx.kit(g);
    k.boxB(0.3, 0.08, 0.3, M.concrete, [0, 0, 0]);
    k.cyl(0.03, 0.03, 2.35, M.steel, [0, 1.2, 0], null, 10);
    const sz = 0.05; // plates mounted on the south side of the pole
    k.box(0.46, 0.57, 0.03, mat.toon('#2f4a78'), [0, 1.98, sz]);
    face(g, 0.44, 0.55, S.taxi, [0, 1.98, sz + 0.017]);
    face(g, 0.44, 0.55, S.taxi, [0, 1.98, sz - 0.017], Math.PI);
    for (const yy of [1.8, 2.16]) k.box(0.08, 0.03, 0.05, M.steelD, [0, yy, 0.025]);
    k.box(0.4, 0.13, 0.02, M.white, [0, 1.45, sz - 0.005]);
    const tq = ctx.tex.sign({ w: 384, h: 128, bg: '#efece4', fg: '#2f3a58', text: '順番にお並びください', sub: 'Please wait in line', size: 44, key: 'plaza-taxi-queue' });
    face(g, 0.38, 0.125, tq, [0, 1.45, sz + 0.007]);
    face(g, 0.38, 0.125, tq, [0, 1.45, sz - 0.017], Math.PI);
    k.cyl(0.035, 0.035, 0.03, M.steel, [0, 2.36, 0], null, 10);
    PH.addCylinder(x, z, 0.16, 0, 2.4);
  }

  // ================================================================ red round-top postbox (丸型ポスト)
  {
    const { x, z, rotY } = P.postbox;
    const g = group(x, z, rotY), k = ctx.kit(g);
    const red = mat.toon('#cc463c', { paint: 0.04 }), redD = mat.toon('#a93a34', { paint: 0.03 });
    k.boxB(0.44, 0.06, 0.44, M.concrete, [0, 0, 0]);
    k.cyl(0.13, 0.15, 0.28, redD, [0, 0.2, 0], null, 18);
    k.cyl(0.2, 0.2, 0.84, red, [0, 0.76, 0], null, 24);
    k.cyl(0.215, 0.215, 0.04, redD, [0, 0.36, 0], null, 24);
    k.cyl(0.228, 0.228, 0.035, redD, [0, 1.19, 0], null, 24);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.222, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2), red);
    dome.scale.set(1, 0.62, 1); dome.position.set(0, 1.205, 0); dome.castShadow = true; dome.receiveShadow = true; g.add(dome);
    k.sphere(0.03, redD, [0, 1.34, 0], 10);
    // slot with a little hood
    k.box(0.16, 0.035, 0.03, M.dark, [0, 1.04, 0.192]);
    k.box(0.2, 0.02, 0.06, redD, [0, 1.07, 0.195]);
    // curved front label + collection times on the side
    const lab = new THREE.Mesh(new THREE.CylinderGeometry(0.202, 0.202, 0.32, 10, 1, true, -0.42, 0.84), mat.toon('#ffffff', { map: S.postFront, paint: 0.01, polygonOffset: -1 }));
    lab.position.set(0, 0.8, 0); g.add(lab);
    const tim = new THREE.Mesh(new THREE.CylinderGeometry(0.202, 0.202, 0.13, 8, 1, true, Math.PI / 2 - 0.34, 0.68), mat.toon('#ffffff', { map: S.postTimes, paint: 0.01, polygonOffset: -1 }));
    tim.position.set(0, 0.62, 0); g.add(tim);
    // collection door (back)
    k.box(0.2, 0.36, 0.02, redD, [0, 0.7, -0.195]);
    k.box(0.03, 0.03, 0.02, M.steel, [0.06, 0.72, -0.21]);
    PH.addCylinder(x, z, 0.24, 0, 1.4);
  }

  // ================================================================ public phone booth
  {
    const { x, z, rotY } = P.phone;
    const g = group(x, z, rotY), k = ctx.kit(g);
    const fr = mat.toon('#cdd1d2', { paint: 0.03 }), green = mat.toon('#4f9a6e', { paint: 0.04 });
    const W = 0.92, H = 2.08;
    k.boxB(W + 0.06, 0.1, W + 0.06, mat.toon('#9aa1a8'), [0, 0, 0]);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.boxB(0.06, H, 0.06, fr, [sx * (W / 2 - 0.03), 0.1, sz * (W / 2 - 0.03)]);
    // kick panels + rails
    const sides = [[0, W / 2 - 0.03, 0], [0, -(W / 2 - 0.03), Math.PI], [W / 2 - 0.03, 0, Math.PI / 2], [-(W / 2 - 0.03), 0, -Math.PI / 2]];
    const gl = mat.glass({ tint: '#a6bfcc', opacity: 0.18 });
    for (const [sx, sz, ry] of sides) {
      const sg = new THREE.Group(); sg.position.set(sx, 0, sz); sg.rotation.y = ry; g.add(sg);
      const sk = ctx.kit(sg);
      sk.box(W - 0.1, 0.3, 0.03, fr, [0, 0.27, 0]);
      sk.box(W - 0.1, 0.04, 0.04, fr, [0, 1.02, 0]);
      const p = new THREE.Mesh(ctx.geo.G.plane(), gl); p.scale.set(W - 0.1, H - 0.34, 1); p.position.set(0, 0.42 + (H - 0.34) / 2, 0); sg.add(p);
    }
    // door handle + folding split on the front
    k.box(0.02, 1.5, 0.03, fr, [0.0, 1.2, W / 2 - 0.02]);
    k.box(0.02, 0.3, 0.03, M.steelD, [0.08, 1.15, W / 2 + 0.01]);
    // header band with signs on four sides + roof
    k.box(W + 0.02, 0.2, W + 0.02, green, [0, H + 0.2, 0]);
    for (const [sx, sz, ry] of sides) {
      const sg = new THREE.Group(); sg.position.set(sx * (W / 2 + 0.012) / (W / 2 - 0.03), H + 0.2, sz * (W / 2 + 0.012) / (W / 2 - 0.03)); sg.rotation.y = ry; g.add(sg);
      face(sg, 0.72, 0.18, S.phoneSign, [0, 0, 0]);
    }
    k.rbox(W + 0.14, 0.1, W + 0.14, 0.04, mat.toon('#e2e5e3', { paint: 0.03 }), [0, H + 0.35, 0]);
    // interior: back mounting panel, phone, shelf, directory, notice
    k.box(0.62, 1.05, 0.025, mat.toon('#b9c3bf', { paint: 0.03 }), [0, 1.47, -W / 2 + 0.03]);
    const phone = mat.toon('#8fae9c', { paint: 0.03 });
    k.rbox(0.26, 0.38, 0.14, 0.03, phone, [0, 1.38, -W / 2 + 0.11]);
    k.box(0.16, 0.08, 0.01, mat.toon('#3f4a4a'), [0, 1.48, -W / 2 + 0.185]);
    k.box(0.14, 0.12, 0.01, mat.toon('#dfe3df'), [0, 1.33, -W / 2 + 0.185]);
    k.rbox(0.055, 0.22, 0.06, 0.02, mat.toon('#6f8e7d'), [-0.17, 1.38, -W / 2 + 0.13]);
    k.box(0.5, 0.03, 0.28, fr, [0, 1.0, -W / 2 + 0.16]);
    const book = new THREE.Group(); book.position.set(0.08, 1.015, -W / 2 + 0.17); book.rotation.y = 0.12; g.add(book);
    ctx.kit(book).box(0.22, 0.05, 0.16, mat.toon('#e8c547'), [0, 0.025, 0]);
    face(book, 0.2, 0.15, S.phoneBook, [0, 0.051, 0]).rotation.set(-Math.PI / 2, 0, 0);
    face(g, 0.17, 0.17, S.phoneNotice, [0.215, 1.8, -W / 2 + 0.044]);
    PH.addBox(x, z, W + 0.1, W + 0.1, rotY, 0, 2.6);
  }

  // ================================================================ bicycle parking: racks, roof, signs
  const rows = L.PLAZA.bikeRows;
  const rackM = mat.toon('#9aa3aa', { paint: 0.03 }), rackD = mat.toon('#6d747c', { paint: 0.03 });
  // front-wheel racks: a low steel base frame + a pair of bent-pipe wheel hoops per slot
  const hoopGeo = new THREE.TorusGeometry(0.2, 0.011, 5, 12, Math.PI);
  for (const row of rows) {
    const slots = []; for (let x = row.x0; x <= row.x1 + 1e-6; x += row.step) slots.push(x);
    const x0 = slots[0] - 0.35, x1 = slots[slots.length - 1] + 0.35, len = x1 - x0, xc = (x0 + x1) / 2;
    const zf = row.z - 0.92, zb = row.z - 0.32; // front (north) and back base rails
    const zh = row.z - 0.6;                      // hoop centre (under the front wheel)
    const g = group(0, 0, 0), k = ctx.kit(g);
    k.box(len, 0.04, 0.05, rackD, [xc, 0.04, zf]);
    k.box(len, 0.04, 0.05, rackD, [xc, 0.04, zb]);
    for (const s of [x0, x1]) { k.box(0.05, 0.04, zb - zf + 0.05, rackD, [s, 0.04, (zf + zb) / 2]); k.boxB(0.05, 0.36, 0.05, rackM, [s, 0, zf]); }
    k.cyl(0.018, 0.018, len, rackM, [xc, 0.36, zf], [0, 0, Math.PI / 2], 8);   // front stop rail
    for (const sx of slots) {
      for (const d of [-0.046, 0.046]) {
        const h = new THREE.Mesh(hoopGeo, rackM); h.position.set(sx + d, 0.06, zh); h.rotation.y = Math.PI / 2; h.castShadow = true; h.receiveShadow = true; g.add(h);
      }
      for (const d of [-0.046, 0.046]) k.box(0.022, 0.03, zb - zf, rackD, [sx + d, 0.045, (zf + zb) / 2]);
    }
    // slot numbers on the back rail
    const nums = new THREE.Mesh(ctx.geo.G.plane(), faceMat(S.slotNums));
    nums.scale.set(0.75 * 12, 0.055, 1); nums.position.set(row.x0 - 0.375 + 0.75 * 6, 0.072, zb + 0.031); g.add(nums);
    PH.addBox(xc, (zf + zb) / 2, len, zb - zf + 0.12, 0, 0, 0.5);
  }
  // roof over the north row
  {
    const row = rows[1];
    const g = group(0, 0, 0), k = ctx.kit(g);
    const post = mat.toon('#6f8a80', { paint: 0.04 });
    const zP = row.z - 1.3, zF = row.z + 1.25, xa = row.x0 - 0.55, xb = row.x1 + 0.35;
    const hB = 2.35, hF = 2.2;
    const pxs = [xa + 0.1, (xa + xb) / 2, xb - 0.1];
    for (const px of pxs) {
      k.boxB(0.1, hB, 0.1, post, [px, 0, zP]);
      k.boxB(0.22, 0.05, 0.22, M.concrete, [px, 0, zP]);
      const beamLen = Math.hypot(zF - zP + 0.1, hB - hF);
      k.box(0.08, 0.1, beamLen, post, [px, (hB + hF) / 2 - 0.02, (zP + zF) / 2], [Math.atan2(hB - hF, zF - zP), 0, 0]);
      PH.addCylinder(px, zP, 0.09, 0, 2.5);
    }
    const slope = Math.atan2(hB - hF, zF - zP);
    const panel = new THREE.Mesh(ctx.geo.G.plane(), mat.glass({ tint: '#9fc4b8', opacity: 0.42 }));
    panel.scale.set(xb - xa + 0.2, zF - zP + 0.3, 1); panel.position.set((xa + xb) / 2, (hB + hF) / 2 + 0.06, (zP + zF) / 2); panel.rotation.x = -Math.PI / 2 + slope;
    panel.castShadow = true; g.add(panel);
    for (let i = 1; i < 9; i++) k.box(0.03, 0.02, zF - zP + 0.3, post, [xa - 0.1 + (xb - xa + 0.2) * i / 9, (hB + hF) / 2 + 0.075, (zP + zF) / 2], [slope, 0, 0]);
    k.box(xb - xa + 0.24, 0.12, 0.06, post, [(xa + xb) / 2, hF - 0.02, zF + 0.14]);   // front gutter
    k.box(xb - xa + 0.24, 0.1, 0.06, post, [(xa + xb) / 2, hB + 0.02, zP - 0.16]);
    // 放置自転車禁止 notice on the west post
    const ng = group(pxs[0] - 0.056, zP, -Math.PI / 2); face(ng, 0.34, 0.425, S.bikeNotice, [0, 1.35, 0]);
    ctx.kit(ng).box(0.36, 0.445, 0.01, M.white, [0, 1.35, -0.006]);
  }
  // 駐輪場 sign on its own post at the south-west corner of the bike area
  {
    const { x, z, rotY } = P.bikeSign;
    const g = group(x, z, rotY), k = ctx.kit(g);
    k.boxB(0.24, 0.06, 0.24, M.concrete, [0, 0, 0]);
    k.cyl(0.035, 0.035, 2.25, M.steel, [0, 1.15, 0], null, 10);
    k.box(0.92, 0.28, 0.035, mat.toon('#2f64b5'), [0, 2.05, 0.03]);
    face(g, 0.9, 0.253, S.bikeSign, [0, 2.05, 0.05]);
    k.box(0.34, 0.425, 0.012, M.white, [0, 1.3, 0.042]); face(g, 0.32, 0.4, S.bikeNotice, [0, 1.3, 0.05]);
    PH.addCylinder(x, z, 0.14, 0, 2.3);
  }

  // ================================================================ bollards
  const bol = { body: mat.toon('#b9c0c6', { paint: 0.03 }), band: mat.toon('#e8c547'), cap: mat.toon('#9ca4ab') };
  for (const [x, z] of P.bollards) {
    const g = group(x, z, 0), k = ctx.kit(g);
    k.cyl(0.075, 0.075, 0.04, M.concrete, [0, 0.03, 0], null, 12);
    k.cyl(0.055, 0.058, 0.74, bol.body, [0, 0.4, 0], null, 12);
    k.cyl(0.058, 0.058, 0.06, bol.band, [0, 0.66, 0], null, 12);
    const d = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 5, 0, Math.PI * 2, 0, Math.PI / 2), bol.cap);
    d.position.y = 0.77; d.castShadow = true; g.add(d);
    PH.addCylinder(x, z, 0.08, 0, 0.9);
  }

  // ================================================================ chain fences
  const chainPost = mat.toon('#56615e', { paint: 0.03 });
  for (const run of P.chains) {
    const [xa, xb, zc] = run; const n = Math.max(1, Math.round((xb - xa) / 1.45));
    const posts = []; for (let i = 0; i <= n; i++) posts.push(xa + (xb - xa) * i / n);
    for (const px of posts) {
      const g = group(px, zc, 0), k = ctx.kit(g);
      k.cyl(0.06, 0.07, 0.04, M.concrete, [0, 0.03, 0], null, 10);
      k.cyl(0.035, 0.035, 0.6, chainPost, [0, 0.33, 0], null, 10);
      k.sphere(0.045, chainPost, [0, 0.65, 0], 10);
      PH.addCylinder(px, zc, 0.06, 0, 0.8);
    }
    for (let i = 0; i < posts.length - 1; i++) {
      const pts = ctx.geo.catenary([posts[i] + 0.03, 0.56, zc], [posts[i + 1] - 0.03, 0.56, zc], 0.13, 14);
      ctx.wires.add(pts, { width: 0.018, color: '#4f4a55' });
    }
    PH.addBox((xa + xb) / 2, zc, xb - xa, 0.12, 0, 0, 0.75);
  }

  // ================================================================ sorted bins
  for (const b of P.bins) {
    const g = group(b.x, b.z, b.rotY), k = ctx.kit(g);
    const body = mat.toon('#cbd2cc', { paint: 0.04 });
    const labs = [S.binBurn, S.binCan, S.binPet], holes = ['slot', 'round', 'round'];
    for (let i = 0; i < 3; i++) {
      const bx = (i - 1) * 0.36;
      k.rbox(0.34, 0.86, 0.4, 0.03, body, [bx, 0.46, 0]);
      face(g, 0.25, 0.25, labs[i], [bx, 0.56, 0.203]);
      if (holes[i] === 'slot') k.box(0.2, 0.05, 0.02, M.dark, [bx, 0.8, 0.198]);
      else { const h = new THREE.Mesh(new THREE.CircleGeometry(0.055, 14), M.dark); h.position.set(bx, 0.79, 0.2015); g.add(h); }
    }
    k.box(1.1, 0.04, 0.44, M.concrete, [0, 0.02, 0]);
    k.rbox(1.14, 0.06, 0.46, 0.02, mat.toon('#5f7f7a', { paint: 0.04 }), [0, 0.92, 0]);
    PH.addBox(b.x, b.z, 1.14, 0.46, b.rotY, 0, 1.0);
  }

  // ================================================================ plaza lamps (off in daylight)
  const lampPost = mat.toon('#55605d', { paint: 0.04 }), globe = mat.toon('#eeebe3', { paint: 0.02 });
  for (const [x, z] of P.lamps) {
    const g = group(x, z, 0), k = ctx.kit(g);
    k.cyl(0.1, 0.14, 0.42, lampPost, [0, 0.21, 0], null, 12);
    k.cyl(0.05, 0.062, 3.5, lampPost, [0, 2.17, 0], null, 10);
    k.cyl(0.075, 0.075, 0.08, lampPost, [0, 3.95, 0], null, 12);
    k.cyl(0.14, 0.12, 0.34, globe, [0, 4.16, 0], null, 16);
    k.cyl(0.03, 0.23, 0.13, lampPost, [0, 4.39, 0], null, 16);
    k.sphere(0.035, lampPost, [0, 4.47, 0], 8);
    PH.addCylinder(x, z, 0.14, 0, 4.5);
  }

  // ================================================================ clock pillar (hands follow the sim clock 16:02 + t)
  {
    const { x, z, rotY } = P.clock;
    const g = group(x, z, rotY), k = ctx.kit(g);
    k.box(0.44, 0.3, 0.44, mat.toon('#ffffff', { map: T.granite, paint: 0.05 }), [0, 0.15, 0]);
    k.cyl(0.075, 0.08, 3.1, lampPost, [0, 1.85, 0], null, 12);
    k.cyl(0.345, 0.345, 0.16, lampPost, [0, 3.62, 0], [Math.PI / 2, 0, 0], 32);
    k.sphere(0.06, lampPost, [0, 4.0, 0], 10);
    k.cyl(0.02, 0.02, 0.06, lampPost, [0, 3.97, 0], null, 6);
    const dial = new THREE.CircleGeometry(0.31, 36);
    const handGroups = [];
    for (const s of [1, -1]) {
      const d = new THREE.Mesh(dial, faceMat(S.clock)); d.position.set(0, 3.62, s * 0.081); d.rotation.y = s > 0 ? 0 : Math.PI; g.add(d);
      const hg = new THREE.Group(); hg.position.set(0, 3.62, s * 0.087); hg.rotation.y = s > 0 ? 0 : Math.PI;
      const hm = mat.toon('#3a3346');
      const hour = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.16, 0.006).translate(0, 0.06, 0), hm);
      const min = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.25, 0.006).translate(0, 0.1, 0.004), hm);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.012, 10).rotateX(Math.PI / 2), hm); cap.position.z = 0.008;
      hg.add(hour, min, cap); hg.userData = { hour, min };
      handGroups.push(hg);
    }
    const dyn = new THREE.Group(); dyn.position.copy(g.position); dyn.rotation.y = rotY; for (const hg of handGroups) dyn.add(hg);
    ctx.add(dyn);
    const setHands = (t) => {
      const mins = 2 + t / 60;
      const a = ((16 + mins / 60) % 12) / 12 * Math.PI * 2, b = (mins % 60) / 60 * Math.PI * 2;
      for (const hg of handGroups) { hg.userData.hour.rotation.z = -a; hg.userData.min.rotation.z = -b; }
    };
    setHands(0);
    ctx.onUpdate((dt, t) => setHands(t));
    face(g, 0.3, 0.075, S.clockPlate, [0, 1.45, 0.082]);
    PH.addBox(x, z, 0.46, 0.46, rotY, 0, 4.0);
  }

  // ================================================================ 桜ヶ丘駅開業九十周年 monument stone
  {
    const { x, z, rotY } = P.monument;
    const g = group(x, z, rotY), k = ctx.kit(g);
    // low, wide natural stone (≈1 m): it stands in the hero view's sightline to the level crossing
    k.box(1.76, 0.14, 0.66, mat.toon('#ffffff', { map: T.granite, paint: 0.05 }), [0, 0.07, 0]);
    const sil = [[-0.7, 0], [0.74, 0], [0.8, 0.2], [0.76, 0.46], [0.62, 0.68], [0.34, 0.8], [-0.06, 0.82], [-0.42, 0.76], [-0.66, 0.58], [-0.78, 0.3]];
    const stoneM = mat.toon('#a9a598', { paint: 0.12 }); stoneM.userData.plazaKeep = true;
    {
      // smooth natural outline (spline through the silhouette) with a rounded 4-step bevel,
      // so the stone reads as a soft weathered boulder instead of a faceted polygon
      const pts = sil.map(p => new THREE.Vector2(p[0], p[1]));
      const curve = new THREE.SplineCurve([...pts, pts[0]]);
      const shape = new THREE.Shape(curve.getPoints(64));
      const sg = new THREE.ExtrudeGeometry(shape, { depth: 0.24, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.05, bevelSegments: 4, curveSegments: 64 });
      sg.translate(0, 0, -0.12);
      put(g, sg, stoneM, [0, 0.14, 0]);
    }
    face(g, 0.86, 0.296, S.monument, [0.0, 0.14 + 0.42, 0.186]);
    k.box(0.9, 0.336, 0.02, mat.toon('#3f3d46'), [0, 0.14 + 0.42, 0.176]);
    face(g, 0.36, 0.126, S.monumentPlate, [0, 0.07, 0.334]);
    PH.addBox(x, z, 1.8, 0.7, rotY, 0, 1.05);
  }

  // ================================================================ drinking fountain (水飲み場)
  {
    const { x, z, rotY } = P.fountain;
    const g = group(x, z, rotY), k = ctx.kit(g);
    const gr = mat.toon('#ffffff', { map: T.granite, paint: 0.05 });
    k.boxB(0.5, 0.05, 0.5, gr, [0, 0, 0]);
    k.rbox(0.3, 0.72, 0.3, 0.03, gr, [0, 0.41, 0]);
    k.cyl(0.21, 0.16, 0.1, gr, [0, 0.8, 0], null, 18);
    k.cyl(0.17, 0.17, 0.012, mat.toon('#8fa3ad'), [0, 0.846, 0], null, 18);
    k.cyl(0.018, 0.018, 0.1, M.steel, [0, 0.9, 0.06], null, 8);
    k.box(0.05, 0.03, 0.05, M.steel, [0, 0.95, 0.06]);
    k.box(0.06, 0.05, 0.03, M.steelD, [0, 0.62, 0.16]);
    k.boxB(0.2, 0.14, 0.03, gr, [0, 0.05, 0.3]);                 // low step for children
    PH.addBox(x, z, 0.5, 0.5, rotY, 0, 1.0);
  }

  // ================================================================ round concrete planters
  for (const [px, pz] of P.planters) {
    const g = group(px, pz, 0), k = ctx.kit(g);
    k.cyl(0.46, 0.38, 0.46, M.concrete, [0, 0.23, 0], null, 22);
    k.cyl(0.48, 0.48, 0.05, mat.toon('#cfcbc0', { map: T.concrete }), [0, 0.47, 0], null, 22);
    k.cyl(0.42, 0.42, 0.02, mat.toon('#ffffff', { map: T.soil }), [0, 0.45, 0], null, 18);
    PH.addCylinder(px, pz, 0.5, 0, 0.9);
  }

  // ================================================================ park bench between the planters (faces the tree)
  {
    const { x, z, rotY, len } = P.parkBench;
    const g = group(x, z, rotY), k = ctx.kit(g);
    const fr = mat.toon('#56615e', { paint: 0.03 });
    const seatY = 0.44;
    for (const s of [-1, 1]) {
      const lx = s * (len / 2 - 0.2);
      k.box(0.05, seatY - 0.03, 0.05, fr, [lx, (seatY - 0.03) / 2, 0.15]);             // front leg
      k.box(0.05, 0.84, 0.05, fr, [lx, 0.42, -0.2], [-0.12, 0, 0]);                      // rear leg + back post (raked)
      k.box(0.05, 0.035, 0.46, fr, [lx, seatY - 0.05, -0.02]);                           // seat bearer
      k.box(0.05, 0.03, 0.42, fr, [lx, 0.62, 0.0]);                                      // armrest
      k.box(0.05, 0.2, 0.04, fr, [lx, 0.52, 0.18]);
    }
    for (let i = 0; i < 4; i++) k.box(len, 0.03, 0.085, M.woodL, [0, seatY - 0.015, 0.16 - i * 0.1]);
    for (let i = 0; i < 2; i++) k.box(len, 0.08, 0.025, M.woodL, [0, 0.6 + i * 0.13, -0.235 - i * 0.016], [-0.12, 0, 0]);
    out.benches.push({ x, z, y: seatY, rotY, len: +(len - 0.5).toFixed(2) });
    PH.addBox(x, z, 0.5, len, 0, 0, 0.8);
  }

  // ================================================================ low station-name board (駅名標識) in the tulip bed
  {
    const { x, z, rotY } = P.nameSign;
    const g = group(x, z, rotY), k = ctx.kit(g);
    const post = mat.toon('#4a5667', { paint: 0.04 });
    const tex = ctx.tex.draw(512, 160, (c, w, h) => {
      c.fillStyle = '#f4f1ea'; c.fillRect(0, 0, w, h);
      c.fillStyle = L.NAMES.lineColor; c.fillRect(0, 0, w, 16); c.fillStyle = L.NAMES.lineColorDeep; c.fillRect(0, 16, w, 4);
      // line badge
      c.fillStyle = L.NAMES.lineColorDeep; ctx.tex.roundRect(c, 20, 44, 78, 78, 14); c.fill();
      c.fillStyle = '#f7f3ea'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.font = `900 26px ${ctx.tex.FONTS.en}`; c.fillText('SK', 59, 70); c.font = `900 34px ${ctx.tex.FONTS.en}`; c.fillText('07', 59, 102);
      c.fillStyle = '#3a3346'; c.textAlign = 'left';
      ctx.tex.fitText(c, '桜ヶ丘駅', 116, 78, 228, 66, ctx.tex.FONTS.sans, 900);
      c.fillStyle = '#6a6272'; ctx.tex.fitText(c, 'さくらがおか', 120, 130, 170, 24, ctx.tex.FONTS.round, 700);
      c.textAlign = 'right'; c.fillStyle = '#6a6272'; ctx.tex.fitText(c, 'Sakuragaoka Sta.', 494, 130, 180, 24, ctx.tex.FONTS.en, 600);
      c.fillStyle = L.NAMES.lineColorDeep; ctx.tex.fitText(c, '桜川線', 494, 64, 96, 30, ctx.tex.FONTS.sans, 800);
      T.sakuraIcon(c, 382, 64, 14, '#f2b5c8', '#dd7f9d');
      c.fillStyle = '#8a8290'; ctx.tex.fitText(c, '駅前広場', 494, 96, 96, 20, ctx.tex.FONTS.sans, 700);
    }, { key: 'plaza-name-sign' });
    for (const s of [-1, 1]) { k.boxB(0.07, 1.0, 0.07, post, [s * 0.62, 0.2, 0]); }
    k.rbox(1.5, 0.5, 0.07, 0.02, post, [0, 0.8, 0]);
    face(g, 1.44, 0.45, tex, [0, 0.8, 0.037]);
    k.box(1.44, 0.45, 0.01, mat.toon('#e6e1d4'), [0, 0.8, -0.036]);
    PH.addBox(x, z, 1.55, 0.2, rotY, 0, 1.1);
  }

  // ================================================================ small lived-in details
  {
    // broom, dustpan and a bucket leaning at the bike-roof west post (morning clean-up by the 町内会)
    const row = rows[1];
    const px = row.x0 - 0.45, pz = row.z - 1.3;
    const g = group(px - 0.02, pz + 0.16, 0), k = ctx.kit(g);
    const br = new THREE.Group(); br.position.set(-0.08, 0, 0); br.rotation.set(0.0, 0.3, -0.2); g.add(br);
    const bk = ctx.kit(br);
    bk.cyl(0.013, 0.013, 1.2, mat.toon('#c9a26e'), [0, 0.68, 0], null, 6);
    bk.box(0.26, 0.2, 0.06, mat.toon('#b9954f', { paint: 0.08 }), [0, 0.1, 0]);
    bk.box(0.2, 0.04, 0.07, mat.toon('#d9463b'), [0, 0.2, 0]);
    const dp = new THREE.Group(); dp.position.set(0.16, 0, 0.06); dp.rotation.set(-0.25, -0.4, 0); g.add(dp);
    ctx.kit(dp).box(0.24, 0.012, 0.2, mat.toon('#5f86c8'), [0, 0.12, 0.08], [1.25, 0, 0]);
    ctx.kit(dp).cyl(0.011, 0.011, 0.72, mat.toon('#5f86c8'), [0, 0.46, 0.0], null, 6);
    k.cyl(0.13, 0.11, 0.26, mat.toon('#6fa7c9', { paint: 0.03 }), [0.34, 0.13, 0.12], null, 14);
    k.cyl(0.118, 0.118, 0.012, mat.toon('#4f7fa0'), [0.34, 0.255, 0.12], null, 14);
    const hd = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.006, 4, 12, Math.PI), M.steelD); hd.position.set(0.34, 0.26, 0.12); hd.rotation.set(-0.5, 0.2, 0); g.add(hd);
    PH.addBox(px + 0.1, pz + 0.3, 0.7, 0.4, 0, 0, 0.6);
  }
  {
    // green watering can next to the north-west flower bed
    const g = group(-4.5, -22.25, 0.9), k = ctx.kit(g);
    const gc = mat.toon('#7fb07a', { paint: 0.04 });
    k.rbox(0.28, 0.2, 0.14, 0.05, gc, [0, 0.11, 0]);
    k.cyl(0.012, 0.022, 0.32, gc, [0.2, 0.2, 0], [0, 0, -0.95], 6);
    k.cyl(0.03, 0.02, 0.03, gc, [0.33, 0.29, 0], [0, 0, -0.95], 8);
    const h = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.012, 5, 10, Math.PI), gc); h.position.set(-0.03, 0.21, 0); g.add(h);
  }
  {
    // mascot stickers (さくらまる) on the phone booth and the bus-stop pole; donor plate on the ring bench
    const stk = ctx.tex.draw(128, 128, (g, w, h) => {
      g.clearRect(0, 0, w, h);
      g.fillStyle = '#fbe9ef'; g.beginPath(); g.arc(64, 64, 60, 0, 7); g.fill(); g.strokeStyle = '#eb9db6'; g.lineWidth = 6; g.stroke();
      T.sakuraIcon(g, 64, 22, 18, '#f2b5c8', '#dd7f9d');
      g.fillStyle = '#3a3346'; g.beginPath(); g.arc(46, 62, 6, 0, 7); g.arc(82, 62, 6, 0, 7); g.fill();
      g.fillStyle = '#f2a0b0'; g.beginPath(); g.arc(34, 76, 7, 0, 7); g.arc(94, 76, 7, 0, 7); g.fill();
      g.strokeStyle = '#3a3346'; g.lineWidth = 3; g.beginPath(); g.arc(64, 70, 9, 0.2, Math.PI - 0.2); g.stroke();
      g.fillStyle = '#c24a6e'; g.font = `900 17px ${ctx.tex.FONTS.round}`; g.textAlign = 'center'; g.fillText('さくらまる', 64, 108);
    }, { key: 'plaza-sticker' });
    const sm = mat.decal('#ffffff', { map: stk, alphaTest: 0.5, transparent: false, depthWrite: true });
    const ph = P.phone; const pg = group(ph.x, ph.z, ph.rotY);
    const s1 = new THREE.Mesh(ctx.geo.G.plane(), sm); s1.scale.set(0.09, 0.09, 1); s1.position.set(0.3, 0.62, 0.434); pg.add(s1);
    const bs = L.PLAZA.busStop; const bg = group(bs.x, bs.z, 0);
    const s2 = new THREE.Mesh(ctx.geo.G.plane(), sm); s2.scale.set(0.06, 0.06, 1); s2.position.set(0, 0.95, 0.033); bg.add(s2);
    ctx.noOutline(s1); ctx.noOutline(s2);
  }

  return out;
}

let _news = null;
function newspaperTex(ctx) {
  if (_news) return _news;
  _news = ctx.tex.draw(256, 176, (g, w, h) => {
    g.fillStyle = '#ece8dd'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#3a3346'; g.textAlign = 'right'; g.textBaseline = 'top';
    g.font = `900 30px ${ctx.tex.FONTS.serif}`; g.fillText('桜ヶ丘新聞', w - 10, 8);
    g.font = `700 16px ${ctx.tex.FONTS.serif}`; g.fillText('春まつり 今週末に開催', w - 10, 48);
    g.fillStyle = 'rgba(58,51,70,0.45)';
    for (let c = 0; c < 9; c++) for (let r = 0; r < 7; r++) g.fillRect(w - 20 - c * 24, 76 + r * 13, 16, 3);
    g.fillStyle = '#c3aecb'; g.fillRect(12, 12, 70, 52);
  }, { key: 'plaza-newspaper' });
  return _news;
}
