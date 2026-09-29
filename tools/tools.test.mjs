import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, readFile, writeFile, rm, symlink} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {loadTools, validateTools, toolDetail, toolSummary} from './tools.mjs';
import {loadDemos} from './demos.mjs';

const original = JSON.parse(await readFile(new URL('../catalog/tools.json',import.meta.url),'utf8')).tools[0];
const tool = () => ({...structuredClone(original),examples:[]});
const example = {id:'plant-demo',title:'叶序',title_en:'Leaves',one_liner:'独立叶序示例',one_liner_en:'Independent leaf arrangement',candidate:'fab-botanic.leaves'};
const catalogExample = {id:example.id,project:original.slug,folder:'plant-host',category:['world']};

test('tool schema accepts the owner copy and resolves page-shaped examples', async () => {
  assert.equal((await loadTools())[0].title,'FABOTANIC');
  const value = tool(); value.examples=[example];
  assert.deepEqual(validateTools({schema_version:1,tools:[value]},[catalogExample]),[]);
});
test('tool schema rejects missing fields, oversized copy, unsafe URLs and malformed lists', () => {
  for (const field of ['slug','title','author','author_url','url','terms_url','tagline','tagline_en','facts','features','steps','can','cannot','license_note','overview_video','examples']) {
    const value=tool(); delete value[field];
    assert.ok(validateTools({schema_version:1,tools:[value]}).length,field);
  }
  for (const change of [t=>t.tagline='字'.repeat(41),t=>t.url='http://example.com',t=>t.terms_url='javascript:alert(1)',
    t=>t.author_url='https://user:password@example.com',t=>t.facts.pop(),t=>t.features.pop(),t=>t.steps.push({zh:'多',en:'More'}),
    t=>t.slug='../capture',t=>t.hosted='true',t=>t.hosted=1,t=>t.features[0].desc_en='',t=>t.overview_video='other/overview']) {
    const value=tool(); change(value); assert.ok(validateTools({schema_version:1,tools:[value]}).length);
  }
  assert.ok(validateTools({schema_version:1,tools:[tool(),tool()]}).some(e=>e.includes('duplicate slug')));
});
test('unknown, duplicate, wrong-owner and oversized examples fail validation', () => {
  const value=tool(); value.examples=[example];
  assert.match(validateTools({schema_version:1,tools:[value]}).join(),/unknown example/);
  assert.match(validateTools({schema_version:1,tools:[value]},[{...catalogExample,project:'another'}]).join(),/another project/);
  value.examples=[example,{...example,title:'字'.repeat(17)}];
  const errors=validateTools({schema_version:1,tools:[value]},[catalogExample]).join();
  assert.match(errors,/duplicate example/);assert.match(errors,/exceeds 16/);
});
test('summaries omit detail-only copy; detail resolves launch metadata', () => {
  const value=tool();value.hosted=false;value.examples=[example];
  const video={url:'/media/fab-botanic/overview.mp4'},launch={url:'/examples/plant-host/',type:'example'};
  const summary=toolSummary(value,video);
  assert.equal(summary.examples,1);assert.equal(summary.features,undefined);assert.equal(summary.url,original.url);
  const full=toolDetail(value,video,[{id:'example:plant-demo',launch}]);
  assert.deepEqual(full.examples[0].launch,launch);assert.deepEqual(full.overview_video,video);
  assert.equal(full.source_url,undefined);assert.equal(full.project,undefined);
});
test('hosted tools require safe local configuration and expose a launch in summaries and details', async t => {
  const root=await mkdtemp(path.join(os.tmpdir(),'gameref-tool-local-'));
  t.after(()=>rm(root,{recursive:true,force:true}));
  await mkdir(path.join(root,'catalog'));
  await mkdir(path.join(root,original.slug,'public'),{recursive:true});
  const value=tool();value.hosted=true;
  const save=()=>writeFile(path.join(root,'catalog/tools.json'),JSON.stringify({schema_version:1,tools:[value]}));
  await save();await writeFile(path.join(root,'catalog/examples.json'),'{"examples":[]}');
  await assert.rejects(loadTools(root),/Missing local.json/);
  value.hosted=false;await save();assert.equal((await loadTools(root))[0].launch,undefined);
  value.hosted=true;await save();
  const config={root:'public',entry:'/tl/fab-botanic/index.html',port:8107};
  const localFile=path.join(root,original.slug,'local.json');
  for (const change of [{root:'../outside'},{root:'/tmp'},{entry:'//evil.test/a'},{entry:'/../secret'},{entry:'/%2e%2e/secret'},{entry:'/a?x=1'},{port:0},{port:'8107'},{port:65536}]) {
    await writeFile(localFile,JSON.stringify({...config,...change}));
    await assert.rejects(loadTools(root),/Invalid local.json/);
  }
  await symlink(path.join(root,'catalog'),path.join(root,original.slug,'escape'));
  await writeFile(localFile,JSON.stringify({...config,root:'escape'}));
  await assert.rejects(loadTools(root),/outside archive/);
  await writeFile(localFile,JSON.stringify(config));
  const loaded=(await loadTools(root))[0];
  assert.equal(loaded.launch.url,'http://127.0.0.1:8107/tl/fab-botanic/index.html');
  assert.deepEqual(toolSummary(loaded,null).launch,loaded.launch);
  assert.equal(toolDetail(loaded,null).local,undefined);
  const launch={type:'tool',url:'/base/tools-app/fab-botanic/tl/fab-botanic/index.html'};
  const records=[{id:'tool:'+loaded.slug,launch}];
  assert.deepEqual(toolSummary(loaded,null,records).launch,launch);
  assert.deepEqual(toolDetail(loaded,null,records).launch,launch);
});
test('tool examples join Demos with tool attribution, folder source and launch', async t => {
  const root=await mkdtemp(path.join(os.tmpdir(),'gameref-tools-'));
  t.after(()=>rm(root,{recursive:true,force:true}));
  await mkdir(path.join(root,'catalog/pages'),{recursive:true});
  const value=tool();value.hosted=false;value.examples=[example];
  for (const [name,data] of Object.entries({'tools':{schema_version:1,tools:[value]},'examples':{examples:[catalogExample]}}))
    await writeFile(path.join(root,'catalog',name+'.json'),JSON.stringify(data));
  const launch={url:'http://127.0.0.1:8999/'};
  const data=await loadDemos({root,games:[],records:[{id:'example:plant-demo',launch}]});
  assert.equal(data.demos.length,1);assert.equal(data.demos[0].source_label,'FABOTANIC');
  assert.equal(data.demos[0].source_url,'https://github.com/0xmariowu/awesome-threejs-games/tree/main/examples/plant-host');
  assert.deepEqual(data.demos[0].launch,launch);
});
