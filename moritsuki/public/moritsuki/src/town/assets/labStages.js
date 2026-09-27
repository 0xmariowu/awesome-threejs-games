// 水産研究所の成長段階（クエストをこなすと大きくなる）。level 1〜10 = 本館の階数
//  1   : 浜の平屋の分室（サイディングと折板の切妻屋根、屋外の丸い FRP 水槽、軽トラ、木の看板）
//  2〜3: 鉄筋コンクリートの本館（連窓と霧除けの庇、屋上の高架水槽・塔屋）＋ 旧館（最初の平屋）と水槽の上屋
//  4〜5: タイル張りの本館（彫りの深い窓、風除室、冷却塔、5 は階段室のガラスのスリット）
//  6〜10: カーテンウォールの本館 ＋ 白い格子の実験棟、渡り廊下、整った前庭。10 は屋上の王冠とガラスのエントランスホール
// ローカル座標は lab.js と同じ: 原点 = 敷地の前面の中心（y = 0 は地面）、+z = 正面（前庭の側）。敷地は x: -41..41、z: -17..16
// env は buildLab と同じ（M・gy・at・tree、ゲームでは chunk・fence・solid・pave も）
import * as THREE from 'three';
import { C, wallFrame, holeyWall, slider, canvasTex, needMat, groundPatch, woodGrain } from './build.js';
import { flatMaterials } from '../lots.js';
import { car, bicycle } from './props.js';

const GOTHIC = '"Zen Kaku Gothic New", "Yu Gothic", sans-serif', MINCHO = '"Zen Old Mincho", "Yu Mincho", serif';
const BASE = 0.15; // 床の高さ（基礎の上端）

// ---------- 段階ごとの仕様 ----------
const HUT = { x0: 12, x1: 30, z0: -10, z1: 0 };
export const LAB_STAGES = {
  1: { hut: true, tanks: 2, rect: true },
  2: { main: { b: { x0: -24, x1: -4, z0: -11, z1: 0 }, fh: 3.3, facade: 'band' }, hut: true, tanks: 4, rect: true },
  3: { main: { b: { x0: -28, x1: -4, z0: -12, z1: 0 }, fh: 3.3, facade: 'band' }, hut: true, tanks: 6, shed: true, rect: true },
  4: { main: { b: { x0: -32, x1: -3, z0: -13, z1: 0 }, fh: 3.6, facade: 'tile' }, hut: true, tanks: 6, shed: true, rect: true },
  5: { main: { b: { x0: -35, x1: -2, z0: -14, z1: 0 }, fh: 3.6, facade: 'tile', stair: true }, hut: true, tanks: 6, shed: true, rect: true },
  6: { main: { b: { x0: -38, x1: -2, z0: -16, z1: 0 }, fh: 3.9, facade: 'curtain' }, annex: { b: { x0: 12, x1: 34, z0: -15, z1: 0 }, floors: 3 }, tanks: 3 },
  7: { main: { b: { x0: -41, x1: -1, z0: -17, z1: 0 }, fh: 3.9, facade: 'curtain' }, annex: { b: { x0: 9, x1: 35, z0: -17, z1: 0 }, floors: 4 }, tanks: 3, bridges: [2] },
  8: { main: { b: { x0: -41, x1: -1, z0: -17, z1: 0 }, fh: 3.9, facade: 'curtain' }, annex: { b: { x0: 9, x1: 41, z0: -17, z1: 0 }, floors: 6 }, bridges: [2] },
  9: { main: { b: { x0: -41, x1: -1, z0: -17, z1: 0 }, fh: 3.9, facade: 'curtain' }, annex: { b: { x0: 9, x1: 41, z0: -17, z1: 0 }, floors: 8 }, bridges: [2] },
  10: { main: { b: { x0: -41, x1: -1, z0: -17, z1: 0 }, fh: 3.9, facade: 'curtain' }, annex: { b: { x0: 9, x1: 41, z0: -17, z1: 0 }, floors: 8 }, bridges: [2, 6], crown: true, hall: true },
};

// ---------- マテリアル（看板の文字・タイル） ----------
function stageMats(k) {
  needMat(k, 'lsLetters', () => new THREE.MeshStandardMaterial({
    map: canvasTex('lsLetters', 2048, 256, (g, w, h) => {
      g.clearRect(0, 0, w, h);
      g.fillStyle = '#1d3a63'; g.font = `900 170px ${GOTHIC}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('吉山水産研究所', w / 2 + 110, h / 2 + 8);
      g.strokeStyle = '#1d6fa8'; g.lineWidth = 16;
      g.beginPath(); g.arc(250, h / 2, 96, 0, Math.PI * 2); g.stroke();
      g.fillStyle = '#1d6fa8';
      g.beginPath(); g.moveTo(180, h / 2 + 10); g.quadraticCurveTo(250, h / 2 - 60, 320, h / 2 + 10); g.lineTo(340, h / 2 - 20); g.lineTo(340, h / 2 + 40); g.lineTo(320, h / 2 + 10); g.quadraticCurveTo(250, h / 2 + 60, 180, h / 2 + 10); g.fill();
      g.fillStyle = '#fff'; g.beginPath(); g.arc(215, h / 2 + 2, 8, 0, Math.PI * 2); g.fill();
    }, [`900 170px ${GOTHIC}`]),
    alphaTest: 0.5, roughness: 0.35, metalness: 0.3, vertexColors: true,
  }));
  needMat(k, 'lsPlate', () => new THREE.MeshStandardMaterial({
    map: canvasTex('lsPlate', 1024, 384, (g, w, h) => {
      g.fillStyle = '#2b2d2f'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 3000; i++) { g.fillStyle = `rgba(255,255,255,${((i * 7919) % 100) / 2000})`; g.fillRect((i * 104729) % w, (i * 7351) % h, 2, 2); }
      g.fillStyle = '#e8e2d2'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = `900 120px ${MINCHO}`; g.fillText('吉山水産研究所', w / 2, h * 0.42);
      g.font = `700 38px ${GOTHIC}`; g.fillText('YOSHIYAMA FISHERIES RESEARCH INSTITUTE', w / 2, h * 0.78);
    }, [`900 120px ${MINCHO}`, `700 38px ${GOTHIC}`]),
    roughness: 0.4, metalness: 0.2, vertexColors: true,
  }));
  // 門柱の銘板（ステンレスのへアライン）
  needMat(k, 'lsGatePlate', () => new THREE.MeshStandardMaterial({
    map: canvasTex('lsGatePlate', 256, 1024, (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, '#b9bdbf'); gr.addColorStop(0.5, '#e2e5e6'); gr.addColorStop(1, '#aeb2b4');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 2) { g.fillStyle = `rgba(0,0,0,${0.02 + 0.02 * Math.sin(y * 1.7)})`; g.fillRect(0, y, w, 1); }
      g.fillStyle = '#23272a'; g.font = `900 118px ${MINCHO}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      [...'吉山水産研究所'].forEach((ch, i) => g.fillText(ch, w / 2, 90 + i * 136));
    }, [`900 118px ${MINCHO}`]),
    roughness: 0.3, metalness: 0.7, vertexColors: true,
  }));
  // 最初の分室の木の看板（縦書き、墨の文字）
  needMat(k, 'lsWoodSign', () => new THREE.MeshStandardMaterial({
    map: canvasTex('lsWoodSign', 192, 1024, (g, w, h) => {
      woodGrain(g, w, h, '#b08658', '#6a4526');
      g.strokeStyle = '#4a2e18'; g.lineWidth = 8; g.strokeRect(4, 4, w - 8, h - 8);
      g.fillStyle = '#1b120a'; g.font = `900 104px ${MINCHO}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      [...'吉山水産研究所'].forEach((ch, i) => g.fillText(ch, w / 2, 86 + i * 128));
      g.font = `700 30px ${MINCHO}`; g.fillText('浜分室', w / 2, h - 34);
    }, [`900 104px ${MINCHO}`, `700 30px ${MINCHO}`]),
    roughness: 0.8, vertexColors: true,
  }));
  // 二丁掛けタイル（1.2 m 四方で繰り返す。色むらのある茶色）
  needMat(k, 'lsTile', () => {
    const t = canvasTex('lsTile', 512, 512, (g, w, h) => {
      g.fillStyle = '#7d6a58'; g.fillRect(0, 0, w, h);
      const cols = 5, rows = 16, tw = w / cols, th = h / rows;
      for (let j = 0; j < rows; j++) for (let i = -1; i < cols; i++) {
        const x = i * tw + (j % 2) * tw * 0.5, s = Math.sin(i * 12.9898 + j * 78.233) * 43758.5453, rr = s - Math.floor(s);
        const l = 0.84 + rr * 0.2;
        g.fillStyle = `rgb(${(188 * l) | 0},${(146 * l) | 0},${(108 * l) | 0})`;
        g.fillRect(x + 2.5, j * th + 2.5, tw - 5, th - 5);
        // 釉薬のむら
        g.fillStyle = `rgba(60,35,15,${0.06 + rr * 0.08})`; g.fillRect(x + 2.5, j * th + th * 0.55, tw - 5, th * 0.45 - 2.5);
        g.fillStyle = 'rgba(255,240,220,0.08)'; g.fillRect(x + 2.5, j * th + 2.5, tw - 5, 2);
      }
    });
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1 / 1.2, 1 / 1.2);
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.55, vertexColors: true });
  });
  needMat(k, 'glassClear', () => new THREE.MeshPhysicalMaterial({ color: '#dfeef2', transparent: true, opacity: 0.16, roughness: 0.04, metalness: 0, envMapIntensity: 1.4, depthWrite: false }));
  needMat(k, 'water', () => new THREE.MeshStandardMaterial({ color: '#ffffff', vertexColors: true, roughness: 0.04, metalness: 0.1, envMapIntensity: 1.3 }));
  Object.assign(k.mats, flatMaterials(), { ...k.mats });
}

const SIDES = (b) => [[b.x0, b.z1, b.x1, b.z1, 'front'], [b.x1, b.z1, b.x1, b.z0, 'right'], [b.x1, b.z0, b.x0, b.z0, 'back'], [b.x0, b.z0, b.x0, b.z1, 'left']];
const up = (M, y) => M.clone().multiply(new THREE.Matrix4().makeTranslation(0, y, 0));

// 奥の見えるガラス戸（壁の座標系、開口 a..b・高さ 0..y1、壁面から d 奥）
function glassDoor(k, a, b, y1, d, frame = C('#a9aeb0')) {
  k.color(C('#7d8a90'));
  k.face('windowLobby', [[a, 0.02, -d], [b, 0.02, -d], [b, y1, -d], [a, y1, -d]], [[a, 0.02], [b, 0.02], [b, y1], [a, y1]]);
  k.color(frame);
  const m = (a + b) / 2, dh = Math.min(2.3, y1 - 0.1);
  for (const x of [a + 0.04, b - 0.04]) k.box('metal', x, y1 / 2, -d + 0.03, 0.08, y1, 0.08);
  k.box('metal', m, y1 - 0.04, -d + 0.03, b - a, 0.08, 0.08);
  if (y1 - dh > 0.25) k.box('metal', m, dh, -d + 0.03, b - a, 0.08, 0.08);
  // 両開きの框と取っ手
  for (const x of [m - 0.02, m + 0.02]) k.box('metal', x, dh / 2, -d + 0.05, 0.05, dh, 0.05);
  for (const s of [-1, 1]) k.box('metal', m + s * 0.18, 1.0, -d + 0.1, 0.03, 0.7, 0.03);
}

// ---------- 外壁: 最初の平屋（サイディング） ----------
function sidingWall(k, m, L, H, side) {
  k.at(m);
  const holes = [], wins = [];
  const win = (cx, w = 1.7, y0 = 0.85, y1 = 2.05) => { const h = { x0: cx - w / 2, x1: cx + w / 2, y0, y1 }; holes.push(h); wins.push(h); };
  let door = null;
  if (side === 'front') {
    door = { x0: 3.2, x1: 4.9, y0: 0, y1: 2.15 };
    holes.push(door);
    for (const cx of [1.5, 7.4, 10.2, 13.0, 15.8]) win(cx);
  } else if (side === 'back') {
    for (const cx of [2.2, 5.0, 9.5, 12.3, 16.0]) win(cx, cx === 9.5 ? 0.8 : 1.7, cx === 9.5 ? 1.4 : 0.85);
  } else if (side === 'right') {
    door = { x0: L - 3.0, x1: L - 2.1, y0: 0, y1: 2.0 };
    holes.push(door);
    win(3, 1.7);
  } else {
    win(L / 2, 1.2, 1.3, 2.05);
  }
  k.color(C('#e6e3da'));
  holeyWall(k, 'siding', L, 0, H, holes, 0.12);
  for (const h of wins) {
    slider(k, h.x0, h.x1, h.y0, h.y1, 0.07, { frame: C('#aeb0ad'), glass: C('#2c3a42'), win: 'windowOffice', floor: 0 });
    // 水切りと面格子（裏の小窓）
    k.color(C('#b7b9b6')); k.box('metal', (h.x0 + h.x1) / 2, h.y0 - 0.02, 0.03, h.x1 - h.x0 + 0.08, 0.03, 0.08);
    if (h.x1 - h.x0 < 1) for (let x = h.x0 + 0.1; x < h.x1; x += 0.12) k.box('metal', x, (h.y0 + h.y1) / 2, 0.06, 0.02, h.y1 - h.y0, 0.02);
  }
  if (door) {
    if (side === 'front') glassDoor(k, door.x0, door.x1, door.y1, 0.1, C('#b3b6b4'));
    else { k.color(C('#8f9aa0')); k.box('paint', (door.x0 + door.x1) / 2, door.y1 / 2, -0.06, door.x1 - door.x0, door.y1, 0.04); k.color(C('#d6d8d6')); k.box('metal', door.x1 - 0.12, 1.0, -0.02, 0.03, 0.12, 0.06); }
  }
  // 隅の役物と土台の水切り
  k.color(C('#cfccc2'));
  for (const x of [0.04, L - 0.04]) k.box('trim', x, H / 2, 0.02, 0.1, H, 0.06);
  k.color(C('#9a9d9c')); k.box('metal', L / 2, 0.02, 0.03, L, 0.05, 0.07);
}

// 平屋の本体（基礎・壁・折板の切妻屋根・玄関の庇・室外機・看板）
function hut(k, env, b) {
  const M = env.M, fl = 0.45, H = 3.0;
  const w = b.x1 - b.x0, d = b.z1 - b.z0, cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2;
  k.at(M);
  k.color(C('#aaa79e')); k.box('concrete', cx, (fl - 1) / 2, cz, w + 0.1, fl + 1, d + 0.1);
  for (const [ax, az, bx, bz, side] of SIDES(b)) {
    const { m, L } = wallFrame(M, ax, az, bx, bz, fl);
    sidingWall(k, m, L, H, side);
  }
  k.at(M);
  // 折板の切妻屋根（棟は x 方向、軒は前後）
  const ov = 0.5, p = 0.28, W = w / 2 + 0.35, D = d / 2 + ov, Ht = fl + H, yE = Ht - ov * p, yR = Ht + (d / 2) * p, T = 0.1;
  const P = (x, y, z) => [cx + x, y, cz + z];
  const sl = Math.hypot(D, yR - yE), rc = C('#5f7f90');
  for (const s of [1, -1]) {
    const pts = s > 0 ? [[-W, yE, D], [W, yE, D], [W, yR, 0], [-W, yR, 0]] : [[W, yE, -D], [-W, yE, -D], [-W, yR, 0], [W, yR, 0]];
    k.color(rc); k.face('metalRoof', pts.map((q) => P(...q)), s > 0 ? [[-W, 0], [W, 0], [W, sl], [-W, sl]] : [[W, 0], [-W, 0], [-W, sl], [W, sl]]);
    k.color(C('#d4d2c8')); k.face('trim', pts.map((q) => P(q[0], q[1] - T, q[2])).reverse());
    // 鼻隠しと軒樋
    k.color(C('#e2e0d8')); k.box('trim', ...P(0, yE - 0.1, s * (D + 0.02)), 2 * W + 0.04, 0.2, 0.04);
    k.color(C('#8e9392'));
    k.geo('metal', new THREE.CylinderGeometry(0.06, 0.06, 2 * W, 8, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).rotateX(s > 0 ? 0 : Math.PI), new THREE.Matrix4().setPosition(...P(0, yE - 0.16, s * (D + 0.09))));
    for (const sx of [-1, 1]) k.cyl('metal', ...P(sx * (W - 0.2), 0, s * (D + 0.12)), 0.04, yE - 0.2, 8);
  }
  // 妻壁と破風、棟包み
  for (const s of [1, -1]) {
    const x = s * (w / 2);
    const tri = s > 0 ? [[x, Ht, d / 2], [x, Ht, -d / 2], [x, yR - 0.05, 0]] : [[x, Ht, -d / 2], [x, Ht, d / 2], [x, yR - 0.05, 0]];
    k.color(C('#e6e3da')); k.face('siding', tri.map((q) => P(...q)), tri.map((q) => [q[2], q[1]]));
    k.color(C('#e2e0d8'));
    for (const sz of [1, -1]) k.rod('trim', P(s * (W + 0.02), yE - 0.06, sz * (D + 0.02)), P(s * (W + 0.02), yR - 0.04, 0), 0.2);
    // 妻の換気口
    k.color(C('#b9bbb8')); k.box('metal', ...P(x + s * 0.03, Ht + (yR - Ht) * 0.45, 0), 0.05, 0.35, 0.5);
  }
  k.color(rc.clone().multiplyScalar(0.8));
  for (const s of [1, -1]) k.face('metal', [P(-W, yR - 0.02, s * 0.3), P(W, yR - 0.02, s * 0.3), P(W, yR + 0.07, 0), P(-W, yR + 0.07, 0)].map((q, i, a) => (s > 0 ? q : a[[1, 0, 3, 2][i]])));
  // 玄関の庇（アルミの薄い庇）と照明
  const dx = b.x0 + 4.05;
  k.color(C('#c9ccca')); k.box('metal', dx, fl + 2.55, b.z1 + 0.55, 2.6, 0.08, 1.1);
  k.color(C('#fff6e0')); k.box('lamp', dx + 1.1, fl + 2.3, b.z1 + 0.08, 0.16, 0.22, 0.12);
  // 玄関の土間コンクリートと踏み段
  k.color(C('#bdb9b0')); k.box('concrete', dx, fl / 2, b.z1 + 0.8, 2.6, fl, 1.6);
  k.box('concrete', dx, fl / 4, b.z1 + 1.8, 2.6, fl / 2, 0.45);
  env.fence?.(dx - 1.3, b.z1 + 1.8, dx + 1.3, b.z1 + 1.8, 0.4);
  // 木の看板（玄関の左の壁に掛ける）
  k.color(C('#ffffff'));
  const sx = b.x0 + 2.78, sz = b.z1 + 0.035;
  k.face('lsWoodSign', [[sx - 0.2, fl + 0.55, sz], [sx + 0.2, fl + 0.55, sz], [sx + 0.2, fl + 2.68, sz], [sx - 0.2, fl + 2.68, sz]], [[0, 0], [1, 0], [1, 1], [0, 1]]);
  // エアコンの室外機（右の壁ぞい）と配管
  for (const z of [-5.2, -9.2]) {
    const x = b.x1 + 0.45;
    k.color(C('#e2e2dc')); k.box('plastic', x, 0.35, z, 0.3, 0.6, 0.8);
    k.color(C('#3a3d3f')); k.cyl('dark', x + 0.155, 0.36, z + 0.05, 0.22, 0.01, 16);
    k.color(C('#d8d6cc')); k.rod('plastic', [x - 0.1, 0.62, z - 0.3], [b.x1 + 0.08, fl + 2.3, z - 0.3], 0.07);
  }
  env.solid?.([[b.x0, b.z0], [b.x1, b.z0], [b.x1, b.z1], [b.x0, b.z1]], yR + 0.3);
}

// ---------- 外壁: 鉄筋コンクリート（連窓と霧除けの庇） ----------
function bandWall(k, m, L, { floors, fh, side, entrance }) {
  k.at(m);
  const HT = floors * fh, short = side === 'left' || side === 'right';
  const holes = [], sash = [];
  for (let f = 0; f < floors; f++) {
    const y0 = f * fh, ya = y0 + 0.95, yb = y0 + fh - 0.55;
    if (short) {
      const n = Math.max(1, Math.floor(L / 5));
      for (let q = 0; q < n; q++) { const c = (L * (q + 0.5)) / n; holes.push({ x0: c - 0.85, x1: c + 0.85, y0: ya, y1: yb }); sash.push([c - 0.85, c + 0.85, ya, yb, y0]); }
      continue;
    }
    const segs = f === 0 && entrance ? [[1.0, entrance[0] - 1.6], [entrance[1] + 1.6, L - 1.0]] : [[1.0, L - 1.0]];
    for (const [a, b] of segs) {
      if (b - a < 1.4) continue;
      holes.push({ x0: a, x1: b, y0: ya, y1: yb });
      const n = Math.max(1, Math.round((b - a) / 1.8)), st = (b - a) / n;
      for (let q = 0; q < n; q++) sash.push([a + q * st, a + (q + 1) * st, ya, yb, y0]);
    }
  }
  k.color(C('#e7e1d3'));
  holeyWall(k, 'mortar', L, 0, HT, entrance ? [...holes, { x0: entrance[0], x1: entrance[1], y0: 0, y1: 2.6 }] : holes, 0.2);
  for (const [a, b, ya, yb, fy] of sash) slider(k, a, b, ya, yb, 0.12, { frame: C('#b9bcba'), glass: C('#2b3a44'), win: 'windowOffice', floor: fy });
  for (const h of holes) {
    // 霧除けの庇と、窓台の水切り
    k.color(C('#efebe0')); k.box('concrete', (h.x0 + h.x1) / 2, h.y1 + 0.06, 0.3, h.x1 - h.x0 + 0.3, 0.12, 0.6);
    k.color(C('#c9c4b6')); k.box('concrete', (h.x0 + h.x1) / 2, h.y0 - 0.03, 0.05, h.x1 - h.x0 + 0.1, 0.06, 0.12);
  }
  if (entrance) glassDoor(k, entrance[0], entrance[1], 2.6, 0.2);
  // 腰の基礎の帯、パラペットと笠木、竪樋
  k.color(C('#b6b1a4')); k.box('concrete', L / 2, 0.2, 0.03, L, 0.4, 0.06);
  k.color(C('#ebe6d9')); k.box('concrete', L / 2, HT + 0.5, 0.1, L, 1.0, 0.35);
  k.color(C('#9aa0a2')); k.box('metal', L / 2, HT + 1.02, 0.1, L + 0.05, 0.05, 0.4);
  if (!short) { k.color(C('#8d918f')); for (const x of [0.45, L - 0.45]) k.cyl('metal', x, -BASE, 0.12, 0.05, HT + BASE + 0.4, 8); }
}

// ---------- 外壁: タイル張り（彫りの深い窓、白い窓台、1 階は背の高い窓） ----------
function tileWall(k, m, L, { floors, fh, side, entrance, stair }) {
  k.at(m);
  const HT = floors * fh, short = side === 'left' || side === 'right';
  const x0 = 0.8, n = Math.max(1, Math.round((L - 2 * x0) / 3.2)), st = (L - 2 * x0) / n;
  const holes = [];
  for (let f = 0; f < floors; f++) {
    const y0 = f * fh;
    for (let q = 0; q < n; q++) {
      if (stair && q === 0) continue;
      if (short && q % 2 === 1 && n > 2) continue;
      const c = x0 + st * (q + 0.5);
      if (f === 0 && entrance && c > entrance[0] - 1.4 && c < entrance[1] + 1.4) continue;
      const w = f === 0 ? st - 0.9 : 1.9;
      holes.push({ x0: c - w / 2, x1: c + w / 2, y0: y0 + (f === 0 ? 0.7 : 0.95), y1: y0 + fh - 0.75, fy: y0 });
    }
  }
  const tall = stair ? { x0: x0 + 0.5, x1: x0 + st - 0.5, y0: 0.9, y1: HT - 0.9 } : null;
  const all = [...holes];
  if (tall) all.push(tall);
  if (entrance) all.push({ x0: entrance[0], x1: entrance[1], y0: 0, y1: 2.9 });
  k.color(C('#ffffff'));
  holeyWall(k, 'lsTile', L, 0.7, HT, all.filter((h) => h.y1 > 0.7), 0.28);
  // 腰は御影石風（濃い灰色）
  k.color(C('#6a6866'));
  holeyWall(k, 'concrete', L, 0, 0.7, all.filter((h) => h.y0 < 0.7).map((h) => ({ ...h })), 0.28);
  for (const h of holes) {
    slider(k, h.x0, h.x1, h.y0, h.y1, 0.2, { frame: C('#5e574e'), glass: C('#28343c'), win: 'windowOffice', floor: h.fy, panes: h.x1 - h.x0 > 2.2 ? 3 : 2 });
    k.color(C('#ece9e1')); k.box('concrete', (h.x0 + h.x1) / 2, h.y0 - 0.05, 0.04, h.x1 - h.x0 + 0.16, 0.1, 0.16);
  }
  if (tall) {
    k.color(C('#6f8791'));
    k.face('glass', [[tall.x0, tall.y0, -0.3], [tall.x1, tall.y0, -0.3], [tall.x1, tall.y1, -0.3], [tall.x0, tall.y1, -0.3]]);
    k.color(C('#d8d8d2'));
    for (let y = fh * 0.5; y < HT - 1; y += fh / 2) k.box('concrete', (tall.x0 + tall.x1) / 2, y, -0.9, tall.x1 - tall.x0, 0.18, 1.0);
    k.color(C('#5e574e'));
    for (let y = fh; y < HT - 1; y += fh) k.box('metal', (tall.x0 + tall.x1) / 2, y, -0.28, tall.x1 - tall.x0, 0.06, 0.06);
    k.box('metal', (tall.x0 + tall.x1) / 2, HT / 2, -0.28, 0.05, tall.y1 - tall.y0, 0.05);
  }
  if (entrance) glassDoor(k, entrance[0], entrance[1], 2.9, 0.28, C('#5e574e'));
  // 1 階の上の白い帯（基壇と上の階を分ける）、隅の白い役物、笠木
  k.color(C('#ece9e1'));
  k.box('concrete', L / 2, fh - 0.12, 0.06, L + 0.12, 0.3, 0.12);
  for (const x of [0.12, L - 0.12]) k.box('concrete', x, HT / 2 + 0.35, 0.04, 0.24, HT + 0.7, 0.08);
  k.box('concrete', L / 2, HT + 0.55, 0.1, L + 0.1, 1.1, 0.38);
  k.color(C('#9aa0a2')); k.box('metal', L / 2, HT + 1.12, 0.1, L + 0.12, 0.05, 0.42);
}

// ---------- 外壁: カーテンウォール（lab.js の本館と同じ作り、階数を変えられる） ----------
function curtainWall(k, m, L, { floors, fh, lobby = null }) {
  k.at(m);
  const HT = floors * fh, pier = 1.4;
  k.color(C('#d8d6cf'));
  for (const x of [pier / 2, L - pier / 2]) k.box('concrete', x, HT / 2, 0.15, pier, HT, 0.3);
  const x0 = pier, x1 = L - pier, n = Math.max(1, Math.round((x1 - x0) / 1.5)), st = (x1 - x0) / n;
  for (let f = 0; f < floors; f++) {
    const y0 = f * fh, lob = lobby && f === 0;
    const gy1 = y0 + fh - (lob ? 0.6 : 0.85);
    for (let q = 0; q < n; q++) {
      const a = x0 + q * st, b = a + st;
      const inLobby = lob && a >= lobby[0] - 0.01 && b <= lobby[1] + 0.01;
      k.color(inLobby ? C('#50646c') : C('#1c3442').offsetHSL(0, 0, ((q * 7 + f * 3) % 5) * 0.01 - 0.015));
      k.face(lob ? 'windowLobby' : 'windowOffice', [[a, y0 + 0.05, -0.12], [b, y0 + 0.05, -0.12], [b, gy1, -0.12], [a, gy1, -0.12]], [[a, 0.05], [b, 0.05], [b, gy1 - y0], [a, gy1 - y0]]);
      k.color(C('#9ea6aa'));
      k.box('metal', a, (y0 + gy1) / 2, -0.07, 0.06, gy1 - y0, 0.12);
      if (!lob) k.box('metal', (a + b) / 2, y0 + 1.0, -0.08, st, 0.05, 0.08);
    }
    k.color(C('#eceeec'));
    k.box('concrete', (x0 + x1) / 2, (gy1 + y0 + fh) / 2, 0.0, x1 - x0, y0 + fh - gy1, 0.2);
    k.color(C('#b9bec0'));
    k.box('metal', (x0 + x1) / 2, gy1 + 0.02, 0.03, x1 - x0, 0.04, 0.24);
  }
  k.color(C('#c4c9cb'));
  for (let x = x0 + st * 2; x < x1 - 0.5; x += st * 2) k.box('metal', x, (fh + HT) / 2 + 0.3, 0.42, 0.12, HT - fh + 0.6, 0.8);
  k.color(C('#e3e4e0')); k.box('concrete', L / 2, HT + 0.6, 0.1, L, 1.2, 0.35);
  k.color(C('#9aa0a2')); k.box('metal', L / 2, HT + 1.22, 0.1, L + 0.05, 0.05, 0.4);
}

// ---------- 外壁: 実験棟の白い格子（lab.js と同じ作り） ----------
function gridWall(k, m, L, { floors, fh, stair = false }) {
  k.at(m);
  const HT = floors * fh, bay = 2.4, n = Math.max(1, Math.floor(L / bay)), st = L / n;
  const holes = [];
  for (let f = 0; f < floors; f++) {
    const y0 = f * fh;
    for (let q = 0; q < n; q++) {
      if (stair && q === n - 1) continue;
      const cx = st * (q + 0.5), w = f === 0 ? st - 0.5 : 1.7;
      holes.push({ x0: cx - w / 2, x1: cx + w / 2, y0: y0 + (f === 0 ? 0.1 : 0.85), y1: y0 + fh - 0.75 });
    }
  }
  if (stair) holes.push({ x0: L - st + 0.35, x1: L - 0.35, y0: 0.6, y1: HT - 0.6 });
  k.color(C('#f1f0eb'));
  holeyWall(k, 'concrete', L, 0, HT, holes, 0.4);
  for (const h of holes) {
    const tall = h.y1 - h.y0 > fh;
    k.color(tall ? C('#6f8791') : C('#34505e'));
    const fy = tall ? 0 : Math.floor(h.y0 / fh) * fh;
    k.face(tall ? 'glass' : 'windowOffice', [[h.x0, h.y0, -0.34], [h.x1, h.y0, -0.34], [h.x1, h.y1, -0.34], [h.x0, h.y1, -0.34]], [[h.x0, h.y0 - fy], [h.x1, h.y0 - fy], [h.x1, h.y1 - fy], [h.x0, h.y1 - fy]]);
    k.color(C('#a3aaae'));
    k.box('metal', (h.x0 + h.x1) / 2, h.y0 + 0.02, -0.3, h.x1 - h.x0, 0.04, 0.1);
    if (tall) {
      k.color(C('#d8d8d2'));
      for (let y = fh * 0.5; y < HT - 1; y += fh / 2) k.box('concrete', (h.x0 + h.x1) / 2, y, -0.9, h.x1 - h.x0, 0.18, 1.0);
      k.color(C('#a3aaae'));
      for (let y = h.y0 + fh; y < h.y1; y += fh) k.box('metal', (h.x0 + h.x1) / 2, y, -0.3, h.x1 - h.x0, 0.05, 0.08);
      continue;
    }
    k.box('metal', (h.x0 + h.x1) / 2, h.y0 + (h.y1 - h.y0) * 0.62, -0.3, h.x1 - h.x0, 0.04, 0.06);
    k.box('metal', (h.x0 + h.x1) / 2, (h.y0 + h.y1) / 2, -0.3, 0.04, h.y1 - h.y0, 0.06);
    k.color(C('#a7afb3'));
    for (const dy of [0.12, 0.3]) k.box('metal', (h.x0 + h.x1) / 2, h.y1 + dy, 0.35, h.x1 - h.x0 + 0.3, 0.04, 0.6);
  }
  k.color(C('#d9d8d2'));
  for (let f = 1; f <= floors; f++) k.box('concrete', L / 2, f * fh - 0.05, 0.02, L, 0.08, 0.05);
  k.color(C('#e9e8e3')); k.box('concrete', L / 2, HT + 0.6, 0.1, L, 1.2, 0.35);
  k.color(C('#9aa0a2')); k.box('metal', L / 2, HT + 1.22, 0.1, L + 0.05, 0.05, 0.4);
}

// ---------- 屋上 ----------
// 塔屋（階段室）: 中心 (x, z)、幅 w × 奥行き d、高さ h（屋上の床から）。扉は +z 側
function penthouse(k, x, z, w, d, h, y, col = C('#e6e1d4')) {
  k.color(col); k.box('mortar', x, y + h / 2, z, w, h, d);
  k.color(C('#c9c4b6')); k.box('concrete', x, y + h + 0.1, z, w + 0.3, 0.2, d + 0.3);
  k.color(C('#8e979c')); k.box('paint', x - w / 2 + 0.9, y + 1.05, z + d / 2 + 0.02, 0.9, 2.0, 0.04);
  k.color(C('#d0d2d0')); k.box('metal', x - w / 2 + 1.25, y + 1.0, z + d / 2 + 0.05, 0.03, 0.12, 0.06);
  k.color(C('#2e3a42')); k.box('glass', x + w / 2 - 0.9, y + h - 1.0, z + d / 2 + 0.01, 0.9, 0.6, 0.03);
  k.color(C('#b9bcba')); k.box('metal', x - w / 2 + 0.9, y + 2.2, z + d / 2 + 0.35, 1.3, 0.05, 0.7);
}

// 高架水槽（FRP のパネル水槽を鉄骨の架台に載せる）
function elevatedTank(k, x, z, y, w = 2.6, d = 2.0, h = 2.0, leg = 2.2) {
  k.color(C('#7b8286'));
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) k.box('metal', x + sx * (w / 2 - 0.1), y + leg / 2, z + sz * (d / 2 - 0.1), 0.14, leg, 0.14);
  for (const sz of [-1, 1]) { k.rod('metal', [x - w / 2 + 0.1, y + 0.2, z + sz * (d / 2 - 0.1)], [x + w / 2 - 0.1, y + leg - 0.1, z + sz * (d / 2 - 0.1)], 0.05); k.rod('metal', [x + w / 2 - 0.1, y + 0.2, z + sz * (d / 2 - 0.1)], [x - w / 2 + 0.1, y + leg - 0.1, z + sz * (d / 2 - 0.1)], 0.05); }
  k.box('metal', x, y + leg, z, w + 0.2, 0.14, d + 0.2);
  k.color(C('#dcd8c8')); k.box('plastic', x, y + leg + 0.07 + h / 2, z, w, h, d);
  // パネルの継ぎ目（1 m 角）
  k.color(C('#c4bfad'));
  for (let q = 1; q < w; q++) for (const sz of [-1, 1]) k.box('plastic', x - w / 2 + q, y + leg + 0.07 + h / 2, z + sz * (d / 2 + 0.01), 0.05, h, 0.03);
  for (let q = 1; q < h; q++) k.box('plastic', x, y + leg + 0.07 + q, z, w + 0.03, 0.05, d + 0.03);
  // 点検口とはしご
  k.color(C('#bfb9a6')); k.box('plastic', x + 0.5, y + leg + h + 0.12, z, 0.6, 0.1, 0.6);
  k.color(C('#9aa0a2'));
  for (const s of [-0.2, 0.2]) k.rod('metal', [x - w / 2 - 0.12, y, z + s], [x - w / 2 - 0.12, y + leg + h + 0.6, z + s], 0.04);
  for (let yy = y + 0.3; yy < y + leg + h + 0.4; yy += 0.3) k.rod('metal', [x - w / 2 - 0.12, yy, z - 0.2], [x - w / 2 - 0.12, yy, z + 0.2], 0.03);
}

// 冷却塔
function coolingTower(k, x, z, y) {
  k.color(C('#d3d7d8')); k.box('metal', x, y + 1.4, z, 3.4, 2.6, 3.4);
  k.color(C('#8a9194')); k.cyl('metal', x, y + 2.7, z, 1.2, 0.8, 18);
  k.color(C('#3d4245')); k.cyl('dark', x, y + 3.5, z, 1.05, 0.02, 18);
  k.color(C('#a7adb0')); for (let s = 0; s < 3; s++) k.box('metal', x, y + 0.6 + s * 0.6, z + 1.72, 3.2, 0.05, 0.05);
}

// 屋上一式。o: ph（塔屋 [x, z, w, d]）, tank, towers, stacks, mast, solar, units（室外機の列）
function roof(k, M, b, HT, o = {}) {
  k.at(M);
  const w = b.x1 - b.x0, d = b.z1 - b.z0, cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2;
  k.color(C('#9b9a94')); k.box('concrete', cx, HT + 0.05, cz, w - 0.3, 0.1, d - 0.3);
  if (o.ph) penthouse(k, o.ph[0], o.ph[1], o.ph[2], o.ph[3], o.ph[4] || 3.2, HT + 0.1);
  if (o.tank) elevatedTank(k, o.tank[0], o.tank[1], HT + 0.1 + (o.tank[2] || 0));
  if (o.machine) {
    // 機械室（ペントハウス）とガラリ
    const mw = w * 0.3, md = d * 0.45;
    k.color(C('#e6e6e1')); k.box('concrete', cx - w * 0.12, HT + 2.1, cz - 1, mw, 4.2, md);
    k.color(C('#b4b8ba')); k.box('metal', cx - w * 0.12, HT + 4.25, cz - 1, mw + 0.3, 0.1, md + 0.3);
    k.color(C('#8e9496'));
    for (let q = 0; q < 4; q++) k.box('metal', cx - w * 0.12 - w * 0.11 + q * w * 0.075, HT + 2.2, cz - 1 + md / 2 + 0.02, w * 0.05, 1.6, 0.05);
  }
  for (let q = 0; q < (o.towers || 0); q++) coolingTower(k, cx + w * 0.14 + q * 4.2, cz + 2.5, HT);
  for (let q = 0; q < (o.stacks || 0); q++) {
    const x = b.x0 + 3 + q * ((w - 6) / Math.max(1, o.stacks - 1)), z = b.z0 + 2.5, h = 4.5 + (q % 3) * 0.6;
    k.color(C('#c9cdcf')); k.cyl('metal', x, HT, z, 0.35, h, 14, 0.3);
    k.color(C('#6f7578')); k.cyl('metal', x, HT + h, z, 0.33, 0.12, 14);
    k.color(C('#9aa0a2')); k.rod('metal', [x, HT + h * 0.7, z], [x, HT, z + 1.4], 0.05);
  }
  // エアコンの室外機の列（小さい建物）
  for (let q = 0; q < (o.units || 0); q++) {
    const x = b.x1 - 2 - q * 1.1, z = b.z0 + 1.6;
    k.color(C('#e2e2dc')); k.box('plastic', x, HT + 0.45, z, 0.85, 0.7, 0.32);
    k.color(C('#3a3d3f')); k.cyl('dark', x - 0.1, HT + 0.45, z + 0.165, 0.24, 0.01, 16);
  }
  if (o.solar) {
    k.color(C('#1f2c4a'));
    for (let q = 0; q < o.solar; q++) {
      const g = new THREE.BoxGeometry(2.1, 0.05, 3.6).rotateX(-0.35);
      k.geo('glass', g, new THREE.Matrix4().setPosition(b.x0 + 3 + q * 2.4, HT + 0.9, cz + d * 0.3));
    }
  }
  if (o.mast) {
    const x = b.x1 - 3, z = cz - 3, mh = o.mast;
    k.color(C('#d7dbdc'));
    k.rod('metal', [x, HT, z], [x, HT + mh, z], 0.12);
    for (let y = HT + 1; y < HT + mh; y += 1.2) k.rod('metal', [x - 0.3, y, z], [x + 0.3, y + 0.6, z], 0.03);
    k.color(C('#c8342c')); k.box('paint', x, HT + mh + 0.1, z, 0.3, 0.2, 0.3);
    k.color(C('#e0e3e4'));
    k.rod('metal', [x - 0.9, HT + mh - 1, z], [x + 0.9, HT + mh - 1, z], 0.05);
    for (const s of [-1, 1]) {
      k.geo('plastic', new THREE.SphereGeometry(0.1, 8, 6), new THREE.Matrix4().setPosition(x + s * 0.9, HT + mh - 0.75, z + 0.15));
      k.rod('metal', [x + s * 0.9, HT + mh - 1, z], [x + s * 0.9, HT + mh - 0.75, z], 0.03);
    }
    k.geo('plastic', new THREE.ConeGeometry(0.12, 0.5, 8).rotateZ(Math.PI / 2), new THREE.Matrix4().setPosition(x, HT + mh - 0.4, z));
    // 気象レーダーのドーム
    if (o.radome) {
      const ph = o.radome;
      k.color(C('#9aa0a2')); k.cyl('metal', x - 4, HT, z + 1, 0.9, ph, 12);
      k.color(C('#f4f4f0')); k.geo('plastic', new THREE.SphereGeometry(1.5, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.62), new THREE.Matrix4().setPosition(x - 4, HT + ph + 0.6, z + 1));
    } else {
      k.color(C('#f0f0ec')); k.geo('plastic', new THREE.SphereGeometry(0.9, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(-Math.PI / 2 + 0.6), new THREE.Matrix4().setPosition(x - 3.5, HT + 1.4, z + 1));
      k.color(C('#9aa0a2')); k.rod('metal', [x - 3.5, HT, z + 1], [x - 3.5, HT + 1.2, z + 1], 0.1);
    }
  }
}

// 屋上の切り文字の看板（鉄骨の枠に文字を載せる）。中心 x・正面の z・下端 y、幅 lw
function roofSign(k, x, z, y, lw) {
  const lh = lw / 8;
  k.color(C('#9aa0a2'));
  const n = Math.max(2, Math.round(lw / 8));
  for (let q = 0; q <= n; q++) k.box('metal', x - lw * 0.45 + (q * lw * 0.9) / n, y + lh * 0.45, z - 0.2, 0.1, lh * 0.9 + 0.4, 0.1);
  k.box('metal', x, y + lh * 0.3, z - 0.2, lw * 0.92, 0.08, 0.08);
  k.color(C('#ffffff'));
  k.face('lsLetters', [[x - lw / 2, y + 0.4, z], [x + lw / 2, y + 0.4, z], [x + lw / 2, y + 0.4 + lh, z], [x - lw / 2, y + 0.4 + lh, z]], [[0, 0], [1, 0], [1, 1], [0, 1]]);
}

// 10 階の王冠: 屋上の機械を隠す縦ルーバーのスクリーンと、上の薄い庇
function crown(k, b, HT) {
  const h = 4.6, y = HT + 1.2, inset = 1.2;
  const x0 = b.x0 + inset, x1 = b.x1 - inset, z0 = b.z0 + inset, z1 = b.z1 - inset;
  k.color(C('#c9ced0'));
  for (const [ax, az, bx, bz] of [[x0, z1, x1, z1], [x1, z1, x1, z0], [x1, z0, x0, z0], [x0, z0, x0, z1]]) {
    const L = Math.hypot(bx - ax, bz - az), n = Math.round(L / 0.6);
    for (let q = 0; q <= n; q++) {
      const t = q / n, x = ax + (bx - ax) * t, z = az + (bz - az) * t;
      k.box('metal', x, y + h / 2, z, ax === bx ? 0.5 : 0.08, h, ax === bx ? 0.08 : 0.5);
    }
  }
  k.color(C('#eceeec'));
  k.box('concrete', (x0 + x1) / 2, y + h + 0.15, z1 - 0.8, x1 - x0 + 1.6, 0.3, 1.6 + 0.01);
  k.box('concrete', (x0 + x1) / 2, y + h + 0.15, z0 + 0.8, x1 - x0 + 1.6, 0.3, 1.6);
  for (const s of [-1, 1]) k.box('concrete', s < 0 ? x0 : x1, y + h + 0.15, (z0 + z1) / 2, 1.6, 0.3, z1 - z0 - 1.6);
}

// ---------- 玄関 ----------
// 厚い庇と柱、ガラスの風除室（自動ドア）。ex = 玄関の中心 x、z0 = 建物の正面
function entrance(k, env, ex, z0, { cw, cd, cy, ct = 0.45, vw, vd, vh, cols = true, letters = true, frame = C('#a9aeb0') }) {
  k.at(env.M);
  k.color(C('#eeefec')); k.box('concrete', ex, cy, z0 + cd / 2, cw, ct, cd, 31);
  k.color(C('#d8d8d2')); k.face('glowV', [[ex - cw / 2, cy - ct / 2, z0], [ex + cw / 2, cy - ct / 2, z0], [ex + cw / 2, cy - ct / 2, z0 + cd], [ex - cw / 2, cy - ct / 2, z0 + cd]]);
  k.color(C('#c6cacc')); k.box('metal', ex, cy + 0.05, z0 + cd + 0.03, cw + 0.06, ct + 0.22, 0.08);
  for (const s of [-1, 1]) k.box('metal', ex + s * (cw / 2 + 0.03), cy + 0.05, z0 + cd / 2, 0.08, ct + 0.22, cd);
  if (letters) {
    const lw = Math.min(6.8, cw * 0.5), lh = lw / 8;
    k.color(C('#ffffff')); k.face('lsLetters', [[ex - lw / 2, cy - lh / 2 + 0.05, z0 + cd + 0.08], [ex + lw / 2, cy - lh / 2 + 0.05, z0 + cd + 0.08], [ex + lw / 2, cy + lh / 2 + 0.05, z0 + cd + 0.08], [ex - lw / 2, cy + lh / 2 + 0.05, z0 + cd + 0.08]], [[0, 0], [1, 0], [1, 1], [0, 1]]);
  }
  k.color(C('#fffaf0'));
  for (let x = -cw / 2 + 1.5; x <= cw / 2 - 1.49; x += 2.5) for (let z = 1.6; z < cd - 0.5; z += 2.2) k.cyl('lamp', ex + x, cy - ct / 2 - 0.012, z0 + z, 0.1, 0.012, 12);
  if (cols) for (const s of [-1, 1]) {
    k.color(C('#d8d6cf')); k.box('concrete', ex + s * (cw / 2 - 1.4), (BASE + cy) / 2, z0 + cd - 0.8, 0.5, cy - BASE, 0.5);
    env.fence?.(ex + s * (cw / 2 - 1.4), z0 + cd - 0.8, ex + s * (cw / 2 - 1.4), z0 + cd - 0.8, 0.3);
  }
  // 風除室
  const y0 = BASE, y1 = y0 + vh, xa = ex - vw / 2, xb = ex + vw / 2, zf = z0 + vd;
  k.color(C('#5d6264')); k.box('dark', ex, y0 + 0.012, z0 + vd / 2, vw - 0.1, 0.02, vd - 0.1);
  k.color(C('#ffffff'));
  k.face('glassClear', [[xa, y0, zf], [xb, y0, zf], [xb, y1, zf], [xa, y1, zf]]);
  k.face('glassClear', [[xb, y0, zf], [xb, y0, z0], [xb, y1, z0], [xb, y1, zf]]);
  k.face('glassClear', [[xa, y0, z0], [xa, y0, zf], [xa, y1, zf], [xa, y1, z0]]);
  k.color(C('#e9eae6')); k.box('concrete', ex, y1 + 0.15, z0 + vd / 2, vw + 0.1, 0.3, vd + 0.05);
  k.color(frame);
  for (const [x, z] of [[xa, zf], [xb, zf], [xa, z0 + 0.05], [xb, z0 + 0.05]]) k.box('metal', x, (y0 + y1) / 2, z, 0.1, y1 - y0, 0.1);
  const dw = Math.min(1.6, vw / 4);
  for (const x of [ex - dw, ex + dw]) k.box('metal', x, (y0 + y1) / 2, zf, 0.08, y1 - y0, 0.1);
  k.box('metal', ex, y0 + 2.4, zf, vw, 0.12, 0.12);
  for (const x of [xa, xb]) { k.box('metal', x, y0 + 2.4, z0 + vd / 2, 0.1, 0.1, vd); k.box('metal', x, y0 + 0.05, z0 + vd / 2, 0.1, 0.1, vd); }
  for (const [a0, a1] of [[ex - dw + 0.05, ex - 0.02], [ex + 0.02, ex + dw - 0.05]]) {
    for (const x of [a0 + 0.03, a1 - 0.03]) k.box('metal', x, y0 + 1.2, zf - 0.08, 0.05, 2.3, 0.05);
    k.box('metal', (a0 + a1) / 2, y0 + 0.05, zf - 0.08, a1 - a0, 0.08, 0.05);
    k.box('metal', (a0 + a1) / 2, y0 + 2.33, zf - 0.08, a1 - a0, 0.06, 0.05);
  }
  k.color(C('#8d9396')); k.box('metal', ex, y0 + 2.6, zf - 0.1, dw * 2 + 0.1, 0.3, 0.2);
  k.color(C('#2e7a4a')); k.box('plastic', ex + dw + 0.8, y0 + 2.15, zf + 0.03, 0.5, 0.18, 0.02);
  k.color(C('#7d8a90')); k.face('windowLobby', [[ex - dw, y0 + 0.05, z0 + 0.03], [ex + dw, y0 + 0.05, z0 + 0.03], [ex + dw, y0 + 2.4, z0 + 0.03], [ex - dw, y0 + 2.4, z0 + 0.03]], [[ex - dw, 0.05], [ex + dw, 0.05], [ex + dw, 2.4], [ex - dw, 2.4]]);
  env.fence?.(xa, zf, xb, zf, 0.15);
  env.fence?.(xa, z0, xa, zf, 0.15);
  env.fence?.(xb, z0, xb, zf, 0.15);
}

// ---------- 建物 ----------
function mainBuilding(k, env, S, level) {
  const { b, fh, facade } = S.main, floors = level, HT = floors * fh;
  const M = env.M, w = b.x1 - b.x0, cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2;
  k.at(M);
  k.color(C('#9d9b94')); k.box('concrete', cx, (BASE - 1) / 2, cz, w + 0.4, BASE + 1, b.z1 - b.z0 + 0.4);
  const ent = facade === 'band' ? [w / 2 - 1.3, w / 2 + 1.3] : facade === 'tile' ? [w / 2 - 1.6, w / 2 + 1.6] : null;
  for (const [ax, az, bx, bz, side] of SIDES(b)) {
    const { m, L } = wallFrame(M, ax, az, bx, bz, BASE);
    const o = { floors, fh, side, entrance: side === 'front' ? ent : null };
    if (facade === 'band') bandWall(k, m, L, o);
    else if (facade === 'tile') tileWall(k, m, L, { ...o, stair: S.main.stair && side === 'front' });
    else curtainWall(k, m, L, { floors, fh, lobby: side === 'front' ? [L / 2 - 7, L / 2 + 7] : null });
  }
  const R = up(M, BASE), top = HT + BASE;
  k.at(M);
  if (facade === 'band') {
    // 玄関の庇（2 階は薄い鉄の庇、3 階は片持ちのコンクリートの庇）
    if (level === 2) { k.color(C('#c9ccca')); k.box('metal', cx, BASE + 2.85, b.z1 + 0.7, 3.6, 0.1, 1.4); }
    else {
      k.color(C('#eceae2')); k.box('concrete', cx, BASE + 3.0, b.z1 + 1.4, 5.6, 0.3, 2.8);
      k.color(C('#fffaf0')); for (const x of [-1.5, 0, 1.5]) k.cyl('lamp', cx + x, BASE + 2.84, b.z1 + 1.5, 0.09, 0.012, 12);
    }
    k.color(C('#bdb9b0')); k.box('concrete', cx, BASE / 2, b.z1 + 1.0, 4.2, BASE + 0.1, 2.0);
    // 塔屋・高架水槽・室外機
    roof(k, R, b, HT, { ph: [b.x0 + 3.2, b.z0 + 2.5, 4.4, 3.6], tank: level === 2 ? [b.x0 + 9, b.z0 + 3] : [b.x0 + 3.2, b.z0 + 2.5, 3.3], units: level === 2 ? 5 : 8 });
    // 屋上の名前: 2 階はパラペットの正面、3 階は塔屋の前に立てた看板
    k.at(M);
    if (level === 2) {
      const lw = 7.6, lh = lw / 8, y = top + 0.5 - lh / 2;
      k.color(C('#ffffff')); k.face('lsLetters', [[cx - lw / 2, y, b.z1 + 0.29], [cx + lw / 2, y, b.z1 + 0.29], [cx + lw / 2, y + lh, b.z1 + 0.29], [cx - lw / 2, y + lh, b.z1 + 0.29]], [[0, 0], [1, 0], [1, 1], [0, 1]]);
    } else roofSign(k, cx + 2, b.z1 - 0.6, top + 0.9, 12);
  } else if (facade === 'tile') {
    entrance(k, env, cx, b.z1, { cw: 8.4, cd: 4.6, cy: BASE + 3.35, ct: 0.4, vw: 4.6, vd: 2.2, vh: 2.8, frame: C('#5e574e') });
    roof(k, R, b, HT, { ph: [b.x0 + (S.main.stair ? 2.6 : 4), b.z0 + 3, 4.8, 4.2, 3.4], towers: level === 4 ? 1 : 2, units: 6, mast: level === 5 ? 7 : 0 });
    k.at(M);
    roofSign(k, cx + 2, b.z1 - 0.6, top + 1.2, level === 4 ? 16 : 19);
  } else {
    entrance(k, env, cx, b.z1, level >= 7 ? { cw: 14, cd: 7.6, cy: 4.55, ct: 0.5, vw: 6.4, vd: 2.8, vh: 3.1 } : { cw: 12, cd: 6.4, cy: 4.55, ct: 0.5, vw: 5.6, vd: 2.6, vh: 3.1 });
    const o = { machine: true, towers: level >= 8 ? 3 : 2, mast: level >= 8 ? (level === 10 ? 0 : 12) : 0 };
    if (S.crown) {
      // 観測マストとレーダーは王冠の上へ突き出す
      roof(k, R, b, HT, { ...o, mast: 16, radome: 6.4 });
      k.at(R); crown(k, b, HT);
      k.at(M);
      roofSign(k, cx, b.z1 + 0.1, top + 1.2, Math.min(28, w * 0.7));
    } else {
      roof(k, R, b, HT, o);
      k.at(M);
      roofSign(k, cx, b.z1 + 0.4, top - 0.2 + (level >= 7 ? 1.2 : 1.2), Math.min(28, w * 0.66));
    }
  }
  env.solid?.([[b.x0, b.z0], [b.x1, b.z0], [b.x1, b.z1], [b.x0, b.z1]], top + 2);
  return { ex: cx, ez: b.z1 };
}

function annexBuilding(k, env, S) {
  const { b, floors } = S.annex, fh = 3.9, HT = floors * fh, M = env.M;
  k.at(M);
  k.color(C('#9d9b94')); k.box('concrete', (b.x0 + b.x1) / 2, (BASE - 1) / 2, (b.z0 + b.z1) / 2, b.x1 - b.x0 + 0.4, BASE + 1, b.z1 - b.z0 + 0.4);
  for (const [ax, az, bx, bz, side] of SIDES(b)) {
    const { m, L } = wallFrame(M, ax, az, bx, bz, BASE);
    gridWall(k, m, L, { floors, fh, stair: side === 'front' || side === 'back' });
  }
  const w = b.x1 - b.x0;
  roof(k, up(M, BASE), b, HT, { stacks: Math.max(3, Math.round(w / 3.6)), towers: floors >= 6 ? 1 : 0, solar: Math.min(4, Math.floor((w - 16) / 2.4)) || 0, units: floors < 6 ? 6 : 0 });
  env.solid?.([[b.x0, b.z0], [b.x1, b.z0], [b.x1, b.z1], [b.x0, b.z1]], HT + BASE + 2);
}

// 渡り廊下（f 階の床から 1 階分。f は 0 始まり）
function bridge(k, env, xa, xb, f, fh = 3.9) {
  k.at(env.M);
  const zc = -8, y0 = BASE + fh * f, y1 = y0 + fh;
  k.color(C('#eceeec'));
  k.box('concrete', (xa + xb) / 2, y0 + 0.5, zc, xb - xa, 1.0, 4.4);
  k.box('concrete', (xa + xb) / 2, y1 - 0.3, zc, xb - xa, 0.6, 4.4);
  k.color(C('#3d5866'));
  k.face('glass', [[xa, y0 + 1, zc + 2.2], [xb, y0 + 1, zc + 2.2], [xb, y1 - 0.6, zc + 2.2], [xa, y1 - 0.6, zc + 2.2]]);
  k.face('glass', [[xb, y0 + 1, zc - 2.2], [xa, y0 + 1, zc - 2.2], [xa, y1 - 0.6, zc - 2.2], [xb, y1 - 0.6, zc - 2.2]]);
  k.color(C('#b9bec0'));
  for (let x = xa + 1.25; x < xb; x += 1.25) for (const s of [1, -1]) k.box('metal', x, (y0 + y1) / 2 + 0.2, zc + s * 2.22, 0.06, y1 - y0 - 1.6, 0.06);
}

// 10 階のエントランスホール（2 棟の間のガラスの箱。薄い屋根が前へ張り出す）
function hall(k, env, xa, xb) {
  k.at(env.M);
  const z0 = -12, z1 = 2.5, h = 6.2, y0 = BASE;
  k.color(C('#ffffff'));
  k.face('glassClear', [[xa, y0, z1], [xb, y0, z1], [xb, y0 + h, z1], [xa, y0 + h, z1]]);
  // 奥に見える床・受付・中の水槽
  k.color(C('#d9d4c8')); k.box('concrete', (xa + xb) / 2, y0 + 0.01, (z0 + z1) / 2, xb - xa, 0.02, z1 - z0);
  k.color(C('#e8e4da')); k.box('wood', (xa + xb) / 2 + 2, y0 + 0.55, z0 + 4, 3.2, 1.1, 0.8);
  k.color(C('#2d6f8a')); k.box('water', (xa + xb) / 2 - 2.2, y0 + 1.9, z0 + 1.2, 4.4, 3.2, 1.6);
  k.color(C('#6a6866')); k.box('concrete', (xa + xb) / 2 - 2.2, y0 + 0.15, z0 + 1.2, 4.6, 0.3, 1.8);
  k.color(C('#d8d6cf')); k.box('concrete', (xa + xb) / 2, y0 + h / 2, z0 + 0.1, xb - xa, h, 0.2);
  // 屋根（前へ張り出す）と縦の方立
  k.color(C('#eceeec')); k.box('concrete', (xa + xb) / 2, y0 + h + 0.25, (z0 + z1 + 3) / 2, xb - xa + 0.6, 0.5, z1 - z0 + 3);
  k.color(C('#d8d8d2')); k.face('glowV', [[xa, y0 + h, z1 + 3], [xb, y0 + h, z1 + 3], [xb, y0 + h, z1], [xa, y0 + h, z1]].reverse());
  k.color(C('#a9aeb0'));
  for (let x = xa + 0.02; x <= xb; x += (xb - xa) / 5) k.box('metal', Math.min(x, xb - 0.05), y0 + h / 2, z1, 0.1, h, 0.25);
  for (const y of [2.6, h - 0.05]) k.box('metal', (xa + xb) / 2, y0 + y, z1, xb - xa, 0.1, 0.2);
  // 自動ドア
  const ex = (xa + xb) / 2;
  for (const x of [ex - 1.4, ex, ex + 1.4]) k.box('metal', x, y0 + 1.2, z1 + 0.05, 0.06, 2.4, 0.06);
  k.color(C('#8d9396')); k.box('metal', ex, y0 + 2.6, z1 + 0.1, 3.0, 0.28, 0.2);
  env.fence?.(xa, z1, xb, z1, 0.2);
}

// ---------- 屋外の水槽 ----------
function roundTank(k, x, z, y, R, h, col) {
  k.color(C('#b7b3a8')); k.cyl('concrete', x, y, z, R + 0.15, 0.2, 28);
  k.color(col);
  k.geo('plastic', new THREE.CylinderGeometry(R, R * 0.97, h, 32, 1, true), new THREE.Matrix4().setPosition(x, y + 0.2 + h / 2, z));
  k.color(col.clone().multiplyScalar(1.12));
  k.geo('plastic', new THREE.TorusGeometry(R, 0.05, 6, 32).rotateX(Math.PI / 2), new THREE.Matrix4().setPosition(x, y + 0.2 + h, z));
  k.color(C('#2a5a64'));
  k.geo('water', new THREE.CircleGeometry(R - 0.01, 32).rotateX(-Math.PI / 2), new THREE.Matrix4().setPosition(x, y + 0.2 + h - 0.05, z));
  // 給水の塩ビ管（外から縁を越えて中へ）とエアレーションのホース
  k.color(C('#8f9699'));
  const a = 0.6, px = x + Math.cos(a) * (R + 0.25), pz = z + Math.sin(a) * (R + 0.25), ix = x + Math.cos(a) * (R - 0.4), iz = z + Math.sin(a) * (R - 0.4);
  const top = y + 0.2 + h + 0.25;
  k.rod('plastic', [px, y, pz], [px, top, pz], 0.08);
  k.rod('plastic', [px, top, pz], [ix, top, iz], 0.08);
  k.rod('plastic', [ix, top, iz], [ix, top - 0.45, iz], 0.08);
  k.color(C('#d8dcd8'));
  for (const da of [2.2, 3.6]) {
    const qx = x + Math.cos(da) * (R - 0.1), qz = z + Math.sin(da) * (R - 0.1);
    k.rod('plastic', [qx, top - 0.05, qz], [qx + (x - qx) * 0.3, y + 0.2 + h - 0.3, qz + (z - qz) * 0.3], 0.02);
  }
}

function rectTank(k, x, z, w, d, h) {
  k.color(C('#b4b0a6'));
  const t = 0.15;
  k.box('concrete', x, h / 2, z + d / 2 - t / 2, w, h, t);
  k.box('concrete', x, h / 2, z - d / 2 + t / 2, w, h, t);
  for (const s of [-1, 1]) k.box('concrete', x + s * (w / 2 - t / 2), h / 2, z, t, h, d - 2 * t);
  k.color(C('#2c5c55')); k.box('water', x, h - 0.12, z, w - 2 * t, 0.02, d - 2 * t);
  // 仕切りの板と、上に渡した足場板
  k.color(C('#9a8a70')); for (const dz of [-d / 4, d / 4]) k.box('wood', x, h + 0.03, z + dz, w, 0.05, 0.3);
}

// 水槽の上屋（鉄骨の柱と、明るいポリカ波板の屋根）
function tankShed(k, x0, x1, z0, z1, h = 3.4) {
  k.color(C('#7e878b'));
  for (let x = x0; x <= x1 + 0.01; x += (x1 - x0) / 2) for (const z of [z0, z1]) { const hh = z === z1 ? h + 0.45 : h + 0.1; k.box('metal', x, hh / 2, z, 0.15, hh, 0.15); }
  k.box('metal', (x0 + x1) / 2, h, z0, x1 - x0, 0.2, 0.12);
  k.box('metal', (x0 + x1) / 2, h + 0.35, z1, x1 - x0, 0.2, 0.12);
  k.color(C('#dfe9e6'));
  const pts = [[x0 - 0.3, h + 0.12, z0 - 0.4], [x0 - 0.3, h + 0.47, z1 + 0.4], [x1 + 0.3, h + 0.47, z1 + 0.4], [x1 + 0.3, h + 0.12, z0 - 0.4]];
  k.face('metalRoof', pts, [[x0 - 0.3, 0], [x0 - 0.3, z1 - z0 + 0.8], [x1 + 0.3, z1 - z0 + 0.8], [x1 + 0.3, 0]]);
  k.face('metalRoof', pts.map((q) => [q[0], q[1] - 0.02, q[2]]).reverse());
}

// ---------- 敷地（前庭・駐車場・小物） ----------
function lamp(k, env, x, z) {
  const y = env.gy(x, z);
  k.color(C('#6c7174')); k.box('metal', x, y + 2.3, z, 0.12, 4.6, 0.12);
  k.box('metal', x, y + 4.62, z + 0.18, 0.2, 0.08, 0.55);
  k.color(C('#fff6e0')); k.box('lamp', x, y + 4.575, z + 0.2, 0.16, 0.01, 0.45);
  env.fence?.(x, z, x, z, 0.12);
}
function flagpoles(k, env, cx, z, n = 3) {
  const cols = n === 1 ? ['#1d6fa8'] : ['#ffffff', '#1d6fa8', '#ffffff'];
  cols.forEach((col, q) => {
    const dx = (q - (n - 1) / 2) * 3, x = cx + dx, y = env.gy(x, z);
    k.color(C('#d0d4d6')); k.cyl('metal', x, y, z, 0.07, 10, 10, 0.05);
    k.color(C('#b5b9bb')); k.geo('metal', new THREE.SphereGeometry(0.12, 10, 6), new THREE.Matrix4().setPosition(x, y + 10.05, z));
    const fg = new THREE.PlaneGeometry(1.85, 1.3, 14, 2);
    { const P = fg.attributes.position; for (let i = 0; i < P.count; i++) { const u = (P.getX(i) + 0.925) / 1.85; P.setZ(i, Math.sin(u * 7.5 + dx) * 0.12 * u); P.setY(i, P.getY(i) - u * u * 0.12); } fg.computeVertexNormals(); }
    k.color(C(col)); k.geo('cloth', fg, new THREE.Matrix4().setPosition(x + 0.975, y + 9.05, z));
    env.fence?.(x, z, x, z, 0.15);
  });
}
function bench(k, env, x, z) {
  const y = env.gy(x, z);
  k.color(C('#b9b4aa'));
  for (const dx of [-0.7, 0.7]) k.box('concrete', x + dx, y + 0.2, z, 0.25, 0.4, 0.45);
  k.color(C('#9a6e44'));
  for (let q = 0; q < 4; q++) k.box('wood', x, y + 0.43, z - 0.18 + q * 0.12, 1.9, 0.05, 0.09);
  env.fence?.(x - 0.95, z, x + 0.95, z, 0.3);
}
function planter(k, env, x0, x1, z, palm = true) {
  const y = env.gy((x0 + x1) / 2, z);
  k.color(C('#cfcac0')); k.box('concrete', (x0 + x1) / 2, y + 0.22, z, x1 - x0, 0.44, 2.6);
  k.color(C('#5b4a38')); k.box('dark', (x0 + x1) / 2, y + 0.43, z, x1 - x0 - 0.3, 0.04, 2.3);
  for (let x = x0 + 0.8; x < x1 - 0.5; x += 1.1) env.tree?.('shrub', x, z, 0.8, 0.6);
  env.fence?.(x0, z, x1, z, 1.3);
  if (palm) env.tree?.('b-palm', (x0 + x1) / 2, z, 1.15);
}
function stonePlate(k, env, x, z, s = 1) {
  const y = env.gy(x, z);
  k.color(C('#6f6c66')); k.box('concrete', x, y + 0.9 * s, z, 4.4 * s, 1.8 * s, 0.7);
  k.color(C('#ffffff')); k.face('lsPlate', [[x - 2 * s, y + 0.3 * s, z + 0.36], [x + 2 * s, y + 0.3 * s, z + 0.36], [x + 2 * s, y + 1.8 * s, z + 0.36], [x - 2 * s, y + 1.8 * s, z + 0.36]], [[0, 0], [1, 0], [1, 1], [0, 1]]);
  env.fence?.(x - 2.2 * s, z, x + 2.2 * s, z, 0.4);
}
// 門柱（コンクリートの柱に縦の銘板）と、両側の低い塀
function gatePost(k, env, x, z) {
  const y = env.gy(x, z);
  k.color(C('#d4d0c6')); k.box('concrete', x, y + 0.9, z, 0.7, 1.8, 0.5);
  k.color(C('#b8b4aa')); k.box('concrete', x, y + 1.84, z, 0.8, 0.08, 0.6);
  k.color(C('#ffffff')); k.face('lsGatePlate', [[x - 0.14, y + 0.3, z + 0.26], [x + 0.14, y + 0.3, z + 0.26], [x + 0.14, y + 1.42, z + 0.26], [x - 0.14, y + 1.42, z + 0.26]], [[0, 0], [1, 0], [1, 1], [0, 1]]);
  env.fence?.(x, z, x, z, 0.4);
}
function parkingLines(k, env, x0, n, pitch, z0, z1) {
  for (let q = 0; q <= n; q++) { const x = x0 + q * pitch; groundPatch(k, env, x - 0.05, z0, x + 0.05, z1, 'paint', C('#f4f4f0'), 0.045, 1); }
  k.at(env.M);
}
function bikeShelter(k, env, x0, x1, z, r) {
  k.at(env.M);
  k.color(C('#b9bec0'));
  for (const x of [x0, x1]) k.cyl('metal', x, env.gy(x, z), z, 0.06, 2.3, 8);
  k.color(C('#8fa6b0')); k.box('glass', (x0 + x1) / 2, env.gy(x0, z) + 2.35, z - 0.6, x1 - x0 + 0.6, 0.05, 2.2);
  env.fence?.(x0, z, x0, z, 0.1); env.fence?.(x1, z, x1, z, 0.1);
  const cols = ['#c8423a', '#2f5a9a', '#e8e4da', '#3a3a3a', '#6a8a4a', '#d8b02a', '#8a8e92'];
  let n = 0;
  for (let x = x0 + 0.7; x < x1 - 0.4; x += 0.72, n++) {
    if (n % 4 === 3) continue;
    bicycle(k, env.at(x, z - 1.1, Math.PI / 2 - 0.08 + (n % 3) * 0.05), C(cols[n % cols.length]), r);
  }
  k.at(env.M);
  env.fence?.(x0 + 0.3, z - 1.1, x1 - 0.3, z - 1.1, 0.8);
}
// 網とブイの山（最初の分室の横）
function netPile(k, env, x, z) {
  const y = env.gy(x, z);
  k.color(C('#2f6a4a')); k.geo('cloth', new THREE.SphereGeometry(1.0, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1.3, 0.55, 0.9), new THREE.Matrix4().setPosition(x, y, z));
  const cols = ['#e8732a', '#e8e4da', '#e8732a', '#d8b02a', '#e8e4da'];
  cols.forEach((c, q) => { k.color(C(c)); k.geo('plastic', new THREE.SphereGeometry(0.2, 12, 8), new THREE.Matrix4().setPosition(x + 1.5 + (q % 3) * 0.38, y + 0.2 + (q > 2 ? 0.32 : 0), z - 0.3 + (q % 2) * 0.35)); });
  // 魚箱（青いトロ箱の積み重ね）
  k.color(C('#3a78b8'));
  for (let q = 0; q < 4; q++) k.box('plastic', x - 1.9, y + 0.14 + q * 0.28, z + 0.2, 0.9, 0.26, 0.6);
  env.fence?.(x - 2.4, z, x + 2.4, z, 1.1);
}
// スチールの物置
function storage(k, env, x, z) {
  const y = env.gy(x, z);
  k.color(C('#d9d6c9')); k.box('paint', x, y + 1.05, z, 2.2, 2.1, 1.4);
  k.color(C('#6f8a78')); k.box('paint', x, y + 2.16, z, 2.35, 0.12, 1.55);
  k.color(C('#c6c2b4')); for (const dx of [-0.52, 0.52]) k.box('paint', x + dx, y + 1.0, z + 0.71, 1.0, 1.8, 0.02);
  k.color(C('#7d7f80')); k.box('metal', x, y + 1.0, z + 0.73, 0.04, 0.2, 0.03);
  env.solid?.([[x - 1.1, z - 0.7], [x + 1.1, z - 0.7], [x + 1.1, z + 0.7], [x - 1.1, z + 0.7]], y + 2.3);
}

function site(k, env, S, level, r) {
  const flat = (x0, z0, x1, z1, mat, col, lift = 0.03) => groundPatch(k, env, x0, z0, x1, z1, mat, col, lift, 2);
  const T = (kind, x, z, s) => env.tree?.(kind, x, z, s);
  surroundings(T);
  k.at(env.M);
  if (level === 1) {
    // 砂利の庭と、網・物置・軽トラ・自転車・木の看板
    flat(6, 0, 41, 12, 'fGravel', C('#d8d2c4'));
    flat(14.5, 12, 17.5, 16, 'fDirt', C('#c9bca4'));
    netPile(k, env, 8.5, -3);
    storage(k, env, 7.5, -8);
    car(k, env.at(24, 5.5, Math.PI / 2 + 0.08), () => 0.37, 'truck');
    env.solid?.([[21.8, 4.6], [26.2, 4.6], [26.2, 6.4], [21.8, 6.4]], 1.8);
    bicycle(k, env.at(19.6, 1.3, 0.1), C('#c8423a'), r);
    k.at(env.M);
    // 道ばたの立て看板（杭 2 本に縦の板）
    {
      const x = 13, z = 13.5, y = env.gy(x, z);
      k.color(C('#6a4a2e')); for (const dx of [-0.3, 0.3]) k.box('wood', x + dx, y + 1.1, z - 0.05, 0.1, 2.2, 0.1);
      // 看板の板（厚みのある箱。裏から見ても板が見えるように）。表の絵はその前に貼る
      k.color(C('#f2d6aa')); k.box('wood', x, y + 1.425, z - 0.01, 0.56, 1.9, 0.035);
      k.color(C('#ffffff')); k.face('lsWoodSign', [[x - 0.26, y + 0.5, z + 0.01], [x + 0.26, y + 0.5, z + 0.01], [x + 0.26, y + 2.35, z + 0.01], [x - 0.26, y + 2.35, z + 0.01]], [[0, 0], [1, 0], [1, 1], [0, 1]]);
      k.color(C('#8a6a48')); k.box('wood', x, y + 2.42, z, 0.7, 0.06, 0.14);
      env.fence?.(x - 0.4, z, x + 0.4, z, 0.2);
    }
    T('b-keyaki', 38, 12, 0.7);
    // 左の空き地（のちの本館の場所）は雑木林。砂利のへりは低木で隠す
    grove(T, -45, 4.5, -19, 14, 5.2, 11);
    for (const [x, z] of [[11, 10.5], [10, 11.4], [31, 1.2], [32, 2.0]]) T('shrub', x, z, 0.8);
    return;
  }
  if (level <= 5) {
    // コンクリートの前庭と駐車場、門柱、生垣
    const mx = (S.main.b.x0 + S.main.b.x1) / 2;
    if (level >= 4) {
      flat(S.main.b.x0 - 1, 0, mx - 7, 12.5, 'fConcrete', C('#c9c6be'));
      flat(mx - 7, 0, mx + 7, 12.5, 'fPaving', C('#e2dccf'));
      flat(mx + 7, 0, 41, 12.5, 'fConcrete', C('#c9c6be'));
    } else flat(S.main.b.x0 - 1, 0, 41, 12.5, 'fConcrete', C('#c9c6be'));
    flat(-1.5, 12.5, 4.5, 16, 'fConcrete', C('#c9c6be'));
    // 駐車場（本館と旧館の間）
    const nP = 4, px0 = -0.8;
    parkingLines(k, env, px0, nP, 2.6, 2.0, 7.2);
    const kinds = ['truck', 'kei', 'minivan', 'compact', 'kei'];
    for (let q = 0; q < Math.min(nP, level); q++) {
      const x = px0 + (q + 0.5) * 2.6;
      car(k, env.at(x, 4.6, q % 2 ? Math.PI : 0), () => (q * 0.37 + level * 0.11) % 1, kinds[q]);
      env.solid?.([[x - 0.85, 2.4], [x + 0.85, 2.4], [x + 0.85, 6.8], [x - 0.85, 6.8]], 1.7);
    }
    k.at(env.M);
    // 門柱と生垣（前の道ぞい。入口はあける）
    gatePost(k, env, -2.2, 14.6);
    gatePost(k, env, 5.2, 14.6);
    for (let x = S.main.b.x0; x < 40.5; x += 1.0) if (x < -2.8 || x > 5.8) T('shrub', x, 14.8, 0.9);
    // 外灯・植え込み・ベンチ
    if (level >= 3) for (const x of [mx - 6, mx + 6, 2]) { k.at(env.M); lamp(k, env, x, 12); }
    k.at(env.M);
    if (level >= 4) { planter(k, env, mx - 13, mx - 7.5, 8.5, false); planter(k, env, mx + 7.5, mx + 13, 8.5, false); bench(k, env, mx - 10, 10.5); bench(k, env, mx + 10, 10.5); }
    if (level >= 4) flagpoles(k, env, mx - 11, 5, level === 5 ? 3 : 1);
    if (level === 5) { stonePlate(k, env, mx + 10.5, 5.2, 0.8); bikeShelter(k, env, 22, 29, 5.0, r); }
    k.at(env.M);
    // 木: 本館の左の空き地は雑木林（コンクリートのへりは低木で隠す）
    grove(T, -45, S.main.b.x0 - 3, -19, 13.5, S.main.b.x0 - 1.8, 20 + level);
    if (level >= 3) T('b-cherry', mx, 20.5, 0.8);
    T('b-oak', 38.5, 12, 0.8);
    return;
  }
  // 6 階以上: lab.js と同じ整った前庭
  const A = S.main.b, B = S.annex.b, pz = 16;
  flat(A.x0 - 2, 0, B.x1 + 2, pz, 'fPaving', C('#e8e2d6'));
  flat(A.x1 + 0.5, -17, B.x0 - 0.5, 0, 'fPaving', C('#ddd6c8'));
  k.at(env.M);
  const ax = (A.x0 + A.x1) / 2, gx = (A.x1 + B.x0) / 2;
  for (const [x0, x1] of [[A.x0 + 1, A.x0 + 12], [A.x1 - 11, A.x1 - 1], [B.x0 + 1, B.x0 + 11]]) planter(k, env, x0, x1, pz - 5);
  if (B.x1 - B.x0 > 26) planter(k, env, B.x1 - 11, B.x1 - 1, pz - 5);
  for (const x of [A.x0 + 2, B.x1 - 2]) T('b-keyaki', x, pz - 1.5, 0.9);
  flagpoles(k, env, ax - 12, pz - 3);
  if (!S.hall) stonePlate(k, env, gx, pz - 2.5); else stonePlate(k, env, ax + 12, pz - 3, 0.9);
  bikeShelter(k, env, B.x0 + 14, B.x0 + 23, pz - 1.5, r);
  k.at(env.M);
  for (const x of [A.x0 + 7, A.x0 + 20, ax + 10, B.x0 + 4, B.x1 - 7]) bench(k, env, x, pz - 3.2);
  k.color(C('#c8ccce'));
  for (let x = A.x0; x <= B.x1 + 0.01; x += 2.4) {
    if (Math.abs(x - ax) < 5 || Math.abs(x - gx) < 3.5) continue;
    const z = pz - 0.5, y = env.gy(x, z);
    k.color(C('#c8ccce'));
    k.cyl('metal', x, y, z, 0.075, 0.78, 12);
    k.geo('metal', new THREE.SphereGeometry(0.075, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.Matrix4().setPosition(x, y + 0.78, z));
    k.color(C('#e0a02a')); k.cyl('paint', x, y + 0.62, z, 0.078, 0.05, 12);
    env.fence?.(x, z, x, z, 0.1);
  }
  for (let x = A.x0 + 1; x <= B.x1; x += 12) lamp(k, env, x, pz - 0.9);
  // 研究船の錨（8 階から）
  if (level >= 8) {
    const x = gx + 6.5, z = pz - 2.4, y = env.gy(x, z);
    k.color(C('#9a978f')); k.box('concrete', x, y + 0.2, z, 1.8, 0.4, 1.2);
    k.color(C('#3a3634'));
    const rot = new THREE.Matrix4().makeRotationY(0.35);
    const TT = (px, py, pz2) => new THREE.Matrix4().multiplyMatrices(new THREE.Matrix4().makeTranslation(x, y + 0.4, z), rot).multiply(new THREE.Matrix4().makeTranslation(px, py, pz2));
    k.geo('metal', new THREE.CylinderGeometry(0.07, 0.09, 2.2, 10), TT(0, 1.25, 0));
    k.geo('metal', new THREE.TorusGeometry(0.16, 0.035, 8, 18), TT(0, 2.45, 0));
    k.geo('metal', new THREE.CylinderGeometry(0.04, 0.04, 1.0, 8).rotateZ(Math.PI / 2), TT(0, 2.05, 0));
    k.geo('metal', new THREE.TorusGeometry(0.62, 0.06, 8, 24, Math.PI).rotateZ(Math.PI), TT(0, 0.78, 0));
    for (const s of [-1, 1]) k.geo('metal', new THREE.ConeGeometry(0.12, 0.3, 4).rotateZ(-s * 0.5), TT(s * 0.62, 0.86, 0));
    env.fence?.(x - 0.9, z, x + 0.9, z, 0.6);
  }
  // 職員の駐車場（実験棟の前の右）
  {
    const x0 = B.x1 - 14.8, n = 5;
    parkingLines(k, env, x0, n, 2.8, 1.2, 6.6);
    const kinds = ['minivan', 'kei', 'compact', 'kei', 'truck'];
    for (let q = 0; q < n - (level % 2); q++) {
      const x = x0 + (q + 0.5) * 2.8;
      car(k, env.at(x, 3.9, q % 2 ? Math.PI : 0), () => (q * 0.37 + level * 0.13) % 1, kinds[q]);
      env.solid?.([[x - 0.85, 1.7], [x + 0.85, 1.7], [x + 0.85, 6.1], [x - 0.85, 6.1]], 1.7);
    }
    k.at(env.M);
  }
}

// 小さいうちの空き地の雑木林: x0..x1・z0..z1 に木をむらのある格子で植え、舗装のへり（edgeX）には低木を並べて地面の色の境目を隠す
function grove(T, x0, x1, z0, z1, edgeX = null, seed = 1) {
  let q = seed * 9301 + 49297;
  const rnd = () => ((q = (q * 16807) % 2147483647) / 2147483647);
  const step = 5.0;
  for (let z = z0 + 2; z <= z1 - 1; z += step) for (let x = x0 + 2; x <= x1 - 1.5; x += step) {
    if (rnd() < 0.08) continue; // ところどころ空き（木漏れ日の抜け）
    const px = Math.min(x1 - 1.5, x + (rnd() - 0.5) * 3.2), pz = Math.min(z1 - 1, z + (rnd() - 0.5) * 3.2);
    const back = pz < -7, u = rnd();
    // 奥は杉を混ぜて背を高く、手前は広葉樹（コナラ・ケヤキ）
    const kind = back && u < 0.55 ? 'b-sugi' : u < 0.7 ? 'b-oak' : 'b-keyaki';
    T(kind, px, pz, kind === 'b-sugi' ? 0.85 + rnd() * 0.3 : kind === 'b-keyaki' ? 0.65 + rnd() * 0.2 : 0.75 + rnd() * 0.3);
    // 下草の低木
    if (rnd() < 0.6) T('shrub', px + (rnd() - 0.5) * 4, pz + (rnd() - 0.5) * 4, 0.8 + rnd() * 0.5);
  }
  if (edgeX !== null) for (let z = z0 + 1; z <= z1; z += 1.6 + rnd() * 0.8) T('shrub', edgeX + (rnd() - 0.5) * 0.6, z, 0.85 + rnd() * 0.45);
}

// 敷地のまわりの背の高い木（前の道の向こうの桜並木と、両脇のケヤキ）。どの段階でも同じ
// （ファストトラベルで降りる所 x = -12 の前後はあけて、カメラが枝に入らないように）
function surroundings(T) {
  const X0 = -41, X1 = 41, pz = 16;
  for (let x = X0 - 4, q = 0; x <= X1 + 4; x += 11, q++) if (Math.abs(x + 12) > 9) T('b-cherry', x + (q % 2) * 1.5, pz + 17 + (q % 3) * 0.8, 0.85 + (q % 3) * 0.08);
  for (const [x, z] of [[X0 - 14, -4], [X1 + 14, -2], [X0 - 20, 8], [X1 + 18, 10]]) T('b-keyaki', x, z, 0.85);
}

// ---------- 組み立て ----------
export function buildLabStage(k, env, level = 1, r = Math.random) {
  level = Math.max(1, Math.min(10, level | 0));
  const S = LAB_STAGES[level];
  stageMats(k);
  env.chunk?.(0, 0);
  let ent = null;
  if (S.hut) {
    hut(k, env, HUT);
    if (level === 1) ent = [HUT.x0 + 4.05, 3];
  }
  if (S.main) {
    const e = mainBuilding(k, env, S, level);
    ent = [e.ex, e.ez + (level >= 6 ? 10 : 6)];
  }
  if (S.annex) annexBuilding(k, env, S);
  for (const f of S.bridges || []) bridge(k, env, S.main.b.x1, S.annex.b.x0, f);
  if (S.hall) hall(k, env, S.main.b.x1, S.annex.b.x0);
  // 屋外の水槽（最初は丸い FRP 水槽 2 基から、上屋付きの水槽場へ）
  k.at(env.M);
  const tankCols = [C('#2f6f9f'), C('#3d86b0'), C('#2f6f9f'), C('#5a9ac0'), C('#2f6f9f'), C('#3d86b0')];
  const spots = S.annex ? [[38, -3.5], [38, -8.5], [38, -13.5]] : [[34.5, -3.5], [34.5, -8.5], [38.8, -3.5], [38.8, -8.5], [34.5, -13.5], [38.8, -13.5]];
  if (S.tanks) groundPatch(k, env, S.annex ? 35.8 : 32, -16, 41, 0, 'fConcrete', C('#c4c1b8'), 0.03, 2);
  if (S.rect) groundPatch(k, env, level >= 3 ? 12 : 16, -16, level >= 3 ? 30 : 26, -10.6, 'fConcrete', C('#c4c1b8'), 0.03, 2);
  for (let q = 0; q < (S.tanks || 0); q++) {
    const [x, z] = spots[q];
    roundTank(k, x, z, env.gy(x, z), S.annex ? 1.5 : 1.55, 1.1, tankCols[q]);
    env.solid?.([[x - 1.7, z - 1.7], [x + 1.7, z - 1.7], [x + 1.7, z + 1.7], [x - 1.7, z + 1.7]], 1.6);
  }
  if (S.shed) tankShed(k, 32.2, 41, -16, -1.2);
  if (S.rect) {
    rectTank(k, 21, -13.4, level >= 3 ? 16 : 8, 3.6, 0.9);
    env.solid?.([[level >= 3 ? 13 : 17, -15.2], [level >= 3 ? 29 : 25, -15.2], [level >= 3 ? 29 : 25, -11.6], [level >= 3 ? 13 : 17, -11.6]], 1);
  }
  site(k, env, S, level, r);
  return { entrance: ent, level };
}
