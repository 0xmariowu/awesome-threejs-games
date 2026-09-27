// shopsB instancing: repeated small goods (cans, bottles, snack bags, sweets, bowls, beads, keys,
// chopsticks, tyres…) are collected in each shop's local space and emitted at the end as ONE
// InstancedMesh per (shape, glow) for the whole module, in world space, coloured per instance.
// Interior instances get the same warm self-light as K.im() (emissive = warm * instanceColor * glow).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

const V2 = (p) => new THREE.Vector2(p[0], p[1]);
const lathe = (pts, seg) => new THREE.LatheGeometry(pts.map(V2), seg);

/** Soft pillow-shaped snack bag (unit: 1 wide (x), 1 tall (y), 1 thick (z) at the belly; bottom at y=0). */
function pillowGeo() {
  let g = new THREE.BoxGeometry(1, 1, 1, 3, 4, 1);
  g.deleteAttribute('normal'); g.deleteAttribute('uv');
  g = mergeVertices(g, 1e-4);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const ex = 1 - Math.pow(Math.abs(x) * 2, 2.2), ey = 1 - Math.pow(Math.abs(y) * 2, 3);
    const crimp = Math.max(0, Math.abs(y) * 2 - 0.84) / 0.16;          // flat sealed seams top & bottom
    const bz = Math.sign(z) * (0.12 + 0.38 * Math.max(0, ex) * Math.max(0, ey)) * (1 - crimp);
    p.setXYZ(i, x * (1 - 0.04 * crimp), y + 0.5, Math.abs(z) < 1e-6 ? 0 : bz + Math.sign(z) * 0.03 * (1 - crimp));
  }
  g.computeVertexNormals();
  g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(p.count * 2), 2));
  return g;
}

const SHAPES = {
  box: () => new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0),
  boxc: () => new THREE.BoxGeometry(1, 1, 1),
  rbox: () => new RoundedBoxGeometry(1, 1, 1, 1, 0.16).translate(0, 0.5, 0),
  pillow: pillowGeo,
  cyl: () => new THREE.CylinderGeometry(0.5, 0.5, 1, 8).translate(0, 0.5, 0),
  cyl16: () => new THREE.CylinderGeometry(0.5, 0.5, 1, 16).translate(0, 0.5, 0),
  cylc: () => new THREE.CylinderGeometry(0.5, 0.5, 1, 6),            // centred (rods, handles)
  stick: () => new THREE.CylinderGeometry(0.5, 0.5, 1, 5).translate(0, 0.5, 0),
  cup: () => new THREE.CylinderGeometry(0.5, 0.37, 1, 10).translate(0, 0.5, 0),
  cone: () => new THREE.CylinderGeometry(0.04, 0.5, 1, 10).translate(0, 0.5, 0),
  // PET bottle, unit height, radius 0.5
  bottle: () => lathe([[0, 0], [0.46, 0], [0.5, 0.06], [0.5, 0.58], [0.3, 0.76], [0.17, 0.86], [0.17, 0.9], [0, 0.9]], 7),
  // 1 L glass bottle (soy sauce / sake), long neck
  gbottle: () => lathe([[0, 0], [0.47, 0], [0.5, 0.05], [0.5, 0.56], [0.2, 0.74], [0.16, 0.96], [0.19, 1.0], [0, 1.0]], 8),
  sph: () => new THREE.SphereGeometry(0.5, 9, 6),
  ball: () => new THREE.SphereGeometry(0.5, 6, 4),
  // ramen / rice bowl: top radius 0.5, height 0.6, foot ring
  bowl: () => lathe([[0, 0.04], [0.21, 0.04], [0.23, 0], [0.26, 0.05], [0.42, 0.34], [0.5, 0.6], [0.46, 0.6], [0.3, 0.2], [0, 0.1]], 12),
  // plate: radius 0.5, height 0.12
  dish: () => lathe([[0, 0], [0.3, 0], [0.5, 0.1], [0.5, 0.12], [0.3, 0.05], [0, 0.05]], 12),
  // yunomi / tumbler: radius 0.5 top, height 1
  tumbler: () => lathe([[0, 0], [0.42, 0], [0.5, 1], [0.45, 1], [0.37, 0.1], [0, 0.1]], 10),
  disc: () => new THREE.CylinderGeometry(0.5, 0.5, 1, 10).translate(0, 0.5, 0),
  tyre: () => new THREE.TorusGeometry(0.5, 0.045, 5, 18),            // in XY plane, axis Z
  ring: () => new THREE.TorusGeometry(0.5, 0.03, 4, 16),
};

export function createInst(ctx, K) {
  const groups = new Map();
  const geos = new Map();
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
  const colCache = new Map();
  const col = (c) => { if (c && c.isColor) return c; let v = colCache.get(c); if (!v) colCache.set(c, (v = new THREE.Color(c))); return v; };

  function material(glow) {
    const m = ctx.mat.toon('#ffffff', glow ? { name: 'shopsB-inst', emissive: '#ffc58a', emissiveIntensity: glow, paint: 0.04 } : { name: 'shopsB-inst-out', paint: 0.04 });
    if (glow && !m.userData.sbPatched) {
      const base = m.onBeforeCompile;
      m.onBeforeCompile = (sh, r) => { base.call(m, sh, r); sh.fragmentShader = sh.fragmentShader.replace('vec3 totalEmissiveRadiance = emissive;', 'vec3 totalEmissiveRadiance = emissive * vColor.rgb;'); };
      m.customProgramCacheKey = () => 'paint-sbinst';
      m.userData.sbPatched = true;
    }
    return m;
  }

  const I = {
    /** Add one instance. parent: Object3D (already positioned); pos/rot/scale in parent space.
     *  o: { glow (default 0.3; 0 = exterior), shadow (cast, default false) } */
    add(shape, parent, pos, scale, color, rot = null, o = {}) {
      if (!SHAPES[shape]) throw new Error('inst: unknown shape ' + shape);
      const glow = o.glow ?? 0.3, sh = !!o.shadow;
      const key = shape + '|' + glow + '|' + sh;
      let gr = groups.get(key); if (!gr) groups.set(key, (gr = { shape, glow, sh, mats: [], cols: [] }));
      parent.updateWorldMatrix(true, false);
      _p.set(pos[0], pos[1], pos[2]);
      if (rot) _q.setFromEuler(_e.set(rot[0] || 0, rot[1] || 0, rot[2] || 0)); else _q.identity();
      if (typeof scale === 'number') _s.set(scale, scale, scale); else _s.set(scale[0], scale[1], scale[2]);
      _m.compose(_p, _q, _s);
      gr.mats.push(new THREE.Matrix4().multiplyMatrices(parent.matrixWorld, _m));
      gr.cols.push(col(color));
    },
    count() { let n = 0; for (const g of groups.values()) n += g.mats.length; return n; },
    finish() {
      const out = [];
      for (const gr of groups.values()) {
        let geo = geos.get(gr.shape); if (!geo) geos.set(gr.shape, (geo = SHAPES[gr.shape]()));
        const mesh = new THREE.InstancedMesh(geo, material(gr.glow), gr.mats.length);
        gr.mats.forEach((m, i) => { mesh.setMatrixAt(i, m); mesh.setColorAt(i, gr.cols[i]); });
        mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        mesh.castShadow = gr.sh; mesh.receiveShadow = true;
        mesh.name = 'shopsB-inst-' + gr.shape;
        mesh.computeBoundingSphere(); mesh.computeBoundingBox?.();
        ctx.addStatic(mesh); out.push(mesh);
      }
      groups.clear();
      return out;
    },
  };
  return I;
}
