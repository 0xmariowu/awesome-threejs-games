// 木（ブレス オブ ザ ワイルド風の試作）: 旧版 trees.js は残したまま、こちらで作り比べる
// ・樹冠は大きな「塊」（球）の集まり。葉の板は塊の表面に並べ、法線は塊の球の向き
//   → 塊ごとに日なた・日かげがはっきり分かれ、下の塊には上の塊の影が落ちる
// ・枝は塊の中心で止める（樹冠の手前に黒い枝が突き出さない）。幹の根元は根で張る
// ・葉のテクスチャは「葉の形」がふちに出る房。色はほぼ一様で、陰影は光で付ける
import * as THREE from 'three';
import { Geo, rngOf, tube, BILL_DECL, BILL_PROJECT } from './trees.js';
import { TEX } from './textures.js';
import { paint, FOCUS, OCCLUDE_HEAD, OCCLUDE_GLSL, occlude } from '../materials.js';

const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

// ---------- 葉のテクスチャ ----------
const texCache = new Map();
function canvasTex(name, N, draw) {
  if (texCache.has(name)) return texCache.get(name);
  const c = document.createElement('canvas');
  c.width = c.height = N;
  draw(c.getContext('2d'), N);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  texCache.set(name, t);
  return t;
}

// 1 枚の葉（根元が原点、+y へ伸びる）
function leafPath(g, L, W, tipCurl = 0) {
  g.beginPath();
  g.moveTo(0, 0);
  g.bezierCurveTo(W, L * 0.22, W * 0.85 + tipCurl, L * 0.72, tipCurl, L);
  g.bezierCurveTo(-W * 0.85 + tipCurl, L * 0.72, -W, L * 0.22, 0, 0);
}

// 広葉樹の房: 小枝に葉が互い違いに付き、外へ広がる。影の層を先に描いて奥行きを出す
function broadLeafTex(kind) {
  const P = {
    broad: { n: 24, leafL: 0.085, leafW: 0.4, per: 7, seed: 11 },
    keyaki: { n: 30, leafL: 0.06, leafW: 0.36, per: 9, seed: 23 },
    cherry: { n: 24, leafL: 0.09, leafW: 0.44, per: 6, seed: 37 },
    garden: { n: 30, leafL: 0.062, leafW: 0.55, per: 7, seed: 41 },
  }[kind];
  return canvasTex('bleaf-' + kind, 512, (g, N) => {
    const r = rngOf(P.seed);
    const leaves = [];
    for (let s = 0; s < P.n; s++) {
      const a = r() * Math.PI * 2;
      const bx = N / 2 + Math.cos(a) * N * 0.06 * r(), by = N / 2 + Math.sin(a) * N * 0.06 * r();
      const len = N * (0.26 + r() * 0.14);
      const bend = (r() - 0.5) * 0.6;
      for (let k = 0; k <= P.per; k++) {
        const t = 0.25 + (k / P.per) * 0.75;
        const aa = a + bend * t;
        const x = bx + Math.cos(aa) * len * t, y = by + Math.sin(aa) * len * t;
        const side = k === P.per ? 0 : k % 2 ? 1 : -1;
        const la = aa - Math.PI / 2 + side * (0.75 + r() * 0.35);
        const L = N * P.leafL * (0.75 + r() * 0.45) * (k === P.per ? 1.1 : 1);
        leaves.push([x, y, la, L, L * P.leafW * (0.85 + r() * 0.3), r(), (r() - 0.5) * L * 0.25]);
      }
    }
    // 房の芯（中は詰まっていて、ふちだけ葉の形が出る）
    g.fillStyle = 'rgb(170,186,146)';
    for (let k = 0; k < 9; k++) {
      const a = (k / 9) * Math.PI * 2, d = N * 0.1;
      g.beginPath(); g.arc(N / 2 + Math.cos(a) * d, N / 2 + Math.sin(a) * d, N * (0.2 + r() * 0.05), 0, Math.PI * 2); g.fill();
    }
    // 奥の葉の影（うすく）
    g.fillStyle = 'rgba(120,138,100,0.55)';
    for (const [x, y, la, L, W] of leaves) { g.save(); g.translate(x + 3, y + 5); g.rotate(la); leafPath(g, L, W); g.fill(); g.restore(); }
    for (const [x, y, la, L, W, v, curl] of leaves) {
      g.save(); g.translate(x, y); g.rotate(la);
      const lv = 0.92 + v * 0.14;
      const c0 = [196 * lv, 214 * lv, 168 * lv], c1 = [226 * lv, 236 * lv, 196 * lv];
      const grd = g.createLinearGradient(-W, 0, W, 0);
      grd.addColorStop(0, `rgb(${c0[0] | 0},${c0[1] | 0},${c0[2] | 0})`);
      grd.addColorStop(0.5, `rgb(${c1[0] | 0},${c1[1] | 0},${c1[2] | 0})`);
      grd.addColorStop(0.52, `rgb(${c0[0] * 0.92 | 0},${c0[1] * 0.94 | 0},${c0[2] * 0.9 | 0})`);
      grd.addColorStop(1, `rgb(${c0[0] * 0.84 | 0},${c0[1] * 0.86 | 0},${c0[2] * 0.82 | 0})`);
      g.fillStyle = grd;
      leafPath(g, L, W, curl);
      g.fill();
      g.restore();
    }
  });
}

// スギの枝葉: 左の根元から右の先へのびる 1 本の枝。両側に小枝が出て、針葉が詰まる
// （板は幹から外へ向けて固定で置く。u = 枝の根元→先、v = 枝の幅）
function sprayTex() {
  return canvasTex('spray', 512, (g, N) => {
    const r = rngOf(71);
    const axisY = (x) => N * 0.5 + Math.pow(x / N, 2) * N * 0.05;
    const halfW = (x) => N * 0.4 * Math.pow(Math.sin(Math.PI * Math.min(1, 0.14 + (x / N) * 0.9)), 0.7);
    // 芯（すき間を減らす）
    g.fillStyle = 'rgb(150,170,146)';
    g.beginPath();
    for (let x = N * 0.03; x <= N * 0.95; x += 8) g.lineTo(x, axisY(x) - halfW(x) * 0.5);
    for (let x = N * 0.95; x >= N * 0.03; x -= 8) g.lineTo(x, axisY(x) + halfW(x) * 0.5);
    g.fill();
    // 小枝（主枝から斜め前へ）
    const twigs = [[N * 0.02, axisY(0), 0, N * 0.93]];
    for (let x = N * 0.06; x < N * 0.9; x += N * 0.05) {
      for (const s of [-1, 1]) twigs.push([x, axisY(x), s * (0.8 + r() * 0.25), halfW(x) * (0.85 + r() * 0.25)]);
    }
    g.lineCap = 'round';
    for (const pass of [0, 1]) {
      for (const [bx, by, a, L] of twigs) {
        const steps = Math.max(3, Math.round(L / 7));
        for (let k = 0; k <= steps; k++) {
          const t = k / steps;
          const x = bx + Math.cos(a) * L * t, y = by + Math.sin(a) * L * t;
          // 針葉: 小枝のまわりに短い線を、先の方へ向けて
          for (let q = 0; q < 3; q++) {
            const na = a + (r() - 0.5) * 2.4, nl = N * 0.024 * (1 - t * 0.4) * (0.7 + r() * 0.5);
            const lv = 0.9 + r() * 0.18;
            g.strokeStyle = pass ? `rgb(${190 * lv | 0},${212 * lv | 0},${186 * lv | 0})` : 'rgba(110,130,108,0.5)';
            g.lineWidth = pass ? 3.2 : 4.5;
            const o = pass ? 0 : 3;
            g.beginPath(); g.moveTo(x + o, y + o); g.lineTo(x + o + Math.cos(na) * nl, y + o + Math.sin(na) * nl); g.stroke();
          }
        }
      }
    }
  });
}

// ヤシの葉（羽状の葉の片側）: u = 葉の根元→先、v = 中軸(v=0)→小葉の先(v=1)
// 小葉は先の方へ斜めに出る。小葉の間はうすい下地で埋め、遠くで（ミップで）葉がやせないようにする
function palmTex() {
  return canvasTex('palm', 512, (g, N) => {
    const r = rngOf(83);
    const y0 = N - 5; // 中軸（v=0 は画像の下端）
    const reach = (p) => (N - 14) * Math.min(1, p / 0.25) ** 0.8 * Math.pow(Math.max(0, 1 - p), 0.6) * (p < 0.06 ? 0.3 : 1);
    const leaflets = [];
    for (let x = N * 0.03; x < N * 0.985; x += 7 + r() * 2.4) {
      const p = x / N, R = reach(p) * (0.85 + r() * 0.2);
      // 中軸からの角度。板は長さ方向に約 5 倍のばされるので、画像の上では立てておく（実物で 35〜45°）
      const th = 1.36 + (r() - 0.5) * 0.12 - p * 0.12;
      leaflets.push([x, R, th, r()]);
    }
    // 下地（アルファ 0.3 → 近くでは切り抜かれ、遠くでは小葉と混ざって残る）
    g.fillStyle = 'rgba(150,172,120,0.3)';
    g.beginPath(); g.moveTo(0, y0);
    for (const [x, R, th] of leaflets) g.lineTo(x + Math.cos(th) * R * 0.95, y0 - Math.sin(th) * R * 0.95);
    g.lineTo(N, y0); g.closePath(); g.fill();
    const blade = (x, R, th, w) => {
      const tx = x + Math.cos(th) * R, ty = y0 - Math.sin(th) * R;
      const bx = x + Math.cos(th) * R * 0.5 + Math.cos(th - 1.57) * R * 0.04, by = y0 - Math.sin(th) * R * 0.5 + Math.sin(th - 1.57) * R * 0.04;
      const nx = Math.sin(th) * w, ny = Math.cos(th) * w;
      g.beginPath(); g.moveTo(x, y0);
      g.quadraticCurveTo(bx - nx, by - ny, tx + (r() - 0.5) * 2, ty);
      g.quadraticCurveTo(bx + nx, by + ny, x, y0);
      g.fill();
    };
    // 小葉の影 → 小葉
    // 影は下地と重なっても 0.5 未満（近くでは出ない）。遠くで小葉のすき間を少し暗くする
    g.fillStyle = 'rgba(96,116,80,0.25)';
    for (const [x, R, th] of leaflets) { g.save(); g.translate(3, 3); blade(x, R, th, 3.5); g.restore(); }
    for (const [x, R, th, v] of leaflets) {
      const lv = 0.9 + v * 0.16;
      const grd = g.createLinearGradient(0, y0, 0, y0 - R);
      grd.addColorStop(0, `rgb(${188 * lv | 0},${206 * lv | 0},${160 * lv | 0})`);
      grd.addColorStop(1, `rgb(${222 * lv | 0},${234 * lv | 0},${190 * lv | 0})`);
      g.fillStyle = grd;
      blade(x, R, th, 2.8);
    }
    // 中軸（根元ほど太い）とトゲ
    g.fillStyle = 'rgb(214,214,168)';
    g.beginPath(); g.moveTo(0, N); g.lineTo(0, N - 13); g.lineTo(N, N - 3); g.lineTo(N, N); g.fill();
    g.strokeStyle = 'rgb(200,196,150)'; g.lineWidth = 2;
    for (let x = 4; x < N * 0.07; x += 6) { g.beginPath(); g.moveTo(x, N - 8); g.lineTo(x + 7, N - 34 - r() * 10); g.stroke(); }
  });
}

// ---------- 幹・枝 ----------
// 根の張った幹。返り値は幹の点列と半径
function trunk(W, r, H, R0, lean, bendAmt = 0.08, taper = 0.45) {
  const n = Math.max(6, Math.ceil(H / 0.6));
  const pts = [], radii = [];
  let d = V3((r() - 0.5) * lean, 1, (r() - 0.5) * lean).normalize(), p = V3(0, -0.35, 0);
  for (let k = 0; k <= n; k++) {
    const t = k / n, y = p.y + 0.35;
    pts.push(p.clone());
    radii.push(R0 * (1 + 0.8 * Math.exp(-Math.max(y, 0) * 2.6)) * (1 - taper * t));
    d.add(V3(r() - 0.5, 0, r() - 0.5).multiplyScalar(bendAmt)).normalize();
    p = p.clone().addScaledVector(d, (H + 0.35) / n);
  }
  tube(W, pts, radii, FAR ? 6 : 12);
  // 根
  const nr = FAR ? 0 : 5;
  for (let k = 0; k < nr; k++) {
    const a = (k / nr) * Math.PI * 2 + r() * 0.6, L = R0 * (2.4 + r() * 1.4);
    const q = [V3(0, 0.5 * R0 * 2, 0), V3(Math.cos(a) * L * 0.45, 0.12, Math.sin(a) * L * 0.45), V3(Math.cos(a) * L, -0.12, Math.sin(a) * L)];
    tube(W, q, [R0 * 0.55, R0 * 0.38, R0 * 0.08], 6);
  }
  return { pts, radii, top: pts[pts.length - 1], dir: d };
}

// 2 点を結ぶ、少し曲がった枝
// bow: 途中をこの向きへふくらませる
function limb(W, r, a, b, r0, r1, lift = 0.3, bow = null) {
  const len = a.distanceTo(b);
  const n = Math.max(3, Math.ceil(len / 0.55));
  const mid = a.clone().lerp(b, 0.5).add(V3((r() - 0.5) * len * 0.15, lift * len * 0.2, (r() - 0.5) * len * 0.15));
  if (bow) mid.add(bow);
  const pts = [], radii = [];
  for (let k = 0; k <= n; k++) {
    const t = k / n;
    pts.push(a.clone().multiplyScalar((1 - t) * (1 - t)).addScaledVector(mid, 2 * t * (1 - t)).addScaledVector(b, t * t));
    radii.push(r0 + (r1 - r0) * t);
  }
  // 遠く用は細い枝を省く（形を決める乱数は同じように使う）
  if (!FAR || r0 >= 0.1) tube(W, pts, radii, FAR ? 4 : 7);
  return pts;
}

// ---------- 樹冠 ----------
// blobs: [{ c, r, sy }]。o.axial: 法線を幹の軸から外向きに（スギ）
// 遠く用（FAR）: 板を減らして大きくし、細い枝と根を省く
let FAR = false;
function crown(L, r, blobs, o) {
  const dens = o.density * (FAR ? 0.28 : 1), sizeK = o.size * (FAR ? 1.75 : 1);
  const cc = V3();
  let wsum = 0;
  for (const b of blobs) { const w = b.r ** 3; cc.addScaledVector(b.c, w); wsum += w; }
  cc.divideScalar(wsum);
  let y0 = Infinity, y1 = -Infinity;
  for (const b of blobs) { y0 = Math.min(y0, b.c.y - b.r * (b.sy ?? 1)); y1 = Math.max(y1, b.c.y + b.r * (b.sy ?? 1)); }
  const tint = new THREE.Color(o.tint), col = new THREE.Color(), hsl = {};
  const up = V3(0, 1, 0);
  for (const b of blobs) {
    const sy = b.sy ?? 1;
    // 塊ごとに色を少しずらす
    tint.getHSL(hsl);
    const bt = new THREE.Color().setHSL(hsl.h + (r() - 0.5) * 0.025, hsl.s * (0.9 + r() * 0.2), hsl.l * (0.92 + r() * 0.16));
    const n = Math.max(3, Math.round(dens * b.r * b.r * (0.6 + 0.4 * sy)));
    for (let k = 0; k < n; k++) {
      const dir = V3(r() * 2 - 1, r() * 2 - 1, r() * 2 - 1);
      if (dir.lengthSq() > 1 || dir.lengthSq() < 0.01) { k--; continue; }
      dir.normalize();
      const p = b.c.clone().add(V3(dir.x, dir.y * sy, dir.z).multiplyScalar(b.r * (0.62 + 0.38 * Math.sqrt(r()))));
      // 他の塊に埋もれる板は置かない
      if (blobs.some((q) => q !== b && p.distanceTo(q.c) < q.r * 0.7)) continue;
      const nc = o.axial ? V3(p.x, (p.y - cc.y) * 0.25 + 0.4, p.z).normalize() : p.clone().sub(cc).normalize();
      const nrm = dir.clone().multiplyScalar(0.62).addScaledVector(nc, 0.38).addScaledVector(up, 0.08).normalize();
      const outward = THREE.MathUtils.clamp(dir.dot(nc) * 0.5 + 0.5, 0, 1);
      const hN = THREE.MathUtils.clamp((p.y - y0) / (y1 - y0), 0, 1);
      const ao = (0.5 + 0.5 * outward) * (0.72 + 0.28 * hN);
      col.copy(bt).multiplyScalar(ao * (0.94 + r() * 0.12));
      const size = sizeK * b.r * (0.8 + r() * 0.4);
      const ang = o.upright ? (r() - 0.5) * o.upright : r() * Math.PI * 2, h = size / 2, base = L.count;
      for (const [a, c] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) L.v(p, nrm, (a + 1) / 2, (c + 1) / 2, col, [a, c, ang, h]);
      L.i.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  }
}

// ---------- 種類 ----------
// 広葉樹（クスノキ・シイのような、丸くこんもりした木）
function oak(r) {
  const W = new Geo(), L = new Geo(true, true);
  const T = trunk(W, r, 2.7, 0.3, 0.15);
  const C = V3(T.top.x, 5.8, T.top.z);
  const blobs = [{ c: C.clone().add(V3((r() - 0.5) * 0.6, 1.5, (r() - 0.5) * 0.6)), r: 2.0 }];
  const up3 = [], a0 = r() * 6.28;
  for (let k = 0; k < 3; k++) {
    const a = a0 + k * 2.1 + (r() - 0.5) * 0.5;
    const b = { c: C.clone().add(V3(Math.cos(a) * 1.7, 0.5 + r() * 0.4, Math.sin(a) * 1.7)), r: 1.75 + r() * 0.3 };
    blobs.push(b); up3.push(b);
  }
  const a1 = r() * 6.28;
  for (let k = 0; k < 5; k++) {
    const a = a1 + k * 1.26 + (r() - 0.5) * 0.4;
    blobs.push({ c: C.clone().add(V3(Math.cos(a) * 2.7, -0.7 + r() * 0.4, Math.sin(a) * 2.7)), r: 1.45 + r() * 0.35, sy: 0.85 });
  }
  // 枝: 幹の先から上の塊へ、その途中から下の塊へ
  const starts = up3.map((b) => limb(W, r, T.top, b.c, 0.2, 0.06, 0.4));
  limb(W, r, T.top, blobs[0].c, 0.16, 0.05);
  for (const b of blobs.slice(4)) {
    let best = starts[0], bd = Infinity;
    for (const s of starts) { const d = s[Math.floor(s.length / 2)].distanceTo(b.c); if (d < bd) { bd = d; best = s; } }
    limb(W, r, best[Math.floor(best.length / 3)], b.c, 0.1, 0.035, 0.2);
  }
  crown(L, r, blobs, { density: 16, size: 1.25, tint: '#78a94a' });
  return { wood: W.build(), leaves: L.build(), leaf: 'broad' };
}

// ケヤキ: 低い所で幹が分かれ、枝が扇のように上へ開く
function keyaki(r) {
  const W = new Geo(), L = new Geo(true, true);
  const T = trunk(W, r, 2.6, 0.32, 0.06);
  const blobs = [];
  const n = 7, a0 = r() * 6.28;
  for (let k = 0; k < n; k++) {
    const a = a0 + (k / n) * Math.PI * 2 + (r() - 0.5) * 0.35;
    const el = 1.02 + r() * 0.2, len = 5.6 + r() * 1.2;
    const out = V3(Math.cos(a), 0, Math.sin(a));
    const from = T.pts[T.pts.length - 1 - Math.floor(r() * 2.5)];
    const end = from.clone().addScaledVector(out, Math.cos(el) * len).add(V3(0, Math.sin(el) * len, 0));
    const pts = limb(W, r, from, end, 0.16, 0.05, -0.1, out.clone().multiplyScalar(len * 0.16));
    // 枝先の塊と、さらに外・上へ開いた塊（下の方の枝は見せる）
    blobs.push({ c: end.clone().addScaledVector(out, 0.3).add(V3(0, 0.7, 0)), r: 1.45 + r() * 0.3, sy: 0.9 });
    const c2 = end.clone().addScaledVector(out, 1.5).add(V3(0, 1.8 + r() * 0.6, 0));
    limb(W, r, pts[Math.floor(pts.length * 0.7)], c2, 0.07, 0.025);
    blobs.push({ c: c2, r: 1.3 + r() * 0.25, sy: 0.85 });
  }
  const top = T.top.clone().add(V3(0, 8.6, 0));
  limb(W, r, T.top, top, 0.12, 0.04);
  blobs.push({ c: top, r: 2.0 });
  for (let k = 0; k < 3; k++) {
    const a = a0 + k * 2.1 + 0.5;
    blobs.push({ c: top.clone().add(V3(Math.cos(a) * 1.8, -0.9, Math.sin(a) * 1.8)), r: 1.6 });
  }
  crown(L, r, blobs, { density: 18, size: 1.15, tint: '#8bb85a' });
  return { wood: W.build(), leaves: L.build(), leaf: 'keyaki' };
}

// 葉桜: 低い幹から枝が横へ大きく張り、平たい傘の樹冠
function cherry(r) {
  const W = new Geo(), L = new Geo(true, true);
  const T = trunk(W, r, 2.0, 0.34, 0.3, 0.12);
  const blobs = [];
  const n = 5, a0 = r() * 6.28;
  for (let k = 0; k < n; k++) {
    const a = a0 + (k / n) * Math.PI * 2 + (r() - 0.5) * 0.5;
    const el = 0.45 + r() * 0.35, len = 4.4 + r() * 1.2;
    const end = T.top.clone().add(V3(Math.cos(a) * Math.cos(el) * len, Math.sin(el) * len, Math.sin(a) * Math.cos(el) * len));
    const pts = limb(W, r, T.top, end, 0.2, 0.06, 0.6);
    blobs.push({ c: end.clone().add(V3(0, 0.4, 0)), r: 1.6 + r() * 0.3, sy: 0.7 });
    blobs.push({ c: pts[Math.floor(pts.length * 0.5)].clone().add(V3(0, 0.9, 0)), r: 1.4 + r() * 0.2, sy: 0.7 });
  }
  const top = T.top.clone().add(V3(0, 2.8, 0));
  limb(W, r, T.top, top, 0.14, 0.05);
  blobs.push({ c: top, r: 2.0, sy: 0.65 });
  crown(L, r, blobs, { density: 16, size: 1.25, tint: '#74a646' });
  return { wood: W.build(), leaves: L.build(), leaf: 'cherry' };
}

// 庭木（モチノキ・キンモクセイ）: 小さく、つやのある濃い緑の丸
function garden(r) {
  const W = new Geo(), L = new Geo(true, true);
  // 玉仕立て: まっすぐな幹から出た枝の先に、平たい丸い「玉」を載せる
  const T = trunk(W, r, 2.3, 0.1, 0.03, 0.04);
  const blobs = [{ c: T.top.clone().add(V3(0, 0.3, 0)), r: 0.7, sy: 0.55 }];
  const n = 4 + Math.floor(r() * 2), a0 = r() * 6.28;
  for (let k = 0; k < n; k++) {
    const t = 0.3 + (k / n) * 0.55;
    const from = T.pts[Math.round(t * (T.pts.length - 1))];
    const a = a0 + k * 2.4;
    const reach = 1.35 - t * 0.6;
    const c = from.clone().add(V3(Math.cos(a) * reach, 0.3 + r() * 0.2, Math.sin(a) * reach));
    limb(W, r, from, c, 0.05, 0.025, 0.5);
    blobs.push({ c, r: 0.5 + r() * 0.12, sy: 0.5 });
  }
  crown(L, r, blobs, { density: 80, size: 1.0, tint: '#4f8a3a' });
  return { wood: W.build(), leaves: L.build(), leaf: 'garden' };
}

// 枝葉の板 1 枚: 幹の点 B から向き dir へ長さ R、幅 w。先ほど垂れる。
// roll: 枝の軸まわりの傾き（2 枚を V 字に組む）。板は固定（カメラを向かない）
function sprayCard(L, B, dir, R, w, roll, droop, col0, up, shade) {
  const side = V3(-dir.z, 0, dir.x).normalize().applyAxisAngle(dir, roll);
  const segs = FAR ? 2 : 4, base = L.count, col = new THREE.Color();
  for (let k = 0; k <= segs; k++) {
    const u = k / segs;
    const c = B.clone().addScaledVector(dir, u * R).add(V3(0, -droop * u * u * R, 0));
    // 法線: 外向き＋上向き（円錐の面）。根元ほど暗い
    const n = V3(dir.x, 0, dir.z).normalize().multiplyScalar(0.7).add(V3(0, 0.75, 0)).normalize();
    col.copy(col0).multiplyScalar((0.5 + 0.5 * u) * shade);
    for (const v of [0, 1]) L.v(c.clone().addScaledVector(side, (v - 0.5) * w), n, u, v, col);
  }
  for (let k = 0; k < segs; k++) { const a = base + k * 2; L.i.push(a, a + 2, a + 3, a, a + 3, a + 1); }
}

// スギ: まっすぐな幹に、下ほど長い枝の段が円錐に重なる（枝葉は幹から外へ向けた板）
function sugi(r) {
  const W = new Geo(), L = new Geo(true);
  const H = 14 + r() * 2;
  const T = trunk(W, r, H, 0.34, 0.03, 0.02, 0.88);
  const tint = new THREE.Color('#4a7650'), col = new THREE.Color(), up = V3(0, 1, 0);
  const y0 = 3.2, step = 0.36;
  const tiers = Math.floor((H - 0.4 - y0) / step);
  for (let k = 0; k <= tiers; k++) {
    const t = k / tiers, y = y0 + k * step;
    const n = Math.round(5 + 3 * (1 - t));
    for (let q = 0; q < n; q++) {
      const a = k * 2.4 + (q / n) * Math.PI * 2 + (r() - 0.5) * 0.6;
      const R = (2.1 * Math.pow(1 - t, 0.9) + 0.4) * (0.85 + r() * 0.3);
      const slope = -(0.12 + 0.3 * (1 - t)) + (r() - 0.5) * 0.1;
      const dir = V3(Math.cos(a), slope, Math.sin(a)).normalize();
      const B = V3(T.top.x * (y / H), y, T.top.z * (y / H)).addScaledVector(V3(Math.cos(a), 0, Math.sin(a)), 0.04);
      const w = Math.min(1.3, 0.45 + R * 0.4);
      col.copy(tint).multiplyScalar(0.92 + r() * 0.16);
      const shade = 0.72 + 0.28 * t;
      sprayCard(L, B, dir, R, w, 0.55, 0.28, col, up, shade);
      if (!FAR) sprayCard(L, B, dir, R * 0.92, w * 0.9, -0.55, 0.28, col, up, shade);
    }
  }
  // 先端の若い枝（上向き）
  for (let q = 0; q < 3; q++) {
    const a = q * 2.1 + r();
    const dir = V3(Math.cos(a) * 0.35, 1, Math.sin(a) * 0.35).normalize();
    sprayCard(L, T.top.clone().add(V3(0, -0.5, 0)), dir, 0.75, 0.32, q * 1.05, 0, col.copy(tint), up, 1);
  }
  return { wood: W.build(), leaves: L.build(), leaf: 'spray', bill: false };
}

// ヤシの葉 1 枚: 根元 B から水平の向き h・仰角 el へ弓なりに伸び、先が垂れる。
// 中軸の両側に小葉の板を V 字に上げる（fold）。板は固定
function frond(L, B, h, el, len, droop, fold, w, col0, shade) {
  const segs = FAR ? 3 : 7, up = V3(0, 1, 0), col = new THREE.Color();
  const P = (u) => B.clone().addScaledVector(h, Math.cos(el) * len * u).add(V3(0, Math.sin(el) * len * u - droop * len * u * u, 0));
  const side = V3(-h.z, 0, h.x);
  if (FAR) fold = 0.1; // 遠く用は平らに近く
  for (const s of [-1, 1]) {
    const base = L.count;
    for (let k = 0; k <= segs; k++) {
      const u = k / segs, c = P(u);
      const tan = P(Math.min(1, u + 0.05)).sub(P(Math.max(0, u - 0.05))).normalize();
      const nUp = up.clone().addScaledVector(tan, -tan.y).normalize(); // 葉の面の上向き
      const wing = side.clone().multiplyScalar(s * Math.cos(fold)).addScaledVector(nUp, Math.sin(fold));
      const nrm = nUp.clone().multiplyScalar(0.8).addScaledVector(h, 0.45).normalize();
      col.copy(col0).multiplyScalar((0.55 + 0.45 * Math.min(1, u * 1.6)) * shade);
      const ww = w * (0.55 + 0.45 * Math.sin(Math.PI * Math.min(1, 0.25 + u * 0.8)));
      L.v(c, nrm, u, 0, col);
      L.v(c.clone().addScaledVector(wing, ww), nrm, u, 1, col);
    }
    for (let k = 0; k < segs; k++) { const a = base + k * 2; L.i.push(a, a + 2, a + 3, a, a + 3, a + 1); }
  }
}

// ヤシ（カナリーヤシ）: 太い幹は古い葉の付け根で段々になり、
// 頭に弓なりの羽状の葉がこんもりと集まる。下の段ほど垂れて暗く、いちばん下に枯れ葉
function palm(r) {
  const W = new Geo(), L = new Geo(true);
  const H = 5.2 + r() * 1.4, R0 = 0.42;
  const lean = V3((r() - 0.5) * 0.12, 1, (r() - 0.5) * 0.12).normalize();
  // 幹: 段ごとに「細い → 太い」をくり返す（葉の付け根のうろこ）。根元は広がり、頭はふくらむ
  const pts = [], radii = [];
  const ring = FAR ? 0.9 : 0.3;
  const put = (yy) => {
    const t = Math.max(0, yy) / H, bend = Math.sin(t * 1.3) * 0.35;
    pts.push(V3(lean.x * (yy + bend * 4), yy, lean.z * (yy + bend * 4)));
    return R0 * (1 + 0.55 * Math.exp(-Math.max(yy, 0) * 2.2)) * (1 + 0.28 * Math.max(0, (t - 0.82) / 0.18));
  };
  for (let y = -0.3; y < H - ring * 0.5; y += ring) {
    if (FAR) { radii.push(put(y)); continue; }
    radii.push(put(y) * 0.92);
    radii.push(put(y + ring * 0.8) * 1.06);
  }
  radii.push(put(H) * 0.8);
  tube(W, pts, radii, FAR ? 8 : 14);
  const T = pts[pts.length - 1].clone();
  // 葉を落とした付け根（頭の下に短く突き出す）
  if (!FAR) {
    for (let k = 0; k < 14; k++) {
      const a = k * 2.4 + r() * 0.4, y = T.y - 0.25 - r() * 0.7;
      const o = V3(Math.cos(a), 0, Math.sin(a));
      const b = V3(T.x, y, T.z).addScaledVector(o, R0 * 1.1);
      tube(W, [b, b.clone().addScaledVector(o, 0.32).add(V3(0, 0.12, 0)), b.clone().addScaledVector(o, 0.5).add(V3(0, 0.3, 0))], [0.11, 0.08, 0.03], 5);
    }
  }
  // 葉: [本数, 仰角, 長さ, 垂れ, 明るさ, 色]
  const green = new THREE.Color('#79a24a'), young = new THREE.Color('#9dbb5c'), dead = new THREE.Color('#a8905e');
  const tiers = [
    [7, [1.05, 1.35], [2.4, 3.0], 0.08, 1.1, young, 0.25],
    [15, [0.55, 0.85], [3.7, 4.3], 0.28, 1.0, green, 0.1],
    [16, [0.12, 0.38], [4.0, 4.6], 0.38, 0.86, green, -0.05],
    [12, [-0.3, -0.05], [3.6, 4.2], 0.32, 0.72, green, -0.2],
    [6, [-1.25, -0.95], [2.4, 3.0], 0.05, 0.85, dead, -0.4],
  ];
  let a0 = r() * 6.28;
  for (const [n, [e0, e1], [l0, l1], droop, shade, c, dy] of tiers) {
    if (FAR && c === dead) continue;
    a0 += 0.9;
    for (let k = 0; k < n; k++) {
      const a = a0 + (k / n) * Math.PI * 2 + (r() - 0.5) * 0.35;
      const h = V3(Math.cos(a), 0, Math.sin(a));
      const B = T.clone().addScaledVector(h, 0.25).add(V3(0, dy + (r() - 0.5) * 0.15, 0));
      const len = l0 + r() * (l1 - l0);
      const cc = c.clone().multiplyScalar(0.93 + r() * 0.14);
      frond(L, B, h, e0 + r() * (e1 - e0), len, droop * (0.8 + r() * 0.4), c === dead ? 0.15 : 0.42, len * 0.21, cc, shade);
    }
  }
  const wood = W.build();
  if (!FAR) wood.computeVertexNormals(); // 段々の陰影を出す
  return { wood, leaves: L.build(), leaf: 'palm', bill: false };
}

const MAKERS = { 'b-oak': oak, 'b-keyaki': keyaki, 'b-cherry': cherry, 'b-garden': garden, 'b-sugi': sugi, 'b-palm': palm };
export const isTree2 = (kind) => kind in MAKERS;

// 樹冠の大きさ（大きさ 1 のとき）: [横の半径 m, 葉の下端の高さ m]。家との当たりを調べるのに使う
export const CROWN = {
  'b-oak': [4.5, 4.1], 'b-keyaki': [6.2, 7.1], 'b-cherry': [6.2, 3.9], 'b-garden': [1.7, 0.7], 'b-sugi': [2.9, 2.7], 'b-palm': [4.4, 3.4],
};

// far: 遠く用の軽い樹冠（形は同じ乱数で作るので、近く用と同じ木になる）
export function makeTree2(kind, seed = 1, far = false) {
  FAR = far;
  const t = MAKERS[kind](rngOf(seed * 13 + kind.length * 71));
  FAR = false;
  t.bill ??= true;
  t.mats = treeMaterials2(t.leaf);
  return t;
}

// ---------- マテリアル ----------
// 風: 木全体がゆっくり少しだけゆれる。bill（カメラを向く板）のときだけ、板ごとのわずかなふるえを足す
const wind = (bill) => /* glsl */ `
  {
    vec3 ip = vec3(0.0);
    #ifdef USE_INSTANCING
      ip = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
    #endif
    float hgt = max(position.y - 1.2, 0.0);
    float ph = uTime * 0.5 + ip.x * 0.13 + ip.z * 0.11;
    transformed.x += (sin(ph) * 0.7 + sin(ph * 1.9 + 1.3) * 0.3) * 0.003 * hgt;
    transformed.z += cos(ph * 0.83 + 0.7) * 0.002 * hgt;
    transformed += vec3(sin(uTime * 0.8 + position.y * 0.9 + position.x * 0.4), 0.0, cos(uTime * 0.7 + position.x * 0.7)) * 0.012 * min(hgt, 2.0);
    ${bill ? 'transformed += vec3(sin(uTime * 2.2 + position.x * 7.1 + position.z * 3.7), 0.0, cos(uTime * 1.9 + position.y * 5.3)) * 0.004;' : ''}
  }
`;

const matCache2 = {};
export function treeMaterials2(leafKind) {
  if (matCache2[leafKind]) return matCache2[leafKind];
  const bill = leafKind !== 'spray' && leafKind !== 'palm';
  const bark = TEX.bark();
  const wood = occlude(new THREE.MeshStandardMaterial({ map: bark.map, normalMap: bark.normalMap, roughness: 0.95, color: leafKind === 'spray' ? '#c8a58e' : leafKind === 'palm' ? '#d2bc98' : leafKind === 'cherry' ? '#b8a6a0' : '#d6cabc' }), 'wood2-' + leafKind);
  const map = leafKind === 'spray' ? sprayTex() : leafKind === 'palm' ? palmTex() : broadLeafTex(leafKind);
  const leaves = new THREE.MeshStandardMaterial({ map, alphaTest: 0.5, side: THREE.DoubleSide, roughness: leafKind === 'garden' ? 0.68 : 0.8, vertexColors: true });
  paint(leaves, {
    amp: 0.04, scale: 0.5, key: 'leaf2-' + leafKind,
    attrs: bill ? BILL_DECL : '', vars: 'varying vec2 vCardOff;',
    uniforms: { uFocus: FOCUS }, fragHead: OCCLUDE_HEAD,
    vtxPre: wind(bill),
    after: (sh) => {
      if (bill) {
        sh.vertexShader = sh.vertexShader.replace(/#include <project_vertex>/, BILL_PROJECT + `
          vCardOff = vec2(aCard.x * cos(aCard.z) - aCard.y * sin(aCard.z), aCard.x * sin(aCard.z) + aCard.y * cos(aCard.z));`);
      }
      // bill: 板 1 枚ずつを小さな球のように陰らせ、となりの板となじませる
      // 固定の板: 裏から見ても法線を裏返さない（枝葉の段の陰影をそろえる）
      sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_begin>', `#include <normal_fragment_begin>
        ${bill ? 'normal = normalize(normal + vec3(vCardOff * 0.6, 0.0));' : 'normal = normalize(vNormal);'}
        nonPerturbedNormal = normal;`);
    },
    frag: /* glsl */ `
      {
        // 逆光で葉が透ける
        float back = pow(max(dot(normalize(vWP - cameraPosition), normalize(vec3(0.42, 0.78, 0.46))), 0.0), 3.0);
        diffuseColor.rgb += diffuseColor.rgb * vec3(0.5, 0.7, 0.2) * back * 0.5;
      }
      ${OCCLUDE_GLSL}`,
  });
  const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map, alphaTest: 0.5, side: THREE.DoubleSide });
  if (bill) {
    depth.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\n' + BILL_DECL)
        .replace('#include <project_vertex>', BILL_PROJECT);
    };
  }
  matCache2[leafKind] = { wood, leaves, depth, leafShadow: true };
  return matCache2[leafKind];
}

