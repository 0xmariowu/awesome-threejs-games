import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const example = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(example, '../..');
const provenance = JSON.parse(await readFile(path.join(example, 'provenance.json')));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
test('provenance covers exactly the original dependency closure', async () => {
  const names = ['combat.js', 'elements.js', 'i18n.js', 'languages.js', 'more-locales.js', 'three.module.js', 'util.js'];
  assert.deepEqual((await readdir(path.join(example, 'original'))).sort(), names);
  assert.deepEqual(provenance.files.map(file => path.basename(file.path)).sort(), names);
  for (const file of provenance.files) {
    const name = path.basename(file.path);
    assert.equal(file.path, `examples/vox-reactions/original/${name}`);
    assert.equal(file.source, name === 'three.module.js'
      ? 'vox-arcana/public/_external/cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js'
      : `vox-arcana/public/js/${name}`);
  }
});
test('copies and archive sources match every pinned SHA-256', async () => {
  for (const file of provenance.files) {
    assert.equal(hash(await readFile(path.join(root, file.source))), file.sha256, file.source);
    assert.equal(hash(await readFile(path.join(root, file.path))), file.sha256, file.path);
  }
});
test('candidate source hashes remain the source of truth', async () => {
  const catalog = JSON.parse(await readFile(path.join(root, 'catalog/extraction-candidates.json')));
  const candidate = catalog.candidates.find(item => item.id === 'vox-arcana.reactions');
  for (const source of candidate.source_refs) {
    assert.equal(provenance.files.find(file => file.source === source.path).sha256, source.sha256);
  }
});
