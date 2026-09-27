// 目印の建物（自分の家・定食屋・研究所）の共通部品: 開口のある壁・サッシ・瓦屋根（入母屋・切妻）・文字の看板テクスチャ
// どれも Kit（kit.js）に積む。座標はその場の行列（k.at）のローカル。
import * as THREE from 'three';

export const C = (h) => new THREE.Color(h);

// 壁ごとの座標系: x = a→b に沿って、y = 上、z = 外向き（a→b の右手側）
export function wallFrame(M, ax, az, bx, bz, y0 = 0) {
  const L = Math.hypot(bx - ax, bz - az), ex = (bx - ax) / L, ez = (bz - az) / L;
  const m = new THREE.Matrix4().set(ex, 0, -ez, ax, 0, 1, 0, y0, ez, 0, ex, az, 0, 0, 0, 1);
  return { m: M.clone().multiply(m), L };
}

// 開口のある壁（壁の座標系、外面 z = 0）。holes: [{ x0, x1, y0, y1 }]。t: 開口の見込み（壁の厚み）
export function holeyWall(k, mat, L, y0, y1, holes = [], t = 0.14, u0 = 0) {
  const xs = new Set([0, L]);
  for (const h of holes) { xs.add(Math.max(0, h.x0)); xs.add(Math.min(L, h.x1)); }
  const X = [...xs].sort((a, b) => a - b);
  const quad = (xa, xb, ya, yb) => k.face(mat, [[xa, ya, 0], [xb, ya, 0], [xb, yb, 0], [xa, yb, 0]], [[u0 + xa, ya], [u0 + xb, ya], [u0 + xb, yb], [u0 + xa, yb]]);
  for (let i = 0; i < X.length - 1; i++) {
    const xa = X[i], xb = X[i + 1], xm = (xa + xb) / 2;
    if (xb - xa < 1e-4) continue;
    const hs = holes.filter((h) => h.x0 <= xm && xm <= h.x1).sort((a, b) => a.y0 - b.y0);
    let y = y0;
    for (const h of hs) { if (h.y0 > y + 1e-4) quad(xa, xb, y, Math.min(h.y0, y1)); y = Math.max(y, h.y1); }
    if (y < y1 - 1e-4) quad(xa, xb, y, y1);
  }
  // 開口の見込み（上・下・左右）。この帯（y0..y1）にかかる分だけ
  for (const h of holes) {
    const { x0, x1 } = h, hy0 = Math.max(h.y0, y0), hy1 = Math.min(h.y1, y1);
    if (hy1 <= hy0) continue;
    if (h.y1 <= y1 + 1e-4) k.face(mat, [[x0, hy1, 0], [x0, hy1, -t], [x1, hy1, -t], [x1, hy1, 0]], [[x0, 0], [x0, t], [x1, t], [x1, 0]]);
    if (h.y0 >= y0 - 1e-4 && h.y0 > 1e-3) k.face(mat, [[x0, hy0, 0], [x1, hy0, 0], [x1, hy0, -t], [x0, hy0, -t]], [[x0, 0], [x1, 0], [x1, t], [x0, t]]);
    k.face(mat, [[x0, hy0, 0], [x0, hy0, -t], [x0, hy1, -t], [x0, hy1, 0]], [[0, hy0], [t, hy0], [t, hy1], [0, hy1]]);
    k.face(mat, [[x1, hy0, -t], [x1, hy0, 0], [x1, hy1, 0], [x1, hy1, -t]], [[0, hy0], [t, hy0], [t, hy1], [0, hy1]]);
  }
}

// 引き違いのサッシ（開口の中、奥行き z = -d に）。panes: 枚数、glass: ガラスの色、open: 開けてある枚（0..panes-1、なければ -1）
// win: ガラスのマテリアル（'window' なら奥に部屋が見える）、floor: 部屋の床の高さ（同じ座標系。なければ窓の下端 - 0.9 m）
export function slider(k, x0, x1, y0, y1, d, { frame = C('#8d8a82'), glass = C('#2d3a44'), panes = 2, open = -1, bar = 0, win = 'window', floor = y0 - 0.9 } = {}) {
  const w = x1 - x0, h = y1 - y0, f = 0.04, pw = w / panes;
  k.color(frame);
  k.box('metal', (x0 + x1) / 2, y1 - f / 2, -d, w, f, 0.07);
  k.box('metal', (x0 + x1) / 2, y0 + f / 2, -d, w, f, 0.07);
  k.box('metal', x0 + f / 2, (y0 + y1) / 2, -d, f, h, 0.07);
  k.box('metal', x1 - f / 2, (y0 + y1) / 2, -d, f, h, 0.07);
  for (let q = 0; q < panes; q++) {
    if (q === open) continue;
    const a = x0 + q * pw, b = a + pw, z = -d + (q % 2 ? 0.025 : -0.015);
    k.color(glass.clone().multiplyScalar(q % 2 ? 0.94 : 1));
    k.face(win, [[a + f, y0 + f, z], [b - f * 0.5, y0 + f, z], [b - f * 0.5, y1 - f, z], [a + f, y1 - f, z]], [[a + f, y0 + f - floor], [b - f * 0.5, y0 + f - floor], [b - f * 0.5, y1 - f - floor], [a + f, y1 - f - floor]]);
    k.color(frame);
    k.box('metal', a + f * 0.6, (y0 + y1) / 2, z + 0.01, 0.035, h - f * 2, 0.04);
    k.box('metal', b - f * 0.6, (y0 + y1) / 2, z + 0.01, 0.035, h - f * 2, 0.04);
    if (bar) for (let yy = y0 + bar; yy < y1 - 0.1; yy += bar) k.box('metal', (a + b) / 2, yy, z + 0.01, pw - f, 0.025, 0.03);
  }
}

// ---------- 瓦屋根 ----------
// 入母屋: 中心 (cx, cz)、壁の大きさ w × d（w ≥ d、棟は x 方向）、壁の上端 H、軒の出 over、勾配 p、
// 妻の下の寄棟部分の出 ix、けらば kb。col: 瓦、trim: 破風・鼻隠し、soffit: 軒裏、gable: 妻壁の色
export function irimoya(k, o) {
  const { cx, cz, w, d, H, over, p, ix, kb = 0.35, col, trim, soffit, gable, gableMat = 'mortar', batten, tile = 'kawara' } = o;
  const W = w / 2 + over, D = d / 2 + over, yE = H - over * p, yR = yE + D * p, X1 = W - ix, yH = yE + ix * p, T = 0.13;
  const P = (x, y, z) => [cx + x, y, cz + z];
  const sl = Math.hypot(D, yR - yE), slc = Math.hypot(ix, yH - yE);
  const roofF = (pts, uv) => {
    k.color(col); k.face(tile, pts.map((q) => P(...q)), uv);
    k.color(soffit); k.face('trim', pts.map((q) => P(q[0], q[1] - T, q[2])).reverse());
  };
  // 平の面（前・後ろ）
  roofF([[-X1, yE, D], [X1, yE, D], [X1, yR, 0], [-X1, yR, 0]], [[-X1, 0], [X1, 0], [X1, sl], [-X1, sl]]);
  roofF([[X1, yE, -D], [-X1, yE, -D], [-X1, yR, 0], [X1, yR, 0]], [[X1, 0], [-X1, 0], [-X1, sl], [X1, sl]]);
  // 妻の外へのけらば（寄棟部分の上に出る）
  const zg = D - ix;
  for (const s of [1, -1]) {
    const xa = Math.min(s * X1, s * (X1 + kb)), xb = Math.max(s * X1, s * (X1 + kb));
    const uv = (q) => [q[0], Math.hypot(zg - Math.abs(q[2]), q[1] - yH) + slc];
    const fr = [[xa, yH, zg], [xb, yH, zg], [xb, yR, 0], [xa, yR, 0]], bk = [[xb, yH, -zg], [xa, yH, -zg], [xa, yR, 0], [xb, yR, 0]];
    roofF(fr, fr.map(uv));
    roofF(bk, bk.map(uv));
  }
  // 隅の三角（前後）と、妻側の台形（寄棟部分）
  for (const s of [1, -1]) {
    const tf = s > 0 ? [[X1, yE, D], [W, yE, D], [X1, yH, zg]] : [[-W, yE, D], [-X1, yE, D], [-X1, yH, zg]];
    roofF(tf, tf.map((q) => [q[0], Math.hypot(D - q[2], q[1] - yE)]));
    const tb = s > 0 ? [[W, yE, -D], [X1, yE, -D], [X1, yH, -zg]] : [[-X1, yE, -D], [-W, yE, -D], [-X1, yH, -zg]];
    roofF(tb, tb.map((q) => [-q[0], Math.hypot(D + q[2], q[1] - yE)]));
    const e = s > 0 ? [[W, yE, D], [W, yE, -D], [X1, yH, -zg], [X1, yH, zg]] : [[-W, yE, -D], [-W, yE, D], [-X1, yH, zg], [-X1, yH, -zg]];
    roofF(e, e.map((q) => [q[2] * s, Math.hypot(W - Math.abs(q[0]), q[1] - yE)]));
  }
  // 妻壁（三角）と縦の押縁
  for (const s of [1, -1]) {
    const x = s * (X1 - 0.02);
    k.color(gable);
    const tri = s > 0 ? [[x, yH - 0.02, zg], [x, yH - 0.02, -zg], [x, yR, 0]] : [[x, yH - 0.02, -zg], [x, yH - 0.02, zg], [x, yR, 0]];
    k.face(gableMat, tri.map((q) => P(...q)), tri.map((q) => [q[2], q[1]]));
    if (batten) {
      k.color(batten);
      for (let z = -zg + 0.35; z < zg - 0.2; z += 0.45) {
        const top = yR - Math.abs(z) * p - 0.05;
        if (top - yH < 0.15) continue;
        k.box('trim', ...P(x + s * 0.03, (yH + top) / 2, z), 0.04, top - yH, 0.06);
      }
    }
    // 破風板と懸魚
    k.color(trim);
    // 破風板は棟の下で合わせる（上に突き出さない）
    for (const sz of [1, -1]) k.rod('trim', P(s * (X1 + kb + 0.02), yH - 0.12, sz * (zg + 0.1)), P(s * (X1 + kb + 0.02), yR - 0.16, 0), 0.24);
    k.box('trim', ...P(s * (X1 + kb + 0.05), yR - 0.35, 0), 0.06, 0.42, 0.34);
    k.box('trim', ...P(s * (X1 + kb + 0.07), yR - 0.62, 0), 0.05, 0.2, 0.18);
  }
  // 鼻隠し・軒樋（前後・妻側）
  const gut = C('#6f7478');
  for (const sz of [1, -1]) {
    k.color(trim); k.box('trim', ...P(0, yE - T * 0.6, sz * (D + 0.02)), 2 * W + 0.05, 0.2, 0.05);
    k.color(gut);
    k.geo('metal', new THREE.CylinderGeometry(0.07, 0.07, 2 * W + 0.05, 8, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).rotateX(sz > 0 ? 0 : Math.PI), new THREE.Matrix4().setPosition(...P(0, yE - T - 0.05, sz * (D + 0.1))));
  }
  for (const sx of [1, -1]) { k.color(trim); k.box('trim', ...P(sx * (W + 0.02), yE - T * 0.6, 0), 0.05, 0.2, 2 * D + 0.05); }
  // 棟: 熨斗瓦を 3 段に積んだ大棟と冠瓦、両端に鬼瓦と鳥衾。隅棟・降り棟
  const ridgeCol = col.clone().multiplyScalar(0.45);
  const RL = 2 * (X1 + kb);
  k.color(ridgeCol);
  [[0.4, 0.07], [0.36, 0.07], [0.32, 0.07]].forEach(([wd, th], q) => k.box('ridge', ...P(0, yR + 0.02 + q * 0.075 + th / 2, 0), RL - q * 0.04, th, wd));
  k.color(ridgeCol.clone().multiplyScalar(0.92));
  k.geo('ridge', new THREE.CylinderGeometry(0.13, 0.13, RL - 0.1, 12, 1, false, 0, Math.PI).rotateZ(Math.PI / 2), new THREE.Matrix4().setPosition(...P(0, yR + 0.225, 0)));
  for (const s of [1, -1]) {
    k.color(ridgeCol);
    onigawara(k, 'ridge', P(s * (X1 + kb + 0.02), yR - 0.12, 0), s > 0 ? Math.PI / 2 : -Math.PI / 2, 0.95);
    toribusuma(k, 'ridge', P(s * (X1 + kb - 0.05), yR + 0.3, 0), [s, 0, 0]);
    for (const sz of [1, -1]) {
      k.rod('ridge', P(s * W, yE + 0.06, sz * D), P(s * X1, yH + 0.08, sz * zg), 0.2);
      k.rod('ridge', P(s * (X1 + kb * 0.5), yR + 0.05, 0), P(s * (X1 + kb * 0.5), yH + 0.08, sz * (zg + 0.05)), 0.2);
      // 隅棟の先の小さな鬼瓦
      const dx = s * (W - X1), dz = sz * (D - zg), l = Math.hypot(dx, dz);
      onigawara(k, 'ridge', P(s * W + dx / l * 0.02, yE - 0.05, sz * D + dz / l * 0.02), Math.atan2(dx, dz), 0.45);
    }
    k.rod('ridge', P(s * X1, yH + 0.06, -zg), P(s * X1, yH + 0.06, zg), 0.16);
  }
  // 雨どいの縦管（四隅）
  k.color(gut);
  for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) k.cyl('metal', ...P(sx * (w / 2 + 0.12), 0.1, sz * (d / 2 + 0.12)), 0.045, yE - 0.3, 8);
  return { yE, yR };
}

// 切妻（棟は z 方向）: 中心 (cx, cz)、幅 w（x）、z0..z1 の長さ、壁の上端 H、軒の出 over、勾配 p。
// front: z1 側に妻壁と破風を付ける
export function kirizuma(k, o) {
  const { cx, w, z0, z1, H, over, p, col, trim, soffit, gable, gableMat = 'mortar', front = true, back = false, ridge = true, tile = 'kawara' } = o;
  const W = w / 2 + over, yE = H - over * p, yR = yE + W * p, T = 0.12;
  const sl = Math.hypot(W, yR - yE);
  const zb = z0 - (back ? over : 0), zf = z1 + over;
  const X = (x) => cx + x;
  for (const s of [1, -1]) {
    const pts = s > 0 ? [[X(W), yE, zf], [X(W), yE, zb], [X(0), yR, zb], [X(0), yR, zf]] : [[X(-W), yE, zb], [X(-W), yE, zf], [X(0), yR, zf], [X(0), yR, zb]];
    k.color(col); k.face(tile, pts, pts.map((q) => [q[2], Math.hypot(Math.abs(q[0] - cx) - W, q[1] - yE)]));
    k.color(soffit); k.face('trim', pts.map((q) => [q[0], q[1] - T, q[2]]).reverse());
    k.color(trim); k.box('trim', X(s * (W + 0.02)), yE - T * 0.6, (zb + zf) / 2, 0.05, 0.2, zf - zb);
  }
  const gab = (z, dir) => {
    k.color(gable);
    const tri = dir > 0 ? [[X(-w / 2), H, z], [X(w / 2), H, z], [X(0), yR - 0.05, z]] : [[X(w / 2), H, z], [X(-w / 2), H, z], [X(0), yR - 0.05, z]];
    k.face(gableMat, tri, tri.map((q) => [q[0], q[1]]));
    k.color(trim);
    const ze = dir > 0 ? zf + 0.02 : zb - 0.02;
    for (const s of [1, -1]) k.rod('trim', [X(s * (W + 0.05)), yE - 0.1, ze], [X(0), yR + 0.03, ze], 0.24);
    k.box('trim', X(0), yR - 0.3, ze + dir * 0.03, 0.3, 0.36, 0.05);
  };
  if (front) gab(z1, 1);
  if (back) gab(z0, -1);
  if (ridge) {
    k.color(col.clone().multiplyScalar(0.82));
    const rm = tile === 'kawara' ? 'kawara' : 'ridge';
    k.box(rm, X(0), yR + 0.06, (zb + zf) / 2, 0.34, 0.07, zf - zb + 0.1);
    k.box(rm, X(0), yR + 0.13, (zb + zf) / 2, 0.3, 0.07, zf - zb + 0.06);
    k.geo(rm, new THREE.CylinderGeometry(0.12, 0.12, zf - zb + 0.02, 12, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).rotateY(Math.PI / 2), new THREE.Matrix4().setPosition(X(0), yR + 0.17, (zb + zf) / 2));
    if (front) { onigawara(k, rm, [X(0), yR - 0.1, zf + 0.03], 0, 0.75); toribusuma(k, rm, [X(0), yR + 0.22, zf - 0.02], [0, 0, 1]); }
  }
  return { yE, yR };
}

// 鬼瓦: 裾が広がり、上が山形に盛り上がる板（厚み 0.14 m）。pos = 下端の中心、yaw = 正面の向き（+z を回す）、s = 大きさ
let ONI = null;
export function onigawara(k, mat, pos, yaw, s = 1) {
  if (!ONI) {
    const sh = new THREE.Shape();
    sh.moveTo(-0.34, 0);
    sh.lineTo(-0.36, 0.08);
    sh.quadraticCurveTo(-0.26, 0.2, -0.28, 0.36);
    sh.quadraticCurveTo(-0.3, 0.5, -0.2, 0.56);
    sh.quadraticCurveTo(-0.1, 0.62, -0.06, 0.7);
    sh.quadraticCurveTo(0, 0.76, 0.06, 0.7);
    sh.quadraticCurveTo(0.1, 0.62, 0.2, 0.56);
    sh.quadraticCurveTo(0.3, 0.5, 0.28, 0.36);
    sh.quadraticCurveTo(0.26, 0.2, 0.36, 0.08);
    sh.lineTo(0.34, 0);
    // 棟の熨斗が入る切り欠き
    sh.lineTo(0.14, 0);
    sh.lineTo(0.14, 0.1);
    sh.quadraticCurveTo(0, 0.2, -0.14, 0.1);
    sh.lineTo(-0.14, 0);
    sh.closePath();
    ONI = new THREE.ExtrudeGeometry(sh, { depth: 0.1, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.025, bevelSegments: 2, curveSegments: 6 });
    ONI.translate(0, 0, -0.05);
    // 表の縁取りの帯
    const ring = new THREE.TorusGeometry(0.13, 0.025, 6, 16).translate(0, 0.38, 0.08);
    ONI = [ONI, ring];
  }
  const m = new THREE.Matrix4().makeRotationY(yaw).scale(new THREE.Vector3(s, s, s)).setPosition(...pos);
  for (const g of ONI) k.geo(mat, g, m);
}
// 鳥衾: 鬼瓦の上から外へ突き出す丸瓦（dir = 突き出す水平の向き）
export function toribusuma(k, mat, pos, dir) {
  const a = new THREE.Vector3(...pos), d = new THREE.Vector3(...dir).normalize();
  const b = a.clone().addScaledVector(d, 0.55).add(new THREE.Vector3(0, 0.22, 0));
  const g = new THREE.CylinderGeometry(0.075, 0.09, a.distanceTo(b), 10);
  const m = new THREE.Matrix4().lookAt(b, a, new THREE.Vector3(0, 1, 0)).multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2));
  m.setPosition(a.clone().add(b).multiplyScalar(0.5));
  k.geo(mat, g, m);
  k.geo(mat, new THREE.CylinderGeometry(0.095, 0.095, 0.04, 12), m.clone().multiply(new THREE.Matrix4().makeTranslation(0, a.distanceTo(b) / 2, 0)));
}

// 吊った布（洗濯物・のれん）: 上端を留め、下へ行くほど波打って少しふくらむ。原点 = 上端の中央、面は +z 向き
// uv は 0..1（のれんの絵を貼れる）。seed で波の位相を変える
export function clothGeo(w, h, seed = 0, amp = 0.05) {
  const g = new THREE.PlaneGeometry(w, h, Math.max(4, Math.round(w / 0.08)), 4);
  g.translate(0, -h / 2, 0);
  const P = g.attributes.position;
  for (let i = 0; i < P.count; i++) {
    const x = P.getX(i), t = -P.getY(i) / h; // 0 = 上端, 1 = 下端
    const wave = Math.sin(x * 11 + seed * 2.3) * 0.6 + Math.sin(x * 23 + seed * 5.1) * 0.25;
    P.setZ(i, wave * amp * (0.35 + t) + t * t * amp * 0.8);
    P.setY(i, P.getY(i) - Math.abs(Math.sin(x * 11 + seed * 2.3)) * t * 0.02);
  }
  g.computeVertexNormals();
  return g;
}

// ---------- 文字の看板など（キャンバス） ----------
// draw(g, w, h) で描く。フォントが読み込まれたら描き直す
const texCache = new Map();
export function canvasTex(key, w, h, draw, fonts = []) {
  if (texCache.has(key)) return texCache.get(key);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (fonts.length && document.fonts) Promise.all(fonts.map((f) => document.fonts.load(f))).then(() => { g.clearRect(0, 0, w, h); draw(g, w, h); t.needsUpdate = true; }, () => {});
  texCache.set(key, t);
  return t;
}

// 絵を貼る面のマテリアル（Kit に名前で足す。uv は 0..1）
export function needMat(k, name, make) {
  if (!k.mats[name]) k.mats[name] = make();
  return name;
}

// 木目の板（看板の地）
export function woodGrain(g, w, h, base = '#8a5a34', dark = '#5c3a20') {
  g.fillStyle = base; g.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 2) {
    const a = 0.08 + 0.08 * Math.sin(y * 0.13) * Math.sin(y * 0.031 + 1.3);
    g.fillStyle = `rgba(40,20,5,${Math.max(0, a)})`;
    g.fillRect(0, y, w, 1);
  }
  g.strokeStyle = dark; g.globalAlpha = 0.25; g.lineWidth = 1.5;
  for (let i = 0; i < 18; i++) {
    const y = (i / 18) * h + Math.sin(i * 7.1) * 6;
    g.beginPath(); g.moveTo(0, y);
    for (let x = 0; x <= w; x += 20) g.lineTo(x, y + Math.sin(x * 0.01 + i) * 3);
    g.stroke();
  }
  g.globalAlpha = 1;
}

// 敷地の地面に貼る四角（細かく分けて、地形の起伏に沿わせる）。env.gy(x, z) = その点の地面の高さ（ローカル）
export function groundPatch(k, env, x0, z0, x1, z1, mat, col, lift = 0.03, step = 1.0) {
  k.at(env.M).color(col);
  const nx = Math.max(1, Math.ceil((x1 - x0) / step)), nz = Math.max(1, Math.ceil((z1 - z0) / step));
  const X = (i) => x0 + ((x1 - x0) * i) / nx, Z = (j) => z0 + ((z1 - z0) * j) / nz;
  const P = (x, z) => [x, env.gy(x, z) + lift, z];
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const xa = X(i), xb = X(i + 1), za = Z(j), zb = Z(j + 1);
    k.face(mat, [P(xa, zb), P(xb, zb), P(xb, za), P(xa, za)], [[xa, -zb], [xb, -zb], [xb, -za], [xa, -za]]);
  }
  if (mat !== 'fGrass') env.pave?.([[x0, z0], [x1, z0], [x1, z1], [x0, z1]]);
}
