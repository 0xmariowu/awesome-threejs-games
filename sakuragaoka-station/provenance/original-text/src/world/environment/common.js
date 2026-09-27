// environment/common.js — deterministic noise, world zones and the extended terrain height.
// Pure functions of coordinates (no Math.random): screenshots stay deterministic.
import * as L from '../layout.js';

export const { clamp, lerp, smoothstep } = L;
export const TAU = Math.PI * 2;

// ------------------------------------------------------------------ noise
export function hash2(ix, iz, seed = 0) {
  let h = (Math.imul(ix | 0, 374761393) + Math.imul(iz | 0, 668265263) + Math.imul(seed | 0, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
/** value noise 0..1 */
export function vnoise(x, z, seed = 0) {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = x - ix, fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz);
  const a = hash2(ix, iz, seed), b = hash2(ix + 1, iz, seed), c = hash2(ix, iz + 1, seed), d = hash2(ix + 1, iz + 1, seed);
  return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;
}
/** fractal noise 0..1 */
export function fbm(x, z, oct = 4, seed = 0) {
  let s = 0, a = 0.5, n = 0, f = 1;
  for (let i = 0; i < oct; i++) { s += a * vnoise(x * f + i * 17.3, z * f - i * 9.1, seed + i * 7); n += a; a *= 0.5; f *= 2.03; }
  return s / n;
}
/** ridged noise 0..1 (sharp crests) */
export function ridged(x, z, oct = 4, seed = 0) {
  let s = 0, a = 0.5, n = 0, f = 1;
  for (let i = 0; i < oct; i++) { const v = 1 - Math.abs(vnoise(x * f + i * 5.7, z * f + i * 3.1, seed + i * 11) * 2 - 1); s += a * v * v; n += a; a *= 0.5; f *= 2.1; }
  return s / n;
}

// ------------------------------------------------------------------ zones (from the layout contract)
const LOTF = L.LOTS.map((l) => { const f = L.lotFrame(l); return { ...f, c: Math.cos(f.rotY), s: Math.sin(f.rotY), id: l.id }; });
export function inLot(x, z, pad = 0) {
  for (const f of LOTF) {
    const dx = x - f.x, dz = z - f.z;
    const lx = dx * f.c - dz * f.s, lz = dx * f.s + dz * f.c;
    if (Math.abs(lx) <= f.w / 2 + pad && lz <= pad && lz >= -f.depth - pad) return f;
  }
  return null;
}
const inR = (x, z, r, pad = 0) => x >= r.x0 - pad && x <= r.x1 + pad && z >= r.z0 - pad && z <= r.z1 + pad;
export { inR as inRect };

/** Signed-ish distance (m) from (x,z) to the nearest road surface edge (<=0 on a road). */
export function roadDist(x, z) {
  let d = 1e9;
  // R1 main street incl. sidewalks (4.6)
  if (z > 0.5 && z < 131) d = Math.min(d, Math.abs(x - L.streetCenterX(z)) - 4.6);
  // R2 crossing road (north of R3)
  { const R = L.ROADS.R2; const dx = Math.abs(x - R.x) - R.halfW; const dz = Math.max(R.z0 - z, z - R.z1, 0); d = Math.min(d, Math.max(dx, 0) + dz > 0 ? Math.hypot(Math.max(dx, 0), dz) : dx); }
  for (const k of ['R3', 'R4', 'R6']) {
    const R = L.ROADS[k]; const dz = Math.abs(z - R.z) - R.halfW; const dx = Math.max(R.x0 - x, x - R.x1, 0);
    d = Math.min(d, dx > 0 ? Math.hypot(dx, Math.max(dz, 0)) : dz);
  }
  return d;
}

export const PARK = { x0: 63.5, x1: 92.5, z0: -32.8, z1: -6.6, mound: { x: 78.5, z: -20.5, rx: 11.5, rz: 8.6, h: 2.35 } };
export const VACANT_W = { x0: -93, x1: -63, z0: -33, z1: -6.2 };
export const ALLOT_W = { x0: -91, x1: -64, z0: 34, z1: 70 };   // 市民農園 (community allotments)
export const NANO_E = { x0: 65, x1: 91, z0: 12, z1: 40 };      // small 菜の花 field

/** Worn dirt / gravel paths through unowned ground: { pts, w } (w = half width-ish). */
export const PATHS = [
  { pts: [[-63, -9.5], [-70, -15], [-76, -22], [-84, -26.5], [-93, -29]], w: 0.55, kind: 'dirt' },             // vacant lot W
  { pts: [[70.5, -6.4], [70.2, -10], [68.6, -14.5], [67.6, -19.5], [69.4, -25], [74.5, -28.6], [80.5, -28.2], [85.2, -25.4], [87.6, -21], [86.4, -16.8], [83.4, -14.6], [80.6, -16.6], [79.2, -19.6]], w: 0.7, kind: 'park' }, // winding park path up the mound
  { pts: [[86.5, -6.4], [87.4, -11], [87.6, -16.5]], w: 0.6, kind: 'park' },
  { pts: [[-64, 72], [-72, 90], [-70, 108], [-78, 128]], w: 0.5, kind: 'dirt' },
  { pts: [[63, 44], [72, 62], [70, 84], [80, 104], [76, 128]], w: 0.5, kind: 'dirt' },
  { pts: [[-88, -57.6], [-90, -66], [-88.5, -76], [-90.5, -83.4]], w: 0.5, kind: 'dirt' },                      // behind N rows W
  { pts: [[88, -57.6], [89.5, -68], [88, -83.4]], w: 0.5, kind: 'dirt' },
];
export function pathDist(x, z) {
  let best = 1e9, kind = null, w = 1;
  for (const p of PATHS) {
    const pts = p.pts;
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
      const vx = bx - ax, vz = bz - az, l2 = vx * vx + vz * vz;
      const t = clamp(((x - ax) * vx + (z - az) * vz) / l2, 0, 1);
      const d = Math.hypot(x - ax - vx * t, z - az - vz * t) / p.w;
      if (d < best) { best = d; kind = p.kind; w = p.w; }
    }
  }
  return { d: best, kind, w };
}

/** Owned by another module (roads, lots, blocks, plaza, station, crossing, far town)? */
export function ownedByOthers(x, z, pad = 0) {
  if (roadDist(x, z) <= pad) return 'road';
  if (inR(x, z, L.PLAZA, pad)) return 'plaza';
  if (inR(x, z, L.STATION, pad) || inR(x, z, L.STATION.forecourt, pad) || inR(x, z, L.STATION.sideYard, pad) || inR(x, z, L.STATION.westYard, pad)) return 'station';
  if (inR(x, z, L.CROSSING.zone, pad)) return 'crossing';
  if (inLot(x, z, pad)) return 'lot';
  for (const b of L.BLOCKS) if (inR(x, z, b, pad)) return 'block';
  for (const b of L.FAR_TOWN) if (inR(x, z, b, pad)) return 'fartown';
  return null;
}
export const inCorridor = (x, z, pad = 0) => z >= L.RAIL.corridorZ0 - pad && z <= L.RAIL.corridorZ1 + pad && Math.abs(x) <= 440;
/** Levee / river band. */
export const LEV = { toe: -84, shoulderT: -91.5, shoulderR: -94.5, riverTop: -99, waterNear: -99.95, waterFar: -117.33, farTop: -119 };

// ------------------------------------------------------------------ extended terrain height
// = L.heightAt everywhere another module may place things; hills only outside those zones.
const FLAT = [
  { x0: -117, x1: 117, z0: -122, z1: 153, r: 70 },   // play area + margin
  { x0: -275, x1: 275, z0: -101, z1: 215, r: 70 },   // W/E far town
  { x0: -110, x1: 110, z0: 116, z1: 255, r: 70 },    // S far town
  { x0: -445, x1: 445, z0: -62, z1: -24, r: 55 },    // rail corridor (railway runs to x=±420)
  { x0: -5000, x1: 5000, z0: -282, z1: -82, r: 70 }, // levee, river, north fields
];
function rectInfluence(x, z, r) {
  const dx = Math.max(r.x0 - x, 0, x - r.x1), dz = Math.max(r.z0 - z, 0, z - r.z1);
  const d = Math.hypot(dx, dz);
  return 1 - smoothstep(0, r.r, d);
}
/** 0 inside flat zones, 1 in the free hills. */
export function hillMask(x, z) {
  let m = 1;
  for (const r of FLAT) { m *= 1 - rectInfluence(x, z, r); if (m <= 0) return 0; }
  return m;
}
const bump = (v, c, w) => { const t = 1 - clamp(Math.abs(v - c) / w, 0, 1); return t * t * (3 - 2 * t); };

/** Raw hill relief (before masking). North: foothills + a second range; elsewhere rolling hills. */
export function hillRelief(x, z) {
  if (z < -181) {
    const zz = z + (fbm(x / 260, 3.3, 3, 11) - 0.5) * 90;
    const r1 = bump(zz, -372, 88) * (17 + 26 * fbm(x / 120, 1.7, 3, 12));
    const r2 = bump(zz, -575, 150) * (38 + 36 * ridged(x / 210, 4.1, 3, 13));
    const plain = smoothstep(-282, -430, zz) * 7 + smoothstep(-470, -700, zz) * 16;
    const small = (fbm(x / 45, z / 45, 3, 14) - 0.5) * 7 * smoothstep(-282, -330, z);
    return Math.max(r1, r2 * 0.25) + r2 * 0.8 + plain + small;
  }
  // east / west / south: gentle hills growing with distance from the town
  const re = Math.hypot(x / 1.0, (z - 30) / 1.08);
  const g = smoothstep(250, 560, re);
  const n = fbm(x / 170, z / 170, 4, 21);
  const n2 = fbm(x / 60, z / 60, 3, 22);
  return g * (14 + 42 * n * n + 9 * n2) + smoothstep(520, 720, re) * 22 * fbm(x / 300, z / 300, 2, 23);
}

// Far-bank embankment for the road bridge (x≈-160) — only north of the river, outside the play area.
export const BRIDGE = { x: -160, halfW: 4.2, zLevee: -93, zAbut: -119.8, deckY: 3.45 };
function bridgeEmbankment(x, z) {
  if (z > -118.6 || z < -182) return 0;
  const top = lerp(BRIDGE.deckY, L.heightAt(BRIDGE.x, -175), smoothstep(-120, -175, z));
  const side = Math.max(0, Math.abs(x - BRIDGE.x) - 4.5);
  const hTop = top - side * 0.55;
  const base = L.heightAt(x, z);
  return Math.max(0, hTop - base) * smoothstep(-118.6, -120.2, z);
}

/** Park mound (小型緑化坡地) on unowned ground east of the NE block — walkable via physics boxes. */
export function parkMound(x, z) {
  const M = PARK.mound;
  const dx = (x - M.x) / M.rx, dz = (z - M.z) / M.rz;
  const d = Math.hypot(dx, dz);
  if (d >= 1) return 0;
  const f = 0.5 * (1 + Math.cos(Math.PI * d));
  const lobe = 0.18 * Math.max(0, 1 - Math.hypot((x - M.x - 5) / 5, (z - M.z - 3) / 4));
  return M.h * f * (1 + lobe);
}
/** Terrain height used by the environment mesh. Equals L.heightAt wherever other modules build. */
export function terrainH(x, z) {
  let h = L.heightAt(x, z);
  const m = hillMask(x, z);
  if (m > 0) h += m * hillRelief(x, z);
  if (x > -200 && x < -120) h += bridgeEmbankment(x, z);
  if (x > 66 && x < 91 && z > -30 && z < -11) h += parkMound(x, z);
  return h;
}
export function terrainNormal(x, z, e = 0.5) {
  const hx = terrainH(x + e, z) - terrainH(x - e, z);
  const hz = terrainH(x, z + e) - terrainH(x, z - e);
  const nx = -hx, ny = 2 * e, nz = -hz; const l = Math.hypot(nx, ny, nz);
  return [nx / l, ny / l, nz / l];
}

// ------------------------------------------------------------------ misc helpers
/** Build a BufferGeometry from arrays. */
export function makeGeo(THREE, pos, idx, { nrm, uv, col } = {}) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  if (nrm) g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  if (uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  if (col) g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  if (idx) g.setIndex(pos.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(idx, 1) : new THREE.Uint16BufferAttribute(idx, 1));
  if (!nrm) g.computeVertexNormals();
  g.computeBoundingSphere(); g.computeBoundingBox();
  return g;
}
/** sRGB hex -> linear [r,g,b] */
export function lin(THREE, hex) { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; }
export function mix3(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
export function mul3(a, k) { return [a[0] * k, a[1] * k, a[2] * k]; }

/** Draw-call saver: every plain, untextured, opaque toon mesh under `root` gets its colour baked into a
 *  per-vertex colour attribute and switches to ONE shared vertex-coloured toon material, so the static
 *  batcher merges all of them into a single mesh per cell. Textured / transparent / double-sided /
 *  emissive / decal / instanced meshes are left untouched. */
export function bakeColors(ctx, root) {
  const THREE = ctx.THREE;
  const shared = ctx.mat.toon('#ffffff', { vertexColors: true, paint: 0.06, name: 'env-vc' });
  let n = 0;
  root.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh) return;
    const m = o.material;
    if (!m || Array.isArray(m) || !m.isMeshToonMaterial || m === shared) return;
    if (m.map || m.alphaMap || m.transparent || m.vertexColors || m.polygonOffset || m.side !== THREE.FrontSide || m.alphaTest > 0) return;
    if (m.emissive && (m.emissive.r + m.emissive.g + m.emissive.b) > 0) return;
    const g = o.geometry.clone();
    const cnt = g.attributes.position.count, a = new Float32Array(cnt * 3);
    for (let i = 0; i < cnt; i++) { a[i * 3] = m.color.r; a[i * 3 + 1] = m.color.g; a[i * 3 + 2] = m.color.b; }
    g.setAttribute('color', new THREE.BufferAttribute(a, 3));
    o.geometry = g; o.material = shared; n++;
  });
  return n;
}

/** Unit icosphere with smooth (radial) normals: round cel-shaded clumps instead of faceted gems. */
export function smoothBlob(THREE, detail = 1) {
  const g = new THREE.IcosahedronGeometry(1, detail);
  const pa = g.attributes.position, na = g.attributes.normal;
  for (let i = 0; i < pa.count; i++) { const x = pa.getX(i), y = pa.getY(i), z = pa.getZ(i), l = Math.hypot(x, y, z); na.setXYZ(i, x / l, y / l, z / l); }
  return g;
}
