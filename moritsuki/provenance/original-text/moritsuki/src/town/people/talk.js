// 会話: 近づくと頭の上に「E 話す」、話しはじめると肩ごしのカメラに寄り、せりふを 1 文字ずつ出す（相手の口も動く）。
// 選択肢は ↑↓・W/S・マウスの上下でえらび、E・Space・Enter・クリックで決める。数字キーでも選べる。
// director（quests.js の QuestBook）があれば、頼まれごとの会話を先に聞く（open が null ならいつもの台本）。
// 会話の行 { act: fn } は表示せずにその場で実行する（物をわたす・お小遣いをもらう）。選択肢の行き先は台本の名前か、行の配列
import * as THREE from 'three';
import { SCRIPTS } from './lines.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const damp = (a, b, rate, dt) => a + (b - a) * (1 - Math.exp(-rate * dt));
const ease = (t) => t * t * (3 - 2 * t);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3();

const TALK_R = 2.4;    // 話しかけられる距離
const KEY = 'yoshiyama.talk';
const FOV_TALK = 25;

export class Talk {
  // people: [{ npc, id }]  player: PlayerController  world: 歩ける場所  input: Input
  constructor({ people, player, world, input, camera, scene }) {
    this.people = people.map((p) => ({ ...p, script: SCRIPTS[p.id] }));
    this.player = player; this.world = world; this.input = input; this.camera = camera;
    this.fov0 = camera.fov;
    this.cur = null;      // 話している相手
    this.near = null;     // 話しかけられる相手
    this.onStart = null; this.onEnd = null;
    this.enabled = true;
    this.director = null;
    try { this.visits = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { this.visits = {}; }
    this.buildDom();
    // 会話中だけ、カメラの側から相手の顔を照らす（逆光でも表情が見えるように）。明かりの数を変えないよう最初から置いておく
    this.fill = new THREE.SpotLight('#fff1e2', 0, 8, 0.42, 0.7, 1.6);
    this.fill.castShadow = false;
    scene?.add(this.fill, this.fill.target);
  }

  get active() { return !!this.cur; }
  // メニュー・空の上など、歩いていない間は頭の上の案内を消す
  hidePrompt() { this.near = null; this.prompt.classList.remove('show'); }

  buildDom() {
    const el = (tag, cls, parent, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html) e.innerHTML = html; parent?.appendChild(e); return e; };
    this.prompt = el('div', '', document.body, '<kbd>E</kbd><span>話す</span>');
    this.prompt.id = 'talk-prompt';
    this.root = el('div', '', document.body);
    this.root.id = 'talk';
    el('div', 'talk-bar top', this.root); el('div', 'talk-bar bot', this.root);
    this.ask = el('div', 'talk-ask', this.root);
    this.box = el('div', 'talk-box', this.root);
    this.nameEl = el('div', 'talk-name', this.box);
    this.textEl = el('div', 'talk-text', this.box);
    this.nextEl = el('div', 'talk-next', this.box, '<i></i>');
    this.keysEl = el('div', 'talk-keys', this.root, '<kbd>E</kbd>・<kbd>Space</kbd>・クリック　つぎへ');
  }

  save() { try { localStorage.setItem(KEY, JSON.stringify(this.visits)); } catch (e) { /* 保存できない環境 */ } }

  // 毎フレーム。会話中（または始めた直後）は true を返す（主人公の操作をしない）
  update(dt, camera) {
    this.easeFov(dt);
    this.updateFill(dt);
    if (!this.cur) {
      this.findNear();
      this.player.noKeyE = !!this.near;
      if (this.near && this.enabled && (this.input.pressed('KeyE') || this.input.pressed('Enter') || this.input.leftPressed)) {
        this.start(this.near);
        return true;
      }
      return false;
    }
    this.player.noKeyE = true;
    this.tick(dt, camera);
    return true;
  }

  // ---------- 近くの相手と、頭の上の案内 ----------
  findNear() {
    const P = this.player.pos;
    let best = null, bd = TALK_R;
    for (const e of this.people) {
      if (!e.npc.root.visible) continue;
      const dx = e.npc.pos.x - P.x, dz = e.npc.pos.z - P.z, d = Math.hypot(dx, dz);
      if (d > bd || Math.abs(e.npc.pos.y - P.y) > 1.2) continue;
      // 相手のほうを向いているか、すぐそば
      const ang = Math.abs(wrap(Math.atan2(dx, dz) - this.player.facing));
      if (ang > 1.25 && d > 1.3) continue;
      best = e; bd = d;
    }
    this.near = best;
    const show = !!best && this.enabled;
    this.prompt.classList.toggle('show', show);
    if (show) {
      const n = best.npc;
      _a.set(n.pos.x, n.pos.y + n.height + 0.32, n.pos.z).project(this.camera);
      if (_a.z > 1) { this.prompt.classList.remove('show'); return; }
      this.prompt.style.transform = `translate(${((_a.x + 1) / 2) * innerWidth}px, ${((1 - _a.y) / 2) * innerHeight}px) translate(-50%, -100%)`;
      this.prompt.querySelector('span').textContent = `${best.script.name}と話す`;
    }
  }

  // ---------- はじめる・おわる ----------
  start(e) {
    const n = e.npc, S = e.script;
    const v = this.visits[e.id] || 0;
    const node = this.director?.open(e.id, S, v) || S.nodes[v === 0 ? S.first : S.again[(v - 1) % S.again.length]];
    this.visits[e.id] = v + 1;
    this.save();
    this.cur = { e, n, S, node, i: -1, t: 0, shot: 0, choice: null, sel: 0, my: 0, typing: null, done: false };
    n.beginTalk(this.player.pos);
    this.prompt.classList.remove('show');
    this.nameEl.textContent = S.name;
    this.root.classList.add('show');
    document.body.classList.add('talking');
    // カメラ: 今の位置から肩ごしへ
    this.cam0 = this.camera.position.clone();
    this.tgt0 = _a.set(0, 0, -1).applyQuaternion(this.camera.quaternion).multiplyScalar(4).add(this.camera.position).clone();
    this.side = this.pickSide();
    this.onStart?.();
    this.next();
  }

  end() {
    const c = this.cur;
    if (!c) return;
    c.n.endTalk();
    this.lastCur = c;
    this.cur = null;
    this.root.classList.remove('show');
    this.ask.classList.remove('show');
    document.body.classList.remove('talking');
    const P = this.player;
    P.kid.lookAt = null;
    // 主人公のカメラへなめらかに戻す（主人公の背中から相手を見る向き）
    P.camYaw = P.facing + Math.PI;
    P.camPitch = 0.22;
    P.camPos.copy(this.camera.position);
    this.onEnd?.();
  }

  // 次の行へ（行の終わりまで来たら選択肢か、おしまい）
  next() {
    const c = this.cur;
    c.i++;
    let item = c.node[c.i];
    while (item?.act) { item.act(); item = c.node[++c.i]; }
    if (!item) {
      c.n.setMood('smile');
      this.end();
      return;
    }
    if (item.ask) {
      c.choice = item.ask;
      c.sel = 0; c.my = 0;
      this.ask.innerHTML = '';
      item.ask.forEach(([label], k) => {
        const b = document.createElement('div');
        b.className = 'opt';
        b.innerHTML = `<b>${k + 1}</b><span>${label}</span>`;
        this.ask.appendChild(b);
      });
      this.ask.classList.add('show');
      this.markSel();
      this.nextEl.classList.remove('show');
      this.keysEl.innerHTML = '<kbd>↑</kbd><kbd>↓</kbd> えらぶ　<kbd>E</kbd>・クリック　決める';
      return;
    }
    c.choice = null;
    this.ask.classList.remove('show');
    const n = c.n;
    if (item.mood) n.setMood(item.mood);
    if (item.pose) n.setPose(item.pose);
    else if (c.i === 0 || item.g) n.setPose(n.poses.talk ? (n.id === 'natsumi' ? 'talkHip' : 'talk') : n.base);
    if (item.g) n.gesture(item.g);
    c.typing = { chars: [...item.t], k: 0, t: 0.12, wait: 0 };
    this.textEl.innerHTML = '';
    this.nextEl.classList.remove('show');
    this.keysEl.innerHTML = '<kbd>E</kbd>・<kbd>Space</kbd>・クリック　つぎへ';
  }

  markSel() {
    const c = this.cur;
    [...this.ask.children].forEach((b, k) => b.classList.toggle('sel', k === c.sel));
  }

  // ---------- 毎フレーム（会話中）----------
  tick(dt, camera) {
    const c = this.cur, inp = this.input;
    const go = inp.pressed('KeyE') || inp.pressed('Space') || inp.pressed('Enter') || inp.leftPressed;
    const [, my] = inp.consumeMouse(dt);
    if (c.typing) {
      const T = c.typing;
      if (go && T.k > 1) {
        // 残りを全部出す
        while (T.k < T.chars.length) this.putChar(T.chars[T.k++], false);
      } else {
        T.t -= dt;
        while (T.t <= 0 && T.k < T.chars.length) {
          const ch = T.chars[T.k++];
          this.putChar(ch, true);
          c.n.speak(ch);
          this.onChar?.(ch);
          T.t += /[。！？!?]/.test(ch) ? 0.26 : /[、…]/.test(ch) ? 0.14 : ch === '　' ? 0.08 : 0.034;
        }
      }
      if (T.k >= T.chars.length) { c.typing = null; this.nextEl.classList.add('show'); }
    } else if (c.choice) {
      const n = c.choice.length;
      c.my += my;
      let mv = 0;
      if (inp.pressed('ArrowDown') || inp.pressed('KeyS')) mv = 1;
      if (inp.pressed('ArrowUp') || inp.pressed('KeyW')) mv = -1;
      if (Math.abs(c.my) > 70) { mv = Math.sign(c.my); c.my = 0; }
      for (let k = 0; k < n; k++) if (inp.pressed('Digit' + (k + 1))) { c.sel = k; this.markSel(); this.choose(); return; }
      if (mv) { c.sel = (c.sel + mv + n) % n; this.markSel(); }
      if (go) { this.choose(); return; }
    } else if (go) {
      this.next();
      if (!this.cur) return;
    }
    this.moveKid(dt);
    this.shotCamera(dt, camera);
  }

  choose() {
    const c = this.cur;
    const [, to] = c.choice[c.sel];
    this.ask.querySelectorAll('.opt')[c.sel]?.classList.add('picked');
    // うなずいて次の話へ
    c.n.gesture('nod');
    c.node = Array.isArray(to) ? to : c.S.nodes[to] || [];
    c.i = -1;
    c.choice = null;
    setTimeout(() => this.ask.classList.remove('show'), 120);
    this.next();
  }

  putChar(ch, anim) {
    const s = document.createElement('span');
    s.textContent = ch;
    if (anim) s.className = 'in';
    this.textEl.appendChild(s);
  }

  // ---------- 主人公: 相手の方を向き、近すぎ・遠すぎなら少し歩いて、相手の顔を見上げる ----------
  moveKid(dt) {
    const P = this.player, n = this.cur.n, k = P.kid;
    const dx = n.pos.x - P.pos.x, dz = n.pos.z - P.pos.z, d = Math.hypot(dx, dz);
    const want = Math.atan2(dx, dz);
    P.facing += wrap(want - P.facing) * Math.min(1, dt * 8);
    let speed = 0;
    const ideal = 1.4;
    if (d < 1.1 || d > 1.75) {
      const step = clamp(d - ideal, -1, 1) * Math.min(1, dt * 2.2);
      const nx = P.pos.x + (dx / d) * step, nz = P.pos.z + (dz / d) * step;
      if (!this.world.blocked(nx, nz)) {
        P.pos.x = nx; P.pos.z = nz;
        P.pos.y = this.world.groundAt(nx, nz, P.pos.y + 0.5);
        speed = Math.abs(step) / dt;
      }
    }
    k.root.position.copy(P.pos);
    k.root.rotation.y = P.facing;
    // 見上げる（頭のピッチは負 = 上）
    const up = n.pos.y + n.height - 0.1 - (P.pos.y + 1.2);
    k.lookAt = [0, clamp(-Math.atan2(up, Math.max(0.6, d)) * 0.9, -0.5, 0.2)];
    k.animate(dt, speed, false, { ground: (x, z) => this.world.groundAt(x, z, P.pos.y + 0.5) });
  }

  // ---------- カメラ: 主人公の肩ごしに相手の顔（少し見上げる）----------
  pickSide() {
    const P = this.player.pos, n = this.cur.n;
    const dx = n.pos.x - P.x, dz = n.pos.z - P.z, d = Math.hypot(dx, dz) || 1;
    const fx = dx / d, fz = dz / d;
    let best = 1, bs = -1;
    for (const s of [1, -1]) {
      // 主人公の右（s = 1）/ 左。後ろと横に壁がないほう
      const rx = -fz * s, rz = fx * s;
      let free = 0;
      for (let t = 0.3; t <= 1.8; t += 0.3) {
        const x = P.x - fx * t * 0.9 + rx * t * 0.45, z = P.z - fz * t * 0.9 + rz * t * 0.45;
        if (!this.world.solidAt(x, P.y + 1.5, z)) free++;
      }
      if (free > bs) { bs = free; best = s; }
    }
    return best;
  }

  shotCamera(dt, camera) {
    const c = this.cur, P = this.player.pos, n = c.n;
    c.shot = Math.min(1, c.shot + dt / 0.75);
    const dx = n.pos.x - P.x, dz = n.pos.z - P.z, d = Math.hypot(dx, dz) || 1;
    const fx = dx / d, fz = dz / d, s = this.side;
    const rx = -fz * s, rz = fx * s;
    // 主人公の後ろ・横・少し上から
    const back = 1.75, side = 1.0;
    _b.set(P.x - fx * back + rx * side, P.y + 1.72, P.z - fz * back + rz * side);
    const gmin = this.world.groundAt(_b.x, _b.z, 99) + 0.5;
    if (_b.y < gmin) _b.y = gmin;
    // 見る所: 相手の胸もと（せりふの紙の上に顔が来るように）。主人公の肩は画面の端に少し入る
    _c.set(n.pos.x - rx * 0.26, n.pos.y + n.height * 0.8, n.pos.z - rz * 0.26);
    // ゆっくり呼吸するように揺らす
    const t = performance.now() / 1000;
    _b.x += Math.sin(t * 0.5) * 0.02; _b.y += Math.sin(t * 0.37) * 0.012;
    const e = ease(c.shot);
    if (c.shot < 1) {
      camera.position.lerpVectors(this.cam0, _b, e);
      _a.lerpVectors(this.tgt0, _c, e);
      camera.lookAt(_a);
    } else {
      camera.position.lerp(_b, 1 - Math.exp(-dt * 6));
      c.look = (c.look || _c.clone()).lerp(_c, 1 - Math.exp(-dt * 6));
      camera.lookAt(c.look);
    }
    c.look ||= _c.clone();
    if (c.shot < 1) c.look.copy(_a);
  }

  // 相手の顔を照らす明かり
  updateFill(dt) {
    const on = this.cur ? 1 : 0;
    this.fillK = damp(this.fillK || 0, on, 3, dt);
    this.fill.intensity = this.fillK * 16;
    // visible は切りかえない（明かりの数が変わるとシェーダーを作り直して一瞬止まる）
    if (!this.cur && this.fillK < 0.002) return;
    const n = (this.cur || this.lastCur)?.n;
    if (!n) return;
    this.fill.position.copy(this.camera.position).add(_a.set(0, 0.35, 0));
    this.fill.target.position.set(n.pos.x, n.pos.y + n.height - 0.2, n.pos.z);
    this.fill.target.updateMatrixWorld();
  }

  easeFov(dt) {
    const want = this.cur ? FOV_TALK : this.fov0;
    if (Math.abs(this.camera.fov - want) > 0.01) {
      this.camera.fov = damp(this.camera.fov, want, 5, dt);
      this.camera.updateProjectionMatrix();
    }
  }
}
