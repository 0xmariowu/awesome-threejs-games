// 定食屋「定食 みなと」: 2 階建ての店舗併用住宅（1 階が店、2 階が住まい）と、店の前・駐車場・袖看板
// 敷地のローカル座標: 原点 = 敷地の中心（y = 0 は店の基準の地面）、+z = 道の側、+x = 道から見て右
// 敷地は x: -11..11、z: -5.3..5.3（店は左、駐車場は右）
import * as THREE from 'three';
import { C, wallFrame, holeyWall, slider, kirizuma, canvasTex, needMat, groundPatch, woodGrain, clothGeo } from './build.js';
import { car, bicycle } from './props.js';
import { pottedPlant } from './plants.js';
import { flatMaterials } from '../lots.js';

const SHOP = { x0: -10.5, x1: 2.3, z0: -4.9, z1: 2.2 };
const FL = 0.15, F1 = 3.0, F2 = 2.7;
const Y2 = FL + F1, H = Y2 + F2;
const COL = {
  wood: C('#a88262'), woodDark: C('#3f2a1c'), mortar: C('#e9dfc9'), kawara: C('#a3a6aa'), trim: C('#3f2a1c'),
  soffit: C('#b59a78'), sash: C('#7e7a72'),
};
const MINCHO = '"Zen Old Mincho", "Yu Mincho", serif', GOTHIC = '"Zen Kaku Gothic New", "Yu Gothic", sans-serif';

// 看板・のれん・品書き・袖看板・ちょうちん
function shopMats(k) {
  const mat = (name, tex, o = {}) => needMat(k, name, () => new THREE.MeshStandardMaterial({ map: tex, roughness: 0.75, vertexColors: true, ...o }));
  mat('mnSign', canvasTex('mnSign', 1024, 200, (g, w, h) => {
    woodGrain(g, w, h, '#9a6b3f', '#5c3a20');
    g.strokeStyle = '#3f2616'; g.lineWidth = 12; g.strokeRect(6, 6, w - 12, h - 12);
    g.fillStyle = '#2a170c'; g.font = `900 132px ${MINCHO}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('定食　みなと', w / 2 + 40, h / 2 + 6);
    g.font = `700 26px ${MINCHO}`;
    ['創', '業', '昭', '和', '三', '十', '八', '年'].forEach((ch, i) => g.fillText(ch, 104 - (i >> 2) * 32, 44 + (i % 4) * 36));
  }, [`900 132px ${MINCHO}`, `700 26px ${MINCHO}`]), { roughness: 0.6 });
  mat('mnNoren', canvasTex('mnNoren', 768, 320, (g, w, h) => {
    g.fillStyle = '#1d2c55'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 3) { g.fillStyle = `rgba(255,255,255,${0.015 + (y % 9 ? 0 : 0.02)})`; g.fillRect(0, y, w, 1); }
    g.fillStyle = '#f3efe4'; g.font = `900 150px ${MINCHO}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    ['み', 'な', 'と'].forEach((ch, i) => g.fillText(ch, (i + 0.5) * w / 3, h * 0.58));
    // 波の紋
    g.strokeStyle = '#f3efe4'; g.lineWidth = 5;
    for (let i = 0; i < 3; i++) { g.beginPath(); g.arc((i + 0.5) * w / 3, 44, 20, Math.PI, 0); g.stroke(); }
    g.fillStyle = '#131d3a'; g.fillRect(0, 0, w, 16);
    for (const x of [w / 3, (2 * w) / 3]) g.clearRect(x - 3, 40, 6, h);
  }, [`900 150px ${MINCHO}`]), { side: THREE.DoubleSide, alphaTest: 0.5, roughness: 0.95 });
  mat('mnMenu', canvasTex('mnMenu', 320, 512, (g, w, h) => {
    g.fillStyle = '#26332c'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#8a6a44'; g.lineWidth = 18; g.strokeRect(0, 0, w, h);
    g.fillStyle = '#f4f1e6'; g.textAlign = 'center'; g.font = `900 40px ${GOTHIC}`;
    g.fillText('本日の定食', w / 2, 70);
    g.fillStyle = '#f2c14e'; g.fillRect(40, 88, w - 80, 3);
    const rows = [['アジフライ', '850'], ['煮魚', '950'], ['刺身', '1200'], ['さば味噌', '880'], ['日替わり', '780']];
    g.textAlign = 'left'; g.font = `700 30px ${GOTHIC}`;
    rows.forEach(([a, b], i) => {
      g.fillStyle = '#f4f1e6'; g.fillText(a, 34, 150 + i * 62);
      g.fillStyle = '#f7a8a0'; g.textAlign = 'right'; g.fillText(b, w - 34, 150 + i * 62); g.textAlign = 'left';
    });
    g.fillStyle = '#9fd8c8'; g.font = `700 24px ${GOTHIC}`; g.textAlign = 'center';
    g.fillText('ごはん大盛り無料', w / 2, h - 44);
  }, [`900 40px ${GOTHIC}`, `700 30px ${GOTHIC}`]));
  mat('mnPole', canvasTex('mnPole', 256, 640, (g, w, h) => {
    g.fillStyle = '#fbf8ef'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#b3261e'; g.fillRect(0, 0, w, 150);
    g.fillStyle = '#fff'; g.font = `900 92px ${MINCHO}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('定食', w / 2, 78);
    g.fillStyle = '#1f1a16'; g.font = `900 118px ${MINCHO}`;
    ['み', 'な', 'と'].forEach((ch, i) => g.fillText(ch, w / 2, 222 + i * 120));
    g.fillStyle = '#1d4f9a'; g.fillRect(0, h - 104, w, 104);
    g.fillStyle = '#fff'; g.font = `900 52px ${GOTHIC}`; g.fillText('P 駐車場', w / 2, h - 50);
  }, [`900 118px ${MINCHO}`, `900 52px ${GOTHIC}`]), { emissive: new THREE.Color('#ffffff'), emissiveIntensity: 0.12 });
  mat('mnLantern', canvasTex('mnLantern', 256, 256, (g, w, h) => {
    g.fillStyle = '#c72d22'; g.fillRect(0, 0, w, h);
    for (let y = 8; y < h; y += 16) { g.fillStyle = 'rgba(80,10,5,0.25)'; g.fillRect(0, y, w, 2); }
    g.fillStyle = '#1a0e0a'; g.font = `900 70px ${MINCHO}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('め', w * 0.25, h * 0.36); g.fillText('し', w * 0.25, h * 0.66);
    g.fillStyle = '#111'; g.fillRect(0, 0, w, 14); g.fillRect(0, h - 14, w, 14);
  }, [`900 70px ${MINCHO}`]), { emissive: new THREE.Color('#ff5a3a'), emissiveIntensity: 0.35, roughness: 0.6 });
  mat('mnOpen', canvasTex('mnOpen', 256, 96, (g, w, h) => {
    woodGrain(g, w, h, '#b88a55', '#6a4424');
    g.fillStyle = '#2a170c'; g.font = `900 60px ${MINCHO}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('営業中', w / 2, h / 2 + 3);
  }, [`900 60px ${MINCHO}`]));
  Object.assign(k.mats, flatMaterials(), { ...k.mats });
}

const flat = groundPatch;

// 絵を貼る四角（lot のローカル、向き = 外向きの法線 (nx, nz)）
function picture(k, mat, cx, cy, cz, w, h, nx, nz, col = C('#ffffff')) {
  const tx = nz, tz = -nx; // 右向き（外から見て）
  const P = (a, b) => [cx + tx * a, cy + b, cz + tz * a];
  k.color(col);
  k.face(mat, [P(-w / 2, -h / 2), P(w / 2, -h / 2), P(w / 2, h / 2), P(-w / 2, h / 2)], [[0, 0], [1, 0], [1, 1], [0, 1]]);
}

export function buildShokudo(k, env, r = Math.random) {
  shopMats(k);
  const M = env.M;
  env.chunk?.(0, 0);
  const sw = SHOP.x1 - SHOP.x0, sd = SHOP.z1 - SHOP.z0, scx = (SHOP.x0 + SHOP.x1) / 2, scz = (SHOP.z0 + SHOP.z1) / 2;
  k.at(M);
  const gmin = Math.min(env.gy(SHOP.x0, SHOP.z0), env.gy(SHOP.x1, SHOP.z0), env.gy(SHOP.x0, SHOP.z1), env.gy(SHOP.x1, SHOP.z1));
  k.color(C('#9e9a90'));
  k.box('concrete', scx, (gmin - 0.4 + FL) / 2, scz, sw + 0.06, FL - gmin + 0.4, sd + 0.06);

  // ---------- 1 階: 店の正面 ----------
  const front = wallFrame(M, SHOP.x0, SHOP.z1, SHOP.x1, SHOP.z1);
  const case0 = { x0: 0.6, x1: 2.9, y0: 0.8, y1: 2.0 };       // 食品サンプル
  const door = { x0: 3.4, x1: 5.6, y0: FL, y1: 2.3 };          // 入口
  const win = { x0: 6.2, x1: 10.5, y0: 0.95, y1: 2.15 };      // 格子窓
  {
    k.at(front.m);
    k.color(COL.wood); holeyWall(k, 'wood', front.L, FL, Y2, [case0, door, win], 0.18);
    // 腰の化粧（タイル風のモルタル）
    k.color(C('#8e857a'));
    for (const [a, b] of [[0, case0.x0], [case0.x1, door.x0], [door.x1, win.x0], [win.x1, front.L]]) k.box('concrete', (a + b) / 2, FL + 0.3, 0.02, b - a, 0.6, 0.04);
    k.box('concrete', (case0.x0 + case0.x1) / 2, (FL + case0.y0) / 2, 0.02, case0.x1 - case0.x0, case0.y0 - FL, 0.04);
    k.box('concrete', (win.x0 + win.x1) / 2, (FL + win.y0) / 2, 0.02, win.x1 - win.x0, win.y0 - FL, 0.04);
    // 柱
    k.color(COL.woodDark);
    for (const x of [0.07, case0.x0 - 0.06, case0.x1 + 0.06, door.x0 - 0.06, door.x1 + 0.06, win.x0 - 0.06, win.x1 + 0.06, front.L - 0.07]) k.box('trim', x, (FL + Y2) / 2, 0.03, 0.12, Y2 - FL, 0.08);
    k.box('trim', front.L / 2, 2.45, 0.03, front.L, 0.12, 0.08);
    // 食品サンプルのショーケース（奥に 2 段の棚、明るい背板）
    {
      const { x0, x1, y0, y1 } = case0, dz = 0.55;
      k.color(C('#fff8ea')); k.face('lamp', [[x0, y0, -dz], [x1, y0, -dz], [x1, y1, -dz], [x0, y1, -dz]]);
      k.color(C('#e8dcc8'));
      k.face('trim', [[x0, y0, 0], [x1, y0, 0], [x1, y0, -dz], [x0, y0, -dz]].reverse());
      k.box('trim', (x0 + x1) / 2, y0 + 0.55, -dz / 2 - 0.05, x1 - x0, 0.03, dz - 0.1);
      for (const [yy, zz] of [[y0 + 0.02, -0.28], [y0 + 0.58, -0.32]]) {
        for (let q = 0; q < 4; q++) {
          const cx = x0 + 0.3 + q * (x1 - x0 - 0.6) / 3;
          k.color(C('#5a3a22')); k.box('trim', cx, yy + 0.015, zz, 0.46, 0.03, 0.3);
          k.color(C('#f4f2ec')); k.cyl('plastic', cx - 0.14, yy + 0.03, zz + 0.07, 0.065, 0.07, 14, 0.075);
          k.color(C('#f8f6ef')); k.geo('plastic', new THREE.SphereGeometry(0.06, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.Matrix4().setPosition(cx - 0.14, yy + 0.1, zz + 0.07));
          k.color(C('#7a2a1e')); k.cyl('plastic', cx - 0.14, yy + 0.03, zz - 0.08, 0.055, 0.065, 12, 0.065);
          k.color(C('#b98a4a')); k.cyl('plastic', cx - 0.14, yy + 0.09, zz - 0.08, 0.052, 0.006, 12);
          k.color(C('#f4f2ec')); k.cyl('plastic', cx + 0.08, yy + 0.03, zz, 0.12, 0.02, 16, 0.13);
          const dish = q % 4;
          if (dish === 0) { k.color(C('#d99a3a')); for (const s of [-0.04, 0.04]) k.geo('plastic', new THREE.SphereGeometry(0.05, 10, 6).scale(1.6, 0.6, 0.9).rotateY(0.4), new THREE.Matrix4().setPosition(cx + 0.08 + s, yy + 0.07, zz + s * 0.5)); }
          else if (dish === 1) { k.color(C('#8a5a2a')); k.geo('plastic', new THREE.SphereGeometry(0.06, 10, 6).scale(1.8, 0.5, 0.8), new THREE.Matrix4().setPosition(cx + 0.08, yy + 0.07, zz)); }
          else if (dish === 2) { for (const [s, c] of [[-0.05, '#e05a50'], [0, '#f08a70'], [0.05, '#e8e0d8']]) { k.color(C(c)); k.box('plastic', cx + 0.08 + s, yy + 0.06, zz, 0.04, 0.03, 0.14); } }
          else { k.color(C('#6b7a3a')); k.geo('plastic', new THREE.SphereGeometry(0.06, 10, 6).scale(1.5, 0.55, 1), new THREE.Matrix4().setPosition(cx + 0.08, yy + 0.07, zz)); }
          k.color(C('#ffffff')); k.box('plastic', cx, yy + 0.04, zz + 0.17, 0.12, 0.05, 0.005);
        }
      }
      needMat(k, 'glassClear', () => new THREE.MeshPhysicalMaterial({ color: '#dfeef2', transparent: true, opacity: 0.16, roughness: 0.04, metalness: 0, envMapIntensity: 1.4, depthWrite: false }));
      k.color(C('#ffffff')); k.face('glassClear', [[x0 + 0.02, y0, -0.06], [x1 - 0.02, y0, -0.06], [x1 - 0.02, y1, -0.06], [x0 + 0.02, y1, -0.06]]);
      k.color(COL.sash);
      k.box('metal', (x0 + x1) / 2, y0 + 0.02, -0.06, x1 - x0, 0.04, 0.05);
      k.box('metal', (x0 + x1) / 2, y1 - 0.02, -0.06, x1 - x0, 0.04, 0.05);
    }
    // 入口: 木の格子の引き戸（上は透明ガラス、店の中は温かい色）
    {
      const { x0, x1, y0, y1 } = door, mid = (x0 + x1) / 2, d = 0.12;
      k.color(C('#a07850')); k.face('trim', [[x0, y0 + 0.001, 0], [x1, y0 + 0.001, 0], [x1, y0 + 0.001, -d - 0.05], [x0, y0 + 0.001, -d - 0.05]].reverse());
      for (const [a, b, z] of [[x0, mid + 0.03, -d - 0.03], [mid - 0.03, x1, -d + 0.02]]) {
        // ガラスの奥に店の中（暖かい灯り）が見える
        k.color(C('#f0e2c8')); k.face('windowShop', [[a + 0.06, y0 + 0.4, z], [b - 0.06, y0 + 0.4, z], [b - 0.06, y1 - 0.06, z], [a + 0.06, y1 - 0.06, z]], [[a + 0.06, 0.4], [b - 0.06, 0.4], [b - 0.06, y1 - 0.06 - y0], [a + 0.06, y1 - 0.06 - y0]]);
        k.color(C('#5a3c26'));
        for (const x of [a + 0.035, b - 0.035]) k.box('trim', x, (y0 + y1) / 2, z + 0.02, 0.07, y1 - y0, 0.05);
        k.box('trim', (a + b) / 2, y0 + 0.2, z + 0.02, b - a, 0.4, 0.05);
        k.box('trim', (a + b) / 2, y1 - 0.03, z + 0.02, b - a, 0.06, 0.05);
        for (let x = a + 0.15; x < b - 0.1; x += 0.11) k.box('trim', x, y0 + 1.05, z + 0.03, 0.022, 1.3, 0.022);
      }
      // 営業中の札
      k.color(C('#ffffff')); k.face('mnOpen', [[mid + 0.2, 1.5, -d + 0.08], [mid + 0.62, 1.5, -d + 0.08], [mid + 0.62, 1.66, -d + 0.08], [mid + 0.2, 1.66, -d + 0.08]], [[0, 0], [1, 0], [1, 1], [0, 1]]);
    }
    // 格子窓（中は明るい障子、半分に簾）
    {
      const { x0, x1, y0, y1 } = win;
      slider(k, x0, x1, y0, y1, 0.12, { frame: COL.sash, glass: C('#f0e2c8'), panes: 4, win: 'windowShop', floor: FL });
      k.color(C('#4a3222'));
      for (let x = x0 + 0.05; x < x1; x += 0.085) k.box('trim', x, (y0 + y1) / 2, 0.04, 0.03, y1 - y0 + 0.1, 0.035);
      k.box('trim', (x0 + x1) / 2, y1 + 0.05, 0.04, x1 - x0 + 0.08, 0.06, 0.07);
      k.box('trim', (x0 + x1) / 2, y0 - 0.05, 0.04, x1 - x0 + 0.08, 0.06, 0.07);
    }
  }
  // 1 階の横・裏（板張り）と 2 階（モルタル）
  const walls = [
    [SHOP.x1, SHOP.z1, SHOP.x1, SHOP.z0, 'right'],
    [SHOP.x1, SHOP.z0, SHOP.x0, SHOP.z0, 'back'],
    [SHOP.x0, SHOP.z0, SHOP.x0, SHOP.z1, 'left'],
    [SHOP.x0, SHOP.z1, SHOP.x1, SHOP.z1, 'front'],
  ];
  for (const [ax, az, bx, bz, side] of walls) {
    const { m, L } = wallFrame(M, ax, az, bx, bz);
    k.at(m);
    if (side !== 'front') {
      const holes1 = side === 'right' ? [{ x0: 4.9, x1: 5.75, y0: FL + 0.05, y1: FL + 2.05 }, { x0: 1.6, x1: 2.8, y0: 1.3, y1: 2.1 }] : side === 'back' ? [{ x0: 3.0, x1: 4.6, y0: 1.2, y1: 2.1 }] : [{ x0: 3.4, x1: 5.6, y0: 0.95, y1: 2.15 }];
      k.color(COL.wood); holeyWall(k, 'wood', L, FL, Y2, holes1, 0.16);
      if (side === 'right') {
        // 勝手口
        k.color(C('#8e9296')); k.box('paint', 5.33, FL + 1.03, -0.06, 0.82, 1.98, 0.04);
        k.color(C('#cfd6d8')); k.box('glass', 5.33, FL + 1.55, -0.03, 0.4, 0.6, 0.01);
        k.color(C('#555')); k.box('metal', 5.62, FL + 1.0, -0.02, 0.04, 0.16, 0.04);
        slider(k, 1.6, 2.8, 1.3, 2.1, 0.08, { frame: COL.sash, glass: C('#b9c2c4') });
        // 換気扇のフードと油の汚れ
        k.color(C('#b7bcbf')); k.box('metal', 3.4, 2.35, 0.2, 0.6, 0.45, 0.4);
        k.color(C('#2d2a26')); k.box('dark', 3.4, 2.13, 0.3, 0.52, 0.02, 0.3);
      }
      if (side === 'left') {
        // 横の窓（店の中の座敷が見える）と格子、電気のメーター・雨どい
        slider(k, 3.4, 5.6, 0.95, 2.15, 0.12, { frame: COL.sash, glass: C('#f0e2c8'), panes: 2, win: 'windowShop', floor: FL });
        k.color(C('#4a3222'));
        for (let x = 3.45; x < 5.6; x += 0.085) k.box('trim', x, 1.55, 0.04, 0.03, 1.3, 0.035);
        k.box('trim', 4.5, 2.2, 0.04, 2.28, 0.06, 0.07);
        k.box('trim', 4.5, 0.9, 0.04, 2.28, 0.06, 0.07);
        k.color(C('#e9e9e4')); k.box('plastic', 1.3, 1.7, 0.08, 0.3, 0.42, 0.14);
        k.color(C('#2a2a2a')); k.box('glass', 1.3, 1.78, 0.155, 0.18, 0.14, 0.01);
        k.color(C('#b7b9b6')); k.rod('metal', [1.3, 1.49, 0.08], [1.3, 0.2, 0.08], 0.03);
        k.color(C('#6f7478')); k.cyl('metal', 0.25, 0.15, 0.1, 0.045, H - 0.8, 8);
        // 植木鉢の列
        ['hosta', 'marigold', 'geranium'].forEach((kind, q) => pottedPlant(k, 3.8 + q * 0.62, FL - 0.15, 0.3, { kind, s: 0.95, seed: q + 7 }));
      }
      if (side === 'back') {
        slider(k, 3.0, 4.6, 1.2, 2.1, 0.08, { frame: COL.sash, glass: C('#c9d0d2'), bar: 0.2, win: 'glass' });
        // 厨房の換気扇（羽根の見えるフード）
        k.color(C('#c4c8ca')); k.box('metal', 6.5, 2.35, 0.14, 0.62, 0.55, 0.28);
        k.color(C('#8e9396')); for (let q = 0; q < 5; q++) k.box('metal', 6.5, 2.14 + q * 0.09, 0.285, 0.54, 0.02, 0.03);
        k.color(C('#2a2826')); k.box('dark', 6.5, 2.08, 0.14, 0.56, 0.02, 0.24);
        // ガス給湯器と配管
        k.color(C('#e9e9e4')); k.box('plastic', 8.4, 1.45, 0.12, 0.48, 0.62, 0.22);
        k.color(C('#6a6e70')); k.box('metal', 8.4, 1.72, 0.235, 0.3, 0.04, 0.01);
        k.color(C('#b7b9b6'));
        for (const x of [8.28, 8.4, 8.52]) k.rod('metal', [x, 1.14, 0.12], [x, 0.3, 0.12], 0.025);
        k.color(C('#d8d6cf')); k.box('plastic', 8.4, 0.72, 0.1, 0.5, 0.06, 0.08);
        // 2 階のエアコン室外機（壁の金具）と、白い配管の化粧カバー
        for (const x of [2.1, 10.5]) {
          k.color(C('#e8e8e2')); k.box('plastic', x, Y2 + 0.45, 0.2, 0.78, 0.55, 0.28);
          k.color(C('#3a3a3a')); k.geo('dark', new THREE.CylinderGeometry(0.2, 0.2, 0.01, 16).rotateX(Math.PI / 2), new THREE.Matrix4().setPosition(x - 0.08, Y2 + 0.45, 0.345));
          k.color(C('#9a9d9e')); k.box('metal', x, Y2 + 0.15, 0.2, 0.84, 0.04, 0.32);
          k.color(C('#efeee8')); k.box('plastic', x + 0.5, Y2 + 0.9, 0.05, 0.1, 1.1, 0.08);
        }
        // 軒どいと縦どい
        k.color(C('#6f7478'));
        const yE = H - 0.55 * 0.48;
        k.geo('metal', new THREE.CylinderGeometry(0.065, 0.065, L + 1.1, 8, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).rotateX(Math.PI), new THREE.Matrix4().setPosition(L / 2, yE - 0.12, 0.66));
        for (const x of [0.25, L - 0.25]) {
          k.cyl('metal', x, 0.15, 0.1, 0.045, yE - 0.4, 8);
          k.rod('metal', [x, yE - 0.28, 0.1], [x, yE - 0.14, 0.62], 0.08);
          k.box('metal', x, 0.12, 0.2, 0.12, 0.05, 0.25);
        }
        // 足もと: ポリバケツ・ビールケース・ホースの巻き取り
        k.color(C('#4a8a4a')); k.cyl('plastic', 5.4, FL - 0.15, 0.4, 0.26, 0.62, 14, 0.29);
        k.color(C('#3a6e3a')); k.cyl('plastic', 5.4, FL + 0.47, 0.4, 0.3, 0.05, 14);
        k.color(C('#2f5f9a')); k.cyl('plastic', 4.8, FL - 0.15, 0.35, 0.23, 0.55, 14, 0.25);
        for (let q = 0; q < 3; q++) { k.color(C(q % 2 ? '#e8b422' : '#2f6fb0')); k.box('plastic', 9.6, FL + 0.0 + q * 0.3, 0.35, 0.44, 0.29, 0.36); }
        k.color(C('#2a8a4a')); k.geo('plastic', new THREE.TorusGeometry(0.2, 0.05, 8, 18), new THREE.Matrix4().setPosition(7.6, 0.9, 0.08));
        k.color(C('#6a6e70')); k.box('metal', 7.6, 0.9, 0.03, 0.08, 0.08, 0.05);
      }
    }
    // 2 階
    const holes2 = side === 'front' ? [{ x0: 0.5, x1: 2.3, y0: Y2 + 0.8, y1: Y2 + 1.95 }, { x0: 10.5, x1: 12.3, y0: Y2 + 0.8, y1: Y2 + 1.95 }]
      : side === 'back' ? [{ x0: 1.2, x1: 3.0, y0: Y2 + 0.8, y1: Y2 + 1.95 }, { x0: 5.4, x1: 7.2, y0: Y2 + 0.8, y1: Y2 + 1.95 }, { x0: 9.6, x1: 11.4, y0: Y2 + 0.8, y1: Y2 + 1.95 }]
      : [{ x0: 2.6, x1: 4.3, y0: Y2 + 0.8, y1: Y2 + 1.95 }];
    k.color(COL.mortar); holeyWall(k, 'mortar', L, Y2, H, holes2, 0.16);
    for (const h of holes2) {
      slider(k, h.x0, h.x1, h.y0, h.y1, 0.08, { frame: COL.sash, glass: C('#3a4650') });
      // 手すり（面格子）
      k.color(C('#8a8680'));
      k.box('metal', (h.x0 + h.x1) / 2, h.y0 + 0.62, 0.12, h.x1 - h.x0 + 0.1, 0.035, 0.035);
      k.box('metal', (h.x0 + h.x1) / 2, h.y0 + 0.02, 0.12, h.x1 - h.x0 + 0.1, 0.035, 0.035);
      for (let x = h.x0; x <= h.x1 + 0.01; x += (h.x1 - h.x0) / 8) k.box('metal', x, h.y0 + 0.32, 0.12, 0.022, 0.62, 0.022);
      k.color(C('#6b675f')); k.box('trim', (h.x0 + h.x1) / 2, h.y1 + 0.16, 0.08, h.x1 - h.x0 + 0.1, 0.26, 0.16);
    }
    // 1 階と 2 階の間の帯・隅
    k.color(COL.trim);
    k.box('trim', L / 2, Y2, 0.03, L + 0.05, 0.14, 0.06);
    for (const x of [0.05, L - 0.05]) k.box('trim', x, (Y2 + H) / 2, 0.02, 0.1, H - Y2, 0.05);
    // 裏の物干し
    if (side === 'back') {
      k.color(C('#c9ccce')); k.rod('metal', [0.9, Y2 + 2.2, 0.55], [7.6, Y2 + 2.2, 0.55], 0.03);
      for (const x of [0.9, 7.6]) k.rod('metal', [x, Y2 + 2.25, 0], [x, Y2 + 2.2, 0.6], 0.03);
      ['#f4f4f0', '#f4f4f0', '#e8e4da', '#8fb8e0', '#f4f4f0'].forEach((c, q) => { k.color(C(c)); const x = 1.5 + q * 1.2; k.geo('cloth', clothGeo(0.6, 0.62, q + 3, 0.04), new THREE.Matrix4().setPosition(x, Y2 + 2.17, 0.55)); });
    }
  }

  // ---------- 1 階の庇（瓦）と、その上の木の看板 ----------
  k.at(M);
  {
    const z0 = SHOP.z1, z1 = SHOP.z1 + 1.25, yW = Y2 + 0.05, yE = Y2 - 0.42, x0 = SHOP.x0 - 0.1, x1 = SHOP.x1 + 0.1;
    const sl = Math.hypot(z1 - z0, yW - yE);
    k.color(COL.kawara); k.face('ibushi', [[x0, yE, z1], [x1, yE, z1], [x1, yW, z0], [x0, yW, z0]], [[x0, 0], [x1, 0], [x1, sl], [x0, sl]]);
    k.color(COL.soffit); k.face('trim', [[x0, yE - 0.1, z1], [x1, yE - 0.1, z1], [x1, yW - 0.1, z0], [x0, yW - 0.1, z0]].reverse());
    k.color(COL.trim); k.box('trim', (x0 + x1) / 2, yE - 0.08, z1 + 0.02, x1 - x0, 0.2, 0.05);
    k.color(C('#6f7478')); k.geo('metal', new THREE.CylinderGeometry(0.06, 0.06, x1 - x0, 8, 1, false, 0, Math.PI).rotateZ(Math.PI / 2), new THREE.Matrix4().setPosition((x0 + x1) / 2, yE - 0.2, z1 + 0.1));
    k.color(COL.kawara.clone().multiplyScalar(0.45)); k.box('ridge', (x0 + x1) / 2, yW + 0.06, z0 + 0.08, x1 - x0, 0.14, 0.2);
    // 腕木
    k.color(COL.woodDark);
    for (const x of [x0 + 0.5, (x0 + x1) / 2 - 1.2, x1 - 0.5]) k.rod('trim', [x, yW - 0.7, z0 + 0.02], [x, yE - 0.12, z1 - 0.1], 0.1);
    // 看板（庇の上、2 階の壁に）
    const sx = -4.2, sy = Y2 + 0.72, sz = SHOP.z1 + 0.14;
    k.color(C('#3a2415')); k.box('trim', sx, sy, sz - 0.05, 6.9, 1.34, 0.12);
    picture(k, 'mnSign', sx, sy, sz + 0.012, 6.6, 1.22, 0, 1);
    k.color(C('#2a2320')); for (const dx of [-3.0, 3.0]) k.box('metal', sx + dx, sy + 0.72, sz, 0.04, 0.1, 0.18);
    // 看板を照らすスポット
    for (const dx of [-2.2, 0, 2.2]) {
      k.color(C('#2c2c2c'));
      k.rod('metal', [sx + dx, sy + 0.66, sz - 0.02], [sx + dx, sy + 0.92, sz - 0.02], 0.03);
      k.rod('metal', [sx + dx, sy + 0.92, sz - 0.02], [sx + dx, sy + 0.92, sz + 0.42], 0.03);
      k.box('metal', sx + dx, sy + 0.88, sz + 0.46, 0.16, 0.1, 0.16);
      k.color(C('#f6efd8')); k.box('lamp', sx + dx, sy + 0.825, sz + 0.46, 0.12, 0.02, 0.12);
    }
  }
  // のれん（入口の外）と竿
  {
    const xa = SHOP.x0 + door.x0 + 0.05, xb = SHOP.x0 + door.x1 - 0.05, z = SHOP.z1 + 0.22;
    k.color(C('#6a4e34')); k.rod('trim', [xa - 0.15, 2.45, z], [xb + 0.15, 2.45, z], 0.04);
    // のれん: 布のしわ（上端は竿に留める）
    k.color(C('#ffffff')); k.geo('mnNoren', clothGeo(xb - xa, 0.98, 2, 0.03), new THREE.Matrix4().setPosition((xa + xb) / 2, 2.43, z));
  }
  // 赤ちょうちん
  for (const x of [SHOP.x0 + door.x0 - 0.45, SHOP.x0 + door.x1 + 0.45]) {
    const z = SHOP.z1 + 0.75;
    const lathe = new THREE.LatheGeometry(Array.from({ length: 9 }, (_, i) => { const t = i / 8; return new THREE.Vector2(0.03 + Math.sin(t * Math.PI) * 0.2, t * 0.62); }), 18);
    k.color(C('#ffffff')); k.geo('mnLantern', lathe, new THREE.Matrix4().makeRotationY(Math.PI / 2).setPosition(x, 1.95, z));
    k.color(C('#141414')); k.cyl('dark', x, 1.93, z, 0.1, 0.04, 12); k.cyl('dark', x, 2.55, z, 0.08, 0.04, 12);
    k.rod('dark', [x, 2.6, z], [x, Y2 - 0.35, z], 0.015);
  }

  // ---------- 屋根（切妻、棟は道と平行） ----------
  {
    const R = M.clone().multiply(new THREE.Matrix4().makeRotationY(Math.PI / 2).setPosition(scx, 0, scz));
    k.at(R);
    kirizuma(k, { cx: 0, w: sd, z0: -sw / 2, z1: sw / 2, H, over: 0.55, p: 0.48, col: COL.kawara, tile: 'ibushi', trim: COL.trim, soffit: COL.soffit, gable: COL.mortar, front: true, back: true });
    // 物干し台に使うテレビアンテナ
    k.at(M);
    k.color(C('#b8bcc0'));
    const ax = SHOP.x0 + 2.2, ay = H + (sd / 2 + 0.55) * 0.48 - 0.3;
    k.rod('metal', [ax, ay, scz], [ax, ay + 2.2, scz], 0.04);
    for (let q = 0; q < 6; q++) k.rod('metal', [ax - 0.35, ay + 2.0, scz - 0.4 + q * 0.16], [ax + 0.35, ay + 2.0, scz - 0.4 + q * 0.16], 0.015);
  }

  // ---------- 店の横（駐車場の側）の小物 ----------
  k.at(M);
  {
    const x = SHOP.x1 + 0.35;
    // ビールケースの山
    for (let q = 0; q < 5; q++) {
      const [dx, dz, dy] = [[0, 0, 0], [0, 0, 1], [0, 0.45, 0], [0, 0.45, 1], [0, 0, 2]][q];
      k.color(C(q % 2 ? '#e8b422' : '#c7342b'));
      k.box('plastic', x + 0.05 + dx, 0.16 + dy * 0.31, -2.3 + dz, 0.36, 0.3, 0.44);
    }
    k.color(C('#3b6fb0')); k.cyl('plastic', x + 0.05, 0, -3.0, 0.24, 0.62, 14, 0.27);
    for (const z of [-4.1, -4.5]) { k.color(C('#b9bec2')); k.cyl('metal', x + 0.05, 0.02, z, 0.19, 1.2, 14); k.color(C('#8f959a')); k.cyl('metal', x + 0.05, 1.22, z, 0.07, 0.12, 10); }
    // 業務用の室外機
    k.color(C('#e6e6e0')); k.box('plastic', x + 0.3, 0.55, -0.6, 0.55, 1.1, 0.95);
    k.color(C('#3a3a3a')); k.geo('dark', new THREE.CylinderGeometry(0.3, 0.3, 0.01, 18).rotateZ(Math.PI / 2), new THREE.Matrix4().setPosition(x + 0.58, 0.62, -0.6));
    env.solid?.([[SHOP.x1, -4.8], [SHOP.x1 + 0.7, -4.8], [SHOP.x1 + 0.7, -0.05], [SHOP.x1, -0.05]], 1.4);
  }

  // ---------- 地面: 店の前・駐車場 ----------
  flat(k, env, SHOP.x0 - 0.3, SHOP.z1, SHOP.x1 + 0.3, 5.3, 'fConcrete', C('#eeebe4'));
  flat(k, env, SHOP.x1 + 0.3, -5.0, 10.9, 5.3, 'fConcrete', C('#c9c6c0'), 0.028);
  k.at(M);
  // 駐車の白線と車止め
  for (let q = 0; q <= 3; q++) { const x = 3.1 + q * 2.6; groundPatch(k, env, x - 0.06, -0.2, x + 0.06, 5.0, 'paint', C('#f4f4f0'), 0.045); }
  groundPatch(k, env, 3.05, -0.26, 10.95, -0.14, 'paint', C('#f4f4f0'), 0.045);
  k.at(M);
  k.color(C('#b9b5ab'));
  for (let q = 0; q < 3; q++) { const x = 4.4 + q * 2.6; k.box('concrete', x, env.gy(x, 0.35) + 0.08, 0.35, 1.4, 0.13, 0.16); }
  // 車（2 台）
  car(k, env.at(4.4, 2.4, 0), () => 0.55, 'compact');
  env.solid?.([[3.5, 0.2], [5.3, 0.2], [5.3, 4.6], [3.5, 4.6]], 1.6);
  car(k, env.at(9.6, 2.5, 0), () => 0.3, 'truck');
  env.solid?.([[8.7, 0.1], [10.5, 0.1], [10.5, 4.9], [8.7, 4.9]], 1.9);
  k.at(M); // 車は自分の行列で描くので戻す
  // 袖看板（ポール）
  {
    const x = 10.55, z = 5.0, y = env.gy(x, z);
    k.color(C('#9aa0a4')); k.cyl('metal', x, y, z, 0.09, 5.0, 12);
    k.color(C('#f0efe8')); k.box('paint', x, y + 4.6, z, 1.06, 2.66, 0.28);
    picture(k, 'mnPole', x, y + 4.6, z + 0.145, 1.0, 2.5, 0, 1);
    picture(k, 'mnPole', x, y + 4.6, z - 0.145, 1.0, 2.5, 0, -1);
    k.color(C('#9aa0a4')); k.box('metal', x, y + 6.0, z, 1.12, 0.12, 0.34);
    env.fence?.(x, z, x, z, 0.12);
  }
  // 店の前: 置き看板・縁台・植木鉢・自転車・自販機
  {
    const bx = SHOP.x0 + door.x0 - 1.0, bz = SHOP.z1 + 1.6, y = env.gy(bx, bz);
    k.color(C('#6a4a2e'));
    for (const s of [-1, 1]) {
      const a = [bx - 0.3, y, bz + s * 0.25], b = [bx + 0.3, y, bz + s * 0.25];
      k.rod('trim', a, [bx - 0.3, y + 0.95, bz + s * 0.03], 0.04); k.rod('trim', b, [bx + 0.3, y + 0.95, bz + s * 0.03], 0.04);
    }
    const tilt = 0.22;
    for (const s of [-1, 1]) {
      const zc = bz + s * 0.14, P = (a, h) => [bx + a, y + 0.1 + h * Math.cos(tilt), zc + s * (0.12 - h * Math.sin(tilt))];
      const q = [P(-0.28, 0), P(0.28, 0), P(0.28, 0.82), P(-0.28, 0.82)];
      k.color(C('#ffffff')); k.face('mnMenu', s > 0 ? q : [q[1], q[0], q[3], q[2]], s > 0 ? [[0, 0], [1, 0], [1, 1], [0, 1]] : [[1, 0], [0, 0], [0, 1], [1, 1]]);
    }
    env.fence?.(bx - 0.3, bz, bx + 0.3, bz, 0.3);
  }
  {
    const x = SHOP.x0 + win.x0 + 0.9, z = SHOP.z1 + 0.75, y = env.gy(x, z);
    k.color(C('#b88a5a')); k.box('wood', x + 0.6, y + 0.42, z, 1.8, 0.06, 0.45);
    k.color(C('#7a5a3a')); for (const dx of [-0.2, 1.4]) k.box('trim', x + dx, y + 0.2, z, 0.06, 0.4, 0.4);
    k.color(C('#c9ccce')); k.cyl('metal', x + 2.1, y, z - 0.1, 0.12, 0.7, 12); k.color(C('#8a8e92')); k.cyl('metal', x + 2.1, y + 0.7, z - 0.1, 0.16, 0.05, 12);
    env.fence?.(x - 0.3, z, x + 1.5, z, 0.25);
  }
  ['azalea', 'geranium', 'marigold', 'spider', 'geranium', 'hosta'].forEach((kind, q) => {
    const x = SHOP.x0 + case0.x0 + 0.12 + q * 0.42, z = SHOP.z1 + 0.3 + (q % 2) * 0.06, y = env.gy(x, z);
    pottedPlant(k, x, y, z, { kind, s: kind === 'azalea' ? 0.95 : 0.85, seed: q + 2, pot: q === 3 ? 'blue' : 'clay' });
  });
  k.at(env.M);
  // 自転車は壁ぞいに横向きで停める（前カゴが壁に当たらないよう、ハンドルの幅ぶん離す）
  bicycle(k, env.at(SHOP.x1 - 1.05, SHOP.z1 + 0.62, -0.06), C('#2f5a9a'), r);
  env.fence?.(SHOP.x1 - 1.95, SHOP.z1 + 0.62, SHOP.x1 - 0.15, SHOP.z1 + 0.62, 0.35);
  env.vend?.(SHOP.x1 + 0.75, SHOP.z1 + 0.4, 0, 7, 1);

  env.solid?.([[SHOP.x0, SHOP.z0], [SHOP.x1, SHOP.z0], [SHOP.x1, SHOP.z1], [SHOP.x0, SHOP.z1]], H + 3);
  return { door: [SHOP.x0 + (door.x0 + door.x1) / 2, SHOP.z1 + 2.5] };
}
