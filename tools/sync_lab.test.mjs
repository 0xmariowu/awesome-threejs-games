import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { copyFile, link, lstat, mkdir, mkdtemp, readFile, readdir, readlink, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { syncLab } from './sync_lab.mjs';

const sha256 = data => createHash('sha256').update(data).digest('hex');
async function write(root, relative, data) {
  const file = path.join(root, relative);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, data);
}

// Include excluded files, dotfiles, and all .git contents in the read-only oracle.
async function fingerprints(root) {
  const result = {};
  async function visit(relative) {
    const full = path.join(root, relative);
    const entry = await lstat(full);
    if (entry.isSymbolicLink()) result[relative] = `link:${await readlink(full)}`;
    else if (entry.isDirectory()) {
      result[`${relative}/`] = 'directory';
      for (const name of (await readdir(full)).sort()) await visit(path.join(relative, name));
    } else result[relative] = sha256(await readFile(full));
  }
  await visit('');
  return result;
}

async function fixture(t) {
  const temporary = await mkdtemp(path.join(os.tmpdir(), 'gameref-sync-lab-'));
  t.after(() => rm(temporary, { recursive: true, force: true }));
  const root = path.join(temporary, 'repo');
  const lab = path.join(temporary, 'local lab');
  const destination = path.join(root, 'webgame-lab');
  await mkdir(lab);
  await write(root, 'catalog/lab-links.json', JSON.stringify({ lab_root: '../local lab' }));
  await write(root, 'keep.txt', 'outside snapshot');
  const git = (...args) => execFileSync('git', ['-C', lab, ...args], {
    encoding: 'utf8', env: { ...process.env, GIT_OPTIONAL_LOCKS: '0', GIT_CONFIG_GLOBAL: os.devNull,
      GIT_CONFIG_NOSYSTEM: '1', GIT_AUTHOR_NAME: 'Fixture', GIT_AUTHOR_EMAIL: 'fixture@example.test',
      GIT_COMMITTER_NAME: 'Fixture', GIT_COMMITTER_EMAIL: 'fixture@example.test' },
  }).trim();
  git('init', '-q');
  const tracked = {
    'src/scene.ts': 'committed scene', 'public/asset.bin': Buffer.from([0, 1, 2, 255]),
    'docs/guide.md': 'guide', 'scripts/run.mjs': 'console.log("run");',
    'index.html': '<html></html>', 'package.json': '{}', 'package-lock.json': '{}',
    'tsconfig.json': '{}', 'vite.config.ts': 'export default {};', 'LICENSES.md': 'licenses',
  };
  for (const [name, data] of Object.entries(tracked)) await write(lab, name, data);
  git('add', '.');
  git('-c', 'commit.gpgsign=false', 'commit', '-qm', 'Fixture');
  const commit = git('rev-parse', 'HEAD');
  await write(lab, 'src/scene.ts', 'current uncommitted scene');
  await write(lab, 'src/new scene.ts', 'new uncommitted scene');
  const omitted = [
    'node_modules/pkg/index.js', '.claude/plan.md', 'experience/note.md', 'dist/bundle.js',
    'evidence/image.png', '.env', 'unlisted.txt', 'src/.hidden', 'src/.cache/cache.txt',
    'src/node_modules/nested.js', 'public/dist/bundle.js', 'docs/experience/note.md',
    'scripts/evidence/result.txt', 'scripts/inkwave-audit.mjs',
  ];
  for (const name of omitted) await write(lab, name, 'must stay in the Lab');
  await symlink('../public/asset.bin', path.join(lab, 'src/asset-link'));
  await symlink('../node_modules', path.join(lab, 'src/directory-link'));
  await symlink('missing', path.join(lab, 'src/broken-link'));
  const reports = [];
  const sync = options => syncLab(root, { report: line => reports.push(line), ...options });
  return { root, lab, destination, git, commit, tracked, omitted, reports, sync };
}

test('copies whitelisted working-tree bytes, reports/skips links, and records provenance without changing the Lab', async t => {
  const f = await fixture(t);
  const before = await fingerprints(f.lab);
  const result = await f.sync();
  assert.equal(result.exitCode, 0);
  const manifest = JSON.parse(await readFile(path.join(f.destination, 'SNAPSHOT.json')));
  const expected = [...Object.keys(f.tracked), 'src/new scene.ts'].sort();
  assert.deepEqual(manifest.files.map(file => file.path), expected);
  assert.deepEqual(Object.keys(manifest).sort(), [
    'source_path_note', 'source_commit', 'dirty', 'dirty_files', 'synced_at', 'files', 'excluded_files',
  ].sort());
  assert.equal(manifest.source_path_note, 'local ../webgame-lab (no remote)');
  assert.deepEqual(manifest.excluded_files, ['scripts/inkwave-audit.mjs']);
  assert.equal(manifest.source_commit, f.commit);
  assert.equal(manifest.dirty, true);
  assert.deepEqual(manifest.dirty_files, [
    'src/asset-link', 'src/broken-link', 'src/directory-link', 'src/new scene.ts', 'src/scene.ts',
  ]);
  assert.equal(new Date(manifest.synced_at).toISOString(), manifest.synced_at);
  let bytes = 0;
  for (const file of manifest.files) {
    const source = await readFile(path.join(f.lab, file.path));
    assert.deepEqual(await readFile(path.join(f.destination, file.path)), source);
    assert.equal(file.bytes, source.length);
    assert.equal(file.sha256, sha256(source));
    bytes += source.length;
  }
  assert.equal(result.bytes, bytes);
  assert.equal(result.files, expected.length);
  for (const omitted of [...f.omitted, '.git', 'README.md', 'src/asset-link', 'src/directory-link', 'src/broken-link']) {
    await assert.rejects(lstat(path.join(f.destination, omitted)), { code: 'ENOENT' });
  }
  assert.equal(f.reports.filter(line => line.startsWith('Skipped symlink:')).length, 3);
  const note = await readFile(path.join(f.destination, 'SNAPSHOT.md'), 'utf8');
  assert.match(note, /owner's local Webgame Lab/);
  assert.match(note, /node tools\/sync_lab.mjs/);
  assert.match(note, /node tools\/library.mjs/);
  assert.match(note, /live local Lab/);
  assert.equal((await f.sync({ check: true })).exitCode, 0);
  await f.sync();
  assert.deepEqual(await fingerprints(f.lab), before);
});

test('mirror removes upstream deletions and destination extras, handles type changes, and preserves outside files', async t => {
  const f = await fixture(t);
  await f.sync();
  await rm(path.join(f.lab, 'src/scene.ts'));
  await write(f.lab, 'src/new scene.ts', 'changed');
  await write(f.lab, 'public/added.dat', 'added');
  await write(f.destination, 'extra/nested/file.txt', 'remove');
  await rm(path.join(f.lab, 'docs/guide.md'));
  await write(f.lab, 'docs/guide.md/child.txt', 'file became a directory');
  await rm(path.join(f.lab, 'scripts'), { recursive: true });
  await write(f.lab, 'scripts', 'invalid root type');
  await assert.rejects(f.sync(), /Expected a directory: scripts/);
  await rm(path.join(f.lab, 'scripts'));
  await mkdir(path.join(f.lab, 'scripts/empty'), { recursive: true });
  const before = await fingerprints(f.lab);
  const drift = await f.sync({ check: true });
  assert.equal(drift.exitCode, 1);
  assert.ok(drift.differences.includes('removed: "src/scene.ts"'));
  assert.ok(drift.differences.includes('added: "public/added.dat"'));
  assert.ok(drift.differences.includes('changed: "src/new scene.ts"'));
  await f.sync();
  assert.equal((await f.sync({ check: true })).exitCode, 0);
  assert.deepEqual(await fingerprints(f.lab), before);
  await rm(path.join(f.lab, 'docs/guide.md'), { recursive: true });
  await write(f.lab, 'docs/guide.md', 'directory became a file');
  const beforeReverse = await fingerprints(f.lab);
  await f.sync();
  assert.equal((await f.sync({ check: true })).exitCode, 0);
  assert.deepEqual(await fingerprints(f.lab), beforeReverse);
  await assert.rejects(lstat(path.join(f.destination, 'extra')), { code: 'ENOENT' });
  await assert.rejects(lstat(path.join(f.destination, 'src/scene.ts')), { code: 'ENOENT' });
  assert.ok((await lstat(path.join(f.destination, 'scripts/empty'))).isDirectory());
  assert.equal(await readFile(path.join(f.root, 'keep.txt'), 'utf8'), 'outside snapshot');
  assert.equal(await readFile(path.join(f.destination, 'docs/guide.md'), 'utf8'), 'directory became a file');
});

test('README is preserved verbatim and replaces the fallback; clean and excluded-only Git status are accurate', async t => {
  const f = await fixture(t);
  await f.sync();
  await write(f.lab, 'README.md', '# Original Lab README\n');
  f.git('add', '.');
  f.git('-c', 'commit.gpgsign=false', 'commit', '-qm', 'All fixtures');
  const before = await fingerprints(f.lab);
  await f.sync();
  const manifest = JSON.parse(await readFile(path.join(f.destination, 'SNAPSHOT.json')));
  assert.equal(manifest.dirty, false);
  assert.deepEqual(manifest.dirty_files, []);
  assert.equal(await readFile(path.join(f.destination, 'README.md'), 'utf8'), '# Original Lab README\n');
  await assert.rejects(lstat(path.join(f.destination, 'SNAPSHOT.md')), { code: 'ENOENT' });
  assert.deepEqual(await fingerprints(f.lab), before);
  await write(f.lab, '.claude/plan.md', 'excluded change');
  await f.sync();
  const dirty = JSON.parse(await readFile(path.join(f.destination, 'SNAPSHOT.json')));
  assert.equal(dirty.dirty, true);
  assert.deepEqual(dirty.dirty_files, []);
});

test('Git paths retain Unicode, quotes, newlines, and both sides of renames', async t => {
  const f = await fixture(t);
  const unusual = 'src/新 "scene"\n.ts';
  f.git('mv', 'src/scene.ts', unusual);
  await write(f.lab, 'src/tab\tname.ts', 'untracked');
  const before = await fingerprints(f.lab);
  await f.sync();
  const manifest = JSON.parse(await readFile(path.join(f.destination, 'SNAPSHOT.json')));
  for (const relative of ['src/scene.ts', unusual, 'src/tab\tname.ts']) {
    assert.ok(manifest.dirty_files.includes(relative), JSON.stringify(relative));
  }
  assert.deepEqual(await fingerprints(f.lab), before);
});

test('CLI resolves the catalog relative to the script, detects drift, and check never writes', async t => {
  const f = await fixture(t);
  await mkdir(path.join(f.root, 'tools'));
  const script = path.join(f.root, 'tools/sync_lab.mjs');
  await copyFile(new URL('./sync_lab.mjs', import.meta.url), script);
  const run = (...args) => spawnSync(process.execPath, [script, ...args], { cwd: os.tmpdir(), encoding: 'utf8' });
  assert.equal(run('--unknown').status, 1);
  assert.equal(run('--check').status, 1);
  await assert.rejects(lstat(f.destination), { code: 'ENOENT' });
  const synced = run();
  assert.equal(synced.status, 0, synced.stderr);
  const before = await fingerprints(f.root);
  assert.equal(run('--check').status, 0);
  assert.deepEqual(await fingerprints(f.root), before);
  await write(f.destination, 'src/scene.ts', 'manual drift');
  const changed = await fingerprints(f.root);
  const check = run('--check');
  assert.equal(check.status, 1);
  assert.match(check.stdout, /changed: "src\/scene.ts"/);
  assert.deepEqual(await fingerprints(f.root), changed);
  assert.equal(run().status, 0);
  assert.equal(run('--check').status, 0);
  await write(f.destination, 'SNAPSHOT.json', '{}');
  assert.equal(run('--check').status, 1);
});

test('destination symlinks and hard links never redirect writes into the Lab', async t => {
  const f = await fixture(t);
  await f.sync();
  await rm(path.join(f.destination, 'src'), { recursive: true });
  await symlink(path.join(f.lab, 'src'), path.join(f.destination, 'src'));
  await rm(path.join(f.destination, 'index.html'));
  await link(path.join(f.lab, 'index.html'), path.join(f.destination, 'index.html'));
  await symlink(path.join(f.lab, 'public'), path.join(f.destination, 'extra-link'));
  const before = await fingerprints(f.lab);
  assert.equal((await f.sync({ check: true })).exitCode, 1);
  await f.sync();
  assert.deepEqual(await fingerprints(f.lab), before);
  assert.equal((await f.sync({ check: true })).exitCode, 0);
  assert.notEqual((await lstat(path.join(f.destination, 'index.html'))).ino,
    (await lstat(path.join(f.lab, 'index.html'))).ino);
});

test('rejects a linked snapshot root or overlapping Lab before any writes', async t => {
  const f = await fixture(t);
  const before = await fingerprints(f.lab);
  await symlink(f.lab, f.destination);
  await assert.rejects(f.sync(), /Snapshot root must be a real directory/);
  assert.deepEqual(await fingerprints(f.lab), before);
  await rm(f.destination);
  await write(f.root, 'catalog/lab-links.json', JSON.stringify({ lab_root: '.' }));
  const repoBefore = await fingerprints(f.root);
  await assert.rejects(f.sync(), /must not overlap/);
  assert.deepEqual(await fingerprints(f.root), repoBefore);
});
