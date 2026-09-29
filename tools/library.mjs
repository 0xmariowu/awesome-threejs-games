import http from 'node:http';
import { readFile, readdir, realpath, lstat, stat, open } from 'node:fs/promises';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildIndex, search, context, readSource, sha256 } from './library-index.mjs';
import { createServer, sendFile, mime } from './server.mjs';
import { loadTools, toolSummary, toolDetail } from './tools.mjs';
import { loadPages } from './pages.mjs';
import { loadDemos, sourceManifest } from './demos.mjs';

const sleep = ms => new Promise(resolve=>setTimeout(resolve,ms));
const listen = (server,port) => new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});
export async function createLibrary({index, launcher} = {}) {
  index ||= await buildIndex();
  const tools = await loadTools(index.root);
  let manifest;
  const getManifest = () => manifest ||= sourceManifest(index.root, index.games);
  const token = randomBytes(32).toString('hex');
  const owned = new Set(), pending = new Map();
  const publicIndex = () => ({schema_version:index.schema_version,generated_at:index.generated_at,counts:{...index.counts,tool:tools.length},
    records:index.records,category_names:index.category_names,category_names_en:index.category_names_en,lab_error:index.labError,token,thumbnails:Object.keys(index.thumbnails)});
  const fail = (status,message) => {throw Object.assign(new Error(message),{status});};
  const project = slug => {
    if(!/^[a-z0-9-]+$/.test(slug || '') || !index.games.some(game=>game.slug===slug))fail(404,'Unknown project');
    return slug;
  };
  const safePath = relative => typeof relative==='string' && !path.isAbsolute(relative) && !/[\\\0]/.test(relative)
    && relative.split('/').every(part=>part && !part.startsWith('.') && part.toLowerCase()!=='node_modules');
  async function contained(base,relative) {
    const boundary=await realpath(base),absolute=await realpath(path.join(base,relative)),rest=path.relative(boundary,absolute);
    if(rest==='..' || rest.startsWith(`..${path.sep}`) || path.isAbsolute(rest))fail(404,'File not found');
    return absolute;
  }
  async function archivePath(slug,relative) {
    project(slug);
    if(!safePath(relative) || (relative!==slug && !relative.startsWith(`${slug}/`)))fail(400,'Invalid archive path');
    const base=await realpath(path.join(index.root,slug));
    const absolute=await contained(base,relative===slug ? '' : relative.slice(slug.length+1));
    if(path.relative(base,absolute).split(path.sep).some(part=>part.toLowerCase()==='node_modules'))fail(400,'Invalid archive path');
    return absolute;
  }
  const servedFolder = record => record.launch.type==='original' ? record.project : `examples/${record.launch.folder ?? record.launch.id}`;
  async function ensureOriginal(record) {
    const folder = servedFolder(record);
    const config = JSON.parse(await readFile(path.join(index.root,folder,'local.json'),'utf8'));
    const root = path.join(index.root,folder,config.root || 'public');
    const entry = new URL(record.launch.url).pathname;
    const expected = await readFile(path.join(root,(entry==='/' ? config.entry||'/index.html' : entry).replace(/^\//,'')));
    let response;
    try {response=await fetch(record.launch.url,{signal:AbortSignal.timeout(1500)});} catch(error) {
      if (error.cause?.code !== 'ECONNREFUSED') throw new Error('Game port is occupied or unresponsive; inspect it before retrying.');
    }
    if(response) {
      if(!response.ok || sha256(Buffer.from(await response.arrayBuffer()))!==sha256(expected)) throw new Error('Port is occupied by a different page; existing service was left unchanged.');
    } else {
      const gameServer=createServer(root,config.entry);
      await listen(gameServer,config.port);owned.add(gameServer);
    }
    return record.launch.url;
  }
  async function ensureLab(record) {
    let response;
    try {response=await fetch('http://127.0.0.1:5199/src/catalog.ts',{signal:AbortSignal.timeout(1500)});} catch(error) {
      if(error.cause?.code!=='ECONNREFUSED')throw new Error('Lab port is occupied or unresponsive.');
    }
    if(response) {
      const body=await response.text();
      if(!response.ok || !body.includes('inkwave-3c') || !body.includes('cloudkeep-cam'))throw new Error('Port 5199 belongs to another service.');
      return record.launch.url;
    }
    const child = spawn(process.execPath,[path.join(index.labRoot,'node_modules/vite/bin/vite.js'),'--host','127.0.0.1','--port','5199','--strictPort'],{cwd:index.labRoot,stdio:['ignore','ignore','pipe']});
    owned.add(child);let errorText='',spawnError;
    child.stderr.on('data',chunk=>{errorText=(errorText+chunk).slice(-2000);});
    child.on('error',error=>{spawnError=error;});
    for(let attempt=0;attempt<80;attempt++) {
      await sleep(150);
      if(spawnError || child.exitCode!==null)throw new Error(`Lab failed to start: ${spawnError?.message || errorText}`);
      try {const probe=await fetch('http://127.0.0.1:5199/src/catalog.ts',{signal:AbortSignal.timeout(500)});if(probe.ok && (await probe.text()).includes('cloudkeep-cam'))return record.launch.url;} catch {}
    }
    child.kill();owned.delete(child);throw new Error('Lab did not become ready within 12 seconds.');
  }
  async function launch(id) {
    const record=index.records.find(record=>record.id===id);
    if(!record?.launch)throw new Error('This record has no runnable entry. Open its linked original or example.');
    if(launcher)return launcher(record);
    const key=record.launch.type==='lab' ? 'lab' : `${servedFolder(record)}:${new URL(record.launch.url).port}`;
    if(!pending.has(key))pending.set(key,(record.launch.type==='lab' ? ensureLab(record) : ensureOriginal(record)).finally(()=>pending.delete(key)));
    await pending.get(key);
    // Shared starts establish the server; each caller must still verify its entry.
    if(record.launch.type!=='lab')await ensureOriginal(record);
    return record.launch.url;
  }
  const server = http.createServer(async(req,res)=>{
    const host=`127.0.0.1:${server.address().port}`;
    const origin=`http://${host}`;
    const securityHeaders={'X-Content-Type-Options':'nosniff',
        'Referrer-Policy':'no-referrer','Cross-Origin-Resource-Policy':'same-origin',
        'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self' https://raw.githubusercontent.com; frame-src http://127.0.0.1:*; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"};
    const send=(status,body,type='application/json; charset=utf-8')=>{
      res.writeHead(status,{'Content-Type':type,'Cache-Control':'no-store',...securityHeaders});
      res.end(type.startsWith('application/json') ? JSON.stringify(body):body);
    };
    if(req.headers.host!==host)return send(403,{error:`Use ${origin}`});
    if(req.headers.origin && req.headers.origin!==origin)return send(403,{error:'Cross-origin access denied'});
    if(['cross-site','same-site'].includes(req.headers['sec-fetch-site']))return send(403,{error:'Use the library directly'});
    try {
      const url=new URL(req.url,origin);
      // Both live and Pages clients consume the same public data paths.
      if (url.pathname === '/data/tools.json') url.pathname = '/api/tools';
      const toolRoute = /^\/data\/tool\/([a-z0-9-]+)\.json$/.exec(url.pathname);
      if (toolRoute) { url.pathname = '/api/tool'; url.searchParams.set('slug',toolRoute[1]); }
      if (url.pathname === '/data/pages.json') url.pathname = '/api/pages';
      if (url.pathname === '/data/demos.json') url.pathname = '/api/demos';
      const detail = /^\/data\/page\/([a-z0-9-]+)\.json$/.exec(url.pathname);
      if (detail) { url.pathname = '/api/page'; url.searchParams.set('slug', detail[1]); }
      if (req.method === 'GET' && url.pathname === '/data/src/manifest.json') return send(200, await getManifest());
      if (req.method === 'GET' && url.pathname.startsWith('/data/src/')) {
        const relative = decodeURIComponent(url.pathname.slice(10));
        if (!safePath(relative) || !(await getManifest()).some(f => f.path === relative && f.bundled)) return send(404,{error:'Source not bundled'});
        const absolute = await contained(index.root, relative);
        return send(200, await readFile(absolute), 'text/plain; charset=utf-8');
      }
      if (req.method === 'GET' && /^\/previews\/[a-z0-9-]+\.webp$/.test(url.pathname)) {
        const absolute = await contained(path.join(index.root,'previews'), path.basename(url.pathname));
        if (await sendFile(req,res,absolute,securityHeaders)) return;
        return send(404,{error:'Preview not found'});
      }
      if(req.method==='POST') {
        if(url.pathname!=='/api/launch')return send(404,{error:'Unknown action'});
        const provided=Buffer.from(String(req.headers['x-library-token']||''));
        if(provided.length!==token.length || !timingSafeEqual(provided,Buffer.from(token)))return send(403,{error:'Reload the library before launching'});
        if(!String(req.headers['content-type']).startsWith('application/json'))return send(415,{error:'Expected JSON'});
        let body='';for await(const chunk of req){body+=chunk;if(body.length>4096)return send(413,{error:'Request too large'});}
        const {id}=JSON.parse(body);
        return send(200,{url:await launch(id)});
      }
      if(req.method!=='GET')return send(405,{error:'Method not allowed'});
      if(url.pathname==='/api/index')return send(200,publicIndex());
      if(url.pathname==='/api/search')return send(200,{records:search(index,Object.fromEntries(url.searchParams))});
      if(url.pathname==='/api/context')return send(200,context(index,url.searchParams.get('id')));
      if(url.pathname==='/api/source') {
        const number=url.searchParams.get('file')||'0';
        if(!/^\d+$/.test(number))return send(400,{error:'Use a catalog file number'});
        return send(200,await readSource(index,url.searchParams.get('id'),Number(number)));
      }
      if(url.pathname==='/api/thumbnail') {
        const file=index.thumbnails[url.searchParams.get('project')];
        if(!file)return send(404,{error:'No screenshot recorded'});
        return send(200,await readFile(path.join(index.root,file)),'image/png');
      }
      try {
        if (url.pathname === '/api/tools' || url.pathname === '/api/tool') {
          const {videos} = await loadPages(index.root);
          const overview = tool => {
            const row = videos.get(tool.overview_video);
            return {url:row ? `/media-web/${tool.slug}/overview.mp4`:null,poster:`/previews/${tool.slug}.webp`,duration:row?.duration};
          };
          if (url.pathname === '/api/tools') return send(200,{tools:tools.map(tool=>toolSummary(tool,overview(tool)))});
          const tool = tools.find(tool=>tool.slug===url.searchParams.get('slug'));
          if (!tool) return send(404,{error:'Unknown tool'});
          return send(200,toolDetail(tool,overview(tool),index.records));
        }
        if(url.pathname==='/api/demos')return send(200,await loadDemos(index));
        if(url.pathname==='/api/pages') {
          const {pages,errors,videos}=await loadPages(index.root);
          let reviews=[];
          try {reviews=JSON.parse(await readFile(path.join(index.root,'catalog/runnability.json'),'utf8')).games ?? [];}
          catch(error) {if(error.code!=='ENOENT')throw error;}
          const runnability=new Map(reviews.map(review=>[review.slug,{
            reviewed_verdict:review.reviewed_verdict ?? null,review_note:review.review_note ?? null,
            ...(review.review_note_en ? {review_note_en:review.review_note_en}:{})}]));
          return send(200,{pages:[...new Set([...(index.games || []).map(g=>g.slug).filter(slug=>pages.has(slug)||errors.has(slug)),...pages.keys(),...errors.keys()])].map(slug=>{
            const page=pages.get(slug),overview=videos.get(page?.overview_video);
            return {slug,title:page?.title ?? slug,tagline:page?.tagline ?? '',tagline_en:page?.tagline_en ?? '',category:page?.category ?? null,
              examples:page?.examples.length ?? 0,has_example:(page?.examples.length ?? 0)>0,
              runnability:runnability.get(slug) ?? null,
              overview_video:overview ? {url:'/'+overview.file,poster:'/'+overview.poster,duration:overview.duration,
                ...(overview.preview ? {preview:'/'+overview.preview}:{})}:null,
              ...(errors.has(slug)?{error:errors.get(slug)}:{})};
          })});
        }
        if(url.pathname==='/api/page') {
          const slug=project(url.searchParams.get('slug')),{pages,errors,videos}=await loadPages(index.root),page=pages.get(slug);
          if(errors.has(slug))return send(422,{error:errors.get(slug)});
          if(!page)return send(404,{error:'No page recorded'});
          const record=id=>index.records.find(row=>row.id===id) || null;
          const video=id=>{const row=videos.get(id);return row ? {id:row.id,url:'/'+row.file,poster:'/'+row.poster,duration:row.duration,
            ...(row.preview ? {preview:'/'+row.preview}:{})}:null;};
          const examples=page.examples.map(example=>{
            const launch=record(`example:${example.id}`)?.launch;
            return {...example,launch:launch ? {url:launch.url,port:launch.port ?? Number(new URL(launch.url).port)}:null};
          });
          return send(200,{...page,project:record(`game:${slug}`),overview_video:video(page.overview_video),examples,
            source_url:`https://github.com/0xmariowu/awesome-threejs-games/tree/main/${slug}`});
        }
        if(url.pathname==='/api/tree') {
          const slug=project(url.searchParams.get('project')),dir=url.searchParams.get('dir') ?? slug,absolute=await archivePath(slug,dir);
          if(!(await stat(absolute)).isDirectory())fail(404,'Directory not found');
          const entries=[];
          for(const entry of await readdir(absolute,{withFileTypes:true})) {
            if(entry.name.startsWith('.') || entry.name.toLowerCase()==='node_modules' || entry.isSymbolicLink())continue;
            const info=await lstat(path.join(absolute,entry.name));
            if(info.isDirectory() || info.isFile())entries.push({name:entry.name,path:`${dir}/${entry.name}`,type:info.isDirectory()?'dir':'file',...(info.isFile()?{bytes:info.size}:{})});
          }
          entries.sort((a,b)=>(a.type===b.type ? 0:a.type==='dir'?-1:1) || a.name.localeCompare(b.name));
          return send(200,{project:slug,dir,entries:entries.slice(0,2000),truncated:entries.length>2000});
        }
        if(url.pathname==='/api/file') {
          const slug=project(url.searchParams.get('project')),relative=url.searchParams.get('path'),absolute=await archivePath(slug,relative);
          const file=await open(absolute,'r');
          try {
            const info=await file.stat();
            if(!info.isFile())fail(404,'File not found');
            const large=info.size>50_000_000,bytes=large ? Buffer.alloc(Math.min(8192,info.size)):await file.readFile();
            if(large)await file.read(bytes,0,bytes.length,0);
            const binary=bytes.subarray(0,8192).includes(0);
            return send(200,{path:relative,bytes:info.size,sha256:large?null:sha256(bytes),binary,
              text:large || binary ? null:bytes.subarray(0,2_000_000).toString('utf8'),truncated:info.size>2_000_000});
          } finally {await file.close();}
        }
        // Check the raw path before URL normalization can erase traversal segments.
        const pathname=decodeURIComponent(req.url.split('?')[0]);
        if(!pathname.startsWith('/') || /[\\\0]/.test(pathname) || pathname.split('/').some(part=>part==='.' || part==='..'))return send(404,{error:'Unknown library route'});
        if (/^\/media-web\/[a-z0-9-]+\/overview\.mp4$/.test(pathname)) {
          const absolute = await contained(path.join(index.root,'media-web'),pathname.slice(11));
          if (await sendFile(req,res,absolute,securityHeaders)) return;
          return send(404,{error:'Media not found'});
        }
        if(pathname.startsWith('/media/')) {
          if(!safePath(pathname.slice(1)) || !['.mp4','.vtt','.jpg'].includes(path.extname(pathname)))return send(404,{error:'Media not found'});
          const absolute=await contained(path.join(index.root,'media'),pathname.slice(7));
          if(!['.mp4','.vtt','.jpg'].includes(path.extname(absolute)))return send(404,{error:'Media not found'});
          if(await sendFile(req,res,absolute,securityHeaders))return;
          return send(404,{error:'Media not found'});
        }
        const assets={'/':'index.html','/index.html':'index.html','/app.js':'app.js','/style.css':'style.css'};
        const name=pathname.slice(1),vendor=name.split('/');
        const asset=assets[pathname] || (/^[a-z0-9-]+\.(js|css|html)$/.test(name) ||
          (vendor[0]==='vendor' && vendor.length>=2 && vendor.every(part=>/^[a-z0-9._-]+$/.test(part) && !part.startsWith('.')) && name.endsWith('.js')) ? name:null) ||
          (/^\/(p|t|source|demos)\//.test(pathname) || ['/topics','/search','/demos','/tools','/tools/'].includes(pathname) ? 'index.html':null);
        if(asset) {
          const absolute=await contained(path.join(index.root,'library'),asset);
          if(!(await stat(absolute)).isFile())return send(404,{error:'File not found'});
          return send(200,await readFile(absolute),mime[path.extname(asset)]);
        }
      } catch(error) {return send(error.status || (['ENOENT','ENOTDIR'].includes(error.code)?404:400),{error:error.status?error.message:'Library resource unavailable'});}
      return send(404,{error:'Unknown library route'});
    } catch(error) {return send(400,{error:error.message});}
  });
  server.on('close',()=>{for(const item of owned)if(item.close){item.close();item.closeAllConnections();}else item.kill();});
  return server;
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const server=await createLibrary();
  await listen(server,Number(process.env.LIBRARY_PORT||8080));
  console.log(`Gameref library: http://127.0.0.1:${server.address().port}`);
  for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{server.close();server.closeAllConnections();});
}
