// 側溝の中と縁の植物・底の物
// ・縁の草: 田んぼ側は土手いっぱいに茂り、縁から側溝の中へ垂れる（先が水にとどく）。農道側はまばら
// ・セキショウ: 壁ぎわの泥から剣のような細い葉の株が水の上へ弓なりに出る
// ・エビモ: 水の中の茎に、ふちの波打った細い葉。流れになびく
// ・クレソン: 水ぎわに丸い小葉の茎がからまって浮く
// ・落ち葉・石・水抜き穴のシダ
// 生き物の隠れ場所（hideSpots）もここで決める
import * as THREE from 'three';
import { patchMaterial } from './shade.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { leafAtlas } from './textures.js';
import { HW, WALL_T, WEEDS, S_GRATE, S_FAR, CULVERT, DROPS, PIPES, bedAt, levelAt, groundAt, weepHoles } from './ditch.js';
import { RNG, lerp, clamp, smoothstep } from './core/noise.js';

const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

// 葉（細長い帯）を足していく入れ物
class Blades {
  constructor() { this.pos = []; this.nrm = []; this.col = []; this.idx = []; this.bend = []; }
  /** 経路 pts（根元→先）に沿った帯。w(t) = 幅、side = 帯の横の向き、color(t) */
  strip(pts, w, side, color) {
    const base = this.pos.length / 3;
    const n = pts.length;
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const p = pts[i];
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
      const T = b.clone().sub(a).normalize();
      const S = side.clone().addScaledVector(T, -side.dot(T)).normalize();
      const N = new THREE.Vector3().crossVectors(T, S).normalize();
      const ww = w(t) / 2;
      const c = color(t);
      this.pos.push(p.x - S.x * ww, p.y - S.y * ww, p.z - S.z * ww, p.x + S.x * ww, p.y + S.y * ww, p.z + S.z * ww);
      this.nrm.push(N.x, N.y, N.z, N.x, N.y, N.z);
      this.col.push(c[0], c[1], c[2], c[0], c[1], c[2]);
      this.bend.push(t, t);
    }
    for (let i = 0; i < n - 1; i++) {
      const k = base + i * 2;
      this.idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
    }
  }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nrm, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute('aBend', new THREE.Float32BufferAttribute(this.bend, 1));
    g.setIndex(this.idx);
    g.computeBoundingSphere();
    return g;
  }
}

// 植物のゆれ: 空気の中は風、水の中は流れ（下流 +z へなびき、ゆらゆら）
const SWAY_FX = (key, water) => ({
  key,
  vdecl: 'attribute float aBend;',
  vcode: /* glsl */ `
    {
      vec3 ip = vec3(0.0);
      #ifdef USE_INSTANCING
        ip = instanceMatrix[3].xyz;
      #endif
      float k = aBend * aBend;
      ${water ? `
      transformed.z += 0.0;
      float ph = uTime * 2.3 + ip.x * 3.0 + ip.z * 1.7 + aBend * 3.0;
      transformed.x += sin(ph) * 0.025 * k;
      transformed.y += sin(ph * 0.7) * 0.006 * k;
      ` : `
      transformed.x += sin(uTime * 1.4 + ip.z * 0.8 + ip.x) * 0.02 * k;
      transformed.z += cos(uTime * 1.1 + ip.x * 0.6) * 0.015 * k;
      `}
    }
  `,
  light: /* glsl */ `
    {
      float d = length(vWPos - uLampPos);
      float irr = lampCone(vWPos) * uLampI / (d * d + 0.3);
      // 葉は薄いので、裏や横からの光も透ける
      float wd = ditchLevel(vWPos) - vWPos.y;
      vec3 ab = wd > 0.0 ? exp(-uWaterSigma * wd * 2.0) : vec3(1.0);
      reflectedLight.directDiffuse += diffuseColor.rgb * irr * 0.045 * ab;
      // 葉の露がライトできらめく
      float sp = step(0.988, un_h21(floor(vWPos.xz * 80.0) + floor(vWPos.y * 50.0)));
      reflectedLight.directSpecular += vec3(0.9, 0.95, 1.0) * sp * irr * 0.015 * step(0.0, -wd);
    }
  `,
});

export class Plants {
  constructor(scene) {
    this.group = new THREE.Group();
    scene.add(this.group);
    this.hideSpots = [];   // { x, s, r, kind }
    this.rng = new RNG(4401);
    const grassMat = patchMaterial(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, side: THREE.DoubleSide }), { fx: SWAY_FX('grass', false) });
    const waterMat = patchMaterial(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, side: THREE.DoubleSide }), { fx: SWAY_FX('weed', true) });
    const sekiMat = patchMaterial(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, side: THREE.DoubleSide }), { fx: SWAY_FX('seki', false) });
    this.grassMat = grassMat; this.waterMat = waterMat;
    this.buildVerge(grassMat);
    this.buildSekisho(sekiMat);
    this.buildEbimo(waterMat);
    this.buildCress(sekiMat);
    this.buildLeaves();
    this.buildStones();
    this.buildFerns(grassMat);
  }

  weedK(s, side, kind) {
    let k = 0;
    for (const w of WEEDS) {
      if (w.kind !== kind) continue;
      if (w.side !== 0 && side !== 0 && w.side !== side) continue;
      const e = Math.min(s - w.s0, w.s1 - s);
      if (e > -1) k = Math.max(k, w.k * smoothstep(-1, 1, e));
    }
    return k;
  }

  // ───── 縁の草 ─────
  tuftGeo(variant, { hang = false } = {}) {
    const r = new RNG(100 + variant * 7);
    const B = new Blades();
    const n = hang ? 26 : 14;
    for (let i = 0; i < n; i++) {
      const a = r.range(0, Math.PI * 2);
      const len = hang ? r.range(0.35, 0.9) : r.range(0.18, 0.5);
      const w = hang ? r.range(0.008, 0.015) : r.range(0.006, 0.011);
      const lean = hang ? r.range(0.6, 1.0) : r.range(0.15, 0.6);
      // 垂れる草は -x（側溝の中）へ倒れて下へ垂れる
      const dir = hang ? V3(-1, 0, r.range(-0.5, 0.5)).normalize() : V3(Math.cos(a), 0, Math.sin(a));
      const pts = [];
      const segs = 6;
      const x0 = r.range(-0.03, 0.03), z0 = r.range(-0.05, 0.05);
      for (let j = 0; j <= segs; j++) {
        const t = j / segs;
        let h, o;
        if (hang) {
          // 上へ少し伸びてから、縁を越えて下へ垂れる（先ほど細かくゆれて曲がる）
          h = len * (0.4 * Math.sin(t * Math.PI * 0.8) - lean * 0.85 * t * t) + Math.sin(t * 7 + i) * 0.01 * t;
          o = len * (0.3 * t + lean * 0.5 * t) * (1 - 0.25 * t * t);
        } else {
          h = len * (t - lean * 0.35 * t * t);
          o = len * lean * 0.6 * t * t;
        }
        pts.push(V3(x0 + dir.x * o, h, z0 + dir.z * o));
      }
      const g0 = r.range(0.7, 1.1);
      const dry = r.chance(0.12);
      B.strip(pts, (t) => w * (1 - t * 0.8), V3(-dir.z, 0, dir.x), (t) => dry ? [0.22 * g0, 0.19 * g0, 0.09 * g0] : [lerp(0.04, 0.1, t) * g0, lerp(0.09, 0.2, t) * g0, lerp(0.02, 0.045, t) * g0]);
    }
    return B.build();
  }
  buildVerge(mat) {
    const rng = this.rng;
    const geos = [0, 1, 2].map((v) => this.tuftGeo(v));
    const hangs = [0, 1, 2].map((v) => this.tuftGeo(v + 10, { hang: true }));
    const lists = geos.map(() => []), hl = hangs.map(() => []);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
    const X_IN = HW + WALL_T;
    for (let s = S_GRATE - 6; s < S_FAR; s += 0.12) {
      if (s > CULVERT.s0 - 0.3 && s < CULVERT.s1 + 0.3) continue;
      const g = groundAt(s);
      // 田んぼ側: 土手いっぱい
      for (let k = 0; k < 3; k++) {
        const x = rng.range(X_IN + 0.02, 1.6);
        q.setFromAxisAngle(V3(0, 1, 0), rng.range(0, 6.28));
        const sc = rng.range(0.7, 1.25) * (1 + this.weedK(s, 1, 'sekisho') * 0.3);
        m4.compose(V3(x, g + 0.01, -s - rng.range(0, 0.12)), q, V3(sc, sc * rng.range(0.8, 1.3), sc));
        lists[rng.int(0, 2)].push(m4.clone());
      }
      // 農道側: 壁と道の間の細い草
      if (rng.chance(0.55)) {
        const x = -rng.range(X_IN + 0.01, X_IN + 0.25);
        q.setFromAxisAngle(V3(0, 1, 0), rng.range(0, 6.28));
        const sc = rng.range(0.5, 0.9);
        m4.compose(V3(x, g + 0.02, -s), q, V3(sc, sc, sc));
        lists[rng.int(0, 2)].push(m4.clone());
      }
      // 縁から垂れる草（田んぼ側が多い）
      for (const side of [1, -1]) {
        const dense = side > 0 ? 0.45 + this.weedK(s, 1, 'sekisho') * 0.4 + this.weedK(s, 1, 'cress') * 0.3 : 0.1 + this.weedK(s, -1, 'sekisho') * 0.35;
        if (!rng.chance(dense * 0.9)) continue;
        // 回して、-x 向きの草を側溝の中へ向ける
        q.setFromAxisAngle(V3(0, 1, 0), (side > 0 ? 0 : Math.PI) + rng.range(-0.35, 0.35));
        const sc = rng.range(0.75, 1.3);
        m4.compose(V3(side * (HW + WALL_T * 0.6), g + 0.03, -s), q, V3(sc, sc, sc));
        hl[rng.int(0, 2)].push(m4.clone());
        if (sc > 1.05 && side > 0) this.hideSpots.push({ x: side * (HW - 0.12), s, r: 0.25, kind: 'hang' });
      }
    }
    const add = (geo, list) => {
      const im = new THREE.InstancedMesh(geo, mat, list.length);
      list.forEach((m, i) => im.setMatrixAt(i, m));
      im.computeBoundingSphere();
      im.castShadow = true;
      im.receiveShadow = true;
      this.group.add(im);
    };
    geos.forEach((g, i) => add(g, lists[i]));
    hangs.forEach((g, i) => add(g, hl[i]));
  }

  // ───── セキショウ ─────
  buildSekisho(mat) {
    const rng = this.rng;
    const geo = (v) => {
      const r = new RNG(300 + v);
      const B = new Blades();
      for (let i = 0; i < 18; i++) {
        const a = r.range(-1.2, 1.2) + (r.chance(0.5) ? 0 : Math.PI);
        const len = r.range(0.3, 0.58);
        const w = r.range(0.006, 0.009);
        const lean = r.range(0.3, 0.9);
        const dir = V3(Math.cos(a), 0, Math.sin(a) * 0.6).normalize();
        const pts = [];
        for (let j = 0; j <= 6; j++) {
          const t = j / 6;
          pts.push(V3(dir.x * len * lean * 0.7 * t * t + r.range(-0.004, 0.004), len * (t - lean * 0.45 * t * t), dir.z * len * lean * 0.7 * t * t));
        }
        const gk = r.range(0.75, 1.1);
        B.strip(pts, (t) => w * (1 - t * 0.9), V3(-dir.z, 0, dir.x), (t) => [lerp(0.04, 0.09, t) * gk, lerp(0.1, 0.22, t) * gk, lerp(0.03, 0.05, t) * gk]);
      }
      return B.build();
    };
    const geos = [geo(0), geo(1)];
    const lists = [[], []];
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
    for (const w of WEEDS) {
      if (w.kind !== 'sekisho') continue;
      for (let s = w.s0; s < w.s1; s += rng.range(0.18, 0.35) / w.k) {
        const side = w.side || (rng.chance(0.5) ? 1 : -1);
        const x = side * (HW - rng.range(0.04, 0.16));
        const y = bedAt(x, s);
        // 水面の上へ出るように: 根元は泥の上、株の高さを水深に合わせる
        const depth = levelAt(s) - y;
        const sc = (depth + rng.range(0.15, 0.3)) / 0.45;
        q.setFromAxisAngle(V3(0, 1, 0), side > 0 ? Math.PI + rng.range(-0.4, 0.4) : rng.range(-0.4, 0.4));
        m4.compose(V3(x, y, -s), q, V3(1, sc, 1).multiplyScalar(rng.range(0.85, 1.15)));
        lists[rng.int(0, 1)].push(m4.clone());
        this.hideSpots.push({ x: side * (HW - 0.15), s, r: 0.18, kind: 'sekisho' });
      }
    }
    geos.forEach((g, i) => {
      const im = new THREE.InstancedMesh(g, mat, lists[i].length);
      lists[i].forEach((m, k) => im.setMatrixAt(k, m));
      im.computeBoundingSphere();
      im.castShadow = true;
      im.receiveShadow = true;
      this.group.add(im);
    });
  }

  // ───── エビモ ─────
  buildEbimo(mat) {
    const rng = this.rng;
    const geo = (v) => {
      const r = new RNG(500 + v);
      const B = new Blades();
      const stems = 4;
      for (let k = 0; k < stems; k++) {
        const x0 = r.range(-0.05, 0.05), z0 = r.range(-0.05, 0.05);
        const len = r.range(0.28, 0.38);
        const pts = [];
        // 茎: 下流（+z）へなびく
        for (let j = 0; j <= 8; j++) {
          const t = j / 8;
          pts.push(V3(x0 + Math.sin(t * 3 + k) * 0.015, len * (t - 0.25 * t * t), z0 + len * 0.55 * t * t));
        }
        B.strip(pts, () => 0.003, V3(1, 0, 0), () => [0.1, 0.13, 0.05]);
        // 葉: 茎の節から互い違いに、ふちが波打つ
        for (let j = 1; j < 8; j++) {
          const p = pts[j];
          const side = j % 2 ? 1 : -1;
          const L = r.range(0.04, 0.065) * (1 - j / 14);
          const lp = [];
          for (let m = 0; m <= 5; m++) {
            const t = m / 5;
            lp.push(p.clone().add(V3(side * L * t * 0.8, L * 0.15 * Math.sin(t * Math.PI) + Math.sin(t * 18) * 0.002, L * t * 0.6)));
          }
          const tone = r.range(0.8, 1.15);
          B.strip(lp, (t) => 0.012 * Math.sin(Math.min(1, t * 1.3 + 0.1) * Math.PI) + 0.002 * Math.sin(t * 40), V3(0, 1, 0.3), () => [0.12 * tone, 0.2 * tone, 0.05 * tone]);
        }
      }
      return B.build();
    };
    const geos = [geo(0), geo(1), geo(2)];
    const lists = [[], [], []];
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
    for (const w of WEEDS) {
      if (w.kind !== 'ebimo') continue;
      for (let s = w.s0; s < w.s1; s += 0.14) {
        const n = Math.round(rng.range(0, 3) * w.k);
        for (let k = 0; k < n; k++) {
          // 帯の中に、まだらに生える
          const x = rng.range(-HW + 0.08, HW - 0.08);
          const patch = Math.sin(x * 5 + s * 0.8) + Math.sin(s * 1.7 + 2) > -0.2;
          if (!patch) continue;
          const y = bedAt(x, s);
          const depth = levelAt(s) - y;
          q.setFromAxisAngle(V3(0, 1, 0), rng.range(-0.3, 0.3));
          const sc = clamp(depth / 0.38, 0.5, 1.4) * rng.range(0.8, 1.1);
          m4.compose(V3(x, y, -s), q, V3(1, sc, 1));
          lists[rng.int(0, 2)].push(m4.clone());
          if (k === 0 && rng.chance(0.35)) this.hideSpots.push({ x, s, r: 0.22, kind: 'ebimo' });
        }
      }
    }
    geos.forEach((g, i) => {
      const im = new THREE.InstancedMesh(g, mat, lists[i].length);
      lists[i].forEach((m, k) => im.setMatrixAt(k, m));
      im.computeBoundingSphere();
      im.receiveShadow = true;
      im.castShadow = true;
      this.group.add(im);
    });
  }

  // ───── クレソン ─────
  buildCress(mat) {
    const rng = this.rng;
    const geo = (v) => {
      const r = new RNG(700 + v);
      const B = new Blades();
      for (let k = 0; k < 7; k++) {
        const a = r.range(0, 6.28);
        const L = r.range(0.12, 0.22);
        const dir = V3(Math.cos(a), 0, Math.sin(a));
        const pts = [];
        for (let j = 0; j <= 5; j++) { const t = j / 5; pts.push(V3(dir.x * L * t, 0.02 + 0.06 * Math.sin(t * 2), dir.z * L * t)); }
        B.strip(pts, () => 0.004, V3(0, 1, 0), () => [0.12, 0.2, 0.06]);
        // 丸い小葉（羽状に 5〜7 枚）
        for (let j = 1; j <= 5; j++) {
          const p = pts[j];
          for (const sd of [-1, 1]) {
            const c = p.clone().add(V3(-dir.z * sd * 0.02, 0.005, dir.x * sd * 0.02));
            const lp = [];
            const Lr = r.range(0.011, 0.016);
            for (let m = 0; m <= 6; m++) { const t = m / 6; lp.push(c.clone().add(V3(-dir.z * sd * Lr * (t * 2 - 1), 0.004 * Math.sin(t * Math.PI), dir.x * sd * Lr * (t * 2 - 1)))); }
            const tone = r.range(0.85, 1.15);
            B.strip(lp, (t) => 2 * Lr * Math.sqrt(Math.max(0.02, 1 - (t * 2 - 1) ** 2)), V3(dir.x, 0.25, dir.z), () => [0.035 * tone, 0.1 * tone, 0.025 * tone]);
          }
        }
      }
      return B.build();
    };
    const geos = [geo(0), geo(1)];
    const lists = [[], []];
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
    for (const w of WEEDS) {
      if (w.kind !== 'cress') continue;
      for (let s = w.s0; s < w.s1; s += 0.1) {
        const side = w.side || 1;
        const n = rng.int(1, 3);
        for (let k = 0; k < n; k++) {
          const x = side * (HW - rng.range(0.02, 0.32) * w.k);
          q.setFromAxisAngle(V3(0, 1, 0), rng.range(0, 6.28));
          m4.compose(V3(x, levelAt(s) - 0.035, -s - rng.range(0, 0.1)), q, V3(1, 1, 1).multiplyScalar(rng.range(0.8, 1.3)));
          lists[rng.int(0, 1)].push(m4.clone());
        }
        if (rng.chance(0.3)) this.hideSpots.push({ x: side * (HW - 0.2), s, r: 0.25, kind: 'cress' });
      }
    }
    geos.forEach((g, i) => {
      const im = new THREE.InstancedMesh(g, mat, lists[i].length);
      lists[i].forEach((m, k) => im.setMatrixAt(k, m));
      im.computeBoundingSphere();
      im.castShadow = true;
      im.receiveShadow = true;
      this.group.add(im);
    });
  }

  // ───── 落ち葉 ─────
  buildLeaves() {
    const rng = this.rng;
    const tex = leafAtlas();
    const g = new THREE.PlaneGeometry(0.07, 0.07, 2, 2);
    g.rotateX(-Math.PI / 2);
    // 少し丸まる
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) p.setY(i, Math.abs(p.getX(i)) * 0.25);
    g.computeVertexNormals();
    const mat = patchMaterial(new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.6 }), {
      fx: {
        key: 'leaf',
        vdecl: 'attribute vec2 aTile;',
        vcode: '',
      },
    });
    // どの葉の絵を使うかは uv をずらして
    mat.onBeforeCompile = ((orig) => (sh) => {
      orig(sh);
      sh.vertexShader = sh.vertexShader.replace('#include <uv_vertex>', `#include <uv_vertex>
        #ifdef USE_INSTANCING
          float tile = floor(fract(instanceMatrix[3].x * 7.3 + instanceMatrix[3].z * 3.1) * 8.0);
          vMapUv = (uv + vec2(mod(tile, 4.0), floor(tile / 4.0))) * vec2(0.25, 0.5);
        #endif`);
    })(mat.onBeforeCompile);
    const list = [];
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
    for (let s = S_GRATE; s < S_FAR - 2; s += 0.07) {
      if (!rng.chance(0.45)) continue;
      // 壁ぎわ・水草の下・段の手前にたまる
      const edge = rng.chance(0.6);
      const x = edge ? (rng.chance(0.5) ? 1 : -1) * (HW - rng.range(0.02, 0.2)) : rng.range(-HW + 0.05, HW - 0.05);
      q.setFromEuler(new THREE.Euler(rng.range(-0.3, 0.3), rng.range(0, 6.28), rng.range(-0.3, 0.3)));
      m4.compose(V3(x, bedAt(x, s) + 0.004, -s), q, V3(1, 1, 1).multiplyScalar(rng.range(0.6, 1.4)));
      list.push(m4.clone());
    }
    const im = new THREE.InstancedMesh(g, mat, list.length);
    list.forEach((m, i) => im.setMatrixAt(i, m));
    im.computeBoundingSphere();
    im.receiveShadow = true;
    this.group.add(im);
  }

  // ───── 石 ─────
  buildStones() {
    const rng = this.rng;
    const base = mergeVertices(new THREE.IcosahedronGeometry(1, 3).deleteAttribute('normal').deleteAttribute('uv'));
    const p = base.attributes.position;
    const variants = [0, 1, 2].map((v) => {
      const g = base.clone();
      const pp = g.attributes.position;
      const r = new RNG(900 + v);
      const f = [r.range(0.8, 1.3), r.range(0.45, 0.7), r.range(0.8, 1.2)];
      for (let i = 0; i < pp.count; i++) {
        const x = pp.getX(i), y = pp.getY(i), z = pp.getZ(i);
        const n = 1 + 0.12 * Math.sin(x * 3.1 + v) * Math.cos(z * 2.7) + 0.08 * Math.sin(y * 5 + x * 2);
        pp.setXYZ(i, x * f[0] * n, Math.max(y, -0.35) * f[1] * n, z * f[2] * n);
      }
      g.computeVertexNormals();
      return g;
    });
    void p;
    const mat = patchMaterial(new THREE.MeshStandardMaterial({ color: '#4c4840', roughness: 0.7 }), {
      fx: {
        key: 'stone',
        color: /* glsl */ `
          diffuseColor.rgb *= 0.6 + 0.5 * un_vn(vWPos.xz * 40.0 + vWPos.y * 30.0);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.1, 0.13, 0.05), smoothstep(0.4, 0.8, un_fbm(vWPos.xz * 18.0)) * 0.6);
        `,
        rough: 'roughnessFactor = 0.4;',
      },
    });
    const lists = [[], [], []];
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
    for (let s = S_GRATE; s < S_FAR - 2; s += 0.25) {
      if (!rng.chance(0.4)) continue;
      const x = rng.range(-HW + 0.06, HW - 0.06);
      const r = rng.chance(0.15) ? rng.range(0.05, 0.1) : rng.range(0.015, 0.04);
      q.setFromEuler(new THREE.Euler(0, rng.range(0, 6.28), 0));
      m4.compose(V3(x, bedAt(x, s) - r * 0.1, -s), q, V3(r, r, r));
      lists[rng.int(0, 2)].push(m4.clone());
      if (r > 0.07) this.hideSpots.push({ x, s, r: 0.15, kind: 'stone' });
    }
    variants.forEach((g, i) => {
      const im = new THREE.InstancedMesh(g, mat, lists[i].length);
      lists[i].forEach((m, k) => im.setMatrixAt(k, m));
      im.computeBoundingSphere();
      im.castShadow = true;
      im.receiveShadow = true;
      this.group.add(im);
    });
    // 落ち込みの下・パイプの下の隠れ場所
    for (const d of DROPS) this.hideSpots.push({ x: 0, s: d.s - 0.6, r: 0.5, kind: 'pool' });
    for (const pp of PIPES) this.hideSpots.push({ x: pp.side * (HW - 0.2), s: pp.s, r: 0.3, kind: 'pipe' });
  }

  // ───── 水抜き穴のシダ・コケ ─────
  buildFerns(mat) {
    const rng = this.rng;
    const B = new Blades();
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * Math.PI * 2;
      const L = rng.range(0.08, 0.15);
      const dir = V3(Math.cos(a) * 0.5, Math.sin(a), 0.6).normalize();
      const pts = [];
      for (let j = 0; j <= 4; j++) { const t = j / 4; pts.push(V3(dir.x * L * t, dir.y * L * t - 0.03 * t * t, dir.z * L * t)); }
      B.strip(pts, (t) => 0.018 * Math.sin((t * 0.85 + 0.1) * Math.PI), V3(0, 0, 1).cross(dir).normalize(), () => [0.08, 0.2, 0.05]);
    }
    const geo = B.build();
    const holes = weepHoles().filter(() => rng.chance(0.35));
    const im = new THREE.InstancedMesh(geo, mat, holes.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
    holes.forEach((h, i) => {
      q.setFromAxisAngle(V3(0, 1, 0), h.side > 0 ? -Math.PI / 2 : Math.PI / 2);
      m4.compose(V3(h.side * (HW - 0.01), h.y - 0.02, -h.s), q, V3(1, 1, 1).multiplyScalar(rng.range(0.7, 1.3)));
      im.setMatrixAt(i, m4);
    });
    im.computeBoundingSphere();
    this.group.add(im);
  }

  /** 近くの隠れ場所 */
  nearestHide(x, s, maxD = 1.5) {
    let best = null, bd = maxD;
    for (const h of this.hideSpots) {
      const d = Math.hypot(h.x - x, h.s - s);
      if (d < bd) { bd = d; best = h; }
    }
    return best;
  }
}
