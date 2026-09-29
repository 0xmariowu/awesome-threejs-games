import {render} from "./dom.js";
import {views} from "./views.js";
import {siteURL, routePath, isStatic} from "./static.js";

const REPO = '0xmariowu/awesome-threejs-games';

let LOCAL = null;
function buildLocal(entries) {
  const dirs = {}, files = new Map();
  for (const entry of entries) {
    const file = typeof entry === 'string' ? {path: entry, bundled: true} : entry;
    files.set(file.path, file);
    const parts = file.path.split('/');
    for (let i = 1; i < parts.length; i++) {
      const dir = parts.slice(0, i).join('/'), child = parts.slice(0, i + 1).join('/');
      (dirs[dir] ||= new Map()).set(child, {name: parts[i], path: child,
        type: i === parts.length - 1 ? 'file' : 'dir', size: i === parts.length - 1 ? file.size : undefined});
    }
  }
  LOCAL = {dirs, files};
}
const CODE_EXT = /\.(m?js|cjs|jsx|tsx?|html|css|glsl|wgsl|vert|frag|json|md|py)$/i;
const SKIP = /^(LICENSE|local\.json|provenance\.json|package-lock\.json)$/i;
const LINE_CAP = 500;
const T = {
  mainNav: ['主导航', 'Main navigation'], projects: ['游戏', 'Games'], demos: ['技术演示', 'Demos'],
  tools: ['工具', 'Tools'], tool: ['工具', 'Tool'],
  toolsTitle: ['好用的游戏制作工具。', 'Tools for making web games.'],
  toolsSub: ['{n} 个工具，帮你制作网页游戏。', '{n} tools to help you build web games.'],
  toolsSubOne: ['1 个工具，帮你制作网页游戏。', '1 tool to help you build web games.'],
  openTool: ['打开工具 ↗', 'Open tool ↗'], terms: ['使用条款 ↗', 'Terms ↗'],
  allTools: ['全部工具', 'All tools'], author: ['作者', 'By'],
  features: ['能做什么', 'What it can do'], steps: ['怎么用在游戏里', 'Use it in your game'],
  usage: ['能不能用', 'Usage rights'],
  toolExamplesSub: ['受这个工具启发、独立实现的技术示例。', 'Independent examples inspired by this tool.'],
  toolFooter: ['工具版权归原作者所有，本站只做介绍和链接。', 'Tools belong to their authors; this site only describes and links to them.'],
  loading: ['正在读取…', 'Loading…'], loadingFiles: ['正在读取文件列表…', 'Loading file list…'],
  dataFailed: ['数据加载失败', 'Couldn’t load the library'], retry: ['重试', 'Try again'],
  homeTitle: ['可以直接玩的 Three.js 游戏。', 'Three.js games you can play.'],
  homeSub: ['{n} 款网页游戏，附完整源码与可独立运行的技术示例。', '{n} web games with full source and runnable technique examples.'],
  play: ['体验', 'Play'], playGame: ['体验游戏', 'Play game'], learnMore: ['了解更多', 'Learn more'],
  allProjects: ['全部项目', 'All projects'], browseSource: ['浏览源码', 'Browse source'],
  examples: ['技术示例', 'Technique examples'], examplesSub: ['从游戏中提取、可单独运行的技术模块。', 'Standalone modules extracted from the game.'],
  noExamples: ['这个项目暂时没有独立示例。', 'This project has no standalone examples yet.'], seeDemos: ['浏览全部技术演示', 'Browse all demos'],
  run: ['运行', 'Run'], stop: ['停止', 'Stop'], inDemos: ['在演示中打开', 'Open in Demos'],
  keyboardHint: ['点击画面后可用键盘操作。', 'Click the scene to use keyboard controls.'], starting: ['正在启动…', 'Starting…'],
  preview: ['预览', 'Preview'], code: ['代码', 'Code'], reload: ['重新载入', 'Reload'], fullscreen: ['全屏', 'Full screen'], hideList: ['隐藏列表', 'Hide list'], showList: ['演示列表', 'Demo list'], newWindow: ['新窗口打开', 'Open in new window'],
  prev: ['上一个', 'Previous'], next: ['下一个', 'Next'], search: ['搜索', 'Search'], searchPh: ['搜索 {n} 个演示', 'Search {n} demos'],
  noMatch: ['没有匹配的演示', 'No matching demos'], sourceTitle: ['源码', 'Source'], sourceFiles: ['源码文件', 'Source files'],
  filterFiles: ['筛选已载入的文件', 'Filter loaded files'], copy: ['复制', 'Copy'], copied: ['已复制到剪贴板', 'Copied to clipboard'],
  copyFailed: ['复制失败', 'Copy failed'], readFailed: ['无法读取这个文件', 'Couldn’t load this file'], openGitHub: ['在 GitHub 查看', 'View on GitHub'],
  showAll: ['显示全部 {n} 行', 'Show all {n} lines'], lines: ['{n} 行', '{n} lines'], noFiles: ['没有匹配的文件', 'No matching files'],
  selectFile: ['在左侧选择一个文件查看源码。', 'Choose a file to view its source.'],
  partly: ['部分能玩', 'Partly playable'], notPlayable: ['不能玩', 'Not playable'],
  auto: ['自动', 'Auto'], light: ['浅色', 'Light'], dark: ['深色', 'Dark'], appearance: ['外观', 'Appearance'],
  exampleKind: ['独立示例', 'Standalone example'], notBundled: ['这份源码尚未公开或未随站点打包。', 'This source isn’t public or bundled with the site yet.'],
  bundledNote: ['这里收录了关键文件，完整源码见仓库。', 'Key files are shown here. See the repository for the full source.'], rateLimit: ['GitHub 请求过于频繁，请稍后再试。', 'GitHub rate limit reached. Try again shortly.'],
  footer: ['游戏版权归原作者所有，仅供学习研究。', 'Games belong to their original authors. For study use only.'],
};
const fmtSize = b => b == null ? '' : b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1048576).toFixed(1)} MB`;
const enc = p => p.split('/').map(encodeURIComponent).join('/');
const baseName = p => p.split('/').pop();

class Library {
  setState(update, callback) {
    Object.assign(this.state, typeof update === "function" ? update(this.state) : update);
    this.callbacks.push(callback);
    if (!this.scheduled) { this.scheduled = true; queueMicrotask(() => {
      this.scheduled = false; render(document.getElementById("app"), views(this.renderVals()));
      const callbacks = this.callbacks.splice(0); for (const fn of callbacks) fn?.();
    }); }
  }
  callbacks = [];
  state = { route: { name: 'home' }, lang: 'zh', themePref: 'auto', sysDark: false, w: 1200, data: null, bootErr: null,
    q: '', demoTab: 'preview', frameH: 0, frameLoading: true, reload: 0, runEx: null, playerW: 0,
    viewer: { status: 'idle' }, files: [], filesStatus: 'idle', tree: {}, open: {}, treeFilter: '', toast: '' };
  cache = new Map();
  fileTok = 0;

  componentDidMount() {
    let lang, theme;
    try { lang = localStorage.getItem('gameref-lang'); theme = localStorage.getItem('gameref-theme'); } catch {}
    const q = new URLSearchParams(location.search).get('lang');
    lang = ['zh', 'en'].includes(q) ? q : ['zh', 'en'].includes(lang) ? lang : ((navigator.language || '').toLowerCase().startsWith('zh') ? 'zh' : 'en');
    this.mq = matchMedia('(prefers-color-scheme: dark)');
    this.onMq = () => this.setState({ sysDark: this.mq.matches }, () => this.applyTheme());
    this.mq.addEventListener('change', this.onMq);
    this.onResize = () => this.setState({ w: innerWidth });
    addEventListener('resize', this.onResize);
    this.rootRO = new ResizeObserver(() => { const w = document.documentElement.clientWidth || innerWidth; if (w !== this.state.w) this.setState({ w }); });
    this.rootRO.observe(document.documentElement);
    requestAnimationFrame(this.onResize);
    this.onHash = () => this.onRoute();
    addEventListener('hashchange', this.onHash);
    addEventListener('popstate', this.onHash);
    this.onMsg = e => {
      const frame = this.frameEl;
      if (!frame || e.source !== frame.contentWindow || e.origin !== new URL(frame.src).origin) return;
      const h = e.data?.type === 'gameref:frame-height' && e.data.height;
      if (Number.isInteger(h)) { frame.dataset.frameHeight = String(Math.max(240, Math.min(4000, h))); this.setState({ frameH: Math.max(240, Math.min(4000, h)) }); }
    };
    addEventListener('message', this.onMsg);
    this.ro = new ResizeObserver(([en]) => { const w = Math.round(en.contentRect.width); if (w !== this.state.playerW) this.setState({ playerW: w }); });
    this.hlReady = import('./highlight.js');
    this.setState({ lang, themePref: ['auto', 'light', 'dark'].includes(theme) ? theme : 'auto', sysDark: this.mq.matches, w: innerWidth }, () => this.applyTheme());
    this.boot();
  }
  componentWillUnmount() {
    this.mq.removeEventListener('change', this.onMq); removeEventListener('resize', this.onResize);
    removeEventListener('hashchange', this.onHash); removeEventListener('popstate', this.onHash); removeEventListener('message', this.onMsg);
    this.ro.disconnect(); this.rootRO.disconnect(); clearTimeout(this.toastTimer);
  }
  dark() { return this.state.themePref === 'dark' || (this.state.themePref === 'auto' && this.state.sysDark); }
  applyTheme() { document.documentElement.dataset.theme = this.dark() ? 'dark' : 'light'; document.documentElement.lang = this.state.lang === 'zh' ? 'zh-CN' : 'en'; }
  t(k, v = {}) { const m = T[k]; return m ? m[this.state.lang === 'zh' ? 0 : 1].replace(/\{(\w+)\}/g, (_, n) => v[n] ?? '') : k; }
  loc(r, f) { return this.state.lang === 'en' ? (r?.[f + '_en'] ?? r?.[f]) : r?.[f]; }

  async boot() {
    this.setState({ bootErr: null, data: null });
    try {
      const j = u => fetch(siteURL('/' + u)).then(r => { if (!r.ok) throw new Error(`${u} · HTTP ${r.status}`); return r.json(); });
      const [pages, demos, manifest, tools] = await Promise.all([j('data/pages.json'), j('data/demos.json'), j('data/src/manifest.json'), j('data/tools.json')]);
      buildLocal(manifest);
      if (!isStatic) this.launchIndex = await fetch('/api/index').then(r => r.json());
      const details = await Promise.all(pages.pages.map(p => j(`data/page/${p.slug}.json`).catch(() => null)));
      const detail = {}; pages.pages.forEach((p, i) => { detail[p.slug] = details[i]; });
      const toolDetails = await Promise.all(tools.tools.map(p => j(`data/tool/${p.slug}.json`)));
      const toolDetail = Object.fromEntries(toolDetails.map(p => [p.slug,p]));
      const ordered = demos.categories.flatMap(c => demos.demos.filter(d => d.category === c.key));
      this.setState({ data: { pages: pages.pages, detail, tools: tools.tools, toolDetail, cats: demos.categories, demos: ordered } }, () => this.onRoute());
    } catch (e) { this.setState({ bootErr: e.message }); }
  }

  parse() {
    const url = new URL(location.href);
    let route = routePath(url.pathname);
    if (url.hash.startsWith('#/')) {
      route = url.hash.slice(1); url.hash = '';
    } else if (route === '/demos' && url.hash) {
      route += '/' + encodeURIComponent(decodeURIComponent(url.hash.slice(1))); url.hash = '';
    }
    if (route === '/demos' && url.searchParams.has('cat')) {
      const demo = this.state.data?.demos.find(d => d.category === url.searchParams.get('cat'));
      if (demo) route += '/' + encodeURIComponent(demo.id);
    }
    url.searchParams.delete('cat');
    url.pathname = siteURL(route);
    if (url.href !== location.href) history.replaceState(null, '', url);
    const s = route.split('/').filter(Boolean).map(decodeURIComponent);
    if (s[0] === 'tools') return {name:'tools'};
    if (s[0] === 't' && s[1]) return {name:'tool',slug:s[1]};
    if (s[0] === 'p' && s[1]) return {name: 'project', slug: s[1]};
    if (s[0] === 'demos') return {name: 'demos', id: s[1] || null};
    if (s[0] === 'source' && s[1]) return {name: 'source', slug: s[1], path: s.slice(1).join('/')};
    return {name: 'home'};
  }
  go(route) {
    history.pushState(null, '', siteURL(route));
    this.onRoute();
  }
  nav = route => e => {
    if (e && (e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)) return;
    e?.preventDefault(); this.go(route);
  };
  readyURLs = new Map();
  launches = new Map();
  async launchURL(id) {
    if (this.readyURLs.has(id)) return this.readyURLs.get(id);
    if (!this.launches.has(id)) this.launches.set(id, (async () => {
      const response = await fetch('/api/launch', {method: 'POST', headers: {
        'Content-Type': 'application/json', 'X-Library-Token': this.launchIndex.token}, body: JSON.stringify({id})});
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      this.readyURLs.set(id, data.url); return data.url;
    })().finally(() => this.launches.delete(id)));
    return this.launches.get(id);
  }
  play = id => async event => {
    if (isStatic) return;
    event.preventDefault();
    const popup = window.open('about:blank', '_blank');
    if (!popup) return;
    popup.opener = null;
    try { popup.location.replace(await this.launchURL(id)); }
    catch (error) { popup.close(); this.flash(error.message); }
  };
  async prepareFrame(id) {
    if (isStatic) return;
    try { await this.launchURL(id); this.setState({}); }
    catch (error) { this.flash(error.message); this.setState({frameLoading: false}); }
  }

  onRoute() {
    const { data } = this.state; if (!data) return;
    const prev = this.state.route, r = this.parse();
    if (r.name === 'demos') {
      const d = data.demos.find(x => x.id === r.id) || data.demos.find(x => x.id === 'example:tidewater-fishing') || data.demos[0];
      r.id = d?.id;
    }
    const moved = prev.name !== r.name || prev.slug !== r.slug;
    const patch = { route: r };
    if (moved || prev.id !== r.id) Object.assign(patch, { frameH: 0, frameLoading: true, runEx: null });
    if (r.name === 'source' && prev.slug !== r.slug) Object.assign(patch, { tree: {}, open: { [r.slug]: true }, treeFilter: '' });
    this.setState(patch, () => {
      if (moved) scrollTo(0, 0);
      if (r.name === 'demos') this.prepareFrame(r.id);
      if (r.name === 'demos' && this.state.demoTab === 'code' && prev.id !== r.id) this.loadDemoCode();
      if (r.name === 'source') this.loadSource(r.slug, r.path);
      if (r.name !== 'source' && r.name !== 'demos') this.setState({ viewer: { status: 'idle' } });
    });
  }

  async listDir(path) {
    const key = 'd:' + path;
    if (this.cache.has(key)) return this.cache.get(key);
    let list;
    if (LOCAL?.dirs[path]) list = [...LOCAL.dirs[path].values()];
    else list = [];
    list.sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'dir' ? -1 : 1));
    this.cache.set(key, list);
    return list;
  }
  async fetchText(path) {
    const key = 'f:' + path;
    if (this.cache.has(key)) return this.cache.get(key);
    let text;
    if (LOCAL?.files.get(path)?.bundled) { const r = await fetch(siteURL(`/data/src/${enc(path)}`)); if (r.ok) text = await r.text(); }
    if (text == null) {
      const r = await fetch(`https://raw.githubusercontent.com/${REPO}/main/${enc(path)}`).catch(() => null);
      if (!r || !r.ok) throw new Error(this.t('notBundled'));
      text = await r.text();
    }
    this.cache.set(key, text);
    return text;
  }
  async openFile(path) {
    const tok = ++this.fileTok;
    this.setState({ viewer: { status: 'loading', path } });
    try {
      const [text, hl] = await Promise.all([this.fetchText(path), this.hlReady]);
      if (tok !== this.fileTok) return;
      const lang = hl.languageFor(path), rows = text.split(/\r\n|\r|\n/);
      const heavy = rows.length > 20000 || rows.some(l => l.length > 10000);
      const tokens = heavy ? rows.map(l => (l ? [{ type: 'plain', text: l }] : [])) : hl.tokenize(text, lang);
      this.setState({ viewer: { status: 'ready', path, text, tokens, lang, bytes: new Blob([text]).size, all: false, mark: null } });
    } catch (e) {
      if (tok === this.fileTok) this.setState({ viewer: { status: 'error', path, error: e.message } });
    }
  }

  srcPathOf(demo) { const m = /\/(?:tree|blob)\/main\/(.+)$/.exec(demo?.source_url || ''); return m ? decodeURIComponent(m[1]) : ''; }
  async loadDemoCode() {
    const demo = this.curDemo(); if (!demo) return;
    const path = this.srcPathOf(demo), id = demo.id;
    if (CODE_EXT.test(path)) { this.setState({ files: [{ name: baseName(path), path }], filesStatus: 'ready' }); return this.openFile(path); }
    this.setState({ files: [], filesStatus: 'loading', viewer: { status: 'loading', path } });
    try {
      const top = await this.listDir(path), subs = await Promise.all(top.filter(e => e.type === 'dir').map(e => this.listDir(e.path).catch(() => [])));
      const list = [...top, ...subs.flat()].filter(e => e.type === 'file' && LOCAL?.files.get(e.path)?.bundled && CODE_EXT.test(e.name) && !SKIP.test(e.name) && !/\.test\.|^test_/.test(e.name));
      const rank = n => /^(app|main|host|index)\.(m?js|tsx?)$/i.test(n) ? 0 : /^readme/i.test(n) ? 3 : /\.(html|css|json)$/i.test(n) ? 2 : 1;
      list.sort((a, b) => rank(a.name) - rank(b.name) || a.name.localeCompare(b.name));
      if (this.state.route.id !== id) return;
      const files = list.slice(0, 10).map(f => ({ ...f, name: f.path.slice(path.length + 1) }));
      this.setState({ files, filesStatus: 'ready' });
      if (files[0]) this.openFile(files[0].path); else this.setState({ viewer: { status: 'error', path, error: this.t('noFiles') } });
    } catch (e) {
      if (this.state.route.id === id) this.setState({ filesStatus: 'error', viewer: { status: 'error', path, error: e.message } });
    }
  }

  async loadDir(path) {
    const cur = this.state.tree[path];
    if (cur && cur.status !== 'error') return cur.entries;
    this.setState(s => ({ tree: { ...s.tree, [path]: { status: 'loading' } } }));
    try {
      const entries = await this.listDir(path);
      this.setState(s => ({ tree: { ...s.tree, [path]: { status: 'ready', entries } } }));
      return entries;
    } catch (e) {
      this.setState(s => ({ tree: { ...s.tree, [path]: { status: 'error', error: e.message } } }));
      return null;
    }
  }
  async loadSource(slug, path) {
    const route = this.state.route;
    const current = () => this.state.route === route;
    const root = await this.loadDir(slug); if (!root || !current()) return;
    const parts = path.split('/');
    let entries = root, target = null;
    for (let i = 1; i < parts.length; i++) {
      const p = parts.slice(0, i + 1).join('/'), e = entries?.find(x => x.path === p);
      if (!e) break;
      if (e.type === 'dir') { this.setState(s => ({ open: { ...s.open, [p]: true } })); entries = await this.loadDir(p); if (i === parts.length - 1) target = null; }
      else { target = p; break; }
    }
    if (!target && path === slug) target = root.find(e => e.type === 'file' && /^readme/i.test(e.name))?.path;
    if (!current()) return;
    if (target && this.state.viewer.path !== target) this.openFile(target);
    else if (!target) this.setState({ viewer: { status: 'idle' } });
  }
  toggleDir(p) {
    const open = !this.state.open[p];
    this.setState(s => ({ open: { ...s.open, [p]: open } }));
    if (open) this.loadDir(p);
  }

  sidebarOpen() { return this.state.sidebar ?? this.state.w >= 1280; }
  curDemo() { return this.state.data?.demos.find(d => d.id === this.state.route.id); }
  frameSrc(url) { if (!url) return 'about:blank'; return url + (url.includes('?') ? '&' : '?') + `lang=${this.state.lang}&theme=${this.dark() ? 'dark' : 'light'}&r=${this.state.reload}`; }
  demoURL(d) {
    if (!d) return '';
    const url = isStatic ? d.launch?.url : this.readyURLs.get(d.launch_id || d.id);
    return url || '';
  }
  exampleURL(id) {
    const d = this.state.data?.demos.find(d => d.id === 'example:' + id);
    return this.demoURL(d);
  }
  badge(rv) { return rv?.reviewed_verdict === '部分能玩' ? this.t('partly') : rv?.reviewed_verdict === '不能玩' ? this.t('notPlayable') : ''; }
  flash(msg) { clearTimeout(this.toastTimer); this.setState({ toast: msg }); this.toastTimer = setTimeout(() => this.setState({ toast: '' }), 2200); }
  frameRef = el => { this.frameEl = el; };
  playerRef = el => { this.ro?.disconnect(); this.playerEl = el; if (el) this.ro.observe(el); };
  videoRef = el => { if (el && !el.dataset.init) { el.dataset.init = '1'; el.muted = el.defaultMuted = true; el.play?.().catch(() => {}); } };

  viewerVals() {
    const v = this.state.viewer, t = k => this.t(k);
    const gh = v.path ? `https://github.com/${REPO}/blob/main/${enc(v.path)}` : `https://github.com/${REPO}`;
    const base = { path: v.path || '', name: v.path ? v.path.split('/').slice(1).join('/') || v.path : '', gh, meta: '', lines: [], gutter: '3ch', more: false,
      isLoading: v.status === 'loading', isError: v.status === 'error', isReady: v.status === 'ready', error: v.error || '',
      retry: () => (this.state.route.name === 'demos' && this.state.filesStatus === 'error' ? this.loadDemoCode() : (this.cache.delete('f:' + v.path), this.openFile(v.path))),
      copy: async () => { try { await navigator.clipboard.writeText(v.text ?? v.path ?? ''); this.flash(t('copied')); } catch { this.flash(t('copyFailed')); } },
      showAll: () => this.setState(s => ({ viewer: { ...s.viewer, all: true } })), moreLabel: '' };
    if (v.status !== 'ready') return base;
    if (this._lc?.v !== v) {
      const total = v.tokens.length, shown = v.all ? total : Math.min(total, LINE_CAP), mark = v.mark;
      const lines = [];
      for (let i = 0; i < shown; i++) {
        const n = i + 1, on = mark === n;
        lines.push({ n, bg: on ? 'var(--mark)' : 'transparent', gbg: on ? 'var(--mark)' : 'var(--code-bg)', nc: on ? 'var(--link)' : 'var(--ink3)',
          mark: () => this.setState(s => ({ viewer: { ...s.viewer, mark: s.viewer.mark === n ? null : n } })),
          toks: v.tokens[i].map(k => ({ t: k.text, c: `var(--tok-${k.type || 'plain'})` })) });
      }
      this._lc = { v, lines, total, shown };
    }
    const { lines, total, shown } = this._lc;
    return { ...base, lines, gutter: `${String(total).length + 3}ch`, more: shown < total, moreLabel: this.t('showAll', { n: total.toLocaleString() }),
      meta: `${v.lang === 'text' ? baseName(v.path).split('.').pop().toUpperCase() : v.lang.toUpperCase()} · ${this.t('lines', { n: total.toLocaleString() })} · ${fmtSize(v.bytes)}` };
  }

  renderVals() {
    const s = this.state, t = {}; for (const k in T) t[k] = this.t(k);
    const dark = this.dark(), narrow = s.w < 760, r = s.route, data = s.data;
    const seg = on => ({ bg: on ? 'var(--seg)' : 'transparent', sh: on ? '0 1px 3px rgba(0,0,0,.14), 0 0 0 .5px rgba(0,0,0,.04)' : 'none' });
    const setLang = lang => () => { try { localStorage.setItem('gameref-lang', lang); } catch {} this.setState({ lang }, () => this.applyTheme()); };
    const order = ['auto', 'light', 'dark'];
    const out = {
      t, brand: s.w < 520 ? 'Three.js Games' : 'Awesome Three.js Games',
      goHome: this.nav('/'), goTools: this.nav('/tools'), goDemos: this.nav('/demos'),
      navProjC: r.name === 'home' || r.name === 'project' || r.name === 'source' ? 'var(--ink)' : 'var(--ink2)',
      navDemoC: r.name === 'demos' ? 'var(--ink)' : 'var(--ink2)',
      navProjCur: ['home','project','source'].includes(r.name) ? 'page' : undefined, navDemoCur: r.name === 'demos' ? 'page' : undefined,
      navToolC: ['tools','tool'].includes(r.name) ? 'var(--ink)' : 'var(--ink2)',
      navToolCur: ['tools','tool'].includes(r.name) ? 'page' : undefined,
      langLabel: s.lang === 'zh' ? 'EN' : '中', langTitle: s.lang === 'zh' ? 'Switch to English' : '切换到中文', toggleLang: setLang(s.lang === 'zh' ? 'en' : 'zh'),
      fullscreen: () => this.frameEl?.requestFullscreen?.().catch(() => {}),
      frameRef: this.frameRef,
      themeLabel: `${s.themePref === 'auto' ? '◐' : s.themePref === 'light' ? '○' : '●'} ${t[s.themePref]}`, themeTitle: t.appearance,
      cycleTheme: () => { const themePref = order[(order.indexOf(s.themePref) + 1) % 3]; try { localStorage.setItem('gameref-theme', themePref); } catch {} this.setState({ themePref }, () => this.applyTheme()); },
      isBooting: !data && !s.bootErr, bootError: !!s.bootErr, bootErrorMsg: s.bootErr || '', retryBoot: () => this.boot(),
      isHome: !!data && r.name === 'home', isProject: !!data && ['project','tool'].includes(r.name), isTool: r.name === 'tool', isTools: !!data && r.name === 'tools', isDemos: !!data && r.name === 'demos', isSource: !!data && r.name === 'source',
      showFooter: !!data && ['home','project','tools','tool'].includes(r.name),
      toast: s.toast, toastOp: s.toast ? 1 : 0, videoRef: this.videoRef, playerRef: this.playerRef,
      games: [], gridCols: s.w >= 1000 ? 'repeat(3,minmax(0,1fr))' : s.w >= 620 ? 'repeat(2,minmax(0,1fr))' : 'minmax(0,1fr)', homeSub: '',
      proj: { examples: [] }, player: {}, demo: {}, demoGroups: [], q: s.q, src: { rows: [], crumbs: [] }, viewer: this.viewerVals(),
    };
    if (!data) return out;
    const player = { src: '', h: s.frameH || (() => { const pw = s.playerW || Math.min(s.w - 48, 1400), side = pw >= 760 ? 312 : 0; return Math.round((pw - side) * 9 / 16 + (side ? 28 : 420)); })(), loading: s.frameLoading,
      onLoad: () => { if (this.frameEl?.getAttribute('src') !== 'about:blank') this.setState({ frameLoading: false }); } };
    out.player = player;

    out.homeSub = this.t('homeSub', { n: data.pages.length });
    out.games = data.pages.map(p => {
      const d = data.detail[p.slug], href = `#/p/${p.slug}`;
      return { slug: p.slug, launch: this.play('game:' + p.slug), title: p.title, alt: this.t('play') + ' · ' + p.title, tagline: this.loc(p, 'tagline'), img: siteURL(`/previews/${p.slug}.webp`), href, open: this.nav(`/p/${p.slug}`),
        play: d?.project?.launch?.url || siteURL(`/p/${p.slug}`),
        badge: this.badge(p.runnability), note: this.loc(p.runnability, 'review_note') || '' };
    });

    out.toolsSub = this.t(data.tools.length === 1 ? 'toolsSubOne' : 'toolsSub',{n:data.tools.length});
    out.wideTools = data.tools.length < 3;
    out.tools = data.tools.map(p => ({...p,tagline:this.loc(p,'tagline'),
      facts:p.facts.map(f=>f[s.lang]).join(' · '),img:siteURL(`/previews/${p.slug}.webp`),
      video:p.overview_video?.url,href:`#/t/${p.slug}`,open:this.nav(`/t/${p.slug}`)}));
    if (['tools','tool'].includes(r.name)) t.footer = t.toolFooter;
    if (['project','tool'].includes(r.name)) {
      const tool = r.name === 'tool';
      const p = (tool ? data.tools : data.pages).find(x => x.slug === r.slug), d = (tool ? data.toolDetail : data.detail)[r.slug];
      if (!p || !d) { out.isProject = false; out.isHome = true; return out; }
      const exs = d.examples || [];
      out.backHref = tool ? '#/tools' : '#/';
      out.goBack = tool ? out.goTools : out.goHome;
      out.backLabel = tool ? t.allTools : t.allProjects;
      out.primaryLabel = tool ? t.openTool : t.playGame;
      out.secondaryLabel = tool ? t.terms : t.browseSource;
      out.examplesSubtitle = tool ? t.toolExamplesSub : t.examplesSub;
      out.showExamples = !tool || exs.length > 0;
      out.tool = tool ? {...d,features:d.features.map(f=>({title:this.loc(f,'title'),desc:this.loc(f,'desc')})),
        steps:d.steps.map(f=>f[s.lang]),can:d.can.map(f=>f[s.lang]).join(' '),cannot:d.cannot.map(f=>f[s.lang]).join(' ')} : null;
      out.proj = { title: d.title, tagline: this.loc(d, 'tagline'), play: tool ? d.url : d.project?.launch?.url || '#', launch: tool ? undefined : this.play('game:' + r.slug), gh: d.source_url,
        srcHref: tool ? d.terms_url : `#/source/${r.slug}`, openSource: tool ? undefined : this.nav(`/source/${r.slug}`), video: d.overview_video?.url, poster: siteURL(`/previews/${r.slug}.webp`),
        badge: this.badge(p.runnability), note: this.loc(p.runnability, 'review_note') || '', hasExamples: exs.length > 0, noExamples: !exs.length,
        examples: exs.map((ex, i) => {
          const running = s.runEx === ex.id;
          if (running) player.src = this.frameSrc(this.exampleURL(ex.id));
          return { id: ex.id, title: this.loc(ex, 'title'), desc: this.loc(ex, 'one_liner'), running, border: i ? '1px solid var(--line)' : '0',
            btn: running ? t.stop : t.run, btnBg: running ? 'var(--fill)' : 'var(--accent)', btnFg: running ? 'var(--ink)' : '#fff',
            demoHref: `#/demos/example:${ex.id}`, openDemo: this.nav(`/demos/${encodeURIComponent('example:' + ex.id)}`),
            toggle: () => { this.setState({ runEx: running ? null : ex.id, frameH: 0, frameLoading: true }); if (!running) this.prepareFrame('example:' + ex.id); } };
        }) };
    }

    if (r.name === 'demos') {
      const demo = this.curDemo(), q = s.q.trim().toLowerCase();
      const match = d => !q || [d.title, d.title_en, d.one_liner, d.one_liner_en, d.source_label].some(x => (x || '').toLowerCase().includes(q));
      out.demoGroups = data.cats.map(c => {
        const items = data.demos.filter(d => d.category === c.key && match(d)).map(d => {
          const on = d.id === demo?.id;
          return { id: d.id, title: this.loc(d, 'title'), source: d.source_label, on, bg: on ? 'var(--accent)' : 'transparent', hover: on ? 'var(--accent)' : 'var(--fill2)',
            fg: on ? '#fff' : 'var(--ink)', sub: on ? 'rgba(255,255,255,.78)' : 'var(--ink3)', select: this.nav(`/demos/${encodeURIComponent(d.id)}`) };
        });
        return { label: this.loc(c, 'label'), count: items.length, items };
      }).filter(g => g.items.length);
      out.noDemoMatch = !out.demoGroups.length;
      out.searchPh = this.t('searchPh', { n: data.demos.length });
      out.onSearch = e => this.setState({ q: e.target.value });
      const cat = data.cats.find(c => c.key === demo?.category);
      out.demo = { title: this.loc(demo, 'title'), desc: this.loc(demo, 'one_liner'), eyebrow: [this.loc(cat, 'label'), demo?.source_label].filter(Boolean).join(' · '),
        url: this.frameSrc(this.demoURL(demo)), gh: demo?.source_url };
      player.src = this.frameSrc(this.demoURL(demo));
      const i = data.demos.indexOf(demo), pv = data.demos[i - 1], nx = data.demos[i + 1];
      out.prev = pv ? { title: this.loc(pv, 'title'), go: this.nav(`/demos/${encodeURIComponent(pv.id)}`) } : null;
      out.next = nx ? { title: this.loc(nx, 'title'), go: this.nav(`/demos/${encodeURIComponent(nx.id)}`) } : null;
      const tp = s.demoTab === 'preview', sp = seg(tp), sc = seg(!tp);
      Object.assign(out, { tabPreview: tp, tabCode: !tp, segPBg: sp.bg, segPSh: sp.sh, segCBg: sc.bg, segCSh: sc.sh,
        showPreview: () => this.setState({ demoTab: 'preview', frameH: 0, frameLoading: true }),
        showCode: () => { if (s.demoTab !== 'code') this.setState({ demoTab: 'code' }, () => this.loadDemoCode()); },
        reloadDemo: () => this.setState(x => ({ reload: x.reload + 1, frameH: 0, frameLoading: true, demoTab: 'preview' })),
        filesLoading: s.filesStatus === 'loading', hasFileTabs: s.files.length > 1,
        fileTabs: s.files.map(f => { const on = f.path === s.viewer.path; return { name: f.name, on, bg: on ? 'var(--ink)' : 'var(--fill)', fg: on ? 'var(--bg)' : 'var(--ink)', open: () => this.openFile(f.path) }; }),
        demoCols: narrow || !this.sidebarOpen() ? 'minmax(0,1fr)' : '272px minmax(0,1fr)', asideDisplay: this.sidebarOpen() ? 'block' : 'none',
        sidebarOpen: this.sidebarOpen(), sidebarLabel: this.sidebarOpen() ? t.hideList : t.showList, demoMax: this.sidebarOpen() ? '1400px' : '1680px',
        toggleSidebar: () => this.setState({ sidebar: !this.sidebarOpen() }), asidePos: narrow ? 'static' : 'sticky', asideH: narrow ? 'auto' : 'calc(100vh - 48px)',
        asideMaxH: narrow ? '38vh' : 'none', asideBorderR: narrow ? '0' : '1px solid var(--line)', asideBorderB: narrow ? '1px solid var(--line)' : '0',
        demoPad: narrow ? '28px 16px 56px' : '36px 40px 72px' });
    }

    if (r.name === 'source') {
      const d = data.detail[r.slug], title = d?.title || r.slug, v = s.viewer, fq = s.treeFilter.trim().toLowerCase();
      const row = (e, depth, label) => {
        const dir = e.type === 'dir', open = !!s.open[e.path], on = !dir && v.path === e.path;
        return { name: label || e.name, path: e.path, on, indent: 8 + depth * 14, chev: dir ? (open ? '▼' : '▶') : '', size: dir ? '' : fmtSize(e.size),
          weight: dir ? 500 : 400, bg: on ? 'var(--accent)' : 'transparent', hover: on ? 'var(--accent)' : 'var(--fill2)', fg: on ? '#fff' : 'var(--ink)',
          dim: on ? 'rgba(255,255,255,.75)' : 'var(--ink3)', click: dir ? () => this.toggleDir(e.path) : this.nav(`/source/${e.path}`) };
      };
      const rows = []; let loading = false, error = null;
      if (fq) {
        for (const k in s.tree) for (const e of s.tree[k].entries || []) if (e.type === 'file' && e.name.toLowerCase().includes(fq)) rows.push(row(e, 0, e.path.slice(r.slug.length + 1)));
      } else {
        const walk = (p, depth) => {
          const n = s.tree[p];
          if (!n || n.status === 'loading') { if (depth === 0) loading = true; else rows.push({ name: t.loading, path: p, indent: 8 + depth * 14 + 18, chev: '', size: '', weight: 400, bg: 'transparent', hover: 'transparent', fg: 'var(--ink3)', dim: 'var(--ink3)', click: () => {} }); return; }
          if (n.status === 'error') { if (depth === 0) error = n.error; else rows.push({ name: n.error, path: p, indent: 8 + depth * 14 + 18, chev: '', size: '', weight: 400, bg: 'transparent', hover: 'var(--fill2)', fg: 'var(--ink3)', dim: 'var(--ink3)', click: () => this.loadDir(p) }); return; }
          for (const e of n.entries) { rows.push(row(e, depth)); if (e.type === 'dir' && s.open[e.path]) walk(e.path, depth + 1); }
        };
        walk(r.slug, 0);
      }
      const crumbPath = v.path && v.path.startsWith(r.slug) ? v.path : r.path, parts = crumbPath.split('/');
      out.src = { title, backHref: `#/p/${r.slug}`, back: this.nav(`/p/${r.slug}`), gh: d?.source_url || `https://github.com/${REPO}/tree/main/${r.slug}`, rows,
        treeLoading: loading, treeError: !!error, treeErrorMsg: error || '', retryTree: () => this.loadSource(r.slug, r.path), noRows: !loading && !error && !rows.length,
        noFile: v.status === 'idle', hasFile: v.status !== 'idle',
        crumbs: parts.map((name, i) => {
          const p = parts.slice(0, i + 1).join('/'), last = i === parts.length - 1;
          return { name, sep: last ? '' : '/', color: last ? 'var(--ink)' : 'var(--link)',
            go: () => { if (last) return; if (i === 0) this.go(`/source/${r.slug}`); else { this.setState(x => ({ open: { ...x.open, [p]: true }, treeFilter: '' })); this.loadDir(p); } } };
        }) };
      Object.assign(out, { treeFilter: s.treeFilter, onTreeFilter: e => this.setState({ treeFilter: e.target.value }),
        srcCols: narrow ? 'minmax(0,1fr)' : 'minmax(220px,280px) minmax(0,1fr)', treeMaxH: narrow ? '40vh' : 'calc(100vh - 290px)', codeMaxH: narrow ? '70vh' : 'calc(100vh - 290px)' });
    }
    return out;
  }
}


const library = new Library();
library.componentDidMount();
addEventListener("pagehide", () => library.componentWillUnmount());
