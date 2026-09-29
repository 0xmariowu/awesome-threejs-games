import {readFile, realpath} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const fields = new Set(['slug','title','hosted','author','author_url','url','terms_url','about_url','tagline','tagline_en','facts','features','steps','can','cannot','license_note','license_note_zh','overview_video','examples']);
const exampleFields = new Set(['id','title','title_en','one_liner','one_liner_en','candidate']);

export function validateTools(data, examples = []) {
  const errors = [], seen = new Set(), catalog = new Map(examples.map(row => [row.id,row]));
  const fail = message => errors.push(message);
  const text = (value, label, max) => {
    if (typeof value !== 'string' || !value.trim()) fail(`${label} must be a non-empty string`);
    else if ([...value].length > max) fail(`${label} exceeds ${max} characters`);
  };
  const rows = (value, label, count) => {
    if (!Array.isArray(value)) { fail(`${label} must be an array`); return []; }
    if (count !== undefined && value.length !== count) fail(`${label} must contain ${count} entries`);
    return value;
  };
  if (!object(data) || data.schema_version !== 1) fail('tools schema_version must be 1');
  for (const [i, tool] of rows(data?.tools,'tools').entries()) {
    const label = `tools[${i}]`;
    if (!object(tool)) { fail(`${label} must be an object`); continue; }
    for (const field of Object.keys(tool)) if (!fields.has(field)) fail(`${label}: unknown field ${field}`);
    for (const [field,max] of [['slug',80],['title',80],['author',120],['tagline',40],['tagline_en',160],['license_note',1000],['license_note_zh',400]]) text(tool[field],`${label}.${field}`,max);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(tool.slug)) fail(`${label}: invalid slug`);
    if (seen.has(tool.slug)) fail(`${label}: duplicate slug ${tool.slug}`);
    seen.add(tool.slug);
    if (tool.hosted !== undefined && typeof tool.hosted !== 'boolean') fail(`${label}.hosted must be a boolean`);
    for (const field of ['url','terms_url','author_url',...(tool.about_url === undefined ? []:['about_url'])]) {
      text(tool[field],`${label}.${field}`,2048);
      try { const url = new URL(tool[field]); if (url.protocol !== 'https:' || url.username || url.password) throw new Error(); }
      catch { fail(`${label}.${field} must be an https URL without credentials`); }
    }
    if (tool.overview_video !== `${tool.slug}/overview`) fail(`${label}.overview_video must be <slug>/overview`);
    for (const [field,count] of [['facts',3],['steps',3],['can',1],['cannot',1]]) {
      for (const [j,row] of rows(tool[field],`${label}.${field}`,count).entries()) {
        for (const lang of ['zh','en']) text(row?.[lang],`${label}.${field}[${j}].${lang}`,field === 'facts' ? 60 : 240);
      }
    }
    for (const [j,row] of rows(tool.features,`${label}.features`,4).entries()) {
      for (const [field,max] of [['title',16],['title_en',60],['desc',80],['desc_en',240]]) text(row?.[field],`${label}.features[${j}].${field}`,max);
    }
    const ids = new Set();
    for (const [j,row] of rows(tool.examples,`${label}.examples`).entries()) {
      const prefix = `${label}.examples[${j}]`;
      if (!object(row)) { fail(`${prefix} must be an object`); continue; }
      for (const field of Object.keys(row)) if (!exampleFields.has(field)) fail(`${prefix}: unknown field ${field}`);
      for (const [field,max] of [['id',100],['title',16],['title_en',60],['one_liner',40],['one_liner_en',110],['candidate',120]]) text(row[field],`${prefix}.${field}`,max);
      if (ids.has(row.id)) fail(`${prefix}: duplicate example id ${row.id}`);
      ids.add(row.id);
      if (!catalog.has(row.id)) fail(`${prefix}: unknown example id ${row.id}`);
      else if (catalog.get(row.id).project !== tool.slug) fail(`${prefix}: example belongs to another project`);
    }
  }
  return errors;
}

export async function loadTools(root = ROOT) {
  const data = JSON.parse(await readFile(path.join(root,'catalog/tools.json'),'utf8'));
  const {examples} = JSON.parse(await readFile(path.join(root,'catalog/examples.json'),'utf8'));
  const errors = validateTools(data,examples);
  if (errors.length) throw new Error(errors.join('; '));
  return Promise.all(data.tools.map(async tool => {
    let local;
    try { local = JSON.parse(await readFile(path.join(root,tool.slug,'local.json'),'utf8')); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (tool.hosted && !local) throw new Error(`Missing local.json for hosted tool: ${tool.slug}`);
    if (!local) return tool;
    const safe = value => typeof value === 'string' && !/[\\\0%?#]/.test(value) &&
      value.split('/').every(part => part && part !== '..' && !part.startsWith('.'));
    if (!object(local) || !(local.root === '.' || safe(local.root)) ||
        typeof local.entry !== 'string' || !local.entry.startsWith('/') || !safe(local.entry.slice(1)) ||
        !Number.isInteger(local.port) || local.port < 1 || local.port > 65535)
      throw new Error(`Invalid local.json for tool: ${tool.slug}`);
    const folder = await realpath(path.join(root,tool.slug));
    const source = await realpath(path.resolve(folder,local.root));
    const relative = path.relative(folder,source);
    if (relative === '..' || relative.startsWith('..'+path.sep) || path.isAbsolute(relative))
      throw new Error(`Tool runtime outside archive: ${tool.slug}`);
    return {...tool,local,...(tool.hosted ? {launch:{type:'tool',url:`http://127.0.0.1:${local.port}${local.entry}`}} : {})};
  }));
}

const launchFor = (tool, records) => tool.hosted ? records.find(row=>row.id===`tool:${tool.slug}`)?.launch ?? tool.launch ?? null : null;
export function hostedToolURL(tool, base) {
  return base+`tools-app/${tool.slug}/${tool.local.entry.slice(1)}`;
}
export function toolSummary(tool, overview, records = []) {
  const {slug,title,tagline,tagline_en,facts,url,terms_url,hosted} = tool;
  return {slug,title,tagline,tagline_en,facts,url,terms_url,hosted:!!hosted,launch:launchFor(tool,records),overview_video:overview,examples:tool.examples.length};
}
export function toolDetail(tool, overview, records = []) {
  const {local,launch,...metadata} = tool;
  return {...metadata,launch:launchFor(tool,records),overview_video:overview,examples:tool.examples.map(example => ({...example,
    launch:records.find(row=>row.id===`example:${example.id}`)?.launch ?? null}))};
}
