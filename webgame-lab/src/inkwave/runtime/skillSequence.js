/** Renderer-independent feedback recipes. A host consumes typed cue facts. */
export const SKILL_RECIPES = {
  impact: [{at:0, type:'impact', strength:1}, {at:.12, type:'ring', strength:1.4}],
  charged: [{at:0, type:'charge', strength:.3}, {at:.25, type:'charge', strength:.6}, {at:.5, type:'charge', strength:1}, {at:.8, type:'beam', strength:1}, {at:.84, type:'impact', strength:.7}],
  nova: [{at:0, type:'charge', strength:.6}, {at:.35, type:'ring', strength:1}, {at:.7, type:'impact', strength:1.6}, {at:.9, type:'ring', strength:2.2}],
};

export class SkillSequence {
  constructor(emit) { this.emit = emit; this.cancel(); }
  play(name, context = {}) {
    if (!SKILL_RECIPES[name]) throw new Error(`Unknown skill recipe: ${name}`);
    this.cancel(); this.name = name; this.context = context; this.cues = SKILL_RECIPES[name];
    this.active = true; this.update(0);
  }
  update(dt) {
    if (!this.active) return;
    this.time += Math.max(0, dt);
    while (this.next < this.cues.length && this.cues[this.next].at <= this.time) {
      this.emit({...this.cues[this.next++], recipe:this.name, context:this.context});
    }
    if (this.next === this.cues.length) this.active = false;
  }
  cancel() { this.active = false; this.time = 0; this.next = 0; this.cues = []; this.context = null; }
}
