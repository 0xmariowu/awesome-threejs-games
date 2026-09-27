import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const example = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(example, '../..');
const provenance = JSON.parse(await readFile(path.join(example, 'provenance.json'), 'utf8'));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const prefix = 'examples/shabondama-bubble/original/';
const expected = [
  'render/bubbles.js', 'render/glsl.js', 'render/post.js', 'render/sky.js',
  'render/terrain.js', 'render/water.js', 'render/worldtex.js', 'util/noise.js',
  'vendor/three.core.js', 'vendor/three.module.js', 'world/gen.js', 'world/layout.js',
];

test('provenance covers exactly the original modules and archived Three r186', async () => {
  const actual = (await readdir(path.join(example, 'original'), { recursive: true, withFileTypes: true }))
    .filter(entry => entry.isFile())
    .map(entry => path.relative(path.join(example, 'original'), path.join(entry.parentPath, entry.name))).sort();
  assert.deepEqual(actual, expected);
  assert.deepEqual(provenance.files.map(file => file.path.replace(prefix, '')).sort(), expected);
  for (const file of provenance.files) {
    const name = file.path.replace(prefix, '');
    assert.equal(file.source, name.startsWith('vendor/')
      ? `shabondama-biyori/public/_external/cdn.jsdelivr.net/npm/three@0.186.0/build/${path.basename(name)}`
      : `shabondama-biyori/public/_f/1790342986-3d06/src/${name}`);
  }
});

test('every original copy and archive source matches its pinned SHA-256', async () => {
  for (const file of provenance.files) {
    assert.equal(hash(await readFile(path.join(root, file.source))), file.sha256, file.source);
    assert.equal(hash(await readFile(path.join(root, file.path))), file.sha256, file.path);
  }
  for (const file of provenance.references) {
    assert.equal(hash(await readFile(path.join(root, file.source))), file.sha256, file.source);
  }
  const candidates = JSON.parse(await readFile(path.join(root, 'catalog/extraction-candidates.json'), 'utf8'));
  const candidate = candidates.candidates.find(item => item.id === 'shabondama-biyori.bubble');
  const bubble = provenance.files.find(item => item.path.endsWith('/render/bubbles.js'));
  assert.equal(bubble.source, candidate.source_refs[0].path);
  assert.equal(bubble.sha256, candidate.source_refs[0].sha256);
});

test('all static original imports resolve to pinned local copies', async () => {
  const files = new Set(provenance.files.map(file => file.path));
  for (const file of provenance.files) {
    const source = await readFile(path.join(root, file.path), 'utf8');
    for (const match of source.matchAll(/\bfrom\s+['"]([^'"]+)['"]/g)) {
      const specifier = match[1];
      const resolved = specifier === 'three' ? prefix + 'vendor/three.module.js'
        : path.posix.normalize(path.posix.join(path.posix.dirname(file.path), specifier));
      assert.ok(files.has(resolved), `${file.path}: ${specifier} is not pinned`);
    }
  }
});
