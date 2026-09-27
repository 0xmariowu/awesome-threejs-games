// player.js initializes its unused atlas on import. Satisfy its cache shape
// without a worker, IndexedDB, generated textures or changes to the original.
export const r = (name, version) => `${name}:${version}`;
export async function n() {
  const plane = (w, h) => ({ w, h, color: new Uint8Array(w * h * 4), normal: new Uint8Array(w * h * 4) });
  return { body: plane(512, 512), cloth: plane(512, 256) };
}
export async function i() { throw new Error('The fixture must not write an atlas cache'); }
