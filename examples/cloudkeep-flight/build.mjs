import { syncUI } from '../_shared/build.mjs';
import { createHash } from 'node:crypto';
import { lstat, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const example = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(example, '../..');
const upstream = path.join(root, 'cloudkeep/upstream');
const outDir = path.join(example, 'public');
const ownershipPath = path.join(outDir, '.build-files.json');
const provenanceBytes = await readFile(path.join(example, 'provenance.json'));
const provenance = JSON.parse(provenanceBytes);
const archiveEntries = [...provenance.files, ...provenance.assets];
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const generatedName = name => /^(?:index\.html|models\.html|bundles\/[A-Za-z0-9_-]+\.(?:js|css))$/.test(name);

async function verifyArchive() {
  for (const entry of archiveEntries) {
    const bytes = await readFile(path.join(root, entry.source));
    if (hash(bytes) !== entry.sha256) throw new Error(`Archive SHA-256 mismatch: ${entry.source}`);
  }
}

// Reject symlinks on output paths so writes and cleanup stay in this example.
async function checkPath(target) {
  const relative = path.relative(example, target);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error(`Output outside example: ${target}`);
  let cursor = example;
  for (const segment of relative.split(path.sep)) {
    cursor = path.join(cursor, segment);
    try {
      if ((await lstat(cursor)).isSymbolicLink()) throw new Error(`Symlink output is not allowed: ${cursor}`);
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
}

await syncUI(example);
await verifyArchive();
for (const entry of provenance.files) {
  if (hash(await readFile(path.join(root, entry.path))) !== entry.sha256) {
    throw new Error(`Original copy SHA-256 mismatch: ${entry.path}`);
  }
}
try {
  for (const target of [outDir, path.join(outDir, 'assets'), path.join(outDir, 'bundles'), ownershipPath]) await checkPath(target);
  await mkdir(outDir, { recursive: true });
  let previous = [];
  try { previous = JSON.parse(await readFile(ownershipPath, 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (!Array.isArray(previous) || previous.some(name => typeof name !== 'string' || !generatedName(name))) {
    throw new Error('Invalid generated-file ownership manifest');
  }
  // Only files recorded by this build are removed; assets and unrelated files remain.
  for (const name of previous) {
    const target = path.join(outDir, name);
    await checkPath(target);
    await rm(target, { force: true });
  }
  await mkdir(path.join(outDir, 'assets'), { recursive: true });
  for (const asset of provenance.assets) {
    const name = path.basename(asset.source);
    const destination = path.join(outDir, 'assets', name);
    if (!/^[a-z-]+\.glb$/.test(name) || path.resolve(root, asset.path) !== destination) {
      throw new Error(`Unexpected asset destination: ${asset.path}`);
    }
    const bytes = await readFile(path.join(root, asset.source));
    if (hash(bytes) !== asset.sha256 || bytes.length !== asset.bytes) throw new Error(`Asset mismatch: ${asset.source}`);
    await checkPath(destination);
    await writeFile(destination, bytes);
  }
  await checkPath(path.join(outDir, 'provenance.json'));
  await writeFile(path.join(outDir, 'provenance.json'), provenanceBytes);
  for (const name of ['index.html', 'models.html']) await checkPath(path.join(outDir, name));
  const { build } = await import(pathToFileURL(path.join(upstream, 'node_modules/vite/dist/node/index.js')).href);
  const result = await build({
    configFile: false,
    root: example,
    publicDir: false,
    cacheDir: path.join(example, '.vite'),
    base: './',
    logLevel: 'warn',
    resolve: { alias: [
      { find: /^three\/addons\//, replacement: `${path.join(upstream, 'node_modules/three/examples/jsm')}/` },
      { find: /^three$/, replacement: path.join(upstream, 'node_modules/three/build/three.module.js') },
    ] },
    build: {
      outDir,
      emptyOutDir: false,
      assetsDir: 'bundles',
      rollupOptions: { input: { index: path.join(example, 'index.html'), models: path.join(example, 'models.html') } },
    },
  });
  const outputs = (Array.isArray(result) ? result : [result]).flatMap(output => output.output.map(file => file.fileName)).sort();
  if (outputs.some(name => !generatedName(name))) throw new Error('Build emitted an unexpected filename');
  await writeFile(ownershipPath, `${JSON.stringify(outputs, null, 2)}\n`);
  console.log(`Built 2 pages, ${outputs.length} HTML/JS/CSS files; copied ${provenance.assets.length} verified GLBs.`);
} finally {
  await verifyArchive();
  console.log(`Archive unchanged: ${archiveEntries.length} pinned files match SHA-256.`);
}
