import { tr } from './i18n.js';
import * as T from './three.js';
import createCombat from '../original/combat-DANZZ0C7.js';
import { PlayerImpl } from '../original/player-Dy-PiEeW.js';
import { t as Actor, n as ActorRegistry, r as makeHit } from '../original/Actor-CPc2Vruf.js';
import { i as Rig, t as Animator } from '../original/Animator-CyW8ITDY.js';

const world = document.querySelector('#world');
const scene = new T.Scene();
scene.background = new T.Color('#24353b');
const camera = new T.PerspectiveCamera(39, 16 / 9, .1, 80);
camera.position.set(6.2, 4.8, 7.3);
camera.lookAt(0, .8, .5);
const renderer = new T.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
world.append(renderer.domElement);
scene.add(new T.HemisphereLight(0xe5f5ec, 0x46524c, 2.5));
const sun = new T.DirectionalLight(0xffe6b6, 3);
sun.position.set(-3, 8, 4);
scene.add(sun);
const material = (color, extra = {}) => new T.MeshStandardMaterial({ color, roughness: .8, ...extra });
const teal = material(0x84b8ac), dark = material(0x345853), gold = material(0xd5a760);
function mesh(geometry, mat, parent = scene, position = [0, 0, 0]) {
  const item = new T.Mesh(geometry, mat);
  item.position.set(...position);
  parent.add(item);
  return item;
}
mesh(new T.CylinderGeometry(5.7, 5.7, .14, 80), material(0x425650), scene, [0, -.1, .4]);
for (const radius of [2.7, 4.8]) {
  const ring = mesh(new T.TorusGeometry(radius, .012, 5, 90), material(0x889789), scene, [0, -.02, .4]);
  ring.rotation.x = Math.PI / 2;
}
const model = new T.Group();
scene.add(model);
const joints = {};
function joint(name, parent, x, y, z) {
  const bone = new T.Object3D();
  bone.name = name;
  bone.position.set(x, y, z);
  parent.add(bone);
  joints[name] = bone;
  return bone;
}
// Host geometry uses the original standard hierarchy and bind dimensions (Ut).
const hips = joint('hips', model, 0, .98, 0);
const spine = joint('spine', hips, 0, .13, 0);
const chest = joint('chest', spine, 0, .21, 0);
const neck = joint('neck', chest, 0, .24, 0);
joint('head', neck, 0, .1, 0);
for (const [side, sign] of [['L', 1], ['R', -1]]) {
  const shoulder = joint(`shoulder.${side}`, chest, sign * .09, .192, 0);
  const upper = joint(`upperArm.${side}`, shoulder, sign * .11, 0, 0);
  const fore = joint(`foreArm.${side}`, upper, 0, -.29, 0);
  const hand = joint(`hand.${side}`, fore, 0, -.26, 0);
  joint(`prop.${side}`, hand, 0, -.08, 0);
  const thigh = joint(`thigh.${side}`, hips, sign * .1, -.04, 0);
  const shin = joint(`shin.${side}`, thigh, 0, -.45, 0);
  joint(`foot.${side}`, shin, 0, -.44, 0);
  mesh(new T.CylinderGeometry(.065, .055, .29, 8), teal, upper, [0, -.145, 0]);
  mesh(new T.CylinderGeometry(.052, .045, .26, 8), teal, fore, [0, -.13, 0]);
  mesh(new T.CylinderGeometry(.09, .07, .45, 8), dark, thigh, [0, -.225, 0]);
  mesh(new T.CylinderGeometry(.065, .055, .44, 8), teal, shin, [0, -.22, 0]);
  mesh(new T.BoxGeometry(.13, .09, .25), dark, joints[`foot.${side}`], [0, 0, .06]);
}
mesh(new T.SphereGeometry(.13, 14, 10), teal, joints.head, [0, .045, 0]);
mesh(new T.BoxGeometry(.3, .37, .19), teal, spine, [0, .1, 0]);
mesh(new T.BoxGeometry(.29, .16, .19), dark, hips);
const weapon = new T.Group();
joints['prop.R'].add(weapon);
const shaft = mesh(new T.CylinderGeometry(.024, .024, 2.64, 8), gold, weapon, [0, 0, .7]);
shaft.rotation.x = Math.PI / 2;
mesh(new T.BoxGeometry(.12, .035, .6), material(0xf2df9d, { metalness: .55 }), weapon, [0, 0, 1.72]);
const base = new T.Object3D(), tip = new T.Object3D();
base.position.z = .6; tip.position.z = 2.02;
weapon.add(base, tip);
const rig = new Rig(model, joints);
const animator = new Animator(rig);

const actors = new ActorRegistry();
const actor = actors.add(new Actor('player', 'player'));
actor.position.set(0, 0, -1);
const target = actors.add(new Actor('enemy', 'trainingTarget'));
target.position.set(0, 0, 1.3);
target.maxHealth = target.health = 10000;
target.maxPoise = target.poise = 30;
target.mass = 1000;
const targetRoot = new T.Group();
targetRoot.position.copy(target.position);
scene.add(targetRoot);
const targetMat = material(0xbb8056, { emissive: 0x000000 });
mesh(new T.CylinderGeometry(.36, .46, .18, 20), dark, targetRoot, [0, .09, 0]);
mesh(new T.CylinderGeometry(.055, .07, 1.8, 10), gold, targetRoot, [0, .9, 0]);
mesh(new T.CylinderGeometry(.31, .29, .75, 12), targetMat, targetRoot, [0, 1.18, 0]);
mesh(new T.BoxGeometry(1.05, .09, .09), gold, targetRoot, [0, 1.5, 0]);
mesh(new T.SphereGeometry(.16, 12, 8), gold, targetRoot, [0, 1.8, 0]);
const incoming = mesh(new T.BoxGeometry(.06, .06, 1.8), material(0xf08159), targetRoot, [0, 1.25, -.8]);
incoming.visible = false;

const down = new Set(), pressed = new Set(), released = new Set();
const input = { down: key => down.has(key), pressed: key => pressed.has(key), released: key => released.has(key),
  uiCapture: false, look: { x: 0 }, lookStick: { x: 0 }, device: 'mouse' };
function press(key) { if (key && !down.has(key)) { down.add(key); pressed.add(key); } }
function release(key) { if (key && down.delete(key)) released.add(key); }
world.addEventListener('pointerdown', event => {
  world.focus();
  press(({ 0: 'attack', 2: 'heavy', 4: 'parry' })[event.button]);
});
window.addEventListener('pointerup', event => release(({ 0: 'attack', 2: 'heavy', 4: 'parry' })[event.button]));
world.addEventListener('contextmenu', event => event.preventDefault());
window.addEventListener('keydown', event => {
  if (event.code === 'KeyF' && !event.repeat && document.activeElement === world) { event.preventDefault(); press('parry'); }
});
window.addEventListener('keyup', event => { if (event.code === 'KeyF') release('parry'); });
const clearInput = () => { down.clear(); pressed.clear(); released.clear(); };
window.addEventListener('blur', clearInput);

let elapsed = 0, hitCount = 0, parries = 0, misses = 0, flash = 0, resultUntil = 0;
let helpers = true, timeScale = 1, practice = false, strikeIn = 3, strikes = 0;
const attacks = [], hits = [], listeners = new Map(), extraSystems = [];
const result = document.querySelector('#result');
function announce(text) { result.textContent = text; resultUntil = elapsed + 1.8; }
const events = {
  on(name, callback) { const group = listeners.get(name) ?? []; group.push(callback); listeners.set(name, group); return () => group.splice(group.indexOf(callback), 1); },
  emit(name, event) { for (const callback of listeners.get(name) ?? []) callback(event); },
};
const trails = [];
const direction = new T.Vector3(), midpoint = new T.Vector3(), axis = new T.Vector3(0, 1, 0);
function trail(name, start, end, active, color) {
  if (!active) return;
  const line = mesh(new T.CylinderGeometry(.014, .014, 1, 4), new T.MeshBasicMaterial({ color, transparent: true, opacity: .65, depthWrite: false }));
  direction.copy(end).sub(start);
  line.position.copy(midpoint.copy(start).add(end).multiplyScalar(.5));
  line.scale.y = direction.length();
  line.quaternion.setFromUnitVectors(axis, direction.normalize());
  trails.push({ line, life: .32 });
}
const game = {
  scene, camera, actors, input, events, started: true, ui: { menuOpen: false },
  time: { dt: 1 / 120, elapsed: 0, scale: 1 }, sky: { nightFactor: 0 },
  addSystem: system => extraSystems.push(system),
  physics: { raycast: () => null, groundAt: () => ({ y: 0, surface: 'stone' }) },
  terrain: { heightAt: () => 0, waterHeightAt: () => null }, vegetation: { cut() {} },
  audio: { play() {} }, fx: { trail, emit() {} },
  cameraRig: { fovKick() {}, forwardXZ: out => out.set(0, 0, 1) },
  applyHit(recipient, hit) {
    const outcome = recipient === actor ? combat.interceptPlayerHit(hit) ?? recipient.receiveHit(hit) : recipient.receiveHit(hit);
    events.emit('actor:hit', { target: recipient, hit, outcome });
    if (recipient === target) {
      hitCount++; flash = 1;
      hits.push({ tag: hit.tag, outcome, amount: hit.amount, time: elapsed, attack: attacks.length, velocity: target.velocity.toArray() });
      announce(tr({ zh: `${outcome === 'staggered' ? tr({ zh: "破势", en: "Staggered" }) : tr({ zh: "命中", en: "Hit" })} · ${Math.round(hit.amount)} 伤害`, en: `${outcome === 'staggered' ? tr({ zh: "破势", en: "Staggered" }) : tr({ zh: "命中", en: "Hit" })} · ${Math.round(hit.amount)} damage` }));
    }
    return outcome;
  },
};
// Use the exported original prototype: canAct, beginAction, action handles,
// updateAction, cancelAction, onActionInterrupted, faceYaw and setState remain original.
// Skip only the full-world constructor and cosmetic mount/cloth/fidget services.
const player = Object.create(PlayerImpl.prototype);
Object.assign(player, {
  game, actor, model, rig, animator, body: { grounded: true, gravityScale: 1, waterDepth: 0 },
  control: true, state: 'idle', action: null, respawning: false, coyote: 0,
  dodgeTime: -1, moveIntent: new T.Vector3(), timeScale: 1, thread: 0, maxThread: 100,
  xf: { on: false }, mount: 'hand', swimming: false, locked: false,
  cutRoll() {}, stopFidget() {}, setMount() {}, flickCloth() {}, clothImpulse() {},
  weaponSegment(outBase, outTip) { model.updateMatrixWorld(true); base.getWorldPosition(outBase); tip.getWorldPosition(outTip); },
});
game.player = player;
model.position.copy(actor.position);
const combat = createCombat(game);
game.combat = combat;
events.on('player:attack', event => attacks.push({ ...event, move: combat.cur?.def.id, time: elapsed }));
events.on('player:parry', event => { if (event.success) { parries++; announce(tr({ zh: "招架成功 · 左键反击", en: "Parry success · Left click to riposte" })); } });

const labels = { light1: tr({ zh: "连击 · 一", en: "Combo · 1" }), light2: tr({ zh: "连击 · 二", en: "Combo · 2" }), light3: tr({ zh: "连击 · 三", en: "Combo · 3" }), light4: tr({ zh: "连击 · 四", en: "Combo · 4" }), heavyCharge: tr({ zh: "蓄力", en: "Charging" }), heavy: tr({ zh: "重击", en: "Heavy attack" }), parry: tr({ zh: "招架", en: "Parry" }), deflect: tr({ zh: "弹开", en: "Deflect" }), riposte: tr({ zh: "反击", en: "Riposte" }) };
for (const [id, callback] of Object.entries({
  slow: () => { timeScale = timeScale === 1 ? .25 : 1; return timeScale !== 1; },
  helpers: () => { helpers = !helpers; return helpers; },
  practice: () => { practice = !practice; strikeIn = 3; return practice; },
})) document.getElementById(id).addEventListener('click', event => {
  event.currentTarget.setAttribute('aria-pressed', String(callback())); world.focus();
});
document.querySelector('#reset').addEventListener('click', () => {
  player.cancelAction(); combat.reset(); actor.position.set(0, 0, -1); actor.velocity.set(0, 0, 0); actor.yaw = 0;
  actor.health = actor.maxHealth; actor.alive = true; target.health = target.maxHealth; target.poise = target.maxPoise;
  target.velocity.set(0, 0, 0); strikeIn = 3; clearInput(); world.focus();
});
function step(dt) {
  elapsed += dt; game.time.elapsed = elapsed; game.time.dt = dt;
  if (player.action) player.updateAction(dt, 0, player.moveIntent);
  else actor.velocity.multiplyScalar(Math.exp(-18 * dt));
  actor.position.addScaledVector(actor.velocity, dt);
  model.position.copy(actor.position); model.rotation.y = actor.yaw;
  animator.update(dt); model.updateMatrixWorld(true);
  combat.update(dt); combat.lateUpdate(dt);
  for (const system of extraSystems) system.update(dt);
  pressed.clear(); released.clear();
  if (practice) {
    strikeIn -= dt;
    if (strikeIn <= 0) {
      strikes++;
      const outcome = game.applyHit(actor, makeHit({ source: target, kind: 'melee', amount: 8, stagger: 0,
        dir: new T.Vector3(0, 0, -1), tag: 'practice' }));
      if (outcome !== 'parried') { misses++; announce(tr({ zh: "未挡住 · 下一次看准时机", en: "Missed the parry · Time the next strike" })); }
      // A training fixture never kills the player; no enemy AI or health loop.
      actor.health = actor.maxHealth; actor.alive = true;
      strikeIn = 3;
    }
  }
  incoming.visible = practice && strikeIn < .9;
  incoming.position.z = -.4 - (practice ? Math.max(0, .9 - strikeIn) * 1.25 : 0);
  flash = Math.max(0, flash - dt * 3);
  targetMat.emissive.setRGB(flash * .6, flash * .3, flash * .04);
  targetRoot.rotation.x = Math.sin(flash * 12) * flash * .08;
  for (let i = trails.length - 1; i >= 0; i--) {
    const item = trails[i]; item.life -= dt;
    item.line.visible = helpers; item.line.material.opacity = Math.max(0, item.life * 1.8);
    if (item.life <= 0) { scene.remove(item.line); item.line.geometry.dispose(); item.line.material.dispose(); trails.splice(i, 1); }
  }
}
let snapshot;
Object.defineProperty(window, '__example', { get: () => snapshot });
function updateDisplay() {
  const current = combat.cur, progress = current?.handle?.t ?? 0;
  document.querySelector('#move').textContent = (labels[current?.def.id] ?? tr({ zh: "待机", en: "Idle" }))
    + (timeScale === 1 ? '' : tr({ zh: ' · ¼ 速度', en: ' · ¼ speed' }));
  document.querySelector('#counter').textContent = tr({ zh: `命中 ${hitCount} · 招架 ${parries}`, en: `Hits ${hitCount} · Parries ${parries}` });
  for (const [id, range] of [['active', current?.def.active], ['cancel', current?.def.cancel]]) {
    const element = document.getElementById(id);
    element.style.left = `${(range?.[0] ?? 0) * 100}%`;
    element.style.width = `${range ? Math.max(0, Math.min(1, range[1]) - range[0]) * 100 : 0}%`;
  }
  document.querySelector('#cursor').style.left = `${progress * 100}%`;
  document.querySelector('#cue').textContent = practice ? tr({ zh: `来袭倒计时 ${strikeIn.toFixed(1)} 秒${strikeIn < .25 ? ' · 按 F！' : ''}`, en: `Strike in ${strikeIn.toFixed(1)} s${strikeIn < .25 ? ' · Press F!' : ''}` }) : combat.parrying ? tr({ zh: "招架窗口开启", en: "Parry window open" }) : combat.charging ? tr({ zh: `蓄力 ${combat.chargeLevel} 段`, en: `Charge level ${combat.chargeLevel}` }) : combat.buffer ? tr({ zh: "已缓存输入", en: "Input buffered" }) : player.action?.canCancel() ? tr({ zh: "现在可接下一招", en: "Chain the next move now" }) : tr({ zh: "训练靶就绪", en: "Training target ready" });
  if (elapsed > resultUntil) result.textContent = practice ? tr({ zh: "看准橙色来袭杆 · F 招架", en: "Watch the orange striker · F to parry" }) : tr({ zh: "左键连击 · 右键蓄力", en: "Left click to combo · Right click to charge" });
  snapshot = Object.freeze({ ready: true, time: elapsed, timeScale, helpers, practice, strikeIn, strikes,
    ...combat.debugStats(), progress, canCancel: player.action?.canCancel() ?? false,
    active: current?.def.active ? Object.freeze([...current.def.active]) : null,
    cancel: current?.def.cancel ? Object.freeze([...current.def.cancel]) : null,
    buffer: combat.buffer ? Object.freeze({ ...combat.buffer }) : null,
    parryWindow: combat.parryWindow, riposte: combat.riposte, chargeLevel: combat.chargeLevel,
    hitCount, parries, misses, targetHealth: target.health, targetPoise: target.poise,
    playerPosition: Object.freeze(actor.position.toArray()), bladeTip: Object.freeze(combat.bladeTip.toArray()),
    attacks: Object.freeze(attacks.slice(-32).map(value => Object.freeze({ ...value }))),
    hits: Object.freeze(hits.slice(-32).map(value => Object.freeze({ ...value }))),
  });
}
let previous = performance.now(), accumulator = 0;
document.addEventListener('visibilitychange', () => { previous = performance.now(); accumulator = 0; clearInput(); });
function frame(now) {
  const dt = Math.min(.1, (now - previous) / 1000); previous = now;
  if (!document.hidden) {
    accumulator += dt * timeScale;
    while (accumulator >= 1 / 120) { step(1 / 120); accumulator -= 1 / 120; }
  }
  updateDisplay(); renderer.render(scene, camera); requestAnimationFrame(frame);
}
function resize() {
  camera.aspect = world.clientWidth / world.clientHeight;
  camera.updateProjectionMatrix(); renderer.setSize(world.clientWidth, world.clientHeight);
}
window.addEventListener('resize', resize); resize(); requestAnimationFrame(frame);
