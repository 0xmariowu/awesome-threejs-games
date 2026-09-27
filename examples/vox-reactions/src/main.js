import { tr } from './i18n.js';
import { ELEMENTS } from '../original/elements.js';
import { ReactionSession, AVAILABLE, BASE_DAMAGE } from './session.js';

const $ = selector => document.querySelector(selector);
const canvas = $('#world'), ctx = canvas.getContext('2d');
const names = { fire: tr({ zh: "火", en: "Fire" }), water: tr({ zh: "水", en: "Water" }), ice: tr({ zh: "冰", en: "Ice" }), lightning: tr({ zh: "雷", en: "Lightning" }), earth: tr({ zh: "岩", en: "Earth" }), arcane: tr({ zh: "奥术", en: "Arcane" }) };
const reactions = {
  Vaporize: tr({ zh: "蒸发", en: "Vaporize" }), Melt: tr({ zh: "融化", en: "Melt" }), Overload: tr({ zh: "超载", en: "Overload" }), 'Molten Rupture': tr({ zh: "熔岩破裂", en: "Molten Rupture" }),
  Frozen: tr({ zh: "冻结", en: "Frozen" }), 'Electro-Charged': tr({ zh: "感电", en: "Electro-Charged" }), Quagmire: tr({ zh: "泥沼", en: "Quagmire" }), Superconduct: tr({ zh: "超导", en: "Superconduct" }),
  'Crystal Shatter': tr({ zh: "结晶破碎", en: "Crystal Shatter" }), 'Magnetic Crush': tr({ zh: "磁力压碎", en: "Magnetic Crush" }), Resonance: tr({ zh: "共鸣", en: "Resonance" }), Shatter: tr({ zh: "击碎", en: "Shatter" }),
};
const colors = Object.fromEntries(AVAILABLE.map(el => [el, `#${ELEMENTS[el].color.toString(16).padStart(6, '0')}`]));
let selected = 'fire', paused = false, held = false, cooldown = 0, particles = [];
let width = 1, height = 1, last = performance.now(), accumulator = 0;
const session = new ReactionSession((kind, args) => {
  if (kind === 'damage') {
    const event = args[0];
    particles = particles.filter(p => p.kind !== 'number');
    particles.push({ kind: 'number', color: event.color || colors[event.element] || '#ffffff',
      text: `−${event.damage.toFixed(1)}`, age: 0, life: 1.2, dot: event.dot });
  } else if (kind === 'explosion' || kind === 'ring' || kind === 'bolt') {
    const color = kind === 'explosion' ? colors[args[0]] : `#${args[kind === 'ring' ? 1 : 2].getHexString()}`;
    particles.push({ kind: kind === 'bolt' ? 'bolt' : 'ring', color: color || '#eeeeee', age: 0, life: 0.7 });
  }
  particles = particles.slice(-60);
});

function cast() {
  if (session.cast(selected)) {
    particles.push({ kind: 'shot', color: colors[selected], age: 0, life: 0.25 });
    cooldown = 0.28;
  }
  updateUI();
}
for (const el of AVAILABLE) {
  const button = document.createElement('button');
  button.textContent = names[el]; button.dataset.element = el;
  button.style.setProperty('--element', colors[el]);
  button.addEventListener('click', () => { selected = el; updateUI(); });
  $('#elements').append(button);
}
$('#pause').addEventListener('click', () => { paused = !paused; accumulator = 0; updateUI(); });
$('#reset').addEventListener('click', () => { held = false; cooldown = 0; particles = []; session.reset(); updateUI(); });
canvas.addEventListener('pointerdown', event => {
  if (event.button !== 0) return;
  event.preventDefault(); canvas.focus(); canvas.setPointerCapture(event.pointerId);
  held = true; cast();
});
for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) canvas.addEventListener(name, () => { held = false; });
canvas.addEventListener('keydown', event => {
  if (event.code === 'Space') { event.preventDefault(); if (!event.repeat) { held = true; cast(); } }
});
canvas.addEventListener('keyup', event => { if (event.code === 'Space') held = false; });
canvas.addEventListener('blur', () => { held = false; });
window.addEventListener('blur', () => { held = false; });
document.addEventListener('visibilitychange', () => { held = false; accumulator = 0; last = performance.now(); });

function statusText() {
  const t = session.target, parts = [];
  if (!t.alive) return tr({ zh: "靶子已击倒 · 点击重置", en: "Target down · Click reset" });
  if (t.aura) parts.push(tr({ zh: `${names[t.aura.el]}附着 ${t.aura.t.toFixed(1)}秒`, en: `${names[t.aura.el]} aura ${t.aura.t.toFixed(1)} s` }));
  for (const [field, label] of [['frozen', tr({ zh: "冻结", en: "Frozen" })], ['stun', tr({ zh: "眩晕", en: "Stunned" })], ['defDown', tr({ zh: "易伤", en: "Vulnerable" })], ['mud', tr({ zh: "减速", en: "Slowed" })], ['weaken', tr({ zh: "虚弱", en: "Weakened" })]]) {
    if (t[field] > 0) parts.push(tr({ zh: `${label} ${t[field].toFixed(1)}秒`, en: `${label} ${t[field].toFixed(1)} s` }));
  }
  for (const dot of t.dots) parts.push(tr({ zh: `${dot.el === 'fire' ? tr({ zh: "燃烧", en: "Burning" }) : tr({ zh: "感电", en: "Electro-Charged" })} ${dot.t.toFixed(1)}秒`, en: `${dot.el === 'fire' ? tr({ zh: "燃烧", en: "Burning" }) : tr({ zh: "感电", en: "Electro-Charged" })} ${dot.t.toFixed(1)} s` }));
  return parts.join(' · ') || tr({ zh: "无元素附着", en: "No elemental aura" });
}
function updateUI() {
  for (const button of $('#elements').children) button.setAttribute('aria-pressed', String(button.dataset.element === selected));
  $('#pause').setAttribute('aria-pressed', String(paused));
  $('#pause').textContent = paused ? tr({ zh: "继续时间", en: "Resume time" }) : tr({ zh: "暂停时间", en: "Pause time" });
  const t = session.target, hit = session.lastCast;
  $('#health').textContent = tr({ zh: `训练靶 · ${t.hp.toFixed(1)} / ${t.maxHp}`, en: `Training target · ${t.hp.toFixed(1)} / ${t.maxHp}` });
  $('#health-fill').style.width = `${100 * t.hp / t.maxHp}%`;
  $('#status').textContent = statusText() + (paused ? tr({ zh: ' · 时间已暂停', en: ' · Time paused' }) : '');
  $('#equation').textContent = hit ? `${hit.auraBefore ? names[hit.auraBefore] + tr({ zh: "附着", en: " aura" }) : tr({ zh: "无附着", en: "No aura" })} → ${names[hit.element]}` : tr({ zh: "选择元素，开始施法", en: "Select an element to cast" });
  $('#reaction').textContent = hit ? reactions[hit.reaction] || tr({ zh: "元素命中", en: "Elemental hit" }) : tr({ zh: "等待命中", en: "Waiting for a hit" });
  $('#reaction').style.color = hit?.color || 'var(--ui-ink)';
  $('#damage').textContent = hit ? tr({ zh: `${BASE_DAMAGE} × ${(hit.damage / BASE_DAMAGE).toFixed(2)} = ${hit.damage.toFixed(1)} 伤害`, en: `${BASE_DAMAGE} × ${(hit.damage / BASE_DAMAGE).toFixed(2)} = ${hit.damage.toFixed(1)} damage` }) : tr({ zh: "基础伤害 22", en: "Base damage 22" });
  const events = session.hits.slice(-4).reverse();
  $('#history').replaceChildren(...events.map(event => {
    const li = document.createElement('li');
    li.textContent = `${event.dot ? tr({ zh: "持续伤害", en: "Damage over time" }) : reactions[event.reaction] || names[event.element] + tr({ zh: "命中", en: " hit" })}  −${event.damage.toFixed(1)}`;
    return li;
  }));
}

function resize() {
  const rect = canvas.getBoundingClientRect();
  width = rect.width; height = rect.height;
  const ratio = Math.min(devicePixelRatio, 2);
  canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
}
new ResizeObserver(resize).observe(canvas);
function ellipse(x, y, rx, ry, color) {
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.strokeStyle = color; ctx.stroke();
}
function draw(now, dt) {
  ctx.clearRect(0, 0, width, height);
  const x = width * 0.68, y = height * 0.61, scale = Math.min(height / 360, width / 900);
  const color = session.target.aura ? colors[session.target.aura.el] : '#90a8a8';
  ctx.lineWidth = 1;
  for (let row = 0; row < 6; row++) ellipse(x, height * 0.91, (110 + row * 90) * scale, (22 + row * 19) * scale, '#24353d');
  ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
  // A stationary training effigy; combat state controls its aura, ice and damage effects.
  ctx.fillStyle = '#080e12'; ctx.beginPath(); ctx.ellipse(0, 85, 75, 15, 0, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = session.target.alive ? 1 : 0.35;
  ctx.strokeStyle = '#6c858a'; ctx.lineWidth = 2;
  ctx.fillStyle = '#34484e'; ctx.fillRect(-42, -30, 84, 76); ctx.strokeRect(-42, -30, 84, 76);
  ctx.fillStyle = '#26373e'; ctx.fillRect(-62, -26, 17, 57); ctx.fillRect(45, -26, 17, 57);
  ctx.fillRect(-32, 49, 23, 36); ctx.fillRect(9, 49, 23, 36);
  ctx.fillStyle = '#577077'; ctx.fillRect(-26, -86, 52, 49); ctx.strokeRect(-26, -86, 52, 49);
  ctx.fillStyle = color; ctx.fillRect(-17, -66, 10, 4); ctx.fillRect(7, -66, 10, 4);
  ctx.font = '28px system-ui'; ctx.textAlign = 'center';
  if (session.target.aura) { ctx.lineWidth = 2; ellipse(0, 0, 88, 111, color); }
  if (session.target.frozen > 0) {
    ctx.beginPath(); ctx.moveTo(-74, 63); ctx.lineTo(-55, -95); ctx.lineTo(0, -123); ctx.lineTo(58, -84); ctx.lineTo(74, 63); ctx.closePath();
    ctx.fillStyle = '#7fe6ff35'; ctx.fill(); ctx.strokeStyle = '#a4e9ff'; ctx.lineWidth = 3; ctx.stroke();
  }
  for (const dot of session.target.dots) {
    ctx.strokeStyle = colors[dot.el]; ctx.lineWidth = 3;
    if (dot.el === 'fire') {
      for (let i = 0; i < 7; i++) {
        const dx = -65 + i * 22, rise = 15 * Math.sin(now / 150 + i);
        ctx.beginPath(); ctx.moveTo(dx - 8, 68); ctx.lineTo(dx - 3, 30 + rise); ctx.lineTo(dx + 4, 48); ctx.lineTo(dx + 9, 68); ctx.stroke();
      }
    } else {
      ctx.beginPath(); ctx.moveTo(-77, -70); ctx.lineTo(-92, -25); ctx.lineTo(-70, -28); ctx.lineTo(-85, 20); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(77, -30); ctx.lineTo(92, 15); ctx.lineTo(70, 12); ctx.lineTo(85, 60); ctx.stroke();
    }
  }
  ctx.restore();
  // Casting point and a brief beam connect real input to the target.
  ellipse(width * 0.25, height * 0.60, 22 * scale, 22 * scale, colors[selected]);
  for (const p of particles) {
    p.age += dt; const t = p.age / p.life;
    ctx.globalAlpha = Math.max(0, 1 - t); ctx.strokeStyle = p.color; ctx.fillStyle = p.color; ctx.lineWidth = 2;
    if (p.kind === 'shot') {
      ctx.beginPath(); ctx.moveTo(width * 0.25, height * 0.6); ctx.lineTo(x, y); ctx.stroke();
    } else if (p.kind === 'number') {
      ctx.font = `${(p.dot ? 20 : 32) * scale}px system-ui`; ctx.textAlign = 'center';
      // Damage is reported in the controls.
    } else if (p.kind === 'ring') ellipse(x, y, (60 + t * 120) * scale, (65 + t * 100) * scale, p.color);
    else { ctx.beginPath(); ctx.moveTo(x - 75 * scale, y - 90 * scale); ctx.lineTo(x, y); ctx.lineTo(x + 80 * scale, y - 65 * scale); ctx.stroke(); }
  }
  particles = particles.filter(p => p.age < p.life); ctx.globalAlpha = 1;
}
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.1); last = now;
  cooldown -= dt;
  if (held && cooldown <= 0) cast();
  if (!paused && !document.hidden) {
    accumulator += dt;
    while (accumulator >= 1 / 60) { session.step(1 / 60); accumulator -= 1 / 60; }
  }
  updateUI(); draw(now, dt); requestAnimationFrame(frame);
}
Object.defineProperty(window, '__example', { get: () => ({ ...session.snapshot(), selected, paused }) });
updateUI(); resize(); requestAnimationFrame(frame);
