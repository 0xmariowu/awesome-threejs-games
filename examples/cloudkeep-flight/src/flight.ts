import { tr } from './i18n.js';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Simulation, ISLANDS, FLIGHT } from '../original/simulation';
import { FlightCamera } from '../original/flight-camera';
import { Controls } from '../original/input';
import { CameraRig } from './camera-rig';
import './style.css';
import './ui.css';

const world = document.querySelector<HTMLDivElement>('#world')!;
const status = document.querySelector<HTMLParagraphElement>('#status')!;
const telemetry = document.querySelector<HTMLDListElement>('#telemetry')!;
let timeScale = 1;
let cameraMode = 'smooth';
let helpersVisible = false;

document.querySelectorAll<HTMLButtonElement>('button').forEach(button => {
  button.addEventListener('click', () => {
    if (button.dataset.timeScale) {
      timeScale = Number(button.dataset.timeScale);
      document.querySelectorAll<HTMLButtonElement>('[data-time-scale]').forEach(item => {
        item.setAttribute('aria-pressed', String(Number(item.dataset.timeScale) === timeScale));
      });
    }
    if (button.dataset.cameraMode) {
      cameraMode = button.dataset.cameraMode;
      document.querySelectorAll<HTMLButtonElement>('[data-camera-mode]').forEach(item => {
        item.setAttribute('aria-pressed', String(item.dataset.cameraMode === cameraMode));
      });
    }
    if (button.id === 'helpers') {
      helpersVisible = !helpersVisible;
      button.setAttribute('aria-pressed', String(helpersVisible));
      document.querySelector<HTMLElement>('#helper-legend')!.hidden = !helpersVisible;
    }
    button.blur();
  });
});

function fail(message: string) {
  status.hidden = false;
  status.setAttribute('role', 'alert');
  status.textContent = message;
}

async function boot() {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('webgl2', { antialias: true });
  if (!context) throw new Error(tr({ zh: "无法启动 WebGL 2。请启用浏览器硬件加速后重新加载。", en: "Cannot start WebGL 2. Enable browser hardware acceleration and reload." }));
  const renderer = new THREE.WebGLRenderer({ canvas, context, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  world.append(canvas);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#a4cfe3');
  scene.fog = new THREE.Fog('#a4cfe3', 90, 330);
  scene.add(new THREE.HemisphereLight('#eaf7ff', '#9eaaa1', 2.4));
  const sunlight = new THREE.DirectionalLight('#fff1d4', 3);
  sunlight.position.set(65, 80, -35);
  scene.add(sunlight);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(1600, 1600),
    new THREE.MeshLambertMaterial({ color: '#edf6fa', transparent: true, opacity: .65, side: THREE.DoubleSide, depthWrite: false }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0;
  scene.add(floor);
  const camera = new THREE.PerspectiveCamera(46, 1, .1, 1800);
  const resize = () => {
    const width = world.clientWidth, height = world.clientHeight;
    renderer.setSize(width, height);
    camera.aspect = width / Math.max(1, height);
    camera.updateProjectionMatrix();
  };
  window.addEventListener('resize', resize);
  resize();

  const sim = new Simulation();
  const controls = new Controls(() => {});
  const flightCamera = new FlightCamera();
  const rig = new CameraRig();
  let contextLost = false;
  canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    contextLost = true;
    controls.enabled = false;
    controls.clear();
    fail(tr({ zh: "图形上下文已中断。请重新加载页面继续飞行。", en: "Graphics context lost. Reload the page to continue flying." }));
  });
  const loader = new GLTFLoader();
  const load = async (name: string) => {
    try { return (await loader.loadAsync(`./assets/${name}.glb`)).scene; }
    catch { throw new Error(tr({ zh: `模型 ${name}.glb 加载失败。请重新运行 build.mjs，并检查本地服务。`, en: `Model ${name}.glb failed to load. Run build.mjs again and check the local server.` })); }
  };
  const [ship, island, lighthouse] = await Promise.all([load('airship'), load('island'), load('lighthouse')]);
  const rotors: THREE.Object3D[] = [];
  ship.traverse(object => { if (object.name.startsWith('rotor_')) rotors.push(object); });
  ship.scale.setScalar(1.13);
  scene.add(ship);
  const obstacles: THREE.Mesh[] = [];
  for (const entry of ISLANDS) {
    const model = (entry.kind === 'lighthouse' ? lighthouse : island).clone(true);
    model.position.set(entry.x, entry.y, entry.z);
    model.scale.setScalar(entry.scale);
    model.rotation.y = entry.rotation;
    model.traverse(object => { if (object instanceof THREE.Mesh) obstacles.push(object); });
    scene.add(model);
  }
  scene.updateMatrixWorld(true);

  const helpers = new THREE.Group();
  const marker = (color: string) => {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(.35, 12, 8), new THREE.MeshBasicMaterial({ color, depthTest: false }));
    mesh.renderOrder = 10;
    helpers.add(mesh);
    return mesh;
  };
  const focusMarker = marker('#13e4d1'), aimMarker = marker('#ffc83e');
  const line = (color: string) => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(6), 3));
    const result = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color, depthTest: false }));
    result.frustumCulled = false;
    result.renderOrder = 11;
    helpers.add(result);
    return result;
  };
  const armLine = line('#13e4d1'), blockedLine = line('#ff3838');
  const setLine = (object: THREE.Line, start: THREE.Vector3, end: THREE.Vector3) => {
    const positions = object.geometry.getAttribute('position') as THREE.BufferAttribute;
    positions.setXYZ(0, start.x, start.y, start.z);
    positions.setXYZ(1, end.x, end.y, end.z);
    positions.needsUpdate = true;
  };
  scene.add(helpers);

  const rows = [tr({ zh: "速度", en: "Speed" }), tr({ zh: "高度", en: "Altitude" }), tr({ zh: "航向", en: "Heading" }), tr({ zh: "俯仰 / 上限", en: "Pitch / limit" }), tr({ zh: "环绕水平 / 垂直", en: "Orbit yaw / pitch" }), tr({ zh: "镜头臂 / 期望", en: "Camera arm / desired" }), tr({ zh: "加速", en: "Boost" }), tr({ zh: "时间倍率", en: "Time scale" })];
  const values = rows.map(label => {
    const term = document.createElement('dt'), value = document.createElement('dd');
    term.textContent = label;
    telemetry.append(term, value);
    return value;
  });
  let snapshot: Readonly<Record<string, unknown>> = Object.freeze({});
  Object.defineProperty(window, '__flight', { get: () => snapshot });
  const degrees = THREE.MathUtils.radToDeg;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let last = performance.now(), accumulator = 0;
  document.addEventListener('visibilitychange', () => { accumulator = 0; last = performance.now(); });
  if (contextLost) return;
  controls.enabled = true;
  status.hidden = true;
  function frame(now: number) {
    if (contextLost) return;
    const dt = Math.min((now - last) / 1000, .1) * timeScale;
    last = now;
    if (document.hidden) {
      accumulator = 0;
      requestAnimationFrame(frame);
      return;
    }
    accumulator += dt;
    while (accumulator >= 1 / 60) {
      sim.step(1 / 60, controls.read());
      accumulator -= 1 / 60;
    }
    // The host consumes events even though it does not render ecosystem effects.
    sim.events.splice(0);
    ship.position.set(sim.pos.x, sim.pos.y + (reducedMotion.matches ? 0 : Math.sin(sim.time * 1.2) * .1), sim.pos.z);
    ship.rotation.set(sim.bodyPitch, sim.yaw, sim.bank, 'YXZ');
    for (const rotor of rotors) rotor.rotation.z += dt * (12 + sim.speed * 2);
    const direct = cameraMode === 'direct';
    // reset() selects alpha = 1 in the untouched original camera implementation.
    if (direct) flightCamera.reset();
    flightCamera.update(sim.pos, sim.yaw, sim.pitch, controls.view, dt, world.clientWidth < 700);
    rig.update(camera, flightCamera, sim.pos, obstacles, dt, direct);
    helpers.visible = helpersVisible;
    focusMarker.position.copy(flightCamera.focus);
    aimMarker.position.copy(rig.aim);
    setLine(armLine, rig.origin, camera.position);
    setLine(blockedLine, camera.position, rig.desired);
    blockedLine.visible = rig.armLength < rig.desiredArmLength - .01;
    snapshot = Object.freeze({
      speed: sim.speed, altitude: sim.pos.y, yaw: sim.yaw, yawDegrees: degrees(sim.yaw),
      pitch: sim.pitch, pitchDegrees: degrees(sim.pitch), maxPitch: FLIGHT.maxPitch, maxPitchDegrees: degrees(FLIGHT.maxPitch),
      orbitYaw: controls.view.orbitYaw, orbitPitch: controls.view.orbitPitch,
      orbitYawDegrees: degrees(controls.view.orbitYaw), orbitPitchDegrees: degrees(controls.view.orbitPitch),
      cameraArmLength: rig.armLength, desiredArmLength: rig.desiredArmLength,
      boosting: sim.boosting, timeScale, cameraMode, helpersVisible, occluded: rig.occluded,
      position: Object.freeze({ ...sim.pos }), time: sim.time,
    });
    const output = [
      `${sim.speed.toFixed(2)} m/s`, `${sim.pos.y.toFixed(2)} m`, `${degrees(sim.yaw).toFixed(1)}°`,
      `${degrees(sim.pitch).toFixed(1)}° / ±${degrees(FLIGHT.maxPitch).toFixed(0)}°`,
      `${degrees(controls.view.orbitYaw).toFixed(1)}° / ${degrees(controls.view.orbitPitch).toFixed(1)}°`,
      `${rig.armLength.toFixed(2)} / ${rig.desiredArmLength.toFixed(2)} m`,
      sim.boosting ? tr({ zh: "是", en: "Yes" }) : tr({ zh: "否", en: "No" }), `${timeScale}×`,
    ];
    values.forEach((element, index) => { element.textContent = output[index]; });
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

boot().catch(error => fail(error instanceof Error ? error.message : tr({ zh: "飞行场景启动失败，请重新加载页面。", en: "Flight scene failed to start. Please reload the page." })));
