// 魚の体形（形状・テクスチャ・ワーカーで共有する純粋な計算。three.js に依存しない）
// ※ 銛一本の src/fish/fishform.js を複製したもの（こちらを直してもモリ突きには影響しない）
import { smoothstep, clamp, lerp } from '../core/noise.js';

// ───────── テクスチャの配置（アトラス） ─────────
// 体は上から周方向に一周（v=0 背 → 右 → 腹 → 左 → 背）、鰭は下の帯に種類ごとの区画
export const TW = 1024, TH = 640;
export const BODY_V = 448 / TH;
export const REG = {
  dorsal: [0, 448, 512, 96], anal: [512, 448, 512, 96],
  caudal: [0, 544, 320, 96], pect: [320, 544, 256, 96], pelv: [576, 544, 192, 96],
};
export const PAD = 3;
export const PART = { body: 0, dorsal: 1, anal: 2, caudal: 3, pect: 4, pelv: 5, eye: 6 };
export const finUV = (kind, a, t) => {
  const r = REG[kind];
  return [(r[0] + PAD + clamp(a, 0, 1) * (r[2] - 2 * PAD)) / TW, (r[1] + PAD + clamp(t, 0, 1) * (r[3] - 2 * PAD)) / TH];
};

// ───────── 単調な3次補間（輪郭の制御点を行き過ぎずになめらかに結ぶ） ─────────
export function curve(pts) {
  const n = pts.length;
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  if (n === 1) return () => ys[0];
  const d = [], m = new Array(n);
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  m[0] = d[0]; m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i], h = a * a + b * b;
    if (h > 9) { const t = 3 / Math.sqrt(h); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; }
  }
  return (x) => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0;
    while (x > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i], t = (x - xs[i]) / h, t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1];
  };
}

// ───────── 体形（形状とテクスチャで共有する） ─────────
// 座標は全長 = 1。X は吻端からの距離（体は X = 0..bl、その先が尾鰭）、Y は上、x は右体側。モデルでは z = 0.5 - X
const forms = new Map();
export function formOf(sp) {
  if (!forms.has(sp)) forms.set(sp, new FishForm(sp));
  return forms.get(sp);
}

class FishForm {
  constructor(sp) {
    const S = sp.shape;
    this.sp = sp;
    this.S = S;
    this.bl = S.bl;
    const top = curve(S.top), bot = curve(S.bot), wid = curve(S.wid);
    const tip = (S.top[0][1] + S.bot[0][1]) / 2;
    const rr = S.blunt ?? 0.02;
    // 吻端を丸める（制御点だけだと円錐になる）
    const round = (X) => (X >= rr ? 1 : Math.sqrt(Math.max(0, 1 - (1 - X / rr) ** 2)));
    this.top = (X) => tip + (top(X) - tip) * round(X);
    this.bot = (X) => tip + (bot(X) - tip) * round(X);
    this.wid = (X) => wid(X) * round(X);
    this.px = S.px ?? 1.0;
    this.py = S.py ?? 1.0;
    this.eyes = (S.eyes || [[...S.eye, 1], [...S.eye, -1]]).map(([X, Y, r, side]) => ({ X, Y, r, side }));
    this.mouth = { y: tip, gape: 0.03, slope: -0.15, depth: 0.004, ...(S.mouth || {}) };
    this.op = S.op || [S.bl * 0.26, 0.03];
    // 側線の高さ（背の輪郭と中心の間の割合）。数値か、X に沿った制御点
    this.latF = Array.isArray(S.lat) ? curve(S.lat) : () => S.lat ?? 0.62;
    this.noOp = !!S.noOp;
    this.fins = {
      dorsal: this.unpairedLayout(S.dorsal || []),
      anal: this.unpairedLayout(S.anal || []),
    };
  }

  // 生の断面（形状の彫り込み前）
  sec(X, th) {
    const t = this.top(X), b = this.bot(X), w = this.wid(X);
    const cs = Math.cos(th), sn = Math.sin(th);
    const yc = (t + b) / 2, hh = (t - b) / 2;
    return {
      x: w * Math.sign(sn) * Math.pow(Math.abs(sn), this.px),
      y: yc + hh * Math.sign(cs) * Math.pow(Math.abs(cs), this.py),
      yc, hh, w, cs, sn,
    };
  }
  /** 高さ Y での体表の x（右側、正の値） */
  surfX(X, Y) {
    let a = 0, b = Math.PI;
    for (let i = 0; i < 28; i++) {
      const m = (a + b) / 2;
      if (this.sec(X, m).y > Y) a = m; else b = m;
    }
    return this.sec(X, (a + b) / 2).x + this.disp(X, Y, 1);
  }
  latY(X) { const t = this.top(X), b = this.bot(X), yc = (t + b) / 2; return yc + (t - yc) * this.latF(X); }
  mouthY(X) { return this.mouth.y + this.mouth.slope * X; }
  opX(Y, X) {
    const t = this.top(X), b = this.bot(X), yc = (t + b) / 2, hh = Math.max((t - b) / 2, 1e-4);
    const q = clamp((Y - yc) / hh, -1, 1);
    return this.op[0] + this.op[1] * (1 - q * q) - this.op[1] * 0.8 * Math.max(0, -q) ** 2;
  }

  /** 体表の彫り込み（外向きが正）：口の切れ込みと唇、鰓蓋の縁、眼窩、ぜいご */
  disp(X, Y, side) {
    let d = 0;
    const M = this.mouth;
    if (X < M.gape * 1.15) {
      const ym = this.mouthY(X);
      const wg = 0.0018 + 0.0022 * X / M.gape;
      const along = 1 - smoothstep(M.gape * 0.8, M.gape * 1.15, X);
      d -= M.depth * 0.75 * Math.exp(-(((Y - ym) / wg) ** 2)) * along;
      d += M.depth * 0.12 * Math.exp(-(((Math.abs(Y - ym) - wg * 2.4) / wg) ** 2)) * along;
    }
    // 鰓蓋：縁の手前がわずかに持ち上がり、縁の後ろで段になる
    const xo = this.noOp ? -1 : this.opX(Y, X);
    if (X > xo - 0.05 && X < xo + 0.012) {
      if (X < xo) d += 0.0014 * smoothstep(xo - 0.05, xo - 0.004, X);
      else d -= 0.001 * (1 - (X - xo) / 0.012);
    }
    for (const e of this.eyes) {
      if (e.side !== side) continue;
      const q = Math.hypot(X - e.X, Y - e.Y) / e.r;
      if (q < 1.6) d -= e.r * 0.32 * (1 - (q / 1.6) ** 2);
      d += e.r * 0.1 * Math.exp(-(((q - 1.45) / 0.25) ** 2));
    }
    if (this.S.scute) {
      const [x0, x1] = this.S.scute;
      if (X > x0 && X < x1) d += 0.0026 * Math.exp(-(((Y - this.latY(X)) / 0.0055) ** 2)) * smoothstep(x0, x0 + 0.05, X);
    }
    return d;
  }

  // ─── 背鰭・臀鰭の列（トゲの先が突き出し、膜はトゲの間で切れ込む） ───
  unpairedLayout(list) {
    if (!list.length) return null;
    const X0 = Math.min(...list.map((f) => f.x0)), X1 = Math.max(...list.map((f) => f.x1));
    const fins = list.map((f) => {
      const hC = curve(f.h);
      const cols = []; // {a, h, spine}
      const n = f.spines || 0;
      const notch = f.notch ?? 0.3;
      // トゲは約 0.024 間隔で前から並び、その後ろは軟条
      const aEnd = n > 1 ? (f.spineEnd ?? (f.soft === false ? 0.93 : Math.min(1, (n * 0.024) / (f.x1 - f.x0)))) : 0;
      const step = n > 1 ? aEnd / (n - 1) : 0.12;
      if (n > 0) {
        for (let k = 0; k < n; k++) {
          const a = n > 1 ? (aEnd * k) / (n - 1) : 0;
          const h = hC(a);
          cols.push({ a, h, spine: true });
          const last = k === n - 1;
          const a2 = last ? (f.soft === false ? 1 : Math.min(1, a + step)) : (aEnd * (k + 1)) / (n - 1);
          if (a2 <= a + 1e-4) continue;
          const h2 = last ? (f.soft === false ? hC(1) : hC(a2)) : hC(a2) * (1 - notch);
          const e = (a2 - a) * 0.14;
          const hs = h * (last && f.soft !== false ? 0.9 : 0.8);
          const m = 3;
          for (let i = 0; i <= m; i++) {
            const t = i / m;
            cols.push({ a: lerp(a + e, a2 - (last ? 0 : e), t), h: lerp(hs, h2, t), spine: false });
          }
        }
      }
      const aS = cols.length ? cols[cols.length - 1].a : 0;
      if (aS < 1 - 1e-4) {
        const nS = Math.max(3, Math.round(((f.x1 - f.x0) * (1 - aS)) / 0.008));
        for (let i = 1; i <= nS; i++) {
          const a = lerp(aS, 1, i / nS);
          cols.push({ a, h: hC(a), spine: false });
        }
      }
      if (!n) cols.unshift({ a: 0, h: hC(0), spine: false });
      cols.sort((p, q) => p.a - q.a);
      return { f, cols, hC, n, aEnd, rake: f.rake || [0.5, 0.9] };
    });
    return { X0, X1, fins };
  }

  /** 背鰭・臀鰭の点（列 c, 鰭条に沿った t）。sgn = 1 背、-1 腹 */
  unpairedPoint(fin, c, t, sgn) {
    const f = fin.f;
    const X = lerp(f.x0, f.x1, c.a);
    const yb = sgn > 0 ? this.top(X) - 0.006 : this.bot(X) + 0.006;
    const r = lerp(fin.rake[0], fin.rake[1], c.a);
    const L = c.h + 0.006;
    const z = -Math.sin(r) * L * t - 0.12 * L * t * t * (c.spine ? 0.3 : 1);
    const y = sgn * Math.cos(r) * L * t;
    return { X: X - z, Y: yb + y };
  }

  // ─── 尾鰭 ───
  caudalLen(q) {
    const C = this.S.caudal, a = Math.abs(q);
    switch (C.type) {
      case 'fork': return C.len * (0.4 + 0.6 * Math.pow(a, 1.15));
      case 'emarg': return C.len * (0.8 + 0.2 * a);
      case 'trunc': return C.len * (0.94 + 0.06 * a);
      case 'lyre': return C.len * (0.45 + 0.3 * a * a + (a > 0.8 ? (a - 0.8) * 2.6 : 0));
      case 'point': return C.len * (1 - 0.55 * a);
      // 三日月形（マグロ・カジキ）：中央は短く、細い上下の葉が長く伸びる
      case 'lunate': return C.len * (0.38 + 0.62 * Math.pow(a, 1.25));
      default: return C.len * (0.72 + 0.28 * Math.sqrt(Math.max(0, 1 - a * a)));
    }
  }
  caudalPoint(a, t) {
    const C = this.S.caudal, bl = this.bl;
    const q = 1 - 2 * a; // 1 = 上端
    const Xb = bl - 0.012;
    const tp = this.top(bl), bt = this.bot(bl), yc = (tp + bt) / 2, hp = (tp - bt) / 2;
    const yb = yc + q * hp * 0.85;
    const L = this.caudalLen(q);
    const spread = C.type === 'fork' || C.type === 'lyre' ? Math.pow(Math.abs(q), 0.85) * Math.sign(q) : C.type === 'lunate' ? Math.pow(Math.abs(q), 0.6) * Math.sign(q) : q;
    const yt = yc + spread * C.h;
    // 鰭条はわずかに外へ反る
    const X = Xb + L * t;
    const Y = lerp(yb, yt, Math.pow(t, 0.8));
    return { X, Y };
  }

  // ─── 胸鰭・腹鰭（扇） ───
  pairedSpec(kind) {
    const S = this.S;
    if (kind === 'pect') {
      const P = S.pect;
      if (!P) return null;
      const rnd = P.shape || 'round';
      const Lf = rnd === 'pointed' ? (a) => 1 - 0.62 * Math.pow(a, 0.85)
        : rnd === 'falcate' ? (a) => 1 - 0.78 * Math.pow(a, 0.55)
        : rnd === 'fan' ? (a) => 0.68 + 0.32 * Math.sin(Math.PI * (0.12 + 0.8 * a))
        : (a) => 0.56 + 0.44 * Math.sin(Math.PI * (0.18 + 0.78 * a));
      return { X: P.x, Y: P.y, len: P.len, base: P.base ?? P.len * 0.32, phi: P.phi || [0.55, -0.85], L: Lf, splay: P.splay ?? 0.35, part: PART.pect, kind };
    }
    const P = S.pelv;
    if (!P) return null;
    return { X: P.x, Y: null, len: P.len, base: P.base ?? P.len * 0.25, phi: P.phi || [-0.45, -1.05], L: (a) => 0.62 + 0.38 * Math.sin(Math.PI * (0.1 + 0.6 * a)), splay: P.splay ?? 0.45, part: PART.pelv, kind };
  }
  pairedPoint(P, a, t, side) {
    const Y0 = P.Y ?? this.bot(P.X) + 0.012;
    const bx = P.X + 0.012 * a, by = Y0 + P.base * (0.5 - a);
    const phi = lerp(P.phi[0], P.phi[1], a);
    const L = P.len * P.L(a) * t;
    const back = Math.cos(P.splay) * L;
    const X = bx + Math.cos(phi) * back + 0.02 * L * L;
    const Y = by + Math.sin(phi) * back;
    const x0 = P.Y === null ? this.wid(P.X) * 0.35 : this.surfX(P.X, Y0) - 0.004;
    const x = side * (x0 + Math.sin(P.splay) * L);
    return { X, Y, x };
  }
}

