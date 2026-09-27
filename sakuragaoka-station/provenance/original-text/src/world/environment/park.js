// environment/park.js — 桜ヶ丘ふれあい緑地: a small green slope park on unowned ground east of the NE
// block (mound with a winding gravel path, log steps, a bench on top looking over the tracks, tsutsuji
// shrubs, young maples, an entrance sign); 市民農園 allotments and a gravel lot in the west strip.
import * as L from '../layout.js';
import { terrainH, parkMound, pathDist, PATHS, PARK, ALLOT_W, VACANT_W, fbm, smoothBlob } from './common.js';
import { shrubGeometry, flowerGeometry, foliageMaterial, SHRUB_COLORS } from '../lib/foliage.js';

export function buildPark(ctx, tx) {
  const { THREE } = ctx;
  const grp = new THREE.Group(); grp.name = 'env-park'; ctx.addStatic(grp);
  const k = ctx.kit(grp);
  const r = ctx.rng('env-park');
  const M = PARK.mound;
  const wood = ctx.mat.toon('#b48a62', { paint: 0.09, name: 'env-benchwood' });
  const woodD = ctx.mat.toon('#8a6446', { paint: 0.08 });
  const conc = ctx.mat.toon('#d4d0c5', { paint: 0.08, name: 'env-stair' });
  const logMat = ctx.mat.toon('#9a7b5c', { paint: 0.1 });

  // ---------------------------------------------------------------- walkable mound (physics boxes on a 0.7 m grid)
  const cs = 0.7;
  for (let x = M.x - M.rx; x < M.x + M.rx; x += cs) for (let z = M.z - M.rz; z < M.z + M.rz; z += cs) {
    const cx = x + cs / 2, cz = z + cs / 2;
    const h = parkMound(cx, cz); if (h < 0.04) continue;
    ctx.physics.addWalkBox(cx, cz, cs, cs, 0, L.heightAt(cx, cz) + h);
  }
  const isParkMound = (x, z) => parkMound(x, z) > 0.02;

  // ---------------------------------------------------------------- log steps (擬木階段) where the path climbs
  const park = PATHS.find((p) => p.kind === 'park');
  const pts = park.pts;
  let acc = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
    const len = Math.hypot(bx - ax, bz - az);
    for (let t = 0.6; t < len; t += 1.1) {
      const x = ax + (bx - ax) * t / len, z = az + (bz - az) * t / len;
      const slope = Math.abs(terrainH(x + (bx - ax) / len * 0.5, z + (bz - az) / len * 0.5) - terrainH(x - (bx - ax) / len * 0.5, z - (bz - az) / len * 0.5));
      acc += len;
      if (slope < 0.18) continue;
      const rot = Math.atan2(bx - ax, bz - az);
      const y = terrainH(x, z);
      k.cyl(0.075, 0.075, 1.5, logMat, [x, y + 0.03, z], null, 8).rotation.set(0, rot, Math.PI / 2, 'YXZ');
      for (const s of [-1, 1]) k.cyl(0.035, 0.035, 0.3, woodD, [x + Math.cos(rot) * 0.8 * s, y + 0.05, z - Math.sin(rot) * 0.8 * s], null, 6);
    }
  }

  // ---------------------------------------------------------------- bench on the top, looking north over the tracks
  const top = { x: M.x, z: M.z + 0.1 };
  {
    const y = terrainH(top.x, top.z - 0.6) - 0.05;
    const bg = k.group([top.x, y, top.z - 0.6], Math.PI);
    const kb = ctx.kit(bg);
    for (const sx of [-0.72, 0.72]) kb.box(0.09, 0.44, 0.46, conc, [sx, 0.2, 0]);
    for (let s = 0; s < 4; s++) kb.box(1.78, 0.04, 0.095, wood, [0, 0.44, -0.16 + s * 0.108]);
    for (let s = 0; s < 3; s++) kb.box(1.78, 0.085, 0.035, s === 1 ? woodD : wood, [0, 0.6 + s * 0.13, -0.235 - s * 0.018], [-0.12, 0, 0]);
    for (const sx of [-0.72, 0.72]) kb.box(0.08, 0.5, 0.07, conc, [sx, 0.68, -0.21], [-0.12, 0, 0]);
    ctx.physics.addBox(top.x, top.z - 0.6, 1.9, 0.62, Math.PI, y, y + 0.95);
  }

  // ---------------------------------------------------------------- tsutsuji shrubs + young maples
  // smooth puff-scalloped tsutsuji mounds in bloom (lib/foliage: welded surfaces, blended normals, baked
  // colour, procedural leaf clumps) with tiny pink / white blossoms; sizes & colliders as before.
  const fmat = foliageMaterial(ctx);
  const flMat = ctx.mat.toon('#ffffff', { vertexColors: true, paint: 0.02 });
  const TSUTSUJI = ['#ee8fb6', '#e8739f', '#f4a9c6', '#dd6a98', '#f6eef2'];
  const shrubs = [];
  for (let i = 0; i < 70 && shrubs.length < 24; i++) {
    const a = r() * Math.PI * 2, d = 0.95 + r() * 0.25;
    const x = M.x + Math.cos(a) * M.rx * d, z = M.z + Math.sin(a) * M.rz * d;
    if (pathDist(x, z).d < 2.2) continue;
    if (x < PARK.x0 + 1 || x > PARK.x1 - 1 || z < PARK.z0 + 1 || z > PARK.z1 - 1) continue;
    if (shrubs.some((s) => Math.hypot(s.x - x, s.z - z) < 2.0)) continue;
    const s = 0.55 + r() * 0.35;
    shrubs.push({ x, z, s });
    const sb = Math.round(s * 10) / 10, v = shrubs.length % 3;
    const geo = shrubGeometry({ rx: sb * 1.3, ry: sb * 0.755, rz: sb * 1.1, seed: 40 + v * 7, detail: 3, lumps: 0.18, puff: Math.max(0.3, sb * 0.45), colors: SHRUB_COLORS.azalea });
    const m = new THREE.Mesh(geo, fmat); m.scale.setScalar(s / sb); m.position.set(x, terrainH(x, z) - 0.03, z); m.rotation.y = r() * 3;
    m.castShadow = true; m.receiveShadow = true; grp.add(m);
    const fl = new THREE.Mesh(flowerGeometry(geo, { density: 8, size: 0.04, petals: 0, colors: TSUTSUJI, seed: v * 5 + 3, minY: 0.32 }), flMat);
    fl.castShadow = false; fl.receiveShadow = true; ctx.noOutline(fl); m.add(fl);
    ctx.physics.addCylinder(x, z, s * 1.1, terrainH(x, z), terrainH(x, z) + s);
  }
  const trunk = ctx.mat.toon('#7a6452', { paint: 0.05 });
  // canopy lobes: smooth lumpy clouds in three fresh spring greens (vertex-coloured, one shared material)
  const MAPLE = [{ top: '#c9e09a', mid: '#9cc27a', base: '#6d9760' }, { top: '#dcebaa', mid: '#b9d38a', base: '#88a972' }, { top: '#b7d58e', mid: '#86b06a', base: '#5b8858' }];
  const lobe = MAPLE.map((c, v) => shrubGeometry({ rx: 1, ry: 1, rz: 1, detail: 2, flatBottom: false, cutBottom: false, lumps: 0.3, freq: 1.6, puff: 0, seed: 71 + v, colors: c, normalBlend: 0.45 }).clone().translate(0, -0.55, 0));
  // young keyaki / maple: forked trunk + a dome of overlapping leaf clumps (three greens)
  for (const [x, z, h] of [[66.2, -9.5, 5.4], [90.2, -29.8, 6.0], [66.8, -30.6, 4.8], [91.0, -9.2, 4.4]]) {
    const y = terrainH(x, z);
    k.cyl(0.09, 0.15, h * 0.5, trunk, [x, y + h * 0.25, z], null, 7);
    for (const [ax, az] of [[0.5, 0.2], [-0.45, 0.35], [0.05, -0.55]]) k.cyl(0.04, 0.07, h * 0.3, trunk, [x + ax * h * 0.06, y + h * 0.56, z + az * h * 0.06], [az * 0.5, 0, -ax * 0.5], 6);
    const cy = y + h * 0.68, R = h * 0.34;
    const clumps = [[0, 0.35, 0, 0.62]];
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + r() * 0.5; clumps.push([Math.cos(a) * 0.62, (r() - 0.35) * 0.4, Math.sin(a) * 0.62, 0.44 + r() * 0.12]); }
    for (let i = 0; i < 2; i++) { const a = r() * Math.PI * 2; clumps.push([Math.cos(a) * 0.3, 0.7 + r() * 0.15, Math.sin(a) * 0.3, 0.38]); }
    clumps.forEach(([cx, cyy, cz, cs], i) => {
      const m = new THREE.Mesh(lobe[i % 3], fmat);
      const sc = R * cs * 1.25;
      m.scale.set(sc, sc * 0.82, sc); m.position.set(x + cx * R, cy + cyy * R, z + cz * R);
      m.castShadow = true; m.receiveShadow = true; grp.add(m);
    });
    ctx.physics.addCylinder(x, z, 0.2, y, y + 3);
  }

  // ---------------------------------------------------------------- entrance sign + low log fence along R3
  const signTex = ctx.tex.draw(512, 256, (g, w, h) => {
    g.fillStyle = '#9b7552'; g.fillRect(0, 0, w, h);
    const rr = ctx.rng('env-parksign');
    for (let i = 0; i < 40; i++) { const y = rr() * h; g.strokeStyle = 'rgba(90,62,40,0.35)'; g.lineWidth = 1 + rr() * 2; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(w * 0.4, y + 6, w * 0.6, y - 6, w, y); g.stroke(); }
    g.strokeStyle = '#5a4032'; g.lineWidth = 10; g.strokeRect(5, 5, w - 10, h - 10);
    g.fillStyle = '#fbf3e4'; g.textAlign = 'center'; g.textBaseline = 'middle';
    ctx.tex.fitText(g, '桜ヶ丘ふれあい緑地', w / 2, h * 0.4, w * 0.88, 64, ctx.tex.FONTS.serif, 700);
    ctx.tex.fitText(g, 'さくらがおか ふれあいりょくち', w / 2, h * 0.64, w * 0.8, 24, ctx.tex.FONTS.round, 700);
    g.globalAlpha = 0.85; ctx.tex.fitText(g, '花壇にはいらないでね　桜ヶ丘町', w / 2, h * 0.83, w * 0.8, 20, ctx.tex.FONTS.sans, 500); g.globalAlpha = 1;
  }, { key: 'env-park-sign' });
  {
    const x = 68.6, z = -7.3, y = terrainH(x, z);
    const sg = k.group([x, y, z], 0.2); const ks = ctx.kit(sg);
    for (const px of [-0.55, 0.55]) ks.box(0.1, 1.3, 0.1, woodD, [px, 0.65, 0]);
    ks.box(1.24, 0.64, 0.06, wood, [0, 1.0, 0]);
    ks.plane(1.16, 0.58, ctx.mat.toon('#ffffff', { map: signTex, paint: 0.03 }), [0, 1.0, 0.031]);
    ctx.physics.addBox(x, z, 1.3, 0.2, 0.2, y, y + 1.4);
    // log fence posts + rope along the R3 side (gaps at the two path entrances)
    for (let fx = PARK.x0 + 0.5; fx < PARK.x1 - 0.3; fx += 1.6) {
      if (Math.abs(fx - 70.5) < 1.4 || Math.abs(fx - 86.5) < 1.4 || Math.abs(fx - 68.6) < 1.0) continue;
      const fz = PARK.z1 - 0.35, fy = terrainH(fx, fz);
      k.cyl(0.06, 0.06, 0.55, logMat, [fx, fy + 0.27, fz], null, 7);
      if (fx + 1.6 < PARK.x1 - 0.3 && !(Math.abs(fx + 0.8 - 70.5) < 1.6) && !(Math.abs(fx + 0.8 - 86.5) < 1.6)) {
        ctx.wires.add(ctx.geo.catenary([fx, fy + 0.45, fz], [fx + 1.6, fy + 0.45, fz], 0.08, 6), { width: 0.018, color: '#c8b48c' });
      }
    }
  }

  // ---------------------------------------------------------------- 市民農園 allotments (west strip)
  {
    const A = ALLOT_W;
    const soil = ctx.mat.toon('#ffffff', { map: tx.fields.veg, paint: 0.05, name: 'env-allot' });
    const soilD = ctx.mat.toon('#a58b6c', { paint: 0.06 });
    const bamboo = ctx.mat.toon('#c9b98a', { paint: 0.04 });
    const net = ctx.mat.toon('#7fae8c', { paint: 0.02, transparent: true, opacity: 0.55, side: 'double', depthWrite: false });
    const cabG = smoothBlob(THREE, 0);
    const cabs = [];
    const pw = 3.6, pd = 6.0, gap = 0.9;
    let id = 1;
    for (let x = A.x0 + 0.6; x + pw < A.x1; x += pw + gap) for (let z = A.z0 + 0.6; z + pd < A.z1; z += pd + gap) {
      if (r() < 0.12) { id++; continue; } // an unused plot (grass)
      const cx = x + pw / 2, cz = z + pd / 2, y = Math.max(L.heightAt(x, z), L.heightAt(x + pw, z + pd)) + 0.02;
      k.box(pw, 0.5, pd, soilD, [cx, y - 0.13, cz]);
      k.plane(pw - 0.04, pd - 0.04, soil, [cx, y + 0.122, cz], [-Math.PI / 2, 0, 0]).receiveShadow = true;
      // crops: cabbages / leafy rows or bamboo stakes with a net
      const kind = r();
      if (kind < 0.55) {
        for (let rx = x + 0.45; rx < x + pw - 0.3; rx += 0.6) for (let rz = z + 0.45; rz < z + pd - 0.3; rz += 0.55) if (r() < 0.68) cabs.push([rx, y + 0.14, rz, 0.17 + r() * 0.1]);
      } else if (kind < 0.85) {
        for (let rz = z + 0.6; rz < z + pd - 0.4; rz += 1.2) { k.box(0.03, 1.5, 0.03, bamboo, [x + 0.8, y + 0.85, rz]); k.box(0.03, 1.5, 0.03, bamboo, [x + pw - 0.8, y + 0.85, rz]); }
        k.box(0.02, 1.2, pd - 1.2, net, [x + 0.8, y + 0.9, cz]).castShadow = false;
        k.box(0.02, 1.2, pd - 1.2, net, [x + pw - 0.8, y + 0.9, cz]).castShadow = false;
        ctx.physics.addBox(cx, cz, pw - 1.4, pd - 1.0, 0, y, y + 1.6);
      }
      // plot number stake
      k.box(0.06, 0.5, 0.06, ctx.mat.toon('#f0ede4'), [x + 0.15, y + 0.25, z + pd - 0.1]);
      id++;
    }
    const im = new THREE.InstancedMesh(cabG, ctx.mat.toon('#ffffff', { paint: 0.06, name: 'env-cabbage' }), cabs.length);
    const Mx = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), S = new THREE.Vector3(), c = new THREE.Color();
    cabs.forEach(([x, y, z, s], i) => { Q.setFromAxisAngle(V.set(0, 1, 0), r() * 3); Mx.compose(V.set(x, y, z), Q, S.set(s, s * 0.8, s)); im.setMatrixAt(i, Mx); im.setColorAt(i, c.set(r.pick(['#8fbf6a', '#a6cf7b', '#7aae5e', '#b8d98a']))); });
    im.castShadow = true; im.receiveShadow = true; im.computeBoundingSphere(); grp.add(im);
    // tool shed + sign
    const sx = A.x0 + 2.4, sz = A.z1 + 1.8, sy = L.heightAt(sx, sz);
    k.boxB(2.4, 2.1, 1.8, ctx.mat.toon('#b9b5a8', { paint: 0.08 }), [sx, sy, sz]);
    k.boxB(2.7, 0.08, 2.1, ctx.mat.toon('#7b8691', { paint: 0.04 }), [sx, sy + 2.1, sz], [0.08, 0, 0]);
    k.box(0.9, 1.8, 0.03, ctx.mat.toon('#8f98a0'), [sx + 0.4, sy + 0.95, sz + 0.91]);
    ctx.physics.addBox(sx, sz, 2.5, 1.9, 0, sy, sy + 2.3);
    const at = ctx.tex.sign({ w: 512, h: 160, bg: '#f3f1ea', fg: '#2f5a3a', text: '桜ヶ丘市民農園', sub: '区画利用者以外の立ち入りはご遠慮ください', font: ctx.tex.FONTS.round, border: 10, borderColor: '#3f8f5b', radius: 12, key: 'env-allot-sign' });
    const ax = A.x1 - 0.5, az = A.z0 - 1.2, ay = L.heightAt(ax, az);
    k.box(0.07, 1.4, 0.07, ctx.mat.toon('#e9e7e0'), [ax, ay + 0.7, az - 0.7]); k.box(0.07, 1.4, 0.07, ctx.mat.toon('#e9e7e0'), [ax, ay + 0.7, az + 0.7]);
    k.plane(1.6, 0.5, ctx.mat.toon('#ffffff', { map: at, paint: 0.02 }), [ax + 0.045, ay + 1.2, az], [0, Math.PI / 2, 0]); // faces east
    ctx.physics.addBox(ax, az, 0.2, 1.6, 0, ay, ay + 1.5);
  }

  // ---------------------------------------------------------------- gravel lot: wheel stops + 月極駐車場 sign; 売地 sign in the vacant lot
  {
    const stop = ctx.mat.toon('#d9d5ca', { paint: 0.06 });
    const lineY = ctx.mat.decal('#f0ece0');
    for (let i = 0; i < 4; i++) {
      const x = -90.2 + i * 3.4, z = -11.9;
      k.boxB(1.6, 0.12, 0.16, stop, [x, L.heightAt(x, z), z]);
      k.box(0.08, 0.01, 4.6, lineY, [x + 1.7, L.heightAt(x, z) + 0.006, -9.4]);
    }
    const pk = ctx.tex.sign({ w: 512, h: 256, bg: '#fbfaf6', fg: '#2f64b5', text: '月極駐車場', sub: '空きあり　お問い合わせは桜ヶ丘不動産まで', font: ctx.tex.FONTS.sans, border: 12, borderColor: '#2f64b5', radius: 10, key: 'env-parking-sign' });
    const px = -77.4, pz = -6.9, py = L.heightAt(px, pz);
    k.cyl(0.04, 0.04, 1.9, ctx.mat.toon('#9aa1a8'), [px, py + 0.95, pz], null, 8);
    k.plane(0.9, 0.45, ctx.mat.toon('#ffffff', { map: pk, paint: 0.02 }), [px, py + 1.6, pz + 0.05]);
    k.box(0.92, 0.47, 0.02, ctx.mat.toon('#e9ecee'), [px, py + 1.6, pz + 0.035]);
    ctx.physics.addCylinder(px, pz, 0.08, py, py + 2);
    const sale = ctx.tex.sign({ w: 512, h: 256, bg: '#fffdf6', fg: '#c7372f', text: '売地', sub: '約 120 坪　建築条件なし　桜ヶ丘不動産', font: ctx.tex.FONTS.sans, border: 10, borderColor: '#c7372f', radius: 6, key: 'env-sale-sign' });
    const sx = -68.5, sz = -7.0, sy = L.heightAt(sx, sz);
    k.box(0.07, 1.5, 0.07, ctx.mat.toon('#e9e7e0'), [sx - 0.55, sy + 0.75, sz]); k.box(0.07, 1.5, 0.07, ctx.mat.toon('#e9e7e0'), [sx + 0.55, sy + 0.75, sz]);
    k.box(1.3, 0.66, 0.03, ctx.mat.toon('#fbfaf6'), [sx, sy + 1.2, sz]);
    k.plane(1.26, 0.62, ctx.mat.toon('#ffffff', { map: sale, paint: 0.02 }), [sx, sy + 1.2, sz + 0.02]);
    ctx.physics.addBox(sx, sz, 1.3, 0.2, 0, sy, sy + 1.6);
    // rope fence posts along the vacant lot's R3 side
    for (let x = -75.5; x < -63.2; x += 1.8) { const z = -6.5, y = L.heightAt(x, z); k.box(0.07, 0.6, 0.07, ctx.mat.toon('#dedad0'), [x, y + 0.3, z]); if (x + 1.8 < -63.2) ctx.wires.add(ctx.geo.catenary([x, y + 0.52, z], [x + 1.8, y + 0.52, z], 0.1, 6), { width: 0.014, color: '#e6c34a' }); }
  }

  // ---------------------------------------------------------------- flora hook: flowers on the mound, weeds round the allotments
  const parkFlora = (F) => {
    for (let i = 0; i < 1500; i++) {
      const a = F.r() * Math.PI * 2, d = Math.sqrt(F.r()) * 1.05;
      const x = M.x + Math.cos(a) * M.rx * d, z = M.z + Math.sin(a) * M.rz * d;
      if (pathDist(x, z).d < 1.2 || Math.hypot(x - top.x, z - top.z) < 2.2) continue;
      if (shrubs.some((s) => Math.hypot(s.x - x, s.z - z) < s.s * 1.2)) continue;
      const y = terrainH(x, z), u = F.r();
      if (u < 0.3) F.addTuft(x, z, 0.8, F.TUFT.short, y);
      else if (u < 0.82) F.addFlower(x, z, [F.FLW.dandelion, F.FLW.clover, F.FLW.violet, F.FLW.henbit, F.FLW.fleabane, F.FLW.speedwell][Math.floor(F.r() * 6)], 1, y);
      else F.addMat(x, z, F.r() < 0.6 ? F.MAT.clover : F.MAT.speedwell, 1, y);
    }
  };
  return { isParkMound, parkFlora, top };
}
