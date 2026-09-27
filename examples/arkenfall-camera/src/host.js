import { tr } from './i18n.js';
import * as THREE from './three.js';
import createCamera from '../original/camera-CsWg7FPD.js';
import { r as fade } from './material-shim.js';

const world = document.querySelector('#world');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x91b4b5);
const camera = new THREE.PerspectiveCamera(60, 1, 0.08, 100);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
world.append(renderer.domElement);
scene.add(new THREE.HemisphereLight(0xe4f4e6, 0x405455, 2.4));
const sun = new THREE.DirectionalLight(0xffe6b6, 2.8);
sun.position.set(-5, 14, -8);
scene.add(sun);
const material = color => new THREE.MeshStandardMaterial({ color, roughness: 0.9 });
const stone = material(0x7a9291);
const ground = material(0x537c70);
const gold = material(0xeab963);
const playerMaterial = material(0x55d8c6);
playerMaterial.transparent = true;
function mesh(geometry, surface, x, y, z, parent = scene) {
  const object = new THREE.Mesh(geometry, surface);
  object.position.set(x, y, z);
  parent.add(object);
  return object;
}
mesh(new THREE.BoxGeometry(70, 0.2, 70), ground, 0, -0.1, 0);
const path = mesh(new THREE.TorusGeometry(6, 0.045, 6, 96), gold, 0, 0.025, 0);
path.rotation.x = Math.PI / 2;
for (let i = 0; i < 24; i++) {
  const angle = i * Math.PI / 12;
  mesh(new THREE.BoxGeometry(0.15, 0.03, 0.15), stone, Math.sin(angle) * 6, 0.03, Math.cos(angle) * 6);
}
function pawn(surface) {
  const group = new THREE.Group();
  mesh(new THREE.CylinderGeometry(0.28, 0.4, 1, 10), surface, 0, 0.85, 0, group);
  mesh(new THREE.SphereGeometry(0.26, 16, 12), surface, 0, 1.61, 0, group);
  mesh(new THREE.BoxGeometry(0.65, 0.16, 0.35), surface, 0, 1.2, 0, group);
  mesh(new THREE.BoxGeometry(0.17, 0.42, 0.22), surface, -0.18, 0.22, 0, group);
  mesh(new THREE.BoxGeometry(0.17, 0.42, 0.22), surface, 0.18, 0.22, 0, group);
  scene.add(group);
  return group;
}
const playerMesh = pawn(playerMaterial);
const targetMesh = pawn(gold);
playerMesh.scale.setScalar(0.85);
targetMesh.scale.setScalar(1.25);
mesh(new THREE.CylinderGeometry(0.8, 0.9, 0.15, 32), stone, 0, 0.075, 0);
targetMesh.position.y = 0.15;
const wall = mesh(new THREE.BoxGeometry(0.6, 4, 6), stone, -8.4, 2, -7);
// Camera-disabled trunks are handled by the original camera's own trunk solver.
const trunks = [{ kind: 'cyl', tag: 'trunk', camera: false, x: -10, z: 2, r: 0.65, y0: 0, y1: 5 }];
for (const trunk of trunks) {
  mesh(new THREE.CylinderGeometry(trunk.r, trunk.r, trunk.y1, 14), material(0x765b43), trunk.x, trunk.y1 / 2, trunk.z);
  mesh(new THREE.ConeGeometry(2.4, 4, 10), material(0x2b675b), trunk.x, 6.5, trunk.z);
}
const actor = { position: new THREE.Vector3(0, 0, -6), velocity: new THREE.Vector3(), yaw: 0 };
const target = { alive: true, height: 2.4, position: targetMesh.position,
  aimPoint(out) { return out.copy(this.position).add(new THREE.Vector3(0, 1.8, 0)); } };
const raycaster = new THREE.Raycaster();
scene.updateMatrixWorld(true);
const input = { look: { x: 0, y: 0 }, uiCapture: false, attach() {} };
const game = {
  camera, input, settings: { fov: 60, cameraShake: 1 }, time: { realDt: 1 / 60 },
  events: { on() {} }, player: { actor, grounded: true, state: 'idle' },
  enemies: { engagedCount: 0, boss: null },
  terrain: { heightAt: () => 0, waterHeightAt: () => null, caveFactorAt: () => 0 },
  physics: {
    raycast(origin, direction, distance, options) {
      raycaster.set(origin, direction);
      raycaster.near = 0; raycaster.far = distance;
      const hit = raycaster.intersectObject(wall, false)[0];
      // The only terrain is a flat floor, queried when the original requests it.
      const floorDistance = options?.terrain !== false && direction.y < -1e-8 ? -origin.y / direction.y : Infinity;
      if (floorDistance >= 0 && floorDistance <= distance && (!hit || floorDistance < hit.distance)) {
        return { distance: floorDistance, collider: null };
      }
      return hit ? { distance: hit.distance, collider: wall } : null;
    },
    queryRect(x0, z0, x1, z1, visit) {
      for (const trunk of trunks) if (trunk.x + trunk.r >= x0 && trunk.x - trunk.r <= x1 && trunk.z + trunk.r >= z0 && trunk.z - trunk.r <= z1) visit(trunk);
    },
  },
};
const rig = createCamera(game);
const keys = new Set();
let dragging = false;
let helpers = true;
let elapsed = 0;
const map = document.querySelector('#map');
const ctx = map.getContext('2d');
const reticle = document.querySelector('#reticle');
const projection = new THREE.Vector3();
function toggleLock() { rig.lockTarget = rig.lockTarget ? null : target; }
world.addEventListener('keydown', event => {
  if (['Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) event.preventDefault();
  if (event.code === 'Tab' && !event.repeat) toggleLock();
  keys.add(event.code);
});
window.addEventListener('keyup', event => keys.delete(event.code));
world.addEventListener('pointerdown', event => {
  event.preventDefault(); world.focus();
  if (event.button === 1) toggleLock();
  if (event.button === 0) { dragging = true; world.setPointerCapture(event.pointerId); }
});
world.addEventListener('pointermove', event => {
  if (dragging) { input.look.x += event.movementX; input.look.y += event.movementY; }
});
window.addEventListener('pointerup', () => { dragging = false; });
world.addEventListener('contextmenu', event => event.preventDefault());
function clearInput() { keys.clear(); dragging = false; input.look.x = input.look.y = 0; actor.velocity.set(0, 0, 0); }
window.addEventListener('blur', clearInput);
world.addEventListener('blur', clearInput);
document.addEventListener('visibilitychange', clearInput);
document.querySelector('#helpers').addEventListener('click', event => {
  helpers = !helpers; map.hidden = !helpers;
  event.currentTarget.setAttribute('aria-pressed', String(helpers)); world.focus();
});
document.querySelector('#reset').addEventListener('click', () => {
  clearInput(); actor.position.set(0, 0, -6); actor.yaw = 0; rig.lockTarget = null;
  rig.snapBehind(); world.focus();
});
const forward = new THREE.Vector3();
const right = new THREE.Vector3();
const proposed = new THREE.Vector3();
function move(dt) {
  const horizontal = Number(keys.has('KeyD') || keys.has('ArrowRight')) - Number(keys.has('KeyA') || keys.has('ArrowLeft'));
  const vertical = Number(keys.has('KeyW') || keys.has('ArrowUp')) - Number(keys.has('KeyS') || keys.has('ArrowDown'));
  // The player controller is a fixture. Locked strafing follows a circle exactly.
  // Camera yaw, pitch, distance, avoidance and recovery remain entirely original.
  if (rig.lockTarget) forward.copy(target.position).sub(actor.position).setY(0).normalize();
  else rig.forwardXZ(forward);
  right.set(-forward.z, 0, forward.x);
  actor.velocity.copy(forward).multiplyScalar(vertical).addScaledVector(right, horizontal);
  if (actor.velocity.lengthSq() > 0) actor.velocity.normalize().multiplyScalar(3);
  proposed.copy(actor.position).addScaledVector(actor.velocity, dt);
  if (rig.lockTarget && horizontal && !vertical) {
    const radius = Math.hypot(actor.position.x, actor.position.z);
    proposed.setY(0).setLength(radius);
  }
  // Keep the fixture within the arena and outside its visible obstacles.
  const wallBlocked = Math.abs(proposed.x + 8.4) < 0.65 && Math.abs(proposed.z + 7) < 3.35;
  const treeBlocked = trunks.some(t => Math.hypot(proposed.x - t.x, proposed.z - t.z) < t.r + 0.35);
  if (!wallBlocked && !treeBlocked && proposed.length() < 15 && proposed.length() > 1.5) actor.position.copy(proposed);
  else actor.velocity.set(0, 0, 0);
  if (rig.lockTarget) actor.yaw = Math.atan2(forward.x, forward.z);
  else if (actor.velocity.lengthSq()) actor.yaw = Math.atan2(actor.velocity.x, actor.velocity.z);
  game.player.state = actor.velocity.lengthSq() ? 'move' : 'idle';
}
function drawMap() {
  ctx.clearRect(0, 0, 220, 220);
  const x = value => 110 + value * 6.3;
  const z = value => 110 + value * 6.3;
  ctx.strokeStyle = '#668379'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(110, 110, 6 * 6.3, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#a9b9b4'; ctx.fillRect(x(-8.7), z(-10), 0.6 * 6.3, 6 * 6.3);
  ctx.fillStyle = '#e6efe8'; ctx.font = '12px system-ui'; ctx.fillText(tr({ zh: "墙", en: "Wall" }), x(-8.7) - 16, z(-7));
  ctx.fillText(tr({ zh: "树", en: "Tree" }), x(-10) - 18, z(2) + 4);
  ctx.fillStyle = '#729c6f'; ctx.beginPath(); ctx.arc(x(-10), z(2), 6, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = rig.dist < rig.wantDist - 0.5 ? '#ff9e69' : '#dfe9df';
  ctx.beginPath(); ctx.moveTo(x(actor.position.x), z(actor.position.z)); ctx.lineTo(x(camera.position.x), z(camera.position.z)); ctx.stroke();
  if (rig.wantDist - rig.dist > 0.15) {
    const missing = (rig.wantDist - rig.dist) * Math.cos(rig.pitch);
    const desiredX = camera.position.x - Math.sin(rig.yaw) * missing;
    const desiredZ = camera.position.z - Math.cos(rig.yaw) * missing;
    ctx.strokeStyle = '#ff9e69'; ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(x(camera.position.x), z(camera.position.z)); ctx.lineTo(x(desiredX), z(desiredZ)); ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath(); ctx.arc(x(desiredX), z(desiredZ), 3, 0, Math.PI * 2); ctx.stroke();
  }
  for (const [pos, color, radius] of [[target.position, '#ffcf76', 5], [actor.position, '#62e4ce', 5], [camera.position, '#ffffff', 3]]) {
    ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x(pos.x), z(pos.z), radius, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = '#e6efe8'; ctx.font = '12px system-ui'; ctx.fillText(tr({ zh: "青：角色   黄：目标   白：镜头", en: "Cyan: player · Gold: target · White: camera" }), 13, 204);
}
let snapshot;
Object.defineProperty(window, '__example', { get: () => snapshot });
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = document.hidden ? 0 : Math.min(0.05, (now - last) / 1000);
  last = now;
  if (!dt) return;
  elapsed += dt; move(dt); game.time.realDt = dt; rig.update();
  input.look.x = input.look.y = 0;
  playerMesh.position.copy(actor.position); playerMesh.rotation.y = actor.yaw;
  playerMaterial.opacity = fade.uFade.value;
  const width = world.clientWidth, height = world.clientHeight;
  if (renderer.domElement.width !== Math.round(width * renderer.getPixelRatio()) || renderer.domElement.height !== Math.round(height * renderer.getPixelRatio())) {
    renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix();
  }
  renderer.render(scene, camera);
  target.aimPoint(projection).project(camera);
  reticle.hidden = !rig.lockTarget || Math.abs(projection.x) > 1 || Math.abs(projection.y) > 1 || projection.z > 1;
  reticle.style.left = `${(projection.x + 1) * width / 2}px`;
  reticle.style.top = `${(1 - projection.y) * height / 2}px`;
  document.querySelector('#readout').textContent = tr({ zh: `${rig.lockTarget ? tr({ zh: "已锁定", en: "Locked on" }) : tr({ zh: "自由镜头", en: "Free camera" })} · 镜头距离 ${rig.dist.toFixed(1)} / ${rig.wantDist.toFixed(1)}${rig.dist < rig.wantDist - 0.5 ? tr({ zh: " · 避障中", en: " · Avoiding obstacles" }) : ''}`, en: `${rig.lockTarget ? tr({ zh: "已锁定", en: "Locked on" }) : tr({ zh: "自由镜头", en: "Free camera" })} · Camera distance ${rig.dist.toFixed(1)} / ${rig.wantDist.toFixed(1)}${rig.dist < rig.wantDist - 0.5 ? tr({ zh: " · 避障中", en: " · Avoiding obstacles" }) : ''}` });
  if (helpers) drawMap();
  snapshot = Object.freeze({
    ...rig.debugStats(), time: elapsed, helpers, lockDodge: rig.lockDodge,
    yaw: rig.yaw, pitch: rig.pitch, armLength: rig.dist, desiredArmLength: rig.wantDist,
    player: Object.freeze(actor.position.toArray()), camera: Object.freeze(camera.position.toArray()),
    targetNDC: Object.freeze(projection.toArray()), fade: fade.uFade.value,
  });
}
requestAnimationFrame(frame);
