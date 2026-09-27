// 側溝のまわりの夏の夜の景色
// ・農道（砂利）・田んぼ側の草の土手と畦・横切る舗装道路
// ・稲（近くは 1 株ずつの葉、少し先は板、遠くは上から見た稲の面）
// ・電柱と電線・防犯灯・自販機
// ・遠く: 東の集落の家の灯り、西の鎮守の森、北の山並み、南の川の堤防と研究所の灯り、町の灯り、ときどき通る車
// ・ホタル（田んぼと草の上をゆっくり光る）、ライトの中を飛ぶ小さな虫、街灯に集まる虫
import * as THREE from 'three';
import { U, patchMaterial } from './shade.js';
import { PT } from './water.js';
import { Glow } from './glow.js';
import { riceCard } from './textures.js';
import { HW, WALL_T, S_GRATE, S_FAR, CULVERT, ROAD2, groundAt, humpAt } from './ditch.js';
import { RNG, clamp, lerp, smoothstep, makeNoise2D } from './core/noise.js';

const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const N2 = makeNoise2D(771);
const X_IN = HW + WALL_T;         // 壁の外側
const ROAD_W = 3.1;                // 農道の幅
const RD = { x0: -(X_IN + ROAD_W), x1: -X_IN };
const R2 = { s0: ROAD2.s - ROAD2.w / 2, s1: ROAD2.s + ROAD2.w / 2 };
export const POLES_X = -(X_IN + ROAD_W + 0.35);
export const LAMP_POST = { s: 63.6 };
export const VENDING = { s: 67.2, x: -(X_IN + ROAD_W + 1.5) };

/** 田んぼ（水を張った面）の高さの下げ幅 */
const PADDY_DROP = 0.27;
// 田んぼの区画（畦で区切る）: 右 = 東、左 = 西
function fieldEdge(x, s) {
  // 畦の中心線からの距離（区画は s 方向 32m、x 方向 30m）
  const fs = ((s + 18) % 32 + 32) % 32, ds = Math.min(fs, 32 - fs);
  const ax = Math.abs(x);
  const fx = ((ax - 1.7) % 30 + 30) % 30, dx = Math.min(fx, 30 - fx);
  return Math.min(ds, dx);
}

/** 地面の高さと種類（road: 砂利, grass: 草, paddy: 田, asphalt: 舗装） */
export function terrainAt(x, s, out = {}) {
  const g = groundAt(s);
  const ax = Math.abs(x);
  const hump = humpAt(s);
  let y = g, kind = 'grass';
  const onR2 = s > R2.s0 - 0.3 && s < R2.s1 + 0.3;
  if (onR2) {
    const e = 1 - smoothstep(R2.s1 - 0.1, R2.s1 + 0.3, s) * 1 - smoothstep(R2.s0 + 0.1, R2.s0 - 0.3, s);
    y = g + hump + 0.03;
    kind = e > 0.5 ? 'asphalt' : 'grass';
  } else if (x < 0) {
    if (x > RD.x0) { y = g + 0.02 + hump + 0.015 * (1 - ((x - (RD.x0 + RD.x1) / 2) / (ROAD_W / 2)) ** 2); kind = 'road'; }
    else if (x > RD.x0 - 0.55) { y = g - 0.03 + hump * 0.5; kind = 'grass'; }
    else {
      const t = smoothstep(RD.x0 - 0.55, RD.x0 - 0.95, x);
      y = lerp(g - 0.04, g - PADDY_DROP, t);
      kind = t > 0.5 ? 'paddy' : 'grass';
    }
  } else {
    if (ax < 1.3) { y = g + 0.01 + N2(x * 3, s * 3) * 0.015; kind = 'grass'; }
    else if (ax < 1.62) { y = g + 0.035; kind = 'grass'; }
    else {
      const t = smoothstep(1.62, 1.95, ax);
      y = lerp(g + 0.03, g - PADDY_DROP, t);
      kind = t > 0.5 ? 'paddy' : 'grass';
    }
  }
  // 田んぼの中の畦
  if (kind === 'paddy') {
    const e = fieldEdge(x, s);
    const lev = 1 - smoothstep(0.22, 0.45, e);
    y = lerp(y, g - 0.02, lev);
    if (lev > 0.5) kind = 'grass';
  }
  out.y = y; out.kind = kind;
  return out;
}

export class Scenery {
  constructor(scene, world, overlay) {
    this.scene = scene;
    this.world = world;
    this.overlay = overlay || scene;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.t = 0;
  }

  async build(progress) {
    const p = progress || (() => {});
    p(0.05, '田んぼを耕しています');
    await tick();
    this.buildTerrain();
    this.buildFarGround();
    p(0.25, '稲を植えています');
    await tick();
    this.buildRice();
    p(0.55, '電柱を立てています');
    await tick();
    this.buildPoles();
    this.buildStreetLamp();
    this.buildVending();
    p(0.7, '遠くの家に灯りをともしています');
    await tick();
    this.buildDistant();
    p(0.85, 'ホタルを放しています');
    await tick();
    this.buildFireflies();
    p(1, '');
  }

  // ───── 地面 ─────
  buildTerrain() {
    // 列: 壁の外から、近いほど細かく
    const colsR = [], colsL = [];
    const push = (arr, from, to, step) => { for (let x = from; x < to - 1e-6; x += step) arr.push(x); };
    push(colsR, X_IN, 3, 0.1); push(colsR, 3, 12, 0.4); push(colsR, 12, 60, 2); colsR.push(60);
    push(colsL, X_IN, 6, 0.1); push(colsL, 6, 12, 0.4); push(colsL, 12, 60, 2); colsL.push(60);
    const rows = [];
    for (let s = -40; s <= 140; s += s > R2.s0 - 4 && s < R2.s1 + 4 ? 0.2 : 0.5) rows.push(s);
    const build = (cols, sign) => {
      const pos = [], kinds = [], idx = [];
      const o = {};
      for (const s of rows) for (const cx of cols) {
        const x = sign * cx;
        terrainAt(x, s, o);
        pos.push(x, o.y, -s);
        kinds.push(o.kind === 'road' ? 1 : 0, o.kind === 'grass' ? 1 : 0, o.kind === 'paddy' ? 1 : 0, o.kind === 'asphalt' ? 1 : 0);
      }
      const C = cols.length;
      for (let r = 0; r < rows.length - 1; r++) for (let i = 0; i < C - 1; i++) {
        const a = r * C + i, b = a + 1, c = a + C, d = c + 1;
        if (sign > 0) idx.push(a, b, c, b, d, c); else idx.push(a, c, b, b, c, d);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('aKind', new THREE.Float32BufferAttribute(kinds, 4));
      g.setIndex(idx);
      g.computeVertexNormals();
      return g;
    };
    const mat = patchMaterial(new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.92 }), {
      water: false,
      fx: {
        key: 'terrain',
        vdecl: 'attribute vec4 aKind; varying vec4 vKind;',
        vcode: 'vKind = aKind;',
        decl: 'varying vec4 vKind; float tWet;',
        color: /* glsl */ `
          {
            vec2 p = vWPos.xz;
            float n1 = un_fbm(p * 1.3), n2 = un_vn(p * 23.0), n3 = un_vn(p * 71.0);
            // 砂利道: 灰色の小石、真ん中は草が残る
            vec3 road = vec3(0.3, 0.29, 0.27) * (0.75 + n2 * 0.35 + n3 * 0.25);
            float mid = 1.0 - smoothstep(0.15, 0.4, abs(vWPos.x - ${((RD.x0 + RD.x1) / 2).toFixed(2)}));
            road = mix(road, vec3(0.1, 0.14, 0.05) * (0.7 + n2 * 0.6), mid * smoothstep(0.4, 0.6, n1) * 0.8);
            // 轍
            float rut = 1.0 - smoothstep(0.08, 0.2, abs(abs(vWPos.x - ${((RD.x0 + RD.x1) / 2).toFixed(2)}) - 0.75));
            road *= 1.0 - rut * 0.15;
            vec3 grass = mix(vec3(0.07, 0.12, 0.035), vec3(0.14, 0.2, 0.06), n1) * (0.7 + n3 * 0.5);
            vec3 paddy = mix(vec3(0.05, 0.05, 0.035), vec3(0.08, 0.1, 0.05), n1);
            vec3 asph = vec3(0.09, 0.09, 0.095) * (0.8 + n3 * 0.35);
            // 舗装のひび
            asph *= 1.0 - smoothstep(0.02, 0.0, abs(un_vn(p * 3.0) - 0.5)) * 0.4;
            vec4 k = vKind / max(dot(vKind, vec4(1.0)), 1e-3);
            diffuseColor.rgb = road * k.x + grass * k.y + paddy * k.z + asph * k.w;
            tWet = k.z;
          }
        `,
        rough: 'roughnessFactor = mix(roughnessFactor, 0.25, tWet);',
      },
    });
    for (const sign of [1, -1]) {
      const m = new THREE.Mesh(build(sign > 0 ? colsR : colsL, sign), mat);
      m.receiveShadow = true;
      this.group.add(m);
    }
    this.terrainMat = mat;
  }

  /** 遠くの地面（田んぼの面。上から見たときの稲の色） */
  buildFarGround() {
    const g = new THREE.RingGeometry(55, 3200, 64, 8);
    g.rotateX(-Math.PI / 2);
    const mat = patchMaterial(new THREE.MeshStandardMaterial({ color: '#0e150a', roughness: 1 }), {
      water: false,
      fx: { key: 'far', color: 'diffuseColor.rgb *= 0.7 + 0.5 * un_fbm(vWPos.xz * 0.05) + 0.2 * un_vn(vWPos.xz * 0.6);' },
    });
    const m = new THREE.Mesh(g, mat);
    m.position.set(0, groundAt(50) - PADDY_DROP + 0.55, -50);
    this.group.add(m);
    // 近くの稲の外側の、上から見た稲の面（道・土手から見下ろしたとき用）
    const canopy = patchMaterial(new THREE.MeshStandardMaterial({ color: '#1b2c10', roughness: 0.9 }), {
      water: false,
      fx: { key: 'canopy', color: 'diffuseColor.rgb *= 0.55 + 0.6 * un_vn(vWPos.xz * 7.0) * un_vn(vWPos.xz * 2.3 + 3.0) + 0.2 * un_fbm(vWPos.xz * 0.3);' },
    });
    for (const [x0, x1] of [[24, 60], [-60, -24]]) {
      const pg = new THREE.PlaneGeometry(x1 - x0, 180, 1, 1);
      pg.rotateX(-Math.PI / 2);
      const pm = new THREE.Mesh(pg, canopy);
      pm.position.set((x0 + x1) / 2, groundAt(50) - PADDY_DROP + 0.62, -50);
      this.group.add(pm);
    }
  }

  // ───── 稲 ─────
  buildRice() {
    const rng = new RNG(12);
    // 1 株のかたち: 細い葉が 10 枚、外へ反る
    const leafGeo = () => {
      const pos = [], col = [], idx = [];
      const r2 = new RNG(5);
      for (let k = 0; k < 11; k++) {
        const a = (k / 11) * Math.PI * 2 + r2.range(-0.3, 0.3);
        const lean = r2.range(0.25, 0.75);
        const h = r2.range(0.55, 0.82);
        const w = r2.range(0.009, 0.013);
        const twist = r2.range(-0.4, 0.4);
        const segs = 4;
        const base = pos.length / 3;
        const dx = Math.cos(a), dz = Math.sin(a);
        const px = -dz, pz = dx;
        for (let j = 0; j <= segs; j++) {
          const t = j / segs;
          const out = lean * h * t * t * 0.9 + 0.012;
          const y = h * (t - lean * 0.35 * t * t * t);
          const ww = w * (1 - t * 0.85) * (j === segs ? 0.1 : 1);
          const cx = dx * out, cz = dz * out;
          const tw = twist * t;
          const qx = px * Math.cos(tw) - dx * Math.sin(tw) * 0.3, qz = pz * Math.cos(tw) - dz * Math.sin(tw) * 0.3;
          pos.push(cx - qx * ww, y, cz - qz * ww, cx + qx * ww, y, cz + qz * ww);
          const c = [lerp(0.1, 0.34, t), lerp(0.2, 0.46, t), lerp(0.04, 0.1, t)];
          col.push(...c, ...c);
        }
        for (let j = 0; j < segs; j++) {
          const i = base + j * 2;
          idx.push(i, i + 1, i + 2, i + 1, i + 3, i + 2);
        }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      g.setIndex(idx);
      g.computeVertexNormals();
      return g;
    };
    const geo = leafGeo();
    const riceFx = {
      key: 'rice',
      vcode: /* glsl */ `
        {
          // 風でゆれる（先ほど大きく）
          vec3 ip = vec3(0.0);
          #ifdef USE_INSTANCING
            ip = instanceMatrix[3].xyz;
          #endif
          float k = transformed.y * transformed.y;
          transformed.x += sin(uTime * 1.3 + ip.z * 0.4 + ip.x * 0.2) * 0.03 * k;
          transformed.z += cos(uTime * 1.1 + ip.x * 0.3) * 0.02 * k;
        }
      `,
      light: /* glsl */ `
        {
          // 葉の先の露がライトできらめく
          float d = length(vWPos - uLampPos);
          float cone = lampCone(vWPos);
          float sp = step(0.985, un_h21(floor(vWPos.xz * 90.0) + floor(vWPos.y * 40.0)));
          reflectedLight.directSpecular += vec3(0.9, 0.95, 1.0) * sp * cone * uLampI / (d * d + 0.3) * 0.02;
        }
      `,
    };
    const mat = patchMaterial(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, side: THREE.DoubleSide }), { water: false, fx: riceFx });
    // 近くの株（区画ごとに 12m ずつ分けて、見えない所は描かない）
    const o = {};
    const chunks = new Map();
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = V3();
    const plant = (x, s) => {
      terrainAt(x, s, o);
      if (o.kind !== 'paddy') return;
      const key = Math.floor(s / 12);
      if (!chunks.has(key)) chunks.set(key, []);
      q.setFromAxisAngle(V3(0, 1, 0), rng.range(0, 6.28));
      const k = rng.range(0.85, 1.12);
      sc.set(k, rng.range(0.88, 1.1), k);
      m4.compose(V3(x + rng.range(-0.02, 0.02), o.y - 0.01, -s), q, sc);
      chunks.get(key).push(m4.clone());
    };
    for (const [a, b] of [[1.95, 7.5], [-10.5, RD.x0 - 0.95]]) {
      for (let x = Math.min(a, b); x < Math.max(a, b); x += 0.3) {
        for (let s = -30; s < 132; s += 0.2 + rng.range(-0.01, 0.01)) plant(x, s);
      }
    }
    this.riceChunks = [];
    for (const [key, list] of chunks) {
      const im = new THREE.InstancedMesh(geo, mat, list.length);
      list.forEach((mm, i) => im.setMatrixAt(i, mm));
      im.computeBoundingSphere();
      im.receiveShadow = true;
      im.userData.s = key * 12 + 6;
      this.group.add(im);
      this.riceChunks.push(im);
    }
    // 少し先: 稲の板（十字に組んだ 2 枚）
    const card = new THREE.PlaneGeometry(1.1, 0.8);
    card.translate(0, 0.4, 0);
    const card2 = card.clone().rotateY(Math.PI / 2);
    const cardGeo = new THREE.BufferGeometry();
    {
      const a = card.toNonIndexed(), b = card2.toNonIndexed();
      const pos = new Float32Array([...a.attributes.position.array, ...b.attributes.position.array]);
      const uv = new Float32Array([...a.attributes.uv.array, ...b.attributes.uv.array]);
      const nrm = new Float32Array([...a.attributes.normal.array, ...b.attributes.normal.array]);
      cardGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      cardGeo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      cardGeo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
    }
    const cmat = patchMaterial(new THREE.MeshStandardMaterial({ map: riceCard(), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.7, color: '#b8c8a0' }), { water: false, fx: { key: 'riceCard', vcode: riceFx.vcode } });
    const cards = [];
    for (const [a, b] of [[7.5, 26], [-26, -10.5]]) {
      for (let x = Math.min(a, b); x < Math.max(a, b); x += 0.6) {
        for (let s = -30; s < 132; s += 0.9) {
          const xx = x + rng.range(-0.1, 0.1), ss = s + rng.range(-0.2, 0.2);
          terrainAt(xx, ss, o);
          if (o.kind !== 'paddy') continue;
          q.setFromAxisAngle(V3(0, 1, 0), rng.range(-0.3, 0.3));
          m4.compose(V3(xx, o.y - 0.02, -ss), q, V3(1, rng.range(0.85, 1.1), 1));
          cards.push(m4.clone());
        }
      }
    }
    const ci = new THREE.InstancedMesh(cardGeo, cmat, cards.length);
    cards.forEach((mm, i) => ci.setMatrixAt(i, mm));
    ci.computeBoundingSphere();
    this.group.add(ci);
  }

  // ───── 電柱と電線 ─────
  buildPoles() {
    const conc = patchMaterial(new THREE.MeshStandardMaterial({ color: '#77756e', roughness: 0.85 }), { water: false });
    const steel = patchMaterial(new THREE.MeshStandardMaterial({ color: '#4d4c48', roughness: 0.6, metalness: 0.5 }), { water: false });
    const insul = patchMaterial(new THREE.MeshStandardMaterial({ color: '#a8a39a', roughness: 0.3 }), { water: false });
    const H = 10;
    const tops = [];
    for (let s = -58; s < 180; s += 32) {
      const g = groundAt(Math.min(Math.max(s, -5), 120));
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, H, 12), conc);
      pole.position.set(POLES_X, g + H / 2 - 0.1, -s);
      pole.castShadow = true;
      this.group.add(pole);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.08, 0.08), steel);
      arm.position.set(POLES_X, g + H - 0.6, -s);
      this.group.add(arm);
      const pts = [];
      for (const dx of [-0.8, 0, 0.8]) {
        const ins = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.14, 8), insul);
        ins.position.set(POLES_X + dx, g + H - 0.49, -s);
        this.group.add(ins);
        pts.push(V3(POLES_X + dx, g + H - 0.42, -s));
      }
      pts.push(V3(POLES_X + 0.15, g + H - 2.6, -s));   // 電話線
      // 足場ボルト
      for (let k = 0; k < 10; k++) {
        const b = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.24, 5), steel);
        b.rotation.z = Math.PI / 2;
        b.rotation.y = (k % 2) * Math.PI / 2;
        b.position.set(POLES_X, g + 2.2 + k * 0.45, -s);
        this.group.add(b);
      }
      tops.push(pts);
    }
    // 電線（たるみ）
    const lineMat = new THREE.LineBasicMaterial({ color: '#07080a' });
    for (let i = 0; i < tops.length - 1; i++) {
      for (let k = 0; k < 4; k++) {
        const a = tops[i][k], b = tops[i + 1][k];
        const pts = [];
        for (let j = 0; j <= 16; j++) {
          const t = j / 16;
          pts.push(a.clone().lerp(b, t).add(V3(0, -4 * t * (1 - t) * (k === 3 ? 0.55 : 0.4), 0)));
        }
        this.group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lineMat));
      }
    }
  }

  // ───── 防犯灯（横切る道の角） ─────
  buildStreetLamp() {
    const s = LAMP_POST.s;
    const g = groundAt(s);
    const conc = patchMaterial(new THREE.MeshStandardMaterial({ color: '#8a877f', roughness: 0.8 }), { water: false });
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.13, 7, 10), conc);
    pole.position.set(POLES_X - 0.3, g + 3.4, -s);
    this.group.add(pole);
    const armMat = patchMaterial(new THREE.MeshStandardMaterial({ color: '#b9b8b2', roughness: 0.5, metalness: 0.4 }), { water: false });
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.3, 8), armMat);
    arm.rotation.z = Math.PI / 2 - 0.2;
    arm.position.set(POLES_X + 0.3, g + 5.25, -s);
    this.group.add(arm);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.07, 0.2), armMat);
    const hx = POLES_X + 0.95, hy = g + 5.35;
    head.position.set(hx, hy, -s);
    this.group.add(head);
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.15), new THREE.MeshBasicMaterial({ color: new THREE.Color(9, 9.4, 10) }));
    panel.rotation.x = Math.PI / 2;
    panel.position.set(hx, hy - 0.04, -s);
    this.group.add(panel);
    const light = new THREE.SpotLight('#e9efff', 70, 22, 1.05, 0.85, 2);
    light.position.set(hx, hy - 0.05, -s);
    light.target.position.set(hx + 0.4, 0, -s);
    this.group.add(light, light.target);
    this.streetLight = light;
    PT.uPtPos.value[0].set(hx, hy - 0.05, -s);
    PT.uPtCol.value[0].set('#dfe8ff').multiplyScalar(1.4);
    this.lampHead = V3(hx, hy - 0.08, -s);
  }

  // ───── 自販機 ─────
  buildVending() {
    const { s, x } = VENDING;
    const g = groundAt(s) - 0.04;
    const grp = new THREE.Group();
    const body = patchMaterial(new THREE.MeshStandardMaterial({ color: '#c9ccd0', roughness: 0.4, metalness: 0.2 }), { water: false });
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.72, 1.83, 1.0), body);
    box.position.set(0, 0.915, 0);
    box.castShadow = true;
    grp.add(box);
    // 正面（光る見本の棚）
    const c = document.createElement('canvas');
    c.width = 256; c.height = 512;
    const gx = c.getContext('2d');
    const grd = gx.createLinearGradient(0, 0, 0, 512);
    grd.addColorStop(0, '#f4f8ff'); grd.addColorStop(1, '#dde8f4');
    gx.fillStyle = grd; gx.fillRect(0, 0, 256, 512);
    const rng = new RNG(4);
    const cols = ['#c8102e', '#1f5fb4', '#f2a900', '#2e8b57', '#6b3a1e', '#e4e4e4', '#0a0a0a', '#ff6f00', '#7b1fa2'];
    for (let row = 0; row < 3; row++) {
      gx.fillStyle = '#9aa4b0'; gx.fillRect(10, 30 + row * 95 + 76, 236, 4);
      for (let k = 0; k < 7; k++) {
        const cx = 22 + k * 32, cy = 30 + row * 95;
        gx.fillStyle = rng.pick(cols);
        const bottle = rng.chance(0.5);
        if (bottle) { gx.fillRect(cx, cy + 10, 20, 64); gx.fillRect(cx + 6, cy, 8, 12); }
        else { gx.fillRect(cx, cy + 22, 20, 52); }
        gx.fillStyle = 'rgba(255,255,255,0.5)'; gx.fillRect(cx + 3, cy + 26, 4, 40);
        gx.fillStyle = '#20252b'; gx.fillRect(cx + 2, cy + 82, 16, 7);
        gx.fillStyle = '#ff3b30'; gx.fillRect(cx + 5, cy + 84, 3, 3);
      }
    }
    gx.fillStyle = '#2a2f36'; gx.fillRect(0, 330, 256, 182);
    gx.fillStyle = '#11151a'; gx.fillRect(60, 430, 136, 60);
    gx.fillStyle = '#6fd3ff'; gx.fillRect(196, 350, 40, 16);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.94, 1.7), new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(2.2, 2.3, 2.5) }));
    face.rotation.y = Math.PI / 2;
    face.position.set(0.365, 0.93, 0);
    grp.add(face);
    // 回収箱
    const bin = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.7, 14), patchMaterial(new THREE.MeshStandardMaterial({ color: '#2d6b3a', roughness: 0.6 }), { water: false }));
    bin.position.set(0.2, 0.35, 0.72);
    grp.add(bin);
    grp.position.set(x, g, -s);
    this.group.add(grp);
    const pl = new THREE.PointLight('#e2eeff', 3.2, 9, 2);
    pl.position.set(x + 0.7, g + 1.1, -s);
    this.group.add(pl);
    PT.uPtPos.value[1].set(x + 0.4, g + 1.0, -s);
    PT.uPtCol.value[1].set('#e8f2ff').multiplyScalar(0.8);
  }

  // ───── 遠くの物 ─────
  buildDistant() {
    const dark = patchMaterial(new THREE.MeshStandardMaterial({ color: '#0b0d10', roughness: 0.9 }), { water: false });
    const wall = patchMaterial(new THREE.MeshStandardMaterial({ color: '#3c3a36', roughness: 0.9 }), { water: false });
    const roofM = patchMaterial(new THREE.MeshStandardMaterial({ color: '#1d2126', roughness: 0.6 }), { water: false });
    const tree = patchMaterial(new THREE.MeshStandardMaterial({ color: '#0a1208', roughness: 1 }), { water: false });
    const winOn = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 2.1, 1.0) });
    const winDim = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.9, 0.6, 0.3) });
    const rng = new RNG(99);
    this.farLights = [];
    // 家
    const house = (x, s, yaw, lit) => {
      const g = groundAt(clamp(s, -5, 118)) - 0.1;
      const w = rng.range(7, 10), d = rng.range(6, 8), h = rng.range(3, 5.5);
      const grp = new THREE.Group();
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wall);
      b.position.y = h / 2;
      grp.add(b);
      const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.01, d * 0.72, w + 1, 4, 1), roofM);
      roof.rotation.set(0, 0, Math.PI / 2);
      roof.rotation.x = Math.PI / 4;
      roof.scale.set(1, 1, 0.55);
      roof.position.y = h + d * 0.2;
      grp.add(roof);
      const nWin = rng.int(1, 3);
      for (let k = 0; k < nWin; k++) {
        const on = lit && rng.chance(0.6);
        const win = new THREE.Mesh(new THREE.PlaneGeometry(rng.range(0.8, 1.6), rng.range(0.7, 1.1)), on ? winOn : winDim);
        win.position.set(rng.range(-w / 3, w / 3), rng.range(1.2, h - 1), d / 2 + 0.01);
        grp.add(win);
        if (on) this.farLights.push({ x: 0, y: 0, z: 0, mesh: win });
      }
      grp.position.set(x, g, -s);
      grp.rotation.y = yaw;
      this.group.add(grp);
      // 屋敷林
      for (let k = 0; k < 4; k++) {
        const r = rng.range(3, 6);
        const t = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), tree);
        t.position.set(x + rng.range(-8, 8), g + r * 1.3, -s - rng.range(6, 14));
        t.scale.y = rng.range(1.1, 1.6);
        this.group.add(t);
      }
    };
    house(62, 44, -Math.PI / 2 + 0.1, true);
    house(75, 58, -Math.PI / 2, true);
    house(68, 74, -Math.PI / 2 - 0.15, false);
    house(95, 50, -Math.PI / 2 + 0.3, true);
    house(88, 86, -Math.PI / 2, true);
    house(-85, 20, Math.PI / 2, false);
    house(-92, 36, Math.PI / 2 + 0.2, true);
    // 鎮守の森（西）
    for (let k = 0; k < 26; k++) {
      const r = rng.range(5, 10);
      const t = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), tree);
      t.position.set(-70 + rng.range(-18, 18), groundAt(110) - 0.3 + r * rng.range(0.9, 1.6), -(112 + rng.range(-14, 14)));
      t.scale.y = rng.range(1.1, 1.8);
      this.group.add(t);
    }
    // 北の山並み
    {
      const pos = [], idx = [];
      const N = 360;
      for (let i = 0; i <= N; i++) {
        const a = -Math.PI * 0.95 + (i / N) * Math.PI * 1.9;
        const R = 2600 + N2(i * 0.05, 3) * 400;
        const x = Math.sin(a) * R, z = -Math.cos(a) * R;
        const north = Math.max(0, Math.cos(a));
        const h = 25 + north * (95 + N2(i * 0.045, 7) * 60 + N2(i * 0.16, 1) * 14) + (1 - north) * (12 + N2(i * 0.12, 2) * 10);
        pos.push(x, -20, z, x, h, z);
      }
      for (let i = 0; i < N; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setIndex(idx);
      g.computeVertexNormals();
      const mm = new THREE.MeshBasicMaterial({ color: '#070a12', side: THREE.DoubleSide, fog: false });
      mm.onBeforeCompile = (sh) => {
        sh.uniforms.uDawn = U.uDawn;
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uDawn;').replace('vec4 diffuseColor = vec4( diffuse, opacity );', 'vec4 diffuseColor = vec4( diffuse * (1.0 + uDawn * 4.0), opacity );');
      };
      const mt = new THREE.Mesh(g, mm);
      mt.renderOrder = -5;
      this.group.add(mt);
    }
    // 南の川の堤防（長い土手）と、その向こうの研究所
    {
      const lev = new THREE.Mesh(new THREE.BoxGeometry(900, 5, 14), dark);
      lev.position.set(0, groundAt(0) - 0.4 + 2.2, 78);
      lev.rotation.y = 0.04;
      this.group.add(lev);
      const lab = new THREE.Group();
      const b1 = new THREE.Mesh(new THREE.BoxGeometry(34, 11, 16), wall);
      b1.position.set(0, 5.5, 0);
      lab.add(b1);
      const b2 = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 14, 16), wall);
      b2.position.set(22, 7, 4);
      lab.add(b2);
      for (let k = 0; k < 7; k++) {
        const on = k % 3 !== 1;
        const w = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.3), on ? new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 2.8, 3.2) }) : winDim);
        w.position.set(-14 + k * 4.4, k % 2 ? 7.8 : 3.8, -8.05);
        w.rotation.y = Math.PI;
        lab.add(w);
      }
      // 屋上の赤い灯
      const red = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(8, 0.4, 0.2) }));
      red.position.set(22, 14.4, 4);
      lab.add(red);
      this.labRed = red;
      lab.position.set(-70, groundAt(0) - 0.4, 190);
      lab.rotation.y = 0.15;
      this.group.add(lab);
    }
    // 遠くの町の灯り・道の街灯（点）
    const pts = [];
    for (let i = 0; i < 160; i++) {
      const a = rng.range(-1.2, 1.2) + Math.PI; // 南寄り
      const R = rng.range(900, 2600);
      pts.push({ x: Math.sin(a) * R, y: rng.range(1, 18), z: -Math.cos(a) * R, c: rng.chance(0.7) ? [1, 0.72, 0.4] : [0.85, 0.9, 1], a: rng.range(0.4, 1.6), tw: rng.range(0, 6) });
    }
    // 遠くの道の街灯の列（東）
    for (let i = 0; i < 18; i++) pts.push({ x: 180 + i * 2, y: 6, z: -(-80 + i * 45), c: [1, 0.78, 0.45], a: 1.4, tw: i });
    this.farPts = pts;
    this.farGlow = new Glow(this.overlay, pts.length + 8);
    pts.forEach((p, i) => this.farGlow.set(i, p.x, p.y, p.z, ...p.c, p.a, 0.8, 1.6));
    this.farGlow.commit();
    // ときどき通る車（東の道を北から南へ）
    this.car = { t: -1, next: 20 };
  }

  // ───── ホタル・虫 ─────
  buildFireflies() {
    this.flies = [];
    const N = 150;
    this.flyGlow = new Glow(this.overlay, N + 80 + 40);
    const rng = (this.rng = new RNG(31));
    for (let i = 0; i < N; i++) this.flies.push(this.newFly(rng, null, true));
    // ライトの中を飛ぶ小さな虫
    this.motes = [];
    for (let i = 0; i < 70; i++) this.motes.push({ p: V3(), v: V3(), big: rng.chance(0.12), ph: rng.range(0, 10), init: false });
    // 街灯に集まる虫
    this.lampBugs = [];
    for (let i = 0; i < 40; i++) this.lampBugs.push({ a: rng.range(0, 6.28), r: rng.range(0.15, 0.9), y: rng.range(-0.6, 0.3), w: rng.range(1.5, 4) * (rng.chance(0.5) ? 1 : -1), ph: rng.range(0, 6) });
  }
  newFly(rng, cam, init = false) {
    const cx = cam ? cam.position.x : 0, cs = cam ? -cam.position.z : 5;
    // 田んぼ・草の上（側溝の中にも少し）
    let x, s;
    const r = rng.next();
    if (r < 0.12) { x = rng.range(-HW, HW); s = cs + rng.range(-6, 22); }
    else if (r < 0.55) { x = rng.range(1.0, 9); s = cs + rng.range(-10, 28); }
    else { x = rng.range(-12, -1); s = cs + rng.range(-10, 28); }
    if (init) s = rng.range(-8, 100);
    const o = terrainAt(x, s);
    const inDitch = Math.abs(x) < HW;
    const y = inDitch ? groundAt(s) - rng.range(0.1, 0.5) : o.y + rng.range(0.15, 1.3);
    return {
      p: V3(x, y, -s), v: V3(rng.range(-0.1, 0.1), 0, rng.range(-0.1, 0.1)),
      period: rng.range(0.75, 1.3), phase: rng.range(0, 1), dur: rng.range(0.16, 0.3), perch: rng.chance(0.3),
      k: rng.range(0.5, 1.3), home: y,
    };
  }

  update(dt, t, cam) {
    this.t = t;
    const rng = this.rng;
    if (!this.flyGlow) return;
    const G = this.flyGlow;
    let n = 0;
    const cs = -cam.position.z;
    // ホタル
    for (const f of this.flies) {
      const s = -f.p.z;
      if (Math.abs(s - cs - 8) > 34 || Math.abs(f.p.x - cam.position.x) > 16) Object.assign(f, this.newFly(rng, cam));
      if (!f.perch) {
        f.v.x += (Math.random() - 0.5) * dt * 0.5; f.v.z += (Math.random() - 0.5) * dt * 0.5;
        f.v.y += ((f.home - f.p.y) * 0.3 + (Math.random() - 0.5) * 0.4) * dt;
        f.v.multiplyScalar(Math.exp(-dt * 0.8));
        const sp = f.v.length();
        if (sp > 0.28) f.v.multiplyScalar(0.28 / sp);
        f.p.addScaledVector(f.v, dt);
      }
      // 光り方: 短く光って、少し休む（ヘイケボタル）
      const ph = ((t / f.period + f.phase) % 1);
      const on = ph < f.dur ? Math.sin((ph / f.dur) * Math.PI) : 0;
      const glow = 0.03 + on;
      G.set(n++, f.p.x, f.p.y, f.p.z, 0.62, 1.0, 0.22, glow * 14 * f.k * (1 - U.uDawn.value * 0.8), 0.014, 2.6);
    }
    // ライトの中の虫（カメラのまわり。円錐の中だけ見える）
    const lp = U.uLampPos.value, ld = U.uLampDir.value;
    for (const m of this.motes) {
      if (!m.init || m.p.distanceTo(cam.position) > 4.5) {
        const d = V3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(0.8).add(ld).normalize();
        m.p.copy(lp).addScaledVector(d, 0.5 + Math.random() * 3.5);
        m.init = true;
      }
      m.ph += dt;
      m.v.x += (Math.sin(m.ph * 3.1 + m.p.y * 7) * 1.4 - m.v.x * 1.5) * dt;
      m.v.y += (Math.cos(m.ph * 2.3 + m.p.x * 5) * 1.0 - m.v.y * 1.5) * dt;
      m.v.z += (Math.sin(m.ph * 2.7 + m.p.z * 6) * 1.4 - m.v.z * 1.5) * dt;
      m.p.addScaledVector(m.v, dt * (m.big ? 0.7 : 1));
      const to = m.p.clone().sub(lp);
      const dist = to.length();
      const c = to.normalize().dot(ld);
      const cone = smoothstep(U.uLampCone.value.x, U.uLampCone.value.y, c);
      const bright = cone * U.uLampI.value / (dist * dist + 0.2) * 0.012;
      G.set(n++, m.p.x, m.p.y, m.p.z, 1, 0.97, 0.9, bright * (m.big ? 1.6 : 1), m.big ? 0.006 : 0.0025, 1.2);
    }
    // 街灯の虫
    if (this.lampHead) {
      const h = this.lampHead;
      for (const b of this.lampBugs) {
        b.a += b.w * dt;
        const x = h.x + Math.cos(b.a) * b.r, z = h.z + Math.sin(b.a) * b.r, y = h.y + b.y + Math.sin(t * 3 + b.ph) * 0.1;
        G.set(n++, x, y, z, 1, 1, 0.95, 0.5, 0.006, 1.2);
      }
    }
    G.commit(n);
    // 遠くの灯りのまたたき・車
    if (this.farGlow) {
      const F = this.farGlow;
      this.farPts.forEach((p, i) => { F.col[i * 4 + 3] = p.a * (0.85 + 0.15 * Math.sin(t * 2 + p.tw)) * (1 - U.uDawn.value * 0.7); });
      const car = this.car;
      const base = this.farPts.length;
      car.next -= dt;
      if (car.t < 0 && car.next <= 0) { car.t = 0; car.dir = Math.random() < 0.5 ? 1 : -1; }
      if (car.t >= 0) {
        car.t += dt / 26;
        const z = lerp(-420, 380, car.dir > 0 ? car.t : 1 - car.t);
        const x = 186;
        for (let k = 0; k < 2; k++) {
          F.set(base + k, x + (k ? 0.8 : -0.8), 1.0, z, 1, 0.95, 0.8, 2.2, 0.4, 2);
          F.set(base + 2 + k, x + (k ? 0.8 : -0.8), 1.0, z + car.dir * 4, 1, 0.1, 0.05, 1.2, 0.3, 1.6);
        }
        if (car.t >= 1) { car.t = -1; car.next = 25 + Math.random() * 40; for (let k = 0; k < 4; k++) F.off(base + k); }
      }
      F.commit(base + 4);
    }
    // 研究所の赤い灯（ゆっくり点滅）
    if (this.labRed) this.labRed.visible = Math.sin(t * 1.6) > -0.2;
    // 見えない稲の区画は描かない
    for (const c of this.riceChunks) c.visible = Math.abs(c.userData.s - cs) < 55;
  }
  setPR(pr) { this.flyGlow?.setPR(pr); this.farGlow?.setPR(pr); }
}

const tick = () => new Promise((r) => setTimeout(r, 0));
export { CULVERT, S_GRATE, S_FAR };
