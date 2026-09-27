export type Vec = { x: number; y: number; z: number };
export type Species = 'ray' | 'whale' | 'bird' | 'moth' | 'koi' | 'jelly';
export type Upgrade = 'engine' | 'food' | 'magnet' | 'birds' | 'whale' | 'restore';
export type Input = { throttle: number; strafe: number; turn: number; pitchTurn: number; lookX: number; lookY: number; altitude: number; boost: boolean; feed: boolean; capture: boolean; recenter: boolean };
export type CreatureMode = 'roam' | 'flock' | 'forage' | 'flee' | 'capturing';
export type Creature = { id: number; species: Species; pos: Vec; home: Vec; wander: Vec; yaw: number; hunger: number; fed: number; phase: number; happy: number; think: number; alert: number; mode: CreatureMode; capture: number; spawn: number; target?: number };
export type Food = { id: number; pos: Vec; life: number };
export type Pearl = { id: number; pos: Vec; value: number; life: number; velocity?: Vec; delay?: number };
export type Respawn = { species: Species; home: Vec; delay: number };
export type GameEvent = { type: 'feed' | 'eat' | 'capture' | 'respawn' | 'collision' | 'collect' | 'upgrade' | 'complete'; pos: Vec; species?: Species; value?: number };
export type Island = { x: number; y: number; z: number; scale: number; kind: 'island' | 'lighthouse'; rotation: number };

export const ISLANDS: Island[] = [
  { x: 12, y: 9, z: -38, scale: 2.1, kind: 'lighthouse', rotation: .3 },
  { x: -48, y: 6, z: -14, scale: 1.7, kind: 'island', rotation: -1 },
  { x: -12, y: 4, z: -58, scale: 1.1, kind: 'island', rotation: 2 },
  { x: 49, y: -1, z: 27, scale: 1.35, kind: 'island', rotation: 1 },
  { x: -47, y: 11, z: 53, scale: 1.45, kind: 'lighthouse', rotation: -2 },
  { x: 8, y: 0, z: 71, scale: 1.65, kind: 'island', rotation: 1.8 },
];

export const SPECIES = {
  ray: { name: 'Cloud ray', speed: 5.5, scale: 1.04, reward: 6, description: 'Curious, graceful, and always first to a fresh seed.' },
  whale: { name: 'Sky whale', speed: 3.8, scale: 2.10, reward: 10, description: 'A gentle giant. A little patience earns a generous gift.' },
  bird: { name: 'Lantern bird', speed: 7.3, scale: .95, reward: 8, description: 'A bright little companion that carries sunshine in its tail.' },
  moth: { name: 'Sun moth', speed: 5.8, scale: .85, reward: 7, description: 'A wandering wing of silk, drawn to the upper gardens.' },
  koi: { name: 'Sky koi', speed: 6.1, scale: 1.15, reward: 8, description: 'A ribbon-tailed swimmer riding the warm currents.' },
  jelly: { name: 'Cloud jelly', speed: 2.6, scale: 1.3, reward: 9, description: 'An opal bell drifting quietly between the cloud layers.' },
} as const;
export const SPECIES_IDS = Object.keys(SPECIES) as Species[];
const isSpecies = (value: unknown): value is Species => typeof value === 'string' && Object.prototype.hasOwnProperty.call(SPECIES, value);

export const vec = (x = 0, y = 0, z = 0): Vec => ({ x, y, z });
export const distance = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
export const IDLE: Input = { throttle: 0, strafe: 0, turn: 0, pitchTurn: 0, lookX: 0, lookY: 0, altitude: 0, boost: false, feed: false, capture: false, recenter: false };
export const FLIGHT = { maxPitch: Math.PI / 4, maxBodyPitch: Math.PI / 15, maxBank: Math.PI / 24 } as const;
export const ECOLOGY = { rays: 2, whales: 1, birds: 3, moths: 2, koi: 2, jellies: 2, maxForagers: 3, captureRange: 18, captureCone: .35, respawnMin: 9, respawnMax: 14 } as const;
const captureSeconds: Record<Species, number> = { ray: .8, whale: 1.25, bird: .55, moth: .6, koi: .75, jelly: 1.05 };
const captureReward: Record<Species, number> = { ray: 12, whale: 24, bird: 9, moth: 12, koi: 15, jelly: 18 };
const homes: Record<Species, Vec[]> = {
  ray: [vec(-8, 22, 15), vec(-65, 25, 38)], whale: [vec(-50, 28, -28), vec(68, 23, 5)],
  bird: [vec(-24, 34, 12), vec(44, 26, -10), vec(68, 30, 12)],
  moth: [vec(-28, 30, -64), vec(63, 32, -40)], koi: [vec(15, 19, 6), vec(61, 17, 47)],
  jelly: [vec(-29, 13, 72), vec(32, 33, -76)],
};
const angleLerp = (a: number, b: number, t: number) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t;

export class Simulation {
  time = 0;
  pos = vec(0, 17, 28);
  velocity = vec();
  yaw = 0;
  bank = 0;
  pitch = 0;
  // Flight pitch steers the velocity; the buoyant hull only leans a little.
  bodyPitch = 0;
  boosting = false;
  foodStock = 12;
  feedCooldown = 0;
  pearls = 0;
  collected = 0;
  totalFed = 0;
  totalCaptured = 0;
  capturing = false;
  captureTarget?: number;
  captureCooldown = 0;
  levels = { engine: 0, food: 0, magnet: 0 };
  birds = false;
  extraWhale = false;
  restored = false;
  creatures: Creature[] = [];
  foods: Food[] = [];
  drops: Pearl[] = [];
  events: GameEvent[] = [];
  respawns: Respawn[] = [];
  private serial = 1;
  private seed = 8128;
  private pendingTurn = 0;
  private collisionCooldown = 0;

  constructor() {
    this.populate();
  }

  random() {
    this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }

  addCreature(species: Species, pos: Vec) {
    const c: Creature = { id: this.serial++, species, pos: { ...pos }, home: { ...pos }, wander: { ...pos }, yaw: this.random() * Math.PI * 2, hunger: .85, fed: 0, phase: this.random() * 6.28, happy: 0, think: 0, alert: 0, mode: 'roam', capture: 0, spawn: 1 };
    this.creatures.push(c);
    return c;
  }

  get maxFood() { return 12 + this.levels.food * 6; }
  get speed() { return Math.hypot(this.velocity.x, this.velocity.y, this.velocity.z); }
  get fedFriends() { return this.creatures.filter(c => c.fed > 0).length; }
  get encounters() { return this.totalFed + this.totalCaptured; }
  // A skyward collection halo keeps the entire capture visible above the balloon.
  get intake() { return vec(this.pos.x - Math.sin(this.yaw) * 2.5, this.pos.y + 6.3, this.pos.z - Math.cos(this.yaw) * 2.5); }
  get mission() {
    if (this.encounters < 5) return { heading: 'Discover the living sky.', text: 'Feed or capture 5 sky creatures', value: this.encounters, max: 5 };
    if (this.collected < 24) return { heading: 'Gather a little sunshine.', text: 'Collect 24 sky coins', value: this.collected, max: 24 };
    if (!this.birds) return { heading: 'Make room for wonder.', text: 'Invite lantern birds in Upgrades', value: 0, max: 1 };
    if (this.encounters < 12) return { heading: 'A thriving little world.', text: 'Feed or capture 12 sky creatures', value: this.encounters, max: 12 };
    if (!this.restored) return { heading: 'Light the way home.', text: 'Restore the beacon in Upgrades · 45 coins', value: Math.min(this.pearls, 45), max: 45 };
    return { heading: 'The sky feels like home.', text: 'Sanctuary restored. Keep exploring.', value: 1, max: 1 };
  }

  price(kind: Upgrade) {
    if (kind === 'birds') return 24;
    if (kind === 'whale') return 32;
    if (kind === 'restore') return 45;
    return { engine: 18, food: 20, magnet: 16 }[kind] * (this.levels[kind] + 1);
  }

  purchased(kind: Upgrade) {
    if (kind === 'birds') return this.birds;
    if (kind === 'whale') return this.extraWhale;
    if (kind === 'restore') return this.restored;
    return this.levels[kind] >= 2;
  }

  canBuy(kind: Upgrade) {
    return !this.purchased(kind) && this.pearls >= this.price(kind) && (kind !== 'restore' || (this.encounters >= 12 && this.birds));
  }

  buy(kind: Upgrade) {
    if (!this.canBuy(kind)) return false;
    this.pearls -= this.price(kind);
    if (kind === 'birds') {
      this.birds = true;
      for (let i = 0; i < ECOLOGY.birds; i++) {
        const bird = this.addCreature('bird', this.safePosition({ ...homes.bird[i] })); bird.spawn = 0;
        this.events.push({ type: 'respawn', pos: { ...bird.pos }, species: 'bird' });
      }
    } else if (kind === 'whale') {
      this.extraWhale = true;
      const whale = this.addCreature('whale', this.safePosition({ ...homes.whale[1] })); whale.spawn = 0;
      this.events.push({ type: 'respawn', pos: { ...whale.pos }, species: 'whale' });
    } else if (kind === 'restore') {
      this.restored = true;
    } else {
      this.levels[kind]++;
    }
    this.events.push({ type: kind === 'restore' ? 'complete' : 'upgrade', pos: { ...this.pos } });
    return true;
  }

  step(dt: number, input: Input) {
    // A capped fixed step is driven by the host. Never simulate time spent in a background tab.
    dt = clamp(dt, 0, 1 / 30);
    this.time += dt;
    this.feedCooldown = Math.max(0, this.feedCooldown - dt);
    this.captureCooldown = Math.max(0, this.captureCooldown - dt);
    this.collisionCooldown = Math.max(0, this.collisionCooldown - dt);
    this.foodStock = Math.min(this.maxFood, this.foodStock + dt * (1.25 + this.levels.food * .5));
    if (input.recenter) { this.pitch = 0; this.pendingTurn = 0; }
    this.pendingTurn -= input.lookX + input.turn * dt * 1.08;
    const yawStep = this.pendingTurn * (1 - Math.exp(-dt * 20));
    this.yaw += yawStep; this.pendingTurn -= yawStep;
    this.pitch = clamp(this.pitch - input.lookY + input.pitchTurn * dt * .9, -FLIGHT.maxPitch, FLIGHT.maxPitch);
    this.boosting = input.boost && (input.throttle !== 0 || input.strafe !== 0 || input.altitude !== 0);
    const targetSpeed = (8 + this.levels.engine * 2.5) * (input.boost ? 1.75 : 1);
    const length = Math.max(1, Math.hypot(input.throttle, input.strafe));
    const forward = input.throttle / length, sideways = input.strafe / length;
    const smooth = 1 - Math.exp(-dt * 2.1);
    this.velocity.x += ((-Math.sin(this.yaw) * Math.cos(this.pitch) * forward + Math.cos(this.yaw) * sideways) * targetSpeed - this.velocity.x) * smooth;
    this.velocity.z += ((-Math.cos(this.yaw) * Math.cos(this.pitch) * forward - Math.sin(this.yaw) * sideways) * targetSpeed - this.velocity.z) * smooth;
    this.velocity.y += (Math.sin(this.pitch) * forward * targetSpeed + input.altitude * 5.0 * (input.boost ? 1.75 : 1) - this.velocity.y) * smooth;
    const hullPitch = input.throttle === 0 ? 0 : clamp(this.pitch * .24, -FLIGHT.maxBodyPitch, FLIGHT.maxBodyPitch);
    this.bodyPitch += (hullPitch - this.bodyPitch) * (1 - Math.exp(-dt * 6));
    const turnBank = clamp(yawStep / Math.max(dt, .001) * .045 - input.strafe * .08, -FLIGHT.maxBank, FLIGHT.maxBank);
    this.bank += (turnBank - this.bank) * (1 - Math.exp(-dt * 5));
    this.pos.x += this.velocity.x * dt;
    this.pos.y = clamp(this.pos.y + this.velocity.y * dt, 5, 44);
    this.pos.z += this.velocity.z * dt;
    const radius = Math.hypot(this.pos.x, this.pos.z);
    if (radius > 104) { this.pos.x *= 104 / radius; this.pos.z *= 104 / radius; }
    for (const island of ISLANDS) {
      const dx = this.pos.x - island.x, dz = this.pos.z - island.z;
      const r = island.scale * 5.8 + 2.3;
      const d = Math.hypot(dx, dz);
      if (this.pos.y > island.y - 7 * island.scale && this.pos.y < island.y + island.scale * (island.kind === 'lighthouse' ? 6.5 : 4) && d < r) {
        const nx = d > .001 ? dx / d : 1, nz = d > .001 ? dz / d : 0;
        const impact = Math.max(0, -(this.velocity.x * nx + this.velocity.z * nz));
        this.pos.x = island.x + nx * r; this.pos.z = island.z + nz * r;
        this.velocity.x = (this.velocity.x + nx * impact * 1.25) * .7;
        this.velocity.z = (this.velocity.z + nz * impact * 1.25) * .7;
        if (impact > 1 && this.collisionCooldown <= 0) {
          this.events.push({ type: 'collision', pos: vec(this.pos.x - nx * 2, this.pos.y, this.pos.z - nz * 2), value: impact });
          this.collisionCooldown = .7;
        }
      }
    }
    if (input.feed && this.feedCooldown <= 0 && this.foodStock >= 1) {
      this.foodStock--;
      this.feedCooldown = .45;
      const pos = vec(this.pos.x - Math.sin(this.yaw) * Math.cos(this.bodyPitch) * 3.3, this.pos.y - .8 + Math.sin(this.bodyPitch) * 3.3, this.pos.z - Math.cos(this.yaw) * Math.cos(this.bodyPitch) * 3.3);
      this.foods.push({ id: this.serial++, pos, life: 22 });
      this.events.push({ type: 'feed', pos: { ...pos } });
    }
    for (const food of this.foods) {
      food.life -= dt;
      food.pos.x += dt * .35;
      food.pos.z += dt * .18;
      food.pos.y -= dt * .18;
    }
    this.updateRespawns(dt);
    this.updateCapture(dt, input.capture);
    for (const creature of this.creatures) this.updateCreature(creature, dt);
    this.foods = this.foods.filter(f => f.life > 0);
    for (const drop of this.drops) {
      drop.life -= dt;
      drop.delay = Math.max(0, (drop.delay ?? 0) - dt);
      if (drop.velocity) {
        const damping = Math.exp(-dt * 3.5);
        drop.pos.x += drop.velocity.x * dt; drop.pos.y += drop.velocity.y * dt; drop.pos.z += drop.velocity.z * dt;
        drop.velocity.x *= damping; drop.velocity.y *= damping; drop.velocity.z *= damping;
      }
      const d = distance(drop.pos, this.pos);
      const reach = 10 + this.levels.magnet * 5;
      if (d < reach && drop.delay === 0) {
        const alpha = 1 - Math.exp(-dt * 3.8);
        drop.pos.x += (this.pos.x - drop.pos.x) * alpha;
        drop.pos.y += (this.pos.y - drop.pos.y) * alpha;
        drop.pos.z += (this.pos.z - drop.pos.z) * alpha;
      } else drop.pos.y += Math.sin(this.time * 1.3 + drop.id) * dt * .14;
      if (d < 1.8 && drop.life > 0 && drop.delay === 0) {
        this.pearls += drop.value; this.collected += drop.value; drop.life = 0;
        this.events.push({ type: 'collect', pos: { ...drop.pos }, value: drop.value });
      }
    }
    this.drops = this.drops.filter(d => d.life > 0);
  }

  /** Migration keeps the most-grown residents and respects captured, waiting slots. */
  private populate(redistribute = false) {
    const counts: Record<Species, number> = { ray: ECOLOGY.rays, whale: ECOLOGY.whales + Number(this.extraWhale), bird: this.birds ? ECOLOGY.birds : 0, moth: ECOLOGY.moths, koi: ECOLOGY.koi, jelly: ECOLOGY.jellies };
    if (redistribute) {
      const kept: Creature[] = [], waiting: Respawn[] = [];
      for (const species of SPECIES_IDS) {
        const slots = this.respawns.filter(s => s.species === species).slice(0, counts[species]);
        const residents = this.creatures.filter(c => c.species === species).sort((a, b) => b.fed - a.fed).slice(0, counts[species] - slots.length);
        residents.forEach((c, i) => { c.pos = this.safePosition({ ...homes[species][i] }); c.home = { ...c.pos }; c.wander = { ...c.pos }; });
        slots.forEach((s, i) => { s.home = this.safePosition({ ...homes[species][residents.length + i] }); });
        kept.push(...residents); waiting.push(...slots);
      }
      this.creatures = kept; this.respawns = waiting;
    }
    for (const species of SPECIES_IDS) {
      const existing = this.creatures.filter(c => c.species === species).length + this.respawns.filter(s => s.species === species).length;
      for (let i = existing; i < counts[species]; i++) this.addCreature(species, this.safePosition({ ...homes[species][i] }));
    }
  }

  private safePosition(pos: Vec) {
    pos.y = clamp(pos.y, 8, 40);
    const r = Math.hypot(pos.x, pos.z);
    if (r > 92) { pos.x *= 92 / r; pos.z *= 92 / r; }
    for (const island of ISLANDS) {
      const top = island.y + island.scale * (island.kind === 'lighthouse' ? 6.5 : 4);
      const radius = island.scale * 5.8 + 5;
      if (pos.y > island.y - 7 * island.scale - 3 && pos.y < top + 3 && Math.hypot(pos.x - island.x, pos.z - island.z) < radius) {
        pos.y = Math.min(40, top + 4);
      }
    }
    return pos;
  }

  private clearPath(from: Vec, to: Vec) {
    const dx = to.x - from.x, dz = to.z - from.z;
    const length2 = dx * dx + dz * dz;
    for (const island of ISLANDS) {
      const ox = from.x - island.x, oz = from.z - island.z;
      const b = 2 * (ox * dx + oz * dz), c = ox * ox + oz * oz - (island.scale * 5.8) ** 2;
      let enter = 0, leave = 1;
      if (length2 < .0001) { if (c >= 0) continue; }
      else {
        const discriminant = b * b - 4 * length2 * c;
        if (discriminant < 0) continue;
        enter = Math.max(0, (-b - Math.sqrt(discriminant)) / (2 * length2));
        leave = Math.min(1, (-b + Math.sqrt(discriminant)) / (2 * length2));
        if (enter > leave) continue;
      }
      const y1 = from.y + (to.y - from.y) * enter, y2 = from.y + (to.y - from.y) * leave;
      const top = island.y + island.scale * (island.kind === 'lighthouse' ? 6.5 : 4);
      if (Math.max(y1, y2) > island.y - 7 * island.scale && Math.min(y1, y2) < top) return false;
    }
    return true;
  }

  get captureCandidate() {
    let nearest: Creature | undefined, best = ECOLOGY.captureRange as number;
    const forward = vec(-Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), -Math.cos(this.yaw) * Math.cos(this.pitch));
    for (const c of this.creatures) {
      const d = distance(c.pos, this.pos);
      const dot = ((c.pos.x - this.pos.x) * forward.x + (c.pos.y - this.pos.y) * forward.y + (c.pos.z - this.pos.z) * forward.z) / Math.max(.01, d);
      if (d < best && dot > ECOLOGY.captureCone && c.spawn >= 1 && this.clearPath(this.intake, c.pos)) { nearest = c; best = d; }
    }
    return nearest;
  }

  private updateCapture(dt: number, held: boolean) {
    this.capturing = held;
    let target = this.creatures.find(c => c.id === this.captureTarget);
    if (target && (!held || distance(target.pos, this.pos) > ECOLOGY.captureRange + 6 || !this.clearPath(this.intake, target.pos))) target = undefined;
    if (!target && held && this.captureCooldown <= 0) target = this.captureCandidate;
    this.captureTarget = target?.id;
    for (const c of this.creatures) if (c !== target) c.capture = Math.max(0, c.capture - dt * 3);
    if (!target) return;
    target.mode = 'capturing'; target.target = undefined;
    target.capture = Math.min(1, target.capture + dt / captureSeconds[target.species]);
    const intake = this.intake, pull = 1 - Math.exp(-dt * (2 + target.capture * 7));
    target.pos.x += (intake.x - target.pos.x) * pull;
    target.pos.y += (intake.y - target.pos.y) * pull;
    target.pos.z += (intake.z - target.pos.z) * pull;
    target.yaw = angleLerp(target.yaw, this.yaw, 1 - Math.exp(-dt * 5));
    if (target.capture < 1) return;
    const value = captureReward[target.species] + this.levels.food * 3;
    this.releaseCoins(target.pos, value, 3);
    this.events.push({ type: 'capture', pos: { ...target.pos }, species: target.species, value });
    this.respawns.push({ species: target.species, home: { ...target.home }, delay: ECOLOGY.respawnMin + this.random() * (ECOLOGY.respawnMax - ECOLOGY.respawnMin) });
    this.creatures = this.creatures.filter(c => c.id !== target.id);
    this.totalCaptured++; this.captureTarget = undefined; this.captureCooldown = .35;
  }

  private releaseCoins(pos: Vec, total: number, count: number) {
    for (let i = 0; i < count; i++) {
      const a = i * Math.PI * 2 / count + this.time;
      const value = Math.floor(total / count) + (i < total % count ? 1 : 0);
      this.drops.push({ id: this.serial++, pos: vec(pos.x, pos.y + .5, pos.z), value, life: 90,
        velocity: vec(Math.sin(a) * 5, 3.2 + i * .45, Math.cos(a) * 5), delay: .65 + i * .06 });
    }
  }

  private updateRespawns(dt: number) {
    for (const slot of this.respawns) {
      slot.delay -= dt;
      if (slot.delay > 0) continue;
      const angle = this.random() * Math.PI * 2;
      let pos = vec(slot.home.x + Math.sin(angle) * 9, slot.home.y + 2, slot.home.z + Math.cos(angle) * 9);
      if (distance(pos, this.pos) < 24) pos = vec(this.pos.x + Math.sin(angle) * 36, 16 + this.random() * 20, this.pos.z + Math.cos(angle) * 36);
      pos = this.safePosition(pos);
      const creature = this.addCreature(slot.species, pos); creature.spawn = 0;
      this.events.push({ type: 'respawn', pos: { ...pos }, species: slot.species });
    }
    this.respawns = this.respawns.filter(s => s.delay > 0);
  }

  private updateCreature(c: Creature, dt: number) {
    c.spawn = Math.min(1, c.spawn + dt);
    c.hunger = Math.min(1, c.hunger + dt * .05);
    c.happy = Math.max(0, c.happy - dt);
    if (c.id === this.captureTarget) return;
    c.alert = Math.max(0, c.alert - dt);
    if (this.boosting && distance(c.pos, this.pos) < 18) c.alert = 1.6;
    c.think -= dt;
    if (c.think <= 0 || distance(c.pos, c.wander) < 2) {
      c.think = 2 + this.random() * 4;
      const a = this.random() * Math.PI * 2, r = 4 + this.random() * 10;
      c.wander = this.safePosition(vec(c.home.x + Math.sin(a) * r, c.home.y + (this.random() - .5) * 10, c.home.z + Math.cos(a) * r));
    }
    let food: Food | undefined, best = 40 + this.levels.food * 8;
    const foragers = this.creatures.filter(other => other.id !== c.id && other.target !== undefined).length;
    if (c.hunger > .3 && c.alert === 0 && (c.target !== undefined || foragers < ECOLOGY.maxForagers)) for (const f of this.foods) {
      const d = distance(f.pos, c.pos);
      const claimed = this.creatures.some(other => other.id !== c.id && other.target === f.id && distance(other.pos, f.pos) < d);
      if (f.life > 0 && d < best && !claimed && this.clearPath(c.pos, f.pos)) { best = d; food = f; }
    }
    c.target = food?.id;
    c.mode = c.alert > 0 ? 'flee' : food ? 'forage' : 'roam';
    const target = c.alert > 0 ? vec(c.pos.x + (c.pos.x - this.pos.x), c.pos.y + 5, c.pos.z + (c.pos.z - this.pos.z)) : food?.pos ?? c.wander;
    const d = distance(c.pos, target);
    const direction = vec((target.x - c.pos.x) / Math.max(.01, d), (target.y - c.pos.y) / Math.max(.01, d), (target.z - c.pos.z) / Math.max(.01, d));
    for (const other of this.creatures) {
      if (other.id === c.id || other.mode === 'capturing') continue;
      const gap = distance(c.pos, other.pos);
      const comfort = c.species === 'whale' || other.species === 'whale' ? 11 : 7.5;
      if (gap > .001 && gap < comfort) {
        const strength = (1 - gap / comfort) ** 2 * (food && d < 4 ? .18 : 2.2);
        direction.x += (c.pos.x - other.pos.x) / gap * strength;
        direction.y += (c.pos.y - other.pos.y) / gap * strength;
        direction.z += (c.pos.z - other.pos.z) / gap * strength;
      } else if (!food && !c.alert && c.species !== 'whale' && c.species !== 'jelly' && c.species === other.species && gap < 18) {
        direction.x += (other.pos.x - c.pos.x) * .012 - Math.sin(other.yaw) * .09;
        direction.y += (other.pos.y - c.pos.y) * .012;
        direction.z += (other.pos.z - c.pos.z) * .012 - Math.cos(other.yaw) * .09;
        c.mode = 'flock';
      }
    }
    for (const island of ISLANDS) {
      const dx = c.pos.x - island.x, dz = c.pos.z - island.z, gap = Math.hypot(dx, dz);
      const top = island.y + island.scale * (island.kind === 'lighthouse' ? 6.5 : 4);
      const comfort = island.scale * 5.8 + 8;
      if (c.pos.y < top + 4 && c.pos.y > island.y - island.scale * 7 - 3 && gap < comfort) {
        const strength = (1 - gap / comfort) * 7;
        direction.x += dx / Math.max(.01, gap) * strength;
        direction.z += dz / Math.max(.01, gap) * strength;
        direction.y += strength * .8;
      }
    }
    const speed = SPECIES[c.species].speed * (c.alert > 0 ? 1.5 : food ? 1 : .52);
    const step = Math.min(d, speed * dt), length = Math.max(.001, Math.hypot(direction.x, direction.y, direction.z));
    c.pos.x += direction.x / length * step; c.pos.y += direction.y / length * step; c.pos.z += direction.z / length * step;
    c.pos.y = clamp(c.pos.y, 7, 41);
    const radius = Math.hypot(c.pos.x, c.pos.z);
    if (radius > 96) { c.pos.x *= 96 / radius; c.pos.z *= 96 / radius; }
    c.yaw = angleLerp(c.yaw, Math.atan2(-direction.x, -direction.z), 1 - Math.exp(-dt * (c.species === 'bird' || c.species === 'moth' ? 5 : c.species === 'jelly' ? 1.3 : 2.5)));
    if (food && food.life > 0 && distance(c.pos, food.pos) < 1.4) {
      food.life = 0; c.fed++; c.hunger = 0; c.happy = 3; this.totalFed++;
      this.releaseCoins(c.pos, SPECIES[c.species].reward + this.levels.food * 2, 1);
      this.events.push({ type: 'eat', pos: { ...c.pos }, species: c.species });
    }
  }

  snapshot() {
    return { version: 1, ecosystemVersion: 2, time: this.time, pos: { ...this.pos }, yaw: this.yaw, pitch: this.pitch,
      pearls: this.pearls, collected: this.collected, totalFed: this.totalFed, totalCaptured: this.totalCaptured,
      levels: { ...this.levels }, birds: this.birds, extraWhale: this.extraWhale, restored: this.restored,
      creatures: this.creatures.map(c => ({ species: c.species, fed: c.fed, pos: { ...c.pos }, home: { ...c.home }, hunger: c.hunger, yaw: c.yaw, phase: c.phase, spawn: c.spawn })),
      respawns: this.respawns.map(s => ({ ...s, home: { ...s.home } })),
      foodStock: this.foodStock, foods: this.foods.map(f => ({ ...f, pos: { ...f.pos } })),
      drops: this.drops.map(d => ({ ...d, pos: { ...d.pos }, velocity: d.velocity && { ...d.velocity } })), seed: this.seed };
  }

  static restore(raw: unknown): Simulation | null {
    if (!raw || typeof raw !== 'object') return null;
    const s = raw as Record<string, unknown>;
    if (s.version !== 1 || !s.levels || typeof s.levels !== 'object' || !Array.isArray(s.creatures) || s.creatures.length > 64) return null;
    const number = (v: unknown, min: number, max: number) => typeof v === 'number' && Number.isFinite(v) ? clamp(v, min, max) : min;
    const position = (v: unknown, fallback: Vec): Vec => {
      if (!v || typeof v !== 'object') return fallback;
      const p = v as Record<string, unknown>;
      return vec(number(p.x, -104, 104), number(p.y, 5, 44), number(p.z, -104, 104));
    };
    const sim = new Simulation();
    sim.time = number(s.time, 0, 1e8); sim.pos = position(s.pos, sim.pos);
    sim.yaw = number(s.yaw, -1e8, 1e8) % (Math.PI * 2);
    sim.pitch = s.pitch === undefined ? 0 : number(s.pitch, -FLIGHT.maxPitch, FLIGHT.maxPitch);
    sim.pearls = Math.floor(number(s.pearls, 0, 1e7));
    sim.collected = Math.floor(number(s.collected, 0, 1e7));
    sim.totalFed = Math.floor(number(s.totalFed, 0, 1e7));
    sim.totalCaptured = Math.floor(number(s.totalCaptured, 0, 1e7));
    const levels = s.levels as Record<string, unknown>;
    for (const key of ['engine', 'food', 'magnet'] as const) sim.levels[key] = Math.floor(number(levels[key], 0, 2));
    sim.birds = s.birds === true; sim.extraWhale = s.extraWhale === true; sim.restored = s.restored === true;
    sim.foodStock = number(s.foodStock, 0, sim.maxFood);
    sim.creatures = [];
    for (const entry of s.creatures) {
      if (!entry || typeof entry !== 'object') return null;
      const c = entry as Record<string, unknown>;
      if (!isSpecies(c.species)) return null;
      const creature = sim.addCreature(c.species, position(c.pos, vec(0, 16, 0)));
      creature.fed = Math.floor(number(c.fed, 0, 1e5));
      creature.hunger = c.hunger === undefined ? .85 : number(c.hunger, 0, 1);
      creature.yaw = number(c.yaw, -1e8, 1e8) % (Math.PI * 2);
      creature.phase = number(c.phase, 0, Math.PI * 2);
      creature.home = position(c.home, { ...creature.pos });
      creature.spawn = c.spawn === undefined ? 1 : number(c.spawn, 0, 1);
    }
    if (Array.isArray(s.respawns)) for (const entry of s.respawns.slice(0, Math.max(0, 64 - sim.creatures.length))) {
      if (!entry || typeof entry !== 'object' || !isSpecies(entry.species)) continue;
      sim.respawns.push({ species: entry.species, home: position(entry.home, vec(0, 20, 0)), delay: number(entry.delay, .01, ECOLOGY.respawnMax) });
    }
    if (s.ecosystemVersion !== 2) sim.populate(true);
    if (!sim.creatures.length && !sim.respawns.length) return null;
    if (Array.isArray(s.foods)) for (const entry of s.foods.slice(0, 60)) {
      if (!entry || typeof entry !== 'object') continue;
      sim.foods.push({ id: sim.serial++, pos: position(entry.pos, vec(0, 16, 0)), life: number(entry.life, 0, 22) });
    }
    if (Array.isArray(s.drops)) for (const entry of s.drops.slice(0, 200)) {
      if (!entry || typeof entry !== 'object') continue;
      const velocity = entry.velocity && typeof entry.velocity === 'object' ? vec(number(entry.velocity.x, -10, 10), number(entry.velocity.y, -10, 10), number(entry.velocity.z, -10, 10)) : undefined;
      sim.drops.push({ id: sim.serial++, pos: position(entry.pos, vec(0, 16, 0)), life: number(entry.life, 0, 90), value: Math.floor(number(entry.value, 1, 30)), velocity, delay: number(entry.delay, 0, 1) });
    }
    sim.seed = number(s.seed, 0, 4294967295);
    return sim;
  }
}
