import * as THREE from 'three';
import { Hit } from '../original/game/physics.js';

// Only scene data and query adapters live here. Collision response stays in Physics.
export function createPracticeWorld(scene) {
  const level = {
    blocks: [],
    faces: [{ origin: new THREE.Vector3(), u: new THREE.Vector3(1, 0, 0), v: new THREE.Vector3(0, 0, 1) }],
    spawnPads: [new THREE.Vector3(0, 0, -4), new THREE.Vector3(100, 0, 100)],
    spawnBarrier: 0,
    queryBlocks(x0, z0, x1, z1, out) {
      out.length = 0;
      for (const b of this.blocks) {
        if (b.aabbMax.x >= x0 && b.aabbMin.x <= x1 && b.aabbMax.z >= z0 && b.aabbMin.z <= z1) out.push(b.id);
      }
      return out;
    },
  };
  function box(x, y, z, width, height, depth, color, paintable = false) {
    const center = new THREE.Vector3(x, y, z), half = new THREE.Vector3(width / 2, height / 2, depth / 2);
    level.blocks.push({
      id: level.blocks.length, center, half, solid: true, grate: false,
      axes: [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)],
      aabbMin: center.clone().sub(half), aabbMax: center.clone().add(half),
      faces: [-1, -1, paintable ? 0 : -1, -1, -1, -1],
    });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), new THREE.MeshStandardMaterial({ color, roughness: .85 }));
    mesh.position.copy(center);
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    scene.add(mesh);
  }
  box(0, -.5, 12, 48, 1, 50, '#b7c7bd', true);
  box(0, 2, -12.5, 48, 4, 1, '#607e78');
  box(-24, 2, 12, 1, 4, 50, '#607e78');
  box(24, 2, 12, 1, 4, 50, '#607e78');
  box(0, 2, 37, 48, 4, 1, '#607e78');
  for (let i = 0; i < 5; i++) box(-7, (i + 1) * .15, 5 + i * 1.5, 4, (i + 1) * .3, 1.5, '#d6bc7c');
  box(8, 1.5, 12, 5, 3, 2, '#607e78');

  const grid = new THREE.GridHelper(48, 24, '#8a9f96', '#9eafa6');
  grid.position.set(0, .005, 12);
  scene.add(grid);
  // The orange lane and sample() describe exactly the same fixed own-ink region.
  const ink = new THREE.Mesh(new THREE.PlaneGeometry(6, 34), new THREE.MeshStandardMaterial({ color: '#ff8a14', roughness: .3 }));
  ink.rotation.x = -Math.PI / 2;
  ink.position.set(0, .012, 19);
  ink.receiveShadow = true;
  scene.add(ink);
  const paint = { sample: (face, x, z) => face === 0 && Math.abs(x) <= 3 && z >= 2 && z <= 36 ? 1 : 0 };
  const hit = new Hit(), origin = new THREE.Vector3(), down = new THREE.Vector3(0, -1, 0);
  return { level, paint, connectPhysics(physics) {
    level.groundHeight = (x, z, maxY) => {
      const result = physics.raycast(origin.set(x, maxY, z), down, 100, hit, true);
      return result.hit && result.normal.y > .68 ? result.point.y : -Infinity;
    };
  } };
}
