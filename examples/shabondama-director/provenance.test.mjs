import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const example = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(example, '../..');
const provenance = JSON.parse(await readFile(path.join(example, 'provenance.json'), 'utf8'));
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const sourceRoot = 'shabondama-biyori/public/_f/1790342986-3d06/src/';

test('provenance covers exactly the original dependency closure', async () => {
  const expected = ['sim/director.js', 'sim/flight.js', 'sim/wind.js', 'util/noise.js', 'vendor/three.core.js', 'vendor/three.module.js', 'world/layout.js'];
  const actual = (await readdir(path.join(example, 'original'), { recursive: true, withFileTypes: true }))
    .filter(item => item.isFile()).map(item => path.relative(path.join(example, 'original'), path.join(item.parentPath, item.name))).sort();
  assert.deepEqual(actual, expected);
  assert.deepEqual(provenance.files.map(item => item.path.replace('examples/shabondama-director/original/', '')).sort(), expected);
  for (const file of provenance.files) {
    const name = file.path.replace('examples/shabondama-director/original/', '');
    assert.equal(file.source, name.startsWith('vendor/')
      ? `shabondama-biyori/public/_external/cdn.jsdelivr.net/npm/three@0.186.0/build/${path.basename(name)}`
      : sourceRoot + name);
  }
});

test('every original copy and archive source matches its pinned SHA-256', async () => {
  for (const file of provenance.files) {
    assert.equal(sha256(await readFile(path.join(root, file.source))), file.sha256, file.source);
    assert.equal(sha256(await readFile(path.join(root, file.path))), file.sha256, file.path);
  }
  for (const file of provenance.references) {
    assert.equal(sha256(await readFile(path.join(root, file.source))), file.sha256, file.source);
  }
});

test('director pin matches the inspected extraction candidate', async () => {
  const catalog = JSON.parse(await readFile(path.join(root, 'catalog/extraction-candidates.json'), 'utf8'));
  const candidate = catalog.candidates.find(item => item.id === 'shabondama-biyori.director');
  const director = provenance.files.find(item => item.source === sourceRoot + 'sim/director.js');
  assert.equal(director.source, candidate.source_refs[0].path);
  assert.equal(director.sha256, candidate.source_refs[0].sha256);
});

test('local launch and import map use self-contained ES modules on port 8113', async () => {
  const local = JSON.parse(await readFile(path.join(example, 'local.json'), 'utf8'));
  assert.deepEqual(local, { root: '.', entry: '/index.html', port: 8113 });
  const html = await readFile(path.join(example, 'index.html'), 'utf8');
  const map = JSON.parse(html.match(/<script type="importmap">(.*?)<\/script>/s)[1]);
  assert.equal(map.imports.three, './original/vendor/three.module.js');
  for (const file of provenance.files) {
    const content = await readFile(path.join(root, file.path), 'utf8');
    for (const match of content.matchAll(/(?:import|export)[^;]*?from\s*['"]([^'"]+)['"]/g)) {
      const specifier = match[1];
      const target = specifier === 'three' ? path.join(example, map.imports.three) : path.resolve(path.dirname(path.join(root, file.path)), specifier);
      assert.ok(provenance.files.some(entry => path.join(root, entry.path) === target), `Unpinned import ${specifier} in ${file.path}`);
    }
  }
});
