// INKWAVE MIT cameraRig.js spring kernels. No renderer or game dependencies.
// Critically-damped spring (exact integration — stable and frame-rate independent).
export class CriticalSpring {
  constructor(x = 0) {
    this.x = x;
    this.v = 0;
  }
  reset(x) {
    this.x = x;
    this.v = 0;
  }
  step(target, omega, dt) {
    const d = this.x - target,
      e = Math.exp(-omega * dt),
      k = (this.v + omega * d) * dt;
    this.x = target + (d + k) * e;
    this.v = (this.v - omega * k) * e;
    return this.x;
  }
}

// Damped spring for zeta < 1, sub-stepped so each explicit step stays tiny: stable and frame-rate independent at any dt.
// (A single explicit step per frame diverged below ~27 fps into a frame-alternating jitter that read as flicker.)
export function stepDamped(o, target, omega, zeta, dt) {
  const n = Math.max(1, Math.ceil((omega * dt) / 0.12)),
    h = dt / n;
  for (let i = 0; i < n; i++) {
    o.v += (-omega * omega * (o.x - target) - 2 * zeta * omega * o.v) * h;
    o.x += o.v * h;
  }
  return o.x;
}
