import { tr } from './i18n.js';
import * as THREE from 'three';
import { beginJob, stopWorkers } from './workers.js';
import { buildKid } from '../original/kid/model.js';
import { buildPerson } from '../original/people/model.js';

const $ = id => document.getElementById(id);
const scene = new THREE.Scene();
scene.background = new THREE.Color('#e8eee8');
const camera = new THREE.PerspectiveCamera(34, 1, 0.05, 30);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
$('world').append(renderer.domElement);
scene.add(new THREE.HemisphereLight(0xfff9e9, 0x627764, 2.5));
const sun = new THREE.DirectionalLight(0xfff4dd, 3.5);
sun.position.set(3, 5, 4); sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
Object.assign(sun.shadow.camera, { left: -2, right: 2, top: 3, bottom: -2, near: .1, far: 15 });
sun.shadow.bias = -.0002;
scene.add(sun);
const ground = new THREE.Mesh(new THREE.CircleGeometry(2.8, 80), new THREE.MeshStandardMaterial({ color: '#d1dfcf', roughness: 1 }));
ground.rotation.x = -Math.PI / 2; ground.position.y = -.018; ground.receiveShadow = true; scene.add(ground);
let character, job, generation = 0, ready = false, error = null, yaw = .15, distance = 4.1, wireframe = false;
let frames = 0, framesDuringBuild = 0, elapsed = 0, bounds = null;
function dispose(model) {
  if (!model) return;
  scene.remove(model.root);
  const geometries = new Set(), materials = new Set(), textures = new Set();
  model.root.traverse(o => {
    if (o.geometry) geometries.add(o.geometry);
    for (const m of (Array.isArray(o.material) ? o.material : o.material ? [o.material] : [])) materials.add(m);
  });
  for (const m of materials) {
    for (const v of Object.values(m)) if (v?.isTexture) textures.add(v);
    for (const group of Object.values(m.userData)) if (group && typeof group === 'object')
      for (const v of Object.values(group)) if (v?.value?.isTexture) textures.add(v.value);
    m.dispose();
  }
  for (const x of geometries) x.dispose();
  for (const x of textures) x.dispose();
  model.skeleton?.dispose();
}
function applyWireframe() {
  character?.root.traverse(o => { if (o.isMesh) o.material.wireframe = wireframe; });
}
function countWireframeMeshes() {
  let count = 0;
  character?.root.traverse(o => { if (o.isMesh && o.material.wireframe) count++; });
  return count;
}
async function generate() {
  const token = ++generation, id = $('character').value;
  job = beginJob(id);
  const ownJob = job;
  ready = false; error = null; framesDuringBuild = 0; bounds = null;
  $('status').textContent = tr({ zh: "后台生成中…", en: "Generating in the background…" });
  dispose(character); character = null;
  const start = performance.now();
  try {
    const result = await (id === 'kid' ? buildKid() : buildPerson(id));
    await Promise.all(ownJob.hashes);
    if (token !== generation) { dispose(result); return; }
    if (ownJob.errors.length || ownJob.completed !== ownJob.started || !ownJob.started) {
      dispose(result); throw new Error('Original worker pipeline failed');
    }
    character = result;
    scene.add(character.root);
    const box = new THREE.Box3().setFromObject(character.root);
    bounds = { min: box.min.toArray(), max: box.max.toArray() };
    applyWireframe(); elapsed = performance.now() - start; ready = true;
    $('status').textContent = tr({ zh: "生成完成", en: "Generation complete" });
  } catch (cause) {
    if (token !== generation) return;
    error = String(cause); stopWorkers();
    $('status').textContent = tr({ zh: "生成失败，请查看控制台", en: "Generation failed. Check the console" }); console.error(cause);
  }
}
$('character').addEventListener('change', generate);
$('generate').addEventListener('click', generate);
$('wireframe').addEventListener('click', () => {
  wireframe = !wireframe; applyWireframe(); $('wireframe').setAttribute('aria-pressed', String(wireframe));
});
let pointer = null;
renderer.domElement.addEventListener('pointerdown', e => { pointer = e.clientX; renderer.domElement.setPointerCapture(e.pointerId); });
renderer.domElement.addEventListener('pointermove', e => { if (pointer !== null) { yaw += (e.clientX - pointer) * .009; pointer = e.clientX; } });
for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) renderer.domElement.addEventListener(name, () => pointer = null);
renderer.domElement.addEventListener('wheel', e => { e.preventDefault(); distance = THREE.MathUtils.clamp(distance + e.deltaY * .003, 2.5, 6); }, { passive: false });
function resize() { renderer.setSize(document.querySelector('[data-demo-picture]').clientWidth, document.querySelector('[data-demo-picture]').clientHeight); camera.aspect = document.querySelector('[data-demo-picture]').clientWidth / document.querySelector('[data-demo-picture]').clientHeight; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();
Object.defineProperty(window, '__example', { get: () => ({
  schemaVersion: 1, ready, error, generation, character: job?.id, workerStarted: job?.started ?? 0,
  workerCompleted: job?.completed ?? 0, activeWorkers: job?.workers.size ?? 0,
  cancelledWorkers: job?.cancelled ?? 0, workerErrors: [...(job?.errors ?? [])],
  bytes: job?.bytes ?? 0, parts: structuredClone(job?.parts ?? {}), bounds,
  frames, framesDuringBuild, elapsed, yaw, distance, wireframe, wireframeMeshes: countWireframeMeshes(),
  triangles: character?.stats.tris ?? 0,
}) });
renderer.setAnimationLoop(now => {
  frames++; if (job?.workers.size) framesDuringBuild++;
  camera.position.set(Math.sin(yaw) * distance, 1.45, Math.cos(yaw) * distance);
  camera.lookAt(.18, .83, 0);
  $('pulse').style.transform = `rotate(${now * .18}deg)`;
  $('progress').max = job?.started || 1; $('progress').value = job?.completed || 0;
  $('stats').textContent = tr({ zh: `后台任务 ${job?.completed || 0}/${job?.started || 0}`, en: `Background tasks ${job?.completed || 0}/${job?.started || 0}` }) + (ready ? tr({ zh: ` · ${(elapsed / 1000).toFixed(2)} 秒 · ${Math.round(character.stats.tris).toLocaleString('zh-CN')} 三角面`, en: ` · ${(elapsed / 1000).toFixed(2)} s · ${Math.round(character.stats.tris).toLocaleString('zh-CN')} triangles` }) : '');
  renderer.render(scene, camera);
});
addEventListener('pagehide', () => { generation++; stopWorkers(); renderer.setAnimationLoop(null); dispose(character); renderer.dispose(); });
generate();
