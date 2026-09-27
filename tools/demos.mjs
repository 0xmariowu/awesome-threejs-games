import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { loadPages } from './pages.mjs';

const demoCategories = [
  ['camera','镜头与操控','Camera & controls',['3c','camera','input']],
  ['vehicle','载具与物理','Vehicles & physics',['vehicle','physics']],
  ['combat','战斗','Combat',['combat']],
  ['ai','AI 与群体','AI & crowds',['ai','navigation']],
  ['animation','角色与动画','Characters & animation',['animation','character']],
  ['rendering','画面与后期','Rendering & post-processing',['rendering','ui']],
  ['water','水面','Water',['water']],
  ['effects','特效与粒子','Effects & particles',['effects','vfx','particles']],
  ['world','世界与地形','World & terrain',['world','terrain']],
  ['gameplay','玩法与规则','Gameplay & rules',['gameplay','persistence']],
  ['tooling','资产与工具','Assets & tools',['assets','tooling','performance','architecture','networking']],
];
const demoCategory = categories => {
  for (const category of categories || []) {
    const match = demoCategories.find(([, , , aliases]) => aliases.includes(category));
    if (match) return match[0];
  }
  return 'tooling';
};
const github = 'https://github.com/0xmariowu/awesome-threejs-games';
export async function loadDemos(index) {
  const {pages} = await loadPages(index.root);
  const translations = !index.labError && index.records.some(row=>row.kind==='demo' && row.id!=='demo:boot')
    ? JSON.parse(await readFile(path.join(index.root,'catalog/lab-i18n.json'),'utf8')) : {};
  const examples = new Map(JSON.parse(await readFile(path.join(index.root,'catalog/examples.json'),'utf8')).examples.map(row=>[row.id,row]));
  const demos = [];
  for (const page of pages.values()) for (const entry of page.examples) {
    const example = examples.get(entry.id), id = `example:${entry.id}`;
    demos.push({id,kind:'example',title:entry.title,one_liner:entry.one_liner,title_en:entry.title_en,one_liner_en:entry.one_liner_en,
      source_label:index.games.find(game=>game.slug===page.slug)?.title || page.title,
      source_url:`${github}/tree/main/examples/${example.folder ?? example.id}`,
      category:demoCategory(example.category),launch_id:id,launch:index.records.find(row=>row.id===id)?.launch});
  }
  if (!index.labError) for (const record of index.records.filter(row=>row.kind==='demo' && row.id!=='demo:boot')) {
    const translation = translations[record.id.slice(5)];
    if (!translation?.name_en?.trim() || !translation?.desc_en?.trim()) throw new Error(`Missing Lab translation: ${record.id}`);
    const summary = (record.summary || '').trim();
    demos.push({id:record.id,kind:'lab',title:record.title,title_en:translation.name_en,one_liner_en:translation.desc_en,
      one_liner:summary.match(/^.*?(?:[。！？]|[.!?](?=\s|$))/u)?.[0] || summary,
      source_label:'Webgame Lab',source_url:`${github}/blob/main/webgame-lab/src/scenes/${record.id.slice(5)}.tsx`,
      category:demoCategory(record.category),launch_id:record.id,launch:record.launch});
  }
  return {categories:demoCategories.filter(([key])=>demos.some(demo=>demo.category===key)).map(([key,label,label_en])=>({key,label,label_en})),
    demos,...(index.labError ? {lab_error:index.labError}:{})};
}

// The source browser lists tracked repository text only. A small, explicit subset
// is bundled; the rest is read directly from raw.githubusercontent.com on demand.
export async function sourceManifest(root, games) {
  const {execFileSync} = await import('node:child_process');
  const {lstat} = await import('node:fs/promises');
  const tracked = execFileSync('git', ['ls-files', '-z'], {cwd: root, encoding: 'utf8', maxBuffer: 30_000_000}).split('\0').filter(Boolean);
  const roots = new Set(games.map(g => g.slug));
  const result = [];
  for (const file of tracked.sort()) {
    const parts = file.split('/'), name = parts.at(-1);
    if (!(roots.has(parts[0]) || parts[0] === 'examples' || parts[0] === 'webgame-lab')) continue;
    if (parts.some(p => p.startsWith('.') || ['node_modules','output','screenshots'].includes(p))) continue;
    const absolute = path.join(root, file), info = await lstat(absolute);
    if (!info.isFile()) continue;
    const bytes = await readFile(absolute);
    if (bytes.includes(0)) continue;
    try { new TextDecoder('utf-8', {fatal: true}).decode(bytes); } catch { continue; }
    const bundled = /^(?:readme(?:\.[\w-]+)?\.md|technical\.md)$/i.test(name) ||
      (parts[0] === 'examples' && !parts.some(p => ['original','assets','vendor','node_modules','lib'].includes(p)) &&
        (parts[2] === 'src' || (parts.length <= 4 && /^(?:index\.html|(?:app|main|host)\.[cm]?js|style\.css)$/.test(name)))) ||
      file.startsWith('webgame-lab/src/scenes/');
    result.push({path: file, size: info.size, bundled});
  }
  return result;
}
