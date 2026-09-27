// characters — the people, cats and sparrows of 桜ヶ丘 (SPEC 十四).
// Every figure is ONE skinned mesh (vertex colours + a small painted atlas), animated as a pure
// function of t (plus light smoothing): breathing, weight shifts, blinking, gestures, a walk cycle,
// and hair / skirts moved by ctx.shared.uWind / uGust through skirt & hair bones (GPU skinning, so the
// outline pre-pass follows the pose).
import { makeCast } from './characters/cast.js';
import { makeAnimals } from './characters/animals.js';
import { devProps } from './characters/devprops.js';

export async function build(ctx) {
  // DEV only (?only=...,characters/devprops): grey stand-ins for neighbours' props, built first so the poses
  // (e.g. the crossing girl's grip on her bike) see them exactly like the real neighbours' objects.
  try { devProps(ctx); } catch (e) { /* dev helper only */ }
  const actors = [];
  try { actors.push(...makeCast(ctx)); } catch (e) { console.error('[characters] cast', e); throw e; }
  try { actors.push(...makeAnimals(ctx)); } catch (e) { console.error('[characters] animals', e); throw e; }
  const cam = ctx.camera;
  let frame = 0;
  ctx.onUpdate((dt, t) => {
    frame++;
    for (const a of actors) {
      // far-away figures update at a lower rate (poses are functions of t, so this is seamless)
      if (a.h && cam && dt > 0) {
        const p = a.h.group.position;
        const d2 = (p.x - cam.position.x) ** 2 + (p.z - cam.position.z) ** 2;
        if (d2 > 90 * 90 && (frame + (a.slot ?? 0)) % 4) continue;
      }
      a.update(t, dt);
    }
  });
}
