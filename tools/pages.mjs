import { readFile, readdir, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT, sha256 } from './library-index.mjs';

const json = async file => JSON.parse(await readFile(file, 'utf8'));
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const string = value => typeof value === 'string' && value.trim().length > 0;
const categories = ['飞行探索','赛车','开放世界动作','战斗','城镇与生活','风景与氛围','其他引擎'];
const pageFields = new Set(['schema_version','slug','title','tagline','tagline_en','category','overview_video','examples']);
const exampleFields = new Set(['id','title','title_en','one_liner','one_liner_en','candidate']);
function required(value, label, error, max) {
  if (!string(value)) { error(`${label} must be a non-empty string`); return false; }
  if (max !== undefined && [...value].length > max) error(`${label} exceeds ${max} characters`);
  return true;
}
function array(value, label, error) {
  if (!Array.isArray(value)) { error(`${label} must be an array`); return []; }
  return value;
}
function pageStructure(page, slug, error, examples, candidates) {
  if (!object(page)) { error('page must be an object'); return; }
  if (page.schema_version !== 3) { error('schema_version 3 required (see tools/pages.mjs)'); return; }
  for (const field of Object.keys(page)) if (!pageFields.has(field)) error(`unknown field ${field}`);
  if (page.slug !== slug) error('slug must match page filename');
  for (const field of ['slug','title']) required(page[field],field,error);
  required(page.tagline,'tagline',error,40);
  required(page.tagline_en,'tagline_en',error);
  if (!categories.includes(page.category)) error('category is invalid');
  if (page.overview_video !== null && page.overview_video !== `${slug}/overview`)
    error('overview_video must be <slug>/overview or null');
  const seen = new Set();
  for (const [i,example] of array(page.examples,'examples',error).entries()) {
    const issue = message => error(`examples[${i}]: ${message}`);
    if (!object(example)) { issue('must be an object'); continue; }
    for (const field of Object.keys(example)) if (!exampleFields.has(field)) issue(`unknown field ${field}`);
    if (required(example.id,'id',issue)) {
      if (seen.has(example.id)) issue(`duplicate example id ${example.id}`);
      seen.add(example.id);
      const entry = examples.get(example.id);
      if (!entry) issue(`unknown example id ${example.id}`);
      else if (entry.project !== slug) issue(`example belongs to another project: ${example.id}`);
    }
    required(example.title,'title',issue,16);
    required(example.title_en,'title_en',issue,60);
    required(example.one_liner_en,'one_liner_en',issue,110);
    required(example.one_liner,'one_liner',issue,40);
    if (required(example.candidate,'candidate',issue) && candidates.get(example.candidate)?.project !== slug)
      issue(`unknown candidate or wrong project: ${example.candidate}`);
  }
}
const inside = (base, file) => {
  const relative = path.relative(base,file);
  return relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
};

export async function loadCandidates(root = ROOT) {
  const data = await json(path.join(root,'catalog/extraction-candidates.json'));
  if (!Array.isArray(data.candidates) || data.candidates.some(row=>!object(row) || !string(row.id) || !string(row.project)))
    throw new Error('extraction-candidates.json must contain a candidates array with ids and projects');
  return data.candidates;
}

async function loadExamples(root) {
  const data = await json(path.join(root,'catalog/examples.json'));
  if (!Array.isArray(data.examples) || data.examples.some(row=>!object(row) || !string(row.id) || !string(row.project)))
    throw new Error('examples.json must contain an examples array with ids and projects');
  return data.examples;
}

async function readData(root, slug, report) {
  const pages = new Map(), errors = new Map();
  let names = [];
  try { names = await readdir(path.join(root,'catalog/pages')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  for (const name of names.filter(name=>name.endsWith('.json')).sort()) {
    const id = name.slice(0,-5);
    if (slug !== undefined && id !== slug) continue;
    try { pages.set(id,await json(path.join(root,'catalog/pages',name))); }
    catch (error) {
      const message = `${id}: cannot read page: ${error instanceof SyntaxError ? 'invalid JSON' : error.code || 'read failed'}`;
      errors.set(id,message); report?.(message);
    }
  }
  let videos = {schema_version:1,videos:[]};
  try { videos = await json(path.join(root,'catalog/videos.json')); }
  catch (error) {
    if (error.code !== 'ENOENT') {
      if (!report) throw error;
      report(`videos: cannot read catalog: ${error.message}`);
    }
  }
  return {pages,errors,videoData:videos};
}

export async function loadPages(root = ROOT) {
  const {pages,errors,videoData} = await readData(root);
  const examples = new Map((pages.size ? await loadExamples(root) : []).map(row=>[row.id,row]));
  const candidates = new Map((pages.size ? await loadCandidates(root) : []).map(row=>[row.id,row]));
  for (const [slug,page] of pages) {
    const issues = [];
    pageStructure(page,slug,message=>issues.push(message),examples,candidates);
    if (issues.length) {
      pages.delete(slug); errors.set(slug,`${slug}: invalid page structure: ${issues.join('; ')}`);
    }
  }
  if (!object(videoData) || !Array.isArray(videoData.videos)) throw new Error('videos: expected a videos array');
  return {pages,errors,videos:new Map(videoData.videos.map(video=>[video.id,video]))};
}

async function validate(root, {slug, requireVideos = false, videosOnly = false} = {}) {
  const result = {errors:[],warnings:[],checked:[]};
  const fail = message => result.errors.push(message);
  let pages, videoData, games, candidates, examples;
  try {
    ({pages,videoData} = await readData(root,slug,fail));
    games = (await json(path.join(root,'catalog/games.json'))).games;
    if (!Array.isArray(games)) throw new Error('games.json must contain a games array');
    candidates = await loadCandidates(root);
    examples = !videosOnly ? await loadExamples(root) : [];
    root = await realpath(root);
  } catch (error) { fail(`${slug ?? 'videos'}: cannot load catalog: ${error.message}`); return result; }
  const projects = new Set(games.map(game=>game.slug));
  const candidateMap = new Map(candidates.map(row=>[row.id,row]));
  const exampleMap = new Map(examples.map(row=>[row.id,row]));
  // Port ownership is global, even when checking just one project's page.
  const ports = new Map(), gamePorts = new Set(games.map(game=>game.port));
  const referenced = new Set([...pages.values()].flatMap(page=>
    Array.isArray(page?.examples) ? page.examples.map(example=>example?.id) : []));
  for (const example of examples) {
    const error = message => fail(`examples: ${example.id}: ${message}`);
    const folder = example.folder ?? example.id, entry = example.entry === undefined ? '/' : example.entry;
    if (gamePorts.has(example.port)) error(`port ${example.port} conflicts with a game port`);
    if (ports.has(example.port) && ports.get(example.port) !== folder)
      error(`port ${example.port} is shared by different example folders`);
    ports.set(example.port,folder);
    if (!referenced.has(example.id)) continue;
    if (!Number.isInteger(example.port) || example.port < 1024 || example.port > 65535)
      error('port must be an integer from 1024 to 65535');
    if (typeof entry !== 'string' || !entry.startsWith('/') || entry.includes('..'))
      error('entry must start with / and contain no ..');
    if (typeof folder !== 'string' || !/^[a-z0-9-]+$/.test(folder)) {
      error('folder must match /^[a-z0-9-]+$/');
      continue;
    }
    try {
      const directory = await realpath(path.join(root,'examples',folder));
      if (!inside(path.join(root,'examples'),directory) || !(await stat(directory)).isDirectory()) {
        error('folder must be a directory under examples/');
        continue;
      }
      const local = await json(path.join(directory,'local.json'));
      if (example.port !== local.port) error('port must match local.json port');
    } catch (cause) { error(`cannot access folder or local.json: ${cause.code || cause.message}`); }
  }
  if (slug !== undefined && !projects.has(slug)) fail(`${slug}: unknown project`);
  if (!videosOnly && slug !== undefined && !pages.has(slug)) fail(`${slug}: page file does not exist`);

  async function reference(relative, prefix, label, error) {
    if (!required(relative,label,error)) return;
    if (path.isAbsolute(relative) || relative.includes('\\') || relative.includes('\0') ||
        relative.split('/').some(part=>part === '..' || part === '.' || !part) || !relative.startsWith(prefix)) {
      error(`${label}: invalid path ${relative}; expected a relative path under ${prefix} without traversal`); return;
    }
    try {
      const boundary = root, absolute = await realpath(path.resolve(root,relative));
      if (!inside(boundary,absolute)) { error(`${label}: path escapes root: ${relative}`); return; }
      const info = await stat(absolute);
      if (!info.isFile()) {
        error(`${label}: expected file: ${relative}`); return;
      }
      return absolute;
    } catch (cause) { error(`${label}: cannot access ${relative}: ${cause.code || cause.message}`); }
  }

  const videoError = message => fail(`videos: ${message}`);
  if (!object(videoData) || videoData.schema_version !== 1) videoError('schema_version must be 1');
  const videos = array(videoData?.videos,'videos',videoError), seenVideos = new Set();
  const videoMap = new Map();
  for (const video of videos) {
    if (slug !== undefined && object(video) && video.project !== slug) continue;
    if (!object(video)) { videoError('video must be an object'); continue; }
    const error = message => videoError(`${video.id ?? '(unknown)'}: ${message}`);
    if (required(video.id,'id',error) && !/^[a-z0-9][a-z0-9_-]*\/[a-z0-9][a-z0-9_-]*$/i.test(video.id)) error('id must have form <project>/<shot>');
    if (seenVideos.has(video.id) || videos.some(other=>other !== video && other?.id === video.id)) error(`duplicate video id ${video.id}`);
    seenVideos.add(video.id); videoMap.set(video.id,video);
    if (!projects.has(video.project)) error('unknown project');
    if (typeof video.id === 'string' && video.id.split('/')[0] !== video.project) error('id project does not match project');
    if (video.module !== null && candidateMap.get(video.module)?.project !== video.project) error('module must be null or a candidate of this project');
    for (const field of ['duration','fps','width','height']) {
      if (!Number.isFinite(video[field]) || video[field] <= 0 || (['width','height'].includes(field) && !Number.isSafeInteger(video[field]))) error(`${field} must be a positive ${['width','height'].includes(field) ? 'integer':'number'}`);
    }
    if (!Number.isSafeInteger(video.bytes) || video.bytes < 0) error('bytes must be a non-negative integer');
    if (!/^[a-f0-9]{64}$/.test(video.sha256)) error('sha256 must be a SHA-256 hex digest');
    for (const field of ['recorded_at','scenario','method']) required(video[field],field,error);
    if (string(video.recorded_at) && (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(video.recorded_at) || !Number.isFinite(Date.parse(video.recorded_at)))) error('recorded_at must be an ISO-8601 timestamp');
    const prefix = `media/${video.project}/`;
    const file = await reference(video.file,prefix,'file',error);
    if (file) {
      const bytes = await readFile(file);
      if (bytes.length !== video.bytes) error('file bytes mismatch');
      if (sha256(bytes) !== video.sha256) error('file sha256 mismatch');
    }
    await reference(video.poster,prefix,'poster',error);
    if (video.preview !== undefined) {
      const preview = await reference(video.preview,prefix,'preview',error);
      if (video.preview_sha256 !== undefined && !/^[a-f0-9]{64}$/.test(video.preview_sha256)) error('preview_sha256 must be a SHA-256 hex digest');
      if (video.preview_bytes !== undefined && (!Number.isSafeInteger(video.preview_bytes) || video.preview_bytes < 0)) error('preview_bytes must be a non-negative integer');
      if (preview) {
        const bytes = await readFile(preview);
        if (video.preview_bytes !== undefined && bytes.length !== video.preview_bytes) error('preview bytes mismatch');
        if (video.preview_sha256 !== undefined && sha256(bytes) !== video.preview_sha256) error('preview sha256 mismatch');
      }
    }
    const captions = await reference(video.captions,prefix,'captions',error);
    if (captions && !(await readFile(captions,'utf8')).startsWith('WEBVTT')) error('captions must start with WEBVTT');
    if (!result.checked.includes(video.project)) result.checked.push(video.project);
  }

  for (const [id,page] of pages) {
    const error = message => fail(`${id}: ${message}`);
    if (!result.checked.includes(id)) result.checked.push(id);
    if (!object(page)) { error('page must be an object'); continue; }
    if (!videosOnly) {
      pageStructure(page,id,error,exampleMap,candidateMap);
      if (page.schema_version !== 3) continue;
      if (!projects.has(id)) error('slug does not exist in games.json');
    }
    if (page.overview_video !== null && required(page.overview_video,'overview_video',error)) {
      const video = videoMap.get(page.overview_video);
      if (!video) (requireVideos ? result.errors:result.warnings).push(`${id}: missing video ${page.overview_video} (overview_video)`);
      else if (video.project !== id) error(`overview_video: video ${page.overview_video} belongs to another project`);
    }
  }
  result.checked.sort();
  return result;
}

export const checkPages = (root = ROOT, options = {}) => validate(root,options);
export const checkVideos = (root = ROOT, slug) => validate(root,{slug,requireVideos:true,videosOnly:true});

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const [command,...args] = process.argv.slice(2), positional = args.filter(arg=>!arg.startsWith('--'));
  if (!['check','check-videos'].includes(command) || positional.length > 1 ||
      args.some(arg=>arg.startsWith('--') && (arg !== '--require-videos' || command !== 'check')) ||
      (command === 'check-videos' && positional.length !== 1)) {
    console.error('Usage: node tools/pages.mjs check [slug] [--require-videos] | check-videos <slug>');
    process.exitCode = 1;
  } else {
    const result = command === 'check-videos' ? await checkVideos(ROOT,positional[0]) : await checkPages(ROOT,{slug:positional[0],requireVideos:args.includes('--require-videos')});
    for (const message of result.errors) console.error(`${message} (error)`);
    for (const message of result.warnings) console.warn(`${message} (warning)`);
    console.log(`Checked ${result.checked.length} project(s): ${result.errors.length} error(s), ${result.warnings.length} warning(s)`);
    process.exitCode = result.errors.length ? 1:0;
  }
}
