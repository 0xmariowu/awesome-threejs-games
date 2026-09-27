// 夜の南の浜の背景: 松林・砂丘の草・突堤と赤い灯台・東の岬の灯台・沖のアヒル島・町の明かり・浜に置いた荷物とランタン
// （松・草・突堤の形は蛤突きの背景を写して、夜の見え方に合わせた）
import * as THREE from 'three';
import { patchMaterial, U } from './shade.js';
import { RNG, makeNoise2D, makeNoise3D, smoothstep, lerp } from './core/noise.js';
import { GROYNE, GROYNE_X, shoreWarp, riverX } from './beach.js';

const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const tick = () => new Promise((r) => setTimeout(r, 0));

// ───── テクスチャ ─────
function needleTex() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const r = new RNG(3);
  // 房の芯（奥の暗い葉）で隙間を埋める
  for (let k = 0; k < 9; k++) {
    const cx = 128 + r.range(-55, 55), cy = 128 + r.range(-38, 38);
    const gr = g.createRadialGradient(cx, cy, 2, cx, cy, 52);
    gr.addColorStop(0, 'rgba(22,48,22,0.95)');
    gr.addColorStop(0.7, 'rgba(26,54,24,0.8)');
    gr.addColorStop(1, 'rgba(26,54,24,0)');
    g.fillStyle = gr;
    g.beginPath(); g.ellipse(cx, cy, 52, 40, 0, 0, Math.PI * 2); g.fill();
  }
  for (let k = 0; k < 11; k++) {
    const cx = 128 + r.range(-60, 60), cy = 128 + r.range(-45, 45);
    for (let i = 0; i < 120; i++) {
      const a = r.range(0, Math.PI * 2), len = r.range(30, 70);
      const v = r.range(0.6, 1);
      g.strokeStyle = `rgba(${Math.floor(38 * v)},${Math.floor(78 * v)},${Math.floor(36 * v)},0.95)`;
      g.lineWidth = r.range(1.2, 2.4);
      g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * len, cy + Math.sin(a) * len * 0.75); g.stroke();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function grassTex() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const g = c.getContext('2d');
  const r = new RNG(5);
  for (let i = 0; i < 60; i++) {
    const x = 64 + r.range(-40, 40), h = r.range(50, 125), bend = r.range(-25, 25);
    const v = r.range(0.7, 1.1);
    g.strokeStyle = `rgba(${Math.floor(138 * v)},${Math.floor(150 * v)},${Math.floor(72 * v)},1)`;
    g.lineWidth = r.range(1.5, 3);
    g.beginPath(); g.moveTo(x, 128); g.quadraticCurveTo(x + bend * 0.3, 128 - h * 0.6, x + bend, 128 - h); g.stroke();
  }
  // ハマヒルガオの花（ときどき）
  for (let i = 0; i < 3; i++) {
    const x = r.range(20, 108), y = r.range(90, 120);
    g.fillStyle = '#f2b6c8'; g.beginPath(); g.arc(x, y, 6, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#fff4f6'; g.beginPath(); g.arc(x, y, 2, 0, Math.PI * 2); g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function concreteTex() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#a9a69e';
  g.fillRect(0, 0, 256, 256);
  const r = new RNG(8);
  for (let i = 0; i < 2500; i++) {
    const v = r.range(120, 200);
    g.fillStyle = `rgba(${v},${v - 3},${v - 8},0.35)`;
    g.fillRect(r.range(0, 256), r.range(0, 256), r.range(1, 3), r.range(1, 3));
  }
  for (let i = 0; i < 14; i++) {
    g.fillStyle = `rgba(90,80,64,${r.range(0.05, 0.15)})`;
    g.fillRect(r.range(0, 256), 0, r.range(2, 8), 256);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
// ───── 形 ─────
function merge(geos) {
  let n = 0;
  for (const g of geos) n += g.attributes.position.count;
  const pos = new Float32Array(n * 3), nrm = new Float32Array(n * 3), uv = new Float32Array(n * 2);
  const idx = [];
  let o = 0;
  for (const g of geos) {
    const gi = g.index ? g : g;
    pos.set(gi.attributes.position.array, o * 3);
    nrm.set(gi.attributes.normal.array, o * 3);
    if (gi.attributes.uv) uv.set(gi.attributes.uv.array, o * 2);
    if (gi.index) for (const i of gi.index.array) idx.push(i + o);
    else for (let i = 0; i < gi.attributes.position.count; i++) idx.push(i + o);
    o += gi.attributes.position.count;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeBoundingSphere();
  return geo;
}

// 黒松: 海風で陸の方へ傾いた幹と、平たい葉の段
function pineGeo(seed, detail = 1) {
  const r = new RNG(seed);
  const wood = [], leaves = [];
  const H = r.range(7, 11);
  const lean = V3(r.range(-0.2, 0.2), 1, -r.range(0.15, 0.45)).normalize();
  const pts = [V3(0, -0.3, 0)];
  let p = V3(), d = lean.clone();
  for (let k = 1; k <= 8; k++) {
    d.add(V3(r.range(-0.25, 0.25), 0.05, r.range(-0.25, 0.2))).normalize();
    p = p.clone().addScaledVector(d, H / 8);
    pts.push(p);
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  const TS = detail ? 12 : 6, TR = detail ? 7 : 5;
  const trunk = new THREE.TubeGeometry(curve, TS, 0.22, TR, false);
  // 上へ細く
  const tp = trunk.attributes.position;
  for (let i = 0; i < tp.count; i++) {
    const t = Math.floor(i / (TR + 1)) / TS;
    const c = curve.getPoint(Math.min(t, 1));
    const v = V3().fromBufferAttribute(tp, i).sub(c).multiplyScalar(1 - t * 0.7);
    tp.setXYZ(i, c.x + v.x, c.y + v.y, c.z + v.z);
  }
  trunk.computeVertexNormals();
  wood.push(trunk);
  const pads = [];
  const NB = detail ? 10 : 7;
  for (let b = 0; b < NB; b++) {
    const t = r.range(0.4, 0.95);
    const s = curve.getPoint(t);
    const a = b * 2.4 + r.range(0, 1);
    const len = r.range(1.4, 3.0) * (1.25 - t);
    const e = s.clone().add(V3(Math.cos(a) * len, r.range(0.1, 0.6), Math.sin(a) * len));
    if (detail) wood.push(new THREE.TubeGeometry(new THREE.LineCurve3(s, e), 1, 0.07 * (1.2 - t), 4, false));
    pads.push(e);
  }
  pads.push(curve.getPoint(1).add(V3(0, 0.3, 0)), curve.getPoint(0.9).add(V3(r.range(-0.8, 0.8), 0.1, r.range(-0.8, 0.8))));
  for (const c of pads) {
    // 平たい雲のような段: 横に広く、上下に 2 層くらい重ねる
    const R = r.range(1.5, 2.4);
    const NK = detail ? 16 : 9;
    for (let k = 0; k < NK; k++) {
      const a = r.range(0, Math.PI * 2), rad = Math.sqrt(r.next()) * R;
      const q = c.clone().add(V3(Math.cos(a) * rad, r.range(-0.35, 0.45) * (1 - rad / R * 0.5), Math.sin(a) * rad * 0.9));
      const sz = r.range(1.5, 2.4) * (detail ? 1 : 1.45);
      // 水平寄りの葉の板（上から見た平たい段）＋ななめの板
      for (let j = 0; j < 2; j++) {
        const pl = new THREE.PlaneGeometry(sz, sz * 0.7);
        pl.rotateX(-Math.PI / 2 + (j ? 0.9 : 0.25) * (r.next() < 0.5 ? 1 : -1));
        pl.rotateY(r.range(0, Math.PI));
        pl.translate(q.x, q.y, q.z);
        leaves.push(pl);
      }
    }
  }
  return { wood: merge(wood), leaves: merge(leaves) };
}

// 消波ブロック（テトラポッド）
function tetrapodGeo() {
  const legs = [];
  const dirs = [V3(0, 1, 0), V3(0.943, -0.333, 0), V3(-0.471, -0.333, 0.816), V3(-0.471, -0.333, -0.816)];
  for (const d of dirs) {
    const g = new THREE.CylinderGeometry(0.28, 0.5, 1.1, 10, 1);
    g.translate(0, 0.55, 0);
    const cap = new THREE.SphereGeometry(0.28, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2);
    cap.translate(0, 1.1, 0);
    const q = new THREE.Quaternion().setFromUnitVectors(V3(0, 1, 0), d);
    g.applyQuaternion(q); cap.applyQuaternion(q);
    legs.push(g, cap);
  }
  legs.push(new THREE.SphereGeometry(0.52, 12, 10));
  return merge(legs);
}


// ───── 松・草の材質と形（確認ページ dev/hamaguri-assets.html からも使う） ─────
let pineMats = null;
export function pineMaterials() {
  if (pineMats) return pineMats;
  const leafMat = patchMaterial(new THREE.MeshStandardMaterial({ map: needleTex(), alphaTest: 0.35, side: THREE.DoubleSide, roughness: 0.85, color: '#c8d8b0' }), {
    caustics: false,
    fx: {
      key: 'pine',
      vcode: `
        {
          vec3 ip = vec3(0.0);
          #ifdef USE_INSTANCING
            ip = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
          #endif
          float hgt = max(position.y - 2.0, 0.0);
          float ph = uTime * 1.1 + ip.x * 0.21 + ip.z * 0.17;
          transformed.x += sin(ph) * 0.012 * hgt;
          transformed.z += cos(ph * 0.8) * 0.009 * hgt;
        }`,
    },
  });
  const woodMat = patchMaterial(new THREE.MeshStandardMaterial({ color: '#5a4636', roughness: 0.95 }), { caustics: false });
  pineMats = { leafMat, woodMat };
  return pineMats;
}
/** 黒松 1 本（detail = 1: 手前の林、0: 奥の軽い形） */
export function makePine(seed, detail = 1) {
  const { leafMat, woodMat } = pineMaterials();
  const v = pineGeo(seed, detail);
  const g = new THREE.Group();
  g.add(new THREE.Mesh(v.wood, woodMat), new THREE.Mesh(v.leaves, leafMat));
  return g;
}
let grassMat = null;
export function grassMaterial() {
  if (grassMat) return grassMat;
  grassMat = patchMaterial(new THREE.MeshStandardMaterial({ map: grassTex(), alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.9 }), {
    caustics: false,
    fx: {
      key: 'dunegrass',
      vcode: `
        {
          vec3 ip = vec3(0.0);
          #ifdef USE_INSTANCING
            ip = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
          #endif
          float k = max(position.y, 0.0);
          float ph = uTime * 2.3 + ip.x * 0.7 + ip.z * 0.5;
          transformed.x += sin(ph) * 0.06 * k;
          transformed.z += cos(ph * 0.7) * 0.04 * k;
        }`,
    },
  });
  return grassMat;
}
/** 砂丘の草の 1 株（十字に組んだ 2 枚の板） */
export function grassGeo() {
  const pl = new THREE.PlaneGeometry(0.9, 0.55);
  pl.translate(0, 0.27, 0);
  const pl2 = pl.clone().rotateY(Math.PI / 2);
  return merge([pl, pl2]);
}

// ───── 夜の明かり ─────
// やわらかい光の玉（ブルームで光って見える）
let glowTexCache = null;
export function glowTex() {
  if (glowTexCache) return glowTexCache;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.08, 'rgba(255,255,255,0.85)');
  gr.addColorStop(0.25, 'rgba(255,255,255,0.22)');
  gr.addColorStop(0.6, 'rgba(255,255,255,0.05)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 128, 128);
  glowTexCache = new THREE.CanvasTexture(c);
  return glowTexCache;
}
export function glowSprite(color, size, strength = 1) {
  const m = new THREE.SpriteMaterial({ map: glowTex(), color: new THREE.Color(color).multiplyScalar(strength), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false });
  const s = new THREE.Sprite(m);
  s.scale.set(size, size, 1);
  return s;
}

// 遠くの明かりの点（町・岬の家）: 距離で小さくならない、にじんだ点
function lightPoints(list, size = 5) {
  const pos = new Float32Array(list.length * 3), col = new Float32Array(list.length * 3), ph = new Float32Array(list.length);
  list.forEach(([x, y, z, c, k], i) => {
    pos.set([x, y, z], i * 3);
    const cc = new THREE.Color(c).multiplyScalar(k);
    col.set([cc.r, cc.g, cc.b], i * 3);
    ph[i] = Math.random() * 100;
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('aPh', new THREE.BufferAttribute(ph, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: U.uTime, uSize: { value: size } },
    vertexShader: /* glsl */ `
      attribute vec3 color; attribute float aPh; varying vec3 vCol; uniform float uTime; uniform float uSize;
      void main() {
        // 遠い明かりは空気のゆらぎで少しまたたく
        vCol = color * (0.85 + 0.15 * sin(uTime * (1.3 + fract(aPh) * 2.0) + aPh));
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = uSize;
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 vCol;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = exp(-d * d * 60.0) + exp(-d * d * 9.0) * 0.18;
        gl_FragColor = vec4(vCol * a, 1.0);
      }`,
    blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
  });
  const p = new THREE.Points(geo, mat);
  p.frustumCulled = false;
  return p;
}

// 灯台の光の帯（回る）: 根元が明るく先へ消えていく細長い円すい。+z へのびる
function beamMesh(len, rad) {
  const g = new THREE.ConeGeometry(rad, len, 24, 1, true);
  g.translate(0, -len / 2, 0);
  g.rotateX(-Math.PI / 2);
  const m = new THREE.ShaderMaterial({
    uniforms: { uLen: { value: len } },
    vertexShader: `varying vec3 vP; varying vec3 vN; varying vec3 vV; varying float vD; void main(){ vP = position; vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position,1.0); vV = normalize(-mv.xyz); vD = -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform float uLen; varying vec3 vP; varying vec3 vN; varying vec3 vV; varying float vD;
      void main(){
        float t = clamp(vP.z / uLen, 0.0, 1.0);
        float edge = pow(abs(dot(vN, vV)), 1.5);
        // 近くでは消す（光の帯が見る人を包んで、画面全体がちらつかないように）
        float a = (1.0 - t) * (1.0 - t) * edge * 0.12 * smoothstep(150.0, 400.0, vD);
        gl_FragColor = vec4(vec3(1.0, 0.96, 0.85) * a, 1.0);
      }`,
    blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, side: THREE.DoubleSide,
  });
  return new THREE.Mesh(g, m);
}

// 角の丸い箱
export function roundedBox(w, h, d, r) {
  const g = new THREE.BoxGeometry(w, h, d, 6, 6, 6);
  const p = g.attributes.position;
  const hw = w / 2 - r, hh = h / 2 - r, hd = d / 2 - r;
  const v = V3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const c = V3(Math.max(-hw, Math.min(hw, v.x)), Math.max(-hh, Math.min(hh, v.y)), Math.max(-hd, Math.min(hd, v.z)));
    const o = v.clone().sub(c);
    if (o.lengthSq() > 1e-9) o.setLength(r);
    p.setXYZ(i, c.x + o.x, c.y + o.y, c.z + o.z);
  }
  g.computeVertexNormals();
  return g;
}

export class Backdrop {
  constructor(scene, beach) {
    this.scene = scene;
    this.beach = beach;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.blinkers = [];
  }

  async build(progress) {
    this.buildPines();
    progress?.(0.3, '砂丘に草を生やしています');
    await tick();
    this.buildGrass();
    progress?.(0.55, '灯台に火を入れています');
    await tick();
    this.buildGroyne();
    this.buildIsland();
    this.buildLights();
    this.buildCamp();
    progress?.(1, '');
  }

  buildPines() {
    const b = this.beach;
    const { leafMat, woodMat } = pineMaterials();
    const V = 4;
    const vars = [...Array.from({ length: V }, (_, i) => pineGeo(11 + i * 7, 1)), ...Array.from({ length: V }, (_, i) => pineGeo(51 + i * 7, 0))];
    const lists = vars.map(() => []);
    const rng = new RNG(71);
    const n2 = makeNoise2D(9);
    for (let x = -360; x < 360; x += 4.4) {
      for (let z = -170; z < -48; z += 4.4) {
        const px = x + rng.range(-2, 2), pz = z + rng.range(-2, 2);
        const zz = pz - shoreWarp(px);
        if (zz > -52) continue;
        const dens = smoothstep(-52, -75, zz) * (0.55 + 0.45 * (n2(px * 0.02, pz * 0.02) * 0.5 + 0.5));
        if (rng.next() > dens) continue;
        if (Math.abs(px - riverX(pz)) < 9) continue;
        if (Math.abs(px - 14) < 2.5 && pz > -120) continue; // 浜へ下りる小道
        const y = b.heightAt(px, pz);
        const s = rng.range(0.75, 1.25) * (zz > -62 ? 0.8 : 1);
        const far = zz < -95 || Math.abs(px - 14) > 200;
        lists[Math.floor(rng.next() * V) + (far ? V : 0)].push([px, y, pz, s, rng.range(0, Math.PI * 2)]);
      }
    }
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = V3();
    vars.forEach((v, i) => {
      const L = lists[i];
      for (const [geo, mat] of [[v.wood, woodMat], [v.leaves, leafMat]]) {
        const im = new THREE.InstancedMesh(geo, mat, L.length);
        L.forEach(([x, y, z, s, yaw], k) => {
          q.setFromAxisAngle(V3(0, 1, 0), yaw * 0.25 - 0.1);
          im.setMatrixAt(k, m4.compose(V3(x, y, z), q, sc.set(s, s, s)));
        });
        im.castShadow = false;
        im.computeBoundingSphere();
        this.group.add(im);
      }
    });
  }

  buildGrass() {
    const b = this.beach;
    const mat = grassMaterial(), geo = grassGeo();
    const items = [];
    const rng = new RNG(42);
    const n2 = makeNoise2D(17);
    for (let i = 0; i < 16000; i++) {
      const x = rng.range(-240, 240), z = rng.range(-66, -16);
      const zz = z - shoreWarp(x);
      if (zz > -18 || zz < -64) continue;
      const k = smoothstep(-18, -28, zz) * (n2(x * 0.08, z * 0.08) * 0.5 + 0.65);
      if (rng.next() > k) continue;
      if (Math.abs(x - 14) < 1.3) continue;
      if (Math.abs(x - riverX(z)) < 7) continue;
      items.push([x, b.heightAt(x, z) - 0.02, z, rng.range(0.8, 1.6), rng.range(0, 6.28)]);
    }
    const im = new THREE.InstancedMesh(geo, mat, items.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = V3();
    items.forEach(([x, y, z, s, yaw], k) => { q.setFromAxisAngle(V3(0, 1, 0), yaw); im.setMatrixAt(k, m4.compose(V3(x, y, z), q, sc.set(s, s * rng.range(0.7, 1.2), s))); });
    im.computeBoundingSphere();
    this.group.add(im);
  }

  buildGroyne() {
    const G = GROYNE;
    const tex = concreteTex();
    tex.repeat.set(1, 12);
    const mat = patchMaterial(new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }), {
      fx: {
        key: 'concrete',
        color: `
          {
            float wl = vWPos.y - uTide;
            diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.2, 0.26, 0.16), smoothstep(0.5, 0.05, wl) * 0.8);
            diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.28, 0.4, 0.2), smoothstep(0.25, 0.1, abs(wl - 0.2)) * 0.5);
          }`,
      },
    });
    const len = G.z1 - G.z0;
    const top = G.top;
    const box = new THREE.BoxGeometry(G.x1 - G.x0, top + 3, len);
    const m = new THREE.Mesh(box, mat);
    m.position.set(GROYNE_X, top - (top + 3) / 2, (G.z0 + G.z1) / 2);
    this.group.add(m);
    const tg = tetrapodGeo();
    const tm = patchMaterial(new THREE.MeshStandardMaterial({ color: '#a5a298', roughness: 0.92 }), {
      fx: { key: 'tetra', color: `diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.22, 0.26, 0.18), smoothstep(0.4, 0.0, vWPos.y - uTide) * 0.8);` },
    });
    const rng = new RNG(5);
    const items = [];
    for (let z = 14; z < G.z1 + 4; z += 1.7) {
      for (const side of [-1, 1]) {
        for (let k = 0; k < 2; k++) {
          const x = GROYNE_X + side * (2.4 + k * 1.6 + rng.range(-0.3, 0.3));
          const zz = z + rng.range(-0.5, 0.5);
          items.push([x, this.beach.heightAt(x, zz) + 0.6 + k * 0.2, zz]);
        }
      }
    }
    for (let a = 0; a < 12; a++) {
      const x = GROYNE_X + rng.range(-3, 3), z = G.z1 + rng.range(0.5, 3.5);
      items.push([x, this.beach.heightAt(x, z) + 0.6, z]);
    }
    const im = new THREE.InstancedMesh(tg, tm, items.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
    items.forEach(([x, y, z], i) => { q.setFromEuler(new THREE.Euler(rng.range(0, 6), rng.range(0, 6), rng.range(0, 6))); im.setMatrixAt(i, m4.compose(V3(x, y, z), q, V3(0.95, 0.95, 0.95))); });
    im.computeBoundingSphere();
    this.group.add(im);
    // 突堤の先の赤い灯台（小さな灯標）: 4 秒に 1 回、赤く光る
    const tower = new THREE.Group();
    const red = patchMaterial(new THREE.MeshStandardMaterial({ color: '#b8352c', roughness: 0.6 }), { caustics: false });
    const white = patchMaterial(new THREE.MeshStandardMaterial({ color: '#d9d6cf', roughness: 0.7 }), { caustics: false });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.75, 4.2, 20), red);
    body.position.y = 2.1;
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.35, 20), white);
    band.position.y = 3.3;
    const cage = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.6, 12), new THREE.MeshStandardMaterial({ color: '#301412', emissive: '#ff2a1a', emissiveIntensity: 0, roughness: 0.3 }));
    cage.position.y = 4.5;
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.45, 0.4, 16), red);
    cap.position.y = 5.0;
    tower.add(body, band, cage, cap);
    tower.position.set(GROYNE_X, top, G.z1 - 1.2);
    const glow = glowSprite('#ff3a24', 5, 1.6);
    glow.position.set(0, 4.5, 0);
    tower.add(glow);
    this.group.add(tower);
    this.blinkers.push({ mat: cage.material, glow, period: 4, peak: 5 });
  }

  // 沖のアヒル島（銛突きの島）: 夜は黒い影
  buildIsland() {
    const n3 = makeNoise3D(19);
    const geo = new THREE.IcosahedronGeometry(1, 5);
    const p = geo.attributes.position;
    const col = new Float32Array(p.count * 3);
    const c = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      const v = V3().fromBufferAttribute(p, i);
      const d = 1 + n3(v.x * 2.5, v.y * 2.5, v.z * 2.5) * 0.25;
      v.multiplyScalar(d);
      v.y = v.y > 0 ? v.y * 0.4 : v.y * 0.1;
      p.setXYZ(i, v.x * 130, v.y * 110, v.z * 95);
      const h = v.y;
      c.set(h > 0.07 ? '#3f5e32' : h > 0.03 ? '#6d6a5c' : '#8d8778').multiplyScalar(0.85 + n3(v.x * 9, v.y * 9, v.z * 9) * 0.2);
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, patchMaterial(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }), { caustics: false }));
    m.position.set(-820, -6, 1650);
    this.group.add(m);
  }

  // 遠くの明かり: 北の町（松林の向こうの丘）・西の岬の漁村・東の岬の灯台
  buildLights() {
    const b = this.beach;
    const rng = new RNG(808);
    const list = [];
    const warm = ['#ffd9a0', '#ffe7c0', '#ffcf8a', '#fff1d8'];
    for (let i = 0; i < 90; i++) {
      const x = rng.range(-420, 380), z = rng.range(-620, -330);
      const y = b.heightAt(x, z) + rng.range(2, 6);
      list.push([x, y, z, rng.pick(warm), rng.range(0.4, 1.1)]);
    }
    for (let i = 0; i < 26; i++) {
      const z = rng.range(-60, 160), x = -520 + z * 0.3 + rng.range(-40, 30);
      const y = Math.max(b.heightAt(x, z), 0) + rng.range(1.5, 7);
      list.push([x, y, z, rng.pick(warm), rng.range(0.6, 1.3)]);
    }
    for (let i = 0; i < 6; i++) list.push([-470 + i * 9, 3.5, 190 + i * 18, '#fff0d0', 1.4]);
    this.points = lightPoints(list, 5);
    this.group.add(this.points);
    // 東の岬の灯台: 白い塔と、ゆっくり回る光の帯
    const x = 700, z = 180;
    const y = b.heightAt(x, z);
    const lh = new THREE.Group();
    lh.position.set(x, y, z);
    this.lhPos = V3(x, y + 17.5, z);
    const tw = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 3.2, 16, 16), patchMaterial(new THREE.MeshStandardMaterial({ color: '#cfccc4', roughness: 0.8 }), { caustics: false }));
    tw.position.y = 8;
    lh.add(tw);
    const lamp = glowSprite('#fff2d6', 26, 1.2);
    lamp.position.y = 17.5;
    lh.add(lamp);
    this.lhBeam = new THREE.Group();
    this.lhBeam.position.y = 17.5;
    this.lhBeam.add(beamMesh(900, 34));
    lh.add(this.lhBeam);
    this.lhLamp = lamp;
    this.group.add(lh);
  }

  // 浜に置いた荷物: クーラーボックスとランタン（結果の画面はここで）
  buildCamp() {
    const b = this.beach;
    const x = 12, z = -9.5;
    this.campSpot = V3(x, b.heightAt(x, z), z);
    const g = new THREE.Group();
    const cooler = this.makeCooler();
    cooler.position.set(x + 0.62, b.heightAt(x + 0.62, z - 0.3), z - 0.3);
    cooler.rotation.y = 0.25;
    g.add(cooler);
    const lan = this.makeLantern();
    lan.position.set(x - 0.42, b.heightAt(x - 0.42, z - 0.5), z - 0.5);
    g.add(lan);
    this.lantern = lan;
    this.lanternLight = new THREE.PointLight('#ffd8a8', 1.6, 0, 2);
    this.lanternLight.position.copy(lan.position).add(V3(0, 0.14, 0));
    g.add(this.lanternLight);
    this.camp = g;
    this.group.add(g);
  }
  makeCooler() {
    const g = new THREE.Group();
    const blue = patchMaterial(new THREE.MeshStandardMaterial({ color: '#2b6fb3', roughness: 0.45 }), { caustics: false });
    const whiteM = patchMaterial(new THREE.MeshStandardMaterial({ color: '#e9e9e4', roughness: 0.5 }), { caustics: false });
    const W = 0.56, D = 0.34, H = 0.32;
    const body = new THREE.Mesh(roundedBox(W, H, D, 0.03), blue);
    body.position.y = H / 2;
    const lid = new THREE.Mesh(roundedBox(W + 0.02, 0.06, D + 0.02, 0.025), whiteM);
    lid.position.y = H + 0.02;
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.012, 8, 24, Math.PI), whiteM);
    handle.position.set(0, H + 0.05, 0);
    handle.scale.set(1.25, 0.35, 1);
    g.add(body, lid, handle);
    g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    return g;
  }
  makeLantern() {
    const g = new THREE.Group();
    const dark = patchMaterial(new THREE.MeshStandardMaterial({ color: '#2b2f33', roughness: 0.5 }), { caustics: false });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.05, 20), dark);
    base.position.y = 0.025;
    const globe = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.13, 20), new THREE.MeshStandardMaterial({ color: '#fff4e0', emissive: '#ffd49a', emissiveIntensity: 3.2, roughness: 0.3 }));
    globe.position.y = 0.115;
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, 0.035, 20), dark);
    top.position.y = 0.2;
    const hook = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.005, 6, 16), dark);
    hook.position.y = 0.235;
    const glow = glowSprite('#ffcf94', 0.9, 0.9);
    glow.position.y = 0.12;
    g.add(base, globe, top, hook, glow);
    return g;
  }

  update(dt, t, cam) {
    // 灯りは点滅させない（ちらつくと目が疲れる）。赤い灯は、ほんのりとついたまま
    for (const bl of this.blinkers) {
      bl.mat.emissiveIntensity = bl.peak * 0.45;
      bl.glow.material.opacity = 0.5;
      bl.glow.visible = true;
    }
    if (this.lhBeam) {
      // 光の帯は沖の方だけをゆっくり行き来する（浜の方＝こちらへは向けない）
      this.lhBeam.rotation.y = 0.1 + Math.sin(t * 0.12) * 0.6;
      this.lhLamp.material.opacity = 0.6;
      this.lhLamp.scale.set(30, 30, 1);
    }
    void cam;
    void dt;
  }
}
