// 獲物の展示用モデルと、図鑑・持ち物のアイコン（銛一本と吉山の町で共通。魚の形・模様を直すと両方に反映される）
import * as THREE from 'three';
import { SPECIES } from './species.js';
import { makeFishMesh, makeOctopusMesh, makeLobsterMesh } from './models.js';
import { makeUrchin, makeTurban, makeAbalone, pickupMaterial } from '../world/shells.js';

const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

// 展示用モデル（図鑑・獲れたよー・焼き魚）。thumb = アイコン用（長さ 1）
export function makeDisplayModel(id, cm, thumb = false) {
  const sp = SPECIES[id];
  if (sp) {
    const built = sp.model === 'octopus' ? makeOctopusMesh() : sp.model === 'lobster' ? makeLobsterMesh() : makeFishMesh(sp);
    const len = thumb ? 1 : (cm || sp.size[0]) / 100;
    built.mesh.scale.setScalar(len);
    if (sp.flat && thumb) built.mesh.rotation.z = 0;
    return built;
  }
  const geo = id === 'uni' ? makeUrchin() : id === 'sazae' ? makeTurban() : makeAbalone();
  const mesh = new THREE.Mesh(geo, pickupMaterial());
  mesh.scale.setScalar(thumb ? 1 : 2.2);
  return { mesh, sw: null };
}

// アイコンを描く（320×160 の PNG の data URL）。{ id: url } を返す
export function renderThumbs(ids) {
  const out = {};
  const W = 320, H = 160;
  const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  r.setSize(W, H);
  r.setPixelRatio(1);
  r.toneMapping = THREE.ACESFilmicToneMapping;
  r.outputColorSpace = THREE.SRGBColorSpace;
  const sc = new THREE.Scene();
  sc.add(new THREE.HemisphereLight('#ffffff', '#806850', 1.6));
  const key = new THREE.DirectionalLight('#ffffff', 2.6);
  key.position.set(2, 4, 3);
  sc.add(key);
  const cam = new THREE.PerspectiveCamera(22, W / H, 0.01, 50);
  for (const id of ids) {
    const m = makeDisplayModel(id, null, true);
    const g = new THREE.Group();
    g.add(m.mesh);
    g.position.y = 10;
    if (SPECIES[id] && !SPECIES[id].model) {
      m.mesh.rotation.y = 0;
      cam.position.set(3.3, 10.05, 0);
    } else if (id === 'tako') {
      g.rotation.y = -0.6;
      cam.position.set(1.6, 11.6, 1.6);
    } else if (id === 'iseebi') {
      g.rotation.y = Math.PI / 2;
      cam.position.set(1.2, 11.5, 2.2);
    } else {
      cam.position.set(0.12, 10.12, 0.3);
    }
    sc.add(g);
    g.updateMatrixWorld(true);
    // イセエビは長い触角ではなく体に合わせて寄る（触角は画面の外へ伸びてよい）
    const box = id === 'iseebi'
      ? new THREE.Box3(V3(-0.28, -0.17, -0.56), V3(0.28, 0.16, 0.66)).applyMatrix4(m.mesh.matrixWorld)
      : new THREE.Box3().setFromObject(g);
    const c = box.getCenter(V3());
    const size = box.getSize(V3());
    const dir = cam.position.clone().sub(V3(0, 10, 0)).normalize();
    const fitH = Math.max(size.y, size.x / (W / H) * 0.9, size.z / (W / H) * 0.9);
    const dist = (fitH * 0.62) / Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)) + Math.max(size.x, size.z) * 0.5;
    cam.position.copy(c).addScaledVector(dir, dist);
    cam.lookAt(c);
    r.render(sc, cam);
    out[id] = r.domElement.toDataURL('image/png');
    sc.remove(g);
  }
  r.dispose();
  r.forceContextLoss();
  return out;
}
