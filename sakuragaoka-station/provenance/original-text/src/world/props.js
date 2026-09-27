// props — all vending machines (+ recycle bins, crates, flag, sticker), the E6 neighbourhood shrine
// (torii, hokora, foxes, jizo, ema, chōzubachi, lanterns, notice board), the V5 bench, gashapon,
// 防災倉庫, fire-extinguisher boxes, traffic cones + repair notice on R4, and a garbage station.
import { makeHelpers } from './props/common.js';
import { buildVending } from './props/vending.js';
import { buildShrine } from './props/shrine.js';
import { buildScatter } from './props/scatter.js';
import { optimizeProps } from './props/optimize.js';

export async function build(ctx) {
  const H = makeHelpers(ctx);
  const before = new Set(ctx.staticRoot.children);
  const parts = [['vending', buildVending], ['shrine', buildShrine], ['scatter', buildScatter]];
  const errors = [];
  for (const [name, fn] of parts) {
    try { await fn(ctx, H); } catch (e) { errors.push(name); console.error(`[props/${name}]`, e); if (typeof process !== 'undefined' && process.env && process.env.PROPS_STRICT) throw e; }
  }
  // collapse materials (texture atlas pages + vertex-coloured solids) so the batcher can merge per cell
  if (!(typeof process !== 'undefined' && process.env && process.env.PROPS_NOOPT)) try {
    const mine = ctx.staticRoot.children.filter((c) => !before.has(c));
    const st = optimizeProps(ctx, mine);
    if (typeof process !== 'undefined' && process.env && process.env.PROPS_DEBUG) console.log('[props] optimize', JSON.stringify(st));
  } catch (e) { console.error('[props/optimize]', e); }
  if (errors.length) throw new Error('props: failed parts ' + errors.join(', '));
}
