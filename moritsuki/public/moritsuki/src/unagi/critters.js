// 側溝の甲殻類とカエルの手続き的モデル（銛一本のイセエビの作り方にならう。プログラムはこのゲーム専用）
// ・モクズガニ: H 字の溝と前側縁の歯のある甲羅、毛の手袋のはさみ、縁に毛の列のある平たい歩脚
// ・テナガエビ: すける体、のこぎり歯の額角、体より長い第 2 胸脚、長い第 2 触角
// ・アメリカザリガニ: 粒だらけの赤い殻、いぼのある大きなはさみ、腹の背の黒いくさび
// ・カエル（トノサマガエル）: 背の線と背側線、金色の目と横長の瞳、しま模様の足
// 部品の動き（aPiv.w）: 0 動かない, 1 はさみ（aAx まわりに振り上げる）, 2 歩く足, 3 腹（丸める）, 4 ひげ・長い腕（ゆらゆら）, 5 カエルの後ろ足
// 表面（aSurf.y）: 0 殻, 1 毛, 2 すける体, 3 カエルの皮, 4 目。aSurf.x = 粒の強さ
import * as THREE from 'three';
import { GeoBuilder } from './core/geo.js';
import { patchMaterial, U } from './shade.js';
import { RNG, makeNoise3D, smoothstep, clamp, lerp } from './core/noise.js';

const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const UP = V3(0, 1, 0);
const I4 = new THREE.Matrix4();
const col = (h) => new THREE.Color(h);
const mix = (a, b, t) => a.clone().lerp(b, clamp(t, 0, 1));
const gauss = (x, w) => Math.exp(-((x / w) ** 2));
const band = (x, a, b, w) => smoothstep(a - w, a + w, x) * (1 - smoothstep(b - w, b + w, x));
const S = { SHELL: 0, HAIR: 1, CLEAR: 2, SKIN: 3, EYE: 4 };
const P = { BODY: 0, CLAW: 1, LEG: 2, TAIL: 3, SWAY: 4, HIND: 5 };

// ───────── 組み立て ─────────
class CB extends GeoBuilder {
  constructor(seed = 1) {
    super();
    this.rng = new RNG(seed);
    this.n3 = makeNoise3D(seed * 7 + 3);
    this.body();
  }
  /** これから足す頂点の動き（種類・支点・軸・位相） */
  part(kind, piv = [0, 0, 0], ax = [1, 0, 0], ph = 0) { this.st = { aPiv: [piv[0], piv[1], piv[2], kind], aAx: ax, aPh: ph }; return this; }
  body() { return this.part(P.BODY); }
  ex(bump = 0, surf = S.SHELL) { return { aPiv: this.st.aPiv, aAx: this.st.aAx, aPh: this.st.aPh, aSurf: [bump, surf] }; }

  /** (u,v) 格子の曲面。fn は {p, c, o(外向きの目安), b(粒), s(表面)} を返す。面の向きは外へそろえる */
  grid(nu, nv, wrapV, fn) {
    const cv = wrapV ? nv : nv + 1;
    const pos = new Float32Array((nu + 1) * cv * 3);
    const cols = [], exs = [], outs = [];
    let k = 0;
    for (let i = 0; i <= nu; i++) {
      for (let j = 0; j < cv; j++) {
        const r = fn(i / nu, j / nv);
        pos[k++] = r.p.x; pos[k++] = r.p.y; pos[k++] = r.p.z;
        cols.push(r.c); exs.push(this.ex(r.b ?? 0, r.s ?? S.SHELL)); outs.push(r.o);
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
    this.merge(geo, I4, (v, vn, lp, i) => cols[i], (v, vn, lp, i) => exs[i]);
  }

  /** 管。rFn(u, th)・cFn(u, th)・bFn(u, th)。N は横（水平）、B は上向き寄り */
  tube(pts, nr, rFn, cFn, bFn = () => 0.5, surf = S.SHELL) {
    const { N, B } = frames(pts);
    const n = pts.length;
    this.grid(n - 1, nr, true, (u, v) => {
      const i = Math.round(u * (n - 1));
      const th = v * Math.PI * 2;
      const dir = N[i].clone().multiplyScalar(Math.cos(th)).addScaledVector(B[i], Math.sin(th));
      return { p: pts[i].clone().addScaledVector(dir, rFn(u, th)), c: cFn(u, th), o: dir, b: bFn(u, th), s: surf };
    });
    return { pts, N, B, T: frames(pts).T, r: rFn };
  }

  /**
   * 関節の足: 制御点を通る滑らかな管。制御点のところ（関節）がくびれる
   * r(u): 太さ, flat: 上下の厚み / 横の厚み, c(u, th): 色
   */
  limb(ctrl, r, c, { n = 22, nr = 8, flat = 1, pinch = 0.3, bump = 0.5, surf = S.SHELL, jointC = null, swell = 0 } = {}) {
    const curve = new THREE.CatmullRomCurve3(ctrl, false, 'centripetal');
    const pts = curve.getSpacedPoints(n);
    const L = [0];
    for (let i = 1; i < ctrl.length; i++) L.push(L[i - 1] + ctrl[i].distanceTo(ctrl[i - 1]));
    const joints = L.slice(1, -1).map((l) => l / L[L.length - 1]);
    const bounds = [0, ...joints, 1];
    const rr = (u, th) => {
      let k = 1;
      for (const j of joints) k *= 1 - pinch * gauss(u - j, 0.022);
      // 節ごとにまん中がふくらむ
      if (swell) for (let i = 0; i < bounds.length - 1; i++) if (u >= bounds[i] && u <= bounds[i + 1]) k *= 1 + swell * Math.sin(Math.PI * (u - bounds[i]) / (bounds[i + 1] - bounds[i]));
      const a = r(u) * k, b = a * flat;
      return (a * b) / Math.hypot(b * Math.cos(th), a * Math.sin(th));
    };
    const cc = jointC ? (u, th) => { let w = 0; for (const j of joints) w = Math.max(w, gauss(u - j, 0.016)); return mix(c(u, th), jointC, w * 0.7); } : c;
    const tb = this.tube(pts, nr, rr, cc, typeof bump === 'function' ? bump : () => bump, surf);
    tb.r = rr; tb.joints = joints;
    return tb;
  }

  /** 管の上の点（u, 周の角度 th）と外向き */
  onTube(tb, u, th) {
    const n = tb.pts.length;
    const i = Math.round(clamp(u, 0, 1) * (n - 1));
    const dir = tb.N[i].clone().multiplyScalar(Math.cos(th)).addScaledVector(tb.B[i], Math.sin(th));
    return { p: tb.pts[i].clone().addScaledVector(dir, tb.r(u, th)), n: dir, t: tb.T[i] };
  }

  /** とげ・毛・いぼ（根元は面に少し埋める）。c0 → c1 へ色が変わる */
  cone(base, dir, len, rad, c0, c1, { seg = 5, bump = 0, surf = S.SHELL } = {}) {
    const g = new THREE.ConeGeometry(rad, len, seg, 1, true);
    g.translate(0, len / 2, 0);
    const q = new THREE.Quaternion().setFromUnitVectors(UP, dir.clone().normalize());
    const m = new THREE.Matrix4().compose(base, q, V3(1, 1, 1));
    const e = this.ex(bump, surf);
    this.merge(g, m, (v, vn, lp) => mix(c0, c1, lp.y / len), () => e);
  }

  /** だ円体。shape(lp) で形を変えられる。cFn(lp, n) は元の単位球の座標で色を返す */
  blob(center, radii, rot, cFn, { w = 16, h = 12, bump = 0.4, surf = S.SHELL, shape = null } = {}) {
    const g = new THREE.SphereGeometry(1, w, h);
    const src = g.attributes.position.array.slice();
    if (shape) {
      const p = g.attributes.position;
      const t = V3();
      for (let i = 0; i < p.count; i++) { t.fromBufferAttribute(p, i); shape(t); p.setXYZ(i, t.x, t.y, t.z); }
      g.computeVertexNormals();
    }
    const q = rot instanceof THREE.Quaternion ? rot : new THREE.Quaternion().setFromEuler(new THREE.Euler(...(rot || [0, 0, 0]), 'YXZ'));
    const m = new THREE.Matrix4().compose(center, q, V3(radii[0], radii[1], radii[2]));
    const e = this.ex(bump, surf);
    const lp0 = V3();
    this.merge(g, m, (v, vn, lp, i) => { lp0.set(src[i * 3], src[i * 3 + 1], src[i * 3 + 2]); return typeof cFn === 'function' ? cFn(lp0, vn) : cFn; }, () => e);
  }

  build() {
    const g = super.build();
    g.deleteAttribute('uv');
    return g;
  }
}

/** 経路に沿った座標系（平行移動フレーム）。N は最初は水平 */
function frames(pts) {
  const n = pts.length, T = [], N = [], B = [];
  for (let i = 0; i < n; i++) T.push(pts[Math.min(n - 1, i + 1)].clone().sub(pts[Math.max(0, i - 1)]).normalize());
  let n0 = V3().crossVectors(T[0], Math.abs(T[0].y) > 0.9 ? V3(1, 0, 0) : UP).normalize();
  for (let i = 0; i < n; i++) {
    if (i > 0) n0 = N[i - 1].clone().addScaledVector(T[i], -N[i - 1].dot(T[i])).normalize();
    N.push(n0);
    const b = V3().crossVectors(n0, T[i]).normalize();
    B.push(b.y < 0 && Math.abs(T[i].y) < 0.9 ? b.negate() : b);
  }
  return { T, N, B };
}

/** 目（黒くてつやのある複眼。根元は殻の色） */
function compoundEye(B, c, r, look, stalkCol) {
  B.blob(c, [r, r, r], null, (lp, n) => {
    const f = n.dot(look);
    return mix(stalkCol, col('#0c0a08'), smoothstep(-0.55, -0.1, f));
  }, { w: 14, h: 10, bump: 0, surf: S.EYE });
}

// ───────── モクズガニ（甲羅の幅 = 1、+z = 前、底 y = 0） ─────────
export function crabGeo() {
  const B = new CB(11);
  const n3 = B.n3;
  const Y0 = 0.19, HT = 0.1, HB = 0.05;
  const CC = {
    shell: col('#3c3a22'), shell2: col('#5a5732'), dark: col('#282412'), rim: col('#8a7a4a'),
    under: col('#cdbf98'), under2: col('#9a8e66'), leg: col('#3e3a20'), leg2: col('#655c36'),
    joint: col('#a8986a'), hair: col('#231a0e'), hair2: col('#6a5230'), finger: col('#e4d8b8'), tip: col('#b89458'),
  };
  // 上から見た輪郭（th: 0 = 右、π/2 = 前）
  const outline = (th) => {
    const c = Math.cos(th), s = Math.sin(th);
    const a = 0.5, b = s > 0 ? 0.44 : 0.4, n = 2.9;
    let r = 1 / Math.pow(Math.pow(Math.abs(c) / a, n) + Math.pow(Math.abs(s) / b, n), 1 / n);
    if (s < 0) r *= 1 - 0.1 * s * s;
    const phi = Math.atan2(s, Math.abs(c)); // 0 = 横、π/2 = 前
    // 前側縁の歯（外眼窩歯を入れて片側 4 本。前へ向いてとがる）
    for (let k = 0; k < 4; k++) {
      const pk = 0.9 - k * 0.2;
      const t = (phi - pk) / 0.16;
      const tooth = t < 0 && t > -1 ? 1 + t : t >= 0 && t < 0.3 ? 1 - t / 0.3 : 0;
      r += (0.03 - k * 0.004) * tooth * tooth;
    }
    // 眼のくぼみと、額（目の間の縁は少し下がって、4 つの小さなこぶ）
    r -= 0.04 * gauss(phi - 1.06, 0.07);
    if (phi > 1.12) r -= 0.022 * smoothstep(1.12, 1.2, phi) - 0.006 * Math.abs(Math.sin((phi - 1.12) * 18));
    return r;
  };
  // 甲羅の上の起伏と溝
  const detail = (x, z) => {
    const ax = Math.abs(x);
    const g1 = gauss(z + 0.03 - 0.35 * x * x, 0.013) * smoothstep(0.2, 0.12, ax);
    const g2 = gauss(ax - 0.1 - 0.12 * (z + 0.03), 0.012) * band(z, -0.2, 0.12, 0.03);
    const g3 = gauss(z - (0.06 - 0.45 * (ax - 0.2)), 0.013) * band(ax, 0.2, 0.42, 0.03);
    const g4 = gauss(z - 0.24 + 0.2 * ax, 0.012) * smoothstep(0.16, 0.06, ax);
    const groove = Math.min(1, g1 + g2 + g3 + g4 * 0.7);
    const bulge = 0.012 * Math.exp(-((x / 0.14) ** 2 + ((z - 0.14) / 0.1) ** 2))
      + 0.014 * Math.exp(-(((ax - 0.28) / 0.13) ** 2 + ((z + 0.06) / 0.16) ** 2))
      + 0.008 * Math.exp(-((x / 0.08) ** 2 + ((z + 0.14) / 0.07) ** 2));
    return { dh: bulge - 0.009 * groove, groove };
  };
  // 甲羅: 上面 → 横の壁 → 下面 を一枚でつなぐ
  B.body();
  B.grid(80, 120, true, (u, v) => {
    const th = v * Math.PI * 2;
    const R = outline(th);
    let rho, y, top = 0, wall = 0;
    if (u < 0.44) { rho = Math.sin((u / 0.44) * Math.PI / 2); top = 1; }
    else if (u < 0.56) { rho = 1 + 0.012 * Math.sin(((u - 0.44) / 0.12) * Math.PI); wall = 1; }
    else rho = Math.sin(((1 - u) / 0.44) * Math.PI / 2);
    const x = R * rho * Math.cos(th), z = R * rho * Math.sin(th);
    const d = detail(x, z);
    const edge = smoothstep(0.8, 1.0, rho);
    if (top) y = Y0 + 0.012 + HT * (1 - Math.pow(rho, 2.4)) + d.dh * (1 - edge * 0.6) - 0.02 * smoothstep(0.3, 0.46, z) * (1 - rho * 0.3);
    else if (wall) y = Y0 + 0.012 - 0.034 * ((u - 0.44) / 0.12);
    else y = Y0 - 0.022 - HB * (1 - Math.pow(rho, 1.6));
    let c;
    if (top || wall) {
      const n1 = n3(x * 7, z * 7, 1.3), n2 = n3(x * 26, z * 26, 5.1);
      c = mix(CC.shell, CC.shell2, 0.5 + 0.7 * n1);
      c = mix(c, CC.dark, smoothstep(0.1, 0.5, n2) * 0.35 + d.groove * 0.75);
      c = mix(c, CC.rim, edge * 0.45 + wall * 0.2);
      c = mix(c, CC.under2, wall * 0.5);
    } else {
      c = mix(CC.under, CC.under2, smoothstep(0.6, 1.0, rho) + 0.3 * n3(x * 12, z * 12, 9));
    }
    return { p: V3(x, y, z), c, o: V3(Math.cos(th) * (wall ? 1 : 0.2), top ? 1 : wall ? 0 : -1, Math.sin(th) * (wall ? 1 : 0.2)), b: top ? 0.9 : wall ? 0.6 : 0.3 };
  });
  // 下面の腹（ふんどし）と口の板
  B.blob(V3(0, Y0 - 0.068, -0.08), [0.15, 0.012, 0.22], null, (lp) => mix(CC.under, CC.under2, smoothstep(0.3, 1, Math.abs(lp.x)) * 0.5), { shape: (p) => { p.x *= 1 - 0.45 * smoothstep(-0.6, 1, p.z); }, bump: 0.2 });
  for (const sd of [-1, 1]) B.blob(V3(sd * 0.05, Y0 - 0.034, 0.33), [0.045, 0.01, 0.065], [0.25, sd * 0.2, 0], mix(CC.shell, CC.under2, 0.25), { bump: 0.4 });
  // 目: 眼窩のくぼみから出る短い柄
  for (const sd of [-1, 1]) {
    const eb = V3(sd * 0.22, Y0 + 0.02, 0.37), ee = V3(sd * 0.265, Y0 + 0.068, 0.415);
    B.tube([eb, eb.clone().lerp(ee, 0.5), ee], 7, () => 0.017, () => CC.shell2, () => 0.3);
    compoundEye(B, V3(sd * 0.268, Y0 + 0.078, 0.418), 0.03, V3(sd * 0.6, 0.5, 0.6).normalize(), CC.shell2);
  }
  // はさみ（第 1 胸脚）: 長節・腕節は殻、掌部は濃い毛の手袋、指の先は白い
  for (const sd of [-1, 1]) {
    const piv = [sd * 0.3, 0.15, 0.3];
    B.part(P.CLAW, piv, [0.55, 0, -sd]);
    const legC = (u) => mix(CC.leg, CC.leg2, 0.4 + 0.4 * Math.sin(u * 9));
    B.limb([V3(sd * 0.28, 0.14, 0.27), V3(sd * 0.4, 0.18, 0.36), V3(sd * 0.5, 0.215, 0.5), V3(sd * 0.51, 0.23, 0.58)],
      (u) => lerp(0.036, 0.046, u), (u) => legC(u), { flat: 1.35, bump: 0.8, pinch: 0.35, swell: 0.12, jointC: CC.joint });
    // 掌部（内側前へ向く）
    const p0 = V3(sd * 0.51, 0.235, 0.6), p1 = V3(sd * 0.3, 0.225, 0.73);
    const D = p1.clone().sub(p0).normalize();
    const palmPts = [];
    for (let i = 0; i <= 12; i++) palmPts.push(p0.clone().lerp(p1, i / 12));
    const palm = B.tube(palmPts, 14, (u, th) => {
      const a = 0.052 * (0.78 + 0.22 * Math.sin(Math.PI * clamp(u * 1.1, 0, 1))), b = a * 1.35;
      return (a * b) / Math.hypot(b * Math.cos(th), a * Math.sin(th));
    }, () => CC.hair, () => 1, S.HAIR);
    // 毛の手袋: 掌部のまわりに密に生えたふさ
    for (let i = 0; i < 300; i++) {
      const u = Math.min(1, Math.pow(B.rng.next(), 0.8) * 1.02), th = B.rng.range(0, Math.PI * 2);
      const s = B.onTube(palm, u, th);
      const dir = s.n.clone().multiplyScalar(0.75).addScaledVector(D, B.rng.range(0.15, 0.7)).add(V3(B.rng.range(-0.35, 0.35), B.rng.range(-0.25, 0.1), B.rng.range(-0.35, 0.35))).normalize();
      B.cone(s.p.addScaledVector(s.n, -0.003), dir, B.rng.range(0.022, 0.042), B.rng.range(0.0035, 0.0055), CC.hair, CC.hair2, { seg: 3, surf: S.HAIR });
    }
    // 指: 上の可動指と下の不動指。根元は茶色、先は白く、ごく先は飴色
    const fingerC = (u) => mix(mix(col('#4a3a22'), CC.finger, smoothstep(0.15, 0.5, u)), CC.tip, smoothstep(0.85, 1.0, u));
    const up = V3(0, 1, 0);
    for (const [dy, bend, len] of [[0.028, -0.03, 0.14], [-0.03, 0.022, 0.13]]) {
      const b0 = p1.clone().addScaledVector(up, dy).addScaledVector(D, -0.01);
      const pts = [];
      for (let i = 0; i <= 10; i++) {
        const t = i / 10;
        pts.push(b0.clone().addScaledVector(D, len * t).addScaledVector(up, bend * t * t - dy * 0.55 * t));
      }
      B.tube(pts, 8, (u) => 0.02 * Math.pow(1 - u, 0.7) + 0.0025, (u) => fingerC(u), () => 0.5);
      // 内側の歯
      for (let k = 1; k < 5; k++) {
        const s = pts[k * 2];
        B.cone(s.clone().addScaledVector(up, -Math.sign(dy) * 0.01), up.clone().multiplyScalar(-Math.sign(dy)).addScaledVector(D, 0.3), 0.012, 0.004, CC.finger, CC.tip, { seg: 4 });
      }
    }
  }
  // 歩脚 4 対: 平たく長い。前節・腕節の縁に毛の列
  const legC = (u, th) => {
    let c = mix(CC.leg, CC.leg2, 0.35 + 0.35 * Math.sin(th) + 0.2 * Math.sin(u * 23));
    c = mix(c, CC.dark, smoothstep(0.93, 1, u) * 0.8);
    return c;
  };
  for (const sd of [-1, 1]) {
    for (let k = 0; k < 4; k++) {
      const ang = [0.62, 0.2, -0.24, -0.66][k];
      const len = [0.78, 0.92, 0.9, 0.76][k];
      const bz = [0.18, 0.06, -0.07, -0.19][k];
      const base = V3(sd * (0.4 - Math.abs(bz) * 0.12), 0.15, bz);
      const dir = V3(sd * Math.cos(ang), 0, Math.sin(ang));
      const P1 = base.clone().addScaledVector(dir, 0.07).add(V3(0, 0.02, 0));
      const knee = base.clone().addScaledVector(dir, len * 0.44).add(V3(0, 0.135, 0));
      const ank = base.clone().addScaledVector(dir, len * 0.76).add(V3(0, 0.075, 0));
      const tip = base.clone().addScaledVector(dir, len * 0.98).add(V3(0, -0.148, 0));
      tip.y = 0.004;
      const ph = k * 1.6 + (sd > 0 ? Math.PI : 0);
      B.part(P.LEG, [base.x, base.y, base.z], [0, 0, sd], ph);
      const tb = B.limb([base, P1, knee, ank, tip], (u) => (u < 0.82 ? lerp(0.025, 0.017, u / 0.82) : lerp(0.017, 0.003, (u - 0.82) / 0.18)), legC,
        { n: 34, nr: 10, flat: 1.9, pinch: 0.38, swell: 0.1, bump: 0.7, jointC: CC.joint });
      // 毛の列（上下の縁）
      for (let h = 0; h < 16; h++) {
        const u = lerp(0.52, 0.9, h / 15);
        for (const side of [1, -1]) {
          const s = B.onTube(tb, u, side * Math.PI / 2);
          const d = s.n.clone().addScaledVector(s.t, 0.4).normalize();
          B.cone(s.p.addScaledVector(s.n, -0.002), d, 0.022 + 0.01 * Math.sin(h * 1.7), 0.0035, CC.hair, CC.hair2, { seg: 3, surf: S.HAIR });
        }
      }
    }
  }
  return B.build();
}

// ───────── エビ・ザリガニの共通の部品 ─────────
/**
 * 頭胸甲: z0..z1、軸の高さ Y、横幅 W(u)、上の高さ H(u)、下の高さ Hb(u)。deco(u, th, x, y, z) → {dh, c, b}
 */
function carapace(B, { z0, z1, Y, W, H, Hb, deco, nu = 48, nv = 40, surf = S.SHELL }) {
  B.grid(nu, nv, true, (u, v) => {
    const th = v * Math.PI * 2;
    const sn = Math.sin(th), cs = Math.cos(th);
    const w = W(u), h = cs > 0 ? H(u) : Hb(u);
    const x = w * sn * (1 + 0.06 * (1 - cs * cs));
    const y = Y + h * cs;
    const z = lerp(z0, z1, u);
    const d = deco(u, th, x, y, z);
    const o = V3(sn, cs, 0);
    return { p: V3(x, y, z).addScaledVector(o, d.dh || 0), c: d.c, o, b: d.b ?? 0.6, s: surf };
  });
  // 後ろの口をふさぐ
  B.blob(V3(0, Y, z0 + 0.004), [W(0) * 0.92, (H(0) + Hb(0)) * 0.46, 0.006], null, col('#2a1c14'), { w: 12, h: 8, bump: 0 });
}

/**
 * 腹節 6 枚（重なり合う）と尾扇。すべて腹の動き（丸める）にのる
 * segs: [{len, W, H, Hp}], yAt(z): 軸の高さ, colFn(k, u, th, x, y) → Color
 */
function abdomen(B, { zA, Y, segs, yAt, colFn, surf = S.SHELL, bump = 0.5, fan }) {
  B.part(P.TAIL, [0, Y, zA]);
  let zf = zA + 0.006;
  const ends = [];
  segs.forEach((sg, k) => {
    const zb = zf - sg.len;
    B.grid(14, 36, true, (u, v) => {
      const th = v * Math.PI * 2;
      const sn = Math.sin(th), cs = Math.cos(th);
      const z = lerp(zf, zb, u);
      const prof = (0.95 + 0.05 * smoothstep(0, 0.3, u)) * (1 - 0.02 * smoothstep(0.75, 1, u));
      let x, y;
      if (cs >= 0) { x = sg.W * sn * prof; y = sg.H * cs * prof; }
      else {
        // 側板: 下へ垂れて、下は平ら
        const a = Math.abs(cs);
        x = sg.W * sn * prof * (1 + 0.08 * a) * (1 - 0.35 * Math.pow(a, 6));
        y = -sg.Hp * Math.pow(a, 0.4) * prof;
      }
      const hump = (sg.hump || 0) * Math.sin(Math.PI * u) * Math.max(0, cs);
      return { p: V3(x, yAt(z) + y + hump, z), c: colFn(k, u, th, x, y), o: V3(sn, cs, 0), b: bump, s: surf };
    });
    ends.push(zb);
    zf = zb + sg.len * 0.3;
  });
  // 尾扇: 尾節（先細りの板）と、左右 2 枚ずつの尾肢
  const zt = ends[ends.length - 1] + 0.012;
  const yt = yAt(zt) - 0.004;
  B.blob(V3(0, yt, zt - fan.telson * 0.5), [fan.w * 0.42, 0.008, fan.telson * 0.5], null, (lp) => fan.col(lp.z), {
    shape: (p) => { p.x *= 1 - 0.55 * smoothstep(0.6, -1, p.z); },
    bump: 0.4, surf,
  });
  for (const sd of [-1, 1]) {
    for (const [dx, ang, l, w] of [[0.3, 0.32, 1.0, 0.36], [0.72, 0.62, 1.04, 0.42]]) {
      const len = fan.telson * l;
      const c = V3(sd * fan.w * dx * 0.5, yt - 0.002, zt - len * 0.5 + 0.004);
      B.blob(c, [fan.w * w * 0.5, 0.006, len * 0.52], [0, sd * ang * 0.6, 0], (lp) => fan.col(lp.z), { bump: 0.3, surf });
    }
  }
  B.body();
}

/** 長いひげ（第 2 触角）。base から前へ出て、横へ回りこんで後ろへなびく */
function whip(B, base, sd, { R, a1, back, r0, c0, c1, lift = 0.02, ph = 0 }) {
  const pts = [];
  const N = 30;
  const arcL = R * a1, total = arcL + back;
  for (let i = 0; i <= N; i++) {
    const s = (i / N) * total;
    let p;
    if (s < arcL) {
      const a = s / R;
      p = V3(sd * R * (1 - Math.cos(a)), lift * Math.sin(a * 0.8), R * Math.sin(a));
    } else {
      const a = a1, e = s - arcL;
      const dir = V3(sd * Math.sin(a), 0, Math.cos(a));
      p = V3(sd * R * (1 - Math.cos(a)), lift * Math.sin(a * 0.8), R * Math.sin(a)).addScaledVector(dir, e);
      p.y -= e * e * 0.08;
    }
    pts.push(p.add(base));
  }
  B.part(P.SWAY, [base.x, base.y, base.z], [0, 1, 0], ph);
  B.tube(pts, 5, (u) => lerp(r0, r0 * 0.28, Math.pow(u, 0.6)), (u) => mix(c0, c1, u), () => 0.2);
  B.body();
}

/** 細い歩脚（エビ・ザリガニ）: 付け根 → ひざ（上がる） → 先（底につく） */
function walkLeg(B, base, sd, z, { out, up, back, r0, c, k, bump = 0.4, surf = S.SHELL }) {
  const knee = V3(base.x + sd * out * 0.55, base.y + up, z + 0.01);
  const ank = V3(base.x + sd * out * 0.8, base.y + up * 0.55, z - back * 0.4);
  const tip = V3(base.x + sd * out, 0.003, z - back);
  B.part(P.LEG, [base.x, base.y, base.z], [0, 0, sd], k * 1.7 + (sd > 0 ? Math.PI : 0));
  B.limb([base, knee, ank, tip], (u) => lerp(r0, r0 * 0.3, u), (u, th) => c(u, th), { n: 16, nr: 6, flat: 1.2, pinch: 0.25, bump, surf });
  B.body();
}

// ───────── テナガエビ（体の長さ = 1、+z = 前、額角の先 ≈ +0.47、尾の先 ≈ -0.53） ─────────
export function shrimpGeo() {
  const B = new CB(23);
  const n3 = B.n3;
  const Y = 0.085;
  const CC = {
    body: col('#6a6854'), body2: col('#8e8a70'), dark: col('#2e2a1a'), stripe: col('#463e2a'),
    arm: col('#39414a'), arm2: col('#56606a'), joint: col('#b8b090'), eye: col('#2a2014'),
  };
  // 頭胸甲: 横に平たく、側面に暗い斜めのしま
  carapace(B, {
    z0: 0.0, z1: 0.31, Y,
    W: (u) => 0.047 * (1 - 0.3 * u * u) * Math.sqrt(1 - 0.85 * smoothstep(0.86, 1, u)),
    H: (u) => 0.058 * (1 - 0.22 * u * u) * Math.sqrt(1 - 0.8 * smoothstep(0.88, 1, u)),
    Hb: (u) => 0.052 * (1 - 0.3 * u) * Math.sqrt(1 - 0.7 * smoothstep(0.85, 1, u)),
    deco: (u, th, x, y, z) => {
      const side = Math.abs(Math.sin(th));
      const st = smoothstep(0.55, 0.85, Math.sin((z * 55 + (y - Y) * 90) * 1.0)) * side * smoothstep(-0.6, 0.2, Math.cos(th));
      let c = mix(CC.body, CC.body2, 0.5 + 0.6 * n3(x * 30, y * 30, z * 30));
      c = mix(c, CC.stripe, st * 0.6 + smoothstep(0.3, 0.7, n3(x * 30, y * 30, z * 30)) * 0.25);
      const groove = gauss(u - 0.62 + 0.1 * (1 - Math.cos(th)), 0.02) * side;
      return { c: mix(c, CC.dark, groove * 0.4), dh: -0.002 * groove, b: 0.25 };
    },
    surf: S.CLEAR,
  });
  // 額角: 上にのこぎりの歯が並ぶ、うすい刃
  {
    const pts = [];
    for (let i = 0; i <= 14; i++) { const t = i / 14; pts.push(V3(0, Y + 0.03 + 0.03 * t + 0.012 * t * t, 0.27 + 0.2 * t)); }
    B.tube(pts, 8, (u, th) => {
      const a = 0.0045 * (1 - u) + 0.0008, b = 0.017 * Math.pow(1 - u, 0.8) + 0.001;
      return (a * b) / Math.hypot(b * Math.cos(th), a * Math.sin(th));
    }, (u) => mix(CC.body, CC.dark, 0.3 + 0.3 * u), () => 0.2, S.CLEAR);
    for (let k = 0; k < 11; k++) {
      const t = 0.04 + k * 0.075;
      const p = pts[Math.round(t * 14)].clone();
      const h = 0.017 * Math.pow(1 - t, 0.8);
      B.cone(p.add(V3(0, h * 0.8, 0)), V3(0, 1, 0.9), 0.008, 0.0022, CC.body, CC.dark, { seg: 3 });
    }
    for (let k = 0; k < 3; k++) {
      const t = 0.45 + k * 0.14;
      const p = pts[Math.round(t * 14)].clone();
      B.cone(p.add(V3(0, -0.017 * Math.pow(1 - t, 0.8) * 0.8, 0)), V3(0, -1, 0.9), 0.006, 0.0018, CC.body, CC.dark, { seg: 3 });
    }
  }
  // 目
  for (const sd of [-1, 1]) {
    const eb = V3(sd * 0.018, Y + 0.025, 0.29), ee = V3(sd * 0.042, Y + 0.035, 0.31);
    B.tube([eb, eb.clone().lerp(ee, 0.5), ee], 6, () => 0.009, () => CC.body, () => 0.1, S.CLEAR);
    compoundEye(B, V3(sd * 0.046, Y + 0.036, 0.312), 0.019, V3(sd * 0.7, 0.3, 0.6).normalize(), CC.body);
  }
  // 腹: 3 節目が盛り上がる。しまと点
  abdomen(B, {
    zA: 0.0, Y,
    yAt: (z) => Y - 0.004 - 0.36 * z * z,
    segs: [
      { len: 0.078, W: 0.046, H: 0.052, Hp: 0.056 },
      { len: 0.078, W: 0.045, H: 0.054, Hp: 0.058 },
      { len: 0.084, W: 0.043, H: 0.056, Hp: 0.056, hump: 0.01 },
      { len: 0.076, W: 0.038, H: 0.048, Hp: 0.048 },
      { len: 0.07, W: 0.032, H: 0.04, Hp: 0.04 },
      { len: 0.094, W: 0.024, H: 0.031, Hp: 0.028 },
    ],
    colFn: (k, u, th, x, y) => {
      let c = mix(CC.body, CC.body2, 0.4 + 0.5 * n3(k * 3 + u * 4, x * 40, y * 40));
      c = mix(c, CC.dark, smoothstep(0.75, 0.98, u) * 0.55);
      c = mix(c, CC.stripe, smoothstep(0.35, 0.7, n3(k * 11 + u * 3, x * 30, y * 30)) * 0.35);
      c = mix(c, CC.dark, smoothstep(0.2, 0.8, Math.cos(th)) * 0.25);
      return c;
    },
    surf: S.CLEAR, bump: 0.2,
    fan: { w: 0.075, telson: 0.085, col: (z) => mix(CC.body2, CC.stripe, 0.3 + 0.3 * z) },
  });
  // 腹肢（泳ぐ足）: 腹の下の小さなへら
  B.part(P.TAIL, [0, Y, 0.0]);
  for (let k = 0; k < 5; k++) {
    const z = -0.04 - k * 0.075;
    for (const sd of [-1, 1]) {
      const b = V3(sd * 0.016, Y - 0.046 - 0.36 * z * z, z);
      B.limb([b, b.clone().add(V3(sd * 0.006, -0.014, 0.014)), b.clone().add(V3(sd * 0.008, -0.02, 0.032))], (u) => lerp(0.005, 0.0025, u), () => CC.body2, { n: 6, nr: 4, bump: 0, surf: S.CLEAR });
    }
  }
  B.body();
  // 第 1 触角（短い二又）と、触角のうろこ
  for (const sd of [-1, 1]) {
    const b = V3(sd * 0.014, Y + 0.02, 0.31);
    B.limb([b, b.clone().add(V3(sd * 0.012, 0.004, 0.06))], () => 0.006, () => CC.body, { n: 4, nr: 5, bump: 0, surf: S.CLEAR });
    for (const [dx, dy, l] of [[0.03, 0.03, 0.2], [0.05, 0.0, 0.14]]) {
      const s = b.clone().add(V3(sd * 0.012, 0.004, 0.06));
      const pts = [];
      for (let i = 0; i <= 8; i++) { const t = i / 8; pts.push(s.clone().add(V3(sd * dx * t, dy * t, l * t))); }
      B.part(P.SWAY, [s.x, s.y, s.z], [0, 1, 0], sd * 2 + dx * 30);
      B.tube(pts, 4, (u) => lerp(0.0028, 0.0009, u), (u) => mix(CC.body, CC.dark, u), () => 0, S.CLEAR);
      B.body();
    }
    B.blob(V3(sd * 0.036, Y - 0.004, 0.36), [0.011, 0.003, 0.06], [0, sd * 0.18, 0], (lp) => mix(CC.body2, CC.body, Math.abs(lp.x)), { bump: 0, surf: S.CLEAR, shape: (p) => { p.x *= 1 - 0.5 * smoothstep(-0.2, 1, p.z); } });
  }
  // 第 2 触角: 体の 1.5 倍ほどの長いひげ
  for (const sd of [-1, 1]) whip(B, V3(sd * 0.03, Y + 0.004, 0.33), sd, { R: 0.22, a1: 2.3, back: 0.9, r0: 0.0042, c0: CC.body, c1: CC.stripe, ph: sd * 1.3 });
  // 第 1 胸脚（小さなはさみ）
  for (const sd of [-1, 1]) {
    const b = V3(sd * 0.022, Y - 0.045, 0.24);
    B.part(P.SWAY, [b.x, b.y, b.z], [0, 1, 0], sd * 2.2);
    B.limb([b, V3(sd * 0.05, Y - 0.05, 0.3), V3(sd * 0.055, Y - 0.04, 0.37), V3(sd * 0.05, Y - 0.035, 0.42)], (u) => lerp(0.0055, 0.003, u), () => CC.body2, { n: 12, nr: 5, bump: 0.2, surf: S.CLEAR });
    B.body();
  }
  // 第 2 胸脚: 体より長い腕。長節・腕節・掌部は暗い青灰色で細かいとげ、指は細長い
  for (const sd of [-1, 1]) {
    const b = V3(sd * 0.026, Y - 0.045, 0.22);
    B.part(P.SWAY, [b.x, b.y, b.z], [0, 1, 0], sd * 1.1);
    const armC = (u, th) => {
      let c = mix(CC.arm, CC.arm2, 0.4 + 0.4 * Math.sin(th) + 0.3 * n3(u * 40, th, sd));
      return mix(c, CC.joint, 0.0);
    };
    const tb = B.limb([b, V3(sd * 0.1, 0.045, 0.42), V3(sd * 0.2, 0.04, 0.68), V3(sd * 0.2, 0.034, 0.94)],
      (u) => (u < 0.08 ? lerp(0.008, 0.012, u / 0.08) : u < 0.6 ? lerp(0.012, 0.0135, (u - 0.08) / 0.52) : lerp(0.0135, 0.016, (u - 0.6) / 0.4)), armC,
      { n: 40, nr: 8, pinch: 0.35, bump: 0.9, jointC: CC.joint });
    // 細かなとげ（掌部と腕節）
    for (let i = 0; i < 40; i++) {
      const u = B.rng.range(0.3, 1.0), th = B.rng.range(0, Math.PI * 2);
      const s = B.onTube(tb, u, th);
      B.cone(s.p.addScaledVector(s.n, -0.001), s.n.clone().addScaledVector(s.t, 1.2), 0.006, 0.0014, CC.arm2, col('#9aa0a0'), { seg: 3 });
    }
    // 指（少し開いた二本）
    const pe = V3(sd * 0.2, 0.034, 0.94);
    for (const [dx, dy] of [[0.004, 0.006], [-0.004, -0.006]]) {
      const pts = [];
      for (let i = 0; i <= 10; i++) {
        const t = i / 10;
        pts.push(pe.clone().add(V3(sd * dx * Math.sin(t * Math.PI) * 1.4 - sd * 0.035 * t, dy * Math.sin(t * Math.PI), 0.16 * t)));
      }
      B.tube(pts, 6, (u) => lerp(0.0095, 0.0018, Math.pow(u, 0.8)), (u) => mix(CC.arm, col('#8a8a78'), smoothstep(0.6, 1, u)), () => 0.5);
    }
    B.body();
  }
  // 歩脚 3 対
  const legC = (u) => mix(CC.body2, CC.body, u);
  for (const sd of [-1, 1]) [0.2, 0.14, 0.08].forEach((z, k) => walkLeg(B, V3(sd * 0.03, Y - 0.045, z), sd, z, { out: 0.17, up: 0.02, back: 0.04, r0: 0.0055, c: legC, k, bump: 0.1, surf: S.CLEAR }));
  return B.build();
}

// ───────── アメリカザリガニ（体の長さ = 1） ─────────
export function crayfishGeo() {
  const B = new CB(37);
  const n3 = B.n3;
  const Y = 0.09;
  const CC = {
    red: col('#621810'), red2: col('#8e2a16'), dark: col('#2c0906'), under: col('#b0583a'),
    tub: col('#d86a3a'), tub2: col('#f0c8a0'), black: col('#1a0806'), leg: col('#8a2614'),
  };
  // 頭胸甲: 粒だらけ。頸溝と、背の細い帯（アレオラ）
  carapace(B, {
    z0: 0.0, z1: 0.36, Y,
    W: (u) => 0.074 * (1 - 0.35 * u * u) * Math.sqrt(1 - 0.8 * smoothstep(0.88, 1, u)),
    H: (u) => 0.068 * (1 - 0.25 * u * u) * Math.sqrt(1 - 0.75 * smoothstep(0.9, 1, u)),
    Hb: (u) => 0.058 * (1 - 0.3 * u),
    deco: (u, th, x, y, z) => {
      const cs = Math.cos(th);
      const cerv = gauss(u - 0.52 + 0.08 * (1 - cs), 0.018) * smoothstep(-0.7, -0.2, cs);
      const areola = gauss(Math.abs(x) - 0.012, 0.004) * smoothstep(0.1, 0.2, u) * (1 - smoothstep(0.48, 0.55, u)) * smoothstep(0.7, 0.95, cs);
      let c = mix(CC.red, CC.red2, 0.4 + 0.6 * n3(x * 18, y * 18, z * 18) + 0.25 * (1 - cs));
      c = mix(c, CC.dark, smoothstep(0.5, 1.0, cs) * 0.45 + cerv * 0.6 + areola * 0.5);
      c = mix(c, CC.under, smoothstep(-0.4, -0.85, cs));
      return { c, dh: -0.003 * cerv - 0.002 * areola, b: 0.8 };
    },
  });
  // 額角: 平たい三角で、ふちが立ち、先がとがる
  {
    const pts = [];
    for (let i = 0; i <= 10; i++) { const t = i / 10; pts.push(V3(0, Y + 0.035 + 0.008 * t, 0.33 + 0.13 * t)); }
    B.tube(pts, 10, (u, th) => {
      const a = 0.026 * Math.pow(1 - u, 0.9) + 0.0015, b = a * 0.3;
      return (a * b) / Math.hypot(b * Math.cos(th), a * Math.sin(th));
    }, (u, th) => mix(CC.red, CC.dark, 0.3 + 0.4 * Math.abs(Math.cos(th))), () => 0.6);
    for (const sd of [-1, 1]) B.cone(V3(sd * 0.018, Y + 0.036, 0.405), V3(sd * 0.5, 0.2, 1), 0.012, 0.0035, CC.red2, CC.tub2, { seg: 4 });
  }
  for (const sd of [-1, 1]) {
    const eb = V3(sd * 0.022, Y + 0.028, 0.35), ee = V3(sd * 0.04, Y + 0.034, 0.37);
    B.tube([eb, eb.clone().lerp(ee, 0.5), ee], 6, () => 0.011, () => CC.red, () => 0.3);
    compoundEye(B, V3(sd * 0.043, Y + 0.035, 0.372), 0.021, V3(sd * 0.7, 0.35, 0.6).normalize(), CC.red);
  }
  // 腹: 背のまん中に黒っぽいくさび、側板のふちは暗い
  abdomen(B, {
    zA: 0.0, Y,
    yAt: (z) => Y - 0.008 - 0.2 * z * z,
    segs: [
      { len: 0.075, W: 0.068, H: 0.05, Hp: 0.052 },
      { len: 0.075, W: 0.068, H: 0.05, Hp: 0.056 },
      { len: 0.075, W: 0.065, H: 0.048, Hp: 0.054 },
      { len: 0.072, W: 0.06, H: 0.045, Hp: 0.05 },
      { len: 0.068, W: 0.054, H: 0.04, Hp: 0.044 },
      { len: 0.07, W: 0.046, H: 0.034, Hp: 0.034 },
    ],
    colFn: (k, u, th, x, y) => {
      const cs = Math.cos(th);
      let c = mix(CC.red, CC.red2, 0.3 + 0.5 * n3(k * 3 + u * 4, x * 20, y * 20) + 0.3 * (1 - Math.abs(cs)));
      const wedge = smoothstep(0.02 + 0.012 * (5 - k) * (1 - u * 0.5), 0.004, Math.abs(x)) * smoothstep(0.6, 0.9, cs);
      c = mix(c, CC.black, wedge * 0.75 + smoothstep(0.8, 0.98, u) * 0.35);
      c = mix(c, CC.dark, smoothstep(-0.6, -0.9, cs) * 0.5);
      return c;
    },
    bump: 0.7,
    fan: { w: 0.13, telson: 0.1, col: (z) => mix(CC.red2, CC.dark, 0.3 + 0.3 * z) },
  });
  // 触角: 赤茶色で体ほどの長さ。第 1 触角は短い二又
  for (const sd of [-1, 1]) {
    whip(B, V3(sd * 0.036, Y + 0.004, 0.38), sd, { R: 0.18, a1: 1.7, back: 0.55, r0: 0.0055, c0: CC.red, c1: CC.dark, ph: sd * 1.7 });
    const b = V3(sd * 0.012, Y + 0.022, 0.37);
    for (const [dx, dy] of [[0.02, 0.02], [0.035, -0.005]]) {
      const pts = [];
      for (let i = 0; i <= 6; i++) { const t = i / 6; pts.push(b.clone().add(V3(sd * dx * t, dy * t, 0.1 * t))); }
      B.part(P.SWAY, [b.x, b.y, b.z], [0, 1, 0], sd * 2 + dx * 40);
      B.tube(pts, 4, (u) => lerp(0.003, 0.001, u), () => CC.red, () => 0);
      B.body();
    }
    B.blob(V3(sd * 0.05, Y - 0.004, 0.4), [0.012, 0.004, 0.04], [0, sd * 0.25, 0], CC.red2, { bump: 0.3 });
  }
  // 大きなはさみ: 掌部は平たく、上の面はいぼだらけ。指の内側にもいぼの列
  for (const sd of [-1, 1]) {
    const piv = [sd * 0.05, Y - 0.045, 0.3];
    B.part(P.CLAW, piv, [-1, 0, -0.25 * sd]);
    const redC = (u, th) => mix(mix(CC.red, CC.red2, 0.3 + 0.4 * Math.sin(th)), CC.under, smoothstep(-0.4, -0.9, Math.sin(th)));
    const arm = B.limb([V3(sd * 0.05, Y - 0.045, 0.3), V3(sd * 0.16, Y - 0.028, 0.4), V3(sd * 0.2, Y - 0.014, 0.49), V3(sd * 0.215, Y - 0.008, 0.535)],
      (u) => lerp(0.017, 0.026, u), redC, { n: 20, nr: 10, flat: 1.1, bump: 0.9, pinch: 0.35, swell: 0.12 });
    // 腕節のとげ
    for (const u of [0.72, 0.8, 0.9]) {
      const s = B.onTube(arm, u, Math.PI * 0.5 + sd * 0.8);
      B.cone(s.p.addScaledVector(s.n, -0.002), s.n.clone().addScaledVector(s.t, 0.8), 0.018, 0.005, CC.red2, CC.tub2, { seg: 5 });
    }
    const p0 = V3(sd * 0.22, Y - 0.005, 0.54), p1 = V3(sd * 0.27, Y - 0.004, 0.72);
    const palmPts = [];
    for (let i = 0; i <= 14; i++) palmPts.push(p0.clone().lerp(p1, i / 14));
    const palm = B.tube(palmPts, 16, (u, th) => {
      const a = 0.052 * (0.78 + 0.22 * Math.sin(Math.PI * clamp(u * 1.1, 0, 1))), b = a * 0.5;
      return (a * b) / Math.hypot(b * Math.cos(th), a * Math.sin(th));
    }, redC, () => 1.0);
    // いぼ
    for (let i = 0; i < 70; i++) {
      const u = B.rng.range(0.05, 1.0), th = B.rng.range(0.15, Math.PI - 0.15) * (B.rng.chance(0.8) ? 1 : -1);
      const s = B.onTube(palm, u, th);
      const r = B.rng.range(0.0035, 0.0065);
      B.blob(s.p.addScaledVector(s.n, -r * 0.35), [r, r, r * 0.8], null, (lp) => mix(CC.red2, CC.tub, smoothstep(0.1, 0.9, lp.dot(s.n))), { w: 6, h: 4, bump: 0 });
    }
    // 指: 外側が可動指。先は橙から黒
    const D = p1.clone().sub(p0).normalize();
    const side = V3(sd, 0, 0);
    for (const [dx, bend, len] of [[0.024, -0.03, 0.17], [-0.026, 0.026, 0.16]]) {
      const b0 = p1.clone().addScaledVector(side, dx).addScaledVector(D, -0.012);
      const pts = [];
      for (let i = 0; i <= 12; i++) {
        const t = i / 12;
        pts.push(b0.clone().addScaledVector(D, len * t).addScaledVector(side, bend * t * t - dx * 0.5 * t));
      }
      const f = B.tube(pts, 8, (u, th) => {
        const a = 0.024 * Math.pow(1 - u, 0.55) + 0.002, b = a * 0.62;
        return (a * b) / Math.hypot(b * Math.cos(th), a * Math.sin(th));
      }, (u) => mix(mix(CC.red, CC.red2, u), CC.black, smoothstep(0.86, 1, u)), () => 0.9);
      for (let k = 1; k < 9; k++) {
        const u = k / 10;
        const s = B.onTube(f, u, Math.PI * (dx > 0 ? 1 : 0) + (dx > 0 ? 0 : 0));
        const r = 0.0045;
        B.blob(s.p.addScaledVector(s.n, -r * 0.35), [r, r, r], null, CC.tub, { w: 6, h: 4, bump: 0 });
      }
    }
    B.body();
  }
  // 歩脚 4 対（前の 2 対は小さなはさみ）
  const legC = (u, th) => mix(mix(CC.leg, CC.red2, 0.3 + 0.3 * Math.sin(th)), CC.dark, smoothstep(0.9, 1, u) * 0.6);
  for (const sd of [-1, 1]) [0.25, 0.18, 0.11, 0.04].forEach((z, k) => walkLeg(B, V3(sd * 0.045, Y - 0.05, z), sd, z, { out: 0.2 - k * 0.005, up: 0.035, back: 0.02 + k * 0.03, r0: 0.0085, c: legC, k, bump: 0.6 }));
  return B.build();
}

// ───────── カエル（トノサマガエル。体の長さ = 1、座った形） ─────────
export function frogGeo() {
  const B = new CB(51);
  const n3 = B.n3;
  const CC = {
    green: col('#48662e'), green2: col('#62803a'), olive: col('#65683a'), blot: col('#161c0e'), line: col('#c4c878'),
    ridge: col('#b8a060'), side: col('#aab884'), belly: col('#ece8d6'), lip: col('#dcd8a8'),
    iris: col('#c49a44'), iris2: col('#4a3414'), pupil: col('#040302'), tymp: col('#6e5634'), leg: col('#587436'),
  };
  // 表を補間する関数
  const tab = (T) => (t) => {
    if (t <= T[0][0]) return T[0][1];
    for (let i = 1; i < T.length; i++) if (t <= T[i][0]) { const k = (t - T[i - 1][0]) / (T[i][0] - T[i - 1][0]); return lerp(T[i - 1][1], T[i][1], k * k * (3 - 2 * k)); }
    return T[T.length - 1][1];
  };
  // 背骨の線（t: 0 = 総排出腔、1 = 鼻先）。座ると前が上がり、腰のところが盛り上がる
  const spine = new THREE.CatmullRomCurve3([V3(0, 0.085, -0.4), V3(0, 0.165, -0.25), V3(0, 0.2, -0.03), V3(0, 0.222, 0.15), V3(0, 0.232, 0.32), V3(0, 0.198, 0.5)]);
  const Wt = tab([[0, 0.085], [0.12, 0.145], [0.35, 0.195], [0.58, 0.19], [0.7, 0.172], [0.8, 0.168], [0.9, 0.125], [1, 0.05]]);
  const Ht = tab([[0, 0.045], [0.16, 0.085], [0.3, 0.072], [0.55, 0.068], [0.75, 0.064], [0.9, 0.048], [1, 0.02]]);
  const Hbt = tab([[0, 0.055], [0.2, 0.105], [0.45, 0.118], [0.65, 0.1], [0.8, 0.068], [0.92, 0.042], [1, 0.02]]);
  const endK = (t) => Math.sqrt(Math.sin(Math.min(1, t / 0.06) * Math.PI / 2)) * Math.pow(Math.sin(Math.min(1, (1 - t) / 0.1) * Math.PI / 2), 0.5);
  B.body();
  B.grid(72, 48, true, (t, v) => {
    const th = v * Math.PI * 2;
    const sn = Math.sin(th), cs = Math.cos(th);
    const c0 = spine.getPointAt(t);
    const k = endK(t);
    const w = Wt(t) * k, h = (cs > 0 ? Ht(t) : Hbt(t)) * k;
    const e = 2.3;
    const sx = Math.sign(sn) * Math.pow(Math.abs(sn), 2 / e), sy = Math.sign(cs) * Math.pow(Math.abs(cs), 2 / e);
    // 背側線（目の後ろから腰へ続く、盛り上がったすじ）
    const ridge = gauss(Math.abs(sn) - 0.55, 0.045) * smoothstep(0.14, 0.26, t) * (1 - smoothstep(0.66, 0.74, t)) * Math.max(0, cs);
    const x = w * sx * (1 + 0.035 * ridge), y = c0.y + h * sy + 0.005 * ridge, z = c0.z;
    let c = mix(CC.green, CC.green2, 0.45 + 0.6 * n3(x * 9, y * 9, z * 9));
    c = mix(c, CC.olive, smoothstep(0.1, 0.5, n3(x * 4 + 7, z * 4, 2.2)) * 0.5);
    // 背の黒い斑（背の線をさけて、縦に長い）
    const bl = n3(Math.abs(x) * 11 + 3, z * 7, 1.7) + 0.4 * n3(x * 24, z * 18, 7);
    c = mix(c, CC.blot, smoothstep(0.12, 0.3, bl) * smoothstep(-0.35, 0.2, cs) * 0.92 * (1 - smoothstep(0.84, 0.92, t)) * smoothstep(0.012, 0.03, Math.abs(x)));
    // 背の線
    c = mix(c, CC.line, 0.75 * gauss(x, 0.006) * smoothstep(0.3, 0.8, cs) * smoothstep(0.06, 0.16, t) * (1 - smoothstep(0.9, 0.97, t)));
    c = mix(c, CC.ridge, ridge * 0.6);
    c = mix(c, CC.side, smoothstep(0.05, -0.4, cs) * 0.75);
    c = mix(c, CC.blot, smoothstep(0.3, 0.45, n3(x * 20, z * 20, 4)) * gauss(cs + 0.25, 0.2) * 0.6 * (1 - smoothstep(0.75, 0.85, t)));
    c = mix(c, CC.belly, smoothstep(-0.4, -0.72, cs));
    // 上あごの明るい線と口のすじ
    const jaw = smoothstep(0.68, 0.78, t);
    c = mix(c, CC.lip, gauss(cs + 0.14, 0.09) * jaw * 0.85);
    c = mix(c, CC.blot, gauss(cs + 0.26, 0.025) * jaw * 0.85);
    return { p: V3(x, y, z), c, o: V3(sn, cs, 0), b: 0.45 + 0.45 * Math.max(0, cs), s: S.SKIN };
  });
  // 目: 頭の上に飛び出す。金色の虹彩に細かい網目、横長の黒い瞳。上をまぶたがおおう
  for (const sd of [-1, 1]) {
    const ec = V3(sd * 0.108, 0.286, 0.325);
    const look = V3(sd * 0.9, 0.2, 0.45).normalize();
    const ref = V3(0, 1, 0).addScaledVector(look, -look.y).normalize();
    const side = V3().crossVectors(look, ref);
    B.blob(ec, [0.046, 0.046, 0.046], null, (lp) => {
      const f = lp.dot(look), up = lp.dot(ref), sw = lp.dot(side);
      let c = mix(CC.iris, CC.iris2, smoothstep(0.25, 0.6, n3(up * 24, sw * 24, 3)) * 0.6);
      c = mix(c, CC.iris2, smoothstep(0.55, 0.3, f) * 0.8);
      const pup = Math.hypot(sw / 0.36, up / 0.17);
      c = mix(c, CC.pupil, smoothstep(1.0, 0.8, pup) * smoothstep(0.6, 0.8, f));
      // 上はまぶたの皮（頭の色へなじむ）
      return mix(c, mix(CC.green, CC.ridge, 0.25), smoothstep(0.5, 0.7, lp.y + 0.15 * f));
    }, { w: 24, h: 18, bump: 0, surf: S.EYE });
    // 鼓膜（目の後ろの丸い膜）
    B.blob(V3(sd * 0.16, 0.255, 0.235), [0.005, 0.034, 0.034], [0, sd * 0.3, 0], (lp) => mix(CC.tymp, col('#3e2e18'), smoothstep(0.75, 1, Math.hypot(lp.y, lp.z))), { w: 12, h: 10, bump: 0.1, surf: S.SKIN });
    // 鼻の穴
    B.blob(V3(sd * 0.036, 0.245, 0.468), [0.008, 0.005, 0.008], null, CC.pupil, { w: 6, h: 4, bump: 0 });
  }
  // 足の色: 上は緑に黒い横じま、下は白っぽい
  const legC = (u, th, per = 7) => {
    const top = Math.sin(th);
    let c = mix(CC.leg, CC.green2, 0.3 + 0.3 * top);
    c = mix(c, CC.blot, smoothstep(0.25, 0.7, Math.sin(u * per * Math.PI * 2)) * 0.8 * smoothstep(-0.3, 0.3, top));
    return mix(c, CC.side, smoothstep(-0.1, -0.7, top) * 0.7);
  };
  // 前足と 4 本の指
  for (const sd of [-1, 1]) {
    B.limb([V3(sd * 0.125, 0.16, 0.18), V3(sd * 0.18, 0.085, 0.2), V3(sd * 0.165, 0.03, 0.28), V3(sd * 0.155, 0.012, 0.31)],
      (u) => lerp(0.036, 0.018, u), (u, th) => legC(u, th, 2), { n: 16, nr: 9, pinch: 0.18, bump: 0.3, surf: S.SKIN });
    const hand = V3(sd * 0.155, 0.012, 0.31);
    [-0.55, -0.1, 0.35, 0.8].forEach((a0, f) => {
      const a = a0 * sd;
      const len = [0.05, 0.065, 0.06, 0.045][f];
      const tip = hand.clone().add(V3(Math.sin(a) * len, -0.004, Math.cos(a) * len));
      B.limb([hand, hand.clone().lerp(tip, 0.5).add(V3(0, 0.005, 0)), tip], (u) => lerp(0.009, 0.006, u), () => mix(CC.leg, CC.side, 0.5), { n: 6, nr: 5, pinch: 0.1, bump: 0.1, surf: S.SKIN });
      B.blob(tip, [0.007, 0.005, 0.007], null, CC.side, { w: 6, h: 4, bump: 0, surf: S.SKIN });
    });
  }
  // 後ろ足（たたんだ形）: もも → すね → かかと → 足の甲 → 水かきのある長い指
  for (const sd of [-1, 1]) {
    const hip = V3(sd * 0.08, 0.11, -0.33);
    B.part(P.HIND, [hip.x, hip.y, hip.z], [1, 0, 0]);
    const knee = V3(sd * 0.255, 0.088, -0.08), heel = V3(sd * 0.15, 0.045, -0.39), foot = V3(sd * 0.26, 0.013, -0.18);
    B.limb([hip, hip.clone().lerp(knee, 0.5).add(V3(sd * 0.02, 0.02, 0)), knee], (u) => lerp(0.066, 0.042, u), (u, th) => legC(u, th, 2.5), { n: 14, nr: 12, pinch: 0, bump: 0.3, surf: S.SKIN });
    B.limb([knee, knee.clone().lerp(heel, 0.5).add(V3(sd * 0.035, 0.03, 0)), heel], (u) => lerp(0.04, 0.026, u), (u, th) => legC(u + 0.2, th, 3), { n: 16, nr: 10, pinch: 0.04, bump: 0.3, surf: S.SKIN });
    B.limb([heel, heel.clone().lerp(foot, 0.5).add(V3(0, 0.008, 0)), foot], (u) => lerp(0.024, 0.016, u), (u, th) => legC(u + 0.4, th, 2), { n: 10, nr: 8, pinch: 0.1, bump: 0.2, surf: S.SKIN });
    const tips = [];
    for (let f = 0; f < 5; f++) {
      const a = sd * (0.12 + (f - 2) * 0.2);
      const len = [0.075, 0.1, 0.14, 0.19, 0.12][f];
      const tip = foot.clone().add(V3(Math.sin(a) * len, -0.006, Math.cos(a) * len));
      tips.push(tip);
      B.limb([foot, foot.clone().lerp(tip, 0.5).add(V3(0, 0.004, 0)), tip], (u) => lerp(0.01, 0.005, u), () => mix(CC.leg, CC.blot, 0.35), { n: 8, nr: 5, pinch: 0.1, bump: 0.1, surf: S.SKIN });
    }
    // 水かき: 指の間のうすい膜（指の先の手前までの扇）
    B.grid(6, 12, false, (u, v) => {
      const f = v * 4, i = Math.min(3, Math.floor(f)), k = f - i;
      const tp = tips[i].clone().lerp(tips[i + 1], k);
      const reach = 0.72 - 0.25 * Math.sin(k * Math.PI);
      const p = foot.clone().lerp(tp, u * reach);
      p.y = 0.011 + 0.002 * Math.sin(u * Math.PI);
      return { p, c: mix(CC.leg, CC.side, 0.35 + 0.3 * u), o: V3(0, 1, 0), b: 0, s: S.SKIN };
    });
    B.body();
  }
  return B.build();
}

// ───────── 見た目（色のまだら・殻の粒・毛・すける体） ─────────
const CRITTER_VS = /* glsl */ `
  attribute vec4 aPiv;
  attribute vec3 aAx;
  attribute float aPh;
  attribute vec4 aAnim;     // 歩きの位相, 歩きの強さ, はさみ上げ(0..1), 腹を丸める(0..1)
  attribute float aVis;
  attribute vec2 aSurf;
  varying vec2 vSurf;
  varying vec3 vLoc;
  vec3 rotA(vec3 v, vec3 ax, float a) {
    float c = cos(a), s = sin(a);
    return v * c + cross(ax, v) * s + ax * dot(ax, v) * (1.0 - c);
  }
`;
const CRITTER_V = /* glsl */ `
  {
    float kind = aPiv.w;
    vec3 pv = aPiv.xyz;
    vec3 p = cp - pv;
    vec3 n = cn;
    if (kind > 0.5 && kind < 1.5) {
      float a = -aAnim.z * 0.9;
      p = rotA(p, normalize(aAx), a); n = rotA(n, normalize(aAx), a);
    } else if (kind > 1.5 && kind < 2.5) {
      float ph = aAnim.x + aPh;
      float sw = sin(ph) * 0.35 * aAnim.y;
      float lf = max(0.0, cos(ph)) * 0.35 * aAnim.y;
      p = rotA(p, vec3(0.0, 1.0, 0.0), sw); n = rotA(n, vec3(0.0, 1.0, 0.0), sw);
      p = rotA(p, normalize(aAx), lf); n = rotA(n, normalize(aAx), lf);
    } else if (kind > 2.5 && kind < 3.5) {
      // 腹: 後ろほど強く曲げる（尾をたたむ）
      float d = max(0.0, -(cp.z - pv.z));
      float a = aAnim.w * d * 3.2;
      p = rotA(p, vec3(1.0, 0.0, 0.0), -a); n = rotA(n, vec3(1.0, 0.0, 0.0), -a);
    } else if (kind > 3.5 && kind < 4.5) {
      float a = sin(uTime * 1.3 + aPh) * 0.15 + sin(uTime * 3.1 + aPh * 2.0) * 0.05;
      float d = length(p);
      p = rotA(p, vec3(0.0, 1.0, 0.0), a * min(d * 6.0, 1.0)); n = rotA(n, vec3(0.0, 1.0, 0.0), a);
    } else if (kind > 4.5) {
      // カエルの後ろ足: 跳ぶと後ろへ伸びる
      float a = aAnim.w * 1.4;
      p = rotA(p, normalize(aAx), a); n = rotA(n, normalize(aAx), a);
    }
    cp = p + pv;
    cn = n;
    if (aVis < 0.5) cp = vec3(0.0, -50.0, 0.0);
  }
`;
const CR_DECL = /* glsl */ `
  varying vec2 vSurf;
  varying vec3 vLoc;
  float crH = 0.0, crK = 0.0, crF = 150.0;
  float crHash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float crNoise(vec3 x) {
    vec3 i = floor(x), f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(crHash(i), crHash(i + vec3(1, 0, 0)), f.x), mix(crHash(i + vec3(0, 1, 0)), crHash(i + vec3(1, 1, 0)), f.x), f.y),
               mix(mix(crHash(i + vec3(0, 0, 1)), crHash(i + vec3(1, 0, 1)), f.x), mix(crHash(i + vec3(0, 1, 1)), crHash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
  }
`;
const CR_COLOR = /* glsl */ `
  {
    float sk = vSurf.y;
    crF = (sk > 2.5 && sk < 3.5) ? 55.0 : 150.0;
    vec3 q = vLoc * crF;
    float fade = 1.0 - smoothstep(0.45, 1.1, length(fwidth(q)));
    if (sk > 0.5 && sk < 1.5) {
      // 毛: 細い繊維のすじ
      vec3 qh = vLoc * 480.0;
      float f1 = crNoise(qh), f2 = crNoise(qh * 2.3 + 5.0);
      float fib = f1 * 0.6 + f2 * 0.4;
      diffuseColor.rgb *= mix(0.9, 0.5 + 1.0 * smoothstep(0.3, 0.8, fib), fade);
      crH = fib * 1.5;
      crK = fade;
    } else if (sk < 3.5) {
      // 殻の粒・皮のいぼ
      float g = crNoise(q) * 0.7 + crNoise(q * 2.1 + 3.0) * 0.3;
      float gr = smoothstep(0.4, 0.9, g);
      crH = gr * vSurf.x;
      crK = fade;
      diffuseColor.rgb *= 1.0 + (gr * 0.1 - 0.03) * vSurf.x * fade;
    }
    if (sk < 3.5) diffuseColor.rgb *= 0.88 + 0.24 * crNoise(vLoc * 22.0);
  }
`;
const CR_NORMAL = /* glsl */ `
  if (crK > 0.001) {
    vec3 sp = -vViewPosition;
    vec3 sx = dFdx(sp), sy = dFdy(sp);
    float s2o = length(sx) / max(length(dFdx(vLoc)), 1e-7);
    float amp = (vSurf.y > 0.5 && vSurf.y < 1.5 ? 0.9 : vSurf.y > 2.5 ? 0.35 : 0.14) / crF * s2o;
    vec2 dH = vec2(dFdx(crH), dFdy(crH)) * amp * crK;
    vec3 r1 = cross(sy, normal), r2 = cross(normal, sx);
    float det = dot(sx, r1) * faceDirection;
    vec3 grad = sign(det) * (dH.x * r1 + dH.y * r2);
    normal = normalize(abs(det) * normal - grad);
  }
`;
const CR_ROUGH = /* glsl */ `
  {
    float sk = vSurf.y;
    roughnessFactor = sk < 0.5 ? 0.36 : sk < 1.5 ? 0.95 : sk < 2.5 ? 0.24 : sk < 3.5 ? 0.3 : 0.08;
    metalnessFactor = 0.0;
  }
`;
const CR_LIGHT = /* glsl */ `
  {
    float sk = vSurf.y;
    float dl = length(vWPos - uLampPos);
    float irr = lampCone(vWPos) * uLampI / (dl * dl + 0.1) * clamp(pow(dl / 0.85, 3.6), 0.02, 1.0);
    float wd = ditchLevel(vWPos) - vWPos.y;
    vec3 ab = wd > 0.0 ? exp(-uWaterSigma * wd * 2.0) : vec3(1.0);
    vec3 vdir = normalize(vViewPosition);
    float nv = abs(dot(normal, vdir));
    if (sk > 1.5 && sk < 2.5) {
      // すける体: ライトの光が体の中で散って、ぼんやり明るい
      reflectedLight.directDiffuse += diffuseColor.rgb * irr * ab * (0.012 + 0.03 * (1.0 - nv));
    } else if (sk > 0.5 && sk < 1.5) {
      // 毛のふちは光を散らして、ふわっと明るい
      reflectedLight.directDiffuse += diffuseColor.rgb * irr * ab * pow(1.0 - nv, 2.0) * 0.05;
    }
  }
`;

/** 関節の体のマテリアル */
export function critterMaterial(key) {
  return patchMaterial(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4 }), {
    fx: {
      key: 'critter2-' + key,
      vdecl: CRITTER_VS,
      vnormal: `vec3 cp = position; vec3 cn = normal;
vSurf = aSurf; vLoc = position;
${CRITTER_V}
vec3 objectNormal = cn;
#ifdef USE_TANGENT
vec3 objectTangent = vec3(tangent.xyz);
#endif`,
      vcode: 'transformed = cp;',
      decl: CR_DECL,
      color: CR_COLOR,
      normal: CR_NORMAL,
      rough: CR_ROUGH,
      light: CR_LIGHT,
    },
  });
}
export const critterDepthMaterial = () => {
  const dm = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  dm.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = U.uTime;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>
uniform float uTime;
${CRITTER_VS}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
vec3 cp = position; vec3 cn = vec3(0.0, 1.0, 0.0);
vSurf = aSurf; vLoc = position;
${CRITTER_V}
transformed = cp;`);
  };
  dm.customProgramCacheKey = () => 'critterDepth2';
  return dm;
};

// 目の位置（体の座標。目の光る点を置く）
export const CRITTER_EYES = {
  crab: [[-0.27, 0.272, 0.425], [0.27, 0.272, 0.425]],
  shrimp: [[-0.049, 0.122, 0.318], [0.049, 0.122, 0.318]],
  crayfish: [[-0.046, 0.126, 0.378], [0.046, 0.126, 0.378]],
  frog: [[-0.125, 0.3, 0.352], [0.125, 0.3, 0.352]],
};
