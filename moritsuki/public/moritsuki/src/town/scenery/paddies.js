// 田んぼ: 大きな区画を、土地の形に合わせて並べる（ユーザーの区画案 2026-09-25: 大区画化・地形に沿った配置）
// ・田にできる土地を、道・川・家並み・森で区切られた「ひと続きの土地」に分ける（細いくびれでも分ける）
// ・長すぎる・広すぎる土地は、いちばん細い所で横に切る。切り口・区画の間は農道
// ・土地ごとに、まわりの道・川・切り口の向きに区画の格子をそろえ、奥行き 60〜90m・幅 100〜150m ほどの区画に割る
// ・区画の端は四角で打ち切らず、道・川・家並み・森のきわの線にそって切る（斜めの道なら台形、曲がった川なら曲がった辺）
// ・細い余り地は草地のまま（区画にしない）
// ・区画の面は地面なりに少しだけ傾けた平面 ＋ まわりのあぜ（少し高い縁）＋ 段差の土手。坂では棚田のように段になる
// ・種類: 青田（ほとんど。少し黄みの田も）/ 水の見える若い田 / ひまわり畑 / レンゲ畑 / 野菜畑 / 草地
import * as THREE from 'three';
import { M, roadW } from '../layout.js';
import { rng, polylineDist, segDist } from '../data.js';
import { forestness } from './landscape.js';
import { paint } from '../materials.js';

export const PADDY = { RICE: 0, WET: 1, SUNFLOWER: 2, RENGE: 3, VEG: 4, MEADOW: 5 };
const CELL = 2.5;           // 田にできるかの地図の細かさ
const REACH = 1750;         // 中心からこの距離まで作る
const RIM = 0.6, RIM_H = 0.14; // あぜの幅・高さ
const GAP = 0.25;           // 区画の外へはみ出す土手の幅（となりの区画のあぜと触れる）
const MARGIN = 1.4;         // 道・川・家・森のきわから区画までの間
const ROAD_W = 3.6;         // 農道の幅
const INSET = ROAD_W / 2 + 0.8; // 農道の中心線から区画まで
const MAX_STEP = 1.5;       // 区画の面（少し傾けてよい）と地面の高さの差の幅の上限（超えたら割る）
const TILT = 0.06;          // 区画の面の傾きの上限（大きな区画は地形なりに少し傾ける。歩ける谷の平地はほぼ水平）
const PLAN_TILT = 0.1;       // 区画案の区画の面の傾きの上限（案の区画は割らずにそのまま使うので大きめ）
// 区画案に従うとき、田にしない所（森は田にしてよい）。道・川・水面・土手は格子でなく地図の線から測る（layPlan の obs）
const HARD = M.BLD | M.RAIL | M.LOT | M.PAVE | M.HARBOR | M.KEEP | M.BEACH | M.AREA | (M.LAWN || 0) | M.FARMSTEAD | M.TOWN;
// 区画案の区画を、道・川のきわまで寄せる: 実際の田は道・川とほとんどすき間なく接している
const EXT = 5, EXT_NEAR = 22, EXT_FILL = 35; // 案の区画から広げてよい幅: 森の中へは EXT（道・川の 25m 以内は EXT_NEAR）まで、森でない空き地は EXT_FILL まで埋める（空き地を残さない）
const GAP_ROAD = 0.5;       // 道のふちから田のあぜまで
const BANK_RIVER = 4.2, BANK_STREAM = 3.6; // 川・小川の中心線から田まで（掘った水路の岸 + 1m ほど）
const BANK_POND = 1.5;      // 池・水面のふちから
const HALF_BETWEEN = ROAD_W / 2 + 0.15; // となりの区画との境目（農道）の半分。あぜが農道のふちに接する
const HALF_AZE = 0.3;       // 農道のない境目の半分（となりの区画とあぜどうしが接する）
const NECK = 5;             // 土地を分けるくびれ（きわからの距離 m。幅ならこの倍）
const LMAX = 340, AMAX = 70000; // 1 つの土地の長さ（m）・広さ（m²）の上限。超えたら切る
const MIN_BLOCK = 1500;     // これより小さい土地は草地のまま
const DEPTH = [60, 90], WIDTH = [100, 150]; // 区画の奥行き・幅のめやす

// 種類の割合（夏: 青田が大半、ひまわり・レンゲで少し彩り）
function pickType(r) {
  const v = r();
  if (v < 0.86) return PADDY.RICE;
  if (v < 0.89) return PADDY.WET;
  if (v < 0.93) return PADDY.SUNFLOWER;
  if (v < 0.95) return PADDY.RENGE;
  if (v < 0.98) return PADDY.VEG;
  return PADDY.MEADOW;
}

// plan: 区画案から読み取った区画・農道（src/town/data/paddy-plan.json）。あればそれに従い、なければ自動で並べる
// fixed: 手で決めた区画（scenery/frontage.js。区画と同じ形 { W, sx, sz, ux, uz, vx, vz, ring, y, gu, gv, ymin, type, hue }）
export function buildPaddies(ctx, T, reserved = [], lotFields = [], plan = null, fixed = []) {
  const { data, mask, ground } = ctx;
  const { core, outer, V } = data;
  const t0 = performance.now();
  // ---------- 田にできる所の地図 ----------
  const X0 = -REACH, Z0 = -REACH, N = Math.ceil((2 * REACH) / CELL);
  const field = new Uint8Array(N * N);
  const BAD = M.ROAD | M.WATER | M.BLD | M.RAIL | M.LOT | M.PAVE | M.HARBOR | M.KEEP | M.TOWN | M.BEACH | M.AREA | (M.LAWN || 0) | M.WOOD | M.LEVEE | M.FARMSTEAD;
  const idxAt = (x, z) => Math.round((z - core.z0) / core.step) * core.nx + Math.round((x - core.x0) / core.step);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const x = X0 + (i + 0.5) * CELL, z = Z0 + (j + 0.5) * CELL;
    if (x * x + z * z > REACH * REACH) continue;
    let ok;
    if (core.inside(x, z, 4)) {
      const m = mask.get(x, z), c = idxAt(x, z), k = T.kinds[c];
      // 区画案に従うときは、道・川・家などに重ならなければどこでも（森の所も田にする）
      if (plan) ok = !(m & HARD) && core.h[c] > 0.3 && k !== 'sea';
      // 町並みの中でも、家・道から離れた草地は田にする（田んぼが家並みのきわまで来るように）
      else ok = m & BAD ? (m & BAD) === M.TOWN && k === 'grass' && core.h[c] > 1.2 : k === 'paddy';
    }
    else if (outer.inside(x, z, 20)) {
      const h = outer.at(x, z);
      if (plan) { if (h > 0.5) field[j * N + i] = 1; continue; }
      const s = Math.hypot(outer.at(x + 8, z) - outer.at(x - 8, z), outer.at(x, z + 8) - outer.at(x, z - 8)) / 16;
      ok = h > 0.5 && forestness(h, s) < 0.5; // 森のきわまで（木は 0.55 から）
    } else ok = false;
    if (ok) field[j * N + i] = 1;
  }
  // 中心部の外は地図の格子（mask）がないので、道・川・水面を地図のデータから直接ぬく
  const clearDisk = (x, z, rad) => {
    const i0 = Math.floor((x - rad - X0) / CELL), i1 = Math.floor((x + rad - X0) / CELL);
    const j0 = Math.floor((z - rad - Z0) / CELL), j1 = Math.floor((z + rad - Z0) / CELL);
    for (let j = Math.max(0, j0); j <= Math.min(N - 1, j1); j++) for (let i = Math.max(0, i0); i <= Math.min(N - 1, i1); i++) {
      const cx = X0 + (i + 0.5) * CELL - x, cz = Z0 + (j + 0.5) * CELL - z;
      if (cx * cx + cz * cz <= rad * rad) field[j * N + i] = 0;
    }
  };
  const clearLine = (p, w) => {
    for (let k = 0; k + 1 < p.length; k++) {
      const [ax, az] = p[k], [bx, bz] = p[k + 1], n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 1.5));
      for (let t = 0; t <= n; t++) { const x = ax + ((bx - ax) * t) / n, z = az + ((bz - az) * t) / n; if (!core.inside(x, z, 4)) clearDisk(x, z, w / 2 + CELL * 0.5); }
    }
  };
  if (!plan) for (const rd of V.roads) clearLine(rd.p, roadW(rd.k) + 0.3);
  if (!plan) for (const st of V.streams) clearLine(st.p, st.k === 'river' ? 8 : 3);
  if (!plan) for (const w of V.water) {
    const xs = w.p.map((q) => q[0]), zs = w.p.map((q) => q[1]);
    const i0 = Math.max(0, Math.floor((Math.min(...xs) - X0) / CELL)), i1 = Math.min(N - 1, Math.ceil((Math.max(...xs) - X0) / CELL));
    const j0 = Math.max(0, Math.floor((Math.min(...zs) - Z0) / CELL)), j1 = Math.min(N - 1, Math.ceil((Math.max(...zs) - Z0) / CELL));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const x = X0 + (i + 0.5) * CELL, z = Z0 + (j + 0.5) * CELL;
      if (!core.inside(x, z, 4) && inRing(w.p, x, z)) field[j * N + i] = 0;
    }
  }
  // 農家の敷地（中心部の外の分はここで抜く）
  for (const [cx, cz, rad] of reserved) {
    for (let dz = -rad; dz <= rad; dz += CELL) for (let dx = -rad; dx <= rad; dx += CELL) {
      if (dx * dx + dz * dz > rad * rad) continue;
      const i = Math.floor((cx + dx - X0) / CELL), j = Math.floor((cz + dz - Z0) / CELL);
      if (i >= 0 && j >= 0 && i < N && j < N) field[j * N + i] = 0;
    }
  }
  // 田にできる所のきわからの距離（m、中が正・外が負）。なめらかな境目の線を引くのに使う
  const tA = performance.now();
  const sdf = signedDistance(field, N, CELL);
  const sdfAt = (x, z) => {
    const fx = (x - X0) / CELL - 0.5, fz = (z - Z0) / CELL - 0.5;
    const i = Math.floor(fx), j = Math.floor(fz);
    if (i < 0 || j < 0 || i >= N - 1 || j >= N - 1) return -99;
    const a = fx - i, b = fz - j, c = j * N + i;
    return (sdf[c] * (1 - a) + sdf[c + 1] * a) * (1 - b) + (sdf[c + N] * (1 - a) + sdf[c + N + 1] * a) * b;
  };

  const tB = performance.now();
  // ---------- ひと続きの田の土地（道・川・家並み・森で区切られた所）----------
  // 細いくびれ（NECK m 以下）では別の土地に分け、くびれ・ふちの細い所はあとで近い方へつける
  const label = new Int32Array(N * N).fill(-1);
  const queue = new Int32Array(N * N);
  const comps = [];
  if (!plan) for (let c0 = 0; c0 < N * N; c0++) {
    if (label[c0] !== -1 || sdf[c0] <= NECK) continue;
    const id = comps.length, list = [];
    let sp = 0;
    queue[sp++] = c0; label[c0] = id;
    while (sp) {
      const c = queue[--sp], i = c % N;
      list.push(c);
      for (const q of [i > 0 ? c - 1 : -1, i < N - 1 ? c + 1 : -1, c - N, c + N]) {
        if (q < 0 || q >= N * N || label[q] !== -1 || sdf[q] <= NECK) continue;
        label[q] = id; queue[sp++] = q;
      }
    }
    comps.push(list);
  }
  if (!plan) {
    let head = 0, tail = 0;
    for (let c = 0; c < N * N; c++) if (label[c] !== -1) queue[tail++] = c;
    while (head < tail) {
      const c = queue[head++], i = c % N;
      for (const q of [i > 0 ? c - 1 : -1, i < N - 1 ? c + 1 : -1, c - N, c + N]) {
        if (q < 0 || q >= N * N || label[q] !== -1 || sdf[q] <= 0) continue;
        label[q] = label[c]; comps[label[c]].push(q); queue[tail++] = q;
      }
    }
  }
  const cellX = (c) => X0 + ((c % N) + 0.5) * CELL, cellZ = (c) => Z0 + (Math.floor(c / N) + 0.5) * CELL;
  const cellAt = (x, z) => {
    const i = Math.floor((x - X0) / CELL), j = Math.floor((z - Z0) / CELL);
    return i < 0 || j < 0 || i >= N || j >= N ? -1 : j * N + i;
  };
  // 重心と長い方向（主成分）
  const pca = (cells) => {
    let mx = 0, mz = 0;
    for (const c of cells) { mx += cellX(c); mz += cellZ(c); }
    mx /= cells.length; mz /= cells.length;
    let sxx = 0, szz = 0, sxz = 0;
    for (const c of cells) { const a = cellX(c) - mx, b = cellZ(c) - mz; sxx += a * a; szz += b * b; sxz += a * b; }
    return { mx, mz, ang: 0.5 * Math.atan2(2 * sxz, sxx - szz) };
  };
  // cells のうち、つながっている塊ごとに分ける
  const inSet = new Int32Array(N * N), seen = new Int32Array(N * N);
  let stamp = 0;
  const connected = (cells) => {
    const st = ++stamp;
    for (const c of cells) inSet[c] = st;
    const parts = [];
    for (const c0 of cells) {
      if (seen[c0] === st) continue;
      const part = [];
      let sp = 0;
      queue[sp++] = c0; seen[c0] = st;
      while (sp) {
        const c = queue[--sp], i = c % N;
        part.push(c);
        for (const q of [i > 0 ? c - 1 : -1, i < N - 1 ? c + 1 : -1, c - N, c + N]) {
          if (q < 0 || q >= N * N || inSet[q] !== st || seen[q] === st) continue;
          seen[q] = st; queue[sp++] = q;
        }
      }
      parts.push(part);
    }
    return parts;
  };
  const inHalf = (hps, x, z, inset) => hps.every((h) => x * h.nx + z * h.nz < h.c - inset);

  const parcels = [], roads = [];
  const drop = { block: 0, small: 0, thin: 0, steep: 0 }; // 区画にしなかった面積（m²、確かめ用）
  const r = rng(90210);
  const R = (lo, hi) => lo + r() * (hi - lo);

  // ---------- 長すぎる・広すぎる土地は、いちばん細い所で横に切る（切り口は農道）----------
  const blockId = new Int32Array(N * N).fill(-1);
  const blocks = [];
  const divide = (cells, comp, hps, depth) => {
    const n = cells.length, area = n * CELL * CELL;
    if (area < MIN_BLOCK) { drop.block += area; return; }
    const { mx, mz, ang } = pca(cells);
    const ax = Math.cos(ang), az = Math.sin(ang);
    const proj = new Float32Array(n);
    for (let k = 0; k < n; k++) proj[k] = (cellX(cells[k]) - mx) * ax + (cellZ(cells[k]) - mz) * az;
    const sorted = proj.slice().sort();
    const L = sorted[n - 1] - sorted[0];
    if ((L > LMAX || area > AMAX) && depth < 14) {
      let t = 0, best = Infinity;
      for (let q = 0; q <= 12; q++) {
        const tq = sorted[Math.floor((n - 1) * (0.33 + (0.34 * q) / 12))];
        let cnt = 0;
        for (let k = 0; k < n; k++) if (Math.abs(proj[k] - tq) < CELL * 0.75) cnt++;
        const score = cnt * (1 + (0.25 * Math.abs(q - 6)) / 6); // なるべく真ん中で
        if (score < best) { best = score; t = tq; }
      }
      const c = mx * ax + mz * az + t;
      const hA = { nx: ax, nz: az, c }, hB = { nx: -ax, nz: -az, c: -c };
      // 切り口の農道: この土地の中（ほかの土地へ入らない）で、田のきわを少し越えるまで
      const px = mx + ax * t, pz = mz + az * t, dx = -az, dz = ax;
      let lo = Infinity, hi = -Infinity;
      for (let k = 0; k < n; k++) if (Math.abs(proj[k] - t) < CELL * 2) {
        const w = (cellX(cells[k]) - px) * dx + (cellZ(cells[k]) - pz) * dz;
        lo = Math.min(lo, w); hi = Math.max(hi, w);
      }
      const onRoad = (w) => {
        const x = px + dx * w, z = pz + dz * w, q = cellAt(x, z);
        if (q < 0 || !inHalf(hps, x, z, 0)) return -1;
        return label[q] === comp || label[q] === -1 ? sdfAt(x, z) + 0.5 : -1;
      };
      for (const [a, b] of runs(lo - 8, hi + 8, onRoad, 1.5, [])) if (b - a > 15) roads.push([[px + dx * a, pz + dz * a], [px + dx * b, pz + dz * b]]);
      const A = [], B = [];
      for (let k = 0; k < n; k++) (proj[k] < t ? A : B).push(cells[k]);
      for (const [side, h] of [[A, hA], [B, hB]]) for (const part of connected(side)) divide(part, comp, [...hps, h], depth + 1);
      return;
    }
    const id = blocks.length;
    blocks.push({ cells, hps, id });
    for (const c of cells) blockId[c] = id;
  };
  if (plan) layPlan();
  else {
    comps.forEach((cells, comp) => divide(cells, comp, [], 0));
    // ---------- 土地ごとに、まわりの道・川の向きにそろえて大きな区画を並べる ----------
    for (const b of blocks) layoutBlock(b);
  }

  // ---------- 区画案のとおりに並べる ----------
  // 案の区画は道の中心線まで広げてあるので、INSET だけ内へ寄せ、道・川・家などからは MARGIN 離す。
  // 中に家などの穴ができたら、穴の所で 2 つに割る
  function layPlan() {
    const first = parcels.length;
    const HUE = { y: [0.83, 0.97], l: [0.62, 0.77], g: [0.2, 0.55] };
    // ---------- 道・川・水面までの距離（地図の線から正確に。格子で測るとすき間がばらつくので）----------
    // 値: 田を置いてよい所までの余裕（m）。30 で打ち切り
    const SC = 16, cells = new Map();
    const key = (i, j) => i * 100003 + j;
    const addSeg = (ax, az, bx, bz, r, w = -1) => {
      const e = r + 30;
      const i0 = Math.floor((Math.min(ax, bx) - e) / SC), i1 = Math.floor((Math.max(ax, bx) + e) / SC);
      const j0 = Math.floor((Math.min(az, bz) - e) / SC), j1 = Math.floor((Math.max(az, bz) + e) / SC);
      for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
        const k = key(i, j);
        if (!cells.has(k)) cells.set(k, []);
        cells.get(k).push([ax, az, bx, bz, r, w]);
      }
    };
    const addLine = (p, r) => { for (let k = 0; k + 1 < p.length; k++) addSeg(p[k][0], p[k][1], p[k + 1][0], p[k + 1][1], r); };
    for (const rd of V.roads) addLine(rd.p, roadW(rd.k) / 2 + GAP_ROAD);
    for (const st of V.streams) addLine(st.p, st.k === 'river' ? BANK_RIVER : BANK_STREAM);
    // 池・水面の多角形: 辺を同じ索引に入れ（w = 番号）、近くの辺があるときだけ中か外かを調べる
    V.water.forEach((w, i) => { for (let k = 0; k < w.p.length; k++) { const a = w.p[k], b = w.p[(k + 1) % w.p.length]; addSeg(a[0], a[1], b[0], b[1], 0, i); } });
    const wd = new Float64Array(V.water.length);
    const obs = (x, z) => {
      let d = 30;
      wd.fill(Infinity);
      const l = cells.get(key(Math.floor(x / SC), Math.floor(z / SC)));
      if (l) for (const s of l) {
        const e = segDist(x, z, s[0], s[1], s[2], s[3]);
        if (s[5] >= 0) { if (e < wd[s[5]]) wd[s[5]] = e; continue; }
        if (e - s[4] < d) d = e - s[4];
      }
      for (let i = 0; i < wd.length; i++) if (wd[i] < 30) d = Math.min(d, inRing(V.water[i].p, x, z) ? -wd[i] : wd[i] - BANK_POND);
      // 川の土手（river.js が盛った所。1m 格子）
      if (mask.get(x, z) & M.LEVEE) d = Math.min(d, -0.5);
      return d;
    };

    // ---------- 森（木を植える所）までの符号つき距離（中が正）: 田を空き地いっぱいに広げても森には食いこませない ----------
    const tree = new Uint8Array(N * N);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const x = X0 + (i + 0.5) * CELL, z = Z0 + (j + 0.5) * CELL;
      if (core.inside(x, z, 4)) tree[j * N + i] = T.kinds[idxAt(x, z)] === 'forest' ? 1 : 0;
      else if (outer.inside(x, z, 20)) {
        const h = outer.at(x, z), sl = Math.hypot(outer.at(x + 8, z) - outer.at(x - 8, z), outer.at(x, z + 8) - outer.at(x, z - 8)) / 16;
        tree[j * N + i] = forestness(h, sl) > 0.55 ? 1 : 0;
      }
    }
    const tsd = signedDistance(tree, N, CELL);
    const treeAt = (x, z) => {
      const fx = (x - X0) / CELL - 0.5, fz = (z - Z0) / CELL - 0.5, i = Math.floor(fx), j = Math.floor(fz);
      if (i < 0 || j < 0 || i >= N - 1 || j >= N - 1) return 60;
      const a = fx - i, b = fz - j, c = j * N + i;
      return (tsd[c] * (1 - a) + tsd[c + 1] * a) * (1 - b) + (tsd[c + N] * (1 - a) + tsd[c + N + 1] * a) * b;
    };

    // ---------- 区画案の農道（区画の間のクリーム色の線）: 近くの境目だけ農道の幅を空ける ----------
    const rcells = new Map();
    for (const line of plan.roads) for (let k = 0; k + 3 < line.length; k += 2) {
      const ax = line[k], az = line[k + 1], bx = line[k + 2], bz = line[k + 3];
      const i0 = Math.floor((Math.min(ax, bx) - 12) / SC), i1 = Math.floor((Math.max(ax, bx) + 12) / SC);
      const j0 = Math.floor((Math.min(az, bz) - 12) / SC), j1 = Math.floor((Math.max(az, bz) + 12) / SC);
      for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { const q = key(i, j); if (!rcells.has(q)) rcells.set(q, []); rcells.get(q).push([ax, az, bx, bz]); }
    }
    const planRoadD = (x, z) => {
      let d = 12;
      const l = rcells.get(key(Math.floor(x / SC), Math.floor(z / SC)));
      if (l) for (const q of l) d = Math.min(d, segDist(x, z, q[0], q[1], q[2], q[3]));
      return d;
    };
    const halfAt = (x, z) => HALF_AZE + (HALF_BETWEEN - HALF_AZE) * Math.min(1, Math.max(0, (6.5 - planRoadD(x, z)) / 1.5));

    // ---------- 区画案の区画（世界座標の多角形）と、そのとなり ----------
    const P2 = plan.parcels.map((P) => {
      const pts = [];
      for (let k = 0; k < P.p.length; k += 2) pts.push([P.p[k], P.p[k + 1]]);
      const xs = pts.map((q) => q[0]), zs = pts.map((q) => q[1]);
      return { t: P.t, pts, ring: [...pts, pts[0]], bb: [Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs)] };
    });
    // 符号つき距離（中が正）
    const sd = (Q, x, z) => { const e = polylineDist(x, z, Q.ring); return inRing(Q.pts, x, z) ? e : -e; };
    const R2 = EXT_FILL + 8;
    for (const Q of P2) Q.nb = P2.filter((O) => O !== Q && O.bb[0] < Q.bb[2] + 2 * R2 && O.bb[2] > Q.bb[0] - 2 * R2 && O.bb[1] < Q.bb[3] + 2 * R2 && O.bb[3] > Q.bb[1] - 2 * R2);

    for (const Q of P2) {
      const { pts } = Q;
      // 向き: いちばん長い辺にそろえる（区画の辺がまっすぐ出るように）
      let ang = 0, best = 0, mx = 0, mz = 0;
      for (let k = 0; k < pts.length; k++) {
        const a = pts[k], b = pts[(k + 1) % pts.length], l = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (l > best) { best = l; ang = Math.atan2(b[1] - a[1], b[0] - a[0]); }
        mx += a[0] / pts.length; mz += a[1] / pts.length;
      }
      const ux = Math.cos(ang), uz = Math.sin(ang), vx = -uz, vz = ux;
      const W = (u, v) => [mx + ux * u + vx * v, mz + uz * u + vz * v];
      const frame = { sx: mx, sz: mz, ux, uz, vx, vz, W };
      const loc = pts.map(([x, z]) => [(x - mx) * ux + (z - mz) * uz, (x - mx) * vx + (z - mz) * vz]);
      const us = loc.map((p) => p[0]), vs = loc.map((p) => p[1]);
      const [h0, h1] = HUE[Q.t] || HUE.g;
      // 案の区画の中の点（重心へ 4 割寄せた頂点）: できた輪がこれを含めば案の区画の分
      const cu = us.reduce((a, b) => a + b, 0) / us.length, cv = vs.reduce((a, b) => a + b, 0) / vs.length;
      const inner = [[cu, cv], ...loc.map(([a, b]) => [a + (cu - a) * 0.4, b + (cv - b) * 0.4])];
      // 田にする所: 案の区画から EXT m まで広げ、となりの区画とは真ん中で分け（間は農道）、道・川・水面・家などの手前まで
      const land = (u, v, u0, u1, v0, v1) => {
        const box = Math.min(u - u0, u1 - u, v - v0, v1 - v);
        if (box < -1) return box;
        const [x, z] = W(u, v);
        // 案の区画の外わく（四角）から遠い所は測るまでもなく外
        const ox = Math.max(Q.bb[0] - x, 0, x - Q.bb[2]), oz = Math.max(Q.bb[1] - z, 0, z - Q.bb[3]);
        if (ox > EXT_FILL + 2 || oz > EXT_FILL + 2) return EXT_FILL - Math.hypot(ox, oz);
        const self = sd(Q, x, z);
        if (self < -EXT_FILL - 2) return self + EXT_FILL;
        const o = obs(x, z);
        if (o < -2) return o;
        const ext = EXT + (EXT_NEAR - EXT) * Math.min(1, Math.max(0, (25 - o) / 10));
        let other = -Infinity, half = HALF_BETWEEN;
        // 案の区画の奥（きわから HALF_BETWEEN + 3 m より中）は、となりの区画が重ならないので調べなくてよい
        if (self < HALF_BETWEEN + 3) {
          for (const O of Q.nb) {
            if (x < O.bb[0] - R2 || x > O.bb[2] + R2 || z < O.bb[1] - R2 || z > O.bb[3] + R2) continue;
            other = Math.max(other, sd(O, x, z));
          }
          // 境目に案の農道があれば農道の幅、なければあぜだけ
          if (other > -2 * HALF_BETWEEN - 4) half = halfAt(x, z);
        }
        // 森でない所は大きく、森の中は少しだけ広げる
        const grow = Math.min(self + EXT_FILL, Math.max(self + ext, -treeAt(x, z) - 0.5));
        return Math.min(box, grow, (self - other) / 2 - half, o, sdfAt(x, z) - MARGIN, REACH - 8 - Math.hypot(x, z));
      };
      const trace = (u0, u1, v0, v1, depth) => {
        const loops = contour(u0, u1, v0, v1, (u, v) => land(u, v, u0, u1, v0, v1), 1.5, true);
        // 穴（家・農家の庭など）があれば、いちばん大きい穴の所で長い方向に割る
        const holes = loops.filter((l) => ringArea(l) < -30);
        if (holes.length && depth < 4) {
          const h = holes.reduce((a, l) => (ringArea(l) < ringArea(a) ? l : a));
          const cu = h.reduce((a, p) => a + p[0], 0) / h.length, cv = h.reduce((a, p) => a + p[1], 0) / h.length;
          // 割れ目は農道（両側を農道の幅の半分ずつ空ける）
          const H = HALF_BETWEEN, far = 1e6;
          const open = (u, v) => land(u, v, -far, far, -far, far) > 0;
          if (u1 - u0 >= v1 - v0) {
            trace(u0, cu - H, v0, v1, depth + 1); trace(cu + H, u1, v0, v1, depth + 1);
            for (const [a, b] of runs(v0, v1, (v) => (open(cu - H - 0.3, v) || open(cu + H + 0.3, v) ? 1 : -1), 1.2, [])) if (b - a > 2) roads.push([W(cu, a - 1), W(cu, b + 1)]);
          } else {
            trace(u0, u1, v0, cv - H, depth + 1); trace(u0, u1, cv + H, v1, depth + 1);
            for (const [a, b] of runs(u0, u1, (u) => (open(u, cv - H - 0.3) || open(u, cv + H + 0.3) ? 1 : -1), 1.2, [])) if (b - a > 2) roads.push([W(a - 1, cv), W(b + 1, cv)]);
          }
          return;
        }
        for (const raw of loops) {
          if (ringArea(raw) <= 0) continue;
          // 案の区画とつながっていない切れはし（道・川の向こう側まで伸びた所）は捨てる
          if (!inner.some(([a, b]) => inRing(raw, a, b)) && !raw.some(([a, b]) => sd(Q, ...W(a, b)) > 1)) continue;
          const ring = simplifyRing(raw, 0.35);
          const area = ringArea(ring);
          if (area < 300) { drop.small += area; continue; }
          let per = 0;
          for (let k = 0; k < ring.length; k++) { const a = ring[k], b = ring[(k + 1) % ring.length]; per += Math.hypot(b[0] - a[0], b[1] - a[1]); }
          if (area / per < 3.5) { drop.thin += area; continue; }
          const pl = fitPlane(ring, W, ground, PLAN_TILT);
          parcels.push({ ...frame, ring, y: pl.y, gu: pl.gu, gv: pl.gv, ymin: pl.hmin, type: PADDY.RICE, hue: R(h0, h1) });
        }
      };
      const E = EXT_FILL + 2;
      trace(Math.min(...us) - E, Math.max(...us) + E, Math.min(...vs) - E, Math.max(...vs) + E, 0);
    }
    // 農道: となりあう区画の境目のうち、案で農道が描かれている所に通す（区画のあぜのすぐ外、境目の真ん中）。同じ境目を二度作らないよう番号の小さい方から
    const mine = parcels.slice(first);
    const wr = mine.map((pc) => {
      const pts = pc.ring.map(([a, b]) => pc.W(a, b));
      const xs = pts.map((q) => q[0]), zs = pts.map((q) => q[1]);
      return { pts, closed: [...pts, pts[0]], bb: [Math.min(...xs) - 6, Math.min(...zs) - 6, Math.max(...xs) + 6, Math.max(...zs) + 6] };
    });
    const REACHB = HALF_BETWEEN + 1.2;
    wr.forEach((A, i) => {
      const nb = [];
      wr.forEach((B, j) => { if (j !== i && B.bb[0] < A.bb[2] && B.bb[2] > A.bb[0] && B.bb[1] < A.bb[3] && B.bb[3] > A.bb[1]) nb.push(j); });
      if (!nb.length) return;
      const n = A.pts.length;
      for (let k = 0; k < n; k++) {
        const [ax, az] = A.pts[k], [bx, bz] = A.pts[(k + 1) % n], L = Math.hypot(bx - ax, bz - az);
        if (L < 0.5) continue;
        const tx = (bx - ax) / L, tz = (bz - az) / L, ox = tz * HALF_BETWEEN, oz = -tx * HALF_BETWEEN; // 外向き（輪は反時計回り）
        const P = (t) => [ax + tx * t + ox, az + tz * t + oz];
        const g = (t) => {
          const [x, z] = P(t);
          let best = Infinity, who = -1;
          for (const j of nb) { const d = polylineDist(x, z, wr[j].closed); if (d < best) { best = d; who = j; } }
          return best < REACHB && who > i && planRoadD(x, z) < 6 ? 1 : -1;
        };
        for (const [a, b] of runs(-1, L + 1, g, 1.2, [])) if (b - a > 1.5) roads.push([P(a - 1.5), P(b + 1.5)]);
      }
    });
  }

  function layoutBlock({ cells, hps, id }) {
    const { mx, mz, ang: major } = pca(cells);
    // きわ（道・川・森）の向き: きわの法線を 4 倍角で平均（直角どうしも同じ向きとして数える）
    let S = 0, C = 0, wsum = 0;
    for (const c of cells) {
      const s = sdf[c];
      if (s < MARGIN || s > MARGIN + 8) continue;
      const gx = sdf[c + 1] - sdf[c - 1], gz = sdf[c + N] - sdf[c - N];
      if (Math.hypot(gx, gz) < 1) continue;
      const f = Math.atan2(gz, gx);
      C += Math.cos(4 * f); S += Math.sin(4 * f); wsum++;
    }
    for (const h of hps) {
      let w = 0;
      for (const c of cells) { const d = h.c - (cellX(c) * h.nx + cellZ(c) * h.nz); if (d > 0 && d < INSET + 8) w++; }
      const f = Math.atan2(h.nz, h.nx);
      C += Math.cos(4 * f) * w; S += Math.sin(4 * f) * w; wsum += w;
    }
    let ang = major;
    if (wsum > 20 && Math.hypot(S, C) / wsum > 0.2) {
      const g = Math.atan2(S, C) / 4;
      // 長い辺（行の向き）は土地の長い方向に近い方
      ang = Math.abs(Math.sin(g - major)) < Math.abs(Math.cos(g - major)) ? g : g + Math.PI / 2;
    }
    const ux = Math.cos(ang), uz = Math.sin(ang), vx = -uz, vz = ux;
    const W = (u, v) => [mx + ux * u + vx * v, mz + uz * u + vz * v];
    const frame = { sx: mx, sz: mz, ux, uz, vx, vz, W };
    let umin = Infinity, umax = -Infinity, vmin = Infinity, vmax = -Infinity;
    for (const c of cells) {
      const x = cellX(c) - mx, z = cellZ(c) - mz, u = x * ux + z * uz, v = x * vx + z * vz;
      umin = Math.min(umin, u); umax = Math.max(umax, u); vmin = Math.min(vmin, v); vmax = Math.max(vmax, v);
    }
    // この土地の中で、きわから MARGIN 以上・切り口の農道から INSET 以上離れているか
    const region = (x, z) => {
      const q = cellAt(x, z);
      if (q < 0 || blockId[q] !== id || !inHalf(hps, x, z, INSET)) return -1;
      return sdfAt(x, z) - MARGIN;
    };
    const extent = (v) => {
      const iv = runs(umin - 4, umax + 4, (u) => region(...W(u, v)), 1.5, []);
      return iv.length ? [iv[0][0], iv[iv.length - 1][1]] : null;
    };

    // 農道: この土地の中（となりの土地・切り口の向こうへは出ない）で、田のきわを少し越えるまで
    const roadOk = (x, z) => {
      const q = cellAt(x, z);
      if (q < 0 || !inHalf(hps, x, z, 0) || (blockId[q] !== id && blockId[q] !== -1)) return -1;
      return sdfAt(x, z) + 0.5;
    };
    const addRoad = (a0, a1, P) => { for (const [a, b] of runs(a0, a1, (t) => roadOk(...P(t)), 1.5, [])) if (b - a > 12) roads.push([P(a), P(b)]); };

    // 行（v 方向に並ぶ帯）: 土地の幅を同じ奥行きで割る。帯の境目は農道
    const span = vmax - vmin;
    const rows = Math.max(1, Math.round(span / R(...DEPTH)));
    for (let k = 0; k < rows; k++) layRow(vmin + (span * k) / rows, vmin + (span * (k + 1)) / rows, 0, k > 0, k < rows - 1);
    for (let k = 1; k < rows; k++) { const v = vmin + (span * k) / rows; addRoad(umin - 10, umax + 10, (u) => W(u, v)); }

    // 帯 [v0, v1] を同じくらいの幅の区画に割る。坂を横切る帯は 2 つに割る（棚田）
    // lo / hi: 帯の下・上の境目が農道か
    function layRow(v0, v1, depth, lo, hi) {
      if (v1 - v0 > 16 && depth < 3) {
        let worst = 0;
        for (let u = umin; u < umax; u += 12) {
          if (region(...W(u, (v0 + v1) / 2)) < 0) continue;
          worst = Math.max(worst, Math.abs(ground(...W(u, v1)) - ground(...W(u, v0))));
        }
        if (worst > MAX_STEP * 0.8 + TILT * (v1 - v0)) {
          const m = (v0 + v1) / 2;
          layRow(v0, m, depth + 1, lo, false); layRow(m, v1, depth + 1, false, hi);
          return;
        }
      }
      // 帯の中の田の端から端まで
      let ua = Infinity, ub = -Infinity;
      for (let k = 0; k <= 6; k++) {
        const e = extent(v0 + ((v1 - v0) * (k + 0.5)) / 7);
        if (e) { ua = Math.min(ua, e[0]); ub = Math.max(ub, e[1]); }
      }
      if (!(ub > ua)) return;
      const cols = Math.max(1, Math.round((ub - ua) / R(...WIDTH)));
      const cs = [ua - 2];
      for (let k = 1; k < cols; k++) cs.push(ua + ((ub - ua) * (k + (r() - 0.5) * 0.1)) / cols);
      cs.push(ub + 2);
      // 区画の間の切れ目も農道（となりの帯の切れ目とはずらす）
      const a = v0 + (lo ? INSET : 0), b = v1 - (hi ? INSET : 0);
      for (let k = 0; k < cols; k++) addRect(cs[k] + (k > 0 ? INSET : 0), cs[k + 1] - (k < cols - 1 ? INSET : 0), a, b, 0);
      for (let k = 1; k < cols; k++) { const c = cs[k]; addRoad(v0, v1, (v) => W(c, v)); }
    }

    // 四角 [u0, u1] × [v0, v1] のうち田にできる所を、きわの線にそってなぞって区画にする
    function addRect(u0, u1, v0, v1, depth) {
      const canSplit = depth < 3 && Math.max(u1 - u0, v1 - v0) >= 40;
      const split = () => {
        if (u1 - u0 >= v1 - v0) { const m = (u0 + u1) / 2; addRect(u0, m, v0, v1, depth + 1); addRect(m, u1, v0, v1, depth + 1); }
        else { const m = (v0 + v1) / 2; addRect(u0, u1, v0, m, depth + 1); addRect(u0, u1, m, v1, depth + 1); }
      };
      const loops = contour(u0, u1, v0, v1, (u, v) => Math.min(region(...W(u, v)), u - u0, u1 - u, v - v0, v1 - v));
      // 中に家・農家の庭などの穴があれば割る
      const holes = loops.filter((l) => ringArea(l) < 0).reduce((a, l) => a - ringArea(l), 0);
      if (holes > 40 && canSplit) return split();
      const keep = [];
      for (const raw of loops) {
        if (ringArea(raw) <= 0) continue;
        const ring = simplifyRing(raw, 0.45);
        const area = ringArea(ring);
        if (area < 900) { drop.small += area; continue; }
        let per = 0;
        for (let k = 0; k < ring.length; k++) { const a = ring[k], b = ring[(k + 1) % ring.length]; per += Math.hypot(b[0] - a[0], b[1] - a[1]); }
        if (area / per < 6) { drop.thin += area; continue; } // 細い余り地は草地のまま
        const pl = fitPlane(ring, W, ground);
        if (pl.spread > MAX_STEP && canSplit) return split();
        if (pl.spread > MAX_STEP * 1.6) { drop.steep += area; continue; }
        keep.push([ring, pl]);
      }
      for (const [ring, pl] of keep) parcels.push({ ...frame, ring, y: pl.y, gu: pl.gu, gv: pl.gv, ymin: pl.hmin, type: pickType(r), hue: r() });
    }
  }

  // 町並みの中の、家を建てなかった敷地（lots.js）: 道に沿った向きの小さな田・畑
  for (const L of lotFields) {
    let ux = L.ux, uz = L.uz;
    if (L.nx * -uz + L.nz * ux < 0) { ux = -ux; uz = -uz; } // 面の表裏をそろえる（v = u を左へ 90°）
    const sx = L.Fn(0, 0)[0], sz = L.Fn(0, 0)[1], vx = -uz, vz = ux;
    const W = (u, v) => [sx + ux * u + vx * v, sz + uz * u + vz * v];
    const u0 = -L.F / 2 + 0.7, u1 = L.F / 2 - 0.7, v0 = 1.0, v1 = L.D - 0.8;
    const ring = [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];
    const [hmin, hmax] = heightRange(ring, W, ground);
    if (hmax - hmin > 1.2) continue;
    const v = r();
    parcels.push({ W, sx, sz, ux, uz, vx, vz, ring, y: hmin + (hmax - hmin) * 0.55 + 0.05, gu: 0, gv: 0, ymin: hmin, type: L.veg || (v >= 0.72 && v < 0.9) ? PADDY.VEG : v < 0.72 ? PADDY.RICE : PADDY.SUNFLOWER, hue: r() });
  }

  parcels.push(...fixed);
  const tC = performance.now();
  const group = new THREE.Group();
  group.add(parcelMesh(parcels, ground));
  if (roads.length) group.add(roadMesh(roads, ground));
  group.userData.stats = { parcels: parcels.length, roads: roads.length, ms: Math.round(performance.now() - t0), phases: [tA - t0, tB - tA, tC - tB].map(Math.round), drop: Object.fromEntries(Object.entries(drop).map(([k, v]) => [k, Math.round(v)])), area: Math.round(parcels.reduce((a, p) => a + ringArea(p.ring), 0)), field: Math.round(sdf.reduce((a, v) => a + (v > MARGIN ? CELL * CELL : 0), 0)) };
  group.userData.blocks = blocks.length;
  group.userData.parcels = parcels;
  group.userData.sdf = sdfAt;
  group.userData.sink = (mesh, grid, depth, kinds, canopy) => sinkTerrain(parcels, mesh, grid, depth, kinds, canopy);
  // 区画とそのまわり 4m（枝が田にかからない幅）: 森の木を植えない所
  const cover = new Uint8Array(N * N);
  for (const pc of parcels) {
    const wide = offsetRing(pc.ring, -4), pts = wide.map(([a, b]) => pc.W(a, b));
    const i0 = Math.max(0, Math.floor((Math.min(...pts.map((p) => p[0])) - X0) / CELL)), i1 = Math.min(N - 1, Math.ceil((Math.max(...pts.map((p) => p[0])) - X0) / CELL));
    const j0 = Math.max(0, Math.floor((Math.min(...pts.map((p) => p[1])) - Z0) / CELL)), j1 = Math.min(N - 1, Math.ceil((Math.max(...pts.map((p) => p[1])) - Z0) / CELL));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const x = X0 + (i + 0.5) * CELL - pc.sx, z = Z0 + (j + 0.5) * CELL - pc.sz;
      if (inRing(wide, x * pc.ux + z * pc.uz, x * pc.vx + z * pc.vz)) cover[j * N + i] = 1;
    }
  }
  group.userData.covered = (x, z) => {
    const i = Math.floor((x - X0) / CELL), j = Math.floor((z - Z0) / CELL);
    return i >= 0 && j >= 0 && i < N && j < N && cover[j * N + i] === 1;
  };
  return group;
}

// ---------- 形の道具 ----------
// f(u, v) > 0 の所の輪郭（マーチングスクエア）。[u0, u1] × [v0, v1] の外側 1 マスまで調べるので輪は必ず閉じる
// 返す輪は、中を左に見て回る向き（外周は反時計回り＝面積が正、穴は負）
// lip: f が距離のように変わる（1 m で 1 以上は変わらない）とき、粗い格子で符号がはっきりしている所は細かく調べない
function contour(u0, u1, v0, v1, f, step = 1.5, lip = false) {
  const nu = Math.max(1, Math.ceil((u1 - u0) / step)), nv = Math.max(1, Math.ceil((v1 - v0) / step));
  const hu = (u1 - u0) / nu, hv = (v1 - v0) / nv;
  const NX = nu + 3, NY = nv + 3; // 格子の線が四角の辺にちょうど乗るように
  const U = (i) => u0 + (i - 1) * hu, Vv = (j) => v0 + (j - 1) * hv;
  const val = new Float32Array(NX * NY);
  const K = 4, CX = Math.ceil(NX / K) + 1, CY = Math.ceil(NY / K) + 1;
  const coarse = lip ? new Float32Array(CX * CY).fill(NaN) : null;
  const cval = (ci, cj) => { const k = cj * CX + ci; if (Number.isNaN(coarse[k])) coarse[k] = f(U(ci * K), Vv(cj * K)); return coarse[k]; };
  const slack = Math.hypot(hu, hv) * K * 0.5 + Math.max(hu, hv) + 0.5;
  for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
    if (i === 0 || j === 0 || i === NX - 1 || j === NY - 1) { val[j * NX + i] = -1; continue; }
    if (lip) {
      const c = cval(Math.round(i / K), Math.round(j / K));
      if (Math.abs(c) > slack) { val[j * NX + i] = c; continue; }
    }
    val[j * NX + i] = f(U(i), Vv(j));
  }
  const at = (i, j) => val[j * NX + i];
  const pts = new Map(), next = new Map();
  // 辺の上の交点: h = 横の辺 (i,j)-(i+1,j)、v = 縦の辺 (i,j)-(i,j+1)
  const pt = (key, x0, y0, x1, y1, a, b) => {
    if (!pts.has(key)) { const t = a / (a - b); pts.set(key, [x0 + (x1 - x0) * t, y0 + (y1 - y0) * t]); }
    return key;
  };
  for (let j = 0; j < NY - 1; j++) for (let i = 0; i < NX - 1; i++) {
    const a = at(i, j), b = at(i + 1, j), c = at(i + 1, j + 1), d = at(i, j + 1);
    const id = (a > 0 ? 1 : 0) | (b > 0 ? 2 : 0) | (c > 0 ? 4 : 0) | (d > 0 ? 8 : 0);
    if (id === 0 || id === 15) continue;
    const E = {
      B: () => pt('h' + i + ',' + j, U(i), Vv(j), U(i + 1), Vv(j), a, b),
      T: () => pt('h' + i + ',' + (j + 1), U(i), Vv(j + 1), U(i + 1), Vv(j + 1), d, c),
      L: () => pt('v' + i + ',' + j, U(i), Vv(j), U(i), Vv(j + 1), a, d),
      R: () => pt('v' + (i + 1) + ',' + j, U(i + 1), Vv(j), U(i + 1), Vv(j + 1), b, c),
    };
    const mid = (a + b + c + d) / 4 > 0;
    // 向きつきの線分（中を左に見る）。a 左下, b 右下, c 右上, d 左上
    const segs = {
      1: [['B', 'L']], 2: [['R', 'B']], 3: [['R', 'L']], 4: [['T', 'R']], 6: [['T', 'B']], 7: [['T', 'L']], 8: [['L', 'T']],
      9: [['B', 'T']], 11: [['R', 'T']], 12: [['L', 'R']], 13: [['B', 'R']], 14: [['L', 'B']],
      5: mid ? [['B', 'R'], ['T', 'L']] : [['B', 'L'], ['T', 'R']],
      10: mid ? [['L', 'B'], ['R', 'T']] : [['R', 'B'], ['L', 'T']],
    }[id];
    for (const [e1, e2] of segs) {
      const p = E[e1](), q = E[e2]();
      next.set(p, q);
    }
  }
  const loops = [];
  for (const start of next.keys()) {
    if (!next.has(start)) continue;
    const loop = [];
    let k = start;
    while (next.has(k)) { const n = next.get(k); next.delete(k); loop.push(pts.get(k)); k = n; }
    if (loop.length >= 3) loops.push(loop);
  }
  return loops;
}
// 閉じた輪を間引く（Douglas-Peucker。いちばん離れた 2 点で 2 つに分けてから）
function simplifyRing(ring, tol) {
  if (ring.length < 6) return ring;
  let far = 0, fd = -1;
  for (let k = 1; k < ring.length; k++) { const d = Math.hypot(ring[k][0] - ring[0][0], ring[k][1] - ring[0][1]); if (d > fd) { fd = d; far = k; } }
  const a = simplify(ring.slice(0, far + 1), tol), b = simplify([...ring.slice(far), ring[0]], tol);
  return [...a.slice(0, -1), ...b.slice(0, -1)];
}
// g(t) > 0 の区間を [lo, hi] の中で探す（step ごとに調べ、境目は二分法で詰める）
function runs(lo, hi, g, step, out) {
  const n = Math.max(1, Math.ceil((hi - lo) / step));
  let prevT = lo, prevIn = g(lo) > 0, start = prevIn ? lo : null;
  const edge = (a, b, inA) => {
    for (let it = 0; it < 7; it++) { const m = (a + b) / 2; if ((g(m) > 0) === inA) a = m; else b = m; }
    return (a + b) / 2;
  };
  for (let k = 1; k <= n; k++) {
    const t = lo + ((hi - lo) * k) / n, inside = g(t) > 0;
    if (inside !== prevIn) {
      const e = edge(prevT, t, prevIn);
      if (inside) start = e; else { out.push([start, e]); start = null; }
    }
    prevT = t; prevIn = inside;
  }
  if (start !== null) out.push([start, hi]);
  return out;
}

// 符号つき距離（m）: 中は正、外は負。2 回ぼかして、きわの線をなめらかに
function signedDistance(field, N, cell) {
  const din = edt(field, N, 0), dout = edt(field, N, 1);
  let d = new Float32Array(N * N);
  for (let c = 0; c < N * N; c++) {
    d[c] = field[c] ? (Math.sqrt(din[c]) - 0.5) * cell : -(Math.sqrt(dout[c]) - 0.5) * cell;
    d[c] = Math.max(-60, Math.min(60, d[c]));
  }
  for (let it = 0; it < 2; it++) {
    const s = new Float32Array(N * N);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      let a = 0, n = 0;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        const x = i + di, z = j + dj;
        if (x < 0 || z < 0 || x >= N || z >= N) continue;
        a += d[z * N + x]; n++;
      }
      s[j * N + i] = a / n;
    }
    d = s;
  }
  return d;
}
// 値が target のセルまでの距離の 2 乗（セル単位）。Felzenszwalb の方法
function edt(field, N, target) {
  const INF = 1e12, f = new Float64Array(N * N);
  for (let c = 0; c < N * N; c++) f[c] = field[c] === target ? 0 : INF;
  const g = new Float64Array(N), d = new Float64Array(N), v = new Int32Array(N), z = new Float64Array(N + 1);
  const pass = (get, set) => {
    for (let q = 0; q < N; q++) g[q] = get(q);
    let k = 0; v[0] = 0; z[0] = -Infinity; z[1] = Infinity;
    for (let q = 1; q < N; q++) {
      let s = (g[q] + q * q - (g[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      while (s <= z[k]) { k--; s = (g[q] + q * q - (g[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); }
      k++; v[k] = q; z[k] = s; z[k + 1] = Infinity;
    }
    k = 0;
    for (let q = 0; q < N; q++) { while (z[k + 1] < q) k++; d[q] = (q - v[k]) ** 2 + g[v[k]]; }
    for (let q = 0; q < N; q++) set(q, d[q]);
  };
  for (let j = 0; j < N; j++) pass((q) => f[j * N + q], (q, x) => { f[j * N + q] = x; });
  for (let i = 0; i < N; i++) pass((q) => f[q * N + i], (q, x) => { f[q * N + i] = x; });
  return f;
}

// 折れ線を間引く（Douglas-Peucker）
function simplify(pts, tol) {
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const st = [[0, pts.length - 1]];
  while (st.length) {
    const [a, b] = st.pop();
    let md = 0, mi = -1;
    for (let i = a + 1; i < b; i++) {
      const d = polylineDist(pts[i][0], pts[i][1], [pts[a], pts[b]]);
      if (d > md) { md = d; mi = i; }
    }
    if (md > tol) { keep[mi] = 1; st.push([a, mi], [mi, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}

// 符号つき面積（u, v で反時計回りが正）
function ringArea(ring) {
  let a = 0;
  for (let k = 0; k < ring.length; k++) { const p = ring[k], q = ring[(k + 1) % ring.length]; a += p[0] * q[1] - q[0] * p[1]; }
  return a / 2;
}
export function inRing(ring, u, v) {
  let c = false;
  for (let a = 0, b = ring.length - 1; a < ring.length; b = a++) {
    const [ua, va] = ring[a], [ub, vb] = ring[b];
    if ((va > v) !== (vb > v) && u < ua + ((v - va) / (vb - va)) * (ub - ua)) c = !c;
  }
  return c;
}
// 区画の中の地面の高さの幅
function heightRange(ring, W, ground) {
  let hmin = Infinity, hmax = -Infinity;
  const us = ring.map((p) => p[0]), vs = ring.map((p) => p[1]);
  const u0 = Math.min(...us), u1 = Math.max(...us), v0 = Math.min(...vs), v1 = Math.max(...vs);
  const su = Math.max(3, (u1 - u0) / 6), sv = Math.max(3, (v1 - v0) / 4);
  const take = (u, v) => { const y = ground(...W(u, v)); if (y < hmin) hmin = y; if (y > hmax) hmax = y; };
  for (const [u, v] of ring) take(u, v);
  for (let v = v0 + sv / 2; v < v1; v += sv) for (let u = u0 + su / 2; u < u1; u += su) if (inRing(ring, u, v)) take(u, v);
  return [hmin, hmax];
}
// 区画の面: 地面に最小二乗で平面を当て、傾きは TILT までにおさえる。面の高さは地面との差の幅の中ほど
function fitPlane(ring, W, ground, tilt = TILT) {
  const us = ring.map((p) => p[0]), vs = ring.map((p) => p[1]);
  const u0 = Math.min(...us), u1 = Math.max(...us), v0 = Math.min(...vs), v1 = Math.max(...vs);
  const su = Math.max(4, (u1 - u0) / 8), sv = Math.max(4, (v1 - v0) / 6);
  const S = [];
  for (const [u, v] of ring) S.push([u, v, ground(...W(u, v))]);
  for (let v = v0 + sv / 2; v < v1; v += sv) for (let u = u0 + su / 2; u < u1; u += su) if (inRing(ring, u, v)) S.push([u, v, ground(...W(u, v))]);
  // h = a + b u + c v（u, v は平均を引いて解く）
  const n = S.length;
  let mu = 0, mv = 0, mh = 0, hmin = Infinity;
  for (const [u, v, h] of S) { mu += u / n; mv += v / n; mh += h / n; hmin = Math.min(hmin, h); }
  let suu = 0, svv = 0, suv = 0, suh = 0, svh = 0;
  for (const [u, v, h] of S) { const a = u - mu, b = v - mv, c = h - mh; suu += a * a; svv += b * b; suv += a * b; suh += a * c; svh += b * c; }
  const det = suu * svv - suv * suv;
  let gu = det > 1e-6 ? (suh * svv - svh * suv) / det : 0, gv = det > 1e-6 ? (svh * suu - suh * suv) / det : 0;
  const t = Math.hypot(gu, gv);
  if (t > tilt) { gu *= tilt / t; gv *= tilt / t; }
  let rmin = Infinity, rmax = -Infinity;
  for (const [u, v, h] of S) { const d = h - (gu * u + gv * v); rmin = Math.min(rmin, d); rmax = Math.max(rmax, d); }
  return { gu, gv, y: rmin + (rmax - rmin) * 0.55 + 0.05, spread: rmax - rmin, hmin };
}
// 多角形を d だけ内側へ（d < 0 なら外側へ）ずらす。反時計回りの輪
export function offsetRing(ring, d) {
  const n = ring.length, out = [];
  for (let i = 0; i < n; i++) {
    const p = ring[(i + n - 1) % n], q = ring[i], s = ring[(i + 1) % n];
    let ax = q[0] - p[0], ay = q[1] - p[1], bx = s[0] - q[0], by = s[1] - q[1];
    const la = Math.hypot(ax, ay) || 1, lb = Math.hypot(bx, by) || 1;
    ax /= la; ay /= la; bx /= lb; by /= lb;
    const n1x = -ay, n1y = ax, n2x = -by, n2y = bx;
    const dot = Math.max(0.35, 1 + n1x * n2x + n1y * n2y);
    out.push([q[0] + (d * (n1x + n2x)) / dot, q[1] + (d * (n1y + n2y)) / dot]);
  }
  return out;
}
// 近すぎる点を除く
function cleanRing(ring) {
  const out = [];
  for (const p of ring) {
    const q = out[out.length - 1];
    if (!q || Math.hypot(p[0] - q[0], p[1] - q[1]) > 0.3) out.push(p);
  }
  while (out.length > 2 && Math.hypot(out[0][0] - out[out.length - 1][0], out[0][1] - out[out.length - 1][1]) < 0.3) out.pop();
  return out;
}

// ---------- 区画のメッシュ ----------
// aP: (種類, 色むら, 幅 m, 奥行き m) / aL: (u, v)（区画の中の m）/ aK: 0 田の面, 1 あぜ, 2 土手
function parcelMesh(parcels, ground) {
  const pos = [], nrm = [], P = [], L = [], K = [], idx = [];
  let n = 0;
  const vert = (x, y, z, nx, ny, nz, p, lu, lv, k) => { pos.push(x, y, z); nrm.push(nx, ny, nz); P.push(...p); L.push(lu, lv); K.push(k); return n++; };
  // 三角形を、面の向きが want を向くように足す
  const tri = (a, b, c, wx, wy, wz) => {
    const ax = pos[a * 3], ay = pos[a * 3 + 1], az = pos[a * 3 + 2];
    const e1 = [pos[b * 3] - ax, pos[b * 3 + 1] - ay, pos[b * 3 + 2] - az], e2 = [pos[c * 3] - ax, pos[c * 3 + 1] - ay, pos[c * 3 + 2] - az];
    const nx = e1[1] * e2[2] - e1[2] * e2[1], ny = e1[2] * e2[0] - e1[0] * e2[2], nz = e1[0] * e2[1] - e1[1] * e2[0];
    if (nx * wx + ny * wy + nz * wz >= 0) idx.push(a, b, c); else idx.push(a, c, b);
  };
  const quad = (a, b, c, d, wx, wy, wz) => { tri(a, b, c, wx, wy, wz); tri(a, c, d, wx, wy, wz); };
  for (const pc of parcels) {
    const { W } = pc;
    const yAt = (a, b) => pc.y + pc.gu * a + pc.gv * b;
    const ring = cleanRing(pc.ring);
    if (ring.length < 3) continue;
    const inn = offsetRing(ring, RIM), out = offsetRing(ring, -GAP);
    if (ringArea(inn) < 8) continue;
    const us = ring.map((q) => q[0]), vs = ring.map((q) => q[1]);
    const u0 = Math.min(...us), v0 = Math.min(...vs);
    const p = [pc.type, pc.hue, Math.max(...us) - u0, Math.max(...vs) - v0];
    // 田の面
    const f = inn.map(([a, b]) => { const [x, z] = W(a, b); return vert(x, yAt(a, b), z, 0, 1, 0, p, a - u0, b - v0, 0); });
    const tris = THREE.ShapeUtils.triangulateShape(inn.map(([a, b]) => new THREE.Vector2(a, b)), []);
    for (const [a, b, c] of tris) tri(f[a], f[b], f[c], 0, 1, 0);
    // あぜ（内側は田の面、外側は少し高い）
    const m = ring.length;
    for (let k = 0; k < m; k++) {
      const k2 = (k + 1) % m;
      const pts = [[inn[k], 0], [inn[k2], 0], [out[k2], RIM_H], [out[k], RIM_H]].map(([[a, b], dy]) => { const [x, z] = W(a, b); return vert(x, yAt(a, b) + dy, z, 0, 1, 0, p, a - u0, b - v0, 1); });
      quad(pts[0], pts[1], pts[2], pts[3], 0, 1, 0);
    }
    // 土手: あぜの外側から地面の下まで（辺を 4 m ごとに刻む）。棚田のとなりの低い区画の下まで届くよう深めに
    for (let k = 0; k < m; k++) {
      const [a0, b0] = out[k], [a1, b1] = out[(k + 1) % m];
      const len = Math.hypot(a1 - a0, b1 - b0);
      if (len < 0.05) continue;
      const segs = Math.max(1, Math.ceil(len / 4));
      // 外向きの法線（u, v → 世界）
      const eu = (a1 - a0) / len, ev = (b1 - b0) / len;
      const on = [ev, -eu];
      const [wx, wz] = [pc.ux * on[0] + pc.vx * on[1], pc.uz * on[0] + pc.vz * on[1]];
      let prevT = null, prevB = null;
      for (let q = 0; q <= segs; q++) {
        const a = a0 + ((a1 - a0) * q) / segs, b = b0 + ((b1 - b0) * q) / segs;
        const [x, z] = W(a, b);
        const g = ground(x + wx * 0.8, z + wz * 0.8) - 0.35;
        const yt = yAt(a, b) + RIM_H;
        const top = vert(x, yt, z, wx, 0.4, wz, p, 0, 0, 2);
        const bot = vert(x + wx * 0.5, Math.min(g, pc.ymin - 1.6, yt - 0.05), z + wz * 0.5, wx, 0.4, wz, p, 0, 1, 2);
        if (prevT !== null) quad(prevT, top, bot, prevB, wx, 0.4, wz);
        prevT = top; prevB = bot;
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  geo.setAttribute('aP', new THREE.Float32BufferAttribute(P, 4));
  geo.setAttribute('aL', new THREE.Float32BufferAttribute(L, 2));
  geo.setAttribute('aK', new THREE.Float32BufferAttribute(K, 1));
  geo.setIndex(n > 65535 ? new THREE.Uint32BufferAttribute(idx, 1) : new THREE.Uint16BufferAttribute(idx, 1));
  geo.computeBoundingSphere();
  const mesh = new THREE.Mesh(geo, paddyMaterial());
  mesh.receiveShadow = true;
  mesh.name = 'paddies';
  return mesh;
}

function paddyMaterial() {
  // 照り返しの白っぽさを出さないようランバート（稲の葉はつやがない）
  const mat = new THREE.MeshLambertMaterial();
  return paint(mat, {
    amp: 0.05, scale: 0.3, key: 'paddy',
    attrs: 'attribute vec4 aP; attribute vec2 aL; attribute float aK;',
    vars: 'varying vec4 vP; varying vec2 vL; varying float vK;',
    vtx: 'vP = aP; vL = aL; vK = aK;',
    frag: /* glsl */ `
      {
        float type = floor(vP.x + 0.5), hue = vP.y;
        float dist = length(cameraPosition - vWP);
        vec2 fw = fwidth(vL) + 1e-4;
        // 模様の細かさが画面の 1 画素より細かくなったら平均の色へ
        float fine = 1.0 - smoothstep(0.08, 0.3, max(fw.x, fw.y));
        float n1 = tnF(vWP.xz * 0.35), n2 = tnV(vWP.xz * 1.7);
        // 風が渡る明るい帯（稲の葉が裏返る）
        vec2 wd = normalize(vec2(0.8, 0.45));
        float wave = sin(dot(vWP.xz, wd) * 0.09 - uTime * 1.3 + tnV(vWP.xz * 0.02) * 5.0);
        wave = smoothstep(0.35, 1.0, wave) * (0.6 + 0.4 * tnV(vWP.xz * 0.05 + uTime * 0.05));
        vec3 col;
        vec3 riceA = vec3(0.09, 0.27, 0.02), riceB = vec3(0.17, 0.36, 0.025), riceC = vec3(0.05, 0.19, 0.035);
        vec3 rice = mix(mix(riceC, riceA, smoothstep(0.0, 0.5, hue)), riceB, smoothstep(0.5, 1.0, hue));
        // 2 割ほどは黄みがかった田（早く色づく田）
        rice = mix(rice, vec3(0.4, 0.4, 0.07), smoothstep(0.79, 0.81, hue) * 0.85);
        rice *= 0.9 + n1 * 0.22;
        rice = mix(rice, rice * 1.25 + vec3(0.03, 0.04, 0.0), wave * 0.55);
        // 稲の列（近くだけ）
        float rows = smoothstep(0.25, 0.5, abs(fract(vL.y / 0.3) - 0.5));
        if (type < 0.5) {
          col = rice * mix(1.0, 0.86 + rows * 0.22, fine);
        } else if (type < 1.5) {
          // 若い田: 水面に空が映り、株の列が並ぶ
          vec3 sky = vec3(0.3, 0.46, 0.52) * (0.92 + n2 * 0.1);
          float stalk = smoothstep(0.3, 0.12, abs(fract(vL.y / 0.3) - 0.5)) * smoothstep(0.3, 0.12, abs(fract(vL.x / 0.3) - 0.5));
          col = mix(mix(sky, riceA * 1.1, 0.45), mix(sky, riceA * 1.15, stalk * 0.9 + 0.1), fine);
        } else if (type < 2.5) {
          // ひまわり: 0.7m 格子に花、花の中心は茶色
          vec2 g = vL / 0.7; vec2 id = floor(g); vec2 f = fract(g) - 0.5;
          f += (vec2(tnH(id), tnH(id + 7.1)) - 0.5) * 0.35;
          float d = length(f);
          float petal = smoothstep(0.32, 0.26, d), eye = smoothstep(0.13, 0.09, d);
          vec3 leaf = vec3(0.16, 0.34, 0.07) * (0.9 + n1 * 0.2);
          vec3 yel = vec3(0.95, 0.66, 0.05);
          vec3 near = mix(mix(leaf, yel, petal), vec3(0.2, 0.1, 0.03), eye);
          vec3 avg = mix(leaf, yel, 0.52);
          col = mix(avg, near, fine);
        } else if (type < 3.5) {
          // レンゲ: 緑の中に赤紫の花
          float fl = smoothstep(0.55, 0.75, tnV(vL * 3.2 + hue * 40.0)) ;
          vec3 leaf = vec3(0.25, 0.45, 0.12);
          vec3 pink = vec3(0.72, 0.12, 0.42);
          col = mix(mix(leaf, pink, 0.5), mix(leaf, pink, fl), fine) * (0.92 + n1 * 0.16);
        } else if (type < 4.5) {
          // 野菜畑: 土の畝と緑の列
          float ridge = smoothstep(0.15, 0.3, abs(fract(vL.y / 1.2) - 0.5));
          vec3 soil = vec3(0.4, 0.3, 0.19) * (0.9 + n2 * 0.2);
          vec3 veg = vec3(0.2, 0.42, 0.1) * (0.85 + tnV(vL * 2.0) * 0.3);
          col = mix(mix(soil, veg, 0.5), mix(veg, soil, ridge), fine);
        } else {
          // 草地
          col = mix(vec3(0.36, 0.52, 0.16), vec3(0.52, 0.58, 0.22), n1) * (0.95 + n2 * 0.1);
        }
        // あぜと土手
        vec3 levee = mix(vec3(0.3, 0.5, 0.12), vec3(0.42, 0.55, 0.16), n2) * (0.95 + n1 * 0.1);
        if (vK > 0.5 && vK < 1.5) col = levee;
        if (vK > 1.5) col = mix(levee * 0.8, vec3(0.2, 0.28, 0.09), clamp(vL.y, 0.0, 1.0) * 0.7);
        diffuseColor.rgb = col;
      }`,
  });
}

// ---------- 農道（砂利） ----------
// roads: [[ax, az], [bx, bz]] のまっすぐな区間
function roadMesh(roads, ground) {
  const pos = [], col = [], idx = [];
  let n = 0;
  const c = new THREE.Color(0.52, 0.48, 0.36); // 白っぽい砂利（区画案のクリーム色の道）
  const hw = ROAD_W / 2;
  for (const [[ax, az], [bx, bz]] of roads) {
    const len = Math.hypot(bx - ax, bz - az);
    if (len < 1) continue;
    const tx = (bx - ax) / len, tz = (bz - az) / len, nx = -tz, nz = tx;
    const segs = Math.max(1, Math.ceil(len / 5));
    for (let q = 0; q <= segs; q++) {
      const t = (len * q) / segs, xm = ax + tx * t, zm = az + tz * t;
      const gm = ground(xm, zm);
      for (const s of [-1, 1]) {
        const x = xm + nx * hw * s, z = zm + nz * hw * s;
        pos.push(x, Math.max(ground(x, z), gm) + 0.06, z);
        col.push(c.r, c.g, c.b);
      }
      if (q) { const a = n - 2, b = n - 1, d = n, e = n + 1; idx.push(a, e, b, a, d, e); }
      n += 2;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(n > 65535 ? new THREE.Uint32BufferAttribute(idx, 1) : new THREE.Uint16BufferAttribute(idx, 1));
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  const mesh = new THREE.Mesh(geo, paint(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }), { amp: 0.18, scale: 1.3, key: 'farmroad' }));
  mesh.receiveShadow = true;
  mesh.name = 'farm-roads';
  return mesh;
}

// 区画の下の地形を区画の面より下へ沈める（地形が田の面から突き出さないように）
// grid: 地形の格子（core / outer）。mesh の頂点は grid と同じ並び
// kinds / canopy（中心部だけ）: 区画の下は田にし、森の盛り上がり（歩けない所）も消す
export function sinkTerrain(parcels, mesh, grid, depth = 0.35, kinds = null, canopy = null) {
  const pos = mesh.geometry.attributes.position;
  let n = 0;
  for (const pc of parcels) {
    // 区画の中は面より depth 下へ。まわり（格子 1 つ分強）も面より少し下へ: 地形の三角形が面を突き抜けないように
    const ring = offsetRing(pc.ring, 0.2), wide = offsetRing(pc.ring, -grid.step * 1.2);
    const pts = wide.map(([a, b]) => pc.W(a, b));
    const xs = pts.map((p) => p[0]), zs = pts.map((p) => p[1]);
    const i0 = Math.max(0, Math.floor((Math.min(...xs) - grid.x0) / grid.step)), i1 = Math.min(grid.nx - 1, Math.ceil((Math.max(...xs) - grid.x0) / grid.step));
    const j0 = Math.max(0, Math.floor((Math.min(...zs) - grid.z0) / grid.step)), j1 = Math.min(grid.nz - 1, Math.ceil((Math.max(...zs) - grid.z0) / grid.step));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const x = grid.xOf(i) - pc.sx, z = grid.zOf(j) - pc.sz;
      const u = x * pc.ux + z * pc.uz, v = x * pc.vx + z * pc.vz;
      const inside = inRing(ring, u, v);
      if (!inside && !inRing(wide, u, v)) continue;
      const k = j * grid.nx + i, y = pc.y + pc.gu * u + pc.gv * v - (inside ? depth : 0.12);
      if (pos.getY(k) > y) { pos.setY(k, y); n++; }
      if (kinds && inside) kinds[k] = 'paddy';
      if (canopy && inside) canopy[k] = 0;
    }
  }
  pos.needsUpdate = true;
  mesh.geometry.computeVertexNormals();
  return n;
}
