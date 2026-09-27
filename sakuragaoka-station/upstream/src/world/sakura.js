// 桜 — every cherry tree in the town: the big plaza tree, the W3 garden tree arching over the main
// street, the shrine's weeping cherry, station/platform trees, the rows along the railway corridor,
// the levee (桜堤) rows, roadside pit trees and garden trees.  Seeded + procedural (see sakura/tree.js).
//
// Publishes ctx.services.sakura = { trees: [{ x, z, y, r, h, id, kind, trunk:{x,z,r}, ground, bottom }] }
//   x,z = canopy centre, y = canopy centre height, r = canopy radius, h = tree height above ground.
import * as THREE from 'three';
import { createSakuraTextures } from './sakura/textures.js';
import { createSakuraMaterials } from './sakura/materials.js';
import { makeTree } from './sakura/tree.js';
import { makePlacements } from './sakura/placements.js';
import { createBaseBuilder } from './sakura/bases.js';
import { createNoise } from './sakura/util.js';

export async function build(ctx) {
  const L = ctx.L;
  const T = createSakuraTextures(ctx);
  const M = createSakuraMaterials(ctx, T);
  const noise = createNoise(ctx.rng('sakura-noise'));
  const env = { rng: ctx.rng, noise, heightAt: L.heightAt };
  const { trees: specs } = makePlacements(ctx);

  const root = new THREE.Group(); root.name = 'sakura';
  const bases = createBaseBuilder(ctx, M);
  const published = [];
  const stats = { trees: 0, bark: 0, blob: 0, cards: 0 };
  const blobCells = new Map();

  for (const spec of specs) {
    let t;
    try { t = makeTree(spec, env); } catch (e) { console.warn('[sakura] tree failed', spec.id, e); continue; }
    const tree = { spec, ...t };
    const g = new THREE.Group(); g.name = 'sakura-' + spec.id;
    const barkGeo = t.bark.build(false);
    if (barkGeo) { const m = new THREE.Mesh(barkGeo, spec.bark === 'young' ? M.barkYoung : M.barkOld); m.castShadow = true; m.receiveShadow = true; g.add(m); }
    // blossom masses stay on the outline layer (they hide background edges and give the crown its
    // contour); their `normal` is the smooth canopy envelope so only real silhouettes / gaps / deep folds
    // get lines, while the full shading normal rides in uv + colour.b (see canopy.js / materials.js).
    // They are merged per 48 m cell here (not by the core batcher) to keep the dappled shadow material.
    // Cards: no-outline layer (alpha cut-outs).
    const blobGeo = t.blob.build(true);
    if (blobGeo) {
      const c = blobGeo.boundingSphere.center, key = Math.floor(c.x / 48) + ',' + Math.floor(c.z / 48);
      (blobCells.get(key) || blobCells.set(key, []).get(key)).push(blobGeo);
    }
    const cardGeo = t.cards.build(true);
    if (cardGeo) { const m = new THREE.Mesh(cardGeo, M.cards); m.castShadow = true; m.receiveShadow = false; ctx.noOutline(m); g.add(m); }
    root.add(g);
    (stats.lod ??= {}); const lk = 'L' + (spec.lod ?? 0); (stats.lod[lk] ??= { n: 0, bark: 0, blob: 0, cards: 0 }); stats.lod[lk].n++; stats.lod[lk].bark += t.bark.tris; stats.lod[lk].blob += t.blob.tris; stats.lod[lk].cards += t.cards.tris;
    if (spec.id === 'plaza' || spec.id === 'w3') stats[spec.id] = { bark: t.bark.tris, blob: t.blob.tris, cards: t.cards.tris };
    stats.trees++; stats.bark += t.bark.tris; stats.blob += t.blob.tris; stats.cards += t.cards.tris;
    for (const c of t.colliders) ctx.physics.addCylinder(c.x, c.z, c.r, c.y0, c.y1);
    bases.build(tree);
    const I = t.info;
    published.push({
      id: spec.id, kind: spec.kind, x: +I.x.toFixed(2), z: +I.z.toFixed(2), y: +I.y.toFixed(2), r: +I.r.toFixed(2), h: +I.h.toFixed(2),
      bottom: +I.bottom.toFixed(2), ground: +t.groundY.toFixed(3), trunk: { x: spec.x, z: spec.z, r: spec.trunkR },
    });
  }
  for (const [key, list] of blobCells) {
    const geo = list.length > 1 ? ctx.geo.mergeGeometries(list, false) : list[0];
    if (!geo) continue;
    if (list.length > 1) for (const gg of list) gg.dispose();
    geo.computeBoundingSphere(); geo.computeBoundingBox();
    const m = new THREE.Mesh(geo, M.blob);
    m.name = 'sakura-mass-' + key; m.castShadow = true; m.receiveShadow = false;
    m.customDepthMaterial = M.blobDepth;
    ctx.noBatch(m);
    root.add(m);
  }
  const B = bases.finish();
  for (const m of B.meshes) root.add(m);
  root.add(B.group);
  ctx.addStatic(root);

  ctx.services.sakura = { trees: published };
  ctx.sakuraStats = { ...stats, bases: B.tris };
  if (globalThis.process?.env?.SAKURA_DEBUG) {
    console.log('[sakura stats]', JSON.stringify(ctx.sakuraStats), 'trees', specs.length);
    if (globalThis.process.env.SAKURA_DEBUG === 'trees') for (const t of published) console.log('[sakura tree]', t.id, t.kind, 'trunk', t.trunk.x.toFixed(1), t.trunk.z.toFixed(1), 'r', t.r, 'h', t.h);
  }
}
