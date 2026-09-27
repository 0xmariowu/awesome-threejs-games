// ?debug のときだけ: 湊さんの家・研究所の前に立って E で「大きさ（段階）」をえらぶ。会話（people/talk.js）と同じ手ざわりで、
// 近づくと頭の上に「E 大きさを変える」、話しかけると建物全体が入るカメラに寄り、左の札から段階をえらんで E で建て替える。
// えらんでいる間は札を閉じずに何度でも建て替えられる。やめるは Q・Backspace・札のいちばん下
import * as THREE from 'three';

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const ease = (t) => t * t * (3 - 2 * t);
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _box = new THREE.Box3(), _mb = new THREE.Box3();

const PICK_R = 2.6; // 立ち位置からこの距離まで

export class StagePick {
  // sites: stageSite.js の StageSite（spot = 立ち位置、face = 建物の方）
  constructor({ sites, player, input, camera, scene, world }) {
    this.sites = sites; this.player = player; this.input = input; this.camera = camera; this.world = world;
    this.cur = null; this.near = null;
    this.enabled = true;
    this.onOpen = null; this.onClose = null;
    this.buildDom();
    // 立ち位置の目印（デバッグ用のひし形。遠くからでも見つけられるように）
    const mat = new THREE.MeshBasicMaterial({ color: '#ffb321', fog: false, transparent: true, opacity: 0.9, depthWrite: false });
    const ring = new THREE.MeshBasicMaterial({ color: '#ffb321', fog: false, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide });
    this.marks = sites.map((s) => {
      const g = new THREE.Group();
      const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.2, 0), mat);
      gem.scale.y = 1.6;
      const base = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.62, 40), ring);
      base.rotation.x = -Math.PI / 2;
      g.add(gem, base);
      const y = world.groundAt(s.spot[0], s.spot[1], 99);
      g.position.set(s.spot[0], y, s.spot[1]);
      base.position.y = 0.04;
      g.userData = { gem, y };
      scene.add(g);
      return g;
    });
  }

  get active() { return !!this.cur; }
  // メニュー・タイトル・空の上では出さない
  hidePrompt() { this.near = null; this.prompt.classList.remove('show'); }

  buildDom() {
    const el = (tag, cls, parent, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html) e.innerHTML = html; parent?.appendChild(e); return e; };
    this.prompt = el('div', '', document.body, '<kbd>E</kbd><span>大きさを変える</span><i>DEBUG</i>');
    this.prompt.id = 'stage-prompt';
    this.root = el('div', '', document.body);
    this.root.id = 'stage-pick';
    el('div', 'sp-bar top', this.root); el('div', 'sp-bar bot', this.root);
    const card = el('div', 'sp-card', this.root);
    const head = el('div', 'sp-head', card);
    el('span', 'sp-tag', head, 'DEBUG');
    this.nameEl = el('b', 'sp-name', head);
    el('small', '', head, '大きさ（段階）をえらぶ');
    this.list = el('ol', 'sp-list', card);
    this.foot = el('div', 'sp-foot', card);
    el('div', 'sp-keys', this.root, '<kbd>↑</kbd><kbd>↓</kbd> えらぶ　<kbd>E</kbd>・<kbd>Enter</kbd> 建てる　<kbd>Q</kbd> やめる');
  }

  // 毎フレーム（会話中でないとき）。えらんでいる間は true を返す（主人公の操作をしない）
  update(dt, camera) {
    this.bob();
    if (!this.cur) {
      this.findNear();
      if (this.near) {
        this.player.noKeyE = true;
        if (this.input.pressed('KeyE') || this.input.pressed('Enter')) { this.open(this.near); return true; }
      }
      return false;
    }
    this.tick(dt, camera);
    return true;
  }

  bob() {
    const t = performance.now() / 1000;
    for (const g of this.marks) {
      const { gem } = g.userData;
      gem.position.y = 1.9 + Math.sin(t * 2.2) * 0.08;
      gem.rotation.y = t * 1.4;
      g.visible = !this.cur;
    }
  }

  findNear() {
    const P = this.player.pos;
    let best = null, bd = PICK_R;
    if (this.enabled) for (const s of this.sites) {
      const d = Math.hypot(s.spot[0] - P.x, s.spot[1] - P.z);
      if (d < bd) { best = s; bd = d; }
    }
    this.near = best;
    this.prompt.classList.toggle('show', !!best);
    if (!best) return;
    _a.set(best.spot[0], this.player.pos.y + 2.35, best.spot[1]).project(this.camera);
    if (_a.z > 1) { this.prompt.classList.remove('show'); return; }
    this.prompt.style.transform = `translate(${((_a.x + 1) / 2) * innerWidth}px, ${((1 - _a.y) / 2) * innerHeight}px) translate(-50%, -100%)`;
    this.prompt.querySelector('span').textContent = `${best.name}の大きさを変える`;
  }

  // ---------- ひらく・とじる ----------
  open(site) {
    this.cur = { site, sel: site.level, my: 0, shot: 0, busy: false };
    this.prompt.classList.remove('show');
    this.nameEl.textContent = site.name;
    this.list.innerHTML = '';
    const rows = [...site.levels.map((l, k) => [k, l.label]), [-1, 'やめる']];
    for (const [k, label] of rows) {
      const li = document.createElement('li');
      li.dataset.k = k;
      if (k < 0) li.className = 'quit';
      li.innerHTML = k < 0 ? `<b>×</b><span>${label}</span>` : `<b>${k}</b><span>${label}</span><em>いま</em>`;
      li.addEventListener('mouseenter', () => { if (!this.input.locked) this.select(k); });
      li.addEventListener('click', () => { this.select(k); this.choose(); });
      this.list.appendChild(li);
    }
    this.foot.textContent = '';
    this.mark();
    this.root.classList.add('show');
    document.body.classList.add('talking');
    this.player.frozen = true;
    this.cam0 = this.camera.position.clone();
    this.tgt0 = _a.set(0, 0, -1).applyQuaternion(this.camera.quaternion).multiplyScalar(6).add(this.camera.position).clone();
    this.frame();
    this.onOpen?.();
  }

  close() {
    if (!this.cur) return;
    this.cur = null;
    this.root.classList.remove('show');
    document.body.classList.remove('talking');
    const P = this.player;
    P.frozen = false;
    P.kid.lookAt = null;
    // 主人公のカメラへなめらかに戻す（背中から建物を見る向き）
    P.camYaw = P.facing + Math.PI;
    P.camPitch = 0.22;
    P.camPos.copy(this.camera.position);
    this.onClose?.();
  }

  // 札の行（k = 段階、-1 = やめる）
  select(k) {
    const c = this.cur;
    if (!c || c.busy) return;
    c.sel = k;
    this.mark();
  }

  mark() {
    const c = this.cur;
    for (const li of this.list.children) {
      const k = +li.dataset.k;
      li.classList.toggle('sel', k === c.sel);
      li.classList.toggle('now', k === c.site.level);
    }
    this.list.querySelector('.sel')?.scrollIntoView({ block: 'nearest' });
  }

  choose() {
    const c = this.cur;
    if (!c || c.busy) return;
    if (c.sel < 0) { this.close(); return; }
    if (c.sel === c.site.level) { this.foot.textContent = 'いまの大きさです'; return; }
    c.busy = true;
    this.root.classList.add('busy');
    this.foot.textContent = '建てています…';
    // 札の表示を先に出してから建てる（大きい段階は数百 ms かかる）
    requestAnimationFrame(() => setTimeout(() => {
      const t0 = performance.now();
      c.site.build(c.sel);
      const ms = Math.round(performance.now() - t0);
      c.busy = false;
      this.root.classList.remove('busy');
      if (this.cur !== c) return;
      this.foot.textContent = `「${c.site.levels[c.sel].label}」に建て替えました（${ms} ms）`;
      this.mark();
      this.frame();
      c.shot = 0; this.cam0 = this.camera.position.clone(); this.tgt0 = c.look.clone();
    }, 0));
  }

  // ---------- カメラ: 建物全体が画面の右 2/3 に収まる斜め前から ----------
  frame() {
    const c = this.cur, s = c.site;
    _box.makeEmpty();
    for (const m of s.meshes) {
      if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
      _box.union(_mb.copy(m.geometry.boundingBox).applyMatrix4(m.matrixWorld));
    }
    if (_box.isEmpty()) _box.setFromCenterAndSize(_a.set(s.spot[0], this.player.pos.y + 2, s.spot[1]), _b.set(10, 4, 10));
    const ctr = _box.getCenter(new THREE.Vector3()), size = _box.getSize(new THREE.Vector3());
    // 建物の前（立ち位置の側）から、少し右へ回りこんで、少し見下ろす
    let fx = s.spot[0] - s.face[0], fz = s.spot[1] - s.face[1];
    const l = Math.hypot(fx, fz) || 1; fx /= l; fz /= l;
    const yaw = Math.atan2(fx, fz) + 0.42;
    // 見る向きに対する建物の幅・奥行き。上下は黒い帯（7vh ずつ）、横は左の札のぶん、使える画角をせまく見る
    const sy = Math.sin(yaw), cy = Math.cos(yaw);
    const wide = Math.max(8, Math.abs(size.x * cy) + Math.abs(size.z * sy)), deep = Math.abs(size.x * sy) + Math.abs(size.z * cy);
    const vt = Math.tan(THREE.MathUtils.degToRad(this.camera.fov) * 0.84 / 2), ht = Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2) * this.camera.aspect * 0.64;
    const dist = (Math.max(Math.max(4, size.y) * 0.56 / vt, wide * 0.52 / ht) + deep * 0.5) * 1.04;
    const pitch = 0.2;
    const pos = new THREE.Vector3(ctr.x + sy * Math.cos(pitch) * dist, ctr.y + Math.sin(pitch) * dist, ctr.z + cy * Math.cos(pitch) * dist);
    pos.y = Math.max(pos.y, this.world.groundAt(pos.x, pos.z, 99) + 2);
    // 札が左にかかるので、見る所を少し左へずらして建物を右に寄せる（右向き = (cos, -sin)）
    const sh = dist * Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2) * this.camera.aspect * 0.3;
    const look = ctr.clone().add(_a.set(-cy * sh, -size.y * 0.04, sy * sh));
    c.want = { pos, look };
    c.look ||= this.tgt0.clone();
  }

  // ---------- 毎フレーム（えらんでいる間）----------
  tick(dt, camera) {
    const c = this.cur, inp = this.input;
    const [, my] = inp.consumeMouse(dt);
    if (!c.busy) {
      const n = c.site.levels.length + 1, rows = [...c.site.levels.keys(), -1];
      let idx = rows.indexOf(c.sel), mv = 0;
      c.my += my;
      if (inp.pressed('ArrowDown') || inp.pressed('KeyS')) mv = 1;
      if (inp.pressed('ArrowUp') || inp.pressed('KeyW')) mv = -1;
      if (Math.abs(c.my) > 60) { mv = Math.sign(c.my); c.my = 0; }
      if (mv) { idx = (idx + mv + n) % n; this.select(rows[idx]); }
      if (inp.pressed('KeyQ') || inp.pressed('Backspace')) { this.close(); return; }
      if (inp.pressed('KeyE') || inp.pressed('Enter') || inp.pressed('Space') || inp.leftPressed) this.choose();
    }
    if (!this.cur) return;
    // 主人公は建物の方を向いて立っている
    const P = this.player, s = c.site;
    const want = Math.atan2(s.face[0] - P.pos.x, s.face[1] - P.pos.z);
    P.facing += wrap(want - P.facing) * Math.min(1, dt * 6);
    P.kid.lookAt = [0, -0.35];
    P.idle(dt);
    // カメラ
    c.shot = Math.min(1, c.shot + dt / 1.1);
    const e = ease(c.shot), W = c.want;
    if (c.shot < 1) {
      camera.position.lerpVectors(this.cam0, W.pos, e);
      c.look.lerpVectors(this.tgt0, W.look, e);
    } else {
      camera.position.lerp(W.pos, 1 - Math.exp(-dt * 4));
      c.look.lerp(W.look, 1 - Math.exp(-dt * 4));
    }
    camera.lookAt(c.look);
  }
}
