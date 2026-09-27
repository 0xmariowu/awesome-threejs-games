// shopsA — konbini ひだまりマート (W1), 花屋 はなのわ (W2), こもれび書店 (W4), 喫茶 はるいろ (E1).
// Each shop is built in its lot-local frame (L.lotFrame): +Z faces the street, x in [-w/2, w/2], z in [-14, 0].
// Publishes ctx.services.shopsA = { cafeWindow:{x,y,z,rotY,w,h}, cafeTables:[{x,z,y}] }.
import { makeCommon } from './shopsA/common.js';
import { buildKonbini } from './shopsA/konbini.js';
import { makeGoods } from './shopsA/goods.js';

const OPTIONAL = [
  ['cafe', () => import('./shopsA/cafe.js'), 'buildCafe'],
  ['flower', () => import('./shopsA/flower.js'), 'buildFlower'],
  ['books', () => import('./shopsA/books.js'), 'buildBooks'],
];

export async function build(ctx) {
  const C = makeCommon(ctx);
  C.G = makeGoods(ctx, C); // instanced shop goods (products, books, cups, flowers, tiles…)
  const out = {};
  buildKonbini(ctx, C);
  for (const [name, load, fn] of OPTIONAL) {
    let mod = null;
    try { mod = await load(); } catch (e) { if (!/Cannot find|Failed to fetch|ERR_MODULE_NOT_FOUND|404/.test(String(e))) throw e; }
    if (mod && mod[fn]) out[name] = mod[fn](ctx, C);
  }
  C.scatter.build();
  C.G.build();
  C.A.lit.finalize(); C.A.glow.finalize(); C.A.cut.finalize(); C.A.inner.finalize();

  const L = ctx.L;
  const f = L.lotFrame(L.lotById('E1'));
  const cafe = out.cafe || {};
  ctx.services.shopsA = {
    cafeWindow: cafe.cafeWindow || { x: f.x + 3.8, y: f.y + 1.8, z: f.z + 1.5, rotY: f.rotY, w: 6.8, h: 1.9 },
    cafeTables: cafe.cafeTables || [],
  };
}
