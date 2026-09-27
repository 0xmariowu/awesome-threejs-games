// 水産研究所: 8 階建ての研究棟を 2 棟並べる（本館 = ガラスのカーテンウォールと縦フィン、実験棟 = 白い格子の外壁と庇）。
// 3 階の渡り廊下、屋上の排気筒・冷却塔・観測マスト、前庭（舗装・旗・植え込み・案内の石碑）
// ローカル座標: 原点 = 2 棟の間の前面の中心（y = 0 は基準の地面）、+z = 正面（前庭の側）
import * as THREE from 'three';
import { C, wallFrame, holeyWall, canvasTex, needMat, groundPatch } from './build.js';
import { flatMaterials } from '../lots.js';
import { car, bicycle } from './props.js';

export const FH = 3.9, FLOORS = 8;
export const LAB = {
  A: { x0: -41, x1: -1, z0: -17, z1: 0 },   // 本館
  B: { x0: 9, x1: 41, z0: -17, z1: 0 },     // 実験棟
  plaza: 16,                                 // 前庭の奥行き
};
const HT = FH * FLOORS;

function labMats(k) {
  needMat(k, 'labLetters', () => new THREE.MeshStandardMaterial({
    map: canvasTex('labLetters', 2048, 256, (g, w, h) => {
      g.clearRect(0, 0, w, h);
      g.fillStyle = '#1d3a63'; g.font = '900 170px "Zen Kaku Gothic New", "Yu Gothic", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('吉山水産研究所', w / 2 + 110, h / 2 + 8);
      // 波と魚の紋
      g.strokeStyle = '#1d6fa8'; g.lineWidth = 16;
      g.beginPath(); g.arc(250, h / 2, 96, 0, Math.PI * 2); g.stroke();
      g.fillStyle = '#1d6fa8';
      g.beginPath(); g.moveTo(180, h / 2 + 10); g.quadraticCurveTo(250, h / 2 - 60, 320, h / 2 + 10); g.lineTo(340, h / 2 - 20); g.lineTo(340, h / 2 + 40); g.lineTo(320, h / 2 + 10); g.quadraticCurveTo(250, h / 2 + 60, 180, h / 2 + 10); g.fill();
      g.fillStyle = '#fff'; g.beginPath(); g.arc(215, h / 2 + 2, 8, 0, Math.PI * 2); g.fill();
    }, ['900 170px "Zen Kaku Gothic New"']),
    transparent: false, alphaTest: 0.5, roughness: 0.35, metalness: 0.3, vertexColors: true,
  }));
  needMat(k, 'labPlate', () => new THREE.MeshStandardMaterial({
    map: canvasTex('labPlate', 1024, 384, (g, w, h) => {
      g.fillStyle = '#2b2d2f'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 3000; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * 0.05})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
      g.fillStyle = '#e8e2d2'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = '900 120px "Zen Old Mincho", "Yu Mincho", serif'; g.fillText('吉山水産研究所', w / 2, h * 0.42);
      g.font = '700 38px "Zen Kaku Gothic New", sans-serif'; g.fillText('YOSHIYAMA FISHERIES RESEARCH INSTITUTE', w / 2, h * 0.78);
    }, ['900 120px "Zen Old Mincho"', '700 38px "Zen Kaku Gothic New"']),
    roughness: 0.4, metalness: 0.2, vertexColors: true,
  }));
  Object.assign(k.mats, flatMaterials(), { ...k.mats });
}

// ---------- 本館: 帯状のガラスと、白い腰の帯、縦のアルミフィン ----------
function curtainWall(k, m, L, { lobby = null } = {}) {
  k.at(m);
  const pier = 1.4;
  // 両端の袖壁（石張り風）
  k.color(C('#d8d6cf'));
  for (const x of [pier / 2, L - pier / 2]) k.box('concrete', x, HT / 2, 0.15, pier, HT, 0.3);
  const x0 = pier, x1 = L - pier, n = Math.max(1, Math.round((x1 - x0) / 1.5)), st = (x1 - x0) / n;
  for (let f = 0; f < FLOORS; f++) {
    const y0 = f * FH, lob = lobby && f === 0;
    const gy1 = y0 + FH - (lob ? 0.6 : 0.85);
    // ガラス（少しずつ色を変えた縦の区画）
    for (let q = 0; q < n; q++) {
      const a = x0 + q * st, b = a + st;
      const inLobby = lob && a >= lobby[0] - 0.01 && b <= lobby[1] + 0.01;
      const tint = inLobby ? C('#50646c') : C('#1c3442').offsetHSL(0, 0, ((q * 7 + f * 3) % 5) * 0.01 - 0.015);
      k.color(tint);
      k.face(lob ? 'windowLobby' : 'windowOffice', [[a, y0 + 0.05, -0.12], [b, y0 + 0.05, -0.12], [b, gy1, -0.12], [a, gy1, -0.12]], [[a, 0.05], [b, 0.05], [b, gy1 - y0], [a, gy1 - y0]]);
      k.color(C('#9ea6aa'));
      k.box('metal', a, (y0 + gy1) / 2, -0.07, 0.06, gy1 - y0, 0.12);
      if (!lob) k.box('metal', (a + b) / 2, y0 + 1.0, -0.08, st, 0.05, 0.08);
    }
    // 腰の帯（白いパネル）
    k.color(C('#eceeec'));
    k.box('concrete', (x0 + x1) / 2, (gy1 + y0 + FH) / 2, 0.0, x1 - x0, y0 + FH - gy1, 0.2);
    k.color(C('#b9bec0'));
    k.box('metal', (x0 + x1) / 2, gy1 + 0.02, 0.03, x1 - x0, 0.04, 0.24);
  }
  // 縦のフィン（3 m ごと）
  k.color(C('#c4c9cb'));
  for (let x = x0 + st * 2; x < x1 - 0.5; x += st * 2) k.box('metal', x, (FH + HT) / 2 + 0.3, 0.42, 0.12, HT - FH + 0.6, 0.8);
  // パラペット
  k.color(C('#e3e4e0')); k.box('concrete', L / 2, HT + 0.6, 0.1, L, 1.2, 0.35);
  k.color(C('#9aa0a2')); k.box('metal', L / 2, HT + 1.22, 0.1, L + 0.05, 0.05, 0.4);
}

// ---------- 実験棟: 白い格子（深い窓）と、窓ごとの水平の庇 ----------
function gridWall(k, m, L, { stair = false } = {}) {
  k.at(m);
  const bay = 2.4, n = Math.max(1, Math.floor(L / bay)), st = L / n;
  const holes = [];
  for (let f = 0; f < FLOORS; f++) {
    const y0 = f * FH;
    for (let q = 0; q < n; q++) {
      if (stair && q === n - 1) continue;
      const cx = st * (q + 0.5), w = f === 0 ? st - 0.5 : 1.7;
      holes.push({ x0: cx - w / 2, x1: cx + w / 2, y0: y0 + (f === 0 ? 0.1 : 0.85), y1: y0 + FH - 0.75 });
    }
  }
  if (stair) holes.push({ x0: L - st + 0.35, x1: L - 0.35, y0: 0.6, y1: HT - 0.6 });
  k.color(C('#f1f0eb'));
  holeyWall(k, 'concrete', L, 0, HT, holes, 0.4);
  for (const h of holes) {
    const tall = h.y1 - h.y0 > FH;
    k.color(tall ? C('#6f8791') : C('#34505e'));
    const fy = tall ? 0 : Math.floor(h.y0 / FH) * FH;
    k.face(tall ? 'glass' : 'windowOffice', [[h.x0, h.y0, -0.34], [h.x1, h.y0, -0.34], [h.x1, h.y1, -0.34], [h.x0, h.y1, -0.34]], [[h.x0, h.y0 - fy], [h.x1, h.y0 - fy], [h.x1, h.y1 - fy], [h.x0, h.y1 - fy]]);
    k.color(C('#a3aaae'));
    k.box('metal', (h.x0 + h.x1) / 2, h.y0 + 0.02, -0.3, h.x1 - h.x0, 0.04, 0.1);
    if (tall) {
      // 階段室: 踊り場のスラブが透けて見える
      k.color(C('#d8d8d2'));
      for (let y = FH * 0.5; y < HT - 1; y += FH / 2) k.box('concrete', (h.x0 + h.x1) / 2, y, -0.9, h.x1 - h.x0, 0.18, 1.0);
      k.color(C('#a3aaae'));
      for (let y = h.y0 + FH; y < h.y1; y += FH) k.box('metal', (h.x0 + h.x1) / 2, y, -0.3, h.x1 - h.x0, 0.05, 0.08);
      continue;
    }
    k.box('metal', (h.x0 + h.x1) / 2, h.y0 + (h.y1 - h.y0) * 0.62, -0.3, h.x1 - h.x0, 0.04, 0.06);
    k.box('metal', (h.x0 + h.x1) / 2, (h.y0 + h.y1) / 2, -0.3, 0.04, h.y1 - h.y0, 0.06);
    // 庇（アルミのルーバー）
    k.color(C('#a7afb3'));
    for (const dy of [0.12, 0.3]) k.box('metal', (h.x0 + h.x1) / 2, h.y1 + dy, 0.35, h.x1 - h.x0 + 0.3, 0.04, 0.6);
  }
  // 階ごとの目地
  k.color(C('#d9d8d2'));
  for (let f = 1; f <= FLOORS; f++) k.box('concrete', L / 2, f * FH - 0.05, 0.02, L, 0.08, 0.05);
  k.color(C('#e9e8e3')); k.box('concrete', L / 2, HT + 0.6, 0.1, L, 1.2, 0.35);
  k.color(C('#9aa0a2')); k.box('metal', L / 2, HT + 1.22, 0.1, L + 0.05, 0.05, 0.4);
}

// 屋上: 防水面・機械室・冷却塔・排気筒・観測マスト
function rooftop(k, M, b, r, { stacks = 0, towers = 0, mast = false, solar = false } = {}) {
  k.at(M);
  const w = b.x1 - b.x0, d = b.z1 - b.z0, cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2;
  k.color(C('#9b9a94')); k.box('concrete', cx, HT + 0.05, cz, w - 0.3, 0.1, d - 0.3);
  // 機械室（ペントハウス）
  k.color(C('#e6e6e1')); k.box('concrete', cx - w * 0.12, HT + 2.1, cz - 1, w * 0.3, 4.2, d * 0.45);
  k.color(C('#b4b8ba')); k.box('metal', cx - w * 0.12, HT + 4.25, cz - 1, w * 0.3 + 0.3, 0.1, d * 0.45 + 0.3);
  k.color(C('#8e9496'));
  for (let q = 0; q < 4; q++) k.box('metal', cx - w * 0.12 - w * 0.11 + q * w * 0.075, HT + 2.2, cz - 1 + d * 0.225 + 0.02, w * 0.05, 1.6, 0.05);
  // 冷却塔
  for (let q = 0; q < towers; q++) {
    const x = cx + w * 0.14 + q * 4.2, z = cz + 2.5;
    k.color(C('#d3d7d8')); k.box('metal', x, HT + 1.4, z, 3.4, 2.6, 3.4);
    k.color(C('#8a9194')); k.cyl('metal', x, HT + 2.7, z, 1.2, 0.8, 18);
    k.color(C('#3d4245')); k.cyl('dark', x, HT + 3.5, z, 1.05, 0.02, 18);
    k.color(C('#a7adb0')); for (let s = 0; s < 3; s++) k.box('metal', x, HT + 0.6 + s * 0.6, z + 1.72, 3.2, 0.05, 0.05);
  }
  // 実験室の排気筒（研究所らしい細い煙突の列）
  for (let q = 0; q < stacks; q++) {
    const x = b.x0 + 3 + q * ((w - 6) / Math.max(1, stacks - 1)), z = b.z0 + 2.5;
    const h = 4.5 + (q % 3) * 0.6;
    k.color(C('#c9cdcf')); k.cyl('metal', x, HT, z, 0.35, h, 14, 0.3);
    k.color(C('#6f7578')); k.cyl('metal', x, HT + h, z, 0.33, 0.12, 14);
    k.color(C('#9aa0a2')); k.rod('metal', [x, HT + h * 0.7, z], [x, HT, z + 1.4], 0.05);
  }
  // 太陽光パネル
  if (solar) {
    k.color(C('#1f2c4a'));
    for (let q = 0; q < 4; q++) {
      const x = b.x0 + 3 + q * 2.4;
      const g = new THREE.BoxGeometry(2.1, 0.05, 3.6).rotateX(-0.35);
      k.geo('glass', g, new THREE.Matrix4().setPosition(x, HT + 0.9, cz + d * 0.3));
    }
  }
  // 観測マスト（風向風速計・アンテナ）
  if (mast) {
    const x = b.x1 - 3, z = cz - 3;
    k.color(C('#d7dbdc'));
    k.rod('metal', [x, HT, z], [x, HT + 12, z], 0.12);
    for (let y = HT + 1; y < HT + 12; y += 1.2) k.rod('metal', [x - 0.3, y, z], [x + 0.3, y + 0.6, z], 0.03);
    k.color(C('#c8342c')); k.box('paint', x, HT + 12.1, z, 0.3, 0.2, 0.3);
    k.color(C('#e0e3e4'));
    k.rod('metal', [x - 0.9, HT + 11, z], [x + 0.9, HT + 11, z], 0.05);
    for (const s of [-1, 1]) {
      k.geo('plastic', new THREE.SphereGeometry(0.1, 8, 6), new THREE.Matrix4().setPosition(x + s * 0.9, HT + 11.25, z + 0.15));
      k.rod('metal', [x + s * 0.9, HT + 11, z], [x + s * 0.9, HT + 11.25, z], 0.03);
    }
    k.geo('plastic', new THREE.ConeGeometry(0.12, 0.5, 8).rotateZ(Math.PI / 2), new THREE.Matrix4().setPosition(x, HT + 11.6, z));
    k.color(C('#f0f0ec')); k.geo('plastic', new THREE.SphereGeometry(0.9, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(-Math.PI / 2 + 0.6), new THREE.Matrix4().setPosition(x - 3.5, HT + 1.4, z + 1));
    k.color(C('#9aa0a2')); k.rod('metal', [x - 3.5, HT, z + 1], [x - 3.5, HT + 1.2, z + 1], 0.1);
  }
  void r;
}

export function buildLab(k, env, r = Math.random) {
  labMats(k);
  const M = env.M;
  env.chunk?.(0, 0);
  // 基礎（地面の低いところまで下ろす）
  let gmin = 0;
  for (const b of [LAB.A, LAB.B]) for (const [x, z] of [[b.x0, b.z0], [b.x1, b.z0], [b.x0, b.z1], [b.x1, b.z1]]) gmin = Math.min(gmin, env.gy(x, z));
  k.at(M);
  for (const b of [LAB.A, LAB.B]) {
    k.color(C('#9d9b94'));
    k.box('concrete', (b.x0 + b.x1) / 2, (gmin - 1 + 0.15) / 2, (b.z0 + b.z1) / 2, b.x1 - b.x0 + 0.4, 0.15 - gmin + 1, b.z1 - b.z0 + 0.4);
  }
  // ---------- 本館 ----------
  {
    const b = LAB.A;
    const sides = [[b.x0, b.z1, b.x1, b.z1, 'front'], [b.x1, b.z1, b.x1, b.z0, 'right'], [b.x1, b.z0, b.x0, b.z0, 'back'], [b.x0, b.z0, b.x0, b.z1, 'left']];
    for (const [ax, az, bx, bz, side] of sides) {
      const { m, L } = wallFrame(M, ax, az, bx, bz, 0.15);
      curtainWall(k, m, L, { lobby: side === 'front' ? [L / 2 - 7, L / 2 + 7] : null });
    }
    // 屋上の文字（正面の最上階の帯の上）
    k.at(M);
    k.color(C('#ffffff'));
    const lx = (b.x0 + b.x1) / 2, ly = HT + 0.15 + 3.2, lz = b.z1 + 0.4, lw = 28, lh = lw / 8;
    k.face('labLetters', [[lx - lw / 2, ly, lz], [lx + lw / 2, ly, lz], [lx + lw / 2, ly + lh, lz], [lx - lw / 2, ly + lh, lz]], [[0, 0], [1, 0], [1, 1], [0, 1]]);
    k.color(C('#9aa0a2'));
    for (const dx of [-12, -4, 4, 12]) k.box('metal', lx + dx, HT + 0.15 + 2.2, lz - 0.2, 0.1, 2.2, 0.1);
    k.box('metal', lx, HT + 0.15 + 3.1, lz - 0.2, lw, 0.1, 0.1);
    // ---------- 玄関: 厚い庇（金属の鼻先・軒裏の照明）と、ガラスの風除室（自動ドア） ----------
    const ex = (b.x0 + b.x1) / 2, z0 = b.z1;
    needMat(k, 'glassClear', () => new THREE.MeshPhysicalMaterial({ color: '#dfeef2', transparent: true, opacity: 0.16, roughness: 0.04, metalness: 0, envMapIntensity: 1.4, depthWrite: false }));
    {
      const cw = 14, cd = 7.6, cy = 4.55, ct = 0.5;
      k.color(C('#eeefec')); k.box('concrete', ex, cy, z0 + cd / 2, cw, ct, cd, 31);
      // 軒裏（下の床の照り返しで明るい。地面の色の環境光で緑に濁らないよう、少し自分で光らせる）
      k.color(C('#d8d8d2')); k.face('glowV', [[ex - cw / 2, cy - ct / 2, z0], [ex + cw / 2, cy - ct / 2, z0], [ex + cw / 2, cy - ct / 2, z0 + cd], [ex - cw / 2, cy - ct / 2, z0 + cd]]);
      // 鼻先の金属の帯と、施設名の切り文字
      k.color(C('#c6cacc')); k.box('metal', ex, cy + 0.05, z0 + cd + 0.03, cw + 0.06, 0.72, 0.08);
      for (const s of [-1, 1]) k.box('metal', ex + s * (cw / 2 + 0.03), cy + 0.05, z0 + cd / 2, 0.08, 0.72, cd);
      k.color(C('#ffffff')); k.face('labLetters', [[ex - 3.4, cy - 0.28, z0 + cd + 0.08], [ex + 3.4, cy - 0.28, z0 + cd + 0.08], [ex + 3.4, cy + 0.57, z0 + cd + 0.08], [ex - 3.4, cy + 0.57, z0 + cd + 0.08]], [[0, 0], [1, 0], [1, 1], [0, 1]]);
      // 軒裏のダウンライト
      k.color(C('#fffaf0'));
      for (let x = -5; x <= 5.01; x += 2.5) for (const z of [2.2, 4.4, 6.6]) k.cyl('lamp', ex + x, cy - ct / 2 - 0.012, z0 + z, 0.1, 0.012, 12);
      // 柱（石張りの角柱）
      for (const s of [-1, 1]) {
        k.color(C('#d8d6cf')); k.box('concrete', ex + s * 5.6, (0.15 + cy) / 2, z0 + cd - 0.8, 0.5, cy - 0.15, 0.5);
        env.fence?.(ex + s * 5.6, z0 + cd - 0.8, ex + s * 5.6, z0 + cd - 0.8, 0.3);
      }
    }
    // 風除室: 6.4 × 2.8 m、高さ 3.1 m のガラスの箱
    {
      const vw = 6.4, vd = 2.8, y0 = 0.15, y1 = y0 + 3.1, xa = ex - vw / 2, xb = ex + vw / 2, zf = z0 + vd;
      k.color(C('#5d6264')); k.box('dark', ex, y0 + 0.012, z0 + vd / 2, vw - 0.1, 0.02, vd - 0.1); // 足ふきマット
      k.color(C('#ffffff'));
      k.face('glassClear', [[xa, y0, zf], [xb, y0, zf], [xb, y1, zf], [xa, y1, zf]]);
      k.face('glassClear', [[xb, y0, zf], [xb, y0, z0], [xb, y1, z0], [xb, y1, zf]]);
      k.face('glassClear', [[xa, y0, z0], [xa, y0, zf], [xa, y1, zf], [xa, y1, z0]]);
      k.color(C('#e9eae6')); k.box('concrete', ex, y1 + 0.15, z0 + vd / 2, vw + 0.1, 0.3, vd + 0.05);
      k.color(C('#a9aeb0'));
      // 枠: 四隅・方立・無目
      for (const [x, z] of [[xa, zf], [xb, zf], [xa, z0 + 0.05], [xb, z0 + 0.05]]) k.box('metal', x, (y0 + y1) / 2, z, 0.1, y1 - y0, 0.1);
      for (const x of [ex - 1.6, ex + 1.6]) k.box('metal', x, (y0 + y1) / 2, zf, 0.08, y1 - y0, 0.1);
      k.box('metal', ex, y0 + 2.4, zf, vw, 0.12, 0.12);
      for (const s of [-1, 1]) { k.box('metal', s > 0 ? xb : xa, y0 + 2.4, z0 + vd / 2, 0.1, 0.1, vd); k.box('metal', s > 0 ? xb : xa, y0 + 0.05, z0 + vd / 2, 0.1, 0.1, vd); }
      // 自動ドア（2 枚。框だけ見せる）と上の機械のカバー
      for (const [a0, a1] of [[ex - 1.55, ex - 0.02], [ex + 0.02, ex + 1.55]]) {
        for (const x of [a0 + 0.03, a1 - 0.03]) k.box('metal', x, y0 + 1.2, zf - 0.08, 0.05, 2.3, 0.05);
        k.box('metal', (a0 + a1) / 2, y0 + 0.05, zf - 0.08, a1 - a0, 0.08, 0.05);
        k.box('metal', (a0 + a1) / 2, y0 + 2.33, zf - 0.08, a1 - a0, 0.06, 0.05);
      }
      k.color(C('#8d9396')); k.box('metal', ex, y0 + 2.6, zf - 0.1, 3.3, 0.3, 0.2);
      k.color(C('#2e7a4a')); k.box('plastic', ex + 2.4, y0 + 2.15, zf + 0.03, 0.5, 0.18, 0.02); // 非常口
      // 奥の本当の入口（ロビーのガラス戸）
      k.color(C('#7d8a90')); k.face('windowLobby', [[ex - 1.5, y0 + 0.05, z0 + 0.03], [ex + 1.5, y0 + 0.05, z0 + 0.03], [ex + 1.5, y0 + 2.4, z0 + 0.03], [ex - 1.5, y0 + 2.4, z0 + 0.03]], [[ex - 1.5, 0.05], [ex + 1.5, 0.05], [ex + 1.5, 2.4], [ex - 1.5, 2.4]]);
      env.fence?.(xa, zf, xb, zf, 0.15);
      env.fence?.(xa, z0, xa, zf, 0.15);
      env.fence?.(xb, z0, xb, zf, 0.15);
    }
    rooftop(k, new THREE.Matrix4().copy(M).multiply(new THREE.Matrix4().makeTranslation(0, 0.15, 0)), b, r, { towers: 3, mast: true });
  }
  // ---------- 実験棟 ----------
  {
    const b = LAB.B;
    const sides = [[b.x0, b.z1, b.x1, b.z1, 'front'], [b.x1, b.z1, b.x1, b.z0, 'right'], [b.x1, b.z0, b.x0, b.z0, 'back'], [b.x0, b.z0, b.x0, b.z1, 'left']];
    for (const [ax, az, bx, bz, side] of sides) {
      const { m, L } = wallFrame(M, ax, az, bx, bz, 0.15);
      gridWall(k, m, L, { stair: side === 'front' || side === 'back' });
    }
    rooftop(k, new THREE.Matrix4().copy(M).multiply(new THREE.Matrix4().makeTranslation(0, 0.15, 0)), b, r, { stacks: 9, towers: 1, solar: true });
  }
  // ---------- 渡り廊下（3 階） ----------
  k.at(M);
  {
    const xa = LAB.A.x1, xb = LAB.B.x0, zc = -8, y0 = 0.15 + FH * 2, y1 = y0 + FH;
    k.color(C('#eceeec'));
    k.box('concrete', (xa + xb) / 2, y0 + 0.5, zc, xb - xa, 1.0, 4.4);
    k.box('concrete', (xa + xb) / 2, y1 - 0.3, zc, xb - xa, 0.6, 4.4);
    k.color(C('#3d5866'));
    for (const s of [1, -1]) k.face('glass', s > 0 ? [[xa, y0 + 1, zc + 2.2], [xb, y0 + 1, zc + 2.2], [xb, y1 - 0.6, zc + 2.2], [xa, y1 - 0.6, zc + 2.2]] : [[xb, y0 + 1, zc - 2.2], [xa, y0 + 1, zc - 2.2], [xa, y1 - 0.6, zc - 2.2], [xb, y1 - 0.6, zc - 2.2]]);
    k.color(C('#b9bec0'));
    for (let x = xa + 1.25; x < xb; x += 1.25) for (const s of [1, -1]) k.box('metal', x, (y0 + y1) / 2 + 0.2, zc + s * 2.22, 0.06, y1 - y0 - 1.6, 0.06);
  }
  // ---------- 前庭 ----------
  const pz = LAB.plaza;
  const flat = (x0, z0, x1, z1, mat, col, lift = 0.03) => groundPatch(k, env, x0, z0, x1, z1, mat, col, lift, 2);
  flat(LAB.A.x0 - 2, 0, LAB.B.x1 + 2, pz, 'fPaving', C('#e8e2d6'));
  flat(LAB.A.x1 + 0.5, -17, LAB.B.x0 - 0.5, 0, 'fPaving', C('#ddd6c8'));
  k.at(M);
  // 植え込み（低い縁石の中に）と、ヤシ・ケヤキ
  for (const [x0, x1] of [[LAB.A.x0 + 1, LAB.A.x0 + 13], [LAB.A.x1 - 12, LAB.A.x1 - 1], [LAB.B.x0 + 1, LAB.B.x0 + 12], [LAB.B.x1 - 12, LAB.B.x1 - 1]]) {
    const z = pz - 5, y = env.gy((x0 + x1) / 2, z);
    k.color(C('#cfcac0')); k.box('concrete', (x0 + x1) / 2, y + 0.22, z, x1 - x0, 0.44, 2.6);
    k.color(C('#5b4a38')); k.box('dark', (x0 + x1) / 2, y + 0.43, z, x1 - x0 - 0.3, 0.04, 2.3);
    for (let x = x0 + 0.8; x < x1 - 0.5; x += 1.1) env.tree?.('shrub', x, z, 0.8, 0.6);
    env.fence?.(x0, z, x1, z, 1.3);
    env.tree?.('b-palm', (x0 + x1) / 2, z, 1.15);
  }
  for (const x of [LAB.A.x0 + 2, LAB.B.x1 - 2]) env.tree?.('b-keyaki', x, pz - 1.5, 0.9);
  // 芝生の並木（前庭から少し離して桜を一列）と、横の芝生のケヤキ
  // （ファストトラベルで降りる所 x = -12 の前後はあけて、カメラが枝に入らないように）
  for (let x = LAB.A.x0 - 4, q = 0; x <= LAB.B.x1 + 4; x += 11, q++) if (Math.abs(x + 12) > 9) env.tree?.('b-cherry', x + (q % 2) * 1.5, pz + 17 + (q % 3) * 0.8, 0.85 + (q % 3) * 0.08);
  for (const [x, z] of [[LAB.A.x0 - 14, -4], [LAB.A.x0 - 20, 8], [LAB.B.x1 + 14, -2], [LAB.B.x1 + 18, 10]]) env.tree?.('b-keyaki', x, z, 0.85);
  // 旗竿 3 本
  for (const [dx, col] of [[-3, '#ffffff'], [0, '#1d6fa8'], [3, '#ffffff']]) {
    const x = (LAB.A.x0 + LAB.A.x1) / 2 + dx - 12, z = pz - 3, y = env.gy(x, z);
    k.color(C('#d0d4d6')); k.cyl('metal', x, y, z, 0.07, 10, 10, 0.05);
    k.color(C('#b5b9bb')); k.geo('metal', new THREE.SphereGeometry(0.12, 10, 6), new THREE.Matrix4().setPosition(x, y + 10.05, z));
    // 旗: 風にはためくしわを形に焼き込む（竿から離れるほど大きく波打ち、先が少し垂れる）
    const fg = new THREE.PlaneGeometry(1.85, 1.3, 14, 2);
    { const P = fg.attributes.position; for (let i = 0; i < P.count; i++) { const u = (P.getX(i) + 0.925) / 1.85; P.setZ(i, Math.sin(u * 7.5 + dx) * 0.12 * u); P.setY(i, P.getY(i) - u * u * 0.12); } fg.computeVertexNormals(); }
    k.color(C(col)); k.geo('cloth', fg, new THREE.Matrix4().setPosition(x + 0.975, y + 9.05, z));
    if (dx === 0) { const eg = new THREE.CircleGeometry(0.26, 20); const P = eg.attributes.position; for (let i = 0; i < P.count; i++) { const u = (P.getX(i) + 0.925) / 1.85 + 0.5; P.setZ(i, Math.sin(u * 7.5 + dx) * 0.12 * u + 0.012); } k.color(C('#e8f0f6')); k.geo('cloth', eg, new THREE.Matrix4().setPosition(x + 0.975, y + 9.02, z)); }
    env.fence?.(x, z, x, z, 0.15);
  }
  // 石碑の案内板
  {
    const x = (LAB.A.x1 + LAB.B.x0) / 2, z = pz - 2.5, y = env.gy(x, z);
    k.color(C('#6f6c66')); k.box('concrete', x, y + 0.9, z, 4.4, 1.8, 0.7);
    k.color(C('#ffffff')); k.face('labPlate', [[x - 2, y + 0.3, z + 0.36], [x + 2, y + 0.3, z + 0.36], [x + 2, y + 1.8, z + 0.36], [x - 2, y + 1.8, z + 0.36]], [[0, 0], [1, 0], [1, 1], [0, 1]]);
    env.fence?.(x - 2.2, z, x + 2.2, z, 0.4);
  }
  // 自転車置き場の屋根
  {
    const x0 = LAB.B.x0 + 14, x1 = LAB.B.x0 + 24, z = pz - 1.5;
    k.color(C('#b9bec0'));
    for (const x of [x0, x1]) k.cyl('metal', x, env.gy(x, z), z, 0.06, 2.3, 8);
    k.color(C('#8fa6b0')); k.box('glass', (x0 + x1) / 2, env.gy(x0, z) + 2.35, z - 0.6, x1 - x0 + 0.6, 0.05, 2.2);
    env.fence?.(x0, z, x0, z, 0.1); env.fence?.(x1, z, x1, z, 0.1);
    // 停めてある自転車と、前輪を入れるラック
    const cols = ['#c8423a', '#2f5a9a', '#e8e4da', '#3a3a3a', '#6a8a4a', '#d8b02a', '#8a8e92', '#2f5a9a', '#c8423a', '#e8e4da', '#3a3a3a'];
    let n = 0;
    for (let x = x0 + 0.7; x < x1 - 0.4; x += 0.72, n++) {
      if (n % 4 === 3) continue; // ところどころ空き
      bicycle(k, env.at(x, z - 1.1, Math.PI / 2 - 0.08 + (n % 3) * 0.05), C(cols[n % cols.length]), r);
    }
    k.at(M);
    k.color(C('#a9aeb0'));
    k.rod('metal', [x0 + 0.3, env.gy(x0, z) + 0.3, z - 1.95], [x1 - 0.3, env.gy(x1, z) + 0.3, z - 1.95], 0.04);
    env.fence?.(x0 + 0.3, z - 1.1, x1 - 0.3, z - 1.1, 0.8);
  }
  // ---------- 前庭の小物: ベンチ・車止めのポール・外灯・錨のモニュメント・職員の駐車場 ----------
  k.at(M);
  // ベンチ（植え込みの前、外向き）
  for (const x of [-34, -7.5, 15.5, 34.5]) {
    const z = pz - 3.2, y = env.gy(x, z);
    k.color(C('#b9b4aa'));
    for (const dx of [-0.7, 0.7]) k.box('concrete', x + dx, y + 0.2, z, 0.25, 0.4, 0.45);
    k.color(C('#9a6e44'));
    for (let q = 0; q < 4; q++) k.box('wood', x, y + 0.43, z - 0.18 + q * 0.12, 1.9, 0.05, 0.09);
    env.fence?.(x - 0.95, z, x + 0.95, z, 0.3);
  }
  // 車止めのポール（前庭の外周。入口の通路はあける）
  k.color(C('#c8ccce'));
  for (let x = LAB.A.x0; x <= LAB.B.x1 + 0.01; x += 2.4) {
    if (Math.abs(x - (LAB.A.x0 + LAB.A.x1) / 2) < 5 || Math.abs(x - (LAB.A.x1 + LAB.B.x0) / 2) < 3.5) continue;
    const z = pz - 0.5, y = env.gy(x, z);
    k.cyl('metal', x, y, z, 0.075, 0.78, 12);
    k.geo('metal', new THREE.SphereGeometry(0.075, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.Matrix4().setPosition(x, y + 0.78, z));
    k.color(C('#e0a02a')); k.cyl('paint', x, y + 0.62, z, 0.078, 0.05, 12); k.color(C('#c8ccce'));
    env.fence?.(x, z, x, z, 0.1);
  }
  // 外灯（細い角柱と、平たい灯具）
  for (const x of [-40, -30, -12, 0, 12, 24, 38]) {
    const z = pz - 0.9, y = env.gy(x, z);
    k.color(C('#6c7174')); k.box('metal', x, y + 2.3, z, 0.12, 4.6, 0.12);
    k.box('metal', x, y + 4.62, z + 0.18, 0.2, 0.08, 0.55);
    k.color(C('#fff6e0')); k.box('lamp', x, y + 4.575, z + 0.2, 0.16, 0.01, 0.45);
    env.fence?.(x, z, x, z, 0.12);
  }
  // 錨のモニュメント（研究船の古い錨）と説明板
  {
    const x = 10.5, z = pz - 2.4, y = env.gy(x, z);
    k.color(C('#9a978f')); k.box('concrete', x, y + 0.2, z, 1.8, 0.4, 1.2);
    k.color(C('#3a3634'));
    const rot = new THREE.Matrix4().makeRotationY(0.35);
    const T = (px, py, pz2) => new THREE.Matrix4().multiplyMatrices(new THREE.Matrix4().makeTranslation(x, y + 0.4, z), rot).multiply(new THREE.Matrix4().makeTranslation(px, py, pz2));
    k.geo('metal', new THREE.CylinderGeometry(0.07, 0.09, 2.2, 10), T(0, 1.25, 0));                                   // 軸
    k.geo('metal', new THREE.TorusGeometry(0.16, 0.035, 8, 18), T(0, 2.45, 0));                                     // 環
    k.geo('metal', new THREE.CylinderGeometry(0.04, 0.04, 1.0, 8).rotateZ(Math.PI / 2), T(0, 2.05, 0));           // ストック
    k.geo('metal', new THREE.TorusGeometry(0.62, 0.06, 8, 24, Math.PI).rotateZ(Math.PI), T(0, 0.78, 0));          // 腕
    for (const s of [-1, 1]) k.geo('metal', new THREE.ConeGeometry(0.12, 0.3, 4).rotateZ(-s * 0.5), T(s * 0.62, 0.86, 0)); // 爪
    k.color(C('#2b2d2f')); k.box('paint', x + 1.3, y + 0.55, z + 0.35, 0.6, 0.4, 0.05);
    k.color(C('#8a8e90')); k.box('metal', x + 1.3, y + 0.2, z + 0.33, 0.05, 0.4, 0.05);
    env.fence?.(x - 0.9, z, x + 0.9, z, 0.6);
  }
  // 職員の駐車場（実験棟の前）: 白線と 4 台
  {
    const xs = [26.2, 29.0, 31.8, 34.6, 37.4];
    for (const x of xs) groundPatch(k, env, x - 0.05, 1.2, x + 0.05, 6.6, 'paint', C('#f4f4f0'), 0.045, 1);
    const kinds = ['minivan', 'kei', 'compact', 'kei'];
    for (let q = 0; q < 4; q++) {
      const x = (xs[q] + xs[q + 1]) / 2;
      car(k, env.at(x, 3.9, q % 2 ? Math.PI : 0), () => (q * 0.37) % 1, kinds[q]);
      env.solid?.([[x - 0.85, 1.7], [x + 0.85, 1.7], [x + 0.85, 6.1], [x - 0.85, 6.1]], 1.7);
    }
    k.at(M);
  }
  env.solid?.([[LAB.A.x0, LAB.A.z0], [LAB.A.x1, LAB.A.z0], [LAB.A.x1, LAB.A.z1], [LAB.A.x0, LAB.A.z1]], HT + 2);
  env.solid?.([[LAB.B.x0, LAB.B.z0], [LAB.B.x1, LAB.B.z0], [LAB.B.x1, LAB.B.z1], [LAB.B.x0, LAB.B.z1]], HT + 2);
  return { entrance: [(LAB.A.x0 + LAB.A.x1) / 2, pz - 6] };
}
