// 一人称で見える自分の体（町の主人公と同じ格好: 白い T シャツ・紺の半ズボン・はだし。夜なのでおでこにヘッドライト）
// ・足: 腰 → ひざ → 足首 → 足。水の中を歩くと交互に踏み出す。しゃがむとひざを曲げる
// ・腕: 肩から手まで 2 本の骨で届かせる（IK）。手のひらで砂をなでる／突っ込んでつかむ／挟まれる
// ・手の指に、挟まれた数だけ絆創膏
// （蛤突きの体を写して、ガザミ拾い用に手の形と絆創膏を足した）
// 体のローカル座標: 原点 = 両足の間の地面、-z = 前、+x = 右
import * as THREE from 'three';
import { patchMaterial } from './shade.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { clamp, lerp } from './core/noise.js';

const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export const EYE = 1.22;
const HIP_Y = 0.64, HIP_X = 0.082, THIGH = 0.3, SHIN = 0.29, ANKLE = 0.055;
const SHOULDER_Y = 1.06, SHOULDER_X = 0.145, UPPER = 0.25, FORE = 0.24;
const SKIN = '#e3a47a';
const PALM_DOWN = 0.8; // 柄を握る手のひらの下向きの度合い（0 = 真横の内側）

// 肌・服: 水面をまたぐ所に細い光の線（水が肌にまとわりつく所）、水から出た所はしばらく濡れて光る
const WATERLINE_FX = {
  key: 'waterline',
  rough: `roughnessFactor = mix(roughnessFactor, 0.3, smoothstep(0.08, 0.0, vWPos.y - uTide) * step(uTide - 0.004, vWPos.y));`,
  light: `
    {
      float wl = vWPos.y - uTide;
      float band = exp(-wl * wl / 0.000012);
      reflectedLight.directDiffuse += vec3(0.75, 0.82, 0.85) * band * (0.02 + headIrr(vWPos) * 0.12);
    }`,
};
const mat = (color, o = {}) => patchMaterial(new THREE.MeshStandardMaterial({ color, roughness: 0.75, ...o }), { caustics: true, fx: WATERLINE_FX });

/** +y 向きの長さ 1 の先細りの管（r0: 付け根, r1: 先） */
function taper(r0, r1, seg = 14, bulge = 0.08) {
  const pts = [];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    const r = lerp(r0, r1, t) * (1 + bulge * Math.sin(t * Math.PI) - 0.05 * Math.sin(t * Math.PI * 2) * 0.5);
    pts.push(new THREE.Vector2(r, t));
  }
  return new THREE.LatheGeometry(pts, seg);
}
function setLimb(mesh, a, b) {
  const d = b.clone().sub(a);
  mesh.position.copy(a);
  mesh.quaternion.setFromUnitVectors(V3(0, 1, 0), d.clone().normalize());
  mesh.scale.set(1, d.length(), 1);
}

// 手（関節つき）。ローカル: +y = 指の向き、+z = 手のひらの向く側、+x = 親指の側（右手。左手は x を反転して作る）
// 原点 = 手のひらの中心。大きさは子どもの手（手首から中指の先まで約 13cm）
// 形: grip（柄を握る）/ cup（すくって持つ）/ dig（砂を掻く）/ rest
// grip は柄（手のひらの上の方を横切る管）に指を 1 本ずつ巻きつけて角度を決め、親指は指の外から重ねる
const PIPE_R = 0.0072;
const GRIP_C = [0.016, 0.019]; // 握った柄の中心（y, z）
export const GRIP_ANCHOR = new THREE.Vector3(0, GRIP_C[0], GRIP_C[1]);
// 人差し指・中指・薬指・小指（x: 付け根の横位置、y: 付け根の高さ）
const FINGERS = [
  { x: 0.0215, y: 0.03, len: [0.031, 0.019, 0.016], r: 0.0062, sp: -0.06 },
  { x: 0.0072, y: 0.032, len: [0.034, 0.021, 0.017], r: 0.0064, sp: 0 },
  { x: -0.0073, y: 0.03, len: [0.032, 0.02, 0.0165], r: 0.006, sp: 0.05 },
  { x: -0.0212, y: 0.025, len: [0.025, 0.015, 0.014], r: 0.0053, sp: 0.12 },
];
// 親指: 付け根（手首寄りのふくらみの中）から、中手骨（太く、親指の付け根のふくらみになる）・基節・末節
const THUMB = { base: [0.018, -0.024, 0.003], len: [0.026, 0.021, 0.018], r: [0.0108, 0.0086, 0.0079] };
// 握ったときの親指の関節が向かう所（右手）。人差し指と中指の外側に重なる
const THUMB_GRIP = [[0.029, -0.006, 0.022], [0.016, 0.004, 0.044], [0.002, 0.014, 0.05]];
const HAND_POSES = {
  // 砂をなでる: 指をそろえて少しだけ反らす
  flat: { f: [0.05, 0.08, 0.05], th: [0.1, 0.12, 0.05], tr: [0.2, -0.45], spread: 0.07 },
  // 甲羅を後ろからつかむ
  grab: { f: [0.95, 1.05, 0.6], th: [0.55, 0.5, 0.35], tr: [0.8, -1.0], spread: 0.06 },
  // 挟まれて指をつっぱる
  splay: { f: [-0.12, 0.02, 0.0], th: [-0.1, 0.05, 0.0], tr: [0.1, -0.3], spread: 0.26 },
  // 人差し指を挟まれて、ほかの指はびくっと縮める（指ごとの角度）
  pinched: { f: [[-0.05, 0.0, 0.0], [0.75, 0.9, 0.5], [0.95, 1.05, 0.6], [1.0, 1.1, 0.6]], th: [0.2, 0.25, 0.1], tr: [0.3, -0.5], spread: 0.18 },
  pinched2: { f: [[0.9, 1.0, 0.55], [-0.05, 0.0, 0.0], [0.95, 1.05, 0.6], [1.0, 1.1, 0.6]], th: [0.2, 0.25, 0.1], tr: [0.3, -0.5], spread: 0.18 },
  cup: { f: [0.32, 0.42, 0.28], th: [0.25, 0.25, 0.15], tr: [0.35, -0.95], spread: 0.08 },
  dig: { f: [0.5, 0.7, 0.4], th: [0.3, 0.35, 0.25], tr: [0.5, -0.75], spread: 0.12 },
  rest: { f: [0.35, 0.5, 0.35], th: [0.3, 0.4, 0.3], tr: [0.4, -0.65], spread: 0.05 },
};
const segR = (r, i) => (Array.isArray(r) ? r[i] : r * (1 - i * 0.09));

/** 柄に巻きつけたときの関節の角度（付け根 root から、柄の外側に沿って順に置く） */
function wrapAngles(root, lens, r) {
  const [cu, cv] = GRIP_C;
  let u = root.y, v = root.z, prev = 0;
  return lens.map((L, i) => {
    // 節の真ん中でも柄にめりこまない半径の円の上へ、次の関節を置く（巻く向き = 角度の増える向き）
    const rho = Math.hypot(PIPE_R + segR(r, i) + 0.0006, L / 2);
    const du = u - cu, dv = v - cv, d = Math.hypot(du, dv);
    const ph = Math.atan2(dv, du) + Math.acos(clamp((d * d + rho * rho - L * L) / (2 * d * rho), -1, 1));
    let a = Math.atan2(cv + rho * Math.sin(ph) - v, cu + rho * Math.cos(ph) - u) - prev;
    a = Math.atan2(Math.sin(a), Math.cos(a));
    a = clamp(a, 0, 1.75);
    prev += a;
    u += L * Math.cos(prev); v += L * Math.sin(prev);
    return a;
  });
}

/** 手のひら: 角の丸い平たい板。指の付け根で広く、手首で細い。親指の付け根と小指の側がふくらむ */
function palmGeometry(side) {
  let g = new THREE.SphereGeometry(1, 40, 30);
  g.deleteAttribute('normal'); g.deleteAttribute('uv');
  g = mergeVertices(g);
  const p = g.attributes.position;
  const pw = (a, e) => Math.sign(a) * Math.abs(a) ** e;
  for (let i = 0; i < p.count; i++) {
    const sx = pw(p.getX(i), 0.7), sy = pw(p.getY(i), 0.55), z = p.getZ(i);
    const t = (sy + 1) / 2;
    const X = sx * lerp(0.0245, 0.0305, t * t * (3 - 2 * t));
    const Y = sy * 0.033 + 0.002 * Math.max(0, sy) * (1 - (X / 0.031) ** 2);
    const xs = side * X;
    const thenar = 0.0072 * Math.exp(-(((xs - 0.016) / 0.011) ** 2) - (((Y + 0.013) / 0.014) ** 2));
    const hypo = 0.0032 * Math.exp(-(((xs + 0.019) / 0.01) ** 2) - (((Y + 0.006) / 0.02) ** 2));
    const hollow = 0.0022 * Math.exp(-((X / 0.013) ** 2) - (((Y - 0.004) / 0.013) ** 2));
    const half = 0.0104 * (1 - 0.12 * t);
    // 手の甲は中ほどが少し高い（中手骨の並び）
    const back = half * (1.02 + 0.12 * (1 - (X / 0.031) ** 2));
    const Z = z > 0 ? z * (half + thenar + hypo - hollow) : z * back;
    p.setXYZ(i, X, Y, Z);
  }
  g.computeVertexNormals();
  return g;
}

/** 3 点 a, b, c の三角形をおおう平たい肉（厚み th） */
function skinWeb(skin, a, b, c, th) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 12), skin);
  const o = a.clone().add(b).add(c).divideScalar(3);
  const u = b.clone().sub(a).normalize();
  const n = new THREE.Vector3().crossVectors(u, c.clone().sub(a)).normalize();
  const v = new THREE.Vector3().crossVectors(n, u);
  m.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(u, v, n));
  const ext = (w) => Math.max(...[a, b, c].map((p) => Math.abs(p.clone().sub(o).dot(w))));
  m.scale.set(ext(u) * 0.95, ext(v) * 0.95, th);
  m.position.copy(o);
  m.castShadow = true;
  return m;
}

export class Hand {
  constructor(skin, nail, side) {
    this.side = side;
    this.group = new THREE.Group();
    const palm = new THREE.Mesh(palmGeometry(side), skin);
    palm.castShadow = true;
    this.group.add(palm);
    this.fingers = FINGERS.map((f) => this.chain(skin, nail, V3(side * f.x, f.y, 0.0015), f.len, f.r, side * f.sp));
    // こぶしの骨（指の付け根の手の甲の側）
    for (const f of FINGERS) {
      const k = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 10), skin);
      k.scale.set(f.r * 1.05, f.r * 1.1, f.r * 0.95);
      k.position.set(side * f.x, f.y - 0.001, -0.0035);
      k.castShadow = true;
      this.group.add(k);
    }
    this.thumb = this.chain(skin, nail, V3(side * THUMB.base[0], THUMB.base[1], THUMB.base[2]), THUMB.len, THUMB.r, 0);
    this.gripAngles = FINGERS.map((f) => wrapAngles({ y: f.y, z: 0.0015 }, f.len, f.r));
    // 親指の握り: 目あての点へ順に向けて関節の位置を決める
    const pts = [V3(side * THUMB.base[0], THUMB.base[1], THUMB.base[2])];
    THUMB.len.forEach((L, i) => {
      const [x, y, z] = THUMB_GRIP[i];
      pts.push(V3(side * x, y, z).sub(pts[i]).setLength(L).add(pts[i]));
    });
    this.thumbGrip = pts;
    // 握ったときの親指と人差し指の間の水かき（親指の付け根・親指の関節・人差し指の付け根に張る）
    const ix = FINGERS[0];
    this.web = skinWeb(skin, pts[0], pts[1], V3(side * (ix.x + 0.002), ix.y - 0.004, 0.006), 0.0075);
    this.web.visible = false;
    this.group.add(this.web);
    this.poseName = null;
  }
  chain(skin, nail, base, lens, r, splay) {
    const root = new THREE.Object3D();
    root.position.copy(base);
    root.rotation.z = splay;
    this.group.add(root);
    const joints = [];
    let parent = root;
    lens.forEach((L, i) => {
      const j = new THREE.Object3D();
      if (i > 0) j.position.y = lens[i - 1];
      parent.add(j);
      const rr = segR(r, i);
      const seg = new THREE.Mesh(new THREE.CapsuleGeometry(rr, Math.max(L - rr, 0.001), 4, 10), skin);
      seg.position.y = L / 2;
      seg.castShadow = true;
      j.add(seg);
      if (i === lens.length - 1) {
        const n = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), nail);
        n.scale.set(rr * 0.8, L * 0.42, rr * 0.3);
        n.position.set(0, L * 0.58, -rr * 0.82);
        j.add(n);
      }
      joints.push(j);
      parent = j;
    });
    return { root, joints };
  }
  pose(name, k = 1) {
    if (name === 'grip') {
      this.fingers.forEach((f, i) => {
        f.root.rotation.set(0, 0, 0);
        f.joints.forEach((j, n) => j.rotation.set(this.gripAngles[i][n] * k, 0, 0));
      });
      // 親指: 各節の +y を次の関節へ、爪（-z）は柄から外へ向ける
      const pts = this.thumbGrip, T = this.thumb;
      T.root.position.copy(pts[0]);
      T.root.quaternion.identity();
      const acc = new THREE.Quaternion(), q = new THREE.Quaternion(), m = new THREE.Matrix4();
      this.web.visible = true;
      T.joints.forEach((j, n) => {
        const y = pts[n + 1].clone().sub(pts[n]).normalize();
        const mid = pts[n].clone().add(pts[n + 1]).multiplyScalar(0.5);
        const z = V3(0, GRIP_C[0] - mid.y, GRIP_C[1] - mid.z);
        z.addScaledVector(y, -z.dot(y)).normalize();
        const x = new THREE.Vector3().crossVectors(y, z);
        q.setFromRotationMatrix(m.makeBasis(x, y, z));
        j.quaternion.copy(acc).invert().multiply(q);
        acc.copy(q);
      });
    } else {
      this.web.visible = false;
      const P = HAND_POSES[name];
      this.fingers.forEach((f, i) => {
        const fa = Array.isArray(P.f[0]) ? P.f[i] : P.f;
        f.joints.forEach((j, n) => j.rotation.set(fa[n] * k * (1 + (i === 3 ? 0.08 : 0)), 0, 0));
        f.root.rotation.set(0, 0, this.side * (FINGERS[i].sp - (i - 1.5) * P.spread));
      });
      this.thumb.joints.forEach((j, n) => j.rotation.set(P.th[n] * k, 0, 0));
      this.thumb.root.rotation.set(P.tr[0], 0, this.side * P.tr[1]);
    }
    this.poseName = name;
  }
  /** 手のひらの向き（palm）と指の向き（fwd）から姿勢を決める */
  orient(pos, palm, fwd) {
    const z = palm.clone().normalize();
    const y = fwd.clone().addScaledVector(z, -fwd.dot(z)).normalize();
    const x = new THREE.Vector3().crossVectors(y, z).normalize();
    this.group.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
    this.group.position.copy(pos);
  }
  /** 指 i（0 人差し指 … 3 小指、4 親指）に絆創膏を巻く */
  addBandaid(i) {
    const f = i === 4 ? this.thumb : this.fingers[i];
    const seg = f.joints[i === 4 ? 1 : 1];
    const L = i === 4 ? THUMB.len[1] : FINGERS[i].len[1];
    const r = (i === 4 ? THUMB.r[1] : FINGERS[i].r) * 1.12;
    const g = new THREE.Group();
    const band = new THREE.Mesh(new THREE.CylinderGeometry(r, r, L * 0.8, 14, 1, true), BANDAID_MAT);
    band.position.y = L * 0.48;
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.06, r * 1.06, L * 0.36, 14, 1, true, Math.PI * 0.6, Math.PI * 0.8), BANDAID_PAD);
    pad.position.y = L * 0.48;
    g.add(band, pad);
    g.rotation.y = (Math.random() - 0.5) * 0.6;
    seg.add(g);
    this.bandaids = (this.bandaids || []);
    this.bandaids.push(g);
    return g;
  }
  clearBandaids() { for (const g of this.bandaids || []) g.parent?.remove(g); this.bandaids = []; }
  /** 手首（腕のつなぎ目） */
  wrist() { return V3(this.side * 0.002, -0.037, -0.002).applyQuaternion(this.group.quaternion).add(this.group.position); }
}

// 絆創膏（肌色のテープと白いパッド）
const BANDAID_MAT = new THREE.MeshStandardMaterial({ color: '#d9a47c', roughness: 0.75, side: THREE.DoubleSide });
const BANDAID_PAD = new THREE.MeshStandardMaterial({ color: '#f2ece2', roughness: 0.9, side: THREE.DoubleSide });

/**
 * はだしの足（足首の下の地面が原点、-z が前）。inner = 親指の側（+1: +x 側）
 * 足の裏: つま先側が広くかかとが細い、底の平たい形。指: 親指が太く、いちばん前に出て、小指へ向かって弧をえがいて短くなる。爪つき
 */
function bareFoot(inner, skin, nail, cast) {
  const foot = new THREE.Group();
  // 足の裏（甲）: 球をのばして、幅・高さを前後で変える
  let g = new THREE.SphereGeometry(1, 24, 16);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i);
    const z = p.getZ(i);
    // つま先の側は、先がとがらないように丸く太らせる（指の付け根が横に並ぶ）
    if (z < 0) {
      const rho = Math.sqrt(Math.max(1 - z * z, 1e-6)), want = Math.cbrt(Math.max(1 - (-z) ** 3, 0));
      const m = rho > 1e-3 ? want / rho : 1;
      x *= m; y *= m;
    }
    const t = (1 - z) / 2; // 0 = かかと → 1 = つま先
    const k = t * t * (3 - 2 * t);
    const w = 0.027 + 0.015 * Math.min(1, k * 1.4);
    // 高さ: 足首の下（t ≈ 0.25）がいちばん高く、つま先へ低くなる
    const h = 0.016 + 0.03 * Math.exp(-(((t - 0.25) / 0.3) ** 2));
    // 甲は親指の側が高い（土踏まずのふくらみ）。底は平たく
    const yy = y >= 0 ? y * h * (1 + 0.18 * x * inner) : y * h * 0.35;
    p.setXYZ(i, x * w + inner * 0.004 * k, yy, z * 0.098);
  }
  g.computeVertexNormals();
  const sole = cast(new THREE.Mesh(g, skin));
  sole.position.set(0, 0.012, -0.05);
  foot.add(sole);
  const heel = cast(new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), skin));
  heel.scale.set(0.026, 0.022, 0.028);
  heel.position.set(0, 0.02, 0.022);
  foot.add(heel);
  // 指（親指 → 小指）: [横の位置, 先の位置, 太さ, 長さ]
  const TOES = [[0.021, -0.171, 0.0105, 0.03], [0.0055, -0.166, 0.0068, 0.022], [-0.0065, -0.161, 0.0064, 0.02], [-0.0175, -0.153, 0.006, 0.018], [-0.027, -0.143, 0.0055, 0.015]];
  const toeGeo = new THREE.SphereGeometry(1, 12, 8);
  const nailGeo = new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.5);
  for (const [x, tip, r, len] of TOES) {
    const toe = new THREE.Mesh(toeGeo, skin);
    toe.scale.set(r, r * 0.82, len / 2);
    toe.position.set(inner * x, r * 0.8, tip + len / 2);
    toe.rotation.x = 0.12; // 指先が少し下へ
    foot.add(toe);
    const nl = new THREE.Mesh(nailGeo, nail);
    nl.scale.set(r * 0.72, r * 0.25, r * 0.85);
    nl.position.set(inner * x, r * 1.42, tip + r * 0.95);
    nl.rotation.x = 0.28;
    foot.add(nl);
  }
  return foot;
}

export class Body {
  constructor(scene, camera, pipeR = 0.0072) {
    this.group = new THREE.Group();
    scene.add(this.group);
    const skin = mat(SKIN, { roughness: 0.58 });
    this.skin = skin;
    const nail = mat('#f0c6b0', { roughness: 0.35 });
    const shirt = mat('#e6e2d8', { roughness: 0.9 });
    const shorts = mat('#27477f', { roughness: 0.8 });
    const stripe = mat('#eeeae0', { roughness: 0.8 });
    const shadowOnly = (m) => { m.castShadow = true; m.receiveShadow = true; return m; };

    // 足
    this.legs = [0, 1].map((i) => {
      const thigh = shadowOnly(new THREE.Mesh(taper(0.058, 0.043), skin));
      const shin = shadowOnly(new THREE.Mesh(taper(0.042, 0.027, 14, 0.14), skin));
      const knee = shadowOnly(new THREE.Mesh(new THREE.SphereGeometry(0.043, 14, 10), skin));
      const foot = bareFoot(i === 0 ? 1 : -1, skin, nail, shadowOnly);
      // 半ズボンのすそ
      const hem = shadowOnly(new THREE.Mesh(taper(0.074, 0.068, 16, 0.02), shorts));
      const line = new THREE.Mesh(new THREE.CylinderGeometry(0.0715, 0.0695, 0.012, 16, 1, true), stripe);
      this.group.add(thigh, shin, knee, foot, hem, line);
      return { thigh, shin, knee, foot, hem, line, phase: i * Math.PI };
    });
    // 腰まわりの半ズボン
    this.pants = shadowOnly(new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), shorts));
    this.pants.scale.set(0.155, 0.13, 0.11);
    this.group.add(this.pants);
    // 胴（T シャツ）。胸に魚のプリント
    const torsoGeo = new THREE.CylinderGeometry(0.135, 0.145, 0.34, 20, 6, false);
    const tp = torsoGeo.attributes.position;
    for (let i = 0; i < tp.count; i++) {
      const y = tp.getY(i);
      tp.setZ(i, tp.getZ(i) * 0.6 * (1 + (y > 0 ? 0.06 : 0)));
      tp.setX(i, tp.getX(i) * (1 + Math.max(0, y - 0.1) * 0.6));
    }
    torsoGeo.computeVertexNormals();
    this.torso = shadowOnly(new THREE.Mesh(torsoGeo, shirt));
    this.group.add(this.torso);
    const print = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.05), new THREE.MeshStandardMaterial({ map: fishPrint(), transparent: true, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2 }));
    this.print = print;
    this.group.add(print);
    // 腕（袖・二の腕・前腕・手）
    this.arms = [0, 1].map((i) => {
      const right = i === 1;
      const upper = shadowOnly(new THREE.Mesh(taper(0.036, 0.029), skin));
      const fore = shadowOnly(new THREE.Mesh(taper(0.028, 0.019, 14, 0.12), skin));
      const elbow = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 8), skin);
      const sleeve = shadowOnly(new THREE.Mesh(taper(0.055, 0.046, 16, 0.02), shirt));
      const hand = new Hand(skin, nail, right ? 1 : -1);
      this.group.add(upper, fore, elbow, sleeve, hand.group);
      return { right, upper, fore, elbow, sleeve, hand };
    });
    this.brim = { visible: false };

    this.fp = V3();                 // 体の位置（足もと）と向き。部品は世界の座標で置くので group は動かさない
    this.fq = new THREE.Quaternion();
    this.walkT = 0;
    this.crouch = 0;
    this.handMode = 'rod';
    this._q = new THREE.Quaternion();
  }

  /** 体のローカル → 世界 */
  L(x, y, z) { return V3(x, y, z).applyQuaternion(this.fq).add(this.fp); }

  /**
   * s = { pos, yaw, speed, crouch(0..1), lean, grips:[上,下], rodUp, dig: {spot, t, stroke, hands:[a,b]}, hold: {pos} }
   */
  update(dt, s) {
    const g = { position: this.fp, quaternion: this.fq };
    this.fp.copy(s.pos);
    this.fq.setFromAxisAngle(V3(0, 1, 0), s.yaw);
    this.crouch = s.crouch;
    const c = s.crouch;
    // 歩き
    const sp = s.speed;
    this.walkT += dt * (1.3 + sp * 5.5) * (sp > 0.05 ? 1 : 0);
    const hipY = lerp(HIP_Y, 0.24, c) + Math.abs(Math.sin(this.walkT)) * 0.012 * Math.min(sp * 3, 1);
    const hipZ = lerp(0, 0.1, c);
    for (const [i, leg] of this.legs.entries()) {
      const side = i === 0 ? -1 : 1;
      const hip = this.L(side * HIP_X, hipY, hipZ);
      const ph = this.walkT + leg.phase;
      const stride = Math.min(sp * 0.6, 0.22);
      const fz = -Math.sin(ph) * stride * (1 - c);
      const lift = Math.max(0, Math.cos(ph)) * 0.05 * Math.min(sp * 3, 1) * (1 - c);
      const ankle = this.L(side * (HIP_X + 0.012 + c * 0.05), ANKLE + lift, fz - c * 0.05);
      ankle.y = Math.max(ankle.y, s.groundY + ANKLE);
      // ひざ: 前へ曲がる
      const knee = solve2(hip, ankle, THIGH, SHIN, this.L(side * 0.02, 0, -1).sub(this.L(0, 0, 0)));
      setLimb(leg.thigh, hip, knee);
      setLimb(leg.shin, knee, ankle);
      leg.knee.position.copy(knee);
      leg.foot.position.copy(ankle).add(V3(0, -ANKLE, 0));
      leg.foot.quaternion.copy(g.quaternion);
      const hemA = hip.clone().lerp(knee, 0.0), hemB = hip.clone().lerp(knee, 0.3);
      setLimb(leg.hem, hemA.add(V3(0, 0.04, 0)), hemB);
      leg.line.position.copy(hip).lerp(knee, 0.18);
      leg.line.quaternion.copy(leg.thigh.quaternion);
    }
    this.pants.position.copy(this.L(0, hipY + 0.05, hipZ));
    this.pants.quaternion.copy(g.quaternion);
    // 胴: しゃがむと前へ倒れる
    const lean = lerp(0.08, 1.05, c) + (s.lean || 0);
    const chest = this.L(0, hipY + 0.28 * Math.cos(lean) + 0.02, hipZ - 0.28 * Math.sin(lean) * 0.8);
    this.torso.position.copy(this.L(0, hipY + 0.2 * Math.cos(lean), hipZ - 0.2 * Math.sin(lean) * 0.8));
    this.torso.quaternion.copy(g.quaternion).multiply(this._q.setFromAxisAngle(V3(1, 0, 0), -lean));
    this.print.position.copy(chest).add(V3(0, 0, -0.105).applyQuaternion(this.torso.quaternion)).add(V3(0, -0.02, 0));
    this.print.quaternion.copy(this.torso.quaternion).multiply(this._q.setFromAxisAngle(V3(0, 1, 0), Math.PI));
    this.torso.visible = this.print.visible = c < 0.35;
    const shoulderY = hipY + (SHOULDER_Y - HIP_Y) * Math.cos(lean);
    const shoulderZ = hipZ - (SHOULDER_Y - HIP_Y) * Math.sin(lean) * 0.85;

    // 腕
    for (const arm of this.arms) {
      const side = arm.right ? 1 : -1;
      const sh = this.L(side * SHOULDER_X, shoulderY, shoulderZ);
      const hand = arm.hand;
      if (this.handMode === 'rod' && s.grips) {
        // 右手が上、左手が下を握る。親指は柄の上の向き。手のひらは体の内側の下向き（見下ろすと手の甲とこぶしが見える）
        const G = s.grips[arm.right ? 0 : 1];
        const up = s.rodUp;
        const palm = this.L(-side, -PALM_DOWN, 0).sub(this.fp).addScaledVector(G.clone().sub(sh).setY(0).normalize(), 0.3);
        palm.addScaledVector(up, -palm.dot(up));
        if (palm.lengthSq() < 1e-6) palm.copy(this.L(-side, 0, 0).sub(this.fp));
        // ローカル x（親指の側）= 柄の上、z = 手のひらの向き、y = 指の向き
        const x = up.clone().multiplyScalar(hand.side);
        const z = palm.normalize();
        const y = new THREE.Vector3().crossVectors(z, x).normalize();
        hand.group.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
        const off = GRIP_ANCHOR.clone().setX(0).applyQuaternion(hand.group.quaternion);
        hand.group.position.copy(G).sub(off);
        if (hand.poseName !== 'grip') hand.pose('grip');
      } else {
        const P = arm.right ? s.handR : s.handL;
        hand.orient(P.pos, P.palm, P.fwd);
        if (hand.poseName !== (P.pose || 'rest')) hand.pose(P.pose || 'rest');
        // 腕が届かない所は、肩の方へ寄せる
        const w0 = hand.wrist();
        const d = w0.distanceTo(sh), R = UPPER + FORE - 0.004;
        arm.reachOver = Math.max(0, d - R);
        if (d > R) hand.group.position.addScaledVector(w0.clone().sub(sh).normalize(), -(d - R));
      }
      const wrist = hand.wrist();
      const pole = this.L(side * 1, -0.6, 0.2).sub(this.L(0, 0, 0));
      const elbow = solve2(sh, wrist, UPPER, FORE, pole);
      setLimb(arm.upper, sh, elbow);
      setLimb(arm.fore, elbow, wrist);
      arm.elbow.position.copy(elbow);
      setLimb(arm.sleeve, sh.clone().add(V3(0, 0.03, 0)), sh.clone().lerp(elbow, 0.5));
    }
  }
}

/** 2 本の骨（長さ a, b）で from から to へ届かせたときの関節の位置（pole の向きへ曲げる） */
function solve2(from, to, a, b, pole) {
  const d = to.clone().sub(from);
  let L = d.length();
  const dir = d.clone().normalize();
  L = clamp(L, Math.abs(a - b) + 1e-3, a + b - 1e-4);
  const x = (a * a - b * b + L * L) / (2 * L);
  const h = Math.sqrt(Math.max(a * a - x * x, 0));
  const pv = pole.clone().addScaledVector(dir, -pole.dot(dir)).normalize();
  return from.clone().addScaledVector(dir, x).addScaledVector(pv, h);
}

// T シャツの胸の魚のプリント（町の主人公と同じ意匠を簡単に）
function fishPrint() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#2f6fb0';
  g.beginPath();
  g.ellipse(60, 32, 38, 17, 0, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.moveTo(94, 32); g.lineTo(122, 12); g.lineTo(116, 32); g.lineTo(122, 52); g.closePath();
  g.fill();
  g.fillStyle = '#f4f2ec';
  g.beginPath(); g.arc(36, 28, 5, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#153a66';
  g.beginPath(); g.arc(37, 28, 2.6, 0, Math.PI * 2); g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
