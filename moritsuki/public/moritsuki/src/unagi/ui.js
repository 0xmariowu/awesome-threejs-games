// 画面・HUD の DOM 制御（蛤突きの UI を元に、ウナギ掬い用に別のものとして作り直した）
import { SPECIES, ZUKAN_IDS, LEGEND_IDS } from './species.js';
import { DROPS, CULVERT, S_END } from './ditch.js';
import { save } from './save.js';
import { audio } from './core/audio.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const yen = (n) => '¥' + Math.round(n).toLocaleString('ja-JP');
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export const normalLeft = () => ZUKAN_IDS.filter((id) => !(save.data.zukan[id]?.caught > 0)).length;
export const legendUnlocked = () => normalLeft() === 0;

// 目の光り方の説明（図鑑）
const EYE_WORD = (sp) => sp.eye.k > 0.8 ? 'よく光る' : sp.eye.k > 0.3 ? '光る' : 'ほとんど光らない';

export class UI {
  constructor() {
    this.thumbs = {};
    this.screens = {};
    $$('.screen').forEach((s) => (this.screens[s.id] = s));
    this.hud = $('#hud');
    this.el = {
      clock: $('#clock'), tTime: $('#clock .t-time'), tLeft: $('#clock .t-left'), tBar: $('#clock .t-bar i'),
      course: $('#course'), cDot: $('#course .c-track > i'), cVal: $('#course .c-val b'),
      bag: $('#bag'), bagN: $('#bag .bag-n'), bagBest: $('#bag .bag-best'), bagRel: $('#bag .bag-rel'), total: $('#bag .tot'),
      cross: $('#crosshair'),
      prompt: $('#prompt'), feed: $('#feed'), warn: $('#warn'), telop: $('#telop'),
      catch: $('#catch'), kTitle: $('#catch .k-title'), kBar: $('#catch .k-bar i'), kSub: $('#catch .k-sub'),
      struggle: $('#struggle'), strBar: $('#struggle .s-bar i'), hint: $('#hint'), lockhint: $('#lockhint'), fade: $('#fade'),
    };
    this.last = {};
    document.addEventListener('mouseover', (e) => { if (e.target.closest('button')) audio.uiHover(); });
    document.addEventListener('click', (e) => { if (e.target.closest('button')) audio.uiClick(); });
    this.ripples();
    this.courseMarks();
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
  /** 道のりの目盛り（下 = スタート、上 = 水門） */
  courseMarks() {
    const tr = $('#course .c-track');
    const put = (s, label, cls = '') => {
      const m = document.createElement('div');
      m.className = 'c-mark ' + cls;
      m.style.top = `${(1 - s / S_END) * 100}%`;
      m.textContent = label;
      tr.appendChild(m);
    };
    put(S_END, '水門', 'goal');
    DROPS.forEach((d, i) => put(d.s, `落ち込み`));
    put((CULVERT.s0 + CULVERT.s1) / 2, '暗渠');
    put(0, 'スタート');
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
    $('#title .title-record').innerHTML = `<span>最高の成果<b>${yen(d.best)}</b></span><span>図鑑<b>${got} / ${ZUKAN_IDS.length}</b>${legend}</span><span>側溝に降りた夜<b>${d.days}回</b></span>`;
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
    e.tBar.style.width = `${Math.min(100, s.timeK * 100)}%`;
    this.set('late', s.timeK > 0.8, (v) => e.clock.classList.toggle('late', v));
    e.cDot.style.top = `${(1 - Math.max(0, Math.min(1, s.dist / S_END))) * 100}%`;
    this.set('dist', Math.max(0, Math.floor(s.dist)), (v) => (e.cVal.textContent = v));
    this.set('bagN', s.bagN, (v) => (e.bagN.textContent = v));
    this.set('bagBest', s.bagBest, (v) => (e.bagBest.textContent = v));
    this.set('bagRel', s.released, (v) => (e.bagRel.innerHTML = v ? `小さいのを逃がした<b>${v}</b>匹` : ''));
    this.set('total', s.total, (v) => {
      e.total.textContent = yen(v);
      e.total.classList.remove('bump'); void e.total.offsetWidth; e.total.classList.add('bump');
    });
    this.set('cross', s.cross, (v) => e.cross.classList.toggle('hidden', !v));
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
  /** 網の中身: title, p = 逃げるまでの残り（0..1）, sub = 操作の説明 */
  catchPanel(on, { title = '', p = 1, sub = '', small = false } = {}) {
    const e = this.el;
    this.set('catch', on, (v) => e.catch.classList.toggle('show', v));
    if (!on) return;
    this.set('kTitle', title + small, () => { e.kTitle.textContent = title; e.kTitle.classList.toggle('small', small); });
    this.set('kSub', sub, (v) => (e.kSub.innerHTML = v));
    e.kBar.style.width = `${Math.max(0, Math.min(1, p)) * 100}%`;
    e.kBar.parentElement.style.visibility = p >= 0 ? 'visible' : 'hidden';
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
      const e = SPECIES[id], z = d[id] || {};
      const legend = !!e.legend, sealed = legend && !open;
      const cls = (z.caught > 0 ? '' : 'locked') + (legend ? ' legend' : '') + (sealed ? ' sealed' : '');
      const name = z.caught > 0 ? e.name : '？？？';
      return `<div class="zk-card ${cls}" data-id="${id}"><span class="no">${legend ? 'LEGEND' : 'No.' + String(no).padStart(2, '0')}</span><img src="${this.thumbs[id] || ''}" alt=""><div class="nm">${name}</div>${sealed ? '<div class="seal">全種類捕獲で開放</div>' : `<div class="rar">${'★'.repeat(e.rarity || 1)}</div>`}</div>`;
    };
    grid.innerHTML = ZUKAN_IDS.map((id, i) => card(id, i + 1)).join('')
      + `<div class="zk-sep${open ? ' open' : ''}"><span>水路の主</span><small>${open ? '暗渠の奥と落ち込みの下に、何十年も生きた主がいる' : `図鑑の全種類を捕獲すると開放（あと${normalLeft()}種）`}</small></div>`
      + LEGEND_IDS.map((id) => card(id, 0)).join('');
    const select = (id) => {
      $$('.zk-card', grid).forEach((c) => c.classList.toggle('sel', c.dataset.id === id));
      const e = SPECIES[id], z = d[id] || {};
      const known = z.caught > 0;
      const det = $('#zukan .zk-detail');
      det.classList.toggle('legend', !!e.legend);
      if (e.legend && !open) {
        det.innerHTML = `<img src="${this.thumbs[id] || ''}" alt="" class="sealed"><div class="kanji">主</div><h3>？？？</h3><div class="en">LEGEND</div>
          <div class="seal-box"><b>全種類捕獲で開放</b><span>図鑑の${ZUKAN_IDS.length}種をすべて捕獲すると、水路の主が姿を見せる。</span><i style="--p:${(got / ZUKAN_IDS.length) * 100}%"></i><em>${got} / ${ZUKAN_IDS.length}　あと${normalLeft()}種</em></div>`;
        return;
      }
      const hint = known ? '' : `<div class="hint">${e.hint}</div>`;
      const unit = e.body === 'crab' ? '（甲らの幅）' : '';
      det.innerHTML = `
        <img src="${this.thumbs[id] || ''}" alt="" style="${known ? '' : 'filter:brightness(0) opacity(.45)'}">
        <div class="kanji">${e.kanji || ''}</div>
        <h3>${known || e.legend ? e.name : '？？？'}</h3><div class="en">${e.alias ? `別名 ${e.alias}　` : ''}${e.en || ''}</div>
        <p>${known ? e.desc : 'まだ獲っていない。'}</p>
        ${hint}
        <dl>
          <dt>大きさ</dt><dd>${e.size[0]}〜${e.size[1]}cm${unit}</dd>
          <dt>珍しさ</dt><dd>${'★'.repeat(e.rarity || 1)}${'☆'.repeat(5 - (e.rarity || 1))}</dd>
          <dt>ライトの目</dt><dd>${EYE_WORD(e)}</dd>
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
        else if (k === 'sens' || k === 'lamp') out.textContent = Number(inp.value).toFixed(2);
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
    $('#results .res-day').textContent = `夜の側溝　${day}回目の夜`;
    $('#results .res-total b').textContent = yen(0);
    const rk = $('#results .res-rank');
    rk.classList.remove('go');
    rk.querySelector('.rank-title').textContent = rank.title;
    rk.querySelector('.rank-sub').textContent = rank.sub;
    $('#results .res-news').innerHTML = '';
    $('#results .res-stats').innerHTML = stats.map(([k, v]) => `<span>${esc(k)}<b>${esc(v)}</b></span>`).join('');
    list.innerHTML = items.length ? '' : '<div class="res-empty">今夜は、見るだけで終わった……</div>';
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
