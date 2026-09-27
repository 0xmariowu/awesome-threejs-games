// 魚のテクスチャを塗る（three.js に依存しないので、ワーカーでも動く）
// ※ 銛一本の src/fish/fishpaint.js を複製したもの
import { smoothstep, clamp, lerp } from '../core/noise.js';
import { formOf, BODY_V, TW, TH, REG, PAD } from './fishform.js';

// ───────── テクスチャ ─────────
/**
 * 体と鰭の色を塗る。rgb = 色、a = 銀の強さ（水面の明るさを映す）。
 * 種の pattern(P) は体表の点 P {X, Y, u, s, side, ny, eye, op, lat, head} に [r,g,b(,銀)] を返す。
 * fin(P) は鰭の点 {kind, a, t, X, Y, ray, spine} に [r,g,b(,銀)] を返す。
 */
export function paintFishData(sp, scale = 1) {
  const F = formOf(sp), bl = F.bl, S = sp.shape;
  const W = Math.round(TW * scale), H = Math.round(TH * scale);
  const data = new Uint8Array(W * H * 4);
  const M = F.mouth;
  const py = F.py;
  const toByte = (v) => (v <= 0 ? 0 : v >= 1 ? 255 : v * 255);

  // 模様は半分の解像度で求めて補間し（細かい斑点でも数画素ある）、彫りの陰と鰭条だけ原寸で描く
  const lowGrid = (lw, lh, fn) => {
    const buf = new Float32Array(lw * lh * 4);
    for (let j = 0; j < lh; j++) {
      for (let i = 0; i < lw; i++) {
        const c = fn(i, j);
        const k = (j * lw + i) * 4;
        buf[k] = c[0]; buf[k + 1] = c[1]; buf[k + 2] = c[2]; buf[k + 3] = c.length > 3 ? c[3] : 0;
      }
    }
    return buf;
  };
  const out = [0, 0, 0, 0];
  const sample = (buf, lw, lh, fx, fy) => {
    const x0 = Math.min(lw - 2, Math.max(0, Math.floor(fx))), y0 = Math.min(lh - 2, Math.max(0, Math.floor(fy)));
    const tx = Math.min(1, Math.max(0, fx - x0)), ty = Math.min(1, Math.max(0, fy - y0));
    const k00 = (y0 * lw + x0) * 4, k10 = k00 + 4, k01 = k00 + lw * 4, k11 = k01 + 4;
    for (let c = 0; c < 4; c++) {
      const a = buf[k00 + c] + (buf[k10 + c] - buf[k00 + c]) * tx;
      const b = buf[k01 + c] + (buf[k11 + c] - buf[k01 + c]) * tx;
      out[c] = a + (b - a) * ty;
    }
    return out;
  };

  // ─── 体 ───
  const bodyRows = Math.round(H * BODY_V);
  const colAt = (X) => {
    const tp = F.top(X), bt = F.bot(X);
    return { X, yc: (tp + bt) / 2, hh: Math.max((tp - bt) / 2, 1e-5), latY: F.latY(X) };
  };
  const rowAt = (th) => {
    const cs = Math.cos(th), sn = Math.sin(th);
    return { th, cs, sn, ey: Math.sign(cs) * Math.pow(Math.abs(cs), py), side: sn >= 0 ? 1 : -1 };
  };
  const opAt = (X, ny) => {
    const q = ny < -1 ? -1 : ny > 1 ? 1 : ny;
    return X - (F.op[0] + F.op[1] * (1 - q * q) - F.op[1] * 0.8 * Math.max(0, -q) ** 2);
  };
  const eyeAt = (X, Y, side) => {
    let e2 = 81;
    for (const e of F.eyes) {
      if (e.side !== side && !S.flat) continue;
      const dx = X - e.X, dy = Y - e.Y;
      e2 = Math.min(e2, (dx * dx + dy * dy) / (e.r * e.r));
    }
    return Math.sqrt(e2);
  };
  const P = { X: 0, Y: 0, u: 0, s: 0, sn: 0, side: 1, ny: 0, eye: 9, op: 0, lat: 0, head: 0, th: 0 };
  const LW = Math.ceil(W / 2) + 1, LH = Math.ceil(bodyRows / 2) + 1;
  const lcols = [], lrows = [];
  for (let i = 0; i < LW; i++) lcols.push(colAt(Math.min(bl, ((i * 2) / W) * bl)));
  for (let j = 0; j < LH; j++) lrows.push(rowAt(((j * 2) / bodyRows) * Math.PI * 2));
  const low = lowGrid(LW, LH, (i, j) => {
    const c = lcols[i], r = lrows[j];
    P.X = c.X; P.Y = c.yc + c.hh * r.ey; P.u = c.X / bl; P.s = r.cs; P.sn = r.sn; P.side = r.side; P.ny = r.ey; P.th = r.th;
    P.eye = eyeAt(P.X, P.Y, r.side);
    P.op = F.noOp ? 1 : opAt(P.X, r.ey);
    P.lat = P.Y - c.latY;
    P.head = 1 - smoothstep(-0.01, 0.01, P.op);
    return sp.pattern(P);
  });
  const rows = [];
  for (let y = 0; y < bodyRows; y++) rows.push(rowAt(((y + 0.5) / bodyRows) * Math.PI * 2));
  const lw = sp.latLine ?? 0.12;
  for (let x = 0; x < W; x++) {
    const col = colAt(((x + 0.5) / W) * bl), X = col.X;
    const mouthOn = X < M.gape * 1.15;
    const nearEye = F.eyes.some((e) => Math.abs(X - e.X) < e.r * 2.3);
    const nearOp = !F.noOp && X > F.op[0] - 0.07 && X < F.op[0] + F.op[1] + 0.03;
    const latOn = !F.noOp && lw && X > F.op[0];
    const ym = F.mouthY(X), wg = 0.0014 + (0.0018 * X) / M.gape, mAlong = 1 - smoothstep(M.gape * 0.8, M.gape * 1.15, X);
    for (let y = 0; y < bodyRows; y++) {
      const r = rows[y];
      const c = sample(low, LW, LH, (x + 0.5) / 2, (y + 0.5) / 2);
      const Y = col.yc + col.hh * r.ey;
      const asn = Math.abs(r.sn);
      let k = 1;
      // 共通の彫りの陰：口の切れ込み、鰓蓋の縁、前鰓蓋、眼窩、鼻孔、側線
      if (mouthOn) { const q = (Y - ym) / wg; if (q * q < 9) k *= 1 - 0.6 * Math.exp(-q * q) * mAlong; }
      if (asn > 0.15) {
        if (nearOp || latOn) {
          const op = opAt(X, r.ey);
          if (nearOp && op > -0.06 && op < 0.02) {
            const q1 = (op - 0.0025) / 0.003, q2 = (op + 0.004) / 0.004, q3 = (op + 0.045) / 0.004;
            k *= 1 - 0.2 * Math.exp(-q1 * q1) * smoothstep(0.15, 0.4, asn);
            k *= 1 + 0.08 * Math.exp(-q2 * q2);
            k *= 1 - 0.12 * Math.exp(-q3 * q3) * (r.ey < 0.3 ? 1 : 0.4);
          }
          if (latOn && op > 0.01) {
            const lat = Y - col.latY;
            if (lat > -0.012 && lat < 0.016) {
              const a1 = lat / 0.0022, a2 = (lat - 0.004) / 0.002;
              k *= 1 + lw * smoothstep(0.0, 0.03, op) * (Math.exp(-a1 * a1) - 0.5 * Math.exp(-a2 * a2));
            }
          }
        }
        const eye = nearEye ? eyeAt(X, Y, r.side) : 9;
        if (eye < 2) { const q = (eye - 1.08) / 0.18; k *= 1 - 0.45 * Math.exp(-q * q); }
        if (nearEye) for (const e of F.eyes) {
          if (e.side !== r.side || Math.abs(X - e.X) > e.r * 2.2) continue;
          const d1 = Math.sqrt((X - (e.X - e.r * 1.7)) ** 2 + (Y - (e.Y + e.r * 0.25)) ** 2) / (e.r * 0.2);
          const d2 = Math.sqrt((X - (e.X - e.r * 1.25)) ** 2 + (Y - (e.Y + e.r * 0.35)) ** 2) / (e.r * 0.16);
          const nd = Math.min(d1, d2);
          if (nd < 1.5) k *= 0.55 + 0.45 * smoothstep(0.6, 1.4, nd);
        }
      }
      const o = (y * W + x) * 4;
      data[o] = toByte(c[0] * k); data[o + 1] = toByte(c[1] * k); data[o + 2] = toByte(c[2] * k); data[o + 3] = toByte(c[3]);
    }
  }

  // ─── 鰭 ───
  const rayLine = (d, w) => Math.exp(-((d / w) ** 2));
  // colFn(a, 画素幅) → 列ごとの情報、colorQ(列, t) → 種の fin() に渡す点、rayFn(列, t) → 鰭条の強さ
  const paintRegion = (kind, colFn, colorQ, rayFn) => {
    const r = REG[kind];
    const x0 = Math.round(r[0] * scale), y0 = Math.round(r[1] * scale), w = Math.round(r[2] * scale), h = Math.round(r[3] * scale);
    const pad = PAD * scale, iw = w - 2 * pad, ih = h - 2 * pad;
    const aOf = (xx) => clamp((xx + 0.5 - pad) / iw, 0, 1), tOf = (yy) => clamp((yy + 0.5 - pad) / ih, 0, 1);
    const lw2 = Math.ceil(w / 2) + 1, lh2 = Math.ceil(h / 2) + 1;
    const lowCols = [];
    for (let i = 0; i < lw2; i++) lowCols.push(colFn(clamp((i * 2 - pad) / iw, 0, 1)));
    const lowF = lowGrid(lw2, lh2, (i, j) => sp.fin(colorQ(lowCols[i], clamp((j * 2 - pad) / ih, 0, 1))));
    const pxA = 1 / iw;
    const rk = sp.finRay ?? -0.25;
    for (let xx = 0; xx < w; xx++) {
      const cc = colFn(aOf(xx), pxA);
      for (let yy = 0; yy < h; yy++) {
        const t = tOf(yy);
        const c = sample(lowF, lw2, lh2, (xx + 0.5) / 2, (yy + 0.5) / 2);
        const k = 1 + rk * rayFn(cc, t);
        const o = ((y0 + yy) * W + x0 + xx) * 4;
        data[o] = toByte(c[0] * k); data[o + 1] = toByte(c[1] * k); data[o + 2] = toByte(c[2] * k); data[o + 3] = toByte(c[3]);
      }
    }
  };
  const Q = { kind: '', a: 0, t: 0, X: 0, Y: 0, ray: 0, spine: 0, fin: 0, h: 0, q: 0 };
  for (const [kind, sgn] of [['dorsal', 1], ['anal', -1]]) {
    const L = F.fins[kind];
    if (!L) continue;
    const colFn = (a, px = 0) => {
      const X = lerp(L.X0, L.X1, a);
      let fin = L.fins.find((f) => X >= f.f.x0 - 1e-4 && X <= f.f.x1 + 1e-4);
      if (!fin) fin = L.fins.reduce((p, f) => (Math.min(Math.abs(X - f.f.x0), Math.abs(X - f.f.x1)) < Math.min(Math.abs(X - p.f.x0), Math.abs(X - p.f.x1)) ? f : p));
      const la = clamp((X - fin.f.x0) / Math.max(fin.f.x1 - fin.f.x0, 1e-4), 0, 1);
      const span = fin.f.x1 - fin.f.x0;
      const pxL = px * (L.X1 - L.X0);
      let spine = 0, ray = 0;
      if (fin.n > 0 && la <= fin.aEnd + 0.02) {
        const kk = fin.n > 1 ? Math.round((la / fin.aEnd) * (fin.n - 1)) : 0;
        const ak = fin.n > 1 ? (fin.aEnd * kk) / (fin.n - 1) : 0;
        spine = rayLine((la - ak) * span, Math.max(0.0028, pxL * 1.2));
      }
      if (la > fin.aEnd || fin.n === 0) {
        const sp2 = 0.0085, q = ((la - fin.aEnd) * span) / sp2;
        ray = rayLine((q - Math.round(q)) * sp2, Math.max(0.0012, pxL * 0.9));
      }
      let hh = 0;
      const cl = fin.cols;
      for (let i = 0; i < cl.length - 1; i++) {
        if (la >= cl[i].a && la <= cl[i + 1].a) { hh = lerp(cl[i].h, cl[i + 1].h, (la - cl[i].a) / Math.max(cl[i + 1].a - cl[i].a, 1e-6)); break; }
      }
      return { fin, la, spine, ray, h: hh, fi: L.fins.indexOf(fin) };
    };
    paintRegion(kind, colFn, (cc, t) => {
      const p = F.unpairedPoint(cc.fin, { a: cc.la, h: cc.h, spine: cc.spine > 0.5 }, t, sgn);
      Q.kind = kind; Q.a = cc.la; Q.t = t; Q.X = p.X; Q.Y = p.Y; Q.ray = Math.max(cc.ray, cc.spine); Q.spine = cc.spine; Q.fin = cc.fi; Q.h = cc.h;
      return Q;
    }, (cc, t) => Math.max(cc.ray * 0.7 * smoothstep(0, 0.2, t), cc.spine));
  }
  if (S.caudal) {
    const nRay = 19;
    paintRegion('caudal', (a, px = 0) => {
      const q = a * (nRay - 1), q2 = q * 2;
      return {
        a,
        ray: rayLine((q - Math.round(q)) / (nRay - 1), Math.max(0.0055, px * 1.1)),
        ray2: rayLine((q2 - Math.round(q2)) / ((nRay - 1) * 2), Math.max(0.004, px)),
      };
    }, (cc, t) => {
      const p = F.caudalPoint(cc.a, t);
      Q.kind = 'caudal'; Q.a = cc.a; Q.t = t; Q.X = p.X; Q.Y = p.Y; Q.ray = cc.ray; Q.spine = 0; Q.q = 1 - 2 * cc.a;
      return Q;
    }, (cc, t) => Math.max(cc.ray * smoothstep(0, 0.12, t), cc.ray2 * 0.6 * smoothstep(0.55, 0.8, t)) * 0.8);
  }
  for (const kind of ['pect', 'pelv']) {
    const PS = F.pairedSpec(kind);
    if (!PS) continue;
    const nRay = kind === 'pect' ? 15 : 7;
    paintRegion(kind, (a, px = 0) => {
      const q = a * (nRay - 1);
      return { a, ray: rayLine((q - Math.round(q)) / (nRay - 1), Math.max(0.01, px * 1.2)) };
    }, (cc, t) => {
      const p = F.pairedPoint(PS, cc.a, t, 1);
      Q.kind = kind; Q.a = cc.a; Q.t = t; Q.X = p.X; Q.Y = p.Y; Q.ray = cc.ray; Q.spine = 0;
      return Q;
    }, (cc, t) => cc.ray * 0.8 * smoothstep(0, 0.15, t));
  }

  return { data, W, H };
}
