// 砂の中にいるもの（貝・石・流木）の配置と、突いたときの当たり判定
// ・場所ごとの密度: 河口の干潟に本ハマグリ、外浜のひざより深い所にチョウセンハマグリ、浅い所にナガラミの群れ…
// ・群れ（パッチ）は日によって少しずつ動く（ノイズの位置を日でずらす）
// ・爪（格子の 25 本）のどれかが殻の上に来て、殻の上の砂の厚さが爪の刺さる深さより浅ければ「当たり」
import { SHELLS } from './species.js';
import { GROYNE_X, BOUNDS, barZ, mouthK, riverX } from './beach.js';
import { RNG, makeNoise2D, fbm2, smoothstep, clamp, lerp } from './core/noise.js';

const CELL = 1;
export const LOW_TIDE = -0.05; // 始まりの潮位（干潮）

export class Field {
  constructor(beach, day = 1, { legends = false } = {}) {
    this.beach = beach;
    this.day = day;
    this.items = [];
    this.grid = new Map();
    this.generate(legends);
  }

  key(i, j) { return i * 100003 + j; }

  add(it) {
    it.alive = true;
    this.items.push(it);
    const k = this.key(Math.floor(it.x / CELL), Math.floor(it.z / CELL));
    if (!this.grid.has(k)) this.grid.set(k, []);
    this.grid.get(k).push(it);
  }

  generate(legends) {
    const rng = new RNG(9001 + this.day * 131);
    const off = this.day * 37.7;
    const pA = makeNoise2D(11), pB = makeNoise2D(22), pC = makeNoise2D(33), pD = makeNoise2D(44);
    const patch = (n, x, z, sc) => fbm2(n, x * sc + off, z * sc * 1.6 - off * 0.7, 3) * 0.5 + 0.5;
    const pois = (lambda) => { let k = 0, p = Math.exp(-lambda), s = p, u = rng.next(); while (u > s && k < 12) { k++; p *= lambda / k; s += p; } return k; };
    const B = BOUNDS;
    const honCells = []; // 本ハマグリのいるマス [x, z, 水深, 密度]（ハマグリの主の場所えらび）
    for (let x = B.x0; x < B.x1; x += CELL) {
      for (let z = -6; z < 80; z += CELL) {
        const cx = x + 0.5, cz = z + 0.5;
        const bed = this.beach.heightAt(cx, cz);
        const d = LOW_TIDE - bed; // 干潮での水深
        if (d < -0.25 || d > 1.15) continue;
        // 河口の黒っぽい砂の所 = 本ハマグリの干潟（見た目の色と同じ関数で決める）
        const river = mouthK(cx, cz);
        const inChannel = Math.abs(cx - riverX(cz)) < 5 && cz < 30;
        const dens = {};
        // 本ハマグリ: 河口の細かい砂
        const hp = patch(pA, cx, cz, 0.06);
        dens.honhama = smoothstep(0.45, 0.8, river) * inRange(d, 0.08, 0.78) * (hp > 0.55 ? 0.85 : 0.08) * (inChannel ? 0.2 : 1);
        if (dens.honhama > 0.01) honCells.push([cx, cz, d, dens.honhama]);
        // チョウセンハマグリ: 外浜のひざより深い所（深いほど多く大きい）
        const cp = patch(pB, cx, cz, 0.05);
        const open = (1 - smoothstep(0.05, 0.4, river)) * smoothstep(-150, -140, cx) * (1 - smoothstep(GROYNE_X - 12, GROYNE_X - 2, cx));
        dens.chosen = open * inRange(d, 0.26, 1.05) * (cp > 0.5 ? 0.62 * (0.6 + smoothstep(0.3, 0.8, d) * 0.6) : 0.075);
        // バカガイ: どこにでも少し、ところどころ多い
        const bp = patch(pC, cx, cz, 0.07);
        dens.bakagai = inRange(d, 0.08, 0.95) * (bp > 0.6 ? 0.32 : 0.06);
        // ナガラミ: 浅い所に群れる
        const np = patch(pD, cx, cz, 0.09);
        dens.nagarami = (1 - smoothstep(0.05, 0.3, river)) * inRange(d, 0.04, 0.55) * (np > 0.63 ? 2.2 : 0.02);
        // ツメタガイ: ハマグリの群れのそば
        dens.tsumeta = (dens.honhama + dens.chosen) * 0.07 + 0.006 * inRange(d, 0.1, 0.9);
        // ハズレ
        dens.kara = inRange(d, -0.25, 1.1) * (0.2 + river * 0.25) + (dens.honhama + dens.chosen) * 0.2;
        dens.ishi = smoothstep(GROYNE_X - 34, GROYNE_X - 6, cx) * 0.55 + 0.035;
        dens.ryuboku = river * 0.05 + 0.008;
        for (const id in dens) {
          const n = pois(dens[id] * CELL * CELL);
          for (let k = 0; k < n; k++) this.spawn(id, cx + rng.range(-0.5, 0.5), cz + rng.range(-0.5, 0.5), d, rng);
        }
      }
    }
    // 伝説（図鑑を全部そろえたら）
    this.legends = [];
    if (legends) {
      const r2 = new RNG(777 + this.day * 17);
      const apart = (x, z) => this.legends.every((it) => (it.x - x) ** 2 + (it.z - z) ** 2 > 0.6 * 0.6);
      // ハマグリの主（10 個）: 本ハマグリと同じ所。本ハマグリの多いマスほど選ばれやすい
      const sum = honCells.reduce((s, c) => s + c[3], 0);
      for (let n = 0, tries = 0; n < 10 && sum > 0 && tries < 400; tries++) {
        let u = r2.next() * sum, c = honCells[honCells.length - 1];
        for (const h of honCells) { u -= h[3]; if (u <= 0) { c = h; break; } }
        const x = c[0] + r2.range(-0.5, 0.5), z = c[1] + r2.range(-0.5, 0.5);
        if (!apart(x, z)) continue;
        this.legends.push(this.spawn('nushiHama', x, z, c[2], r2)); n++;
      }
      // チョウセンハマグリの主（100 個）: 沖の瀬の手前の溝
      for (let n = 0, tries = 0; n < 100 && tries < 40000; tries++) {
        const x = r2.range(-40, 100);
        const z = barZ(x) - r2.range(11, 15);
        const d = LOW_TIDE - this.beach.heightAt(x, z);
        if (d > 0.62 && d < 0.86 && apart(x, z)) { this.legends.push(this.spawn('nushiChosen', x, z, d, r2)); n++; }
      }
    }
  }

  spawn(id, x, z, d, rng) {
    const sp = SHELLS[id];
    let t = Math.pow(rng.next(), 1.5);
    if (id === 'chosen') t = clamp(t * 0.7 + smoothstep(0.3, 0.95, d) * 0.45 * rng.next(), 0, 1);
    const cm = Math.round(lerp(sp.size[0], sp.size[1], t) * 10) / 10;
    const L = cm / 100;
    let W, H;
    if (sp.kind === 'clam') { W = L * (id === 'bakagai' ? 0.5 : 0.48); H = L * 0.8; }
    else if (sp.kind === 'valve') { W = L * 0.8; H = L * 0.25; } // 空き殻は寝ている
    else if (sp.kind === 'snail') { W = L; H = L * 0.5; }
    else if (sp.kind === 'moon') { W = L * 0.95; H = L * 0.75; }
    else if (sp.kind === 'stone') { W = L * 0.8; H = L * 0.55; }
    else { W = L * 0.18; H = L * 0.18; }
    // 大きいほど深い
    const depth = lerp(sp.depth[0], sp.depth[1], clamp(rng.next() * 0.7 + t * 0.3, 0, 1));
    const it = { id, sp, x, z, cm, L, W, H, depth, yaw: rng.range(0, Math.PI * 2), tilt: rng.range(-0.25, 0.25), seed: rng.next() };
    this.add(it);
    return it;
  }

  near(x, z, r) {
    const out = [];
    const i0 = Math.floor((x - r) / CELL), i1 = Math.floor((x + r) / CELL);
    const j0 = Math.floor((z - r) / CELL), j1 = Math.floor((z + r) / CELL);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      const l = this.grid.get(this.key(i, j));
      if (l) for (const it of l) if (it.alive) out.push(it);
    }
    return out;
  }

  /** 爪の先（[x,z] の配列）が pen の深さまで刺さるとき、最初に当たるもの { it, depth, tine } */
  stab(tines, pen) {
    let cx = 0, cz = 0;
    for (const [x, z] of tines) { cx += x; cz += z; }
    cx /= tines.length; cz /= tines.length;
    let best = null;
    for (const it of this.near(cx, cz, 0.4)) {
      const c = Math.cos(it.yaw), s = Math.sin(it.yaw);
      const a = it.L / 2, b = Math.max(it.W / 2, 0.006);
      for (let k = 0; k < tines.length; k++) {
        const dx = tines[k][0] - it.x, dz = tines[k][1] - it.z;
        const u = (dx * c + dz * s) / a, v = (-dx * s + dz * c) / b;
        const q = u * u + v * v;
        if (q >= 1) continue;
        const dep = it.depth + it.H * 0.28 * q;
        if (dep > pen) continue;
        if (!best || dep < best.depth) best = { it, depth: dep, tine: k };
      }
    }
    return best;
  }

  remove(it) { it.alive = false; }

  /** 水管の穴（生きた二枚貝の上の砂の小さな穴）: [x, z, 向き, 大きさ] */
  siphons(x, z, r) {
    const out = [];
    for (const it of this.near(x, z, r)) {
      if (!it.sp.siphon || it.depth > 0.055) continue;
      const k = it.L * 0.36;
      out.push([it.x + Math.cos(it.yaw) * k, it.z + Math.sin(it.yaw) * k, it.yaw, it.sp.legend ? 3.2 : clamp(it.L / 0.07, 0.6, 1.4)]);
    }
    return out;
  }
}

function inRange(d, a, b) { return smoothstep(a - 0.06, a + 0.04, d) * (1 - smoothstep(b - 0.06, b + 0.06, d)); }
