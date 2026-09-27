import { readFile, realpath, access, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const json = async file => JSON.parse(await readFile(file, 'utf8'));
export const categoryNames = {
  '3c':'3C', camera:'镜头', character:'角色', physics:'物理', vehicle:'载具',
  rendering:'渲染', water:'水面', terrain:'地形', world:'世界', animation:'动画',
  audio:'声音', gameplay:'玩法', persistence:'存档', performance:'性能',
  ai:'AI / NPC', navigation:'导航', input:'输入', tooling:'工具', assets:'资产',
  networking:'联网', ui:'界面', particles:'粒子', effects:'特效',
  network:'联网', vfx:'特效', combat:'战斗', architecture:'架构', 'ai-boundary':'AI 服务边界',
};
export const categoryNamesEn = {
  '3c':'3C', camera:'Camera', character:'Character', physics:'Physics', vehicle:'Vehicles',
  rendering:'Rendering', water:'Water', terrain:'Terrain', world:'World', animation:'Animation',
  audio:'Audio', gameplay:'Gameplay', persistence:'Save data', performance:'Performance',
  ai:'AI / NPC', navigation:'Navigation', input:'Input', tooling:'Tools', assets:'Assets',
  networking:'Networking', ui:'Interface', particles:'Particles', effects:'Effects',
  network:'Networking', vfx:'Effects', combat:'Combat', architecture:'Architecture', 'ai-boundary':'AI service boundaries',
};
const aliases = {
  '3c':'角色 控制 移动 镜头 相机 camera character control',
  camera:'相机 跟随 镜头 3c', physics:'碰撞 刚体 浮力 物理', water:'水 河 海 浪 ocean wake',
  rendering:'渲染 画面 shader 材质 光照', persistence:'保存 存档 storage save',
  vehicle:'船 车 飞船 载具', gameplay:'玩法 钓鱼 fishing', performance:'性能 优化 卡顿 批次',
  animation:'动画 骨骼', ai:'机器人 寻路 NPC', audio:'声音 音效 音乐', terrain:'地形 世界',
};
const labCategories = {角色:'3c',镜头:'camera',动画:'animation',画面:'rendering',天空:'rendering',植被:'world',世界:'world',水:'water',特效:'effects',NPC:'ai',物理:'physics',基础:'tooling'};
export async function buildIndex(root = ROOT) {
  const games = (await json(path.join(root, 'catalog/games.json'))).games;
  const candidates = (await json(path.join(root, 'catalog/extraction-candidates.json'))).candidates;
  const runtime = (await json(path.join(root,'output/library-research-2026-09-26/runtime-summary.json'))).projects;
  const links = await json(path.join(root, 'catalog/lab-links.json'));
  const labRoot = path.resolve(root, links.lab_root);
  let demos = [], labError = null;
  try { demos = (await import(pathToFileURL(path.join(labRoot, 'src/catalog.ts')))).catalog; }
  catch (error) { labError = `Existing lab unavailable: ${error.code || error.message}`; }
  let extractions = [];
  try { extractions = (await json(path.join(root, 'catalog/examples.json'))).examples; }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  let labTranslations = {};
  try { labTranslations = await json(path.join(root, 'catalog/lab-i18n.json')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const files = new Map();
  async function ref(relative, base = root, expected) {
    const key = `${base}:${relative}`;
    if (!files.has(key)) files.set(key, (async () => {
      try {
        const absolute = await realpath(path.resolve(base, relative));
        const boundary = path.relative(await realpath(base), absolute);
        if (boundary.startsWith('..') || path.isAbsolute(boundary)) throw new Error('Outside source root');
        const bytes = await readFile(absolute);
        return {path:relative, scope:base === root ? 'gameref':'webgame-lab', sha256:sha256(bytes), bytes:bytes.length, available:true};
      } catch { return {path:relative, scope:base === root ? 'gameref':'webgame-lab', available:false}; }
    })());
    const current = await files.get(key);
    return {...current, ...(expected ? {expected_sha256:expected, fresh:current.sha256 === expected}:{fresh:null})};
  }
  const backend = game => /webgpu/i.test(game.stack.join(' ')) ? 'webgpu' : 'webgl';
  const projectMap = new Map(games.map(game => [game.slug, game]));
  const records = [];
  for (const game of games) {
    const sources = await Promise.all([game.readme,game.technical].map(file => ref(file)));
    records.push({id:`game:${game.slug}`, kind:'project', project:game.slug, title:game.title,
      summary:game.stack.join(' · '), category:[], backend:backend(game), maturity:'original-archive',
      status:game.status, limitations:game.limitations, source_type:game.source_type,
      origin:game.source, license:game.license_note || 'See the original project license and asset notices.',
      sources, evidence:[game.audit], parity:game.parity, dependencies:game.stack,
      launch:{type:'original',id:game.slug,url:`http://127.0.0.1:${game.port}${game.entry}`,command:`node tools/server.mjs ${game.slug}`}});
  }
  for (const candidate of candidates) {
    const game = projectMap.get(candidate.project);
    const relatedDemos = links.links.filter(link => link.candidate === candidate.id).map(link => ({id:`demo:${path.basename(link.demo,'.tsx')}`,relationship:link.relationship}));
    const examples = extractions.filter(example => example.candidates.includes(candidate.id));
    records.push({id:candidate.id,kind:'capability',project:candidate.project,title:candidate.title,
      summary:candidate.observed_mechanism,category:candidate.category,backend:backend(game),
      maturity:'source-inspected',priority:candidate.priority,boundary:candidate.proposed_boundary,
      dependencies:candidate.dependencies,verification:candidate.proposed_verification,
      limitations:game.limitations,source_type:game.source_type,origin:game.source,
      sources:await Promise.all(candidate.source_refs.map(source => ref(source.path,root,source.sha256))),
      related:[{id:`game:${candidate.project}`,relationship:'Original game'},...relatedDemos,...examples.map(example => ({id:`example:${example.id}`,relationship:example.scope}))],
      evidence:[game.audit], extraction_verified:candidate.extraction_verified});
  }
  for (const demo of demos) {
    const link = links.links.find(link => path.basename(link.demo,'.tsx') === demo.id);
    records.push({id:`demo:${demo.id}`,kind:'demo',project:link?.candidate.split('.')[0] || 'webgame-lab',
      title:demo.name,summary:demo.desc,title_en:labTranslations[demo.id]?.name_en,summary_en:labTranslations[demo.id]?.desc_en,category:[labCategories[demo.category] || demo.category],
      backend:demo.backend,maturity:'existing-demo',origin:demo.source,
      limitations:demo.note || 'Existing lab example; this catalog does not certify original-game parity or all browser backends.',
      dependencies:['webgame-lab', 'React / React Three Fiber', 'Three.js'],
      sources:[await ref(`src/scenes/${demo.id}.tsx`,labRoot,link?.sha256)],
      related:link ? [{id:link.candidate,relationship:link.relationship}] : [],
      launch:{type:'lab',id:demo.id,url:`http://127.0.0.1:5199/?scene=${encodeURIComponent(demo.id)}&backend=${demo.backend}&menu=0&clean=1&embed=1`,command:`cd ../webgame-lab && npm run dev -- --host 127.0.0.1 --port 5199 --strictPort`}});
  }
  for (const example of extractions) records.push({id:`example:${example.id}`,kind:'example',project:example.project,
    title:example.title,summary:example.scope,category:example.category,backend:'none',maturity:example.maturity,
    dependencies:example.dependencies,limitations:example.limitations,verification:example.verify,
    sources:await Promise.all(example.files.map(source => ref(source.path,root,source.sha256))),
    related:example.candidates.map(id => ({id,relationship:'Source analysis'})),evidence:example.evidence,
    launch:{type:'example',id:example.id,folder:example.folder ?? example.id,
      url:`http://127.0.0.1:${example.port}${example.entry ?? '/'}`,command:`node tools/server.mjs examples/${example.folder ?? example.id}`}});
  for (const record of records) {
    record.category=[...new Set(record.category.map(value=>({vfx:'effects',network:'networking'}[value]||value)))];
    record.project_title = projectMap.get(record.project)?.title || 'Webgame Lab';
    record.source_freshness = record.sources.some(source => !source.available || source.fresh === false) ? 'stale-or-missing' : 'current';
    const capture = runtime.find(row=>row.slug===record.project);
    const evidencePaths = [...new Set([...(record.evidence||[]),...(capture && ['project','capability'].includes(record.kind) ? [capture.evidence]:[])])];
    record.evidence_refs = await Promise.all(evidencePaths.map(async relative=>{
      try {
        const file=path.resolve(root,relative),info=await stat(file);
        return {path:relative,available:true,modified_at:info.mtime.toISOString(),
          ...(capture?.evidence===relative ? {completed:capture.completed,full_game_verified:false}:{}),
          scope:'Recorded observation; timestamp is not proof that every current source or behavior was exercised.'};
      } catch {return {path:relative,available:false};}
    }));
  }
  const thumbnails = {};
  for (const game of games) {
    const choices = [
      `output/library-development-2026-09-26/${game.slug}/gameplay.png`,
      `output/library-research-2026-09-26/${game.slug}/local/gameplay.png`,
      `output/library-research-2026-09-26/${game.slug}/local/moving.png`,
    ];
    for (const choice of choices) { try { await access(path.join(root,choice)); thumbnails[game.slug]=choice;break; } catch {} }
  }
  return {schema_version:1, generated_at:new Date().toISOString(), root, labRoot, labError, games, extractions,
    records, thumbnails, category_names:categoryNames, category_names_en:categoryNamesEn,
    counts:Object.fromEntries(['project','capability','demo','example'].map(kind => [kind,records.filter(record=>record.kind===kind).length]))};
}

export function search(index, {q='',kind='',category='',project='',backend='',maturity=''} = {}) {
  const words = q.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return index.records.filter(record => (!kind || record.kind===kind) && (!category || record.category.includes(category))
    && (!project || record.project===project) && (!backend || record.backend===backend) && (!maturity || record.maturity===maturity)
    && words.every(word => [record.id,record.title,record.summary,record.project_title,record.origin,...record.category,
      ...record.category.map(value=>categoryNames[value]),...record.category.map(value=>aliases[value]),...(record.dependencies||[])].join(' ').toLocaleLowerCase().includes(word)));
}

export async function readSource(index, id, number) {
  const record = index.records.find(record=>record.id===id);
  if (!record || !Number.isSafeInteger(number) || number < 0 || !record.sources[number]) throw new Error('Unknown catalog source');
  const source = record.sources[number];
  if (!source.available) throw new Error('Source unavailable');
  const base = await realpath(source.scope==='gameref' ? index.root : index.labRoot);
  const absolute = await realpath(path.resolve(base,source.path));
  const relative = path.relative(base,absolute);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Outside source root');
  const bytes = await readFile(absolute);
  return {...source,sha256:sha256(bytes),fresh:source.expected_sha256 ? sha256(bytes)===source.expected_sha256 : null,
    truncated:bytes.length>2_000_000,content:bytes.subarray(0,2_000_000).toString('utf8')};
}

export function context(index, id) {
  const record = index.records.find(record=>record.id===id);
  if (!record) throw new Error('Unknown catalog record');
  return {schema_version:1, generated_at:index.generated_at,
    guidance:'Read pinned sources and limitations before reuse. Source-inspected candidates are not extracted packages. Existing lab demos are adaptations. Preserve original behavior and graphics; do not invent missing servers. Verify source hashes before editing.',
    record,related:(record.related||[]).map(link=>({relationship:link.relationship,record:index.records.find(record=>record.id===link.id)})),
    verify_sources:'node tools/library-cli.mjs verify', source_command:`node tools/library-cli.mjs source ${id} 0`};
}
