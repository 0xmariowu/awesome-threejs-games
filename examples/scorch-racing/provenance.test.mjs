import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir, mkdtemp, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';
import vm from 'node:vm';
import { build, select, verifyOriginals } from './build.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const manifest = JSON.parse(await readFile(path.join(here, 'provenance.json')));
const hash = data => createHash('sha256').update(data).digest('hex');
const bytes = await readFile(path.join(here, 'original/index.html'));

test('the sole original is the entire pinned candidate HTML, byte for byte', async () => {
  assert.deepEqual(await readdir(path.join(here, 'original')), ['index.html']);
  assert.equal(manifest.files.length, 1);
  const [file] = manifest.files;
  assert.equal(file.source, 'scorch-podracer/public/index.html');
  assert.equal(file.sha256, '2dbb6cb98d570211867f6aa2ea2a69d3ad0675dddd270e3a963d43e2846e4c0e');
  assert.deepEqual(bytes, await readFile(path.join(root, file.source)));
  await verifyOriginals();
});

test('each selection is a complete parsable source block with its own pinned hash', () => {
  assert.deepEqual(manifest.blocks.map(block => block.name), [
    'math-palette', 'procedural-assets-track', 'race-constants', 'barriers',
    'racer-forces', 'player-input', 'pod-pose',
  ]);
  for (const block of [manifest.vendor, ...manifest.blocks]) {
    assert.ok(block.end > block.start && block.start >= 0 && block.end <= bytes.length);
    assert.doesNotThrow(() => new vm.Script(select(bytes, block)), block.name);
    const tampered = Buffer.from(bytes);
    tampered[block.start] ^= 1;
    assert.throws(() => select(tampered, block), /Source block changed/);
  }
  const forces = select(bytes, manifest.blocks.find(b => b.name === 'racer-forces'));
  for (const name of ['Racer', 'yawCap', 'landed', 'impact', 'stepRacer']) assert.ok(forces.includes(name));
  assert.ok(!forces.includes('function aiInput'));
});

test('packaging preserves original source text and rechecks the archive', async t => {
  const out = await mkdtemp(path.join(os.tmpdir(), 'gameref-package-'));
  t.after(() => rm(out, {recursive: true, force: true}));
  const archive = path.join(root, manifest.files[0].source);
  const before = hash(await readFile(archive));
  await build(out);
  assert.equal(hash(await readFile(archive)), before);
  const runtime = await readFile(path.join(out, 'runtime.mjs'), 'utf8');
  for (const block of manifest.blocks) assert.ok(runtime.includes(select(bytes, block)), block.name);
  assert.equal(await readFile(path.join(out, 'three.js'), 'utf8'), select(bytes, manifest.vendor));
  for (const name of ['index.html', 'host.mjs', 'shims.mjs', 'style.css']) {
    assert.deepEqual(await readFile(path.join(out, name)), await readFile(path.join(here, 'src', name)));
  }
  const config = JSON.parse(await readFile(path.join(here, 'local.json')));
  assert.deepEqual(config, { root: 'public', entry: '/index.html', port: 8115 });
});
