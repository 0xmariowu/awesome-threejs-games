// 組み立て用の道具: マテリアルごとに頂点を積み、変換行列で置く（UV は m 単位）
import * as THREE from 'three';
import { texMat } from './textures.js';
import { vendingTexture, vendingEmissive } from './vending.js';
import { plateTexture, wireTexture } from './vehicles.js';
import { windowMaterial } from './interior.js';

export class KMesh {
  constructor() { this.p = []; this.n = []; this.uv = []; this.c = []; this.i = []; }
  get count() { return this.p.length / 3; }
}

const _v = new THREE.Vector3(), _n = new THREE.Vector3(), _m3 = new THREE.Matrix3();

export class Kit {
  constructor(mats) {
    this.mats = mats;
    this.m = {};
    this.mat4 = new THREE.Matrix4();
    this.col = new THREE.Color(1, 1, 1);
    this.ck = '';
  }
  // 置く場所の区画（区画ごとにメッシュを分けて、見えない区画を描かない）
  chunk(x, z, size = 70) { this.ck = Math.floor(x / size) + ',' + Math.floor(z / size); return this; }
  at(matrix) { this.mat4.copy(matrix); _m3.getNormalMatrix(matrix); this.nm = _m3.clone(); return this; }
  color(c) { this.col = c instanceof THREE.Color ? c : new THREE.Color(c); return this; }
  mesh(name) { return (this.m[this.ck + '|' + name] ||= new KMesh()); }
  vert(M, x, y, z, nx, ny, nz, u, v) {
    _v.set(x, y, z).applyMatrix4(this.mat4);
    _n.set(nx, ny, nz).applyMatrix3(this.nm || _m3.identity()).normalize();
    M.p.push(_v.x, _v.y, _v.z); M.n.push(_n.x, _n.y, _n.z); M.uv.push(u, v); M.c.push(this.col.r, this.col.g, this.col.b);
    return M.count - 1;
  }
  // 平面の多角形（3 か 4 点、反時計回り=表）。uv は各点の [u, v]（m）
  face(name, pts, uvs) {
    const M = this.mesh(name);
    const [a, b, , d] = pts.length === 4 ? pts : [pts[0], pts[1], pts[2], pts[2]];
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const c3 = pts.length === 4 ? d : pts[2];
    const vx = c3[0] - a[0], vy = c3[1] - a[1], vz = c3[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    const base = M.count;
    pts.forEach((q, k) => this.vert(M, q[0], q[1], q[2], nx, ny, nz, uvs ? uvs[k][0] : 0, uvs ? uvs[k][1] : 0));
    if (pts.length === 4) M.i.push(base, base + 1, base + 2, base, base + 2, base + 3); else M.i.push(base, base + 1, base + 2);
  }
  // 壁などの縦の四角（a→b の水平線分、高さ y0..y1）。外向き = (b-a) の右手側
  wall(name, ax, az, bx, bz, y0, y1, u0 = 0) {
    const L = Math.hypot(bx - ax, bz - az);
    this.face(name, [[ax, y0, az], [bx, y0, bz], [bx, y1, bz], [ax, y1, az]], [[u0, y0], [u0 + L, y0], [u0 + L, y1], [u0, y1]]);
  }
  // 箱（ローカル中心・寸法、UV は m 単位で各面に）
  box(name, cx, cy, cz, sx, sy, sz, faces = 63) {
    const x0 = cx - sx / 2, x1 = cx + sx / 2, y0 = cy - sy / 2, y1 = cy + sy / 2, z0 = cz - sz / 2, z1 = cz + sz / 2;
    const F = [
      [[[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]],
      [[[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]], [[-x1, y0], [-x0, y0], [-x0, y1], [-x1, y1]]],
      [[[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]], [[-z1, y0], [-z0, y0], [-z0, y1], [-z1, y1]]],
      [[[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], [[z0, y0], [z1, y0], [z1, y1], [z0, y1]]],
      [[[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]], [[x0, -z1], [x1, -z1], [x1, -z0], [x0, -z0]]],
      [[[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], [[x0, z0], [x1, z0], [x1, z1], [x0, z1]]],
    ];
    F.forEach(([p, uv], k) => { if (faces & (1 << k)) this.face(name, p, uv); });
  }
  // 既存ジオメトリ（ローカル）を取り込む
  geo(name, g, local = null) {
    const M = this.mesh(name);
    const src = g.index ? g.toNonIndexed() : g;
    const P = src.attributes.position, N = src.attributes.normal, UV = src.attributes.uv;
    const base = M.count;
    const lm = local || null, ln = lm ? new THREE.Matrix3().getNormalMatrix(lm) : null;
    const p = new THREE.Vector3(), n = new THREE.Vector3();
    for (let k = 0; k < P.count; k++) {
      p.fromBufferAttribute(P, k); n.fromBufferAttribute(N, k);
      if (lm) { p.applyMatrix4(lm); n.applyMatrix3(ln); }
      this.vert(M, p.x, p.y, p.z, n.x, n.y, n.z, UV ? UV.getX(k) : 0, UV ? UV.getY(k) : 0);
    }
    for (let k = 0; k < P.count; k++) M.i.push(base + k);
  }
  // 2 点を結ぶ細い棒（手すり・アンテナなど）
  rod(name, a, b, t) {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
    const L = A.distanceTo(B);
    const g = new THREE.BoxGeometry(t, t, L);
    const m = new THREE.Matrix4().lookAt(B, A, new THREE.Vector3(0, 1, 0));
    m.setPosition(A.clone().add(B).multiplyScalar(0.5));
    this.geo(name, g, m);
  }
  cyl(name, x, y, z, r, h, seg = 10, rTop = r) {
    const g = new THREE.CylinderGeometry(rTop, r, h, seg);
    this.geo(name, g, new THREE.Matrix4().setPosition(x, y + h / 2, z));
  }
  meshes() {
    const out = [];
    for (const key in this.m) {
      const M = this.m[key];
      const name = key.split('|')[1];
      if (!M.count) continue;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(M.p, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(M.n, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(M.uv, 2));
      g.setAttribute('color', new THREE.Float32BufferAttribute(M.c, 3));
      g.setIndex(M.count > 65535 ? new THREE.Uint32BufferAttribute(M.i, 1) : new THREE.Uint16BufferAttribute(M.i, 1));
      g.computeBoundingSphere();
      const mat = this.mats[name];
      const mesh = new THREE.Mesh(g, mat);
      mesh.castShadow = !mat.userData.noShadow;
      mesh.receiveShadow = true;
      mesh.name = name;
      out.push(mesh);
    }
    return out;
  }
}

function glowV(m) {
  m.onBeforeCompile = (s) => { s.fragmentShader = s.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n  totalEmissiveRadiance *= vColor.rgb;'); };
  m.customProgramCacheKey = () => 'glowV';
  return m;
}

// 町で使うマテリアル一式（UV は m 単位）
let MATS = null;
export function kitMaterials() {
  if (MATS) return MATS;
  const std = (o) => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, ...o });
  MATS = {
    siding: texMat('siding'),
    mortar: texMat('mortar'),
    wood: texMat('woodBoard'),
    kawara: texMat('kawara', { side: THREE.DoubleSide }),
    // 目印の家のいぶし瓦（銀色のつや）
    ibushi: texMat('ibushi', { side: THREE.DoubleSide, metalness: 0.15 }),
    // 棟・鬼瓦（いぶしの銀色、テクスチャなし）
    ridge: std({ roughness: 0.5, metalness: 0.15 }),
    metalRoof: texMat('metalRoof', { side: THREE.DoubleSide, metalness: 0.35 }),
    concrete: texMat('concrete'),
    block: texMat('block'),
    trim: std({ roughness: 0.55 }),
    metal: std({ roughness: 0.35, metalness: 0.6 }),
    dark: std({ roughness: 0.6 }),
    glass: std({ roughness: 0.05, metalness: 0.1, envMapIntensity: 1.6 }),
    // 建物の窓（奥に部屋が見える。uv = 壁に沿った m・床からの高さ m）
    window: windowMaterial('home'),
    windowShop: windowMaterial('shop'),
    windowOffice: windowMaterial('office'),
    windowLobby: windowMaterial('lobby'),
    plastic: std({ roughness: 0.45 }),
    rubber: std({ roughness: 0.9 }),
    cloth: std({ roughness: 0.95, side: THREE.DoubleSide }),
    paint: std({ roughness: 0.4, metalness: 0.15 }),
    lamp: std({ roughness: 0.3, emissive: new THREE.Color('#fff4d0'), emissiveIntensity: 0.25 }),
    vend: std({ map: vendingTexture(), roughness: 0.3, emissive: new THREE.Color('#ffffff'), emissiveMap: vendingEmissive(), emissiveIntensity: 0.55 }),
    // 頂点色で光る（自販機の見本）
    glowV: glowV(std({ roughness: 0.35, emissive: new THREE.Color('#ffffff'), emissiveIntensity: 0.3 })),
    carPaint: new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.42, metalness: 0.08, clearcoat: 1, clearcoatRoughness: 0.12 }),
    chrome: std({ roughness: 0.16, metalness: 1 }),
    plate: std({ map: plateTexture(), roughness: 0.45 }),
    wire: std({ map: wireTexture(), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.35, metalness: 0.6 }),
  };
  return MATS;
}
