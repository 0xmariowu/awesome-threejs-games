import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const example = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(example, '../..');
const provenance = JSON.parse(await readFile(path.join(example, 'provenance.json')));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const expected = ['config.js', 'core/ctx.js', 'game/physics.js', 'game/weapons.js',
  'world/level.js', 'world/levelMaterial.js', 'world/maps.js', 'world/paint.js', 'world/texlib.js'];

test('manifest lists the complete unchanged module closure, with no unpinned originals', async () => {
  assert.deepEqual(provenance.files.map(file => file.source.replace('inkwave/src/', '')).sort(), expected);
  const entries = await readdir(path.join(example, 'original'), { recursive: true, withFileTypes: true });
  assert.equal(entries.filter(entry => entry.isFile()).length, expected.length);
  for (const file of provenance.files) {
    const name = file.source.replace('inkwave/src/', '');
    assert.equal(file.path, `examples/inkwave-paint/original/${name}`);
  }
  const candidates = JSON.parse(await readFile(path.join(root, 'catalog/extraction-candidates.json')));
  for (const ref of candidates.candidates.find(c => c.id === 'inkwave.paint').source_refs) {
    assert.equal(provenance.files.find(f => f.source === ref.path)?.sha256, ref.sha256);
  }
});

test('archive modules, byte copies, license notices and renderer dependencies match pinned SHA-256', async () => {
  for (const file of [...provenance.files, ...provenance.assets, ...provenance.dependencies]) {
    assert.equal(hash(await readFile(path.join(root, file.source))), file.sha256, file.source);
    if (file.path) assert.equal(hash(await readFile(path.join(root, file.path))), file.sha256, file.path);
  }
});

test('every relative original import resolves to another pinned original', async () => {
  const pinned = new Set(provenance.files.map(file => path.resolve(root, file.path)));
  for (const file of provenance.files) {
    const absolute = path.join(root, file.path);
    const source = await readFile(absolute, 'utf8');
    for (const [, specifier] of source.matchAll(/^import .*? from ['"]([^'"]+)['"]/gm)) {
      if (specifier === 'three') continue;
      assert.ok(pinned.has(path.resolve(path.dirname(absolute), specifier)), `${file.path}: ${specifier}`);
    }
  }
});
