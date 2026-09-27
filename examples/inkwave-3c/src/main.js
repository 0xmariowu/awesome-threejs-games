import { tr } from './i18n.js';
import * as THREE from 'three';
import { G, on } from '../original/core/ctx.js';
import { Input } from '../original/core/input.js';
import { Actor } from '../original/game/actor.js';
import { Character } from '../original/game/character.js';
import { CameraRig } from '../original/game/cameraRig.js';
import { PlayerController } from '../original/game/player.js';
import { Physics } from '../original/game/physics.js';
import { createPracticeWorld } from './world.js';

const world = document.querySelector('#world');
const telemetry = document.querySelector('#telemetry');
const fail = error => {
  document.querySelector('#error').hidden = false;
  document.querySelector('#error').textContent = tr({ zh: "场景加载失败，请重新加载。", en: "Scene failed to load. Please reload." });
  console.error(error);
};

try {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const canvas = renderer.domElement;
  canvas.tabIndex = 0;
  canvas.setAttribute('aria-label', tr({ zh: "点击控制角色视角", en: "Click to control the character view" }));
  world.append(canvas);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#d9e8e3');
  scene.fog = new THREE.Fog('#d9e8e3', 32, 75);
  scene.add(new THREE.HemisphereLight('#fff9ea', '#5f7f78', 2.3));
  const sun = new THREE.DirectionalLight('#fff1db', 3);
  sun.position.set(-10, 22, -5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -28, right: 28, top: 42, bottom: -22, far: 80 });
  sun.shadow.normalBias = .03;
  scene.add(sun);
  const camera = new THREE.PerspectiveCamera(55, 16 / 9, .05, 150);
  const practice = createPracticeWorld(scene);
  const physics = new Physics(practice.level);
  practice.connectPhysics(physics);
  Object.assign(G, {
    scene, renderer, camera, physics, level: practice.level, paint: practice.paint,
    settings: { fov: 82, sensitivity: 1, cameraShake: 1, aimAssist: 0, rumble: 0 },
    teamColors: [new THREE.Color('#ff8a14'), new THREE.Color('#2f5bff')],
    mode: 'match', time: 0,
  });
  const input = G.input = new Input(canvas);
  const actor = new Actor({ team: 0, name: tr({ zh: "练习角色", en: "Practice character" }), isLocal: true, CharacterClass: Character });
  G.actors = [actor];
  G.local = actor;
  scene.add(actor.character.root);
  const rig = new CameraRig(camera);
  const controller = new PlayerController(actor, rig, input);
  let timeScale = 1, jumps = 0, frames = 0, snapshot, pointerLockUnavailable = false, drag = null;
  on('actor:jump', () => { jumps++; });
  const vector = v => Object.freeze({ x: v.x, y: v.y, z: v.z });
  Object.defineProperty(window, '__example', { get: () => snapshot });

  function clearInput() {
    drag = null;
    input.keys.clear(); input.pressed.clear(); input.endFrame();
    input.mouse.left = input.mouse.right = false;
  }
  function reset() {
    clearInput();
    actor.spawnAt(practice.level.spawnPads[0], 0);
    rig.yaw = 0; rig.pitch = -.16;
    rig.follow(actor, true);
    jumps = 0;
  }
  reset();
  canvas.addEventListener('click', () => { canvas.focus(); input.requestLock(); });
  // Some embedded/headless browsers reject native capture. Feed only mouse deltas
  // into the original controller; its sensitivity, pitch clamp and camera remain intact.
  document.addEventListener('pointerlockerror', () => { pointerLockUnavailable = true; });
  canvas.addEventListener('pointerdown', event => {
    if (event.button === 0) { canvas.focus(); drag = { x: event.clientX, y: event.clientY }; }
  });
  window.addEventListener('pointermove', event => {
    if (!drag) return;
    if (!input.locked) {
      input.mouse.dx += event.clientX - drag.x;
      input.mouse.dy += event.clientY - drag.y;
    }
    drag = { x: event.clientX, y: event.clientY };
  });
  window.addEventListener('pointerup', () => { drag = null; });
  input.onUnlock = clearInput;
  document.querySelector('#slow').addEventListener('click', event => {
    timeScale = timeScale === 1 ? .25 : 1;
    event.currentTarget.setAttribute('aria-pressed', String(timeScale !== 1));
    event.currentTarget.blur();
  });
  document.querySelector('#reset').addEventListener('click', event => { reset(); event.currentTarget.blur(); });
  function resize() {
    renderer.setSize(world.clientWidth, world.clientHeight);
    camera.aspect = world.clientWidth / world.clientHeight;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();
  let last = performance.now(), stopped = false;
  window.addEventListener('blur', clearInput);
  document.addEventListener('visibilitychange', () => { clearInput(); last = performance.now(); });
  canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); stopped = true; fail(new Error('WebGL context lost')); });
  function frame(now) {
    if (stopped) return;
    const dt = Math.min((now - last) / 1000, .05) * timeScale;
    last = now;
    if (!document.hidden && dt > 0) {
      G.time += dt;
      input.pollPad();
      controller.update(dt);
      // This host owns locomotion input only; combat has a separate technique example.
      actor.intent.fire = actor.intent.sub = actor.intent.special = false;
      const steps = dt > 1 / 45 ? 2 : 1;
      for (let i = 0; i < steps; i++) actor.update(dt / steps);
      rig.update(dt);
      controller.computeAim();
      renderer.render(scene, camera);
      input.endFrame();
      frames++;
      const speed = Math.hypot(actor.vel.x, actor.vel.z);
      const projected = actor.character.root.position.clone().add(new THREE.Vector3(0, .7, 0)).project(camera);
      snapshot = Object.freeze({
        ready: true, frames, time: G.time, timeScale, jumps, locked: input.locked, pointerLockUnavailable,
        position: vector(actor.pos), visualPosition: vector(actor.character.root.position), velocity: vector(actor.vel),
        speed, grounded: actor.grounded, form: actor.form, animation: actor.anim.form, submerged: actor.submerged,
        groundTeam: actor.groundTeam, yaw: actor.yaw, cameraYaw: rig.yaw, cameraPitch: rig.pitch,
        camera: vector(camera.position), pivot: vector(rig.pivot), cameraDistance: rig.curDist, desiredDistance: rig.wantDist,
        fov: camera.fov, projected: vector(projected),
      });
      const label = actor.anim.form === 'swim' ? tr({ zh: "潜墨游动", en: "Swimming in ink" }) : actor.form === 'squid' ? tr({ zh: "鱿鱼形态", en: "Squid form" }) : actor.grounded ? tr({ zh: "人形奔跑", en: "Running in human form" }) : tr({ zh: "空中跳跃", en: "Jumping" });
      telemetry.textContent = tr({ zh: `${label} · ${speed.toFixed(1)} 米/秒 · 镜头 ${rig.curDist.toFixed(1)} 米${timeScale !== 1 ? tr({ zh: " · ¼ 速度", en: " · ¼ speed" }) : ''}`, en: `${label} · ${speed.toFixed(1)} m/s · Camera ${rig.curDist.toFixed(1)} m${timeScale !== 1 ? tr({ zh: " · ¼ 速度", en: " · ¼ speed" }) : ''}` });
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
} catch (error) { fail(error); }
