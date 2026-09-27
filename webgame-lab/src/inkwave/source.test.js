import { describe, it, expect } from "vitest";
import { Vector3 } from "three";
import { EventBus, SimulationClock } from "./systems";
import * as reference from "./runtime/config.js";
import { createActorType } from "./runtime/game/actor.js";
import { Level } from "./runtime/world/level.js";
import { Physics } from "./runtime/game/physics.js";
import { NavGraph } from "./runtime/game/nav.js";

function motor(speed) {
  const world = {
    preset: { ...reference, PLAYER: { ...reference.PLAYER, runSpeed: speed } },
    events: new EventBus(),
  };
  const Actor = createActorType(world, class {}),
    a = Object.create(Actor.prototype);
  Object.assign(a, {
    intent: { move: new Vector3(0, 0, 1) },
    vel: new Vector3(),
    grounded: true,
    hardLand: 0,
    weaponRunner: { moveSpeed: () => world.preset.PLAYER.runSpeed },
  });
  return { world, a, tick: (h) => a._horizontal(h, false, false) };
}
describe("adapted source contracts", () => {
  it("two motor types retain their own tuning and reach independent speeds", () => {
    const slow = motor(3),
      fast = motor(9);
    for (let i = 0; i < 240; i++) {
      slow.tick(1 / 120);
      fast.tick(1 / 120);
    }
    expect(slow.a.vel.z).toBeCloseTo(3);
    expect(fast.a.vel.z).toBeCloseTo(9);
    slow.a.intent.move.set(0, 0, 0);
    for (let i = 0; i < 120; i++) slow.tick(1 / 120);
    expect(slow.a.vel.length()).toBe(0);
    expect(fast.a.vel.z).toBeCloseTo(9);
  });
  it("fixed simulation produces equal movement at 30, 60 and 120 presentation Hz", () => {
    const speeds = [30, 60, 120].map((hz) => {
      const m = motor(6),
        clock = new SimulationClock();
      for (let i = 0; i < hz; i++) clock.advance(1 / hz, m.tick);
      return m.a.vel.z;
    });
    expect(speeds[0]).toBeCloseTo(speeds[2], 12);
    expect(speeds[1]).toBeCloseTo(speeds[2], 12);
  });
  it("one layout drives collision and an obstacle-avoiding path", () => {
    const level = new Level({
      bounds: { minX: -6, maxX: 6, minZ: -6, maxZ: 6 },
      spawnPads: [
        [0, 0, -5],
        [0, 0, 5],
      ],
      spawnBarrier: 0,
      half: [],
      single: [
        { kind: "box", min: [-6, -1, -6], max: [6, 0, 6] },
        { kind: "box", min: [-1, 0, -2], max: [1, 3, 2] },
      ],
    });
    const physics = new Physics(level),
      nav = new NavGraph(level, physics);
    const a = nav.nearest(new Vector3(-4, 0, 0)),
      b = nav.nearest(new Vector3(4, 0, 0)),
      path = nav.path(a, b, 0);
    expect(path.length).toBeGreaterThan(8);
    expect(path[0]).toBe(a);
    expect(path.at(-1)).toBe(b);
    expect(
      path.every(
        (id) => Math.abs(nav.nodes[id].x) > 1 || Math.abs(nav.nodes[id].z) > 2,
      ),
    ).toBe(true);
    expect(level.faces.some((f) => f.paintable)).toBe(true);
  });
});

import { stepLocomotion } from "./runtime/motion/locomotion.js";
import { CriticalSpring, stepDamped } from "./runtime/motion/springs.js";
it("the extracted motor drives a plain object with no Actor, weapon, renderer or vectors", () => {
  const s = {
    intent: { move: { x: 1, z: 0 } },
    vel: { x: 0, z: 0 },
    grounded: true,
    submerged: false,
    hardLand: 0,
  };
  for (let i = 0; i < 120; i++)
    stepLocomotion(s, reference.PLAYER, 1 / 120, { maxSpeed: 4 });
  expect(s.vel.x).toBeCloseTo(4);
  expect(s.vel.z).toBeCloseTo(0);
});
it("camera recoil kernels settle without sign explosions at a large presentation timestep", () => {
  const exact = new CriticalSpring();
  exact.v = 3;
  const under = { x: 0, v: -0.4 };
  for (let i = 0; i < 60; i++) {
    exact.step(0, 22, 1 / 20);
    stepDamped(under, 0, 13, 0.82, 1 / 20);
  }
  expect(Math.abs(exact.x)).toBeLessThan(0.00001);
  expect(Math.abs(under.x)).toBeLessThan(0.00001);
});
