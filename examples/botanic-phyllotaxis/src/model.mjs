// Independent geometric rules. No source or assets from the inspiration tool.
export const GOLDEN_ANGLE = 180 * (3 - Math.sqrt(5));
export function random(seed) {
  let s = seed >>> 0;
  return () => { s += 0x6D2B79F5; let t = Math.imul(s ^ s >>> 15, 1 | s); t ^= t + Math.imul(t ^ t >>> 7, 61 | t); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
export function arrangement({type = 'spiral', count = 34, angle = 137.5, spacing = .15, taper = .65, seed = 42} = {}) {
  const rng = random(seed), phase = rng() * Math.PI * 2;
  return Array.from({length: count}, (_, i) => {
    let node = i, degrees = i * angle;
    if (type === 'alternate') degrees = i * 180;
    if (type === 'opposite') { node = Math.floor(i / 2); degrees = (i % 2) * 180; }
    if (type === 'decussate') { node = Math.floor(i / 2); degrees = node * 90 + (i % 2) * 180; }
    if (type === 'whorled') { node = Math.floor(i / 3); degrees = node * 60 + (i % 3) * 120; }
    const theta = degrees * Math.PI / 180 + phase;
    const radius = type === 'sunflower' ? .105 * Math.sqrt(i + .5) : 0;
    return {x: Math.cos(theta) * radius, y: type === 'sunflower' ? .65 + .14 * (1 - i / count) : .25 + node * spacing,
      z: Math.sin(theta) * radius, theta, node, size: (1 - taper * i / count) * (.95 + rng() * .1), tone: rng()};
  });
}
export function packingDistance(points) {
  // Mean nearest-neighbour distance in the fixed-area Vogel head, not a universal optimality claim.
  return points.reduce((sum, a, i) => sum + Math.sqrt(Math.min(...points.filter((_, j) => i !== j).map(b => (a.x-b.x)**2+(a.z-b.z)**2))), 0) / points.length;
}
