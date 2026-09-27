import { tr } from './i18n.js';
import * as THREE from 'three';
import { BubbleRenderer } from '../original/render/bubbles.js';
import { bakeSky, skySH, skyTexture } from '../original/render/sky.js';
import { buildNoiseTexture } from '../original/render/worldtex.js';
import { FS_VS } from '../original/render/post.js';

const canvas = document.querySelector('#world');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
renderer.autoClear = false;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1;
const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 200);
const center = new THREE.Vector3(0, 3, 0);
let yaw = 0, pitch = 0.12, distance = 6.2;
let paused = false, overlap = false, frame = 0;

// A flat two-by-two world is enough for the original environment ray marcher.
// These are host fixtures, not replacements for any bubble shader or noise.
const heights = new Float32Array(16);
for (let i = 0; i < 4; i++) heights.set([0, -10000, 0, 0], i * 4);
const terrain = new THREE.DataTexture(heights, 2, 2, THREE.RGBAFormat, THREE.FloatType);
terrain.needsUpdate = true;
const clearClouds = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
clearClouds.needsUpdate = true;
const sun = new THREE.Vector3(-0.36, 0.78, 0.51).normalize();
const sky = bakeSky(sun.toArray(), { haze: 3.2 });
const { sh, ground } = skySH(sky, sun.toArray());
const shared = {
  uTime: { value: 12 }, uFrame: { value: 0 },
  uSunDir: { value: sun }, uSunCol: { value: new THREE.Vector3(...sky.sunColor) },
  uSH: { value: sh }, uWind: { value: new THREE.Vector4(1, 0, 1.5, 0.8) },
  uWindOff: { value: new THREE.Vector2() }, uCloudOff: { value: new THREE.Vector2() },
  uCloud: { value: new THREE.Vector4(1250, 2350, 0.5, 12000) },
  uFog: { value: new THREE.Vector4(0.00024, 0.0015, 0, 0) },
  uFogCol: { value: new THREE.Vector3(...sky.fogColor) },
  uFogSun: { value: new THREE.Vector3(...sky.sunColor).multiplyScalar(0.18) },
  uWorld: { value: new THREE.Vector4(-768, 1536, 2, 0) },
  uGroundCol: { value: new THREE.Vector3(...ground) },
  tHW: { value: terrain }, tNoise: { value: buildNoiseTexture() },
  tCloudCov: { value: clearClouds }, tSky: { value: skyTexture(sky) },
};
const depthUniforms = {
  uCam: { value: new THREE.Vector3(camera.near, camera.far, 0) },
  uProjInv: { value: camera.projectionMatrixInverse },
  uViewInv: { value: camera.matrixWorld },
};
const bubbles = new BubbleRenderer(shared, depthUniforms, 2);
const primary = { x: 0, y: 3, z: 0, r: 1, phase: 1.7, film: 420, age: 0.35, vis: 1 };
const secondary = { x: 0.85, y: 3.15, z: -0.65, r: 0.82, phase: 4.2, film: 420, age: 0.35, vis: 1 };

const scene = new THREE.Scene();
scene.background = new THREE.Color('#101a20');
const blocker = new THREE.Mesh(
  new THREE.BoxGeometry(0.32, 2.7, 0.16),
  new THREE.MeshBasicMaterial({ color: '#cedace' }),
);
blocker.position.set(0, 3, 1.45);
blocker.visible = false;
scene.add(blocker);
const opaque = new THREE.WebGLRenderTarget(1, 1, {
  type: THREE.HalfFloatType, depthTexture: new THREE.DepthTexture(1, 1, THREE.UnsignedIntType),
});
const composite = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: false });
const copyMaterial = new THREE.ShaderMaterial({
  uniforms: { t: { value: opaque.texture } }, vertexShader: FS_VS,
  fragmentShader: 'uniform sampler2D t; varying vec2 vUv; void main() { gl_FragColor = texture2D(t, vUv); }',
  depthTest: false, depthWrite: false, toneMapped: false,
});
const outputMaterial = new THREE.ShaderMaterial({
  uniforms: { t: { value: composite.texture } }, vertexShader: FS_VS,
  fragmentShader: `uniform sampler2D t; varying vec2 vUv;
    void main() {
      gl_FragColor = texture2D(t, vUv);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
  depthTest: false, depthWrite: false,
});
const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), copyMaterial);
quad.frustumCulled = false;
const screen = new THREE.Scene();
screen.add(quad);
const screenCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const size = new THREE.Vector2();
const focus = new THREE.Vector3(distance, 0, 36);

function resize() {
  // Same effective DPR cap as the original's highest-quality viewport.
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.25));
  renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
  renderer.getDrawingBufferSize(size);
  opaque.setSize(size.x, size.y);
  composite.setSize(size.x, size.y);
  camera.aspect = canvas.clientWidth / canvas.clientHeight;
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(canvas);
resize();

// The original game's drag-to-look convention, adapted to orbit a fixed subject.
// BubbleRenderer itself has no input module; the game routes pointer deltas in main.js.
let drag = null;
canvas.addEventListener('pointerdown', event => {
  drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
  canvas.setPointerCapture(event.pointerId);
});
canvas.addEventListener('pointermove', event => {
  if (!drag || drag.id !== event.pointerId) return;
  yaw -= (event.clientX - drag.x) * 3 / canvas.clientHeight;
  pitch = THREE.MathUtils.clamp(pitch + (event.clientY - drag.y) * 3 / canvas.clientHeight, -0.7, 0.9);
  drag.x = event.clientX; drag.y = event.clientY;
});
function endDrag() { drag = null; }
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);
canvas.addEventListener('lostpointercapture', endDrag);
canvas.addEventListener('wheel', event => {
  event.preventDefault();
  distance = THREE.MathUtils.clamp(distance * Math.exp(event.deltaY * 0.001), 4, 10);
}, { passive: false });
document.querySelector('#thickness').addEventListener('input', event => {
  primary.film = secondary.film = Number(event.target.value);
  document.querySelector('#thickness-value').value = tr({ zh: `${primary.film} 纳米`, en: `${primary.film} nm` });
});
function toggle(id, apply) {
  const button = document.querySelector(`#${id}`);
  button.addEventListener('click', () => {
    const active = button.getAttribute('aria-pressed') !== 'true';
    button.setAttribute('aria-pressed', String(active));
    apply(active);
  });
}
toggle('pause', value => { paused = value; });
toggle('overlap', value => { overlap = value; });
toggle('depth', value => { blocker.visible = value; });
document.querySelector('#reset').addEventListener('click', () => { yaw = 0; pitch = 0.12; distance = 6.2; });

let last = performance.now();
document.addEventListener('visibilitychange', () => { last = performance.now(); drag = null; });
function render(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  if (!paused && !document.hidden) shared.uTime.value += dt;
  shared.uFrame.value = frame++;
  camera.position.set(
    Math.sin(yaw) * Math.cos(pitch) * distance,
    center.y + Math.sin(pitch) * distance,
    Math.cos(yaw) * Math.cos(pitch) * distance,
  );
  camera.lookAt(center);
  camera.updateMatrixWorld();
  focus.x = distance;
  renderer.setRenderTarget(opaque);
  renderer.clear();
  renderer.render(scene, camera);
  quad.material = copyMaterial;
  renderer.setRenderTarget(composite);
  renderer.clear();
  renderer.render(screen, screenCamera);
  bubbles.update(overlap ? [primary, secondary] : [primary], camera, size.x, size.y, focus, opaque.depthTexture);
  bubbles.probe(renderer, camera);
  bubbles.render(renderer, camera, composite);
  quad.material = outputMaterial;
  renderer.setRenderTarget(null);
  renderer.render(screen, screenCamera);

  // Read-only snapshot of the actual camera, submitted instance buffers and uniforms.
  window.__example = {
    ready: true, frame, time: bubbles.uniforms.uTime.value, paused,
    camera: camera.position.toArray(), yaw, pitch, distance,
    film: bubbles.iData.array[1], age: bubbles.iData.array[2],
    instances: bubbles.geo.instanceCount,
    positions: Array.from(bubbles.iPos.array.slice(0, bubbles.geo.instanceCount * 4)),
    instanceData: Array.from(bubbles.iData.array.slice(0, bubbles.geo.instanceCount * 4)),
    depthEnabled: blocker.visible, depthBound: bubbles.uniforms.tDepth.value === opaque.depthTexture,
    environment: [bubbles.envRT.width, bubbles.envRT.height],
    filmNoise: [bubbles.filmU.value.image.width, bubbles.filmU.value.image.height, bubbles.filmU.value.image.depth],
    resolution: size.toArray(), dpr: renderer.getPixelRatio(),
  };
  requestAnimationFrame(render);
}
requestAnimationFrame(render);
