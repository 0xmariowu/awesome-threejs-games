/** Bounded presentation-frame samples. These are frame intervals, not GPU timings. */
export class FrameStats {
  constructor(capacity = 240) { this.samples = new Float32Array(capacity); this.cursor = 0; this.count = 0; }
  push(seconds) {
    if (!Number.isFinite(seconds) || seconds <= 0) return;
    this.samples[this.cursor] = seconds * 1000;
    this.cursor = (this.cursor + 1) % this.samples.length;
    this.count = Math.min(this.count + 1, this.samples.length);
  }
  snapshot() {
    const sorted = Array.from(this.samples.subarray(0, this.count)).sort((a, b) => a - b);
    const percentile = (p) => +(sorted[Math.max(0, Math.ceil(sorted.length * p) - 1)] || 0).toFixed(2);
    return { samples: this.count, medianMs: percentile(.5), p95Ms: percentile(.95), maxMs: percentile(1) };
  }
}
