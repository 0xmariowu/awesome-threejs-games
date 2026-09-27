import { tr } from './i18n.js';
import * as THREE from 'three';
import { Director } from '../original/sim/director.js';
import { Flight } from '../original/sim/flight.js';
import { Wind } from '../original/sim/wind.js';
import { mulberry32 } from '../original/util/noise.js';

const $ = selector => document.querySelector(selector);
const canvas = $('#world');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
const scene = new THREE.Scene();
scene.background = new THREE.Color('#dbe9dd');
scene.fog = new THREE.Fog('#dbe9dd', 40, 145);
const camera = new THREE.PerspectiveCamera(52, 16 / 9, 0.02, 250);
scene.add(new THREE.HemisphereLight('#fff6e0', '#5e7d66', 2.5));
const sun = new THREE.DirectionalLight('#fff5dc', 2.2);
sun.position.set(-15, 35, -12);
scene.add(sun);

// Host fixtures: a flat garden, three launch spots and visible gaze landmarks.
const groundAt = () => 0;
const trees = { nearby: () => [] };
const spots = [
  { id: 'garden', pos: new THREE.Vector3(0, 1.6, 0), yaw: 0, pitch: -0.02 },
  { id: 'path', pos: new THREE.Vector3(-12, 1.6, 16), yaw: 0.7, pitch: -0.02 },
  { id: 'gate', pos: new THREE.Vector3(12, 1.6, 28), yaw: -0.75, pitch: -0.02 },
];
const landmarks = [];
const obstacles = [];
const material = color => new THREE.MeshStandardMaterial({ color, roughness: 0.85 });
function mesh(geometry, mat, x, y, z) {
  const item = new THREE.Mesh(geometry, mat);
  item.position.set(x, y, z);
  scene.add(item);
  return item;
}
mesh(new THREE.BoxGeometry(350, 0.2, 350), material('#91ae87'), 0, -0.1, 0);
const stone = material('#d2cbbb');
for (let i = -6; i < 65; i++) {
  mesh(new THREE.CylinderGeometry(0.75, 0.85, 0.07, 7), stone, Math.sin(i * 0.16) * 3, 0.035, i * 1.5);
}
const bark = material('#6f6856');
const blossom = ['#e7b8bb', '#eed2c3', '#c6d4a8'].map(material);
const foliage = new THREE.IcosahedronGeometry(1, 2);
const decorRand = mulberry32(9227);
for (let i = 0; i < 30; i++) {
  const side = i % 2 ? -1 : 1;
  const x = side * (9 + decorRand() * 15), z = -15 + i * 3.7;
  const height = 3.2 + decorRand() * 2;
  mesh(new THREE.CylinderGeometry(0.17, 0.3, height, 7), bark, x, height / 2, z);
  for (let k = 0; k < 3; k++) {
    const crown = mesh(foliage, blossom[i % 3], x + (k - 1) * 1.25, height + 0.4 - Math.abs(k - 1) * 0.4, z);
    crown.scale.set(1.65, 1.25, 1.6);
  }
  // The fixture's trunks use the original Flight obstacle query.
  obstacles.push({ x, z, hw: 0.3, hd: 0.3, rot: 0, base: 0, top: height });
  if (i % 4 === 0) landmarks.push({ id: `tree-${i}`, pos: new THREE.Vector3(x, height, z), w: 2 });
}
const gateMat = material('#b96d52');
for (const x of [-3.5, 3.5]) mesh(new THREE.CylinderGeometry(0.22, 0.3, 5, 10), gateMat, x, 2.5, 38);
mesh(new THREE.BoxGeometry(9, 0.35, 0.65), gateMat, 0, 5, 38);
mesh(new THREE.BoxGeometry(8, 0.22, 0.35), gateMat, 0, 4.25, 38);
landmarks.push({ id: 'gate', pos: new THREE.Vector3(0, 4, 38), w: 5 });

const wind = new Wind(0.4);
const flight = new Flight({ wind, groundAt, trees, obstacles, landAt: () => 0 });
const director = new Director({ camera, world: {}, flight, wind, groundAt, canopyAt: () => 0, spots, landmarks, trees });
// Supported fixture parameters: a repeatable opening and a shorter bubble life.
director.rand = mulberry32(8113);
director.placeAtSpot(0);
director.dispYaw = director.yaw;
director.dispPitch = director.pitch;
director.mainLife = 28;

// Rendering is deliberately separate from the extracted camera technique.
// Fourfold display radii make the tiny bubbles legible in a 16:9 inline frame.
const bubbleMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false,
  vertexShader: `varying vec3 vN; varying vec3 vV;
    void main() { vec4 p = modelViewMatrix * vec4(position, 1.0);
      vN = normalize(normalMatrix * normal); vV = -p.xyz;
      gl_Position = projectionMatrix * p; }`,
  fragmentShader: `varying vec3 vN; varying vec3 vV;
    void main() { vec3 n = normalize(vN); float f = 1.0 - abs(dot(n, normalize(vV)));
      vec3 rainbow = 0.6 + 0.4 * cos(n.y * 8.0 + n.x * 3.0 + vec3(0., 2., 4.));
      float rim = pow(f, 2.5);
      float shine = pow(max(dot(n, normalize(vec3(-0.5, 0.8, 1.0))), 0.0), 65.0);
      gl_FragColor = vec4(mix(rainbow, vec3(1.0), shine), 0.06 + rim * 0.72 + shine * 0.6); }`,
});
const sphere = new THREE.SphereGeometry(1, 32, 20);
const bubbleMeshes = [];
const wand = new THREE.Group();
const wandMat = material('#cd8298');
wand.add(new THREE.Mesh(new THREE.TorusGeometry(0.032, 0.0036, 8, 40), wandMat));
const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.004, 0.15, 8), wandMat);
handle.position.y = -0.108;
wand.add(handle);
scene.add(wand);

let timeScale = 1, helpers = false, drag = null;
const keys = new Set();
// Same input signs, drag threshold and API calls as original main.js.
canvas.addEventListener('pointerdown', event => {
  canvas.focus();
  drag = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: 0 };
  canvas.setPointerCapture(event.pointerId);
});
canvas.addEventListener('pointermove', event => {
  if (!drag || event.pointerId !== drag.id) return;
  const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
  drag.x = event.clientX; drag.y = event.clientY;
  drag.moved += Math.abs(dx) + Math.abs(dy);
  if (drag.moved > 6) {
    director.look(dx, dy, canvas.clientHeight);
    canvas.classList.add('dragging');
  }
});
function endDrag(event, cancel = false) {
  if (!drag || (event && event.pointerId !== drag.id)) return;
  if (!cancel && drag.moved <= 6) director.click();
  director.endLook();
  drag = null;
  canvas.classList.remove('dragging');
}
canvas.addEventListener('pointerup', event => endDrag(event));
canvas.addEventListener('pointercancel', event => endDrag(event, true));
canvas.addEventListener('lostpointercapture', event => endDrag(event, true));
window.addEventListener('keydown', event => {
  if (event.target instanceof HTMLButtonElement) return;
  if (['Space', 'Enter'].includes(event.code)) { event.preventDefault(); director.click(); }
  if (event.code.startsWith('Arrow')) { event.preventDefault(); keys.add(event.code); }
});
window.addEventListener('keyup', event => keys.delete(event.code));
function releaseInput() {
  keys.clear(); endDrag(null, true); director.endLook(); director.lookKeys(0, 0, 0);
}
window.addEventListener('blur', releaseInput);
document.addEventListener('visibilitychange', () => { if (document.hidden) releaseInput(); });
$('#restart').addEventListener('click', () => { releaseInput(); director.restart(); });
$('#slow').addEventListener('click', event => {
  timeScale = timeScale === 1 ? 0.25 : 1;
  event.currentTarget.setAttribute('aria-pressed', String(timeScale !== 1));
});
$('#helpers').addEventListener('click', event => {
  helpers = !helpers;
  event.currentTarget.setAttribute('aria-pressed', String(helpers));
  $('#guides').hidden = !helpers;
});

function resize() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.fov = w < h ? 64 : 52;
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe($('#stage'));
resize();
const shotLabels = { title: tr({ zh: "准备吹泡泡", en: "Ready to blow bubbles" }), ready: tr({ zh: "下一段旅程", en: "Next journey" }), blow: tr({ zh: "吹出泡泡", en: "Blow a bubble" }), follow: tr({ zh: "跟随 · 穿入泡泡", en: "Follow · Enter the bubble" }), ride: tr({ zh: "泡泡里 · 随风漂流", en: "Inside the bubble · Drifting with the wind" }), pop: tr({ zh: "泡泡破了", en: "Bubble popped" }), after: tr({ zh: "淡出 · 切换机位", en: "Fade out · Switch viewpoint" }), fadein: tr({ zh: "新的机位", en: "New viewpoint" }), restart: tr({ zh: "淡出", en: "Fade out" }), restartIn: tr({ zh: "新的机位", en: "New viewpoint" }) };
const history = [];
let previousState = '', frameCount = 0, last = performance.now();
const projected = new THREE.Vector3();
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.05) * timeScale;
  last = now;
  wind.update(dt);
  flight.update(dt);
  director.lookKeys(dt, Number(keys.has('ArrowLeft')) - Number(keys.has('ArrowRight')), Number(keys.has('ArrowUp')) - Number(keys.has('ArrowDown')));
  director.update(dt);
  if (previousState !== director.state) {
    history.push({ state: director.state, time: director.time, spot: director.spotIdx });
    if (history.length > 100) history.shift();
    previousState = director.state;
    $('#shot').textContent = shotLabels[director.state];
  }
  const list = director.renderList();
  while (bubbleMeshes.length < list.length) {
    const item = new THREE.Mesh(sphere, bubbleMat);
    scene.add(item); bubbleMeshes.push(item);
  }
  bubbleMeshes.forEach((item, i) => {
    item.visible = i < list.length;
    if (!item.visible) return;
    const b = list[i];
    item.position.set(b.x, b.y, b.z);
    item.scale.setScalar(b.r * 4 * b.vis);
  });
  wand.visible = director.wand.visible;
  wand.position.copy(director.wand.pos);
  wand.quaternion.copy(director.wand.quat);
  wand.rotateX(-0.25); wand.rotateZ(0.15);
  $('#film').style.opacity = String(director.film * 0.7);
  $('#fade').style.opacity = String(Math.max(director.fade, director.flash * 0.35));
  $('#ownership').textContent = director.manual.w > 0.01 ? tr({ zh: "手动看四周", en: "Manual look-around" }) : tr({ zh: "自动取景", en: "Automatic framing" });
  let targetNDC = null;
  if (director.main) {
    projected.copy(director.main.pos).project(camera);
    targetNDC = projected.toArray();
  }
  const targetVisible = helpers && ['blow', 'follow'].includes(director.state) && targetNDC && Math.abs(projected.x) < 1 && Math.abs(projected.y) < 1 && Math.abs(projected.z) < 1;
  $('#target').hidden = !targetVisible;
  if (targetVisible) {
    $('#target').style.left = `${(projected.x + 1) * 50}%`;
    $('#target').style.top = `${(1 - projected.y) * 50}%`;
  }
  renderer.render(scene, camera);
  frameCount++;
  // Observations only: browser tests cannot replace the director or advance time.
  window.__example = {
    state: director.state, time: director.time, stateTime: director.t, frameCount,
    spot: director.spotIdx, position: camera.position.toArray(), quaternion: camera.quaternion.toArray(),
    yaw: director.dispYaw, autoYaw: director.yaw, pitch: director.dispPitch,
    manual: { ...director.manual }, focus: director.focus, aperture: director.aperture,
    film: director.film, fade: director.fade, pop: director.pop, popReason: director.popReason ?? null,
    main: director.main ? { position: director.main.pos.toArray(), age: director.main.age, life: director.main.life } : null,
    targetNDC, bubbleCount: list.length, timeScale, helpers, history: history.map(item => ({ ...item })),
    aspect: camera.aspect,
  };
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
