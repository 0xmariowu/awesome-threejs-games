// sky.js
const AT$1 = {
  R: 6371, HR: 8.0, HM: 1.2, TOP: 90, E: 19.0,
  TR: [0.05, 0.10, 0.22], TR0: [0.012, 0.050, 0.300],
  TM: [0.0174, 0.0183, 0.0195],
  TO: [0.026, 0.024, 0.002],
  HZ: [0.0075, 0.0080, 0.0086],
};
const LUT_NU = 12, LUT_NW = 10, LUT_N = LUT_NU * LUT_NW;
const PMCAP = 0.43;
const MOON_L = 1.3;
const MOON_DAY = 0.02;
const EXPO_MAX = 1.6;
const MOON_R = 0.75 * Math.PI / 180;
const MOON_KEY = [0.24, 0.27, 0.315];
const TW_BLUE = [0.40, 0.75, 2.5];
const TW_ROSE = [1.54, 0.86, 0.74];
const KEY_GLOW = [1.0, 0.42, 0.36];
const MOON_EXPO = 7;
const NIGHT_Y = 0.004;
const NIGHT_Z = [0.0009, 0.0014, 0.0030], NIGHT_H = [0.0020, 0.0027, 0.0040];
const MOON_SKY = [0.0010, 0.0019, 0.0040];
const DIRK = 0.12 * Math.PI;
const OZ_H = 25, OZ_W = 12;

const hgJ = (c, g) => (1 - g * g) / (4 * Math.PI * Math.pow(Math.max(1 + g * g - 2 * g * c, 1e-4), 1.5));
const mieJ = (c) => 0.93 * hgJ(c, 0.87) + 0.07 * hgJ(c, 0.97);
const sstep$9 = (a, b, x) => { const t = Math.min(Math.max((x - a) / (b - a), 0), 1); return t * t * (3 - 2 * t); };
const lumJ = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];

function chapman(H, h, mu) {
  const X = AT$1.R / H, hh = h / H;
  const c = Math.sqrt(1.5708 * (X + hh));
  if (mu >= 0) return (c / (c * mu + 1)) * Math.exp(-hh);
  const x0 = Math.sqrt(Math.max(1 - mu * mu, 0)) * (X + hh), c0 = Math.sqrt(1.5708 * x0);
  return 2 * c0 * Math.exp(X - x0) - (c / (1 - c * mu)) * Math.exp(-hh);
}
function ozoneSlant(h, mu) {
  const rs = AT$1.R + OZ_H, rt = (AT$1.R + h) * Math.sqrt(Math.max(1 - mu * mu, 0));
  const edge = sstep$9(rs + 0.5 * OZ_W, rs - 0.5 * OZ_W, rt);
  if (edge <= 0) return 0;
  const rr = Math.min(rt / rs, 1);
  const slant = 1 / Math.max(Math.sqrt(1 - rr * rr), Math.sqrt(OZ_W / (2 * rs)));
  const below = sstep$9(OZ_H + 6, OZ_H - 6, h);
  return edge * slant * (below + (1 - below) * 2 * sstep$9(0.02, -0.02, mu));
}
const SH_FILL = 0.3, SH_DEPTH = 10, SH_EDGE = 6;
function transmit(h, mu, out) {
  let vis = 1;
  if (mu < 0) {
    const d = (AT$1.R + h) * Math.sqrt(1 - mu * mu) - AT$1.R;
    const ed = 1 + (SH_EDGE - 1) * sstep$9(2, 20, h);
    vis = Math.max(sstep$9(-ed, ed, d), SH_FILL * sstep$9(2, 10, h) * Math.exp(Math.min(d, 0) / SH_DEPTH));
    if (d < 0) mu = -Math.sqrt(Math.max(1 - (AT$1.R / (AT$1.R + h)) ** 2, 0));
  }
  if (vis <= 0) { out[0] = out[1] = out[2] = 0; return out; }
  const cR = chapman(AT$1.HR, h, mu), cM = chapman(AT$1.HM, h, mu), cO = ozoneSlant(h, mu);
  for (let i = 0; i < 3; i++) out[i] = vis * Math.exp(-AT$1.TR[i] * cR - (AT$1.TM[i] / 0.9) * cM - AT$1.TO[i] * cO);
  return out;
}
const _tr = [0, 0, 0];
function scatter(vx, vy, vz, L, Tsea, out) {
  const R = AT$1.R, r0 = R + 0.002;
  const b = r0 * vy, c = r0 * r0 - (R + AT$1.TOP) * (R + AT$1.TOP);
  const tTop = -b + Math.sqrt(b * b - c);
  const cth = vx * L[0] + vy * L[1] + vz * L[2];
  const pR = 0.0597 * (1 + cth * cth) + 0.02;
  const pM = Math.min(mieJ(cth), PMCAP);
  const pMS = 0.022;
  const oz = ozoneSlant(0.002, vy);
  let aR = 0, aM = 0;
  out[0] = out[1] = out[2] = 0;
  const N = 32;
  for (let k = 0; k < N; k++) {
    const f0 = k / N, f1 = (k + 1) / N;
    const ta = tTop * f0 * Math.sqrt(f0), tb = tTop * f1 * Math.sqrt(f1), t = 0.5 * (ta + tb), ds = tb - ta;
    const px = vx * t, py = r0 + vy * t, pz = vz * t;
    const r = Math.sqrt(px * px + py * py + pz * pz), h = r - R;
    const dR = (Math.exp(-h / AT$1.HR) * ds) / AT$1.HR, dM = (Math.exp(-h / AT$1.HM) * ds) / AT$1.HM;
    const vR = aR + 0.5 * dR, vM = aM + 0.5 * dM, vO = oz * sstep$9(OZ_H - 6, OZ_H + 6, h);
    aR += dR; aM += dM;
    const mu = (px * L[0] + py * L[1] + pz * L[2]) / r;
    transmit(h, mu, _tr);
    for (let i = 0; i < 3; i++) {
      if (_tr[i] <= 0) continue;
      const Tv = Math.exp(-AT$1.TR[i] * vR - (AT$1.TM[i] / 0.9) * vM - AT$1.TO[i] * vO);
      out[i] += Tv * _tr[i] * (AT$1.TR[i] * dR * (pR + pMS) + AT$1.TM[i] * dM * (pM + pMS));
    }
  }
  const hb = Math.exp(-vy * 40) * (1 + 1.5 * Math.pow(Math.max(cth, 0), 4));
  for (let i = 0; i < 3; i++) out[i] = AT$1.E * (out[i] + Tsea[i] * AT$1.HZ[i] * hb);
  return out;
}
function lutAt(lut, L, vx, vy, vz, out) {
  const u = Math.sqrt(Math.min(Math.max(vy, 0), 1)) * (LUT_NU - 1);
  const ls = Math.hypot(L[0], L[2]), lv = Math.hypot(vx, vz);
  const ca = ls > 1e-4 && lv > 1e-4 ? (L[0] * vx + L[2] * vz) / (ls * lv) : 1;
  const w = Math.pow(Math.acos(Math.min(Math.max(ca, -1), 1)) / Math.PI, 2 / 3) * (LUT_NW - 1);
  const i0 = Math.min(Math.floor(u), LUT_NU - 2), j0 = Math.min(Math.floor(w), LUT_NW - 2);
  const fu = u - i0, fw = w - j0, k = i0 * LUT_NW + j0;
  for (let c = 0; c < 3; c++) {
    const a = lut[k * 3 + c] + (lut[(k + 1) * 3 + c] - lut[k * 3 + c]) * fw;
    const e = lut[(k + LUT_NW) * 3 + c] + (lut[(k + LUT_NW + 1) * 3 + c] - lut[(k + LUT_NW) * 3 + c]) * fw;
    out[c] = a + (e - a) * fu;
  }
  return out;
}
const W_MU = [], W_PH = [];
{
  const mu = (i) => (i / (LUT_NU - 1)) ** 2, ph = (j) => Math.PI * Math.pow(j / (LUT_NW - 1), 1.5);
  for (let i = 0; i < LUT_NU; i++) W_MU.push(mu(i) * 0.5 * ((i < LUT_NU - 1 ? mu(i + 1) : mu(i)) - (i > 0 ? mu(i - 1) : mu(i))));
  for (let j = 0; j < LUT_NW; j++) W_PH.push(0.5 * ((j < LUT_NW - 1 ? ph(j + 1) : ph(j)) - (j > 0 ? ph(j - 1) : ph(j))));
}
function hemi$1(lut, out) {
  out[0] = out[1] = out[2] = 0;
  for (let i = 0; i < LUT_NU; i++) {
    for (let j = 0; j < LUT_NW; j++) {
      const w = (2 * W_MU[i] * W_PH[j]) / Math.PI, k = (i * LUT_NW + j) * 3;
      out[0] += lut[k] * w; out[1] += lut[k + 1] * w; out[2] += lut[k + 2] * w;
    }
  }
  return out;
}
function compress(Y) {
  const l0 = Math.log(0.3), p = 0.35, k = 3, x = Math.log(Math.max(Y, 1e-12)) - l0;
  const sp = x * k > 30 ? x : Math.log(1 + Math.exp(k * x)) / k;
  return Math.exp(l0 + p * x + (1 - p) * sp);
}

const amJ = (mu, rh) => { const m = Math.max(mu, 0); return (2 * rh + 1) / (Math.sqrt(rh * rh * m * m + 2 * rh + 1) + rh * m); };
function viewDepth(mu, c) { return AT$1.TR[c] * amJ(mu, 796) + (AT$1.TM[c] / 0.9) * amJ(mu, 5300) + AT$1.TO[c] * ozoneSlant(0.002, mu); }
function oldDay(v, L, out) {
  const mu = Math.max(v[1], 0), c = v[0] * L[0] + v[1] * L[1] + v[2] * L[2];
  const O = [0.010, 0.022, 0.0012];
  const pR = 0.0597 * (1 + c * c) + 0.02, pM = Math.min(mieJ(c), PMCAP);
  for (let i = 0; i < 3; i++) {
    const Ts = Math.exp(-(AT$1.TR0[i] * amJ(L[1], 796) + (AT$1.TM[i] / 0.9) * amJ(L[1], 5300) + O[i] * amJ(L[1], 260)));
    const tR = AT$1.TR0[i] * amJ(mu, 796), tM = AT$1.TM[i] * amJ(mu, 5300), tau = tR + tM / 0.9 + O[i] * amJ(mu, 260), e1 = 1 - Math.exp(-tau);
    const hz = AT$1.HZ[i] * Math.exp(-mu * 40) * (1 + 1.5 * Math.pow(Math.max(c, 0), 4));
    out[i] = AT$1.E * Ts * ((tR * pR + tM * pM) * e1 / tau + 0.022 * e1 + hz);
  }
  return out;
}
const CAL = new Float64Array(LUT_NU * 3).fill(1);

const HZ_L = new Float64Array(LUT_NW), HZ_S = new Float64Array(LUT_NW), HZ_C = Array.from({ length: LUT_NW }, () => new Float64Array(3));

const ST = {
  version: 0, key: [NaN, NaN, NaN, NaN, NaN, NaN, NaN],
  phys: new Float64Array(LUT_N * 3), lut: new Float32Array(LUT_N * 3),
  L: [0, 1, 0], M: [0, -1, 0], lit: 0,
  Tsea: [0, 0, 0], sunSea: [0, 0, 0], sunDisc: [0, 0, 0], sunBlow: 1, moonSea: [0, 0, 0], moonT: [0, 0, 0],
  keyDir: [0, 1, 0], keyCol: [0, 0, 0], keyMoon: false, amb: [0, 0, 0], avg: [0, 0, 0], horizon: [0, 0, 0],
  ambLevel: 1, night: 0, K: 1, Yart: 1, Ytot: 1, expo: 0.95, expoRaw: 0.95, gain: 1, moonUp: 0, skyNow: 1,
};
const REF$1 = { Y: 1, sky: 1, avg: [1, 1, 1], lumAvg: 1, lumSun: 1e9, lumKey: 1e9, amb: [1, 1, 1], dday: 0 };
const _a$2 = [0, 0, 0], _b$2 = [0, 0, 0], _c$3 = [0, 0, 0];
const MOON_FLOOR = 0.25;
const COOL_FILL = [0.84, 1.0, 1.25].map((x) => x / (0.2126 * 0.84 + 0.7152 + 0.0722 * 1.25));
const PLAN_W = 0.9, PLAN_EL = 13, PLAN_Y0 = -Math.sin((PLAN_EL * Math.PI) / 180);
const PLAN_T = [0, 0.69, 1.35, 2.0, 2.66, 3.32, 4.01, 4.74, 5.55, 6.49, 7.6, 8.93, 10.58, 12.62];
function planFrac(el) {
  const x = Math.min(Math.max(el + PLAN_EL, 0), PLAN_EL), i = Math.min(Math.floor(x), PLAN_EL - 1);
  return Math.pow((PLAN_T[i] + (PLAN_T[i + 1] - PLAN_T[i]) * (x - i)) / PLAN_T[PLAN_EL], 1.2);
}
const E_W = (() => {
  const w = new Float64Array(LUT_N);
  let s = 0;
  for (let i = 0; i <= 8; i++) {
    const m0 = (Math.max(i - 0.5, 0) / (LUT_NU - 1)) ** 2, m1 = (Math.min(i + 0.5, LUT_NU - 1) / (LUT_NU - 1)) ** 2;
    const dEl = Math.asin(Math.min(m1, 1)) - Math.asin(m0), ce = Math.cos(Math.asin(0.5 * (m0 + m1)));
    for (let j = 0; j <= 4; j++) {
      const p0 = Math.PI * Math.pow(Math.max(j - 0.5, 0) / (LUT_NW - 1), 1.5), p1 = Math.PI * Math.pow(Math.min(j + 0.5, LUT_NW - 1) / (LUT_NW - 1), 1.5);
      w[i * LUT_NW + j] = ce * dEl * (p1 - p0);
      s += w[i * LUT_NW + j];
    }
  }
  for (let k = 0; k < LUT_N; k++) w[k] /= s;
  return w;
})();
function eastLum(lut) {
  let e = 0;
  for (let k = 0; k < LUT_N; k++) if (E_W[k] > 0) e += E_W[k] * (0.2126 * lut[k * 3] + 0.7152 * lut[k * 3 + 1] + 0.0722 * lut[k * 3 + 2]);
  return e;
}
function cloneState(src) {
  const o = {};
  for (const k in src) { const v = src[k]; o[k] = ArrayBuffer.isView(v) ? new v.constructor(v.length) : Array.isArray(v) ? v.slice() : v; }
  return o;
}
const PLAN$1 = { busy: false, L: [0, 0, 0], A: [0, 0], S: [cloneState(ST), cloneState(ST)], kM: NaN, kLit: NaN };
function goldCap(a, gk, w) {
  if (!(w > 0) || !(a[0] > a[2]) || !(a[1] > gk * a[0])) return;
  const Y0 = lumJ(a);
  a[1] += (gk * a[0] - a[1]) * w;
  const s = Y0 / Math.max(lumJ(a), 1e-30);
  a[0] *= s; a[1] *= s; a[2] *= s;
}

function compute(L, M, lit, S, raw) {
  S.L[0] = L[0]; S.L[1] = L[1]; S.L[2] = L[2];
  S.M[0] = M[0]; S.M[1] = M[1]; S.M[2] = M[2];
  S.lit = lit;
  transmit(0.002, L[1], S.Tsea);
  let ax = L[0], az = L[2];
  const al = Math.hypot(ax, az);
  if (al > 1e-4) { ax /= al; az /= al; } else { ax = 1; az = 0; }
  for (let i = 0; i < LUT_NU; i++) {
    const mu = (i / (LUT_NU - 1)) ** 2, ce = Math.sqrt(1 - mu * mu);
    for (let j = 0; j < LUT_NW; j++) {
      const ph = Math.PI * Math.pow(j / (LUT_NW - 1), 1.5), cp = Math.cos(ph), sp = Math.sin(ph);
      scatter(ce * (cp * ax - sp * az), mu, ce * (sp * ax + cp * az), L, S.Tsea, _a$2);
      const k = (i * LUT_NW + j) * 3;
      for (let c = 0; c < 3; c++) S.phys[k + c] = _a$2[c] * CAL[i * 3 + c];
    }
  }
  const kap = 0.15 + 0.75 * sstep$9(0.06, -0.06, L[1]);
  const zk = (LUT_NU - 1) * LUT_NW * 3;
  const cz0 = S.phys[zk], cz1 = S.phys[zk + 1], cz2 = S.phys[zk + 2];
  for (let i = 0; i < LUT_NU; i++) {
    const mu = (i / (LUT_NU - 1)) ** 2;
    const e0 = kap * (1 - Math.exp(-viewDepth(mu, 0))) * cz0, e1 = kap * (1 - Math.exp(-viewDepth(mu, 1))) * cz1, e2 = kap * (1 - Math.exp(-viewDepth(mu, 2))) * cz2;
    for (let j = 0; j < LUT_NW; j++) { const k = (i * LUT_NW + j) * 3; S.phys[k] += e0; S.phys[k + 1] += e1; S.phys[k + 2] += e2; }
  }
  hemi$1(S.phys, _b$2);
  const Esky = Math.PI * lumJ(_b$2), Edir = AT$1.E * DIRK * lumJ(S.Tsea) * Math.max(L[1], 0);
  if (raw) { S.Esky = Esky; return Esky + Edir; }
  const deep = Math.pow(sstep$9(-0.26, -0.1, L[1]), 1.5);
  const ysky = Esky / REF$1.sky;
  S.K = (compress(ysky) * deep) / Math.max(ysky, 1e-12);
  S.Yart = (S.K * (Esky + Edir)) / REF$1.Y;
  S.moonUp = sstep$9(-0.02, 0.06, M[1]);
  transmit(0.002, M[1], S.moonT);
  const ml = lit * S.moonUp;
  S.Ytot = S.Yart + NIGHT_Y + MOON_DAY * ml;
  const dn = 0.016 + 0.004 * ml, sEl = sstep$9(-0.242, 0.242, L[1]);
  const Ksky = S.K;
  const tg = sstep$9(0.1, -0.02, L[1]);
  const wgold = sstep$9(-0.02, 0.06, L[1]) * (1 - sstep$9(0.22, 0.45, L[1]));
  const wband = wgold * sstep$9(0.03, 0.075, L[1]), wbandSun = wgold * sstep$9(0.08, 0.13, L[1]);
  const wcap = Math.max(tg, wgold);
  const gw = 0.74 - 0.16 * sstep$9(-0.03, 0.0, L[1]) + 0.22 * sstep$9(0.07, 0.16, L[1]) - 0.2 * sstep$9(-0.06, -0.18, L[1]);
  const bl = tg * sstep$9(-0.24, -0.12, L[1]);
  const vb = sstep$9(0.05, 0.0, L[1]) * sstep$9(-0.12, -0.05, L[1]);
  for (let i = 0; i < LUT_NU; i++) {
    const mu = (i / (LUT_NU - 1)) ** 2, nz = Math.pow(mu, 0.45), mk = ml * (0.75 + 0.5 * (1 - mu));
    const up = 0.85 * bl * Math.sqrt(mu), belt = 0.35 * vb * sstep$9(0.03, 0.1, mu) * sstep$9(0.34, 0.2, mu);
    for (let j = 0; j < LUT_NW; j++) {
      const k = (i * LUT_NW + j) * 3, anti = sstep$9(0.55, 0.9, j / (LUT_NW - 1));
      let r = Ksky * S.phys[k], g = Ksky * S.phys[k + 1], b = Ksky * S.phys[k + 2];
      const Y = 0.2126 * r + 0.7152 * g + 0.0722 * b, wu = up * (0.55 + 0.45 * anti), wv = belt * anti;
      r += (Y * TW_BLUE[0] - r) * wu; g += (Y * TW_BLUE[1] - g) * wu; b += (Y * TW_BLUE[2] - b) * wu;
      r += (Y * TW_ROSE[0] - r) * wv; g += (Y * TW_ROSE[1] - g) * wv; b += (Y * TW_ROSE[2] - b) * wv;
      const mx = Math.max(r, b);
      if (g > mx) {
        const Y0 = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        g = mx + (g - mx) * 0.15;
        const f = Y0 / Math.max(0.2126 * r + 0.7152 * g + 0.0722 * b, 1e-12);
        r *= f; g *= f; b *= f;
      }
      const ex = Math.min(r, b) - g;
      if (ex > 0) {
        const Y0 = 0.2126 * r + 0.7152 * g + 0.0722 * b, w = sstep$9(0.6, 1.1, b / Math.max(r, 1e-12));
        r -= ex * w;
        g += 0.5 * ex * (1 - w);
        const f = Y0 / Math.max(0.2126 * r + 0.7152 * g + 0.0722 * b, 1e-12);
        r *= f; g *= f; b *= f;
      }
      if (tg > 0 && b > r && g > r) {
        const d = g - 0.5 * (r + b);
        if (d > 0) {
          const Y0 = 0.2126 * r + 0.7152 * g + 0.0722 * b;
          g -= d * tg;
          r += 0.4 * d * tg;
          const f = Y0 / Math.max(0.2126 * r + 0.7152 * g + 0.0722 * b, 1e-12);
          r *= f; g *= f; b *= f;
        }
      }
      const side = sstep$9(0.3, 0.48, j / (LUT_NW - 1)), wbj = wbandSun + (wband - wbandSun) * side;
      if (wbj > 0) {
        const wa = (0.8 + 0.1 * side) * wbj * (1 - sstep$9(0.0, 0.2 + 0.1 * side, mu)) * (0.6 + 0.15 * side + (0.4 - 0.15 * side) * (1 - j / (LUT_NW - 1)));
        const wd = (0.22 + 0.08 * side) * wbj * Math.sqrt(mu);
        const Y0 = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        if (wa > 0) {
          const dim = 1 - 0.3 * wbj * (1 - sstep$9(0.0, 0.2, mu)) * (1 - 0.7 * anti);
          r += (Y0 * (1.32 - 0.04 * anti) - r) * wa; g += (Y0 * (0.94 + 0.01 * anti) - g) * wa; b += (Y0 * (0.66 + 0.08 * anti) - b) * wa;
          r *= dim; g *= dim; b *= dim;
        }
        if (wd > 0) { r += (Y0 * 0.8 - r) * wd; g += (Y0 * 0.97 - g) * wd; b += (Y0 * 1.3 - b) * wd; }
      }
      const wwarm = wcap * sstep$9(1.15, 1.6, r / Math.max(b, 1e-12));
      const gt = Math.max(gw * r, b);
      if (wwarm > 0 && g > gt) {
        const Y0 = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        g += (gt - g) * wwarm;
        const f = Y0 / Math.max(0.2126 * r + 0.7152 * g + 0.0722 * b, 1e-12);
        r *= f; g *= f; b *= f;
      }
      { const ex2 = Math.min(r, b) - g;
        if (ex2 > 0) {
          const Y0 = 0.2126 * r + 0.7152 * g + 0.0722 * b, w2 = sstep$9(0.6, 1.1, b / Math.max(r, 1e-12));
          r -= ex2 * w2; g += ex2 * (1 - w2);
          const f2 = Y0 / Math.max(0.2126 * r + 0.7152 * g + 0.0722 * b, 1e-12);
          r *= f2; g *= f2; b *= f2;
        } }
      S.lut[k] = r + NIGHT_H[0] + (NIGHT_Z[0] - NIGHT_H[0]) * nz + MOON_SKY[0] * mk;
      S.lut[k + 1] = g + NIGHT_H[1] + (NIGHT_Z[1] - NIGHT_H[1]) * nz + MOON_SKY[1] * mk;
      S.lut[k + 2] = b + NIGHT_H[2] + (NIGHT_Z[2] - NIGHT_H[2]) * nz + MOON_SKY[2] * mk;
    }
  }
  if (tg > 0) {
    for (let i = 2; i <= 5; i++) {
      const a = 0.4 * tg * (1 - (i - 2) / 4);
      for (let j = 0; j < LUT_NW; j++) {
        const k = (i * LUT_NW + j) * 3, kb = ((i - 1) * LUT_NW + j) * 3;
        for (let c = 0; c < 3; c++) S.lut[k + c] += (S.lut[kb + c] - S.lut[k + c]) * a;
      }
    }
  }
  hemi$1(S.lut, S.avg);
  const m0 = lumJ(S.avg), dnM = dn;
  const target = dnM * Math.pow((REF$1.dday > 0 ? REF$1.dday : 0.95 * m0) / dnM, sEl);
  S.expoRaw = Math.min(Math.max(target / Math.max(m0, 1e-9), 0.4), 12);
  {
    const G = target * (3.5 + 1.0 * sstep$9(-0.15, 0.05, L[1]) + 40 * sstep$9(0.06, 0.7, L[1])), kn = 0.5 * G;
    for (let k = 0; k < LUT_N; k++) {
      const i3 = k * 3, Y = S.expoRaw * (0.2126 * S.lut[i3] + 0.7152 * S.lut[i3 + 1] + 0.0722 * S.lut[i3 + 2]);
      if (Y > kn) {
        const f = (kn + (G - kn) * (1 - Math.exp(-(Y - kn) / (G - kn)))) / Y;
        S.lut[i3] *= f; S.lut[i3 + 1] *= f; S.lut[i3 + 2] *= f;
      }
    }
    hemi$1(S.lut, S.avg);
  }
  S.skyNow = lumJ(S.avg);
  S.expoRaw = Math.min(Math.max(target / Math.max(S.skyNow, 1e-9), 0.4), 12);
  S.meter = Math.pow(eastLum(S.lut), PLAN_W) * Math.pow(S.skyNow, 1 - PLAN_W);
  if (!raw && !PLAN$1.busy && L[1] > PLAN_Y0 && L[1] < 0) {
    if (!(Math.abs(M[1] - PLAN$1.kM) < 0.002 && Math.abs(lit - PLAN$1.kLit) < 0.01)) {
      PLAN$1.busy = true;
      const h = Math.hypot(L[0], L[2]) || 1;
      for (let a = 0; a < 2; a++) {
        const y = a === 0 ? PLAN_Y0 : 0, ch = Math.sqrt(1 - y * y);
        PLAN$1.L[0] = (L[0] / h) * ch; PLAN$1.L[1] = y; PLAN$1.L[2] = (L[2] / h) * ch;
        compute(PLAN$1.L, M, lit, PLAN$1.S[a], false);
        PLAN$1.A[a] = PLAN$1.S[a].meter * PLAN$1.S[a].expoRaw;
      }
      PLAN$1.busy = false;
      PLAN$1.kM = M[1]; PLAN$1.kLit = lit;
    }
    if (PLAN$1.A[0] > 0 && PLAN$1.A[1] > 0) {
      const f = planFrac((Math.asin(L[1]) * 180) / Math.PI);
      const B = Math.exp(Math.log(PLAN$1.A[0]) + (Math.log(PLAN$1.A[1]) - Math.log(PLAN$1.A[0])) * f);
      S.expoRaw = Math.min(Math.max(B / Math.max(S.meter, 1e-12), 0.4), 12);
    }
  }
  S.expo = Math.min(S.expoRaw, EXPO_MAX);
  S.gain = S.expoRaw / S.expo;
  const gn = S.gain;
  for (let k = 0; k < LUT_N * 3; k++) S.lut[k] *= gn;
  for (let c = 0; c < 3; c++) S.avg[c] *= gn;
  const mHold = (MOON_EXPO / S.expoRaw) * (1 - sstep$9(-0.1, 0.02, L[1]));
  for (let c = 0; c < 3; c++) {
    S.sunSea[c] = S.K * S.Tsea[c];
    S.moonSea[c] = MOON_L * lit * S.moonT[c] * mHold;
  }
  { const cap = (REF$1.lumSun * 0.95 * (0.05 + 1.15 * sstep$9(-0.02, 0.14, L[1]))) / S.expoRaw, l = lumJ(S.sunSea); if (l > cap) for (let c = 0; c < 3; c++) S.sunSea[c] *= cap / l; }
  goldCap(S.sunSea, 0.8, 1 - sstep$9(0.22, 0.45, L[1]));
  for (let c = 0; c < 3; c++) { S.sunSea[c] *= gn; S.moonSea[c] *= gn; }
  transmit(0.002, Math.max(L[1], 0.0015), _a$2);
  for (let c = 0; c < 3; c++) S.sunDisc[c] = Math.min(S.K, 3) * _a$2[c];
  { const m = (Math.max(S.sunDisc[0], S.sunDisc[1], S.sunDisc[2]) * 18 * S.expoRaw) / 0.6;
    const cap = 6 + 24 * sstep$9(0.12, 0.5, L[1]), tgt = 3 + 47 * Math.pow(sstep$9(-0.012, 0.04, L[1]), 1.5);
    if (m > cap) for (let c = 0; c < 3; c++) S.sunDisc[c] *= cap / m;
    S.sunBlow = Math.max(1, tgt / Math.max(Math.min(m, cap), tgt * 1e-3)); }
  for (let c = 0; c < 3; c++) S.sunDisc[c] *= gn;
  const hl = HZ_L, hc = HZ_C;
  for (let j = 0; j < LUT_NW; j++) {
    const col = hc[j];
    for (let c = 0; c < 3; c++) col[c] = 0.5 * (S.lut[j * 3 + c] + S.lut[(LUT_NW + j) * 3 + c]);
    hl[j] = lumJ(col);
    HZ_S[j] = hl[j];
  }
  const med = HZ_S.sort()[LUT_NW >> 1];
  let wsum = 0;
  S.horizon[0] = S.horizon[1] = S.horizon[2] = 0;
  for (let j = 0; j < LUT_NW; j++) {
    const w = W_PH[j] / (1 + hl[j] / (2 * med + 1e-9));
    wsum += w;
    for (let c = 0; c < 3; c++) S.horizon[c] += w * hc[j][c];
  }
  for (let c = 0; c < 3; c++) S.horizon[c] /= wsum;
  { const x = Math.cos(1.9), z = Math.sin(1.9), hx = x * ax - z * az, hz = z * ax + x * az, l = Math.hypot(hx, 0.012, hz);
    lutAt(S.lut, L, hx / l, 0.012 / l, hz / l, _a$2);
    for (let c = 0; c < 3; c++) S.horizon[c] = 0.7 * _a$2[c] + 0.3 * S.horizon[c]; }
  lutAt(S.lut, L, 0, 1, 0, _a$2);
  { const x = -L[2], z = L[0], l = Math.hypot(x, 0.35, z); lutAt(S.lut, L, x / l, 0.35 / l, z / l, _b$2); }
  for (let c = 0; c < 3; c++) S.amb[c] = (_a$2[c] + _b$2[c]) * 0.22;
  transmit(4.5, L[1] + 0.01, _a$2);
  { const pk = sstep$9(0.12, -0.02, L[1]); _a$2[1] *= 1 - 0.28 * pk; _a$2[2] *= 1 - 0.2 * pk; }
  {
    const la = lumJ(_a$2), kPhys = la * AT$1.E * S.K, lg = lumJ(KEY_GLOW), wp = la > 1e-12 ? sstep$9(-0.05, -5e-3, L[1]) : 0;
    for (let c = 0; c < 3; c++) _a$2[c] = wp * (_a$2[c] / Math.max(la, 1e-30)) + (1 - wp) * (KEY_GLOW[c] / lg);
    goldCap(_a$2, 0.8, 1 - sstep$9(0.22, 0.45, L[1]));
    { const wb = wgold * sstep$9(0.03, 0.075, L[1]);
      if (wb > 0 && (_a$2[2] > 0.46 * _a$2[0] || _a$2[1] > 0.76 * _a$2[0])) {
        const Y0 = lumJ(_a$2);
        _a$2[2] += (Math.min(_a$2[2], 0.46 * _a$2[0]) - _a$2[2]) * wb;
        _a$2[1] += (Math.min(_a$2[1], 0.76 * _a$2[0]) - _a$2[1]) * wb;
        const s2 = Y0 / Math.max(lumJ(_a$2), 1e-30);
        _a$2[0] *= s2; _a$2[1] *= s2; _a$2[2] *= s2;
      } }
    const f = (0.97 * (Math.exp(3.5 * sstep$9(-0.157, 0.242, L[1])) - 1)) / (Math.exp(3.5) - 1);
    const kRef = REF$1.lumKey < 1e8 ? REF$1.lumKey : kPhys;
    const kd = (kRef * 0.95 * f) / S.expoRaw;
    for (let c = 0; c < 3; c++) _a$2[c] *= kd;
  }
  transmit(2.0, M[1], _b$2);
  { const mk = (AT$1.E * MOON_DAY * lit * MOON_EXPO * (1 - sstep$9(-0.05, 0.1, L[1]))) / S.expoRaw;
    for (let c = 0; c < 3; c++) _b$2[c] *= mk * MOON_KEY[c]; }
  for (let c = 0; c < 3; c++) { _a$2[c] *= gn; _b$2[c] *= gn; }
  {
    const sunK = lumJ(_a$2), moonK = lumJ(_b$2), ws = sunK / Math.max(sunK + moonK, 1e-12);
    S.keyMoon = ws < 0.5;
    let x = ws * L[0] + (1 - ws) * M[0], y = ws * L[1] + (1 - ws) * M[1], z = ws * L[2] + (1 - ws) * M[2];
    const l = Math.hypot(x, y, z);
    if (l < 1e-6) { x = L[0]; y = L[1]; z = L[2]; } else { x /= l; y /= l; z /= l; }
    S.keyDir[0] = x; S.keyDir[1] = y; S.keyDir[2] = z;
    for (let c = 0; c < 3; c++) S.keyCol[c] = _a$2[c] + _b$2[c];
  }
  S.ambLevel = lumJ(S.avg) / REF$1.lumAvg;
  S.night = sstep$9(-0.06, -0.2, L[1]);
  return Esky + Edir;
}
function ensure(lx, ly, lz, mx, my, mz, lit) {
  const k = ST.key;
  if (k[0] === lx && k[1] === ly && k[2] === lz && k[3] === mx && k[4] === my && k[5] === mz && k[6] === lit) return false;
  const ll = Math.hypot(lx, ly, lz) || 1, ml = Math.hypot(mx, my, mz) || 1;
  if (k[0] === k[0]) {
    const kl = Math.hypot(k[0], k[1], k[2]) || 1, km = Math.hypot(k[3], k[4], k[5]) || 1;
    const ds = (lx * k[0] + ly * k[1] + lz * k[2]) / (ll * kl), dm = (mx * k[3] + my * k[4] + mz * k[5]) / (ml * km);
    if (ds > 0.99999962 && dm > 0.99999962 && Math.abs(lit - k[6]) < 0.002) return false;
  }
  compute([lx / ll, ly / ll, lz / ll], [mx / ml, my / ml, mz / ml], lit, ST, false);
  k[0] = lx; k[1] = ly; k[2] = lz; k[3] = mx; k[4] = my; k[5] = mz; k[6] = lit;
  ST.version++;
  return true;
}
{
  const Lt = [-0.3, 0.88, -0.36], l = Math.hypot(...Lt);
  const Ln = Lt.map((x) => x / l);
  compute(Ln, [0, -1, 0], 0, ST, true);
  let ax = Ln[0], az = Ln[2];
  { const al = Math.hypot(ax, az); ax /= al; az /= al; }
  for (let i = 0; i < LUT_NU; i++) {
    const mu = (i / (LUT_NU - 1)) ** 2, ce = Math.sqrt(1 - mu * mu);
    const on = [0, 0, 0], nw = [0, 0, 0];
    for (let j = 0; j < LUT_NW; j++) {
      const ph = Math.PI * Math.pow(j / (LUT_NW - 1), 1.5), cp = Math.cos(ph), sp = Math.sin(ph);
      oldDay([ce * (cp * ax - sp * az), mu, ce * (sp * ax + cp * az)], Ln, _a$2);
      const k = (i * LUT_NW + j) * 3;
      for (let c = 0; c < 3; c++) { on[c] += W_PH[j] * _a$2[c]; nw[c] += W_PH[j] * ST.phys[k + c]; }
    }
    for (let c = 0; c < 3; c++) CAL[i * 3 + c] = Math.min(Math.max(on[c] / Math.max(nw[c], 1e-9), 0.1), 10);
  }
  REF$1.Y = compute(Ln, [0, -1, 0], 0, ST, true);
  REF$1.sky = ST.Esky;
  compute(Ln, [0, -1, 0], 0, ST, false);
  REF$1.dday = 0.95 * ST.skyNow;
  REF$1.lumAvg = lumJ(ST.avg);
  REF$1.avg = ST.avg.slice();
  REF$1.lumSun = lumJ(ST.sunSea);
  REF$1.lumKey = lumJ(ST.keyCol);
  REF$1.amb = ST.amb.slice();
  REF$1.Tsea = ST.Tsea.slice();
  ST.key.fill(NaN);
}
const AMBK = [0.010, 0.020, 0.050].map((x, c) => (AT$1.E * REF$1.Tsea[c] * x) / Math.max(REF$1.amb[c], 1e-6));

const f5 = (x) => (+x).toFixed(5);
const v3 = (a) => `vec3(${f5(a[0])}, ${f5(a[1])}, ${f5(a[2])})`;

const SKY_UNIFORMS = {
  uSunDir: { value: new THREE.Vector3(-0.3, 0.88, -0.36).normalize() },
  uMoonDir: { value: new THREE.Vector3(0, -1, 0) },
  uEclipse: { value: 0 },
  uBead: { value: new THREE.Vector4(0, 1, 0, 0) },
  uCloudOff: { value: new THREE.Vector2(0, 0) },
  uSunSize: { value: 0.0125 },
  uPlanets: { value: [0, 1, 2, 3, 4].map(() => new THREE.Vector4(0, -1, 0, 0)) },
  uMoonLit: { value: 0 },
  uCovFin: { value: new THREE.Vector3(0, 0, 0) },
  uMoonPhase: { value: -1 },
  uSkLut: { value: Array.from({ length: LUT_N }, () => new THREE.Vector3()) },
  uSkSunSea: { value: new THREE.Vector3() },
  uSkSunDisc: { value: new THREE.Vector3() },
  uSkSunBlow: { value: 1 },
  uSkMoonSea: { value: new THREE.Vector3() },
  uSkKeyDir: { value: new THREE.Vector3(0, 1, 0) },
  uSkKeyCol: { value: new THREE.Vector3() },
  uSkAmb: { value: new THREE.Vector3() },
  uSkAmbLevel: { value: 1 },
  uSkNight: { value: 0 },
  uSkGain: { value: 1 },
  uSkMoonSun: { value: new THREE.Vector3(0, 1, 0) },
  uSkMoonPl: { value: 1 },
  uMoonWin: { value: 1 },
  uSkTime: { value: 0 },
};
let syncedVersion = -1;
function moonPhaseLight() {
  const U = SKY_UNIFORMS, ph = U.uMoonPhase.value, L = U.uSunDir.value, M = U.uMoonDir.value;
  const cLM = (L.x * M.x + L.y * M.y + L.z * M.z) / ((Math.hypot(L.x, L.y, L.z) || 1) * (Math.hypot(M.x, M.y, M.z) || 1));
  const k = ph >= 0 ? Math.min(ph, 1) : 0.5 - 0.5 * cLM;
  return Math.max(Math.min(1, Math.pow(Math.max(k, 0) / 0.96, 1.5)), MOON_FLOOR * (1 - sstep$9(0.8, 0.94, cLM)));
}
function moonSunDir(L, M, phase, out) {
  if (!(phase >= 0)) return out.copy(L);
  const c = 2 * Math.min(phase, 1) - 1, s = Math.sqrt(Math.max(1 - c * c, 0));
  const d = L.x * M.x + L.y * M.y + L.z * M.z;
  let tx = L.x - M.x * d, ty = L.y - M.y * d, tz = L.z - M.z * d, tl = Math.hypot(tx, ty, tz);
  if (tl < 1e-4) { tx = -M.z; ty = 0; tz = M.x; tl = Math.hypot(tx, tz) || 1; }
  return out.set(-M.x * c + (tx / tl) * s, -M.y * c + (ty / tl) * s, -M.z * c + (tz / tl) * s);
}
function syncSky() {
  const U = SKY_UNIFORMS, L = U.uSunDir.value, M = U.uMoonDir.value;
  const pl = moonPhaseLight();
  ensure(L.x, L.y, L.z, M.x, M.y, M.z, U.uMoonLit.value * pl);
  moonSunDir(L, M, U.uMoonPhase.value, U.uSkMoonSun.value);
  U.uSkMoonPl.value = Math.max(pl, 0.02);
  if (syncedVersion === ST.version) return;
  syncedVersion = ST.version;
  const lut = U.uSkLut.value;
  for (let i = 0; i < LUT_N; i++) lut[i].set(ST.lut[i * 3], ST.lut[i * 3 + 1], ST.lut[i * 3 + 2]);
  U.uSkSunSea.value.fromArray(ST.sunSea);
  U.uSkSunDisc.value.fromArray(ST.sunDisc);
  U.uSkSunBlow.value = ST.sunBlow;
  U.uSkMoonSea.value.fromArray(ST.moonSea);
  U.uSkKeyDir.value.fromArray(ST.keyDir);
  U.uSkKeyCol.value.fromArray(ST.keyCol);
  U.uSkAmb.value.fromArray(ST.amb);
  U.uSkAmbLevel.value = ST.ambLevel;
  U.uSkNight.value = ST.night;
  U.uSkGain.value = ST.gain;
}
syncSky();

const SL_COLORS = ['sunColor', 'hemiSky', 'hemiGround', 'haze', 'envTint', 'moonColor'];
const normColor = (a, c) => { const m = Math.max(a[0], a[1], a[2], 1e-9); return c.setRGB(a[0] / m, a[1] / m, a[2] / m); };
function skyLight(sunDir, out = {}) {
  const M = SKY_UNIFORMS.uMoonDir.value;
  ensure(sunDir.x, sunDir.y, sunDir.z, M.x, M.y, M.z, SKY_UNIFORMS.uMoonLit.value * moonPhaseLight());
  for (let i = 0; i < SL_COLORS.length; i++) if (!out[SL_COLORS[i]]) out[SL_COLORS[i]] = new THREE.Color();
  const S = ST, norm = normColor;
  const Ts = Math.max(...S.Tsea) > 1e-6 ? S.Tsea : transmit(0.002, 0.0015, _c$3);
  _a$2[0] = 1.0 * Ts[0] / REF$1.Tsea[0]; _a$2[1] = 0.95 * Ts[1] / REF$1.Tsea[1]; _a$2[2] = 0.88 * Ts[2] / REF$1.Tsea[2];
  norm(_a$2, out.sunColor);
  out.sunIntensity = (3.1 * lumJ(S.sunSea)) / REF$1.lumSun;
  _a$2[0] = 0.62 * S.avg[0] / REF$1.avg[0]; _a$2[1] = 0.8 * S.avg[1] / REF$1.avg[1]; _a$2[2] = 1.0 * S.avg[2] / REF$1.avg[2];
  const wg = sstep$9(-0.02, 0.06, S.L[1]) * (1 - sstep$9(0.22, 0.45, S.L[1]));
  { const mx = Math.max(_a$2[0], _a$2[2]); if (_a$2[1] > mx) _a$2[1] = mx + 0.25 * (_a$2[1] - mx);
    const Y0 = lumJ(_a$2); for (let c = 0; c < 3; c++) _a$2[c] += (Y0 * COOL_FILL[c] - _a$2[c]) * 0.7 * wg; }
  const hm = Math.max(_a$2[0], _a$2[1], _a$2[2], 1e-9);
  out.hemiSky.setRGB(_a$2[0] / hm, _a$2[1] / hm, _a$2[2] / hm);
  out.hemiGround.setRGB((0.52 * _a$2[0]) / hm, (0.5 * _a$2[1]) / hm, (0.44 * _a$2[2]) / hm);
  const ml = S.lit * S.moonUp;
  out.hemiIntensity = 0.9 * Math.max(lumJ(S.avg) / REF$1.lumAvg, 0.035 * (0.6 + 0.4 * ml) * sstep$9(-0.02, -0.14, S.L[1]) * S.gain);
  out.haze.setRGB(0.92 * S.horizon[0], 0.92 * S.horizon[1], 0.92 * S.horizon[2]);
  { const ws = wg * (1 - sstep$9(0.03, 0.075, S.L[1]));
    if (ws > 0) {
      const h = out.haze, Y0 = 0.2126 * h.r + 0.7152 * h.g + 0.0722 * h.b;
      h.setRGB(h.r + (Y0 * 1.08 - h.r) * 0.55 * ws, h.g + (Y0 * 0.98 - h.g) * 0.55 * ws, h.b + (Y0 * 0.9 - h.b) * 0.55 * ws);
    } }
  { const wb = wg * sstep$9(0.03, 0.075, S.L[1]);
    if (wb > 0) {
      const h = out.haze, Y0 = 0.2126 * h.r + 0.7152 * h.g + 0.0722 * h.b;
      h.setRGB(h.r + (Y0 * 1.1 - h.r) * 0.35 * wb, h.g + (Y0 * 0.955 - h.g) * 0.35 * wb, h.b + (Y0 * 0.98 - h.b) * 0.35 * wb);
    } }
  const el = S.L[1];
  out.hazeDensity = 2.6e-4 + 0.3e-4 * Math.exp(-(el * el) / (0.08 * 0.08)) - 0.4e-4 * S.night
    + 1.6e-4 * sstep$9(0.1, 0.14, el) * (1 - sstep$9(0.3, 0.5, el));
  _b$2[0] = S.avg[0] / REF$1.avg[0]; _b$2[1] = S.avg[1] / REF$1.avg[1]; _b$2[2] = S.avg[2] / REF$1.avg[2];
  { const Y0 = lumJ(_b$2); for (let c = 0; c < 3; c++) _b$2[c] += (Y0 * COOL_FILL[c] - _b$2[c]) * 0.5 * wg; }
  out.envTint.setRGB(_b$2[0], _b$2[1], _b$2[2]);
  out.exposure = S.expo;
  if (Math.max(...S.moonT) > 1e-6) norm(S.moonT, out.moonColor); else out.moonColor.setRGB(0.75, 0.82, 1.0);
  out.moonIntensity = 3.1 * MOON_DAY * ml * Math.max(...S.moonT) * S.gain * (MOON_EXPO / S.expoRaw) * (1 - sstep$9(-0.1, 0.02, S.L[1]));
  out.night = S.night;
  return out;
}

const SKY_DECL = `
uniform vec3 uSunDir;
uniform vec3 uMoonDir;
uniform float uEclipse;
uniform vec4 uBead;
uniform vec2 uCloudOff;
uniform float uSunSize;
uniform vec4 uPlanets[5];
uniform float uMoonLit;
uniform vec3 uCovFin;
uniform vec3 uSkLut[${LUT_N}];
uniform vec3 uSkSunSea;
uniform vec3 uSkSunDisc;
uniform vec3 uSkMoonSea;
uniform vec3 uSkKeyDir;
uniform vec3 uSkKeyCol;
uniform vec3 uSkAmb;
uniform float uSkAmbLevel;
uniform float uSkNight;
uniform float uSkGain;
uniform vec3 uSkMoonSun;
uniform float uSkMoonPl;
uniform float uMoonWin;
`;

const SKY_FUNCS = `
const float SK_PI = 3.14159265;
float skH21(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float skH31(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
float skNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(skH21(i), skH21(i + vec2(1.0, 0.0)), u.x), mix(skH21(i + vec2(0.0, 1.0)), skH21(i + vec2(1.0, 1.0)), u.x), u.y);
}
float skFbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 6; i++) { s += a * skNoise(p); p = p * 2.02 + vec2(3.1, 1.7); a *= 0.5; } return s; }
float skDark() { return smoothstep(0.80, 1.0, uEclipse); }
float skTotal() { return smoothstep(0.990, 1.0, uEclipse); }
const vec3 SK_TR = vec3(0.05, 0.10, 0.22);
const vec3 SK_TM = vec3(0.0174, 0.0183, 0.0195);
const vec3 SK_TO = vec3(0.010, 0.022, 0.0012);
const float SK_E = 19.0;
const float SK_PMCAP = ${f5(PMCAP)};
const vec3 SK_SEA = vec3(0.90, 0.93, 0.96);
const float SK_MOON_R = ${MOON_R.toFixed(6)};
float skAirmass(float mu, float rh) {
  float m = max(mu, 0.0);
  return (2.0 * rh + 1.0) / (sqrt(rh * rh * m * m + 2.0 * rh + 1.0) + rh * m);
}
vec3 skDepth(float mu) {
  return SK_TR * skAirmass(mu, 796.0) + SK_TM * (skAirmass(mu, 5300.0) / 0.9) + SK_TO * skAirmass(mu, 260.0);
}
vec3 skSunTrans() { return uSkSunSea; }
float skHG(float c, float g) {
  float g2 = g * g;
  return (1.0 - g2) / (4.0 * SK_PI * pow(max(1.0 + g2 - 2.0 * g * c, 1e-4), 1.5));
}
vec3 skLut(vec3 v) {
  float u = sqrt(clamp(v.y, 0.0, 1.0)) * ${LUT_NU - 1}.0;
  float ls = length(uSunDir.xz), lv = length(v.xz);
  float ca = ls > 1e-4 && lv > 1e-4 ? dot(uSunDir.xz, v.xz) / (ls * lv) : 1.0;
  float w = pow(acos(clamp(ca, -1.0, 1.0)) * 0.3183099, 0.6666667) * ${LUT_NW - 1}.0;
  float i0 = min(floor(u), ${LUT_NU - 2}.0), j0 = min(floor(w), ${LUT_NW - 2}.0);
  float fu = u - i0, fw = w - j0;
  int k = int(i0) * ${LUT_NW} + int(j0);
  return mix(mix(uSkLut[k], uSkLut[k + 1], fw), mix(uSkLut[k + ${LUT_NW}], uSkLut[k + ${LUT_NW + 1}], fw), fu);
}
vec3 skAureole(vec3 v, float cth) {
  float pk = 0.93 * skHG(cth, 0.87) + 0.07 * skHG(cth, 0.97) - SK_PMCAP;
  if (pk <= 0.0) return vec3(0.0);
  float mu = max(v.y, 0.0);
  vec3 tM = SK_TM * min(skAirmass(mu, 5300.0), 3.0);
  vec3 tau = SK_TR * min(skAirmass(mu, 796.0), 3.0) + tM / 0.9 + SK_TO * min(skAirmass(mu, 260.0), 3.0);
  return SK_E * uSkSunSea * tM * pk * (1.0 - exp(-tau)) / tau;
}
vec3 skEclipseSky(vec3 v) {
  float h = abs(v.y);
  float yy = max(v.y, 0.0);
  vec3 c = mix(vec3(0.030, 0.030, 0.085), vec3(0.006, 0.008, 0.030), pow(yy, 0.5));
  vec2 sh = uSunDir.xz / max(length(uSunDir.xz), 1e-4);
  vec2 vh = v.xz / max(length(v.xz), 1e-4);
  float az = dot(sh, vh);
  float ring = 0.75 + 0.35 * az * az;
  c += vec3(1.00, 0.30, 0.06) * (exp(-h * 60.0) * 0.50 * ring);
  c += vec3(1.00, 0.58, 0.18) * (exp(-h * 16.0) * 0.28 * ring);
  c += vec3(0.95, 0.80, 0.50) * (exp(-h * 35.0) * 0.10 * ring);
  c += vec3(0.70, 0.30, 0.60) * (exp(-h * 6.0) * 0.07);
  float mu = max(dot(v, uSunDir), 0.0);
  c += vec3(0.55, 0.66, 1.00) * (pow(mu, 30.0) * 0.20 + pow(mu, 600.0) * 0.45);
  return c;
}
vec3 skNoPurple(vec3 c) {
  float ex = min(c.r, c.b) - c.g;
  if (ex <= 0.0) return c;
  float w = smoothstep(0.6, 1.1, c.b / max(c.r, 1e-6));
  return vec3(c.r - ex * w, c.g + 0.5 * ex * (1.0 - w), c.b);
}
vec3 skGreyBlue(vec3 c) {
  float wg = smoothstep(0.03, 0.075, uSunDir.y) * (1.0 - smoothstep(0.22, 0.45, uSunDir.y));
  return mix(dot(c, vec3(0.2126, 0.7152, 0.0722)) * mix(vec3(0.90, 1.0, 1.22), vec3(0.97, 0.97, 1.08), wg), c, 0.4 - 0.15 * wg);
}
vec3 skyBase(vec3 v) {
  vec3 c = skLut(v);
  float cth = dot(v, uSunDir);
  if (cth > 0.93) c += skAureole(v, cth) * (0.3 + 0.7 * smoothstep(0.03, 0.25, uSunDir.y));
  c = skNoPurple(c);
  c *= 1.0 - 0.45 * smoothstep(0.35, 0.95, uEclipse);
  c = mix(c, c * SK_SEA, 1.0 - smoothstep(-0.0012, 0.0055, v.y));
  return mix(c, skEclipseSky(v), skDark() * (0.55 + 0.45 * skTotal()));
}
const float SK_RE = 6371.0;
const float SK_HB = 1.25;
const float SK_CTHK = 1.0;
const float SK_SIG = 36.0;
float skDistTo(float mu, float h) {
  float m = max(mu, 0.0);
  float a = SK_RE * m;
  float b = h * (2.0 * SK_RE + h);
  return b / (sqrt(a * a + b) + a);
}
float skCovU(vec2 p) {
  vec2 q = p * 0.32 + vec2(3.1, 7.7);
  float n = 0.62 * skNoise(q) + 0.38 * skNoise(q * 2.07 + vec2(1.7, 9.2));
  vec2 ha = p - vec2(-3.63, -8.78), hb = p - vec2(0.97, -2.69), hc = p - vec2(-1.5, -5.7), hd = p - vec2(-0.43, -3.06), he = p - vec2(-3.06, -4.07);
  n += 0.42 * exp(-dot(ha, ha) / 2.4) - 0.25 * exp(-dot(hb, hb) / 1.2) - 0.32 * exp(-dot(hc, hc) / 3.0)
     - 0.3 * exp(-dot(hd, hd) / 1.0) - 0.3 * exp(-dot(he, he) / 1.0);
  vec2 hf = p - vec2(0.86, -1.87);
  n -= 0.6 * exp(-dot(hf, hf) / 1.0);
  return n - mix(0.6, 0.52, skNoise(p * 0.03 + vec2(5.3, 1.1)));
}
float skCov(vec2 p) { return smoothstep(-0.04, 0.34, skCovU(p)); }
const float SK_U0 = 0.1;
vec3 skAmbient() { return uSkAmb * ${v3(AMBK)}; }
float skCloudSun() { return (1.0 - 0.45 * smoothstep(0.35, 0.95, uEclipse)) * (1.0 - skDark()); }
float skClear(vec3 v) { return 1.0 - smoothstep(0.3, 0.85, uEclipse) * smoothstep(0.93, 0.985, dot(v, uSunDir)); }
float skMoonClear(vec3 v) {
  float e = (skNoise(v.xz * 23.0 + v.y * 7.0) - 0.5) * 0.05 + (skNoise(v.xz * 61.0 - v.y * 13.0) - 0.5) * 0.02;
  return 1.0 - 0.9 * uMoonLit * smoothstep(0.88, 0.975, dot(v, uMoonDir) + e);
}
float skFinClear(vec2 p) { return uCovFin.z * (1.0 - smoothstep(3.5, 6.5, length(p - uCovFin.xy))); }
float skSunClear(vec3 v) { return 1.0 - 0.9 * (1.0 - smoothstep(0.03, 0.2, uSunDir.y)) * smoothstep(0.96, 0.995, dot(v, uSunDir)); }
vec3 skCloudEcl(vec3 v) { return vec3(0.008, 0.010, 0.024) + vec3(0.16, 0.065, 0.025) * (0.25 * exp(-max(v.y, 0.0) * 14.0)); }
vec4 skCumulusFlatB(vec3 v, float angFp, vec3 base) {
  if (v.y < 0.012) return vec4(0.0);
  float tm = skDistTo(v.y, SK_HB + 0.25);
  vec2 p = uCloudOff + v.xz * tm;
  float fp = tm * angFp / max(v.y, 0.03);
  float c = skCov(p);
  float bl = mix(0.5, skNoise(p * 1.9 + vec2(4.1, 2.2)) * 0.65 + skNoise(p * 4.3 + vec2(7.7, 1.9)) * 0.35, 1.0 - smoothstep(0.3, 0.8, fp * 1.9));
  float sp = smoothstep(0.05, 0.8, fp);
  float cover = smoothstep(0.35 - 0.3 * sp, 0.7 + 0.25 * sp, c * (0.7 + 0.6 * bl));
  cover = mix(cover, 0.1, smoothstep(0.5, 2.0, fp)) * skClear(v) * skMoonClear(v) * skSunClear(v) * (1.0 - skFinClear(p));
  if (cover < 0.002) return vec4(0.0);
  float kb = clamp(-uSkKeyDir.y * 12.0, 0.0, 1.0);
  float up = mix(0.2, 1.0, smoothstep(0.0, 0.35, uSkKeyDir.y));
  float lit = 0.02 * up + 0.09 * kb + skHG(dot(v, uSkKeyDir), 0.75) * 0.45 * (1.0 - 0.8 * cover);
  vec3 c3 = skNoPurple(uSkKeyCol * (skCloudSun() * lit) + skGreyBlue(skAmbient()) * 0.85);
  c3 = mix(c3, skCloudEcl(v), skDark());
  c3 = max(mix(c3, base, 1.0 - exp(-tm / 20.0)), 0.0);
  return vec4(c3 * cover, cover);
}
vec4 skCumulusFlat(vec3 v, float angFp) { return skCumulusFlatB(v, angFp, skyBase(v)); }
vec4 skCirrusB(vec3 v, float angFp, vec3 base) {
  if (v.y < 0.05) return vec4(0.0);
  float t = skDistTo(v.y, 9.0);
  vec2 p = v.xz * t + uCloudOff * 2.2;
  float pat = smoothstep(0.66, 0.86, skNoise(p * 0.09 + vec2(3.3, 8.1))) * smoothstep(0.35, 0.65, skNoise(p * 0.023 + vec2(7.1, 2.4)));
  if (pat <= 0.0) return vec4(0.0);
  float fp = t * angFp / max(v.y, 0.05);
  float ang = 0.6 + 2.4 * (skNoise(p * 0.035 + vec2(1.9, 4.4)) - 0.5);
  vec2 dr = vec2(cos(ang), sin(ang));
  vec2 a = vec2(dot(p, dr), dot(p, vec2(-dr.y, dr.x)));
  a += (vec2(skNoise(a * 0.3 + vec2(2.0, 7.0)), skNoise(a * 0.3 + vec2(5.0, 1.0))) - 0.5) * 1.6;
  float f1 = 1.0 - abs(skNoise(vec2(a.x * 0.9, a.y * 3.6) + vec2(9.1, 3.3)) * 2.0 - 1.0);
  float f2 = 1.0 - abs(skNoise(vec2(a.x * 2.2, a.y * 8.0) + vec2(1.1, 6.3)) * 2.0 - 1.0);
  f1 = mix(0.55, f1 * f1, 1.0 - smoothstep(0.2, 0.5, fp * 3.6));
  f2 = mix(0.55, f2 * f2, 1.0 - smoothstep(0.2, 0.5, fp * 8.0));
  float al = pat * (0.15 + 0.85 * (f1 * 0.6 + f2 * 0.4)) * 0.16 * smoothstep(0.05, 0.3, v.y) * skClear(v);
  vec3 c = skNoPurple(uSkKeyCol * (skCloudSun() * (0.06 + 0.08 * skHG(dot(v, uSkKeyDir), 0.7))) + skGreyBlue(skAmbient()) * 0.85);
  c = mix(c, skCloudEcl(v), skDark());
  c = mix(c, base, 1.0 - exp(-t / 90.0));
  return vec4(c, al);
}
vec4 skCirrus(vec3 v, float angFp) { return skCirrusB(v, angFp, skyBase(v)); }
vec4 skStratusB(vec3 v, float angFp, vec3 base) {
  if (v.y < 0.004 || v.y > 0.26) return vec4(0.0);
  float t = min(skDistTo(v.y, 3.2), 120.0);
  vec2 p = v.xz * t + uCloudOff * 1.6;
  float al = smoothstep(0.35, 0.65, skNoise(p * 0.035 + vec2(8.8, 3.3))) * skClear(v) * skSunClear(v);
  if (al <= 0.0) return vec4(0.0);
  vec2 a = vec2(dot(p, vec2(0.91, -0.41)), dot(p, vec2(0.41, 0.91)));
  a.y += (skNoise(a * vec2(0.04, 0.08) + vec2(3.7, 1.2)) - 0.5) * 3.0;
  float fp = t * angFp / max(v.y, 0.004);
  float bank = smoothstep(0.45, 0.75, skNoise(vec2(a.x * 0.02, a.y * 0.09) + vec2(6.1, 2.8)));
  bank = mix(0.2, bank, 1.0 - smoothstep(0.25, 0.6, fp * 0.09));
  if (bank <= 0.0) return vec4(0.0);
  float fib = mix(0.5, skNoise(vec2(a.x * 0.16, a.y * 1.9) + vec2(1.3, 7.4)), 1.0 - smoothstep(0.3, 1.0, fp * 1.9));
  al *= bank * mix(0.6, 1.0, fib) * 0.45 * smoothstep(0.004, 0.03, v.y) * (1.0 - smoothstep(0.1, 0.26, v.y));
  if (al <= 0.0) return vec4(0.0);
  float lb = dot(base, vec3(0.2126, 0.7152, 0.0722));
  vec3 kc = uSkKeyCol / max(dot(uSkKeyCol, vec3(0.2126, 0.7152, 0.0722)), 1e-6);
  vec3 c = skNoPurple(mix(base, lb * kc, 0.45) * (1.2 + 0.5 * skHG(dot(v, uSkKeyDir), 0.6) * skCloudSun()));
  c = mix(c, skCloudEcl(v), skDark());
  c = mix(c, base, 1.0 - exp(-t / 110.0));
  return vec4(c, al);
}
vec4 skyClouds(vec3 v) { vec4 c = skCumulusFlat(v, 0.0015); return vec4(c.rgb / max(c.a, 1e-4), c.a); }
vec3 skyColor(vec3 v) { vec4 c = skCumulusFlat(v, 0.0015); return skyBase(v) * (1.0 - c.a) + c.rgb; }
vec3 skyReflect(vec3 v, float spread) {
  float s = max(spread, 0.002);
  vec3 base = skyBase(v);
  vec4 ci = skCirrusB(v, s, base);
  vec3 c = mix(base, ci.rgb, ci.a);
  vec4 cu = skCumulusFlatB(v, s, base);
  return c * (1.0 - cu.a) + cu.rgb;
}
`;

const DOME_VERT = `
varying vec3 vDir;
void main() {
  vDir = position;
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;
}
`;

const [GP, GC] = (() => {
  const d2r = Math.PI / 180, azel = (az, el) => [Math.sin(az * d2r) * Math.cos(el * d2r), Math.sin(el * d2r), -Math.cos(az * d2r) * Math.cos(el * d2r)];
  const a = azel(15, 8), b = azel(75, 55), un = (v) => { const l = Math.hypot(...v); return v.map((x) => x / l); };
  const p = un([a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]);
  const d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2], t = un(b.map((x, i) => x - a[i] * d));
  return [p, un(a.map((x, i) => x * Math.cos(0.1) - t[i] * Math.sin(0.1)))];
})();

const CU_SHAPE = `
const float SK_RR = 0.15;
const float SK_REACH = 0.15;
const float SK_ROPEN = 0.27;
const float SK_RCLOSE = 0.2;
const float SK_LIFT = 0.25;
float skCuH(float m, float u, float uc) { float k = clamp(u / max(uc, 1e-3), 0.0, 1.0); return mix(0.32, 0.64, smoothstep(SK_ROPEN, 1.25, m)) * mix(0.5, 1.0, k * (2.0 - k)); }
float skCuW2(float e) { float s = min(abs(e) / SK_RR, 1.0); return s * (2.0 - s); }
float skCuWall(float e) { return sign(e) * sqrt(skCuW2(e)); }
float skCuRR(float m) { return clamp(0.65 * m, SK_RR, 0.8); }
float skCuW2r(float e, float rr) { float s = min(abs(e) / rr, 1.0); return s * (2.0 - s); }
float skCuTop(float e, float hc) { return hc * skCuWall(e); }
`;

const CLOUD_GLSL = `
vec2 skN3rg(vec3 p) { return textureLod(uNoise3, p * 0.0625, 0.0).rg; }
const float SK_MS = 2.1;
const float SK_AMB = 1.8;
const float SK_DK = 1.25;
const float SK_SOFT = 2.0;
const float SK_SKIN = 0.18;
const float SK_BSOFT = 0.1;
${CU_SHAPE}
vec3 skCovT(vec2 p) { return textureLod(uCovTex, (p - uCovC.xy) * uCovC.z + 0.5, 0.0).rgb; }
vec4 skCuIn(vec3 X, float dk) {
  vec3 ce = skCovT(X.xz);
  float rr = skCuRR(ce.z - dk);
  return vec4(ce.x - dk, min(max(ce.y - 0.5 * dk, 0.22), 1.2 * rr), ce.y, rr);
}
float skCuDensity(vec3 X, vec4 ce, float fw, bool full, out float sh) {
  sh = 0.5;
  float hb = X.y - SK_HB;
  if (hb <= 0.0 || hb >= SK_CTHK || ce.x <= -SK_REACH) return 0.0;
  float H = ce.y;
  float cr = smoothstep(0.3, 1.0, ce.x / SK_RR);
  float ab = mix(0.14, 0.3, cr);
  float al = full ? 0.17 * cr * smoothstep(0.2, 0.5, hb / H) * (1.0 - smoothstep(0.15, 0.45, fw * 9.5)) : 0.0;
  float hx = hb - 0.5 * (ab + al);
  if (hx > 0.0 && hx * hx >= H * H * skCuW2r(ce.x + 0.12, ce.w)) return 0.0;
  vec2 n = skN3rg(vec3(X.x, X.y - 0.7 * cr * (X.y - SK_HB - 0.6 * H), X.z) * vec3(5.3, 8.5, 5.3) + vec3(7.0 * ce.z, -uCloudOff.x * 0.5, -5.0 * ce.z));
  float b = smoothstep(0.1, 1.0, n.g * 0.8 + n.r * 0.2) - 0.5;
  float db = ab * b, dl = 0.0;
  if (al > 0.0) dl = al * (smoothstep(0.25, 0.85, skN3rg(vec3(X.x * 9.5 + 3.9, (SK_HB + H) * 17.0 + 2.3 - uCloudOff.x, X.z * 9.5 + 7.1)).g) - 0.5);
  float hf = hb / H, bo = b > 0.0 ? b * mix(0.3, 1.0, smoothstep(0.1, 0.45, hf) - smoothstep(0.6, 0.95, hf)) : b;
  float q = skCuW2r(ce.x + 0.24 * bo, ce.w), wl = sign(ce.x + 0.24 * bo) * sqrt(q);
  float f = H * wl - hb + db + dl;
  sh = clamp(0.5 + (db + dl) / (ab + al), 0.0, 1.0);
  float gw = H * (1.0 - min(abs(ce.x + 0.24 * bo) / ce.w, 1.0)) / (ce.w * sqrt(max(q, 0.02)));
  float g = sqrt(1.0 + gw * gw);
  float sk = SK_SKIN * (0.6 + 0.8 * n.r) * clamp(H / 0.5, 0.4, 1.0);
  if (!full) return clamp(min(f / (max(max(6.0 * fw, 0.03), sk) * g), hb / 0.012), 0.0, 1.0);
  float w = clamp(mix(SK_SOFT, 4.0 * SK_SOFT, smoothstep(0.007, 0.02, fw)) * fw, 0.006, 0.25 * H);
  float s = f / g;
  sk = max(w, sk);
  float hl = hb - 0.06 * (1.0 - smoothstep(-0.1, 0.45, ce.x)) - 0.07 * n.r;
  float bs = max(w, SK_BSOFT * (0.5 + n.g));
  if (s >= sk && hl >= bs) return 1.0;
  float dn = min(clamp(s / sk, 0.0, 1.0), clamp(hl / bs, 0.0, 1.0));
  float wd1 = 1.0 - smoothstep(0.1, 0.3, fw * 9.0), wd2 = 1.0 - smoothstep(0.1, 0.3, fw * 20.0);
  if (wd1 > 0.0 && dn > 0.0 && dn < 1.0) {
    float nw = skN3rg(vec3(X.x * 13.0, X.y * 34.0, X.z * 13.0) + vec3(1.7, 9.1 - uCloudOff.x * 2.0, 4.3)).g;
    if (wd2 > 0.0) nw = mix(nw, 0.65 * nw + 0.35 * skN3rg(X * 29.0 + vec3(5.3, 2.9 - uCloudOff.x * 3.0, 8.1)).g, wd2);
    return smoothstep(0.95 * wd1 * (1.0 - smoothstep(0.2, 0.8, nw)), 1.0, dn);
  }
  return dn * dn * (3.0 - 2.0 * dn);
}
float skCuDensityM(vec3 X, vec4 ce, float ds) {
  float hb = X.y - SK_HB;
  if (hb <= 0.0) return 0.0;
  return clamp(0.5 + ce.x / ds, 0.0, 1.0) * clamp(min((ce.y * sqrt(skCuW2r(ce.x, ce.w)) - hb) / max(0.5 * ds, SK_SKIN), hb / 0.012), 0.0, 1.0);
}
float skCuShadow(vec3 X, vec3 L, float dk) {
  float od = 0.0, s = 0.0, sh;
  for (int i = 0; i < 4; i++) {
    float ds = i < 3 ? 0.04 * exp2(float(i)) : 0.96;
    vec3 Y = X + L * (s + 0.5 * ds);
    s += ds;
    vec4 ce = skCuIn(Y, dk);
    od += (i < 1 ? skCuDensity(Y, ce, ds / 6.0, false, sh) : skCuDensityM(Y, ce, ds)) * ds;
  }
  return od;
}
vec3 skCuAt(vec3 O, vec3 v, float t) { vec3 X = O + v * t; X.y = v.y * t + t * t * (0.5 / SK_RE); return X; }
vec3 skCuShade(vec3 c) {
  float wl = (1.0 - smoothstep(0.22, 0.45, uSunDir.y)) * (1.0 - uSkNight);
  return mix(dot(c, vec3(0.2126, 0.7152, 0.0722)) * mix(vec3(0.90, 1.0, 1.2), vec3(1.0, 0.96, 1.1), wl), c, 0.15) * SK_AMB;
}
vec3 skCuNoViolet(vec3 c) {
  float ex = min(c.r, c.b) - 1.06 * c.g;
  if (ex <= 0.0) return c;
  float w = smoothstep(0.6, 1.1, c.b / max(c.r, 1e-6));
  return vec3(c.r - ex * w, c.g + 0.5 * ex * (1.0 - w), c.b);
}
vec4 skCumulus(vec3 v, float pa, vec3 sky) {
  if (v.y < 0.01) return vec4(0.0);
  float kc = smoothstep(0.1, 1.0, skClear(v) * skMoonClear(v) * skSunClear(v));
  if (kc <= 0.0) return vec4(0.0);
  float dk = SK_DK * (1.0 - kc);
  float t0 = skDistTo(v.y, SK_HB);
  float t1 = min(skDistTo(v.y, SK_HB + SK_CTHK), 45.0);
  if (t1 <= t0) return vec4(0.0);
  vec3 O = vec3(uCloudOff.x, 0.0, uCloudOff.y);
  float hz = 0.9 / max(length(v.xz), 0.05);
  vec3 Lk = uSkKeyDir;
  float cth = dot(v, Lk);
  float ph1 = 0.8 * skHG(cth, 0.8) + 0.2 * skHG(cth, -0.25);
  float phm = 0.5 * skHG(cth, 0.3) + 0.5 / (4.0 * SK_PI);
  float pwk = 0.6 * (0.5 - 0.5 * cth);
  float kg = (1.0 - smoothstep(-0.035, -0.002, uSunDir.y)) * smoothstep(0.9, 0.99, dot(Lk, uSunDir));
  ph1 = mix(ph1, phm, kg);
  vec3 Ls = normalize(vec3(Lk.x, mix(Lk.y, 0.0, kg), Lk.z));
  float wgh = smoothstep(-0.03, 0.0, uSunDir.y) * (1.0 - smoothstep(0.22, 0.45, uSunDir.y));
  vec3 sunL = uSkKeyCol * skCloudSun();
  vec3 ambHi = skCuShade(uSkAmb);
  float klv = max((1.0 - kg) * (1.0 - uSkNight) * (1.0 - smoothstep(0.22, 0.45, uSunDir.y)) * smoothstep(-0.2, 0.6, cth), 0.9 * kg);
  ambHi *= max(1.0, 0.5 * klv * dot(sky, vec3(0.2126, 0.7152, 0.0722)) / max(dot(ambHi, vec3(0.2126, 0.7152, 0.0722)), 1e-9));
  vec3 ambLo = ambHi * 0.7;
  vec3 ambC = ambHi / max(dot(ambHi, vec3(0.2126, 0.7152, 0.0722)), 1e-9);
  vec3 Lc = vec3(0.0);
  float T = 1.0, tw = 0.0, t = t0, dt = 0.006, tq = t0, tauS = 0.0, nS = 0.0;
  bool inCu = false;
  for (int i = 0; i < 112; i++) {
    vec3 X = skCuAt(O, v, t);
    vec4 ce = skCuIn(X, dk);
    float sh = 0.5, d = 0.0;
    if (ce.x > -SK_REACH) d = skCuDensity(X, ce, t * pa, true, sh);
    float tg = t < 12.0 ? 0.03 : 0.06;
    if (d <= 0.0) {
      inCu = false;
      tq = t;
      float ns = max(1.0, floor(max(-ce.x - SK_REACH, 0.0) * hz / tg));
      t = (floor(t / tg + 1e-4) + ns) * tg;
      if (ns < 3.0) {
        vec2 cq = ((X.xz - uCovC.xy) * uCovC.z + 0.5) * 128.0;
        vec2 cb = texelFetch(uCovMax, ivec2(cq), 0).rg;
        if (cb.x <= -SK_REACH || X.y - SK_HB >= cb.y + SK_LIFT) {
          vec2 ex = ((floor(cq) + step(0.0, v.xz)) / 128.0 - 0.5) / uCovC.z + uCovC.xy - O.xz;
          vec2 tx = ex / (v.xz + vec2(v.x < 0.0 ? -1e-7 : 1e-7, v.z < 0.0 ? -1e-7 : 1e-7));
          float te = min(tx.x, tx.y), tge = te < 12.0 ? 0.03 : 0.06;
          t = max(t, ceil(te / tge - 1e-4) * tge);
        }
      }
      if (t > t1) break;
      continue;
    }
    if (!inCu) {
      float ta = max(t - tg, tq), tb = t;
      for (int k = 0; k < 6; k++) {
        if (tb - ta < 0.25 * t * pa) break;
        float tm = 0.5 * (ta + tb);
        vec3 Y = skCuAt(O, v, tm);
        vec4 cm = skCuIn(Y, dk);
        float shm = 0.5, dm = 0.0;
        if (cm.x > -SK_REACH) dm = skCuDensity(Y, cm, tm * pa, true, shm);
        if (dm > 0.0) { tb = tm; X = Y; ce = cm; d = dm; sh = shm; } else ta = tm;
      }
      t = tb;
      inCu = true;
      dt = 0.01;
      nS = 0.0;
    }
    dt = min(clamp(1.0 / (SK_SIG * max(d, 0.04)), 0.012, 0.05), 2.0 * dt);
    if (fract(nS / 3.0) < 0.1) tauS = SK_SIG * skCuShadow(X, Ls, dk);
    nS += 1.0;
    float hf = clamp((X.y - SK_HB) / ce.y, 0.0, 1.0);
    float ms = (1.0 - pwk * exp(-2.0 * tauS)) * mix(1.0 / pow(1.0 + 0.3 * tauS, 1.0 + 0.1 * smoothstep(0.0, 0.6, cth)), mix(exp(-tauS / 7.0), exp(-tauS / 12.0), 1.0 - smoothstep(0.0, 0.4, hf)) * mix(1.0, 0.55, hf), kg);
    vec3 msL = mix(sunL, dot(sunL, vec3(0.2126, 0.7152, 0.0722)) * ambC, (0.5 - 0.5 / (1.0 + 0.3 * tauS)) * (1.0 - wgh));
    float oc = mix(0.55, 1.0, sh);
    float kb = mix(smoothstep(0.0, 0.4, hf), 1.0, kg);
    vec3 Sc = sunL * (ph1 * exp(-tauS) * mix(smoothstep(0.0, 0.12, hf), 1.0, kg)) + msL * (SK_MS * phm * ms * oc * (1.0 - 0.2 * wgh) * mix(0.5, 1.0, kb)) + mix(ambLo, ambHi, smoothstep(0.0, 0.8, hf)) * ((1.0 + 0.6 * max(cth, 0.0)) * oc * (1.0 - 0.65 * wgh * exp(-0.3 * tauS)));
    float Ti = exp(-SK_SIG * d * dt);
    Lc += Sc * (T * (1.0 - Ti));
    tw += t * (T * (1.0 - Ti));
    T *= Ti;
    if (T < 0.08) { Lc += Sc * T; tw += t * T; T = 0.0; break; }
    t += dt;
    if (t > t1) break;
  }
  float ac = 1.0 - T;
  if (ac < 0.001) return vec4(0.0);
  float tm = tw / ac;
  float far = 1.0 - smoothstep(28.0, 45.0, tm);
  Lc = skCuNoViolet(Lc);
  Lc = max(Lc, ac * smoothstep(0.0, 0.5, uSkNight) * 0.8 * mix(vec3(dot(sky, vec3(0.2126, 0.7152, 0.0722))), sky, 0.3));
  Lc = max(Lc, sky * (0.95 * ac * (1.0 - smoothstep(0.15, 0.5, ac))));
  Lc = mix(Lc, skCloudEcl(v) * ac, skDark());
  Lc = mix(Lc, sky * ac, 1.0 - exp(-tm / 40.0));
  return vec4(Lc * far, ac * far);
}
`;

const MOON_GLSL = `
float skMare(vec2 q, vec2 c, vec2 r, float w) {
  vec2 d = (q - c) / r;
  float e = dot(d, d) + (skNoise(q * 7.0 + c * 13.0) - 0.5) * 0.5 * w;
  return 1.0 - smoothstep(0.55, 1.05, e);
}
float skMoonAlbedo(vec2 q, float px) {
  float w1 = 1.0 - smoothstep(0.25, 0.5, px * 7.0);
  float m = skMare(q, vec2(-0.33, 0.42), vec2(0.30, 0.26), w1);
  m = max(m, skMare(q, vec2(0.22, 0.38), vec2(0.17, 0.16), w1));
  m = max(m, skMare(q, vec2(0.36, 0.08), vec2(0.21, 0.17), w1));
  m = max(m, skMare(q, vec2(0.76, 0.30), vec2(0.11, 0.13), w1));
  m = max(m, skMare(q, vec2(0.58, -0.16), vec2(0.12, 0.17), w1));
  m = max(m, skMare(q, vec2(0.40, -0.30), vec2(0.09, 0.09), w1));
  m = max(m, skMare(q, vec2(-0.66, 0.02), vec2(0.26, 0.45), w1));
  m = max(m, skMare(q, vec2(-0.20, -0.33), vec2(0.17, 0.13), w1));
  m = max(m, skMare(q, vec2(-0.56, -0.38), vec2(0.10, 0.09), w1));
  m = max(m, skMare(q, vec2(0.02, 0.76), vec2(0.42, 0.07), w1));
  float w2 = 1.0 - smoothstep(0.25, 0.5, px * 16.0);
  float n = mix(0.5, skNoise(q * 16.0 + vec2(3.1, 7.7)), w2);
  float alb = mix(0.14, 0.098, m) * (0.92 + 0.16 * n);
  vec2 dt = q - vec2(-0.12, -0.66);
  float dl = length(dt);
  float rays = smoothstep(0.62, 0.9, skNoise(dt / max(dl, 1e-4) * 4.0 + vec2(9.1, 2.3))) * (1.0 - smoothstep(0.05, 0.6, dl)) * w1;
  vec2 dc = q - vec2(-0.28, 0.14);
  return alb + 0.035 * exp(-dl * dl / 0.0016) + 0.02 * rays * (1.0 - m) + 0.025 * exp(-dot(dc, dc) / 0.0012);
}
vec4 skMoon(vec3 v, float pa, out vec3 halo) {
  halo = vec3(0.0);
  vec3 M = uMoonDir;
  float cm = dot(v, M);
  if (cm < 0.93) return vec4(0.0);
  float Rm = SK_MOON_R;
  vec3 tc = cross(M, vec3(0.0, 1.0, 0.0));
  vec3 m1 = tc / max(length(tc), 1e-4);
  vec3 m2 = cross(m1, M);
  vec2 pp = vec2(dot(v, m1), dot(v, m2)) / (max(cm, 0.05) * Rm);
  float r = length(pp);
  float px = pa / Rm;
  float ang = r * Rm;
  vec3 mc = uSkMoonSea;
  halo = mc * ((0.07 * exp(-ang / (Rm * 2.5)) + 0.025 * exp(-ang / (Rm * 10.0))) * smoothstep(0.93, 0.975, cm));
  float cov = (1.0 - smoothstep(1.0 - px, 1.0 + px, r)) * smoothstep(-0.0016, 0.0006, v.y);
  if (cov <= 0.0) return vec4(0.0);
  vec2 q = pp / max(r, 1.0);
  float mu = sqrt(max(1.0 - dot(q, q), 0.0));
  vec3 n = q.x * m1 + q.y * m2 - M * mu;
  float mu0 = max(dot(n, uSkMoonSun), 0.0);
  float lit = 2.0 * mu0 / (mu0 + mu + 0.02) * smoothstep(-0.04, 0.05, dot(n, uSkMoonSun));
  float alb = skMoonAlbedo(q, px);
  vec3 disc = mc * (2.5 / max(uSkMoonPl, 0.02) * alb * (lit * (0.9 + 0.1 * mu) + 0.022));
  return vec4(disc * cov, cov);
}
`;

const DOME_FRAG = `
precision highp sampler3D;
${SKY_DECL}
uniform sampler3D uNoise3;
uniform sampler2D uCloudTex;
uniform vec2 uCloudInv;
uniform float uSkTime;
uniform float uSkSunBlow;
${SKY_FUNCS}
varying vec3 vDir;
const vec3 SK_GP = ${v3(GP)};
const vec3 SK_GC = ${v3(GC)};
const float SK_RF0 = 0.0068, SK_RFA = 0.0262, SK_SHIM = 0.0016, SK_HZH = 2.2;
const float SK_VIVID = 0.12;
float skRefr(float a) { return SK_RF0 * exp(-max(a, -0.01) / SK_RFA); }
vec3 planetCol(int i) {
  if (i == 0) return vec3(0.9, 0.85, 0.8);
  if (i == 1) return vec3(1.0, 0.97, 0.9);
  if (i == 2) return vec3(1.0, 0.55, 0.35);
  if (i == 3) return vec3(1.0, 0.93, 0.8);
  return vec3(0.95, 0.88, 0.7);
}
float skN3(vec3 p) { return textureLod(uNoise3, p * 0.0625, 0.0).r; }
const mat3 SK_R1 = mat3(0.6486, 0.6821, -0.3376, -0.5740, 0.7297, 0.3715, 0.4998, -0.0472, 0.8649);
const mat3 SK_R2 = mat3(0.4940, 0.2410, -0.8354, -0.8638, 0.0269, -0.5030, -0.0988, 0.9701, 0.2215);
vec3 skCorona(vec2 pp, float px) {
  float r = length(pp);
  if (r < 1.0) return vec3(0.0);
  vec2 dir = pp / r;
  float lat = dot(dir, vec2(0.309, 0.951));
  float equ = 1.0 - lat * lat;
  float x = r - 1.0;
  float k = 1.3 * exp(-x * 9.0) + 0.5 * pow(r, -3.0) * (0.5 + 0.5 * equ);
  float fan = smoothstep(0.45, 0.9, skNoise(dir * 2.4 + vec2(13.7, 4.1))) * (0.3 + 0.7 * equ * equ);
  float streamers = pow(fan, 1.0 + x * 1.1) * 0.55 * pow(r, -1.4);
  float f1 = skNoise(dir * 4.6 + vec2(3.1, 7.7));
  float f2 = mix(0.5, skNoise(dir * 11.0 + vec2(9.4, 2.2)), 1.0 - smoothstep(0.2, 0.5, px * 11.0 / r));
  float f3 = mix(0.5, skNoise(dir * 24.0 + vec2(5.6, 8.3)), 1.0 - smoothstep(0.2, 0.5, px * 24.0 / r));
  float f4 = mix(0.5, skNoise(dir * 52.0 + vec2(1.9, 6.4)), 1.0 - smoothstep(0.2, 0.5, px * 52.0 / r));
  float fil = f1 * 0.35 + f2 * 0.3 + f3 * 0.2 + f4 * 0.15;
  float plumes = smoothstep(0.6, 0.93, abs(lat)) * fil * fil * 1.3 * exp(-x * 2.2);
  float rays = (fil - 0.5) * 1.1 * (k + streamers);
  return vec3(0.92, 0.96, 1.0) * max(k + streamers + plumes + rays, 0.0);
}
float skAngTo(vec2 dir, float c) { vec2 s = vec2(cos(c), sin(c)); return atan(dir.x * s.y - dir.y * s.x, dot(dir, s)); }
float skTongue(vec2 dir, float x, float c, float w, float hh, float seed) {
  float u = skAngTo(dir, c) / w;
  float top = hh * exp(-u * u) * (0.6 + 0.4 * skNoise(dir * 38.0 + seed));
  return (1.0 - smoothstep(top * 0.45, top + 1e-4, x)) * exp(-u * u * 0.5);
}
float skLoop(vec2 dir, float x, float c, float w, float hh) {
  float u = skAngTo(dir, c) / w;
  float e = sqrt(u * u + (x / hh) * (x / hh));
  float z = (e - 1.0) / 0.4;
  return exp(-z * z) * step(0.0, x);
}
vec3 skProminences(vec2 pp) {
  float r = length(pp);
  float x = r - 1.0;
  if (x < -0.01 || x > 0.3) return vec3(0.0);
  vec2 dir = pp / r;
  float p = skTongue(dir, x, 0.62, 0.07, 0.20, 1.0) + skTongue(dir, x, 2.55, 0.05, 0.14, 7.0)
          + skTongue(dir, x, 4.35, 0.09, 0.22, 13.0) + skTongue(dir, x, 5.60, 0.04, 0.12, 19.0)
          + skLoop(dir, x, 1.70, 0.10, 0.18) * 0.8 + skLoop(dir, x, 3.60, 0.07, 0.13) * 0.7;
  float chrom = 1.0 - smoothstep(0.012, 0.035, x);
  float e = (p + chrom * 0.9) * smoothstep(-0.006, 0.002, x);
  return mix(vec3(1.0, 0.16, 0.36), vec3(1.0, 0.55, 0.62), clamp(p * 0.5 - x * 2.0, 0.0, 1.0)) * (e * 7.0);
}
vec3 skStarField(vec3 v, float pa, float lim, float gal) {
  vec3 sp = v * 160.0;
  vec3 ci = floor(sp);
  float h = skH31(ci);
  float dens = 0.02 * (0.55 + 1.3 * gal);
  if (h < 1.0 - dens) return vec3(0.0);
  float u = max((h - (1.0 - dens)) / dens, 3e-4);
  float m = 6.5 + 0.60206 * log2(u);
  float vis = 1.0 - smoothstep(lim - 0.5, lim + 0.5, m);
  if (vis <= 0.0) return vec3(0.0);
  vec3 j = vec3(skH31(ci + 17.31), skH31(ci + 41.93), skH31(ci + 73.17));
  vec3 d = sp - normalize(ci + 0.3 + 0.4 * j) * 160.0;
  float sz = max(pa * 104.0, 0.02);
  float flux = exp2((6.5 - m) * 1.3288);
  float ext = exp(-0.22 * (1.0 / max(v.y, 0.035) - 1.0));
  float tc = skH31(ci + 5.77);
  vec3 c = tc < 0.2 ? vec3(0.80, 0.87, 1.0) : (tc < 0.8 ? vec3(1.0, 0.97, 0.93) : (tc < 0.95 ? vec3(1.0, 0.87, 0.70) : vec3(1.0, 0.74, 0.55)));
  return c * (exp(-dot(d, d) / (sz * sz)) * flux / (sz * sz) * vis * ext * 5e-5);
}
vec3 skMilkyWay(vec3 v, float pa) {
  float sb = dot(v, SK_GP);
  float wing = exp(-sb * sb * 5.0);
  if (wing < 0.03) return vec3(0.0);
  float band = exp(-sb * sb * 55.0);
  float w2 = 1.0 - smoothstep(0.25, 0.5, pa * 22.0);
  float w3 = 1.0 - smoothstep(0.25, 0.5, pa * 64.0);
  float n1 = skN3(v * 5.0 + vec3(3.1, 1.7, 5.3));
  float n2 = mix(0.5, skN3(v * 14.0 + vec3(7.7, 2.9, 4.1)), w2);
  float n3 = mix(0.5, skN3(v * 64.0 + vec3(1.3, 8.8, 6.6)), w3);
  float clouds = band * (0.35 + 0.9 * n1 * (0.5 + n2)) + 0.18 * wing * n1;
  float rift = smoothstep(0.52, 0.7, n2 * 0.55 + n1 * 0.45) * exp(-sb * sb * 500.0);
  float core = 1.0 + 1.5 * exp(-(1.0 - dot(v, SK_GC)) * 7.0);
  return vec3(0.0030, 0.0029, 0.0027) * (clouds * (1.0 - 0.7 * rift) * core * (0.4 + 1.2 * n3 * n3));
}
${MOON_GLSL}
void main() {
  vec3 v = normalize(vDir);
  float pa = clamp(max(length(dFdx(v)), length(dFdy(v))), 1e-5, 0.02);
  vec3 base = skyBase(v);
  vec3 col = base;
  float dark = skDark();
  float tot = skTotal();
  float R = uSunSize;
  vec3 tc = cross(uSunDir, vec3(0.0, 1.0, 0.0));
  vec3 t1 = tc / max(length(tc), 1e-4);
  vec3 t2 = cross(t1, uSunDir);
  float vs = dot(v, uSunDir);
  vec2 pp = vec2(dot(v, t1), dot(v, t2)) / (max(vs, 0.05) * R);
  float front = step(0.0, vs);
  float px = pa / R;
  float sr = length(pp);
  float ea = asin(clamp(v.y, -1.0, 1.0));
  float shim = (skNoise(vec2(atan(v.x, -v.z) * 35.0, ea * 260.0 + uSkTime * 2.3)) - 0.5) * SK_SHIM * exp(-max(ea, 0.0) / 0.006);
  float et = ea - skRefr(ea) + shim;
  vec3 vt = vec3(v.x, 0.0, v.z) * (cos(et) / max(length(v.xz), 1e-5)) + vec3(0.0, sin(et), 0.0);
  float vst = dot(vt, uSunDir);
  vec2 pd = vec2(dot(vt, t1), dot(vt, t2)) / (max(vst, 0.05) * R);
  float sd = length(pd);
  float lim = max(mix(-1.5, 6.3, uSkNight) - 0.8 * uMoonLit * smoothstep(-0.05, 0.25, uMoonDir.y), mix(-2.0, 5.2, tot));
  if (v.y > 0.0) {
    float sb = dot(v, SK_GP);
    if (uSkNight > 0.0) col += skMilkyWay(v, pa) * (uSkNight * uSkNight * (1.0 - 0.55 * uMoonLit) * uSkGain);
    if (lim > -1.2) col += skStarField(v, pa, lim, exp(-sb * sb * 30.0)) * uSkGain;
  }
  if (uMoonLit > 0.0) {
    vec3 halo;
    vec4 mo = skMoon(v, pa, halo);
    col = mix(col, base, mo.a) + mo.rgb + halo;
    col += uSkMoonSea * (0.0035 * uMoonLit * exp(-(1.0 - dot(v, uMoonDir)) * 14.0));
  }
  float md = atan(length(cross(v, uMoonDir)), dot(v, uMoonDir)) / R;
  float moon = 1.0 - smoothstep(1.035 - px, 1.035 + px, md);
  float pe = px + 0.12 + 0.28 * exp(-max(ea, 0.0) / 0.02);
  float disc = (1.0 - smoothstep(1.0 - pe, 1.0 + pe, sd)) * step(0.0, vst) * smoothstep(-0.0016, 0.0006, v.y);
  float mu = sqrt(max(1.0 - sd * sd, 0.0));
  vec3 limb = 1.0 - vec3(0.08, 0.10, 0.13) * (1.0 - mu);
  vec3 haze = SK_HZH * exp(-max(ea, 0.0) / 0.0045) * vec3(0.75, 1.0, 1.3);
  vec3 sunCol = uSkSunDisc * exp(-(skDepth(max(v.y, 0.0)) - skDepth(max(uSunDir.y, 0.0015))) - haze);
  col = mix(col, max(col, sunCol * (18.0 * uSkSunBlow) * limb), disc * (1.0 - moon));
  float lowS = smoothstep(-0.03, 0.0, uSunDir.y) * (1.0 - smoothstep(0.05, 0.14, uSunDir.y)) * (1.0 - skDark());
  if (lowS > 0.0 && vs > 0.95 && v.y > -0.004) {
    float sa = length(vec2(pp.x, pp.y * 1.6));
    float g = 2.0 * exp(-sa / 1.2) + 0.6 * exp(-sa / 3.8) + 0.16 * exp(-sa / 13.0);
    vec3 gc = uSkSunDisc * exp(-SK_HZH * 0.45 * exp(-max(ea, 0.0) / 0.0045) * vec3(0.75, 1.0, 1.3));
    col += gc * (g * lowS * smoothstep(0.95, 0.97, vs) * (1.0 + 1.5 * exp(-max(ea, 0.0) / 0.012)));
  }
  col = mix(col, vec3(0.002, 0.003, 0.006), moon * smoothstep(0.3, 0.9, uEclipse));
  if (dark > 0.001 && front > 0.0) {
    vec3 cor = skCorona(pp, px) * (2.4 * dark * (0.25 + 0.75 * tot));
    col += (cor + skProminences(pp) * tot) * (1.0 - moon);
  }
  float starVis = tot * 0.9;
  if (starVis > 0.001 && v.y > 0.0) {
    for (int i = 0; i < 5; i++) {
      vec4 P = uPlanets[i];
      if (P.w <= 0.0) continue;
      float d = atan(length(cross(v, P.xyz)), dot(v, P.xyz));
      col += planetCol(i) * ((exp(-(d / 0.0011) * (d / 0.0011)) * 9.0 + exp(-(d / 0.0045) * (d / 0.0045)) * 0.8) * P.w * starVis);
    }
  }
  if (uBead.w > 0.0) {
    float ba = atan(length(cross(v, uBead.xyz)), dot(v, uBead.xyz));
    vec3 dv = v - uBead.xyz;
    vec2 bq = vec2(dot(dv, t1), dot(dv, t2)) / R;
    float bl = length(bq) + 1e-5;
    vec2 bd = bq / bl;
    float spikes = (pow(abs(bd.x * bd.x - bd.y * bd.y), 180.0) + 0.6 * pow(abs(2.0 * bd.x * bd.y), 260.0)) * exp(-bl * 0.55) * 3.0;
    float bb = ba / (R * 0.2);
    col += vec3(1.0, 0.97, 0.9) * (uBead.w * (exp(-bb * bb) * 18.0 + exp(-ba / (R * 1.2)) * 3.0 + spikes));
  }
  vec4 ci = skCirrusB(v, pa, base);
  col = mix(col, ci.rgb, ci.a);
  vec4 sl = skStratusB(v, pa, base);
  col = mix(col, sl.rgb, sl.a);
  vec4 cu = v.y > 0.0 ? texture2D(uCloudTex, gl_FragCoord.xy * uCloudInv) : vec4(0.0);
  col = col * (1.0 - cu.a) + cu.rgb;
  float gv = 1.0 - smoothstep(0.0, 0.97, uEclipse);
  float sUp = asin(clamp(uSunDir.y, -1.0, 1.0)), sUa = sUp + skRefr(sUp);
  float up = smoothstep(-0.9, 0.9, sUa / R) * gv;
  if (up > 0.0 && sd < 7.0 && vst > 0.0) {
    float dl = max(sd - 1.0, 0.0), lo = exp(-max(ea, 0.0) / 0.015);
    float gd = (0.25 + 0.35 * lo) * exp(-dl / (0.35 + 0.35 * lo)) + 0.02 * exp(-dl / 1.5);
    float eg = max(clamp(ea, sUa - R, sUa + R), 0.0);
    vec3 gcol = uSkSunDisc * exp(-(skDepth(sin(eg)) - skDepth(max(uSunDir.y, 0.0015))) - SK_HZH * exp(-eg / 0.0045) * vec3(0.75, 1.0, 1.3));
    col += gcol * (18.0 * uSkSunBlow * gd * up * (1.0 - skCumulusFlat(uSunDir, 0.01).a));
  }
  if (gv > 0.0 && vs > 0.5 && uSkSunSea.r > 1e-5) {
    float sa = atan(length(cross(v, uSunDir)), vs);
    float cover = skCumulusFlat(uSunDir, 0.01).a;
    vec2 u = pp / max(sr, 1e-4);
    float c3 = u.x * u.x * u.x - 3.0 * u.x * u.y * u.y;
    float glare = 0.4 * exp(-sa / 0.015) + 0.08 * exp(-sa / 0.08) + 0.8 * pow(abs(c3), 300.0) * exp(-sa / 0.1);
    col += uSkSunSea * ((0.15 + 0.85 * smoothstep(0.05, 0.3, uSunDir.y)) * ((glare * gv * (1.0 - cover))));
  }
  float viv = SK_VIVID * uMoonLit * smoothstep(-0.2, -0.06, uSunDir.y) * (1.0 - skDark());
  if (viv > 0.0) { float yl = dot(col, vec3(0.2126, 0.7152, 0.0722)); col = max(vec3(yl) + (col - yl) * (1.0 + viv), 0.0); }
  gl_FragColor = vec4(min(col, vec3(24.0)), 1.0);
}
`;

const CLOUD_VERT = `
varying vec2 vNdc;
void main() {
  vNdc = position.xy;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;
const COV_FRAG = `
${SKY_DECL}
uniform vec3 uCovC;
${SKY_FUNCS}
varying vec2 vNdc;
float skCovF(vec2 p) { return skCovU(p) - SK_U0 - 0.45 * skFinClear(p); }
void main() {
  vec2 p = uCovC.xy + vNdc * (0.5 / uCovC.z);
  float u = skCovF(p), ex = 0.04;
  vec2 g = vec2(skCovF(p + vec2(ex, 0.0)) - skCovF(p - vec2(ex, 0.0)), skCovF(p + vec2(0.0, ex)) - skCovF(p - vec2(0.0, ex))) / (2.0 * ex);
  gl_FragColor = vec4(u, clamp(u / max(length(g), 0.05), -0.3, 0.3), 0.0, 1.0);
}
`;
const COV_K = `
const int SK_K = 14;
const float SK_TEXEL = 0.09375;
`;
const ROW_FRAG = `
uniform sampler2D uCovIn;
${COV_K}
void main() {
  ivec2 q = ivec2(gl_FragCoord.xy);
  float u = texelFetch(uCovIn, q, 0).r, d = float(SK_K + 1);
  for (int s = -1; s <= 1; s += 2) {
    float ua = u;
    for (int i = 1; i <= SK_K; i++) {
      float ub = texelFetch(uCovIn, ivec2(clamp(q.x + s * i, 0, 1023), q.y), 0).r;
      if ((ua > 0.0) != (ub > 0.0)) { d = min(d, float(i - 1) + ua / (ua - ub)); break; }
      ua = ub;
    }
  }
  gl_FragColor = vec4(u > 0.0 ? d : -d, u, 0.0, 1.0);
}
`;
const DIST_FRAG = `
uniform sampler2D uRowIn;
uniform sampler2D uCovIn;
${COV_K}
void main() {
  ivec2 q = ivec2(gl_FragCoord.xy);
  vec2 c = texelFetch(uRowIn, q, 0).rg;
  bool ins = c.g > 0.0;
  float d2 = c.r * c.r;
  for (int s = -1; s <= 1; s += 2) {
    float ua = c.g;
    for (int j = 1; j <= SK_K; j++) {
      if (float(j * j) >= d2) break;
      vec2 r = texelFetch(uRowIn, ivec2(q.x, clamp(q.y + s * j, 0, 1023)), 0).rg;
      if ((r.g > 0.0) != ins) { float fc = float(j - 1) + ua / (ua - r.g); d2 = min(d2, fc * fc); break; }
      d2 = min(d2, r.r * r.r + float(j * j));
      ua = r.g;
    }
  }
  float e = (ins ? SK_TEXEL : -SK_TEXEL) * sqrt(d2);
  gl_FragColor = vec4(mix(texelFetch(uCovIn, q, 0).g, e, smoothstep(1.0, 2.0, abs(e) / SK_TEXEL)), c.g, 0.0, 1.0);
}
`;
const CMAX_FRAG = `
uniform sampler2D uCovIn;
${CU_SHAPE}
void main() {
  ivec2 q = ivec2(gl_FragCoord.xy) * 8;
  float me = -3.0, mt = -1.0;
  for (int j = -1; j <= 8; j++) {
    for (int i = -1; i <= 8; i++) {
      vec2 c = texelFetch(uCovIn, clamp(q + ivec2(i, j), ivec2(0), ivec2(1023)), 0).rg;
      me = max(me, c.r);
#ifdef SK_RAW
      mt = max(mt, c.g);
#else
      if (c.r > -SK_REACH) mt = max(mt, skCuTop(c.r + 0.12, c.g));
#endif
    }
  }
  gl_FragColor = vec4(me, mt, 0.0, 1.0);
}
`;
const POOL_FRAG = `
uniform sampler2D uCovIn;
uniform sampler2D uCovMaxIn;
${CU_SHAPE}
${COV_K}
varying vec2 vNdc;
vec2 skBspline(vec2 uv) {
  vec2 st = uv * 128.0 - 0.5, i = floor(st), f = st - i, f2 = f * f, f3 = f2 * f;
  vec2 w0 = (1.0 - 3.0 * f + 3.0 * f2 - f3) / 6.0, w1 = (4.0 - 6.0 * f2 + 3.0 * f3) / 6.0, w2 = (1.0 + 3.0 * f + 3.0 * f2 - 3.0 * f3) / 6.0, w3 = f3 / 6.0;
  vec2 g0 = w0 + w1, g1 = w2 + w3, h0 = (i - 0.5 + w1 / g0) / 128.0, h1 = (i + 1.5 + w3 / g1) / 128.0;
  return g0.y * (g0.x * textureLod(uCovMaxIn, h0, 0.0).rg + g1.x * textureLod(uCovMaxIn, vec2(h1.x, h0.y), 0.0).rg)
       + g1.y * (g0.x * textureLod(uCovMaxIn, vec2(h0.x, h1.y), 0.0).rg + g1.x * textureLod(uCovMaxIn, h1, 0.0).rg);
}
void main() {
  ivec2 q = ivec2(gl_FragCoord.xy);
  vec2 c = texelFetch(uCovIn, q, 0).rg;
  float e = c.r, mx = e, mn = e, dO = 9.0, dC = 9.0;
  for (int j = -3; j <= 3; j++) {
    for (int i = -3; i <= 3; i++) {
      if (i * i + j * j > 9) continue;
      float ey = texelFetch(uCovIn, clamp(q + ivec2(i, j), ivec2(0), ivec2(1023)), 0).r, dy = SK_TEXEL * sqrt(float(i * i + j * j));
      mx = max(mx, ey);
      mn = min(mn, ey);
      if (ey >= SK_ROPEN) dO = min(dO, max(dy - ey + SK_ROPEN, 0.0));
      if (ey <= -SK_RCLOSE) dC = min(dC, max(dy + ey + SK_RCLOSE, 0.0));
    }
  }
  float eo = e >= SK_ROPEN ? e : dO < 9.0 ? min(e, SK_ROPEN - dO) : min(e, mx - SK_ROPEN);
  float ec = e <= -SK_RCLOSE ? e : dC < 9.0 ? max(e, dC - SK_RCLOSE) : max(e, mn + SK_RCLOSE);
  vec2 mc = skBspline(vNdc * 0.5 + 0.5);
  gl_FragColor = vec4(eo + ec - e, skCuH(mc.x, c.g, mc.y), mc.x, 1.0);
}
`;
const CLOUD_FRAG = `
precision highp sampler3D;
${SKY_DECL}
uniform sampler3D uNoise3;
uniform sampler2D uCovTex;
uniform sampler2D uCovMax;
uniform vec3 uCovC;
uniform vec3 uCF;
uniform vec3 uCR;
uniform vec3 uCU;
uniform float uCPa;
${SKY_FUNCS}
${CLOUD_GLSL}
varying vec2 vNdc;
void main() {
  vec3 v = normalize(uCF + vNdc.x * uCR + vNdc.y * uCU);
  gl_FragColor = v.y > 0.0 ? skCumulus(v, uCPa, skyBase(v)) : vec4(0.0);
}
`;

function makeNoise3D() {
  const N = 64;
  let seed = 90173;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const lat = new Float32Array(16 * 16 * 16);
  for (let i = 0; i < lat.length; i++) lat[i] = rnd();
  const at = (x, y, z) => lat[(x & 15) + ((y & 15) << 4) + ((z & 15) << 8)];
  const sm = (f) => f * f * (3 - 2 * f);
  const oct = [4, 8].map((C) => { const f = new Float32Array(C * C * C * 3); for (let i = 0; i < f.length; i++) f[i] = rnd(); return { C, f }; });
  const data = new Uint8Array(N * N * N * 2);
  let k = 0;
  for (let z = 0; z < N; z++) {
    const pz = (z + 0.5) / 4, iz = Math.floor(pz), wz = sm(pz - iz);
    for (let y = 0; y < N; y++) {
      const py = (y + 0.5) / 4, iy = Math.floor(py), wy = sm(py - iy);
      for (let x = 0; x < N; x++) {
        const px = (x + 0.5) / 4, ix = Math.floor(px), wx = sm(px - ix);
        const a = at(ix, iy, iz) + (at(ix + 1, iy, iz) - at(ix, iy, iz)) * wx;
        const b = at(ix, iy + 1, iz) + (at(ix + 1, iy + 1, iz) - at(ix, iy + 1, iz)) * wx;
        const c = at(ix, iy, iz + 1) + (at(ix + 1, iy, iz + 1) - at(ix, iy, iz + 1)) * wx;
        const d = at(ix, iy + 1, iz + 1) + (at(ix + 1, iy + 1, iz + 1) - at(ix, iy + 1, iz + 1)) * wx;
        const e = a + (b - a) * wy, f = c + (d - c) * wy;
        data[2 * k] = Math.round((e + (f - e) * wz) * 255);
        let bw = 0;
        for (let o = 0; o < 2; o++) {
          const C = oct[o].C, fp = oct[o].f;
          const qx = ((x + 0.5) / N) * C, qy = ((y + 0.5) / N) * C, qz = ((z + 0.5) / N) * C;
          const cx = Math.floor(qx), cy = Math.floor(qy), cz = Math.floor(qz);
          let d2 = 9;
          for (let dz = -1; dz <= 1; dz++) {
            const zz = cz + dz, mz = ((zz % C) + C) % C;
            for (let dy = -1; dy <= 1; dy++) {
              const yy = cy + dy, my = ((yy % C) + C) % C;
              for (let dx = -1; dx <= 1; dx++) {
                const xx = cx + dx, mx = ((xx % C) + C) % C, i = ((mz * C + my) * C + mx) * 3;
                const ex = xx + fp[i] - qx, ey = yy + fp[i + 1] - qy, ez = zz + fp[i + 2] - qz;
                const dd = ex * ex + ey * ey + ez * ez;
                if (dd < d2) d2 = dd;
              }
            }
          }
          bw += (o === 0 ? 0.7 : 0.3) * (1 - Math.min(Math.sqrt(d2), 1));
        }
        data[2 * k + 1] = Math.round(bw * 255);
        k++;
      }
    }
  }
  const tex = new THREE.Data3DTexture(data, N, N, N);
  tex.format = THREE.RGFormat;
  tex.type = THREE.UnsignedByteType;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.wrapS = tex.wrapT = tex.wrapR = THREE.RepeatWrapping;
  tex.generateMipmaps = false;
  tex.unpackAlignment = 1;
  tex.needsUpdate = true;
  return tex;
}

class Sky {
  constructor(scene) {
    syncSky();
    const noise = makeNoise3D();
    this.cloudRT = new THREE.WebGLRenderTarget(2, 2, {
      type: THREE.HalfFloatType, format: THREE.RGBAFormat, depthBuffer: false, stencilBuffer: false,
      minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: false,
    });
    const table = (n, f = THREE.RGFormat) => new THREE.WebGLRenderTarget(n, n, {
      type: THREE.HalfFloatType, format: f, depthBuffer: false, stencilBuffer: false,
      minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: false,
    });
    this.covRaw = table(1024);
    this.covDist = table(1024);
    this.covMaxRaw = table(128);
    this.covRT = [table(1024, THREE.RGBAFormat), table(1024, THREE.RGBAFormat)];
    this.covMax = [table(128), table(128)];
    const covC = { value: new THREE.Vector3(NaN, NaN, 1 / 96) }, covFin = SKY_UNIFORMS.uCovFin;
    const cu = { uCF: { value: new THREE.Vector3(0, 0, -1) }, uCR: { value: new THREE.Vector3(1, 0, 0) }, uCU: { value: new THREE.Vector3(0, 1, 0) }, uCPa: { value: 0.002 },
      uCovTex: { value: this.covRT[0].texture }, uCovMax: { value: this.covMax[0].texture }, uCovC: covC };
    const tri = new THREE.BufferGeometry();
    tri.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
    const covPasses = [0, 1].map((k) => [
      [this.covRaw, COV_FRAG, Object.assign({}, SKY_UNIFORMS, { uCovC: covC })],
      [this.covRT[k], ROW_FRAG, { uCovIn: { value: this.covRaw.texture } }],
      [this.covDist, DIST_FRAG, { uRowIn: { value: this.covRT[k].texture }, uCovIn: { value: this.covRaw.texture } }],
      [this.covMaxRaw, CMAX_FRAG, { uCovIn: { value: this.covDist.texture } }, { SK_RAW: 1 }],
      [this.covRT[k], POOL_FRAG, { uCovIn: { value: this.covDist.texture }, uCovMaxIn: { value: this.covMaxRaw.texture } }],
      [this.covMax[k], CMAX_FRAG, { uCovIn: { value: this.covRT[k].texture } }],
    ].map(([rt, frag, uniforms, defines]) => {
      const m = new THREE.Mesh(tri, new THREE.ShaderMaterial({ uniforms, defines: defines || {}, vertexShader: CLOUD_VERT, fragmentShader: frag, depthTest: false, depthWrite: false, blending: THREE.NoBlending }));
      m.frustumCulled = false;
      const s = new THREE.Scene();
      s.add(m);
      return [rt, s];
    }));
    const cloudMat = new THREE.ShaderMaterial({
      uniforms: Object.assign({}, SKY_UNIFORMS, { uNoise3: { value: noise } }, cu),
      vertexShader: CLOUD_VERT,
      fragmentShader: CLOUD_FRAG,
      depthTest: false,
      depthWrite: false,
      blending: THREE.NoBlending,
    });
    const quad = new THREE.Mesh(tri, cloudMat);
    quad.frustumCulled = false;
    const cloudScene = new THREE.Scene();
    cloudScene.add(quad);
    const cloudCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.material = new THREE.ShaderMaterial({
      uniforms: Object.assign({}, SKY_UNIFORMS, { uNoise3: { value: noise }, uCloudTex: { value: this.cloudRT.texture }, uCloudInv: { value: new THREE.Vector2(1, 1) } }),
      vertexShader: DOME_VERT,
      fragmentShader: DOME_FRAG,
      side: THREE.BackSide,
      depthWrite: false,
    });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(1000, 64, 32), this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -10;
    const steps = [];
    covPasses[0].forEach(([rt], p) => { const n = rt.height > 128 ? 16 : 1; for (let j = 0; j < n; j++) steps.push([p, (j * rt.height) / n, rt.height / n]); });
    let front = 0, build = null;
    const c0 = new THREE.Vector3(), f0 = new THREE.Vector3();
    const draw = (renderer, p, y, h) => {
      const [rt, s] = covPasses[build.k][p];
      if (p === 0) { c0.copy(covC.value); f0.copy(covFin.value); covC.value.copy(build.c); covFin.value.copy(build.fin); }
      rt.scissor.set(0, y, rt.width, h);
      rt.scissorTest = h < rt.height;
      renderer.setRenderTarget(rt);
      renderer.render(s, cloudCam);
      rt.scissorTest = false;
      if (p === 0) { covC.value.copy(c0); covFin.value.copy(f0); }
    };
    const upkeep = (renderer) => {
      const off = SKY_UNIFORMS.uCloudOff.value, cc = covC.value, cell = 8 / (1024 * cc.z), lit = SKY_UNIFORMS.uMoonLit.value > 0 ? 1 : 0;
      const far = Math.max(Math.abs(off.x - cc.x), Math.abs(off.y - cc.y)), whole = !(far < 3);
      if ((!build || build.fin.z !== lit || whole) && (lit !== covFin.value.z || !(far < 2))) {
        const fin = lit !== covFin.value.z ? new THREE.Vector3(off.x, off.y, lit) : covFin.value.clone();
        build = { k: 1 - front, i: 0, c: new THREE.Vector3(Math.round(off.x / cell) * cell, Math.round(off.y / cell) * cell, cc.z), fin };
      }
      if (!build) return;
      const prev = renderer.getRenderTarget(), auto = renderer.autoClear;
      renderer.autoClear = false;
      if (whole) {
        for (let p = 0; p < covPasses[0].length; p++) draw(renderer, p, 0, covPasses[0][p][0].height);
        build.i = steps.length;
      } else {
        const [p, y, h] = steps[build.i++];
        draw(renderer, p, y, h);
      }
      renderer.setRenderTarget(prev);
      renderer.autoClear = auto;
      if (build.i < steps.length) return;
      front = build.k;
      cu.uCovTex.value = this.covRT[front].texture;
      cu.uCovMax.value = this.covMax[front].texture;
      cc.copy(build.c);
      covFin.value.copy(build.fin);
      build = null;
    };
    this.upkeep = upkeep;
    const vp = new THREE.Vector4(), key = new Float64Array(25).fill(NaN), inv = this.material.uniforms.uCloudInv.value;
    let changed = false, watching = false;
    const chk = (i, v) => { if (key[i] !== v) { key[i] = v; changed = true; } };
    this.mesh.onBeforeRender = (renderer, sc, camera) => {
      this.renderer = renderer;
      if (!watching) {
        watching = true;
        renderer.domElement.addEventListener('webglcontextrestored', () => { covC.value.x = NaN; key.fill(NaN); build = null; });
      }
      renderer.getCurrentViewport(vp);
      const W = Math.max(1, vp.z), H = Math.max(1, vp.w);
      inv.set(1 / W, 1 / H);
      if (camera.position.y < -1) return;
      const e = camera.matrixWorld.elements, pm = camera.projectionMatrix.elements, U = SKY_UNIFORMS, off = U.uCloudOff.value;
      if (!(Math.abs(off.x - covC.value.x) < 3 && Math.abs(off.y - covC.value.y) < 3)) upkeep(renderer);
      changed = false;
      chk(0, W); chk(1, H); chk(2, e[0]); chk(3, e[1]); chk(4, e[2]); chk(5, e[4]); chk(6, e[5]); chk(7, e[6]);
      chk(8, e[8]); chk(9, e[9]); chk(10, e[10]); chk(11, pm[0]); chk(12, pm[5]); chk(13, off.x);
      chk(14, off.y); chk(15, ST.version); chk(16, U.uMoonLit.value); chk(17, U.uEclipse.value);
      chk(18, U.uMoonDir.value.x); chk(19, U.uMoonDir.value.y); chk(20, U.uSunDir.value.x); chk(21, U.uSunDir.value.y);
      chk(22, U.uSunDir.value.z); chk(23, U.uBead.value.w); chk(24, front);
      if (!changed) return;
      const w2 = Math.max(1, Math.ceil(W / 2)), h2 = Math.max(1, Math.ceil(H / 2));
      if (this.cloudRT.width !== w2 || this.cloudRT.height !== h2) this.cloudRT.setSize(w2, h2);
      const tx = 1 / pm[0], ty = 1 / pm[5];
      cu.uCF.value.set(-e[8], -e[9], -e[10]).normalize();
      cu.uCR.value.set(e[0], e[1], e[2]).normalize().multiplyScalar(tx);
      cu.uCU.value.set(e[4], e[5], e[6]).normalize().multiplyScalar(ty);
      cu.uCPa.value = (2 * ty) / h2;
      const prev = renderer.getRenderTarget(), auto = renderer.autoClear;
      renderer.autoClear = true;
      renderer.setRenderTarget(this.cloudRT);
      renderer.render(cloudScene, cloudCam);
      renderer.setRenderTarget(prev);
      renderer.autoClear = auto;
    };
    scene.add(this.mesh);
  }
  update(camera, dt) {
    this.mesh.position.copy(camera.position);
    SKY_UNIFORMS.uCloudOff.value.x += dt * 0.0095;
    SKY_UNIFORMS.uCloudOff.value.y -= dt * 0.0043;
    SKY_UNIFORMS.uSkTime.value += dt;
    syncSky();
    if (this.renderer) this.upkeep(this.renderer);
  }
}

function makeSkyEnv(renderer) {
  syncSky();
  const scene = new THREE.Scene();
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: SKY_UNIFORMS,
    vertexShader: `varying vec3 vD; void main(){ vD = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      ${SKY_DECL}
      ${SKY_FUNCS}
      varying vec3 vD;
      void main(){
        vec3 d = normalize(vD);
        vec3 c;
        if (d.y >= 0.0) {
          c = skyBase(d);
          vec4 ci = skCirrus(d, 0.012);
          c = mix(c, ci.rgb, ci.a);
          vec4 cu = skCumulusFlat(d, 0.012);
          c = c * (1.0 - cu.a) + cu.rgb;
        } else {
          float e = -d.y;
          vec3 r = normalize(vec3(d.x, e + 0.08, d.z));
          float m = 1.0 - max(e, 0.1);
          float F = 0.0204 + 0.9796 * m * m * m * m * m;
          c = mix(vec3(0.004, 0.028, 0.100) * uSkAmbLevel, skyBase(r), F);
        }
        float s = max(dot(d, uSunDir), 0.0);
        c += skSunTrans() * (pow(s, 1200.0) * 40.0 + pow(s, 80.0) * 1.2);
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(10, 48, 24), mat));
  const pmrem = new THREE.PMREMGenerator(renderer);
  const rt = pmrem.fromScene(scene, 0.02, 0.1, 100);
  pmrem.dispose();
  return rt.texture;
}

