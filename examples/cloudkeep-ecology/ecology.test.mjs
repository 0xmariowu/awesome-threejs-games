import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stripTypeScriptTypes } from 'node:module';
import { readFile } from 'node:fs/promises';

// Node 22 strips types in memory; resolve extensionless original imports only for this test.
async function moduleURL(file, imports = {}) {
  let source = stripTypeScriptTypes(await readFile(new URL(file, import.meta.url), 'utf8'));
  for (const [from, to] of Object.entries(imports)) source = source.replace(`'${from}'`, `'${to}'`);
  return `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
}
const simulationURL = await moduleURL('./original/simulation.ts');
const { Simulation, IDLE, ECOLOGY } = await import(simulationURL);
const { createFixture } = await import(await moduleURL('./src/fixture.ts', { '../original/simulation': simulationURL }));
const { loadGame, saveGame } = await import(await moduleURL('./original/storage.ts', { './simulation': simulationURL }));
const run = (sim, seconds, input = IDLE) => { for (let n = 0; n < seconds * 60; n++) sim.step(1 / 60, input); };

test('compact fixture roams, flocks, forages and eats through original step', () => {
  const sim = createFixture();
  const initial = structuredClone(sim.creatures);
  run(sim, .2);
  assert(sim.creatures.some(c => c.mode === 'flock'));
  assert(sim.creatures.some(c => c.mode === 'roam'));
  assert(sim.creatures.every((c, i) => JSON.stringify(c.pos) !== JSON.stringify(initial[i].pos)));
  run(sim, 1, { ...IDLE, feed: true });
  assert(sim.creatures.some(c => c.mode === 'forage'));
  assert(sim.creatures.filter(c => c.target !== undefined).length <= ECOLOGY.maxForagers);
  run(sim, 10);
  assert(sim.totalFed > 0);
  assert(sim.events.some(e => e.type === 'eat'));
});

test('boost startles nearby creatures, then they recover', () => {
  const sim = createFixture();
  run(sim, .3, { ...IDLE, throttle: 1, boost: true });
  assert(sim.boosting);
  assert(sim.creatures.some(c => c.mode === 'flee'));
  run(sim, 2);
  assert(sim.creatures.every(c => c.mode !== 'flee'));
});

test('cancelled capture pays nothing; completed capture drops coins once and respawns', () => {
  const sim = createFixture();
  run(sim, .25, { ...IDLE, capture: true });
  assert(sim.creatures.some(c => c.capture > .2));
  run(sim, .3);
  assert(sim.creatures.every(c => c.capture === 0));
  assert.equal(sim.totalCaptured, 0);
  assert.equal(sim.drops.length, 0);
  run(sim, .85, { ...IDLE, capture: true });
  assert.equal(sim.totalCaptured, 1);
  assert.equal(sim.drops.length, 3);
  assert.equal(sim.creatures.length, 8);
  assert(sim.respawns[0].delay > 8);
  run(sim, 2);
  assert.equal(sim.pearls, 12);
  run(sim, ECOLOGY.respawnMax);
  assert.equal(sim.creatures.length, 9);
  assert.equal(sim.respawns.length, 0);
  assert.equal(sim.events.filter(e => e.type === 'capture').length, 1);
  assert.equal(sim.events.filter(e => e.type === 'respawn').length, 1);
  assert.equal(sim.pearls, 12);
});

test('original storage preserves pending coins and respawns without duplicate rewards', () => {
  const values = new Map();
  globalThis.localStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  try {
    const sim = createFixture();
    run(sim, .85, { ...IDLE, capture: true });
    assert(saveGame(sim));
    const restored = loadGame();
    assert.equal(restored.drops.length, 3);
    assert.equal(restored.respawns.length, 1);
    assert.equal(restored.totalCaptured, 1);
    run(restored, 16);
    assert.equal(restored.pearls, 12);
    assert.equal(restored.creatures.length, 9);
    assert(saveGame(restored));
    const again = loadGame(); run(again, 16);
    assert.equal(again.pearls, 12);
    assert.equal(again.totalCaptured, 1);
    assert.equal(again.creatures.length, 9);
    values.set('cloudkeep.save.v1', '{broken');
    assert.equal(loadGame(), null);
    globalThis.localStorage = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
    assert.equal(loadGame(), null);
    assert.equal(saveGame(sim), false);
    assert.equal(Simulation.restore({ version: 999 }), null);
  } finally { delete globalThis.localStorage; }
});
