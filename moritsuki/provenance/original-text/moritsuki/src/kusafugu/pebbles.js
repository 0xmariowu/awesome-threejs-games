// 砂の上の小石（見えるだけ）と、光る物の本体（赤い小石・茶色いガラス・貝殻のかけら）
// ・小石は 2m のマスごとに決まった数だけ（覚えておかず、その場で計算）。主人公のまわり 11m だけ置く
// ・小石まじりの所はびっしり。どこにでも少しは転がっている
// ・光る物は field の decoys をそのまま置く（まちがえてつかんだら、手の中に出てくる物）
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { patchMaterial } from './shade.js';
import { gravelK } from './field.js';

const R = 11, C = 2;
const MAX_P = 5200, MAX_D = 600;

function hash2(i, j, s) {
  let h = (i * 374761393 + j * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// でこぼこの丸い石（平たい）
function pebbleGeo(seed, detail = 1) {
  // 頂点をつないでから法線を求める（つながないと角ばった石になる）
  let g = new THREE.IcosahedronGeometry(1, detail);
  g.deleteAttribute('normal'); g.deleteAttribute('uv');
  g = mergeVertices(g);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const k = 1 + 0.16 * Math.sin(x * 3.1 + seed) * Math.cos(z * 2.7 + seed * 2) + 0.08 * Math.sin(y * 5 + seed * 3);
    p.setXYZ(i, x * k * 1.15, y * k * 0.55, z * k);
  }
  g.computeVertexNormals();
  return g;
}
// ガラスのかけら（角のとれた平たい板）
function glassGeo() {
  const s = new THREE.Shape();
  const n = 7;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2, r = 0.8 + 0.25 * Math.sin(i * 2.3);
    const x = Math.cos(a) * r, y = Math.sin(a) * r * 0.75;
    if (i) s.lineTo(x, y); else s.moveTo(x, y);
  }
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.18, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.1, bevelSegments: 2, curveSegments: 4 });
  g.rotateX(-Math.PI / 2);
  g.center();
  g.computeVertexNormals();
  return g;
}
// 貝殻のかけら（そった薄い板）
function shellGeo() {
  const g = new THREE.SphereGeometry(1, 12, 8, 0, Math.PI * 0.9, 0, Math.PI * 0.4);
  g.rotateX(Math.PI);
  g.scale(1, 0.35, 1);
  g.center();
  g.computeVertexNormals();
  return g;
}

const STONE_COLS = ['#6f6a62', '#8a8276', '#4b4843', '#a39884', '#7a5c4a', '#8f4b3a', '#d7d0c2', '#5d534a', '#9e5a44'];

export class Pebbles {
  constructor(scene) {
    this.scene = scene;
    const stoneMat = patchMaterial(new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.38, metalness: 0 }), { caustics: true, fx: { key: 'pebble', rough: 'roughnessFactor = mix(roughnessFactor, 0.22, smoothstep(0.0, 0.03, uTide - vWPos.y));' } });
    this.stones = new THREE.InstancedMesh(pebbleGeo(1.3, 1), stoneMat, MAX_P);
    this.stones.count = 0;
    this.stones.frustumCulled = false;
    this.stones.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_P * 3), 3);
    scene.add(this.stones);
    // 光る物の本体
    const chertMat = patchMaterial(new THREE.MeshStandardMaterial({ color: '#8e3a2a', roughness: 0.16, metalness: 0 }), { caustics: true });
    const glassMat = patchMaterial(new THREE.MeshPhysicalMaterial({ color: '#6b3c12', roughness: 0.12, metalness: 0, transparent: true, opacity: 0.82, clearcoat: 1 }), { caustics: true });
    const shellMat = patchMaterial(new THREE.MeshStandardMaterial({ color: '#d9b0a0', roughness: 0.25, side: THREE.DoubleSide }), { caustics: true });
    this.dec = {
      chert: new THREE.InstancedMesh(pebbleGeo(4.1, 2), chertMat, MAX_D),
      glass: new THREE.InstancedMesh(glassGeo(), glassMat, MAX_D),
      shell: new THREE.InstancedMesh(shellGeo(), shellMat, MAX_D),
    };
    for (const m of Object.values(this.dec)) { m.count = 0; m.frustumCulled = false; scene.add(m); }
    this.geos = { chert: this.dec.chert.geometry, glass: this.dec.glass.geometry, shell: this.dec.shell.geometry };
    this.mats = { chert: chertMat, glass: glassMat, shell: shellMat };
    this.cx = 1e9; this.cz = 1e9;
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._e = new THREE.Euler(); this._c = new THREE.Color();
  }

  /** 手の中に出す物（まちがえてつかんだ時） */
  makeProp(d) {
    const m = new THREE.Mesh(this.geos[d.type], this.mats[d.type]);
    // 手の中では、少し大きめに見せる（小さすぎて何かわからないので）
    const s = d.size * 0.5 * 1.6;
    m.scale.set(s, s, s);
    return m;
  }

  /** 主人公が 2m 動くたびに置き直す（光る物は毎回。つかまれて消えた物を外すため） */
  update(px, pz, field, groundAt, force = false) {
    const cx = Math.round(px / C) * C, cz = Math.round(pz / C) * C;
    if (force || Math.abs(cx - this.cx) >= C || Math.abs(cz - this.cz) >= C) {
      this.cx = cx; this.cz = cz;
      this.placeStones(px, pz, groundAt);
    }
    this.placeDecoys(px, pz, field, groundAt);
  }

  placeStones(px, pz, groundAt) {
    const M = this._m, q = this._q, e = this._e, col = this._c;
    let n = 0;
    const i0 = Math.floor((px - R) / C), i1 = Math.floor((px + R) / C), j0 = Math.floor((pz - R) / C), j1 = Math.floor((pz + R) / C);
    for (let i = i0; i <= i1 && n < MAX_P; i++) for (let j = j0; j <= j1 && n < MAX_P; j++) {
      const gk = gravelK((i + 0.5) * C, (j + 0.5) * C);
      const cnt = Math.floor(hash2(i, j, 3) * 3 + gk * 70);
      for (let k = 0; k < cnt && n < MAX_P; k++) {
        const x = (i + hash2(i, j, k * 7 + 1)) * C, z = (j + hash2(i, j, k * 11 + 2)) * C;
        if (Math.hypot(x - px, z - pz) > R) continue;
        const g2 = gravelK(x, z);
        if (hash2(i, j, k * 5 + 9) > 0.15 + g2 * 0.85) continue;
        const r = hash2(i, j, k * 13 + 3);
        const s = 0.004 + r * r * 0.02;
        const y = groundAt(x, z);
        e.set((hash2(i, j, k + 4) - 0.5) * 0.4, hash2(i, j, k + 5) * 6.28, (hash2(i, j, k + 6) - 0.5) * 0.4);
        q.setFromEuler(e);
        M.compose(new THREE.Vector3(x, y + s * 0.12, z), q, new THREE.Vector3(s, s, s * (0.7 + hash2(i, j, k + 8) * 0.6)));
        this.stones.setMatrixAt(n, M);
        col.set(STONE_COLS[Math.floor(hash2(i, j, k + 12) * STONE_COLS.length)]);
        col.multiplyScalar(0.8 + hash2(i, j, k + 14) * 0.35);
        this.stones.setColorAt(n, col);
        n++;
      }
    }
    this.stones.count = n;
    this.stones.instanceMatrix.needsUpdate = true;
    this.stones.instanceColor.needsUpdate = true;
  }

  placeDecoys(px, pz, field, groundAt) {
    const M = this._m, q = this._q, up = new THREE.Vector3(0, 1, 0), nv = new THREE.Vector3(), qy = new THREE.Quaternion();
    const cnt = { chert: 0, glass: 0, shell: 0 };
    for (const d of field.around(px, pz, R * 0.8)) {
      if (d.kind !== 'decoy' || !d.alive) continue;
      const m = this.dec[d.type];
      const i = cnt[d.type];
      if (i >= MAX_D) continue;
      // 光る面を、反射の向き（d.n）に合わせて置く
      nv.set(d.n[0], d.n[1], d.n[2]);
      q.setFromUnitVectors(up, nv).multiply(qy.setFromAxisAngle(up, d.yaw));
      const s = d.size * 0.5;
      M.compose(new THREE.Vector3(d.x, groundAt(d.x, d.z) + s * (d.type === 'chert' ? 0.2 : 0.05), d.z), q, new THREE.Vector3(s, s, s));
      m.setMatrixAt(i, M);
      cnt[d.type] = i + 1;
    }
    for (const k in this.dec) { this.dec[k].count = cnt[k]; this.dec[k].instanceMatrix.needsUpdate = true; }
  }
}
