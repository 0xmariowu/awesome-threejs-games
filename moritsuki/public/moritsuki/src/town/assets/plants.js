// 鉢植え: 素焼き・プラ鉢（縁の返しと受け皿、土の面）に、葉を 1 枚ずつ付けた草花を植える。Kit（kit.js）に積む
// kind: 'geranium'（丸い葉と赤い花の房）/ 'spider'（オリヅルランの垂れる細葉、斑入り）/ 'azalea'（小さい葉が密なつつじ、花は少し）
//       'hosta'（ギボウシの大きな葉）/ 'marigold'（細かい葉と橙の花）
import * as THREE from 'three';
import { needMat } from './build.js';

const C = (h) => new THREE.Color(h);

function plantMats(k) {
  needMat(k, 'foliage', () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, side: THREE.DoubleSide }));
  needMat(k, 'clay', () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92 }));
}

// 葉 1 枚（付け根 = 原点、+z へ伸びる。幅の形 shape(t)、先へ行くほど垂れる droop、中央の折れ fold）
const LEAF = new Map();
function leafGeo(len, wid, droop, fold, shape = 'oval', seg = 5) {
  const key = [len, wid, droop, fold, shape, seg].map((v) => (typeof v === 'number' ? v.toFixed(3) : v)).join();
  if (LEAF.has(key)) return LEAF.get(key);
  const W = (t) => (shape === 'blade' ? (1 - t) * 0.7 + 0.3 * Math.sin(Math.PI * Math.min(1, t * 3)) * (1 - t)
    : shape === 'round' ? Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.05)), 0.6)
      : Math.pow(Math.sin(Math.PI * t), 0.8));
  const P = [], I = [];
  for (let i = 0; i <= seg; i++) {
    const t = i / seg, z = t * len, y = -droop * t * t * len, w = (wid / 2) * W(t);
    P.push(-w, y - fold * w, z, 0, y, z, w, y - fold * w, z);
  }
  for (let i = 0; i < seg; i++) {
    const a = i * 3, b = a + 3;
    I.push(a, b, a + 1, a + 1, b, b + 1, a + 1, b + 1, a + 2, a + 2, b + 1, b + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setIndex(I);
  g.computeVertexNormals();
  g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array((seg + 1) * 6), 2));
  LEAF.set(key, g);
  return g;
}

// 鉢（ろくろの断面: 底 → 胴 → 縁の返し → 内側 → 土の面）
function potGeo(r0, r1, h) {
  const lip = 0.018, rim = 0.035;
  const pts = [[0, 0.004], [r0 - 0.01, 0], [r0, 0.012], [r1, h - rim], [r1 + lip, h - rim + 0.004], [r1 + lip, h], [r1 - 0.008, h], [r1 - 0.012, h - 0.03], [0, h - 0.03]];
  return new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), 18);
}

// 鉢植え 1 つ（x, y, z = 鉢の底の中心）。s = 大きさ、seed = 形の違い
export function pottedPlant(k, x, y, z, { kind = 'geranium', s = 1, seed = 1, pot = 'clay' } = {}) {
  plantMats(k);
  let q = seed * 9301 + 49297;
  const rnd = () => ((q = (q * 16807) % 2147483647) / 2147483647);
  rnd(); rnd();
  const r0 = 0.1 * s, r1 = 0.145 * s, h = 0.22 * s, top = y + h - 0.03 * s;
  const potCol = pot === 'clay' ? C('#b0603c').offsetHSL(0, 0, (rnd() - 0.5) * 0.06) : pot === 'blue' ? C('#2f5d7e') : pot === 'green' ? C('#3e5a3a') : C('#5a5550');
  // 受け皿・鉢・土
  k.color(potCol.clone().multiplyScalar(0.9));
  k.geo('clay', new THREE.CylinderGeometry(r0 + 0.035 * s, r0 + 0.02 * s, 0.025 * s, 18), new THREE.Matrix4().setPosition(x, y + 0.0125 * s, z));
  k.color(potCol);
  k.geo('clay', potGeo(r0, r1, h), new THREE.Matrix4().setPosition(x, y + 0.02 * s, z));
  k.color(C('#3b2b1e'));
  k.geo('clay', new THREE.CircleGeometry(r1 - 0.012 * s, 18).rotateX(-Math.PI / 2), new THREE.Matrix4().setPosition(x, top + 0.02 * s, z));
  const base = new THREE.Vector3(x, top + 0.02 * s, z);
  const put = (g, col, yaw, pitch, lift = 0, off = 0, roll = 0) => {
    const m = new THREE.Matrix4().makeRotationY(yaw)
      .multiply(new THREE.Matrix4().makeRotationX(-pitch))
      .multiply(new THREE.Matrix4().makeRotationZ(roll));
    const p = base.clone().add(new THREE.Vector3(Math.sin(yaw) * off, lift, Math.cos(yaw) * off));
    m.setPosition(p);
    k.color(col);
    k.geo('foliage', g, m);
  };
  const green = (l, v = 0.05) => C('#3f7a34').offsetHSL((rnd() - 0.5) * 0.03, (rnd() - 0.5) * 0.1, l + (rnd() - 0.5) * v);
  const flower = (px, py, pz, col, r) => {
    k.color(col.clone().offsetHSL(0, 0, (rnd() - 0.5) * 0.06));
    k.geo('foliage', new THREE.IcosahedronGeometry(r, 0), new THREE.Matrix4().setPosition(px, py, pz));
  };

  if (kind === 'geranium' || kind === 'hosta') {
    // 丸い葉のロゼット（外側ほど寝る）。ゼラニウムは花の房を茎の先に
    const big = kind === 'hosta';
    const n = big ? 13 : 24;
    for (let i = 0; i < n; i++) {
      const ring = i < n * 0.55 ? 0 : 1, a = i * 2.39996 + rnd() * 0.4;
      const len = (big ? 0.26 : 0.13) * s * (0.8 + rnd() * 0.4) * (ring ? 0.85 : 1);
      const g = leafGeo(len, len * (big ? 0.6 : 0.95), big ? 0.45 : 0.3, big ? 0.18 : 0.22, big ? 'oval' : 'round', big ? 6 : 4);
      // 内側の葉は立ち、外側は鉢の縁へ寝る
      const pitch = ring ? 0.15 + rnd() * 0.3 : 0.75 + rnd() * 0.45;
      put(g, big ? green(-0.03).offsetHSL(0.04, -0.12, 0) : green(ring ? -0.02 : 0.01), a, pitch, (ring ? 0.05 : 0.02) * s * (big ? 1.4 : 1), (ring ? 0.03 : 0.01) * s);
      if (!big) {
        // ゼラニウムの葉の輪紋（濃い帯）は葉を少し重ねて出す
        put(leafGeo(len * 0.62, len * 0.6, 0.3, 0.22, 'round', 3), green(-0.1), a, pitch, (ring ? 0.05 : 0.02) * s + 0.004, (ring ? 0.03 : 0.01) * s + len * 0.12);
      }
    }
    if (!big) {
      const fc = [C('#d8323a'), C('#e0558a'), C('#f2f0ea'), C('#d8323a')][seed % 4];
      const heads = 3 + (seed % 2);
      for (let i = 0; i < heads; i++) {
        const a = i * 2.1 + rnd(), rr = 0.06 * s * rnd(), hh = (0.2 + rnd() * 0.08) * s;
        const hx = x + Math.sin(a) * rr, hz = z + Math.cos(a) * rr, hy = top + hh;
        k.color(C('#4c7a36')); k.rod('foliage', [x + Math.sin(a) * 0.01, top, z + Math.cos(a) * 0.01], [hx, hy, hz], 0.008 * s);
        for (let f = 0; f < 9; f++) {
          const fa = f * 2.39996, fr = 0.035 * s * Math.sqrt(f / 9);
          flower(hx + Math.sin(fa) * fr, hy + 0.012 * s + Math.cos(f) * 0.008 * s, hz + Math.cos(fa) * fr, fc, 0.016 * s);
        }
      }
    }
    return;
  }
  if (kind === 'spider') {
    // オリヅルラン: 細い葉が弧を描いて鉢の縁から垂れる（斑入り = 白い帯の葉を重ねる）
    for (let i = 0; i < 30; i++) {
      const a = i * 2.39996 + rnd() * 0.3, len = (0.22 + rnd() * 0.16) * s;
      const pitch = 0.7 + rnd() * 0.7;
      put(leafGeo(len, 0.036 * s, 1.5 + rnd() * 0.8, 0.25, 'blade', 7), green(0.06, 0.08).offsetHSL(0.02, 0, 0), a, pitch, 0.01 * s);
      put(leafGeo(len * 0.95, 0.013 * s, 1.5 + rnd() * 0.8, 0.25, 'blade', 7), C('#dfe6c4'), a, pitch, 0.014 * s);
    }
    return;
  }
  if (kind === 'marigold') {
    // マリーゴールド: 細かく切れた葉の茂み（細い葉をたくさん）と、丸い花
    for (let i = 0; i < 60; i++) {
      const a = i * 2.39996 + rnd() * 0.5, len = (0.07 + rnd() * 0.06) * s;
      put(leafGeo(len, len * 0.4, 0.3, 0.15, 'oval', 3), green(-0.06), a, 0.2 + rnd() * 0.8, (0.02 + rnd() * 0.1) * s, (0.01 + rnd() * 0.05) * s);
    }
    const fc = [C('#f0a020'), C('#e8c020'), C('#d86a1a')];
    for (let i = 0; i < 7; i++) {
      const a = i * 2.39996, rr = 0.07 * s * Math.sqrt(rnd());
      const px = x + Math.sin(a) * rr, pz = z + Math.cos(a) * rr, py = top + (0.15 + rnd() * 0.05) * s;
      for (let f = 0; f < 5; f++) flower(px + Math.sin(f * 1.26) * 0.012 * s, py + (f % 2) * 0.008 * s, pz + Math.cos(f * 1.26) * 0.012 * s, fc[(i + seed) % 3], 0.02 * s);
    }
    return;
  }
  // azalea: 小さい葉を半球の上に外向きに並べた、こんもりした株（花は少し）
  const R = 0.19 * s, cy = top + 0.1 * s;
  // 葉の奥の暗い芯（すき間から向こうが透けないように）
  k.color(C('#233f1f'));
  k.geo('foliage', new THREE.IcosahedronGeometry(R * 0.78, 1).scale(1, 0.78, 1), new THREE.Matrix4().setPosition(x, cy - 0.01 * s, z));
  for (let i = 0; i < 240; i++) {
    const u = rnd(), v = rnd() * 0.85, a = u * Math.PI * 2, el = Math.asin(v);
    const nx = Math.cos(el) * Math.sin(a), ny = Math.sin(el), nz = Math.cos(el) * Math.cos(a);
    const px = x + nx * R * 0.85, py = cy + ny * R * 0.8 - 0.02 * s, pz = z + nz * R * 0.85;
    const len = (0.05 + rnd() * 0.03) * s;
    const m = new THREE.Matrix4().lookAt(new THREE.Vector3(0, 0, 0), new THREE.Vector3(nx, ny * 0.6 + 0.4, nz).normalize(), new THREE.Vector3(0, 1, 0));
    m.multiply(new THREE.Matrix4().makeRotationZ(rnd() * 6.28));
    // lookAt は -z を向けるので、葉（+z）を外へ向けるため反転
    m.multiply(new THREE.Matrix4().makeRotationY(Math.PI));
    m.setPosition(px, py, pz);
    k.color(green(-0.04, 0.08).offsetHSL(0.01, 0, 0));
    k.geo('foliage', leafGeo(len, len * 0.5, 0.15, 0.2, 'oval', 2), m);
  }
  const fc = [C('#e05a8a'), C('#f2f0ea'), C('#d8324a')][seed % 3];
  for (let i = 0; i < 9; i++) {
    const a = rnd() * 6.28, el = 0.2 + rnd() * 0.9;
    flower(x + Math.cos(el) * Math.sin(a) * R * 0.95, cy + Math.sin(el) * R * 0.85, z + Math.cos(el) * Math.cos(a) * R * 0.95, fc, 0.028 * s);
  }
  // 幹（土の上に見える根元）
  k.color(C('#5a4636')); k.rod('foliage', [x, top, z], [x + 0.01, cy, z], 0.02 * s);
}

// 雑草の株（空き地・畑のきわ）。kind: 'grass'（エノコログサ・メヒシバ: 細い葉と穂）/ 'tall'（ヨモギ・セイタカアワダチソウの夏の姿: 背の高い茎に細い葉）
// 'low'（ドクダミ・カタバミ: 地面を覆う丸い葉）。x, y, z = 株元
export function weedClump(k, x, y, z, { kind = 'grass', s = 1, seed = 1 } = {}) {
  plantMats(k);
  let q = seed * 7919 + 104729;
  const rnd = () => ((q = (q * 16807) % 2147483647) / 2147483647);
  rnd(); rnd();
  const green = (l, v = 0.06) => C('#4d7a32').offsetHSL((rnd() - 0.5) * 0.04, (rnd() - 0.5) * 0.12, l + (rnd() - 0.5) * v);
  const put = (g, col, yaw, pitch, px, py, pz) => {
    const m = new THREE.Matrix4().makeRotationY(yaw).multiply(new THREE.Matrix4().makeRotationX(-pitch));
    m.setPosition(px, py, pz);
    k.color(col); k.geo('foliage', g, m);
  };
  if (kind === 'grass') {
    const n = 22 + Math.floor(rnd() * 16);
    for (let i = 0; i < n; i++) {
      const a = rnd() * 6.283, len = (0.28 + rnd() * 0.45) * s;
      const dry = rnd() < 0.15;
      put(leafGeo(len, 0.03 * s, 0.6 + rnd() * 0.9, 0.2, 'blade', 5), dry ? C('#a39a5a').offsetHSL(0, 0, (rnd() - 0.5) * 0.08) : green(0), a, 0.9 + rnd() * 0.55, x + Math.sin(a) * 0.03 * s, y, z + Math.cos(a) * 0.03 * s);
    }
    // 穂（エノコログサ: 細い茎の先で垂れる、毛羽立った穂）
    const heads = Math.floor(rnd() * 5);
    for (let i = 0; i < heads; i++) {
      const a = rnd() * 6.283, h = (0.45 + rnd() * 0.3) * s, lean = 0.08 + rnd() * 0.1;
      const tx = x + Math.sin(a) * lean * s, tz = z + Math.cos(a) * lean * s;
      k.color(C('#6f8a3e')); k.rod('foliage', [x, y, z], [tx, y + h, tz], 0.006 * s);
      const hg = new THREE.CylinderGeometry(0.014 * s, 0.006 * s, 0.09 * s, 6).translate(0, 0.045 * s, 0).rotateZ(-0.9).rotateY(a - Math.PI / 2);
      k.color(C('#8fa05a').offsetHSL(0, 0, (rnd() - 0.5) * 0.08)); k.geo('foliage', hg, new THREE.Matrix4().setPosition(tx, y + h, tz));
    }
    return;
  }
  if (kind === 'tall') {
    const stems = 3 + Math.floor(rnd() * 4);
    for (let i = 0; i < stems; i++) {
      const a = rnd() * 6.283, h = (0.8 + rnd() * 0.7) * s, lean = rnd() * 0.12 * s;
      const bx = x + Math.sin(a) * 0.08 * s, bz = z + Math.cos(a) * 0.08 * s, tx = bx + Math.sin(a) * lean, tz = bz + Math.cos(a) * lean;
      k.color(C('#5a6e3a')); k.rod('foliage', [bx, y, bz], [tx, y + h, tz], 0.008 * s);
      const nl = 16 + Math.floor(rnd() * 6);
      for (let j = 0; j < nl; j++) {
        const t = 0.08 + (j / nl) * 0.9, px = bx + (tx - bx) * t, pz = bz + (tz - bz) * t, py = y + h * t;
        const len = (0.26 - t * 0.13) * s;
        put(leafGeo(len, len * 0.3, 0.9, 0.25, 'oval', 4), green(-0.04 + t * 0.05), j * 2.39996 + a, 0.15 + rnd() * 0.45, px, py, pz);
      }
      // 先の若い葉の房
      for (let j = 0; j < 5; j++) put(leafGeo(0.09 * s, 0.03 * s, 0.3, 0.2, 'oval', 3), green(0.04), j * 1.26 + a, 0.9 + rnd() * 0.4, tx, y + h - 0.02, tz);
    }
    return;
  }
  // low: 地面すれすれの丸い葉
  const n = 14 + Math.floor(rnd() * 10);
  for (let i = 0; i < n; i++) {
    const a = rnd() * 6.283, rr = rnd() * 0.18 * s, len = (0.05 + rnd() * 0.04) * s;
    put(leafGeo(len, len * 0.95, 0.2, 0.15, 'round', 3), green(-0.06).offsetHSL(0, 0.05, 0), rnd() * 6.283, 0.15 + rnd() * 0.4, x + Math.sin(a) * rr, y + 0.02 + rnd() * 0.06 * s, z + Math.cos(a) * rr);
  }
}
