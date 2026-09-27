// 葉のアトラス（Canvasで一枚ずつ描く）：5×5タイル。枝先の小枝に葉・花が付いた「房」を描く
// 葉は一枚ずつ輪郭（鋸歯）・葉柄・主脈と側脈・表裏の明暗を持ち、奥の葉ほど暗く描いて房の中の奥行きを焼き込む
import * as THREE from 'three';
import { mulberry32 } from '../util/noise.js';

export const TILE = {
  OAK: 0, EVERGREEN: 1, SAKURA: 2, YAMAZAKURA: 3,
  KOBUSHI: 4, CEDAR: 5, BAMBOO: 6, WILLOW: 7,
  KAKI: 8, CAMELLIA: 9, KEYAKI: 10, SHRUB: 11,
  OAK_DENSE: 12, SAKURA_DENSE: 13, CEDAR_DENSE: 14, EVER_DENSE: 15,
  TSUTSUJI: 16, FUJI: 17,
  YAMA_DENSE: 18, KOBUSHI_DENSE: 19, BAMBOO_DENSE: 20, SHRUB_DENSE: 21,
  OAK2: 22, OAK2_DENSE: 23, KEYAKI_DENSE: 24,
};
export const ATLAS_N = 5;

function hsl(h, s, l, a = 1) { return `hsla(${h},${Math.max(0, Math.min(100, s))}%,${Math.max(0, Math.min(100, l))}%,${a})`; }

export function buildLeafAtlas(size = 2560) {
  const T = size / ATLAS_N;
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const ctx = cv.getContext('2d');
  const r = mulberry32(4242);
  const avg = [];
  const TAU = Math.PI * 2;

  // ---- 一枚の葉 ----
  // 付け根(x,y)から角度angへ。shape: 葉の幅の分布、serr: 鋸歯の深さ、c: {h,s,l}
  const PROF = {
    ovate: (t) => Math.pow(Math.sin(Math.PI * Math.pow(t, 0.75)), 0.9),
    obovate: (t) => Math.pow(Math.sin(Math.PI * Math.pow(t, 1.35)), 0.85),
    ellip: (t) => Math.pow(Math.sin(Math.PI * t), 0.8),
    lance: (t) => Math.pow(Math.sin(Math.PI * Math.pow(t, 0.6)), 1.3),
    needle: (t) => Math.pow(Math.sin(Math.PI * t), 0.5),
  };
  const leaf = (x, y, len, wid, ang, c, o = {}) => {
    const prof = PROF[o.shape || 'ellip'];
    const pet = o.pet ?? 0.12;
    const serr = o.serr || 0, teeth = o.teeth || 14;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    // 葉を少し斜めから見た向き（幅を縮める）と、先の反り
    const sq = o.sq ?? 1;
    if (pet > 0) {
      ctx.strokeStyle = hsl(c.h - 8, c.s * 0.6, c.l * 0.7);
      ctx.lineWidth = Math.max(0.7, wid * 0.1);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(len * pet, 0); ctx.stroke();
    }
    const x0 = len * pet, L = len * (1 - pet);
    const N = 22;
    const bend = (o.bend || 0) * wid;
    const edge = (t, side) => {
      let w = prof(t) * wid * sq;
      if (serr > 0 && t > 0.12 && t < 0.97) { const f = (t * teeth) % 1; w *= 1 - serr * 0.16 * (f < 0.7 ? f / 0.7 : (1 - f) / 0.3); }
      return [x0 + t * L, side * w + bend * t * t];
    };
    ctx.beginPath();
    ctx.moveTo(x0, 0);
    for (let i = 1; i <= N; i++) { const [px, py] = edge(i / N, -1); ctx.lineTo(px, py); }
    for (let i = N - 1; i >= 1; i--) { const [px, py] = edge(i / N, 1); ctx.lineTo(px, py); }
    ctx.closePath();
    // 表の明暗：片側が明るい（葉の折れ）＋先が少し明るい（透ける）
    const lit = o.lit ?? 0;
    const g = ctx.createLinearGradient(0, -wid * sq, 0, wid * sq);
    g.addColorStop(0, hsl(c.h, c.s, c.l + 6 + lit));
    g.addColorStop(0.48, hsl(c.h, c.s, c.l + 2 + lit));
    g.addColorStop(0.52, hsl(c.h + 2, c.s + 4, c.l - 5 + lit));
    g.addColorStop(1, hsl(c.h + 3, c.s + 6, c.l - 9 + lit));
    ctx.fillStyle = g;
    ctx.fill();
    // 艶（常緑・椿）：葉の片側に淡い光
    if (o.gloss) {
      const gg = ctx.createLinearGradient(x0, -wid * sq, x0 + L * 0.8, 0);
      gg.addColorStop(0, `rgba(255,255,240,0)`); gg.addColorStop(0.5, `rgba(235,245,230,${o.gloss})`); gg.addColorStop(1, `rgba(255,255,240,0)`);
      ctx.fillStyle = gg; ctx.fill();
    }
    // 主脈・側脈
    if (len > 9 && o.vein !== false) {
      ctx.strokeStyle = hsl(c.h - 4, c.s * 0.7, c.l + 16, 0.55);
      ctx.lineWidth = Math.max(0.5, wid * 0.07);
      ctx.beginPath(); ctx.moveTo(x0, 0);
      for (let i = 1; i <= 6; i++) { const t = i / 6 * 0.94; ctx.lineTo(x0 + t * L, bend * t * t); }
      ctx.stroke();
      if (len > 20) {
        ctx.strokeStyle = hsl(c.h - 4, c.s * 0.7, c.l + 12, 0.28);
        ctx.lineWidth = Math.max(0.4, wid * 0.035);
        const nv = o.veins || 6;
        for (let i = 1; i <= nv; i++) {
          const t = i / (nv + 1.3);
          const w = prof(t + 0.1) * wid * sq * 0.85;
          for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(x0 + t * L, bend * t * t); ctx.lineTo(x0 + (t + 0.13) * L, sd * w + bend * t * t); ctx.stroke(); }
        }
      }
    }
    ctx.restore();
  };
  const twigLine = (pts, w0, w1, col) => {
    ctx.strokeStyle = col; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (let q = 0; q < pts.length - 1; q++) {
      ctx.lineWidth = w0 + (w1 - w0) * q / Math.max(1, pts.length - 2);
      ctx.beginPath(); ctx.moveTo(pts[q][0], pts[q][1]); ctx.lineTo(pts[q + 1][0], pts[q + 1][1]); ctx.stroke();
    }
  };
  // 曲がりながら伸びる小枝の点列
  const walk = (x, y, a, len, n, wob) => {
    const pts = [[x, y]];
    for (let q = 0; q < n; q++) { a += (r() - 0.5) * wob; x += Math.cos(a) * len / n; y += Math.sin(a) * len / n; pts.push([x, y]); }
    return pts;
  };
  const at = (pts, t) => {
    const f = t * (pts.length - 1), i = Math.min(pts.length - 2, Math.floor(f)), u = f - i;
    const p0 = pts[i], p1 = pts[i + 1];
    return [p0[0] + (p1[0] - p0[0]) * u, p0[1] + (p1[1] - p0[1]) * u, Math.atan2(p1[1] - p0[1], p1[0] - p0[0])];
  };

  // ---- 花 ----
  // 5弁の花（桜・躑躅）：花びらは付け根が濃く縁が白い。sq で横から見た潰れ
  const flower = (x, y, rad, rot, o) => {
    const sq = o.sq ?? 1;
    ctx.save(); ctx.translate(x, y); ctx.rotate(o.tilt || 0); ctx.scale(1, sq); ctx.rotate(rot);
    const np = o.petals || 5;
    for (let p = 0; p < np; p++) {
      const a = p * TAU / np + (r() - 0.5) * 0.18;
      ctx.save(); ctx.rotate(a);
      const pr = rad * (0.9 + r() * 0.18);
      const pw = o.pw || 0.56;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(pr * 0.25, -pr * pw, pr * 1.02, -pr * pw * 0.95, pr, -0.07 * pr);
      if (o.notch) { ctx.lineTo(pr * 0.87, 0.02 * pr); ctx.lineTo(pr, 0.1 * pr); }
      ctx.bezierCurveTo(pr * 1.02, pr * pw * 0.95, pr * 0.25, pr * pw, 0, 0);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, pr);
      g.addColorStop(0, o.base); g.addColorStop(0.45, o.mid); g.addColorStop(1, o.edge);
      ctx.fillStyle = g; ctx.fill();
      ctx.restore();
    }
    // 花芯：雄しべ（細い線と先の点）
    if (o.stamen) {
      ctx.strokeStyle = o.stamen; ctx.lineWidth = Math.max(0.5, rad * 0.04);
      const ns = o.ns || 12;
      for (let k = 0; k < ns; k++) {
        const a = r() * TAU, l = rad * (0.3 + r() * 0.25);
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * l, Math.sin(a) * l); ctx.stroke();
        ctx.beginPath(); ctx.arc(Math.cos(a) * l, Math.sin(a) * l, Math.max(0.6, rad * 0.05), 0, TAU); ctx.fillStyle = o.anther; ctx.fill();
      }
    }
    ctx.beginPath(); ctx.arc(0, 0, rad * 0.12, 0, TAU); ctx.fillStyle = o.eye; ctx.fill();
    ctx.restore();
  };

  // 葉の房を1タイルに描く
  const drawTile = (ti, fn) => {
    const ox = (ti % ATLAS_N) * T, oy = Math.floor(ti / ATLAS_N) * T;
    ctx.save();
    ctx.beginPath(); ctx.rect(ox, oy, T, T); ctx.clip();
    ctx.translate(ox, oy);
    fn(T);
    ctx.restore();
  };

  // ---- 広葉の房：中心から数本の小枝が伸び、節ごとに互い違いに葉が付く ----
  // 葉をいったん集めて奥→手前の順に描き、奥ほど暗くする
  const spray = (S, o) => {
    const cx = S / 2, cy = S / 2;
    const items = [];
    const twigCol = o.twigCol || 'rgba(78,60,44,1)';
    for (let k = 0; k < o.twigs; k++) {
      const a0 = (k / o.twigs) * TAU + (r() - 0.5) * 0.9;
      const len = S * o.reach * (0.75 + r() * 0.3);
      const pts = walk(cx + (r() - 0.5) * S * 0.06, cy + (r() - 0.5) * S * 0.06, a0, len, 6, 0.35);
      twigLine(pts, S * 0.011, S * 0.004, twigCol);
      const nn = o.nodes;
      for (let q = 0; q < nn; q++) {
        const t = 0.22 + 0.78 * (q + r() * 0.5) / nn;
        const [px, py, ta] = at(pts, t);
        // 節から出る短い脇枝
        if (o.side && r() < o.side) {
          const sa = ta + (q % 2 ? 1 : -1) * (0.6 + r() * 0.4);
          const sp2 = walk(px, py, sa, len * 0.35, 3, 0.3);
          twigLine(sp2, S * 0.005, S * 0.003, twigCol);
          for (let m = 1; m <= 3; m++) { const [qx, qy, qa] = at(sp2, m / 3.2); items.push({ x: qx, y: qy, a: qa + (m % 2 ? 0.8 : -0.8) * (0.6 + r() * 0.5), s: 0.7 + r() * 0.3, d: r() }); }
        }
        const per = o.perNode || 1;
        for (let m = 0; m < per; m++) {
          const side = (q + m) % 2 ? 1 : -1;
          items.push({ x: px, y: py, a: ta + side * (0.5 + r() * 0.7), s: (0.65 + 0.35 * t) * (0.8 + r() * 0.35), d: r() });
        }
      }
      // 枝先の葉（新しく小さい）
      const [ex, ey, ea] = at(pts, 1);
      for (let m = 0; m < (o.tip || 2); m++) items.push({ x: ex, y: ey, a: ea + (r() - 0.5) * 0.9, s: 0.55 + r() * 0.25, d: 0.6 + r() * 0.4, tip: 1 });
    }
    items.sort((a, b) => a.d - b.d);
    for (const it of items) o.draw(it, S);
  };

  // ---- 密な房（中景・遠景用）：いくつかの塊。塊ごとに上が明るく下と奥が暗い ----
  const massTile = (S, o) => {
    const cx = S / 2, cy = S / 2;
    const clumps = [];
    for (let k = 0; k < o.clumps; k++) {
      const a = r() * TAU, d = Math.sqrt(r()) * S * o.spread;
      clumps.push({ x: cx + Math.cos(a) * d, y: cy + Math.sin(a) * d * 0.9, rad: S * o.clumpR * (0.7 + r() * 0.5) });
    }
    clumps.sort((a, b) => b.y - a.y);
    // 塊の間の小枝（隙間から見える暗い枝）
    for (let k = 0; k < o.clumps; k++) {
      const c = clumps[k];
      twigLine([[cx, cy], [(cx + c.x) / 2 + (r() - 0.5) * S * 0.05, (cy + c.y) / 2], [c.x, c.y]], S * 0.012, S * 0.005, o.twigCol || 'rgba(64,50,38,1)');
    }
    const items = [];
    for (const c of clumps) {
      for (let i = 0; i < o.per; i++) {
        const a = r() * TAU, d = Math.pow(r(), 0.6) * c.rad;
        const x = c.x + Math.cos(a) * d, y = c.y + Math.sin(a) * d * 0.85;
        // 明るさ：塊の上・外側が明るい
        const up = (c.y - y) / c.rad, out = d / c.rad;
        items.push({ x, y, a: r() * TAU, s: 0.75 + r() * 0.5, d: out * 0.55 + r() * 0.45, shade: 0.5 + 0.35 * up + 0.25 * out });
      }
    }
    items.sort((a, b) => a.d - b.d);
    for (const it of items) o.draw(it, S);
  };

  // ---- 色の決め方：奥（d小）ほど暗い ----
  const depthL = (it, k = 14) => (it.d - 0.6) * k + (it.shade !== undefined ? (it.shade - 0.6) * 22 : 0);

  // 0 コナラの新緑：鋸歯のある倒卵形、黄緑〜若草、銀色の毛で白っぽい若葉も
  const oakDraw = (hue, sat) => (it, S) => {
    const young = it.tip || r() < 0.2;
    const c = { h: hue + (r() - 0.5) * 14 + (young ? -6 : 0), s: sat + (r() - 0.5) * 12 - (young ? 10 : 0), l: 38 + (r() - 0.5) * 10 + depthL(it) + (young ? 8 : 0) };
    leaf(it.x, it.y, S * 0.1 * it.s, S * 0.034 * it.s, it.a, c, { shape: 'obovate', serr: 0.8, teeth: 9, pet: 0.06, sq: 0.55 + r() * 0.45, bend: (r() - 0.5) * 0.6, veins: 7 });
  };
  drawTile(TILE.OAK, (S) => spray(S, { twigs: 8, reach: 0.41, nodes: 9, perNode: 1, side: 0.6, tip: 3, draw: oakDraw(76, 50) }));
  drawTile(TILE.OAK_DENSE, (S) => massTile(S, { clumps: 11, spread: 0.3, clumpR: 0.15, per: 55, draw: (it, S2) => {
    const c = { h: 76 + (r() - 0.5) * 16, s: 50 + (r() - 0.5) * 12, l: 36 + (r() - 0.5) * 8 + depthL(it, 10) };
    leaf(it.x, it.y, S2 * 0.075 * it.s, S2 * 0.03 * it.s, it.a, c, { shape: 'obovate', serr: 0.6, teeth: 8, pet: 0.05, sq: 0.6 + r() * 0.4, vein: false });
  } }));
  // 22 クヌギ・ヤマザクラ以外の雑木（細長い鋸歯の葉、少し黄みが強い）
  const oak2Draw = (it, S) => {
    const c = { h: 66 + (r() - 0.5) * 12, s: 56 + (r() - 0.5) * 12, l: 40 + (r() - 0.5) * 10 + depthL(it) + (it.tip ? 7 : 0) };
    leaf(it.x, it.y, S * 0.12 * it.s, S * 0.026 * it.s, it.a, c, { shape: 'lance', serr: 0.9, teeth: 16, pet: 0.08, sq: 0.55 + r() * 0.45, bend: (r() - 0.5) * 0.8, veins: 9 });
  };
  drawTile(TILE.OAK2, (S) => spray(S, { twigs: 8, reach: 0.42, nodes: 9, perNode: 1, side: 0.5, tip: 2, draw: oak2Draw }));
  drawTile(TILE.OAK2_DENSE, (S) => massTile(S, { clumps: 10, spread: 0.3, clumpR: 0.16, per: 50, draw: (it, S2) => {
    const c = { h: 66 + (r() - 0.5) * 14, s: 55 + (r() - 0.5) * 12, l: 38 + (r() - 0.5) * 8 + depthL(it, 10) };
    leaf(it.x, it.y, S2 * 0.09 * it.s, S2 * 0.022 * it.s, it.a, c, { shape: 'lance', serr: 0.5, pet: 0.05, sq: 0.6 + r() * 0.4, vein: false });
  } }));
  // 1 常緑（カシ・シイ）：濃い緑の艶のある楕円葉、枝先に金色がかった新芽
  const everDraw = (k) => (it, S) => {
    const young = it.tip && r() < 0.7;
    const c = young ? { h: 58 + r() * 10, s: 50, l: 44 + depthL(it) } : { h: 108 + (r() - 0.5) * 18, s: 38 + (r() - 0.5) * 10, l: 22 + (r() - 0.5) * 6 + depthL(it, 12) };
    leaf(it.x, it.y, S * 0.1 * it.s * k, S * 0.035 * it.s * k, it.a, c, { shape: 'ellip', serr: young ? 0 : 0.25, teeth: 10, pet: 0.1, gloss: young ? 0 : 0.22 + r() * 0.15, sq: 0.5 + r() * 0.5, veins: 6 });
  };
  drawTile(TILE.EVERGREEN, (S) => spray(S, { twigs: 8, reach: 0.41, nodes: 9, perNode: 1, side: 0.6, tip: 4, draw: everDraw(1) }));
  drawTile(TILE.EVER_DENSE, (S) => massTile(S, { clumps: 11, spread: 0.3, clumpR: 0.15, per: 55, draw: (it, S2) => {
    const young = r() < 0.12 && it.shade > 0.7;
    const c = young ? { h: 60, s: 45, l: 42 } : { h: 108 + (r() - 0.5) * 18, s: 36, l: 21 + (r() - 0.5) * 5 + depthL(it, 10) };
    leaf(it.x, it.y, S2 * 0.075 * it.s, S2 * 0.028 * it.s, it.a, c, { shape: 'ellip', pet: 0.06, gloss: 0.18, sq: 0.6 + r() * 0.4, vein: false });
  } }));

  // 2 染井吉野：小枝の節ごとに3〜5輪の花がまとまって咲く（散房）。花はほぼ白で付け根が淡い紅、芯は赤い
  const sakuraFlower = (x, y, rad, depth) => {
    const l = 90 + depth * 7 - (1 - depth) * 5;
    flower(x, y, rad, r() * TAU, {
      sq: 0.45 + r() * 0.55, tilt: r() * TAU, notch: true, pw: 0.6,
      base: hsl(338, 62, 74 + depth * 6), mid: hsl(345, 52, l - 2), edge: hsl(350, 40 + r() * 20, Math.min(98, l + 3)),
      stamen: hsl(340, 45, 70, 0.9), anther: hsl(45, 70, 62), eye: hsl(338, 70, 48), ns: 10,
    });
  };
  const sakuraTile = (S, twigN, clN, dense) => {
    const cx = S / 2, cy = S / 2;
    const items = [];
    for (let k = 0; k < twigN; k++) {
      const a0 = (k / twigN) * TAU + r() * 0.7;
      const pts = walk(cx + (r() - 0.5) * S * 0.06, cy + (r() - 0.5) * S * 0.06, a0, S * (0.36 + r() * 0.1), 7, 0.5);
      twigLine(pts, S * 0.009, S * 0.0035, 'rgba(78,56,52,1)');
      // 脇の細い枝
      for (let q = 0; q < 2; q++) {
        const [px, py, ta] = at(pts, 0.3 + r() * 0.5);
        const sp2 = walk(px, py, ta + (r() < 0.5 ? -1 : 1) * (0.5 + r() * 0.4), S * 0.14, 3, 0.4);
        twigLine(sp2, S * 0.0045, S * 0.0025, 'rgba(84,60,56,1)');
        pts.push(...sp2.slice(1));
      }
      for (let c = 0; c < clN; c++) {
        const [px, py] = pts[1 + Math.floor(r() * (pts.length - 1))];
        const nf = 3 + Math.floor(r() * 3);
        const depth = r();
        for (let m = 0; m < nf; m++) {
          // 花柄で少し離れた位置に
          const a = r() * TAU, d = S * (0.02 + r() * 0.03);
          const fx = px + Math.cos(a) * d, fy = py + Math.sin(a) * d;
          items.push({ px, py, fx, fy, d: depth * 0.7 + r() * 0.3, bud: r() < 0.07 });
        }
        if (!dense && r() < 0.1) items.push({ px, py, fx: px, fy: py, d: depth * 0.5, leaf: 1 });
      }
    }
    items.sort((a, b) => a.d - b.d);
    for (const it of items) {
      if (it.leaf) { leaf(it.px, it.py, S * 0.05, S * 0.017, r() * TAU, { h: 28, s: 45, l: 38 }, { shape: 'ellip', pet: 0.15, sq: 0.7 }); continue; }
      ctx.strokeStyle = 'rgba(120,70,60,0.9)'; ctx.lineWidth = Math.max(0.6, S * 0.0025);
      ctx.beginPath(); ctx.moveTo(it.px, it.py); ctx.lineTo(it.fx, it.fy); ctx.stroke();
      if (it.bud) { ctx.beginPath(); ctx.ellipse(it.fx, it.fy, S * 0.008, S * 0.012, r() * 3, 0, TAU); ctx.fillStyle = hsl(340, 62, 66); ctx.fill(); continue; }
      sakuraFlower(it.fx, it.fy, S * (dense ? 0.022 : 0.026) * (0.85 + r() * 0.3), it.d);
    }
  };
  drawTile(TILE.SAKURA, (S) => sakuraTile(S, 6, 20, false));
  // 13 遠目の桜：花の塊。塊の上が明るく、下と奥は影で薄紫がかる
  drawTile(TILE.SAKURA_DENSE, (S) => massTile(S, { clumps: 12, spread: 0.3, clumpR: 0.16, per: 80, twigCol: 'rgba(90,66,62,1)', draw: (it, S2) => {
    const sh = Math.max(0, Math.min(1, it.shade));
    flower(it.x, it.y, S2 * 0.02 * it.s, r() * TAU, {
      sq: 0.5 + r() * 0.5, tilt: r() * TAU, notch: false, pw: 0.62,
      base: hsl(336, 50, 72 + sh * 10), mid: hsl(342 - (1 - sh) * 10, 38 - sh * 10, 80 + sh * 12), edge: hsl(348, 30, 86 + sh * 11),
      eye: hsl(338, 60, 55),
    });
  } }));
  // 3 山桜：白〜淡紅の花と、同時に開く赤茶の若葉
  const yamaTile = (S, dense) => {
    const draw = (it, S2) => {
      if (r() < 0.36) {
        const c = { h: 14 + r() * 16, s: 48, l: 34 + depthL(it) };
        leaf(it.x, it.y, S2 * (dense ? 0.06 : 0.075) * it.s, S2 * 0.026 * it.s, it.a, c, { shape: 'ovate', serr: 0.5, teeth: 14, pet: 0.12, sq: 0.5 + r() * 0.5, gloss: 0.1 });
        return;
      }
      const l = 91 + depthL(it, 6);
      flower(it.x, it.y, S2 * (dense ? 0.02 : 0.024) * (0.85 + r() * 0.3), r() * TAU, {
        sq: 0.45 + r() * 0.55, tilt: r() * TAU, notch: true, pw: 0.58,
        base: hsl(345, 30, l - 8), mid: hsl(350, 18, l), edge: hsl(40, 25, Math.min(98, l + 4)),
        stamen: hsl(50, 40, 75, 0.9), anther: hsl(45, 70, 58), eye: hsl(40, 45, 60), ns: 8,
      });
    };
    if (dense) massTile(S, { clumps: 11, spread: 0.3, clumpR: 0.15, per: 60, draw });
    else spray(S, { twigs: 6, reach: 0.4, nodes: 8, perNode: 2, side: 0.4, tip: 2, twigCol: 'rgba(60,42,38,1)', draw });
  };
  drawTile(TILE.YAMAZAKURA, (S) => yamaTile(S, false));
  drawTile(TILE.YAMA_DENSE, (S) => yamaTile(S, true));
  // 4 辛夷：葉の出る前の枝に白い大きな花（6弁、細長く少しよじれる）
  const kobushiTile = (S, dense) => {
    const cx = S / 2, cy = S / 2;
    const items = [];
    for (let k = 0; k < (dense ? 10 : 7); k++) {
      const pts = walk(cx, cy, (k / 7) * TAU + r(), S * (0.34 + r() * 0.1), 5, 0.5);
      twigLine(pts, S * 0.012, S * 0.005, 'rgba(90,82,72,1)');
      for (let q = 0; q < (dense ? 5 : 3); q++) {
        const [px, py] = at(pts, 0.35 + r() * 0.65);
        items.push({ x: px, y: py, d: r() });
      }
    }
    items.sort((a, b) => a.d - b.d);
    for (const it of items) {
      if (r() < 0.25) { leaf(it.x, it.y, S * 0.05, S * 0.016, r() * TAU, { h: 85, s: 45, l: 42 }, { shape: 'ovate', pet: 0.05 }); continue; }
      const n = 6, rad = S * (dense ? 0.045 : 0.055);
      const rot = r() * TAU, sq = 0.5 + r() * 0.5;
      ctx.save(); ctx.translate(it.x, it.y); ctx.rotate(r() * TAU); ctx.scale(1, sq); ctx.rotate(rot);
      for (let p = 0; p < n; p++) {
        leaf(0, 0, rad * (0.9 + r() * 0.25), rad * 0.26, p * TAU / n + (r() - 0.5) * 0.4, { h: 40, s: 25, l: 90 + it.d * 7 }, { shape: 'obovate', pet: 0, vein: false, bend: (r() - 0.5) * 0.8 });
      }
      ctx.beginPath(); ctx.arc(0, 0, rad * 0.1, 0, TAU); ctx.fillStyle = hsl(345, 40, 60); ctx.fill();
      ctx.restore();
    }
  };
  drawTile(TILE.KOBUSHI, (S) => kobushiTile(S, false));
  drawTile(TILE.KOBUSHI_DENSE, (S) => kobushiTile(S, true));
  // 5 杉：縄のように短い針葉が巻き付いた小枝が、羽のように枝分かれして平たい房になる
  const cedarTile = (S, n, dense) => {
    const needles = [];
    const rope = (x0, y0, ang, len, w, depth, dd) => {
      const steps = Math.max(4, Math.floor(len / (S * 0.008)));
      let x = x0, y = y0, a = ang;
      for (let i = 0; i < steps; i++) {
        a += (r() - 0.5) * 0.1;
        const nx = x + Math.cos(a) * len / steps, ny = y + Math.sin(a) * len / steps;
        const t = i / steps;
        const ww = w * (1 - t * 0.55);
        for (let k = 0; k < 3; k++) needles.push({ x: nx + (r() - 0.5) * ww * 0.4, y: ny + (r() - 0.5) * ww * 0.4, a: a + (r() < 0.5 ? -1 : 1) * (0.5 + r() * 0.7), l: ww * (0.75 + r() * 0.5), w: ww * 0.22, d: dd + t * 0.35 + r() * 0.15, tip: t });
        // 羽状の脇枝
        if (depth < 2 && i > 1 && i % 3 === 0 && r() < 0.8) rope(nx, ny, a + (i % 2 ? -1 : 1) * (0.55 + r() * 0.35), len * (0.42 - depth * 0.1) * (1 - t * 0.6), w * 0.8, depth + 1, dd + 0.1);
        x = nx; y = ny;
      }
    };
    for (let k = 0; k < n; k++) {
      const x0 = S * (0.3 + r() * 0.4), y0 = S * (0.04 + r() * 0.1);
      rope(x0, y0, Math.PI / 2 + (r() - 0.5) * (dense ? 1.3 : 0.8), S * (0.62 + r() * 0.28), S * 0.026, 0, r() * 0.4);
    }
    needles.sort((a, b) => a.d - b.d);
    for (const nd of needles) {
      const brown = r() < 0.015;
      const lit = (nd.d - 0.5) * 22 + nd.tip * 6;
      const c = brown ? { h: 28, s: 40, l: 30 } : { h: 104 + (r() - 0.5) * 16 - nd.tip * 14, s: 34 + nd.tip * 12, l: 20 + (r() - 0.5) * 6 + lit };
      leaf(nd.x, nd.y, nd.l, nd.w, nd.a, c, { shape: 'needle', pet: 0, vein: false });
    }
  };
  drawTile(TILE.CEDAR, (S) => cedarTile(S, 6, false));
  drawTile(TILE.CEDAR_DENSE, (S) => cedarTile(S, 10, true));
  // 6 竹：細い枝先から扇状に垂れる細長い葉（先が尖る）。葉は小さく数が多い
  const bambooTile = (S, dense) => {
    const items = [];
    const nS = dense ? 70 : 46;
    for (let k = 0; k < nS; k++) {
      const x = S * (0.08 + r() * 0.84), y = S * (0.04 + r() * 0.6);
      const pts = walk(x, y, Math.PI / 2 + (r() - 0.5) * 1.4, S * (dense ? 0.07 : 0.09), 3, 0.4);
      twigLine(pts, S * 0.003, S * 0.002, 'rgba(110,118,62,1)');
      const [ex, ey, ea] = at(pts, 1);
      const n = 3 + Math.floor(r() * 5);
      const dk = r();
      for (let i = 0; i < n; i++) items.push({ x: ex, y: ey, a: ea + (i - n / 2) * 0.34 + (r() - 0.5) * 0.3, s: 0.8 + r() * 0.4, d: dk * 0.6 + r() * 0.4 });
    }
    items.sort((a, b) => a.d - b.d);
    for (const it of items) {
      const c = { h: 76 + (r() - 0.5) * 16, s: 44 + (r() - 0.5) * 10, l: 34 + depthL(it, 18) };
      leaf(it.x, it.y, S * (dense ? 0.1 : 0.13) * it.s, S * (dense ? 0.012 : 0.014) * it.s, it.a, c, { shape: 'lance', pet: 0.04, sq: 0.6 + r() * 0.4, bend: (r() - 0.5) * 1.2, veins: 0 });
    }
  };
  drawTile(TILE.BAMBOO, (S) => bambooTile(S, false));
  drawTile(TILE.BAMBOO_DENSE, (S) => bambooTile(S, true));
  // 7 柳：垂れる細い枝に、芽吹いたばかりの明るい細葉。枝は少し揺れて長さもまちまち
  drawTile(TILE.WILLOW, (S) => {
    const items = [];
    for (let k = 0; k < 34; k++) {
      const x = S * (0.03 + r() * 0.94);
      const sway = (r() - 0.5) * S * 0.12;
      const y0 = S * r() * 0.15, y1 = S * (0.75 + r() * 0.25);
      const pts = [];
      for (let t = 0; t <= 1.001; t += 0.1) pts.push([x + sway * t * t, y0 + (y1 - y0) * t]);
      twigLine(pts, S * 0.003, S * 0.0018, 'rgba(120,118,70,1)');
      const dk = r();
      for (let t = 0.02; t < 1; t += 0.018 + r() * 0.012) {
        const px = x + sway * t * t, py = y0 + (y1 - y0) * t;
        items.push({ x: px, y: py, a: Math.PI / 2 + (r() < 0.5 ? -0.5 : 0.5) + (r() - 0.5) * 0.4, s: 0.7 + r() * 0.5 * (1 - t * 0.5), d: dk * 0.7 + r() * 0.3 });
      }
    }
    items.sort((a, b) => a.d - b.d);
    for (const it of items) {
      const c = { h: 68 + (r() - 0.5) * 12, s: 46, l: 42 + depthL(it, 16) };
      leaf(it.x, it.y, S * 0.045 * it.s, S * 0.008 * it.s, it.a, c, { shape: 'lance', pet: 0, vein: false, sq: 0.7 + r() * 0.3 });
    }
  });
  // 8 柿：艶のある大きな若葉（明るい黄緑）
  drawTile(TILE.KAKI, (S) => spray(S, { twigs: 6, reach: 0.38, nodes: 5, perNode: 1, side: 0.2, tip: 2, twigCol: 'rgba(70,60,50,1)', draw: (it, S2) => {
    const c = { h: 74 + (r() - 0.5) * 10, s: 58, l: 46 + depthL(it) + (it.tip ? 6 : 0) };
    leaf(it.x, it.y, S2 * 0.14 * it.s, S2 * 0.06 * it.s, it.a, c, { shape: 'ovate', pet: 0.08, gloss: 0.2, sq: 0.5 + r() * 0.5, bend: (r() - 0.5) * 0.4, veins: 5 });
  } }));
  // 9 椿：濃い艶の葉と、黄色い雄しべの筒を抱いた赤い花
  drawTile(TILE.CAMELLIA, (S) => spray(S, { twigs: 8, reach: 0.42, nodes: 8, perNode: 1, side: 0.5, tip: 2, twigCol: 'rgba(80,72,60,1)', draw: (it, S2) => {
    if (r() < 0.08) {
      const rad = S2 * 0.036;
      flower(it.x, it.y, rad, r() * TAU, { sq: 0.6 + r() * 0.4, tilt: r() * TAU, petals: 5, pw: 0.75, base: hsl(352, 72, 30), mid: hsl(354, 72, 40 + it.d * 8), edge: hsl(356, 70, 46 + it.d * 8), eye: hsl(50, 85, 62) });
      ctx.beginPath(); ctx.arc(it.x, it.y, rad * 0.28, 0, TAU); ctx.fillStyle = hsl(50, 85, 60); ctx.fill();
      return;
    }
    const c = { h: 112 + (r() - 0.5) * 12, s: 42, l: 18 + (r() - 0.5) * 5 + depthL(it, 12) };
    leaf(it.x, it.y, S2 * 0.1 * it.s, S2 * 0.045 * it.s, it.a, c, { shape: 'ellip', serr: 0.2, teeth: 16, pet: 0.08, gloss: 0.35 + r() * 0.15, sq: 0.5 + r() * 0.5, veins: 0 });
  } }));
  // 10 欅：ジグザグの小枝に小さな鋸歯の葉が並ぶ（明るい新緑）
  const keyakiDraw = (k) => (it, S2) => {
    const c = { h: 82 + (r() - 0.5) * 14, s: 50, l: 42 + depthL(it) + (it.tip ? 6 : 0) };
    leaf(it.x, it.y, S2 * 0.062 * it.s * k, S2 * 0.021 * it.s * k, it.a, c, { shape: 'ovate', serr: 0.7, teeth: 10, pet: 0.05, sq: 0.55 + r() * 0.45, veins: 6 });
  };
  drawTile(TILE.KEYAKI, (S) => spray(S, { twigs: 9, reach: 0.42, nodes: 11, perNode: 1, side: 0.6, tip: 2, draw: keyakiDraw(1) }));
  drawTile(TILE.KEYAKI_DENSE, (S) => massTile(S, { clumps: 12, spread: 0.3, clumpR: 0.15, per: 60, draw: keyakiDraw(0.9) }));
  // 11 低木（いろいろな緑）
  const shrubDraw = (it, S2) => {
    const c = { h: 88 + (r() - 0.5) * 40, s: 42, l: 30 + (r() - 0.5) * 8 + depthL(it) };
    leaf(it.x, it.y, S2 * 0.075 * it.s, S2 * 0.03 * it.s, it.a, c, { shape: r() < 0.5 ? 'ellip' : 'ovate', serr: r() * 0.6, pet: 0.08, sq: 0.5 + r() * 0.5, gloss: r() < 0.3 ? 0.15 : 0 });
  };
  drawTile(TILE.SHRUB, (S) => spray(S, { twigs: 9, reach: 0.42, nodes: 9, perNode: 1, side: 0.5, tip: 2, draw: shrubDraw }));
  drawTile(TILE.SHRUB_DENSE, (S) => massTile(S, { clumps: 12, spread: 0.3, clumpR: 0.15, per: 55, draw: shrubDraw }));

  // 16 躑躅（つつじ）：小さな濃い葉を覆うほどの赤紫の花（上の花びらに濃い斑点）
  drawTile(TILE.TSUTSUJI, (S) => massTile(S, { clumps: 13, spread: 0.3, clumpR: 0.15, per: 46, twigCol: 'rgba(70,52,40,1)', draw: (it, S2) => {
    // 花は塊の上・外側に多く、奥と下は葉がのぞく
    const sh = Math.max(0, Math.min(1, it.shade));
    if (r() < 0.62 - sh * 0.4) { leaf(it.x, it.y, S2 * 0.05 * it.s, S2 * 0.019 * it.s, it.a, { h: 96 + (r() - 0.5) * 16, s: 36, l: 19 + (r() - 0.5) * 6 + depthL(it, 10) }, { shape: 'ellip', pet: 0.04, vein: false, gloss: 0.14, sq: 0.5 + r() * 0.5 }); return; }
    const l = 44 + sh * 16 + (r() - 0.5) * 6;
    const rad = S2 * 0.034 * (0.85 + r() * 0.3);
    const rot = r() * TAU;
    flower(it.x, it.y, rad, rot, { sq: 0.55 + r() * 0.45, tilt: r() * TAU, pw: 0.7, base: hsl(326, 58, l - 14), mid: hsl(322 + r() * 12, 54, l), edge: hsl(330, 48, l + 10), stamen: hsl(320, 50, 70, 0.9), anther: hsl(320, 30, 40), eye: hsl(330, 60, 38), ns: 5 });
  } }));
  // 17 藤：垂れ下がる薄紫の房
  drawTile(TILE.FUJI, (S) => {
    for (let k = 0; k < 16; k++) {
      const x0 = S * (0.06 + r() * 0.88), y0 = S * (0.02 + r() * 0.12);
      const len = S * (0.45 + r() * 0.45);
      twigLine([[x0, y0], [x0 + (r() - 0.5) * S * 0.04, y0 + len]], S * 0.004, S * 0.004, 'rgba(90,110,60,1)');
      for (let t = 0; t < 1; t += 0.035) {
        const w = S * 0.05 * (1 - t * 0.8);
        const px = x0 + (r() - 0.5) * w, py = y0 + len * t;
        const l = 62 + r() * 16 + t * 10;
        ctx.beginPath(); ctx.ellipse(px, py, S * 0.012 * (1.2 - t * 0.5), S * 0.009, r() * 3, 0, 6.28);
        ctx.fillStyle = hsl(270 + r() * 18, 45 + r() * 20, l); ctx.fill();
      }
    }
  });

  // 透明部分の色を葉の平均色で埋める（縮小したとき縁が黒くならない）
  const img = ctx.getImageData(0, 0, size, size);
  const d = img.data;
  // 葉の面に細かいまだら（葉の表面の凹凸・色むら）：2〜6画素の値雑音で明るさを±7%
  {
    const G = 4, gw = Math.ceil(size / G) + 2;
    const grid = new Float32Array(gw * gw);
    for (let i = 0; i < grid.length; i++) grid[i] = r() - 0.5;
    for (let y = 0; y < size; y++) {
      const fy = y / G, iy = Math.floor(fy), vy = fy - iy;
      for (let x = 0; x < size; x++) {
        const o = (y * size + x) * 4;
        if (d[o + 3] < 8) continue;
        const fx = x / G, ix = Math.floor(fx), vx = fx - ix;
        const g0 = grid[iy * gw + ix] * (1 - vx) + grid[iy * gw + ix + 1] * vx;
        const g1 = grid[(iy + 1) * gw + ix] * (1 - vx) + grid[(iy + 1) * gw + ix + 1] * vx;
        const k = 1 + (g0 * (1 - vy) + g1 * vy) * 0.14 + (r() - 0.5) * 0.04;
        d[o] = Math.min(255, d[o] * k); d[o + 1] = Math.min(255, d[o + 1] * k); d[o + 2] = Math.min(255, d[o + 2] * k * 0.98);
      }
    }
  }
  // 透明部分の色：タイルごとに縮小ピラミッドで近くの葉の色を押し広げる（縮小しても縁が黒く・灰色にならない）
  // タイルの境は整数の画素に丸める（端数の添字は型付き配列に書けない）
  for (let ti = 0; ti < ATLAS_N * ATLAS_N; ti++) {
    const ox = Math.round((ti % ATLAS_N) * T), oy = Math.round(Math.floor(ti / ATLAS_N) * T);
    const tw = Math.round(((ti % ATLAS_N) + 1) * T) - ox, th = Math.round((Math.floor(ti / ATLAS_N) + 1) * T) - oy;
    // 0段目：前乗算の色と重み
    let w = tw, h = th;
    let lv = new Float32Array(w * h * 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const o = ((oy + y) * size + ox + x) * 4, a = d[o + 3] / 255, i = (y * w + x) * 4;
      lv[i] = d[o] * a; lv[i + 1] = d[o + 1] * a; lv[i + 2] = d[o + 2] * a; lv[i + 3] = a;
    }
    const levels = [{ lv, w, h }];
    while (w > 1 || h > 1) {
      const w2 = Math.max(1, w >> 1), h2 = Math.max(1, h >> 1), l2 = new Float32Array(w2 * h2 * 4);
      for (let y = 0; y < h2; y++) for (let x = 0; x < w2; x++) {
        const i = (y * w2 + x) * 4;
        for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
          const sx = Math.min(w - 1, x * 2 + dx), sy = Math.min(h - 1, y * 2 + dy), j = (sy * w + sx) * 4;
          l2[i] += lv[j]; l2[i + 1] += lv[j + 1]; l2[i + 2] += lv[j + 2]; l2[i + 3] += lv[j + 3];
        }
      }
      lv = l2; w = w2; h = h2; levels.push({ lv, w, h });
    }
    const top = levels[levels.length - 1].lv;
    // 葉から8画素より遠いところはタイルの平均色一色（画像が軽く縮む）
    const K = Math.min(3, levels.length - 1), LK = levels[K], nearK = new Uint8Array(LK.w * LK.h);
    for (let y = 0; y < LK.h; y++) for (let x = 0; x < LK.w; x++) {
      let hit = 0;
      for (let dy = -1; dy <= 1 && !hit; dy++) for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx >= 0 && yy >= 0 && xx < LK.w && yy < LK.h && LK.lv[(yy * LK.w + xx) * 4 + 3] > 0) { hit = 1; break; }
      }
      nearK[y * LK.w + x] = hit;
    }
    avg.push([top[0] / Math.max(top[3], 1e-6), top[1] / Math.max(top[3], 1e-6), top[2] / Math.max(top[3], 1e-6)]);
    // 粗い段から細かい段へ：重みの足りない画素は一つ粗い段の色で埋める
    for (let k = levels.length - 2; k >= 0; k--) {
      const A = levels[k], Bl = levels[k + 1];
      for (let y = 0; y < A.h; y++) for (let x = 0; x < A.w; x++) {
        const i = (y * A.w + x) * 4, wa = A.lv[i + 3];
        const j = (Math.min(Bl.h - 1, y >> 1) * Bl.w + Math.min(Bl.w - 1, x >> 1)) * 4, wb = Math.max(Bl.lv[j + 3], 1e-6);
        const f = Math.max(0, 1 - wa);
        A.lv[i] += Bl.lv[j] / wb * f; A.lv[i + 1] += Bl.lv[j + 1] / wb * f; A.lv[i + 2] += Bl.lv[j + 2] / wb * f; A.lv[i + 3] = Math.max(wa, 1);
      }
    }
    const L0 = levels[0].lv;
    for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) {
      const o = ((oy + y) * size + ox + x) * 4, a = d[o + 3] / 255, i = (y * tw + x) * 4;
      if (a >= 0.999) continue;
      if (a === 0 && !nearK[Math.min(LK.h - 1, y >> K) * LK.w + Math.min(LK.w - 1, x >> K)]) {
        const t = avg[avg.length - 1];
        d[o] = t[0]; d[o + 1] = t[1]; d[o + 2] = t[2];
        continue;
      }
      const wv = Math.max(L0[i + 3], 1e-6);
      // 色は前乗算を戻した値（葉の画素は元のまま、透明なところは周りの葉の色）
      d[o] = Math.min(255, L0[i] / wv); d[o + 1] = Math.min(255, L0[i + 1] / wv); d[o + 2] = Math.min(255, L0[i + 2] / wv);
    }
  }
  const tex = new THREE.DataTexture(new Uint8Array(d.buffer.slice(0)), size, size, THREE.RGBAFormat, THREE.UnsignedByteType);
  tex.flipY = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return { tex, avg, canvas: cv };
}

// 焼いた画像から読む：作ると数秒かかるので、同じ絵を画像にして配る（tools/bake-atlas.mjs で焼く）
export async function loadLeafAtlas(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`leaf atlas ${res.status}`);
  const bmp = await createImageBitmap(await res.blob(), { premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
  const tex = new THREE.Texture(bmp);
  tex.flipY = false;
  tex.premultiplyAlpha = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return { tex, avg: null, canvas: null };
}
