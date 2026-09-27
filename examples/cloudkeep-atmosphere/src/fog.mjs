// Adapted from original/scene.ts lines 290–293. The original is pinned, not imported.
export function updateFog(fog, immersion, localMist, dt) {
  immersion += (localMist - immersion) * (1 - Math.exp(-dt * 2));
  fog.near = 100 + (3 - 100) * immersion;
  fog.far = 390 + (75 - 390) * immersion;
  return immersion;
}
