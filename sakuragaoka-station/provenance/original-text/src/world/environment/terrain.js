// environment/terrain.js — the base terrain of the whole visual world.
// Patches: fine 1 m core (play area + 25 m) and graded outer bands (N / S / W / E). Outer x-lines are
// shared between bands so they meet exactly; the core joins them through skirts (no cracks).
// Each patch is split by surface class into separate meshes (ground / levee grass / masonry bank /
// distant forest) that share identical vertex positions + analytic normals along their borders.
import * as L from '../layout.js';
import { terrainH, hillMask, fbm, vnoise, roadDist, ownedByOthers, inCorridor, inLot, lin, mix3, mul3, smoothstep, clamp, lerp,
  PARK, VACANT_W, ALLOT_W, NANO_E, pathDist } from './common.js';

const CORE = { x0: -117, x1: 117, z0: -122, z1: 153 };

function graded(a, b, s0, grow, smax) {
  // monotonically from a to b (a<b), spacing starting at s0 and growing
  const pts = [a]; let x = a, s = s0;
  while (x < b - 1e-6) {
    s = Math.min(s * grow, smax(x));
    let nx = x + s;
    if (b - nx < s * 0.45) nx = b;
    x = nx; pts.push(x);
  }
  return pts;
}
function uniformLine(a, b, n) { const out = []; for (let i = 0; i <= n; i++) out.push(a + (b - a) * i / n); return out; }
function segs(list) { // [[a,b,step],...] -> sorted unique
  const out = [];
  for (const [a, b, st] of list) { const n = Math.max(1, Math.round((b - a) / st)); for (let i = 0; i <= n; i++) out.push(+(a + (b - a) * i / n).toFixed(4)); }
  return [...new Set(out)].sort((p, q) => p - q);
}

export function buildTerrain(ctx, tx, distantMat) {
  const { THREE } = ctx;
  const C = (h) => lin(THREE, h);
  const P = {
    grassA: C('#a4c77f'), grassB: C('#8fb96f'), grassC: C('#bdd28c'), grassD: C('#7fa866'),
    dirt: C('#cfbb95'), dirtL: C('#dccdab'), gravel: C('#c6c0b2'), gravelD: C('#aea797'),
    town: C('#cbc3b2'), townB: C('#c0b7a5'),
    corr: C('#a9a295'), corrB: C('#b8ae9b'),
    lev: C('#98c273'), levB: C('#aacd7d'), levR: C('#8fbb6e'), levTop: C('#cfc8b8'),
    bank: C('#d2cec2'), bankWet: C('#8f8e82'), coping: C('#e0ddd4'), moss: C('#9fae80'),
    farGrass: C('#a3c47d'), aze: C('#a8b27e'),
    fartown: C('#c8bfad'),
    forA: C('#7ea46a'), forB: C('#6b9163'), forC: C('#93b676'), forBlue: C('#7f9d86'),
    soilVeg: C('#b9a07e'), nanoG: C('#9fb85a'), nanoY: C('#d8cf52'),
  };

  // ---------------------------------------------------------------- ground colour
  function openGround(x, z) {
    const n1 = fbm(x / 7.5, z / 7.5, 3, 31), n2 = fbm(x / 26, z / 26, 3, 32), n3 = vnoise(x / 2.2, z / 2.2, 33);
    let c = mix3(P.grassB, P.grassA, smoothstep(0.3, 0.7, n1));
    c = mix3(c, P.grassC, smoothstep(0.55, 0.8, n2) * 0.6);
    c = mix3(c, P.grassD, smoothstep(0.62, 0.85, n3) * 0.35);
    // worn verge next to roads (feet / bikes)
    const rd = roadDist(x, z);
    if (rd > -0.1 && rd < 1.4) c = mix3(c, mix3(P.dirt, P.gravel, n3), (1 - smoothstep(0.1, 1.4, rd)) * (0.55 + 0.3 * n1));
    // vacant lot W: gravel yard (月極駐車場 style)
    if (x > VACANT_W.x0 && x < VACANT_W.x1 && z > VACANT_W.z0 && z < VACANT_W.z1) {
      if (x < -76 && z > -13.5) c = mix3(c, mix3(P.gravel, P.gravelD, n3 * 0.6), smoothstep(-76, -77.5, x) * smoothstep(-13.5, -12, z) * 0.95);
    }
    // allotment + nanohana field surroundings: trodden ground
    if (x > ALLOT_W.x0 - 2 && x < ALLOT_W.x1 + 2 && z > ALLOT_W.z0 - 2 && z < ALLOT_W.z1 + 2) c = mix3(c, P.dirt, 0.55 + 0.2 * n3);
    if (x > NANO_E.x0 - 1.5 && x < NANO_E.x1 + 1.5 && z > NANO_E.z0 - 1.5 && z < NANO_E.z1 + 1.5) {
      const inF = x > NANO_E.x0 + 0.3 && x < NANO_E.x1 - 0.3 && z > NANO_E.z0 + 0.3 && z < NANO_E.z1 - 0.3 && Math.abs(z - (NANO_E.z0 + NANO_E.z1) / 2) > 0.6;
      c = inF ? mix3(P.nanoG, P.nanoY, smoothstep(0.35, 0.7, n1) * 0.7) : mix3(c, P.dirt, 0.45);
    }
    // worn paths (dirt / park gravel)
    const pd = pathDist(x, z);
    if (pd.d < 2) {
      const wob = (vnoise(x * 0.7, z * 0.7, 41) - 0.5) * 0.3;
      const k = 1 - smoothstep(0.55, 1.25, pd.d + wob);
      c = mix3(c, pd.kind === 'park' ? P.dirtL : P.dirt, k * (pd.kind === 'park' ? 0.92 : 0.8));
    }
    return c;
  }
  function townGround(x, z) {
    const n = fbm(x / 6, z / 6, 3, 51), n2 = vnoise(x / 1.7, z / 1.7, 52);
    let c = mix3(P.townB, P.town, n);
    c = mix3(c, P.gravel, smoothstep(0.6, 0.9, n2) * 0.3);
    return c;
  }
  function groundColor(x, z, h) {
    // far bank / north fields
    if (z < -119) {
      const n = fbm(x / 9, z / 9, 3, 61);
      let c = mix3(P.farGrass, P.grassC, smoothstep(0.35, 0.75, n) * 0.6);
      if (z < -123.5 && z > -286 && Math.abs(x) < 660) c = mix3(c, P.aze, 0.55);
      // hill feet: blend into forest greens
      const m = hillMask(x, z); if (m > 0) c = mix3(c, P.forC, smoothstep(0.0, 0.3, m));
      return c;
    }
    if (inCorridor(x, z)) {
      const n = fbm(x / 4, z / 4, 3, 71), n2 = vnoise(x / 1.3, z / 1.3, 72);
      let c = mix3(P.corr, P.corrB, smoothstep(0.3, 0.75, n));
      c = mix3(c, P.gravelD, smoothstep(0.65, 0.9, n2) * 0.4);
      const de = Math.min(z - L.RAIL.corridorZ0, L.RAIL.corridorZ1 - z) + (vnoise(x * 0.5, z * 0.5, 73) - 0.5) * 1.2;
      c = mix3(c, mix3(P.grassB, P.grassA, n), 1 - smoothstep(0.6, 1.7, de));
      return c;
    }
    const own = ownedByOthers(x, z);
    if (own === 'block' && z < -31 && z > -34) return mix3(openGround(x, z), townGround(x, z), 0.25); // sakura strip along the tracks
    if (own === 'fartown') { const n = fbm(x / 11, z / 11, 3, 81); return mix3(P.fartown, P.townB, n); }
    if (own) return townGround(x, z);
    // hills beyond the far town: grass blending to forest
    const m = hillMask(x, z);
    let c = openGround(x, z);
    if (m > 0) c = mix3(c, P.forC, smoothstep(0.0, 0.3, m));
    return c;
  }
  function leveeColor(x, z, h) {
    const n = fbm(x / 6, z / 6, 3, 91), n2 = vnoise(x / 2.5, z / 2.5, 92);
    if (z > L.ROADS.R5.z + 1.5) { // town-side slope
      let c = mix3(P.lev, P.levB, smoothstep(0.3, 0.75, n));
      c = mix3(c, P.grassC, smoothstep(0.7, 0.9, n2) * 0.3);
      const toe = smoothstep(-84.9, -84.0, z);
      if (toe > 0) c = mix3(c, groundColor(x, -83.9, 0), toe);
      return c;
    }
    if (z >= -94.5) { // top: gravel (paved over by the R5 path inside |x|<130)
      let c = mix3(P.levTop, P.gravel, n);
      if (Math.abs(x) > 128) { // maintenance track: two wheel ruts with grass in between
        const g = 1 - smoothstep(0.25, 0.55, Math.abs(Math.abs(z + 93) - 0.0));
        const edge = smoothstep(1.05, 1.45, Math.abs(z + 93));
        c = mix3(c, mix3(P.lev, P.levB, n), Math.max(g * 0.8, edge * 0.9));
      }
      return c;
    }
    // river-side slope
    let c = mix3(P.levR, P.lev, smoothstep(0.3, 0.75, n));
    c = mix3(c, P.grassC, smoothstep(0.72, 0.92, n2) * 0.25);
    c = mix3(c, P.moss, smoothstep(-98.2, -99.0, z) * 0.5);
    return c;
  }
  function bankColor(x, z, h) {
    const n = vnoise(x / 3, z / 3 + h, 101);
    let c = mix3(P.bank, mul3(P.bank, 0.92), n);
    c = mix3(c, P.moss, smoothstep(-0.05, -0.38, h) * 0.45);
    c = mix3(c, P.bankWet, smoothstep(-0.35, -0.55, h));
    if (h > 0.1) c = mix3(c, P.coping, smoothstep(0.1, 0.19, h));
    return c;
  }
  function forestColor(x, z, h) {
    const n = fbm(x / 70, z / 70, 3, 111), n2 = fbm(x / 24, z / 24, 2, 112);
    let c = mix3(P.forB, P.forA, smoothstep(0.3, 0.7, n));
    c = mix3(c, P.forC, smoothstep(0.55, 0.85, n2) * 0.55);
    return c;
  }

  // ---------------------------------------------------------------- classification
  function classify(cx, cz, hs) {
    if (Math.max(hs[0], hs[1], hs[2], hs[3]) < -0.82 && cz < -100 && cz > -117.6) return -1; // under the river water
    if (cz > -99 && cz < -84) return 1;          // levee (both slopes + top)
    if ((cz >= -101.3 && cz <= -99) || (cz >= -119 && cz <= -115.6)) return 2; // masonry banks
    if (hillMask(cx, cz) > 0.22) return 3;       // distant forest hills
    return 0;
  }
  const CLASS_UV = [
    (x, y, z) => [x / 5, -z / 5],
    (x, y, z) => [x / 5.6, -z / 5.6],
    (x, y, z) => [x / 2.2, y / 2.2 - z * 0.08],
    (x, y, z) => [x / 40, -z / 40],
  ];
  const CLASS_COLOR = [groundColor, leveeColor, bankColor, forestColor];
  const epsAt = (x, z) => (Math.abs(x) <= 300 && z > -300 && z < 300 ? 0.5 : 2.5);

  const buckets = [0, 1, 2, 3].map(() => ({ pos: [], nrm: [], col: [], uv: [], idx: [], n: 0 }));
  let triangles = 0;

  function vertexData(x, z) {
    const h = terrainH(x, z);
    const e = epsAt(x, z);
    const hx = terrainH(x + e, z) - terrainH(x - e, z), hz = terrainH(x, z + e) - terrainH(x, z - e);
    const nl = Math.hypot(hx, 2 * e, hz);
    return { h, n: [-hx / nl, 2 * e / nl, -hz / nl] };
  }

  function buildPatch(xs, zs, { skirts = null } = {}) {
    const nx = xs.length, nz = zs.length;
    const H = new Float32Array(nx * nz), NR = new Float32Array(nx * nz * 3);
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const k = j * nx + i; const d = vertexData(xs[i], zs[j]);
      H[k] = d.h; NR[k * 3] = d.n[0]; NR[k * 3 + 1] = d.n[1]; NR[k * 3 + 2] = d.n[2];
    }
    const maps = [0, 1, 2, 3].map(() => new Map());
    const cellClass = new Int8Array((nx - 1) * (nz - 1));
    const vid = (cls, i, j) => {
      const key = j * nx + i; const m = maps[cls];
      let v = m.get(key);
      if (v === undefined) {
        const b = buckets[cls]; v = b.n++;
        const x = xs[i], z = zs[j], h = H[key];
        b.pos.push(x, h, z); b.nrm.push(NR[key * 3], NR[key * 3 + 1], NR[key * 3 + 2]);
        const c = CLASS_COLOR[cls](x, z, h); b.col.push(c[0], c[1], c[2]);
        const uv = CLASS_UV[cls](x, h, z); b.uv.push(uv[0], uv[1]);
        m.set(key, v);
      }
      return v;
    };
    for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) {
      const k00 = j * nx + i, k10 = k00 + 1, k01 = k00 + nx, k11 = k01 + 1;
      const cx = (xs[i] + xs[i + 1]) / 2, cz = (zs[j] + zs[j + 1]) / 2;
      const cls = classify(cx, cz, [H[k00], H[k10], H[k01], H[k11]]);
      cellClass[j * (nx - 1) + i] = cls;
      if (cls < 0) continue;
      const a = vid(cls, i, j), b = vid(cls, i + 1, j), c = vid(cls, i, j + 1), d = vid(cls, i + 1, j + 1);
      const bk = buckets[cls];
      // choose the diagonal that follows the surface better
      if (Math.abs(H[k00] - H[k11]) < Math.abs(H[k10] - H[k01])) { bk.idx.push(a, c, d, a, d, b); } else { bk.idx.push(a, c, b, b, c, d); }
      triangles += 2;
    }
    if (skirts) {
      const drop = 1.3;
      const addSkirt = (i0, j0, i1, j1, ci, cj, out) => {
        const cls = cellClass[cj * (nx - 1) + ci]; if (cls < 0) return;
        const b = buckets[cls];
        const pa = vid(cls, i0, j0), pb = vid(cls, i1, j1);
        const base = b.n;
        for (const v of [pa, pb]) {
          b.pos.push(b.pos[v * 3], b.pos[v * 3 + 1] - drop, b.pos[v * 3 + 2]);
          b.nrm.push(b.nrm[v * 3], b.nrm[v * 3 + 1], b.nrm[v * 3 + 2]);
          b.col.push(b.col[v * 3], b.col[v * 3 + 1], b.col[v * 3 + 2]);
          b.uv.push(b.uv[v * 2], b.uv[v * 2 + 1] + 0.2);
        }
        b.n += 2;
        const qa = base, qb = base + 1;
        // outward-facing winding
        const ax = b.pos[pa * 3], az = b.pos[pa * 3 + 2], bx = b.pos[pb * 3], bz = b.pos[pb * 3 + 2];
        const fx = (bz - az), fz = -(bx - ax); // right-hand normal of a->b in xz (for triangle pa,qa,pb)
        if (fx * out[0] + fz * out[1] > 0) b.idx.push(pa, pb, qa, pb, qb, qa); else b.idx.push(pa, qa, pb, pb, qa, qb);
        triangles += 2;
      };
      for (let i = 0; i < nx - 1; i++) { addSkirt(i, 0, i + 1, 0, i, 0, [0, -1]); addSkirt(i, nz - 1, i + 1, nz - 1, i, nz - 2, [0, 1]); }
      for (let j = 0; j < nz - 1; j++) { if (skirts.w) addSkirt(0, j, 0, j + 1, 0, j, [-1, 0]); if (skirts.e) addSkirt(nx - 1, j, nx - 1, j + 1, nx - 2, j, [1, 0]); }
    }
  }

  // ---------------------------------------------------------------- patch lines
  const coreX = uniformLine(CORE.x0, CORE.x1, CORE.x1 - CORE.x0);
  const coreZ = uniformLine(CORE.z0, CORE.z1, CORE.z1 - CORE.z0);
  const smaxX = (x) => (x < 420 ? 12 : 24);
  const outPos = graded(117, 700, 1.8, 1.26, smaxX);
  const outX = [...outPos.slice().reverse().map((v) => -v), ...uniformLine(-117, 117, 60).slice(1, -1), ...outPos];
  const sideX = outPos; // |x| >= 117
  const midZ = segs([
    [-122, -119, 1], [-119, -116, 0.75], [-116, -101.3, 3.7], [-101.3, -99, 0.46], [-99, -94.5, 0.75], [-94.5, -91.5, 1.5],
    [-91.5, -84, 0.75], [-84, -60, 3], [-60, -53.5, 1.625], [-53.5, -51.5, 0.5], [-51.5, -34.5, 2.125], [-34.5, -32.5, 0.5],
    [-32.5, 0, 3.25], [0, 10, 1.25], [10, 153, 7.5],
  ]);
  const nZ = graded(122, 900, 2, 1.17, (z) => (z < 620 ? 12 : 26)).map((v) => -v).reverse();
  const sZ = graded(153, 700, 3.5, 1.15, () => 22);

  buildPatch(coreX, coreZ, { skirts: { w: true, e: true } });
  buildPatch(sideX, midZ, { skirts: { w: true, e: false } });
  buildPatch(sideX.slice().reverse().map((v) => -v), midZ, { skirts: { w: false, e: true } });
  buildPatch(outX, nZ);
  buildPatch(outX, sZ);

  // ---------------------------------------------------------------- meshes
  const mats = [
    ctx.mat.toon('#ffffff', { vertexColors: true, map: tx.ground, paint: 0.035, name: 'env-ground' }),
    ctx.mat.toon('#ffffff', { vertexColors: true, map: tx.levee, paint: 0.03, name: 'env-levee' }),
    ctx.mat.toon('#ffffff', { vertexColors: true, map: tx.masonry, paint: 0.03, name: 'env-bank' }),
    distantMat,
  ];
  const group = new THREE.Group(); group.name = 'env-terrain';
  buckets.forEach((b, cls) => {
    if (!b.idx.length) return;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(b.nrm, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(b.col, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2));
    g.setIndex(b.n > 65535 ? new THREE.Uint32BufferAttribute(b.idx, 1) : new THREE.Uint16BufferAttribute(b.idx, 1));
    g.computeBoundingSphere(); g.computeBoundingBox();
    const mesh = new THREE.Mesh(g, mats[cls]);
    mesh.name = 'env-terrain-' + ['ground', 'levee', 'bank', 'forest'][cls];
    mesh.receiveShadow = cls !== 3; mesh.castShadow = cls === 1; // the levee casts its long afternoon shadow
    if (cls === 3) ctx.noBatch(mesh);
    group.add(mesh);
  });
  ctx.addStatic(group);
  return { group, triangles };
}
