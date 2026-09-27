// 草: 1 本ずつの葉を GPU で大量に描く（ブレス オブ ザ ワイルドの草の考え方）
// ・どこに・どの高さで生えるかを 1m 格子のテクスチャ（草の地図）に焼いておく
// ・2m 四方の「草の区画」（葉 324 本）を並べ、頂点シェーダーで地面に立てて曲げる
// ・遠くほど葉を間引き、そのぶん太らせる。描かない遠くは地面を草の色に塗って続ける
// ・風は大きな突風の波が草原を渡り、倒れた葉が明るく光る。主人公が歩くと葉がよける
// ・田んぼは稲の株、あぜ・空き地・道ばたは雑草（エノコログサ）、庭と公園は短い芝と小さな花
import * as THREE from 'three';
import { M } from './layout.js';
import { pointInPoly, bbox } from './data.js';
import { NOISE_GLSL, TIME } from './materials.js';
import { SUN_DIR } from './render.js';

const TS = 2;            // 区画の大きさ (m)
const GRID = 18;         // 区画あたり 18×18 本
const B = GRID * GRID;
const LEVELS = [0, 0.35, 0.62, 0.84]; // 葉の節（最後に先端 t=1）
const IPB = (LEVELS.length - 1) * 6 + 3; // 葉 1 本の index 数
const CHUNK = 32;        // 描画の単位 (m)
const NEAR = 14, FAR = 115;
const H_MAX = 1.2;       // 草の地図の高さの上限 (m)

// 地面の種類ごとの [覆う割合, 高さ m, むら（群生の強さ）]
const KIND = {
  grass: [1, 0.62, 0.22],
  town: [1, 0.46, 0.45],
  ground: [0.9, 0.38, 0.6],    // 道ばた
  yard: [0.95, 0.3, 0.35],
  forest: [0.95, 0.5, 0.4],    // 森のへり
  sand: [0.45, 0.32, 0.85],
  farm: [1, 0.72, 0],
  lawn: [1, 0.15, 0.04],       // 刈り込んだ芝生
};
const AREA = {
  park: [1, 0.17, 0.12], school: [0.8, 0.22, 0.55], cemetery: [0.6, 0.24, 0.6], industrial: [0.7, 0.45, 0.75],
  pitch: [0.3, 0.14, 0.9], parking: [0.3, 0.3, 0.9],
};

// 草の地図: R 覆う割合, G 高さ, B むら, A 田んぼ
function buildField(ctx, T) {
  const { data, mask, ground } = ctx;
  const { core, V } = data;
  const nx = mask.nx, nz = mask.nz;
  const px = new Uint8Array(nx * nz * 4);
  const NO = M.ROAD | M.BLD | M.WATER | M.RAIL | M.PAVE | M.HARBOR | M.FARMSTEAD;
  const areaCache = new Map();
  const areaKind = (c, x, z) => {
    if (areaCache.has(c)) return areaCache.get(c);
    let k = null;
    for (const a of V.areas) {
      if (a.k === 'wood' || a.k === 'beach' || a.k === 'farm') continue;
      if (!a.bb) a.bb = bbox(a.p);
      const [x0, z0, x1, z1] = a.bb;
      if (x < x0 || x > x1 || z < z0 || z > z1) continue;
      if (pointInPoly(x, z, a.p)) { k = a.k === 'pitch' && a.sf === 'grass' ? 'park' : a.k; break; }
    }
    areaCache.set(c, k);
    return k;
  };
  // 1 マスぶん（kindOf: 地面の種類を差しかえる。建て替えた敷地の庭など）
  const put = (i, j, kindOf) => {
    const o = (j * nx + i) * 4;
    px[o] = px[o + 1] = px[o + 2] = px[o + 3] = 0;
    const m = mask.a[j * nx + i];
    if (m & NO) return;
    const x = mask.x0 + i + 0.5, z = mask.z0 + j + 0.5;
    const ci = Math.round((x - core.x0) / core.step), cj = Math.round((z - core.z0) / core.step);
    if (ci < 0 || cj < 0 || ci >= core.nx || cj >= core.nz) return;
    const c = cj * core.nx + ci;
    if (T.canopy[c] > 0.25) return;
    const y = ground(x, z);
    if (y < 0.35) return;
    const kind = kindOf?.(x, z) || T.kinds[c];
    let p = null;
    if (kind === 'area') p = AREA[areaKind(c, core.xOf(ci), core.zOf(cj))] || [0.6, 0.35, 0.6];
    else if (kind === 'sand') p = y > 1.3 ? KIND.sand : null;
    else p = KIND[kind] || null;
    if (!p) return;
    px[o] = p[0] * 255;
    px[o + 1] = Math.min(255, (p[1] / H_MAX) * 255);
    px[o + 2] = p[2] * 255;
    px[o + 3] = kind === 'farm' ? 255 : 0;
  };
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) put(i, j);
  const tex = new THREE.DataTexture(px, nx, nz, THREE.RGBAFormat, THREE.UnsignedByteType);
  tex.magFilter = tex.minFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  // 地面の塗り用: 道の下まで草の色を広げる（道のメッシュのきわに土色のすき間を残さない）
  const tint = new Uint8Array(nx * nz);
  const putTint = (i, j) => {
    const k = j * nx + i;
    tint[k] = px[k * 4];
    if (i < 2 || j < 2 || i >= nx - 2 || j >= nz - 2 || (mask.a[k] & NO) !== M.ROAD) return;
    let v = 0;
    for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++) v = Math.max(v, px[(k + dj * nx + di) * 4]);
    tint[k] = v;
  };
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) putTint(i, j);
  const tintTex = new THREE.DataTexture(tint, nx, nz, THREE.RedFormat, THREE.UnsignedByteType);
  tintTex.magFilter = tintTex.minFilter = THREE.LinearFilter;
  tintTex.needsUpdate = true;
  // 地面の高さ（地形のメッシュと同じ格子）
  const ht = new THREE.DataTexture(core.h, core.nx, core.nz, THREE.RedFormat, THREE.FloatType);
  ht.magFilter = ht.minFilter = THREE.NearestFilter;
  ht.needsUpdate = true;
  // 世界の四角 [x0, z0, x1, z1] の中を、今のマスクで描き直す（建て替えのあと）
  const refresh = ([x0, z0, x1, z1], kindOf) => {
    const i0 = Math.max(0, Math.floor(x0 - mask.x0)), i1 = Math.min(nx - 1, Math.ceil(x1 - mask.x0));
    const j0 = Math.max(0, Math.floor(z0 - mask.z0)), j1 = Math.min(nz - 1, Math.ceil(z1 - mask.z0));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) put(i, j, kindOf);
    for (let j = Math.max(0, j0 - 2); j <= Math.min(nz - 1, j1 + 2); j++) for (let i = Math.max(0, i0 - 2); i <= Math.min(nx - 1, i1 + 2); i++) putTint(i, j);
    tex.needsUpdate = true;
    tintTex.needsUpdate = true;
  };
  return { px, nx, nz, tex, ht, tintTex, refresh };
}

// 地形と草で共通の GLSL（草の地図の読み方）
const FIELD_GLSL = /* glsl */ `
uniform sampler2D tGField;
uniform vec4 uGField; // 原点 xz, 大きさ xz
vec4 gField(vec2 p) { return texture2D(tGField, (p - uGField.xy) / uGField.zw); }
// 覆う割合（群生のむら込み）。lo, hi: 覆う割合のしきい値（地面の塗りは広めに取って、道のきわまで草の色にする）
float gCover(vec4 f, vec2 p, float lo, float hi) {
  float patchN = tnF(p * 0.13) + (tnV(p * 0.9) - 0.5) * 0.25;
  return smoothstep(lo, hi, f.r) * mix(1.0, smoothstep(0.3, 0.58, patchN), f.b);
}
// 田んぼのあぜ（地形の塗りと同じ区切り）
float gLevee(vec2 p) {
  vec2 lot = abs(fract(p / vec2(31.0, 23.0)) - 0.5);
  return step(0.462, max(lot.x, lot.y));
}
`;

// 草の区画 1 枚ぶんの葉（位置は区画の中でばらし、順番はシャッフル＝間引いても均一）
function patchGeometry() {
  let s = 20240924;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const roots = [];
  for (let j = 0; j < GRID; j++) for (let i = 0; i < GRID; i++) roots.push([(i + 0.1 + r() * 0.8) / GRID * TS, (j + 0.1 + r() * 0.8) / GRID * TS]);
  for (let k = roots.length - 1; k > 0; k--) { const q = Math.floor(r() * (k + 1)); [roots[k], roots[q]] = [roots[q], roots[k]]; }
  const nv = LEVELS.length * 2 + 1;
  const pos = new Float32Array(B * nv * 3), aB = new Float32Array(B * nv * 4), idx = new Uint32Array(B * IPB);
  let v = 0, ii = 0;
  roots.forEach(([x, z], b) => {
    const base = v, r1 = r(), r2 = r();
    const put = (t, side) => {
      pos.set([x, t, z], v * 3);
      aB.set([side, (b + 0.5) / B, r1, r2], v * 4);
      v++;
    };
    for (const t of LEVELS) { put(t, -1); put(t, 1); }
    put(1, 0);
    for (let l = 0; l < LEVELS.length - 1; l++) {
      const a = base + l * 2;
      idx.set([a, a + 1, a + 3, a, a + 3, a + 2], ii); ii += 6;
    }
    const a = base + (LEVELS.length - 1) * 2;
    idx.set([a, a + 1, a + 2], ii); ii += 3;
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aB', new THREE.BufferAttribute(aB, 4));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  return g;
}

const C = (h) => new THREE.Color(h);

export class Grass {
  // ensure: 今は草がなくても区画を用意しておく世界の四角 [x0, z0, x1, z1] の並び（建て替えで草が生えうる所）
  constructor(ctx, T, { ensure = [] } = {}) {
    const { data, mask } = ctx;
    const { core } = data;
    const F = buildField(ctx, T);
    this.field = F;
    const fieldU = { value: new THREE.Vector4(mask.x0, mask.z0, F.nx, F.nz) };
    this.uniforms = {
      uTime: TIME,
      tGField: { value: F.tex }, uGField: fieldU,
      tGHeight: { value: F.ht }, uGHeight: { value: new THREE.Vector4(core.x0, core.z0, core.step, 0) },
      uWind: { value: new THREE.Vector2(0.86, 0.5).normalize() },
      uPlayer: { value: new THREE.Vector4(0, -999, 0, 0.9) },
      // 草を生やさない細長い所（線分 xz→xz と半幅）。草の地図は 1 m 格子でにじむので、幅 1 m ほどの用水路は形で抜く
      uNoGrass: { value: new THREE.Vector4(0, 0, 0, 0) }, uNoGrassW: { value: -1 },
      uLod: { value: new THREE.Vector3(NEAR, FAR, 0) }, // z: 地面からのカメラの高さ（空から見下ろすと草を間引く）
      uSun: { value: SUN_DIR },
      uBase: { value: C('#243f10') }, uTip: { value: C('#a9d155') }, uTipDry: { value: C('#d2c870') }, uTipLush: { value: C('#6fae34') },
      uRiceBase: { value: C('#2f5a14') }, uRiceTip: { value: C('#8ed447') },
      uHead: { value: C('#bdb97a') },
    };
    this.mat = this.material();
    this.tintGround(T.coreMesh.material);

    // 草のある区画を集めて、32m ごとの塊にする
    const base = patchGeometry();
    const tnx = Math.floor(F.nx / TS), tnz = Math.floor(F.nz / TS);
    const chunks = new Map();
    const any = (ti, tj) => {
      for (let j = tj * TS - 1; j <= tj * TS + TS; j++) for (let i = ti * TS - 1; i <= ti * TS + TS; i++) {
        if (i < 0 || j < 0 || i >= F.nx || j >= F.nz) continue;
        if (F.px[(j * F.nx + i) * 4] > 50) return true;
      }
      return false;
    };
    let tiles = 0;
    let h = 7;
    const ensured = (x, z) => ensure.some(([x0, z0, x1, z1]) => x + TS > x0 && x < x1 && z + TS > z0 && z < z1);
    for (let tj = 0; tj < tnz; tj++) for (let ti = 0; ti < tnx; ti++) {
      const x = mask.x0 + ti * TS, z = mask.z0 + tj * TS;
      if (!any(ti, tj) && !ensured(x, z)) continue;
      const k = Math.floor(x / CHUNK) + ',' + Math.floor(z / CHUNK);
      if (!chunks.has(k)) chunks.set(k, { t: [], x0: Infinity, z0: Infinity, x1: -Infinity, z1: -Infinity, y0: Infinity, y1: -Infinity });
      const ch = chunks.get(k);
      h = (Math.imul(h, 1103515245) + 12345) & 0x7fffffff;
      ch.t.push(x, z, h % 8);
      const y = ctx.ground(x + 1, z + 1);
      ch.x0 = Math.min(ch.x0, x); ch.z0 = Math.min(ch.z0, z); ch.x1 = Math.max(ch.x1, x + TS); ch.z1 = Math.max(ch.z1, z + TS);
      ch.y0 = Math.min(ch.y0, y); ch.y1 = Math.max(ch.y1, y);
      tiles++;
    }
    this.group = new THREE.Group();
    this.chunks = [];
    for (const ch of chunks.values()) {
      const g = new THREE.InstancedBufferGeometry();
      g.setIndex(base.index);
      g.setAttribute('position', base.getAttribute('position'));
      g.setAttribute('aB', base.getAttribute('aB'));
      g.setAttribute('aTile', new THREE.InstancedBufferAttribute(new Float32Array(ch.t), 3));
      g.instanceCount = ch.t.length / 3;
      const c = new THREE.Vector3((ch.x0 + ch.x1) / 2, (ch.y0 + ch.y1) / 2 + 0.5, (ch.z0 + ch.z1) / 2);
      g.boundingSphere = new THREE.Sphere(c, Math.hypot(ch.x1 - ch.x0, ch.z1 - ch.z0, ch.y1 - ch.y0 + 2) / 2 + 1);
      g.boundingBox = new THREE.Box3(new THREE.Vector3(ch.x0 - 1, ch.y0 - 1, ch.z0 - 1), new THREE.Vector3(ch.x1 + 1, ch.y1 + 2, ch.z1 + 1));
      const mesh = new THREE.Mesh(g, this.mat);
      mesh.userData.noAO = true;
      mesh.userData.box = [ch.x0, ch.z0, ch.x1, ch.z1];
      mesh.receiveShadow = true;
      mesh.matrixAutoUpdate = false;
      this.group.add(mesh);
      this.chunks.push(mesh);
    }
    this.tiles = tiles;
    this.count = tiles * B;
  }

  material() {
    const U = this.uniforms;
    const mat = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.86, metalness: 0, envMapIntensity: 0.55 });
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, U);
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', /* glsl */ `#include <common>
          attribute vec4 aB;
          attribute vec3 aTile;
          uniform float uTime;
          uniform sampler2D tGHeight;
          uniform vec4 uGHeight;
          uniform vec2 uWind;
          uniform vec3 uLod;
          uniform vec4 uPlayer;
          uniform vec4 uNoGrass;
          uniform float uNoGrassW;
          uniform vec3 uSun, uBase, uTip, uTipDry, uTipLush, uRiceBase, uRiceTip, uHead;
          varying vec3 vCol;
          varying vec3 vSSS;
          varying float vSide;
          ${NOISE_GLSL}
          ${FIELD_GLSL}
          // 地形のメッシュと同じ三角形で高さを補間する
          float gGround(vec2 p) {
            vec2 f = (p - uGHeight.xy) / uGHeight.z;
            ivec2 sz = textureSize(tGHeight, 0);
            ivec2 i = clamp(ivec2(floor(f)), ivec2(0), sz - 2);
            vec2 u = clamp(f - vec2(i), 0.0, 1.0);
            float a = texelFetch(tGHeight, i, 0).r, b = texelFetch(tGHeight, i + ivec2(1, 0), 0).r;
            float c = texelFetch(tGHeight, i + ivec2(0, 1), 0).r, d = texelFetch(tGHeight, i + ivec2(1, 1), 0).r;
            if (abs(a - d) < abs(b - c)) return u.x > u.y ? a + (b - a) * u.x + (d - b) * u.y : a + (c - a) * u.y + (d - c) * u.x;
            return u.x + u.y < 1.0 ? a + (b - a) * u.x + (c - a) * u.y : d + (c - d) * (1.0 - u.x) + (b - d) * (1.0 - u.y);
          }`)
        .replace('#include <beginnormal_vertex>', /* glsl */ `
          // ---- 葉の根元（区画を回転・反転して繰り返しを隠す） ----
          vec2 lp = position.xz - ${(TS / 2).toFixed(1)};
          if (mod(aTile.z, 2.0) >= 1.0) lp.x = -lp.x;
          float rq = floor(aTile.z * 0.5);
          lp = rq < 0.5 ? lp : rq < 1.5 ? vec2(-lp.y, lp.x) : rq < 2.5 ? -lp : vec2(lp.y, -lp.x);
          vec2 root = aTile.xy + ${(TS / 2).toFixed(1)} + lp;
          vec4 fld = gField(root);
          float hA = tnH(root * 7.31), hB = tnH(root * 3.17 + 11.3), hC = tnH(root * 5.71 + 3.1);
          float cover = gCover(fld, root, 0.22, 0.7);
          float t = position.y, side = aB.x;

          // ---- 遠くは間引いて太らせる ----
          float dist = length(vec2(length(cameraPosition.xz - root), uLod.z));
          float dens = clamp(pow(uLod.x / max(dist, 1.0), 1.5), 0.07, 1.0);
          float keep = clamp((dens - aB.y) / (0.18 * dens), 0.0, 1.0);
          keep *= clamp((cover - hA * 0.999) * 6.0, 0.0, 1.0);
          keep *= 1.0 - smoothstep(uLod.y * 0.72, uLod.y, dist);
          {
            vec2 sa = uNoGrass.xy, sb = uNoGrass.zw - sa, sp = root - sa;
            float sd = length(sp - sb * clamp(dot(sp, sb) / max(dot(sb, sb), 1e-4), 0.0, 1.0));
            if (sd < uNoGrassW) keep = 0.0;
          }

          // ---- 種類: 稲 / 雑草 / エノコログサ / 花 ----
          bool farm = fld.a > 0.5;
          bool rice = farm && gLevee(root) < 0.5;
          float H = fld.g * ${H_MAX.toFixed(2)};
          if (farm && !rice) H = 0.38;
          H *= (0.55 + hB * 0.75) * mix(0.45, 1.0, cover);
          float W = (0.03 + hC * 0.022) * min(1.0 / sqrt(dens), 3.2);
          vec2 face = vec2(cos(hA * 40.0), sin(hA * 40.0));
          vec2 lean = vec2(-face.y, face.x) * (aB.w < 0.5 ? -1.0 : 1.0) * (0.22 + aB.z * 0.6);
          bool stem = !rice && fld.g > 0.3 && hC > 0.972;
          bool flower = !rice && fld.g < 0.32 && hC > 0.988;
          float stiff = 1.0;
          if (rice) {
            // 株ごとに根元をまとめ、外へ開く
            vec2 hill = (floor(root / 0.3) + 0.5) * 0.3;
            vec2 out2 = root - hill;
            lean = normalize(out2 + 1e-4) * (0.18 + aB.z * 0.42);
            root = hill + out2 * 0.12;
            H = (0.55 + hB * 0.25) * mix(0.5, 1.0, cover);
            W = 0.016 * min(1.0 / sqrt(dens), 3.2);
            stiff = 0.55;
          }
          if (stem) { H *= 1.3; W *= 0.45; lean *= 0.35; }
          if (flower) { H *= 0.8; }
          H *= keep; W *= keep;

          // ---- 風: 草原を渡る突風の波 + 細かいそよぎ ----
          vec2 wd = uWind, wp = vec2(-wd.y, wd.x);
          float g1 = tnF(vec2(dot(root, wd) * 0.055 - uTime * 0.5, dot(root, wp) * 0.035));
          float gust = smoothstep(0.38, 0.78, g1);
          float flut = sin(uTime * 2.6 + hA * 6.283 + dot(root, wd) * 0.5) * 0.09 + sin(uTime * 4.3 + hB * 6.283) * 0.04;
          vec2 tilt = lean + (wd * (0.1 + gust * 0.8 + flut) + wp * flut * 0.6) * stiff;
          // 主人公が歩くと葉がよける
          vec2 dv = root - uPlayer.xz;
          float pd = length(dv);
          float push = (1.0 - smoothstep(0.15, uPlayer.w, pd)) * step(abs(uPlayer.y - gGround(root)), 1.2);
          tilt += dv / max(pd, 1e-3) * push * 1.25;
          float th = min(length(tilt), 1.45);
          vec2 dir = tilt / max(length(tilt), 1e-4);

          // ---- 曲線（2 次ベジェ）で葉を曲げる ----
          vec3 P1 = vec3(0.0, H * 0.55, 0.0);
          vec3 P2 = vec3(dir * sin(th) * H, cos(th) * H);
          P2 = vec3(P2.x, P2.z, P2.y);
          vec3 spine = 2.0 * t * (1.0 - t) * P1 + t * t * P2;
          vec3 tang = normalize(2.0 * (1.0 - t) * P1 + 2.0 * t * (P2 - P1) + vec3(0.0, 1e-4, 0.0));
          float wProf = t < 0.99 ? pow(1.0 - t, 0.7) : 0.0;
          vec3 col;
          if (stem) {
            wProf = t < 0.7 ? 0.7 : t < 0.99 ? 2.4 : 0.0;
          } else if (flower) {
            wProf = t < 0.8 ? wProf : t < 0.99 ? 2.6 : 0.0;
          }
          vec3 fdir = vec3(face.x, 0.0, face.y);
          vec3 gp = vec3(root.x, gGround(root) - 0.04, root.y) + spine + fdir * side * W * 0.5 * wProf;

          // 法線: 葉の面をカメラへ向け、丸みをつけて上向きに寄せる（やわらかい陰）
          vec3 nf = normalize(cross(fdir, tang));
          if (dot(nf, cameraPosition - gp) < 0.0) nf = -nf;
          vec3 objectNormal = normalize(mix(normalize(nf + fdir * side * 0.45), vec3(0.0, 1.0, 0.0), 0.42));

          // ---- 色: 根元は暗く、先は明るく。広いむらで枯れ色が混ざる ----
          float dry = smoothstep(0.5, 0.82, tnF(root * 0.018 + 17.0)) * 0.75 + hC * 0.18;
          float lush = smoothstep(0.42, 0.75, tnF(root * 0.03 + 41.0)) * (1.0 - dry);
          vec3 tipC = rice ? uRiceTip : mix(mix(uTip, uTipLush, lush * 0.75), uTipDry, dry);
          vec3 baseC = rice ? uRiceBase : uBase;
          col = mix(baseC, tipC, pow(t, 0.8));
          col *= mix(0.42, 1.0, smoothstep(0.0, 0.75, t)) * (0.84 + hB * 0.3);
          col *= 1.0 + gust * 0.26 * t * stiff;
          if (stem && t > 0.66) col = uHead * (0.85 + hB * 0.3);
          if (flower && t > 0.79) col = hB < 0.3 ? vec3(0.8, 0.78, 0.72) : hB < 0.7 ? vec3(0.95, 0.74, 0.12) : vec3(0.62, 0.42, 0.85);
          vCol = col;
          vSide = side;
          // 逆光で葉先が透ける
          vec3 vd = normalize(gp - cameraPosition);
          vSSS = tipC * pow(max(dot(vd, uSun), 0.0), 3.0) * t * 0.55;
        `)
        .replace('#include <begin_vertex>', 'vec3 transformed = gp;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vCol;\nvarying vec3 vSSS;\nvarying float vSide;')
        // 葉の中央（葉脈）を明るく、ふちを暗く
        .replace('#include <color_fragment>', 'diffuseColor.rgb = vCol * (1.0 - 0.3 * vSide * vSide) * (1.0 + 0.12 * (1.0 - smoothstep(0.0, 0.15, abs(vSide))));')
        .replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\nnormal = normalize(vNormal);\nnonPerturbedNormal = normal;')
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vSSS;');
    };
    mat.customProgramCacheKey = () => 'grass-blades-1';
    return mat;
  }

  // 地形: 草の生えているところは地面を草の根元の色に（遠くでは葉の色に）寄せる
  tintGround(mat) {
    const prev = mat.onBeforeCompile, prevKey = mat.customProgramCacheKey.bind(mat);
    const U = this.uniforms;
    const near = C('#3f6a1d'), far = C('#86ad45');
    mat.onBeforeCompile = (sh, r) => {
      prev(sh, r);
      Object.assign(sh.uniforms, { tGField: U.tGField, uGField: U.uGField, tGTint: { value: this.field.tintTex }, uGNear: { value: near }, uGFar: { value: far } });
      sh.fragmentShader = sh.fragmentShader
        .replace('void main() {', `uniform vec3 uGNear, uGFar;\nuniform sampler2D tGTint;\n${FIELD_GLSL}\nvoid main() {`)
        .replace('#include <lights_physical_fragment>', /* glsl */ `
        {
          vec4 gf = gField(vWP.xz);
          gf.r = texture2D(tGTint, (vWP.xz - uGField.xy) / uGField.zw).r;
          float gc = gCover(gf, vWP.xz, 0.03, 0.45);
          float gd = smoothstep(25.0, 130.0, length(cameraPosition - vWP));
          vec3 gcol = mix(uGNear, uGFar, gd) * (0.88 + tnV(vWP.xz * 1.7) * 0.24);
          // 田んぼ: 稲の間は水と泥の暗い色、あぜは草の色
          if (gf.a > 0.5) gcol = gLevee(vWP.xz) > 0.5 ? gcol : mix(vec3(0.075, 0.1, 0.04), uGFar * 0.9, gd);
          diffuseColor.rgb = mix(diffuseColor.rgb, gcol, gc * 0.85);
        }
        #include <lights_physical_fragment>`);
    };
    mat.customProgramCacheKey = () => prevKey() + '-gtint';
    mat.needsUpdate = true;
  }

  // 近くの塊だけ描き、遠いほど葉を減らす
  // lift: カメラが地面から離れている分（m）。遠いのと同じに扱う
  update(camera, player, lift = 0) {
    const px = camera.position.x, pz = camera.position.z;
    this.uniforms.uLod.value.z = lift;
    if (player) this.uniforms.uPlayer.value.set(player.x, player.y, player.z, 0.9);
    for (const m of this.chunks) {
      const [x0, z0, x1, z1] = m.userData.box;
      const dx = Math.max(x0 - px, 0, px - x1), dz = Math.max(z0 - pz, 0, pz - z1);
      const d = Math.hypot(dx, dz, lift);
      m.visible = d < FAR;
      if (!m.visible) continue;
      const dens = Math.min(1, Math.max(0.07, Math.pow(NEAR / Math.max(d, 1), 1.5)));
      m.geometry.setDrawRange(0, Math.min(B, Math.ceil(dens * B * 1.02) + 2) * IPB);
    }
  }
}
