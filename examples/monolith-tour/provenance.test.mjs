import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../../', import.meta.url));
const example = path.join(root, 'examples/monolith-tour');
const provenance = JSON.parse(await readFile(path.join(example, 'provenance.json'), 'utf8'));
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const expected = ['biome-DstsBN7N.js', 'controls-DX7CeMlr.js', 'obstacles-DQBr1hBF.js', 'three.core-DtjtRha-.js', 'three.module-e53_FFk2.js', 'tour-Do76daLD.js'];

test('exactly six complete original modules are pinned and unchanged in both locations', async () => {
  assert.deepEqual((await readdir(path.join(example, 'original'))).sort(), expected);
  assert.deepEqual(provenance.files.map(file => path.basename(file.path)).sort(), expected);
  for (const file of provenance.files) {
    assert.equal(file.source, `monolith-wilds/assets/${path.basename(file.path)}`);
    assert.equal(file.path, `examples/monolith-tour/original/${path.basename(file.path)}`);
    assert.equal(sha256(await readFile(path.join(root, file.source))), file.sha256, file.source);
    assert.equal(sha256(await readFile(path.join(root, file.path))), file.sha256, file.path);
  }
});

test('import map replaces only the biome world-entry dependency, never camera logic', async () => {
  const html = await readFile(path.join(example, 'index.html'), 'utf8');
  const map = JSON.parse(html.match(/<script type="importmap">\s*([\s\S]*?)\s*<\/script>/)[1]);
  assert.deepEqual(map, { imports: { './original/index-DGqtqlWq.js': './src/world-shim.js' } });
  const available = new Set(expected);
  for (const name of expected) {
    const source = await readFile(path.join(example, 'original', name), 'utf8');
    for (const [, dependency] of source.matchAll(/from["']\.\/([^"']+)["']/g)) {
      assert.ok(available.has(dependency) || (name === 'biome-DstsBN7N.js' && dependency === 'index-DGqtqlWq.js'), `${name} -> ${dependency}`);
    }
  }
  const shim = await import('./src/world-shim.js');
  assert.equal(shim.s(200, -150), 0);
  assert.throws(() => shim.m.noise2(0, 0), /outside this example/);
});
