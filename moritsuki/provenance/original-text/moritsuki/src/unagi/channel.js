// 側溝の形: U 字のコンクリートの壁・泥のたまった底・落ち込み・暗渠・水門・格子・パイプ・はしご
// 壁の色は水位から決める（水の下は藻でぬめり、水際に緑の帯、上は乾いて黒い筋）
import * as THREE from 'three';
import { patchMaterial } from './shade.js';
import { concreteTextures, bedTextures } from './textures.js';
import {
  HW, WALL_T, S_GRATE, S_FAR, S_GATE, S_END, DROPS, CULVERT, CEIL, PIPES, LADDERS,
  floorC, groundAt, humpAt, levelAt, bedAt, weepHoles,
} from './ditch.js';
import { RNG } from './core/noise.js';

const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

// 行（s の並び）: 0.1m ごと＋段の前後
function rowsS(step = 0.1, s0 = S_GRATE - 6, s1 = S_FAR) {
  const set = new Set();
  for (let s = s0; s <= s1 + 1e-6; s += step) set.add(Math.round(s * 1000) / 1000);
  for (const d of DROPS) for (const e of [d.s - 0.002, d.s + 0.002, d.s - d.pool, d.s - d.pool + 0.07]) set.add(Math.round(e * 1000) / 1000);
  for (const e of [S_GATE + 0.4 - 0.002, S_GATE + 0.4 + 0.002, CULVERT.s0, CULVERT.s1]) set.add(Math.round(e * 1000) / 1000);
  return [...set].sort((a, b) => a - b);
}

// コンクリートの見え方（壁・段・暗渠・水門の共通）
const CONCRETE_FX = {
  key: 'concrete',
  decl: /* glsl */ `
    float cWet;
  `,
  color: /* glsl */ `
    {
      vec3 wp = vWPos;
      float s = -wp.z;
      // 水位（壁の内側の面は側溝の中として測る）
      float lv = ditchLevel(vec3(clamp(wp.x, -0.58, 0.58), wp.y, wp.z));
      float rel = wp.y - lv;
      // U 字溝の 1 本（2m）ごとに少し色がちがう
      float unit = floor(s * 0.5);
      float ut = un_h21(vec2(unit, 3.1));
      diffuseColor.rgb *= 0.86 + ut * 0.2;
      // 継ぎ目
      float js = fract(s * 0.5);
      float jd = min(js, 1.0 - js) * 2.0;
      diffuseColor.rgb *= mix(0.35, 1.0, smoothstep(0.004, 0.014, jd));
      // 乾いた所: 上から垂れた黒いかびの筋・白い汚れ
      float streak = un_fbm(vec2(s * 7.0, wp.y * 0.45 + ut * 9.0));
      float drip = smoothstep(0.55, 0.8, streak) * smoothstep(-0.05, 0.5, rel);
      diffuseColor.rgb *= 1.0 - drip * 0.45;
      diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.8, 0.86, 0.72), smoothstep(0.6, 0.8, un_fbm(vec2(s * 1.3, wp.y * 2.0) + 7.0)) * 0.6);
      // 水抜き穴から下へ流れた跡（2m ごと、左右で交互）
      {
        float hk = floor(s * 0.5);
        float hs = hk * 2.0 + 1.0;
        float side = mod(hk, 2.0) < 0.5 ? 1.0 : -1.0;
        float dx = abs(s - hs);
        float onSide = step(0.0, wp.x * side);
        float below = smoothstep(0.02, -0.25, rel - 0.32);
        float w = 0.035 + (0.32 - rel) * 0.05;
        float st = (1.0 - smoothstep(w * 0.5, w, dx)) * onSide * step(rel, 0.34) * smoothstep(-0.02, 0.1, rel);
        diffuseColor.rgb *= 1.0 - st * 0.5 * (0.6 + 0.4 * un_vn(vec2(s * 40.0, wp.y * 8.0)));
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.13, 0.12, 0.07), st * 0.35);
      }
      // 水際: ぬれた黒い帯と、緑の藻
      float band = smoothstep(0.1, 0.0, rel) * smoothstep(-0.03, 0.01, rel);
      float algae = smoothstep(0.35, 0.7, un_fbm(vec2(s * 5.0, wp.y * 30.0)));
      diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 0.45, smoothstep(0.14, 0.0, rel) * step(-5.0, lv));
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.07, 0.11, 0.035), band * (0.35 + algae * 0.45));
      // 水の下: 茶色い藻のぬめり
      float under = smoothstep(0.0, -0.04, rel) * step(-5.0, lv);
      float film = un_fbm(vec2(s * 2.3, wp.y * 6.0) + 3.0);
      diffuseColor.rgb = mix(diffuseColor.rgb, mix(vec3(0.12, 0.11, 0.06), vec3(0.09, 0.14, 0.05), film), under * 0.75);
      cWet = max(under, smoothstep(0.16, 0.0, rel) * step(-5.0, lv));
    }
  `,
  rough: /* glsl */ `
    roughnessFactor = mix(roughnessFactor, 0.32, cWet);
  `,
};

// 底（泥・砂・小石・藻）。急な所（段の面）はコンクリート
const BED_FX = {
  key: 'bed',
  decl: /* glsl */ `varying vec3 vObjN;`,
  vdecl: /* glsl */ `varying vec3 vObjN;`,
  vcode: /* glsl */ `vObjN = normal;`,
  color: /* glsl */ `
    {
      vec3 wp = vWPos;
      float s = -wp.z;
      float steep = 1.0 - smoothstep(0.35, 0.7, vObjN.y);
      // 暗い泥のたまり・明るい砂の筋
      float mud = smoothstep(0.4, 0.75, un_fbm(vec2(wp.x * 2.2, s * 0.8)));
      float sand = smoothstep(0.55, 0.8, un_fbm(vec2(wp.x * 3.0 + 5.0, s * 0.35)));
      diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.62, 0.57, 0.48), mud * 0.6);
      diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.25, 1.18, 1.05), sand * 0.5);
      // 緑がかった藻の膜
      float fl = smoothstep(0.45, 0.8, un_fbm(vec2(wp.x * 4.0, s * 2.0) + 11.0));
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.16, 0.19, 0.08), fl * 0.35);
      // 流れで砂にできたさざなみ模様
      float rip = sin(s * 38.0 + un_vn(vec2(wp.x * 5.0, s * 2.0)) * 5.0) * 0.5 + 0.5;
      diffuseColor.rgb *= 1.0 - rip * 0.12 * sand;
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.2, 0.2, 0.18) * (0.8 + 0.3 * un_vn(wp.xy * 30.0)), steep);
    }
  `,
  rough: /* glsl */ `roughnessFactor = 0.62;`,
};

export class Channel {
  constructor() {
    this.group = new THREE.Group();
    const ct = concreteTextures(3);
    const bt = bedTextures(11);
    this.concrete = patchMaterial(new THREE.MeshStandardMaterial({ map: ct.map, normalMap: ct.normal, normalScale: new THREE.Vector2(0.8, 0.8), roughness: 0.88, color: '#a29f96' }), { fx: CONCRETE_FX });
    this.concreteDry = patchMaterial(new THREE.MeshStandardMaterial({ map: ct.map, normalMap: ct.normal, roughness: 0.9, color: '#9a978e' }), { water: false, fx: { ...CONCRETE_FX, key: 'concreteDry' } });
    this.bedMat = patchMaterial(new THREE.MeshStandardMaterial({ map: bt.map, normalMap: bt.normal, normalScale: new THREE.Vector2(1.1, 1.1), roughness: 0.7, color: '#b8ae90' }), { fx: BED_FX });
    this.steel = patchMaterial(new THREE.MeshStandardMaterial({ color: '#4a4640', roughness: 0.55, metalness: 0.6 }), {});
    this.rust = patchMaterial(new THREE.MeshStandardMaterial({ color: '#5a3522', roughness: 0.8, metalness: 0.3 }), {});
    this.dark = new THREE.MeshBasicMaterial({ color: '#020304' });
    this.buildBed();
    this.buildWalls();
    this.buildDrops();
    this.buildCulvert();
    this.buildGate();
    this.buildGrate();
    this.buildPipes();
    this.buildLadders();
    this.buildWeepHoles();
  }

  // ───── 底 ─────
  buildBed() {
    const rows = rowsS(0.1);
    const X = 22;
    const pos = [], uv = [], idx = [];
    for (const s of rows) {
      for (let i = 0; i <= X; i++) {
        const x = -HW + (i / X) * 2 * HW;
        const y = bedAt(x, s);
        pos.push(x, y, -s);
        uv.push(x / 0.8, s / 0.8);
      }
    }
    for (let r = 0; r < rows.length - 1; r++) for (let i = 0; i < X; i++) {
      const a = r * (X + 1) + i, b = a + 1, c = a + X + 1, d = c + 1;
      idx.push(a, b, c, b, d, c);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, this.bedMat);
    m.receiveShadow = true;
    this.bed = m;
    this.group.add(m);
  }

  // ───── 壁（内の面・上の面） ─────
  buildWalls() {
    const rows = rowsS(0.25);
    const pos = [], uv = [], nrm = [], idx = [];
    const top = (s) => (s >= CULVERT.s0 && s <= CULVERT.s1 ? CEIL : groundAt(s) + 0.03);
    const quadStrip = (pts) => {
      // pts: [[a(bottom), b(top)] per row] を並べて帯にする
      const base = pos.length / 3;
      for (const [a, b, n] of pts) {
        pos.push(a.x, a.y, a.z, b.x, b.y, b.z);
        nrm.push(n.x, n.y, n.z, n.x, n.y, n.z);
        if (n.y > 0.5) uv.push(-a.z, a.x, -b.z, b.x); else uv.push(-a.z, a.y, -b.z, b.y);
      }
      for (let r = 0; r < pts.length - 1; r++) {
        const i = base + r * 2;
        idx.push(i, i + 1, i + 2, i + 1, i + 3, i + 2);
      }
    };
    for (const side of [-1, 1]) {
      const inner = [], cap = [], outer = [];
      for (const s of rows) {
        const f = floorC(s) - 0.36;
        const t = top(s);
        const xi = side * HW, xo = side * (HW + WALL_T);
        // 内の面（法線は側溝の中へ）
        inner.push(side > 0 ? [V3(xi, f, -s), V3(xi, t, -s), V3(-1, 0, 0)] : [V3(xi, t, -s), V3(xi, f, -s), V3(1, 0, 0)]);
        // 上の面
        const inCulv = s >= CULVERT.s0 && s <= CULVERT.s1;
        cap.push(side > 0 ? [V3(xi, t, -s), V3(xo, t, -s), V3(0, 1, 0)] : [V3(xo, t, -s), V3(xi, t, -s), V3(0, 1, 0)]);
        void inCulv;
        // 外の面の上のふち（地面から少し出ている）
        outer.push(side > 0 ? [V3(xo, t, -s), V3(xo, t - 0.12, -s), V3(1, 0, 0)] : [V3(xo, t - 0.12, -s), V3(xo, t, -s), V3(-1, 0, 0)]);
      }
      quadStrip(inner); quadStrip(cap); quadStrip(outer);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    // 法線マップのための接線は不要（uv の向きで近似）
    const m = new THREE.Mesh(g, this.concrete);
    m.receiveShadow = true;
    m.castShadow = true;
    this.walls = m;
    this.group.add(m);
  }

  // ───── 落ち込みの段の面・水門の下の段 ─────
  buildDrops() {
    // 段の面は底のメッシュに入っているので、ここでは段の角の面取り（コンクリートの縁）だけ
    for (const d of DROPS) {
      const y = floorC(d.s + 0.01);
      const lip = new THREE.Mesh(new THREE.BoxGeometry(HW * 2, 0.05, 0.12), this.concrete);
      lip.position.set(0, y - 0.02, -(d.s + 0.06));
      lip.receiveShadow = true;
      this.group.add(lip);
    }
  }

  // ───── 暗渠: 天井の床版・両端の顔・ガードレール ─────
  buildCulvert() {
    const c = CULVERT;
    const L = c.s1 - c.s0, mid = (c.s0 + c.s1) / 2;
    const W = HW * 2 + WALL_T * 2 + 1.2;
    const slabTop = groundAt(mid) + c.hump;
    // 床版（天井）
    const slab = new THREE.Mesh(new THREE.BoxGeometry(W, slabTop - CEIL, L), this.concrete);
    slab.position.set(0, (slabTop + CEIL) / 2, -mid);
    slab.receiveShadow = slab.castShadow = true;
    this.group.add(slab);
    // 両端の顔（開口の上の壁と、低い欄干）
    for (const [s, dir] of [[c.s0, 1], [c.s1, -1]]) {
      const h = 0.34;
      const face = new THREE.Mesh(new THREE.BoxGeometry(W + 0.3, h, 0.18), this.concreteDry);
      face.position.set(0, slabTop + h / 2 - 0.02, -(s + dir * 0.09) + dir * 0.0);
      face.castShadow = face.receiveShadow = true;
      this.group.add(face);
      // 白いガードレール（柱と波形の板）
      const rail = new THREE.Group();
      const white = new THREE.MeshStandardMaterial({ color: '#d8dad6', roughness: 0.4, metalness: 0.4 });
      patchMaterial(white, { water: false });
      for (let k = -1; k <= 1; k++) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.8, 10), white);
        post.position.set(k * 1.9, slabTop + 0.4, -(s - dir * 0.35));
        rail.add(post);
      }
      const beamGeo = new THREE.BoxGeometry(4.4, 0.3, 0.04, 1, 6, 1);
      const bp = beamGeo.attributes.position;
      for (let i = 0; i < bp.count; i++) bp.setZ(i, bp.getZ(i) + Math.cos(bp.getY(i) / 0.3 * Math.PI * 2) * 0.018);
      beamGeo.computeVertexNormals();
      const beam = new THREE.Mesh(beamGeo, white);
      beam.position.set(0, slabTop + 0.6, -(s - dir * 0.35) + dir * 0.05);
      rail.add(beam);
      rail.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      this.group.add(rail);
    }
    // 天井の白い石灰の垂れ（つらら）と汚れ
    const rng = new RNG(88);
    const icicle = new THREE.ConeGeometry(0.0025, 1, 5);
    icicle.translate(0, -0.5, 0);
    const iceMat = patchMaterial(new THREE.MeshStandardMaterial({ color: '#d9d4c4', roughness: 0.5 }), {});
    const inst = new THREE.InstancedMesh(icicle, iceMat, 40);
    const m4 = new THREE.Matrix4();
    for (let i = 0; i < 40; i++) {
      const s = rng.range(c.s0 + 0.3, c.s1 - 0.3);
      const x = rng.range(-HW + 0.1, HW - 0.1);
      const len = rng.range(0.006, 0.03);
      m4.compose(V3(x, CEIL, -s), new THREE.Quaternion(), V3(rng.range(0.6, 1.4), len, rng.range(0.6, 1.4)));
      inst.setMatrixAt(i, m4);
    }
    this.group.add(inst);
  }

  // ───── 水門: 両側の柱・角落としの板・上の足場 ─────
  buildGate() {
    const s = S_GATE;
    const f = floorC(s - 0.1);
    const g0 = groundAt(s);
    const wood = patchMaterial(new THREE.MeshStandardMaterial({ color: '#3b2f22', roughness: 0.85 }), {
      fx: {
        key: 'boardWood',
        color: /* glsl */ `
          float gr = un_vn(vec2(vWPos.x * 30.0, vWPos.y * 3.0));
          diffuseColor.rgb *= 0.75 + gr * 0.4;
          float lv = ditchLevel(vec3(0.0, vWPos.y, vWPos.z + 0.1));
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.08, 0.12, 0.04), smoothstep(0.05, -0.05, vWPos.y - lv) * 0.6);
        `,
      },
    });
    // 柱
    for (const side of [-1, 1]) {
      const pier = new THREE.Mesh(new THREE.BoxGeometry(0.4, g0 + 0.55 - f + 0.3, 0.6), this.concrete);
      pier.position.set(side * (HW + 0.2), (g0 + 0.55 + f - 0.3) / 2, -s);
      pier.castShadow = pier.receiveShadow = true;
      this.group.add(pier);
      // 溝の鉄のみぞ
      const groove = new THREE.Mesh(new THREE.BoxGeometry(0.06, g0 + 0.5 - f, 0.14), this.rust);
      groove.position.set(side * (HW - 0.01), (g0 + 0.5 + f) / 2, -s);
      this.group.add(groove);
    }
    // 角落としの板（上の水位のすぐ下まで）
    const topB = levelAt(s + 0.5) - 0.03;
    const n = Math.ceil((topB - f) / 0.16);
    const bh = (topB - f) / n;
    for (let i = 0; i < n; i++) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(HW * 2, bh - 0.008, 0.06), wood);
      b.position.set(0, f + bh * (i + 0.5), -s);
      b.rotation.z = (Math.random() - 0.5) * 0.01;
      b.castShadow = b.receiveShadow = true;
      this.group.add(b);
    }
    this.gateTop = topB;
    // 上の足場（縞鋼板）と手すり
    const deck = new THREE.Mesh(new THREE.BoxGeometry(HW * 2 + 0.8, 0.04, 0.7), this.steel);
    deck.position.set(0, g0 + 0.55, -s);
    deck.castShadow = deck.receiveShadow = true;
    this.group.add(deck);
    const railMat = patchMaterial(new THREE.MeshStandardMaterial({ color: '#b8b34a', roughness: 0.6, metalness: 0.3 }), {});
    for (const dz of [-0.33, 0.33]) {
      const r = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, HW * 2 + 0.8, 8), railMat);
      r.rotation.z = Math.PI / 2;
      r.position.set(0, g0 + 1.4, -s + dz);
      this.group.add(r);
      for (const x of [-(HW + 0.35), HW + 0.35]) {
        const p = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.85, 8), railMat);
        p.position.set(x, g0 + 0.98, -s + dz);
        this.group.add(p);
      }
    }
  }

  // ───── 下流の端: ごみよけの格子と、川へくぐる暗渠の口 ─────
  buildGrate() {
    const s = S_GRATE;
    const f = floorC(s);
    const top = groundAt(s) + 0.05;
    const bars = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.009, 0.009, top - f, 6), this.rust, 24);
    const m4 = new THREE.Matrix4();
    for (let i = 0; i < 24; i++) {
      m4.makeRotationX(-0.25);
      m4.setPosition(-HW + 0.025 + i * (HW * 2 - 0.05) / 23, (top + f) / 2, -s + 0.1);
      bars.setMatrixAt(i, m4);
    }
    bars.castShadow = true;
    this.group.add(bars);
    for (const y of [f + 0.5, top - 0.05]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(HW * 2, 0.05, 0.012), this.rust);
      rail.position.set(0, y, -s + 0.1 - (y - (top + f) / 2) * Math.tan(0.25));
      this.group.add(rail);
    }
    // 格子に引っかかった草くず
    const trash = new THREE.Mesh(new THREE.BoxGeometry(HW * 2 - 0.1, 0.1, 0.05), patchMaterial(new THREE.MeshStandardMaterial({ color: '#3a3520', roughness: 1 }), {}));
    trash.position.set(0, levelAt(s) - 0.02, -s + 0.12);
    this.group.add(trash);
    // 暗渠の口（奥）
    const hs = S_GRATE - 3.5;
    const wall = new THREE.Mesh(new THREE.BoxGeometry(HW * 2 + 0.6, top - f + 0.4, 0.3), this.concrete);
    wall.position.set(0, (top + f) / 2, -hs + 0.15);
    this.group.add(wall);
    const hole = new THREE.Mesh(new THREE.CircleGeometry(0.45, 32), this.dark);
    hole.position.set(0, f + 0.42, -hs - 0.01);
    this.group.add(hole);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.47, 0.04, 8, 32), this.concrete);
    ring.position.copy(hole.position);
    this.group.add(ring);
  }

  // ───── 田んぼからの排水パイプ ─────
  buildPipes() {
    const pvc = patchMaterial(new THREE.MeshStandardMaterial({ color: '#8d9290', roughness: 0.55 }), {
      fx: { key: 'pvc', color: `diffuseColor.rgb *= 0.7 + 0.3 * un_vn(vWPos.xz * 20.0); diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.2, 0.18, 0.1), smoothstep(0.0, -0.04, vWPos.y - ditchLevel(vec3(clamp(vWPos.x, -0.55, 0.55), vWPos.y, vWPos.z)) - 0.25) * 0.5);` },
    });
    this.pipeOut = [];
    for (const p of PIPES) {
      const y = floorC(p.s) + p.y;
      const g = new THREE.Group();
      if (p.kind === 'pvc') {
        const len = 0.16;
        const tube = new THREE.Mesh(new THREE.CylinderGeometry(p.r, p.r, len, 18, 1, true), pvc);
        tube.material.side = THREE.DoubleSide;
        tube.rotation.z = Math.PI / 2;
        tube.position.set(p.side * (HW - len / 2 + 0.03), y, -p.s);
        const lip = new THREE.Mesh(new THREE.TorusGeometry(p.r, 0.004, 6, 18), pvc);
        lip.rotation.y = Math.PI / 2;
        lip.position.set(p.side * (HW - len + 0.03), y, -p.s);
        const inside = new THREE.Mesh(new THREE.CircleGeometry(p.r * 0.97, 18), this.dark);
        inside.rotation.y = p.side > 0 ? -Math.PI / 2 : Math.PI / 2;
        inside.position.set(p.side * (HW - 0.02), y, -p.s);
        g.add(tube, lip, inside);
        this.pipeOut.push({ ...p, x: p.side * (HW - len + 0.03), y: y - p.r * 0.7, z: -p.s });
      } else {
        // ヒューム管（壁と面一の丸い口）
        const ring = new THREE.Mesh(new THREE.TorusGeometry(p.r + 0.02, 0.03, 8, 26), this.concrete);
        ring.rotation.y = Math.PI / 2;
        ring.position.set(p.side * (HW - 0.01), y, -p.s);
        const inside = new THREE.Mesh(new THREE.CircleGeometry(p.r, 26), this.dark);
        inside.rotation.y = p.side > 0 ? -Math.PI / 2 : Math.PI / 2;
        inside.position.set(p.side * (HW + 0.005), y, -p.s);
        g.add(ring, inside);
        this.pipeOut.push({ ...p, x: p.side * (HW - 0.01), y: y - p.r * 0.8, z: -p.s });
      }
      g.traverse((o) => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
      this.group.add(g);
    }
  }

  // ───── はしご（壁の鉄の足掛け） ─────
  buildLadders() {
    // U 字の鉄の足掛け: 両はしが壁にささり、横棒が壁から 12cm 出る
    const path = new THREE.CatmullRomCurve3([V3(0, 0, -0.16), V3(0.1, 0, -0.16), V3(0.125, 0, -0.13), V3(0.125, 0, 0.13), V3(0.1, 0, 0.16), V3(0, 0, 0.16)]);
    const geo = new THREE.TubeGeometry(path, 24, 0.011, 6, false);
    for (const L of LADDERS) {
      const f = floorC(L.s);
      const top = groundAt(L.s);
      for (let y = f + 0.3; y < top - 0.05; y += 0.28) {
        const r = new THREE.Mesh(geo, this.rust);
        if (L.side > 0) r.rotation.y = Math.PI;
        r.position.set(L.side * HW, y, -L.s);
        r.castShadow = true;
        this.group.add(r);
      }
    }
  }

  // ───── 水抜き穴 ─────
  buildWeepHoles() {
    const holes = weepHoles();
    const geo = new THREE.CircleGeometry(0.03, 14);
    const inst = new THREE.InstancedMesh(geo, this.dark, holes.length);
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    holes.forEach((h, i) => {
      q.setFromAxisAngle(V3(0, 1, 0), h.side > 0 ? -Math.PI / 2 : Math.PI / 2);
      m4.compose(V3(h.side * (HW - 0.002), h.y, -h.s), q, V3(1, 1, 1));
      inst.setMatrixAt(i, m4);
    });
    this.group.add(inst);
    this.weeps = holes;
  }
}

export { S_END };
