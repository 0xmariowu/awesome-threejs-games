// 南の浜の地形（蛤突きと同じ浜。ガザミ拾い用に写したもの）
// 北（-z）から: 裏山 → 松林 → 砂丘 → 乾いた砂浜 → 波打ち際 → 遠浅の砂地（ハマグリの帯）→ 溝 → 沖の瀬 → 沖
// 西（-x）の端に小さな川の河口（本ハマグリの干潟）、東（+x）の端にコンクリートの突堤。x = 東、z = 南、y = 上
import * as THREE from 'three';
import { makeNoise2D, fbm2, smoothstep, clamp, lerp } from './core/noise.js';
import { patchMaterial } from './shade.js';

export const RIVER_X = -50;
export const GROYNE_X = 126;
export const GROYNE = { x0: GROYNE_X - 1.6, x1: GROYNE_X + 1.6, z0: -16, z1: 46, top: 1.55 };
// 歩ける範囲
export const BOUNDS = { x0: -158, x1: GROYNE.x0 - 0.8, z0: -34, z1: 92 };

const nA = makeNoise2D(101), nB = makeNoise2D(202), nC = makeNoise2D(303), nD = makeNoise2D(404);

// 岸に直角な断面（z, 高さ）。z = 0 あたりが干潮の汀線
const PROFILE = [
  [-900, 70], [-520, 34], [-300, 13], [-170, 7.2], [-95, 5.0], [-66, 3.9], [-52, 3.75], [-44, 3.15],
  [-36, 2.25], [-26, 1.8], [-16, 1.55], [-11, 1.2], [-5, 0.62], [0, 0.18], [4, -0.02], [12, -0.2],
  [22, -0.36], [32, -0.52], [42, -0.66], [52, -0.72], [70, -0.95], [92, -1.85], [130, -3.3], [200, -5.8],
  [320, -9], [600, -15], [1400, -24],
];
function profile(z) {
  if (z <= PROFILE[0][0]) return PROFILE[0][1];
  for (let i = 1; i < PROFILE.length; i++) {
    const [z1, h1] = PROFILE[i];
    if (z <= z1) {
      const [z0, h0] = PROFILE[i - 1];
      const t = (z - z0) / (z1 - z0);
      return lerp(h0, h1, lerp(t, t * t * (3 - 2 * t), 0.55));
    }
  }
  return PROFILE[PROFILE.length - 1][1];
}

// 汀線のうねり（ゆるい弧と、細かいカスプ）
export function shoreWarp(x) {
  return fbm2(nA, x * 0.0045, 0.37, 3) * 9 + Math.sin(x * 0.019 + 0.7) * 2.2 + Math.sin(x * (Math.PI * 2 / 26)) * 0.55;
}
// 沖の瀬（三日月形に並ぶ）の中心の z
export function barZ(x) { return 60 + 7 * Math.sin(x * 0.021 + 1.3) + fbm2(nB, x * 0.008, 3.1, 2) * 6; }
// 河口の黒っぽい砂（本ハマグリのいる干潟）の度合い 0..1。ふちはゆるくうねる
export function mouthK(x, z) {
  const zz = z - shoreWarp(x);
  const edge = fbm2(nA, x * 0.03 + 7, z * 0.03, 2) * 10;
  const k = Math.exp(-(((x - (RIVER_X - 2) + edge) / 34) ** 2));
  return smoothstep(0.32, 0.62, k) * smoothstep(-26, -12, zz) * (1 - smoothstep(34, 50, zz + edge * 0.5));
}
// 川の流れの中心の x
export function riverX(z) { return RIVER_X + 9 * Math.sin(z * 0.034 + 0.4) + (z > 0 ? -z * 0.12 : 0); }

/** 地形の高さ（解析的）。描画メッシュはこれを 0.5m 格子で並べたもの（heightAt はメッシュと同じ三角形で補間） */
export function bedHeight(x, z) {
  const w = shoreWarp(x);
  const zz = z - w * smoothstep(-70, -25, z) * (1 - smoothstep(120, 260, z));
  let h = profile(zz);
  // 砂丘のこぶ
  const dune = smoothstep(-20, -34, zz) * (1 - smoothstep(-58, -80, zz));
  h += (fbm2(nC, x * 0.03, z * 0.05, 3) * 0.9 + fbm2(nD, x * 0.11, z * 0.13, 2) * 0.25) * dune;
  // 松林の地面・裏山のうねり
  const land = smoothstep(-60, -110, z);
  h += (fbm2(nB, x * 0.008, z * 0.008, 4) * 5 + fbm2(nC, x * 0.03, z * 0.03, 2) * 0.8) * land * (0.4 + smoothstep(-120, -500, z) * 3);
  // 沖の瀬と、その手前の溝
  const bz = barZ(x);
  const wet = smoothstep(8, 30, zz);
  h += (0.3 * Math.exp(-(((z - bz) / 7.5) ** 2)) - 0.16 * Math.exp(-(((z - (bz - 13)) / 7) ** 2))) * wet;
  // 遠浅の砂地の細かい起伏
  const sea = smoothstep(-2, 6, zz);
  h += (fbm2(nD, x * 0.045, z * 0.06, 3) * 0.07 + nC(x * 0.19, z * 0.23) * 0.018) * sea;
  // 河口: 川筋と、海へ扇形に広がる浅い干潟（本ハマグリの場所）
  const rx = riverX(z);
  const dx = Math.abs(x - rx);
  const flat = Math.exp(-(((x - (RIVER_X - 4)) / 38) ** 2)) * smoothstep(-4, 6, zz) * (1 - smoothstep(34, 58, zz));
  h += 0.16 * flat;
  const W = 5.5 + Math.max(0, z + 10) * 0.28;
  const bottom = z < -30 ? -0.95 : lerp(-0.95, -0.62, smoothstep(-30, 36, z));
  const inChan = smoothstep(W, W * 0.25, dx) * (1 - smoothstep(34, 60, z));
  if (inChan > 0) {
    const bed = bottom + (dx / W) ** 2 * 0.5;
    h = lerp(h, Math.min(h, bed), inChan);
  }
  // 河口の東の砂嘴（波をすこし和らげる）
  h += 0.32 * Math.exp(-(((x - (RIVER_X + 16 - z * 0.25)) / 7) ** 2)) * Math.exp(-(((zz - 9) / 7) ** 2));
  // 突堤のまわりの洗掘と、根元の砂のたまり
  const gd = Math.abs(x - GROYNE_X);
  h -= 0.22 * Math.exp(-((gd / 6) ** 2)) * smoothstep(20, 44, z) * (1 - smoothstep(48, 60, z));
  h += 0.25 * Math.exp(-((Math.max(0, gd - 1.6) / 9) ** 2)) * smoothstep(-2, 6, z) * (1 - smoothstep(10, 22, z));
  // 東西の岬（海へ突き出た岩山）
  h = Math.max(h, headland(x, z));
  return h;
}

function headland(x, z) {
  // 西の岬
  const west = -470 - z * 0.35 + fbm2(nA, z * 0.01, 5, 2) * 40;
  const kW = smoothstep(west + 60, west - 30, x) * smoothstep(420, 150, z);
  // 東の岬
  const east = 640 + z * 0.3 + fbm2(nB, z * 0.012, 9, 2) * 50;
  const kE = smoothstep(east - 60, east + 30, x) * smoothstep(360, 120, z);
  const k = Math.max(kW, kE);
  if (k <= 0) return -99;
  const rough = fbm2(nC, x * 0.02, z * 0.02, 4);
  return lerp(-12, 38 + rough * 18, k) + rough * 4 * k;
}

// 砂の場所（1）と、草・土・岩（0）
function sandness(x, z, h) {
  const zz = z - shoreWarp(x);
  let s = 1 - smoothstep(-44, -60, zz);
  s *= 1 - smoothstep(12, 30, h); // 岬の岩山
  return clamp(s, 0, 1);
}

// 地面の色（頂点の色。掘った穴のメッシュもこれでそろえる）
const cDry = new THREE.Color('#d9c7a1'), cDamp = new THREE.Color('#c2ae86'), cWet = new THREE.Color('#b09b73');
const cDune = new THREE.Color('#d9c9a1'), cGrass = new THREE.Color('#7d8a45'), cGrass2 = new THREE.Color('#5d7434');
const cSoil = new THREE.Color('#6e5a3e'), cNeedle = new THREE.Color('#735c3c'), cRock = new THREE.Color('#6b665e'), cRock2 = new THREE.Color('#8a8172');
const cBlack = new THREE.Color('#3b3833'), cBlackDry = new THREE.Color('#5b5750'), cCanopy = new THREE.Color('#2f4a26');
export function groundColor(x, z, h, c = new THREE.Color()) {
  const s = sandness(x, z, h);
  const n1 = nB(x * 0.05, z * 0.05) * 0.5 + 0.5, n2 = nD(x * 0.21, z * 0.19) * 0.5 + 0.5;
  // 砂: 高さで乾き具合が変わる（干潮の汀線より下はずっと濡れている）
  c.copy(cDry).lerp(cDune, smoothstep(1.7, 3.2, h) * 0.6);
  c.lerp(cDamp, smoothstep(1.25, 0.55, h));
  c.lerp(cWet, smoothstep(0.35, -0.1, h));
  // 河口の黒っぽい砂（川が運んだ細かい砂と泥。本ハマグリの干潟の目印）
  const mk = mouthK(x, z);
  if (mk > 0) c.lerp(cBlackDry.clone().lerp(cBlack, smoothstep(0.6, 0.0, h)), mk * (0.9 + n2 * 0.08));
  c.multiplyScalar(0.93 + n2 * 0.1);
  // 草・土・岩
  const g = cGrass.clone().lerp(cGrass2, n1);
  const forest = smoothstep(-62, -90, z - shoreWarp(x));
  g.lerp(cNeedle, forest * 0.55).lerp(cSoil, forest * n2 * 0.3);
  // 木を植えていない奥（松林の続き・裏山）は、遠目に林に見える濃い緑
  const canopy = Math.max(smoothstep(-150, -185, z), smoothstep(340, 380, Math.abs(x)) * smoothstep(-50, -70, z));
  g.lerp(cCanopy.clone().multiplyScalar(0.8 + n1 * 0.4), canopy * (1 - smoothstep(24, 40, h)));
  const rock = smoothstep(10, 24, h) * smoothstep(0.3, 0.7, n1 + n2 * 0.4);
  g.lerp(cRock.clone().lerp(cRock2, n2), rock);
  c.lerp(g, 1 - s);
  return c;
}

export class Beach {
  constructor() {
    // 近く: 0.5m 格子
    this.x0 = -186; this.z0 = -84; this.cell = 0.5;
    this.nx = 744; this.nz = 372; // 頂点数 = (nx+1)*(nz+1)
    const N1 = this.nx + 1;
    const H = (this.heights = new Float32Array(N1 * (this.nz + 1)));
    for (let j = 0; j <= this.nz; j++) for (let i = 0; i <= this.nx; i++) H[j * N1 + i] = bedHeight(this.x0 + i * this.cell, this.z0 + j * this.cell);
    this.material = sandMaterial({ holes: true });
    this.near = this.buildGrid(this.x0, this.z0, this.cell, this.nx, this.nz, (i, j) => H[j * N1 + i], null);
    this.near.name = 'beach-near';
    // 遠く: 12m 格子（近くの範囲は抜く。境目は近くの下に 1 マス重ねる）
    const fc = 12, fx0 = -1800, fz0 = -1500, fnx = 300, fnz = 250;
    const inner = { x0: this.x0 + fc, x1: this.x0 + this.nx * this.cell - fc, z0: this.z0 + fc, z1: this.z0 + this.nz * this.cell - fc };
    this.far = this.buildGrid(fx0, fz0, fc, fnx, fnz, (i, j) => {
      const x = fx0 + i * fc, z = fz0 + j * fc;
      const h = bedHeight(x, z);
      const inside = x > inner.x0 - fc && x < inner.x1 + fc && z > inner.z0 - fc && z < inner.z1 + fc;
      return inside ? h - 0.08 : h;
    }, inner);
    this.far.name = 'beach-far';
    this.group = new THREE.Group();
    this.group.add(this.near, this.far);
    this.near.receiveShadow = true;
    this.heightTex = this.buildHeightTexture();
  }

  /** 描画メッシュと同じ三角形で補間した地面の高さ（近くの範囲の外は解析式） */
  heightAt(x, z) {
    const fx = (x - this.x0) / this.cell, fz = (z - this.z0) / this.cell;
    if (fx < 0 || fz < 0 || fx >= this.nx || fz >= this.nz) return bedHeight(x, z);
    const i = Math.floor(fx), j = Math.floor(fz);
    const tx = fx - i, tz = fz - j;
    const N1 = this.nx + 1, H = this.heights;
    const a = H[j * N1 + i], d = H[j * N1 + i + 1], b = H[(j + 1) * N1 + i], c = H[(j + 1) * N1 + i + 1];
    return tx + tz <= 1 ? a + (d - a) * tx + (b - a) * tz : c + (b - c) * (1 - tx) + (d - c) * (1 - tz);
  }

  normalAt(x, z, out = new THREE.Vector3()) {
    const e = 0.3;
    const hx = this.heightAt(x + e, z) - this.heightAt(x - e, z);
    const hz = this.heightAt(x, z + e) - this.heightAt(x, z - e);
    return out.set(-hx, 2 * e, -hz).normalize();
  }

  // 格子のメッシュ（三角形の割り方は heightAt と同じ: (i,j)-(i,j+1)-(i+1,j) と (i,j+1)-(i+1,j+1)-(i+1,j)）
  buildGrid(x0, z0, cell, nx, nz, hFn, hole) {
    const N1 = nx + 1, count = N1 * (nz + 1);
    const pos = new Float32Array(count * 3), colr = new Float32Array(count * 3), sand = new Float32Array(count);
    const c = new THREE.Color();
    for (let j = 0; j <= nz; j++) {
      for (let i = 0; i <= nx; i++) {
        const k = j * N1 + i;
        const x = x0 + i * cell, z = z0 + j * cell, h = hFn(i, j);
        pos[k * 3] = x; pos[k * 3 + 1] = h; pos[k * 3 + 2] = z;
        const s = sandness(x, z, h);
        groundColor(x, z, h, c);
        colr[k * 3] = c.r; colr[k * 3 + 1] = c.g; colr[k * 3 + 2] = c.b;
        sand[k] = s;
      }
    }
    const idx = [];
    for (let j = 0; j < nz; j++) {
      for (let i = 0; i < nx; i++) {
        if (hole) {
          const x = x0 + (i + 0.5) * cell, z = z0 + (j + 0.5) * cell;
          if (x > hole.x0 && x < hole.x1 && z > hole.z0 && z < hole.z1) continue;
        }
        const a = j * N1 + i, b = (j + 1) * N1 + i, cc = (j + 1) * N1 + i + 1, d = j * N1 + i + 1;
        idx.push(a, b, d, b, cc, d);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colr, 3));
    geo.setAttribute('aSand', new THREE.BufferAttribute(sand, 1));
    geo.setIndex(count > 65535 ? new THREE.Uint32BufferAttribute(idx, 1) : new THREE.Uint16BufferAttribute(idx, 1));
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
    return new THREE.Mesh(geo, this.material);
  }

  // 水面の計算（波の高さが水深で変わる）に使う高さのテクスチャ。x -400..400, z -200..600
  buildHeightTexture() {
    const R = 1024;
    const T = (this.hTex = { x0: -400, z0: -200, size: 800, R, data: new Float32Array(R * R) });
    const half = new Uint16Array(R * R);
    for (let j = 0; j < R; j++) {
      for (let i = 0; i < R; i++) {
        const x = T.x0 + (i + 0.5) / R * T.size, z = T.z0 + (j + 0.5) / R * T.size;
        const h = this.heightAt(x, z);
        T.data[j * R + i] = h;
        half[j * R + i] = THREE.DataUtils.toHalfFloat(h);
      }
    }
    const tex = new THREE.DataTexture(half, R, R, THREE.RedFormat, THREE.HalfFloatType);
    tex.magFilter = tex.minFilter = THREE.LinearFilter;
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.needsUpdate = true;
    return tex;
  }

  /** 高さテクスチャと同じ値（GPU の線形補間と同じ）。波の計算を CPU と GPU でそろえる */
  texHeight(x, z) {
    const T = this.hTex, R = T.R;
    const fx = clamp((x - T.x0) / T.size * R - 0.5, 0, R - 1.001), fz = clamp((z - T.z0) / T.size * R - 0.5, 0, R - 1.001);
    const i = Math.floor(fx), j = Math.floor(fz), tx = fx - i, tz = fz - j;
    const D = T.data;
    const a = D[j * R + i], b = D[j * R + i + 1], c = D[(j + 1) * R + i], d = D[(j + 1) * R + i + 1];
    return lerp(lerp(a, b, tx), lerp(c, d, tx), tz);
  }
}

// ───────── 砂の材質 ─────────
// ・水の下は岸と平行な砂紋（波長 8〜9cm、尖った山と丸い谷、ところどころ途切れて枝分かれ）
// ・砂粒のざらつき、貝殻のかけら、砂鉄の黒い筋
// ・濡れた砂はつやが出る
export const SAND_GLSL = /* glsl */ `
float hmRipple(vec2 p) {
  float warp = hm_vn(p * 0.8) * 1.4 + hm_vn(p * 2.1 + 7.0) * 0.45;
  float ph = (p.y + warp * 0.11 + sin(p.x * 0.63) * 0.05) * (6.2831 / 0.088);
  float s = sin(ph) * 0.5 + 0.5;
  float h = 1.0 - pow(1.0 - s, 1.9);
  h *= 0.55 + 0.45 * smoothstep(0.15, 0.6, hm_vn(p * 1.6 + 3.1));
  return h;
}
// 砂紋の高さと勾配（x: 高さ, yz: d/dx, d/dz）。うねりの勾配は小さいので省く
vec3 hmRippleG(vec2 p) {
  float warp = hm_vn(p * 0.8) * 1.4 + hm_vn(p * 2.1 + 7.0) * 0.45;
  float K = 6.2831 / 0.088;
  float ph = (p.y + warp * 0.11 + sin(p.x * 0.63) * 0.05) * K;
  float s = sin(ph) * 0.5 + 0.5;
  float br = 0.55 + 0.45 * smoothstep(0.15, 0.6, hm_vn(p * 1.6 + 3.1));
  float h = (1.0 - pow(1.0 - s, 1.9)) * br;
  float dh = 1.9 * pow(max(1.0 - s, 1e-3), 0.9) * 0.5 * cos(ph) * K * br;
  return vec3(h, dh * (cos(p.x * 0.63) * 0.0315), dh);
}
// 貝殻のかけら（4cm のマスに 1 つあるかないか）
vec4 hmShellBit(vec2 p) {
  vec2 cell = floor(p / 0.04);
  vec2 f = p / 0.04 - cell;
  float r = hm_h21(cell);
  if (r > 0.028) return vec4(0.0);
  vec2 c = hm_h22(cell + 5.1) * 0.6 + 0.2;
  vec2 d = f - c;
  float a = hm_h21(cell + 9.3) * 6.2831;
  d = mat2(cos(a), -sin(a), sin(a), cos(a)) * d;
  float sz = 0.06 + hm_h21(cell + 2.2) * 0.2;
  float m = 1.0 - smoothstep(sz * 0.7, sz, length(d * vec2(1.0, 1.8 + hm_h21(cell + 4.4))));
  float hue = hm_h21(cell + 8.8);
  vec3 col = hue < 0.5 ? vec3(0.86, 0.82, 0.74) : hue < 0.8 ? vec3(0.84, 0.7, 0.64) : vec3(0.6, 0.52, 0.5);
  return vec4(col, m);
}
`;

export function sandMaterial({ holes = false, vcol = false } = {}) {
  const mat = new THREE.MeshStandardMaterial({ vertexColors: holes || vcol, color: holes || vcol ? '#ffffff' : '#ac976f', roughness: 0.95, metalness: 0 });
  const uHoles = { value: Array.from({ length: 6 }, () => new THREE.Vector4()) };
  mat.userData.holes = uHoles;
  patchMaterial(mat, {
    uniforms: { uHoles },
    fx: {
      key: holes ? 'sand-h' : 'sand',
      vdecl: 'attribute float aSand; varying float vSand; varying vec2 vLow;',
      vcode: (holes ? 'vSand = aSand;' : 'vSand = 1.0;') + `
        {
          // 大きな色むらと砂鉄の筋（ゆっくり変わるので頂点で）
          vec2 wq = (modelMatrix * vec4(transformed, 1.0)).xz;
          vLow = vec2(hm_fbm(wq * 0.12), hm_fbm(vec2(wq.x * 0.05, wq.y * 0.9) + 11.0));
        }`,
      decl: `varying float vSand; varying vec2 vLow; float hmWet; float hmNear; uniform vec4 uHoles[6];
${holes ? '#define HM_HOLES' : ''}
${SAND_GLSL}`,
      color: /* glsl */ `
        #ifdef HM_HOLES
          for (int i = 0; i < 6; i++) {
            vec4 h = uHoles[i];
            if (h.w > 0.5 && length(vWPos.xz - h.xy) < h.z) discard;
          }
        #endif
        {
          vec2 q = vWPos.xz;
          float dist = length(vWPos - cameraPosition);
          hmNear = 1.0 - smoothstep(7.0, 16.0, dist);
          // 濡れ: 潮の高さ + 打ち上げる波ぶん
          hmWet = smoothstep(uTide + 0.55, uTide + 0.12, vWPos.y);
          float sandK = vSand;
          // 大きな色むら・砂鉄の筋（汀線ぞいに黒い帯）
          float big = vLow.x;
          diffuseColor.rgb *= mix(1.0, 0.9 + big * 0.2, sandK);
          float streak = smoothstep(0.62, 0.8, vLow.y) * smoothstep(uTide + 1.2, uTide + 0.3, vWPos.y) * smoothstep(uTide - 0.5, uTide + 0.1, vWPos.y);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.3, 0.27, 0.24), streak * 0.45 * sandK);
          // 濡れた砂は暗く、少し彩度が上がる
          diffuseColor.rgb *= mix(1.0, 0.8, hmWet * sandK);
          // 砂粒（近くだけ）: ところどころ黒い粒・白い粒
          float grain = hm_h21(floor(q * 520.0));
          diffuseColor.rgb *= 1.0 + (grain - 0.5) * 0.22 * hmNear * sandK;
          float speck = hm_h21(floor(q * 260.0) + 3.7);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.25, 0.22, 0.2), step(0.965, speck) * 0.6 * hmNear * sandK);
          diffuseColor.rgb *= 0.94 + hm_vn(q * 3.0) * 0.1;
          // 貝殻のかけら
          vec4 sb = hmShellBit(q);
          diffuseColor.rgb = mix(diffuseColor.rgb, sb.rgb * mix(1.0, 0.85, hmWet), sb.a * sandK * (1.0 - smoothstep(10.0, 22.0, dist)));
        }`,
      normal: /* glsl */ `
        {
          vec2 q = vWPos.xz;
          float wd = uTide - vWPos.y;
          // 砂紋: 水の下と、潮が引いたばかりの所
          float rk = smoothstep(-0.25, 0.1, wd) * vSand * hmNear;
          vec3 gw = vec3(0.0);
          if (rk > 0.001) {
            vec3 rg = hmRippleG(q);
            float amp = 0.0055 * (0.6 + 0.4 * smoothstep(0.1, 0.5, wd));
            gw += vec3(-rg.y, 0.0, -rg.z) * amp * rk;
          }
          // 乾いた砂の風紋（海風で陸へ向かう細かい波）
          float dk = smoothstep(uTide + 0.5, uTide + 0.9, vWPos.y) * vSand * hmNear;
          if (dk > 0.001) {
            float e = 0.006;
            float w0 = sin((q.y * 1.0 + hm_vn(q * 1.3) * 0.25 + q.x * 0.15) * 95.0);
            float wx = sin(((q.y) * 1.0 + hm_vn((q + vec2(e, 0.0)) * 1.3) * 0.25 + (q.x + e) * 0.15) * 95.0);
            float wz = sin(((q.y + e) * 1.0 + hm_vn((q + vec2(0.0, e)) * 1.3) * 0.25 + q.x * 0.15) * 95.0);
            gw += vec3(-(wx - w0) / e, 0.0, -(wz - w0) / e) * 0.0009 * dk * (1.0 - smoothstep(0.6, 2.5, length(vWPos - cameraPosition)) * 0.6);
          }
          // 砂粒のざらつき
          float gk = vSand * (1.0 - smoothstep(1.0, 4.0, length(vWPos - cameraPosition)));
          if (gk > 0.001) {
            vec2 g = hm_h22(floor(q * 400.0)) - 0.5;
            gw += vec3(g.x, 0.0, g.y) * 0.35 * gk;
          }
          normal = normalize(normal + (viewMatrix * vec4(gw, 0.0)).xyz);
        }`,
      rough: /* glsl */ `
        roughnessFactor = mix(roughnessFactor, 0.42, hmWet * vSand * smoothstep(uTide + 0.02, uTide + 0.2, vWPos.y) * 0.85);
        roughnessFactor = mix(roughnessFactor, 0.6, smoothstep(0.0, 0.1, uTide - vWPos.y));`,
    },
  });
  return mat;
}
