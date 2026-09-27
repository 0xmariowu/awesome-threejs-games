import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { updateFog } from './src/fog.mjs';

const root = new URL('../../', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('./provenance.json', import.meta.url)));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

test('all four originals and archive sources retain pinned bytes', async () => {
  const names = ['atmosphere.ts', 'input.ts', 'scene.ts', 'simulation.ts'];
  assert.deepEqual((await readdir(new URL('./original/', import.meta.url))).sort(), names);
  assert.deepEqual(manifest.files.map(file => file.source.split('/').at(-1)).sort(), names);
  for (const file of manifest.files) {
    assert.equal(hash(await readFile(new URL(file.source, root))), file.sha256, file.source);
    assert.equal(hash(await readFile(new URL(file.path, root))), file.sha256, file.path);
  }
});

test('the single landmark asset and any built copy match the archive', async () => {
  assert.equal(manifest.assets.length, 1);
  assert.equal(manifest.assets[0].source, 'cloudkeep/public/assets/island-distant.glb');
  for (const asset of manifest.assets) {
    const source = await readFile(new URL(asset.source, root));
    assert.equal(hash(source), asset.sha256);
    assert.equal(source.length, asset.bytes);
    let copy;
    try { copy = await readFile(new URL(asset.path, root)); }
    catch (error) { if (error.code === 'ENOENT') continue; throw error; }
    assert.deepEqual(copy, source);
  }
});

test('MIT notice is preserved byte-for-byte', async () => {
  assert.deepEqual(await readFile(new URL('./LICENSE', import.meta.url)),
    await readFile(new URL('cloudkeep/upstream/LICENSE', root)));
});

test('host fog agrees with the pinned scene block through entry and exit at varied frame rates', async () => {
  const source = await readFile(new URL('./original/scene.ts', import.meta.url), 'utf8');
  const block = source.match(/this\.cloudImmersion \+=.*\n    const fog = this\.scene\.fog as THREE\.Fog;\n    fog\.near = .*\n    fog\.far = .*;/)?.[0];
  assert.ok(block, 'Original fog block must be present');
  // Execute the archive's actual statements as an independent oracle.
  const original = new Function('dt', 'THREE', block.replace(' as THREE.Fog', ''));
  const THREE = { MathUtils: { lerp: (a, b, t) => (1 - t) * a + t * b } };
  for (const hz of [24, 60, 120]) {
    let mist = 0, immersion = 0;
    const fog = {};
    const reference = { cloudImmersion: 0, atmosphere: { localMist: () => mist }, camera: { position: {} }, scene: { fog: {} } };
    for (const target of [0, .4, 1, 0]) {
      mist = target;
      for (let i = 0; i < hz * 3; i++) {
        original.call(reference, 1 / hz, THREE);
        immersion = updateFog(fog, immersion, mist, 1 / hz);
        assert.ok(Math.abs(immersion - reference.cloudImmersion) < 1e-12);
        assert.ok(Math.abs(fog.near - reference.scene.fog.near) < 1e-10);
        assert.ok(Math.abs(fog.far - reference.scene.fog.far) < 1e-10);
      }
    }
    assert.ok(fog.far > 389, 'Fog clears after leaving the bank');
  }
});
