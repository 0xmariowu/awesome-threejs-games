import { tr } from './i18n.js';
import * as game from './runtime.mjs';
import { G, setRenderer } from './shims.mjs';
import { targetFor } from './targets.mjs';

const { T, TRACK, POD_DEFS, Racer, racers, K, aiInput, playerInput,
  stepRacer, collide, poseRacer } = game;
const canvas = document.querySelector('#world');
const renderer = new T.WebGLRenderer({ canvas, antialias: true });
setRenderer(renderer);
renderer.outputColorSpace = T.LinearSRGBColorSpace;
renderer.toneMapping = T.NoToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = T.PCFShadowMap;
const scene = new T.Scene();
scene.add(new T.AmbientLight(0xffe5c2, 1.25));
const sky = game.makeSky();
const ground = new T.Mesh(new T.PlaneGeometry(12000, 12000), game.makeGroundMat());
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(sky, ground, game.LIGHTS.sun, game.LIGHTS.sun.target, game.LIGHTS.hemi,
  game.buildTrackMesh(), game.buildTerrain(), game.buildPosts(),
  game.buildScenery(scene), game.buildPads(), game.buildBarrier());

const colors = [0x78edff, 0xff88cf, 0xccff79, 0xfff0b2, 0xbda0ff, 0xff925b];
const helpers = [], targets = [], inputs = [], buttons = [];
let selected = 0, manual = false, helpersVisible = true, timeScale = 1;
let previous = performance.now(), accumulator = 0, steps = 0;
const fixed = 1 / 120;
const camera = new T.PerspectiveCamera(55, 16 / 9, 0.5, 9000);
const aim = new T.Vector3(), eye = new T.Vector3();

POD_DEFS.forEach((definition, index) => {
  const pod = game.buildPod(definition);
  pod.flames.forEach(f => { f.userData.bl = f.material.uniforms.uLen.value; });
  pod.glows.forEach(g => { g.userData.bs = g.material.uniforms.uSize.value; });
  scene.add(pod.root);
  racers.push(new Racer(pod, false));
  const material = new T.MeshBasicMaterial({ color: colors[index], depthTest: false });
  const marker = new T.Mesh(new T.SphereGeometry(2.5, 12, 8), material);
  const ring = new T.Mesh(new T.TorusGeometry(6, 0.65, 6, 32), material);
  ring.rotation.x = Math.PI / 2;
  const line = new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(), new T.Vector3()]),
    new T.LineBasicMaterial({ color: colors[index], depthTest: false, transparent: true, opacity: 0.85 }));
  marker.renderOrder = ring.renderOrder = line.renderOrder = 10;
  scene.add(marker, ring, line);
  helpers.push({ marker, ring, line });
  const button = document.createElement('button');
  button.textContent = String(index + 1);
  button.setAttribute('aria-label', tr({ zh: `跟随 ${index + 1} 号飞梭`, en: `Follow pod ${index + 1}` }));
  button.style.setProperty('--pod', `#${colors[index].toString(16).padStart(6, '0')}`);
  button.onclick = () => { selected = index; clearKeys(); setManual(false); followCamera(true); canvas.focus(); };
  document.querySelector('#pods').append(button);
  buttons.push(button);
});

function clearKeys() { for (const key of Object.keys(K)) K[key] = false; }
function setManual(value) {
  manual = value;
  racers.forEach((r, i) => { r.isPlayer = manual && i === selected; });
  document.querySelector('#manual').setAttribute('aria-pressed', String(manual));
}
function reset() {
  clearKeys(); setManual(false); G.t = G.raceT = 0; accumulator = 0; steps = 0;
  racers.forEach((r, i) => {
    r.place(i);
    inputs[i] = { thr: 0, brk: 0, steer: 0, boost: false };
    poseRacer(r, fixed, 800);
  });
  // All racers must be placed before computing neighbor-dependent helpers.
  racers.forEach((r, i) => { targets[i] = targetFor(r, racers, game); });
  followCamera(true); canvas.focus({ preventScroll: true });
}
function followCamera(snap = false) {
  const r = racers[selected], ahead = game.trackAt(r.s + 35);
  const tangent = game.trackAt(r.s);
  eye.set(r.x - tangent.tx * 110, r.y + 230, r.z - tangent.tz * 110);
  if (snap) camera.position.copy(eye); else camera.position.lerp(eye, 0.12);
  aim.set(ahead.x, r.y, ahead.z); camera.lookAt(aim);
}
function resize() {
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.setSize(document.querySelector('[data-demo-picture]').clientWidth, document.querySelector('[data-demo-picture]').clientHeight, false);
  camera.aspect = document.querySelector('[data-demo-picture]').clientWidth / document.querySelector('[data-demo-picture]').clientHeight;
  game.OUTLINE_U.uAspect.value = camera.aspect;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
addEventListener('keydown', event => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)
      && document.activeElement === canvas) event.preventDefault();
  if (document.activeElement !== canvas) return;
  K[event.code] = true;
  if (event.code === 'KeyR' && !event.repeat) reset();
});
addEventListener('keyup', event => { K[event.code] = false; });
addEventListener('blur', clearKeys);
document.addEventListener('visibilitychange', () => { clearKeys(); previous = performance.now(); accumulator = 0; });
canvas.addEventListener('pointerdown', () => canvas.focus());
document.querySelector('#reset').onclick = reset;
document.querySelector('#manual').onclick = () => { clearKeys(); setManual(!manual); canvas.focus(); };
document.querySelector('#slow').onclick = event => {
  timeScale = timeScale === 1 ? 0.25 : 1;
  event.currentTarget.setAttribute('aria-pressed', String(timeScale !== 1)); canvas.focus();
};
document.querySelector('#helpers').onclick = event => {
  helpersVisible = !helpersVisible;
  event.currentTarget.setAttribute('aria-pressed', String(helpersVisible)); canvas.focus();
};

const map = document.querySelector('#map').getContext('2d');
const xs = TRACK.P.map(p => p.x), zs = TRACK.P.map(p => p.z);
const minX = Math.min(...xs), minZ = Math.min(...zs);
const mapScale = Math.min(196 / (Math.max(...xs) - minX), 126 / (Math.max(...zs) - minZ));
const mapPoint = p => [12 + (p.x - minX) * mapScale, 12 + (p.z - minZ) * mapScale];
function drawMap() {
  map.clearRect(0, 0, 220, 150); map.beginPath();
  TRACK.P.forEach((p, i) => map[i ? 'lineTo' : 'moveTo'](...mapPoint(p)));
  map.closePath(); map.strokeStyle = '#d8b88b'; map.lineWidth = 2; map.stroke();
  racers.forEach((r, i) => {
    const [x, y] = mapPoint(r); map.beginPath(); map.arc(x, y, i === selected ? 5 : 3, 0, Math.PI * 2);
    map.fillStyle = `#${colors[i].toString(16).padStart(6, '0')}`; map.fill();
  });
}
function frame(now) {
  const elapsed = Math.min(Math.max(0, (now - previous) / 1000), 0.1); previous = now;
  if (!document.hidden) accumulator += elapsed * timeScale;
  while (accumulator >= fixed) {
    G.t += fixed; G.raceT += fixed;
    racers.forEach((r, i) => {
      inputs[i] = { ...(manual && selected === i ? playerInput() : aiInput(r, fixed)) };
      // Reconstruct the marker immediately after the original lane choice, before movement.
      targets[i] = manual && selected === i ? null : targetFor(r, racers, game);
      stepRacer(r, fixed, inputs[i]);
    });
    collide();
    racers.forEach(r => poseRacer(r, fixed, 800));
    accumulator -= fixed; steps++;
  }
  helpers.forEach(({ marker, ring, line }, i) => {
    const r = racers[i], target = targets[i];
    marker.visible = ring.visible = line.visible = helpersVisible && target !== null;
    if (!target) return;
    marker.position.set(target.x, target.y, target.z);
    ring.position.set(r.x, r.y + 2, r.z);
    const positions = line.geometry.attributes.position;
    positions.setXYZ(0, r.x, r.y + 4, r.z); positions.setXYZ(1, target.x, target.y, target.z);
    positions.needsUpdate = true; line.geometry.computeBoundingSphere();
  });
  game.SU.uTime.value = G.t;
  followCamera(); sky.position.copy(camera.position);
  game.updateSunShadow(aim.set(racers[selected].x, racers[selected].y, racers[selected].z));
  renderer.render(scene, camera); drawMap();
  const current = racers[selected], target = targets[selected];
  document.querySelector('#telemetry').textContent = tr({ zh: `${selected + 1} 号 · ${manual ? '手动驾驶' : tr({ zh: "自动驾驶", en: "Autopilot" })} · 第 ${Math.max(1, current.lap)} 圈\n${Math.round(current.vf * 3.6)} 千米/时${target ? ` · 前瞻 ${Math.round(target.look)} 米` : ''}`, en: `${selected + 1} · ${manual ? 'Manual driving' : tr({ zh: "自动驾驶", en: "Autopilot" })} · Lap ${Math.max(1, current.lap)}\n${Math.round(current.vf * 3.6)} km/h${target ? ` · Look-ahead ${Math.round(target.look)} m` : ''}` });
  buttons.forEach((button, i) => button.setAttribute('aria-pressed', String(i === selected)));
  window.__example = {
    ready: true, time: G.t, steps, timeScale, helpersVisible, selected, manual,
    trackLength: TRACK.LEN, visibleTargets: helpers.filter(h => h.marker.visible).length,
    racers: racers.map((r, i) => ({
      position: { x: r.x, y: r.y, z: r.z }, speed: r.vf, heading: r.th,
      progress: r.prog, lap: r.lap, lateralOffset: r.lat, lane: r.lane,
      stuck: r.stuck, boostEnergy: r.boostE, boosting: r.wasB,
      input: { ...inputs[i] }, target: targets[i] ? { ...targets[i] } : null,
    })),
  };
  requestAnimationFrame(frame);
}
resize(); reset(); requestAnimationFrame(frame);
