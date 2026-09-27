import { describe, expect, it } from 'vitest';
import { Simulation, IDLE, ECOLOGY, ISLANDS, SPECIES_IDS, vec, distance } from '../src/simulation';

const run = (game: Simulation, seconds: number, input = IDLE) => {
  for (let i = 0; i < seconds * 60; i++) game.step(1 / 60, input);
};
const captureFixture = () => {
  const game = new Simulation(); game.creatures = [];
  game.addCreature('ray', vec(0, 17, 18));
  return game;
};

describe('capture lifecycle', () => {
  it('removes the target, releases visible coins once, then respawns a new creature', () => {
    const game = captureFixture(), id = game.creatures[0].id;
    run(game, .85, { ...IDLE, capture: true });
    expect(game.creatures).toHaveLength(0);
    expect(game.totalCaptured).toBe(1);
    expect(game.drops).toHaveLength(3);
    expect(game.pearls).toBe(0);
    expect(game.respawns[0].delay).toBeGreaterThan(8);
    run(game, 2);
    expect(game.pearls).toBe(12); expect(game.collected).toBe(12);
    expect(game.events.filter(e => e.type === 'capture')).toHaveLength(1);
    run(game, ECOLOGY.respawnMax);
    expect(game.creatures).toHaveLength(1);
    expect(game.creatures[0].id).not.toBe(id);
    expect(game.events.filter(e => e.type === 'respawn')).toHaveLength(1);
    expect(game.pearls).toBe(12); expect(game.respawns).toHaveLength(0);
  });
  it('releases a partial capture without granting a reward or stranding the creature', () => {
    const game = captureFixture();
    run(game, .3, { ...IDLE, capture: true });
    expect(game.creatures[0].capture).toBeGreaterThan(.3);
    run(game, 1);
    expect(game.creatures[0].capture).toBe(0);
    expect(game.creatures[0].mode).not.toBe('capturing');
    expect(game.captureTarget).toBeUndefined(); expect(game.totalCaptured).toBe(0);
    expect(game.drops).toHaveLength(0); expect(game.respawns).toHaveLength(0);
  });
  it('only locks a creature ahead, in range, with a clear path', () => {
    const game = captureFixture(); game.creatures = [];
    game.addCreature('ray', vec(0, 17, 35));
    game.addCreature('ray', vec(0, 17, 1));
    expect(game.captureCandidate).toBeUndefined();
    const island = ISLANDS[2];
    game.pos = vec(island.x, 5, island.z + 8);
    game.creatures = []; game.addCreature('ray', vec(island.x, 5, island.z - 8));
    expect(game.captureCandidate).toBeUndefined();
  });
  it('persists an empty population and pending respawn without paying again on reload', () => {
    const game = captureFixture(); run(game, .85, { ...IDLE, capture: true });
    const restored = Simulation.restore(JSON.parse(JSON.stringify(game.snapshot())))!;
    expect(restored).not.toBeNull(); expect(restored.creatures).toHaveLength(0);
    expect(restored.respawns).toHaveLength(1); expect(restored.totalCaptured).toBe(1);
    run(restored, 2); expect(restored.pearls).toBe(12);
    const again = Simulation.restore(JSON.parse(JSON.stringify(restored.snapshot())))!;
    run(again, 14);
    expect(again.creatures).toHaveLength(1); expect(again.pearls).toBe(12);
    expect(again.events.filter(e => e.type === 'capture')).toHaveLength(0);
  });
  it('lets capture encounters advance the restoration goal', () => {
    const game = new Simulation(); game.totalCaptured = 12; game.collected = 80; game.pearls = 80;
    expect(game.buy('birds')).toBe(true); expect(game.buy('restore')).toBe(true);
  });
  it.each(SPECIES_IDS)('captures, saves and respawns a %s with its own reward', species => {
    const game = new Simulation(); game.creatures = []; game.addCreature(species, vec(0, 18, 18));
    run(game, 1.4, { ...IDLE, capture: true });
    const value = game.events.find(e => e.type === 'capture')!.value!;
    expect(value).toBeGreaterThan(0); expect(game.totalCaptured).toBe(1);
    const restored = Simulation.restore(JSON.parse(JSON.stringify(game.snapshot())))!;
    run(restored, 15);
    expect(restored.pearls).toBe(value); expect(restored.creatures[0].species).toBe(species);
  });
});

describe('living population and compatibility', () => {
  it('migrates a legacy sanctuary without losing currency, levels or creature growth', () => {
    const source = new Simulation().snapshot();
    const { ecosystemVersion: _version, respawns: _respawns, ...legacy } = source;
    legacy.creatures = legacy.creatures.slice(0, 4); legacy.creatures[0].fed = 7;
    legacy.pearls = 12; legacy.collected = 86; legacy.totalFed = 17;
    legacy.levels = { engine: 2, food: 1, magnet: 0 };
    const game = Simulation.restore(legacy)!;
    expect(game.creatures).toHaveLength(9); expect(game.creatures[0].fed).toBe(7);
    expect(game.pearls).toBe(12); expect(game.collected).toBe(86); expect(game.totalFed).toBe(17);
    expect(game.levels).toEqual(legacy.levels);
    expect(Simulation.restore(game.snapshot())!.creatures).toHaveLength(9);
  });
  it('keeps residents spread out across the sanctuary while they roam', () => {
    const game = new Simulation(), initial = game.creatures.map(c => ({ ...c.pos }));
    expect(game.creatures).toHaveLength(9);
    run(game, 30);
    expect(game.creatures.filter((c, i) => distance(c.pos, initial[i]) > 5).length).toBeGreaterThan(4);
    expect(new Set(game.creatures.map(c => c.species)).size).toBe(5);
    expect(game.creatures.filter(c => distance(c.pos, game.pos) < 30).length).toBeLessThanOrEqual(3);
    for (const c of game.creatures) {
      expect(Math.hypot(c.pos.x, c.pos.z)).toBeLessThanOrEqual(96.01);
      expect(c.pos.y).toBeGreaterThanOrEqual(7); expect(c.pos.y).toBeLessThanOrEqual(41);
    }
  });
  it('flees an accelerating ship, then returns to normal behavior', () => {
    const game = captureFixture();
    run(game, .3, { ...IDLE, throttle: 1, boost: true });
    expect(game.creatures[0].mode).toBe('flee'); expect(game.creatures[0].alert).toBeGreaterThan(0);
    run(game, 2);
    expect(game.creatures[0].mode).not.toBe('flee');
  });
  it('migrates the crowded population while keeping the most-grown residents', () => {
    const source = new Simulation(); source.creatures = [];
    for (let i = 0; i < 12; i++) source.addCreature('ray', vec(i, 20, 0)).fed = i;
    for (let i = 0; i < 3; i++) source.addCreature('whale', vec(i, 22, 4));
    source.pearls = 142; source.totalFed = 38; source.totalCaptured = 2;
    const restored = Simulation.restore({ ...source.snapshot(), ecosystemVersion: 1 })!;
    expect(restored.creatures).toHaveLength(9);
    expect(restored.creatures.filter(c => c.species === 'ray').map(c => c.fed)).toEqual([11, 10]);
    expect(restored.pearls).toBe(142); expect(restored.encounters).toBe(40);
    expect(new Set(restored.creatures.map(c => c.species)).size).toBe(5);
  });
  it('flocks in small groups and limits the number of creatures responding to bait', () => {
    const game = new Simulation(); game.creatures = [];
    for (let i = 0; i < 5; i++) game.addCreature('bird', vec((i - 2) * 6, 20, 10));
    run(game, .2);
    expect(game.creatures.some(c => c.mode === 'flock')).toBe(true);
    run(game, 2, { ...IDLE, feed: true });
    expect(game.creatures.filter(c => c.target !== undefined).length).toBeLessThanOrEqual(3);
  });
  it('produces a bounded collision event on impact', () => {
    const game = new Simulation(), island = ISLANDS[0];
    game.pos = vec(island.x + island.scale * 5.8 + 2.4, island.y + 4, island.z);
    game.velocity = vec(-10, 0, 0);
    run(game, .3, { ...IDLE, strafe: -1 });
    const hits = game.events.filter(e => e.type === 'collision');
    expect(hits).toHaveLength(1); expect(hits[0].value).toBeGreaterThan(1);
    expect(Math.hypot(game.pos.x - island.x, game.pos.z - island.z)).toBeGreaterThanOrEqual(island.scale * 5.8 + 2.29);
  });
});
