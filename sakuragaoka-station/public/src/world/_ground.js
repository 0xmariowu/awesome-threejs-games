// DEV-ONLY placeholder context for screenshots while real modules are being built.
// Flat-coloured terrain following heightAt + grey road strips + blocky platform/station/lot
// placeholders. NOT part of the final scene (not listed in main.js MODULES).
import * as L from './layout.js';

export function build(ctx) {
  const { THREE, mat } = ctx;
  const g = new THREE.Group(); g.name = '_ground'; ctx.addStatic(g);
  const k = ctx.kit(g);
  // terrain
  const size = 360, seg = 360;
  const geo = new THREE.PlaneGeometry(size, size, seg, seg).rotateX(-Math.PI / 2);
  const pos = geo.attributes.position; const col = new Float32Array(pos.count * 3);
  const cGrass = new THREE.Color('#9dbb7a'), cTown = new THREE.Color('#b9b3a4'), cRoad = new THREE.Color('#77797d'), cBall = new THREE.Color('#7c7a76'), cPlaza = new THREE.Color('#c9c7c0'), cWater = new THREE.Color('#7fa9c9');
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i) - 10;
    pos.setZ(i, z);
    pos.setY(i, L.heightAt(x, z));
    let c = (z > -34 && z < 130 && Math.abs(x) < 70) || (z < -52 && z > -84 && Math.abs(x) < 90) ? cTown : cGrass;
    if (z < -101 && z > -116) c = cWater;
    if (z <= -34 && z >= -52) c = cBall;
    const onR1 = z > 1 && Math.abs(x - L.streetCenterX(z)) < 3.0;
    const onR2 = Math.abs(x - L.ROADS.R2.x) < 2.75 && z < -5 && z > -88;
    const onR3 = Math.abs(z - L.ROADS.R3.z) < 3 && Math.abs(x) < 95;
    const onR4 = Math.abs(z - L.ROADS.R4.z) < 2 && Math.abs(x) < 95;
    const onR6 = Math.abs(z - L.ROADS.R6.z) < 1.5 && Math.abs(x) < 85;
    if (onR1 || onR2 || onR3 || onR4 || onR6) c = cRoad;
    if (x > L.PLAZA.x0 && x < L.PLAZA.x1 && z > L.PLAZA.z0 && z < L.PLAZA.z1) c = cPlaza;
    col.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.computeVertexNormals();
  const ground = new THREE.Mesh(geo, mat.toon('#ffffff', { vertexColors: true, paint: 0.03 }));
  ground.receiveShadow = true; g.add(ground);
  // platforms + station placeholders
  const pm = mat.toon('#c6c5be');
  for (const p of [L.PLATFORM.south, L.PLATFORM.north]) k.boxB(p.x1 - p.x0, L.PLATFORM.y - L.RAIL.groundY, p.z1 - p.z0, pm, [(p.x0 + p.x1) / 2, L.RAIL.groundY, (p.z0 + p.z1) / 2]);
  k.boxB(L.STATION.x1 - L.STATION.x0, 4.2, L.STATION.z1 - L.STATION.z0, mat.toon('#e9dfc8'), [(L.STATION.x0 + L.STATION.x1) / 2, 0, (L.STATION.z0 + L.STATION.z1) / 2]);
  // rails placeholder
  for (const z of [L.RAIL.zA, L.RAIL.zB]) for (const s of [-1, 1]) k.box(840, 0.15, 0.07, mat.toon('#9aa1a8'), [0, L.RAIL.railTopY - 0.075, z + s * L.RAIL.gauge / 2]);
  // lot placeholders (translucent-looking pale blocks)
  const lm = mat.toon('#ddd6c8');
  for (const lot of L.LOTS) {
    const f = L.lotFrame(lot);
    const b = new THREE.Mesh(ctx.geo.G.box(), lm);
    b.scale.set(f.w - 1.0, 2.8, 10); b.position.set(0, 1.4, -6.5);
    const grp = new THREE.Group(); grp.position.set(f.x, f.y, f.z); grp.rotation.y = f.rotY; grp.add(b); g.add(grp);
  }
  // walkable placeholders so the player can stand on the platforms
  for (const p of [L.PLATFORM.south, L.PLATFORM.north]) ctx.physics.addWalkBox((p.x0 + p.x1) / 2, (p.z0 + p.z1) / 2, p.x1 - p.x0, p.z1 - p.z0, 0, L.PLATFORM.y);
}
