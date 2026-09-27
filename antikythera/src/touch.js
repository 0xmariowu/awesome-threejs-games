// touch.js
const DEG$4 = Math.PI / 180;
const clamp$6 = (v, a, b) => (v < a ? a : v > b ? b : v);
const sstep$6 = (a, b, x) => { const t = clamp$6((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const now = () => performance.now();
const stop = (e) => e.stopPropagation();
const SVGNS = 'http://www.w3.org/2000/svg';
const svgEl = (tag, attrs) => { const n = document.createElementNS(SVGNS, tag); for (const k in attrs) n.setAttribute(k, attrs[k]); return n; };

const TAP_MS = 250, TAP_PX = 12;
const PICK_PX = 48;
const RUB_PX = 10, RUB_MS = 900;
const RUB_STROKE_MS = 350;
const RUB_NEAR = 64;
const TAP_NEAR = 110;
const WALK_IN_M = 8;
const LOOK_K = 3.5, LOOK_Y = 0.8;
const R0 = 56, DZ = 0.14;
const VALVE_HOLD = 0.25;
const BLOWUP_T = 4;
const YEAR = 12.368;
const FACE_TAP = 0.8;
const ARC_C = 2 * Math.PI * 30;
const FLOOR_PX = 224;

const HAPTIC = {
  button: 8, float: 14, blowup: [20, 60, 20], knock: 30, sonar: 18, reach: 10, rub: 5, tenth: 8, clear: [25, 40, 15],
  lift: 10, align: 6, seat: 35, wrong: [12, 50, 12], year: 5, saros: [40, 70, 25],
  air30: [15, 80, 15], air15: [25, 80, 25, 80, 25], hauled: 60,
};

class Touch {
  constructor({ canvas, camera, player, G, UI, api }) {
    this.canvas = canvas;
    this.camera = camera;
    this.player = player;
    this.G = G;
    this.UI = UI;
    this.api = api;
    this.mode = false;
    this.live = false;
    this.gesture = false;
    this.fingers = new Map();
    this.pass = new Map();
    this.eat = new Set();
    this.holds = new Map();
    this.hold = { Space: false, F: false };
    this.stick = { on: false, fwd: 0, turn: 0, off: 0, k: 1, back: false };
    player.stick = this.stick;
    this.stickF = null;
    this.stickUsed = false;
    this.ghostT = 0;
    this.faceT = 0;
    this.ckSum = 0;
    this.rubs = 0;
    this.used = { jump: false, face: false };
    this.safe = { t: 0, r: 0, b: 0, l: 0 };
    this.sc = 1;
    this.R = R0;
    this.buzzLog = [];
    this._k = { obj: null, W: false, S: false, Space: false, F: false };
    this._w = { cd: 0, valve: false, blow: false, knock: 0, air: 0, tenth: 0, unc: false, held: null, hover: -1, miss: 0, fit: 0, year: 0, arr: false };
    this._st = '';
    this._on = {};
    this._lastBuzz = 0;
    this._eatClick = 0;
    this._wakeLock = null;
    this._dived = false;
    this._land = innerWidth >= innerHeight;
    this.coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;

    addEventListener('pointerdown', (e) => this._down(e), true);
    addEventListener('pointermove', (e) => this._move(e), true);
    addEventListener('pointerup', (e) => this._up(e, false), true);
    addEventListener('pointercancel', (e) => this._up(e, true), true);
    addEventListener('keydown', () => this.setMode(false), true);
    addEventListener('click', (e) => this._click(e), true);
    addEventListener('blur', () => this.releaseAll());
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.releaseAll(); else if (this._dived) this._wake(); });
    addEventListener('resize', () => this._resized());
    addEventListener('orientationchange', () => this._resized());
    addEventListener('pagehide', () => this._sleep());
    if (this.coarse) this.setMode(true);
  }

  setMode(on) {
    on = !!on;
    if (on === this.mode) return;
    this.mode = on;
    document.documentElement.classList.toggle('touch', on);
    if (on) this._build();
    else this.releaseAll();
  }

  lift(px) { return Math.min(0.24, (2 * px) / Math.max(1, this.canvas.clientHeight || innerHeight)); }

  _down(e) {
    if (e.pointerType !== 'touch') return;
    this.gesture = true;
    this.setMode(true);
    const id = e.pointerId, x = e.clientX, y = e.clientY;
    if (e.target !== this.canvas) return;
    const s = this.G.state;
    if (s === 'explore' || s === 'dive' || s === 'crank') {
      stop(e);
      try { this.canvas.setPointerCapture(id); } catch (err) {  }
      const f = { id, x0: x, y0: y, x, y, t0: now(), far: 0, role: null };
      this.fingers.set(id, f);
      this._begin(f, s);
      return;
    }
    if (this.pass.size && s !== 'end') { this.eat.add(id); stop(e); return; }
    this.pass.set(id, { ax: x, ay: y, dx: 0, dy: 0, dir: false, run: 0, tick: 0 });
  }

  _move(e) {
    if (e.pointerType === 'mouse') { if (this.mode && (e.movementX || e.movementY)) this.setMode(false); return; }
    if (e.pointerType !== 'touch') return;
    const id = e.pointerId, f = this.fingers.get(id);
    if (f) {
      const x = e.clientX, y = e.clientY, dx = x - f.x, dy = y - f.y;
      f.x = x; f.y = y;
      f.far = Math.max(f.far, Math.hypot(x - f.x0, y - f.y0));
      if (f.role === 'rub' && this.G.state === 'clean') { this._toBrush(f); return; }
      stop(e);
      if (f.role === 'look') { if (this._rubbed(f)) this._rubStart(f); if (f.role === 'look') this._look(dx, dy); }
      else if (f.role === 'stick') {
        this._stickMove(f);
        if (this._rubbed(f, 3) && this.api.canBrush()) this._rubStart(f);
      }
      else if (f.role === 'crank') this._ckMove(f);
      return;
    }
    if (this.eat.has(id) || this.holds.has(id)) { stop(e); return; }
    const p = this.pass.get(id);
    if (p) this._rub(p, e.clientX, e.clientY);
  }

  _up(e, cancel) {
    if (e.pointerType !== 'touch') return;
    const id = e.pointerId;
    if (this._release(id)) return;
    const f = this.fingers.get(id);
    if (f) {
      stop(e);
      this.fingers.delete(id);
      try { this.canvas.releasePointerCapture(id); } catch (err) {  }
      this._end(f, !cancel && f.far < TAP_PX && now() - f.t0 < TAP_MS);
      return;
    }
    if (this.eat.delete(id)) { stop(e); return; }
    this.pass.delete(id);
  }

  _click(e) {
    if (!this._eatClick || now() - this._eatClick > 800) return;
    const t = e.target;
    if (t && t.closest && t.closest('#sonarBtn')) { this._eatClick = 0; e.stopPropagation(); e.preventDefault(); }
  }

  _begin(f, s) {
    if (s === 'crank') {
      if (this._role('crank')) return;
      f.role = 'crank';
      f.fx = f.px = f.x; f.fy = f.py = f.y; f.h = null;
      f.cx = f.x; f.cy = f.y - 30 * this.sc;
      return;
    }
    if (s === 'explore' && !this._role('look') && (this._findAt(f.x, f.y, RUB_NEAR) || this._onPrompt(f.x, f.y))) { this._lookBegin(f); return; }
    if (this._inZone(f.x, f.y) && !this._role('stick')) {
      f.role = 'stick';
      const z = this._zone(), R = this.R;
      f.bx = clamp$6(f.x, z.x0 + R, Math.max(z.x0 + R, z.x1 - R));
      f.by = clamp$6(f.y, z.y0 + R, Math.max(z.y0 + R, z.y1 - R));
      f.rub = this._rubInit(f);
      this.stick.back = false;
      this.stickF = f;
      this._stickOut();
      return;
    }
    if (s === 'explore' && !this._role('look')) this._lookBegin(f);
  }

  _end(f, tap) {
    if (f.role === 'stick') { if (this.stickF === f) this.stickF = null; this._stickOut(); }
    else if (f.role === 'crank' && this._ckHold) { this.G.hold = false; this._ckHold = false; }
    const role = f.role;
    f.role = null;
    if (tap && this.G.state === 'explore' && (role === 'look' || role === 'stick')) this._tap(f.x, f.y);
  }

  _role(r) {
    for (const f of this.fingers.values()) if (f.role === r) return f;
    return null;
  }

  releaseAll() {
    for (const id of [...this.holds.keys()]) this._release(id);
    this.hold.Space = this.hold.F = false;
    this.faceT = 0;
    for (const [id, f] of this.fingers) { f.role = null; this.eat.add(id); }
    this.fingers.clear();
    this.stickF = null;
    this._stickOut();
    if (this._ckHold) { this.G.hold = false; this._ckHold = false; }
    this._keys();
  }

  _look(dx, dy) {
    const P = this.player;
    if (this.G.state !== 'explore' || !P.enabled) return;
    P._look(dx, dy * LOOK_Y, LOOK_K / Math.max(innerWidth, innerHeight, 1));
  }

  _stickMove(f) {
    const lim = 1.25 * this.R, dx = f.x - f.bx, dy = f.y - f.by, L = Math.hypot(dx, dy);
    if (L > lim) { const k = (L - lim) / L; f.bx += dx * k; f.by += dy * k; }
    this._stickOut();
  }

  _stickOut() {
    const f = this.stickF, s = this.stick;
    const L = f ? Math.hypot(f.x - f.bx, f.y - f.by) : 0, R = this.R, dz = DZ * R;
    const m = f ? clamp$6((L - dz) / (R - dz), 0, 1) : 0;
    if (m <= 0) { s.on = false; s.fwd = 0; s.turn = 0; s.off = 0; s.k = 1; return; }
    this.stickUsed = true;
    const th = Math.atan2(f.x - f.bx, -(f.y - f.by));
    s.back = s.back ? Math.abs(th) > 120 * DEG$4 : Math.abs(th) > 140 * DEG$4;
    s.on = true;
    if (s.back) { s.fwd = -m; s.turn = 0; s.off = 0; s.k = 1; return; }
    s.fwd = m;
    const a = Math.max(0, Math.abs(th) - 12 * DEG$4);
    s.turn = this._role('look') ? 0 : -Math.sign(th) * Math.min(1, a / (75 * DEG$4)) * 0.8;
    s.off = -clamp$6(th, -35 * DEG$4, 35 * DEG$4);
    const v = 0.5 + 0.5 * sstep$6(0.3, 0.9, m);
    s.k = v * v;
  }

  _tap(x, y) {
    if (this._markerAt(x, y)) { this.faceT = FACE_TAP; return; }
    const api = this.api;
    const it = this._findAt(x, y, TAP_NEAR) || (api.canBrush() && this._onPrompt(x, y, 28) ? api.target() : null);
    if (!it || api.busy()) return;
    this.rubs++;
    this.buzz('rub');
    api.rubStart(it);
  }
  _lookBegin(f) {
    f.role = 'look';
    f.rub = this._rubInit(f);
  }
  _rubInit(f) {
    const P = this.player;
    return { ax: f.x, ay: f.y, dx: 0, dy: 0, dir: false, run: 0, turns: [], st: now(), sy: P.yaw, sp: P.pitch };
  }
  _rubbed(f, need = 2) {
    const r = f.rub;
    if (!r) return false;
    const sx = f.x - r.ax, sy = f.y - r.ay, l = Math.hypot(sx, sy);
    if (l < 3) return false;
    const ux = sx / l, uy = sy / l, t = now(), P = this.player;
    if (r.dir && ux * r.dx + uy * r.dy < -0.5) {
      const short = t - r.st < RUB_STROKE_MS;
      if (r.run >= RUB_PX) r.turns.push({ t, yaw: short ? r.sy : P.yaw, pitch: short ? r.sp : P.pitch });
      r.run = 0;
      r.st = t; r.sy = P.yaw; r.sp = P.pitch;
    }
    r.dir = true; r.dx = ux; r.dy = uy; r.run += l; r.ax = f.x; r.ay = f.y;
    while (r.turns.length && t - r.turns[0].t > RUB_MS) r.turns.shift();
    return r.turns.length >= need;
  }
  _rubStart(f) {
    const api = this.api, it = api.canBrush() ? api.target() : this._findAt(f.x, f.y, RUB_NEAR);
    if (!it) return;
    const P = this.player, v = f.rub.turns[0];
    if (v) { P.yaw = v.yaw; P.pitch = v.pitch; }
    if (this.stickF === f) { this.stickF = null; this._stickOut(); this._keys(); }
    f.role = 'rub';
    f.rub = null;
    this.rubs++;
    this.buzz('rub');
    api.rubStart(it);
    if (this.G.state === 'clean') this._toBrush(f);
  }
  _toBrush(f) {
    this.fingers.delete(f.id);
    this.pass.set(f.id, { ax: f.x, ay: f.y, dx: 0, dy: 0, dir: false, run: 0, tick: 0 });
    this.api.brushFrom(f.x, f.y, f.id);
  }
  _findAt(x, y, px = PICK_PX) {
    const P = this.player, W = innerWidth, H = innerHeight;
    let best = null, bd = px * this.sc;
    for (const it of this.api.finds()) {
      if (!it || it.state !== 'buried' || Math.hypot(it.home.x - P.pos.x, it.home.z - P.pos.z) > WALK_IN_M) continue;
      const v = (this._v || (this._v = it.home.clone())).copy(it.home).project(this.camera);
      if (v.z >= 1) continue;
      const d = Math.hypot((v.x * 0.5 + 0.5) * W - x, (-v.y * 0.5 + 0.5) * H - y);
      if (d < bd) { bd = d; best = it; }
    }
    return best;
  }
  _onPrompt(x, y, padPx = 16) {
    const m = document.getElementById('prompt');
    if (!m || !m.classList.contains('on') || !this.api.canBrush()) return false;
    const row = m.querySelector('.wp-row'), mark = m.querySelector('.wp-mark');
    if (!row || !mark) return false;
    const a = row.getBoundingClientRect(), b = mark.getBoundingClientRect(), pad = padPx * this.sc;
    if (!(a.width > 0)) return false;
    return x >= Math.min(a.left, b.left) - pad && x <= Math.max(a.right, b.right) + pad &&
      y >= Math.min(a.top, b.top) - pad && y <= Math.max(a.bottom, b.bottom) + pad;
  }
  _markerAt(x, y) {
    const m = document.getElementById('marker');
    if (!m || !m.classList.contains('on')) return false;
    const r = (m.querySelector('.mk-dia') || m).getBoundingClientRect();
    return Math.hypot(r.left + r.width / 2 - x, r.top + r.height / 2 - y) < PICK_PX * this.sc;
  }

  _zone() {
    const W = innerWidth, H = innerHeight, sa = this.safe, land = W >= H;
    return { x0: sa.l + 24, x1: W * (land ? 0.45 : 0.55), y0: H * (land ? 0.3 : 0.55), y1: H - sa.b - 8 };
  }
  _inZone(x, y) { const z = this._zone(); return x >= z.x0 && x <= z.x1 && y >= z.y0 && y <= z.y1; }

  _ckMove(f) {
    f.fx += (f.x - f.fx) * 0.35;
    f.fy += (f.y - f.fy) * 0.35;
    const sx = f.fx - f.px, sy = f.fy - f.py;
    if (Math.hypot(sx, sy) < 3) return;
    const h = Math.atan2(sy, sx);
    if (f.h !== null) {
      const d = wrap(h - f.h);
      if (Math.abs(d) < 60 * DEG$4) { this.G.crankInput += d; if (d > 0) this.ckSum += d; }
    }
    f.h = h; f.px = f.fx; f.py = f.fy;
  }

  _rub(p, x, y) {
    if (this.G.state !== 'clean' || !this.api.cleaning()) return;
    const sx = x - p.ax, sy = y - p.ay, l = Math.hypot(sx, sy);
    if (l < 3) return;
    const ux = sx / l, uy = sy / l;
    if (p.dir && ux * p.dx + uy * p.dy < -0.5) {
      const t = now();
      if (p.run >= 12 && t - p.tick >= 100) { this.buzz('rub'); p.tick = t; }
      p.run = 0;
    }
    p.dir = true; p.dx = ux; p.dy = uy; p.run += l; p.ax = x; p.ay = y;
  }

  _press(name, id, el) {
    this.holds.set(id, name);
    if (el) el.classList.add('down');
    this.buzz('button');
    this.player.lastInput = now();
    if (name === 'jump') { this.hold.Space = true; this.used.jump = true; }
    else if (name === 'face') { this.hold.F = true; this.used.face = true; }
    else if (name === 'leave') this.api.leave();
    else if (name === 'sonar') { this._eatClick = now(); this.api.sonar(); }
    this._keys();
  }
  _release(id) {
    const name = this.holds.get(id);
    if (!name) return false;
    this.holds.delete(id);
    const el = this.btn && this.btn[name];
    if (el) el.classList.remove('down');
    if (name === 'jump') this.hold.Space = false;
    else if (name === 'face') this.hold.F = false;
    this._keys();
    return true;
  }

  _held(name) {
    for (const n of this.holds.values()) if (n === name) return true;
    return false;
  }

  _keys() {
    const k = this.player.keys, c = this._k, s = this.stick;
    if (c.obj !== k) { c.obj = k; c.W = c.S = c.Space = c.F = false; }
    const W = s.on && s.fwd > 0, S = s.on && s.fwd < 0, Sp = this.hold.Space, F = this.hold.F || this.faceT > 0;
    if (W !== c.W) { k.KeyW = W; c.W = W; }
    if (S !== c.S) { k.KeyS = S; c.S = S; }
    if (Sp !== c.Space) { k.Space = Sp; c.Space = Sp; }
    if (F !== c.F) { k.KeyF = F; c.F = F; }
  }

  update(dt) {
    if (!this.live) return;
    const G = this.G, st = G.state;
    if (this._dirty) { this._dirty = false; this._measure(); }
    const W = innerWidth, H = innerHeight;
    FRAME.floor = this.mode && H > W && W <= 720 ? 1 - (this.safe.b + FLOOR_PX * this.sc) / Math.max(1, H) : 0;
    if (st !== this._st) this._state(this._st, st);
    if (G.paused && (this.fingers.size || this.holds.size)) this.releaseAll();
    if (this.faceT > 0) this.faceT = Math.max(0, this.faceT - dt);
    if (this.ghostT > 0) this.ghostT = Math.max(0, this.ghostT - dt);
    this._stickOut();
    this._keys();
    if (this.mode) this._draw();
    if (this.gesture) this._watch();
  }

  _state(prev, s) {
    this._st = s;
    if (s !== 'explore' && s !== 'dive') {
      for (const f of this.fingers.values()) if (f.role === 'stick' || f.role === 'look') f.role = null;
      this.stickF = null;
    }
    if (prev === 'crank' && s !== 'crank') {
      for (const f of this.fingers.values()) if (f.role === 'crank') f.role = null;
      if (this._ckHold) { this.G.hold = false; this._ckHold = false; }
    }
    for (const id of [...this.holds.keys()]) this._release(id);
    if (s === 'clean') for (const f of [...this.fingers.values()]) if (f.role === 'rub') this._toBrush(f);
    this.faceT = 0;
    if (s === 'explore' && this.mode && this.api.aimCentre) this.api.aimCentre();
  }

  _resized() {
    if (!this.live) return;
    this._dirty = true;
    this._dirtyDial = true;
    const land = innerWidth >= innerHeight;
    if (land !== this._land) {
      this._land = land;
      if (this.fingers.size || this.holds.size) { this.releaseAll(); this.ghostT = 3; }
    }
  }

  _measure() {
    const cs = this._probe ? getComputedStyle(this._probe) : null;
    if (cs) this.safe = { t: parseFloat(cs.paddingTop) || 0, r: parseFloat(cs.paddingRight) || 0, b: parseFloat(cs.paddingBottom) || 0, l: parseFloat(cs.paddingLeft) || 0 };
    this.sc = Math.min(innerWidth, innerHeight) > 500 ? 1.15 : 1;
    this.R = R0 * this.sc;
    const rs = document.documentElement.style;
    rs.setProperty('--tk', String(this.sc));
    rs.setProperty('--ci', this.sc > 1 ? '16px' : '0px');
    if (this.pad) this.pad.style.setProperty('--R', `${this.R}px`);
  }

  _draw() {
    const G = this.G, st = G.state, api = this.api, P = this.player, e = this.UI.e || {};
    const hud = !!(e.hud && e.hud.classList.contains('in'));
    const play = st === 'explore' && hud && P.enabled && !api.busy();
    const reach = play && api.canBrush();
    if (reach && !this._on.brushReach) this.buzz('reach');
    this._on.brushReach = reach;
    const cleaning = st === 'clean' && api.cleaning();
    this._show('jump', play);
    this._show('face', play && (api.faceable() || this._held('face') || this.faceT > 0));
    this._show('leave', cleaning);
    if (e.ui) this._flag(e.ui, 'tx', st === 'explore');
    this._flag(this.btn.jump, 'used', this.used.jump);
    this._flag(this.btn.face, 'used', this.used.face);
    if (e.sonarBtn) this._flag(e.sonarBtn, 'used', !!G.sonarUsed);
    this._drawStick(play || st === 'dive', play);
    this._drawJump();
    this._drawCrank(st === 'crank');
  }
  _show(name, on) {
    const el = this.btn[name];
    if (el && this._on[name] !== on) {
      this._on[name] = on;
      el.classList.toggle('on', on);
      this.UI.hudDirty = true;
      if (on && this.UI.factUp && this.UI.factUp()) this.G.fitT = 0;
    }
  }
  _flag(el, cls, on) {
    if (el && el.classList.contains(cls) !== on) el.classList.toggle(cls, on);
  }

  _drawStick(allowed, play) {
    const el = this.el.stick, f = this.stickF, c = this._sd || (this._sd = { mode: '', x: NaN, y: NaN, kx: NaN, ky: NaN, a: NaN });
    let mode = '', bx = c.x, by = c.y, kx = 0, ky = 0, a = NaN;
    const R = this.R;
    if (f && allowed) {
      mode = 'on';
      bx = f.bx; by = f.by;
      const dx = f.x - bx, dy = f.y - by, L = Math.hypot(dx, dy), k = L > R ? R / L : 1;
      kx = dx * k; ky = dy * k;
      if (this.stick.on) a = Math.atan2(dx, -dy);
    } else if (play && (!this.stickUsed || this.ghostT > 0 || (this.player.idleSeconds && this.player.idleSeconds() > 8))) {
      mode = 'ghost';
      bx = this.safe.l + 24 + R + 16;
      by = innerHeight - this.safe.b - R - 28;
    }
    if (mode !== c.mode) {
      c.mode = mode;
      el.classList.toggle('on', mode === 'on');
      el.classList.toggle('ghost', mode === 'ghost');
    }
    if (!mode) return;
    const x = Math.round(bx * 2) / 2, y = Math.round(by * 2) / 2;
    if (x !== c.x || y !== c.y) { c.x = x; c.y = y; el.style.transform = `translate3d(${x - R}px, ${y - R}px, 0)`; }
    kx = Math.round(kx * 2) / 2; ky = Math.round(ky * 2) / 2;
    if (kx !== c.kx || ky !== c.ky) { c.kx = kx; c.ky = ky; this.el.knob.style.transform = `translate3d(${kx}px, ${ky}px, 0)`; }
    const ar = Number.isFinite(a) ? Math.round(a / DEG$4) : NaN;
    if (ar !== c.a && !(Number.isNaN(ar) && Number.isNaN(c.a))) {
      c.a = ar;
      this.el.chev.style.opacity = Number.isFinite(ar) ? '1' : '0';
      if (Number.isFinite(ar)) this.el.chev.style.transform = `rotate(${ar}deg)`;
    }
  }

  _drawJump() {
    const P = this.player, sp = P._sp, c = this._jd || (this._jd = { q: -1, lvl: -1, fl: null });
    let q = 0, lvl = 0;
    const fl = this.hold.Space && P.valve > 0;
    if (this.hold.Space && sp && sp.down) {
      if (fl && sp.closeT >= 0) {
        const ft = P.clock - sp.closeT;
        q = clamp$6(ft / BLOWUP_T, 0, 1);
        lvl = ft >= BLOWUP_T ? 2 : ft >= 3 ? 1 : 0;
      } else q = clamp$6((P.clock - sp.t0) / VALVE_HOLD, 0, 1);
    }
    q = Math.round(q * 100) / 100;
    if (q !== c.q) { c.q = q; this.el.jumpArc.style.strokeDashoffset = (ARC_C * (1 - q)).toFixed(1); }
    if (lvl !== c.lvl) { c.lvl = lvl; this.btn.jump.classList.toggle('warm', lvl === 1); this.btn.jump.classList.toggle('hot', lvl === 2); }
    if (fl !== c.fl) { c.fl = fl; this.btn.jump.classList.toggle('float', fl); }
  }

  _drawCrank(on) {
    const G = this.G, el = this.el.ck, c = this._cd || (this._cd = { on: null, x: NaN, y: NaN, fol: null, a: NaN });
    if (this.ckSum >= 2 * Math.PI) this.ckDone = true;
    const gripped = G.ckGrip === undefined || G.ckGrip > 0.6;
    const f = on ? this._role('crank') : null;
    const show = on && gripped && !this.ckDone && !!f;
    if (show !== c.on) { c.on = show; el.classList.toggle('on', show); }
    if (!show) return;
    const x = Math.round(f.cx), y = Math.round(f.cy), a = Math.round(Math.atan2(f.x - f.cx, -(f.y - f.cy)) / DEG$4);
    if (x !== c.x || y !== c.y) { c.x = x; c.y = y; el.style.transform = `translate3d(${x}px, ${y}px, 0)`; }
    const fol = !!f;
    if (fol !== c.fol) { c.fol = fol; el.classList.toggle('follow', fol); if (!fol) this.el.ckArm.style.transform = ''; }
    if (fol && a !== c.a) { c.a = a; this.el.ckArm.style.transform = `rotate(${a}deg)`; }
  }

  _dialAt() {
    if (this._dial && !this._dirtyDial) return true;
    const el = document.querySelector('.ck-dial'), b = el && el.getBoundingClientRect();
    if (!b || !(b.width > 0)) return false;
    this._dial = { x: b.left + b.width / 2, y: b.top + b.height / 2 };
    this._dirtyDial = false;
    return true;
  }

  buzz(name) {
    if (!this.mode || !this.gesture) return;
    const p = HAPTIC[name];
    if (p == null) return;
    const mute = document.getElementById('mute');
    if (mute && mute.getAttribute('aria-pressed') === 'true') return;
    const t = now();
    if (typeof p === 'number' && t - this._lastBuzz < 60 && this._lastName !== 'button') return;
    this._lastBuzz = t;
    this._lastName = name;
    this.buzzLog.push(name);
    if (this.buzzLog.length > 40) this.buzzLog.shift();
    try { if (typeof navigator.vibrate === 'function') navigator.vibrate(p); } catch (err) {  }
  }

  _watch() {
    const G = this.G, P = this.player, w = this._w, api = this.api;
    if (G.sonarCD > w.cd + 3) this.buzz('sonar');
    w.cd = G.sonarCD;
    const valve = P.valve > 0;
    if (valve && !w.valve) this.buzz('float');
    w.valve = valve;
    const blow = P.blowup > 0.02;
    if (blow && !w.blow) this.buzz('blowup');
    w.blow = blow;
    if (G.knockAt && G.knockAt !== w.knock) { if (w.knock) this.buzz('knock'); w.knock = G.knockAt; }
    if (!w.knock && G.knockAt) w.knock = G.knockAt;
    const aw = G.airWarn || 0;
    if (aw > w.air) this.buzz(aw === 2 ? 'air30' : aw === 3 ? 'air15' : aw > 3 ? 'hauled' : '');
    w.air = aw;
    const o = G.state === 'clean' ? G.closeup : null;
    if (o) {
      const tenth = Math.floor(clamp$6(api.cleanFrac(), 0, 1) * 10);
      if (tenth > w.tenth && tenth < 10) this.buzz('tenth');
      w.tenth = tenth;
      if (o.uncovered && !w.unc) this.buzz('clear');
      w.unc = !!o.uncovered;
    } else { w.tenth = 0; w.unc = false; }
    const pz = G.puzzle;
    if (pz) {
      if (pz.held && pz.held !== w.held) this.buzz('lift');
      w.held = pz.held;
      if (pz.held && pz.hover >= 0 && pz.hover !== w.hover) this.buzz('align');
      w.hover = pz.hover;
    }
    const miss = G.misses || 0;
    if (miss > w.miss) this.buzz('wrong');
    w.miss = miss;
    const ws = api.wheels();
    let fit = 0;
    if (ws) for (let i = 0; i < ws.length; i++) if (ws[i] && ws[i].fitted && ws[i].state === 'off') fit++;
    if (fit > w.fit) this.buzz('seat');
    w.fit = fit;
    if (G.state === 'crank') {
      const y = Math.floor((G.months || 0) / YEAR);
      if (y > w.year) this.buzz('year');
      w.year = y;
      if (G.arrived && !w.arr) this.buzz('saros');
      w.arr = !!G.arrived;
    }
  }

  onDive() {
    this._dived = true;
    if (!this.mode) return;
    this._wake();
    if (!this.coarse || !document.fullscreenEnabled || document.fullscreenElement || window.__akNoFs) return;
    try {
      const p = document.documentElement.requestFullscreen({ navigationUI: 'hide' });
      if (p && p.then) {
        p.then(() => {
          try {
            const o = screen.orientation, up = matchMedia('(orientation: portrait)').matches;
            if (o && o.lock) o.lock(up ? 'portrait' : 'landscape').catch(() => {});
          } catch (err) {  }
        }, () => {});
      }
    } catch (err) {  }
  }
  _wake() {
    if (!this.mode || this._wakeLock || !navigator.wakeLock || !navigator.wakeLock.request) return;
    navigator.wakeLock.request('screen').then((l) => {
      this._wakeLock = l;
      if (l && l.addEventListener) l.addEventListener('release', () => { if (this._wakeLock === l) this._wakeLock = null; });
    }, () => {});
  }
  _sleep() {
    const l = this._wakeLock;
    this._wakeLock = null;
    if (l) try { l.release(); } catch (err) {  }
  }

  _build() {
    if (this.live) return;
    this.live = true;
    const pad = (this.pad = document.createElement('section'));
    pad.id = 'pad';
    pad.setAttribute('aria-label', 'Touch controls');
    const stick = document.createElement('div');
    stick.id = 'stick';
    stick.setAttribute('aria-hidden', 'true');
    stick.innerHTML = '<span class="st-ring"></span><span class="st-chev"><i></i></span><span class="st-knob"></span><span class="st-lbl">Walk</span>';
    const ck = document.createElement('div');
    ck.id = 'crankGuide';
    ck.setAttribute('aria-hidden', 'true');
    ck.innerHTML = '<span class="cg-ring"></span><span class="cg-arm"><span class="cg-dot"></span></span>';
    pad.append(stick, ck);
    const disc = (id, name, label, icon) => {
      const b = document.createElement('button');
      b.id = id;
      b.type = 'button';
      b.className = 'tb interactive';
      b.setAttribute('aria-label', label);
      const ring = svgEl('svg', { viewBox: '0 0 64 64', class: 'tb-ring', 'aria-hidden': 'true', focusable: 'false' });
      ring.append(svgEl('circle', { class: 'tb-bg', cx: 32, cy: 32, r: 30 }), svgEl('circle', { class: 'tb-arc', cx: 32, cy: 32, r: 30, transform: 'rotate(-90 32 32)' }));
      const lbl = document.createElement('span');
      lbl.className = 'tb-lbl';
      lbl.textContent = label;
      b.append(ring, touchIcon(icon, 'ic'), lbl);
      pad.append(b);
      this._bind(b, name);
      return b;
    };
    this.btn = {
      jump: disc('jumpBtn', 'jump', 'Jump', 'JUMP'),
      face: disc('faceBtn', 'face', 'Face', 'FACE'),
    };
    this.btn.jump.querySelector('.ic').append(
      svgEl('circle', { class: 'bub', cx: 7.5, cy: 7, r: 1.6 }), svgEl('circle', { class: 'bub', cx: 16.8, cy: 5, r: 1.2 }));
    const leave = document.createElement('button');
    leave.id = 'leaveBtn';
    leave.type = 'button';
    leave.className = 'pill interactive';
    leave.append(touchIcon('LEAVE', 'ic'), document.createTextNode('Leave'));
    pad.append(leave);
    this._bind(leave, 'leave');
    this.btn.leave = leave;
    this.el = {
      stick, knob: stick.querySelector('.st-knob'), chev: stick.querySelector('.st-chev'),
      ck, ckArm: ck.querySelector('.cg-arm'), jumpArc: this.btn.jump.querySelector('.tb-arc'),
    };
    const hud = document.getElementById('hud'), ui = document.getElementById('ui');
    if (hud && hud.parentNode) hud.after(pad); else if (ui) ui.append(pad); else document.body.append(pad);
    const sb = document.getElementById('sonarBtn');
    if (sb) sb.addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch') this._press('sonar', e.pointerId, sb); });
    this.btn.sonar = sb;
    const fs = document.getElementById('fs');
    if (fs && !document.fullscreenEnabled) fs.hidden = true;
    const probe = (this._probe = document.createElement('div'));
    probe.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;' +
      'padding:var(--safe-t,0px) var(--safe-r,0px) var(--safe-b,0px) var(--safe-l,0px)';
    document.body.append(probe);
    this._measure();
    const pd = (e) => e.preventDefault();
    document.addEventListener('gesturestart', pd, { passive: false });
    document.addEventListener('gesturechange', pd, { passive: false });
    document.addEventListener('dblclick', pd, { passive: false });
    document.addEventListener('selectstart', pd);
    document.addEventListener('contextmenu', (e) => { if (this.mode && this.G.state !== 'title') e.preventDefault(); });
  }
  _bind(el, name) {
    el.addEventListener('pointerdown', (e) => {
      if (e.button > 0) return;
      e.preventDefault();
      this._press(name, e.pointerId, el);
    });
    el.addEventListener('pointerup', (e) => { if (e.pointerType !== 'touch') this._release(e.pointerId); });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }
}

