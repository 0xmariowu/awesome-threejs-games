import { describe, it, expect, vi } from "vitest";
import {
  EventBus,
  DampedSpring,
  SimulationClock,
  CueTimeline,
  chooseObjective,
  RESCUE_WEIGHTS,
  surfaceResponse,
} from "./systems";

describe("portable INKWAVE policies", () => {
  it("isolates worlds and removes listeners without leaking subscription groups", () => {
    const a = new EventBus(),
      b = new EventBus(),
      listener = vi.fn();
    const off = a.on("hit", listener);
    b.emit("hit", { amount: 2 });
    expect(listener).not.toHaveBeenCalled();
    a.emit("hit", { amount: 3 });
    expect(listener).toHaveBeenCalledWith({ amount: 3 });
    off();
    a.emit("hit", {});
    expect(listener).toHaveBeenCalledTimes(1);
    expect(a.size).toBe(0);
  });
  it("camera spring has the same constant-target trajectory across timesteps", () => {
    const values = [30, 60, 120].map((hz) => {
      const s = new DampedSpring(0, 13);
      for (let i = 0; i < hz; i++) s.step(4, 1 / hz);
      return s.value;
    });
    expect(values[0]).toBeCloseTo(values[2], 10);
    expect(values[1]).toBeGreaterThan(3.99);
  });
  it("pause/step/resume neither loses explicit steps nor integrates a background-tab gap", () => {
    const clock = new SimulationClock(1 / 60, 4),
      tick = vi.fn();
    clock.advance(1 / 30, tick);
    expect(tick).toHaveBeenCalledTimes(2);
    clock.paused = true;
    clock.advance(3, tick);
    expect(clock.ticks).toBe(2);
    clock.step(tick);
    expect(clock.ticks).toBe(3);
    clock.paused = false;
    clock.advance(3, tick);
    expect(clock.ticks).toBe(7);
    expect(clock.droppedSeconds).toBeGreaterThan(2.9);
  });
  it("skip runs remaining result cues once and cancellation does not award rewards", () => {
    const a = vi.fn(),
      b = vi.fn(),
      t = new CueTimeline([
        { at: 1, run: a },
        { at: 2, run: b },
      ]);
    t.advance(1.2);
    t.finish();
    t.finish();
    t.advance(100);
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
    const c = vi.fn(),
      cancelled = new CueTimeline([{ at: 1, run: c }]);
    cancelled.cancel();
    cancelled.finish();
    expect(c).not.toHaveBeenCalled();
  });
  it("objective policy changes the winner and discourages duplicate teammate goals", () => {
    const goals = [
      {
        id: "near",
        empty: 0.3,
        enemy: 0,
        distance: 1,
        progress: 0,
        teammates: 0,
      },
      {
        id: "front",
        empty: 0.8,
        enemy: 0.7,
        distance: 20,
        progress: 0.8,
        teammates: 0,
      },
    ];
    expect(chooseObjective(goals)[0].id).toBe("front");
    expect(chooseObjective(goals, RESCUE_WEIGHTS)[0].id).toBe("near");
    expect(
      chooseObjective([
        { ...goals[0], teammates: 0 },
        { ...goals[0], id: "crowded", teammates: 2 },
      ])[0].id,
    ).toBe("near");
  });
  it("the same coating supports territory traversal and a separate hazard policy", () => {
    expect(surfaceResponse(1, 0, "turf").climb).toBe(true);
    expect(surfaceResponse(1, 0, "hazard")).toEqual({
      speed: 0.35,
      damage: 12,
      refill: 0,
      climb: false,
    });
    expect(surfaceResponse(0, 0, "hazard").damage).toBe(0);
  });
});
