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
const entries = [...provenance.files, ...provenance.dependencies, ...provenance.notices];

test('every original, local dependency and license matches its pinned archive bytes', async () => {
  assert.equal(provenance.files.length, 12);
  assert.equal(provenance.dependencies.length, 3);
  for (const file of entries) {
    const archive = await readFile(path.join(root, file.source));
    const copy = await readFile(path.join(root, file.path));
    assert.equal(hash(archive), file.sha256, file.source);
    assert.equal(hash(copy), file.sha256, file.path);
    assert.deepEqual(copy, archive);
  }
});

test('the four candidate source refs retain their catalog hashes', async () => {
  const catalog = JSON.parse(await readFile(path.join(root, 'catalog/extraction-candidates.json')));
  const candidate = catalog.candidates.find(item => item.id === 'inkwave.3c');
  assert.equal(candidate.source_refs.length, 4);
  for (const ref of candidate.source_refs) {
    assert.equal(provenance.files.find(file => file.source === ref.path)?.sha256, ref.sha256);
  }
});

test('original directory is fully pinned and module imports resolve to pinned copies', async () => {
  const pinned = new Set(entries.map(file => path.resolve(root, file.path)));
  async function walk(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(file);
      else assert.ok(pinned.has(file), `Unpinned file: ${file}`);
    }
  }
  await walk(path.join(example, 'original'));
  await walk(path.join(example, 'vendor'));
  for (const file of [...provenance.files, ...provenance.dependencies]) {
    const absolute = path.resolve(root, file.path);
    const source = await readFile(absolute, 'utf8');
    for (const match of source.matchAll(/(?:import|export)\s[\s\S]*?\bfrom\s*['"]([^'"]+)['"]/g)) {
      const spec = match[1];
      const target = spec === 'three' ? path.join(example, 'vendor/three/build/three.module.js')
        : spec.startsWith('three/addons/') ? path.join(example, 'vendor/three/jsm', spec.slice(13))
        : path.resolve(path.dirname(absolute), spec);
      assert.ok(pinned.has(target), `${file.path} imports unpinned ${spec}`);
    }
  }
});
