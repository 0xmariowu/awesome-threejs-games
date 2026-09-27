// DEV ONLY: grey stand-ins for neighbours' props (bike, café board, vending machine, benches, wall)
// so isolated screenshots (?only=...,characters) show what the poses interact with. Never built in
// the real scene (no ?only= parameter) or when the owning module is part of the shot.
import * as THREE from 'three';

// Loaded ONLY as a pseudo-module in dev shots:  --only _ground,characters,characters/devprops
export function build(ctx) { devProps(ctx); }
let built = false;

export function devProps(ctx) {
  if (typeof location === 'undefined' || !location.search) return;
  const q = new URLSearchParams(location.search).get('only');
  if (!q || !q.includes('characters/devprops') || built) return;
  built = true;
  const has = (m) => q.split(',').includes(m);
  const L = ctx.L, S = L.SPOTS;
  const g = new THREE.Group(); g.name = 'charDevProps';
  const k = ctx.kit(g);
  const m = ctx.mat.toon('#a9aab4'), m2 = ctx.mat.toon('#8d8e9a');
  if (!has('vehicles')) {
    const b = S.crossingGirlBike, B = L.BIKE;
    const bg = k.group([b.x, L.heightAt(b.x, b.z), b.z], b.rotY); const bk = ctx.kit(bg);
    for (const z of [-B.wheelbase / 2, B.wheelbase / 2]) bk.mesh(new THREE.TorusGeometry(B.wheelR, 0.018, 6, 24), m2, [0, B.wheelR, z], [0, Math.PI / 2, 0]);
    bk.box(0.04, 0.04, 0.8, m, [0, 0.6, 0.1], [-0.35, 0, 0]);
    bk.box(0.04, 0.5, 0.04, m, [0, 0.62, -0.22]);
    bk.box(0.04, 0.55, 0.04, m, [0, 0.72, B.handlebar.z - 0.05], [-0.25, 0, 0]);
    bk.box(B.handlebar.halfW * 2, 0.03, 0.03, m, [0, B.handlebar.y, B.handlebar.z]);
    bk.box(0.16, 0.05, 0.24, m2, [0, B.saddle.y, B.saddle.z]);
    bk.box(0.34, 0.24, 0.26, m2, [0, B.basket.y, B.basket.z]);
  }
  if (!has('shopsA')) { // A-frame exactly like shopsA's P.aFrame (leaves splay from feet 0.2 m off-centre)
    const c = S.cafeBoard, rot = L.lotFrame(L.lotById('E1')).rotY + Math.PI / 2 - 0.4, ang = Math.atan2(0.2, 0.9);
    const bg = k.group([c.x, L.heightAt(c.x, c.z), c.z], rot);
    for (const s of [1, -1]) { const leaf = new THREE.Group(); leaf.position.set(0, 0, s * 0.2); leaf.rotation.x = s * ang; bg.add(leaf); ctx.kit(leaf).boxB(0.56, 0.9, 0.03, m, [0, 0, 0]); }
  }
  if (!has('props')) {
    for (const v of L.VENDING.filter(v => v.id === 'V1a' || v.id === 'V1b')) k.boxB(1.0, 1.83, 0.75, m, [v.x, L.heightAt(v.x, v.z), v.z], [0, v.rotY, 0]);
    const vb = S.v5Bench; k.boxB(0.4, vb.seatY, vb.len, m2, [vb.x, 0, vb.z]);
  }
  if (!has('station')) { const bn = L.PLATFORM.benchB1; k.boxB(1.6, 0.44, 0.42, m2, [bn.x, L.PLATFORM.y, bn.z - 0.05]); }
  if (!has('plaza')) {
    const t = L.PLAZA.tree; const r = t.benchR;
    k.mesh(new THREE.CylinderGeometry(r + 0.22, r + 0.22, 0.06, 40, 1, true), m2, [t.x, S.plazaBenchSeatY - 0.03, t.z]);
    k.mesh(new THREE.RingGeometry(r - 0.22, r + 0.22, 40).rotateX(-Math.PI / 2), m2, [t.x, S.plazaBenchSeatY, t.z]);
  }
  if (!has('houses')) {
    const lot = L.lotById('W3'), f = L.lotFrame(lot), w = S.w3Wall;
    const wg = k.group([f.x, f.y, f.z], f.rotY); ctx.kit(wg).boxB(w.lx1 - w.lx0, w.h, 0.15, m, [(w.lx0 + w.lx1) / 2, 0, w.lz]);
  }
  ctx.addStatic(g);
}
