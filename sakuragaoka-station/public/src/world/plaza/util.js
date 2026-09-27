// Plaza helpers: flat shapes with world UVs, ring sectors, UV-scaled boxes, a tiny geometry builder.
import * as THREE from 'three';

export const TAU = Math.PI * 2;
export const rect = (x0, z0, x1, z1) => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
export const circlePts = (cx, cz, r, n = 48, a0 = 0) => {
  const out = [];
  for (let i = 0; i < n; i++) { const a = a0 + (i / n) * TAU; out.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r]); }
  return out;
};

/** Horizontal polygon (XZ, with holes) at height y. uv(x,z) -> [u,v]. Faces up. */
export function flatShape(outer, holes = [], y = 0, uv = (x, z) => [x, z]) {
  const shape = new THREE.Shape(outer.map(([x, z]) => new THREE.Vector2(x, -z)));
  for (const h of holes) shape.holes.push(new THREE.Path(h.map(([x, z]) => new THREE.Vector2(x, -z))));
  const g = new THREE.ShapeGeometry(shape, 24);
  g.rotateX(-Math.PI / 2);
  const p = g.attributes.position, uva = g.attributes.uv, n = g.attributes.normal;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    p.setY(i, y);
    const [u, v] = uv(x, z); uva.setXY(i, u, v);
    n.setXYZ(i, 0, 1, 0);
  }
  return g;
}

/** Minimal indexed geometry builder with automatic winding (faces point along the given normals). */
export class GeoBuilder {
  constructor() { this.pos = []; this.nor = []; this.uv = []; this.idx = []; }
  v(x, y, z, nx, ny, nz, u = 0, w = 0) { this.pos.push(x, y, z); this.nor.push(nx, ny, nz); this.uv.push(u, w); return this.pos.length / 3 - 1; }
  _dir(a, b, c) {
    const P = this.pos, N = this.nor;
    const ax = P[a * 3], ay = P[a * 3 + 1], az = P[a * 3 + 2];
    const ux = P[b * 3] - ax, uy = P[b * 3 + 1] - ay, uz = P[b * 3 + 2] - az;
    const vx = P[c * 3] - ax, vy = P[c * 3 + 1] - ay, vz = P[c * 3 + 2] - az;
    const cx = uy * vz - uz * vy, cy = uz * vx - ux * vz, cz = ux * vy - uy * vx;
    const nx = N[a * 3] + N[b * 3] + N[c * 3], ny = N[a * 3 + 1] + N[b * 3 + 1] + N[c * 3 + 1], nz = N[a * 3 + 2] + N[b * 3 + 2] + N[c * 3 + 2];
    return cx * nx + cy * ny + cz * nz;
  }
  tri(a, b, c) { if (this._dir(a, b, c) < 0) this.idx.push(a, c, b); else this.idx.push(a, b, c); }
  quad(a, b, c, d) { this.tri(a, b, c); this.tri(a, c, d); }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setIndex(this.idx);
    g.computeBoundingBox(); g.computeBoundingSphere();
    return g;
  }
}

/** Solid ring sector around the origin: radius r0..r1, height y0..y1, angle a0..a1 (point = (r cos a, y, r sin a)).
 *  UV: world-scaled (metres / uvScale). caps: close the ends (default when not a full circle). */
export function ringSector(r0, r1, y0, y1, a0, a1, seg = 16, opts = {}) {
  const s = opts.uvScale || 1;
  const full = Math.abs(a1 - a0) >= TAU - 1e-6;
  const caps = opts.caps ?? !full;
  const B = new GeoBuilder();
  const rm = (r0 + r1) / 2;
  const P = (r, a, y) => [r * Math.cos(a), y, r * Math.sin(a)];
  // top & bottom
  for (const [y, ny] of [[y1, 1], [y0, -1]]) {
    if (opts.noBottom && ny < 0) continue;
    let prev = null;
    for (let i = 0; i <= seg; i++) {
      const a = a0 + (a1 - a0) * i / seg;
      const pa = P(r0, a, y), pb = P(r1, a, y);
      const u = a * rm / s;
      const ia = B.v(...pa, 0, ny, 0, u, 0), ib = B.v(...pb, 0, ny, 0, u, (r1 - r0) / s);
      if (prev) B.quad(prev[0], prev[1], ib, ia);
      prev = [ia, ib];
    }
  }
  // outer & inner walls (smooth radial normals)
  for (const [r, sg] of [[r1, 1], [r0, -1]]) {
    if (r <= 1e-5) continue;
    let prev = null;
    for (let i = 0; i <= seg; i++) {
      const a = a0 + (a1 - a0) * i / seg;
      const nx = Math.cos(a) * sg, nz = Math.sin(a) * sg;
      const u = a * r / s;
      const ib = B.v(...P(r, a, y0), nx, 0, nz, u, 0), it = B.v(...P(r, a, y1), nx, 0, nz, u, (y1 - y0) / s);
      if (prev) B.quad(prev[0], prev[1], it, ib);
      prev = [ib, it];
    }
  }
  if (caps) {
    for (const [a, sg] of [[a0, -1], [a1, 1]]) {
      const tx = -Math.sin(a) * sg, tz = Math.cos(a) * sg;
      const q = [P(r0, a, y0), P(r1, a, y0), P(r1, a, y1), P(r0, a, y1)];
      const uvs = [[0, 0], [(r1 - r0) / s, 0], [(r1 - r0) / s, (y1 - y0) / s], [0, (y1 - y0) / s]];
      const ids = q.map((p, k) => B.v(...p, tx, 0, tz, uvs[k][0], uvs[k][1]));
      B.quad(ids[0], ids[1], ids[2], ids[3]);
    }
  }
  return B.build();
}

/** Flat annulus (horizontal) with polar UV: u = angle * uRep / TAU, v = (r-r0)/(r1-r0). */
export function annulus(r0, r1, y, seg = 64, rings = 4, uRep = 1) {
  const B = new GeoBuilder();
  const rows = [];
  for (let j = 0; j <= rings; j++) {
    const r = r0 + (r1 - r0) * j / rings; const row = [];
    for (let i = 0; i <= seg; i++) {
      const a = TAU * i / seg;
      row.push(B.v(r * Math.cos(a), y, r * Math.sin(a), 0, 1, 0, uRep * i / seg, j / rings));
    }
    rows.push(row);
  }
  for (let j = 0; j < rings; j++) for (let i = 0; i < seg; i++) B.quad(rows[j][i], rows[j][i + 1], rows[j + 1][i + 1], rows[j + 1][i]);
  return B.build();
}

/** BoxGeometry whose UVs are scaled to metres / s on every face (so tiled textures keep their scale). */
export function boxUV(w, h, d, s = 1, off = [0, 0]) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) {
    const i = f * 4 + k;
    uv.setXY(i, uv.getX(i) * dims[f][0] / s + off[0], uv.getY(i) * dims[f][1] / s + off[1]);
  }
  return g;
}

/** Place a mesh built from geometry into parent, with shadows. */
export function put(parent, geo, material, pos = [0, 0, 0], rot = null, opts = {}) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(pos[0], pos[1], pos[2]);
  if (rot) m.rotation.set(rot[0] || 0, rot[1] || 0, rot[2] || 0);
  m.castShadow = opts.cast ?? true; m.receiveShadow = opts.receive ?? true;
  parent.add(m);
  return m;
}

/** Instanced mesh from a list of matrices (+ optional colours). */
export function instanced(geo, material, mats, colors = null, opts = {}) {
  const im = new THREE.InstancedMesh(geo, material, Math.max(1, mats.length));
  im.count = mats.length;
  for (let i = 0; i < mats.length; i++) {
    im.setMatrixAt(i, mats[i]);
    if (colors) im.setColorAt(i, colors[i]);
  }
  im.instanceMatrix.needsUpdate = true;
  if (im.instanceColor) im.instanceColor.needsUpdate = true;
  im.castShadow = opts.cast ?? false; im.receiveShadow = opts.receive ?? true;
  im.computeBoundingSphere(); im.computeBoundingBox?.();
  return im;
}

const _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
/** Compose a matrix: position, euler (x,y,z), scale (number or [x,y,z]). */
export function mtx(x, y, z, rx = 0, ry = 0, rz = 0, sc = 1) {
  _e.set(rx, ry, rz, 'YXZ'); _q.setFromEuler(_e);
  if (Array.isArray(sc)) _s.set(sc[0], sc[1], sc[2]); else _s.set(sc, sc, sc);
  _p.set(x, y, z);
  return new THREE.Matrix4().compose(_p, _q, _s);
}

/** Smooth blob geometry (merged-vertex icosphere with spherical UVs) — no faceting under toon shading. */
export function blobGeo(detail, mergeVertices, uScale = 1, bump = 0) {
  let g = new THREE.IcosahedronGeometry(1, detail);
  g.deleteAttribute('uv'); g.deleteAttribute('normal');
  g = mergeVertices(g, 1e-4);
  const p = g.attributes.position, uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    uv[i * 2] = (Math.atan2(z, x) / (Math.PI * 2) + 0.5) * uScale; uv[i * 2 + 1] = y * 0.5 + 0.5;
    if (bump) { // soft cloud-like lobes (smooth, low frequency) for leafy silhouettes; flatter underside
      const n = Math.sin(x * 3.1 + 0.7) * Math.sin(y * 2.7 + 1.9) * Math.sin(z * 3.3 + 0.4) + 0.5 * Math.sin(x * 5.3 - z * 4.1 + y * 2.2);
      const k = 1 + bump * n * (y > -0.4 ? 1 : 0.3);
      p.setXYZ(i, x * k, y * k, z * k);
    }
  }
  g.computeVertexNormals();
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  if (uScale <= 1 && !bump) return g;
  // de-index (keeps the smooth merged normals) and unwrap U per triangle: no squeezed texture strip along
  // the atan2 seam, and pole vertices take their neighbours' mean U (no pinched streaks at the top).
  g = g.toNonIndexed();
  const q = g.attributes.uv, pp = g.attributes.position;
  for (let t = 0; t < q.count; t += 3) {
    const us = [q.getX(t), q.getX(t + 1), q.getX(t + 2)];
    const mx = Math.max(...us);
    for (let k = 0; k < 3; k++) if (mx - us[k] > uScale / 2) us[k] += uScale;
    for (let k = 0; k < 3; k++) {
      const px = pp.getX(t + k), pz = pp.getZ(t + k);
      if (Math.hypot(px, pz) < 1e-3) { const o = [0, 1, 2].filter(j => j !== k); us[k] = (us[o[0]] + us[o[1]]) / 2; }
    }
    for (let k = 0; k < 3; k++) q.setX(t + k, us[k]);
  }
  q.needsUpdate = true;
  return g;
}

/** Wind sway for small outline-free foliage cards: displaces instances in world space by the shared wind.
 *  mode 'up' = upright cards (sway grows with local y), 'flat' = flat heads (whole card jiggles). */
export function addSway(ctx, material, amp, mode = 'up') {
  if (material.userData.plazaSway) return material;   // cached material already patched
  material.userData.plazaSway = true;
  const prev = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    if (prev) prev(shader, renderer);
    shader.uniforms.uSwT = ctx.shared.uTime; shader.uniforms.uSwW = ctx.shared.uWind; shader.uniforms.uSwG = ctx.shared.uGust;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
uniform float uSwT; uniform vec2 uSwW; uniform float uSwG;`)
      .replace('#include <project_vertex>', `
        vec4 mvPosition = vec4( transformed, 1.0 );
        #ifdef USE_INSTANCING
          mvPosition = instanceMatrix * mvPosition;
          vec3 swIp = instanceMatrix[3].xyz;
        #else
          vec3 swIp = vec3(0.0);
        #endif
        {
          float swH = ${mode === 'up' ? 'clamp(position.y, 0.0, 1.0)' : '1.0'};
          float swPh = dot(swIp.xz, vec2(1.7, 2.3));
          float swS = sin(uSwT * 2.3 + swPh) * 0.6 + sin(uSwT * 3.9 + swPh * 1.37) * 0.4;
          vec2 swD = normalize(uSwW + vec2(1e-4, 0.0));
          mvPosition.xz += swD * (${amp.toFixed(4)} * swH * (0.35 + 0.65 * uSwG) * (0.55 + 0.45 * swS));
          mvPosition.xz += vec2(-swD.y, swD.x) * (${(amp * 0.35).toFixed(4)} * swH * sin(uSwT * 3.1 + swPh * 0.7));
        }
        mvPosition = modelViewMatrix * mvPosition;
        gl_Position = projectionMatrix * mvPosition;`);
  };
  material.customProgramCacheKey = () => 'paint-sway-' + mode + amp;
  material.needsUpdate = true;
  return material;
}

/** Merge geometries (non-indexed friendly): converts all to indexed w/ position, normal, uv. */
export function mergeGeos(geos, mergeGeometries) {
  const list = geos.map((g) => {
    let q = g.index ? g : g.toNonIndexed();
    if (!q.index) { const n = q.attributes.position.count; const ia = []; for (let i = 0; i < n; i++) ia.push(i); q.setIndex(ia); }
    if (!q.attributes.uv) q.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(q.attributes.position.count * 2), 2));
    if (!q.attributes.normal) q.computeVertexNormals();
    for (const k of Object.keys(q.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') q.deleteAttribute(k);
    return q;
  });
  return mergeGeometries(list, false);
}
