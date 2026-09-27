// イセエビ（Panulirus japonicus）の手続き的モデル
// ・頭胸甲は大小のトゲと頸溝のある曲面、腹節は6枚の背甲と側板、尾扇は硬い基部と膜質の先端
// ・第2触角は太いトゲだらけの柄部と長い鞭状部、第1触角は縞の二叉
// ・歩脚5対は関節ごとにくびれ、縦縞入り
// ・細かい顆粒はシェーダーのバンプで描き、画素より小さくなると消す（ちらつき防止）
// ・触角の首振り、第1触角の匂い嗅ぎ、歩脚の足踏み、腹部を巻き込む尾打ちを頂点シェーダーで動かす
import * as THREE from 'three';
import { GeoBuilder, col } from '../core/geo.js';
import { patchMaterial } from '../core/shaderPatch.js';
import { RNG, makeNoise3D, smoothstep, clamp, lerp } from '../core/noise.js';

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const UP = V3(0, 1, 0);
const I4 = new THREE.Matrix4();

// 体の基準寸法（モデル座標。+Z が頭）
const CY = 0.008; // 頭胸甲の軸の高さ（脚を広げて低く構える）
const CZ0 = 0.0, CZ1 = 0.4; // 頭胸甲の後端・前端
const FLOOR = -0.162; // 脚先の高さ
const SEG_LEN = 0.08, SEG_STEP = 0.066; // 腹節
const segFront = (k) => 0.03 - k * SEG_STEP;
const FAN_Z = segFront(5) - SEG_LEN + 0.012;

// 部位（頂点シェーダーの動きの種類）
const K = { BODY: 0, ANT: 1, ANTL: 2, LEG: 3, ABD: 4, MOUTH: 5 };
const ex = (kind, w = 0, side = 0, idx = 0, bump = 0) => ({ aLb: [kind, w, side, idx], aBump: bump });

// 色（生きている時の暗い赤褐色。茹でると真っ赤になるのはシェーダー側）
const C = {
  dark: col('#3e0f0c'),
  shell: col('#6c1f16'),
  light: col('#9c3a22'),
  purple: col('#4a1624'),
  orange: col('#cf6a34'),
  pale: col('#eac48c'),
  belly: col('#d49a6a'),
  joint: col('#e2a064'),
  membrane: col('#c0643a'),
  eye: col('#1a100c'),
  eyeRim: col('#5a3a22'),
};
const mix = (a, b, t) => a.clone().lerp(b, clamp(t, 0, 1));

// ───────── 形状ヘルパー ─────────
/**
 * (u,v) 格子の曲面を作って取り込む。fn は {p, c, ex, o}（o は外向きの目安）を返す。
 * 法線は面から計算し、外向きになるよう向きをそろえる。
 */
export function grid(b, nu, nv, wrapV, fn) {
  const cv = wrapV ? nv : nv + 1;
  const pos = new Float32Array((nu + 1) * cv * 3);
  const cols = [], exs = [], outs = [];
  let k = 0;
  for (let i = 0; i <= nu; i++) {
    for (let j = 0; j < cv; j++) {
      const r = fn(i / nu, j / nv);
      pos[k++] = r.p.x; pos[k++] = r.p.y; pos[k++] = r.p.z;
      cols.push(r.c); exs.push(r.ex); outs.push(r.o);
    }
  }
  const idx = [];
  for (let i = 0; i < nu; i++) {
    for (let j = 0; j < nv; j++) {
      const j1 = wrapV ? (j + 1) % cv : j + 1;
      const a = i * cv + j, bb = i * cv + j1, c = (i + 1) * cv + j1, d = (i + 1) * cv + j;
      idx.push(a, bb, c, a, c, d);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const n = geo.attributes.normal;
  let s = 0;
  for (let i = 0; i < n.count; i++) {
    const o = outs[i];
    if (o) s += n.getX(i) * o.x + n.getY(i) * o.y + n.getZ(i) * o.z;
  }
  if (s < 0) {
    for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; }
    geo.setIndex(idx);
    geo.computeVertexNormals();
  }
  b.merge(geo, I4, (v, vn, lp, i) => cols[i], (v, vn, lp, i) => exs[i]);
}

/** 経路に沿った座標系（平行移動フレーム） */
export function frames(pts) {
  const n = pts.length, T = [], N = [], B = [];
  for (let i = 0; i < n; i++) {
    T.push(pts[Math.min(n - 1, i + 1)].clone().sub(pts[Math.max(0, i - 1)]).normalize());
  }
  let n0 = V3().crossVectors(T[0], Math.abs(T[0].y) > 0.9 ? V3(1, 0, 0) : UP).normalize();
  for (let i = 0; i < n; i++) {
    if (i > 0) n0 = N[i - 1].clone().addScaledVector(T[i], -N[i - 1].dot(T[i])).normalize();
    N.push(n0);
    B.push(V3().crossVectors(T[i], n0).normalize());
  }
  return { T, N, B };
}

/** 管。rFn(u, th) と cFn(u, th) は周方向の角度も受け取る（縞・扁平用） */
export function tube(b, pts, nr, rFn, cFn, exFn) {
  const { N, B } = frames(pts);
  const n = pts.length;
  grid(b, n - 1, nr, true, (u, v) => {
    const i = Math.round(u * (n - 1));
    const th = v * Math.PI * 2;
    const dir = N[i].clone().multiplyScalar(Math.cos(th)).addScaledVector(B[i], Math.sin(th));
    const r = rFn(u, th);
    return { p: pts[i].clone().addScaledVector(dir, r), c: cFn(u, th), ex: exFn(u, th), o: dir };
  });
  return { pts, ...frames(pts) };
}

/** 管の表面上で、hint の方向を向いた点と外向き */
function onTube(tb, i, hint, r) {
  const T = tb.T[i];
  const d = hint.clone().addScaledVector(T, -hint.dot(T)).normalize();
  return { p: tb.pts[i].clone().addScaledVector(d, r), n: d, t: T };
}

const _q = new THREE.Quaternion();
let noSpines = false; // 遠景用モデルではトゲを省く
/** トゲ（根元は面に埋める）。色は根元→中ほど→淡い先端→ごく先だけ暗い */
function spine(b, base, dir, len, rad, baseCol, ex0, seg = 6) {
  if (noSpines) return;
  const g = new THREE.ConeGeometry(rad, len, seg, 2, true);
  g.translate(0, len / 2, 0);
  _q.setFromUnitVectors(UP, dir.clone().normalize());
  const m = new THREE.Matrix4().compose(base, _q, V3(1, 1, 1));
  b.merge(g, m, (v, vn, lp) => {
    const t = lp.y / len;
    let c = mix(baseCol, C.light, smoothstep(0.0, 0.45, t));
    c = mix(c, C.pale, smoothstep(0.5, 0.85, t));
    return mix(c, C.dark, smoothstep(0.9, 1.0, t) * 0.8);
  }, () => ex0);
}

// ───────── 頭胸甲 ─────────
function carScale(u) {
  let s = (0.9 + 0.1 * smoothstep(0, 0.35, u)) * (1 - 0.28 * smoothstep(0.5, 0.92, u));
  if (u > 0.9) s *= Math.sqrt(Math.max(0, 1 - ((u - 0.9) / 0.1) ** 2));
  return s;
}
function carapaceAt(u, v) {
  const th = v * Math.PI * 2, sx = Math.sin(th), sy = Math.cos(th);
  const s = carScale(u);
  const W = 0.1 * s, H = 0.09 * s;
  const x = W * sx * (1 + 0.07 * (1 - sy * sy));
  const y = sy >= 0 ? H * sy : H * sy * 0.6;
  // 頸溝（側面で後ろへ曲がる）、後縁の縁取り、鰓域の稜
  const uc = 0.6 - 0.08 * (1 - sy);
  const groove = Math.exp(-(((u - uc) / 0.018) ** 2)) * smoothstep(-0.45, 0.1, sy);
  const rim = Math.exp(-(((u - 0.025) / 0.02) ** 2));
  const rimG = Math.exp(-(((u - 0.075) / 0.015) ** 2)) * smoothstep(-0.3, 0.2, sy);
  const ridge = Math.exp(-(((sy + 0.28) / 0.07) ** 2)) * smoothstep(0.05, 0.2, u) * (1 - smoothstep(0.8, 0.9, u));
  const d = (-0.006 * groove + 0.004 * rim - 0.0025 * rimG + 0.002 * ridge) * Math.min(1, s * 1.5);
  const nx = sx, ny = sy * (sy < 0 ? 0.6 : 1);
  const nl = Math.hypot(nx, ny) || 1;
  const p = V3(x + (nx / nl) * d, CY + y + (ny / nl) * d, CZ0 + u * (CZ1 - CZ0));
  return { p, groove, rim, ridge, sx, sy, s };
}
function carapaceNormal(u, v) {
  const e = 0.004;
  const pu = carapaceAt(Math.min(u + e, 0.999), v).p.sub(carapaceAt(Math.max(u - e, 0), v).p);
  const pv = carapaceAt(u, v + e).p.sub(carapaceAt(u, v - e).p);
  const n = V3().crossVectors(pv, pu).normalize();
  const c = carapaceAt(u, v).p;
  if (n.dot(V3(c.x, c.y - CY, 0)) < 0) n.negate();
  return n;
}

function buildCarapace(b, q, n3, rng) {
  const colorAt = (r) => {
    const p = r.p;
    const n1 = n3(p.x * 9, p.y * 9, p.z * 9);
    const n2 = n3(p.x * 4 + 3.1, p.y * 4, p.z * 4 - 1.7);
    let c = mix(C.shell, C.light, 0.35 + 0.45 * n1);
    c = mix(c, C.purple, (n2 - 0.1) * 0.9);
    c = mix(c, C.dark, r.groove * 0.85 + (1 - smoothstep(0.02, 0.07, Math.abs(r.sx))) * smoothstep(0.3, 0.9, r.sy) * 0.25);
    c = mix(c, C.orange, r.rim * 0.45);
    c = mix(c, C.pale, r.ridge * 0.3);
    return mix(c, C.belly, 1 - smoothstep(-0.75, -0.35, r.sy));
  };
  grid(b, Math.round(80 * q), Math.round(60 * q), true, (u, v) => {
    const r = carapaceAt(u, v);
    const bump = 0.9 * smoothstep(-0.5, -0.1, r.sy) + 0.15;
    return { p: r.p, c: colorAt(r), ex: ex(K.BODY, 0, 0, 0, bump), o: V3(r.sx, r.sy, 0) };
  });
  // 後ろの開口をふさぐ（腹節の隙間から中が見えないように）
  const cap = new THREE.CircleGeometry(1, 20);
  cap.scale(0.088, 0.07, 1);
  cap.rotateY(Math.PI);
  b.merge(cap, new THREE.Matrix4().makeTranslation(0, CY + 0.005, 0.012), () => C.dark, () => ex(K.BODY));

  // トゲ：背の大トゲ（胃域の2列）、側面の大トゲ、鰓域の中トゲの列、散らばる小トゲ
  const placed = [];
  const put = (u, a, len, rad) => {
    const v = ((a / (Math.PI * 2)) % 1 + 1) % 1;
    const r = carapaceAt(u, v);
    const n = carapaceNormal(u, v);
    const dir = n.clone().multiplyScalar(0.6).add(V3(0, 0.12, 0.8)).normalize();
    spine(b, r.p.clone().addScaledVector(n, -0.002), dir, len, rad, colorAt(r), ex(K.BODY, 0, 0, 0, 0.2), q > 0.6 ? 7 : 5);
    placed.push(r.p);
  };
  for (const sd of [-1, 1]) {
    put(0.7, sd * 0.36, 0.032, 0.0095);
    put(0.79, sd * 0.38, 0.036, 0.01);
    put(0.86, sd * 0.42, 0.028, 0.0085);
    put(0.66, sd * 1.05, 0.026, 0.008);
    put(0.77, sd * 1.0, 0.03, 0.009);
    put(0.85, sd * 0.95, 0.024, 0.0075);
    for (let k = 0; k < 5; k++) {
      const u = 0.14 + k * 0.085;
      put(u, sd * (0.55 + (k % 2) * 0.12), 0.018, 0.0058);
      put(u + 0.04, sd * (1.05 + (k % 2) * 0.1), 0.016, 0.0052);
      if (q > 0.6) put(u + 0.02, sd * 1.45, 0.012, 0.004);
    }
  }
  if (q > 0.6) {
    for (let i = 0; i < 260 && placed.length < 150; i++) {
      const u = rng.range(0.1, 0.9), a = rng.range(-1.75, 1.75);
      const r = carapaceAt(u, a / (Math.PI * 2));
      if (r.groove > 0.25) continue;
      if (placed.some((pp) => pp.distanceTo(r.p) < 0.021)) continue;
      put(u, a, rng.range(0.008, 0.014), rng.range(0.0028, 0.0038));
    }
  }
}

// ───────── 額角（目の上の大きな角）と眼 ─────────
function buildHead(b, q) {
  for (const sd of [-1, 1]) {
    const v = ((sd * 0.3) / (Math.PI * 2) + 1) % 1;
    const base = carapaceAt(0.9, v).p.addScaledVector(carapaceNormal(0.9, v), -0.004);
    const pts = [];
    for (let i = 0; i <= 12; i++) {
      const t = i / 12;
      pts.push(base.clone().add(V3(sd * 0.02 * t, 0.034 * t + 0.04 * t * t, 0.095 * t - 0.01 * t * t)));
    }
    const tb = tube(b, pts, q > 0.6 ? 10 : 6,
      (u) => 0.019 * Math.pow(1 - u, 0.85) + 0.0012,
      (u) => mix(mix(mix(C.shell, C.light, smoothstep(0.2, 0.6, u)), C.orange, smoothstep(0.6, 0.85, u)), C.dark, smoothstep(0.93, 1.0, u) * 0.7),
      () => ex(K.BODY, 0, 0, 0, 0.6));
    if (q > 0.6) {
      for (const [i, len] of [[3, 0.014], [6, 0.01]]) {
        const s = onTube(tb, i, V3(sd * 0.3, 0.2, 1), 0.019 * Math.pow(1 - i / 12, 0.85));
        spine(b, s.p.addScaledVector(s.n, -0.001), s.n.clone().add(s.t).normalize(), len, 0.0035, C.light, ex(K.BODY, 0, 0, 0, 0.3), 5);
      }
    }
    // 眼柄と複眼
    const eb = V3(sd * 0.02, CY + 0.026, 0.38), ee = V3(sd * 0.03, CY + 0.04, 0.405);
    tube(b, [eb, eb.clone().lerp(ee, 0.5), ee], 6, () => 0.007, () => C.light, () => ex(K.BODY));
    const eye = new THREE.SphereGeometry(0.0118, q > 0.6 ? 16 : 9, q > 0.6 ? 12 : 7);
    const ec = V3(sd * 0.032, CY + 0.042, 0.41);
    const look = V3(sd * 0.5, 0.3, 1).normalize();
    b.merge(eye, new THREE.Matrix4().makeTranslation(ec.x, ec.y, ec.z), (vv, vn) => {
      // 眼柄側は赤銅色、前面は黒
      const back = 1 - smoothstep(-0.5, 0.1, vn.dot(look));
      return mix(C.eye, C.eyeRim, back * 0.9);
    }, () => ex(K.BODY, 0, 0, 0, -1));
  }
}

// ───────── 第2触角（太い柄部＋長い鞭） ─────────
function buildAntennae(b, q) {
  for (const sd of [-1, 1]) {
    const A0 = V3(sd * 0.05, CY - 0.012, 0.365);
    const D = V3(sd * 0.42, 0.22, 1).normalize();
    const LP = 0.27;
    const pts = [], seg = [];
    const np = Math.round(18 * Math.max(q, 0.5));
    for (let i = 0; i <= np; i++) {
      const t = i / np;
      pts.push(A0.clone().addScaledVector(D, LP * t).add(V3(0, -0.01 * Math.sin(Math.PI * t), 0)));
      seg.push(t * 0.2);
    }
    // 鞭状部：向きを少しずつ外・下へ曲げながら積分
    const nf = Math.round(130 * Math.max(q, 0.25));
    const LF = 1.05;
    const p = pts[pts.length - 1].clone();
    let yaw0 = Math.atan2(Math.abs(D.x), D.z), pitch0 = Math.asin(D.y);
    for (let i = 1; i <= nf; i++) {
      const s = i / nf;
      const yaw = yaw0 + 0.55 * Math.pow(s, 1.3);
      const pitch = pitch0 - 0.34 * Math.pow(s, 1.3);
      p.add(V3(sd * Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)).multiplyScalar(LF / nf));
      pts.push(p.clone());
      seg.push(0.2 + s * 0.8);
    }
    const nAll = pts.length - 1;
    const wAt = (u) => seg[Math.round(u * nAll)];
    const rAt = (u) => {
      const w = wAt(u);
      if (w <= 0.2) {
        const t = w / 0.2;
        // 3節の柄部。節の境でくびれる
        const art = t < 0.25 ? t / 0.25 : t < 0.6 ? (t - 0.25) / 0.35 : (t - 0.6) / 0.4;
        return lerp(0.033, 0.022, t) * (0.84 + 0.16 * Math.sin(Math.PI * art));
      }
      const s = (w - 0.2) / 0.8;
      const ring = Math.pow(0.5 + 0.5 * Math.sin(s * Math.PI * 2 * 70), 6);
      return (0.0025 + 0.0165 * Math.pow(1 - s, 1.5)) * (1 + 0.07 * ring);
    };
    const tb = tube(b, pts, q > 0.6 ? 12 : q > 0.3 ? 6 : 4, rAt, (u, th) => {
      const w = wAt(u);
      if (w <= 0.2) {
        const t = w / 0.2;
        const jn = Math.exp(-(((t - 0.25) / 0.03) ** 2)) + Math.exp(-(((t - 0.6) / 0.03) ** 2));
        const under = Math.max(0, -Math.sin(th));
        return mix(mix(mix(C.shell, C.light, 0.25), C.joint, jn * 0.5), C.belly, under * 0.25);
      }
      const s = (w - 0.2) / 0.8;
      const ring = Math.pow(0.5 + 0.5 * Math.sin(s * Math.PI * 2 * 14), 8);
      let c = mix(mix(C.shell, C.light, s * 0.8), C.orange, s * s * 0.35);
      return mix(c, C.pale, ring * 0.22);
    }, (u) => {
      const w = wAt(u);
      return ex(K.ANT, w, sd, 0, w <= 0.2 ? 0.9 : 0.35 * (1 - (w - 0.2) / 0.8));
    });
    // 柄部の前向きの大トゲ（イセエビらしさの要）
    const spinesAt = [
      [0.28, 0.034, 0.0095, 0.1], [0.36, 0.038, 0.01, -0.35], [0.46, 0.03, 0.009, 0.5],
      [0.55, 0.026, 0.0082, 0.05], [0.68, 0.028, 0.0085, -0.3], [0.78, 0.024, 0.0075, 0.4],
      [0.88, 0.02, 0.0065, 0.0], [0.94, 0.016, 0.0055, 0.7],
    ];
    for (const [t, len, rad, ang] of spinesAt) {
      if (q < 0.6 && len < 0.025) continue;
      const i = Math.round(t * np);
      const hint = V3(sd * Math.sin(ang), Math.cos(ang), 0);
      const s = onTube(tb, i, hint, rAt(i / nAll));
      const dir = s.n.clone().multiplyScalar(0.55).add(s.t.clone().multiplyScalar(0.85)).normalize();
      spine(b, s.p.addScaledVector(s.n, -0.003), dir, len, rad, C.shell, ex(K.ANT, seg[i], sd, 0, 0.3), q > 0.6 ? 7 : 5);
    }
    // 鞭の付け根にも前向きの小トゲが並ぶ
    if (q > 0.6) {
      for (let i = np + 3; i < np + nf * 0.3; i += 4) {
        const ang = ((i * 1.7) % 2) - 1;
        const s = onTube(tb, i, V3(sd * Math.sin(ang), Math.cos(ang), 0), rAt(i / nAll));
        spine(b, s.p.addScaledVector(s.n, -0.001), s.n.clone().multiplyScalar(0.4).add(s.t).normalize(), 0.01 * (1.2 - (i - np) / nf), 0.0022, C.light, ex(K.ANT, seg[i], sd, 0, 0.2), 4);
      }
    }
  }
}

// ───────── 第1触角（縞の二叉） ─────────
function buildAntennules(b, q) {
  const nr = q > 0.6 ? 7 : q > 0.3 ? 4 : 3;
  for (const sd of [-1, 1]) {
    const A0 = V3(sd * 0.014, CY - 0.02, 0.39);
    const D = V3(sd * 0.1, 0.36, 1).normalize();
    const pts = [];
    for (let i = 0; i <= 10; i++) pts.push(A0.clone().addScaledVector(D, 0.17 * (i / 10)));
    tube(b, pts, nr, (u) => {
      const art = (u * 3) % 1;
      return lerp(0.009, 0.0062, u) * (0.85 + 0.15 * Math.sin(Math.PI * art));
    }, (u) => {
      const art = (u * 3) % 1;
      return mix(mix(C.light, C.shell, u * 0.5), C.pale, smoothstep(0.85, 0.97, art) * 0.9);
    }, (u) => ex(K.ANTL, u * 0.5, sd, 0, 0.3));
    const E = pts[pts.length - 1];
    for (const [k, dir, L] of [[0, V3(sd * 0.25, 0.7, 0.7), 0.11], [1, V3(sd * 0.55, 0.15, 0.85), 0.09]]) {
      const fp = [];
      const dd = dir.normalize();
      for (let i = 0; i <= 14; i++) {
        const t = i / 14;
        fp.push(E.clone().addScaledVector(dd, L * t).add(V3(sd * 0.02 * t * t, -0.012 * t * t, 0)));
      }
      tube(b, fp, q > 0.6 ? 5 : 3, (u) => 0.0036 * (1 - u) + 0.0008, (u) => {
        const band = Math.sin(u * Math.PI * 2 * 7) > 0.2 ? 1 : 0;
        return mix(col('#7a2c1a'), C.pale, band * 0.6);
      }, (u) => ex(K.ANTL, 0.5 + u * 0.5, sd, k, 0));
    }
  }
}

// ───────── 口器（第3顎脚） ─────────
function buildMouth(b, q) {
  for (const sd of [-1, 1]) {
    const pts = [V3(sd * 0.022, CY - 0.05, 0.36), V3(sd * 0.03, CY - 0.07, 0.395), V3(sd * 0.03, CY - 0.085, 0.43), V3(sd * 0.022, CY - 0.1, 0.455)];
    const curve = new THREE.CatmullRomCurve3(pts);
    tube(b, curve.getPoints(12), q > 0.6 ? 6 : 4, (u) => 0.0075 * (1 - u * 0.5), (u) => mix(C.light, C.pale, Math.sin(u * 18) > 0.6 ? 0.7 : 0.15), (u) => ex(K.MOUTH, u, sd, 0, 0.2));
  }
}

// ───────── 歩脚5対 ─────────
function buildLegs(b, q) {
  const PHI = [0.8, 0.38, 0.02, -0.34, -0.66];
  const SC = [1.0, 1.08, 1.06, 1.0, 0.94];
  const RR = [0.011, 0.0098, 0.0095, 0.009, 0.0085];
  const nr = q > 0.6 ? 8 : q > 0.3 ? 5 : 3;
  for (let k = 0; k < 5; k++) {
    for (const sd of [-1, 1]) {
      const L = V3(sd * Math.cos(PHI[k]), 0, Math.sin(PHI[k]));
      const sc = SC[k];
      const A = V3(sd * 0.052, CY - 0.048, 0.315 - k * 0.057);
      const J1 = A.clone().addScaledVector(L, 0.03 * sc).add(V3(0, -0.008, 0));
      const J2 = J1.clone().addScaledVector(L, 0.11 * sc).add(V3(0, 0.028, 0));
      const J3 = J2.clone().addScaledVector(L, 0.035 * sc).add(V3(0, -0.02, 0));
      const J4 = J3.clone().addScaledVector(L, 0.05 * sc).add(V3(0, -0.07, 0));
      const J5 = J4.clone().addScaledVector(L, 0.03 * sc);
      J5.y = FLOOR;
      const joints = [A, J1, J2, J3, J4, J5];
      const counts = [3, 9, 4, 7, 6].map((n) => Math.max(2, Math.round(n * Math.max(q, 0.5))));
      const mult = [1.1, 1.0, 0.86, 0.78, 0.6];
      const pts = [], segOf = [];
      for (let s = 0; s < 5; s++) {
        for (let i = s === 0 ? 0 : 1; i <= counts[s]; i++) {
          const t = i / counts[s];
          pts.push(joints[s].clone().lerp(joints[s + 1], t));
          segOf.push([s, t]);
        }
      }
      const n = pts.length - 1;
      const at = (u) => segOf[Math.round(u * n)];
      tube(b, pts, nr, (u) => {
        const [s, t] = at(u);
        if (s === 4) return RR[k] * 0.6 * Math.pow(1 - t, 0.8) + 0.0008;
        return RR[k] * mult[s] * (0.8 + 0.2 * Math.sin(Math.PI * t));
      }, (u, th) => {
        const [s, t] = at(u);
        // 縦に走る淡黄色の2本の縞と、白っぽい関節
        const d1 = Math.atan2(Math.sin(th - 0.9), Math.cos(th - 0.9));
        const d2 = Math.atan2(Math.sin(th + 0.9), Math.cos(th + 0.9));
        const stripe = Math.max(Math.exp(-((d1 / 0.2) ** 2)), Math.exp(-((d2 / 0.2) ** 2)));
        let c = mix(C.shell, C.light, 0.25 + 0.2 * Math.sin(t * 3 + k));
        if (s === 0) c = mix(C.belly, C.light, 0.3);
        c = mix(c, col('#d8a058'), stripe * (s === 1 || s === 3 ? 0.5 : 0.25));
        const jn = s === 0 ? 0 : Math.exp(-((t / 0.1) ** 2)) + (s < 4 ? Math.exp(-(((1 - t) / 0.08) ** 2)) : 0);
        c = mix(c, C.joint, jn * 0.45);
        if (s === 4) c = mix(c, C.dark, smoothstep(0.55, 1, t));
        return c;
      }, (u) => ex(K.LEG, u, sd, k, 0.25));
    }
  }
}

// ───────── 腹節6枚＋腹肢 ─────────
function buildAbdomen(b, q, n3) {
  for (let k = 0; k < 6; k++) {
    const zF = segFront(k);
    const w = 0.095 - k * 0.0052, hh = 0.066 - k * 0.0035, cy = CY + 0.004 - k * 0.002;
    const plDepth = (u) => 0.02 + 0.045 * Math.pow(u, 1.6);
    const TH = 1.52;
    const at = (u, v) => {
      const vv = v * 2 - 1, av = Math.abs(vv), sg = vv < 0 ? -1 : 1;
      const z = zF - u * SEG_LEN;
      const inset = 1 - 0.07 * (1 - smoothstep(0.0, 0.2, u));
      const lip = Math.exp(-(((u - 0.93) / 0.04) ** 2));
      let x, y, o, pl = 0, groove = 0;
      if (av <= 0.72) {
        const th = (vv / 0.72) * TH;
        const gx = Math.abs(Math.sin(th));
        groove = Math.exp(-(((u - 0.5) / 0.035) ** 2)) * smoothstep(0.06, 0.2, gx) * (1 - smoothstep(0.85, 0.99, gx));
        const d = -0.0028 * groove + 0.0022 * lip;
        x = (w + d) * Math.sin(th) * inset;
        y = cy + (hh + d) * Math.cos(th) * inset;
        o = V3(Math.sin(th), Math.cos(th), 0);
      } else {
        pl = (av - 0.72) / 0.28;
        const xb = w * Math.sin(TH) * inset, yb = cy + hh * Math.cos(TH) * inset;
        x = sg * (xb + 0.006 * pl + 0.0015 * lip);
        y = yb - pl * plDepth(u);
        o = V3(sg, 0, 0);
      }
      return { p: V3(x, y, z), o, pl, groove, lip, u, av };
    };
    grid(b, Math.round(14 * q) + 4, Math.round(34 * q) + 6, false, (u, v) => {
      const r = at(u, v);
      const p = r.p;
      const n1 = n3(p.x * 10 + k, p.y * 10, p.z * 10);
      let c = mix(C.shell, C.light, 0.3 + 0.4 * n1);
      c = mix(c, C.purple, n3(p.x * 4, p.y * 4 + 5, p.z * 4) * 0.7);
      c = mix(c, C.dark, (1 - smoothstep(0.08, 0.2, r.u)) * 0.5); // 前の節の下に隠れる関節部（影）
      c = mix(c, C.dark, r.groove * 0.65);
            c = mix(c, C.light, r.lip * 0.45);
      c = mix(c, C.pale, smoothstep(0.9, 1.0, r.pl) * 0.55);
      return { p, c, ex: ex(K.ABD, 0, 0, k + 1, r.pl > 0 ? 0.55 : 0.45), o: r.o };
    });
    // 側板の先のトゲ
    const tip = at(1, 1).p, tip2 = at(1, 0).p;
    for (const [tp, sg] of [[tip, 1], [tip2, -1]]) {
      spine(b, tp.clone().add(V3(-sg * 0.003, 0.006, 0.006)), V3(sg * 0.15, -0.55, -1), 0.02, 0.005, C.shell, ex(K.ABD, 0, 0, k + 1, 0.2), q > 0.6 ? 6 : 4);
    }
    // 腹側の膜
    grid(b, 4, 8, false, (u, v) => {
      const vv = v * 2 - 1;
      const p = V3(vv * w * 0.95, cy - hh * 0.42 + 0.004 * (1 - vv * vv), zF - u * SEG_LEN);
      const bar = Math.exp(-(((u - 0.5) / 0.15) ** 2));
      return { p, c: mix(C.belly, C.orange, bar * 0.25), ex: ex(K.ABD, 0, 0, k + 1, 0.1), o: V3(0, -1, 0) };
    });
    // 最後の節の後ろの口をふさぐ（尾扇の付け根）
    if (k === 5) {
      const cap = new THREE.CircleGeometry(1, 16);
      cap.scale(w * 0.92, hh * 0.9, 1);
      cap.rotateY(Math.PI);
      b.merge(cap, new THREE.Matrix4().makeTranslation(0, cy - 0.004, zF - SEG_LEN + 0.004), () => C.shell, () => ex(K.ABD, 0, 0, 7, 0.3));
    }
    // 腹肢
    if (k >= 1 && k <= 4) {
      for (const sd of [-1, 1]) {
        const g = new THREE.SphereGeometry(1, q > 0.6 ? 10 : 6, q > 0.6 ? 6 : 4);
        g.scale(0.012, 0.0035, 0.032);
        const m = new THREE.Matrix4().makeRotationX(-0.9);
        m.premultiply(new THREE.Matrix4().makeRotationY(sd * 0.25));
        m.setPosition(sd * 0.038, cy - hh * 0.42 - 0.012, zF - SEG_LEN * 0.55);
        b.merge(g, m, (vv, vn, lp) => mix(C.membrane, C.pale, smoothstep(0, 1, Math.abs(lp.z)) * 0.6), () => ex(K.ABD, 1, sd, k + 1, 0));
      }
    }
  }
}

// ───────── 尾扇 ─────────
function buildTailFan(b, q) {
  const Y0 = CY + 0.002;
  const blade = (origin, ang, sd, Lb, W0, W1, lift, suture) => {
    const F = V3(sd * Math.sin(ang), 0, -Math.cos(ang));
    const S = V3().crossVectors(UP, F).normalize();
    grid(b, Math.round(18 * q) + 4, Math.round(12 * q) + 4, false, (u, v) => {
      const vv = v * 2 - 1;
      let w = lerp(W0, W1, smoothstep(0, 0.55, u));
      if (u > 0.7) w *= Math.sqrt(Math.max(0, 1 - ((u - 0.7) / 0.3) ** 2)) * 0.8 + 0.2;
      const ly = 0.0045 * (1 - vv * vv) + 0.0022 * Math.exp(-((vv / 0.15) ** 2)) * (1 - u) - 0.012 * u * u + lift;
      const p = origin.clone().addScaledVector(F, u * Lb).addScaledVector(S, vv * w).addScaledVector(UP, ly);
      const hard = 1 - smoothstep(0.4, 0.56, u);
      const e = Math.max(Math.abs(vv), u > 0.7 ? (u - 0.7) / 0.3 : 0);
      let c = mix(mix(col('#7e2c1c'), col('#b25a36'), u), C.shell, hard);
      c = mix(c, C.dark, (1 - smoothstep(0.0, 0.04, Math.abs(u - 0.48))) * 0.35);
      c = mix(c, c.clone().multiplyScalar(0.72), (0.5 + 0.5 * Math.sin(vv * 26)) * (1 - hard) * 0.5); // 放射状の筋
      c = mix(c, C.dark, smoothstep(0.84, 0.92, e) * (1 - smoothstep(0.96, 1.0, e)) * 0.55);
      c = mix(c, C.orange, smoothstep(0.96, 1.0, e) * 0.3);
      if (suture) c = mix(c, C.dark, Math.exp(-(((u - 0.55) / 0.015) ** 2)) * 0.8);
      return { p, c, ex: ex(K.ABD, 0, sd, 7, hard * 0.6), o: UP };
    });
    return { F, S };
  };
  const org = V3(0, Y0, FAN_Z);
  blade(org.clone().add(V3(0, 0.006, 0)), 0, 1, 0.165, 0.034, 0.05, 0, false);
  const fans = [];
  for (const sd of [-1, 1]) {
    fans.push([blade(org.clone().add(V3(sd * 0.026, 0.0, -0.008)), 0.3, sd, 0.15, 0.027, 0.047, 0, false), sd, 0.026]);
    fans.push([blade(org.clone().add(V3(sd * 0.04, -0.006, -0.004)), 0.58, sd, 0.158, 0.031, 0.055, -0.004, true), sd, 0.04]);
  }
  // 尾扇のトゲ（硬い基部に並ぶ）
  const tx = ex(K.ABD, 0, 0, 7, 0.2);
  for (const sd of [-1, 1]) {
    spine(b, org.clone().add(V3(sd * 0.029, 0.008, -0.02)), V3(sd * 0.3, 0.1, -1), 0.02, 0.0045, C.shell, tx, 5);
    if (q > 0.6) {
      for (let i = 0; i < 3; i++) spine(b, org.clone().add(V3(sd * 0.012, 0.011, -0.03 - i * 0.018)), V3(sd * 0.1, 0.35, -1), 0.01, 0.0028, C.shell, tx, 4);
    }
  }
  if (q > 0.6) {
    for (const [f, sd, off] of fans) {
      for (let i = 1; i <= 3; i++) {
        const p = V3(sd * off, Y0, FAN_Z).addScaledVector(f.F, i * 0.018).addScaledVector(f.S, sd * 0.024).add(V3(0, 0.004, 0));
        spine(b, p, f.F.clone().addScaledVector(f.S, sd * 0.35).add(V3(0, 0.15, 0)), 0.01, 0.0026, C.shell, tx, 4);
      }
    }
  }
}

// ───────── 組み立て ─────────
const geoCache = new Map();
export function buildLobsterGeometry(q = 1) {
  if (geoCache.has(q)) return geoCache.get(q);
  const b = new GeoBuilder();
  noSpines = q < 0.3;
  const n3 = makeNoise3D(41);
  const rng = new RNG(4);
  buildCarapace(b, q, n3, rng);
  buildHead(b, q);
  buildAntennae(b, q);
  buildAntennules(b, q);
  buildMouth(b, q);
  buildLegs(b, q);
  buildAbdomen(b, q, n3);
  buildTailFan(b, q);
  noSpines = false;
  const geo = b.build();
  geo.deleteAttribute('uv');
  geoCache.set(q, geo);
  return geo;
}

// ───────── シェーダー ─────────
const LOBSTER_VS = {
  key: 'lobster',
  decl: /* glsl */ `
    attribute vec4 aLb;
    attribute float aBump;
    uniform float uAmp;
    uniform float uPhase;
    uniform float uCurl;
    uniform float uWalk;
    uniform float uAlert;
    varying vec3 vLbP;
    varying float vLbBump;
    mat3 lbRX(float a) { float c = cos(a), s = sin(a); return mat3(1.0, 0.0, 0.0, 0.0, c, s, 0.0, -s, c); }
    mat3 lbRY(float a) { float c = cos(a), s = sin(a); return mat3(c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c); }
    // isDir = 1 のときは法線（回転だけ）
    vec3 lbDeform(vec3 p, float isDir) {
      float kind = aLb.x, w = aLb.y, side = aLb.z, idx = aLb.w;
      float t = uTime;
      float mv = 1.0 - isDir;
      float act = clamp(uAmp / 0.06, 0.0, 2.5);   // 0.06 = 平常時
      float thr = smoothstep(0.14, 0.26, uAmp);    // 銛に刺さって暴れている
      if (kind > 3.5 && kind < 4.5) {
        // 腹部を巻き込む尾打ち（先の節から順に、各関節で回す）
        float curl = uCurl + thr * (0.55 + 0.45 * sin(uPhase * 0.9));
        for (int i = 7; i >= 1; i--) {
          float fi = float(i);
          if (fi <= idx + 0.5) {
            vec3 pv = fi > 6.5 ? vec3(0.0, ${(CY + 0.02).toFixed(3)}, ${FAN_Z.toFixed(3)}) : vec3(0.0, ${(CY + 0.05).toFixed(3)}, ${(segFront(0) + 0.004).toFixed(3)} - (fi - 1.0) * ${SEG_STEP.toFixed(3)});
            float a = -curl * (fi < 1.5 ? 0.1 : (fi > 6.5 ? 0.5 : 0.32));
            if (fi > 6.5) a += 0.035 * sin(t * 1.3) * min(act, 1.0);
            p = lbRX(a) * (p - pv * mv) + pv * mv;
          }
        }
        // 腹肢のはばたき
        p.z += mv * w * 0.006 * sin(t * 7.0 + idx * 1.1) * min(act, 1.5);
      } else if (kind > 0.5 && kind < 1.5) {
        // 第2触角：根元を支点にゆっくり首を振り、警戒すると広げて持ち上げる。先はしなる
        vec3 pv = vec3(side * 0.05, ${(CY - 0.012).toFixed(3)}, 0.365);
        float ya = side * ((0.09 * sin(t * 0.5 + side * 1.7) + 0.045 * sin(t * 1.23 + side * 0.4)) * min(act, 1.6) + 0.16 * uAlert + thr * 0.3 * sin(uPhase * 0.7 + side));
        float pa = 0.06 * sin(t * 0.37 + side * 2.3) * min(act, 1.6) - 0.14 * uAlert;
        p = lbRY(ya) * lbRX(pa) * (p - pv * mv) + pv * mv;
        float q = max(w - 0.2, 0.0) / 0.8;
        p.x += mv * sin(t * 1.9 - q * 5.0 + side * 2.0) * q * q * 0.05 * min(act, 1.6);
        p.y += mv * cos(t * 1.4 - q * 4.0 + side) * q * q * 0.03 * min(act, 1.6);
      } else if (kind > 1.5 && kind < 2.5) {
        // 第1触角：ときどきピクッと匂いを嗅ぐ
        vec3 pv = vec3(side * 0.014, ${(CY - 0.02).toFixed(3)}, 0.39);
        float f = pow(max(sin(t * 0.8 + side * 2.0 + idx * 1.3), 0.0), 16.0);
        float pa = (-0.3 * f + 0.05 * sin(t * 2.1 + side)) * min(act, 1.5);
        float ya = side * 0.06 * sin(t * 1.6 + side) * min(act, 1.5);
        p = lbRY(ya) * lbRX(pa) * (p - pv * mv) + pv * mv;
      } else if (kind > 2.5 && kind < 3.5) {
        // 歩脚：左右交互の足踏み
        vec3 pv = vec3(side * 0.052, ${(CY - 0.048).toFixed(3)}, 0.315 - idx * 0.057);
        float ph = t * 9.0 + idx * 1.3 + (side > 0.0 ? 0.0 : 3.1416);
        float walk = uWalk + thr * 1.2;
        float ya = sin(ph) * 0.2 * walk + 0.03 * sin(t * 0.7 + idx * 1.7 + side) * min(act, 1.0);
        p = lbRY(ya) * (p - pv * mv) + pv * mv;
        p.y += mv * max(cos(ph), 0.0) * w * 0.035 * walk;
      } else if (kind > 4.5) {
        p.x += mv * sin(t * 5.0 + side) * w * 0.004 * min(act, 1.0);
      }
      return p;
    }
  `,
  code: /* glsl */ `
    vLbP = position;
    vLbBump = aBump;
    transformed = lbDeform(transformed, 0.0);
  `,
  ncode: /* glsl */ `
    objectNormal = lbDeform(objectNormal, 1.0);
  `,
};

const LOBSTER_FS = {
  key: 'lobster',
  decl: /* glsl */ `
    varying vec3 vLbP;
    varying float vLbBump;
    uniform float uCook;
    vec3 lbHash(vec3 p) {
      p = vec3(dot(p, vec3(127.1, 311.7, 74.7)), dot(p, vec3(269.5, 183.3, 246.1)), dot(p, vec3(113.5, 271.9, 124.6)));
      return fract(sin(p) * 43758.5453);
    }
    float lbCell(vec3 p) {
      vec3 ip = floor(p), fp = fract(p);
      float d1 = 8.0;
      for (int z = -1; z <= 1; z++)
      for (int y = -1; y <= 1; y++)
      for (int x = -1; x <= 1; x++) {
        vec3 g = vec3(float(x), float(y), float(z));
        vec3 r = g + lbHash(ip + g) * 0.8 + 0.1 - fp;
        d1 = min(d1, dot(r, r));
      }
      return sqrt(d1);
    }
  `,
  // 殻の顆粒：粒の頂は明るい橙。画素より細かくなる距離では消す
  color: /* glsl */ `
    float lbH, lbK;
    {
      float bumpW = max(vLbBump, 0.0);
      float px = length(fwidth(vLbP));
      lbK = bumpW * (1.0 - smoothstep(0.004, 0.009, px));
      float a = 1.0 - smoothstep(0.12, 0.62, lbCell(vLbP * 60.0));
      float b = 1.0 - smoothstep(0.0, 0.55, lbCell(vLbP * 160.0 + 3.7));
      lbH = a * 0.8 + b * 0.3 * (1.0 - smoothstep(0.0012, 0.003, px));
      diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.7, 1.25, 1.0) + vec3(0.015, 0.004, 0.0), a * lbK * 0.5);
      // 茹でると赤くなる（眼は除く）
      float lum = dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11));
      vec3 ck = mix(vec3(0.42, 0.025, 0.01), vec3(0.9, 0.1, 0.028), smoothstep(0.015, 0.12, lum));
      ck = mix(ck, vec3(1.0, 0.55, 0.32), smoothstep(0.25, 0.6, lum));
      diffuseColor.rgb = mix(diffuseColor.rgb, ck, uCook * step(-0.5, vLbBump));
    }
  `,
  normal: /* glsl */ `
    {
      vec3 sp = -vViewPosition;
      vec3 sx = dFdx(sp), sy = dFdy(sp);
      float s2o = length(sx) / max(length(dFdx(vLbP)), 1e-7);
      vec2 dH = vec2(dFdx(lbH), dFdy(lbH)) * 0.0042 * s2o * lbK;
      vec3 r1 = cross(sy, normal), r2 = cross(normal, sx);
      float det = dot(sx, r1) * faceDirection;
      vec3 grad = sign(det) * (dH.x * r1 + dH.y * r2);
      normal = normalize(abs(det) * normal - grad);
    }
  `,
};

/**
 * @param {{cooked?: boolean}} opts
 * @returns {{mesh: THREE.Object3D, sw: object}} 近くは高精細、遠くは軽量モデルに切り替わる LOD
 */
export function makeLobsterMesh(opts = {}) {
  const sw = {
    uAmp: { value: 0.06 },
    uPhase: { value: 0 },
    uCurl: { value: 0 },
    uWalk: { value: 0 },
    uAlert: { value: 0 },
    uCook: { value: opts.cooked ? 1 : 0 },
  };
  const mat = new THREE.MeshPhysicalMaterial({
    vertexColors: true,
    roughness: 0.48,
    metalness: 0,
    clearcoat: 0.55,
    clearcoatRoughness: 0.32,
    side: THREE.DoubleSide,
  });
  patchMaterial(mat, { sway: LOBSTER_VS, uniforms: sw, fx: LOBSTER_FS });
  const lod = new THREE.LOD();
  lod.addLevel(new THREE.Mesh(buildLobsterGeometry(1), mat), 0);
  lod.addLevel(new THREE.Mesh(buildLobsterGeometry(0.4), mat), 7);
  lod.addLevel(new THREE.Mesh(buildLobsterGeometry(0.2), mat), 16);
  return { mesh: lod, sw };
}

/** 足元の接地影（巣穴の生き物用。掲げたり焼いたりする展示モデルには付けない） */
let shadowMat = null;
export function makeLobsterShadow() {
  if (!shadowMat) {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(0,0,0,0.6)');
    gr.addColorStop(0.55, 'rgba(0,0,0,0.3)');
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 64, 64);
    shadowMat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), color: '#000', transparent: true, depthWrite: false });
    patchMaterial(shadowMat, { caustics: false });
  }
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), shadowMat);
  m.scale.set(0.5, 1, 0.95);
  m.position.set(0, FLOOR + 0.004, 0.02);
  m.renderOrder = -1;
  return m;
}
