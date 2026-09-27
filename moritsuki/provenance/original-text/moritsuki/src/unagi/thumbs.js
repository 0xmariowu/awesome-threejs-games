// 図鑑・結果・知らせのアイコン（生き物を横から描いた PNG）
import * as THREE from 'three';
import { SpineSet } from './spine.js';
import { crabGeo, shrimpGeo, crayfishGeo, frogGeo, critterMaterial } from './critters.js';
import { FISH, buildFishGeometry, fishMaterialMaker } from './fish/fishmodel.js';
import { SPECIES } from './species.js';
import { U } from './shade.js';

const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const SPINES = {
  eel: { J: 30, fish: FISH.unagi },
  loach: { J: 14, fish: FISH.dojo },
  catfish: { J: 16, fish: FISH.namazu },
  bass: { J: 12, fish: FISH.suzuki },
};
const CRITS = { crab: crabGeo, shrimp: shrimpGeo, crayfish: crayfishGeo, frog: frogGeo };
const X0 = 60; // 側溝の外で描く（水の下の処理がかからない）

// 関節の体の見せ方: 向き（yaw: 0 = 頭がこちら）・見下ろす角度・枠（体の座標の範囲）
const CRIT_VIEW = {
  crab: { yaw: 0.35, elev: 0.62, box: [[-1.15, 1.15], [0, 0.35], [-0.75, 0.95]] },
  shrimp: { yaw: -Math.PI / 2 + 0.25, elev: 0.42, box: [[-0.2, 0.2], [0, 0.15], [-0.55, 1.25]] },
  crayfish: { yaw: -Math.PI / 2 + 0.3, elev: 0.5, box: [[-0.25, 0.25], [0, 0.16], [-0.58, 0.95]] },
  frog: { yaw: -0.8, elev: 0.38, box: [[-0.4, 0.4], [0, 0.36], [-0.5, 0.55]] },
};
/** 1 匹だけの関節の体（図鑑・確認用） */
export function critterMesh(kind, { raise = 0, curl = 0, walk = 0 } = {}) {
  const g = CRITS[kind]();
  g.setAttribute('aAnim', new THREE.InstancedBufferAttribute(new Float32Array([walk, walk ? 1 : 0, raise, curl]), 4));
  g.setAttribute('aVis', new THREE.InstancedBufferAttribute(new Float32Array([1]), 1));
  const m = new THREE.InstancedMesh(g, critterMaterial('thumb-' + kind), 1);
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, CRIT_VIEW[kind].yaw, 0, 'YXZ'));
  m.setMatrixAt(0, new THREE.Matrix4().compose(V3(X0, 0, 0), q, V3(1, 1, 1)));
  m.userData.q = q;
  return m;
}
/** 枠の 8 隅がおさまるようにカメラを置く */
export function frameCritter(cam, kind, aspect, elev = CRIT_VIEW[kind].elev, fill = 1.04) {
  const v = CRIT_VIEW[kind];
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, v.yaw, 0, 'YXZ'));
  const pts = [];
  for (const x of v.box[0]) for (const y of v.box[1]) for (const z of v.box[2]) pts.push(V3(x, y, z).applyQuaternion(q).add(V3(X0, 0, 0)));
  const c = pts.reduce((a, p) => a.add(p), V3()).multiplyScalar(1 / pts.length);
  const dir = V3(0, Math.sin(elev), Math.cos(elev));
  cam.up.set(0, 1, 0);
  cam.position.copy(c).addScaledVector(dir, 10);
  cam.lookAt(c);
  cam.updateMatrixWorld();
  const vfov = THREE.MathUtils.degToRad(cam.fov);
  const tv = Math.tan(vfov / 2), th = tv * aspect;
  let need = 0;
  const inv = cam.matrixWorldInverse;
  for (const p of pts) {
    const l = p.clone().applyMatrix4(inv);
    const dz = -l.z - 10;
    need = Math.max(need, Math.abs(l.x) / th - dz, Math.abs(l.y) / tv - dz);
  }
  cam.position.copy(c).addScaledVector(dir, need * fill);
  cam.lookAt(c);
}

export function renderThumbs(ids, scale = 1) {
  const out = {};
  const W = 256 * scale, H = 128 * scale;
  const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  r.setSize(W, H);
  r.setPixelRatio(1);
  r.toneMapping = THREE.ACESFilmicToneMapping;
  r.outputColorSpace = THREE.SRGBColorSpace;
  const sc = new THREE.Scene();
  sc.add(new THREE.HemisphereLight('#ffffff', '#6a6458', 1.6));
  const key = new THREE.DirectionalLight('#fff6e8', 2.6);
  key.position.set(X0 + 1.5, 4, 3);
  key.target.position.set(X0, 0, 0);
  sc.add(key, key.target);
  const cam = new THREE.PerspectiveCamera(22, W / H, 0.001, 50);
  const fog = U.uFog.value, lampI = U.uLampI.value;
  U.uFog.value = 0; U.uLampI.value = 0;
  for (const id of ids) {
    const sp = SPECIES[id];
    const cm = sp.size[1] * 0.85;
    let obj;
    if (SPINES[sp.body]) {
      const def = SPINES[sp.body];
      const fish = sp.body === 'bass' && sp.legend ? FISH.suzukiBig : def.fish;
      const set = new SpineSet(sc, { J: def.J, max: 1, geo: buildFishGeometry(fish), key: 'thumb-' + fish.key, makeMaterial: fishMaterialMaker(fish) });
      const L = sp.body === 'eel' ? 1 : 1;
      set.alloc(L, 0.37);
      const pts = [], ups = [];
      for (let j = 0; j < def.J; j++) {
        const t = j / (def.J - 1);
        // ウナギはゆるい S 字、ほかはほぼまっすぐ（頭が左）
        const bend = sp.body === 'eel' ? Math.sin(t * Math.PI * 1.6) * 0.06 : sp.body === 'loach' ? Math.sin(t * Math.PI) * 0.03 : 0;
        pts.push(V3(X0 - 0.5 + t * L, bend, 0));
        ups.push(V3(0, 0, 1));   // 横から見る: 体の上をこちら（+z）へ向けないよう、背が +y になるよう後で回す
      }
      // 背を上（+y）、右を手前（+z）: 体の「上」= +y
      for (const u of ups) u.set(0, 1, 0);
      // 横倒しにせず、側面をカメラへ向ける（カメラは +z から見る）
      set.write(0, pts, ups);
      set.commit();
      obj = set.mesh;
    } else {
      obj = critterMesh(sp.body, { raise: sp.body === 'crab' ? 0.35 : 0.15 });
      sc.add(obj);
    }
    obj.frustumCulled = false;
    if (!SPINES[sp.body]) frameCritter(cam, sp.body, W / H);
    else {
      // 大きさに合わせてカメラを置く（生き物の長さ = 1 で作ってある）
      const size = 1.15;
      const c = V3(X0, 0, 0);
      const dist = size / 2 / Math.tan(THREE.MathUtils.degToRad(22 * W / H) / 2) * 1.02;
      cam.position.set(c.x + 0.05, c.y + 0.35 * 0.4, dist);
      cam.lookAt(c);
    }
    r.render(sc, cam);
    out[id] = r.domElement.toDataURL('image/png');
    sc.remove(obj);
    void cm;
    if (!SPINES[sp.body]) obj.geometry.dispose();
  }
  U.uFog.value = fog; U.uLampI.value = lampI;
  r.dispose();
  r.forceContextLoss();
  return out;
}

/** 確認用: 関節の体を好きな向き・大きさで 1 枚描く（?debug の確認でだけ使う） */
export function critterShot(kind, { yaw = null, elev = null, W = 900, H = 600, fill = 1.04, lamp = false, ...anim } = {}) {
  const r = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  r.setSize(W, H); r.setPixelRatio(1);
  r.toneMapping = THREE.ACESFilmicToneMapping; r.outputColorSpace = THREE.SRGBColorSpace;
  r.setClearColor('#1c2026');
  const sc = new THREE.Scene();
  sc.add(new THREE.HemisphereLight('#ffffff', '#6a6458', lamp ? 0.3 : 1.6));
  const key = new THREE.DirectionalLight('#fff6e8', 2.6);
  key.position.set(X0 + 1.5, 4, 3); key.target.position.set(X0, 0, 0);
  sc.add(key, key.target);
  const cam = new THREE.PerspectiveCamera(22, W / H, 0.001, 50);
  const v = CRIT_VIEW[kind], y0 = v.yaw;
  if (yaw !== null) v.yaw = yaw;
  const m = critterMesh(kind, anim);
  m.frustumCulled = false;
  sc.add(m);
  frameCritter(cam, kind, W / H, elev ?? v.elev, fill);
  v.yaw = y0;
  const fog = U.uFog.value, lampI = U.uLampI.value;
  U.uFog.value = 0; if (!lamp) U.uLampI.value = 0;
  r.render(sc, cam);
  U.uFog.value = fog; U.uLampI.value = lampI;
  const url = r.domElement.toDataURL('image/jpeg', 0.9);
  m.geometry.dispose(); r.dispose(); r.forceContextLoss();
  return url;
}
