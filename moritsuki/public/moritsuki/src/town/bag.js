// 持ち物（I）の画面、画面の隅のお小遣いと「頼まれごと」、物をわたした・お小遣いをもらったときの知らせ。
// 獲物のアイコンはモリ突きと同じ魚のモデルから描く（fish/thumbs.js）。魚を直せばアイコンも変わる。
// 蛤突きの貝は蛤突きの貝のモデルから（hamaguri/thumbs.js）。ガザミ・クサフグ・鰻掬いの物も、それぞれの遊びのモデルから
import { GENRES, itemOf, CATCH_ORDER, SHELL_ORDER, MINI_ORDER } from '../shared/items.js';
import { QUESTS } from './quests.js';
import { SCRIPTS } from './people/lines.js';

const $ = (id) => document.getElementById(id);
const yen = (n) => '¥' + Math.round(n).toLocaleString('ja-JP');
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const whoName = (id) => SCRIPTS[id]?.name || id;
const MINI = Object.values(MINI_ORDER).flat();
// ミニゲームのアイコンを描く部品（鰻掬いの魚は、先に模様を塗っておく）
const MINI_THUMBS = {
  gazami: () => import('../gazami/thumbs.js'),
  kusafugu: () => import('../kusafugu/thumbs.js'),
  unagi: async () => { const [m, f] = await Promise.all([import('../unagi/thumbs.js'), import('../unagi/fish/fishmodel.js')]); await f.prepareFishTextures(); return m; },
};

// ---------- アイコン（町が動き出してから、手の空いたときに描く）----------
export const icons = {
  urls: {},
  ready: null,
  start() {
    if (this.ready) return this.ready;
    this.ready = (async () => {
      const [{ prepareFishTextures }, { renderThumbs }] = await Promise.all([import('../fish/models.js'), import('../fish/thumbs.js')]);
      await prepareFishTextures();
      await new Promise((r) => setTimeout(r, 0));
      Object.assign(this.urls, renderThumbs(CATCH_ORDER.filter((id) => !SHELL_ORDER.includes(id) && !MINI.includes(id))));
      const { renderThumbs: renderShells } = await import('../hamaguri/thumbs.js');
      await new Promise((r) => setTimeout(r, 0));
      Object.assign(this.urls, renderShells(SHELL_ORDER));
      for (const [game, ids] of Object.entries(MINI_ORDER)) {
        try {
          const { renderThumbs: render } = await MINI_THUMBS[game]();
          await new Promise((r) => setTimeout(r, 0));
          Object.assign(this.urls, render(ids));
        } catch (e) { console.warn(`${game} のアイコンを描けませんでした`, e); }
      }
    })().catch((e) => console.warn('アイコンを描けませんでした', e));
    return this.ready;
  },
  url(id) { return this.urls[id] || itemOf(id).icon || ''; },
};
const img = (id, cls = '') => {
  const u = icons.url(id);
  return u ? `<img class="${cls}" src="${u}" alt="">` : `<span class="${cls} noicon"></span>`;
};

// ---------- 持ち物の画面 ----------
export class Bag {
  // progress: shared/progress.js、quests: QuestBook
  constructor({ progress, quests }) {
    this.progress = progress; this.quests = quests;
    this.el = $('bag');
    this.tabsEl = this.el.querySelector('.bag-tabs');
    this.grid = this.el.querySelector('.bag-grid');
    this.detail = this.el.querySelector('.bag-detail');
    this.moneyEl = this.el.querySelector('.bag-money b');
    this.genre = 'fish';
    this.sel = null;
    this.tabsEl.addEventListener('click', (e) => { const b = e.target.closest('[data-g]'); if (b) this.setGenre(b.dataset.g); });
    this.grid.addEventListener('click', (e) => { const b = e.target.closest('[data-id]'); if (b) { this.sel = b.dataset.id; this.render(); } });
    addEventListener('keydown', (e) => {
      if (!this.open || e.repeat) return;
      const k = GENRES.findIndex((g) => g.id === this.genre);
      if (e.code === 'ArrowRight' || e.code === 'KeyD') this.setGenre(GENRES[(k + 1) % GENRES.length].id);
      else if (e.code === 'ArrowLeft' || e.code === 'KeyA') this.setGenre(GENRES[(k + GENRES.length - 1) % GENRES.length].id);
      else if (/^Digit[1-9]$/.test(e.code) && GENRES[+e.code.slice(5) - 1]) this.setGenre(GENRES[+e.code.slice(5) - 1].id);
    });
    icons.start().then(() => { if (this.open) this.render(); });
  }

  // 持っている物（ジャンルごと、図鑑の順）
  items(genre) {
    const inv = this.progress.data.inv;
    const order = (id) => { const k = CATCH_ORDER.indexOf(id); return k < 0 ? 999 : k; };
    return Object.keys(inv).filter((id) => inv[id] > 0 && itemOf(id).genre === genre).sort((a, b) => order(a) - order(b));
  }
  // この物をほしがっている人 [{ who, need, left }]
  wanted(id) {
    const out = [];
    for (const q of this.quests.active()) {
      if (q.st !== 'asked' || !q.want[id]) continue;
      out.push({ who: q.id, need: q.want[id], left: Math.max(0, q.want[id] - this.progress.count(id)) });
    }
    return out;
  }

  show() {
    this.open = true;
    // いちばん物の多いジャンルを開く（今のジャンルが空のとき）
    if (!this.items(this.genre).length) this.genre = GENRES.find((g) => this.items(g.id).length)?.id || this.genre;
    this.render();
  }
  hide() { this.open = false; }
  setGenre(g) { if (g === this.genre) return; this.genre = g; this.sel = null; this.render(); }

  render() {
    const P = this.progress;
    this.moneyEl.textContent = yen(P.data.money);
    this.tabsEl.innerHTML = GENRES.map((g, k) => {
      const n = this.items(g.id).reduce((s, id) => s + P.count(id), 0);
      return `<button data-g="${g.id}" class="${g.id === this.genre ? 'on' : ''}"><kbd>${k + 1}</kbd>${g.name}<small>${n}</small></button>`;
    }).join('');
    const ids = this.items(this.genre);
    if (!ids.includes(this.sel)) this.sel = ids[0] || null;
    this.grid.innerHTML = ids.length ? ids.map((id) => {
      const it = itemOf(id), want = this.wanted(id).length;
      return `<button class="bag-card${id === this.sel ? ' sel' : ''}" data-id="${id}">${img(id, 'ic')}<span class="nm">${esc(it.name)}</span><span class="n">×${P.count(id)}</span>${want ? '<span class="want">たのまれ</span>' : ''}</button>`;
    }).join('') : `<div class="bag-empty"><b>まだ何も持っていない</b><span>${this.genre === 'other' ? 'いろいろな遊びで手に入る物が、ここに入るよ。' : this.genre === 'shell' ? 'アヒル島や南の浜で獲ってこよう。<br><kbd>F</kbd> で空に上がって、青い印へ。' : this.genre === 'crust' ? 'アヒル島や、夜の内の浜・田んぼの側溝で獲ってこよう。<br><kbd>F</kbd> で空に上がって、青い印へ。' : 'アヒル島や、夜の外の浜・田んぼの側溝で獲ってこよう。<br><kbd>F</kbd> で空に上がって、青い印へ。'}</span></div>`;
    this.renderDetail();
  }

  renderDetail() {
    const id = this.sel;
    if (!id) { this.detail.innerHTML = ''; this.detail.classList.add('none'); return; }
    this.detail.classList.remove('none');
    const it = itemOf(id), n = this.progress.count(id);
    const want = this.wanted(id).map((w) => `<li><b>${esc(whoName(w.who))}</b>${w.left ? `あと${w.left}${it.unit || 'つ'}` : '<em>そろった！</em>'}</li>`).join('');
    this.detail.innerHTML = `
      <div class="bd-pic">${img(id, 'big')}</div>
      <div class="bd-name">${esc(it.name)}${it.kanji ? `<small>${esc(it.kanji)}</small>` : ''}</div>
      <div class="bd-count">${n}<small>${it.unit || 'こ'}</small></div>
      <p class="bd-desc">${esc(it.desc)}</p>
      ${it.hint ? `<div class="bd-hint"><span>${esc(it.place || 'アヒル島')}</span>${esc(it.hint.replace(/\{[^}]*\}/g, '…'))}</div>` : ''}
      ${want ? `<div class="bd-want"><span>たのまれている</span><ul>${want}</ul></div>` : ''}`;
  }
}

// ---------- 画面の隅: お小遣いと、頼まれごと ----------
export class QuestHud {
  constructor({ progress, quests }) {
    this.progress = progress; this.quests = quests;
    this.wallet = $('wallet');
    this.track = $('quest-track');
    icons.start().then(() => this.update());
    this.update();
  }
  update() {
    const P = this.progress;
    this.wallet.querySelector('b').textContent = yen(P.data.money);
    const rows = this.quests.active().map((q) => {
      const who = esc(whoName(q.id));
      const place = QUESTS[q.id].site === 'lab' ? '水産研究所' : '定食 みなと';
      if (q.st === 'done') return `<div class="qt wait"><div class="qt-who">${who}</div><div class="qt-msg">${q.id === 'isogai' ? '研究中' : '試作中'}……　ほかの場所へ行ってから、また来よう</div></div>`;
      if (q.st === 'built') return `<div class="qt ready"><div class="qt-who">${who}</div><div class="qt-msg">${place}で話しかけよう</div></div>`;
      const items = Object.entries(q.want).map(([id, n]) => {
        const it = itemOf(id), have = Math.min(n, P.count(id));
        return `<div class="qt-row${have >= n ? ' ok' : ''}">${img(id, 'ic')}<span>${esc(it.name)}</span><b>${have}<small>/${n}</small></b></div>`;
      }).join('');
      return `<div class="qt${q.ready ? ' ready' : ''}"><div class="qt-who">${who}のたのみ</div>${items}${q.ready ? `<div class="qt-msg">そろった！　${place}へ</div>` : ''}</div>`;
    }).join('');
    this.track.innerHTML = rows;
  }
}

// ---------- 知らせ（物をわたした・お小遣いをもらった）----------
export function notify(html, cls = '') {
  const host = $('pop');
  const el = document.createElement('div');
  el.className = 'pop ' + cls;
  el.innerHTML = html;
  host.appendChild(el);
  setTimeout(() => el.classList.add('out'), 3000);
  setTimeout(() => el.remove(), 3600);
}
export const notifyGive = (want) => notify(
  `<div class="pop-icons">${Object.keys(want).map((id) => img(id, 'ic')).join('')}</div><div class="pop-t">${Object.entries(want).map(([id, n]) => `${esc(itemOf(id).name)} ×${n}`).join('・')}<small>をわたした</small></div>`, 'give');
export const notifyReward = (yenN) => notify(`<i class="coin"></i><div class="pop-t"><small>お小遣い</small>${yen(yenN)}<small>もらった</small></div>`, 'coin');
