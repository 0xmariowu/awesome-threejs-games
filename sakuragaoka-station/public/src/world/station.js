// 桜ヶ丘駅 — station building (inside + out), forecourt, both platforms with shelters and furniture,
// 駅名標, fences, platform ends, east ramps + 構内踏切 walkway, north exit, side / west yards.
// Publishes ctx.services.station = { benches: [{x,z,y,rotY,len}] }.
import * as THREE from 'three';
import { createUtil } from './station/util.js';
import { createStationTextures } from './station/tex.js';
import { createInteriorTextures } from './station/tex2.js';
import { makeMaterials } from './station/mats.js';
import { buildBuilding } from './station/building.js';
import { buildInterior } from './station/interior.js';
import { buildPlatforms } from './station/platforms.js';
import { buildYards } from './station/yards.js';

export async function build(ctx) {
  hideDevPlaceholders(ctx);
  const root = new THREE.Group(); root.name = 'station';
  ctx.addStatic(root);
  const dyn = new THREE.Group(); dyn.name = 'station-dynamic';

  const U = createUtil(ctx);
  const tx = createStationTextures(ctx);
  const tx2 = createInteriorTextures(ctx, tx);
  const M = makeMaterials(ctx, tx, tx2);
  const k = ctx.kit(root);
  const kd = ctx.kit(dyn);

  // ---- sign / board factory over the atlases
  const atlases = { signs: tx.signs, face: tx.face, misc: tx.misc, P: tx.P, B: tx.B, I: tx.I, TVM: tx.TVM, N: tx2.N };
  const smat = new Map();
  function signMat(name, lit) {
    const key = name + '|' + (lit || 0);
    if (!smat.has(key)) {
      const a = atlases[name];
      smat.set(key, lit ? ctx.mat.emissive('#ffffff', lit === true ? 0.92 : lit, { map: a.tex }) : ctx.mat.toon('#ffffff', { map: a.tex, paint: 0 }));
    }
    return smat.get(key);
  }
  /** textured plane (faces +Z before rotY) from an atlas item */
  function plane(name, id, w, h, pos, rotY = 0, lit = false, parent = root) {
    const m = new THREE.Mesh(U.rectPlane(w, h, atlases[name].r(id)), signMat(name, lit));
    m.position.set(pos[0], pos[1], pos[2]); m.rotation.y = rotY; m.receiveShadow = true; m.castShadow = false;
    parent.add(m); return m;
  }
  /** framed board: backing box (frame) + atlas face plane in front. pos = centre of the face. */
  function board(name, id, w, h, pos, rotY = 0, o = {}) {
    const g = new THREE.Group(); g.position.set(pos[0], pos[1], pos[2]); g.rotation.y = rotY; root.add(g);
    const kk = ctx.kit(g), d = o.depth ?? 0.03, b = o.border ?? 0.03;
    if (o.frame !== null) kk.box(w + b * 2, h + b * 2, d, o.frame || M.trim, [0, 0, -d / 2]);
    const m = new THREE.Mesh(U.rectPlane(w, h, atlases[name].r(id)), signMat(name, o.lit || false));
    m.position.z = 0.004; m.receiveShadow = true; g.add(m);
    if (o.back) { const m2 = new THREE.Mesh(U.rectPlane(w, h, atlases[name].r(o.back)), signMat(name, o.lit || false)); m2.position.z = -d - 0.004; m2.rotation.y = Math.PI; g.add(m2); }
    return g;
  }

  // ---- clocks (static face, animated hands). time 16:02 + t/60 like the HUD
  const clocks = [];
  function clock(pos, rotY, r = 0.2, o = {}) {
    const g = new THREE.Group(); g.position.set(...pos); g.rotation.y = rotY; root.add(g);
    const kk = ctx.kit(g);
    const faces = o.double ? [0, Math.PI] : [0];
    kk.cyl(r * 1.08, r * 1.08, o.double ? 0.09 : 0.05, o.frame || M.fascia, [0, 0, o.double ? 0 : -0.025], [Math.PI / 2, 0, 0], 28);
    for (const fy of faces) {
      const face = new THREE.Mesh(new THREE.CircleGeometry(r, 32), signMat('face', o.lit ? 0.9 : false));
      const uv = face.geometry.attributes.uv, rr = tx.face.r('clock');
      for (let i = 0; i < uv.count; i++) uv.setXY(i, rr.u0 + uv.getX(i) * (rr.u1 - rr.u0), rr.v0 + uv.getY(i) * (rr.v1 - rr.v0));
      const z = o.double ? 0.047 : 0.003;
      face.position.set(Math.sin(fy) * z, 0, Math.cos(fy) * z); face.rotation.y = fy; g.add(face);
      // hands (dynamic): pivot groups rotating about local z
      const hg = new THREE.Group(); hg.position.copy(g.position); hg.rotation.y = rotY + fy;
      const off = new THREE.Vector3(Math.sin(fy) * (z + 0.006), 0, Math.cos(fy) * (z + 0.006)).applyAxisAngle(new THREE.Vector3(0, 1, 0), rotY);
      hg.position.add(off); dyn.add(hg);
      const hour = new THREE.Group(), minute = new THREE.Group(); hg.add(hour); hg.add(minute);
      const hm = new THREE.Mesh(ctx.geo.G.box(), M.ink); hm.scale.set(r * 0.09, r * 0.55, 0.008); hm.position.y = r * 0.22; hour.add(hm);
      const mm = new THREE.Mesh(ctx.geo.G.box(), M.ink); mm.scale.set(r * 0.06, r * 0.82, 0.008); mm.position.set(0, r * 0.34, 0.006); minute.add(mm);
      const cap = new THREE.Mesh(ctx.geo.G.sphere(8), M.signRed); cap.scale.setScalar(r * 0.1); cap.position.z = 0.01; hg.add(cap);
      clocks.push({ hour, minute });
    }
    return g;
  }
  const blinkers = []; // {mesh, fn(t)->bool}
  const A = { ctx, THREE, L: ctx.L, P: ctx.physics, root, dyn, k, kd, U, M, tx, tx2, atlases, plane, board, clock, clocks, blinkers, signMat, benches: [] };

  buildBuilding(A);
  buildInterior(A);
  buildPlatforms(A);
  buildYards(A);
  bakeColors(ctx, root);

  ctx.add(dyn);
  ctx.services.station = { benches: A.benches.map(b => ({ x: b.x, z: b.z, y: b.y, rotY: b.rotY, len: b.len })) };

  // ---- per-frame: clock hands, warning / departure lights (pure functions of t)
  const TAU = Math.PI * 2;
  ctx.onUpdate((dt, t) => {
    const minutes = 2 + t / 60; // 16:02 at t=0
    const ma = -(minutes / 60) * TAU, ha = -((4 + minutes / 60) / 12) * TAU;
    for (const c of clocks) { c.minute.rotation.z = ma; c.hour.rotation.z = ha; }
    for (const b of blinkers) b.mesh.visible = !!b.fn(t);
  });
}

/** DEV only: the `_ground` placeholder module (built after us, only when the URL asks for it with
 *  ?only=_ground,...) draws a solid box where the station stands and two platform blocks coincident
 *  with our platforms. Pre-create its two cached materials invisible (and not batch-convertible, so
 *  the batcher keeps them separate) so shots show our real geometry. No-op in the real scene. */
function hideDevPlaceholders(ctx) {
  let only = null;
  try { only = new URLSearchParams(globalThis.location?.search || '').get('only'); } catch (e) { only = null; }
  if (!only || !only.split(',').map(s => s.trim()).includes('_ground')) return;
  for (const c of ['#e9dfc8', '#c6c5be']) {
    const m = ctx.mat.toon(c);
    m.visible = false;
    const obc = m.onBeforeCompile; m.onBeforeCompile = function (sh, r) { return obc.call(this, sh, r); };
  }
}

/** Collapse plain solid-colour toon materials into a few shared vertex-coloured ones (colour baked
 *  per vertex, linear). Same look, far fewer materials => far fewer draw calls after batching.
 *  Materials keep their emissive / flags (part of the signature); paint amount is bucketed. */
function bakeColors(ctx, root) {
  const optsOf = new Map();
  for (const [key, m] of ctx.mat.cache) {
    if (!key.startsWith('toon|')) continue;
    const i = key.indexOf('|', 5);
    try { optsOf.set(m, JSON.parse(key.slice(i + 1))); } catch (e) { /* ignore */ }
  }
  const targets = new Map();
  root.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || o.userData.dynamic) return;
    const m = o.material, op = optsOf.get(m);
    if (!op || op.map || op.alphaMap || op.transparent || op.alphaTest || op.vertexColors || op.side || op.polygonOffset || op.depthWrite === false || op.opacity != null) return;
    const paint = op.paint ?? 0.05;
    const sig = { ...op, paint: paint < 0.035 ? 0.025 : paint < 0.075 ? 0.05 : 0.09, vertexColors: true };
    delete sig.name;
    const key = JSON.stringify(sig);
    let tm = targets.get(key);
    if (!tm) targets.set(key, (tm = ctx.mat.toon('#ffffff', sig)));
    const g = o.geometry.clone();
    const n = g.attributes.position.count, a = new Float32Array(n * 3);
    for (let v = 0; v < n; v++) { a[v * 3] = m.color.r; a[v * 3 + 1] = m.color.g; a[v * 3 + 2] = m.color.b; }
    g.setAttribute('color', new THREE.BufferAttribute(a, 3));
    o.geometry = g; o.material = tm;
  });
}
