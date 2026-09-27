// Side-effect adapters only. Physics, track queries and pose logic stay original.
export const G = { t: 0, raceT: 0, phase: 'race', autoPlayer: false, shake: 0 };
export const AUDIO = { hit() {}, boost() {}, lap() {} };
export const UI = { toast() {} };
export const fx = { burst() {}, emit() {} };
export const post = { compU: { uHit: { value: 0 }, uFlash: { value: 0 } } };

// The original procedural texture builder queries this renderer's anisotropy.
export let renderer;
export function setRenderer(value) { renderer = value; }
