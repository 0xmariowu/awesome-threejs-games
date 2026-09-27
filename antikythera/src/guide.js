// guide.js
const MOVE = 'Walk';

const COPY = {
  move: MOVE,
  moveLower: MOVE.toLowerCase(),
  controls: [`[W] ${MOVE}`, '[A] [D] Turn', '[Mouse] Look', '[Space] Jump, hold to float'].join(' · '),
  controlsTouch: `[Stick] ${MOVE} · Swipe to look · [Jump] Jump, hold to float`,
  faceTouch: 'Hold [Face] to face the marker',
  nextTouch: [
    'Two more to find. [Sonar] Tap for sonar.',
    'One more to find.',
    'All three are parts of one machine.',
  ],
  wallTouch: 'Hold [Jump] to float up over it',
  puzzleTouch: 'Drag the wheels you discovered into place',
  crankGo: 'Turn clockwise',
  objective: 'Find the three bronze fragments',
  findPrompt: 'Hold [E] to brush',
  findPromptTouch: 'Tap to examine',
  face: 'Hold [F] to face the marker',
  bring: 'Take the wheels to the other fragments',
  facePile: 'Hold [F] to face the marker',
  facePileTouch: 'Hold [Face] to face the marker',
  next: [
    'Two more to find. Press [Q] for sonar.',
    'One more to find.',
    'All three are parts of one machine.',
  ],
  air: [[60, '', 0], [30, '', 0], [15, '', 1]],
};

const MARK_AFTER = 15;
const BEACON_AFTER = 30;
const BEACON_AIR = 45;
const NEXT_MARK = 4;
const IDLE_HINT = 8;
const FACE_HINT = 5;
const HINT_GRACE = 2.5;

function bearing(px, pz, yaw, tx, tz) {
  const dx = tx - px, dz = tz - pz;
  const d = Math.hypot(dx, dz);
  const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
  const rx = Math.cos(yaw), rz = -Math.sin(yaw);
  const a = Math.atan2(dx * rx + dz * rz, dx * fx + dz * fz) * (180 / Math.PI);
  const side = a > 0 ? 'right' : 'left';
  const aa = Math.abs(a);
  const dir = aa < 28 ? 'straight ahead' : aa < 70 ? `ahead, to your ${side}` : aa < 125 ? `off to your ${side}` : 'behind you';
  const m = Math.max(3, Math.round(d / 2) * 2);
  return { dir, dist: d, text: `${dir}, about ${m} metres` };
}

class Guide {
  constructor(UI) {
    this.UI = UI;
    this.said = new Set();
    this.since = 0;
    this.phase = '';
    this.phaseT = 0;
    this.nearT = 0;
    this.idle = 0;
    this.markT = 0;
    this.flags = { marker: false, beacon: null, pulse: false };
    this.line = null;
    this.mine = '';
    this.mineT = 0;
    this.mineAge = 0;
    this.emptyT = 0;
    this.idleAt = -99;
    if (typeof document !== 'undefined') {
      for (const n of document.querySelectorAll('[data-copy]')) {
        const v = COPY[n.dataset.copy];
        if (typeof v === 'string') n.textContent = v;
      }
    }
  }

  say(text, ms = 3000, delay = 0, then = null) { this.line = { t: delay, text, ms, then }; }
  once(id, text, ms, delay = 0, then = null) {
    if (this.said.has(id)) return false;
    this.said.add(id);
    this.say(text, ms, delay, then);
    return true;
  }
  radio() {}
  note() {}

  goal(text, quiet = false) { this.UI.objective(text, quiet); }

  hint(text, secs) {
    const cur = this.UI.c ? this.UI.c.hint : '';
    if (cur && cur !== this.mine) return false;
    this.UI.hint(text);
    this.mine = text;
    this.mineT = secs;
    this.mineAge = 0;
    return true;
  }
  unhint() {
    if (this.mine && (!this.UI.c || this.UI.c.hint === this.mine)) this.UI.hint('');
    this.mine = '';
    this.mineT = 0;
  }

  progress() {
    this.since = 0;
    this.nearT = 0;
    this.flags.marker = false;
    this.flags.beacon = null;
  }

  enter(phase) {
    if (phase !== this.phase) this.hush();
    this.phase = phase;
    this.phaseT = 0;
    this.idle = 0;
    this.progress();
  }

  hush() {
    this.line = null;
    this.faceIn = 0;
    this.unhint();
  }

  event(name, d = {}) {
    switch (name) {
      case 'explore-start':
        this.enter('explore');
        this.goal(COPY.objective, true);
        break;
      case 'sonar':
        this.idle = 0;
        this.since = Math.min(this.since, 8);
        if (d.echo !== false && Number.isFinite(d.dist) && !this.said.has('echo')) {
          this.said.add('echo');
          this.faceIn = Math.min(1.2, (d.delay || 0) + 0.2);
        }
        break;
      case 'near':
        this.since = Math.min(this.since, 10);
        this.unhint();
        break;
      case 'clean-start':
        this.enter('clean');
        break;
      case 'clean-stroke':
        this.idle = 0;
        break;
      case 'discovered':
        this.hush();
        this.phase = 'explore';
        this.progress();
        if (d.n < 3 && d.next) this.markT = NEXT_MARK;
        if (d.n === 3) this.goal(COPY.bring);
        break;
      case 'assemble':
        this.enter('assemble');
        break;
      case 'puzzle':
        this.enter('puzzle');
        this.flags.pulse = false;
        break;
      case 'puzzle-wrong':
        this.idle = Math.max(this.idle, 6);
        break;
      case 'puzzle-right':
        this.flags.pulse = false;
        this.progress();
        break;
      case 'crank':
        this.enter('crank');
        break;
      case 'crank-turn':
        this.idle = 0;
        break;
      case 'eclipse':
        this.enter('eclipse');
        break;
    }
  }

  update(dt, ctx) {
    this.phaseT += dt;
    this.since += dt;
    this.idle += dt;
    if (this.markT > 0) this.markT = Math.max(0, this.markT - dt);
    const f = this.flags, UI = this.UI;
    this.nearNow = !!ctx.near;
    if (ctx.touch !== undefined) this.touch = !!ctx.touch;
    if (this.line) {
      this.line.t -= dt;
      if (this.line.t <= 0) {
        const L = this.line;
        this.line = null;
        UI.story(L.text, { ms: L.ms });
        if (L.then) L.then();
      }
    }
    if (this.faceIn > 0) {
      this.faceIn -= dt;
      if (this.faceIn <= 0) { this.faceIn = 0; if (!this.nearNow) this.hint(this.touch ? COPY.faceTouch : COPY.face, FACE_HINT); }
    }
    if (ctx.state === 'explore') {
      if (ctx.near) this.nearT += dt; else this.nearT = 0;
      if (this.mine) {
        this.mineT -= dt;
        this.mineAge += dt;
        const acted = ((this.mine === COPY.face || this.mine === COPY.faceTouch || this.mine === COPY.facePile || this.mine === COPY.facePileTouch) && ctx.face) ||
          ((this.mine === COPY.controls || this.mine === COPY.controlsTouch) && this.mineAge > HINT_GRACE && ctx.idle != null && ctx.idle < 0.25);
        if (this.mineT <= 0 || acted || ctx.near || (UI.c && UI.c.hint !== this.mine)) this.unhint();
      }
      const cur = UI.c ? UI.c.hint : '';
      this.emptyT = cur ? 0 : this.emptyT + dt;
      const card = !!ctx.touch && !!(UI.factUp && UI.factUp());
      if (ctx.hud !== false && ctx.idle != null && ctx.idle > IDLE_HINT && !ctx.near && !cur && !card && this.emptyT > 3 && this.phaseT - this.idleAt > 20) {
        if (this.hint(ctx.touch ? COPY.controlsTouch : COPY.controls, 30)) this.idleAt = this.phaseT;
      }
      const tgt = ctx.target;
      const tried = ctx.sonarUsed !== false;
      f.marker = !!tgt && !ctx.near && ((this.since > MARK_AFTER && tried) || this.markT > 0);
      const short = !Number.isFinite(ctx.air) || ctx.air < BEACON_AIR;
      if (tgt && !ctx.near && this.since > BEACON_AFTER && short) f.beacon = tgt;
    } else if (ctx.state === 'assemble' && ctx.puzzle) {
      if (this.idle > 10) f.pulse = true;
    }
    return f;
  }
}

