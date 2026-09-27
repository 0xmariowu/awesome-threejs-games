/** Reusable policies distilled from INKWAVE. No renderer, DOM or game singleton. */
export type EventPayload = Record<string, unknown>;
export class EventBus {
  private listeners = new Map<string, Set<(payload: any) => void>>();
  counts: Record<string, number> = {};
  on<T = EventPayload>(name: string, listener: (payload: T) => void) {
    const group = this.listeners.get(name) ?? new Set();
    group.add(listener);
    this.listeners.set(name, group);
    return () => {
      group.delete(listener);
      if (!group.size) this.listeners.delete(name);
    };
  }
  emit<T>(name: string, payload: T) {
    this.counts[name] = (this.counts[name] ?? 0) + 1;
    for (const listener of [...(this.listeners.get(name) ?? [])])
      listener(payload);
  }
  get size() {
    return [...this.listeners.values()].reduce(
      (sum, group) => sum + group.size,
      0,
    );
  }
  clear() {
    this.listeners.clear();
    this.counts = {};
  }
}

/** Source: cameraRig.Spring exact solution; target is constant during each step. */
export class DampedSpring {
  velocity = 0;
  constructor(
    public value = 0,
    public frequency = 20,
  ) {}
  reset(value = 0) {
    this.value = value;
    this.velocity = 0;
  }
  step(target: number, dt: number) {
    if (!Number.isFinite(dt) || dt <= 0) return this.value;
    const d = this.value - target,
      e = Math.exp(-this.frequency * dt);
    const k = (this.velocity + this.frequency * d) * dt;
    this.value = target + (d + k) * e;
    this.velocity = (this.velocity - this.frequency * k) * e;
    return this.value;
  }
}

/** Bounded fixed-step driver: explicit pause/step, no second requestAnimationFrame. */
export class SimulationClock {
  paused = false;
  time = 0;
  ticks = 0;
  droppedSeconds = 0;
  private accumulator = 0;
  constructor(
    public stepSeconds = 1 / 120,
    private maxSteps = 16,
  ) {}
  advance(dt: number, tick: (dt: number) => void) {
    if (this.paused || !Number.isFinite(dt) || dt <= 0) return;
    const accepted = Math.min(dt, this.stepSeconds * this.maxSteps);
    this.droppedSeconds += dt - accepted;
    this.accumulator += accepted;
    while (this.accumulator + 1e-10 >= this.stepSeconds) {
      this.step(tick);
      this.accumulator -= this.stepSeconds;
    }
  }
  step(tick: (dt: number) => void) {
    tick(this.stepSeconds);
    this.time += this.stepSeconds;
    this.ticks++;
  }
  reset() {
    this.time = 0;
    this.ticks = 0;
    this.accumulator = 0;
    this.droppedSeconds = 0;
  }
}

export interface Objective {
  id: string;
  empty: number;
  enemy: number;
  distance: number;
  progress: number;
  teammates: number;
}
export interface GoalWeights {
  empty: number;
  enemy: number;
  distance: number;
  progress: number;
  crowd: number;
}
export const TURF_WEIGHTS: GoalWeights = {
  empty: 12,
  enemy: 15,
  distance: 0.18,
  progress: 4,
  crowd: 4,
};
export const RESCUE_WEIGHTS: GoalWeights = {
  empty: 20,
  enemy: 0,
  distance: 0.7,
  progress: 0,
  crowd: 10,
};
/** Source: bots._pickPaintGoal; random tie-breaking is deliberately removed for inspectable comparisons. */
export function scoreObjective(goal: Objective, w: GoalWeights = TURF_WEIGHTS) {
  const parts = {
    opportunity: goal.empty * w.empty,
    threat: goal.enemy * w.enemy,
    travel: -goal.distance * w.distance,
    progress: Math.max(0, Math.min(0.8, goal.progress)) * w.progress,
    crowd: -goal.teammates * w.crowd,
  };
  return {
    id: goal.id,
    score: Object.values(parts).reduce((a, b) => a + b, 0),
    parts,
  };
}
export function chooseObjective(
  goals: Objective[],
  weights: GoalWeights = TURF_WEIGHTS,
) {
  return goals
    .map((g) => scoreObjective(g, weights))
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
}

/** Results/UI orchestration: skip commits remaining cues once; cancel commits nothing. */
export class CueTimeline {
  time = 0;
  complete = false;
  private next = 0;
  private cues: { at: number; run: () => void }[];
  constructor(cues: { at: number; run: () => void }[]) {
    this.cues = [...cues].sort((a, b) => a.at - b.at);
  }
  advance(dt: number) {
    if (this.complete) return;
    this.time += Math.max(0, dt);
    while (this.next < this.cues.length && this.cues[this.next].at <= this.time)
      this.cues[this.next++].run();
    this.complete = this.next === this.cues.length;
  }
  finish() {
    if (!this.complete)
      this.advance(Math.max(0, (this.cues.at(-1)?.at ?? 0) - this.time));
  }
  cancel() {
    this.complete = true;
  }
}

/** Surface behavior is a policy, independent of RGB appearance or a turf match. */
export function surfaceResponse(
  owner: number,
  team: number,
  policy: "turf" | "hazard" | "boost" | "recovery",
) {
  if (!owner) return { speed: 1, damage: 0, refill: 0, climb: false };
  if (policy === "boost") return { speed: owner === 1 ? 2.5 : .5, damage: 0, refill: 0, climb: false };
  if (policy === "recovery") return { speed: 1, damage: owner === 1 ? -16 : 8, refill: owner === 1 ? 30 : -15, climb: false };
  if (policy === "hazard")
    return {
      speed: owner === 1 ? 0.35 : 1.5,
      damage: owner === 1 ? 12 : 0,
      refill: 0,
      climb: false,
    };
  return owner === team + 1
    ? { speed: 1.96, damage: 0, refill: 42, climb: true }
    : { speed: 0.32, damage: 20, refill: 0, climb: false };
}
