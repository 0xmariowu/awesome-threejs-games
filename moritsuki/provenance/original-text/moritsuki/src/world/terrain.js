// 地形: 無人島 → 砂浜 → 藻場 → 岩礁帯 → ドロップオフ → 深場の砂地
import * as THREE from 'three';
import { makeNoise2D, fbm2, smoothstep, clamp, lerp } from '../core/noise.js';
import { patchMaterial } from '../core/shaderPatch.js';

export const WORLD_SIZE = 520;
const SEG = 420;
export const PLAY_RADIUS = 235;

const n1 = makeNoise2D(11);
const n2 = makeNoise2D(23);
const n3 = makeNoise2D(37);

// 半径方向の断面プロファイル (r, 高さ)
const PROFILE = [
  [0, 17], [14, 13], [24, 8], [32, 3.2], [38, 1.4], [43, 0.3], [48, -0.9],
  [58, -2.6], [72, -4.6], [95, -6.2], [122, -7.6], [136, -10.5], [150, -15.5],
  [168, -19.5], [200, -22.5], [260, -25],
];
function profile(r) {
  if (r <= PROFILE[0][0]) return PROFILE[0][1];
  for (let i = 1; i < PROFILE.length; i++) {
    const [r1, h1] = PROFILE[i];
    if (r <= r1) {
      const [r0, h0] = PROFILE[i - 1];
      const t = (r - r0) / (r1 - r0);
      const s = t * t * (3 - 2 * t);
      return lerp(h0, h1, lerp(t, s, 0.6));
    }
  }
  return PROFILE[PROFILE.length - 1][1];
}

export function warpedRadius(x, z) {
  const r = Math.hypot(x, z);
  const a = Math.atan2(z, x);
  return r + fbm2(n1, x * 0.011, z * 0.011, 3) * 16 + Math.sin(a * 3 + 1.2) * 7 + Math.sin(a * 5 - 0.4) * 3;
}

export function analyticHeight(x, z) {
  const rn = warpedRadius(x, z);
  let h = profile(rn);
  // 島の起伏
  const islandMask = 1 - smoothstep(26, 44, rn);
  h += (fbm2(n2, x * 0.03, z * 0.03, 4) * 4.5 + 1.5) * islandMask * smoothstep(0, 30, 44 - rn);
  // 岩礁帯のうねり
  const reef = smoothstep(58, 80, rn) * (1 - smoothstep(145, 170, rn));
  const ridge = 1 - Math.abs(n3(x * 0.028, z * 0.028));
  h += (fbm2(n2, x * 0.06, z * 0.06, 3) * 1.1 + (ridge * ridge - 0.45) * 2.2) * reef;
  // 深場のゆるいうねり
  const deep = smoothstep(150, 190, rn);
  h += fbm2(n3, x * 0.02, z * 0.02, 3) * 2.0 * deep;
  // 浅場の細かい凸凹
  h += n1(x * 0.21, z * 0.21) * 0.18 * smoothstep(40, 60, rn);
  return h;
}

export class Terrain {
  constructor() {
    const N = SEG + 1;
    this.N = N;
    this.cell = WORLD_SIZE / SEG;
    this.heights = new Float32Array(N * N);
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const x = -WORLD_SIZE / 2 + i * this.cell;
        const z = -WORLD_SIZE / 2 + j * this.cell;
        this.heights[j * N + i] = analyticHeight(x, z);
      }
    }
    this.mesh = this.buildMesh();
    this.heightTex = this.buildHeightTexture();
  }

  heightAt(x, z) {
    const fx = (x + WORLD_SIZE / 2) / this.cell;
    const fz = (z + WORLD_SIZE / 2) / this.cell;
    const i = clamp(Math.floor(fx), 0, this.N - 2);
    const j = clamp(Math.floor(fz), 0, this.N - 2);
    const tx = clamp(fx - i, 0, 1), tz = clamp(fz - j, 0, 1);
    // 描画メッシュ（PlaneGeometry）と同じ三角形の割り方で補間する。
    // 双線形補間だと起伏のある所で見た目の地面と数cmずれ、置いた物が埋まる。
    const H = this.heights, N = this.N;
    const a = H[j * N + i], d = H[j * N + i + 1], b = H[(j + 1) * N + i], c = H[(j + 1) * N + i + 1];
    return tx + tz <= 1 ? a + (d - a) * tx + (b - a) * tz : c + (b - c) * (1 - tx) + (d - c) * (1 - tz);
  }

  normalAt(x, z, out = new THREE.Vector3()) {
    const e = 0.6;
    const hx = this.heightAt(x + e, z) - this.heightAt(x - e, z);
    const hz = this.heightAt(x, z + e) - this.heightAt(x, z - e);
    return out.set(-hx, 2 * e, -hz).normalize();
  }

  buildMesh() {
    const geo = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, SEG, SEG);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const N = this.N;
    // PlaneGeometry の頂点順: 行(j)ごとに -z から +z 、列 i は -x → +x
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const idx = j * N + i;
        pos.setY(idx, this.heights[idx]);
      }
    }
    geo.computeVertexNormals();
    const nrm = geo.attributes.normal;
    const colors = new Float32Array(pos.count * 3);
    const sand = new Float32Array(pos.count);
    const c = new THREE.Color();
    const cSand = new THREE.Color('#cbbb94');
    const cSandDeep = new THREE.Color('#ae9f7e');
    const cWet = new THREE.Color('#bda878');
    const cRock = new THREE.Color('#6d655a');
    const cAlgae = new THREE.Color('#62703f');
    const cCoralline = new THREE.Color('#a77b86');
    const cGrass = new THREE.Color('#4f7d2c');
    const cGrass2 = new THREE.Color('#6e9a35');
    const cDirt = new THREE.Color('#7b6547');
    const cSeagrassBed = new THREE.Color('#9fa56a');
    for (let k = 0; k < pos.count; k++) {
      const x = pos.getX(k), y = pos.getY(k), z = pos.getZ(k);
      const ny = nrm.getY(k);
      const slope = 1 - ny;
      const rn = warpedRadius(x, z);
      const nz = n2(x * 0.08, z * 0.08) * 0.5 + 0.5;
      const nz2 = n3(x * 0.25, z * 0.25) * 0.5 + 0.5;
      let s = 1;
      if (y > 0.4) {
        // 陸
        const grassT = smoothstep(2.0, 3.6, y + nz * 1.2);
        c.copy(cSand).lerp(cWet, smoothstep(1.2, 0.3, y) * 0.6);
        const g = cGrass.clone().lerp(cGrass2, nz2);
        c.lerp(g, grassT);
        c.lerp(cDirt, smoothstep(0.25, 0.5, slope) * 0.8);
        s = 0;
      } else {
        c.copy(cSand).lerp(cSandDeep, smoothstep(-2, -18, y));
        c.multiplyScalar(0.9 + nz2 * 0.15);
        const reef = smoothstep(60, 78, rn) * (1 - smoothstep(150, 172, rn));
        const rocky = clamp(smoothstep(0.08, 0.28, slope) + reef * smoothstep(0.55, 0.8, nz) * 0.9, 0, 1);
        const rockCol = cRock.clone().lerp(cAlgae, nz2 * 0.7).lerp(cCoralline, smoothstep(0.7, 0.95, nz2) * 0.6);
        c.lerp(rockCol, rocky);
        // アマモ場の地面
        const bed = smoothstep(47, 52, rn) * (1 - smoothstep(64, 72, rn)) * smoothstep(0.45, 0.65, n1(x * 0.04, z * 0.04) * 0.5 + 0.5);
        c.lerp(cSeagrassBed, bed * 0.5);
        s = 1 - rocky;
      }
      colors[k * 3] = c.r; colors[k * 3 + 1] = c.g; colors[k * 3 + 2] = c.b;
      sand[k] = s;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.setAttribute('aSand', new THREE.BufferAttribute(sand, 1));
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 });
    patchMaterial(mat, { caustics: true, sandRipple: true });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = 'terrain';
    return mesh;
  }

  buildHeightTexture() {
    const R = 256;
    const data = new Uint8Array(R * R * 4);
    for (let j = 0; j < R; j++) {
      for (let i = 0; i < R; i++) {
        const x = -WORLD_SIZE / 2 + (i + 0.5) / R * WORLD_SIZE;
        const z = -WORLD_SIZE / 2 + (j + 0.5) / R * WORLD_SIZE;
        const h = this.heightAt(x, z);
        const v = clamp((h + 30) / 50, 0, 1) * 255;
        const k = (j * R + i) * 4;
        data[k] = v; data[k + 1] = v; data[k + 2] = v; data[k + 3] = 255;
      }
    }
    const tex = new THREE.DataTexture(data, R, R, THREE.RGBAFormat);
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearFilter;
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.needsUpdate = true;
    return tex;
  }
}
