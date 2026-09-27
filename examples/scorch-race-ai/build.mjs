import { syncUI } from '../_shared/build.mjs';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, lstat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const provenance = JSON.parse(await readFile(path.join(here, 'provenance.json')));
const hash = data => createHash('sha256').update(data).digest('hex');
export async function verifyOriginals() {
  for (const file of provenance.files) {
    for (const name of [file.source, file.path]) {
      if (hash(await readFile(path.join(root, name))) !== file.sha256) throw Error(`SHA-256 mismatch: ${name}`);
    }
  }
}
export function select(bytes, block) {
  const selection = bytes.subarray(block.start, block.end);
  if (hash(selection) !== block.sha256) throw Error(`Source block changed: ${block.name}`);
  return selection.toString('utf8');
}
export async function build(out = path.join(here, 'public')) {
  if (out === path.join(here, 'public')) await syncUI(here);
  await verifyOriginals();
  const bytes = await readFile(path.join(here, 'original/index.html'));
  const write = async (name, content) => {
    const target = path.join(out, name);
    for (const item of [out, target]) {
      try { if ((await lstat(item)).isSymbolicLink()) throw Error(`Symlink output: ${item}`); }
      catch (e) { if (e.code !== 'ENOENT') throw e; }
    }
    await mkdir(out, { recursive: true });
    await writeFile(target, content);
  };
  try {
    // Packaging only: exact byte ranges, no transpiler, minifier or installed packages.
    await write('three.js', select(bytes, provenance.vendor));
    const prefix = "import { G, AUDIO, UI, fx, post, renderer } from './shims.mjs';\nconst THREE = globalThis.THREE;\n";
    const suffix = '\nconst tmpV = new T.Vector3();\nexport { T, PAL, SU, LIGHTS, OUTLINE_U, TRACK, TRACK_HALF, POD_DEFS, K, TB, Racer, racers, aiInput, collide, trackAt, pinchAt, hAt, trackQuery, yawCap, clamp, wrapPI, stepRacer, playerInput, poseRacer, buildPod, makeSky, makeGroundMat, buildTrackMesh, buildTerrain, buildPosts, buildScenery, buildPads, buildBarrier, updateSunShadow };\n';
    await write('runtime.mjs', prefix + provenance.blocks.map(b => select(bytes, b)).join('\n') + suffix);
    for (const name of ['ui.js', 'ui.css', 'i18n.js', 'index.html', 'style.css', 'host.mjs', 'shims.mjs', 'targets.mjs']) {
      await write(name, await readFile(path.join(here, 'src', name)));
    }
    console.log(`Packaged ${provenance.blocks.length} verbatim source blocks and embedded Three.js; no bundler needed.`);
  } finally {
    await verifyOriginals();
    console.log('Archive and original copy unchanged: SHA-256 verified.');
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await build();
