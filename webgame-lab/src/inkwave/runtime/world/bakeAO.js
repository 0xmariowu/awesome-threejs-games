import { DataTexture, RedFormat, UnsignedByteType, LinearFilter, Vector3 } from 'three';
import { Hit } from '../game/physics.js';

/** Static hemisphere visibility, baked into Level's independent lighting atlas.
 * Inject collision queries; no renderer or readback is required. Re-bake after geometry changes.
 */
export async function bakeAO(level, physics, { ppm = 3, size = 512, samples = 20, radius = 2.4, cancelled = () => false } = {}) {
  if (!level.layoutLightmap(ppm, size, 2)) throw new Error('AO atlas is too small for this layout');
  const data = new Uint8Array(size * size).fill(255);
  const origin = new Vector3(), direction = new Vector3(), hit = new Hit();
  const hemisphere = Array.from({ length: samples }, (_, i) => {
    const r = Math.sqrt((i + .5) / samples), phi = i * 2.399963229728653;
    return [r * Math.cos(phi), r * Math.sin(phi), Math.sqrt(1 - r * r)];
  });
  let rays = 0;
  for (const face of level.faces) {
    if (cancelled()) return null;
    if (!face.light) continue;
    const { x, y, pad } = face.light;
    const width = Math.ceil(face.su * ppm), height = Math.ceil(face.sv * ppm);
    for (let v = -pad; v < height + pad; v++) for (let u = -pad; u < width + pad; u++) {
      const s = Math.min(face.su - .001, Math.max(.001, (u + .5) / ppm));
      const t = Math.min(face.sv - .001, Math.max(.001, (v + .5) / ppm));
      origin.copy(face.origin).addScaledVector(face.u, s).addScaledVector(face.v, t).addScaledVector(face.n, .025);
      let occlusion = 0;
      for (const [du, dv, dn] of hemisphere) {
        direction.copy(face.u).multiplyScalar(du).addScaledVector(face.v, dv).addScaledVector(face.n, dn);
        physics.raycast(origin, direction, radius, hit, true);
        if (hit.hit) occlusion += 1 - hit.dist / radius;
        rays++;
      }
      data[(y + pad + v) * size + x + pad + u] = Math.round(255 * Math.max(.2, 1 - occlusion / samples));
    }
    // Yield between faces so navigation/unmount can cancel long bakes.
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  if (cancelled()) return null;
  const texture = new DataTexture(data, size, size, RedFormat, UnsignedByteType);
  texture.minFilter = texture.magFilter = LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  texture.userData = { rays, samples, radius, ppm, layoutHash: level.layoutHash };
  return texture;
}
