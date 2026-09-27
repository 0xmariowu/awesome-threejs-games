// 画面・HUD の DOM 制御（ガザミ拾いの UI を元に、クサフグ拾い用に作り直した）
import { FUGU, ZUKAN_IDS, LEGEND_AT, BUCKET_MAX, kusaTotal } from './species.js';
import { save } from './save.js';
import { audio } from './core/audio.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const yen = (n) => '¥' + Math.round(n).toLocaleString('ja-JP');
export const kg = (g) => (g / 1000).toFixed(g < 10000 ? 1 : 0) + 'kg';
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const fullName = (sp) => sp.name;
export const pct = (k) => `${Math.round(k * 100)}%`;

export class UI {
  constructor() {
    this.thumbs = {};
    this.screens = {};
    $$('.screen').forEach((s) => (this.screens[s.id] = s));
    this.hud = $('#hud');
    this.el = {
      tide: $('#tide'), tTime: $('#tide .t-time'), tLeft: $('#tide .t-left'), tBar: $('#tide .t-bar i'),
      bucket: $('#bucket'), bkN: $('#bucket .bk-n'), bkFill: $('#bucket .bk-fill'), shift: $('#shiftkey'),
      bag: $('#bag'), bagN: $('#bag .bag-n'), bagPlus: $('#bag .bag-plus'), bagKg: $('#bag .bag-kg'), bagBest: $('#bag .bag-best'), total: $('#bag .tot'),
      combo: $('#combo'), comboN: $('#combo b'),
      words: $('#words'), prompt: $('#prompt'), feed: $('#feed'), warn: $('#warn'), telop: $('#telop'),
      hint: $('#hint'), lockhint: $('#lockhint'), fade: $('#fade'), hurt: $('#hurt'),
    };
    this.last = {};
    document.addEventListener('mouseover', (e) => { if (e.target.closest('button')) audio.uiHover(); });
    document.addEventListener('click', (e) => { if (e.target.closest('button')) audio.uiClick(); });
    this.stars();
  }

  stars() {
    const host = $('.load-stars');
    for (let i = 0; i < 90; i++) {
      const s = document.createElement('span');
      const k = Math.random();
      s.style.cssText = `left:${Math.random() * 100}%;top:${Math.random() * 70}%;opacity:${0.3 + k * 0.7};transform:scale(${0.6 + k});animation-duration:${2 + Math.random() * 4}s;animation-delay:${-Math.random() * 6}s`;
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
    $('#title .title-record').innerHTML = `<span>一晩の最高<b>${d.best}匹</b></span><span>これまでに<b>${d.total.toLocaleString('ja-JP')}匹</b></span><span>図鑑<b>${got} / ${ZUKAN_IDS.length}</b></span><span>浜に出た夜<b>${d.days}回</b></span>`;
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
    this.set('bagN', s.bagN, (v) => {
      e.bagN.textContent = v;
      if (v > 0) { e.bagN.classList.remove('bump'); void e.bagN.offsetWidth; e.bagN.classList.add('bump'); e.bagPlus.classList.remove('go'); void e.bagPlus.offsetWidth; e.bagPlus.classList.add('go'); }
    });
    this.set('bagKg', s.kg, (v) => (e.bagKg.textContent = v));
    this.set('bagBest', s.bagBest, (v) => (e.bagBest.textContent = v));
    this.set('sharp', s.sharp, (v) => {
      e.total.textContent = v;
      e.total.className = s.sharpCls || '';
      e.total.classList.remove('bump'); void e.total.offsetWidth; e.total.classList.add('bump');
    });
    this.set('bucketN', s.bagN, (v) => {
      e.bkN.textContent = v;
      const h = Math.min(1, v / BUCKET_MAX) * 42;
      e.bkFill.setAttribute('y', String(52 - h)); e.bkFill.setAttribute('height', String(h));
      e.bucket.classList.toggle('full', v >= BUCKET_MAX - 3);
      if (v > 0) { e.bkN.classList.remove('bump'); void e.bkN.offsetWidth; e.bkN.classList.add('bump'); }
    });
    this.set('sneak', !!s.sneak, (v) => e.shift.classList.toggle('on', v));
    this.set('combo', s.combo, (v) => {
      e.combo.classList.toggle('show', v >= 2);
      e.comboN.textContent = v;
      e.combo.classList.remove('pop'); void e.combo.offsetWidth; e.combo.classList.add('pop');
    });
  }
  /** 手ざわりの字を画面の x, y に出す（cls: ouch / dull / plus / miss） */
  word(text, x, y, cls = 'ouch', size = 0) {
    const w = document.createElement('div');
    w.className = 'word ' + cls;
    w.textContent = text;
    w.style.left = `${x}px`; w.style.top = `${y}px`;
    if (size) w.style.fontSize = `${size}px`;
    this.el.words.appendChild(w);
    setTimeout(() => w.remove(), 1000);
    while (this.el.words.children.length > 8) this.el.words.firstChild.remove();
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
    while (this.el.feed.children.length > 4) this.el.feed.firstChild.remove();
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
  chars(text, delay = 0.045) { return [...text].map((ch, i) => `<span class="ch" style="animation-delay:${0.05 + i * delay}s">${esc(ch)}</span>`).join(''); }
  bigShout(text, sub, card, dur = 3.2) {
    this.telop(`<div class="tl tl-big">${this.chars(text)}</div>${sub ? `<div><span class="tl-sub red">${sub}</span></div>` : ''}${card || ''}`, dur, true);
  }
  lockHint(on) { this.el.lockhint.style.opacity = on ? 1 : 0; }

  // ───── 図鑑 ─────
  openZukan() {
    const grid = $('#zukan .zk-grid');
    const d = save.data.zukan;
    const got = ZUKAN_IDS.filter((id) => d[id]?.caught > 0).length;
    const sharp = save.data.grabs ? (save.data.total / save.data.grabs) : 0;
    $('#zukan .zk-count').innerHTML = `${got} / ${ZUKAN_IDS.length} 種 捕獲　これまでに ${save.data.total.toLocaleString('ja-JP')} 匹・石をつかんだ ${save.data.stones || 0} 回${save.data.grabs ? `・見分け ${pct(sharp)}` : ''}`;
    const kt = kusaTotal(d);
    const card = (id, no) => {
      const e = FUGU[id], z = d[id] || {};
      const cls = (z.caught > 0 ? '' : 'locked') + (e.legend ? ' legend' : '');
      const name = z.caught > 0 ? fullName(e) : '？？？';
      // 伝説は、開放されるまで「あと何匹」を出す
      const rar = e.legend && kt < LEGEND_AT ? `<div class="rar lg">クサフグ ${kt} / ${LEGEND_AT} 匹</div>` : `<div class="rar">${e.legend ? '伝説 ' : ''}${'★'.repeat(e.rarity || 1)}</div>`;
      return `<div class="zk-card ${cls}" data-id="${id}"><span class="no">${e.legend ? 'LEGEND' : `No.${String(no).padStart(2, '0')}`}</span><img src="${this.thumbs[id] || ''}" alt=""><div class="nm">${name}</div>${rar}</div>`;
    };
    grid.innerHTML = ZUKAN_IDS.map((id, i) => card(id, i + 1)).join('');
    const select = (id) => {
      $$('.zk-card', grid).forEach((c) => c.classList.toggle('sel', c.dataset.id === id));
      const e = FUGU[id], z = d[id] || {};
      const known = z.caught > 0;
      const det = $('#zukan .zk-detail');
      const sealed = e.legend && kt < LEGEND_AT;
      const hint = known ? '' : sealed
        ? `<div class="hint lg">クサフグを合計 <b>${LEGEND_AT} 匹</b>獲ると、次の夜から浜の砂にまじる。<br>いま <b>${kt}</b> / ${LEGEND_AT} 匹</div>`
        : `<div class="hint">${e.hint}</div>`;
      const img = known && this.thumbs[id + '_puff'] ? this.thumbs[id + '_puff'] : this.thumbs[id];
      det.innerHTML = `
        <img src="${this.thumbs[id] || ''}" alt="" style="${known ? '' : 'filter:brightness(0) opacity(.45)'}" data-alt="${img || ''}">
        <div class="kanji">${known || !e.legend ? e.kanji || '' : '？'}</div>
        <h3>${known ? fullName(e) : '？？？'}</h3><div class="en">${known || !e.legend ? e.en || '' : 'LEGEND'}</div>
        <p>${known ? e.desc : sealed ? 'この浜の、うわさのフグ。まだだれも見たことがない。' : 'まだ獲っていない。'}</p>
        ${hint}
        <dl>
          <dt>全長</dt><dd>${sealed ? '？' : `${e.size[0]}〜${e.size[1]}cm`}</dd>
          <dt>珍しさ</dt><dd>${'★'.repeat(e.rarity || 1)}${'☆'.repeat(5 - (e.rarity || 1))}</dd>
          <dt>獲った数</dt><dd>${(z.caught || 0).toLocaleString('ja-JP')}</dd>
          <dt>最大記録</dt><dd>${z.best ? z.best + 'cm' : '—'}</dd>
        </dl>
        ${known ? `<div class="dish">${e.memo}</div>` : ''}`;
      // 絵にふれると、ふくらんだ姿
      const im = det.querySelector('img');
      if (known && img) { const a0 = im.src; im.onmouseenter = () => (im.src = img); im.onmouseleave = () => (im.src = a0); }
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
  async results({ day, why, count, items, sharp, rank, news, stats }) {
    const list = $('#results .res-list');
    $('#results .res-day').textContent = `外の浜　${day}回目の夜`;
    $('#results .res-why').textContent = why;
    $('#results .res-total b').textContent = '—';
    const nEl = $('#results .rb-n b');
    nEl.textContent = '0';
    $('#results .rb-kg').textContent = '';
    const rk = $('#results .res-rank');
    rk.classList.remove('go');
    rk.querySelector('.rank-title').textContent = rank.title;
    rk.querySelector('.rank-sub').textContent = rank.sub;
    $('#results .res-news').innerHTML = '';
    $('#results .res-stats').innerHTML = stats.map(([k, v]) => `<span>${esc(k)}<b>${esc(v)}</b></span>`).join('');
    list.innerHTML = items.length ? '' : '<div class="res-empty">今夜は、一匹も……</div>';
    this.show('results');
    await new Promise((r) => setTimeout(r, 600));
    // 数を数え上げる
    const t0 = performance.now(), dur = Math.min(1600, 300 + count * 14);
    await new Promise((res) => {
      const step = () => {
        const k = Math.min(1, (performance.now() - t0) / dur);
        const n = Math.round(count * (1 - Math.pow(1 - k, 2)));
        if (nEl.textContent !== String(n)) { nEl.textContent = n; if (n % 3 === 0) audio.coin(); }
        if (k < 1) setTimeout(step, 16); else res();
      };
      step();
    });
    $('#results .rb-kg').textContent = count >= BUCKET_MAX ? 'バケツいっぱい！' : '';
    const totalEl = $('#results .res-total b');
    for (const [i, it] of items.entries()) {
      const row = document.createElement('div');
      row.className = 'res-item';
      row.innerHTML = `<img src="${this.thumbs[it.id] || ''}" alt=""><div class="dn">${esc(it.name)}<small>${esc(it.label)}${it.isNew ? '<em>初！</em>' : ''}</small></div><div class="yen"><span class="cnt">${it.n}匹</span></div>`;
      list.appendChild(row);
      audio.coin();
      await new Promise((r) => setTimeout(r, 360));
    }
    totalEl.textContent = sharp;
    await new Promise((r) => setTimeout(r, 450));
    rk.classList.add('go');
    audio.stamp();
    $('#results .res-news').innerHTML = `<span class="sub">${esc(rank.sub)}</span>${news.length ? '<br>' + news.map(esc).join('　/　') : ''}`;
  }
}
