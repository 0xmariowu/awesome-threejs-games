import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile, readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const example = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(example, '../..');
const manifest = JSON.parse(await readFile(path.join(example, 'provenance.json')));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
test('all copied originals match their archive source and pinned SHA-256', async () => {
  assert.equal(manifest.author, 'Ruben Marcus');
  assert.equal(manifest.source_url, 'https://www.rubenmarcus.dev/demos/tupi/');
  const disk = (await readdir(path.join(example, 'original'), {recursive: true, withFileTypes: true})).filter(f => f.isFile());
  assert.equal(disk.length, manifest.files.length);
  assert.equal(new Set(manifest.files.map(f => f.path)).size, disk.length);
  for (const f of manifest.files) {
    const relative = path.relative('tupi/public/demos/tupi', f.source);
    assert.ok(!relative.startsWith('..'));
    assert.equal(f.path, path.relative(root, path.join(example, 'original', relative)));
    assert.equal(f.source_url, manifest.source_url + relative);
    assert.equal(hash(await readFile(path.join(root, f.source))), f.sha256, f.source);
    assert.equal(hash(await readFile(path.join(root, f.path))), f.sha256, f.path);
    assert.ok(!path.basename(f.path).startsWith('main-'));
  }
});
test('host imports only the complete pinned local chunk closure, never main', async () => {
  const pinned = new Set(manifest.files.map(f => path.resolve(root, f.path)));
  const visited = new Set();
  async function visit(file) {
    if (visited.has(file)) return;
    visited.add(file);
    assert.ok(!path.basename(file).startsWith('main-'));
    const source = await readFile(file, 'utf8');
    for (const match of source.matchAll(/(?:from\s*|import\s*|import\()["'](\.[^"']+)["']/g)) {
      const next = path.resolve(path.dirname(file), match[1]);
      assert.ok(next.startsWith(example + path.sep));
      if (next.includes('/original/')) assert.ok(pinned.has(next), next);
      await visit(next);
    }
  }
  await visit(path.join(example, 'src/main.js'));
  for (const file of pinned) if (file.endsWith('.js')) assert.ok(visited.has(file), `Unused original chunk: ${file}`);
});
test('shared UI copies and independent server configuration stay exact', async () => {
  for (const file of ['ui.js', 'ui.css']) assert.deepEqual(await readFile(path.join(example, 'src', file)), await readFile(path.join(root, 'examples/_shared', file)));
  const config = JSON.parse(await readFile(path.join(example, 'local.json')));
  assert.deepEqual(config, {root: '.', entry: '/index.html', port: 8133});
});
