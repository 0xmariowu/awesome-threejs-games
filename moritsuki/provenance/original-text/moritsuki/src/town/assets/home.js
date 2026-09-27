// 自分の家: 大きめの平屋（入母屋の瓦屋根・白壁と焼杉の腰壁・縁側・切妻の玄関）と、その敷地（庭・生垣・門柱・カーポート）
// 敷地のローカル座標: 原点 = 敷地の中心（y = 0 は家の基準の地面）、+z = 道の側、+x = 道から見て右
// 敷地は x: -11..11、z: -5.3..5.3
import * as THREE from 'three';
import { C, wallFrame, holeyWall, slider, irimoya, kirizuma, canvasTex, needMat, groundPatch, clothGeo } from './build.js';
import { car, bicycle } from './props.js';
import { pottedPlant } from './plants.js';
import { flatMaterials } from '../lots.js';

export const HOME_LOT = { w: 22, d: 10.6 };

const FL = 0.55;          // 床の高さ
const H = FL + 2.75;      // 壁の上端
const WAIST = FL + 0.85;  // 腰壁の上端
const MAIN = { x0: -9.25, x1: 5.25, z0: -4.6, z1: 2.0 };
const WING = { x0: 0.8, x1: 4.4, z0: 2.0, z1: 3.8 };
const ENG = { x0: -8.75, x1: 0.35 };   // 縁側の開口
const COL = {
  plaster: C('#f2eee4'), yakisugi: C('#d4c6b4'), post: C('#4a3a2c'), kawara: C('#a3a6aa'), trim: C('#4a3a2c'),
  soffit: C('#c9b596'), found: C('#a8a49a'), engawa: C('#b98b5a'), sash: C('#6b5a48'),
};

// 畳・障子・簾のテクスチャ
function homeMats(k) {
  needMat(k, 'tatami', () => {
    const t = canvasTex('tatami', 256, 512, (g, w, h) => {
      g.fillStyle = '#c9c28a'; g.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 3) { g.fillStyle = `rgba(90,80,30,${0.08 + (y % 6 ? 0 : 0.06)})`; g.fillRect(0, y, w, 1); }
      for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(255,250,200,${Math.random() * 0.08})`; g.fillRect(Math.random() * w, Math.random() * h, 30 + Math.random() * 60, 1); }
      g.fillStyle = '#23352b'; g.fillRect(0, 0, 14, h); g.fillRect(w - 14, 0, 14, h);
      g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(3, 0, 2, h); g.fillRect(w - 11, 0, 2, h);
    });
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return new THREE.MeshStandardMaterial({ map: t, vertexColors: true, roughness: 0.85 });
  });
  needMat(k, 'shoji', () => {
    // 1 マス 0.3 × 0.27 m の組子
    const t = canvasTex('shoji', 128, 128, (g, w, h) => {
      g.fillStyle = '#f7f3e8'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(200,190,160,${Math.random() * 0.1})`; g.fillRect(Math.random() * w, Math.random() * h, 2 + Math.random() * 6, 2 + Math.random() * 6); }
      g.fillStyle = '#b8a07a'; g.fillRect(0, 0, w, 7); g.fillRect(0, 0, 7, h);
    });
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(1 / 0.3, 1 / 0.27);
    return new THREE.MeshStandardMaterial({ map: t, vertexColors: true, roughness: 0.9, emissive: new THREE.Color('#fff6e0'), emissiveIntensity: 0.08 });
  });
  needMat(k, 'sudare', () => {
    const t = canvasTex('sudare', 64, 256, (g, w, h) => {
      g.clearRect(0, 0, w, h);
      for (let y = 0; y < h; y += 4) { g.fillStyle = `rgba(${176 + (y % 12)},${140 + (y % 8)},${80},1)`; g.fillRect(0, y, w, 3); }
      g.fillStyle = 'rgba(90,60,30,1)'; for (const x of [8, 32, 56]) g.fillRect(x, 0, 2, h);
    });
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(1, 6);
    return new THREE.MeshStandardMaterial({ map: t, vertexColors: true, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.9 });
  });
  Object.assign(k.mats, flatMaterials(), { ...k.mats });
}

const flat = groundPatch;

// 塀は軸に平行（x 方向か z 方向）にだけ置く
function wallX(k, env, x0, x1, z, h) {
  const n = Math.max(1, Math.ceil((x1 - x0) / 1.5)), l = (x1 - x0) / n;
  for (let q = 0; q < n; q++) {
    const x = x0 + l * (q + 0.5), g = env.gy(x, z);
    k.at(env.M).color(C('#d8d4ca'));
    k.box('block', x, (g - 0.25 + g + h) / 2, z, l + 0.01, h + 0.25, 0.15);
    k.color(C('#9d998f')); k.box('concrete', x, g + h + 0.03, z, l + 0.03, 0.06, 0.19);
  }
  env.fence?.(x0, z, x1, z, 0.12);
}
function wallZ(k, env, z0, z1, x, h) {
  const n = Math.max(1, Math.ceil((z1 - z0) / 1.5)), l = (z1 - z0) / n;
  for (let q = 0; q < n; q++) {
    const z = z0 + l * (q + 0.5), g = env.gy(x, z);
    k.at(env.M).color(C('#d8d4ca'));
    k.box('block', x, (g - 0.25 + g + h) / 2, z, 0.15, h + 0.25, l + 0.01);
    k.color(C('#9d998f')); k.box('concrete', x, g + h + 0.03, z, 0.19, 0.06, l + 0.03);
  }
  env.fence?.(x, z0, x, z1, 0.12);
}

// 白壁（上）と焼杉の腰壁（下）を、開口を抜いて張る
function twoToneWall(k, M, ax, az, bx, bz, holes, { y0 = 0.5 } = {}) {
  const { m, L } = wallFrame(M, ax, az, bx, bz);
  k.at(m);
  k.color(COL.yakisugi); holeyWall(k, 'wood', L, y0, WAIST, holes, 0.16);
  k.color(COL.plaster); holeyWall(k, 'mortar', L, WAIST, H, holes, 0.16);
  // 見切り（腰壁の上）・隅の柱・軒下の帯
  k.color(COL.post);
  let x = 0;
  const cuts = holes.filter((h) => h.y0 < WAIST && h.y1 > WAIST).sort((a, b) => a.x0 - b.x0);
  for (const h of cuts) { if (h.x0 > x) k.box('trim', (x + h.x0) / 2, WAIST, 0.02, h.x0 - x, 0.06, 0.05); x = h.x1; }
  if (x < L) k.box('trim', (x + L) / 2, WAIST, 0.02, L - x, 0.06, 0.05);
  for (const cx of [0.06, L - 0.06]) k.box('trim', cx, (y0 + H) / 2, 0.02, 0.13, H - y0, 0.06);
  k.box('trim', L / 2, H - 0.12, 0.02, L, 0.16, 0.05);
  return { m, L };
}

// 格子の付いた小窓（台所・風呂）
function latticeWindow(k, x0, x1, y0, y1) {
  slider(k, x0, x1, y0, y1, 0.08, { frame: C('#8d8a82'), glass: C('#c9ccc8'), win: 'glass' });
  k.color(C('#5a4a3a'));
  for (let x = x0 + 0.06; x < x1 - 0.02; x += 0.09) k.box('trim', x, (y0 + y1) / 2, 0.06, 0.03, y1 - y0 + 0.12, 0.03);
  k.box('trim', (x0 + x1) / 2, y1 + 0.06, 0.06, x1 - x0 + 0.1, 0.04, 0.06);
  k.box('trim', (x0 + x1) / 2, y0 - 0.06, 0.06, x1 - x0 + 0.1, 0.04, 0.06);
}

export function buildHome(k, env, r = Math.random) {
  homeMats(k);
  const M = env.M;
  env.chunk?.(0, 0);
  const mw = MAIN.x1 - MAIN.x0, md = MAIN.z1 - MAIN.z0, mcx = (MAIN.x0 + MAIN.x1) / 2, mcz = (MAIN.z0 + MAIN.z1) / 2;
  k.at(M);

  // ---------- 基礎 ----------
  const gmin = Math.min(env.gy(MAIN.x0, MAIN.z0), env.gy(MAIN.x1, MAIN.z0), env.gy(MAIN.x0, MAIN.z1), env.gy(MAIN.x1, MAIN.z1));
  k.color(COL.found);
  k.box('concrete', mcx, (gmin - 0.4 + 0.5) / 2, mcz, mw + 0.08, 0.5 - gmin + 0.4, md + 0.08);
  k.box('concrete', (WING.x0 + WING.x1) / 2, (gmin - 0.4 + 0.2) / 2, (WING.z0 + WING.z1) / 2 + 0.02, WING.x1 - WING.x0 + 0.08, 0.2 - gmin + 0.4, WING.z1 - WING.z0 + 0.04);
  // 床下の換気口
  k.color(C('#2e2e2c'));
  for (let x = MAIN.x0 + 1.2; x < MAIN.x1 - 0.5; x += 2.4) {
    if (x > ENG.x0 - 0.2 && x < ENG.x1 + 0.2) continue;
    k.box('dark', x, 0.3, MAIN.z1 + 0.045, 0.32, 0.1, 0.01);
  }
  for (let x = MAIN.x0 + 1.0; x < MAIN.x1 - 0.5; x += 2.4) k.box('dark', x, 0.3, MAIN.z0 - 0.045, 0.32, 0.1, 0.01);

  // ---------- 外壁 ----------
  const engHole = { x0: ENG.x0 - MAIN.x0, x1: ENG.x1 - MAIN.x0, y0: FL, y1: FL + 2.05 };
  // 正面（縁側。玄関の袖の中は隠れるので壁だけ）
  twoToneWall(k, M, MAIN.x0, MAIN.z1, MAIN.x1, MAIN.z1, [engHole]);
  // 右（台所の格子窓・風呂の小窓）
  {
    const { m } = twoToneWall(k, M, MAIN.x1, MAIN.z1, MAIN.x1, MAIN.z0, [{ x0: 1.2, x1: 2.9, y0: FL + 1.0, y1: FL + 2.0 }, { x0: 4.4, x1: 5.3, y0: FL + 1.35, y1: FL + 2.0 }]);
    k.at(m);
    latticeWindow(k, 1.2, 2.9, FL + 1.0, FL + 2.0);
    latticeWindow(k, 4.4, 5.3, FL + 1.35, FL + 2.0);
  }
  // 裏（引き違い窓が並ぶ。雨戸の戸袋つき）
  {
    const wins = [[1.0, 2.7], [4.2, 5.9], [8.6, 10.3], [11.8, 13.5]];
    const { m } = twoToneWall(k, M, MAIN.x1, MAIN.z0, MAIN.x0, MAIN.z0, wins.map(([a, b]) => ({ x0: a, x1: b, y0: FL + 0.85, y1: FL + 2.0 })));
    k.at(m);
    for (const [a, b] of wins) {
      slider(k, a, b, FL + 0.85, FL + 2.0, 0.08, { frame: COL.sash, glass: C('#35404a') });
      k.color(COL.post); k.box('trim', b + 0.45, FL + 1.45, 0.08, 0.8, 1.35, 0.16);
    }
  }
  // 左（窓ひとつ）
  {
    const { m } = twoToneWall(k, M, MAIN.x0, MAIN.z0, MAIN.x0, MAIN.z1, [{ x0: 2.2, x1: 3.9, y0: FL + 0.85, y1: FL + 2.0 }]);
    k.at(m);
    slider(k, 2.2, 3.9, FL + 0.85, FL + 2.0, 0.08, { frame: COL.sash, glass: C('#35404a') });
  }

  // ---------- 縁側と、開け放した座敷 ----------
  {
    const x0 = ENG.x0, x1 = ENG.x1, z = MAIN.z1, top = FL + 2.05;
    const bays = 4, bw = (x1 - x0) / bays;
    k.at(M);
    // 座敷: 畳・天井・奥の壁・襖
    const room = { x0: x0, x1: x1, z0: -1.4, z1: z - 0.16 };
    k.color(C('#ffffff'));
    for (let x = room.x0; x < room.x1 - 0.05; x += 1.8) for (let zz = room.z0; zz < room.z1 - 0.05; zz += 0.9) {
      const xa = x, xb = Math.min(room.x1, x + 1.8), za = zz, zb = Math.min(room.z1, zz + 0.9);
      k.face('tatami', [[xa, FL + 0.01, zb], [xb, FL + 0.01, zb], [xb, FL + 0.01, za], [xa, FL + 0.01, za]], [[0, 0], [0, (xb - xa) / 1.8], [(zb - za) / 0.9, (xb - xa) / 1.8], [(zb - za) / 0.9, 0]]);
    }
    k.color(C('#b89a74'));
    k.face('trim', [[room.x0, FL + 2.4, room.z0], [room.x1, FL + 2.4, room.z0], [room.x1, FL + 2.4, room.z1], [room.x0, FL + 2.4, room.z1]]);
    // 奥: 襖（白地に薄い柄）と床の間の掛け軸
    k.color(C('#efe8d8'));
    k.face('mortar', [[room.x0, FL, room.z0 + 0.001], [room.x1, FL, room.z0 + 0.001], [room.x1, FL + 2.4, room.z0 + 0.001], [room.x0, FL + 2.4, room.z0 + 0.001]], [[0, 0], [room.x1 - room.x0, 0], [room.x1 - room.x0, 2.4], [0, 2.4]]);
    k.color(C('#6b4e34'));
    for (let x = room.x0 + 1.8; x < room.x1 - 0.2; x += 1.8) k.box('trim', x, FL + 1.2, room.z0 + 0.04, 0.1, 2.4, 0.06);
    k.box('trim', (room.x0 + room.x1) / 2, FL + 1.8, room.z0 + 0.05, room.x1 - room.x0, 0.07, 0.05);
    k.color(C('#e9e1cc')); k.box('trim', room.x0 + 1.3, FL + 1.2, room.z0 + 0.03, 0.5, 1.1, 0.01);
    k.color(C('#2a2622')); k.box('trim', room.x0 + 1.3, FL + 1.25, room.z0 + 0.04, 0.05, 0.6, 0.005);
    // 両脇の壁
    k.color(COL.plaster);
    k.face('mortar', [[room.x0 + 0.01, FL, room.z1], [room.x0 + 0.01, FL, room.z0], [room.x0 + 0.01, FL + 2.4, room.z0], [room.x0 + 0.01, FL + 2.4, room.z1]]);
    k.face('mortar', [[room.x1 - 0.01, FL, room.z0], [room.x1 - 0.01, FL, room.z1], [room.x1 - 0.01, FL + 2.4, room.z1], [room.x1 - 0.01, FL + 2.4, room.z0]]);
    // 鴨居の上の小壁（部屋側）
    k.face('mortar', [[room.x0, top, room.z1 - 0.001], [room.x1, top, room.z1 - 0.001], [room.x1, FL + 2.4, room.z1 - 0.001], [room.x0, FL + 2.4, room.z1 - 0.001]].reverse());
    // ちゃぶ台・座布団・扇風機
    const tx = x0 + bw * 1.9, tz = 0.2;
    k.color(C('#6a4428'));
    k.cyl('trim', tx, FL + 0.3, tz, 0.5, 0.04, 24);
    for (const [dx, dz] of [[0.3, 0.3], [-0.3, 0.3], [0.3, -0.3], [-0.3, -0.3]]) k.box('trim', tx + dx, FL + 0.15, tz + dz, 0.05, 0.3, 0.05);
    k.color(C('#e8e4da')); k.cyl('plastic', tx + 0.1, FL + 0.34, tz - 0.05, 0.06, 0.07, 12);
    k.color(C('#2f6f4f')); k.cyl('plastic', tx - 0.18, FL + 0.34, tz + 0.1, 0.05, 0.08, 12);
    for (const [dx, dz, c] of [[0, 0.85, '#a03a2e'], [-0.85, 0, '#34568a'], [0.85, -0.1, '#a03a2e']]) { k.color(C(c)); k.box('cloth', tx + dx, FL + 0.05, tz + dz, 0.55, 0.08, 0.55); }
    {
      const fx = x0 + bw * 3.3, fz = -0.6;
      k.color(C('#e9ecec')); k.cyl('plastic', fx, FL, fz, 0.17, 0.05, 16);
      k.cyl('plastic', fx, FL + 0.05, fz, 0.025, 0.75, 8);
      k.color(C('#8fb8d8'));
      k.geo('plastic', new THREE.CylinderGeometry(0.2, 0.2, 0.05, 20).rotateX(Math.PI / 2).rotateY(0.5), new THREE.Matrix4().setPosition(fx, FL + 0.85, fz + 0.05));
      k.color(C('#e9ecec'));
      k.geo('plastic', new THREE.TorusGeometry(0.22, 0.012, 6, 24).rotateY(0.5), new THREE.Matrix4().setPosition(fx + 0.02, FL + 0.85, fz + 0.08));
    }
    // 開口の柱・鴨居・敷居と、障子（両端の間は閉め、中の 2 間は開け放して簾を下ろす）
    k.at(M);
    k.color(COL.post);
    for (let q = 0; q <= bays; q++) k.box('trim', x0 + q * bw, (FL + top) / 2, z - 0.06, 0.13, top - FL, 0.13);
    k.box('trim', (x0 + x1) / 2, top + 0.06, z - 0.06, x1 - x0 + 0.13, 0.13, 0.14);
    k.color(C('#8a6a48')); k.box('trim', (x0 + x1) / 2, FL + 0.02, z - 0.08, x1 - x0, 0.04, 0.16);
    for (let q = 0; q < bays; q++) {
      const a = x0 + q * bw + 0.07, b = x0 + (q + 1) * bw - 0.07;
      if (q === 0 || q === bays - 1) {
        // 障子 2 枚（前後にずらす）
        for (const [s, e, dz] of [[a, (a + b) / 2 + 0.03, -0.1], [(a + b) / 2 - 0.03, b, -0.05]]) {
          k.color(C('#ffffff'));
          k.face('shoji', [[s, FL + 0.04, dz], [e, FL + 0.04, dz], [e, top - 0.02, dz], [s, top - 0.02, dz]].map(([x, y, zz]) => [x, y, z + zz]), [[s, FL], [e, FL], [e, top], [s, top]]);
          k.color(C('#b8a07a'));
          for (const xx of [s + 0.02, e - 0.02]) k.box('trim', xx, (FL + top) / 2, z + dz + 0.01, 0.035, top - FL - 0.06, 0.03);
          k.box('trim', (s + e) / 2, FL + 0.2, z + dz + 0.01, e - s, 0.3, 0.02);
        }
      } else {
        // 簾（半分まで下ろす）
        k.color(C('#ffffff'));
        const y0 = FL + 0.95 + (q === 1 ? 0.15 : 0);
        k.face('sudare', [[a - 0.03, y0, z + 0.9], [b + 0.03, y0, z + 0.9], [b + 0.03, top + 0.1, z + 0.9], [a - 0.03, top + 0.1, z + 0.9]], [[0, 0], [1, 0], [1, (top + 0.1 - y0)], [0, (top + 0.1 - y0)]]);
        k.color(C('#6b4a2a')); k.box('trim', (a + b) / 2, y0, z + 0.9, b - a + 0.1, 0.03, 0.03);
      }
    }
    // 縁側の板の間（外）・縁の下・沓脱石
    k.color(COL.engawa);
    for (let xx = x0 - 0.2; xx < x1 + 0.2; xx += 0.9) k.box('wood', Math.min(xx + 0.45, x1 + 0.2 - 0.45), FL - 0.03, z + 0.47, 0.9, 0.06, 0.94);
    k.color(C('#3a2e24'));
    k.box('trim', (x0 + x1) / 2, FL - 0.1, z + 0.94, x1 - x0 + 0.4, 0.1, 0.04);
    for (let xx = x0; xx <= x1 + 0.01; xx += (x1 - x0) / 5) k.box('trim', xx, (FL - 0.1) / 2, z + 0.85, 0.09, FL - 0.1, 0.09);
    k.color(C('#8f8b84')); k.box('concrete', (x0 + x1) / 2 - 1.5, 0.12, z + 1.25, 0.9, 0.24, 0.5);
    k.color(C('#e7e2d6')); k.box('rubber', (x0 + x1) / 2 - 1.62, 0.27, z + 1.22, 0.1, 0.05, 0.25);
    k.box('rubber', (x0 + x1) / 2 - 1.4, 0.27, z + 1.26, 0.1, 0.05, 0.25);
    // スイカ（縁側のおやつ）と風鈴
    k.color(C('#2f6b2c')); k.geo('plastic', new THREE.SphereGeometry(0.16, 18, 12).scale(1, 0.92, 1), new THREE.Matrix4().setPosition(x0 + bw * 2.4, FL + 0.14, z + 0.4));
    k.color(C('#c9b28a')); k.cyl('plastic', x0 + bw * 2.4 + 0.45, FL, z + 0.45, 0.16, 0.015, 16);
    k.color(C('#e8413a')); k.geo('plastic', new THREE.CylinderGeometry(0.14, 0.14, 0.05, 12, 1, false, 0, Math.PI).rotateX(Math.PI / 2), new THREE.Matrix4().setPosition(x0 + bw * 2.4 + 0.45, FL + 0.06, z + 0.45));
    // 風鈴は軒先の下に吊る（軒の高さ = H - 0.95 × 0.5）
    const fy = H - 0.95 * 0.5 - 0.3;
    k.color(C('#cfe4f0')); k.geo('glass', new THREE.SphereGeometry(0.07, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.6), new THREE.Matrix4().setPosition(x0 + bw * 1.5, fy, z + 0.7));
    k.color(C('#6b6b6b')); k.rod('metal', [x0 + bw * 1.5, fy + 0.05, z + 0.7], [x0 + bw * 1.5, fy + 0.32, z + 0.7], 0.008);
    k.color(C('#e05a4a')); k.box('cloth', x0 + bw * 1.5, fy - 0.22, z + 0.7, 0.06, 0.26, 0.004);
    env.deck?.([[x0 - 0.2, z], [x1 + 0.2, z], [x1 + 0.2, z + 0.94], [x0 - 0.2, z + 0.94]], FL);
  }

  // ---------- 玄関（切妻の袖） ----------
  {
    const L = WING.z1 - WING.z0;
    // 側面
    for (const [ax, az, bx, bz, win] of [[WING.x0, WING.z0, WING.x0, WING.z1, true], [WING.x1, WING.z1, WING.x1, WING.z0, false]]) {
      const holes = win ? [{ x0: 0.55, x1: 1.35, y0: FL + 1.1, y1: FL + 1.9 }] : [];
      const { m } = twoToneWall(k, M, ax, az, bx, bz, holes, { y0: 0.2 });
      k.at(m);
      if (win) latticeWindow(k, 0.55, 1.35, FL + 1.1, FL + 1.9);
    }
    // 正面: 格子の引き戸（すりガラス）、脇の地窓、表札、灯り
    const dx0 = 0.7, dx1 = 2.75, dy0 = 0.22, dy1 = 2.4;
    const { m } = twoToneWall(k, M, WING.x0, WING.z1, WING.x1, WING.z1, [{ x0: dx0, x1: dx1, y0: dy0, y1: dy1 }], { y0: 0.2 });
    k.at(m);
    const d = 0.1, mid = (dx0 + dx1) / 2;
    k.color(C('#5c4632'));
    k.box('trim', mid, dy1 - 0.03, -d, dx1 - dx0, 0.06, 0.1);
    k.box('trim', mid, dy0 + 0.02, -d, dx1 - dx0, 0.04, 0.1);
    for (const [a, b, z] of [[dx0, mid + 0.02, -d - 0.02], [mid - 0.02, dx1, -d + 0.03]]) {
      k.color(C('#dfe3e3')); k.face('glass', [[a + 0.05, dy0 + 0.05, z], [b - 0.05, dy0 + 0.05, z], [b - 0.05, dy1 - 0.06, z], [a + 0.05, dy1 - 0.06, z]]);
      k.color(C('#6a4e36'));
      for (const x of [a + 0.03, b - 0.03]) k.box('trim', x, (dy0 + dy1) / 2, z + 0.02, 0.06, dy1 - dy0, 0.05);
      k.box('trim', (a + b) / 2, dy0 + 0.35, z + 0.02, b - a, 0.28, 0.05);
      for (let x = a + 0.12; x < b - 0.08; x += 0.075) k.box('trim', x, (dy0 + 0.5 + dy1 - 0.06) / 2, z + 0.03, 0.02, dy1 - dy0 - 0.56, 0.02);
      k.box('trim', (a + b) / 2, dy1 - 0.45, z + 0.03, b - a, 0.025, 0.02);
    }
    k.color(C('#e7dcc4')); k.box('trim', 3.15, 1.75, 0.03, 0.14, 0.42, 0.03);
    k.color(C('#2a2320')); k.box('trim', 3.15, 1.75, 0.046, 0.05, 0.3, 0.004);
    k.color(C('#f4ecd4')); k.box('lamp', 3.15, 2.25, 0.08, 0.16, 0.26, 0.12);
    k.color(C('#4a4a4a')); k.box('plastic', 3.15, 1.35, 0.03, 0.1, 0.14, 0.04);
    void L;
    // 屋根
    k.at(M);
    kirizuma(k, { cx: (WING.x0 + WING.x1) / 2, w: WING.x1 - WING.x0, z0: -0.4, z1: WING.z1, H, over: 0.6, p: 0.56, col: COL.kawara, tile: 'ibushi', trim: COL.trim, soffit: COL.soffit, gable: COL.plaster, front: true });
    // ポーチ（タイルの土間と段）
    k.color(C('#b7ada0'));
    k.box('concrete', (WING.x0 + WING.x1) / 2, 0.1, WING.z1 + 0.5, 2.9, 0.22, 1.0);
    k.color(C('#a39a8c'));
    k.box('concrete', (WING.x0 + WING.x1) / 2 - 0.25, 0.05, WING.z1 + 1.2, 1.6, 0.12, 0.45);
    env.deck?.([[WING.x0 + 0.15, WING.z1], [WING.x1 - 0.15, WING.z1], [WING.x1 - 0.15, WING.z1 + 1.0], [WING.x0 + 0.15, WING.z1 + 1.0]], 0.21);
    // 植木鉢
    for (const [x, kind, s, seed] of [[WING.x0 + 0.62, 'azalea', 1.05, 3], [WING.x1 - 0.62, 'geranium', 1, 1], [WING.x1 - 1.08, 'spider', 0.9, 5]]) {
      pottedPlant(k, x, 0.21, WING.z1 + 0.42, { kind, s, seed });
    }
  }

  // ---------- 屋根（入母屋） ----------
  k.at(M);
  irimoya(k, { cx: mcx, cz: mcz, w: mw, d: md, H, over: 0.95, p: 0.5, ix: 2.1, kb: 0.4, col: COL.kawara, tile: 'ibushi', trim: COL.trim, soffit: COL.soffit, gable: COL.plaster, batten: COL.post });

  // ---------- 設備（右の脇） ----------
  k.at(M);
  for (const z of [-0.2, -2.2]) {
    k.color(C('#ecece6')); k.box('plastic', MAIN.x1 + 0.35, 0.33, z, 0.3, 0.6, 0.8);
    k.color(C('#3a3a3a')); k.geo('dark', new THREE.CylinderGeometry(0.2, 0.2, 0.01, 16).rotateZ(Math.PI / 2), new THREE.Matrix4().setPosition(MAIN.x1 + 0.505, 0.33, z - 0.12));
    k.color(C('#d0d0cc')); k.box('plastic', MAIN.x1 + 0.1, 1.9, z - 0.35, 0.2, 0.06, 0.06);
    k.rod('plastic', [MAIN.x1 + 0.1, 1.9, z - 0.35], [MAIN.x1 + 0.1, 0.45, z - 0.35], 0.05);
  }
  k.color(C('#f0f0ea')); k.box('plastic', MAIN.x1 + 0.45, 0.95, -3.7, 0.7, 1.9, 0.7);
  k.color(C('#d8d8d2')); k.box('plastic', MAIN.x1 + 0.35, 0.45, -4.3, 0.5, 0.8, 0.35);
  k.color(C('#c9c9c4')); k.box('plastic', MAIN.x1 + 0.07, 1.5, 1.2, 0.12, 0.4, 0.28);
  // プロパン（左の脇）
  for (const z of [-3.2, -3.7]) {
    k.color(C('#b9bec2')); k.cyl('metal', MAIN.x0 - 0.35, 0.02, z, 0.19, 1.2, 14);
    k.color(C('#8f959a')); k.cyl('metal', MAIN.x0 - 0.35, 1.22, z, 0.07, 0.12, 10);
  }
  // 物置（右奥。スチールの引き戸はカーポートの側 +x を向く）
  {
    const x0 = 5.55, x1 = 6.65, z0 = -4.95, z1 = -3.3, y0 = env.gy(6.1, -4.1) + 0.1, h = 1.8;
    k.color(C('#9a968c')); for (const z of [z0 + 0.15, z1 - 0.15]) k.box('concrete', (x0 + x1) / 2, y0 - 0.05, z, x1 - x0, 0.1, 0.2); // ブロックの台
    k.color(C('#e2ddcc')); k.box('paint', (x0 + x1) / 2, y0 + h / 2, (z0 + z1) / 2, x1 - x0, h, z1 - z0);
    // 屋根: 前が高い片流れ、四方に少し出す
    const rg = new THREE.BoxGeometry(x1 - x0 + 0.16, 0.05, z1 - z0 + 0.16).rotateZ(0.08);
    k.color(C('#5f6d62')); k.geo('paint', rg, new THREE.Matrix4().setPosition((x0 + x1) / 2, y0 + h + 0.06, (z0 + z1) / 2));
    // 引き戸 2 枚（縦のリブ・取っ手・下のレール）
    const fx = x1 + 0.005, dw = (z1 - z0 - 0.1) / 2;
    for (let q = 0; q < 2; q++) {
      const za = z0 + 0.05 + q * dw, zb = za + dw, off = q ? 0.012 : 0.022;
      k.color(C('#d6d0bd')); k.box('paint', fx + off, y0 + 0.9, (za + zb) / 2, 0.01, 1.62, dw - 0.02);
      k.color(C('#c4bea9')); for (let z = za + 0.12; z < zb - 0.05; z += 0.16) k.box('paint', fx + off + 0.008, y0 + 0.9, z, 0.012, 1.55, 0.03);
      k.color(C('#4a4a48')); k.box('metal', fx + off + 0.02, y0 + 0.95, q ? za + 0.08 : zb - 0.08, 0.025, 0.14, 0.03);
    }
    k.color(C('#8e8a80')); k.box('metal', fx + 0.02, y0 + 0.06, (z0 + z1) / 2, 0.05, 0.05, z1 - z0);
    env.solid?.([[x0, z0], [x1 + 0.05, z0], [x1 + 0.05, z1], [x0, z1]], 2.0);
  }

  // ---------- 敷地: 地面・塀・生垣・門柱 ----------
  const F = flatMaterials(); void F;
  flat(k, env, 6.3, -3.0, 10.9, 5.3, 'fConcrete', C('#f1efe9'));                 // 駐車場
  flat(k, env, -10.9, 2.95, 6.3, 5.05, 'fGravel', C('#efebe2'), 0.025);            // 前庭の砂利
  flat(k, env, -10.9, 2.95, -4.2, 4.6, 'fGrass', C('#e6efd6'), 0.035);             // 芝
  flat(k, env, MAIN.x1 + 0.05, -5.2, 6.3, 2.9, 'fGravel', C('#e2ddd2'), 0.025);   // 右の脇の砂利
  // 飛び石（門から玄関、縁側へ）
  k.at(M);
  for (const [x, z, s] of [[2.6, 4.95, 0.5], [1.4, 4.55, 0.42], [0.4, 4.25, 0.46], [-0.7, 3.95, 0.4], [-1.8, 3.6, 0.44]]) {
    k.color(C('#9a958c').lerp(C('#7d7870'), r()));
    k.geo('concrete', new THREE.CylinderGeometry(s, s * 1.05, 0.08, 9).scale(1, 1, 0.8).rotateY(r() * 3), new THREE.Matrix4().setPosition(x, env.gy(x, z) + 0.04, z));
  }
  // 石灯籠
  {
    const x = -9.9, z = 4.0, y = env.gy(x, z);
    k.color(C('#8e8a80'));
    k.box('concrete', x, y + 0.08, z, 0.5, 0.16, 0.5);
    k.cyl('concrete', x, y + 0.16, z, 0.09, 0.55, 8);
    k.box('concrete', x, y + 0.76, z, 0.42, 0.1, 0.42);
    k.color(C('#6f6b62')); k.box('dark', x, y + 0.98, z, 0.3, 0.34, 0.3);
    k.color(C('#8e8a80'));
    k.geo('concrete', new THREE.ConeGeometry(0.4, 0.25, 4).rotateY(Math.PI / 4), new THREE.Matrix4().setPosition(x, y + 1.27, z));
    k.cyl('concrete', x, y + 1.39, z, 0.06, 0.12, 8);
  }
  // 物干し（前庭の左）
  {
    const z = 3.75, xa = -8.4, xb = -5.4, y = env.gy(-7, z);
    k.color(C('#c9ccce'));
    for (const x of [xa, xb]) { k.cyl('metal', x, y, z, 0.04, 1.75, 8); k.box('metal', x, y + 1.72, z, 0.05, 0.05, 0.5); }
    k.rod('metal', [xa, y + 1.72, z - 0.2], [xb, y + 1.72, z - 0.2], 0.03);
    k.rod('metal', [xa, y + 1.72, z + 0.2], [xb, y + 1.72, z + 0.2], 0.03);
    const cols = ['#f4f4f0', '#8fb8e0', '#f0c95a', '#f4f4f0', '#e87a6a'];
    cols.forEach((c, q) => {
      const x = xa + 0.35 + q * 0.58;
      k.color(C(c));
      k.geo('cloth', clothGeo(0.44, 0.62 - (q % 2) * 0.12, q, 0.04), new THREE.Matrix4().setPosition(x, y + 1.7, z - 0.2));
    });
    k.color(C('#2f5a9a')); k.geo('cloth', clothGeo(0.7, 0.45, 7, 0.035), new THREE.Matrix4().setPosition(xa + 0.95, y + 1.7, z + 0.2));
  }
  // 塀: 前は低いブロック＋生垣、門と駐車場の口はあける。横と裏はブロック塀
  const zf = 5.15;
  wallX(k, env, -10.95, 1.3, zf, 0.45);
  wallX(k, env, 3.9, 6.2, zf, 0.45);
  wallZ(k, env, -5.25, zf, -10.95, 0.95);
  wallX(k, env, -10.95, 10.95, -5.25, 1.0);
  wallZ(k, env, -5.25, -3.1, 10.95, 1.0);
  for (let x = -10.6; x < 1.2; x += 0.62) env.tree?.('shrub', x, zf - 0.02, 0.55 + ((x * 7.3) % 1 + 1) % 1 * 0.08, 0.9);
  for (let x = 4.25; x < 6.1; x += 0.62) env.tree?.('shrub', x, zf - 0.02, 0.58, 0.9);
  // 門柱（表札・ポスト・門灯）
  k.at(M);
  for (const x of [1.55, 3.65]) {
    const y = env.gy(x, zf);
    k.color(C('#e0d9c9')); k.box('mortar', x, y + 0.65, zf, 0.45, 1.3, 0.45);
    k.color(C('#8a8478')); k.box('concrete', x, y + 1.33, zf, 0.52, 0.06, 0.52);
  }
  {
    const y = env.gy(1.55, zf);
    k.color(C('#efe6cf')); k.box('trim', 1.55, y + 1.0, zf + 0.24, 0.3, 0.1, 0.02);
    k.color(C('#2a2320')); k.box('trim', 1.55, y + 1.0, zf + 0.252, 0.2, 0.035, 0.004);
    k.color(C('#6d7780')); k.box('metal', 1.55, y + 0.62, zf + 0.25, 0.32, 0.26, 0.06);
    // 門灯: 黒い笠と枠の、すりガラスの角灯
    k.color(C('#2a2826')); k.box('metal', 3.65, y + 1.38, zf, 0.16, 0.03, 0.16);
    k.color(C('#f4ecd4')); k.box('lamp', 3.65, y + 1.5, zf, 0.13, 0.2, 0.13);
    k.color(C('#2a2826')); for (const [dx, dz] of [[-0.065, -0.065], [0.065, -0.065], [-0.065, 0.065], [0.065, 0.065]]) k.box('metal', 3.65 + dx, y + 1.5, zf + dz, 0.02, 0.22, 0.02);
    k.geo('metal', new THREE.ConeGeometry(0.14, 0.08, 4).rotateY(Math.PI / 4), new THREE.Matrix4().setPosition(3.65, y + 1.65, zf));
  }
  // カーポート（アルミの柱と、半透明の屋根）
  {
    const y = env.gy(8.6, 0);
    k.color(C('#b7b3aa'));
    for (const z of [-2.6, 2.4]) { k.box('metal', 10.65, y + 1.2, z, 0.1, 2.4, 0.1); }
    k.box('metal', 10.65, y + 2.42, -0.1, 0.12, 0.14, 5.6);
    k.color(C('#9fb3bd'));
    k.box('glass', 8.55, y + 2.5, -0.1, 4.3, 0.03, 5.8);
    k.color(C('#b7b3aa'));
    for (const z of [-2.9, -0.1, 2.7]) k.box('metal', 8.55, y + 2.47, z, 4.3, 0.06, 0.06);
    env.fence?.(10.65, -2.6, 10.65, -2.6, 0.1);
    env.fence?.(10.65, 2.4, 10.65, 2.4, 0.1);
  }
  // 車（軽トラック）と自転車
  car(k, env.at(8.5, 0.4, 0), () => 0.1, 'kei');
  env.solid?.([[7.7, -1.4], [9.3, -1.4], [9.3, 2.2], [7.7, 2.2]], 1.6);
  bicycle(k, env.at(4.9, 4.4, Math.PI / 2 + 0.3), C('#c8423a'), r);
  env.fence?.(4.9, 3.9, 4.9, 4.9, 0.25);
  // 庭木
  env.tree?.('b-garden', -10.1, 3.7, 1.0);
  env.tree?.('b-garden', -0.5, 4.65, 0.7);
  env.tree?.('b-garden', 5.8, 4.5, 0.7);
  env.tree?.('shrub', -9.0, 3.3, 0.6);
  env.tree?.('shrub', -2.2, 4.5, 0.55);

  // ---------- 当たり ----------
  env.solid?.([[MAIN.x0, MAIN.z0], [MAIN.x1, MAIN.z0], [MAIN.x1, MAIN.z1], [MAIN.x0, MAIN.z1]], H + 2);
  env.solid?.([[WING.x0, WING.z0], [WING.x1, WING.z0], [WING.x1, WING.z1], [WING.x0, WING.z1]], H + 1);
  // 家の前（道側）の立ち位置: 門の外
  return { gate: [2.6, 6.0] };
}
