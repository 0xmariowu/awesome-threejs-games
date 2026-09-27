import { tr } from './i18n.js';
import { s as THREE } from '../original/three.module-e53_FFk2.js';
import { build as buildControls } from '../original/controls-DX7CeMlr.js';
import { build as buildTour } from '../original/tour-Do76daLD.js';

const modeNames = { walk: tr({ zh: "步行", en: "Walk" }), fly: tr({ zh: "飞行", en: "Fly" }), tour: tr({ zh: "自动导览", en: "Auto tour" }) };
const moveNames = { push: tr({ zh: "推进", en: "Push in" }), pull: tr({ zh: "后拉", en: "Pull back" }), orbit: tr({ zh: "环绕", en: "Orbit" }), crane: tr({ zh: "升降", en: "Crane" }), truck: tr({ zh: "横移", en: "Truck" }) };
let timeScale = 1;

async function boot() {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.setSize(document.querySelector('[data-demo-picture]').clientWidth, document.querySelector('[data-demo-picture]').clientHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  document.querySelector('#world').append(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#a8b3ad');
  scene.fog = new THREE.Fog('#a8b3ad', 280, 950);
  scene.add(new THREE.HemisphereLight('#fff2d5', '#34494c', 2.5));
  const sun = new THREE.DirectionalLight('#ffe3ab', 3);
  sun.position.set(-80, 160, 90);
  scene.add(sun);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(2400, 2400), new THREE.MeshStandardMaterial({ color: '#69776b', roughness: 1 }));
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);
  const grid = new THREE.GridHelper(1800, 90, '#bdbaa0', '#819080');
  grid.position.y = 0.03;
  scene.add(grid);

  // Host geometry gives parallax and scale; these are not recreated game assets.
  const stone = new THREE.MeshStandardMaterial({ color: '#c8bea3', roughness: 0.95 });
  const darkStone = new THREE.MeshStandardMaterial({ color: '#475957', roughness: 1 });
  const landmarks = [];
  const sites = [
    { id: 'stair', x: 0, z: 0, radius: 40, color: '#caa871' },
    { id: 'observatory', x: -190, z: -180, radius: 34, color: '#83aeb0' },
    { id: 'isles', x: 190, z: -220, radius: 38, color: '#b19b84' },
    { id: 'wardens', x: -30, z: -440, radius: 40, color: '#b7b49a' },
  ];
  sites.forEach((site, index) => {
    const group = new THREE.Group();
    group.position.set(site.x, 0, site.z);
    for (const x of [-23, 23]) {
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(12, 65 + index * 12, 14), stone);
      pillar.position.set(x, (65 + index * 12) / 2, 0);
      group.add(pillar);
    }
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(68, 10, 18), darkStone);
    lintel.position.y = 64 + index * 12;
    group.add(lintel);
    const marker = new THREE.Mesh(new THREE.TorusGeometry(13, 1.2, 8, 48), new THREE.MeshStandardMaterial({ color: site.color, emissive: site.color, emissiveIntensity: 0.25 }));
    marker.position.set(0, 34 + index * 8, 0);
    group.add(marker);
    scene.add(group);
    landmarks.push({ site, object: group, viewpoints: [
      { label: 'establishing', pos: [site.x + 65, 45, site.z + 135], look: [site.x, 35, site.z] },
      { label: 'dramatic', pos: [site.x - 100, 25, site.z - 70], look: [site.x, 48, site.z] },
    ] });
  });
  for (let i = 0; i < 16; i++) {
    const block = new THREE.Mesh(new THREE.BoxGeometry(5, 3, 5), darkStone);
    block.position.set(i % 2 ? -42 : 42, 1.5, 170 - Math.floor(i / 2) * 25);
    scene.add(block);
  }

  const camera = new THREE.PerspectiveCamera(55, document.querySelector('[data-demo-picture]').clientWidth / document.querySelector('[data-demo-picture]').clientHeight, 0.1, 1800);
  camera.position.set(85, 48, 170);
  camera.lookAt(0, 30, 0);
  const listeners = new Map();
  const events = {
    on(name, callback) {
      if (!listeners.has(name)) listeners.set(name, []);
      listeners.get(name).push(callback);
    },
    emit(name, value) { for (const callback of listeners.get(name) || []) callback(value); },
  };
  const ctx = {
    canvas: renderer.domElement, camera, scene, events, landmarks,
    params: { fov: 55 }, camState: { mode: 'fly' },
    layout: {
      WORLD: { playRadius: 850, maxAltitude: 400, waterLevel: -10 },
      LAKE: { x: 0, z: 0, radius: 100 },
      SPAWN: { position: [85, 0, 150], heightAboveGround: 52, lookAt: [0, 30, 0] },
    },
    heightAt: () => 0, surfaceAt: () => 0, slopeAt: () => 0,
    env: { hour: 17, sunDir: sun.position.clone().normalize(), apply() {}, setHour(hour) { this.hour = hour; } },
  };
  const controls = await buildControls(ctx);
  const tour = await buildTour(ctx);
  const updates = [controls, tour].sort((a, b) => a.order - b.order);
  document.querySelectorAll('[data-mode]').forEach(button => {
    button.addEventListener('click', () => {
      if (button.dataset.mode === 'tour') ctx.tour.start();
      else ctx.cam.setMode(button.dataset.mode);
      button.blur();
    });
  });
  document.querySelector('#slow').addEventListener('click', event => {
    timeScale = timeScale === 1 ? 0.25 : 1;
    event.currentTarget.setAttribute('aria-pressed', String(timeScale !== 1));
    event.currentTarget.blur();
  });
  window.addEventListener('resize', () => {
    renderer.setSize(document.querySelector('[data-demo-picture]').clientWidth, document.querySelector('[data-demo-picture]').clientHeight);
    camera.aspect = document.querySelector('[data-demo-picture]').clientWidth / document.querySelector('[data-demo-picture]').clientHeight;
    camera.updateProjectionMatrix();
  });
  const samples = [];
  let frame = 0, time = 0, previous = performance.now();
  // Read-only snapshots for tests; input always goes through the original modules.
  window.__example = { ready: true, state: null, samples };
  function animate(now) {
    const dt = Math.max(0, Math.min((now - previous) / 1000, 1 / 30)) * timeScale;
    previous = now;
    time += dt;
    for (const update of updates) update.update(dt);
    const info = ctx.tour.info();
    const stops = ctx.tour.stops || [];
    const stop = stops.find(stop => stop.key === info?.key);
    const state = {
      frame: ++frame, time, dt, timeScale, mode: ctx.cam.mode,
      position: camera.position.toArray(), quaternion: camera.quaternion.toArray(),
      fov: camera.fov, velocity: ctx.cam.velocity.toArray(),
      grounded: ctx.cam.grounded, locked: ctx.cam.locked,
      tourActive: ctx.tour.active, tour: info, move: stop?.move.type || null,
      stops: stops.map(stop => ({ key: stop.key, move: stop.move.type, position: stop.pos.toArray() })),
    };
    window.__example.state = state;
    samples.push({ ...state, stops: undefined });
    if (samples.length > 900) samples.shift();
    document.querySelector('#mode').textContent = modeNames[state.mode];
    document.querySelector('#motion').textContent = info ? (info.type === 'transit' ? tr({ zh: "镜头交接中", en: "Camera handoff in progress" }) : tr({ zh: `导览 · ${moveNames[state.move]}`, en: `Tour · ${moveNames[state.move]}` })) : state.mode === 'walk' && !state.grounded ? tr({ zh: "平滑降落中", en: "Landing smoothly" }) : tr({ zh: "自由探索", en: "Free exploration" });
    document.querySelector('#height').textContent = tr({ zh: `高度 ${camera.position.y.toFixed(1)} 米`, en: `Altitude ${camera.position.y.toFixed(1)} m` });
    document.querySelectorAll('[data-mode]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.mode === state.mode)));
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }
  requestAnimationFrame(animate);
}

boot().catch(error => {
  const message = document.querySelector('#error');
  message.hidden = false;
  message.textContent = tr({ zh: "场景加载失败，请确认浏览器已启用 WebGL 2。", en: "Scene failed to load. Check that WebGL 2 is enabled." });
  console.error(error);
});
