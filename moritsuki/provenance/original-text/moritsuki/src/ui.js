// 画面・HUD の DOM 制御
import { SPECIES, PICKUPS, RANKS, LEGEND_IDS, ZUKAN_IDS } from './fish/species.js';
import { save } from './save.js';
import { audio } from './core/audio.js';
import { TOWN } from './townMode.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const yen = (n) => '¥' + Math.round(n).toLocaleString('ja-JP');
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export const ZUKAN_ORDER = ZUKAN_IDS;
export const entryOf = (id) => SPECIES[id] || PICKUPS[id];
// 伝説の魚：通常の図鑑（ZUKAN_ORDER）を全種類捕獲すると現れる
export const LEGEND_ORDER = LEGEND_IDS;
export const normalLeft = () => ZUKAN_ORDER.filter((id) => !(save.data.zukan[id]?.caught > 0)).length;
export const legendUnlocked = () => normalLeft() === 0;

export class UI {
  constructor() {
    this.thumbs = {};
    this.screens = {};
    $$('.screen').forEach((s) => (this.screens[s.id] = s));
    this.hud = $('#hud');
    this.el = {
      compassStrip: $('#compass .c-strip'),
      clockTime: $('#clock .c-time'), clockLeft: $('#clock .c-left'), clockBar: $('#clock .c-bar i'), clock: $('#clock'),
      depthMarker: $('#depth .d-marker'), depthVal: $('#depth .d-marker b'), depthMax: $('#depth .d-max'), depthScale: $('#depth .d-scale'),
      breath: $('#breath'), breathBar: $('#breath .b-bar i'), breathSec: $('#breath .b-sec'),
      bag: $('#bag'), bagN: $('#bag .bag-n'), bagY: $('#bag .bag-y'), total: $('#bag .tot'),
      cross: $('#crosshair'), ring: $('#crosshair .ring'),
      stealth: $('#stealth'), tag: $('#tag'), tagName: $('#tag .t-name'), tagSub: $('#tag .t-sub'), tagEye: $('#tag .t-eye'),
      prompt: $('#prompt'), feed: $('#feed'), warn: $('#warn'), telop: $('#telop'),
      struggle: $('#struggle'), strBar: $('#struggle .s-bar i'), hint: $('#hint'), lockhint: $('#lockhint'),
      fade: $('#fade'),
    };
    this.buildCompass();
    this.buildDepthScale();
    this.last = {};
    this.stack = [];
    // 効果音
    document.addEventListener('mouseover', (e) => { if (e.target.closest('button')) audio.uiHover(); });
    document.addEventListener('click', (e) => { if (e.target.closest('button')) audio.uiClick(); });
    this.bubbles();
  }

  bubbles() {
    const host = $('.load-bubbles');
    for (let i = 0; i < 26; i++) {
      const s = document.createElement('span');
      const size = 4 + Math.random() * 16;
      s.style.cssText = `left:${Math.random() * 100}%;width:${size}px;height:${size}px;animation-duration:${5 + Math.random() * 7}s;animation-delay:${-Math.random() * 8}s;--dx:${(Math.random() - 0.5) * 80}px`;
      host.appendChild(s);
    }
  }

  // ───────── 画面遷移 ─────────
  show(id) { this.screens[id]?.classList.add('show'); }
  hide(id) { this.screens[id]?.classList.remove('show'); }
  only(...ids) { for (const k in this.screens) (ids.includes(k) ? this.show(k) : this.hide(k)); }
  isOpen(id) { return this.screens[id]?.classList.contains('show'); }
  fade(on) { this.el.fade.classList.toggle('on', on); }
  showHud(on) { this.hud.classList.toggle('show', on); }
  dimHud(on) { this.hud.classList.toggle('dim', on); }

  loading(p, msg) {
    $('#loading .load-bar i').style.width = `${Math.round(p * 100)}%`;
    if (msg) $('#loading .load-msg').textContent = msg;
  }

  titleRecord() {
    const d = save.data;
    const got = ZUKAN_ORDER.filter((id) => d.zukan[id]?.caught > 0).length;
    const lg = LEGEND_ORDER.filter((id) => d.zukan[id]?.caught > 0).length;
    const legend = legendUnlocked() ? `<em class="legend">伝説 ${lg} / ${LEGEND_ORDER.length}</em>` : '';
    // 町から来たとき（/mori/?town）は日数を出さない（町には日数がない）
    const days = TOWN ? '' : `<span>島での日数<b>${d.days}日</b></span>`;
    $('#title .title-record').innerHTML = `<span>${TOWN ? '最高の漁果' : '最高の晩ごはん'}<b>${yen(d.best)}</b></span><span>図鑑<b>${got} / ${ZUKAN_ORDER.length}</b>${legend}</span>${days}`;
  }

  async intro(lines, total = 5200) {
    const host = $('#intro .intro-lines');
    host.innerHTML = '';
    this.show('intro');
    let skip = false;
    const onSkip = () => (skip = true);
    addEventListener('mousedown', onSkip, { once: true });
    addEventListener('keydown', onSkip, { once: true });
    for (const [i, l] of lines.entries()) {
      const p = document.createElement('p');
      p.className = l.cls || '';
      p.textContent = l.text;
      host.appendChild(p);
      if (l.sound) l.sound();
      const wait = l.wait ?? 1100;
      const t0 = performance.now();
      while (performance.now() - t0 < wait && !skip) await new Promise((r) => setTimeout(r, 50));
      if (skip) break;
      void i;
    }
    if (!skip) await new Promise((r) => setTimeout(r, 900));
    removeEventListener('mousedown', onSkip);
    removeEventListener('keydown', onSkip);
    void total;
  }

  // ───────── HUD ─────────
  buildCompass() {
    const strip = this.el.compassStrip;
    const names = { 0: '北', 45: '北東', 90: '東', 135: '南東', 180: '南', 225: '南西', 270: '西', 315: '北西' };
    let html = '';
    for (let b = -360; b <= 720; b += 15) {
      const n = ((b % 360) + 360) % 360;
      const x = b * 3;
      if (names[n] !== undefined) html += `<span class="${n % 90 === 0 ? 'main' : ''}" style="left:${x}px">${names[n]}</span>`;
      else html += `<span class="tick" style="left:${x}px"></span>`;
    }
    html += '<span class="home" data-home="0">島</span><span class="home" data-home="1">島</span><span class="home" data-home="2">島</span>';
    strip.innerHTML = html;
    this.homeMarks = $$('.home', strip);
  }

  buildDepthScale() {
    let html = '';
    for (let m = 0; m <= 25; m++) {
      const y = (m / 25) * 100;
      html += `<span class="${m % 5 === 0 ? 'l' : ''}" style="top:${y}%"></span>`;
      if (m % 5 === 0) html += `<em style="top:${y}%">${m}</em>`;
    }
    this.el.depthScale.innerHTML = html;
  }

  set(key, val, fn) { if (this.last[key] !== val) { this.last[key] = val; fn(val); } }

  updateHud(s) {
    const e = this.el;
    // コンパス
    const b = s.bearing;
    e.compassStrip.style.transform = `translateX(${210 - b * 3}px)`;
    this.homeMarks.forEach((m, i) => (m.style.left = `${(s.homeBearing + (i - 1) * 360) * 3}px`));
    // 時計
    this.set('clock', s.clock, (v) => (e.clockTime.textContent = v));
    this.set('left', s.left, (v) => (e.clockLeft.textContent = v));
    e.clockBar.style.width = `${Math.min(100, s.dayT * 100)}%`;
    this.set('late', s.dayT > 0.83, (v) => e.clock.classList.toggle('late', v));
    // 水深
    const dep = s.depth;
    e.depthMarker.style.top = `${Math.min(dep / 25, 1) * 100}%`;
    this.set('dep', dep.toFixed(1), (v) => (e.depthVal.textContent = v));
    this.set('dmax', s.maxDepth.toFixed(1), (v) => (e.depthMax.textContent = `最深 ${v}m`));
    // 息
    e.breathBar.style.width = `${Math.max(0, s.breath) * 100}%`;
    this.set('bsec', Math.max(0, Math.ceil(s.breathSec)), (v) => (e.breathSec.innerHTML = `${v}<small>秒</small>`));
    const bcls = s.surface && s.breath < 0.999 ? 'recover' : s.breath < 0.25 ? 'low' : s.breath < 0.5 ? 'mid' : '';
    this.set('bcls', bcls, (v) => (e.breath.className = v));
    // スカリ・漁果
    this.set('bagN', s.bagN, (v) => { e.bagN.textContent = v; e.bag.classList.toggle('has', v > 0); });
    this.set('bagY', s.bagY, (v) => (e.bagY.textContent = yen(v)));
    this.set('total', s.total, (v) => {
      e.total.textContent = yen(v);
      e.total.classList.remove('bump'); void e.total.offsetWidth; e.total.classList.add('bump');
    });
    // 照準
    const off = 119.4 * (1 - s.charge);
    e.ring.style.strokeDashoffset = off;
    this.set('full', s.charge >= 1, (v) => e.cross.classList.toggle('full', v));
    this.set('inreach', s.inReach, (v) => {
      e.cross.classList.toggle('inreach', v === 'in');
      e.cross.classList.toggle('close', v === 'close');
      e.cross.querySelector('.ch-reach').textContent = v === 'close' ? '近すぎる' : '射程内';
    });
    this.set('chHide', !s.submerged, (v) => e.cross.classList.toggle('hidden', v));
    // 気配
    const lv = ['l1', 'l2', 'l3'][s.noiseLv ?? (s.noise < 0.16 ? 0 : s.noise < 0.45 ? 1 : 2)];
    this.set('stealth', lv + (s.still ? ' still' : '') + (s.submerged ? '' : ' off'), (v) => {
      e.stealth.className = v;
      e.stealth.querySelector('span').textContent = s.still ? '静止' : '気配';
      e.stealth.style.opacity = s.submerged ? 0.85 : 0;
    });
  }

  tag(info) {
    const e = this.el;
    if (!info) { this.set('tagOn', false, () => e.tag.classList.remove('show')); return; }
    this.set('tagOn', true, () => e.tag.classList.add('show'));
    e.tag.style.left = `${info.x}px`;
    e.tag.style.top = `${info.y}px`;
    this.set('tagName', info.name, (v) => (e.tagName.textContent = v));
    this.set('tagSub', info.sub, (v) => (e.tagSub.textContent = v));
    this.set('tagEye', info.eye, (v) => (e.tagEye.className = 't-eye ' + v));
    this.set('tagNew', info.isNew, (v) => e.tag.classList.toggle('new', v));
    this.set('tagRare', info.rare, (v) => e.tag.classList.toggle('rare', v));
    this.set('tagLegend', !!info.legend, (v) => e.tag.classList.toggle('legend', v));
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
    clearTimeout(this._telT);
    clearTimeout(this._telT2);
    this._telT = setTimeout(() => {
      [...host.children].forEach((c) => c.classList.add('tl-out'));
      this._telT2 = setTimeout(() => (host.innerHTML = ''), 450);
    }, dur * 1000);
  }

  bigShout(text, sub, card, dur = 3.2) {
    const chars = [...text].map((ch, i) => `<span class="ch" style="animation-delay:${0.05 + i * 0.045}s">${esc(ch)}</span>`).join('');
    this.telop(`<div class="tl tl-big">${chars}</div>${sub ? `<div><span class="tl-sub red">${sub}</span></div>` : ''}${card || ''}`, dur, true);
  }

  struggle(on, p = 0) {
    this.set('str', on, (v) => this.el.struggle.classList.toggle('show', v));
    if (on) this.el.strBar.style.width = `${Math.max(0, Math.min(1, p)) * 100}%`;
  }

  lockHint(on) { this.el.lockhint.style.opacity = on ? 1 : 0; }

  // ───────── 図鑑 ─────────
  openZukan(place = {}) {
    const grid = $('#zukan .zk-grid');
    const d = save.data.zukan;
    const got = ZUKAN_ORDER.filter((id) => d[id]?.caught > 0).length;
    const open = legendUnlocked();
    const lg = LEGEND_ORDER.filter((id) => d[id]?.caught > 0).length;
    $('#zukan .zk-count').innerHTML = `${got} / ${ZUKAN_ORDER.length} 種 捕獲${open ? `<span class="zk-lcount">伝説 ${lg} / ${LEGEND_ORDER.length}</span>` : ''}`;
    const card = (id, no, extra = '') => {
      const e = entryOf(id);
      const z = d[id] || {};
      const legend = !!e.legend;
      const sealed = legend && !open;
      const cls = (z.caught > 0 ? '' : z.seen ? 'seen' : 'locked') + (legend ? ' legend' : '') + (sealed ? ' sealed' : '') + extra;
      const name = z.caught > 0 || z.seen ? e.name : '？？？';
      return `<div class="zk-card ${cls}" data-id="${id}"><span class="no">${legend ? 'LEGEND' : 'No.' + String(no).padStart(2, '0')}</span><img src="${this.thumbs[id] || ''}" alt=""><div class="nm">${name}</div>${sealed ? '<div class="seal">全種類捕獲で開放</div>' : `<div class="rar">${'★'.repeat(e.rarity || 1)}</div>`}</div>`;
    };
    grid.innerHTML = ZUKAN_ORDER.map((id, i) => card(id, i + 1)).join('')
      + `<div class="zk-sep${open ? ' open' : ''}"><span>伝説</span><small>${open ? '島から50mほど沖を巡る、海の王者たち' : `図鑑の全種類を捕獲すると開放（あと${normalLeft()}種）`}</small></div>`
      + LEGEND_ORDER.map((id) => card(id, 0)).join('');
    const select = (id) => {
      $$('.zk-card', grid).forEach((c) => c.classList.toggle('sel', c.dataset.id === id));
      const e = entryOf(id);
      const z = d[id] || {};
      const known = z.caught > 0;
      const det = $('#zukan .zk-detail');
      det.classList.toggle('legend', !!e.legend);
      if (e.legend && !open) {
        // 封印中：姿も名前も伏せ、開放の条件だけ示す
        det.innerHTML = `
          <img src="${this.thumbs[id] || ''}" alt="" class="sealed">
          <div class="kanji">伝説</div>
          <h3>？？？</h3><div class="en">LEGEND</div>
          <div class="seal-box"><b>全種類捕獲で開放</b><span>図鑑の${ZUKAN_ORDER.length}種をすべて捕獲すると、沖に伝説の魚が現れる。</span><i style="--p:${(got / ZUKAN_ORDER.length) * 100}%"></i><em>${got} / ${ZUKAN_ORDER.length}　あと${normalLeft()}種</em></div>`;
        return;
      }
      const size = e.size ? `${e.size[0]}〜${e.size[1]}cm` : '—';
      const hint = known || !e.hint ? '' : `<div class="hint">${e.hint.replace('{dir}', place.dir || '沖').replace('{depth}', place.depth || '18')}</div>`;
      $('#zukan .zk-detail').innerHTML = known || z.seen ? `
        <img src="${this.thumbs[id] || ''}" alt="" style="${known ? '' : 'filter:brightness(0.15) sepia(1) hue-rotate(160deg)'}">
        <div class="kanji">${e.kanji || ''}</div>
        <h3>${e.name}</h3><div class="en">${e.en || ''}</div>
        <p>${known ? e.desc : 'まだ捕まえていない。姿は見たことがある…'}</p>
        ${hint}
        <dl>
          <dt>大きさ</dt><dd>${size}</dd>
          <dt>珍しさ</dt><dd>${'★'.repeat(e.rarity || 1)}${'☆'.repeat(5 - (e.rarity || 1))}</dd>
          <dt>捕獲数</dt><dd>${z.caught || 0}</dd>
          ${e.size ? `<dt>最大記録</dt><dd>${z.best ? z.best + 'cm' : '—'}</dd>` : ''}
        </dl>
        ${known ? `<div class="dish">${e.dish}</div>` : ''}` : `<p style="margin-top:40px;text-align:center;opacity:.6">まだ出会っていない生き物。</p>${hint}`;
    };
    grid.onclick = (ev) => { const c = ev.target.closest('.zk-card'); if (c) select(c.dataset.id); };
    select(ZUKAN_ORDER[0]);
    this.show('zukan');
  }

  // ───────── 設定 ─────────
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

  // ───────── 結果 ─────────
  async results({ day, items, total, rank, news }) {
    const list = $('#results .res-list');
    $('#results .res-day').textContent = TOWN ? 'アヒル島の漁' : `無人島生活　${day}日目`;
    $('#results .res-total b').textContent = yen(0);
    const rk = $('#results .res-rank');
    rk.classList.remove('go');
    rk.querySelector('.rank-title').textContent = rank.title;
    rk.querySelector('.rank-title').style.color = '';
    rk.querySelector('.rank-sub').textContent = rank.sub;
    $('#results .res-news').innerHTML = '';
    list.innerHTML = items.length ? '' : `<div class="res-empty">${TOWN ? '今日は、ボウズ……' : '今夜は、海水と木の実だけ……'}</div>`;
    this.show('results');
    await new Promise((r) => setTimeout(r, 700));
    let sum = 0;
    const totalEl = $('#results .res-total b');
    for (const [i, it] of items.entries()) {
      const row = document.createElement('div');
      row.className = 'res-item';
      // 町モードは料理ではなく獲物そのもの（持ち物に入る）
      const dn = TOWN ? `${esc(it.name)}<small>${it.count ? `×${it.count}` : `${it.cm}cm${it.headshot ? '・一撃' : ''}`}</small>` : `${esc(it.dish)}<small>${esc(it.label)}</small>`;
      row.innerHTML = `<img src="${this.thumbs[it.id] || ''}" alt=""><div class="dn">${dn}</div><div class="yen">${yen(it.value)}</div>`;
      list.appendChild(row);
      list.scrollTop = list.scrollHeight;
      sum += it.value;
      totalEl.textContent = yen(sum);
      audio.coin();
      await new Promise((r) => setTimeout(r, Math.max(90, 380 - i * 25)));
    }
    totalEl.textContent = yen(total);
    list.scrollTo({ top: 0, behavior: 'smooth' });
    await new Promise((r) => setTimeout(r, 450));
    rk.classList.add('go');
    audio.stamp();
    $('#results .res-news').innerHTML = `<span class="sub">${esc(rank.sub)}</span>${news.length ? '<br>' + news.map(esc).join('　/　') : ''}`;
  }
}

export { yen, RANKS };
