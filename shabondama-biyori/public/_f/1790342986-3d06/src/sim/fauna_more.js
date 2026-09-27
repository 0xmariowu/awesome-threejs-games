// 生きもの（追加分）の暮らし：野の縁のキツネ・林の縁のタヌキ・杉の幹のリス・庭のニワトリ・縁側のネコ・
// 池と川の岸で甲羅干しするカメ・田と池の水面のアメンボ・田のオタマジャクシ
// 住む場所は世界から拾い、出発点（縁側・土手・小丘・神社・橋・池・滝・峠）の近くに寄せて置く。しゃぼん玉が近づくと逃げる
import { HerdX } from '../render/species_more.js';
import * as X from '../render/species_more.js';
import { T, SP } from '../world/gen.js';
import { riverZ, riverLevel, POND, HOUSES, OUTBUILDINGS, KNOLL, SHRINE, BRIDGE, GORGE, gorgeWorld, RIDGE } from '../world/layout.js';
import { mulberry32, clamp, smoothstep } from '../util/noise.js';

const TAU = Math.PI * 2;
const wrapPi = (a) => { while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a; };
const yawTo = (dx, dz) => Math.atan2(dx, dz);
const turnTo = (a, b, k) => a + wrapPi(b - a) * Math.min(1, k);
const ease = (v, target, k, dt) => v + (target - v) * (1 - Math.exp(-dt * k));

export class FaunaMore {
  constructor({ shared, world, groundAt, rings }) {
    this.world = world;
    this.groundAt = groundAt;
    this.rings = rings;
    // 確かめ用：?f3seed=n で置き場所を毎回同じにする
    const fs = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('f3seed') : null;
    this.r = mulberry32(fs ? Number(fs) * 7919 + 1 : (Math.random() * 1e9) | 0);
    this.t = 0;
    const N = world.N;
    this.texel = (x, z) => {
      const i = clamp(Math.round((x - world.ORIGIN) / world.CELL), 0, N - 1), j = clamp(Math.round((z - world.ORIGIN) / world.CELL), 0, N - 1);
      return j * N + i;
    };
    this.typeAt = (x, z) => world.type[this.texel(x, z)];
    this.wet = (x, z) => world.water[this.texel(x, z)] > this.groundAt(x, z) - 0.02;
    this.h = {
      fox: new HerdX(shared, X.foxGeo(), X.FOX_ANIM, { cap: 10, shadow: true, fur: 1700, gao: 0.25 }),
      tanuki: new HerdX(shared, X.tanukiGeo(), X.TANUKI_ANIM, { cap: 10, shadow: true, fur: 1500, gao: 0.18 }),
      squirrel: new HerdX(shared, X.squirrelGeo(), X.SQUIRREL_ANIM, { cap: 16, shadow: true, fur: 2600, gao: 0.06 }),
      hen: new HerdX(shared, X.chickenGeo(0), X.CHICKEN_ANIM, { cap: 24, shadow: true, fur: 500, gao: 0.25 }),
      leghorn: new HerdX(shared, X.chickenGeo(1), X.CHICKEN_ANIM, { cap: 16, shadow: true, fur: 500, gao: 0.25 }),
      rooster: new HerdX(shared, X.chickenGeo(2), X.CHICKEN_ANIM, { cap: 6, shadow: true, fur: 500, gao: 0.25 }),
      cat0: new HerdX(shared, X.catGeo(0), X.CAT_ANIM, { cap: 4, shadow: true, fur: 1900, gao: 0.15 }),
      cat1: new HerdX(shared, X.catGeo(1), X.CAT_ANIM, { cap: 4, shadow: true, fur: 1900, gao: 0.15 }),
      turtle: new HerdX(shared, X.turtleGeo(), X.TURTLE_ANIM, { cap: 24, shadow: true, fur: 400, gao: 0.04 }),
      log: new HerdX(shared, X.logGeo(), X.LOG_ANIM, { cap: 8, shadow: true, fur: 1, gao: 0.12 }),
      strider: new HerdX(shared, X.striderGeo(), X.STRIDER_ANIM, { cap: 160, fur: 1, gao: 0.001 }),
      tadpole: new HerdX(shared, X.tadpoleGeo(), X.TADPOLE_ANIM, { cap: 480, fur: 1, gao: 0.001 }),
    };
    this.meshes = Object.values(this.h).map((h) => h.mesh);
    this._habitats();
    this._spawn();
  }

  // ---- 住む場所 ----
  _habitats() {
    const W = this.world, r = this.r, N = W.N;
    const h1 = HOUSES.find((h) => h.id === 'h1');
    // 出発点のあたり（ここから30〜110mに寄せる）
    const [tx, tz] = gorgeWorld(GORGE.sPool - GORGE.poolR - 4, -4);
    this.poi = [[h1.x, h1.z + 12], [-150, riverZ(-150) - 8], [KNOLL.x, KNOLL.z], [SHRINE.x, SHRINE.stepsFrom + 14], [BRIDGE.x, BRIDGE.z], [POND.x, POND.z + POND.rz], [tx, tz], [RIDGE.x, RIDGE.z]];
    const nearPoi = (x, z, a, b) => this.poi.some(([px, pz]) => { const d = Math.hypot(x - px, z - pz); return d > a && d < b; });
    const OPEN = new Set([T.FIELD, T.FALLOW, T.MEADOW, T.BANK, T.LEVEE_BIG, T.TILLED, T.RENGE, T.KNOLL, T.DIRT]);
    const WOOD = new Set([T.FOREST, T.BAMBOO]);
    const edgeDist = (x, z, want) => {
      // 近くに林があるか（want=true）／ひらけた所があるか
      for (const rr of [3, 6, 9]) for (let k = 0; k < 8; k++) {
        const a = k / 8 * TAU;
        const t = W.type[this.texel(x + Math.cos(a) * rr, z + Math.sin(a) * rr)];
        if (want ? (WOOD.has(t) || W.forest[this.texel(x + Math.cos(a) * rr, z + Math.sin(a) * rr)] > 0.5) : OPEN.has(t)) return rr;
      }
      return 99;
    };
    this.foxSpots = []; this.tanukiSpots = [];
    for (let q = 0; q < 26000 && (this.foxSpots.length < 160 || this.tanukiSpots.length < 160); q++) {
      const i = 2 + Math.floor(r() * (N - 4)), j = 2 + Math.floor(r() * (N - 4));
      const x = W.ORIGIN + i * W.CELL, z = W.ORIGIN + j * W.CELL;
      if (!nearPoi(x, z, 18, 120)) continue;
      const k = j * N + i, t = W.type[k];
      if (W.water[k] > W.height[k] - 0.05) continue;
      if (OPEN.has(t) && W.forest[k] < 0.2 && this.foxSpots.length < 160 && edgeDist(x, z, true) <= 9) this.foxSpots.push([x, z]);
      else if ((WOOD.has(t) || W.forest[k] > 0.4) && this.tanukiSpots.length < 160 && edgeDist(x, z, false) <= 6) this.tanukiSpots.push([x, z]);
    }
    // 杉の幹（まっすぐなので、リスが幹に沿って登れる）：林の縁に近いもの
    this.squirrelTrees = [];
    for (const t of W.trees) {
      if (t.sp !== SP.CEDAR || t.s < 0.6 || t.hero) continue;
      if (!nearPoi(t.x, t.z, 8, 90)) continue;
      if (edgeDist(t.x, t.z, false) > 9) continue;
      this.squirrelTrees.push(t);
    }
    // 庭（ニワトリ）：農家の前庭で、地面が庭のところ
    const toW = (h, lx, lz) => { const c = Math.cos(h.rot), s = Math.sin(h.rot); return [h.x + lx * c + lz * s, h.z - lx * s + lz * c]; };
    this.toW = toW;
    // 家・納屋・蔵の床の四角（逃げる・歩くときに壁を抜けないように）
    this.blocks = [];
    for (const h of HOUSES) this.blocks.push({ x: h.x, z: h.z, c: Math.cos(h.rot), s: Math.sin(h.rot), hw: h.w / 2 + 0.3, hd: h.d / 2 + 0.3 });
    for (const ob of OUTBUILDINGS) {
      const h = HOUSES.find((q) => q.id === ob.of);
      if (!h) continue;
      const [x, z] = toW(h, ob.off[0], ob.off[1]), a = h.rot + (ob.rot || 0);
      this.blocks.push({ x, z, c: Math.cos(a), s: Math.sin(a), hw: ob.w / 2 + 0.3, hd: ob.d / 2 + 0.3 });
    }
    this.coops = [];
    for (const id of ['h1', 'h3', 'h6', 'h4']) {
      const h = HOUSES.find((q) => q.id === id);
      if (!h) continue;
      const ob = OUTBUILDINGS.find((o) => o.of === id && o.type === 'barn') || { off: [10, 3] };
      const pts = [];
      for (let q = 0; q < 400 && pts.length < 40; q++) {
        const lx = ob.off[0] * 0.75 + (r() - 0.5) * 9, lz = h.d / 2 + 2.5 + r() * 7;
        const [x, z] = toW(h, lx, lz);
        const t = this.typeAt(x, z);
        if ((t === T.YARD || t === T.DIRT || t === T.GRAVEL || t === T.MEADOW) && !this._blocked(x, z)) pts.push([x, z]);
      }
      if (pts.length > 6) this.coops.push({ h, pts });
    }
    // 岸（カメ）：池・川の水ぎわの、水面とほぼ同じ高さの陸
    this.banks = [];
    const addBank = (x, z, level, wx, wz) => {
      const gy = this.groundAt(x, z);
      if (gy < level - 0.02 || gy > level + 0.25) return false;
      if (this.wet(x, z)) return false;
      this.banks.push({ x, z, y: gy, level, wx, wz });
      return true;
    };
    for (let k = 0; k < 90; k++) {
      const a = k / 90 * TAU;
      for (let s = 0.92; s < 1.25; s += 0.02) {
        const x = POND.x + Math.cos(a) * POND.rx * s, z = POND.z + Math.sin(a) * POND.rz * s;
        if (!this.wet(x, z) && this.wet(POND.x + Math.cos(a) * POND.rx * (s - 0.04), POND.z + Math.sin(a) * POND.rz * (s - 0.04))) {
          if (addBank(x, z, W.pondLevel, POND.x + Math.cos(a) * POND.rx * (s - 0.2), POND.z + Math.sin(a) * POND.rz * (s - 0.2))) break;
        }
      }
    }
    // 流木（カメの甲羅干し場）：池・滝の谷の渓流・橋の下の川の岸から、水へ斜めに半分沈める
    this.logs = [];
    const [px, pz] = [POND.x, POND.z];
    for (const [cx, cz, R, n] of [[px, pz, Math.max(POND.rx, POND.rz) * 1.3, 2], [tx, tz, 28, 2], [BRIDGE.x, BRIDGE.z, 30, 1]]) {
      let made = 0;
      for (const sp of this._shore(cx, cz, R, 40)) {
        if (made >= n) break;
        const lg = this._placeLog(sp);
        if (lg && this.logs.every((o) => Math.hypot(o.x0 - lg.x0, o.z0 - lg.z0) > 6)) { this.logs.push(lg); made++; }
      }
    }
  }
  // 岸：乾いた地面で、1.3m 以内の片側に水面（地面より 0.02〜0.35m 低い）がある所。水の向きも返す
  _shore(cx, cz, R, want) {
    const out = [], r = this.r, W = this.world;
    for (let q = 0; q < 4000 && out.length < want; q++) {
      const a = r() * TAU, d = Math.sqrt(r()) * R;
      const x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
      if (this.wet(x, z)) continue;
      const gy = this.groundAt(x, z);
      let wx = 0, wz = 0, n = 0, lvl = 0;
      for (let k = 0; k < 12; k++) {
        const b = (k / 12) * TAU, qx = x + Math.cos(b) * 1.3, qz = z + Math.sin(b) * 1.3;
        if (this.wet(qx, qz)) { wx += Math.cos(b); wz += Math.sin(b); n++; lvl += W.water[this.texel(qx, qz)]; }
      }
      if (n < 2 || n > 7) continue;
      lvl /= n;
      const l = Math.hypot(wx, wz);
      if (gy - lvl < 0.02 || gy - lvl > 0.35 || l < 0.3) continue;
      out.push({ x, z, gy, level: lvl, dx: wx / l, dz: wz / l });
    }
    return out;
  }
  // 丸太を岸から水へ置く：岸の端は地面に少し沈め、水の端は水面の下へ半分沈める。長さの 4 割以上が水の上に出る置き方だけを使う。
  // 途中で地面に埋まる・水底を突き抜ける・岩に当たる所は使わない
  _placeLog(sp) {
    const r = this.r, W = this.world;
    const sc = 0.85 + r() * 0.3, L = X.LOG_L * sc;
    const yaw = yawTo(sp.dx, sp.dz) + (r() - 0.5) * 0.5;
    const dx = Math.sin(yaw), dz = Math.cos(yaw);
    let best = null;
    for (const back of [0.2, 0.4, 0.6, 0.8, 1.0]) {
      const x0 = sp.x - dx * back, z0 = sp.z - dz * back;
      const x1 = x0 + dx * L, z1 = z0 + dz * L;
      if (this.wet(x0, z0) || !this.wet(x1, z1)) continue;
      const level = W.water[this.texel(x1, z1)];
      if (level - this.groundAt(x1, z1) < 0.12) continue;
      const y0 = this.groundAt(x0, z0) + X.LOG_R(0) * sc * 0.4, y1 = level - X.LOG_R(1) * sc * 0.5;
      const pitch = Math.atan2(y0 - y1, L);
      if (Math.abs(pitch) > 0.33) continue;
      const lg = { x0, z0, y0, yaw, pitch, sc, L, level };
      let ok = true, tIn = -1;
      for (let k = 0; k <= 16 && ok; k++) {
        const t = (k / 16) * L, c = this._logAxis(lg, t);
        const rr = X.LOG_R(k / 16) * sc, g = this.groundAt(c.x, c.z);
        const wet = this.wet(c.x, c.z);
        if (wet && tIn < 0) tIn = t;
        // 陸の上は半分まで地面に沈んでよい。水の中は水底より上
        if (k > 0 && c.y < g - (wet ? 0 : rr * 0.5)) ok = false;
        for (const q of W.rocks) if (Math.hypot(q.x - c.x, q.z - c.z) < q.s * 0.55 + rr + 0.1) { ok = false; break; }
      }
      if (!ok || tIn < 0 || (L - tIn) / L < 0.4) continue;
      // 水面より上に出ている範囲（甲羅干しに使える所）
      let tW = 0;
      for (let k = 0; k <= 40; k++) { const t = (k / 40) * L; if (this._logTop(lg, t).y > level + 0.03) tW = t; }
      lg.tW = tW; lg.tIn = tIn;
      const over = tW - tIn;
      if (tW > 0.5 && over > 0.25 && (!best || over > best.tW - best.tIn)) best = lg;
    }
    return best;
  }
  _logAxis(lg, t) {
    const cp = Math.cos(lg.pitch);
    return { x: lg.x0 + Math.sin(lg.yaw) * cp * t, y: lg.y0 - Math.sin(lg.pitch) * t, z: lg.z0 + Math.cos(lg.yaw) * cp * t };
  }
  // 丸太の上面（t は岸の端からの長さ m）
  _logTop(lg, t) {
    const c = this._logAxis(lg, t), rr = X.LOG_R(clamp(t / lg.L, 0, 1)) * lg.sc, sp = Math.sin(lg.pitch);
    return { x: c.x + Math.sin(lg.yaw) * sp * rr, y: c.y + Math.cos(lg.pitch) * rr, z: c.z + Math.cos(lg.yaw) * sp * rr };
  }

  _spawn() {
    const r = this.r;
    const pick = (a) => a[Math.floor(r() * a.length)];
    const takeSpread = (arr, n, minD) => {
      const out = [];
      for (let q = 0; q < 400 && out.length < n && arr.length; q++) {
        const p = pick(arr);
        if (out.every((o) => Math.hypot(o[0] - p[0], o[1] - p[1]) > minD)) out.push(p);
      }
      return out;
    };
    // キツネ：野の縁をひとりで歩く
    this.foxes = takeSpread(this.foxSpots, 7, 45).map(([x, z]) => this._quad(x, z, { st: 'trot', spd: 0 }));
    // タヌキ：林の縁をつがいで
    this.tanukis = [];
    for (const [x, z] of takeSpread(this.tanukiSpots, 4, 50)) {
      this.tanukis.push(this._quad(x, z, { st: 'forage' }));
      if (r() < 0.8) this.tanukis.push(this._quad(x + 0.8, z + 0.6, { st: 'forage', pair: this.tanukis[this.tanukis.length - 1] }));
    }
    // リス：杉の幹
    this.squirrels = [];
    const trees = this.squirrelTrees.slice();
    for (let i = 0; i < 14 && trees.length; i++) {
      const k = Math.floor(r() * trees.length);
      const t = trees.splice(k, 1)[0];
      if (this.squirrels.some((s) => Math.hypot(s.tree.x - t.x, s.tree.z - t.z) < 12)) { i--; if (!trees.length) break; continue; }
      this.squirrels.push({ tree: t, a: r() * TAU, hy: 0.6 + r() * 2.5, dir: 1, st: 'cling', t: 0, next: 1 + r() * 3, ph: 0, amp: 0, head: 0, hyaw: 0, tailW: 0.6, gx: 0, gz: 0, gy: 0, yaw: 0, seed: r(), va: 0 });
    }
    // ニワトリ：庭ごとに群れ（おんどり1・めんどり数羽）
    this.chickens = [];
    for (const cp of this.coops) {
      const n = 4 + Math.floor(r() * 4);
      for (let i = 0; i < n; i++) {
        const [x, z] = pick(cp.pts);
        const kind = i === 0 && r() < 0.8 ? 2 : r() < 0.4 ? 1 : 0;
        this.chickens.push({ coop: cp, kind, x, z, y: 0, yaw: r() * TAU, st: 'peck', t: 0, next: 1 + r() * 4, ph: r() * 6, amp: 0, peck: 0, flap: 0, hyaw: 0, scratch: 0, tx: x, tz: z, seed: r(), bob: 0 });
      }
    }
    // ネコ：始まりの家の縁側の前で香箱をつくる三毛・h4のガラス戸の前で横になるきじ白・h3の庭を歩くきじ白
    this.cats = [];
    const h1 = HOUSES.find((h) => h.id === 'h1'), h3 = HOUSES.find((h) => h.id === 'h3'), h4 = HOUSES.find((h) => h.id === 'h4');
    // 始まりの家：縁側の前の日だまり（座敷から見える所）で丸くなる
    { const [x, z] = this.toW(h1, 1.8, 8.0); this.cats.push({ kind: 0, home: 'engawa', x, z, y: this.groundAt(x, z), yaw: h1.rot + Math.PI / 2 + 0.5, yaw0: h1.rot + Math.PI / 2 + 0.5, st: 'loaf', t: 0, next: 6, lie: 1, side: 0, head: 0.1, hyaw: 0, ph: 0, amp: 0, tailW: 0.2, seed: r() }); }
    // h4：縁側はガラス戸の内なので、戸の前の日なた（地面）で背を家に向けて横になる
    if (h4) { const [x, z] = this.toW(h4, -3.0, h4.d / 2 + 0.45); this.cats.push({ kind: 1, home: 'engawa', napper: true, x, z, y: this.groundAt(x, z), yaw: h4.rot - Math.PI / 2, yaw0: h4.rot - Math.PI / 2, st: 'nap', t: 0, next: 12, lie: 1, side: 1, head: 0, hyaw: 0, ph: 0, amp: 0, tailW: 0.2, seed: r() }); }
    if (h3) {
      const pts = [];
      for (let q = 0; q < 200 && pts.length < 20; q++) {
        const [x, z] = this.toW(h3, (r() - 0.5) * 16, h3.d / 2 + 2 + r() * 8);
        const t = this.typeAt(x, z);
        if ((t === T.YARD || t === T.DIRT || t === T.GRAVEL) && !this._blocked(x, z)) pts.push([x, z]);
      }
      if (pts.length) { const [x, z] = pts[0]; this.cats.push({ kind: 1, home: 'yard', pts, x, z, y: this.groundAt(x, z), yaw: r() * TAU, st: 'walk', t: 0, next: 5, lie: 0, side: 0, head: 0, hyaw: 0, ph: 0, amp: 0, tailW: 0.3, tx: x, tz: z, seed: r() }); }
    }
    // カメ：池の岸・渓流の岩に数匹ずつ寄りそって
    this.turtles = [];
    const bankSpots = takeSpread(this.banks.map((b) => [b.x, b.z, b]), 3, 12).map((p) => p[2]);
    for (const b of bankSpots) {
      const n = 1 + Math.floor(r() * 3);
      const yaw = yawTo(b.x - b.wx, b.z - b.wz) + Math.PI + (r() - 0.5) * 0.8;   // 水から上がって陸を向く→日を浴びる向き
      for (let i = 0; i < n; i++) this.turtles.push(this._turtle(b.x + (r() - 0.5) * 0.4, b.z + (r() - 0.5) * 0.4, b.level, yaw + (r() - 0.5) * 1.2, [b.wx, b.wz]));
    }
    // 流木の上：甲羅の長さ以上あけて、岸の方（上り）を向いて並ぶ
    for (const lg of this.logs) {
      const n = 1 + Math.floor(r() * 3);
      const gap = 0.3;
      let t0 = Math.max(0.2, lg.tIn - 0.35 + r() * 0.15);
      for (let i = 0; i < n && t0 < lg.tW - 0.1; i++, t0 += gap + r() * 0.15) {
        const w = this._logTop(lg, lg.tW + 0.1);
        const a = this._turtle(0, 0, lg.level, 0, [w.x + Math.sin(lg.yaw) * 1.2, w.z + Math.cos(lg.yaw) * 1.2]);
        a.perch = lg; a.t0 = t0; a.pt = t0; a.jit = (r() - 0.5) * 0.35;
        const p = this._logTop(lg, t0);
        a.x = a.x0 = p.x; a.z = a.z0 = p.z; a.y = p.y;
        this.turtles.push(a);
      }
    }
    // 水面のアメンボ・田のオタマジャクシ（視点のまわりの格子ごと）
    this.pads = new Map();
  }
  _quad(x, z, o) {
    const r = this.r;
    return { x, z, y: this.groundAt(x, z), yaw: r() * TAU, home: [x, z], t: 0, next: 2 + r() * 5, ph: r() * 6, amp: 0, spd: 0, head: 0, hyaw: 0, lie: 0, tailW: 0.2, tailL: 0, jump: 0, seed: r(), tx: x, tz: z, ...o };
  }
  _turtle(x, z, level, yaw, water) {
    const r = this.r;
    return { x, z, y: 0, x0: x, z0: z, level, yaw, yaw0: yaw, water, st: 'bask', t: 0, next: 5 + r() * 10, ph: 0, amp: 0, neck: 0.8, lift: 0.4, wet: 0.3, hyaw: 0, seed: r(), dive: 0 };
  }

  // 目標へ向かって歩く（四つ足の共通）。戻り値：進めたか
  _walk(a, spd, dt, turn = 2.5) {
    const dx = a.tx - a.x, dz = a.tz - a.z;
    const d = Math.hypot(dx, dz);
    if (d > 0.05) a.yaw = turnTo(a.yaw, yawTo(dx, dz), dt * turn);
    const nx = a.x + Math.sin(a.yaw) * spd * dt, nz = a.z + Math.cos(a.yaw) * spd * dt;
    const gy0 = this.groundAt(a.x, a.z), gy1 = this.groundAt(nx, nz);
    if (!this.wet(nx, nz) && Math.abs(gy1 - gy0) < Math.max(0.05, spd * dt * 1.6) && (!this._blocked(nx, nz) || this._blocked(a.x, a.z))) { a.x = nx; a.z = nz; return d; }
    a.yaw += 1.6 * dt * (a.seed > 0.5 ? 1 : -1);
    return d;
  }
  _blocked(x, z) {
    for (const b of this.blocks) {
      const dx = x - b.x, dz = z - b.z;
      if (Math.abs(dx * b.c - dz * b.s) < b.hw && Math.abs(dx * b.s + dz * b.c) < b.hd) return true;
    }
    return false;
  }
  _pitch(a, L) {
    const s = Math.sin(a.yaw), c = Math.cos(a.yaw);
    return clamp((this.groundAt(a.x - s * L, a.z - c * L) - this.groundAt(a.x + s * L, a.z + c * L)) / (2 * L), -0.45, 0.45);
  }
  _lookAt(a, cam, maxA = 1.1) {
    return clamp(wrapPi(yawTo(cam.x - a.x, cam.z - a.z) - a.yaw), -maxA, maxA);
  }

  update(dt, cam) {
    this.t += dt;
    const r = this.r, t = this.t;
    const K = this.calm ? 1e-3 : 1;
    const dCam = (x, y, z) => Math.hypot(x - cam.x, y - cam.y, z - cam.z);
    for (const h of Object.values(this.h)) h.begin();
    this._foxes(dt, cam, dCam, K);
    this._tanukis(dt, cam, dCam, K);
    this._squirrels(dt, cam, dCam, K);
    this._chickens(dt, cam, dCam, K);
    this._cats(dt, cam, dCam, K);
    this._turtles(dt, cam, dCam, K);
    this._pads(dt, cam, K);
    for (const h of Object.values(this.h)) h.end();
    void r; void t;
  }

  // ---- キツネ：野の縁を速足で行き来し、止まって耳をすまし、ネズミに跳びかかる。休むときは伏せて尾を巻く ----
  _foxes(dt, cam, dCam, K) {
    const r = this.r;
    for (const a of this.foxes) {
      const dc = dCam(a.x, a.y + 0.3, a.z);
      if (dc > 260 && a.st !== 'flee') continue;
      a.t += dt;
      if (dc < 11 * K && a.st !== 'flee') { a.st = 'flee'; a.t = 0; a.next = 4 + r() * 2; const ay = yawTo(a.x - cam.x, a.z - cam.z); a.tx = a.x + Math.sin(ay) * 40; a.tz = a.z + Math.cos(ay) * 40; }
      let amp = 0, spd = 0, head = 0.05, lie = 0, tailW = 0.15, tailL = 0, hyaw = 0;
      const near = (arr, R) => { for (let q = 0; q < 12; q++) { const p = arr[Math.floor(r() * arr.length)]; if (Math.hypot(p[0] - a.home[0], p[1] - a.home[1]) < R) return p; } return a.home; };
      if (a.st === 'trot') {
        amp = 0.8; spd = 1.9; head = 0.12;
        const d = this._walk(a, spd, dt, 2.0);
        if (d < 1 || a.t > a.next) {
          a.t = 0; const u = r();
          if (u < 0.35) { a.st = 'listen'; a.next = 2 + r() * 3; a.sitting = r() < 0.5; if (a.sitting) a.next += 4; }
          else if (u < 0.55) { a.st = 'sniff'; a.next = 3 + r() * 4; [a.tx, a.tz] = near(this.foxSpots, 20); }
          else if (u < 0.7) { a.st = 'rest'; a.next = 12 + r() * 15; }
          else { [a.tx, a.tz] = near(this.foxSpots, 35); a.next = 6 + r() * 8; }
        }
      } else if (a.st === 'sniff') {
        amp = 0.45; spd = 0.55; head = 0.85; tailW = 0.3;
        this._walk(a, spd, dt, 1.2);
        if (a.t > a.next) { a.t = 0; a.st = r() < 0.5 ? 'listen' : 'trot'; a.next = 2 + r() * 3; }
      } else if (a.st === 'listen') {
        // 草の中の音に首をかしげ、ときどき跳ぶ
        head = 0.35; hyaw = Math.sin(a.t * 1.3 + a.seed * 9) * 0.5; tailW = 0.1;
        if (a.sitting) { lie = -1; head = 0.1; }
        if (dc < 45) hyaw = this._lookAt(a, cam);
        if (a.t > a.next) { a.t = 0; if (!a.sitting && r() < 0.45) { a.st = 'pounce'; a.jump = 0; } else { a.st = 'trot'; a.next = 5 + r() * 6; } a.sitting = false; }
      } else if (a.st === 'pounce') {
        // 高く弧を描いて前へ跳び、鼻から着地して地面を押さえる
        a.jump += dt / 0.75;
        const u = Math.min(1, a.jump);
        spd = u < 1 ? 1.6 : 0; amp = 0; head = u < 0.5 ? -0.2 : 0.2 + u * 0.9; tailL = 0.2;
        const nx = a.x + Math.sin(a.yaw) * spd * dt, nz = a.z + Math.cos(a.yaw) * spd * dt;
        if (!this.wet(nx, nz)) { a.x = nx; a.z = nz; }
        if (a.jump > 2.2) { a.st = 'sniff'; a.t = 0; a.next = 2 + r() * 2; a.jump = 0; [a.tx, a.tz] = [a.x + Math.sin(a.yaw) * 2, a.z + Math.cos(a.yaw) * 2]; }
      } else if (a.st === 'rest') {
        lie = 1; head = 0.25; tailW = 0.05; tailL = 0;
        if (dc < 40) hyaw = this._lookAt(a, cam, 0.9);
        if (a.t > a.next) { a.st = 'trot'; a.t = 0; a.next = 5; [a.tx, a.tz] = near(this.foxSpots, 35); }
      } else {
        amp = 1; spd = 7.5; head = -0.05; tailW = 0; tailL = -0.1;
        this._walk(a, spd, dt, 3);
        if (a.t > a.next) { a.st = 'listen'; a.t = 0; a.next = 3 + r() * 2; a.home = [a.x, a.z]; }
      }
      a.amp = ease(a.amp, amp, 4, dt);
      a.spd = ease(a.spd, spd, 4, dt);
      a.lie = ease(a.lie, lie, 1.8, dt);
      a.head = ease(a.head, head, 4, dt);
      a.hyaw = ease(a.hyaw, hyaw, 3, dt);
      a.tailW = ease(a.tailW, tailW, 2, dt);
      a.tailL = ease(a.tailL, tailL, 2, dt);
      const stride = a.amp > 0.9 ? 1.5 : a.amp > 0.62 ? 0.95 : 0.5;
      a.ph += dt * Math.max(a.spd, 0.001) / stride * TAU;
      const gy = this.groundAt(a.x, a.z);
      let y = gy;
      if (a.st === 'pounce') { const u = Math.min(1, a.jump); y += Math.sin(Math.PI * u) * 0.55; }
      if (a.amp > 0.9) y += Math.abs(Math.sin(a.ph)) * 0.06;
      a.y = y;
      const pj = a.st === 'pounce' && a.jump < 1 ? (a.jump - 0.5) * 1.6 : 0;
      this.h.fox.push(a.x, a.y, a.z, a.yaw, this._pitch(a, 0.3) + pj, 0, 1, this.t, a.ph, a.amp, a.head, a.tailL, a.lie, a.hyaw, a.tailW, a.seed);
    }
  }

  // ---- タヌキ：林の縁をつがいでゆっくり嗅ぎまわる。落ち葉を鼻でかき、座りこむ。驚くと小走りで林へ ----
  _tanukis(dt, cam, dCam, K) {
    const r = this.r;
    for (const a of this.tanukis) {
      const dc = dCam(a.x, a.y + 0.2, a.z);
      if (dc > 200 && a.st !== 'flee') continue;
      a.t += dt;
      if (dc < 8 * K && a.st !== 'flee' && a.st !== 'freeze') { a.st = 'freeze'; a.t = 0; a.next = 1.2 + r(); }
      let amp = 0, spd = 0, head = 0.7, lie = 0, tailW = 0.05, hyaw = 0;
      const near = (R) => { for (let q = 0; q < 12; q++) { const p = this.tanukiSpots[Math.floor(r() * this.tanukiSpots.length)]; if (Math.hypot(p[0] - a.home[0], p[1] - a.home[1]) < R) return p; } return a.home; };
      if (a.pair && a.st !== 'flee' && a.st !== 'freeze') {
        // 相方のあとをついていく
        const p = a.pair;
        const d = Math.hypot(p.x - a.x, p.z - a.z);
        if (d > 1.6) { a.st = 'follow'; a.tx = p.x - Math.sin(p.yaw) * 0.9; a.tz = p.z - Math.cos(p.yaw) * 0.9; }
        else if (a.st === 'follow') { a.st = 'forage'; a.t = 0; a.next = 2 + r() * 3; }
      }
      if (a.st === 'forage') {
        amp = 0.3; spd = 0.12; head = 0.95 + Math.sin(a.t * 2.5 + a.seed * 7) * 0.08; hyaw = Math.sin(a.t * 0.8 + a.seed * 5) * 0.35;
        if (!a.pair) {
          this._walk(a, spd, dt, 1.0);
          if (a.t > a.next) { a.t = 0; const u = r(); if (u < 0.5) { a.st = 'walk'; [a.tx, a.tz] = near(20); a.next = 8; } else if (u < 0.75) { a.st = 'sit'; a.next = 6 + r() * 8; } else { a.next = 3 + r() * 4; [a.tx, a.tz] = near(6); } }
        } else if (a.t > a.next) { a.t = 0; a.next = 3 + r() * 5; a.yaw += (r() - 0.5) * 1.5; }
      } else if (a.st === 'walk' || a.st === 'follow') {
        amp = 0.5; spd = a.st === 'follow' ? 0.9 : 0.6; head = 0.35;
        const d = this._walk(a, spd, dt, 1.6);
        if (!a.pair && (d < 0.6 || a.t > a.next)) { a.st = 'forage'; a.t = 0; a.next = 4 + r() * 5; }
      } else if (a.st === 'sit') {
        lie = 1; head = 0.1; if (dc < 30) hyaw = this._lookAt(a, cam, 0.8);
        if (a.t > a.next) { a.st = 'forage'; a.t = 0; a.next = 3; }
      } else if (a.st === 'freeze') {
        // 立ちすくんでこちらを見る
        head = -0.1; hyaw = this._lookAt(a, cam, 1.0);
        if (a.t > a.next) {
          a.st = 'flee'; a.t = 0; a.next = 3 + r() * 2;
          // 林の方へ
          let best = null, bd = 1e9;
          for (let q = 0; q < 20; q++) { const p = this.tanukiSpots[Math.floor(r() * this.tanukiSpots.length)]; const d = Math.hypot(p[0] - a.x, p[1] - a.z) - Math.hypot(p[0] - cam.x, p[1] - cam.z) * 0.8; if (d < bd) { bd = d; best = p; } }
          const ay = yawTo(a.x - cam.x, a.z - cam.z);
          [a.tx, a.tz] = best ? best : [a.x + Math.sin(ay) * 20, a.z + Math.cos(ay) * 20];
        }
      } else {
        amp = 0.8; spd = 2.6; head = 0.1;
        this._walk(a, spd, dt, 3);
        if (a.t > a.next) { a.st = 'forage'; a.t = 0; a.next = 5; a.home = [a.x, a.z]; }
      }
      a.amp = ease(a.amp, amp, 4, dt);
      a.spd = ease(a.spd, spd, 4, dt);
      a.lie = ease(a.lie, lie, 1.5, dt);
      a.head = ease(a.head, head, 3, dt);
      a.hyaw = ease(a.hyaw, hyaw, 3, dt);
      a.tailW = ease(a.tailW, tailW, 2, dt);
      a.ph += dt * Math.max(a.spd, 0.001) / (a.amp > 0.62 ? 0.55 : 0.32) * TAU;
      a.y = this.groundAt(a.x, a.z);
      // 歩くとお尻が左右にゆれる
      const roll = Math.sin(a.ph) * 0.05 * a.amp;
      this.h.tanuki.push(a.x, a.y, a.z, a.yaw, this._pitch(a, 0.25), roll, 1, this.t, a.ph, a.amp, a.head, 0, a.lie, a.hyaw, a.tailW, a.seed);
    }
  }

  // ---- リス：杉の幹を跳ねるように駆け上がり、らせんに回り、止まって辺りを見る。根元に降りて座って食べる ----
  _squirrels(dt, cam, dCam, K) {
    const r = this.r;
    for (const s of this.squirrels) {
      const tr = s.tree;
      const baseY = tr.y - 0.15;
      const dc = dCam(tr.x, baseY + s.hy, tr.z);
      if (dc > 100) continue;
      s.t += dt;
      // 幹の太さ：treegeo の杉の幹（六角の筒、根元 1.35r0 → 先 0.2r0、r0=0.24）の面と角の中ほど。足先が樹皮に少しかかる距離
      const radAt = (hy) => 0.9 * 0.24 * tr.s * (1.35 - 1.15 * ((hy - 0.15) / tr.s + 0.4) / 20.4) - 0.008;
      // しゃぼん玉が近いと、幹の裏へ回って高く登る
      if (dc < 7 * K && s.st !== 'flee' && s.st !== 'fleeGround') {
        if (s.st === 'ground' || s.st === 'eat') { s.st = 'fleeGround'; s.t = 0; }
        else { s.st = 'flee'; s.t = 0; s.next = 2.5; s.dir = 1; }
      }
      let amp = 0, head = 0, tailW = 0.6, hyaw = 0, climbV = 0, va = 0, tailL = 0.02;
      if (s.st === 'cling') {
        head = s.dir > 0 ? 0.1 : -0.3; hyaw = Math.sin(s.t * 2.2 + s.seed * 9) * 0.5; tailW = 0.25 + 0.5 * Math.max(0, Math.sin(s.t * 3.0));
        // 幹では尾を幹に沿って垂らし、見回すときだけ少し持ち上げる
        tailL = 0.0 + 0.12 * Math.max(0, Math.sin(s.t * 1.1 + s.seed * 5));
        if (s.t > s.next) {
          s.t = 0; const u = r();
          if (u < 0.45) { s.st = 'climb'; s.dir = s.hy < 1.0 ? 1 : s.hy > 4.5 ? -1 : (r() < 0.5 ? 1 : -1); s.next = 0.6 + r() * 1.4; s.va = (r() - 0.5) * 2.5; }
          else if (u < 0.62 && s.hy < 2.5) { s.st = 'climb'; s.dir = -1; s.next = 9; s.toGround = true; s.va = 0; }
          else s.next = 1 + r() * 3;
        }
      } else if (s.st === 'climb' || s.st === 'flee') {
        amp = 1; climbV = (s.st === 'flee' ? 2.2 : 1.3) * s.dir; va = s.st === 'flee' ? 3.2 : s.va; tailL = -0.1;
        if (s.st === 'flee') {
          // 視点の反対側へ回りこむ
          const behind = Math.atan2(tr.z - cam.z, tr.x - cam.x);
          va = clamp(wrapPi(behind - s.a) * 3, -3.5, 3.5);
        }
        if (s.t > s.next || s.hy > 7.5 || (s.dir < 0 && s.hy < 0.25)) {
          if (s.dir < 0 && s.hy < 0.3 && s.toGround) {
            s.st = 'ground'; s.t = 0; s.toGround = false; s.next = 2 + r() * 3;
            const rr = radAt(0.1) + 0.05;
            s.gx = tr.x + Math.cos(s.a) * rr; s.gz = tr.z + Math.sin(s.a) * rr; s.yaw = Math.atan2(Math.cos(s.a), Math.sin(s.a));
            s.tx = s.gx + Math.cos(s.a) * (1 + r() * 2); s.tz = s.gz + Math.sin(s.a) * (1 + r() * 2);
          } else { s.st = 'cling'; s.t = 0; s.next = 1 + r() * 2.5; }
        }
      } else if (s.st === 'ground' || s.st === 'fleeGround') {
        // 根元のまわりを跳ねて、戻る（尾は後ろへなびく）
        amp = 1; tailL = 0.12;
        const back = s.st === 'fleeGround';
        if (back) { s.tx = tr.x + Math.cos(s.a) * radAt(0.1); s.tz = tr.z + Math.sin(s.a) * radAt(0.1); }
        const dx = s.tx - s.gx, dz = s.tz - s.gz, d = Math.hypot(dx, dz);
        s.yaw = turnTo(s.yaw, yawTo(dx, dz), dt * 6);
        const sp = back ? 2.5 : 1.0;
        if (d > 0.08) { s.gx += Math.sin(s.yaw) * sp * dt; s.gz += Math.cos(s.yaw) * sp * dt; }
        if (d < 0.1 || s.t > 6) {
          if (back || s.eaten) { s.st = back ? 'flee' : 'climb'; s.dir = 1; s.t = 0; s.next = back ? 2.5 : 1 + r(); s.hy = 0.12; s.a = Math.atan2(s.gz - tr.z, s.gx - tr.x); s.eaten = false; s.va = 0; }
          else { s.st = 'eat'; s.t = 0; s.next = 3 + r() * 4; }
        }
      } else if (s.st === 'eat') {
        amp = 0; head = 0.1; tailW = 0.2; tailL = 0.95;
        if (s.t > s.next) { s.st = 'ground'; s.eaten = true; s.t = 0; s.tx = tr.x + Math.cos(s.a) * radAt(0.1); s.tz = tr.z + Math.sin(s.a) * radAt(0.1); }
      }
      s.hy = Math.max(0.1, s.hy + climbV * dt);
      s.a += va * dt / Math.max(0.2, radAt(s.hy));
      s.amp = ease(s.amp, amp, 10, dt);
      s.head = ease(s.head, head, 6, dt);
      s.hyaw = ease(s.hyaw, hyaw, 6, dt);
      s.tailW = ease(s.tailW, tailW, 5, dt);
      s.tailL = ease(s.tailL ?? 0, tailL, 5, dt);
      s.ph += dt * (s.amp > 0.5 ? 11 : 0);
      if (s.st === 'ground' || s.st === 'fleeGround' || s.st === 'eat') {
        const gy = this.groundAt(s.gx, s.gz);
        const hop = s.amp > 0.5 ? Math.abs(Math.sin(s.ph * 0.5)) * 0.05 : 0;
        // 食べるときは後脚で座って上体を起こす
        s.sit = ease(s.sit || 0, s.st === 'eat' ? 1 : 0, 8, dt);
        this.h.squirrel.push(s.gx, gy + hop, s.gz, s.yaw, 0, 0, 1, this.t, s.ph, s.amp, s.head, s.tailL, -s.sit, s.hyaw, s.tailW, s.seed);
      } else {
        // 幹の上：腹を幹へ向け、頭を上（登る）か下（降りる）へ。横へ回るぶん少し傾く
        const rr = radAt(s.hy);
        const x = tr.x + Math.cos(s.a) * rr, z = tr.z + Math.sin(s.a) * rr;
        const pitch = s.dir > 0 || s.st === 'flee' ? -Math.PI / 2 : Math.PI / 2;
        const yaw = Math.atan2(-Math.cos(s.a), -Math.sin(s.a)) + (pitch > 0 ? Math.PI : 0);
        const roll = clamp(va * 0.25, -0.6, 0.6) * (pitch < 0 ? 1 : -1);
        this.h.squirrel.push(x, baseY + s.hy, z, yaw, pitch, roll, 1, this.t, s.ph, s.amp, s.head, s.tailL, 0, s.hyaw, s.tailW * 0.5, s.seed);
      }
    }
  }

  // ---- ニワトリ：首を前後させて歩き、ついばみ、足で土をかく。驚くと羽をばたつかせて走る ----
  _chickens(dt, cam, dCam, K) {
    const r = this.r;
    for (const c of this.chickens) {
      const dc = dCam(c.x, c.y + 0.35, c.z);
      if (dc > 160) continue;
      c.t += dt;
      if (dc < 4.5 * K && c.st !== 'flee') { c.st = 'flee'; c.t = 0; c.next = 1.5 + r(); const ay = yawTo(c.x - cam.x, c.z - cam.z) + (r() - 0.5); c.tx = c.x + Math.sin(ay) * 5; c.tz = c.z + Math.cos(ay) * 5; }
      let amp = 0, spd = 0, peck = 0, flap = 0, scratch = 0, hyaw = c.hyaw;
      if (c.st === 'peck') {
        // ついばむ：素早く頭を下げて戻す
        const u = (c.t * 2.2 + c.seed * 3) % 1;
        peck = u < 0.35 ? Math.sin(u / 0.35 * Math.PI) : 0.25;
        if (c.t > c.next) {
          c.t = 0; const u2 = r();
          if (u2 < 0.45) { c.st = 'walk'; const p = c.coop.pts[Math.floor(r() * c.coop.pts.length)]; c.tx = c.x + (p[0] - c.x) * 0.3 + (r() - 0.5) * 2; c.tz = c.z + (p[1] - c.z) * 0.3 + (r() - 0.5) * 2; c.next = 5; }
          else if (u2 < 0.65) { c.st = 'scratch'; c.next = 1.2 + r(); c.scratch = r() < 0.5 ? -1 : 1; }
          else if (u2 < 0.8) { c.st = 'look'; c.next = 1 + r() * 2; }
          else c.next = 1 + r() * 3;
        }
      } else if (c.st === 'walk') {
        amp = 0.5; spd = 0.35;
        const d = this._walk(c, spd, dt, 3);
        if (d < 0.2 || c.t > c.next) { c.st = 'peck'; c.t = 0; c.next = 2 + r() * 4; }
      } else if (c.st === 'scratch') {
        scratch = c.scratch; peck = 0.35;
        if (c.t > c.next) { c.st = 'peck'; c.t = 0; c.next = 1.5 + r() * 2; c.scratch = 0; }
      } else if (c.st === 'look') {
        // 首をかしげて片目で見る
        hyaw = Math.sin(c.t * 5) > 0 ? 0.6 : -0.6;
        if (dc < 20) hyaw = clamp(this._lookAt(c, cam) + 1.2 * Math.sign(Math.sin(c.t * 3)), -1.4, 1.4);
        if (c.t > c.next) { c.st = 'peck'; c.t = 0; c.next = 2 + r() * 3; }
      } else {
        amp = 1; spd = 2.4; flap = 1;
        this._walk(c, spd, dt, 5);
        if (c.t > c.next) { c.st = 'look'; c.t = 0; c.next = 2; }
      }
      c.amp = ease(c.amp, amp, 6, dt);
      c.peck = c.st === 'peck' ? peck : ease(c.peck, peck, 8, dt);
      c.flap = ease(c.flap, flap, 6, dt);
      c.hyaw = c.st === 'look' ? hyaw : ease(c.hyaw, 0, 4, dt);
      c.ph += dt * (c.amp > 0.7 ? 14 : 7.5) * Math.min(1, c.amp * 3);
      // 歩くと頭は空間に止まろうとして、体が追いつくと前へ突き出す
      const bob = c.amp > 0.05 && c.amp < 0.8 ? ((c.ph / Math.PI) % 1) * -2 + 1 : 0;
      c.y = this.groundAt(c.x, c.z);
      const hop = c.st === 'flee' ? Math.abs(Math.sin(c.ph * 0.5)) * 0.08 : 0;
      const herd = c.kind === 2 ? this.h.rooster : c.kind === 1 ? this.h.leghorn : this.h.hen;
      herd.push(c.x, c.y + hop, c.z, c.yaw, 0, 0, c.kind === 2 ? 1.12 : 1, this.t, c.ph, c.amp, c.peck, c.flap, bob * c.amp * 2, c.hyaw, scratch, c.seed);
    }
  }

  // ---- ネコ：縁側の前の三毛は香箱をつくり、h4の縁側のきじ白は横になって日向ぼっこ（目を閉じ、尾の先だけ動く）。
  //      近づくと顔を上げ（横になっていれば香箱に起き直り）、ときどきすわってこちらを見る。
  //      庭のきじ白は尾を立ててゆっくり歩き、止まって香箱・すわる。すぐそばまで来ると走って逃げる ----
  _cats(dt, cam, dCam, K) {
    const r = this.r;
    for (const c of this.cats) {
      const dc = dCam(c.x, c.y + 0.2, c.z);
      if (dc > 120) continue;
      c.t += dt;
      // head＝頭を下げる(rad)・tailL＝立ち姿の尾を立てる・tailW＝尾の先を振る・side＝伏せ方（0 香箱・1 横になる）
      let amp = 0, spd = 0, head = 0.1, lie = 1, side = 0, tailW = 0.15, hyaw = 0, tailL = 0.4;
      if (c.home === 'engawa') {
        const aware = dc < 14;
        if (c.st === 'loaf' || c.st === 'nap') {
          side = c.st === 'nap' ? 1 : 0;
          head = c.st === 'nap' ? 0 : 0.1;
          tailW = 0.1 + 0.3 * Math.max(0, Math.sin(c.t * 0.6));
          if (aware || c.t > c.next) { c.st = 'look'; c.t = 0; c.next = 4 + r() * 5; c.sitUp = aware && r() < 0.6; }
        } else {
          head = -0.1; tailW = 0.35;
          if (c.sitUp) { lie = -1; head = -0.04; }
          hyaw = aware ? this._lookAt(c, cam, 1.2) : Math.sin(c.t * 0.5) * 0.6;
          if (!aware && c.t > c.next) { c.st = c.napper ? 'nap' : 'loaf'; c.t = 0; c.next = 8 + r() * 10; }
        }
      } else {
        if (dc < 4 * K && c.st !== 'flee') { c.st = 'flee'; c.t = 0; c.next = 2; const ay = yawTo(c.x - cam.x, c.z - cam.z); c.tx = c.x + Math.sin(ay) * 8; c.tz = c.z + Math.cos(ay) * 8; }
        if (c.st === 'walk') {
          amp = 0.45; spd = 0.42; lie = 0; head = 0.12; tailL = 1; tailW = 0.25;
          const d = this._walk(c, spd, dt, 1.8);
          if (d < 0.3 || c.t > c.next) { c.t = 0; if (r() < 0.5) { c.st = 'rest'; c.sitRest = r() < 0.5; c.next = 10 + r() * 10; } else { const p = c.pts[Math.floor(r() * c.pts.length)]; c.tx = p[0]; c.tz = p[1]; c.next = 12; } }
        } else if (c.st === 'rest' || c.st === 'loaf') {
          lie = c.sitRest ? -1 : 1; head = c.sitRest ? -0.04 : 0.1; tailW = 0.15;
          if (dc < 18) { head = -0.08; hyaw = this._lookAt(c, cam, 1.2); tailW = 0.35; }
          if (c.t > c.next) { c.st = 'walk'; c.t = 0; const p = c.pts[Math.floor(r() * c.pts.length)]; c.tx = p[0]; c.tz = p[1]; c.next = 12; }
        } else {
          amp = 0.8; spd = 2.4; lie = 0; head = 0; tailL = 0.6; tailW = 0.1;
          this._walk(c, spd, dt, 4);
          if (c.t > c.next) { c.st = 'rest'; c.sitRest = false; c.t = 0; c.next = 8; }
        }
        c.y = this.groundAt(c.x, c.z);
      }
      // 確かめ用：c.pin = { lie, side, amp, spd, head, hyaw, tailL, tailW } で姿勢を固定する
      if (c.pin) ({ amp, spd, lie, side, head, hyaw, tailL, tailW } = { amp, spd, lie, side, head, hyaw, tailL, tailW, ...c.pin });
      c.amp = ease(c.amp, amp, 4, dt);
      // 伏せ⇔すわりは、いったん立ってから：中間の半端な姿勢は短く通りすぎる
      const lieT = (lie < 0 && c.lie > 0.05) || (lie > 0 && c.lie < -0.05) ? 0 : lie;
      c.lie = ease(c.lie, lieT, lieT <= 0 && c.lie <= 0.05 ? 6 : 2.5, dt);
      c.side = ease(c.side ?? side, side, 1.6, dt);
      c.head = ease(c.head, head, 3, dt);
      c.hyaw = ease(c.hyaw, hyaw, 2.5, dt);
      c.tailW = ease(c.tailW, tailW, 2, dt);
      c.tailL = ease(c.tailL ?? 1, tailL, 2, dt);
      // 歩幅：なみ足 約26cm・駆け足 約45cm
      c.ph += dt * spd / (c.amp > 0.62 ? 0.45 : 0.26) * TAU;
      const herd = c.kind === 0 ? this.h.cat0 : this.h.cat1;
      herd.push(c.x, c.y, c.z, c.yaw, 0, 0, 1, c.side, c.ph, c.amp, c.head, c.tailL, c.lie, c.hyaw, c.tailW, c.seed);
    }
  }

  // ---- カメ：岸や岩で甲羅干し（首をのばして日を浴び、甲羅が乾いていく）。近づくと水へすべり込み、しばらく潜ってまた上がる ----
  _turtles(dt, cam, dCam, K) {
    const r = this.r;
    for (const lg of this.logs) {
      if (dCam(lg.x0, lg.y0, lg.z0) < 160) this.h.log.push(lg.x0, lg.y0, lg.z0, lg.yaw, lg.pitch, 0, lg.sc, this.t, 0, 0, 0, 0, 0, 0, 0, (lg.x0 * 0.137) % 1);
    }
    for (const a of this.turtles) {
      const lg = a.perch;
      const baseY = lg ? this._logTop(lg, a.t0).y : this.groundAt(a.x0, a.z0);
      const dc = dCam(a.x, baseY, a.z);
      if (dc > 110) continue;
      a.t += dt;
      let amp = 0, neck = 0.85, lift = 0.35, hyaw = Math.sin(a.t * 0.3 + a.seed * 8) * 0.3;
      let pitch = 0, roll = 0;
      const s = 1.05 + a.seed * 0.5;
      if (a.st === 'bask') {
        a.wet = Math.max(0, a.wet - dt * 0.01);
        if (lg) {
          // 丸太の上：上面に腹をつけ、丸太の傾きに合わせる
          a.pt = a.t0;
          const p = this._logTop(lg, a.pt);
          a.x = p.x; a.z = p.z; a.y = p.y - 0.006 * s;
          a.yaw = lg.yaw + Math.PI + a.jit;
          pitch = -lg.pitch;
        } else { a.x = a.x0; a.z = a.z0; a.y = baseY; }
        if (dc < 16) { neck = 0.6; hyaw = this._lookAt(a, cam, 0.6); }
        if (dc < 7 * K) { a.st = 'slide'; a.t = 0; if (!lg) a.yaw = yawTo(a.water[0] - a.x, a.water[1] - a.z); }
      } else if (a.st === 'slide') {
        // 水の方へ這い、ぽちゃんと落ちる
        amp = 1; neck = 0.6; lift = 0;
        if (lg) {
          a.pt += 0.45 * dt;
          const p = this._logTop(lg, Math.min(a.pt, lg.L));
          a.x = p.x; a.z = p.z; a.y = p.y - 0.006 * s;
          a.yaw = lg.yaw; pitch = lg.pitch;
          if (p.y < a.level + 0.01 || a.pt >= lg.L) { a.st = 'swim'; a.t = 0; a.next = 14 + r() * 20; this.rings(a.x, a.z, 0.7); a.wet = 1; }
        } else {
          const sp = 0.5;
          a.x += Math.sin(a.yaw) * sp * dt; a.z += Math.cos(a.yaw) * sp * dt;
          const inW = this.wet(a.x, a.z);
          a.y = inW ? a.level - 0.02 : this.groundAt(a.x, a.z);
          if (inW || a.t > 3) { a.st = 'swim'; a.t = 0; a.next = 14 + r() * 20; this.rings(a.x, a.z, 0.7); a.wet = 1; }
        }
      } else if (a.st === 'swim') {
        // 水の中を泳いで、戻ってくる
        amp = 0.8; neck = 1; lift = -0.2;
        a.dive = Math.min(1, a.dive + dt * 0.6);
        const back = a.t > a.next;
        const home = lg ? this._logTop(lg, Math.min(lg.L, lg.tW + 0.15)) : { x: a.x0, z: a.z0 };
        const tx = back ? home.x : a.water[0] + Math.cos(a.seed * 20 + a.t * 0.2) * 3, tz = back ? home.z : a.water[1] + Math.sin(a.seed * 20 + a.t * 0.2) * 3;
        a.yaw = turnTo(a.yaw, yawTo(tx - a.x, tz - a.z), dt * 1.2);
        const nx = a.x + Math.sin(a.yaw) * 0.3 * dt, nz = a.z + Math.cos(a.yaw) * 0.3 * dt;
        if (this.wet(nx, nz) || back) { a.x = nx; a.z = nz; } else a.yaw += dt;
        const floor = this.groundAt(a.x, a.z);
        a.y = Math.max(floor + 0.03, a.level - 0.05 - a.dive * 0.3 * (back ? Math.max(0, 1 - (a.t - a.next) * 0.5) : 1));
        if (back && (Math.hypot(a.x - home.x, a.z - home.z) < 0.4 || (!lg && !this.wet(a.x, a.z)))) { a.st = 'climbOut'; a.t = 0; a.dive = 0; if (lg) a.pt = Math.min(lg.L, lg.tW + 0.15); }
      } else {
        // 岸や丸太へ這い上がる
        amp = 0.8; neck = 0.9; lift = 0.2;
        if (lg) {
          a.pt = Math.max(a.t0, a.pt - 0.22 * dt);
          const p = this._logTop(lg, a.pt);
          a.x += (p.x - a.x) * Math.min(1, dt * 6); a.z += (p.z - a.z) * Math.min(1, dt * 6); a.y += (p.y - 0.006 * s - a.y) * Math.min(1, dt * 6);
          a.yaw = turnTo(a.yaw, lg.yaw + Math.PI, dt * 3); pitch = -lg.pitch;
          if (a.pt <= a.t0 + 1e-3) { a.st = 'bask'; a.t = 0; }
        } else {
          a.yaw = turnTo(a.yaw, yawTo(a.x0 - a.x, a.z0 - a.z), dt * 2);
          a.x += (a.x0 - a.x) * Math.min(1, dt * 0.8); a.z += (a.z0 - a.z) * Math.min(1, dt * 0.8);
          a.y += (baseY - a.y) * Math.min(1, dt * 1.2);
          if (a.t > 3) { a.st = 'bask'; a.t = 0; a.yaw0 = a.yaw + Math.PI * (0.5 + r()); }
        }
      }
      if (a.st === 'bask' && !lg) a.yaw = turnTo(a.yaw, a.yaw0, dt * 0.5);
      // 岸の甲羅干し：地面の傾きに合わせる
      if (!lg && a.st !== 'swim') {
        pitch = this._pitch(a, 0.07 * s);
        const R = 0.06 * s, c = Math.cos(a.yaw), sn = Math.sin(a.yaw);
        roll = clamp(Math.atan2(this.groundAt(a.x + c * R, a.z - sn * R) - this.groundAt(a.x - c * R, a.z + sn * R), 2 * R), -0.4, 0.4);
      }
      a.amp = ease(a.amp, amp, 3, dt);
      a.neck = ease(a.neck, neck, 2.5, dt);
      a.lift = ease(a.lift, lift, 2, dt);
      a.hyaw = ease(a.hyaw, hyaw, 1.5, dt);
      a.ph += dt * 3.2 * a.amp;
      this.h.turtle.push(a.x, a.y, a.z, a.yaw, pitch, roll, s, this.t, a.ph, a.amp, a.neck, a.lift, a.wet, a.hyaw, 0, a.seed);
    }
  }

  // ---- 水面のアメンボ・田のオタマジャクシ：視点のまわりの格子ごとに決まった数 ----
  _pads(dt, cam, K) {
    const W = this.world;
    const alt = cam.y - this.groundAt(cam.x, cam.z);
    if (alt > 9) return;
    const C = 3;
    const i0 = Math.floor(cam.x / C), j0 = Math.floor(cam.z / C);
    const R = 5;
    const seen = new Set();
    for (let j = j0 - R; j <= j0 + R; j++) for (let i = i0 - R; i <= i0 + R; i++) {
      const key = i * 73856093 ^ j * 19349663;
      seen.add(key);
      let p = this.pads.get(key);
      if (!p) {
        const h = mulberry32(key >>> 0);
        const cx = (i + h()) * C, cz = (j + h()) * C;
        const k = this.texel(cx, cz);
        const tt = W.type[k];
        const wl = W.water[k];
        const gy = this.groundAt(cx, cz);
        p = { striders: [], tads: [] };
        const paddy = tt === T.FLOODED || tt === T.SEEDLING;
        const still = paddy || tt === T.POND;
        if (still && wl > gy + 0.015) {
          const ns = Math.floor(h() * (paddy ? 7 : 4));
          for (let q = 0; q < ns; q++) p.striders.push({ x: cx + (h() - 0.5) * 2, z: cz + (h() - 0.5) * 2, vx: 0, vz: 0, yaw: h() * TAU, row: h() * 2, rowT: 0, level: wl, seed: h() });
          if (paddy && h() < 0.55) {
            // 畦ぎわの浅いところに群れる
            const n = 6 + Math.floor(h() * 22);
            const gx = cx + (h() - 0.5) * 1.5, gz = cz + (h() - 0.5) * 1.5;
            for (let q = 0; q < n; q++) {
              const a = h() * TAU, rr = Math.sqrt(h()) * 0.7;
              const x = gx + Math.cos(a) * rr, z = gz + Math.sin(a) * rr;
              const g = this.groundAt(x, z);
              if (wl - g < 0.02) continue;
              p.tads.push({ x, z, y: g + Math.min(0.012, (wl - g) * 0.4), yaw: h() * TAU, ph: h() * 6, sp: 0, dart: h() * 3, seed: h(), wl });
            }
          }
        }
        this.pads.set(key, p);
      }
      for (const s of p.striders) {
        // すっと漕いで滑り、止まる
        s.rowT -= dt;
        if (s.rowT <= 0) {
          s.rowT = 0.4 + s.seed * 1.6 + Math.random() * 0.8;
          const dcam = Math.hypot(s.x - cam.x, s.z - cam.z);
          let ay = s.yaw + (Math.random() - 0.5) * 1.6;
          if (dcam < 1.5 && K > 0.5) ay = yawTo(s.x - cam.x, s.z - cam.z);
          s.yaw = ay;
          const v = 0.25 + Math.random() * 0.35;
          s.vx = Math.sin(ay) * v; s.vz = Math.cos(ay) * v; s.row = 0.25;
        }
        s.row = Math.max(0, s.row - dt);
        const nx = s.x + s.vx * dt, nz = s.z + s.vz * dt;
        if (W.water[this.texel(nx, nz)] > this.groundAt(nx, nz) + 0.01) { s.x = nx; s.z = nz; } else { s.vx *= -0.5; s.vz *= -0.5; s.yaw += Math.PI; }
        s.vx *= Math.exp(-dt * 2.2); s.vz *= Math.exp(-dt * 2.2);
        if (Math.hypot(s.x - cam.x, s.z - cam.z) < 14) this.h.strider.push(s.x, s.level + 0.0005, s.z, s.yaw, 0, 0, 1, this.t, s.row > 0 ? Math.sin((0.25 - s.row) / 0.25 * Math.PI) : 0, 0, 0, 0, 0, 0, 0, s.seed);
      }
      for (const q of p.tads) {
        q.dart -= dt;
        if (q.dart <= 0) { q.dart = 0.6 + Math.random() * 3; q.sp = 0.08 + Math.random() * 0.12; q.yaw += (Math.random() - 0.5) * 2.5; }
        q.sp *= Math.exp(-dt * 2.5);
        const nx = q.x + Math.sin(q.yaw) * q.sp * dt, nz = q.z + Math.cos(q.yaw) * q.sp * dt;
        if (q.wl - this.groundAt(nx, nz) > 0.02) { q.x = nx; q.z = nz; } else q.yaw += Math.PI * 0.7;
        q.ph += dt * (4 + q.sp * 120);
        if (Math.hypot(q.x - cam.x, q.z - cam.z) < 10) this.h.tadpole.push(q.x, q.y, q.z, q.yaw, 0, 0, 0.9 + q.seed * 0.5, this.t, q.ph, Math.min(1, q.sp * 8), 0, 0, 0, 0, 0, q.seed);
      }
    }
    if (this.pads.size > 500) for (const k of this.pads.keys()) if (!seen.has(k)) this.pads.delete(k);
  }
}
