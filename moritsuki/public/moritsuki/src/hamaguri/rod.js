// ハマグリ突き棒（参考: 手作りの格子のモリ）
// ・柄: アルミの中空パイプ 長さ 1m・太さ 1.4cm、上に黒いゴムのキャップ
// ・付け根: ステンレスのスリーブにボルト 2 本、四角い鉄の板
// ・先: 16cm 角の枠に 4cm の格子（5×5 の交点）、交点から下へ 25 本の爪（長さ約 9cm・太さ 4.5mm、先をとがらせた鉄）
// ・溶接のビードと焼け色
// 棒のローカル座標: 原点 = 格子の中心（爪の付け根）、+y = 柄の向き。爪の先は y = -TINE
import * as THREE from 'three';
import { patchMaterial } from './shade.js';
import { RNG } from './core/noise.js';

export const TINE = 0.09;        // 爪の長さ
export const GRID = 0.04;        // 格子の間隔
export const HALF = 0.08;        // 枠の半分
export const SHAFT_TOP = 0.92;   // 柄の上端（格子から。爪の先から上端までで約 1m）
export const GRIPS = [0.6, 0.84]; // 手で握る所（格子から）
const TINE_R = 0.00225, BAR_R = 0.0024, PIPE_R = 0.0072;

const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

// 形を一つにまとめる（位置・法線・色）
class Parts {
  constructor() { this.list = []; }
  add(geo, m, color = '#ffffff') {
    const g = geo.index ? geo.toNonIndexed() : geo;
    if (m) g.applyMatrix4(m);
    const c = new THREE.Color(color);
    const n = g.attributes.position.count;
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const cc = typeof color === 'function' ? color(g.attributes.position, i) : c;
      col[i * 3] = cc.r; col[i * 3 + 1] = cc.g; col[i * 3 + 2] = cc.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'color'].includes(k)) g.deleteAttribute(k);
    this.list.push(g);
  }
  build() {
    let n = 0;
    for (const g of this.list) n += g.attributes.position.count;
    const pos = new Float32Array(n * 3), nrm = new Float32Array(n * 3), col = new Float32Array(n * 3);
    let o = 0;
    for (const g of this.list) {
      pos.set(g.attributes.position.array, o * 3);
      nrm.set(g.attributes.normal.array, o * 3);
      col.set(g.attributes.color.array, o * 3);
      o += g.attributes.position.count;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.computeBoundingSphere();
    return geo;
  }
}

const along = (a, b) => {
  // +y の円柱を a→b に置く行列
  const d = b.clone().sub(a);
  const len = d.length();
  const m = new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(V3(0, 1, 0), d.normalize()), V3(1, len, 1));
  return m;
};

/** 溶接の焼け色（溶接点からの距離 d[m] で、金 → 紫 → 青 → 地の色） */
function heatTint(base, d) {
  const c = new THREE.Color(base);
  const t = d / 0.0065;
  if (t < 1) {
    const straw = new THREE.Color('#b8964e'), purple = new THREE.Color('#6a4a7a'), blue = new THREE.Color('#44607e');
    const k = t < 0.35 ? straw.lerp(purple, t / 0.35) : t < 0.7 ? purple.lerp(blue, (t - 0.35) / 0.35) : blue.lerp(c, (t - 0.7) / 0.3);
    return k;
  }
  return c;
}

// アルミの縦すじ（ヘアライン）の粗さのむら
function brushedTexture() {
  const W = 8, H = 512;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  const r = new RNG(9);
  for (let y = 0; y < H; y++) {
    const v = 150 + r.range(-30, 30);
    g.fillStyle = `rgb(${v},${v},${v})`;
    g.fillRect(0, y, W, 1);
  }
  // 手あか・小さな傷
  for (let i = 0; i < 40; i++) {
    g.fillStyle = `rgba(${r.next() < 0.5 ? 60 : 230},${r.next() < 0.5 ? 60 : 230},${r.next() < 0.5 ? 60 : 230},0.25)`;
    g.fillRect(0, r.range(0, H), W, r.range(1, 6));
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export function makeRodMesh() {
  const rng = new RNG(424);
  const steel = new Parts(), alu = new Parts(), shiny = new Parts(), rubber = new Parts();
  const iron = '#77797b';

  // ── 爪 25 本（手作りなので少しずつ長さと傾きがちがう）
  const nodes = [];
  for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) nodes.push([-HALF + i * GRID, -HALF + j * GRID]);
  for (const [x, z] of nodes) {
    const len = TINE - 0.012 + rng.range(-0.003, 0.002);
    const tilt = V3(rng.range(-0.02, 0.02), -1, rng.range(-0.02, 0.02)).normalize();
    const a = V3(x, 0.001, z), b = a.clone().addScaledVector(tilt, len);
    const cyl = new THREE.CylinderGeometry(TINE_R, TINE_R, 1, 8, 10, true);
    steel.add(cyl, along(a, b), (p, i) => {
      const v = V3().fromBufferAttribute(p, i);
      return heatTint(iron, Math.abs(v.y));
    });
    // とがった先（研いだ面が少し光る）
    const tip = new THREE.ConeGeometry(TINE_R, 0.013, 8, 2);
    const m = new THREE.Matrix4().compose(b.clone().addScaledVector(tilt, 0.0065), new THREE.Quaternion().setFromUnitVectors(V3(0, 1, 0), tilt), V3(1, 1, 1));
    steel.add(tip, m, '#9a9da0');
    // 付け根の溶接ビード
    const bead = new THREE.SphereGeometry(0.0042, 8, 6);
    bead.scale(1, 0.7, 1);
    steel.add(bead, new THREE.Matrix4().makeTranslation(x + rng.range(-0.0005, 0.0005), 0.0005, z), '#8a7a5c');
  }
  // ── 格子（x 方向と z 方向の棒 5 本ずつ、上下にずらして重ねる）
  for (let k = 0; k < 5; k++) {
    const c = -HALF + k * GRID;
    const ax = V3(-HALF - 0.004, 0.0026, c), bx = V3(HALF + 0.004, 0.0026, c);
    steel.add(new THREE.CylinderGeometry(BAR_R, BAR_R, 1, 8, 64), along(ax, bx), (p, i) => {
      const v = V3().fromBufferAttribute(p, i);
      const dn = Math.abs(((v.x + HALF) % GRID + GRID) % GRID - GRID / 2);
      return heatTint(iron, GRID / 2 - dn);
    });
    const az = V3(c, 0.0074, -HALF - 0.004), bz = V3(c, 0.0074, HALF + 0.004);
    steel.add(new THREE.CylinderGeometry(BAR_R, BAR_R, 1, 8, 64), along(az, bz), (p, i) => {
      const v = V3().fromBufferAttribute(p, i);
      const dn = Math.abs(((v.z + HALF) % GRID + GRID) % GRID - GRID / 2);
      return heatTint(iron, GRID / 2 - dn);
    });
  }
  // ── 四角い板と、柄を受けるスリーブ
  const plate = new THREE.BoxGeometry(0.052, 0.006, 0.052, 1, 1, 1);
  steel.add(plate, new THREE.Matrix4().makeTranslation(0, 0.0128, 0), '#5f6163');
  // 板のまわりの溶接
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const bead = new THREE.SphereGeometry(0.0036, 6, 5);
    steel.add(bead, new THREE.Matrix4().makeTranslation(Math.cos(a) * 0.0125, 0.0165, Math.sin(a) * 0.0125), '#7d6a4e');
  }
  const sl = [new THREE.Vector2(0.0095, 0.0155)];
  for (let y = 0.017; y < 0.0925; y += 0.003) sl.push(new THREE.Vector2(0.0108, y));
  sl.push(new THREE.Vector2(0.0108, 0.093), new THREE.Vector2(0.0098, 0.095), new THREE.Vector2(PIPE_R + 0.0003, 0.095));
  const sleeve = new THREE.LatheGeometry(sl, 20);
  shiny.add(sleeve, null, (p, i) => heatTint('#c9ccd0', Math.max(0, p.getY(i) - 0.016)));
  // ボルト 2 本（六角の頭とナット、ねじ山の先）
  for (const [y, rot] of [[0.038, 0], [0.072, 0]]) {
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rot, Math.PI / 2));
    const shaft = new THREE.CylinderGeometry(0.0024, 0.0024, 0.034, 8);
    shiny.add(shaft, new THREE.Matrix4().compose(V3(0, y, 0), q, V3(1, 1, 1)), '#b3b0a6');
    const head = new THREE.CylinderGeometry(0.0048, 0.0048, 0.0032, 6);
    shiny.add(head, new THREE.Matrix4().compose(V3(0.0126, y, 0), q, V3(1, 1, 1)), '#b8b4a8');
    const nut = new THREE.CylinderGeometry(0.0048, 0.0048, 0.0042, 6);
    shiny.add(nut, new THREE.Matrix4().compose(V3(-0.0128, y, 0), q, V3(1, 1, 1)), '#aaa69a');
    const washer = new THREE.CylinderGeometry(0.0056, 0.0056, 0.0008, 12);
    shiny.add(washer, new THREE.Matrix4().compose(V3(0.011, y, 0), q, V3(1, 1, 1)), '#c4c2ba');
  }
  // ── アルミの柄とゴムのキャップ
  const pipe = new THREE.CylinderGeometry(PIPE_R, PIPE_R, SHAFT_TOP - 0.06, 18, 1, false);
  alu.add(pipe, new THREE.Matrix4().makeTranslation(0, 0.06 + (SHAFT_TOP - 0.06) / 2, 0), '#d8dadc');
  const cap = new THREE.LatheGeometry([
    new THREE.Vector2(0.0001, SHAFT_TOP + 0.016), new THREE.Vector2(0.006, SHAFT_TOP + 0.0155), new THREE.Vector2(0.0082, SHAFT_TOP + 0.012),
    new THREE.Vector2(0.0084, SHAFT_TOP - 0.022), new THREE.Vector2(PIPE_R + 0.0002, SHAFT_TOP - 0.023),
  ], 18);
  rubber.add(cap, null, '#1e1e1f');

  const mk = (o) => patchMaterial(new THREE.MeshStandardMaterial({ vertexColors: true, ...o }), { caustics: true });
  const brushed = brushedTexture();
  brushed.repeat.set(1, 3);
  const group = new THREE.Group();
  const add = (p, m) => { const mesh = new THREE.Mesh(p.build(), m); mesh.castShadow = true; mesh.receiveShadow = true; group.add(mesh); return mesh; };
  add(steel, mk({ metalness: 0.85, roughness: 0.46 }));
  add(shiny, mk({ metalness: 1.0, roughness: 0.24 }));
  add(alu, mk({ metalness: 1.0, roughness: 0.3, roughnessMap: brushed }));
  add(rubber, mk({ metalness: 0, roughness: 0.9, envMapIntensity: 0.25 }));
  return group;
}

/** 爪の先の位置（棒のローカル）。当たり判定用 */
export const TINE_NODES = (() => {
  const a = [];
  for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) a.push([-HALF + i * GRID, -HALF + j * GRID]);
  return a;
})();
