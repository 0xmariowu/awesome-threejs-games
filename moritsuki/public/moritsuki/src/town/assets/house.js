// 家: 壁・窓・玄関・屋根・ベランダ・設備を実際の形で組み立てる
// ローカル座標: 原点 = 敷地の地面（床下の基礎の下端）、x = 幅方向、z = 奥行き（+z が正面・道側）、y = 上
import * as THREE from 'three';

const C = (h) => new THREE.Color(h);
export const HOUSE_PAL = {
  siding: ['#f1eee6', '#e9e3d4', '#dcd8cf', '#cfd3d4', '#e8dcc6', '#d4c7b0', '#bfc6c9', '#f4f1ea', '#c9bda8', '#a9b3b8'].map(C),
  mortar: ['#efe9dc', '#e6dfcf', '#f2efe8', '#e2dccd', '#d9d2c2'].map(C),
  wood: ['#ffffff', '#e8e0d4', '#d0c4b4'].map(C),
  kawara: ['#8c96a6', '#7d8796', '#9aa1aa', '#8a8580', '#6f7c8e'].map(C),
  metal: ['#b54434', '#3f7a64', '#3d5f86', '#8b8f93', '#7a4a3a', '#2f6a80', '#5a5f66'].map(C),
  trim: ['#f4f3ef', '#e8e6e0', '#4a3f36', '#6b6b6b'].map(C),
  sash: ['#c8ccd0', '#4a4038', '#9ea3a8'].map(C),
};
const pick = (a, r) => a[Math.floor(r() * a.length) % a.length];

// 壁ごとの座標系: x = 壁に沿って（a→b）、y = 上、z = 外向き
function wallFrame(M, ax, az, bx, bz, y0 = 0) {
  const L = Math.hypot(bx - ax, bz - az), ex = (bx - ax) / L, ez = (bz - az) / L;
  const nx = -ez, nz = ex;
  const m = new THREE.Matrix4().set(ex, 0, nx, ax, 0, 1, 0, y0, ez, 0, nz, az, 0, 0, 0, 1);
  return { m: M.clone().multiply(m), L };
}

// ---------- 窓 ----------
// 奥に部屋が見える窓の uv（壁に沿った m・部屋の床からの高さ m）
const winUv = (pts, sill) => pts.map(([x, y]) => [x, y - sill + 0.9]);
// style: 'slide'（引き違い）, 'tall'（掃き出し）, 'small'（小窓・面格子）, 'fixed'
export function windowAt(k, cx, sill, w, h, o) {
  const f = 0.045, sash = o.sash, r = o.r;
  // ガラス（2 枚を前後にずらす）
  const curtain = r() < 0.45;
  const glassCol = curtain ? C('#8a8a80').lerp(pick([C('#f0e6d0'), C('#dfe8ee'), C('#e8d6c8'), C('#c9d8c0')], r), 0.5) : C('#2a3540');
  if (o.style === 'slide' || o.style === 'tall') {
    k.color(glassCol);
    k.face('window', [[cx - w / 2 + f, sill + f, 0.012], [cx + 0.01, sill + f, 0.012], [cx + 0.01, sill + h - f, 0.012], [cx - w / 2 + f, sill + h - f, 0.012]], winUv([[cx - w / 2 + f, sill + f, 0.012], [cx + 0.01, sill + f, 0.012], [cx + 0.01, sill + h - f, 0.012], [cx - w / 2 + f, sill + h - f, 0.012]], sill));
    k.color(glassCol.clone().multiplyScalar(0.92));
    k.face('window', [[cx - 0.01, sill + f, 0.03], [cx + w / 2 - f, sill + f, 0.03], [cx + w / 2 - f, sill + h - f, 0.03], [cx - 0.01, sill + h - f, 0.03]], winUv([[cx - 0.01, sill + f, 0.03], [cx + w / 2 - f, sill + f, 0.03], [cx + w / 2 - f, sill + h - f, 0.03], [cx - 0.01, sill + h - f, 0.03]], sill));
    k.color(sash);
    k.box('metal', cx, sill + h / 2, 0.03, 0.035, h - f * 2, 0.05);
  } else {
    k.color(glassCol);
    k.face('window', [[cx - w / 2 + f, sill + f, 0.015], [cx + w / 2 - f, sill + f, 0.015], [cx + w / 2 - f, sill + h - f, 0.015], [cx - w / 2 + f, sill + h - f, 0.015]], winUv([[cx - w / 2 + f, sill + f, 0.015], [cx + w / 2 - f, sill + f, 0.015], [cx + w / 2 - f, sill + h - f, 0.015], [cx - w / 2 + f, sill + h - f, 0.015]], sill));
  }
  // 枠
  k.color(sash);
  k.box('metal', cx, sill + h - f / 2, 0.035, w, f, 0.07);
  k.box('metal', cx, sill + f / 2, 0.035, w, f, 0.07);
  k.box('metal', cx - w / 2 + f / 2, sill + h / 2, 0.035, f, h, 0.07);
  k.box('metal', cx + w / 2 - f / 2, sill + h / 2, 0.035, f, h, 0.07);
  // 窓台
  if (o.style !== 'tall') { k.color(o.trimCol); k.box('trim', cx, sill - 0.02, 0.05, w + 0.08, 0.04, 0.1); }
  // 面格子
  if (o.style === 'small') {
    k.color(sash);
    for (let x = cx - w / 2 + 0.08; x < cx + w / 2 - 0.04; x += 0.11) k.box('metal', x, sill + h / 2, 0.1, 0.025, h + 0.08, 0.025);
    k.box('metal', cx, sill + h + 0.02, 0.1, w + 0.06, 0.03, 0.06);
    k.box('metal', cx, sill - 0.02, 0.1, w + 0.06, 0.03, 0.06);
  }
  // 雨戸: シャッターボックス（新しい家）か戸袋（古い家）
  if ((o.style === 'slide' || o.style === 'tall') && o.shutter) {
    if (o.old) {
      k.color(o.trimCol);
      const side = r() < 0.5 ? -1 : 1;
      k.box('trim', cx + side * (w / 2 + w * 0.26), sill + h / 2 + 0.03, 0.07, w * 0.5, h + 0.14, 0.14);
      k.box('trim', cx, sill + h + 0.05, 0.05, w + w * 0.55, 0.06, 0.1);
    } else {
      k.color(o.trimCol);
      k.box('trim', cx, sill + h + 0.12, 0.09, w + 0.06, 0.24, 0.18);
    }
  }
}

// ---------- 家 ----------
/**
 * spec: { w, d, floors, fh, wall: 'siding'|'mortar'|'wood', wallCol, roof: 'gable'|'hip'|'shed'|'flat', roofMat: 'kawara'|'metalRoof',
 *         roofCol, pitch, over, old, shutter, balcony, skirt, door: 'left'|'right', solar, antenna }
 */
export function buildHouse(k, M, spec, r) {
  const { w, d, floors, fh } = spec;
  const base = 0.45; // 基礎の高さ
  const H = base + floors * fh;
  const trimCol = spec.trimCol || (spec.old ? C('#4a3f36') : C('#efece6'));
  const sash = spec.sash || (spec.old ? C('#8a8e92') : pick(HOUSE_PAL.sash, r));
  const hw = w / 2, hd = d / 2;
  k.at(M);
  // 基礎
  k.color(C('#b9b6ae'));
  k.box('concrete', 0, base / 2 - 0.3, 0, w + 0.06, base + 0.6, d + 0.06);
  // 床下の換気口
  k.color(C('#3a3a3a'));
  for (const [ax, az, bx, bz] of [[-hw, hd, hw, hd], [hw, -hd, -hw, -hd]]) {
    const { m, L } = wallFrame(M, ax, az, bx, bz);
    k.at(m);
    for (let s = 1.2; s < L - 0.8; s += 2.7) k.box('dark', s, base * 0.55, 0.035, 0.3, 0.1, 0.01);
  }
  k.at(M);
  // 外壁
  const walls = [[-hw, hd, hw, hd, 'front'], [hw, hd, hw, -hd, 'right'], [hw, -hd, -hw, -hd, 'back'], [-hw, -hd, -hw, hd, 'left']];
  k.color(spec.wallCol);
  for (const [ax, az, bx, bz] of walls) k.wall(spec.wall, ax, az, bx, bz, base, H);
  // 階の境の帯
  if (floors > 1 && spec.wall !== 'wood') {
    k.color(trimCol);
    for (const [ax, az, bx, bz] of walls) {
      const { m, L } = wallFrame(M, ax, az, bx, bz);
      k.at(m).box('trim', L / 2, base + fh, 0.02, L + 0.04, 0.12, 0.05);
    }
    k.at(M);
  }
  // 窓と玄関
  const doorSide = spec.door === 'left' ? -1 : 1;
  const doorX = doorSide * (hw - 1.3);
  for (const [ax, az, bx, bz, side] of walls) {
    const { m, L } = wallFrame(M, ax, az, bx, bz);
    k.at(m);
    for (let f = 0; f < floors; f++) {
      const y0 = base + f * fh;
      const slots = Math.max(1, Math.floor((L - 0.8) / 2.6));
      const step = L / slots;
      for (let s = 0; s < slots; s++) {
        const cx = step * (s + 0.5);
        // 玄関の位置は窓をあける
        if (side === 'front' && f === 0 && Math.abs(cx - (doorX + hw)) < 1.3) continue;
        const roll = r();
        let style, ww, wh, sill;
        if (side === 'front' && f === 0 && roll < 0.7) { style = 'tall'; ww = Math.min(1.75, step - 0.5); wh = 1.95; sill = 0.05; }
        else if (side === 'front' && f === 1 && spec.balcony && Math.abs(cx - L * 0.5) < spec.balcony / 2) { style = 'tall'; ww = Math.min(1.7, step - 0.5); wh = 1.95; sill = 0.05; }
        else if ((side === 'left' || side === 'right' || side === 'back') && roll < 0.35) { style = 'small'; ww = 0.6; wh = 0.75; sill = 1.25; }
        else if (roll < 0.12) continue;
        else { style = 'slide'; ww = Math.min(1.65, step - 0.5); wh = 1.1; sill = 0.9; }
        if (ww < 0.5) continue;
        windowAt(k, cx, y0 + sill, ww, wh, { style, sash, r, trimCol, shutter: spec.shutter && style !== 'small', old: spec.old });
      }
    }
  }
  // 玄関
  {
    const { m } = wallFrame(M, -hw, hd, hw, hd);
    k.at(m);
    const dx = doorX + hw;
    const doorCol = spec.old ? C('#6b5a48') : pick([C('#5a4636'), C('#8a8f94'), C('#3f3a36'), C('#7a6a58')], r);
    k.color(sash); k.box('metal', dx, base + 1.05, 0.03, 1.05, 2.15, 0.07);
    k.color(doorCol); k.box('paint', dx, base + 1.02, 0.045, 0.9, 2.02, 0.05);
    k.color(C('#27313a')); k.box('glass', dx - 0.28, base + 1.1, 0.075, 0.12, 1.5, 0.01);
    k.color(C('#c9c9c9')); k.box('metal', dx + 0.32, base + 1.0, 0.09, 0.04, 0.3, 0.04);
    // ポーチ（段）と庇、照明
    k.color(C('#b6b1a6'));
    k.box('concrete', dx, base * 0.5, 0.75, 1.9, base, 1.5);
    k.box('concrete', dx, base * 0.25, 1.65, 1.6, base * 0.5, 0.4);
    k.color(trimCol); k.box('trim', dx, base + 2.45, 0.5, 1.8, 0.08, 1.0);
    k.color(C('#f2eedf')); k.box('lamp', dx + 0.75, base + 2.1, 0.08, 0.14, 0.22, 0.12);
    // 表札とインターホン
    k.color(C('#e8e2d2')); k.box('trim', dx - 0.75, base + 1.45, 0.04, 0.25, 0.1, 0.03);
    k.color(C('#555')); k.box('plastic', dx - 0.75, base + 1.25, 0.04, 0.09, 0.14, 0.04);
  }
  // 2 階のベランダ
  if (floors > 1 && spec.balcony) {
    const { m, L } = wallFrame(M, -hw, hd, hw, hd);
    k.at(m);
    const bw = spec.balcony, bx = L / 2, y = base + fh;
    k.color(C('#c9c5bb')); k.box('concrete', bx, y - 0.08, 0.5, bw, 0.18, 1.0);
    const rail = spec.old ? trimCol : pick([C('#e8e8e4'), C('#8a8e92'), C('#4a4038')], r);
    k.color(rail);
    k.box('metal', bx, y + 1.0, 0.98, bw, 0.05, 0.06);
    for (let x = bx - bw / 2 + 0.03; x <= bx + bw / 2; x += 0.12) k.box('metal', x, y + 0.5, 0.98, 0.022, 1.0, 0.022);
    for (const s of [-1, 1]) { k.box('metal', bx + s * (bw / 2 - 0.02), y + 0.5, 0.5, 0.05, 1.0, 1.0); }
    // 物干し竿と洗濯物
    if (r() < 0.7) {
      k.color(C('#d8d8d4')); k.box('metal', bx, y + 1.75, 0.55, bw - 0.3, 0.03, 0.03);
      for (const s of [-1, 1]) k.box('metal', bx + s * (bw / 2 - 0.2), y + 1.4, 0.55, 0.03, 0.7, 0.03);
      const n = 2 + Math.floor(r() * 4);
      for (let q = 0; q < n; q++) {
        k.color(pick([C('#f4f4f0'), C('#8fb8e0'), C('#f0c95a'), C('#e87a6a'), C('#9ad08a'), C('#e4e0f0')], r));
        const x = bx - bw / 2 + 0.4 + (q + 0.5) * (bw - 0.8) / n;
        k.face('cloth', [[x - 0.25, y + 1.05, 0.55], [x + 0.25, y + 1.05, 0.55], [x + 0.25, y + 1.73, 0.55], [x - 0.25, y + 1.73, 0.55]]);
      }
    }
    // エアコンの室外機
    acUnit(k, bx + bw / 2 - 0.55, y + 0.02, 0.35, r);
  }
  // 1 階と 2 階の間の小屋根（下屋の庇）
  if (floors > 1 && spec.skirt) {
    const { m, L } = wallFrame(M, -hw, hd, hw, hd);
    k.at(m);
    const y = base + fh + 0.05;
    k.color(spec.roofCol);
    k.face(spec.roofMat, [[-0.3, y, 0.75], [L + 0.3, y, 0.75], [L + 0.3, y + 0.38, 0], [-0.3, y + 0.38, 0]], [[-0.3, 0], [L + 0.3, 0], [L + 0.3, 0.85], [-0.3, 0.85]]);
    k.color(trimCol); k.box('trim', L / 2, y - 0.06, 0.76, L + 0.62, 0.14, 0.04);
  }
  // 屋根
  k.at(M);
  roof(k, M, spec, H, trimCol, r);
  // 設備: 室外機・給湯器・メーター・雨どい
  {
    const { m, L } = wallFrame(M, hw, hd, hw, -hd);
    k.at(m);
    acUnit(k, L * 0.3, 0.02, 0.35, r);
    if (r() < 0.6) {
      k.color(C('#e9e9e4')); k.box('plastic', L * 0.62, 0.95, 0.35, 0.7, 1.9, 0.7);
      k.color(C('#bbb')); k.box('plastic', L * 0.62 + 0.55, 0.45, 0.3, 0.5, 0.9, 0.5);
    }
    k.color(C('#d5d5d0')); k.box('plastic', L * 0.85, 1.5, 0.06, 0.3, 0.45, 0.12);
  }
}

function acUnit(k, x, y, z, r) {
  k.color(C('#ecece6'));
  k.box('plastic', x, y + 0.3, z, 0.8, 0.6, 0.3);
  k.color(C('#3a3a3a'));
  k.cyl('dark', x - 0.12, y + 0.3, z + 0.16, 0.2, 0.01, 16);
  // 格子
  k.color(C('#9a9a96'));
  for (let q = -0.18; q <= 0.19; q += 0.06) k.box('metal', x - 0.12, y + 0.3 + q, z + 0.17, 0.42, 0.012, 0.01);
  k.color(C('#d0d0cc')); k.box('plastic', x + 0.46, y + 0.3, z - 0.1, 0.06, 0.06, 0.2);
}

// 屋根: 厚み・鼻隠し・破風・棟・雨どい
function roof(k, M, spec, H, trimCol, r) {
  const { w, d, pitch: p, over: o } = spec;
  const W = w / 2 + o, D = d / 2 + o, hw = w / 2, hd = d / 2;
  const mat = spec.roofMat, rc = spec.roofCol;
  const T = 0.14; // 屋根の厚み
  const yE = H - o * p, yR = H + hd * p;
  const sl = Math.hypot(D, yR - yE);
  const gutter = C('#8a8d90');
  const eave = (x0, x1, z, y, dir) => {
    k.color(trimCol); k.box('trim', (x0 + x1) / 2, y - T / 2 - 0.06, z, Math.abs(x1 - x0), 0.24, 0.04);
    k.color(gutter); k.box('metal', (x0 + x1) / 2, y - T - 0.08, z + dir * 0.08, Math.abs(x1 - x0), 0.1, 0.12);
  };
  if (spec.roof === 'flat') {
    k.color(C('#a9a59c')); k.box('concrete', 0, H + 0.05, 0, w + 0.1, 0.1, d + 0.1);
    k.color(spec.wallCol);
    for (const [cx, cz, sx, sz] of [[0, hd, w + 0.1, 0.2], [0, -hd, w + 0.1, 0.2], [hw, 0, 0.2, d], [-hw, 0, 0.2, d]]) k.box(spec.wall, cx, H + 0.35, cz, sx, 0.6, sz);
    return;
  }
  if (spec.roof === 'shed') {
    const yLo = H - o * p, yHi = H + (d + o) * p;
    k.color(rc);
    k.face(mat, [[-W, yLo, D], [W, yLo, D], [W, yHi, -D], [-W, yHi, -D]], [[-W, 0], [W, 0], [W, Math.hypot(2 * D, yHi - yLo)], [-W, Math.hypot(2 * D, yHi - yLo)]]);
    k.color(trimCol);
    k.face('trim', [[-W, yHi - T, -D], [W, yHi - T, -D], [W, yLo - T, D], [-W, yLo - T, D]]);
    // 妻（三角の壁）
    k.color(spec.wallCol);
    const yW = H + d * p;
    k.face(spec.wall, [[hw, H, hd], [hw, H, -hd], [hw, yW, -hd]], [[0, H], [d, H], [d, yW]]);
    k.face(spec.wall, [[-hw, H, -hd], [-hw, H, hd], [-hw, yW, -hd]], [[0, H], [d, H], [0, yW]]);
    k.face(spec.wall, [[hw, H, -hd], [-hw, H, -hd], [-hw, yW, -hd], [hw, yW, -hd]], [[0, H], [w, H], [w, yW], [0, yW]]);
    eave(-W, W, D + 0.02, yLo, 1);
    return;
  }
  if (spec.roof === 'gable') {
    k.color(rc);
    k.face(mat, [[W, yE, -D], [-W, yE, -D], [-W, yR, 0], [W, yR, 0]], [[W, 0], [-W, 0], [-W, sl], [W, sl]]);
    k.face(mat, [[-W, yE, D], [W, yE, D], [W, yR, 0], [-W, yR, 0]], [[-W, 0], [W, 0], [W, sl], [-W, sl]]);
    // 軒裏
    k.color(trimCol.clone().lerp(C('#ffffff'), 0.3));
    k.face('trim', [[-W, yE - T, -D], [W, yE - T, -D], [W, yR - T, 0], [-W, yR - T, 0]]);
    k.face('trim', [[W, yE - T, D], [-W, yE - T, D], [-W, yR - T, 0], [W, yR - T, 0]]);
    // 妻壁
    k.color(spec.wallCol);
    k.face(spec.wall, [[hw, H, hd], [hw, H, -hd], [hw, yR, 0]], [[0, H], [d, H], [d / 2, yR]]);
    k.face(spec.wall, [[-hw, H, -hd], [-hw, H, hd], [-hw, yR, 0]], [[0, H], [d, H], [d / 2, yR]]);
    // 破風板
    k.color(trimCol);
    for (const s of [1, -1]) {
      for (const sz of [1, -1]) k.rod('trim', [s * (W + 0.02), yE - 0.06, sz * D], [s * (W + 0.02), yR - 0.02, 0], 0.2);
    }
    eave(-W, W, D + 0.02, yE, 1);
    eave(-W, W, -D - 0.02, yE, -1);
    ridge(k, mat, rc, [-W, yR + 0.04, 0], [W, yR + 0.04, 0], true);
  } else {
    // 寄棟
    const Rr = Math.max(0, (w - d) / 2);
    k.color(rc);
    k.face(mat, [[W, yE, -D], [-W, yE, -D], [-Rr, yR, 0], [Rr, yR, 0]], [[W, 0], [-W, 0], [-Rr, sl], [Rr, sl]]);
    k.face(mat, [[-W, yE, D], [W, yE, D], [Rr, yR, 0], [-Rr, yR, 0]], [[-W, 0], [W, 0], [Rr, sl], [-Rr, sl]]);
    const sl2 = Math.hypot(W - Rr, yR - yE);
    k.face(mat, [[W, yE, D], [W, yE, -D], [Rr, yR, 0]], [[D, 0], [-D, 0], [0, sl2]]);
    k.face(mat, [[-W, yE, -D], [-W, yE, D], [-Rr, yR, 0]], [[-D, 0], [D, 0], [0, sl2]]);
    k.color(trimCol.clone().lerp(C('#ffffff'), 0.3));
    k.face('trim', [[-W, yE - T, -D], [W, yE - T, -D], [W, yE - T, D], [-W, yE - T, D]]);
    eave(-W, W, D + 0.02, yE, 1);
    eave(-W, W, -D - 0.02, yE, -1);
    k.color(trimCol);
    for (const s of [1, -1]) k.box('trim', s * (W + 0.02), yE - T / 2 - 0.06, 0, 0.04, 0.24, 2 * D);
    // 棟と隅棟
    if (Rr > 0.1) ridge(k, mat, rc, [-Rr, yR + 0.04, 0], [Rr, yR + 0.04, 0], false);
    for (const s of [1, -1]) for (const sz of [1, -1]) ridge(k, mat, rc, [s * Rr, yR + 0.04, 0], [s * W, yE + 0.06, sz * D], false, 0.09);
  }
  // 雨どいの縦管
  k.color(gutter);
  for (const [sx, sz] of [[1, 1], [-1, -1]]) k.box('metal', sx * (hw + 0.1), (yE - 0.2) / 2, sz * (hd + 0.1), 0.08, yE - 0.2, 0.08);
  // 太陽光パネル（南向きの面）
  if (spec.solar && spec.roof !== 'flat') {
    const sb = spec.southFront ? 1 : -1;
    const a = spec.roof === 'hip' ? Math.max(0.8, (w - d) / 2) + 0.2 : W * 0.72;
    const Y = (b) => yR - b * p + 0.12;
    const b0 = D * 0.2, b1 = D * 0.82;
    k.color(C('#1e2b52'));
    const q = [[-a, Y(b1), sb * b1], [a, Y(b1), sb * b1], [a, Y(b0), sb * b0], [-a, Y(b0), sb * b0]];
    k.face('glass', sb > 0 ? q : [q[1], q[0], q[3], q[2]]);
    k.color(C('#c9ccd0'));
    for (let x = -a; x <= a + 0.01; x += (2 * a) / Math.max(1, Math.round((2 * a) / 1.0))) k.rod('metal', [x, Y(b1) + 0.02, sb * b1], [x, Y(b0) + 0.02, sb * b0], 0.03);
  }
  // テレビアンテナ
  if (spec.antenna) {
    const x = (r() - 0.5) * w * 0.5, y = yR + 0.05;
    k.color(C('#b8bcc0'));
    k.rod('metal', [x, y, 0], [x, y + 2.0, 0], 0.04);
    for (let q = 0; q < 6; q++) k.rod('metal', [x - 0.4 + q * 0.16, y + 1.8, -0.35], [x - 0.4 + q * 0.16, y + 1.8, 0.35], 0.015);
    k.rod('metal', [x - 0.5, y + 1.8, 0], [x + 0.5, y + 1.8, 0], 0.03);
  }
}

// 棟（瓦は丸い熨斗瓦、金属は角）
function ridge(k, mat, rc, a, b, oni, rad = 0.13) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
  const L = A.distanceTo(B);
  k.color(rc.clone().multiplyScalar(0.85));
  if (mat === 'kawara') {
    const g = new THREE.CylinderGeometry(rad, rad, L, 8, 1);
    g.rotateX(Math.PI / 2);
    const m = new THREE.Matrix4().lookAt(B, A, new THREE.Vector3(0, 1, 0)).setPosition(A.clone().add(B).multiplyScalar(0.5));
    k.geo('kawara', g, m);
    if (oni) {
      for (const P of [A, B]) k.box('kawara', P.x, P.y + 0.06, P.z, 0.12, 0.42, 0.42);
    }
  } else {
    k.rod(mat, a, b, 0.16);
  }
}

// 家の種類をくじで決める
export function houseSpec(r, w, d) {
  const old = r() < 0.16;
  const wall = old ? 'wood' : r() < 0.62 ? 'siding' : 'mortar';
  const metal = !old && r() < 0.3;
  const floors = r() < 0.8 ? 2 : 1;
  return {
    w, d, floors, fh: 2.85, old, wall,
    wallCol: wall === 'wood' ? pick(HOUSE_PAL.wood, r) : wall === 'mortar' ? pick(HOUSE_PAL.mortar, r) : pick(HOUSE_PAL.siding, r),
    roof: old ? (r() < 0.6 ? 'hip' : 'gable') : r() < 0.45 ? 'gable' : r() < 0.85 ? 'hip' : 'shed',
    roofMat: metal ? 'metalRoof' : 'kawara',
    roofCol: metal ? pick(HOUSE_PAL.metal, r) : pick(HOUSE_PAL.kawara, r),
    pitch: old ? 0.55 : 0.42 + r() * 0.16, over: old ? 0.75 : 0.5 + r() * 0.2,
    shutter: r() < 0.75, balcony: floors > 1 && r() < 0.7 ? Math.min(w - 1.2, 3.2 + r() * 2.4) : 0,
    skirt: old ? r() < 0.7 : r() < 0.25, door: r() < 0.5 ? 'left' : 'right', solar: !old && r() < 0.25, antenna: r() < 0.45,
  };
}

// ---------- 集合住宅・公共施設・倉庫・店 ----------
/**
 * spec: { w, d, floors, fh, kind: 'apt'|'inst'|'warehouse'|'station', wall, wallCol, trimCol,
 *         balcony: 前面にベランダ, corridor: 裏に外廊下, stairs: 外階段の色, fascia: 屋根の帯の色, shop: 1 階を店に }
 */
export function buildBlock(k, M, spec, r) {
  const { w, d, floors, fh } = spec;
  const hw = w / 2, hd = d / 2, base = 0.3;
  const H = base + floors * fh;
  const trimCol = spec.trimCol || C('#eeece6');
  const sash = spec.sash || C('#b9bec2');
  k.at(M);
  k.color(C('#b4b0a6'));
  k.box('concrete', 0, base / 2 - 0.25, 0, w + 0.06, base + 0.5, d + 0.06);
  const walls = [[-hw, hd, hw, hd, 'front'], [hw, hd, hw, -hd, 'right'], [hw, -hd, -hw, -hd, 'back'], [-hw, -hd, -hw, hd, 'left']];
  if (spec.kind === 'warehouse') {
    k.color(spec.wallCol);
    for (const [ax, az, bx, bz] of walls) {
      const L = Math.hypot(bx - ax, bz - az);
      k.face('metalRoof', [[ax, base, az], [bx, base, bz], [bx, H, bz], [ax, H, az]], [[0, 0], [L, 0], [L, H], [0, H]].map(([u, v]) => [u, v]));
    }
    // シャッター
    const { m } = wallFrame(M, -hw, hd, hw, hd);
    k.at(m).color(C('#c9ccce'));
    const sw = Math.min(w * 0.5, 5);
    k.box('metalRoof', hw, base + Math.min(3.6, H - 0.8) / 2, 0.04, sw, Math.min(3.6, H - 0.8), 0.06);
    k.color(C('#8a8e92')); k.box('metal', hw, base + Math.min(3.6, H - 0.8) + 0.2, 0.12, sw + 0.3, 0.35, 0.22);
    // 低い切妻
    k.at(M);
    const p = 0.18, o = 0.35, W = hw + o, D = hd + o, yE = H - o * p, yR = H + hd * p;
    k.color(spec.roofCol || C('#9aa3aa'));
    k.face('metalRoof', [[W, yE, -D], [-W, yE, -D], [-W, yR, 0], [W, yR, 0]], [[W, 0], [-W, 0], [-W, D], [W, D]]);
    k.face('metalRoof', [[-W, yE, D], [W, yE, D], [W, yR, 0], [-W, yR, 0]], [[-W, 0], [W, 0], [W, D], [-W, D]]);
    k.color(spec.wallCol);
    k.face('metalRoof', [[hw, H, hd], [hw, H, -hd], [hw, yR, 0]], [[0, 0], [d, 0], [hd, hd * p]]);
    k.face('metalRoof', [[-hw, H, -hd], [-hw, H, hd], [-hw, yR, 0]], [[0, 0], [d, 0], [hd, hd * p]]);
    return { H };
  }
  k.color(spec.wallCol);
  for (const [ax, az, bx, bz] of walls) k.wall(spec.wall || 'mortar', ax, az, bx, bz, base, H);
  // 階ごとの帯
  k.color(trimCol);
  for (let f = 1; f < floors; f++) for (const [ax, az, bx, bz] of walls) {
    const { m, L } = wallFrame(M, ax, az, bx, bz);
    k.at(m).box('trim', L / 2, base + f * fh, 0.03, L + 0.06, 0.16, 0.06);
  }
  // 窓
  for (const [ax, az, bx, bz, side] of walls) {
    const { m, L } = wallFrame(M, ax, az, bx, bz);
    k.at(m);
    for (let f = 0; f < floors; f++) {
      const y0 = base + f * fh;
      if (spec.kind === 'inst' || spec.kind === 'station') {
        // 横に連なる窓
        const n = Math.max(1, Math.floor((L - 1.2) / 1.8));
        const st = (L - 1.2) / n;
        if (side === 'front' && f === 0 && spec.shop) continue;
        for (let q = 0; q < n; q++) windowAt(k, 0.6 + st * (q + 0.5), y0 + 0.85, st - 0.12, 1.5, { style: 'fixed', sash, r, trimCol });
      } else {
        const bay = 3.4, n = Math.max(1, Math.floor(L / bay)), st = L / n;
        for (let q = 0; q < n; q++) {
          const cx = st * (q + 0.5);
          if (side === 'front') {
            if (f === 0 && spec.shop) continue;
            windowAt(k, cx, y0 + 0.05, 1.7, 1.95, { style: 'tall', sash, r, trimCol, shutter: false });
            if (spec.balcony && f > 0) {
              const y = y0;
              k.color(C('#cfcac0')); k.box('concrete', cx, y - 0.08, 0.55, st - 0.1, 0.16, 1.1);
              k.color(spec.railCol || C('#e6e4de')); k.box('trim', cx, y + 0.55, 1.08, st - 0.1, 1.0, 0.06);
              k.color(C('#9a9892')); k.box('trim', cx + st / 2 - 0.05, y + 0.55, 0.55, 0.1, 1.1, 1.1);
              if (r() < 0.5) {
                k.color(C('#d8d8d4')); k.box('metal', cx, y + 1.7, 0.6, st - 0.6, 0.03, 0.03);
                for (let c = 0; c < 3; c++) if (r() < 0.6) { k.color(pick([C('#f4f4f0'), C('#8fb8e0'), C('#f0c95a'), C('#e87a6a')], r)); const x = cx - st / 2 + 0.6 + c * (st - 1.2) / 2.5; k.face('cloth', [[x - 0.25, y + 1.05, 0.6], [x + 0.25, y + 1.05, 0.6], [x + 0.25, y + 1.68, 0.6], [x - 0.25, y + 1.68, 0.6]]); }
              }
              if (r() < 0.6) { k.color(C('#ecece6')); k.box('plastic', cx + st / 2 - 0.6, y + 0.32, 0.35, 0.8, 0.6, 0.3); }
            }
          } else if (side === 'back' && spec.corridor) {
            // 玄関ドアと小窓
            k.color(pick([C('#6b5a48'), C('#4a5a6a'), C('#7a7a74')], r)); k.box('paint', cx - 0.8, y0 + 1.02, 0.04, 0.85, 2.0, 0.05);
            windowAt(k, cx + 0.6, y0 + 1.2, 0.8, 0.8, { style: 'small', sash, r, trimCol });
          } else if (r() < 0.7) {
            windowAt(k, cx, y0 + 0.9, 1.2, 1.1, { style: 'slide', sash, r, trimCol, shutter: false });
          }
        }
      }
    }
  }
  // 外廊下と階段（裏）
  if (spec.corridor) {
    const { m, L } = wallFrame(M, hw, -hd, -hw, -hd);
    k.at(m);
    const sc = spec.stairs || C('#e4e2dc');
    for (let f = 1; f < floors; f++) {
      const y = base + f * fh;
      k.color(C('#cfcac0')); k.box('concrete', L / 2, y - 0.08, 0.6, L, 0.16, 1.2);
      k.color(sc); k.box('trim', L / 2, y + 0.55, 1.18, L, 1.0, 0.05);
    }
    // 階段
    k.color(sc);
    for (let f = 0; f < floors - 1; f++) {
      const y0 = base + f * fh, steps = 14;
      for (let q = 0; q < steps; q++) k.box('metal', L + 0.6, y0 + (q + 1) * (fh / steps) - 0.03, 1.2 - q * 0.08 * (f % 2 ? -1 : 1) + (f % 2 ? -1.1 : 0), 1.0, 0.05, 0.28);
    }
  }
  // 店の 1 階（ガラス戸・ひさし）
  if (spec.shop) {
    const { m, L } = wallFrame(M, -hw, hd, hw, hd);
    k.at(m);
    k.color(C('#2a3540'));
    k.face('glass', [[0.6, base + 0.1, 0.02], [L - 0.6, base + 0.1, 0.02], [L - 0.6, base + 2.4, 0.02], [0.6, base + 2.4, 0.02]]);
    k.color(sash);
    for (let x = 0.6; x <= L - 0.6 + 0.01; x += (L - 1.2) / Math.max(1, Math.round((L - 1.2) / 1.8))) k.box('metal', x, base + 1.25, 0.04, 0.06, 2.3, 0.06);
    k.box('metal', L / 2, base + 2.42, 0.04, L - 1.1, 0.06, 0.06);
    k.color(spec.awning || C('#3a3a3a')); k.box('paint', L / 2, base + 2.75, 0.55, L + 0.2, 0.12, 1.1);
  }
  // 屋上: パラペット・屋上の設備
  k.at(M);
  k.color(C('#a9a59c')); k.box('concrete', 0, H + 0.04, 0, w, 0.08, d);
  k.color(spec.fascia || spec.wallCol);
  const pw = spec.fascia ? 0.9 : 0.6;
  for (const [cx, cz, sx, sz] of [[0, hd, w + 0.2, 0.2], [0, -hd, w + 0.2, 0.2], [hw, 0, 0.2, d], [-hw, 0, 0.2, d]]) k.box(spec.fascia ? 'paint' : spec.wall || 'mortar', cx, H + pw / 2 - 0.1, cz, sx, pw, sz);
  if (spec.kind !== 'station') {
    k.color(C('#d0d0cc'));
    for (let q = 0; q < Math.floor(w / 5); q++) k.box('plastic', -hw + 2 + q * 4.5, H + 0.45, -hd + 1.6, 0.9, 0.7, 0.4);
    k.color(C('#9aa1a6')); k.box('metal', hw - 1.5, H + 0.9, 0, 1.2, 1.6, 1.2);
  }
  return { H };
}
