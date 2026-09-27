// 植樹モード（トップの /?plant で P キー）: 見せたい景色のアラを隠す木を、その場で見ながら植える。
// 植えた木はこのブラウザに残しておき、「コピー」で data/planted-trees.json の中身をまるごと書き出す
// （それを Claude に渡してファイルに反映してもらう）。反映されたものは次に開いたとき自動で「反映済み」になる
import * as THREE from 'three';
import { TreeSet } from './assets/trees.js';
import { CROWN } from './assets/trees2.js';
import { PLANT_KINDS, VARIANTS } from './scenery/planted.js';

const KEY = 'yoshiyama.plant';
const r2 = (v) => Math.round(v * 100) / 100;
const same = (a, b) => a.kind === b.kind && Math.abs(a.x - b.x) < 0.05 && Math.abs(a.z - b.z) < 0.05;
const idOf = (t) => `${t.kind}@${t.x.toFixed(2)},${t.z.toFixed(2)}`;

export class PlantEditor {
  // base: 反映済みの木（planted-trees.json）、planted: それを描いている PlantedTrees
  constructor({ camera, canvas, input, player, ground, planted, base, baseViews = [], scene }) {
    Object.assign(this, { camera, canvas, input, player, ground, planted, base, baseViews });
    this.active = false;
    this.kind = PLANT_KINDS[0].kind;
    this.size = 1;
    this.reroll();
    this.hit = null;      // カーソルの下の地面
    this.hover = null;    // カーソルの下の植えた木（消す候補）
    this.undo = [];
    this.edits = { add: [], del: [], views: [] };
    try { Object.assign(this.edits, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { /* 保存できない環境 */ }
    // ファイルに反映済みのものは、手もとの控えから外す
    const ids = new Set(base.map(idOf));
    this.edits.add = this.edits.add.filter((t) => t.kind in CROWN && !base.some((b) => same(b, t)));
    this.edits.del = this.edits.del.filter((id) => ids.has(id));
    this.edits.views = this.edits.views.filter((v) => !baseViews.some((w) => Math.hypot(w.p[0] - v.p[0], w.p[2] - v.p[2]) < 0.05));
    this.save();

    // 植える前の見本（本物と同じ形）と、樹冠の広さの輪
    this.ghost = new THREE.Group();
    this.ghost.visible = false;
    const N = 64;
    this.ringPos = new Float32Array((N + 1) * 3);
    const rg = new THREE.BufferGeometry();
    rg.setAttribute('position', new THREE.BufferAttribute(this.ringPos, 3));
    this.ring = new THREE.Line(rg, new THREE.LineBasicMaterial({ color: 0xffffff, depthTest: false, transparent: true, opacity: 0.9 }));
    this.ring.renderOrder = 999;
    this.ring.frustumCulled = false;
    this.ring.visible = false;
    scene.add(this.ghost, this.ring);

    this.buildPanel();
    this.apply();
    this.bind();
  }

  // ---------- 木の一覧 ----------
  list() {
    const del = new Set(this.edits.del);
    return [...this.base.filter((t) => !del.has(idOf(t))), ...this.edits.add];
  }
  save() { try { localStorage.setItem(KEY, JSON.stringify(this.edits)); } catch (e) { /* 保存できない環境 */ } }
  snapshot() { this.undo.push(JSON.stringify(this.edits)); if (this.undo.length > 200) this.undo.shift(); }
  apply() {
    this.save();
    this.planted.set(this.list());
    this.refreshPanel();
  }
  reroll() { this.yaw = r2(Math.random() * Math.PI * 2); this.v = Math.floor(Math.random() * VARIANTS); this.ghostKey = null; }

  plant() {
    if (!this.hit) return;
    this.snapshot();
    this.edits.add.push({ kind: this.kind, x: r2(this.hit.x), z: r2(this.hit.z), s: r2(this.size), yaw: this.yaw, v: this.v });
    this.noteView();
    this.reroll();
    this.apply();
    this.flash('植えました');
  }
  remove(t) {
    if (!t) return;
    this.snapshot();
    const i = this.edits.add.indexOf(t);
    if (i >= 0) this.edits.add.splice(i, 1); else this.edits.del.push(idOf(t));
    this.hover = null;
    this.apply();
    this.flash('消しました');
  }
  back() {
    if (!this.undo.length) { this.flash('もどせる操作がありません'); return; }
    this.edits = JSON.parse(this.undo.pop());
    this.apply();
    this.flash('ひとつ前にもどしました');
  }
  clearLocal() {
    if (!this.edits.add.length && !this.edits.del.length) return;
    if (!confirm('まだ反映していない変更（植えた木・消した木）をすべて取り消します。よろしいですか？')) return;
    this.snapshot();
    this.edits = { add: [], del: [], views: [] };
    this.apply();
  }
  // どこから見て植えたか（あとで同じ所から確かめるため）。近い所・同じ向きは 1 つにまとめる
  noteView() {
    const c = this.camera.position, f = new THREE.Vector3();
    this.camera.getWorldDirection(f);
    const v = { p: [r2(c.x), r2(c.y), r2(c.z)], t: [r2(c.x + f.x * 30), r2(c.y + f.y * 30), r2(c.z + f.z * 30)] };
    const near = (w) => Math.hypot(w.p[0] - v.p[0], w.p[2] - v.p[2]) < 8 && Math.hypot(w.t[0] - v.t[0], w.t[2] - v.t[2]) < 12;
    if (![...this.baseViews, ...this.edits.views].some(near)) this.edits.views.push(v);
  }

  // 書き出し: planted-trees.json の中身そのもの（1 本 1 行）
  exportText() {
    const trees = this.list().map((t) => '    ' + JSON.stringify({ kind: t.kind, x: t.x, z: t.z, s: t.s ?? 1, yaw: t.yaw ?? 0, v: t.v ?? 0 }));
    const views = [...this.baseViews, ...this.edits.views].map((v) => '    ' + JSON.stringify(v));
    return `{\n  "trees": [\n${trees.join(',\n')}\n  ],\n  "views": [\n${views.join(',\n')}\n  ]\n}\n`;
  }
  async copy() {
    const text = this.exportText();
    this.out.value = text;
    this.out.hidden = false;
    try { await navigator.clipboard.writeText(text); this.flash('コピーしました。Claude に貼りつけて「反映して」と伝えてください', 5000); }
    catch (e) { this.out.select(); this.flash('下の欄を選んでコピーしてください', 5000); }
  }

  // ---------- モードの出入り ----------
  toggle(on = !this.active) {
    if (on === this.active) return;
    this.active = on;
    document.body.classList.toggle('planting', on);
    this.panel.hidden = !on;
    if (on) {
      this.savedFreeLook = this.input.freeLook;
      this.input.freeLook = false; // カーソルを自由に動かす（見まわすのは右ドラッグ）
      this.input.unlock();
    } else {
      this.input.freeLook = this.savedFreeLook;
      this.ghost.visible = this.ring.visible = false;
      this.hit = this.hover = null;
      this.input.lock({ soft: true }); // Esc からは固定できないことがある（そのときはクリックで戻る）
    }
    this.onToggle?.(on);
  }

  // ---------- 毎フレーム: カーソルの下を調べる ----------
  update() {
    if (!this.active) return;
    const inp = this.input;
    this.hit = this.hover = null;
    if (inp.cursor.inside && !this.dragging) {
      const ndc = new THREE.Vector2(inp.cursor.x * 2 - 1, -(inp.cursor.y * 2 - 1));
      const ray = new THREE.Raycaster();
      ray.setFromCamera(ndc, this.camera);
      this.hit = this.groundAt(ray.ray);
      this.hover = this.treeAt(ray.ray, this.hit);
    }
    const rm = this.removing();
    const name = (t) => PLANT_KINDS.find((k) => k.kind === t.kind).name;
    this.coord.textContent = rm ? (this.hover ? `消す: ${name(this.hover)}（x ${this.hover.x.toFixed(1)}　z ${this.hover.z.toFixed(1)}）` : '消す木を指してください')
      : this.hit ? `x ${this.hit.x.toFixed(1)}　z ${this.hit.z.toFixed(1)}` : '―';
    // 見本
    if (this.hit && !rm) {
      const key = `${this.kind}:${this.size}:${this.yaw}:${this.v}`;
      if (key !== this.ghostKey) this.makeGhost(key);
      this.ghost.position.set(this.hit.x, this.ground(this.hit.x, this.hit.z) - 0.1, this.hit.z);
      const d = this.ghost.position.distanceTo(this.camera.position);
      for (const m of this.ghost.children) m.visible = m.userData.lod === undefined || (m.userData.lod === 0) === d < 70;
      this.ghost.visible = true;
      this.drawRing(this.hit.x, this.hit.z, CROWN[this.kind][0] * this.size, 0xffffff);
    } else {
      this.ghost.visible = false;
      if (rm && this.hover) this.drawRing(this.hover.x, this.hover.z, CROWN[this.hover.kind][0] * (this.hover.s ?? 1), 0xff5a4a);
      else this.ring.visible = false;
    }
    this.canvas.style.cursor = rm ? (this.hover ? 'pointer' : 'not-allowed') : this.hit ? 'crosshair' : 'default';
  }
  // Shift を押している間は「消す」
  removing() { return this.input.down('ShiftLeft') || this.input.down('ShiftRight'); }

  makeGhost(key) {
    this.ghostKey = key;
    for (const m of this.ghost.children) m.dispose();
    this.ghost.clear();
    const ts = new TreeSet();
    ts.add(this.kind, 0, 0, 0, this.size, this.yaw, this.v);
    this.ghost.add(...ts.build({ variants: VARIANTS, cache: this.planted.cache }).children);
  }

  drawRing(x, z, R, color) {
    const P = this.ringPos, N = P.length / 3 - 1;
    for (let k = 0; k <= N; k++) {
      const a = (k / N) * Math.PI * 2, px = x + Math.cos(a) * R, pz = z + Math.sin(a) * R;
      P.set([px, this.ground(px, pz) + 0.25, pz], k * 3);
    }
    this.ring.geometry.attributes.position.needsUpdate = true;
    this.ring.material.color.setHex(color);
    this.ring.visible = true;
  }

  // 視線と地面の交点（地面の高さの関数を少しずつたどり、最後は二分法で詰める）
  groundAt(ray) {
    const o = ray.origin, d = ray.direction, p = new THREE.Vector3();
    const above = (t) => { p.copy(o).addScaledVector(d, t); return p.y - this.ground(p.x, p.z); };
    let t0 = 0.3;
    if (above(t0) < 0) return null;
    for (let t = t0; t < 2500; t += 0.25 + t * 0.012) {
      if (above(t) < 0) {
        let a = t0, b = t;
        for (let k = 0; k < 24; k++) { const m = (a + b) / 2; if (above(m) < 0) b = m; else a = m; }
        above(b);
        return p.clone();
      }
      t0 = t;
    }
    return null;
  }

  // カーソルが樹冠（か幹）にかかっている植えた木。いちばん手前のもの
  treeAt(ray, g) {
    let best = null, bestT = Infinity;
    const c = new THREE.Vector3(), q = new THREE.Vector3();
    for (const t of this.list()) {
      const s = t.s ?? 1, [R, low] = CROWN[t.kind], y = this.ground(t.x, t.z);
      // 樹冠は幹の上の楕円体（半径 R、高さは葉の下端から R ぶん上まで）、幹は細い円柱として当てる
      const cy = y + low * s + R * s * 0.55;
      c.set(t.x, cy, t.z);
      const along = q.copy(c).sub(ray.origin).dot(ray.direction);
      if (along < 0) continue;
      q.copy(ray.origin).addScaledVector(ray.direction, along);
      const dx = q.x - c.x, dz = q.z - c.z, dy = (q.y - c.y) / 0.75;
      const inCrown = dx * dx + dz * dz + dy * dy < (R * s * 0.8) ** 2;
      const inTrunk = Math.hypot(dx, dz) < 0.8 * s && q.y > y - 0.5 && q.y < cy;
      if ((inCrown || inTrunk) && along < bestT) { bestT = along; best = t; }
    }
    // 木より手前の地面に当たるなら、木は選ばない
    if (best) {
      if (g && g.distanceTo(ray.origin) < bestT - CROWN[best.kind][0] * (best.s ?? 1)) return null;
    }
    return best;
  }

  // ---------- 操作 ----------
  bind() {
    const cv = this.canvas;
    let down = null;
    cv.addEventListener('mousedown', (e) => {
      if (!this.active) return;
      if (e.button === 0) down = [e.clientX, e.clientY];
      if (e.button === 2) this.dragging = false;
    });
    addEventListener('mouseup', (e) => {
      if (!this.active || e.button !== 0 || !down) return;
      const moved = Math.hypot(e.clientX - down[0], e.clientY - down[1]);
      down = null;
      if (moved > 6 || e.target !== cv) return;
      if (this.removing()) this.remove(this.hover);
      else this.plant();
    });
    // 右ドラッグで見まわす
    addEventListener('mousemove', (e) => {
      if (!this.active || !(e.buttons & 2)) return;
      this.input.mdx += e.movementX; this.input.mdy += e.movementY;
      if (Math.abs(e.movementX) + Math.abs(e.movementY) > 0) this.dragging = true;
    });
    addEventListener('mouseup', (e) => { if (e.button === 2) this.dragging = false; });
    // キーはゲームより先に受ける（Esc でメニューが開かないように）
    addEventListener('keydown', (e) => {
      if (e.target instanceof HTMLTextAreaElement) return;
      if (e.code === 'KeyP' && !e.ctrlKey && !e.metaKey) {
        if (!this.canToggle?.()) return;
        e.stopImmediatePropagation();
        this.toggle();
        return;
      }
      if (!this.active) return;
      const eat = () => { e.preventDefault(); e.stopImmediatePropagation(); };
      const n = Number(e.key);
      if (e.code === 'Escape') { eat(); this.toggle(false); }
      else if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ') { eat(); this.back(); }
      else if (n >= 1 && n <= PLANT_KINDS.length) { eat(); this.setKind(PLANT_KINDS[n - 1].kind); }
      else if (e.code === 'BracketLeft' || e.code === 'BracketRight' || e.code === 'Minus' || e.code === 'Equal') {
        eat(); this.setSize(this.size + (e.code === 'BracketLeft' || e.code === 'Minus' ? -0.1 : 0.1));
      }
      else if (e.code === 'KeyR') { eat(); this.reroll(); this.flash('向き・形を変えました'); }
      else if (e.code === 'KeyX' || e.code === 'Delete' || e.code === 'Backspace') { eat(); this.remove(this.hover); }
    }, { capture: true });
  }

  setKind(kind) {
    this.kind = kind;
    this.ghostKey = null;
    for (const b of this.kindBtns) b.setAttribute('aria-pressed', b.dataset.kind === kind);
  }
  setSize(s) {
    this.size = r2(THREE.MathUtils.clamp(s, 0.4, 2));
    this.sizeIn.value = this.size;
    this.sizeOut.textContent = '×' + this.size.toFixed(2);
    this.ghostKey = null;
  }

  // ---------- 画面 ----------
  buildPanel() {
    const el = document.createElement('section');
    el.id = 'plant';
    el.hidden = true;
    el.innerHTML = `
      <div class="pl-head"><b>植樹モード</b><span>見せたい景色のアラを木で隠す</span></div>
      <div class="pl-kinds">${PLANT_KINDS.map((k, i) => `<button data-kind="${k.kind}"><kbd>${i + 1}</kbd><b>${k.name}</b><small>${k.note}</small></button>`).join('')}</div>
      <label class="pl-size"><span>大きさ</span><input type="range" min="0.4" max="2" step="0.05" value="1" /><output>×1.00</output></label>
      <button class="pl-wide" data-act="reroll">向き・形を変える <kbd>R</kbd></button>
      <div class="pl-coord">―</div>
      <div class="pl-count"></div>
      <div class="pl-row">
        <button data-act="undo">もどす <kbd>Ctrl+Z</kbd></button>
        <button data-act="clear">未反映を全部取り消す</button>
      </div>
      <button class="pl-copy" data-act="copy">コピーして Claude に渡す</button>
      <textarea class="pl-out" hidden readonly spellcheck="false"></textarea>
      <div class="pl-msg" role="status"></div>
      <dl class="pl-keys">
        <dt>左クリック</dt><dd>植える</dd>
        <dt>Shift+クリック・X</dt><dd>カーソルの木を消す</dd>
        <dt>右ドラッグ・Q/E</dt><dd>見まわす</dd>
        <dt>WASD・ホイール</dt><dd>歩く・寄る/引く</dd>
        <dt>[ ]</dt><dd>大きさ</dd>
        <dt>P・Esc</dt><dd>植樹モードを終える</dd>
      </dl>`;
    document.body.appendChild(el);
    this.panel = el;
    this.kindBtns = [...el.querySelectorAll('[data-kind]')];
    this.kindBtns.forEach((b) => b.addEventListener('click', () => this.setKind(b.dataset.kind)));
    this.sizeIn = el.querySelector('.pl-size input');
    this.sizeOut = el.querySelector('.pl-size output');
    this.sizeIn.addEventListener('input', () => this.setSize(Number(this.sizeIn.value)));
    this.sizeIn.addEventListener('change', () => this.sizeIn.blur()); // 矢印キーで歩いたときに動かないように
    this.coord = el.querySelector('.pl-coord');
    this.count = el.querySelector('.pl-count');
    this.out = el.querySelector('.pl-out');
    this.msg = el.querySelector('.pl-msg');
    el.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', () => {
      const a = b.dataset.act;
      if (a === 'reroll') this.reroll();
      else if (a === 'undo') this.back();
      else if (a === 'clear') this.clearLocal();
      else if (a === 'copy') this.copy();
      b.blur(); // Space・数字キーがボタンに吸われないように
    }));
    // パネルの上ではホイールでカメラが寄らないように
    el.addEventListener('wheel', (e) => e.stopPropagation());
    this.setKind(this.kind);
    this.setSize(this.size);
  }
  refreshPanel() {
    const nb = this.base.length - this.edits.del.length, na = this.edits.add.length, nd = this.edits.del.length;
    this.count.innerHTML = `反映済み <b>${nb}</b> 本　未反映: 植えた <b>${na}</b>・消した <b>${nd}</b>`;
    this.out.hidden = true;
  }
  flash(text, ms = 1600) {
    this.msg.textContent = text;
    clearTimeout(this.msgT);
    this.msgT = setTimeout(() => (this.msg.textContent = ''), ms);
  }
}
