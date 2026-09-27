// ハマグリ突きの本体: 状態の流れ・突く・掘る・獲れた演出・潮・大波・結果
import * as THREE from 'three';
import { audio } from './core/audio.js';
import { Input } from './core/input.js';
import { Post } from './post.js';
import { World } from './world.js';
import { Backdrop } from './backdrop.js';
import { Field, LOW_TIDE } from './field.js';
import { Marks } from './marks.js';
import { Body } from './body.js';
import { Tool } from './tool.js';
import { HALF, SHAFT_TOP } from './rod.js';
import { Player } from './player.js';
import { FX } from './fx.js';
import { makeShell, setWet } from './clams.js';
import { renderThumbs } from './thumbs.js';
import { SHELLS, ZUKAN_IDS, LEGEND_IDS, RANKS, valueOf, weightOf } from './species.js';
import { UI, yen, legendUnlocked } from './ui.js';
import { save } from './save.js';
import { NetBag } from './netbag.js';
import { townLink } from '../shared/townLink.js';
import { clamp, lerp, smoothstep, RNG } from './core/noise.js';

// 町から来たとき（/hamaguri/?town）: タイトル・結果に「町に帰る」、獲った物は町の持ち物へ
const { TOWN, townURL, applyTownTexts, stashCatch } = townLink({ from: 'hamaguri', title: '蛤突き — 南の浜（吉山）' });

const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const SESSION = 300;               // 干潮の遊べる時間（秒）
const TIDE_END = 0.27;             // 終わりの潮位
const START = { x: 12, z: 22 };
const rand = (a, b) => a + (b - a) * Math.random();

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.mode = 'loading';
    this.t = 0;
    this.timers = [];
    this.debug = new URLSearchParams(location.search).has('debug');
    this.mute = new URLSearchParams(location.search).has('mute');
  }

  // ───────── 初期化 ─────────
  async init() {
    save.load();
    const S = save.data.settings;
    const renderer = (this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: false, powerPreference: 'high-performance' }));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.95;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene = new THREE.Scene();
    this.overlay = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.03, 4000);
    this.scene.add(this.camera);
    this.ui = new UI();
    this.input = new Input(this.canvas);
    this.input.dragLook = this.debug;

    this.world = new World(this.scene, renderer);
    await this.world.build((p, m) => this.ui.loading(p * 0.5, m));
    this.ui.loading(0.55, '松林を植えています');
    await tick();
    this.backdrop = new Backdrop(this.scene, this.world.beach);
    await this.backdrop.build((p, m) => this.ui.loading(0.55 + p * 0.2, m));
    this.post = new Post(renderer, this.scene, this.overlay, this.camera, this.world.beach, this.world.murk);
    this.applyQuality(S.quality);
    this.resize();
    addEventListener('resize', () => this.resize());

    this.ui.loading(0.78, '貝を砂にもぐらせています');
    await tick();
    this.newField(save.data.days + 1);
    this.marks = new Marks(this.scene, this.world.beach);
    this.fx = new FX(this.scene, this.overlay);
    this.fx.setPR(this.pr);
    this.player = new Player(this.camera, this.world);
    this.body = new Body(this.scene, this.camera);
    this.tool = new Tool(this.scene);
    this.bag = new NetBag(this.scene);
    this.tool.onPlunge = (p) => this.onPlunge(p);
    this.tool.onStrike = (p) => this.onStrike(p);
    this.applySettings();

    this.ui.loading(0.86, '図鑑の挿絵を描いています');
    await tick();
    Object.assign(this.ui.thumbs, renderThumbs([...ZUKAN_IDS, ...LEGEND_IDS, 'kara', 'ishi', 'ryuboku']));

    this.ui.loading(0.94, 'シェーダーを温めています');
    await tick();
    this.titleSetup();
    this.titleCam(0);
    try { await renderer.compileAsync(this.scene, this.camera); } catch (e) { renderer.compile(this.scene, this.camera); }
    this.post.render();
    this.ui.loading(1, '準備完了');

    applyTownTexts();
    this.bindUI();
    window.game = this;
    if (this.debug) this.installDebug();
    this.last = performance.now();
    requestAnimationFrame((t) => this.loop(t));
    await new Promise((r) => setTimeout(r, 400));
    this.toTitle(true);
  }

  newField(day) {
    this.field = new Field(this.world.beach, day, { legends: legendUnlocked() });
    this.world.field = this.field;
    if (this.marks) this.marks.refreshSiphons();
  }

  installDebug() {
    const g = this;
    window.dbg = {
      async play() { while (g.mode !== 'title') await new Promise((r) => setTimeout(r, 100)); g.ui.only(); g.beginPlay(); },
      step(n = 1, dt = 1 / 60) { for (let i = 0; i < n; i++) { g.t += dt; g.update(dt); g.input.endFrame(); } g.post.render(); },
      tp(x, z, yaw = Math.PI, pitch = -0.8) { g.player.reset(x, z, yaw); g.player.pitch = pitch; g.bag.reset(); },
      stab(n = 1) { for (let i = 0; i < n; i++) g.tool.press(); },
      // いちばん近い生き物の上へ
      near(id) {
        const p = g.player.pos;
        let best = null, bd = 1e9;
        for (const it of g.field.items) {
          if (!it.alive || (id && it.id !== id)) continue;
          const d = Math.hypot(it.x - p.x, it.z - p.z);
          if (d < bd) { bd = d; best = it; }
        }
        return best;
      },
      // 生き物 it の前に立って、真上を狙う
      aimAt(it) {
        g.player.reset(it.x, it.z + 0.45, Math.PI);
        g.player.pos.z = it.z - 0.45; g.player.yaw = Math.PI; g.player.pitch = -1.0;
        g.tool.headS = V3(it.x, 0, it.z); g.tool.head.set(it.x, 0, it.z);
        g.aimLock = V3(it.x, 0, it.z);
      },
      tide(k) { g.tideT = k; },
      // 描画ループを止めて、step で進める（Browser pane が隠れている時の確認用）
      freeze() { g.loop = () => {}; },
      // id の貝の上を突いて、しゃがんで掘り、見えるところまで掻く
      dig(id = 'chosen') {
        const it = this.near(id);
        this.aimAt(it); this.step(20); this.stab(1); this.step(30);
        g.input.edges.add('KeyE'); this.step(1); this.step(50);
        for (let i = 0; i < 60 && g.mode === 'dig'; i++) {
          for (let k = 0; k < 5; k++) { g.input.mdx = (i % 2 ? 1 : -1) * 30; this.step(1); }
          if (g.dig && (g.dig.hole.depth - g.dig.it.depth) / g.dig.it.H > 0.5) break;
        }
        this.step(20);
        g.aimLock = null;
        return it;
      },
      click() { g.input.leftPressed = true; this.step(1); g.input.leftPressed = false; },
      results(list = [['honhama', 7.8], ['chosen', 9.6], ['chosen', 8.1], ['bakagai', 7.1], ['nagarami', 3.2], ['nagarami', 3.5], ['tsumeta', 6]]) {
        for (const [id, cm] of list) g.addCatch({ id, cm, seed: Math.random() });
        g.day = save.data.days + 1;
        return g.endSession();
      },
      unlockLegends() { for (const id of ZUKAN_IDS) save.zk(id).caught = Math.max(1, save.zk(id).caught); save.write(); g.newField(g.day || 1); },
    };
  }

  resize() {
    const w = innerWidth, h = innerHeight;
    this.renderer.setSize(w, h, false);
    this.hz = Math.max(0.6, Math.min(1.25, Math.min(h / 920, w / 1560)));
    document.documentElement.style.setProperty('--hz', this.hz.toFixed(3));
    document.documentElement.style.setProperty('--pz', Math.max(0.62, Math.min(1, h / 860, w / 1180)).toFixed(3));
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.post.setSize(w, h);
  }

  applyQuality(q) {
    const dpr = devicePixelRatio || 1;
    const pr = q === 'low' ? Math.min(dpr, 1) * 0.75 : q === 'high' ? Math.min(dpr, 1.5) : Math.min(dpr, 1);
    this.renderer.setPixelRatio(pr);
    this.post.setPixelRatio(pr);
    this.post.bloom.enabled = q !== 'low';
    this.pr = pr;
    this.fx?.setPR(pr);
    this.resize?.();
  }

  applySettings() {
    const S = save.data.settings;
    this.player.sens = S.sens;
    this.player.invertY = S.invertY;
    this.player.fovBase = S.fov;
    this.body.brim.visible = !!S.brim;
    audio.setVolumes({ master: this.mute ? 0 : S.master, music: S.music, sfx: S.sfx, amb: S.amb });
  }

  bindUI() {
    const act = (a) => {
      audio.init();
      switch (a) {
        case 'start': this.startSession(); break;
        case 'zukan': this.openOverlay('zukan'); break;
        case 'howto': this.openOverlay('howto'); break;
        case 'settings': this.openOverlay('settings'); break;
        case 'credits': this.openOverlay('credits'); break;
        case 'back': this.closeOverlay(); break;
        case 'resume': this.resume(); break;
        case 'quit': this.ui.hide('pause'); this.mode = this.pausedFrom || 'play'; this.endSession(); break;
        case 'again': this.startSession(); break;
        case 'toTitle': this.toTitle(); break;
        case 'toTown': this.toTown(); break;
      }
    };
    document.addEventListener('click', (e) => { const b = e.target.closest('[data-act]'); if (b) act(b.dataset.act); });
    addEventListener('keydown', (e) => {
      if (e.code === 'Escape' && this.overlay) this.closeOverlay();
      else if (e.code === 'Escape' && this.playing && !this.input.locked) this.pause();
    });
    this.ui.bindSettings((k, v) => { if (k === 'quality') this.applyQuality(v); this.applySettings(); });
    this.input.onLockChange = (locked) => {
      if (this.playing && !locked && !this.noPause) this.pause();
      this.ui.lockHint(false);
    };
    this.canvas.addEventListener('click', () => { if (this.playing && !this.input.locked) this.input.lock(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.playing && !this.debug) this.pause(); });
  }
  get playing() { return ['play', 'dig', 'show', 'pull'].includes(this.mode); }

  openOverlay(id) {
    this.overlayFrom = this.mode === 'pause' ? 'pause' : 'title';
    this.overlay = id;
    if (id === 'zukan') this.ui.openZukan(); else this.ui.show(id);
    this.ui.hide(this.overlayFrom);
  }
  closeOverlay() {
    if (!this.overlay) return;
    this.ui.hide(this.overlay);
    this.overlay = null;
    this.ui.show(this.overlayFrom);
    if (this.overlayFrom === 'title') this.ui.titleRecord();
  }

  later(sec, fn) { const tm = { t: sec, fn }; this.timers.push(tm); return tm; }
  showHint(key, html, dur = 5) {
    if (this.hintsShown?.has(key)) return;
    const seen = save.data.hints[key] || 0;
    if (seen >= 2) return;
    this.hintsShown?.add(key);
    save.data.hints[key] = seen + 1;
    this.ui.hint(html, dur);
  }

  // ───────── タイトル ─────────
  titleSetup() {
    // 浅瀬に棒を立てて、そのまわりをゆっくり回る
    const x = -6, z = 17;
    this.titleSpot = V3(x, this.world.groundAt(x, z), z);
    this.tool.planted = { pos: V3(x, this.world.groundAt(x, z) + 0.02, z), yaw: 0.4 };
    this.body.group.visible = false;
    this.bag.group.visible = false;
    this.world.tide = LOW_TIDE;
    this.world.setSun(0.2);
  }
  titleCam(t) {
    const c = this.titleSpot;
    const a = t * 0.05 + 2.2;
    const R = 2.1;
    const cam = this.camera;
    cam.position.set(c.x + Math.cos(a) * R, this.world.tide + 0.42 + Math.sin(t * 0.3) * 0.05, c.z + Math.sin(a) * R);
    cam.lookAt(c.x - Math.cos(a) * 0.6, this.world.tide + 0.22, c.z - Math.sin(a) * 0.6);
    cam.fov = 58;
    cam.updateProjectionMatrix();
  }
  toTitle(first = false) {
    this.mode = 'title';
    this.clearScene();
    this.titleSetup();
    this.input.enabled = false;
    this.input.unlock();
    this.ui.showHud(false);
    this.ui.titleRecord();
    this.ui.only('title');
    this.post.u.uDrops.value = 0;
    this.post.u.uFade.value = 0;
    audio.setMusic('title');
    audio.setAmbience('title');
    if (first) {
      const unlock = () => { audio.init(); audio.setMusic('title'); audio.setAmbience('title'); this.applySettings(); removeEventListener('pointerdown', unlock); };
      addEventListener('pointerdown', unlock);
    }
  }

  // 町に帰る（/hamaguri/?town のとき。暗くして音を消してから移る）
  toTown() {
    if (!TOWN || this.leaving) return;
    this.leaving = true;
    this.ui.only();
    this.ui.fade(true);
    audio.setVolumes({ master: 0 });
    setTimeout(() => { location.href = townURL(); }, 650);
  }

  // ───────── 干潮の始まり ─────────
  async startSession() {
    if (this.mode === 'intro') return;
    audio.init();
    this.mode = 'intro';
    this.input.enabled = false;
    this.ui.only();
    this.ui.fade(true);
    this.input.lock();
    this.noPause = true;
    audio.setMusic('none');
    audio.setAmbience('off');
    await new Promise((r) => setTimeout(r, 800));
    const day = save.data.days + 1;
    this.day = day;
    const shugyo = [{ text: 'ただひたすら砂を突く。', wait: 1400 }, { text: 'まるで修行。', wait: 1300 }, { text: 'しかしこれがハマグリ獲りの現実。', wait: 1700 }];
    const lines = day === 1
      ? [{ text: '南の浜　午前十時半　干潮', cls: 'day', wait: 1400 }, ...shugyo, { text: '足もとの砂の下に、なにかいる。', wait: 1500 }, { text: '突いて、聞け。', wait: 1200 }, { text: '蛤突き。', cls: 'big', wait: 1600, sound: () => audio.taiko(0, 0.7, 70) }]
      : [{ text: `南の浜　${day}回目の干潮`, cls: 'day', wait: 1200 }, ...shugyo, { text: legendUnlocked() && day % 2 ? '河口の砂から、重い音がするらしい。' : ['今日も潮がよく引いた。', 'カチン、を聞きのがすな。', '深い所から、先に。', '一つ当たれば、まわりにもいる。'][day % 4], wait: 1400 }, { text: '蛤突き。', cls: 'big', wait: 1400, sound: () => audio.taiko(0, 0.7, 70) }];
    const shown = this.ui.intro(lines);
    this.ui.fade(false);
    await shown;
    this.ui.fade(true);
    await new Promise((r) => setTimeout(r, 700));
    this.beginPlay();
    this.ui.hide('intro');
    this.ui.fade(false);
  }

  beginPlay() {
    this.clearScene();
    this.mode = 'play';
    this.day = save.data.days + 1;
    if (this.field.day !== this.day) this.newField(this.day);
    this.tideT = 0;
    this.catches = [];
    this.total = 0;
    this.stabsToday = 0;
    this.hits = 0;
    this.contact = null;
    this.dig = null;
    this.showing = null;
    this.ending = false;
    this.timers = [];
    this.hintsShown = new Set();
    this.nextBig = rand(35, 55);
    this.nextTonbi = rand(8, 20);
    this.bestToday = null;
    this.world.waves.big.amp = 0;
    this.world.tide = LOW_TIDE;
    this.player.reset(START.x, START.z, Math.PI);
    this.player.locked = false;
    this.player.lookOverride = null;
    this.player.crouchTarget = 0;
    this.tool.planted = null;
    this.tool.phase = 'idle';
    this.tool.queue = 0;
    this.tool.count = 0;
    this.body.group.visible = true;
    this.body.handMode = 'rod';
    this.bag.group.visible = true;
    this.bag.set(0);
    this.bag.reset();
    this.marks.stabs.clear();
    this.marks.refreshSiphons();
    for (const h of [...this.marks.holes]) this.marks.removeHole(h);
    this.input.enabled = true;
    this.ui.showHud(true);
    this.ui.dimHud(false);
    this.noPause = false;
    this.camera.fov = save.data.settings.fov;
    this.camera.updateProjectionMatrix();
    audio.setMusic('play');
    audio.setAmbience('beach');
    this.later(1.2, () => this.showHint('stab', '<b>左クリック</b>で突く。<b>連打</b>するほど速く、<b>押しっぱなし</b>で突き続ける。', 7));
    this.later(9, () => this.showHint('listen', '砂の中で<b>「カチン」</b>と鳴ったら、そこに貝がいる。歩きながら突きまくれ。', 6));
    // 本ハマグリの居場所（まだ獲っていないうちは毎回）
    this.later(18, () => { if (!save.data.zukan.honhama?.caught) this.ui.hint('<b>本ハマグリ</b>は、西（右手）の河口のそば、<b>砂が黒っぽい所</b>にいる。', 7); else this.showHint('honhamaSpot', '本ハマグリは、西の河口のそばの<b>黒っぽい砂</b>の所にいる。', 6); });
  }

  clearScene() {
    if (this.dig?.shell) this.scene.remove(this.dig.shell.mesh);
    if (this.showing?.shell) this.showing.shell.mesh.parent?.remove(this.showing.shell.mesh);
    if (this.resultGroup) { this.scene.remove(this.resultGroup); this.resultGroup = null; }
    this.dig = null;
    this.showing = null;
    this.ui.dig(false);
    this.ui.struggle(false);
    this.ui.pin(false);
    this.ui.prompt('');
    this.ui.warn('');
  }

  pause() {
    if (!this.playing) return;
    this.pausedFrom = this.mode;
    this.mode = 'pause';
    this.input.enabled = false;
    this.ui.show('pause');
  }
  resume() {
    if (this.mode !== 'pause') return;
    this.ui.hide('pause');
    this.mode = this.pausedFrom || 'play';
    this.input.enabled = true;
    this.input.lock();
  }

  // ───────── ループ ─────────
  loop(now) {
    requestAnimationFrame((t) => this.loop(t));
    const dt = Math.min((now - this.last) / 1000, 0.05);
    this.last = now;
    if (this.mode !== 'pause') this.t += dt;
    try { this.update(dt); } catch (e) { console.error(e); }
    this.post.u.uTime.value = this.t;
    this.post.render();
    this.input.endFrame();
  }

  update(dt) {
    audio.updateMusic(dt);
    const w = this.world;
    if (this.mode === 'pause') return;
    if (this.mode === 'title' || this.mode === 'loading' || this.mode === 'intro') {
      this.titleCam(this.t);
      this.tool.update(dt, { player: this.player, world: w, holding: false, t: this.t });
      this.updateWorld(dt, this.titleSpot);
      return;
    }
    if (this.mode === 'results') {
      this.resultsCam(dt);
      this.updateWorld(dt, this.resultSpot);
      return;
    }
    // ─── 浜 ───
    for (const tm of this.timers) { tm.t -= dt; if (tm.t <= 0 && !tm.done) { tm.done = true; tm.fn(); } }
    this.timers = this.timers.filter((t) => !t.done);
    this.updateTide(dt);
    this.updateBigWaves(dt);
    const p = this.player, inp = this.input;
    p.update(dt, inp, this.t);
    if (this.mode === 'play') this.updatePlay(dt);
    else if (this.mode === 'dig') this.updateDig(dt);
    else if (this.mode === 'pull') this.updatePull(dt);
    else if (this.mode === 'show') this.updateShow(dt);
    this.tool.update(dt, { player: p, world: w, holding: this.mode === 'play' && inp.left && !p.locked, t: this.t });
    this.updateBody(dt);
    this.bag.update(dt, this.body, this.t, p);
    this.updateWorld(dt, p.pos);
    this.updateHud(dt);
    // 顔が水につかる
    const dunk = smoothstep(0.0, 0.04, p.eyeDip);
    this.post.u.uDunk.value = lerp(this.post.u.uDunk.value, dunk, 1 - Math.exp(-12 * dt));
    audio.setDunk(dunk);
    if (dunk > 0.5 && !this.wasDunk) { this.post.u.uDrops.value = 0; audio.splash(0.7); }
    if (dunk < 0.2 && this.wasDunk) { this.post.u.uDrops.value = 1; audio.gasp(); }
    this.wasDunk = dunk > 0.5;
    const u = this.post.u;
    u.uDrops.value = Math.max(0, u.uDrops.value - dt * 0.25);
    u.uFlash.value = Math.max(0, u.uFlash.value - dt * 3);
    this.ui.lockHint(!this.input.locked && !this.input.freeLook && this.playing && !this.showing);
  }

  updateWorld(dt, focus) {
    const w = this.world;
    w.update(dt, this.t, this.camera, focus);
    this.post.water.setBig(w.waves.big);
    this.backdrop.update(dt, this.t, this.camera);
    this.marks.update(dt, this.dig?.hole);
    this.fx.update(dt, (x, z) => w.waterAt(x, z, this.t));
    if (this.mode !== 'title') this.marks.updateSiphons(this.field, focus.x, focus.z);
  }

  // ───── 潮 ─────
  updateTide(dt) {
    if (!this.showing && !this.ending) this.tideT = Math.min(1, this.tideT + dt / SESSION);
    const k = this.tideT;
    this.world.tide = lerp(LOW_TIDE, TIDE_END, k * k * (3 - 2 * k) * 0.35 + k * 0.65);
    this.world.setSun(k);
    if (k > 0.8 && !this.warnedTide) {
      this.warnedTide = true;
      audio.bell();
      this.ui.toast('<b>潮が満ちてきた</b><small>あと 1 分ほどで、浜へ上がる時間</small>', { cls: 'info', icon: '🌊' });
    }
    if (k >= 1 && !this.ending && this.mode === 'play') this.endSession();
    if (k >= 1 && !this.ending && (this.mode === 'dig' || this.mode === 'pull')) {
      this.graceT = (this.graceT || 0) + dt;
      this.ui.warn('潮が満ちた！ 急いで掘り出せ', true);
      if (this.graceT > 15) this.endSession();
    }
  }

  // ───── 大波 ─────
  updateBigWaves(dt) {
    const big = this.world.waves.big;
    const p = this.player;
    this.nextBig -= dt;
    if (this.nextBig <= 0 && big.amp < 0.05) {
      big.z = p.pos.z + 70;
      big.amp = rand(0.55, 0.95);
      big.width = rand(7, 11);
      big.warned = false;
      big.hitHole = false;
      this.nextBig = rand(40, 70);
    }
    if (big.amp > 0) {
      big.z -= 3.3 * dt;
      if (!big.warned && big.z - p.pos.z < 22) {
        big.warned = true;
        this.ui.warn('大きな波が来る！', true);
        audio.wave(big.amp);
        this.later(2.5, () => this.ui.warn(''));
      }
      if (Math.abs(big.z - p.pos.z) < 1.5 && !big.hitMe) {
        big.hitMe = true;
        p.shake = Math.max(p.shake, 0.6);
        const top = this.world.waterAt(p.pos.x, p.pos.z, this.t);
        this.fx.splash(p.pos.x - Math.sin(p.yaw) * 0.3, top, p.pos.z - Math.cos(p.yaw) * 0.3, 20, 1.4);
        this.world.murk.add(p.pos.x, p.pos.z, 1.8, 0.6);
      }
      const h = this.dig?.hole;
      if (h && !big.hitHole && Math.abs(big.z - h.z) < 1.2) {
        big.hitHole = true;
        h.depth = Math.max(0, h.depth - 0.02 * big.amp);
        h.rin = Math.max(0.06, h.rin - 0.01);
        this.marks.shapeHole(h);
        this.world.murk.add(h.x, h.z, 0.6, 0.9);
        this.ui.toast('<b>波で穴が埋まった！</b><small>波の合間に掘ろう</small>', { cls: 'bad', icon: '🌊', dur: 2.5 });
      }
      if (big.z < p.pos.z - 30) { big.amp = 0; big.hitMe = false; }
    }
  }

  // ───── 突く ─────
  updatePlay(dt) {
    const p = this.player, inp = this.input, tool = this.tool;
    if (!p.locked && inp.enabled) {
      tool.aim(p, this.camera, this.world);
      if (this.aimLock) { tool.head.copy(this.aimLock); }
      if (inp.leftPressed) tool.press();
    }
    // 掘る
    const c = this.contact;
    if (c) {
      const d = Math.hypot(c.x - p.pos.x, c.z - p.pos.z);
      c.age += dt;
      if (d > 1.6 || c.age > 14 || !c.it.alive) { this.contact = null; this.ui.prompt(''); }
      else {
        this.ui.prompt(`<kbd>E</kbd>しゃがんで掘る`);
        if (inp.pressed('KeyE') || inp.right && !this._rightWas) this.startDig(c);
      }
    } else this.ui.prompt(p.blocked === 'deep' ? 'ここから先は深すぎる' : '');
    this._rightWas = inp.right;
    if (p.blocked === 'groyne') this.showHint('groyne', '突堤の向こうへは行けない', 3);
    // ヒント
    if (this.stabsToday > 60 && this.hits === 0) this.showHint('comb', '少しずつ歩きながら、<b>くしでとかすように</b>突こう。浅すぎる所より、<b>ひざくらい</b>の深さがいい。', 6);
  }

  onPlunge(pend) {
    audio.plunge();
    const top = this.world.waterAt(pend.x, pend.z, this.t);
    const cross = this.tool.surfaceCross(top);
    if (cross) this.post.water.ripple(cross.x, cross.z, 1);
  }

  onStrike(pend) {
    const w = this.world, g = pend.g;
    this.stabsToday++;
    save.data.stabs = (save.data.stabs || 0) + 1;
    this.ui.stabPop();
    const tc = V3(pend.x, g, pend.z);
    this.marks.stab(pend.x, pend.z, pend.yaw, this.t);
    if (pend.hit) {
      const it = pend.hit.it;
      const sound = it.sp.sound;
      audio.contact(sound, it.L / 0.07);
      this.hits++;
      const tx = pend.tine[0], tz = pend.tine[1];
      this.player.shake = Math.max(this.player.shake, sound === 'gon' ? 1 : 0.25);
      this.fx.sandPuff(tx, g, tz, 6, 0.04, 0.6);
      w.murk.add(pend.x, pend.z, 0.12, 0.12);
      // 突いた所に「カチン」
      const v = V3(tx, g, tz).project(this.camera);
      if (v.z < 1) this.ui.word(sound, (v.x + 1) / 2 * innerWidth / this.hz, (1 - v.y) / 2 * innerHeight / this.hz, sound === 'gon' ? 1 : 0);
      if (sound === 'gon') {
        this.post.u.uFlash.value = 0.25;
        this.later(0.4, () => this.ui.telop('<div class="tl tl-catch tl-legend">なにか、でかい……！</div>', 2));
        audio.heavy();
      }
      this.contact = { it, x: tx, z: tz, cx: pend.x, cz: pend.z, age: 0, yaw: pend.yaw };
      if (this.hits === 1) this.later(0.5, () => this.showHint('dig', '当たった！ <b>E</b>（または右クリック）でしゃがんで<b>手で掘る</b>。', 6));
      if (this.hits === 4) this.later(0.3, () => this.showHint('ear', '音を聞き分けよう。<b>カチン</b>は生きた貝、<b>チャリ</b>は空き殻、<b>ゴツ</b>は石。', 7));
    } else {
      audio.sand(0.8 + Math.random() * 0.3);
      this.fx.sandPuff(pend.x, g, pend.z, 5, 0.09, 0.5);
      if (Math.random() < 0.3) this.fx.bubbles(pend.x, g + 0.01, pend.z, 3, 0.1);
      w.murk.add(pend.x, pend.z, 0.14, 0.07);
    }
  }

  // ───── 掘る ─────
  startDig(c) {
    const p = this.player, it = c.it, w = this.world;
    this.contact = null;
    this.ui.prompt('');
    this.mode = 'dig';
    // 穴は当たった爪の所から、貝の中心へ少し寄せる
    const hx = lerp(c.x, it.x, 0.4), hz = lerp(c.z, it.z, 0.4);
    // 穴の手前 0.34m にしゃがむ
    const dir = V3(hx - p.pos.x, 0, hz - p.pos.z);
    if (dir.lengthSq() < 1e-4) dir.set(-Math.sin(p.yaw), 0, -Math.cos(p.yaw));
    dir.normalize();
    const yaw = Math.atan2(-dir.x, -dir.z);
    this.digFrom = { x: hx - dir.x * 0.5, z: hz - dir.z * 0.5 };
    const hole = this.marks.openHole(hx, hz, 0.3);
    // 棒は穴の右に立てておく
    const side = V3(-dir.z, 0, dir.x);
    const rp = V3(hx + side.x * 0.34 - dir.x * 0.05, 0, hz + side.z * 0.34 - dir.z * 0.05);
    rp.y = w.groundAt(rp.x, rp.z) - 0.03;
    this.tool.planted = { pos: rp, yaw };
    // 砂の中の貝を置く（穴が深くなると見えてくる）
    const shell = makeShell(it.id, it.cm, it.seed);
    this.placeInSand(shell, it);
    this.scene.add(shell.mesh);
    this.dig = { it, hole, shell, t: 0, sweep: 0, lastDir: 0, travel: 0, strokes: 0, seen: false, keyAlt: '', yaw };
    p.crouchTarget = 1;
    p.locked = true;
    p.lookOverride = { yaw, pitch: -1.25, k: 4 };
    this.body.handMode = 'dig';
    audio.splash(0.4);
    this.showHint('scrape', '<b>マウスを左右</b>に振って砂を掻き出す。貝が見えたら<b>クリック</b>でつかむ。<b>E</b> でやめる。', 7);
  }

  placeInSand(shell, it) {
    const g = this.world.groundAt(it.x, it.z);
    const m = shell.mesh;
    const sp = it.sp;
    m.position.set(it.x, g - it.depth - shell.H / 2, it.z);
    m.rotation.set(0, it.yaw, 0);
    if (sp.kind === 'clam') m.rotation.set(0.55 + it.tilt * 0.3, -it.yaw, it.tilt * 0.3);
    else if (sp.kind === 'valve') { m.rotation.set(-Math.PI / 2, 0, it.yaw); m.position.y = g - it.depth - 0.01; }
    else if (sp.kind === 'snail' || sp.kind === 'moon') m.rotation.set(0, it.yaw, 0);
    else if (sp.kind === 'wood') m.rotation.set(0, it.yaw, 0);
  }

  updateDig(dt) {
    const d = this.dig, p = this.player, inp = this.input, h = d.hole, it = d.it;
    d.t += dt;
    // しゃがむ位置へ寄る
    p.pos.x = lerp(p.pos.x, this.digFrom.x, 1 - Math.exp(-6 * dt));
    p.pos.z = lerp(p.pos.z, this.digFrom.z, 1 - Math.exp(-6 * dt));
    // マウスの左右（か A・D の交互）で掻く
    const mx = p.mouse ? p.mouse[0] : 0;
    let stroke = false;
    if (d.t > 0.5) {
      if (Math.abs(mx) > 0.5) {
        const s = Math.sign(mx);
        if (s !== d.lastDir) { if (d.travel > 70) stroke = true; d.travel = 0; d.lastDir = s; }
        d.travel += Math.abs(mx);
      }
      for (const k of ['KeyA', 'KeyD']) if (inp.pressed(k) && d.keyAlt !== k) { d.keyAlt = k; stroke = true; }
      d.sweep = clamp(d.sweep + mx * 0.006, -1, 1);
      if (inp.pressed('KeyA')) d.sweep = -1;
      if (inp.pressed('KeyD')) d.sweep = 1;
    }
    d.sweep *= Math.exp(-dt * 1.5);
    if (stroke) {
      d.strokes++;
      const big = it.sp.legend ? 0.55 : 1;
      h.depth = Math.min(0.32, h.depth + rand(0.008, 0.012) * big);
      h.rin = Math.min(0.2, 0.06 + h.depth * 1.4 + (it.sp.legend ? 0.06 : 0));
      h.pile = Math.min(0.035, h.pile + 0.0025);
      this.marks.shapeHole(h);
      audio.scrape(1);
      this.fx.sandPuff(h.x + d.sweep * 0.12, this.world.groundAt(h.x, h.z) + 0.01, h.z + (Math.random() - 0.5) * 0.2, 3, 0.12, 0.8);
      this.world.murk.add(h.x + (Math.random() - 0.5) * 0.3, h.z + (Math.random() - 0.5) * 0.3, 0.22, 0.045);
      if (Math.random() < 0.4) this.fx.bubbles(h.x, this.world.groundAt(h.x, h.z) - h.depth, h.z, 4, 0.1);
    }
    // 主は砂にもぐって逃げようとする
    if (it.sp.legend && d.seen) {
      it.depth += dt * 0.0045;
      this.placeInSand(d.shell, it);
    }
    const exposure = (h.depth - it.depth) / Math.max(it.H, 0.02);
    if (exposure > 0.05 && !d.seen) {
      d.seen = true;
      audio.touchShell();
      if (it.sp.legend) { this.ui.telop('<div class="tl tl-catch tl-legend">主だ！</div><div><span class="tl-sub red">砂にもぐっていく！ 掻け！</span></div>', 2.2); audio.taiko(0, 0.8, 55); }
    }
    const canGrab = exposure >= 0.35;
    this.ui.dig(true, h.depth / Math.max(it.depth + it.H * 0.35, 0.02), 1, canGrab, it.sp.legend);
    if (canGrab && inp.leftPressed) {
      if (it.sp.legend) this.startPull();
      else this.grab();
      return;
    }
    // やめる
    if (inp.pressed('KeyE') || inp.pressed('KeyS') || (inp.right && !this._rightWas && d.t > 0.4)) this.stopDig();
    this._rightWas = inp.right;
  }

  stopDig() {
    const d = this.dig;
    if (d) this.scene.remove(d.shell.mesh);
    this.dig = null;
    this.mode = 'play';
    this.ui.dig(false);
    const p = this.player;
    p.crouchTarget = 0;
    p.locked = false;
    p.lookOverride = null;
    this.tool.planted = null;
    this.body.handMode = 'rod';
  }

  // 主: 連打で引き抜く
  startPull() {
    this.mode = 'pull';
    this.pull = { p: 0.35, t: 0, jerk: 0.5 };
    this.ui.dig(false);
    audio.taiko(0, 0.9, 50);
    this.post.u.uFlash.value = 0.3;
  }
  updatePull(dt) {
    const s = this.pull, inp = this.input, d = this.dig, p = this.player;
    s.t += dt;
    if (inp.leftPressed) { s.p += 0.075; audio.heavy(); p.shake = Math.max(p.shake, 0.45); this.fx.sandPuff(d.hole.x, this.world.groundAt(d.hole.x, d.hole.z) - d.hole.depth, d.hole.z, 5, 0.12, 1.3); this.world.murk.add(d.hole.x, d.hole.z, 0.3, 0.25); }
    s.p -= dt * 0.16;
    s.jerk -= dt;
    if (s.jerk <= 0) { s.jerk = rand(0.4, 0.9); s.p -= 0.05; p.shake = 0.8; }
    d.shell.mesh.position.y += Math.sin(this.t * 40) * 0.0008;
    this.ui.struggle(true, s.p);
    if (s.p >= 1) {
      this.ui.struggle(false);
      audio.taiko(0, 0.9, 60);
      this.grab();
    } else if (s.p <= 0 || s.t > 12) {
      this.ui.struggle(false);
      d.it.depth += 0.08;
      this.placeInSand(d.shell, d.it);
      d.hole.depth = Math.max(0.02, d.hole.depth - 0.04);
      this.marks.shapeHole(d.hole);
      this.world.murk.add(d.hole.x, d.hole.z, 0.5, 1);
      this.ui.telop(`<div class="tl tl-catch" style="-webkit-text-stroke-color:#5a5a5a">もぐられた…</div><div><span class="tl-sub blue">${d.it.sp.name}は、もう少し深い所に</span></div>`, 2);
      this.mode = 'dig';
      d.seen = false;
    }
  }

  // つかんで水から出す → 見せる
  grab() {
    const d = this.dig, it = d.it, p = this.player;
    this.field.remove(it);
    this.marks.refreshSiphons();
    this.ui.dig(false);
    this.mode = 'show';
    const junk = !!it.sp.junk;
    const shell = d.shell;
    this.dig = null;
    p.crouchTarget = 0;
    p.lookOverride = { yaw: p.yaw, pitch: it.sp.legend ? -0.12 : -0.22, k: 3 };
    this.tool.planted = null;
    this.body.handMode = 'hold';
    audio.splash(it.sp.legend ? 1.4 : 0.9);
    const top = this.world.waterAt(d.hole.x, d.hole.z, this.t);
    this.fx.splash(d.hole.x, top, d.hole.z, it.sp.legend ? 40 : 18, 1.1);
    this.world.murk.add(d.hole.x, d.hole.z, 0.5, 0.6);
    setWet(shell, 1);
    this.showing = { it, shell, t: 0, junk, from: shell.mesh.position.clone(), phase: 'up', celebrate: false };
    const sp = it.sp;
    if (junk) {
      audio.miss();
      this.ui.telop(`<div class="tl tl-catch" style="-webkit-text-stroke-color:#555">${sp.name}だった…</div>`, 1.4, true);
      this.showing.dur = 1.6;
      return;
    }
    const z = save.zk(it.id);
    const isNew = !z.caught;
    const record = it.cm > (z.best || 0) && z.caught > 0;
    const value = valueOf(sp, it.cm);
    const firstToday = this.catches.length === 0;
    const celebrate = firstToday || isNew || sp.legend || (record && it.cm >= sp.size[0] + (sp.size[1] - sp.size[0]) * 0.6);
    this.showing.celebrate = celebrate;
    this.showing.dur = sp.legend ? 5.4 : celebrate ? 3.6 : 1.7;
    this.addCatch({ id: it.id, cm: it.cm, seed: it.seed, isNew });
    audio.pickup(sp.rarity);
    if (sp.legend) {
      this.later(0.3, () => audio.legend());
      this.post.u.uFlash.value = 0.5;
      this.later(0.4, () => this.ui.bigShout('獲れたよー！', `伝説の${sp.name}！`, this.card(it, value, isNew), 4.6));
    } else if (celebrate) {
      this.later(0.35, () => { audio.celebrate(); this.ui.bigShout('獲れたよー！', null, this.card(it, value, isNew), 3.2); });
    } else {
      this.ui.telop(`<div class="tl tl-catch">${sp.name}</div><div><span class="tl-sub">${it.cm}cm</span></div>`, 1.3, true);
    }
    this.ui.toast(`<b>${sp.name}</b> ${it.cm}cm<em>${yen(value)}</em><small>${isNew ? '図鑑に登録！' : record ? '最大記録！' : '網袋に入れた'}</small>`, { img: this.ui.thumbs[it.id], cls: sp.legend ? 'legend' : isNew ? 'info' : '' });
  }
  card(it, value, isNew) {
    return `<div><div class="tl-card"><img src="${this.ui.thumbs[it.id] || ''}" alt=""><div class="n">${it.sp.name} ${it.cm}cm<small>${isNew ? '図鑑に登録' : ''}${weightOf(it.sp, it.cm)}g</small></div><div class="y">+${yen(value)}</div></div></div>`;
  }

  addCatch({ id, cm, seed, isNew = false }) {
    const sp = SHELLS[id];
    const value = valueOf(sp, cm);
    this.catches = this.catches || [];
    this.catches.push({ id, cm, seed, value, isNew });
    this.total = (this.total || 0) + value;
    const z = save.zk(id);
    const wasUnlocked = legendUnlocked();
    z.caught = (z.caught || 0) + 1;
    z.best = Math.max(z.best || 0, cm);
    save.write();
    if (!this.bestToday || value > this.bestToday.value) this.bestToday = { id, cm, value };
    if (!wasUnlocked && legendUnlocked()) this.later(4, () => this.onLegendUnlock());
  }

  onLegendUnlock() {
    this.legendNews = true;
    audio.legend();
    this.ui.telop('<div class="tl tl-catch tl-legend">図鑑がそろった！</div><div><span class="tl-sub">次の干潮から、浜の主が姿を見せる</span></div>', 4);
    this.ui.toast('<b>図鑑に「浜の主」のページが開いた</b><small>河口の本ハマグリの干潟と、沖の瀬の手前の溝。大きな水管の穴が目印</small>', { cls: 'info legend', icon: '★', dur: 7 });
  }

  updateShow(dt) {
    const s = this.showing, p = this.player, cam = this.camera;
    s.t += dt;
    const m = s.shell.mesh;
    const fwd = V3(0, 0, -1).applyQuaternion(cam.quaternion);
    const upv = V3(0, 1, 0).applyQuaternion(cam.quaternion);
    const right = V3(1, 0, 0).applyQuaternion(cam.quaternion);
    const legend = s.it.sp.legend;
    const dist = legend ? 0.46 : 0.3;
    const held = cam.position.clone().addScaledVector(fwd, dist).addScaledVector(upv, legend ? -0.12 : -0.06).addScaledVector(right, legend ? 0 : 0.03);
    if (s.phase === 'up') {
      const k = smoothstep(0, 0.7, s.t);
      m.position.lerpVectors(s.from, held, k * k * (3 - 2 * k));
      if (s.t > 0.7) s.phase = 'hold';
    } else if (s.phase === 'hold') {
      m.position.copy(held);
      // ゆっくり回して見せる
      if (s.t > s.dur) { s.phase = s.junk ? 'toss' : 'bag'; s.t2 = 0; s.from2 = m.position.clone(); }
    } else if (s.phase === 'bag') {
      s.t2 += dt;
      const k = smoothstep(0, 0.55, s.t2);
      const b = this.bag.mouth();
      m.position.lerpVectors(s.from2, b, k);
      m.scale.setScalar(1 - k * 0.3);
      if (k >= 1) { this.bag.set(this.catches.length); audio.bag(); this.finishShow(); return; }
    } else if (s.phase === 'toss') {
      s.t2 += dt;
      if (!s.vel) { s.vel = fwd.clone().multiplyScalar(3.2).add(V3(0, 2.2, 0)).addScaledVector(right, 0.6); }
      s.vel.y -= 9.8 * dt;
      m.position.addScaledVector(s.vel, dt);
      m.rotation.x += dt * 9;
      const wy = this.world.waterAt(m.position.x, m.position.z, this.t);
      if (m.position.y < wy) { this.fx.splash(m.position.x, wy, m.position.z, 14, 0.8); audio.splash(0.5); this.post.water.ripple(m.position.x, m.position.z, 2); this.finishShow(); return; }
    }
    if (s.phase === 'hold' || s.phase === 'up') {
      m.quaternion.copy(cam.quaternion);
      m.rotateX(-0.3);
      m.rotateY(Math.sin(s.t * 1.1) * 0.3 + 0.2);
      // しずく
      if (Math.random() < dt * (legend ? 30 : 14)) {
        const b = new THREE.Box3().setFromObject(m);
        this.fx.drip(lerp(b.min.x, b.max.x, Math.random()), b.min.y, lerp(b.min.z, b.max.z, Math.random()));
        if (Math.random() < 0.3) audio.drip(0, 0.4);
      }
      setWet(s.shell, 1 - smoothstep(0.5, 4, s.t) * 0.6);
    }
    this.showPose = { pos: m.position.clone(), legend };
  }
  finishShow() {
    const s = this.showing;
    this.scene.remove(s.shell.mesh);
    s.shell.mesh.parent?.remove(s.shell.mesh);
    this.showing = null;
    this.showPose = null;
    this.mode = 'play';
    const p = this.player;
    p.locked = false;
    p.lookOverride = null;
    this.body.handMode = 'rod';
    if (this.catches.length === 1) this.later(0.6, () => this.showHint('more', '貝は群れでいる。<b>すぐそば</b>も突いてみよう。', 5));
    if (this.tideT >= 1) this.endSession();
  }

  // ───── 体の手足 ─────
  updateBody(dt) {
    const p = this.player, b = this.body, tool = this.tool;
    const s = { pos: p.pos, yaw: p.yaw, speed: p.speed, crouch: p.crouch, groundY: p.pos.y, grips: tool.grips, rodUp: tool.axis };
    const UP = V3(0, 1, 0);
    if (b.handMode === 'dig' && this.dig) {
      // 穴の左右で、手のひらを下に向けて砂を掻く（マウスの左右に合わせて動く）
      const h = this.dig.hole;
      const g = this.world.groundAt(h.x, h.z);
      const dir = V3(h.x - p.pos.x, 0, h.z - p.pos.z).normalize();
      const side = V3(-dir.z, 0, dir.x);
      const sw = this.dig.sweep;
      const ph = this.t * 3;
      const y = g - h.depth * 0.5 + 0.035;
      const palm = V3(0, -1, 0).addScaledVector(dir, 0.35).normalize();
      for (const [key, sg, ph2] of [['handL', -1, Math.sin(ph)], ['handR', 1, Math.cos(ph)]]) {
        const pos = V3(h.x, y, h.z).addScaledVector(side, sg * (0.1 + h.rin * 0.35) + sw * 0.07).addScaledVector(dir, -0.03 + ph2 * 0.01);
        const fwd = dir.clone().addScaledVector(side, -sg * 0.45).normalize();
        s[key] = { pos, palm, fwd, pose: 'dig' };
      }
    } else if (b.handMode === 'hold' && (this.showPose || this.showing)) {
      // 両手ですくって、目の前に掲げる
      const cam = this.camera;
      const P = this.showPose ? this.showPose.pos : this.showing.shell.mesh.position;
      const r = V3(1, 0, 0).applyQuaternion(cam.quaternion);
      const dn = V3(0, -1, 0).applyQuaternion(cam.quaternion);
      const fw = V3(0, 0, -1).applyQuaternion(cam.quaternion);
      const legend = this.showing?.it.sp.legend;
      const w = legend ? 0.075 : 0.03;
      const palm = UP.clone().applyQuaternion(cam.quaternion).addScaledVector(fw, -0.3).normalize();
      s.handR = { pos: P.clone().addScaledVector(dn, legend ? 0.06 : 0.028).addScaledVector(r, w).addScaledVector(fw, -0.01), palm, fwd: fw.clone().addScaledVector(r, -0.35).normalize(), pose: 'cup' };
      s.handL = { pos: P.clone().addScaledVector(dn, legend ? 0.06 : 0.028).addScaledVector(r, -w).addScaledVector(fw, -0.01), palm, fwd: fw.clone().addScaledVector(r, 0.35).normalize(), pose: 'cup' };
    }
    if (b.handMode === 'rod' && !tool.grips) {
      // 棒を離している（立てている）間は、手を下ろす
      const f = V3(-Math.sin(p.yaw), 0, -Math.cos(p.yaw));
      const q = new THREE.Quaternion().setFromAxisAngle(UP, p.yaw);
      for (const [key, sg] of [['handL', -1], ['handR', 1]]) {
        const pos = p.pos.clone().add(V3(0, 0.62, 0)).addScaledVector(f, 0.08).add(V3(sg * 0.2, 0, 0).applyQuaternion(q));
        s[key] = { pos, palm: V3(-sg, 0, 0).applyQuaternion(q), fwd: V3(0, -1, 0), pose: 'rest' };
      }
      const mode = b.handMode; b.handMode = 'free'; b.update(dt, s); b.handMode = mode;
      return;
    }
    b.update(dt, s);
  }

  // ───── HUD ─────
  updateHud(dt) {
    const p = this.player, ui = this.ui;
    const mins = 10 * 60 + 30 + this.tideT * 90;
    const clock = `${Math.floor(mins / 60)}:${String(Math.floor(mins % 60)).padStart(2, '0')}`;
    const left = Math.max(0, SESSION * (1 - this.tideT));
    const bt = this.bestToday;
    ui.updateHud({
      clock, left: left > 0 ? `潮が満ちるまで ${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}` : '満ち潮',
      tideT: this.tideT, depth: p.depth, bagN: this.catches.length, bagBest: bt ? `いちばん: ${SHELLS[bt.id].name} ${bt.cm}cm` : '',
      total: this.total, stabs: this.stabsToday, cross: this.mode === 'play',
    });
    // 当たった所の目印
    const c = this.contact;
    if (c && this.mode === 'play') {
      const v = V3(c.x, this.world.groundAt(c.x, c.z) + 0.02, c.z).project(this.camera);
      ui.pin(v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1, (v.x + 1) / 2 * innerWidth / this.hz, (1 - v.y) / 2 * innerHeight / this.hz - 8);
    } else ui.pin(false);
    // 足もとの水のさざめき・トンビ
    const wi = p._w;
    audio.setLap(clamp((p.waterY - this.world.tide) / 0.15, 0, 1) * smoothstep(0.1, 0.4, p.depth));
    this.nextTonbi -= dt;
    if (this.nextTonbi <= 0) { audio.tonbi(); this.nextTonbi = rand(25, 60); }
    void wi;
  }

  // ───────── 終わり・結果 ─────────
  async endSession() {
    if (this.ending) return;
    this.ending = true;
    this.noPause = true;
    this.input.enabled = false;
    this.ui.warn('');
    this.ui.prompt('');
    this.ui.fade(true);
    await new Promise((r) => setTimeout(r, 900));
    this.clearScene();
    this.input.unlock();
    this.mode = 'results';
    this.ui.showHud(false);
    this.body.group.visible = false;
    this.bag.group.visible = false;
    this.tool.planted = null;
    this.setupResults();
    this.resultsCam(0, true);
    audio.setAmbience('results');
    audio.setMusic('results');
    await new Promise((r) => setTimeout(r, 300));
    this.ui.fade(false);

    const catches = this.catches || [];
    const items = [...catches].sort((a, b) => b.value - a.value).map((c) => {
      const sp = SHELLS[c.id];
      return { id: c.id, dish: sp.dish, label: `${sp.name} ${c.cm}cm・${weightOf(sp, c.cm)}g`, value: c.value, isNew: c.isNew, legend: !!sp.legend };
    });
    // 同じ種類が多いときは、上位だけ個別に、残りはまとめる
    const shown = [];
    const counts = {};
    for (const it of items) {
      counts[it.id] = (counts[it.id] || 0) + 1;
      if (counts[it.id] <= 3 || it.legend) shown.push(it);
      else {
        let g = shown.find((x) => x.group === it.id);
        if (!g) { g = { id: it.id, group: it.id, dish: SHELLS[it.id].dish, label: '', value: 0, n: 0 }; shown.push(g); }
        g.n++; g.value += it.value; g.label = `${SHELLS[it.id].name} ほか ${g.n}個`;
      }
    }
    const total = this.total || 0;
    const rank = [...RANKS].reverse().find((r) => total >= r.min);
    const news = [];
    const stashed = stashCatch(catches);
    if (stashed) news.push(`${stashed}個の貝を持ち物に入れた`);
    save.data.days = this.day;
    if (total > save.data.best && total > 0) { news.push('自己最高記録！'); save.data.best = total; save.data.bestRank = rank.title; }
    for (const id of LEGEND_IDS) if (catches.some((c) => c.id === id)) news.push(`伝説の${SHELLS[id].name}を掘り当てた！`);
    const fresh = catches.filter((c) => c.isNew).map((c) => SHELLS[c.id].name);
    if (fresh.length) news.push(`図鑑に登録: ${[...new Set(fresh)].join('・')}`);
    if (this.legendNews) { news.push('図鑑がそろった！ 浜の主が現れる'); this.legendNews = false; }
    save.write();
    const acc = this.stabsToday ? Math.round((this.hits / this.stabsToday) * 1000) / 10 : 0;
    const stats = [['突いた回数', `${this.stabsToday}回`], ['当たり', `${this.hits}回`], ['獲った数', `${catches.length}個`]];
    void acc;
    // 次の干潮のために砂の中を入れかえる
    this.newField(this.day + 1);
    await this.ui.results({ day: this.day, items: shown, total, rank, news, stats });
  }

  // 獲れた貝を、乾いた砂の上のバケツのそばに並べる
  setupResults() {
    const w = this.world;
    const g = new THREE.Group();
    const x0 = START.x, z0 = -9;
    const P = V3(x0, w.groundAt(x0, z0), z0);
    this.resultSpot = P;
    w.tide = 0.2;
    w.setSun(1);
    const list = [...(this.catches || [])].sort((a, b) => b.cm - a.cm).slice(0, 48);
    const rng = new RNG(this.day * 13 + list.length);
    let x = -0.02, z = 0, rowH = 0, row = 0;
    const maxW = clamp(0.25 + list.length * 0.02, 0.3, 0.6);
    for (const c of list) {
      const sp = SHELLS[c.id];
      const s = makeShell(c.id, c.cm, c.seed);
      setWet(s, 0.5);
      const m = s.mesh;
      const L = s.L;
      if (x + L > maxW) { x = -0.02; z += rowH + 0.012; rowH = 0; row++; }
      const px = P.x - maxW / 2 + x + L / 2, pz = P.z + z + L / 2 * 0.8;
      const gy = w.groundAt(px, pz);
      if (sp.kind === 'clam') { m.rotation.set(-Math.PI / 2, 0, rng.range(-0.25, 0.25)); m.position.set(px, gy + s.W / 2 - 0.002, pz); }
      else if (sp.kind === 'snail' || sp.kind === 'moon') { m.rotation.set(0, rng.range(0, 6.28), 0); m.position.set(px, gy + s.H / 2 - 0.003, pz); }
      else { m.position.set(px, gy + s.H / 2, pz); }
      g.add(m);
      x += L + 0.012;
      rowH = Math.max(rowH, L * 0.8);
    }
    // 棒を砂に寝かせ、バケツを置く
    // 格子の枠の縁と柄の端のキャップで砂に乗り、どちらも少しだけ沈む
    const rod = this.tool.mesh;
    const hx = P.x + 0.62, hz = P.z + 0.55;
    const tx = hx - Math.cos(0.35) * (SHAFT_TOP + 0.016), tz = hz - Math.sin(0.35) * (SHAFT_TOP + 0.016);
    const head = V3(hx, w.groundAt(hx, hz) + HALF + 0.0064 - 0.004, hz);
    const tail = V3(tx, w.groundAt(tx, tz) + 0.0084 - 0.002, tz);
    const ax = tail.clone().sub(head).normalize();
    // 棒のローカル: +y = 柄、+x = 下（枠の一辺が砂に寝る）
    const down = V3(0, -1, 0).addScaledVector(ax, ax.y).normalize();
    rod.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(down, ax, down.clone().cross(ax)));
    rod.position.copy(head);
    // 砂の起伏で途中が埋まる分は、全体を持ち上げる（1cm までは沈んでよい）
    rod.updateMatrixWorld(true);
    let sink = 0;
    const v = V3();
    rod.traverse((o) => {
      if (!o.isMesh) return;
      const pa = o.geometry.attributes.position;
      for (let i = 0; i < pa.count; i += 7) {
        v.fromBufferAttribute(pa, i).applyMatrix4(o.matrixWorld);
        sink = Math.max(sink, w.groundAt(v.x, v.z) - v.y);
      }
    });
    if (sink > 0.01) rod.position.y += sink - 0.01;
    this.tool.planted = { pos: rod.position.clone(), yaw: 0, lying: true };
    const bucket = this.backdrop.makeBucket();
    bucket.position.set(P.x + 0.42, w.groundAt(P.x + 0.42, P.z + 0.05), P.z + 0.05);
    g.add(bucket);
    this.scene.add(g);
    this.resultGroup = g;
    this.resultCenter = P.clone().add(V3(0, 0, Math.max(z, 0.1) / 2 + 0.05));
    this.resultR = Math.max(0.35, z + 0.2);
  }
  resultsCam(dt, init) {
    const cam = this.camera;
    if (init) this.resT = 0;
    this.resT += dt;
    const c = this.resultCenter || this.resultSpot;
    const k = smoothstep(0, 6, this.resT);
    const R = this.resultR || 0.4;
    // 北（陸）側の低い所から、獲物の並びと、その向こうの海・入道雲を見る
    cam.position.set(c.x - 0.08 + Math.sin(this.resT * 0.1) * 0.04, c.y + lerp(0.72, 0.52, k) + R * 0.25, c.z - lerp(0.95, 0.68, k) - R * 0.5);
    cam.lookAt(c.x - 0.36, c.y - 0.02, c.z + 0.62);
    cam.fov = 50;
    cam.updateProjectionMatrix();
  }
}

const tick = () => new Promise((r) => setTimeout(r, 0));
