import { tr } from './i18n.js';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import './style.css';
import './ui.css';

type Asset = { source: string; path: string; bytes: number };
type Stats = { meshes: number; triangles: number; vertices: number; materials: number; vertexColors: boolean; bytes: number };
const status = document.querySelector<HTMLParagraphElement>('#status')!;
const viewer = document.querySelector<HTMLDivElement>('#viewer')!;
const wireButton = document.querySelector<HTMLButtonElement>('#wireframe')!;
const colorsButton = document.querySelector<HTMLButtonElement>('#vertex-colors')!;
const distantButton = document.querySelector<HTMLButtonElement>('#distant')!;
const assetName = (asset: Asset) => asset.path.split('/').pop()!;
const formatBytes = (bytes: number) => `${(bytes / 1024).toFixed(1)} KiB`;
let current = '', stats: Readonly<Stats> | null = null;
Object.defineProperty(window, '__models', { get: () => Object.freeze({ current, stats }) });

function fail(message: string) {
  status.hidden = false;
  status.setAttribute('role', 'alert');
  status.textContent = message;
}

function materialsOf(root: THREE.Object3D) {
  const materials = new Set<THREE.MeshStandardMaterial>();
  root.traverse(object => {
    if (object instanceof THREE.Mesh) {
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material);
    }
  });
  return materials;
}

function dispose(root: THREE.Object3D) {
  root.traverse(object => { if (object instanceof THREE.Mesh) object.geometry.dispose(); });
  const textures = new Set<THREE.Texture>();
  for (const material of materialsOf(root)) {
    for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
    material.dispose();
  }
  textures.forEach(texture => texture.dispose());
}

async function boot() {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('webgl2', { antialias: true });
  if (!context) throw new Error(tr({ zh: "无法启动 WebGL 2。请启用浏览器硬件加速后重新加载。", en: "Cannot start WebGL 2. Enable browser hardware acceleration and reload." }));
  const renderer = new THREE.WebGLRenderer({ canvas, context, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  viewer.append(canvas);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#e3ebef');
  scene.add(new THREE.HemisphereLight('#ffffff', '#9aa5af', 2.5));
  const key = new THREE.DirectionalLight('#ffffff', 3);
  key.position.set(6, 10, 8);
  scene.add(key);
  const fill = new THREE.DirectionalLight('#dfeeff', 1.5);
  fill.position.set(-8, 4, -6);
  scene.add(fill);
  const grid = new THREE.GridHelper(8, 16, '#93a9b4', '#c5d2d9');
  scene.add(grid);
  const camera = new THREE.PerspectiveCamera(40, 1, .01, 500);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 1.2;
  controls.maxPolarAngle = Math.PI / 2 + .08;
  const resize = () => {
    const width = viewer.clientWidth, height = viewer.clientHeight;
    renderer.setSize(width, height);
    camera.aspect = width / Math.max(1, height);
    camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(viewer);
  resize();
  let contextLost = false;
  canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    contextLost = true;
    fail(tr({ zh: "图形上下文已中断。请重新加载页面继续查看模型。", en: "Graphics context lost. Reload the page to continue viewing models." }));
  });
  let assets: Asset[];
  try {
    const response = await fetch('./provenance.json');
    if (!response.ok) throw new Error();
    assets = (await response.json()).assets;
  } catch { throw new Error(tr({ zh: "模型清单加载失败。请重新运行 build.mjs，并检查本地服务。", en: "Model manifest failed to load. Run build.mjs again and check the local server." })); }
  const names = new Set(assets.map(assetName));
  const list = document.querySelector<HTMLDivElement>('#model-list')!;
  document.querySelector<HTMLElement>('#model-count')!.textContent = String(assets.length);
  const entries = new Map<string, { button: HTMLButtonElement; detail: HTMLElement }>();
  let root: THREE.Object3D | undefined, requestId = 0;
  let wireframe = false, vertexColors = true;
  const loader = new GLTFLoader();
  const applyMaterials = () => {
    if (!root) return;
    for (const material of materialsOf(root)) {
      material.wireframe = wireframe;
      material.vertexColors = vertexColors;
      material.needsUpdate = true;
    }
  };
  const baseName = (name: string) => name.replace(/-distant\.glb$/, '.glb');
  const distantName = (name: string) => baseName(name).replace(/\.glb$/, '-distant.glb');

  async function select(name: string) {
    const asset = assets.find(item => assetName(item) === name);
    if (!asset) return;
    const id = ++requestId;
    status.hidden = false;
    status.setAttribute('role', 'status');
    status.textContent = tr({ zh: `正在加载 ${name}……`, en: `Loading ${name}…` });
    distantButton.disabled = true;
    try {
      const loaded = (await loader.loadAsync(`./assets/${name}`)).scene;
      if (id !== requestId) { dispose(loaded); return; }
      const next: Stats = { meshes: 0, triangles: 0, vertices: 0, materials: materialsOf(loaded).size, vertexColors: false, bytes: asset.bytes };
      loaded.traverse(object => {
        if (!(object instanceof THREE.Mesh)) return;
        next.meshes++;
        const geometry = object.geometry;
        next.vertices += geometry.getAttribute('position').count;
        next.triangles += (geometry.index?.count ?? geometry.getAttribute('position').count) / 3;
        next.vertexColors ||= Boolean(geometry.getAttribute('color'));
      });
      if (root) { scene.remove(root); dispose(root); }
      root = loaded;
      const bounds = new THREE.Box3().setFromObject(root);
      const center = bounds.getCenter(new THREE.Vector3());
      const size = bounds.getSize(new THREE.Vector3());
      const scale = 4 / Math.max(size.x, size.y, size.z, .001);
      root.scale.multiplyScalar(scale);
      root.position.sub(center.multiplyScalar(scale));
      root.position.y += size.y * scale / 2;
      scene.add(root);
      controls.target.set(0, size.y * scale / 2, 0);
      // Fit both portrait and landscape viewports without cropping the asset.
      const distance = 3 / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2)) / Math.min(1, camera.aspect);
      camera.position.copy(controls.target).add(new THREE.Vector3(.7, .4, 1).normalize().multiplyScalar(distance));
      controls.minDistance = 1;
      controls.maxDistance = distance * 4;
      controls.update();
      current = name;
      stats = Object.freeze(next);
      applyMaterials();
      entries.forEach((entry, key) => entry.button.setAttribute('aria-pressed', String(key === name)));
      entries.get(name)!.detail.textContent = tr({ zh: `${next.meshes} 网格 · ${next.triangles.toLocaleString()} 三角形 · ${next.vertices.toLocaleString()} 顶点 · ${next.materials} 材质 · 顶点色${next.vertexColors ? tr({ zh: "有", en: "Yes" }) : tr({ zh: "无", en: "No" })}`, en: `${next.meshes} meshes · ${next.triangles.toLocaleString()} triangles · ${next.vertices.toLocaleString()} vertices · ${next.materials} materials · Vertex colors: ${next.vertexColors ? tr({ zh: "有", en: "Yes" }) : tr({ zh: "无", en: "No" })}` });
      document.querySelector<HTMLElement>('#model-name')!.textContent = name;
      const info = document.querySelector<HTMLDListElement>('#model-stats')!;
      info.replaceChildren();
      for (const [label, value] of [
        [tr({ zh: "文件大小", en: "File size" }), `${asset.bytes.toLocaleString()} B`], [tr({ zh: "网格", en: "Meshes" }), next.meshes], [tr({ zh: "三角形", en: "Triangles" }), next.triangles.toLocaleString()],
        [tr({ zh: "顶点", en: "Vertices" }), next.vertices.toLocaleString()], [tr({ zh: "材质", en: "Materials" }), next.materials], [tr({ zh: "含顶点色", en: "Has vertex colors" }), next.vertexColors ? tr({ zh: "有", en: "Yes" }) : tr({ zh: "无", en: "No" })],
      ]) {
        const term = document.createElement('dt'), description = document.createElement('dd');
        term.textContent = String(label); description.textContent = String(value);
        info.append(term, description);
      }
      distantButton.setAttribute('aria-pressed', String(name.endsWith('-distant.glb')));
      distantButton.disabled = !(names.has(baseName(name)) && names.has(distantName(name)));
      const url = new URL(location.href);
      url.searchParams.set('model', name);
      history.replaceState(null, '', url);
      if (!contextLost) status.hidden = true;
    } catch {
      if (id === requestId) {
        fail(tr({ zh: `模型 ${name} 加载失败。请重新运行 build.mjs，或从左侧选择其他模型。`, en: `Model ${name} failed to load. Run build.mjs again or select another model from the list.` }));
        distantButton.disabled = !current || !(names.has(baseName(current)) && names.has(distantName(current)));
      }
    }
  }
  for (const asset of assets) {
    const name = assetName(asset);
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'model-item'; button.dataset.model = name;
    button.setAttribute('aria-pressed', 'false');
    const title = document.createElement('strong'), size = document.createElement('small'), detail = document.createElement('small');
    title.textContent = name; size.textContent = formatBytes(asset.bytes); detail.className = 'asset-stats';
    button.append(title, size, detail);
    button.addEventListener('click', () => { void select(name); button.blur(); });
    list.append(button); entries.set(name, { button, detail });
  }
  wireButton.addEventListener('click', () => {
    wireframe = !wireframe; wireButton.setAttribute('aria-pressed', String(wireframe)); applyMaterials(); wireButton.blur();
  });
  colorsButton.addEventListener('click', () => {
    vertexColors = !vertexColors; colorsButton.setAttribute('aria-pressed', String(vertexColors));
    colorsButton.textContent = tr({ zh: `顶点色：${vertexColors ? tr({ zh: "开", en: "On" }) : tr({ zh: "关", en: "Off" })}`, en: `Vertex colors: ${vertexColors ? tr({ zh: "开", en: "On" }) : tr({ zh: "关", en: "Off" })}` }); applyMaterials(); colorsButton.blur();
  });
  distantButton.addEventListener('click', () => {
    void select(current.endsWith('-distant.glb') ? baseName(current) : distantName(current)); distantButton.blur();
  });
  let last = performance.now();
  function frame(now: number) {
    if (contextLost) return;
    controls.update(Math.min((now - last) / 1000, .1));
    last = now;
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  const requested = new URLSearchParams(location.search).get('model') ?? 'airship.glb';
  const name = requested.endsWith('.glb') ? requested : `${requested}.glb`;
  await select(names.has(name) ? name : 'airship.glb');
  requestAnimationFrame(frame);
}

boot().catch(error => fail(error instanceof Error ? error.message : tr({ zh: "模型工作台启动失败，请重新加载页面。", en: "Model workbench failed to start. Please reload the page." })));
