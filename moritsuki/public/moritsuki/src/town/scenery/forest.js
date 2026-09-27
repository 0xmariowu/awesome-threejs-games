// 山の森: 木の頭（樹冠）の丸い塊をたくさん並べて、もこもこの森にする
// ・一本ずつの木（trees2.js）は町並みのまわりだけ。ここは遠く・空から見る森なので、軽い形をインスタンスで描く
// ・広葉樹（明るさの違う緑）・杉の植林（濃い色の三角）・竹やぶ（黄緑）を、まとまりで植える
// ・区画ごとの InstancedMesh（画面の外の区画は描かない）。近くは細かい形、遠くは粗い形に切りかえる
import * as THREE from 'three';
import { rng, hash2, fbm2, vnoise } from '../data.js';
import { paint } from '../materials.js';
import { forestness, canopyLift } from './landscape.js';
import { townWeight } from './plan.js';

const CHUNK = 180;
const NEAR = [20, 420]; // これより近い区画は細かい形（2 段）
const FAR = 2300;   // これより遠い区画は描かない
const REACH = 1650; // 外周で木を植える範囲（中心からの距離）

// ---------- 形 ----------
function blobGeo(detail, seed) {
  const g = new THREE.IcosahedronGeometry(1, detail);
  const p = g.attributes.position, col = [];
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).normalize();
    const lump = 1 + (vnoise(v.x * 2.3 + seed, v.z * 2.3 + v.y * 1.7) - 0.5) * 0.42;
    let y = v.y * 0.82;
    if (y < -0.25) y = -0.25 + (y + 0.25) * 0.35; // 下は平たく
    p.setXYZ(i, v.x * lump, y * lump, v.z * lump);
    const ao = 0.5 + 0.5 * THREE.MathUtils.smoothstep(v.y, -0.5, 0.85);
    col.push(ao, ao, ao);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  softNormals(g, 0.55);
  return g;
}

function sugiGeo(radial) {
  // 段々の三角（杉の植林を遠くから見た形）
  const g = new THREE.ConeGeometry(1, 2.8, radial, 4, false);
  g.translate(0, 1.1, 0);
  const p = g.attributes.position, col = [];
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i), t = (y + 0.3) / 2.8;
    const jag = 1 + Math.sin(t * Math.PI * 8) * 0.08;
    p.setX(i, p.getX(i) * jag); p.setZ(i, p.getZ(i) * jag);
    const ao = 0.45 + 0.55 * THREE.MathUtils.clamp(t, 0, 1);
    col.push(ao, ao, ao);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

// 法線を中心からの向きに寄せて、ふんわりした陰影にする
function softNormals(g, k) {
  g.computeVertexNormals();
  const p = g.attributes.position, n = g.attributes.normal;
  const a = new THREE.Vector3(), b = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    a.fromBufferAttribute(n, i);
    b.fromBufferAttribute(p, i).normalize();
    a.lerp(b, k).normalize();
    n.setXYZ(i, a.x, a.y, a.z);
  }
}

function crownMaterial() {
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  return paint(mat, {
    amp: 0.0, scale: 1, key: 'crown',
    frag: /* glsl */ `
      {
        // 葉のかたまりのむら（近くだけ細かく）
        float dist = length(cameraPosition - vWP);
        float leaf = tnF(vWP.xz * 0.9 + vWP.y * 0.7);
        diffuseColor.rgb *= 1.0 + (leaf - 0.5) * 0.5 * (1.0 - smoothstep(120.0, 500.0, dist));
        // 日の当たる上の方は黄色みを足す
        diffuseColor.rgb += vec3(0.02, 0.025, 0.0) * clamp(vWN.y, 0.0, 1.0);
      }`,
    // 葉の房で法線を揺らして、多面体の角を見せない（近くだけ）
    after: (sh) => {
      sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        {
          vec3 q = vWP * 0.75;
          vec3 nn = vec3(tnV(q.xz + q.y), tnV(q.zy + 5.1), tnV(q.xy + 9.7)) - 0.5;
          vec3 q2 = vWP * 2.1;
          nn += (vec3(tnV(q2.xz + q2.y), tnV(q2.zy + 2.3), tnV(q2.xy + 4.9)) - 0.5) * 0.6;
          float fade = 1.0 - smoothstep(120.0, 600.0, length(cameraPosition - vWP));
          normal = normalize(normal + (viewMatrix * vec4(nn * 1.7, 0.0)).xyz * fade);
        }`);
    },
  });
}

// ---------- 色（線形） ----------
const C = (r, g, b) => new THREE.Color(r, g, b);
const BROAD = [C(0.06, 0.15, 0.035), C(0.09, 0.2, 0.04), C(0.12, 0.25, 0.05), C(0.16, 0.3, 0.06), C(0.1, 0.22, 0.07)];
const SUGI = [C(0.035, 0.085, 0.035), C(0.045, 0.1, 0.04)];
const BAMBOO = [C(0.2, 0.32, 0.07), C(0.24, 0.36, 0.08)];

export function buildForest(ctx, T) {
  const { data } = ctx;
  const { core, outer } = data;
  const t0 = performance.now();
  // 見た目の地面（森は盛り上げてある）
  const coreSurf = (x, z) => {
    const fx = (x - core.x0) / core.step, fz = (z - core.z0) / core.step;
    const i = Math.max(0, Math.min(core.nx - 2, Math.floor(fx))), j = Math.max(0, Math.min(core.nz - 2, Math.floor(fz)));
    const u = fx - i, v = fz - j, k = j * core.nx + i;
    const H = (q) => core.h[q] + T.canopy[q];
    return (H(k) * (1 - u) + H(k + 1) * u) * (1 - v) + (H(k + core.nx) * (1 - u) + H(k + core.nx + 1) * u) * v;
  };
  const outerSlope = (x, z) => Math.hypot(outer.at(x + 12, z) - outer.at(x - 12, z), outer.at(x, z + 12) - outer.at(x, z - 12)) / 24;
  const outerSurf = (x, z, f) => outer.at(x, z) + canopyLift(f) * (6 + fbm2(x * 0.02, z * 0.02) * 9);

  const items = []; // [x, y, z, s, kind(0 広葉 1 杉 2 竹), color]
  const r = rng(8123);
  const species = (x, z) => {
    const n = fbm2(x * 0.0045 + 3.3, z * 0.0045 + 1.1), m = vnoise(x * 0.012 + 9.1, z * 0.012 + 4.4);
    if (n > 0.66) return 1;          // 杉の植林
    if (m > 0.86 && n < 0.5) return 2; // 竹やぶ
    return 0;
  };
  const plant = (x, y, z, s, sp) => {
    const h = hash2(x * 1.3, z * 0.7);
    const pal = sp === 1 ? SUGI : sp === 2 ? BAMBOO : BROAD;
    const c = pal[Math.floor(h * pal.length) % pal.length].clone();
    // まとまりごとの色あい
    const tone = 0.85 + fbm2(x * 0.01, z * 0.01) * 0.35;
    c.multiplyScalar(tone);
    items.push([x, y, z, s, sp, c]);
  };
  // 中心部: 森のセル（盛り上げた所）に 6.5m おき
  const SP = 6.5;
  for (let z = core.z0 + 4; z < core.z1 - 4; z += SP) for (let x = core.x0 + 4; x < core.x1 - 4; x += SP) {
    const px = x + (r() - 0.5) * SP * 0.8, pz = z + (r() - 0.5) * SP * 0.8;
    const i = Math.round((px - core.x0) / core.step), j = Math.round((pz - core.z0) / core.step), k = j * core.nx + i;
    if (T.kinds[k] !== 'forest' || ctx.paddyCovered?.(px, pz)) continue;
    const cano = T.canopy[k];
    // 町並みのそば（一本ずつの木がある所）は森の奥だけ
    if (cano < (townWeight(px, pz) > 0 ? 3.5 : 1.2)) continue;
    const sp = species(px, pz);
    const s = sp === 1 ? 2.2 + r() * 0.9 : 3.4 + r() * 1.8 + Math.min(cano, 10) * 0.08;
    const y = coreSurf(px, pz) - (sp === 1 ? 1.2 : s * 0.3);
    plant(px, y, pz, s, sp);
  }
  // 外周: 森らしい所に 11m おき、大きめに
  const SO = 11;
  for (let z = -REACH; z < REACH; z += SO) for (let x = -REACH; x < REACH; x += SO) {
    if (x * x + z * z > REACH * REACH) continue;
    const px = x + (r() - 0.5) * SO * 0.8, pz = z + (r() - 0.5) * SO * 0.8;
    if (core.inside(px, pz, 2) || !outer.inside(px, pz, 15)) continue;
    const h = outer.at(px, pz);
    if (h < 1) continue;
    const f = forestness(h, outerSlope(px, pz));
    if (f < 0.55 || ctx.paddyCovered?.(px, pz)) continue;
    const sp = species(px, pz);
    const s = sp === 1 ? 3.2 + r() * 1.2 : 5 + r() * 2.6;
    const y = outerSurf(px, pz, f) - (sp === 1 ? 1.8 : s * 0.35);
    plant(px, y, pz, s, sp);
  }
  // 田の中の集落・林・一本木の木（scenery/hamlets.js。[x, y, z, s, 種類]）
  for (const [x, y, z, s, sp] of ctx.extraCrowns || []) plant(x, y, z, s, sp);

  // ---------- 区画ごとのインスタンス ----------
  const geos = {
    near2: [blobGeo(2, 1.7), sugiGeo(8), blobGeo(2, 5.1)],
    near: [blobGeo(1, 1.7), sugiGeo(7), blobGeo(1, 5.1)],
    far: [blobGeo(0, 1.7), sugiGeo(4), blobGeo(0, 5.1)],
  };
  const mat = crownMaterial();
  const cells = new Map();
  for (const it of items) {
    const key = Math.floor(it[0] / CHUNK) + ',' + Math.floor(it[2] / CHUNK);
    if (!cells.has(key)) cells.set(key, []);
    cells.get(key).push(it);
  }
  const group = new THREE.Group();
  group.name = 'forest';
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3();
  for (const list of cells.values()) {
    const chunk = new THREE.Group();
    let cx = 0, cz = 0;
    for (const it of list) { cx += it[0] / list.length; cz += it[2] / list.length; }
    chunk.userData.c = new THREE.Vector3(cx, 0, cz);
    for (const lod of ['near2', 'near', 'far']) {
      for (let sp = 0; sp < 3; sp++) {
        const sub = list.filter((it) => it[4] === sp);
        if (!sub.length) continue;
        const im = new THREE.InstancedMesh(geos[lod][sp], mat, sub.length);
        sub.forEach(([x, y, z, s, , c], i) => {
          e.set(0, hash2(x, z) * 6.28, 0); q.setFromEuler(e);
          const w = sp === 1 ? s * 0.55 : s;
          sc.set(w * (0.9 + hash2(z, x) * 0.2), sp === 1 ? s : s * (0.85 + hash2(x * 2, z) * 0.3), w * (0.9 + hash2(x, z * 2) * 0.2));
          im.setMatrixAt(i, m4.compose(v.set(x, y, z), q, sc));
          im.setColorAt(i, c);
        });
        im.instanceColor.needsUpdate = true;
        im.computeBoundingSphere();
        im.userData.lod = lod;
        im.castShadow = lod === 'near2';
        im.receiveShadow = true;
        im.userData.noAO = false;
        chunk.add(im);
      }
    }
    group.add(chunk);
  }
  group.userData.stats = { crowns: items.length, chunks: cells.size, ms: Math.round(performance.now() - t0) };
  // 区画ごとに、近い・遠い・描かないを切りかえる
  group.userData.update = (camera, { far = FAR } = {}) => {
    const cp = camera.position;
    for (const ch of group.children) {
      const d = Math.hypot(ch.userData.c.x - cp.x, ch.userData.c.z - cp.z) - CHUNK * 0.7;
      ch.visible = d < far;
      if (!ch.visible) continue;
      const lod = d < NEAR[0] ? 'near2' : d < NEAR[1] ? 'near' : 'far';
      for (const im of ch.children) im.visible = im.userData.lod === lod;
    }
  };
  return group;
}
