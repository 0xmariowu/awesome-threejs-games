// 木の形（手続き生成）：幹→大枝→枝→小枝の骨格を一度だけ作り、近景・中景・遠景は同じ骨格から細かさを変えて出す
// 枝は曲がった一続きの管（継ぎ目なし・根張りつき）。葉の板は小枝の先に付け、樹冠の輪郭は骨格が決める
import * as THREE from 'three';
import { mulberry32 } from '../util/noise.js';
import { TILE, ATLAS_N } from './leaves.js';

const TAU = Math.PI * 2;
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const add = (a, b, s = 1) => [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

class Builder {
  constructor() { this.pos = []; this.nrm = []; this.uv = []; this.aux = []; this.idx = []; }
  get count() { return this.pos.length / 3; }
  vert(p, n, u, v, sway, leaf, ao, w) {
    this.pos.push(p[0], p[1], p[2]); this.nrm.push(n[0], n[1], n[2]); this.uv.push(u, v); this.aux.push(sway, leaf, ao, w);
    return this.count - 1;
  }
  // 曲がった管：点列に沿って輪を並べる（平行移動の枠でねじれない）
  // uv.x = 周方向（樹皮の模様がつながるよう整数回くり返す）、uv.y = 根元からの長さ[m]、aux.w = 半径[m]
  tube(pts, rads, sides, sw, ao, o = {}) {
    const n = pts.length;
    if (n < 2) return;
    const T = pts.map((p, i) => norm(sub(pts[Math.min(i + 1, n - 1)], pts[Math.max(i - 1, 0)])));
    let b1 = norm(cross(T[0], Math.abs(T[0][1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]));
    const nc = o.nc || Math.max(1, Math.round(TAU * rads[0] * 3));
    const base = this.count;
    let L = o.v0 || 0;
    for (let i = 0; i < n; i++) {
      if (i > 0) {
        L += Math.hypot(...sub(pts[i], pts[i - 1]));
        const pr = sub(b1, T[i].map((v) => v * dot(b1, T[i])));
        b1 = Math.hypot(...pr) > 1e-4 ? norm(pr) : norm(cross(T[i], Math.abs(T[i][1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]));
      }
      const b2 = cross(T[i], b1);
      const aoI = typeof ao === 'number' ? ao : ao[i];
      for (let s = 0; s <= sides; s++) {
        const a = (s / sides) * TAU;
        const c = Math.cos(a), sn = Math.sin(a);
        const d = [b1[0] * c + b2[0] * sn, b1[1] * c + b2[1] * sn, b1[2] * c + b2[2] * sn];
        let rr = rads[i];
        // 根張り：根元ほど太く、数本の根の張り出し
        if (o.flare && i < o.flareN) {
          const f = 1 - i / o.flareN;
          rr *= 1 + o.flare * f * f * (0.55 + 0.45 * Math.pow(0.5 + 0.5 * Math.cos(a * o.roots + o.fph), 2.5));
        }
        this.vert(add(pts[i], d, rr), d, (s / sides) * nc, L, sw[i], 0, aoI, rr);
      }
    }
    const R = sides + 1;
    for (let i = 0; i < n - 1; i++) for (let s = 0; s < sides; s++) {
      const a = base + i * R + s, b = a + 1, c = a + R, e = c + 1;
      this.idx.push(a, c, b, b, c, e);
    }
  }
  // 葉の板：中心c、横u・縦vの向き（単位）、幅w・高さh、アトラスのタイル。nrmは陰影用の法線（樹冠の外向き）
  card(c, u, v, w, h, tile, nrm, sway, ao, ph) {
    const tx = (tile % ATLAS_N) / ATLAS_N, ty = Math.floor(tile / ATLAS_N) / ATLAS_N;
    const inset = 0.004, sz = 1 / ATLAS_N - inset * 2;
    const base = this.count;
    const cs = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
    for (const [a, b] of cs) {
      const p = [c[0] + u[0] * a * w * 0.5 + v[0] * b * h * 0.5, c[1] + u[1] * a * w * 0.5 + v[1] * b * h * 0.5, c[2] + u[2] * a * w * 0.5 + v[2] * b * h * 0.5];
      const uu = tx + inset + (a * 0.5 + 0.5) * sz;
      const vv = ty + inset + (b * 0.5 + 0.5) * sz;
      this.vert(p, typeof nrm === 'function' ? nrm(p) : nrm, uu, vv, sway, 1, ao, ph);
    }
    this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  geometry() {
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nrm, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('aux', new THREE.Float32BufferAttribute(this.aux, 4));
    g.setIndex(this.idx);
    return g;
  }
}

// 向きdから角angだけ離れ、周りの角phiに回した向き
function deviate(d, ang, phi) {
  const t = Math.abs(d[1]) < 0.95 ? [0, 1, 0] : [1, 0, 0];
  const b1 = norm(cross(d, t)), b2 = cross(d, b1);
  const c = Math.cos(ang), s = Math.sin(ang);
  const e = [b1[0] * Math.cos(phi) + b2[0] * Math.sin(phi), b1[1] * Math.cos(phi) + b2[1] * Math.sin(phi), b1[2] * Math.cos(phi) + b2[2] * Math.sin(phi)];
  return norm([d[0] * c + e[0] * s, d[1] * c + e[1] * s, d[2] * c + e[2] * s]);
}

// 仰角をmaxEl[rad]までに抑えた向き（真上に近いときは向きを選び直す）
function limitElev(d, maxEl, r) {
  let hx = d[0], hz = d[2], hl = Math.hypot(hx, hz);
  if (hl < 1e-3) { const a = r() * TAU; hx = Math.cos(a); hz = Math.sin(a); hl = 1; }
  const el = Math.min(Math.asin(Math.max(-1, Math.min(1, d[1]))), maxEl);
  return [hx / hl * Math.cos(el), Math.sin(el), hz / hl * Math.cos(el)];
}

// 板の向き：外向きnを中心に、軸aの向きへ寄せて回す
function cardFrame(out, r, jit = 0.9, axis = null) {
  const n = norm([out[0] + (r() - 0.5) * jit, out[1] + (r() - 0.5) * jit + 0.2 * jit, out[2] + (r() - 0.5) * jit]);
  let u;
  if (axis) {
    const pr = sub(axis, n.map((v) => v * dot(axis, n)));
    u = Math.hypot(...pr) > 1e-3 ? norm(pr) : norm(cross(Math.abs(n[1]) < 0.95 ? [0, 1, 0] : [1, 0, 0], n));
  } else {
    const t0 = Math.abs(n[1]) < 0.95 ? [0, 1, 0] : [1, 0, 0];
    u = norm(cross(t0, n));
    const a = r() * TAU, v0 = cross(n, u);
    u = norm([u[0] * Math.cos(a) + v0[0] * Math.sin(a), u[1] * Math.cos(a) + v0[1] * Math.sin(a), u[2] * Math.cos(a) + v0[2] * Math.sin(a)]);
  }
  return { n, u, v: cross(n, u) };
}

// ---- 樹冠のかたち：でこぼこの楕円体（いくつかの膨らみ） ----
function makeEnvelope(r, c, R, Ry, lump = 0.22, flatTop = 0) {
  const bumps = [];
  for (let i = 0; i < 7; i++) {
    const u = r() * 2 - 1, th = r() * TAU, s = Math.sqrt(1 - u * u);
    bumps.push({ d: [Math.cos(th) * s, u * 0.7 + 0.2, Math.sin(th) * s], k: (r() - 0.35) * lump });
  }
  // q：中心からの正規化距離（輪郭で1）
  const q = (p) => {
    const x = (p[0] - c[0]) / R, y = (p[1] - c[1]) / Ry, z = (p[2] - c[2]) / R;
    const l = Math.hypot(x, y, z) || 1e-6;
    const dd = [x / l, y / l, z / l];
    let f = 1;
    for (const b of bumps) f += b.k * Math.pow(Math.max(0, dot(dd, b.d)), 3);
    if (flatTop && dd[1] > 0) f *= 1 - flatTop * dd[1] * dd[1];
    return l / f;
  };
  return { c, R, Ry, q };
}

// ---- 骨格（LODによらず同じ） ----
// 枝: {pts, rads, sw, order}、葉の付く場所: {p, d, o, sway, q}
function growSkeleton(opt, seed) {
  const r = mulberry32(seed);
  const H = opt.height;
  const trunkH = H * opt.trunk;
  const cy = H * opt.crownY, R = H * opt.crownR, Ry = H * opt.crownRy;
  const env = makeEnvelope(r, [0, cy, 0], R, Ry, opt.lump ?? 0.22, opt.flatTop || 0);
  const branches = [], sites = [];
  const maxO = opt.orders ?? 3;
  const segs = [7, 5, 4, 3];
  const r0 = H * opt.bark;
  const grow = (p0, dir, len, rad, order, sw0) => {
    const n = segs[order];
    const pts = [p0], rads = [rad], sw = [sw0];
    let p = p0, d = dir;
    const radEnd = rad * (order === 0 ? 0.35 : order === 1 ? 0.22 : 0.12);
    const wob = [0.1, 0.34, 0.45, 0.5][order] * (opt.wob ?? 1);
    const trop = (opt.trop || [0.02, 0.05, 0.06, 0.05])[order];
    const swEnd = [0.18, 0.5, 0.8, 1][order];
    for (let k = 1; k <= n; k++) {
      d = norm([d[0] + (r() - 0.5) * wob, d[1] + (r() - 0.5) * wob * 0.6 + trop, d[2] + (r() - 0.5) * wob]);
      let q = add(p, d, len / n);
      // 樹冠からはみ出す枝は内へ曲げる（輪郭を骨格でまとめる）
      if (order > 0) {
        const e = env.q(q);
        if (e > 1 && q[1] > env.c[1] - env.Ry * 0.45) {
          const inward = norm(sub(env.c, q));
          d = norm(add(d, inward, Math.min(1.5, (e - 1) * 3)));
          q = add(p, d, (len / n) * 0.7);
        }
      }
      pts.push(q);
      rads.push(rad + (radEnd - rad) * Math.pow(k / n, 0.8));
      sw.push(sw0 + (swEnd - sw0) * (k / n));
      p = q;
    }
    const br = { pts, rads, sw, order, len };
    branches.push(br);
    const along = (t) => {
      const f = t * n, i = Math.min(n - 1, Math.floor(f)), u = f - i;
      return [lerp3(pts[i], pts[i + 1], u), norm(sub(pts[i + 1], pts[i])), rads[i] + (rads[i + 1] - rads[i]) * u, sw[i] + (sw[i + 1] - sw[i]) * u];
    };
    if (order < maxO) {
      const nk = opt.kids[order];
      const t0 = order === 0 ? opt.trunk * H / len : opt.kidT0 ?? 0.25;
      const phi0 = r() * TAU;
      for (let c = 0; c < nk; c++) {
        const t = Math.min(0.97, t0 + (1 - t0) * (c + 0.15 + 0.7 * r()) / nk);
        const [pp, tt, rr, ss] = along(t);
        const phi = phi0 + c * 2.39996 + (r() - 0.5) * 0.5;
        let ang = opt.angle[order] * (0.8 + 0.4 * r());
        let cd = deviate(tt, ang, phi);
        if (order === 0) {
          // 大枝は外へ（幹の上ほど立つ）
          const hz = norm([cd[0], 0, cd[2]]);
          const up = opt.limbUp + (r() - 0.5) * 0.2 + (t - t0) * 0.25;
          cd = norm([hz[0] * (1 - up), up, hz[2] * (1 - up)]);
        }
        // 長さ：樹冠の輪郭までの残りに合わせる
        let cl = len * opt.lenK[order] * (order === 0 ? 1 : (1 - 0.55 * t)) * (0.8 + 0.4 * r());
        if (order === 0) { cl = Math.max(cl, R * (0.7 + 0.3 * r())); }
        grow(pp, cd, cl, Math.min(rr * 0.85, rad * opt.radK[order] * (0.85 + 0.3 * r())), order + 1, ss);
      }
    }
    // 葉の付く場所：末端の枝（とその一つ手前の先の方）
    if (order >= maxO - 1) {
      const m = order === maxO ? opt.sitesPer : opt.sitesPer + 1;
      for (let k = 0; k < m; k++) {
        const t = order === maxO ? 0.3 + 0.7 * (k + r()) / m : 0.3 + 0.7 * r();
        const [pp, tt, , ss] = along(t);
        const e = env.q(pp);
        sites.push({ p: pp, d: tt, sway: ss, q: e });
      }
    }
  };
  const lean = [(r() - 0.5) * 0.12 * H * opt.lean, 0, (r() - 0.5) * 0.12 * H * opt.lean];
  const trunkTop = opt.leader ?? 0.8;
  grow([0, -0.45, 0], norm([lean[0] / H, 1, lean[2] / H]), H * trunkTop, r0, 0, 0);
  return { branches, sites, env, H, R, Ry, cy, trunkH };
}

// 骨格から形を出す：lod 0=近景 1=中景 2=遠景
function emitTree(sk, opt, lod, seed) {
  const r = mulberry32(seed + 77 + lod * 5);
  const B = new Builder();
  const { env, H } = sk;
  const sidesO = lod === 0 ? [10, 6, 4, 3] : lod === 1 ? [5, 3, 3, 3] : [4, 3, 3, 3];
  const maxOrd = lod === 0 ? 3 : lod === 1 ? 1 : 0;
  for (const b of sk.branches) {
    if (b.order > maxOrd) continue;
    if (lod === 2 && b.order === 1 && b.rads[0] < H * opt.bark * 0.4) continue;
    // 中景の細い大枝は葉に隠れて見えない（太い大枝だけ）
    if (lod === 1 && b.order === 1 && b.rads[0] < H * opt.bark * 0.42) continue;
    let pts = b.pts, rads = b.rads, sw = b.sw;
    // 中景・遠景は点を間引く。近景の小枝も（短いので2節で足りる）
    if ((lod > 0 && pts.length > 3) || (lod === 0 && b.order === 3 && pts.length > 3)) {
      const keep = pts.map((_, i) => i).filter((i) => i % 2 === 0 || i === pts.length - 1);
      pts = keep.map((i) => b.pts[i]); rads = keep.map((i) => b.rads[i]); sw = keep.map((i) => b.sw[i]);
    }
    // 中景の大枝は途中まで（先は葉の中）
    if (lod === 1 && b.order === 1 && pts.length > 3) { pts = pts.slice(0, 3); rads = rads.slice(0, 3); sw = sw.slice(0, 3); }
    const ao = pts.map((p) => Math.min(1, 0.35 + 0.45 * Math.min(1, env.q(p)) + 0.2 * Math.min(1, p[1] / H)));
    const flare = b.order === 0 ? { flare: opt.flare ?? 0.9, flareN: Math.min(3, pts.length - 1), roots: opt.roots || 5, fph: r() * TAU } : {};
    B.tube(pts, rads, sidesO[b.order], sw, ao, flare);
  }
  // 葉の板
  const n = lod === 2 ? opt.farCards : lod === 1 ? opt.midCards : opt.cards;
  const tile = lod === 0 ? opt.tile : opt.farTile;
  const size0 = (lod === 2 ? opt.farCardSize : lod === 1 ? opt.midCardSize : opt.cardSize) * H;
  const S = sk.sites;
  for (let i = 0; i < n && S.length; i++) {
    // 近景は小枝の場所を順に（全体に散らす）、中景・遠景は外側寄りを選ぶ
    let st = S[Math.floor(((i + r()) / n) * S.length) % S.length];
    if (lod > 0) { const s2 = S[Math.floor(r() * S.length)]; if (s2.q > st.q) st = s2; }
    const outC = norm(sub(st.p, [env.c[0], env.c[1] - env.Ry * 0.25, env.c[2]]));
    const out = norm(add(outC, st.d, 0.35));
    const size = size0 * (0.8 + r() * 0.4) * (lod === 0 ? 0.85 + 0.3 * Math.min(1, st.q) : 1);
    // 中景・遠景の板は外へ出しすぎない（近景の輪郭と合わせ、入れ替わりの網目が輪郭の外に出ないように）
    const c = add(st.p, out, size * (lod === 0 ? 0.18 : lod === 1 ? 0.02 + 0.06 * r() : 0.12 + 0.1 * r()));
    const f = cardFrame(out, r, lod === 0 ? 1.1 : 0.8, lod === 0 ? st.d : null);
    const q = Math.min(1.1, env.q(c));
    const ao = Math.min(1, 0.18 + 0.62 * Math.pow(Math.min(1, q), 1.6) + 0.2 * Math.max(0, out[1]));
    B.card(c, f.u, f.v, size, size, tile, outC, 0.3 + 0.7 * st.sway, ao, r());
  }
  // 近景の樹冠の芯：内側に密な房の板を少し（外の房の隙間から空が抜けすぎず、奥が暗く締まる）
  if (lod === 0 && opt.farTile !== undefined) {
    const nc = Math.round(n * (opt.core ?? 0.09));
    for (let i = 0; i < nc && S.length; i++) {
      const st = S[Math.floor(r() * S.length)];
      const k = 0.25 + 0.35 * r();
      const c = lerp3(st.p, env.c, k);
      const outC = norm(sub(c, [env.c[0], env.c[1] - env.Ry * 0.25, env.c[2]]));
      const f = cardFrame(outC, r, 1.0);
      const q = Math.min(1, env.q(c));
      const size = opt.midCardSize * H * (0.6 + 0.3 * r());
      B.card(c, f.u, f.v, size, size, opt.farTile, outC, 0.25 + 0.5 * st.sway, Math.min(1, 0.12 + 0.45 * q * q + 0.15 * Math.max(0, outC[1])), r());
    }
  }
  return B;
}

// ---- 広葉樹（楢・山桜・辛夷・常緑・柿・欅・低木・躑躅・椿） ----
export function broadleaf(opt, seed, far) {
  const lod = far === true ? 2 : far === 'mid' ? 1 : 0;
  const sk = growSkeleton(opt, seed);
  const B = emitTree(sk, opt, lod, seed);
  return { geo: B.geometry(), height: sk.H, crownR: sk.R, crownY: sk.cy, crownRy: sk.Ry, crownC: sk.env.c };
}

// ---- 株立ち（低木・躑躅・椿） ----
// form: 'dome'=躑躅（伏せた椀・底は平ら・裾が地面まで）/ 'lumps'=野の低木（ずれた塊を重ねた不整形・下に茎がのぞく）/ なし=椿（卵形）
export function shrub(opt, seed, far) {
  if (opt.form === 'dome') return shrubDome(opt, seed, far);
  if (opt.form === 'lumps') return shrubLumps(opt, seed, far);
  const r = mulberry32(seed);
  const lod = far === true ? 2 : far === 'mid' ? 1 : 0;
  const B = new Builder();
  const H = opt.height;
  const R = H * opt.crownR, Ry = H * opt.crownRy, cy = H * opt.crownY;
  const env = makeEnvelope(r, [0, cy, 0], R, Ry, 0.3);
  if (lod === 0) {
    for (let k = 0; k < opt.stems; k++) {
      const a = r() * TAU, sp = (opt.trunkUp ? 0.12 : 0.35) + r() * 0.3;
      const d = norm([Math.cos(a) * sp, 1, Math.sin(a) * sp]);
      const pts = [], rads = [], sw = [];
      for (let i = 0; i <= 4; i++) { pts.push(add([Math.cos(a) * 0.05 * H, -0.2, Math.sin(a) * 0.05 * H], d, H * 0.75 * i / 4)); rads.push(H * opt.bark * (1 - i / 5)); sw.push(i / 4 * 0.6); }
      B.tube(pts, rads, 4, sw, 0.4);
    }
  }
  const n = lod === 2 ? opt.farCards : lod === 1 ? opt.midCards : opt.cards;
  const tile = lod === 0 ? opt.tile : opt.farTile;
  const size0 = (lod === 2 ? opt.farCardSize : lod === 1 ? opt.midCardSize : opt.cardSize) * H;
  for (let i = 0; i < n; i++) {
    const u = r() * 2 - 1, th = r() * TAU;
    const yy = Math.max(-0.92, u);
    const rr = Math.sqrt(1 - yy * yy);
    const dl = [Math.cos(th) * rr, yy, Math.sin(th) * rr];
    const depth = lod ? 0.72 + r() * 0.2 : 0.45 + Math.pow(r(), 0.5) * 0.5;
    // 輪郭（でこぼこ）までの距離
    let lo = 0, hi = 2;
    for (let it = 0; it < 8; it++) { const m = (lo + hi) / 2; if (env.q([dl[0] * R * m, cy + dl[1] * Ry * m, dl[2] * R * m]) < 1) lo = m; else hi = m; }
    const p = [dl[0] * R * lo * depth, Math.max(0.05 * H, cy + dl[1] * Ry * lo * depth), dl[2] * R * lo * depth];
    const out = norm([dl[0], dl[1] * 0.8 + 0.2, dl[2]]);
    const f = cardFrame(out, r, 0.9);
    const size = size0 * (0.8 + r() * 0.4);
    const ao = Math.min(1, 0.2 + 0.55 * depth * lo + 0.25 * (yy * 0.5 + 0.5));
    // 花の株（躑躅）：奥と下の方は葉だけの房（花の間から葉の緑がのぞく）
    const tl = opt.innerTile !== undefined && lod === 0 && (depth < 0.7 || yy < -0.35) && r() < 0.8 ? opt.innerTile : tile;
    B.card(p, f.u, f.v, size, size, tl, out, 0.3 + 0.7 * Math.min(1, p[1] / H), ao, r());
  }
  return { geo: B.geometry(), height: H, crownR: R, crownY: cy, crownRy: Ry, crownC: [0, cy, 0] };
}

// 樹冠の中心cから向きdl（楕円体の単位方向）に、でこぼこの輪郭までの比
function envReach(env, dl) {
  let lo = 0, hi = 2;
  for (let it = 0; it < 8; it++) { const m = (lo + hi) / 2; if (env.q([env.c[0] + dl[0] * env.R * m, env.c[1] + dl[1] * env.Ry * m, env.c[2] + dl[2] * env.R * m]) < 1) lo = m; else hi = m; }
  return lo;
}

// 躑躅：伏せた椀。底は平らで、根元は外向き・やや下向きの裾の板が一巡して地面まで届く
function shrubDome(opt, seed, far) {
  const r = mulberry32(seed);
  const lod = far === true ? 2 : far === 'mid' ? 1 : 0;
  const B = new Builder();
  const H = opt.height;
  const R = H * opt.crownR, cy = H * opt.crownY, Ry = H - cy;
  const env = makeEnvelope(r, [0, cy, 0], R, Ry, 0.22);
  if (lod === 0) {
    // 茎：根元から外へ開く数本（裾の隙間から少しのぞく）
    for (let k = 0; k < opt.stems; k++) {
      const a = (k / opt.stems) * TAU + r() * 0.8;
      const p0 = [Math.cos(a) * 0.06, -0.15, Math.sin(a) * 0.06];
      const p1 = [Math.cos(a) * R * 0.35, H * 0.35, Math.sin(a) * R * 0.35];
      const p2 = [Math.cos(a) * R * 0.55, H * 0.62, Math.sin(a) * R * 0.55];
      B.tube([p0, p1, p2], [H * opt.bark, H * opt.bark * 0.6, H * opt.bark * 0.3], 4, [0, 0.3, 0.6], 0.25);
    }
  }
  const n = lod === 2 ? opt.farCards : lod === 1 ? opt.midCards : opt.cards;
  const tile = lod === 0 ? opt.tile : opt.farTile;
  const size0 = (lod === 2 ? opt.farCardSize : lod === 1 ? opt.midCardSize : opt.cardSize) * H;
  const nSk = Math.max(lod === 2 ? 3 : 5, Math.round(n * 0.16));
  for (let i = 0; i < n - nSk; i++) {
    const yy = -0.25 + 1.25 * r(), th = r() * TAU;
    const rr = Math.sqrt(Math.max(0, 1 - yy * yy));
    const dl = [Math.cos(th) * rr, yy, Math.sin(th) * rr];
    const lo = envReach(env, dl);
    const depth = lod ? 0.78 + r() * 0.17 : 0.55 + Math.pow(r(), 0.5) * 0.45;
    const p = [dl[0] * R * lo * depth, Math.max(0.08 * H, cy + dl[1] * Ry * lo * depth), dl[2] * R * lo * depth];
    const out = norm([dl[0], dl[1] * 0.8 + 0.25, dl[2]]);
    const f = cardFrame(out, r, 0.9);
    const size = size0 * (0.8 + r() * 0.4);
    const ao = Math.min(1, 0.14 + 0.5 * depth * lo * (0.45 + 0.55 * p[1] / H) + 0.3 * Math.max(0, yy));
    const tl = opt.innerTile !== undefined && lod === 0 && (depth < 0.7 || yy < 0.05) && r() < 0.75 ? opt.innerTile : tile;
    B.card(p, f.u, f.v, size, size, tl, out, 0.3 + 0.7 * Math.min(1, p[1] / H), ao, r());
  }
  // 裾：外向き・やや下向き、地面の少し下まで
  for (let j = 0; j < nSk; j++) {
    const a = ((j + r() * 0.7) / nSk) * TAU;
    const hz = [Math.cos(a), 0, Math.sin(a)];
    const rb = R * envReach(env, norm([hz[0], -0.2, hz[2]])) * 0.93;
    const size = size0 * (0.95 + r() * 0.3);
    const c = [hz[0] * rb, size * 0.32, hz[2] * rb];
    const u = [-hz[2], 0, hz[0]];
    const v = norm([-hz[0] * 0.3, 1, -hz[2] * 0.3]);
    const tl = opt.innerTile !== undefined && lod === 0 && r() < 0.5 ? opt.innerTile : tile;
    B.card(c, u, v, size, size * 0.85, tl, norm([hz[0], 0.1, hz[2]]), 0.25, 0.22 + 0.15 * r(), r());
  }
  return { geo: B.geometry(), height: H, crownR: R, crownY: cy, crownRy: Ry, crownC: [0, cy, 0] };
}

// 野の低木：2〜4個のずれた塊を重ねた不整形。塊は地面から少し浮いて、下に茎がのぞく
function shrubLumps(opt, seed, far) {
  const r = mulberry32(seed);
  const lod = far === true ? 2 : far === 'mid' ? 1 : 0;
  const B = new Builder();
  const H = opt.height;
  const R = H * opt.crownR;
  const nl = 2 + Math.floor(r() * 3);
  const lumps = [];
  let wsum = 0;
  for (let k = 0; k < nl; k++) {
    const a = r() * TAU, off = R * (k === 0 ? 0.08 : 0.32 + 0.25 * r());
    const rl = R * (k === 0 ? 0.62 : 0.4 + 0.18 * r()), ryl = rl * (0.7 + 0.25 * r());
    // 塊は低めに置く（下の隙間は茎が少しのぞく程度。高いと細い脚で立った玉に見える）
    const cy = Math.min(H - ryl * 0.85, Math.max(H * 0.06 + ryl * 0.55, H * (0.26 + 0.2 * r())));
    const env = makeEnvelope(r, [Math.cos(a) * off, cy, Math.sin(a) * off], rl, ryl, 0.32);
    const w = rl * (rl + ryl);
    wsum += w;
    lumps.push({ env, w });
  }
  if (lod === 0) {
    // 茎：根元から各塊の中へ（塊の下の隙間に見える）
    for (let k = 0; k < opt.stems; k++) {
      const L = lumps[k % nl].env;
      const a = r() * TAU;
      const p0 = [Math.cos(a) * 0.08 * H * 0.3, -0.2, Math.sin(a) * 0.08 * H * 0.3];
      const tgt = add(L.c, [(r() - 0.5) * L.R * 0.8, (r() - 0.2) * L.Ry * 0.6, (r() - 0.5) * L.R * 0.8]);
      const pm = add(lerp3(p0, tgt, 0.5), [(r() - 0.5) * 0.15 * H, 0, (r() - 0.5) * 0.15 * H]);
      B.tube([p0, pm, tgt], [H * opt.bark, H * opt.bark * 0.7, H * opt.bark * 0.35], 4, [0, 0.35, 0.65], 0.3);
    }
  }
  const n = lod === 2 ? opt.farCards : lod === 1 ? opt.midCards : opt.cards;
  const tile = lod === 0 ? opt.tile : opt.farTile;
  const size0 = (lod === 2 ? opt.farCardSize : lod === 1 ? opt.midCardSize : opt.cardSize) * H;
  const mc = [0, H * 0.5, 0];
  for (let i = 0; i < n; i++) {
    let pick = r() * wsum, L = lumps[0].env;
    for (const l of lumps) { pick -= l.w; if (pick <= 0) { L = l.env; break; } }
    // 下側はまばら（塊の下から茎と奥の暗がりがのぞく）
    let yy = r() * 2 - 1;
    if (yy < -0.2 && r() < 0.6) yy = -yy * 0.8;
    yy = Math.max(-0.6, yy);
    const th = r() * TAU, rr = Math.sqrt(Math.max(0, 1 - yy * yy));
    const dl = [Math.cos(th) * rr, yy, Math.sin(th) * rr];
    const lo = envReach(L, dl);
    const depth = lod ? 0.74 + r() * 0.2 : 0.5 + Math.pow(r(), 0.5) * 0.48;
    const p = add(L.c, [dl[0] * L.R * lo * depth, dl[1] * L.Ry * lo * depth, dl[2] * L.R * lo * depth]);
    p[1] = Math.max(0.1 * H, p[1]);
    const outL = norm([dl[0], dl[1] * 0.8 + 0.2, dl[2]]);
    const nrm = norm(add(outL, norm(sub(p, mc)), 0.7));
    const f = cardFrame(outL, r, 1.0);
    const size = size0 * (0.75 + r() * 0.45);
    const ao = Math.min(1, 0.16 + 0.5 * depth * lo * (0.5 + 0.5 * p[1] / H) + 0.3 * Math.max(0, yy));
    B.card(p, f.u, f.v, size, size, tile, nrm, 0.3 + 0.7 * Math.min(1, p[1] / H), ao, r());
  }
  const cy = H * 0.55;
  return { geo: B.geometry(), height: H, crownR: R * 0.95, crownY: cy, crownRy: H * 0.42, crownC: [0, cy, 0] };
}

// ---- 杉：まっすぐな幹、下は枯れ枝の跡だけ。輪生の枝が少し垂れて先が上がり、枝に沿って平たい房が重なる ----
export function cedar(opt, seed, far) {
  const r = mulberry32(seed);
  const lod = far === true ? 2 : far === 'mid' ? 1 : 0;
  const B = new Builder();
  const H = opt.height;
  const r0 = H * 0.013;
  const base = H * opt.crownBase;
  // 幹（わずかに曲がる）
  const tp = [], tr = [], ts = [];
  const bend = [(r() - 0.5) * 0.3, 0, (r() - 0.5) * 0.3];
  const NS = lod === 0 ? 10 : 4;
  for (let i = 0; i <= NS; i++) {
    const t = i / NS;
    // 幹の先は梢の葉の中で終わる
    tp.push([bend[0] * Math.sin(t * 3), -0.45 + t * (H - 0.2), bend[2] * Math.sin(t * 2.3)]);
    tr.push(r0 * (1.25 - 1.05 * Math.pow(t, 1.3)) + 0.01);
    ts.push(0.8 * t * t);
  }
  B.tube(tp, tr, lod === 0 ? 9 : lod === 1 ? 5 : 4, ts, tp.map((p) => 0.4 + 0.5 * p[1] / H), lod === 0 ? { flare: 0.7, flareN: 2, roots: 4, fph: r() * TAU } : {});
  const trunkAt = (y) => { const t = Math.max(0, Math.min(1, (y + 0.45) / (H + 0.25))); return [bend[0] * Math.sin(t * 3), y, bend[2] * Math.sin(t * 2.3)]; };
  const coneR = (y) => opt.radius * H * Math.pow(Math.max(0, 1 - (y - base) / (H - base)), 0.85) * (0.75 + 0.25 * Math.min(1, (y - base) / (H * 0.12)));
  const conicN = (c) => norm([c[0], 0.5 + (c[1] - base) / H * 0.4, c[2]]);
  if (lod === 0) {
    // 下枝の跡（短い枯れ枝）
    for (let y = H * 0.12; y < base; y += 0.5 + r() * 0.6) {
      if (r() < 0.45) continue;
      const a = r() * TAU;
      const p0 = trunkAt(y), d = norm([Math.cos(a), -0.1 - r() * 0.3, Math.sin(a)]);
      B.tube([p0, add(p0, d, 0.25 + r() * 0.5)], [0.02, 0.006], 3, [0.1, 0.2], 0.35);
    }
    // 輪生の枝と房
    let k = 0;
    for (let y = base; y < H - 0.25; y += opt.whorl * H * (0.8 + r() * 0.4)) {
      const f = (y - base) / (H - base);
      const rad = coneR(y) * (0.85 + r() * 0.3);
      const cnt = Math.max(3, Math.round(5 - f * 2));
      for (let j = 0; j < cnt; j++, k++) {
        const a = (j / cnt) * TAU + k * 0.7 + r() * 0.6;
        const hz = [Math.cos(a), 0, Math.sin(a)];
        const droop = -0.35 + f * 0.6 + (r() - 0.5) * 0.2;
        const p0 = trunkAt(y);
        const len = rad * (0.95 + r() * 0.25);
        // 枝：垂れてから先が上がる
        const pm = add(add(p0, hz, len * 0.5), [0, droop * len * 0.5, 0]);
        const p1 = add(add(p0, hz, len), [0, droop * len * 0.55 + len * 0.12, 0]);
        B.tube([p0, pm, p1], [0.035 * (1 - f * 0.6), 0.02, 0.006], 3, [0.3, 0.6, 0.9], 0.35 + 0.3 * f);
        // 房：枝の先の方に、上向きの平たい板＋斜めの板
        const nb = f > 0.8 ? 3 : len > 2.2 ? 6 : 5;
        for (let q = 0; q < nb; q++) {
          const t = 0.3 + 0.7 * (q + 0.3 + r() * 0.5) / nb;
          const c0 = t < 0.5 ? lerp3(p0, pm, t * 2) : lerp3(pm, p1, (t - 0.5) * 2);
          const w = Math.min(1.5, len * (0.4 + 0.25 * t)) * (0.85 + r() * 0.3) * (f > 0.85 ? 0.7 : 1);
          // 房は枝から少しずれて上下に重なる（段の棚にならず、でこぼこの塊に見える）
          const c = add(c0, [(r() - 0.5) * w * 0.35, (r() - 0.35) * w * 0.3, (r() - 0.5) * w * 0.35]);
          if (q % 3 === 1) {
            // 向きのばらけた房（横から見たときの厚みとぎざぎざの輪郭）
            const fr = cardFrame(norm([hz[0] * 0.6, 0.8, hz[2] * 0.6]), r, 1.5, hz);
            B.card(c, fr.v, fr.u, w * 0.65, w * 0.85, opt.tile, norm([hz[0], 0.55 + f * 0.3, hz[2]]), 0.35 + 0.6 * t, 0.3 + 0.5 * f + 0.15 * t, r());
          }
          const out = norm([hz[0], 0.55 + f * 0.3, hz[2]]);
          const side = norm(cross([0, 1, 0], hz));
          // 上から見た房（ほぼ水平、外へ傾く）
          const nUp = norm([hz[0] * 0.35 + (r() - 0.5) * 0.3, 1, hz[2] * 0.35 + (r() - 0.5) * 0.3]);
          const u1 = norm(cross(side, nUp).map((v) => -v));
          const v1 = norm(cross(nUp, u1));
          const ao = 0.3 + 0.55 * f + 0.15 * t;
          // 絵の小枝（縄）は板の縦に伸びる → 縦を枝の外向きに合わせ、付け根を幹の側に（小枝が枝先へ向かって伸びる）
          B.card(c, v1, u1.map((x) => -x), w * 0.75, w, opt.tile, out, 0.35 + 0.6 * t, ao, r());
          // 立った房（横から見て厚みが出る。小枝は垂れ下がる向き）
          const tilt = norm([hz[0] * 0.3, -1, hz[2] * 0.3]);
          if (q % 2 === 0) B.card(add(c, [0, -w * 0.1, 0]), hz, tilt, w * 0.9, w * 0.55, opt.tile, out, 0.35 + 0.6 * t, ao * 0.9, r());
        }
      }
    }
    // 梢：幹のまわりに小さく細い上向きの房（旗のような1枚にならないよう、向きを変えて何枚も）
    for (let q = 0; q < 7; q++) {
      const a = q * 2.4 + r() * 0.8;
      const y = H - 0.15 - q * 0.28 - r() * 0.15;
      const c = trunkAt(y);
      const hz = [Math.cos(a), 0, Math.sin(a)];
      const w = 0.28 + 0.07 * q;
      B.card(add(c, hz, w * 0.25), norm(cross([0, 1, 0], hz)), norm([hz[0] * 0.35, 1, hz[2] * 0.35]), w, w * 1.5, opt.tile, norm([hz[0], 1, hz[2]]), 0.95, 0.85 + 0.03 * q, r());
    }
    // 上の方の樹冠の芯：幹に沿った房（枝の間から幹が棒のように見えない）
    for (let y = H * 0.62; y < H - 0.8; y += 0.55 + r() * 0.3) {
      const a = r() * TAU, hz = [Math.cos(a), 0, Math.sin(a)];
      const w = 0.5 + 0.9 * (1 - (y - base) / (H - base));
      B.card(add(trunkAt(y), hz, w * 0.2), norm(cross([0, 1, 0], hz)), norm([hz[0] * 0.3, 1, hz[2] * 0.3]), w, w * 1.3, opt.tile, norm([hz[0], 0.8, hz[2]]), 0.7, 0.55 + 0.35 * (y - base) / (H - base), r());
    }
  } else {
    // 中景・遠景：円錐に沿った段の板
    // 中景は段を細かく、板を段ごとにずらして重ねる（なめらかな円錐に見えず、枝ごとの房の凸凹が残る）
    const tiers = lod === 2 ? 4 : 10;
    for (let t = 0; t < tiers; t++) {
      const y = base + (H - base) * (t + 0.5 + (lod === 2 ? 0 : (r() - 0.5) * 0.4)) / tiers;
      const rad = coneR(y) * (lod === 2 ? 1.05 : 0.95 + r() * 0.2);
      const cnt = lod === 2 ? 3 : 4 + (t < 5 ? 1 : 0);
      for (let k = 0; k < cnt; k++) {
        const a = (k / cnt) * TAU + t * 0.9 + r() * (lod === 2 ? 0.3 : 0.8);
        const out = [Math.cos(a), 0, Math.sin(a)];
        const c = [out[0] * rad * 0.5, y, out[2] * rad * 0.5];
        const u = [-out[2], 0, out[0]];
        const v = norm([out[0] * (0.35 + (lod === 2 ? 0 : (r() - 0.5) * 0.4)), 1, out[2] * 0.35]);
        const hh = (H - base) / tiers * (lod === 2 ? 2.0 : 2.3);
        B.card(c, u, v, rad * 2.0, hh, opt.farTile, conicN(c), Math.min(1, y / H), 0.35 + 0.6 * (y - base) / (H - base), r());
      }
    }
  }
  return { geo: B.geometry(), height: H, crownR: opt.radius * H, crownY: base + (H - base) * 0.4, crownRy: (H - base) * 0.55, crownC: [0, base + (H - base) * 0.4, 0] };
}

// ---- 竹：節のあるしなった稈、上の方の節から細い枝と垂れる葉の房 ----
export function bamboo(opt, seed, far) {
  const r = mulberry32(seed);
  const lod = far === true ? 2 : far === 'mid' ? 1 : 0;
  const B = new Builder();
  const H = opt.height;
  const rad = 0.06;
  const segs = lod === 2 ? 2 : lod === 1 ? 4 : 7;
  const bendDir = [(r() - 0.5) * 0.7, 0, (r() - 0.5) * 0.7];
  const at = (t) => [bendDir[0] * t * t * H * 0.14, -0.3 + t * H, bendDir[2] * t * t * H * 0.14];
  const pts = [], rads = [], sw = [];
  for (let s = 0; s <= segs; s++) { const t = s / segs; pts.push(at(t)); rads.push(rad * (1 - t * 0.6)); sw.push(t * t); }
  B.tube(pts, rads, lod === 0 ? 6 : 3, sw, pts.map((p) => 0.55 + 0.45 * p[1] / H), { nc: 1 });
  const n = lod === 2 ? 9 : lod === 1 ? 18 : opt.cards;
  for (let i = 0; i < n; i++) {
    const t = 0.45 + Math.pow(r(), 0.7) * 0.55;
    const cp = at(t);
    const a = r() * TAU;
    const out = norm([Math.cos(a), -0.15 - r() * 0.3, Math.sin(a)]);
    const len = H * (lod === 2 ? 0.34 : lod === 1 ? 0.24 : 0.13) * (0.8 + r() * 0.4);
    // 近景は細い枝も
    if (lod === 0 && i % 4 === 0) B.tube([cp, add(cp, norm([out[0], 0.25, out[2]]), len * 0.5)], [0.008, 0.003], 3, [t * t, Math.min(1, t * t + 0.2)], 0.6, { nc: 1 });
    const c = add(add(cp, norm([out[0], 0.2, out[2]]), len * 0.45), [0, -len * 0.1, 0]);
    const u = norm(cross([0, 1, 0], out));
    const v = norm([out[0] * 0.3, -1, out[2] * 0.3]).map((x) => -x);
    const nf = norm([out[0], 0.6, out[2]]);
    B.card(c, u, v, len * 0.85, len, lod === 0 ? TILE.BAMBOO : TILE.BAMBOO_DENSE, nf, Math.min(1, t * t + 0.15), 0.4 + 0.6 * t, r());
  }
  return { geo: B.geometry(), height: H, crownR: H * 0.1, crownY: H * 0.75, crownRy: H * 0.25, crownC: [0, H * 0.75, 0] };
}

// ---- 柳（枝垂れ柳） ----
// 太く少し傾いた幹が低く（約2〜2.6m）3〜5本の大枝に分かれ、大枝は立ち上がってから外へ弓なりにかぶさる。
// 大枝から出る枝は外へ弧を描き（噴水のように上がってから下がる）、その節ごとに細い枝垂れの小枝の束が下がる。
// 束は樹冠の上ほど重なって厚く、外ほど長くまばらで、地面近くまで届くものもある。内側の束は短い（中空の筒にならない）。
// 束は付け根で細くまとまる曲がった帯で、葉の絵を縦に何回か継ぐ（葉の大きさを保つ）。帯の向きはばらばらで、束の間から向こうが透ける
export function willow(opt, seed, far) {
  const lod = far === true ? 2 : far === 'mid' ? 1 : 0;
  const r = mulberry32(seed);
  const rc = mulberry32(seed + 31 + lod * 7);
  const B = new Builder();
  const H = opt.height;
  const r0 = H * 0.036;
  const trunkH = H * (0.2 + 0.06 * r());
  const la = r() * TAU, lean = H * (0.035 + 0.04 * r());
  const lx = Math.cos(la) * lean, lz = Math.sin(la) * lean;
  const tAt = (y) => { const f = Math.max(0, y) / trunkH; return [lx * f * f, y, lz * f * f]; };
  const fph = r() * TAU;
  const branches = [];
  branches.push({ pts: [[0, -0.45, 0], tAt(trunkH * 0.3), tAt(trunkH * 0.65), tAt(trunkH), tAt(trunkH * 1.22)], rads: [r0 * 1.3, r0 * 1.08, r0, r0 * 0.92, r0 * 0.45], sw: [0, 0.02, 0.05, 0.08, 0.1], order: 0 });
  const Rc = H * 0.5;
  const NB = 4 + Math.floor(r() * 3);
  const a0 = r() * TAU;
  const limbs = [];
  for (let i = 0; i < NB; i++) {
    const a = a0 + (i / NB) * TAU + (r() - 0.5) * 0.7;
    const hz = [Math.cos(a), 0, Math.sin(a)];
    const hy = trunkH * (0.82 + 0.3 * r());
    const tb = tAt(hy);
    const P0 = [tb[0] + hz[0] * r0 * 0.3, hy, tb[2] + hz[2] * r0 * 0.3];
    const el = 0.95 + 0.35 * r();
    const reach = Rc * (0.5 + 0.35 * r());
    const P3 = [lx + hz[0] * reach, H * (0.72 + 0.18 * r()), lz + hz[2] * reach];
    const L = Math.hypot(...sub(P3, P0));
    const P1 = add(P0, [hz[0] * Math.cos(el), Math.sin(el), hz[2] * Math.cos(el)], L * 0.45);
    const P2 = add(P3, [-hz[0] * 0.3 * L, 0.06 * L, -hz[2] * 0.3 * L]);
    const side = [-hz[2], 0, hz[0]], wph = r() * TAU;
    const rb = r0 * (0.5 + 0.1 * r());
    const pts = [], rads = [], sw = [];
    for (let k = 0; k <= 8; k++) {
      const t = k / 8;
      pts.push(add(bez3(P0, P1, P2, P3, t), side, 0.012 * H * Math.sin(Math.PI * t) * Math.sin(wph + t * 6)));
      rads.push(rb * (1 - 0.78 * Math.pow(t, 0.9)));
      sw.push(0.1 + 0.3 * t);
    }
    const br = { pts, rads, sw, order: 1 };
    branches.push(br);
    limbs.push(br);
  }
  const ptOn = (b, t) => {
    const n = b.pts.length - 1, f = t * n, i = Math.min(n - 1, Math.floor(f)), u = f - i;
    return [lerp3(b.pts[i], b.pts[i + 1], u), b.rads[i] + (b.rads[i + 1] - b.rads[i]) * u, b.sw[i] + (b.sw[i + 1] - b.sw[i]) * u];
  };
  // 枝と、垂れる小枝の付け根
  const hang = [];
  for (const lb of limbs) {
    const K = 8 + Math.floor(r() * 4);
    for (let k = 0; k < K; k++) {
      const t = 0.2 + 0.8 * (k + r()) / K;
      const [A, ra, swa] = ptOn(lb, t);
      const ang = Math.atan2(A[2] - lz * 0.5, A[0] - lx * 0.5) + (r() - 0.5) * 1.8;
      const od = [Math.cos(ang), 0, Math.sin(ang)];
      const len = H * (0.16 + 0.18 * r()) * (0.6 + 0.5 * t);
      const up = 0.2 + 0.35 * r();
      const M = add(add(A, od, len * 0.5), [0, len * up, 0]);
      const E = add(add(A, od, len), [0, len * (up - 0.4), 0]);
      const pts = [], rads = [], sw = [];
      for (let q = 0; q <= 4; q++) { const u = q / 4; pts.push(bez2(A, M, E, u)); rads.push(Math.min(ra * 0.6, 0.032) * (1 - 0.75 * u)); sw.push(swa + (0.7 - swa) * u); }
      branches.push({ pts, rads, sw, order: 2 });
      // 弧の頂のあたりから先まで（枝の上に葉のない棒が残らない）
      for (let q = 0; q < 7; q++) {
        const u = 0.06 + 0.94 * (q + r()) / 7;
        hang.push({ p: bez2(A, M, E, u), od, sw: swa + (0.7 - swa) * u, u });
      }
    }
    // 大枝の上の方からも（樹冠の頂に葉のない大枝が見えない）
    for (let k = 0; k < 7; k++) {
      const [Pe, , swe] = ptOn(lb, 0.3 + 0.7 * (k + r()) / 7);
      hang.push({ p: Pe, od: norm([Pe[0] - lx + (r() - 0.5) * 0.5, 0, Pe[2] - lz + (r() - 0.5) * 0.5]), sw: swe + 0.1 });
    }
  }
  // 放す（中景は大枝まで、遠景は幹だけ）
  const sidesO = lod === 0 ? [10, 6, 3] : lod === 1 ? [5, 3, 3] : [4, 3, 3];
  const maxOrd = lod === 0 ? 2 : lod === 1 ? 1 : 0;
  for (const b of branches) {
    if (b.order > maxOrd) continue;
    let pts = b.pts, rads = b.rads, sw = b.sw;
    if (lod > 0 && b.order > 0) { const keep = pts.map((_, i) => i).filter((i) => i % 2 === 0 || i === pts.length - 1); pts = keep.map((i) => b.pts[i]); rads = keep.map((i) => b.rads[i]); sw = keep.map((i) => b.sw[i]); }
    B.tube(pts, rads, sidesO[b.order], sw, pts.map((p) => 0.45 + 0.4 * Math.min(1, p[1] / H)), b.order === 0 ? { flare: 0.7, flareN: 1, roots: 5, fph } : {});
  }
  // 垂れる小枝の束
  const tile = TILE.WILLOW;
  const tx = (tile % ATLAS_N) / ATLAS_N, ty = Math.floor(tile / ATLAS_N) / ATLAS_N;
  const inset = 0.004, sz = 1 / ATLAS_N - inset * 2;
  const keep = lod === 0 ? 1 : lod === 1 ? 0.3 : 0.1;
  const wid = (lod === 0 ? 0.27 : lod === 1 ? 0.85 : 1.9) * H / 10;
  const rep = lod === 0 ? 1.5 : lod === 1 ? 2.6 : 4.2;
  const uw = lod === 0 ? 0.2 : lod === 1 ? 0.6 : 1;
  for (const h of hang) {
    if (rc() > keep) continue;
    const o = Math.min(1.15, Math.hypot(h.p[0] - lx * 0.5, h.p[2] - lz * 0.5) / Rc);
    const yaw0 = rc() * Math.PI;
    for (let j = 0; j < 2; j++) {
      // 外の束ほど長い（地面近くまで）。内の束は短い
      const L0 = h.p[1] * (0.32 + 0.62 * Math.pow(Math.min(1, o), 1.2)) * (0.72 + 0.4 * rc()) * (h.u !== undefined && h.u < 0.3 ? 0.55 + 1.5 * h.u : 1);
      const L = Math.max(0.8, Math.min(L0, h.p[1] - 0.25));
      const yaw = yaw0 + j * (Math.PI / 2) + (rc() - 0.5) * 0.6;
      const sd = [Math.cos(yaw), 0, Math.sin(yaw)];
      const w = wid * (0.75 + 0.5 * rc());
      const od = h.od;
      const bow = (0.35 + 0.5 * rc()) * Math.min(1, L / 2.5) * (H / 10);
      const nrep = Math.max(1, Math.round(L / rep));
      const segs = nrep * 2;
      const u0 = rc() * (1 - uw);
      const st = add(add(h.p, sd, (rc() - 0.5) * 0.2), [0, 0.06, 0]);
      const ph = rc();
      const nrm = norm([od[0], 0.35, od[2]]);
      const aoTop = 0.3 + 0.55 * Math.min(1, o);
      for (let m = 0; m < nrep; m++) {
        const base = B.count;
        for (let q = 0; q <= 2; q++) {
          const f = (m * 2 + q) / segs;
          const hx = bow * Math.sqrt(f);
          const c = [st[0] + od[0] * hx, st[1] - f * L, st[2] + od[2] * hx];
          const vv = ty + inset + (q / 2) * sz;
          const ao = Math.min(1, aoTop + (1 - aoTop) * 0.35 * f);
          const sway = h.sw + (1 - h.sw) * f;
          const hw = w * 0.5 * (0.6 + 0.4 * Math.sqrt(f));
          for (const sg of [-1, 1]) {
            const uu = tx + inset + (u0 + (sg * 0.5 + 0.5) * uw) * sz;
            B.vert(add(c, sd, sg * hw), nrm, uu, vv, sway, 1, ao, ph);
          }
        }
        for (let q = 0; q < 2; q++) { const a = base + q * 2; B.idx.push(a, a + 1, a + 3, a, a + 3, a + 2); }
      }
    }
  }
  const cy = H * 0.6;
  return { geo: B.geometry(), height: H, crownR: Rc * 1.05, crownY: cy, crownRy: H * 0.42, crownC: [lx * 0.5, cy, lz * 0.5] };
}

// ---- 一本桜（染井吉野の古木） ----
// 太く短い幹が2〜3mで5〜6本の大枝に分かれ、斜め上へ伸びてから外へ寝る。樹冠は高さより幅の広い丸い傘。
// 花は枝先ごとの雲のような塊（直径4〜5m）に付いて傘の面を覆い、塊の間と下から枝がのぞく。外の枝先は弧を描いて少し垂れる。
// 傘の裾の高さは向きごとに違う（重い枝が低く垂れる向きと、裾が上がって大枝が見える向き）。骨格は段によらず同じ
const bez2 = (a, b, c, t) => { const u = 1 - t; return [a[0] * u * u + 2 * b[0] * u * t + c[0] * t * t, a[1] * u * u + 2 * b[1] * u * t + c[1] * t * t, a[2] * u * u + 2 * b[2] * u * t + c[2] * t * t]; };
const bez3 = (a, b, c, d, t) => {
  const u = 1 - t, k0 = u * u * u, k1 = 3 * u * u * t, k2 = 3 * u * t * t, k3 = t * t * t;
  return [a[0] * k0 + b[0] * k1 + c[0] * k2 + d[0] * k3, a[1] * k0 + b[1] * k1 + c[1] * k2 + d[1] * k3, a[2] * k0 + b[2] * k1 + c[2] * k2 + d[2] * k3];
};
const randUnit = (r) => { const z = r() * 2 - 1, a = r() * TAU, s = Math.sqrt(1 - z * z); return [Math.cos(a) * s, z, Math.sin(a) * s]; };
const sat01 = (x) => Math.max(0, Math.min(1, x));

function cherryDome(opt, seed, far) {
  const lod = far === true ? 2 : far === 'mid' ? 1 : 0;
  const r = mulberry32(seed);
  const rc = mulberry32(seed + 77 + lod * 5);
  const H = opt.height;
  const r0 = H * opt.bark;
  const trunkH = H * (opt.trunkH ?? 0.15);
  // 塊の中心が並ぶ楕円体（中心の高さ yc・横 Rl・縦 Ryl）と塊の半径の基準
  const Rl = H * opt.spread, Ryl = H * opt.rise, yc = H * opt.domeY, lr0 = H * (opt.lumpR ?? 0.125);
  const branches = [], lumps = [], extra = [];
  // 向きごとのゆらぎ：傘の張り・裾の垂れ
  const hp = [r() * TAU, r() * TAU, r() * TAU];
  const spreadAt = (th) => 1 + 0.07 * Math.sin(2 * th + hp[0]) + 0.05 * Math.sin(3 * th + hp[1]);
  const droopAt = (th) => sat01(0.5 + 0.35 * Math.sin(3 * th + hp[2]) + 0.25 * Math.sin(5 * th + hp[0]));
  // 並木：樹冠を川の側（木の座標の+x）へずらし、+x側へ長く張る（となりの木と枝が重なって花のトンネルになる）。一本桜は 0
  const ox = H * (opt.offX ?? 0), asym = opt.asym ?? 0;
  const A = (th) => 1 + asym * Math.cos(th);
  const low = [ox * 0.6, yc - Ryl * 0.45, 0];
  // 幹：短く太い。根元は少しだけ張る
  const lean = [(r() - 0.5) * 0.05 * H, 0, (r() - 0.5) * 0.05 * H];
  const tAt = (y) => { const f = Math.max(0, y) / trunkH; return [lean[0] * f * f, y, lean[2] * f * f]; };
  const fph = r() * TAU;
  branches.push({ pts: [[0, -0.5, 0], tAt(0.9), tAt(trunkH * 0.55), tAt(trunkH * 0.85), tAt(trunkH * 1.08), tAt(trunkH * 1.3)], rads: [r0 * 1.22, r0 * 1.06, r0, r0 * 0.96, r0 * 0.78, r0 * 0.22], sw: [0, 0.02, 0.05, 0.08, 0.1, 0.11], order: 0 });
  // 大枝：幹の上から放射状に。斜め上へ立ち上がってから外へ寝る（3次の曲線＋ゆるいくねり）。2本はやや立って傘の頂へ
  const NB = opt.limbs ?? 6;
  const limbs = [];
  const a0 = r() * TAU;
  for (let i = 0; i < NB; i++) {
    let a = a0 + (i / NB) * TAU + (r() - 0.5) * 0.55;
    if (opt.limbBias) a = Math.atan2(Math.sin(a), Math.cos(a) + opt.limbBias);
    const leader = i % 3 === 1;
    const hz = [Math.cos(a), 0, Math.sin(a)];
    const hy = trunkH * (0.74 + 0.32 * ((i * 7) % NB) / NB + 0.06 * r());
    const tb = tAt(hy);
    const P0 = [tb[0] + hz[0] * r0 * 0.3, hy, tb[2] + hz[2] * r0 * 0.3];
    const el = leader ? 1.05 + 0.2 * r() : 0.62 + 0.3 * r();
    const ha = a + (r() - 0.5) * 0.25;
    const reach = Rl * spreadAt(ha) * A(ha) * (leader ? 0.3 + 0.12 * r() : 0.56 + 0.16 * r());
    const endY = leader ? yc + Ryl * (0.5 + 0.15 * r()) : yc + Ryl * (0.02 + 0.28 * r()) - droopAt(ha) * Ryl * 0.15;
    const P3 = [Math.cos(ha) * reach + ox * 0.8, endY, Math.sin(ha) * reach];
    const L = Math.hypot(...sub(P3, P0));
    const P1 = add(P0, [hz[0] * Math.cos(el), Math.sin(el), hz[2] * Math.cos(el)], L * 0.38);
    const P2 = add(P3, [Math.cos(ha), 0, Math.sin(ha)], -L * 0.3);
    P2[1] += (leader ? -0.05 : 0.04) * L;
    const side = [-hz[2], 0, hz[0]];
    const wph = r() * TAU, wph2 = r() * TAU, wA = (0.18 + 0.2 * r()) * H / 18;
    const rb = r0 * (leader ? 0.42 : 0.5 + 0.08 * r());
    const pts = [], rads = [], sw = [];
    for (let k = 0; k <= 10; k++) {
      const t = k / 10, env = Math.sin(Math.PI * t);
      const p = add(bez3(P0, P1, P2, P3, t), side, wA * env * Math.sin(wph + t * 7.5));
      p[1] += wA * 0.6 * env * Math.sin(wph2 + t * 9.0);
      pts.push(p);
      // 先は細く絞る（先の枝へ受け渡す。切り株のような太い先にしない）
      rads.push(rb * (1 - 0.66 * Math.pow(t, 0.85) - 0.22 * Math.pow(t, 6)));
      sw.push(0.1 + 0.3 * t);
    }
    const br = { pts, rads, sw, order: 1 };
    branches.push(br);
    limbs.push(br);
  }
  const limbPt = (b, t) => {
    const n = b.pts.length - 1, f = t * n, i = Math.min(n - 1, Math.floor(f)), u = f - i;
    return [lerp3(b.pts[i], b.pts[i + 1], u), b.rads[i] + (b.rads[i + 1] - b.rads[i]) * u, b.sw[i] + (b.sw[i + 1] - b.sw[i]) * u];
  };
  // 花の塊：傘の面に黄金角で一様に並べる。上半分は楕円の弧、赤道より下は内へ巻かずに外の縁のまま垂れ下がる（傘の裾）。
  // 裾は垂れる向きだけ低くまで。上の方ほど大きい
  const NL = opt.lumps ?? 60;
  const s0 = Math.sin(-0.5), s1 = Math.sin(1.42);
  for (let i = 0; i < NL; i++) {
    const th = a0 + i * 2.39996 + (r() - 0.5) * 0.45;
    const ph = Math.asin(Math.max(-1, Math.min(1, s0 + (s1 - s0) * (i + 0.5 + (r() - 0.5) * 0.8) / NL)));
    const skip = ph < (opt.skirt0 ?? 0.14) - (opt.skirtK ?? 0.5) * droopAt(th);
    const sc = spreadAt(th) * (0.9 + 0.14 * r()), ky = 0.92 + 0.12 * r(), kr = 0.66 + 0.6 * r();
    if (skip) continue;
    const at = (q) => { const k = (q >= 0 ? Math.cos(q) : 1 - 0.12 * q) * Rl * sc * A(th); return [ox + Math.cos(th) * k, yc + Math.sin(q) * Ryl * ky * (q >= 0 ? 1 : 1.2), Math.sin(th) * k]; };
    const rl = lr0 * kr * (0.72 + 0.34 * sat01((ph + 0.5) / 1.3));
    lumps.push({ c: at(ph), r: rl, kind: 0 });
    // 垂れた裾の塊は、上の傘の縁とのあいだにもう一つ（離れた玉がぶら下がって見えないよう、裾を一続きに）
    if (ph < -0.08) lumps.push({ c: at(ph * 0.45), r: rl * 0.9, kind: 0 });
  }
  lumps.push({ c: [ox * 0.5 + (r() - 0.5) * 1.5, yc + Ryl, (r() - 0.5) * 1.5], r: lr0 * 1.1, kind: 0 });
  // 内側の塊（傘の下から見上げたとき、花の天井に段がつく）
  for (let i = 0; i < (opt.innerLumps ?? 9); i++) {
    const th = r() * TAU, ph = 0.25 + 0.9 * r(), k = 0.45 + 0.2 * r();
    const kk = Math.cos(ph) * Rl * k * A(th);
    lumps.push({ c: [ox * 0.7 + Math.cos(th) * kk, yc + Math.sin(ph) * Ryl * k, Math.sin(th) * kk], r: lr0 * (0.55 + 0.25 * r()), kind: 1 });
  }
  // 枝：塊ごとに、近い大枝の先の方から塊の芯へ。付け根は近い点のまわりに散らす（一点から扇に出ない）。
  // 弧を描き（下の塊へは外へ出てから垂れる）、節ごとに少し折れる
  for (const Lm of lumps) {
    Lm.oc = norm(sub(Lm.c, low));
    const cand = [];
    let bd = 1e9;
    for (const b of limbs) for (let k = 4; k <= 10; k++) {
      const d = Math.hypot(...sub(Lm.c, limbPt(b, k / 10)[0]));
      cand.push({ b, t: k / 10, d });
      bd = Math.min(bd, d);
    }
    let wsum = 0;
    for (const c of cand) { c.w = Math.exp(-(c.d - bd) / 0.9); wsum += c.w; }
    let pick = r() * wsum, ch0 = cand[0];
    for (const c of cand) { pick -= c.w; if (pick <= 0) { ch0 = c; break; } }
    const ta = Math.min(1, Math.max(0.36, ch0.t + (r() - 0.5) * 0.12));
    const [A, ra, swa] = limbPt(ch0.b, ta);
    const T = add(Lm.c, Lm.oc, Lm.r * 0.15);
    const ch = sub(T, A), D = Math.hypot(...ch);
    const sd = norm(cross(ch, [0, 1, 0]));
    const M = add(add(add(A, ch, 0.5), [0, 0.16 * D, 0]), sd, (r() - 0.5) * 0.3 * D);
    const n = Math.max(3, Math.min(7, Math.round(D / 0.9)));
    const rb0 = Math.min(ra * 0.62, 0.03 + 0.017 * D);
    const pts = [], rads = [], sw = [];
    for (let k = 0; k <= n; k++) {
      const t = k / n, j = k > 0 && k < n ? 0.05 * D * Math.sin(Math.PI * t) : 0;
      pts.push(add(bez2(A, M, T, t), [(r() - 0.5) * j, (r() - 0.5) * j * 0.6, (r() - 0.5) * j]));
      rads.push(rb0 * (1 - 0.72 * t));
      sw.push(swa + (0.75 - swa) * t);
    }
    branches.push({ pts, rads, sw, order: 2 });
    Lm.end = T; Lm.sway = 0.8; Lm.bpts = pts;
    // 長い枝の途中にも花の房
    if (D > (opt.extraD ?? 3.2) && Lm.kind === 0) {
      const m = D > (opt.extraD2 ?? 6) ? 2 : 1;
      for (let q = 0; q < m; q++) {
        const tq = 0.4 + 0.4 * ((q + r()) / m);
        const p = bez2(A, M, T, tq);
        const c = add(p, [0, 0.2, 0]);
        extra.push({ c, end: c, r: lr0 * (0.3 + 0.15 * r()), kind: 2, sway: 0.4 + 0.4 * tq, oc: norm(sub(c, low)) });
      }
    }
  }
  // 胴吹き：大枝の付け根寄りと幹に、小さな花の房
  for (let i = 0; i < (opt.dobuki ?? 8); i++) {
    const onTrunk = i < 2;
    const b = onTrunk ? branches[0] : limbs[Math.floor(r() * limbs.length)];
    const [p, rr, s] = onTrunk ? [tAt(trunkH * (0.45 + 0.4 * r())), r0, 0.05] : limbPt(b, 0.1 + 0.45 * r());
    const a = r() * TAU, dd = norm([Math.cos(a), 0.3 + 0.4 * r(), Math.sin(a)]);
    const c = add(p, dd, rr + 0.12);
    extra.push({ c, end: c, r: 0.26 + 0.14 * r(), kind: 3, sway: s + 0.2, oc: norm([dd[0], 0.3, dd[2]]) });
  }
  // 塊の中の小枝（近景だけ）：枝の先の方の別々の節から、外へ分かれる細い枝。先は花の中で終わる
  const twigs = [];
  if (lod === 0) for (const Lm of lumps) {
    const P = Lm.bpts, np = P.length - 1;
    const K = 2 + Math.floor(rc() * 2);
    for (let k = 0; k < K; k++) {
      const i0 = Math.max(1, np - 1 - Math.floor(rc() * Math.min(3, np - 1)));
      const p0 = lerp3(P[i0], P[Math.min(np, i0 + 1)], rc());
      const d = norm(add(add(randUnit(rc), Lm.oc, 1.1), [0, 0.15, 0]));
      const tgt = add(Lm.c, d, Lm.r * (0.35 + 0.3 * rc()));
      const m = add(lerp3(p0, tgt, 0.5), [0, 0.05 * Lm.r, 0]);
      twigs.push({ pts: [p0, m, tgt], rads: [0.022, 0.013, 0.005], sw: [0.7, 0.85, 1], order: 3 });
    }
  }
  // 放す
  const B = new Builder();
  const sidesO = lod === 0 ? (opt.sides0 || [12, 8, 5, 3]) : lod === 1 ? [6, 4, 3, 3] : [4, 3, 3, 3];
  const maxOrd = lod === 0 ? 3 : lod === 1 ? (opt.midOrd ?? 2) : 1;
  const qd = (p) => Math.min(1.2, Math.hypot(Math.hypot(p[0], p[2]) / (Rl + lr0), (p[1] - yc) / (Ryl + lr0)));
  for (const b of branches.concat(twigs)) {
    if (b.order > maxOrd) continue;
    let pts = b.pts, rads = b.rads, sw = b.sw;
    if (lod > 0 && b.order > 0 && pts.length > 4) {
      const keep = pts.map((_, i) => i).filter((i) => i % 2 === 0 || i === pts.length - 1);
      pts = keep.map((i) => b.pts[i]); rads = keep.map((i) => b.rads[i]); sw = keep.map((i) => b.sw[i]);
    }
    const ao = pts.map((p) => Math.min(1, 0.3 + 0.45 * qd(p) + 0.15 * Math.min(1, p[1] / H)));
    B.tube(pts, rads, sidesO[b.order], sw, ao, b.order === 0 ? { flare: 0.42, flareN: 1, roots: 6, fph } : {});
  }
  // 花の板：塊の面積に比例して配る。塊の外側（木の中心の反対）に多く、内側は薄い。板は塊の外を向き、向きは乱す（枝の向きにそろえない）
  const n = lod === 0 ? opt.cards : lod === 1 ? opt.midCards : opt.farCards;
  const tile = lod === 0 ? TILE.SAKURA : TILE.SAKURA_DENSE;
  const size0 = (lod === 0 ? opt.cardSize : lod === 1 ? opt.midCardSize : opt.farCardSize) * H;
  // 遠景は傘の塊だけ（外側に厚く）
  const all = lumps.concat(extra).filter((Lm) => (lod === 0 || Lm.kind !== 3) && (lod < 2 || Lm.kind === 0));
  let wsum = 0;
  for (const Lm of all) { Lm.w = Lm.r * Lm.r * (Lm.kind === 1 ? 0.6 : 1); wsum += Lm.w; }
  const yLo = yc - Ryl * 0.6, yHi = yc + Ryl;
  const iK = opt.innerK ?? 0.22;   // 塊の内側（木の中心の側）の板の割合。並木は下から見上げるので多め
  let acc = 0, idx = 0;
  for (const Lm of all) {
    const hl = Math.hypot(Lm.c[0] - ox, Lm.c[2]) || 1;
    Lm.hx = (Lm.c[0] - ox) / hl; Lm.hz = Lm.c[2] / hl;
    acc += Lm.w;
    const upto = Math.round((n * acc) / wsum);
    const up01 = sat01((Lm.c[1] - yLo) / (yHi - yLo));
    for (; idx < upto; idx++) {
      let d = randUnit(rc);
      for (let k = 0; k < 6 && rc() > iK + (1 - iK) * sat01(0.45 + 0.65 * dot(d, Lm.oc)); k++) d = randUnit(rc);
      const dep = lod === 0 ? 0.48 + 0.52 * Math.sqrt(rc()) : lod === 1 ? 0.66 + 0.32 * Math.sqrt(rc()) : 0.72 + 0.24 * Math.sqrt(rc());
      // 塊は横に広い座布団形で、外向き（枝の伸びる向き）に少し長い（枝に沿って花が層になる。垂れた房がぶどうの玉にならない）
      const ex = 0.3 * (d[0] * Lm.hx + d[2] * Lm.hz);
      const p = [Lm.c[0] + (d[0] * 1.05 + Lm.hx * ex) * Lm.r * dep, Lm.c[1] + d[1] * Lm.r * dep * 0.7, Lm.c[2] + (d[2] * 1.05 + Lm.hz * ex) * Lm.r * dep];
      const nrm = norm(add(add(d, Lm.oc, 0.7), [0, 0.25, 0]));
      const f = cardFrame(nrm, rc, lod === 0 ? 0.9 : 0.7);
      const size = size0 * (0.75 + 0.5 * rc()) * (Lm.kind >= 2 ? 0.85 : 1);
      const de = sat01((dep - 0.48) / 0.52);
      const ao = Math.min(1, 0.14 + 0.86 * Math.pow(de, 0.8) * (0.55 + 0.45 * (d[1] * 0.5 + 0.5)) * (0.72 + 0.28 * up01));
      B.card(p, f.u, f.v, size, size, tile, nrm, Lm.sway ?? 0.8, ao, rc());
    }
  }
  const cR = Rl * (1 + asym * 0.4) + lr0 * 0.8, cRy = Ryl + lr0 * 0.8;
  return { geo: B.geometry(), height: H, crownR: cR, crownY: yc, crownRy: cRy, crownC: [ox * 0.8, yc, 0] };
}

// ---- 桜（染井吉野）：低く太い幹が数本の大枝に分かれ、斜め上へ伸びてから横へ大きく張る。花は枝に沿って雲のように付く ----
export function cherry(opt, seed, far) {
  if (opt.dome) return cherryDome(opt, seed, far);
  // 川沿いの並木：一本桜と同じ作り方を小さく・軽く（opt.row の値で上書き）
  if (opt.row) return cherryDome({ ...opt, ...opt.row }, seed, far);
  const r = mulberry32(seed);
  const lod = far === true ? 2 : far === 'mid' ? 1 : 0;
  const H = opt.height;
  const S = H / 9;
  const trunkH = H * 0.22;
  const r0 = H * opt.bark;
  const dC = [0, trunkH + H * (opt.rise ?? 0.48), 0], dR = H * (opt.spread ?? 0.52), dRy = H * (opt.rise ? 0.36 : 0.33);
  const env = makeEnvelope(r, dC, dR, dRy, 0.28, 0.25);
  const branches = [], sites = [];
  const lean = [(r() - 0.5) * 0.5 * S, 0, (r() - 0.5) * 0.5 * S];
  const top = [lean[0], trunkH, lean[2]];
  const top2 = [lean[0] * 1.15, trunkH * 1.18, lean[2] * 1.15];
  branches.push({ pts: [[0, -0.5, 0], [lean[0] * 0.35, trunkH * 0.45, lean[2] * 0.35], [lean[0] * 0.8, trunkH * 0.85, lean[2] * 0.8], top, top2, [lean[0] * 1.2, trunkH * 1.32, lean[2] * 1.2]], rads: [r0 * 1.35, r0 * 1.08, r0 * 1.0, r0 * 0.92, r0 * 0.62, r0 * 0.12], sw: [0, 0.03, 0.07, 0.1, 0.12, 0.13], order: 0 });
  const segs = [0, 8, 5, 3];
  const grow = (p0, dir, len, rad, order, sw0, droopK) => {
    const n = segs[order];
    const pts = [p0], rads = [rad], sw = [sw0];
    let p = p0, d = dir;
    // 大枝のくねり：ゆっくり回る曲がり
    const side = norm(cross(d, [0, 1, 0]));
    const cph = r() * TAU, cph2 = r() * TAU, cA = order === 1 ? 0.26 : 0.16;
    for (let k = 1; k <= n; k++) {
      const t = k / n;
      // 大枝は斜め上→横へ寝る。先の枝はやや垂れる
      const trop = order === 1 ? -0.1 * t : order === 2 ? -0.03 * droopK : 0.03;
      const wb = order === 1 ? 0.25 : 0.35;
      const cv = (Math.sin(cph + t * 5.5) * 0.7 + Math.sin(cph2 + t * 11.0) * 0.45) * cA;
      d = norm([d[0] + (r() - 0.5) * wb + side[0] * cv, d[1] + trop + (r() - 0.5) * 0.14 + cv * 0.4, d[2] + (r() - 0.5) * wb + side[2] * cv]);
      // 垂れすぎない：樹冠の底より下へは行かない
      const floorY = env.c[1] - env.Ry * (order === 1 ? 0.75 : 0.95);
      if (p[1] + d[1] * len / n < floorY) d = norm([d[0], Math.max(d[1], 0.08), d[2]]);
      let q = add(p, d, len / n);
      const e = env.q(q);
      // 樹冠の下半分より下では曲げない（幹の分かれ目で大枝が立ち上がらないよう）
      if (e > 1 && q[1] > env.c[1] - env.Ry * 0.45) { const inward = norm(sub(env.c, q)); d = norm(add(d, inward, Math.min(1.2, (e - 1) * 3))); q = add(p, d, (len / n) * 0.75); }
      pts.push(q);
      rads.push(rad * (1 - (order === 1 ? 0.75 : 0.9) * Math.pow(t, 0.85)));
      sw.push(sw0 + ([0, 0.45, 0.8, 1][order] - sw0) * t);
      p = q;
    }
    branches.push({ pts, rads, sw, order });
    const along = (t) => {
      const f = t * n, i = Math.min(n - 1, Math.floor(f)), u = f - i;
      return [lerp3(pts[i], pts[i + 1], u), norm(sub(pts[i + 1], pts[i])), rads[i] + (rads[i + 1] - rads[i]) * u, sw[i] + (sw[i + 1] - sw[i]) * u];
    };
    if (order < 3) {
      const nk = order === 1 ? opt.twigs + 4 : 6;
      const phi0 = r() * TAU;
      for (let c = 0; c < nk; c++) {
        const t = 0.2 + 0.8 * (c + 0.2 + 0.6 * r()) / nk;
        const [pp, tt, rr, ss] = along(t);
        let cd = deviate(tt, (order === 1 ? 0.75 : 0.6) * (0.75 + 0.5 * r()), phi0 + c * 2.39996);
        // 横へ広がる（上へは立ちすぎない）：仰角を抑える
        cd = limitElev(cd, order === 1 ? 0.62 : 0.4, r);
        const cl = len * (order === 1 ? 0.55 : 0.5) * (1 - 0.45 * t) * (0.8 + 0.4 * r());
        grow(pp, cd, cl, rr * (order === 1 ? 0.45 : 0.5), order + 1, ss, 0.5 + r());
      }
    }
    // 大枝の付け根寄りから、幹の真上へ立ち上がる内側の枝（見上げたとき分かれ目の上が空っぽにならない）
    if (order === 1) {
      for (let c = 0; c < (opt.innerBr ?? 2); c++) {
        const t = 0.12 + 0.25 * r();
        const [pp, tt, rr, ss] = along(t);
        const toAx = norm([-pp[0] + (r() - 0.5) * 0.6, 0, -pp[2] + (r() - 0.5) * 0.6]);
        const cd = norm(add(add([0, 1, 0], toAx, 0.35 + 0.35 * r()), tt, 0.3));
        grow(pp, cd, len * (0.3 + 0.12 * r()), rr * 0.28, 2, ss, 0.3);
      }
    }
    if (order >= 2) {
      const m = order === 3 ? opt.sitesPer : 3;
      for (let k = 0; k < m; k++) {
        const t = order === 3 ? 0.15 + 0.85 * (k + r()) / m : 0.3 + 0.7 * r();
        const [pp, tt, , ss] = along(t);
        const q = env.q(pp);
        sites.push({ p: pp, d: tt, sway: ss, q, inner: order === 2 && (q < 0.7 || t < 0.45) });
      }
    }
    // 胴吹きの花房：大枝の中ほどから先と、枝の付け根寄りにも花（見上げたとき樹冠の真ん中が空かない）
    if (order <= 2) {
      const m = order === 1 ? (opt.limbSites ?? 14) : 2;
      for (let k = 0; k < m; k++) {
        const t = order === 1 ? 0.3 + 0.7 * (k + r()) / m : 0.05 + 0.3 * r();
        const [pp, tt, rr, ss] = along(t);
        // 枝のまわりに房を散らす（枝の太さ＋少し外）
        const sd = deviate(tt, Math.PI / 2, r() * TAU);
        const p2 = add(pp, sd, rr + S * (0.12 + 0.35 * r()));
        sites.push({ p: p2, d: tt, sway: ss, q: env.q(p2), inner: true });
      }
    }
  };
  const nLimb = opt.limbs;
  for (let i = 0; i < nLimb; i++) {
    const a = (i / nLimb) * TAU + (r() - 0.5) * 0.8;
    const out = (opt.rise ? 0.62 : 0.52) + r() * 0.28;
    const dir = norm([Math.cos(a) * out, 1 - out * 0.75, Math.sin(a) * out]);
    const len = H * (0.62 + r() * 0.18);
    // 幹の上の方の横から、高さをずらして出る
    const hy = trunkH * (0.82 + 0.3 * ((i * 3) % nLimb) / nLimb) + (r() - 0.5) * 0.15 * S;
    const f = hy / trunkH;
    const bp = [lean[0] * f + Math.cos(a) * r0 * 0.4, hy, lean[2] * f + Math.sin(a) * r0 * 0.4];
    grow(bp, dir, len, r0 * (0.5 + r() * 0.12), 1, 0.1, 1);
  }
  // 放す
  const B = new Builder();
  const sidesO = lod === 0 ? [11, 7, 4, 3] : lod === 1 ? [6, 4, 3, 3] : [4, 3, 3, 3];
  const maxOrd = lod === 0 ? 3 : lod === 1 ? 2 : 1;
  for (const b of branches) {
    if (b.order > maxOrd) continue;
    let pts = b.pts, rads = b.rads, sw = b.sw;
    if (lod > 0 && b.order > 0 && pts.length > 3) {
      const keep = pts.map((_, i) => i).filter((i) => i % 2 === 0 || i === pts.length - 1);
      pts = keep.map((i) => b.pts[i]); rads = keep.map((i) => b.rads[i]); sw = keep.map((i) => b.sw[i]);
    }
    // 小枝は先を花の中で終わらせる（黒い針のように突き出ない）
    if (b.order === 3) {
      const k = pts.length - 1, e = lerp3(pts[k - 1], pts[k], 0.45);
      pts = [...pts.slice(0, k), e]; rads = [...rads.slice(0, k), rads[k] * 0.5]; sw = sw.slice();
      if (lod === 0 && pts.length > 3) { pts = [pts[0], pts[2], pts[pts.length - 1]]; rads = [rads[0], rads[2], rads[rads.length - 1]]; sw = [sw[0], sw[2], sw[sw.length - 1]]; }
    }
    const ao = pts.map((p) => Math.min(1, 0.3 + 0.5 * Math.min(1, env.q(p)) + 0.15 * Math.min(1, p[1] / H)));
    B.tube(pts, rads, sidesO[b.order], sw, ao, b.order === 0 ? { flare: 0.75, flareN: 2, roots: 5, fph: r() * TAU } : {});
  }
  // 花の板
  const n = lod === 2 ? opt.farCards : lod === 1 ? opt.midCards : opt.cards;
  const tile = lod === 0 ? TILE.SAKURA : TILE.SAKURA_DENSE;
  const size0 = (lod === 2 ? opt.farCardSize : lod === 1 ? opt.midCardSize : opt.cardSize) * H;
  const cc = [env.c[0], env.c[1] - env.Ry * 0.35, env.c[2]];
  const outer = sites.filter((s) => !s.inner), inner = sites.filter((s) => s.inner);
  const pIn = lod === 0 ? (opt.innerFrac ?? 0.2) : lod === 1 ? 0.12 : 0;
  for (let i = 0; i < n; i++) {
    const inn = inner.length && r() < pIn;
    let st = inn ? inner[Math.floor(r() * inner.length)] : outer[Math.floor(((i + r()) / n) * outer.length) % outer.length];
    if (lod > 0 && !inn) { const s2 = outer[Math.floor(r() * outer.length)]; if (s2.q > st.q) st = s2; }
    const outC = norm(sub(st.p, cc));
    let out = norm(add(outC, [0, 0.35, 0]));
    // 内側の房は下へ向ける（真下から見上げて頭上が花で覆われる）
    const down = inn && r() < 0.6;
    if (down) out = norm(lerp3(outC, [0, -1, 0], 0.6));
    const size = size0 * (0.75 + r() * 0.5) * (inn ? 1.15 : 1);
    let c = add(st.p, out, size * (lod === 0 ? 0.1 : lod === 1 ? 0.04 : 0.15));
    // 近景は房を上下にも散らす（大枝ごとの水平な層に見えないよう厚みを出す）
    if (lod === 0) c = add(c, [(r() - 0.5) * size * 0.5, (r() - 0.5) * size * 0.9, (r() - 0.5) * size * 0.5]);
    const f = cardFrame(out, r, lod === 0 ? 1.3 : 0.9, lod === 0 && !down ? st.d : null);
    const q = Math.min(1.1, env.q(c));
    const ao = Math.min(1, 0.2 + 0.6 * Math.pow(Math.min(1, q), 1.5) + 0.2 * Math.max(0, outC[1])) * (down ? 0.85 : 1);
    B.card(c, f.u, f.v, size, size, tile, down ? norm(lerp3(outC, [0, -1, 0], 0.35)) : outC, 0.3 + 0.7 * st.sway, ao, r());
  }
  return { geo: B.geometry(), height: H, crownR: dR, crownY: dC[1], crownRy: dRy, crownC: dC };
}

// 種類ごとの形の設定
// kids: 各次数の子の数 / angle: 親からの開き / lenK・radK: 子の長さ・太さの比 / sitesPer: 小枝1本あたりの葉の場所
const BROAD = { gen: 'broad', lean: 1, orders: 3, kids: [5, 4, 4], angle: [0.7, 0.75, 0.7], lenK: [0.5, 0.55, 0.5], radK: [0.55, 0.5, 0.45], sitesPer: 3, trop: [0.02, 0.05, 0.06, 0.05], flare: 0.9, roots: 5 };
export const SPECIES_CFG = {
  // 楢（コナラ）：幹がやや傾き、丸くこんもり
  0: { ...BROAD, height: 13, trunk: 0.28, crownY: 0.61, crownR: 0.35, crownRy: 0.34, bark: 0.022, limbUp: 0.5, cards: 260, midCards: 28, farCards: 12, cardSize: 0.14, midCardSize: 0.25, farCardSize: 0.36, tile: TILE.OAK, farTile: TILE.OAK_DENSE, flex: 1.0, tint: 0 },
  // 山桜：幹が高く、枝は斜め上に
  1: { ...BROAD, height: 12, trunk: 0.36, crownY: 0.64, crownR: 0.38, crownRy: 0.3, bark: 0.024, limbUp: 0.55, kids: [5, 4, 3], cards: 240, midCards: 28, farCards: 12, cardSize: 0.135, midCardSize: 0.25, farCardSize: 0.36, tile: TILE.YAMAZAKURA, farTile: TILE.YAMA_DENSE, flex: 1.0 },
  // 辛夷：立ち上がる卵形、花は白くまばら
  2: { ...BROAD, height: 10, trunk: 0.28, crownY: 0.62, crownR: 0.3, crownRy: 0.34, bark: 0.022, limbUp: 0.65, kids: [5, 3, 3], cards: 180, midCards: 24, farCards: 10, cardSize: 0.125, midCardSize: 0.24, farCardSize: 0.36, tile: TILE.KOBUSHI, farTile: TILE.KOBUSHI_DENSE, flex: 1.0 },
  3: { gen: 'cedar', height: 20, crownBase: 0.4, radius: 0.13, whorl: 0.034, tile: TILE.CEDAR, farTile: TILE.CEDAR_DENSE, flex: 0.6 },
  // 常緑（カシ・シイ）：こんもりと密なドーム
  4: { ...BROAD, height: 11, trunk: 0.24, crownY: 0.6, crownR: 0.4, crownRy: 0.37, bark: 0.022, lean: 0.6, limbUp: 0.45, kids: [6, 4, 4], sitesPer: 4, cards: 280, midCards: 30, farCards: 13, cardSize: 0.14, midCardSize: 0.25, farCardSize: 0.36, tile: TILE.EVERGREEN, farTile: TILE.EVER_DENSE, flex: 0.7, lump: 0.3 },
  // 桜（川沿いの並木）：幹の太さ約0.5m、約2mで大枝4本に分かれ、斜め上へ伸びてから外へ。樹冠は川の側（+x）へ張り出し、並木の向き（±z）にも広く
  5: { gen: 'cherry', height: 9, bark: 0.04, limbs: 5, twigs: 3, sitesPer: 4, cards: 1800, midCards: 90, farCards: 22, cardSize: 0.125, midCardSize: 0.22, farCardSize: 0.36, tile: TILE.SAKURA, farTile: TILE.SAKURA_DENSE, flex: 0.8,
    row: { bark: 0.03, trunkH: 0.21, limbs: 4, limbBias: 0.55, spread: 0.5, rise: 0.33, domeY: 0.4, lumpR: 0.125, offX: 0.1, asym: 0.12, lumps: 36, innerLumps: 5, dobuki: 3, extraD: 1.7, extraD2: 3.2,
      skirt0: 0.02, skirtK: 0.55, innerK: 0.4, cards: 2300, cardSize: 0.1, midCards: 300, midCardSize: 0.15, farCards: 34, farCardSize: 0.28, midOrd: 1, sides0: [9, 6, 4, 3] } },
  // 柿：低く横に広がる、太い枝がくねる
  6: { ...BROAD, height: 7, trunk: 0.28, crownY: 0.62, crownR: 0.46, crownRy: 0.32, bark: 0.032, lean: 1.5, limbUp: 0.35, wob: 1.5, kids: [4, 4, 3], cards: 120, midCards: 20, farCards: 8, cardSize: 0.135, midCardSize: 0.26, farCardSize: 0.4, tile: TILE.KAKI, farTile: TILE.KAKI, flex: 0.8 },
  7: { gen: 'willow', height: 10, flex: 1.6 },
  8: { gen: 'shrub', form: 'lumps', height: 3.2, crownY: 0.44, crownR: 0.52, crownRy: 0.44, bark: 0.0055, stems: 10, cards: 90, midCards: 14, farCards: 6, cardSize: 0.3, midCardSize: 0.5, farCardSize: 0.75, tile: TILE.SHRUB, farTile: TILE.SHRUB_DENSE, flex: 0.6 },
  9: { gen: 'bamboo', height: 14, cards: 30, flex: 2.2 },
  // 椿：短い幹に地面近くまで葉の茂る卵形
  10: { gen: 'shrub', height: 3.8, crownY: 0.5, crownR: 0.34, crownRy: 0.5, bark: 0.02, stems: 3, trunkUp: 1, cards: 300, midCards: 22, farCards: 8, cardSize: 0.22, midCardSize: 0.42, farCardSize: 0.65, tile: TILE.CAMELLIA, farTile: TILE.CAMELLIA, flex: 0.4 },
  // 躑躅：伏せた椀の株（底は平ら、裾が地面まで）
  12: { gen: 'shrub', form: 'dome', height: 1.1, crownY: 0.22, crownR: 1.0, crownRy: 0.75, bark: 0.02, stems: 5, cards: 150, innerTile: TILE.SHRUB, midCards: 16, farCards: 7, cardSize: 0.45, midCardSize: 0.7, farCardSize: 0.95, tile: TILE.TSUTSUJI, farTile: TILE.TSUTSUJI, flex: 0.25 },
  // 欅：扇を開いたように枝が立ち上がる
  11: { ...BROAD, height: 16, trunk: 0.26, crownY: 0.66, crownR: 0.38, crownRy: 0.34, bark: 0.022, lean: 0.6, limbUp: 0.72, kids: [7, 4, 4], angle: [0.5, 0.6, 0.65], cards: 380, midCards: 34, farCards: 13, cardSize: 0.095, midCardSize: 0.22, farCardSize: 0.34, tile: TILE.KEYAKI, farTile: TILE.KEYAKI_DENSE, flex: 0.9, flatTop: 0.1 },
};
// 楢の2つ目の形（別の雑木：クヌギなど）
const OAK_V1 = { tile: TILE.OAK2, farTile: TILE.OAK2_DENSE, crownR: 0.38, crownRy: 0.31, crownY: 0.62, limbUp: 0.42, trunk: 0.3, wob: 1.3 };

// far: false=近景, 'mid'=中景, true=遠景
export function buildPrototype(sp, variant, far) {
  let cfg = SPECIES_CFG[sp];
  if (sp === 0 && variant === 1) cfg = { ...cfg, ...OAK_V1 };
  const seed = 1000 + sp * 97 + variant * 13;
  if (cfg.gen === 'cedar') return cedar(cfg, seed, far);
  if (cfg.gen === 'bamboo') return bamboo(cfg, seed, far);
  if (cfg.gen === 'willow') return willow(cfg, seed, far);
  if (cfg.gen === 'cherry') return cherry(cfg, seed, far);
  if (cfg.gen === 'shrub') return shrub(cfg, seed, far);
  return broadleaf(cfg, seed, far);
}
