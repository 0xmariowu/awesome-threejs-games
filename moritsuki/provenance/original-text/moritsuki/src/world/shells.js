// 拾える獲物（ウニ・サザエ・アワビ）と、飾りのヒトデ
// ・ムラサキウニ：平たい殻に、長く密な紫黒のトゲ（上と下は短い）。トゲの先はやや淡い紫
// ・サザエ：対数らせんの管を巻いて殻を作る（巻きが重なる）。らせん状の肋、肩の2列の管状のツノ、石灰質の蓋。殻口を岩に向けて傾ける
// ・アワビ：後ろ寄りの殻頂から育つ低い耳形の殻（同心の成長線）、盛り上がった呼吸孔の列、石灰藻の付着、縁から覗く黒い足と触手
// ・殻のざらつき（付着物）はシェーダーのバンプ
import * as THREE from 'three';
import { GeoBuilder, col } from '../core/geo.js';
import { patchMaterial } from '../core/shaderPatch.js';
import { RNG, makeNoise3D, smoothstep, clamp, lerp } from '../core/noise.js';

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const UP = V3(0, 1, 0);
const mix = (a, b, t) => a.clone().lerp(b, clamp(t, 0, 1));

/** (u,v) 格子の面を取り込む。fn は {p, c, k(ざらつき)} を返す。法線は面から求め、外向き o にそろえる */
function surf(b, nu, nv, wrapV, fn) {
  const cv = wrapV ? nv : nv + 1;
  const pts = [];
  for (let i = 0; i <= nu; i++) for (let j = 0; j < cv; j++) pts.push(fn(i / nu, j / nv));
  const pos = new Float32Array(pts.length * 3);
  pts.forEach((r, i) => { pos[i * 3] = r.p.x; pos[i * 3 + 1] = r.p.y; pos[i * 3 + 2] = r.p.z; });
  const idx = [];
  for (let i = 0; i < nu; i++) {
    for (let j = 0; j < nv; j++) {
      const j1 = wrapV ? (j + 1) % cv : j + 1;
      const a = i * cv + j, bb = i * cv + j1, c = (i + 1) * cv + j1, d = (i + 1) * cv + j;
      idx.push(a, bb, c, a, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  const n = g.attributes.normal;
  let s = 0;
  pts.forEach((r, i) => { if (r.o) s += n.getX(i) * r.o.x + n.getY(i) * r.o.y + n.getZ(i) * r.o.z; });
  if (s < 0) {
    for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; }
    g.setIndex(idx);
    g.computeVertexNormals();
  }
  b.merge(g, new THREE.Matrix4(), (v, vn, lp, i) => pts[i].c, (v, vn, lp, i) => ({ aCrust: pts[i].k ?? 0 }));
}

const coneAlong = (b, base, dir, len, r0, r1, seg, colFn, crust = 0) => {
  const g = new THREE.CylinderGeometry(r1, r0, len, seg, 2, true);
  g.translate(0, len / 2, 0);
  const m = new THREE.Matrix4().compose(base, new THREE.Quaternion().setFromUnitVectors(UP, dir.clone().normalize()), V3(1, 1, 1));
  b.merge(g, m, (v, vn, lp) => colFn(lp.y / len), () => ({ aCrust: crust }));
};

// ───────── ムラサキウニ ─────────
export function makeUrchin(q = 1) {
  const b = new GeoBuilder();
  const rng = new RNG(31);
  const R = 0.032, SY = 0.62;
  const body = new THREE.SphereGeometry(R, q > 0.5 ? 14 : 8, q > 0.5 ? 10 : 6);
  body.scale(1, SY, 1);
  b.merge(body, new THREE.Matrix4().makeTranslation(0, R * SY * 0.75, 0), (v, vn) => mix(col('#1c0c20'), col('#3a2240'), Math.max(0, vn.y) * 0.4), () => ({ aCrust: 0.2 }));
  const N = q > 0.5 ? 150 : 48;
  const golden = Math.PI * (3 - Math.sqrt(5));
  const cBase = col('#1a0a1e'), cMid = col('#35183e'), cTip = col('#7a5a86');
  for (let i = 0; i < N; i++) {
    const y = 1 - (i / (N - 1)) * 1.75;
    if (y < -0.75) continue;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const th = golden * i;
    const n = V3(Math.cos(th) * r, y, Math.sin(th) * r);
    const base = V3(n.x * R * 0.96, R * SY * 0.75 + n.y * R * SY * 0.96, n.z * R * 0.96);
    // 赤道付近が最も長く、上は短め、下（岩の側）は短い
    const len = (0.048 + rng.range(-0.008, 0.01)) * (1 - 0.35 * Math.max(0, n.y) ** 2) * (n.y < -0.2 ? 0.55 + (n.y + 0.75) * 0.8 : 1);
    const dir = V3(n.x, n.y * 0.8 + 0.12, n.z).add(V3(rng.range(-0.18, 0.18), rng.range(-0.12, 0.12), rng.range(-0.18, 0.18))).normalize();
    coneAlong(b, base, dir, len, q > 0.5 ? 0.0024 : 0.0034, 0.0004, q > 0.5 ? 5 : 3, (t) => (t < 0.5 ? mix(cBase, cMid, t * 2) : mix(cMid, cTip, (t - 0.5) * 2)));
  }
  return b.build();
}

// ───────── サザエ ─────────
// 殻は上から見て右巻きの円錐。巻きの高さは殻頂へ向かって等比で小さくなり、各巻きはふくらみ、縫合でくびれる。
// 体層と次体層の肩にツノの列（らせんに沿って並ぶ管状のトゲ）。殻口は岩に伏せる（底は足でふさぐ）
export function makeTurban(q = 1) {
  const b = new GeoBuilder();
  const n3 = makeNoise3D(19);
  const HS = 0.07, RB = 0.042, W = 3.0, NW = 3.4;
  const lnW = Math.log(W);
  // 殻頂からの距離 d（0..1）→ らせんの位置 ξ（体層の底が NW）
  const xiOf = (d, th) => NW + Math.log(Math.max(d, 1e-4)) / lnW + th / (Math.PI * 2) - 1;
  const envR = (d) => RB * Math.pow(d, 0.62);
  const whorl = (f) => {
    // 巻きの断面：縫合（f=0,1）でくびれ、肩（f≈0.72）が張る
    const bulge = Math.pow(Math.sin(Math.PI * f), 0.6);
    const shoulder = 0.1 * Math.exp(-(((f - 0.72) / 0.12) ** 2));
    return 0.8 + 0.2 * bulge + shoulder;
  };
  const cShell = col('#6a5a3a'), cDark = col('#3e3222'), cAlga = col('#56603a'), cPale = col('#a89a78');
  const nd = q > 0.5 ? 56 : 18, nt = q > 0.5 ? 44 : 14;
  const at = (d, th) => {
    const xi = xiOf(d, th);
    const f = xi - Math.floor(xi);
    // 体層の下は丸く底へまわり込む
    const base = smoothstep(0.86, 1.0, d);
    const r = envR(d) * whorl(f) * (1 - 0.35 * base * base) + 0.0006 * Math.sin(xi * Math.PI * 2 * 7);
    const y = HS * (1 - d) - 0.012 * base * base;
    return { p: V3(Math.cos(th) * r, y, Math.sin(th) * r), xi, f };
  };
  surf(b, nd, nt, true, (u, v) => {
    const d = Math.pow(u, 1.6);
    const th = v * Math.PI * 2;
    const r = at(d, th);
    const p = r.p;
    // らせんの肋（細い縞）と縫合の暗い線、藻の付着
    const cord = Math.pow(0.5 + 0.5 * Math.cos(r.f * Math.PI * 2 * 5), 3);
    let c = mix(cShell, cPale, cord * 0.3);
    c = mix(c, cDark, (1 - smoothstep(0.0, 0.08, Math.min(r.f, 1 - r.f))) * 0.7);
    c = mix(c, cDark, (0.5 + 0.5 * Math.sin(th * 13 + r.xi * 3)) * 0.12);
    c = mix(c, cAlga, smoothstep(0.1, 0.5, n3(p.x * 60, p.y * 60, p.z * 60)) * 0.6 * (0.4 + 0.6 * smoothstep(0.2, 0.8, 1 - d)));
    return { p, c, k: 0.9, o: V3(p.x, 0.3, p.z) };
  });
  // 底（殻口をふさぐ足と蓋）
  {
    const r0 = at(1, 0).p;
    const g = new THREE.CircleGeometry(Math.hypot(r0.x, r0.z) * 0.95, 24);
    g.rotateX(Math.PI / 2);
    b.merge(g, new THREE.Matrix4().makeTranslation(0, -0.011, 0), (v) => mix(col('#3a3028'), col('#5a4a3a'), Math.hypot(v.x, v.z) / 0.03), () => ({ aCrust: 0.3 }));
  }
  // ツノ：肩の列（体層と次体層）と、体層の下の列
  const rows = q > 0.5 ? [[0.72, NW - 1, 1.0, 0.038, 0.0045], [0.72, NW - 2, 0.9, 0.02, 0.0032], [0.32, NW - 1, 0.85, 0.022, 0.0034]] : [[0.72, NW - 1, 1.0, 0.03, 0.0048]];
  for (const [f, k, cover, len0, rad] of rows) {
    const per = q > 0.5 ? 10 : 7;
    for (let i = 0; i < per * cover; i++) {
      const th = (i / per) * Math.PI * 2 + 0.3;
      // ξ = k + f となる d を求める
      const d = Math.exp((k + f - NW + 1 - th / (Math.PI * 2)) * lnW);
      if (d > 0.98 || d < 0.08) continue;
      const r = at(d, th);
      const out = V3(Math.cos(th), 0, Math.sin(th));
      const dir = out.clone().multiplyScalar(0.7).addScaledVector(UP, 0.7).add(V3(-Math.sin(th), 0, Math.cos(th)).multiplyScalar(0.25)).normalize();
      const s = Math.pow(d, 0.9);
      coneAlong(b, r.p.clone().addScaledVector(out, -0.0015), dir, len0 * s * (0.85 + 0.3 * Math.sin(i * 1.7 + k)), rad * s * 1.35, rad * s * 0.8, q > 0.5 ? 7 : 4, (t) => mix(cShell, cPale, t * 0.6), 0.6);
    }
  }
  const geo = b.build();
  // 少し傾けて置く（殻頂が後ろ上を向く）
  geo.rotateX(-0.3);
  geo.computeBoundingBox();
  geo.translate(0, -geo.boundingBox.min.y - 0.003, 0);
  geo.computeBoundingSphere();
  return geo;
}

// ───────── アワビ ─────────
export function makeAbalone(q = 1) {
  const b = new GeoBuilder();
  const n3 = makeNoise3D(23);
  const A = 0.066, B = 0.047, H = 0.024;
  const apex = V3(0.018, 0, -0.042); // 殻頂（後ろ寄り・右寄り）
  const edge = (psi) => V3(Math.cos(psi) * B * (1 + 0.04 * Math.sin(psi * 3)), 0, Math.sin(psi) * A);
  const height = (r) => H * Math.pow(Math.max(0, 1 - r * r), 0.7) * (1 - 0.3 * r) + 0.004;
  // 呼吸孔の列（左側、殻頂から前へ）
  const holes = [];
  for (let i = 0; i < 6; i++) holes.push({ r: 0.86, psi: Math.PI * (0.92 + i * 0.075) });
  const holeAt = (h) => {
    const e = edge(h.psi);
    const p = apex.clone().lerp(e, h.r);
    p.y = height(h.r) + 0.004;
    return p;
  };
  const hp = holes.map(holeAt);
  const cA = col('#6a5a44'), cB = col('#8a6a5a'), cPink = col('#c88a8a'), cGreen = col('#5e7250'), cDark = col('#3a2e22');
  surf(b, q > 0.5 ? 30 : 10, q > 0.5 ? 64 : 22, true, (u, v) => {
    const r = u, psi = v * Math.PI * 2;
    const e = edge(psi);
    const p = apex.clone().lerp(e, r);
    // 同心の成長線と放射状のうねり
    const growth = Math.sin(r * 64 + n3(p.x * 30, 0, p.z * 30) * 2);
    let y = height(r) + 0.0013 * growth * r + 0.0015 * Math.sin(psi * 14) * r * r;
    // 呼吸孔の盛り上がり
    for (const q of hp) {
      const d = Math.hypot(p.x - q.x, p.z - q.z);
      y += 0.0035 * Math.exp(-((d / 0.006) ** 2));
    }
    // 縁は少し反り返る
    y += 0.002 * smoothstep(0.9, 1.0, r);
    p.y = r >= 0.999 ? 0.004 : y;
    let c = mix(cA, cB, 0.5 + 0.5 * growth * 0.6);
    c = mix(c, cDark, (0.5 - 0.5 * growth) * 0.3);
    c = mix(c, cPink, smoothstep(0.35, 0.65, n3(p.x * 90 + 3, p.y * 90, p.z * 90)) * 0.35);
    c = mix(c, cGreen, smoothstep(0.3, 0.65, n3(p.x * 30, p.y * 30 + 7, p.z * 30)) * 0.45);
    c = mix(c, cDark, (1 - smoothstep(0.0, 0.08, r)) * 0.5);
    return { p, c, k: 1.0, o: UP };
  });
  // 呼吸孔（黒い穴と縁）
  if (q > 0.5) hp.forEach((q, i) => {
    const open = i < 4;
    const g = new THREE.CylinderGeometry(0.0036, 0.0046, 0.0016, 10, 1, !open);
    b.merge(g, new THREE.Matrix4().makeTranslation(q.x, q.y - 0.0004, q.z), (v, vn) => (vn.y > 0.5 && open ? col('#0a0806') : col('#7a6a58')), () => ({ aCrust: 0.2 }));
    if (open) {
      const d = new THREE.CircleGeometry(0.0034, 10);
      d.rotateX(-Math.PI / 2);
      b.merge(d, new THREE.Matrix4().makeTranslation(q.x, q.y + 0.0005, q.z), () => col('#060504'), () => ({ aCrust: 0 }));
    }
  });
  // 縁から覗く黒い足（波打つ上足）と触手
  surf(b, q > 0.5 ? 2 : 1, q > 0.5 ? 72 : 22, true, (u, v) => {
    const psi = v * Math.PI * 2;
    const e = edge(psi);
    const wav = 1 + 0.03 * Math.sin(psi * 23);
    const p = apex.clone().lerp(e, lerp(0.92, 1.07 * wav, u));
    p.y = lerp(0.006, 0.0015 + 0.0015 * Math.sin(psi * 23), u);
    return { p, c: mix(col('#2a2622'), col('#4a4034'), u * 0.5), k: 0.2, o: UP };
  });
  for (let i = 0; i < (q > 0.5 ? 26 : 0); i++) {
    const psi = (i / 26) * Math.PI * 2 + 0.1;
    const e = edge(psi);
    const p = apex.clone().lerp(e, 1.04);
    p.y = 0.003;
    const dir = e.clone().sub(apex).normalize().setY(-0.25).normalize();
    coneAlong(b, p, dir, 0.006 + 0.003 * Math.sin(i * 2.3), 0.0008, 0.0003, 4, () => col('#3a342c'));
  }
  const geo = b.build();
  return geo;
}

// ───────── ヒトデ（飾り。色はインスタンスごとに掛ける） ─────────
export function makeStarfish() {
  const b = new GeoBuilder();
  const n3 = makeNoise3D(5);
  const ARM = 0.12, R0 = 0.034;
  surf(b, 18, 50, true, (u, v) => {
    // u: 中心→外周、v: 周方向（5本の腕）
    const a = v * Math.PI * 2;
    const k = Math.cos(a * 5);
    const armK = Math.pow(0.5 + 0.5 * k, 2.2); // 腕の中心で 1
    const reach = lerp(R0, ARM, armK) * (1 + 0.05 * Math.sin(a * 5 + 1.3));
    const r = u * reach;
    // 腕は根元が太く先で細い。断面は丸い背
    const thick = 0.022 * (1 - 0.7 * (r / ARM)) * (0.55 + 0.45 * armK);
    const y = thick * Math.sqrt(Math.max(0, 1 - Math.pow(u, 3))) + 0.002;
    const p = V3(Math.cos(a) * r, y, Math.sin(a) * r);
    // 背の小さなこぶ（淡い点）と、腕の間の溝
    const tub = smoothstep(0.55, 0.8, n3(p.x * 160, 0, p.z * 160) * 0.5 + 0.5);
    let c = mix(col('#d8d8d8'), col('#ffffff'), tub);
    c = mix(c, col('#8a8a8a'), (1 - armK) * smoothstep(0.3, 0.9, u) * 0.4);
    return { p, c, k: 0.6, o: UP };
  });
  return b.build();
}

// ───────── 材質 ─────────
const CRUST_FX = {
  key: 'crust',
  vdecl: 'attribute float aCrust; varying float vCrust; varying vec3 vCrP;',
  vcode: 'vCrust = aCrust; vCrP = position;',
  decl: /* glsl */ `
    varying float vCrust;
    varying vec3 vCrP;
    float crH, crK;
    float crHash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
    float crNoise(vec3 p) {
      vec3 i = floor(p), f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      return mix(mix(mix(crHash(i), crHash(i + vec3(1, 0, 0)), f.x), mix(crHash(i + vec3(0, 1, 0)), crHash(i + vec3(1, 1, 0)), f.x), f.y),
                 mix(mix(crHash(i + vec3(0, 0, 1)), crHash(i + vec3(1, 0, 1)), f.x), mix(crHash(i + vec3(0, 1, 1)), crHash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
    }
  `,
  color: /* glsl */ `
    {
      float px = length(fwidth(vCrP));
      crK = vCrust * (1.0 - smoothstep(0.0008, 0.0025, px));
      crH = crNoise(vCrP * 900.0) * 0.6 + crNoise(vCrP * 260.0) * 0.4;
      diffuseColor.rgb *= 1.0 + (crH - 0.5) * 0.35 * crK;
    }
  `,
  normal: /* glsl */ `
    if (crK > 0.001) {
      vec3 sp = -vViewPosition;
      vec3 sx = dFdx(sp), sy = dFdy(sp);
      float s2o = length(sx) / max(length(dFdx(vCrP)), 1e-7);
      vec2 dH = vec2(dFdx(crH), dFdy(crH)) * 0.0006 * s2o * crK;
      vec3 r1 = cross(sy, normal), r2 = cross(normal, sx);
      float det = dot(sx, r1) * faceDirection;
      normal = normalize(abs(det) * normal - sign(det) * (dH.x * r1 + dH.y * r2));
    }
  `,
};
let pickMat = null;
/** 貝・ウニ・ヒトデの共通材質（頂点色 + 殻のざらつき） */
export function pickupMaterial() {
  if (!pickMat) {
    pickMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0, side: THREE.DoubleSide });
    patchMaterial(pickMat, { fx: CRUST_FX });
  }
  return pickMat;
}
