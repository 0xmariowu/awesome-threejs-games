// Simple anime-proportioned figures for inside the trains (seen through tinted glass → silhouettes).
// Built from rounded boxes / spheres into a Buckets key. Local frame: origin = seat point (sit)
// or floor point (stand), facing local +Z.
import { M } from './builder.js';

export const OUTFITS = {
  sailor: { top: '#3d4a6e', bottom: '#3d4a6e', collar: '#ecebe6', ribbon: '#d9546a', legs: '#2f2c38', skirt: true },
  blazer: { top: '#4a5372', bottom: '#5a5f6e', collar: '#ecebe6', ribbon: '#8a3a4a', legs: '#2f2c38', skirt: true },
  gakuran: { top: '#2f3140', bottom: '#2f3140', collar: '#2f3140', legs: '#2f3140' },
  suit: { top: '#4b4e5a', bottom: '#4b4e5a', collar: '#e9e9ea', ribbon: '#5a6f9a', legs: '#4b4e5a' },
  coat: { top: '#b9a78a', bottom: '#6d6a74', collar: '#e8e0d0', legs: '#6d6a74' },
  cardigan: { top: '#b8a3c4', bottom: '#8e8a96', collar: '#efe9e4', legs: '#8e8a96', skirt: true },
  hoodie: { top: '#8fa3b5', bottom: '#4f5566', collar: '#8fa3b5', legs: '#4f5566' },
  pinkKnit: { top: '#e3a9b8', bottom: '#d9cfc0', collar: '#f1e6e0', legs: '#6c6674', skirt: true },
  staff: { top: '#2f3a5c', bottom: '#2f3a5c', collar: '#e9eaf0', ribbon: '#c9a04a', legs: '#2f3a5c', cap: '#2f3a5c' },
};
const SKIN = ['#efd3c0', '#e9c9b2', '#f2dccb'];
const HAIR = ['#3a3240', '#4a3a36', '#5b4638', '#6b5a52', '#b8b2b8'];

/** o: { pose:'sit'|'stand', h, outfit, hair, skin, style:'short'|'long'|'bob'|'pony', acc:'phone'|'book'|'bag'|'none', strap: bool, lookDown }. */
export function person(B, key, pos, rotY, o = {}) {
  const f = OUTFITS[o.outfit] || OUTFITS.coat;
  const s = (o.h || 1.62) / 1.62;
  const skin = o.skin || SKIN[0], hair = o.hair || HAIR[0];
  const rbox = (...a) => { while (a.length < 8) a.push(undefined); return B.rbox(...a.slice(0, 8), 1); };
  B.push(M(pos, [0, rotY, 0]));
  const sit = o.pose === 'sit';
  // --- lower body
  let hipY, torsoY;
  if (sit) {
    hipY = 0.06 * s;
    rbox(key, 0.34 * s, 0.15 * s, 0.34 * s, 0.05 * s, [0, hipY, 0], f.bottom);
    for (const sx of [-1, 1]) {
      rbox(key, 0.14 * s, 0.13 * s, 0.4 * s, 0.05 * s, [sx * 0.085 * s, 0.07 * s, 0.2 * s], f.skirt ? f.bottom : f.legs);
      rbox(key, 0.11 * s, 0.4 * s, 0.12 * s, 0.045 * s, [sx * 0.085 * s, -0.16 * s, 0.38 * s], f.legs);
      rbox(key, 0.1 * s, 0.07 * s, 0.2 * s, 0.03 * s, [sx * 0.085 * s, -0.4 * s, 0.44 * s], '#3a3346');
    }
    torsoY = 0.38 * s;
  } else {
    hipY = 0.86 * s;
    for (const sx of [-1, 1]) {
      rbox(key, 0.12 * s, 0.8 * s, 0.13 * s, 0.05 * s, [sx * 0.08 * s, 0.44 * s, 0], f.legs);
      rbox(key, 0.1 * s, 0.07 * s, 0.22 * s, 0.03 * s, [sx * 0.08 * s, 0.035 * s, 0.04 * s], '#3a3346');
    }
    if (f.skirt) B.cyl(key, 0.17 * s, 0.24 * s, 0.34 * s, [0, 0.74 * s, 0], f.bottom, null, 10);
    else rbox(key, 0.33 * s, 0.22 * s, 0.22 * s, 0.06 * s, [0, 0.84 * s, 0], f.bottom);
    torsoY = 1.18 * s;
  }
  // --- torso
  const lean = sit ? -0.08 : 0;
  rbox(key, 0.36 * s, 0.5 * s, 0.22 * s, 0.08 * s, [0, torsoY, sit ? -0.05 * s : 0], f.top, [lean, 0, 0]);
  if (f.collar) rbox(key, 0.3 * s, 0.05 * s, 0.24 * s, 0.02 * s, [0, torsoY + 0.24 * s, (sit ? -0.05 : 0) * s], f.collar);
  if (f.ribbon) B.box(key, 0.08 * s, 0.1 * s, 0.03 * s, [0, torsoY + 0.16 * s, (sit ? 0.06 : 0.11) * s], f.ribbon);
  // --- head
  const hy = torsoY + 0.44 * s, hz = sit ? -0.06 * s : 0;
  const down = o.lookDown ? 0.03 : 0;
  B.sphere(key, 0.105 * s, [0, hy - down, hz + down], skin, 8);
  B.sphere(key, 0.118 * s, [0, hy + 0.03 * s - down, hz - 0.02 * s], hair, 8, [1, 0.92, 1]);
  const style = o.style || 'short';
  if (style === 'long') rbox(key, 0.24 * s, 0.34 * s, 0.1 * s, 0.05 * s, [0, hy - 0.14 * s, hz - 0.08 * s], hair);
  if (style === 'bob') rbox(key, 0.25 * s, 0.16 * s, 0.2 * s, 0.07 * s, [0, hy - 0.05 * s, hz - 0.03 * s], hair);
  if (style === 'pony') B.sphere(key, 0.06 * s, [0, hy - 0.02 * s, hz - 0.15 * s], hair, 8);
  if (f.cap) { B.cyl(key, 0.115 * s, 0.12 * s, 0.07 * s, [0, hy + 0.09 * s, hz], f.cap, null, 12); B.box(key, 0.16 * s, 0.015 * s, 0.09 * s, [0, hy + 0.06 * s, hz + 0.12 * s], '#2a2f40'); B.box(key, 0.05 * s, 0.03 * s, 0.01 * s, [0, hy + 0.1 * s, hz + 0.118 * s], '#d9b54a'); }
  // --- arms
  const shY = torsoY + 0.2 * s;
  for (const sx of [-1, 1]) {
    const x = sx * 0.21 * s;
    if (!sit && o.strap && sx === 1) {
      rbox(key, 0.09 * s, 0.62 * s, 0.09 * s, 0.04 * s, [x + 0.02 * s, shY + 0.3 * s, 0.02 * s], f.top, [0, 0, -0.08 * sx]);
      B.sphere(key, 0.045 * s, [x + 0.04 * s, shY + 0.63 * s, 0.02 * s], o.glove || skin, 8);
    } else if (o.acc === 'phone' || o.acc === 'book' || o.hands) {
      rbox(key, 0.085 * s, 0.28 * s, 0.09 * s, 0.04 * s, [x, shY - 0.13 * s, (sit ? -0.02 : 0.02) * s], f.top, [0.3, 0, 0]);
      rbox(key, 0.08 * s, 0.08 * s, 0.26 * s, 0.035 * s, [x * 0.75, shY - 0.28 * s, 0.14 * s], f.top, [-0.35, 0, 0]);
    } else {
      rbox(key, 0.085 * s, 0.52 * s, 0.09 * s, 0.04 * s, [x, shY - 0.25 * s, sit ? 0.02 * s : 0], f.top, [sit ? -0.5 : 0, 0, 0.05 * sx]);
    }
  }
  if (o.acc === 'phone') B.box(key, 0.07 * s, 0.13 * s, 0.012 * s, [0, shY - 0.22 * s, 0.28 * s], '#3d4452', [-0.7, 0, 0]);
  if (o.acc === 'book') B.box(key, 0.2 * s, 0.14 * s, 0.03 * s, [0, shY - 0.24 * s, 0.27 * s], '#e9e3d6', [-0.8, 0, 0]);
  if (o.acc === 'bag') rbox(key, 0.32 * s, 0.22 * s, 0.12 * s, 0.04 * s, [0, sit ? 0.2 * s : 0.9 * s, sit ? 0.3 * s : 0.16 * s], o.bagColor || '#4a4252');
  if (o.acc === 'backpack') rbox(key, 0.3 * s, 0.38 * s, 0.16 * s, 0.06 * s, [0, torsoY, -0.18 * s], o.bagColor || '#6a8aa8');
  B.pop();
}

export function pickLook(r) {
  const outfits = ['sailor', 'blazer', 'gakuran', 'suit', 'coat', 'cardigan', 'hoodie', 'pinkKnit'];
  const outfit = r.pick(outfits);
  const female = ['sailor', 'blazer', 'cardigan', 'pinkKnit'].includes(outfit) || (outfit === 'coat' && r.chance(0.6));
  return {
    outfit, h: female ? r.range(1.5, 1.62) : r.range(1.62, 1.76),
    hair: outfit === 'cardigan' && r.chance(0.6) ? HAIR[4] : r.pick(HAIR.slice(0, 4)),
    skin: r.pick(SKIN),
    style: female ? r.pick(['long', 'bob', 'pony', 'long']) : 'short',
    acc: r.pick(['phone', 'phone', 'book', 'bag', 'none', 'backpack']),
    bagColor: r.pick(['#4a4252', '#8a5a4a', '#6a8aa8', '#c98a9a', '#5f7a5a']),
  };
}
