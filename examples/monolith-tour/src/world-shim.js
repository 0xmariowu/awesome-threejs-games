// biome's only live dependency in this host is heightAt. At height 0 its
// original tree-density function returns 0 before consulting noise or layout.
// Resolve the full game's entry import here to prevent its world boot side effect.
export const s = () => 0;
const unavailable = () => { throw new Error('Non-flat biome queries are outside this example'); };
export const _ = Object.freeze({});
export const m = Object.freeze({ fbm2: unavailable, noise2: unavailable });
export { unavailable as c, unavailable as l, unavailable as p, unavailable as v };
