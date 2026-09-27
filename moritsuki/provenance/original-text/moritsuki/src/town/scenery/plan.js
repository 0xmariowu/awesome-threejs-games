// 景色の方針: 歩いて行けるのは 自分の家・定食屋・水産研究所 のまわりだけ。
// そこから離れた所は実在の町並み（OSM の家・細い道・線路）を描かず、夏の田園の景色（scenery/ のほかのファイル）にする
import { polylineDist } from '../data.js';

// 町並みを残す所: x, z, r（半径 m）, density（自動で建てる家の割合）
// 家と定食屋は同じ通り、漁港（渡船のりば）は家から見える
export const ZONES = [
  { name: 'home', x: -48, z: -18, r: 120, density: 0.5 },
  { name: 'lab', x: -255, z: -70, r: 115, density: 0.25 },
  { name: 'harbor', x: 105, z: 70, r: 72, density: 0.45 },
];
const FADE = 40; // 境目をぼかす幅（m）

// 町並みの濃さ 0..1（ゾーンの中 1、外へ FADE m でなくなる）
export function townWeight(x, z) {
  let w = 0;
  for (const Z of ZONES) {
    const d = Math.hypot(x - Z.x, z - Z.z) - Z.r;
    w = Math.max(w, d <= 0 ? 1 : d >= FADE ? 0 : 1 - d / FADE);
  }
  return w;
}
export const inTown = (x, z, m = 0) => ZONES.some((Z) => Math.hypot(x - Z.x, z - Z.z) < Z.r + m);
// 自動で建てる家の割合
export function townDensity(x, z) {
  let best = 0;
  for (const Z of ZONES) if (Math.hypot(x - Z.x, z - Z.z) < Z.r) best = Math.max(best, Z.density);
  return best;
}

// 田園の中にも残す道（国道・県道）
const MAJOR = new Set(['trunk', 'primary', 'secondary', 'tertiary']);

// 折れ線を最大 step m の間隔に刻む
function densify(p, step) {
  const out = [p[0]];
  for (let i = 1; i < p.length; i++) {
    const [ax, az] = p[i - 1], [bx, bz] = p[i];
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / step));
    for (let k = 1; k <= n; k++) out.push([ax + ((bx - ax) * k) / n, az + ((bz - az) * k) / n]);
  }
  return out;
}

// 地図データを景色の方針に合わせて間引く（data.V を書きかえる）
export function trimVectors(V) {
  const before = { roads: V.roads.length, buildings: V.buildings.length };
  // 道: 国道・県道は全部。ほかはゾーンの中の区間だけ
  const roads = [];
  for (const r of V.roads) {
    if (MAJOR.has(r.k)) { roads.push(r); continue; }
    const pts = densify(r.p, 8);
    let run = [];
    const flush = () => { if (run.length > 1) roads.push({ ...r, p: run }); run = []; };
    for (const q of pts) {
      if (inTown(q[0], q[1], 12)) run.push(q);
      else flush();
    }
    flush();
  }
  V.roads = roads;
  // 線路・駅はなくす（行かないので）
  V.rails = [];
  V.platforms = [];
  // 建物: ゾーンの中だけ
  V.buildings = V.buildings.filter((b) => {
    const [cx, cz] = b.p.reduce((a, q) => [a[0] + q[0] / b.p.length, a[1] + q[1] / b.p.length], [0, 0]);
    return inTown(cx, cz);
  });
  // 土地利用: 森・浜・畑はそのまま。学校・墓地・グラウンドなどはゾーンの中だけ（研究所のキャンパスは残る）
  V.areas = V.areas.filter((a) => {
    if (a.k === 'wood' || a.k === 'beach' || a.k === 'farm') return true;
    if (a.n && a.n.includes('水産大学校')) return true;
    const [cx, cz] = a.p.reduce((s, q) => [s[0] + q[0] / a.p.length, s[1] + q[1] / a.p.length], [0, 0]);
    return inTown(cx, cz);
  });
  V.trimmed = { before, after: { roads: V.roads.length, buildings: V.buildings.length } };
  return V;
}

// 道からの距離（田園の家を道沿いに置くときなどに使う）
export function nearestRoad(V, x, z, kinds = null) {
  let best = Infinity, road = null;
  for (const r of V.roads) {
    if (kinds && !kinds.has(r.k)) continue;
    const d = polylineDist(x, z, r.p);
    if (d < best) { best = d; road = r; }
  }
  return { d: best, road };
}
