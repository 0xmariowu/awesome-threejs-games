import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstat, mkdir, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const ROOT = fileURLToPath(new URL('../', import.meta.url));
const DIRECTORIES = new Set(['src', 'public', 'docs', 'scripts']);
const FILES = new Set([
  'index.html', 'package.json', 'package-lock.json', 'tsconfig.json',
  'vite.config.ts', 'LICENSES.md', 'README.md',
]);
const EXCLUDED = new Set(['node_modules', 'experience', 'dist', 'evidence']);
const EXCLUDED_FILES = new Set(['scripts/inkwave-audit.mjs']);
const NOTE = 'local ../webgame-lab (no remote)';
const SNAPSHOT_MD = `# Webgame Lab snapshot

This folder contains a snapshot of the owner's local Webgame Lab, which has no
GitHub remote. It includes the current working tree, including uncommitted scenes.
SNAPSHOT.json records the source commit, working-tree status, and source file hashes.

Refresh from the repository root with \`node tools/sync_lab.mjs\`.
Run demos with \`node tools/library.mjs\`; they use the live local Lab.
`;
const hash = data => createHash('sha256').update(data).digest('hex');
const excluded = name => name.startsWith('.') || EXCLUDED.has(name);
const allowed = relative => {
  const parts = relative.split('/');
  return !EXCLUDED_FILES.has(relative) && !parts.some(excluded) && (DIRECTORIES.has(parts[0]) ||
    (parts.length === 1 && FILES.has(parts[0])));
};

async function info(file) {
  try { return await lstat(file); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

function contains(parent, child) {
  const relative = path.relative(parent, child);
  return relative === '' || (!path.isAbsolute(relative) && relative !== '..' &&
    !relative.startsWith(`..${path.sep}`));
}

async function sourceTree(lab, report) {
  const files = new Map();
  const directories = new Set();
  async function visit(relative) {
    if (EXCLUDED_FILES.has(relative)) return;
    const file = path.join(lab, relative);
    const entry = await info(file);
    if (!entry) return;
    if (entry.isSymbolicLink()) {
      report(`Skipped symlink: ${JSON.stringify(relative)}`);
    } else if (entry.isDirectory()) {
      if (!relative.includes('/') && !DIRECTORIES.has(relative)) {
        throw new Error(`Expected a file: ${relative}`);
      }
      directories.add(relative);
      for (const name of (await readdir(file)).sort()) {
        if (!excluded(name)) await visit(`${relative}/${name}`);
      }
    } else if (entry.isFile()) {
      if (DIRECTORIES.has(relative)) throw new Error(`Expected a directory: ${relative}`);
      files.set(relative, await readFile(file));
    } else {
      report(`Skipped special file: ${JSON.stringify(relative)}`);
    }
  }
  for (const name of [...DIRECTORIES, ...FILES].sort()) await visit(name);
  return { files: new Map([...files].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)), directories };
}

async function gitMetadata(lab) {
  // Git status normally refreshes the index. Optional locks must be disabled to
  // keep even the Lab's .git files byte-identical. -z preserves unusual names.
  const git = async args => (await exec('git', ['-C', lab, ...args], {
    encoding: 'utf8', env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' },
    maxBuffer: 16 * 1024 * 1024,
  })).stdout;
  const source_commit = (await git(['rev-parse', 'HEAD'])).trim();
  const status = await git(['status', '--porcelain=v1', '-z', '--untracked-files=all']);
  const dirtyFiles = new Set();
  const entries = status.split('\0');
  for (let i = 0; i < entries.length; i++) {
    if (!entries[i]) continue;
    const code = entries[i].slice(0, 2);
    const relative = entries[i].slice(3);
    if (allowed(relative)) dirtyFiles.add(relative);
    // Porcelain -z lists the destination first, followed by the original path.
    if (/[RC]/.test(code)) {
      const original = entries[++i];
      if (original && allowed(original)) dirtyFiles.add(original);
    }
  }
  return { source_commit, dirty: status.length > 0, dirty_files: [...dirtyFiles].sort() };
}

async function destinationTree(destination) {
  const entries = new Map();
  async function visit(relative) {
    const file = path.join(destination, relative);
    const entry = await lstat(file);
    const type = entry.isSymbolicLink() ? 'symlink' : entry.isDirectory() ? 'directory' :
      entry.isFile() ? 'file' : 'special';
    entries.set(relative, { type, data: type === 'file' ? await readFile(file) : null });
    if (type === 'directory') {
      for (const name of (await readdir(file)).sort()) await visit(`${relative}/${name}`);
    }
  }
  if (await info(destination)) {
    for (const name of (await readdir(destination)).sort()) await visit(name);
  }
  return entries;
}

export async function syncLab(root = ROOT, { check = false, report = console.log } = {}) {
  root = await realpath(root);
  const { lab_root } = JSON.parse(await readFile(path.join(root, 'catalog/lab-links.json'), 'utf8'));
  if (typeof lab_root !== 'string' || !lab_root.trim()) throw new Error('Missing lab_root');
  const source = path.resolve(root, lab_root);
  const sourceInfo = await info(source);
  if (!sourceInfo?.isDirectory() || sourceInfo.isSymbolicLink()) {
    throw new Error('Lab root must be a real directory, not a symlink');
  }
  const lab = await realpath(source);
  const destination = path.join(root, 'webgame-lab');
  if (contains(lab, root) || contains(destination, lab)) {
    throw new Error('Lab and snapshot paths must not overlap');
  }
  const destinationInfo = await info(destination);
  if (destinationInfo && (!destinationInfo.isDirectory() || destinationInfo.isSymbolicLink())) {
    throw new Error('Snapshot root must be a real directory, not a symlink');
  }

  // Finish reading the source and Git metadata before modifying the destination.
  const { files, directories } = await sourceTree(lab, report);
  const metadata = await gitMetadata(lab);
  const manifest = {
    source_path_note: NOTE, ...metadata, synced_at: new Date().toISOString(),
    excluded_files: [...EXCLUDED_FILES].sort(),
    files: [...files].map(([relative, data]) => ({ path: relative, bytes: data.length, sha256: hash(data) })),
  };
  const current = await destinationTree(destination);
  if (check) {
    // A refresh timestamp is historical, not drift. Require a valid ISO value.
    try {
      const previous = JSON.parse(current.get('SNAPSHOT.json')?.data?.toString());
      if (typeof previous.synced_at === 'string' &&
          new Date(previous.synced_at).toISOString() === previous.synced_at) {
        manifest.synced_at = previous.synced_at;
      }
    } catch { /* Missing or invalid manifest will be reported as drift. */ }
  }
  const expected = new Map(files);
  if (!files.has('README.md')) expected.set('SNAPSHOT.md', Buffer.from(SNAPSHOT_MD));
  expected.set('SNAPSHOT.json', Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`));
  const differences = [];
  for (const [relative, data] of expected) {
    const entry = current.get(relative);
    if (!entry) differences.push(`added: ${JSON.stringify(relative)}`);
    else if (entry.type !== 'file' || !data.equals(entry.data)) differences.push(`changed: ${JSON.stringify(relative)}`);
  }
  for (const relative of directories) {
    const entry = current.get(relative);
    if (!entry) differences.push(`added: ${JSON.stringify(`${relative}/`)}`);
    else if (entry.type !== 'directory') differences.push(`changed: ${JSON.stringify(`${relative}/`)}`);
  }
  for (const relative of current.keys()) {
    if (!expected.has(relative) && !directories.has(relative)) differences.push(`removed: ${JSON.stringify(relative)}`);
  }
  const bytes = manifest.files.reduce((total, file) => total + file.bytes, 0);
  if (check) {
    for (const difference of differences) report(difference);
    report(differences.length ? 'Snapshot differs; run node tools/sync_lab.mjs' : 'Snapshot matches the Lab working tree.');
    return { exitCode: differences.length ? 1 : 0, files: files.size, bytes, differences };
  }

  await mkdir(destination, { recursive: true });
  // Remove unwanted entries and type conflicts without following links.
  for (const [relative, entry] of [...current].sort(([a], [b]) => b.length - a.length)) {
    if (!(entry.type === 'directory' && directories.has(relative)) &&
        !(entry.type === 'file' && expected.has(relative))) {
      await rm(path.join(destination, relative), { recursive: true, force: true });
    }
  }
  for (const relative of directories) await mkdir(path.join(destination, relative), { recursive: true });
  for (const [relative, data] of expected) {
    const file = path.join(destination, relative);
    // Unlink first: an existing hard link must never let a write reach the Lab.
    await rm(file, { force: true });
    await writeFile(file, data, { flag: 'wx' });
  }
  report(`Synced ${files.size} source files, ${bytes} bytes to webgame-lab/.`);
  return { exitCode: 0, files: files.size, bytes, differences };
}

if (process.argv[1] && await realpath(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    if (args.length > 1 || (args.length === 1 && args[0] !== '--check')) {
      throw new Error('Usage: node tools/sync_lab.mjs [--check]');
    }
    process.exitCode = (await syncLab(ROOT, { check: args[0] === '--check' })).exitCode;
  } catch (error) {
    console.error(`sync_lab: ${error.message}`);
    process.exitCode = 1;
  }
}
