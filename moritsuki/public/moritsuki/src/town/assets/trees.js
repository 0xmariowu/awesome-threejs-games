// 木: 枝分かれで幹と枝を作り、枝先の「塊」に葉の房を付ける
// 広葉樹の葉はカメラを向く板（ビルボード）で、塊ごとに丸く陰影を付ける → ふっくらした樹冠
// 松の葉は水平な段、ヤシは葉の帯
import * as THREE from 'three';
import { TEX, leafCluster, pineCluster, frondTex } from './textures.js';
import { paint, FOCUS, OCCLUDE_HEAD, OCCLUDE_GLSL } from '../materials.js';
import { isTree2, makeTree2 } from './trees2.js';

const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

export class Geo {
  constructor(withColor = false, withCard = false) { this.p = []; this.n = []; this.uv = []; this.c = withColor ? [] : null; this.card = withCard ? [] : null; this.i = []; }
  get count() { return this.p.length / 3; }
  v(p, n, u, v, c, card) {
    this.p.push(p.x, p.y, p.z); this.n.push(n.x, n.y, n.z); this.uv.push(u, v);
    if (this.c) this.c.push(c.r, c.g, c.b);
    if (this.card) this.card.push(...card);
    return this.count - 1;
  }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    if (this.c) g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    if (this.card) g.setAttribute('aCard', new THREE.Float32BufferAttribute(this.card, 4));
    g.setIndex(this.i);
    g.computeBoundingSphere();
    // ビルボードは中心点しか持たないので、境界球を広げる
    if (this.card) g.boundingSphere.radius += 2;
    return g;
  }
}

export function rngOf(seed) {
  let s = (seed * 9301 + 49297) % 233280 || 1;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

// 管（枝・幹）
export function tube(G, pts, radii, radial = 7) {
  const base = G.count;
  let prevN = null, acc = 0;
  const T = V3(), N = V3(), B = V3();
  for (let k = 0; k < pts.length; k++) {
    const a = pts[Math.max(0, k - 1)], b = pts[Math.min(pts.length - 1, k + 1)];
    T.subVectors(b, a).normalize();
    if (!prevN) N.set(Math.abs(T.y) < 0.9 ? 0 : 1, Math.abs(T.y) < 0.9 ? 1 : 0, 0).cross(T).normalize();
    else N.copy(prevN).addScaledVector(T, -prevN.dot(T)).normalize();
    prevN = N.clone();
    B.crossVectors(T, N);
    if (k) acc += pts[k].distanceTo(pts[k - 1]);
    for (let j = 0; j <= radial; j++) {
      const th = (j / radial) * Math.PI * 2;
      const d = N.clone().multiplyScalar(Math.cos(th)).addScaledVector(B, Math.sin(th));
      G.v(pts[k].clone().addScaledVector(d, radii[k]), d, j / radial, acc / 1.5);
    }
  }
  const rs = radial + 1;
  for (let k = 0; k < pts.length - 1; k++) for (let j = 0; j < radial; j++) {
    const a = base + k * rs + j;
    G.i.push(a, a + 1, a + rs, a + 1, a + rs + 1, a + rs);
  }
}

// カメラを向く葉の板: 頂点はすべて中心、角の向きと大きさは aCard
function bill(L, center, lightC, lightR, crownC, size, r, tint) {
  const out = center.clone().sub(lightC);
  const d = out.length() / lightR;
  const sn = out.normalize().lerp(center.clone().sub(crownC).normalize(), 0.35).lerp(V3(0, 1, 0), 0.12).normalize();
  const below = THREE.MathUtils.clamp((center.y - lightC.y) / lightR * 0.5 + 0.5, 0, 1);
  const c = tint.clone().multiplyScalar(0.55 + d * 0.3 + below * 0.3);
  const ang = r() * Math.PI * 2, h = size / 2;
  const base = L.count;
  for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) L.v(center, sn, (a + 1) / 2, (b + 1) / 2, c, [a, b, ang, h]);
  L.i.push(base, base + 1, base + 2, base, base + 2, base + 3);
}

// 向きの固定された葉の板（松の段など）
function card(L, center, crownC, size, r, horiz, tint) {
  const out = center.clone().sub(crownC).normalize();
  const nrm = V3(r() - 0.5, r() - 0.5, r() - 0.5).normalize().lerp(out, 0.45).normalize().lerp(V3(0, 1, 0), horiz).normalize();
  const t1 = V3(0, 1, 0).cross(nrm);
  if (t1.lengthSq() < 1e-4) t1.set(1, 0, 0);
  t1.normalize().applyAxisAngle(nrm, r() * Math.PI * 2);
  const t2 = nrm.clone().cross(t1).normalize();
  const h = size / 2;
  const sn = out.clone().lerp(V3(0, 1, 0), 0.4).normalize();
  const c = tint.clone().multiplyScalar(0.7 + THREE.MathUtils.clamp(center.y - crownC.y, -0.5, 0.5) * 0.4);
  const base = L.count;
  for (const [a, b, u, v] of [[-1, -1, 0, 0], [1, -1, 1, 0], [1, 1, 1, 1], [-1, 1, 0, 1]]) {
    L.v(center.clone().addScaledVector(t1, a * h).addScaledVector(t2, b * h), sn, u, v, c);
  }
  L.i.push(base, base + 1, base + 2, base, base + 2, base + 3);
}

function rotateAround(dir, spread, twist) {
  const axis = V3(0, 1, 0).cross(dir);
  if (axis.lengthSq() < 1e-4) axis.set(1, 0, 0);
  axis.normalize().applyAxisAngle(dir, twist);
  return dir.clone().applyAxisAngle(axis, spread).normalize();
}

// ---------- 種類 ----------
const SPECIES = {
  // クスノキのような、丸くこんもりした木
  broad: { trunkH: 2.2, trunkR: 0.3, lean: 0.12, kids0: 6, spread0: 0.8, len0: 3.4, kids1: 3, spread1: 0.85, len1: 0.55, up: 0.35, clumpR: 1.55, perClump: 16, size: 1.9, flat: 0.85, leaf: 'broad' },
  // 葉桜: 低く横に広がる
  cherry: { trunkH: 1.6, trunkR: 0.32, lean: 0.25, kids0: 5, spread0: 1.15, len0: 4.0, kids1: 3, spread1: 0.8, len1: 0.5, up: 0.05, clumpR: 1.5, perClump: 15, size: 1.9, flat: 0.7, leaf: 'cherry' },
  // 森の縁（遠くから見るので板は少なめ・大きめ）
  wild: { trunkH: 2.8, trunkR: 0.25, lean: 0.1, kids0: 6, spread0: 0.7, len0: 3.2, kids1: 2, spread1: 0.8, len1: 0.55, up: 0.45, clumpR: 1.8, perClump: 7, size: 2.6, flat: 0.9, leaf: 'broad' },
};

function broadTree(sp, r) {
  const W = new Geo(), L = new Geo(true, true);
  const clumps = [];
  const limb = (start, dir, len, rad, radial) => {
    const segs = Math.max(2, Math.ceil(len / 0.5));
    const pts = [start.clone()], radii = [rad];
    let d = dir.clone(), p = start.clone();
    for (let k = 1; k <= segs; k++) {
      d.add(V3(r() - 0.5, (r() - 0.5) + sp.up * 0.3, r() - 0.5).multiplyScalar(0.25)).normalize();
      p = p.clone().addScaledVector(d, len / segs);
      pts.push(p); radii.push(rad * (1 - (k / segs) * 0.7));
    }
    tube(W, pts, radii, radial);
    return { pts, radii, d };
  };
  // 幹
  const lean = V3((r() - 0.5) * sp.lean, 1, (r() - 0.5) * sp.lean).normalize();
  const tp = [V3(0, -0.3, 0)], tr = [sp.trunkR * 1.45];
  let p = V3(), d = lean.clone();
  for (let k = 1; k <= 5; k++) {
    d.add(V3(r() - 0.5, 0, r() - 0.5).multiplyScalar(0.1)).normalize();
    p = p.clone().addScaledVector(d, sp.trunkH / 5);
    tp.push(p); tr.push(sp.trunkR * (1 - (k / 5) * 0.25));
  }
  tube(W, tp, tr, 12);
  const top = tp[5];
  for (let c = 0; c < sp.kids0; c++) {
    const cd = rotateAround(d, sp.spread0 * (0.6 + r() * 0.45), c * 2.4 + r() * 0.5);
    const L0 = sp.len0 * (0.75 + r() * 0.45);
    const b = limb(top.clone().addScaledVector(d, -r() * 0.5), cd, L0, tr[5] * 0.75, 8);
    clumps.push(b.pts[b.pts.length - 1].clone());
    for (let k = 0; k < sp.kids1; k++) {
      const t = 0.45 + r() * 0.55, idx = Math.round(t * (b.pts.length - 1));
      const cd2 = rotateAround(b.d, sp.spread1 * (0.6 + r() * 0.6), k * 2.4 + r());
      cd2.y += sp.up * 0.4; cd2.normalize();
      const b2 = limb(b.pts[idx], cd2, L0 * sp.len1 * (0.8 + r() * 0.4), b.radii[idx] * 0.7, 5);
      clumps.push(b2.pts[b2.pts.length - 1].clone());
    }
  }
  // 樹冠の中心と、上の方の塊を足す
  const cc = V3();
  for (const q of clumps) cc.add(q);
  cc.divideScalar(clumps.length);
  const extra = Math.round(clumps.length * 0.35);
  for (let k = 0; k < extra; k++) {
    const a = r() * Math.PI * 2, rr = Math.sqrt(r()) * 1.6;
    clumps.push(cc.clone().add(V3(Math.cos(a) * rr, 0.6 + r() * 1.3, Math.sin(a) * rr)));
  }
  const tint = new THREE.Color();
  for (const c0 of clumps) {
    const cr = sp.clumpR * (0.8 + r() * 0.4);
    for (let k = 0; k < sp.perClump; k++) {
      const dd = V3(r() - 0.5, (r() - 0.5) * sp.flat, r() - 0.5).normalize().multiplyScalar(Math.pow(r(), 0.45) * cr * 0.85);
      bill(L, c0.clone().add(dd), c0, cr, cc, sp.size * (0.75 + r() * 0.5), r, tint.setRGB(0.92 + r() * 0.16, 0.93 + r() * 0.14, 0.9 + r() * 0.14));
    }
  }
  return { wood: W.build(), leaves: L.build(), leaf: sp.leaf, bill: true };
}

// 黒松: 傾いてくねる幹、水平に張る枝、平たい葉の段
function pineTree(r) {
  const W = new Geo(), L = new Geo(true);
  const tp = [V3(0, -0.3, 0)], tr = [0.36];
  let p = V3(), d = V3(0.35 + r() * 0.2, 1, (r() - 0.5) * 0.3).normalize();
  const H = 6.5 + r() * 2;
  for (let k = 1; k <= 9; k++) {
    d.add(V3((r() - 0.5) * 0.5, 0.1, (r() - 0.5) * 0.5)).normalize();
    if (k > 5) d.x -= 0.08;
    p = p.clone().addScaledVector(d, H / 9);
    tp.push(p); tr.push(0.3 * (1 - k / 11));
  }
  tube(W, tp, tr, 10);
  const pads = [];
  for (let b = 0; b < 8; b++) {
    const k = 3 + Math.floor(r() * 6);
    const s = tp[k];
    const ang = b * 2.4 + r();
    const dir = V3(Math.cos(ang), 0.12 + r() * 0.25, Math.sin(ang)).normalize();
    const len = 1.2 + r() * 1.8 * (1 - k / 12);
    const pts = [s.clone()], rr = [tr[k] * 0.6];
    let q = s.clone(), dd = dir.clone();
    for (let j = 1; j <= 4; j++) {
      dd.add(V3((r() - 0.5) * 0.4, (r() - 0.4) * 0.3, (r() - 0.5) * 0.4)).normalize();
      q = q.clone().addScaledVector(dd, len / 4);
      pts.push(q); rr.push(tr[k] * 0.6 * (1 - j / 5));
    }
    tube(W, pts, rr, 5);
    pads.push(q);
  }
  pads.push(tp[tp.length - 1].clone().add(V3(0, 0.2, 0)));
  const green = new THREE.Color();
  for (const c of pads) {
    const R = 1.0 + r() * 0.6;
    for (let k = 0; k < 22; k++) {
      const a = r() * Math.PI * 2, rad = Math.sqrt(r()) * R;
      const pos = c.clone().add(V3(Math.cos(a) * rad, (r() - 0.3) * 0.4, Math.sin(a) * rad * 0.85));
      card(L, pos, c.clone().add(V3(0, -0.6, 0)), 1.0 + r() * 0.5, r, 0.75, green.setRGB(0.85 + r() * 0.2, 0.9 + r() * 0.2, 0.85 + r() * 0.2));
    }
  }
  return { wood: W.build(), leaves: L.build(), leaf: 'pine', bill: false };
}

function palmTree(r) {
  const W = new Geo(), L = new Geo(true);
  const pts = [], rr = [];
  const H = 6 + r() * 2.5, bend = 0.6 + r() * 0.8;
  for (let k = 0; k <= 16; k++) {
    const t = k / 16;
    pts.push(V3(Math.sin(t * 1.2) * bend, t * H, 0));
    rr.push((0.26 - t * 0.08) * (1 + 0.08 * Math.sin(k * 3.1)));
  }
  tube(W, pts, rr, 9);
  const top = pts[pts.length - 1];
  const white = new THREE.Color(1, 1, 1);
  for (let f = 0; f < 13; f++) {
    const a = (f / 13) * Math.PI * 2 + r() * 0.3, len = 2.8 + r() * 0.8, droop = 0.6 + r() * 0.8;
    const base = L.count;
    const N = 8;
    for (let k = 0; k <= N; k++) {
      const t = k / N;
      const c = V3(Math.cos(a) * t * len, Math.sin(t * 1.6) * 0.8 - t * t * droop * 2, Math.sin(a) * t * len).add(top);
      const side = V3(-Math.sin(a), 0, Math.cos(a)).multiplyScalar(0.75 * Math.sin(Math.PI * Math.min(1, t * 1.15)) + 0.05);
      L.v(c.clone().sub(side), V3(0, 1, 0), 0, t, white);
      L.v(c.clone().add(side), V3(0, 1, 0), 1, t, white);
    }
    for (let k = 0; k < N; k++) { const q = base + k * 2; L.i.push(q, q + 1, q + 3, q, q + 3, q + 2); }
  }
  return { wood: W.build(), leaves: L.build(), leaf: 'frond', bill: false };
}

// 植え込み（つつじ・さつき）: 低い丸い塊
function shrub(r) {
  const L = new Geo(true, true);
  const tint = new THREE.Color();
  const n = 2 + Math.floor(r() * 2);
  const all = V3(0, 0.5, 0);
  for (let c = 0; c < n; c++) {
    const c0 = V3((r() - 0.5) * 0.9, 0.45 + r() * 0.15, (r() - 0.5) * 0.9), cr = 0.55 + r() * 0.2;
    for (let k = 0; k < 12; k++) {
      const dd = V3(r() - 0.5, (r() - 0.3) * 0.7, r() - 0.5).normalize().multiplyScalar(Math.pow(r(), 0.4) * cr * 0.8);
      bill(L, c0.clone().add(dd), c0, cr, all, 0.8 + r() * 0.3, r, tint.setRGB(0.9 + r() * 0.2, 0.92 + r() * 0.16, 0.9 + r() * 0.16));
    }
  }
  return { wood: null, leaves: L.build(), leaf: 'shrub', bill: true };
}

export function makeTree(kind, seed = 1) {
  const r = rngOf(seed * 7 + kind.length * 131);
  if (kind === 'pine') return pineTree(r);
  if (kind === 'palm') return palmTree(r);
  if (kind === 'shrub') return shrub(r);
  return broadTree(SPECIES[kind], r);
}

// ---------- マテリアル ----------
// ビルボードの展開（見た目用とシャドウ用で共通）
export const BILL_DECL = 'attribute vec4 aCard;';
export const BILL_PROJECT = /* glsl */ `
  vec4 mvPosition = vec4(transformed, 1.0);
  float instS = 1.0;
  #ifdef USE_INSTANCING
    mvPosition = instanceMatrix * mvPosition;
    instS = length(instanceMatrix[0].xyz);
  #endif
  mvPosition = modelViewMatrix * mvPosition;
  {
    vec2 cr = vec2(cos(aCard.z), sin(aCard.z));
    vec2 cn = aCard.xy;
    mvPosition.xy += vec2(cn.x * cr.x - cn.y * cr.y, cn.x * cr.y + cn.y * cr.x) * aCard.w * instS;
  }
  gl_Position = projectionMatrix * mvPosition;
`;
const WIND = /* glsl */ `
  {
    vec3 ip = vec3(0.0);
    #ifdef USE_INSTANCING
      ip = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
    #endif
    float hgt = max(position.y - 1.5, 0.0);
    float ph = uTime * 1.2 + ip.x * 0.21 + ip.z * 0.17;
    transformed.x += (sin(ph) * 0.6 + sin(ph * 2.3 + position.y) * 0.3) * 0.014 * hgt;
    transformed.z += cos(ph * 0.8 + position.x) * 0.01 * hgt;
    transformed.y += sin(uTime * 2.6 + position.x * 1.7 + position.z * 1.3) * 0.03 * min(hgt, 1.0);
  }
`;

const matCache = {};
export function treeMaterials(leafKind, billboard) {
  const key = leafKind + (billboard ? '-b' : '');
  if (matCache[key]) return matCache[key];
  const bark = TEX.bark();
  const wood = new THREE.MeshStandardMaterial({ map: bark.map, normalMap: bark.normalMap, roughness: 0.95, color: leafKind === 'frond' ? '#f0e4cc' : leafKind === 'pine' ? '#e0d0c0' : '#f0e6da' });
  const map = leafKind === 'pine' ? pineCluster() : leafKind === 'frond' ? frondTex() : leafCluster(leafKind);
  const leaves = new THREE.MeshStandardMaterial({ map, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.8, vertexColors: true });
  paint(leaves, {
    amp: 0.06, scale: 0.6, key: 'leaf-' + key,
    attrs: billboard ? BILL_DECL : '',
    uniforms: { uFocus: FOCUS }, fragHead: OCCLUDE_HEAD,
    vtxPre: WIND,
    after: billboard ? (sh) => { sh.vertexShader = sh.vertexShader.replace(/#include <project_vertex>/, BILL_PROJECT); } : null,
    frag: /* glsl */ `
      {
        // 逆光で葉が透ける
        float back = pow(max(dot(normalize(cameraPosition - vWP), -normalize(vec3(0.42, 0.78, 0.46))), 0.0), 3.0);
        diffuseColor.rgb += vec3(0.22, 0.3, 0.06) * back * 0.4;
      }
      ${OCCLUDE_GLSL}`,
  });
  // 影もビルボードとして太陽を向ける
  let depth = null;
  if (billboard) {
    depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map, alphaTest: 0.45 });
    depth.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\n' + BILL_DECL)
        .replace('#include <project_vertex>', BILL_PROJECT);
    };
  }
  matCache[key] = { wood, leaves, depth };
  return matCache[key];
}

// 種類ごとに数種類の形を作り、インスタンスで並べる
export class TreeSet {
  constructor() { this.items = {}; }
  // variant: 形の番号（省くと並び順で決める）
  add(kind, x, y, z, s = 1, yaw = Math.random() * 6.28, variant) {
    (this.items[kind] ||= []).push(variant === undefined ? [x, y, z, s, yaw] : [x, y, z, s, yaw, variant]);
  }
  // fit(kind, x, z, s): 置く直前に種類と大きさを決め直す（[kind, s] か、置かないなら null）
  // cache: 種類ごとの形を覚えておく入れ物（同じ種類で何度も作り直すとき。scenery/planted.js）
  build({ variants = 3, chunk = 120, fit = null, cache = null } = {}) {
    if (fit) {
      const items = {};
      for (const kind in this.items) for (const [x, y, z, s, yaw] of this.items[kind]) {
        const f = fit(kind, x, z, s);
        if (f) (items[f[0]] ||= []).push([x, y, z, f[1], yaw]);
      }
      this.items = items;
    }
    const group = new THREE.Group();
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3();
    for (const kind in this.items) {
      const far = isTree2(kind), nv = far ? Math.min(variants, 3) : variants;
      let vs = cache?.[kind + ':' + nv];
      if (!vs) {
        vs = [];
        for (let k = 0; k < nv; k++) vs.push(far ? makeTree2(kind, k + 1) : makeTree(kind, k + 1));
        // 新しい木は、遠く用の軽い形も作る（updateTrees で切りかえる）
        if (far) vs.forEach((tv, k) => { const f = makeTree2(kind, k + 1, true); tv.farLeaves = f.leaves; tv.farWood = f.wood; });
        if (cache) cache[kind + ':' + nv] = vs;
      }
      const mats = vs[0].mats || treeMaterials(vs[0].leaf, vs[0].bill);
      const buckets = new Map();
      this.items[kind].forEach((it, idx) => {
        const ch = far ? 50 : chunk; // 近く・遠くを切りかえる木は区画を小さく
        const key = ((it[5] ?? idx) % nv) + ':' +Math.floor(it[0] / ch) + ',' + Math.floor(it[2] / ch);
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key).push(it);
      });
      for (const [key, list] of buckets) {
        const tv = vs[+key.split(':')[0]];
        const lod0 = tv.farLeaves ? 0 : undefined;
        const parts = [[tv.wood, mats.wood, false, lod0], [tv.leaves, mats.leaves, true, lod0]];
        if (tv.farLeaves) parts.push([tv.farWood, mats.wood, false, 1], [tv.farLeaves, mats.leaves, true, 1]);
        for (const [geo, mat, isLeaf, lod] of parts) {
          if (!geo) continue;
          const im = new THREE.InstancedMesh(geo, mat, list.length);
          list.forEach(([x, y, z, s, yaw], i) => {
            q.setFromAxisAngle(v.set(0, 1, 0), yaw);
            im.setMatrixAt(i, m4.compose(v.set(x, y, z), q, sc.set(s, s, s)));
          });
          im.computeBoundingSphere();
          im.castShadow = true;
          im.receiveShadow = !isLeaf || !!mats.leafShadow;
          if (isLeaf) { im.userData.noAO = true; if (mats.depth) im.customDepthMaterial = mats.depth; }
          if (lod !== undefined) im.userData.lod = lod;
          group.add(im);
        }
      }
    }
    return group;
  }
}

// 遠くの区画は描かない。近く用・遠く用の樹冠がある木は、距離で切りかえる
export function updateTrees(group, camera, { far = 420, near = 70 } = {}) {
  for (const im of group.children) {
    if (!im.boundingSphere) continue;
    const d = im.boundingSphere.center.distanceTo(camera.position) - im.boundingSphere.radius;
    const lod = im.userData.lod;
    im.visible = d < far && (lod === undefined || (lod === 0 ? d < near : d >= near));
  }
}
