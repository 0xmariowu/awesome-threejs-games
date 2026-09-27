import { readFile, writeFile, lstat, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const shared = path.dirname(fileURLToPath(import.meta.url));

// Standalone servers cannot reach siblings. Ship byte-identical local UI files.
// Vite bundles these same modules; plain hosts serve them directly.
export async function syncUI(example) {
  const target = path.join(example, path.basename(example) === 'tidewater-fishing' ? '' : 'src');
  for (const name of ['ui.js', 'ui.css']) {
    const destination = path.join(target, name);
    for (const item of [example, target, destination]) {
      try { if ((await lstat(item)).isSymbolicLink()) throw new Error(`Symlink UI output: ${item}`); }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
    await writeFile(destination, await readFile(path.join(shared, name)));
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  for (const entry of await readdir(path.dirname(shared), { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith('_')) continue;
    const example = path.join(shared, '..', entry.name);
    try { await readFile(path.join(example, 'local.json')); } catch { continue; }
    await syncUI(example);
  }
}
