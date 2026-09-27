import assert from 'node:assert/strict';
import { readFile, readdir, mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { archiveRoot, build, localize, sha256 } from './build.mjs';

const read = relative => readFile(path.join(archiveRoot, relative));
const manifest = JSON.parse(await read('provenance/manifest.json'));
const original = await read('original/antikythera.html');
const expectedHash = '599526d78f11b396f36736595e55aee16c4f11d8794565507a493a1e8d41fad0';

async function filesUnder(directory) {
  const result = [];
  for (const entry of await readdir(path.join(archiveRoot, directory), { withFileTypes: true })) {
    const relative = `${directory}/${entry.name}`;
    if (entry.isDirectory()) result.push(...await filesUnder(relative));
    else result.push(relative);
  }
  return result.sort();
}

test('original matches the owner-supplied byte count and frozen SHA-256', () => {
  assert.equal(original.length, 3587114);
  assert.equal(sha256(original), expectedHash);
  assert.equal(manifest.original.sha256, expectedHash);
});

test('only the six authorized patches change the runtime, each exactly once', async () => {
  // Independent textual reconstruction, rather than reusing the builder's byte ranges.
  let expected = original.toString('utf8');
  const rules = [
    ['remove-frame-runtime', /<!-- frame-runtime -->[\s\S]*?<!-- \/frame-runtime -->/g, ''],
    ['remove-font-preconnect-1', /<link rel="preconnect" href="https:\/\/fonts\.googleapis\.com">/g, ''],
    ['remove-font-preconnect-2', /<link rel="preconnect" href="https:\/\/fonts\.gstatic\.com" crossorigin>/g, ''],
    ['local-font-stylesheet', /https:\/\/fonts\.googleapis\.com\/css2\?[^"<>]+/g, './vendor/fonts/fonts.css'],
    ['local-three', /https:\/\/cdn\.jsdelivr\.net\/npm\/three@0\.186\.0\/build\/three\.module\.js/g, './vendor/three/build/three.module.js'],
    ['local-three-addons', /https:\/\/cdn\.jsdelivr\.net\/npm\/three@0\.186\.0\/examples\/jsm\//g, './vendor/three/examples/jsm/'],
  ];
  assert.deepEqual(manifest.patches.map(p => p.id), rules.map(r => r[0]));
  for (const [id, pattern, replacement] of rules) {
    assert.equal([...expected.matchAll(pattern)].length, 1, id);
    assert.equal(manifest.patches.find(p => p.id === id).replacement, replacement);
    expected = expected.replace(pattern, replacement);
  }
  const runtime = await read('public/index.html');
  assert(runtime.equals(Buffer.from(expected)));
  const result = localize(original, manifest);
  assert(runtime.equals(result.bytes));
  assert.deepEqual(result.applied, rules.map(([id]) => ({ id, matches: 1 })));
  const script = bytes => {
    const start = bytes.indexOf('<script type="module">');
    return bytes.subarray(start, bytes.indexOf('</script>', start));
  };
  assert(script(runtime).equals(script(original)), 'Game script must remain untouched');
  const removal = manifest.patches[0];
  const ranges = removal.removed_ranges;
  assert.equal(ranges[0].start, removal.start);
  assert.equal(ranges.at(-1).end, removal.end);
  for (let i = 1; i < ranges.length; i++) assert.equal(ranges[i].start, ranges[i - 1].end);
});

test('builder rejects changed original bytes and duplicate patch ranges', () => {
  const altered = Buffer.from(original);
  altered[altered.length - 1] ^= 1;
  assert.throws(() => localize(altered, manifest), /Original hash changed/);
  const bad = structuredClone(manifest);
  bad.patches.splice(1, 0, bad.patches[0]);
  assert.throws(() => localize(original, bad), /overlapping range/);
});

test('offline rebuild reproduces the checked-in runtime and every source slice, twice', async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), 'antikythera-build-'));
  try {
    const outputs = ['public/index.html', ...await filesUnder('src')];
    for (let pass = 0; pass < 2; pass++) {
      await build(temporary);
      for (const relative of outputs) {
        assert((await readFile(path.join(temporary, relative))).equals(await read(relative)), relative);
      }
    }
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});

test('public has no remaining Claude, jsDelivr, or Google Fonts URLs', async () => {
  for (const relative of await filesUnder('public')) {
    const bytes = await read(relative);
    assert.doesNotMatch(bytes.toString('utf8'), /(?:https?:)?\/\/[^\s"'<>)]*(?:claude\.ai|jsdelivr|googleapis|gstatic)[^\s"'<>)]*/i, relative);
  }
});

test('every vendored file matches provenance and Three.js retains CDN-verified bytes', async () => {
  assert.deepEqual(await filesUnder('public/vendor'), manifest.vendored_files.map(f => f.path).sort());
  for (const entry of manifest.vendored_files) {
    const bytes = await read(entry.path);
    assert.equal(bytes.length, entry.bytes, entry.path);
    assert.equal(sha256(bytes), entry.sha256, entry.path);
    if (entry.kind === 'three') {
      assert.equal(entry.cdn_sha256, entry.sha256);
      assert.equal(entry.url, `https://cdn.jsdelivr.net/npm/three@0.186.0/${entry.path.slice('public/vendor/three/'.length)}`);
      assert.equal(entry.verification, 'byte-identical to jsDelivr');
    }
  }
});

test('vendored Three.js JavaScript is exactly the transitive import closure', async () => {
  const imports = text => [...text.matchAll(/^(?:import|export)\s+(?:[^;]*?\sfrom\s*)?['"]([^'"]+)['"]/gm)].map(m => m[1]);
  const queue = imports(original.subarray(manifest.script.content_start, manifest.script.end).toString())
    .map(spec => spec === 'three' ? 'build/three.module.js' : spec.replace('three/addons/', 'examples/jsm/'));
  const visited = new Set();
  while (queue.length) {
    const relative = queue.pop();
    if (visited.has(relative)) continue;
    visited.add(relative);
    for (const spec of imports((await read(`public/vendor/three/${relative}`)).toString())) {
      assert(spec === 'three' || spec.startsWith('.'), `${relative}: ${spec}`);
      queue.push(spec === 'three' ? 'build/three.module.js' : path.posix.normalize(path.posix.join(path.posix.dirname(relative), spec)));
    }
  }
  const recorded = manifest.vendored_files.filter(f => f.kind === 'three').map(f => f.path.slice('public/vendor/three/'.length));
  assert.equal(visited.size, 12);
  assert.deepEqual([...visited].sort(), recorded.sort());
});

test('font CSS changes only URLs and every returned WOFF2 subset is retained', async () => {
  const entry = manifest.vendored_files.find(f => f.kind === 'font-stylesheet');
  const css = await read(entry.original_path);
  assert.equal(sha256(css), entry.original_sha256);
  const fonts = manifest.vendored_files.filter(f => f.kind === 'font');
  const urls = [...new Set([...css.toString().matchAll(/url\((https:\/\/[^)]+)\)/g)].map(m => m[1]))];
  assert.deepEqual(urls.sort(), fonts.map(f => f.url).sort());
  let expected = css.toString();
  for (const font of fonts) {
    assert.equal((await read(font.path)).subarray(0, 4).toString(), 'wOF2');
    expected = expected.replaceAll(font.url, `./${path.posix.basename(font.path)}`);
  }
  assert.equal((await read(entry.path)).toString(), expected);
  assert.equal(fonts.length, manifest.fonts.woff2_files);
  assert.equal(fonts.reduce((total, f) => total + f.bytes, 0), manifest.fonts.woff2_bytes);
  assert(manifest.fonts.woff2_bytes < 3_000_000);
  for (const source of manifest.vendored_files.find(f => f.path.endsWith('LICENSE-OFL.txt')).sources) {
    assert.equal(sha256(await read(source.path)), source.sha256);
  }
});

test('36 ordered slices reconstruct both the original script region and full HTML', async () => {
  assert.equal(manifest.modules.length, 36);
  const modules = await Promise.all(manifest.modules.map(m => read(`src/${m.name}`)));
  const joined = Buffer.concat(modules);
  assert(joined.equals(original.subarray(manifest.script.marker_region_start, manifest.script.end)));
  const prelude = await read('src/_prelude.html');
  const script = Buffer.concat([prelude.subarray(manifest.script.content_start), joined]);
  assert(script.equals(original.subarray(manifest.script.content_start, manifest.script.end)));
  assert(Buffer.concat([prelude, joined, await read('src/_tail.html')]).equals(original));
});
