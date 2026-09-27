// 定食屋の人（湊さん）の家: 定食屋に向かって左の空き地が、段階ごとに建て替わる
//  0 空き地（低木と雑草、売地の看板、境界のロープ）
//  1 ボロ小屋（板張りにトタンの片流れ、薪・ドラム缶・物干し・家庭菜園）
//  2 古い家（瓦の切妻の平屋、焼杉の腰壁と土壁、縁側、松、軽トラ）
//  3 普通の家（サイディングの 2 階建て、バルコニー、カーポート、ウッドデッキ）
//  4 3 階建てのアパート（外廊下、裏にバルコニー）
//  5 5 階建てのマンション（タイル張り、エレベーターの塔、すりガラスのバルコニー）
//  6 8 階建てのマンション（白いタイル、ガラスのバルコニー、縦の枠と屋上の飾り）
//  7 12 階建てのタワーマンション（2 層吹き抜けのロビー、四方のガラスのバルコニー、光る頂部）
// 敷地のローカル座標: 原点 = 敷地の中心（y = 0 は地面）、+z = 家の前の道の側、+x = 道から見て右（定食屋の側）
// 敷地は x: -9.5..9.5、z: -5.3..5.3（自分の家と定食屋の間の空き地、幅 約 21 m）
import * as THREE from 'three';
import { C, wallFrame, holeyWall, slider, kirizuma, canvasTex, needMat, groundPatch, clothGeo, woodGrain } from './build.js';
import { flatMaterials } from '../lots.js';
import { car, bicycle, blockWall, aluFence } from './props.js';
import { pottedPlant, weedClump } from './plants.js';

export const OWNER_STAGES = ['空き地', 'ボロ小屋', '古い家', '普通の家', '3 階建てアパート', '5 階建てマンション', '8 階建てマンション', '12 階建てタワーマンション'];
export const OWNER_LOT = { x0: -9.5, x1: 9.5, z0: -5.3, z1: 5.3 };
const MINCHO = '"Zen Old Mincho", "Yu Mincho", serif', GOTHIC = '"Zen Kaku Gothic New", "Yu Gothic", sans-serif';
const SIDES = (b) => [[b.x0, b.z1, b.x1, b.z1, 'front'], [b.x1, b.z1, b.x1, b.z0, 'right'], [b.x1, b.z0, b.x0, b.z0, 'back'], [b.x0, b.z0, b.x0, b.z1, 'left']];

function rngOf(seed) {
  let s = seed % 2147483647 || 1;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

// ---------- マテリアル・看板 ----------
function mats(k) {
  needMat(k, 'frost', () => new THREE.MeshPhysicalMaterial({ color: '#eef2f2', transparent: true, opacity: 0.62, roughness: 0.55, metalness: 0, depthWrite: false, side: THREE.DoubleSide }));
  needMat(k, 'glassClear', () => new THREE.MeshPhysicalMaterial({ color: '#dfeef2', transparent: true, opacity: 0.16, roughness: 0.04, metalness: 0, envMapIntensity: 1.4, depthWrite: false }));
  needMat(k, 'glassRail', () => new THREE.MeshPhysicalMaterial({ color: '#cfe3e8', transparent: true, opacity: 0.28, roughness: 0.05, metalness: 0, envMapIntensity: 1.5, depthWrite: false, side: THREE.DoubleSide }));
  needMat(k, 'glowTop', () => new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: new THREE.Color('#fff2d8'), emissiveIntensity: 0.6, roughness: 0.4 }));
  // マンションの外壁タイル（45 二丁掛け、明るい色。頂点色で色を付ける）
  needMat(k, 'ohTile', () => {
    const t = canvasTex('ohTile', 512, 512, (g, w, h) => {
      g.fillStyle = '#b9b5ad'; g.fillRect(0, 0, w, h);
      const cols = 5, rows = 18, tw = w / cols, th = h / rows;
      for (let j = 0; j < rows; j++) for (let i = -1; i < cols; i++) {
        const x = i * tw + (j % 2) * tw * 0.5, s = Math.sin(i * 12.9898 + j * 78.233) * 43758.5453, rr = s - Math.floor(s);
        const l = 232 - rr * 22;
        g.fillStyle = `rgb(${l | 0},${(l - 3) | 0},${(l - 9) | 0})`;
        g.fillRect(x + 2, j * th + 2, tw - 4, th - 4);
      }
    });
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1 / 1.2, 1 / 1.08);
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.6, vertexColors: true });
  });
  Object.assign(k.mats, flatMaterials(), { ...k.mats });
}

// 文字の板（name = マテリアル名、draw で描く。uv は 0..1）
function sign(k, name, w, h, draw, fonts, o = {}) {
  needMat(k, name, () => new THREE.MeshStandardMaterial({ map: canvasTex(name, w, h, draw, fonts), roughness: 0.5, vertexColors: true, ...o }));
  return name;
}
// 板を貼る（中心 x, y、面の z、幅 w・高さ h、向き dir = +1 なら +z 向き / -1 なら -z / 'x+' なら +x 向き）
function plate(k, mat, x, y, z, w, h, dir = 1) {
  k.color(C('#ffffff'));
  const uv = [[0, 0], [1, 0], [1, 1], [0, 1]];
  if (dir === 'x+') k.face(mat, [[x, y - h / 2, z + w / 2], [x, y - h / 2, z - w / 2], [x, y + h / 2, z - w / 2], [x, y + h / 2, z + w / 2]], uv);
  else if (dir > 0) k.face(mat, [[x - w / 2, y - h / 2, z], [x + w / 2, y - h / 2, z], [x + w / 2, y + h / 2, z], [x - w / 2, y + h / 2, z]], uv);
  else k.face(mat, [[x + w / 2, y - h / 2, z], [x - w / 2, y - h / 2, z], [x - w / 2, y + h / 2, z], [x + w / 2, y + h / 2, z]], uv);
}
// 表札（木の板に「湊」）
function nameplate(k, x, y, z, dir = 1) {
  const m = sign(k, 'ohHyosatsu', 128, 256, (g, w, h) => {
    woodGrain(g, w, h, '#c9a57a', '#8a6a48');
    g.fillStyle = '#1b120a'; g.font = `900 150px ${MINCHO}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('湊', w / 2, h / 2 + 6);
  }, [`900 150px ${MINCHO}`]);
  plate(k, m, x, y, z, 0.14, 0.28, dir);
}

// 地面の帯（踏み固めた小道など）: 折れ線 pts に沿って幅 w
function ribbon(k, env, pts, w, mat, col, lift = 0.035) {
  k.at(env.M).color(col);
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1], L = Math.hypot(bx - ax, bz - az), nx = -(bz - az) / L * w / 2, nz = (bx - ax) / L * w / 2;
    const P = (x, z) => [x, env.gy(x, z) + lift + i * 0.0005, z];
    const q = [[ax + nx, az + nz], [bx + nx, bz + nz], [bx - nx, bz - nz], [ax - nx, az - nz]];
    k.face(mat, q.map(([x, z]) => P(x, z)), q.map(([x, z]) => [x, -z]));
    env.pave?.(q);
  }
}

// 雑草と低木をばらまく（ex: 避ける四角 [x0, z0, x1, z1] の列）
function wild(k, env, rnd, n, ex = [], { tall = 0.12, low = 0.25, shrubs = 0, area = OWNER_LOT } = {}) {
  const inEx = (x, z, m = 0.2) => ex.some(([a, b, c, d]) => x > a - m && x < c + m && z > b - m && z < d + m);
  let placed = 0;
  for (let t = 0; t < n * 4 && placed < n; t++) {
    const x = area.x0 + 0.3 + rnd() * (area.x1 - area.x0 - 0.6), z = area.z0 + 0.3 + rnd() * (area.z1 - area.z0 - 0.6);
    if (inEx(x, z)) continue;
    // きわほど茂る
    const edge = Math.min(x - area.x0, area.x1 - x, z - area.z0, area.z1 - z);
    if (edge > 2.5 && rnd() < 0.35) continue;
    const u = rnd(), kind = u < tall ? 'tall' : u < tall + low ? 'low' : 'grass';
    weedClump(k, x, env.gy(x, z), z, { kind, s: kind === 'tall' ? 0.8 + rnd() * 0.5 : 0.7 + rnd() * 0.7, seed: (t * 31 + 7) | 0 });
    placed++;
  }
  for (let q = 0, t = 0; q < shrubs && t < shrubs * 6; t++) {
    const x = area.x0 + 0.8 + rnd() * (area.x1 - area.x0 - 1.6), z = area.z0 + 0.8 + rnd() * (area.z1 - area.z0 - 1.6);
    if (inEx(x, z, 0.8)) continue;
    env.tree?.('shrub', x, z, 0.5 + rnd() * 0.35);
    q++;
  }
}

// 物干し（2 本の支柱と竿、洗濯物）。a → b に竿を渡す
function laundry(k, env, ax, az, bx, bz, n, seed, cols = ['#f4f2ec', '#e8e4da', '#3a5a8a', '#f4f2ec', '#d86a5a', '#f4f2ec']) {
  k.at(env.M);
  const ya = env.gy(ax, az), yb = env.gy(bx, bz), H = 1.85;
  k.color(C('#9aa0a2'));
  for (const [x, z, y] of [[ax, az, ya], [bx, bz, yb]]) {
    k.rod('metal', [x, y, z], [x, y + H + 0.1, z], 0.05);
    k.rod('metal', [x - (bz - az) * 0.06, y + H, z + (bx - ax) * 0.06], [x + (bz - az) * 0.06, y + H, z - (bx - ax) * 0.06], 0.035);
  }
  k.color(C('#b5bcc0')); k.rod('metal', [ax, ya + H, az], [bx, yb + H, bz], 0.03);
  const L = Math.hypot(bx - ax, bz - az), yaw = Math.atan2(bz - az, -(bx - ax)) + Math.PI / 2;
  for (let q = 0; q < n; q++) {
    const t = (q + 0.7) / (n + 0.4), x = ax + (bx - ax) * t, z = az + (bz - az) * t, y = ya + (yb - ya) * t + H;
    const w = 0.35 + ((q * 7 + seed) % 3) * 0.12, h = 0.45 + ((q * 5 + seed) % 4) * 0.1;
    k.color(C(cols[(q + seed) % cols.length]));
    k.geo('cloth', clothGeo(Math.min(w, L / n * 0.9), h, q + seed, 0.03), new THREE.Matrix4().makeRotationY(yaw).setPosition(x, y - 0.02, z));
  }
}

// エアコンの室外機（向き yaw、+z が前）
function acUnit(k, M, x, y, z, yaw = 0) {
  k.at(M.clone().multiply(new THREE.Matrix4().makeRotationY(yaw).setPosition(x, y, z)));
  k.color(C('#e6e6e0')); k.box('plastic', 0, 0.3, 0, 0.78, 0.56, 0.28);
  k.color(C('#3a3d3f')); k.geo('dark', new THREE.CylinderGeometry(0.19, 0.19, 0.01, 16).rotateX(Math.PI / 2), new THREE.Matrix4().setPosition(-0.08, 0.3, 0.145));
  k.color(C('#cfcfc8')); for (let q = 0; q < 4; q++) k.box('plastic', -0.08, 0.14 + q * 0.11, 0.15, 0.4, 0.012, 0.01);
  k.at(M);
}

// 切妻の屋根（棟は x 方向）: 中心 (cx, cz)、壁の大きさ w × d、壁の上端 H、軒の出 ov、けらば gov、勾配 p
function gableX(k, M, { cx, cz, w, d, H, ov = 0.5, gov = 0.35, p = 0.45, mat = 'metalRoof', col, trim = C('#e8e6e0'), soffit = C('#dcd8cf'), gable, gableMat = 'siding', ridgeCol }) {
  k.at(M);
  const W = w / 2 + gov, D = d / 2 + ov, yE = H - ov * p, yR = H + (d / 2) * p, T = 0.12;
  const P = (x, y, z) => [cx + x, y, cz + z];
  const sl = Math.hypot(D, yR - yE);
  for (const s of [1, -1]) {
    const pts = s > 0 ? [[-W, yE, D], [W, yE, D], [W, yR, 0], [-W, yR, 0]] : [[W, yE, -D], [-W, yE, -D], [-W, yR, 0], [W, yR, 0]];
    k.color(col); k.face(mat, pts.map((q) => P(...q)), s > 0 ? [[-W, 0], [W, 0], [W, sl], [-W, sl]] : [[W, 0], [-W, 0], [-W, sl], [W, sl]]);
    k.color(soffit); k.face('trim', pts.map((q) => P(q[0], q[1] - T, q[2])).reverse());
    k.color(trim); k.box('trim', ...P(0, yE - 0.1, s * (D + 0.02)), 2 * W + 0.04, 0.2, 0.05);
    k.color(C('#8e9392'));
    k.geo('metal', new THREE.CylinderGeometry(0.06, 0.06, 2 * W, 8, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).rotateX(s > 0 ? 0 : Math.PI), new THREE.Matrix4().setPosition(...P(0, yE - 0.17, s * (D + 0.1))));
    for (const sx of [-1, 1]) k.cyl('metal', ...P(sx * (w / 2 + 0.1), 0.05, s * (d / 2 + 0.12)), 0.04, yE - 0.25, 8);
  }
  for (const s of [1, -1]) {
    const x = s * (w / 2);
    const tri = s > 0 ? [[x, H, d / 2], [x, H, -d / 2], [x, yR - 0.05, 0]] : [[x, H, -d / 2], [x, H, d / 2], [x, yR - 0.05, 0]];
    k.color(gable); k.face(gableMat, tri.map((q) => P(...q)), tri.map((q) => [q[2], q[1]]));
    k.color(trim);
    for (const sz of [1, -1]) k.rod('trim', P(s * (W + 0.02), yE - 0.06, sz * (D + 0.02)), P(s * (W + 0.02), yR - 0.02, 0), 0.22);
  }
  k.color(ridgeCol || col.clone().multiplyScalar(0.8));
  for (const s of [1, -1]) {
    const a = [P(-W, yR - 0.02, s * 0.28), P(W, yR - 0.02, s * 0.28), P(W, yR + 0.07, 0), P(-W, yR + 0.07, 0)];
    k.face('metal', s > 0 ? a : [a[1], a[0], a[3], a[2]]);
  }
  return { yE, yR };
}

// ==================== 0: 空き地 ====================
function stageEmpty(k, env, rnd) {
  const L = OWNER_LOT;
  // 伸び放題の草地（敷地だけ色を変える）、人が通って踏み固めた小道と、むき出しの土
  groundPatch(k, env, L.x0, L.z0, L.x1, L.z1, 'fGrass', C('#b8c088'), 0.02, 2);
  ribbon(k, env, [[3.5, 5.4], [2.4, 3.2], [0.4, 1.4], [-1.8, 0.2], [-4.2, -0.8]], 0.7, 'fDirt', C('#d8c8a8'), 0.04);
  groundPatch(k, env, -6.8, -3.4, -4.4, -1.6, 'fDirt', C('#a8987c'), 0.03, 1);
  // 砂利の山と、放り込まれた古タイヤ・一斗缶・石
  k.at(env.M);
  k.color(C('#a8a49a')); k.geo('concrete', new THREE.SphereGeometry(1.0, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(1.2, 0.38, 0.9), new THREE.Matrix4().setPosition(-6.0, env.gy(-6, -2.6) - 0.02, -2.6));
  k.color(C('#232323')); k.geo('rubber', new THREE.TorusGeometry(0.3, 0.1, 8, 18).rotateX(Math.PI / 2 - 0.25), new THREE.Matrix4().setPosition(5.2, env.gy(5.2, -2.8) + 0.08, -2.8));
  k.color(C('#8a5a3a')); k.box('metal', 6.1, env.gy(6.1, -3.4) + 0.16, -3.4, 0.24, 0.35, 0.24);
  for (let q = 0; q < 9; q++) {
    const x = -8.5 + rnd() * 17, z = -4.8 + rnd() * 9.6, s = 0.12 + rnd() * 0.22;
    k.color(C('#8e8b84').offsetHSL(0, 0, (rnd() - 0.5) * 0.1));
    k.geo('concrete', new THREE.IcosahedronGeometry(s, 0).scale(1.2, 0.6, 1), new THREE.Matrix4().makeRotationY(rnd() * 6).setPosition(x, env.gy(x, z) + s * 0.2, z));
  }
  // 境界杭（四隅）と、道ぞいの虎ロープ
  k.color(C('#d2cfc6'));
  for (const [x, z] of [[L.x0 + 0.1, L.z0 + 0.1], [L.x1 - 0.1, L.z0 + 0.1], [L.x0 + 0.1, L.z1 - 0.1], [L.x1 - 0.1, L.z1 - 0.1]]) {
    const y = env.gy(x, z);
    k.color(C('#d2cfc6')); k.box('concrete', x, y + 0.06, z, 0.1, 0.18, 0.1);
    k.color(C('#c8342c')); k.box('paint', x, y + 0.152, z, 0.08, 0.005, 0.02); k.box('paint', x, y + 0.152, z, 0.02, 0.005, 0.08);
  }
  const zr = L.z1 - 0.25, stakes = [];
  for (let x = L.x0 + 0.3; x <= L.x1 - 0.2; x += 2.35) stakes.push(x);
  k.color(C('#7a6048'));
  for (const x of stakes) k.box('wood', x, env.gy(x, zr) + 0.36, zr, 0.05, 0.76, 0.05);
  for (let i = 0; i < stakes.length - 1; i++) {
    const a = stakes[i], b = stakes[i + 1], n = 10;
    if (a > 1.8 && a < 4.5) continue; // 小道のところは切れて垂れ下がっている
    for (let j = 0; j < n; j++) {
      const t0 = j / n, t1 = (j + 1) / n, sag = (t) => env.gy(a + (b - a) * t, zr) + 0.62 - Math.sin(Math.PI * t) * 0.09;
      k.color(C(j % 2 ? '#1e1e1e' : '#e8c21a'));
      k.rod('plastic', [a + (b - a) * t0, sag(t0), zr], [a + (b - a) * t1, sag(t1), zr], 0.018);
    }
  }
  // 売地の看板（少し傾いた、日に焼けた板）
  {
    const m = sign(k, 'ohUrichi', 512, 320, (g, w, h) => {
      g.fillStyle = '#f2efe6'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 1200; i++) { g.fillStyle = `rgba(120,90,60,${((i * 37) % 10) / 180})`; g.fillRect((i * 7919) % w, (i * 104729) % h, 3, 2); }
      g.strokeStyle = '#c8342c'; g.lineWidth = 10; g.strokeRect(12, 12, w - 24, h - 24);
      g.fillStyle = '#c8342c'; g.font = `900 150px ${GOTHIC}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('売地', w / 2, h * 0.42);
      g.fillStyle = '#2a2a2a'; g.font = `700 40px ${GOTHIC}`; g.fillText('約 60 坪　吉山不動産', w / 2, h * 0.8);
    }, [`900 150px ${GOTHIC}`, `700 40px ${GOTHIC}`]);
    const x = 6.4, z = 4.4, M = env.M.clone().multiply(new THREE.Matrix4().makeRotationZ(0.04).setPosition(x, env.gy(x, z), z));
    k.at(M);
    k.color(C('#8a7058')); for (const dx of [-0.42, 0.42]) k.box('wood', dx, 0.75, -0.03, 0.07, 1.5, 0.05);
    k.color(C('#e6e2d8')); k.box('paint', 0, 1.2, 0, 1.0, 0.64, 0.02);
    plate(k, m, 0, 1.2, 0.011, 0.96, 0.6, 1);
    k.at(env.M);
    env.fence?.(x - 0.5, z, x + 0.5, z, 0.1);
  }
  // 雑草と低木（奥とへりほど茂る）、苗木くらいの木
  wild(k, env, rnd, 200, [[1.6, 0.6, 4.2, 5.3]], { tall: 0.14, low: 0.2, shrubs: 12 });
  env.tree?.('b-oak', -7.8, -4.4, 0.26);
  env.tree?.('b-oak', 8.1, -4.2, 0.22);
  env.tree?.('b-garden', -3.0, 3.8, 0.7);
}

// ==================== 1: ボロ小屋 ====================
function stageShack(k, env, rnd) {
  const M = env.M, S = { x0: -7.4, x1: -3.4, z0: -4.4, z1: -1.4 }, fl = 0.25, Hf = 2.3, Hb = 1.95;
  // 小道と、小屋の前の土間
  ribbon(k, env, [[1.2, 5.4], [0.2, 2.8], [-2.0, 0.4], [-4.6, -1.0]], 0.8, 'fDirt', C('#d2c2a2'), 0.04);
  groundPatch(k, env, -7.8, -1.4, -2.8, 0.2, 'fDirt', C('#a8987c'), 0.03, 1);
  k.at(M);
  // 束石（ブロックの上に床）
  k.color(C('#8e8b84'));
  for (const x of [S.x0 + 0.1, (S.x0 + S.x1) / 2, S.x1 - 0.1]) for (const z of [S.z0 + 0.1, S.z1 - 0.1]) k.box('block', x, fl / 2, z, 0.38, fl, 0.19);
  k.color(C('#4a3a2c')); k.box('wood', (S.x0 + S.x1) / 2, fl - 0.05, (S.z0 + S.z1) / 2, S.x1 - S.x0 - 0.05, 0.1, S.z1 - S.z0 - 0.05);
  // 壁（色あせた板張り。ところどころ合板とトタンの継ぎ当て）
  const boardCol = C('#d8c0a0');
  for (const [ax, az, bx, bz, side] of SIDES(S)) {
    const { m, L } = wallFrame(M, ax, az, bx, bz, fl);
    k.at(m);
    const top = side === 'front' ? Hf : side === 'back' ? Hb : Hb;
    const holes = [];
    if (side === 'front') holes.push({ x0: 0.55, x1: 1.35, y0: 0, y1: 1.8 }, { x0: 2.4, x1: 3.4, y0: 0.95, y1: 1.65 });
    if (side === 'left') holes.push({ x0: 1.1, x1: 1.7, y0: 1.0, y1: 1.5 });
    k.color(boardCol);
    holeyWall(k, 'wood', L, 0, top, holes, 0.03);
    // 側壁の三角（片流れの勾配ぶん。前が高い）
    if (side === 'left') k.face('wood', [[0, Hb, 0], [L, Hb, 0], [L, Hf, 0]]);
    if (side === 'right') k.face('wood', [[0, Hb, 0], [L, Hb, 0], [0, Hf, 0]]);
    // 隅の柱
    k.color(C('#4a3a2c')); for (const x of [0.04, L - 0.04]) k.box('trim', x, top / 2, 0.02, 0.08, top, 0.08);
    if (side === 'front') {
      // 合板の戸（蝶番と南京錠の掛け金）
      k.color(C('#a48a62')); k.box('paint', 0.95, 0.9, -0.01, 0.8, 1.8, 0.03);
      k.color(C('#8a7a5a')); for (const y of [0.3, 1.5]) k.box('paint', 0.95, y, 0.01, 0.78, 0.06, 0.01);
      k.color(C('#3a3634')); for (const y of [0.35, 1.45]) k.box('metal', 0.6, y, 0.02, 0.12, 0.05, 0.01);
      k.color(C('#b89a4a')); k.box('metal', 1.28, 1.0, 0.03, 0.05, 0.08, 0.03);
      // 窓: 1 枚は段ボールで塞ぎ、ひびにガムテープ
      k.color(C('#3a4a50')); k.face('glass', [[2.4, 0.95, -0.02], [3.4, 0.95, -0.02], [3.4, 1.65, -0.02], [2.4, 1.65, -0.02]]);
      k.color(C('#b89a6a')); k.box('paint', 3.15, 1.3, -0.005, 0.48, 0.68, 0.01);
      k.color(C('#c9b88a')); k.rod('plastic', [2.45, 1.0, 0.0], [2.85, 1.6, 0.0], 0.03); k.rod('plastic', [2.45, 1.6, 0.0], [2.85, 1.0, 0.0], 0.03);
      k.color(C('#5a4a3a')); k.box('wood', 2.9, 0.93, 0.02, 1.1, 0.05, 0.06); k.box('wood', 2.9, 1.67, 0.02, 1.1, 0.05, 0.06); k.box('wood', 2.9, 1.3, 0.01, 0.04, 0.7, 0.04);
    }
    if (side === 'left') { k.color(C('#2e3a40')); k.face('glass', [[1.1, 1.0, -0.02], [1.7, 1.0, -0.02], [1.7, 1.5, -0.02], [1.1, 1.5, -0.02]]); }
    if (side === 'right') {
      // 錆びたトタンの継ぎ当て
      k.color(C('#8a5a3a')); k.face('metalRoof', [[0.5, 0.2, 0.015], [1.7, 0.25, 0.015], [1.7, 1.45, 0.015], [0.5, 1.4, 0.015]], [[0.5, 0.2], [1.7, 0.25], [1.7, 1.45], [0.5, 1.4]]);
      // ストーブの煙突
      k.color(C('#6a6e70'));
      k.rod('metal', [2.2, 1.5, -0.1], [2.2, 1.5, 0.35], 0.1);
      k.cyl('metal', 2.2, 1.45, 0.35, 0.055, 1.6, 10);
      k.geo('metal', new THREE.ConeGeometry(0.14, 0.12, 10), new THREE.Matrix4().setPosition(2.2, 3.12, 0.35));
    }
    if (side === 'back') { k.color(C('#9c8a6a')); k.face('paint', [[1.0, 0.1, 0.012], [2.2, 0.1, 0.012], [2.2, 1.3, 0.012], [1.0, 1.3, 0.012]]); }
  }
  k.at(M);
  // トタンの片流れ屋根（波板を 4 枚、色も錆び方もばらばら）と押さえの石・古タイヤ
  {
    const ov = 0.35, sx = 0.25, zf = S.z1 + ov, zb = S.z0 - ov, yf = fl + Hf + 0.05 + ov * 0.09, yb = fl + Hb + 0.05 - ov * 0.09;
    const cols = ['#8a5a3a', '#7a7068', '#9a6a44', '#6e6258'];
    const X0 = S.x0 - sx, X1 = S.x1 + sx, n = 4, wd = (X1 - X0) / n;
    for (let i = 0; i < n; i++) {
      const a = X0 + i * wd - 0.05, b = a + wd + 0.1, dy = i * 0.012;
      const pts = [[a, yf + dy, zf], [b, yf + dy, zf], [b, yb + dy, zb], [a, yb + dy, zb]];
      k.color(C(cols[i]));
      k.face('metalRoof', pts, [[a, 0], [b, 0], [b, 3.8], [a, 3.8]]);
    }
    k.color(C('#4a3a2c')); k.box('wood', (X0 + X1) / 2, yf - 0.08, zf - 0.02, X1 - X0, 0.14, 0.04);
    k.color(C('#8e8b84'));
    for (const [x, t] of [[S.x0 + 0.4, 0.3], [S.x0 + 2.2, 0.6], [S.x1 - 0.3, 0.8]]) k.geo('concrete', new THREE.IcosahedronGeometry(0.13, 0).scale(1.3, 0.6, 1), new THREE.Matrix4().setPosition(x, yf + (yb - yf) * t + 0.07, zf + (zb - zf) * t));
    k.color(C('#232323')); k.geo('rubber', new THREE.TorusGeometry(0.28, 0.09, 8, 16).rotateX(Math.PI / 2 + 0.09), new THREE.Matrix4().setPosition(S.x0 + 1.2, yf + (yb - yf) * 0.45 + 0.1, zf + (zb - zf) * 0.45));
  }
  env.solid?.([[S.x0, S.z0], [S.x1, S.z0], [S.x1, S.z1], [S.x0, S.z1]], 2.8);
  // 薪の山（小さな差し掛けの下）
  {
    const x0 = S.x1 + 0.1, x1 = S.x1 + 1.2, z0 = S.z0 + 0.2, z1 = S.z1 - 0.2;
    k.color(C('#6a5040'));
    for (let row = 0; row < 5; row++) for (let q = 0; q < 12; q++) {
      const z = z0 + 0.1 + q * ((z1 - z0 - 0.2) / 11), y = 0.08 + row * 0.13 + (q % 2) * 0.02, x = (x0 + x1) / 2 + ((q * 7 + row) % 3 - 1) * 0.03;
      k.color(C((q + row) % 3 ? '#a8845c' : '#8a6a48'));
      k.geo('trim', new THREE.CylinderGeometry(0.065, 0.07, 0.5, 7).rotateZ(Math.PI / 2), new THREE.Matrix4().setPosition(x, y, z));
    }
    k.color(C('#6e6258')); k.face('metalRoof', [[x1 + 0.1, 1.45, z1 + 0.2], [x1 + 0.1, 1.45, z0 - 0.2], [x0 - 0.1, 1.75, z0 - 0.2], [x0 - 0.1, 1.75, z1 + 0.2]], [[0, 0], [3, 0], [3, 1.2], [0, 1.2]]);
    k.color(C('#4a3a2c')); for (const z of [z0 - 0.1, z1 + 0.1]) k.box('wood', x1 + 0.05, 0.72, z, 0.06, 1.45, 0.06);
    env.solid?.([[x0, z0], [x1, z0], [x1, z1], [x0, z1]], 1.5);
  }
  // ドラム缶・ポリタンク・一斗缶
  k.color(C('#355a7a')); k.cyl('metal', -8.5, 0, -1.0, 0.29, 0.88, 16);
  k.color(C('#6a4a34')); k.cyl('metal', -8.5, 0.86, -1.0, 0.3, 0.03, 16);
  k.color(C('#b8342c')); k.box('plastic', -3.0, 0.22, -0.8, 0.26, 0.44, 0.34);
  k.color(C('#8a8a82')); k.box('metal', -2.6, 0.18, -0.5, 0.24, 0.35, 0.24);
  env.solid?.([[-8.8, -1.3], [-8.2, -1.3], [-8.2, -0.7], [-8.8, -0.7]], 1);
  // ブルーシートをかけた何かの山
  k.color(C('#2f68b8')); k.geo('cloth', new THREE.SphereGeometry(0.9, 14, 7, 0, Math.PI * 2, 0, Math.PI / 2).scale(1.1, 0.6, 0.8), new THREE.Matrix4().setPosition(-0.8, 0, -4.2));
  k.color(C('#d8d0b8')); for (const s of [-1, 1]) k.rod('plastic', [-0.8 + s * 0.6, 0.45, -4.2], [-0.8 + s * 1.05, 0.02, -4.2 + s * 0.4], 0.015);
  // 家庭菜園（トマトの支柱・ナス・畝）
  {
    const x0 = 1.4, x1 = 6.8, z0 = -4.4, z1 = -1.2;
    groundPatch(k, env, x0, z0, x1, z1, 'fDirt', C('#8a6e52'), 0.035, 1);
    k.at(M);
    for (let row = 0; row < 3; row++) {
      const z = z0 + 0.6 + row * 1.05;
      k.color(C('#7a5e44')); k.box('fDirt', (x0 + x1) / 2, 0.06, z, x1 - x0 - 0.5, 0.12, 0.5);
      for (let x = x0 + 0.6; x < x1 - 0.4; x += 0.65) {
        weedClump(k, x, 0.12, z, { kind: row === 1 ? 'low' : 'tall', s: row === 1 ? 1.2 : 0.55, seed: (x * 13 + row * 7) | 0 });
        if (row !== 1) {
          k.color(C('#9a8a5a')); k.rod('wood', [x + 0.08, 0.1, z], [x + 0.08, 1.3, z], 0.018);
          k.color(C('#d8321e'));
          for (let t = 0; t < 3; t++) k.geo('foliage', new THREE.SphereGeometry(0.035, 8, 6), new THREE.Matrix4().setPosition(x + 0.05 + (t % 2) * 0.06, 0.45 + t * 0.18, z + 0.05));
        } else {
          k.color(C('#3a2346')); k.geo('foliage', new THREE.CapsuleGeometry(0.03, 0.08, 3, 6).rotateZ(0.6), new THREE.Matrix4().setPosition(x + 0.1, 0.24, z + 0.08));
        }
      }
    }
    env.fence?.(x0, z1, x1, z1, 0.4);
  }
  // 物干し（割烹着と手ぬぐい）、古い自転車
  laundry(k, env, -2.2, 1.6, 1.4, 0.9, 5, 2, ['#f4f2ec', '#f4f2ec', '#1d2c55', '#f4f2ec', '#e8e4da']);
  bicycle(k, env.at(-5.2, 0.6, -0.2), C('#7a4a3a'), rnd);
  k.at(M);
  wild(k, env, rnd, 150, [[-8, -4.8, -2.4, 0.4], [1.2, -4.6, 7, -1], [-2.6, 0.2, 1.8, 2.2], [-1.8, -5, 0.2, -3.2], [-6, 0, -4.4, 1.2]], { tall: 0.12, shrubs: 6 });
  env.tree?.('b-oak', 8.2, -4.4, 0.24);
}

// ==================== 2: 古い家 ====================
function stageOldHouse(k, env, rnd) {
  const M = env.M, B = { x0: -8.3, x1: 3.7, z0: -4.6, z1: 0.9 }, FL = 0.45, WH = 2.7;
  k.at(M);
  // 基礎（布基礎、床下の換気口）
  k.color(C('#a8a59c')); k.box('concrete', (B.x0 + B.x1) / 2, (FL - 0.3) / 2, (B.z0 + B.z1) / 2, B.x1 - B.x0 + 0.08, FL + 0.3, B.z1 - B.z0 + 0.08);
  const plaster = C('#e2d8c2'), sugi = C('#3c3028'), wood = C('#6a5038');
  for (const [ax, az, bx, bz, side] of SIDES(B)) {
    const { m, L } = wallFrame(M, ax, az, bx, bz, FL);
    k.at(m);
    const holes = [], sl = [];
    let door = null;
    if (side === 'front') {
      door = { x0: 0.6, x1: 2.3, y0: 0, y1: 2.0 };
      holes.push(door);
      sl.push({ x0: 3.0, x1: 4.5, y0: 0.9, y1: 1.9, panes: 2, bars: true });
      sl.push({ x0: 5.4, x1: 11.4, y0: 0, y1: 1.9, panes: 4 }); // 縁側のガラス戸
    } else if (side === 'back') {
      sl.push({ x0: 1.5, x1: 3.2, y0: 0.9, y1: 1.9, panes: 2 }, { x0: 5.5, x1: 6.4, y0: 1.2, y1: 1.8, panes: 2, bars: true }, { x0: 8.4, x1: 10.2, y0: 0.9, y1: 1.9, panes: 2 });
      door = { x0: 6.9, x1: 7.7, y0: 0, y1: 1.85 };
      holes.push(door);
    } else {
      sl.push({ x0: L / 2 - 0.45, x1: L / 2 + 0.45, y0: 1.2, y1: 1.8, panes: 2, bars: true });
    }
    for (const h of sl) holes.push(h);
    // 腰は焼杉の板、上は土壁（漆喰）。境に見切りの木
    k.color(sugi); holeyWall(k, 'wood', L, 0, 0.9, holes.filter((h) => h.y0 < 0.9), 0.1);
    k.color(plaster); holeyWall(k, 'mortar', L, 0.9, WH, holes.filter((h) => h.y1 > 0.9), 0.1);
    k.color(wood); k.box('trim', L / 2, 0.9, 0.02, L, 0.06, 0.05);
    for (const x of [0.06, L - 0.06]) k.box('trim', x, WH / 2, 0.02, 0.12, WH, 0.06);
    // 柱を見せる（真壁風）
    k.color(wood); for (let x = 1.8; x < L - 1; x += 1.82) if (!holes.some((h) => x > h.x0 - 0.05 && x < h.x1 + 0.05)) k.box('trim', x, (0.9 + WH) / 2, 0.015, 0.1, WH - 0.9, 0.03);
    for (const h of sl) {
      slider(k, h.x0, h.x1, h.y0, h.y1, 0.08, { frame: wood, glass: C('#34424a'), panes: h.panes, open: h.open ?? -1, win: 'window', floor: 0, bar: h.panes === 4 ? 0.62 : 0 });
      if (h.bars) { k.color(C('#8a8a82')); for (let x = h.x0 + 0.08; x < h.x1; x += 0.11) k.box('metal', x, (h.y0 + h.y1) / 2, 0.04, 0.02, h.y1 - h.y0, 0.02); }
    }
    if (side === 'front') {
      // 玄関の格子の引き戸（すりガラス）
      const d = door;
      k.color(C('#d6d4c8')); k.face('frost', [[d.x0, 0.02, -0.06], [d.x1, 0.02, -0.06], [d.x1, d.y1, -0.06], [d.x0, d.y1, -0.06]]);
      k.color(C('#5a3e2a'));
      for (const x of [d.x0 + 0.04, (d.x0 + d.x1) / 2, d.x1 - 0.04]) k.box('trim', x, d.y1 / 2, -0.03, 0.06, d.y1, 0.05);
      for (let x = d.x0 + 0.12; x < d.x1 - 0.05; x += 0.12) k.box('trim', x, 1.25, -0.03, 0.02, 1.4, 0.03);
      for (const y of [0.05, 0.5, 1.96]) k.box('trim', (d.x0 + d.x1) / 2, y, -0.03, d.x1 - d.x0, 0.06, 0.05);
      // 戸袋（縁側の雨戸の箱）
      k.color(wood); k.box('wood', 11.72, 1.0, 0.18, 0.55, 2.0, 0.34);
      nameplate(k, 0.35, 1.55, 0.04);
    }
    if (side === 'back' && door) { k.color(C('#6f7478')); k.box('paint', (door.x0 + door.x1) / 2, door.y1 / 2, -0.04, door.x1 - door.x0, door.y1, 0.04); }
  }
  k.at(M);
  // 瓦の切妻（棟は x 方向）: kirizuma は棟が z 方向なので 90° 回した座標で組む
  {
    const Mr = M.clone().multiply(new THREE.Matrix4().makeRotationY(Math.PI / 2));
    k.at(Mr);
    kirizuma(k, { cx: -(B.z0 + B.z1) / 2, w: B.z1 - B.z0, z0: B.x0, z1: B.x1, H: FL + WH, over: 0.7, p: 0.52, col: C('#8d9196'), trim: C('#3a2e26'), soffit: C('#a88e6c'), gable: plaster, front: true, back: true, tile: 'kawara' });
    k.at(M);
  }
  // 玄関の小庇（瓦）と、縁側（濡れ縁・沓脱石）
  {
    const x0 = B.x0 + 0.3, x1 = B.x0 + 2.6, z = B.z1, y = FL + 2.25;
    k.color(C('#8d9196')); k.face('kawara', [[x0, y - 0.35, z + 0.9], [x1, y - 0.35, z + 0.9], [x1, y, z], [x0, y, z]], [[x0, 0], [x1, 0], [x1, 0.97], [x0, 0.97]]);
    k.color(C('#a88e6c')); k.face('trim', [[x0, y - 0.4, z + 0.9], [x0, y - 0.05, z], [x1, y - 0.05, z], [x1, y - 0.4, z + 0.9]]);
    k.color(C('#3a2e26')); k.box('trim', (x0 + x1) / 2, y - 0.42, z + 0.9, x1 - x0, 0.1, 0.05);
    for (const x of [x0 + 0.1, x1 - 0.1]) k.box('trim', x, y - 0.2, z + 0.45, 0.05, 0.06, 0.9);
    // 玄関のたたき（洗い出し）と踏み段
    k.color(C('#9a948a')); k.box('concrete', B.x0 + 1.45, FL * 0.5, B.z1 + 0.5, 2.0, FL, 1.0);
    k.color(C('#8e8b84')); k.box('concrete', B.x0 + 1.45, 0.1, B.z1 + 1.2, 1.4, 0.2, 0.4);
    env.deck?.([[B.x0 + 0.45, B.z1], [B.x0 + 2.45, B.z1], [B.x0 + 2.45, B.z1 + 1.0], [B.x0 + 0.45, B.z1 + 1.0]], FL);
    const ex0 = B.x0 + 5.4, ex1 = B.x0 + 11.4;
    k.color(C('#8a6a4a')); for (let q = 0; q < 7; q++) k.box('wood', (ex0 + ex1) / 2, FL - 0.02, B.z1 + 0.08 + q * 0.12, ex1 - ex0, 0.04, 0.1);
    k.color(C('#5a4230')); for (const x of [ex0 + 0.1, (ex0 + ex1) / 2, ex1 - 0.1]) k.box('trim', x, (FL - 0.04) / 2, B.z1 + 0.75, 0.08, FL - 0.04, 0.08);
    k.color(C('#8e8b84')); k.geo('concrete', new THREE.CylinderGeometry(0.34, 0.38, 0.22, 10).scale(1.3, 1, 0.9), new THREE.Matrix4().setPosition(ex0 + 3.0, 0.11, B.z1 + 1.25));
    env.deck?.([[ex0, B.z1], [ex1, B.z1], [ex1, B.z1 + 0.85], [ex0, B.z1 + 0.85]], FL);
    // 縁側の鉢と、干した座布団
    pottedPlant(k, ex0 + 0.3, FL, B.z1 + 0.55, { kind: 'geranium', s: 0.9, seed: 4 });
    pottedPlant(k, ex1 - 0.3, FL, B.z1 + 0.55, { kind: 'azalea', s: 0.9, seed: 8 });
    k.color(C('#8a3a4a')); k.box('cloth', ex0 + 1.4, FL + 0.05, B.z1 + 0.45, 0.55, 0.08, 0.55);
    k.color(C('#3a5a8a')); k.box('cloth', ex0 + 2.1, FL + 0.05, B.z1 + 0.42, 0.55, 0.08, 0.55);
  }
  env.solid?.([[B.x0, B.z0], [B.x1, B.z0], [B.x1, B.z1], [B.x0, B.z1]], 5.5);
  // プロパンガス（右の壁ぞい）と古い室外機
  k.color(C('#e8e6de'));
  for (const z of [-3.0, -2.55]) { k.cyl('paint', B.x1 + 0.3, 0.05, z, 0.18, 1.2, 14); k.color(C('#8a8e90')); k.cyl('metal', B.x1 + 0.3, 1.25, z, 0.06, 0.12, 8); k.color(C('#e8e6de')); }
  k.color(C('#9a9a92')); k.box('concrete', B.x1 + 0.3, 0.025, -2.8, 0.5, 0.05, 1.0);
  acUnit(k, M, B.x1 + 0.3, 0, -0.8, Math.PI / 2);
  // 塀（ブロック塀と門柱）、飛び石
  k.at(M);
  const gy = (x, z) => env.gy(x, z);
  blockWall(k, [-9.4, 5.05], [-7.95, 5.05], 1.2, gy);
  blockWall(k, [-5.75, 5.05], [4.3, 5.05], 1.2, gy);
  blockWall(k, [-9.4, 5.05], [-9.4, -5.2], 1.0, gy);
  k.color(C('#b8b4aa'));
  for (const x of [-7.8, -5.9]) { k.box('concrete', x, 0.7, 5.05, 0.35, 1.4, 0.35); k.box('concrete', x, 1.43, 5.05, 0.42, 0.06, 0.42); }
  nameplate(k, -7.8, 1.1, 5.23);
  k.color(C('#6a6e70')); k.box('metal', -5.9, 1.05, 5.25, 0.28, 0.35, 0.08);
  for (const [x, z] of [[-6.85, 4.4], [-7.0, 3.6], [-6.8, 2.8], [-7.05, 2.1]]) { k.color(C('#8e8b84').offsetHSL(0, 0, (x * 7 % 1) * 0.05)); k.cyl('concrete', x, 0, z, 0.3, 0.07, 10); }
  env.fence?.(-9.4, 5.05, -7.95, 5.05, 0.1); env.fence?.(-5.75, 5.05, 4.3, 5.05, 0.1); env.fence?.(-9.4, 5.05, -9.4, -5.2, 0.1);
  // 庭: 松・玉仕立ての木・つつじの植え込み、玉砂利
  groundPatch(k, env, -2.8, 1.9, 3.6, 4.8, 'fGravel', C('#cfc9bc'), 0.03, 1);
  env.tree?.('pine', 1.2, 3.4, 0.5);
  env.tree?.('b-garden', -2.4, 4.1, 0.65);
  env.tree?.('b-garden', 3.0, 4.2, 0.7);
  for (let x = -5.2; x < 4; x += 0.9) if (x < -3 || x > 3.4) env.tree?.('shrub', x, 4.5, 0.8);
  k.at(M);
  // 軽トラ（右の空き）、物干し、自転車、植木鉢
  car(k, env.at(7.0, 2.2, 0), () => 0.61, 'truck');
  env.solid?.([[6.2, 0.1], [7.8, 0.1], [7.8, 4.3], [6.2, 4.3]], 1.9);
  laundry(k, env, 4.8, -2.4, 8.8, -3.8, 6, 5, ['#f4f2ec', '#f4f2ec', '#e8e4da', '#1d2c55', '#f4f2ec', '#c8a0a0']);
  bicycle(k, env.at(-4.3, 1.9, Math.PI + 0.2), C('#e8e4da'), rnd);
  k.at(M);
  ['marigold', 'spider', 'hosta'].forEach((kind, q) => pottedPlant(k, -5.1 + q * 0.42, 0, 4.6, { kind, s: 0.85, seed: q + 11 }));
  k.at(M);
  wild(k, env, rnd, 14, [[-9.5, -5, 4.2, 5.3], [4.2, -1, 9.5, 5.3]], { tall: 0.05, low: 0.5 });
}

// ==================== 3: 普通の家 ====================
function stageHouse(k, env, rnd) {
  const M = env.M, B = { x0: -8.4, x1: 1.6, z0: -4.7, z1: 0.8 }, BASE = 0.45, F1 = 2.8, F2 = 2.7, H = BASE + F1 + F2;
  k.at(M);
  k.color(C('#b8b5ad')); k.box('concrete', (B.x0 + B.x1) / 2, (BASE - 0.3) / 2, (B.z0 + B.z1) / 2, B.x1 - B.x0 + 0.06, BASE + 0.3, B.z1 - B.z0 + 0.06);
  const c1 = C('#cfc9bd'), c2 = C('#f2f0ea'), frame = C('#5a5652'), sash = C('#4e4a46');
  const bal = { x0: 4.3, x1: 9.4 }; // 2 階のバルコニー（正面の壁の座標）
  for (const [ax, az, bx, bz, side] of SIDES(B)) {
    const { m, L } = wallFrame(M, ax, az, bx, bz, BASE);
    k.at(m);
    const h1 = [], h2 = [];
    let door = null;
    if (side === 'front') {
      door = { x0: 0.8, x1: 1.8, y0: 0, y1: 2.1 };
      h1.push(door, { x0: 2.4, x1: 2.7, y0: 0.2, y1: 2.0, slit: true }, { x0: 3.4, x1: 4.7, y0: 0.9, y1: 2.0 }, { x0: 5.8, x1: 9.3, y0: 0, y1: 2.1, panes: 4 });
      h2.push({ x0: 0.9, x1: 2.6, y0: F1 + 0.9, y1: F1 + 2.0 }, { x0: bal.x0 + 0.4, x1: bal.x0 + 2.2, y0: F1 + 0.02, y1: F1 + 2.0 }, { x0: bal.x0 + 2.8, x1: bal.x1 - 0.4, y0: F1 + 0.02, y1: F1 + 2.0 });
    } else if (side === 'back') {
      h1.push({ x0: 1.2, x1: 2.4, y0: 1.1, y1: 1.9 }, { x0: 3.4, x1: 4.2, y0: 1.3, y1: 1.9, bars: true }, { x0: 6.2, x1: 8.4, y0: 0.9, y1: 2.0 });
      h2.push({ x0: 1.2, x1: 3.0, y0: F1 + 0.9, y1: F1 + 2.0 }, { x0: 4.5, x1: 5.3, y0: F1 + 1.2, y1: F1 + 1.9 }, { x0: 6.6, x1: 8.4, y0: F1 + 0.9, y1: F1 + 2.0 });
    } else {
      h1.push({ x0: L / 2 - 0.6, x1: L / 2 + 0.6, y0: 1.0, y1: 2.0 });
      h2.push({ x0: L / 2 - 0.45, x1: L / 2 + 0.45, y0: F1 + 1.3, y1: F1 + 2.0 });
    }
    // 1 階は濃い色、2 階は白のサイディング。境に水切り
    k.color(c1); holeyWall(k, 'siding', L, 0, F1, h1, 0.12);
    k.color(c2); holeyWall(k, 'siding', L, F1, F1 + F2, h2, 0.12);
    k.color(C('#9a9894')); k.box('metal', L / 2, F1, 0.04, L, 0.05, 0.08);
    k.color(C('#e0ddd6')); for (const x of [0.03, L - 0.03]) k.box('trim', x, (F1 + F2) / 2, 0.02, 0.06, F1 + F2, 0.06);
    for (const h of [...h1, ...h2]) {
      if (h === door || h.slit) continue;
      const fy = h.y0 >= F1 ? F1 : 0;
      slider(k, h.x0, h.x1, h.y0, h.y1, 0.08, { frame: sash, glass: C('#2f3c44'), panes: h.panes || 2, win: 'window', floor: fy });
      if (h.bars) { k.color(C('#8a8a82')); for (let x = h.x0 + 0.08; x < h.x1; x += 0.11) k.box('metal', x, (h.y0 + h.y1) / 2, 0.04, 0.02, h.y1 - h.y0, 0.02); }
      // 窓の上の小さな庇（1 階の掃き出しは大きめ）
      if (side !== 'front' || h.y0 < F1) { k.color(C('#6a6660')); k.box('metal', (h.x0 + h.x1) / 2, h.y1 + 0.12, 0.2, h.x1 - h.x0 + 0.3, 0.05, h.panes === 4 ? 0.7 : 0.4); }
    }
    if (side === 'front') {
      // 玄関ドア（木目）と縦長のスリット窓
      k.color(C('#6a4a32')); k.box('wood', 1.3, 1.05, -0.08, 1.0, 2.1, 0.05);
      k.color(C('#c8ccce')); k.box('metal', 1.68, 1.05, -0.03, 0.03, 0.5, 0.05);
      k.color(C('#b8c4c8')); k.face('frost', [[2.4, 0.2, -0.06], [2.7, 0.2, -0.06], [2.7, 2.0, -0.06], [2.4, 2.0, -0.06]]);
      k.color(frame); k.box('metal', 2.55, 0.2, -0.04, 0.3, 0.04, 0.06); k.box('metal', 2.55, 2.0, -0.04, 0.3, 0.04, 0.06);
      // 玄関の庇と照明、表札
      k.color(C('#e8e6e0')); k.box('concrete', 1.6, 2.45, 0.55, 2.4, 0.12, 1.1);
      k.color(C('#fff6e0')); k.box('lamp', 2.85, 2.1, 0.06, 0.12, 0.2, 0.1);
      nameplate(k, 0.35, 1.5, 0.02);
    }
  }
  k.at(M);
  // バルコニー（2 階の正面）: 床・アルミの手すり・物干し
  {
    const x0 = B.x0 + bal.x0, x1 = B.x0 + bal.x1, z0 = B.z1, z1 = B.z1 + 1.1, y = BASE + F1;
    k.color(C('#d8d6d0')); k.box('concrete', (x0 + x1) / 2, y - 0.1, (z0 + z1) / 2, x1 - x0, 0.2, z1 - z0);
    k.color(C('#e8e6e0')); k.box('concrete', (x0 + x1) / 2, y + 0.25, z1 - 0.05, x1 - x0, 0.5, 0.1);
    for (const x of [x0 + 0.05, x1 - 0.05]) k.box('concrete', x, y + 0.25, (z0 + z1) / 2, 0.1, 0.5, z1 - z0);
    k.color(C('#5a5652'));
    k.rod('metal', [x0, y + 1.1, z1 - 0.05], [x1, y + 1.1, z1 - 0.05], 0.05);
    for (let x = x0 + 0.06; x < x1; x += 0.1) k.rod('metal', [x, y + 0.5, z1 - 0.05], [x, y + 1.1, z1 - 0.05], 0.02);
    for (const x of [x0 + 0.05, x1 - 0.05]) { k.rod('metal', [x, y + 1.1, z1], [x, y + 1.1, z0], 0.05); for (let z = z0 + 0.1; z < z1; z += 0.1) k.rod('metal', [x, y + 0.5, z], [x, y + 1.1, z], 0.02); }
    laundry(k, { ...env, gy: () => y - BASE - F1 + BASE + F1 - 0 }, x0 + 0.5, z0 + 0.55, x1 - 0.5, z0 + 0.55, 6, 3);
    acUnit(k, M, x1 - 0.55, y, z0 + 0.25, 0);
  }
  gableX(k, M, { cx: (B.x0 + B.x1) / 2, cz: (B.z0 + B.z1) / 2, w: B.x1 - B.x0, d: B.z1 - B.z0, H, ov: 0.55, gov: 0.4, p: 0.42, col: C('#44484c'), gable: c2 });
  env.solid?.([[B.x0, B.z0], [B.x1, B.z0], [B.x1, B.z1], [B.x0, B.z1]], H + 2.5);
  // カーポート（アルミの柱とポリカの屋根）と車・自転車
  {
    const x0 = 2.5, x1 = 8.6, z0 = -2.0, z1 = 4.3, y = 2.45;
    k.color(C('#8c8a86'));
    for (const z of [z0 + 0.3, (z0 + z1) / 2, z1 - 0.3]) k.box('metal', x1 - 0.1, y / 2, z, 0.1, y, 0.1);
    k.box('metal', x1 - 0.1, y + 0.06, (z0 + z1) / 2, 0.14, 0.12, z1 - z0);
    k.box('metal', (x0 + x1) / 2, y + 0.06, z1, x1 - x0, 0.1, 0.08); k.box('metal', (x0 + x1) / 2, y + 0.06, z0, x1 - x0, 0.1, 0.08);
    for (let x = x0 + 0.8; x < x1 - 0.2; x += 1.2) k.box('metal', x, y + 0.1, (z0 + z1) / 2, 0.05, 0.05, z1 - z0);
    k.color(C('#c8d8dc')); k.face('frost', [[x0, y + 0.13, z1], [x1, y + 0.13, z1], [x1, y + 0.13, z0], [x0, y + 0.13, z0]]);
    groundPatch(k, env, x0 - 0.3, z0, x1 + 0.3, 5.3, 'fConcrete', C('#cfccc4'), 0.03, 1);
    k.at(M);
    car(k, env.at(5.4, 1.4, 0), () => 0.21, 'minivan');
    env.solid?.([[4.5, -0.9], [6.3, -0.9], [6.3, 3.7], [4.5, 3.7]], 1.9);
    bicycle(k, env.at(7.6, -1.2, Math.PI / 2 + 0.1), C('#e8e4da'), rnd);
    bicycle(k, env.at(7.6, -0.4, Math.PI / 2 - 0.05), C('#c8423a'), rnd);
    k.at(M);
    env.fence?.(x1 - 0.1, z0, x1 - 0.1, z1, 0.1);
  }
  // 外構: 低いブロックとアルミのフェンス、門柱（インターホン・ポスト）、アプローチの敷石、芝生とウッドデッキ
  {
    const gy = (x, z) => env.gy(x, z);
    k.at(M);
    blockWall(k, [-9.4, 5.05], [-6.5, 5.05], 0.55, gy);
    blockWall(k, [-4.9, 5.05], [2.2, 5.05], 0.55, gy);
    aluFence(k, [-9.4, 5.05], [-6.5, 5.05], 0.6, (x, z) => gy(x, z) + 0.6, C('#4a4640'));
    aluFence(k, [-4.9, 5.05], [2.2, 5.05], 0.6, (x, z) => gy(x, z) + 0.6, C('#4a4640'));
    k.color(C('#8a8680')); k.box('concrete', -6.35, 0.7, 5.05, 0.3, 1.4, 0.5);
    nameplate(k, -6.19, 1.05, 5.05, 'x+');
    k.color(C('#2a2c2e')); k.box('plastic', -6.18, 1.1, 4.85, 0.03, 0.14, 0.09);
    k.color(C('#3a3c3e')); k.box('paint', -6.35, 0.95, 5.33, 0.3, 0.4, 0.06);
    env.fence?.(-9.4, 5.05, -6.5, 5.05, 0.1); env.fence?.(-4.9, 5.05, 2.2, 5.05, 0.1);
    for (let q = 0; q < 5; q++) { const z = 4.6 - q * 0.8; k.color(C('#b8b0a2')); k.box('concrete', -5.6 + (q % 2) * 0.12, 0.04, z, 0.9, 0.08, 0.55); }
    groundPatch(k, env, -4.6, 1.9, 2.2, 4.8, 'fGrass', C('#a8c890'), 0.03, 1);
    k.at(M);
    // ウッドデッキ（リビングの掃き出しの前）
    const dx0 = B.x0 + 5.6, dx1 = B.x0 + 9.6;
    k.color(C('#8a6a4a')); for (let q = 0; q < 10; q++) k.box('wood', (dx0 + dx1) / 2, BASE - 0.04, B.z1 + 0.07 + q * 0.14, dx1 - dx0, 0.04, 0.12);
    k.color(C('#6a5038')); k.box('wood', (dx0 + dx1) / 2, (BASE - 0.06) / 2, B.z1 + 1.36, dx1 - dx0, BASE - 0.06, 0.06);
    env.deck?.([[dx0, B.z1], [dx1, B.z1], [dx1, B.z1 + 1.4], [dx0, B.z1 + 1.4]], BASE - 0.02);
    pottedPlant(k, dx0 + 0.3, BASE - 0.02, B.z1 + 1.0, { kind: 'marigold', s: 1, seed: 2 });
    pottedPlant(k, dx0 + 0.75, BASE - 0.02, B.z1 + 1.1, { kind: 'hosta', s: 0.9, seed: 5 });
    env.tree?.('b-oak', -8.4, 3.4, 0.42);
    env.tree?.('b-garden', 1.6, 4.3, 0.7);
    for (let x = -3.8; x < 1.5; x += 0.85) env.tree?.('shrub', x, 4.65, 0.7);
    k.at(M);
    // エコキュートの貯湯タンクと室外機（裏）
    k.color(C('#eeeeea')); k.box('plastic', B.x1 + 0.45, 1.05, -3.6, 0.62, 2.1, 0.62);
    acUnit(k, M, B.x1 + 0.45, 0, -2.4, Math.PI / 2);
    acUnit(k, M, B.x0 - 0.3, 0, -2.0, -Math.PI / 2);
  }
}

// ==================== 4〜7: 集合住宅 ====================
// 壁ごとの座標系で: 各階の窓・ドアの穴を開け、サッシを入れる
// o: floors, Y(f) = f 階の床, FH(f) = 階高, kind = 'corridor'（玄関ドア・台所の窓）/ 'balcony'（掃き出し）/ 'side'（小窓）/ 'lobby'
function aptWall(k, m, L, o) {
  k.at(m);
  const { floors, Y, FH, kind, units, wallMat, wallCol, baseMat, baseCol, sash = C('#b9bcba'), doorCol = C('#6e5a48'), skip0 = false, lobby = null } = o;
  const holes = [], wins = [], doors = [];
  const uw = L / units;
  for (let f = 0; f < floors; f++) {
    const y0 = Y(f), fh = FH(f);
    if (f === 0 && skip0) continue;
    for (let u = 0; u < units; u++) {
      const a = u * uw, b = a + uw;
      if (kind === 'balcony') {
        const w = Math.min(3.6, uw - 0.9), c = (a + b) / 2;
        const h = { x0: c - w / 2, x1: c + w / 2, y0: y0 + 0.05, y1: y0 + Math.min(2.2, fh - 0.6), fy: y0, panes: w > 2.6 ? 4 : 2 };
        holes.push(h); wins.push(h);
      } else if (kind === 'corridor') {
        const d = { x0: a + 0.45, x1: a + 1.3, y0: y0 + 0.03, y1: y0 + 2.05 };
        const w = { x0: a + 1.8, x1: a + Math.min(3.0, uw - 0.5), y0: y0 + 1.0, y1: y0 + 1.9, fy: y0, bars: true };
        holes.push(d, w); doors.push(d); wins.push(w);
      } else if (kind === 'side') {
        if (u > 0) continue;
        const c = L * 0.5, h = { x0: c - 0.45, x1: c + 0.45, y0: y0 + 1.1, y1: y0 + 1.9, fy: y0 };
        holes.push(h); wins.push(h);
      }
    }
  }
  if (lobby) holes.push(lobby);
  const H = Y(floors);
  const baseTop = o.baseH ?? 0;
  if (baseTop > 0) {
    k.color(baseCol); holeyWall(k, baseMat, L, 0, baseTop, holes.filter((h) => h.y0 < baseTop), 0.16);
  }
  k.color(wallCol); holeyWall(k, wallMat, L, baseTop, H, holes.filter((h) => h.y1 > baseTop), 0.16);
  for (const h of wins) {
    slider(k, h.x0, h.x1, h.y0, h.y1, 0.1, { frame: sash, glass: C('#2c3a42'), panes: h.panes || 2, win: 'window', floor: h.fy });
    if (h.bars) { k.color(C('#a8acae')); for (let x = h.x0 + 0.07; x < h.x1; x += 0.1) k.box('metal', x, (h.y0 + h.y1) / 2, 0.05, 0.02, h.y1 - h.y0, 0.02); }
  }
  for (const d of doors) {
    k.color(doorCol); k.box('paint', (d.x0 + d.x1) / 2, (d.y0 + d.y1) / 2, -0.06, d.x1 - d.x0, d.y1 - d.y0, 0.04);
    k.color(C('#c8ccce')); k.box('metal', d.x1 - 0.12, d.y0 + 1.0, -0.03, 0.03, 0.22, 0.05);
    k.color(C('#e8e6e0')); k.box('plastic', d.x0 - 0.16, d.y0 + 1.45, 0.02, 0.1, 0.14, 0.03); // インターホン
    k.color(C('#fff6e0')); k.box('lamp', (d.x0 + d.x1) / 2, d.y1 + 0.25, 0.04, 0.2, 0.08, 0.06);
    k.color(C('#b8bcbe')); k.box('metal', d.x1 + 0.28, d.y0 + 1.35, 0.03, 0.42, 0.62, 0.05); // メーターボックス
  }
  // 階ごとのスラブの見付け（帯）
  k.color(o.bandCol || C('#e8e6e0'));
  for (let f = 1; f < floors; f++) if (!(kind === 'corridor' || kind === 'balcony')) k.box('concrete', L / 2, Y(f) - 0.08, 0.02, L, 0.2, 0.05);
  return H;
}

// 片側のバルコニーの列（壁の座標系: z = 外向き）。rail: 'steel' / 'frost' / 'glass' / 'solid'
function balconies(k, m, L, o) {
  k.at(m);
  const { floors, Y, units, D = 1.2, rail = 'steel', slab = C('#e8e6e0'), railCol = C('#6e6a64'), from = 1, ends = true, endCol = slab, rnd, ground = true } = o;
  const H = Y(floors), uw = L / units;
  for (let f = from; f < floors; f++) {
    const y = Y(f);
    k.color(slab); k.box('concrete', L / 2, y - 0.1, D / 2, L, 0.2, D);
    if (rail === 'solid') {
      k.color(o.solidCol || slab); k.box(o.solidMat || 'concrete', L / 2, y + 0.55, D - 0.08, L, 1.1, 0.16);
      k.color(railCol); k.box('metal', L / 2, y + 1.14, D - 0.08, L, 0.05, 0.2);
    } else if (rail === 'steel') {
      k.color(railCol);
      k.box('metal', L / 2, y + 1.1, D - 0.04, L, 0.06, 0.06);
      k.box('metal', L / 2, y + 0.12, D - 0.04, L, 0.04, 0.05);
      for (let x = 0.08; x < L; x += 0.11) k.box('metal', x, y + 0.6, D - 0.04, 0.025, 0.96, 0.025);
    } else {
      k.color(rail === 'frost' ? C('#ffffff') : C('#ffffff'));
      k.face(rail === 'frost' ? 'frost' : 'glassRail', [[0.05, y + 0.02, D - 0.06], [L - 0.05, y + 0.02, D - 0.06], [L - 0.05, y + 1.08, D - 0.06], [0.05, y + 1.08, D - 0.06]]);
      k.color(railCol);
      k.box('metal', L / 2, y + 1.12, D - 0.06, L, 0.06, 0.08);
      for (let x = 0.05; x < L; x += rail === 'glass' ? 1.8 : 1.2) k.box('metal', x, y + 0.56, D - 0.06, 0.04, 1.1, 0.05);
    }
    // 隔て板と、室外機・物干し・鉢
    for (let u = 1; u < units; u++) { k.color(C('#e2e0da')); k.box('paint', u * uw, y + 1.0, D / 2, 0.03, 2.0, D - 0.1); }
    for (let u = 0; u < units; u++) {
      const a = u * uw;
      if (rnd() < 0.85) { k.color(C('#e6e6e0')); k.box('plastic', a + 0.55, y + 0.3, 0.35, 0.76, 0.56, 0.28); }
      // ガラスの手すりのマンションは外に洗濯物を干さない（管理規約）
      if (rail !== 'glass' && rnd() < 0.45) {
        k.color(C('#b5bcc0')); k.rod('metal', [a + 0.3, y + 1.9, D - 0.35], [a + uw - 0.3, y + 1.9, D - 0.35], 0.025);
        const n = 2 + Math.floor(rnd() * 4), cols = ['#f4f2ec', '#e8e4da', '#3a5a8a', '#d86a5a', '#8ab0c8'];
        for (let q = 0; q < n; q++) { k.color(C(cols[Math.floor(rnd() * cols.length)])); k.geo('cloth', clothGeo(0.35 + rnd() * 0.2, 0.4 + rnd() * 0.3, q + u + f, 0.02), new THREE.Matrix4().setPosition(a + 0.8 + q * 0.5, y + 1.88, D - 0.35)); }
      }
      if (rnd() < 0.3) pottedPlant(k, a + uw - 0.5, y, D - 0.35, { kind: ['geranium', 'hosta', 'marigold', 'spider'][Math.floor(rnd() * 4)], s: 0.8, seed: u + f * 7 });
      k.at(m);
    }
  }
  // 最上階のバルコニーの庇
  k.color(slab); k.box('concrete', L / 2, H - 0.1, D / 2, L, 0.2, D);
  // 両端の袖壁（全階通し）
  if (ends) { k.color(endCol); for (const x of [0.1, L - 0.1]) k.box('concrete', x, (Y(from) + H) / 2 - 0.1, D / 2, 0.2, H - Y(from) + 0.2, D); }
  // 1 階は専用庭（低い柵）
  if (ground && from >= 1) {
    k.color(C('#7a7670'));
    k.box('metal', L / 2, 0.8, D + 0.4, L, 0.05, 0.05);
    for (let x = 0.1; x < L; x += 1.0) k.box('metal', x, 0.4, D + 0.4, 0.05, 0.8, 0.05);
    for (let u = 1; u < units; u++) k.box('metal', u * uw, 0.4, (D + 0.4) / 2, 0.05, 0.8, D + 0.4);
  }
}

// 外廊下の列（壁の座標系）
function corridors(k, m, L, o) {
  k.at(m);
  const { floors, Y, D = 1.3, rail = 'solid', col = C('#e8e6e0'), railCol = C('#8a7a6a'), solidMat = 'concrete', from = 1 } = o;
  for (let f = from; f < floors; f++) {
    const y = Y(f);
    k.color(col); k.box('concrete', L / 2, y - 0.1, D / 2, L, 0.2, D);
    if (rail === 'solid') {
      k.color(o.solidCol || col); k.box(solidMat, L / 2, y + 0.55, D - 0.08, L, 1.1, 0.16);
      k.color(C('#9aa0a2')); k.box('metal', L / 2, y + 1.14, D - 0.08, L + 0.02, 0.05, 0.2);
      // 腰壁の目地
      k.color(C('#d0cec8')); k.box('concrete', L / 2, y + 0.3, D + 0.001, L, 0.03, 0.01);
    } else {
      k.color(railCol);
      k.box('paint', L / 2, y + 0.55, D - 0.04, L, 0.9, 0.03);
      k.box('metal', L / 2, y + 1.08, D - 0.04, L, 0.07, 0.07);
      for (let x = 0.05; x < L; x += 1.8) k.box('metal', x, y + 0.55, D - 0.02, 0.06, 1.1, 0.06);
      // 廊下の両端も手すりの板でふさぐ
      for (const x of [0.02, L - 0.02]) { k.box('paint', x, y + 0.55, D / 2, 0.03, 0.9, D); k.box('metal', x, y + 1.08, D / 2, 0.07, 0.07, D); }
    }
    // 天井の照明
    k.color(C('#fff6e0')); for (let x = 1.2; x < L; x += 3) k.box('lamp', x, Y(f + 1) - 0.21, D * 0.5, 0.3, 0.03, 0.12);
  }
  // 最上階の廊下の屋根（屋上のパラペットを廊下の先まで回す）
  const H = Y(floors);
  k.color(col); k.box('concrete', L / 2, H - 0.1, D / 2, L, 0.2, D);
  k.color(o.solidCol || col); k.box(solidMat, L / 2, H + 0.45, D - 0.08, L, 0.9, 0.16);
  k.color(C('#9aa0a2')); k.box('metal', L / 2, H + 0.92, D - 0.08, L + 0.02, 0.05, 0.22);
  for (const x of [0.08, L - 0.08]) { k.color(o.solidCol || col); k.box(solidMat, x, H + 0.45, D / 2, 0.16, 0.9, D); }
  if (from >= 1) { k.color(C('#fff6e0')); for (let x = 1.2; x < L; x += 3) k.box('lamp', x, Y(1) - 0.21, D * 0.5, 0.3, 0.03, 0.12); }
}

// 屋上の手すり（鉄骨の柵）
function roofRail(k, M, b, y) {
  k.at(M); k.color(C('#9aa0a2'));
  const segs = [[b.x0, b.z1, b.x1, b.z1], [b.x1, b.z1, b.x1, b.z0], [b.x1, b.z0, b.x0, b.z0], [b.x0, b.z0, b.x0, b.z1]];
  for (const [ax, az, bx, bz] of segs) {
    const L = Math.hypot(bx - ax, bz - az);
    k.rod('metal', [ax, y + 1.1, az], [bx, y + 1.1, bz], 0.04);
    k.rod('metal', [ax, y + 0.55, az], [bx, y + 0.55, bz], 0.03);
    for (let s = 0; s <= L; s += 1.5) { const t = s / L; k.rod('metal', [ax + (bx - ax) * t, y, az + (bz - az) * t], [ax + (bx - ax) * t, y + 1.1, az + (bz - az) * t], 0.04); }
  }
}

// 建物名の板（name: マテリアル名、text）
function bldgName(k, key, text, { fg = '#2a2a2a', bg = null, font = GOTHIC, w = 1024, h = 192, weight = 900 } = {}) {
  return sign(k, key, w, h, (g, W, H) => {
    g.clearRect(0, 0, W, H);
    if (bg) { g.fillStyle = bg; g.fillRect(0, 0, W, H); }
    g.fillStyle = fg; g.font = `${weight} ${H * 0.6}px ${font}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, W / 2, H * 0.54);
  }, [`${weight} ${h * 0.6}px ${font}`], { alphaTest: bg ? 0 : 0.5, transparent: false });
}

function stageApartment(k, env, rnd, level) {
  const M = env.M;
  // 段階ごとの寸法
  const spec = {
    4: { b: { x0: -8.9, x1: 4.9, z0: -3.6, z1: 2.0 }, floors: 3, fh: 2.85, units: 3, corridor: 'steel', rail: 'steel', wallMat: 'siding', wallCol: C('#e6dcc6'), trim: C('#7a5a44'), name: 'コーポ みなと' },
    5: { b: { x0: -7.3, x1: 4.4, z0: -3.4, z1: 2.3 }, floors: 5, fh: 2.95, units: 3, corridor: 'solid', rail: 'frost', wallMat: 'ohTile', wallCol: C('#e2cdb0'), trim: C('#f2efe8'), core: { x0: 4.4, x1: 8.8 }, name: 'みなとハイツ' },
    6: { b: { x0: -7.3, x1: 4.6, z0: -3.6, z1: 2.2 }, floors: 8, fh: 3.0, units: 3, corridor: 'solid', rail: 'glass', wallMat: 'ohTile', wallCol: C('#f2f0ea'), trim: C('#3e4246'), core: { x0: 4.6, x1: 9.0 }, name: 'グランシエル湊' },
    7: { b: { x0: -7.3, x1: 4.8, z0: -3.3, z1: 2.1 }, floors: 12, fh: 3.05, f1: 5.2, units: 3, corridor: 'none', rail: 'glass', wallMat: 'ohTile', wallCol: C('#e8e8e6'), trim: C('#2e3236'), core: { x0: 4.8, x1: 9.1 }, name: 'MINATO TOWER' },
  }[level];
  const { b, floors, fh, units } = spec, f1 = spec.f1 || fh;
  const Y = (f) => (f <= 0 ? 0.15 : 0.15 + f1 + (f - 1) * fh), FH = (f) => (f === 0 ? f1 : fh);
  const H = Y(floors);
  const tower = level === 7;
  k.at(M);
  k.color(C('#9d9b94')); k.box('concrete', (b.x0 + b.x1) / 2, (0.15 - 0.6) / 2, (b.z0 + b.z1) / 2, b.x1 - b.x0 + 0.3, 0.75, b.z1 - b.z0 + 0.3);
  // 壁
  for (const [ax, az, bx, bz, side] of SIDES(b)) {
    const { m, L } = wallFrame(M, ax, az, bx, bz, 0);
    const o = { floors, Y, FH, units, wallMat: spec.wallMat, wallCol: spec.wallCol, baseMat: 'concrete', baseCol: C('#6e6a66'), baseH: level >= 5 ? 1.0 : 0, bandCol: spec.trim, doorCol: level === 4 ? C('#8a6a4a') : C('#5a5048') };
    if (side === 'front') {
      if (tower) {
        // タワー: 1 階は 2 層吹き抜けのロビー（ガラス）、上はガラスのバルコニー
        aptWall(k, m, L, { ...o, kind: 'balcony', skip0: true, lobby: { x0: 0.6, x1: L - 0.6, y0: 0.15, y1: Y(1) - 0.4 } });
        k.at(m);
        k.color(C('#6a7e86')); k.face('windowLobby', [[0.6, 0.2, -0.16], [L - 0.6, 0.2, -0.16], [L - 0.6, Y(1) - 0.4, -0.16], [0.6, Y(1) - 0.4, -0.16]], [[0.6, 0.05], [L - 0.6, 0.05], [L - 0.6, Y(1) - 0.55], [0.6, Y(1) - 0.55]]);
        k.color(C('#2e3236')); for (let x = 0.6; x <= L - 0.59; x += (L - 1.2) / 6) k.box('metal', x, (Y(1) - 0.2) / 2, -0.25, 0.1, Y(1) - 0.5, 0.14);
        k.box('metal', L / 2, 2.6, -0.25, L - 1.2, 0.1, 0.14);
        balconies(k, m, L, { floors, Y, units, D: 1.5, rail: 'glass', rnd, from: 1, railCol: spec.trim, slab: C('#f4f4f2'), ground: false });
      } else {
        aptWall(k, m, L, { ...o, kind: 'corridor' });
        corridors(k, m, L, { floors, Y, D: 1.3, rail: spec.corridor === 'steel' ? 'steel' : 'solid', col: level === 4 ? C('#d8d2c4') : spec.trim, railCol: spec.trim, solidMat: level === 5 ? 'ohTile' : 'concrete', solidCol: level === 5 ? C('#e2cdb0') : C('#f4f3ef') });
      }
    } else if (side === 'back') {
      aptWall(k, m, L, { ...o, kind: 'balcony' });
      balconies(k, m, L, { floors, Y, units, D: tower ? 1.5 : 1.2, rail: spec.rail, rnd, railCol: level === 4 ? spec.trim : C('#5e5a56'), slab: level === 4 ? C('#e8e2d4') : C('#f2f0ea'), from: 1, ground: !tower });
    } else {
      // 8 階は妻側を濃い灰色のタイルにして、白い廊下の帯を引きしめる
      aptWall(k, m, L, { ...o, kind: 'side', skip0: tower, wallCol: level === 6 ? C('#7a7e82') : o.wallCol });
    }
  }
  k.at(M);
  // 屋上: パラペットと防水面
  {
    const w = b.x1 - b.x0, d = b.z1 - b.z0, cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2;
    k.color(C('#9b9a94')); k.box('concrete', cx, H + 0.05, cz, w - 0.2, 0.1, d - 0.2);
    k.color(level === 4 ? C('#e6dcc6') : spec.wallCol);
    for (const [x, z, sx, sz] of [[cx, b.z1, w, 0.25], [cx, b.z0, w, 0.25], [b.x0, cz, 0.25, d], [b.x1, cz, 0.25, d]]) k.box(level === 4 ? 'siding' : 'ohTile', x, H + 0.45, z, sx, 0.9, sz);
    k.color(spec.trim); for (const [x, z, sx, sz] of [[cx, b.z1, w + 0.1, 0.35], [cx, b.z0, w + 0.1, 0.35], [b.x0, cz, 0.35, d], [b.x1, cz, 0.35, d]]) k.box('metal', x, H + 0.92, z, sx, 0.06, sz);
    // 室外機・アンテナ
    k.color(C('#d8d8d2'));
    k.rod('metal', [b.x0 + 1.5, H, b.z0 + 1.2], [b.x0 + 1.5, H + 2.4, b.z0 + 1.2], 0.05);
    for (let q = 0; q < 3; q++) k.rod('metal', [b.x0 + 1.5, H + 1.6 + q * 0.3, b.z0 + 0.6], [b.x0 + 1.5, H + 1.6 + q * 0.3, b.z0 + 1.8], 0.02);
    k.color(C('#f0f0ec')); k.geo('plastic', new THREE.SphereGeometry(0.4, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2.5).rotateX(-Math.PI / 2 + 0.7).rotateY(-0.5), new THREE.Matrix4().setPosition(b.x0 + 2.6, H + 0.9, b.z0 + 1.0));
    if (level === 4) {
      // 高架水槽の代わりの受水槽と、屋根の上のソーラー温水器（アパートらしく）
      k.color(C('#dcd8c8')); k.box('plastic', b.x1 - 2.2, H + 0.7, cz, 1.8, 1.2, 1.4);
      k.color(C('#c4bfad')); for (let q = 1; q < 2; q++) k.box('plastic', b.x1 - 2.2, H + 0.1 + q, cz, 1.83, 0.04, 1.43);
    }
  }
  env.solid?.([[b.x0, b.z0], [b.x1, b.z0], [b.x1, b.z1], [b.x0, b.z1]], H + 2);
  // 階段・エレベーターの塔
  if (level === 4) {
    k.at(M);
    // 集合ポストと駐輪場、名前の板
    const nm = bldgName(k, 'ohNameCorp', spec.name, { fg: '#4a3222', bg: '#e8dcc0', font: MINCHO });
    plate(k, nm, (b.x0 + b.x1) / 2, Y(1) + 0.55, b.z1 + 1.29, 2.4, 0.45, 1);
    k.color(C('#b8bcbe')); k.box('metal', -5.0, 1.1, b.z1 + 1.6, 1.4, 0.8, 0.35);
    k.color(C('#8e9496')); for (let q = 0; q < 3; q++) for (let r2 = 0; r2 < 3; r2++) k.box('metal', -5.43 + q * 0.43, 0.83 + r2 * 0.26, b.z1 + 1.78, 0.38, 0.2, 0.01);
    k.color(C('#9aa0a2')); for (const x of [-5.6, -4.4]) k.box('metal', x, 0.35, b.z1 + 1.6, 0.05, 0.7, 0.05);
    env.fence?.(-5.7, b.z1 + 1.6, -4.3, b.z1 + 1.6, 0.3);
  } else {
    const c = spec.core, z0 = b.z0 + 1.2, z1 = b.z1 + (tower ? 0 : 1.3), top = H + 2.6, w = c.x1 - c.x0;
    k.at(M);
    const coreCol = level === 5 ? C('#b9a488') : level === 6 ? C('#dedcd6') : C('#3a3e42');
    k.color(C('#9d9b94')); k.box('concrete', (c.x0 + c.x1) / 2, -0.225, (z0 + z1) / 2, w + 0.3, 0.75, z1 - z0 + 0.3);
    for (const [ax, az, bx, bz, side] of SIDES({ x0: c.x0, x1: c.x1, z0, z1 })) {
      const { m, L } = wallFrame(M, ax, az, bx, bz, 0);
      k.at(m);
      const holes = [];
      // 正面: 1 階はエントランス（ガラスの自動ドア）、上は階段室の縦長のガラス
      if (side === 'front') { holes.push({ x0: 0.5, x1: L - 0.5, y0: 0.15, y1: tower ? Y(1) - 0.4 : 2.7 }, { x0: L - 1.5, x1: L - 0.5, y0: Y(1) + 0.6, y1: H - 0.6 }); }
      if (side === 'right') holes.push({ x0: 0.8, x1: 1.6, y0: Y(1) + 0.6, y1: H - 0.6 });
      k.color(coreCol); holeyWall(k, level <= 6 ? 'ohTile' : 'concrete', L, 0, top, holes, 0.2);
      for (const h of holes) {
        if (h.y0 < 1) {
          k.color(C('#6a7e86')); k.face('windowLobby', [[h.x0, h.y0, -0.2], [h.x1, h.y0, -0.2], [h.x1, h.y1, -0.2], [h.x0, h.y1, -0.2]], [[h.x0, 0], [h.x1, 0], [h.x1, h.y1 - h.y0], [h.x0, h.y1 - h.y0]]);
          k.color(C('#a9aeb0')); for (const x of [h.x0 + 0.05, (h.x0 + h.x1) / 2, h.x1 - 0.05]) k.box('metal', x, (h.y0 + h.y1) / 2, -0.15, 0.06, h.y1 - h.y0, 0.08);
          k.box('metal', (h.x0 + h.x1) / 2, h.y0 + 2.3, -0.15, h.x1 - h.x0, 0.08, 0.08);
          continue;
        }
        k.color(C('#6f8791')); k.face('glass', [[h.x0, h.y0, -0.2], [h.x1, h.y0, -0.2], [h.x1, h.y1, -0.2], [h.x0, h.y1, -0.2]]);
        k.color(C('#d8d8d2')); for (let y = Y(1) + fh * 0.5; y < H - 0.8; y += fh / 2) k.box('concrete', (h.x0 + h.x1) / 2, y, -0.7, h.x1 - h.x0, 0.16, 0.9);
      }
    }
    k.at(M);
    k.color(C('#9b9a94')); k.box('concrete', (c.x0 + c.x1) / 2, top + 0.05, (z0 + z1) / 2, w - 0.2, 0.1, z1 - z0 - 0.2);
    // エントランスの庇と、建物名の切り文字
    const cw = w + 0.6, cd = tower ? 2.2 : 1.4, cy = tower ? Y(1) - 0.2 : 2.95;
    k.color(C('#eeefec')); k.box('concrete', (c.x0 + c.x1) / 2, cy, z1 + cd / 2, cw, 0.25, cd);
    k.color(C('#d8d8d2')); k.face('glowV', [[c.x0 - 0.3, cy - 0.126, z1], [c.x1 + 0.3, cy - 0.126, z1], [c.x1 + 0.3, cy - 0.126, z1 + cd], [c.x0 - 0.3, cy - 0.126, z1 + cd]]);
    const nm = bldgName(k, 'ohName' + level, spec.name, { fg: level <= 6 ? '#3a3a3a' : '#f4f2ec', font: level === 7 ? '"Zen Kaku Gothic New", sans-serif' : level === 6 ? MINCHO : GOTHIC, weight: level === 7 ? 700 : 900 });
    if (tower) {
      // タワー: 塔の正面に縦長の名前は置かず、庇の鼻先と、頂部に大きく
      plate(k, nm, (c.x0 + c.x1) / 2, cy + 0.02, z1 + cd + 0.01, cw * 0.9, 0.22, 1);
    } else {
      plate(k, nm, (c.x0 + c.x1) / 2, top - 1.3, z1 + 0.012, w * 0.9, w * 0.9 * 0.1875, 1);
    }
    k.color(C('#fff6e0')); for (let x = c.x0 + 0.6; x < c.x1 - 0.3; x += 1.2) k.cyl('lamp', x, cy - 0.14, z1 + 1.1, 0.07, 0.012, 10);
    env.fence?.(c.x0, z1, c.x1, z1, 0.1);
    env.solid?.([[c.x0, z0], [c.x1, z0], [c.x1, z1], [c.x0, z1]], top + 1);
    // エレベーターの機械室の屋根の手すり
    roofRail(k, M, { x0: c.x0 + 0.1, x1: c.x1 - 0.1, z0: z0 + 0.1, z1: z1 - 0.1 }, top + 0.1);
    k.at(M);
  }
  // 8・12 階: 角の縦の枠（2 階から最上階まで通す）と、頂部の飾り
  if (level >= 6) {
    k.color(spec.trim);
    const fz = b.z0 - (tower ? 1.5 : 1.2);
    for (const x of [b.x0 - 0.25, b.x1 + 0.05]) k.box('concrete', x, (Y(1) + H + 1.2) / 2, (fz + b.z0) / 2 - 0.05, 0.5, H + 1.2 - Y(1), b.z0 - fz + 0.3);
    if (tower) for (const x of [b.x0 - 0.25, b.x1 + 0.05]) k.box('concrete', x, (Y(1) + H + 1.2) / 2, b.z1 + 0.75, 0.5, H + 1.2 - Y(1), 1.8);
    // 頂部のルーバーの帯（タワーは夜に光る帯）
    const y0 = H + 1.0, hh = tower ? 2.4 : 1.4;
    k.color(C('#b9bec0'));
    for (const [ax, az, bx, bz] of [[b.x0 - 0.3, b.z1 + (tower ? 1.6 : 0.2), b.x1 + 0.1, b.z1 + (tower ? 1.6 : 0.2)], [b.x0 - 0.3, b.z0 - (tower ? 1.6 : 1.3), b.x1 + 0.1, b.z0 - (tower ? 1.6 : 1.3)]]) {
      const L = Math.hypot(bx - ax, bz - az), n = Math.round(L / 0.35);
      for (let q = 0; q <= n; q++) { const t = q / n; k.box('metal', ax + (bx - ax) * t, y0 + hh / 2, az + (bz - az) * t, 0.06, hh, 0.3); }
      k.color(tower ? C('#fff2d8') : C('#b9bec0')); k.box(tower ? 'glowTop' : 'metal', (ax + bx) / 2, y0 + hh + 0.05, az, L, 0.1, 0.4);
      k.color(C('#b9bec0'));
    }
    if (tower) {
      const nm = bldgName(k, 'ohNameTop', spec.name, { fg: '#f4f2ec', weight: 700 });
      plate(k, nm, (b.x0 + b.x1) / 2 - 0.1, y0 + hh / 2, b.z1 + 1.78, 7.2, 1.35, 1);
      // ロビーの前の植え込みと車寄せ
      groundPatch(k, env, b.x0 - 0.6, b.z1, OWNER_LOT.x1 - 0.1, 5.3, 'fPaving', C('#d8d2c6'), 0.03, 1);
      k.at(M);
    }
  }
  // 地面: 敷地の前は舗装、端に植え込み・駐輪場
  {
    const zf = b.z1 + (tower ? 0 : 1.3);
    if (level === 4) groundPatch(k, env, b.x0 - 0.3, zf, b.x1 + 0.3, 5.3, 'fConcrete', C('#c9c6be'), 0.03, 1);
    else if (!tower) groundPatch(k, env, b.x0 - 0.3, zf, OWNER_LOT.x1 - 0.2, 5.3, 'fPaving', C('#dcd6c8'), 0.03, 1);
    if (zf - b.z1 > 0.1) groundPatch(k, env, b.x0 - 0.3, b.z1, b.x1, zf, 'fConcrete', C('#cfccc4'), 0.028, 1);
    k.at(M);
    // 植え込み（低い縁石の中に低木）。エントランスの前はあける
    const px0 = level === 4 ? -4.4 : b.x0 - 0.2, px1 = level === 4 ? 4.4 : b.x1 - 0.6, pz = 4.75;
    k.color(C('#cfcac0')); k.box('concrete', (px0 + px1) / 2, 0.15, pz, px1 - px0, 0.3, 0.9);
    k.color(C('#5b4a38')); k.box('dark', (px0 + px1) / 2, 0.29, pz, px1 - px0 - 0.2, 0.03, 0.75);
    for (let x = px0 + 0.45; x < px1 - 0.3; x += 0.9) env.tree?.('shrub', x, pz, 0.75);
    env.fence?.(px0, pz, px1, pz, 0.5);
    if (level === 4) env.tree?.('b-oak', 4.3, 4.5, 0.32);
    else env.tree?.(level >= 6 ? 'b-keyaki' : 'b-oak', px0 + 0.6, 4.3, level >= 6 ? 0.5 : 0.42);
    if (level >= 5) env.tree?.('b-garden', 9.0, 4.7, 0.6);
    // 駐輪場: アパートは道ぞいに縦に、マンションは左の脇に屋根つき
    const cols = ['#c8423a', '#2f5a9a', '#e8e4da', '#3a3a3a', '#6a8a4a', '#d8b02a'];
    if (level === 4) {
      for (let q = 0; q < 4; q++) bicycle(k, env.at(-8.4 + q * 0.7, 4.3, Math.PI / 2 + 0.05 * (q % 2)), C(cols[q]), rnd);
      k.at(M);
      env.solid?.([[-8.8, 3.4], [-6.0, 3.4], [-6.0, 5.2], [-8.8, 5.2]], 1.2);
    } else {
      const x0 = -9.45, x1 = b.x0 - 0.1, za = -2.6, zb = 1.6;
      for (let q = 0; q < 6; q++) bicycle(k, env.at((x0 + x1) / 2, za + 0.35 + q * 0.7, q % 2 ? 0 : Math.PI), C(cols[q]), rnd);
      k.at(M);
      k.color(C('#9aa0a2')); for (const z of [za, zb]) k.box('metal', x0 + 0.1, 1.1, z, 0.08, 2.2, 0.08);
      k.color(C('#b8c8cc')); k.box('glass', (x0 + x1) / 2, 2.22, (za + zb) / 2, x1 - x0, 0.05, zb - za + 0.3);
      groundPatch(k, env, x0, za - 0.3, x1, zb + 0.3, 'fConcrete', C('#cfccc4'), 0.03, 1);
      k.at(M);
      env.solid?.([[x0, za], [x1, za], [x1, zb], [x0, zb]], 1.2);
    }
  }
}

// ---------- 組み立て ----------
export function buildOwnerHome(k, env, stage = 0, r = null) {
  stage = Math.max(0, Math.min(7, stage | 0));
  mats(k);
  env.chunk?.(0, 0);
  const rnd = rngOf(4242 + stage * 97);
  k.at(env.M);
  [stageEmpty, stageShack, stageOldHouse, stageHouse][stage]?.(k, env, rnd);
  if (stage >= 4) stageApartment(k, env, rnd, stage);
  k.at(env.M);
  void r;
  return { stage, name: OWNER_STAGES[stage] };
}
