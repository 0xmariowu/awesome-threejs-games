// 町の小物: 電柱・電線・カーブミラー・塀・フェンス・ポスト（自販機・車・自転車は vending.js / vehicles.js）
import * as THREE from 'three';

const C = (h) => new THREE.Color(h);
const pick = (a, r) => a[Math.floor(r() * a.length) % a.length];

// ---------- 電柱 ----------
// ローカル: 原点 = 根元、x = 腕金の向き（道と直角）、z = 道に沿う
// 戻り値: 電線を掛ける点（ローカル）
export function pole(k, M, r, { transformer = false, lamp = false, plate = true } = {}) {
  k.at(M);
  const H = 12;
  k.color(C('#c9c6bc'));
  k.cyl('concrete', 0, -0.5, 0, 0.19, H + 0.5, 14, 0.13);
  // 帯と足場ボルト
  k.color(C('#8e8b84'));
  for (let y = 2.4; y < H - 1.6; y += 0.45) {
    const a = (Math.floor(y / 0.45) % 2) * Math.PI / 2;
    const m = new THREE.Matrix4().makeRotationY(a).setPosition(0, y, 0);
    k.geo('metal', new THREE.BoxGeometry(0.62, 0.025, 0.025), m);
  }
  // 腕金と碍子（上 2 段）
  const pts = { power: [], tel: [] };
  for (const [y, len] of [[H - 0.35, 1.9], [H - 1.25, 1.6]]) {
    k.color(C('#7c7f82'));
    k.box('metal', 0, y, 0, len, 0.08, 0.08);
    k.rod('metal', [-len * 0.35, y - 0.05, 0], [0, y - 0.55, 0], 0.035);
    k.rod('metal', [len * 0.35, y - 0.05, 0], [0, y - 0.55, 0], 0.035);
    for (const x of [-len / 2 + 0.12, 0.25, len / 2 - 0.12]) {
      k.color(C('#f1efe8'));
      for (let q = 0; q < 3; q++) k.cyl('trim', x, y + 0.04 + q * 0.07, 0, 0.06 - q * 0.008, 0.05, 10);
      pts.power.push([x, y + 0.24, 0]);
    }
  }
  // 変圧器
  if (transformer) {
    k.color(C('#9aa1a5'));
    k.cyl('metal', -0.45, H - 4.4, 0, 0.3, 1.05, 16);
    k.cyl('metal', -0.45, H - 3.35, 0, 0.33, 0.05, 16);
    k.color(C('#7c7f82'));
    k.box('metal', -0.2, H - 3.9, 0, 0.3, 0.1, 0.12);
    k.box('metal', -0.2, H - 4.2, 0, 0.3, 0.1, 0.12);
    k.color(C('#2a2a2a'));
    for (const x of [-0.6, -0.45, -0.3]) k.rod('rubber', [x, H - 3.3, 0], [x * 0.5, H - 1.6, 0.05], 0.025);
  }
  // 通信線（黒い太い線）の金具とクロージャ
  k.color(C('#5a5c5e'));
  k.box('metal', 0.16, H - 4.9, 0, 0.3, 0.08, 0.08);
  pts.tel.push([0.3, H - 4.9, 0]);
  if (r() < 0.4) { k.color(C('#2c2c2e')); const m = new THREE.Matrix4().makeRotationZ(Math.PI / 2).setPosition(0.3, H - 5.2, 0.35); m.multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2)); k.geo('rubber', new THREE.CylinderGeometry(0.1, 0.1, 0.7, 10), new THREE.Matrix4().makeRotationX(Math.PI / 2).setPosition(0.3, H - 5.2, 0.4)); }
  // 防犯灯
  if (lamp) {
    k.color(C('#b0b3b6'));
    k.rod('metal', [0, 5.2, 0], [0.9, 5.6, 0], 0.05);
    k.color(C('#f4f2ea')); k.box('lamp', 0.95, 5.5, 0, 0.45, 0.1, 0.18);
  }
  // 住所の看板・巻き付け広告
  if (plate) {
    k.color(C('#2d5aa0')); k.box('paint', 0, 2.2, 0.2, 0.28, 0.9, 0.02);
    k.color(C('#f0f0ea')); k.box('trim', 0, 2.2, 0.212, 0.22, 0.8, 0.005);
  }
  // 支線（斜めのワイヤーと黄色いカバー）
  if (r() < 0.25) {
    k.color(C('#6b6d70')); k.rod('metal', [0, H - 1.5, 0], [0, 0, 3.0], 0.02);
    k.color(C('#e8c21a')); k.rod('plastic', [0, 1.8, 1.65], [0, 0, 3.0], 0.09);
  }
  return pts;
}

// 電線: たるみのある管
export function wire(k, a, b, rad = 0.012, sag = 0.025) {
  const L = Math.hypot(b[0] - a[0], b[2] - a[2]), s = L * sag;
  const N = 10;
  let prev = a;
  for (let q = 1; q <= N; q++) {
    const t = q / N;
    const p = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - 4 * t * (1 - t) * s, a[2] + (b[2] - a[2]) * t];
    k.rod('rubber', prev, p, rad * 2);
    prev = p;
  }
}

// ---------- カーブミラー ----------
export function curveMirror(k, M) {
  k.at(M);
  k.color(C('#e0602a'));
  k.cyl('paint', 0, 0, 0, 0.038, 3.2, 10);
  const m = new THREE.Matrix4().makeRotationX(Math.PI / 2).setPosition(0, 3.3, 0.08);
  k.geo('paint', new THREE.TorusGeometry(0.4, 0.04, 8, 28), m);
  k.color(C('#b6c3cc'));
  k.geo('glass', new THREE.SphereGeometry(0.4, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.18).rotateX(Math.PI / 2).scale(1, 1, 1).translate(0, 0, -0.34), new THREE.Matrix4().setPosition(0, 3.3, 0.08));
  k.color(C('#e0602a'));
  k.box('paint', 0, 3.3, 0.02, 0.1, 0.1, 0.1);
}

// ---------- 自販機・車・自転車（別ファイル） ----------
export { vendingMachine, vendingTexture, recycleBin } from './vending.js';
export { car, bicycle, CAR_KINDS } from './vehicles.js';

// ---------- 塀・フェンス ----------
// 線分 a→b（ローカル xz）に沿って、地面の高さ fn(x,z)
export function blockWall(k, a, b, h, gy) {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const ex = (b[0] - a[0]) / L, ez = (b[1] - a[1]) / L, nx = -ez, nz = ex, t = 0.15;
  const y0 = Math.min(gy(a[0], a[1]), gy(b[0], b[1])) - 0.2, y1 = Math.max(gy(a[0], a[1]), gy(b[0], b[1])) + h;
  const P = (s, o, y) => [a[0] + ex * s + nx * o, y, a[1] + ez * s + nz * o];
  k.color(C('#ffffff'));
  // 両面と上
  k.face('block', [P(0, t / 2, y0), P(L, t / 2, y0), P(L, t / 2, y1), P(0, t / 2, y1)], [[0, y0], [L, y0], [L, y1], [0, y1]]);
  k.face('block', [P(L, -t / 2, y0), P(0, -t / 2, y0), P(0, -t / 2, y1), P(L, -t / 2, y1)], [[0, y0], [L, y0], [L, y1], [0, y1]]);
  for (const [s, sgn] of [[0, -1], [L, 1]]) k.face('block', [P(s, sgn * t / 2, y0), P(s, -sgn * t / 2, y0), P(s, -sgn * t / 2, y1), P(s, sgn * t / 2, y1)], [[0, y0], [t, y0], [t, y1], [0, y1]]);
  k.color(C('#a8a59c'));
  k.face('concrete', [P(0, t / 2 + 0.02, y1 + 0.05), P(L, t / 2 + 0.02, y1 + 0.05), P(L, -t / 2 - 0.02, y1 + 0.05), P(0, -t / 2 - 0.02, y1 + 0.05)].reverse());
  k.face('concrete', [P(0, t / 2 + 0.02, y1), P(L, t / 2 + 0.02, y1), P(L, t / 2 + 0.02, y1 + 0.05), P(0, t / 2 + 0.02, y1 + 0.05)]);
  k.face('concrete', [P(L, -t / 2 - 0.02, y1), P(0, -t / 2 - 0.02, y1), P(0, -t / 2 - 0.02, y1 + 0.05), P(L, -t / 2 - 0.02, y1 + 0.05)]);
}

export function aluFence(k, a, b, h, gy, col) {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const ex = (b[0] - a[0]) / L, ez = (b[1] - a[1]) / L;
  const y = Math.max(gy(a[0], a[1]), gy(b[0], b[1]));
  k.color(col);
  for (let s = 0.05; s < L; s += 0.12) k.rod('metal', [a[0] + ex * s, y, a[1] + ez * s], [a[0] + ex * s, y + h, a[1] + ez * s], 0.035);
  k.rod('metal', [a[0], y + h, a[1]], [b[0], y + h, b[1]], 0.05);
  k.rod('metal', [a[0], y + 0.05, a[1]], [b[0], y + 0.05, b[1]], 0.05);
  for (let s = 0; s <= L; s += 2) k.rod('metal', [a[0] + ex * s, y - 0.1, a[1] + ez * s], [a[0] + ex * s, y + h + 0.03, a[1] + ez * s], 0.07);
}

export function postBox(k, M) {
  k.at(M);
  k.color(C('#d42a22'));
  k.box('paint', 0, 0.45, 0, 0.14, 0.9, 0.14);
  k.box('paint', 0, 1.15, 0, 0.5, 0.56, 0.42);
  const g = new THREE.CylinderGeometry(0.26, 0.26, 0.5, 16, 1, false, 0, Math.PI);
  g.rotateZ(Math.PI / 2); g.rotateY(Math.PI / 2);
  k.geo('paint', g, new THREE.Matrix4().setPosition(0, 1.43, 0));
  k.color(C('#222')); k.box('dark', 0, 1.25, 0.215, 0.3, 0.04, 0.01);
}
