import { tr } from './i18n.js';
import { T, PAL, SU, LIGHTS, OUTLINE_U, TRACK, TRACK_HALF, POD_DEFS, K, Racer,
  stepRacer, playerInput, poseRacer, buildPod, makeSky, makeGroundMat,
  buildTrackMesh, buildTerrain, buildPosts, buildScenery, buildPads,
  buildBarrier, updateSunShadow } from './runtime.mjs';
import { G, setRenderer } from './shims.mjs';

const canvas = document.querySelector('#world');
const renderer = new T.WebGLRenderer({ canvas, antialias: true });
setRenderer(renderer);
renderer.outputColorSpace = T.LinearSRGBColorSpace;
renderer.toneMapping = T.NoToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = T.PCFShadowMap;
const scene = new T.Scene();
// Soft host fill keeps the pod readable without the original postprocessing.
scene.add(new T.AmbientLight(0xffe5c2, 1.25));
const sky = makeSky();
const ground = new T.Mesh(new T.PlaneGeometry(12000, 12000), makeGroundMat());
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(sky, ground, LIGHTS.sun, LIGHTS.sun.target, LIGHTS.hemi,
  buildTrackMesh(), buildTerrain(), buildPosts(), buildScenery(scene), buildPads(), buildBarrier());
const pod = buildPod(POD_DEFS[0]);
pod.flames.forEach(f => { f.userData.bl = f.material.uniforms.uLen.value; });
pod.glows.forEach(g => { g.userData.bs = g.material.uniforms.uSize.value; });
scene.add(pod.root);
const racer = new Racer(pod, true);
const camera = new T.PerspectiveCamera(64, 16 / 9, 0.5, 9000);
const forward = new T.ArrowHelper(new T.Vector3(0, 0, 1), new T.Vector3(), 20, 0xfff4cd, 4, 2);
const velocity = new T.ArrowHelper(new T.Vector3(0, 0, 1), new T.Vector3(), 20, 0x64ecff, 4, 2);
scene.add(forward, velocity);
forward.visible = velocity.visible = false;
const target = new T.Vector3(), cameraTarget = new T.Vector3(), velocityDirection = new T.Vector3();
let timeScale = 1, accumulator = 0, previous = performance.now(), steps = 0;
const fixed = 1 / 120;
const speed = document.querySelector('#speed'), energy = document.querySelector('#energy');
const motion = document.querySelector('#motion');
function clearKeys() { for (const key of Object.keys(K)) K[key] = false; }
function reset() {
  clearKeys(); racer.place(0); G.t = G.raceT = 0; accumulator = 0; steps = 0;
  poseRacer(racer, fixed, 0); followCamera(true); canvas.focus({ preventScroll: true });
}
function followCamera(snap = false) {
  // Presentation only: a higher chase view makes lateral slip and banking visible.
  const s = Math.sin(racer.th), c = Math.cos(racer.th);
  cameraTarget.set(racer.x - s * 32, racer.y + 16, racer.z - c * 32);
  if (snap) camera.position.copy(cameraTarget); else camera.position.lerp(cameraTarget, 0.12);
  target.set(racer.x + s * 18, racer.y + 2, racer.z + c * 18);
  camera.lookAt(target);
}
function resize() {
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.setSize(document.querySelector('[data-demo-picture]').clientWidth, document.querySelector('[data-demo-picture]').clientHeight, false);
  camera.aspect = document.querySelector('[data-demo-picture]').clientWidth / document.querySelector('[data-demo-picture]').clientHeight;
  OUTLINE_U.uAspect.value = camera.aspect;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
addEventListener('keydown', event => {
  if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(event.code)) event.preventDefault();
  K[event.code] = true;
  if (event.code === 'KeyR' && !event.repeat) reset();
});
addEventListener('keyup', event => { K[event.code] = false; });
addEventListener('blur', clearKeys);
addEventListener('visibilitychange', () => { clearKeys(); previous = performance.now(); accumulator = 0; });
canvas.addEventListener('pointerdown', () => canvas.focus());
document.querySelector('#reset').onclick = reset;
document.querySelector('#slow').onclick = event => {
  timeScale = timeScale === 1 ? 0.25 : 1;
  event.currentTarget.setAttribute('aria-pressed', String(timeScale !== 1));
  canvas.focus();
};
document.querySelector('#helpers').onclick = event => {
  forward.visible = velocity.visible = !forward.visible;
  event.currentTarget.setAttribute('aria-pressed', String(forward.visible));
  canvas.focus();
};
function frame(now) {
  const elapsed = Math.min((now - previous) / 1000, 0.1); previous = now;
  if (!document.hidden) accumulator += elapsed * timeScale;
  const input = playerInput();
  while (accumulator >= fixed) {
    G.t += fixed; G.raceT += fixed;
    stepRacer(racer, fixed, input);
    poseRacer(racer, fixed, 0);
    accumulator -= fixed; steps++;
  }
  SU.uTime.value = G.t;
  followCamera(); sky.position.copy(camera.position);
  updateSunShadow(target.set(racer.x, racer.y, racer.z));
  forward.position.set(racer.x, racer.y + 5, racer.z);
  velocity.position.copy(forward.position);
  forward.setDirection(target.set(Math.sin(racer.th), 0, Math.cos(racer.th)));
  velocityDirection.set(racer.vx, 0, racer.vz);
  if (velocityDirection.lengthSq() > 0.01) velocity.setDirection(velocityDirection.normalize());
  renderer.render(scene, camera);
  speed.value = String(Math.round(Math.abs(racer.vf) * 3.6));
  energy.value = racer.boostE;
  motion.textContent = tr({ zh: `${Math.abs(racer.lat) > TRACK_HALF ? tr({ zh: "沙地", en: "Sand" }) : tr({ zh: "赛道", en: "Track" })} · 侧滑 ${Math.abs(racer.vl).toFixed(1)} 米/秒`, en: `${Math.abs(racer.lat) > TRACK_HALF ? tr({ zh: "沙地", en: "Sand" }) : tr({ zh: "赛道", en: "Track" })} · Sideslip ${Math.abs(racer.vl).toFixed(1)} m/s` });
  window.__example = {
    ready: true, time: G.t, steps, timeScale, helpersVisible: forward.visible,
    position: { x: racer.x, y: racer.y, z: racer.z }, speed: racer.vf,
    lateralVelocity: racer.vl, lateralOffset: racer.lat, heading: racer.th,
    yawRate: racer.yawRate, roll: racer.roll, visualRoll: pod.vis.rotation.z,
    boostEnergy: racer.boostE, boostStrength: racer.boostS, boosting: racer.wasB,
    progress: racer.prog, trackLength: TRACK.LEN, offRoad: Math.abs(racer.lat) > TRACK_HALF,
    input, air: racer.air,
  };
  requestAnimationFrame(frame);
}
resize(); reset(); requestAnimationFrame(frame);
