import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, copyFile, rm, access } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { generateReadme, generateReadmes } from './readme.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const SITE = 'https://0xmariowu.github.io/awesome-threejs-games/';
const categories = [
  ['camera', '镜头与操控', 'Camera & controls'],
  ['vehicle', '载具与物理', 'Vehicles & physics'],
  ['combat', '战斗', 'Combat'],
  ['ai', 'AI 与群体', 'AI & crowds'],
  ['animation', '角色与动画', 'Characters & animation'],
  ['rendering', '画面与后期', 'Rendering & post-processing'],
  ['water', '水面', 'Water'],
  ['effects', '特效与粒子', 'Effects & particles'],
  ['world', '世界与地形', 'World & terrain'],
  ['gameplay', '玩法与规则', 'Gameplay & rules'],
  ['tooling', '资产与工具', 'Assets & tools'],
];
const decode = text => text.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
const section = (text, heading) => text.split(`## ${heading}\n\n`)[1].split('\n## ')[0];
const links = text => [...text.matchAll(/(?:href|src)="([^"]+)"|\]\(([^)]+)\)/g)].map(match => decode(match[1] || match[2]));

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'gameref-readme-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const write = async (file, contents) => {
    const destination = path.join(root, file);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, contents);
  };
  const save = (file, data) => write(file, JSON.stringify(data));
  const games = ['z-game', 'a-game', 'm-game'].map((slug, index) => ({
    slug, title: `Catalog ${index}`, entry: index ? '/index.html' : '/nested/play/index.html',
    source: `https://example.com/${slug}`, license_note: index ? undefined : 'MIT source; preserve asset credits.',
  }));
  const pages = games.map((game, index) => ({
    schema_version: 3, slug: game.slug, title: `Game ${index}`, tagline: '探索世界',
    tagline_en: 'Explore a world.', category: '飞行探索', overview_video: null, examples: [],
  }));
  pages[1].examples = [
    { id: 'water', title: '水面演示', title_en: 'Water demo', one_liner: '水面', one_liner_en: 'Water', candidate: 'a-game.water' },
    { id: 'camera', title: '镜头演示', title_en: 'Camera demo', one_liner: '镜头', one_liner_en: 'Camera', candidate: 'a-game.camera' },
  ];
  const flushPages = () => Promise.all(pages.map(page => save(`catalog/pages/${page.slug}.json`, page)));
  await save('catalog/games.json', { games });
  await save('catalog/tools.json', {schema_version:1,tools:[]});
  await save('catalog/examples.json', { examples: [
    { id: 'water', project: 'a-game', category: ['water'], folder: 'shared-host' },
    { id: 'camera', project: 'a-game', category: ['camera'] },
    { id: 'unused', project: 'a-game', category: ['combat'] },
  ] });
  await save('catalog/extraction-candidates.json', { candidates: pages[1].examples.map(row => ({ id: row.candidate, project: 'a-game' })) });
  await save('catalog/runnability.json', { games: [] });
  await save('catalog/lab-i18n.json', { ocean: { name_en: 'Ocean scene', desc_en: 'Ocean water.' } });
  await write('webgame-lab/src/catalog.ts', `export const catalog = [
    { id: 'boot', name: '启动', category: '基础', desc: '' },
    { id: 'ocean', name: '海洋场景', category: '水', desc: '海洋。' },
  ];`);
  await flushPages();
  return { root, games, pages, write, save, flushPages };
}

test('both languages have switches, a centered header, and two-column cards in home/catalog order', async t => {
  const f = await fixture(t);
  const outputs = await generateReadmes(f.root);
  assert.deepEqual(Object.keys(outputs), ['README.md', 'README.zh-CN.md']);
  assert.equal(outputs['README.md'].split('\n')[0], '**English** · [简体中文](README.zh-CN.md)');
  assert.equal(outputs['README.zh-CN.md'].split('\n')[0], '[English](README.md) · **简体中文**');
  for (const text of Object.values(outputs)) {
    assert.match(text, /<div align="center">\n<h1>Awesome Three.js Games<\/h1>/);
    assert.ok(text.includes('https://awesome.re/badge.svg'));
    assert.deepEqual([...text.matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map(row => (row[1].match(/<td /g) || []).length), [2, 2]);
    assert.equal((text.match(/valign="top"/g) || []).length, 3);
    assert.deepEqual([...text.matchAll(/<img src="previews\/([^"/]+)\.webp" width="400"/g)].map(row => row[1]), f.games.map(game => game.slug));
    for (const game of f.games) {
      assert.ok(text.includes(`href="${SITE}p/${game.slug}"><img`));
      assert.ok(text.includes(`href="${SITE}games/${game.slug}/${game.entry.slice(1)}"`));
      assert.ok(text.includes(`href="${game.slug}/"`));
    }
  }
  assert.match(outputs['README.md'], /3 playable web games with their full source and runnable technique demos\./);
  assert.match(outputs['README.md'], /Explore a world\./);
  assert.ok(!outputs['README.md'].includes('探索世界'));
  assert.match(outputs['README.zh-CN.md'], /探索世界/);
});

test('demo lists use fixed category order, translations, folder overrides and Lab scene source files', async t => {
  const f = await fixture(t);
  for (const [file, text] of Object.entries(await generateReadmes(f.root))) {
    const en = file === 'README.md';
    const demos = section(text, en ? 'Technique demos' : '技术演示');
    assert.deepEqual([...demos.matchAll(/^- <b>(.*?)<\/b>/gm)].map(row => decode(row[1])), en ? ['Camera & controls', 'Water'] : ['镜头与操控', '水面']);
    for (const key of ['camera', 'water']) assert.ok(demos.includes(`${SITE}demos?cat=${key}`));
    assert.ok(demos.includes(`href="examples/shared-host/">${en ? 'Water demo' : '水面演示'}</a>`));
    assert.ok(demos.includes('href="examples/camera/"'));
    assert.ok(demos.includes(`href="webgame-lab/src/scenes/ocean.tsx">${en ? 'Ocean scene' : '海洋场景'}</a>`));
    assert.ok(!demos.includes('boot'));
    assert.ok(!demos.includes('unused'));
    assert.ok(!demos.includes('examples/water/'));
  }
});

test('only reviewed non-playable verdicts get a short tag; explanations never appear', async t => {
  const f = await fixture(t);
  for (const verdict of ['能玩', '部分能玩', '不能玩', '未审核', null]) {
    await f.save('catalog/runnability.json', { games: [{ slug: 'z-game', reviewed_verdict: verdict,
      auto_verdict: '不能玩', review_note: 'Long explanation must not appear', reason: 'Fallback reason must not appear' }] });
    const outputs = await generateReadmes(f.root);
    for (const [file, text] of Object.entries(outputs)) {
      const tag = file === 'README.md' ? 'Partly playable' : '部分能玩';
      assert.equal(text.includes(`<small>${tag}</small>`), Boolean(verdict && verdict !== '能玩'));
      assert.ok(!text.includes('must not appear'));
    }
  }
});

test('credits preserve public origins and concise license notes without leaking local source paths', async t => {
  const f = await fixture(t);
  f.games[1].source = '../private-copy';
  f.games[1].source_repository = 'https://github.com/example/original';
  f.games[1].license_note = 'No project-wide license was found. Preserve credits.';
  await f.save('catalog/games.json', { games: f.games });
  const outputs = await generateReadmes(f.root);
  const credits = section(outputs['README.md'], 'Credits and licenses');
  assert.match(credits, /href="https:\/\/example.com\/z-game">Game 0<\/a> — MIT/);
  assert.match(credits, /href="https:\/\/github.com\/example\/original">Game 1<\/a> — No license stated — study use/);
  assert.match(credits, /Game 2<\/a> — License not recorded/);
  assert.ok(credits.includes('[webgame-lab/LICENSES.md](webgame-lab/LICENSES.md)'));
  assert.ok(!outputs['README.md'].includes('../private-copy'));
});

test('credits link non-public sources to their archived folders in both languages', async t => {
  const f = await fixture(t);
  f.games[1].source_public = false;
  f.games[1].source_repository = 'https://github.com/example/private';
  await f.save('catalog/games.json', { games: f.games });
  const outputs = await generateReadmes(f.root);
  assert.match(section(outputs['README.md'], 'Credits and licenses'), /Game 1 — Source archived in <a href="a-game\/">a-game\/<\/a>/);
  assert.match(section(outputs['README.zh-CN.md'], '来源与许可证'), /Game 1 — 源码归档于 <a href="a-game\/">a-game\/<\/a>/);
  for (const output of Object.values(outputs)) assert.ok(!output.includes('https://github.com/example/private'));
});

test('catalog text and URL attributes are escaped', async t => {
  const f = await fixture(t);
  f.pages[0].title = 'Title <b>&"\'';
  f.pages[0].tagline_en = '<b>&';
  f.games[0].entry = '/index.html?a="x"&b=<b>';
  await f.save('catalog/games.json', { games: f.games });
  await f.flushPages();
  const text = await generateReadme(f.root);
  assert.ok(text.includes('Title &lt;b&gt;&amp;&quot;&#39;'));
  assert.ok(text.includes('&lt;b&gt;&amp;<br>'));
  assert.ok(text.includes('/index.html?a=&quot;x&quot;&amp;b=&lt;b&gt;'));
});

test('invalid or untranslated content fails instead of silently omitting it', async t => {
  const f = await fixture(t);
  f.pages[0].tagline_en = '';
  await f.flushPages();
  await assert.rejects(generateReadmes(f.root), /tagline_en must be a non-empty string/);
  f.pages[0].tagline_en = 'Restored.';
  await f.flushPages();
  await f.save('catalog/lab-i18n.json', {});
  await assert.rejects(generateReadmes(f.root), /Missing Lab translation/);
});

test('CLI writes both files and detects each stale or missing file without writing during --check', async t => {
  const f = await fixture(t);
  await mkdir(path.join(f.root, 'tools'));
  for (const file of ['readme.mjs', 'tools.mjs', 'demos.mjs', 'pages.mjs', 'library-index.mjs']) {
    await copyFile(new URL(file, import.meta.url), path.join(f.root, 'tools', file));
  }
  const run = (...args) => spawnSync(process.execPath, [path.join(f.root, 'tools/readme.mjs'), ...args], {
    cwd: os.tmpdir(), encoding: 'utf8',
  });
  assert.equal(run('--check').status, 1);
  const generated = run();
  assert.equal(generated.status, 0, generated.stderr);
  for (const [file, expected] of Object.entries(await generateReadmes(f.root))) {
    const destination = path.join(f.root, file);
    assert.equal(await readFile(destination, 'utf8'), expected);
    await writeFile(destination, `${expected}Manual edit\n`);
    const stale = run('--check');
    assert.equal(stale.status, 1);
    assert.ok(stale.stderr.includes(`${file} differs at line`));
    assert.equal(await readFile(destination, 'utf8'), `${expected}Manual edit\n`);
    assert.equal(run().status, 0);
    await rm(destination);
    assert.equal(run('--check').status, 1);
    await assert.rejects(access(destination), { code: 'ENOENT' });
    assert.equal(run().status, 0);
    assert.equal(run('--check').status, 0);
  }
});

test('real README files cover every game, demo category and existing local link without local URLs outside Run locally', async () => {
  const { games } = JSON.parse(await readFile(path.join(ROOT, 'catalog/games.json'), 'utf8'));
  const { examples } = JSON.parse(await readFile(path.join(ROOT, 'catalog/examples.json'), 'utf8'));
  const { catalog: scenes } = await import('../webgame-lab/src/catalog.ts');
  const translations = JSON.parse(await readFile(path.join(ROOT, 'catalog/lab-i18n.json'), 'utf8'));
  const pages = await Promise.all(games.map(game => readFile(path.join(ROOT, `catalog/pages/${game.slug}.json`), 'utf8').then(JSON.parse)));
  const toolPages = JSON.parse(await readFile(path.join(ROOT,'catalog/tools.json'),'utf8')).tools;
  const outputs = await generateReadmes();
  for (const [file, text] of Object.entries(outputs)) {
    // Output freshness is checked separately by the orchestrator after all catalogs settle.
    const en = file === 'README.md';
    assert.deepEqual([...text.matchAll(/^## (.*)$/gm)].map(row => row[1]), en
      ? ['Games', 'Tools', 'Technique demos', 'Run locally', 'Credits and licenses']
      : ['游戏', '工具', '技术演示', '本地运行', '来源与许可证']);
    const grid = section(text, en ? 'Games' : '游戏');
    const cards = [...grid.matchAll(/<td[^>]*valign="top">([\s\S]*?)<\/td>/g)];
    assert.equal(cards.length, games.length);
    const rows = [...grid.matchAll(/<tr>([\s\S]*?)<\/tr>/g)];
    assert.equal(rows.length, Math.ceil(games.length / 2));
    for (const row of rows) assert.equal((row[1].match(/<td /g) || []).length, 2);
    assert.deepEqual([...grid.matchAll(/href="([^"]+)">▶ [^<]+<\/a>/g)].map(row => row[1]),
      games.map(game => `${SITE}games/${game.slug}/${game.entry.replace(/^\//, '')}`));
    const local = section(text, en ? 'Run locally' : '本地运行');
    assert.equal(local.trim().split('\n').length, 3);
    assert.ok(local.includes('http://127.0.0.1:8080'));
    assert.ok(!/127\.0\.0\.1|localhost|file:\/\/|\/Users\//.test(text.replace(local, '')));
    const demos = section(text, en ? 'Technique demos' : '技术演示');
    const demoLinks = [...demos.matchAll(/<a href="([^"]+)">([^<]+)<\/a>/g)]
      .filter(row => !row[1].startsWith('https://')).map(row => [decode(row[1]), decode(row[2])]);
    const expectedDemos = [
      ...[...pages,...toolPages].flatMap(page => page.examples.map(entry => {
        const example = examples.find(row => row.id === entry.id);
        return [`examples/${example.folder ?? example.id}/`, en ? entry.title_en : entry.title];
      })),
      ...scenes.filter(scene => scene.id !== 'boot').map(scene => [
        `webgame-lab/src/scenes/${scene.id}.tsx`, en ? translations[scene.id].name_en : scene.name,
      ]),
    ];
    assert.deepEqual(demoLinks.sort(), expectedDemos.sort());
    assert.deepEqual([...demos.matchAll(/^- <b>(.*?)<\/b>/gm)].map(row => decode(row[1])), categories.map(row => row[en ? 2 : 1]));
    for (const [key, zh, english] of categories) {
      assert.ok(demos.includes(`${SITE}demos?cat=${key}`));
      assert.ok(!demos.includes(`<b>${en ? zh : english.replaceAll('&', '&amp;')}</b>`));
    }
    for (const href of links(text)) {
      if (/^https?:\/\//.test(href)) continue;
      assert.ok(!href.startsWith('../') && !path.isAbsolute(href), href);
      await access(path.join(ROOT, href));
    }
  }
});

test('Tools follows Games with bilingual copy, linked preview, original, terms and plain license note', async t => {
  const f=await fixture(t);
  const tool=JSON.parse(await readFile(path.join(ROOT,'catalog/tools.json'),'utf8')).tools[0];
  await f.save('catalog/tools.json',{schema_version:1,tools:[{...tool,examples:[]}]});
  await f.save('fab-botanic/local.json',{root:'public',entry:'/tl/fab-botanic/index.html',port:8107});
  await mkdir(path.join(f.root,'fab-botanic/public'),{recursive:true});
  for (const [file,text] of Object.entries(await generateReadmes(f.root))) {
    const en=file==='README.md', heading=en?'Tools':'工具';
    assert.ok(text.indexOf('## '+heading)>text.indexOf('## '+(en?'Games':'游戏')));
    assert.ok(text.indexOf('## '+heading)<text.indexOf('## '+(en?'Technique demos':'技术演示')));
    const body=section(text,heading);
    assert.ok(body.includes(`href="${SITE}t/${tool.slug}"><img src="previews/${tool.slug}.webp"`));
    assert.ok(body.includes(en?tool.tagline_en:tool.tagline));
    assert.ok(body.includes(`href="${SITE}tools-app/fab-botanic/tl/fab-botanic/index.html">${en?'Open tool ↗':'打开工具'}`));
    assert.ok(body.includes(`href="${tool.url}">${en?'Original site':'原站'}`));
    assert.ok(body.includes(`href="${tool.terms_url}"`));
    assert.ok(!body.includes('Source')&&!body.includes('源码'));
    assert.ok(section(text,en?'Credits and licenses':'来源与许可证').replaceAll('&#39;',"'").includes(en?tool.license_note:tool.license_note_zh));
  }
});
