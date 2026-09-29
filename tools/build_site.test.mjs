import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, writeFile, readFile, readdir, rm} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import {copyRuntime, rewriteURLs, scanText, validateSizes, runtimeFile, BASE, validateWorkflow, checkBuildInputs, siteVideo, prepareVideo} from './build_site.mjs';

test('root URL rewrites preserve remote URLs, relative paths, regexps and WASM filesystem strings', () => {
  const source = `import('/assets/a.js'); fetch("/world/data.json"); const u=\`/assets/\${name}\`; const path='/home/user'; const remote='https://host/assets/a'; const cdn='//host/a'; const re=/assets/; const local='./assets/a'; <img src="/assets/a.png"><style>a{background:url(/assets/a.png)}</style>`;
  const result=rewriteURLs(source,BASE+'games/test/',new Set(['assets','world']));
  assert.equal(result.rewrites.reduce((sum,row)=>sum+row.count,0),5);
  assert.ok(result.text.includes(`fetch("${BASE}games/test/world/data.json")`));
  for (const original of ["'/home/user'","'https://host/assets/a'","'//host/a'",'/assets/;',"'./assets/a'"]) assert.ok(result.text.includes(original),original);
  assert.equal(rewriteURLs(result.text,BASE+'games/test/',new Set(['assets','world'])).rewrites.length,0);
});

test('scanner records manifests, base tags, services, headers and external URLs', () => {
  const result=scanText('<base href="/assets/"><script>navigator.serviceWorker; SharedArrayBuffer; crossOriginIsolated; new WebSocket("wss://host"); fetch("/api/status")</script>{"start_url":"/index.html","uri":"/assets/a.bin"} https://host/texture.png');
  assert.ok(result.absolute_urls.includes('/index.html'));
  assert.ok(result.absolute_urls.includes('/assets/a.bin'));
  for (const feature of ['<base','serviceWorker','SharedArrayBuffer','crossOriginIsolated','WebSocket','/api/']) assert.ok(result.features.includes(feature));
  assert.deepEqual(result.external_urls,['https://host/texture.png']);
});

test('runtime copying is non-destructive, logged, filtered and fixes extensionless CSS MIME', async () => {
  const root=await mkdtemp(path.join(os.tmpdir(),'gameref-build-test-'));
  try {
    const source=path.join(root,'source'),dest=path.join(root,'site');
    await mkdir(path.join(source,'_external/fonts.googleapis.com'),{recursive:true});
    await mkdir(path.join(source,'assets'));
    const html='<link href="/_external/fonts.googleapis.com/css2-123"><script src="/assets/main.js"></script>';
    await writeFile(path.join(source,'index.html'),html);
    await writeFile(path.join(source,'_external/fonts.googleapis.com/css2-123'),'body { color:red }');
    await writeFile(path.join(source,'assets/main.js'),'fetch("/api/status");');
    for (const file of ['main.js.map','README.md','local.json','provenance.json','main.test.mjs']) await writeFile(path.join(source,file),'excluded');
    const result=await copyRuntime(source,dest,BASE+'games/test/',{slug:'test'});
    assert.equal(await readFile(path.join(source,'index.html'),'utf8'),html);
    assert.equal(await readFile(path.join(dest,'index.html'),'utf8'),`<link rel="icon" href="data:,"><link href="${BASE}games/test/_external/fonts.googleapis.com/css2-123.css"><script src="${BASE}games/test/assets/main.js"></script>`);
    assert.equal(await readFile(path.join(dest,'assets/main.js'),'utf8'),`fetch("${BASE}games/test/api/status");`);
    assert.equal(result.rewrites.filter(row=>row.file==='index.html').length,4);
    assert.equal((await readdir(dest)).includes('README.md'),false);
    const log=JSON.parse(await readFile(path.join(dest,'.gameref-deploy.json')));
    assert.deepEqual(log,result);
  } finally {await rm(root,{recursive:true,force:true});}
});

test('Pages size ceilings use decimal bytes and include every folder', () => {
  assert.throws(()=>validateSizes([{file:'huge.wasm',bytes:100_000_001}]),/oversized/);
  assert.throws(()=>validateSizes(Array.from({length:10},(_,i)=>({file:`${i}/a`,bytes:100_000_000}))),/size limit/);
  assert.deepEqual(validateSizes([{file:'index.html',bytes:10},{file:'games/a/x',bytes:20}]).groups,{'(root)':10,games:20});
  assert.equal(validateSizes([{file:'a',bytes:100_000_000}]).total,100_000_000);
});

test('runtime filter retains runtime source, binary data and license files', () => {
  for (const file of ['src/main.js','original/terrain-worker.js','assets/world.bin.gz','LICENSE','assets/model.gltf']) assert.equal(runtimeFile(file),true,file);
  for (const file of ['node_modules/three.js','dist-garden/assets/a.js','tests/game.js','.gameref/manifest.json','assets/a.js.map','provenance/manifest.json','test_browser.py','screenshots/a.png']) assert.equal(runtimeFile(file),false,file);
});

test('Pages media uses same-site encoded artifacts without Release URLs', () => {
  assert.deepEqual(siteVideo({file:'media/game/overview.mp4',poster:'media/game/poster.jpg',duration:60},'game'),
    {url:BASE+'media/game/overview.mp4',poster:BASE+'previews/game.webp',duration:60});
  assert.equal(siteVideo(null,'game').url,null);
});

test('workflow and tracked-input gate rejects missing, untracked and misconfigured inputs', async t => {
  const root = await mkdtemp(path.join(os.tmpdir(),'gameref-input-test-'));
  t.after(()=>rm(root,{recursive:true,force:true}));
  const workflow = await readFile(new URL('../.github/workflows/pages.yml',import.meta.url),'utf8');
  validateWorkflow(workflow);
  for (const [before,after] of [['path: _site','path: dist'],['node-version: \'22\'','node-version: \'20\''],
    ['working-directory: webgame-lab','working-directory: examples'],['webgame-lab/package-lock.json','package-lock.json']]) {
    assert.throws(()=>validateWorkflow(workflow.replace(before,after)),/workflow missing/);
  }
  async function put(file,body) {await mkdir(path.dirname(path.join(root,file)),{recursive:true});await writeFile(path.join(root,file),body);}
  await put('.github/workflows/pages.yml',workflow);
  await put('tools/build_site.mjs','// fixture');
  await put('catalog/tools.json',JSON.stringify({schema_version:1,tools:[]}));
  for (const name of ['games','examples']) await put(`catalog/${name}.json`,JSON.stringify({[name]:[]}));
  for (const name of ['extraction-candidates','runnability','videos','lab-i18n']) await put(`catalog/${name}.json`,'{}');
  for (const dir of ['catalog/pages','library','previews']) await put(`${dir}/fixture.txt`,'fixture');
  for (const name of ['package.json','package-lock.json','src/catalog.ts','index.html','vite.config.ts']) await put(`webgame-lab/${name}`,'{}');
  execFileSync('git',['init','-q',root]);
  execFileSync('git',['-C',root,'add','.']);
  assert.ok((await checkBuildInputs(root)).files > 10);
  const tool=JSON.parse(await readFile(new URL('../catalog/tools.json',import.meta.url),'utf8')).tools[0];
  await put('catalog/tools.json',JSON.stringify({schema_version:1,tools:[{...tool,examples:[]}]}));
  await put('fab-botanic/local.json',JSON.stringify({root:'public',entry:'/tl/fab-botanic/index.html',port:8107}));
  await put('fab-botanic/public/tl/fab-botanic/index.html','<head></head><script src="/tl/common/app.js"></script>');
  await put('fab-botanic/public/tl/common/app.js','console.log("plant list")');
  await assert.rejects(checkBuildInputs(root),/Untracked build input: fab-botanic\/local.json/);
  execFileSync('git',['-C',root,'add','fab-botanic/local.json']);
  await assert.rejects(checkBuildInputs(root),/Untracked build input: fab-botanic\/public\/tl\/common\/app.js/);
  execFileSync('git',['-C',root,'add','fab-botanic/public']);
  await put('previews/fab-botanic.webp','recorded preview');
  await assert.rejects(checkBuildInputs(root),/Untracked build input: previews\/fab-botanic.webp/);
  execFileSync('git',['-C',root,'add','previews/fab-botanic.webp']);
  await assert.rejects(checkBuildInputs(root),/Untracked build input: media-web\/fab-botanic\/overview.mp4/);
  await put('media-web/fab-botanic/overview.mp4','recorded video');
  execFileSync('git',['-C',root,'add','media-web/fab-botanic/overview.mp4']);
  const requiredInputs = await checkBuildInputs(root);
  assert.ok(requiredInputs.files > 10);
  await put('fab-botanic/public/tl/fab-botanic/about.html','archived gallery');
  await put('fab-botanic/public/tl/fab-botanic/about/scenes/plant.glb','archived model');
  assert.deepEqual(await checkBuildInputs(root),requiredInputs);
  await put('library/untracked.js','fixture');
  await assert.rejects(checkBuildInputs(root),/Untracked build input: library\/untracked.js/);
  await rm(path.join(root,'library/untracked.js'));
  await rm(path.join(root,'webgame-lab/package-lock.json'));
  await assert.rejects(checkBuildInputs(root),/ENOENT/);
  await rm(path.join(root,'.github/workflows/pages.yml'));
  await assert.rejects(checkBuildInputs(root),/ENOENT/);
});

test('same client routes and JSON URLs work at the Pages base and at local root', async () => {
  const source=await readFile(new URL('../library/static.js',import.meta.url),'utf8');
  async function mode(content) {
    const setup=`const document={querySelector:()=>(${JSON.stringify(content ? {content}:null)})}; const location={href:'https://example.test${content || '/'}p/game'};\n`;
    return import('data:text/javascript;base64,'+Buffer.from(setup+source).toString('base64'));
  }
  const hosted=await mode(BASE),local=await mode(null);
  assert.equal(hosted.siteURL('/demos?cat=water'),BASE+'demos?cat=water');
  assert.equal(hosted.siteURL(BASE+'p/game'),BASE+'p/game');
  assert.equal(hosted.routePath(BASE+'p/game/'),'/p/game');
  assert.equal(hosted.siteURL('/data/page/game.json'),BASE+'data/page/game.json');
  assert.equal(hosted.siteURL('/source/game/README.md'),BASE+'source/game/README.md');
  assert.equal(hosted.siteURL('/demos/example%3Awater'),BASE+'demos/example%3Awater');
  assert.equal(hosted.siteURL('/tools'),BASE+'tools');
  assert.equal(hosted.routePath(BASE+'t/fab-botanic/'),'/t/fab-botanic');
  assert.equal(hosted.siteURL('/data/tool/fab-botanic.json'),BASE+'data/tool/fab-botanic.json');
  assert.equal(local.isStatic,false);
  assert.equal(local.siteURL('/p/game'),'/p/game');
});

test('HTML home/base links and PWA start URLs retain the game base without changing JS slash literals', () => {
  const prefix=BASE+'games/example/';
  assert.equal(rewriteURLs('<base href="/"><a href="/">Home</a>',prefix,new Set(),'index.html').text,`<base href="${prefix}"><a href="${prefix}">Home</a>`);
  const manifest=rewriteURLs('{"start_url":"/","scope":"/","icons":[{"src":"/assets/icon.png"}]}',prefix,new Set(['assets']),'site.webmanifest');
  assert.deepEqual(JSON.parse(manifest.text),{start_url:prefix,scope:prefix,icons:[{src:prefix+'assets/icon.png'}]});
  assert.equal(rewriteURLs('path.split("/")',prefix,new Set(),'main.js').text,'path.split("/")');
  assert.ok(scanText('{"start_url":"/"}').absolute_urls.includes('/'));
});

test('source manifest includes all tracked text roots with sizes, bundles only key sources and excludes escapes', async t => {
  const {sourceManifest} = await import('./demos.mjs');
  const {symlink} = await import('node:fs/promises');
  const root = await mkdtemp(path.join(os.tmpdir(),'gameref-sources-'));
  t.after(()=>rm(root,{recursive:true,force:true}));
  const files = {
    'game/README.md':'Read me', 'game/TECHNICAL.md':'Technical', 'game/public/main.js':'const game = 1;', 'game/shader.gdshaderinc':'shader source', 'game/NOTICE':'License notice',
    'examples/demo/src/host.js':'export const host = 1;', 'examples/demo/public/index.html':'<main>Host</main>',
    'examples/demo/public/original/game.js':'export const original = 1;',
    'webgame-lab/src/scenes/water.tsx':'export const water = 1;', 'webgame-lab/src/catalog.ts':'export const catalog = [];',
    'tools/private.mjs':'excluded', 'catalog/secrets.txt':'excluded', 'game/.private.js':'excluded',
    'game/binary.js':'binary\0', 'game/node_modules/dependency.js':'excluded',
  };
  for (const [name,body] of Object.entries(files)) {await mkdir(path.dirname(path.join(root,name)),{recursive:true});await writeFile(path.join(root,name),body);}
  await symlink(path.join(root,'tools/private.mjs'),path.join(root,'game/escape.js'));
  execFileSync('git',['init','-q',root]);execFileSync('git',['-C',root,'add','.']);
  await writeFile(path.join(root,'game/untracked.js'),'untracked');
  const manifest=await sourceManifest(root,[{slug:'game'}]);
  assert.deepEqual(manifest.map(f=>f.path),Object.keys(files).slice(0,10).sort());
  for (const row of manifest) assert.equal(row.size,Buffer.byteLength(files[row.path]));
  assert.deepEqual(manifest.filter(f=>f.bundled).map(f=>f.path),[
    'examples/demo/public/index.html','examples/demo/src/host.js','game/README.md','game/TECHNICAL.md','webgame-lab/src/scenes/water.tsx']);
});

 test('clean builds copy encoded videos and reject missing or oversized artifacts', async t => {
  const root=await mkdtemp(path.join(os.tmpdir(),'gameref-video-test-'));
  t.after(()=>rm(root,{recursive:true,force:true}));
  await assert.rejects(prepareVideo(root,'game',path.join(root,'site')),/Missing versioned video/);
  await mkdir(path.join(root,'media-web/game'),{recursive:true});
  await writeFile(path.join(root,'media-web/game/overview.mp4'),Buffer.from('video fixture'));
  assert.equal((await prepareVideo(root,'game',path.join(root,'site'))).bytes,13);
  assert.equal(await readFile(path.join(root,'site/media/game/overview.mp4'),'utf8'),'video fixture');
  await writeFile(path.join(root,'media-web/game/overview.mp4'),Buffer.alloc(6_000_000));
  assert.equal((await prepareVideo(root,'game',path.join(root,'site'))).bytes,6_000_000);
  await writeFile(path.join(root,'media-web/game/overview.mp4'),Buffer.alloc(6_000_001));
  await assert.rejects(prepareVideo(root,'game',path.join(root,'site')),/Invalid video size/);
});


test('INKWAVE copying excludes the private project while preserving local files and other games', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'gameref-private-runtime-'));
  try {
    const source = path.join(root, 'inkwave'), destination = path.join(root, 'site');
    const privateFiles = ['garden.html', 'src/garden/main.js', 'assets/garden/audio/rifle.mp3',
      'docs/garden/audit/reproduce.mjs', 'tests/garden/combat.test.mjs',
      'scripts/garden-audio.py', 'scripts/garden-check.mjs', 'vite.config.js',
      'package.json', 'package-lock.json'];
    const originals = ['index.html', 'src/main.js', 'assets/fonts/game.woff2'];
    for (const relative of [...privateFiles, ...originals]) {
      await mkdir(path.dirname(path.join(source, relative)), {recursive:true});
      await writeFile(path.join(source, relative), 'local bytes');
    }
    const report = await copyRuntime(source, destination, BASE+'games/inkwave/', {slug:'inkwave'});
    assert.equal(report.files, originals.length);
    for (const relative of privateFiles) {
      await assert.rejects(readFile(path.join(destination, relative)), {code:'ENOENT'});
      assert.equal(await readFile(path.join(source, relative), 'utf8'), 'local bytes');
    }
    for (const relative of originals) assert.ok((await readFile(path.join(destination, relative))).length);
    const unrelated = path.join(root, 'other-game');
    await copyRuntime(source, unrelated, BASE+'games/other/', {slug:'other'});
    assert.ok((await readFile(path.join(unrelated, 'garden.html'), 'utf8')).endsWith('local bytes'));
    assert.equal(await readFile(path.join(unrelated, 'src/garden/main.js'), 'utf8'), 'local bytes');
  } finally {await rm(root, {recursive:true, force:true});}
});

test('FABOTANIC excludes only its archived gallery and retains the generator runtime', async t => {
  const root = await mkdtemp(path.join(os.tmpdir(),'gameref-fabotanic-runtime-'));
  t.after(()=>rm(root,{recursive:true,force:true}));
  const source = path.join(root,'archive'), destination = path.join(root,'site');
  const gallery = ['tl/fab-botanic/about.html','tl/fab-botanic/about/viewer.js',
    'tl/fab-botanic/about/scenes/plant.glb'];
  const runtime = ['index.html','tl/fab-botanic/index.html','tl/common/libs/three/three.js',
    'tl/fab-botanic/license.html','tl/fab-botanic/license/1.0.0.html','tl/fab-botanic/ogp/ogp.jpg',
    'tl/fab-botanic/about-extra.js','tl/fab-botanic/about.html.bak','tl/other/about.html',
    'tl/other/about/viewer.js','about.html','about/viewer.js'];
  for (const relative of [...gallery,...runtime]) {
    await mkdir(path.dirname(path.join(source,relative)),{recursive:true});
    await writeFile(path.join(source,relative),'archive bytes');
  }
  assert.equal(runtimeFile('tl/fab-botanic/about','fab-botanic'),false);
  const report = await copyRuntime(source,destination,BASE+'tools-app/fab-botanic/',{slug:'fab-botanic'});
  assert.equal(report.files,runtime.length);
  for (const relative of gallery) {
    assert.equal(runtimeFile(relative,'fab-botanic'),false,relative);
    assert.equal(runtimeFile(relative,'other'),true,relative);
    assert.equal(runtimeFile(relative),true,relative);
    await assert.rejects(readFile(path.join(destination,relative)),{code:'ENOENT'});
  }
  await assert.rejects(readdir(path.join(destination,'tl/fab-botanic/about')),{code:'ENOENT'});
  for (const relative of runtime) assert.ok((await readFile(path.join(destination,relative),'utf8')).endsWith('archive bytes'),relative);
  for (const relative of [...gallery,...runtime]) assert.equal(await readFile(path.join(source,relative),'utf8'),'archive bytes');
});

test('brotli-captured text is decoded before URL rewriting and other binary text is copied untouched', async () => {
  const {brotliCompressSync} = await import('node:zlib');
  const root = await mkdtemp(path.join(os.tmpdir(), 'gameref-brotli-'));
  try {
    const source = path.join(root, 'game'), destination = path.join(root, 'site');
    await mkdir(path.join(source, '_vercel'), {recursive:true});
    const script = '"use strict";fetch("/api/x");console.log("ok")';
    await writeFile(path.join(source, 'index.html'), '<html><head></head><body></body></html>');
    await writeFile(path.join(source, '_vercel/script.js'), brotliCompressSync(Buffer.from(script)));
    const odd = Buffer.from([0xff, 0xfe, 0x00, 0x41]);
    await writeFile(path.join(source, 'odd.txt'), odd);
    await copyRuntime(source, destination, BASE+'games/game/', {slug:'game'});
    const out = await readFile(path.join(destination, '_vercel/script.js'), 'utf8');
    assert.ok(out.startsWith('"use strict";'), out.slice(0, 40));
    assert.ok(!out.includes('�'));
    assert.deepEqual(await readFile(path.join(destination, 'odd.txt')), odd);
  } finally { await rm(root, {recursive:true, force:true}); }
});

test('tool build data includes hosted launch, site video and example launches', async t => {
  const {writeToolData} = await import('./build_site.mjs');
  const root=await mkdtemp(path.join(os.tmpdir(),'gameref-tool-build-'));
  t.after(()=>rm(root,{recursive:true,force:true}));
  const tool=JSON.parse(await readFile(new URL('../catalog/tools.json',import.meta.url),'utf8')).tools[0];
  const entry={id:'plant',title:'Plant'};
  const launch={type:'example',url:BASE+'examples/plant/index.html'};
  const hostedLaunch={type:'tool',url:BASE+'tools-app/fab-botanic/tl/fab-botanic/index.html'};
  await writeToolData(root,[{...tool,examples:[entry]}],new Map([[tool.overview_video,{duration:70}]]),[{id:'example:plant',launch},{id:'tool:fab-botanic',kind:'tool',launch:hostedLaunch}]);
  const summaries=JSON.parse(await readFile(path.join(root,'data/tools.json'))).tools;
  const full=JSON.parse(await readFile(path.join(root,'data/tool',tool.slug+'.json')));
  assert.deepEqual(summaries[0].launch,hostedLaunch);
  assert.deepEqual(full.launch,hostedLaunch);
  assert.equal(summaries[0].examples,1);
  assert.equal(summaries[0].overview_video.url,BASE+'media/fab-botanic/overview.mp4');
  assert.equal(full.overview_video.poster,BASE+'previews/fab-botanic.webp');
  assert.equal(full.url,tool.url);assert.equal(full.terms_url,tool.terms_url);
  assert.deepEqual(full.examples[0].launch,launch);
  assert.equal(full.source_url,undefined);assert.equal(full.project,undefined);
  assert.deepEqual(await readdir(root),['data']);
});

test('complete hosted tool build rewrites the capture, records launch, validates entry and supports link-only tools', async t => {
  const {buildSite} = await import('./build_site.mjs');
  const root=await mkdtemp(path.join(os.tmpdir(),'gameref-tools-site-'));
  t.after(()=>rm(root,{recursive:true,force:true}));
  const put=async(file,body)=>{await mkdir(path.dirname(path.join(root,file)),{recursive:true});await writeFile(path.join(root,file),body);};
  const save=(file,data)=>put(file,JSON.stringify(data));
  const tool=JSON.parse(await readFile(new URL('../catalog/tools.json',import.meta.url),'utf8')).tools[0];
  await save('catalog/tools.json',{schema_version:1,tools:[{...tool,examples:[]}]});
  await save('catalog/games.json',{games:[]});await save('catalog/examples.json',{examples:[]});
  await save('catalog/runnability.json',{games:[]});await save('catalog/lab-i18n.json',{});
  await save('catalog/videos.json',{videos:[{id:tool.overview_video,duration:70}]});
  await mkdir(path.join(root,'catalog/pages'));
  await put('library/index.html','<!doctype html><head></head><body><div id="app"></div></body>');
  await put('previews/fab-botanic.webp','preview');
  await put('media-web/fab-botanic/overview.mp4','recorded overview');
  await save('fab-botanic/local.json',{root:'public',entry:'/tl/fab-botanic/index.html',port:8107});
  const captured='<head></head><script src="/tl/common/app.js"></script><a href="/tl/fab-botanic/license.html">Terms</a>';
  await put('fab-botanic/public/tl/fab-botanic/index.html',captured);
  await put('fab-botanic/public/tl/common/app.js','fetch("/tl/fab-botanic/plants.json")');
  await put('fab-botanic/provenance/notes.json','{}');
  await put('webgame-lab/src/catalog.ts','export const catalog = [];');
  // Isolate our publishing contract from the third-party Lab bundler.
  await put('webgame-lab/node_modules/vite/bin/vite.js',`const fs=require('node:fs');const out=process.argv[process.argv.indexOf('--outDir')+1];fs.mkdirSync(out,{recursive:true});fs.writeFileSync(out+'/index.html','Lab fixture');`);
  execFileSync('git',['init','-q',root]);
  const {out}=await buildSite({root});
  for (const route of ['tools','t/fab-botanic']) assert.match(await readFile(path.join(out,route,'index.html'),'utf8'),/gameref-base/);
  assert.deepEqual(JSON.parse(await readFile(path.join(out,'data/index.json'))).counts,{project:0,tool:1,example:0,demo:0});
  assert.equal(await readFile(path.join(out,'media/fab-botanic/overview.mp4'),'utf8'),'recorded overview');
  assert.equal(await readFile(path.join(out,'previews/fab-botanic.webp'),'utf8'),'preview');
  assert.equal((await readdir(out)).includes('fab-botanic'),false);
  assert.equal((await readdir(out)).includes('games'),false);
  assert.deepEqual(JSON.parse(await readFile(path.join(out,'data/src/manifest.json'))),[]);
  const hosted=path.join(out,'tools-app/fab-botanic');
  assert.match(await readFile(path.join(hosted,'tl/fab-botanic/index.html'),'utf8'),/src="\/awesome-threejs-games\/tools-app\/fab-botanic\/tl\/common\/app.js"/);
  assert.equal(await readFile(path.join(hosted,'tl/common/app.js'),'utf8'),'fetch("'+BASE+'tools-app/fab-botanic/tl/fab-botanic/plants.json")');
  assert.equal(await readFile(path.join(root,'fab-botanic/public/tl/fab-botanic/index.html'),'utf8'),captured);
  const record=JSON.parse(await readFile(path.join(out,'data/index.json'))).records[0];
  assert.equal(record.kind,'tool');assert.equal(record.launch.url,BASE+'tools-app/fab-botanic/tl/fab-botanic/index.html');
  assert.deepEqual(JSON.parse(await readFile(path.join(out,'data/tools.json'))).tools[0].launch,record.launch);
  assert.deepEqual(JSON.parse(await readFile(path.join(out,'data/tool/fab-botanic.json'))).launch,record.launch);
  const report=JSON.parse(await readFile(path.join(out,'data/deploy.json'))).reports.find(r=>r.kind==='tool');
  assert.equal(report.slug,'fab-botanic');assert.ok(report.rewrites.length>0);
  await assert.rejects(readFile(path.join(hosted,'provenance/notes.json')),/ENOENT/);
  await rm(path.join(root,'fab-botanic/public/tl/fab-botanic/index.html'));
  await assert.rejects(buildSite({root}),/Missing tool entry/);
  await save('catalog/tools.json',{schema_version:1,tools:[{...tool,hosted:false,examples:[]}]});
  await buildSite({root});
  assert.equal((await readdir(out)).includes('tools-app'),false);
  assert.equal(JSON.parse(await readFile(path.join(out,'data/tools.json'))).tools[0].launch,null);
});
