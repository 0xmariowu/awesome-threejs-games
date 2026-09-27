// マダコ（Octopus sinensis）の手続き的モデル
// ・外套膜は後ろ上へ伸びる卵形の袋。頭の両脇に眼の盛り上がり（眼の上に小さな突起）、横に漏斗
// ・8本の腕は岩の上に這わせ、先は巻き上がる。腕の付け根どうしは傘膜でつながる
// ・吸盤は2列。地面に伏せた所は省き、巻き上がった先で見える所だけ作る（腕は巻き上がる手前でねじれて吸盤が内側を向く）
// ・皮膚の小さな突起（乳頭）はシェーダーのバンプ、色の斑は色素胞のまだら。驚くと赤黒く濃くなる
// ・腕のうねり、外套膜の呼吸、墨を吐いて逃げる時に腕をそろえてなびかせる動きは頂点シェーダー
import * as THREE from 'three';
import { GeoBuilder, col } from '../core/geo.js';
import { patchMaterial } from '../core/shaderPatch.js';
import { RNG, makeNoise3D, smoothstep, clamp, lerp } from '../core/noise.js';
import { grid } from './lobster.js';

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const UP = V3(0, 1, 0);

// 部位
const K = { BODY: 0, ARM: 1, SUCKER: 2, EYE: 3, WEB: 4 };
const ex = (kind, t = 0, arm = 0, v = 0, bump = 0.5) => ({ aOc: [kind, t, arm, v], aBump: bump });

const C = {
  skin: col('#7a3a26'),
  dark: col('#43180f'),
  red: col('#96412a'),
  pale: col('#d8ab8c'),
  cream: col('#ecd2b8'),
  under: col('#c79070'),
  sucker: col('#e9c4ac'),
  suckerIn: col('#b5705a'),
  gold: col('#c8a050'),
};
const mix = (a, b, t) => a.clone().lerp(b, clamp(t, 0, 1));

// 体の軸（腕の付け根の口 → 頭 → 外套膜の先）
const AXIS = new THREE.CatmullRomCurve3([V3(0, 0.07, 0.05), V3(0, 0.125, 0.035), V3(0, 0.19, -0.035), V3(0, 0.265, -0.13), V3(0, 0.305, -0.215), V3(0, 0.31, -0.25)]);
const CROWN = V3(0, 0.07, 0.045);
const EYE_U = 0.21;

function bodyRadius(u) {
  // 頭（眼のある所）→ くびれ → 外套膜の卵形 → 丸い先
  const head = 0.064 + 0.012 * Math.sin(clamp(u / 0.34, 0, 1) * Math.PI);
  const neck = 1 - 0.1 * Math.exp(-(((u - 0.37) / 0.05) ** 2));
  const mant = 0.105 * Math.sin(clamp((u - 0.3) / 0.7, 0, 1) * Math.PI * 0.92 + 0.12);
  let r = u < 0.34 ? head : lerp(head, mant, smoothstep(0.3, 0.46, u));
  if (u > 0.9) r *= Math.sqrt(Math.max(0, 1 - ((u - 0.9) / 0.1) ** 2)) * 0.85 + 0.15;
  return r * neck;
}

function axisFrame(u) {
  const p = AXIS.getPointAt(u), t = AXIS.getTangentAt(u);
  const side = V3().crossVectors(t, UP).normalize(); // +x（軸は後ろ上へ向かうので t × 上 は右）
  const up = V3().crossVectors(side, t).normalize();
  return { p, t, side, up };
}

// ───────── 頭と外套膜 ─────────
function buildBody(b, q, n3) {
  const bodyAt = (u, v) => {
    const th = v * Math.PI * 2;
    const f = axisFrame(u);
    const r = bodyRadius(u);
    const sx = Math.sin(th), sy = Math.cos(th);
    // 頭は横に張り（眼の土台）、外套膜はしわと小さなこぶ
    const wide = 1 + 0.18 * (1 - smoothstep(0.3, 0.45, u));
    const wr = 1 + 0.035 * Math.sin(u * 46 + sx * 3) * smoothstep(0.4, 0.55, u) + 0.05 * n3(u * 9, sx * 3, sy * 3);
    const d = f.side.clone().multiplyScalar(sx * wide).addScaledVector(f.up, sy);
    const p = f.p.clone().addScaledVector(d, r * wr);
    return { p, d, u, sx, sy };
  };
  grid(b, Math.round(56 * q) + 8, Math.round(36 * q) + 8, true, (u, v) => {
    const r = bodyAt(u, v);
    const p = r.p;
    const n1 = n3(p.x * 30, p.y * 30, p.z * 30) * 0.5 + 0.5;
    const n2 = n3(p.x * 9 + 4, p.y * 9, p.z * 9) * 0.5 + 0.5;
    let c = mix(C.skin, C.red, n2 * 0.7);
    c = mix(c, C.dark, smoothstep(0.55, 0.8, n1) * 0.55);
    c = mix(c, C.pale, smoothstep(0.8, 0.92, n3(p.x * 55 + 9, p.y * 55, p.z * 55) * 0.5 + 0.5) * 0.35);
    c = mix(c, C.under, smoothstep(0.1, -0.7, r.sy) * 0.45);
    // 外套膜の口（首まわりの切れ目）
    c = mix(c, C.dark, Math.exp(-(((r.u - 0.37) / 0.02) ** 2)) * smoothstep(0.2, -0.4, r.sy) * 0.5);
    // 眼の下の暗い帯
    return { p, c, ex: ex(K.BODY, r.u, 0, 0, 0.9), o: r.d };
  });
  // 口の蓋（腕の付け根の中央）
  const cap = new THREE.CircleGeometry(0.062, 16);
  cap.rotateX(Math.PI / 2);
  b.merge(cap, new THREE.Matrix4().makeTranslation(0, 0.068, 0.05), () => C.under, () => ex(K.WEB, 0, 0, 0, 0.3));
}

// ───────── 眼 ─────────
function buildEyes(b, q) {
  const f = axisFrame(EYE_U);
  for (const sd of [-1, 1]) {
    const base = f.p.clone().addScaledVector(f.side, sd * bodyRadius(EYE_U) * 1.06).addScaledVector(f.up, 0.022);
    // 眼の土台の盛り上がり
    const mound = new THREE.SphereGeometry(0.03, q > 0.5 ? 16 : 8, q > 0.5 ? 12 : 6);
    mound.scale(0.75, 0.72, 0.95);
    b.merge(mound, new THREE.Matrix4().makeTranslation(base.x - sd * 0.008, base.y, base.z), (v, vn) => mix(C.skin, C.red, 0.3 + 0.3 * vn.y), () => ex(K.BODY, EYE_U, 0, 0, 1.0));
    // 眼球（瞳は横長の棒。シェーダーで描く）
    const look = V3(sd, 0.35, 0.45).normalize();
    const eu = V3(0, 1, 0).cross(look).normalize();
    const ev = look.clone().cross(eu).normalize();
    const R = 0.0165;
    const c = base.clone().addScaledVector(look, 0.023);
    const sg = new THREE.SphereGeometry(R, q > 0.5 ? 18 : 8, q > 0.5 ? 14 : 6);
    const p = sg.attributes.position;
    const i0 = b.count;
    for (let i = 0; i < p.count; i++) {
      const n = V3(p.getX(i), p.getY(i), p.getZ(i)).normalize();
      const fr = n.dot(look);
      b.vert(c.clone().addScaledVector(n, R), n, C.gold, [0, 0], { aOc: [K.EYE, fr > 0 ? n.dot(eu) / 0.9 : 2, 0, fr > 0 ? n.dot(ev) / 0.9 : 2], aBump: -1 });
    }
    for (let i = 0; i < sg.index.count; i++) b.idx.push(i0 + sg.index.array[i]);
    // まぶたの縁（眼を半分覆う皮膚の輪）
    const lid = new THREE.TorusGeometry(R * 1.0, R * 0.34, 6, q > 0.5 ? 18 : 10);
    const m = new THREE.Matrix4().lookAt(V3(), look, UP);
    m.setPosition(c.clone().addScaledVector(look, -R * 0.25));
    b.merge(lid, m, () => mix(C.skin, C.dark, 0.3), () => ex(K.BODY, EYE_U, 0, 0, 0.6));
    // 眼の上の突起（乳頭）
    if (q > 0.5) {
      for (const [ang, len] of [[-0.35, 0.02], [0.25, 0.014]]) {
        const g = new THREE.ConeGeometry(0.0045, len, 5, 1, true);
        g.translate(0, len / 2, 0);
        const dir = V3(sd * 0.3, 1, ang).normalize();
        const mm = new THREE.Matrix4().compose(base.clone().add(V3(0, 0.022, ang * 0.03)), new THREE.Quaternion().setFromUnitVectors(UP, dir), V3(1, 1, 1));
        b.merge(g, mm, (v, vn, lp) => mix(C.skin, C.pale, lp.y / len), () => ex(K.BODY, EYE_U, 0, 0, 0.4));
      }
    }
  }
  // 漏斗（左の脇から前下へ）
  const fs = axisFrame(0.33);
  const a = fs.p.clone().addScaledVector(fs.side, -bodyRadius(0.33) * 0.75).addScaledVector(fs.up, -0.035);
  const pts = [];
  for (let i = 0; i <= 6; i++) pts.push(a.clone().add(V3(-0.006 * i / 6, -0.012 * i / 6, 0.035 * i / 6)));
  const curve = new THREE.CatmullRomCurve3(pts);
  const tg = new THREE.TubeGeometry(curve, 6, 1, q > 0.5 ? 10 : 6, false);
  const tp = tg.attributes.position, tn = tg.attributes.normal;
  // 先ほど太く開いた管にする
  for (let i = 0; i < tp.count; i++) {
    const k = Math.floor(i / ((q > 0.5 ? 10 : 6) + 1)) / 6;
    const cp = curve.getPointAt(k);
    const r = 0.009 + 0.004 * k;
    tp.setXYZ(i, cp.x + tn.getX(i) * r, cp.y + tn.getY(i) * r, cp.z + tn.getZ(i) * r);
  }
  b.merge(tg, new THREE.Matrix4(), (v, vn, lp, i) => mix(C.under, C.dark, i > tp.count - 14 ? 0.5 : 0), () => ex(K.BODY, 0.33, 0, 0, 0.3));
}

// ───────── 腕 ─────────
function armPath(k, rng) {
  // 腕 k（0..7）。正面（+z）寄りの腕ほど前に、後ろの腕は脇から後ろへ這う
  const side = k < 4 ? 1 : -1, idx = k % 4;
  const ang0 = side * (0.28 + idx * 0.55) + rng.range(-0.18, 0.18); // +z から時計回り
  const L = rng.range(0.56, 0.7) * (idx === 0 ? 0.92 : 1);
  const base = CROWN.clone().add(V3(Math.sin(ang0) * 0.042, -0.002, Math.cos(ang0) * 0.042));
  const n = 64;
  const sCurl = rng.range(0.55, 0.75);
  const curlMax = rng.range(0.7, 1.55) * Math.PI;
  const wig = rng.range(-1, 1), wig2 = rng.range(0.6, 1.4);
  // 巻く向き：上へ巻き上げる腕、斜めに巻く腕、地面の上で渦を巻く腕
  const roll = rng.range(0.15, 1.5) * (rng.next() < 0.5 ? -1 : 1);
  const rad = (t) => 0.031 * Math.pow(1 - t, 1.05) + 0.0025;
  const pts = [], T = [], O = [], Sd = [], R = [];
  let p = base.clone();
  let psi = ang0;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    // 側面図（進む方向 h と高さ Y）での向き：付け根から地面へ下り、這い、先で巻き上がる
    let th;
    if (t < 0.1) th = -0.5 * smoothstep(0, 0.04, t);
    else if (t < sCurl) th = -0.5 * (1 - smoothstep(0.1, 0.2, t)) + 0.05 * Math.sin(t * 20 + k);
    else th = curlMax * Math.pow((t - sCurl) / (1 - sCurl), 1.6);
    psi = ang0 + wig * 0.5 * Math.sin(t * 3.4 * wig2 + k) * smoothstep(0.08, 0.3, t);
    const hd = V3(Math.sin(psi), 0, Math.cos(psi));
    const rl = roll * smoothstep(sCurl - 0.06, sCurl + 0.04, t);
    const cd = UP.clone().multiplyScalar(Math.cos(rl)).add(V3(Math.cos(psi), 0, -Math.sin(psi)).multiplyScalar(Math.sin(rl)));
    const tan = hd.clone().multiplyScalar(Math.cos(th)).addScaledVector(cd, Math.sin(th)).normalize();
    if (i > 0) p = p.clone().addScaledVector(tan, L / n);
    // 地面に伏せる所は、腕の太さのぶんだけ浮かせる
    if (t > 0.12 && t < sCurl) p.y = lerp(p.y, rad(t) * 0.85, smoothstep(0.1, 0.2, t));
    else if (t >= sCurl) p.y -= Math.max(0, p.y - rad(t) * 0.85) * Math.sin(rl) ** 2 * 0.25; // 地面で渦を巻く腕は浮かせない
    pts.push(p);
    T.push(tan);
    // 巻きの内側の法線（進む方向の左 = 上）と横
    const nIn = hd.clone().multiplyScalar(-Math.sin(th)).addScaledVector(cd, Math.cos(th));
    const sd = V3().crossVectors(tan, nIn).normalize();
    // 吸盤の向き：伏せた所は下、巻き上がる所では内側へ（ねじれる）
    const phi = Math.PI * smoothstep(sCurl - 0.12, sCurl + 0.04, t);
    O.push(nIn.clone().multiplyScalar(-Math.cos(phi)).addScaledVector(sd, Math.sin(phi) * side).normalize());
    Sd.push(sd);
    R.push(rad(t));
  }
  // 地面から少し持ち上がった腕先の点は地面の上へ（巻き始めを滑らかに）
  return { pts, T, O, Sd, R, L, n, k, sCurl };
}

function buildArms(b, q, n3, rng) {
  const arms = [];
  for (let k = 0; k < 8; k++) arms.push(armPath(k, rng));
  const nr = q > 0.5 ? 12 : 6;
  for (const A of arms) {
    const step = q > 0.5 ? 1 : 3;
    const idx = [];
    for (let i = 0; i <= A.n; i += step) idx.push(i);
    if (idx[idx.length - 1] !== A.n) idx.push(A.n);
    grid(b, idx.length - 1, nr, true, (u, v) => {
      const i = idx[Math.round(u * (idx.length - 1))];
      const t = i / A.n;
      const th = v * Math.PI * 2;
      const o = A.O[i], s = A.Sd[i];
      // 断面：吸盤側（口側）は平たく、背側は丸い
      const cs = Math.cos(th), sn = Math.sin(th);
      const flat = cs > 0 ? 0.72 : 1;
      const d = o.clone().multiplyScalar(cs * flat).addScaledVector(s, sn * 1.05);
      const r = A.R[i];
      const p = A.pts[i].clone().addScaledVector(d, r);
      // 背側は皮膚の色、吸盤側は淡い
      const n1 = n3(p.x * 30, p.y * 30, p.z * 30) * 0.5 + 0.5;
      let c = mix(C.skin, C.red, n3(p.x * 8 + 2, p.y * 8, p.z * 8) * 0.35 + 0.4);
      c = mix(c, C.dark, smoothstep(0.58, 0.8, n1) * 0.5);
      c = mix(c, C.pale, smoothstep(0.82, 0.92, n3(p.x * 60, p.y * 60 + 3, p.z * 60) * 0.5 + 0.5) * 0.3);
      // 白い点が腕に沿って並ぶ
      const dots = Math.max(Math.exp(-(((sn - 0.45) / 0.16) ** 2)), Math.exp(-(((sn + 0.45) / 0.16) ** 2))) * Math.pow(Math.max(0, Math.sin(t * 70 + A.k + (sn > 0 ? 1.6 : 0))), 6);
      c = mix(c, C.cream, dots * smoothstep(0.2, -0.5, cs) * 0.55);
      c = mix(c, C.under, smoothstep(0.1, 0.7, cs) * 0.75);
      c = mix(c, C.dark, (1 - smoothstep(0.0, 0.04, t)) * 0.2);
      return { p, c, ex: ex(K.ARM, t, A.k, cs, 0.7 * smoothstep(0.2, -0.4, cs)), o: d };
    });
    // 腕先の丸い端
    const tip = new THREE.SphereGeometry(A.R[A.n] * 1.1, 6, 4);
    b.merge(tip, new THREE.Matrix4().makeTranslation(A.pts[A.n].x, A.pts[A.n].y, A.pts[A.n].z), () => C.under, () => ex(K.ARM, 1, A.k, 0, 0));
  }
  return arms;
}

// 吸盤：見える向きの所だけ（地面に伏せた所は省く）
function buildSuckers(b, arms, q) {
  if (q < 0.5) return;
  const prof = (sr) => [
    new THREE.Vector2(sr * 0.18, sr * 0.28),
    new THREE.Vector2(sr * 0.38, sr * 0.5),
    new THREE.Vector2(sr * 0.72, sr * 0.62),
    new THREE.Vector2(sr * 1.0, sr * 0.5),
    new THREE.Vector2(sr * 1.08, 0.0),
  ];
  const _q = new THREE.Quaternion();
  for (const A of arms) {
    let s = 0.035;
    let row = 0;
    while (s < 0.985) {
      const i = Math.min(A.n, Math.round(s * A.n));
      const o = A.O[i];
      const r = A.R[i];
      const sr = r * 0.46;
      if (o.y > -0.35 || s < 0.14) {
        const lat = A.Sd[i].clone().multiplyScalar((row % 2 ? 1 : -1) * r * 0.36);
        const pos = A.pts[i].clone().addScaledVector(o, r * 0.62).add(lat);
        const lg = new THREE.LatheGeometry(prof(sr), 8);
        _q.setFromUnitVectors(UP, o);
        const m = new THREE.Matrix4().compose(pos, _q, V3(1, 1, 1));
        b.merge(lg, m, (v, vn, lp) => mix(C.suckerIn, C.sucker, smoothstep(sr * 0.3, sr * 0.7, Math.hypot(lp.x, lp.z))), () => ex(K.SUCKER, s, A.k, 0, 0));
      }
      // 吸盤の間隔は腕の太さに比例（先ほど小さく密に）
      s += (r * 0.9) / A.L;
      row++;
    }
  }
}

// ───────── 傘膜（腕の付け根どうしをつなぐ膜） ─────────
function buildWeb(b, arms, q) {
  const order = [0, 1, 2, 3, 7, 6, 5, 4]; // 右の前→後ろ、左の後ろ→前（ぐるりと一周）
  const nu = q > 0.5 ? 8 : 3, nv = q > 0.5 ? 5 : 2;
  for (let j = 0; j < 8; j++) {
    const A = arms[order[j]], B = arms[order[(j + 1) % 8]];
    const depthA = Math.round(A.n * 0.2), depthB = Math.round(B.n * 0.2);
    grid(b, nu, nv, false, (u, v) => {
      // u: 付け根→外、v: 腕 A → 腕 B
      const iA = Math.round(u * depthA), iB = Math.round(u * depthB);
      const pa = A.pts[iA].clone().addScaledVector(A.Sd[iA], 0), pb = B.pts[iB].clone();
      const p = pa.lerp(pb, v);
      // 膜の縁は内側へたわむ
      const sag = Math.sin(Math.PI * v) * u * 0.55;
      p.lerp(CROWN, sag * 0.5);
      p.y += Math.sin(Math.PI * v) * 0.012 * (1 - u) - sag * 0.01;
      const c = mix(mix(C.skin, C.under, 0.35), C.dark, 0.15 * Math.sin(Math.PI * v));
      return { p, c, ex: ex(K.WEB, u * 0.2, order[j], 0, 0.4), o: UP };
    });
  }
}

// ───────── 組み立て ─────────
const geoCache = new Map();
export function buildOctopusGeometry(q = 1) {
  if (geoCache.has(q)) return geoCache.get(q);
  const b = new GeoBuilder();
  const n3 = makeNoise3D(77);
  const rng = new RNG(8);
  buildBody(b, q, n3);
  buildEyes(b, q);
  const arms = buildArms(b, q, n3, rng);
  buildWeb(b, arms, q);
  buildSuckers(b, arms, q);
  const geo = b.build();
  geo.deleteAttribute('uv');
  geoCache.set(q, geo);
  return geo;
}

// ───────── シェーダー ─────────
const OCTO_VS = {
  key: 'octo2',
  decl: /* glsl */ `
    attribute vec4 aOc;
    attribute float aBump;
    uniform float uAmp;
    uniform float uCurl;
    varying vec3 vOcP;
    varying vec4 vOc;
    varying float vOcBump;
    vec3 ocDeform(vec3 p, vec3 n, float isDir) {
      float kind = aOc.x, t = aOc.y, arm = aOc.z;
      float mv = 1.0 - isDir;
      float amp = min(uAmp / 0.08, 3.0);
      float jet = clamp(-uCurl / 0.4, 0.0, 1.0);
      if (kind > 0.5 && kind < 2.5 || kind > 3.5) {
        // 腕のうねり：付け根は動かず、先ほど大きく。ときどき先を持ち上げて探る
        float ph = uTime * 1.25 + arm * 1.7;
        float w = t * t;
        p.x += mv * sin(ph + t * 5.0) * w * 0.05 * amp;
        p.z += mv * cos(ph * 0.87 + t * 4.2) * w * 0.05 * amp;
        p.y += mv * max(0.0, sin(ph * 0.6 + arm)) * pow(t, 3.0) * 0.08 * amp;
        // 墨を吐いて逃げる：腕をそろえて後ろ（+z）へなびかせる
        vec3 trail = vec3(p.x * 0.22, 0.13 + (p.y - 0.1) * 0.25 + sin(uTime * 9.0 + t * 7.0 + arm) * 0.01 * t, 0.06 + t * 0.62);
        p = mix(p, trail, jet * smoothstep(0.0, 0.25, t) * mv);
      } else if (kind < 0.5 && t > 0.38) {
        // 外套膜の呼吸
        p += mv * n * 0.006 * sin(uTime * 2.3) * smoothstep(0.38, 0.6, t);
      }
      return p;
    }
  `,
  code: /* glsl */ `
    vOcP = position;
    vOc = aOc;
    vOcBump = aBump;
    transformed = ocDeform(transformed, normal, 0.0);
  `,
};

const OCTO_FS = {
  key: 'octo2',
  decl: /* glsl */ `
    varying vec3 vOcP;
    varying vec4 vOc;
    varying float vOcBump;
    uniform float uAlarm;
    float ocH, ocK;
    vec3 ocHash(vec3 p) {
      p = vec3(dot(p, vec3(127.1, 311.7, 74.7)), dot(p, vec3(269.5, 183.3, 246.1)), dot(p, vec3(113.5, 271.9, 124.6)));
      return fract(sin(p) * 43758.5453);
    }
    vec2 ocCell(vec3 p) {
      vec3 ip = floor(p), fp = fract(p);
      float d1 = 8.0; float id = 0.0;
      for (int z = -1; z <= 1; z++)
      for (int y = -1; y <= 1; y++)
      for (int x = -1; x <= 1; x++) {
        vec3 g = vec3(float(x), float(y), float(z));
        vec3 h = ocHash(ip + g);
        vec3 r = g + h * 0.85 + 0.075 - fp;
        float d = dot(r, r);
        if (d < d1) { d1 = d; id = h.x; }
      }
      return vec2(sqrt(d1), id);
    }
  `,
  color: /* glsl */ `
    ocH = 0.0; ocK = 0.0;
    {
      float kind = vOc.x;
      if (kind > 2.5 && kind < 3.5) {
        // 眼：金色の虹彩に横長の瞳
        vec2 e = vec2(vOc.y, vOc.w);
        float r = length(e);
        vec3 iris = vec3(0.5, 0.33, 0.1) * (0.9 + 0.1 * sin(atan(e.y, e.x) * 25.0)) * (0.7 + 0.5 * smoothstep(0.15, 0.7, length(e)));
        vec3 c = mix(vec3(0.05, 0.035, 0.03), iris, 1.0 - smoothstep(0.82, 0.92, r));
        float bar = 1.0 - smoothstep(0.1, 0.16, abs(e.y) / (1.0 - 0.35 * smoothstep(0.3, 0.62, abs(e.x))));
        bar *= 1.0 - smoothstep(0.55, 0.64, abs(e.x));
        c = mix(c, vec3(0.005), bar);
        diffuseColor.rgb = c;
      } else {
        float px = length(fwidth(vOcP));
        ocK = max(vOcBump, 0.0) * (1.0 - smoothstep(0.004, 0.01, px));
        vec2 c1 = ocCell(vOcP * 70.0);
        vec2 c2 = ocCell(vOcP * 22.0 + 5.3);
        float pap = 1.0 - smoothstep(0.1, 0.55, c1.x);
        float big = 1.0 - smoothstep(0.15, 0.5, c2.x);
        ocH = pap * 0.6 + big * 0.9 * step(0.72, c2.y);
        // 乳頭の先は淡く、間は色素胞で濃い
        diffuseColor.rgb *= 1.0 + (pap * 0.22 - 0.08) * ocK;
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 1.5 + 0.04, big * step(0.72, c2.y) * 0.3 * ocK);
        // 驚くと赤黒く
        vec3 alarm = diffuseColor.rgb * vec3(0.72, 0.42, 0.36);
        diffuseColor.rgb = mix(diffuseColor.rgb, alarm, uAlarm * step(kind, 1.5) * (0.6 + 0.4 * (1.0 - pap)));
      }
    }
  `,
  normal: /* glsl */ `
    if (ocK > 0.001) {
      vec3 sp = -vViewPosition;
      vec3 sx = dFdx(sp), sy = dFdy(sp);
      float s2o = length(sx) / max(length(dFdx(vOcP)), 1e-7);
      vec2 dH = vec2(dFdx(ocH), dFdy(ocH)) * 0.0028 * s2o * ocK;
      vec3 r1 = cross(sy, normal), r2 = cross(normal, sx);
      float det = dot(sx, r1) * faceDirection;
      vec3 grad = sign(det) * (dH.x * r1 + dH.y * r2);
      normal = normalize(abs(det) * normal - grad);
    }
  `,
  rough: /* glsl */ `
    if (vOc.x > 2.5 && vOc.x < 3.5) roughnessFactor = 0.08;
    else if (vOc.x > 1.5 && vOc.x < 2.5) roughnessFactor = 0.35;
  `,
};

/** @returns {{mesh: THREE.Object3D, sw: object}} 近くは吸盤まで作った高精細、遠くは軽量 */
export function makeOctopusMesh() {
  const sw = { uAmp: { value: 0.08 }, uCurl: { value: 0 }, uAlarm: { value: 0 } };
  const mat = new THREE.MeshPhysicalMaterial({
    vertexColors: true,
    roughness: 0.55,
    metalness: 0,
    clearcoat: 0.35,
    clearcoatRoughness: 0.45,
    side: THREE.DoubleSide,
  });
  patchMaterial(mat, { sway: OCTO_VS, uniforms: sw, fx: OCTO_FS });
  const lod = new THREE.LOD();
  lod.addLevel(new THREE.Mesh(buildOctopusGeometry(1), mat), 0);
  lod.addLevel(new THREE.Mesh(buildOctopusGeometry(0.35), mat), 8);
  return { mesh: lod, sw };
}
