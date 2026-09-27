// Tree pit (brick ring, stone cap, soil, grass, moss, small flowers) + circular wooden ring bench
// around the plaza sakura, with a school bag, a shopping bag with leeks and a half-finished drink on it.
import * as THREE from 'three';
import { ringSector, annulus, put, instanced, mtx, TAU, GeoBuilder, addSway } from './util.js';

export function buildTree(ctx, root, T, P) {
  const { mat, physics, L } = ctx;
  const cx = P.tree.x, cz = P.tree.z;
  const g = new THREE.Group(); g.name = 'plaza-tree'; g.position.set(cx, 0, cz); root.add(g);
  const r = ctx.rng('plaza-tree');

  // ---------------------------------------------------------------- circle pavers around the pit
  const circle = put(g, annulus(1.62, P.circleR, P.yPave, 120, 5, 6), mat.toon('#ffffff', { map: T.circle, paint: 0.05 }), [0, 0, 0], null, { cast: false });
  circle.name = 'tree-circle';
  // granite rim course
  put(g, annulus(P.circleR, P.circleR + 0.02, P.yPave, 120, 1, 6), mat.toon('#9d9a92'), [0, 0, 0], null, { cast: false });

  // ---------------------------------------------------------------- pit: brick wall + stone cap stones + soil
  const PIT = { rIn: 1.40, rOut: 1.62, h: 0.26 };
  put(g, ringSector(PIT.rIn, PIT.rOut, 0.0, PIT.h, 0, TAU, 64, { noBottom: true }), mat.toon('#ffffff', { map: T.brick, paint: 0.05 }), [0, 0, 0]);
  const capMats = ['#d9d6cc', '#d2cfc5', '#dedbd2'].map(c => mat.toon(c, { map: T.concrete, paint: 0.05 }));
  const nCap = 14;
  for (let i = 0; i < nCap; i++) {
    const a0 = (i / nCap) * TAU + 0.004, a1 = ((i + 1) / nCap) * TAU - 0.004;
    put(g, ringSector(1.35, 1.69, PIT.h, PIT.h + 0.055, a0, a1, 5), capMats[i % 3], [0, 0, 0]);
  }
  // soil disc with a gentle mound
  {
    const B = new GeoBuilder(); const rings = 6, seg = 40; const rows = [];
    for (let j = 0; j <= rings; j++) {
      const rr = PIT.rIn * j / rings; const row = [];
      for (let i = 0; i <= seg; i++) {
        const a = TAU * i / seg; const x = rr * Math.cos(a), z = rr * Math.sin(a);
        row.push(B.v(x, 0.205 + 0.05 * (1 - (rr / PIT.rIn) ** 2), z, 0, 1, 0, x, -z));
        if (j === 0) break;
      }
      rows.push(row);
    }
    for (let j = 0; j < rings; j++) for (let i = 0; i < seg; i++) {
      if (j === 0) B.tri(rows[0][0], rows[1][i], rows[1][i + 1]); else B.quad(rows[j][i], rows[j][i + 1], rows[j + 1][i + 1], rows[j + 1][i]);
    }
    const geo = B.build(); geo.computeVertexNormals();
    put(g, geo, mat.toon('#ffffff', { map: T.soil, paint: 0.06 }), [0, 0, 0], null, { cast: false });
  }
  // moss patches on soil + on the cap (decals)
  const mossMat = mat.decal('#6f8d55', { alphaMap: T.moss, opacity: 0.85 });
  for (let i = 0; i < 9; i++) {
    const a = r() * TAU, rr = r.range(0.7, 1.3), s = r.range(0.25, 0.5);
    const y = 0.205 + 0.05 * (1 - (rr / PIT.rIn) ** 2) + 0.006;
    const m = put(g, ctx.geo.G.plane(), mossMat, [rr * Math.cos(a), y, rr * Math.sin(a)], [-Math.PI / 2, 0, r() * 3], { cast: false });
    m.scale.set(s, s * r.range(0.6, 1), 1);
  }
  for (let i = 0; i < 5; i++) {
    const a = r() * TAU;
    const m = put(g, ctx.geo.G.plane(), mat.decal('#7d9460', { alphaMap: T.moss, opacity: 0.7 }), [1.52 * Math.cos(a), PIT.h + 0.059, 1.52 * Math.sin(a)], [-Math.PI / 2, 0, r() * 3], { cast: false });
    m.scale.set(0.3, 0.14, 1);
  }

  // ---------------------------------------------------------------- pit plants (instanced cut-outs)
  const soilY = (rr) => 0.205 + 0.05 * (1 - (rr / PIT.rIn) ** 2);
  const tuftGeo = crossQuads(1, 1, 3);
  const grassMats = [], grassCols = [];
  for (let i = 0; i < 90; i++) {
    const a = r() * TAU, rr = Math.sqrt(r.range(0.30, 1)) * 1.32;
    if (rr < 0.62) continue;
    const s = r.range(0.07, 0.15);
    grassMats.push(mtx(rr * Math.cos(a), soilY(rr) - 0.01, rr * Math.sin(a), 0, r() * TAU, 0, [s * r.range(0.9, 1.4), s, s]));
    grassCols.push(new THREE.Color().setHSL(0.24 + r.range(-0.03, 0.03), 0.4, 0.5 + r.range(-0.08, 0.06)));
  }
  const grass = instanced(tuftGeo, addSway(ctx, mat.foliage('#ffffff', T.grass, { name: 'plaza-sway-grass' }), 0.018, 'up'), grassMats, grassCols);
  ctx.noOutline(grass); g.add(grass);
  // small flowers: white star flowers, violets, a few dandelions
  const flatGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const fl = [], flc = [];
  for (let i = 0; i < 46; i++) {
    const a = r() * TAU, rr = r.range(0.7, 1.33);
    const s = r.range(0.1, 0.17);
    fl.push(mtx(rr * Math.cos(a), soilY(rr) + r.range(0.03, 0.08), rr * Math.sin(a), r.range(-0.3, 0.3), r() * TAU, r.range(-0.3, 0.3), s));
    flc.push(new THREE.Color(r.pick(['#ffffff', '#ffffff', '#e8e4ff', '#d9ccf2', '#f7e0ec'])));
  }
  const flowers = instanced(flatGeo, addSway(ctx, mat.foliage('#ffffff', T.tinyFlower, { name: 'plaza-sway-tiny' }), 0.008, 'flat'), fl, flc);
  ctx.noOutline(flowers); g.add(flowers);
  const dd = [];
  for (let i = 0; i < 6; i++) { const a = r() * TAU, rr = r.range(0.8, 1.3); dd.push(mtx(rr * Math.cos(a), soilY(rr) + 0.07, rr * Math.sin(a), r.range(-0.4, 0.4), r() * TAU, 0, 0.07)); }
  const dand = instanced(flatGeo, addSway(ctx, mat.foliage('#ffffff', T.dandelion, { name: 'plaza-sway-dand' }), 0.008, 'flat'), dd);
  ctx.noOutline(dand); g.add(dand);

  // ---------------------------------------------------------------- ring bench
  const B = { r0: 2.08, r1: 2.52, seatY: L.SPOTS.plazaBenchSeatY, n: 8 };
  const cat = L.SPOTS.calicoCat;
  const th0 = Math.atan2(cat.z - cz, cat.x - cx);     // cat sits on the middle of one section
  const secA = TAU / B.n, gapA = 0.012;
  const wood = mat.toon('#ffffff', { map: T.wood, paint: 0.05 });
  const woodB = mat.toon('#f1e8dc', { map: T.wood, paint: 0.05 });
  const frame = mat.toon('#56615e', { paint: 0.03 });
  const nSl = 5, slGap = 0.014, slW = (B.r1 - B.r0 - (nSl - 1) * slGap) / nSl, slT = 0.034;
  const legs = [];
  const sections = [];
  for (let k = 0; k < B.n; k++) {
    const th = th0 + k * secA;
    const a0 = th - secA / 2 + gapA / 2, a1 = th + secA / 2 - gapA / 2;
    for (let i = 0; i < nSl; i++) {
      const ra = B.r0 + i * (slW + slGap);
      put(g, ringSector(ra, ra + slW, B.seatY - slT, B.seatY, a0, a1, 7, { uvScale: 1 }), i % 2 ? woodB : wood, [0, 0, 0]);
    }
    // seat rails under the slats
    put(g, ringSector(2.12, 2.14, B.seatY - slT - 0.05, B.seatY - slT, a0 + 0.01, a1 - 0.01, 6), frame, [0, 0, 0]);
    put(g, ringSector(2.46, 2.48, B.seatY - slT - 0.05, B.seatY - slT, a0 + 0.01, a1 - 0.01, 6), frame, [0, 0, 0]);
    // backrest (two curved slats, facing outward)
    put(g, ringSector(2.025, 2.058, 0.57, 0.655, a0, a1, 7), wood, [0, 0, 0]);
    put(g, ringSector(2.025, 2.058, 0.715, 0.80, a0, a1, 7), woodB, [0, 0, 0]);
    sections.push({ th, a0, a1 });
    legs.push(th + secA / 2);
  }
  // leg frames at section boundaries
  const kit = ctx.kit(g);
  for (const a of legs) {
    const ca = Math.cos(a), sa = Math.sin(a);
    const at = (rr, y) => [rr * ca, y, rr * sa];
    const ry = -a; // box local x -> radial
    kit.box(0.045, 0.84, 0.045, frame, at(2.075, 0.42), [0, ry, 0]);           // inner post (+ backrest post)
    kit.box(0.045, B.seatY - slT, 0.045, frame, at(2.46, (B.seatY - slT) / 2), [0, ry, 0]);
    kit.box(0.46, 0.035, 0.05, frame, at(2.28, B.seatY - slT - 0.03), [0, ry, 0]);   // under-seat crossbar
    kit.box(0.5, 0.03, 0.07, frame, at(2.28, 0.015), [0, ry, 0]);                      // foot bar
    kit.box(0.06, 0.02, 0.06, frame, at(2.075, 0.85), [0, ry, 0]);                     // post cap
  }

  // ---------------------------------------------------------------- items on the bench
  const secIdx = (deg) => { // section whose centre is closest to a compass angle (atan2(z,x) in degrees)
    let best = 0, bd = 1e9;
    sections.forEach((s, i) => { const d = Math.abs(Math.atan2(Math.sin(s.th - deg * Math.PI / 180), Math.cos(s.th - deg * Math.PI / 180))); if (d < bd) { bd = d; best = i; } });
    return best;
  };
  const sSouth = secIdx(90), sSW = secIdx(138);
  const placeOnSeat = (theta, rad) => {
    const grp = new THREE.Group();
    grp.position.set(rad * Math.cos(theta), B.seatY, rad * Math.sin(theta));
    grp.rotation.y = Math.atan2(Math.cos(theta), Math.sin(theta)); // local +Z = outward
    g.add(grp); return grp;
  };
  schoolBag(ctx, placeOnSeat(sections[sSouth].th - 0.2, 2.2), T);
  drinkCup(ctx, placeOnSeat(sections[sSouth].th + 0.24, 2.37));
  shoppingBag(ctx, placeOnSeat(sections[sSW].th + 0.08, 2.25), T);

  // small brass donor plate on one backrest
  {
    const plate = ctx.tex.draw(256, 64, (g2, w, h) => {
      g2.fillStyle = '#c2a568'; g2.fillRect(0, 0, w, h); g2.strokeStyle = '#8f7442'; g2.lineWidth = 4; g2.strokeRect(3, 3, w - 6, h - 6);
      g2.fillStyle = '#4a3a22'; g2.textAlign = 'center'; g2.textBaseline = 'middle'; g2.font = `700 22px ${ctx.tex.FONTS.serif}`;
      g2.fillText('寄贈  平成三年度 卒業生一同', w / 2, h / 2 + 1);
    }, { key: 'plaza-bench-plate' });
    const th = sections[secIdx(50)].th;
    const m = new THREE.Mesh(ctx.geo.G.plane(), mat.toon('#ffffff', { map: plate, paint: 0.01, polygonOffset: -1 }));
    m.scale.set(0.2, 0.05, 1); m.position.set(2.063 * Math.cos(th), 0.757, 2.063 * Math.sin(th)); m.rotation.y = Math.atan2(Math.cos(th), Math.sin(th));
    g.add(m);
  }

  // ---------------------------------------------------------------- physics + services
  physics.addCylinder(cx, cz, 1.72, 0, 1.4);
  const benches = [];
  const used = new Set([sSouth, sSW, 0]);
  sections.forEach((s, i) => {
    const x = cx + 2.3 * Math.cos(s.th), z = cz + 2.3 * Math.sin(s.th);
    const rotY = Math.atan2(Math.cos(s.th), Math.sin(s.th));
    const chord = 2 * 2.55 * Math.sin(secA / 2);
    physics.addBox(cx + 2.3 * Math.cos(s.th), cz + 2.3 * Math.sin(s.th), chord, 0.6, rotY, 0, 0.9);
    benches.push({ x, z, y: B.seatY, rotY, len: +(2 * 2.3 * Math.sin(secA / 2) - 0.1).toFixed(2), _used: used.has(i) });
  });
  benches.sort((a, b) => (a._used ? 1 : 0) - (b._used ? 1 : 0));
  return benches.map(({ _used, ...b }) => b);
}

// crossed vertical quads (unit: width 1, height 1, base at y=0)
export function crossQuads(w = 1, h = 1, n = 2) {
  const geos = [];
  for (let i = 0; i < n; i++) {
    const p = new THREE.PlaneGeometry(w, h); p.translate(0, h / 2, 0); p.rotateY((i / n) * Math.PI);
    geos.push(p);
  }
  const out = new THREE.BufferGeometry();
  const pos = [], nor = [], uv = [], idx = []; let o = 0;
  for (const q of geos) {
    pos.push(...q.attributes.position.array); nor.push(...q.attributes.normal.array); uv.push(...q.attributes.uv.array);
    for (const k of q.index.array) idx.push(k + o); o += q.attributes.position.count;
  }
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor.map((v, i) => (i % 3 === 1 ? 1 : 0)), 3)); // up-facing normals: soft, even lighting
  out.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  out.setIndex(idx);
  return out;
}

// ---------------------------------------------------------------- bench items (local: +Z outward, y=0 = seat top)
function schoolBag(ctx, grp, T) {
  const { mat } = ctx;
  const k = ctx.kit(grp);
  const navy = mat.toon('#3f4768', { paint: 0.04 }), navyD = mat.toon('#353c5a', { paint: 0.03 });
  const tilt = new THREE.Group(); tilt.position.set(0, 0, -0.055); tilt.rotation.x = -0.24; grp.add(tilt);
  const t = ctx.kit(tilt);
  t.rbox(0.40, 0.29, 0.11, 0.03, navy, [0, 0.145, 0.055]);
  t.rbox(0.38, 0.15, 0.02, 0.01, navyD, [0, 0.215, 0.115]);              // front flap
  t.box(0.05, 0.035, 0.012, mat.toon('#c9ccd1'), [0, 0.15, 0.124]);       // clasp
  t.box(0.30, 0.012, 0.004, mat.toon('#e3d6b8'), [0, 0.268, 0.126]);      // stitched stripe
  const emb = t.plane(0.06, 0.06, mat.decal('#ffffff', { map: embTex(ctx, T) }), [0.12, 0.225, 0.1265]);
  emb.renderOrder = 1;
  // handle
  const h = new THREE.Mesh(new THREE.TorusGeometry(0.065, 0.011, 6, 14, Math.PI), navyD);
  h.position.set(0, 0.29, 0.055); tilt.add(h);
  // keychain charm (sakura mascot)
  t.box(0.006, 0.05, 0.006, mat.toon('#e9e3d6'), [-0.05, 0.27, 0.12]);
  t.sphere(0.022, mat.toon('#f2b5c8'), [-0.05, 0.235, 0.125], 10);
}
let _emb = null;
function embTex(ctx, T) {
  if (_emb) return _emb;
  _emb = ctx.tex.draw(64, 64, (g, w, h) => { g.clearRect(0, 0, w, h); g.fillStyle = '#e9e3d6'; g.beginPath(); g.arc(32, 32, 30, 0, 7); g.fill(); T.sakuraIcon(g, 32, 33, 20, '#ef9fbe', '#d9718f'); }, { key: 'plaza-emblem' });
  return _emb;
}

function drinkCup(ctx, grp) {
  const { mat } = ctx;
  const k = ctx.kit(grp);
  const glass = mat.glass({ tint: '#e8eef2', opacity: 0.22, streaks: false });
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.043, 0.034, 0.125, 16, 1, true), glass);
  cup.position.set(0, 0.0625, 0); grp.add(cup);
  k.cyl(0.037, 0.033, 0.058, mat.toon('#f2b3c4', { paint: 0.02 }), [0, 0.031, 0], null, 14);        // drink (half left)
  k.cyl(0.0385, 0.0375, 0.008, mat.toon('#f7dde2', { paint: 0.02 }), [0, 0.062, 0], null, 14);      // milky top
  k.cyl(0.044, 0.041, 0.042, mat.toon('#c9a77f', { paint: 0.03 }), [0, 0.07, 0], null, 16);          // kraft sleeve
  const lid = new THREE.Mesh(new THREE.SphereGeometry(0.044, 16, 6, 0, Math.PI * 2, 0, Math.PI / 2), glass);
  lid.scale.set(1, 0.55, 1); lid.position.set(0, 0.125, 0); grp.add(lid);
  k.cyl(0.046, 0.046, 0.006, mat.toon('#eef1f2'), [0, 0.126, 0], null, 16);                            // lid rim
  k.cyl(0.0048, 0.0048, 0.22, mat.toon('#ee9ab0'), [0.008, 0.13, 0.004], [0.12, 0, 0.1], 6);          // straw
}

function shoppingBag(ctx, grp, T) {
  const { mat } = ctx;
  const k = ctx.kit(grp);
  const canvas = mat.toon('#c7d7b4', { paint: 0.05 }), inner = mat.toon('#8fa07e', { paint: 0.03 });
  const W = 0.36, H = 0.3, D = 0.15, t = 0.012;
  k.box(W, t, D, inner, [0, t / 2, 0]);
  k.box(W, H, t, canvas, [0, H / 2, D / 2 - t / 2]);
  k.box(W, H, t, canvas, [0, H / 2, -D / 2 + t / 2]);
  k.box(t, H, D - 2 * t, canvas, [W / 2 - t / 2, H / 2, 0]);
  k.box(t, H, D - 2 * t, canvas, [-W / 2 + t / 2, H / 2, 0]);
  k.box(W - 0.02, 0.2, D - 0.03, inner, [0, 0.1, 0]);            // contents mass (dark inside)
  // handles
  for (const zz of [D / 2 - t / 2, -D / 2 + t / 2]) {
    const h = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.01, 5, 14, Math.PI), mat.toon('#a9bb96'));
    h.position.set(0, H, zz); grp.add(h);
  }
  // printed shop-street logo on the front
  const logo = ctx.tex.draw(128, 96, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    T.sakuraIcon(g, 64, 30, 20, '#f7f3ea', '#e0c8cf');
    g.fillStyle = '#f7f3ea'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `900 17px ${ctx.tex.FONTS.round}`; g.fillText('桜ヶ丘', 64, 64); g.font = `700 13px ${ctx.tex.FONTS.round}`; g.fillText('駅前商店街', 64, 84);
  }, { key: 'plaza-bag-logo' });
  k.plane(0.2, 0.15, mat.decal('#ffffff', { map: logo }), [0, 0.15, D / 2 + 0.004]);
  // leeks (長ネギ) poking out, leaning outward
  const white = mat.toon('#eeeadf', { paint: 0.03 }), pale = mat.toon('#cfe0a6', { paint: 0.03 }), green = mat.toon('#6f9a4e', { paint: 0.04 });
  const leek = (x, lean, twist, len) => {
    const lg = new THREE.Group(); lg.position.set(x, 0.03, -0.01); lg.rotation.set(lean, 0, twist); grp.add(lg);
    const lk = ctx.kit(lg);
    lk.cyl(0.017, 0.018, len * 0.45, white, [0, len * 0.225, 0], null, 8);
    lk.cyl(0.016, 0.017, len * 0.12, pale, [0, len * 0.51, 0], null, 8);
    for (let i = 0; i < 3; i++) {
      const leaf = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.013, len * 0.42, 5), green);
      leaf.position.set((i - 1) * 0.012, len * 0.78, 0); leaf.rotation.z = (i - 1) * 0.16; leaf.rotation.x = (i === 1 ? -0.1 : 0.05);
      leaf.castShadow = true; lg.add(leaf);
    }
  };
  leek(-0.06, 0.34, 0.22, 0.6);
  leek(-0.02, 0.28, 0.12, 0.56);
  // milk carton + bread bag peeking out
  k.box(0.07, 0.2, 0.07, mat.toon('#eef0f2'), [0.1, 0.12, -0.01]);
  k.box(0.072, 0.03, 0.072, mat.toon('#6a9ad0'), [0.1, 0.2, -0.01]);
  k.rbox(0.13, 0.12, 0.1, 0.04, mat.toon('#e9cf9a'), [0.05, 0.25, 0.0]);
}
