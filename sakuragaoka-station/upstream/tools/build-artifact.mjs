// Prepares dist/ for publishing as a claude.ai Artifact: the page file without <!doctype>/<html>/
// <head>/<body> wrappers (the host adds its own skeleton) + a manifest of the JS files to upload.
// usage: node tools/build-artifact.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });

let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
html = html
  .replace(/<!doctype html>\s*/i, '')
  .replace(/<html[^>]*>\s*/i, '')
  .replace(/<\/html>\s*/i, '')
  .replace(/<head>\s*/i, '')
  .replace(/<\/head>\s*/i, '')
  .replace(/<body>\s*/i, '')
  .replace(/<\/body>\s*/i, '')
  .replace(/<meta charset="utf-8">\s*/i, '')
  .replace(/<meta name="viewport"[^>]*>\s*/i, '');
// <title> must come first (only the first 8 KB are scanned for it)
const title = /<title>[^<]*<\/title>\s*/i.exec(html);
if (title) html = title[0] + html.replace(title[0], '');
fs.writeFileSync(path.join(dist, 'index.html'), html);

const files = {};
function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.js') && !e.name.startsWith('_')) {
      const rel = path.relative(root, p).split(path.sep).join('/');
      files[rel] = rel;
    }
  }
}
walk(path.join(root, 'src'));
fs.writeFileSync(path.join(dist, 'files.json'), JSON.stringify(files, null, 1));
let bytes = 0; for (const f of Object.keys(files)) bytes += fs.statSync(path.join(root, f)).size;
console.log(`dist/index.html (${html.length} B) + ${Object.keys(files).length} js files (${(bytes / 1024).toFixed(0)} KB)`);
