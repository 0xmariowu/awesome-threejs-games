// player.js
const ORIGIN = 0.95;
const M_H = 190;
const M_V = 170;
const W0 = 340;
const K_H = 1.25;
const K_V = 0.49;
const K_HF = 0.9;
const A_WALK = 2.05;
const A_SHIFT = 2.3;
const V_BACK = 0.5;
const BRAKE = 1.2;
const LAT_GRIP = 2.1;
const DRIVE_IN = 0.12;
const SLOPE_A = W0 / M_H;
const STATIC_V = 0.06;
const MU_A = 1.28 * W0 / M_H;
const V_WALK = Math.sqrt(stridePush(A_WALK) / K_H);
const V_DOWN = V_WALK;
const V_SHIFT = Math.sqrt(stridePush(A_SHIFT) / K_H);
const BODY_R = 0.3;
const SEG_LO = -ORIGIN + BODY_R;
const SEG_HI = 0.89 - BODY_R;
const CROWN = 0.89;
const TURN = 1.75;
const STAND_TURN = 1.25;
const BODY_ACC = 7;
const PMIN = -1.1, PMAX = 0.95;
const LEVEL = -0.06;
const STEP_LINE = 0.3;
const STEP_EX = 0.15;
const STEP_MAX = 0.55;
const BANK_MAX = 1.3;
const STEP_VU = 1.3;
const DROP_MAX = 0.6;
const CLAMBER_MAX = 1.25;
const CLAMBER_AT = 0.45;
const CLIMB_T0 = 1.1, CLIMB_T1 = 0.85;
const SCAN = [0.15, 0.3, 0.45, 0.6, 0.75, 0.9, 1.05, 1.2];
const RING_R$1 = 0.26;
const RING = [1, 0, 0.7071, 0.7071, 0, 1, -0.7071, 0.7071, -1, 0, -0.7071, -0.7071, 0, -1, 0.7071, -0.7071];
const SLIDE_HOLD = 0.25;
const BOUND_RISE = 0.7;
const BOUND_VY = 1.48;
const BOUND_FWD = 1.7;
const BOUND_FWD0 = 1.6;
const BOUND_HMAX = 3.4;
const K_HB = 0.09;
const CROUCH_T = 0.12;
const CROUCH_DY = 0.12;
const PUSH_T = 0.1;
const BUF_T = 0.75;
const STEP_LB = 0.12;
const STEP_LOOK = 0.45;
const STEP_ACC = 14, STEP_VMAX = 2.4;
const PLAN_OVER = 1.35, PLAN_HOP = 1.6;
const BAND = 0.3, VEER_RATE = 2.5, MU_C = 0.3;
const CONTACT_DV = 0.45;
const PF_D = 0.05, PF_N = 105;
const PLAN_TOL = 0.1, LAND_STEP = 0.25;
const KNEE = 0.06;
const PLAN_VH = [1, 0.85, 0.7, 0.55, 1.2, 0.9, 0.6, 0.4, 0.25];
const PLAN_SIDE = [0.15, 0.25, 0.35, 0.5, 0.65];
const VALVE_HOLD$1 = 0.4;
const DUMP_MIN = 0.25;
const VALVE_LAG = 0.15;
const VALVE_UP = 170;
const VALVE_TAU = 0.35;
const RISE_MAX$1 = 0.6;
const CEIL_H = 2.0, CEIL_K = 1.5, CEIL_D = 1.2;
const BLOWUP_T$1 = 4.0;
const TETHER_K = 0.92;
const TETHER_A = 1.6;
const AW_V = V_WALK;
const AW_BRAKE = 0.6;
const AW_GIVEUP = 8;
const AW_RATE = Math.PI / 3;
const AW_ORBIT = 1.5;
const NEAR_ORBIT = 0.4;
const VIEW_W = 24;
const YAW_K = 3.5;
const YAW_ACC = 6;
const YAW_CAP = 1.6;
const DIST_MIN = 1.2;
const PULL_MAX = 3;
const BOOMS = [0, 0.2, 0.4, 0.6, 0.8];
const DIST = 3.2;
const PIVOT_UP = 0.55;
const TILT = 0.20;
const LENS_R = 0.3;
const CLEAR = 0.5;
const THIN = 0.14;
const THIN_R = 0.12;
const PIV_W = 6.0;
const NEAR_R = 8.5;
const MOVE_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space']);
const DEG$5 = Math.PI / 180;

const _pt = new THREE.Vector3(), _dir = new THREE.Vector3(), _off = new THREE.Vector3();
const _rt$1 = new THREE.Vector3(), _v = new THREE.Vector3();
const _e = new THREE.Euler(0, 0, 0, 'YXZ');
new THREE.Quaternion();
const _s = [0, 0];
const _ss = { s: 0, t: 0, cx: 0, cy: 0, cz: 0, qx: 0, qy: 0, qz: 0 };
const wrap$1 = (a) => Math.atan2(Math.sin(a), Math.cos(a));
function bump(ph, c) { let d = ph - c; d -= Math.round(d); return Math.abs(d) < 0.09 ? 0.5 * (1 + Math.cos((Math.PI * d) / 0.09)) : 0; }
function stridePush(A) {
  let s = 0;
  for (let i = 0; i < 400; i++) {
    const ph = (i + 0.5) / 400;
    s += Math.min(MU_A, (A * (0.8 + 0.4 * (bump(ph, 0.05) + bump(ph, 0.55)))) / 0.872);
  }
  return s / 400;
}

function spr(x, v, target, w, dt) {
  const f = 1 + 2 * dt * w, hoo = dt * w * w, det = 1 / (f + dt * hoo);
  _s[0] = (f * x + dt * v + dt * hoo * target) * det;
  _s[1] = (v + hoo * (target - x)) * det;
  return _s;
}

function segSeg(px, y0, y1, pz, ax, ay, az, bx, by, bz, o) {
  const L = y1 - y0, ex = bx - ax, ey = by - ay, ez = bz - az;
  const rx = px - ax, ry = y0 - ay, rz = pz - az;
  const A = L * L, E = ex * ex + ey * ey + ez * ez, F = ex * rx + ey * ry + ez * rz;
  let s, t;
  if (E < 1e-9) { t = 0; s = A > 1e-9 ? clamp$9(-ry * L / A, 0, 1) : 0; }
  else {
    const C = L * ry, B = L * ey, den = A * E - B * B;
    s = den > 1e-9 ? clamp$9((B * F - C * E) / den, 0, 1) : 0;
    t = (B * s + F) / E;
    if (t < 0) { t = 0; s = clamp$9(-C / A, 0, 1); } else if (t > 1) { t = 1; s = clamp$9((B - C) / A, 0, 1); }
  }
  o.s = s; o.t = t;
  o.cx = px; o.cy = y0 + L * s; o.cz = pz;
  o.qx = ax + ex * t; o.qy = ay + ey * t; o.qz = az + ez * t;
  const dx = o.cx - o.qx, dy = o.cy - o.qy, dz = o.cz - o.qz;
  return dx * dx + dy * dy + dz * dz;
}

const _g3 = { ax: 0, ay: 0, az: 0, bx: 0, by: 0, bz: 0 };
function segSeg3(p1x, p1y, p1z, q1x, q1y, q1z, p2x, p2y, p2z, q2x, q2y, q2z, o) {
  const d1x = q1x - p1x, d1y = q1y - p1y, d1z = q1z - p1z, d2x = q2x - p2x, d2y = q2y - p2y, d2z = q2z - p2z;
  const rx = p1x - p2x, ry = p1y - p2y, rz = p1z - p2z;
  const a = d1x * d1x + d1y * d1y + d1z * d1z, e = d2x * d2x + d2y * d2y + d2z * d2z, f = d2x * rx + d2y * ry + d2z * rz;
  let s, t;
  if (a < 1e-9 && e < 1e-9) { s = 0; t = 0; } else if (a < 1e-9) { s = 0; t = clamp$9(f / e, 0, 1); } else {
    const c = d1x * rx + d1y * ry + d1z * rz;
    if (e < 1e-9) { t = 0; s = clamp$9(-c / a, 0, 1); } else {
      const b = d1x * d2x + d1y * d2y + d1z * d2z, den = a * e - b * b;
      s = den > 1e-9 ? clamp$9((b * f - c * e) / den, 0, 1) : 0;
      t = (b * s + f) / e;
      if (t < 0) { t = 0; s = clamp$9(-c / a, 0, 1); } else if (t > 1) { t = 1; s = clamp$9((b - c) / a, 0, 1); }
    }
  }
  o.ax = p1x + d1x * s; o.ay = p1y + d1y * s; o.az = p1z + d1z * s;
  o.bx = p2x + d2x * t; o.by = p2y + d2y * t; o.bz = p2z + d2z * t;
  const dx = o.ax - o.bx, dy = o.ay - o.by, dz = o.az - o.bz;
  return dx * dx + dy * dy + dz * dz;
}

class Hash {
  constructor(cell = 2) { this.cell = cell; this.inv = 1 / cell; this.map = new Map(); this.stamp = 1; }
  key(i, j) { return (i + 4096) * 8192 + (j + 4096); }
  add(rec, x0, x1, z0, z1) {
    const f = this.inv;
    for (let i = Math.floor(x0 * f); i <= Math.floor(x1 * f); i++) {
      for (let j = Math.floor(z0 * f); j <= Math.floor(z1 * f); j++) {
        const k = this.key(i, j);
        let l = this.map.get(k);
        if (!l) this.map.set(k, (l = []));
        l.push(rec);
      }
    }
  }
  cell1(x, z) { return this.map.get(this.key(Math.floor(x * this.inv), Math.floor(z * this.inv))); }
  query(x0, x1, z0, z1, outS, outC) {
    const f = this.inv, st = ++this.stamp;
    outS.length = 0; outC.length = 0;
    for (let i = Math.floor(x0 * f); i <= Math.floor(x1 * f); i++) {
      for (let j = Math.floor(z0 * f); j <= Math.floor(z1 * f); j++) {
        const l = this.map.get(this.key(i, j));
        if (!l) continue;
        for (const r of l) { if (r.st === st) continue; r.st = st; (r.cap ? outC : outS).push(r); }
      }
    }
  }
}

class Player {
  constructor(camera, dom) {
    this.camera = camera;
    this.dom = dom;
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0;
    this.keys = Object.create(null);
    this.stick = null;
    this.enabled = false;
    this.locked = false;
    this.holding = false;
    this.dragging = false;
    this.lastInput = performance.now();
    this.clock = 0;
    this.thrust = 0;
    this.sprint = false;
    this.turnV = 0;
    this.lastLook = 0;
    this.pressing = false;
    this.dragged = false;
    this.moved = 0;
    this.downT = 0;
    this.inspect = 0;
    this.drift = new THREE.Vector3();
    this.mode = 'ground';
    this.grounded = true;
    this.landT = 1;
    this.airT = 0;
    this.yv = 0;
    this.lean = 3;
    this.effort = 0.2;
    this.slope = 0;
    this.stepPhase = 0;
    this.valve = 0;
    this.lift = 0;
    this.valveUsed = false;
    this.blowup = 0;
    this.drive = 0;
    this.intent = null;
    this._crouch = -1;
    this._push = 0;
    this._pdx = 0; this._pdz = 0;
    this._bnd = false;
    this._landB = false;
    this.tetherStrain = 0;
    this.brink = false;
    this.floatH = 0;
    this.ground = 0;
    this.onRock = false;
    this.climb = { on: false, t: 0, T: 1, rise: 0, from: new THREE.Vector3(), top: 0, dir: new THREE.Vector3(), edge: new THREE.Vector3(), hands: 0 };
    this.auto = null;
    this.ev = [];
    this.dbg = { rise: 0, ex: 0, S0: 0, blocked: 0, mode: '', stuck: 0 };
    this._sp = { down: false, t0: -9, used: true, hit: false, armed: false, closeT: -1, knocked: false };
    this._driveT = 0;
    this._offT = 0;
    this._standTurn = false;
    this._stuckT = 0;
    this._pushT = 0;
    this._clamberT = 0;
    this._slide = { on: false, t: 9, nx: 0, nz: 0, sgn: 1 };
    this._yT = NaN;
    this._px = 0; this._pz = 0;
    this._hint = { wall: false, brink: false, tether: false, blow: false };
    this._landUsedT = -1;
    this._phase = 0;
    this._yPrev = 0;
    this._near = { S: [], C: [], x: 1e9, z: 1e9 };
    this._tmpS = []; this._tmpC = [];
    this._hash = null; this._hObs = null; this._hCap = null; this._thash = null;
    this._grid = null;
    this._ground = null;
    this._tiles = new Array(24 * 24).fill(null);
    this._tq = [];
    this._tb = null;
    this._sKind = 0;
    this.groundFn = (x, z) => this._g(x, z);
    this.support = (x, z) => this._S(x, z);
    this._blk = new THREE.Vector3();
    this.body = { yaw: 0, pitch: 0, roll: 0, yawRate: 0, yawV: 0 };
    this.cam = {
      dist: DIST, pivot: new THREE.Vector3(), pv: new THREE.Vector3(), base: new THREE.Vector3(), init: false, tight: 0, fov: 0,
      yaw: 0, yawV: 0, pitch: 0, pitchV: 0, va: 0, insp: 0, find: 0, sh: 0.5, float: 0, kAir: 0.5, kAirV: 0,
      gRef: 0, gRefV: 0, R: new THREE.Vector3(), RV: new THREE.Vector3(),
      vaV: 0, floatV: 0, findV: 0, inspV: 0, tightV: 0, shV: 0, distV: 0, boom: 0, boomV: 0, hA: 0, hAV: 0, guard: 0, guardV: 0, lastPP: -0.26, rope: new THREE.Vector3(), ropeV: new THREE.Vector3(), ropeD: 9,
      orb: 0, orbV: 0, appr: 0, apprV: 0, side: 1, sideT: 0, lv: new THREE.Vector3(), lvV: new THREE.Vector3(),
    };
    this.camPos = new THREE.Vector3();
    this.camQuat = new THREE.Quaternion();
    this.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.lockAllowed = typeof dom.requestPointerLock === 'function';
    this.autoLock = true;
    this.lockFails = 0;
    this.lockRetryAt = 0;
    this.lockPendingUntil = 0;
    this.lockClick = false;
    this.userUnlocked = false;
    this._lockP = null;
    this._lockKey = false;
    this._releasing = false;
    this.fine = matchMedia('(pointer: fine)').matches;

    addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
      if (e.code === 'Space' && !e.repeat) this._sp.hit = true;
      this.lastInput = performance.now();
      if (this.enabled && MOVE_KEYS.has(e.code)) this._lockKey = true;
      if (this.enabled && ['Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
    });
    addEventListener('keyup', (e) => { this.keys[e.code] = false; });
    addEventListener('blur', () => { this.keys = Object.create(null); this.holding = false; this.pressing = false; });

    dom.addEventListener('pointerdown', (e) => {
      if (!this.enabled) return;
      this.lastInput = performance.now();
      const mouse = e.pointerType === 'mouse';
      if (mouse && e.button !== 0) return;
      this.lockClick = mouse && !this.locked && this.requestLock(true);
      this.pressing = true;
      this.holding = this.locked;
      this.dragged = false;
      this.moved = 0;
      this.downT = this.clock;
      this.dragging = !this.locked;
      this.lastX = e.clientX; this.lastY = e.clientY;
      try { dom.setPointerCapture(e.pointerId); } catch (err) {  }
    });
    const end = () => { this.holding = false; this.dragging = false; this.pressing = false; this.lockClick = false; };
    dom.addEventListener('pointerup', end);
    dom.addEventListener('pointercancel', end);
    document.addEventListener('pointerlockchange', () => {
      const was = this.locked;
      this.locked = document.pointerLockElement === dom;
      if (this.locked) {
        this.lockFails = 0;
        this.lockRetryAt = 0;
        this.lockPendingUntil = 0;
        this.userUnlocked = false;
      } else if (was) {
        if (!this._releasing) this.userUnlocked = true;
        this.holding = false; this.pressing = false; this.dragging = false;
      }
      this._releasing = false;
    });
    document.addEventListener('pointerlockerror', () => { if (!this._lockP) this._lockFailed(null); });
    addEventListener('pointermove', (e) => {
      if (!this.enabled) return;
      if (this.locked) {
        this._look(e.movementX || 0, e.movementY || 0, 0.0021);
      } else if (this.dragging) {
        const dx = e.clientX - this.lastX, dy = e.clientY - this.lastY;
        this.lastX = e.clientX; this.lastY = e.clientY;
        this.moved += Math.abs(dx) + Math.abs(dy);
        if (!this.holding && this.moved > 8) this.dragged = true;
        this._look(dx, dy, e.pointerType === 'touch' ? 0.0042 : 0.0034);
      }
    });
  }

  requestLock(click = false) {
    if (click) this.userUnlocked = false;
    if (this.locked || !this.lockAllowed) return false;
    const now = performance.now();
    if (now < this.lockRetryAt || now < this.lockPendingUntil) return false;
    let p;
    try { p = this.dom.requestPointerLock(); } catch (err) { this._lockFailed(err); return false; }
    this._lockP = p && typeof p.then === 'function' ? p : null;
    this.lockPendingUntil = now + 1500;
    if (this._lockP) this._lockP.then(() => { this.lockPendingUntil = 0; }, (err) => this._lockFailed(err));
    return true;
  }

  _lockFailed(err) {
    this.lockPendingUntil = 0;
    this.lockClick = false;
    const name = err && err.name;
    if (name === 'NotSupportedError') { this.lockAllowed = false; return; }
    if (name === 'NotAllowedError') return;
    this.lockFails++;
    this.lockRetryAt = performance.now() + (this.lockFails >= 4 ? 6000 : 1200);
  }

  _look(dx, dy, s) {
    this.yaw -= dx * s;
    this.pitch = clamp$9(this.pitch - dy * s, PMIN, PMAX);
    this.lastLook = this.clock;
    this.lastInput = performance.now();
    if (this.auto) this.auto.look += Math.abs(dx * s) + Math.abs(dy * s);
  }

  releaseLock() {
    if (document.pointerLockElement) { this._releasing = true; document.exitPointerLock(); }
    this.holding = false; this.pressing = false; this.dragging = false; this.lockClick = false;
  }

  get forward() {
    return new THREE.Vector3(-Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), -Math.cos(this.yaw) * Math.cos(this.pitch));
  }

  idleSeconds() { return (performance.now() - this.lastInput) / 1000; }

  get lensDistance() { return this.cam.dist; }
  get supportKind() { return this._sKind; }

  place(pos, yaw, pitch = -0.1, opts = null) {
    this.pos.copy(pos);
    this.vel.set(0, 0, 0);
    if (opts && opts.vel) this.vel.copy(opts.vel);
    this.yaw = yaw;
    this.pitch = clamp$9(pitch, PMIN, PMAX);
    this.turnV = 0;
    this.lastLook = this.clock;
    this.pressing = this.holding = this.dragging = this.lockClick = false;
    const b = this.body;
    b.yaw = opts && Number.isFinite(opts.bodyYaw) ? opts.bodyYaw : yaw;
    b.pitch = 0; b.roll = 0; b.yawRate = 0; b.yawV = 0;
    const S = this._S(pos.x, pos.z);
    const h = pos.y - (S + ORIGIN);
    const gr = opts && typeof opts.grounded === 'boolean' ? opts.grounded : h < 0.3;
    this._setGround(gr, S);
    if (gr && Math.abs(h) < 0.3) this.pos.y = S + ORIGIN;
    this.yv = 0;
    this._yPrev = this.pos.y;
    this.landT = 1;
    this.lift = 0; this.valve = 0; this.blowup = 0;
    this._sp.armed = false; this._sp.used = true; this._sp.hit = false; this._sp.closeT = -1;
    this.climb.on = false;
    this.auto = null;
    this._crouch = -1; this._push = 0; this._pdx = this._pdz = 0; this._bnd = false; this.intent = null;
    this._slide.on = false;
    this.cam.init = false;
    this.cam.R.set(0, 0, 0); this.cam.RV.set(0, 0, 0);
  }

  _setGround(on, S) {
    this.mode = on ? 'ground' : 'air';
    this.grounded = on;
    this.ground = S;
    this._yT = NaN;
    if (!on) this.airT = 0;
  }

  adoptLens(camera, group, opts = {}) {
    _e.setFromQuaternion(camera.quaternion, 'YXZ');
    const cy = _e.y, cp = _e.x;
    if (group) {
      this.pos.copy(group.position);
      _v.set(0, 0, -1).applyQuaternion(group.quaternion);
      const hl = Math.hypot(_v.x, _v.z);
      this.body.yaw = hl > 0.3 ? Math.atan2(-_v.x, -_v.z) : cy;
    } else this.body.yaw = cy;
    this.body.yawV = 0; this.body.yawRate = 0; this.body.pitch = 0; this.body.roll = 0;
    const S = this._S(this.pos.x, this.pos.z);
    this._setGround(this.pos.y - (S + ORIGIN) < 0.15, S);
    const va0 = this._slopeBias(this.pos.x, this.pos.z, cy) * (this.grounded ? 1 : 0.5);
    let ap = cp - va0 + this._tilt(cp, 0, 0);
    ap = cp - va0 + this._tilt(ap, 0, 0);
    this.yaw = cy;
    this.pitch = clamp$9(ap, PMIN, PMAX);
    this.turnV = 0;
    this.lastLook = this.clock;
    this.landT = opts.landing ? 0 : 1;
    this.lift = 0; this.valve = 0; this.blowup = 0;
    this.yv = 0;
    this._yPrev = this.pos.y;
    const gv = opts.glideV;
    this.vel.set(0, 0, 0);
    if (gv) { this.vel.set(gv.x, 0, gv.z).multiplyScalar(0.5); if (this.vel.length() > 0.6) this.vel.setLength(0.6); }
    this._sp.armed = false; this._sp.used = true; this._sp.hit = false; this._sp.closeT = -1;
    this.climb.on = false;
    this.auto = null;
    this._crouch = -1; this._push = 0; this._pdx = this._pdz = 0; this._bnd = false; this.intent = null;
    const c = this.cam;
    c.init = true;
    c.yaw = cy; c.pitch = this.pitch; c.va = va0; c.insp = 0; c.find = 0; c.float = 0; c.kAir = 0.5; c.gRef = S; c.fov = 0;
    c.yawV = c.pitchV = c.vaV = c.floatV = c.findV = c.inspV = c.kAirV = c.gRefV = c.tightV = c.shV = c.distV = 0;
    c.guard = 0; c.guardV = 0; c.boom = 0; c.boomV = 0; c.hA = 0; c.hAV = 0; c.lastPP = cp;
    c.orb = 0; c.orbV = 0; c.appr = 0; c.apprV = 0; c.side = 1; c.sideT = 0;
    c.lv.set(this.vel.x, 0, this.vel.z); c.lvV.set(0, 0, 0);
    c.base.set(this.pos.x, 0, this.pos.z); c.pv.set(0, 0, 0);
    const pp = this.pitch + va0 - this._tilt(this.pitch, 0, 0);
    const sy = Math.sin(cy), cyy = Math.cos(cy);
    _rt$1.set(cyy, 0, -sy);
    _dir.set(-sy * Math.cos(pp), Math.sin(pp), -cyy * Math.cos(pp));
    const base = _pt.set(this.pos.x, S + ORIGIN + PIVOT_UP, this.pos.z);
    _off.subVectors(camera.position, base);
    c.sh = clamp$9(_off.dot(_rt$1), -0.9, 0.9);
    c.pivot.copy(base).addScaledVector(_rt$1, c.sh);
    c.tight = this._env ? 1 - smoothstep(0.7, 2.6, this._clearance(c.pivot, this._env)) : 0;
    _off.subVectors(camera.position, c.pivot);
    c.dist = clamp$9(-_off.dot(_dir), 1.8, 4.5 * FRAME.reach());
    _off.subVectors(camera.position, c.pivot).addScaledVector(_dir, c.dist);
    c.R.set(_off.dot(_rt$1), _off.y, _off.x * sy + _off.z * cyy);
    c.RV.set(0, 0, 0);
    this.camPos.copy(camera.position);
    this.camQuat.copy(camera.quaternion);
  }

  restPose(pos, yaw, pitch = LEVEL, env = null) {
    if (env) this._prep(env);
    const S = this._S(pos.x, pos.z);
    const va = this._slopeBias(pos.x, pos.z, yaw);
    const pp = pitch + va - this._tilt(pitch, 0, 0);
    const sy = Math.sin(yaw), cy = Math.cos(yaw);
    _rt$1.set(cy, 0, -sy);
    _dir.set(-sy * Math.cos(pp), Math.sin(pp), -cy * Math.cos(pp));
    const piv = new THREE.Vector3(pos.x, S + ORIGIN + PIVOT_UP, pos.z);
    const DK = DIST * FRAME.reach();
    let dist = DK, sh = 0;
    for (let k = 0; k < 3; k++) {
      const shW = this._shoulder(dist, pp);
      sh = env ? Math.min(shW, this._cast(piv, _rt$1, shW, env, 0.15, 0.25, 0, true)) : shW;
      _pt.copy(piv).addScaledVector(_rt$1, sh);
      _off.copy(_dir).negate();
      const want = DK - (env ? 0.6 * (1 - smoothstep(0.7, 2.6, this._clearance(_pt, env))) : 0);
      if (env) {
        const h = this._hardCast(_pt, _off, want, env), s = Math.min(h, this._softCast(_pt, _off, want, env));
        dist = Math.max(s, Math.min(h, DIST_MIN));
      } else dist = want;
    }
    const p = new THREE.Vector3().copy(_pt).addScaledVector(_off, dist);
    const q = new THREE.Quaternion().setFromEuler(_e.set(pp, yaw, 0, 'YXZ'));
    return { pos: p, q, fov: 0 };
  }

  restRig(aspect = this.camera.aspect, vfovDeg = this.camera.fov) {
    const pp = LEVEL - this._tilt(LEVEL, 0, 0), DK = DIST * FRAME.reach();
    return { right: this._shoulder(DK, pp, aspect, vfovDeg), up: PIVOT_UP + DK * Math.sin(-pp), back: DK * Math.cos(pp), pitch: pp };
  }

  autoWalk(spot, onArrive = null, face = null) {
    this.auto = { spot: spot.clone(), onArrive, face: face ? face.clone() : null, look: 0, t: 0, best: Infinity, d: 9, stop: false, st: 0, yv: 0, faceYaw: this.body.yaw };
  }
  cancelAuto() { this.auto = null; }

  takeEvents() {
    if (!this.ev.length) return this.ev;
    const e = this.ev;
    this.ev = [];
    return e;
  }

  update(dt, t, env) {
    this.clock += dt;
    const k = this.keys, now = this.clock;
    this._prep(env);
    if (this._lockKey) {
      this._lockKey = false;
      if (this.autoLock && this.fine && !this.userUnlocked && !this.locked) this.requestLock();
    }
    if (this.pressing && !this.holding && !this.lockClick && (this.locked || (!this.dragged && now - this.downT > 0.18))) this.holding = true;
    let fwdIn = ((k.KeyW || k.ArrowUp || this.holding) ? 1 : 0) - ((k.KeyS || k.ArrowDown) ? 1 : 0);
    let turnIn = ((k.KeyA || k.ArrowLeft) ? 1 : 0) - ((k.KeyD || k.ArrowRight) ? 1 : 0);
    if (this.stick && this.stick.on) { fwdIn = this.stick.fwd > 0 ? 1 : this.stick.fwd < 0 ? -1 : 0; turnIn = this.stick.turn; }
    const shift = !!(k.ShiftLeft || k.ShiftRight);
    if (fwdIn || turnIn) this.lastInput = performance.now();
    const sp = this._sp, spDown = !!k.Space;
    if (!sp.armed) { if (!spDown) sp.armed = true; sp.hit = false; }
    let spPress = false, spRelease = false;
    if (sp.armed) {
      if ((spDown || sp.hit) && !sp.down) { spPress = true; sp.t0 = now; sp.used = false; }
      if (!spDown && (sp.down || spPress)) spRelease = true;
      sp.down = spDown;
    } else sp.down = false;
    sp.hit = false;
    this._lastAuto = null;
    if (this.auto && (fwdIn || turnIn || spPress || this.auto.look > 0.3 || this.auto.t > AW_GIVEUP)) this.cancelAuto();
    const auto = this.auto;
    if (auto) {
      const d = Math.hypot(auto.spot.x - this.pos.x, auto.spot.z - this.pos.z);
      if (d < auto.best - 0.05) { auto.best = d; auto.t = 0; }
      if (!auto.stop && this.grounded && (d < 0.1 || (d < 0.4 && d > auto.d + 1e-4))) auto.stop = true;
      auto.d = d;
      fwdIn = auto.stop ? 0 : 1;
    }

    this.turnV += (turnIn * TURN - this.turnV) * (1 - Math.exp(-10 * dt));
    this.yaw += this.turnV * dt;
    if (turnIn && !fwdIn && !auto && this.grounded) {
      const ld = wrap$1(this.yaw - this.body.yaw);
      if (Math.abs(ld) > 0.35) { this.yaw = this.body.yaw + Math.sign(ld) * 0.35; this.turnV = clamp$9(this.turnV, -STAND_TURN, STAND_TURN); }
    }
    if (auto) {
      const F = auto.face || auto.spot, fx = F.x - this.pos.x, fz = F.z - this.pos.z;
      const ty = Math.hypot(fx, fz) > 0.05 ? Math.atan2(-fx, -fz) : this.yaw;
      auto.faceYaw = auto.face || !auto.stop ? ty : this.body.yaw;
      const e = wrap$1(ty - this.yaw), w = 2.6;
      const yv = (auto.yv + w * w * dt * e) / (1 + 2 * dt * w + dt * dt * w * w);
      const lim = (Math.abs(yv) > Math.abs(auto.yv) ? 3 : 8) * dt;
      auto.yv = clamp$9(auto.yv + clamp$9(yv - auto.yv, -lim, lim), -AW_RATE, AW_RATE);
      this.yaw += auto.yv * dt;
      this.pitch += (clamp$9(-0.3, PMIN, PMAX) - this.pitch) * (1 - Math.exp(-2 * dt));
      auto.t += dt;
    }
    const still = now - this.lastLook;
    if (fwdIn > 0 && still > 2.5 && !auto) this.pitch += (LEVEL - this.pitch) * (1 - Math.exp(-0.35 * dt));

    if (env.current) {
      const c = env.current(this.pos.x, this.pos.y, this.pos.z);
      this.drift.set(c.x, c.y, c.z);
    } else this.drift.set(0, 0, 0);
    this._refreshNear();
    this._tileWork();
    const bag = clamp$9(env.bag || 0, 0, 1);
    const W = W0 + 15 * 3 * bag, MH = M_H * (1 + 0.06 * bag);
    let tAx = 0, tAz = 0, tOut = 0;
    this.tetherStrain = 0;
    const T = env.tether;
    if (T && T.anchor && Number.isFinite(T.anchor.x)) {
      const Lm = T.maxLen || 44.5;
      const dx = T.anchor.x - this.pos.x, dy = T.anchor.y - (this.pos.y + 0.45), dz = T.anchor.z - this.pos.z;
      const d = Math.hypot(dx, dy, dz), hd = Math.hypot(dx, dz) || 1;
      const s = clamp$9((d - TETHER_K * Lm) / (Lm - 0.5 - TETHER_K * Lm), 0, 1);
      this.tetherStrain = s;
      tAx = (dx / hd) * TETHER_A * s * s; tAz = (dz / hd) * TETHER_A * s * s;
      if (d > Lm - 0.5) tOut = 1;
      if (s > 0.6 && !this._hint.tether) { this._hint.tether = true; this.ev.push({ type: 'tether' }); }
      this._tdx = dx / hd; this._tdz = dz / hd;
    }
    if (env.pull) { tAx += env.pull.x; tAz += env.pull.z; }

    this._valve(dt, spPress, spRelease, W);
    this._W = W; this._dt = dt;

    const dbg = this.dbg;
    dbg.blocked = 0;
    if (this.mode === 'climb') this._climbStep(dt, fwdIn, env);
    else if (this.mode === 'ground') this._groundStep(dt, env, fwdIn, shift, auto, W, MH, tAx, tAz, tOut);
    else this._airStep(dt, env, fwdIn, W, tAx, tAz);

    const hr = Math.hypot(this.pos.x, this.pos.z), R = env.radius || 68;
    if (hr > R) { const s = R / hr; this.pos.x *= s; this.pos.z *= s; }
    const ceil = Number.isFinite(env.ceiling) ? env.ceiling : -1.4;
    if (this.pos.y > ceil) { this.pos.y = ceil; if (this.vel.y > 0) this.vel.y = 0; }
    this.vel.y = (this.pos.y - this._yPrev) / Math.max(dt, 1e-4);
    this._yPrev = this.pos.y;
    if (auto && auto.stop && this.auto === auto) {
      auto.st += dt;
      const hvA = Math.hypot(this.vel.x, this.vel.z), fe = Math.abs(wrap$1(auto.faceYaw - this.body.yaw));
      if ((this.grounded && hvA < 0.08 && fe < 10 * DEG$5 && env.planted !== false && auto.st > 0.15) || auto.st > 3) {
        const cb = auto.onArrive;
        this.auto = null;
        this._lastAuto = auto;
        if (cb) cb();
      }
    }

    this.landT += dt;
    if (this.grounded && this._landUsedT >= 0 && this.landT > 0.2) { this.valveUsed = this.valve > 0; this._landUsedT = -1; }
    const hv = Math.hypot(this.vel.x, this.vel.z);
    this.floatH = this.pos.y - ORIGIN - this.ground;
    if (this.mode === 'climb') this.pose = 'climb';
    else if (this.grounded) this.pose = hv > STATIC_V || this.drive > 0.05 ? 'walk' : 'stand';
    else this.pose = this.valve > 0 || this.lift > 60 ? 'sink' : this._bnd || this._push > 0 || (this._vy || 0) > 0.2 ? 'bound' : 'sink';
    const up = Math.max(0, Math.sin(this.slope));
    const eff = 0.2 + 0.5 * this.drive / A_WALK + 1.2 * up + 0.35 * this.tetherStrain + 0.3 * (this.mode === 'climb' || this._crouch >= 0 || (!this.grounded && this.vel.y > 0.2 && this.airT < 0.8) ? 1 : 0) + 0.2 * (shift && fwdIn > 0 ? 1 : 0) + 0.25 * this.blowup;
    this.effort = clamp$9(eff, 0, 1);
    this.thrust = this.effort;
    this.sprint = false;
    const b = this.body;
    b.yawRate += (b.yawV - b.yawRate) * (1 - Math.exp(-8 * dt));
    dbg.mode = this.mode;

    this.updateCamera(dt, env);
    return { speed: this.vel.length(), moving: fwdIn !== 0 || !!auto };
  }

  _valve(dt, spPress, spRelease, W) {
    const sp = this._sp, now = this.clock;
    if (spPress) sp.knocked = false;
    const holding = sp.down && !sp.knocked && now - sp.t0 >= VALVE_HOLD$1 && !(this.grounded && this._crouch >= 0);
    if (holding && sp.closeT < 0) { sp.closeT = now; this.valveUsed = true; this._landUsedT = -1; }
    let closed = holding;
    if (closed) {
      const ht = now - sp.closeT;
      this.blowup = smoothstep(BLOWUP_T$1, BLOWUP_T$1 + 0.5, ht);
      if (this.blowup > 0 && !this._hint.blow) { this._hint.blow = true; this.ev.push({ type: 'blowup' }); }
      if (ht >= BLOWUP_T$1 + 0.5) { sp.knocked = true; closed = false; this.ev.push({ type: 'knock' }); }
    } else this.blowup = Math.max(0, this.blowup - dt * 2);
    if (!closed && sp.closeT >= 0) {
      if (now - sp.closeT > DUMP_MIN) this.ev.push({ type: 'dump', n: 30 });
      sp.closeT = -1;
    }
    this.valve = closed ? 1 : 0;
    const tgt = closed && now - sp.closeT >= VALVE_LAG ? W + VALVE_UP : 0;
    this.lift += (tgt - this.lift) * (1 - Math.exp(-dt / VALVE_TAU));
    if (this.lift < 0.5) this.lift = 0;
  }

  _groundStep(dt, env, fwdIn, shift, auto, W, MH, tAx, tAz, tOut) {
    const b = this.body, v = this.vel, p = this.pos, dbg = this.dbg;
    const sp = this._sp;
    const doBound = !sp.used && this.clock - sp.t0 < BUF_T;
    let aimYaw = auto ? (auto.stop || auto.d < 0.3 ? auto.faceYaw : Math.atan2(-(auto.spot.x - p.x), -(auto.spot.z - p.z))) : this.yaw;
    if (!auto && this.stick && this.stick.on) aimYaw += this.stick.off;
    const sl = this._slide;
    sl.t += dt;
    if (sl.on) {
      if (this._aimShut(-Math.sin(aimYaw), -Math.cos(aimYaw))) sl.t = 0;
      if (fwdIn <= 0 || sl.t > SLIDE_HOLD) sl.on = false;
      else aimYaw = Math.atan2(-(-sl.nz * sl.sgn + 0.2 * sl.nx), -(sl.nx * sl.sgn + 0.2 * sl.nz));
    }
    let tgt = b.yaw, cap = 2.1 - 0.5 * Math.hypot(v.x, v.z), ff = 0;
    if (fwdIn !== 0) { tgt = aimYaw; this._standTurn = false; this._offT = 0; }
    else if (auto && auto.stop) { tgt = aimYaw; cap = 0.9; }
    else if (Math.abs(this.turnV) > 0.05) {
      tgt = aimYaw; cap = STAND_TURN; ff = clamp$9(this.turnV, -STAND_TURN, STAND_TURN); this._standTurn = true; this._offT = 0;
    } else {
      const off = Math.abs(wrap$1(aimYaw - b.yaw));
      if (off > 35 * DEG$5) this._offT += dt; else this._offT = 0;
      if (this._offT > 0.6) this._standTurn = true;
      if (this._standTurn && off < 10 * DEG$5) this._standTurn = false;
      if (this._standTurn) { tgt = aimYaw; cap = 0.9; }
    }
    const err = wrap$1(tgt - b.yaw);
    let yv = b.yawV + (25 * err - 10 * (b.yawV - ff)) * dt;
    if (Math.abs(yv) > Math.abs(b.yawV)) yv = b.yawV + clamp$9(yv - b.yawV, -BODY_ACC * dt, BODY_ACC * dt);
    b.yawV = clamp$9(yv, -cap, cap);
    b.yaw = wrap$1(b.yaw + b.yawV * dt);
    const hx = -Math.sin(b.yaw), hz = -Math.cos(b.yaw);
    const herr = fwdIn !== 0 ? wrap$1(aimYaw - b.yaw) : 0;
    const S0 = this._S(p.x, p.z), kind0 = this._sKind;
    this.onRock = kind0 === 1 || kind0 === 3;
    const Sf = Math.min(this._S(p.x + hx * 0.6, p.z + hz * 0.6), S0 + STEP_MAX), Sb = Math.min(this._S(p.x - hx * 0.6, p.z - hz * 0.6), S0 + STEP_MAX);
    const grad = clamp$9(this.onRock ? (Math.max(Sf, S0 - STEP_MAX) - S0) / 0.6 : (Sf - Sb) / 1.2, -1.2, 1.2);
    const th = Math.atan(grad);
    this.slope += (th - this.slope) * (1 - Math.exp(-dt * 6));
    dbg.S0 = S0;
    if (fwdIn > 0) this._driveT += dt; else this._driveT = 0;
    const r = smoothstep(0.15, 0.6, this.landT) * smoothstep(0, DRIVE_IN, this._driveT + (auto ? DRIVE_IN : 0));
    const gate = Math.abs(herr) < 60 * DEG$5 ? Math.cos(herr) : 0.35;
    const vf0 = v.x * hx + v.z * hz;
    if (Number.isFinite(env.stepPhase)) this._phase = env.stepPhase;
    else {
      const hvv = Math.hypot(v.x, v.z);
      this._phase = (this._phase + (hvv * dt) / (2 * clamp$9(0.3 + 0.62 * hvv, 0.3, 1.45))) % 1;
    }
    this.stepPhase = this._phase;
    const pulse = (0.8 + 0.4 * (bump(this._phase, 0.05) + bump(this._phase, 0.55))) / 0.872;
    const vDown = lerp$4(shift ? V_SHIFT : V_DOWN, 0.55, smoothstep(0.4, 1, -grad));
    const vUp = lerp$4(V_DOWN, 0.55, smoothstep(0.2, 0.55, grad));
    let aDrive = 0, vAuto = Infinity;
    if (fwdIn > 0) {
      let A = shift ? A_SHIFT : A_WALK;
      if (this.stick && this.stick.on) A *= this.stick.k;
      if (this.onRock) A *= 1.1;
      if (auto) {
        vAuto = AW_V * Math.sqrt(clamp$9((auto.d - 0.03) / AW_BRAKE, 0.02, 1));
        A = A_WALK * clamp$9((vAuto - vf0) / 0.08, 0, 1);
      }
      if (grad > 0.05) A += 0.6 * SLOPE_A * Math.sin(Math.atan(grad));
      if (grad > 1) A *= clamp$9(1 - (grad - 1) * 4, 0, 1);
      aDrive = Math.min(MU_A, A * r * gate * lerp$4(pulse, 1, smoothstep(0.2, 0.5, Math.abs(grad))));
      if (grad < -0.05) aDrive *= clamp$9((vDown + 0.1 - vf0) / 0.1, 0, 1);
      if (grad > 0.2) aDrive = Math.min(aDrive, Math.max(0, K_H * vUp * vUp + SLOPE_A * Math.sin(th) + 4 * (vUp - vf0)));
    } else if (fwdIn < 0) {
      if (-vf0 < V_BACK) aDrive = -0.5 * r;
    }
    const hvl = Math.hypot(v.x, v.z);
    let ux = hx, uz = hz;
    if (hvl > 0.15) { ux = v.x / hvl; uz = v.z / hvl; } else if (fwdIn < 0) { ux = -hx; uz = -hz; }
    let dEdge = 0, top = 0, rise = 0, wnx = -ux, wnz = -uz;
    if (fwdIn !== 0 || hvl > 0.15) {
      let prev = 0, prevD = 0, steep = 0;
      for (const d of SCAN) {
        const sd = this._S(p.x + ux * d, p.z + uz * d) - S0;
        steep = Math.max(steep, (sd - prev) / (d - prevD)); prev = sd; prevD = d;
        if (sd > rise) rise = sd;
        if (!dEdge && sd - STEP_LINE * d > STEP_EX) dEdge = d;
        if (dEdge && d <= dEdge + 0.61 && sd > top) top = sd;
      }
      if (steep < BANK_MAX) { dEdge = 0; top = 0; }
    }
    dbg.rise = rise; dbg.ex = top;
    let blocked = false;
    if (dEdge && top > STEP_MAX) {
      const ex = p.x + ux * (dEdge - 0.07), ez = p.z + uz * (dEdge - 0.07);
      const gx = this._S(ex + 0.12, ez) - this._S(ex - 0.12, ez), gz = this._S(ex, ez + 0.12) - this._S(ex, ez - 0.12), gl = Math.hypot(gx, gz);
      if (gl > 0.05) { wnx = -gx / gl; wnz = -gz / gl; }
      const square = Math.max(0, -(ux * wnx + uz * wnz)), near = dEdge * square <= CLAMBER_AT;
      const can = top <= CLAMBER_MAX && square > 0.5 && fwdIn > 0 && this.landT > 0.3;
      if (can && near && (this._startClimb(top, S0, -wnx, -wnz, dEdge * square, hvl * square) || this._startClimb(top, S0, ux, uz, dEdge, hvl))) return;
      if (!can || near) {
        blocked = true;
        if (fwdIn > 0) this._contact(wnx, wnz, ex, ez);
        if (top > CLAMBER_MAX && fwdIn > 0 && !this._hint.wall) { this._hint.wall = true; this.ev.push({ type: 'wall' }); }
      }
      dbg.blocked = top;
    }
    this.brink = false;
    if (fwdIn > 0) {
      const s1 = this._S(p.x + hx * 0.6, p.z + hz * 0.6), s2 = this._S(p.x + hx * 1.2, p.z + hz * 1.2);
      if (s1 < S0 - 0.8 && s2 < s1 - 0.15) {
        this.brink = true;
        if (!this._hint.brink) { this._hint.brink = true; this.ev.push({ type: 'brink' }); }
      }
    }
    const wx = 0.5 * this.drift.x, wz = 0.5 * this.drift.z;
    const rx = v.x - wx, rz = v.z - wz, rl = Math.hypot(rx, rz), kH = this._bnd ? K_HB : K_H;
    let ax = hx * aDrive - kH * rl * rx + tAx, az = hz * aDrive - kH * rl * rz + tAz;
    if (fwdIn !== 0 || hvl > STATIC_V) { const sa = -SLOPE_A * Math.sin(th); ax += hx * sa; az += hz * sa; }
    let brakeA = 0;
    if (fwdIn === 0) {
      if (hvl > 1e-4) {
        brakeA = Math.min(BRAKE * (0.35 + 0.65 * smoothstep(0, 0.3, hvl)) + SLOPE_A * Math.abs(Math.sin(th)), hvl / dt);
        ax -= (v.x / hvl) * brakeA; az -= (v.z / hvl) * brakeA;
      }
    } else if (auto && vf0 > vAuto + 0.03 && hvl > 1e-4) {
      brakeA = Math.min(BRAKE, (vf0 - vAuto) * 4);
      ax -= (v.x / hvl) * brakeA; az -= (v.z / hvl) * brakeA;
    } else if (fwdIn > 0 && grad < -0.4 && vf0 > vDown + 0.03 && hvl > 1e-4) {
      brakeA = Math.min(MU_A, (vf0 - vDown) * 8);
      ax -= (v.x / hvl) * brakeA; az -= (v.z / hvl) * brakeA;
    }
    const vl = -v.x * hz + v.z * hx;
    const latA = Math.min(LAT_GRIP, Math.abs(vl) / dt) * Math.sign(vl);
    ax -= -hz * latA; az -= hx * latA;
    v.x += ax * dt; v.z += az * dt;
    if (blocked || this.brink) {
      const bx = blocked ? -wnx : hx, bz = blocked ? -wnz : hz;
      const vn = v.x * bx + v.z * bz;
      if (vn > 0) {
        const room = blocked ? Math.max(0.04, dEdge * Math.max(0.3, ux * bx + uz * bz) - RING_R$1) : 0.3;
        const dec = Math.min(vn / dt, Math.max(1.2, (vn * vn) / (2 * room)));
        v.x -= bx * dec * dt; v.z -= bz * dec * dt;
      }
      if (blocked) aDrive = Math.min(aDrive, 0.2 * aDrive);
    }
    if (tOut && this._tdx !== undefined) {
      const vo = -(v.x * this._tdx + v.z * this._tdz);
      if (vo > 0) { v.x += this._tdx * vo; v.z += this._tdz * vo; }
    }
    const hv2 = Math.hypot(v.x, v.z);
    if (fwdIn === 0 && hv2 < STATIC_V && K_H * (wx * wx + wz * wz) < MU_A) { v.x = 0; v.z = 0; }
    this.drive = Math.max(0, aDrive);
    const wf = -(wx * hx + wz * hz);
    const Fd = fwdIn > 0 ? MH * (aDrive - 0.3 * brakeA) : fwdIn < 0 ? 0 : -0.3 * MH * (brakeA + K_H * rl * rl) * clamp$9(hvl / 0.08, 0, 1);
    const Ft = MH * (tAx * hx + tAz * hz);
    let leanT = 3 + Math.atan2(Fd + 323 * wf * Math.abs(wf) + Ft, W) / DEG$5;
    if (this.brink) leanT = -6;
    leanT = clamp$9(leanT, -10, 32);
    this.lean += (leanT - this.lean) * (1 - Math.exp(-dt / 0.25));
    this._px = p.x; this._pz = p.z;
    p.x += v.x * dt; p.z += v.z * dt;
    this._collide(env, true);
    const prog = Math.hypot(v.x, v.z);
    if (fwdIn > 0 && blocked && dbg.blocked <= BOUND_RISE && prog < 0.1) this._stuckT += dt; else this._stuckT = Math.max(0, this._stuckT - dt * 2);
    dbg.stuck = this._stuckT;
    if ((doBound || this._stuckT > 1.5) && this._crouch < 0) {
      this._crouch = 0;
      this._stuckT = 0;
    }
    if (doBound) sp.used = true;
    if (doBound && this._landB && this.landT < 0.15) this._bnd = true;
    if (this._crouch < 0) this._bnd = false;
    let bound = false;
    if (this._crouch >= 0) {
      this._crouch += dt;
      if (this._crouch >= CROUCH_T) bound = true;
    }
    this.intent = this._crouch >= 0 ? 'bound' : null;
    const S1 = this._S(p.x, p.z);
    let Sst = S1;
    if (fwdIn !== 0 || hvl > 0.1) {
      const Sa = this._S(p.x + ux * 0.2, p.z + uz * 0.2);
      if (Sa > Sst && Sa - S1 <= STEP_MAX) Sst = Sa;
    }
    this.ground = Sst;
    const sink = this._crouch >= 0 ? CROUCH_DY * smoothstep(0, 0.6 * CROUCH_T, this._crouch) : 0;
    if (!Number.isFinite(this._yT)) this._yT = p.y;
    this._yT += clamp$9(Sst + ORIGIN - sink - this._yT, -1.6 * dt, STEP_VU * dt);
    spr(p.y, this.yv, this._yT, this._landB ? lerp$4(6, 14, smoothstep(0.15, 0.5, this.landT)) : 14, dt);
    p.y = _s[0]; this.yv = _s[1];
    if (p.y - ORIGIN - Sst > DROP_MAX) { this._setGround(false, Sst); v.y = Math.min(0, this.yv); this.airT = 0; this._crouch = -1; this._bnd = false; this.intent = null; this.ev.push({ type: 'off' }); }
    if (bound && this.grounded) {
      this._crouch = -1;
      this.intent = null;
      let vt = fwdIn < 0 ? -0.6 : Math.min(BOUND_HMAX, Math.max(BOUND_FWD0, Math.max(0, v.x * hx + v.z * hz) + BOUND_FWD)), fu = 1, px = hx, pz = hz;
      if (fwdIn >= 0) { const pl = this._plan(hx, hz, vt); fu = pl.f; vt = pl.vh; px = pl.ux; pz = pl.uz; }
      const vf = v.x * px + v.z * pz, dv = vt - vf;
      this._bvy = BOUND_VY * fu;
      v.y = 0.35 * this._bvy;
      let qx = dv * px, qz = dv * pz;
      if (fwdIn > 0) { qx -= 0.85 * (v.x - px * vf); qz -= 0.85 * (v.z - pz * vf); }
      v.x += 0.35 * qx; v.z += 0.35 * qz;
      this._pdx = 0.65 * qx; this._pdz = 0.65 * qz;
      this._push = PUSH_T;
      this._bnd = true;
      this._sv = 0;
      this._sol0 = p.y - ORIGIN; this._dip0 = Math.max(0, S1 - this._sol0);
      this._setGround(false, S1);
      this.airT = 0;
      this.ev.push({ type: 'bound' });
      this._airY = p.y;
    }
    if (this.grounded && this.lift > W + 5 && this._crouch < 0) {
      this._setGround(false, S1);
      v.y = Math.max(0, this.yv);
      this.airT = 0;
    }
    if (!this.grounded) { this._vy = v.y; }
  }

  _airStep(dt, env, fwdIn, W, tAx, tAz) {
    const v = this.vel, p = this.pos, b = this.body;
    if (this._vy === undefined) this._vy = 0;
    this._px = p.x; this._pz = p.z;
    this.airT += dt;
    this.drive = 0;
    const n = Math.max(1, Math.ceil(dt * 120)), h = dt / n;
    -Math.sin(b.yaw); -Math.cos(b.yaw);
    const ax0 = -Math.sin(this.yaw), az0 = -Math.cos(this.yaw);
    if (this.lift > 60) this._bnd = false;
    const kHF = this._bnd ? lerp$4(K_HB, K_HF, clamp$9(this.lift / 60, 0, 1)) : K_HF;
    const want = Math.max(this._stepAim(), this._svMin || 0), sv0 = this._sv || 0, acc = (this._svMin ? 2.5 : 1) * STEP_ACC * dt;
    this._sv = sv0 + clamp$9(want - sv0, -acc, acc);
    this._svMin = 0;
    const fb = this._fb;
    if (fb.on) {
      const vn = v.x * fb.nx + v.z * fb.nz;
      if (vn < 0) { const dec = Math.min(-vn, ((vn * vn) / (2 * Math.max(fb.gap, 0.03))) * dt); v.x += fb.nx * dec; v.z += fb.nz * dec; }
    }
    for (let i = 0; i < n; i++) {
      let vy = this._vy;
      const sv = this._sv;
      const S = this._S(p.x, p.z), hgt = p.y - ORIGIN - S;
      let ay = (-W + this.lift) / M_V - K_V * Math.abs(vy) * vy;
      if (this._push > 1e-6) {
        const ph = Math.min(h, this._push);
        ay += ((0.65 * (this._bvy || BOUND_VY)) / PUSH_T + W / M_V) * (ph / h);
        v.x += this._pdx * (ph / PUSH_T); v.z += this._pdz * (ph / PUSH_T);
        this._push -= ph;
      }
      if (hgt > CEIL_H && this.lift > 1) ay -= clamp$9(this.lift / W, 0, 1) * (CEIL_K * (hgt - CEIL_H) + CEIL_D * Math.max(0, vy));
      vy += ay * h;
      if (this.lift > 1 && vy > RISE_MAX$1) vy = RISE_MAX$1;
      const wx = 0.6 * this.drift.x, wz = 0.6 * this.drift.z;
      const rx = v.x - wx, rz = v.z - wz, rl = Math.hypot(rx, rz);
      let ax = -kHF * rl * rx + tAx, az = -kHF * rl * rz + tAz;
      if (fwdIn > 0) { const a = this.lift > 60 ? 0.35 : 0.12; ax += ax0 * a; az += az0 * a; }
      v.x += ax * h; v.z += az * h;
      p.x += v.x * h; p.z += v.z * h; p.y += (vy + sv) * h;
      this._vy = vy;
      let S2 = this._S(p.x, p.z), onto = false;
      const k2 = this._sKind, sol = p.y - ORIGIN;
      if (S2 > Math.max(sol, S) + 0.1) {
        if (k2 === 1) { p.x -= v.x * h; p.z -= v.z * h; v.x *= 0.2; v.z *= 0.2; }
        else if (S2 - sol <= STEP_MAX) { if (vy + sv <= 0) onto = true; else this._svMin = Math.min(STEP_VMAX, (S2 - sol) / 0.12); }
        else { p.x -= v.x * h; p.z -= v.z * h; this._faceOut(p.x, p.z); }
        S2 = this._S(p.x, p.z);
      } else if (S2 - sol > this._knee(sol) && k2 !== 1 && vy + sv > 0) this._svMin = Math.max(this._svMin || 0, Math.min(STEP_VMAX, (S2 - sol - this._knee(sol)) / 0.1));
      if (onto || (p.y - ORIGIN <= S2 && vy + sv <= 0)) {
        this.ev.push({ type: 'land', v: -(vy + sv), float: this.valveUsed });
        this._push = 0; this._pdx = this._pdz = 0;
        this._setGround(true, S2);
        this.yv = vy + sv;
        this.landT = 0;
        if (!this._bnd) { v.x *= 0.55; v.z *= 0.55; }
        this._landB = this._bnd;
        this._bnd = this._bnd && !this._sp.used && this.clock - this._sp.t0 < BUF_T;
        this._landUsedT = 0;
        this._vy = 0;
        this._sv = 0; this._dip0 = 0;
        if (p.y - ORIGIN < S2 - (onto ? STEP_MAX : 0.05)) p.y = S2 + ORIGIN - (onto ? STEP_MAX : 0.05);
        break;
      }
    }
    const err = wrap$1(this.yaw - b.yaw);
    b.yawV += (9 * err - 6 * b.yawV) * dt;
    b.yawV = clamp$9(b.yawV, -0.6, 0.6);
    b.yaw = wrap$1(b.yaw + b.yawV * dt);
    this.lean += ((this.lift > 60 ? 0 : 3) - this.lean) * (1 - Math.exp(-dt / 0.4));
    this.slope += (0 - this.slope) * (1 - Math.exp(-dt * 3));
    if (this.grounded) { this.ground = this._S(p.x, p.z); }
    else this.ground = this._S(p.x, p.z);
    this._collide(env, this.grounded);
  }

  _startClimb(top, S0, ux, uz, dEdge, v0 = 0) {
    const C = this.climb, p = this.pos;
    let t2 = -1;
    for (let d = Math.max(0.1, dEdge - 0.1); d <= dEdge + 0.8; d += 0.1) t2 = Math.max(t2, this._S(p.x + ux * d, p.z + uz * d) - S0);
    if (t2 > CLAMBER_MAX + 0.1 || t2 < STEP_MAX - 0.1) return false;
    top = t2;
    C.on = true; C.t = 0; C.rise = top; C.T = CLIMB_T0 + CLIMB_T1 * top;
    C.v0 = clamp$9(v0, 0, 0.9);
    C.from.copy(p); C.top = S0 + top;
    C.dir.set(ux, 0, uz);
    C.edge.set(p.x + ux * Math.max(0.2, dEdge - 0.1), S0 + top, p.z + uz * Math.max(0.2, dEdge - 0.1));
    let d0 = -1, d1 = -1;
    for (let d = Math.max(0.2, dEdge - 0.1); d <= dEdge + 0.8; d += 0.05) {
      const on = this._S(p.x + ux * d, p.z + uz * d) >= S0 + top - 0.15;
      if (on && d0 < 0) d0 = d;
      if (on) d1 = d; else if (d0 >= 0) break;
    }
    if (d0 < 0) { C.on = false; return false; }
    C.reach = clamp$9(d1 - d0 < 0.3 ? 0.5 * (d0 + d1) : d0 + 0.15, 0.3, 0.9);
    C.a = clamp$9(dEdge - 0.3, 0, C.reach);
    C.hands = 0;
    this._crouch = -1; this._bnd = false; this.intent = null;
    this.mode = 'climb';
    this.grounded = false;
    this.vel.set(ux * C.v0, 0, uz * C.v0);
    this._clamberT = 0;
    this._slide.on = false;
    this.ev.push({ type: 'climb', rise: top });
    return true;
  }
  _climbStep(dt, fwdIn, env) {
    const C = this.climb, p = this.pos;
    C.t += dt;
    const u = C.t / C.T;
    if (fwdIn < 0 && u < 0.4) {
      C.on = false;
      this._setGround(true, this._S(p.x, p.z));
      this.yv = 0;
      this.landT = 1;
      return;
    }
    const s = Math.min(1, u / 0.45), m0 = Math.min((C.v0 || 0) * 0.45 * C.T, 3 * (C.a || 0));
    const k1 = smoothstep(0.45, 0.92, u), k2 = smoothstep(0.5, 1, u);
    const fwd = m0 * s * (1 - s) * (1 - s) + (C.a || 0) * s * s * (3 - 2 * s) + ((C.reach || 0.57) - (C.a || 0)) * k2;
    const x = C.from.x + C.dir.x * fwd, z = C.from.z + C.dir.z * fwd;
    const y = lerp$4(C.from.y, Math.max(C.top, this._S(x, z)) + ORIGIN, k1);
    const px0 = p.x, pz0 = p.z;
    p.set(x, Math.max(y, Math.min(this._S(x, z) + ORIGIN - 0.05, p.y + 2 * dt)), z);
    this.vel.x = (p.x - px0) / Math.max(dt, 1e-4);
    this.vel.z = (p.z - pz0) / Math.max(dt, 1e-4);
    C.hands = smoothstep(0, 0.2 / C.T, u) * (1 - smoothstep(0.75, 1, u));
    const b = this.body, e = wrap$1(Math.atan2(-C.dir.x, -C.dir.z) - b.yaw);
    b.yawV = 5 * e;
    b.yaw = wrap$1(b.yaw + e * (1 - Math.exp(-dt * 5)));
    this.drive = 0;
    this.lean += (12 - this.lean) * (1 - Math.exp(-dt / 0.3));
    this.ground = this._S(x, z);
    if (u >= 1) {
      C.on = false;
      this._setGround(true, this._S(p.x, p.z));
      this.yv = 0;
      this.landT = 1;
      this.vel.set(0, 0, 0);
    }
  }

  _collide(env, grounded) {
    const p = this.pos, v = this.vel, N = this._near, rockIn = this._rockIn(p.x, p.z);
    let sumAbs = 0, sx = 0, sz = 0, bigX = 0, bigZ = 0, big = 0;
    const pl = !grounded && this._push > 0 ? this._push / PUSH_T : 0, wx = v.x + (this._pdx || 0) * pl, wz = v.z + (this._pdz || 0) * pl;
    for (let it = 0; it < 3; it++) {
      let any = false;
      const y0 = p.y + SEG_LO, y1 = p.y + SEG_HI, soles = p.y - ORIGIN, crown = p.y + CROWN;
      for (const o of N.S) {
        if (grounded && rockIn && (o.rock || o.bould)) continue;
        const dx = p.x - o.x, dz = p.z - o.z, R = o.r + BODY_R;
        const dh2 = dx * dx + dz * dz;
        if (dh2 >= R * R) continue;
        const ys = clamp$9(o.y, y0, y1), dy = ys - o.y;
        if (dh2 + dy * dy >= R * R) continue;
        const dh = Math.sqrt(dh2) || 1e-4;
        const dn = Math.max(0, dh - BODY_R), half = Math.sqrt(Math.max(0, o.r * o.r - dn * dn));
        if (grounded) {
          if (o.y + half <= soles + 0.35) continue;
          if (o.y - half >= crown) continue;
          const req = Math.sqrt(Math.max(0, R * R - dy * dy));
          if (dh >= req) continue;
          const push = req - dh, nx = dx / dh, nz = dz / dh;
          p.x += nx * push; p.z += nz * push;
          sumAbs += push; sx += nx * push; sz += nz * push;
          if (push > big) { big = push; bigX = nx; bigZ = nz; }
          const vn = v.x * nx + v.z * nz;
          if (vn < 0) { v.x -= nx * vn; v.z -= nz * vn; }
          any = true;
        } else {
          if (rockIn && (o.rock || o.bould)) {
            const e0 = Math.min(dh, 0.5 * o.r) / dh, e1 = Math.min(dh, 0.9 * o.r) / dh;
            if (Math.max(this._S(o.x + dx * e0, o.z + dz * e0), this._S(o.x + dx * e1, o.z + dz * e1)) <= soles + 0.1) continue;
          }
          const vc = -(wx * dx + wz * dz) / dh, tp = o.y + o.r + 0.02;
          if (vc > 0.2 && this._arcAt(Math.max(0, dh - o.r - 0.1), vc) >= tp && this._arcAt(dh + o.r + 0.1, vc) >= tp) continue;
          if (o.rest && o.y + half <= Math.max(soles, vc > 0.1 ? this._arcAt(dn, vc) : soles) + 0.35) continue;
          let ddy = dy;
          if (o.rest && ddy < 0) ddy = 0;
          if (o.rest && ddy > 0) {
            if (o.capOK && dh < 0.9 * o.r) continue;
            const req = Math.sqrt(Math.max(0, R * R - ddy * ddy));
            if (dh >= req) continue;
            const push = Math.min(req - dh, 0.04), nx = dx / dh, nz = dz / dh;
            p.x += nx * push; p.z += nz * push;
            const vn = v.x * nx + v.z * nz;
            if (vn < 0) { v.x -= nx * vn; v.z -= nz * vn; this._rub(nx, nz, -vn); }
            any = true;
            continue;
          }
          const d = Math.hypot(dx, ddy, dz);
          if (d >= R || d < 1e-4) continue;
          const push = (R - d) / d;
          p.x += dx * push; p.y += ddy * push; p.z += dz * push;
          const vn = (v.x * dx + this._vy * ddy + v.z * dz) / d;
          if (vn < 0) { v.x -= (vn * dx) / d; this._vy -= (vn * ddy) / d; v.z -= (vn * dz) / d; }
          any = true;
        }
      }
      for (const o of N.C) {
        const rr = o.r + BODY_R, M = grounded ? 0 : BAND;
        if (p.x < o.x0 - BODY_R - M || p.x > o.x1 + BODY_R + M || p.z < o.z0 - BODY_R - M || p.z > o.z1 + BODY_R + M) continue;
        const d2 = segSeg(p.x, y0, y1, p.z, o.ax, o.ay, o.az, o.bx, o.by, o.bz, _ss);
        if (d2 >= (rr + M) * (rr + M)) continue;
        const nx0 = _ss.cx - _ss.qx, ny0 = _ss.cy - _ss.qy, nz0 = _ss.cz - _ss.qz;
        const top = _ss.qy + o.r;
        if (o.jar && this.auto) continue;
        if (!grounded && _ss.qy - o.r < soles + 0.5) {
          const hl = Math.hypot(nx0, nz0);
          if (hl < 1e-4) continue;
          const nx = nx0 / hl, nz = nz0 / hl, sup = o.walk || o.jtop;
          if (it === 0) {
            const vc = -(wx * nx + wz * nz), dn = Math.max(0, hl - 0.6 * o.r - 0.1);
            const yA = vc > 0.1 ? this._arcAt(dn, vc) : soles;
            const clear = top <= soles + 0.02 || (vc > 0.1 && yA >= top + 0.02 && (sup || this._arcAt(hl + o.r + 0.1, vc) >= top + 0.02));
            o.dk = clear || (sup && top - yA <= STEP_MAX) ? 0 : 1;
          }
          if (!o.dk) continue;
          const req = rr * rr > ny0 * ny0 ? Math.sqrt(rr * rr - ny0 * ny0) : 0;
          if (hl >= req) { if (it === 0) this._brakeAt(o, hl - req, nx, nz, req); continue; }
          const push = Math.min(req - hl, 0.04);
          p.x += nx * push; p.z += nz * push;
          const vn = v.x * nx + v.z * nz;
          if (vn < 0 && it === 0) { const dvn = Math.min(-vn, CONTACT_DV); v.x += nx * dvn; v.z += nz * dvn; this._rub(nx, nz, dvn); }
          any = true;
          continue;
        }
        if (d2 >= rr * rr) continue;
        if (o.jar) {
          if (top <= soles + (o.jtop ? STEP_MAX : 0.02) || _ss.qy - o.r >= crown) continue;
          let hl = Math.hypot(nx0, nz0), nx = nx0, nz = nz0;
          if (hl < 1e-4) { nx = -Math.sin(this.body.yaw); nz = -Math.cos(this.body.yaw); hl = 1; } else { nx /= hl; nz /= hl; }
          const req = Math.sqrt(Math.max(0, rr * rr - ny0 * ny0)), hd = Math.hypot(nx0, nz0);
          if (hd >= req) continue;
          const push = req - hd;
          p.x += nx * push; p.z += nz * push;
          sumAbs += push; sx += nx * push; sz += nz * push;
          if (push > big) { big = push; bigX = nx; bigZ = nz; }
          const vn = v.x * nx + v.z * nz;
          if (vn < 0) { v.x -= nx * vn; v.z -= nz * vn; }
          any = true;
          continue;
        }
        if (grounded) {
          if (_ss.qy + o.r <= soles + (o.walk ? STEP_MAX : 0.35)) continue;
          if (_ss.qy - o.r >= crown) continue;
          const hl = Math.hypot(nx0, nz0);
          if (hl < 1e-4) continue;
          const req = Math.sqrt(Math.max(0, rr * rr - ny0 * ny0));
          if (hl >= req) continue;
          const push = req - hl, nx = nx0 / hl, nz = nz0 / hl;
          p.x += nx * push; p.z += nz * push;
          sumAbs += push; sx += nx * push; sz += nz * push;
          if (push > big) { big = push; bigX = nx; bigZ = nz; }
          const vn = v.x * nx + v.z * nz;
          if (vn < 0) { v.x -= nx * vn; v.z -= nz * vn; }
          any = true;
        } else {
          const d = Math.sqrt(d2);
          if (d < 1e-4) continue;
          const push = (rr - d) / d;
          p.x += nx0 * push; p.y += ny0 * push; p.z += nz0 * push;
          const vn = (v.x * nx0 + this._vy * ny0 + v.z * nz0) / d;
          if (vn < 0) { v.x -= (vn * nx0) / d; this._vy -= (vn * ny0) / d; v.z -= (vn * nz0) / d; }
          any = true;
        }
      }
      if (!any) break;
    }
    if (grounded && rockIn) {
      const lim = this.ground + STEP_MAX + 0.05;
      if (this._S(p.x, p.z) > lim) { p.x = this._px; p.z = this._pz; }
      let rx = 0, rz = 0, deep = 0;
      for (let k = 0; k < 16; k += 2) {
        const cx = RING[k], cz = RING[k + 1];
        if (this._S(p.x + cx * RING_R$1, p.z + cz * RING_R$1) <= lim) continue;
        let lo = 0, hi = RING_R$1;
        for (let j = 0; j < 4; j++) { const m = 0.5 * (lo + hi); if (this._S(p.x + cx * m, p.z + cz * m) > lim) hi = m; else lo = m; }
        rx -= cx * (RING_R$1 - lo); rz -= cz * (RING_R$1 - lo);
        deep = Math.max(deep, RING_R$1 - lo);
      }
      const rl = Math.hypot(rx, rz);
      if (rl > 1e-5) {
        const nx = rx / rl, nz = rz / rl;
        p.x += nx * deep; p.z += nz * deep;
        sx += nx * deep; sz += nz * deep; sumAbs += deep;
        if (deep > big) { big = deep; bigX = nx; bigZ = nz; }
        const vn = v.x * nx + v.z * nz;
        if (vn < 0) { v.x -= nx * vn; v.z -= nz * vn; }
      }
    }
    if (grounded && sumAbs > 0.01 && Math.hypot(sx, sz) < 0.3 * sumAbs) this._pushT++; else this._pushT = 0;
    if (this._pushT >= 2) {
      const hx = -Math.sin(this.body.yaw), hz = -Math.cos(this.body.yaw);
      let tx = -bigZ, tz = bigX;
      if (tx * hx + tz * hz < 0) { tx = -tx; tz = -tz; }
      p.x += tx * 0.02; p.z += tz * 0.02;
    }
    this._blk.set(sx, 0, sz);
    const bl = Math.hypot(sx, sz);
    if (grounded && bl > 0.004 && (-Math.sin(this.body.yaw) * sx - Math.cos(this.body.yaw) * sz) / bl < -0.3) this._contact(sx / bl, sz / bl);
  }

  _plan(hx, hz, vh0) {
    const out = this._pl || (this._pl = { f: 1, vh: vh0, ux: hx, uz: hz }), alt = this._pl2 || (this._pl2 = { f: 1, vh: vh0, ux: hx, uz: hz });
    let best = this._planAlong(hx, hz, vh0, out);
    if (best < 0.8) return out;
    const ax = -Math.sin(this.yaw), az = -Math.cos(this.yaw), side = ax * -hz + az * hx >= 0 ? 1 : -1;
    for (let k = 0; k < 2 * PLAN_SIDE.length; k++) {
      const a = PLAN_SIDE[k >> 1] * (k % 2 ? -side : side), c = Math.cos(a), sn = Math.sin(a);
      const cost = this._planAlong(hx * c - hz * sn, hx * sn + hz * c, vh0, alt, Math.abs(sn), hx, hz) + 1.5 * Math.abs(a);
      if (cost < best) { best = cost; out.f = alt.f; out.vh = alt.vh; out.ux = alt.ux; out.uz = alt.uz; }
    }
    if (best === Infinity) { out.f = 1; out.vh = vh0; out.ux = hx; out.uz = hz; }
    return out;
  }
  _planAlong(ux, uz, vh0, out, lat = 0, hx = 0, hz = 0) {
    const vf = this.vel.x * ux + this.vel.z * uz;
    out.f = 1; out.vh = vh0; out.ux = ux; out.uz = uz;
    if (vh0 <= 0 || (!this._profile(ux, uz) && !lat)) return 0;
    let best = Infinity;
    for (let k = 0; k < PLAN_VH.length; k++) {
      const vh = k < 4 ? PLAN_VH[k] * vh0 : PLAN_VH[k];
      if (k >= 4 && (lat || vh > 0.5 * vh0)) continue;
      const fmax = k === 0 ? PLAN_OVER : PLAN_HOP;
      for (let f = 1; f <= fmax + 1e-6; f += 0.05) {
        let r = this._fly(f, vh, vf);
        if (r < 0) continue;
        if (lat) r += lat * this._flyD + (this._wayOn(ux, uz, this._flyD, hx, hz) ? 0 : 3);
        const cost = 1.2 * (f * f - 1) + 2 * (1 - vh / vh0) + r;
        if (cost < best) { best = cost; out.f = f; out.vh = vh; }
        if (cost === 0) return 0;
        if (r - lat * this._flyD < 0.05) break;
      }
    }
    if (best === Infinity) { out.f = 1; out.vh = vh0; }
    return best;
  }
  _wayOn(ux, uz, d, hx, hz) {
    const p = this.pos, x0 = p.x + ux * d, z0 = p.z + uz * d, S0 = this._S(x0, z0), C = this._near.C;
    for (let s = 0; s <= 1.5; s += 0.1) {
      const x = x0 + hx * s, z = z0 + hz * s;
      for (let j = 0; j < C.length; j++) {
        const c = C[j];
        if (c.walk || c.jtop || (c.thin && c.r < 0.07)) continue;
        if (x < c.x0 - 0.35 || x > c.x1 + 0.35 || z < c.z0 - 0.35 || z > c.z1 + 0.35 || Math.max(c.ay, c.by) + c.r < S0 + STEP_MAX || Math.min(c.ay, c.by) - c.r > S0 + 2) continue;
        const t = c.l2xz > 1e-6 ? clamp$9(((x - c.ax) * c.abx + (z - c.az) * c.abz) / c.l2xz, 0, 1) : 0;
        const qx = c.ax + c.abx * t - x, qz = c.az + c.abz * t - z, R = c.r + BODY_R + 0.05;
        if (qx * qx + qz * qz < R * R) return false;
      }
    }
    return true;
  }
  _profile(ux, uz) {
    const pf = this._pf || (this._pf = { S: new Float32Array(PF_N), Q: new Float32Array(PF_N), K: new Uint8Array(PF_N) });
    const p = this.pos, S0 = this._S(p.x, p.z), C = this._near.C;
    const dc = (x, z, c) => { const h = c.l2xz > 1e-6 ? clamp$9(((x - c.ax) * c.abx + (z - c.az) * c.abz) / c.l2xz, 0, 1) : 0; return Math.hypot(c.ax + c.abx * h - x, c.az + c.abz * h - z); };
    let any = false;
    for (let i = 0; i < PF_N; i++) {
      const d = i * PF_D, x = p.x + ux * d, z = p.z + uz * d, s = this._S(x, z);
      pf.S[i] = s; pf.K[i] = this._sKind === 1 ? 1 : 0;
      let q = -1e9;
      for (let j = 0; j < C.length; j++) {
        const c = C[j];
        if (c.walk || c.jtop || (c.thin && c.r < 0.07)) continue;
        if (x < c.x0 - 0.35 || x > c.x1 + 0.35 || z < c.z0 - 0.35 || z > c.z1 + 0.35 || Math.min(c.ay, c.by) - c.r > S0 + 2) continue;
        const R = c.r + BODY_R + 0.05, e = dc(x, z, c);
        if (e < R && (e < c.r + BODY_R - 0.02 || e < dc(p.x, p.z, c) - 0.01)) q = Math.max(q, Math.max(c.ay, c.by) + c.r);
      }
      for (let j = 0; j < this._near.S.length; j++) {
        const o = this._near.S[j];
        if (o.rock || o.bould) continue;
        const R = o.r + BODY_R + 0.05, e = Math.hypot(x - o.x, z - o.z);
        if (e < R && (e < o.r + BODY_R - 0.02 || e < Math.hypot(p.x - o.x, p.z - o.z) - 0.01)) q = Math.max(q, o.y + o.r - (o.rest ? 0.35 : 0));
      }
      pf.Q[i] = q;
      if (s > S0 + 0.08 || q > -1e8) any = true;
    }
    return any;
  }
  _fly(f, vh, vf) {
    const pf = this._pf, W = (this._W || W0) / M_V, g = W - this.lift / M_V, V = f * BOUND_VY, h = 1 / 120, dv = vh - vf;
    const LB = Math.round(STEP_LB / PF_D), g0 = this.ground;
    let y = this.pos.y - ORIGIN, vy = 0.35 * V, u = vf + 0.35 * dv, d = 0, push = PUSH_T;
    for (let k = 0; k < 300; k++) {
      let ay = -g - K_V * Math.abs(vy) * vy;
      if (push > 1e-6) { const ph = Math.min(h, push); ay += ((0.65 * V) / PUSH_T + W) * (ph / h); u += 0.65 * dv * (ph / PUSH_T); push -= ph; }
      vy += ay * h; u -= K_HB * u * Math.abs(u) * h; y += vy * h; d += u * h;
      const i = Math.round(d / PF_D);
      this._flyD = d;
      if (i < 0 || i + LB + 1 >= PF_N) return 0;
      const S = pf.S[i], L = Math.max(pf.S[i + LB], pf.S[i + LB + 1]), rk = pf.K[i + LB] || pf.K[i + LB + 1];
      if (pf.Q[i] > y + 0.02) return -1;
      if (vy <= 0 && y <= Math.max(S, L)) {
        const st = L - y;
        if (st > (rk ? 0.1 : LAND_STEP)) return -1;
        const top = Math.max(S, L);
        let c = 5 * Math.max(0, st - 0.03);
        for (let j = i; j < Math.min(PF_N, i + 16); j++) {
          if (pf.Q[j] > top + STEP_MAX) { c += 2; break; }
          if (pf.S[j] > top + STEP_MAX) { c += 0.4; break; }
          if (j < i + 10 && pf.S[j] > top + KNEE) { c += 1; break; }
        }
        return c;
      }
      if (L > Math.max(y, S, vy > 0 && k < 30 ? g0 : -1e9) + (rk ? 0.1 : PLAN_TOL) && L > S + 0.04) return -1;
    }
    return 0;
  }
  _knee(y) { return KNEE + Math.max(0, (this._dip0 || 0) - Math.max(0, y - (this._sol0 || 0))); }
  _arcAt(d, vc) {
    const t = d / Math.max(0.05, vc), g = ((this._W || W0) - this.lift) / M_V;
    const vy = this._vy + (this._push > 0 ? (0.65 * (this._bvy || BOUND_VY) * this._push) / PUSH_T : 0);
    return this.pos.y - ORIGIN + vy * t - 0.5 * g * t * t;
  }
  _stepAim() {
    const fb = this._fb || (this._fb = { on: false, gap: 0, nx: 0, nz: 0 });
    fb.on = false;
    const v = this.vel, p = this.pos;
    if (this.lift > 60) return 0;
    const pl = this._push > 0 ? this._push / PUSH_T : 0, wx = v.x + (this._pdx || 0) * pl, wz = v.z + (this._pdz || 0) * pl, vh = Math.hypot(wx, wz);
    if (vh < 0.15) return 0;
    const ux = wx / vh, uz = wz / vh, D = Math.min(1.6, vh * STEP_LOOK), g = ((this._W || W0) - this.lift) / M_V;
    const vy0 = this._vy + (this._push > 0 ? (0.65 * (this._bvy || BOUND_VY) * this._push) / PUSH_T : 0);
    let want = 0;
    for (let d = 0.05; d <= D + 1e-6; d += 0.05) {
      const y = this._arcAt(d, vh), Sa = this._S(p.x + ux * d, p.z + uz * d);
      if (y <= Sa && vy0 - (g * d) / vh <= 0) break;
      const lx = p.x + ux * (d + STEP_LB), lz = p.z + uz * (d + STEP_LB), L = this._S(lx, lz), rk = this._sKind === 1;
      const kn = this._knee(y), def = L + 0.03 - Math.max(y, Math.min(Sa, L) - kn);
      if (def <= 0 || (L < Sa + 0.04 && y >= Sa - kn)) continue;
      if (def > (rk ? 0.13 : STEP_MAX + 0.03)) {
        const gx = this._S(lx + 0.15, lz) - this._S(lx - 0.15, lz), gz = this._S(lx, lz + 0.15) - this._S(lx, lz - 0.15), gl = Math.hypot(gx, gz);
        fb.on = true; fb.gap = d;
        if (gl > 1e-4) { fb.nx = -gx / gl; fb.nz = -gz / gl; } else { fb.nx = -ux; fb.nz = -uz; }
        break;
      }
      want = Math.max(want, Math.min(STEP_VMAX, def / Math.max(0.04, d / vh - 0.05)));
    }
    return want;
  }
  _brakeAt(o, gap, nx, nz, req) {
    const v = this.vel, vn = v.x * nx + v.z * nz;
    if (vn >= -0.05 || gap > BAND) return;
    const p = this.pos, hv = Math.hypot(v.x, v.z), ux = v.x / hv, uz = v.z / hv;
    let hit = false;
    for (let s = 0; s <= gap + 0.3 && !hit; s += 0.05) {
      const x = p.x + ux * s, z = p.z + uz * s;
      const t = o.l2xz > 1e-6 ? clamp$9(((x - o.ax) * o.abx + (z - o.az) * o.abz) / o.l2xz, 0, 1) : 0;
      const qx = o.ax + o.abx * t - x, qz = o.az + o.abz * t - z;
      if (qx * qx + qz * qz < req * req) hit = true;
    }
    if (!hit) return;
    const dt = this._dt || 1 / 60, tx = -nz, tz = nx, vt = v.x * tx + v.z * tz;
    if (Math.abs(vt) > 0.2 * hv) {
      const a = Math.atan2(v.z, v.x), sg = vt > 0 ? 1 : -1, na = a + clamp$9(wrap$1(Math.atan2(tz * sg, tx * sg) - a), -VEER_RATE * dt, VEER_RATE * dt);
      v.x = hv * Math.cos(na); v.z = hv * Math.sin(na);
    }
    const vn2 = v.x * nx + v.z * nz;
    if (vn2 < 0) { const dec = Math.min(-vn2, ((vn2 * vn2) / (2 * Math.max(gap, 0.03))) * dt); v.x += nx * dec; v.z += nz * dec; }
  }
  _rub(nx, nz, dvn) {
    const v = this.vel, tx = -nz, tz = nx, vt = v.x * tx + v.z * tz, loss = Math.min(Math.abs(vt), MU_C * dvn) * Math.sign(vt);
    v.x -= tx * loss; v.z -= tz * loss;
  }
  _faceOut(x, z) {
    const gx = this._S(x + 0.15, z) - this._S(x - 0.15, z), gz = this._S(x, z + 0.15) - this._S(x, z - 0.15), gl = Math.hypot(gx, gz);
    const v = this.vel;
    if (gl < 1e-4) { v.x *= 0.5; v.z *= 0.5; return; }
    const nx = -gx / gl, nz = -gz / gl, vn = v.x * nx + v.z * nz;
    if (vn < 0) { v.x -= nx * vn; v.z -= nz * vn; this._rub(nx, nz, -vn); }
  }

  _contact(nx, nz, ex = NaN, ez = NaN) {
    const sl = this._slide;
    if (!sl.on && sl.t > 1.5) {
      const tx = -nz, tz = nx;
      let s = -(tx * Math.sin(this.yaw) + tz * Math.cos(this.yaw));
      if (Math.abs(s) < 0.2 && Number.isFinite(ex)) {
        const a = this._S(ex + tx * 0.9, ez + tz * 0.9), b = this._S(ex - tx * 0.9, ez - tz * 0.9);
        if (Math.abs(a - b) > 0.1) s = b - a;
      }
      if (Math.abs(s) < 1e-3) s = -(tx * Math.sin(this.body.yaw) + tz * Math.cos(this.body.yaw));
      sl.sgn = s >= 0 ? 1 : -1;
    }
    sl.on = true; sl.t = 0; sl.nx = nx; sl.nz = nz;
  }
  _aimShut(ax, az) {
    const p = this.pos, rockIn = this._rockIn(p.x, p.z), lim = this.ground + STEP_MAX + 0.05, y = p.y - ORIGIN + 0.6;
    for (const d of [0.4, 0.8, 1.2]) {
      const x = p.x + ax * d, z = p.z + az * d;
      if (rockIn && this._S(x, z) > lim) return true;
      for (const o of this._near.S) {
        if (rockIn && (o.rock || o.bould)) continue;
        const dx = x - o.x, dy = y - o.y, dz = z - o.z, R = o.r + 0.2;
        if (dx * dx + dy * dy + dz * dz < R * R) return true;
      }
      for (const c of this._near.C) {
        if (x < c.x0 - 0.2 || x > c.x1 + 0.2 || z < c.z0 - 0.2 || z > c.z1 + 0.2) continue;
        const apx = x - c.ax, apy = y - c.ay, apz = z - c.az;
        const h = clamp$9((apx * c.abx + apy * c.aby + apz * c.abz) / c.l2, 0, 1);
        if ((c.walk || c.jtop) && c.ay + c.aby * h + c.r <= this.ground + STEP_MAX) continue;
        const qx = apx - c.abx * h, qy = apy - c.aby * h, qz = apz - c.abz * h, R = c.r + 0.2;
        if (qx * qx + qy * qy + qz * qz < R * R) return true;
      }
    }
    return false;
  }
  _rockIn(x, z) { return !!(this._grid && this._grid.rock) && Math.hypot(x - LAYOUT.wreck.x, z - LAYOUT.wreck.z) < 40; }

  _prep(env) {
    if (!env) return;
    this._env = env;
    if (env.floor) this._floorFn = env.floor;
    if (env.obstacles && (this._hObs !== env.obstacles || this._hCap !== (env.capsules || null))) this._buildHash(env.obstacles, env.capsules || null);
    if (env.ground && env.ground !== this._ground) { this._ground = env.ground; this._grid = null; this._tiles.fill(null); }
    if (!this._grid && this._hash) this._buildGrid();
  }
  _fl(x, z) { return (this._floorFn || floorHeight)(x, z); }

  _buildHash(obstacles, capsules) {
    this._hObs = obstacles; this._hCap = capsules;
    const H = (this._hash = new Hash(2));
    const TH = (this._thash = new Hash(1));
    const fl = (x, z) => this._fl(x, z);
    for (const o of obstacles) {
      const f = fl(o.x, o.z);
      const rest = o.y - o.r < f + 0.3;
      const capTop = o.y + 0.9 * o.r - 0.08;
      const rec = { cap: false, o, x: o.x, y: o.y, z: o.z, r: o.r, rest, capOK: rest && capTop - f <= 1.4 && !o.wall, rock: !!o.rock, st: 0 };
      H.add(rec, o.x - o.r, o.x + o.r, o.z - o.r, o.z + o.r);
    }
    if (capsules) {
      for (const c of capsules) {
        const abx = c.bx - c.ax, aby = c.by - c.ay, abz = c.bz - c.az, len = Math.hypot(abx, aby, abz) || 1e-6;
        const l2xz = abx * abx + abz * abz;
        const rec = {
          cap: true, o: c, ax: c.ax, ay: c.ay, az: c.az, bx: c.bx, by: c.by, bz: c.bz, r: c.r, abx, aby, abz, l2: abx * abx + aby * aby + abz * abz, l2xz,
          thin: c.r < THIN, walk: !c.jar && Math.abs(aby / len) < 0.57 && c.r >= 0.1 && l2xz > 1e-6, jar: !!c.jar, st: 0,
          jtop: !!c.jar && Math.abs(aby / len) < 0.57 && l2xz > 1e-6,
          x0: Math.min(c.ax, c.bx) - c.r, x1: Math.max(c.ax, c.bx) + c.r, z0: Math.min(c.az, c.bz) - c.r, z1: Math.max(c.az, c.bz) + c.r,
        };
        H.add(rec, rec.x0, rec.x1, rec.z0, rec.z1);
        if (rec.walk || rec.jtop) TH.add(rec, rec.x0, rec.x1, rec.z0, rec.z1);
      }
    }
    const BO = (HARD && HARD.boulders) || [];
    for (let i = 0; i < BO.length; i++) {
      const b = BO[i], f = fl(b.x, b.z), top = Number.isFinite(b.top) ? b.top : b.y + 0.86 * b.sy;
      if (top - f < 0.06) continue;
      const R = 0.92 * b.s;
      const rec = { cap: false, o: b, x: b.x, y: top - R, z: b.z, r: R, rest: true, capOK: false, bould: true, bi: i, f, a: top - f, c: 0.15 * b.s, st: 0 };
      H.add(rec, b.x - R, b.x + R, b.z - R, b.z + R);
    }
    this._near.x = 1e9;
    this._grid = null;
    this._tiles.fill(null);
  }
  setWall(o, on = true) {
    const H = this._hash;
    if (!H) return;
    const f = H.inv;
    for (let i = Math.floor((o.x - o.r) * f); i <= Math.floor((o.x + o.r) * f); i++) {
      for (let j = Math.floor((o.z - o.r) * f); j <= Math.floor((o.z + o.r) * f); j++) {
        const l = H.map.get(H.key(i, j));
        if (l) for (let k = l.length - 1; k >= 0; k--) if (l[k].o === o) l.splice(k, 1);
      }
    }
    if (on) H.add({ cap: false, o, x: o.x, y: o.y, z: o.z, r: o.r, rest: true, capOK: false, rock: false, st: 0 }, o.x - o.r, o.x + o.r, o.z - o.r, o.z + o.r);
    this._near.x = 1e9;
  }

  _refreshNear() {
    const N = this._near, p = this.pos;
    if (!this._hash) { N.S.length = 0; N.C.length = 0; return; }
    if (Math.hypot(p.x - N.x, p.z - N.z) < 1) return;
    N.x = p.x; N.z = p.z;
    this._hash.query(p.x - NEAR_R, p.x + NEAR_R, p.z - NEAR_R, p.z + NEAR_R, N.S, N.C);
  }
  _cand(x, y, z, rad) {
    const N = this._near;
    if (Math.hypot(x - N.x, z - N.z) + rad < NEAR_R - 1.2) return N;
    if (!this._hash) { this._tmpS.length = 0; this._tmpC.length = 0; return { S: this._tmpS, C: this._tmpC }; }
    this._hash.query(x - rad, x + rad, z - rad, z + rad, this._tmpS, this._tmpC);
    return { S: this._tmpS, C: this._tmpC };
  }

  _buildGrid() {
    const t0 = performance.now();
    const tops = (HARD && HARD.tops) || [], bts = (HARD && HARD.boulderTops) || [];
    let x0 = LAYOUT.wreck.x - 42, x1 = LAYOUT.wreck.x + 42, z0 = LAYOUT.wreck.z - 42, z1 = LAYOUT.wreck.z + 42;
    x0 = Math.floor(x0 * 4) / 4; z0 = Math.floor(z0 * 4) / 4;
    const nx = Math.ceil((x1 - x0) * 4) + 1, nz = Math.ceil((z1 - z0) * 4) + 1;
    const h = new Float32Array(nx * nz).fill(-1e9), kd = new Uint8Array(nx * nz);
    const G = (this._grid = { x0, z0, nx, nz, h, k: kd, ms: 0 });
    const put = (i, j, y, kind) => {
      if (i < 0 || j < 0 || i >= nx || j >= nz) return;
      const o = i * nz + j;
      if (y > h[o]) { h[o] = y; kd[o] = kind; }
    };
    const tri = (ax, ay, az, bx, by, bz, cx, cy, cz, kind) => {
      const den = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
      if (Math.abs(den) < 1e-10) return;
      const i0 = Math.max(0, Math.ceil((Math.min(ax, bx, cx) - x0) * 4)), i1 = Math.min(nx - 1, Math.floor((Math.max(ax, bx, cx) - x0) * 4));
      const j0 = Math.max(0, Math.ceil((Math.min(az, bz, cz) - z0) * 4)), j1 = Math.min(nz - 1, Math.floor((Math.max(az, bz, cz) - z0) * 4));
      for (let i = i0; i <= i1; i++) {
        for (let j = j0; j <= j1; j++) {
          const x = x0 + i * 0.25, z = z0 + j * 0.25;
          const w1 = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / den, w2 = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / den, w3 = 1 - w1 - w2;
          if (w1 < -1e-4 || w2 < -1e-4 || w3 < -1e-4) continue;
          put(i, j, w1 * ay + w2 * by + w3 * cy, kind);
        }
      }
    };
    const faces = (P, I, kind) => {
      const nt = I ? I.length / 3 : P.length / 9;
      for (let t = 0; t < nt; t++) {
        const a = (I ? I[t * 3] : t * 3) * 3, b = (I ? I[t * 3 + 1] : t * 3 + 1) * 3, c = (I ? I[t * 3 + 2] : t * 3 + 2) * 3;
        if ((P[b + 2] - P[a + 2]) * (P[c] - P[a]) - (P[b] - P[a]) * (P[c + 2] - P[a + 2]) <= 0) continue;
        tri(P[a], P[a + 1], P[a + 2], P[b], P[b + 1], P[b + 2], P[c], P[c + 1], P[c + 2], kind);
      }
    };
    const RK = HARD && HARD.rock, BG = HARD && HARD.boulderGeo;
    if (RK && RK.geometry && BG) {
      G.rock = true;
      const v = new THREE.Vector3(), BO = HARD.boulders;
      RK.updateWorldMatrix(true, false);
      const RP = RK.geometry.attributes.position, RW = new Float32Array(RP.count * 3);
      for (let i = 0; i < RP.count; i++) { v.fromBufferAttribute(RP, i).applyMatrix4(RK.matrixWorld); RW[i * 3] = v.x; RW[i * 3 + 1] = v.y; RW[i * 3 + 2] = v.z; }
      faces(RW, RK.geometry.index ? RK.geometry.index.array : null, 1);
      const BP = BG.attributes.position, BI = BG.index ? BG.index.array : null, BW = new Float32Array(BP.count * 3);
      for (const b of BO) {
        if (!b.m || b.x < x0 - 3 || b.x > x1 + 3 || b.z < z0 - 3 || b.z > z1 + 3) continue;
        for (let i = 0; i < BP.count; i++) { v.fromBufferAttribute(BP, i).applyMatrix4(b.m); BW[i * 3] = v.x; BW[i * 3 + 1] = v.y; BW[i * 3 + 2] = v.z; }
        faces(BW, BI, 1);
      }
    }
    if (!G.rock) for (const e of tops) put(Math.round((e.x - x0) * 4), Math.round((e.z - z0) * 4), e.y - 0.02, 1);
    const fill = [];
    for (let i = 1; i < nx - 1 && !G.rock; i++) {
      for (let j = 1; j < nz - 1; j++) {
        const o = i * nz + j;
        if (h[o] > -1e8) continue;
        let n = 0, s = 0;
        for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const y = h[o + a * nz + b]; if ((a || b) && y > -1e8 && kd[o + a * nz + b] === 1) { n++; s += y; } }
        if (n >= 5) fill.push(o, s / n);
      }
    }
    for (let q = 0; q < fill.length; q += 2) { h[fill[q]] = fill[q + 1]; kd[fill[q]] = 1; }
    const byB = new Map();
    for (const e of bts) { let g = byB.get(e.b); if (!g) byB.set(e.b, (g = { n: 0, x: 0, z: 0, top: -1e9, s: e.s })); g.n++; g.x += e.x; g.z += e.z; g.top = Math.max(g.top, e.y); }
    const dome = (cx, cz, s, f0, a, c) => {
      const i0 = Math.floor((cx - s - x0) * 4), i1 = Math.ceil((cx + s - x0) * 4), j0 = Math.floor((cz - s - z0) * 4), j1 = Math.ceil((cz + s - z0) * 4);
      for (let i = i0; i <= i1; i++) {
        for (let j = j0; j <= j1; j++) {
          const x = x0 + i * 0.25, z = z0 + j * 0.25, d = Math.hypot(x - cx, z - cz) / s;
          if (d >= 1) continue;
          const y = f0 + (a + c) * Math.sqrt(1 - d * d) - c;
          if (y > this._fl(x, z) + 0.03) put(i, j, y, 1);
        }
      }
    };
    for (const g of byB.values()) {
      if (G.rock) break;
      const cx = g.x / g.n, cz = g.z / g.n, f0 = this._fl(cx, cz);
      if (g.top - f0 >= 0.08) dome(cx, cz, g.s * 0.92, f0, g.top - f0, 0.15 * g.s);
    }
    const BO = (HARD && HARD.boulders) || [];
    for (let bi = 0; bi < BO.length && !G.rock; bi++) {
      if (byB.has(bi)) continue;
      const b = BO[bi], f0 = this._fl(b.x, b.z), a = (Number.isFinite(b.top) ? b.top : b.y + 0.86 * b.sy) - f0;
      if (a >= 0.06) dome(b.x, b.z, b.s * 0.92, f0, a, 0.15 * b.s);
    }
    if (this._ground) {
      const A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3();
      for (const m of this._ground) {
        if (!m || !m.geometry || !m.geometry.attributes.position) continue;
        m.updateWorldMatrix(true, false);
        const P = m.geometry.attributes.position, I = m.geometry.index, mw = m.matrixWorld;
        const nt = I ? I.count / 3 : P.count / 3;
        for (let tI = 0; tI < nt; tI++) {
          const ia = I ? I.getX(tI * 3) : tI * 3, ib = I ? I.getX(tI * 3 + 1) : tI * 3 + 1, ic = I ? I.getX(tI * 3 + 2) : tI * 3 + 2;
          A.fromBufferAttribute(P, ia).applyMatrix4(mw); B.fromBufferAttribute(P, ib).applyMatrix4(mw); C.fromBufferAttribute(P, ic).applyMatrix4(mw);
          const mx0 = Math.ceil((Math.min(A.x, B.x, C.x) - x0) * 4), mx1 = Math.floor((Math.max(A.x, B.x, C.x) - x0) * 4);
          const mz0 = Math.ceil((Math.min(A.z, B.z, C.z) - z0) * 4), mz1 = Math.floor((Math.max(A.z, B.z, C.z) - z0) * 4);
          const den = (B.z - C.z) * (A.x - C.x) + (C.x - B.x) * (A.z - C.z);
          if (Math.abs(den) < 1e-10) continue;
          for (let i = mx0; i <= mx1; i++) {
            for (let j = mz0; j <= mz1; j++) {
              const x = x0 + i * 0.25, z = z0 + j * 0.25;
              const w1 = ((B.z - C.z) * (x - C.x) + (C.x - B.x) * (z - C.z)) / den;
              const w2 = ((C.z - A.z) * (x - C.x) + (A.x - C.x) * (z - C.z)) / den;
              const w3 = 1 - w1 - w2;
              if (w1 < -1e-4 || w2 < -1e-4 || w3 < -1e-4) continue;
              put(i, j, w1 * A.y + w2 * B.y + w3 * C.y, 2);
            }
          }
        }
      }
    }
    G.ms = +(performance.now() - t0).toFixed(1);
  }

  _S(x, z, timber = true) {
    let s = this._fl(x, z), kind = 0;
    const G = this._grid;
    let inG = false;
    if (G) {
      const fx = (x - G.x0) * 4, fz = (z - G.z0) * 4, i = Math.floor(fx), j = Math.floor(fz);
      if (i >= 0 && j >= 0 && i < G.nx - 1 && j < G.nz - 1) {
        const o = i * G.nz + j, Gh = G.h, u = fx - i, w = fz - j;
        const a = Gh[o], b = Gh[o + G.nz], c = Gh[o + 1], d = Gh[o + G.nz + 1];
        const on = o + (u > 0.5 ? G.nz : 0) + (w > 0.5 ? 1 : 0);
        const y = a > -1e8 && b > -1e8 && c > -1e8 && d > -1e8 ? (a * (1 - u) + b * u) * (1 - w) + (c * (1 - u) + d * u) * w : Gh[on];
        if (y > s) { s = y; kind = G.k[on]; }
      }
      inG = Math.hypot(x - LAYOUT.wreck.x, z - LAYOUT.wreck.z) < 40;
    }
    const H = this._hash;
    if (H) {
      if (timber) { const y = this._timberTop(x, z); if (y > s) { s = y; kind = 3; } }
      const l = inG ? null : H.cell1(x, z);
      if (l) {
        for (const o of l) {
          if (!o.cap && o.capOK) {
            const dx = x - o.x, dz = z - o.z, R = 0.9 * o.r, d2 = dx * dx + dz * dz;
            if (d2 >= R * R) continue;
            const y = o.y + Math.sqrt(R * R - d2) - 0.08;
            if (y > s) { s = y; kind = 1; }
          } else if (o.bould) {
            const dd = Math.hypot(x - o.x, z - o.z) / o.r;
            if (dd >= 1) continue;
            const y = o.f + (o.a + o.c) * Math.sqrt(1 - dd * dd) - o.c;
            if (y > s) { s = y; kind = 1; }
          }
        }
      }
    }
    this._sKind = kind;
    return s;
  }

  _timberTop(x, z) {
    const TH = this._thash;
    let top = -Infinity;
    if (!TH) return top;
    const l = TH.cell1(x, z);
    if (!l) return top;
    for (const o of l) {
      const t = clamp$9(((x - o.ax) * o.abx + (z - o.az) * o.abz) / o.l2xz, 0, 1);
      const px = o.ax + o.abx * t, pz = o.az + o.abz * t, d2 = (x - px) * (x - px) + (z - pz) * (z - pz), rr = 0.81 * o.r * o.r;
      if (d2 >= rr) continue;
      const y = o.ay + o.aby * t + Math.sqrt(o.r * o.r - d2);
      if (y > top) top = y;
    }
    return top;
  }
  _g(x, z) {
    const tx = Math.floor(x * 0.125), tz = Math.floor(z * 0.125), ix = tx + 12, iz = tz + 12;
    const inside = ix >= 0 && iz >= 0 && ix < 24 && iz < 24;
    const T = inside ? this._tiles[ix * 24 + iz] : null;
    let g;
    if (!T || T === 1) {
      if (inside && !T) this._req(ix, iz);
      const s = this._S(x, z, false), kd = this._sKind;
      g = kd === 1 ? s : s - 0.025;
    } else {
      const fx = (x - tx * 8) * 4, fz = (z - tz * 8) * 4;
      const i = Math.min(31, fx | 0), j = Math.min(31, fz | 0), u = fx - i, w = fz - j, o = i * 33 + j;
      g = (T[o] * (1 - u) + T[o + 33] * u) * (1 - w) + (T[o + 1] * (1 - u) + T[o + 34] * u) * w;
    }
    const tt = this._timberTop(x, z);
    return tt > g ? tt : g;
  }
  _req(ix, iz) {
    if (!this._hash) return;
    this._tiles[ix * 24 + iz] = 1;
    this._tq.push(ix * 24 + iz);
  }
  _tileWork(budget = 1.5) {
    const p = this.pos;
    for (let a = -1; a <= 1; a++) {
      for (let b = -1; b <= 1; b++) {
        const ix = Math.floor((p.x + a * 6) * 0.125) + 12, iz = Math.floor((p.z + b * 6) * 0.125) + 12;
        if (ix >= 0 && iz >= 0 && ix < 24 && iz < 24 && !this._tiles[ix * 24 + iz]) this._req(ix, iz);
      }
    }
    const t0 = performance.now();
    while ((this._tb || this._tq.length) && performance.now() - t0 < budget) {
      if (!this._tb) {
        let bi = 0, bd = 1e9;
        const cx = Math.floor(p.x * 0.125) + 12, cz = Math.floor(p.z * 0.125) + 12;
        for (let q = 0; q < this._tq.length; q++) { const id = this._tq[q], d = Math.abs(((id / 24) | 0) - cx) + Math.abs((id % 24) - cz); if (d < bd) { bd = d; bi = q; } }
        const id = this._tq.splice(bi, 1)[0];
        this._tb = { id, row: 0, A: new Float32Array(33 * 33) };
      }
      const TB = this._tb, ix = (TB.id / 24) | 0, iz = TB.id % 24, X0 = (ix - 12) * 8, Z0 = (iz - 12) * 8;
      const i = TB.row;
      for (let j = 0; j <= 32; j++) {
        const x = X0 + i * 0.25, z = Z0 + j * 0.25, s = this._S(x, z, false), kd = this._sKind;
        TB.A[i * 33 + j] = kd === 1 ? s : s - 0.025;
      }
      TB.row++;
      if (TB.row > 32) { this._tiles[TB.id] = TB.A; this._tb = null; }
    }
  }
  prewarm(x, z, r = 6) {
    for (let a = -r; a <= r; a += 4) {
      for (let b = -r; b <= r; b += 4) {
        const ix = Math.floor((x + a) * 0.125) + 12, iz = Math.floor((z + b) * 0.125) + 12;
        if (ix >= 0 && iz >= 0 && ix < 24 && iz < 24 && !this._tiles[ix * 24 + iz]) this._req(ix, iz);
      }
    }
    const px = this.pos.x, pz = this.pos.z;
    this.pos.x = x; this.pos.z = z;
    let n = 0;
    while ((this._tb || this._tq.length) && n++ < 40) this._tileWork(50);
    this.pos.x = px; this.pos.z = pz;
  }

  _clearance(p, env) {
    let m = 99;
    const N = this._cand(p.x, p.y, p.z, 3);
    for (const o of N.S) {
      if (o.r < 0.3 || o.bould) continue;
      const d = Math.hypot(p.x - o.x, p.y - o.y, p.z - o.z) - o.r;
      if (d < m) m = d;
    }
    for (const c of N.C) {
      if (c.thin) continue;
      const apx = p.x - c.ax, apy = p.y - c.ay, apz = p.z - c.az;
      const h = clamp$9((apx * c.abx + apy * c.aby + apz * c.abz) / c.l2, 0, 1);
      const d = Math.hypot(apx - c.abx * h, apy - c.aby * h, apz - c.abz * h) - c.r;
      if (d < m) m = d;
    }
    return m;
  }

  _blocked(x, y, z, env, rad = LENS_R, clear = CLEAR, thin = false, minR = 0) {
    if (y < env.floor(x, z) + clear) return true;
    if (y > env.ceiling + 0.9) return true;
    if (!this._hash && env.obstacles) this._prep(env);
    const N = this._cand(x, y, z, rad + 0.1);
    for (const o of N.S) {
      if (o.r < minR) continue;
      const dx = x - o.x, dy = y - o.y, dz = z - o.z, rr = o.r + rad;
      if (dx * dx + dy * dy + dz * dz < rr * rr) return true;
    }
    for (const c of N.C) {
      if (thin && c.thin) continue;
      if (x < c.x0 - rad || x > c.x1 + rad || z < c.z0 - rad || z > c.z1 + rad) continue;
      const apx = x - c.ax, apy = y - c.ay, apz = z - c.az;
      const h = clamp$9((apx * c.abx + apy * c.aby + apz * c.abz) / c.l2, 0, 1);
      const dx = apx - c.abx * h, dy = apy - c.aby * h, dz = apz - c.abz * h, rr = c.r + rad;
      if (dx * dx + dy * dy + dz * dz < rr * rr) return true;
    }
    return false;
  }

  _cast(p, dir, len, env, rad = LENS_R, clear = CLEAR, min = 0.35, thin = false) {
    const N = 16;
    let prev = 0;
    for (let i = 1; i <= N; i++) {
      const s = (len * i) / N;
      if (this._blocked(p.x + dir.x * s, p.y + dir.y * s, p.z + dir.z * s, env, rad, clear, thin)) {
        let lo = prev, hi = s;
        for (let j = 0; j < 5; j++) {
          const m = (lo + hi) * 0.5;
          if (this._blocked(p.x + dir.x * m, p.y + dir.y * m, p.z + dir.z * m, env, rad, clear, thin)) hi = m; else lo = m;
        }
        return Math.max(min, lo - 0.05);
      }
      prev = s;
    }
    return len;
  }

  _castCone(p, dir, len, env, r0, k, rmax, clear, min = 0.35, thin = true, minR = 0) {
    const N = 16;
    let prev = 0;
    const bl = (s) => this._blocked(p.x + dir.x * s, p.y + dir.y * s, p.z + dir.z * s, env, Math.min(rmax, r0 + k * s), clear, thin, minR);
    for (let i = 1; i <= N; i++) {
      const s = (len * i) / N;
      if (bl(s)) {
        let lo = prev, hi = s;
        for (let j = 0; j < 5; j++) { const m = (lo + hi) * 0.5; if (bl(m)) hi = m; else lo = m; }
        return Math.max(min, lo - 0.05);
      }
      prev = s;
    }
    return len;
  }
  _hardCast(p, dir, len, env) { return this._castCone(p, dir, len, env, 0.1, 0.04, 0.16, CLEAR, 0.35, true, 0.22); }
  _softCast(p, dir, len, env) { return this._castCone(p, dir, len, env, 0.15, 0.3, 0.8, 1.0, 0.35, true, 0.22); }
  _tilt(aim, find, insp) { return TILT * (1 - 0.7 * smoothstep(0.1, 0.7, -aim)) + 0.06 * find + 0.08 * insp; }
  _shoulder(dist, pp, aspect = this.camera.aspect || 16 / 9, vfov = this.camera.fov || 60) {
    return 2 * (0.5 - FRAME.x(0.38)) * dist * Math.cos(pp) * Math.tan((vfov * DEG$5) / 2) * aspect;
  }

  _slopeBias(x, z, yaw) {
    const ax = -Math.sin(yaw), az = -Math.cos(yaw);
    const r1 = this._S(x + ax * 1.0, z + az * 1.0), r2 = this._S(x + ax * 3.5, z + az * 3.5);
    return clamp$9(0.4 * Math.atan((r2 - r1) / 2.5), -0.17, 0.14);
  }
  _cs(key, target, w, dt, amax = 0) {
    const c = this.cam, x0 = c[key], v0 = c[key + 'V'] || 0;
    spr(x0, v0, target, w, dt);
    const v1 = _s[1];
    const faster = v1 * v0 < 0 ? Math.abs(v1) > 0 : Math.abs(v1) > Math.abs(v0);
    if (amax > 0 && faster) {
      const base = v1 * v0 < 0 ? 0 : v0;
      const vl = base + clamp$9(v1 - base, -amax * dt, amax * dt);
      c[key] = x0 + vl * dt; c[key + 'V'] = vl;
    } else { c[key] = _s[0]; c[key + 'V'] = v1; }
  }
  _ropeAvoid(env, dt, dir, first) {
    const c = this.cam, L = this.camPos, R = env.ropes, CL = 0.42;
    let tx = 0, ty = 0, tz = 0, best = 1e9, bx = 0, by = 0, bz = 0;
    if (R) {
      const ex = L.x + dir.x * 1.5, ey = L.y + dir.y * 1.5, ez = L.z + dir.z * 1.5, mx = (L.x + ex) / 2, my = (L.y + ey) / 2, mz = (L.z + ez) / 2;
      for (const P of R) {
        if (!P) continue;
        for (let i = 0; i + 5 < P.length; i += 3) {
          const cx = (P[i] + P[i + 3]) / 2 - mx, cy = (P[i + 1] + P[i + 4]) / 2 - my, cz = (P[i + 2] + P[i + 5]) / 2 - mz;
          if (cx * cx + cy * cy + cz * cz > 4) continue;
          const d2 = segSeg3(L.x, L.y, L.z, ex, ey, ez, P[i], P[i + 1], P[i + 2], P[i + 3], P[i + 4], P[i + 5], _g3);
          if (d2 < best) { best = d2; bx = _g3.ax - _g3.bx; by = _g3.ay - _g3.by; bz = _g3.az - _g3.bz; }
        }
      }
    }
    const d = Math.sqrt(best);
    c.ropeD = d;
    if (d < CL) {
      const along = bx * dir.x + by * dir.y + bz * dir.z;
      bx -= dir.x * along; by -= dir.y * along; bz -= dir.z * along;
      let l = Math.hypot(bx, by, bz);
      if (l < 1e-4) { bx = _rt$1.x; by = 0; bz = _rt$1.z; l = 1; }
      const k = Math.min(0.35, (CL - d) * 1.3) / l;
      tx = bx * k; ty = by * k; tz = bz * k;
    }
    if (first) { c.rope.set(tx, ty, tz); c.ropeV.set(0, 0, 0); } else {
      spr(c.rope.x, c.ropeV.x, tx, 6, dt); c.rope.x = _s[0]; c.ropeV.x = _s[1];
      spr(c.rope.y, c.ropeV.y, ty, 6, dt); c.rope.y = _s[0]; c.ropeV.y = _s[1];
      spr(c.rope.z, c.ropeV.z, tz, 6, dt); c.rope.z = _s[0]; c.ropeV.z = _s[1];
    }
    L.add(c.rope);
  }
  updateCamera(dt, env) {
    const c = this.cam, p = this.pos, v = this.vel;
    const first = !c.init;
    const asp = this.camera.aspect || 16 / 9;
    const lead = lerp$4(0.15, 0.12, smoothstep(1.25, 1.78, asp));
    const yawT = this.yaw + clamp$9(this.turnV * lead, -0.15, 0.15);
    const S = this.ground;
    const hAbove = Math.max(0, this.floatH);
    const floatT = smoothstep(1.0, 1.4, hAbove);
    const findT = env.findNear || 0, inspT = this.inspect || 0;
    const vaT = this._slopeBias(p.x, p.z, this.yaw) * (this.grounded ? 1 : 0.5);
    const AU = this.auto || this._lastAuto, apT = AU && AU.face ? smoothstep(2.2, 0.3, AU.d) : 0;
    if (first) {
      c.yaw = yawT; c.pitch = this.pitch; c.va = vaT; c.float = floatT; c.find = findT; c.insp = inspT; c.kAir = 0.5; c.gRef = S;
      c.base.set(p.x, 0, p.z); c.pv.set(0, 0, 0); c.R.set(0, 0, 0); c.RV.set(0, 0, 0);
      c.yawV = c.pitchV = c.vaV = c.floatV = c.findV = c.inspV = c.kAirV = c.gRefV = c.tightV = c.shV = c.distV = 0;
      c.boom = 0; c.boomV = 0; c.hA = 0; c.hAV = 0; c.guard = 0; c.guardV = 0;
      c.orb = AW_ORBIT * apT; c.orbV = 0; c.appr = apT; c.apprV = 0; c.side = 1; c.sideT = 0;
    } else {
      const e = wrap$1(yawT - c.yaw), ae = Math.abs(e), v0 = c.yawV;
      spr(0, v0, e, clamp$9(YAW_K / Math.max(ae, 1e-4), 2.5, VIEW_W), dt);
      let v1 = _s[1];
      if (v1 * v0 < 0 || Math.abs(v1) > Math.abs(v0)) {
        const base = v1 * v0 < 0 ? 0 : v0, acc = lerp$4(30, YAW_ACC, smoothstep(0.06, 0.26, ae));
        v1 = base + clamp$9(v1 - base, -acc * dt, acc * dt);
      }
      c.yawV = clamp$9(v1, -YAW_CAP, YAW_CAP);
      c.yaw = wrap$1(c.yaw + c.yawV * dt);
    }
    this._cs('pitch', this.pitch, VIEW_W, dt);
    this._cs('orb', AW_ORBIT * apT + NEAR_ORBIT * FRAME.tall * (env.findAhead || 0) * (1 - apT), 2.2, dt, 1.2);
    this._cs('appr', apT, 2.2, dt);
    const vyaw = c.yaw + c.orb;
    const cy = Math.cos(vyaw), sy = Math.sin(vyaw);
    this._cs('float', floatT, 2.2, dt);
    this._cs('kAir', lerp$4(0.5, 1, smoothstep(1.2, 1.8, hAbove)), 3.5, dt);
    this._cs('gRef', S, 3.0, dt);
    if (first) { c.lv.set(v.x, 0, v.z); c.lvV.set(0, 0, 0); } else {
      const lvW = this._bnd ? 3 : 5;
      spr(c.lv.x, c.lvV.x, v.x, lvW, dt); c.lv.x = _s[0]; c.lvV.x = _s[1];
      spr(c.lv.z, c.lvV.z, v.z, lvW, dt); c.lv.z = _s[0]; c.lvV.z = _s[1];
    }
    const lh = Math.hypot(c.lv.x, c.lv.z);
    const la = Math.min(0.3, 0.2 * lh) * (this.reduced ? 0.5 : 1);
    const hvl = lh || 1;
    const tx = p.x + c.lv.x * 0.333 + (c.lv.x / hvl) * la, tz = p.z + c.lv.z * 0.333 + (c.lv.z / hvl) * la;
    spr(c.base.x, c.pv.x, tx, PIV_W, dt); c.base.x = _s[0]; c.pv.x = _s[1];
    spr(c.base.z, c.pv.z, tz, PIV_W, dt); c.base.z = _s[0]; c.pv.z = _s[1];
    this._cs('hA', p.y - ORIGIN - c.gRef, 5, dt);
    const baseY = c.gRef + ORIGIN + PIVOT_UP + c.kAir * c.hA;
    this._cs('insp', inspT, 4, dt);
    this._cs('find', findT, 2.4, dt);
    this._cs('va', vaT, 2.4, dt);
    const tilt = this._tilt(c.pitch, c.find, c.insp);
    {
      let need = 0;
      if (!first) {
        const L = this.camPos, dx = p.x - L.x, dz = p.z - L.z, hd0 = Math.hypot(dx, dz) || 1e-3;
        const hd = Math.max(0.3, hd0 - 0.45 * smoothstep(0.1, 0.6, Math.hypot(v.x, v.z)));
        const below = Math.atan2(L.y - S, hd) + c.lastPP;
        const fy = FRAME.floor > 0 ? Math.min(FRAME.y(0.8, 0.45), 2 * FRAME.floor - 1) : FRAME.y(0.8, 0.45);
        const lim = Math.atan(fy * Math.tan(((this.camera.fov || 60) * DEG$5) / 2));
        need = clamp$9(below - lim, 0, 0.25);
      }
      this._cs('guard', need, 3.5, dt);
    }
    const pp0 = clamp$9(c.pitch + c.va - tilt + 6 * DEG$5 * c.float - 0.1 * c.appr, -1.32, 0.85);
    const want = DIST * FRAME.reach() - 0.6 * c.tight * (1 - c.insp) - 1.0 * c.insp + 0.6 * c.float - 0.9 * c.appr;
    _rt$1.set(cy, 0, -sy);
    {
      _pt.set(c.base.x, baseY, c.base.z).addScaledVector(_rt$1, c.sh);
      const probe = (b) => {
        const q = clamp$9(pp0 - b, -1.32, 0.85);
        _off.set(sy * Math.cos(q), -Math.sin(q), cy * Math.cos(q));
        const h = this._hardCast(_pt, _off, want, env);
        return Math.max(Math.min(h, this._softCast(_pt, _off, want, env)), Math.min(h, 1.6));
      };
      const room = Math.min(want, Math.max(0.85 * want, 1.9));
      let boomT = c.boom;
      const h0 = probe(c.boom);
      if (h0 < room) {
        let best = h0;
        for (const b of BOOMS) {
          if (Math.abs(b - c.boom) < 1e-3) continue;
          const h = probe(b);
          if (h >= room) { boomT = b; break; }
          if (h > best + 0.25) { best = h; boomT = b; }
        }
      } else if (c.boom > 0.01) {
        const b1 = Math.max(0, c.boom - 0.2);
        if (probe(b1) >= room) boomT = b1;
      }
      if (first) { c.boom = boomT; c.boomV = 0; } else this._cs('boom', boomT, 2.4, dt, 2.5);
    }
    const pp = clamp$9(pp0 - c.boom, -1.32, 0.85);
    c.lastPP = pp;
    _dir.set(-sy * Math.cos(pp), Math.sin(pp), -cy * Math.cos(pp));
    _pt.set(c.base.x, baseY, c.base.z);
    const shW = this._shoulder(c.dist, pp, asp);
    const shR = this._cast(_pt, _rt$1, shW, env, 0.15, 0.25, 0, true);
    _v.copy(_rt$1).negate();
    const shL = c.side > 0 && shR >= 0.35 * shW ? shW : this._cast(_pt, _v, shW, env, 0.15, 0.25, 0, true);
    if (!first) {
      const go = c.side > 0 ? shR < 0.35 * shW && shL > 0.8 * shW : shR > 0.8 * shW;
      c.sideT = go ? c.sideT + dt : 0;
      if (c.sideT > (c.side > 0 ? 0.3 : 0.6)) { c.side = -c.side; c.sideT = 0; }
    }
    const shT = c.side > 0 ? Math.min(shR, shW) : -Math.min(shL, shW);
    if (first) c.sh = shT;
    else if (shT * c.sh < -1e-4) this._cs('sh', shT, 2.6, dt, 2);
    else {
      const inward = Math.abs(shT) < Math.abs(c.sh);
      this._cs('sh', shT, inward ? 8 : 3.2, dt, inward ? 8 : 3);
    }
    if (c.sh < -shW - 0.2 || c.sh > shW + 0.2) { c.sh = clamp$9(c.sh, -shW - 0.2, shW + 0.2); c.shV = 0; }
    _pt.addScaledVector(_rt$1, c.sh);
    c.pivot.copy(_pt);
    const tightT = 1 - smoothstep(0.7, 2.6, this._clearance(_pt, env));
    if (first) c.tight = tightT;
    else this._cs('tight', tightT, 4.8, dt);
    _off.copy(_dir).negate();
    const hard = this._hardCast(_pt, _off, Math.max(want, c.dist), env);
    const soft = Math.min(hard, want, this._softCast(_pt, _off, want, env));
    const dT = Math.max(soft, Math.min(hard, DIST_MIN));
    if (first) c.dist = dT;
    else this._cs('dist', dT, dT < c.dist ? 5 : 3.0, dt, dT < c.dist ? 5 : 3);
    if (c.dist > hard) {
      const L0 = c.dist, inside = this._blocked(_pt.x + _off.x * L0, _pt.y + _off.y * L0, _pt.z + _off.z * L0, env, 0.15, CLEAR, true);
      const nd = inside ? hard : Math.max(hard, L0 - PULL_MAX * dt);
      if (c.distV > (nd - L0) / dt) c.distV = (nd - L0) / dt;
      c.dist = nd;
    }
    if (c.dist < 0.35) { c.dist = 0.35; if (c.distV < 0) c.distV = 0; }
    c.init = true;
    this.camPos.copy(_pt).addScaledVector(_off, c.dist);
    this._ropeAvoid(env, dt, _dir, first);
    if (c.R.lengthSq() > 1e-10 || c.RV.lengthSq() > 1e-10) {
      for (const k of ['x', 'y', 'z']) { spr(c.R[k], c.RV[k], 0, 2.0, dt); c.R[k] = _s[0]; c.RV[k] = _s[1]; }
      this.camPos.addScaledVector(_rt$1, c.R.x);
      this.camPos.y += c.R.y;
      this.camPos.x += sy * c.R.z; this.camPos.z += cy * c.R.z;
    }
    const N = this._cand(this.camPos.x, this.camPos.y, this.camPos.z, 0.5);
    for (const o of N.S) {
      if (o.r >= 0.22) continue;
      const q = this.camPos, dx = q.x - o.x, dy = q.y - o.y, dz = q.z - o.z, d = Math.hypot(dx, dy, dz), rr = o.r + THIN_R;
      if (d < rr && d > 1e-4) { const k = (rr - d) / d; q.x += dx * k; q.y += dy * k; q.z += dz * k; }
    }
    for (const o of N.C) {
      if (!o.thin) continue;
      const q = this.camPos;
      const apx = q.x - o.ax, apy = q.y - o.ay, apz = q.z - o.az;
      const h = clamp$9((apx * o.abx + apy * o.aby + apz * o.abz) / o.l2, 0, 1);
      const dx = apx - o.abx * h, dy = apy - o.aby * h, dz = apz - o.abz * h, d = Math.hypot(dx, dy, dz), rr = o.r + THIN_R;
      if (d < rr && d > 1e-4) { const k = (rr - d) / d; q.x += dx * k; q.y += dy * k; q.z += dz * k; }
    }
    this.camQuat.setFromEuler(_e.set(clamp$9(pp - c.guard, -1.4, 0.85), vyaw, 0, 'YXZ'));
    c.fov = 3 * c.float * (this.reduced ? 0 : 1);
    this.camera.position.copy(this.camPos);
    this.camera.quaternion.copy(this.camQuat);
  }
}

const SVGNS$1 = 'http://www.w3.org/2000/svg';
const media = (q) => (typeof matchMedia === 'function' ? matchMedia(q).matches : false);
const REDUCED = media('(prefers-reduced-motion: reduce)');
const touchNow = () => document.documentElement.classList.contains('touch');
const OUT = 'cubic-bezier(.16, .84, .3, 1)';
const clamp01 = (v) => (v > 1 ? 1 : v > 0 ? v : 0);
const half = (v) => Math.round(v * 2) / 2;
const fmtTime = (sec) => {
  const s = Math.max(0, Math.floor(+sec || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
const area = (a, b) => {
  const w = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0), h = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
  return w > 0 && h > 0 ? w * h : 0;
};

const CK_R = 86;
const CK_ARC = 2 * Math.PI * CK_R;
const CK_START = -90;
const SN_C = 2 * Math.PI * 29;
const MK_RX = 0.4, MK_RY = 0.36;
const TITLE_IN = 1200;
const STORY_IN = 500;
const READ_WORD = 0.3, READ_BASE = 1;
const readSecs = (t) => String(t || '').split(/\s+/).filter(Boolean).length * READ_WORD + READ_BASE;
const FACT_SECS = 6.5;
const FACT_LAST = 2.2;
const CLEAN_MS = 3600;
const STORY_OVER = 1.5;
const FACT_READ = [0.8, 0.22];
const WAIT_LEFT = 0.6;

function svgEl$1(tag, attrs) {
  const n = document.createElementNS(SVGNS$1, tag);
  if (attrs) for (const k in attrs) n.setAttribute(k, attrs[k]);
  return n;
}

const CUE_SPIN = 1900;
function cueRing(parent) {
  const el = document.createElement('div');
  el.setAttribute('aria-hidden', 'true');
  Object.assign(el.style, { position: 'absolute', left: '0', top: '0', width: '0', height: '0', opacity: '0', pointerEvents: 'none', willChange: 'transform, opacity' });
  const spin = el.appendChild(document.createElement('div'));
  Object.assign(spin.style, { width: '100%', height: '100%' });
  const s = spin.appendChild(svgEl$1('svg', { viewBox: '-60 -60 120 120', focusable: 'false' }));
  Object.assign(s.style, { display: 'block', width: '100%', height: '100%', overflow: 'visible', filter: 'drop-shadow(0 0 1.2px rgba(0, 8, 12, .8)) drop-shadow(0 0 4px rgba(255, 210, 140, .55))' });
  const g = s.appendChild(svgEl$1('defs')).appendChild(svgEl$1('linearGradient', { id: 'ckCueG', gradientUnits: 'userSpaceOnUse', x1: '-47', y1: '17', x2: '50', y2: '0' }));
  g.appendChild(svgEl$1('stop', { offset: '0', 'stop-color': '#f4dca6', 'stop-opacity': '0' }));
  g.appendChild(svgEl$1('stop', { offset: '.6', 'stop-color': '#f4dca6', 'stop-opacity': '.6' }));
  g.appendChild(svgEl$1('stop', { offset: '1', 'stop-color': '#fff3d8', 'stop-opacity': '1' }));
  const line = { fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'vector-effect': 'non-scaling-stroke' };
  s.appendChild(svgEl$1('circle', { ...line, r: '50', stroke: '#f4dca6', 'stroke-opacity': '.26', 'stroke-width': '1.1' }));
  s.appendChild(svgEl$1('path', { ...line, d: 'M-46.98 17.1A50 50 0 1 1 50 0', stroke: 'url(#ckCueG)', 'stroke-width': '1.9' }));
  s.appendChild(svgEl$1('path', { ...line, d: 'M42.6 -5.6L50 2.4L57.4 -5.6', stroke: '#fff3d8', 'stroke-width': '1.9' }));
  parent.appendChild(el);
  el._spin = REDUCED || !spin.animate ? null : spin.animate([{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }], { duration: CUE_SPIN, iterations: Infinity });
  if (el._spin) el._spin.pause();
  return el;
}

let _inkR = null;
function inkRects(el, add) {
  _inkR = _inkR || document.createRange();
  const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let n = tw.nextNode(); n; n = tw.nextNode()) {
    if (!n.data.trim() || n.parentElement.closest('.k')) continue;
    _inkR.selectNodeContents(n);
    for (const r of _inkR.getClientRects()) add(r);
  }
  for (const k of el.querySelectorAll('.k')) for (const r of k.getClientRects()) add(r);
}

function reveal(el, on, outMs = 600) {
  if (!el) return;
  clearTimeout(el._hideT);
  if (on) {
    if (el.hidden) { el.hidden = false; void el.offsetWidth; }
    el.classList.add('in');
  } else {
    el.classList.remove('in');
    if (!el.hidden) el._hideT = setTimeout(() => { el.hidden = true; }, outMs);
  }
}

function replay(el, cls) {
  if (!el) return;
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
}

function gearIcon() {
  const w = document.createElement('span');
  w.className = 'gi';
  for (const cls of ['gi-base', 'gi-fill']) {
    const s = svgEl$1('svg', { viewBox: '0 0 24 24', class: cls, 'aria-hidden': 'true', focusable: 'false' });
    s.appendChild(svgEl$1('use', { href: '#gearIcon' }));
    w.appendChild(s);
  }
  return w;
}

const KEY_LABEL = { ESC: 'Esc', ESCAPE: 'Esc', SPACE: 'Space', SPACEBAR: 'Space', ENTER: 'Enter', RETURN: 'Enter', SHIFT: 'Shift', TAB: 'Tab', CTRL: 'Ctrl', ALT: 'Alt' };
const MOUSE = {
  bg: 'M1.5 8a6.5 6.5 0 0 1 13 0v6a6.5 6.5 0 0 1-13 0z',
  L: 'M8 1.5A6.5 6.5 0 0 0 1.5 8v1H8z',
  R: 'M8 1.5A6.5 6.5 0 0 1 14.5 8v1H8z',
  line: 'M1.5 8a6.5 6.5 0 0 1 13 0v6a6.5 6.5 0 0 1-13 0zM8 1.5V9M1.5 9h13',
  wheel: 'M8 3.8v2.4',
};

const LD_GR = ['Α', 'ν', 'τ', 'ι', 'κ', 'ύ', 'θ', 'η', 'ρ', 'α'];
const LD_EN = ['A', 'N', 'T', 'I', 'K', 'Y', 'TH', 'E', 'R', 'A'];

const TOUCH_ICONS = {
  JUMP: [['path', { d: 'M7 13.5l5-5 5 5' }], ['path', { d: 'M8 18h8' }]],
  FACE: [['circle', { cx: 12, cy: 12, r: 8.5 }], ['path', { class: 'fill', d: 'M12 7.9l4.1 4.1-4.1 4.1-4.1-4.1z' }]],
  BRUSH: [['path', { d: 'M12 3.5v6' }], ['path', { d: 'M8 9.5h8v3.2H8z' }], ['path', { d: 'M8.9 12.7v5.1M10.45 12.7v6.1M12 12.7v6.6M13.55 12.7v6.1M15.1 12.7v5.1' }]],
  SONAR: [['circle', { class: 'sea', cx: 12, cy: 12, r: 8.5 }], ['circle', { class: 'sea', cx: 12, cy: 12, r: 4.4 }], ['circle', { class: 'seafill', cx: 12, cy: 12, r: 1.7 }]],
  LEAVE: [['path', { d: 'M14.5 6.5L9 12l5.5 5.5' }]],
  RUB: [['path', { d: 'M5 12h14' }], ['path', { d: 'M8.2 8.8L5 12l3.2 3.2' }], ['path', { d: 'M15.8 8.8L19 12l-3.2 3.2' }]],
  STICK: [['circle', { cx: 12, cy: 12, r: 9 }], ['circle', { class: 'fill', cx: 12, cy: 8.6, r: 3.7 }]],
};
function touchIcon(name, cls = 'ic') {
  const s = svgEl$1('svg', { viewBox: '0 0 24 24', class: cls, 'aria-hidden': 'true', focusable: 'false' });
  for (const [tag, a] of TOUCH_ICONS[name] || []) s.appendChild(svgEl$1(tag, a));
  return s;
}

function glyph(key) {
  const raw = String(key == null ? '' : key).trim();
  const u = raw.toUpperCase().replace(/[\s_-]+/g, '');
  const el = document.createElement('span');
  if (TOUCH_ICONS[u]) {
    el.className = 'k k-btn';
    el.setAttribute('role', 'img');
    el.setAttribute('aria-label', raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase());
    el.appendChild(touchIcon(u, ''));
    return el;
  }
  const right = u === 'RMB' || u === 'RIGHTCLICK';
  const left = u === 'LMB' || u === 'CLICK' || u === 'LEFTCLICK';
  if (u === 'TAP' || u === 'TOUCH' || (left && touchNow())) {
    el.className = 'k k-touch';
    el.setAttribute('role', 'img');
    el.setAttribute('aria-label', 'Touch');
    const s = svgEl$1('svg', { viewBox: '0 0 22 22', 'aria-hidden': 'true', focusable: 'false' });
    s.append(
      svgEl$1('circle', { class: 'ring2', cx: 11, cy: 11, r: 10 }),
      svgEl$1('circle', { class: 'ring', cx: 11, cy: 11, r: 7 }),
      svgEl$1('circle', { class: 'dot', cx: 11, cy: 11, r: 3.4 }),
    );
    el.appendChild(s);
    return el;
  }
  if (left || right || u === 'MMB' || u === 'MOUSE') {
    el.className = 'k k-mouse';
    el.setAttribute('role', 'img');
    el.setAttribute('aria-label', right ? 'Right mouse button' : left ? 'Left mouse button' : 'Mouse');
    el.dataset.k = right ? 'RMB' : left ? 'LMB' : 'MOUSE';
    const s = svgEl$1('svg', { viewBox: '0 0 16 22', 'aria-hidden': 'true', focusable: 'false' });
    s.appendChild(svgEl$1('path', { class: 'bg', d: MOUSE.bg }));
    if (left || right) s.appendChild(svgEl$1('path', { class: 'hot', d: right ? MOUSE.R : MOUSE.L }));
    s.appendChild(svgEl$1('path', { class: 'line', d: MOUSE.line + (left || right ? '' : MOUSE.wheel) }));
    el.appendChild(s);
    return el;
  }
  const label = KEY_LABEL[u] || (raw.length === 1 ? raw.toUpperCase() : raw);
  el.className = label.length > 1 ? 'k k-key wide' : 'k k-key';
  el.textContent = label;
  el.dataset.k = u;
  return el;
}

const AUTO = /\[([^\]\n]{1,12})\]|\b(?:([Rr]ight[- ]?[Cc]lick)|([Ll]eft[- ]?[Cc]lick|(?:[Tt]he )?[Mm]ouse button|[Cc]lick)|(Space|Esc|Escape|Enter|Shift)|([QEW]))\b/g;

function fillRich(el, text) {
  el.textContent = '';
  for (const part of String(text == null ? '' : text).split(/\s+[·•]\s+/)) {
    const s = part.trim();
    if (!s) continue;
    const src = s.charAt(0).toUpperCase() + s.slice(1);
    const g = document.createElement('span');
    g.className = 'pg';
    let last = 0;
    AUTO.lastIndex = 0;
    for (let m = AUTO.exec(src); m; m = AUTO.exec(src)) {
      if (m.index > last) g.appendChild(document.createTextNode(src.slice(last, m.index)));
      g.appendChild(glyph(m[1] || (m[2] ? 'RMB' : m[3] ? 'LMB' : m[4] || m[5])));
      last = m.index + m[0].length;
    }
    if (last < src.length) g.appendChild(document.createTextNode(src.slice(last)));
    el.appendChild(g);
  }
}

const noop = () => {};
const radio = Object.assign(() => {}, { clear: noop });
const journal = { isOpen: false, setGoal: noop, add: () => null, open: noop, toggle: noop };
const toast = noop;

const UI = {
  radio,
  journal,
  toast,

  init() {
    const all = (sel) => [...document.querySelectorAll(sel)];
    const missing = [];
    const $ = (id) => document.getElementById(id) || (missing.push(id), document.createElement('div'));
    const e = (this.e = {
      ui: $('ui'),
      loading: $('loading'), loadArt: $('loadArt'), loadText: $('loadText'),
      title: $('title'),
      hud: $('hud'), obj: $('obj'), objText: $('objText'), slotBox: $('slots'),
      fade: $('fade'), air: $('air'), airArc: $('airArc'), airTime: $('airTime'), airWarn: $('airWarn'),
      marker: $('marker'), markerDist: $('markerDist'), markerArrow: $('markerArrow'), markerRing: $('markerRing'),
      hint: $('hint'), sonarBtn: $('sonarBtn'), sonarArc: $('sonarArc'),
      prompt: $('prompt'), promptRow: $('promptRow'), promptKey: $('promptKey'), promptText: $('promptText'),
      story: $('story'), storyKicker: $('storyKicker'), storyLine: $('storyLine'), storySub: $('storySub'), headline: $('headline'),
      clean: $('clean'), cleanLine: $('cleanLine'),
      puzzle: $('puzzle'), labels: all('#puzzle .pz-label'), pzHint: $('pzHint'),
      crank: $('crank'), crankProg: $('crankProg'), crankHead: $('crankHead'), crankMonth: $('crankMonth'),
      crankHint: $('crankHint'),
      flash: $('flash'),
      end: $('end'), endTitle: $('endTitle'), endStat: $('endStat'), endTime: $('endTime'), again: $('again'), loadName: $('loadName'),
    });
    e.corner = document.querySelector('#ui .corner');
    for (const n of all('[data-key]')) {
      const g = glyph(n.dataset.key);
      for (const c of n.classList) g.classList.add(c);
      n.replaceWith(g);
    }
    e.slots = [0, 1, 2].map(() => e.slotBox.appendChild(gearIcon()));
    if (missing.length) console.warn('[antikythera] UI elements missing from index.html:', missing.join(', '));
    this.c = {
      obj: null, air: '', airOff: '', airLow: null, airCrit: null, airHold: null, snCd: -1, snReady: null, snOff: null,
      mkOn: false, mkEdge: null, mkUp: null, mkX: NaN, mkY: NaN, mkA: NaN, mkD: '',
      hint: '', prOn: false, prText: null, prKey: null, prX: NaN, prY: NaN, prHalf: 0,
      cleanFull: null, ck: null, ckHint: null,
    };
    this.vw = innerWidth;
    this.vh = innerHeight;
    this.barVar();
    this.factAt = 0;
    this.hudDirty = true;
    addEventListener('resize', () => {
      this.vw = innerWidth;
      this.vh = innerHeight;
      this.barVar();
      const c = this.c;
      c.prText = c.prKey = null;
      c.prX = c.prY = c.mkX = c.mkY = NaN;
      this.hudDirty = true;
    });
    const keyName = (ev) => {
      const code = ev.code || '';
      const m = /^Key([A-Z])$/.exec(code) || /^Digit(\d)$/.exec(code);
      if (m) return m[1];
      const u = code.toUpperCase().replace(/^(SHIFT|CONTROL|ALT|META)(LEFT|RIGHT)$/, '$1');
      return u === 'ESCAPE' ? 'ESC' : u;
    };
    const press = (k, on) => {
      if (!k) return;
      for (const el of document.querySelectorAll(`.k[data-k="${k}"]`)) {
        if (on) {
          clearTimeout(el._up);
          el.classList.add('down');
          el._t = performance.now();
        } else {
          el._up = setTimeout(() => el.classList.remove('down'), Math.max(0, 140 - (performance.now() - (el._t || 0))));
        }
      }
    };
    addEventListener('keydown', (ev) => { if (!ev.repeat) press(keyName(ev), true); });
    addEventListener('keyup', (ev) => press(keyName(ev), false));
    const btn = (ev) => (ev.button === 2 ? 'RMB' : ev.button === 0 ? 'LMB' : '');
    addEventListener('pointerdown', (ev) => { if (ev.pointerType !== 'touch') { press(btn(ev), true); press('MOUSE', true); } }, true);
    addEventListener('pointerup', (ev) => { press(btn(ev), false); press('MOUSE', false); }, true);
    addEventListener('pointercancel', () => { press('LMB', false); press('RMB', false); press('MOUSE', false); }, true);
    addEventListener('blur', () => { for (const el of document.querySelectorAll('.k.down')) el.classList.remove('down'); });
  },

  loading(p, text) {
    const k = clamp01(p);
    if (this.e.loadArt) this.e.loadArt.style.setProperty('--p', k.toFixed(3));
    if (text) this.e.loadText.textContent = text;
    const L = this._ldSetup();
    if (L) { L.target = Math.max(L.target, k); this._ldRun(); }
  },
  hideLoading() {
    const el = this.e.loading;
    const go = () => {
      if (this.ldGone) return;
      this.ldGone = true;
      el.classList.add('gone');
      setTimeout(() => { el.hidden = true; for (const c of el.querySelectorAll('canvas')) c.width = c.height = 0; }, 1100);
    };
    const L = this.ld;
    if (L && L.done < LD_GR.length) {
      L.fast = true;
      L.onDone = go;
      this._ldRun();
      setTimeout(go, 1400);
    } else go();
  },

  _ldSetup() {
    const el = this.e.loadName;
    if (!el || this.ld) return this.ld;
    el.textContent = '';
    const slots = LD_GR.map((g) => {
      const s = document.createElement('span');
      s.className = 'gr';
      s.textContent = g;
      el.appendChild(s);
      return s;
    });
    this.ld = { slots, done: 0, target: 0, t0: 0, timer: 0, fast: false, onDone: null,
      reduce: matchMedia('(prefers-reduced-motion: reduce)').matches };
    const size = () => {
      const probe = document.createElement('span');
      probe.style.visibility = 'hidden';
      el.appendChild(probe);
      slots.forEach((s, i) => {
        probe.className = 'gr';
        probe.textContent = LD_GR[i];
        s._wg = probe.getBoundingClientRect().width;
        probe.className = '';
        probe.textContent = LD_EN[i];
        s._we = probe.getBoundingClientRect().width;
        s.style.width = `${s.classList.contains('gr') && !s._grown ? s._wg : s._we}px`;
      });
      probe.remove();
    };
    size();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(size);
    return this.ld;
  },
  _ldRun() {
    const L = this.ld;
    if (!L || L.timer) return;
    const N = LD_GR.length;
    const step = () => {
      L.timer = 0;
      const now = performance.now();
      const want = L.fast ? N : Math.min(N, Math.floor(L.target * N * 1.08));
      if (L.done < want) {
        const s = L.slots[L.done];
        if (!L.t0) L.t0 = now;
        const per = L.fast ? 110 : 260, age = now - L.t0;
        if (age < per && !L.reduce) {
          if (age > per - 200 && !s._grown) { s._grown = true; if (s._we) s.style.width = `${s._we}px`; }
        } else {
          s._grown = true;
          if (s._we) s.style.width = `${s._we}px`;
          s.classList.remove('gr');
          s.textContent = LD_EN[L.done];
          if (!L.reduce) s.classList.add('fl');
          L.done++;
          L.t0 = 0;
        }
      }
      if (L.done >= N) {
        if (L.onDone) { const f = L.onDone; L.onDone = null; setTimeout(f, 420); }
        return;
      }
      L.timer = setTimeout(step, 30);
    };
    L.timer = setTimeout(step, 30);
  },
  showTitle(on) { reveal(this.e.title, !!on, 700); },
  showHUD(on) {
    reveal(this.e.hud, !!on, 600);
    this.hudDirty = true;
    if (!on) {
      this.prompt(0, 0, '', '', false);
      this.marker(0, 0, 0, false);
    }
  },

  showSonar(on) {
    const off = !on;
    if (off === this.c.snOff) return;
    this.c.snOff = off;
    this.e.sonarBtn.classList.toggle('off', off);
    this.hudDirty = true;
  },
  sonar(cd, ready) {
    const c = this.c, e = this.e;
    const q = Math.round(clamp01(cd) * 240) / 240;
    if (q !== c.snCd) { c.snCd = q; e.sonarArc.style.strokeDashoffset = (SN_C * q).toFixed(2); }
    const r = !!ready;
    if (r !== c.snReady) {
      c.snReady = r;
      e.sonarBtn.classList.toggle('ready', r);
      e.sonarBtn.setAttribute('aria-disabled', String(!r));
    }
  },
  sonarDenied() {
    const el = this.e.sonarBtn;
    if (!el || el.classList.contains('off')) return;
    if (this._denyAt && performance.now() - this._denyAt < 200) return;
    this._denyAt = performance.now();
    replay(el, 'deny');
    clearTimeout(this._denyT);
    this._denyT = setTimeout(() => el.classList.remove('deny'), 260);
  },

  objective(text, quiet = false) {
    const t = String(text == null ? '' : text);
    if (t === this.c.obj) return;
    this.c.obj = t;
    this.e.objText.textContent = t;
    if (!quiet) { if (this.factAt) this.objDue = true; else replay(this.e.obj, 'reveal'); }
  },
  fillSlot(i) {
    const s = this.e.slots[i];
    if (s && !s.classList.contains('filled')) s.classList.add('filled');
  },
  fadeOut(on = true) { if (this.e.fade) this.e.fade.classList.toggle('on', !!on); },
  air(left, total, held = false) {
    const e = this.e, c = this.c;
    if (!e.air) return;
    const f = Math.max(0, Math.min(1, left / total));
    const t = fmtTime(Math.ceil(Math.max(0, left)));
    if (t !== c.air) { c.air = t; e.airTime.textContent = t; }
    const off = (169.65 * (1 - f)).toFixed(1);
    if (off !== c.airOff) { c.airOff = off; e.airArc.style.strokeDashoffset = off; }
    const low = left < 30, crit = left < 15, hold = !!held;
    if (low !== c.airLow) { c.airLow = low; e.air.classList.toggle('low', low); }
    if (crit !== c.airCrit) { c.airCrit = crit; e.air.classList.toggle('crit', crit); }
    if (hold !== c.airHold) { c.airHold = hold; e.air.classList.toggle('hold', hold); }
  },
  airWarn(text, level = 0) {
    const el = this.e.airWarn;
    if (!el) return;
    el.textContent = String(text || '');
    el.classList.toggle('red', level >= 1);
    replay(el, 'on');
    replay(this.e.air, 'warn');
    this.hudDirty = true;
    clearTimeout(this.airWarnT);
    this.airWarnT = setTimeout(() => { el.classList.remove('on'); this.e.air.classList.remove('warn'); this.hudDirty = true; }, 3400);
  },
  depth() {},

  hudRects() {
    const now = performance.now();
    if (this._hud && !this.hudDirty && now - (this._hudAt || 0) < 500) return this._hud;
    const e = this.e, out = [], p = 8;
    const add = (el, on = true) => {
      if (!el || !on || !el.getBoundingClientRect) return;
      const r = el.getBoundingClientRect();
      if (r.width > 1 && r.height > 1) out.push({ x0: r.left - p, y0: r.top - p, x1: r.right + p, y1: r.bottom + p });
    };
    const hud = e.hud.classList.contains('in');
    add(e.obj, hud);
    add(e.air, hud);
    add(e.airWarn, hud && e.airWarn.classList.contains('on'));
    add(e.corner);
    add(e.sonarBtn, (hud && !e.sonarBtn.classList.contains('off')) || document.documentElement.classList.contains('touch'));
    add(e.hint, e.hint.classList.contains('on') && !e.ui.classList.contains('story-on'));
    add(e.story, e.story.classList.contains('on'));
    for (const b of document.querySelectorAll('#pad .tb')) {
      const r = b.getBoundingClientRect();
      if (!(r.width > 1)) continue;
      const k = b.classList.contains('on') ? 0 : 0.125 * r.width;
      out.push({ x0: r.left - k - p, y0: r.top - k - p, x1: r.right + k + p, y1: r.bottom + k + p });
    }
    this._hud = out;
    this._hudAt = now;
    this.hudDirty = false;
    return out;
  },

  marker(x, y, dist, visible, opts) {
    const c = this.c, e = this.e;
    if (!visible || !Number.isFinite(x) || !Number.isFinite(y)) {
      if (c.mkOn) {
        c.mkOn = false;
        e.marker.classList.remove('on');
        clearTimeout(this.mkT);
        this.mkT = setTimeout(() => {
          if (c.mkOn) return;
          e.markerDist.textContent = '';
          c.mkD = '';
          e.marker.style.transform = 'translate3d(-9999px, -9999px, 0)';
          c.mkX = c.mkY = NaN;
        }, 420);
      }
      return;
    }
    let edge;
    if (opts && typeof opts === 'object') ({ x, y, edge } = this._mkPlace(x, y, opts));
    else edge = !opts;
    if (!c.mkOn) {
      c.mkOn = true;
      clearTimeout(this.mkT);
      e.marker.classList.add('on');
      if (!REDUCED && e.markerRing.animate) {
        e.markerRing.animate([{ transform: 'scale(.3)', opacity: 0.95 }, { transform: 'scale(2.6)', opacity: 0 }], { duration: 1000, easing: OUT });
      }
    }
    const flipped = edge !== c.mkEdge;
    if (flipped) { c.mkEdge = edge; e.marker.classList.toggle('edge', edge); }
    const up = y > this.vh * 0.78;
    if (up !== c.mkUp) { c.mkUp = up; e.marker.classList.toggle('up', up); }
    const px = half(x), py = half(y);
    const moved = px !== c.mkX || py !== c.mkY;
    if (moved) {
      c.mkX = px; c.mkY = py;
      e.marker.style.transform = `translate3d(${px}px, ${py}px, 0)`;
    }
    if (edge && (moved || flipped)) {
      const a = Math.round((Math.atan2(py - this.vh / 2, px - this.vw / 2) * 180) / Math.PI);
      if (a !== c.mkA) { c.mkA = a; e.markerArrow.style.transform = `rotate(${a}deg)`; }
    }
    const d = `${Math.max(0, Math.round(+dist || 0))} m`;
    if (d !== c.mkD) { c.mkD = d; e.markerDist.textContent = d; }
  },

  _mkPlace(x, y, opts) {
    const e = this.e, W = this.vw, H = this.vh, cx = W / 2, cy = H / 2, rx = W * MK_RX, ry = H * MK_RY;
    let dx = x - cx, dy = y - cy;
    if (opts.behind) { dx = -dx; dy = Math.max(Math.abs(dy), Math.abs(dx) * 0.2, 1); }
    const k = Math.hypot(dx / rx, dy / ry);
    let edge = !!opts.behind || k > 1;
    if (edge) { dx /= k; dy /= k; }
    const s = this.fs || (this.fs = parseFloat(getComputedStyle(e.marker).fontSize) || 20);
    const hud = this.hudRects();
    for (let n = 0; n < 14; n++) {
      const px = cx + dx, py = cy + dy, up = py > H * 0.78;
      const b = { x0: px - 1.6 * s, x1: px + 1.6 * s, y0: py - (up ? 2.2 : 0.8) * s, y1: py + (up ? 0.8 : 2.2) * s };
      let hit = false;
      for (const h of hud) if (area(b, h) > 0) { hit = true; break; }
      if (!hit) break;
      dx *= 0.9; dy *= 0.9; edge = true;
    }
    return { x: cx + dx, y: cy + dy, edge };
  },

  markersMore(list) {
    const e = this.e, M = this.mkMore || (this.mkMore = []);
    if (!e.marker) return;
    while (M.length < list.length) {
      const el = e.marker.cloneNode(true);
      el.removeAttribute('id');
      for (const n of el.querySelectorAll('[id]')) n.removeAttribute('id');
      el.classList.remove('on', 'edge', 'up');
      el.style.transform = 'translate3d(-9999px, -9999px, 0)';
      e.marker.parentNode.insertBefore(el, e.marker);
      M.push({ el, ring: el.querySelector('.mk-ring'), arrow: el.querySelector('.mk-arrow'), dist: el.querySelector('.mk-dist'), on: false, edge: null, d: '' });
    }
    M.forEach((m, i) => {
      const t = list[i];
      if (!t || !Number.isFinite(t.x) || !Number.isFinite(t.y)) {
        if (m.on) { m.on = false; m.el.classList.remove('on'); }
        return;
      }
      const p = this._mkPlace(t.x, t.y, { behind: !!t.behind });
      if (!m.on) {
        m.on = true;
        m.el.classList.add('on');
        if (!REDUCED && m.ring && m.ring.animate) m.ring.animate([{ transform: 'scale(.3)', opacity: 0.95 }, { transform: 'scale(2.6)', opacity: 0 }], { duration: 1000, easing: OUT });
      }
      if (p.edge !== m.edge) { m.edge = p.edge; m.el.classList.toggle('edge', p.edge); }
      m.el.classList.toggle('up', p.y > this.vh * 0.78);
      m.el.style.transform = `translate3d(${half(p.x)}px, ${half(p.y)}px, 0)`;
      if (p.edge && m.arrow) m.arrow.style.transform = `rotate(${Math.round((Math.atan2(p.y - this.vh / 2, p.x - this.vw / 2) * 180) / Math.PI)}deg)`;
      const d = `${Math.max(0, Math.round(+t.dist || 0))} m`;
      if (d !== m.d) { m.d = d; if (m.dist) m.dist.textContent = d; }
    });
  },

  hint(text) {
    const t = text == null ? '' : String(text);
    if (t === this.c.hint) return;
    this.c.hint = t;
    this.hudDirty = true;
    const el = this.e.hint;
    clearTimeout(this.hintT);
    if (!t) { el.classList.remove('on'); return; }
    if (el.classList.contains('on')) {
      el.classList.remove('on');
      this.hintT = setTimeout(() => { fillRich(el, t); el.classList.add('on'); }, 200);
    } else {
      fillRich(el, t);
      el.classList.add('on');
    }
  },

  prompt(x, y, text, key, on) {
    const c = this.c, e = this.e;
    const show = (on === undefined || !!on) && Number.isFinite(x) && Number.isFinite(y);
    if (!show) {
      if (c.prOn) { c.prOn = false; e.prompt.classList.remove('on'); e.ui.classList.remove('pr-on'); }
      return;
    }
    let resized = false;
    const t = text == null ? '' : String(text);
    if (t !== c.prText) { c.prText = t; fillRich(e.promptText, t); resized = true; }
    const k = key == null ? '' : String(key);
    if (k !== c.prKey) {
      c.prKey = k;
      e.promptKey.replaceChildren(...(k ? [glyph(k)] : []));
      e.promptKey.hidden = !k;
      resized = true;
    }
    if (!c.prOn) { c.prOn = true; e.prompt.classList.add('on'); e.ui.classList.add('pr-on'); }
    if (resized) c.prHalf = e.promptRow.offsetWidth / 2;
    const pad = 12;
    const px = half(Math.min(Math.max(x, c.prHalf + pad), this.vw - c.prHalf - pad));
    const py = half(Math.min(Math.max(y, 96), this.vh - 24));
    if (px !== c.prX || py !== c.prY) {
      c.prX = px; c.prY = py;
      e.prompt.style.transform = `translate3d(${px}px, ${py}px, 0)`;
    }
  },

  _after(sec, fn) {
    const t = { left: Math.max(0, +sec || 0), fn };
    (this._tm || (this._tm = [])).push(t);
    this._pump();
    return t;
  },
  _cancel(t) { if (t) t.fn = null; },
  _advance(dt) {
    this.gt = (this.gt || 0) + dt;
    const tm = this._tm;
    if (!tm || !tm.length) return;
    for (const t of tm.slice()) {
      if (!t.fn) continue;
      t.left -= dt;
      if (t.left <= 0) { const f = t.fn; t.fn = null; f(); }
    }
    this._tm = this._tm.filter((t) => t.fn);
  },
  _pump() {
    if (this.ticked || this._pumpT) return;
    let last = performance.now();
    const go = () => {
      this._pumpT = 0;
      if (this.ticked) return;
      const now = performance.now();
      this._advance((now - last) / 1000);
      last = now;
      if (this._tm && this._tm.length) this._pumpT = setTimeout(go, 50);
    };
    this._pumpT = setTimeout(go, 50);
  },
  tick(dt) {
    const d = Math.max(0, +dt || 0);
    this.ticked = true;
    this._advance(d);
    if (!this.factAt) return;
    this.factTicked = true;
    this.factAge += d;
    this._factStep();
  },

  title(text, o = {}) {
    const el = this.e.headline;
    if (!el) return;
    clearTimeout(this.tiIn);
    this._cancel(this.tiDel);
    this._cancel(this.tiOut);
    const off = () => {
      if (el.classList.contains('on')) { el.classList.remove('on'); this.tiGone = performance.now() + TITLE_IN; }
    };
    if (!text) { off(); return; }
    const hold = o.hold === undefined ? 4200 : Math.max(0, +o.hold || 0);
    const go = () => {
      const wait = el.classList.contains('on') ? (off(), TITLE_IN) : Math.max(0, (this.tiGone || 0) - performance.now());
      if (wait > 0) { this.tiIn = setTimeout(go, wait); return; }
      if (o.html) el.innerHTML = String(text); else el.textContent = String(text);
      el.classList.toggle('name', !!o.name);
      el.classList.add('on');
      if (hold > 0) this.tiOut = this._after(Math.max(TITLE_IN, hold) / 1000, off);
    };
    if (+o.delay > 0) this.tiDel = this._after(+o.delay / 1000, go); else go();
  },

  story(text, o = {}) {
    if (typeof o === 'number') o = { ms: o };
    const t = text == null ? '' : String(text);
    this._cancel(this.stIn);
    if (!t) { this.stQ = []; if (!this.factAt) this._storyOff(); return; }
    const kicker = o.kicker ? String(o.kicker) : '', sub = o.sub ? String(o.sub) : '';
    const ms = Math.max(+o.ms || 0, readSecs(`${kicker} ${t} ${sub}`) * 1000);
    const L = { t, kicker, sub, ms, keep: !!o.keep };
    const go = () => {
      if (this.factAt) { this._queue(L); return; }
      const left = o.after && this.storyUp() && this.stLine ? this.stLine.read - ((this.gt || 0) - this.stLine.at) : 0;
      if (left > 0.05) { this.stIn = this._after(left, () => this._storyShow(L)); return; }
      this._storyShow(L);
    };
    if (+o.delay > 0) this.stIn = this._after(+o.delay / 1000, go); else go();
  },
  _queue(L) {
    const q = this.stQ || (this.stQ = []), at = this.gt || 0;
    const w = q.find((x) => x.t === L.t);
    if (w) Object.assign(w, L, { at }); else q.push({ ...L, at });
  },
  _drain() {
    const q = this.stQ;
    if (!q || !q.length || this.factAt || this.clOn) return false;
    const now = this.gt || 0;
    while (q.length) {
      const L = q.shift();
      const read = readSecs(`${L.kicker} ${L.t} ${L.sub}`), left = L.ms / 1000 - (now - L.at);
      if (left < WAIT_LEFT * read && !L.keep) continue;
      this._storyShow({ ...L, ms: Math.max(left, read) * 1000 });
      return true;
    }
    return false;
  },
  caption(text, ms) { this.story(text, { ms }); },
  beat(main, sub = '', ms = 4600, delay = 0) {
    if (main) this.story(main, { ms, delay });
    else if (sub) this.title(sub, { hold: ms, delay });
    else { this.title(''); this.story(''); }
  },
  _storyShow(L) {
    const e = this.e, el = e.story;
    const text = L.t, kicker = L.kicker || '', sub = L.sub || '', ms = L.ms || 0;
    this._cancel(this.stOut);
    this.clHead = false;
    clearTimeout(this.stSwap);
    clearTimeout(this.stGone);
    this.stGone = 0;
    const put = () => {
      fillRich(e.storyLine, text);
      e.storyKicker.textContent = kicker;
      e.storySub.textContent = sub;
      el.classList.toggle('kick', !!kicker);
      el.classList.toggle('sub', !!sub);
      const c = this.card;
      el.style.minHeight = c && c.h && c.kicker === kicker ? `${c.h}px` : '';
      e.storyLine.classList.remove('swap');
      el.classList.remove('swap');
      el.classList.add('on');
      e.ui.classList.add('story-on');
      this.hudDirty = true;
      this.stLine = { t: text, read: readSecs(`${kicker} ${text} ${sub}`), at: this.gt || 0 };
      if (ms > 0) this.stOut = this._after(ms / 1000, () => this._storyOff(true));
    };
    if (el.classList.contains('on') && !el.classList.contains('swap')) {
      if (kicker && kicker === e.storyKicker.textContent && sub === e.storySub.textContent) e.storyLine.classList.add('swap'); else el.classList.add('swap');
      this.stSwap = setTimeout(put, 300);
    } else put();
  },
  _storyOff(ended = false) {
    const e = this.e, el = e.story;
    this._cancel(this.stOut);
    clearTimeout(this.stSwap);
    const was = el.classList.contains('on');
    el.classList.remove('on', 'swap');
    this.stLine = null;
    this.clHead = false;
    this.hudDirty = true;
    if (!was && this.stGone) { this.stEnded = this.stEnded || ended; return; }
    clearTimeout(this.stGone);
    this.stEnded = ended;
    this.stGone = setTimeout(() => {
      this.stGone = 0;
      if (el.classList.contains('on')) return;
      if (this.stEnded && this._drain()) return;
      e.ui.classList.remove('story-on');
      e.storyLine.textContent = '';
      e.storyKicker.textContent = '';
      e.storySub.textContent = '';
      el.style.minHeight = '';
      this.hudDirty = true;
    }, was ? STORY_IN : 0);
  },
  storyUp() { return this.e.story.classList.contains('on'); },
  storyInk() {
    const e = this.e;
    if (!e.story.classList.contains('on')) return null;
    const now = performance.now(), key = e.storyKicker.textContent + '|' + e.storyLine.textContent + '|' + e.storySub.textContent;
    if (this._stInk !== undefined && this._stInkK === key && now - this._stInkAt < 250) return this._stInk;
    let b = null;
    inkRects(e.story, (r) => {
      if (r.width < 2 || r.height < 2) return;
      b = b ? { x0: Math.min(b.x0, r.left), y0: Math.min(b.y0, r.top), x1: Math.max(b.x1, r.right), y1: Math.max(b.y1, r.bottom) } : { x0: r.left, y0: r.top, x1: r.right, y1: r.bottom };
    });
    this._stInk = b;
    this._stInkK = key;
    this._stInkAt = now;
    return b;
  },

  fact(i, f) {
    const d = f || {};
    const lines = [d.text, d.line].filter(Boolean).map(String);
    if (!lines.length) return;
    const kicker = d.title ? String(d.title) : '';
    clearTimeout(this.factT);
    const need = lines.map((l, k) => readSecs(k ? l : `${kicker} ${l}`) - 0.2);
    const sum = need.reduce((a, b) => a + b, 0), k = Math.max(1, FACT_SECS / sum);
    this.card = { lines, kicker, at: 0, ends: need.map((_, j) => need.slice(0, j + 1).reduce((a, b) => a + b, 0) * k),
      last: Math.max(FACT_LAST, readSecs(lines[lines.length - 1])), h: this._lineH(lines) };
    this.factAt = performance.now();
    this.factAge = 0;
    this.factEnd = this.card.ends[this.card.ends.length - 1];
    const words = [d.title, d.text, d.line].join(' ').split(/\s+/).filter(Boolean).length;
    this.factRead = Math.min(this.factEnd - 0.5, FACT_READ[0] + words * FACT_READ[1]);
    this.factTicked = false;
    this._storyShow({ t: lines[0], kicker, ms: 0 });
    this.e.ui.classList.add('fc');
    this.hudDirty = true;
    const fall = () => {
      if (this.factTicked || !this.factAt) return;
      this.factAge = (performance.now() - this.factAt) / 1000;
      this._factStep();
      if (this.factAt) this.factT = setTimeout(fall, 100);
    };
    this.factT = setTimeout(fall, 100);
  },
  _factStep() {
    const c = this.card;
    if (!c || !this.factAt) return;
    if (this.factAge >= this.factEnd) { this.hideFact(); return; }
    let j = 0;
    while (j < c.lines.length - 1 && this.factAge >= c.ends[j]) j++;
    if (j !== c.at) { c.at = j; this._storyShow({ t: c.lines[j], kicker: c.kicker, ms: 0 }); }
  },
  tickFact(dt) { this.tick(dt); },
  _lineH(lines) {
    const L = this.e.storyLine, keep = [...L.childNodes];
    let h = 0;
    for (const l of lines) { fillRich(L, l); h = Math.max(h, L.offsetHeight); }
    L.replaceChildren(...keep);
    return h;
  },
  refitFact() { return false; },
  factUp() { return !!this.factAt; },
  factReadMs() { return this.factAt ? 1000 * (this.factRead || 0) : 0; },
  dismissFact(minMs = 0) {
    const c = this.card;
    if (!this.factAt || !c) return;
    const age = this.factAge, min = Math.max(0, +minMs || 0) / 1000, last = c.lines.length - 1;
    if (c.at < last) {
      const cut = Math.max(age, min);
      if (cut < c.ends[c.at]) {
        const d = c.ends[c.at] - cut;
        for (let j = c.at; j <= last; j++) c.ends[j] -= d;
        c.ends[last] = Math.max(c.ends[last], c.ends[last - 1] + c.last);
      }
    } else {
      c.ends[last] = Math.max(Math.min(c.ends[last], Math.max(age, min)), (last ? c.ends[last - 1] : 0) + c.last);
    }
    this.factEnd = c.ends[last];
  },
  hideFact(quiet = false) {
    clearTimeout(this.factT);
    const was = !!this.factAt;
    this.factAt = 0;
    this.card = null;
    this.e.ui.classList.remove('fc');
    this.hudDirty = true;
    if (was && !quiet) this._storyOff(true);
    if (this.objDue) { this.objDue = false; replay(this.e.obj, 'reveal'); }
  },

  showClean(on, title = true) {
    const v = !!on, e = this.e;
    reveal(e.clean, v, 500);
    e.ui.classList.toggle('cl', v);
    const t = e.cleanLine, line = ((t.content || t).textContent || '').trim(), sub = (t.dataset && t.dataset.sub) || '';
    this._cancel(this.clEnd);
    if (v) {
      this.prompt(0, 0, '', '', false);
      if (this.factAt) this.hideFact(true);
      this.clOn = false;
      this._cancel(this.stIn);
      if (line && title) {
        this._storyShow({ t: line, sub, ms: CLEAN_MS });
        this.clHead = true;
        this.clReady = false;
        this.clEnd = this._after(readSecs(`${line} ${sub}`), () => { this.clEnd = null; if (this.clReady) this._cleanHeadOff(); });
      } else if (this.storyUp()) this._storyOff();
      this.clOn = true;
    } else {
      this.clOn = false;
      if (this.clHead && this.storyUp()) this._storyOff();
    }
  },
  cleanReady() {
    if (this.clReady) return;
    this.clReady = true;
    if (this.clHead && !this.clEnd) this._cleanHeadOff();
  },
  _cleanHeadOff() {
    if (this.clHead && this.storyUp()) this._storyOff();
    this.clHead = false;
  },
  clean(p) {
    const full = clamp01(p) >= 1;
    if (full !== this.c.cleanFull) { this.c.cleanFull = full; this.e.clean.classList.toggle('full', full); }
    const q = Math.round(clamp01(p) * 100) / 100;
    if (q !== this.c.cleanP) { this.c.cleanP = q; this.e.clean.style.setProperty('--cp', q); }
  },

  puzzle(on) {
    const v = !!on;
    reveal(this.e.puzzle, v, 450);
    clearTimeout(this.pzT);
    if (v) this.e.ui.classList.add('pz');
    else this.pzT = setTimeout(() => this.e.ui.classList.remove('pz'), 450);
  },
  puzzleLabels(items) {
    const list = items || [];
    const st = this.storyInk(), pad = st ? (this.fs || (this.fs = parseFloat(getComputedStyle(this.e.marker).fontSize) || 20)) : 0;
    this.e.labels.forEach((el, i) => {
      const it = list[i];
      const c = el._c || (el._c = { on: false, t: null, x: NaN, y: NaN, w: 0, h: 0, wt: null, off: false });
      if (!it || !Number.isFinite(it.x) || !Number.isFinite(it.y)) {
        if (c.on) { c.on = false; el.classList.remove('on'); }
        return;
      }
      if (!c.on) { c.on = true; el.classList.add('on'); }
      const t = String(it.text == null ? '' : it.text);
      if (t !== c.t) { c.t = t; el.textContent = t; }
      const x = half(it.x), y = half(it.y);
      if (x !== c.x || y !== c.y) {
        c.x = x; c.y = y;
        el.style.transform = `translate3d(${x}px, ${y}px, 0) translateX(-50%)`;
      }
      let off = false;
      if (st) {
        if (c.wt !== c.t) { c.wt = c.t; c.w = el.offsetWidth; c.h = el.offsetHeight; }
        off = y + c.h + pad > st.y0 && y - pad < st.y1;
      }
      if (off !== c.off) { c.off = off; el.classList.toggle('yield', off); }
    });
  },

  puzzleHint(text) {
    const t = text == null ? '' : String(text);
    if (t === this.c.pzHint) return;
    this.c.pzHint = t;
    const el = this.e.pzHint;
    if (t) fillRich(el, t);
    el.classList.toggle('on', !!t);
  },

  showCrank(on) {
    const v = !!on;
    if (v) {
      this.c.ck = null;
      this.e.crank.classList.remove('done', 'ready', 'go');
      this.e.crank.style.setProperty('--spd', '0');
    }
    reveal(this.e.crank, v, 600);
    this.e.ui.classList.toggle('ck', v);
  },
  crank(months, _years, total = 223) {
    const e = this.e;
    const c = this.c.ck || (this.c.ck = { p: -1, m: -1, y: '', t: 0, last: 0, v: 0, g: -1, done: false });
    const mo = Math.max(0, +months || 0);
    const tot = +total > 0 ? +total : 223;
    const q = Math.round(clamp01(mo / tot) * 1000) / 1000;
    if (q !== c.p) {
      c.p = q;
      e.crankProg.style.strokeDashoffset = (CK_ARC * (1 - q)).toFixed(2);
      e.crankHead.setAttribute('transform', `rotate(${(CK_START + 360 * q).toFixed(2)} 100 100)`);
    }
    const m = Math.floor(mo);
    if (m !== c.m) { c.m = m; e.crankMonth.textContent = String(m); }
    const now = performance.now(), dt = (now - c.t) / 1000;
    if (c.t && dt > 0 && dt < 0.5) c.v += ((mo - c.last) / dt - c.v) * Math.min(1, dt * 5);
    c.t = now;
    c.last = mo;
    const g = Math.round(clamp01(c.v / 26) * 10) / 10;
    if (g !== c.g) { c.g = g; e.crank.style.setProperty('--spd', String(g)); }
    const done = mo >= tot - 1e-3;
    if (done !== c.done) { c.done = done; e.crank.classList.toggle('done', done); }
  },
  crankState(ready, go) {
    const c = this.c.ck || (this.c.ck = { p: -1, m: -1, y: '', t: 0, last: 0, v: 0, g: -1, done: false });
    if (ready !== c.ready) { c.ready = ready; this.e.crank.classList.toggle('ready', ready); }
    if (go !== c.go) { c.go = go; this.e.crank.classList.toggle('go', go); }
  },
  crankCue(k, x, y, r) {
    const e = this.e;
    if (!e.crankCue) e.crankCue = cueRing(e.crank);
    const el = e.crankCue, c = this.c.cue || (this.c.cue = { k: -1, x: NaN, y: NaN, r: NaN, on: null });
    const kq = Math.round(clamp01(k) * 40) / 40;
    if (kq !== c.k) { c.k = kq; el.style.opacity = String(kq); }
    const on = kq > 0;
    if (on !== c.on) {
      c.on = on;
      if (el._spin) { if (on) el._spin.play(); else el._spin.pause(); }
    }
    if (!on) return;
    const rr = Math.round(r);
    if (rr !== c.r) { c.r = rr; el.style.width = el.style.height = `${rr * 2.4}px`; el.style.margin = `${-rr * 1.2}px 0 0 ${-rr * 1.2}px`; }
    const hx = half(x), hy = half(y);
    if (hx !== c.x || hy !== c.y) { c.x = hx; c.y = hy; el.style.transform = `translate3d(${hx}px, ${hy}px, 0)`; }
  },
  crankHint(text) {
    const t = text == null ? '' : String(text);
    if (t === this.c.ckHint) return;
    this.c.ckHint = t;
    const el = this.e.crankHint;
    fillRich(el, t);
    if (!REDUCED && el.animate) {
      el.animate([{ opacity: 0, transform: 'translateY(.35em)' }, { opacity: 1, transform: 'none' }], { duration: 360, easing: OUT });
    }
  },

  letterbox(on, secs = 0) {
    const v = !!on;
    BAND$1.set(v, secs);
    this.e.ui.classList.toggle('lb', v);
  },
  barWords() {
    const now = performance.now();
    if (this._words !== undefined && now - this._wordsAt < 250) return this._words;
    const e = this.e, vw = Math.max(1, innerWidth), vh = Math.max(1, innerHeight);
    let b = null;
    const add = (r) => {
      if (r.width < 2 || r.height < 2 || r.top < vh * 0.5) return;
      if (!b) b = [r.left, r.top, r.right, r.bottom];
      else b = [Math.min(b[0], r.left), Math.min(b[1], r.top), Math.max(b[2], r.right), Math.max(b[3], r.bottom)];
    };
    const story = e.story.classList.contains('on'), deep = vw / vh < STORY_OVER;
    for (const [el, on] of [[e.story, story && !deep], [e.pzHint, e.pzHint.classList.contains('on')], [e.crankHint, !e.crank.hidden && !story], [e.headline, e.headline.classList.contains('on')]]) {
      if (on) inkRects(el, add);
    }
    this._words = b && [b[0] / vw, b[1] / vh, b[2] / vw, b[3] / vh];
    this._wordsAt = now;
    return this._words;
  },
  barVar() {
    const b = BAND$1.barFor(innerWidth / Math.max(1, innerHeight), media('(pointer: coarse)'));
    document.documentElement.style.setProperty('--bar', `${(b * 100).toFixed(2)}vh`);
  },
  flash(amount = 1) {
    const el = this.e.flash;
    el.style.transition = 'none';
    el.style.opacity = String(amount);
    requestAnimationFrame(() => {
      el.style.transition = 'opacity 1.4s ease-out';
      el.style.opacity = '0';
    });
  },

  showEnd(sec) {
    const e = this.e;
    const has = Number.isFinite(+sec) && sec !== null;
    if (has) e.endTime.textContent = fmtTime(Math.min(+sec, 120));
    e.endStat.hidden = !has;
    this.prompt(0, 0, '', '', false);
    this.story('');
    e.end.classList.remove('more', 'looks', 'looked');
    reveal(e.end, true, 1200);
    this.title(e.endTitle.innerHTML || 'You discovered the world’s first computer', { hold: 0, html: true });
  },
  endMore() {
    const e = this.e;
    if (e.end.classList.contains('more')) return;
    e.end.classList.add('more');
    try { e.again.focus({ preventScroll: true }); } catch (err) {  }
  },
  endHint(used) {
    const el = this.e.end;
    el.classList.add('looks');
    if (used) el.classList.add('looked');
  },
};

