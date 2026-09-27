// fragments.js
const FACTS = [
  {
    title: '224 Teeth',
    text: 'Beside it, a ring of 365 marks.',
    count: 224, unit: 'teeth',
  },
  {
    title: '127 Teeth',
    text: 'Beside it, ΣΕΛΗΝΗ: Greek for the Moon.',
    count: 127, unit: 'teeth',
  },
  {
    title: '223 Teeth',
    text: 'It lay behind a spiral of 223 cells, some marked Σ or Η.',
    count: 223, unit: 'teeth',
  },
];

const CLEAN_TARGET = 0.70;
const CLEAN_RANGE = 2.5;
const CLEAN_DOT = 0.6;
const PICK_RANGE = 6;
const LUMP_S = 0.72;
const MASK = 512;
const GRID = 32;
const UVX = 0.70, UVY = 0.62;
const toU = (x) => x / UVX + 0.5, toV = (y) => y / UVY + 0.5;
const HF = 64, HX = 0.34, HY = 0.30;
const BRUSH_TIP = 0.056;
const GRIP = 0.19;
const HOLD_AT = 0.17;
const HOLD_B = 0.52, ZA0 = new THREE.Vector3(0, 0, 1);
const HOLD_DEV = 0.4;
const DRAW_T = 0.35;
const BRUSH_ANG = 0.75, BRUSH_TO = [0.2, 0.0, 0.1], BELT_OUT = [0.06, -0.04];
const HOLD_P = new THREE.Vector3(0.0, 0.0, 0.0102), HOLD_D = new THREE.Vector3(Math.cos(HOLD_B), Math.sin(HOLD_B), 0);
const HOLD_O = HOLD_P.clone().addScaledVector(HOLD_D, HOLD_AT);
const HOLD_M = new THREE.Matrix4().makeBasis(HOLD_D.clone().negate().cross(ZA0).normalize(), HOLD_D.clone().negate(), ZA0).setPosition(HOLD_O);
const BOW_BRUSH = 70, BRUSH_IN = 0.2;
const BRUSH_OFF = 0.25, HAND_LEAD = 0.35;
const HANDLE_PROF = [[0, 0.03], [0.0106, 0.03], [0.0114, 0.036], [0.011, 0.048], [0.0102, 0.07], [0.0094, 0.1], [0.0086, 0.14],
  [0.008, 0.17], [0.0078, 0.19], [0.0085, 0.2], [0.0078, 0.206], [0.007, 0.218], [0.0056, 0.227], [0.0034, 0.2315], [0, 0.2325]];
const FERRULE_PROF = [[0, -55e-4], [0.011, -55e-4], [0.012, -4e-3], [0.0121, 0.004], [0.0116, 0.0062], [0.0121, 0.0084],
  [0.0122, 0.016], [0.0117, 0.0182], [0.0122, 0.0204], [0.0123, 0.028], [0.0119, 0.034], [0.0106, 0.034]];
function profR(P, y) {
  if (y < P[0][1] || y > P[P.length - 1][1]) return 0;
  for (let i = 0; i < P.length - 1; i++) if (y <= P[i + 1][1]) return P[i + 1][1] > P[i][1] ? lerp$3(P[i][0], P[i + 1][0], (y - P[i][1]) / (P[i + 1][1] - P[i][1])) : Math.max(P[i][0], P[i + 1][0]);
  return 0;
}
const HOLD_T = HOLD_M.clone(), HOLD_TI = HOLD_M.clone().invert();
const _hv = new THREE.Vector3(), _hv2 = new THREE.Vector3(), _hm = new THREE.Matrix4(), _hq = new THREE.Quaternion();
const PIV_MAX = 0, SLIDE_MAX = 0, PIV_V = 1 * Math.PI / 180, SLIDE_V = 0.001;
const _pq = new THREE.Quaternion();
function setHold(q, s) {
  _hm.makeRotationFromQuaternion(q).setPosition(_hv.copy(HOLD_P).sub(_hv2.copy(HOLD_P).applyQuaternion(q)));
  HOLD_T.multiplyMatrices(_hm, HOLD_M).multiply(_hm.makeTranslation(0, -s, 0));
  HOLD_TI.copy(HOLD_T).invert();
}
function holdTouch(x, y, z) {
  _hv.set(x, y, z).applyMatrix4(HOLD_TI);
  const rho = Math.hypot(_hv.x, _hv.z), h = _hv.y;
  const hc = h < -55e-4 ? -55e-4 : h > 0.2325 ? 0.2325 : h, r = Math.max(profR(HANDLE_PROF, hc), profR(FERRULE_PROF, hc));
  const dr = rho - r, dh = h - hc;
  return dh === 0 ? dr : dr > 0 ? Math.hypot(dr, dh) : Math.abs(dh);
}
const PACE_FULL = { rev: 1.3, tug: 0.62, rise: 1.2, scan: 1.1, count: 1.35, hold: 0.9, stow: 0.9, away: 0.55 };
const PACE_QUICK = { rev: 0.7, tug: 0.46, rise: 1.2, scan: 0.42, count: 0.45, hold: 0.25, stow: 0.8, away: 0.32 };
const STOW_TURN = 0.36, STOW_WAY = 0.08, STOW_BACK = 0.5, GRIP_SLIDE_V = 0.6, SLIDE_WAIT = 0.42;
const BAG_STEADY = 0.06;
const GRIP_OFF = 0.06, XRAY_IN = 0.12, XRAY_FADE = 0.3, GRIP_TURN = 1.1, RIM_CLEAR = 0.035;
const WHEEL_KEEP = 0.006;
const HAND_V = 1.25, BOW = 90, PICK_IN = 0.25, SEAT_T = 0.4;
const PALM_PTS = [0.025, -0.02, 0.0072, 0.025, -0.035, 0.0066, 0.01, -0.02, 0.003, -0.035, -5e-3, 0.0018, -0.035, -0.02, 0.0016,
  -5e-3, -5e-3, -32e-4, -0.02, 0.01, -2e-3, 0.01, 0.025, -44e-4, -0.02, -0.045, -2e-4, 0.01, -0.045, 0.0016];
const THUMB_PTS = [[0, -6e-3, -0.015, -0.011, 0.0137], [0, -0.012, -0.03, -0.022, 0.0122], [1, -4e-3, -0.0135, -55e-4, 0.0115]];
const PALM_CLR = 0.0015, GRIP_IN = -0.03, GRIP_START = 0.02, PALM_V = 0.0015, PALM_V_HELD = 0.0004;
const GRIP_BACK_R = 0.0, GRIP_BACK_L = 0.0;
const GRIP_A = 0.52, GRIP_PALM_IN = 0.5;
const SNUG_R = 0.085, SNUG_GAP = 0.004, SNUG_T = 0.12, SNUG_MAX = 0.14, SNUG_V = 0.2;
const NET_GIVE = 0.12;
const BAG_BACK = 0.55;
const STOW_PALM = 0.004, STOW_REACH = 0.52;
const STOW_HOLD = 0.44;
const PRESENT_LENS = 0.15, HOLD_REACH = 0.46, HOLD_IN = 0.25;
const HOLD_LOOK_UP = 0.12;
const HELM_CLR = 0.05, HELM_FLOOR = 0.02, HELM_N = 360, HELM_W = 20, HELM_V = 0.8, HELM_LEAD = 0.3, HELM_BACK = 0.45;
const HOLD_SH = [[0.13, 0.06, -0.36], [-0.21, 0.11, -0.32]];
const STAGES$1 = {
  prone: { pose: 'hover', dist: 0.92, side: 0, h: 0.5, pitch: -0.32, h2: 0.63, pitch2: 0.1, head: [0.035, 0.25, -0.62], hold: [0.4, 0.08] },
  kneel: { pose: 'kneel', dist: 0.58, side: 0.1, h: 0.95, pitch: 0, h2: 0.95, pitch2: 0, head: [0.07, -0.21, -0.45], hold: [0.3, 0.15], walk: true, rise: 0.85 },
};
const STAGE_OFFS = [0, 0.4, -0.4, 0.8, -0.8, 1.2, -1.2, 1.7, -1.7, Math.PI];
const BAG = new THREE.Vector3(-0.2, -0.13, 0.06);

const lerp$3 = (a, b, t) => a + (b - a) * t;
const sstep$7 = (a, b, x) => { const t = clamp$9((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const Y = new THREE.Vector3(0, 1, 0);
const ZA = new THREE.Vector3(0, 0, 1);
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3();
const _e$1 = new THREE.Vector3(), _n = new THREE.Vector3(), _s$2 = new THREE.Vector3();
const _q$1 = new THREE.Quaternion(), _q2$1 = new THREE.Quaternion(), _qi = new THREE.Quaternion();
const QI = new THREE.Quaternion();
const _m = new THREE.Matrix4(), _m2 = new THREE.Matrix4(), _hn = new THREE.Vector3(), _hw = new THREE.Vector3(), _hk = new Float64Array(6);
const _eu = new THREE.Euler(0, 0, 0, 'YXZ');
const _uv = new THREE.Vector2();
const _chest = new THREE.Vector3();
const _crown = new THREE.Vector3();
const _orb = new THREE.Vector3(), _orbC = new THREE.Vector3();
const _fr = new THREE.Frustum(), _sph = new THREE.Sphere(), _cp = new Float32Array(7 * 20);
const _bo = new THREE.Vector3();
const _rm = new THREE.Matrix4(), _rm2 = new THREE.Matrix4(), _rp$1 = new THREE.Vector3(), _rq = new THREE.Quaternion(), _rs = new THREE.Vector3(), ONE = new THREE.Vector3(1, 1, 1);
const RIG_FIX = 0.6;
const RIG_PALM = 0.002;
const RIG_SLIDE = 0.00042;
const RIG_TURN0 = 30 * Math.PI / 180, RIG_TURN1 = 45 * Math.PI / 180;
const LIFT_TURN_END = 0.9;
function lookQ$1(pos, target, out) { _m.lookAt(pos, target, Y); return out.setFromRotationMatrix(_m); }
function segDist$1(p0, p1, q0, q1) {
  const ux = p1.x - p0.x, uy = p1.y - p0.y, uz = p1.z - p0.z, vx = q1.x - q0.x, vy = q1.y - q0.y, vz = q1.z - q0.z;
  const rx = p0.x - q0.x, ry = p0.y - q0.y, rz = p0.z - q0.z;
  const a = ux * ux + uy * uy + uz * uz, e = vx * vx + vy * vy + vz * vz, b = ux * vx + uy * vy + uz * vz;
  const c = ux * rx + uy * ry + uz * rz, f = vx * rx + vy * ry + vz * rz, dn = a * e - b * b;
  let s = dn > 1e-9 ? clamp$9((b * f - c * e) / dn, 0, 1) : 0, t = e > 1e-9 ? (b * s + f) / e : 0;
  if (t < 0) { t = 0; s = a > 1e-9 ? clamp$9(-c / a, 0, 1) : 0; } else if (t > 1) { t = 1; s = a > 1e-9 ? clamp$9((b - c) / a, 0, 1) : 0; }
  const x = rx + ux * s - vx * t, y = ry + uy * s - vy * t, z = rz + uz * s - vz * t;
  return Math.sqrt(x * x + y * y + z * z);
}

const SILT_COL = [0.4, 0.37, 0.3];
const SAND_PAL = [[0.62, 0.56, 0.44], [0.50, 0.44, 0.34], [0.72, 0.69, 0.62], [0.30, 0.27, 0.22], [0.45, 0.38, 0.29]];
const CRUST_DUST$1 = [[0.34, 0.33, 0.29], [0.27, 0.26, 0.23], [0.31, 0.24, 0.22]];
const PATINA_DUST = [[0.3, 0.33, 0.27], [0.27, 0.31, 0.26], [0.35, 0.31, 0.25]];

function lumpGeometry(seed, step = 0.0088) {
  const rng = makeRng$1(seed);
  const hx = 0.22 + rng() * 0.04, hy = 0.17 + rng() * 0.03, hz = 0.055;
  const o = rng() * 50;
  const cutA = rng() * Math.PI * 2, cx = Math.cos(cutA), cy = Math.sin(cutA);
  const cutB = cutA + Math.PI * (0.55 + rng() * 0.6), bx = Math.cos(cutB), by = Math.sin(cutB);
  const tw = (rng() - 0.5) * 0.5;
  const pa = rng() * Math.PI * 2, px = Math.cos(pa) * 0.1, py = Math.sin(pa) * 0.07;
  const pr = rng() * 0.8 - 0.4, pc = Math.cos(pr), ps = Math.sin(pr);
  const la = pa + Math.PI + (rng() - 0.5) * 0.8, lx = Math.cos(la) * 0.2, ly = Math.sin(la) * 0.14;
  const box = (x, y, z, bx, by, bz, r) => {
    const qx = Math.abs(x) - bx + r, qy = Math.abs(y) - by + r, qz = Math.abs(z) - bz + r;
    return Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0) - r;
  };
  const smin = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; };
  const sdf = (x, y, z) => {
    const sx = x + y * tw * 0.3;
    let d = lerp$3(box(sx, y, z, hx, hy, hz, 0.05), Math.hypot(sx / hx, y / hy) * Math.min(hx, hy) - Math.min(hx, hy), 0.35);
    d = Math.max(d, Math.abs(z) - hz);
    const ux = (x - px) * pc + (y - py) * ps, uy = -(x - px) * ps + (y - py) * pc;
    d = smin(d, box(ux, uy, z - 0.05, 0.12, 0.095, 0.022, 0.014), 0.012);
    d = smin(d, Math.hypot((x - lx) / 1.3, y - ly, (z + 0.01) / 0.8) - 0.072, 0.04);
    d = Math.max(d, x * cx + y * cy - (0.13 + noise3(x * 6 + o, y * 6, z * 6) * 0.05));
    d = Math.max(d, x * bx + y * by - (0.16 + noise3(x * 7, y * 7 + o, z * 5) * 0.04));
    d += fbm3(x * 5 + o, y * 5, z * 5, 3) * 0.042 + fbm3(x * 13, y * 13 + o, z * 13, 2) * 0.012 + noise3(x * 30, y * 30 + o, z * 30) * 0.006;
    return d;
  };
  const geo = surfaceNets$2(sdf, [-0.34, -0.3, -0.15], [0.34, 0.3, 0.15], step);
  geo.computeBoundingBox();
  return { geo, sdf, plate: { x: px, y: py, a: pr, hx: 0.12, hy: 0.095 } };
}

const RIM_N = 72, RIM_W = 4;
function rimProfile(geo) {
  const N = RIM_N, p = geo.attributes.position, R = new Float32Array(N), Z = new Float32Array(N);
  const lo = new Float32Array(N).fill(9), hi = new Float32Array(N).fill(-9);
  const bin = (x, y) => ((Math.round((Math.atan2(y, x) / (2 * Math.PI)) * N) % N) + N) % N;
  for (let i = 0; i < p.count; i++) {
    const k = bin(p.getX(i), p.getY(i)), r = Math.hypot(p.getX(i), p.getY(i));
    if (r > R[k]) R[k] = r;
  }
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), k = bin(x, y);
    if (Math.hypot(x, y) < 0.8 * R[k]) continue;
    lo[k] = Math.min(lo[k], p.getZ(i));
    hi[k] = Math.max(hi[k], p.getZ(i));
  }
  for (let k = 0; k < N; k++) Z[k] = hi[k] > lo[k] ? 0.5 * (lo[k] + hi[k]) : -0.012;
  for (let k = 0; k < N; k++) if (R[k] <= 0) R[k] = Math.max(R[(k + N - 1) % N], R[(k + 1) % N]);
  const RM = new Float32Array(N);
  for (let k = 0; k < N; k++) for (let j = -RIM_W; j <= RIM_W; j++) RM[k] = Math.max(RM[k], R[(k + j + N) % N]);
  return { R, Z, RM };
}
function rimGrip(rim, ux, uy, out, off = GRIP_OFF) {
  const l = Math.hypot(ux, uy) || 1, x = ux / l, y = uy / l;
  const f = ((Math.atan2(y, x) / (2 * Math.PI)) * RIM_N + RIM_N) % RIM_N, k0 = Math.floor(f) % RIM_N, k1 = (k0 + 1) % RIM_N, t = f - Math.floor(f);
  const r = lerp$3(rim.RM[k0], rim.RM[k1], t) + off;
  return out.set(x * r, y * r, lerp$3(rim.Z[k0], rim.Z[k1], t));
}
function rimEdge(rim, ux, uy, out, off) {
  const l = Math.hypot(ux, uy) || 1, x = ux / l, y = uy / l;
  const f = ((Math.atan2(y, x) / (2 * Math.PI)) * RIM_N + RIM_N) % RIM_N, k0 = Math.floor(f) % RIM_N, k1 = (k0 + 1) % RIM_N, t = f - Math.floor(f);
  const r = lerp$3(rim.R[k0], rim.R[k1], t) + off;
  return out.set(x * r, y * r, lerp$3(rim.Z[k0], rim.Z[k1], t));
}

class TopField {
  constructor(geo) {
    const n = HF, h = new Float32Array(n * n).fill(-9);
    const p = geo.attributes.position, nm = geo.attributes.normal;
    for (let i = 0; i < p.count; i++) {
      if (nm.getZ(i) < 0.2) continue;
      const ix = Math.round(((p.getX(i) + HX) / (2 * HX)) * (n - 1)), iy = Math.round(((p.getY(i) + HY) / (2 * HY)) * (n - 1));
      if (ix < 0 || iy < 0 || ix >= n || iy >= n) continue;
      const k = iy * n + ix;
      if (p.getZ(i) > h[k]) h[k] = p.getZ(i);
    }
    for (let pass = 0; pass < 2; pass++) {
      const src = h.slice();
      for (let iy = 1; iy < n - 1; iy++) {
        for (let ix = 1; ix < n - 1; ix++) {
          const k = iy * n + ix;
          if (src[k] > -8) continue;
          let s = 0, c = 0;
          if (src[k - 1] > -8) { s += src[k - 1]; c++; }
          if (src[k + 1] > -8) { s += src[k + 1]; c++; }
          if (src[k - n] > -8) { s += src[k - n]; c++; }
          if (src[k + n] > -8) { s += src[k + n]; c++; }
          if (c >= 3) h[k] = s / c;
        }
      }
    }
    this.h = h;
    this._bounds();
  }
  _bounds() {
    let lo = 9, hi = -9;
    for (const v of this.h) if (v > -8) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
    this.zMin = lo; this.zMax = hi;
  }
  cover(covered) {
    const n = HF;
    for (let iy = 0; iy < n; iy++) {
      for (let ix = 0; ix < n; ix++) {
        const k = iy * n + ix;
        if (this.h[k] > -8 && covered(-HX + (ix / (n - 1)) * 2 * HX, -HY + (iy / (n - 1)) * 2 * HY, this.h[k])) this.h[k] = -9;
      }
    }
    this._bounds();
  }
  at(x, y) {
    const n = HF, h = this.h;
    const fx = ((x + HX) / (2 * HX)) * (n - 1), fy = ((y + HY) / (2 * HY)) * (n - 1);
    if (fx < 0 || fy < 0 || fx > n - 1 || fy > n - 1) return -9;
    const ix = Math.min(n - 2, Math.floor(fx)), iy = Math.min(n - 2, Math.floor(fy));
    const tx = fx - ix, ty = fy - iy, k = iy * n + ix;
    const a = h[k], b = h[k + 1], c = h[k + n], d = h[k + n + 1];
    if (a < -8 || b < -8 || c < -8 || d < -8) return h[Math.round(fy) * n + Math.round(fx)];
    return lerp$3(lerp$3(a, b, tx), lerp$3(c, d, tx), ty);
  }
  normal(x, y, out) {
    const e = 0.008, x0 = this.at(x - e, y), x1 = this.at(x + e, y), y0 = this.at(x, y - e), y1 = this.at(x, y + e);
    if (x0 < -8 || x1 < -8 || y0 < -8 || y1 < -8) return out.set(0, 0, 1);
    return out.set((x0 - x1) / (2 * e), (y0 - y1) / (2 * e), 1).normalize();
  }
  march(o, d, out) {
    if (d.z > -0.02) return false;
    const s0 = Math.max(0, (this.zMax + 0.005 - o.z) / d.z), s1 = (this.zMin - 0.01 - o.z) / d.z;
    if (!(s1 > s0)) return false;
    const N = 72, ds = (s1 - s0) / N;
    let sp = s0;
    for (let k = 1; k <= N; k++) {
      const s = s0 + ds * k, hh = this.at(o.x + d.x * s, o.y + d.y * s);
      if (hh > -8 && o.z + d.z * s <= hh) {
        let lo = sp, hi = s;
        for (let j = 0; j < 6; j++) {
          const m = (lo + hi) * 0.5, hm = this.at(o.x + d.x * m, o.y + d.y * m);
          if (hm > -8 && o.z + d.z * m <= hm) hi = m; else lo = m;
        }
        out.set(o.x + d.x * hi, o.y + d.y * hi, 0);
        out.z = this.at(out.x, out.y);
        return out.z > -8;
      }
      sp = s;
    }
    return false;
  }
  extent(dx, dy) {
    let r = 0;
    for (let s = 0.005; s < 0.45; s += 0.005) { if (this.at(dx * s, dy * s) < -8) break; r = s; }
    return r;
  }
  corner(dx, dy, rng, out) {
    const n = HF, h = this.h;
    let best = -9, bx = 0, by = 0;
    for (let iy = 3; iy < n - 3; iy++) {
      for (let ix = 3; ix < n - 3; ix++) {
        const k = iy * n + ix;
        if (h[k] < -8 || h[k - 3] < -8 || h[k + 3] < -8 || h[k - 3 * n] < -8 || h[k + 3 * n] < -8) continue;
        const x = -HX + (ix / (n - 1)) * 2 * HX, y = -HY + (iy / (n - 1)) * 2 * HY;
        const s = x * dx + y * dy + rng() * 0.03;
        if (s > best) { best = s; bx = x; by = y; }
      }
    }
    return out.set(bx, by, Math.max(this.at(bx, by), 0));
  }
}

class DirtMask {
  constructor(geo, keep, seed = 1) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.canvas.height = MASK;
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    this.ctx.fillStyle = '#000';
    this.ctx.fillRect(0, 0, MASK, MASK);
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.colorSpace = THREE.NoColorSpace;
    this.tex.generateMipmaps = false;
    this.tex.minFilter = THREE.LinearFilter;
    this.tex.magFilter = THREE.LinearFilter;
    this.cs = new Float32Array(GRID * GRID);
    this.cc = new Float32Array(GRID * GRID);
    this.foot = new Uint8Array(GRID * GRID);
    const p = geo.attributes.position, n = geo.attributes.normal;
    for (let i = 0; i < p.count; i++) {
      if (n.getZ(i) < 0.35 || (keep && !keep(p.getX(i), p.getY(i), p.getZ(i)))) continue;
      const cx = Math.floor(toU(p.getX(i)) * GRID), cy = Math.floor((1 - toV(p.getY(i))) * GRID);
      if (cx >= 0 && cx < GRID && cy >= 0 && cy < GRID) this.foot[cy * GRID + cx] = 1;
    }
    const f0 = this.foot.slice();
    let nIn = 0;
    for (let y = 0; y < GRID; y++) for (let x = 0; x < GRID; x++) {
      const i = y * GRID + x;
      const inner = f0[i] && x > 0 && x < GRID - 1 && y > 0 && y < GRID - 1 && f0[i - 1] && f0[i + 1] && f0[i - GRID] && f0[i + GRID];
      if (inner) nIn++;
    }
    if (nIn > 0.4 * f0.reduce((a, b) => a + b, 0)) {
      for (let y = 0; y < GRID; y++) for (let x = 0; x < GRID; x++) {
        const i = y * GRID + x;
        this.foot[i] = f0[i] && x > 0 && x < GRID - 1 && y > 0 && y < GRID - 1 && f0[i - 1] && f0[i + 1] && f0[i - GRID] && f0[i + GRID] ? 1 : 0;
      }
    }
    this.footN = Math.max(1, this.foot.reduce((a, b) => a + b, 0));
    this.progress = 0;
    this.siltProgress = 0;
    this.dirty = false;
    this.left = { silt: 1, crust: 1 };
    this.thr = new Float32Array(GRID * GRID);
    this.pc = new Float32Array(GRID * GRID);
    this.popped = new Uint8Array(GRID * GRID);
    this.fdata = new Uint8Array(GRID * GRID * 4);
    const rng = makeRng$1(seed);
    for (let i = 0; i < GRID * GRID; i++) {
      this.thr[i] = 0.45 + rng() * 0.45;
      this.fdata[i * 4 + 2] = Math.floor(rng() * 255);
      this.fdata[i * 4 + 3] = Math.floor(rng() * 255);
    }
    this.flakeTex = new THREE.DataTexture(this.fdata, GRID, GRID, THREE.RGBAFormat, THREE.UnsignedByteType);
    this.flakeTex.magFilter = this.flakeTex.minFilter = THREE.NearestFilter;
    this.flakeTex.generateMipmaps = false;
    this.flakeTex.needsUpdate = true;
    this.fdirty = false;
    this.pops = [];
  }
  seedLocal(i, out) {
    const gx = (i % GRID) + 0.15 + (this.fdata[i * 4 + 2] / 255) * 0.7, gy = Math.floor(i / GRID) + 0.15 + (this.fdata[i * 4 + 3] / 255) * 0.7;
    return out.set((gx / GRID - 0.5) * UVX, (0.5 - gy / GRID) * UVY, 0);
  }
  stroke(u, v, pu, pv, hasPrev, r, silt, crust) {
    const g = this.ctx;
    const x = u * MASK, y = (1 - v) * MASK, rr = r * MASK;
    const R = Math.round(255 * silt), G = Math.round(255 * crust);
    g.globalCompositeOperation = 'lighter';
    const core = g.createRadialGradient(x, y, 0, x, y, rr);
    core.addColorStop(0, `rgba(${R},${G},0,0.8)`);
    core.addColorStop(0.55, `rgba(${R},${G},0,0.35)`);
    core.addColorStop(1, `rgba(${R},${G},0,0)`);
    g.fillStyle = core;
    g.beginPath(); g.arc(x, y, rr, 0, Math.PI * 2); g.fill();
    let dx = 0, dy = 0;
    if (hasPrev) { dx = x - pu * MASK; dy = y - (1 - pv) * MASK; }
    let len = Math.hypot(dx, dy);
    if (len < 1.5) { const a = Math.random() * Math.PI * 2; dx = Math.cos(a); dy = Math.sin(a); len = 1; }
    const ux = dx / len, uy = dy / len, nx = -uy, ny = ux;
    const Ls = Math.min(Math.max(len, rr * 0.6), rr * 2.5);
    g.lineCap = 'round';
    for (let k = 0; k < 11; k++) {
      const o = (Math.random() * 2 - 1) * rr * 0.9;
      const fall = 1 - Math.abs(o) / rr;
      const cx0 = x + nx * o, cy0 = y + ny * o;
      g.lineWidth = 0.7 + Math.random() * 2.2;
      g.strokeStyle = `rgba(${Math.min(255, Math.round(R * 1.4))},${Math.round(G * 0.7)},0,${((0.25 + Math.random() * 0.45) * fall).toFixed(3)})`;
      g.beginPath();
      g.moveTo(cx0 - ux * Ls, cy0 - uy * Ls);
      g.lineTo(cx0 + ux * Ls * 0.2, cy0 + uy * Ls * 0.2);
      g.stroke();
    }
    this._cover(u, v, r, silt, crust);
    this.dirty = true;
  }
  _cover(u, v, r, silt, crust) {
    const cx = u * GRID, cy = (1 - v) * GRID, rr = r * GRID;
    const x0 = Math.max(0, Math.floor(cx - rr)), x1 = Math.min(GRID - 1, Math.floor(cx + rr));
    const y0 = Math.max(0, Math.floor(cy - rr)), y1 = Math.min(GRID - 1, Math.floor(cy + rr));
    let ds = 0, dc = 0;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy) / rr;
        if (d >= 1) continue;
        const a = d < 0.55 ? 0.8 - 0.45 * (d / 0.55) : (0.35 * (1 - d)) / 0.45;
        const i = y * GRID + x, s0 = this.cs[i], c0 = this.cc[i];
        const s1 = Math.min(1, s0 + a * silt * 1.31), c1 = Math.min(1, c0 + a * crust * 0.25);
        this.cs[i] = s1; this.cc[i] = c1;
        const p0 = this.pc[i];
        let p1 = p0;
        if (!this.popped[i]) {
          if (c1 >= this.thr[i] && s1 >= 0.6) {
            this.popped[i] = 1; p1 = 1;
            this.fdata[i * 4 + 1] = 255;
            this.pops.push(i);
            this.fdirty = true;
          } else {
            p1 = Math.min(0.9, c1 / this.thr[i]);
            const g = Math.round(p1 * 230);
            if (g !== this.fdata[i * 4 + 1]) { this.fdata[i * 4 + 1] = g; this.fdirty = true; }
          }
          this.pc[i] = p1;
        }
        if (this.foot[i]) { ds += s1 - s0; dc += p1 - p0; }
      }
    }
    this.siltProgress += ds / this.footN;
    this.progress += dc / this.footN;
  }
  update() {
    if (this.dirty) { this.tex.needsUpdate = true; this.dirty = false; }
    if (this.fdirty) { this.flakeTex.needsUpdate = true; this.fdirty = false; }
  }
  sample(u, v) {
    const cx = clamp$9(Math.floor(u * GRID), 0, GRID - 1), cy = clamp$9(Math.floor((1 - v) * GRID), 0, GRID - 1);
    const i = cy * GRID + cx;
    this.left.silt = 1 - this.cs[i];
    this.left.crust = 1 - this.pc[i];
    return this.left;
  }
  dirt(u, v) { const l = this.sample(u, v); return l.silt * 0.4 + l.crust; }
  dirtiest(out) {
    let best = -1, bi = 0;
    for (let y = 1; y < GRID - 1; y++) {
      for (let x = 1; x < GRID - 1; x++) {
        const i = y * GRID + x;
        if (!this.foot[i]) continue;
        let s = 0;
        for (let oy = -1; oy <= 1; oy++) {
          for (let ox = -1; ox <= 1; ox++) {
            const j = i + oy * GRID + ox;
            if (this.foot[j]) s += 1 - this.pc[j] + 0.4 * (1 - this.cs[j]);
          }
        }
        s += Math.random() * 0.4;
        if (s > best) { best = s; bi = i; }
      }
    }
    out.x = ((bi % GRID) + 0.5) / GRID;
    out.y = 1 - (Math.floor(bi / GRID) + 0.5) / GRID;
    return out;
  }
}

const INS_FONT = '"GFS Neohellenic", "Palatino Linotype", "Book Antiqua", "Times New Roman", serif';
const ZODIAC$2 = ['ΚΡΙΟΣ', 'ΤΑΥΡΟΣ', 'ΔΙΔΥΜΟΙ', 'ΚΑΡΚΙΝΟΣ', 'ΛΕΩΝ', 'ΠΑΡΘΕΝΟΣ', 'ΧΗΛΑΙ', 'ΣΚΟΡΠΙΟΣ', 'ΤΟΞΟΤΗΣ', 'ΑΙΓΟΚΕΡΩΣ', 'ΥΔΡΟΧΟΟΣ', 'ΙΧΘΥΕΣ'];
const EGYPT$1 = ['ΘΩΘ', 'ΦΑΩΦΙ', 'ΑΘΥΡ', 'ΧΟΙΑΚ', 'ΤΥΒΙ', 'ΜΕΧΙΡ', 'ΦΑΜΕΝΩΘ', 'ΦΑΡΜΟΥΘΙ', 'ΠΑΧΩΝ', 'ΠΑΥΝΙ', 'ΕΠΙΦΙ', 'ΜΕΣΟΡΗ'];
const MANUAL = [
  'ΤΟΥ ΗΛΙΟΥ ΑΚΤΙΣ ΕΠΙ ΤΟΥ ΚΥΚΛΟΥ ΦΕΡΕΤΑΙ',
  'ΣΦΑΙΡΙΟΝ ΔΕΙΚΝΥΣΙ ΤΑΣ ΦΑΣΕΙΣ ΤΗΣ ΣΕΛΗΝΗΣ',
  'ΣΤΙΛΒΩΝ · ΦΩΣΦΟΡΟΣ · ΠΥΡΟΕΙΣ · ΦΑΕΘΩΝ',
  'ΦΑΙΝΩΝ · ΚΑΙ Ο ΚΟΣΜΟΣ ΠΕΡΙΑΓΕΤΑΙ',
  'ΕΝ ΩΙ ΑΙ ΕΚΛΕΙΨΕΙΣ ΗΛΙΟΥ ΚΑΙ ΣΕΛΗΝΗΣ',
  'ΜΗΝΕΣ ΣΚΓ · ΕΤΗ ΙΗ · ΣΠΕΙΡΑ ΤΕΤΡΑΚΥΚΛΟΣ',
  'ΓΝΩΜΟΝΙΟΝ ΤΟ ΠΡΟΣ ΤΑΣ ΗΜΕΡΑΣ ΤΟΥ ΕΤΟΥΣ',
  'ΟΛΥΜΠΙΑ · ΙΣΘΜΙΑ · ΠΥΘΙΑ · ΝΕΜΕΑ · ΝΑΑ',
  'ΠΕΡΙΦΕΡΕΙΑ ΤΟΥ ΖΩΔΙΑΚΟΥ ΚΥΚΛΟΥ',
  'ΔΙΑ ΤΩΝ ΓΝΩΜΟΝΩΝ ΤΩΝ ΠΛΑΝΗΤΩΝ',
  'Σ ΣΕΛΗΝΗ · Η ΗΛΙΟΣ',
  'ΑΝΑΤΟΛΑΙ ΚΑΙ ΔΥΣΕΙΣ ΤΩΝ ΑΣΤΡΩΝ',
];

function inscriptionTexture(kind) {
  const W = 1024;
  const c = document.createElement('canvas');
  c.width = c.height = W;
  const g = c.getContext('2d');
  g.fillStyle = '#000';
  g.fillRect(0, 0, W, W);
  const sx = W / UVX, sy = W / UVY, asp = sy / sx;
  const px = (x) => (x / UVX + 0.5) * W, py = (y) => (0.5 - y / UVY) * W;
  const font = (size) => `600 ${Math.max(6, Math.round(size * sx))}px ${INS_FONT}`;
  g.fillStyle = '#fff';
  g.strokeStyle = '#fff';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const glyph = (ch, x, y, rot, size) => {
    g.save();
    g.translate(px(x), py(y));
    g.scale(1, asp);
    g.rotate(rot);
    g.font = font(size);
    g.fillText(ch, 0, 0);
    g.restore();
  };
  const ring = (words, r, size, a0, gap) => {
    g.font = font(size);
    let a = a0;
    for (const w of words) {
      for (const ch of w) {
        const cw = (g.measureText(ch).width / sx) * 1.1;
        const am = a - cw / (2 * r);
        glyph(ch, Math.cos(am) * r, Math.sin(am) * r, Math.PI / 2 - am, size);
        a -= cw / r;
      }
      a -= gap / r;
    }
  };
  const circle = (r, lw) => { g.lineWidth = lw; g.beginPath(); g.ellipse(px(0), py(0), r * sx, r * sy, 0, 0, Math.PI * 2); g.stroke(); };
  const ticks = (r0, r1, r2, n, major, lw) => {
    g.lineWidth = lw;
    g.beginPath();
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      const re = k % major === 0 ? r2 : r1;
      g.moveTo(px(Math.cos(a) * r0), py(Math.sin(a) * r0));
      g.lineTo(px(Math.cos(a) * re), py(Math.sin(a) * re));
    }
    g.stroke();
  };
  const line = (s, x, y, size) => {
    g.save();
    g.translate(px(x), py(y));
    g.scale(1, asp);
    g.font = font(size);
    g.textAlign = 'left';
    g.fillText(s, 0, 0);
    g.restore();
  };
  if (kind === 0) {
    circle(0.166, 1.6);
    ticks(0.167, 0.1725, 0.177, 360, 5, 1.0);
    circle(0.178, 1.3);
    ring(ZODIAC$2, 0.1885, 0.0092, Math.PI * 0.62, 0.012);
    circle(0.1995, 1.3);
    const dayA = (k) => ((91 - k) / 365) * Math.PI * 2;
    g.lineWidth = 1.2;
    g.beginPath();
    for (let j = 0; j <= 12; j++) {
      const a = dayA(30 * j);
      g.moveTo(px(Math.cos(a) * 0.1995), py(Math.sin(a) * 0.1995));
      g.lineTo(px(Math.cos(a) * 0.221), py(Math.sin(a) * 0.221));
    }
    g.stroke();
    g.font = font(0.0082);
    EGYPT$1.forEach((w, j) => {
      let wd = 0;
      for (const ch of w) wd += (g.measureText(ch).width / sx) * 1.1;
      ring([w], 0.2105, 0.0082, dayA(30 * j + 15) + wd / (2 * 0.2105), 0);
    });
    circle(0.2215, 1.3);
    ticks(0.2215, 0.2255, 0.229, 365, 5, 1.0);
    circle(0.2295, 1.0);
    ring(['ΗΜΕΡΑΙ', 'ΤΞΕ'], 0.237, 0.0078, Math.PI * 0.3, 0.02);
  } else if (kind === 1) {
    MANUAL.forEach((s, k) => {
      const y = 0.232 - k * 0.0205;
      line(s, -0.335, y, 0.0098);
      line(MANUAL[(k + 5) % MANUAL.length], 0.03, y - 0.004, 0.0098);
    });
    circle(0.168, 1.4);
  } else {
    const r0 = 0.168, pitch = 0.0245, turns = 4, cells = 223;
    const spiral = (off) => {
      g.lineWidth = 1.5;
      g.beginPath();
      for (let k = 0; k <= 1400; k++) {
        const f = k / 1400, a = Math.PI / 2 - f * turns * Math.PI * 2;
        const r = r0 + off + pitch * turns * f;
        const X = px(Math.cos(a) * r), Yp = py(Math.sin(a) * r);
        if (k === 0) g.moveTo(X, Yp); else g.lineTo(X, Yp);
      }
      g.stroke();
    };
    spiral(0);
    spiral(pitch);
    const ecl = eclipseTable(cells);
    g.lineWidth = 1.0;
    for (let k = 0; k < cells; k++) {
      const f = k / cells, a = Math.PI / 2 - f * turns * Math.PI * 2;
      const r = r0 + pitch * turns * f;
      g.beginPath();
      g.moveTo(px(Math.cos(a) * r), py(Math.sin(a) * r));
      g.lineTo(px(Math.cos(a) * (r + pitch)), py(Math.sin(a) * (r + pitch)));
      g.stroke();
      const E = ecl[k];
      if (E.lunar || E.solar) {
        const am = a - (Math.PI * 2 * turns / cells) * 0.5;
        const rm = r + pitch * 0.55;
        glyph((E.lunar ? 'Σ' : '') + (E.solar ? 'Η' : ''), Math.cos(am) * rm, Math.sin(am) * rm, Math.PI / 2 - am, E.lunar && E.solar ? 0.0072 : 0.0088);
      }
    }
    ring(['ΕΞΕΛΙΓΜΟΣ'], 0.158, 0.0075, Math.PI * 0.75, 0.01);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace;
  t.anisotropy = 4;
  return t;
}

const LUMP_NOISE = `
float lfH(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
float lfN(vec3 x) {
  vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(lfH(i), lfH(i + vec3(1.0, 0.0, 0.0)), f.x), mix(lfH(i + vec3(0.0, 1.0, 0.0)), lfH(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
             mix(mix(lfH(i + vec3(0.0, 0.0, 1.0)), lfH(i + vec3(1.0, 0.0, 1.0)), f.x), mix(lfH(i + vec3(0.0, 1.0, 1.0)), lfH(i + vec3(1.0, 1.0, 1.0)), f.x), f.y), f.z);
}
`;

const LUMP_VERT_DECL = `
uniform sampler2D uMask;
varying vec3 vLocal;
varying vec2 vMUv;
varying float vCN;
${LUMP_NOISE}
`;
const LUMP_VERT = `
vLocal = position;
vMUv = vec2(position.x / ${UVX.toFixed(3)} + 0.5, position.y / ${UVY.toFixed(3)} + 0.5);
vCN = lfN(position * 36.0) * 0.65 + lfN(position * 95.0) * 0.35;
`;

const LUMP_FRAG_DECL = `
uniform sampler2D uMask;
uniform sampler2D uIns;
uniform sampler2D uFlake;
uniform float uXray;
uniform float uScan;
uniform float uGlow;
uniform float uGearN;
uniform float uSpokes;
uniform float uGearR;
uniform float uSweep;
uniform vec3 uDrift;
uniform vec3 uSandCol;
uniform vec3 uPlate;
uniform vec2 uPlateR;
uniform vec2 uBreak;
uniform float uTimeX;
uniform float uPatina;
varying vec3 vLocal;
varying vec2 vMUv;
varying float vCN;
${LUMP_NOISE}
float lumpH = 0.0;
float lumpRough = 0.9;
float lumpMetal = 0.1;
float lumpSw = 0.0;
vec2 lfH2(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}
vec3 lfVor(vec2 x) {
  vec2 n = floor(x), f = fract(x);
  float d1 = 8.0, d2 = 8.0, id = 0.0;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 g = vec2(float(i), float(j));
      vec2 o = lfH2(n + g);
      vec2 r = g + o - f;
      float d = dot(r, r);
      if (d < d1) { d2 = d1; d1 = d; id = o.y; } else if (d < d2) { d2 = d; }
    }
  }
  return vec3(sqrt(d1), sqrt(d2) - sqrt(d1), id);
}
float gearRelief(vec2 p) {
  float r = length(p);
  float a = atan(p.y, p.x);
  float tp = fract(a / 6.2831853 * uGearN);
  float tooth = 1.0 - abs(tp * 2.0 - 1.0);
  float outer = uGearR + 0.002 + tooth * 0.005;
  float rim = smoothstep(uGearR - 0.016, uGearR - 0.012, r) * (1.0 - smoothstep(outer - 0.0015, outer, r));
  float hub = 1.0 - smoothstep(0.02, 0.024, r);
  float spokes = 0.0;
  if (uSpokes > 0.5) {
    float sa = abs(fract(a / 6.2831853 * uSpokes + 0.5) - 0.5) * 6.2831853 / uSpokes;
    spokes = (1.0 - smoothstep(0.011, 0.015, sa * r)) * (1.0 - smoothstep(uGearR - 0.018, uGearR - 0.012, r));
  } else {
    spokes = (1.0 - smoothstep(uGearR - 0.018, uGearR - 0.012, r)) * 0.35;
  }
  return clamp(max(max(rim, hub), spokes), 0.0, 1.0);
}
float wheelKeep(vec2 p) {
  float a = atan(p.y, p.x);
  float da = abs(mod(a - uBreak.x + 3.14159265, 6.2831853) - 3.14159265);
  float keep = smoothstep(uBreak.y - 0.06, uBreak.y + 0.06, da + (lfN(vec3(p * 38.0, 2.0)) - 0.5) * 0.5);
  vec2 q = p - uPlate.xy;
  float c = cos(uPlate.z), s = sin(uPlate.z);
  vec2 u = vec2(q.x * c + q.y * s, -q.x * s + q.y * c);
  float under = 1.0 - smoothstep(-0.012, 0.004, max(abs(u.x) - uPlateR.x, abs(u.y) - uPlateR.y));
  return keep * (1.0 - under);
}
`;

const LUMP_COLOR = `
{
  vec4 mk = texture2D(uMask, vMUv);
  vec3 lp = vLocal;
  float n1 = lfN(lp * 26.0);
  float n2 = lfN(lp * 60.0 + 3.0);
  float eN = (n2 - 0.5) * 0.22 + (lfN(lp * 140.0) - 0.5) * 0.08;
  float silt = 1.0 - smoothstep(0.22 + eN * 0.5, 0.6 + eN * 0.5, mk.r);
  vec2 fg = vec2(vMUv.x, 1.0 - vMUv.y) * 32.0 + (vec2(lfN(lp * 30.0 + 13.0), lfN(lp * 30.0 + 29.0)) - 0.5) * 1.1
          + (vec2(lfN(lp * 95.0 + 5.0), lfN(lp * 95.0 + 17.0)) - 0.5) * 0.3;
  ivec2 fc = ivec2(floor(fg));
  float fd1 = 9.0, fd2 = 9.0;
  vec4 fs1 = vec4(0.0), fs2 = vec4(0.0);
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      ivec2 c = clamp(fc + ivec2(i, j), ivec2(0), ivec2(31));
      vec4 fsm = texelFetch(uFlake, c, 0);
      float d = length(fg - (vec2(c) + 0.15 + fsm.ba * 0.7));
      if (d < fd1) { fd2 = fd1; fs2 = fs1; fd1 = d; fs1 = fsm; } else if (d < fd2) { fd2 = d; fs2 = fsm; }
    }
  }
  float fEdge = fd2 - fd1 + eN * 0.45;
  float gone = step(0.99, fs1.g), nGone = step(0.99, fs2.g);
  float loose = smoothstep(0.3, 0.88, fs1.g) * (1.0 - gone);
  float crust = 1.0 - gone;
  float crack = loose * (1.0 - smoothstep(0.02, 0.07 + 0.05 * loose, fEdge));
  float dr = dot(lp.xy, uDrift.xy) - uDrift.z + (n1 - 0.5) * 0.07 + (lfN(lp * 9.0 + 5.0) - 0.5) * 0.06;
  float sand = smoothstep(-0.02, 0.05, dr) * (1.0 - smoothstep(0.06 + eN * 0.3, 0.26 + eN * 0.3, mk.r));
  float rimE = crust * nGone * (1.0 - smoothstep(0.0, 0.16, fEdge + (n1 - 0.5) * 0.06));
  float shadowE = gone * (1.0 - nGone) * (1.0 - smoothstep(0.0, 0.12, fEdge));
  float n3 = lfN(lp * 9.0 + 7.0);
  float n4 = lfN(lp * 150.0 + 1.0);
  float n5 = lfN(lp * 420.0 + 9.0);
  float rr = length(lp.xy);
  float top = smoothstep(-0.02, 0.03, lp.z);
  float gr = gearRelief(lp.xy) * top * wheelKeep(lp.xy);
  float worn = gr * smoothstep(0.5, 0.85, n4 * 0.55 + n1 * 0.6);
  vec3 cleanC = mix(vec3(0.035, 0.075, 0.055), vec3(0.08, 0.16, 0.11), n2);
  cleanC = mix(cleanC, vec3(0.028, 0.03, 0.026), smoothstep(0.5, 0.78, n1) * 0.65);
  cleanC = mix(cleanC, vec3(0.035, 0.07, 0.16), smoothstep(0.72, 0.88, n3) * 0.5);
  cleanC = mix(cleanC, vec3(0.19, 0.065, 0.03), smoothstep(0.68, 0.84, lfN(lp * 15.0 + 11.0)) * 0.55);
  cleanC = mix(cleanC, vec3(0.15, 0.29, 0.2), smoothstep(0.76, 0.9, n4) * 0.35);
  cleanC *= (0.85 + 0.3 * n4) * (1.0 + gr * 0.3);
  cleanC = mix(cleanC, vec3(0.28, 0.18, 0.085), worn * 0.75);
  float ins = texture2D(uIns, vMUv).r * top * smoothstep(uGearR + 0.003, uGearR + 0.01, rr);
  cleanC = mix(cleanC, vec3(0.012, 0.03, 0.022), ins * 0.85);
  vec3 patC = mix(vec3(0.19, 0.4, 0.29), vec3(0.42, 0.29, 0.13), smoothstep(0.45, 0.78, n1 * 0.7 + n4 * 0.4));
  cleanC = mix(cleanC, mix(patC * (0.85 + 0.3 * n2), vec3(0.012, 0.03, 0.022), ins * 0.85), uPatina);
  vec3 crustC = mix(vec3(0.12, 0.115, 0.1), vec3(0.23, 0.215, 0.18), n1);
  crustC = mix(crustC, vec3(0.3, 0.14, 0.17), smoothstep(0.6, 0.78, n3) * 0.55);
  crustC = mix(crustC, vec3(0.1, 0.14, 0.065), smoothstep(0.62, 0.8, lfN(lp * 12.0 + 21.0)) * 0.6);
  float tubes = 1.0 - smoothstep(0.0, 0.05, abs(lfN(lp * 22.0 + 5.0) - 0.5));
  crustC = mix(crustC, vec3(0.42, 0.4, 0.36), tubes * 0.6);
  vec3 vb = lfVor(lp.xy * 48.0 + 3.0);
  float isBarn = step(0.8, vb.z) * smoothstep(0.42, 0.58, n3);
  float bSz = fract(vb.z * 7.3);
  float barn = isBarn * (1.0 - smoothstep(0.12 + 0.12 * bSz, 0.2 + 0.14 * bSz, vb.x));
  float barnHole = isBarn * (1.0 - smoothstep(0.03 + 0.03 * bSz, 0.06 + 0.04 * bSz, vb.x));
  crustC = mix(crustC, vec3(0.46, 0.44, 0.4) * (0.8 + 0.3 * n2), barn * 0.85);
  crustC = mix(crustC, vec3(0.03, 0.028, 0.025), barnHole);
  vec3 vz = lfVor(lp.xy * 190.0);
  float bry = smoothstep(0.56, 0.7, lfN(lp * 7.0 + 31.0)) * (1.0 - isBarn);
  float lace = bry * (1.0 - smoothstep(0.03, 0.09, vz.y));
  float pore = bry * step(0.55, fract(vz.z * 13.1)) * (1.0 - smoothstep(0.05 + 0.08 * vz.z, 0.12 + 0.1 * vz.z, vz.x));
  crustC = mix(crustC, vec3(0.5, 0.3, 0.17), lace * 0.3);
  crustC = mix(crustC, vec3(0.1, 0.05, 0.035), pore * 0.45);
  float pits = smoothstep(0.72, 0.8, n4);
  crustC *= (0.75 + 0.35 * vCN) * (1.0 - pits * 0.6);
  float edgeBand = clamp(rimE * 2.0, 0.0, 1.0) * smoothstep(0.4, 0.62, n1);
  float strata = 0.5 + 0.5 * sin(fEdge * 40.0 + n1 * 5.0);
  crustC = mix(crustC, vec3(0.4, 0.38, 0.33) * (0.85 + 0.3 * strata), edgeBand * 0.6);
  crustC *= 1.0 - crack * 0.65;
  cleanC *= 1.0 - shadowE * 0.6;
  vec3 siltC = mix(vec3(0.19, 0.175, 0.14), vec3(0.27, 0.25, 0.2), n2) * (0.88 + 0.22 * n4);
  float grainB = smoothstep(0.78, 0.9, n5);
  float grainD = smoothstep(0.8, 0.92, lfN(lp * 380.0 + 17.0));
  siltC = mix(siltC, vec3(0.5, 0.47, 0.41), grainB * 0.6);
  siltC = mix(siltC, vec3(0.06, 0.055, 0.045), grainD * 0.6);
  float siltEdge = silt * (1.0 - silt) * 4.0;
  siltC *= 1.0 + siltEdge * 0.18;
  vec3 sandC = uSandCol * (0.86 + 0.24 * n4) * (0.92 + 0.12 * n2);
  vec3 col = mix(cleanC, crustC, crust);
  col = mix(col, siltC, silt * 0.95);
  col = mix(col, sandC, sand);
  diffuseColor.rgb = col;
  float bare = (1.0 - crust) * (1.0 - silt) * (1.0 - sand);
  lumpRough = mix(mix(0.5 - gr * 0.12 - worn * 0.14, mix(0.55, 0.9, n3), crust), 0.95, silt);
  lumpRough = mix(lumpRough, 0.97, sand);
  lumpMetal = bare * (0.1 + worn * 0.5 + uPatina * 0.25);
  float swd = (dot(lp.xy, vec2(0.8, 0.6)) - uSweep) * 22.0;
  lumpSw = exp(-swd * swd) * bare;
  lumpRough = mix(lumpRough, 0.2, lumpSw * 0.8);
  lumpRough = mix(lumpRough, 0.95, uXray);
  lumpMetal *= 1.0 - uXray;
  lumpH = crust * (1.3 + vCN * 0.9 + tubes * 0.35 - pits * 0.5 + barn * (1.0 - vb.x * 3.0) * 0.9 - barnHole * 0.9 + lace * 0.15 + (strata - 0.5) * 0.3 * edgeBand - crack * 0.8)
        + silt * (0.35 + n2 * 0.15 + n5 * 0.12 + siltEdge * 0.4)
        + sand * (0.55 + n2 * 0.25)
        + bare * (gr * 0.8 + n4 * 0.08 - ins * 0.9);
  lumpH *= 1.0 - 0.9 * uXray;
}
`;

const LUMP_NORMAL = `
{
  vec3 vp = -vViewPosition;
  vec3 dpx = dFdx(vp), dpy = dFdy(vp);
  float bs = 0.0045;
  float hx = dFdx(lumpH) * bs, hy = dFdy(lumpH) * bs;
  vec3 r1 = cross(dpy, normal), r2 = cross(normal, dpx);
  float det = dot(dpx, r1);
  vec3 sg = sign(det) * (hx * r1 + hy * r2);
  normal = normalize(abs(det) * normal - sg);
}
`;

const LUMP_EMISSIVE = `
{
  totalEmissiveRadiance += vec3(1.0, 0.8, 0.52) * lumpSw * 0.26;
  float xr = uXray;
  if (xr > 0.001) {
    float fres = pow(1.0 - abs(dot(normalize(vViewPosition), normal)), 1.5);
    float grain = lfH(vec3(floor(gl_FragCoord.xy * 0.5), floor(uTimeX * 24.0))) - 0.5;
    vec3 film = mix(vec3(0.018, 0.04, 0.06), vec3(0.004, 0.01, 0.018), fres);
    diffuseColor.rgb = mix(diffuseColor.rgb, film, xr);
    float bd = (vLocal.x - uScan) * 30.0;
    float band = exp(-bd * bd) * step(-0.36, uScan) * step(uScan, 0.36);
    float lit = step(vLocal.x, uScan);
    totalEmissiveRadiance += vec3(0.28, 0.72, 1.0) * xr * (fres * (0.07 + 0.16 * lit) + band * 0.8) * (1.0 + grain * 0.5);
    diffuseColor.a = mix(1.0, 0.42 + fres * 0.48 + band * 0.1, xr);
  }
  totalEmissiveRadiance += vec3(0.35, 1.0, 0.8) * uGlow;
}
`;

function gleamTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,246,226,1)');
  grad.addColorStop(0.18, 'rgba(255,214,150,0.55)');
  grad.addColorStop(0.5, 'rgba(255,190,120,0.08)');
  grad.addColorStop(1, 'rgba(255,190,120,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const BEAM_VERT$1 = `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const BEAM_FRAG$1 = `
uniform float uTime;
uniform float uAlpha;
varying vec2 vUv;
void main() {
  float streak = sin(vUv.x * 6.2831853 * 7.0 + uTime * 0.7) * 0.5 + 0.5;
  streak *= sin(vUv.x * 6.2831853 * 3.0 - uTime * 0.4) * 0.5 + 0.5;
  float fall = smoothstep(0.0, 0.18, vUv.y) * smoothstep(1.0, 0.45, vUv.y);
  float a = fall * (0.25 + 0.75 * streak) * uAlpha * 0.34;
  gl_FragColor = vec4(vec3(0.72, 1.0, 0.92) * a * 2.2, a);
}
`;
const RING_FRAG = `
uniform float uTime;
uniform float uAlpha;
uniform float uScale;
varying vec2 vUv;
void main() {
  float r = length(vUv - 0.5) * 2.0 / uScale;
  float ringA = smoothstep(0.78, 0.9, r) * smoothstep(1.0, 0.92, r);
  float inner = smoothstep(0.5, 0.62, r) * smoothstep(0.7, 0.64, r) * 0.35;
  float a = (ringA + inner) * uAlpha * (0.55 + 0.45 * sin(uTime * 3.0)) * 0.8;
  gl_FragColor = vec4(vec3(0.6, 1.0, 0.9) * a * 1.4, a);
}
`;
const SCAN_FRAG = `
uniform float uA;
uniform float uTime;
varying vec2 vUv;
float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
void main() {
  float x = (vUv.x - 0.5) * 2.0;
  float core = exp(-x * x * 18.0) * 0.7 + exp(-x * x * 2.5) * 0.35;
  float ends = smoothstep(0.0, 0.14, vUv.y) * smoothstep(1.0, 0.86, vUv.y);
  float grain = 0.7 + 0.6 * h21(floor(vUv * vec2(24.0, 240.0)) + floor(uTime * 30.0));
  float a = core * ends * grain * uA;
  gl_FragColor = vec4(vec3(0.45, 0.85, 1.0) * a, a);
}
`;

function buildBrushTool() {
  const group = new THREE.Group();
  const V2 = THREE.Vector2;
  const wood = new THREE.MeshStandardMaterial({ color: new THREE.Color(0.5, 0.31, 0.15), roughness: 0.34 });
  wood.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      {
        float ang = atan(vObjPos.z, vObjPos.x);
        float g1 = sin(ang * 26.0 + sin(vObjPos.y * 60.0) * 1.8 + sin(vObjPos.y * 13.0 + ang * 3.0) * 2.5);
        diffuseColor.rgb *= 0.84 + 0.2 * g1 * g1;
      }`);
  };
  wood.customProgramCacheKey = () => 'brush-wood';
  patchMaterial(wood);
  const brass = patchMaterial(new THREE.MeshStandardMaterial({ color: new THREE.Color(0.93, 0.71, 0.4), metalness: 1, roughness: 0.28 }));
  const handle = new THREE.Mesh(new THREE.LatheGeometry(HANDLE_PROF.map(([r, y]) => new V2(r, y)), 28), wood);
  const ferrule = new THREE.Mesh(new THREE.LatheGeometry(FERRULE_PROF.map(([r, y]) => new V2(r, y)), 32), brass);
  const parts = [];
  const rng = makeRng$1(9);
  const col = new THREE.Color();
  for (let i = 0; i < 420; i++) {
    const a = rng() * Math.PI * 2, rr = Math.sqrt(rng()) * 0.0104;
    const len = 0.05 * (1 - 0.2 * (rr / 0.0104) ** 2) * (0.94 + rng() * 0.1);
    const c = new THREE.ConeGeometry(0.00055 + rng() * 0.0003, len, 3, 1);
    c.rotateX(Math.PI);
    c.translate(0, -len / 2, 0);
    c.rotateZ(-Math.cos(a) * rr * 9 + (rng() - 0.5) * 0.12);
    c.rotateX(Math.sin(a) * rr * 9 + (rng() - 0.5) * 0.12);
    c.translate(Math.cos(a) * rr, -5e-3, Math.sin(a) * rr);
    const g = c.index ? c.toNonIndexed() : c;
    g.deleteAttribute('uv');
    const sh = 0.8 + rng() * 0.28;
    col.setRGB(0.95 * sh, 0.87 * sh, 0.68 * sh * (0.9 + rng() * 0.15));
    const n = g.attributes.position.count;
    const ca = new Float32Array(n * 3);
    for (let k = 0; k < n; k++) { ca[k * 3] = col.r; ca[k * 3 + 1] = col.g; ca[k * 3 + 2] = col.b; }
    g.setAttribute('color', new THREE.BufferAttribute(ca, 3));
    parts.push(g);
  }
  const bristleGeo = mergeGeometries(parts);
  const bend = { value: new THREE.Vector3() };
  const splay = { value: 0 };
  const dirt = { value: 0 };
  const bristleMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62 });
  bristleMat.onBeforeCompile = (shader) => {
    shader.uniforms.uBend = bend;
    shader.uniforms.uSplay = splay;
    shader.uniforms.uDirt = dirt;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uBend;\nuniform float uSplay;\nvarying float vBt;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        float bt = clamp((-0.005 - position.y) / 0.05, 0.0, 1.0);
        vBt = bt;
        float b2 = bt * bt;
        float rl = length(position.xz);
        vec2 radial = rl > 1e-5 ? position.xz / rl : vec2(0.0);
        transformed.xz += uBend.xz * b2 + radial * uSplay * b2 * (0.35 + rl / 0.0104);
        transformed.y += (length(uBend.xz) * 0.45 + uSplay * 0.35) * b2;`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uDirt;\nvarying float vBt;')
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.27, 0.24, 0.18), uDirt * smoothstep(0.35, 1.0, vBt));')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        {
          float rim = pow(1.0 - abs(dot(normalize(vViewPosition), normal)), 3.0);
          totalEmissiveRadiance += vec3(0.42, 0.4, 0.34) * rim * 0.35 * (1.0 - uDirt * 0.6);
        }`);
  };
  bristleMat.customProgramCacheKey = () => 'bristles3';
  patchMaterial(bristleMat);
  const bristles = new THREE.Mesh(bristleGeo, bristleMat);
  group.add(handle, ferrule, bristles);
  group.traverse((o) => { if (o.isMesh) { o.castShadow = true; } });
  group.renderOrder = 4;
  return { group, bend, splay, dirt, pos: new THREE.Vector3(), bendV: new THREE.Vector3(), bendS: new THREE.Vector3(), press: 0, init: false };
}

const _bermTA = new Float32Array(13);

function buildBerm(lump, geo, home, fl, sn, driftA, seed) {
  const src = SEDIMENT.material;
  if (!src) return null;
  const NB = 64, TAU = Math.PI * 2;
  const R = new Float32Array(NB), top = new Float32Array(NB);
  const flAt = (x, z) => fl - (sn.x * (x - home.x) + sn.z * (z - home.z)) / sn.y;
  const P = geo.attributes.position, mw = lump.matrixWorld;
  const bins = new Uint8Array(P.count), rs = new Float32Array(P.count), dys = new Float32Array(P.count);
  for (let i = 0; i < P.count; i++) {
    _a.fromBufferAttribute(P, i).applyMatrix4(mw);
    const dx = _a.x - home.x, dz = _a.z - home.z, r = Math.hypot(dx, dz);
    const b = ((Math.round((Math.atan2(dz, dx) / TAU) * NB) % NB) + NB) % NB;
    const dy = _a.y - flAt(_a.x, _a.z);
    bins[i] = b; rs[i] = r; dys[i] = dy;
    if (dy > -4e-3 && r > R[b]) R[b] = r;
  }
  for (let i = 0; i < P.count; i++) { const b = bins[i]; if (rs[i] > R[b] * 0.78 && dys[i] > top[b]) top[b] = dys[i]; }
  const smooth = (A) => {
    for (let pass = 0; pass < 2; pass++) {
      const s = A.slice();
      for (let b = 0; b < NB; b++) {
        const a0 = s[(b + NB - 1) % NB], a1 = s[b], a2 = s[(b + 1) % NB];
        A[b] = a1 > 0 ? (a0 + 2 * a1 + a2) / 4 : Math.max(a0, a2);
      }
    }
  };
  smooth(R); smooth(top);
  let Ravg = 0;
  for (let b = 0; b < NB; b++) Ravg += R[b] / NB;
  const hE = new Float32Array(NB), rO = new Float32Array(NB), dW = new Float32Array(NB);
  for (let b = 0; b < NB; b++) {
    let da = Math.abs((b / NB) * TAU - driftA) % TAU;
    if (da > Math.PI) da = TAU - da;
    const w = Math.pow(Math.max(0, Math.cos(da)), 3);
    dW[b] = w;
    hE[b] = lerp$3(clamp$9(top[b] - 0.012, 0.006, 0.028), top[b] + 0.012, w);
    rO[b] = clamp$9(1 + (Math.max(0.07, 3.8 * hE[b]) + 0.1 * w) / Math.max(0.08, R[b]), 1.2, 1.8);
  }
  const prof = (rho, e, ro) => {
    if (rho < 0.8) return -0.03;
    if (rho < 1.0) return lerp$3(-0.03, e, sstep$7(0.8, 1.0, rho));
    if (rho < ro) { const u = (rho - 1.0) / (ro - 1.0); return e * (1 - u) * (1 - u); }
    return -0.012 * sstep$7(ro, ro + 0.2, rho);
  };
  const slump = (rho, e, ro) => {
    if (rho < 0.75) return 0.004 + 0.004 * (rho / 0.75);
    if (rho < 1.2) return lerp$3(0.008, prof(1.2, e, ro) * 0.6, sstep$7(0.75, 1.2, rho));
    return prof(rho, e, ro) * 0.6;
  };
  const RHO = [0, 0.3, 0.55, 0.7, 0.8, 0.87, 0.93, 0.97, 1.0, 1.04, 1.09, 1.15, 1.25, 1.38, 1.52, 1.65, 1.75, 1.85, 2.0];
  const NR = RHO.length;
  const pos = new Float32Array(NR * NB * 3), posS = new Float32Array(NR * NB * 3);
  const colA = new Float32Array(NR * NB * 3), terA = new Float32Array(NR * NB * 4), ter2A = new Float32Array(NR * NB * 3);
  const nS = new Float32Array(NR * NB * 3), wS = new Float32Array(NR * NB), TA = _bermTA;
  const sand = [0, 0, 0];
  let sandN = 0;
  for (let j = 0; j < NR; j++) {
    const rho = RHO[j];
    for (let b = 0; b < NB; b++) {
      const a = (b / NB) * TAU, ro = rO[b];
      let r = rho * lerp$3(R[b], Ravg, sstep$7(1.2, 1.9, rho));
      if (rho > 1.15) r *= 1 + 0.35 * dW[b] * sstep$7(1.15, 1.9, rho);
      const x = home.x + Math.cos(a) * r, z = home.z + Math.sin(a) * r;
      const fy = floorHeight(x, z);
      const nz = rho > 1.0 && rho < ro ? 0.003 * noise3(x * 11, z * 11, seed) * sstep$7(1.0, 1.1, rho) * (1 - sstep$7(ro - 0.15, ro, rho)) : 0;
      const hy = prof(rho, hE[b], ro) + nz;
      const v = j * NB + b;
      pos[v * 3] = x; pos[v * 3 + 1] = fy + hy; pos[v * 3 + 2] = z;
      posS[v * 3] = x; posS[v * 3 + 1] = fy + slump(rho, hE[b], ro) + nz * 0.6; posS[v * 3 + 2] = z;
      terrainAttrs(x, z, TA);
      const ao = lerp$3(0.7, 1, sstep$7(0.97, 1.3, rho));
      colA[v * 3] = TA[0]; colA[v * 3 + 1] = TA[1]; colA[v * 3 + 2] = TA[2];
      terA[v * 4] = TA[3]; terA[v * 4 + 1] = TA[4]; terA[v * 4 + 2] = TA[5]; terA[v * 4 + 3] = TA[6] * ao;
      ter2A[v * 3] = TA[7]; ter2A[v * 3 + 1] = TA[8] * sstep$7(1.0, 1.25, rho); ter2A[v * 3 + 2] = TA[9];
      nS[v * 3] = TA[10]; nS[v * 3 + 1] = TA[11]; nS[v * 3 + 2] = TA[12];
      wS[v] = 1 - sstep$7(0.003, 0.015, hy);
      if (rho >= 1.05 && rho <= 1.35) { sand[0] += TA[0]; sand[1] += TA[1]; sand[2] += TA[2]; sandN++; }
    }
  }
  const idx = [];
  for (let j = 0; j < NR - 1; j++) {
    for (let b = 0; b < NB; b++) {
      const b1 = (b + 1) % NB;
      const a0 = j * NB + b, a1 = j * NB + b1, c0 = (j + 1) * NB + b, c1 = (j + 1) * NB + b1;
      idx.push(a0, a1, c0, a1, c1, c0);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(colA, 3));
  g.setAttribute('aTer', new THREE.BufferAttribute(terA, 4));
  g.setAttribute('aTer2', new THREE.BufferAttribute(ter2A, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  {
    const NA = g.attributes.normal.array;
    for (let v = 0; v < wS.length; v++) {
      const w = wS[v];
      if (w <= 0) continue;
      const nx = NA[v * 3] * (1 - w) + nS[v * 3] * w, ny = NA[v * 3 + 1] * (1 - w) + nS[v * 3 + 1] * w, nz = NA[v * 3 + 2] * (1 - w) + nS[v * 3 + 2] * w;
      const l = Math.hypot(nx, ny, nz) || 1;
      NA[v * 3] = nx / l; NA[v * 3 + 1] = ny / l; NA[v * 3 + 2] = nz / l;
    }
  }
  const gs = new THREE.BufferGeometry();
  gs.setAttribute('position', new THREE.BufferAttribute(posS, 3));
  gs.setIndex(idx);
  gs.computeVertexNormals();
  g.morphAttributes.position = [gs.attributes.position];
  g.morphAttributes.normal = [gs.attributes.normal];
  const mat = src.clone();
  mat.onBeforeCompile = src.onBeforeCompile;
  mat.customProgramCacheKey = src.customProgramCacheKey;
  mat.polygonOffset = true;
  mat.polygonOffsetFactor = 1;
  mat.polygonOffsetUnits = 1;
  const mesh = new THREE.Mesh(g, mat);
  mesh.name = 'find-berm';
  mesh.receiveShadow = true;
  mesh.updateMorphTargets();
  const heightAt = (x, z) => {
    const dx = x - home.x, dz = z - home.z;
    const fb = ((Math.atan2(dz, dx) / TAU) * NB + NB) % NB, b0 = Math.floor(fb) % NB, b1 = (b0 + 1) % NB, t = fb - Math.floor(fb);
    const rho = Math.hypot(dx, dz) / Math.max(0.01, lerp$3(R[b0], R[b1], t));
    return flAt(x, z) + prof(rho, lerp$3(hE[b0], hE[b1], t), lerp$3(rO[b0], rO[b1], t));
  };
  if (sandN) { sand[0] /= sandN; sand[1] /= sandN; sand[2] /= sandN; } else sandAlbedo(home.x, home.z, 0.2, sand);
  return { mesh, heightAt, sand, Ravg };
}

function ringGeometry(home, berm) {
  const NB = 72, RS = [0.2, 0.4, 0.55, 0.65, 0.72, 0.78, 0.85, 1.0, 1.2, 1.45, 1.7, 1.95, 2.2];
  const n = RS.length, P = new Float32Array(n * NB * 3), UV = new Float32Array(n * NB * 2), idx = [];
  for (let j = 0; j < n; j++) {
    for (let b = 0; b < NB; b++) {
      const a = (b / NB) * Math.PI * 2, x = home.x + Math.cos(a) * RS[j], z = home.z + Math.sin(a) * RS[j];
      const v = j * NB + b;
      P[v * 3] = x; P[v * 3 + 1] = Math.max(floorHeight(x, z), berm ? berm.heightAt(x, z) : -1e9) + 0.035; P[v * 3 + 2] = z;
      UV[v * 2] = 0.5 + (Math.cos(a) * RS[j]) / 1.6; UV[v * 2 + 1] = 0.5 + (Math.sin(a) * RS[j]) / 1.6;
      if (j < n - 1) { const b1 = (b + 1) % NB; idx.push(v, j * NB + b1, (j + 1) * NB + b, j * NB + b1, (j + 1) * NB + b1, (j + 1) * NB + b); }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(P, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(UV, 2));
  g.setIndex(idx);
  return g;
}

function spring3(p, v, target, w, dt) {
  const h = Math.min(dt, 1 / 30);
  v.x += (w * w * (target.x - p.x) - 2 * w * v.x) * h;
  v.y += (w * w * (target.y - p.y) - 2 * w * v.y) * h;
  v.z += (w * w * (target.z - p.z) - 2 * w * v.z) * h;
  p.addScaledVector(v, h);
}

function makeStow() {
  const V = () => new THREE.Vector3();
  return {
    phase: 'rise', tW: 0, relC: new THREE.Matrix4(), c0: V(), c1: V(), qF: new THREE.Quaternion(), W3b: V(), W4b: V(),
    W: [V(), V(), V(), V(), V()], sW: [0, 0, 0, 0, 0], Wb: V(), sWb: 0, curve: null, L: 1, ts: new Float32Array(900), n: 1, TA: 1, s: 0,
    SL: V(), PV: V(), M0: V(), out: V(), up: V(), belly: V(), fromR: V(), fromL: V(), tR: -1, tL: -1,
    SR: V(), gl: V(), gA: 0, gD: 0, glZ: 0, turnT: STOW_TURN, C0: V(), offC: V(), tv: 0, tLast: 0, lastP: V(), pOn: false,
    let: false, letT: 0, rideT: 0, drop: 0.1, dropT: 0.2, seatW: 1, rel: new THREE.Matrix4(), caps: new Float32Array(7 * 20), hx: 0.045, hy: 0.14, hz: 0.19,
    bP: V(), bP2: V(), bQ: new THREE.Quaternion(), bQ2: new THREE.Quaternion(), bM: new THREE.Matrix4(), bOn: false, bT: 0,
  };
}

function makeCloseup() {
  const V = () => new THREE.Vector3(), Q = () => new THREE.Quaternion();
  const stage = () => ({ yaw: 0, d: V(), f: V(), r: V(), S: V(), S2: V(), Cb: V(), Tb: V(), Cw: V(), Tw: V(), head2: V(), Pp: V(), Cx: V(), Tx: V(), bad: 0 });
  return {
    active: false, it: null, camera: null, diver: null, player: null, env: null, fovBase: 60, plan: STAGES$1.prone,
    t: 0, blend: 1, phase: 'idle', canSteer: false, st: stage(), st2: stage(),
    cinePos: V(), cineQ: Q(), aim0: V(), ctrl: V(), qFix: Q(), look: V(), pushFrom: V(), arcH: 0,
    S0: V(), q0: Q(), qS: Q(), qS2: Q(), dPos: V(), dPrev: V(), dQ: Q(), lean: V(),
    dOpts: { speed: 0, thrust: 0, turnRate: 0, climb: 0, lookDir: V(), reach: 0, pose: 'hover' },
    dLx: 1, dLy: 0,
    tl: V(), lastL: V(), bStartL: V(), tipT: V(), tip: V(), tipPrev: V(), tipV: V(), tipN: V(), tipInit: false,
    onLump: true, contact: false, lifted: 0, scrubbing: false, pressing: false, scrub: 0, wig: 0, dabAcc: 0, brushT: 0, tipErr: 9, brushReady: false, readyT: 0,
    walkDur: 0, downT: -1, riseT: -1, orbA0: 0, orbR0: 0, orbDA: 0, back: 0, outT: 0, outR: 0,
    grip: V(), gripV: V(), gripInit: false, awayFrom: V(), awayV: V(), awayN: V(), awayPalm: V(), nearAt: 0, brushGone: false, carrying: false, drawn: false, handT: V(), palmW: V(),
    pivQ: Q(), slide: 0, tipFix: V(), pickK: 0, pickV: 0, leanV: V(), gripQ: Q(), gqInit: false,
    optBrush: { grip: 1, palm: V(), touch: null, inHand: true, squeeze: true, dev: HOLD_DEV }, optSteady: { grip: 0.15, palm: new THREE.Vector3(0, -1, 0) }, box: { x0: 0, y0: 0, x1: 0, y1: 0 }, away: V(),
    auto: { on: false, phase: 'move', t: 0, k: 0, dur: 0.2, region: 0, cx: 0, cy: 0, dx: 1, dy: 0, fx: 0, fy: 0, sx: 0, sy: 0, ex: 0, ey: 0, lift: 0 },
    out: { camPos: V(), camQuat: Q(), fovAdd: -20, dofFocus: 1, dofAperture: 0.24, torchPos: V(), torchAim: V(), brush: 0, progress: 0, uncovered: false, release: false },
    exit: { pos: V(), yaw: 0, pitch: -0.28, bodyPitch: 0 },
  };
}

function lumpMaterial(uni) {
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, metalness: 0.1, transparent: true });
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uni);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\n' + LUMP_VERT_DECL)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n' + LUMP_VERT);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n' + LUMP_FRAG_DECL)
      .replace('#include <color_fragment>', '#include <color_fragment>\n' + LUMP_COLOR)
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nroughnessFactor = lumpRough;\nmetalnessFactor = lumpMetal;')
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n' + LUMP_NORMAL)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n' + LUMP_EMISSIVE);
  };
  mat.customProgramCacheKey = () => 'lump-v4';
  patchMaterial(mat);
  return mat;
}

const PILE = [
  [0, 1.05, 0.05, 0.04, 0.13, 8, 1],
  [1, 0.9, -0.46, -0.28, 0.03, 15, 0.55],
  [2, 0.95, 0.48, -0.3, 0.03, 18, 1],
  [0, 1.1, 0.08, -0.44, 0.01, 6, 0.5],
  [1, 1.3, 0.42, 0.2, 0.04, 12, 1],
  [2, 1.25, -0.4, 0.24, 0.03, 10, 1],
  [0, 1.5, 0, 0, 0, 4, 1],
];
const PILE_SEEDS = [131, 138, 145];
const PILE_STEP = 0.02;
const PILE_ORDER = [6, 3, 5, 4, 1, 2, 0];
const PILE_FREE = [
  { tip: [-8, 12], tip2: [-8, 8], slide: [-0.08, 0.08], lean: 0, top: true },
  { tip: [0, 36], slide: [-0.04, 0.32], lean: 1 },
  { tip: [0, 36], slide: [-0.04, 0.32], lean: 1 },
  { tip: [0, 6], slide: [-0.04, 0.06], lean: 0 },
  { tip: [0, 32], slide: [-0.04, 0.24], lean: 1 },
  { tip: [0, 32], slide: [-0.04, 0.24], lean: 1 },
  { tip: [0, 4], slide: [0, 0], lean: 0 },
];
const _plq = new THREE.Quaternion(), _pm = new THREE.Matrix4();

class Fragments {
  constructor(scene, fx, cb = {}) {
    this.scene = scene;
    this.fx = fx;
    this.cb = cb;
    this.items = [];
    this.collected = 0;
    this.diver = null;
    this.beacon = 0;
    const gleam = gleamTexture();
    HERO_GEARS.forEach((spec, i) => this.items.push(this._build(spec, i, gleam)));
    this._buildPile();
    this.tool = buildBrushTool();
    this.tool.group.visible = false;
    scene.add(this.tool.group);
    this.cu = makeCloseup();
    this.torchPose = { active: false, pos: new THREE.Vector3(), aim: new THREE.Vector3() };
    this._rc = new THREE.Raycaster();
    this._p = new THREE.Vector3();
    this._p2 = new THREE.Vector3();
    this._v = new THREE.Vector3();
    this._bv = new THREE.Vector3();
    this._push = new THREE.Vector3();
    this._inv = new THREE.Quaternion();
    this._oSilt = { spread: 0, color: SILT_COL, up: 0, life: 0, size: 0, push: null, ground: 0 };
    this._oGrain = { spread: 0, push: null, up: 0, ground: 0, palette: SAND_PAL };
    this._oChip = { ground: 0, push: null, speed: 1 };
  }

  _build(spec, i, gleam) {
    const scene = this.scene;
    const f = LAYOUT.frags[i];
    const fl = floorHeight(f.x, f.z);
    const home = new THREE.Vector3(f.x, fl - 0.008, f.z);
    const { geo, plate, sdf } = lumpGeometry(100 + i * 7);
    const rng = makeRng$1(400 + i * 13);
    const uni = {
      uXray: { value: 0 }, uScan: { value: -0.4 }, uGlow: { value: 0 }, uMask: { value: null }, uFlake: { value: null },
      uIns: { value: inscriptionTexture(i) },
      uGearN: { value: spec.N }, uSpokes: { value: spec.spokes }, uGearR: { value: 0.16 },
      uSweep: { value: -9 }, uDrift: { value: new THREE.Vector3(1, 0, 9) }, uSandCol: { value: new THREE.Vector3(0.6, 0.55, 0.44) },
      uPlate: { value: new THREE.Vector3(plate.x, plate.y, plate.a) }, uPlateR: { value: new THREE.Vector2(plate.hx, plate.hy) },
      uBreak: { value: new THREE.Vector2(rng() * Math.PI * 2, 0.5 + rng() * 0.35) }, uTimeX: U.uTime, uPatina: { value: 0 },
    };
    const lump = new THREE.Mesh(geo, lumpMaterial(uni));
    lump.castShadow = true;
    lump.receiveShadow = true;
    lump.position.copy(home);
    lump.rotation.set(-Math.PI / 2 + 0.08, 0, i * 1.7 + 0.4);
    const se = 0.25;
    const sn = new THREE.Vector3(floorHeight(f.x - se, f.z) - floorHeight(f.x + se, f.z), 2 * se,
      floorHeight(f.x, f.z - se) - floorHeight(f.x, f.z + se)).normalize();
    lump.quaternion.premultiply(new THREE.Quaternion().setFromUnitVectors(Y, sn));
    lump.scale.setScalar(LUMP_S);
    lump.renderOrder = 3;
    scene.add(lump);
    lump.updateMatrixWorld(true);
    const top = new TopField(geo), rim = rimProfile(geo);
    const driftA = rng() * Math.PI * 2;
    const berm = buildBerm(lump, geo, home, fl, sn, driftA, 11 + i * 5);
    if (berm) scene.add(berm.mesh);
    const covered = (x, y, z) => {
      if (!berm) return false;
      _a.set(x, y, z).applyMatrix4(lump.matrixWorld);
      return _a.y < berm.heightAt(_a.x, _a.z) - 0.002;
    };
    top.cover(covered);
    const mask = new DirtMask(geo, (x, y, z) => !covered(x, y, z), 700 + i * 31);
    uni.uMask.value = mask.tex;
    uni.uFlake.value = mask.flakeTex;
    if (berm) uni.uSandCol.value.set(berm.sand[0], berm.sand[1], berm.sand[2]);
    const sc = uni.uSandCol.value, puffCol = [sc.x * 0.93, sc.y * 0.9, sc.z * 0.85], cloudCol = [sc.x * 0.92, sc.y * 0.8, sc.z * 0.6];
    _a.set(Math.cos(driftA), 0, Math.sin(driftA)).applyQuaternion(_q$1.copy(lump.quaternion).invert());
    const dl = Math.hypot(_a.x, _a.y) || 1, ddx = _a.x / dl, ddy = _a.y / dl;
    uni.uDrift.value.set(ddx, ddy, top.extent(ddx, ddy) * 0.55);
    const corner = top.corner(-ddx, -ddy, rng, new THREE.Vector3());
    for (let k = 0; k < 2; k++) mask.stroke(toU(corner.x), toV(corner.y), 0, 0, false, 0.042 / UVX, 1, 1);
    mask.progress = mask.siltProgress = 0;
    mask.pops.length = 0;
    const cornerW = lump.localToWorld(corner.clone().setZ(corner.z + 0.012));

    const guni = { uCount: { value: 0 }, uShow: { value: 0 }, uPitch: { value: pitchRadius(spec.N, spec.m) } };
    const gearMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(0.48, 0.34, 0.19), metalness: 1, roughness: 0.58 });
    gearMat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, guni);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float aAng;\nvarying float vAng;\nvarying float vRad;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvAng = aAng;\nvRad = length(position.xy);');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform float uCount;\nuniform float uShow;\nuniform float uPitch;\nvarying float vAng;\nvarying float vRad;')
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
          {
            float teeth = smoothstep(uPitch * 0.9, uPitch * 0.97, vRad);
            float passed = step(vAng, uCount) * teeth;
            float front = exp(-abs(vAng - uCount) * 70.0) * step(uCount, 0.999) * teeth;
            float rim = pow(1.0 - abs(dot(normalize(vViewPosition), normal)), 2.0);
            totalEmissiveRadiance += (vec3(1.0, 0.66, 0.26) * (0.03 + passed * 0.42 + front * 2.2) + vec3(0.3, 0.72, 1.0) * (0.03 + rim * 0.4)) * uShow;
          }`);
    };
    gearMat.customProgramCacheKey = () => 'herogear3';
    patchMaterial(gearMat);
    const gear = new THREE.Mesh(addAngleAttribute(gearGeometry(spec.N, { spokes: spec.spokes, thickness: spec.thickness })), gearMat);
    gear.scale.setScalar(0.16 / pitchRadius(spec.N, spec.m));
    gear.visible = false;
    gearMat.transparent = true;
    gearMat.depthWrite = false;
    gear.renderOrder = 11.5;
    lump.add(gear);
    const shell = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: new THREE.Color(0.006, 0.016, 0.024), transparent: true, opacity: 0, side: THREE.BackSide, depthWrite: false }));
    shell.visible = false;
    shell.renderOrder = 11;
    lump.add(shell);
    const scanU = { uA: { value: 0 }, uTime: U.uTime };
    const scan = new THREE.Mesh(new THREE.PlaneGeometry(0.07, 0.5),
      new THREE.ShaderMaterial({ uniforms: scanU, vertexShader: BEAM_VERT$1, fragmentShader: SCAN_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    scan.position.z = top.zMax + 0.014;
    scan.visible = false;
    scan.renderOrder = 13;
    lump.add(scan);

    const beamU = { uTime: U.uTime, uAlpha: { value: 0 } };
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35, 1.3, 16, 40, 1, true),
      new THREE.ShaderMaterial({ uniforms: beamU, vertexShader: BEAM_VERT$1, fragmentShader: BEAM_FRAG$1, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }),
    );
    beam.geometry.translate(0, 8, 0);
    beam.position.copy(home).add(new THREE.Vector3(0, -0.3, 0));
    beam.quaternion.setFromUnitVectors(Y, U.uSunW.value.clone().normalize());
    beam.renderOrder = 9;
    scene.add(beam);

    const ringU = { uTime: U.uTime, uAlpha: { value: 0 }, uScale: { value: 1 } };
    const ring = new THREE.Mesh(ringGeometry(home, berm),
      new THREE.ShaderMaterial({ uniforms: ringU, vertexShader: BEAM_VERT$1, fragmentShader: RING_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8 }));
    ring.renderOrder = 9;
    scene.add(ring);

    const glintMat = new THREE.SpriteMaterial({ map: gleam, color: new THREE.Color(2.2, 1.8, 1.3), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 });
    const glint = new THREE.Sprite(glintMat);
    glint.scale.setScalar(0.1);
    glint.position.copy(cornerW);
    glint.renderOrder = 10;
    scene.add(glint);

    const V = () => new THREE.Vector3();
    gear.geometry.computeBoundingBox();
    const gbb = gear.geometry.boundingBox, wheelR = Math.max(gbb.max.x, -gbb.min.x, gbb.max.y, -gbb.min.y) * gear.scale.x;
    const touchInv = new THREE.Matrix4(), tw = V(), keep = wheelR + WHEEL_KEEP;
    const keepZ = Math.max(geo.boundingBox.max.z, -geo.boundingBox.min.z) + WHEEL_KEEP;
    const touch = (x, y, z) => {
      tw.set(x, y, z).applyMatrix4(touchInv);
      return Math.min(sdf(tw.x, tw.y, tw.z), Math.max(Math.hypot(tw.x, tw.y) - keep, Math.abs(tw.z) - keepZ)) * LUMP_S;
    };
    const touchS = (x, y, z) => { tw.set(x, y, z).applyMatrix4(touchInv); return sdf(tw.x, tw.y, tw.z) * LUMP_S; };
    return {
      i, spec, home, lump, gear, mask, top, rim, sdf, touchInv, touch, touchS, wheelR, uni, guni, shell, scan, scanU, beam, beamU, ring, ringU, glint, glintMat, berm, puffCol, cloudCol,
      state: 'buried', t: 0, lastTick: 0, hl: 0, lastU: 0, lastV: 0, lastT: -9,
      pace: PACE_FULL, homeP: lump.position.clone(), homeQ: lump.quaternion.clone(),
      presentP: V(), presentQ: new THREE.Quaternion(), gR: V(), gL: V(), uR: V(), uL: V(), offR: GRIP_START, offL: GRIP_START, stowP: V(), stowQ: new THREE.Quaternion(),
      hands: { on: false, r: V(), l: V(), rP: V(), lP: V(), fromR: V(), fromL: V(), vR: V(), vL: V(), goR: 0, palm0R: V(), wr: 0, wl: 0, holdR: false, holdL: false, optR: { grip: 1, palm: V(), edge: V(), touch }, optL: { grip: 0.85, palm: V(), edge: V(), touch } },
      slumpT: -1, uncovered: false, tugged: false, scanStarted: false, revealed: false, released: false, staged: false, from: V(),
      rg: { on: false, side: 0, t: 0, O: new THREE.Matrix4(), OL: new THREE.Matrix4(), C0: new THREE.Matrix4(), Cl: new THREE.Matrix4(), cR: null, cL: null },
      planM: new THREE.Matrix4(), actM: new THREE.Matrix4(),
    };
  }

  _buildPile() {
    const shapes = PILE_SEEDS.map((seed, k) => {
      const { geo, plate } = lumpGeometry(seed, PILE_STEP);
      const top = new TopField(geo);
      const rng = makeRng$1(seed * 3 + 1);
      const da = k * 2.1 + 1.3, ddx = Math.cos(da), ddy = Math.sin(da);
      const uni = {
        uXray: { value: 0 }, uScan: { value: -0.4 }, uGlow: { value: 0 }, uMask: { value: null }, uFlake: { value: null },
        uIns: this.items[k % this.items.length].uni.uIns,
        uGearN: { value: 60 }, uSpokes: { value: 0 }, uGearR: { value: 0.16 },
        uSweep: { value: -9 }, uDrift: { value: new THREE.Vector3(ddx, ddy, -top.extent(ddx, ddy) * 0.25) }, uSandCol: { value: new THREE.Vector3(0.6, 0.55, 0.44) },
        uPlate: { value: new THREE.Vector3(plate.x, plate.y, plate.a) }, uPlateR: { value: new THREE.Vector2(plate.hx, plate.hy) },
        uBreak: { value: new THREE.Vector2(rng() * Math.PI * 2, 0.5 + rng() * 0.35) }, uTimeX: U.uTime, uPatina: { value: 1 },
      };
      const mask = new DirtMask(geo, null, 900 + k * 17);
      const corner = top.corner(-ddx, -ddy, rng, new THREE.Vector3());
      for (let j = 0; j < 6; j++) mask.stroke(toU(corner.x * 0.8), toV(corner.y * 0.8), 0, 0, false, 0.24, 1, 1);
      for (let j = 0; j < 6; j++) mask.stroke(toU(plate.x), toV(plate.y), 0, 0, false, 0.2, 1, 1);
      mask.progress = mask.siltProgress = 0;
      mask.pops.length = 0;
      uni.uMask.value = mask.tex;
      uni.uFlake.value = mask.flakeTex;
      const bb = geo.boundingBox;
      return { geo, mat: lumpMaterial(uni), half: [(bb.max.x - bb.min.x) / 2, (bb.max.y - bb.min.y) / 2, (bb.max.z - bb.min.z) / 2] };
    });
    this.pile = PILE.map((d, k) => {
      const sh = shapes[d[0]], mesh = new THREE.Mesh(sh.geo, sh.mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.renderOrder = 3;
      mesh.visible = false;
      this.scene.add(mesh);
      const s = LUMP_S * d[1];
      return { mesh, s, flat: d[6], g: 1, to: 1, r: sh.half[0] * s, h: sh.half[2] * s * d[6], p: new THREE.Vector3(), q: new THREE.Quaternion(), verts: sh.geo.attributes.position.array, foot: new THREE.Vector3() };
    });
    this.pileTop = 0;
    this._pileOut = PILE.map(() => ({ p: new THREE.Vector3(), q: new THREE.Quaternion(), r: 0 }));
    const V = varyRng(0x9175);
    this._pileVar = PILE.map((d, k) => {
      const m = k === 0 ? 0.03 : 0.05;
      return { dx: (V() - 0.5) * 2 * m, dz: (V() - 0.5) * 2 * m, spin: (V() - 0.5) * (k === 6 ? 1.0 : 0.6), tip: 0.8 + 0.4 * V() };
    });
  }

  placePile(site) {
    const c = Math.cos(site.yaw), sn = Math.sin(site.yaw), mx = site.lay === 'L' ? -1 : 1, P = site.pile;
    const HB = 1.2, SC = 0.04, TC = 0.015, NS = Math.ceil((2 * HB) / SC) + 2, NT = Math.ceil((2 * HB) / TC) + 1;
    const x0 = P.x - HB, z0 = P.z - HB, DEG = Math.PI / 180;
    const sand = this._pileSand || (this._pileSand = new Float32Array(NS * NS));
    for (let i = 0; i < NS; i++) for (let j = 0; j < NS; j++) sand[i * NS + j] = floorHeight(x0 + i * SC, z0 + j * SC);
    const sandAt = (x, z) => {
      const fx = clamp$9((x - x0) / SC, 0, NS - 1.001), fz = clamp$9((z - z0) / SC, 0, NS - 1.001), i = Math.floor(fx), j = Math.floor(fz), u = fx - i, w = fz - j, o = i * NS + j;
      return (sand[o] * (1 - u) + sand[o + NS] * u) * (1 - w) + (sand[o + 1] * (1 - u) + sand[o + NS + 1] * u) * w;
    };
    const tops = this._pileTops || (this._pileTops = new Float32Array(NT * NT));
    tops.fill(-Infinity);
    const cellT = (x, z) => { const i = Math.floor((x - x0) / TC), j = Math.floor((z - z0) / TC); return i < 0 || j < 0 || i >= NT || j >= NT ? -1 : i * NT + j; };
    const UC = 0.03, NU = 26, und = this._pileUnd || (this._pileUnd = new Float32Array(NU * NU));
    let top = -Infinity;
    for (const k of PILE_ORDER) {
      const d = PILE[k], L = this.pile[k], F = PILE_FREE[k], pv = this._pileVar[k], ax = (d[2] + pv.dx) * mx, az = d[3] + pv.dz;
      const bx = P.x + c * ax + sn * az, bz = P.z - sn * ax + c * az, ol = Math.hypot(ax, az);
      const inx = ol > 0.1 ? (P.x - bx) / ol : 1, inz = ol > 0.1 ? (P.z - bz) / ol : 0;
      const se = 0.25;
      _n.set(floorHeight(bx - se, bz) - floorHeight(bx + se, bz), 2 * se, floorHeight(bx, bz - se) - floorHeight(bx, bz + se)).normalize();
      const spin = k * 2.39 + 0.7 + pv.spin;
      if (ol > 0.1) _a.set(az / ol, 0, -ax / ol); else _a.set(Math.cos(spin), 0, Math.sin(spin));
      const V = L.verts, s = L.s, sf = L.s * L.flat, sink = 0.65 * L.h;
      const R = { cx: 0, cy: 0, cz: 0, cS: 0, cP: 0, cost: 0 };
      _b.set(-_a.z, 0, _a.x);
      const pose = (tip, slide, stride, tip2 = 0, side = 0, score = true) => {
        _plq.setFromEuler(_eu.set(-Math.PI / 2, spin, 0, 'YXZ')).premultiply(_q2$1.setFromAxisAngle(_a, tip * DEG));
        if (tip2) _plq.premultiply(_q2$1.setFromAxisAngle(_b, tip2 * DEG));
        _plq.premultiply(_q$1.setFromAxisAngle(Y, site.yaw)).premultiply(_qi.setFromUnitVectors(Y, _n));
        const e = _pm.makeRotationFromQuaternion(_plq).elements;
        const m00 = e[0] * s, m10 = e[1] * s, m20 = e[2] * s, m01 = e[4] * s, m11 = e[5] * s, m21 = e[6] * s, m02 = e[8] * sf, m12 = e[9] * sf, m22 = e[10] * sf;
        const cx = bx + inx * slide - inz * side, cz = bz + inz * slide + inx * side, ux0 = cx - (NU / 2) * UC, uz0 = cz - (NU / 2) * UC;
        if (score) und.fill(Infinity);
        let cS = -Infinity, cP = -Infinity;
        for (let i = 0; i < V.length; i += 3 * stride) {
          const vx = V[i], vy = V[i + 1], vz = V[i + 2];
          const x = cx + m00 * vx + m01 * vy + m02 * vz, y = m10 * vx + m11 * vy + m12 * vz, z = cz + m20 * vx + m21 * vy + m22 * vz;
          const ys = sandAt(x, z) - sink - y;
          if (ys > cS) cS = ys;
          const t = cellT(x, z);
          if (t >= 0 && tops[t] - y > cP) cP = tops[t] - y;
          if (!score) continue;
          const ui = Math.floor((x - ux0) / UC), uj = Math.floor((z - uz0) / UC);
          if (ui >= 0 && uj >= 0 && ui < NU && uj < NU && y < und[ui * NU + uj]) und[ui * NU + uj] = y;
        }
        const cy = Math.max(cS, cP);
        R.cx = cx; R.cy = cy; R.cz = cz; R.cS = cS; R.cP = cP;
        if (!score) return 0;
        let n = 0, off = 0, gap = 0;
        for (let ui = 0; ui < NU; ui++) {
          for (let uj = 0; uj < NU; uj++) {
            const yb = und[ui * NU + uj];
            if (yb === Infinity) continue;
            const x = ux0 + (ui + 0.5) * UC, z = uz0 + (uj + 0.5) * UC, t = cellT(x, z);
            const g = cy + yb - Math.max(sandAt(x, z), t >= 0 ? tops[t] : -Infinity);
            n++;
            if (g > 0.025) off++;
            if (g > 0) gap += g;
          }
        }
        R.cost = off / Math.max(1, n) + (4 * gap) / Math.max(1, n) + 0.006 * Math.abs(tip - d[5] * pv.tip) + 0.006 * Math.abs(tip2) + 0.6 * Math.hypot(slide, side);
        return R.cost;
      };
      const TT = { lo: 0, hi: 0 };
      const touchAt = (tip, stride) => {
        let lo = F.slide[0], hi = F.slide[1];
        pose(tip, hi, stride, 0, 0, false);
        if (R.cP < R.cS - 0.004) return null;
        pose(tip, lo, stride, 0, 0, false);
        if (R.cP >= R.cS - 0.004) { TT.lo = NaN; TT.hi = lo; return TT; }
        for (let it = 0; it < 10; it++) { const mid = 0.5 * (lo + hi); pose(tip, mid, stride, 0, 0, false); if (R.cP >= R.cS - 0.004) hi = mid; else lo = mid; }
        TT.lo = lo; TT.hi = hi;
        return TT;
      };
      let bt = clamp$9(d[5] * pv.tip, F.tip[0], F.tip[1]), bs = 0, best = Infinity;
      const tryLean = (tip, stride) => {
        const T = touchAt(tip, stride);
        if (!T) return;
        const lo = T.lo, hi = T.hi;
        for (const sl of [lo, hi]) {
          if (!Number.isFinite(sl)) continue;
          const k2 = pose(tip, sl, stride);
          if (k2 < best) { best = k2; bt = tip; bs = sl; }
        }
      };
      if (F.lean) {
        for (let tip = F.tip[0]; tip <= F.tip[1] + 1e-6; tip += 3) tryLean(tip, 3);
        if (best < Infinity) {
          const t0 = bt;
          best = Infinity;
          for (let dt = -1.5; dt <= 1.5 + 1e-6; dt += 0.5) tryLean(clamp$9(t0 + dt, F.tip[0], F.tip[1]), 1);
        }
      }
      let bt2 = 0, bw = 0;
      if (F.top) {
        const T1 = F.tip, T2 = F.tip2, S1 = F.slide;
        best = Infinity;
        for (let t1 = T1[0]; t1 <= T1[1] + 1e-6; t1 += 5) for (let t2 = T2[0]; t2 <= T2[1] + 1e-6; t2 += 8) {
          for (let s1 = S1[0]; s1 <= S1[1] + 1e-6; s1 += 0.08) for (let s2 = S1[0]; s2 <= S1[1] + 1e-6; s2 += 0.08) {
            const k2 = pose(t1, s1, 3, t2, s2);
            if (k2 < best) { best = k2; bt = t1; bt2 = t2; bs = s1; bw = s2; }
          }
        }
        for (const [st1, st2, ss, stride] of [[2.5, 4, 0.04, 3], [1, 2, 0.02, 1]]) {
          const c1 = bt, c2 = bt2, c3 = bs, c4 = bw;
          for (let d1 = -1; d1 <= 1; d1++) for (let d2 = -1; d2 <= 1; d2++) for (let d3 = -1; d3 <= 1; d3++) for (let d4 = -1; d4 <= 1; d4++) {
            const t1 = clamp$9(c1 + d1 * st1, T1[0], T1[1]), t2 = clamp$9(c2 + d2 * st2, T2[0], T2[1]), s1 = clamp$9(c3 + d3 * ss, S1[0], S1[1]), s2 = clamp$9(c4 + d4 * ss, S1[0], S1[1]);
            const k2 = pose(t1, s1, stride, t2, s2);
            if (k2 < best) { best = k2; bt = t1; bt2 = t2; bs = s1; bw = s2; }
          }
          if (stride === 3) best = pose(bt, bs, 1, bt2, bw);
        }
      }
      if (best === Infinity) {
        best = pose(bt, bs, 3);
        for (let tip = F.tip[0]; tip <= F.tip[1] + 1e-6; tip += 4) {
          for (let sl = F.slide[0]; sl <= F.slide[1] + 1e-6; sl += 0.04) { const k2 = pose(tip, sl, 3); if (k2 < best) { best = k2; bt = tip; bs = sl; } }
        }
        const t0 = bt, s0 = bs;
        best = pose(bt, bs, 1);
        for (let dt = -2; dt <= 2; dt++) {
          for (let ds = -0.02; ds <= 0.02 + 1e-6; ds += 0.01) {
            const tip = clamp$9(t0 + dt, F.tip[0], F.tip[1]), sl = clamp$9(s0 + ds, F.slide[0], F.slide[1]), k2 = pose(tip, sl, 1);
            if (k2 < best) { best = k2; bt = tip; bs = sl; }
          }
        }
      }
      pose(bt, bs, 1, bt2, bw);
      L.q.copy(_plq);
      L.p.set(R.cx, R.cy, R.cz);
      L.mesh.position.copy(L.p);
      L.mesh.quaternion.copy(L.q);
      L.g = L.to = 1;
      L.mesh.scale.set(L.s, L.s, L.s * L.flat);
      L.mesh.visible = true;
      L.mesh.updateMatrixWorld(true);
      if (!this._pileW || this._pileW.length < V.length) this._pileW = new Float32Array(V.length);
      const e = L.mesh.matrixWorld.elements, W = this._pileW;
      let lo = Infinity;
      for (let i = 0; i < V.length; i += 3) {
        const vx = V[i], vy = V[i + 1], vz = V[i + 2];
        const x = (W[i] = e[0] * vx + e[4] * vy + e[8] * vz + e[12]), y = (W[i + 1] = e[1] * vx + e[5] * vy + e[9] * vz + e[13]), z = (W[i + 2] = e[2] * vx + e[6] * vy + e[10] * vz + e[14]);
        if (y > top) top = y;
        if (y < lo) { lo = y; L.foot.set(x, y, z); }
        const o = cellT(x, z);
        if (o >= 0 && y > tops[o]) tops[o] = y;
      }
      const I = L.mesh.geometry.index.array;
      for (let t = 0; t < I.length; t += 3) {
        const ia = I[t] * 3, ib = I[t + 1] * 3, ic = I[t + 2] * 3;
        const ax = W[ia], ay = W[ia + 1], az = W[ia + 2], bx = W[ib], by = W[ib + 1], bz = W[ib + 2], cx = W[ic], cy = W[ic + 1], cz = W[ic + 2];
        const den = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
        if (Math.abs(den) < 1e-12) continue;
        const i0 = Math.max(0, Math.ceil((Math.min(ax, bx, cx) - x0) / TC - 0.5)), i1 = Math.min(NT - 1, Math.floor((Math.max(ax, bx, cx) - x0) / TC - 0.5));
        const j0 = Math.max(0, Math.ceil((Math.min(az, bz, cz) - z0) / TC - 0.5)), j1 = Math.min(NT - 1, Math.floor((Math.max(az, bz, cz) - z0) / TC - 0.5));
        for (let i = i0; i <= i1; i++) {
          const px = x0 + (i + 0.5) * TC;
          for (let j = j0; j <= j1; j++) {
            const pz = z0 + (j + 0.5) * TC;
            const w1 = ((bz - cz) * (px - cx) + (cx - bx) * (pz - cz)) / den, w2 = ((cz - az) * (px - cx) + (ax - cx) * (pz - cz)) / den, w3 = 1 - w1 - w2;
            if (w1 < -1e-6 || w2 < -1e-6 || w3 < -1e-6) continue;
            const y = w1 * ay + w2 * by + w3 * cy, o = i * NT + j;
            if (y > tops[o]) tops[o] = y;
          }
        }
      }
    }
    this.pileTop = top;
  }

  pileLumps() {
    for (let k = 0; k < this.pile.length; k++) {
      const L = this.pile[k], o = this._pileOut[k];
      o.p.copy(L.p);
      o.q.copy(L.q).multiply(_q$1.setFromAxisAngle(_a.set(1, 0, 0), Math.PI / 2));
      o.r = L.r;
    }
    this._pileOut.top = this.pileTop;
    return this._pileOut;
  }

  openLump(k, left, total) {
    const L = this.pile && this.pile[k];
    if (L) L.to = total > 0 ? Math.cbrt(Math.max(0, left) / total) : 0;
  }
  pileGone() { return !this.pile || this.pile.every((L) => !L.mesh.visible); }
  hidePile() { if (this.pile) for (const L of this.pile) L.mesh.visible = false; }
  _pileTick(dt) {
    if (!this.pile) return;
    for (const L of this.pile) {
      if (!L.mesh.visible || L.g === L.to) continue;
      L.g = L.to < L.g ? Math.max(L.to, L.g - dt / 0.3) : L.to;
      if (L.g <= 0.02) { L.mesh.visible = false; continue; }
      L.mesh.scale.set(L.s * L.g, L.s * L.g, L.s * L.g * L.flat);
      L.mesh.position.copy(L.p).sub(L.foot).multiplyScalar(L.g).add(L.foot);
    }
  }

  setDiver(diver) { this.diver = diver || null; }

  get positions() { return this.items.map((it) => it.home); }

  nearestUncollected(pos) {
    let best = null, bd = Infinity;
    for (const it of this.items) {
      if (it.state !== 'buried') continue;
      const d = it.home.distanceTo(pos);
      if (d < bd) { bd = d; best = it; }
    }
    return best ? { item: best, dist: bd } : null;
  }

  cleanable(pos, range = CLEAN_RANGE, eye = null, fwd = null) {
    let best = null, bd = range;
    for (const it of this.items) {
      if (it.state !== 'buried') continue;
      const d = Math.hypot(it.home.x - pos.x, it.home.z - pos.z);
      if (d >= bd) continue;
      if (eye && fwd && _a.subVectors(it.home, eye).normalize().dot(fwd) < CLEAN_DOT) continue;
      bd = d; best = it;
    }
    return best;
  }

  pickRay(ray, range = PICK_RANGE) {
    let best = null, bd = range;
    for (const it of this.items) {
      if (it.state !== 'buried') continue;
      const along = this._p.copy(it.home).sub(ray.origin).dot(ray.direction);
      if (along < 0 || along > bd) continue;
      if (ray.distanceSqToPoint(it.home) < 0.42 * 0.42) { bd = along; best = it; }
    }
    return best;
  }

  busy() { return this.items.some((it) => it.state === 'collecting' || it.state === 'lifting'); }

  ping(origin, speed = 26) {
    this.beacon = 1;
    for (const it of this.items) {
      if (it.state !== 'buried') continue;
      it.echoAt = origin ? it.home.distanceTo(origin) / speed : 0;
      it.echoT = 0;
      it.echoed = false;
    }
  }

  beginClean(it) { it.state = 'cleaning'; it.lastT = -9; it.staged = false; it.puffT = -9; it.puffD = 0; }
  abortClean(it) { if (it.state === 'cleaning') it.state = 'buried'; }
  progress(it) { return it.mask.progress; }

  brush(it, point, normalW, strength, vel, drift = null) {
    const local = it.lump.worldToLocal(this._p.copy(point));
    const u = toU(local.x), v = toV(local.y);
    const s = clamp$9(strength, 0, 1);
    const now = U.uTime.value;
    it.mask.stroke(u, v, it.lastU, it.lastV, now - it.lastT < 0.15, 0.095 / UVX, 1.0 * s, 0.4 * s);
    it.lastU = u; it.lastV = v; it.lastT = now;
    const left = it.mask.sample(u, v);
    const leftSilt = left.silt, leftCrust = left.crust;
    const fx = this.fx, oS = this._oSilt, oG = this._oGrain, oC = this._oChip;
    const ground = it.home.y - 0.02;
    const bv = vel ? this._bv.copy(vel).clampLength(0, 1.2) : this._bv.set(0, 0, 0);
    const push = this._push.copy(normalW).multiplyScalar(0.12).addScaledVector(bv, 0.25);
    if (drift) push.addScaledVector(drift, 0.07);
    oS.push = push; oS.ground = ground; oG.ground = ground; oC.ground = ground; oG.sed = true;
    const dust = leftSilt + 0.4 * leftCrust;
    {
      const k = Math.max(0.35, Math.min(1, dust)) * s;
      it.puffD += bv.length() / 42;
      if (s > 0.2 && now - it.puffT > 0.16 && (it.puffD > 0.035 || now - it.puffT > 0.3)) {
        it.puffT = now; it.puffD = 0;
        _bo.copy(bv).setY(0);
        if (_bo.lengthSq() < 0.0025) _bo.subVectors(point, it.home).setY(0);
        if (_bo.lengthSq() > 1e-8) _bo.normalize(); else _bo.set(1, 0, 0);
        _a.copy(point).addScaledVector(_bo, 0.12).sub(it.lump.position).applyQuaternion(_q$1.copy(it.lump.quaternion).invert());
        const ra = Math.atan2(_a.y, _a.x), re = it.top.extent(Math.cos(ra), Math.sin(ra)) || 0.16;
        it.lump.localToWorld(_b.set(Math.cos(ra) * re, Math.sin(ra) * re, 0));
        _c.subVectors(_b, it.lump.position).setY(0);
        if (_c.lengthSq() > 1e-8) _c.normalize(); else _c.copy(_bo);
        _d.set(-_c.z, 0, _c.x);
        const pal = leftSilt > 0.04 ? SAND_PAL : CRUST_DUST$1;
        oG.ground = this._ground()(_b.x + _c.x * 0.05, _b.z + _c.z * 0.05) - 0.002;
        oG.palette = pal; oG.spread = 0.03; oG.up = 0.09; oG.scatter = 0.55;
        oG.push = this._v.copy(_bo).multiplyScalar(0.16 + 0.2 * Math.min(1, bv.length())).addScaledVector(normalW, 0.05);
        fx.grains(point, Math.round(16 + 22 * k), oG);
        oG.size = 0.0021; fx.grains(point, 2 + Math.round(3 * k), oG);
        oG.size = 0; oG.scatter = 1; oG.ground = ground;
        oS.spread = 0.03; oS.color = it.cloudCol; oS.up = 0.0; oS.life = 1.8; oS.size = 0.03 + 0.018 * k; oS.cloud = true;
        for (let j = 0, nb = 2 + Math.round(2 * k); j < nb; j++) {
          _e$1.copy(_b).addScaledVector(_d, (Math.random() - 0.5) * 0.14).addScaledVector(_c, 0.02 + 0.03 * Math.random());
          const bed = this._ground()(_e$1.x, _e$1.z);
          _e$1.y = bed + 0.006;
          oS.ground = bed - 0.004;
          oS.push = this._v.copy(_c).multiplyScalar(0.12 + 0.08 * Math.random()).addScaledVector(_bo, 0.05).addScaledVector(_d, (Math.random() - 0.5) * 0.1);
          if (drift) oS.push.addScaledVector(drift, 0.05);
          fx.silt(_e$1, 1, oS);
        }
        oS.cloud = false; oS.ground = ground;
      }
    }
    if (leftSilt > 0.04 && Math.random() < 0.35) {
      oG.spread = 0.03; oG.push = this._v.copy(bv).multiplyScalar(0.3); oG.up = 0.08; oG.palette = SAND_PAL; oG.scatter = 0.6;
      fx.grains(point, 2 + Math.floor(4 * leftSilt * s), oG);
      oG.scatter = 1;
    }
    if (leftCrust > 0.08 && leftSilt < 0.55 && Math.random() < 0.3) {
      oG.spread = 0.015; oG.push = bv; oG.up = 0.08; oG.palette = CRUST_DUST$1;
      fx.grains(point, 1 + Math.floor(Math.random() * 2), oG);
    }
    const pops = it.mask.pops;
    for (let k = 0; k < pops.length; k++) this._flake(it, pops[k], normalW, bv);
    pops.length = 0;
    if (leftCrust < 0.2 && Math.random() < 0.03 * s) { oG.spread = 0.015; oG.push = bv; oG.up = 0.06; oG.palette = PATINA_DUST; fx.grains(point, 3, oG); }
    oG.sed = false;
    return it.mask.progress;
  }

  _flake(it, i, nW, bv) {
    it.mask.seedLocal(i, this._p2);
    const z = it.top.at(this._p2.x, this._p2.y);
    if (z < -8) return;
    this._p2.z = z;
    it.lump.localToWorld(this._p2);
    const fx = this.fx, oG = this._oGrain, ground = it.home.y - 0.02, r = Math.random();
    const size = 0.004 + r * r * 0.012;
    if (size > 0.0065 || Math.random() < 0.45) {
      const v = this._v.copy(nW).multiplyScalar(0.08 + Math.random() * 0.14).addScaledVector(bv, 0.35);
      v.x += (Math.random() - 0.5) * 0.12;
      v.z += (Math.random() - 0.5) * 0.12;
      const cs = 0.0012 + r * r * 0.0013;
      fx.chunk(this._p.copy(this._p2).addScaledVector(nW, cs * 0.6), v, cs, CRUST_DUST$1[Math.floor(Math.random() * 3)], ground);
    }
    oG.spread = 0.012; oG.push = bv; oG.up = 0.04; oG.ground = ground; oG.palette = CRUST_DUST$1;
    fx.grains(this._p2, 2 + Math.floor(Math.random() * 3), oG);
    const now = U.uTime.value;
    if (this.cb.crack && now - (this._crackT || 0) > 0.07) { this._crackT = now; this.cb.crack(0.3 + size * 45); }
  }

  finishClean(it) {
    it.state = 'lifting';
    it.t = 0;
    it.uncovered = it.tugged = it.scanStarted = it.revealed = it.released = false;
    it.lastTick = 0;
    it.hands.on = false;
    it.homeP.copy(it.lump.position);
    it.homeQ.copy(it.lump.quaternion);
    (it.pourP || (it.pourP = new THREE.Vector3())).copy(it.lump.position);
    (it.pourV || (it.pourV = new THREE.Vector3())).set(0, 0, 0);
    if (it.streams) it.streams.length = 0;
    it.handT0 = undefined;
    it.handT = 0; it.handDur = 0.45; it.gripped = false; it.gripT = 0; it.gapPrev = 9; it.seatW = 0;
    if (it.helmOff) { it.helmOff.set(0, 0, 0); it.helmV.set(0, 0, 0); }
  }

  beginCloseup(it, { camera, diver = null, player = null, env = null, fovBase = 60 } = {}) {
    const cu = this.cu;
    cu.active = true;
    cu.it = it;
    cu.camera = camera;
    cu.diver = diver || this.diver;
    if (cu.diver && !cu.diver.reach) cu.diver = null;
    cu.player = player;
    cu.env = env;
    cu.fovBase = fovBase;
    cu.plan = cu.diver && typeof cu.diver.setTether === 'function' ? STAGES$1.kneel : STAGES$1.prone;
    this.beginClean(it);
    it.staged = true;
    if (cu.diver && this._helmOf !== cu.diver) this._helmGap(it, cu.diver, _hn);
    it.pace = this.collected === 0 ? PACE_FULL : PACE_QUICK;
    it.glintMat.opacity = 0;
    it.beamU.uAlpha.value = 0;
    it.ringU.uAlpha.value = 0;
    it.uni.uGlow.value = 0;
    const from = cu.diver ? cu.diver.group.position : camera.position;
    _s$2.subVectors(from, it.home).setY(0);
    if (_s$2.lengthSq() < 1e-4) _s$2.subVectors(camera.position, it.home).setY(0);
    if (_s$2.lengthSq() < 1e-4) _s$2.set(0, 0, 1);
    _s$2.normalize();
    const fl = floorHeight(it.home.x, it.home.z);
    let best = null;
    for (const off of STAGE_OFFS) {
      const cand = best === cu.st ? cu.st2 : cu.st;
      this._stage(it, _d.copy(_s$2).applyAxisAngle(Y, off), fl, cand);
      if (!best || cand.bad < best.bad) best = cand;
      if (best.bad === 0) break;
    }
    if (best !== cu.st) { const t = cu.st; cu.st = best; cu.st2 = t; }
    const st = cu.st;
    if (cu.diver) { cu.S0.copy(cu.diver.group.position); cu.q0.copy(cu.diver.group.quaternion); } else { cu.S0.copy(st.S); cu.q0.identity(); }
    cu.qS.setFromEuler(_eu.set(cu.plan.pitch, st.yaw, 0, 'YXZ'));
    cu.qS2.setFromEuler(_eu.set(cu.plan.pitch2, st.yaw, 0, 'YXZ'));
    cu.dPos.copy(cu.S0);
    cu.dPrev.copy(cu.S0);
    cu.dQ.copy(cu.q0);
    cu.lean.set(0, 0, 0); cu.leanV.set(0, 0, 0); cu.pickV = 0;
    cu.arcH = 0.15 * sstep$7(1.0, 3.0, cu.S0.distanceTo(st.S));
    cu.cinePos.copy(camera.position);
    cu.cineQ.copy(camera.quaternion);
    _a.set(0, 0, -1).applyQuaternion(camera.quaternion);
    cu.aim0.copy(camera.position).addScaledVector(_a, Math.max(0.5, camera.position.distanceTo(it.home)));
    lookQ$1(camera.position, cu.aim0, _q$1);
    cu.qFix.copy(camera.quaternion).multiply(_q$1.invert());
    const Ce = cu.plan.walk ? st.Cw : st.Cb;
    const camD = camera.position.distanceTo(Ce), divD = cu.S0.distanceTo(st.S);
    _a.addVectors(camera.position, Ce).multiplyScalar(0.5);
    _b.subVectors(_a, it.home).setY(0);
    cu.ctrl.copy(_a).addScaledVector(st.r, Math.max(0, 1.1 - _b.dot(st.r))).addScaledVector(Y, 0.35);
    const arcL = camera.position.distanceTo(cu.ctrl) + cu.ctrl.distanceTo(Ce);
    cu.walkDur = cu.plan.walk && divD > 0.04 ? clamp$9(divD / 0.8, 0.6, 2.8) : 0;
    _a.subVectors(camera.position, st.S);
    cu.orbA0 = Math.atan2(_a.x, _a.z);
    cu.orbR0 = Math.hypot(_a.x, _a.z);
    _a.subVectors(Ce, st.S);
    const rE = Math.max(2.3, Math.hypot(_a.x, _a.z));
    let dA = Math.atan2(_a.x, _a.z) - cu.orbA0;
    dA -= 2 * Math.PI * Math.round(dA / (2 * Math.PI));
    cu.orbDA = dA;
    const orbL = cu.plan.walk ? Math.hypot(Math.abs(dA) * 0.5 * (cu.orbR0 + rE), cu.orbR0 - rE) : 0;
    cu.downT = -1;
    cu.riseT = -1;
    cu.back = 0;
    cu.blend = cu.plan.walk ? clamp$9(Math.max(cu.walkDur + 0.85, 0.4 * orbL), 1.45, 4.2)
      : Math.max(clamp$9(0.6 + camD / 8, 0.8, 1.5), clamp$9(divD / 2.2, 0, 2.6), 0.6 + arcL / 3.0);
    _a.copy(st.d).applyQuaternion(_q$1.copy(it.lump.quaternion).invert());
    const l = Math.hypot(_a.x, _a.y) || 1;
    cu.dLx = _a.x / l; cu.dLy = _a.y / l;
    this._pickStart(it, cu.bStartL);
    cu.lastL.copy(cu.bStartL);
    cu.tl.copy(cu.bStartL);
    cu.tipInit = false;
    cu.gripInit = false; cu.gqInit = false;
    cu.onLump = true; cu.contact = false; cu.lifted = 0; cu.scrubbing = false; cu.scrub = 0; cu.wig = 0; cu.dabAcc = 0; cu.brushT = 0;
    cu.tipErr = 9; cu.brushReady = false; cu.readyT = 0;
    cu.outT = 0; cu.outR = 0;
    cu.auto.on = false; cu.auto.region = 0;
    cu.brushGone = false; cu.carrying = false; cu.drawn = false;
    cu.pivQ.identity(); cu.slide = 0; setHold(cu.pivQ, 0); cu.tipFix.set(0, 0, 0);
    cu.t = 0;
    cu.phase = 'in';
    cu.canSteer = false;
    const T = this.tool;
    T.group.visible = !cu.diver;
    T.press = 0;
    T.dirt.value = 0;
    T.bendS.set(0, 0, 0); T.bendV.set(0, 0, 0);
  }

  _stage(it, d, fl, o) {
    const pl = this.cu.plan, h = it.home;
    o.yaw = Math.atan2(d.x, d.z);
    o.d.copy(d);
    o.f.copy(d).negate();
    o.r.set(Math.cos(o.yaw), 0, -Math.sin(o.yaw));
    o.S.copy(h).addScaledVector(d, pl.dist).addScaledVector(o.r, -pl.side);
    const fS = Math.max(fl, floorHeight(o.S.x, o.S.z));
    o.S.y = fS + pl.h;
    o.S2.copy(o.S);
    o.S2.y = fS + pl.h2;
    const kn = pl.walk ? 1 : 0, up = kn * Math.min(0.3, fS - fl);
    o.Cb.copy(h).addScaledVector(d, -0.34 - 1.0 * kn).addScaledVector(o.r, 0.8 + 0.42 * kn);
    o.Cb.y = fl + 0.44 + 0.33 * kn + up;
    o.Tb.copy(h).addScaledVector(d, 0.14 + 0.16 * kn);
    o.Tb.y = fl + 0.08 + 0.38 * kn + 0.5 * up;
    o.Cw.copy(o.Cb); o.Tw.copy(o.Tb);
    if (kn) {
      o.Cb.copy(h).addScaledVector(d, -0.56).addScaledVector(o.r, 0.36);
      o.Cb.y = fl + 0.6;
      o.Tb.copy(h).addScaledVector(d, 0.03);
      o.Tb.y = h.y + 0.035;
    }
    const cp = Math.cos(pl.pitch2), sp = Math.sin(pl.pitch2), hd = pl.head;
    const hy = hd[1] * cp - hd[2] * sp, hz = hd[1] * sp + hd[2] * cp;
    o.head2.copy(o.S2).addScaledVector(Y, hy).addScaledVector(d, hz).addScaledVector(o.r, hd[0]);
    o.Pp.copy(o.head2).addScaledVector(o.f, pl.hold[0]);
    o.Pp.y -= pl.hold[1];
    o.Cx.copy(o.Pp).addScaledVector(o.f, 0.6).addScaledVector(o.r, 0.62);
    o.Cx.y += 0.06;
    o.Tx.copy(o.Pp).lerp(o.head2, 0.22);
    let bad = 0;
    const P = this.cu.player, env = this.cu.env;
    if (P && P._blocked && env) {
      if (P._blocked(o.Cb.x, o.Cb.y, o.Cb.z, env, 0.22, 0.2)) bad += 2;
      if (P._blocked(o.Cx.x, o.Cx.y, o.Cx.z, env, 0.22, 0.2)) bad += 2;
      for (let k = 0; k < 5; k++) {
        _e$1.copy(o.S).addScaledVector(o.f, 0.55 - k * 0.38);
        if (P._blocked(_e$1.x, _e$1.y, _e$1.z, env, 0.16, -2)) bad++;
      }
    }
    o.bad = bad;
    return o;
  }

  _pickStart(it, out) {
    let best = -1;
    for (let k = 0; k < 10; k++) {
      let x = 0, y = 0, z = -9;
      for (let tries = 0; tries < 8 && z < -8; tries++) { x = (Math.random() * 2 - 1) * 0.2; y = (Math.random() * 2 - 1) * 0.15; z = it.top.at(x, y); }
      if (z < -8) continue;
      const dd = it.mask.dirt(toU(x), toV(y)) + Math.random() * 0.05;
      if (dd > best) { best = dd; out.set(x, y, z); }
    }
    if (best < 0) out.set(0, 0, Math.max(0, it.top.at(0, 0)));
    return out;
  }

  canSteer() { return this.cu.active && this.cu.canSteer; }
  onStone(ndc) {
    const cu = this.cu, it = cu.it;
    if (!cu.active || !cu.camera || !it || it.state !== 'cleaning' || !Number.isFinite(ndc.x) || !Number.isFinite(ndc.y)) return false;
    this._rc.setFromCamera(ndc, cu.camera);
    _m2.copy(it.lump.matrixWorld).invert();
    _a.copy(this._rc.ray.origin).applyMatrix4(_m2);
    _b.copy(this._rc.ray.direction).transformDirection(_m2);
    return it.top.march(_a, _b, _c);
  }
  syncNdc(ndc) {
    const cu = this.cu;
    if (!cu.active || !cu.camera) return;
    _a.copy(cu.tip).project(cu.camera);
    ndc.set(_a.x, _a.y);
  }
  closeupExit() { return this.cu.exit; }
  _fillExit() {
    const cu = this.cu, E = cu.exit;
    E.pos.copy(cu.dPos);
    _eu.setFromQuaternion(cu.dQ, 'YXZ');
    E.yaw = _eu.y;
    E.bodyPitch = _eu.x;
    E.pitch = -0.28;
  }
  abortCloseup() {
    const cu = this.cu;
    if (!cu.active) return;
    this.abortClean(cu.it);
    this.tool.group.visible = false;
    if (cu.diver) { cu.diver.hold('right', false); cu.diver.reach('right', null, 0); }
    this._fillExit();
    cu.active = false;
  }

  updateCloseup(dt, t, inp) {
    const cu = this.cu, o = cu.out;
    o.release = false;
    o.uncovered = false;
    o.brush = 0;
    if (!cu.active) return o;
    const it = cu.it;
    cu.t += dt;
    cu.dt = dt;
    const b = cu.phase === 'in' ? easeInOut(clamp$9(cu.t / cu.blend, 0, 1)) : 1;
    it.mask.update();
    cu.away.subVectors(it.home, cu.camera.position).setY(0);
    if (cu.away.lengthSq() > 1e-6) cu.away.normalize();
    if (it.state === 'lifting' || it.state === 'collecting') this._itemStep(it, dt, t);
    this._slump(it, dt);
    this._stageDiver(dt, t);
    if (cu.plan.walk && !cu.canSteer && it.state === 'cleaning' && this._ready(b) > 0.7) cu.canSteer = true;
    if (it.state === 'cleaning') { this._brushInput(dt, inp); this._gripTarget(dt); } else this._brushAway(dt);
    this._closeupHands(b);
    if (cu.diver) { cu.diver.update(dt, t, cu.dOpts); cu.diver.setFade(1); }
    if (it.state === 'lifting' || it.state === 'collecting') {
      if (it.rg.on && cu.diver) {
        this._rigid(it, cu.diver);
        if (!it.rg.side && !it.rg.refit && it.state === 'collecting' && it.t > 0.12 && !it.released) { it.rg.refit = true; this._rigRefit(it, cu.diver); }
      } else {
        this._seat(it, cu.diver);
        if (cu.diver && it.hands.on && !(it.stowS && it.stowS.let)) this._helmFinal(it, cu.diver);
        if (this._rigReady(it, cu.diver)) this._rigCapture(it, cu.diver);
      }
    }
    if (it.stowS && it.released && cu.diver && (it.state === 'collecting' || it.state === 'done')) {
      if (it.stowS.let) this._inBag(it, cu.diver, dt);
      if (cu.diver.bagFind && it.stowS.phase === 'way') {
        it.lump.updateMatrixWorld();
        if (it.stowS.let || it.stowS.s >= it.stowS.sWb) cu.diver.bagFind(it.lump.matrixWorld, it.netH, 1, it.stowS.let ? sstep$7(0, BAG_BACK, it.stowS.rideT) : 0); else cu.diver.bagFind(null);
      }
    }
    if ((it.state === 'lifting' || it.state === 'collecting') && it.hands.on && !it.rg.on && !(it.state === 'lifting' && cu.plan.walk) && cu.diver && cu.diver.refit) {
      it.lump.updateMatrixWorld();
      it.touchInv.copy(it.lump.matrixWorld).invert();
      cu.diver.refit();
    }
    for (const x of this.items) if (x.riding) this._ride(x, cu.camera, cu.diver, dt);
    this._placeBrush(dt);
    if (it.state === 'cleaning') {
      if (!cu.brushReady && this._ready(b) > 0.7) {
        const held = !cu.diver || (cu.drawn && this.tool.group.visible && cu.diver.reachInfo('right').weight > 0.9);
        cu.readyT = held ? cu.readyT + dt : 0;
        if (held && (!cu.diver || cu.tipErr < 0.02 + 0.04 * sstep$7(0.8, 1.8, cu.readyT) || cu.readyT > 2)) cu.brushReady = true;
      }
      const on = cu.scrubbing && cu.brushReady && (cu.plan.walk || cu.phase !== 'in' || cu.t > cu.blend * 0.8) && this._ready(b) > 0.7;
      cu.scrub += ((on ? 1 : 0) - cu.scrub) * (1 - Math.exp(-dt * 12));
      if (on) {
        const sp = clamp$9(cu.tipV.length() / 0.5, 0, 1), strength = cu.pressing ? 0.55 + 0.45 * sp : 0.17 + 0.13 * sp;
        cu.dabAcc += dt * 42;
        while (cu.dabAcc >= 1) { cu.dabAcc -= 1; this.brush(it, cu.tip, cu.tipN, strength * (inp.auto ? 1.15 : 1), cu.tipV, cu.away); }
        o.brush = strength * cu.scrub;
      } else cu.dabAcc = 0;
    }
    this._camera(dt, t);
    {
      const working = it.state === 'cleaning' && cu.scrub > 0.5 && cu.onLump, pr = it.mask.progress;
      const go = it.state !== 'cleaning' || ((working || pr >= CLEAN_TARGET) && pr >= CLEAN_TARGET * 0.94 && (!cu.plan.walk || cu.phase !== 'in'));
      cu.outR += ((go ? 1 : 0) - cu.outR) * (1 - Math.exp(-dt * 5));
      if (go || cu.outT > 0) cu.outT += dt * cu.outR;
    }
    if (cu.diver) {
      cu.diver.anchors.head.getWorldPosition(o.torchPos).addScaledVector(Y, 0.07).addScaledVector(cu.st.f, 0.06);
    } else o.torchPos.copy(o.camPos).addScaledVector(cu.st.r, 0.2);
    if (it.state === 'cleaning') o.torchAim.copy(cu.tip); else o.torchAim.copy(it.lump.position);
    this.torchPose.active = true;
    this.torchPose.pos.copy(o.torchPos);
    this.torchPose.aim.copy(o.torchAim);
    if (it.state === 'cleaning') {
      const working = cu.scrub > 0.5 && cu.onLump;
      if (working) cu.brushT += dt;
      if (working && (it.mask.progress >= CLEAN_TARGET * 0.75 || cu.brushT > 4)) it.mask.progress = Math.min(CLEAN_TARGET, it.mask.progress + dt * CLEAN_TARGET * 0.1);
      if (it.mask.progress >= CLEAN_TARGET && (!cu.plan.walk || cu.outT >= 0.3)) { this.finishClean(it); o.uncovered = true; }
    }
    o.progress = it.mask.progress;
    const back = !cu.plan.walk ? it.released : it.stowS && it.released ? it.state === 'done' && cu.riseT >= cu.plan.rise : cu.riseT >= cu.plan.rise;
    if (back && cu.active) {
      if (it.stowS && it.released && cu.diver) this._rideOn(it, cu.diver);
      this._fillExit(); cu.active = false; o.release = true;
    }
    return o;
  }

  _stageDiver(dt) {
    const cu = this.cu, st = cu.st, it = cu.it, dv = cu.diver, P = it.pace, pl = cu.plan;
    if (pl.walk) {
      const u = cu.walkDur > 0 ? clamp$9(cu.t / cu.walkDur, 0, 1) : 1, k = u * u * (3 - 2 * u), fl = this._ground();
      cu.dPos.lerpVectors(cu.S0, st.S, k);
      cu.dPos.y = fl(cu.dPos.x, cu.dPos.z) + pl.h + (cu.S0.y - fl(cu.S0.x, cu.S0.z) - pl.h) * (1 - k);
      const pk = it.state === 'lifting' && it.hands.on ? sstep$7(0, 0.5, it.handT) * (1 - sstep$7(P.rev + P.tug, P.rev + P.tug + 0.8 * P.rise, it.t)) : 0;
      { const h = Math.min(dt, 1 / 30); cu.pickV += (81 * (pk - cu.pickK) - 18 * cu.pickV) * h; cu.pickK += cu.pickV * h; }
      if (cu.pickK > 1e-4) {
        _a.subVectors(it.home, st.S).setY(0);
        const lat = _a.dot(st.r);
        _a.addScaledVector(st.r, -lat).multiplyScalar(PICK_IN).addScaledVector(st.r, lat);
        cu.dPos.addScaledVector(_a, cu.pickK);
      }
      _a.set(0, 0, 0);
      if (it.state === 'cleaning' && cu.downT >= 0) _a.subVectors(cu.tip, st.S).setY(0).multiplyScalar(BRUSH_IN * this._ready(1));
      spring3(cu.lean, cu.leanV, _a, 4.5, dt);
      cu.dPos.add(cu.lean);
      cu.dQ.slerpQuaternions(cu.q0, cu.qS, sstep$7(0, 0.8, u));
      if (u >= 1 && cu.downT < 0) { cu.downT = 0; cu.kneeT = -1; }
      else if (cu.downT >= 0) cu.downT += dt;
      if (cu.kneeT >= 0) cu.kneeT += dt; else if (cu.downT > 2.4) { cu.kneeT = 0; if (this.cb.kneel) this.cb.kneel(); }
      if (cu.riseT >= 0) cu.riseT += dt;
      if (dv && !this._knee && typeof dv.onStep === 'function') {
        this._knee = dv.onStep((side, p, k) => { const c = this.cu; if (c.active && c.downT >= 0 && c.kneeT < 0 && side === 'right' && k > 0.5) { c.kneeT = 0; if (this.cb.kneel) this.cb.kneel(); } });
      }
    } else if (cu.phase === 'in') {
      const k = easeInOut(clamp$9(cu.t / (cu.blend * 0.95), 0, 1));
      cu.dPos.lerpVectors(cu.S0, st.S, k);
      cu.dPos.y += cu.arcH * Math.sin(Math.PI * k);
      cu.dQ.slerpQuaternions(cu.q0, cu.qS, k);
    } else if (it.state === 'cleaning') {
      _a.subVectors(cu.tip, it.home).setY(0).multiplyScalar(0.4);
      cu.lean.lerp(_a, 1 - Math.exp(-dt * 3));
      cu.dPos.copy(st.S).add(cu.lean);
      cu.dQ.copy(cu.qS);
    } else {
      const u = it.state === 'lifting' ? clamp$9((it.t - P.rev) / (P.tug + P.rise), 0, 1) : 1;
      const k = easeInOut(u);
      cu.dPos.copy(st.S).add(cu.lean).lerp(st.S2, k);
      cu.dQ.slerpQuaternions(cu.qS, cu.qS2, k);
    }
    if (!dv) return;
    dv.group.position.copy(cu.dPos);
    dv.group.quaternion.copy(cu.dQ);
    const sp = cu.dPos.distanceTo(cu.dPrev) / Math.max(dt, 1e-3);
    cu.dPrev.copy(cu.dPos);
    const O = cu.dOpts;
    O.speed = sp;
    O.thrust = clamp$9(sp / 1.6, 0, 1);
    if (pl.walk) {
      O.pose = cu.riseT >= 0 ? 'stand' : cu.downT >= 0 ? 'kneel' : sp > 0.05 ? 'walk' : 'stand';
      O.floor = this._ground();
      O.grounded = true;
      O.effort = it.state === 'lifting' && it.t > P.rev ? 0.85 : it.state === 'cleaning' ? 0.35 : 0.45;
      const tH = P.scan + P.count + P.hold;
      O.face = it.state === 'lifting' ? sstep$7(P.rev + 0.5 * P.tug, P.rev + P.tug + 0.8 * P.rise, it.t)
        : it.state === 'collecting' ? 1 - sstep$7(tH, tH + 0.5 * (it.stowD || P.stow), it.t) : 0;
      O.bow = it.state === 'lifting' ? lerp$3(BOW_BRUSH, BOW, sstep$7(0, 0.5, it.handT)) * (1 - sstep$7(P.rev + P.tug, P.rev + P.tug + 0.7 * P.rise, it.t)) : it.state === 'cleaning' ? BOW_BRUSH : 0;
    } else {
      O.pose = sp > 0.45 ? 'swim' : pl.pose;
      O.floor = O.grounded = O.effort = undefined;
      O.face = 0;
    }
    _b.copy(it.state !== 'cleaning' ? it.lump.position : !pl.walk || cu.downT > 0.25 ? cu.tip : it.home);
    if (it.state !== 'cleaning' && it.helmOff && it.hands.on) _b.sub(it.helmOff);
    if (it.state !== 'cleaning' && it.hands.on && pl.walk) _b.y += HOLD_LOOK_UP * (O.face || 0);
    dv.anchors.head.getWorldPosition(_c);
    cu.back += ((it.state === 'done' ? 1 : 0) - cu.back) * (1 - Math.exp(-dt * 2.5));
    if (cu.back > 1e-3) _b.lerp(_e$1.copy(_c).addScaledVector(st.f, 2).addScaledVector(Y, -0.4), cu.back);
    O.lookDir.subVectors(_b, _c).normalize();
    const hz = Math.hypot(O.lookDir.x, O.lookDir.z);
    if (pl.walk && hz > 1e-4 && O.lookDir.y < -0.77) O.lookDir.set((O.lookDir.x * 0.64) / hz, -0.77, (O.lookDir.z * 0.64) / hz);
  }
  _ground() { return (this.cu.env && this.cu.env.floor) || floorHeight; }

  _screenBox(it, cam) {
    const bb = it.lump.geometry.boundingBox, B = this.cu.box;
    B.x0 = B.y0 = 9; B.x1 = B.y1 = -9;
    for (let k = 0; k < 8; k++) {
      _a.set(k & 1 ? bb.max.x : bb.min.x, k & 2 ? bb.max.y : bb.min.y, k & 4 ? bb.max.z * 0.5 : bb.min.z * 0.2);
      it.lump.localToWorld(_a).project(cam);
      B.x0 = Math.min(B.x0, _a.x); B.x1 = Math.max(B.x1, _a.x);
      B.y0 = Math.min(B.y0, _a.y); B.y1 = Math.max(B.y1, _a.y);
    }
  }

  _brushInput(dt, inp) {
    const cu = this.cu, it = cu.it, cam = cu.camera, top = it.top, lump = it.lump, fing = !!inp.touch;
    let lifted = 0, scrub = false;
    cu.onLump = true;
    let far = false;
    if (inp.auto) {
      scrub = this._autoStroke(dt, it);
      lifted = cu.auto.lift;
      cu.pressing = true;
    } else {
      cu.auto.on = false;
      if (cu.phase === 'in' && !(cu.plan.walk && cu.canSteer)) {
        cu.tl.copy(cu.bStartL);
        lump.localToWorld(_a.copy(cu.bStartL)).project(cam);
        inp.ndc.set(_a.x, _a.y);
      } else if (fing && cu.hold && inp.ndc.x === cu.hold.x && inp.ndc.y === cu.hold.y) {
        lifted = cu.lifted;
        cu.onLump = cu.hold.on;
        far = cu.hold.far;
      } else {
        if (!Number.isFinite(inp.ndc.x) || !Number.isFinite(inp.ndc.y)) { _a.copy(cu.tip).project(cam); inp.ndc.set(_a.x, _a.y); }
        this._screenBox(it, cam);
        const mB = fing ? 0.03 : 0.12;
        const B = cu.box, mx = (B.x1 - B.x0) * mB, my = (B.y1 - B.y0) * mB;
        far = inp.ndc.x < B.x0 - mx || inp.ndc.x > B.x1 + mx || inp.ndc.y < B.y0 - my || inp.ndc.y > B.y1 + my;
        inp.ndc.x = clamp$9(inp.ndc.x, B.x0 - mx, B.x1 + mx);
        inp.ndc.y = clamp$9(inp.ndc.y, B.y0 - my, B.y1 + my);
        this._rc.setFromCamera(inp.ndc, cam);
        _m2.copy(lump.matrixWorld).invert();
        _a.copy(this._rc.ray.origin).applyMatrix4(_m2);
        _b.copy(this._rc.ray.direction).transformDirection(_m2);
        if (top.march(_a, _b, _c)) { cu.tl.copy(_c); cu.lastL.copy(_c); } else {
          cu.onLump = !far;
          lifted = far ? 0.025 : 0;
          const zH = top.zMax * 0.8, sH = _b.z < -1e-3 ? (zH - _a.z) / _b.z : -1;
          if (sH > 0) {
            let x = _a.x + _b.x * sH, y = _a.y + _b.y * sH;
            const r = Math.hypot(x, y);
            if (r > 1e-4) {
              const e = top.extent(x / r, y / r);
              if (r > e) { x = (x / r) * e; y = (y / r) * e; }
            }
            const z = top.at(x, y);
            cu.tl.set(x, y, z > -8 ? z : zH);
          } else cu.tl.copy(cu.lastL);
        }
      }
      if (fing && !(cu.phase === 'in' && !(cu.plan.walk && cu.canSteer))) {
        if (!cu.hold || cu.hold.x !== inp.ndc.x || cu.hold.y !== inp.ndc.y) cu.hold = { x: inp.ndc.x, y: inp.ndc.y, on: cu.onLump, far };
      } else cu.hold = null;
      cu.pressing = !!inp.press;
      scrub = fing ? inp.moveAge < 0.12 : cu.pressing || (inp.moveAge < 0.12 && !far);
      const still = !fing && inp.press && inp.moveAge > 0.2 && cu.onLump ? 1 : 0;
      cu.wig += (still - cu.wig) * (1 - Math.exp(-dt * 7));
      if (cu.wig > 0.002) {
        const x = cu.tl.x + Math.sin(cu.t * Math.PI * 2 * 3.2) * 0.022 * cu.wig, z = top.at(x, cu.tl.y);
        if (z > -8) cu.tl.set(x, cu.tl.y, z);
      }
    }
    cu.lifted = lifted;
    top.normal(cu.tl.x, cu.tl.y, _n).transformDirection(lump.matrixWorld);
    lump.localToWorld(_a.copy(cu.tl)).addScaledVector(_n, 0.0015 + lifted);
    if (!cu.tipInit) { cu.tip.copy(_a); cu.tipPrev.copy(_a); cu.tipN.copy(_n); cu.tipV.set(0, 0, 0); cu.tipInit = true; }
    cu.tip.lerp(_a, 1 - Math.exp(-dt * (fing ? 45 : 20)));
    cu.tipN.lerp(_n, 1 - Math.exp(-dt * 12)).normalize();
    cu.tipV.subVectors(cu.tip, cu.tipPrev).divideScalar(Math.max(dt, 1e-3));
    cu.tipPrev.copy(cu.tip);
    cu.scrubbing = scrub && cu.onLump;
  }

  _autoStroke(dt, it) {
    const cu = this.cu, A = cu.auto;
    if (!A.on) {
      A.on = true; A.k = 0;
      this._autoRegion(it);
      A.phase = 'move'; A.t = 0; A.dur = 0.22;
      A.fx = cu.lastL.x; A.fy = cu.lastL.y;
      this._autoNext(it);
    }
    A.t += dt;
    let x, y, scrub = false;
    A.lift = 0;
    if (A.phase === 'move') {
      const u = clamp$9(A.t / A.dur, 0, 1), k = easeInOut(u);
      x = lerp$3(A.fx, A.sx, k); y = lerp$3(A.fy, A.sy, k);
      A.lift = 0.014 * Math.sin(Math.PI * u);
      if (u >= 1) { A.phase = 'stroke'; A.t = 0; }
    } else {
      const u = clamp$9(A.t / 0.34, 0, 1), k = easeInOut(u);
      x = lerp$3(A.sx, A.ex, k); y = lerp$3(A.sy, A.ey, k);
      scrub = true;
      if (u >= 1) {
        A.phase = 'move'; A.t = 0; A.dur = 0.1; A.fx = A.ex; A.fy = A.ey;
        if (++A.k >= 4) { A.k = 0; this._autoRegion(it); A.dur = 0.18; }
        this._autoNext(it);
      }
    }
    const z = it.top.at(x, y);
    if (z > -8) { cu.tl.set(x, y, z); cu.lastL.copy(cu.tl); } else cu.tl.set(x, y, cu.tl.z);
    return scrub;
  }
  _autoRegion(it) {
    const cu = this.cu, A = cu.auto;
    it.mask.dirtiest(_uv);
    A.cx = (_uv.x - 0.5) * UVX; A.cy = (_uv.y - 0.5) * UVY;
    A.region++;
    const sw = A.region % 2 ? 0.35 : -0.35, c = Math.cos(sw), s = Math.sin(sw);
    A.dx = cu.dLx * c - cu.dLy * s; A.dy = cu.dLx * s + cu.dLy * c;
  }
  _autoNext(it) {
    const A = this.cu.auto;
    const off = (A.k - 1.5) * 0.028, nx = -A.dy, ny = A.dx;
    let Ls = 0.065;
    for (let tries = 0; tries < 4; tries++) {
      A.sx = A.cx - A.dx * Ls + nx * off; A.sy = A.cy - A.dy * Ls + ny * off;
      A.ex = A.cx + A.dx * Ls + nx * off; A.ey = A.cy + A.dy * Ls + ny * off;
      if (it.top.at(A.sx, A.sy) > -8 && it.top.at(A.ex, A.ey) > -8) break;
      Ls *= 0.6;
    }
  }

  _gripTarget(dt) {
    const cu = this.cu, st = cu.st, dv = cu.diver;
    _a.copy(cu.dPos).addScaledVector(st.r, dv ? BRUSH_TO[0] : 0.2).addScaledVector(st.f, dv ? BRUSH_TO[1] : 0.45).addScaledVector(Y, dv ? BRUSH_TO[2] : 0.08);
    _a.sub(cu.tip);
    _a.addScaledVector(cu.tipN, -_a.dot(cu.tipN));
    if (_a.lengthSq() < 1e-6) _a.copy(st.d);
    _a.normalize();
    const wa = dv ? BRUSH_ANG : 0.87;
    _b.copy(cu.tipN).multiplyScalar(Math.cos(wa)).addScaledVector(_a, Math.sin(wa));
    const sp = cu.tipV.length();
    if (sp > 0.02) _b.addScaledVector(cu.tipV, Math.min(sp * 0.5, 0.35) / sp);
    _b.normalize();
    if (!dv) {
      _c.copy(cu.tip).addScaledVector(_b, GRIP);
      if (!cu.gripInit) { cu.grip.copy(_c); cu.gripV.set(0, 0, 0); cu.gripInit = true; }
      spring3(cu.grip, cu.gripV, _c, 26, dt);
      return;
    }
    const A = dv.anchors.rightHand;
    A.updateWorldMatrix(true, false);
    _q$1.setFromRotationMatrix(A.matrixWorld);
    if (!cu.gqInit) { cu.gripQ.copy(_q$1); cu.gqInit = true; } else cu.gripQ.slerp(_q$1, 1 - Math.exp(-dt / 0.03));
    _c.copy(HOLD_O).addScaledVector(HOLD_D, BRUSH_TIP - 0.008 * this.tool.press).applyQuaternion(cu.gripQ);
    cu.grip.copy(_c.negate().add(cu.tip));
    cu.grip.add(cu.tipFix);
    cu.gripInit = true;
    cu.palmW.copy(cu.tipN).negate();
    if (cu.palmW.lengthSq() < 1e-6) cu.palmW.set(0, -1, 0); else cu.palmW.normalize();
  }

  _brushAway(dt) {
    const cu = this.cu, it = cu.it, P = it.pace, T = it.t, tool = this.tool;
    if (cu.brushGone) return;
    if (!cu.carrying) {
      cu.carrying = true;
      cu.awayFrom.copy(cu.grip);
      cu.awayV.copy(cu.tipV).clampLength(0, 0.35);
      cu.awayN.copy(cu.tipN);
      cu.awayPalm.copy(cu.palmW);
    }
    const D = BRUSH_OFF + P.away, u = clamp$9(T / D, 0, 1), u2 = u * u, u3 = u2 * u;
    this._beltWorld(_a);
    cu.grip.copy(cu.awayFrom).multiplyScalar(2 * u3 - 3 * u2 + 1).addScaledVector(cu.awayV, D * (u3 - 2 * u2 + u)).addScaledVector(_a, 3 * u2 - 2 * u3);
    const lift = Math.sin(Math.PI * u) ** 2;
    cu.grip.addScaledVector(cu.awayN, 0.06 * lift).addScaledVector(Y, 0.05 * lift);
    _b.copy(cu.st.r).negate().addScaledVector(Y, -0.2).normalize();
    _q$1.setFromUnitVectors(cu.awayPalm, _b);
    cu.palmW.copy(cu.awayPalm).applyQuaternion(_q2$1.identity().slerp(_q$1, sstep$7(0.1, 0.8, u)));
    if (u >= 1) { tool.group.visible = false; cu.brushGone = true; cu.carrying = false; }
  }

  _drawBrush(w, dt) {
    const cu = this.cu, dv = cu.diver, t = cu.t;
    if (!cu.drawn && t >= DRAW_T) { cu.drawn = true; this.tool.group.visible = true; this.tool.press = 0; }
    const k = sstep$7(DRAW_T, DRAW_T + 0.45, t);
    this._beltWorld(_a);
    dv.group.localToWorld(_b.set(0.21, -0.02, -0.2));
    cu.handT.lerpVectors(_a, _b, k).lerp(cu.grip, w);
    _c.copy(cu.st.r).negate().addScaledVector(Y, -0.2).normalize().lerp(cu.palmW, w);
    cu.optBrush.palm.lerp(_c, 1 - Math.exp(-dt * 10)).normalize();
    return Math.max(w, sstep$7(0, DRAW_T * 0.85, t) * lerp$3(1, 0.6, k));
  }

  _bagWorld(out) {
    const dv = this.cu.active ? this.cu.diver : this.diver;
    if (dv && dv.anchors && dv.anchors.bagMouth) return dv.anchors.bagMouth.getWorldPosition(out);
    if (dv && dv.anchors && dv.anchors.bag) return dv.anchors.bag.getWorldPosition(out).addScaledVector(Y, 0.32);
    if (dv) return dv.group.localToWorld(out.copy(BAG));
    return out.copy(this.cu.dPos).addScaledVector(Y, -0.1);
  }
  _beltWorld(out) {
    const dv = this.cu.active ? this.cu.diver : this.diver;
    this._bagWorld(out);
    if (!dv || !dv.anchors || !dv.anchors.bag) return out;
    dv.group.worldToLocal(out);
    out.x = Math.abs(out.x) * 0.75 + BELT_OUT[0];
    out.z += BELT_OUT[1];
    return dv.group.localToWorld(out);
  }

  _ready(b) { const cu = this.cu; return cu.plan.walk ? sstep$7(0.25, 0.85, cu.downT) : sstep$7(0.2, 0.75, b); }

  _closeupHands(b) {
    const cu = this.cu, it = cu.it, dv = cu.diver;
    if (!dv) return;
    const H = it.hands;
    if (it.state === 'cleaning' || (it.state === 'lifting' && !(H.on && H.goR >= 0))) {
      const w = it.state === 'cleaning' ? this._ready(b) : 1;
      if (!cu.brushGone || it.state === 'lifting') {
        const wr = it.state === 'cleaning' ? this._drawBrush(w, cu.dt || 1 / 60) : 1;
        if (it.state !== 'cleaning') { cu.handT.copy(cu.grip); cu.optBrush.palm.copy(cu.palmW); }
        dv.hold('right', cu.drawn && !cu.brushGone);
        cu.optBrush.touch = cu.drawn ? holdTouch : null;
        cu.optBrush.grip = cu.drawn ? 1 : 0.35;
        if (cu.drawn && !this._fist && dv.solveCurl && dv.reachInfo('right').holding >= 1) this._fist = dv.solveCurl('right', holdTouch, null, null, null, null, true);
        cu.optBrush.curl = cu.drawn && this._fist ? this._fist : null;
        dv.reach('right', cu.handT, wr, cu.optBrush);
      } else { dv.hold('right', false); dv.reach('right', null, 0); }
      if (H.on) { dv.hold('left', H.holdL); dv.reach('left', H.wl > 0.001 ? H.l : null, H.wl, H.optL); return; }
      dv.hold('left', false);
      if (cu.plan.walk) {
        dv.reach('left', null, 0);
      } else if (it.state === 'cleaning') {
        const st = cu.st;
        _a.copy(it.home).addScaledVector(st.r, -0.3).addScaledVector(st.d, 0.42);
        _a.y = this._ground()(_a.x, _a.z) + 0.03;
        dv.reach('left', _a, w, cu.optSteady);
      } else dv.reach('left', null, 0);
    } else this.applyHands(dv);
  }

  _placeBrush(dt) {
    const cu = this.cu, T = this.tool;
    if (!T.group.visible) return;
    const h = Math.min(dt, 0.05);
    const anchor = cu.diver ? cu.diver.anchors.rightHand : null;
    T.press += ((cu.scrub > 0.05 ? 1 : 0) - T.press) * (1 - Math.exp(-h * 14));
    if (anchor) {
      anchor.updateWorldMatrix(true, false);
      _m2.multiplyMatrices(anchor.matrixWorld, HOLD_T);
      _m2.decompose(T.group.position, T.group.quaternion, _s$2);
      _b.set(0, 1, 0).applyQuaternion(T.group.quaternion);
      _c.copy(T.group.position).addScaledVector(_b, -BRUSH_TIP + 0.008 * T.press);
      cu.tipErr = _c.distanceTo(cu.tip);
      cu.contact = cu.tipErr < 0.03 && cu.lifted < 0.01 && cu.it.state === 'cleaning';
      const work = cu.it.state === 'cleaning' && cu.drawn && cu.diver.reachInfo('right').weight > 0.9;
      let near = work ? 1 - sstep$7(0.05, 0.12, anchor.getWorldPosition(_hv).distanceTo(cu.grip)) : 0;
      if (cu.it.state === 'cleaning') cu.nearAt = near; else near = cu.nearAt * (1 - sstep$7(0, 0.35, cu.it.t));
      _hq.identity();
      let ts = 0;
      if (near > 1e-3) {
        _c.copy(cu.tip).applyMatrix4(_m2.copy(anchor.matrixWorld).invert()).sub(HOLD_P);
        const d = _c.length();
        if (d > 1e-4) {
          _c.divideScalar(d);
          const ang = Math.acos(clamp$9(_c.dot(HOLD_D), -1, 1));
          _q2$1.setFromUnitVectors(HOLD_D, _c);
          _hq.slerp(_q2$1, (ang > PIV_MAX ? PIV_MAX / ang : 1) * near);
          ts = clamp$9(d - (HOLD_AT + BRUSH_TIP - 0.008 * T.press), -SLIDE_MAX, SLIDE_MAX) * near;
        }
      }
      const at = near > 1e-3 ? 1 - sstep$7(0.005, 0.02, anchor.getWorldPosition(_hv).distanceTo(cu.grip)) : 0;
      if (at > 1e-3) {
        _hv.subVectors(cu.tip, _c.copy(T.group.position).addScaledVector(_b, -BRUSH_TIP + 0.008 * T.press));
        cu.tipFix.multiplyScalar(Math.exp(-h * 1.5)).addScaledVector(_hv, (1 - Math.exp(-h * 10)) * near * at).clampLength(0, 0.04);
      } else cu.tipFix.multiplyScalar(Math.exp(-h * 6));
      const kp = 1 - Math.exp(-h * 16), capP = PIV_V * Math.max(h * 60, 1e-3);
      _pq.copy(cu.pivQ).slerp(_hq, kp);
      if (cu.pivQ.angleTo(_pq) > capP) cu.pivQ.rotateTowards(_pq, capP); else cu.pivQ.copy(_pq);
      cu.slide += clamp$9((ts - cu.slide) * kp, -SLIDE_V * Math.max(h * 60, 1e-3), SLIDE_V * Math.max(h * 60, 1e-3));
      setHold(cu.pivQ, cu.slide);
    } else {
      _b.subVectors(cu.grip, cu.tip).normalize();
      T.group.quaternion.setFromUnitVectors(Y, _b);
      T.group.position.copy(cu.tip).addScaledVector(_b, BRUSH_TIP - 0.008 * T.press);
      cu.contact = cu.lifted < 0.01;
    }
    this._inv.copy(T.group.quaternion).invert();
    const goal = this._bv.copy(cu.tipV).applyQuaternion(this._inv).multiplyScalar(-0.022 * (0.35 + T.press));
    goal.y = 0;
    goal.clampLength(0, 0.016);
    T.bendV.x += ((goal.x - T.bendS.x) * 260 - T.bendV.x * 18) * h;
    T.bendV.z += ((goal.z - T.bendS.z) * 260 - T.bendV.z * 18) * h;
    T.bendS.x += T.bendV.x * h;
    T.bendS.z += T.bendV.z * h;
    T.bend.value.copy(T.bendS);
    const speed = cu.tipV.length();
    T.splay.value += (T.press * 0.0036 + Math.min(speed, 1) * 0.0015 * T.press - T.splay.value) * (1 - Math.exp(-h * 16));
    T.dirt.value = Math.min(1, T.dirt.value + h * 0.06 * cu.scrub);
  }

  _camera(dt, t) {
    const cu = this.cu, st = cu.st, it = cu.it, o = cu.out, P = it.pace, cam = cu.camera;
    const vf = Math.max(40, (2 * Math.atan(Math.tan((26 * Math.PI) / 180) / Math.max(1.25, cam.aspect)) * 180) / Math.PI);
    const vT = Math.max(28, (2 * Math.atan(Math.tan((20 * Math.PI) / 180) / Math.max(1.25, cam.aspect)) * 180) / Math.PI);
    let fovAdd = vf - cu.fovBase, focus, ap;
    const dv = cu.diver, walk = !!(cu.plan.walk && dv && dv.anchors && dv.anchors.chest);
    const dT = cu.downT >= 0 ? cu.downT : cu.t - cu.walkDur;
    const stand = !walk ? 0 : 1 - sstep$7(-0.8, 0.75, dT), aimK = stand * stand;
    const wide = !walk ? 1 : it.state === 'cleaning' || it.state === 'lifting' ? sstep$7(0, 0.8, cu.outT) : 1;
    const wv = Math.max(stand, wide);
    const tB = P.rev + P.tug;
    const kP = !walk ? 0 : it.state === 'cleaning' ? wide : it.state === 'lifting' ? wide * (1 - sstep$7(tB + 0.55 * P.rise, tB + P.rise, it.t)) : 0;
    if (walk) {
      dv.anchors.chest.getWorldPosition(_chest).addScaledVector(Y, 0.12);
      dv.anchors.head.getWorldPosition(_crown).addScaledVector(Y, 0.22);
    }
    if (cu.phase === 'in') {
      const s0 = clamp$9(cu.t / cu.blend, 0, 1), b = s0 * s0 * (3 - 2 * s0), u = 1 - b;
      const s1 = walk ? clamp$9(cu.t / Math.min(cu.blend, cu.walkDur + 0.75), 0, 1) : s0, bT = s1 * s1 * (3 - 2 * s1);
      if (walk) {
        this._workPos(_orb, stand);
        _orbC.lerpVectors(st.S, _chest, b);
        const dx = _orb.x - _orbC.x, dz = _orb.z - _orbC.z, r = lerp$3(cu.orbR0, Math.hypot(dx, dz), bT);
        let da = Math.atan2(dx, dz) - cu.orbA0 - cu.orbDA;
        da -= 2 * Math.PI * Math.round(da / (2 * Math.PI));
        const ang = cu.orbA0 + (cu.orbDA + da) * b;
        o.camPos.set(_orbC.x + Math.sin(ang) * r, lerp$3(cu.cinePos.y, _orb.y, bT) + 0.8 * b * u, _orbC.z + Math.cos(ang) * r);
      } else o.camPos.copy(cu.cinePos).multiplyScalar(u * u).addScaledVector(cu.ctrl, 2 * u * b).addScaledVector(st.Cb, b * b);
      this._sway(t, _c.set(0, 0, 0));
      o.camPos.addScaledVector(_c, b);
      _b.copy(cu.aim0).lerp(walk ? this._workAim(_c, aimK) : st.Tb, easeOutCubic(Math.min(1, bT / 0.55)));
      lookQ$1(o.camPos, _b, _q$1);
      o.camQuat.slerpQuaternions(cu.qFix, QI, b).multiply(_q$1);
      if (walk) fovAdd = lerp$3(vT, vf, stand) - cu.fovBase;
      fovAdd *= bT;
      focus = o.camPos.distanceTo(_b);
      ap = lerp$3(0.02, walk ? lerp$3(0.62, 0.24, stand) : 0.24, bT);
      if (b >= 1) { cu.phase = 'work'; cu.canSteer = true; cu.look.copy(_b); }
    } else if (it.state === 'cleaning') {
      if (walk) { this._workAim(_b, aimK); if (wide > 0) _b.lerp(_e$1.copy(it.home).addScaledVector(Y, 0.025).lerp(_crown, 0.55 * wide), wide); }
      else _b.copy(st.Tb).addScaledVector(_a.subVectors(cu.tip, it.home), 0.3);
      _b.y -= 0.12 * kP;
      cu.look.lerp(_b, 1 - Math.exp(-dt * 3));
      if (walk) this._workPos(o.camPos, stand).lerp(st.Cw, wide); else o.camPos.copy(st.Cb);
      cu.pushFrom.copy(o.camPos);
      this._sway(t, o.camPos);
      lookQ$1(o.camPos, cu.look, o.camQuat);
      this._drift(t, o.camQuat, 1 - 0.6 * wv);
      focus = lerp$3(o.camPos.distanceTo(cu.tip), o.camPos.distanceTo(_chest), aimK);
      ap = walk ? lerp$3(lerp$3(0.62, 0.24, stand), 0.34, wide) : 0.24;
      if (walk) fovAdd = lerp$3(vT, vf, wv) + 6 * kP - cu.fovBase;
    } else if (it.state === 'lifting' && it.t < P.rev) {
      const k = easeInOut(clamp$9(it.t / P.rev, 0, 1));
      if (walk) { this._workAim(_b, aimK); _b.lerp(_e$1.copy(it.home).addScaledVector(Y, 0.025).lerp(_crown, 0.55 * wide), wide); }
      else _b.copy(it.home).addScaledVector(Y, 0.025);
      _b.y -= 0.12 * kP;
      cu.look.lerp(_b, 1 - Math.exp(-dt * (walk ? 3 + 3 * sstep$7(0, 0.5, it.t) : 2.5)));
      if (walk) this._workPos(o.camPos, stand).lerp(st.Cw, wide); else o.camPos.copy(st.Cb).lerp(cu.look, 0.14 * k);
      cu.pushFrom.copy(o.camPos);
      this._sway(t, o.camPos);
      lookQ$1(o.camPos, cu.look, o.camQuat);
      this._drift(t, o.camQuat, 1 - 0.6 * wv);
      focus = o.camPos.distanceTo(it.home);
      ap = walk ? lerp$3(0.62, 0.34, wv) : lerp$3(0.24, 0.34, k);
      if (walk) fovAdd = lerp$3(vT, vf, wv) + 6 * kP - cu.fovBase;
    } else {
      const u = it.state === 'lifting' ? clamp$9((it.t - P.rev) / (P.tug + P.rise), 0, 1) : 1, k = u * u * u * (u * (u * 6 - 15) + 10);
      if (walk) this._workPos(cu.pushFrom, stand).lerp(st.Cw, wide);
      o.camPos.copy(cu.pushFrom).lerp(st.Cx, k);
      o.camPos.y += 0.06 * Math.sin(Math.PI * k);
      if (it.state !== 'lifting') o.camPos.lerp(st.Tx, 0.05 * sstep$7(0, P.scan + P.count + P.hold, it.t));
      const Sw = walk && it.stowS && it.released ? it.stowS : null;
      const kW = !Sw ? 0 : it.state === 'done' ? 1 : Sw.phase === 'way' ? sstep$7(0.05, 0.5, Sw.s / Sw.L) : 0;
      if (kW > 1e-4) o.camPos.sub(_chest).applyAxisAngle(Y, 0.78 * kW).add(_chest);
      this._sway(t, o.camPos);
      _b.copy(it.lump.position).lerp(walk ? _crown : st.head2, walk ? 0.25 : 0.1);
      if (walk && it.state === 'lifting') _b.lerp(_crown, 0.7 * wide * (1 - 0.6 * k * k * k));
      let kS = 0;
      if (walk) {
        const tH = P.scan + P.count + P.hold, kR = cu.riseT >= 0 ? sstep$7(0, cu.plan.rise, cu.riseT) : 0;
        kS = it.state === 'done' ? 1 : it.state === 'collecting' ? sstep$7(tH, tH + (it.stowD || P.stow), it.t) : 0;
        if (Sw) { _b.lerp(_chest, 0.5 * kR); this._bagWorld(_e$1); _b.lerp(_e$1, 0.45 * kW); kS = 0; }
        _b.lerp(_chest, 0.85 * kS);
        _d.subVectors(o.camPos, _chest).setY(0);
        const dl = _d.length();
        if (dl > 1e-3) o.camPos.addScaledVector(_d, (0.6 * kR) / dl);
        o.camPos.y += 0.3 * kR;
      }
      _b.y -= 0.12 * kP;
      cu.look.lerp(_b, 1 - Math.exp(-dt * ((walk ? 5 : 3) + 5 * k)));
      lookQ$1(o.camPos, cu.look, o.camQuat);
      this._drift(t, o.camQuat, 1 - 0.6 * wv);
      focus = lerp$3(o.camPos.distanceTo(it.lump.position), o.camPos.distanceTo(_chest), kS);
      ap = lerp$3(walk ? lerp$3(0.62, 0.34, wv) : 0.34, 0.22, k);
      if (walk) fovAdd = lerp$3(vT, vf, wv) + 6 * kP - cu.fovBase;
      FRAME.aimAt(o.camQuat, FRAME.y(0.5, 0.5 + 0.08 * k), FRAME.lens(cu.fovBase + fovAdd));
    }
    const kIn = cu.phase === 'in' ? sstep$7(0, 1, cu.t / cu.blend) : 1;
    FRAME.back(o.camPos, o.camQuat, focus, 1 + (FRAME.reach(cu.fovBase + fovAdd) - 1) * kIn);
    this._clearOfDiver(o.camPos);
    o.fovAdd = fovAdd;
    o.dofFocus = focus;
    o.dofAperture = ap;
  }
  _workPos(out, s) {
    const st = this.cu.st;
    _e$1.copy(st.Cw);
    _e$1.y += 0.35;
    this._standOff(_e$1, 1);
    return out.copy(st.Cb).lerp(_e$1, s);
  }
  _workAim(out, s) {
    const cu = this.cu, st = cu.st;
    _s$2.subVectors(cu.tip, cu.it.home);
    out.copy(st.Tb).addScaledVector(_s$2, 0.35);
    _e$1.copy(st.Tw).addScaledVector(_s$2, 0.3).lerp(_chest, 0.6);
    return out.lerp(_e$1, s);
  }
  _drift(t, q, k) {
    if (k <= 0) return;
    const a = 0.0068 * k;
    _eu.set((Math.sin(t * 0.61 + 0.4) * 0.65 + Math.sin(t * 1.43 + 2.1) * 0.25) * a * 0.8,
      (Math.sin(t * 0.47 + 1.3) * 0.65 + Math.sin(t * 1.17 + 0.2) * 0.25) * a,
      Math.sin(t * 0.53 + 2.7) * a * 0.5, 'YXZ');
    q.multiply(_q2$1.setFromEuler(_eu));
  }
  _standOff(p, k) {
    _d.subVectors(p, _chest).setY(0);
    const dl = _d.length();
    if (dl > 1e-3 && dl < 2.3) p.addScaledVector(_d, ((2.3 - dl) * k) / dl);
  }
  _sway(t, p) {
    p.x += Math.sin(t * 0.83) * 0.004;
    p.y += Math.sin(t * 1.21 + 1.0) * 0.003;
    p.z += Math.sin(t * 0.67 + 2.0) * 0.003;
  }
  _clearOfDiver(p) { this._clearOf(p, this.cu.diver); }
  keepClear(p) { this._clearOf(p, this.diver); }
  _clearOf(p, dv) {
    if (!dv || !dv.group) return;
    const g = dv.group;
    g.localToWorld(_d.set(0, 0.12, -0.55));
    g.localToWorld(_e$1.set(0, 0.05, 1.5));
    _e$1.sub(_d);
    const h = clamp$9(_s$2.subVectors(p, _d).dot(_e$1) / _e$1.lengthSq(), 0, 1);
    _s$2.copy(_d).addScaledVector(_e$1, h);
    _a.subVectors(p, _s$2);
    const dd = _a.length(), minD = 0.75, w = 0.15;
    if (dd >= minD + w || dd < 1e-4) return;
    const f = dd <= minD - w ? minD : minD + ((dd - (minD - w)) ** 2) / (4 * w);
    p.copy(_s$2).addScaledVector(_a, f / dd);
  }

  _itemStep(it, dt, camera = null, presenter = null) {
    if (!it.staged) { this._legacyStep(it, dt, camera, presenter); return; }
    const P = it.pace, cb = this.cb, H = it.hands, dv = this.cu.active ? this.cu.diver : this.diver;
    it.t += dt;
    if (it.state === 'lifting' && H.on) it.handT += dt;
    if (it.state === 'lifting' && !it.gripped && it.t > P.rev) {
      const gap = H.on && it.handT >= it.handDur ? this._gripGap(it, dv) : 9;
      if (gap < 0.01 || (it.handT > it.handDur + 0.25 && gap > it.gapPrev - 0.0005) || it.handT > it.handDur + 1.3) { it.gripped = true; it.gripT = it.handT; }
      else it.t = P.rev;
      it.gapPrev = gap;
    }
    const T = it.t;
    if (it.pourP) { it.pourV.subVectors(it.lump.position, it.pourP).divideScalar(Math.max(dt, 1e-3)).clampLength(0, 0.6); it.pourP.copy(it.lump.position); }
    if (it.state === 'lifting') {
      const tA = P.rev, tB = tA + P.tug, tC = tB + P.rise;
      if (!it.uncovered) { it.uncovered = true; if (cb.onUncover) cb.onUncover(it.i); }
      const su = (T - 0.15) / Math.min(1.35, P.rev * 0.9);
      it.uni.uSweep.value = su > 0 && su < 1 ? lerp$3(-0.45, 0.45, su) : -9;
      if (T >= Math.max(0, BRUSH_OFF + P.away - HAND_LEAD) && !H.on) { this._grip(it, dv); it.handT0 = T; }
      if (T < tA) {
        it.lump.position.copy(it.homeP);
        it.lump.quaternion.copy(it.homeQ);
      } else {
        if (T < tB) {
          const g = T - tA, gv = Math.min(0.32, P.tug * 0.55);
          const lift = 0.016 * sstep$7(gv, gv + (P.tug - gv) * 0.6, g) - 0.005 * sstep$7(P.tug - 0.12, P.tug, g);
          const rock = Math.sin((g / gv) * Math.PI * 2) * 0.045 * sstep$7(0.04, 0.1, g) * (1 - sstep$7(gv - 0.06, gv, g));
          const tr = Math.sin(T * 53) * 0.0018 * sstep$7(gv - 0.02, gv + 0.04, g) * (1 - sstep$7(gv + 0.1, gv + 0.18, g));
          it.lump.position.copy(it.homeP).addScaledVector(Y, lift);
          it.lump.position.x += tr;
          _a.set(it.gL.y - it.gR.y, it.gR.x - it.gL.x, 0).normalize();
          it.lump.quaternion.copy(it.homeQ).multiply(_q$1.setFromAxisAngle(_a, rock));
          if (!it.tugged && g > gv) { it.tugged = true; it.slumpT = 0; this._breakFree(it); if (cb.onPickup) cb.onPickup(it.i, it.home); if (cb.pour) cb.pour(); }
          if (g > gv) this._pour(it, 1, dt);
        } else {
          const u = clamp$9((T - tB) / P.rise, 0, 1), k = u * u * u * (u * (u * 6 - 15) + 10), k1 = 1 - k;
          _a.copy(it.homeP).addScaledVector(Y, 0.011);
          _b.lerpVectors(_a, it.presentP, 0.62).addScaledVector(this.cu.st.d, -0.1);
          it.lump.position.copy(_a).multiplyScalar(k1 * k1).addScaledVector(_b, 2 * k1 * k).addScaledVector(it.presentP, k * k);
          const uq = Math.min(1, u / LIFT_TURN_END), kq = uq * uq * uq * uq * (35 + uq * (-84 + uq * (70 - 20 * uq)));
          it.lump.quaternion.slerpQuaternions(it.homeQ, it.presentQ, kq);
          this._pour(it, 1 - 0.7 * u, dt);
          if (T >= tC) { it.state = 'collecting'; it.t = 0; it.lump.renderOrder = 12; }
        }
      }
    } else if (it.state === 'collecting') {
      const kneel = !!(dv && dv.bodyCapsules && dv.anchors && dv.anchors.bagMouth && this.cu.active && this.cu.it === it && this.cu.plan.walk);
      if (!(kneel && it.stowS && it.released)) it.stowD = P.stow * (this.cu.plan.walk ? 1.4 : 1);
      const tS = P.scan, tK = tS + P.count, tH = tK + P.hold;
      if (T < tH || !it.released) {
        const Th = Math.min(T, tH);
        it.lump.position.copy(it.presentP);
        it.lump.position.y -= 0.016 * Math.sin(Math.min(Th * 5, Math.PI)) ** 2 * Math.exp(-Th * 1.2);
        const kT = sstep$7(0, 0.8, Th);
        _eu.set(Math.sin(Th * 0.9) * 0.07 * kT, (Math.sin(Th * 0.6 + 1) - Math.sin(1)) * 0.16 * kT, 0, 'XYZ');
        it.lump.quaternion.copy(it.presentQ).multiply(_q$1.setFromEuler(_eu));
        if (T < 0.7) this._pour(it, 0.3 * (1 - T / 0.7), dt);
      }
      const xr = sstep$7(XRAY_IN, XRAY_IN + 0.25, T) * (1 - sstep$7(tH - XRAY_FADE, tH, T));
      it.uni.uXray.value = xr;
      it.shell.visible = xr > 0.001;
      it.shell.material.opacity = 0.78 * xr;
      it.uni.uScan.value = lerp$3(-0.36, 0.37, clamp$9(T / tS, 0, 1));
      it.scan.visible = T < tS + 0.15;
      it.scan.position.x = it.uni.uScan.value;
      it.scanU.uA.value = 0.6 * sstep$7(0, 0.1, T) * (1 - sstep$7(tS, tS + 0.15, T));
      if (!it.scanStarted) { it.scanStarted = true; if (cb.onScan) cb.onScan(it.i); }
      it.guni.uShow.value = sstep$7(XRAY_IN, Math.max(XRAY_IN + 0.2, tS * 0.7), T) * (1 - sstep$7(tH - XRAY_FADE, tH - 0.03, T));
      it.gear.material.opacity = sstep$7(0.05, 0.6, xr);
      it.gear.visible = it.gear.material.opacity > 0.001;
      if (T >= tS) {
        const c = clamp$9((T - tS) / P.count, 0, 1);
        it.guni.uCount.value = c;
        if (!it.revealed) { it.revealed = true; if (cb.onReveal) cb.onReveal(it.i); }
        const steps = Math.floor(c * 36);
        if (steps > it.lastTick) { it.lastTick = steps; if (cb.onTick) cb.onTick(c); }
      }
      if (T >= tH) {
        if (!it.released) {
          it.released = true;
          if (!kneel) it.rg.on = false;
          if (dv) {
            it.stowP.copy(it.lump.position);
            dv.group.worldToLocal(it.stowP);
            it.stowQ.copy(dv.group.quaternion).invert().multiply(it.lump.quaternion);
            if (kneel) this._stowRise(it, dv); else this._stowTurn(it);
          }
        }
        const u = clamp$9((T - tH) / it.stowD, 0, 1), k = easeInOut(Math.min(1, u / 0.6));
        if (kneel && it.stowS) {
          this._stowStep(it, dv, T - tH);
          if (it.stowS && !it.stowS.let && this.cu.active) this._clearBody(it, dv, dt, T - tH);
        }
        else if (dv) {
          this._bagWorld(_c);
          dv.group.worldToLocal(_c).addScaledVector(Y, 0.19 - 0.21 * sstep$7(0.6, 1, u));
          _a.lerpVectors(it.stowP, _c, k);
          _a.y += 0.06 * Math.sin(Math.PI * k);
          dv.group.localToWorld(_a);
          it.lump.position.copy(_a);
          it.lump.quaternion.copy(dv.group.quaternion).multiply(_q$1.slerpQuaternions(it.stowQ, it.stowQ2, sstep$7(0.05, 0.6, u)));
        }
        if (T >= tH + it.stowD) {
          it.state = 'done';
          if (!(kneel && it.stowS)) it.lump.visible = false;
          it.beam.visible = it.ring.visible = it.glint.visible = false;
          it.gear.visible = it.shell.visible = it.scan.visible = false;
          H.on = false;
          H.wr = H.wl = 0;
          H.holdR = H.holdL = false;
          this.collected++;
          if (cb.onCollected) cb.onCollected(it.i, this.collected);
          if (this.cu.active && this.cu.it === it && this.cu.plan.walk && this.cu.riseT < 0) this.cu.riseT = 0;
          return;
        }
      }
    }
    if (dv && (it.state === 'lifting' || it.state === 'collecting') && H.on && !(it.stowS && it.stowS.let)) this._helmClear(it, dv, dt);
    const L = it.lump, rg = it.rg;
    it.planM.compose(L.position, L.quaternion, L.scale);
    if (rg.on) { _rm.multiplyMatrices(it.planM, rg.Cl); _rm.decompose(L.position, L.quaternion, _rs); }
    this._handTargets(it);
    if (rg.on) this._rigTargets(it, dt);
  }

  _rigTargets(it, dt) {
    const rg = it.rg, H = it.hands;
    rg.t += dt;
    if (rg.O1) {
      const kO = sstep$7(0, rg.fixO || RIG_FIX, rg.t);
      this._mBlend(rg.O0, rg.O1, kO, rg.O);
      if (!rg.side) this._mBlend(rg.OL0, rg.OL1, kO, rg.OL);
    }
    const k = sstep$7(0, RIG_FIX, rg.t);
    rg.C0.decompose(_rp$1, _rq, _rs);
    _rp$1.multiplyScalar(1 - k);
    _rq.slerp(QI, k);
    _rm2.compose(_rp$1, _rq, ONE);
    _rm.multiplyMatrices(it.planM, _rm2).multiply(_rm2.copy(rg.O).invert());
    const c = rg.side ? H.l : H.r, o = rg.side ? H.optL : H.optR;
    this._rigHand(_rm, c, o, rg.side ? rg.cL : rg.cR);
    if (rg.side) { H.holdL = true; H.wl = 1; } else { H.holdR = true; H.wr = 1; }
    if (!rg.side && H.holdL && H.wl > 0.999) {
      _rm.multiplyMatrices(it.planM, rg.Cl).multiply(rg.OL);
      this._rigHand(_rm, H.l, H.optL, rg.cL);
      H.optL.follow = (H.optL.followM || (H.optL.followM = new THREE.Matrix4())).multiplyMatrices(rg.O, rg.OL);
    }
  }
  _mBlend(a, b, k, out) {
    a.decompose(_rp$1, _rq, _rs); b.decompose(_a, _q$1, _s$2);
    return out.compose(_rp$1.lerp(_a, k), _rq.slerp(_q$1, k), _s$2);
  }
  _rigHand(M, p, o, cu) {
    const e = M.elements;
    p.set(e[12], e[13], e[14]);
    o.palm.set(e[8], e[9], e[10]).normalize();
    (o.fingers || (o.fingers = new THREE.Vector3())).set(e[4], e[5], e[6]).normalize();
    o.curl = cu; o.touch = null; o.still = false; o.edge.x = NaN; o.tight = true; o.follow = null;
  }
  _rigReady(it, dv) {
    const H = it.hands;
    return !!(dv && dv.solveCurl && dv.anchors && this.cu.active && this.cu.it === it && this.cu.plan.walk && it.state === 'lifting' && it.gripped && it.seatW >= 0.999 && H.on && H.holdR && H.holdL && !it.rg.on);
  }
  _rigCapture(it, dv) {
    const rg = it.rg, L = it.lump, RH = dv.anchors.rightHand, LH = dv.anchors.leftHand, V3 = THREE.Vector3, M4 = THREE.Matrix4;
    L.updateMatrixWorld(); RH.updateWorldMatrix(true, false); LH.updateWorldMatrix(true, false);
    const A = L.matrixWorld.clone(), Ai = A.clone().invert();
    rg.O0 = (rg.O0 || new M4()).copy(RH.matrixWorld).invert().multiply(A);
    rg.OL0 = (rg.OL0 || new M4()).copy(Ai).multiply(LH.matrixWorld);
    rg.C0.copy(it.planM).invert().multiply(A);
    rg.Cl.copy(rg.C0);
    rg.t = 0; rg.side = 0; rg.on = true; rg.refit = false;
    it.actM.copy(A);
    const des = (g) => {
      const z = new V3(-g.x, -g.y, 0).normalize();
      if (it.uN) z.addScaledVector(new V3().copy(it.uN).negate(), GRIP_PALM_IN).normalize();
      z.transformDirection(A);
      const y = new V3(0, 0, -1).transformDirection(A);
      y.addScaledVector(z, -y.dot(z)).normalize();
      return new M4().makeBasis(new V3().crossVectors(y, z), y, z).setPosition(new V3().copy(g).applyMatrix4(A));
    };
    const MR = RH.matrixWorld.clone() , ML = des(it.gL);
    const depth = (M, side, Si) => {
      let d = 9;
      for (let k = 0; k < PALM_PTS.length; k += 3) {
        _e$1.set(side * PALM_PTS[k], PALM_PTS[k + 1], PALM_PTS[k + 2]).applyMatrix4(M).applyMatrix4(Si);
        d = Math.min(d, it.sdf(_e$1.x, _e$1.y, _e$1.z) * LUMP_S);
      }
      return d;
    };
    const zR = new V3().setFromMatrixColumn(MR, 2); new V3().setFromMatrixColumn(ML, 2);
    const sR = clamp$9(RIG_PALM - depth(MR, 1, Ai), -0.03, 0.03), shR = zR.clone().multiplyScalar(sR);
    rg.fixO = Math.max(RIG_FIX, (1.5 * Math.abs(sR)) / (RIG_SLIDE * 60));
    const A1 = new M4().makeTranslation(shR.x, shR.y, shR.z).multiply(A), A1i = A1.clone().invert();
    const sL = clamp$9(RIG_PALM - depth(ML, -1, A1i), -0.03, 0.03);
    const ML1 = ML.clone().multiply(new M4().makeTranslation(0, 0, -sL));
    rg.O1 = (rg.O1 || new M4()).copy(MR).invert().multiply(A1);
    rg.OL1 = (rg.OL1 || new M4()).copy(A1i).multiply(ML1);
    const H = it.hands;
    const pre = (p, o, Mact) => {
      if (!o || !o.palm || !p || !Number.isFinite(p.x) || o.palm.lengthSq() < 1e-8) return null;
      const z = o.palm.clone().normalize();
      const y = o.fingers && o.fingers.lengthSq() > 1e-8 ? o.fingers.clone() : new V3().setFromMatrixColumn(Mact, 1);
      y.addScaledVector(z, -y.dot(z));
      if (y.lengthSq() < 1e-8) return null;
      y.normalize();
      const x = new V3().crossVectors(y, z).multiplyScalar(Mact.determinant() < 0 ? -1 : 1);
      return new M4().makeBasis(x, y, z).setPosition(p);
    };
    const PR = pre(H.r, H.optR, RH.matrixWorld), PL = pre(H.l, H.optL, LH.matrixWorld);
    if (PR) rg.C0.copy(it.planM).invert().multiply(PR).multiply(rg.O0);
    if (PL) rg.OL0.copy(Ai).multiply(PL);
    rg.O.copy(rg.O0); rg.OL.copy(rg.OL0);
    if (it.state === 'lifting') {
      const Od = new M4().copy(des(it.gR)).invert().multiply(A1), D = Od.invert().multiply(rg.O1);
      const dp = new V3(), dq = new THREE.Quaternion(), ds = new V3();
      D.decompose(dp, dq, ds);
      const ang = 2 * Math.acos(Math.min(1, Math.abs(dq.w))), w = sstep$7(RIG_TURN0, RIG_TURN1, ang);
      if (w > 1e-3) {
        dp.multiplyScalar(w); dq.slerp(QI, 1 - w);
        const Pm = new M4().compose(it.presentP, it.presentQ, L.scale).multiply(new M4().compose(dp, dq, ONE));
        Pm.decompose(it.presentP, it.presentQ, ds);
      }
    }
    const face = new V3(0, 0, 1).transformDirection(A);
    const up = it.uN ? it.uN.clone().negate().transformDirection(A) : null;
    const c = new V3().setFromMatrixPosition(A).add(shR);
    const T = it.touchS, inv = it.touchInv, q = new V3();
    inv.copy(A).invert();
    const toR = MR.clone().multiply(RH.matrixWorld.clone().invert()), toL = ML1.clone().multiply(LH.matrixWorld.clone().invert());
    const tR = (x, y, z) => { q.set(x, y, z).applyMatrix4(toR).sub(shR); return T(q.x, q.y, q.z); };
    const tL = (x, y, z) => { q.set(x, y, z).applyMatrix4(toL).sub(shR); return T(q.x, q.y, q.z); };
    const iR = new M4().copy(toR).invert(), iL = new M4().copy(toL).invert();
    rg.cR = dv.solveCurl('right', tR, rg.cR || undefined, face.clone().transformDirection(iR), up && up.clone().transformDirection(iR), c.clone().applyMatrix4(iR));
    rg.cL = dv.solveCurl('left', tL, rg.cL || undefined, face.clone().transformDirection(iL), up && up.clone().transformDirection(iL), c.clone().applyMatrix4(iL));
  }
  _rigRefit(it, dv) {
    const L = it.lump, V3 = THREE.Vector3;
    L.updateMatrixWorld();
    it.touchInv.copy(L.matrixWorld).invert();
    const face = new V3(0, 0, 1).transformDirection(L.matrixWorld);
    const up = it.uN ? it.uN.clone().negate().transformDirection(L.matrixWorld) : null;
    it.rg.cL = dv.solveCurl('left', it.touchS, null, face, up, L.getWorldPosition(new V3()));
  }
  _rigid(it, dv) {
    const rg = it.rg, L = it.lump, A = rg.side ? dv.anchors.leftHand : dv.anchors.rightHand;
    A.updateWorldMatrix(true, false);
    _rm.multiplyMatrices(A.matrixWorld, rg.O);
    if (L.parent) { L.parent.updateWorldMatrix(true, false); _rm.premultiply(_rm2.copy(L.parent.matrixWorld).invert()); }
    (it.actV || (it.actV = new THREE.Vector3())).setFromMatrixPosition(it.actM);
    _rm.decompose(L.position, L.quaternion, _rs);
    L.updateMatrixWorld();
    it.actM.copy(L.matrixWorld);
    it.actV.subVectors(L.position, it.actV).divideScalar(Math.max(this.cu.dt || 1 / 60, 1e-3));
    rg.Cl.copy(it.planM).invert().multiply(it.actM);
  }
  _rigToLeft(it, dv) {
    const rg = it.rg;
    if (!rg.on || rg.side === 1) return;
    const LH = dv.anchors.leftHand;
    LH.updateWorldMatrix(true, false);
    rg.O.copy(LH.matrixWorld).invert().multiply(it.actM);
    rg.O0 = (rg.O0 || new THREE.Matrix4()).copy(rg.O);
    _m.copy(it.actM).invert();
    const n = new THREE.Vector3(0, 0, 1).transformDirection(LH.matrixWorld);
    const sL = clamp$9(RIG_PALM - this._palmDepth(it, LH, -1, true), -0.03, 0.03);
    rg.fixO = Math.max(RIG_FIX, (1.5 * Math.abs(sL)) / (RIG_SLIDE * 60));
    _m2.makeTranslation(n.x * sL, n.y * sL, n.z * sL).multiply(it.actM);
    rg.O1 = (rg.O1 || new THREE.Matrix4()).copy(LH.matrixWorld).invert().multiply(_m2);
    it.touchInv.copy(_m2).invert();
    const face = new THREE.Vector3(0, 0, 1).transformDirection(_m2);
    const up = it.uN ? it.uN.clone().negate().transformDirection(_m2) : null;
    rg.cL = dv.solveCurl('left', it.touchS, null, face, up, new THREE.Vector3().setFromMatrixPosition(_m2));
    rg.C0.copy(rg.Cl);
    rg.t = 0; rg.side = 1;
  }

  _helmClear(it, dv, dt) {
    const L = it.lump, Ho = it.helmOff || (it.helmOff = new THREE.Vector3()), Hv = it.helmV || (it.helmV = new THREE.Vector3());
    L.position.add(Ho);
    const g0 = this._helmGap(it, dv, _hn);
    if (!(it.helmG < 8) || g0 >= 8) { it.helmG = g0; it.helmGv = 0; }
    else {
      const gv = (g0 - it.helmG) / Math.max(dt, 1e-3) - Hv.dot(_hn);
      it.helmGv += (gv - it.helmGv) * (1 - Math.exp(-dt / 0.1));
      it.helmG = g0;
    }
    const g = g0 + (it.state === 'collecting' ? Math.min(0, it.helmGv) * HELM_LEAD : 0);
    const ox = _hn.x, oy = _hn.y, oz = _hn.z;
    _hn.y -= 1;
    _hn.normalize();
    if (_hn.x * ox + _hn.y * oy + _hn.z * oz < 0.3) _hn.set(ox, oy, oz);
    _hw.copy(Ho);
    if (g < HELM_CLR) _hw.addScaledVector(_hn, HELM_CLR - g + 0.004);
    else if (g > HELM_CLR + 0.02 && Ho.lengthSq() > 1e-10) { const l = Ho.length(); _hw.multiplyScalar(1 - Math.min(1, (g - HELM_CLR - 0.02) / l, dt / HELM_BACK)); }
    const h = Math.min(dt, 1 / 30);
    Hv.addScaledVector(_hw.sub(Ho), HELM_W * HELM_W * h).multiplyScalar(1 / (1 + 2 * HELM_W * h)).clampLength(0, HELM_V);
    L.position.sub(Ho);
    Ho.addScaledVector(Hv, h);
    L.position.add(Ho);
  }
  _helmFinal(it, dv) {
    const g = this._helmGap(it, dv, _hn);
    if (g < HELM_FLOOR) { it.lump.position.addScaledVector(_hn, HELM_FLOOR - g); it.lump.updateMatrixWorld(); }
  }
  _helmGap(it, dv, n) {
    const A = dv.anchors && dv.anchors.helmet, L = it.lump;
    if (!A) return 9;
    if (this._helmOf !== dv) {
      this._helmOf = dv;
      const pts = [];
      A.updateWorldMatrix(true, false);
      const Ai = new THREE.Matrix4().copy(A.matrixWorld).invert(), T = new THREE.Matrix4(), p = new THREE.Vector3();
      dv.group.updateMatrixWorld(true);
      dv.group.traverse((o) => {
        if (!o.isSkinnedMesh) return;
        for (const bn of ['dv_cors', 'dv_plate']) {
          const bi = o.skeleton.bones.findIndex((b) => b.name === bn);
          if (bi < 0) continue;
          const P = o.geometry.attributes.position, SI = o.geometry.attributes.skinIndex, SW = o.geometry.attributes.skinWeight;
          T.copy(Ai).multiply(o.matrixWorld).multiply(o.bindMatrixInverse).multiply(o.skeleton.bones[bi].matrixWorld).multiply(o.skeleton.boneInverses[bi]).multiply(o.bindMatrix);
          for (let i = 0; i < P.count; i += 2) if (SI.getX(i) === bi && SW.getX(i) > 0.99) { p.set(P.getX(i), P.getY(i), P.getZ(i)).applyMatrix4(T); if (p.z < 0.15) pts.push(p.x, p.y, p.z); }
        }
      });
      const m = pts.length / 3, st = Math.max(1, Math.floor(m / HELM_N)), a = [];
      for (let i = 0; i < m; i += st) a.push(pts[i * 3], pts[i * 3 + 1], pts[i * 3 + 2]);
      const ns = a.length / 3, own = new Int32Array(m), cnt = new Int32Array(ns + 1);
      const G = new Map(), key = (x, y, z) => ((Math.floor(x / 0.05) + 64) * 128 + Math.floor(y / 0.05) + 64) * 128 + Math.floor(z / 0.05) + 64;
      for (let j = 0; j < ns; j++) { const kk = key(a[j * 3], a[j * 3 + 1], a[j * 3 + 2]); if (!G.has(kk)) G.set(kk, []); G.get(kk).push(j); }
      for (let i = 0; i < m; i++) {
        const x = pts[i * 3], y = pts[i * 3 + 1], z = pts[i * 3 + 2];
        let bd = 9, bj = -1;
        for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
          const c = G.get(key(x + dx * 0.05, y + dy * 0.05, z + dz * 0.05));
          if (c) for (const j of c) { const ex = x - a[j * 3], ey = y - a[j * 3 + 1], ez = z - a[j * 3 + 2], d = ex * ex + ey * ey + ez * ez; if (d < bd) { bd = d; bj = j; } }
        }
        if (bj < 0) for (let j = 0; j < ns; j++) { const ex = x - a[j * 3], ey = y - a[j * 3 + 1], ez = z - a[j * 3 + 2], d = ex * ex + ey * ey + ez * ez; if (d < bd) { bd = d; bj = j; } }
        own[i] = bj; cnt[bj + 1]++;
      }
      for (let j = 0; j < ns; j++) cnt[j + 1] += cnt[j];
      const at = cnt.slice(), all = new Float32Array(m * 3);
      for (let i = 0; i < m; i++) { const k = at[own[i]]++; all[k * 3] = pts[i * 3]; all[k * 3 + 1] = pts[i * 3 + 1]; all[k * 3 + 2] = pts[i * 3 + 2]; }
      this._helmPts = new Float32Array(a); this._helmAll = all; this._helmAt = cnt;
    }
    const H = this._helmPts, HA = this._helmAll, HC = this._helmAt;
    if (!H || !H.length) return 9;
    A.updateWorldMatrix(true, false);
    L.updateMatrixWorld();
    if (it.rg && it.rg.on) _m.multiplyMatrices(L.matrixWorld, it.rg.Cl).invert().multiply(A.matrixWorld);
    else _m.copy(L.matrixWorld).invert().multiply(A.matrixWorld);
    const e = _m.elements, R = 0.5;
    let best = 9, bx = 0, by = 0, bz = 0;
    const near = _hk; near[0] = near[1] = near[2] = -1; near[3] = near[4] = near[5] = 9;
    const at = (x, y, z) => {
      const lx = e[0] * x + e[4] * y + e[8] * z + e[12], ly = e[1] * x + e[5] * y + e[9] * z + e[13], lz = e[2] * x + e[6] * y + e[10] * z + e[14];
      if (lx * lx + ly * ly + lz * lz > R * R) return 9;
      const d = it.sdf(lx, ly, lz) * LUMP_S;
      if (d < best) { best = d; bx = lx; by = ly; bz = lz; }
      return d;
    };
    for (let j = 0, k = 0; k < H.length; j++, k += 3) {
      const d = at(H[k], H[k + 1], H[k + 2]);
      if (d < near[5]) {
        if (d < near[3]) { near[2] = near[1]; near[5] = near[4]; near[1] = near[0]; near[4] = near[3]; near[0] = j; near[3] = d; }
        else if (d < near[4]) { near[2] = near[1]; near[5] = near[4]; near[1] = j; near[4] = d; }
        else { near[2] = j; near[5] = d; }
      }
    }
    for (let q = 0; q < 3; q++) { const j = near[q]; if (j < 0) continue; for (let k = HC[j] * 3, k1 = HC[j + 1] * 3; k < k1; k += 3) at(HA[k], HA[k + 1], HA[k + 2]); }
    if (best >= 9) return 9;
    n.set(-bx, -by, -bz).transformDirection(it.rg && it.rg.on ? _m2.multiplyMatrices(L.matrixWorld, it.rg.Cl) : L.matrixWorld);
    return best;
  }

  _gripAxis(it, out) {
    if (it.uR0) return out.subVectors(it.uR0, it.uL).setZ(0).normalize();
    return out.subVectors(it.gR, it.gL).setZ(0).normalize();
  }

  _stowTurn(it) {
    const q = it.stowQ2 || (it.stowQ2 = new THREE.Quaternion());
    this._gripAxis(it, _a);
    _b.set(0, 0, 1);
    _q$1.setFromRotationMatrix(_m.makeBasis(_a, _c.crossVectors(_b, _a), _b));
    _d.set(0, 0, 1).applyQuaternion(it.stowQ);
    _s$2.set(_d.x < 0 ? -1 : 1, 0, 0);
    _e$1.set(0, 0, -1);
    q.setFromRotationMatrix(_m.makeBasis(_e$1, _c.crossVectors(_s$2, _e$1), _s$2)).multiply(_q$1.invert());
  }

  _stowRise(it, dv) {
    const S = it.stowS || (it.stowS = makeStow()), cu = this.cu, C = dv.anchors.chest;
    S.phase = 'rise'; S.let = false; S.tR = S.tL = -1; S.rideT = 0; S.s = 0; S.seatW = 1;
    it.stowPO = 0;
    for (const x of this.items) if (x.riding && x !== it) this._ride(x, null, dv, 0);
    C.updateWorldMatrix(true, false);
    it.lump.updateMatrixWorld();
    S.relC.copy(C.matrixWorld).invert().multiply(it.lump.matrixWorld);
    S.c0.setFromMatrixPosition(S.relC);
    S.c1.copy(S.c0).multiply(_a.set(0.85, 1, 0.85));
    S.c1.y -= 0.15;
    it.stowD = cu.plan.rise + 2.4;
    if (cu.riseT < 0) cu.riseT = 0;
    (it.clearOff || (it.clearOff = new THREE.Vector3())).set(0, 0, 0);
    it.clearMax = 0;
    if (!it.netH) {
      const Pp = it.lump.geometry.attributes.position, st = Math.max(1, Math.floor(Pp.count / 48)), a = [];
      for (let i = 0; i < Pp.count; i += st) a.push(Pp.getX(i), Pp.getY(i), Pp.getZ(i));
      it.clPts = new Float32Array(a);
      const bb = it.lump.geometry.boundingBox;
      const H = (it.netH = new THREE.Vector3(Math.max(bb.max.x, -bb.min.x), Math.max(bb.max.y, -bb.min.y), Math.max(bb.max.z, -bb.min.z)));
      const q = [];
      for (let i = 0; i < Pp.count; i++) q.push((Pp.getX(i) / H.x) ** 2 + (Pp.getY(i) / H.y) ** 2);
      q.sort((x, y) => x - y);
      const k = Math.max(1, q[Math.floor(q.length * 0.97)]);
      H.x *= Math.sqrt(k); H.y *= Math.sqrt(k);
    }
  }

  _stowPlan(it, dv) {
    const S = it.stowS, g = dv.group, C = S.caps, W = S.W;
    it.stowP.copy(it.lump.position).sub(it.clearOff);
    g.worldToLocal(it.stowP);
    it.stowQ.copy(g.quaternion).invert().multiply(it.lump.quaternion);
    this._gripAxis(it, _a);
    _b.set(0, 0, 1);
    _q$1.setFromRotationMatrix(_m.makeBasis(_a, _c.crossVectors(_b, _a), _b));
    _d.set(0, 0, 1).applyQuaternion(it.stowQ);
    _s$2.set(0, 0, _d.z < 0 ? -1 : 1);
    _e$1.set(1, 0, 0);
    S.qF.setFromRotationMatrix(_m.makeBasis(_e$1, _c.crossVectors(_s$2, _e$1), _s$2)).multiply(_q$1.invert());
    it.stowQ2 = (it.stowQ2 || new THREE.Quaternion()).setFromAxisAngle(Y, Math.PI / 2).multiply(S.qF);
    dv.bodyCapsules(C);
    const at = (i, e, o) => g.worldToLocal(o.set(C[i * 7 + (e ? 3 : 0)], C[i * 7 + (e ? 4 : 1)], C[i * 7 + (e ? 5 : 2)]));
    const SL = at(5, 0, S.SL), PV = at(0, 0, S.PV), SR = at(2, 0, S.SR);
    g.worldToLocal(dv.anchors.chest.getWorldPosition(S.C0));
    this._bagWorld(S.M0);
    const M = g.worldToLocal(S.M0), out = S.out.set(M.x - PV.x, 0, M.z - PV.z);
    if (out.lengthSq() < 1e-6) out.set(-1, 0, 0);
    out.normalize();
    dv.anchors.bagMouth.getWorldQuaternion(_q$1);
    const up = S.up.set(0, 1, 0).applyQuaternion(_q2$1.copy(g.quaternion).invert().multiply(_q$1));
    _d.set(0, 1, 0).applyQuaternion(_q$1.copy(it.stowQ2).invert()).setZ(0).normalize();
    S.gA = Math.atan2(it.gL.y, it.gL.x);
    const dA = Math.atan2(_d.y, _d.x) - S.gA;
    S.gD = dA - 2 * Math.PI * Math.round(dA / (2 * Math.PI));
    S.gl.copy(it.gL);
    S.turnT = Math.max(STOW_TURN, (1.5 * Math.abs(S.gD) * Math.hypot(it.gL.x, it.gL.y) * it.lump.scale.x) / GRIP_SLIDE_V);
    const sc = it.lump.scale.x, bb = it.lump.geometry.boundingBox;
    S.hx = Math.max(bb.max.z, -bb.min.z) * sc;
    S.hy = (Math.max(it.top.extent(_d.x, _d.y) || 0.14, it.top.extent(-_d.x, -_d.y) || 0.14) + 0.01) * sc;
    this._gripAxis(it, _a).negate();
    S.hz = Math.max(it.top.extent(_a.x, _a.y) || 0.18, it.top.extent(-_a.x, -_a.y) || 0.18) * sc;
    _n.set(0, 0, 1).applyQuaternion(it.stowQ2);
    S.glZ = (_n.x > 0 ? -1 : 1) * (Math.max(bb.max.z, -bb.min.z) + 0.03 / sc);
    W[0].copy(it.stowP);
    W[1].set(0.5 * (SL.x + SR.x), SL.y - 0.46, SL.z - 0.42);
    W[2].copy(M).addScaledVector(out, 0.07 + S.hx).addScaledVector(up, -0.1).add(_a.set(0, 0, -(S.hz + 0.15)));
    const A = dv.anchors.bagMouth;
    _q$1.copy(g.quaternion).premultiply(A.getWorldQuaternion(_q2$1).invert());
    _d.copy(out).applyQuaternion(_q$1).setY(0);
    S.W3b.set(0.03 * _d.x, S.hy + 0.025, 0.03 * _d.z);
    S.W4b.set(0.03 * _d.x, 0.04 - 0.62 * S.hy, 0.03 * _d.z);
    S.drop = 0.38 * S.hy + 0.06;
    S.v0 = 0.6 * (it.pace === PACE_FULL ? 1.15 : 1.25);
    S.dropT = (Math.sqrt(S.v0 * S.v0 + 7 * S.drop) - S.v0) / 3.5;
    g.worldToLocal(A.localToWorld(W[3].copy(S.W3b)));
    g.worldToLocal(A.localToWorld(W[4].copy(S.W4b)));
    S.Wb.copy(W[3]).add(_a.set(-0.05, -0.02, -0.12));
    const caps = [[0, 0.21], [1, 0.23], [8, 0.1], [9, 0.08], [11, 0.1], [12, 0.08]];
    const rig = it.rg && it.rg.on;
    if (rig) {
      const sc = it.lump.scale.x;
      (S.gLr || (S.gLr = new THREE.Vector3())).setFromMatrixPosition(it.rg.OL).multiplyScalar(sc);
      _m2.copy(it.rg.O).invert();
      (S.gRr || (S.gRr = new THREE.Vector3())).setFromMatrixPosition(_m2).multiplyScalar(sc);
    }
    for (const Wp of [W[1], W[2], S.Wb, W[3]]) {
      const ax = Wp === W[1] ? S.hz : S.hx, az = Wp === W[1] ? S.hx : S.hz;
      for (let rep = 0; rep < 2; rep++) {
        for (let pass = 0; pass < 2; pass++) {
          for (const [ci, r] of caps) this._pushOut(Wp, at(ci, 0, _b), at(ci, 1, _c), r, ax, S.hy, az);
          this._pushOut(Wp, at(2, 0, _b), SL, 0.12, ax, S.hy, az);
        }
        const qW = Wp === W[1] ? S.qF : it.stowQ2;
        if (rig) _d.copy(S.gLr).applyQuaternion(qW).add(Wp).sub(SL); else _d.copy(Wp).addScaledVector(Y, S.hy).sub(SL);
        const d = _d.length(), rl = rig ? STOW_HOLD : 0.5;
        if (d > rl) Wp.addScaledVector(_d, (rl - d) / d);
        if (Wp === W[1]) {
          if (rig) _d.copy(S.gRr).applyQuaternion(qW).add(Wp).sub(SR); else _d.copy(Wp).addScaledVector(_a.set(1, 0, 0), 0.9 * S.hz).sub(SR);
          const dR = _d.length();
          if (dR > rl) Wp.addScaledVector(_d, (rl - dR) / dR);
        }
      }
    }
    S.belly.copy(PV).add(_a.set(0.2, 0.2, -0.36));
    if (!S.curve) S.curve = new THREE.CatmullRomCurve3([W[0], W[1], W[2], S.Wb, W[3]], false, 'centripetal');
    S.curve.updateArcLengths();
    const Ls = S.curve.getLengths(240);
    for (let k = 0; k < 3; k++) S.sW[k] = Ls[k * 60];
    S.sWb = Ls[180];
    S.sW[3] = Ls[240];
    S.sW[4] = S.sW[3] + W[3].distanceTo(W[4]);
    S.L = S.sW[4];
    const fast = it.pace === PACE_FULL ? 1.15 : 1.25, vm = 0.9 * fast, v3 = 0.6 * fast, a0 = vm / 0.3, h = 1 / 120;
    let sx = 0, v = 0, n = 0;
    S.ts[n++] = 0;
    while (sx < S.L && n < S.ts.length) {
      const vc = sx < S.sW[2] ? vm : 0.85 * vm;
      const tgt = sx < S.sW[1] ? Math.min(vm, S.sW[1] / S.turnT + 0.02) : sx < S.sW[3] - 0.12 ? vc : sx < S.sW[3] ? lerp$3(vc, v3, (sx - S.sW[3] + 0.12) / 0.12) : v3;
      v = tgt > v ? Math.min(tgt, v + a0 * h) : tgt;
      sx = Math.min(S.L, sx + v * h);
      S.ts[n++] = sx;
    }
    S.n = n;
    S.TA = (n - 1) * h;
    it.stowD = S.tW + S.TA + 0.1;
    S.s = 0;
  }
  _stowAt(S, s, out) {
    if (s <= S.sW[3]) return S.curve.getPointAt(Math.min(1, s / Math.max(S.sW[3], 1e-4)), out);
    return out.lerpVectors(S.W[3], S.W[4], (s - S.sW[3]) / Math.max(S.sW[4] - S.sW[3], 1e-4));
  }
  _pushOut(p, a, b, r, hx, hy, hz) {
    _e$1.subVectors(b, a);
    const l2 = _e$1.lengthSq(), t = l2 > 1e-8 ? clamp$9(_n.subVectors(p, a).dot(_e$1) / l2, 0, 1) : 0;
    _n.copy(a).addScaledVector(_e$1, t);
    _e$1.subVectors(p, _n);
    const d = _e$1.length();
    if (d < 1e-5) return;
    _e$1.divideScalar(d);
    const need = r + Math.abs(_e$1.x) * hx + Math.abs(_e$1.y) * hy + Math.abs(_e$1.z) * hz + 0.03;
    if (d < need) p.addScaledVector(_e$1, need - d);
  }

  _stowStep(it, dv, tS) {
    const S = it.stowS, g = dv.group, cu = this.cu;
    this._bagSteady(S, dv, tS);
    if (S.phase === 'rise') {
      const k = easeInOut(clamp$9(tS / cu.plan.rise, 0, 1));
      _m.copy(S.relC).setPosition(_a.lerpVectors(S.c0, S.c1, k)).premultiply(dv.anchors.chest.matrixWorld);
      _m.decompose(it.lump.position, it.lump.quaternion, _s$2);
      it.lump.position.add(it.clearOff);
      if (tS < STOW_WAY * cu.plan.rise) return;
      S.phase = 'way'; S.tW = tS; S.tv = 0; S.tLast = tS; S.pOn = false;
      this._stowPlan(it, dv);
    }
    g.worldToLocal(dv.anchors.chest.getWorldPosition(S.offC)).sub(S.C0);
    const h = Math.max(0, tS - S.tLast);
    S.tLast = tS;
    if (!S.let) {
      let tv = S.tv + h, sv = this._stowWay(it, dv, tv, _a);
      if (S.pOn) {
        const d = _a.distanceTo(S.lastP), cap = (it.pace === PACE_FULL ? 0.95 : 1.05) * h;
        if (d > cap && d > 1e-6) { tv = S.tv + (h * cap) / d; sv = this._stowWay(it, dv, tv, _a); }
      }
      S.tv = tv; S.s = sv; S.lastP.copy(_a); S.pOn = true;
      it.stowD = Math.max(it.stowD, tS + 0.2);
    }
    const s = S.s;
    if (!S.let && S.tv >= S.TA) {
      S.let = true; S.letT = tS; S.rideT = 0;
      if (it.rg.on) {
        it.actM.decompose(it.lump.position, it.lump.quaternion, _rs);
        it.rg.on = false;
        if (it.actV) {
          dv.anchors.bagMouth.getWorldQuaternion(_q$1);
          const vd = -it.actV.dot(_e$1.set(0, 1, 0).applyQuaternion(_q$1));
          S.v0 = clamp$9(vd, 0, S.v0);
          S.dropT = (Math.sqrt(S.v0 * S.v0 + 7 * S.drop) - S.v0) / 3.5;
        }
      }
      it.lump.updateMatrixWorld();
      dv.anchors.bagMouth.updateWorldMatrix(true, false);
      S.rel.copy(dv.anchors.bagMouth.matrixWorld).invert().multiply(it.lump.matrixWorld);
      if (dv.bagFill) dv.bagFill(Math.min(1, (this.collected + 1) / 3), 0.4);
      it.stowD = tS + 0.07;
    }
    if (!S.let) {
      const kb = sstep$7(S.sW[2], S.sW[3], s);
      it.lump.position.copy(_a.add(it.clearOff));
      const kT = sstep$7(0, S.turnT, S.tv), kG = sstep$7(SLIDE_WAIT, SLIDE_WAIT + S.turnT, S.tv + S.tW);
      _n.set(0, 1, 0).applyQuaternion(S.bQ2);
      _q2$1.setFromUnitVectors(Y, _n).slerp(QI, 1 - kb);
      _q$1.slerpQuaternions(it.stowQ, S.qF, kT).slerp(it.stowQ2, sstep$7(S.sW[1], S.sW[2], s));
      it.lump.quaternion.copy(g.quaternion).multiply(_q2$1).multiply(_q$1);
      const a = S.gA + S.gD * kG;
      rimEdge(it.rim, Math.cos(a), Math.sin(a), S.gl, it.offL);
      S.gl.z -= GRIP_BACK_L;
      S.gl.z = lerp$3(S.gl.z, S.glZ, sstep$7(S.sW[1], S.sW[2], s));
      S.gl.lerp(this._onSurface(it, _e$1.copy(S.gl), STOW_PALM + it.stowPO), kG);
    }
    if (dv.bagHold) { const w = sstep$7(S.sW[1], S.sW[2], s) * (S.let ? 1 - sstep$7(S.letT, S.letT + BAG_BACK, tS) : 1); dv.bagHold(w, STOW_BACK * w); }
  }
  _bagSteady(S, dv, tS) {
    const g = dv.group, A = dv.anchors.bagMouth;
    g.updateWorldMatrix(true, false);
    A.updateWorldMatrix(true, false);
    _m.copy(g.matrixWorld).invert().multiply(A.matrixWorld).decompose(_a, _q$1, _s$2);
    if (!S.bOn) { S.bP.copy(_a); S.bP2.copy(_a); S.bQ.copy(_q$1); S.bQ2.copy(_q$1); S.bOn = true; }
    else {
      const k = 1 - Math.exp(-Math.max(0, tS - S.bT) / BAG_STEADY);
      S.bP.lerp(_a, k); S.bP2.lerp(S.bP, k); S.bQ.slerp(_q$1, k); S.bQ2.slerp(S.bQ, k);
    }
    S.bT = tS;
    S.bM.compose(S.bP2, S.bQ2, _s$2).premultiply(g.matrixWorld);
  }
  _onSurface(it, p, clr) {
    const c = clr / LUMP_S;
    for (let k = 0; k < 12; k++) {
      const d = it.sdf(p.x, p.y, p.z) - c, l = p.length();
      if (d < 2e-4 || l < 1e-4) break;
      p.multiplyScalar(Math.max(0, l - d) / l);
    }
    return p;
  }
  _stowWay(it, dv, tv, out) {
    const S = it.stowS, g = dv.group; dv.anchors.bagMouth;
    const kk = Math.min(S.n - 1, tv * 120), i = Math.floor(kk), f = kk - i;
    const s = i + 1 < S.n ? lerp$3(S.ts[i], S.ts[i + 1], f) : S.ts[S.n - 1];
    const km = clamp$9((s - S.sW[1]) / Math.max(S.sW[3] - S.sW[1], 1e-4), 0, 1);
    if (s <= S.sW[3]) {
      this._stowAt(S, s, out);
      g.worldToLocal(_b.copy(S.W3b).applyMatrix4(S.bM)).sub(S.W[3]);
      g.localToWorld(out.addScaledVector(_b, km).addScaledVector(S.offC, 1 - km));
    } else out.lerpVectors(S.W3b, S.W4b, (s - S.sW[3]) / Math.max(S.sW[4] - S.sW[3], 1e-4)).applyMatrix4(S.bM);
    return s;
  }

  _inBag(it, dv, dt) {
    const S = it.stowS, A = dv && dv.anchors && dv.anchors.bagMouth;
    if (!S || !S.let || !A) return;
    S.rideT += dt;
    A.updateWorldMatrix(true, false);
    _m.multiplyMatrices(A.matrixWorld, S.rel);
    _m.decompose(it.lump.position, it.lump.quaternion, _s$2);
    _e$1.set(0, 1, 0).transformDirection(A.matrixWorld);
    it.lump.position.addScaledVector(_e$1, -this._dropAt(S, S.rideT));
    if (!it.snugOff) it.snugOff = new THREE.Vector3();
    it.lump.position.add(_e$1.copy(it.snugOff).transformDirection(A.matrixWorld).multiplyScalar(it.snugOff.length()));
    this._snug(it, dv, dt);
    it.lump.position.add(_e$1.copy(it.snugD).transformDirection(A.matrixWorld).multiplyScalar(it.snugD.length()));
    it.lump.updateMatrixWorld();
  }
  _snug(it, dv, dt) {
    const A = dv && dv.anchors && dv.anchors.bagMouth;
    if (!it.snugOff) it.snugOff = new THREE.Vector3();
    if (!it.snugD) it.snugD = new THREE.Vector3();
    it.snugD.set(0, 0, 0);
    if (!A || !dv.group || !(dt > 0)) return;
    if (this._snugOf !== dv) { this._snugOf = dv; this._snugB = [dv.group.getObjectByName('dv_thighL'), dv.group.getObjectByName('dv_shinL')]; }
    const T0 = this._snugB[0], T1 = this._snugB[1];
    if (!T0 || !T1) return;
    const L = it.lump;
    L.updateMatrixWorld();
    _m2.copy(L.matrixWorld).invert();
    T0.getWorldPosition(_a); T1.getWorldPosition(_b);
    _s$2.subVectors(_b, _a).normalize();
    _n.set(1, 0, 0);
    if (Math.abs(_n.dot(_s$2)) > 0.9) _n.set(0, 0, 1);
    _n.cross(_s$2).normalize();
    const nx = _n.x, ny = _n.y, nz = _n.z;
    let gap = 9;
    for (let i = 0; i <= 8; i++) {
      _c.lerpVectors(_a, _b, 0.1 + (0.7 * i) / 8);
      for (let k = 0; k < 10; k++) {
        _n.set(nx, ny, nz).applyAxisAngle(_s$2, (k / 10) * Math.PI * 2);
        _d.copy(_c).addScaledVector(_n, SNUG_R).applyMatrix4(_m2);
        const g = it.sdf(_d.x, _d.y, _d.z) * LUMP_S;
        if (g < gap) { gap = g; _e$1.copy(_c); }
      }
    }
    if (gap > 1) return;
    L.getWorldPosition(_c);
    _e$1.sub(_c);
    _d.set(0, 1, 0).transformDirection(A.matrixWorld);
    _e$1.addScaledVector(_d, -_e$1.dot(_d));
    if (_e$1.lengthSq() < 1e-8) return;
    _e$1.normalize();
    const step = clamp$9((gap - SNUG_GAP) * (1 - Math.exp(-dt / SNUG_T)), -SNUG_V * dt, SNUG_V * dt);
    _q$1.copy(A.getWorldQuaternion(_q$1)).invert();
    _e$1.applyQuaternion(_q$1).multiplyScalar(step);
    _d.copy(it.snugOff).add(_e$1);
    if (_d.length() > SNUG_MAX) _d.setLength(SNUG_MAX);
    it.snugD.subVectors(_d, it.snugOff);
    it.snugOff.copy(_d);
  }
  _dropAt(S, t) {
    const v0 = S.v0 || 0;
    if (t < S.dropT) return v0 * t + 1.75 * t * t;
    const tb = t - S.dropT;
    return S.drop + (v0 + 3.5 * S.dropT) * tb * Math.exp(-tb / NET_GIVE);
  }

  _rideOn(it, dv) {
    const A = dv.anchors && dv.anchors.bagMouth;
    if (!A || !it.stowS || !it.stowS.let) { it.lump.visible = false; return; }
    A.attach(it.lump);
    it.riding = true;
    it.rideT = 0;
    it.dropT = it.stowS.rideT;
    it.rideSkip = true;
  }
  _ride(it, cam, dv, dt) {
    if (it.rideSkip && dt > 0) { it.rideSkip = false; return; }
    it.rideSkip = false;
    it.rideT += dt;
    const k = this.collected >= 3 ? 1 - sstep$7(0.4, 0.75, it.rideT) : 1, L = it.lump, S = it.stowS;
    const dropping = !!(S && it.dropT < Math.max(S.dropT + 0.35, BAG_BACK + 0.05));
    if (dropping) {
      const d0 = this._dropAt(S, it.dropT);
      it.dropT += dt;
      L.position.y -= this._dropAt(S, it.dropT) - d0;
      if (dv && dv.bagHold) { const w = 1 - sstep$7(0, BAG_BACK, it.dropT); dv.bagHold(w, STOW_BACK * w); }
    }
    const settling = Math.abs(L.position.x) > 0.002;
    if (settling) L.position.x *= Math.exp(-dt * 6 * sstep$7(0, 0.25, it.rideT));
    if (k > 0 && dv && cam && this._seen(L, cam, dv)) {
      L.material.opacity = k;
      if ((k < 1 || dropping || settling) && dv.bagFind) { L.updateWorldMatrix(true, false); dv.bagFind(L.matrixWorld, it.netH, k, k * sstep$7(0, BAG_BACK, it.dropT)); }
      return;
    }
    this.scene.attach(L);
    L.visible = false;
    L.material.opacity = 1;
    it.riding = false;
    if (dv && dv.bagFind) dv.bagFind(null);
    if (dv && dv.bagHold) dv.bagHold(0);
  }
  _seen(L, cam, dv) {
    L.updateWorldMatrix(true, false);
    cam.updateMatrixWorld();
    _fr.setFromProjectionMatrix(_m.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
    const geo = L.geometry;
    if (!geo.boundingSphere) geo.computeBoundingSphere();
    if (!_fr.intersectsSphere(_sph.copy(geo.boundingSphere).applyMatrix4(L.matrixWorld))) return false;
    const C = _cp;
    dv.bodyCapsules(C);
    _b.set(C[0], C[1], C[2]);
    _c.set(C[3], C[4], C[5]);
    _e$1.set(1, 0, 0).transformDirection(L.matrixWorld);
    for (let k = -1; k <= 1; k++) {
      _d.copy(_sph.center).addScaledVector(_e$1, 0.17 * k);
      if (segDist$1(cam.position, _d, _b, _c) > 0.85 * C[6]) return true;
    }
    return false;
  }

  _clearBody(it, dv, dt, tS = 9) {
    const S = it.stowS, H = it.hands, C = S.caps, L = it.lump, pts = it.clPts;
    if (!pts || !dv.bodyCapsules) return;
    let n = dv.bodyCapsules(C) / 7;
    for (let k = 0; k < 7; k++) C[n * 7 + k] = k < 3 ? C[2 * 7 + k] : k < 6 ? C[5 * 7 + k - 3] : 0.12;
    n++;
    let px = 0, py = 0, pz = 0;
    const p0x = L.position.x, p0y = L.position.y, p0z = L.position.z;
    for (let pass = 0; pass < 2; pass++) {
      L.position.set(p0x + px, p0y + py, p0z + pz);
      L.updateMatrixWorld();
      const e = L.matrixWorld.elements, cx = e[12], cy = e[13], cz = e[14];
      let best = 0, nx = 0, ny = 0, nz = 0;
      for (let c = 0; c < n; c++) {
        if (c >= 2 && c <= 4 && (H.holdR || (S.tR >= 0 && H.wr > 0.15))) continue;
        if (c >= 5 && c <= 7 && H.holdL) continue;
        const o = c * 7, ax = C[o], ay = C[o + 1], az = C[o + 2], bx = C[o + 3] - ax, by = C[o + 4] - ay, bz = C[o + 5] - az, r = C[o + 6] + 0.01;
        const l2 = bx * bx + by * by + bz * bz;
        let t = l2 > 1e-8 ? clamp$9(((cx - ax) * bx + (cy - ay) * by + (cz - az) * bz) / l2, 0, 1) : 0;
        const qx = cx - ax - bx * t, qy = cy - ay - by * t, qz = cz - az - bz * t;
        if (qx * qx + qy * qy + qz * qz > (r + 0.3) * (r + 0.3)) continue;
        for (let k = 0; k < pts.length; k += 3) {
          const x = pts[k], y = pts[k + 1], z = pts[k + 2];
          const wx = e[0] * x + e[4] * y + e[8] * z + cx - ax, wy = e[1] * x + e[5] * y + e[9] * z + cy - ay, wz = e[2] * x + e[6] * y + e[10] * z + cz - az;
          t = l2 > 1e-8 ? clamp$9((wx * bx + wy * by + wz * bz) / l2, 0, 1) : 0;
          const dx = wx - bx * t, dy = wy - by * t, dz = wz - bz * t, d = Math.sqrt(dx * dx + dy * dy + dz * dz);
          const rr = c === 0 ? r - 0.03 * (1 - t) : r;
          if (d < 1e-5 || rr - d <= best) continue;
          best = rr - d; nx = dx / d; ny = dy / d; nz = dz / d;
        }
      }
      if (best <= 0) break;
      px += nx * best; py += ny * best; pz += nz * best;
    }
    const cap = 0.02 * sstep$7(0, 0.5, tS);
    const pl = Math.sqrt(px * px + py * py + pz * pz), pk = pl > cap ? cap / pl : 1;
    L.position.set(p0x + px * pk, p0y + py * pk, p0z + pz * pk);
    it.clearMax = Math.max(it.clearMax || 0, pl);
    it.clearOff.multiplyScalar(Math.exp(-dt * 1.5));
    it.clearOff.x += px * pk; it.clearOff.y += py * pk; it.clearOff.z += pz * pk;
  }

  _grip(it, dv) {
    const H = it.hands, cu = this.cu;
    if (dv) _a.set(1, 0, 0).applyQuaternion(dv.group.quaternion).setY(0).normalize(); else _a.copy(cu.st.r);
    _b.copy(_a).applyQuaternion(_q$1.copy(it.lump.quaternion).invert());
    const l = Math.hypot(_b.x, _b.y) || 1;
    let gx = _b.x / l, gy = _b.y / l;
    const sR = dv && dv.group.getObjectByName('dv_uarmR'), sL = dv && dv.group.getObjectByName('dv_uarmL');
    if (sR && sL) {
      sR.getWorldPosition(_c); sL.getWorldPosition(_d);
      it.lump.updateMatrixWorld();
      const margin = (ux, uy) => {
        const f = ((Math.atan2(uy, ux) / (2 * Math.PI)) * RIM_N + RIM_N) % RIM_N, k0 = Math.round(f);
        let m = 9;
        for (let j = -RIM_W - 1; j <= RIM_W + 1; j++) m = Math.min(m, it.rim.R[(k0 + j + RIM_N) % RIM_N] - it.wheelR);
        return m;
      };
      let best = 0, bv = Infinity;
      const cA = Math.cos(GRIP_A), sA = Math.sin(GRIP_A);
      for (let k = -12; k <= 12; k++) {
        const a = (k / 12) * GRIP_TURN, c = Math.cos(a), s = Math.sin(a), vx = c * gx - s * gy, vy = s * gx + c * gy;
        const ux = cA * vy + sA * vx, uy = -cA * vx + sA * vy, lx = cA * vy - sA * vx, ly = -cA * vx - sA * vy;
        rimGrip(it.rim, ux, uy, _e$1, GRIP_START);
        rimGrip(it.rim, lx, ly, _n, GRIP_START);
        const mw = Math.min(margin(ux, uy), margin(lx, ly));
        const v = Math.max(it.lump.localToWorld(_e$1).distanceTo(_c), it.lump.localToWorld(_n).distanceTo(_d)) + 0.02 * Math.abs(k / 12) + (mw < RIM_CLEAR ? 1 + (RIM_CLEAR - mw) * 10 : 0);
        if (v < bv) { bv = v; best = a; }
      }
      const c = Math.cos(best), s = Math.sin(best), ux = c * gx - s * gy;
      gy = s * gx + c * gy; gx = ux;
    }
    const st = cu.st;
    _c.subVectors(st.head2, st.Pp).normalize();
    _d.subVectors(st.Cx, st.Pp).normalize();
    _c.lerp(_d, PRESENT_LENS).normalize();
    _q$1.setFromUnitVectors(ZA, _c);
    _e$1.set(gx, gy, 0).applyQuaternion(_q$1);
    _s$2.copy(_a).addScaledVector(_c, -_a.dot(_c)).normalize();
    const ang = Math.atan2(_c.dot(_d.crossVectors(_e$1, _s$2)), _e$1.dot(_s$2));
    it.presentQ.setFromAxisAngle(_c, ang).multiply(_q$1);
    it.presentP.copy(st.Pp);
    _d.set(0, -1, 0).applyQuaternion(_q$1.copy(it.presentQ).invert());
    const dg = _d.x * gx + _d.y * gy;
    _d.x - dg * gx; _d.y - dg * gy;
    (it.uN || (it.uN = new THREE.Vector3())).set(gy, -gx, 0);
    const cA = Math.cos(GRIP_A), sA = Math.sin(GRIP_A);
    (it.uR0 || (it.uR0 = new THREE.Vector3())).set(cA * gy + sA * gx, -cA * gx + sA * gy, 0);
    (it.uR1 || (it.uR1 = new THREE.Vector3())).copy(it.uR0);
    it.uR.copy(it.uR1);
    it.uL.set(cA * gy - sA * gx, -cA * gx - sA * gy, 0);
    it.rg.on = false;
    for (let pass = 0, moved = 0; pass < 3 && moved < HOLD_IN; pass++) {
      let ex = 0;
      for (let a = 0; a < 2; a++) {
        const u = a ? it.uL : it.uR, h = HOLD_SH[a];
        rimGrip(it.rim, u.x, u.y, _e$1, GRIP_START);
        _e$1.multiplyScalar(LUMP_S).applyQuaternion(it.presentQ).add(it.presentP);
        _n.copy(st.head2).addScaledVector(st.r, h[0]).addScaledVector(Y, h[1]).addScaledVector(st.f, h[2]);
        const x = _e$1.distanceTo(_n) - HOLD_REACH;
        if (x > ex) { ex = x; _s$2.subVectors(_n, _e$1).normalize(); }
      }
      if (ex <= 1e-3) break;
      const m = Math.min(ex, HOLD_IN - moved);
      it.presentP.addScaledVector(_s$2, m);
      moved += m;
    }
    it.lump.updateMatrixWorld();
    it.offR = it.offL = GRIP_START;
    it.uR.copy(it.uR0);
    rimEdge(it.rim, it.uR.x, it.uR.y, it.gR, it.offR);
    rimEdge(it.rim, it.uL.x, it.uL.y, it.gL, it.offL);
    it.gR.z -= GRIP_BACK_R; it.gL.z -= GRIP_BACK_L;
    if (dv) { dv.anchors.rightHand.getWorldPosition(H.fromR); dv.anchors.leftHand.getWorldPosition(H.fromL); } else { H.fromR.copy(st.Pp); H.fromL.copy(st.Pp); }
    const cuB = this.cu.active && this.cu.it === it && !this.cu.brushGone;
    if (cuB) this._beltWorld(H.fromR);
    it.lump.updateMatrixWorld();
    const dR = H.fromR.distanceTo(it.lump.localToWorld(_a.copy(it.gR))), dL = H.fromL.distanceTo(it.lump.localToWorld(_b.copy(it.gL)));
    it.handT = 0;
    it.durL = Math.max(0.45, (1.5 * dL) / HAND_V);
    it.durR = Math.max(0.45, (1.5 * dR) / HAND_V);
    H.goR = cuB ? -1 : 0;
    it.handDur = Math.max(it.durL, (cuB ? HAND_LEAD : 0) + it.durR);
    H.optR.grip = 0.7; H.optL.grip = 0.68;
    H.on = true;
  }

  _gripGap(it, dv) {
    if (!dv || !dv.anchors || !dv.anchors.rightHand) return 0;
    it.lump.updateMatrixWorld();
    it.lump.localToWorld(_a.copy(it.gR));
    it.lump.localToWorld(_b.copy(it.gL));
    return Math.max(_a.distanceTo(dv.anchors.rightHand.getWorldPosition(_c)), _b.distanceTo(dv.anchors.leftHand.getWorldPosition(_d)));
  }

  _handTargets(it) {
    const H = it.hands, P = it.pace;
    if (!H.on) { H.wr = H.wl = 0; H.holdR = H.holdL = false; return; }
    H.rP.copy(H.r); H.lP.copy(H.l);
    if (it.uR0 && it.uR1) {
      const tB = P.rev + P.tug, kU = it.state === 'lifting' ? sstep$7(tB, tB + P.rise, it.t) : 1;
      const a0 = Math.atan2(it.uR0.y, it.uR0.x);
      let da = Math.atan2(it.uR1.y, it.uR1.x) - a0;
      da -= 2 * Math.PI * Math.round(da / (2 * Math.PI));
      it.uR.set(Math.cos(a0 + da * kU), Math.sin(a0 + da * kU), 0);
    }
    rimEdge(it.rim, it.uR.x, it.uR.y, it.gR, it.offR);
    rimEdge(it.rim, it.uL.x, it.uL.y, it.gL, it.offL);
    it.gR.z -= GRIP_BACK_R; it.gL.z -= GRIP_BACK_L;
    it.touchInv.copy(it.lump.matrixWorld).invert();
    it.lump.localToWorld(_a.copy(it.gR));
    const gl = it.stowS && it.released && it.stowS.phase === 'way' ? it.stowS.gl : it.gL;
    it.lump.localToWorld(_b.copy(gl));
    _n.set(0, 0, 1).transformDirection(it.lump.matrixWorld);
    for (let a = 0; a < 2; a++) {
      const g = a ? gl : it.gR, o = a ? H.optL : H.optR;
      o.curl = null; o.fingers = null; o.tight = false; o.follow = null;
      o.palm.set(-g.x, -g.y, 0).normalize();
      if (it.uN) o.palm.addScaledVector(_s$2.copy(it.uN).negate(), GRIP_PALM_IN).normalize();
      o.palm.transformDirection(it.lump.matrixWorld);
      o.edge.x = NaN;
      if (it.uN && !it.released) o.fingers = (o.fingerV || (o.fingerV = new THREE.Vector3())).set(0, 0, -1).transformDirection(it.lump.matrixWorld);
      o.still = it.state === 'collecting' && !it.released;
      o.touch = it.released ? it.touchS : it.touch;
      if (it.stowS && it.released && (it.stowS.let || (!a && it.stowS.tR >= 0))) o.touch = null;
    }
    const T = it.t, cu = this.cu;
    if (H.goR < 0 && (!cu.active || cu.it !== it || cu.brushGone)) {
      H.goR = it.handT;
      if (cu.active && cu.diver) cu.diver.anchors.rightHand.getWorldPosition(H.fromR);
      H.palm0R.copy(cu.palmW);
      it.durR = Math.max(0.45, (1.5 * H.fromR.distanceTo(_a)) / HAND_V);
      it.handDur = Math.max(it.durL || 0, H.goR + it.durR);
    }
    const lift = it.state === 'lifting', uL = lift ? clamp$9(it.handT / (it.durL || it.handDur), 0, 1) : 1;
    const uR = !lift ? 1 : H.goR < 0 ? 0 : clamp$9((it.handT - H.goR) / (it.durR || it.handDur), 0, 1);
    const kR = uR * uR * (3 - 2 * uR), kL = uL * uL * (3 - 2 * uL);
    H.r.lerpVectors(H.fromR, _a, kR);
    H.r.y += 0.05 * Math.sin(Math.PI * uR);
    H.l.lerpVectors(H.fromL, _b, kL);
    H.l.y += 0.05 * Math.sin(Math.PI * uL);
    if (lift && uR < 1) H.optR.palm.lerpVectors(H.palm0R, H.optR.palm, sstep$7(0, 0.7, uR)).normalize();
    H.wr = H.wl = 1;
    H.holdR = !lift || (H.goR >= 0 && uR > 0.9);
    H.holdL = !lift || uL > 0.9;
    if (it.state === 'collecting') {
      const tH = P.scan + P.count + P.hold, sd = it.stowD || P.stow;
      if (it.stowS && it.released && T >= tH) this._stowHands(it, T - tH);
      else {
        if (T > tH + sd * 0.7) { H.wl = 0; H.holdL = false; }
        if (T > tH + sd * 0.96) H.holdR = false;
      }
    }
  }

  _stowHands(it, tS) {
    const H = it.hands, S = it.stowS, dv = this.cu.diver;
    if (!dv || S.phase !== 'way') return;
    const g = dv.group;
    _e$1.set(1, 0, 0).applyQuaternion(g.quaternion);
    const dt = Math.max(this.cu.dt || 1 / 60, 1e-3);
    if (S.s >= S.sW[1] && S.tv + S.tW >= SLIDE_WAIT + S.turnT) {
      if (S.tR < 0) {
        this._rigToLeft(it, dv);
        if (it.rg.on) dv.anchors.rightHand.getWorldPosition(H.r);
        S.tR = tS; g.worldToLocal(S.fromR.copy(H.r)).sub(S.offC); (S.palmR0 || (S.palmR0 = new THREE.Vector3())).copy(H.optR.palm);
        H.vR.subVectors(H.r, H.rP).divideScalar(dt).clampLength(0, 1.5);
      }
      S.seatW = sstep$7(S.tR, S.tR + 0.3, tS);
      H.holdR = false;
      H.optR.edge.x = NaN;
      g.localToWorld(_d.copy(S.belly).add(S.offC));
      g.localToWorld(_c.copy(S.fromR).add(S.offC));
      const tR = tS - S.tR, u = clamp$9(tR / 0.65, 0, 1), k = u * u * (3 - 2 * u);
      H.r.lerpVectors(_c, _d, k).addScaledVector(H.vR, 0.06 * (1 - Math.exp(-tR / 0.06)) * (1 - k));
      if (this._shRof !== dv) { this._shRof = dv; this._shR = dv.group.getObjectByName('dv_uarmR'); }
      if (this._shR) { this._shR.getWorldPosition(_c); _b.subVectors(H.r, _c); const l = _b.length(); if (l > STOW_REACH) H.r.copy(_c).addScaledVector(_b, STOW_REACH / l); }
      H.wr = 1 - sstep$7(S.tR + 0.5, S.tR + 1.05, tS);
      H.optR.palm.copy(_e$1).negate().lerp(S.palmR0, 1 - sstep$7(0, 0.4, tS - S.tR)).normalize();
      H.optR.grip = 0.3;
      it.lump.localToWorld(_b.copy(S.gl)).sub(it.lump.position).normalize();
      H.optL.palm.copy(_b).negate();
      H.optL.edge.x = NaN;
      H.optL.grip = 0.65;
    }
    if (S.let) {
      if (S.tL < 0) {
        dv.anchors.leftHand.updateWorldMatrix(true, false);
        dv.anchors.leftHand.getWorldPosition(H.l);
        if (it.actV) H.vL.copy(it.actV).clampLength(0, 0.8); else H.vL.subVectors(H.l, H.lP).divideScalar(dt).clampLength(0, 0.8);
        S.tL = tS; g.worldToLocal(S.fromL.copy(H.l)).sub(S.offC);
        const e = dv.anchors.leftHand.matrixWorld.elements;
        (S.pL0 || (S.pL0 = new THREE.Vector3())).set(e[8], e[9], e[10]).normalize();
        (S.fL0 || (S.fL0 = new THREE.Vector3())).set(e[4], e[5], e[6]).normalize();
      }
      H.optL.palm.copy(S.pL0);
      H.optL.fingers = S.fL0;
      H.optL.edge.x = NaN;
      H.holdL = false;
      const k = sstep$7(S.tL, S.tL + 0.15, tS);
      _n.copy(S.up).transformDirection(g.matrixWorld);
      g.localToWorld(H.l.copy(S.fromL).add(S.offC)).addScaledVector(H.vL, 0.06 * (1 - Math.exp(-(tS - S.tL) / 0.06))).addScaledVector(_n, 0.08 * k);
      H.wl = 1 - sstep$7(S.tL + 0.12, S.tL + 0.45, tS);
    }
  }

  applyHands(dv) {
    let it = null;
    for (const x of this.items) if ((x.state === 'lifting' || x.state === 'collecting') && x.hands.on) { it = x; break; }
    if (!it || !dv || !dv.reach) return false;
    const H = it.hands;
    dv.hold('right', H.holdR);
    dv.hold('left', H.holdL);
    dv.reach('right', H.wr > 0.001 ? H.r : null, H.wr, H.optR);
    dv.reach('left', H.wl > 0.001 ? H.l : null, H.wl, H.optL);
    return true;
  }

  _seat(it, dv) {
    const H = it.hands; it.pace;
    if (!dv || !dv.anchors || !dv.anchors.rightHand || !H.on || !(H.holdR || H.holdL)) return;
    const L = it.lump, gl = it.stowS && it.released && it.stowS.phase === 'way' ? it.stowS.gl : it.gL;
    L.updateMatrixWorld();
    L.localToWorld(_a.copy(it.gR));
    L.localToWorld(_b.copy(gl));
    dv.anchors.rightHand.getWorldPosition(_c);
    dv.anchors.leftHand.getWorldPosition(_d);
    if (it.state === 'lifting') {
      it.seatW = Math.max(it.seatW || 0, 1 - sstep$7(0.004, 0.012, Math.max(_a.distanceTo(_c), _b.distanceTo(_d))));
      if (it.gripped) it.seatW = Math.max(it.seatW, sstep$7(0, SEAT_T, it.handT - it.gripT));
    }
    const w = it.state === 'lifting' ? it.seatW : 1;
    if (w < 1e-3) return;
    if (H.holdR && H.holdL) {
      _e$1.addVectors(_a, _b).multiplyScalar(0.5);
      _s$2.addVectors(_c, _d).multiplyScalar(0.5);
      _q$1.setFromUnitVectors(_a.subVectors(_b, _a).normalize(), _b.subVectors(_d, _c).normalize());
      _q2$1.identity().slerp(_q$1, w);
      _n.copy(L.position);
      L.position.sub(_e$1).applyQuaternion(_q2$1).add(_e$1).addScaledVector(_s$2.sub(_e$1), w);
      L.quaternion.premultiply(_q2$1);
      (it.seatDQ || (it.seatDQ = new THREE.Quaternion())).copy(_q2$1);
      (it.seatDP || (it.seatDP = new THREE.Vector3())).subVectors(L.position, _n);
    } else if (H.holdR) L.position.addScaledVector(_c.sub(_a), w);
    else {
      const sw = it.stowS && it.stowS.tR >= 0 ? it.stowS.seatW : 1;
      if (sw < 1 && it.seatDQ) {
        _q2$1.identity().slerp(it.seatDQ, 1 - sw);
        L.quaternion.premultiply(_q2$1);
        L.position.addScaledVector(it.seatDP, 1 - sw);
        L.updateMatrixWorld();
        L.localToWorld(_b.copy(gl));
      }
      L.position.addScaledVector(_d.sub(_b), w * sw);
    }
    if (w > 0.99 && (it.state !== 'lifting' || it.gripped)) {
      L.updateMatrixWorld();
      _m.copy(L.matrixWorld).invert();
      const rate = it.state === 'lifting' ? PALM_V : PALM_V_HELD;
      if (H.holdR) it.offR = this._palmOff(it, dv.anchors.rightHand, it.offR, 1, rate);
      if (H.holdL && !(it.stowS && it.stowS.let)) {
        if (it.stowS && it.released && it.stowS.phase === 'way') it.stowPO = clamp$9(it.stowPO + clamp$9((STOW_PALM - this._palmDepth(it, dv.anchors.leftHand, -1, true)) * 0.5, -PALM_V, PALM_V), 0, 0.06);
        else it.offL = this._palmOff(it, dv.anchors.leftHand, it.offL, -1, rate);
      }
    }
  }
  _palmOff(it, A, off, side, rate) {
    const d = this._palmDepth(it, A, side);
    return clamp$9(off - clamp$9((d - PALM_CLR) * 0.5, -rate, rate) / LUMP_S, GRIP_IN, GRIP_OFF);
  }
  _palmDepth(it, A, side, noThumb = false) {
    A.updateWorldMatrix(true, false);
    _m2.multiplyMatrices(_m, A.matrixWorld);
    let d = 9;
    for (let k = 0; k < PALM_PTS.length; k += 3) {
      _e$1.set(side * PALM_PTS[k], PALM_PTS[k + 1], PALM_PTS[k + 2]).applyMatrix4(_m2);
      d = Math.min(d, it.sdf(_e$1.x, _e$1.y, _e$1.z) * LUMP_S);
    }
    const dv = this.cu.diver;
    if (dv && this._thumbsOf !== dv) { this._thumbsOf = dv; this._thumbs = ['R', 'L'].map((S) => [dv.group.getObjectByName('dv_thumb1' + S), dv.group.getObjectByName('dv_thumb2' + S)]); }
    const T = dv && !noThumb && this._thumbs[side > 0 ? 0 : 1];
    if (T && T[0] && T[1]) {
      for (const [b, x, y, z, r] of THUMB_PTS) {
        _e$1.set(side * x, y, z).applyMatrix4(T[b].matrixWorld).applyMatrix4(_m);
        d = Math.min(d, it.sdf(_e$1.x, _e$1.y, _e$1.z) * LUMP_S - r);
      }
    }
    return d;
  }

  _pour(it, k, dt = 1 / 60) {
    if (k <= 0) return;
    if (!it.pourV) it.pourV = new THREE.Vector3();
    const S = it.spill || this._spillStart(it), L = it.lump;
    S.t += dt;
    const w = (2 * Math.acos(Math.min(1, Math.abs(S.q.dot(L.quaternion))))) / Math.max(dt, 1e-3);
    S.q.copy(L.quaternion);
    const jolt = _s$2.subVectors(it.pourV, S.v).length() / Math.max(dt, 1e-3);
    S.v.copy(it.pourV);
    while (S.qi < S.queue.length && S.t >= S.queue[S.qi][0]) { this._spillBurst(it, S.queue[S.qi][1]); S.qi++; }
    S.turn += Math.min(w, 4) * dt;
    if (S.qi >= S.queue.length && S.t - S.lastB > 0.2) {
      if (S.turn >= S.nextTurn) { this._spillBurst(it, (0.22 + 0.3 * Math.random()) * (0.5 + 0.5 * k)); S.nextTurn = S.turn + 0.4 + 0.35 * Math.random(); }
      else if (Math.random() < k * S.left * (0.6 + 0.5 * Math.min(jolt, 3)) * dt) this._spillBurst(it, 0.18 + 0.3 * Math.random());
    }
    S.acc += dt * 9 * k * (0.3 + 0.7 * S.left);
    if (S.acc >= 1) {
      const oG = this._oGrain;
      oG.spread = 0.004; oG.up = -0.05; oG.ground = it.home.y - 0.01; oG.palette = S.pal; oG.size = 0.001; oG.sed = true; oG.stream = true; oG.scatter = 0.4;
      while (S.acc >= 1) {
        S.acc -= 1;
        this._spillAt(it, 16);
        oG.push = this._v.copy(it.pourV).multiplyScalar(0.85).addScaledVector(_c, 0.03);
        this.fx.grains(_d, 1 + (Math.random() < 0.3 ? 1 : 0), oG);
      }
      oG.size = 0; oG.sed = false; oG.stream = false; oG.scatter = 1;
    }
  }

  _spillStart(it) {
    const sc = it.uni.uSandCol.value, c = (k, r = 1, g = 1, b = 1) => [sc.x * k * r * 1.12, sc.y * k * g, sc.z * k * b * 1.01];
    const S = it.spill || (it.spill = {
      q: new THREE.Quaternion(), v: new THREE.Vector3(),
      pal: [c(0.92), c(0.8), c(1.0, 1, 1, 1.03), c(0.68, 1.03, 1, 0.95), c(0.88, 1.04, 1, 0.94)],
      clump: [c(0.66), c(0.6, 1.02), c(0.72, 1, 1, 0.96)],
    });
    S.t = 0; S.left = 1; S.acc = 0; S.lastB = -9; S.qi = 0; S.turn = 0; S.nextTurn = 0.3 + 0.3 * Math.random();
    const r = Math.random;
    S.queue = [[0, 0.75], [0, 0.5], [0.08 + 0.06 * r(), 0.5 + 0.2 * r()], [0.26 + 0.1 * r(), 0.45 + 0.2 * r()], [0.46 + 0.1 * r(), 0.4 + 0.15 * r()], [0.7 + 0.12 * r(), 0.3 + 0.15 * r()]];
    S.q.copy(it.lump.quaternion);
    S.v.copy(it.pourV || S.v.set(0, 0, 0));
    return S;
  }

  _spillAt(it, m) {
    const L = it.lump, cam = this.cu.active ? this.cu.camera : null, H = this._spillH || (this._spillH = new Float32Array(16));
    if (cam) _e$1.subVectors(cam.position, L.position).setY(0).normalize();
    for (let j = 0; j < 16; j++) {
      const a = (j / 16) * Math.PI * 2, e = it.top.extent(Math.cos(a), Math.sin(a)) || 0.16;
      L.localToWorld(_b.set(Math.cos(a) * e * 0.96, Math.sin(a) * e * 0.96, -0.03));
      H[j] = _b.y - (cam ? 0.05 * Math.max(0, _s$2.subVectors(_b, L.position).setY(0).normalize().dot(_e$1)) : 0);
    }
    const r = Math.floor(Math.random() * Math.min(m, 16));
    let j0 = 0;
    for (let j = 0; j < 16; j++) {
      let below = 0;
      for (let i = 0; i < 16; i++) if (H[i] < H[j] || (H[i] === H[j] && i < j)) below++;
      if (below === r) { j0 = j; break; }
    }
    const a = ((j0 + Math.random() - 0.5) / 16) * Math.PI * 2, e = it.top.extent(Math.cos(a), Math.sin(a)) || 0.16;
    L.localToWorld(_d.set(Math.cos(a) * e * 0.96, Math.sin(a) * e * 0.96, -0.03));
    _c.subVectors(_d, L.position).setY(0);
    if (_c.lengthSq() < 1e-8) _c.set(1, 0, 0);
    _c.normalize();
  }

  _spillBurst(it, s) {
    const S = it.spill, oG = this._oGrain, oS = this._oSilt, gr = it.home.y - 0.01, left = 0.35 + 0.65 * S.left;
    this._spillAt(it, s > 0.45 ? 8 : 6);
    const n = Math.round((14 + 90 * s) * left);
    oG.spread = 0.008 + 0.014 * s; oG.up = -0.06; oG.ground = gr; oG.palette = S.pal; oG.size = 0.0009; oG.sed = true; oG.stream = true; oG.scatter = 0.35;
    oG.push = this._v.copy(it.pourV).multiplyScalar(0.85).addScaledVector(_c, 0.035 + 0.03 * s);
    this.fx.grains(_d, n, oG);
    const nc = s > 0.45 ? 1 + (Math.random() < s ? 1 : 0) + (Math.random() < s - 0.4 ? 1 : 0) : Math.random() < 0.6 ? 1 : 0;
    for (let j = 0; j < nc; j++) {
      _a.copy(_d).addScaledVector(_c, 0.004 * Math.random());
      _a.x += (Math.random() - 0.5) * 0.02; _a.z += (Math.random() - 0.5) * 0.02;
      oG.spread = 0.0035; oG.scatter = 0.07; oG.palette = S.clump; oG.size = 0.0013;
      this.fx.grains(_a, 5 + Math.floor(Math.random() * 5), oG);
      oG.size = 0.0024; oG.scatter = 0.02;
      this.fx.grains(_a, 1 + (Math.random() < 0.4 ? 1 : 0), oG);
    }
    oG.size = 0; oG.sed = false; oG.stream = false; oG.scatter = 1; oG.palette = SAND_PAL;
    oS.spread = 0.015 + 0.015 * s; oS.color = it.cloudCol; oS.up = -0.03; oS.life = 3.0; oS.size = 0.022 + 0.018 * s; oS.ground = gr; oS.sink = true;
    oS.push = this._v.copy(it.pourV).multiplyScalar(0.5);
    this.fx.silt(_d, 2 + Math.round(3 * s * left), oS);
    oS.sink = false;
    S.left = Math.max(0, S.left - 0.06 * s);
    S.lastB = S.t;
  }

  _breakFree(it) {
    const oS = this._oSilt, oG = this._oGrain, gr = it.home.y - 0.01;
    for (let j = 0; j < 10; j++) {
      const a = (j / 10 + Math.random() * 0.08) * Math.PI * 2, e = it.top.extent(Math.cos(a), Math.sin(a)) || 0.18;
      it.lump.localToWorld(_a.set(Math.cos(a) * e, Math.sin(a) * e, -0.02));
      _b.set(Math.cos(a), Math.sin(a), 0).transformDirection(it.lump.matrixWorld).setY(0).normalize();
      oS.spread = 0.02; oS.color = it.cloudCol; oS.up = 0.02; oS.life = 3.0; oS.size = 0.05 + Math.random() * 0.03; oS.ground = Math.max(gr, _a.y - 0.03); oS.cloud = true;
      oS.push = this._v.copy(_b).multiplyScalar(0.18);
      this.fx.silt(_a, 1, oS);
      oS.cloud = false;
      oG.spread = 0.02; oG.push = this._v.copy(_b).multiplyScalar(0.12); oG.up = 0.22; oG.ground = gr; oG.palette = SAND_PAL; oG.sed = true;
      this.fx.grains(_a, 5, oG);
      oG.sed = false;
    }
    this._spillStart(it);
  }

  _slump(it, dt) {
    if (it.slumpT < 0 || !it.berm) return;
    it.slumpT += dt;
    const u = clamp$9((it.slumpT - 0.6) / 2.6, 0, 1);
    it.berm.mesh.morphTargetInfluences[0] = easeOutCubic(u);
    if (u > 0 && u < 0.85 && Math.random() < dt * 12) {
      const a = Math.random() * Math.PI * 2, r = it.berm.Ravg * (0.9 + Math.random() * 0.2);
      _a.set(it.home.x + Math.cos(a) * r, it.home.y + 0.03, it.home.z + Math.sin(a) * r);
      const oG = this._oGrain;
      oG.spread = 0.03; oG.up = -0.05; oG.ground = it.home.y - 0.01; oG.palette = SAND_PAL;
      oG.push = this._v.set(-Math.cos(a) * 0.12, -0.02, -Math.sin(a) * 0.12);
      this.fx.grains(_a, 3, oG);
    }
    if (u >= 1) it.slumpT = -1;
  }

  autoPoint(it, t) {
    const x = Math.sin(t * 1.9) * 0.2, y = Math.sin(t * 3.1 + 1.0) * 0.14, z = it.top.at(x, y);
    const hit = z > -8;
    const local = new THREE.Vector3(x, y, hit ? z : 0.08);
    const normal = it.top.normal(x, y, new THREE.Vector3()).transformDirection(it.lump.matrixWorld);
    return { point: it.lump.localToWorld(local), normal, hit };
  }
  setTool(visible, point, normal, camera, vel, scrubbing, t, dt = 1 / 60) {
    const T = this.tool;
    T.group.visible = visible;
    if (!visible) { T.init = false; return; }
    const h = Math.min(dt, 0.05), speed = vel.length();
    const axis = this._p2.copy(camera.position).sub(point).normalize().multiplyScalar(0.4).addScaledVector(normal, 0.8);
    if (speed > 1e-3) axis.addScaledVector(vel, -Math.min(0.45, speed * 0.8) / speed);
    axis.normalize();
    _q$1.setFromUnitVectors(Y, axis);
    if (!T.init) T.group.quaternion.copy(_q$1); else T.group.quaternion.slerp(_q$1, 1 - Math.exp(-h * 12));
    T.press += ((scrubbing > 0.05 ? 1 : 0) - T.press) * (1 - Math.exp(-h * 14));
    const axisW = this._v.set(0, 1, 0).applyQuaternion(T.group.quaternion);
    const target = this._push.copy(point).addScaledVector(normal, 0.0015).addScaledVector(axisW, BRUSH_TIP - 0.008 * T.press + (1 - T.press) * 0.014);
    if (!T.init) { T.pos.copy(target); T.bendS.set(0, 0, 0); T.bendV.set(0, 0, 0); T.init = true; }
    T.pos.lerp(target, 1 - Math.exp(-h * 30));
    T.group.position.copy(T.pos);
    this._inv.copy(T.group.quaternion).invert();
    const goal = this._bv.copy(vel).applyQuaternion(this._inv).multiplyScalar(-0.022 * (0.35 + T.press));
    goal.y = 0;
    goal.clampLength(0, 0.016);
    T.bendV.x += ((goal.x - T.bendS.x) * 260 - T.bendV.x * 18) * h;
    T.bendV.z += ((goal.z - T.bendS.z) * 260 - T.bendV.z * 18) * h;
    T.bendS.x += T.bendV.x * h;
    T.bendS.z += T.bendV.z * h;
    T.bend.value.copy(T.bendS);
    T.splay.value += (T.press * 0.0036 + Math.min(speed, 1) * 0.0015 * T.press - T.splay.value) * (1 - Math.exp(-h * 16));
    T.dirt.value = Math.min(1, T.dirt.value + h * 0.06 * scrubbing);
  }
  brushSand(point, strength, vel) {
    const bv = vel ? this._bv.copy(vel).clampLength(0, 1.2) : this._bv.set(0, 0, 0);
    const oG = this._oGrain;
    oG.spread = 0.05; oG.push = bv; oG.up = 0.12; oG.ground = point.y - 0.005; oG.palette = SAND_PAL;
    this.fx.grains(point, Math.round(2 + 3 * strength), oG);
  }
  _legacyStep(it, dt, camera, presenter) {
    const cb = this.cb;
    it.t += dt;
    const T = it.t;
    if (it.state === 'lifting') {
      if (!it.tugged) { it.tugged = true; it.slumpT = 0; if (cb.pour) cb.pour(); }
      const k = easeOutCubic(clamp$9(T / 1.1, 0, 1));
      it.lump.position.copy(it.homeP).addScaledVector(Y, k * 0.45);
      it.lump.position.x += Math.sin(T * 9) * 0.004;
      this._pour(it, 1 - k);
      if (T > 1.15) {
        it.state = 'collecting';
        it.t = 0;
        it.from.copy(it.lump.position);
        it.lump.renderOrder = 12;
        if (cb.onPickup) cb.onPickup(it.i, it.home);
      }
      return;
    }
    if (it.state !== 'collecting') return;
    if (presenter) _a.copy(presenter.pos);
    else if (camera) {
      _b.set(0, 0, -1).applyQuaternion(camera.quaternion);
      _c.set(0, 1, 0).applyQuaternion(camera.quaternion);
      _d.set(1, 0, 0).applyQuaternion(camera.quaternion);
      _a.copy(camera.position).addScaledVector(_b, 0.92).addScaledVector(_c, -0.1).addScaledVector(_d, 0.12);
    } else _a.copy(it.from);
    it.lump.position.lerpVectors(it.from, _a, easeOutCubic(clamp$9(T / 0.9, 0, 1)));
    if (T > 4.1) {
      const u = easeInCubic(clamp$9((T - 4.1) / 0.7, 0, 1));
      if (presenter) it.lump.position.lerp(presenter.stow || presenter.pos, u);
      it.lump.scale.setScalar(LUMP_S * (1 - u * 0.95));
    }
    if (camera) {
      _eu.set(Math.sin(T * 1.3) * 0.12, Math.sin(T * 0.9) * 0.18, T * 0.35, 'XYZ');
      _q$1.copy(camera.quaternion).multiply(_q2$1.setFromEuler(_eu));
      it.lump.quaternion.slerp(_q$1, 1 - Math.exp(-dt * 7));
    }
    if (T > 0.9) {
      if (!it.scanStarted) { it.scanStarted = true; it.gear.visible = true; if (cb.onScan) cb.onScan(it.i); }
      it.uni.uXray.value = 1;
      it.shell.visible = true;
      it.shell.material.opacity = 0.78;
      it.uni.uScan.value = -0.36 + 0.72 * clamp$9((T - 0.9) / 1.1, 0, 1);
      it.guni.uShow.value = clamp$9((T - 1.0) / 0.6, 0, 1);
    }
    if (T > 2.0) {
      const c = clamp$9((T - 2.0) / 1.35, 0, 1);
      it.guni.uCount.value = c;
      if (!it.revealed) { it.revealed = true; if (cb.onReveal) cb.onReveal(it.i); }
      const steps = Math.floor(c * 36);
      if (steps > it.lastTick) { it.lastTick = steps; if (cb.onTick) cb.onTick(c); }
    }
    if (T > 4.8) {
      it.state = 'done';
      it.lump.visible = false;
      it.beam.visible = it.ring.visible = it.glint.visible = false;
      it.gear.visible = it.shell.visible = false;
      this.collected++;
      if (cb.onCollected) cb.onCollected(it.i, this.collected);
    }
  }

  update(dt, t, camera, playerPos, presenter = null) {
    this._pileTick(dt);
    this.beacon = Math.max(0, this.beacon - dt / 8);
    const bAlpha = Math.min(1, this.beacon * 3) * this.beacon;
    const cu = this.cu;
    let held = null;
    for (const it of this.items) {
      if (cu.active && it === cu.it) continue;
      it.mask.update();
      this._slump(it, dt);
      if (it.state === 'buried') {
        if (it.echoAt !== undefined && !it.echoed) {
          it.echoT += dt;
          if (it.echoT >= it.echoAt) {
            it.echoed = true;
            it.flash = 1;
            this._p.copy(it.home);
            this._p.y += 0.2;
            this.fx.sparkBurst(this._p, 40, 0.8, [0.45, 1.0, 0.9]);
            if (this.cb.onEcho) this.cb.onEcho(it.i, it.echoAt);
          }
        }
        it.flash = Math.max(0, (it.flash || 0) - dt * 0.9);
        const d = playerPos ? Math.hypot(playerPos.x - it.home.x, playerPos.z - it.home.z) : 99;
        it.hl += ((d < CLEAN_RANGE ? 1 : 0) - it.hl) * (1 - Math.exp(-dt * 4));
        const tw = Math.pow(Math.max(0, Math.sin(t * 1.3 + it.i * 2.1)), 40);
        const far = sstep$7(2.0, 6.0, d);
        const near = (1 - sstep$7(4.5, 7.0, d)) * (0.32 + 0.35 * Math.pow(Math.max(0, Math.sin(t * 1.7 + it.i)), 4));
        it.glintMat.opacity = Math.max(tw * 0.7 * far, near, bAlpha * far, it.flash * 0.8);
        it.glint.scale.setScalar(0.09 + 0.1 * far + tw * 0.14 * far + bAlpha * 0.12 * far + it.flash * 0.25);
        it.beamU.uAlpha.value = Math.max(bAlpha, it.flash);
        it.ringU.uAlpha.value = Math.max(bAlpha * (0.4 + 0.6 * far), it.hl * 0.7, it.flash);
        it.ringU.uScale.value = 1 + 0.08 * Math.sin(t * 3) + it.flash * 1.4;
        it.uni.uGlow.value = Math.max(bAlpha * 0.25 * far, it.hl * (0.03 + 0.03 * Math.sin(t * 3)), it.flash * 0.5);
      } else if (it.state === 'lifting' || it.state === 'collecting') {
        held = it;
        it.glintMat.opacity = 0;
        it.beamU.uAlpha.value = 0;
        it.ringU.uAlpha.value = 0;
        it.uni.uGlow.value = 0;
        this._itemStep(it, dt, camera, presenter);
      }
    }
    if (!cu.active) for (const it of this.items) if (it.riding) this._ride(it, camera, this.diver, dt);
    if (!cu.active) {
      const dv = this.diver;
      this.torchPose.active = !!(held && dv);
      if (held && dv) {
        dv.anchors.head.getWorldPosition(this.torchPose.pos).addScaledVector(Y, 0.07);
        this.torchPose.aim.copy(held.lump.position);
      }
    }
  }
}

