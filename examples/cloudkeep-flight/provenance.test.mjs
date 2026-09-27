import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile, readdir, stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const provenance=JSON.parse(await readFile(path.join(root,'examples/cloudkeep-flight/provenance.json'),'utf8'));
const absolute=relative=>path.join(root,relative);
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');

test('provenance lists exactly the three original modules and 18 archive GLBs',async()=>{
  const expected=['flight-camera.ts','input.ts','simulation.ts'];
  assert.deepEqual(provenance.files.map(file=>path.basename(file.source)).sort(),expected);
  assert.deepEqual(provenance.files.map(file=>path.basename(file.path)).sort(),expected);
  for(const file of provenance.files){
    const name=path.basename(file.source);
    assert.equal(file.source,`cloudkeep/upstream/src/${name}`);
    assert.equal(file.path,`examples/cloudkeep-flight/original/${name}`);
  }

  const archiveNames=(await readdir(absolute('cloudkeep/public/assets'))).filter(name=>name.endsWith('.glb')).sort();
  assert.equal(provenance.assets.length,18);
  assert.deepEqual(provenance.assets.map(asset=>path.basename(asset.source)).sort(),archiveNames);
  assert.deepEqual(provenance.assets.map(asset=>path.basename(asset.path)).sort(),archiveNames);
  for(const asset of provenance.assets){
    const name=path.basename(asset.source);
    assert.equal(asset.source,`cloudkeep/public/assets/${name}`);
    assert.equal(asset.path,`examples/cloudkeep-flight/public/assets/${name}`);
  }
});

test('original module copies and archive sources match pinned hashes',async()=>{
  for(const file of provenance.files){
    assert.equal(sha256(await readFile(absolute(file.source))),file.sha256,`${file.source} hash`);
    assert.equal(sha256(await readFile(absolute(file.path))),file.sha256,`${file.path} hash`);
  }
});

test('archive GLBs and any built copies match pinned hashes and sizes',async()=>{
  for(const asset of provenance.assets){
    const source=await readFile(absolute(asset.source));
    assert.equal(sha256(source),asset.sha256,`${asset.source} hash`);
    assert.equal(source.length,asset.bytes,`${asset.source} size`);
    try {
      await stat(absolute(asset.path));
    } catch(error) {
      if(error.code==='ENOENT') continue;
      throw error;
    }
    const copy=await readFile(absolute(asset.path));
    assert.equal(sha256(copy),asset.sha256,`${asset.path} hash`);
    assert.equal(copy.length,asset.bytes,`${asset.path} size`);
  }
});

test('LICENSE is byte-identical to the upstream LICENSE',async()=>{
  assert.deepEqual(
    await readFile(absolute('examples/cloudkeep-flight/LICENSE')),
    await readFile(absolute('cloudkeep/upstream/LICENSE')),
  );
});
