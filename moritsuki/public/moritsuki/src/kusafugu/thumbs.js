// 図鑑・結果・知らせのアイコン（フグを斜め前から描いた PNG）。puffed: ふくらんだ絵も
import * as THREE from 'three';
import { Fugu } from './fugu.js';
import { FUGU } from './species.js';
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
  sc.add(new THREE.HemisphereLight('#ffffff', '#6a6070', 1.5));
  const key = new THREE.DirectionalLight('#fff6e8', 2.6);
  key.position.set(1.5, 3, 2.5);
  sc.add(key);
  const rim = new THREE.DirectionalLight('#9fc0ff', 1.1);
  rim.position.set(-2, 1, -2);
  sc.add(rim);
  const pm = new THREE.PMREMGenerator(r);
  const env = new THREE.Scene(); env.background = new THREE.Color('#8a96aa');
  sc.environment = pm.fromScene(env).texture;
  const cam = new THREE.PerspectiveCamera(24, W / H, 0.001, 20);
  const tide = U.uTide.value, fog = U.uAirFog.value, hi = U.uHeadI.value;
  U.uTide.value = -99; U.uAirFog.value = 0; U.uHeadI.value = 0;
  const shot = (id, puff) => {
    const f = new Fugu(id, 20, 0.37);
    f.setPuff(puff);
    f.pose(puff ? 'float' : 'swim', 0.13);
    const g = new THREE.Group();
    g.add(f.group);
    f.group.rotation.set(0.05, -1.05, 0);
    sc.add(g);
    g.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(g);
    const c = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3());
    const dir = new THREE.Vector3(0.05, 0.35, 1).normalize();
    const fit = Math.max(size.y * 1.1, Math.hypot(size.x, size.z) / (W / H)) * 0.6;
    cam.position.copy(c).addScaledVector(dir, fit / Math.tan(THREE.MathUtils.degToRad(12)));
    cam.lookAt(c);
    r.render(sc, cam);
    const url = r.domElement.toDataURL('image/png');
    sc.remove(g);
    f.dispose();
    return url;
  };
  for (const id of ids) {
    if (!FUGU[id]) continue;
    out[id] = shot(id, 0);
    out[id + '_puff'] = shot(id, 1);
  }
  U.uTide.value = tide; U.uAirFog.value = fog; U.uHeadI.value = hi;
  pm.dispose();
  r.dispose();
  r.forceContextLoss();
  return out;
}
