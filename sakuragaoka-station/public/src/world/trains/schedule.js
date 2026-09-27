// Train traffic — pure functions of the simulation time t (120 s loop, see layout.js SCHEDULE).
//
// Train A: westbound on track A (moves -X, dest 花見台). Stopped centred at x=17 for t∈[0,48],
//          doors 2..44, departs 48 (0.8 m/s²), crosses x=-12 ≈52–59, exits west;
//          the next A comes in from the far east (cruise 20 m/s, 0.75 m/s² brake) and stops at 120≡0.
// Train B: eastbound on track B (moves +X, dest 春日野). Cruises in from the far west at 18 m/s,
//          brakes at 0.611 m/s² so it passes the crossing slowly (~7→4 m/s) during ≈19–27,
//          stops centred at x=17 at 32, doors 34..70, departs 76 east (0.8 m/s²).
import { TRAIN, RAIL, SCHEDULE } from '../layout.js';

export const PERIOD = TRAIN.period;                     // 120
export const TRAIN_LEN = TRAIN.cars * TRAIN.carLen;     // 36 (body + couplers ≈ 36.3)
export const HALF = TRAIN_LEN / 2;
const LIMIT = RAIL.xMax - HALF;                         // |x| beyond which the train is hidden (stays on the rails)

export const CFG = {
  A: {
    id: 'A', track: 'A', z: RAIL.zA, dir: -1, stopX: TRAIN.stopCenterX,
    arriveT: 0, departT: SCHEDULE.A.depart, doors: SCHEDULE.A.doors,
    acc: 0.8, vmax: 25, vc: 20, brake: 0.75,
    dest: '花見台', destEn: 'Hanamidai', platform: 1,
  },
  B: {
    id: 'B', track: 'B', z: RAIL.zB, dir: +1, stopX: TRAIN.stopCenterX,
    arriveT: SCHEDULE.B.stop, departT: SCHEDULE.B.depart, doors: SCHEDULE.B.doors,
    acc: 0.8, vmax: 25, vc: 18, brake: 2 * 11 / 36, // 0.611: tail clears x=-12 at t≈26
    dest: '春日野', destEn: 'Kasugano', platform: 2,
  },
};

const mod = (a, n) => ((a % n) + n) % n;
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const ease = (v) => { v = clamp01(v); return v * v * (3 - 2 * v); };

function brakeDist(sig, vc, b) { const Tb = vc / b; return sig <= Tb ? 0.5 * b * sig * sig : 0.5 * b * Tb * Tb + vc * (sig - Tb); }
function brakeSpeed(sig, vc, b) { return Math.min(vc, b * sig); }
function accDist(tau, a, vmax) { const Ta = vmax / a; return tau <= Ta ? 0.5 * a * tau * tau : 0.5 * a * Ta * Ta + vmax * (tau - Ta); }
function accSpeed(tau, a, vmax) { return Math.min(vmax, a * tau); }

/** Door opening 0..1 at cycle time tm. Opening takes 1.8 s, closing 2.2 s. */
export function doorsAt(cfg, tm) {
  const [o, c] = cfg.doors;
  if (tm < o || tm > c + 2.2) return 0;
  return ease((tm - o) / 1.8) * (1 - ease((tm - c) / 2.2));
}

/** Full state of a train at absolute time t.
 *  x = centre, v = speed (m/s, >= 0), s = odometer along travel (m, for wheel rotation),
 *  phase: 'stopped' | 'departing' | 'arriving' | 'hidden'. */
export function stateAt(cfg, t) {
  const tm = mod(t, PERIOD);
  const cyc = Math.floor(t / PERIOD);
  const dwell = mod(cfg.departT - cfg.arriveT, PERIOD);
  const ta = mod(tm - cfg.arriveT, PERIOD);       // time since the last arrival
  const st = { id: cfg.id, cfg, tm, x: cfg.stopX, v: 0, s: 0, braking: false, phase: 'stopped', visible: true, doors: 0, stopped: true };
  // odometer: every cycle the train runs "one lap"; s grows monotonically (only used for wheels)
  const lap = 1000;
  const cycArr = Math.floor((t - cfg.arriveT) / PERIOD);
  if (ta <= dwell) {
    st.s = cycArr * lap;
    st.doors = doorsAt(cfg, tm);
    return st;
  }
  st.stopped = false;
  const tau = ta - dwell;                          // time since departure
  const sig = mod(cfg.arriveT - tm, PERIOD);        // time until the next arrival
  const sDep = accDist(tau, cfg.acc, cfg.vmax);
  const xDep = cfg.stopX + cfg.dir * sDep;
  const dArr = brakeDist(sig, cfg.vc, cfg.brake);
  const xArr = cfg.stopX - cfg.dir * dArr;
  if (Math.abs(xDep) <= LIMIT) {
    st.phase = 'departing'; st.x = xDep; st.v = accSpeed(tau, cfg.acc, cfg.vmax); st.s = cycArr * lap + sDep;
  } else if (Math.abs(xArr) <= LIMIT) {
    st.phase = 'arriving'; st.x = xArr; st.v = brakeSpeed(sig, cfg.vc, cfg.brake); st.braking = sig <= cfg.vc / cfg.brake;
    st.s = (cycArr + 1) * lap - dArr;
  } else {
    st.phase = 'hidden'; st.visible = false; st.x = cfg.dir * 1e4; st.v = 0; st.s = 0;
  }
  void cyc;
  return st;
}

/** Front (leading end) and tail x of a state. */
export const frontX = (st) => st.x + st.cfg.dir * HALF;
export const tailX = (st) => st.x - st.cfg.dir * HALF;

// ------------------------------------------------------------------ level crossing logic
const ZONE = 4;          // crossing half-zone (m)
const LEAD_T = 25;       // warning lead time for approaching trains (s)
const LEAD_D = 260;      // ... but only once the front is this close (m)
const PRE_DEPART = 8;    // stopped train: warning starts this long before departure

/** Crossing warning contribution of one train at crossing x (time t). Returns 0 | 1. */
export function crossingFor(cfg, x, t) {
  const st = stateAt(cfg, t);
  if (st.visible) {
    const f = frontX(st), tl = tailX(st);
    const lo = Math.min(f, tl), hi = Math.max(f, tl);
    if (hi >= x - ZONE && lo <= x + ZONE) return 1;              // occupying the crossing
  }
  const edge = x - cfg.dir * ZONE;                                // where the front enters the zone
  const isBefore = (s) => cfg.dir * (frontX(s) - edge) < 0;
  // A stopped train only warns from PRE_DEPART s before it leaves (station-stop logic).
  let horizon = LEAD_T;
  if (st.stopped) {
    const toDepart = mod(cfg.departT - st.tm, PERIOD);
    if (toDepart > PRE_DEPART) return 0;
    horizon = toDepart + LEAD_T;
  }
  // Step forward along the deterministic timetable: does the front, moving toward x, enter the zone?
  let before = st.visible ? isBefore(st) : false;
  const dt = 0.25;
  for (let k = 1; k * dt <= horizon; k++) {
    const tt = t + k * dt;
    const s2 = stateAt(cfg, tt);
    if (!s2.visible) { before = false; continue; }
    if (s2.stopped) {
      if (!st.stopped) return 0;           // it will stop before reaching the crossing -> no warning yet
      before = isBefore(s2); continue;
    }
    const b2 = isBefore(s2);
    if (before && !b2) {
      if (st.stopped) return 1;            // departing toward x within PRE_DEPART s
      const dist = cfg.dir * (edge - frontX(st));
      return st.visible && dist <= LEAD_D ? 1 : 0;
    }
    before = b2;
  }
  return 0;
}
