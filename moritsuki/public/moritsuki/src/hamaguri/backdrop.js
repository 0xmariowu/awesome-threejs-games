// 南の浜の背景: 松林・砂丘の草・突堤と消波ブロック・沖のアヒル島・入道雲・浜に置いた荷物
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
function cloudTex(seed) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 512;
  const g = c.getContext('2d');
  const r = new RNG(seed);
  // 入道雲: 下が平らで、上へもくもく盛り上がる
  const blobs = [];
  for (let i = 0; i < 70; i++) {
    const t = r.next();
    const y = 470 - Math.pow(t, 0.8) * 400;
    const w = lerp(210, 70, t) * r.range(0.7, 1.1);
    blobs.push([256 + r.range(-w, w) * 0.8, y, lerp(70, 40, t) * r.range(0.7, 1.3)]);
  }
  blobs.sort((a, b) => a[1] - b[1]);
  for (const [x, y, rad] of blobs) {
    const gr = g.createRadialGradient(x - rad * 0.35, y - rad * 0.4, rad * 0.1, x, y, rad);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.6, 'rgba(240,244,250,1)');
    gr.addColorStop(1, 'rgba(200,212,228,0)');
    g.fillStyle = gr;
    g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2); g.fill();
  }
  // 下のかげり
  const sh = g.createLinearGradient(0, 330, 0, 490);
  sh.addColorStop(0, 'rgba(150,165,190,0)');
  sh.addColorStop(1, 'rgba(150,165,190,0.55)');
  g.globalCompositeOperation = 'source-atop';
  g.fillStyle = sh;
  g.fillRect(0, 0, 512, 512);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
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

export class Backdrop {
  constructor(scene, beach) {
    this.scene = scene;
    this.beach = beach;
    this.group = new THREE.Group();
    scene.add(this.group);
  }

  async build(progress) {
    this.buildPines();
    progress?.(0.3, '砂丘に草を生やしています');
    await tick();
    this.buildGrass();
    progress?.(0.55, '突堤を築いています');
    await tick();
    this.buildGroyne();
    this.buildIsland();
    this.buildClouds();
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
        // 砂丘の前は疎ら、奥は密に。川と道は抜く
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
          // 海風: 幹は陸（-z）の方へ傾いているので、向きは大きく変えない
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
            // 水ぎわの黒ずみと、青のり
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
    m.castShadow = true; m.receiveShadow = true;
    this.group.add(m);
    // 消波ブロック
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
    im.castShadow = true; im.receiveShadow = true;
    im.computeBoundingSphere();
    this.group.add(im);
  }

  // 沖のアヒル島（銛突きの島）
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

  buildClouds() {
    this.clouds = [];
    const rng = new RNG(33);
    const spots = [[-0.55, 2900, 520], [-0.18, 3300, 700], [0.22, 3100, 560], [0.6, 2800, 420], [1.2, 3200, 380], [-1.3, 3000, 330]];
    spots.forEach(([a, dist, h], i) => {
      const mat = new THREE.SpriteMaterial({ map: cloudTex(40 + i), transparent: true, depthWrite: false, fog: false, color: '#ffffff' });
      const s = new THREE.Sprite(mat);
      const size = h * rng.range(1.6, 2.2);
      s.scale.set(size * 1.25, size, 1);
      s.position.set(Math.sin(a) * dist, size * 0.42 - 20, Math.cos(a) * dist);
      s.renderOrder = -5;
      this.group.add(s);
      this.clouds.push(s);
    });
  }

  // 浜に置いた荷物（バケツ・サンダル・タオル）
  makeBucket() {
    const g = new THREE.Group();
    const pts = [];
    for (let i = 0; i <= 12; i++) { const t = i / 12; pts.push(new THREE.Vector2(0.1 + t * 0.03, t * 0.2)); }
    const outer = new THREE.LatheGeometry(pts, 28);
    const mat = patchMaterial(new THREE.MeshStandardMaterial({ color: '#2d7fc8', roughness: 0.45, side: THREE.DoubleSide }), { caustics: false });
    const b = new THREE.Mesh(outer, mat);
    b.castShadow = true;
    const bottom = new THREE.Mesh(new THREE.CircleGeometry(0.1, 24).rotateX(-Math.PI / 2), mat);
    bottom.position.y = 0.004;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.008, 8, 28), mat);
    rim.rotation.x = Math.PI / 2; rim.position.y = 0.2;
    // ツルは縁の少し下の耳（左右）を軸に回り、手前へ倒れている
    const metal = new THREE.MeshStandardMaterial({ color: '#dde2e6', roughness: 0.5 });
    const earY = 0.182, hr = 0.152;
    for (const s of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.026, 0.022), mat);
      ear.position.set(s * 0.136, earY, 0);
      // ツルの端を曲げて耳の穴へ通した所
      const hook = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.026, 8).rotateZ(Math.PI / 2), metal);
      hook.position.set(s * 0.139, earY, 0);
      g.add(ear, hook);
    }
    const handle = new THREE.Group();
    handle.position.y = earY; handle.rotation.x = -1.15;
    const bail = new THREE.Mesh(new THREE.TorusGeometry(hr, 0.004, 6, 32, Math.PI), metal);
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.07, 10).rotateZ(Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#2a2e33', roughness: 0.6 }));
    grip.position.y = hr;
    handle.add(bail, grip);
    // 中の海水
    const water = new THREE.Mesh(new THREE.CircleGeometry(0.12, 24).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#4a8a96', roughness: 0.05, metalness: 0.2 }));
    water.position.y = 0.13;
    g.add(b, bottom, rim, handle, water);
    return g;
  }
  buildCamp() {
    const b = this.beach;
    const x = 12, z = -10;
    const bucket = this.makeBucket();
    bucket.position.set(x - 1.2, b.heightAt(x - 1.2, z + 0.6), z + 0.6);
    this.group.add(bucket);
    // タオル（しましま）
    const c = document.createElement('canvas');
    c.width = 64; c.height = 128;
    const g = c.getContext('2d');
    ['#e8543e', '#f4efe2', '#2f7fb8', '#f4efe2'].forEach((col, i) => { g.fillStyle = col; for (let y = i * 16; y < 128; y += 64) g.fillRect(0, y, 64, 16); });
    const tt = new THREE.CanvasTexture(c); tt.colorSpace = THREE.SRGBColorSpace;
    const tg = new THREE.PlaneGeometry(0.8, 1.6, 8, 16).rotateX(-Math.PI / 2);
    const tp = tg.attributes.position;
    for (let i = 0; i < tp.count; i++) { const px = tp.getX(i) + x - 1.9, pz = tp.getZ(i) + z - 0.3; tp.setY(i, b.heightAt(px, pz) + 0.012 + Math.sin(i * 1.7) * 0.004); tp.setX(i, px); tp.setZ(i, pz); }
    tg.computeVertexNormals();
    const towel = new THREE.Mesh(tg, patchMaterial(new THREE.MeshStandardMaterial({ map: tt, roughness: 0.95 }), { caustics: false }));
    towel.receiveShadow = true;
    this.group.add(towel);
    // ビーチサンダル
    for (const [dx, a] of [[-0.12, 0.2], [0.12, -0.1]]) {
      const s = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.045, 0.02, 16).scale(1, 1, 2.4), patchMaterial(new THREE.MeshStandardMaterial({ color: '#f2c230', roughness: 0.7 }), { caustics: false }));
      s.position.set(x - 0.6 + dx, b.heightAt(x - 0.6 + dx, z - 0.4) + 0.01, z - 0.4);
      s.rotation.y = a;
      s.castShadow = true;
      this.group.add(s);
    }
  }

  update(dt, t, cam) {
    // 雲は遠くでゆっくり流れる（カメラについてくる）
    for (const [i, s] of this.clouds.entries()) {
      if (!s.userData.base) s.userData.base = s.position.clone();
      s.position.set(s.userData.base.x + cam.position.x + Math.sin(t * 0.002 + i) * 40, s.userData.base.y, s.userData.base.z + cam.position.z);
    }
    void dt; void U;
  }
}
