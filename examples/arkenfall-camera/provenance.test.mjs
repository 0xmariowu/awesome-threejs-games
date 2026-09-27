import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const example = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(example, '../..');
const provenance = JSON.parse(await readFile(path.join(example, 'provenance.json'), 'utf8'));
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const read = relative => readFile(path.join(root, relative));

test('all five original modules match both archive bytes and pinned SHA-256', async () => {
  const names = ['camera-CsWg7FPD.js', 'contracts-CvM_HOZo.js', 'math-CaZ96FWb.js', 'three.core-_y2F91K_.js', 'three.module-DGcYoYN8.js'].sort();
  assert.deepEqual((await readdir(path.join(example, 'original'))).sort(), names);
  assert.deepEqual(provenance.files.map(file => path.basename(file.source)).sort(), names);
  for (const file of provenance.files) {
    assert.equal(file.source, `arkenfall/public/assets/${path.basename(file.source)}`);
    assert.equal(file.path, `examples/arkenfall-camera/original/${path.basename(file.source)}`);
    assert.equal(sha256(await read(file.source)), file.sha256, file.source);
    assert.equal(sha256(await read(file.path)), file.sha256, file.path);
  }
  const candidates = JSON.parse(await read('catalog/extraction-candidates.json'));
  assert.equal(provenance.files[0].sha256, candidates.candidates.find(c => c.id === 'arkenfall.camera').source_refs[0].sha256);
});

test('reference modules remain pinned and the host shim preserves original sensitivity', async () => {
  for (const file of provenance.references) assert.equal(sha256(await read(file.source)), file.sha256, file.source);
  const game = (await read('arkenfall/public/assets/Game-BmRmdldn.js')).toString();
  assert.match(game, /N=\{x:\.0022,y:\.0019\}/);
  assert.match(game, /lock:\[`Tab`,`Mouse1`\]/);
  const { i } = await import('./src/game-shim.js');
  assert.deepEqual(i, { x: 0.0022, y: 0.0019 });
  const { r } = await import('./src/material-shim.js');
  assert.equal(r.uFade.value, 1);
});

test('original import graph closes through copied modules and exactly two host shims', async () => {
  const html = await readFile(path.join(example, 'index.html'), 'utf8');
  const map = JSON.parse(html.match(/<script type="importmap">\s*([\s\S]*?)<\/script>/)[1]);
  assert.deepEqual(map.imports, {
    './original/Game-BmRmdldn.js': './src/game-shim.js',
    './original/material-Di0Yd9td.js': './src/material-shim.js',
  });
  const copied = new Set(provenance.files.map(file => path.basename(file.path)));
  for (const file of provenance.files) {
    const source = (await read(file.path)).toString();
    for (const [, dependency] of source.matchAll(/from["']\.\/([^"']+)["']/g)) {
      assert.ok(copied.has(dependency) || map.imports[`./original/${dependency}`], `${file.path}: ${dependency}`);
    }
  }
  assert.deepEqual(JSON.parse(await readFile(path.join(example, 'local.json'))), { root: '.', entry: '/index.html', port: 8112 });
});
