// environment/flora.js — grass tufts, weeds, wildflowers (dandelion, clover, violet, 菜の花, henbit,
// fleabane, speedwell), flat ground-cover patches and reeds. Instanced alpha cards (noOutline) that sway
// with ctx.shared.uWind / uTime / uGust. Chunked by area so frustum culling works.
import * as L from '../layout.js';
import { terrainH, terrainNormal, fbm, vnoise, ownedByOthers, inCorridor, roadDist, pathDist, smoothstep, clamp,
  PARK, VACANT_W, ALLOT_W, NANO_E, BRIDGE } from './common.js';
import { swayFoliage } from './shaders.js';
import { STAIRS, BENCHES, LAMPS } from './levee.js';
import { WATER_Y, STONES_X, WEIR_X } from './water.js';

// atlas cells
const TUFT = { short: 0, tall: 1, weed: 2, mixed: 3 };
const FLW = { dandelion: 0, puff: 1, clover: 2, violet: 3, nano: 4, henbit: 5, fleabane: 6, speedwell: 7 };
const MAT = { clover: 0, speedwell: 1, moss: 2, rosette: 3 };
// card sizes [w, h] (m)
const FLW_SIZE = { 0: [0.24, 0.22], 1: [0.24, 0.26], 2: [0.2, 0.17], 3: [0.16, 0.13], 4: [0.55, 0.78], 5: [0.2, 0.22], 6: [0.34, 0.42], 7: [0.24, 0.12] };

export function buildFlora(ctx, tx, env) {
  const { THREE } = ctx;
  const r = ctx.rng('env-flora');
  const ground = env.groundAt || terrainH;
  const chunks = new Map();
  const chunk = (name) => { let c = chunks.get(name); if (!c) chunks.set(name, (c = { tuft: [], flower: [], mat: [], reed: [] })); return c; };

  // --------------------------------------------------------------- placement helpers
  const nearStuff = (x, z) => {
    for (const s of STAIRS) if (Math.abs(x - s.x) < s.w / 2 + 0.5 && z < -83.3 && z > -91.8) return true;
    for (const b of BENCHES) if (Math.abs(x - b.x) < 1.3 && z < -93.2 && z > -94.8) return true;
    for (const lx of LAMPS) if (Math.abs(x - lx) < 0.5 && z < -93.6 && z > -94.8) return true;
    if (Math.abs(x - (-8.9)) < 1.4 && z < -93.6 && z > -94.8) return true;
    return false;
  };
  const tint = (a = 0.12, g = 0) => { const k = 1 - a / 2 + r() * a; return [k * (1 - g * 0.5 + r() * g), k, k * (0.95 + r() * 0.08)]; };
  function addTuft(c, x, z, s = 1, kind = null, y = null) {
    const cell = kind ?? (r() < 0.45 ? TUFT.short : r() < 0.5 ? TUFT.mixed : r() < 0.6 ? TUFT.tall : TUFT.weed);
    const w = (cell === TUFT.weed ? 0.55 : 0.5) * s * (0.7 + r() * 0.6), h = (cell === TUFT.tall ? 0.55 : cell === TUFT.weed ? 0.36 : 0.3) * s * (0.7 + r() * 0.6);
    c.tuft.push({ x, z, y: y ?? ground(x, z), w, h, rot: r() * Math.PI, cell, sway: cell === TUFT.tall ? 1.0 : 0.65, col: tint(0.16, 0.1) });
  }
  function addFlower(c, x, z, cell, s = 1, y = null) {
    const [w0, h0] = FLW_SIZE[cell];
    const k = s * (0.75 + r() * 0.5);
    c.flower.push({ x, z, y: y ?? ground(x, z), w: w0 * k, h: h0 * k * (0.85 + r() * 0.3), rot: r() * Math.PI, cell, sway: cell === FLW.nano ? 1.0 : cell === FLW.fleabane ? 0.9 : 0.6, col: tint(0.1) });
  }
  function addMat(c, x, z, cell, s = 1, y = null) {
    c.mat.push({ x, z, y: (y ?? ground(x, z)) + 0.012 + r() * 0.006, w: (0.35 + r() * 0.35) * s, rot: r() * Math.PI * 2, cell, col: tint(0.1) });
  }
  function addReed(c, x, z, y, s = 1) {
    const cell = r() < 0.3 ? 1 : 0;
    c.reed.push({ x, z, y, w: (0.8 + r() * 0.5) * s, h: (1.3 + r() * 0.9) * s * (cell ? 1.1 : 0.9), rot: r() * Math.PI, cell, sway: 1.2, col: tint(0.12) });
  }
  // pick a flower kind for a zone
  const pickW = (list) => { const t = r() * list.reduce((a, b) => a + b[1], 0); let acc = 0; for (const [v, w] of list) { acc += w; if (t <= acc) return v; } return list[0][0]; };
  const LEVEE_FLOWERS = [[FLW.dandelion, 4], [FLW.puff, 1], [FLW.clover, 3], [FLW.violet, 1.5], [FLW.henbit, 2], [FLW.speedwell, 1.5], [FLW.fleabane, 1]];
  const TOWN_FLOWERS = [[FLW.dandelion, 4], [FLW.puff, 1.2], [FLW.clover, 3], [FLW.violet, 1], [FLW.henbit, 2.5], [FLW.speedwell, 2], [FLW.fleabane, 1.6], [FLW.nano, 0.6]];

  // --------------------------------------------------------------- A/B: levee slopes (play x range, dense)
  const leveeChunk = (x) => (x < -45 ? 'levW' : x < 45 ? 'levC' : 'levE');
  const nanoPatch = (x, z) => fbm(x / 9, z / 3, 2, 501);
  for (let i = 0; i < 9000; i++) {
    const x = -132 + r() * 264;
    const side = r() < 0.55 ? 'town' : 'river';
    const z = side === 'town' ? -84.3 - r() * 6.2 : -95.8 - r() * 3.0;
    if (nearStuff(x, z)) continue;
    if (Math.abs(z + 90.8) < 0.55 || Math.abs(z + 95.3) < 0.45) continue; // sakura shoulders
    const c = chunk(leveeChunk(x));
    const u = r();
    if (side === 'river') {
      const np = nanoPatch(x, z);
      if (np > 0.5 && u < 0.62) { addFlower(c, x, z, FLW.nano, 1.0 + (np - 0.5)); continue; }
      if (u < 0.75) { addTuft(c, x, z, 1.0); continue; }
      if (u < 0.9) { addFlower(c, x, z, pickW(LEVEE_FLOWERS)); continue; }
      addMat(c, x, z, r() < 0.5 ? MAT.clover : MAT.rosette);
    } else {
      const np = nanoPatch(x + 400, z);
      if (np > 0.62 && u < 0.35) { addFlower(c, x, z, FLW.nano, 0.9); continue; }
      if (u < 0.36) { addTuft(c, x, z, 0.8, r() < 0.7 ? TUFT.short : TUFT.mixed); continue; }
      if (u < 0.8) { addFlower(c, x, z, pickW(LEVEE_FLOWERS)); continue; }
      addMat(c, x, z, pickW([[MAT.clover, 3], [MAT.speedwell, 1.5], [MAT.rosette, 2], [MAT.moss, 1]]));
    }
  }
  // tufts along the path edges (shoulder weeds), leaving the sakura row positions to the sakura module
  for (let x = -130; x < 130; x += 0.7 + r() * 0.9) {
    for (const z of [-91.35 - r() * 0.25, -94.65 + r() * 0.25]) {
      if (nearStuff(x, z) || r() < 0.3) continue;
      addTuft(chunk(leveeChunk(x)), x, z, 0.6, TUFT.short);
    }
  }
  // --------------------------------------------------------------- C: levee beyond the play area (sparser, bigger)
  for (let i = 0; i < 1900; i++) {
    const west = r() < 0.5;
    const x = west ? -135 - r() * 230 : 135 + r() * 230;
    if (Math.abs(x - BRIDGE.x) < 7) continue;
    const z = r() < 0.5 ? -84.5 - r() * 6 : -95.8 - r() * 3.0;
    const c = chunk('levFar');
    if (z < -95 && nanoPatch(x, z) > 0.45) addFlower(c, x, z, FLW.nano, 1.3);
    else if (r() < 0.6) addTuft(c, x, z, 1.4);
    else addFlower(c, x, z, FLW.dandelion, 1.3);
  }
  // --------------------------------------------------------------- D: reeds at the waterline + gravel bar
  for (let x = -150; x < 150; x += 0.35 + r() * 0.9) {
    if (Math.abs(x - STONES_X) < 1.5 || Math.abs(x - WEIR_X) < 3) continue;
    // near bank: clumps (patchy)
    if (fbm(x / 7, 1.3, 2, 511) > 0.52) addReed(chunk('reedN'), x, -99.8 - r() * 0.5, WATER_Y - 0.05, 0.9);
    // far bank: dense
    if (fbm(x / 9, 4.1, 2, 512) > 0.38) { addReed(chunk('reedF'), x, -117.1 - r() * 0.8, WATER_Y - 0.05 + r() * 0.05, 1.1); if (r() < 0.5) addReed(chunk('reedF'), x + 0.2, -117.7 - r() * 0.6, WATER_Y + 0.1, 1.0); }
  }
  for (let i = 0; i < 42; i++) { const a = r() * Math.PI * 2, d = Math.sqrt(r()); addReed(chunk('reedF'), 26 + Math.cos(a) * d * 7.5, -112.4 + Math.sin(a) * d * 1.3, WATER_Y - 0.02, 0.85); }
  // --------------------------------------------------------------- E: far bank verge (grass + 菜の花 band along the river)
  for (let i = 0; i < 1500; i++) {
    const x = -220 + r() * 440; const z = -119.1 - r() * 1.3;
    if (Math.abs(x - BRIDGE.x) < 8) continue;
    const c = chunk('farbank');
    if (fbm(x / 14, 2.2, 2, 521) > 0.45 && r() < 0.7) addFlower(c, x, z, FLW.nano, 1.2);
    else if (r() < 0.75) addTuft(c, x, z, 1.2);
    else addFlower(c, x, z, FLW.dandelion, 1.1);
  }
  // 菜の花 edges of nanohana plots close to the river
  for (const e of env.nanoEdges || []) {
    if (e.z < -175 || Math.abs((e.x0 + e.x1) / 2) > 260) continue;
    for (let x = e.x0; x < e.x1; x += 0.45 + r() * 0.5) addFlower(chunk('farbank'), x, e.z - 0.3 - r() * 0.8, FLW.nano, 1.25, e.y);
  }

  // --------------------------------------------------------------- F: open ground in / around the town
  const townChunk = (x, z) => (z < -34 ? 'townN' : x < 0 ? 'townSW' : 'townSE');
  const openOK = (x, z) => {
    if (z > 128.5 || z < -83.6 || Math.abs(x) > 94) return false;
    if (inCorridor(x, z, 0.25)) return false;
    if (ownedByOthers(x, z, 0.2)) return false;
    if (env.isParkMound && env.isParkMound(x, z)) return false;
    if (x > ALLOT_W.x0 - 0.6 && x < ALLOT_W.x1 + 0.6 && z > ALLOT_W.z0 - 0.6 && z < ALLOT_W.z1 + 0.6) return false;
    if (x > NANO_E.x0 && x < NANO_E.x1 && z > NANO_E.z0 && z < NANO_E.z1) return false;
    if (x > VACANT_W.x0 && x < -76 && z > -13.5 && z < VACANT_W.z1) return r() < 0.08; // gravel yard: very few weeds
    const pd = pathDist(x, z); if (pd.d < 1.1) return false;
    return true;
  };
  for (let i = 0; i < 26000; i++) {
    const x = -94 + r() * 188, z = -84 + r() * 212.5;
    if (!openOK(x, z)) continue;
    const rd = roadDist(x, z);
    const verge = rd > 0.2 && rd < 1.6;              // along road edges
    const wall = !!ownedByOthers(x, z, 0.9);          // at the foot of walls / lot edges
    const vacant = (x > VACANT_W.x0 && x < VACANT_W.x1 && z > VACANT_W.z0 && z < VACANT_W.z1);
    const keep = verge ? 0.9 : wall ? 0.75 : vacant ? 0.55 : 0.2;
    if (r() > keep) continue;
    const c = chunk(townChunk(x, z));
    const u = r();
    if (vacant && u < 0.4) { addTuft(c, x, z, 1.35, r() < 0.5 ? TUFT.tall : TUFT.weed); continue; }
    if (u < 0.42) addTuft(c, x, z, verge ? 0.85 : 1.0);
    else if (u < 0.86) addFlower(c, x, z, pickW(TOWN_FLOWERS));
    else addMat(c, x, z, pickW([[MAT.clover, 3], [MAT.speedwell, 2], [MAT.rosette, 2], [MAT.moss, 2]]));
  }
  // --------------------------------------------------------------- I: small 菜の花 field (east strip)
  for (let x = NANO_E.x0 + 0.4; x < NANO_E.x1 - 0.3; x += 0.6) for (let z = NANO_E.z0 + 0.4; z < NANO_E.z1 - 0.3; z += 0.62) {
    const jx = x + (r() - 0.5) * 0.35, jz = z + (r() - 0.5) * 0.35;
    if (Math.abs(jz - (NANO_E.z0 + NANO_E.z1) / 2) < 0.5) continue; // a trodden line through the middle
    addFlower(chunk('nanoField'), jx, jz, FLW.nano, 0.9 + fbm(jx / 5, jz / 5, 2, 531) * 0.35);
  }

  // --------------------------------------------------------------- park extras (provided by park module)
  if (env.parkFlora) env.parkFlora({ addTuft: (x, z, s, k, y) => addTuft(chunk('park'), x, z, s, k, y), addFlower: (x, z, cell, s, y) => addFlower(chunk('park'), x, z, cell, s, y), addMat: (x, z, cell, s, y) => addMat(chunk('park'), x, z, cell, s, y), FLW, TUFT, MAT, r });

  // --------------------------------------------------------------- build instanced meshes
  const cardGeo = (n) => {
    const pos = [], uv = [], nrm = [], idx = [];
    for (let q = 0; q < n; q++) {
      const a = q / n * Math.PI; const c = Math.cos(a) * 0.5, s = Math.sin(a) * 0.5;
      const b = pos.length / 3;
      pos.push(-c, 0, -s, c, 0, s, c, 1, s, -c, 1, -s);
      uv.push(0, 0, 1, 0, 1, 1, 0, 1);
      for (let v = 0; v < 4; v++) nrm.push(0, 1, 0);
      idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx); return g;
  };
  const flatGeo = () => {
    const g = new THREE.PlaneGeometry(1, 1); g.rotateX(-Math.PI / 2);
    const nr = g.attributes.normal; for (let i = 0; i < nr.count; i++) nr.setXYZ(i, 0, 1, 0);
    return g;
  };
  const kinds = {
    tuft: { geo: cardGeo(3), mat: swayFoliage(ctx, tx.tufts, [0.25, 1], 'tufts'), cells: (c) => [c * 0.25, 0] },
    flower: { geo: cardGeo(2), mat: swayFoliage(ctx, tx.flowers, [0.25, 0.5], 'flowers'), cells: (c) => [(c % 4) * 0.25, c < 4 ? 0.5 : 0] },
    mat: { geo: flatGeo(), mat: swayFoliage(ctx, tx.mats, [0.5, 0.5], 'mats', { alphaTest: 0.45 }), cells: (c) => [(c % 2) * 0.5, c < 2 ? 0.5 : 0], flat: true },
    reed: { geo: cardGeo(3), mat: swayFoliage(ctx, tx.reeds, [0.5, 1], 'reeds'), cells: (c) => [c * 0.5, 0] },
  };
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), S = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0), N = new THREE.Vector3(), Qy = new THREE.Quaternion(), col = new THREE.Color();
  let count = 0, meshes = 0, tris = 0;
  for (const [name, c] of chunks) {
    for (const kind of Object.keys(kinds)) {
      const list = c[kind]; if (!list.length) continue;
      const K = kinds[kind];
      const geo = K.geo.clone();
      const cell = new Float32Array(list.length * 3);
      const im = new THREE.InstancedMesh(geo, K.mat, list.length);
      list.forEach((it, i) => {
        if (K.flat) {
          const n = terrainNormal(it.x, it.z); N.set(n[0], n[1], n[2]);
          Q.setFromUnitVectors(UP, N); Qy.setFromAxisAngle(UP, it.rot); Q.multiply(Qy);
          M.compose(V.set(it.x, it.y, it.z), Q, S.set(it.w, 1, it.w));
        } else {
          Q.setFromAxisAngle(UP, it.rot);
          M.compose(V.set(it.x, it.y - 0.02, it.z), Q, S.set(it.w, it.h, it.w));
        }
        im.setMatrixAt(i, M);
        im.setColorAt(i, col.setRGB(it.col[0], it.col[1], it.col[2]));
        const [u0, v0] = K.cells(it.cell);
        cell[i * 3] = u0; cell[i * 3 + 1] = v0; cell[i * 3 + 2] = K.flat ? 0 : it.sway;
      });
      geo.setAttribute('aCell', new THREE.InstancedBufferAttribute(cell, 3));
      im.castShadow = false; im.receiveShadow = !(kind === 'flower' && (name === 'nanoField' || name === 'farbank' || name === 'levFar')); im.name = `env-flora-${name}-${kind}`;
      im.computeBoundingSphere();
      ctx.noOutline(im);
      ctx.addStatic(im);
      count += list.length; meshes++; tris += list.length * (geo.index.count / 3);
    }
  }
  return { count, meshes, tris };
}
