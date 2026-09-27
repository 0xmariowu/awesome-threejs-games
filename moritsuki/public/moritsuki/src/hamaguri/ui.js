// 画面・HUD の DOM 制御（銛一本の UI を元に、ハマグリ突き用に作り直した）
import { SHELLS, ZUKAN_IDS, LEGEND_IDS, SOUND_WORD } from './species.js';
import { save } from './save.js';
import { audio } from './core/audio.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const yen = (n) => '¥' + Math.round(n).toLocaleString('ja-JP');
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export const normalLeft = () => ZUKAN_IDS.filter((id) => !(save.data.zukan[id]?.caught > 0)).length;
export const legendUnlocked = () => normalLeft() === 0;

export class UI {
  constructor() {
    this.thumbs = {};
    this.screens = {};
    $$('.screen').forEach((s) => (this.screens[s.id] = s));
    this.hud = $('#hud');
    this.el = {
      tide: $('#tide'), tTime: $('#tide .t-time'), tLeft: $('#tide .t-left'), tBar: $('#tide .t-bar i'),
      gauge: $('#gauge'), gWater: $('#gauge .g-water'), gVal: $('#gauge .g-val b'),
      bag: $('#bag'), bagN: $('#bag .bag-n'), bagBest: $('#bag .bag-best'), total: $('#bag .tot'),
      stabs: $('#stabs'), stabsN: $('#stabs b'),
      cross: $('#crosshair'), words: $('#words'), pin: $('#pin'),
      prompt: $('#prompt'), feed: $('#feed'), warn: $('#warn'), telop: $('#telop'),
      dig: $('#dig'), digTitle: $('#dig .d-title'), digBar: $('#dig .d-bar i'), digMark: $('#dig .d-bar b'), digSub: $('#dig .d-sub'),
      struggle: $('#struggle'), strBar: $('#struggle .s-bar i'), hint: $('#hint'), lockhint: $('#lockhint'), fade: $('#fade'),
    };
    this.last = {};
    document.addEventListener('mouseover', (e) => { if (e.target.closest('button')) audio.uiHover(); });
    document.addEventListener('click', (e) => { if (e.target.closest('button')) audio.uiClick(); });
    this.ripples();
  }

  ripples() {
    const host = $('.load-ripples');
    for (let i = 0; i < 14; i++) {
      const s = document.createElement('span');
      const size = 80 + Math.random() * 260;
      s.style.cssText = `left:${Math.random() * 100}%;top:${Math.random() * 100}%;width:${size}px;height:${size}px;animation-duration:${3 + Math.random() * 4}s;animation-delay:${-Math.random() * 6}s`;
      host.appendChild(s);
    }
  }

  // ───── 画面遷移 ─────
  show(id) { this.screens[id]?.classList.add('show'); }
  hide(id) { this.screens[id]?.classList.remove('show'); }
  only(...ids) { for (const k in this.screens) (ids.includes(k) ? this.show(k) : this.hide(k)); }
  fade(on) { this.el.fade.classList.toggle('on', on); }
  showHud(on) { this.hud.classList.toggle('show', on); }
  dimHud(on) { this.hud.classList.toggle('dim', on); }
  loading(p, msg) {
    $('#loading .load-bar i').style.width = `${Math.round(p * 100)}%`;
    if (msg) $('#loading .load-msg').textContent = msg;
  }
  titleRecord() {
    const d = save.data;
    const got = ZUKAN_IDS.filter((id) => d.zukan[id]?.caught > 0).length;
    const lg = LEGEND_IDS.filter((id) => d.zukan[id]?.caught > 0).length;
    const legend = legendUnlocked() ? `<em class="legend">主 ${lg} / ${LEGEND_IDS.length}</em>` : '';
    $('#title .title-record').innerHTML = `<span>最高の成果<b>${yen(d.best)}</b></span><span>図鑑<b>${got} / ${ZUKAN_IDS.length}</b>${legend}</span><span>浜に出た回数<b>${d.days}回</b></span>`;
  }
  async intro(lines) {
    const host = $('#intro .intro-lines');
    host.innerHTML = '';
    this.show('intro');
    let skip = false;
    const onSkip = () => (skip = true);
    addEventListener('mousedown', onSkip, { once: true });
    addEventListener('keydown', onSkip, { once: true });
    for (const l of lines) {
      const p = document.createElement('p');
      p.className = l.cls || '';
      p.textContent = l.text;
      host.appendChild(p);
      if (l.sound) l.sound();
      const t0 = performance.now();
      while (performance.now() - t0 < (l.wait ?? 1100) && !skip) await new Promise((r) => setTimeout(r, 50));
      if (skip) break;
    }
    if (!skip) await new Promise((r) => setTimeout(r, 900));
    removeEventListener('mousedown', onSkip);
    removeEventListener('keydown', onSkip);
  }

  // ───── HUD ─────
  set(key, val, fn) { if (this.last[key] !== val) { this.last[key] = val; fn(val); } }
  updateHud(s) {
    const e = this.el;
    this.set('time', s.clock, (v) => (e.tTime.textContent = v));
    this.set('left', s.left, (v) => (e.tLeft.textContent = v));
    e.tBar.style.width = `${Math.min(100, s.tideT * 100)}%`;
    this.set('late', s.tideT > 0.8, (v) => e.tide.classList.toggle('late', v));
    // 水深: 人形の足もとからの水位（人形の高さ 120px = 1.3m）
    e.gWater.style.height = `${Math.min(100, (s.depth / 1.3) * 100)}%`;
    this.set('dep', Math.round(s.depth * 100), (v) => (e.gVal.textContent = v));
    this.set('deep', s.depth > 0.8, (v) => e.gauge.classList.toggle('deep', v));
    this.set('bagN', s.bagN, (v) => (e.bagN.textContent = v));
    this.set('bagBest', s.bagBest, (v) => (e.bagBest.textContent = v));
    this.set('total', s.total, (v) => {
      e.total.textContent = yen(v);
      e.total.classList.remove('bump'); void e.total.offsetWidth; e.total.classList.add('bump');
    });
    this.set('stabs', s.stabs, (v) => { e.stabsN.textContent = v.toLocaleString('ja-JP'); });
    this.set('cross', s.cross, (v) => e.cross.classList.toggle('hidden', !v));
  }
  stabPop() { const s = this.el.stabs; s.classList.remove('pop'); void s.offsetWidth; s.classList.add('pop'); }

  /** 当たりの音をカタカナで、画面の x, y に出す */
  word(sound, x, y, big = 0) {
    const w = document.createElement('div');
    const live = ['kachin', 'katsun', 'kashi', 'chi', 'kochin'].includes(sound);
    w.className = 'word' + (sound === 'gon' ? ' big' : live ? ' live' : ' dull');
    w.textContent = SOUND_WORD[sound] || '？';
    w.style.left = `${x}px`; w.style.top = `${y}px`;
    if (big) w.style.fontSize = `${34 * (1 + big * 0.35)}px`;
    this.el.words.appendChild(w);
    setTimeout(() => w.remove(), 1700);
    while (this.el.words.children.length > 6) this.el.words.firstChild.remove();
  }
  pin(on, x = 0, y = 0) {
    this.set('pin', on, (v) => this.el.pin.classList.toggle('show', v));
    if (on) { this.el.pin.style.left = `${x}px`; this.el.pin.style.top = `${y}px`; }
  }
  prompt(html) {
    this.set('prompt', html || '', (v) => {
      if (v) this.el.prompt.innerHTML = v;
      this.el.prompt.classList.toggle('show', !!v);
    });
  }
  warn(text, soft = false) {
    this.set('warn', text ? text + soft : '', () => {
      this.el.warn.textContent = text || '';
      this.el.warn.className = text ? 'show' + (soft ? ' soft' : '') : '';
    });
  }
  hint(html, dur = 5) {
    const h = this.el.hint;
    h.innerHTML = html;
    h.classList.add('show');
    clearTimeout(this._hintT);
    this._hintT = setTimeout(() => h.classList.remove('show'), dur * 1000);
  }
  toast(html, { cls = '', img = null, icon = null, dur = 4.2 } = {}) {
    const t = document.createElement('div');
    t.className = 'toast ' + cls;
    t.innerHTML = (img ? `<img src="${img}" alt="">` : icon ? `<div class="ic">${icon}</div>` : '') + `<div>${html}</div>`;
    this.el.feed.appendChild(t);
    while (this.el.feed.children.length > 5) this.el.feed.firstChild.remove();
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 500); }, dur * 1000);
  }
  telop(html, dur = 2.2, low = false) {
    const host = this.el.telop;
    host.classList.toggle('low', low);
    host.innerHTML = html;
    clearTimeout(this._telT); clearTimeout(this._telT2);
    this._telT = setTimeout(() => {
      [...host.children].forEach((c) => c.classList.add('tl-out'));
      this._telT2 = setTimeout(() => (host.innerHTML = ''), 450);
    }, dur * 1000);
  }
  bigShout(text, sub, card, dur = 3.2) {
    const chars = [...text].map((ch, i) => `<span class="ch" style="animation-delay:${0.05 + i * 0.045}s">${esc(ch)}</span>`).join('');
    this.telop(`<div class="tl tl-big">${chars}</div>${sub ? `<div><span class="tl-sub red">${sub}</span></div>` : ''}${card || ''}`, dur, true);
  }
  /** 掘る: p = 掘った深さ（0..1、印 = 殻の見える深さ）。grab = つかめる */
  dig(on, p = 0, mark = 1, grab = false, legend = false) {
    const e = this.el;
    this.set('dig', on, (v) => e.dig.classList.toggle('show', v));
    if (!on) return;
    e.digBar.style.width = `${Math.max(0, Math.min(1, p)) * 100}%`;
    e.digMark.style.left = `${Math.max(0, Math.min(1, mark)) * 100}%`;
    this.set('digGrab', grab + '|' + legend, () => {
      e.digTitle.textContent = grab ? (legend ? 'でかい！ クリックでつかめ！' : '見えた！ クリックでつかむ') : '砂を掻き出せ！';
      e.digTitle.classList.toggle('grab', grab);
    });
  }
  struggle(on, p = 0) {
    this.set('str', on, (v) => this.el.struggle.classList.toggle('show', v));
    if (on) this.el.strBar.style.width = `${Math.max(0, Math.min(1, p)) * 100}%`;
  }
  lockHint(on) { this.el.lockhint.style.opacity = on ? 1 : 0; }

  // ───── 図鑑 ─────
  openZukan() {
    const grid = $('#zukan .zk-grid');
    const d = save.data.zukan;
    const got = ZUKAN_IDS.filter((id) => d[id]?.caught > 0).length;
    const open = legendUnlocked();
    const lg = LEGEND_IDS.filter((id) => d[id]?.caught > 0).length;
    $('#zukan .zk-count').innerHTML = `${got} / ${ZUKAN_IDS.length} 種 捕獲${open ? `<span class="zk-lcount">主 ${lg} / ${LEGEND_IDS.length}</span>` : ''}`;
    const card = (id, no) => {
      const e = SHELLS[id], z = d[id] || {};
      const legend = !!e.legend, sealed = legend && !open;
      const cls = (z.caught > 0 ? '' : 'locked') + (legend ? ' legend' : '') + (sealed ? ' sealed' : '');
      const name = z.caught > 0 ? e.name : '？？？';
      return `<div class="zk-card ${cls}" data-id="${id}"><span class="no">${legend ? 'LEGEND' : 'No.' + String(no).padStart(2, '0')}</span><img src="${this.thumbs[id] || ''}" alt=""><div class="nm">${name}</div>${sealed ? '<div class="seal">全種類捕獲で開放</div>' : `<div class="rar">${'★'.repeat(e.rarity || 1)}</div>`}</div>`;
    };
    grid.innerHTML = ZUKAN_IDS.map((id, i) => card(id, i + 1)).join('')
      + `<div class="zk-sep${open ? ' open' : ''}"><span>浜の主</span><small>${open ? '河口と沖の瀬に、何十年も生きた主がいる' : `図鑑の全種類を捕獲すると開放（あと${normalLeft()}種）`}</small></div>`
      + LEGEND_IDS.map((id) => card(id, 0)).join('');
    const select = (id) => {
      $$('.zk-card', grid).forEach((c) => c.classList.toggle('sel', c.dataset.id === id));
      const e = SHELLS[id], z = d[id] || {};
      const known = z.caught > 0;
      const det = $('#zukan .zk-detail');
      det.classList.toggle('legend', !!e.legend);
      if (e.legend && !open) {
        det.innerHTML = `<img src="${this.thumbs[id] || ''}" alt="" class="sealed"><div class="kanji">主</div><h3>？？？</h3><div class="en">LEGEND</div>
          <div class="seal-box"><b>全種類捕獲で開放</b><span>図鑑の${ZUKAN_IDS.length}種をすべて捕獲すると、浜の主が姿を見せる。</span><i style="--p:${(got / ZUKAN_IDS.length) * 100}%"></i><em>${got} / ${ZUKAN_IDS.length}　あと${normalLeft()}種</em></div>`;
        return;
      }
      const hint = known ? '' : `<div class="hint">${e.hint}</div>`;
      det.innerHTML = `
        <img src="${this.thumbs[id] || ''}" alt="" style="${known ? '' : 'filter:brightness(0) opacity(.45)'}">
        <div class="kanji">${e.kanji || ''}</div>
        <h3>${known || e.legend ? e.name : '？？？'}</h3><div class="en">${e.alias ? `別名 ${e.alias}　` : ''}${e.en || ''}</div>
        <p>${known ? e.desc : 'まだ獲っていない。'}</p>
        ${hint}
        <dl>
          <dt>大きさ</dt><dd>${e.size[0]}〜${e.size[1]}cm</dd>
          <dt>珍しさ</dt><dd>${'★'.repeat(e.rarity || 1)}${'☆'.repeat(5 - (e.rarity || 1))}</dd>
          <dt>手ごたえ</dt><dd>「${SOUND_WORD[e.sound]}」</dd>
          <dt>獲った数</dt><dd>${z.caught || 0}</dd>
          <dt>最大記録</dt><dd>${z.best ? z.best + 'cm' : '—'}</dd>
        </dl>
        ${known ? `<div class="dish">${e.dish}</div>` : ''}`;
    };
    grid.onclick = (ev) => { const c = ev.target.closest('.zk-card'); if (c) select(c.dataset.id); };
    select(ZUKAN_IDS[0]);
    this.show('zukan');
  }

  // ───── 設定 ─────
  bindSettings(onChange) {
    const s = save.data.settings;
    $$('#settings [data-set]').forEach((inp) => {
      const k = inp.dataset.set;
      const out = inp.parentElement.querySelector('output');
      const fmt = () => {
        if (!out) return;
        if (k === 'quality') out.textContent = '';
        else if (k === 'fov') out.textContent = `${inp.value}°`;
        else if (k === 'sens') out.textContent = Number(inp.value).toFixed(2);
        else out.textContent = `${Math.round(inp.value * 100)}`;
      };
      if (inp.type === 'checkbox') inp.checked = !!s[k]; else inp.value = s[k];
      fmt();
      inp.addEventListener('input', () => {
        s[k] = inp.type === 'checkbox' ? inp.checked : inp.type === 'range' ? Number(inp.value) : inp.value;
        fmt();
        onChange(k, s[k]);
        save.write();
      });
    });
  }

  // ───── 結果 ─────
  async results({ day, items, total, rank, news, stats }) {
    const list = $('#results .res-list');
    $('#results .res-day').textContent = `南の浜　${day}回目の干潮`;
    $('#results .res-total b').textContent = yen(0);
    const rk = $('#results .res-rank');
    rk.classList.remove('go');
    rk.querySelector('.rank-title').textContent = rank.title;
    rk.querySelector('.rank-sub').textContent = rank.sub;
    $('#results .res-news').innerHTML = '';
    $('#results .res-stats').innerHTML = stats.map(([k, v]) => `<span>${esc(k)}<b>${esc(v)}</b></span>`).join('');
    list.innerHTML = items.length ? '' : '<div class="res-empty">今日は、空き殻ばかり……</div>';
    this.show('results');
    await new Promise((r) => setTimeout(r, 700));
    let sum = 0;
    const totalEl = $('#results .res-total b');
    for (const [i, it] of items.entries()) {
      const row = document.createElement('div');
      row.className = 'res-item' + (it.legend ? ' legend' : '');
      row.innerHTML = `<img src="${this.thumbs[it.id] || ''}" alt=""><div class="dn">${esc(it.dish)}<small>${esc(it.label)}${it.isNew ? '<em>初！</em>' : ''}</small></div><div class="yen">${yen(it.value)}</div>`;
      list.appendChild(row);
      list.scrollTop = list.scrollHeight;
      sum += it.value;
      totalEl.textContent = yen(sum);
      audio.coin();
      await new Promise((r) => setTimeout(r, Math.max(110, 380 - i * 30)));
    }
    totalEl.textContent = yen(total);
    list.scrollTo({ top: 0, behavior: 'smooth' });
    await new Promise((r) => setTimeout(r, 450));
    rk.classList.add('go');
    audio.stamp();
    $('#results .res-news').innerHTML = `<span class="sub">${esc(rank.sub)}</span>${news.length ? '<br>' + news.map(esc).join('　/　') : ''}`;
  }
}
