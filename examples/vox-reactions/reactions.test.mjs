import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';

// Node's counterpart of the browser import map. No source transformation.
registerHooks({ resolve(specifier, context, nextResolve) {
  return specifier === 'three'
    ? nextResolve(new URL('./original/three.module.js', import.meta.url).href, context)
    : nextResolve(specifier, context);
} });
const { ReactionSession, AVAILABLE } = await import('./src/session.js');
const { applyHit } = await import('./original/combat.js');
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);
function pair(a, b) { const s = new ReactionSession(); s.cast(a); s.cast(b); return s; }

test('directional vaporize damage comes from the original rules', () => {
  const forward = pair('fire', 'water'), reverse = pair('water', 'fire');
  assert.equal(forward.lastCast.reaction, 'Vaporize');
  near(forward.target.hp, 600 - 22 - 44);
  near(reverse.target.hp, 600 - 22 - 33);
  assert.equal(forward.target.aura, null);
});
test('freeze locks action and earth shatters it without a finisher or chain', () => {
  const s = pair('water', 'ice');
  near(s.target.frozen, 3); assert.equal(s.target.canAct(), false);
  near(s.target.hp, 556);
  s.cast('earth');
  assert.equal(s.lastCast.reaction, 'Shatter'); near(s.lastCast.damage, 48.4);
  assert.equal(s.target.frozen, 0); assert.equal(s.target.canAct(), true);
  assert.equal(s.target.chain.n, 0); assert.equal(s.target.hist.length, 0);
});
test('burn and shock apply original damage-over-time and expire', () => {
  for (const [a, b, el, damage] of [['fire', 'earth', 'fire', 21], ['water', 'lightning', 'lightning', 13]]) {
    const s = pair(a, b), before = s.target.hp;
    assert.equal(s.target.dots[0].el, el);
    s.step(0.5); near(s.target.hp, before - damage);
    for (let i = 0; i < 14; i++) s.step(0.5);
    assert.equal(s.target.dots.length, 0);
  }
});
test('repeated elements refresh aura; freeze and aura expire', () => {
  const s = new ReactionSession(); s.cast('fire'); s.step(1); s.cast('fire');
  near(s.target.aura.t, 7); assert.equal(s.lastCast.reaction, null); near(s.target.hp, 556);
  for (let i = 0; i < 15; i++) s.step(0.5);
  assert.equal(s.target.aura, null);
  const frozen = pair('water', 'ice');
  for (let i = 0; i < 7; i++) frozen.step(0.5);
  assert.equal(frozen.target.canAct(), true);
});
test('non-authoritative targets ignore damage and dead targets reject hits', () => {
  const s = new ReactionSession(); s.target.authoritative = false;
  assert.equal(applyHit(s.game, s.target, { el: 'fire', dmg: 100 }), null);
  assert.equal(s.target.hp, 600); assert.equal(s.target.aura, null);
  s.target.authoritative = true;
  applyHit(s.game, s.target, { dmg: 1000 });
  assert.equal(s.target.hp, 0); assert.equal(s.target.alive, false);
  assert.equal(s.cast('fire'), null);
  s.reset(); assert.equal(s.target.hp, 600); assert.equal(s.lastCast, null);
});
test('all offered pairs resolve without unimplemented game services', () => {
  for (const a of AVAILABLE) for (const b of AVAILABLE) {
    const s = pair(a, b); s.step(0.5);
    assert.ok(Number.isFinite(s.target.hp), `${a} + ${b}`);
  }
});
