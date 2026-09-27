// 図鑑・結果・知らせのアイコン（貝を斜め上から描いた PNG）
import * as THREE from 'three';
import { makeShell } from './clams.js';
import { SHELLS } from './species.js';
import { U } from './shade.js';

export function renderThumbs(ids) {
  const out = {};
  const W = 256, H = 160;
  const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  r.setSize(W, H);
  r.setPixelRatio(1);
  r.toneMapping = THREE.ACESFilmicToneMapping;
  r.outputColorSpace = THREE.SRGBColorSpace;
  const sc = new THREE.Scene();
  sc.add(new THREE.HemisphereLight('#ffffff', '#8a7860', 1.5));
  const key = new THREE.DirectionalLight('#fff6e8', 2.6);
  key.position.set(1.5, 4, 3);
  sc.add(key);
  const cam = new THREE.PerspectiveCamera(24, W / H, 0.001, 20);
  const tide = U.uTide.value, fog = U.uAirFog.value;
  U.uTide.value = -99; U.uAirFog.value = 0;
  for (const id of ids) {
    const sp = SHELLS[id];
    const cm = sp.size[1] * 0.85;
    const s = makeShell(id, cm, 0.37);
    const g = new THREE.Group();
    g.add(s.mesh);
    // 二枚貝は殻の面を見せる（少し傾ける）。巻き貝は上から
    if (sp.kind === 'clam' || sp.kind === 'valve') { s.mesh.rotation.set(0, 0.25, 0); }
    else if (sp.kind === 'snail' || sp.kind === 'moon') s.mesh.rotation.set(0.9, 0, 0);
    sc.add(g);
    g.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(g);
    const c = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3());
    const dir = new THREE.Vector3(0.25, 0.3, 1).normalize();
    const fit = Math.max(size.y, size.x / (W / H)) * 0.62;
    cam.position.copy(c).addScaledVector(dir, fit / Math.tan(THREE.MathUtils.degToRad(12)) + size.z);
    cam.lookAt(c);
    r.render(sc, cam);
    out[id] = r.domElement.toDataURL('image/png');
    sc.remove(g);
  }
  U.uTide.value = tide; U.uAirFog.value = fog;
  r.dispose();
  r.forceContextLoss();
  return out;
}
