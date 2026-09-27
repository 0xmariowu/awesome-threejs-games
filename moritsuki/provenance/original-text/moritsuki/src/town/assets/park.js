// 吉山新町公園（家の向かい）: 土の広場と芝のへり、すべり台・ブランコ・ジャングルジム・鉄棒・砂場・水飲み場・ベンチ・時計・公園名の看板
// 敷地のローカル座標: 原点 = 公園の中心（y = 0 は基準の地面）、+z = 家の前の道の側。広さ w × d は landmarks.js（PLACES.park）
import * as THREE from 'three';
import { C, groundPatch, canvasTex, needMat } from './build.js';
import { flatMaterials } from '../lots.js';

const GOTHIC = '"Zen Kaku Gothic New", "Yu Gothic", sans-serif';

function parkMats(k) {
  needMat(k, 'parkSign', () => new THREE.MeshStandardMaterial({
    map: canvasTex('parkSign', 512, 256, (g, w, h) => {
      g.fillStyle = '#f6f3ea'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#2f6b3a'; g.fillRect(0, 0, w, 64);
      g.fillStyle = '#fff'; g.font = `900 44px ${GOTHIC}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('吉山新町公園', w / 2, 34);
      g.fillStyle = '#2a2a2a'; g.font = `700 22px ${GOTHIC}`; g.textAlign = 'left';
      ['・ボール遊びは広場で', '・ゴミは持ち帰りましょう', '・夜9時以降は静かに'].forEach((s, i) => g.fillText(s, 40, 110 + i * 42));
      g.font = `500 16px ${GOTHIC}`; g.fillStyle = '#555'; g.textAlign = 'right'; g.fillText('吉山市 公園緑地課', w - 24, h - 20);
    }, [`900 44px ${GOTHIC}`, `700 22px ${GOTHIC}`]),
    roughness: 0.6, vertexColors: true,
  }));
  needMat(k, 'clockFace', () => new THREE.MeshStandardMaterial({
    map: canvasTex('clockFace', 256, 256, (g, w, h) => {
      g.fillStyle = '#f7f6f0'; g.beginPath(); g.arc(w / 2, h / 2, 122, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#2a2a2a'; g.lineWidth = 10; g.stroke();
      g.fillStyle = '#2a2a2a';
      for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; g.save(); g.translate(w / 2, h / 2); g.rotate(a); g.fillRect(-4, -108, 8, i % 3 ? 14 : 24); g.restore(); }
      // 10:10 ごろ（午前中の町）
      const hand = (a, l, t) => { g.save(); g.translate(w / 2, h / 2); g.rotate(a); g.fillRect(-t / 2, -l, t, l + 10); g.restore(); };
      hand((10 / 12) * Math.PI * 2 + (10 / 60) * (Math.PI / 6), 62, 10);
      hand((10 / 60) * Math.PI * 2, 96, 7);
      g.fillStyle = '#c0392b'; g.beginPath(); g.arc(w / 2, h / 2, 7, 0, Math.PI * 2); g.fill();
    }),
    roughness: 0.4, vertexColors: true,
  }));
  Object.assign(k.mats, flatMaterials(), { ...k.mats });
}

// 2 点を結ぶ丸い管（遊具のパイプ）
function pipe(k, mat, a, b, r = 0.03, seg = 8) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
  const L = A.distanceTo(B);
  const g = new THREE.CylinderGeometry(r, r, L, seg, 1, true);
  const m = new THREE.Matrix4().lookAt(B, A, new THREE.Vector3(0, 1, 0)).multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2));
  m.setPosition(A.clone().add(B).multiplyScalar(0.5));
  k.geo(mat, g, m);
}

export function buildPark(k, env, { w, d }, r = Math.random) {
  parkMats(k);
  const hw = w / 2, hd = d / 2;
  const Y = (x, z) => env.gy(x, z);
  env.chunk?.(0, 0);
  // 地面: 土の広場（草は生えない）。まわり 2 m は芝
  groundPatch(k, env, -hw + 2, -hd + 2, hw - 2, hd - 2, 'fDirt', C('#f2e6c8'), 0.04, 1.5);
  k.at(env.M);

  // ---------- ブランコ（2 人乗り、赤い A 型の枠と黄色い座板、前に低い柵） ----------
  {
    const cx = -hw + 4.6, cz = -hd + 3.0, y = Y(cx, cz), H = 2.3, red = C('#c9392b');
    k.color(red);
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) pipe(k, 'paint', [cx + sx * 1.95, y, cz + sz * 0.95], [cx + sx * 1.8, y + H, cz], 0.045);
      pipe(k, 'paint', [cx + sx * 1.88, y + 0.9, cz - 0.55], [cx + sx * 1.88, y + 0.9, cz + 0.55], 0.03);
    }
    k.geo('paint', new THREE.CylinderGeometry(0.06, 0.06, 3.9, 12).rotateZ(Math.PI / 2), new THREE.Matrix4().setPosition(cx, y + H, cz));
    for (const sx of [-0.75, 0.75]) {
      const sy = y + 0.42 + (sx > 0 ? 0.02 : 0);
      k.color(C('#9ea3a6'));
      for (const dx of [-0.2, 0.2]) pipe(k, 'metal', [cx + sx + dx, y + H - 0.05, cz], [cx + sx + dx, sy + 0.03, cz + (sx > 0 ? 0.08 : 0)], 0.008, 4);
      k.color(C('#f0c43a')); k.box('plastic', cx + sx, sy, cz + (sx > 0 ? 0.08 : 0), 0.46, 0.04, 0.2);
    }
    // 安全柵（コの字のパイプ）
    k.color(C('#e0e2e0'));
    const fz = cz + 1.9;
    pipe(k, 'paint', [cx - 2.1, y + 0.6, fz], [cx + 2.1, y + 0.6, fz], 0.03);
    for (const x of [cx - 2.1, cx + 2.1]) { pipe(k, 'paint', [x, y, fz], [x, y + 0.6, fz], 0.03); pipe(k, 'paint', [x, y + 0.6, fz], [x, y + 0.6, cz + 1.2], 0.03); pipe(k, 'paint', [x, y, cz + 1.2], [x, y + 0.6, cz + 1.2], 0.03); }
    env.fence?.(cx - 2.1, fz, cx + 2.1, fz, 0.1);
    env.fence?.(cx - 2.0, cz, cx + 2.0, cz, 0.15);
  }

  // ---------- すべり台（はしご・手すり付きの踊り場・ステンレスの滑り面） ----------
  {
    const cx = hw - 4.0, z0 = -hd + 2.2, y = Y(cx, z0 + 2), top = 1.7, blue = C('#2f6fb3'), yel = C('#f0c43a');
    // 踊り場の 4 本柱と床
    k.color(blue);
    for (const [dx, dz] of [[-0.45, 0], [0.45, 0], [-0.45, 0.9], [0.45, 0.9]]) pipe(k, 'paint', [cx + dx, y, z0 + dz], [cx + dx, y + top + 0.95, z0 + dz], 0.05);
    k.color(yel); k.box('plastic', cx, y + top, z0 + 0.45, 0.95, 0.06, 0.95);
    // 手すり（両横と後ろ。前は滑り口、後ろははしごの口をあける）
    k.color(blue);
    for (const dx of [-0.45, 0.45]) { pipe(k, 'paint', [cx + dx, y + top + 0.5, z0], [cx + dx, y + top + 0.5, z0 + 0.9], 0.03); pipe(k, 'paint', [cx + dx, y + top + 0.95, z0], [cx + dx, y + top + 0.95, z0 + 0.9], 0.035); }
    k.color(C('#e8413a')); for (const dx of [-0.46, 0.46]) k.box('plastic', cx + dx, y + top + 0.3, z0 + 0.45, 0.03, 0.5, 0.8);
    // はしご（後ろ、少し傾ける）
    k.color(blue);
    for (const dx of [-0.3, 0.3]) pipe(k, 'paint', [cx + dx, y, z0 - 0.9], [cx + dx, y + top + 0.9, z0 - 0.05], 0.035);
    k.color(C('#b9bdbf'));
    for (let q = 1; q <= 6; q++) { const t = q / 7; pipe(k, 'metal', [cx - 0.3, y + t * (top + 0.9) - 0.02, z0 - 0.9 + t * 0.85], [cx + 0.3, y + t * (top + 0.9) - 0.02, z0 - 0.9 + t * 0.85], 0.022); }
    // 滑り面: 踊り場から前へ下りる板（側壁付き）。先は水平に伸びる
    const zs = z0 + 0.9, L1 = 3.0, zb = zs + L1, yb = y + 0.35;
    const chute = (za, ya, zc, yc) => {
      const len = Math.hypot(zc - za, yc - ya), ang = Math.atan2(ya - yc, zc - za);
      const m = new THREE.Matrix4().makeRotationX(ang).setPosition(cx, (ya + yc) / 2, (za + zc) / 2);
      const T = (x, yy, z) => new THREE.Matrix4().multiplyMatrices(m, new THREE.Matrix4().makeTranslation(x, yy, z));
      k.color(C('#d9dde0')); k.geo('chrome', new THREE.BoxGeometry(0.5, 0.03, len), T(0, 0, 0));
      k.color(yel); for (const s of [-1, 1]) k.geo('plastic', new THREE.BoxGeometry(0.05, 0.22, len), T(s * 0.27, 0.09, 0));
    };
    chute(zs, y + top, zb, yb);
    chute(zb, yb, zb + 0.6, yb);
    k.color(blue); for (const dx of [-0.25, 0.25]) pipe(k, 'paint', [cx + dx, y, zb + 0.4], [cx + dx, yb, zb + 0.4], 0.035);
    env.fence?.(cx, z0 - 0.9, cx, zb + 0.6, 0.45);
  }

  // ---------- ジャングルジム（0.8 m の格子を 3 × 3 × 3、段ごとに色） ----------
  {
    const cx = 0.5, cz = -hd + 3.4, y = Y(cx, cz), s = 0.8, n = 3;
    const cols = ['#c9392b', '#f0c43a', '#2f6fb3', '#3f9a4a'];
    const x0 = cx - (n * s) / 2, z0 = cz - (n * s) / 2;
    for (let j = 0; j <= n; j++) {
      k.color(C(cols[j]));
      for (let i = 0; i <= n; i++) {
        pipe(k, 'paint', [x0, y + j * s, z0 + i * s], [x0 + n * s, y + j * s, z0 + i * s], 0.025, 6);
        pipe(k, 'paint', [x0 + i * s, y + j * s, z0], [x0 + i * s, y + j * s, z0 + n * s], 0.025, 6);
      }
    }
    k.color(C('#b9bdbf'));
    for (let i = 0; i <= n; i++) for (let q = 0; q <= n; q++) pipe(k, 'metal', [x0 + i * s, y, z0 + q * s], [x0 + i * s, y + n * s, z0 + q * s], 0.028, 6);
    env.fence?.(x0, z0, x0 + n * s, z0, 0.1); env.fence?.(x0, z0 + n * s, x0 + n * s, z0 + n * s, 0.1);
    env.fence?.(x0, z0, x0, z0 + n * s, 0.1); env.fence?.(x0 + n * s, z0, x0 + n * s, z0 + n * s, 0.1);
  }

  // ---------- 鉄棒（高さ 3 段） ----------
  {
    const cz = hd - 3.2, x0 = hw - 6.4;
    const hs = [0.8, 1.05, 1.3];
    k.color(C('#8c9296'));
    for (let q = 0; q <= 3; q++) { const x = x0 + q * 1.3, y = Y(x, cz); pipe(k, 'paint', [x, y, cz], [x, y + (hs[Math.min(q, 2)] ?? 1.3) + 0.08, cz], 0.045); }
    k.color(C('#d5d8da'));
    for (let q = 0; q < 3; q++) { const x = x0 + q * 1.3, y = Y(x + 0.65, cz); pipe(k, 'chrome', [x, y + hs[q], cz], [x + 1.3, y + hs[q], cz], 0.018); }
    env.fence?.(x0, cz, x0 + 3.9, cz, 0.08);
  }

  // ---------- 砂場（コンクリートの縁と、置き忘れのバケツとスコップ） ----------
  {
    const cx = -hw + 4.8, cz = hd - 4.2, y = Y(cx, cz), sw = 3.2, sd = 2.4;
    k.color(C('#b8b3a8'));
    for (const s of [-1, 1]) { k.box('concrete', cx, y + 0.12, cz + s * sd / 2, sw + 0.3, 0.24, 0.15); k.box('concrete', cx + s * sw / 2, y + 0.12, cz, 0.15, 0.24, sd); }
    k.color(C('#e7d6a8')); k.box('concrete', cx, y + 0.08, cz, sw - 0.02, 0.1, sd - 0.02);
    k.color(C('#e2d0a0'));
    for (let q = 0; q < 5; q++) k.geo('concrete', new THREE.SphereGeometry(0.22 + r() * 0.2, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(1.4, 0.35, 1), new THREE.Matrix4().setPosition(cx - 1 + r() * 2, y + 0.12, cz - 0.7 + r() * 1.4));
    k.color(C('#e8413a')); k.cyl('plastic', cx + 0.7, y + 0.13, cz - 0.3, 0.09, 0.16, 12, 0.11);
    k.color(C('#2f6fb3')); k.box('plastic', cx + 0.35, y + 0.15, cz - 0.1, 0.07, 0.02, 0.26);
    env.fence?.(cx - sw / 2, cz - sd / 2, cx + sw / 2, cz - sd / 2, 0.1);
  }

  // ---------- 水飲み場 ----------
  {
    const x = hw - 2.9, z = 0.4, y = Y(x, z);
    k.color(C('#a9a59c')); k.cyl('concrete', x, y, z, 0.2, 0.72, 12, 0.16);
    k.color(C('#bdb9b0')); k.cyl('concrete', x, y + 0.72, z, 0.3, 0.1, 16, 0.32);
    k.color(C('#6f7478')); k.cyl('dark', x, y + 0.8, z, 0.25, 0.021, 16);
    k.color(C('#d5d8da')); k.cyl('chrome', x, y + 0.82, z, 0.025, 0.1, 8);
    k.color(C('#8f9396')); k.cyl('metal', x + 0.18, y + 0.35, z, 0.03, 0.06, 8);
    env.fence?.(x, z, x, z, 0.35);
  }

  // ---------- ベンチ（木の座板と鉄の脚）・くずかご ----------
  for (const [x, z, yaw] of [[-3.2, hd - 1.9, Math.PI], [3.8, hd - 1.9, Math.PI], [-hw + 1.6, -0.5, Math.PI / 2]]) {
    const y = Y(x, z);
    const M = env.at(x, z, yaw);
    k.at(M);
    k.color(C('#3a3a3a'));
    for (const dx of [-0.7, 0.7]) { k.box('metal', dx, 0.22, 0, 0.05, 0.44, 0.42); k.box('metal', dx, 0.62, -0.2, 0.05, 0.45, 0.05); }
    k.color(C('#a8744a'));
    for (let q = 0; q < 3; q++) k.box('wood', 0, 0.45, -0.14 + q * 0.13, 1.7, 0.04, 0.1);
    for (let q = 0; q < 2; q++) k.box('wood', 0, 0.62 + q * 0.14, -0.22, 1.7, 0.09, 0.03);
    k.at(env.M);
    void y;
    env.fence?.(...[x - Math.cos(yaw) * 0.85, z + Math.sin(yaw) * 0.85], ...[x + Math.cos(yaw) * 0.85, z - Math.sin(yaw) * 0.85], 0.3);
  }
  {
    const x = -1.6, z = hd - 1.4, y = Y(x, z);
    k.color(C('#5d7a5a')); k.cyl('metal', x, y, z, 0.22, 0.75, 14, 0.24);
    k.color(C('#3a4a38')); k.cyl('dark', x, y + 0.75, z, 0.2, 0.01, 14);
    env.fence?.(x, z, x, z, 0.25);
  }

  // ---------- 時計の柱（広場の奥） ----------
  {
    const x = -2.4, z = -hd + 1.3, y = Y(x, z);
    k.color(C('#8a8f92')); k.cyl('metal', x, y, z, 0.07, 3.2, 10);
    k.color(C('#6d7275')); k.cyl('metal', x, y + 3.2, z, 0.3, 0.1, 20);
    const face = new THREE.CylinderGeometry(0.3, 0.3, 0.12, 24).rotateX(Math.PI / 2);
    k.color(C('#e6e8e8')); k.geo('metal', face, new THREE.Matrix4().setPosition(x, y + 3.55, z));
    for (const s of [1, -1]) {
      k.color(C('#ffffff'));
      const cg = new THREE.CircleGeometry(0.26, 24);
      if (s < 0) cg.rotateY(Math.PI);
      k.geo('clockFace', cg, new THREE.Matrix4().setPosition(x, y + 3.55, z + s * 0.062));
    }
    env.fence?.(x, z, x, z, 0.15);
  }

  // ---------- 公園名の看板（入口の横） ----------
  {
    const x = -hw + 3.2, z = hd - 0.6, y = Y(x, z);
    k.color(C('#6a6e70')); for (const dx of [-0.62, 0.62]) k.box('metal', x + dx, y + 0.7, z, 0.06, 1.4, 0.06);
    k.color(C('#e9e7e0')); k.box('paint', x, y + 1.2, z - 0.01, 1.34, 0.72, 0.04);
    k.color(C('#ffffff')); k.face('parkSign', [[x - 0.64, y + 0.86, z + 0.012], [x + 0.64, y + 0.86, z + 0.012], [x + 0.64, y + 1.54, z + 0.012], [x - 0.64, y + 1.54, z + 0.012]], [[0, 0], [1, 0], [1, 1], [0, 1]]);
    env.fence?.(x - 0.65, z, x + 0.65, z, 0.1);
  }
}
