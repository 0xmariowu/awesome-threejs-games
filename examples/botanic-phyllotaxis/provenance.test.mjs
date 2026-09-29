import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile, readdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const example=path.dirname(fileURLToPath(import.meta.url)), root=path.resolve(example,'../..');
const manifest=JSON.parse(await readFile(path.join(example,'provenance.json'),'utf8'));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');

test('original implementation declaration and complete file hashes',async()=>{
  assert.equal(manifest.maturity,'independent-implementation');
  assert.equal(manifest.original_code,true);
  assert.deepEqual(manifest.third_party.map(item=>item.name),['three.js']);
  assert.deepEqual(manifest.candidates,[]);
  const disk=(await readdir(example,{recursive:true,withFileTypes:true})).filter(f=>f.isFile()).map(f=>path.relative(root,path.join(f.parentPath,f.name))).filter(f=>!f.includes('/__pycache__/')&&!f.endsWith('/provenance.json')).sort();
  assert.deepEqual(manifest.files.map(f=>f.path).sort(),disk);
  for(const file of manifest.files){
    assert.ok(file.path.startsWith(`examples/${path.basename(example)}/`));
    assert.equal(hash(await readFile(path.join(root,file.path))),file.sha256,file.path);
  }
  assert.match(await readFile(path.join(example,'README.md'),'utf8'),/Independent implementation inspired by FABOTANIC; no FABOTANIC code or assets/);
});
test('vendored Three.js and license match the allowed tracked source; shared UI stays byte-identical',async()=>{
  const vendor=manifest.third_party[0];assert.equal(vendor.license,'MIT');assert.equal(vendor.version,'r186');
  for(const file of vendor.files){
    assert.ok(file.source.startsWith('antikythera/public/vendor/three/'));
    assert.equal(hash(await readFile(path.join(root,file.source))),file.sha256);
    assert.equal(hash(await readFile(path.join(example,file.path))),file.sha256);
  }
  assert.equal(vendor.files.length,3);
  for(const name of ['ui.js','ui.css'])assert.deepEqual(await readFile(path.join(example,'src',name)),await readFile(path.join(root,'examples/_shared',name)));
});
test('every runtime import stays inside the standalone example and no remote assets are referenced',async()=>{
  const visited=new Set();
  async function visit(file){
    if(visited.has(file))return;visited.add(file);
    assert.ok(file.startsWith(example+path.sep));
    const source=await readFile(file,'utf8');
    for(const match of source.matchAll(/(?:from\s+|import\s*)['"]([^'"]+)['"]/g)){
      assert.ok(match[1].startsWith('.'),`Nonlocal module: ${match[1]}`);
      await visit(path.resolve(path.dirname(file),match[1]));
    }
    if(!file.includes('/vendor/')){
      assert.doesNotMatch(source,/\b(?:fetch|XMLHttpRequest|WebSocket)\s*\(/);
      assert.doesNotMatch(source,/["'](?:https?:)?\/\//);
    }
  }
  await visit(path.join(example,'src/main.js'));
  assert.ok(visited.has(path.join(example,'vendor/three/build/three.module.js')));
  assert.ok(visited.has(path.join(example,'vendor/three/build/three.core.js')));
  const html=await readFile(path.join(example,'index.html'),'utf8');
  assert.doesNotMatch(html,/(?:src|href)=["'](?:https?:)?\/\//);
  const local=JSON.parse(await readFile(path.join(example,'local.json')));assert.equal(local.root,'.');assert.equal(local.entry,'/index.html');assert.equal(local.port,path.basename(example)==='botanic-meadow'?8135:8134);
});
