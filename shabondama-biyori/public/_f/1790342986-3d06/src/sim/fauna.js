// 生き物の暮らし：白鷺・スズメ・セキレイ・ツバメ・鳶・カルガモ・カエル・魚・ウサギ・鹿
// それぞれ住む場所から生まれ、決まった仕草をくり返し、しゃぼん玉（視点）が近づくと逃げる
import { Herd, Contacts } from '../render/creatures.js';
import * as S from '../render/species.js';
import { T } from '../world/gen.js';
import { riverZ, riverDZ, riverLevel, POND, HOUSES, GORGE, gorgeWorld, streamA, RIDGE, KNOLL, floorT } from '../world/layout.js';
import { mulberry32, clamp, lerp, smoothstep } from '../util/noise.js';

const TAU = Math.PI * 2;
const wrapPi = (a) => { while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a; };
const yawTo = (dx, dz) => Math.atan2(dx, dz);
const turnTo = (a, b, k) => a + wrapPi(b - a) * k;

export class Fauna {
  constructor({ shared, world, groundAt, poles, rings }) {
    this.world = world;
    this.groundAt = groundAt;
    this.shared = shared;
    this.rings = rings;           // (x, z, 強さ) → 水の輪
    this.r = mulberry32((Math.random() * 1e9) | 0);
    this.t = 0;
    const N = world.N;
    this.texel = (x, z) => {
      const i = clamp(Math.round((x - world.ORIGIN) / world.CELL), 0, N - 1), j = clamp(Math.round((z - world.ORIGIN) / world.CELL), 0, N - 1);
      return j * N + i;
    };
    this.typeAt = (x, z) => world.type[this.texel(x, z)];
    this.waterAt = (x, z) => world.water[this.texel(x, z)];
    // 描く入れ物
    // 描く入れ物：近景（細かい形）と遠景（粗い形）の2段。lod＝切りかえの距離(m)
    const H = (geo, anim, o) => new Herd(shared, [geo(1), geo(0.45)], anim, o);
    this.h = {
      egret: H(S.egretGeo, S.EGRET_ANIM, { cap: 48, shadow: true, gloss: 0.03, lod: 40 }),
      sparrow: H(S.sparrowGeo, S.SMALLBIRD_ANIM, { cap: 240, lod: 12 }),
      wagtail: H(S.wagtailGeo, S.SMALLBIRD_ANIM, { cap: 24, lod: 12 }),
      swallow: H(S.swallowGeo, S.SWALLOW_ANIM, { cap: 20, lod: 16 }),
      kite: H(S.kiteGeo, S.KITE_ANIM, { cap: 10, lod: 70 }),
      duck: H(S.duckGeo, S.DUCK_ANIM, { cap: 40, gloss: 0.04, lod: 25 }),
      duckling: H(S.ducklingGeo, S.DUCKLING_ANIM, { cap: 24, gloss: 0.02, lod: 12 }),
      frog: H(S.frogGeo, S.FROG_ANIM, { cap: 220, gloss: 0.25, lod: 5 }),
      rfish: H(S.riverFishGeo, S.RIVERFISH_ANIM, { cap: 320, gloss: 0.3, lod: 7 }),
      trout: H(S.troutGeo, S.FISH_ANIM, { cap: 48, gloss: 0.25, lod: 9 }),
      carp: H(S.carpGeo, S.CARP_ANIM, { cap: 32, gloss: 0.25, lod: 14 }),
      rabbit: H(S.rabbitGeo, S.RABBIT_ANIM, { cap: 32, shadow: true, lod: 25 }),
      deer: H(S.deerGeo, S.DEER_ANIM, { cap: 20, shadow: true, lod: 45 }),
    };
    for (const [k, h] of Object.entries(this.h)) { h.name = k; h.key = '_lv_' + k; }
    // 足元の陰（小さな生き物・細い脚の接地）
    this.contacts = new Contacts(shared, 900);
    this.meshes = [...Object.values(this.h).flatMap((h) => h.meshes), this.contacts.mesh];
    this._habitats(poles);
    this._spawn();
  }

  // ---- 住む場所を世界から拾う ----
  _habitats(poles) {
    const W = this.world, r = this.r;
    const N = W.N;
    // 水を張った田の中（白鷺）と、その畦（カエル）
    this.paddyWater = [];
    for (let q = 0; q < 60000 && this.paddyWater.length < 900; q++) {
      const i = 1 + Math.floor(r() * (N - 2)), j = 1 + Math.floor(r() * (N - 2));
      const k = j * N + i;
      const t = W.type[k];
      if ((t === T.FLOODED || t === T.SEEDLING) && W.water[k] > -1000 && W.sdf[k] > 1.2) this.paddyWater.push([W.ORIGIN + i * W.CELL, W.ORIGIN + j * W.CELL]);
    }
    // 電線（スズメがとまる）：柱の間の垂れた線
    this.wires = [];
    for (let i = 1; i < poles.length; i++) {
      const p0 = poles[i - 1], p1 = poles[i];
      if (Math.hypot(p1.x - p0.x, p1.z - p0.z) > 60) continue;
      for (const o of [-0.75, 0.75]) {
        const off = (p) => { const c = Math.cos(-p.dir), s = Math.sin(-p.dir); return [p.x + o * s, p.y + 8.34, p.z + o * c]; };
        const a = off(p0), b = off(p1);
        const L = Math.hypot(b[0] - a[0], b[2] - a[2]);
        this.wires.push({ a, b, sag: 0.012 * L * L / 8 + 0.25, L });
      }
    }
    // 屋根の棟
    this.ridges = HOUSES.filter((h) => h.info && h.y !== undefined).map((h) => {
      const c = Math.cos(h.rot), s = Math.sin(h.rot), hw = h.w * 0.38;
      return { a: [h.x - c * hw, h.y + h.info.top - 0.05, h.z + s * hw], b: [h.x + c * hw, h.y + h.info.top - 0.05, h.z - s * hw], L: hw * 2 };
    });
    // 庭（スズメが地面でついばむ）
    // 家の前の庭（家の中に入らないよう、敷地の前寄り）と畑
    this.yards = [];
    for (const p of W.plots) for (const k of [0.3, 0.4]) this.yards.push([p.cx + p.s * p.pd * k, p.cz + p.c * p.pd * k]);
    for (const g of W.gardens || []) this.yards.push([g.cx, g.cz]);
    // 原っぱ（ウサギ）：丘の草地の空き地・山の上・一本桜の小丘
    this.meadows = [[RIDGE.x + 6, RIDGE.z + 6], [RIDGE.x - 8, RIDGE.z + 30], [RIDGE.x + 14, RIDGE.z + 55]];
    for (let q = 0; q < 60000 && this.meadows.length < 40; q++) {
      const x = (r() - 0.5) * 1400, z = (r() - 0.5) * 1400;
      const k = this.texel(x, z);
      if (W.type[k] !== T.MEADOW || floorT(x, z) < 22 || W.forest[k] > 0.1) continue;
      // まわりも原っぱ
      let ok = true;
      for (const [dx, dz] of [[6, 0], [-6, 0], [0, 6], [0, -6]]) if (W.type[this.texel(x + dx, z + dz)] !== T.MEADOW) ok = false;
      if (ok) this.meadows.push([x, z]);
    }
  }

  _spawn() {
    const r = this.r;
    const pick = (arr) => arr[Math.floor(r() * arr.length)];
    // 白鷺
    this.egrets = [];
    // 田のコサギ（うち3羽はアオサギ：大きく灰色で、より遠くで逃げる）
    for (let i = 0; i < 24 && this.paddyWater.length; i++) {
      const [x, z] = pick(this.paddyWater);
      const heron = i % 8 === 3;
      this.egrets.push({ x, z, y: this.groundAt(x, z), yaw: r() * TAU, st: 'stand', t: r() * 5, walk: 0, wph: 0, neck: 0, fly: 0, flap: 0, vy: 0, target: null, next: 4 + r() * 10, heron, s: heron ? 1.55 : 0.95 + r() * 0.1 });
    }
    // スズメの群れ：電線・棟・庭
    this.flocks = [];
    for (let f = 0; f < 12; f++) {
      const n = 6 + Math.floor(r() * 9);
      const fl = { birds: [], st: 'perch', t: 0, next: 15 + r() * 30, perch: null };
      for (let i = 0; i < n; i++) fl.birds.push({ x: 0, y: 0, z: 0, yaw: 0, fly: 0, flap: r() * 6, head: 0, tail: 0, look: 0, lookT: 0, s: 0.94 + r() * 0.12, off: [(r() - 0.5) * 2.4, (r() - 0.5) * 0.8, (r() - 0.5) * 2.4], ph: r() * 10, hop: 0 });
      this._setPerch(fl, true);
      this.flocks.push(fl);
    }
    // セキレイ：滝つぼと渓流の岩・川べり
    this.wagtails = [];
    const wagSpots = [];
    for (const q of this.world.rocks) if (q.wet > 0.3 && q.s < 1.6 && !q.buried) wagSpots.push([q.x, q.y + q.s * (0.2 + 0.62 * q.flat) * 0.95, q.z]);
    for (let x = -700; x < 500; x += 90) { const zr = riverZ(x) + (r() < 0.5 ? -4.6 : 4.6); wagSpots.push([x, this.groundAt(x, zr) + 0.02, zr]); }
    this.wagSpots = wagSpots;
    // セグロセキレイと、キセキレイ（3羽に1羽）
    for (let i = 0; i < 14 && wagSpots.length; i++) {
      const s = pick(wagSpots);
      this.wagtails.push({ x: s[0], y: s[1], z: s[2], yaw: r() * TAU, st: 'stand', t: 0, next: 1 + r() * 3, fly: 0, flap: 0, head: 0, tail: 0, target: null, yellow: i % 3 === 1 ? 1 : 0, look: 0 });
    }
    // ツバメ（視点のまわりに現れる）
    this.swallows = [];
    for (let i = 0; i < 12; i++) this.swallows.push({ x: 0, y: -999, z: 0, vx: 0, vy: 0, vz: 0, yaw: 0, roll: 0, flapAmt: 1, ph: r() * 6, gl: 0, target: null, alive: false, skim: 0 });
    // 鳶：谷の上で輪を描く
    this.kites = [];
    for (let i = 0; i < 8; i++) this.kites.push({ cx: (r() - 0.5) * 900, cz: (r() - 0.5) * 500 - 60, R: 40 + r() * 55, h: 55 + r() * 95, w: (r() < 0.5 ? -1 : 1) * (0.09 + r() * 0.05), a: r() * TAU, flap: 0, fb: 0, ph: r() * 6, x: 0, y: 0, z: 0, yaw: 0 });
    // カルガモ：池の親子と大人、川のつがい
    this.ducks = [];
    const pondY = this.world.pondLevel;
    const mother = { home: 'pond', x: POND.x, z: POND.z, y: pondY, yaw: 0, spd: 0.3, tx: POND.x, tz: POND.z, dab: 0, head: 0, ph: 0, kid: false, lead: null, wake: 0 };
    this.ducks.push(mother);
    let prev = mother;
    for (let i = 0; i < 7; i++) { const d = { home: 'pond', x: POND.x - 1 - i * 0.4, z: POND.z, y: pondY, yaw: 0, spd: 0.3, dab: 0, head: 0, ph: r() * 6, kid: true, lead: prev, wake: 0 }; this.ducks.push(d); prev = d; }
    // もう一組の親子（ひなは少し大きい）
    const mother2 = { home: 'pond', x: POND.x + 10, z: POND.z - 6, y: pondY, yaw: 2, spd: 0.25, tx: POND.x, tz: POND.z, dab: 0, head: 0, ph: 1, kid: false, lead: null, wake: 0 };
    this.ducks.push(mother2);
    prev = mother2;
    for (let i = 0; i < 5; i++) { const d = { home: 'pond', x: mother2.x - 1 - i * 0.4, z: mother2.z, y: pondY, yaw: 0, spd: 0.3, dab: 0, head: 0, ph: r() * 6, kid: true, lead: prev, wake: 0, ks: 1.2 }; this.ducks.push(d); prev = d; }
    for (let i = 0; i < 5; i++) this.ducks.push({ home: 'pond', x: POND.x + (r() - 0.5) * 30, z: POND.z + (r() - 0.5) * 20, y: pondY, yaw: r() * TAU, spd: 0.25, tx: POND.x, tz: POND.z, dab: 0, head: 0, ph: r() * 6, kid: false, lead: null, wake: 0 });
    for (const x0 of [-262, -250, -120, -112, 60, 70, 205, 214, 330, 338]) {
      const zr = riverZ(x0);
      this.ducks.push({ home: 'river', x: x0, z: zr, y: riverLevel(x0), yaw: r() * TAU, spd: 0.25, tx: x0, tz: zr, dab: 0, head: 0, ph: r() * 6, kid: false, lead: null, wake: 0, rx0: x0 });
    }
    // カエル：視点のまわりの畦に、格子ごとに決まった数だけ（状態は近くにいる間だけ持つ）
    this.frogCell = 9;
    this.frogs = new Map();
    // 魚：池の鯉、滝つぼと渓流のヤマメ、川のオイカワの群れ（視点の近くで生まれる）
    this.carps = [];
    for (let i = 0; i < 20; i++) this.carps.push({ a: r() * TAU, rr: 0.25 + r() * 0.6, w: (r() < 0.5 ? -1 : 1) * (0.03 + r() * 0.03), d: 0.3 + r() * 0.55, ph: r() * 6, s: 0.35 + r() * 0.35, col: [1, 2, 0, 0, 3, 1, 0, 2][i % 8], id: r() });
    this.trouts = [];
    const [px, py, pz] = this.world.gorge.pool;
    for (let i = 0; i < 10; i++) this.trouts.push({ home: 'pool', x: px + (r() - 0.5) * 6, z: pz + (r() - 0.5) * 6, y: py - 0.5 - r() * 1.0, yaw: r() * TAU, ph: r() * 6, s: 0.15 + r() * 0.07, dart: 0 });
    for (const c of this.world.gorge.cascades.slice(1, -1)) {
      if (r() < 0.2) continue;
      // 落ち口の下の淵で、上流へ頭を向けて定位（1〜2尾）
      const yaw0 = yawTo(-c.dir[0], -c.dir[1]);
      const n = r() < 0.5 ? 2 : 1;
      for (let k = 0; k < n; k++) this.trouts.push({ home: 'stream', x: c.plunge[0] + (r() - 0.5) * 0.8, z: c.plunge[1] + (r() - 0.5) * 0.8, y: c.bottom - 0.3, yaw: yaw0, yaw0, ph: r() * 6, s: 0.12 + r() * 0.06, dart: 0 });
    }
    this.schools = new Map();
    this.jumpT = 8;
    // ウサギ
    this.rabbits = [];
    for (let i = 0; i < 24 && this.meadows.length; i++) {
      const [x, z] = i < 3 ? this.meadows[i] : pick(this.meadows);
      this.rabbits.push({ x: x + (r() - 0.5) * 6, z: z + (r() - 0.5) * 6, y: this.groundAt(x, z), yaw: r() * TAU, st: 'graze', t: 0, next: 3 + r() * 6, hop: 0, hopAmp: 0, head: 0.8, ear: 0, hops: 0, home: [x, z], ph: 0, id: r() });
    }
    // 鹿：山の上の原っぱと、滝の上の林の空き地
    this.deers = [];
    const [cx, cz] = gorgeWorld(GORGE.sCliff + 26, -20);
    const m3 = this.meadows[3 + Math.floor(r() * Math.max(1, this.meadows.length - 3))] || [RIDGE.x - 8, RIDGE.z + 30];
    const herds = [[RIDGE.x + 10, RIDGE.z + 62, 5], [cx, cz, 4], [m3[0], m3[1], 5]];
    for (const [hx, hz, n] of herds) for (let i = 0; i < n; i++) {
      // 群れに雄が1頭（袋角）。子鹿は小さい
      this.deers.push({ x: hx + (r() - 0.5) * 10, z: hz + (r() - 0.5) * 10, y: this.groundAt(hx, hz), yaw: r() * TAU, st: 'graze', t: 0, next: 4 + r() * 8, ph: r() * 6, amp: 0, neck: 1, ear: 0.3, home: [hx, hz], spd: 0, id: r(), male: i === 0 ? 1 : 0, s: i === 0 ? 0.92 : i === n - 1 && n > 3 ? 0.6 : 0.8 + r() * 0.06 });
    }
  }

  // スズメの群れの止まり場所を選ぶ（電線・棟・庭）
  _setPerch(fl, instant = false) {
    const r = this.r;
    const u = r();
    let perch;
    if (u < 0.5 && this.wires.length) {
      const w = this.wires[Math.floor(r() * this.wires.length)];
      const t0 = 0.2 + r() * 0.5;
      perch = { kind: 'line', line: w, t0, span: Math.min(0.3, 3.5 / w.L) };
    } else if (u < 0.75 && this.ridges.length) {
      const w = this.ridges[Math.floor(r() * this.ridges.length)];
      perch = { kind: 'line', line: { a: w.a, b: w.b, sag: 0, L: w.L }, t0: 0.1 + r() * 0.3, span: 0.6 };
    } else {
      const [x, z] = this.yards[Math.floor(r() * this.yards.length)];
      perch = { kind: 'ground', x: x + (r() - 0.5) * 8, z: z + (r() - 0.5) * 8 };
    }
    fl.perch = perch;
    const placed = [];
    fl.birds.forEach((b, i) => {
      let p = this._perchPos(perch, i, fl.birds.length);
      // 地面では仲間と重ならない場所へ
      for (let q = 0; q < 8 && perch.kind === 'ground' && placed.some((o) => Math.hypot(o[0] - p[0], o[2] - p[2]) < 0.16); q++) p = this._perchPos(perch, i, fl.birds.length);
      placed.push(p);
      b.px = p[0]; b.py = p[1]; b.pz = p[2]; b.pyaw = p[3];
      if (instant) { b.x = p[0]; b.y = p[1]; b.z = p[2]; b.yaw = p[3]; b.fly = 0; }
    });
  }
  _perchPos(perch, i, n) {
    const r = this.r;
    if (perch.kind === 'line') {
      const { a, b, sag } = perch.line;
      const t = clamp(perch.t0 + (i / Math.max(1, n - 1)) * perch.span + (r() - 0.5) * 0.01, 0.02, 0.98);
      const x = a[0] + (b[0] - a[0]) * t, z = a[2] + (b[2] - a[2]) * t;
      const y = a[1] + (b[1] - a[1]) * t - sag * 4 * t * (1 - t) + 0.036;
      // 線に直角に向く（どちらか）
      const d = yawTo(b[0] - a[0], b[2] - a[2]) + (r() < 0.5 ? 1 : -1) * Math.PI / 2 + (r() - 0.5) * 0.4;
      return [x, y, z, d];
    }
    const x = perch.x + (r() - 0.5) * 5, z = perch.z + (r() - 0.5) * 5;
    return [x, this.groundAt(x, z) + 0.036, z, r() * TAU];
  }

  update(dt, cam) {
    this.t += dt;
    const r = this.r;
    const cx = cam.x, cy = cam.y, cz = cam.z;
    // 確かめ用：calm のときは逃げない（しゃぼん玉の距離を遠くに見せる）
    const K = this.calm ? 1e-3 : 1;
    const d3 = (x, y, z) => Math.hypot(x - cx, y - cy, z - cz);
    const d3t = (x, y, z) => d3(x, y, z) / K;
    for (const h of Object.values(this.h)) h.begin();
    const CT = this.contacts;
    CT.begin();
    // 体の座標 (lx, lz) の足元に陰を置く
    // 細い脚の日の影：影の地図では細すぎて消えるので、足から日と反対の向きへ細長い陰を伸ばす（体の影とつながる）
    const sd = this.shared.uSunDir.value, sxz = Math.hypot(sd.x, sd.z);
    const legK = sd.y > 0.06 ? smoothstep(0.06, 0.2, sd.y) : 0;
    const lyaw = Math.atan2(-sd.x, -sd.z), ltan = sxz / Math.max(sd.y, 0.2);
    const legSh = (fx, fz, H, w, k, h) => {
      if (legK <= 0) return;
      const L = Math.min(H * ltan, 3.5), hx = Math.sin(lyaw) * L * 0.5, hz = Math.cos(lyaw) * L * 0.5;
      CT.push(fx + hx, fz + hz, w, L * 0.5 + w, lyaw, k * legK, h);
    };
    // 小さな体の日の影：体の中心の高さ h0 から日と反対の向きへずらした楕円
    const sunBlob = (x, z, h0, rx, rz, yaw, k, h) => {
      if (legK <= 0) return;
      const L = Math.min((h0 + h) * ltan, 2);
      CT.push(x + Math.sin(lyaw) * L, z + Math.cos(lyaw) * L, rx, rz, yaw, k * legK, h);
    };
    // 遠くの端で消えるように薄める（境目でパッと消えない）
    const fd = (d, R) => clamp((R - d) / (0.3 * R), 0, 1);
    const ctp = (x, z, yaw, lx, lz, rx, rz, k, h) => { const c = Math.cos(yaw), s = Math.sin(yaw); CT.push(x + lx * c + lz * s, z - lx * s + lz * c, rx, rz, yaw, k, h); };

    // ---- 白鷺 ----
    for (const e of this.egrets) {
      const dc = d3(e.x, e.y + 0.4, e.z);
      e.t += dt;
      if (e.st !== 'fly' && d3t(e.x, e.y + 0.4, e.z) < (e.heron ? 19 : 13)) { e.st = 'fly'; e.t = 0; e.target = this._egretTarget(e); e.vy = 1.6; }
      if (e.st === 'stand') {
        e.neck += (0 - e.neck) * (1 - Math.exp(-dt * 3));
        e.walk += (0 - e.walk) * (1 - Math.exp(-dt * 4));
        if (e.t > e.next) {
          const u = r();
          e.t = 0;
          if (u < 0.45) { e.st = 'walk'; e.next = 2 + r() * 4; e.yaw += (r() - 0.5) * 1.6; }
          else if (u < 0.75) { e.st = 'strike'; e.next = 0.9; }
          else if (u < 0.85) { e.st = 'fly'; e.target = this._egretTarget(e); e.vy = 1.4; }
          else { e.next = 3 + r() * 8; }
        }
      } else if (e.st === 'walk') {
        e.walk += (1 - e.walk) * (1 - Math.exp(-dt * 3));
        e.wph += dt * 3.2;
        // 歩くたびに首を前へ突き出す
        e.neck += (0.18 + 0.22 * Math.sin(e.wph * 2 - 0.6) - e.neck) * (1 - Math.exp(-dt * 10));
        const sp = 0.22 * e.walk * (e.heron ? 1.4 : 1);
        const nx = e.x + Math.sin(e.yaw) * sp * dt, nz = e.z + Math.cos(e.yaw) * sp * dt;
        const tp = this.typeAt(nx, nz);
        if (tp === T.FLOODED || tp === T.SEEDLING || tp === T.RIVER || tp === T.BANK) { e.x = nx; e.z = nz; } else e.yaw += 1.5 * dt;
        if (e.t > e.next) { e.st = 'stand'; e.t = 0; e.next = 3 + r() * 8; }
      } else if (e.st === 'strike') {
        const u = e.t / e.next;
        e.neck = u < 0.25 ? u / 0.25 : 1 - (u - 0.25) / 0.75;
        if (e.t > e.next) { e.st = 'stand'; e.t = 0; e.next = 3 + r() * 9; }
      } else if (e.st === 'fly') {
        // 飛び立つ→上がって進む→降りる
        e.fly = Math.min(1, e.fly + dt * 3);
        e.flap += dt * TAU * 2.3;
        const tx = e.target[0], tz = e.target[1];
        const dx = tx - e.x, dz = tz - e.z, dl = Math.hypot(dx, dz);
        const gy = this.groundAt(e.x, e.z);
        const cruise = Math.min(14, 4 + dl * 0.15);
        const want = dl > 25 ? gy + cruise : this.groundAt(tx, tz) + 0.02;
        e.vy += ((want - e.y) * 0.8 - e.vy) * (1 - Math.exp(-dt * 1.2));
        const sp = dl > 20 ? 5.2 : Math.max(0.6, dl * 0.26);
        e.yaw = turnTo(e.yaw, yawTo(dx, dz), 1 - Math.exp(-dt * 1.5));
        e.x += Math.sin(e.yaw) * sp * dt; e.z += Math.cos(e.yaw) * sp * dt;
        e.y += e.vy * dt;
        e.neck += (-1 - e.neck) * (1 - Math.exp(-dt * 2));
        if (dl < 0.6 && Math.abs(e.y - this.groundAt(tx, tz)) < 0.25) { e.st = 'stand'; e.t = 0; e.fly = 0; e.y = this.groundAt(e.x, e.z); e.next = 4 + r() * 8; }
      }
      if (e.st !== 'fly') { e.y = this.groundAt(e.x, e.z) - 0.02; e.fly = Math.max(0, e.fly - dt * 2); }
      if (dc < 50 && e.fly < 0.5) {
        const h = e.y + 0.02 - this.groundAt(e.x, e.z), S = e.s;
        // 水の中（田・浅瀬）では描かない（水面の下の川床に落ちてしまう）
        if (!(this.waterAt(e.x, e.z) > this.groundAt(e.x, e.z) - 0.005)) {
          ctp(e.x, e.z, e.yaw, 0, -0.02 * S, 0.12 * S, 0.22 * S, 0.3 * fd(dc, 50), h);
          const c = Math.cos(e.yaw), sn = Math.sin(e.yaw);
          for (const sx of [-1, 1]) {
            ctp(e.x, e.z, e.yaw, sx * 0.03 * S, 0.022 * S, 0.045 * S, 0.06 * S, 0.75 * fd(dc, 50), h);
            const lx = sx * 0.03 * S;
            legSh(e.x + lx * c, e.z - lx * sn, 0.29 * S, 0.016 * S, 0.45 * fd(dc, 50), h);
          }
        }
      }
      if (dc < 450) this.h.egret.lv(dc, e).push(e.x, e.y, e.z, e.yaw, e.st === 'fly' ? -0.05 : 0, 0, e.s, this.t, e.fly, e.flap, e.neck, e.wph, e.walk, 0, e.heron ? 1 : 0);
    }

    // ---- スズメの群れ ----
    for (const fl of this.flocks) {
      fl.t += dt;
      const b0 = fl.birds[0];
      const threat = d3t(b0.x, b0.y, b0.z) < 7;
      if (fl.st === 'perch' && (fl.t > fl.next || threat)) {
        fl.st = 'fly'; fl.t = 0;
        this._setPerch(fl);
        for (const b of fl.birds) { b.fx0 = b.x; b.fy0 = b.y; b.fz0 = b.z; b.dly = r() * 0.5; b.dur = 0; }
      }
      for (const [i, b] of fl.birds.entries()) {
        if (fl.st === 'fly') {
          const tt = Math.max(0, fl.t - b.dly);
          const D = Math.hypot(b.px - b.fx0, b.pz - b.fz0) || 1;
          const dur = Math.max(1.2, D / 7.5);
          const u = Math.min(1, tt / dur);
          const e = u * u * (3 - 2 * u);
          const arc = Math.min(8, D * 0.18) * Math.sin(Math.PI * u) + 0.25 * Math.sin(tt * 9 + b.ph) * (1 - u);
          const nx = lerp(b.fx0, b.px, e), nz = lerp(b.fz0, b.pz, e), ny = lerp(b.fy0, b.py, e) + arc;
          if (u < 0.999) b.yaw = yawTo(nx - b.x, nz - b.z) || b.yaw;
          b.x = nx; b.y = ny; b.z = nz;
          b.fly = u < 0.97 ? 1 : 0;
          // 羽ばたいて、翼を閉じて、また羽ばたく（波形の飛び方）
          const bout = (tt * 3.2 + b.ph) % 1;
          b.flap += dt * TAU * (bout < 0.6 ? 16 : 0);
          if (bout >= 0.6) b.flap = Math.PI * 1.5;
          if (u >= 1) b.done = true;
        } else {
          b.fly = 0;
          b.head = fl.perch && fl.perch.kind === 'ground' ? (Math.sin(this.t * 3 + b.ph * 3) > 0.6 ? 0.9 : 0.1) : Math.sin(this.t * 0.7 + b.ph) * 0.15;
          b.yaw += Math.sin(this.t * 0.5 + b.ph * 7) * 0.4 * dt;
          b.tail = Math.max(0, Math.sin(this.t * 2.3 + b.ph * 5)) ** 8 * 0.5;
          // 首をきょろきょろ：ときどき向きを変えて止まる
          if (r() < dt * 0.9) b.lookT = (r() - 0.5) * 1.8;
          b.look += (b.lookT - b.look) * Math.min(1, dt * 14);
          if (fl.perch && fl.perch.kind === 'ground' && r() < dt * 0.5) {
            // 地面で跳ねる
            const a = r() * TAU, s = 0.15;
            const nx = b.x + Math.sin(a) * s, nz = b.z + Math.cos(a) * s;
            // 跳ぶ先に仲間がいたらやめる（体がめり込まない）
            if (!fl.birds.some((o) => o !== b && Math.hypot(o.x - nx, o.z - nz) < 0.12)) { b.x = nx; b.z = nz; b.y = this.groundAt(b.x, b.z) + 0.036; b.yaw = a; }
          }
        }
        const db = d3(b.x, b.y, b.z);
        if (db < 25 && (b.fly > 0 || (fl.perch && fl.perch.kind === 'ground'))) {
          const h = b.y - 0.036 - this.groundAt(b.x, b.z);
          if (h < 0.3) { ctp(b.x, b.z, b.yaw, 0, 0.004 * b.s, 0.034 * b.s, 0.05 * b.s, 0.6 * fd(db, 25), h); sunBlob(b.x, b.z, 0.05 * b.s, 0.04 * b.s, 0.075 * b.s, b.yaw, 0.5 * fd(db, 25), h); }
        }
        if (db < 150) this.h.sparrow.lv(db, b).push(b.x, b.y, b.z, b.yaw, 0, 0, b.s, this.t, b.fly, b.flap, b.head, b.tail, b.fly > 0 ? 0 : b.look);
      }
      if (fl.st === 'fly' && fl.birds.every((b) => b.done)) { fl.st = 'perch'; fl.t = 0; fl.next = 20 + r() * 40; fl.birds.forEach((b) => { b.done = false; }); }
    }

    // ---- セキレイ ----
    for (const w of this.wagtails) {
      w.t += dt;
      w.tail = Math.sin(this.t * 9 + w.x) * 0.35 + 0.1;
      const dc = d3(w.x, w.y, w.z);
      if (w.st === 'stand') {
        w.head = Math.sin(this.t * 2 + w.z) > 0.7 ? 0.8 : 0.1;
        w.look += ((Math.sin(this.t * 0.8 + w.x) > 0.3 ? 0.6 : -0.3) - w.look) * Math.min(1, dt * 10);
        if (w.t > w.next || dc < 5 * K) {
          w.t = 0;
          if (dc < 5 * K || r() < 0.25) {
            const s = this.wagSpots[Math.floor(r() * this.wagSpots.length)];
            const far = Math.hypot(s[0] - w.x, s[2] - w.z);
            w.target = far < 60 ? s : [w.x + (r() - 0.5) * 12, w.y, w.z + (r() - 0.5) * 12];
            if (!(far < 60)) w.target[1] = this.groundAt(w.target[0], w.target[2]) + 0.04;
            w.st = 'fly'; w.f0 = [w.x, w.y, w.z]; w.dur = Math.max(0.8, Math.hypot(w.target[0] - w.x, w.target[2] - w.z) / 6);
          } else { w.st = 'walk'; w.next = 0.6 + r() * 1.2; w.yaw += (r() - 0.5) * 2; }
        }
      } else if (w.st === 'walk') {
        const nx = w.x + Math.sin(w.yaw) * 0.5 * dt, nz = w.z + Math.cos(w.yaw) * 0.5 * dt;
        const gy = this.groundAt(nx, nz);
        if (Math.abs(gy + 0.04 - w.y) < 0.3 && this.waterAt(nx, nz) < gy) { w.x = nx; w.z = nz; w.y = gy + 0.04; }
        if (w.t > w.next) { w.st = 'stand'; w.t = 0; w.next = 1 + r() * 3; }
      } else {
        const u = Math.min(1, w.t / w.dur);
        const e = u * u * (3 - 2 * u);
        const nx = lerp(w.f0[0], w.target[0], e), nz = lerp(w.f0[2], w.target[2], e);
        w.yaw = yawTo(nx - w.x, nz - w.z) || w.yaw;
        w.x = nx; w.z = nz; w.y = lerp(w.f0[1], w.target[1], e) + Math.sin(Math.PI * u) * 1.2 + Math.abs(Math.sin(w.t * 6)) * 0.3;
        w.fly = u < 0.97 ? 1 : 0;
        w.flap += dt * TAU * ((w.t * 3) % 1 < 0.5 ? 18 : 0);
        if (u >= 1) { w.st = 'stand'; w.t = 0; w.fly = 0; w.next = 1 + r() * 3; }
      }
      if (dc < 25) { const h = w.y - 0.04 - this.groundAt(w.x, w.z); if (h < 0.3) { ctp(w.x, w.z, w.yaw, 0, 0.004, 0.034, 0.055, 0.6 * fd(dc, 25), h); sunBlob(w.x, w.z, 0.055, 0.04, 0.09, w.yaw, 0.5 * fd(dc, 25), h); } }
      if (dc < 80) this.h.wagtail.lv(dc, w).push(w.x, w.y, w.z, w.yaw, 0, 0, 1.12, this.t, w.fly, w.flap, w.head, w.tail, w.fly > 0 ? 0 : w.look, w.yellow);
    }

    // ---- ツバメ：視点のまわりの低いところを飛び回る ----
    const gyC = this.groundAt(cx, cz);
    const valley = floorT(cx, cz) < 40 && cy - gyC < 60;
    for (const s of this.swallows) {
      if (!s.alive || d3(s.x, s.y, s.z) > 140) {
        if (!valley) { s.alive = false; continue; }
        // 視点の後ろ寄りの遠くから現れる
        const a = r() * TAU, d = 70 + r() * 40;
        s.x = cx + Math.sin(a) * d; s.z = cz + Math.cos(a) * d; s.y = this.groundAt(s.x, s.z) + 2 + r() * 5;
        s.yaw = a + Math.PI; s.v = 9 + r() * 3; s.alive = true; s.target = null;
      }
      if (!s.target || Math.hypot(s.target[0] - s.x, s.target[2] - s.z) < 6) {
        const a = r() * TAU, d = 10 + r() * 45;
        const tx = cx + Math.sin(a) * d, tz = cz + Math.cos(a) * d;
        const low = this.waterAt(tx, tz) > this.groundAt(tx, tz) - 0.05 && r() < 0.35;
        s.target = [tx, low ? Math.max(this.waterAt(tx, tz), this.groundAt(tx, tz)) + 0.15 : this.groundAt(tx, tz) + 1 + r() * 6, tz];
      }
      const want = yawTo(s.target[0] - s.x, s.target[2] - s.z);
      const dy = wrapPi(want - s.yaw);
      const turn = clamp(dy, -2.6 * dt, 2.6 * dt);
      s.yaw += turn;
      s.roll += (-(turn / dt) * 0.35 - s.roll) * (1 - Math.exp(-dt * 6));
      s.x += Math.sin(s.yaw) * s.v * dt; s.z += Math.cos(s.yaw) * s.v * dt;
      s.y += (s.target[1] - s.y) * (1 - Math.exp(-dt * 1.4));
      const g = Math.max(this.groundAt(s.x, s.z), this.waterAt(s.x, s.z));
      if (s.y < g + 0.12) s.y = g + 0.12;
      // 水面をかすめる
      if (s.y < g + 0.2 && this.waterAt(s.x, s.z) > this.groundAt(s.x, s.z) - 0.05) { s.skim -= dt; if (s.skim <= 0) { this.rings(s.x, s.z, 0.6); s.skim = 0.5; } }
      const bout = (this.t * 0.9 + s.ph) % 1;
      s.flapAmt += ((bout < 0.55 ? 1 : 0) - s.flapAmt) * (1 - Math.exp(-dt * 10));
      s.ph2 = (s.ph2 || 0) + dt * TAU * 9 * s.flapAmt;
      this.h.swallow.lv(d3(s.x, s.y, s.z), s).push(s.x, s.y, s.z, s.yaw, 0, clamp(s.roll, -1.1, 1.1), 1, this.t, s.flapAmt, s.ph2);
    }

    // ---- 鳶：輪を描いて滑空。輪の中心は風に流され、ときどき羽ばたく ----
    for (const k of this.kites) {
      k.a += k.w * dt;
      k.cx += dt * 0.8; if (k.cx > 600) k.cx -= 1200;
      k.fb -= dt;
      if (k.fb < -18 - k.ph * 3) k.fb = 2.5;
      k.flap += (k.fb > 0 ? 1 : -1) * dt * 2; k.flap = clamp(k.flap, 0, 1);
      k.ph2 = (k.ph2 || 0) + dt * TAU * 1.8 * k.flap;
      const x = k.cx + Math.cos(k.a) * k.R, z = k.cz + Math.sin(k.a) * k.R;
      const y = k.h + Math.sin(this.t * 0.13 + k.ph) * 6 + this.groundAt(x, z) * 0.3;
      const yaw = yawTo(-Math.sin(k.a) * Math.sign(k.w), Math.cos(k.a) * Math.sign(k.w));
      this.h.kite.lv(d3(x, y, z), k).push(x, y, z, yaw, 0, -Math.sign(k.w) * 0.32, 1, this.t, k.flap, k.ph2, -Math.sign(k.w) * 0.35 + 0.15 * Math.sin(this.t * 0.6 + k.ph), 0, 0, k.ph);
    }

    // ---- カルガモ ----
    for (const d of this.ducks) {
      d.ph += dt * 3;
      const dc = d3(d.x, d.y, d.z);
      if (d.kid && d.lead) {
        // ひな：前の一羽を追う
        const dx = d.lead.x - d.x, dz = d.lead.z - d.z, dl = Math.hypot(dx, dz);
        const want = 0.3 * (d.ks || 1);
        if (dl > want) { const s = Math.min(dl - want, 0.9 * dt + (dl - want) * dt * 2); d.x += (dx / dl) * s; d.z += (dz / dl) * s; }
        d.yaw = turnTo(d.yaw, yawTo(dx, dz), 1 - Math.exp(-dt * 4));
        d.y = d.lead.y;
      } else {
        if (d.home === 'pond') {
          const inPond = (x, z) => Math.hypot((x - POND.x) / (POND.rx - 4), (z - POND.z) / (POND.rz - 4)) < 1;
          if (!d.tx || Math.hypot(d.tx - d.x, d.tz - d.z) < 1.5) { for (let q = 0; q < 20; q++) { const tx = POND.x + (r() - 0.5) * POND.rx * 2, tz = POND.z + (r() - 0.5) * POND.rz * 2; if (inPond(tx, tz)) { d.tx = tx; d.tz = tz; break; } } }
        } else if (!d.tx || Math.hypot(d.tx - d.x, d.tz - d.z) < 1.5) {
          const x = clamp(d.x + (r() - 0.45) * 30, d.rx0 - 60, d.rx0 + 60);
          d.tx = x; d.tz = riverZ(x) + (r() - 0.5) * 3;
        }
        let spd = d.spd;
        if (dc < 7 * K) { // 逃げる
          const ax = d.x - cx, az = d.z - cz;
          d.tx = d.x + ax * 2; d.tz = d.z + az * 2; spd = 0.8;
          if (d.home === 'pond' && Math.hypot((d.tx - POND.x) / POND.rx, (d.tz - POND.z) / POND.rz) > 0.85) { d.tx = POND.x; d.tz = POND.z; }
        }
        d.yaw = turnTo(d.yaw, yawTo(d.tx - d.x, d.tz - d.z), 1 - Math.exp(-dt * 1.2));
        if (d.dab > 0) spd = 0;
        d.x += Math.sin(d.yaw) * spd * dt; d.z += Math.cos(d.yaw) * spd * dt;
        d.y = d.home === 'pond' ? this.world.pondLevel : riverLevel(d.x);
        if (d.home === 'river') { d.z += (riverZ(d.x) - d.z) * dt * 0.05; }
        // 逆立ちして水の中の草を食べる
        if (d.dab <= 0 && r() < dt * 0.04 && !d.kid && dc > 10) d.dab = d.dabDur = 2.5 + r() * 2;
        d.dab -= dt;
      }
      d.wake -= dt;
      if (d.wake <= 0 && dc < 70) { this.rings(d.x - Math.sin(d.yaw) * 0.2, d.z - Math.cos(d.yaw) * 0.2, d.kid ? 0.25 : 0.45); d.wake = d.kid ? 1.4 : 0.9; }
      const dab = d.dab > 0 ? smoothstep(0, 0.45, d.dab) * smoothstep(0, 0.45, (d.dabDur || 0) - d.dab) : 0;
      if (dc < 130) {
        if (d.kid) this.h.duckling.lv(dc, d).push(d.x, d.y - 0.004, d.z, d.yaw, 0, 0, d.ks || 1, this.t, d.ph, Math.sin(d.ph * 0.4) * 0.1, 0, 0, 0, 0, 0, 1);
        else this.h.duck.lv(dc, d).push(d.x, d.y - 0.01 - dab * 0.05, d.z, d.yaw, dab * 0.9, 0, 1, this.t, d.ph, dab * 0.6 + Math.sin(d.ph * 0.5) * 0.05);
      }
    }

    // ---- カエル：視点のまわりの畦（格子ごとに決まった場所） ----
    this._frogs(dt, cam);

    // ---- 魚 ----
    this._fish(dt, cam);

    // ---- ウサギ ----
    for (const b of this.rabbits) {
      b.t += dt;
      const dc = d3(b.x, b.y, b.z);
      if (dc > 160 && b.st !== 'flee') { continue; }
      if (dc < 10 * K && b.st !== 'flee') { b.st = 'flee'; b.t = 0; b.yaw = yawTo(b.x - cx, b.z - cz) + (r() - 0.5) * 0.6; b.hops = 8 + Math.floor(r() * 6); b.hop = 0; }
      if (b.st === 'graze') {
        b.head += (1 - b.head) * dt * 2; b.hopAmp += (0 - b.hopAmp) * dt * 6; b.ear += (0.6 - b.ear) * dt;
        if (b.t > b.next) {
          b.t = 0; const u = r();
          if (u < 0.45) { b.st = 'hop'; b.hops = 2 + Math.floor(r() * 4); b.hop = 0; b.yaw += (r() - 0.5) * 2.2; const hx = b.home[0] - b.x, hz = b.home[1] - b.z; if (Math.hypot(hx, hz) > 12) b.yaw = yawTo(hx, hz); }
          else if (u < 0.75) { b.st = 'alert'; b.next = 2 + r() * 3; }
          else b.next = 2 + r() * 5;
        }
      } else if (b.st === 'alert') {
        b.head += (-0.25 - b.head) * dt * 3; b.ear += (0 - b.ear) * dt * 4;
        if (b.t > b.next) { b.st = 'graze'; b.t = 0; b.next = 3 + r() * 6; }
      } else {
        // 跳ねる（逃げるときは速く大きく）
        const fast = b.st === 'flee';
        const rate = fast ? 3.0 : 1.7;
        b.hop += dt * rate;
        b.hopAmp += ((fast ? 1 : 0.7) - b.hopAmp) * dt * 8;
        b.head += (0 - b.head) * dt * 4; b.ear += ((fast ? 1.2 : 0.4) - b.ear) * dt * 4;
        const sp = (fast ? 4.2 : 1.0);
        const nx = b.x + Math.sin(b.yaw) * sp * dt, nz = b.z + Math.cos(b.yaw) * sp * dt;
        const tp = this.typeAt(nx, nz);
        if (tp === T.RIVER || tp === T.POND || tp === T.STREAM || tp === T.POOL || this.waterAt(nx, nz) > this.groundAt(nx, nz)) b.yaw += 2 * dt;
        else { b.x = nx; b.z = nz; }
        if (b.hop >= 1) { b.hop -= 1; b.hops--; if (fast) b.yaw += (r() - 0.5) * 0.5; }
        if (b.hops <= 0) { b.st = fast ? 'alert' : 'graze'; b.t = 0; b.next = fast ? 4 + r() * 4 : 3 + r() * 5; b.hop = 0; }
      }
      const gy = this.groundAt(b.x, b.z);
      const jump = b.st === 'hop' || b.st === 'flee' ? Math.sin(Math.PI * (b.hop % 1)) * (b.st === 'flee' ? 0.3 : 0.12) : 0;
      b.y = gy + jump;
      if (dc < 50) { ctp(b.x, b.z, b.yaw, 0, -0.03, 0.1, 0.19, 0.6 * fd(dc, 50), jump); sunBlob(b.x, b.z, 0.13, 0.09, 0.17, b.yaw, 0.35 * fd(dc, 50), jump); }
      this.h.rabbit.lv(dc, b).push(b.x, b.y, b.z, b.yaw, 0, 0, 1, this.t, b.hop % 1, b.st === 'hop' || b.st === 'flee' ? b.hopAmp : 0, b.head, b.ear, 0, b.id);
    }

    // ---- 鹿 ----
    for (const d of this.deers) {
      d.t += dt;
      const dc = d3(d.x, d.y + 1, d.z);
      if (dc > 320 && d.st !== 'flee') continue;
      // 群れの中で離れ合う（体が重ならない）
      for (const o of this.deers) {
        if (o === d) continue;
        const dx = d.x - o.x, dz = d.z - o.z, l = Math.hypot(dx, dz);
        if (l < 1.4 && l > 1e-4) { const k = (1.4 - l) * Math.min(1, dt * 2); d.x += (dx / l) * k; d.z += (dz / l) * k; }
      }
      if (dc < 22 * K && d.st !== 'flee') { d.st = 'flee'; d.t = 0; d.yaw = yawTo(d.x - cx, d.z - cz) + (r() - 0.5) * 0.5; d.next = 3 + r() * 2; }
      let targetAmp = 0, spd = 0;
      if (d.st === 'graze') {
        d.neck += (1 - d.neck) * dt * 1.5;
        if (d.t > d.next) { d.t = 0; const u = r(); if (u < 0.35) { d.st = 'walk'; d.next = 2 + r() * 4; d.yaw += (r() - 0.5) * 1.4; const hx = d.home[0] - d.x, hz = d.home[1] - d.z; if (Math.hypot(hx, hz) > 25) d.yaw = yawTo(hx, hz); } else if (u < 0.65) { d.st = 'look'; d.next = 2 + r() * 4; } else d.next = 3 + r() * 6; }
      } else if (d.st === 'look') {
        d.neck += (-0.15 - d.neck) * dt * 2.5;
        if (d.t > d.next) { d.st = 'graze'; d.t = 0; d.next = 4 + r() * 6; }
      } else if (d.st === 'walk') {
        targetAmp = 0.5; spd = 0.9; d.neck += (0.35 - d.neck) * dt * 2;
        if (d.t > d.next) { d.st = 'graze'; d.t = 0; d.next = 4 + r() * 8; }
      } else {
        targetAmp = 1; spd = 7.5; d.neck += (-0.2 - d.neck) * dt * 4;
        if (d.t > d.next) { d.st = 'look'; d.t = 0; d.next = 3 + r() * 3; d.home = [d.x, d.z]; }
      }
      d.amp += (targetAmp - d.amp) * (1 - Math.exp(-dt * 3));
      d.ph += dt * (d.amp > 0.75 ? 9.5 : 5.2) * Math.min(1, d.amp * 2);
      const nx = d.x + Math.sin(d.yaw) * spd * dt, nz = d.z + Math.cos(d.yaw) * spd * dt;
      const gy0 = this.groundAt(d.x, d.z), gy1 = this.groundAt(nx, nz);
      if (Math.abs(gy1 - gy0) < 2.5 * dt * Math.max(1, spd) + 0.05 && this.waterAt(nx, nz) < gy1) { d.x = nx; d.z = nz; } else d.yaw += 1.8 * dt;
      const bound = d.amp > 0.75 ? Math.abs(Math.sin(d.ph)) * 0.35 : 0;
      d.y = this.groundAt(d.x, d.z) + bound;
      const pitch = clamp((this.groundAt(d.x - Math.sin(d.yaw) * 0.6, d.z - Math.cos(d.yaw) * 0.6) - this.groundAt(d.x + Math.sin(d.yaw) * 0.6, d.z + Math.cos(d.yaw) * 0.6)) / 1.2, -0.4, 0.4);
      if (dc < 70) {
        const S = d.s;
        ctp(d.x, d.z, d.yaw, 0, 0, 0.32 * S, 0.72 * S, 0.5 * fd(dc, 70), bound);
        const c = Math.cos(d.yaw), sn = Math.sin(d.yaw);
        for (const sx of [-1, 1]) for (const fz of [-0.46, 0.44]) {
          ctp(d.x, d.z, d.yaw, sx * 0.1 * S, fz * S, 0.075 * S, 0.09 * S, 0.8 * fd(dc, 70), bound);
          const lx = sx * 0.1 * S, lz = fz * S;
          legSh(d.x + lx * c + lz * sn, d.z - lx * sn + lz * c, 0.95 * S, 0.05 * S, 0.4 * fd(dc, 70), bound);
        }
      }
      this.h.deer.lv(dc, d).push(d.x, d.y, d.z, d.yaw, pitch, 0, d.s, this.t, d.ph, d.amp, d.neck, d.st === 'look' ? 1 : 0.3, 0, d.id, d.male, d.s < 0.7 ? 1 : 0);
    }

    for (const h of Object.values(this.h)) h.end();
    CT.end();
  }

  _egretTarget(e) {
    const r = this.r;
    for (let q = 0; q < 30; q++) {
      const [x, z] = this.paddyWater[Math.floor(r() * this.paddyWater.length)];
      const d = Math.hypot(x - e.x, z - e.z);
      if (d > 40 && d < 260) return [x, z];
    }
    return [e.x + 40, e.z];
  }

  // カエル：視点のまわりの格子ごとに、畦の上（田の水に面したところ）に決まった数だけ
  _frogs(dt, cam) {
    const W = this.world, C = this.frogCell;
    const ci0 = Math.floor(cam.x / C), cj0 = Math.floor(cam.z / C);
    const R = 3;
    const seen = new Set();
    const alt = cam.y - this.groundAt(cam.x, cam.z);
    if (alt > 30) return;
    for (let dj = -R; dj <= R; dj++) for (let di = -R; di <= R; di++) {
      const ci = ci0 + di, cj = cj0 + dj;
      for (let q = 0; q < 5; q++) {
        const key = `${ci},${cj},${q}`;
        let f = this.frogs.get(key);
        if (!this.frogs.has(key)) {
          // 畦の点を探す：田の水に接していて、自分は乾いた畦
          const h = mulberry32(((ci * 73856093) ^ (cj * 19349663) ^ (q * 83492791)) >>> 0);
          let found = null;
          for (let k = 0; k < 14 && !found; k++) {
            const x = (ci + h()) * C, z = (cj + h()) * C;
            const kk = this.texel(x, z);
            const tp = W.type[kk];
            const isLevee = tp >= 1 && tp <= 6 && W.sdf[kk] < 0.55 && W.water[kk] < -1000;
            const pondEdge = tp === T.MEADOW && Math.abs(Math.hypot((x - POND.x) / POND.rx, (z - POND.z) / POND.rz) - 1.05) < 0.06;
            if (!isLevee && !pondEdge) continue;
            // 近くの水の向き
            let wx = 0, wz = 0, wl = -1e4;
            for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [0.7, 0.7], [-0.7, 0.7], [0.7, -0.7], [-0.7, -0.7]]) {
              const w = this.waterAt(x + dx * 1.2, z + dz * 1.2);
              if (w > -1000) { wx += dx; wz += dz; wl = w; }
            }
            if (wl < -1000) continue;
            found = { x, z, wx, wz, wl };
          }
          if (!found || h() < 0.3) { this.frogs.set(key, null); continue; }
          f = { x: found.x, z: found.z, hx: found.x, hz: found.z, yaw: yawTo(found.wx, found.wz), wl: found.wl, st: 'sit', t: h() * 5, jump: 0, throat: 0, jx: 0, jz: 0, ph: h() * 6, hide: 0, tree: h() < 0.3 ? 1 : 0 };
          f.s = f.tree ? 0.52 : 0.9 + h() * 0.25;
          this.frogs.set(key, f);
        }
        if (!f) continue;
        seen.add(key);
        f.t += dt;
        const dc = Math.hypot(f.x - cam.x, this.groundAt(f.x, f.z) - cam.y, f.z - cam.z);
        if (f.st === 'sit') {
          f.throat = Math.max(0, Math.sin(this.t * 7 + f.ph)) ** 2;
          if (dc < 2.8 * (this.calm ? 0 : 1) || (this.r() < dt * 0.004)) {
            f.st = 'jump'; f.t = 0;
            const l = Math.hypot(Math.sin(f.yaw), Math.cos(f.yaw));
            f.jx = f.x + Math.sin(f.yaw) / l * 0.9; f.jz = f.z + Math.cos(f.yaw) / l * 0.9; f.x0 = f.x; f.z0 = f.z; f.y0 = this.groundAt(f.x, f.z);
          }
        } else if (f.st === 'jump') {
          const u = Math.min(1, f.t / 0.42);
          f.x = lerp(f.x0, f.jx, u); f.z = lerp(f.z0, f.jz, u);
          f.jump = Math.min(1, u * 3) * (1 - Math.max(0, u - 0.7) / 0.3 * 0.6);
          if (u >= 1) { f.st = 'float'; f.t = 0; this.rings(f.x, f.z, 1.0); f.next = 6 + this.r() * 10; }
        } else if (f.st === 'float') {
          f.jump += (0 - f.jump) * dt * 3;
          if (f.t > f.next) { f.st = 'hidden'; f.t = 0; this.rings(f.x, f.z, 0.3); }
        } else if (f.st === 'hidden') {
          // 見ていないときに畦へ戻る
          if (f.t > 12 && dc > 7) { f.st = 'sit'; f.t = 0; f.x = f.hx; f.z = f.hz; f.jump = 0; }
        }
        if (f.st === 'hidden' || dc > 32) continue;
        let y;
        if (f.st === 'sit') y = this.groundAt(f.x, f.z) - 0.004;
        else if (f.st === 'jump') { const u = Math.min(1, f.t / 0.42); y = lerp(f.y0, f.wl, u) + Math.sin(Math.PI * u) * 0.28; }
        else y = f.wl - 0.012;
        if (dc < 20 && f.st !== 'float') this.contacts.push(f.x, f.z, 0.036 * f.s, 0.05 * f.s, f.yaw, 0.6 * clamp((20 - dc) / 6, 0, 1), y + 0.004 - this.groundAt(f.x, f.z));
        this.h.frog.lv(dc, f).push(f.x, y, f.z, f.yaw, f.st === 'jump' ? -0.35 + f.jump * 0.2 : 0, 0, f.s, this.t, f.jump, f.throat, f.st === 'float' ? 1 : 0, 0, f.tree);
      }
    }
    // 見えなくなった格子は忘れる
    if (this.frogs.size > 600) for (const k of this.frogs.keys()) if (!seen.has(k)) this.frogs.delete(k);
  }

  // 魚：池の鯉・滝つぼと渓流のヤマメ・川のオイカワの群れ
  _fish(dt, cam) {
    const r = this.r;
    const near = (x, z, R) => Math.hypot(x - cam.x, z - cam.z) < R;
    // 鯉：池の中をゆっくり回る
    if (near(POND.x, POND.z, 90)) for (const c of this.carps) {
      c.a += c.w * dt * (1 + 0.4 * Math.sin(this.t * 0.2 + c.ph));
      c.ph += dt * 2.2;
      const x = POND.x + Math.cos(c.a) * POND.rx * c.rr, z = POND.z + Math.sin(c.a) * POND.rz * c.rr;
      const yaw = yawTo(-Math.sin(c.a) * Math.sign(c.w) * POND.rx, Math.cos(c.a) * Math.sign(c.w) * POND.rz);
      const y = this.world.pondLevel - c.d;
      this.h.carp.lv(Math.hypot(x - cam.x, y - cam.y, z - cam.z), c).push(x, y, z, yaw, 0, 0, c.s, this.t, c.ph, 0.05, 0, 0, c.col, c.id, 0, 1);
    }
    // ヤマメ：流れに頭を向けて定位。ときどき身をひるがえす
    const [px, , pz] = this.world.gorge.pool;
    if (near(px, pz, 110)) for (const f of this.trouts) {
      f.ph += dt * (7 + f.dart * 10);
      f.dart = Math.max(0, f.dart - dt);
      if (r() < dt * 0.08) { f.dart = 0.5; f.yaw += (r() - 0.5) * 2.5; }
      if (f.home === 'pool') {
        const dx = px - f.x, dz = pz - f.z;
        if (Math.hypot(dx, dz) > 4.5) f.yaw = turnTo(f.yaw, yawTo(dx, dz), dt);
        const sp = f.dart > 0 ? 1.2 : 0.12;
        f.x += Math.sin(f.yaw) * sp * dt; f.z += Math.cos(f.yaw) * sp * dt;
      } else f.yaw = turnTo(f.yaw, f.yaw0, dt * 0.7);
      this.h.trout.lv(Math.hypot(f.x - cam.x, f.y - cam.y, f.z - cam.z), f).push(f.x, f.y, f.z, f.yaw, 0, 0, f.s, this.t, f.ph, 0.06 + f.dart * 0.08);
    }
    // オイカワ：川の近くの区間ごとに群れ（視点の近くでだけ）
    const alt = cam.y - this.groundAt(cam.x, cam.z);
    if (alt < 45) {
      const x0 = Math.floor(cam.x / 22) * 22;
      for (let x = x0 - 66; x <= x0 + 66; x += 22) {
        const zr = riverZ(x);
        if (!near(x, zr, 60)) continue;
        let s = this.schools.get(x);
        if (!s) {
          const h = mulberry32((x * 2654435761) >>> 0);
          const n = 8 + Math.floor(h() * 13);
          s = { x: x + h() * 10, off: (h() - 0.5) * 2.2, fish: [], t: h() * 10, drift: (h() - 0.5) * 0.3 };
          for (let i = 0; i < n; i++) s.fish.push({ dx: (h() - 0.5) * 1.6, dz: (h() - 0.5) * 1.0, dy: h() * 0.15, ph: h() * 6, s: 0.085 + h() * 0.04, male: h() < 0.3 ? 1 : 0, dart: 0 });
          this.schools.set(x, s);
        }
        s.t += dt;
        s.x += (Math.sin(s.t * 0.15) * 0.25 + s.drift * 0.2) * dt;
        const sx = s.x, szr = riverZ(sx) + s.off;
        const dzr = riverDZ(sx);
        const up = yawTo(-1, -dzr);   // 上流（西）を向く
        const wl = riverLevel(sx);
        const scared = near(sx, szr, 3.5) && cam.y - wl < 3;
        for (const f of s.fish) {
          f.ph += dt * (8 + f.dart * 14);
          if (scared && f.dart <= 0) f.dart = 0.6 + r() * 0.4;
          f.dart = Math.max(0, f.dart - dt);
          const jit = f.dart > 0 ? (0.6 - f.dart) * 2.5 : 0;
          const x = sx + f.dx + Math.sin(s.t * 0.9 + f.ph) * 0.12 + jit * Math.cos(f.ph), z = szr + f.dz + Math.sin(s.t * 0.7 + f.ph * 2) * 0.1 + jit * Math.sin(f.ph);
          this.h.rfish.lv(Math.hypot(x - cam.x, wl - cam.y, z - cam.z), f).push(x, wl - 0.2 - f.dy, z, up + Math.sin(s.t * 1.3 + f.ph) * 0.15 + (f.dart > 0 ? f.ph : 0), 0, 0, f.s, this.t, f.ph, 0.05 + f.dart * 0.1, 0, 0, f.male, 0, 0, 2);
        }
      }
      if (this.schools.size > 40) for (const k of this.schools.keys()) if (Math.abs(k - cam.x) > 200) this.schools.delete(k);
      // ときどき川の魚が跳ねる
      this.jumpT -= dt;
      if (this.jumpT <= 0) {
        this.jumpT = 12 + r() * 25;
        const x = cam.x + (r() - 0.5) * 50, zr = riverZ(x);
        if (near(x, zr, 45)) { this.jump = { x, z: zr + (r() - 0.5) * 2, t: 0, yaw: r() * TAU, wl: riverLevel(x) }; this.rings(this.jump.x, this.jump.z, 0.8); }
      }
      if (this.jump) {
        const j = this.jump;
        j.t += dt;
        const u = j.t / 0.55;
        if (u >= 1) { this.rings(j.x + Math.sin(j.yaw) * 0.5, j.z + Math.cos(j.yaw) * 0.5, 1.0); this.jump = null; }
        else this.h.rfish.levels[0].push(j.x + Math.sin(j.yaw) * u * 0.5, j.wl + Math.sin(Math.PI * u) * 0.45, j.z + Math.cos(j.yaw) * u * 0.5, j.yaw, (u - 0.5) * 2.4, 0, 0.11, this.t, this.t * 20, 0.12, 0, 0, 1, 0, 0, 2);
      }
    }
  }
}
