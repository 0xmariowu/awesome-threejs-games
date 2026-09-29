// Seeded, spatially varying Poisson-disk rejection sampler, implemented independently.
export function random(seed) {
  let s = seed >>> 0;
  return () => { s += 0x6D2B79F5; let t = Math.imul(s ^ s >>> 15, 1 | s); t ^= t + Math.imul(t ^ t >>> 7, 61 | t); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const smooth = t => t * t * (3 - 2 * t);
function hash(x, z, seed) {
  let h = Math.imul(x, 374761393) ^ Math.imul(z, 668265263) ^ Math.imul(seed, 1442695041);
  h = Math.imul(h ^ h >>> 13, 1274126177); return ((h ^ h >>> 16) >>> 0) / 4294967295;
}
export function noise(x, z, seed) {
  const ix = Math.floor(x), iz = Math.floor(z), u = smooth(x - ix), v = smooth(z - iz);
  const a = hash(ix, iz, seed) * (1-u) + hash(ix+1, iz, seed) * u;
  const b = hash(ix, iz+1, seed) * (1-u) + hash(ix+1, iz+1, seed) * u;
  return a * (1-v) + b * v;
}
// One bounded clearing per two-metre cell: at default Gaps these cannot
// merge into a tile-wide void. The slider grows their radii, not a noise cutoff.
function inClearing(x, z, gaps, seed) {
  const spacing = 2, cx = Math.floor(x / spacing), cz = Math.floor(z / spacing);
  for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
    const ix = cx + dx, iz = cz + dz;
    const px = spacing * (ix + .5 + (hash(ix, iz, seed + 53) - .5) * .24);
    const pz = spacing * (iz + .5 + (hash(ix, iz, seed + 97) - .5) * .24);
    const radius = Math.sqrt(gaps) * 1.1 * (.85 + .3 * hash(ix, iz, seed + 131));
    if ((x-px)**2 + (z-pz)**2 < radius**2) return true;
  }
  return false;
}
export const SPECIES = ['grass', 'clover', 'broadleaf', 'flowers', 'pebbles'];
export function scatter({size = 8, density = 24, clumping = .65, gaps = .3, mix = [65, 35, 20, 40, 12], seed = 42} = {}) {
  const rng = random(seed), points = [], bins = new Map();
  const distance = .7 / Math.sqrt(density), cell = distance / Math.SQRT2;
  if (!mix.some(v => v > 0)) return {points, distance};
  // Fixed proposal budget makes density/gap changes visible; not forced to refill cleared gaps.
  const attempts = Math.ceil(size * size * density * 2.5);
  for (let n = 0; n < attempts; n++) {
    const x = (rng() - .5) * size, z = (rng() - .5) * size;
    const habitat = noise(x * .8 + 17, z * .8 + 31, seed);
    if (inClearing(x, z, gaps, seed)) continue;
    if (rng() > .55 * (1-clumping) + clumping * habitat ** 2 * 1.7) continue;
    const cx = Math.floor(x / cell), cz = Math.floor(z / cell);
    let near = false;
    for (let dx = -2; dx <= 2 && !near; dx++) for (let dz = -2; dz <= 2 && !near; dz++) {
      const other = bins.get(`${cx+dx},${cz+dz}`);
      if (other && (other.x-x)**2 + (other.z-z)**2 < distance ** 2) near = true;
    }
    if (near) continue;
    // Separate coherent habitat fields give each species local affinity, without excluding rare species.
    const weights = mix.map((weight, i) => weight * (.12 + (1-clumping) + clumping * 3 * noise(x*.65+19*i, z*.65+7*i, seed+i*29)**3));
    let choice = rng() * weights.reduce((a,b) => a+b, 0), species = weights.length-1;
    for (let i = 0; i < weights.length; i++) { choice -= weights[i]; if (choice < 0) { species = i; break; } }
    const point = {x, z, species, rotation: rng()*Math.PI*2, scale: .7+rng()*.65, tone: rng()};
    points.push(point); bins.set(`${cx},${cz}`, point);
  }
  return {points, distance};
}
