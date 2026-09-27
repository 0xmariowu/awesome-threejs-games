import { Combatant, applyHit } from '../original/combat.js';

// The host supplies a stationary target and presentation services, not combat rules.
export const AVAILABLE = ['fire', 'water', 'ice', 'lightning', 'earth', 'arcane'];
export const BASE_DAMAGE = 22;
export class ReactionSession {
  constructor(onEffect = () => {}) {
    this.onEffect = onEffect;
    this.reset();
  }
  reset() {
    this.caster = new Combatant({ id: 'caster', name: 'Caster' });
    this.caster.pos.set(-12, 0, 0);
    this.target = new Combatant({ id: 'target', name: 'Target', team: 1 });
    this.time = 0;
    this.hits = [];
    this.casts = 0;
    this.lastCast = null;
    this.game = {
      combatants: [this.target], firstPerson: false,
      fx: Object.fromEntries(['element', 'explosion', 'ring', 'puff', 'bolt'].map(kind =>
        [kind, (...args) => this.onEffect(kind, args)])),
      audio: { reaction() {}, impact() {} },
      onDamage: (target, result, point, element, hit) => {
        const event = {
          time: this.time, element, dot: Boolean(hit.dot),
          damage: result.dmg, absorbed: result.absorbed, hp: target.hp,
          reaction: result.reaction?.name ?? null,
          color: result.reaction?.color ?? null,
        };
        this.hits.push(event);
        if (this.hits.length > 80) this.hits.shift();
        this.onEffect('damage', [event]);
      },
      onDeath: target => { target.alive = false; },
    };
  }
  cast(element) {
    if (!AVAILABLE.includes(element) || !this.target.alive) return null;
    const auraBefore = this.target.aura?.el ?? null;
    this.casts++;
    const result = applyHit(this.game, this.target, {
      dmg: BASE_DAMAGE, el: element, src: this.caster,
      point: this.target.center(), mag: 0.5, dmgMult: 1, basic: true,
    });
    this.lastCast = { element, auraBefore, ...this.hits.at(-1) };
    return result;
  }
  step(dt) {
    this.time += dt;
    this.target.updateStatus(dt, this.game);
    this.caster.updateStatus(dt, this.game);
  }
  snapshot() {
    const t = this.target;
    return {
      time: this.time, casts: this.casts, hp: t.hp, maxHp: t.maxHp, alive: t.alive,
      aura: t.aura ? { ...t.aura } : null,
      frozen: t.frozen, stun: t.stun, defDown: t.defDown, mud: t.mud,
      weaken: t.weaken, curse: t.curse, canAct: t.canAct(),
      dots: t.dots.map(({ el, t, dps }) => ({ el, t, dps })),
      lastCast: this.lastCast ? { ...this.lastCast } : null,
      hits: this.hits.map(hit => ({ ...hit })),
    };
  }
}
