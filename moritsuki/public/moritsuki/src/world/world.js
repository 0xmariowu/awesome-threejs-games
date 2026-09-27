// 世界の組み立て: 地形・海・岩礁・植生・島・拾える獲物・生息地データ
import * as THREE from 'three';
import { Terrain, WORLD_SIZE, PLAY_RADIUS, warpedRadius } from './terrain.js';
import { Water, waveHeight } from './water.js';
import { SkyDome } from './sky.js';
import { GodRays, MarineSnow, Particles } from './effects.js';
import * as D from './decor.js';
import { patchMaterial, U } from '../core/shaderPatch.js';
import { RNG, smoothstep, clamp } from '../core/noise.js';
import { PICKUPS } from '../fish/species.js';
import { ROCK_FX, LEAF_FX } from './surfaces.js';

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const tick = () => new Promise((r) => setTimeout(r, 0));

export class World {
  constructor(scene) {
    this.scene = scene;
    this.rng = new RNG(20260923);
    this.rocks = [];
    this.rockGrid = new Map();
    this.dens = [];
    this.perches = [];
    this.spots = { reef: [], deepreef: [], sand: [], open: [], shallow: [] };
    this.pickups = [];
    this.chunks = [];
    this.lodChunks = []; // 近景・遠景のモデルを持つ区画（拾える獲物）
    this.animated = [];
    this.start = V3(0, 0, 70);
    this.home = V3(0, 0, 0);
  }

  async build(progress = () => {}) {
    const scene = this.scene;
    progress(0.05, '海底を形づくっています');
    await tick();
    this.terrain = new Terrain();
    scene.add(this.terrain.mesh);

    progress(0.18, '海と空を用意しています');
    await tick();
    this.water = new Water(this.terrain);
    scene.add(this.water.mesh);
    this.sky = new SkyDome();
    scene.add(this.sky.mesh);
    this.rays = new GodRays(36);
    scene.add(this.rays.mesh);
    this.snow = new MarineSnow(2600);
    scene.add(this.snow.mesh);
    this.particles = new Particles(1600);
    scene.add(this.particles.mesh);

    progress(0.28, '岩礁を積み上げています');
    await tick();
    this.buildRocks();

    progress(0.42, '海藻を植えています');
    await tick();
    this.buildVegetation();

    progress(0.56, 'サンゴと貝を散りばめています');
    await tick();
    this.buildCoralsAndShells();

    progress(0.66, '島に小屋を建てています');
    await tick();
    this.buildIsland();
    this.buildSpots();
  }

  // ───────── 高さ・判定ヘルパー ─────────
  groundAt(x, z) { return this.terrain.heightAt(x, z); }
  waterAt(x, z, t = U.uTime.value) { return waveHeight(x, z, t); }

  randomPoint(minH, maxH, rMin = 40, rMax = PLAY_RADIUS - 8, tries = 200) {
    const rng = this.rng;
    for (let i = 0; i < tries; i++) {
      const a = rng.range(0, Math.PI * 2), r = Math.sqrt(rng.range(rMin * rMin, rMax * rMax));
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      const h = this.groundAt(x, z);
      if (h >= minH && h <= maxH) return V3(x, h, z);
    }
    return null;
  }

  gridKey(x, z) { return `${Math.floor(x / 12)},${Math.floor(z / 12)}`; }
  nearbyRocks(x, z, out = []) {
    out.length = 0;
    const gx = Math.floor(x / 12), gz = Math.floor(z / 12);
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
      const cell = this.rockGrid.get(`${gx + i},${gz + j}`);
      if (cell) for (const r of cell) out.push(r);
    }
    return out;
  }

  /** 岩（楕円体近似）から押し出す。戻り値: 押し出したか */
  pushOutOfRocks(p, radius, vel) {
    const list = this.nearbyRocks(p.x, p.z, this._tmpList || (this._tmpList = []));
    let hit = false;
    for (const r of list) {
      const dx = p.x - r.x, dy = p.y - r.y, dz = p.z - r.z;
      const c = Math.cos(-r.rotY), s = Math.sin(-r.rotY);
      const lx = dx * c - dz * s, lz = dx * s + dz * c;
      const ax = r.rx + radius, ay = r.ry + radius, az = r.rz + radius;
      const q = (lx * lx) / (ax * ax) + (dy * dy) / (ay * ay) + (lz * lz) / (az * az);
      if (q < 1) {
        const k = 1 / Math.sqrt(Math.max(q, 1e-4));
        // 表面へ押し出し（楕円体の法線方向）
        let nx = lx / (ax * ax), ny = dy / (ay * ay), nz = lz / (az * az);
        const nl = Math.hypot(nx, ny, nz) || 1;
        nx /= nl; ny /= nl; nz /= nl;
        const tx = lx * k, ty = dy * k, tz = lz * k;
        const c2 = Math.cos(r.rotY), s2 = Math.sin(r.rotY);
        p.x = r.x + tx * c2 - tz * s2;
        p.y = r.y + ty;
        p.z = r.z + tx * s2 + tz * c2;
        if (vel) {
          const wx = nx * c2 - nz * s2, wz = nx * s2 + nz * c2;
          const vn = vel.x * wx + vel.y * ny + vel.z * wz;
          if (vn < 0) { vel.x -= vn * wx; vel.y -= vn * ny; vel.z -= vn * wz; }
        }
        hit = true;
      }
    }
    return hit;
  }

  insideRock(p, pad = 0) {
    const list = this.nearbyRocks(p.x, p.z, this._tmpList2 || (this._tmpList2 = []));
    for (const r of list) {
      const dx = p.x - r.x, dy = p.y - r.y, dz = p.z - r.z;
      const c = Math.cos(-r.rotY), s = Math.sin(-r.rotY);
      const lx = dx * c - dz * s, lz = dx * s + dz * c;
      const q = (lx * lx) / ((r.rx + pad) ** 2) + (dy * dy) / ((r.ry + pad) ** 2) + (lz * lz) / ((r.rz + pad) ** 2);
      if (q < 1) return r;
    }
    return null;
  }

  // ───────── 岩 ─────────
  buildRocks() {
    const rng = this.rng;
    const NVAR = 6;
    this.rockGeos = [];
    this.rockBase = [];
    for (let i = 0; i < NVAR; i++) {
      const g = D.makeRockGeometry(i + 1);
      g.computeBoundingBox();
      const bb = g.boundingBox;
      this.rockGeos.push(g);
      this.rockBase.push(V3((bb.max.x - bb.min.x) / 2, bb.max.y, (bb.max.z - bb.min.z) / 2));
    }
    const add = (x, z, s, opts = {}) => {
      const g = this.groundAt(x, z);
      const variant = opts.variant ?? rng.int(0, NVAR - 1);
      const sx = s * rng.range(0.85, 1.2) * (opts.sx || 1);
      const sy = s * rng.range(0.6, 1.0) * (opts.sy || 1);
      const sz = s * rng.range(0.85, 1.2) * (opts.sz || 1);
      const rotY = opts.rotY ?? rng.range(0, Math.PI * 2);
      const base = this.rockBase[variant];
      const r = {
        x, y: (opts.y ?? g) - sy * 0.15 * (opts.sink ?? 1), z, sx, sy, sz, rotY, variant,
        rx: base.x * sx * 0.82, ry: base.y * sy * 0.85, rz: base.z * sz * 0.82, size: s,
      };
      this.rocks.push(r);
      return r;
    };

    // 岩礁クラスター
    this.clusters = [];
    for (let c = 0; c < 46; c++) {
      const p = this.randomPoint(-12, -3.2, 55, 175);
      if (!p) continue;
      const deep = p.y < -8.5;
      this.clusters.push({ x: p.x, z: p.z, y: p.y, deep });
      const n = rng.int(3, 8);
      for (let i = 0; i < n; i++) {
        const a = rng.range(0, Math.PI * 2), d = i === 0 ? 0 : rng.range(1.5, 6.5);
        const s = i === 0 ? rng.range(1.8, 3.2) : rng.range(0.6, 2.2);
        add(p.x + Math.cos(a) * d, p.z + Math.sin(a) * d, s * (deep ? 1.2 : 1));
      }
    }
    // ドロップオフの大岩
    for (let i = 0; i < 34; i++) {
      const p = this.randomPoint(-19, -10, 120, 190);
      if (p) add(p.x, p.z, rng.range(1.6, 4.6), { sy: rng.range(1.0, 1.6) });
    }
    // 浅場の転石
    for (let i = 0; i < 26; i++) {
      const p = this.randomPoint(-3.5, -0.8, 44, 80);
      if (p) add(p.x, p.z, rng.range(0.4, 1.3));
    }
    // 波打ち際
    for (let i = 0; i < 30; i++) {
      const p = this.randomPoint(-1.2, 1.2, 30, 60);
      if (p) add(p.x, p.z, rng.range(0.6, 2.2), { sink: 1.5 });
    }
    // 深場
    for (let i = 0; i < 16; i++) {
      const p = this.randomPoint(-30, -19, 170, PLAY_RADIUS);
      if (p) add(p.x, p.z, rng.range(1.2, 3.5));
    }

    // ヌシの洞窟（岩のアーチ）
    let cave = null;
    for (let a = 0; a < 64 && !cave; a++) {
      const ang = 2.35 + a * 0.05;
      for (let r = 140; r < 200; r += 2) {
        const x = Math.cos(ang) * r, z = Math.sin(ang) * r;
        const h = this.groundAt(x, z);
        if (h < -16.5 && h > -19.5) { cave = { x, z, h, ang }; break; }
      }
    }
    if (!cave) cave = { x: -110, z: 110, h: this.groundAt(-110, 110), ang: 2.35 };
    {
      const { x, z, h, ang } = cave;
      const tx = -Math.sin(ang), tz = Math.cos(ang); // 接線方向
      const nx = Math.cos(ang), nz = Math.sin(ang);
      // 体長4〜5mを超えるヌシが収まるよう、アーチは大きめ
      const K = 1.8;
      add(x + tx * 4.2 * K, z + tz * 4.2 * K, 2.6 * K, { sy: 1.7, variant: 1, y: h });
      add(x - tx * 4.2 * K, z - tz * 4.2 * K, 2.6 * K, { sy: 1.7, variant: 2, y: h });
      add(x + nx * 3.2 * K, z + nz * 3.2 * K, 3.0 * K, { sy: 1.5, variant: 3, y: h });
      add(x + (-tx * 1.5 + nx * 3.5) * K, z + (-tz * 1.5 + nz * 3.5) * K, 2.2 * K, { sy: 1.4, variant: 4, y: h });
      const roof = add(x + nx * 0.6 * K, z + nz * 0.6 * K, 5.2 * K, { sy: 0.34, sx: 1.2, sz: 1.2, variant: 0, y: h + 3.8 * K, sink: 0 });
      roof.ry *= 0.9;
      this.boss = {
        center: V3(x, h, z),
        pos: V3(x - nx * 0.3, h + 1.1, z - nz * 0.3),
        back: V3(x + nx * 1.8, h + 1.0, z + nz * 1.8),
        out: V3(-nx, 0, -nz),
      };
    }

    // インスタンス化（植生と同じく空間チャンクに分け、霧の向こうは描かない）
    const mat = patchMaterial(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0 }), { caustics: true, fx: ROCK_FX });
    this.rockMat = mat;
    const byVar = Array.from({ length: NVAR }, () => []);
    this.rocks.forEach((r) => byVar[r.variant].push(r));
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    this.rockProxies = [];
    byVar.forEach((list, v) => {
      if (!list.length) return;
      this.makeChunked(this.rockGeos[v], mat, list.map((r) => ({ pos: V3(r.x, r.y, r.z), scale: V3(r.sx, r.sy, r.sz), rot: r.rotY })));
      list.forEach((r) => {
        e.set(0, r.rotY, 0);
        q.setFromEuler(e);
        m.compose(V3(r.x, r.y, r.z), q, V3(r.sx, r.sy, r.sz));
        const proxy = new THREE.Mesh(this.rockGeos[v]);
        proxy.matrixAutoUpdate = false;
        proxy.matrix.copy(m);
        proxy.matrixWorld.copy(m);
        r.proxy = proxy;
        this.rockProxies.push(proxy);
      });
    });
    for (const r of this.rocks) {
      const k = this.gridKey(r.x, r.z);
      // 大きい岩は周囲のセルにも登録
      const span = Math.ceil(Math.max(r.rx, r.rz) / 12);
      const gx = Math.floor(r.x / 12), gz = Math.floor(r.z / 12);
      for (let i = -span; i <= span; i++) for (let j = -span; j <= span; j++) {
        const key = `${gx + i},${gz + j}`;
        if (!this.rockGrid.has(key)) this.rockGrid.set(key, []);
        this.rockGrid.get(key).push(r);
      }
      void k;
    }

    // 巣穴・止まり場
    const ray = new THREE.Raycaster();
    const hits = [];
    const cast = (r, origin, dir) => {
      ray.set(origin, dir);
      ray.far = 30;
      hits.length = 0;
      r.proxy.raycast(ray, hits);
      if (!hits.length) return null;
      hits.sort((a, b) => a.distance - b.distance);
      const h = hits[0];
      const n = h.face.normal.clone().transformDirection(r.proxy.matrixWorld);
      return { point: h.point.clone(), normal: n };
    };
    this.castRock = cast;
    for (const r of this.rocks) {
      const ground = this.groundAt(r.x, r.z);
      if (ground > -1.5) continue;
      // 上面
      const tops = Math.min(4, 1 + Math.floor(r.size));
      for (let i = 0; i < tops; i++) {
        const o = V3(r.x + rng.range(-0.5, 0.5) * r.rx, r.y + r.ry * 3 + 2, r.z + rng.range(-0.5, 0.5) * r.rz);
        const h = cast(r, o, V3(0, -1, 0));
        if (h && h.normal.y > 0.55 && !this.insideRockExcept(h.point, r)) this.perches.push({ pos: h.point, normal: h.normal, rock: r, depth: h.point.y });
      }
      // 根元の巣穴
      if (r.size > 1.1) {
        const a = rng.range(0, Math.PI * 2);
        const d = V3(Math.cos(a), 0, Math.sin(a));
        const gy = this.groundAt(r.x + d.x * r.rx, r.z + d.z * r.rz);
        const o = V3(r.x + d.x * (r.rx * 2.5 + 2), gy + 0.3, r.z + d.z * (r.rz * 2.5 + 2));
        const h = cast(r, o, d.clone().negate());
        if (h && h.point.y > gy - 0.1) {
          const pos = h.point.clone().addScaledVector(d, 0.06);
          pos.y = Math.max(pos.y, gy + 0.12);
          if (!this.insideRockExcept(pos, r, 0.1)) this.dens.push({ pos, dir: d, rock: r, occupied: false, depth: gy });
        }
      }
    }
  }

  insideRockExcept(p, except, pad = 0) {
    const list = this.nearbyRocks(p.x, p.z, []);
    for (const r of list) {
      if (r === except) continue;
      const dx = p.x - r.x, dy = p.y - r.y, dz = p.z - r.z;
      const c = Math.cos(-r.rotY), s = Math.sin(-r.rotY);
      const lx = dx * c - dz * s, lz = dx * s + dz * c;
      if ((lx * lx) / (r.rx + pad) ** 2 + (dy * dy) / (r.ry + pad) ** 2 + (lz * lz) / (r.rz + pad) ** 2 < 1) return true;
    }
    return false;
  }

  /** 岩の表面のランダムな点（向き条件付き） */
  rockSurface(r, cond) {
    const rng = this.rng;
    for (let i = 0; i < 12; i++) {
      const d = V3(rng.range(-1, 1), rng.range(-0.3, 1), rng.range(-1, 1)).normalize();
      const o = V3(r.x + d.x * (r.rx * 3 + 2), r.y + d.y * (r.ry * 3 + 2) + r.ry * 0.3, r.z + d.z * (r.rz * 3 + 2));
      const dir = V3(r.x, r.y + r.ry * 0.3, r.z).sub(o).normalize();
      const h = this.castRock(r, o, dir);
      if (h && cond(h.normal, h.point) && h.point.y > this.groundAt(h.point.x, h.point.z) + 0.05 && !this.insideRockExcept(h.point, r)) return h;
    }
    return null;
  }

  // ───────── 植生 ─────────
  /** 水中の植生は空間チャンクに分け、視界外・霧の向こうを描かない */
  makeChunked(geo, mat, items, colorFn, cell = 64) {
    const cells = new Map();
    for (const it of items) {
      const k = `${Math.floor(it.pos.x / cell)},${Math.floor(it.pos.z / cell)}`;
      if (!cells.has(k)) cells.set(k, []);
      cells.get(k).push(it);
    }
    for (const list of cells.values()) {
      const im = this.makeInstanced(geo, mat, list, colorFn);
      this.chunks.push({ mesh: im, center: im.boundingSphere.center, r: im.boundingSphere.radius });
    }
  }

  makeInstanced(geo, mat, items, colorFn) {
    const im = new THREE.InstancedMesh(geo, mat, Math.max(items.length, 1));
    im.count = items.length;
    const m = new THREE.Matrix4(), q = new THREE.Quaternion();
    items.forEach((it, i) => {
      q.setFromUnitVectors(V3(0, 1, 0), it.up || V3(0, 1, 0));
      q.multiply(new THREE.Quaternion().setFromAxisAngle(V3(0, 1, 0), it.rot ?? this.rng.range(0, 6.28)));
      m.compose(it.pos, q, typeof it.scale === 'number' ? V3(it.scale, it.scale, it.scale) : it.scale);
      im.setMatrixAt(i, m);
      if (colorFn) im.setColorAt(i, colorFn(it, i));
    });
    im.computeBoundingSphere();
    this.scene.add(im);
    return im;
  }

  plantMat(amp, extra = {}, fx = null) {
    const m = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.82, metalness: 0, ...extra });
    patchMaterial(m, { sway: 'plant', uniforms: { uSwayAmp: { value: amp } }, fx });
    return m;
  }

  buildVegetation() {
    const rng = this.rng;
    // カジメ（岩の上と周り）
    const kelpItems = [[], []];
    for (const p of this.perches) {
      if (p.depth > -2 || p.depth < -14) continue;
      const n = rng.int(1, 3);
      for (let i = 0; i < n; i++) {
        const pos = p.pos.clone().add(V3(rng.range(-0.4, 0.4), -0.05, rng.range(-0.4, 0.4)));
        kelpItems[rng.int(0, 1)].push({ pos, scale: rng.range(0.7, 1.35), up: p.normal.clone().lerp(V3(0, 1, 0), 0.6).normalize() });
      }
    }
    for (let i = 0; i < 260; i++) {
      const c = rng.pick(this.clusters);
      const a = rng.range(0, 6.28), d = rng.range(2, 10);
      const x = c.x + Math.cos(a) * d, z = c.z + Math.sin(a) * d;
      const h = this.groundAt(x, z);
      if (h > -2.5 || h < -13) continue;
      const pos = V3(x, h - 0.05, z);
      if (this.insideRock(pos)) continue;
      kelpItems[rng.int(0, 1)].push({ pos, scale: rng.range(0.7, 1.3) });
    }
    // 岩の上はワカメ、周りの一部だけ背の低いカジメ
    const kelpMat = this.plantMat(0.42, {}, LEAF_FX);
    const kelpA = [], kelpB = [];
    [...kelpItems[0], ...kelpItems[1]].forEach((it, i) => (i % 4 === 0 ? kelpB : kelpA).push(it));
    this.makeChunked(D.makeWakame(1), kelpMat, kelpA.filter((_, i) => i % 2 === 0));
    this.makeChunked(D.makeWakame(2), kelpMat, kelpA.filter((_, i) => i % 2 === 1));
    const kajimeMat = this.plantMat(0.2, {}, LEAF_FX);
    this.makeChunked(D.makeKelp(2), kajimeMat, kelpB.map((it) => ({ ...it, scale: it.scale * 0.7 })));

    // ホンダワラの林
    const sItems = [[], []];
    for (let f = 0; f < 14; f++) {
      const c = this.randomPoint(-9, -2.5, 50, 150);
      if (!c) continue;
      const n = rng.int(10, 22);
      for (let i = 0; i < n; i++) {
        const a = rng.range(0, 6.28), d = rng.range(0, 7);
        const x = c.x + Math.cos(a) * d, z = c.z + Math.sin(a) * d;
        const h = this.groundAt(x, z);
        if (h > -2.2) continue;
        const pos = V3(x, h - 0.05, z);
        if (this.insideRock(pos)) continue;
        const maxS = Math.min(1.35, (-h - 0.6) / 3.2);
        if (maxS < 0.45) continue;
        sItems[rng.int(0, 1)].push({ pos, scale: rng.range(0.45, maxS) });
      }
    }
    const sMat = this.plantMat(0.55, {}, LEAF_FX);
    this.makeChunked(D.makeSargassum(3), sMat, sItems[0]);
    this.makeChunked(D.makeSargassum(4), sMat, sItems[1]);

    // アマモ場
    const gItems = [[], []];
    for (let f = 0; f < 22; f++) {
      const c = this.randomPoint(-4.5, -0.9, 44, 90);
      if (!c) continue;
      const n = rng.int(40, 90);
      for (let i = 0; i < n; i++) {
        const a = rng.range(0, 6.28), d = Math.sqrt(rng.next()) * 7;
        const x = c.x + Math.cos(a) * d, z = c.z + Math.sin(a) * d;
        const h = this.groundAt(x, z);
        if (h > -0.7 || h < -6) continue;
        gItems[rng.int(0, 1)].push({ pos: V3(x, h - 0.03, z), scale: rng.range(0.7, 1.3) });
      }
    }
    const gMat = this.plantMat(0.2, {}, LEAF_FX);
    this.makeChunked(D.makeSeagrass(5), gMat, gItems[0]);
    this.makeChunked(D.makeSeagrass(6), gMat, gItems[1]);
    this.seagrassSpots = gItems[0].slice(0, 60).map((i) => i.pos);
  }

  buildCoralsAndShells() {
    const rng = this.rng;
    const nearCluster = (minH, maxH, spread = 8) => {
      for (let t = 0; t < 30; t++) {
        const c = rng.pick(this.clusters);
        const a = rng.range(0, 6.28), d = rng.range(1, spread);
        const x = c.x + Math.cos(a) * d, z = c.z + Math.sin(a) * d;
        const h = this.groundAt(x, z);
        if (h < minH || h > maxH) continue;
        const pos = V3(x, h - 0.03, z);
        if (this.insideRock(pos, 0.1)) continue;
        return pos;
      }
      return null;
    };
    const pastel = ['#c98f9f', '#a6b87a', '#c8a878', '#8f9fc0', '#d09a6a', '#a888b8'];
    const vivid = ['#ff5a6a', '#ff9a3a', '#f8d040', '#c060e0', '#ff7ab0', '#50c0e0'];
    const coralMat = this.plantMat(0.02, { roughness: 0.75 });
    const pick = (arr) => new THREE.Color(rng.pick(arr));

    const table = [], branch = [], brain = [], soft = [], fans = [], anem = [];
    for (let i = 0; i < 28; i++) { const p = nearCluster(-10, -3); if (p) table.push({ pos: p, scale: rng.range(0.7, 1.5) }); }
    for (let i = 0; i < 70; i++) { const p = nearCluster(-12, -2.5); if (p) branch.push({ pos: p, scale: rng.range(0.8, 1.6) }); }
    for (let i = 0; i < 30; i++) { const p = nearCluster(-11, -3); if (p) brain.push({ pos: p, scale: rng.range(0.5, 1.3) }); }
    for (let i = 0; i < 60; i++) { const p = nearCluster(-20, -7, 10); if (p) soft.push({ pos: p, scale: rng.range(0.8, 2.0) }); }
    for (let i = 0; i < 70; i++) {
      const r = rng.pick(this.rocks);
      if (r.y > -7 || r.y < -22) continue;
      const h = this.rockSurface(r, (n) => Math.abs(n.y) < 0.5);
      if (h) fans.push({ pos: h.point.clone().addScaledVector(h.normal, -0.05), scale: rng.range(0.8, 1.8), up: V3(0, 1, 0).lerp(h.normal, 0.3).normalize(), rot: Math.atan2(h.normal.x, h.normal.z) });
    }
    for (let i = 0; i < 16; i++) {
      const r = rng.pick(this.rocks);
      if (r.y > -2.5 || r.y < -10) continue;
      const h = this.rockSurface(r, (n) => n.y > 0.6);
      if (h) anem.push({ pos: h.point.clone(), scale: rng.range(0.9, 1.5), up: h.normal });
    }
    this.makeChunked(D.makeTableCoral(1), coralMat, table, () => pick(pastel));
    this.makeChunked(D.makeBranchCoral(2), coralMat, branch, () => pick(pastel));
    this.makeChunked(D.makeBrainCoral(3), coralMat, brain, () => pick(pastel));
    const softMat = this.plantMat(0.06, { roughness: 0.6 });
    this.makeChunked(D.makeSoftCoral(4), softMat, soft, () => pick(vivid));
    const fanMat = this.plantMat(0.08, { map: D.seaFanTexture(), alphaTest: 0.45, transparent: false });
    this.makeChunked(D.makeSeaFan(), fanMat, fans, () => pick(vivid));
    const anMat = this.plantMat(0.1, { roughness: 0.5 });
    this.makeChunked(D.makeAnemone(5), anMat, anem, () => pick(['#e8d0f0', '#d0f0c8', '#f8e0c0']));
    this.coralSpots = branch.map((b) => b.pos);
    this.fanSpots = soft.concat(fans).map((b) => b.pos);
    this.anemones = anem.map((a) => a.pos.clone().addScaledVector(a.up, 0.2));

    // ヒトデ（装飾）
    const stars = [];
    for (let i = 0; i < 70; i++) {
      const p = this.randomPoint(-14, -1.5, 45, 170);
      if (p && !this.insideRock(p)) stars.push({ pos: p.clone().add(V3(0, 0.01, 0)), scale: rng.range(0.6, 1.4), up: this.terrain.normalAt(p.x, p.z) });
    }
    const starMat = D.pickupMaterial();
    this.makeChunked(D.makeStarfish(), starMat, stars, () => pick(['#e86a2a', '#d04040', '#3a70c8', '#e8a030']));

    // 拾える獲物
    const shellMat = D.pickupMaterial();
    const defs = [
      { type: 'uni', geo: D.makeUrchin(1), far: D.makeUrchin(0.3), n: 90, cond: (n) => n.y > -0.2, minY: -12, maxY: -1.2 },
      { type: 'sazae', geo: D.makeTurban(1), far: D.makeTurban(0.3), n: 55, cond: (n) => n.y > 0.4, minY: -10, maxY: -1.5 },
      { type: 'awabi', geo: D.makeAbalone(1), far: D.makeAbalone(0.3), n: 16, cond: (n) => n.y < 0.25 && n.y > -0.5, minY: -14, maxY: -3 },
    ];
    for (const def of defs) {
      const items = [];
      let guard = 0;
      while (items.length < def.n && guard++ < def.n * 12) {
        const r = rng.pick(this.rocks);
        if (r.y < def.minY || r.y > def.maxY) continue;
        const h = this.rockSurface(r, def.cond);
        if (!h) continue;
        items.push({ pos: h.point.clone().addScaledVector(h.normal, 0.01), up: h.normal.clone(), scale: rng.range(0.85, 1.25) });
      }
      // 小さな区画ごとに、近くは細かいモデル、遠くは軽いモデルで描く
      const cells = new Map();
      for (const it of items) {
        it.rot = rng.range(0, 6.28);
        const k = `${Math.floor(it.pos.x / 24)},${Math.floor(it.pos.z / 24)}`;
        if (!cells.has(k)) cells.set(k, []);
        cells.get(k).push(it);
      }
      for (const list of cells.values()) {
        const near = this.makeInstanced(def.geo, shellMat, list), far = this.makeInstanced(def.far, shellMat, list);
        this.lodChunks.push({ near, far, center: near.boundingSphere.center, r: near.boundingSphere.radius });
        list.forEach((it, i) => {
          const m = new THREE.Matrix4();
          near.getMatrixAt(i, m);
          this.pickups.push({ type: def.type, def: PICKUPS[def.type], pos: it.pos, meshes: [near, far], index: i, matrix: m, alive: true, respawn: 0 });
        });
      }
    }
  }

  // ───────── 島 ─────────
  buildIsland() {
    const rng = this.rng;
    // プレイヤー開始位置と拠点（+z 側の浜）
    let beach = null;
    for (let z = 20; z < 80; z += 0.5) {
      const h = this.groundAt(0, z);
      if (h < 1.6) { beach = V3(0, h, z - 3.5); beach.y = this.groundAt(beach.x, beach.z); break; }
    }
    if (!beach) beach = V3(0, 2, 36);
    this.camp = beach;
    let startZ = beach.z + 30;
    for (let z = beach.z + 20; z < 160; z += 1) { if (this.groundAt(0, z) < -5) { startZ = z; break; } }
    this.start = V3(0, 0, startZ);

    // 島の植物：木肌と葉でマテリアルを分ける（葉だけ葉脈と透過光）
    // 配置は専用の乱数で決め、植物を調整しても後の生息地の配置が変わらないようにする
    const prng = new RNG(4217);
    const barkMat = this.plantMat(0.12, { roughness: 0.92 });
    const leafMat = this.plantMat(0.16, { roughness: 0.7 }, LEAF_FX);
    const nearCamp = (x, z, r) => Math.hypot(x - beach.x, z - beach.z) < r;
    const scatter = (variants, n, tries, ok, item) => {
      const out = Array.from({ length: variants }, () => []);
      for (let i = 0, k = 0; i < tries && k < n; i++) {
        const a = prng.range(0, 6.28), r = prng.range(0, 46);
        const x = Math.cos(a) * r, z = Math.sin(a) * r;
        const h = this.groundAt(x, z);
        if (!ok(x, z, h)) continue;
        out[prng.int(0, variants - 1)].push({ ...item(x, z, h), rot: prng.range(0, 6.28) });
        k++;
      }
      return out;
    };
    const plants = this.islandPlants = [];
    const twoPart = (geos, items) => geos.forEach((g, v) => {
      plants.push(this.makeInstanced(g.wood, barkMat, items[v]), this.makeInstanced(g.leaves, leafMat, items[v]));
    });

    // ヤシ：浜沿いに多く、丘の上にもまばらに
    const palms = scatter(4, 38, 400, (x, z, h) => h > 1.3 && h < 12 && !nearCamp(x, z, 9) && (h < 5 || prng.chance(0.45)),
      (x, z, h) => ({ pos: V3(x, h - 0.1, z), scale: prng.range(0.85, 1.15) }));
    twoPart([0, 1, 2, 3].map((v) => D.makePalm(10 + v)), palms);

    // アダン：波打ち際の少し上に茂みをつくる
    const pandanus = scatter(3, 16, 500, (x, z, h) => h > 1.2 && h < 3.6 && !nearCamp(x, z, 10),
      (x, z, h) => ({ pos: V3(x, h - 0.05, z), scale: prng.range(1.1, 1.5) }));
    twoPart([0, 1, 2].map((v) => D.makePandanus(30 + v)), pandanus);

    const bushes = scatter(3, 170, 900, (x, z, h) => h > 2.4 && !nearCamp(x, z, 8),
      (x, z, h) => ({ pos: V3(x, h - 0.25, z), scale: prng.range(0.7, 1.7) }));
    const bushMat = this.plantMat(0.05, { roughness: 0.85 }, LEAF_FX);
    bushes.forEach((items, v) => plants.push(this.makeInstanced(D.makeBush(20 + v), bushMat, items)));

    // 砂浜と草地の境目の草むら
    const tufts = scatter(2, 240, 1500, (x, z, h) => h > 1.5 && h < 5.5 && !nearCamp(x, z, 11),
      (x, z, h) => ({ pos: V3(x, h - 0.03, z), scale: prng.range(0.7, 1.4) }));
    const grassMat = this.plantMat(0.1, { roughness: 0.85 }, LEAF_FX);
    tufts.forEach((items, v) => plants.push(this.makeInstanced(D.makeGrassTuft(40 + v), grassMat, items)));

    // 小屋・焚き火・看板・流木
    const woodMat = patchMaterial(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide }), {});
    const hut = new THREE.Mesh(D.makeHut(), woodMat);
    hut.position.set(beach.x - 3, this.groundAt(beach.x - 3, beach.z - 3) - 0.05, beach.z - 3);
    hut.rotation.y = Math.PI;
    this.scene.add(hut);
    const fire = new THREE.Mesh(D.makeCampfire(), woodMat);
    const fp = V3(beach.x + 1.5, 0, beach.z + 0.5);
    fp.y = this.groundAt(fp.x, fp.z);
    fire.position.copy(fp);
    this.scene.add(fire);
    this.firePos = fp.clone().add(V3(0, 0.35, 0));
    this.buildFlame(this.firePos);
    const signMat = patchMaterial(new THREE.MeshStandardMaterial({ map: D.signTexture(), roughness: 0.85 }), {});
    this.signMat = signMat;
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.8), signMat);
    const sp = V3(beach.x + 4.2, 0, beach.z + 1.0);
    sp.y = this.groundAt(sp.x, sp.z) + 1.3;
    sign.position.copy(sp);
    sign.rotation.y = -0.35;
    this.scene.add(sign);
    const postGeo = new THREE.CylinderGeometry(0.05, 0.06, 1.4, 6);
    const postMat = patchMaterial(new THREE.MeshStandardMaterial({ color: '#7a6244', roughness: 0.9 }), {});
    for (const dx of [-0.6, 0.6]) {
      const post = new THREE.Mesh(postGeo, postMat);
      post.position.set(sp.x + dx * Math.cos(0.35), sp.y - 0.55, sp.z + dx * Math.sin(0.35));
      this.scene.add(post);
    }
    for (let i = 0; i < 7; i++) {
      const a = rng.range(0, 6.28);
      let p = null;
      for (let r = 44; r > 20; r -= 0.5) {
        const x = Math.cos(a) * r, z = Math.sin(a) * r;
        if (this.groundAt(x, z) > 0.8) { p = V3(x, this.groundAt(x, z), z); break; }
      }
      if (!p) continue;
      const dw = new THREE.Mesh(D.makeDriftwood(i), woodMat);
      dw.position.copy(p);
      dw.rotation.y = rng.range(0, 6.28);
      this.scene.add(dw);
    }

    // 遠くの島々
    const farMat = patchMaterial(new THREE.MeshStandardMaterial({ color: '#3f5a3a', roughness: 1 }), { caustics: false });
    for (const [a, d, s] of [[0.6, 620, 90], [2.2, 700, 140], [4.0, 580, 60], [5.2, 760, 180]]) {
      const g = new THREE.IcosahedronGeometry(1, 3);
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const y = p.getY(i);
        const k = 1 + Math.sin(p.getX(i) * 5 + a) * 0.12 + Math.cos(p.getZ(i) * 4) * 0.1;
        p.setXYZ(i, p.getX(i) * k, Math.max(y, -0.1) * (0.28 + Math.sin(a * 3) * 0.06), p.getZ(i) * k);
      }
      g.computeVertexNormals();
      const m = new THREE.Mesh(g, farMat);
      m.scale.set(s, s, s * 0.7);
      m.position.set(Math.cos(a) * d, -2, Math.sin(a) * d);
      this.scene.add(m);
    }

    // 鳥
    this.birds = [];
    const birdMat = new THREE.MeshBasicMaterial({ color: '#2a2a2a', side: THREE.DoubleSide, fog: false });
    for (let i = 0; i < 7; i++) {
      const g = new THREE.Group();
      const wingGeo = new THREE.BufferGeometry();
      wingGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.12, 0, 0, -0.1, 0.75, 0.05, -0.05], 3));
      const L = new THREE.Mesh(wingGeo, birdMat);
      const R = new THREE.Mesh(wingGeo, birdMat);
      R.scale.x = -1;
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 4), birdMat);
      body.scale.set(0.8, 0.8, 2.6);
      g.add(L, R, body);
      this.scene.add(g);
      this.birds.push({ g, L, R, r: rng.range(18, 45), h: rng.range(16, 34), sp: rng.range(0.12, 0.25) * (rng.chance(0.5) ? 1 : -1), ph: rng.range(0, 6.28) });
    }
  }

  buildFlame(pos) {
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTime: U.uTime },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `
        uniform float uTime; varying vec2 vUv;
        float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
        float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y); }
        void main(){
          vec2 uv = vUv;
          float t = uTime;
          float nz = n(vec2(uv.x*4.0, uv.y*3.0 - t*3.5))*0.6 + n(vec2(uv.x*9.0, uv.y*7.0 - t*6.0))*0.4;
          float w = 0.34 * (1.0 - uv.y) * (1.0 - uv.y*0.2);
          float d = abs(uv.x - 0.5 + (nz - 0.5) * 0.25 * uv.y);
          float a = (1.0 - smoothstep(w * 0.2, w, d)) * (1.0 - smoothstep(0.25, 1.0, uv.y + nz * 0.35)) * smoothstep(0.0, 0.08, uv.y);
          vec3 c = mix(vec3(1.0, 0.25, 0.03), vec3(1.0, 0.85, 0.35), smoothstep(0.3, 0.9, a));
          gl_FragColor = vec4(c * a * 0.7, a);
        }`,
    });
    this.flames = [];
    {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.4), mat);
      m.position.copy(pos).add(V3(0, 0.55, 0));
      m.renderOrder = 6;
      this.scene.add(m);
      this.flames.push(m);
    }
    this.fireLight = new THREE.PointLight('#ff8a3a', 6, 18, 1.6);
    this.fireLight.position.copy(pos).add(V3(0, 0.8, 0));
    this.scene.add(this.fireLight);
  }

  // ───────── 生息地 ─────────
  buildSpots() {
    const rng = this.rng;
    for (let i = 0; i < 260; i++) {
      const c = rng.pick(this.clusters);
      const a = rng.range(0, 6.28), d = rng.range(2, 9);
      const x = c.x + Math.cos(a) * d, z = c.z + Math.sin(a) * d;
      const h = this.groundAt(x, z);
      if (h > -2.5) continue;
      const p = V3(x, h, z);
      (h < -9 ? this.spots.deepreef : this.spots.reef).push(p);
    }
    for (let i = 0; i < 160; i++) {
      const p = this.randomPoint(-22, -2.5, 48, PLAY_RADIUS - 10);
      if (!p) continue;
      const n = this.terrain.normalAt(p.x, p.z);
      if (n.y < 0.96) continue;
      if (this.insideRock(p, 1.5)) continue;
      this.spots.sand.push(p);
    }
    // 回遊ルート: 前半12点は沖、後半12点はドロップオフ沿い（よく泳ぐ場所で群れに出会える）
    for (let i = 0; i < 12; i++) {
      const p = this.randomPoint(-30, -13, 150, PLAY_RADIUS - 15);
      if (p) this.spots.open.push(p);
    }
    for (let i = 0; i < 12; i++) {
      const p = this.randomPoint(-18, -8, 95, 175);
      if (p) this.spots.open.push(p);
    }
    for (let i = 0; i < 30; i++) {
      const p = this.randomPoint(-4, -1.2, 44, 80);
      if (p) this.spots.shallow.push(p);
    }
    if (!this.spots.deepreef.length) this.spots.deepreef = this.spots.reef.slice();
  }

  // ───────── 毎フレーム ─────────
  update(dt, t, camera) {
    this.water.update(camera);
    this.sky.update(camera);
    for (const c of this.chunks) c.mesh.visible = camera.position.distanceTo(c.center) - c.r < 90;
    // 島の植物は、沖の水中からは見えないので描かない
    const showIsland = camera.position.y > -1.5 || Math.hypot(camera.position.x, camera.position.z) < 100;
    for (const m of this.islandPlants) m.visible = showIsland;
    for (const c of this.lodChunks) {
      const d = camera.position.distanceTo(c.center) - c.r;
      c.near.visible = d < 14;
      c.far.visible = d >= 14 && d < 80;
    }
    for (const b of this.birds) {
      b.ph += dt * b.sp;
      const x = Math.cos(b.ph) * b.r, z = Math.sin(b.ph) * b.r;
      b.g.position.set(x, b.h + Math.sin(t * 0.5 + b.r) * 1.5, z);
      b.g.rotation.y = -b.ph + (b.sp > 0 ? Math.PI : 0);
      const flap = Math.sin(t * 7 + b.r) * 0.5;
      b.L.rotation.z = flap; b.R.rotation.z = -flap;
    }
    if (this.fireLight) {
      this.fireLight.intensity = 5 + Math.sin(t * 13) * 0.8 + Math.sin(t * 7.3) * 1.1 + Math.random() * 0.6;
      for (const f of this.flames) f.lookAt(camera.position.x, f.position.y, camera.position.z);
      this._smokeT = (this._smokeT || 0) + dt;
      if (this._smokeT > 0.25 && camera.position.distanceTo(this.firePos) < 220) {
        this._smokeT = 0;
        this.particles.smoke(this.firePos.x, this.firePos.y + 1.2, this.firePos.z);
      }
    }
    // 拾った獲物の復活
    for (const p of this.pickups) {
      if (!p.alive && (p.respawn -= dt) <= 0 && camera.position.distanceTo(p.pos) > 25) {
        p.alive = true;
        for (const im of p.meshes) { im.setMatrixAt(p.index, p.matrix); im.instanceMatrix.needsUpdate = true; }
      }
    }
  }

  collect(p) {
    p.alive = false;
    p.respawn = 120 + Math.random() * 120;
    const m = p.matrix.clone().scale(V3(0, 0, 0));
    for (const im of p.meshes) { im.setMatrixAt(p.index, m); im.instanceMatrix.needsUpdate = true; }
  }

  get playRadius() { return PLAY_RADIUS; }
  get worldSize() { return WORLD_SIZE; }
  radiusAt(x, z) { return warpedRadius(x, z); }
}

export { smoothstep, clamp };
