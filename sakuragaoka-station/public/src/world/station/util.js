// Station module helpers: world-space UV boxes, atlas planes, beams, walls with openings,
// railings, foliage-card batches. Everything is plain three.js built on ctx (no core edits).
import * as THREE from 'three';

const _v = new THREE.Vector3(), _n = new THREE.Vector3(), _m3 = new THREE.Matrix3();

export function createUtil(ctx) {
  const { mat, geo } = ctx;
  const G = geo.G;
  const geoCache = new Map();
  const cyl = (seg = 10) => geoCache.get('cyl' + seg) || geoCache.set('cyl' + seg, new THREE.CylinderGeometry(0.5, 0.5, 1, seg)).get('cyl' + seg);
  // cylinder lying along +Z (unit length, unit diameter)
  const cylZ = (seg = 8) => {
    const k = 'cylZ' + seg;
    if (!geoCache.has(k)) geoCache.set(k, new THREE.CylinderGeometry(0.5, 0.5, 1, seg).rotateX(Math.PI / 2));
    return geoCache.get(k);
  };

  /** Re-map a mesh's UVs to world metres (box mapping by face normal) so tiling textures are
   *  seamless across neighbouring boxes and never stretched. tile = metres per texture repeat
   *  (number or [u,v]). Call after the mesh is positioned. */
  function worldUV(mesh, tile = 1, off = [0, 0], swapTop = false) {
    mesh.updateWorldMatrix(true, false);
    const g = mesh.geometry.clone();
    const p = g.attributes.position, n = g.attributes.normal;
    let uv = g.attributes.uv;
    if (!uv) { uv = new THREE.BufferAttribute(new Float32Array(p.count * 2), 2); g.setAttribute('uv', uv); }
    const m = mesh.matrixWorld; _m3.getNormalMatrix(m);
    const tu = Array.isArray(tile) ? tile[0] : tile, tv = Array.isArray(tile) ? tile[1] : tile;
    for (let i = 0; i < p.count; i++) {
      _v.fromBufferAttribute(p, i).applyMatrix4(m);
      _n.fromBufferAttribute(n, i).applyMatrix3(_m3).normalize();
      const ax = Math.abs(_n.x), ay = Math.abs(_n.y), az = Math.abs(_n.z);
      let u, w;
      if (ay >= ax && ay >= az) { if (swapTop) { u = -_v.z; w = _v.x; } else { u = _v.x; w = -_v.z; } }
      else if (ax >= az) { u = -_v.z * Math.sign(_n.x); w = _v.y; }
      else { u = _v.x * Math.sign(_n.z); w = _v.y; }
      uv.setXY(i, (u + off[0]) / tu, (w + off[1]) / tv);
    }
    uv.needsUpdate = true;
    mesh.geometry = g;
    return mesh;
  }

  /** Plane geometry whose UVs map to an atlas sub-rect r = {u0,v0,u1,v1}. */
  function rectPlane(w, h, r) {
    const g = new THREE.PlaneGeometry(w, h);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, r.u0 + uv.getX(i) * (r.u1 - r.u0), r.v0 + uv.getY(i) * (r.v1 - r.v0));
    return g;
  }

  /** Box from a to b (centre-line), w (horizontal) × h (vertical) cross-section. round => cylinder. */
  function beam(k, a, b, w, h, m, round = false, seg = 8) {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
    const len = A.distanceTo(B);
    const mesh = new THREE.Mesh(round ? cylZ(seg) : G.box(), m);
    mesh.position.copy(A).add(B).multiplyScalar(0.5);
    mesh.scale.set(w, h, len);
    k.parent.add(mesh);
    mesh.updateWorldMatrix(true, false);
    // orient +Z toward B (parent is identity-aligned in this module)
    const up = Math.abs(B.y - A.y) > 0.999 * len ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
    const mtx = new THREE.Matrix4().lookAt(B, A, up);
    mesh.quaternion.setFromRotationMatrix(mtx);
    mesh.castShadow = true; mesh.receiveShadow = true;
    return mesh;
  }

  /** Straight wall along an axis with rectangular openings.
   *  axis 'x': runs along x from a0..a1, thickness spans z c0..c1. axis 'z': along z, thickness in x c0..c1.
   *  openings: [{a0,a1,y0,y1}] (in the wall's along-coordinate). Returns the created meshes. */
  function wall(k, m, axis, c0, c1, a0, a1, y0, y1, openings = [], tile = null) {
    const edges = new Set([a0, a1]);
    for (const o of openings) { edges.add(Math.max(a0, Math.min(a1, o.a0))); edges.add(Math.max(a0, Math.min(a1, o.a1))); }
    const xs = [...edges].sort((p, q) => p - q);
    const out = [];
    for (let i = 0; i < xs.length - 1; i++) {
      const s = xs[i], e = xs[i + 1]; if (e - s < 1e-4) continue;
      const mid = (s + e) / 2;
      const holes = openings.filter(o => o.a0 < mid && o.a1 > mid).map(o => [Math.max(y0, o.y0), Math.min(y1, o.y1)]).sort((p, q) => p[0] - q[0]);
      let y = y0;
      const spans = [];
      for (const [h0, h1] of holes) { if (h0 > y + 1e-4) spans.push([y, h0]); y = Math.max(y, h1); }
      if (y1 > y + 1e-4) spans.push([y, y1]);
      for (const [sy0, sy1] of spans) {
        const L = e - s, H = sy1 - sy0, T = c1 - c0;
        const pos = axis === 'x' ? [mid, (sy0 + sy1) / 2, (c0 + c1) / 2] : [(c0 + c1) / 2, (sy0 + sy1) / 2, mid];
        const mesh = axis === 'x' ? k.box(L, H, T, m, pos) : k.box(T, H, L, m, pos);
        if (tile) worldUV(mesh, tile);
        out.push(mesh);
      }
    }
    return out;
  }

  /** Railing along a polyline of [x,z] points. base: number | (x,z)=>y. opts: h, post (spacing),
   *  bar (baluster spacing, 0 = none), rails (heights as fraction of h), mat, postMat, round. */
  function railing(k, pts, base, opts = {}) {
    const h = opts.h ?? 1.1, m = opts.mat, pm = opts.postMat || m;
    const yb = typeof base === 'function' ? base : () => base;
    const rails = opts.rails || [1.0, 0.55];
    const postW = opts.postW ?? 0.05, railW = opts.railW ?? 0.042;
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
      const len = Math.hypot(bx - ax, bz - az);
      const nPost = Math.max(1, Math.round(len / (opts.post ?? 2.0)));
      for (let j = 0; j <= nPost; j++) {
        if (j === 0 && i > 0) continue;
        const t = j / nPost, x = ax + (bx - ax) * t, z = az + (bz - az) * t, y = yb(x, z);
        if (opts.round) k.cyl(postW / 2, postW / 2, h, pm, [x, y + h / 2, z], null, 8);
        else k.box(postW, h, postW, pm, [x, y + h / 2, z]);
      }
      for (const f of rails) {
        const ya = yb(ax, az) + h * f - (f === 1 ? railW / 2 : 0), ybb = yb(bx, bz) + h * f - (f === 1 ? railW / 2 : 0);
        beam(k, [ax, ya, az], [bx, ybb, bz], railW, railW, m, !!opts.round);
      }
      if (opts.bar) {
        const nb = Math.max(1, Math.floor(len / opts.bar));
        const lo = opts.barLo ?? 0.1, hi = rails[0] * h - railW;
        for (let j = 1; j < nb; j++) {
          const t = j / nb, x = ax + (bx - ax) * t, z = az + (bz - az) * t, y = yb(x, z);
          k.box(opts.barW ?? 0.022, hi - lo, opts.barW ?? 0.022, m, [x, y + (lo + hi) / 2, z]);
        }
      }
    }
  }

  /** Accumulates alpha-tested vegetation cards into ONE geometry (one draw call). */
  function cards() {
    const P = [], U = [], Nn = [], I = [];
    let vcount = 0;
    const quad = (x, y, z, w, h, ang, r, lean = 0) => {
      const c = Math.cos(ang), s = Math.sin(ang);
      const dx = c * w / 2, dz = -s * w / 2;
      const lx = Math.sin(ang) * lean, lz = Math.cos(ang) * lean; // lean the top sideways a little
      const v = [[x - dx, y, z - dz], [x + dx, y, z + dz], [x + dx + lx, y + h, z + dz + lz], [x - dx + lx, y + h, z - dz + lz]];
      for (const q of v) P.push(...q);
      U.push(r.u0, r.v0, r.u1, r.v0, r.u1, r.v1, r.u0, r.v1);
      for (let i = 0; i < 4; i++) Nn.push(0, 1, 0);
      I.push(vcount, vcount + 1, vcount + 2, vcount, vcount + 2, vcount + 3);
      vcount += 4;
    };
    return {
      quad,
      /** crossed pair of cards, bottom centre at (x,y,z) */
      cross(x, y, z, w, h, ang, r, lean = 0) { quad(x, y, z, w, h, ang, r, lean); quad(x, y, z, w, h, ang + Math.PI / 2, r, -lean); },
      /** three-way star */
      star(x, y, z, w, h, ang, r) { for (let i = 0; i < 3; i++) quad(x, y, z, w, h, ang + i * Math.PI / 3, r); },
      get count() { return vcount / 4; },
      build(material) {
        if (!vcount) return null;
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
        g.setAttribute('normal', new THREE.Float32BufferAttribute(Nn, 3));
        g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
        g.setIndex(I);
        g.computeBoundingSphere(); g.computeBoundingBox();
        const mesh = new THREE.Mesh(g, material);
        mesh.castShadow = false; mesh.receiveShadow = true;
        return mesh;
      },
    };
  }

  /** Ground-hugging subdivided plane over a rectangle following heightAt (+lift). UV = 0..1 over the rect. */
  function groundPatch(x0, x1, z0, z1, m, lift = 0.012, step = 0.5, hfn = null) {
    const L = ctx.L;
    const nx = Math.max(1, Math.round((x1 - x0) / step)), nz = Math.max(1, Math.round((z1 - z0) / step));
    const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0, nx, nz).rotateX(-Math.PI / 2);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i) + (x0 + x1) / 2, z = p.getZ(i) + (z0 + z1) / 2;
      p.setXYZ(i, x, (hfn ? hfn(x, z) : L.heightAt(x, z)) + lift, z);
    }
    g.computeVertexNormals();
    const mesh = new THREE.Mesh(g, m);
    mesh.receiveShadow = true;
    return mesh;
  }

  return { worldUV, rectPlane, beam, wall, railing, cards, groundPatch, cyl, cylZ };
}

/** Shelf-packed canvas atlas. items: [{id, w, h, draw(g,w,h)}]. Returns {tex, r(id), size}. */
export function makeAtlas(ctx, key, size, items, opts = {}) {
  const pad = opts.pad ?? 4;
  const rects = new Map();
  let x = pad, y = pad, rowH = 0;
  for (const it of items) {
    if (x + it.w + pad > size) { x = pad; y += rowH + pad; rowH = 0; }
    if (y + it.h + pad > size) throw new Error(`atlas ${key} overflow at ${it.id}`);
    rects.set(it.id, { x, y, w: it.w, h: it.h });
    x += it.w + pad; rowH = Math.max(rowH, it.h);
  }
  const tex = ctx.tex.draw(size, size, (g) => {
    if (opts.bg) { g.fillStyle = opts.bg; g.fillRect(0, 0, size, size); }
    for (const it of items) {
      const r = rects.get(it.id);
      g.save(); g.translate(r.x, r.y);
      g.beginPath(); g.rect(0, 0, r.w, r.h); g.clip();
      it.draw(g, r.w, r.h);
      g.restore();
    }
  }, { key });
  const uvr = (id) => {
    const r = rects.get(id); if (!r) throw new Error(`atlas ${key}: no item ${id}`);
    // tiny inset avoids bleeding from neighbours
    const e = 0.75;
    return { u0: (r.x + e) / size, u1: (r.x + r.w - e) / size, v1: 1 - (r.y + e) / size, v0: 1 - (r.y + r.h - e) / size, w: r.w, h: r.h };
  };
  return { tex, r: uvr, size };
}
