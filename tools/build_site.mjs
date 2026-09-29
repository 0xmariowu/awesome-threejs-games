import {readFile, writeFile, readdir, mkdir, copyFile, stat, lstat, rm, mkdtemp, cp, rename} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {pathToFileURL, fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {brotliDecompressSync} from 'node:zlib';
import {loadTools, toolSummary, toolDetail} from './tools.mjs';
import {loadPages} from './pages.mjs';
import {loadDemos, sourceManifest} from './demos.mjs';

export const BASE = '/awesome-threejs-games/';
export const VIDEO_LIMIT = 6_000_000;
const ROOT = fileURLToPath(new URL('../', import.meta.url));
const decodeText = bytes => { try { return new TextDecoder('utf-8',{fatal:true}).decode(bytes); } catch { return null; } };
const json = async file => JSON.parse(await readFile(file, 'utf8'));
const exists = async file => {try {await stat(file); return true;} catch (error) {if (error.code === 'ENOENT') return false; throw error;}};
const writeJSON = async (file, value) => {await mkdir(path.dirname(file), {recursive:true}); await writeFile(file, JSON.stringify(value, null, 2) + '\n');};
const escapeRE = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const TEXT = /\.(?:html|[cm]?js|css|json|webmanifest|gltf|svg|txt)$/i;

// Keep this dependency-free: the deployment job needs Node and npm only.
export function validateWorkflow(text) {
  const required = [
    /on:\s*\n\s+push:\s*\n\s+branches: \[main\]/, /workflow_dispatch:/,
    /contents: read/, /pages: write/, /id-token: write/, /group: pages/,
    /runs-on: ubuntu-latest/, /actions\/checkout@v4/, /actions\/setup-node@v4/,
    /node-version: ['"]?22['"]?\s/, /cache: npm/,
    /cache-dependency-path: webgame-lab\/package-lock\.json/,
    /run: npm ci\s*\n\s+working-directory: webgame-lab\s/,
    /run: node tools\/build_site\.mjs\s*\n/,
    /actions\/configure-pages@v5/, /actions\/upload-pages-artifact@v3\s*\n\s+with:\s*\n\s+path: _site\s/,
    /actions\/deploy-pages@v4/,
  ];
  for (const pattern of required) if (!pattern.test(text)) throw new Error(`Pages workflow missing contract: ${pattern}`);
  if (/setup-python|pip install|npm install/.test(text)) throw new Error('Pages build must use only npm ci in webgame-lab');
}

export async function checkBuildInputs(root = ROOT) {
  validateWorkflow(await readFile(path.join(root,'.github/workflows/pages.yml'),'utf8'));
  const git = spawnSync('git',['ls-files','-z'],{cwd:root,encoding:'utf8',maxBuffer:20_000_000});
  if (git.status !== 0) throw new Error('Cannot list tracked build inputs');
  const tracked = new Set(git.stdout.split('\0').filter(Boolean)), inputs = new Set();
  async function requireFile(relative) {
    if (!tracked.has(relative)) throw new Error(`Untracked build input: ${relative}`);
    if (!(await lstat(path.join(root,relative))).isFile()) throw new Error(`Build input must be a regular file: ${relative}`);
    inputs.add(relative);
  }
  async function tree(relative, skip = () => false) {
    for (const entry of await readdir(path.join(root,relative),{withFileTypes:true})) {
      if (skip(entry.name)) continue;
      const name = path.posix.join(relative,entry.name);
      if (entry.isDirectory()) await tree(name,skip); else await requireFile(name);
    }
  }
  async function module(relative) {
    if (inputs.has(relative)) return;
    await requireFile(relative);
    const source = await readFile(path.join(root,relative),'utf8');
    for (const match of source.matchAll(/\bfrom\s+['"](\.[^'"]+)['"]/g)) {
      await module(path.posix.normalize(path.posix.join(path.posix.dirname(relative),match[1])));
    }
  }
  await module('tools/build_site.mjs');
  for (const name of ['games','tools','examples','extraction-candidates','runnability','videos','lab-i18n']) await requireFile(`catalog/${name}.json`);
  for (const dir of ['catalog/pages','library','previews']) await tree(dir);
  await tree('webgame-lab',name=>['node_modules','.git','dist'].includes(name));
  for (const name of ['package.json','package-lock.json','src/catalog.ts','index.html','vite.config.ts']) await requireFile(`webgame-lab/${name}`);
  const {games} = await json(path.join(root,'catalog/games.json'));
  const {examples} = await json(path.join(root,'catalog/examples.json'));
  const roots = [...games.map(game=>[game.slug,game.slug]), ...examples.map(example=>['examples/'+(example.folder || example.id),example.folder || example.id])];
  for (const [folder,slug] of roots) {
    await requireFile(`${folder}/local.json`);
    const config = await json(path.join(root,folder,'local.json'));
    const source = path.resolve(root,folder,config.root);
    const required = new Set(slug === 'cloudkeep-flight' ? ['provenance.json'] : []);
    for (const file of await files(source,'',required,slug)) await requireFile(path.relative(root,path.join(source,file)).split(path.sep).join('/'));
  }
  for (const game of [...games,...await loadTools(root)]) {
    await requireFile(`previews/${game.slug}.webp`);
    await requireFile(`media-web/${game.slug}/overview.mp4`);
  }
  return {files:inputs.size};
}

export function siteVideo(row, slug) {
  return {url:row ? BASE+`media/${slug}/overview.mp4` : null,
    poster:BASE+`previews/${slug}.webp`,duration:row?.duration};
}

// Encoded artifacts are versioned in media-web; CI needs neither private source
// recordings nor ffmpeg. Local encodes use a content-addressed, ignored cache.
export async function prepareVideo(root, slug, out) {
  const source = path.join(root,'media',slug,'overview.mp4');
  const artifact = path.join(root,'media-web',slug,'overview.mp4');
  if (await exists(source)) {
    const hash = createHash('sha256').update(await readFile(source)).digest('hex');
    const cache = path.join(root,'output/media-encodes',hash+'-720p30-high-v2-6mb.mp4');
    await mkdir(path.dirname(cache),{recursive:true});
    if (!await exists(cache)) {
      const probe = spawnSync('ffprobe',['-v','error','-show_entries','format=duration','-of','json',source],{encoding:'utf8'});
      if (probe.status !== 0) throw new Error('ffprobe failed: '+probe.stderr);
      const duration = Number(JSON.parse(probe.stdout).format.duration);
      if (!(duration > 0)) throw new Error('Invalid recording duration: '+slug);
      // Reserve 6% for MP4 overhead. VBV limits CRF peaks over the full duration.
      const bitrate = Math.floor(VIDEO_LIMIT * 8 * .94 / duration);
      const temp = cache+'.tmp.mp4';
      const encode = spawnSync('ffmpeg',['-v','error','-y','-i',source,'-map','0:v:0',
        '-vf','scale=1280:720:force_original_aspect_ratio=decrease:force_divisible_by=2,pad=1280:720:(ow-iw)/2:(oh-ih)/2,setsar=1',
        '-r','30','-c:v','libx264','-profile:v','high','-preset','fast','-threads','4',
        '-crf','26','-maxrate',String(bitrate),'-bufsize',String(bitrate),
        '-pix_fmt','yuv420p','-movflags','+faststart','-an',temp],{encoding:'utf8'});
      if (encode.status !== 0) throw new Error('ffmpeg failed: '+encode.stderr);
      if ((await stat(temp)).size > VIDEO_LIMIT) throw new Error('Encoded video exceeds 6 MB: '+slug);
      await rename(temp,cache);
      console.log(`Encoded ${slug}: ${(await stat(cache)).size} bytes (source ${hash})`);
    }
    await mkdir(path.dirname(artifact),{recursive:true});
    await copyFile(cache,artifact);
  }
  if (!await exists(artifact)) throw new Error('Missing versioned video: media-web/'+slug+'/overview.mp4');
  const bytes = (await stat(artifact)).size;
  if (!bytes || bytes > VIDEO_LIMIT) throw new Error('Invalid video size: '+artifact);
  const destination = path.join(out,'media',slug,'overview.mp4');
  await mkdir(path.dirname(destination),{recursive:true});
  await copyFile(artifact,destination);
  return {slug,bytes};
}
export function runtimeFile(relative, slug) {
  // The separate private project remains on disk in local archive checkouts.
  if (slug === 'inkwave' && /^(?:(?:docs|src|tests|assets)\/garden(?:\/|$)|garden\.html$|scripts\/garden-[^/]*\.(?:py|mjs)$|package(?:-lock)?\.json$|vite\.config\.js$)/.test(relative)) return false;
  return !relative.split('/').some(part => part.startsWith('.') || ['node_modules','dist-garden','tests','test','screenshots','provenance','output','experience','docs'].includes(part)) &&
    !/(?:\.map$|\.md$|\.py$|\.test\.|\.spec\.|^(?:local|package(?:-lock)?|provenance|SNAPSHOT)\.json$|(?:^|\/)build\.mjs$)/i.test(relative);
}
async function files(root, prefix = '', required = new Set(), slug) {
  const result = [];
  for (const entry of await readdir(path.join(root, prefix), {withFileTypes:true})) {
    const name = path.posix.join(prefix, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Refusing runtime symlink: ${root}/${name}`);
    if (!runtimeFile(name, slug) && !required.has(name)) continue;
    if (entry.isDirectory()) result.push(...await files(root, name, required, slug));
    else if (entry.isFile()) result.push(name);
  }
  return result.sort();
}
// Restrict replacements to actual runtime-root names. Do not rewrite JS regexp
// literals, filesystem paths inside WASM loaders, protocol-relative or remote URLs.
export function rewriteURLs(text, prefix, names, file = '') {
  const rewrites = [];
  for (const name of [...names].sort()) {
    const pattern = new RegExp('(["\'`]|url\\(\\s*)/' + escapeRE(name) + '(?=[/"\'`?#)\\s<]|$)', 'g');
    let count = 0;
    text = text.replace(pattern, (_, lead) => {count++; return lead + prefix + name;});
    if (count) rewrites.push({count, before:`/${name}`, after:prefix + name});
  }
  const rootPattern = file.endsWith('.html') ? /\b((?:href|src|action)\s*=\s*["'])\/(["'])/g :
    file.endsWith('.webmanifest') ? /("(?:start_url|scope|id)"\s*:\s*")\/(")/g : null;
  if (rootPattern) text = text.replace(rootPattern, (before, lead, end) => {
    const after = lead + prefix + end;
    const previous = rewrites.find(row => row.before === before);
    if (previous) previous.count++; else rewrites.push({count:1,before,after});
    return after;
  });
  return {text, rewrites};
}
export function scanText(text) {
  return {
    absolute_urls:[...new Set([...text.matchAll(/(?:["'`(=])(\/(?!\/)[^\s"'`<>)]*)/g)].map(match => match[1]))],
    features:['<base','serviceWorker','SharedArrayBuffer','crossOriginIsolated','WebSocket','/api/','ensureCrossOriginIsolationHeaders'].filter(value => text.includes(value)),
    external_urls:[...new Set([...text.matchAll(/https?:\/\/[^\s"'`<>)]*/g)].map(match => match[0]))],
  };
}
export async function copyRuntime(source, destination, prefix, {slug} = {}) {
  const names = new Set((await readdir(source)).filter(name => runtimeFile(name, slug)));
  // Missing services stay scoped to their game; the checker recognizes only the
  // exact documented backend paths, never all 404s or all network failures.
  for (const name of ['api','account','kart-room']) names.add(name);
  // The model picker consumes this manifest as its asset inventory at runtime.
  const required = new Set(slug === 'cloudkeep-flight' ? ['provenance.json'] : []);
  const inventory = await files(source, '', required, slug), scan = [], rewrites = [], aliases = [];
  for (const file of inventory) {
    // GitHub Pages cannot infer CSS MIME for the archive's extensionless font CSS.
    if (file.startsWith('_external/fonts.googleapis.com/css') && !path.extname(file)) aliases.push(file);
  }
  for (const file of inventory) {
    const from = path.join(source, file), targetName = aliases.includes(file) ? file + '.css' : file;
    const to = path.join(destination, targetName);
    await mkdir(path.dirname(to), {recursive:true});
    if (TEXT.test(file) || aliases.includes(file)) {
      const bytes = await readFile(from);
      let text = decodeText(bytes);
      if (text === null) {
        // Some captures stored the server's compressed body verbatim (Content-Encoding: br).
        // Pages serves bytes as-is, so decode them here; never rewrite undecodable bytes.
        let decoded = null;
        try { decoded = decodeText(brotliDecompressSync(bytes)); } catch {}
        if (decoded === null) { await copyFile(from, to); continue; }
        text = decoded;
        rewrites.push({file:targetName,count:1,before:'brotli-compressed capture',after:'decoded UTF-8 text',operation:'decode stored Content-Encoding body'});
      }
      if (file.endsWith('.html') && !/<link\b[^>]*\brel\s*=\s*["'](?:shortcut\s+)?icon["']/i.test(text)) {
        const icon = '<link rel="icon" href="data:,">';
        text = /<head[^>]*>/i.test(text) ? text.replace(/<head[^>]*>/i,head=>head+icon) : icon+text;
        rewrites.push({file:targetName,count:1,before:'',after:icon,operation:'suppress missing default favicon probe'});
      }
      const findings = scanText(text);
      if (findings.absolute_urls.length || findings.features.length || findings.external_urls.length) scan.push({file,...findings});
      const changed = rewriteURLs(text, prefix, names, file); text = changed.text;
      rewrites.push(...changed.rewrites.map(row => ({file:targetName,...row})));
      for (const alias of aliases) {
        const before = prefix + alias, after = before + '.css';
        const count = text.split(before).length - 1;
        if (count) {text = text.split(before).join(after); rewrites.push({file:targetName,count,before,after});}
      }
      // Exact, inspected Vite helpers. These are not filesystem operations.
      const helpers = {
        hanakawa:['assets/index-BeXmJqZW.js', 'jl=function(e){return`/`+e}'],
        'longhoang-lyo':['assets/C0xwqhbh.js', 't=function(e){return`/`+e}'],
        'tableparty-kart':['assets/ranked-DjJM4Tou.js', 'Zg=function(f){return"/"+f}'],
      };
      const helper = helpers[slug];
      if (helper && file === helper[0]) {
        const before = helper[1], after = before.replace(/(["'`])\/\1/, JSON.stringify(prefix));
        if (!text.includes(before)) throw new Error(`${slug} preload helper changed; inspect before deploying`);
        text = text.replace(before, after); rewrites.push({file,count:1,before,after});
      }
      if (slug === 'longhoang-lyo' && file === 'assets/DLabtpBR.js') {
        const before = 'let n=e.startsWith(`/`)?e:`/${e}`;',
          after = `let n=e.startsWith(${JSON.stringify(prefix)})?e:${JSON.stringify(prefix)}+e.replace(/^\\/+/,"");`;
        if (!text.includes(before)) throw new Error('Lyo navigation helper changed; inspect before deploying');
        text = text.replace(before,after); rewrites.push({file,count:1,before,after});
      }
      if (slug === 'longhoang-lyo' && file === 'assets/ClujFw2l.js') {
        // The archived preload inventory is one comma-delimited string literal.
        const before = ',/assets/', after = ',' + prefix + 'assets/';
        const count = text.split(before).length - 1;
        if (!count) throw new Error('Lyo preload inventory changed; inspect before deploying');
        text = text.split(before).join(after); rewrites.push({file,count,before,after});
      }
      await writeFile(to, text);
    } else await copyFile(from, to);
  }
  for (const file of aliases) rewrites.push({file:file+'.css',count:1,before:file,after:file+'.css',operation:'rename for text/css MIME'});
  const result = {slug, prefix, files:inventory.length, scan, rewrites, online:true};
  await writeJSON(path.join(destination, '.gameref-deploy.json'), result);
  return result;
}
export function validateSizes(entries) {
  const total = entries.reduce((sum, row) => sum + row.bytes, 0);
  const large = entries.filter(row => row.bytes > 100_000_000);
  if (large.length || total >= 1_000_000_000) throw new Error(`Pages size limit exceeded: ${total} bytes; oversized files: ${large.map(row => row.file).join(', ')}`);
  const groups = {};
  for (const row of entries) {const group = row.file.includes('/') ? row.file.split('/')[0] : '(root)'; groups[group] = (groups[group] || 0) + row.bytes;}
  return {total, groups, largest:entries.reduce((max,row)=>row.bytes > max.bytes ? row:max,{bytes:0})};
}
async function allSizes(root, prefix = '') {
  const rows = [];
  for (const item of await readdir(path.join(root,prefix), {withFileTypes:true})) {
    const file = path.posix.join(prefix,item.name);
    if (item.isDirectory()) rows.push(...await allSizes(root,file));
    else rows.push({file,bytes:(await stat(path.join(root,file))).size});
  }
  return rows;
}
async function buildLab(root, out) {
  const snapshot = path.join(root,'webgame-lab');
  const dependencies = await exists(path.join(snapshot,'node_modules/vite/bin/vite.js')) ? path.join(snapshot,'node_modules') : path.resolve(root,'../webgame-lab/node_modules');
  if (!await exists(path.join(dependencies,'vite/bin/vite.js'))) throw new Error('Run npm ci inside webgame-lab first');
  const temp = await mkdtemp(path.join(os.tmpdir(),'gameref-lab-'));
  try {
    await cp(snapshot, temp, {recursive:true,filter:file=>!file.split(path.sep).some(part=>['node_modules','.git','dist'].includes(part))});
    // Vite's bundled config loader writes node_modules/.vite-temp. A symlink
    // would write into the sibling checkout, so isolate the dependencies too.
    await cp(dependencies,path.join(temp,'node_modules'),{recursive:true,verbatimSymlinks:true});
    const build = spawnSync(process.execPath,[path.join(temp,'node_modules/vite/bin/vite.js'),'build','--base',BASE+'lab/','--outDir',path.join(temp,'dist')], {cwd:temp,encoding:'utf8',maxBuffer:20_000_000});
    if (build.status !== 0) throw new Error(build.stderr + build.stdout);
    console.log(build.stdout.split('\n').filter(line=>/built in|transformed/.test(line)).join('\n'));
    return await copyRuntime(path.join(temp,'dist'),path.join(out,'lab'),BASE+'lab/');
  } finally {await rm(temp,{recursive:true,force:true});}
}
export async function writeToolData(out, tools, videos, records) {
  const summaries = [];
  for (const tool of tools) {
    const overview = siteVideo(videos.get(tool.overview_video),tool.slug);
    summaries.push(toolSummary(tool,overview));
    await writeJSON(path.join(out,'data/tool',tool.slug+'.json'),toolDetail(tool,overview,records));
  }
  await writeJSON(path.join(out,'data/tools.json'),{tools:summaries});
}

export async function buildSite({root = ROOT} = {}) {
  const out = path.join(root,'_site');
  if (await exists(out) && !await exists(path.join(out,'.gameref-build'))) throw new Error('Refusing to replace an unmarked _site directory');
  await rm(out,{recursive:true,force:true}); await mkdir(out,{recursive:true}); await writeFile(path.join(out,'.gameref-build'),'generated by tools/build_site.mjs\n');
  const {games} = await json(path.join(root,'catalog/games.json'));
  const {examples} = await json(path.join(root,'catalog/examples.json'));
  const {games:reviews} = await json(path.join(root,'catalog/runnability.json'));
  const {pages,errors,videos} = await loadPages(root);
  const tools = await loadTools(root);
  if (errors.size || pages.size !== games.length) throw new Error('Invalid or missing project pages: '+[...errors.values()].join('; '));
  const {catalog} = await import(pathToFileURL(path.join(root,'webgame-lab/src/catalog.ts')));
  const reports = [], records = [];
  for (const game of games) {
    const config = await json(path.join(root,game.slug,'local.json'));
    const entry = (config.entry || game.entry).replace(/^\//,'');
    if (entry !== game.entry.replace(/^\//,'')) throw new Error(`Entry mismatch: ${game.slug}`);
    const report = await copyRuntime(path.resolve(root,game.slug,config.root),path.join(out,'games',game.slug),BASE+`games/${game.slug}/`,{slug:game.slug});
    if (!await exists(path.join(out,'games',game.slug,entry))) throw new Error(`Missing entry: ${game.slug}/${entry}`);
    reports.push(report);
    records.push({id:`game:${game.slug}`,kind:'project',project:game.slug,title:game.title,launch:{type:'original',url:BASE+`games/${game.slug}/${entry}`}});
  }
  const copied = new Set();
  for (const example of examples) {
    const folder = example.folder || example.id, config = await json(path.join(root,'examples',folder,'local.json'));
    if (!copied.has(folder)) {
      reports.push(await copyRuntime(path.resolve(root,'examples',folder,config.root),path.join(out,'examples',folder),BASE+`examples/${folder}/`,{slug:folder}));
      copied.add(folder);
    }
    const entry = (example.entry && example.entry !== '/' ? example.entry : config.entry || '/index.html').replace(/^\//,'');
    if (!await exists(path.join(out,'examples',folder,entry))) throw new Error(`Missing example entry: ${folder}/${entry}`);
    records.push({id:`example:${example.id}`,kind:'example',project:example.project,title:example.title,launch:{type:'example',folder,url:BASE+`examples/${folder}/${entry}`}});
  }
  const labCategories = {角色:'3c',镜头:'camera',动画:'animation',画面:'rendering',天空:'rendering',植被:'world',世界:'world',水:'water',特效:'effects',NPC:'ai',物理:'physics',基础:'tooling'};
  for (const scene of catalog) records.push({id:`demo:${scene.id}`,kind:'demo',title:scene.name,summary:scene.desc,category:[labCategories[scene.category] || scene.category],launch:{type:'lab',url:BASE+`lab/?scene=${scene.id}&backend=${scene.backend}&embed=1&menu=0&clean=1`}});
  reports.push(await buildLab(root,out));
  await cp(path.join(root,'library'),out,{recursive:true});
  let html = await readFile(path.join(out,'index.html'),'utf8');
  html = html.replace('<head>',`<head><meta name="gameref-base" content="${BASE}">`).replace(/(href|src)="\/(?!\/)/g,`$1="${BASE}`);
  await writeFile(path.join(out,'index.html'),html); await writeFile(path.join(out,'404.html'),html); await writeFile(path.join(out,'.nojekyll'),'');
  // Real directory indexes make README deep links return 200 on Pages; 404.html
  // also boots the router for legacy source/search links and unknown routes.
  for (const route of ['demos','tools',...tools.map(tool=>'t/'+tool.slug),...games.map(game=>'p/'+game.slug)]) {await mkdir(path.join(out,route),{recursive:true});await writeFile(path.join(out,route,'index.html'),html);}
  await cp(path.join(root,'previews'),path.join(out,'previews'),{recursive:true});
  const media = [];
  for (const game of [...games,...tools]) media.push(await prepareVideo(root,game.slug,out));
  const summaries=[];
  for (const game of games) {
    const page=pages.get(game.slug),overview=siteVideo(videos.get(page.overview_video),game.slug),project=records.find(row=>row.id===`game:${game.slug}`);
    const review=reviews.find(row=>row.slug===game.slug);
    summaries.push({...page,examples:page.examples.length,has_example:!!page.examples.length,overview_video:overview,runnability:review ? {reviewed_verdict:review.reviewed_verdict,review_note:review.review_note,review_note_en:review.review_note_en}:null});
    await writeJSON(path.join(out,'data/page',game.slug+'.json'),{...page,project,overview_video:overview,source_url:`https://github.com/0xmariowu/awesome-threejs-games/tree/main/${game.slug}`,examples:page.examples.map(example=>({...example,launch:records.find(row=>row.id===`example:${example.id}`).launch}))});
  }
  await writeToolData(out,tools,videos,records);
  const manifest = await sourceManifest(root, games);
  await writeJSON(path.join(out,'data/src/manifest.json'), manifest);
  for (const file of manifest.filter(f => f.bundled)) {
    const target = path.join(out,'data/src',file.path);
    await mkdir(path.dirname(target),{recursive:true});
    await copyFile(path.join(root,file.path),target);
  }
  const demos=await loadDemos({root,games,records});
  for (const demo of demos.demos) {
    const dir=path.join(out,'demos',demo.id);
    await mkdir(dir,{recursive:true}); await writeFile(path.join(dir,'index.html'),html);
  }
  await writeJSON(path.join(out,'data/index.json'),{schema_version:1,records,thumbnails:[],counts:{project:games.length,tool:tools.length,example:examples.length,demo:catalog.length}});
  await writeJSON(path.join(out,'data/pages.json'),{pages:summaries});
  await writeJSON(path.join(out,'data/demos.json'),demos);
  await writeJSON(path.join(out,'data/runnability.json'),{games:summaries.map(row=>({slug:row.slug,...row.runnability}))});
  await copyFile(path.join(root,'catalog/lab-i18n.json'),path.join(out,'data/lab-i18n.json'));
  await writeJSON(path.join(out,'data/deploy.json'),{base:BASE,media,reports});
  const sizes=validateSizes(await allSizes(out));
  console.table(reports.filter(row=>games.some(game=>game.slug===row.slug)).map(row=>({game:row.slug,scanned_files:row.files,url_files:row.scan.filter(file=>file.absolute_urls.length).length,rewrites:row.rewrites.reduce((sum,r)=>sum+r.count,0),online:row.online})));
  console.table(Object.entries(sizes.groups).map(([folder,bytes])=>({folder,bytes,MB:(bytes/1e6).toFixed(2)})));
  console.log(`Total ${(sizes.total/1e6).toFixed(2)} MB; largest ${sizes.largest.file} (${(sizes.largest.bytes/1e6).toFixed(2)} MB)`);
  return {out,reports,sizes};
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args=process.argv.slice(2); let check=false;
  for (let i=0;i<args.length;i++) {if(args[i]==='--check') check=true; else throw new Error('Usage: node tools/build_site.mjs [--check]');}
  if (check) console.log(`Pages workflow valid; ${(await checkBuildInputs()).files} tracked build inputs checked.`);
  else await buildSite();
}
