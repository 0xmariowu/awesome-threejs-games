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
  for (const name of ['games','examples']) await put(`catalog/${name}.json`,JSON.stringify({[name]:[]}));
  for (const name of ['extraction-candidates','runnability','videos','lab-i18n']) await put(`catalog/${name}.json`,'{}');
  for (const dir of ['catalog/pages','library','previews']) await put(`${dir}/fixture.txt`,'fixture');
  for (const name of ['package.json','package-lock.json','src/catalog.ts','index.html','vite.config.ts']) await put(`webgame-lab/${name}`,'{}');
  execFileSync('git',['init','-q',root]);
  execFileSync('git',['-C',root,'add','.']);
  assert.ok((await checkBuildInputs(root)).files > 10);
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
