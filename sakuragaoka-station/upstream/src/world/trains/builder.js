// Geometry accumulation for the trains: every part is transformed into train space and collected
// into per-material "buckets" (vertex-coloured), then merged -> a handful of meshes per train.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const _cache = new Map();
const cached = (k, f) => { let g = _cache.get(k); if (!g) { g = f(); _cache.set(k, g); } return g; };
const r4 = (v) => Math.round(v * 1e4) / 1e4;

export const GEO = {
  box: () => cached('box', () => new THREE.BoxGeometry(1, 1, 1)),
  rbox: (w, h, d, r, s = 2) => cached(`rb${r4(w)}|${r4(h)}|${r4(d)}|${r4(r)}|${s}`, () => new RoundedBoxGeometry(w, h, d, s, Math.max(0.001, Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3)))),
  cyl: (rt, rb, h, seg = 12, open = false) => cached(`cy${r4(rt)}|${r4(rb)}|${r4(h)}|${seg}|${open}`, () => new THREE.CylinderGeometry(rt, rb, h, seg, 1, open)),
  sphere: (seg = 10) => cached('sp' + seg, () => new THREE.SphereGeometry(0.5, seg, Math.max(5, (seg * 0.6) | 0))),
  hemi: (seg = 10) => cached('hs' + seg, () => new THREE.SphereGeometry(0.5, seg, Math.max(4, (seg * 0.35) | 0), 0, Math.PI * 2, 0, Math.PI / 2)),
  torus: (R, r, rs = 4, ts = 10) => cached(`to${r4(R)}|${r4(r)}|${rs}|${ts}`, () => new THREE.TorusGeometry(R, r, rs, ts)),
  plane: () => cached('pl', () => new THREE.PlaneGeometry(1, 1)),
  circle: (seg = 16) => cached('ci' + seg, () => new THREE.CircleGeometry(0.5, seg)),
};

const _e = new THREE.Euler(), _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _s = new THREE.Vector3();
/** Matrix from position, euler rotation [rx,ry,rz] and scale. */
export function M(pos = [0, 0, 0], rot = null, scale = null) {
  const m = new THREE.Matrix4();
  _e.set(rot ? rot[0] || 0 : 0, rot ? rot[1] || 0 : 0, rot ? rot[2] || 0 : 0, 'YXZ');
  _q.setFromEuler(_e);
  m.compose(_v.set(pos[0], pos[1], pos[2]), _q, _s.set(scale ? scale[0] : 1, scale ? scale[1] : 1, scale ? scale[2] : 1));
  return m;
}
/** Matrix that maps local +Z to direction n (unit), local +Y as close as possible to up, at position p. */
export function basis(p, n, up = new THREE.Vector3(0, 1, 0)) {
  const z = n.clone().normalize();
  let x = new THREE.Vector3().crossVectors(up, z);
  if (x.lengthSq() < 1e-8) x.set(1, 0, 0); x.normalize();
  const y = new THREE.Vector3().crossVectors(z, x).normalize();
  const m = new THREE.Matrix4().makeBasis(x, y, z);
  m.setPosition(p);
  return m;
}

const _col = new THREE.Color();

export class Buckets {
  /** defs: { key: { uv: bool } } */
  constructor(defs) {
    this.defs = defs; this.lists = {}; for (const k of Object.keys(defs)) this.lists[k] = [];
    this.stack = [new THREE.Matrix4()];
    this.tris = 0;
  }
  get top() { return this.stack[this.stack.length - 1]; }
  push(m) { this.stack.push(this.top.clone().multiply(m)); return this; }
  pop() { this.stack.pop(); return this; }

  /** Add a geometry (cloned) transformed by the current stack × m, coloured (hex) unless color===null
   *  and the geometry has its own colour attribute. */
  add(key, geo, m = null, color = '#ffffff') {
    const def = this.defs[key]; if (!def) throw new Error('unknown bucket ' + key);
    const src = geo.attributes;
    const n = src.position.count;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(toF32(src.position), 3));
    if (src.normal) g.setAttribute('normal', new THREE.BufferAttribute(toF32(src.normal), 3));
    if (def.uv) g.setAttribute('uv', src.uv ? new THREE.BufferAttribute(toF32(src.uv), 2) : new THREE.BufferAttribute(new Float32Array(n * 2), 2));
    const ca = new Float32Array(n * 3);
    if (color === null && src.color) { for (let i = 0; i < n; i++) { ca[i * 3] = src.color.getX(i); ca[i * 3 + 1] = src.color.getY(i); ca[i * 3 + 2] = src.color.getZ(i); } }
    else { _col.set(color ?? '#ffffff'); for (let i = 0; i < n; i++) { ca[i * 3] = _col.r; ca[i * 3 + 1] = _col.g; ca[i * 3 + 2] = _col.b; } }
    g.setAttribute('color', new THREE.BufferAttribute(ca, 3));
    let idx;
    if (geo.index) idx = Uint32Array.from(geo.index.array);
    else { idx = new Uint32Array(n); for (let i = 0; i < n; i++) idx[i] = i; }
    const T = m ? this.top.clone().multiply(m) : this.top.clone();
    g.applyMatrix4(T);
    if (T.determinant() < 0) for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; }
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    if (!src.normal) g.computeVertexNormals();
    this.lists[key].push(g);
    this.tris += idx.length / 3;
    if (Buckets.tally) { const k = key + ':' + (this.tag || '?'); Buckets.tally[k] = (Buckets.tally[k] || 0) + idx.length / 3; }
    return g;
  }
  // ---- shorthand primitives (pos = centre)
  box(key, w, h, d, pos, color, rot) { return this.add(key, GEO.box(), M(pos, rot, [w, h, d]), color); }
  rbox(key, w, h, d, r, pos, color, rot, seg = 2) { return this.add(key, GEO.rbox(w, h, d, r, seg), M(pos, rot), color); }
  cyl(key, rt, rb, h, pos, color, rot, seg = 12, open = false) { return this.add(key, GEO.cyl(rt, rb, h, seg, open), M(pos, rot), color); }
  sphere(key, r, pos, color, seg = 10, scale = null) { return this.add(key, GEO.sphere(seg), M(pos, null, scale ? [r * 2 * scale[0], r * 2 * scale[1], r * 2 * scale[2]] : [r * 2, r * 2, r * 2]), color); }
  /** Cylinder between two points a,b (arrays). */
  rod(key, a, b, r, color, seg = 8) {
    const A = new THREE.Vector3(...a), Bv = new THREE.Vector3(...b);
    const d = new THREE.Vector3().subVectors(Bv, A); const len = d.length();
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize());
    m.compose(A.clone().addScaledVector(d, 0.5), q, new THREE.Vector3(1, 1, 1));
    return this.add(key, GEO.cyl(r, r, len, seg), m, color);
  }
  /** Tube through points. */
  tube(key, pts, r, color, seg = 24, radial = 6) {
    const curve = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p)));
    return this.add(key, new THREE.TubeGeometry(curve, seg, r, radial, false), null, color);
  }
  /** Plane (faces +Z) with UVs mapped to atlas rect {u0,v0,u1,v1}. */
  decal(key, w, h, rect, m) {
    const g = GEO.plane().clone();
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, rect.u0 + (rect.u1 - rect.u0) * uv.getX(i), rect.v0 + (rect.v1 - rect.v0) * uv.getY(i));
    g.scale(w, h, 1);
    return this.add(key, g, m, '#ffffff');
  }

  /** Merge each bucket -> BufferGeometry. */
  merge() {
    const out = {};
    for (const [k, list] of Object.entries(this.lists)) {
      if (!list.length) continue;
      const g = list.length === 1 ? list[0] : mergeGeometries(list, false);
      if (!g) { console.warn('trains: merge failed', k); continue; }
      g.computeBoundingSphere(); g.computeBoundingBox();
      out[k] = g;
      for (const s of list) if (s !== g) s.dispose();
    }
    return out;
  }
}

function toF32(attr) {
  if (attr.array instanceof Float32Array && !attr.isInterleavedBufferAttribute && !attr.normalized) return new Float32Array(attr.array);
  const a = new Float32Array(attr.count * attr.itemSize);
  for (let i = 0; i < attr.count; i++) for (let j = 0; j < attr.itemSize; j++) a[i * attr.itemSize + j] = attr.getComponent(i, j);
  return a;
}

// ------------------------------------------------------------------ shapes
/** Rounded rectangle path points (counter-clockwise) centred at (cx,cy), size w×h, radius r. */
export function rrectPts(cx, cy, w, h, r, seg = 4) {
  r = Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4);
  const pts = [];
  const corners = [[cx + w / 2 - r, cy - h / 2 + r, -Math.PI / 2], [cx + w / 2 - r, cy + h / 2 - r, 0], [cx - w / 2 + r, cy + h / 2 - r, Math.PI / 2], [cx - w / 2 + r, cy - h / 2 + r, Math.PI]];
  for (const [x, y, a0] of corners) {
    if (r <= 1e-4) { pts.push([x, y]); continue; }
    for (let i = 0; i <= seg; i++) { const a = a0 + (Math.PI / 2) * i / seg; pts.push([x + Math.cos(a) * r, y + Math.sin(a) * r]); }
  }
  return pts;
}
export function shapeFrom(pts, holes = []) {
  const s = new THREE.Shape(pts.map(p => new THREE.Vector2(p[0], p[1])));
  for (const h of holes) s.holes.push(new THREE.Path(h.slice().reverse().map(p => new THREE.Vector2(p[0], p[1]))));
  return s;
}
/** Extruded shape (in local XY, extruded 0..depth along +Z). Non-indexed. */
export function extrudeShape(shape, depth, curveSegments = 4) {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments });
  g.clearGroups();
  return g;
}
export function shapeGeo(shape, curveSegments = 4) { const g = new THREE.ShapeGeometry(shape, curveSegments); return g; }

/** Colour a (non-indexed or indexed) geometry per-vertex by normal: fn(nx,ny,nz,x,y,z) -> hex. */
export function colorByNormal(geo, fn) {
  const n = geo.attributes.normal, p = geo.attributes.position; const c = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) { _col.set(fn(n.getX(i), n.getY(i), n.getZ(i), p.getX(i), p.getY(i), p.getZ(i))); c[i * 3] = _col.r; c[i * 3 + 1] = _col.g; c[i * 3 + 2] = _col.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return geo;
}

// ------------------------------------------------------------------ parametric surfaces
/** Build a surface from rows of parameter points. rows: [[ [a,b], ... ], ...] each row sorted.
 *  surf(a,b) -> { p: Vector3, n: Vector3 }. offset along the normal. flip: inward-facing.
 *  Triangles between consecutive rows are "zippered" (rows may have different counts). */
export function rowsSurface(rows, surf, offset = 0, flip = false) {
  const pos = [], nor = [], idx = [];
  const starts = [];
  for (const row of rows) {
    starts.push(pos.length / 3);
    for (const [a, b] of row) {
      const s = surf(a, b);
      const nx = flip ? -s.n.x : s.n.x, ny = flip ? -s.n.y : s.n.y, nz = flip ? -s.n.z : s.n.z;
      pos.push(s.p.x + s.n.x * offset, s.p.y + s.n.y * offset, s.p.z + s.n.z * offset);
      nor.push(nx, ny, nz);
    }
  }
  const P = (i) => [pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]];
  const tri = (i, j, k) => {
    const a = P(i), b = P(j), c = P(k);
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const fx = uy * vz - uz * vy, fy = uz * vx - ux * vz, fz = ux * vy - uy * vx;
    if (fx * fx + fy * fy + fz * fz < 1e-14) return;
    const nx = nor[i * 3] + nor[j * 3] + nor[k * 3], ny = nor[i * 3 + 1] + nor[j * 3 + 1] + nor[k * 3 + 1], nz = nor[i * 3 + 2] + nor[j * 3 + 2] + nor[k * 3 + 2];
    if (fx * nx + fy * ny + fz * nz >= 0) idx.push(i, j, k); else idx.push(i, k, j);
  };
  for (let r = 0; r < rows.length - 1; r++) {
    const A = rows[r], B = rows[r + 1], a0 = starts[r], b0 = starts[r + 1];
    let i = 0, j = 0;
    while (i < A.length - 1 || j < B.length - 1) {
      const canI = i < A.length - 1, canJ = j < B.length - 1;
      let advI;
      if (!canJ) advI = true; else if (!canI) advI = false;
      else advI = A[i + 1][0] <= B[j + 1][0];
      if (advI) { tri(a0 + i, a0 + i + 1, b0 + j); i++; } else { tri(a0 + i, b0 + j + 1, b0 + j); j++; }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex(idx);
  return g;
}

/** Sweep a 2D profile (array of [z,y] + normals [nz,ny]) straight along x from x0 to x1. */
export function sweepX(profile, normals, x0, x1) {
  const pos = [], nor = [], idx = [];
  for (let i = 0; i < profile.length; i++) {
    const [z, y] = profile[i], [nz, ny] = normals[i];
    pos.push(x0, y, z, x1, y, z); nor.push(0, ny, nz, 0, ny, nz);
  }
  for (let i = 0; i < profile.length - 1; i++) {
    const a = i * 2, b = i * 2 + 1, c = i * 2 + 2, d = i * 2 + 3;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex(idx);
  fixWinding(g);
  return g;
}

/** Make every triangle's winding agree with its vertex normals. */
export function fixWinding(g) {
  const p = g.attributes.position, n = g.attributes.normal, ix = g.index.array;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), f = new THREE.Vector3(), s = new THREE.Vector3();
  for (let i = 0; i < ix.length; i += 3) {
    a.fromBufferAttribute(p, ix[i]); b.fromBufferAttribute(p, ix[i + 1]); c.fromBufferAttribute(p, ix[i + 2]);
    f.subVectors(b, a).cross(c.clone().sub(a));
    s.set(n.getX(ix[i]) + n.getX(ix[i + 1]) + n.getX(ix[i + 2]), n.getY(ix[i]) + n.getY(ix[i + 1]) + n.getY(ix[i + 2]), n.getZ(ix[i]) + n.getZ(ix[i + 1]) + n.getZ(ix[i + 2]));
    if (f.dot(s) < 0) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; }
  }
  return g;
}
