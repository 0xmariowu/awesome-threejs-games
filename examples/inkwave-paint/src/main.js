import './i18n.js';
import * as THREE from 'three';
import { PaintSystem } from '../original/world/paint.js';
import { createLevelMaterial } from '../original/world/levelMaterial.js';
import { Level } from '../original/world/level.js';
import { Physics, Hit } from '../original/game/physics.js';
import { WeaponRunner, Projectiles } from '../original/game/weapons.js';
import { WEAPONS } from '../original/config.js';
import { G, on } from '../original/core/ctx.js';
import './style.css';
import './ui.css';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
const canvas = renderer.domElement;
document.querySelector('#world').append(canvas);
const scene = new THREE.Scene();
scene.background = new THREE.Color('#202b33');
const camera = new THREE.PerspectiveCamera(43, 1, 0.1, 100);
camera.position.set(12, 13, 18);
camera.lookAt(0, 0.8, 0);
scene.add(new THREE.HemisphereLight(0xf5f7ff, 0x79746a, 2.4));
const sun = new THREE.DirectionalLight(0xfff3dd, 3.2);
sun.position.set(-3, 10, 6);
scene.add(sun);
const box = (min, max, pattern) => ({ kind: 'box', min, max, pattern, color: '#d1d0c5' });
const level = new Level({
  bounds: { minX: -7, maxX: 7, minZ: -5, maxZ: 6 },
  spawnPads: [], spawnBarrier: 0, half: [],
  single: [box([-7, -0.5, -5], [7, 0, 6], 2),
    box([-7, 0, -5], [7, 4, -4.6], 3),
    box([-7, 0, -4.6], [-6.6, 3, 2], 3)],
});
const physics = new Physics(level);
const paint = new PaintSystem(renderer, level, { atlasSize: 1024, maxDensity: 30 });
const material = createLevelMaterial(paint.texture, paint.size, null, { paint });
const surfaces = new THREE.Mesh(level.buildGeometry(paint.size), material);
scene.add(surfaces);
const colors = ['#ff8a14', '#2f5bff'];
const projectiles = new Projectiles(scene);
Object.assign(G, { renderer, scene, camera, level, paint, physics, projectiles,
  teamColors: colors.map(color => new THREE.Color(color)), mode: 'match' });

// A stationary muzzle fixture supplies the original weapon's actor contract.
// Animation, audio, combat targets and score rewards are outside this paint lab.
const actor = {
  pos: new THREE.Vector3(0, 0, 5), aimPoint: new THREE.Vector3(0, 0, 0),
  aimDir: new THREE.Vector3(0, 0, -1), team: 0, color: G.teamColors[0],
  weapon: WEAPONS.shooter, ink: 100, grounded: true, isLocal: true, form: 'kid',
  character: { trigger() {}, getMuzzle(out) { return out.copy(actor.pos).add(new THREE.Vector3(0, 1.05, 0)); } },
  addTurf() {},
};
actor.weaponRunner = new WeaponRunner(actor);
const turret = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.4, 0.8, 16),
  new THREE.MeshStandardMaterial({ color: colors[0], roughness: 0.3 }));
turret.position.copy(actor.pos).y = 0.4;
scene.add(turret);
const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 0.65, 12).rotateX(Math.PI / 2), turret.material);
barrel.position.copy(actor.pos).y = 1.05;
scene.add(barrel);
const target = new THREE.Mesh(new THREE.RingGeometry(0.12, 0.17, 32),
  new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false, side: THREE.DoubleSide }));
target.renderOrder = 10;
scene.add(target);

const floor = level.faces.find(f => f.block === 0 && f.turf);
const wall = level.faces.find(f => f.block === 1 && f.n.z > 0.9);
const mapViews = [[floor, document.querySelector('#map')], [wall, document.querySelector('#wall-map')]];
for (const [face, map] of mapViews) { map.width = face.nu; map.height = face.nv; }
let mapVersion = -1;
function updateMaps() {
  if (mapVersion === paint.version) return;
  mapVersion = paint.version;
  for (const [face, map] of mapViews) {
    const context = map.getContext('2d');
    for (let j = 0; j < face.nv; j++) for (let i = 0; i < face.nu; i++) {
      const k = face.grid + j * face.nu + i;
      context.fillStyle = paint.dead[k] ? '#26343d' : ['#657078', ...colors][paint.grid[k]];
      context.fillRect(i, face.wall ? face.nv - j - 1 : j, 1, 1);
    }
  }
  paint.coverage().forEach((value, i) => {
    const name = i ? 'blue' : 'orange';
    document.querySelector(`#${name}`).textContent = `${(value * 100).toFixed(1)}%`;
    document.querySelector(`#${name}-bar`).style.width = `${value * 100}%`;
  });
}

let firing = false, aiming = false, shots = 0, impacts = 0, lastImpact = null;
const ray = new THREE.Raycaster(), hit = new Hit();
function aim(event) {
  const rect = canvas.getBoundingClientRect();
  ray.setFromCamera(new THREE.Vector2((event.clientX - rect.left) / rect.width * 2 - 1,
    1 - (event.clientY - rect.top) / rect.height * 2), camera);
  physics.raycast(ray.ray.origin, ray.ray.direction, 100, hit);
  aiming = hit.hit && hit.face >= 0 && !!level.faces[hit.face].atlas;
  target.visible = aiming;
  if (!aiming) return;
  actor.aimPoint.copy(hit.point);
  actor.aimDir.copy(hit.point).sub(barrel.position).normalize();
  barrel.lookAt(hit.point);
  target.position.copy(hit.point).addScaledVector(hit.normal, 0.03);
  target.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), hit.normal);
}
canvas.addEventListener('pointermove', aim);
canvas.addEventListener('pointerdown', event => {
  if (event.button !== 0) return;
  aim(event); firing = true; canvas.setPointerCapture(event.pointerId);
});
const release = () => { firing = false; };
for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) canvas.addEventListener(event, release);
window.addEventListener('blur', release);
document.addEventListener('visibilitychange', release);
canvas.addEventListener('pointerleave', () => { if (!firing) { aiming = false; target.visible = false; } });
for (const button of document.querySelectorAll('[data-team]')) button.addEventListener('click', () => {
  // Clear in-flight shots before changing their shared owner's team/color.
  projectiles.clear(); actor.weaponRunner.reset();
  actor.team = Number(button.dataset.team); actor.color = G.teamColors[actor.team];
  turret.material.color.copy(actor.color);
  for (const item of document.querySelectorAll('[data-team]')) item.setAttribute('aria-pressed', String(item === button));
});
document.querySelector('#clear').addEventListener('click', () => {
  release(); projectiles.clear(); actor.weaponRunner.reset(); paint.clear();
  shots = impacts = 0; lastImpact = null;
});
on('weapon:fire', () => { shots++; });
on('weapon:impact', event => {
  impacts++;
  lastImpact = { point: event.pos.toArray(), normal: event.normal.toArray(), team: event.team };
});

function resize() {
  renderer.setSize(document.querySelector('[data-demo-picture]').clientWidth, document.querySelector('[data-demo-picture]').clientHeight);
  camera.aspect = document.querySelector('[data-demo-picture]').clientWidth / document.querySelector('[data-demo-picture]').clientHeight;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();
target.visible = false;
let previous = performance.now(), accumulator = 0, frames = 0;
function frame(now) {
  const dt = document.hidden ? 0 : Math.min((now - previous) / 1000, 0.1);
  previous = now; accumulator += dt;
  while (accumulator >= 1 / 60) {
    actor.ink = 100; // Unlimited ink in the lab; weapon cadence and ballistics stay original.
    actor.weaponRunner.update(1 / 60, { fire: firing && aiming });
    projectiles.update(1 / 60);
    accumulator -= 1 / 60;
  }
  paint.flush(dt);
  G.time += dt; material.userData.uniforms.uTime.value = G.time;
  updateMaps(); renderer.render(scene, camera); frames++;
}
renderer.setAnimationLoop(frame);

// Read-only evidence: CPU ownership and actual atlas pixel readback, never paint injection.
function probe(faceId, point) {
  const face = level.faces[faceId], p = new THREE.Vector3(...point);
  const relative = p.clone().sub(face.origin), a = face.atlas;
  const x = Math.floor(a.x + a.pad + relative.dot(face.u) * a.ppm);
  const y = Math.floor(a.y + a.pad + relative.dot(face.v) * a.ppm);
  const pixel = new Uint8Array(4);
  renderer.readRenderTargetPixels(paint.rt, x, y, 1, 1, pixel);
  return { cpu: paint.sampleWorld(faceId, p), gpu: Array.from(pixel) };
}
function faceCounts(face) {
  const counts = [0, 0];
  for (let k = face.grid; k < face.grid + face.nu * face.nv; k++) if (paint.grid[k] && !paint.dead[k]) counts[paint.grid[k] - 1]++;
  return counts;
}
Object.defineProperty(window, '__example', { get: () => ({
  ready: frames > 1, frames, team: actor.team, shots, impacts, lastImpact,
  coverage: paint.coverage(), counts: [...paint.counts], turfTotal: paint.turfTotal,
  floor: { id: floor.id, counts: faceCounts(floor) }, wall: { id: wall.id, counts: faceCounts(wall) },
  growing: paint.growing.length, projectiles: projectiles.list.length,
  aim: aiming ? { face: hit.face, point: hit.point.toArray() } : null,
  probe,
  project(point) {
    const p = new THREE.Vector3(...point).project(camera);
    return { x: (p.x + 1) * document.querySelector('[data-demo-picture]').clientWidth / 2, y: (1 - p.y) * document.querySelector('[data-demo-picture]').clientHeight / 2 };
  },
}) });
addEventListener('pagehide', () => {
  renderer.setAnimationLoop(null); paint.dispose();
  scene.traverse(object => { object.geometry?.dispose();
    if (object.material) for (const mat of [].concat(object.material)) mat.dispose(); });
  renderer.dispose();
});
