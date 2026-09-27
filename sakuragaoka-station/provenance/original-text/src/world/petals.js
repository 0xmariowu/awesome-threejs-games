// 花びら — every sakura petal in the town (SPEC 十二 / 十八 / 八 / 十三 / 十 / 三.4).
//
//  Airborne (GPU, pure functions of uTime/uWind/uGust, no shadows, no outline):
//    • fall   : one InstancedMesh of slightly cupped, notched petals (8 tris) with every "kind":
//               0 canopy emitters (spawn inside each crown, flutter/tumble/spiral down, drift downwind,
//                 land, rest a moment, fade), 1 near field around the camera (large, clearly shaped),
//               2 mid field (the most; thinned by a density map that peaks around the canopies,
//                 the street and the rail corridor), 4 petals resting on ballast / platform edges that
//                 only the train gust lifts.
//    • soft   : a few very close, defocused petals (soft alpha, blended).
//    • glint  : far field of tiny pink glints (screen-size floor instead of vanishing).
//    Train gust: services.rail.trains → uniforms; moving cars lift petals, drag them along the body
//    and roll them in a vortex behind; stopped trains with open doors make small eddies at the doors.
//    Backlit petals (between camera and sun) glow translucent at the rim.
//  Lying (one InstancedMesh, toon): see petals/plan.js — clumps, streaks, drifts, piles, benches,
//    vending tops, café tables/window, ballast.
//  Floating: petal rafts (花筏) drifting east on the river + single petals on open gutter water.
import * as THREE from 'three';
import { FALL_VERT, FALL_FRAG, FLOAT_VERT, FLOAT_FRAG } from './petals/shaders.js';
import { createPetalTextures } from './petals/textures.js';
import { createTrainReader } from './petals/trains.js';
import { createGroundCollector } from './petals/ground.js';
import { createSurfaceIndex } from './petals/surface.js';
import { planGround } from './petals/plan.js';

const COL = {
  airA: '#f3dde5', airB: '#eeb4c6', airBase: '#dd8aa5', glow: '#ffd3de',
  pale: '#f5e2e9', pink: '#f0bfcf', deep: '#e49db4', old: '#c9a79d',
  raftA: '#f9eef2', raftB: '#f4d2dc',
};

function makeNoise(r) {
  const N = 256, perm = new Uint16Array(N * 2), val = new Float32Array(N);
  for (let i = 0; i < N; i++) { perm[i] = i; val[i] = r(); }
  for (let i = N - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = perm[i]; perm[i] = perm[j]; perm[j] = t; }
  for (let i = 0; i < N; i++) perm[N + i] = perm[i];
  const h = (x, z) => val[perm[(perm[x & 255] + z) & 511]];
  return (x, z) => {
    const ix = Math.floor(x), iz = Math.floor(z); let fx = x - ix, fz = z - iz;
    fx = fx * fx * (3 - 2 * fx); fz = fz * fz * (3 - 2 * fz);
    const a = h(ix, iz), b = h(ix + 1, iz), c = h(ix, iz + 1), d = h(ix + 1, iz + 1);
    return (a + (b - a) * fx) + ((c + (d - c) * fx) - (a + (b - a) * fx)) * fz;
  };
}

function fallbackTrees(L) {
  const H = L.heightAt, T = [];
  const add = (x, z, r, h, cx = 0, cz = 0, id = '') => { const g = H(x, z); T.push({ id, x: x + cx, z: z + cz, y: g + h * 0.62, r, h, trunk: { x, z, r: 0.3 }, ground: g }); };
  add(L.PLAZA.tree.x, L.PLAZA.tree.z, 6.6, 10.3, 0, 0, 'plaza');
  add(L.SPOTS.w3Sakura.x, L.SPOTS.w3Sakura.z, 5.0, 9.1, 1.6, 0, 'w3');
  add(L.SPOTS.shrineSakura.x, L.SPOTS.shrineSakura.z, 3.6, 7.0, 0, 0, 'shrine');
  add(-7.6, -7.8, 2.8, 6.1, 0, 0, 'plazaSW'); add(19.5, -22.0, 3.9, 7.8, 0, 0, 'forecourtE');
  for (const x of [2, 14, 26]) add(x, -51.3, 3.8, 8.4, 0, 0.6, 'platN' + x);
  for (const x of [20, 32]) add(x, -34.6, 3.6, 8.0, 0, -0.6, 'platS' + x);
  for (let x = -23.5; x > -61; x -= 8.6) add(x, -32.8, 3.5, 7.2, 0, -1.2);
  for (let x = 51.5; x < 62.5; x += 8.8) add(x, -32.8, 3.5, 7.2, 0, -1.2);
  for (let x = -24.5; x > -91; x -= 8.3) add(x, -52.9, 3.9, 7.7, 0, -1.4);
  for (let x = 52.5; x < 91; x += 8.3) add(x, -52.9, 3.9, 7.7, 0, -1.4);
  for (const [z0, start] of [[-90.8, -124], [-95.3, -119.5]]) for (let x = start; x <= 125; x += 9.4) { if (Math.abs(x + 12) < 5 || Math.abs(x - 40) < 5) continue; add(x, z0, 4.1, 7.6); }
  add(-36.2, 1.85, 2.4, 5.4); add(33.8, 1.85, 2.4, 5.4);
  return T;
}

function fallbackEdges(L) {
  const E = [];
  const seg = (pts, kind) => { for (let i = 1; i < pts.length; i++) E.push({ a: pts[i - 1], b: pts[i], kind }); };
  for (const s of [-1, 1]) {
    const c = [], f = [];
    for (let z = 3.2; z <= 128; z += 3) { const x = L.streetCenterX(z); c.push([x + s * 3.0, z]); f.push([x + s * L.STREET.lotOffset, z]); }
    seg(c, 'curb'); seg(f, 'wall');
  }
  for (const z of [-5, 1]) { seg([[-95, z], [-15, z]], 'edge'); seg([[-9, z], [95, z]], 'edge'); }
  for (const x of [-14.75, -9.25]) { seg([[x, -33.5], [x, -6]], 'edge'); seg([[x, -84], [x, -53]], 'edge'); }
  for (const z of [-57.5, -53.5]) { seg([[-95, z], [-15, z]], 'edge'); seg([[-9, z], [95, z]], 'edge'); }
  for (const z of [-72.5, -69.5]) { seg([[-85, z], [-15, z]], 'edge'); seg([[-9, z], [85, z]], 'edge'); }
  return E;
}

export async function build(ctx) {
  const L = ctx.L, H = L.heightAt;
  const Q = Math.max(0.15, Math.min(1.5, ctx.quality?.petals ?? 1));
  const r = ctx.rng('petals');
  const noise = makeNoise(ctx.rng('petals-noise'));
  const gauss = () => (r() + r() + r() + r() - 2) / 0.8165;
  const TX = createPetalTextures(ctx.rng('petals-tex'));
  const root = new THREE.Group(); root.name = 'petals';

  // ------------------------------------------------------------------ what exists around us
  const SI = createSurfaceIndex(ctx, {});
  const treesSrc = ctx.services.sakura?.trees;
  const trees = (Array.isArray(treesSrc) && treesSrc.length ? treesSrc : fallbackTrees(L)).filter(t => t && Number.isFinite(t.x) && Number.isFinite(t.z)).map(t => {
    const tx = Number.isFinite(t.trunk?.x) ? t.trunk.x : t.x, tz = Number.isFinite(t.trunk?.z) ? t.trunk.z : t.z;
    const ground = Number.isFinite(t.ground) ? t.ground : H(tx, tz);
    const h = Number.isFinite(t.h) ? t.h : 7;
    let y = Number.isFinite(t.y) ? t.y : ground + h * 0.62; if (y < ground + 1.6) y = ground + Math.max(2.2, h * 0.6);
    const id = String(t.id || '');
    const boost = id === 'plaza' ? 3.2 : id === 'w3' ? 2.6 : /^(platN|platS|forecourt|shrine|plazaSW)/.test(id) ? 1.6 : 1;
    return { id, boost, x: t.x, z: t.z, y, r: Math.max(1.2, Math.min(9, t.r || 3.5)), h, tx, tz, trunkR: t.trunk?.r || 0.3, ground };
  });
  const street = ctx.services.street;
  const edges = Array.isArray(street?.edges) && street.edges.length ? street.edges : fallbackEdges(L);
  const gutters = Array.isArray(street?.gutters) ? street.gutters : [];

  // ------------------------------------------------------------------ density / landing / roof map (GPU + CPU)
  const DR = { x0: -150, x1: 150, z0: -130, z1: 146, step: 0.5 };
  const NX = Math.round((DR.x1 - DR.x0) / DR.step), NZ = Math.round((DR.z1 - DR.z0) / DR.step);
  const dR = new Float32Array(NX * NZ), dG = new Float32Array(NX * NZ), dB = new Float32Array(NX * NZ);
  const WA = Math.atan2(0.35, 0.9), wdx = Math.cos(WA), wdz = Math.sin(WA);
  const inRiver = (z) => z < L.RIVER.z0 + 0.2 && z > L.RIVER.z1 - 0.2;
  const siB = SI.bounds;
  for (let j = 0; j < NZ; j++) {
    const z = DR.z0 + (j + 0.5) * DR.step;
    for (let i = 0; i < NX; i++) {
      const x = DR.x0 + (i + 0.5) * DR.step, k = j * NX + i;
      const h0 = H(x, z);
      let y = h0, ceil = 0;
      if (!SI.empty && x > siB.x0 && x < siB.x1 && z > siB.z0 && z < siB.z1) {
        const a = SI.top(x - 0.12, z - 0.12, h0 - 1.6, h0 + 2.05), b = SI.top(x + 0.12, z + 0.12, h0 - 1.6, h0 + 2.05);
        const t = Number.isFinite(a) && Number.isFinite(b) ? Math.min(a, b) : Number.isFinite(a) ? a : b;
        if (Number.isFinite(t)) y = t;
        const c = SI.cover(x, z, y + 0.25, y + 11);
        if (Number.isFinite(c)) ceil = c - y;
      }
      if (inRiver(z)) y = Math.max(y, L.RIVER.waterY + 0.005);
      dG[k] = y; dB[k] = ceil;
      // baseline airborne density: the town, the main street, the rail corridor
      let d = 0.16;
      if (z > 1 && Math.abs(x - L.streetCenterX(z)) < 8) d += 0.2;
      if (z > -54 && z < -32 && x > -60 && x < 80) d += 0.16;
      if (z > -5.5 && z < 1.5) d += 0.08;
      dR[k] = d;
    }
  }
  for (const t of trees) {
    const cx = t.x + wdx * 4.5, cz = t.z + wdz * 4.5, R = t.r + 9;
    const i0 = Math.max(0, Math.floor((cx - R * 1.8 - DR.x0) / DR.step)), i1 = Math.min(NX - 1, Math.ceil((cx + R * 1.8 - DR.x0) / DR.step));
    const j0 = Math.max(0, Math.floor((cz - R * 1.8 - DR.z0) / DR.step)), j1 = Math.min(NZ - 1, Math.ceil((cz + R * 1.8 - DR.z0) / DR.step));
    const amp = Math.min(1, 0.35 + t.r * 0.12);
    for (let j = j0; j <= j1; j++) {
      const z = DR.z0 + (j + 0.5) * DR.step;
      for (let i = i0; i <= i1; i++) {
        const x = DR.x0 + (i + 0.5) * DR.step;
        // ellipse stretched downwind
        const dx = x - cx, dz = z - cz, u = (dx * wdx + dz * wdz) / (R * 1.35), v = (-dx * wdz + dz * wdx) / R;
        dR[j * NX + i] += amp * Math.exp(-(u * u + v * v) * 1.6);
      }
    }
  }
  for (let k = 0; k < dR.length; k++) dR[k] = Math.min(1, dR[k]);
  const dens = (x, z) => {
    const i = Math.floor((x - DR.x0) / DR.step), j = Math.floor((z - DR.z0) / DR.step);
    if (i < 0 || j < 0 || i >= NX || j >= NZ) return 0.08;
    return dR[j * NX + i];
  };
  const hf = new Uint16Array(NX * NZ * 4);
  for (let k = 0; k < NX * NZ; k++) {
    hf[k * 4] = THREE.DataUtils.toHalfFloat(dR[k]); hf[k * 4 + 1] = THREE.DataUtils.toHalfFloat(dG[k]);
    hf[k * 4 + 2] = THREE.DataUtils.toHalfFloat(dB[k]); hf[k * 4 + 3] = THREE.DataUtils.toHalfFloat(1);
  }
  const densTex = new THREE.DataTexture(hf, NX, NZ, THREE.RGBAFormat, THREE.HalfFloatType);
  densTex.minFilter = densTex.magFilter = THREE.LinearFilter; densTex.generateMipmaps = false;
  densTex.wrapS = densTex.wrapT = THREE.ClampToEdgeWrapping; densTex.colorSpace = THREE.NoColorSpace;
  densTex.needsUpdate = true;

  // ------------------------------------------------------------------ surfaces for lying petals
  const roadLift = (x, z) => {
    if (z > 1 && Math.abs(x - L.streetCenterX(z)) < 3) return 0.02;
    const a = Math.abs(x - L.streetCenterX(z));
    if (z > 3.2 && z < 58.8 && a >= 3 && a <= 4.6) return 0.15;
    if (Math.abs(z + 2) < 3 || Math.abs(z + 55.5) < 2 || Math.abs(z + 71) < 1.5 || (Math.abs(x + 12) < 2.75 && z < -5)) return 0.02;
    return 0;
  };
  /** exact rendered surface near the terrain (NaN if none) — no roof test */
  const surfRaw = (x, z, above = 0.55) => {
    const h0 = H(x, z);
    if (SI.empty) return h0 + roadLift(x, z);
    return SI.top(x, z, h0 - 0.9, h0 + above);
  };
  /** is something above (x,z,y) acceptable? open: nothing below 3.4 m (no eaves, benches, cars, interiors);
   *  edge: fence rails / railings / wall copings (< 2 m) are fine, ceilings & awnings (2–3.6 m) are not;
   *  plat: like edge, and the platform shelter roof lets 60 % through (petals blow in under it). */
  const coverOK = (x, z, y, mode) => {
    if (SI.empty) return true;
    const d = SI.cover(x, z, y + 0.04, y + 9) - y;
    if (!Number.isFinite(d)) return true;
    if (d < 0.3) return false;
    if (mode === 'edge' || mode === 'plat') {
      if (d < 2.0) return true;
      if (d < (mode === 'plat' ? 2.2 : 3.6)) return false;
      return r() < (mode === 'plat' ? 0.6 : 0.3);
    }
    if (d < 3.4) return false;
    return r() < 0.3;
  };
  /** ground surface for a lying petal, or null (no surface / indoors / under a low cover) */
  const surf = (x, z, mode) => {
    const y = surfRaw(x, z);
    if (!Number.isFinite(y)) return null;
    if (inRiver(z)) return null;
    return coverOK(x, z, y, mode) ? y : null;
  };
  const PY = L.PLATFORM.y;
  const surfP = (x, z) => {
    if (SI.empty) return PY;
    const y = SI.top(x, z, PY - 0.25, PY + 0.25);
    if (!Number.isFinite(y)) return null;
    return coverOK(x, z, y, 'plat') ? y : null;
  };

  // ------------------------------------------------------------------ lying petals
  const G = createGroundCollector(ctx, { r, capacity: Math.round(52000 * Q) + 2000, surf, colors: { pale: COL.pale, pink: COL.pink, deep: COL.deep, old: COL.old } });
  const grates = [];
  for (const g of gutters) {
    if (!g || !g.water || g.open) continue;
    const [ax, az] = g.a, [bx, bz] = g.b; const len = Math.hypot(bx - ax, bz - az);
    if (len > 0.2 && len < 2.5 && r() < 0.8) grates.push({ x: (ax + bx) / 2, z: (az + bz) / 2, ang: Math.atan2(bz - az, bx - ax) });
  }
  // carpet patches: one quad = dozens of petals (atlas), corners follow the real surface
  const patches = [];
  const tintOf = () => { const c = new THREE.Color(COL.pale).lerp(new THREE.Color(COL.pink), Math.pow(r(), 1.4) * 0.8); return c; };
  const patch = (x, z, l, w, ang, cell, o = {}) => {
    w = cell >= 2 ? l / 3 * (0.9 + r() * 0.2) : l * (0.86 + r() * 0.24);   // match the atlas cell aspect (petals stay undistorted)
    const yc = (o.surf || surf)(x, z);
    if (yc === null || !Number.isFinite(yc)) return false;
    const raw = o.raw || surfRaw;
    const c = Math.cos(ang), s = Math.sin(ang);
    const P = [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]].map(([u, v]) => { const px = x + u * l * c - v * w * s, pz = z + u * l * s + v * w * c; return [px, raw(px, pz), pz]; });
    if (P.some(p => !Number.isFinite(p[1]))) return false;
    const avg = (P[0][1] + P[1][1] + P[2][1] + P[3][1]) / 4;
    if (Math.abs(avg - yc) > 0.012) return false;
    for (let k = 0; k < 4; k++) { // mid-edge samples catch steps between two corners
      const A = P[k], B = P[(k + 1) % 4], mx = (A[0] + B[0]) / 2, mz = (A[2] + B[2]) / 2, my = raw(mx, mz);
      if (!Number.isFinite(my) || Math.abs(my - (A[1] + B[1]) / 2) > 0.012) return false;
    }
    patches.push({ P, cell, tint: o.tint || tintOf() });
    return true;
  };
  const planStats = planGround(ctx, G, { r, Q, trees, SI, dens, noise, gauss, edges, grates, surf, surfRaw, surfP, patch });
  const groundMat = ctx.mat.toon('#ffffff', { map: TX.colorTex, alphaTest: 0.5, side: 'double', paint: 0.03, emissive: '#f0c6d3', emissiveIntensity: 0.2 });
  groundMat.alphaToCoverage = true;
  const ground = G.build(groundMat);
  ground.frustumCulled = false; // instances span the whole town
  root.add(ground);
  if (patches.length) {
    const n = patches.length, pos = new Float32Array(n * 12), nor = new Float32Array(n * 12), uv = new Float32Array(n * 8), col = new Float32Array(n * 12), idx = new Uint32Array(n * 6);
    const UV = [[0, 0], [1, 0], [1, 1], [0, 1]];
    patches.forEach((p, i) => {
      const ou = (p.cell % 2) * 0.5, ov = Math.floor(p.cell / 2) * 0.5;
      for (let k = 0; k < 4; k++) {
        pos.set([p.P[k][0], p.P[k][1] + 0.005, p.P[k][2]], (i * 4 + k) * 3);
        nor.set([0, 1, 0], (i * 4 + k) * 3);
        uv.set([ou + 0.004 + UV[k][0] * 0.492, ov + 0.004 + UV[k][1] * 0.492], (i * 4 + k) * 2);
        col.set([p.tint.r, p.tint.g, p.tint.b], (i * 4 + k) * 3);
      }
      const a = i * 4, [p0, p1, p2] = p.P;
      const up = (p1[2] - p0[2]) * (p2[0] - p0[0]) - (p1[0] - p0[0]) * (p2[2] - p0[2]) > 0; // winding so the face points up
      idx.set(up ? [a, a + 1, a + 2, a, a + 2, a + 3] : [a, a + 2, a + 1, a, a + 3, a + 2], i * 6);
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setIndex(new THREE.BufferAttribute(idx, 1)); g.computeBoundingSphere();
    const pm = ctx.mat.toon('#ffffff', { map: TX.patchTex, alphaTest: 0.5, vertexColors: true, polygonOffset: -2, paint: 0.02, emissive: '#f0c6d3', emissiveIntensity: 0.18 });
    pm.alphaToCoverage = true;
    const mesh = new THREE.Mesh(g, pm); mesh.name = 'petals-carpet'; mesh.receiveShadow = true; mesh.castShadow = false;
    root.add(mesh);
  }

  // ------------------------------------------------------------------ airborne petals
  const petalGeo = (() => { // 3x2 grid (4 tris): folded along the midrib = cupped, normal ≈ +Y
    const pos = [], uv = [], idx = [];
    for (let j = 0; j <= 1; j++) for (let i = 0; i <= 2; i++) {
      const u = i / 2, v = j, x = (u - 0.5) * 0.72, z = (0.5 - v);
      pos.push(x, 0.12 * Math.abs(2 * u - 1) + 0.05 * v - 0.04, z); uv.push(u, v);
    }
    for (let i = 0; i < 2; i++) { const a = i, b = a + 1, c = a + 3, d = c + 1; idx.push(a, c, b, b, c, d); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
    g.computeVertexNormals();
    const n = g.attributes.normal; let sy = 0; for (let i = 0; i < n.count; i++) sy += n.getY(i);
    if (sy < 0) { for (let i = 0; i < n.count; i++) n.setXYZ(i, -n.getX(i), -n.getY(i), -n.getZ(i)); }
    return g;
  })();
  const flatGeo = (() => { const g = new THREE.PlaneGeometry(0.72, 1).rotateX(-Math.PI / 2); return g; })();

  const sky = ctx.sky || {};
  const lightCol = () => ({
    sun: sky.sun ? sky.sun.color.clone().multiplyScalar(sky.sun.intensity) : new THREE.Color(2.6, 2.4, 2.2),
    skyC: sky.hemi ? sky.hemi.color.clone().multiplyScalar(sky.hemi.intensity) : new THREE.Color(1.2, 1.3, 1.6),
    gnd: sky.hemi ? sky.hemi.groundColor.clone().multiplyScalar(sky.hemi.intensity) : new THREE.Color(1.3, 1.2, 1.2),
  });
  const LC = lightCol();
  const uLight = { uSunCol: { value: LC.sun }, uSkyCol: { value: LC.skyC }, uGndCol: { value: LC.gnd } };
  const uTr = { value: [0, 1, 2, 3].map(() => new THREE.Vector4()) }, uTr2 = { value: [0, 1, 2, 3].map(() => new THREE.Vector4()) };
  const uResY = { value: 720 };
  const shared = {
    uTime: ctx.shared.uTime, uWind: ctx.shared.uWind, uGust: ctx.shared.uGust, uSunDir: ctx.shared.uSunDir,
    uDens: { value: densTex }, uDensRect: { value: new THREE.Vector4(DR.x0, DR.z0, 1 / (DR.x1 - DR.x0), 1 / (DR.z1 - DR.z0)) },
    uDensSize: { value: new THREE.Vector2(NX, NZ) }, uTr, uTr2, uResY, ...uLight,
    uTex: { value: TX.shapeTex },
    uColA: { value: new THREE.Color(COL.airA) }, uColB: { value: new THREE.Color(COL.airB) },
    uColBase: { value: new THREE.Color(COL.airBase) }, uGlowCol: { value: new THREE.Color(COL.glow) },
  };
  const fallMaterial = (o) => {
    const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, THREE.UniformsLib.lights]);
    Object.assign(uniforms, shared, { uMinPx: { value: o.minPx }, uFar: { value: o.far }, uOpacity: { value: o.opacity ?? 1 } });
    const m = new THREE.ShaderMaterial({
      uniforms, vertexShader: FALL_VERT, fragmentShader: FALL_FRAG, defines: o.soft ? { SOFT: '' } : {},
      lights: true, fog: true, side: THREE.DoubleSide,
      transparent: !!o.soft, depthWrite: !o.soft,
    });
    if (!o.soft) m.alphaToCoverage = true;
    m.name = 'petals-' + o.name;
    return m;
  };

  // --- instance buffers
  const makeBuf = (cap) => ({ A: new Float32Array(cap * 4), B: new Float32Array(cap * 4), C: new Float32Array(cap * 4), n: 0, cap });
  const push = (buf, a, c) => {
    if (buf.n >= buf.cap) return;
    const o = buf.n * 4;
    buf.A.set(a, o); buf.C.set(c, o);
    buf.B[o] = r(); buf.B[o + 1] = r(); buf.B[o + 2] = r(); buf.B[o + 3] = r();
    buf.n++;
  };
  const makeMesh = (geo, buf, mat, name) => {
    const g = geo.clone();
    g.setAttribute('aA', new THREE.InstancedBufferAttribute(buf.A.subarray(0, Math.max(1, buf.n) * 4), 4));
    g.setAttribute('aB', new THREE.InstancedBufferAttribute(buf.B.subarray(0, Math.max(1, buf.n) * 4), 4));
    g.setAttribute('aC', new THREE.InstancedBufferAttribute(buf.C.subarray(0, Math.max(1, buf.n) * 4), 4));
    const m = new THREE.InstancedMesh(g, mat, Math.max(1, buf.n));
    m.count = buf.n; m.frustumCulled = false; m.castShadow = false; m.receiveShadow = true; m.name = name;
    m.renderOrder = mat.transparent ? 3 : 1;
    return m;
  };

  const fall = makeBuf(Math.round(28500 * Q) + 800);
  // kind 0: canopy emitters (budget shared by crown size, fewer on distant trees)
  {
    const core = { x: 6, z: -4 };
    const w = trees.map(t => t.boost * t.r * t.r * Math.max(0.22, Math.min(1, 1 - (Math.hypot(t.x - core.x, t.z - core.z) - 60) / 120)));
    const tot = w.reduce((a, b) => a + b, 0) || 1, budget = 14000 * Q;
    trees.forEach((t, i) => {
      const n = Math.max(Math.round(18 * Q), Math.min(Math.round(3600 * Q), Math.round(budget * w[i] / tot)));
      for (let k = 0; k < n; k++) push(fall, [t.x, t.y, t.z, 0], [0.034 + r() * 0.016, 0.42 + r() * 0.42, t.r, t.ground]);
    });
  }
  // kind 2: mid field (the most), kind 1: near field
  for (let k = 0; k < 6400 * Q; k++) push(fall, [(r() - 0.5) * 64, r() * 13, (r() - 0.5) * 64, 2], [0.032 + r() * 0.014, 0.35 + r() * 0.4, 32, 13]);
  for (let k = 0; k < 900 * Q; k++) push(fall, [(r() - 0.5) * 14, r() * 4.2, (r() - 0.5) * 14, 1], [0.03 + r() * 0.012, 0.3 + r() * 0.35, 7, 4.2]);
  // kind 4: resting on ballast / platform edges, lifted only by the train gust
  {
    const n = Math.round(3400 * Q);
    const PL = L.PLATFORM;
    for (let k = 0, tries = 0; k < n && tries < n * 4; tries++) {
      const onPlat = r() < 0.25;
      const x = r() < 0.7 ? -30 + r() * 100 : -85 + r() * 190;
      let z, y;
      if (onPlat) {
        const south = r() < 0.5, p = south ? PL.south : PL.north;
        if (x < p.x0 + 0.2 || x > p.x1 - 0.2) continue;
        z = south ? p.z0 + 0.25 + Math.pow(r(), 1.6) * 1.4 : p.z1 - 0.25 - Math.pow(r(), 1.6) * 1.4;
        y = SI.empty ? PY : SI.top(x, z, PY - 0.2, PY + 0.2);
        if (!Number.isFinite(y)) continue;
        if (!coverOK(x, z, y, 'plat')) continue;
      } else {
        const zc = r() < 0.5 ? L.RAIL.zA : L.RAIL.zB;
        z = zc + gauss() * 1.05;
        if (z > PL.south.z0 - 0.05 && x > PL.south.x0 && x < PL.south.x1) continue;
        if (z < PL.north.z1 + 0.05 && x > PL.north.x0 && x < PL.north.x1) continue;
        y = SI.empty ? L.RAIL.ballastTopY : surfRaw(x, z);
        if (!Number.isFinite(y)) continue;
        let onRail = false;
        for (const zt of [L.RAIL.zA, L.RAIL.zB]) for (const s of [-1, 1]) if (Math.abs(z - (zt + s * L.RAIL.gauge / 2)) < 0.06 && y > 0.08) onRail = true;
        if (onRail) continue;
      }
      push(fall, [x, y + 0.012, z, 4], [0.03 + r() * 0.01, 0.5, 0, 0]);
      k++;
    }
  }
  // kind 6: train swirl — slot 0 = track A, slot 1 = track B (see update); aC.w 0 = wake, 1 = door eddy
  for (let slot = 0; slot < 2; slot++) {
    for (let k = 0; k < 460 * Q; k++) push(fall, [0, 0, 0, 6], [0.038 + r() * 0.014, 0, slot, 0]);   // trailing vortex pair
    for (let k = 0; k < 160 * Q; k++) push(fall, [0, 0, 0, 6], [0.036 + r() * 0.012, 0, slot, 2]);   // along the car sides
    for (let k = 0; k < 170 * Q; k++) push(fall, [0, 0, 0, 6], [0.038 + r() * 0.012, 0, slot, 1]);   // door eddies when stopped
  }
  const soft = makeBuf(Math.round(40 * Q) + 4);
  for (let k = 0; k < soft.cap; k++) push(soft, [(r() - 0.5) * 4.4, r() * 2.8, (r() - 0.5) * 4.4, 5], [0.036 + r() * 0.014, 0.22 + r() * 0.2, 2.2, 2.8]);
  const far = makeBuf(Math.round(4200 * Q) + 10);
  for (let k = 0; k < far.cap; k++) push(far, [(r() - 0.5) * 240, r() * 22, (r() - 0.5) * 240, 3], [0.036 + r() * 0.01, 0.4 + r() * 0.4, 120, 22]);

  const matFall = fallMaterial({ name: 'fall', minPx: 1.5, far: 230 });
  const matSoft = fallMaterial({ name: 'soft', minPx: 1, far: 12, soft: true, opacity: 0.62 });
  const matFar = fallMaterial({ name: 'glint', minPx: 2.0, far: 260 });
  const mFall = makeMesh(petalGeo, fall, matFall, 'petals-fall');
  const mSoft = makeMesh(flatGeo, soft, matSoft, 'petals-soft');
  const mFar = makeMesh(flatGeo, far, matFar, 'petals-glint');
  root.add(mFall, mSoft, mFar);

  // ------------------------------------------------------------------ floating petals: river rafts (花筏) + gutter water
  const floatMaterial = (sheet, map) => {
    const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, THREE.UniformsLib.lights]);
    Object.assign(uniforms, { uTime: ctx.shared.uTime, uSunDir: ctx.shared.uSunDir, uResY, uFar: { value: sheet ? 320 : 90 }, uTex: { value: map },
      uColA: { value: new THREE.Color(sheet ? COL.raftA : COL.pale) }, uColB: { value: new THREE.Color(sheet ? COL.raftB : COL.pink) }, ...uLight });
    const m = new THREE.ShaderMaterial({ uniforms, vertexShader: FLOAT_VERT, fragmentShader: FLOAT_FRAG, defines: sheet ? { SHEET: '' } : {}, lights: true, fog: true, side: THREE.DoubleSide });
    m.alphaToCoverage = true; m.name = sheet ? 'petals-rafts' : 'petals-floating';
    return m;
  };
  const makeFloat = (cap) => ({ A: new Float32Array(cap * 4), B: new Float32Array(cap * 4), C: new Float32Array(cap * 4), D: new Float32Array(cap * 4), n: 0, cap });
  const pushF = (b, A, B, C, D) => { if (b.n >= b.cap) return; const o = b.n * 4; b.A.set(A, o); b.B.set(B, o); b.C.set(C, o); b.D.set(D, o); b.n++; };
  const floatMesh = (b, mat, name) => {
    const g = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    for (const k of ['A', 'B', 'C', 'D']) g.setAttribute('a' + k, new THREE.InstancedBufferAttribute(b[k].subarray(0, Math.max(1, b.n) * 4), 4));
    const m = new THREE.InstancedMesh(g, mat, Math.max(1, b.n));
    m.count = b.n; m.frustumCulled = false; m.castShadow = false; m.receiveShadow = true; m.name = name; m.renderOrder = 1;
    return m;
  };
  const WY = L.RIVER.waterY + 0.006;
  const reaches = [[-170, -46.5], [-43.5, 74.5], [77.5, 170]];   // stepping stones at x=-45, weir at x=76 (environment)
  const sandbar = (z) => z > -114 && z < -110.8;
  const rafts = makeFloat(Math.round(300 * Q) + 10);
  for (let k = 0; k < rafts.cap; k++) {
    const [x0, x1] = r.pick(reaches); const len = x1 - x0;
    const bank = r() < 0.62;
    let z = bank ? (r() < 0.55 ? L.RIVER.z0 - 0.7 - Math.pow(r(), 1.5) * 3.2 : L.RIVER.z1 + 0.7 + Math.pow(r(), 1.5) * 3.2) : L.RIVER.z1 + 2 + r() * (L.RIVER.z0 - L.RIVER.z1 - 4);
    if (x0 < 30 && x1 > 20 && sandbar(z)) z = r() < 0.5 ? -114.6 : -110.2;
    const ribbon = bank ? r() < 0.75 : r() < 0.15;                       // long ribbons gather along the banks
    const Lr = ribbon ? 2.2 + r() * 3.4 : (bank ? 1.0 : 0.8) + r() * r() * 2.6, Wr = Lr * (0.92 + r() * 0.16); // isotropic: shapes live in the atlas
    const speed = bank ? 0.12 + r() * 0.16 : 0.3 + r() * 0.28;
    const cell = (ribbon ? 2 : 0) + (r() < 0.5 ? 1 : 0);
    pushF(rafts, [x0, WY + r() * 0.002, z, r()], [1, 0, 0, len], [Wr, Lr, (r() - 0.5) * (ribbon ? 0.16 : 0.5), r() * len], [speed, bank ? 0.25 : 0.8, r() * 6.28, cell + r() * 0.99]);
  }
  const singles = makeFloat(Math.round(2600 * Q) + 400);
  for (let k = 0; k < 2000 * Q; k++) {
    const [x0, x1] = r.pick(reaches); const len = x1 - x0;
    let z = L.RIVER.z1 + 0.5 + r() * (L.RIVER.z0 - L.RIVER.z1 - 1);
    if (x0 < 30 && x1 > 20 && sandbar(z)) continue;
    const s = 0.026 + r() * 0.008;
    const nearBank = Math.min(Math.abs(z - L.RIVER.z0), Math.abs(z - L.RIVER.z1)) < 3;
    pushF(singles, [x0, WY, z, r()], [1, 0, 0, len], [s * 0.72, s, r() * 6.28, r() * len], [nearBank ? 0.12 + r() * 0.15 : 0.3 + r() * 0.3, 0.5, r() * 6.28, r() * 0.99]);
  }
  // open gutter water: petals drifting slowly downhill
  let gutterFloat = 0;
  for (const g of gutters) {
    if (!g || !g.water || !g.open) continue;
    let [ax, az] = g.a, [bx, bz] = g.b;
    if (H(ax, az) < H(bx, bz)) { [ax, az, bx, bz] = [bx, bz, ax, az]; }
    const len = Math.hypot(bx - ax, bz - az); if (len < 0.4) continue;
    const dx = (bx - ax) / len, dz = (bz - az) / len;
    const hw = Math.max(0.05, (g.w || 0.3) / 2 - 0.05);
    const mx = (ax + bx) / 2, mz = (az + bz) / 2, h0 = H(mx, mz);
    let wy = h0 + 0.02 - 0.195;
    if (!SI.empty) {
      const rim = SI.top(mx + dz * ((g.w || 0.3) / 2 - 0.015), mz - dx * ((g.w || 0.3) / 2 - 0.015), h0 - 0.1, h0 + 0.3);
      const low = SI.top(mx, mz, h0 - 0.45, h0 + 0.05);
      if (Number.isFinite(low)) wy = (Number.isFinite(rim) && rim - low > 0.23) ? low + 0.075 : low;
    }
    const n = Math.round(len * 7 * Q);
    for (let k = 0; k < n; k++) {
      const s = 0.025 + r() * 0.007;
      const off = (r() - 0.5) * 2 * hw * 0.6;
      pushF(singles, [ax - dz * off, wy + 0.004, az + dx * off, r()], [dx, 0, dz, len], [s * 0.72, s, r() * 6.28, r() * len], [0.04 + r() * 0.07, hw * 0.4, r() * 6.28, r() * 0.99]);
      gutterFloat++;
    }
  }
  const mRafts = floatMesh(rafts, floatMaterial(true, TX.raftTex), 'petals-rafts');
  const mSingles = floatMesh(singles, floatMaterial(false, TX.colorTex), 'petals-floating');
  root.add(mRafts, mSingles);

  ctx.noOutline(root);
  ctx.noBatch(root);
  ctx.add(root);

  // ------------------------------------------------------------------ per frame: train gust + resolution
  const trainsR = createTrainReader(ctx);
  const sz = new THREE.Vector2();
  ctx.onUpdate((dt, t) => {
    const list = trainsR.read(t);
    // stable slots: track A -> 0, track B -> 1 (the swirl petals are bound to a slot), extras -> 2, 3
    const slots = [null, null, null, null];
    for (const T of list) { const want = T.side > 0 ? 0 : 1; if (!slots[want]) slots[want] = T; else if (!slots[2]) slots[2] = T; else if (!slots[3]) slots[3] = T; }
    for (let i = 0; i < 4; i++) {
      const a = uTr.value[i], b = uTr2.value[i], T = slots[i];
      if (T) { a.set(T.x, T.z, T.v, T.half); b.set(T.doors, T.side, 1, 0); } else { a.set(0, -1000, 0, 1); b.set(0, 0, 0, 0); }
    }
    if (ctx.renderer && ctx.renderer.getDrawingBufferSize) {
      ctx.renderer.getDrawingBufferSize(sz);
      uResY.value = Math.max(240, sz.y * (ctx.quality?.pixelRatio || 1));
    }
  });

  ctx.services.petals = {
    counts: { ground: G.count, patches: patches.length, fall: fall.n, soft: soft.n, glint: far.n, rafts: rafts.n, floating: singles.n, gutterFloat, ...planStats, surfaceTris: SI.count, trees: trees.length },
  };
}
