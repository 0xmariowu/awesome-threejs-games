import {test} from 'node:test';
import http from 'node:http';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm,symlink} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createServer,sendFile,mime} from './server.mjs';

test('static example pages remain frameable by the library origin', async t => {
  const dir=await mkdtemp(path.join(os.tmpdir(),'gameref-server-'));
  t.after(()=>rm(dir,{recursive:true,force:true}));
  await writeFile(path.join(dir,'models.html'),'<title>Models</title>');
  const server=createServer(dir,'/models.html');
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();}));
  const base=`http://127.0.0.1:${server.address().port}`;
  for(const [route,status] of [['/',302],['/models.html',200]]) {
    const response=await fetch(base+route,{redirect:'manual',headers:{'Sec-Fetch-Dest':'iframe'}});
    assert.equal(response.status,status);
    assert.equal(response.headers.get('x-frame-options'),null);
    assert.doesNotMatch(response.headers.get('content-security-policy') || '',/\bframe-ancestors\b/i);
    await response.text();
  }
});

test('static server restricts Host and hidden paths but serves well-known files', async t => {
  const dir=await mkdtemp(path.join(os.tmpdir(),'gameref-server-'));
  t.after(()=>rm(dir,{recursive:true,force:true}));
  for (const relative of ['index.html','.git-upstream/config','.claude/plan.md',
    'nested/.hidden/config','.well-known/probe.txt','.well-known/.secret']) {
    await mkdir(path.dirname(path.join(dir,relative)),{recursive:true});
    await writeFile(path.join(dir,relative),'fixture');
  }
  const server=createServer(dir);
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();}));
  const port=server.address().port;
  const get=(route,host=`127.0.0.1:${port}`)=>new Promise((resolve,reject)=>{
    http.get({hostname:'127.0.0.1',port,path:route,headers:{Host:host}},res=>{
      res.resume();res.on('end',()=>resolve(res.statusCode));
    }).on('error',reject);
  });
  for(const host of ['evil.test',`evil.test:${port}`,'localhost',`localhost:${port+1}`])
    assert.equal(await get('/',host),403);
  assert.equal(await get('/',`localhost:${port}`),200);
  assert.equal(await get('/'),200);
  for(const route of ['/.git-upstream/config','/.claude/plan.md','/nested/.hidden/config',
    '/%2egit-upstream/config','/.well-known/.secret']) assert.equal(await get(route),404);
  assert.equal(await get('/.well-known/probe.txt'),200);
  assert.ok([403,404].includes(await get('/..%2f..%2fetc%2fhosts')));
});

test('static server serves WASM, ranges, HEAD, errors and confines symlinks', async () => {
  const dir=await mkdtemp(path.join(os.tmpdir(),'gameref-server-'));
  await writeFile(path.join(dir,'game.wasm'),'0123456789');
  await symlink('/etc/hosts',path.join(dir,'outside'));
  const server=createServer(dir);
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}`;
  try {
    let r=await fetch(base+'/game.wasm');assert.equal(r.headers.get('content-type'),'application/wasm');assert.equal(await r.text(),'0123456789');
    const etag=r.headers.get('etag');assert.ok(etag);
    r=await fetch(base+'/game.wasm',{headers:{'If-None-Match':etag}});assert.equal(r.status,304);assert.equal(await r.text(),'');
    r=await fetch(base+'/game.wasm',{method:'HEAD',headers:{'If-None-Match':`"older", ${etag}`}});assert.equal(r.status,304);
    r=await fetch(base+'/game.wasm',{headers:{Range:'bytes=2-5'}});assert.equal(r.status,206);assert.equal(await r.text(),'2345');
    r=await fetch(base+'/game.wasm',{headers:{Range:'bytes=-3'}});assert.equal(await r.text(),'789');
    r=await fetch(base+'/game.wasm',{headers:{Range:'bytes=99-100'}});assert.equal(r.status,416);
    r=await fetch(base+'/game.wasm',{method:'HEAD'});assert.equal(await r.text(),'');assert.equal(r.headers.get('content-length'),'10');
    assert.equal((await fetch(base+'/missing')).status,404);
    assert.equal((await fetch(base+'/%E0%A4%A')).status,400);
    assert.equal((await fetch(base+'/outside')).status,403);
    assert.equal((await fetch(base+'/game.wasm',{method:'POST'})).status,405);
    await writeFile(path.join(dir,'game.wasm'),'changed bytes');
    r=await fetch(base+'/game.wasm',{headers:{'If-None-Match':etag}});assert.equal(r.status,200);assert.equal(await r.text(),'changed bytes');assert.notEqual(r.headers.get('etag'),etag);
  } finally {await new Promise(resolve=>server.close(resolve));await rm(dir,{recursive:true});}
});

test('sendFile serves headers, VTT, ranges, HEAD and conditional requests', async () => {
  const dir=await mkdtemp(path.join(os.tmpdir(),'gameref-sendfile-'));
  await writeFile(path.join(dir,'game.wasm'),'0123456789');
  await writeFile(path.join(dir,'captions.vtt'),'WEBVTT\n');
  const extraHeaders={'Content-Type':'text/plain','Content-Security-Policy':"default-src 'none'"};
  const results=[];
  const server=http.createServer(async (req,res)=>{
    try {
      const sent=await sendFile(req,res,path.join(dir,req.url.slice(1)),req.url==='/game.wasm' ? extraHeaders : {});
      results.push(sent);
      if (!sent) {res.writeHead(404);res.end();}
    } catch {res.writeHead(404);res.end();}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}`;
  try {
    let r=await fetch(base+'/game.wasm');assert.equal(r.status,200);assert.equal(await r.text(),'0123456789');
    assert.equal(r.headers.get('content-type'),'text/plain');assert.equal(r.headers.get('content-security-policy'),extraHeaders['Content-Security-Policy']);
    assert.equal(r.headers.get('content-length'),'10');assert.equal(r.headers.get('accept-ranges'),'bytes');assert.equal(r.headers.get('cache-control'),'no-cache');assert.equal(r.headers.get('x-content-type-options'),'nosniff');assert.ok(r.headers.get('last-modified'));
    const etag=r.headers.get('etag');assert.ok(etag);
    r=await fetch(base+'/captions.vtt');assert.equal(r.status,200);assert.equal(r.headers.get('content-type'),'text/vtt; charset=utf-8');assert.equal(await r.text(),'WEBVTT\n');assert.equal(mime['.vtt'],'text/vtt; charset=utf-8');
    r=await fetch(base+'/game.wasm',{headers:{Range:'bytes=2-5'}});assert.equal(r.status,206);assert.equal(r.headers.get('content-range'),'bytes 2-5/10');assert.equal(r.headers.get('content-length'),'4');assert.equal(await r.text(),'2345');assert.equal(r.headers.get('content-type'),'text/plain');
    r=await fetch(base+'/game.wasm',{headers:{Range:'bytes=99-100'}});assert.equal(r.status,416);assert.equal(r.headers.get('content-range'),'bytes */10');assert.equal(await r.text(),'');assert.equal(r.headers.get('content-security-policy'),extraHeaders['Content-Security-Policy']);
    r=await fetch(base+'/game.wasm',{method:'HEAD'});assert.equal(r.status,200);assert.equal(r.headers.get('content-length'),'10');assert.equal(await r.text(),'');
    r=await fetch(base+'/game.wasm',{headers:{'If-None-Match':etag}});assert.equal(r.status,304);assert.equal(r.headers.get('etag'),etag);assert.equal(await r.text(),'');assert.equal(r.headers.get('content-security-policy'),extraHeaders['Content-Security-Policy']);
    assert.deepEqual(results,[true,true,true,true,true,true]);
    assert.equal((await fetch(base+'/')).status,404);assert.equal(results.at(-1),false);
    assert.equal((await fetch(base+'/missing')).status,404);
  } finally {await new Promise(resolve=>server.close(resolve));await rm(dir,{recursive:true});}
});

test('static server preserves font fallback, error bodies and entry redirects', async () => {
  const dir=await mkdtemp(path.join(os.tmpdir(),'gameref-server-'));
  await mkdir(path.join(dir,'_external/fonts.googleapis.com'),{recursive:true});
  await writeFile(path.join(dir,'_external/fonts.googleapis.com/css2'),'body{}');
  const server=createServer(dir,'/game.html');
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}`;
  try {
    let r=await fetch(base+'/',{redirect:'manual'});assert.equal(r.status,302);assert.equal(r.headers.get('location'),'/game.html');await r.text();
    r=await fetch(base+'/missing');assert.equal(r.status,404);assert.equal(r.headers.get('content-type'),'text/plain');assert.equal(await r.text(),'Not archived: /missing');
    r=await fetch(base+'/_external');assert.equal(r.status,404);assert.equal(await r.text(),'');
    const url=base+'/_external/fonts.googleapis.com/css2';
    r=await fetch(url);assert.equal(r.status,200);assert.equal(r.headers.get('content-type'),'text/css');assert.equal(await r.text(),'body{}');
    const etag=r.headers.get('etag');
    r=await fetch(url,{headers:{'If-None-Match':etag}});assert.equal(r.status,304);assert.equal(r.headers.get('content-type'),'text/css');assert.equal(await r.text(),'');
    r=await fetch(url,{headers:{Range:'bytes=0-3'}});assert.equal(r.status,206);assert.equal(r.headers.get('content-type'),'text/css');assert.equal(await r.text(),'body');
    r=await fetch(url,{headers:{Range:'bytes=99-100'}});assert.equal(r.status,416);assert.equal(r.headers.get('content-type'),null);assert.equal(r.headers.get('content-range'),'bytes */6');assert.equal(await r.text(),'');
  } finally {await new Promise(resolve=>server.close(resolve));await rm(dir,{recursive:true});}
});


test('missing default favicons are empty while existing icons and other 404s survive', async t => {
  const dir=await mkdtemp(path.join(os.tmpdir(),'gameref-favicon-'));
  t.after(()=>rm(dir,{recursive:true,force:true}));
  const server=createServer(dir);
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();}));
  const base=`http://127.0.0.1:${server.address().port}`;
  for (const method of ['GET','HEAD']) {
    const response=await fetch(base+'/favicon.ico',{method});
    assert.equal(response.status,204);assert.equal(await response.text(),'');
  }
  assert.equal((await fetch(base+'/missing.png')).status,404);
  await writeFile(path.join(dir,'favicon.ico'),'archived icon');
  const response=await fetch(base+'/favicon.ico');
  assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'image/x-icon');
  assert.equal(await response.text(),'archived icon');
});
