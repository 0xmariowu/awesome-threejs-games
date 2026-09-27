import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const example = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(example, '../..');
const provenance = JSON.parse(await readFile(path.join(example, 'provenance.json')));
const hash = data => createHash('sha256').update(data).digest('hex');
test('all 17 original modules and their archive sources match pinned SHA-256', async () => {
  assert.equal(provenance.files.length, 17);
  const copies = (await readdir(path.join(example, 'original'), { recursive: true }))
    .filter(name => name.endsWith('.js')).map(name => `examples/moritsuki-characters/original/${name}`).sort();
  assert.deepEqual(copies, provenance.files.map(f => f.path).sort());
  for (const file of provenance.files) {
    assert.equal(hash(await readFile(path.join(root, file.source))), file.sha256, file.source);
    assert.equal(hash(await readFile(path.join(root, file.path))), file.sha256, file.path);
  }
});
test('every original relative import and worker entry resolves to a pinned copy', async () => {
  const copies = new Set(provenance.files.map(f => path.resolve(root, f.path)));
  for (const file of provenance.files) {
    const source = await readFile(path.join(root, file.path), 'utf8');
    for (const match of source.matchAll(/(?:from\s*|import\s*|new URL\()['"]([^'"]+)['"]/g)) {
      if (match[1] === 'three') continue;
      assert.ok(match[1].startsWith('.'), `Unexpected dependency: ${match[1]}`);
      assert.ok(copies.has(path.resolve(root, path.dirname(file.path), match[1])), match[1]);
    }
  }
});
