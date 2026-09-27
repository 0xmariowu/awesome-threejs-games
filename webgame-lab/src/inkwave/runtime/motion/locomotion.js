// INKWAVE MIT actor._horizontal, extracted without scene, weapon, paint or Three dependencies.
import { clamp, smoothstep } from "../core/math.js";
/** Mutates planar velocity only. Collision/grounding and the speed policy belong to the host. */
export function stepLocomotion(
  state,
  tuning,
  dt,
  { isSquid = false, onEnemy = false, maxSpeed = tuning.runSpeed } = {},
) {
  const P = tuning;
  const mv = state.intent.move;
  const mh = Math.hypot(mv.x, mv.z);
  const mag = Math.min(1, mh);
  const vx = state.vel.x,
    vz = state.vel.z;
  const sp = Math.hypot(vx, vz);
  // ---- airborne: vector steering with light air control (momentum is kept)
  if (!state.grounded) {
    let target, accel, decel;
    if (isSquid) {
      target = Math.max(P.squidDrySpeed, sp);
      accel = P.squidAirAccel;
      decel = P.squidAirDecel;
    } else {
      target = Math.max(maxSpeed, P.airMinSpeed);
      accel = P.airAccel;
      decel = P.airDecel;
    }
    const tvx = mh > 0.01 ? (mv.x / mh) * target * mag : 0,
      tvz = mh > 0.01 ? (mv.z / mh) * target * mag : 0;
    const dvx = tvx - vx,
      dvz = tvz - vz,
      dl = Math.hypot(dvx, dvz);
    const rate = (mh > 0.01 ? accel : decel) * dt;
    if (dl <= rate) {
      state.vel.x = tvx;
      state.vel.z = tvz;
    } else {
      state.vel.x += (dvx / dl) * rate;
      state.vel.z += (dvz / dl) * rate;
    }
    return;
  }
  // ---- grounded: speed + heading model
  let vt, A, aIn, inKnee, outKnee, D, dMin, dKnee, W;
  if (isSquid && state.submerged) {
    vt = P.swimSpeed;
    A = P.swimAccel;
    aIn = P.swimAccelIn;
    inKnee = 3;
    outKnee = P.swimOutKnee;
    D = P.swimDecel;
    dMin = 0.5;
    dKnee = 4;
    W = P.swimTurn;
  } else if (isSquid) {
    vt = P.squidDrySpeed;
    A = P.squidAccel;
    aIn = 0.6;
    inKnee = 1;
    outKnee = 0.3;
    D = P.squidDecel;
    dMin = 0.5;
    dKnee = 2;
    W = P.squidTurn;
  } else {
    vt = maxSpeed;
    A = P.runAccel;
    aIn = P.runAccelIn;
    inKnee = P.runInKnee;
    outKnee = P.runOutKnee;
    D = P.runDecel;
    dMin = P.runDecelMin;
    dKnee = P.runDecelKnee;
    W = P.turnRate;
    if (state.hardLand > 0) vt *= 1 - (1 - P.hardLandSlow) * state.hardLand;
  }
  if (onEnemy) {
    vt = Math.min(vt, P.enemyInkSpeed);
    A = Math.min(A, P.enemyInkAccel);
    D = Math.max(P.enemyInkDecel, 0);
  }
  if (mh < 0.01) {
    // brake: strong at speed, easing into the stop
    if (sp < 1e-4) {
      state.vel.x = 0;
      state.vel.z = 0;
      return;
    }
    const d = D * (dMin + (1 - dMin) * smoothstep(0, dKnee, sp)) * dt;
    const k = Math.max(0, sp - d) / sp;
    state.vel.x *= k;
    state.vel.z *= k;
    return;
  }
  const tx = mv.x / mh,
    tz = mv.z / mh,
    vts = vt * mag;
  let dx = tx,
    dz = tz;
  if (sp > 0.05) {
    dx = vx / sp;
    dz = vz / sp;
  }
  const cosA = clamp(dx * tx + dz * tz, -1, 1);
  const ang = Math.acos(cosA);
  if (sp > 0.5 && ang > P.reverseAngle) {
    // plant-and-reverse: brake through zero toward the new direction
    const tvx = tx * vts,
      tvz = tz * vts,
      ex = tvx - vx,
      ez = tvz - vz,
      el = Math.hypot(ex, ez);
    const r = Math.max(P.reverseDecel, D) * dt * (onEnemy ? 0.5 : 1);
    if (el <= r) {
      state.vel.x = tvx;
      state.vel.z = tvz;
    } else {
      state.vel.x += (ex / el) * r;
      state.vel.z += (ez / el) * r;
    }
    return;
  }
  // heading slews toward the input (faster when slow) — turns carve at full speed instead of dipping
  const wmax = W * (1 + P.turnRateSlow * (1 - smoothstep(0, vt, sp)));
  const rot = Math.min(ang, wmax * dt);
  if (rot > 1e-6) {
    const s = dz * tx - dx * tz >= 0 ? 1 : -1;
    const c = Math.cos(rot * s),
      sn = Math.sin(rot * s);
    const nx = dx * c + dz * sn,
      nz = -dx * sn + dz * c;
    dx = nx;
    dz = nz;
  }
  let ns;
  if (sp < vts) {
    const a =
      A *
      (aIn + (1 - aIn) * smoothstep(0, inKnee, sp)) *
      clamp((vts - sp) / (outKnee * vt), P.runOutMin, 1);
    ns = Math.min(vts, sp + a * dt);
  } else {
    // over speed (swim exit glide, entering enemy ink, starting to fire): shed it at the brake rate
    ns = Math.max(
      vts,
      sp - D * (dMin + (1 - dMin) * smoothstep(0, dKnee, sp - vts)) * dt,
    );
  }
  state.vel.x = dx * ns;
  state.vel.z = dz * ns;
}
