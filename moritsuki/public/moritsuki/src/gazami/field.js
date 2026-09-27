// 砂の中のカニの配置と、手ざわりの当たり
// ・カニは「いい場所」（群れ場）にかたまっていて、そこではいたるところにいる。ほかはまばら
// ・群れ場は日ごとに変わる。最初の群れ場はスタートから少し歩いた所
// ・石と貝殻（カニでない硬いもの）は、1m のマスごとに決まった数だけ（覚えておかず、その場で計算）
import { RNG, clamp, smoothstep } from './core/noise.js';
import { CRABS, LEGEND_RATE } from './species.js';

export const LOW_TIDE = -0.08;   // 始まりの潮位
export const HIGH_TIDE = 0.1;    // 終わりの潮位
const CELL = 1;
const X0 = -44, X1 = 116;         // 河口と突堤の間
// 甲羅の長さの半分 / 幅（当たりのだ円）
const HL = { taiwan: 0.235, ishi: 0.345, taraba: 0.47 };

function hash2(i, j, s) {
  let h = (i * 374761393 + j * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export class Field {
  /** legend: タラバガニが現れるか（ガザミを合計 100 匹拾ったあと） */
  constructor(beach, day, start, legend = false) {
    this.beach = beach;
    this.day = day;
    this.items = [];
    this.grid = new Map();
    this.spots = [];
    const rng = (this.rng = new RNG(day * 7919 + 17));
    // 群れ場: 1 つめはスタートから 6〜10m 沖、残りは浜ぞいに散らす
    const depthAt = (x, z) => LOW_TIDE + 0.02 - beach.heightAt(x, z);
    const pickSpot = (x0, x1, near) => {
      for (let k = 0; k < 60; k++) {
        const x = rng.range(x0, x1), z = rng.range(8, 34);
        const d = depthAt(x, z);
        if (d < 0.1 || d > 0.34) continue;
        if (near && Math.hypot(x - near.x, z - near.z) > 11) continue;
        if (this.spots.some((s) => Math.hypot(s.x - x, s.z - z) < s.r + 5)) continue;
        return { x, z };
      }
      return null;
    };
    const first = pickSpot(start.x - 9, start.x + 9, start);
    if (first) this.spots.push({ ...first, r: rng.range(3.4, 4.2), dens: rng.range(12.6, 15) });
    const N = 11;
    for (let i = 0; i < N; i++) {
      const p = pickSpot(X0 + 4, X1 - 4);
      if (p) this.spots.push({ ...p, r: rng.range(3, 6), dens: rng.range(9, 16.5) });
    }
    // カニを置く
    const add = (x, z) => {
      if (x < X0 || x > X1) return;
      const d = depthAt(x, z);
      if (d < 0.07 || d > 0.52) return;
      if (this.nearest(x, z, 0.15)) return; // 近すぎる所には置かない
      const r = rng.next();
      let id = 'ishigani', acc = 0;
      for (const k of ['taiwanM', 'taiwanF', 'ishigani']) { acc += CRABS[k].share; if (r < acc) { id = k; break; } }
      const sp = CRABS[id];
      // 大きさ: 真ん中より少し小さめが多い。たまに大きいの
      const u = Math.pow(rng.next(), 1.35);
      const cm = Math.round((sp.size[0] + (sp.size[1] - sp.size[0]) * (rng.next() < 0.06 ? 0.85 + rng.next() * 0.15 : u * 0.85)) * 10) / 10;
      const it = { id, sp, cm, seed: rng.next(), x, z, yaw: rng.range(0, Math.PI * 2), depth: rng.range(0.004, 0.022), alive: true, anger: 0, lastTouch: -99, pricks: 0, move: null };
      const W = cm / 100;
      it.hw = W * 0.5; it.hl = W * HL[sp.model];
      this.items.push(it);
      this.put(it);
    };
    for (const s of this.spots) {
      const n = Math.round(Math.PI * s.r * s.r * s.dens);
      for (let i = 0; i < n * 1.3; i++) {
        const a = rng.range(0, Math.PI * 2), rr = s.r * Math.sqrt(rng.next()) * (0.9 + rng.next() * 0.35);
        // 真ん中ほど濃い
        if (rng.next() > 1 - 0.55 * (rr / s.r)) continue;
        add(s.x + Math.cos(a) * rr, s.z + Math.sin(a) * rr * 0.8);
      }
    }
    // まばらな所
    for (let i = 0; i < 1560; i++) add(rng.range(X0, X1), rng.range(6, 36));
    if (legend) this.addLegends();
  }

  /**
   * 砂の中のカニの LEGEND_RATE（100 匹に 1 匹）をタラバガニにする。大きいので、まわり 30cm のカニはどける。
   * 浜を作るときに呼ぶ（開放は次の夜から）。?debug の dbg.legend() で今夜の浜に入れるときは、残っているカニから選ぶ
   */
  addLegends() {
    if (this.legend) return 0;
    this.legend = true;
    const rng = new RNG(this.day * 104729 + 71);
    const sp = CRABS.taraba;
    let n = 0;
    for (const it of [...this.items]) {
      if (!it.alive || it.walk || it.id === 'taraba' || rng.next() >= LEGEND_RATE) continue;
      for (const o of [...this.around(it.x, it.z, 0.3)]) if (o !== it && o.alive && !o.walk && Math.hypot(o.x - it.x, o.z - it.z) < 0.3) this.remove(o);
      const u = Math.pow(rng.next(), 1.2);
      it.id = 'taraba'; it.sp = sp;
      it.cm = Math.round((sp.size[0] + (sp.size[1] - sp.size[0]) * u) * 10) / 10;
      const W = it.cm / 100;
      it.hw = W * 0.5; it.hl = W * HL.taraba;
      it.depth = rng.range(0.01, 0.03);
      n++;
    }
    return n;
  }

  key(i, j) { return i * 100003 + j; }
  put(it) {
    it.ci = Math.floor(it.x / CELL); it.cj = Math.floor(it.z / CELL);
    const k = this.key(it.ci, it.cj);
    if (!this.grid.has(k)) this.grid.set(k, []);
    this.grid.get(k).push(it);
  }
  unput(it) {
    const L = this.grid.get(this.key(it.ci, it.cj));
    if (L) { const i = L.indexOf(it); if (i >= 0) L.splice(i, 1); }
  }
  /** 位置が変わった（逃げた）ときに入れ直す */
  moved(it) {
    const ci = Math.floor(it.x / CELL), cj = Math.floor(it.z / CELL);
    if (ci === it.ci && cj === it.cj) return;
    this.unput(it); this.put(it);
  }
  *around(x, z, r) {
    const i0 = Math.floor((x - r) / CELL), i1 = Math.floor((x + r) / CELL), j0 = Math.floor((z - r) / CELL), j1 = Math.floor((z + r) / CELL);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      const L = this.grid.get(this.key(i, j));
      if (L) yield* L;
    }
  }
  nearest(x, z, r) {
    let best = null, bd = r;
    for (const it of this.around(x, z, r)) {
      if (!it.alive) continue;
      const d = Math.hypot(it.x - x, it.z - z);
      if (d < bd) { bd = d; best = it; }
    }
    return best;
  }
  remove(it) { it.alive = false; this.unput(it); }

  /** 点 (x, z) がカニの甲羅の上か（margin だけ広げて）。カニのローカルでの位置も返す */
  over(it, x, z, margin = 0) {
    const dx = x - it.x, dz = z - it.z;
    const c = Math.cos(it.yaw), s = Math.sin(it.yaw);
    // カニのローカル（+z = 前）。yaw だけ回した向き: 前 = (sin yaw, cos yaw)
    const lx = dx * c - dz * s, lz = dx * s + dz * c;
    const e = (lx / (it.hw + margin)) ** 2 + (lz / (it.hl + margin)) ** 2;
    return e < 1 ? { lx, lz, e } : null;
  }

  /** 手のひら（中心 x, z、半径 r）が触れているカニ */
  touching(x, z, r) {
    let best = null, be = 1;
    for (const it of this.around(x, z, 0.3)) {
      if (!it.alive || it.move) continue;
      const o = this.over(it, x, z, r);
      if (o && o.e < be) { be = o.e; best = { it, ...o }; }
    }
    return best;
  }

  /** 砂の中の石・貝殻（1m のマスごとに決まる）。手のひらが触れているもの */
  hardAt(x, z, r) {
    const i0 = Math.floor(x - 0.5), j0 = Math.floor(z - 0.5);
    for (let i = i0; i <= i0 + 1; i++) for (let j = j0; j <= j0 + 1; j++) {
      const n = Math.floor(hash2(i, j, this.day) * 4.2);
      for (let k = 0; k < n; k++) {
        const hx = i + hash2(i, j, this.day * 3 + k * 7 + 1), hz = j + hash2(i, j, this.day * 5 + k * 11 + 2);
        const kind = hash2(i, j, k * 13 + 5) < 0.55 ? 'kara' : 'ishi';
        const rr = kind === 'ishi' ? 0.03 : 0.022;
        if (Math.hypot(hx - x, hz - z) < rr + r) return { kind, x: hx, z: hz, key: `${i},${j},${k}` };
      }
    }
    return null;
  }

  /** 群れ場の中か（0..1） */
  spotK(x, z) {
    let k = 0;
    for (const s of this.spots) k = Math.max(k, smoothstep(s.r * 1.3, s.r * 0.5, Math.hypot(x - s.x, (z - s.z) / 0.8)));
    return clamp(k, 0, 1);
  }
  get remaining() { return this.items.filter((i) => i.alive).length; }
}
