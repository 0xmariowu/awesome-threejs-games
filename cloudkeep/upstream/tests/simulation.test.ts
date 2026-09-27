import { describe, it, expect } from 'vitest';
import { Simulation, IDLE, distance, vec, ISLANDS, FLIGHT } from '../src/simulation';

function run(game: Simulation, seconds: number, input = IDLE, fps = 60) {
  for (let i = 0; i < seconds * fps; i++) game.step(1 / fps, input);
}

describe('flight', () => {
  it('flies along a pitched 3D heading and releases seeds from the gondola', () => {
    const game = new Simulation();
    const start = { ...game.pos };
    game.step(1 / 60, { ...IDLE, lookX: .4, lookY: -.5 });
    run(game, 2, { ...IDLE, throttle: 1 });
    expect(game.yaw).toBeCloseTo(-.4); expect(game.pitch).toBeCloseTo(.5);
    expect(game.pos.x).toBeGreaterThan(start.x + 3);
    expect(game.pos.y).toBeGreaterThan(start.y + 5);
    expect(game.pos.z).toBeLessThan(start.z - 8);
    game.step(1 / 60, { ...IDLE, feed: true });
    expect(game.foods[0].pos.y).toBeLessThan(game.pos.y);
    expect(game.foods[0].pos.z).toBeLessThan(game.pos.z);
    const high = { ...game.pos };
    run(game, 2, { ...IDLE, throttle: -1 });
    expect(game.pos.y).toBeLessThan(high.y - 3);
    expect(game.pos.z).toBeGreaterThan(high.z + 5);
  });
  it('keeps the hull upright under extreme steering and settles on release', () => {
    const game = new Simulation();
    run(game, 1.5, { ...IDLE, throttle: 1, lookY: -10, lookX: 2 });
    expect(game.pitch).toBe(FLIGHT.maxPitch);
    expect(Math.cos(game.bodyPitch) * Math.cos(game.bank)).toBeGreaterThan(.96);
    run(game, 2);
    expect(Math.abs(game.bodyPitch)).toBeLessThan(.001);
    expect(Math.abs(game.bank)).toBeLessThan(.001);
    expect(game.pitch).toBe(FLIGHT.maxPitch);
  });
  it('recenters flight pitch without turning or resetting progress', () => {
    const game = new Simulation(); game.pitch = -.7; game.yaw = 2; game.pearls = 38;
    game.step(1 / 60, { ...IDLE, recenter: true });
    expect(game.pitch).toBe(0); expect(game.yaw).toBe(2); expect(game.pearls).toBe(38);
  });
  it('strafes without turning and keeps diagonal flight at the same speed', () => {
    const side = new Simulation();
    run(side, 2, { ...IDLE, strafe: 1 });
    expect(side.yaw).toBe(0); expect(side.pos.z).toBe(28);
    expect(side.pos.x).toBeGreaterThan(10);
    const forward = new Simulation(), diagonal = new Simulation();
    run(forward, 2, { ...IDLE, throttle: 1 });
    run(diagonal, 2, { ...IDLE, throttle: 1, strafe: 1 });
    expect(diagonal.speed).toBeCloseTo(forward.speed);
    expect(distance(diagonal.pos, vec(0, 17, 28))).toBeCloseTo(distance(forward.pos, vec(0, 17, 28)));
  });
  it('is stable across 30 and 60 Hz and coasts to a stop', () => {
    const a = new Simulation(), b = new Simulation();
    run(a, 4, { ...IDLE, throttle: 1 }, 60); run(b, 4, { ...IDLE, throttle: 1 }, 30);
    expect(distance(a.pos, b.pos)).toBeLessThan(.2);
    expect(a.pos.z).toBeLessThan(2);
    run(a, 4); expect(a.speed).toBeLessThan(.01);
  });
  it('turns, climbs, and respects sanctuary and island boundaries', () => {
    const game = new Simulation();
    run(game, 20, { ...IDLE, altitude: 1 }); expect(game.pos.y).toBe(44);
    run(game, 50, { ...IDLE, throttle: 1, boost: true }); expect(Math.hypot(game.pos.x, game.pos.z)).toBeLessThanOrEqual(104.01);
    run(game, 2, { ...IDLE, turn: 1 }); expect(game.yaw).toBeLessThan(-2);
    const island = ISLANDS[0]; game.pos = vec(island.x, island.y, island.z); game.step(1 / 60, IDLE);
    expect(Math.hypot(game.pos.x - island.x, game.pos.z - island.z)).toBeGreaterThan(14);
  });
});
describe('feeding and progression', () => {
  it('completes a real seed -> pursuit -> meal -> pearl -> collection loop', () => {
    const game = new Simulation();
    game.step(1 / 60, { ...IDLE, feed: true });
    expect(game.foods).toHaveLength(1);
    run(game, 8);
    expect(game.totalFed).toBeGreaterThan(0);
    expect(game.pearls).toBeGreaterThan(0);
    expect(game.creatures.some(c => c.fed > 0)).toBe(true);
    expect(game.events.some(e => e.type === 'eat')).toBe(true);
    expect(game.events.some(e => e.type === 'collect')).toBe(true);
  });
  it('limits food, removes old items, and never awards the same meal twice', () => {
    const game = new Simulation(); game.creatures = [];
    run(game, 90, { ...IDLE, feed: true });
    expect(game.foodStock).toBeGreaterThanOrEqual(0);
    expect(game.foods.length).toBeLessThan(55);
    run(game, 24); expect(game.foods).toHaveLength(0); expect(game.totalFed).toBe(0);
  });
  it('supports a complete sanctuary without requiring starter currency', () => {
    const game = new Simulation();
    expect(game.buy('birds')).toBe(false);
    run(game, 75, { ...IDLE, feed: true });
    expect(game.totalFed).toBeGreaterThanOrEqual(12);
    expect(game.pearls).toBeGreaterThanOrEqual(69);
    expect(game.buy('restore')).toBe(false);
    expect(game.buy('birds')).toBe(true);
    expect(game.creatures.filter(c => c.species === 'bird')).toHaveLength(3);
    expect(game.buy('restore')).toBe(true);
    expect(game.restored).toBe(true);
    expect(game.buy('restore')).toBe(false);
  });
  it('prices and caps upgrades while preserving earned currency', () => {
    const game = new Simulation(); game.pearls = 200;
    expect(game.buy('engine')).toBe(true); expect(game.pearls).toBe(182);
    expect(game.buy('engine')).toBe(true); expect(game.pearls).toBe(146);
    expect(game.buy('engine')).toBe(false); expect(game.levels.engine).toBe(2);
  });
  it('lets nearby friends claim separate seeds without starving the feeding loop', () => {
    const game = new Simulation();
    game.creatures = [];
    game.addCreature('ray', vec(-2, 17, 23));
    game.addCreature('ray', vec(2, 17, 23));
    game.foods = [
      { id: 100, pos: vec(-2, 17, 17), life: 22 },
      { id: 101, pos: vec(2, 17, 17), life: 22 },
    ];
    run(game, .2);
    expect(new Set(game.creatures.map(c => c.target)).size).toBe(2);
    run(game, 5);
    expect(game.totalFed).toBe(2);
    expect(game.creatures.every(c => c.fed === 1)).toBe(true);
  });
});
describe('save compatibility and validation', () => {
  it('preserves flight pitch and accepts saves from before free flight', () => {
    const game = new Simulation(); game.pitch = .73;
    expect(Simulation.restore(game.snapshot())!.pitch).toBe(.73);
    const { pitch: _pitch, ...legacy } = game.snapshot();
    expect(Simulation.restore(legacy)!.pitch).toBe(0);
    expect(Simulation.restore({ ...legacy, pitch: -1.3 })!.pitch).toBe(-FLIGHT.maxPitch);
    expect(Simulation.restore({ ...legacy, pitch: -1.3 })!.bodyPitch).toBe(0);
  });
  it('preserves uncollected rewards, food, and hunger across reloads', () => {
    const game = new Simulation();
    game.drops.push({ id: 201, pos: vec(2, 17, 28), life: 80, value: 10 });
    game.foods.push({ id: 202, pos: vec(0, 16, 24), life: 20 });
    game.creatures[0].hunger = .08;
    const restored = Simulation.restore(JSON.parse(JSON.stringify(game.snapshot())))!;
    expect(restored.creatures[0].hunger).toBe(.08);
    expect(restored.foods).toHaveLength(1); expect(restored.drops).toHaveLength(1);
    // Isolate reward persistence from the separate, now more populated feeding loop.
    restored.foods = [];
    run(restored, 2); expect(restored.pearls).toBe(10);
    run(restored, 2); expect(restored.pearls).toBe(10);
  });
  it('round trips a grown sanctuary and keeps progression', () => {
    const game = new Simulation(); run(game, 20, { ...IDLE, feed: true }); game.pearls += 24; game.buy('birds');
    const restored = Simulation.restore(JSON.parse(JSON.stringify(game.snapshot())))!;
    expect(restored.totalFed).toBe(game.totalFed); expect(restored.pearls).toBe(game.pearls);
    expect(restored.creatures.map(c => c.fed)).toEqual(game.creatures.map(c => c.fed));
    expect(restored.birds).toBe(true); expect(restored.creatures).toHaveLength(12);
  });
  it('rejects unknown versions and malformed species and clamps untrusted numbers', () => {
    expect(Simulation.restore(null)).toBeNull(); expect(Simulation.restore({ version: 99 })).toBeNull();
    const raw = new Simulation().snapshot();
    const bad = { ...raw, creatures: [{ species: 'alien', pos: {} }] };
    expect(Simulation.restore(bad)).toBeNull();
    const safe = Simulation.restore({ ...raw, pearls: -900, pos: { x: Infinity, y: 1e6, z: NaN }, levels: { engine: 99, food: -2, magnet: 'bad' } })!;
    expect(safe.pearls).toBe(0); expect(safe.pos.y).toBe(44); expect(safe.levels).toEqual({ engine: 2, food: 0, magnet: 0 });
  });
});
