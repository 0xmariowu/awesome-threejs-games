// AudioWorklet: procedural V8 (runs on the audio thread; no imports).
//
// Model: the crank advances at rpm/60 rev/s; each of 8 cylinders fires once
// per 2 revolutions. Every firing launches an exhaust pressure pulse
// (alpha-function envelope + combustion noise). Per-cylinder level/timing
// irregularities give the cross-plane "burble" (sub-harmonics of the cam
// frequency). The pulse train then runs through exhaust resonances
// (band-passes) and a load-dependent muffler low-pass. Throttle lifts at high
// rpm add overrun pops.

const CYL = 8;
// Cross-plane character: uneven per-bank pulses (level + small timing skew).
const CYL_GAIN = [1.0, 0.8, 0.96, 0.76, 1.0, 0.86, 0.93, 0.79];
const CYL_SKEW = [0.0, 0.035, -0.02, 0.05, 0.0, 0.03, -0.035, 0.045];

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

  bandpass(f, q, sr) {
    const w = (2 * Math.PI * f) / sr;
    const alpha = Math.sin(w) / (2 * q);
    const a0 = 1 + alpha;
    this.b0 = alpha / a0;
    this.b1 = 0;
    this.b2 = -alpha / a0;
    this.a1 = (-2 * Math.cos(w)) / a0;
    this.a2 = (1 - alpha) / a0;
  }

  lowpass(f, q, sr) {
    const w = (2 * Math.PI * Math.min(f, sr * 0.45)) / sr;
    const alpha = Math.sin(w) / (2 * q);
    const c = Math.cos(w);
    const a0 = 1 + alpha;
    this.b0 = (1 - c) / 2 / a0;
    this.b1 = (1 - c) / a0;
    this.b2 = (1 - c) / 2 / a0;
    this.a1 = (-2 * c) / a0;
    this.a2 = (1 - alpha) / a0;
  }

  highpass(f, q, sr) {
    const w = (2 * Math.PI * f) / sr;
    const alpha = Math.sin(w) / (2 * q);
    const c = Math.cos(w);
    const a0 = 1 + alpha;
    this.b0 = (1 + c) / 2 / a0;
    this.b1 = -(1 + c) / a0;
    this.b2 = (1 + c) / 2 / a0;
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

class EngineSynth extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: "rpm", defaultValue: 900, minValue: 0, maxValue: 12000, automationRate: "k-rate" },
      { name: "load", defaultValue: 0, minValue: 0, maxValue: 1, automationRate: "k-rate" },
      { name: "throttle", defaultValue: 0, minValue: 0, maxValue: 1, automationRate: "k-rate" },
    ];
  }

  constructor() {
    super();
    this.crank = 0; // revolutions (mod 2)
    this.lastCyl = -1;
    this.pulseT = 1;
    this.pulseAmp = 0;
    this.pulseTau = 0.001;
    this.popAmp = 0;
    this.popT = 1;
    this.seed = 22222;
    this.prevThrottle = 0;
    this.liftTimer = 0;
    this.bp1 = new Biquad();
    this.bp2 = new Biquad();
    this.bp3 = new Biquad();
    this.lp = new Biquad();
    this.hp = new Biquad();
    this.popBp = new Biquad();
    this.hp.highpass(28, 0.7, sampleRate);
    this.popBp.bandpass(1400, 1.1, sampleRate);
    this.filterTimer = 0;
  }

  rand() {
    // xorshift32 → [0, 1)
    let x = this.seed;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.seed = x >>> 0;
    return this.seed / 4294967296;
  }

  process(_inputs, outputs, parameters) {
    const out = outputs[0][0];
    if (!out) return true;
    const rpm = Math.max(300, parameters.rpm[0]);
    const load = parameters.load[0];
    const throttle = parameters.throttle[0];
    const sr = sampleRate;

    // Resonances drift a little with rpm (exhaust gas temperature/speed).
    if (this.filterTimer <= 0) {
      const r = rpm / 8000;
      this.bp1.bandpass(78 + r * 60, 0.9, sr);
      this.bp2.bandpass(240 + r * 160, 1.5, sr);
      this.bp3.bandpass(900 + r * 700, 2.2, sr);
      this.lp.lowpass(1400 + load * 3600 + r * 1800, 0.7, sr);
      this.filterTimer = 128;
    }
    this.filterTimer -= out.length;

    // Overrun: throttle lifted at high rpm → a window of random pops.
    if (this.prevThrottle > 0.5 && throttle < 0.1 && rpm > 3200) this.liftTimer = 1.2;
    this.prevThrottle = throttle;

    const revPerSample = rpm / 60 / sr;
    const interval = 2 / CYL; // revolutions between firings
    const intervalSec = interval / (rpm / 60);
    const tau = Math.max(0.0006, intervalSec * 0.2);
    const level = 0.55 + load * 0.75 + throttle * 0.15;

    for (let i = 0; i < out.length; i++) {
      this.crank += revPerSample;
      if (this.crank >= 2) this.crank -= 2;
      const slot = this.crank / interval;
      const cyl = Math.floor(slot) % CYL;
      const within = slot - Math.floor(slot);
      // Fire once per slot, after the per-cylinder skew.
      if (cyl !== this.lastCyl && within >= Math.max(0, CYL_SKEW[cyl])) {
        this.lastCyl = cyl;
        this.pulseT = 0;
        this.pulseTau = tau * (0.9 + this.rand() * 0.2);
        this.pulseAmp = level * CYL_GAIN[cyl] * (0.9 + this.rand() * 0.2);
        // Sporadic crackle that fades out over the lift window.
        if (this.liftTimer > 0 && throttle < 0.1 && this.rand() < 0.03 * (this.liftTimer / 1.2)) {
          this.popAmp = 0.6 + this.rand() * 0.8;
          this.popT = 0;
        }
      }
      // Alpha-function pulse (peaks at t = tau) + combustion roughness.
      const t = this.pulseT / this.pulseTau;
      const env = t * Math.exp(1 - t);
      const noise = this.rand() * 2 - 1;
      const x = this.pulseAmp * env * (1 + noise * (0.25 + load * 0.2));
      this.pulseT += 1 / sr;

      let y = this.bp1.step(x) * 1.5 + this.bp2.step(x) * 1.1 + this.bp3.step(x) * (0.25 + load * 0.35) + x * 0.35;
      y = this.lp.step(y);

      // Overrun pops: bright noise bursts ~25 ms.
      if (this.popT < 0.03) {
        const pe = Math.exp(-this.popT / 0.006);
        y += this.popBp.step((this.rand() * 2 - 1) * this.popAmp * pe) * 2.2;
        this.popT += 1 / sr;
      }

      out[i] = Math.tanh(this.hp.step(y) * 1.6) * 0.8;
    }
    if (this.liftTimer > 0) this.liftTimer -= out.length / sr;
    for (let c = 1; c < outputs[0].length; c++) outputs[0][c].set(out);
    return true;
  }
}

registerProcessor("engine-synth", EngineSynth);
