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

test('every original and archive source matches its pinned SHA-256', async () => {
  assert.equal(provenance.files.length, 73);
  for (const file of provenance.files) {
    const relative = path.relative('tidewater/upstream/src', file.source);
    assert.ok(!relative.startsWith('..'));
    assert.equal(file.path, `examples/tidewater-ocean/original/${relative}`);
    assert.equal(hash(await readFile(path.join(root, file.source))), file.sha256, file.source);
    assert.equal(hash(await readFile(path.join(root, file.path))), file.sha256, file.path);
  }
  assert.deepEqual(await readFile(path.join(example, 'LICENSE')), await readFile(path.join(root, 'tidewater/upstream/LICENSE')));
});

test('originals are exactly the complete local import closure, with no game bootstrap', async () => {
  const pinned = new Set(provenance.files.map(file => path.resolve(root, file.path)));
  const disk = await readdir(path.join(example, 'original'), { recursive: true, withFileTypes: true });
  assert.equal(disk.filter(file => file.isFile()).length, pinned.size);
  const visited = new Set();
  async function visit(file) {
    if (visited.has(file)) return;
    assert.ok(pinned.has(file), `Unpinned dependency: ${file}`);
    visited.add(file);
    const source = await readFile(file, 'utf8');
    for (const match of source.matchAll(/(?:from\s+|import\s*)['"]([^'"]+)['"]/g)) {
      assert.ok(match[1].startsWith('.'), `External dependency: ${match[1]}`);
      await visit(path.resolve(path.dirname(file), match[1]));
    }
  }
  for (const entry of ['ocean/OceanFFT.js', 'ocean/WaterSurface.js', 'ocean/WaterQuery.js', 'player/BoatController.js', 'world/BoatModel.js', 'core/Input.js']) {
    await visit(path.join(example, 'original', entry));
  }
  assert.equal(visited.size, pinned.size);
  assert.ok(!provenance.files.some(file => /\/(App|main)\.js$/.test(file.source)));
});

test('candidate source references remain pinned verbatim', async () => {
  const catalog = JSON.parse(await readFile(path.join(root, 'catalog/extraction-candidates.json')));
  const candidates = Array.isArray(catalog) ? catalog : catalog.candidates;
  const candidate = candidates.find(item => item.id === 'tidewater.ocean-query');
  for (const ref of candidate.source_refs) {
    assert.equal(provenance.files.find(file => file.source === ref.path)?.sha256, ref.sha256);
  }
});
