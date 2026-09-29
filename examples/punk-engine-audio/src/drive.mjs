// Quadra constants from gh; this small dynamometer is host code, not game physics.
export const IDLE = 900, REDLINE = 7600, LIMIT = 7800;
export const RATIOS = [3.25, 2.25, 1.68, 1.32, 1.08, .9];
const TORQUE = [[800,300],[1500,380],[2000,440],[2500,490],[3000,530],[3500,560],
  [4000,585],[4500,600],[5000,605],[5500,600],[6000,585],[6500,560],[7000,530],[7500,490],[8000,440]];
export const clamp = x => Math.max(0, Math.min(1, x));
function torque(rpm) {
  const i = TORQUE.findIndex(p => p[0] >= rpm);
  if (i <= 0) return TORQUE[i === 0 ? 0 : TORQUE.length - 1][1];
  const [a,b] = [TORQUE[i-1], TORQUE[i]];
  return a[1] + (b[1]-a[1]) * (rpm-a[0]) / (b[0]-a[0]);
}
export class Drive {
  rpm = IDLE; gear = 1; throttle = 0; load = 0; time = 0;
  shiftTimer = 0; limiterTimer = 0; limiterCuts = 0; shifts = 0;
  auto = false; coast = false; spin = 0; held = 0; cooldown = 0;
  releases = 0; releaseStrength = 0;
  shift(direction) {
    const next = Math.max(1, Math.min(6, this.gear + direction));
    if (this.shiftTimer > 0 || next === this.gear) return;
    this.rpm = Math.max(IDLE, Math.min(LIMIT, this.rpm * RATIOS[next-1] / RATIOS[this.gear-1]));
    this.gear = next; this.shiftTimer = .14; this.shifts++;
  }
  step(dt, input) {
    this.time += dt;
    this.releaseStrength = 0;
    if (this.auto) {
      if (this.rpm >= 7350 && !this.shiftTimer) {
        if (this.gear < 6) this.shift(1); else this.coast = true;
      }
      if (this.coast && this.rpm < 1500) { this.gear = 1; this.coast = false; }
      input = this.coast ? 0 : 1;
    }
    this.throttle = clamp(input);
    this.shiftTimer = Math.max(0, this.shiftTimer-dt);
    this.limiterTimer = Math.max(0, this.limiterTimer-dt);
    if (this.rpm >= LIMIT && this.limiterTimer === 0) { this.limiterTimer = .05; this.limiterCuts++; }
    const effective = this.shiftTimer > 0 || this.limiterTimer > 0 ? 0 : this.throttle;
    // Original yde torque/friction load, with no wheel/TCS torque cap in this fixture.
    const peak = torque(this.rpm);
    this.load = clamp((effective*peak - (1-effective)*(40+.011*this.rpm)) / peak);
    // Deliberately simplified acceleration and coast, scaled by the actual gear ratio.
    const acceleration = effective*3400*RATIOS[this.gear-1]/RATIOS[0];
    const drag = (1-effective)*(900+this.rpm*.12);
    this.rpm = Math.max(IDLE, Math.min(LIMIT+60, this.rpm+(acceleration-drag)*dt));
    // Qce/Ze: Quadra spool .5 s, decay .9 s, held > .25 s, spin > .3.
    const rev = clamp((this.rpm-IDLE)/(LIMIT-IDLE));
    const target = clamp((rev-.3)/.35)*this.throttle**1.5;
    this.spin += (target-this.spin)*Math.min(1,dt/(target>this.spin?.5:.9));
    this.cooldown -= dt;
    if (this.throttle > .6) this.held += dt;
    else if (this.throttle < .2) {
      if (this.held > .25 && this.spin > .3 && this.cooldown <= 0) {
        this.releaseStrength = this.spin; this.releases++; this.cooldown = .4;
      }
      this.held = 0;
    }
  }
}
