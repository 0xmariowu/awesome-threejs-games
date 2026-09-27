import { tr } from './i18n.js';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { Atmosphere, CLOUD_BANKS } from '../original/atmosphere';
import { Controls } from '../original/input';
import { updateFog } from './fog.mjs';
import './style.css';
import './ui.css';

async function boot() {
  const world = document.querySelector<HTMLElement>('#world')!;
  const readout = document.querySelector<HTMLOutputElement>('#readout')!;
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.4));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.domElement.setAttribute('aria-label', tr({ zh: "飞入云团，观察雾效", en: "Fly into clouds to see the fog" }));
  world.append(renderer.domElement);
  const scene = new THREE.Scene();
  const fog = new THREE.Fog('#b9d3d5', 100, 390);
  scene.fog = fog;
  const camera = new THREE.PerspectiveCamera(46, 1, .3, 900);
  const atmosphere = new Atmosphere();
  scene.add(atmosphere.background);
  scene.add(new THREE.HemisphereLight('#dcefff', '#d8e5e7', .68));
  const sun = new THREE.DirectionalLight('#fff0d5', 4);
  sun.position.set(65, 48, -35);
  scene.add(sun);
  // Keep the original linear HDR -> OutputPass path; omit AO and bloom.
  const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, target);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new OutputPass());
  const resize = () => {
    const width = world.clientWidth, height = Math.max(1, world.clientHeight);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
    composer.setSize(width, height);
    atmosphere.resize(width, height);
  };
  new ResizeObserver(resize).observe(world);
  resize();

  // One archived low-detail island, instanced as depth references in each bank.
  const island = (await new GLTFLoader().loadAsync('./assets/island-distant.glb')).scene;
  const helpers = new THREE.Group();
  for (const bank of CLOUD_BANKS) {
    const landmark = island.clone(true);
    landmark.position.set(bank.center[0] + 15, bank.center[1] - 18, bank.center[2] - 22);
    landmark.scale.setScalar(2);
    scene.add(landmark);
    const shell = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 10),
      new THREE.MeshBasicMaterial({ color: '#ffd895', wireframe: true, transparent: true, opacity: .22, depthWrite: false, fog: false }));
    shell.position.set(...bank.center);
    shell.scale.set(...bank.radius);
    helpers.add(shell);
  }
  helpers.visible = false;
  scene.add(helpers);
  const controls = new Controls(() => {});
  // Controls prevents the pointer default; explicitly focus the embedded document.
  world.addEventListener('pointerdown', () => world.focus({ preventScroll: true }));
  controls.enabled = true;
  let selectedBank = 0, yaw = 0, pitch = -.28, immersion = 0, fogEnabled = true;
  let time = 0, frames = 0, previous = performance.now(), contextLost = false;
  const reset = () => {
    const bank = CLOUD_BANKS[selectedBank];
    camera.position.set(bank.center[0], bank.center[1] + 65, bank.center[2] + bank.radius[2] + 140);
    yaw = 0; pitch = -.28; immersion = 0;
    controls.clear(); controls.centerView();
    updateFog(fog, 0, 0, 0);
  };
  reset();
  document.querySelector<HTMLSelectElement>('#bank')!.addEventListener('change', event => {
    selectedBank = Number((event.target as HTMLSelectElement).value);
    reset(); (event.target as HTMLElement).blur(); world.focus();
  });
  document.querySelectorAll<HTMLButtonElement>('button').forEach(button => {
    button.addEventListener('click', () => {
      if (button.id === 'reset') reset();
      if (button.id === 'fog') {
        fogEnabled = !fogEnabled;
        button.setAttribute('aria-pressed', String(fogEnabled));
      }
      if (button.id === 'helpers') {
        helpers.visible = !helpers.visible;
        button.setAttribute('aria-pressed', String(helpers.visible));
      }
      button.blur(); world.focus();
    });
  });
  document.addEventListener('visibilitychange', () => { previous = performance.now(); });
  renderer.domElement.addEventListener('webglcontextlost', event => {
    event.preventDefault(); contextLost = true; controls.enabled = false; controls.clear();
    fail(tr({ zh: "图形上下文已中断，请重新加载。", en: "Graphics context lost. Please reload." }));
  });
  let snapshot: object;
  Object.defineProperty(window, '__example', { get: () => snapshot });
  const forward = new THREE.Vector3(), right = new THREE.Vector3(), movement = new THREE.Vector3();
  function frame(now: number) {
    if (contextLost) return;
    const dt = document.hidden ? 0 : Math.min((now - previous) / 1000, .1);
    previous = now; time += dt;
    const input = controls.read();
    if (input.recenter) pitch = 0;
    yaw -= input.lookX + input.turn * dt * 1.08;
    pitch = THREE.MathUtils.clamp(pitch - input.lookY + input.pitchTurn * dt * .9, -.9, .9);
    forward.set(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
    right.set(Math.cos(yaw), 0, -Math.sin(yaw));
    movement.copy(forward).multiplyScalar(input.throttle).addScaledVector(right, input.strafe);
    movement.y += input.altitude;
    if (movement.lengthSq() > 1) movement.normalize();
    const speed = input.boost ? 70 : 28;
    camera.position.addScaledVector(movement, dt * speed);
    // Host free camera: right-drag changes the view without changing travel direction.
    camera.rotation.set(pitch + controls.view.orbitPitch, yaw + controls.view.orbitYaw, 0, 'YXZ');
    const fov = 46 * controls.view.distanceScale;
    if (camera.fov !== fov) { camera.fov = fov; camera.updateProjectionMatrix(); }
    const localMist = atmosphere.localMist(camera.position);
    immersion = updateFog(fog, immersion, localMist, dt);
    if (!fogEnabled) { fog.near = 100; fog.far = 390; }
    atmosphere.render(renderer, camera, time);
    composer.render(dt);
    frames++;
    snapshot = Object.freeze({
      ready: true, time, frames, bankCount: CLOUD_BANKS.length, selectedBank,
      banks: CLOUD_BANKS.map(bank => ({ center: [...bank.center], radius: [...bank.radius] })),
      position: Object.freeze(camera.position.toArray()), yaw, pitch,
      orbitYaw: controls.view.orbitYaw, orbitPitch: controls.view.orbitPitch, fov: camera.fov,
      localMist, immersion, fogNear: fog.near, fogFar: fog.far, fogEnabled,
      helpersVisible: helpers.visible, speed: movement.length() * speed,
      viewport: { width: world.clientWidth, height: world.clientHeight },
    });
    const metrics = [
      [tr({zh: '云团', en: 'Cloud bank'}), `${String(selectedBank + 1).padStart(2, '0')} / 06`],
      [tr({zh: '入云', en: 'Immersion'}), `${Math.round(immersion * 100)}%`],
      [tr({zh: '能见距离', en: 'Visibility'}), `${Math.round(fog.far)} m`],
    ];
    if (!readout.querySelector('dl')) {
      const list = document.createElement('dl'); list.className = 'demo-metrics';
      for (const [label] of metrics) {
        const term = document.createElement('dt'); term.textContent = label;
        list.append(term, document.createElement('dd'));
      }
      readout.replaceChildren(list);
    }
    readout.querySelectorAll('dd').forEach((node, index) => { node.textContent = metrics[index][1]; });
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

function fail(message: string) {
  const error = document.querySelector<HTMLElement>('#error')!;
  error.hidden = false; error.textContent = message;
}
boot().catch(error => { console.error(error); fail(tr({ zh: "云海加载失败，请检查构建与 WebGL 2 支持。", en: "Clouds failed to load. Check the build and WebGL 2 support." })); });
