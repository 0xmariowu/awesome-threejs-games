// 主人公（麦わら帽子の男の子）を three.js で組み立てる: 骨・素材・帽子
// 体・服・髪などの形は shapes.js（ワーカーで作る）。座標: 足もとが原点、y が上、+z が前。左手は +x 側。
import * as THREE from 'three';
import { J, HEAD_C, HEAD_SCALE, A_LO, BONES, B, PARENT, BONE_POS, HEAD_GEO, SKIN_HEX, PART_GROUPS, buildPart } from './shapes.js';
import { sstep, mix } from './sdf.js';
import { strawTextures, ribbonTextures, faceAtlas, shirtPrint, FACE, CELL, STRAW_ROWS } from './textures.js';

export { J };

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
  g.computeBoundingSphere();
  return g;
}

// 形をワーカーで並行して作る（使えなければその場で）
async function buildParts() {
  const url = new URL('./kid.worker.js', import.meta.url);
  try {
    const res = await Promise.all(PART_GROUPS.map((parts) => new Promise((resolve, reject) => {
      const w = new Worker(url, { type: 'module' });
      w.onmessage = (e) => { resolve(e.data); w.terminate(); };
      w.onerror = (e) => { reject(e); w.terminate(); };
      w.postMessage({ parts });
    })));
    return Object.assign({}, ...res);
  } catch (e) {
    console.warn('kid worker failed, building on main thread', e);
    const out = {};
    for (const g of PART_GROUPS) for (const n of g) out[n] = buildPart(n);
    return out;
  }
}

// ---------- 麦わら帽子（かぶり口の中心がローカル原点）----------
const HAT = { rOpenX: 0.13, rOpenZ: 0.136, crownH: 0.108, rTop: 0.121, rBrim: 0.25, thick: 0.0055 };

// 断面: s（弧長）に沿った点 [r, y]。外側の上面 → つば → 裏 → 内側
function hatProfile() {
  const pts = [];
  const push = (r, y, part) => pts.push({ r, y, part });
  // 天井（わずかに丸い）
  for (let i = 0; i <= 16; i++) { const r = (HAT.rTop - 0.014) * (i / 16); push(r, HAT.crownH - 0.004 - 0.1 * r * r, 'top'); }
  // 天井のかど
  const c0 = [HAT.rTop - 0.014, HAT.crownH - 0.004 - 0.1 * (HAT.rTop - 0.014) ** 2 - 0.013];
  for (let i = 1; i <= 8; i++) { const a = (i / 8) * (Math.PI / 2); push(c0[0] + Math.sin(a) * 0.014, c0[1] + Math.cos(a) * 0.013, 'top'); }
  // 側面（下へ少し広がる）
  for (let i = 1; i <= 12; i++) { const t = i / 12; push(mix(HAT.rTop, 0.14, t), mix(c0[1], 0.006, t), 'side'); }
  // つばの付け根
  for (let i = 1; i <= 4; i++) { const a = (i / 4) * (Math.PI / 2); push(0.14 + 0.006 - Math.cos(a) * 0.006, 0.006 - Math.sin(a) * 0.006, 'brim'); }
  // つば（外に行くほど下がる）
  const droop = (r) => -0.02 * Math.max(0, (r - 0.146) / (HAT.rBrim - 0.146)) ** 1.6;
  for (let i = 1; i <= 24; i++) { const r = mix(0.146, HAT.rBrim, i / 24); push(r, droop(r), 'brim'); }
  // へり（丸く折り返す）
  const e = [HAT.rBrim, droop(HAT.rBrim) - HAT.thick / 2];
  for (let i = 1; i <= 8; i++) { const a = (i / 8) * Math.PI; push(e[0] + Math.sin(a) * HAT.thick * 0.62, e[1] + Math.cos(a) * HAT.thick / 2, 'edge'); }
  // 裏
  for (let i = 1; i <= 24; i++) { const r = mix(HAT.rBrim, 0.136, i / 24); push(r, droop(r) - HAT.thick, 'under'); }
  // 内側
  for (let i = 1; i <= 10; i++) { const t = i / 10; push(mix(0.134, HAT.rTop - 0.006, t), mix(-HAT.thick, HAT.crownH - 0.012, t), 'inner'); }
  for (let i = 1; i <= 10; i++) { const r = (HAT.rTop - 0.006) * (1 - i / 10); push(r, HAT.crownH - 0.012 - 0.1 * r * r, 'inner'); }
  let s = 0;
  pts[0].s = 0;
  for (let i = 1; i < pts.length; i++) { s += Math.hypot(pts[i].r - pts[i - 1].r, pts[i].y - pts[i - 1].y); pts[i].s = s; }
  return pts;
}

// 回転体を帯ごとに作る（帯ごとに一周の繰り返し数 N を変えて編み目の大きさをそろえる）
function latheBands(profile, bands, { seg = 120, wave, rowH, shade }) {
  const P = [], N = [], UV = [], C = [], I = [];
  let part = '';
  const pos = (th, s, out) => {
    // s の位置を断面から補間
    let i = 1;
    while (i < profile.length - 1 && profile[i].s < s) i++;
    const a = profile[i - 1], b = profile[i], t = (s - a.s) / (b.s - a.s || 1);
    part = t < 0.5 ? a.part : b.part;
    let r = mix(a.r, b.r, t), y = mix(a.y, b.y, t);
    y += wave(th, r);
    const sx = HAT.rOpenX / 0.14, sz = HAT.rOpenZ / 0.14;
    out[0] = Math.sin(th) * r * sx; out[1] = y; out[2] = Math.cos(th) * r * sz;
    return out;
  };
  const p0 = [0, 0, 0], p1 = [0, 0, 0], p2 = [0, 0, 0];
  for (const bd of bands) {
    const base = P.length / 3;
    const ns = Math.max(2, Math.ceil((bd.s1 - bd.s0) / 0.0055));
    for (let j = 0; j <= ns; j++) {
      const s = mix(bd.s0, bd.s1, j / ns);
      for (let i = 0; i <= seg; i++) {
        const th = (i / seg) * Math.PI * 2;
        pos(th + 1e-3, s, p1);
        pos(th, s, p0);
        const k = shade(part, s);
        pos(th, Math.min(s + 1e-3, profile[profile.length - 1].s), p2);
        const s2 = s + 1e-3 > profile[profile.length - 1].s;
        if (s2) pos(th, s - 1e-3, p2);
        const ax = p1[0] - p0[0], ay = p1[1] - p0[1], az = p1[2] - p0[2];
        let bx = p2[0] - p0[0], by = p2[1] - p0[1], bz = p2[2] - p0[2];
        if (s2) { bx = -bx; by = -by; bz = -bz; }
        let nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
        const l = Math.hypot(nx, ny, nz);
        P.push(...p0);
        if (l < 1e-12) N.push(0, part === 'inner' ? -1 : 1, 0); // 回転の中心
        else N.push(-nx / l, -ny / l, -nz / l);
        UV.push((i / seg) * bd.n, s / rowH);
        C.push(k, k, k);
      }
    }
    for (let j = 0; j < ns; j++) for (let i = 0; i < seg; i++) {
      const a = base + j * (seg + 1) + i, b = a + 1, c = a + seg + 1, d = c + 1;
      I.push(a, c, b, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
  g.setIndex(I);
  return g;
}

function buildHat(mats, bowMesh) {
  const prof = hatProfile();
  const rowW = 0.0072, rowH = rowW * STRAW_ROWS;
  const total = prof[prof.length - 1].s;
  const sAt = (part, which) => { const q = prof.filter((p) => p.part === part); return which ? q[q.length - 1].s : q[0].s; };
  const snap = (s) => Math.round(s / rowW) * rowW;
  // r から s（外側の上面・裏のそれぞれで）
  const sOfR = (part, r) => { const q = prof.filter((p) => p.part === part); let best = q[0]; for (const p of q) if (Math.abs(p.r - r) < Math.abs(best.r - r)) best = p; return best.s; };
  const brimEnd = sAt('edge', 1);
  const bands = [
    { s0: 0, s1: snap(sOfR('top', 0.035)), n: 4, part: 'top' },
    { s0: snap(sOfR('top', 0.035)), s1: snap(sOfR('top', 0.075)), n: 9, part: 'top' },
    { s0: snap(sOfR('top', 0.075)), s1: snap(sAt('side', 1)), n: 15, part: 'side' },
    { s0: snap(sAt('side', 1)), s1: snap(sOfR('brim', 0.185)), n: 20, part: 'brim' },
    { s0: snap(sOfR('brim', 0.185)), s1: snap(sOfR('brim', 0.228)), n: 25, part: 'brim' },
    { s0: snap(sOfR('brim', 0.228)), s1: brimEnd, n: 31, part: 'brim' },
    { s0: brimEnd, s1: sOfR('under', 0.228), n: 31, part: 'under' },
    { s0: sOfR('under', 0.228), s1: sOfR('under', 0.185), n: 25, part: 'under' },
    { s0: sOfR('under', 0.185), s1: total, n: 18, part: 'under' },
  ];
  const r = (i) => Math.sin(i * 12.9898) * 0.5;
  const wave = (th, rr) => {
    const k = sstep(0.15, HAT.rBrim, rr);
    return k * (0.007 * Math.sin(th * 2 + 0.7) + 0.004 * Math.sin(th * 3 + 2.1) + 0.0025 * Math.sin(th * 5 + r(3)))
      - k * k * 0.006 * (1 - Math.cos(th)) * 0.5; // 後ろが少し下がる
  };
  const shade = (part, s) => (part === 'under' ? 0.62 : part === 'inner' ? 0.38 : part === 'edge' ? 0.8 : 1);
  const g = latheBands(prof, bands, { wave, rowH, shade });
  const hat = new THREE.Group();
  const straw = new THREE.Mesh(g, mats.straw);
  straw.castShadow = true; straw.receiveShadow = true;
  hat.add(straw);

  // リボン
  const bandH = 0.03, rb = (y) => mix(0.14, HAT.rTop, (y - 0.006) / (HAT.crownH - 0.03)) + 0.0028;
  const rp = [
    { r: rb(0.004 + bandH) - 0.003, y: 0.004 + bandH }, { r: rb(0.004 + bandH), y: 0.004 + bandH }, { r: rb(0.004), y: 0.004 }, { r: rb(0.004) - 0.003, y: 0.004 },
  ];
  rp[0].s = 0; for (let i = 1; i < rp.length; i++) rp[i].s = rp[i - 1].s + Math.hypot(rp[i].r - rp[i - 1].r, rp[i].y - rp[i - 1].y);
  const rg = latheBands(rp, [{ s0: 0, s1: rp[3].s, n: 18, part: 'rib' }], { seg: 96, wave: () => 0, rowH: rp[3].s, shade: () => 1 });
  rg.deleteAttribute('color');
  const ribbon = new THREE.Mesh(rg, mats.ribbon);
  ribbon.castShadow = true;
  hat.add(ribbon);
  // 蝶結び（左うしろ）
  const th0 = Math.PI * 0.72;
  const bm = new THREE.Mesh(toGeometry(bowMesh), mats.ribbonPlain);
  const rr = rb(0.019);
  bm.position.set(Math.sin(th0) * rr * HAT.rOpenX / 0.14, 0.019, Math.cos(th0) * rr * HAT.rOpenZ / 0.14);
  bm.rotation.y = th0;
  bm.castShadow = true;
  hat.add(bm);
  return hat;
}

// 蝶結び（リボンの外側がローカル +z、上が +y）
// ---------- 素材 ----------
const SKIN = { roughness: 0.6, sheen: 0.35, sheenColor: new THREE.Color('#ff8f70'), sheenRoughness: 0.5 };
const SKIN_COL = SKIN_HEX;
function faceMaterial(atlas) {
  const m = new THREE.MeshPhysicalMaterial({ ...SKIN, color: SKIN_COL });
  const u = { uFace: { value: atlas }, uBlink: { value: 0 }, uHappy: { value: 0 }, uMouth: { value: 0 } };
  m.userData.face = u;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vHeadPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvHeadPos = position;');
    const cellS = Object.fromEntries(Object.entries(CELL).map(([k, [c, r]]) => [k, `vec2(${c}.0, ${r}.0)`]));
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vHeadPos;
uniform sampler2D uFace; uniform float uBlink, uHappy, uMouth;
vec4 faceCell(vec2 uv, vec2 c) { return texture2D(uFace, (c + uv) / vec2(3.0, 2.0)); }
vec3 over(vec3 base, vec4 f) { return mix(base, f.rgb, f.a); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
{
  float th = atan(vHeadPos.x, vHeadPos.z);
  vec2 uv = vec2(th * ${FACE.R.toFixed(4)} / ${FACE.W.toFixed(4)} + 0.5, (${FACE.Y1.toFixed(4)} - vHeadPos.y) / ${(FACE.Y1 - FACE.Y0).toFixed(4)});
  float inside = step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0) * smoothstep(0.0, 0.03, vHeadPos.z);
  if (inside > 0.0) {
    uv = clamp(uv, 0.004, 0.996);
    vec3 c = over(diffuseColor.rgb, faceCell(uv, ${cellS.base}));
    vec4 eo = faceCell(uv, ${cellS.eyesOpen}), ec = faceCell(uv, ${cellS.eyesClosed}), eh = faceCell(uv, ${cellS.eyesHappy});
    float open = (1.0 - uBlink) * (1.0 - uHappy);
    c = mix(c, eo.rgb, eo.a * open);
    c = mix(c, ec.rgb, ec.a * uBlink * (1.0 - uHappy));
    c = mix(c, eh.rgb, eh.a * uHappy);
    vec4 ms = faceCell(uv, ${cellS.mouthSmile}), mo = faceCell(uv, ${cellS.mouthOpen});
    c = mix(c, ms.rgb, ms.a * (1.0 - uMouth));
    c = mix(c, mo.rgb, mo.a * uMouth);
    diffuseColor.rgb = mix(diffuseColor.rgb, c, inside);
  }
}`);
  };
  m.customProgramCacheKey = () => 'kidface';
  return m;
}

// 髪: 毛の流れにそった細い溝で、つるんとしたヘルメットに見えないように
function hairMaterial() {
  const m = new THREE.MeshPhysicalMaterial({ color: '#35261d', roughness: 0.55, sheen: 0.5, sheenRoughness: 0.35, sheenColor: new THREE.Color('#8a6a55') });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
varying vec3 vHP; varying vec3 vHT;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
vHP = position;
float hth = atan(position.x, position.z + 0.01);
vHT = normalize(normalMatrix * vec3(cos(hth), 0.0, -sin(hth)));`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vHP; varying vec3 vHT;`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
{
  float th = atan(vHP.x, vHP.z + 0.01);
  float w = th * 46.0 + sin(vHP.y * 55.0 + th * 3.0) * 1.3;
  float g = sin(w) * 0.55 + sin(w * 2.7 + 1.3) * 0.3;
  normal = normalize(normal + vHT * g * 0.22);
  diffuseColor.rgb *= 0.9 + 0.1 * sin(w * 1.7 + 0.5);
}`);
  };
  m.customProgramCacheKey = () => 'kidhair';
  return m;
}

// T シャツ: 胸にプリント（静止ポーズの座標で貼るので、体が動いてもずれない）
function shirtMaterial() {
  const m = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.92, sheen: 0.6, sheenRoughness: 0.55, sheenColor: new THREE.Color('#ffffff') });
  const tex = shirtPrint();
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uPrint = { value: tex };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
varying vec3 vSP; varying float vSN;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
vSP = position; vSN = normal.z;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vSP; varying float vSN; uniform sampler2D uPrint;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
{
  vec2 uv = vec2((vSP.x + 0.058) / 0.116, (0.955 - vSP.y) / 0.116);
  if (uv.x > 0.0 && uv.x < 1.0 && uv.y > 0.0 && uv.y < 1.0 && vSN > 0.25) {
    vec4 p = texture2D(uPrint, vec2(uv.x, 1.0 - uv.y));
    diffuseColor.rgb = mix(diffuseColor.rgb, p.rgb, p.a * 0.92);
  }
}`);
  };
  m.customProgramCacheKey = () => 'kidshirt';
  return m;
}

function materials() {
  const straw = strawTextures(), rib = ribbonTextures();
  return {
    skin: new THREE.MeshPhysicalMaterial({ ...SKIN, vertexColors: true }),
    skinPlain: new THREE.MeshPhysicalMaterial({ ...SKIN, color: SKIN_COL }),
    shirt: shirtMaterial(),
    shorts: new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.86, sheen: 0.4, sheenRoughness: 0.6, sheenColor: new THREE.Color('#9fb8ff') }),
    hair: hairMaterial(),
    shoe: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78 }),
    straw: new THREE.MeshStandardMaterial({ map: straw.map, normalMap: straw.normalMap, normalScale: new THREE.Vector2(0.9, 0.9), vertexColors: true, roughness: 0.62, side: THREE.FrontSide }),
    ribbon: new THREE.MeshPhysicalMaterial({ map: rib.map, normalMap: rib.normalMap, roughness: 0.55, sheen: 0.6, sheenColor: new THREE.Color('#ff9a90') }),
    ribbonPlain: new THREE.MeshPhysicalMaterial({ color: '#b02429', roughness: 0.55, sheen: 0.6, sheenColor: new THREE.Color('#ff9a90') }),
  };
}

// ---------- 組み立て ----------
export async function buildKid() {
  const t0 = performance.now();
  const partsP = buildParts();
  const mats = materials();
  const atlas = faceAtlas(HEAD_GEO);
  const M = await partsP;
  const root = new THREE.Group();
  root.name = 'kid';

  // 骨
  const bones = {};
  for (const n of BONES) { const b = new THREE.Bone(); b.name = n; bones[n] = b; }
  for (const n of BONES) {
    const b = bones[n], p = BONE_POS[n];
    if (n === 'base') { root.add(b); continue; }
    const q = BONE_POS[PARENT[n]];
    b.position.set(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
    bones[PARENT[n]].add(b);
  }
  root.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(BONES.map((n) => bones[n]));

  const skinned = (geo, mat) => {
    const m = new THREE.SkinnedMesh(geo, mat);
    m.castShadow = true; m.receiveShadow = true;
    m.frustumCulled = false;
    root.add(m);
    m.bind(skeleton, new THREE.Matrix4());
    return m;
  };
  const parts = {};
  parts.body = skinned(toGeometry(M.body), mats.skin);
  parts.shirt = skinned(toGeometry(M.shirt), mats.shirt);
  parts.shorts = skinned(toGeometry(M.shorts), mats.shorts);

  // 靴: 足首の骨とつま先の骨で曲げる（左右で同じ形）
  for (const s of ['L', 'R']) {
    const m = M.shoe, n = m.count, an = J[s].an;
    const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
    for (let v = 0; v < n; v++) {
      si[v * 4] = B['foot' + s]; si[v * 4 + 1] = B['toe' + s];
      sw[v * 4] = 1 - m.extra[v]; sw[v * 4 + 1] = m.extra[v];
    }
    const geo = toGeometry({ pos: m.pos.slice(), nrm: m.nrm.slice(), idx: m.idx, color: m.color, skinIndex: si, skinWeight: sw });
    geo.translate(an[0], an[1], an[2]);
    parts['shoe' + s] = skinned(geo, mats.shoe);
  }

  // 手（手首の骨にそのまま付ける。右手は左手の鏡像）
  for (const s of ['L', 'R']) {
    const x = s === 'L' ? 1 : -1;
    const geo = toGeometry({ pos: M.hand.pos.slice(), nrm: M.hand.nrm.slice(), idx: M.hand.idx.slice() });
    if (x < 0) { geo.scale(-1, 1, 1); geo.index.array.reverse(); }
    const m = new THREE.Mesh(geo, mats.skinPlain);
    m.rotation.z = x * A_LO;
    m.castShadow = true;
    bones['hand' + s].add(m);
    parts['hand' + s] = m;
  }

  // 頭・髪・帽子（頭の骨に付ける。頭まわりは少し大きめ）
  const headRig = new THREE.Group();
  headRig.scale.setScalar(HEAD_SCALE);
  bones.head.add(headRig);
  const hc = [0, 1, 2].map((k) => (HEAD_C[k] - J.head[k]) / HEAD_SCALE);
  const faceMat = faceMaterial(atlas);
  const head = new THREE.Mesh(toGeometry(M.head), faceMat);
  head.position.set(...hc);
  head.castShadow = true; head.receiveShadow = true;
  headRig.add(head);
  const hair = new THREE.Mesh(toGeometry(M.hair), mats.hair);
  hair.position.set(...hc);
  hair.castShadow = true;
  headRig.add(hair);
  // 帽子はバネで揺れるように中継ぎの Object3D に入れる
  const hatPivot = new THREE.Object3D();
  hatPivot.position.set(hc[0], hc[1] + 0.062, hc[2] - 0.016);
  const hatTilt = new THREE.Object3D();
  hatTilt.rotation.x = -0.26; // 前を少し上げてかぶる
  hatPivot.add(hatTilt);
  hatTilt.add(buildHat(mats, M.bow));
  headRig.add(hatPivot);

  let tris = 0;
  root.traverse((o) => { if (o.isMesh) tris += o.geometry.index.count / 3; });
  return { root, bones, skeleton, parts, face: faceMat.userData.face, hatPivot, mats, stats: { ms: performance.now() - t0, tris } };
}
