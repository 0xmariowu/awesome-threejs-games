import { v as THREE } from '../original/assets/three.webgpu-DTZfZZb9.js';
import { OrbitControls } from '../original/assets/OrbitControls-DnFMDpyt.js';
import { init, t } from './ui.js';
import strings from './i18n.js';
export { THREE, t };

// Only archived Tupi asset requests are relocated. The archive stays byte-identical.
const nativeFetch = globalThis.fetch.bind(globalThis);
export function assetURL(value) {
  const url = new URL(value, location.href);
  if (url.origin !== location.origin) return value;
  const prefix = '/demos/tupi/';
  const hostBase = new URL('../', import.meta.url).pathname;
  const originalBase = new URL('../original/', import.meta.url).pathname;
  if (url.pathname.startsWith(prefix)) url.pathname = originalBase + url.pathname.slice(prefix.length);
  else if (url.pathname.startsWith(hostBase + 'models/')) url.pathname = originalBase + url.pathname.slice(hostBase.length);
  return url.href;
}
globalThis.fetch = (input, options) => {
  const url = assetURL(input instanceof Request ? input.url : String(input));
  return nativeFetch(input instanceof Request ? new Request(url, input) : url, options);
};
THREE.DefaultLoadingManager.setURLModifier(assetURL);

export async function setup(position, target) {
  init(strings);
  const canvas = document.querySelector('canvas');
  const renderer = new THREE.WebGPURenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  await renderer.init();
  if (!renderer.backend.isWebGPUBackend) throw new Error('WebGPU is required');
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, .1, 12000);
  camera.position.set(...position);
  const controls = new OrbitControls(camera, canvas);
  controls.target.set(...target);
  controls.minDistance = 2;
  controls.maxDistance = 1800;
  controls.maxPolarAngle = Math.PI * .49;
  controls.update();
  const resize = () => {
    const {width, height} = canvas.getBoundingClientRect();
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(canvas);
  resize();
  const context = {renderer, scene, camera, params: new URLSearchParams('noshadow&nospecies&capture'),
    quality: {}, time: 0, modules: {camera: true}};
  return {...context, context, controls};
}
export function fail(error) {
  document.querySelector('#status').textContent = t({en: 'Unable to start: ', zh: '无法启动：'}) + error.message;
  console.error(error);
}
export function readout(renderer, extra) {
  const { triangles, drawCalls } = renderer.info.render;
  document.querySelector('#status').textContent = extra + '\n' + t({en: 'Triangles / draws: ', zh: '三角形 / 绘制次数：'}) + triangles.toLocaleString() + ' / ' + drawCalls;
}
