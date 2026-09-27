// band.js
const OLD = 0.09;
const SCOPE = 2.39;
const FIT_OUT = 3.5, FIT_IN = 2.2;
const REDUCED$1 = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

function barFor(a, touch) {
  if (touch || !(a > 1)) return OLD;
  const r = lerp$4(1 / (1 - 2 * OLD), SCOPE, clamp$9((a - 1) / 0.25, 0, 1));
  return Math.max(OLD, (1 - a / r) / 2);
}

const BAND$1 = {
  barFor,
  full: OLD,
  k: 0,
  bar: 0,
  h: 1,
  c: 0.5,
  fitK: 1,
  zoom: 1,
  desk: false,
  words: null,
  to: 0, from: 0, t: 0, dur: 0.6, slow: false, want: 0, fitV: 0,

  set(on, secs = 0) {
    const to = on ? 1 : 0;
    if (to === this.to) return;
    this.to = to;
    this.from = this.k;
    this.t = 0;
    this.slow = secs > 0;
    this.dur = REDUCED$1 ? 0.2 : secs > 0 ? secs : 0.6;
  },
  fit(y0, y1, m = 0.05, w = 1) {
    const e = this.h - m;
    if (!(this.desk && this.k > 0 && e > 0.05 && w > 0)) return;
    this.want = Math.max(this.want, 1 + (Math.max(y1 / e, -y0 / e) - 1) * Math.min(1, w));
  },
  update(dt, aspect, touch) {
    this.full = barFor(aspect, touch);
    this.desk = !touch && aspect > 1;
    if (this.k !== this.to) {
      this.t += dt;
      const x = clamp$9(this.t / this.dur, 0, 1);
      this.k = x >= 1 ? this.to : lerp$4(this.from, this.to, this.slow ? easeInOut$1(x) : 1 - Math.pow(1 - x, 5));
    }
    this.bar = this.full * this.k;
    this.h = 1 - 2 * this.bar;
    const to = clamp$9(this.want, 1, (1 - 2 * OLD * this.k) / this.h), w = to > this.fitK ? FIT_OUT : FIT_IN;
    this.want = 0;
    this.fitV += (w * w * (to - this.fitK) - 2 * w * this.fitV) * dt;
    this.fitK += this.fitV * dt;
    if (this.fitK < 1) { this.fitK = 1; this.fitV = Math.max(0, this.fitV); }
    this.zoom = 1 / this.fitK;
    return this;
  },
};

