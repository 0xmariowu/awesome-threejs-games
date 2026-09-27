// 砂の中のフグと、まぎらわしく光る物（赤い小石・茶色いガラス・貝殻のかけら）の配置と動き
// ・フグは「いい場所」（群れ場）にかたまっている。群れ場は日ごとに変わる。1 つめはスタートから少し歩いた所
// ・小石の多い所（小石まじり）は、光る物だらけ。そこにもフグはいて、むしろ多い
// ・砂にもぐったフグは、どの種類も同じ大きさ・同じ光り方に見える（つかむまで正体はわからない）
// ・驚いたフグは砂から飛び出して泳いで逃げ、少し先でまたもぐる
import { RNG, clamp, smoothstep, makeNoise2D, fbm2 } from './core/noise.js';
import { FUGU, RARE_RATE, LEGEND_RATE, rollSize } from './species.js';
import { eyeLocal } from './fugu.js';
import { EYE_COL } from './shine.js';

export const LOW_TIDE = -0.08;   // 始まりの潮位
export const HIGH_TIDE = 0.1;    // 終わりの潮位
const CELL = 1;
const X0 = -44, X1 = 116;        // 河口と突堤の間
const nG = makeNoise2D(9173), nG2 = makeNoise2D(5519);

/** 小石まじりの度合い 0..1（浜ぜんたいで決まっている。波打ち際から沖へ帯になって、まだらに） */
export function gravelK(x, z) {
  const a = fbm2(nG, x * 0.045, z * 0.07, 3) * 0.5 + 0.5;
  const b = nG2(x * 0.3, z * 0.3) * 0.5 + 0.5;
  return clamp(smoothstep(0.58, 0.72, a + b * 0.08) * smoothstep(-2, 4, z) * (1 - smoothstep(34, 44, z)), 0, 1);
}

const EYE = eyeLocal('kusa');

export class Field {
  /** legend: トラフグが砂にまじるか（クサフグを合計 30 匹獲ったあと） */
  constructor(beach, day, start, legend = false) {
    this.beach = beach;
    this.day = day;
    this.fugu = [];
    this.decoys = [];
    this.grid = new Map();
    this.spots = [];
    this.legend = legend;
    const rng = (this.rng = new RNG(day * 7919 + 23));
    const depthAt = (x, z) => LOW_TIDE + 0.02 - beach.heightAt(x, z);
    const pickSpot = (x0, x1, near) => {
      for (let k = 0; k < 80; k++) {
        const x = rng.range(x0, x1), z = rng.range(4, 30);
        const d = depthAt(x, z);
        if (d < 0.08 || d > 0.3) continue;
        if (near && Math.hypot(x - near.x, z - near.z) > 10) continue;
        if (this.spots.some((s) => Math.hypot(s.x - x, s.z - z) < s.r + 5)) continue;
        return { x, z };
      }
      return null;
    };
    const first = pickSpot(start.x - 8, start.x + 8, start);
    if (first) this.spots.push({ ...first, r: rng.range(4, 5), dens: rng.range(0.34, 0.4) });
    for (let i = 0; i < 14; i++) {
      const p = pickSpot(X0 + 4, X1 - 4);
      if (p) this.spots.push({ ...p, r: rng.range(3.5, 6.5), dens: rng.range(0.22, 0.42) });
    }
    // フグを置く
    const addFugu = (x, z) => {
      if (x < X0 || x > X1) return;
      const d = depthAt(x, z);
      if (d < 0.05 || d > 0.4) return;
      if (this.nearestFugu(x, z, 0.28)) return;
      const r = rng.next();
      let id = 'kusa';
      if (legend && r < LEGEND_RATE) id = 'tora';
      else if (r < (legend ? LEGEND_RATE : 0) + RARE_RATE) id = rng.next() < 0.5 ? 'higan' : 'shosai';
      const sp = FUGU[id];
      const cm = rollSize(sp, rng.next(), rng.next());
      // もぐっている時に見える大きさ（どの種類も、クサフグと同じ大きさに見える）
      const glintCm = rollSize(FUGU.kusa, rng.next(), rng.next());
      const f = {
        kind: 'fugu', id, cm, glintCm, seed: rng.next(), x, z, yaw: rng.range(0, Math.PI * 2),
        alive: true, state: 'bur', eyeT: rng.range(0, 100), mesh: null, swim: null,
      };
      this.fugu.push(f);
      this.put(f);
    };
    for (const s of this.spots) {
      const n = Math.round(Math.PI * s.r * s.r * s.dens);
      for (let i = 0; i < n * 1.4; i++) {
        const a = rng.range(0, Math.PI * 2), rr = s.r * Math.sqrt(rng.next());
        if (rng.next() > 1 - 0.5 * (rr / s.r)) continue; // 真ん中ほど濃い
        addFugu(s.x + Math.cos(a) * rr, s.z + Math.sin(a) * rr * 0.8);
      }
    }
    // まばらな所（小石まじりには少し多め）
    for (let i = 0; i < 900; i++) {
      const x = rng.range(X0, X1), z = rng.range(2, 34);
      if (rng.next() < 0.45 + gravelK(x, z) * 0.55) addFugu(x, z);
    }
    // 光る物: どこにでも少し、小石まじりにはたくさん
    const addDecoy = (x, z) => {
      const d = depthAt(x, z);
      if (d < 0.0 || d > 0.5) return;
      const u = rng.next();
      const type = u < 0.62 ? 'chert' : u < 0.84 ? 'glass' : 'shell';
      // 面の向き: 上向きのまわりにばらつく
      const tilt = Math.pow(rng.next(), 0.8) * 0.9, az = rng.range(0, Math.PI * 2);
      const n = [Math.sin(tilt) * Math.cos(az), Math.cos(tilt), Math.sin(tilt) * Math.sin(az)];
      // 光り方: 丸い小石はどこから見ても光る（眼とほとんど同じ）。平たい面は、向きが合った時だけ鋭く光る
      const round = rng.next() < (type === 'chert' ? 0.55 : type === 'shell' ? 0.3 : 0.08);
      const sharp = round ? rng.range(0.3, 1.0) : type === 'glass' ? rng.range(20, 60) : type === 'shell' ? rng.range(5, 15) : rng.range(8, 30);
      const str = round ? rng.range(1.0, 1.5) : rng.range(0.75, 1.2);
      // 色: 眼と同じ深い赤から、ほんの少し橙へ
      const o = rng.next() < 0.35 ? 0 : rng.next();
      const col = type === 'glass' ? [1, 0.15 + 0.08 * o, 0.05] : type === 'shell' ? [1, 0.13 + 0.04 * o, 0.06 + 0.05 * o] : [1, 0.13 + 0.07 * o, 0.05 + 0.025 * o];
      const size = type === 'glass' ? rng.range(0.012, 0.028) : type === 'shell' ? rng.range(0.014, 0.03) : rng.range(0.01, 0.024);
      const dc = { kind: 'decoy', type, x, z, n, sharp, str, col, size, seed: rng.next(), yaw: rng.range(0, Math.PI * 2), alive: true, lift: rng.range(0.25, 0.55) };
      this.decoys.push(dc);
      this.put(dc);
      // ときどき、すぐそばにもう 1 つ（2 つ並ぶと眼に見える）
      if (rng.next() < 0.22) {
        const a = rng.range(0, Math.PI * 2), sep = rng.range(0.009, 0.03);
        const tw = { ...dc, x: x + Math.cos(a) * sep, z: z + Math.sin(a) * sep, seed: rng.next(), yaw: rng.range(0, 6.28), size: dc.size * rng.range(0.7, 1.1) };
        const t2 = tilt * rng.range(0.6, 1.2), a2 = az + rng.range(-0.8, 0.8);
        tw.n = [Math.sin(t2) * Math.cos(a2), Math.cos(t2), Math.sin(t2) * Math.sin(a2)];
        this.decoys.push(tw);
        this.put(tw);
      }
    };
    for (let i = 0; i < 1500; i++) addDecoy(rng.range(X0, X1), rng.range(0, 36));
    for (let i = 0; i < 9000; i++) {
      const x = rng.range(X0, X1), z = rng.range(0, 36);
      const g = gravelK(x, z);
      if (g > 0.05 && rng.next() < g * 0.95) addDecoy(x, z);
    }
    // 群れ場のそばにも（見分けの練習になるように）
    for (const s of this.spots) for (let i = 0; i < Math.PI * s.r * s.r * 0.22; i++) {
      const a = rng.range(0, Math.PI * 2), rr = s.r * 1.2 * Math.sqrt(rng.next());
      addDecoy(s.x + Math.cos(a) * rr, s.z + Math.sin(a) * rr);
    }
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
  nearestFugu(x, z, r) {
    let best = null, bd = r;
    for (const it of this.around(x, z, r)) {
      if (it.kind !== 'fugu' || !it.alive) continue;
      const d = Math.hypot(it.x - x, it.z - z);
      if (d < bd) { bd = d; best = it; }
    }
    return best;
  }
  remove(it) { it.alive = false; this.unput(it); }

  /** もぐっているフグの、眼（左右）の位置と向き（世界） */
  buriedEyes(f, groundAt, t, out) {
    const L = f.glintCm / 100;
    const c = Math.cos(f.yaw), s = Math.sin(f.yaw);
    const g = groundAt(f.x, f.z);
    // 眼玉はときどき、ゆっくり動く（光の強さが少しずつ変わる）
    const wy = Math.sin(t * 0.23 + f.eyeT) * 0.22 + Math.sin(t * 0.61 + f.eyeT * 1.7) * 0.1;
    const wp = Math.sin(t * 0.19 + f.eyeT * 2.3) * 0.12;
    for (let k = 0; k < 2; k++) {
      const sg = k === 0 ? 1 : -1;
      const lx = EYE.p.x * sg * L, lz = (EYE.p.z) * L;
      // 眼の中心は砂の面より少し上（眼玉の上半分が出ている）
      const y = g + 0.0006 + L * 0.009;
      // 光を返す向き: 眼の向きより上寄り（眼は頭の上に出ていて、輝板は広く光を返す）
      let ax = EYE.axis.x * sg, ay = EYE.axis.y + 0.75 + wp, az = EYE.axis.z;
      const ca = Math.cos(wy * sg), sa = Math.sin(wy * sg);
      [ax, az] = [ax * ca + az * sa, -ax * sa + az * ca];
      const al = Math.hypot(ax, ay, az);
      const o = out[k];
      o.x = f.x + lx * c + lz * s; o.z = f.z - lx * s + lz * c; o.y = y;
      o.dx = (ax * c + az * s) / al; o.dy = ay / al; o.dz = (-ax * s + az * c) / al;
    }
    return out;
  }
  /** 頭（両眼のまん中）の位置: つかむ時の当たり */
  head(f) {
    const L = f.glintCm / 100;
    const lz = EYE.p.z * L * 0.8;
    return { x: f.x + lz * Math.sin(f.yaw), z: f.z + lz * Math.cos(f.yaw) };
  }

  /** 光る点を集める（x, z のまわり r）。shine に足す */
  gatherShine(shine, px, pz, r, groundAt, t, meshEyes) {
    const eyes = [{}, {}];
    for (const it of this.around(px, pz, r)) {
      if (!it.alive) continue;
      if (it.kind === 'fugu') {
        if (it.state !== 'bur') continue; // 泳いでいるフグは、模型の眼から（meshEyes）
        this.buriedEyes(it, groundAt, t, eyes);
        for (const e of eyes) shine.add(e.x, e.y, e.z, e.dx, e.dy, e.dz, 0, 1.6, it.seed, 1, EYE_COL);
      } else {
        const g = groundAt(it.x, it.z);
        shine.add(it.x, g + it.size * 0.12, it.z, it.n[0], it.n[1], it.n[2], 1, it.sharp, it.seed, it.str, it.col);
      }
    }
    if (meshEyes) for (const e of meshEyes) shine.add(e.x, e.y, e.z, e.dx, e.dy, e.dz, 0, 1.6, e.seed, 1, EYE_COL);
  }

  /** 手を突っ込んだ所 (x, z) で、つかめるフグ・光る物 */
  grabAt(x, z) {
    let fugu = null, fd = 0.075;
    let dec = null, dd = 0.05;
    for (const it of this.around(x, z, 0.2)) {
      if (!it.alive) continue;
      if (it.kind === 'fugu') {
        if (it.state !== 'bur') continue;
        const h = this.head(it);
        // 小さい子は当たりもせまい
        const d = Math.hypot(h.x - x, h.z - z) - it.glintCm / 100 * 0.15;
        if (d < fd) { fd = d; fugu = it; }
      } else {
        const d = Math.hypot(it.x - x, it.z - z) - it.size * 0.5;
        if (d < dd) { dd = d; dec = it; }
      }
    }
    return { fugu, decoy: dec };
  }

  /** 光っている物の上か（ねらいの輪の色）。眼でも石でも同じに光る */
  glintNear(x, z, r = 0.05) {
    for (const it of this.around(x, z, 0.15)) {
      if (!it.alive) continue;
      if (it.kind === 'fugu' && it.state === 'bur') { const h = this.head(it); if (Math.hypot(h.x - x, h.z - z) < r + 0.01) return true; }
      else if (it.kind === 'decoy' && Math.hypot(it.x - x, it.z - z) < r) return true;
    }
    return false;
  }

  /** 群れ場の中か（0..1） */
  spotK(x, z) {
    let k = 0;
    for (const s of this.spots) k = Math.max(k, smoothstep(s.r * 1.3, s.r * 0.5, Math.hypot(x - s.x, (z - s.z) / 0.8)));
    return clamp(k, 0, 1);
  }
  get remaining() { return this.fugu.filter((f) => f.alive).length; }
}
