// 登場人物を three.js で組み立てる: 骨・素材（肌・髪・布）・顔・小物（ポニーテール・手ぬぐい・メガネ・ペン）
// 形（距離関数のメッシュ）は natsumi.js / isogai.js をワーカー（people.worker.js）で作る。
import * as THREE from 'three';
import * as natsumi from './natsumi.js';
import * as isogai from './isogai.js';
import { BONES, PARENT } from './human.js';
import { faceAtlas, faceMaterial } from './face.js';
import { canvasPrint } from './prints.js';

export const CHARS = { natsumi, isogai };

// ワーカーから届いた配列 → BufferGeometry
function toGeometry(m) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(m.pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(m.nrm, 3));
  g.setIndex(new THREE.BufferAttribute(m.idx, 1));
  if (m.skinIndex) {
    g.setAttribute('skinIndex', new THREE.BufferAttribute(m.skinIndex, 4));
    g.setAttribute('skinWeight', new THREE.BufferAttribute(m.skinWeight, 4));
  }
  if (m.color) g.setAttribute('color', new THREE.BufferAttribute(m.color, 3));
  if (m.dir) g.setAttribute('hairDir', new THREE.BufferAttribute(m.dir, 3));
  if (m.extra) g.setAttribute('extra', new THREE.BufferAttribute(m.extra, 1));
  if (m.extra2) g.setAttribute('extra2', new THREE.BufferAttribute(m.extra2, 1));
  g.computeBoundingSphere();
  return g;
}

// 形をワーカーで並行して作る（使えなければその場で）
async function buildParts(id) {
  const C = CHARS[id];
  const url = new URL('./people.worker.js', import.meta.url);
  try {
    const res = await Promise.all(C.PART_GROUPS.map((parts) => new Promise((resolve, reject) => {
      const w = new Worker(url, { type: 'module' });
      w.onmessage = (e) => { resolve(e.data); w.terminate(); };
      w.onerror = (e) => { reject(e); w.terminate(); };
      w.postMessage({ id, parts });
    })));
    return Object.assign({}, ...res);
  } catch (e) {
    console.warn('people worker failed, building on main thread', e);
    const out = {};
    for (const g of C.PART_GROUPS) for (const n of g) out[n] = C.buildPart(n);
    return out;
  }
}

// ---------- 素材 ----------
const SKIN = { roughness: 0.56, sheen: 0.35, sheenColor: new THREE.Color('#ff8f70'), sheenRoughness: 0.5 };

// 髪: 毛の流れ（hairDir）にそった細い溝と、流れに沿って伸びるつや（天使の輪）
// swing: ポニーテール用。extra（付け根からの長さ）の 2 乗で uSwing だけずらす
function hairMaterial(hex, { vertexColors = false, swing = false, spec = 1 } = {}) {
  const m = new THREE.MeshPhysicalMaterial({
    color: vertexColors ? '#ffffff' : hex, vertexColors, roughness: 0.6,
    sheen: 0.18, sheenRoughness: 0.4, sheenColor: new THREE.Color('#8a6a56'), envMapIntensity: 0.3, specularIntensity: 0.55,
  });
  const u = { uSwing: { value: new THREE.Vector3() }, uSpec: { value: spec } };
  m.userData.u = u;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
attribute vec3 hairDir;
${swing ? 'attribute float extra; uniform vec3 uSwing;' : ''}
varying vec3 vHT; varying vec3 vHP; varying vec3 vHT0; varying vec3 vHN0;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
${swing ? 'transformed += uSwing * extra * extra;' : ''}
vHP = position; vHT0 = hairDir; vHN0 = normal;
vHT = normalize(normalMatrix * hairDir);`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vHT; varying vec3 vHP; varying vec3 vHT0; varying vec3 vHN0;
uniform float uSpec;
vec3 hairT;`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
{
  vec3 b0 = normalize(cross(vHN0, vHT0));
  float w = dot(vHP, b0) * 900.0 + sin(dot(vHP, vHT0) * 60.0) * 1.2;
  float g = sin(w) * 0.5 + sin(w * 2.3 + 1.7) * 0.3;
  hairT = normalize(vHT - normal * dot(vHT, normal));
  vec3 bt = normalize(cross(normal, hairT));
  normal = normalize(normal + bt * g * 0.2);
  diffuseColor.rgb *= 0.88 + 0.12 * sin(w * 0.37 + 0.5);
}`)
      .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
#if NUM_DIR_LIGHTS > 0
{
  vec3 L = directionalLights[0].direction;
  vec3 V = normalize(vViewPosition);
  vec3 Hh = normalize(L + V);
  vec3 T1 = normalize(hairT + normal * 0.1), T2 = normalize(hairT - normal * 0.15);
  float d1 = dot(T1, Hh), d2 = dot(T2, Hh);
  float s1 = pow(sqrt(max(0.0, 1.0 - d1 * d1)), 420.0);
  float s2 = pow(sqrt(max(0.0, 1.0 - d2 * d2)), 70.0);
  float nl = clamp(dot(normal, L) * 0.7 + 0.3, 0.0, 1.0);
  // 毛の束ごとにつやを途切れさせる
  float brk = 0.55 + 0.45 * sin(dot(vHP, vHT0) * 140.0 + dot(vHP, cross(vHN0, vHT0)) * 380.0);
  reflectedLight.directSpecular += directionalLights[0].color * (vec3(s1 * 0.09) + s2 * 0.25 * diffuseColor.rgb) * nl * uSpec * brk;
}
#endif`);
  };
  m.customProgramCacheKey = () => 'hair2' + (swing ? 's' : '') + (vertexColors ? 'v' : '');
  return m;
}

// 布: 頂点色＋起毛感（sheen）
const cloth = (o = {}) => new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.9, sheen: 0.5, sheenRoughness: 0.6, sheenColor: new THREE.Color('#ffffff'), ...o });
// 1 枚の布（白衣・前掛け）: 両面を描き、裏は少し暗く
const BACK_DARK = `#include <color_fragment>
if (!gl_FrontFacing) diffuseColor.rgb *= 0.72;`;
function sheet(o = {}) {
  const m = cloth({ side: THREE.DoubleSide, ...o });
  m.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <color_fragment>', BACK_DARK); };
  m.customProgramCacheKey = () => 'sheet';
  return m;
}

// ボーダーの T シャツ: extra = 縞の座標（負なら無地）
function stripeMaterial(navy, period = 0.026, duty = 0.4) {
  const m = cloth({ sheenColor: new THREE.Color('#dfe6ff') });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float extra; attribute float extra2; varying float vStripe; varying float vMask;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvStripe = extra; vMask = extra2;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vStripe; varying float vMask;')
      .replace('#include <color_fragment>', `#include <color_fragment>
{
  float p = vStripe / ${period.toFixed(4)};
  float f = fract(p), w = min(fwidth(p) * 0.8 + 0.01, 0.2);
  float s = smoothstep(${duty.toFixed(3)} - w, ${duty.toFixed(3)} + w, f) * (1.0 - smoothstep(1.0 - w, 1.0, f));
  // 縞が細かすぎて潰れる所（遠く・縫い目）は平均の色へ
  s = mix(s, 1.0 - ${duty.toFixed(3)}, smoothstep(0.12, 0.3, fwidth(p)));
  diffuseColor.rgb = mix(vec3(${navy.map((v) => v.toFixed(4)).join(',')}), diffuseColor.rgb, mix(1.0, s, clamp(vMask, 0.0, 1.0)));
}`);
  };
  m.customProgramCacheKey = () => 'stripe';
  return m;
}

// 前掛け: 正面に白抜きの屋号（静止ポーズの xy に貼る）
function apronMaterial() {
  const m = cloth({ roughness: 0.95, sheen: 0.7, sheenColor: new THREE.Color('#9fb0e0'), side: THREE.DoubleSide });
  const tex = canvasPrint('apron');
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uPrint = { value: tex };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vRP; varying float vRN;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRP = position; vRN = normal.z;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vRP; varying float vRN; uniform sampler2D uPrint;')
      .replace('#include <color_fragment>', `#include <color_fragment>
if (!gl_FrontFacing) diffuseColor.rgb *= 0.72;
{
  vec2 uv = vec2((vRP.x + 0.15) / 0.3, (0.9 - vRP.y) / 0.3);
  if (gl_FrontFacing && uv.x > 0.0 && uv.x < 1.0 && uv.y > 0.0 && uv.y < 1.0 && vRN > 0.2 && vRP.z > 0.06) {
    vec4 p = texture2D(uPrint, vec2(uv.x, 1.0 - uv.y));
    diffuseColor.rgb = mix(diffuseColor.rgb, p.rgb, p.a * 0.95);
  }
}`);
  };
  m.customProgramCacheKey = () => 'apron';
  return m;
}

// 手ぬぐい（赤の豆絞り）: 頭のローカル座標の格子で白い点を打つ
function tenuguiMaterial() {
  const m = new THREE.MeshPhysicalMaterial({ color: '#b3232b', roughness: 0.92, sheen: 0.6, sheenRoughness: 0.5, sheenColor: new THREE.Color('#ffb0a0') });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vBP;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvBP = position;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vBP;
vec3 h3(vec3 p) { p = fract(p * vec3(0.1031, 0.1030, 0.0973)); p += dot(p, p.yxz + 33.33); return fract((p.xxy + p.yxx) * p.zyx); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
{
  vec3 q = vBP * 105.0;
  vec3 c = floor(q);
  float d = 9.0;
  for (int i = -1; i <= 1; i++) for (int j = -1; j <= 1; j++) for (int k = -1; k <= 1; k++) {
    vec3 cc = c + vec3(float(i), float(j), float(k));
    vec3 o = cc + 0.2 + h3(cc) * 0.6;
    d = min(d, length(q - o));
  }
  float w = fwidth(d) + 0.02;
  diffuseColor.rgb = mix(vec3(0.93, 0.9, 0.86), diffuseColor.rgb, smoothstep(0.26 - w, 0.26 + w, d));
}`);
  };
  m.customProgramCacheKey = () => 'tenugui';
  return m;
}

// ---------- 組み立て ----------
export async function buildPerson(id) {
  const t0 = performance.now();
  const C = CHARS[id];
  const partsP = buildParts(id);
  const atlas = faceAtlas(id, C.FACE);
  const M = await partsP;
  const R = C.RIG, J = R.J;
  const root = new THREE.Group();
  root.name = id;

  // 骨
  const bones = {};
  for (const n of BONES) { const b = new THREE.Bone(); b.name = n; bones[n] = b; }
  for (const n of BONES) {
    const b = bones[n], p = R.BONE_POS[n];
    if (n === 'base') { root.add(b); continue; }
    const q = R.BONE_POS[PARENT[n]];
    b.position.set(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
    bones[PARENT[n]].add(b);
  }
  root.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(BONES.map((n) => bones[n]));
  const meshes = [];
  const track = (m) => { m.castShadow = true; m.receiveShadow = true; meshes.push(m); return m; };
  const skinned = (geo, mat) => {
    const m = track(new THREE.SkinnedMesh(geo, mat));
    m.frustumCulled = false;
    root.add(m);
    m.bind(skeleton, new THREE.Matrix4());
    return m;
  };
  const parts = {};
  const skinMat = new THREE.MeshPhysicalMaterial({ ...SKIN, vertexColors: true });
  parts.body = skinned(toGeometry(M.body), skinMat);

  // 靴: 足首の骨とつま先の骨で曲げる（左右で同じ形）
  const shoeMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: id === 'isogai' ? 0.42 : 0.8 });
  for (const s of ['L', 'R']) {
    const m = M.shoe, n = m.count, an = J[s].an;
    const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
    const B = C.B;
    for (let v = 0; v < n; v++) {
      si[v * 4] = B['foot' + s]; si[v * 4 + 1] = B['toe' + s];
      sw[v * 4] = 1 - m.extra[v]; sw[v * 4 + 1] = m.extra[v];
    }
    const geo = toGeometry({ pos: m.pos.slice(), nrm: m.nrm.slice(), idx: m.idx, color: m.color, skinIndex: si, skinWeight: sw });
    geo.translate(an[0], an[1], an[2]);
    parts['shoe' + s] = skinned(geo, shoeMat);
  }

  // 手（手首の骨に付ける。右手は左手の鏡像）。形を 3 種類（ふつう・指さし・にぎり）持って切りかえる
  const handMat = new THREE.MeshPhysicalMaterial({ ...SKIN, color: C.SKIN_HEX });
  const hands = { L: {}, R: {} };
  for (const s of ['L', 'R']) {
    const x = s === 'L' ? 1 : -1;
    for (const [k, key] of [['relaxed', 'hand'], ['point', 'handPoint'], ['fist', 'handFist']]) {
      const src = M[key];
      const geo = toGeometry({ pos: src.pos.slice(), nrm: src.nrm.slice(), idx: src.idx.slice() });
      if (x < 0) { geo.scale(-1, 1, 1); geo.index.array.reverse(); }
      const m = track(new THREE.Mesh(geo, handMat));
      m.rotation.z = x * R.aLo;
      m.visible = k === 'relaxed';
      bones['hand' + s].add(m);
      hands[s][k] = m;
    }
  }

  // 頭（頭の骨に付ける）
  const headRig = new THREE.Group();
  bones.head.add(headRig);
  const hc = [0, 1, 2].map((k) => C.HEAD_C[k] - J.head[k]);
  headRig.position.set(...hc);
  headRig.scale.setScalar(C.HEAD_SCALE || 1); // 頭まわりは少し大きめ（頭の中心で拡大）
  const faceMat = faceMaterial(id, C.FACE, atlas, { ...SKIN, color: C.SKIN_HEX });
  const headGeo = toGeometry(M.head);
  const head = track(new THREE.Mesh(headGeo, faceMat));
  headRig.add(head);
  const hairMat = hairMaterial(C.HAIR_HEX, { vertexColors: !!M.hair.color, spec: id === 'isogai' ? 0.45 : 1 });
  const hair = track(new THREE.Mesh(toGeometry(M.hair), hairMat));
  headRig.add(hair);

  const extra = { hairMat };
  if (id === 'natsumi') {
    parts.tee = skinned(toGeometry(M.tee), stripeMaterial([0.035, 0.05, 0.13]));
    parts.pants = skinned(toGeometry(M.pants), cloth({ roughness: 0.82, sheen: 0.3, sheenColor: new THREE.Color('#8890a0') }));
    parts.apron = skinned(toGeometry(M.apron), apronMaterial());
    // ポニーテール（付け根で揺れる）
    const ponyMat = hairMaterial(C.HAIR_HEX, { swing: true });
    const pony = track(new THREE.Mesh(toGeometry(M.pony), ponyMat));
    pony.position.set(...natsumi.PONY.base);
    headRig.add(pony);
    const tie = track(new THREE.Mesh(toGeometry(M.tie), new THREE.MeshStandardMaterial({ color: '#1c1a1d', roughness: 0.6 })));
    tie.position.set(...natsumi.PONY.base);
    headRig.add(tie);
    const band = track(new THREE.Mesh(toGeometry(M.band), tenuguiMaterial()));
    headRig.add(band);
    // 小さな銀のフープのピアス
    const silver = new THREE.MeshStandardMaterial({ color: '#e8e6e2', metalness: 1, roughness: 0.22 });
    for (const s of [1, -1]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.0062, 0.00085, 8, 28), silver);
      ring.position.set(s * 0.0855, -0.0485, -0.0075);
      ring.rotation.y = Math.PI / 2 - s * 0.25;
      ring.castShadow = true;
      headRig.add(ring);
    }
    extra.pony = { mesh: pony, u: ponyMat.userData.u };
  } else {
    parts.shirt = skinned(toGeometry(M.shirt), cloth({ roughness: 0.78, sheen: 0.35, sheenColor: new THREE.Color('#eef4ff') }));
    parts.tie = skinned(toGeometry(M.tie), cloth({ roughness: 0.55, sheen: 0.8, sheenColor: new THREE.Color('#ff9aa8') }));
    parts.trousers = skinned(toGeometry(M.trousers), cloth({ roughness: 0.85, sheen: 0.35, sheenColor: new THREE.Color('#c0b8b0') }));
    parts.coat = skinned(toGeometry(M.coat), sheet({ roughness: 0.82, sheen: 0.35, sheenRoughness: 0.5, sheenColor: new THREE.Color('#e8f0ff') }));
    const beard = track(new THREE.Mesh(toGeometry(M.beard), hairMaterial('#ffffff', { vertexColors: true, spec: 0.5 })));
    headRig.add(beard);
    headRig.add(buildGlasses(headGeo, C.FACE));
    bones.chest.add(buildPens(J));
  }

  let tris = 0;
  root.traverse((o) => { if (o.isMesh) tris += o.geometry.index ? o.geometry.index.count / 3 : o.geometry.attributes.position.count / 3; });
  return { id, root, bones, skeleton, parts, hands, meshes, face: faceMat.userData.face, headRig, extra, stats: { ms: performance.now() - t0, tris } };
}

// ---------- 丸メガネ（金の細いふち）: 頭のメッシュから目の前の顔の面を探して置く ----------
function buildGlasses(headGeo, F) {
  const g = new THREE.Group();
  const P = headGeo.attributes.position;
  const eyeSurf = (s) => {
    const th = (s * F.eye.x) / F.R;
    let best = null;
    for (let i = 0; i < P.count; i++) {
      const x = P.getX(i), y = P.getY(i), z = P.getZ(i);
      if (Math.abs(y - F.eye.y) > 0.004 || z < 0.03) continue;
      if (Math.abs(Math.atan2(x, z) - th) > 0.05) continue;
      const r = Math.hypot(x, z);
      if (!best || r > best.r) best = { r, x, z };
    }
    const r = best ? best.r : F.R;
    return [Math.sin(th) * r, F.eye.y, Math.cos(th) * r];
  };
  const gold = new THREE.MeshStandardMaterial({ color: '#9a7a44', metalness: 1, roughness: 0.3 });
  const lensMat = new THREE.MeshPhysicalMaterial({ color: '#ffffff', transparent: true, opacity: 0.1, roughness: 0.04, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.03, depthWrite: false, envMapIntensity: 2.2 });
  const R0 = 0.0205, zOff = 0.0125;
  const rims = [];
  for (const s of [1, -1]) {
    const p = eyeSurf(s);
    const yaw = Math.atan2(p[0], p[2]) * 0.55;
    const c = new THREE.Vector3(p[0] + Math.sin(yaw) * zOff, p[1] + 0.0008, p[2] + Math.cos(yaw) * zOff);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(R0, 0.0014, 8, 48), gold);
    rim.position.copy(c); rim.rotation.y = yaw;
    const lens = new THREE.Mesh(new THREE.SphereGeometry(R0 * 3.2, 24, 8, 0, Math.PI * 2, 0, 0.32).rotateX(Math.PI / 2).translate(0, 0, -R0 * 3.2 * Math.cos(0.32) + 0.0012), lensMat);
    lens.position.copy(c); lens.rotation.y = yaw;
    lens.renderOrder = 2;
    g.add(rim, lens);
    rims.push({ c, yaw, s });
    // つる: ふちの外側から耳へ
    const a = new THREE.Vector3(c.x + s * Math.cos(yaw) * R0, c.y + 0.004, c.z - s * Math.sin(yaw) * R0);
    const e = new THREE.Vector3(s * 0.089, F.eye.y + 0.003, -0.016);
    const len = a.distanceTo(e);
    const tg = new THREE.CylinderGeometry(0.0011, 0.0011, len, 6).rotateX(Math.PI / 2);
    const temple = new THREE.Mesh(tg, gold);
    temple.position.copy(a).add(e).multiplyScalar(0.5);
    temple.lookAt(temple.position.clone().add(e.clone().sub(a)));
    g.add(temple);
    // 耳にかかる先
    const hook = new THREE.Mesh(new THREE.CylinderGeometry(0.0012, 0.0009, 0.028, 6), gold);
    hook.position.set(e.x + s * 0.001, e.y - 0.011, e.z - 0.007);
    hook.rotation.x = -0.5;
    g.add(hook);
    // 鼻あて
    const pad = new THREE.Mesh(new THREE.SphereGeometry(0.0022, 8, 6).scale(0.6, 1.3, 0.4), lensMat);
    pad.position.set(c.x - s * R0 * 0.75, c.y - R0 * 0.55, c.z - 0.006);
    g.add(pad);
  }
  // ブリッジ（上へ弧を描く）
  const [a, b] = rims;
  const mid = new THREE.Vector3().addVectors(a.c, b.c).multiplyScalar(0.5);
  const half = a.c.distanceTo(b.c) / 2 - R0;
  const br = new THREE.Mesh(new THREE.TorusGeometry(half, 0.0013, 6, 16, Math.PI), gold);
  br.position.set(mid.x, mid.y + 0.002, mid.z + 0.001);
  g.add(br);
  g.traverse((o) => { if (o.isMesh && o.material === gold) o.castShadow = true; });
  return g;
}

// ---------- 胸ポケットのペン（胸の骨に付ける）----------
function buildPens(J) {
  const g = new THREE.Group();
  const specs = [
    { x: 0.078, col: '#1d2a5a', h: 0.03, clip: '#c9ccd0' },
    { x: 0.095, col: '#b52a2a', h: 0.024, clip: '#c9ccd0' },
    { x: 0.114, col: '#d8dadc', h: 0.036, clip: '#8a8e92', metal: true },
  ];
  for (const p of specs) {
    const mat = new THREE.MeshStandardMaterial({ color: p.col, roughness: p.metal ? 0.3 : 0.4, metalness: p.metal ? 0.9 : 0.05 });
    const len = 0.13;
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.0046, 0.0046, len, 12), mat);
    const top = 1.29 + p.h - J.chest[1];
    body.position.set(p.x, top - len / 2, 0.121 - J.chest[2]);
    body.rotation.x = -0.14;
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.0046, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), mat);
    cap.position.set(0, len / 2, 0);
    body.add(cap);
    const clip = new THREE.Mesh(new THREE.BoxGeometry(0.0022, 0.045, 0.0016), new THREE.MeshStandardMaterial({ color: p.clip, metalness: 1, roughness: 0.25 }));
    clip.position.set(0, len / 2 - 0.024, 0.0056);
    body.add(clip);
    body.castShadow = true;
    g.add(body);
  }
  return g;
}
