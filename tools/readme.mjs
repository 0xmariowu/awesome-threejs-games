import { readFile, writeFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadPages } from './pages.mjs';
import { loadDemos } from './demos.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const SITE = 'https://0xmariowu.github.io/awesome-threejs-games/';
const json = async file => JSON.parse(await readFile(file, 'utf8'));
const escapeHtml = value => String(value).replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[character]);
const link = (label, href) => `<a href="${escapeHtml(href)}">${escapeHtml(label)}</a>`;

// Match library-index.mjs normalization, using the committed Lab snapshot so
// README generation needs neither a sibling checkout nor private runtime logs.
const labCategories = {角色:'3c',镜头:'camera',动画:'animation',画面:'rendering',天空:'rendering',植被:'world',世界:'world',水:'water',特效:'effects',NPC:'ai',物理:'physics',基础:'tooling'};
const copy = {
  en: {
    switch: '**English** · [简体中文](README.zh-CN.md)',
    intro: count => `${count} playable web games with their full source and runnable technique demos.`,
    site: 'Live site', demos: 'Demos', games: 'Games', play: '▶ Play', source: 'Source',
    partial: 'Partly playable', techniques: 'Technique demos', liveDemos: 'Live demos',
    local: 'Run locally', library: 'Library', open: 'Open', game: 'One game',
    credits: 'Credits and licenses', noLicense: 'No license stated — study use',
    archivedSource: 'Source archived in',
    unknownLicense: 'License not recorded',
    assets: 'Webgame Lab lists third-party assets in',
  },
  'zh-CN': {
    switch: '[English](README.md) · **简体中文**',
    intro: count => `${count} 个可玩的网页游戏，附完整源码和可运行的技术演示。`,
    site: '在线网站', demos: '技术演示', games: '游戏', play: '▶ 体验游戏', source: '源码',
    partial: '部分能玩', techniques: '技术演示', liveDemos: '在线演示',
    local: '本地运行', library: '技术库', open: '打开', game: '单个游戏',
    credits: '来源与许可证', noLicense: '未声明许可证，仅供学习',
    archivedSource: '源码归档于',
    unknownLicense: '未记录许可证',
    assets: 'Webgame Lab 的第三方资产见',
  },
};

function licenseSummary(note, words) {
  if (!note) return words.unknownLicense;
  if (/^MIT\b/.test(note)) return 'MIT';
  if (/\bno\b.*\blicense\b|\blicense\b.*\bnot found\b/i.test(note)) return words.noLicense;
  throw new Error(`Unrecognized license note: ${note}`);
}

async function loadReadmeData(root) {
  const { games } = await json(path.join(root, 'catalog/games.json'));
  const { pages, errors } = await loadPages(root);
  if (errors.size) throw new Error([...errors.values()].join('\n'));
  for (const game of games) if (!pages.has(game.slug)) throw new Error(`Missing page: ${game.slug}`);
  const { games: reviews } = await json(path.join(root, 'catalog/runnability.json'));
  const { catalog } = await import(pathToFileURL(path.join(root, 'webgame-lab/src/catalog.ts')));
  const records = catalog.map(scene => ({
    id: `demo:${scene.id}`, kind: 'demo', title: scene.name, summary: scene.desc,
    category: [labCategories[scene.category] || scene.category],
  }));
  const demos = await loadDemos({ root, games, records });
  return { games, pages, reviews: new Map(reviews.map(review => [review.slug, review])), ...demos };
}

function renderReadme({ games, pages, reviews, categories, demos }, language) {
  const words = copy[language];
  if (!words) throw new Error(`Unsupported README language: ${language}`);
  const localized = (row, field) => {
    const value = row[language === 'en' ? `${field}_en` : field];
    if (!value?.trim()) throw new Error(`Missing ${language} ${field}: ${row.id || row.slug}`);
    return value;
  };
  // home.js filters project records without sorting; buildIndex emits catalog order.
  const cards = games.map(game => {
    const page = pages.get(game.slug);
    const review = reviews.get(game.slug);
    const badge = review?.reviewed_verdict && review.reviewed_verdict !== '能玩'
      ? ` <small>${words.partial}</small>` : '';
    return [
      '  <td width="50%" valign="top">',
      `    <a href="${SITE}p/${game.slug}"><img src="previews/${game.slug}.webp" width="400" alt="${escapeHtml(page.title)}"></a><br>`,
      `    <b>${escapeHtml(page.title)}</b>${badge}<br>`,
      `    ${escapeHtml(localized(page, 'tagline'))}<br>`,
      `    ${link(words.play, `${SITE}games/${game.slug}/${game.entry.replace(/^\/+/, '')}`)} · ${link(words.source, `${game.slug}/`)}`,
      '  </td>',
    ].join('\n');
  });
  const rows = [];
  for (let i = 0; i < cards.length; i += 2) {
    rows.push('<tr>', cards[i], cards[i + 1] || '  <td width="50%"></td>', '</tr>');
  }
  const demoLists = categories.map(category => {
    const entries = demos.filter(demo => demo.category === category.key).map(demo => {
      const source = demo.kind === 'lab'
        ? `webgame-lab/src/scenes/${demo.id.slice(5)}.tsx`
        : `${demo.source_url.split('/tree/main/')[1]}/`;
      return link(localized(demo, 'title'), source);
    });
    return `- <b>${escapeHtml(localized(category, 'label'))}</b> · ${link(words.liveDemos, `${SITE}demos?cat=${category.key}`)}: ${entries.join(' · ')}`;
  });
  const credits = games.map(game => {
    const source = game.source_repository || game.source;
    if (game.source_public === false) {
      return `- ${escapeHtml(pages.get(game.slug).title)} — ${words.archivedSource} ${link(`${game.slug}/`, `${game.slug}/`)} — ${licenseSummary(game.license_note, words)}`;
    }
    if (!/^https?:\/\//.test(source)) throw new Error(`Missing public source URL: ${game.slug}`);
    return `- ${link(pages.get(game.slug).title, source)} — ${licenseSummary(game.license_note, words)}`;
  });
  return [
    words.switch, '',
    '<div align="center">',
    '<h1>Awesome Three.js Games</h1>',
    '<a href="https://awesome.re"><img src="https://awesome.re/badge.svg" alt="Awesome"></a>',
    `<p>${words.intro(games.length)}</p>`,
    `<p>${link(words.site, SITE)} · ${link(words.demos, `${SITE}demos`)}</p>`,
    '</div>', '',
    `## ${words.games}`, '', '<table>', ...rows, '</table>', '',
    `## ${words.techniques}`, '', ...demoLists, '',
    `## ${words.local}`, '',
    `- ${words.library}: \`node tools/library.mjs\``,
    `- ${words.open}: http://127.0.0.1:8080`,
    `- ${words.game}: \`node tools/server.mjs <slug>\``, '',
    `## ${words.credits}`, '', ...credits, '',
    `${words.assets} [webgame-lab/LICENSES.md](webgame-lab/LICENSES.md).`, '',
  ].join('\n');
}

export async function generateReadme(root = ROOT, language = 'en') {
  return renderReadme(await loadReadmeData(root), language);
}

export async function generateReadmes(root = ROOT) {
  const data = await loadReadmeData(root);
  return {
    'README.md': renderReadme(data, 'en'),
    'README.zh-CN.md': renderReadme(data, 'zh-CN'),
  };
}

async function main(args) {
  if (args.length > 1 || (args.length === 1 && args[0] !== '--check')) {
    throw new Error('Usage: node tools/readme.mjs [--check]');
  }
  for (const [file, generated] of Object.entries(await generateReadmes())) {
    const destination = path.join(ROOT, file);
    if (args[0] === '--check') {
      let current = '';
      try { current = await readFile(destination, 'utf8'); }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
      if (current !== generated) {
        const actual = current.split('\n'), expected = generated.split('\n');
        const line = expected.findIndex((value, index) => value !== actual[index]);
        console.error(`${file} differs at line ${line < 0 ? expected.length + 1 : line + 1}; run node tools/readme.mjs to regenerate.`);
        process.exitCode = 1;
      } else console.log(`${file} is up to date.`);
    } else {
      await writeFile(destination, generated);
      console.log(`Wrote ${file}.`);
    }
  }
}

if (process.argv[1] && await realpath(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { await main(process.argv.slice(2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
