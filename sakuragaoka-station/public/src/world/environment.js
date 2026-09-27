// environment — base terrain of the whole world, ground colouring, the 桜堤 levee, the 桜川 river,
// far fields / hills / mountains with aerial perspective, wildflowers & weeds, and a small green park.
import { createEnvTextures } from './environment/textures.js';
import { distantMaterial } from './environment/shaders.js';
import { buildTerrain } from './environment/terrain.js';
import { terrainH, bakeColors } from './environment/common.js';
import { buildFar } from './environment/far.js';
import { buildLevee } from './environment/levee.js';
import { buildRiver } from './environment/water.js';
import { buildPark } from './environment/park.js';
import { buildFlora } from './environment/flora.js';

export async function build(ctx) {
  const tx = createEnvTextures(ctx);
  const env = { groundAt: terrainH };
  ctx.services.environment = env;
  const step = (name, fn) => {
    try { return fn(); } catch (e) { console.error('[environment] ' + name + ' failed:', e); return null; }
  };
  // near hills: painted forest crowns (procedural cells, no tiling) with valley mist
  const forestMat = distantMaterial(ctx, { vertexColors: true, crown: 10.5, crownAmt: 1.0, pinkAmt: 0.5, pink: '#ecc6d3', youngAmt: 0.55, darkAmt: 0.6, patch: 75, mistY0: 2, mistY1: 32, mistAmt: 0.28, fogMul: 0.5, hazeK: 0.0006, hazeMax: 0.45, haze: '#c3d3e6', rim: 1 });
  const terrain = step('terrain', () => buildTerrain(ctx, tx, forestMat));
  const far = step('far', () => buildFar(ctx, tx)) || {};
  const levee = step('levee', () => buildLevee(ctx, tx)) || {};
  const river = step('river', () => buildRiver(ctx, tx)) || {};
  const park = step('park', () => buildPark(ctx, tx)) || {};
  Object.assign(env, {
    nanoEdges: far.nanoEdges || [], isParkMound: park.isParkMound, parkFlora: park.parkFlora,
    levee: { benches: levee.benches || [], lamps: levee.lamps || [], stairs: levee.stairs || [] },
    river: { waterY: -0.45, bars: river.bars || [] },
  });
  step('flora', () => buildFlora(ctx, tx, env));
  // one shared vertex-coloured material for all plain props (fewer materials -> fewer draw calls)
  step('bake', () => { for (const g of ctx.staticRoot.children) if (/^env-/.test(g.name) && g.name !== 'env-terrain') bakeColors(ctx, g); });
  return { terrain };
}
