// frame.js
const DEG$7 = Math.PI / 180;
const REF = 1.25;
const TALL = 0.65;
const LENS_MAX = 78;
const SPLIT = 0.6;
const EASE = 1.6;
const clamp$7 = (v, a, b) => (v < a ? a : v > b ? b : v);

const FRAME = {
  a: 16 / 9,
  tall: 0,
  floor: 0,
  w: 0.7,
  wv: 0,
  wt: 0.7,
  asked: false,

  aspect(a) {
    this.a = a > 0 ? a : 16 / 9;
    const u = clamp$7((REF - this.a) / (REF - TALL), 0, 1);
    this.tall = u * u * (3 - 2 * u);
    return this.a;
  },
  want(w) { this.wt = w; this.asked = true; },
  update(dt, beatW, snap = false) {
    const target = this.asked ? this.wt : beatW;
    this.asked = false;
    this.wt = target;
    if (snap || !(dt > 0)) { this.w = target; this.wv = 0; return; }
    const k = EASE;
    this.wv += (k * k * (target - this.w) - 2 * k * this.wv) * dt;
    this.w += this.wv * dt;
  },
  g(w = this.w) { return this.a >= REF ? 1 : Math.max(1, (w * REF) / this.a); },
  _gl(F, g) {
    if (g <= 1) return 1;
    const t0 = Math.tan((F * DEG$7) / 2), cap = Math.max(1, Math.tan((LENS_MAX * DEG$7) / 2) / t0);
    return Math.min(Math.pow(g, SPLIT), cap);
  },
  lens(F, w = this.w) {
    const g = this.g(w);
    if (g <= 1) return F;
    return (2 * Math.atan(Math.tan((F * DEG$7) / 2) * this._gl(F, g))) / DEG$7;
  },
  reach(F = 60, w = this.w) {
    const g = this.g(w);
    return g <= 1 ? 1 : g / this._gl(F, g);
  },
  x(fx) { return fx + (0.5 - fx) * this.tall; },
  y(fy, fyTall = fy) { return fy + (fyTall - fy) * this.tall; },
  aimAt(q, fy, vfov) {
    if (!(Math.abs(fy - 0.5) > 1e-4)) return q;
    const h = -0.5 * Math.atan((2 * fy - 1) * Math.tan((vfov * DEG$7) / 2)), s = Math.sin(h), c = Math.cos(h);
    const x = q.x, y = q.y, z = q.z, w = q.w;
    return q.set(w * s + x * c, y * c + z * s, z * c - y * s, w * c - x * s);
  },
  keep(lo, hi, vfov, m = 0, s = 0) {
    const h = Math.atan(Math.tan((vfov * DEG$7) / 2) * this.a) - m;
    if (!(h > 0)) return 0;
    if (hi - lo >= 2 * h) return (lo + hi) / 2;
    if (!(s > 0)) return lo < -h ? lo + h : hi > h ? hi - h : 0;
    const g = (x) => (x <= -s ? 0 : x >= s ? x : ((x + s) * (x + s)) / (4 * s));
    return g(hi - h) - g(-lo - h);
  },
  back(p, q, d, k) {
    if (!(k > 1.0001) || !(d > 0)) return p;
    const x = q.x, y = q.y, z = q.z, w = q.w;
    const fx = -2 * (x * z + w * y), fy = -2 * (y * z - w * x), fz = -(1 - 2 * (x * x + y * y));
    const s = d * (k - 1);
    p.x -= fx * s; p.y -= fy * s; p.z -= fz * s;
    return p;
  },
};

