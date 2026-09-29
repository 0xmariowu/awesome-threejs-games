// AudioWorklet: sampled V8. Runs on the audio thread; no imports.
//
// The source is one recorded acceleration pull (tools/audio/build-engine-
// sample.mjs) with a time → firing-frequency map. The car's rpm range
// (`rpmRange`, idle → limiter) is mapped onto the recording's pitch range, so
// the recording is never pitched *up* (the car lives at 5–7.5k under
// throttle and the pull stops at ~5.5k — that was the thin, nasal sound).
//
// Playback is a continuous, phase-aligned granular read — not "grains
// scattered around a point". A playhead runs through the recording at the
// pitch-corrected speed; Hann grains (50 % overlap) each start exactly where
// the previous one is reading, so overlapping grains carry the *same* signal
// and sum without combing. When the playhead drifts too far from the region
// that matches the rpm, the next grain jumps back / ahead by whole firing
// periods, fine-aligned by cross-correlation, so the splice stays in phase.
// (Random grain positions — the first version — overlap copies of the sound
// a few ms apart: a comb filter that reads as an echo / flanger.)
//
// Mono core; the stereo image comes only from a small left/right tone
// balance (no delays, so nothing to hear as echo) and pops that alternate
// between the two outlets. Body: everything plays at `pitch` (lower = bigger
// engine), a low shelf, a cross-plane sub layer and saturation. Load drives
// level and a muffler low-pass; throttle lifts at high rpm add pops.
//
// Every knob is live: `{ type: "tune", params }` messages (engineTuning.js,
// Inspector → "Engine sound"). The fallbacks below match its defaults.

class Biquad {
  constructor() {
    this.b0 = 1;
    this.b1 = 0;
    this.b2 = 0;
    this.a1 = 0;
    this.a2 = 0;
    this.x1 = 0;
    this.x2 = 0;
    this.y1 = 0;
    this.y2 = 0;
  }

  // RBJ low shelf, `gain` in dB, shelf slope 1.
  lowshelf(f, gain, sr) {
    const A = 10 ** (gain / 40);
    const w = (2 * Math.PI * f) / sr;
    const c = Math.cos(w);
    const alpha = (Math.sin(w) / 2) * Math.SQRT2;
    const sq = 2 * Math.sqrt(A) * alpha;
    const a0 = A + 1 + (A - 1) * c + sq;
    this.b0 = (A * (A + 1 - (A - 1) * c + sq)) / a0;
    this.b1 = (2 * A * (A - 1 - (A + 1) * c)) / a0;
    this.b2 = (A * (A + 1 - (A - 1) * c - sq)) / a0;
    this.a1 = (-2 * (A - 1 + (A + 1) * c)) / a0;
    this.a2 = (A + 1 + (A - 1) * c - sq) / a0;
  }

  set(type, f, q, sr) {
    const w = (2 * Math.PI * Math.min(f, sr * 0.45)) / sr;
    const alpha = Math.sin(w) / (2 * q);
    const c = Math.cos(w);
    const a0 = 1 + alpha;
    if (type === "lowpass") {
      this.b0 = (1 - c) / 2 / a0;
      this.b1 = (1 - c) / a0;
      this.b2 = (1 - c) / 2 / a0;
    } else if (type === "highpass") {
      this.b0 = (1 + c) / 2 / a0;
      this.b1 = -(1 + c) / a0;
      this.b2 = (1 + c) / 2 / a0;
    } else {
      this.b0 = alpha / a0;
      this.b1 = 0;
      this.b2 = -alpha / a0;
    }
    this.a1 = (-2 * c) / a0;
    this.a2 = (1 - alpha) / a0;
  }

  step(x) {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1;
    this.x1 = x;
    this.y2 = this.y1;
    this.y1 = y;
    return y;
  }
}

const MAX_GRAINS = 4;
const DEFAULTS = {
  pitch: 0.98, // < 1 = a bigger engine (tuned by ear)
  drive: 1.9, // saturation into tanh (density)…
  makeup: 0.73, // …and the level after it
  width: 0.2, // 0 = mono; only tilts lows left / highs right (no delays → no echo)
  shelfFreq: 135,
  shelfGain: 2.5,
  subLevel: 0.16,
  subLoad: 0.3,
  subCutoff: 170,
  mufflerBase: 200,
  mufflerLoad: 4200,
  mufflerRpm: 0,
  levelBase: 0.5,
  levelLoad: 1.06,
  revGain: 0.49,
  grainMs: 70,
  drift: 0.06, // s the playhead may wander from the rpm's spot before a jump
  pops: 1,
};
const CROSS_PLANE = [1, 0.78, 0.95, 0.72, 1, 0.84, 0.9, 0.76]; // sub-layer pulse levels (V8)
const EVEN_FIRE = [1, 0.94, 1, 0.94, 1, 0.94, 1, 0.94]; // V12: even firing, a smoother hum
const MATCH = 256; // samples compared when aligning a jump

class EngineSampler extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: "rpm", defaultValue: 900, minValue: 0, maxValue: 12000, automationRate: "k-rate" },
      { name: "load", defaultValue: 0, minValue: 0, maxValue: 1, automationRate: "k-rate" },
      { name: "throttle", defaultValue: 0, minValue: 0, maxValue: 1, automationRate: "k-rate" },
    ];
  }

  constructor() {
    super();
    this.samples = null;
    this.p = { ...DEFAULTS };
    this.grainLen = Math.round((this.p.grainMs / 1000) * sampleRate);
    this.grains = Array.from({ length: MAX_GRAINS }, () => ({ active: false, pos: 0, step: 1, age: 0, gain: 1 }));
    this.untilNext = 0;
    this.head = -1; // source position the next grain continues from (-1 = none yet)
    this.seed = 424242;
    this.rpmRange = [900, 7800];
    this.rpmPerHz = 15;
    this.pulses = CROSS_PLANE;
    this.muffler = new Biquad();
    this.shelf = new Biquad();
    this.shelf.lowshelf(this.p.shelfFreq, this.p.shelfGain, sampleRate);
    this.hpL = new Biquad();
    this.hpR = new Biquad();
    this.hpL.set("highpass", 28, 0.7, sampleRate);
    this.hpR.set("highpass", 28, 0.7, sampleRate);
    this.tiltLp = 0;
    this.subPhase = 0;
    this.subLp1 = 0;
    this.subLp2 = 0;
    this.subHp = new Biquad();
    this.subHp.set("highpass", 30, 0.7, sampleRate);
    this.popBp = new Biquad();
    this.popBp.set("bandpass", 1500, 1.1, sampleRate);
    this.popPan = 1;
    this.filterTimer = 0;
    this.prevThrottle = 0;
    this.liftTimer = 0;
    this.popT = 1;
    this.popAmp = 0;
    this.level = 0;
    this.port.onmessage = ({ data }) => {
      if (data.type === "tune") {
        this.tune(data.params);
        return;
      }
      if (data.tune) this.tune(data.tune);
      this.samples = data.samples;
      this.srcRate = data.sampleRate;
      this.times = data.times;
      this.freqs = data.freqs;
      this.gains = data.gains;
      this.rpmPerHz = data.rpmPerHz ?? 15;
      this.pulses = (data.cylinders ?? 8) === 8 ? CROSS_PLANE : EVEN_FIRE;
      if (data.rpmRange) this.rpmRange = data.rpmRange;
      this.head = -1;
    };
  }

  tune(params) {
    for (const key of Object.keys(DEFAULTS)) {
      if (Number.isFinite(params?.[key])) this.p[key] = params[key];
    }
    this.shelf.lowshelf(this.p.shelfFreq, this.p.shelfGain, sampleRate);
    this.grainLen = Math.max(64, Math.round((this.p.grainMs / 1000) * sampleRate)) & ~1;
    this.filterTimer = 0;
  }

  rand() {
    let x = this.seed;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.seed = x >>> 0;
    return this.seed / 4294967296;
  }

  /** Car rpm → firing frequency inside the recording's range (linear). */
  targetFreq(rpm) {
    const { freqs } = this;
    const [idle, top] = this.rpmRange;
    const k = (rpm - idle) / (top - idle);
    return freqs[0] + (freqs[freqs.length - 1] - freqs[0]) * k;
  }

  /** Index pair + fraction into a monotonic table for value `v`. */
  static locate(table, v) {
    const last = table.length - 1;
    v = Math.min(table[last], Math.max(table[0], v));
    let lo = 0;
    let hi = last;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (table[mid] <= v) lo = mid;
      else hi = mid;
    }
    return [lo, hi, table[hi] > table[lo] ? (v - table[lo]) / (table[hi] - table[lo]) : 0];
  }

  /** Offset in [-radius, radius] that makes samples[at…] look most like samples[ref…]. */
  align(ref, at, radius) {
    const s = this.samples;
    let best = 0;
    let bestScore = -Infinity;
    for (let d = -radius; d <= radius; d += 2) {
      const q = at + d;
      let xy = 0;
      let yy = 1e-9;
      for (let k = 0; k < MATCH; k += 2) {
        const y = s[q + k];
        xy += s[ref + k] * y;
        yy += y * y;
      }
      const score = xy / Math.sqrt(yy);
      if (score > bestScore) {
        bestScore = score;
        best = d;
      }
    }
    return best;
  }

  spawn(target) {
    const grain = this.grains.find((g) => !g.active);
    if (!grain) return;
    const { times, freqs, gains, srcRate } = this;
    const n = this.samples.length;
    const span = this.grainLen * 2; // generous bound on the source a grain reads
    const [lo, hi, k] = EngineSampler.locate(freqs, target);
    const want = (times[lo] + (times[hi] - times[lo]) * k) * srcRate; // where the recording has this pitch

    let pos;
    if (this.head < 0) {
      pos = want;
    } else {
      pos = this.head;
      const drift = this.p.drift;
      if (Math.abs(pos - want) > drift * srcRate) {
        // Jump by whole firing periods so the splice stays in phase, landing
        // a little before the target so the playhead runs through it.
        const period = srcRate / (freqs[lo] + (freqs[hi] - freqs[lo]) * k);
        const aim = want - drift * 0.6 * srcRate;
        const jumped = pos - Math.round((pos - aim) / period) * period;
        const radius = Math.min(Math.round(period / 2), 400);
        if (jumped - radius > 0 && jumped + radius + MATCH < n && pos + MATCH < n) {
          pos = jumped + this.align(Math.round(pos), Math.round(jumped), radius);
        } else {
          pos = jumped;
        }
      }
    }
    pos = Math.min(n - span - 2, Math.max(0, pos));

    // Play at the target pitch relative to what the recording has *here*.
    const [tlo, thi, tk] = EngineSampler.locate(times, pos / srcRate);
    const here = freqs[tlo] + (freqs[thi] - freqs[tlo]) * tk;
    const rate = Math.min(1.9, Math.max(0.3, (target / here) * this.p.pitch));
    grain.step = (rate * srcRate) / sampleRate;
    grain.pos = pos;
    grain.gain = gains[tlo] + (gains[thi] - gains[tlo]) * tk;
    grain.age = 0;
    grain.active = true;
    // The next grain continues from where this one is at its midpoint.
    this.head = pos + (this.grainLen >> 1) * grain.step;
  }

  process(_inputs, outputs, parameters) {
    const out = outputs[0][0];
    if (!out) return true;
    const right = outputs[0][1] ?? null;
    if (!this.samples) {
      out.fill(0);
      right?.fill(0);
      return true;
    }
    const rpm = Math.max(300, parameters.rpm[0]);
    const load = parameters.load[0];
    const throttle = parameters.throttle[0];
    const sr = sampleRate;

    const P = this.p;
    if (this.filterTimer <= 0) {
      // Open exhaust under load, muffled on overrun / idle.
      this.muffler.set("lowpass", P.mufflerBase + load * P.mufflerLoad + (rpm / 8000) * P.mufflerRpm, 0.8, sr);
      this.filterTimer = 256;
    }
    this.filterTimer -= out.length;

    if (this.prevThrottle > 0.5 && throttle < 0.1 && rpm > 3200) this.liftTimer = 1.2;
    this.prevThrottle = throttle;

    // Louder as it revs (the low shelf / sub favour low rpm otherwise).
    const [idle, top] = this.rpmRange;
    const revs = Math.min(1, Math.max(0, (rpm - idle) / (top - idle)));
    const targetLevel = (P.levelBase + load * P.levelLoad + throttle * 0.12) * (0.75 + P.revGain * revs);
    const hop = this.grainLen >> 1;
    const len = this.grainLen;
    const samples = this.samples;
    const target = this.targetFreq(rpm);
    // Real firing rate for the sub layer (a V8 fires 4× per revolution, a
    // V12 6×: the bank's rpmPerHz).
    const firing = rpm / this.rpmPerHz;
    const popChance = this.liftTimer > 0 && throttle < 0.1 ? (firing * 0.035 * P.pops * (this.liftTimer / 1.2)) / sr : 0;
    const subLevel = P.subLevel + load * P.subLoad;
    const subCut = 1 - Math.exp((-2 * Math.PI * P.subCutoff) / sr);
    const width = P.width;
    const drive = P.drive;
    const makeup = P.makeup;
    const tiltCut = 1 - Math.exp((-2 * Math.PI * 400) / sr);

    for (let i = 0; i < out.length; i++) {
      if (this.untilNext <= 0) {
        this.spawn(target);
        this.untilNext += hop;
      }
      this.untilNext -= 1;

      let sum = 0;
      for (let j = 0; j < MAX_GRAINS; j++) {
        const g = this.grains[j];
        if (!g.active) continue;
        const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * g.age) / len);
        const p = g.pos | 0;
        const f = g.pos - p;
        sum += (samples[p] + (samples[p + 1] - samples[p]) * f) * w * g.gain;
        g.pos += g.step;
        if (++g.age >= len) g.active = false;
      }

      // Sub layer: firing pulses (uneven, cross-plane) under ~170 Hz.
      this.subPhase += (firing * P.pitch) / 8 / sr; // one cycle = 8 firings
      if (this.subPhase >= 1) this.subPhase -= 1;
      const slot = this.subPhase * 8;
      const within = slot - Math.floor(slot);
      let sub = Math.exp(-within * 7) * this.pulses[Math.floor(slot)];
      this.subLp1 += (sub - this.subLp1) * subCut;
      this.subLp2 += (this.subLp1 - this.subLp2) * subCut;
      sub = this.subHp.step(this.subLp2) * subLevel * 4;

      let pop = 0;
      if (popChance > 0 && this.rand() < popChance) {
        this.popAmp = 0.5 + this.rand() * 0.9;
        this.popT = 0;
        this.popPan = this.rand() < 0.5 ? 0 : 1; // left or right outlet
      }
      if (this.popT < 0.03) {
        const pe = Math.exp(-this.popT / 0.006);
        pop = this.popBp.step((this.rand() * 2 - 1) * this.popAmp * pe) * 1.6;
        this.popT += 1 / sr;
      }

      this.level += (targetLevel - this.level) * 0.0008;
      const mono = this.shelf.step(this.muffler.step(sum)) * this.level * 1.1 + sub;
      // Tone tilt: lows lean left, highs lean right (sums back to mono).
      this.tiltLp += (mono - this.tiltLp) * tiltCut;
      const lows = this.tiltLp;
      const highs = mono - lows;
      const l = lows * (1 + width) + highs * (1 - width) + pop * (this.popPan ? 0.55 : 1);
      const r = lows * (1 - width) + highs * (1 + width) + pop * (this.popPan ? 1 : 0.55);
      out[i] = Math.tanh(this.hpL.step(l) * drive) * makeup;
      if (right) right[i] = Math.tanh(this.hpR.step(r) * drive) * makeup;
    }
    if (this.liftTimer > 0) this.liftTimer -= out.length / sr;
    return true;
  }
}

registerProcessor("engine-sampler", EngineSampler);
