import { tr } from './i18n.js';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Controls } from '../original/input';
import { ISLANDS, SPECIES, type Vec } from '../original/simulation';
import { loadGame, saveGame } from '../original/storage';
import { createFixture } from './fixture';
import './style.css';
import './ui.css';

const world = document.querySelector<HTMLDivElement>('#world')!;
const labels = document.querySelector<HTMLDivElement>('#labels')!;
const status = document.querySelector<HTMLParagraphElement>('#status')!;
const counts = document.querySelector<HTMLParagraphElement>('#counts')!;
const names = { ray: tr({ zh: "云鳐", en: "Cloud ray" }), whale: tr({ zh: "天鲸", en: "Sky whale" }), moth: tr({ zh: "日光蛾", en: "Sun moth" }), koi: tr({ zh: "天锦鲤", en: "Sky koi" }), jelly: tr({ zh: "云水母", en: "Cloud jellyfish" }), bird: tr({ zh: "灯鸟", en: "Lantern bird" }) };
const modes = { roam: tr({ zh: "漫游", en: "Roaming" }), flock: tr({ zh: "结群", en: "Flocking" }), forage: tr({ zh: "觅食", en: "Foraging" }), flee: tr({ zh: "逃离", en: "Fleeing" }), capturing: tr({ zh: "捕获中", en: "Capturing" }) };
const colors = { roam: '#64898a', flock: '#417ab6', forage: '#d89721', flee: '#c65443', capturing: '#9262b7' };
let sim = loadGame() ?? createFixture();
let timeScale = 1, helpers = true;
let snapshot = {};
// Return detached data; automation cannot drive or mutate the simulation through this hook.
Object.defineProperty(window, '__example', { get: () => structuredClone(snapshot) });

async function boot() {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  world.append(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#c8e5e7');
  scene.fog = new THREE.Fog('#c8e5e7', 100, 240);
  scene.add(new THREE.HemisphereLight('#fff9ed', '#789b9d', 2.6));
  const sun = new THREE.DirectionalLight('#fff2d7', 2.7);
  sun.position.set(-35, 70, 40); scene.add(sun);
  const camera = new THREE.PerspectiveCamera(48, 1, .1, 500);
  const resize = () => {
    renderer.setSize(world.clientWidth, world.clientHeight);
    camera.aspect = world.clientWidth / Math.max(1, world.clientHeight);
    camera.updateProjectionMatrix();
  };
  window.addEventListener('resize', resize); resize();
  const loader = new GLTFLoader();
  const models = new Map<string, THREE.Group>();
  await Promise.all(['airship', 'ray', 'whale', 'moth', 'koi', 'jelly', 'food', 'pearl', 'island-distant', 'lighthouse-distant'].map(async name => {
    models.set(name, (await loader.loadAsync(`./assets/${name}.glb`)).scene);
  }));
  const clone = (name: string) => models.get(name)!.clone(true);
  const ship = clone('airship'); ship.scale.setScalar(1.13); scene.add(ship);
  for (const island of ISLANDS) {
    const model = clone(`${island.kind}-distant`);
    model.position.set(island.x, island.y, island.z);
    model.scale.setScalar(island.scale); model.rotation.y = island.rotation; scene.add(model);
  }
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(1000, 1000), new THREE.MeshLambertMaterial({ color: '#dbeded' }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -12; scene.add(floor);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(2.5, .06, 8, 48), new THREE.MeshBasicMaterial({ color: '#b77b28' }));
  ring.rotation.x = Math.PI / 2; scene.add(ring);
  const beam = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: '#9d61bd', depthTest: false }));
  beam.frustumCulled = false; scene.add(beam);
  const visuals = new Map<number, { model: THREE.Group; label?: HTMLSpanElement }>();
  const controls = new Controls(() => {});
  controls.enabled = true;
  let lost = false, last = performance.now(), accumulator = 0, lastSave = sim.time;
  let messageUntil = 0;
  const events: Record<string, number> = {};
  const persist = () => {
    if (!saveGame(sim)) { status.textContent = tr({ zh: "存档不可用，本次仍可游玩", en: "Saving unavailable; you can still play this session" }); status.hidden = false; }
  };
  window.addEventListener('pagehide', persist);
  document.addEventListener('visibilitychange', () => {
    accumulator = 0; last = performance.now();
    if (document.hidden) persist();
  });
  renderer.domElement.addEventListener('webglcontextlost', event => {
    event.preventDefault(); lost = true; controls.clear(); controls.enabled = false;
    status.hidden = false; status.textContent = tr({ zh: "画面已中断，请重新加载", en: "Rendering interrupted. Please reload" });
  });
  document.querySelector<HTMLButtonElement>('#slow')!.onclick = event => {
    timeScale = timeScale === 1 ? .25 : 1;
    (event.currentTarget as HTMLButtonElement).setAttribute('aria-pressed', String(timeScale !== 1));
    (event.currentTarget as HTMLButtonElement).blur();
  };
  document.querySelector<HTMLButtonElement>('#helpers')!.onclick = event => {
    helpers = !helpers;
    (event.currentTarget as HTMLButtonElement).setAttribute('aria-pressed', String(helpers));
    (event.currentTarget as HTMLButtonElement).blur();
  };
  document.querySelector<HTMLButtonElement>('#reset')!.onclick = event => {
    controls.clear(); controls.centerView(); sim = createFixture(); accumulator = 0;
    lastSave = 0; messageUntil = 0;
    for (const key of Object.keys(events)) delete events[key];
    persist(); (event.currentTarget as HTMLButtonElement).blur();
  };
  const point = new THREE.Vector3();
  function sync(id: number, name: string, pos: Vec, scale: number) {
    let visual = visuals.get(id);
    if (!visual) { visual = { model: clone(name) }; visuals.set(id, visual); scene.add(visual.model); }
    visual.model.position.set(pos.x, pos.y, pos.z); visual.model.scale.setScalar(scale);
    return visual;
  }
  function frame(now: number) {
    if (lost) return;
    const dt = Math.min((now - last) / 1000, .1) * timeScale; last = now;
    if (document.hidden) { accumulator = 0; requestAnimationFrame(frame); return; }
    accumulator += dt;
    while (accumulator >= 1 / 60) { sim.step(1 / 60, controls.read()); accumulator -= 1 / 60; }
    for (const event of sim.events.splice(0)) {
      events[event.type] = (events[event.type] ?? 0) + 1;
      const messages = { feed: tr({ zh: "种子已投出", en: "Seed thrown" }), eat: tr({ zh: `${names[event.species!]}吃到了种子`, en: `${names[event.species!]} ate a seed` }), capture: tr({ zh: `捕获${names[event.species!]} · 掉落 ${event.value} 金币`, en: `Captured ${names[event.species!]} · Dropped ${event.value} coins` }), respawn: tr({ zh: `${names[event.species!]}回到天空`, en: `${names[event.species!]} returned to the sky` }) };
      if (event.type in messages) { status.textContent = messages[event.type as keyof typeof messages]; messageUntil = sim.time + 2; }
    }
    if (sim.time - lastSave >= 1) { persist(); lastSave = sim.time; }
    ship.position.set(sim.pos.x, sim.pos.y, sim.pos.z);
    ship.rotation.set(sim.bodyPitch, sim.yaw, sim.bank, 'YXZ');
    const angle = sim.yaw + controls.view.orbitYaw;
    const elevation = .65 + controls.view.orbitPitch * .4;
    const radius = 64 * controls.view.distanceScale;
    const focus = point.set(sim.pos.x - Math.sin(sim.yaw) * 10, sim.pos.y + 3, sim.pos.z - Math.cos(sim.yaw) * 10);
    camera.position.set(focus.x + Math.sin(angle) * radius * Math.cos(elevation), focus.y + radius * Math.sin(elevation), focus.z + Math.cos(angle) * radius * Math.cos(elevation));
    camera.lookAt(focus); camera.updateMatrixWorld();
    const ids = new Set([...sim.creatures, ...sim.foods, ...sim.drops].map(item => item.id));
    for (const [id, visual] of visuals) if (!ids.has(id)) { scene.remove(visual.model); visual.label?.remove(); visuals.delete(id); }
    for (const c of sim.creatures) {
      const scale = SPECIES[c.species].scale * (1 + Math.min(c.fed, 7) * .055) * Math.max(.015, c.spawn) * Math.max(.015, (1 - c.capture) ** .7);
      const visual = sync(c.id, c.species, c.pos, scale);
      visual.model.rotation.y = c.yaw;
      if (!visual.label) { visual.label = document.createElement('span'); visual.label.className = 'label'; labels.append(visual.label); }
      point.set(c.pos.x, c.pos.y + 3.5 * scale, c.pos.z).project(camera);
      visual.label.hidden = !helpers || Math.abs(point.x) > 1 || Math.abs(point.y) > 1 || Math.abs(point.z) > 1;
      visual.label.style.left = `${(point.x + 1) * world.clientWidth / 2}px`;
      visual.label.style.top = `${(1 - point.y) * world.clientHeight / 2}px`;
      visual.label.style.setProperty('--state', colors[c.mode]);
      visual.label.textContent = `${names[c.species]} · ${modes[c.mode]}${c.capture ? ` ${Math.round(c.capture * 100)}%` : ''}`;
    }
    for (const food of sim.foods) sync(food.id, 'food', food.pos, 1);
    for (const drop of sim.drops) sync(drop.id, 'pearl', drop.pos, 1.2).model.rotation.y = sim.time * 2;
    const target = sim.creatures.find(c => c.id === sim.captureTarget) ?? sim.captureCandidate;
    ring.visible = !!target; beam.visible = sim.captureTarget !== undefined;
    if (target) {
      ring.position.set(target.pos.x, target.pos.y - 1, target.pos.z);
      const positions = beam.geometry.getAttribute('position') as THREE.BufferAttribute;
      const intake = sim.intake;
      positions.setXYZ(0, intake.x, intake.y, intake.z); positions.setXYZ(1, target.pos.x, target.pos.y, target.pos.z); positions.needsUpdate = true;
    }
    counts.textContent = tr({ zh: `生物 ${sim.creatures.length} · 喂食 ${sim.totalFed} · 捕获 ${sim.totalCaptured} · 金币 ${sim.pearls}${sim.respawns.length ? ` · 回归 ${Math.ceil(Math.min(...sim.respawns.map(s => s.delay)))}秒` : ''}`, en: `Creatures ${sim.creatures.length} · Fed ${sim.totalFed} · Captured ${sim.totalCaptured} · Coins ${sim.pearls}${sim.respawns.length ? ` · Return in ${Math.ceil(Math.min(...sim.respawns.map(s => s.delay)))} s` : ''}` });
    status.hidden = sim.time > messageUntil;
    snapshot = { ready: true, time: sim.time, timeScale, helpers, position: { ...sim.pos }, yaw: sim.yaw, speed: sim.speed, boosting: sim.boosting,
      creatures: sim.creatures.map(c => ({ ...c, pos: { ...c.pos } })), foods: sim.foods.map(f => ({ ...f })), drops: sim.drops.map(d => ({ ...d })),
      respawns: sim.respawns.map(s => ({ ...s })), totalFed: sim.totalFed, totalCaptured: sim.totalCaptured, pearls: sim.pearls,
      captureTarget: sim.captureTarget ?? null, captureCandidate: sim.captureCandidate?.id ?? null, events: { ...events } };
    renderer.render(scene, camera); requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
boot().catch(error => { status.hidden = false; status.textContent = tr({ zh: "场景加载失败，请重新构建后刷新", en: "Scene failed to load. Rebuild and refresh" }); console.error(error); });
