// Pre-merge the railway's static meshes per material into corridor-long meshes.
// The corridor is 840 m long but thin; its non-instanced geometry is cheap in triangles, so one
// long mesh per material (which the core batcher then files into its single "large objects" cell
// and colour-bakes together with the other large meshes) costs far fewer draw calls than dozens of
// 48 m cells. Instanced meshes, dynamic objects and noBatch meshes are left untouched.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

function normalise(o, inv) {
  const g = o.geometry.clone();
  if (!g.attributes.normal) g.computeVertexNormals();
  const n = g.attributes.position.count;
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
  const keepColor = !!o.material.vertexColors;
  if (keepColor && !g.attributes.color) g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3).fill(1), 3));
  for (const name of Object.keys(g.attributes)) {
    if (name === 'position' || name === 'normal' || name === 'uv' || (keepColor && name === 'color')) continue;
    g.deleteAttribute(name);
  }
  for (const name of Object.keys(g.attributes)) {
    const at = g.attributes[name];
    if (at.isInterleavedBufferAttribute || at.normalized || !(at.array instanceof Float32Array)) {
      const a = new Float32Array(at.count * at.itemSize);
      for (let i = 0; i < at.count; i++) for (let j = 0; j < at.itemSize; j++) a[i * at.itemSize + j] = at.getComponent(i, j);
      g.setAttribute(name, new THREE.BufferAttribute(a, at.itemSize));
    }
  }
  if (!g.index) { const idx = new Uint32Array(n); for (let i = 0; i < n; i++) idx[i] = i; g.setIndex(new THREE.BufferAttribute(idx, 1)); }
  g.clearGroups();
  g.morphAttributes = {};
  const m = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
  g.applyMatrix4(m);
  if (m.determinant() < 0) { const ia = g.index.array; for (let i = 0; i < ia.length; i += 3) { const t = ia[i + 1]; ia[i + 1] = ia[i + 2]; ia[i + 2] = t; } }
  return g;
}

/** Merge every plain static mesh under root by (material, layer, shadow flags, renderOrder). */
export function premerge(root) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const groups = new Map();
  root.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || o.userData.noBatch || o.userData.dynamic) return;
    if (Array.isArray(o.material) || !o.geometry?.attributes.position) return;
    const key = `${o.material.uuid}|${o.layers.mask}|${o.castShadow ? 1 : 0}${o.receiveShadow ? 1 : 0}|${o.renderOrder}|${o.frustumCulled ? 1 : 0}`;
    let g = groups.get(key); if (!g) groups.set(key, (g = []));
    g.push(o);
  });
  let meshes = 0, sources = 0;
  const out = [];
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    const geos = list.map(o => normalise(o, inv));
    const mg = mergeGeometries(geos, false);
    for (const g of geos) g.dispose();
    if (!mg) continue;
    mg.computeBoundingBox(); mg.computeBoundingSphere();
    const s = list[0];
    const mesh = new THREE.Mesh(mg, s.material);
    mesh.castShadow = s.castShadow; mesh.receiveShadow = s.receiveShadow; mesh.layers.mask = s.layers.mask;
    mesh.renderOrder = s.renderOrder; mesh.frustumCulled = s.frustumCulled;
    mesh.name = 'rw-merged';
    out.push(mesh);
    for (const o of list) o.parent && o.parent.remove(o);
    meshes++; sources += list.length;
  }
  for (const m of out) root.add(m);
  // drop now-empty groups
  const empties = [];
  root.traverse((o) => { if (o !== root && !o.isMesh && o.children.length === 0 && !o.userData.dynamic) empties.push(o); });
  for (const e of empties) e.parent && e.parent.remove(e);
  return { meshes, sources };
}
