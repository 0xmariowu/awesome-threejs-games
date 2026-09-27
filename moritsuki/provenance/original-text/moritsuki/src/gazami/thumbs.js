// 図鑑・結果・知らせのアイコン（カニを斜め上から描いた PNG）
import * as THREE from 'three';
import { Crab } from './crabs.js';
import { CRABS } from './species.js';
import { U } from './shade.js';

export function renderThumbs(ids) {
  const out = {};
  const W = 256, H = 180;
  const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  r.setSize(W, H);
  r.setPixelRatio(1);
  r.toneMapping = THREE.ACESFilmicToneMapping;
  r.outputColorSpace = THREE.SRGBColorSpace;
  const sc = new THREE.Scene();
  sc.add(new THREE.HemisphereLight('#ffffff', '#6a6070', 1.6));
  const key = new THREE.DirectionalLight('#fff6e8', 2.8);
  key.position.set(1.2, 4, 2.5);
  sc.add(key);
  const rim = new THREE.DirectionalLight('#9fc0ff', 1.2);
  rim.position.set(-2, 1, -2);
  sc.add(rim);
  const pm = new THREE.PMREMGenerator(r);
  const env = new THREE.Scene(); env.background = new THREE.Color('#8a96aa');
  sc.environment = pm.fromScene(env).texture;
  const cam = new THREE.PerspectiveCamera(26, W / H, 0.001, 20);
  const tide = U.uTide.value, fog = U.uAirFog.value, hi = U.uHeadI.value;
  U.uTide.value = -99; U.uAirFog.value = 0; U.uHeadI.value = 0;
  for (const id of ids) {
    const sp = CRABS[id];
    const crab = new Crab(id, sp.size[1] * 0.85, 0.37, { wet: 0.6 });
    crab.t = 1.3;
    crab.pose('walk', 0);
    const g = new THREE.Group();
    g.add(crab.group);
    crab.group.rotation.y = -0.35;
    sc.add(g);
    g.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(g);
    const c = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3());
    const dir = new THREE.Vector3(0.12, 0.85, 0.75).normalize();
    const fit = Math.max(size.z * 0.8, size.x / (W / H)) * 0.58;
    cam.position.copy(c).addScaledVector(dir, fit / Math.tan(THREE.MathUtils.degToRad(13)) + size.y);
    cam.lookAt(c);
    r.render(sc, cam);
    out[id] = r.domElement.toDataURL('image/png');
    sc.remove(g);
    crab.dispose();
  }
  U.uTide.value = tide; U.uAirFog.value = fog; U.uHeadI.value = hi;
  pm.dispose();
  r.dispose();
  r.forceContextLoss();
  return out;
}
