import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const here=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(here,'../..');
const manifest=JSON.parse(await readFile(path.join(here,'provenance.json')));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
test('all eight originals match archived bytes, pinned hashes and source credits',async()=>{
  assert.equal(manifest.files.length,8);
  const disk=(await readdir(path.join(here,'original'),{recursive:true,withFileTypes:true})).filter(f=>f.isFile());
  assert.equal(disk.length,manifest.files.length);
  for(const file of manifest.files){
    assert.equal(file.credit,'Anderson Mancini and Sunag');
    assert.equal(file.url,'https://www.threejspunk.com/'+file.source.replace('threejs-punk/public/',''));
    assert.equal(file.path,file.source.replace('threejs-punk/public/','examples/punk-engine-audio/original/'));
    for(const name of [file.path,file.source]) assert.equal(hash(await readFile(path.join(root,name))),file.sha256,name);
  }
  assert.equal(hash(await readFile(path.join(root,manifest.reference.source))),manifest.reference.sha256);
});
test('plain host uses original worklets without the side-effecting game bundle',async()=>{
  const files=await readdir(path.join(here,'src'));
  for(const file of files.filter(f=>/\.(mjs|js)$/.test(f))){
    const source=await readFile(path.join(here,'src',file),'utf8');
    assert.doesNotMatch(source,/index-[\w-]+\.js|eval\s*\(|new Function/);
  }
  for(const name of ['ui.js','ui.css'])assert.deepEqual(await readFile(path.join(here,'src',name)),await readFile(path.join(here,'../_shared',name)));
  assert.deepEqual(JSON.parse(await readFile(path.join(here,'local.json'))),{root:'.',entry:'/index.html',port:8130});
});
