import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm, symlink } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT, sha256 } from './library-index.mjs';
import { loadPages, loadCandidates, checkPages, checkVideos } from './pages.mjs';
import { createLibrary } from './library.mjs';

async function fixture(t) {
  const temporary = await mkdtemp(path.join(os.tmpdir(),'gameref-pages-'));
  t.after(()=>rm(temporary,{recursive:true,force:true}));
  const root = path.join(temporary,'gameref');
  const media = Buffer.from('fixture video bytes');
  async function write(relative, content) {
    const file = path.join(root,relative);
    await mkdir(path.dirname(file),{recursive:true});
    await writeFile(file,content);
  }
  const save = (relative,data) => write(relative,JSON.stringify(data));
  await write('media/cloudkeep/flight.mp4',media);
  await write('media/cloudkeep/flight.jpg','fixture poster');
  await write('media/cloudkeep/flight.vtt','WEBVTT\n\n00:00.000 --> 00:01.000\nFlight\n');
  const candidates = [{id:'cloudkeep.flight',project:'cloudkeep'},{id:'other.flight',project:'other'}];
  const examples = [{id:'cloudkeep-flight',project:'cloudkeep',port:8103},{id:'other-flight',project:'other',port:8104}];
  for (const example of examples) await save(`examples/${example.id}/local.json`,{port:example.port});
  await save('catalog/games.json',{games:[{slug:'cloudkeep'},{slug:'other'}]});
  await save('catalog/tools.json',{schema_version:1,tools:[]});
  await save('catalog/extraction-candidates.json',{candidates});
  await save('catalog/examples.json',{examples});
  const page = {schema_version:3,slug:'cloudkeep',title:'Cloudkeep',tagline:'驾驶飞船',tagline_en:'Fly the ship',category:'飞行探索',
    overview_video:'cloudkeep/overview',
    examples:[{id:'cloudkeep-flight',title:'飞行',title_en:'Flight',one_liner:'控制飞船。',one_liner_en:'Control the ship.',candidate:'cloudkeep.flight'}]};
  const video = {id:'cloudkeep/flight',project:'cloudkeep',module:'cloudkeep.flight',
    file:'media/cloudkeep/flight.mp4',poster:'media/cloudkeep/flight.jpg',captions:'media/cloudkeep/flight.vtt',
    duration:14.2,fps:60,width:1920,height:1080,bytes:media.length,sha256:sha256(media),
    recorded_at:'2026-09-26T00:00:00Z',scenario:'tools/scenarios/cloudkeep.mjs#flight',method:'cdp-screencast'};
  const videos = {schema_version:1,videos:[video,{...video,id:'cloudkeep/overview',module:null}]};
  const flush = async () => {
    await save('catalog/pages/cloudkeep.json',page);
    await save('catalog/videos.json',videos);
  };
  await flush();
  return {root,temporary,page,videos,candidates,examples,write,save,flush};
}

test('valid fixture loads maps and passes both validators',async t=>{
  const f = await fixture(t), loaded = await loadPages(f.root);
  assert.deepEqual(loaded.pages.get('cloudkeep'),f.page);
  assert.deepEqual(loaded.videos.get('cloudkeep/flight'),f.videos.videos[0]);
  assert.deepEqual(await loadCandidates(f.root),f.candidates);
  const expected = {errors:[],warnings:[],checked:['cloudkeep']};
  assert.deepEqual(await checkPages(f.root),expected);
  assert.deepEqual(await checkPages(f.root,{slug:'cloudkeep',requireVideos:true}),expected);
  assert.deepEqual(await checkVideos(f.root,'cloudkeep'),expected);
});

test('registered tools own videos without becoming game pages',async t=>{
  const f = await fixture(t);
  await f.save('catalog/tools.json',{schema_version:1,tools:[{slug:'plant-tool'}]});
  const video = {...f.videos.videos[1],id:'plant-tool/overview',project:'plant-tool'};
  for (const field of ['file','poster','captions']) {
    const content = await readFile(path.join(f.root,video[field]));
    video[field] = video[field].replace('/cloudkeep/','/plant-tool/');
    await f.write(video[field],content);
  }
  f.videos.videos.push(video); await f.flush();
  assert.deepEqual(await checkPages(f.root),{errors:[],warnings:[],checked:['cloudkeep','plant-tool']});
  assert.deepEqual(await checkVideos(f.root,'plant-tool'),{errors:[],warnings:[],checked:['plant-tool']});
  await f.save('catalog/pages/plant-tool.json',{...f.page,slug:'plant-tool',examples:[],overview_video:'plant-tool/overview'});
  assert.match((await checkPages(f.root)).errors.join('\n'),/plant-tool: slug does not exist in games.json/);
  assert.match((await checkPages(f.root,{slug:'plant-tool'})).errors.join('\n'),/plant-tool: unknown project/);
});

test('tool registry is optional but malformed registries fail validation',async t=>{
  const f = await fixture(t);
  await rm(path.join(f.root,'catalog/tools.json'));
  assert.deepEqual((await checkPages(f.root)).errors,[]);
  for (const data of [null,{schema_version:2,tools:[]},{schema_version:1,tools:[null]}]) {
    await f.save('catalog/tools.json',data);
    assert.match((await checkPages(f.root)).errors.join('\n'),/tools.json must contain/);
  }
});

const textLimits = [
  ['title_en',60,(p,value)=>{p.examples[0].title_en = value;}],
  ['one_liner_en',110,(p,value)=>{p.examples[0].one_liner_en = value;}],
  ['tagline',40,(p,value)=>{p.tagline = value;}],
  ['example title',16,(p,value)=>{p.examples[0].title = value;}],
  ['one_liner',40,(p,value)=>{p.examples[0].one_liner = value;}],
];
for (const [name,limit,change] of textLimits) test(`${name} limit counts Unicode code points`,async t=>{
  const f = await fixture(t);
  for (const character of ['a','飞','🚀']) {
    change(f.page,character.repeat(limit)); await f.flush();
    assert.deepEqual((await checkPages(f.root)).errors,[],`${name}: ${character} at limit`);
    assert.deepEqual((await loadPages(f.root)).pages.get('cloudkeep'),f.page);
    change(f.page,character.repeat(limit + 1)); await f.flush();
    const expected = new RegExp(`exceeds ${limit} characters`);
    assert.match((await checkPages(f.root)).errors.join('\n'),expected);
    const loaded = await loadPages(f.root);
    assert.equal(loaded.pages.has('cloudkeep'),false);
    assert.match(loaded.errors.get('cloudkeep'),expected);
  }
});

for (const scope of ['page','example']) {
  for (const field of ['source','modules','video','keys','points','excerpts','files','unexpected']) {
    test(`${scope} rejects unknown field ${field}`,async t=>{
      const f = await fixture(t);
      (scope === 'page' ? f.page : f.page.examples[0])[field] = [];
      await f.flush();
      assert.match((await checkPages(f.root)).errors.join('\n'),new RegExp(`unknown field ${field}`));
      const loaded = await loadPages(f.root);
      assert.equal(loaded.pages.has('cloudkeep'),false);
      assert.match(loaded.errors.get('cloudkeep'),new RegExp(`unknown field ${field}`));
    });
  }
}

for (const version of [1,2]) test(`v${version} rejection is explicit and isolated by slug in both loaders`,async t=>{
  const f = await fixture(t);
  await f.save('catalog/pages/other.json',{...f.page,schema_version:version,slug:'other'});
  const loaded = await loadPages(f.root);
  assert.deepEqual(loaded.pages.get('cloudkeep'),f.page);
  assert.equal(loaded.pages.has('other'),false);
  assert.match(loaded.errors.get('other'),/schema_version 3 required \(see tools\/pages.mjs\)/);
  const result = await checkPages(f.root);
  assert.deepEqual(result.errors,['other: schema_version 3 required (see tools/pages.mjs)']);
});

test('/api/pages keeps v3 summaries and per-slug migration errors',async t=>{
  const f = await fixture(t);
  await f.save('catalog/pages/other.json',{...f.page,schema_version:1,slug:'other'});
  const server = await createLibrary({index:{root:f.root}});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}/api/pages`;
  for (const [examples,hasExample] of [[f.page.examples,true],[[],false]]) {
    f.page.examples = examples; await f.flush();
    const response = await fetch(url);
    assert.equal(response.status,200);
    const {pages} = await response.json();
    assert.equal(pages.length,2);
    assert.deepEqual(pages[0],{slug:'cloudkeep',title:'Cloudkeep',tagline:'驾驶飞船',tagline_en:'Fly the ship',
      category:'飞行探索',examples:examples.length,has_example:hasExample,runnability:null,
      overview_video:{url:'/media/cloudkeep/flight.mp4',poster:'/media/cloudkeep/flight.jpg',duration:14.2}});
    assert.equal(pages[1].slug,'other');
    assert.equal(pages[1].examples,0);
    assert.equal(pages[1].has_example,false);
    assert.match(pages[1].error,/schema_version 3 required/);
  }
});

const pageFailures = [
  ['unknown example',p=>{p.examples[0].id = 'absent';},/unknown example id absent/],
  ['example project mismatch',p=>{p.examples[0].id = 'other-flight';},/example belongs to another project: other-flight/],
  ['unknown candidate',p=>{p.examples[0].candidate = 'absent';},/unknown candidate or wrong project: absent/],
  ['candidate project mismatch',p=>{p.examples[0].candidate = 'other.flight';},/unknown candidate or wrong project: other.flight/],
  ['duplicate examples',p=>{p.examples.push({...p.examples[0]});},/duplicate example id/],
  ['wrong filename slug',p=>{p.slug = 'other';},/slug must match page filename/],
  ['unsupported schema',p=>{p.schema_version = 4;},/schema_version 3 required/],
  ['empty title',p=>{p.title = '  ';},/title must be a non-empty string/],
  ['invalid category',p=>{p.category = 'unknown';},/category is invalid/],
  ['non-array examples',p=>{p.examples = {};},/examples must be an array/],
  ['malformed example',p=>{p.examples = [null];},/examples\[0\]: must be an object/],
  ...['cloudkeep/flight','other/overview','',42].map(value=>[
    `invalid overview ${value}`,p=>{p.overview_video = value;},/overview_video must be <slug>\/overview or null/]),
  ...['id','title','one_liner','candidate'].map(field=>[
    `empty example ${field}`,p=>{p.examples[0][field] = ' ';},new RegExp(`${field} must be a non-empty string`)]),
];
for (const [name,change,expected] of pageFailures) test(name,async t=>{
  const f = await fixture(t); change(f.page); await f.flush();
  const result = await checkPages(f.root);
  assert.match(result.errors.join('\n'),expected);
  assert.ok(result.errors.every(message=>message.startsWith('cloudkeep:')));
  const loaded = await loadPages(f.root);
  assert.equal(loaded.pages.has('cloudkeep'),false);
  assert.match(loaded.errors.get('cloudkeep'),expected);
});

for (const scope of ['page','example']) test(`${scope} requires every declared field`,async t=>{
  const f = await fixture(t), target = scope === 'page' ? f.page : f.page.examples[0];
  for (const key of Object.keys(target)) {
    const value = target[key]; delete target[key]; await f.flush();
    assert.ok((await checkPages(f.root)).errors.length>0,`${scope}.${key}`);
    assert.equal((await loadPages(f.root)).pages.has('cloudkeep'),false,`${scope}.${key}`);
    target[key] = value;
  }
});

test('all categories are accepted with empty examples and a null overview',async t=>{
  const f = await fixture(t);
  f.page.examples = []; f.page.overview_video = null; f.videos.videos = [];
  for (const category of ['飞行探索','赛车','开放世界动作','战斗','城镇与生活','风景与氛围','互动影像','其他引擎']) {
    f.page.category = category; await f.flush();
    assert.deepEqual(await checkPages(f.root,{requireVideos:true}),{errors:[],warnings:[],checked:['cloudkeep']});
    assert.deepEqual((await checkVideos(f.root,'cloudkeep')).errors,[]);
    assert.deepEqual((await loadPages(f.root)).pages.get('cloudkeep'),f.page);
  }
});

test('symlink escaping the root is rejected for media',async t=>{
  const f = await fixture(t), outside = path.join(f.temporary,'outside.jpg');
  await writeFile(outside,'outside');
  await symlink(outside,path.join(f.root,'media/cloudkeep/escape.jpg'));
  f.videos.videos[0].poster = 'media/cloudkeep/escape.jpg'; await f.flush();
  assert.match((await checkPages(f.root)).errors.join('\n'),/videos:.*path escapes root/);
});

const videoFailures = [
  ['preview traversal',v=>{v.preview = 'media/cloudkeep/../x.mp4';},/preview:.*without traversal/],
  ['preview wrong project',v=>{v.preview = 'media/other/preview.mp4';},/preview:.*under media\/cloudkeep/],
  ['missing preview',v=>{v.preview = 'media/cloudkeep/absent.mp4';},/preview: cannot access/],
  ['invalid preview',v=>{v.preview = null;},/preview must be a non-empty string/],
  ['preview sha mismatch',v=>{v.preview = v.file; v.preview_sha256 = '0'.repeat(64);},/preview sha256 mismatch/],
  ['preview bytes mismatch',v=>{v.preview = v.file; v.preview_bytes = v.bytes + 1;},/preview bytes mismatch/],
  ['invalid preview sha',v=>{v.preview = v.file; v.preview_sha256 = 'invalid';},/preview_sha256 must be/],
  ['invalid preview bytes',v=>{v.preview = v.file; v.preview_bytes = -1;},/preview_bytes must be/],
  ['video sha mismatch',v=>{v.sha256 = '0'.repeat(64);},/sha256 mismatch/],
  ['video bytes mismatch',v=>{v.bytes++;},/bytes mismatch/],
  ['video traversal',v=>{v.file = 'media/cloudkeep/../x';},/without traversal/],
  ['video wrong prefix',v=>{v.poster = 'cloudkeep/upstream/flight.ts';},/expected a relative path under media\/cloudkeep/],
  ['missing poster',v=>{v.poster = 'media/cloudkeep/absent.jpg';},/poster: cannot access/],
  ['missing media',v=>{v.file = 'media/cloudkeep/absent.mp4';},/file: cannot access/],
  ['video unknown module',v=>{v.module = 'other.flight';},/module must be null or a candidate/],
  ['video unknown project',v=>{v.project = 'absent';},/unknown project/],
  ['malformed video id',v=>{v.id = 'cloudkeep/flight/extra';},/id must have form/],
  ['video project mismatch',v=>{v.id = 'other/flight';},/id project does not match/],
  ['invalid video timestamp',v=>{v.recorded_at = 'yesterday';},/ISO-8601/],
];
for (const [name,change,expected] of videoFailures) test(name,async t=>{
  const f = await fixture(t); change(f.videos.videos[0]); await f.flush();
  const result = await checkPages(f.root);
  assert.match(result.errors.filter(message=>message.startsWith('videos:')).join('\n'),expected);
  assert.ok(result.errors.every(message=>/^(videos|cloudkeep):/.test(message)));
});

test('optional preview accepts absent integrity fields and checks supplied fields',async t=>{
  const f = await fixture(t), video = f.videos.videos[1], bytes = Buffer.from('preview bytes');
  video.preview = 'media/cloudkeep/overview-preview.mp4';
  await f.write(video.preview,bytes);
  for (const fields of [{},{preview_sha256:sha256(bytes)},{preview_bytes:bytes.length}]) {
    Object.assign(video,fields); await f.flush();
    assert.deepEqual((await checkPages(f.root)).errors,[]);
    assert.deepEqual((await checkVideos(f.root,'cloudkeep')).errors,[]);
  }
  const outside = path.join(f.temporary,'outside.mp4');
  await writeFile(outside,bytes);
  await symlink(outside,path.join(f.root,'media/cloudkeep/escape.mp4'));
  video.preview = 'media/cloudkeep/escape.mp4'; await f.flush();
  assert.match((await checkVideos(f.root,'cloudkeep')).errors.join('\n'),/preview: path escapes root/);
});

test('duplicate videos are not hidden by map loading',async t=>{
  const f = await fixture(t);
  f.videos.videos.push({...f.videos.videos[0]}); await f.flush();
  assert.match((await checkPages(f.root)).errors.join('\n'),/duplicate video id/);
});

test('missing video warns while drafting and errors when required',async t=>{
  const f = await fixture(t);
  f.videos.videos = []; await f.flush();
  const normal = await checkPages(f.root);
  assert.deepEqual(normal.errors,[]); assert.equal(normal.warnings.length,1);
  assert.ok(normal.warnings.every(message=>/^cloudkeep: missing video/.test(message)));
  for (const result of [await checkPages(f.root,{requireVideos:true}),await checkVideos(f.root,'cloudkeep')]) {
    assert.equal(result.errors.length,1); assert.deepEqual(result.warnings,[]);
    assert.match(result.errors.join('\n'),/cloudkeep\/overview/);
  }
});

test('runnable examples require no videos, with an overview or with no video at all',async t=>{
  const f = await fixture(t);
  f.videos.videos = [f.videos.videos[1]]; await f.flush();
  const expected = {errors:[],warnings:[],checked:['cloudkeep']};
  assert.deepEqual(await checkPages(f.root,{requireVideos:true}),expected);
  assert.deepEqual(await checkVideos(f.root,'cloudkeep'),expected);
  f.page.overview_video = null; f.videos.videos = []; await f.flush();
  assert.deepEqual(await checkPages(f.root,{requireVideos:true}),expected);
  assert.deepEqual(await checkVideos(f.root,'cloudkeep'),expected);
});

test('absent videos catalog is empty and absent pages are allowed unless requested',async t=>{
  const f = await fixture(t);
  await rm(path.join(f.root,'catalog/videos.json'));
  assert.equal((await loadPages(f.root)).videos.size,0);
  assert.equal((await checkPages(f.root)).warnings.length,1);
  await rm(path.join(f.root,'catalog/pages'),{recursive:true});
  assert.deepEqual(await checkPages(f.root),{errors:[],warnings:[],checked:[]});
  assert.equal((await loadPages(f.root)).pages.size,0);
  assert.match((await checkPages(f.root,{slug:'cloudkeep'})).errors.join('\n'),/page file does not exist/);
  assert.deepEqual((await checkVideos(f.root,'cloudkeep')).errors,[]);
});

test('captions must start with WEBVTT',async t=>{
  const f = await fixture(t); await f.write('media/cloudkeep/flight.vtt','not WebVTT');
  assert.match((await checkVideos(f.root,'cloudkeep')).errors.join('\n'),/captions must start with WEBVTT/);
});

test('checkVideos ignores page prose and other projects but checks references',async t=>{
  const f = await fixture(t);
  f.page.title = ''; f.page.examples = null;
  f.videos.videos.push({id:'other/broken',project:'other'});
  await f.flush(); await f.write('catalog/pages/other.json','invalid json');
  assert.deepEqual((await checkVideos(f.root,'cloudkeep')).errors,[]);
  assert.match((await checkPages(f.root,{slug:'cloudkeep'})).errors.join('\n'),/title must be/);
  f.page.overview_video = 'cloudkeep/missing'; await f.flush();
  assert.match((await checkVideos(f.root,'cloudkeep')).errors.join('\n'),/missing video cloudkeep\/missing/);
});

test('videos are validated even before a project page exists',async t=>{
  const f = await fixture(t);
  await rm(path.join(f.root,'catalog/pages'),{recursive:true});
  f.videos.videos[0].sha256 = '0'.repeat(64);
  await f.save('catalog/videos.json',f.videos);
  assert.match((await checkVideos(f.root,'cloudkeep')).errors.join('\n'),/sha256 mismatch/);
});

test('examples do not require full candidate coverage',async t=>{
  const f = await fixture(t);
  await f.save('catalog/extraction-candidates.json',{candidates:[...f.candidates,
    {id:'cloudkeep.camera',project:'cloudkeep'},{id:'cloudkeep.world',project:'cloudkeep'}]});
  assert.deepEqual((await checkPages(f.root)).errors,[]);
});

test('captions may be an empty WEBVTT file and module may be null',async t=>{
  const f = await fixture(t);
  await f.write('media/cloudkeep/flight.vtt','WEBVTT\n');
  f.videos.videos.forEach(video=>{video.module = null;}); await f.flush();
  assert.deepEqual((await checkPages(f.root)).errors,[]);
  assert.deepEqual((await checkVideos(f.root,'cloudkeep')).errors,[]);
});

test('malformed JSON and schema shapes become prefixed errors',async t=>{
  const f = await fixture(t);
  await f.write('catalog/pages/cloudkeep.json','{');
  await f.save('catalog/videos.json',{schema_version:2,videos:{}});
  const result = await checkPages(f.root);
  assert.ok(result.errors.some(message=>/^cloudkeep: cannot read page/.test(message)));
  assert.ok(result.errors.some(message=>/^videos: schema_version/.test(message)));
  assert.ok(result.errors.some(message=>/^videos: videos must be an array/.test(message)));
});

test('real catalog candidates load',async()=>{
  const candidates = await loadCandidates();
  const catalog = JSON.parse(await readFile(path.join(ROOT,'catalog/extraction-candidates.json'),'utf8'));
  assert.deepEqual(candidates,catalog.candidates);
  assert.ok(candidates.some(row=>row.id === 'cloudkeep.flight' && row.project === 'cloudkeep'));
});

test('CLI check on the real root validates every catalog v3 page',async()=>{
  const pages = (await readdir(path.join(ROOT, 'catalog/pages'))).filter(name => name.endsWith('.json')).map(name=>name.slice(0,-5));
  const {videos} = JSON.parse(await readFile(path.join(ROOT,'catalog/videos.json'),'utf8'));
  const count = new Set([...pages,...videos.map(video=>video.project)]).size;
  assert.ok(count > 0);
  const result = spawnSync(process.execPath,[path.join(ROOT,'tools/pages.mjs'),'check'],{cwd:ROOT,encoding:'utf8'});
  assert.equal(result.error,undefined);
  assert.equal(result.status,0,result.stderr);
  assert.equal(result.stdout.trim(), `Checked ${count} project(s): 0 error(s), 0 warning(s)`);
});

test('CLI reports errors and rejects missing check-videos arguments',()=>{
  for (const args of [['check','nonexistent-project'],['check-videos'],['check','--unknown']]) {
    const result = spawnSync(process.execPath,[path.join(ROOT,'tools/pages.mjs'),...args],{cwd:ROOT,encoding:'utf8'});
    assert.equal(result.status,1); assert.ok(result.stderr.length > 0);
  }
});


test('loadPages isolates malformed JSON and invalid page structures by slug',async t=>{
  const f = await fixture(t);
  for (const broken of ['{','null','{}','{"examples":[null]}']) {
    await f.write('catalog/pages/other.json',broken);
    const loaded = await loadPages(f.root);
    assert.deepEqual(loaded.pages.get('cloudkeep'),f.page);
    assert.equal(loaded.pages.has('other'),false);
    assert.match(loaded.errors.get('other'),/^other: (cannot read page|invalid page structure)/);
    assert.equal(loaded.errors.size,1);
  }
});

const exampleFailures = [
  ...[1023,65536,8103.5,'8103',null,undefined].map(port=>[
    `invalid example port ${port}`,e=>{e.port=port;},/port must be an integer from 1024 to 65535/]),
  ['mismatched local port',e=>{e.port=8105;},/port must match local.json port/],
  ...['../cloudkeep-flight','Uppercase','has_underscore','',42].map(folder=>[
    `invalid example folder ${folder}`,e=>{e.folder=folder;},/folder must match/]),
  ['missing example folder',e=>{e.folder='missing';},/cannot access folder or local.json/],
  ...['index.html','/../index.html','/a..b',42,null].map(entry=>[
    `invalid example entry ${entry}`,e=>{e.entry=entry;},/entry must start with \/ and contain no \.\./]),
];
for (const [name,change,expected] of exampleFailures) test(name,async t=>{
  const f=await fixture(t); change(f.examples[0]);
  await f.save('catalog/examples.json',{examples:f.examples});
  assert.match((await checkPages(f.root)).errors.join('\n'),expected);
});

test('example folder defaults to id and entry defaults to root; shared folder may share port',async t=>{
  const f=await fixture(t);
  f.examples.push({id:'cloudkeep-models',project:'cloudkeep',folder:'cloudkeep-flight',port:8103,entry:'/models.html'});
  f.page.examples.push({...f.page.examples[0],id:'cloudkeep-models'});
  await f.save('catalog/examples.json',{examples:f.examples}); await f.flush();
  assert.deepEqual((await checkPages(f.root)).errors,[]);
});

test('example ports cannot collide across folders, including unreferenced examples in a scoped check',async t=>{
  const f=await fixture(t); f.examples[1].port=8103;
  await f.save('catalog/examples.json',{examples:f.examples});
  assert.match((await checkPages(f.root,{slug:'cloudkeep'})).errors.join('\n'),/port 8103 is shared by different example folders/);
  await rm(path.join(f.root,'catalog/pages'),{recursive:true});
  assert.match((await checkPages(f.root)).errors.join('\n'),/port 8103 is shared by different example folders/);
});

test('example ports cannot collide with any game port',async t=>{
  const f=await fixture(t);
  await f.save('catalog/games.json',{games:[{slug:'cloudkeep',port:8100},{slug:'other',port:8104}]});
  assert.match((await checkPages(f.root,{slug:'cloudkeep'})).errors.join('\n'),/port 8104 conflicts with a game port/);
});

test('example folder must be a directory',async t=>{
  const f=await fixture(t); f.examples[0].folder='not-directory';
  await f.write('examples/not-directory','file');
  await f.save('catalog/examples.json',{examples:f.examples});
  assert.match((await checkPages(f.root)).errors.join('\n'),/folder must be a directory/);
});

test('example port range includes both boundaries',async t=>{
  const f=await fixture(t);
  for (const port of [1024,65535]) {
    f.examples[0].port=port;
    await f.save('catalog/examples.json',{examples:f.examples});
    await f.save('examples/cloudkeep-flight/local.json',{port});
    assert.deepEqual((await checkPages(f.root)).errors,[]);
  }
});
