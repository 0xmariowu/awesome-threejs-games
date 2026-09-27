import './style.css';
import { Simulation, type Upgrade } from './simulation';
import { SkyScene } from './scene';
import { Interface } from './ui';
import { Controls } from './input';
import { loadGame, saveGame } from './storage';
import { Soundscape } from './audio';

let game = loadGame() ?? new Simulation();
let ready = false;
let scene: SkyScene;
let accumulator = 0;
let saveClock = 0;
let uiClock = 0;
let warnedStorage = false;
const sound = new Soundscape();
const ui = new Interface(document.querySelector('#app')!, action);
const controls = new Controls(key => {
  if (!ready || ui.screen !== 'playing') return;
  if (key === 'Escape') action(ui.modal ? 'close' : 'pause');
  if (key === 'KeyE') action(ui.modal ? 'close' : 'upgrades');
  if (key === 'KeyH') action(ui.modal ? 'close' : 'help');
});

function persist() {
  if (!saveGame(game) && !warnedStorage) { ui.toast('Browser storage is unavailable. Progress will last for this visit.'); warnedStorage = true; }
}

function action(name: string) {
  if (name === 'reload') { location.reload(); return; }
  if (name === 'sound') { void sound.toggle().then(on => ui.setSound(on)).catch(() => ui.toast('Sound is unavailable in this browser.')); return; }
  if (!ready) return;
  if (name === 'start') {
    ui.start(); controls.enabled = true; persist();
    void sound.start().then(on => ui.setSound(on)).catch(() => ui.toast('Tap Sound to enable audio.'));
    ui.toast(matchMedia('(pointer: coarse)').matches ? 'Drag to steer. Hold Capture near a creature.' : 'Drag to steer · W/S fly · Hold Q to capture · Space to lure');
    return;
  }
  if (name === 'close') { ui.close(); controls.clear(); controls.enabled = ui.screen === 'playing'; return; }
  if (ui.screen !== 'playing') { ui.toast('Begin your flight to visit the workshop.'); return; }
  if (name === 'restart-confirm') {
    game = new Simulation(); accumulator = 0; saveClock = 0;
    scene.resetCamera(); ui.close(); controls.clear(); controls.centerView(); controls.enabled = true;
    ui.update(game); persist(); ui.toast('A fresh sky. A new beginning.'); return;
  }
  if (name.startsWith('buy:')) {
    const kind = name.slice(4) as Upgrade;
    if (game.buy(kind)) {
      persist(); ui.update(game); ui.open(kind === 'restore' ? 'complete' : 'upgrades', game);
      if (kind !== 'restore') ui.toast('A little more magic for your garden.');
    }
    return;
  }
  if (['pause', 'help', 'upgrades', 'restart'].includes(name)) {
    controls.enabled = false; controls.clear(); persist(); ui.open(name, game);
  }
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden && ready && ui.screen === 'playing') { persist(); if (!ui.modal) action('pause'); }
});
window.addEventListener('pagehide', () => { if (ready && ui.screen === 'playing') persist(); });

async function boot() {
  try {
    scene = new SkyScene(document.querySelector('#world')!);
    await scene.load(value => ui.progress(value));
    ready = true; ui.ready(loadGame() !== null); ui.update(game); ui.setSound(sound.enabled);
    let last = performance.now();
    function frame(now: number) {
      const dt = Math.min((now - last) / 1000, .1); last = now;
      const playing = ui.screen === 'playing' && !ui.modal && !document.hidden;
      if (playing) {
        accumulator += dt;
        while (accumulator >= 1 / 60) { game.step(1 / 60, controls.read()); accumulator -= 1 / 60; }
        saveClock += dt;
        if (saveClock > 5) { persist(); saveClock = 0; }
      } else accumulator = 0;
      sound.update(game, playing);
      const events = game.events.splice(0);
      for (const event of events) {
        scene.effect(event); sound.play(event); ui.feedback(event);
      }
      if (events.some(event => ['eat', 'capture', 'respawn', 'collect'].includes(event.type))) { persist(); ui.update(game); }
      uiClock += dt;
      if (uiClock > .08) { ui.update(game); uiClock = 0; }
      scene.render(game, ui.screen === 'intro' ? now / 1000 : game.time, playing || ui.screen === 'intro' ? dt : 0, controls.view);
      ui.updateLabel(pos => scene.project(pos));
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
    // Read-only observability for local development and automated gameplay inspection.
    if (import.meta.env.DEV) Object.defineProperty(window, '__cloudkeep', { get: () => ({ state: game.snapshot(), running: ui.screen === 'playing' && !ui.modal, view: { ...controls.view }, foods: game.foods.length, drops: game.drops.length, capture: { active: game.capturing, target: game.captureTarget, candidate: game.captureCandidate?.id, progress: game.creatures.find(c => c.id === game.captureTarget)?.capture ?? 0 }, creatures: game.creatures.map(c => ({ id: c.id, mode: c.mode, capture: c.capture, spawn: c.spawn })), audio: sound.stats, stats: scene.stats }), configurable: true });
    if (import.meta.env.DEV) Object.defineProperty(window, '__cloudkeepArt', { value: scene, configurable: true });
    if (import.meta.env.DEV) Object.defineProperty(window, '__cloudkeepAudio', { value: sound, configurable: true });
    scene.renderer.domElement.addEventListener('webglcontextlost', event => { event.preventDefault(); action('pause'); ui.toast('The graphics context was interrupted. Reload to continue from your save.'); });
  } catch (error) {
    console.error('Cloudkeep could not start:', error);
    ui.failure('Please use a browser with WebGL 2 enabled, and check that the game assets finished downloading.');
  }
}
void boot();
