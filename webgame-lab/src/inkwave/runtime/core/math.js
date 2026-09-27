// Derived from INKWAVE (MIT), 0xmariowu, revision 11ce485. See ../PROVENANCE.json and ../LICENSE.
// ---- small math helpers shared by core modules ----
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));
export const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export function angleDiff(a, b) { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; }
export function dampAngle(a, b, lambda, dt) { return a + angleDiff(a, b) * (1 - Math.exp(-lambda * dt)); }

// Deterministic hash → [0,1)
export function hash1(n) { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453123; return s - Math.floor(s); }

// Seeded RNG (mulberry32)
export function rng(seed) {
  let a = seed >>> 0;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
