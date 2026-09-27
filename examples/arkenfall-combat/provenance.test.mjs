import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const example = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(example, '../..');
const provenance = JSON.parse(await readFile(path.join(example, 'provenance.json')));
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

test('original directory contains exactly the pinned complete modules', async () => {
  assert.deepEqual((await readdir(path.join(example, 'original'))).sort(), provenance.files.map(entry => path.basename(entry.path)).sort());
  for (const name of ['combat-DANZZ0C7.js', 'player-Dy-PiEeW.js', 'Actor-CPc2Vruf.js', 'Animator-CyW8ITDY.js']) {
    assert.ok(provenance.files.some(entry => path.basename(entry.path) === name));
  }
});

test('all original copies and archive sources retain their pinned SHA-256', async () => {
  for (const entry of provenance.files) {
    const archive = await readFile(path.join(root, entry.source));
    const copy = await readFile(path.join(root, entry.path));
    assert.equal(sha256(archive), entry.sha256, entry.source);
    assert.equal(sha256(copy), entry.sha256, entry.path);
    assert.deepEqual(copy, archive);
  }
});

test('reference-only modules retain pinned archive hashes', async () => {
  for (const entry of provenance.references) {
    assert.equal(sha256(await readFile(path.join(root, entry.source))), entry.sha256, entry.source);
  }
});

test('every static original import resolves to an exact copy or an explicit host shim', async () => {
  const html = await readFile(path.join(example, 'index.html'), 'utf8');
  const map = JSON.parse(html.match(/<script type="importmap">\s*([\s\S]*?)<\/script>/)[1]).imports;
  for (const entry of provenance.files) {
    const source = await readFile(path.join(root, entry.path), 'utf8');
    for (const match of source.matchAll(/from\s*["'](\.\/[^"']+)["']/g)) {
      const name = `./original/${match[1].slice(2)}`;
      await readFile(path.resolve(example, map[name] ?? name));
    }
  }
});
