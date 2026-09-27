// 町の区分け（市街地・田んぼ・森・浜）と、主要な場所の配置
import { Mask, pointInPoly, polylineDist, bbox } from './data.js';
import { inTown } from './scenery/plan.js';
import { landKind } from './scenery/landscape.js';

// 道路の幅（m）
export const ROAD_W = { trunk: 7.5, primary: 7, secondary: 6.5, tertiary: 5.5, unclassified: 4.6, residential: 4.2, living_street: 3.6, service: 3.4, track: 2.6, footway: 1.6, path: 1.4, cycleway: 1.8, pedestrian: 3 };
export const roadW = (k) => ROAD_W[k] || 3;
export const PAVED = new Set(['trunk', 'primary', 'secondary', 'tertiary', 'unclassified', 'residential', 'living_street', 'service', 'pedestrian', 'cycleway']);

// 家の前の道（南東端 → 北西）: この道沿いに家・公園・定食屋が並ぶ
const S1 = { ax: -17.1, az: -3.1, bx: -70.5, bz: -47.4 };
const s1len = Math.hypot(S1.bx - S1.ax, S1.bz - S1.az);
const S1d = [(S1.bx - S1.ax) / s1len, (S1.bz - S1.az) / s1len]; // 北西向き
const S1n = [S1d[1], -S1d[0]];                                  // 海側（南西）
const alongS1 = (t, off) => [S1.ax + S1d[0] * t + S1n[0] * off, S1.az + S1d[1] * t + S1n[1] * off];
// 向き（y 回転）: ローカル +z を (dx, dz) に向ける
export const yawTo = (dx, dz) => Math.atan2(dx, dz);

// 家と定食屋の敷地は 22 × 10.6 m（道の端から奥の海沿いの道まで）
const LOT_OFF = 2.85 + 10.6 / 2;
const homeAt = alongS1(12, LOT_OFF);
// 公園（19 × 12.6 m）: 家の前の道から田んぼをはさんだ奥、横の農道に面する（scenery/frontage.js の配置）
const parkAt = alongS1(22, -45.3);
const shokuAt = alongS1(55, LOT_OFF);
// 定食屋の人（湊さん）の家の敷地: 自分の家と定食屋の間の空き地（19 × 10.6 m）。stage は assets/ownerHome.js の段階（0 = 空き地）
const ownerAt = alongS1(33.5, LOT_OFF);

export const PLACES = {
  home: { x: homeAt[0], z: homeAt[1], yaw: yawTo(-S1n[0], -S1n[1]), w: 22, d: 10.6, name: '自分の家' },
  park: { x: parkAt[0], z: parkAt[1], yaw: yawTo(S1n[0], S1n[1]), w: 19, d: 12.6, name: '吉山新町公園' },
  teishoku: { x: shokuAt[0], z: shokuAt[1], yaw: yawTo(-S1n[0], -S1n[1]), w: 22, d: 10.6, name: '定食屋' },
  owner: { x: ownerAt[0], z: ownerAt[1], yaw: yawTo(-S1n[0], -S1n[1]), w: 19, d: 10.6, stage: 0, name: '湊さんの家' },
  street: { dir: S1d, n: S1n, a: [S1.ax, S1.az] },
  ferry: { x: 95, z: 30, name: '渡船場' },
  station: { x: 235, z: -29, name: '吉山駅' },
  lab: { x: -260, z: -70, name: '水産研究所' },
  island: { x: -231, z: 468, name: 'アヒル島' },
  // 歩きはじめ: 家の門の前の道（門は敷地の x = 2.6）
  start: { x: alongS1(14.6, 1.0)[0], z: alongS1(14.6, 1.0)[1] },
};

// 家を自動で並べる区域（OSM に建物が少ないところ）
// 座標は実寸の地図で決めたので、ゲームの縮尺（1/2）に合わせる
const half = (p) => p.map(([x, z]) => [x / 2, z / 2]);
export const FILL_ZONES = [
  // 新町（自分の家のまわり）
  [[-250, -130], [-170, -60], [-40, 40], [10, 35], [60, 5], [150, -40], [250, -110], [160, -200], [60, -330], [-30, -480], [-110, -560], [-200, -560], [-235, -300]],
  // 本町・竜王町（西田川の東）
  [[95, 55], [250, -40], [420, -130], [560, -330], [640, -620], [700, -1000], [800, -1000], [760, -600], [700, -300], [620, -80], [560, 50], [420, 120], [300, 160], [200, 180], [120, 150]],
  // 古宿（浜の町）
  [[520, 200], [620, 260], [760, 380], [840, 470], [800, 520], [700, 430], [560, 320], [500, 260]],
  // 永田（研究所の側）
  [[-700, -600], [-300, -600], [-240, -150], [-330, -60], [-420, 0], [-600, -100], [-720, -300]],
].map(half);
// 漁港の岸壁・駐車場（家を建てない）
export const HARBOR = half([[40, 60], [120, 30], [230, 20], [330, 60], [340, 300], [60, 300]]);

export const inZones = (x, z, zones = FILL_ZONES) => zones.some((p) => pointInPoly(x, z, p));

// ---------- マスク（2m 格子） ----------
export const M = { ROAD: 1, BLD: 2, WATER: 4, RAIL: 8, TOWN: 16, FARM: 32, WOOD: 64, BEACH: 128, AREA: 256, HARBOR: 512, KEEP: 1024, LOT: 2048, PAVE: 4096, LAWN: 8192, LEVEE: 16384, FARMSTEAD: 32768 };

export function buildMasks(data) {
  const { V, core } = data;
  const mask = new Mask(core.x0, core.z0, core.x1 - core.x0, core.z1 - core.z0, 1);
  mask.a = new Uint16Array(mask.nx * mask.nz);
  for (const r of V.roads) mask.fillLine(r.p, roadW(r.k) + 0.3, M.ROAD);
  for (const r of V.rails) mask.fillLine(r.p, 5, M.RAIL);
  for (const b of V.buildings) mask.fillPoly(b.p, M.BLD);
  for (const w of V.water) mask.fillPoly(w.p, M.WATER);
  for (const s of V.streams) mask.fillLine(s.p, 3, M.WATER);
  for (const a of V.areas) {
    if (a.k === 'wood') mask.fillPoly(a.p, M.WOOD);
    else if (a.k === 'beach') mask.fillPoly(a.p, M.BEACH);
    else if (a.k === 'farm') mask.fillPoly(a.p, M.FARM);
    else mask.fillPoly(a.p, M.AREA);
  }
  mask.fillPoly(HARBOR, M.HARBOR);
  for (const z of FILL_ZONES) mask.fillPoly(z, M.TOWN);
  // OSM の建物のまわりも市街地
  for (const b of V.buildings) {
    const [x0, z0, x1, z1] = bbox(b.p);
    mask.fillPoly([[x0 - 12, z0 - 12], [x1 + 12, z0 - 12], [x1 + 12, z1 + 12], [x0 - 12, z1 + 12]], M.TOWN);
  }
  // 町並みは家・定食屋・研究所・漁港のまわり（scenery/plan.js の ZONES）だけ。外は田園にする
  for (let j = 0; j < mask.nz; j++) for (let i = 0; i < mask.nx; i++) {
    const k = j * mask.nx + i;
    if ((mask.a[k] & M.TOWN) && !inTown(mask.x0 + i + 0.5, mask.z0 + j + 0.5)) mask.a[k] &= ~M.TOWN;
  }
  // 特別な場所は空けておく
  const P = PLACES;
  for (const k of ['home', 'park', 'teishoku', 'owner']) {
    const p = P[k], s = Math.sin(p.yaw), c = Math.cos(p.yaw), hw = p.w / 2 + 2.5, hd = p.d / 2 + 2.5;
    const rect = [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]].map(([a, b]) => [p.x + a * c + b * s, p.z - a * s + b * c]);
    mask.fillPoly(rect, M.KEEP);
  }
  return mask;
}

// 地面の種類を決める（地形の色・森の盛り上げに使う）
export function classify(x, z, h, slope, mask) {
  const m = mask.get(x, z);
  if (h < 0.2) return 'sea';
  if (m & M.WATER) return 'water';
  if (m & M.BEACH) return 'sand';
  if (m & (M.ROAD | M.RAIL)) return 'ground';
  if (m & M.HARBOR) return 'ground';
  if (m & M.LOT) return 'yard';
  // 手入れされた芝生（研究所の構内など。landmarks.js が塗る）
  if (m & M.LAWN) return 'lawn';
  if (m & M.AREA) return 'area';
  if (m & M.TOWN) {
    if (h > 13 && slope > 0.24) return 'forest';
    // 川の土手などの急な斜面は草（白っぽい地面の色で尖って見えないように）
    if (slope > 0.32) return 'grass';
    // 建物や道から離れた空き地は草地に
    for (const [dx, dz] of [[4, 0], [-4, 0], [0, 4], [0, -4], [6, 6], [-6, -6], [6, -6], [-6, 6]]) if (mask.get(x + dx, z + dz) & (M.BLD | M.ROAD)) return 'town';
    return 'grass';
  }
  if (m & M.LEVEE) return 'levee'; // 川の土手（scenery/river.js）
  if (m & M.FARMSTEAD) return 'yard'; // 田園の農家の庭（scenery/farms.js）
  if (m & M.WOOD) return 'forest';
  // 町並みの外は田園（田んぼ・森・海ぎわの草地。scenery/landscape.js）
  return landKind(h, slope);
}

export { polylineDist };
