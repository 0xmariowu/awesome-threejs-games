import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';

const root = new URL('../../', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('./provenance.json', import.meta.url)));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

test('the complete eight-module extraction matches original archive bytes', async () => {
  assert.equal(manifest.files.length, 8);
  assert.deepEqual((await readdir(new URL('./original/', import.meta.url))).sort(),
    manifest.files.map(file => file.source.split('/').pop()).sort());
  for (const file of manifest.files) {
    const name = file.source.split('/').pop();
    assert.equal(file.source, `monolith-wilds/assets/${name}`);
    assert.equal(file.path, `examples/monolith-terrain/original/${name}`);
    assert.equal(hash(await readFile(new URL(file.source, root))), file.sha256, file.source);
    assert.equal(hash(await readFile(new URL(file.path, root))), file.sha256, file.path);
  }
});

test('candidate terrain and worker hashes match the extraction manifest', async () => {
  const catalog = JSON.parse(await readFile(new URL('catalog/extraction-candidates.json', root)));
  const candidate = catalog.candidates.find(entry => entry.id === 'monolith-wilds.terrain');
  for (const ref of candidate.source_refs) {
    assert.equal(manifest.files.find(file => file.source === ref.path)?.sha256, ref.sha256);
  }
});

test('local launch is build-free and uses reserved port 8123', async () => {
  const config = JSON.parse(await readFile(new URL('./local.json', import.meta.url)));
  assert.deepEqual(config, { root: '.', entry: '/index.html', port: 8123 });
  await readFile(new URL(`.${config.entry}`, import.meta.url));
});
