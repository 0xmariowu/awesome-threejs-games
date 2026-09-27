import { execFileSync } from 'node:child_process';
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink, open } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { buildIndex, search, readSource, context } from './library-index.mjs';
import { checkPages, loadPages } from './pages.mjs';
import { pathToFileURL } from 'node:url';
import { createLibrary } from './library.mjs';
const index=await buildIndex();
test('example launches default to the id and root entry and support a shared folder with another entry',()=>{
  const flight=index.records.find(row=>row.id==='example:cloudkeep-flight');
  const models=index.records.find(row=>row.id==='example:cloudkeep-models');
  assert.equal(flight.launch.url,'http://127.0.0.1:8103/');
  assert.equal(flight.launch.folder,'cloudkeep-flight');
  assert.equal(flight.launch.command,'node tools/server.mjs examples/cloudkeep-flight');
  assert.deepEqual(flight.related.map(row=>row.id),['cloudkeep.flight']);
  assert.ok(models);
  assert.equal(models.launch.url,'http://127.0.0.1:8103/models.html');
  assert.equal(models.launch.folder,'cloudkeep-flight');
  assert.equal(models.launch.command,flight.launch.command);
  assert.deepEqual(models.related.map(row=>row.id),['cloudkeep.asset-build']);
});
test('all originals, mechanism candidates and existing scenes are searchable',async()=>{
  assert.equal(index.counts.project,index.games.length);assert.equal(index.counts.capability,62);assert.equal(index.counts.demo,45);
  assert.equal(new Set(index.records.map(row=>row.id)).size,index.records.length);
  // Every pinned source matches the catalog; refresh catalog/examples.json hashes when a host changes.
  for (const record of index.records) {
    for (const source of record.sources) {
      assert.equal(source.available, true, source.path);
      const base = source.scope === 'gameref' ? index.root : index.labRoot;
      const actual = createHash('sha256').update(await readFile(path.join(base, source.path))).digest('hex');
      assert.equal(source.sha256, actual, source.path);
      assert.notEqual(source.fresh, false, `Pinned hash out of date: ${source.path}`);
    }
    assert.equal(record.source_freshness, 'current', record.id);
    assert.ok(search(index, {q: record.title, kind: record.kind}).some(row => row.id === record.id), record.id);
  }
  assert.ok(search(index,{q:'镜头',kind:'capability',project:'cloudkeep'}).some(row=>row.id==='cloudkeep.flight'));
  assert.ok(search(index,{category:'water',backend:'webgpu'}).some(row=>row.id==='tidewater.ocean-query'));
  assert.equal(search(index,{q:'no-such-mechanism-xyz'}).length,0);
  assert.equal(index.records.filter(row=>row.project==='cloudkeep').some(row=>/sky arena|cloudkeep.arena/i.test(JSON.stringify(row))),false);
});
test('AI context distinguishes analysis from runnable adaptations',()=>{
  const result=context(index,'cloudkeep.flight');
  assert.equal(result.record.maturity,'source-inspected');
  assert.ok(result.related.some(link=>link.record?.id==='demo:cloudkeep-cam'));
  assert.match(result.guidance,/not extracted packages/);
  assert.throws(()=>context(index,'../../etc/passwd'));
});
test('source reads only catalog file numbers and recomputes pinned freshness',async()=>{
  const result=await readSource(index,'tidewater.fishing',0);
  assert.match(result.content,/class CatchMinigame/);assert.equal(result.fresh,true);
  await assert.rejects(readSource(index,'tidewater.fishing',-1));
  await assert.rejects(readSource(index,'tidewater.fishing',Infinity));
  await assert.rejects(readSource(index,'../../etc/passwd',0));
  const changed={...index,records:index.records.map(row=>row.id==='tidewater.fishing'?{...row,sources:row.sources.map(source=>({...source,expected_sha256:'invalid'}))}:row)};
  assert.equal((await readSource(changed,'tidewater.fishing',0)).fresh,false);
});
test('HTTP API blocks hostile origins, rebinding hosts, missing tokens and arbitrary launch commands',async t=>{
  const launched=[];
  const server=await createLibrary({index,launcher:record=>{launched.push(record.id);return record.launch.url;}});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const base=`http://127.0.0.1:${server.address().port}`;
  const data=await (await fetch(`${base}/api/index`)).json();assert.equal(data.counts.project,index.games.length);
  const body=JSON.stringify({id:'game:cloudkeep'});
  const post=headers=>fetch(`${base}/api/launch`,{method:'POST',headers:{'Content-Type':'application/json',...headers},body});
  assert.equal((await post({})).status,403);
  assert.equal((await post({'X-Library-Token':data.token,Origin:'https://evil.test'})).status,403);
  assert.equal((await fetch(`${base}/api/index`,{headers:{Origin:'http://127.0.0.1:8101'}})).status,403);
  assert.equal((await post({'X-Library-Token':data.token,Origin:base})).status,200);
  assert.deepEqual(launched,['game:cloudkeep']);
  assert.equal((await fetch(`${base}/api/launch`,{method:'POST',headers:{'Content-Type':'application/json','X-Library-Token':data.token},body:JSON.stringify({id:'; touch /tmp/not-authorized'})})).status,400);
  assert.equal((await fetch(`${base}/api/source?id=tidewater.fishing&file=../../secrets`)).status,400);
  assert.equal((await fetch(`${base}/catalog/games.json`)).status,404);
  assert.equal((await fetch(`${base}/api/source?id=tidewater.fishing&file=0`)).headers.get('x-content-type-options'),'nosniff');
  const hostStatus=await new Promise((resolve,reject)=>{http.get(base+'/api/index',{headers:{Host:'evil.test'}},response=>{response.resume();resolve(response.statusCode);}).on('error',reject);});assert.equal(hostStatus,403);
});

const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
async function fixture(t,{launcher}={}) {
  const root=await mkdtemp(path.join(os.tmpdir(),'gameref-library-'));
  t.after(()=>rm(root,{recursive:true,force:true}));
  const put=async(relative,body)=>{await mkdir(path.dirname(path.join(root,relative)),{recursive:true});await writeFile(path.join(root,relative),body);};
  const json=(relative,body)=>put(relative,JSON.stringify(body));
  const source='first\r\n<script>archive()</script>\r\nthird\r\n',clip=Buffer.from('0123456789');
  const games=[{slug:'cloudkeep',source:'../owner-copy'},{slug:'other',source:'../other-copy'}];
  const records=[{id:'game:cloudkeep',title:'Cloudkeep',launch:{type:'original'}},
    {id:'cloudkeep.flight',title:'Flight'},
    {id:'example:flight',title:'Flight example',launch:{type:'example',url:'http://127.0.0.1:8123/',command:'unused'}},
    {id:'example:parked',title:'Parked example'}];
  const page={schema_version:3,slug:'cloudkeep',title:'Cloudkeep page',tagline:'Flight',category:'飞行探索',
    overview_video:'cloudkeep/overview',examples:[
      {id:'flight',title:'Flight controls',one_liner:'Fly the ship.',candidate:'cloudkeep.flight'},
      {id:'parked',title:'Parked',one_liner:'No launch yet.',candidate:'cloudkeep.flight'},
      {id:'unindexed',title:'Unindexed',one_liner:'Index pending.',candidate:'cloudkeep.flight'}]};
  page.tagline_en = page.tagline;
  for (const example of page.examples) {example.title_en = example.title; example.one_liner_en = example.one_liner;}
  await json('catalog/games.json',{games});
  await json('catalog/extraction-candidates.json',{candidates:[{id:'cloudkeep.flight',project:'cloudkeep'}]});
  await json('catalog/examples.json',{examples:page.examples.map(({id})=>({id,project:'cloudkeep'}))});
  await json('catalog/pages/cloudkeep.json',page);
  await json('catalog/videos.json',{schema_version:1,videos:[{id:'cloudkeep/overview',file:'media/cloudkeep/clip.mp4',poster:'media/cloudkeep/clip.jpg',captions:'media/cloudkeep/clip.vtt',duration:3}]});
  for(const [relative,body] of Object.entries({'cloudkeep/source.txt':source,'cloudkeep/z-dir/nested.txt':'nested',
    'cloudkeep/a-dir/deep.txt':'deep','cloudkeep/.secret':'secret','cloudkeep/node_modules/dep.js':'private',
    'cloudkeep/nested/.hidden/file.js':'hidden','cloudkeep/nested/node_modules/dep.js':'private',
    'cloudkeep/archive.html':'<script>archive()</script>','cloudkeep/code.js':'archive()',
    'other/secret.txt':'other project','outside.txt':'outside','library/index.html':'<!doctype html><title>Library fixture</title>',
    'library/app.js':'export const app=true;','library/extra.js':'export const extra=true;','library/style.css':'body{}',
    'library/extra.css':'html{}','library/help.html':'<title>Help</title>','library/vendor/pkg-1.0/nested/util.js':'export const vendor=true;',
    'library/vendor/pkg/node_modules/util.js':'export const dependency=true;',
    'library/.secret.js':'secret','media/cloudkeep/clip.vtt':'WEBVTT\n','media/cloudkeep/clip.jpg':'poster','media/x.txt':'not media'}))await put(relative,body);
  await put('cloudkeep/binary.bin',Buffer.from([1,2,0,3]));await put('media/cloudkeep/clip.mp4',clip);
  await symlink(path.join(root,'outside.txt'),path.join(root,'cloudkeep/escape.txt'));
  await symlink(path.join(root,'other'),path.join(root,'cloudkeep/escape-dir'));
  await symlink(path.join(root,'cloudkeep/source.txt'),path.join(root,'cloudkeep/internal-link'));
  await symlink(path.join(root,'cloudkeep/code.js'),path.join(root,'library/escape.js'));
  await symlink(path.join(root,'cloudkeep/archive.html'),path.join(root,'media/cloudkeep/escape.mp4'));
  await put('outside.jpg','outside media');
  await symlink(path.join(root,'outside.jpg'),path.join(root,'media/cloudkeep/leak.jpg'));
  // buildIndex also requires real runtime reports; these handlers need only these index fields.
  const index={root,games,records,thumbnails:{},schema_version:1,counts:{project:2}};
  const server=await createLibrary({index,launcher});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();}));
  const base=`http://127.0.0.1:${server.address().port}`;
  const get=(route,headers={})=>new Promise((resolve,reject)=>{
    http.get(base,{path:route,headers},res=>{const chunks=[];res.on('data',chunk=>chunks.push(chunk));res.on('end',()=>{
      const bytes=Buffer.concat(chunks);resolve({status:res.statusCode,headers:res.headers,bytes,text:bytes.toString(),json:()=>JSON.parse(bytes)});
    });res.on('error',reject);}).on('error',reject);
  });
  return {root,put,json,page,source,clip,records,get,base,index};
}
test('library CSP permits only loopback example frames and preserves all other directives',async t=>{
  const f=await fixture(t);
  const existing=["default-src 'self'","script-src 'self'","style-src 'self'","img-src 'self' data:",
    "connect-src 'self' https://raw.githubusercontent.com","frame-ancestors 'none'","base-uri 'none'","form-action 'self'"];
  for(const route of ['/','/api/pages','/media/cloudkeep/clip.mp4','/unknown']) {
    const response=await f.get(route);
    const directives=response.headers['content-security-policy'].split(';').map(value=>value.trim()).filter(Boolean);
    assert.deepEqual(directives.filter(value=>/^frame-src\b/.test(value)),['frame-src http://127.0.0.1:*']);
    assert.deepEqual(directives.filter(value=>!/^frame-src\b/.test(value)),existing);
  }
});
test('example launch returns its entry URL and rejects unknown ids, non-JSON and missing tokens',async t=>{
  const launched=[];
  const f=await fixture(t,{launcher:record=>{launched.push(record);return record.launch.url;}});
  const record={id:'example:cloudkeep-models',launch:{type:'example',id:'cloudkeep-models',
    folder:'cloudkeep-flight',url:'http://127.0.0.1:8103/models.html'}};
  f.records.push(record);
  const {token}=(await f.get('/api/index')).json();
  const post=(id,headers={})=>fetch(`${f.base}/api/launch`,{method:'POST',
    headers:{'Content-Type':'application/json','X-Library-Token':token,...headers},body:JSON.stringify({id})});
  const response=await post(record.id);
  assert.equal(response.status,200);
  assert.deepEqual(await response.json(),{url:record.launch.url});
  assert.ok(record.launch.url.endsWith('/models.html'));
  assert.equal((await post('example:unknown')).status,400);
  assert.equal((await post('example:parked')).status,400);
  assert.equal((await post(record.id,{'Content-Type':'text/plain'})).status,415);
  assert.equal((await fetch(`${f.base}/api/launch`,{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({id:record.id})})).status,403);
  assert.deepEqual(launched,[record]);
});
test('example launcher serves and reuses both entry pages from a shared folder in either order',async t=>{
  for(const order of [['models','flight'],['flight','models']])await t.test(order.join(' then '),async t=>{
    const f=await fixture(t);
    const probe=http.createServer();
    await new Promise(resolve=>probe.listen(0,'127.0.0.1',resolve));
    const port=probe.address().port;
    await new Promise(resolve=>probe.close(resolve));
    await f.json('examples/flight/local.json',{root:'public',entry:'/index.html',port});
    await f.put('examples/flight/public/index.html','<title>Flight</title>');
    await f.put('examples/flight/public/models.html','<title>Models</title>');
    const flight=f.records.find(row=>row.id==='example:flight');
    flight.launch={type:'example',id:'flight',url:`http://127.0.0.1:${port}/`};
    f.records.push({id:'example:models',launch:{type:'example',id:'models',folder:'flight',url:`http://127.0.0.1:${port}/models.html`}});
    const {token}=(await f.get('/api/index')).json();
    const launch=id=>fetch(`${f.base}/api/launch`,{method:'POST',headers:{'Content-Type':'application/json','X-Library-Token':token},body:JSON.stringify({id:`example:${id}`})});
    const starts = [];
    const originalListen = http.Server.prototype.listen;
    t.mock.method(http.Server.prototype, 'listen', function (...args) {
      if(args[0] === port) starts.push(this);
      return originalListen.apply(this,args);
    });
    const concurrent = await Promise.all(order.map(launch));
    for(const response of concurrent) assert.equal(response.status,200,JSON.stringify(await response.json()));
    assert.equal(starts.length,1,'Concurrent entries must share one server start');
    for(const id of [...order,...order]) {
      const response=await launch(id),body=await response.json();
      assert.equal(response.status,200,JSON.stringify(body));
      assert.equal(body.url,`http://127.0.0.1:${port}/${id==='models'?'models.html':''}`);
      assert.equal(await (await fetch(body.url)).text(),`<title>${id==='models'?'Models':'Flight'}</title>`);
    }
    await f.put('examples/flight/public/models.html','<title>Different page</title>');
    const occupied=http.createServer((req,res)=>res.end(req.url==='/' ? '<title>Flight</title>' : '<title>Models</title>'));
    await new Promise(resolve=>occupied.listen(0,'127.0.0.1',resolve));
    t.after(()=>new Promise(resolve=>{occupied.close(resolve);occupied.closeAllConnections();}));
    f.records.find(row=>row.id==='example:models').launch.url=`http://127.0.0.1:${occupied.address().port}/models.html`;
    flight.launch.url=`http://127.0.0.1:${occupied.address().port}/`;
    const [valid,response]=await Promise.all([launch('flight'),launch('models')]);
    assert.equal(valid.status,200);
    assert.equal(response.status,400);
    assert.match((await response.json()).error,/Port is occupied by a different page/);
  });
});
function rejected(response,root,statuses=[400,404]) {
  assert.ok(statuses.includes(response.status),`${response.status}: ${response.text}`);
  assert.match(response.headers['content-type'],/^application\/json/);
  assert.equal(typeof response.json().error,'string');assert.ok(!response.text.includes(root));assert.ok(!response.text.includes(' at '));
}
test('page reloads disk content and resolves project, overview, example launches and source URL',async t=>{
  const f=await fixture(t),response=await f.get('/api/page?slug=cloudkeep'),page=response.json();
  assert.equal(response.status,200);
  assert.deepEqual(page,{...f.page,project:f.records[0],
    overview_video:{id:'cloudkeep/overview',url:'/media/cloudkeep/clip.mp4',poster:'/media/cloudkeep/clip.jpg',duration:3},
    examples:f.page.examples.map((example,i)=>({...example,launch:i===0 ? {url:'http://127.0.0.1:8123/',port:8123}:null})),
    source_url:'https://github.com/0xmariowu/awesome-threejs-games/tree/main/cloudkeep'});
  f.records[2].launch.port=8123;
  assert.deepEqual((await f.get('/api/page?slug=cloudkeep')).json().examples[0].launch,{url:'http://127.0.0.1:8123/',port:8123});
  await f.json('catalog/pages/cloudkeep.json',{...f.page,title:'Edited',overview_video:null,examples:[]});
  const edited=(await f.get('/api/page?slug=cloudkeep')).json();
  assert.equal(edited.title,'Edited');assert.equal(edited.overview_video,null);assert.deepEqual(edited.examples,[]);
  const summary=(await f.get('/api/pages')).json().pages[0];
  assert.equal(summary.examples,0);assert.equal(summary.has_example,false);assert.equal(summary.overview_video,null);
  await f.json('catalog/pages/cloudkeep.json',f.page);
  await f.json('catalog/videos.json',{schema_version:1,videos:[]});
  assert.equal((await f.get('/api/page?slug=cloudkeep')).json().overview_video,null);
  for(const slug of ['unknown','../x','other',''])rejected(await f.get(`/api/page?slug=${encodeURIComponent(slug)}`),f.root,[404]);
  await f.put('catalog/pages/cloudkeep.json','invalid JSON');rejected(await f.get('/api/page?slug=cloudkeep'),f.root,[422]);
});
test('page APIs expose preview URLs when present and omit them when absent',async t=>{
  const f=await fixture(t);
  const catalog=JSON.parse(await readFile(path.join(f.root,'catalog/videos.json'),'utf8'));
  for(const preview of ['media/cloudkeep/overview-preview.mp4',undefined]) {
    catalog.videos[0].preview=preview;
    await f.json('catalog/videos.json',catalog);
    const listing=await f.get('/api/pages'),detail=await f.get('/api/page?slug=cloudkeep');
    assert.equal(listing.status,200);assert.equal(detail.status,200);
    for(const video of [listing.json().pages[0].overview_video,detail.json().overview_video]) {
      assert.equal(video.preview,preview ? '/'+preview:undefined);
      assert.equal(Object.hasOwn(video,'preview'),!!preview);
      assert.equal(video.url,'/media/cloudkeep/clip.mp4');
    }
  }
});
test('page summaries read runnability reviews fresh by slug and tolerate missing files and entries',async t=>{
  const f=await fixture(t);
  await f.json('catalog/pages/other.json',{...f.page,slug:'other',overview_video:null,examples:[]});
  const summaries=async()=>{
    const response=await f.get('/api/pages');
    assert.equal(response.status,200);
    return response.json().pages.map(({slug,runnability})=>({slug,runnability}));
  };
  const absent=[{slug:'cloudkeep',runnability:null},{slug:'other',runnability:null}];
  assert.deepEqual(await summaries(),absent);
  const cloudkeep={reviewed_verdict:'partial',review_note:'One mode needs a backend.'};
  const other={reviewed_verdict:'ok',review_note:'All modes reviewed.'};
  await f.json('catalog/runnability.json',{schema_version:1,games:[{slug:'other',...other},
    {slug:'cloudkeep',...cloudkeep,auto_verdict:'ok',modes:[{name:'flight'}]}]});
  assert.deepEqual(await summaries(),[{slug:'cloudkeep',runnability:cloudkeep},{slug:'other',runnability:other}]);
  const edited={reviewed_verdict:'ok',review_note:'Backend restored and reviewed.'};
  await f.json('catalog/runnability.json',{schema_version:1,games:[{slug:'cloudkeep',...edited}]});
  assert.deepEqual(await summaries(),[{slug:'cloudkeep',runnability:edited},{slug:'other',runnability:null}]);
  await f.json('catalog/runnability.json',{schema_version:1,games:[{slug:'cloudkeep',auto_verdict:'ok'}]});
  assert.deepEqual(await summaries(),[{slug:'cloudkeep',runnability:{reviewed_verdict:null,review_note:null}},
    {slug:'other',runnability:null}]);
  await rm(path.join(f.root,'catalog/runnability.json'));
  assert.deepEqual(await summaries(),absent);
});
test('tree lists one level, sorts directories first and excludes hidden, dependency and symlink entries',async t=>{
  const f=await fixture(t),response=await f.get('/api/tree?project=cloudkeep'),tree=response.json();
  assert.equal(response.status,200);assert.equal(tree.project,'cloudkeep');assert.equal(tree.dir,'cloudkeep');assert.equal(tree.truncated,false);
  assert.deepEqual(tree.entries.map(row=>row.name),['a-dir','nested','z-dir','archive.html','binary.bin','code.js','source.txt']);
  assert.deepEqual(tree.entries[0],{name:'a-dir',path:'cloudkeep/a-dir',type:'dir'});
  assert.deepEqual(tree.entries.at(-1),{name:'source.txt',path:'cloudkeep/source.txt',type:'file',bytes:Buffer.byteLength(f.source)});
  const nested=(await f.get('/api/tree?project=cloudkeep&dir=cloudkeep/z-dir')).json();
  assert.deepEqual(nested.entries,[{name:'nested.txt',path:'cloudkeep/z-dir/nested.txt',type:'file',bytes:6}]);
  for(const slug of ['../cloudkeep','catalog','output','examples','','Cloudkeep'])rejected(await f.get(`/api/tree?project=${encodeURIComponent(slug)}`),f.root,[404]);
  for(const dir of ['cloudkeep/../catalog','cloudkeep/escape-dir','cloudkeep/.secret','cloudkeep/node_modules','other',''])rejected(await f.get(`/api/tree?project=cloudkeep&dir=${encodeURIComponent(dir)}`),f.root);
  await Promise.all(Array.from({length:2001},(_,i)=>f.put(`cloudkeep/many/f${String(i).padStart(4,'0')}`,'x')));
  const capped=(await f.get('/api/tree?project=cloudkeep&dir=cloudkeep/many')).json();
  assert.equal(capped.entries.length,2000);assert.equal(capped.truncated,true);assert.equal(capped.entries.at(-1).name,'f1999');
});
test('file returns JSON source and hashes, detects binary, and caps text and large-file reads',async t=>{
  const f=await fixture(t),response=await f.get('/api/file?project=cloudkeep&path=cloudkeep/source.txt');
  assert.equal(response.status,200);assert.match(response.headers['content-type'],/^application\/json/);
  assert.deepEqual(response.json(),{path:'cloudkeep/source.txt',bytes:Buffer.byteLength(f.source),sha256:hash(f.source),binary:false,text:f.source,truncated:false});
  const binary=(await f.get('/api/file?project=cloudkeep&path=cloudkeep/binary.bin')).json();
  assert.equal(binary.binary,true);assert.equal(binary.text,null);assert.equal(binary.sha256,hash(Buffer.from([1,2,0,3])));
  const content=Buffer.alloc(2_000_001,97);await f.put('cloudkeep/long.txt',content);
  const capped=(await f.get('/api/file?project=cloudkeep&path=cloudkeep/long.txt')).json();
  assert.equal(capped.text.length,2_000_000);assert.equal(capped.truncated,true);assert.equal(capped.sha256,hash(content));
  const file=await open(path.join(f.root,'cloudkeep/large.bin'),'w');
  try {await file.truncate(50_000_001);await file.write(Buffer.alloc(8192,97));} finally {await file.close();}
  const large=(await f.get('/api/file?project=cloudkeep&path=cloudkeep/large.bin')).json();
  assert.deepEqual(large,{path:'cloudkeep/large.bin',bytes:50_000_001,sha256:null,binary:false,text:null,truncated:true});
  for(const relative of ['../outside.txt','cloudkeep/../outside.txt','/etc/passwd','cloudkeep/.secret','cloudkeep/nested/.hidden/file.js',
    'cloudkeep/node_modules/dep.js','cloudkeep/nested/node_modules/dep.js','cloudkeep/escape.txt','cloudkeep/escape-dir/secret.txt','other/secret.txt',
    'cloudkeep//source.txt','cloudkeep/./source.txt','cloudkeep\\source.txt','cloudkeep/source.txt\0','cloudkeep/missing','cloudkeep/a-dir',''])
    rejected(await f.get(`/api/file?project=cloudkeep&path=${encodeURIComponent(relative)}`),f.root);
  rejected(await f.get('/api/file?project=cloudkeep&path=cloudkeep/%2e%2e/outside.txt'),f.root);
  rejected(await f.get('/api/file?project=cloudkeep&path=cloudkeep/%252e%252e/outside.txt'),f.root);
  for(const slug of ['../cloudkeep','catalog','output','examples',''])rejected(await f.get(`/api/file?project=${encodeURIComponent(slug)}&path=cloudkeep/source.txt`),f.root,[404]);
  for(const name of ['archive.html','code.js']) {
    const source=await f.get(`/api/file?project=cloudkeep&path=cloudkeep/${name}`);
    assert.equal(source.status,200);assert.match(source.headers['content-type'],/^application\/json/);
    rejected(await f.get(`/cloudkeep/${name}`),f.root,[404]);
  }
});
test('media uses Range and ETag with library security headers and contains all file reads',async t=>{
  const f=await fixture(t),response=await f.get('/media/cloudkeep/clip.mp4',{Range:'bytes=2-5'});
  assert.equal(response.status,206);assert.deepEqual(response.bytes,f.clip.subarray(2,6));assert.equal(response.headers['content-range'],'bytes 2-5/10');
  assert.equal(response.headers['content-type'],'video/mp4');assert.ok(response.headers.etag);
  const home=await f.get('/');
  for(const name of ['content-security-policy','x-content-type-options','cross-origin-resource-policy','referrer-policy'])assert.equal(response.headers[name],home.headers[name]);
  const cached=await f.get('/media/cloudkeep/clip.mp4',{'If-None-Match':response.headers.etag});assert.equal(cached.status,304);assert.ok(cached.headers['content-security-policy']);
  const invalid=await f.get('/media/cloudkeep/clip.mp4',{Range:'bytes=99-'});assert.equal(invalid.status,416);assert.ok(invalid.headers['content-security-policy']);
  assert.match((await f.get('/media/cloudkeep/clip.vtt')).headers['content-type'],/^text\/vtt/);
  assert.equal((await f.get('/media/cloudkeep/clip.jpg')).headers['content-type'],'image/jpeg');
  for(const route of ['/media/x.txt','/media/../catalog/games.json','/media/%2e%2e/catalog/games.json','/media/../app.js',
    '/media/cloudkeep/escape.mp4','/media/cloudkeep/leak.jpg','/media/cloudkeep/missing.mp4','/media/cloudkeep/clip.mp4%00','/media/cloudkeep%5cclip.mp4'])rejected(await f.get(route),f.root,[404]);
});
test('static allowlist serves own assets and SPA routes without exposing archive documents',async t=>{
  const f=await fixture(t),home=await f.get('/');
  assert.equal(home.status,200);assert.equal(home.text,await readFile(path.join(f.root,'library/index.html'),'utf8'));
  for(const route of ['/index.html','/p/cloudkeep','/p/cloudkeep/','/source/cloudkeep/nested','/source/cloudkeep/.config','/topics','/search']) {
    const response=await f.get(route);assert.equal(response.status,200);assert.equal(response.text,home.text);assert.match(response.headers['content-type'],/^text\/html/);
  }
  for(const route of ['/app.js','/extra.js','/vendor/pkg-1.0/nested/util.js','/vendor/pkg/node_modules/util.js']) {
    const response=await f.get(route);assert.equal(response.status,200);assert.match(response.headers['content-type'],/^text\/javascript/);
    assert.equal(response.headers['content-security-policy'],home.headers['content-security-policy']);
  }
  assert.match((await f.get('/extra.css')).headers['content-type'],/^text\/css/);assert.equal((await f.get('/help.html')).status,200);
  for(const route of ['/../tools/library.mjs','/%2e%2e/tools/library.mjs','/.secret.js','/escape.js','/missing.js','/vendor/.hidden/util.js',
    '/vendor/pkg-1.0/../app.js','/vendor/pkg-1.0/nested/util.css','/catalog/games.json','/raw/cloudkeep/archive.html','/unknown'])rejected(await f.get(route),f.root,[404]);
});
test('new endpoints all retain Host, Origin and Sec-Fetch-Site guards',async t=>{
  const f=await fixture(t);
  for(const route of ['/api/demos','/demos','/api/pages','/api/page?slug=cloudkeep','/api/tree?project=cloudkeep','/api/file?project=cloudkeep&path=cloudkeep/source.txt','/media/cloudkeep/clip.mp4','/extra.js','/p/cloudkeep'])
    for(const headers of [{Origin:'http://evil.test'},{Host:'evil.test'},{'Sec-Fetch-Site':'cross-site'},{'Sec-Fetch-Site':'same-site'}])rejected(await f.get(route,headers),f.root,[403]);
});


test('page summaries count examples and isolate broken pages while good pages still load',async t=>{
  const f=await fixture(t);
  await f.json('catalog/pages/cloudkeep.json',f.page);
  await rm(path.join(f.root,'cloudkeep/source.txt'));
  for(const broken of ['invalid JSON','null','{"examples":[null]}']) {
    await f.put('catalog/pages/other.json',broken);
    const response=await f.get('/api/pages');assert.equal(response.status,200);
    const [good,bad]=response.json().pages;
    assert.deepEqual(good,{slug:'cloudkeep',title:'Cloudkeep page',tagline:'Flight',tagline_en:'Flight',category:'飞行探索',
      examples:3,has_example:true,runnability:null,overview_video:{url:'/media/cloudkeep/clip.mp4',poster:'/media/cloudkeep/clip.jpg',duration:3}});
    assert.equal(bad.slug,'other');assert.equal(typeof bad.error,'string');assert.equal(bad.overview_video,null);
    const failure=await f.get('/api/page?slug=other');rejected(failure,f.root,[422]);
    assert.equal(failure.json().error,bad.error);
    const page=await f.get('/api/page?slug=cloudkeep');assert.equal(page.status,200);
    assert.equal(page.json().examples.length,3);
  }
});

test('archive dependency checks cover mixed case and resolved symlink targets',async t=>{
  const f=await fixture(t);
  await f.put('cloudkeep/NODE_MODULES/private.txt','dependency secret');
  await symlink(path.join(f.root,'cloudkeep/NODE_MODULES'),path.join(f.root,'cloudkeep/dependencies'));
  for(const relative of ['cloudkeep/NODE_MODULES','cloudkeep/dependencies']) {
    rejected(await f.get(`/api/tree?project=cloudkeep&dir=${relative}`),f.root);
    rejected(await f.get(`/api/file?project=cloudkeep&path=${relative}/private.txt`),f.root);
  }
  const tree=(await f.get('/api/tree?project=cloudkeep')).json();
  assert.ok(!tree.entries.some(entry=>['NODE_MODULES','dependencies'].includes(entry.name)));
});

test('uppercase NODE_MODULES is rejected on the real cloudkeep tree without symlinks',async t=>{
  const directory=await mkdtemp(path.join(index.root,'cloudkeep/review-path-'));
  t.after(()=>rm(directory,{recursive:true,force:true}));
  await mkdir(path.join(directory,'NODE_MODULES'));
  await writeFile(path.join(directory,'NODE_MODULES/probe.txt'),'private dependency fixture');
  const server=await createLibrary({index});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();}));
  const base=`http://127.0.0.1:${server.address().port}`,relative=path.relative(index.root,directory);
  for(const suffix of ['NODE_MODULES','node_modules','NoDe_MoDuLeS']) {
    for(const route of [`/api/tree?project=cloudkeep&dir=${relative}/${suffix}`,
      `/api/file?project=cloudkeep&path=${relative}/${suffix}/probe.txt`]) {
      const response=await fetch(base+route);assert.equal(response.status,400);
      assert.deepEqual(await response.json(),{error:'Invalid archive path'});
    }
  }
  const tree=await (await fetch(base+`/api/tree?project=cloudkeep&dir=${relative}`)).json();
  assert.deepEqual(tree.entries,[]);
});

test('demos combine page examples with lab scenes, mapping the first recognized category and omitting boot',async t=>{
  const f=await fixture(t);
  f.index.games[0].title='Cloudkeep';
  await f.json('catalog/examples.json',{examples:[
    {id:'flight',project:'cloudkeep',category:['unknown','input','water']},
    {id:'parked',project:'cloudkeep',folder:'shared-models',category:['assets','rendering']},
    {id:'unindexed',project:'cloudkeep',category:['physics','camera']},
    {id:'unreferenced',project:'cloudkeep',category:['combat']},
  ]});
  const mappings = [
    ['camera','camera'],['3c','camera'],['vehicle','vehicle'],['combat','combat'],
    ['ai','ai'],['navigation','ai'],['animation','animation'],['character','animation'],
    ['rendering','rendering'],['ui','rendering'],['water','water'],['effects','effects'],
    ['vfx','effects'],['particles','effects'],['world','world'],['terrain','world'],
    ['gameplay','gameplay'],['persistence','gameplay'],['tooling','tooling'],
    ['performance','tooling'],['architecture','tooling'],['networking','tooling'],
  ];
  f.records.push({id:'demo:boot',kind:'demo',category:['tooling']});
  for(const [category] of mappings) f.records.push({id:`demo:${category}`,kind:'demo',
    title:`场景 ${category}`,summary:'第一句。第二句。',category:[category]});
  await f.json('catalog/lab-i18n.json',Object.fromEntries(mappings.map(([id])=>[id,{name_en:`Scene ${id}`,desc_en:'First sentence. Second sentence.'}])));
  const response=await f.get('/api/demos'), data=response.json();
  assert.equal(response.status,200);
  assert.equal(data.demos.length,3+mappings.length);
  assert.equal(data.demos.some(row=>row.id==='demo:boot' || row.id==='example:unreferenced'),false);
  assert.deepEqual(data.categories,[
    {key:'camera',label:'镜头与操控',label_en:'Camera & controls'},{key:'vehicle',label:'载具与物理',label_en:'Vehicles & physics'},
    {key:'combat',label:'战斗',label_en:'Combat'},{key:'ai',label:'AI 与群体',label_en:'AI & crowds'},
    {key:'animation',label:'角色与动画',label_en:'Characters & animation'},{key:'rendering',label:'画面与后期',label_en:'Rendering & post-processing'},
    {key:'water',label:'水面',label_en:'Water'},{key:'effects',label:'特效与粒子',label_en:'Effects & particles'},
    {key:'world',label:'世界与地形',label_en:'World & terrain'},{key:'gameplay',label:'玩法与规则',label_en:'Gameplay & rules'},
    {key:'tooling',label:'资产与工具',label_en:'Assets & tools'},
  ]);
  assert.deepEqual(data.demos[0],{id:'example:flight',kind:'example',title:'Flight controls',
    one_liner:'Fly the ship.',title_en:'Flight controls',one_liner_en:'Fly the ship.',source_label:'Cloudkeep',
    source_url:'https://github.com/0xmariowu/awesome-threejs-games/tree/main/examples/flight',
    category:'camera',launch_id:'example:flight',launch:f.records.find(r=>r.id==='example:flight').launch});
  assert.equal(data.demos[1].category,'tooling');
  assert.ok(data.demos[1].source_url.endsWith('/examples/shared-models'));
  assert.equal(data.demos[2].category,'vehicle');
  for(const [category,expected] of mappings) {
    const demo=data.demos.find(row=>row.id===`demo:${category}`);
    assert.deepEqual(demo,{id:`demo:${category}`,kind:'lab',title:`场景 ${category}`,
      one_liner:'第一句。',title_en:`Scene ${category}`,one_liner_en:'First sentence. Second sentence.',source_label:'Webgame Lab',
      source_url:`https://github.com/0xmariowu/awesome-threejs-games/blob/main/webgame-lab/src/scenes/${category}.tsx`,
      category:expected,launch_id:`demo:${category}`});
  }
  assert.equal('lab_error' in data,false);
  f.index.labError='Lab unavailable';
  const fallback=(await f.get('/api/demos')).json();
  assert.equal(fallback.lab_error,'Lab unavailable');
  assert.equal(fallback.demos.length,3);
  assert.ok(fallback.demos.every(row=>row.kind==='example'));
  assert.deepEqual(fallback.categories.map(row=>row.key),['camera','vehicle','tooling']);
  assert.equal((await f.get('/demos')).status,200);
});


test('real catalog has English for every non-boot Lab scene, example and demo category', async t => {
  const translations = JSON.parse(await readFile(path.join(index.root, 'catalog/lab-i18n.json'), 'utf8'));
  const {catalog: labCatalog} = await import(pathToFileURL(path.join(index.labRoot, 'src/catalog.ts')));
  const scenes = labCatalog.filter(scene => scene.id !== 'boot');
  assert.deepEqual(Object.keys(translations).sort(), scenes.map(scene => scene.id).sort());
  for (const scene of scenes) for (const field of ['name_en', 'desc_en']) {
    assert.ok(translations[scene.id][field]?.trim(), `${scene.id}.${field}`);
    assert.doesNotMatch(translations[scene.id][field], /\p{Script=Han}/u);
  }
  const server = await createLibrary({index});
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => {server.close(resolve); server.closeAllConnections();}));
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/demos`);
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.demos.filter(demo => demo.kind === 'lab').length, scenes.length);
  for (const category of data.categories) assert.ok(category.label && category.label_en);
  for (const demo of data.demos) {
    assert.ok(demo.title_en?.trim() && demo.one_liner_en?.trim(), demo.id);
    assert.doesNotMatch(demo.title_en + demo.one_liner_en, /\p{Script=Han}/u);
    if (demo.kind === 'lab') {
      const launch = index.records.find(record => record.id === demo.id).launch;
      assert.equal(new URL(launch.url).searchParams.get('embed'), '1');
    }
  }
  assert.deepEqual((await checkPages()).errors, []);
});

test('page validation rejects missing, blank and oversized English copy', async t => {
  const f = await fixture(t);
  for (const [field, scope, max] of [['tagline_en', 'page'], ['title_en', 'example', 60], ['one_liner_en', 'example', 110]]) {
    for (const value of [undefined, '', '   ', ...(max ? ['x'.repeat(max + 1)] : [])]) {
      const page = structuredClone(f.page);
      (scope === 'page' ? page : page.examples[0])[field] = value;
      await f.json('catalog/pages/cloudkeep.json', page);
      const loaded = await loadPages(f.root);
      assert.equal(loaded.pages.has('cloudkeep'), false, `${field}: ${value}`);
      assert.match(loaded.errors.get('cloudkeep'), new RegExp(field));
    }
  }
});

test('missing Lab English fails the demos API instead of leaking Chinese into English', async t => {
  const f = await fixture(t);
  f.records.push({id:'demo:missing',kind:'demo',title:'Missing',summary:'Missing',category:['camera']});
  await f.json('catalog/lab-i18n.json', {});
  assert.equal((await f.get('/api/demos')).status, 400);
});


test('every published game, example and Lab source URL names a path in HEAD', async t => {
  const tree = new Set(execFileSync('git', ['ls-tree', '-r', '--name-only', 'HEAD'], {cwd: index.root, encoding: 'utf8'}).trim().split('\n'));
  const server = await createLibrary({index});
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const base = `http://127.0.0.1:${server.address().port}`;
  const get = async route => { const response = await fetch(base + route); assert.equal(response.status, 200); return response.json(); };
  const {demos} = await get('/api/demos');
  const {pages} = await get('/api/pages');
  const urls = demos.map(demo => demo.source_url);
  for (const page of pages) urls.push((await get('/api/page?slug=' + encodeURIComponent(page.slug))).source_url);
  assert.equal(pages.length, index.games.length);
  for (const link of urls) {
    const url = new URL(link);
    assert.equal(url.origin, 'https://github.com');
    const match = url.pathname.match(/^\/0xmariowu\/awesome-threejs-games\/(tree|blob)\/main\/(.+)$/);
    assert.ok(match, link);
    const [, kind, name] = match;
    assert.ok(kind === 'blob' ? tree.has(name) : [...tree].some(file => file.startsWith(name + '/')), `Missing HEAD path: ${link}`);
  }
});

test('live design data aliases, source manifest and bundled text preserve access boundaries', async t => {
  const f = await fixture(t);
  await f.put('cloudkeep/README.md','# Cloudkeep');
  execFileSync('git',['init','-q',f.root]);execFileSync('git',['-C',f.root,'add','cloudkeep/README.md','cloudkeep/source.txt']);
  assert.deepEqual((await f.get('/data/pages.json')).json(),(await f.get('/api/pages')).json());
  assert.deepEqual((await f.get('/data/page/cloudkeep.json')).json(),(await f.get('/api/page?slug=cloudkeep')).json());
  const manifest=(await f.get('/data/src/manifest.json')).json();
  assert.deepEqual(manifest.map(f=>f.path),['cloudkeep/README.md','cloudkeep/source.txt']);
  assert.deepEqual(manifest[0],{path:'cloudkeep/README.md',size:11,bundled:true});
  assert.equal((await f.get('/data/src/cloudkeep/README.md')).text,'# Cloudkeep');
  for (const file of ['cloudkeep/source.txt','../outside.txt','cloudkeep/%2e%2e/outside.txt','tools/library.mjs','cloudkeep/internal-link']) {
    assert.equal((await f.get('/data/src/'+file)).status,404,file);
  }
  for (const route of ['/demos/example%3Atidewater-fishing','/source/cloudkeep/README.md']) assert.equal((await f.get(route)).status,200);
  for (const route of ['/data/pages.json','/data/src/manifest.json','/data/src/cloudkeep/README.md']) {
    assert.equal((await f.get(route,{Origin:'https://hostile.test'})).status,403);
    assert.equal((await f.get(route,{'Sec-Fetch-Site':'cross-site'})).status,403);
  }
});
