import { Simulation, type Upgrade, type Creature, type GameEvent, type Vec, SPECIES, distance } from './simulation';

export const icons = {
  pause: '<svg viewBox="0 0 24 24"><path d="M8 5v14M16 5v14"/></svg>',
  sound: '<svg viewBox="0 0 24 24"><path d="m11 5-5 4H3v6h3l5 4V5Zm4 3a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/></svg>',
  mute: '<svg viewBox="0 0 24 24"><path d="m11 5-5 4H3v6h3l5 4V5Zm5 4 5 6m0-6-5 6"/></svg>',
  arrow: '<svg viewBox="0 0 24 24"><path d="M4 12h15m-6-6 6 6-6 6"/></svg>',
  close: '<svg viewBox="0 0 24 24"><path d="m6 6 12 12M18 6 6 18"/></svg>',
  seed: '<svg viewBox="0 0 24 24"><path d="M18 3c-1 8-11 5-11 13 8 3 14-5 11-13Z"/><path d="M5 21c0-7 7-9 10-13"/></svg>',
};

const upgrades: { kind: Upgrade; title: string; text: string; symbol: string }[] = [
  { kind: 'engine', title: 'A fairer wind', text: 'Faster cruising and a livelier boost.', symbol: '01' },
  { kind: 'food', title: 'Sunflower seeds', text: 'More food, faster refills, richer coin rewards.', symbol: '02' },
  { kind: 'magnet', title: 'Coin magnet', text: 'Gather coins from farther away.', symbol: '03' },
  { kind: 'birds', title: 'Lantern birds', text: 'Invite three bright new friends into the garden.', symbol: '04' },
  { kind: 'whale', title: 'A gentle giant', text: 'Welcome another young sky whale.', symbol: '05' },
  { kind: 'restore', title: 'Light the beacon', text: 'Feed or capture 12 creatures, then invite lantern birds.', symbol: '06' },
];

export class Interface {
  readonly dialog: HTMLDialogElement;
  screen: 'intro' | 'playing' = 'intro';
  modal = '';
  private toastTimer = 0;
  private resource: HTMLElement;
  private radar: CanvasRenderingContext2D;
  private nearest?: Creature;
  private canCapture = false;
  private floating: { element: HTMLElement; pos: Vec; born: number }[] = [];
  private reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  constructor(root: HTMLElement, private action: (name: string) => void) {
    root.innerHTML = `
      <header class="hud-top">
        <div class="brand"><h1>Cloudkeep<span class="brand-star">✦</span></h1><p>THE FLOATING GARDENS</p></div>
        <div class="heading-compass" aria-hidden="true"><span class="compass-before">W</span><i></i><span class="compass-north">N</span><i></i><span class="compass-after">E</span><b></b></div>
        <div class="top-actions">
          <div class="currency"><span class="pearl-icon"></span><div><strong id="pearls">0</strong><span>Sky coins</span></div></div>
          <button class="outline" data-action="upgrades">Upgrades</button>
          <button class="icon-button sound-button" data-action="sound" aria-label="Turn sound on" title="Sound">${icons.mute}</button>
          <button class="icon-button" data-action="pause" aria-label="Pause game" title="Pause · Esc">${icons.pause}</button>
        </div>
      </header>
      <section class="intro" aria-labelledby="intro-title">
        <h2 id="intro-title">A little wonder,<br>above the clouds.</h2>
        <p>Take the helm. Discover a living sky.<br>Gather golden coins among the floating gardens.</p>
        <button class="primary start-button" data-action="start" disabled><span id="start-label">Preparing the sky…</span>${icons.arrow}</button>
        <span class="intro-note">A quiet little flying adventure</span>
      </section>
      <div class="capture-target" hidden><svg viewBox="0 0 100 100"><circle class="target-track" cx="50" cy="50" r="43"/><circle class="target-fill" cx="50" cy="50" r="43" pathLength="100"/></svg><small>HOLD Q</small></div><div class="reward-layer" aria-hidden="true"></div>
      <div class="creature-label" hidden><span class="friend-dot"></span><span class="friend-name"></span><small class="friend-state"></small></div>
      <div class="flight-hint" hidden><span class="keyboard-hint">Hold <kbd>Q</kbd> to capture · <kbd>SPACE</kbd> to lure with seeds</span><span class="touch-hint">Drag to steer · Hold Capture near a creature</span></div>
      <footer class="controls-bar"><span><kbd>DRAG</kbd> Steer</span><em></em><span><kbd>W</kbd><kbd>S</kbd> Fly</span><span><kbd>A</kbd><kbd>D</kbd> Strafe</span><em></em><span><kbd>Q</kbd> Capture</span><span><kbd>SPACE</kbd> Lure</span><span><kbd>SHIFT</kbd> Boost</span><span class="secondary-control"><kbd>H</kbd> Guide</span></footer>
      <div class="steering-status"><span class="capture-note">Mouse steering · Esc to release</span><span class="orbit-note">Looking around · C to level & center</span></div>
      <aside class="radar" aria-label="Nearby creatures radar"><div class="radar-circle"><span class="radar-n">N</span><canvas width="300" height="300"></canvas><span class="radar-ship"></span></div><p>Cloud garden</p></aside>
      <div class="food-status" hidden>${icons.seed}<div><span id="food-stock">12</span><small>seeds · refill naturally</small></div><button data-action="help" aria-label="Flight guide" title="Flight guide · H">?</button></div>
      <div class="touch-controls" hidden>
        <div class="dpad"><button data-control="forward" aria-label="Fly forward">↑</button><button data-control="left" aria-label="Strafe left">←</button><button data-control="back" aria-label="Fly backward">↓</button><button data-control="right" aria-label="Strafe right">→</button></div>
        <div class="altitude-pad"><button data-control="up" aria-label="Ascend">Rise</button><button data-control="down" aria-label="Descend">Lower</button><button data-control="boost" aria-label="Boost">Boost</button></div>
        <div class="touch-actions"><button class="touch-capture" data-control="capture" aria-label="Capture creatures"><span class="capture-glyph">✦</span><span>Capture</span></button><button class="touch-feed" data-control="feed" aria-label="Feed creatures">${icons.seed}<span>Lure</span></button></div>
      </div>
      <div id="toast" role="status" aria-live="polite"></div>
      <dialog id="sheet"><div class="sheet-inner"></div></dialog>
      <div class="loading-line"><i></i></div>
    `;
    this.dialog = root.querySelector('dialog')!;
    this.resource = root.querySelector('#pearls')!;
    this.radar = root.querySelector<HTMLCanvasElement>('.radar canvas')!.getContext('2d')!;
    root.addEventListener('click', e => {
      const button = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-action]');
      if (button && !button.disabled) {
        action(button.dataset.action!);
        // Pointer-operated HUD controls return focus to flight. Keyboard users
        // keep button focus so Space/Enter retain their native semantics.
        if (e.detail > 0 && this.screen === 'playing' && !this.dialog.open) button.blur();
      }
    });
    this.dialog.addEventListener('cancel', e => { e.preventDefault(); action('close'); });
    this.dialog.addEventListener('click', e => { if (e.target === this.dialog) action('close'); });
  }

  progress(value: number) { document.querySelector<HTMLElement>('.loading-line i')!.style.width = `${value * 100}%`; }
  ready(hasSave: boolean) {
    document.querySelector<HTMLButtonElement>('.start-button')!.disabled = false;
    document.querySelector('#start-label')!.textContent = hasSave ? 'Continue your flight' : 'Begin flight';
    document.querySelector('.loading-line')!.classList.add('loaded');
  }
  start() {
    this.screen = 'playing'; document.body.classList.add('playing');
    document.querySelector<HTMLElement>('.intro')!.hidden = true;
    for (const selector of ['.food-status', '.touch-controls', '.flight-hint']) document.querySelector<HTMLElement>(selector)!.hidden = false;
    (document.activeElement as HTMLElement)?.blur();
  }
  setSound(enabled: boolean) {
    const button = document.querySelector('.sound-button')!; button.innerHTML = enabled ? icons.sound : icons.mute;
    button.setAttribute('aria-label', enabled ? 'Turn sound off' : 'Turn sound on');
  }
  toast(text: string) {
    const toast = document.querySelector<HTMLElement>('#toast')!;
    toast.textContent = text; toast.classList.add('visible'); clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => toast.classList.remove('visible'), 3200);
  }
  feedback(event: GameEvent) {
    if (event.type !== 'capture' && event.type !== 'collect') return;
    const element = document.createElement('div'); element.className = `reward-number ${event.type}`;
    element.textContent = event.type === 'capture' ? 'Captured!' : `+${event.value}`;
    document.querySelector('.reward-layer')!.append(element);
    this.floating.push({ element, pos: { ...event.pos, y: event.pos.y + 6 }, born: performance.now() });
    if (this.floating.length > 8) this.floating.shift()!.element.remove();
    if (event.type === 'collect' && !this.reduced) this.resource.animate([{ transform: 'scale(1.3)', color: '#cf8d20' }, { transform: 'scale(1)', color: '#234f58' }], { duration: 330, easing: 'ease-out' });
    if (event.type === 'capture') this.toast(`${SPECIES[event.species!].name} captured · ${event.value} coins released`);
  }
  update(game: Simulation) {
    this.resource.textContent = String(game.pearls);
    document.querySelector('#food-stock')!.textContent = String(Math.floor(game.foodStock));
    document.querySelector<HTMLElement>('.flight-hint')!.hidden = this.screen !== 'playing' || game.encounters > 0;
    const north = document.querySelector<HTMLElement>('.compass-north')!;
    const heading = ((-game.yaw * 180 / Math.PI) % 360 + 360) % 360;
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const index = Math.round(heading / 45) % 8;
    north.textContent = directions[index];
    document.querySelector('.compass-before')!.textContent = directions[(index + 6) % 8];
    document.querySelector('.compass-after')!.textContent = directions[(index + 2) % 8];
    this.drawRadar(game);
    const locked = game.creatures.find(c => c.id === game.captureTarget), candidate = game.captureCandidate;
    this.nearest = locked ?? candidate ?? [...game.creatures].sort((a, b) => distance(a.pos, game.pos) - distance(b.pos, game.pos))[0];
    this.canCapture = !!(locked || candidate);
  }
  updateLabel(project: (pos: { x: number; y: number; z: number }) => { x: number; y: number; visible: boolean }) {
    const now = performance.now();
    this.floating = this.floating.filter(item => {
      const age = (now - item.born) / 1300;
      if (age >= 1) { item.element.remove(); return false; }
      const p = project(item.pos);
      item.element.hidden = this.screen !== 'playing' || !!this.modal || !p.visible;
      item.element.style.transform = `translate(${p.x}px,${p.y - (this.reduced ? 0 : age * 42)}px) translate(-50%,-50%)`;
      item.element.style.opacity = String(Math.min(1, (1 - age) * 3));
      return true;
    });
    const el = document.querySelector<HTMLElement>('.creature-label')!;
    const reticle = document.querySelector<HTMLElement>('.capture-target')!;
    if (!this.nearest || this.screen !== 'playing' || this.modal) { el.hidden = true; reticle.hidden = true; return; }
    const c = this.nearest;
    const p = project({ x: c.pos.x, y: c.pos.y + 2.5 * SPECIES[c.species].scale, z: c.pos.z });
    el.hidden = !p.visible; el.style.left = `${p.x}px`; el.style.top = `${p.y}px`;
    el.querySelector('.friend-name')!.textContent = SPECIES[c.species].name;
    const touch = matchMedia('(pointer: coarse)').matches || innerWidth <= 700;
    el.querySelector('.friend-state')!.textContent = c.mode === 'capturing' ? `Capturing · ${Math.round(c.capture * 100)}%` : c.mode === 'flee' ? 'Startled by the engines' : this.canCapture ? touch ? 'Hold Capture' : 'Hold Q to capture' : c.happy > 0 ? 'A happy little friend' : c.mode === 'forage' ? 'Following a seed' : c.mode === 'flock' ? 'Flying with the flock' : 'Wandering the gardens';
    const center = project({ x: c.pos.x, y: c.pos.y + .4, z: c.pos.z });
    reticle.hidden = !this.canCapture || !center.visible;
    reticle.style.left = `${center.x}px`; reticle.style.top = `${center.y}px`;
    reticle.classList.toggle('active', c.mode === 'capturing');
    reticle.querySelector<SVGCircleElement>('.target-fill')!.style.strokeDashoffset = String(100 - c.capture * 100);
    reticle.querySelector('small')!.textContent = c.mode === 'capturing' ? `${Math.round(c.capture * 100)}%` : touch ? 'CAPTURE' : 'HOLD Q';
  }
  private drawRadar(game: Simulation) {
    const ctx = this.radar; ctx.clearRect(0, 0, 300, 300);
    const draw = (x: number, z: number, color: string, size: number) => {
      const dx = x - game.pos.x, dz = z - game.pos.z;
      const px = (dx * Math.cos(game.yaw) - dz * Math.sin(game.yaw)) * 1.6;
      const py = (dx * Math.sin(game.yaw) + dz * Math.cos(game.yaw)) * 1.6;
      if (Math.hypot(px, py) > 130) return;
      ctx.fillStyle = color; ctx.beginPath(); ctx.arc(150 + px, 150 + py, size, 0, Math.PI * 2); ctx.fill();
    };
    const colors = { ray: '#ffffff', whale: '#b4e5f3', bird: '#efb74a', moth: '#ffe1a3', koi: '#f1b99d', jelly: '#b8eed7' };
    game.creatures.forEach(c => draw(c.pos.x, c.pos.z, colors[c.species], c.species === 'whale' ? 6 : 4.5));
    game.drops.forEach(d => draw(d.pos.x, d.pos.z, '#f8c969', 4));
  }
  open(name: string, game: Simulation) {
    this.modal = name;
    const close = `<button class="icon-button sheet-close" data-action="close" aria-label="Close dialog">${icons.close}</button>`;
    let content = '';
    if (name === 'upgrades') {
      content = `<p class="sheet-caption">The keeper's workshop</p><h2>A little room to grow.</h2><p class="sheet-description">Turn your discoveries into a better little airship.</p><div class="shop-balance"><span class="pearl-icon"></span><strong>${game.pearls}</strong> sky coins</div><div class="upgrade-list">${upgrades.map(u => {
        const done = game.purchased(u.kind); const locked = u.kind === 'restore' && (!game.birds || game.encounters < 12);
        const level = ['engine', 'food', 'magnet'].includes(u.kind) ? ` <small>${game.levels[u.kind as 'engine']} / 2</small>` : '';
        return `<div class="upgrade-row"><div><h3>${u.title}${level}</h3><p>${u.text}${u.kind === 'restore' && !done ? ` · ${Math.min(game.encounters, 12)} / 12 encounters` : ''}</p></div><button class="buy-button" data-action="buy:${u.kind}" ${!game.canBuy(u.kind) ? 'disabled' : ''}>${done ? 'Complete' : locked ? 'Not yet' : `${game.price(u.kind)} <span class="mini-pearl"></span>`}</button></div>`;
      }).join('')}</div><p class="sheet-footnote">Upgrades are permanent. Your progress saves automatically.</p>`;
    } else if (name === 'help') {
      content = `<p class="sheet-caption">A keeper's field guide</p><h2>Follow your curiosity.</h2><p class="sheet-description">Face a nearby creature and hold Q. It spirals into your airship, releases gold coins, and returns elsewhere after 9–14 seconds. Fly close to gather the coins.</p><dl class="guide"><div><dt>Drag sky</dt><dd>Turn and pitch the airship · mouse or touch</dd></div><div><dt>W / S</dt><dd>Fly forward / reverse in the direction you face</dd></div><div><dt>A / D</dt><dd>Strafe left / right</dd></div><div><dt>Arrow keys</dt><dd>Turn left / right · pitch up / down</dd></div><div><dt>R / F</dt><dd>Rise / descend vertically</dd></div><div><dt>Right drag</dt><dd>Look around · Alt + drag also works</dd></div><div><dt>Wheel / C</dt><dd>Zoom / center the camera and level the flight direction</dd></div><div><dt>Double-click</dt><dd>Capture the mouse for continuous steering · Esc releases it</dd></div><div><dt>Q</dt><dd>Hold to capture · left click also captures when the mouse is locked</dd></div><div><dt>Space</dt><dd>Release seeds to lure hungry creatures closer</dd></div><div><dt>Shift</dt><dd>Boost while moving</dd></div><div><dt>E / Esc</dt><dd>Upgrades / pause</dd></div></dl><p class="sheet-description">Seeds refill naturally. Creatures wander, flock and look for food. Boosting startles them. Feeding also earns coins and helps creatures grow. On touch screens, hold the Capture and movement buttons together.</p><button class="primary" data-action="close">Back to the sky ${icons.arrow}</button>`;
    } else if (name === 'restart') {
      content = `<p class="sheet-caption">A fresh beginning</p><h2>Start a new sanctuary?</h2><p class="sheet-description">This replaces the progress saved in this browser, including your coins, creatures, and upgrades.</p><div class="modal-actions"><button class="outline" data-action="close">Keep my garden</button><button class="primary" data-action="restart-confirm">Start fresh ${icons.arrow}</button></div>`;
    } else if (name === 'complete') {
      content = `<p class="sheet-caption">Sanctuary restored</p><h2>A light for every wanderer.</h2><p class="sheet-description">The beacon shines again. Your little corner of the sky is alive with friends. Stay a while — there's always someone to feed.</p><div class="completion-stats"><span><strong>${game.encounters}</strong> encounters</span><span><strong>${game.creatures.length}</strong> sky friends</span></div><button class="primary" data-action="close">Keep flying ${icons.arrow}</button>`;
    } else {
      content = `<p class="sheet-caption">A moment in the clouds</p><h2>The sky can wait.</h2><p class="sheet-description">Your sanctuary is paused. Take your time.</p><div class="pause-actions"><button class="primary" data-action="close">Resume flight ${icons.arrow}</button><button class="outline" data-action="help">Flight guide</button><button class="text-button" data-action="restart">Start a new sanctuary</button></div><p class="sheet-footnote">Progress stays in this browser.</p>`;
    }
    this.dialog.querySelector('.sheet-inner')!.innerHTML = close + content;
    if (!this.dialog.open) this.dialog.showModal();
  }
  close() { this.modal = ''; this.dialog.close(); (document.activeElement as HTMLElement)?.blur(); }
  failure(message: string) {
    document.querySelector('#intro-title')!.textContent = 'The sky needs a moment.';
    document.querySelector('.intro > p')!.textContent = message;
    const button = document.querySelector<HTMLButtonElement>('.start-button')!;
    button.disabled = false; button.dataset.action = 'reload'; button.innerHTML = 'Try again';
  }
}
