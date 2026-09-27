// shopsB — traditional Showa-era shops on the main street (桜ヶ丘駅前商店街):
//   E2 和菓子処 桜月堂 (wagashi), E3 よろず屋 山田商店 (general store),
//   E5 らーめん 春風 (ramen), W6 サイクル丸山 (bicycle shop).
// Everything is built in lot-local frames (layout.js lotFrame); see src/world/shopsB/*.js.
import { createKit } from './shopsB/common.js';
import * as wagashi from './shopsB/wagashi.js';
import * as general from './shopsB/general.js';
import * as ramen from './shopsB/ramen.js';
import * as bike from './shopsB/bike.js';
import { consolidate } from './shopsB/optimize.js';
import { createInst } from './shopsB/inst.js';
import * as wagashiInt from './shopsB/wagashiInt.js';
import * as generalInt from './shopsB/generalInt.js';
import * as ramenInt from './shopsB/ramenInt.js';
import * as bikeInt from './shopsB/bikeInt.js';

const FONT_FACES = ['400 32px "Yuji Syuku"', '700 32px "Noto Serif JP"', '700 32px "Noto Sans JP"', '900 32px "Noto Sans JP"', '500 32px "Noto Sans JP"',
  '700 32px "Zen Maru Gothic"', '900 32px "Zen Maru Gothic"', '400 32px "Yusei Magic"'];

async function preloadFonts(texts) {
  if (typeof document === 'undefined' || !document.fonts || !document.fonts.load) return;
  const chars = [...new Set(texts.join('') + '0123456789¥円〜・：:ー')].join('');
  const all = Promise.all(FONT_FACES.map(f => document.fonts.load(f, chars).catch(() => null)));
  await Promise.race([all, new Promise(r => setTimeout(r, 5000))]);
}

export async function build(ctx) {
  const L = ctx.L;
  await preloadFonts([...wagashi.TEXTS, ...general.TEXTS, ...ramen.TEXTS, ...bike.TEXTS, ...wagashiInt.TEXTS, ...generalInt.TEXTS, ...ramenInt.TEXTS, ...bikeInt.TEXTS]);
  const K = createKit(ctx);
  K.I = createInst(ctx, K);
  wagashi.buildWagashi(ctx, K, L.lotById('E2'));
  general.buildGeneral(ctx, K, L.lotById('E3'));
  ramen.buildRamen(ctx, K, L.lotById('E5'));
  bike.buildBike(ctx, K, L.lotById('W6'));
  const inst = K.I.finish();
  const st = consolidate(ctx, K, { debug: !!globalThis.process?.env?.SHOPSB_DEBUG });
  if (globalThis.process?.env?.SHOPSB_DEBUG) {
    const tri = (g) => (g.index ? g.index.count : g.attributes.position.count) / 3;
    console.log('shopsB consolidate', JSON.stringify(st));
    console.log('instanced', inst.map(m => `${m.name}:${m.count}x${tri(m.geometry)}=${Math.round(m.count * tri(m.geometry) / 1000)}k`).join(' '), 'total', Math.round(inst.reduce((a, m) => a + m.count * tri(m.geometry), 0) / 1000) + 'k');
    for (const sp of K.spaces) { let t = 0; sp.traverse((o) => { if (o.isMesh && !o.isInstancedMesh) t += tri(o.geometry); }); console.log('static', sp.name, Math.round(t / 1000) + 'k'); }
  }
}
