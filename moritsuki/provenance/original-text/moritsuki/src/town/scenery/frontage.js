// 定食屋の前（海と反対側）の田園（2026-09-25 ユーザーの参考画像: 道と田んぼ・公園のつながりが破綻していない田舎の町並み）
// 家の前の道（S1）の山側にあった住宅地の格子（OSM の細い道・敷地）をやめ、手で決めた配置にする:
//   道 → 草の路肩 → 用水路（コンクリートの U 字溝。農道の下は暗渠、そのわきに水門）→ 田んぼ（水面と苗の列）
//   農道（砂利）が道からまっすぐ山側へ延びて電柱が並び、奥で横の農道と交わる。横の農道の向こうに公園と大きな木。
//   左手（北西）は田に面した道ぞいの家の集まりで、道と田の間にひまわりの列。奥の道の向こうにも家並み
// 座標: t = S1 の南東端から北西へ（m）、w = S1 の中心線から山側へ（m）。まわりの道の格子はこの向きにそろっている
import * as THREE from 'three';
import { PLACES, M } from '../layout.js';
import { pointInPoly } from '../data.js';
import { PADDY, offsetRing, inRing } from './paddies.js';
import { Kit, kitMaterials } from '../assets/kit.js';
import { pole, wire } from '../assets/props.js';
import { texMat } from '../assets/textures.js';
import { NOISE_GLSL, TIME, paint } from '../materials.js';
import { SUN_DIR } from '../render.js';
import { buildOikawa } from './oikawa.js';

const S = PLACES.street, D = S.dir, N = S.n;
// (t, w) → 世界 (x, z)
export const W = (t, w) => [S.a[0] + D[0] * t - N[0] * w, S.a[1] + D[1] * t - N[1] * w];
// 世界 (x, z) → (t, w)
export const TW = (x, z) => { const dx = x - S.a[0], dz = z - S.a[1]; return [dx * D[0] + dz * D[1], -(dx * N[0] + dz * N[1])]; };
const TDIR = new THREE.Vector3(D[0], 0, D[1]), WDIR = new THREE.Vector3(-N[0], 0, -N[1]), UP = new THREE.Vector3(0, 1, 0);

// ---------- 配置（m） ----------
const ROAD_HW = 2.3;          // S1（4.6 m）の半分
const FHW = 1.3;              // 農道（track 2.6 m）の半分
const F1 = 36;                // 道から山側へ延びる農道の t
const F2 = 36;                // 横の農道の w（南東の道の向こうの道と一直線）
const HAMLET_T = 66.45;       // これより北西は家の集まり（t = 69 の道のふちまで）
const HAMLET_ROAD = 69;       // 家の集まりの道（田に面する）
const BACK_W = 69.6;          // 奥の道（w = 72）の手前
const GAP = 0.6;              // 道のふちから田のあぜまで
const CH = { w0: 2.6, w1: 3.9, t1: 66.2, wall: 0.12, top: 0.1, water: -0.36, floor: -0.62 }; // 用水路（高さは地面から）
const CULVERT = [F1 - FHW - 0.3, F1 + FHW + 0.3]; // 農道の下の暗渠（ふたの範囲）
const GATE_T = F1 + FHW + 1.9; // 水門
export const PADDY_W = [CH.w1, F2 - FHW]; // 道の前の田の手前（用水路の山側のふち）と奥のふち（横の農道の手前）。進入禁止の範囲に使う
const SUNFLOWER = [64.5, 66.2]; // ひまわりの列（t の幅）
const RICE_NEAR = 24, RICE_FAR = 115; // 苗: 細かい形で描く距離・描く距離（その先は水面に列を塗る）

// 南東の道（公園の右を山側へ通る道）: w ごとの t。reshapeFront が地図の道から測る
let LANE = null;
const laneT = (w) => {
  if (!LANE) return w / 6;
  const f = Math.max(0, Math.min(LANE.length - 1.001, w / 2)), i = Math.floor(f), a = f - i;
  return LANE[i] * (1 - a) + LANE[i + 1] * a;
};
// 道と直線 w = 一定 の交点のうち、t が [lo, hi] で guess に近いもの
function crossT(V, w, lo, hi, guess) {
  let best = null;
  for (const r of V.roads) for (let k = 0; k + 1 < r.p.length; k++) {
    const A = TW(...r.p[k]), B = TW(...r.p[k + 1]);
    if (A[1] === B[1] || (A[1] - w) * (B[1] - w) > 0) continue;
    const t = A[0] + ((B[0] - A[0]) * (w - A[1])) / (B[1] - A[1]);
    if (t < lo || t > hi) continue;
    if (best === null || Math.abs(t - guess) < Math.abs(best - guess)) best = t;
  }
  return best;
}

// 作りかえる範囲（家の前の道・南東の道・家の集まり・奥の道で囲まれた所）
function regionTW() {
  const pts = [[HAMLET_T, ROAD_HW + 0.15], [HAMLET_T, BACK_W]];
  for (let w = BACK_W; w > ROAD_HW + 0.15; w -= 2) pts.push([laneT(w) + ROAD_HW + 0.1, w]);
  pts.push([laneT(ROAD_HW + 0.15) + ROAD_HW + 0.1, ROAD_HW + 0.15]);
  return pts;
}
let REGION = null;

// 家の集まり（田んぼの左手）: 家を多めに建て、空き地（家庭菜園の土）を作らない
// 用水路のわき（道の側溝を置かない所）
export const byChannel = (x, z) => { if (!REGION) return false; const [t, w] = TW(x, z); return w > 1.5 && w < 4.6 && t > laneT(3) + ROAD_HW - 0.5 && t < CH.t1 + 0.5; };
export const inHamlet = (x, z) => { const [t, w] = TW(x, z); return t > HAMLET_T && t < 128 && w > 1 && w < 86; };

const densify = (p, step) => {
  const out = [p[0]];
  for (let i = 1; i < p.length; i++) {
    const [ax, az] = p[i - 1], [bx, bz] = p[i], n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / step));
    for (let k = 1; k <= n; k++) out.push([ax + ((bx - ax) * k) / n, az + ((bz - az) * k) / n]);
  }
  return out;
};
const lineLen = (p) => p.reduce((s, q, i) => (i ? s + Math.hypot(q[0] - p[i - 1][0], q[1] - p[i - 1][1]) : 0), 0);

// 地図の道・建物を作りかえる（trimVectors のあと、マスクを作る前）
export function reshapeFront(V) {
  LANE = [];
  for (let w = 0; w <= 92; w += 2) LANE.push(crossT(V, w, -4, 20, w / 6) ?? w / 6);
  REGION = regionTW().map(([t, w]) => W(t, w));
  const inside = (q) => pointInPoly(q[0], q[1], REGION);
  // 範囲の中を通る道は切り、残りの短い切れはしは捨てる
  const roads = [];
  // 集落の裏を平行に通る道（t = 82）はやめる: 家は田に面した t = 69 の道ぞいに並べる
  const behind = (r) => r.p.every((q) => { const [t, w] = TW(...q); return t > 78 && t < 86 && w > -1 && w < 81; });
  for (const r of V.roads) {
    if (behind(r)) continue;
    const pts = densify(r.p, 1.5);
    if (!pts.some(inside)) { roads.push(r); continue; }
    let run = [];
    const flush = () => { if (run.length > 1 && lineLen(run) >= 6) roads.push({ ...r, p: run }); run = []; };
    for (const q of pts) { if (inside(q)) flush(); else run.push(q); }
    flush();
  }
  // 農道（砂利）: 道から山側へ（奥の道まで）と、南東の道から家の集まりの道まで
  roads.push({ k: 'track', sf: 'gravel', p: [W(F1, 0), W(F1, 72)] });
  roads.push({ k: 'track', sf: 'gravel', p: [W(laneT(F2), F2), W(HAMLET_ROAD, F2)] });
  V.roads = roads;
  V.buildings = V.buildings.filter((b) => {
    const c = b.p.reduce((a, q) => [a[0] + q[0] / b.p.length, a[1] + q[1] / b.p.length], [0, 0]);
    return !inside(c);
  });
}

// 用水路（U 字溝の外のふちまで）: [ax, az, bx, bz, 半幅]。草を生やさない所（grass.js の uNoGrass）
export function channelStrip() {
  if (!REGION) return null;
  const wc = (CH.w0 + CH.w1) / 2;
  return [...W(laneT(3) + ROAD_HW + 0.25, wc), ...W(CH.t1, wc), (CH.w1 - CH.w0) / 2 + 0.02];
}

// マスク（buildMasks のあと）: 範囲には家を建てない。用水路には草を生やさず、側溝も置かない
export function markFront(mask) {
  if (!REGION) return;
  mask.fillPoly(REGION, M.KEEP);
  const t0 = laneT(3) + ROAD_HW + 0.2;
  // 水路の中だけ（きわの路肩には雑草が生える）
  mask.fillPoly([W(t0, CH.w0 + 0.15), W(CH.t1, CH.w0 + 0.15), W(CH.t1, CH.w1 - 0.15), W(t0, CH.w1 - 0.15)], M.PAVE);
  // 田の水の中にも草を生やさない（あぜには生える）
  for (const P of parcelRings()) mask.fillPoly(offsetRing(P.ring, 0.7).map(([t, w]) => W(t, w)), M.PAVE);
}

// ---------- 田んぼの区画（paddies.js の buildPaddies に fixed として渡す） ----------
function parcelRings() {
  const L = (w) => laneT(w) + ROAD_HW + 0.9; // 南東の道のわきの田のふち
  const laneEdge = (w0, w1) => { const out = []; for (let w = Math.floor(w1 / 2) * 2; w > w0 + 0.5; w -= 2) out.push([L(w), w]); return out; };
  const a0 = CH.w1 + 0.6, a1 = F2 - FHW - GAP, b0 = F2 + FHW + GAP, b1 = BACK_W - 0.5;
  const tl = F1 + FHW + GAP, tr = F1 - FHW - GAP, th = SUNFLOWER[0] - 0.55;
  return [
    { name: 'front', ring: [[tl, a0], [th, a0], [th, a1], [tl, a1]] },
    { name: 'right', ring: [[L(a0), a0], [tr, a0], [tr, a1], [L(a1), a1], ...laneEdge(a0, a1)] },
    { name: 'back', ring: [[tl, b0], [th, b0], [th, b1], [tl, b1]] },
    { name: 'park-back', ring: [[L(54), 54], [tr, 54], [tr, b1], [L(b1), b1], ...laneEdge(54, b1)] },
  ];
}
export function frontParcels(ground) {
  if (!REGION) return [];
  return parcelRings().map((P, i) => {
    let hmin = Infinity;
    for (const [t, w] of P.ring) hmin = Math.min(hmin, ground(...W(t, w)));
    for (let t = 0; t < 70; t += 3) for (let w = 0; w < 70; w += 3) if (inRing(P.ring, t, w)) hmin = Math.min(hmin, ground(...W(t, w)));
    // 田の面は道より少し低く（道 → 路肩 → 水路 → 一段下がって田）
    return { name: P.name, W, sx: S.a[0], sz: S.a[1], ux: D[0], uz: D[1], vx: -N[0], vz: -N[1], ring: P.ring, y: hmin - 0.12, gu: 0, gv: 0, ymin: hmin, type: PADDY.WET, hue: 0.3 + i * 0.13 };
  });
}

// ---------- 水面（田の水・用水路の水） ----------
// aTW: (t, w, 田=1 / 水路=0)。遠くでは苗の列を塗る（苗の形を描かない距離）
// clear: 用水路の水（浅くて澄んでいる。上から見ると底と泳ぐ魚が透ける）
function waterMaterial(clear = false) {
  const m = new THREE.MeshStandardMaterial({ color: new THREE.Color('#26332f'), roughness: 0.05, metalness: 0, envMapIntensity: 1.25, transparent: clear });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = TIME;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 aTW;\nvarying vec3 vTW;\nvarying vec3 vWPw;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvTW = aTW;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvWPw = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\nuniform float uTime;\nvarying vec3 vTW;\nvarying vec3 vWPw;\n${NOISE_GLSL}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        float dist = length(cameraPosition - vWPw);
        // 水の色は暗く（空の映りこみが主）。田は泥で少しむらがあり、水路は底が透けて緑がかる
        float mud = tnF(vWPw.xz * 0.25);
        diffuseColor.rgb *= 0.8 + mud * 0.35;
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.12, 0.17, 0.13), 1.0 - vTW.z);
        // 苗の列: 近くは水に映った苗の影（うすく）、苗の形を描かない遠くは苗そのもの
        float farK = vTW.z * mix(0.3, 1.0, smoothstep(${(RICE_FAR - 30).toFixed(1)}, ${RICE_FAR.toFixed(1)}, dist));
        float fw = fwidth(vTW.x / 0.3);
        float stripe = mix(smoothstep(0.34, 0.14, abs(fract(vTW.x / 0.3) - 0.5)), 0.5, smoothstep(0.25, 0.7, fw));
        vec3 rice = mix(vec3(0.1, 0.26, 0.04), vec3(0.2, 0.36, 0.06), mud);
        float riceK = stripe * farK;
        diffuseColor.rgb = mix(diffuseColor.rgb, rice, riceK);${clear ? `
        // 真上から見るほど透ける（浅い角度では空が映って見えない）
        diffuseColor.rgb = vec3(0.07, 0.1, 0.075) * (0.85 + mud * 0.3);
        diffuseColor.a = mix(0.9, 0.22, smoothstep(0.06, 0.6, normalize(cameraPosition - vWPw).y));` : ''}`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.85, riceK);')
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        {
          // さざ波（水路は流れに沿って動く）
          vec2 p = vWPw.xz;
          float flow = (1.0 - vTW.z) * uTime * 0.6;
          vec2 g = vec2(tnV(p * 2.1 + vec2(uTime * 0.21, flow)) - 0.5, tnV(p * 2.1 + vec2(17.3, -uTime * 0.17 + flow)) - 0.5);
          g += vec2(tnV(p * 6.3 - uTime * 0.5) - 0.5, tnV(p * 6.3 + 5.1 + uTime * 0.45) - 0.5) * 0.5;
          // 浅い角度では弱く（地平線より下＝地面の色を映して帯になるので）
          float graze = normalize(cameraPosition - vWPw).y;
          g *= 0.07 * (1.0 - smoothstep(15.0, 70.0, dist) * 0.7) * smoothstep(0.03, 0.3, graze);
          normal = normalize(normal + (viewMatrix * vec4(g.x, 0.0, g.y, 0.0)).xyz);
        }`);
  };
  m.customProgramCacheKey = () => 'front-water' + (clear ? '-clear' : '');
  return m;
}

// 多角形（t, w）を水平な面にする
function flatPoly(pos, tw, idx, ring, y, kind) {
  const base = pos.length / 3;
  for (const [t, w] of ring) { const [x, z] = W(t, w); pos.push(x, y, z); tw.push(t, w, kind); }
  const tris = THREE.ShapeUtils.triangulateShape(ring.map(([t, w]) => new THREE.Vector2(t, w)), []);
  for (const [a, b, c] of tris) upTri(pos, idx, base + a, base + b, base + c);
}
// 三角形を表が上を向く順に足す
function upTri(pos, idx, a, b, c) {
  const ax = pos[a * 3], az = pos[a * 3 + 2];
  const ny = (pos[b * 3 + 2] - az) * (pos[c * 3] - ax) - (pos[b * 3] - ax) * (pos[c * 3 + 2] - az);
  if (ny >= 0) idx.push(a, b, c); else idx.push(a, c, b);
}

// ---------- 苗（稲の株） ----------
// 株 1 つ: blades 本の葉。根元 = 原点。segs = 葉の節の数（1 = 細い三角形だけ）
function hillGeo(blades, segs, seed) {
  let s = seed;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const pos = [], nrm = [], col = [], idx = [];
  const cBase = new THREE.Color(0.07, 0.17, 0.035), cTip = new THREE.Color(0.3, 0.5, 0.09);
  for (let b = 0; b < blades; b++) {
    const a = (b / blades) * Math.PI * 2 + r() * 0.8;
    const h = 0.21 + r() * 0.13, lean = 0.16 + r() * 0.24, wid = segs > 1 ? 0.01 + r() * 0.004 : 0.03;
    const dx = Math.cos(a), dz = Math.sin(a), sx = -dz, sz = dx;
    const base = pos.length / 3;
    for (let q = 0; q <= segs; q++) {
      const t = q / segs;
      const out = lean * h * t * t * 1.3, y = h * t * (1 - 0.12 * t * t);
      const cx = dx * (0.012 + out), cz = dz * (0.012 + out);
      const c = cBase.clone().lerp(cTip, Math.pow(t, 0.8));
      // 法線: 上と外向きの間（葉の板の表裏で明るさが変わらないように）
      const nx = dx * 0.45, ny = 1, nz = dz * 0.45;
      if (q === segs) { pos.push(cx, y, cz); nrm.push(nx, ny, nz); col.push(c.r, c.g, c.b); continue; }
      const hw = wid * (1 - t * 0.6);
      pos.push(cx - sx * hw, y, cz - sz * hw, cx + sx * hw, y, cz + sz * hw);
      nrm.push(nx, ny, nz, nx, ny, nz);
      col.push(c.r, c.g, c.b, c.r, c.g, c.b);
    }
    for (let q = 0; q < segs; q++) {
      const a0 = base + q * 2;
      if (q === segs - 1) idx.push(a0, a0 + 1, a0 + 2);
      else idx.push(a0, a0 + 1, a0 + 3, a0, a0 + 3, a0 + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.normalizeNormals();
  return g;
}

function riceMaterial() {
  return paint(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }), {
    amp: 0.1, scale: 0.35, key: 'front-rice',
    // 風で先が揺れる（株ごとに位相をずらす）
    vtxPre: `
      #ifdef USE_INSTANCING
        vec2 ip = instanceMatrix[3].xz;
      #else
        vec2 ip = vec2(0.0);
      #endif
      float bendK = position.y * position.y * 5.0;
      float gust = sin(uTime * 0.9 + ip.x * 0.08 + ip.y * 0.05) * 0.5 + 0.5;
      transformed.x += (sin(uTime * 1.9 + ip.x * 0.7 + ip.y * 0.4) * 0.018 + gust * 0.02) * bendK;
      transformed.z += cos(uTime * 1.6 + ip.x * 0.3 - ip.y * 0.6) * 0.014 * bendK;`,
  });
}

// ---------- ひまわり ----------
function sunflowerGeo(seed, H) {
  let s = seed;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const pos = [], nrm = [], col = [], idx = [];
  const v = (p, n, c) => { pos.push(p.x, p.y, p.z); nrm.push(n.x, n.y, n.z); col.push(c.r, c.g, c.b); return pos.length / 3 - 1; };
  const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
  // 茎: 少し前（+z）へ曲がる
  const stemAt = (y) => V3(Math.sin(y * 1.7) * 0.02, y, Math.pow(y / H, 2) * 0.12);
  const stemC = new THREE.Color(0.2, 0.36, 0.1), SIDES = 5, SEG = 5;
  for (let q = 0; q <= SEG; q++) {
    const y = (H * q) / SEG, c = stemAt(y), rad = 0.022 - 0.008 * (q / SEG);
    for (let k = 0; k < SIDES; k++) {
      const a = (k / SIDES) * Math.PI * 2, n = V3(Math.cos(a), 0, Math.sin(a));
      v(c.clone().addScaledVector(n, rad), n, stemC);
    }
  }
  for (let q = 0; q < SEG; q++) for (let k = 0; k < SIDES; k++) {
    const a = q * SIDES + k, b = q * SIDES + ((k + 1) % SIDES);
    idx.push(a, a + SIDES, b, b, a + SIDES, b + SIDES);
  }
  // 葉: 茎の両側に互い違い、先が垂れるハート形
  const nLeaf = 6 + Math.floor(r() * 3);
  for (let i = 0; i < nLeaf; i++) {
    const y = H * (0.22 + (0.62 * i) / nLeaf), yaw = i * 2.4 + r() * 0.6;
    const len = 0.2 + (1 - i / nLeaf) * 0.12 + r() * 0.05, wid = len * 0.8, droop = 0.35 + r() * 0.3;
    const dir = V3(Math.cos(yaw), 0, Math.sin(yaw)), side = V3(-dir.z, 0, dir.x);
    const o = stemAt(y).addScaledVector(dir, 0.02);
    const P = (t, s2) => o.clone().addScaledVector(dir, 0.05 + t * len).addScaledVector(side, s2 * wid * 0.5).add(V3(0, 0.03 * t - droop * t * t * len, 0));
    const lc = new THREE.Color(0.15, 0.33, 0.07).lerp(new THREE.Color(0.24, 0.42, 0.1), r());
    const n = V3(0, 1, 0).addScaledVector(dir, 0.2).normalize();
    const pts = [P(0, 0), P(0.25, -0.85), P(0.25, 0.85), P(0.6, -0.7), P(0.6, 0.7), P(1, 0)];
    const ids = pts.map((p) => v(p, n, lc));
    idx.push(ids[0], ids[2], ids[1], ids[1], ids[2], ids[3], ids[2], ids[4], ids[3], ids[3], ids[4], ids[5]);
  }
  // 花: 少しうつむいて +z を向く
  const top = stemAt(H);
  const f = V3(0, -0.3 - r() * 0.2, 1).normalize(), right = V3(1, 0, 0), up = new THREE.Vector3().crossVectors(f, right).normalize();
  const R = 0.12 + r() * 0.04, cen = top.clone().addScaledVector(f, 0.04);
  const ring = (rad, fwd) => (a) => cen.clone().addScaledVector(right, Math.cos(a) * rad).addScaledVector(up, Math.sin(a) * rad).addScaledVector(f, fwd);
  const SEGS = 14;
  // 裏のがく（緑）と表の種の円盤（茶色、少し盛り上がる）
  for (const [fwd, rad, c0, c1, nf] of [[-0.03, R * 1.08, new THREE.Color(0.17, 0.3, 0.08), new THREE.Color(0.2, 0.34, 0.09), -1], [0.01, R, new THREE.Color(0.12, 0.07, 0.025), new THREE.Color(0.3, 0.17, 0.05), 1]]) {
    const n = f.clone().multiplyScalar(nf);
    const c = v(cen.clone().addScaledVector(f, fwd + (nf > 0 ? 0.02 : 0)), n, c0);
    const rim = [];
    for (let k = 0; k < SEGS; k++) rim.push(v(ring(rad, fwd)((k / SEGS) * Math.PI * 2), n, c1));
    for (let k = 0; k < SEGS; k++) idx.push(c, rim[k], rim[(k + 1) % SEGS]);
  }
  // 花びら: 2 重。先が少し後ろへ反る
  const NP = 20;
  for (let layer = 0; layer < 2; layer++) {
    for (let k = 0; k < NP; k++) {
      const a = ((k + layer * 0.5) / NP) * Math.PI * 2 + r() * 0.08;
      const L = R * (0.95 + r() * 0.35) * (layer ? 0.9 : 1), wP = 0.035 + r() * 0.01;
      const radial = right.clone().multiplyScalar(Math.cos(a)).addScaledVector(up, Math.sin(a)), tang = right.clone().multiplyScalar(-Math.sin(a)).addScaledVector(up, Math.cos(a));
      const b0 = cen.clone().addScaledVector(radial, R * 0.9).addScaledVector(f, 0.005 - layer * 0.006);
      const tip = b0.clone().addScaledVector(radial, L).addScaledVector(f, -0.03 - r() * 0.03);
      const mid = b0.clone().addScaledVector(radial, L * 0.45);
      const c = new THREE.Color(0.96, 0.66 + r() * 0.08, 0.05 + r() * 0.04).multiplyScalar(layer ? 0.85 : 1);
      const ids = [v(b0, f, c), v(mid.clone().addScaledVector(tang, -wP), f, c), v(mid.clone().addScaledVector(tang, wP), f, c), v(tip, f, c)];
      idx.push(ids[0], ids[1], ids[2], ids[1], ids[3], ids[2]);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}

// ---------- 組み立て ----------
// paddies: buildPaddies の戻り値（fixed に frontParcels を渡したもの）。forest: 木（TreeSet）
export function buildFront(ctx, T, paddies, forest) {
  const group = new THREE.Group();
  group.name = 'frontage';
  if (!REGION) return group;
  const t00 = performance.now();
  const { ground, segs, data } = ctx;
  const g = (t, w) => ground(...W(t, w));
  const P3 = (t, w, y) => { const [x, z] = W(t, w); return [x, y, z]; };
  const po = { polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 };
  const k = new Kit({ ...kitMaterials(), fGrass: texMat('grassGround', po) });
  k.mats.fGrass.userData.noShadow = true;
  k.at(new THREE.Matrix4());
  // 向きをそろえた四角（want: 表の向き）
  const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _d = new THREE.Vector3();
  const face = (mat, pts, uvs, want) => {
    _a.fromArray(pts[0]); _b.fromArray(pts[1]).sub(_a); _d.fromArray(pts[3]).sub(_a);
    if (_b.cross(_d).dot(want) < 0) { pts = [pts[0], pts[3], pts[2], pts[1]]; if (uvs) uvs = [uvs[0], uvs[3], uvs[2], uvs[1]]; }
    k.face(mat, pts, uvs);
  };
  const negT = TDIR.clone().negate(), negW = WDIR.clone().negate();
  const wpos = [], wtw = [], widx = [];
  const parcels = paddies.userData.parcels.filter((p) => p.W === W);

  // ---- 用水路: 2 m ごとのコンクリートの U 字溝（継ぎ目で色を少し変える） ----
  const t0 = laneT(3) + ROAD_HW + 0.25, t1 = CH.t1;
  const wi0 = CH.w0 + CH.wall, wi1 = CH.w1 - CH.wall, wc = (CH.w0 + CH.w1) / 2;
  const n = Math.ceil((t1 - t0) / 2);
  const deep = -1.3; // 外側の面は地面の下まで（地形はこの下へ沈める）
  for (let q = 0; q < n; q++) {
    const ta = t0 + ((t1 - t0) * q) / n, tb = t0 + ((t1 - t0) * (q + 1)) / n;
    const ga = g(ta, wc), gb = g(tb, wc);
    k.chunk(...W((ta + tb) / 2, wc));
    k.color(new THREE.Color('#bdb8ac').multiplyScalar(0.93 + ((q * 7919) % 11) / 100));
    const Y = (t, dy) => (t === ta ? ga : gb) + dy;
    const band = (w0, w1, dy, want, uvw) => face('concrete', [P3(ta, w0, Y(ta, dy)), P3(tb, w0, Y(tb, dy)), P3(tb, w1, Y(tb, dy)), P3(ta, w1, Y(ta, dy))], [[ta, w0], [tb, w0], [tb, w1], [ta, w1]], want);
    const side = (w, y0, y1, want) => face('concrete', [P3(ta, w, Y(ta, y0)), P3(tb, w, Y(tb, y0)), P3(tb, w, Y(tb, y1)), P3(ta, w, Y(ta, y1))], [[ta, y0], [tb, y0], [tb, y1], [ta, y1]], want);
    const covered = tb > CULVERT[0] && ta < CULVERT[1];
    band(CH.w0, wi0, CH.top, UP);            // 外の壁の上
    band(wi1, CH.w1, CH.top, UP);            // 内の壁の上
    side(CH.w0, deep, CH.top, negW);         // 道側の面
    side(wi0, CH.water, CH.top, WDIR);       // 水路の中（道側の壁）
    side(wi1, CH.water, CH.top, negW);       // 水路の中（田側の壁）
    side(CH.w1, deep, CH.top, WDIR);         // 田側の面
    // 水の中の壁と底: 泥と藻でくすんでいる（澄んだ水ごしに見える）
    k.color(new THREE.Color('#827e64').multiplyScalar(0.94 + ((q * 3571) % 13) / 100));
    side(wi0, CH.floor, CH.water, WDIR);
    side(wi1, CH.floor, CH.water, negW);
    k.color(new THREE.Color('#7a7558').multiplyScalar(0.94 + ((q * 3571) % 13) / 100));
    band(wi0, wi1, CH.floor, UP);            // 底
    // 水面
    const base = wpos.length / 3;
    for (const [t, w] of [[ta, wi0], [tb, wi0], [tb, wi1], [ta, wi1]]) { const [x, z] = W(t, w); wpos.push(x, (t === ta ? ga : gb) + CH.water, z); wtw.push(t, w, 0); }
    upTri(wpos, widx, base, base + 1, base + 2); upTri(wpos, widx, base, base + 2, base + 3);
    // 路肩の草（道のふち〜水路、水路〜田のあぜ）。暗渠の上は農道
    if (!covered) {
      k.color(new THREE.Color('#6c7352')); // まわりの草（葉の陰がある）に明るさをそろえる
      face('fGrass', [P3(ta, ROAD_HW - 0.05, ga + 0.03), P3(tb, ROAD_HW - 0.05, gb + 0.03), P3(tb, CH.w0, gb + 0.03), P3(ta, CH.w0, ga + 0.03)], [[ta, 0], [tb, 0], [tb, 0.35], [ta, 0.35]], UP);
      face('fGrass', [P3(ta, CH.w1, ga + 0.03), P3(tb, CH.w1, gb + 0.03), P3(tb, CH.w1 + 0.45, gb), P3(ta, CH.w1 + 0.45, ga)], [[ta, 0], [tb, 0], [tb, 0.45], [ta, 0.45]], UP);
    }
  }
  const chIdx = widx.length; // ここまでが用水路の水面（透ける材質で描く）
  // 暗渠のふた（農道の下）と、ふたの端の面
  {
    const [c0, c1] = CULVERT, gy = g(F1, wc);
    k.chunk(...W(F1, wc)).color(new THREE.Color('#b4afa3'));
    face('concrete', [P3(c0, ROAD_HW - 0.05, gy + 0.05), P3(c1, ROAD_HW - 0.05, gy + 0.05), P3(c1, CH.w1 + 0.3, gy + 0.05), P3(c0, CH.w1 + 0.3, gy + 0.05)], [[c0, 0], [c1, 0], [c1, 1.9], [c0, 1.9]], UP);
    for (const [t, want] of [[c0, negT], [c1, TDIR]]) face('concrete', [P3(t, wi0, gy + CH.water - 0.05), P3(t, wi1, gy + CH.water - 0.05), P3(t, wi1, gy + 0.05), P3(t, wi0, gy + 0.05)], [[wi0, 0], [wi1, 0], [wi1, 0.4], [wi0, 0.4]], want);
  }
  // 両端の壁。どちらも道の下の土管につながる（南東の道から来て、北西の集落の道の下へ）
  for (const [t, want] of [[t0, TDIR], [t1, negT]]) {
    const gy = g(t, wc);
    k.chunk(...W(t, wc)).color(new THREE.Color('#b8b3a7'));
    face('concrete', [P3(t, wi0, gy + CH.floor), P3(t, wi1, gy + CH.floor), P3(t, wi1, gy + CH.top), P3(t, wi0, gy + CH.top)], [[wi0, 0], [wi1, 0], [wi1, 0.7], [wi0, 0.7]], want);
    {
      const s = t === t0 ? 1 : -1;
      k.color(new THREE.Color('#1c1b18'));
      const m = new THREE.Matrix4().makeBasis(WDIR.clone().multiplyScalar(-s), UP, TDIR.clone().multiplyScalar(s)).setPosition(...P3(t + 0.012 * s, wc, gy + CH.water + 0.02));
      k.geo('dark', new THREE.CircleGeometry(0.24, 16, 0, Math.PI), m);
      k.color(new THREE.Color('#8f8a80'));
      k.geo('concrete', new THREE.RingGeometry(0.24, 0.3, 16, 1, 0, Math.PI), m.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0, 0.004)));
    }
  }
  // 水路に落ちないように（渡れるのは農道の暗渠の上だけ）
  for (const [a, b] of [[t0, CULVERT[0] + 0.3], [CULVERT[1] - 0.3, t1]]) segs.add(...W(a, wc), ...W(b, wc), 0.66);

  // ---- 水門（農道のわき）: 溝の両壁に鉄の柱、上に梁とハンドル、扉は少し上げてある ----
  {
    const gy = g(GATE_T, wc);
    // ローカル: x = t 方向、y = 上、z = w 方向（山側）
    const Mg = new THREE.Matrix4().makeBasis(TDIR, UP, WDIR).setPosition(...P3(GATE_T, wc, gy));
    k.at(Mg).chunk(...W(GATE_T, wc));
    const half = (wi1 - wi0) / 2;
    const topY = 0.78;
    k.color(new THREE.Color('#35596b'));
    for (const z of [-half - 0.02, half + 0.02]) k.box('paint', 0, (CH.floor + topY) / 2, z, 0.07, topY - CH.floor, 0.07);
    k.box('paint', 0, topY, 0, 0.08, 0.09, (half + 0.08) * 2);
    // 扉（溝の幅いっぱい）
    k.color(new THREE.Color('#4f6f7e'));
    k.box('paint', 0.02, CH.floor + 0.25 + 0.3, 0, 0.035, 0.62, half * 2 - 0.02);
    k.color(new THREE.Color('#2f3a40'));
    k.box('metal', 0.02, CH.floor + 0.88, 0, 0.05, 0.05, half * 2 - 0.1);
    // ねじ棒・ハンドル
    k.color(new THREE.Color('#9aa0a2'));
    k.cyl('metal', 0.02, CH.floor + 0.88, 0, 0.016, topY + 0.3 - (CH.floor + 0.88), 8);
    k.color(new THREE.Color('#b8322a'));
    k.geo('paint', new THREE.TorusGeometry(0.16, 0.015, 6, 20).rotateX(Math.PI / 2), new THREE.Matrix4().makeTranslation(0.02, topY + 0.27, 0));
    for (let s = 0; s < 3; s++) { const a = (s / 3) * Math.PI * 2; k.rod('paint', [0.02, topY + 0.27, 0], [0.02 + Math.cos(a) * 0.16, topY + 0.27, Math.sin(a) * 0.16], 0.016); }
    k.color(new THREE.Color('#e6e1d6'));
    k.box('trim', -0.05, topY - 0.2, -half - 0.02, 0.012, 0.14, 0.22); // 管理の札
    k.at(new THREE.Matrix4());
    segs.add(...W(GATE_T, CH.w0), ...W(GATE_T, CH.w1), 0.15);
  }
  k.at(new THREE.Matrix4());

  // ---- 田の水面と苗 ----
  // 株の形は 1 種類（向き・大きさを株ごとに変える）。描く回数を区画 1 つにつき 1 回にする
  const hill0 = hillGeo(6, 3, 23), hill1 = hillGeo(3, 1, 23);
  const riceMat = riceMaterial();
  const chunks = [];
  const m4 = new THREE.Matrix4(), qt = new THREE.Quaternion(), sc = new THREE.Vector3(), vp = new THREE.Vector3();
  let seed = 9;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (const pc of parcels) {
    const inner = offsetRing(pc.ring, 0.6);
    const wy = pc.y + 0.05;
    flatPoly(wpos, wtw, widx, inner, wy, 1);
    const plant = offsetRing(pc.ring, 0.8);
    const ts = plant.map((p) => p[0]), ws = plant.map((p) => p[1]);
    const T0 = Math.min(...ts), T1 = Math.max(...ts), W0 = Math.min(...ws), W1 = Math.max(...ws);
    const CS = 13, buckets = new Map();
    // 列は山側へ（道から見て奥へ）向かう: t 方向に 0.3 m、列の中は 0.21 m ごと
    // 列の位置は t = 0.3 m 格子の真ん中（水面に描く列とそろえる）
    for (let t = Math.ceil(T0 / 0.3) * 0.3 + 0.15; t < T1; t += 0.3) {
      const off = rnd() * 0.2;
      for (let w = W0 + 0.1 + off; w < W1; w += 0.24) {
        if (rnd() < 0.015 || !inRing(plant, t, w)) continue; // ところどころ欠株
        const tt = t + (rnd() - 0.5) * 0.04, ww = w + (rnd() - 0.5) * 0.04;
        const key = Math.floor(tt / CS) + ',' + Math.floor(ww / CS);
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key).push([tt, ww]);
      }
    }
    for (const [key, list] of buckets) {
      const [ci, cj] = key.split(',').map(Number);
      const [cx, cz] = W((ci + 0.5) * CS, (cj + 0.5) * CS);
      const ch = { x: cx, z: cz, y: wy, near: [], far: [] };
      {
        const arr = new Float32Array(list.length * 16);
        list.forEach(([t, w], i) => {
          const [x, z] = W(t, w);
          qt.setFromAxisAngle(UP, rnd() * Math.PI * 2);
          const s = 0.85 + rnd() * 0.3;
          m4.compose(vp.set(x, wy - 0.05, z), qt, sc.set(s, s * (0.9 + rnd() * 0.2), s));
          m4.toArray(arr, i * 16);
        });
        const attr = new THREE.InstancedBufferAttribute(arr, 16);
        for (const [lod, geo] of [['near', hill0], ['far', hill1]]) {
          const im = new THREE.InstancedMesh(geo, riceMat, list.length);
          im.instanceMatrix = attr;
          im.computeBoundingSphere();
          im.castShadow = false; im.receiveShadow = true;
          im.visible = false;
          im.name = 'rice-' + lod;
          ch[lod].push(im);
          group.add(im);
        }
      }
      chunks.push(ch);
    }
  }
  const water = new THREE.BufferGeometry();
  water.setAttribute('position', new THREE.Float32BufferAttribute(wpos, 3));
  water.setAttribute('aTW', new THREE.Float32BufferAttribute(wtw, 3));
  water.setAttribute('normal', new THREE.Float32BufferAttribute(wpos.map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
  water.setIndex(widx);
  water.computeBoundingSphere();
  water.addGroup(0, chIdx, 0);
  water.addGroup(chIdx, widx.length - chIdx, 1);
  const wm = new THREE.Mesh(water, [waterMaterial(true), waterMaterial()]);
  wm.receiveShadow = true;
  wm.name = 'front-water';
  group.add(wm);

  // ---- オイカワ: 定食屋の前の用水路（水門より下流）を泳ぐ ----
  let oikawa;
  {
    const gs = [];
    for (let q = 0; q <= n; q++) { const t = t0 + ((t1 - t0) * q) / n; gs.push(g(t, wc)); }
    const gAt = (t) => { const f = Math.max(0, Math.min(n - 1e-6, ((t - t0) / (t1 - t0)) * n)), q = Math.floor(f); return gs[q] + (gs[q + 1] - gs[q]) * (f - q); };
    oikawa = buildOikawa({
      t0: GATE_T + 1, t1: t1 - 0.5, w0: wi0 + 0.1, w1: wi1 - 0.1,
      floor: (t) => gAt(t) + CH.floor, surface: (t) => gAt(t) + CH.water,
      wall: [wi0, wi1], top: CH.top - CH.floor, world: W, tw: TW, TDIR, WDIR, sun: SUN_DIR,
    });
    group.add(oikawa);
  }

  // ---- ひまわり（田と家の集まりの境）: 日の方を向く ----
  {
    const geos = [sunflowerGeo(5, 1.55), sunflowerGeo(17, 1.8), sunflowerGeo(29, 2.05)];
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78, side: THREE.DoubleSide });
    const lists = [[], [], []];
    const sunYaw = Math.atan2(SUN_DIR.x, SUN_DIR.z);
    for (const [row, t] of [[0, SUNFLOWER[0] + 0.4], [1, SUNFLOWER[1] - 0.45]]) {
      for (let w = CH.w1 + 0.9 + row * 0.25; w < BACK_W - 0.4; w += 0.48 + rnd() * 0.12) {
        if (Math.abs(w - F2) < FHW + 0.6) continue;
        if (rnd() < 0.05) continue;
        lists[Math.floor(rnd() * 3)].push([t + (rnd() - 0.5) * 0.2, w]);
      }
    }
    lists.forEach((list, v) => {
      const im = new THREE.InstancedMesh(geos[v], mat, list.length);
      list.forEach(([t, w], i) => {
        const [x, z] = W(t, w);
        qt.setFromAxisAngle(UP, sunYaw + (rnd() - 0.5) * 0.7);
        const s = 0.9 + rnd() * 0.2;
        im.setMatrixAt(i, m4.compose(vp.set(x, ground(x, z) - 0.05, z), qt, sc.set(s, s, s)));
      });
      im.computeBoundingSphere();
      im.castShadow = true; im.receiveShadow = true;
      im.name = 'sunflowers';
      group.add(im);
    });
    segs.add(...W((SUNFLOWER[0] + SUNFLOWER[1]) / 2, CH.w1 + 1), ...W((SUNFLOWER[0] + SUNFLOWER[1]) / 2, F2 - FHW - 0.6), 0.9);
    segs.add(...W((SUNFLOWER[0] + SUNFLOWER[1]) / 2, F2 + FHW + 0.6), ...W((SUNFLOWER[0] + SUNFLOWER[1]) / 2, BACK_W - 0.4), 0.9);
  }

  // ---- 電柱: 農道にそって奥へ ----
  {
    let prev = null, pr = 71;
    const rp = () => ((pr = (pr * 16807) % 2147483647) / 2147483647);
    const pt = F1 - FHW - 0.4;
    for (const w of [6.2, F2 - FHW - 0.9, 63.5]) {
      const [x, z] = W(pt, w), y = ground(x, z);
      k.chunk(x, z);
      const zAxis = new THREE.Vector3().crossVectors(TDIR, UP);
      const Mx = new THREE.Matrix4().makeBasis(TDIR, UP, zAxis).setPosition(x, y, z);
      const att = pole(k, Mx, rp, { transformer: w > 60, lamp: w < 10, plate: true });
      const wp = (p) => new THREE.Vector3(...p).applyMatrix4(Mx).toArray();
      const cur = { power: att.power.map(wp), tel: att.tel.map(wp) };
      segs.add(x, z, x, z, 0.2);
      // 道側の 1 本は props.js の buildPoles が道ぞいの列から引き込み線でつなぐ
      (ctx.fixedPoles ||= []).push({ x, z, ...cur, feed: !prev });
      if (prev) {
        k.at(new THREE.Matrix4()).color(new THREE.Color('#1e1e20'));
        for (let q = 0; q < Math.min(prev.power.length, cur.power.length); q++) wire(k, prev.power[q], cur.power[q], 0.011, 0.02);
        wire(k, prev.tel[0], cur.tel[0], 0.028, 0.03);
      }
      prev = cur;
    }
    k.at(new THREE.Matrix4());
  }

  // ---- 木: 公園と農道の間にケヤキ、田の角に柿の木のような庭木 ----
  if (forest) {
    const tree = (kind, t, w, s) => { const [x, z] = W(t, w); forest.add(kind, x, ground(x, z), z, s); };
    tree('b-keyaki', 33.2, 42.5, 0.85);
    tree('b-keyaki', 33.0, 50.5, 0.78);
    tree('b-oak', laneT(46) + ROAD_HW + 1.6, 46, 0.7);
  }

  for (const m of k.meshes()) group.add(m);

  // ---- 地形: 用水路の下を沈める（水路の中に地面が出ないように） ----
  {
    const grid = data.core, mesh = T.coreMesh, pos = mesh.geometry.attributes.position;
    const box = [W(t0 - 1, 0), W(t1 + 1, 0), W(t0 - 1, 5), W(t1 + 1, 5)];
    const xs = box.map((p) => p[0]), zs = box.map((p) => p[1]);
    const i0 = Math.max(0, Math.floor((Math.min(...xs) - grid.x0) / grid.step)), i1 = Math.min(grid.nx - 1, Math.ceil((Math.max(...xs) - grid.x0) / grid.step));
    const j0 = Math.max(0, Math.floor((Math.min(...zs) - grid.z0) / grid.step)), j1 = Math.min(grid.nz - 1, Math.ceil((Math.max(...zs) - grid.z0) / grid.step));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const x = grid.xOf(i), z = grid.zOf(j), [t, w] = TW(x, z);
      if (t < t0 - 0.8 || t > t1 + 0.8 || w < 0.8 || w > 4.6) continue;
      const kk = j * grid.nx + i, y = ground(x, z) - 1.25;
      if (pos.getY(kk) > y) pos.setY(kk, y);
    }
    pos.needsUpdate = true;
    mesh.geometry.computeVertexNormals();
  }

  // 苗の細かさを距離で切りかえる（毎フレーム）
  group.userData.update = (camera, player) => {
    oikawa.userData.update(TIME.value, camera, player);
    const cp = camera.position;
    for (const ch of chunks) {
      const d = Math.hypot(ch.x - cp.x, ch.z - cp.z, (ch.y - cp.y) * 0.5);
      const near = d < RICE_NEAR, far = !near && d < RICE_FAR;
      for (const im of ch.near) im.visible = near;
      for (const im of ch.far) im.visible = far;
    }
  };
  group.userData.stats = { ms: Math.round(performance.now() - t00), chunks: chunks.length, hills: chunks.reduce((a, c) => a + c.near.reduce((b, im) => b + im.count, 0), 0) };
  return group;
}
