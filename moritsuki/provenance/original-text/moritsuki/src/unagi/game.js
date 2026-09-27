// ウナギ掬いの本体: 状態の流れ・網ですくう・掲げてビクへ・逃がす・夜明け・水門・結果
import * as THREE from 'three';
import { audio } from './core/audio.js';
import { Input } from './core/input.js';
import { Post } from './post.js';
import { World } from './world.js';
import { Scenery, VENDING, terrainAt } from './scenery.js';
import { Fauna } from './fauna.js';
import { FX } from './fx.js';
import { Player, S_STOP } from './player.js';
import { Body } from './body.js';
import { Net } from './net.js';
import { Biku } from './biku.js';
import { renderThumbs } from './thumbs.js';
import { prepareFishTextures } from './fish/fishmodel.js';
import { SPECIES, ZUKAN_IDS, LEGEND_IDS, RANKS, valueOf, weightOf, nameOf } from './species.js';
import { UI, yen, legendUnlocked } from './ui.js';
import { save } from './save.js';
import { townLink } from '../shared/townLink.js';
import { U } from './shade.js';
import { HW, DROPS, CULVERT, PIPES, S_END, S_GATE, FLOW, levelAt, bedAt, groundAt } from './ditch.js';
import { clamp, lerp, smoothstep } from './core/noise.js';

// 町から来たとき（/unagi/?town）: タイトル・結果に「町に帰る」、獲った物は町の持ち物へ
const { TOWN, townURL, applyTownTexts, stashCatch } = townLink({ from: 'unagi', title: '鰻掬い — 田んぼの側溝（吉山）' });

const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const SESSION = 300;           // 夜明けまで（秒）
const START = { x: 0.05, s: 1.6 };
const rand = (a, b) => a + (b - a) * Math.random();
const tick = () => new Promise((r) => setTimeout(r, 0));

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.mode = 'loading';
    this.t = 0;
    this.timers = [];
    const Q = new URLSearchParams(location.search);
    this.debug = Q.has('debug');
    this.mute = Q.has('mute');
  }

  // ───────── 初期化 ─────────
  async init() {
    save.load();
    const S = save.data.settings;
    const renderer = (this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: false, powerPreference: 'high-performance' }));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene = new THREE.Scene();
    this.waterScene = new THREE.Scene();
    this.overlay = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.03, 4000);
    this.scene.add(this.camera);
    this.ui = new UI();
    this.input = new Input(this.canvas);
    this.input.dragLook = this.debug;

    // 魚の模様は重いので、景色を作る間にワーカーで塗っておく
    const fishTex = prepareFishTextures();
    this.world = new World(this.scene, this.waterScene, renderer);
    await this.world.build((p, m) => this.ui.loading(p * 0.9 * 0.45, m));
    this.scenery = new Scenery(this.scene, this.world, this.overlay);
    await this.scenery.build((p, m) => this.ui.loading(0.4 + p * 0.25, m));
    this.post = new Post(renderer, this.scene, this.waterScene, this.overlay, this.camera);

    this.ui.loading(0.68, 'ウナギを水草の陰に隠しています');
    await fishTex;
    await tick();
    this.fauna = new Fauna(this.scene, this.overlay, this.world.plants);
    this.fx = new FX(this.scene, this.overlay);
    this.player = new Player(this.camera);
    this.body = new Body(this.scene, this.camera);
    this.net = new Net(this.scene);
    this.biku = new Biku(this.scene);
    this.bindWorldEvents();
    this.applyQuality(S.quality);
    this.resize();
    addEventListener('resize', () => this.resize());
    this.applySettings();
    this.newNight(save.data.days + 1);

    this.ui.loading(0.84, '図鑑の挿絵を描いています');
    await tick();
    Object.assign(this.ui.thumbs, renderThumbs([...ZUKAN_IDS, ...LEGEND_IDS]));

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

  newNight(day) {
    this.fauna.spawn(day, { legends: legendUnlocked() });
    this.nightDay = day;
  }

  bindWorldEvents() {
    const w = this.world;
    // 足を踏み出すたび: 水音・波紋・泥煙
    this.player.onStep = (x, z, k) => {
      audio.wade(0.5 + k * 0.6);
      w.water.ripple(x, z, 0.5 + k * 0.6);
      w.murk.add(x, z, 0.14, 0.12 + k * 0.22);
      if (Math.random() < 0.5 * k) this.fx.silt(x, bedAt(x, -z) + 0.01, z, 3, 0.06, 0.7);
    };
    this.player.onClimb = (dir) => { if (dir > 0) { audio.climb(); this.later(0.5, () => w.water.ripple(this.player.pos.x, this.player.pos.z, 1.2)); } else audio.wade(1.2); };
    this.net.onEnterWater = (p, k) => {
      audio.netIn(k);
      w.water.ripple(p.x, p.z, 0.8 + k);
      this.fx.splash(p.x, levelAt(-p.z), p.z, Math.round(4 + k * 10), 0.6 + k * 0.5);
      this.fx.bubbles(p.x, levelAt(-p.z) - 0.05, p.z, 6, 0.2);
    };
    this.net.onLeaveWater = (p, k) => {
      if (this.mode === 'title') return;
      audio.netOut(k);
      w.water.ripple(p.x, p.z, 1.2);
      this.dripT = 1.6;
    };
    const splash = (x, y, z, k) => { this.fx.splash(x, y, z, Math.round(6 + k * 14), 0.8 + k * 0.6); w.water.ripple(x, z, 1 + k); audio.splash(k); };
    this.faunaCtx = {
      t: 0, player: this.player, net: this.net, cam: this.camera, murk: w.murk, fx: this.fx,
      ripple: (x, z, s) => w.water.ripple(x, z, s), splash,
    };
  }

  installDebug() {
    const g = this;
    window.dbg = {
      async play() { while (g.mode !== 'title') await new Promise((r) => setTimeout(r, 100)); g.ui.only(); g.beginPlay(); },
      step(n = 1, dt = 1 / 60) { for (let i = 0; i < n; i++) { g.t += dt; g.update(dt); g.input.endFrame(); } g.post.render(); },
      freeze() { g.loop = () => {}; },
      tp(s, x = 0, yaw = 0, pitch = -0.6) { g.player.reset(x, s, yaw); g.player.pitch = pitch; g.biku.reset(); g.net.C.copy(g.player.pos).add(V3(0.2, 0.5, -0.8)); g.net.vel.set(0, 0, 0); g.net.chainInit = false; },
      near(id = 'unagi') {
        const p = g.player.pos;
        let best = null, bd = 1e9;
        for (const c of g.fauna.list) {
          if (c.gone || c.id !== id) continue;
          const q = c.crit ? V3(c.x, c.y, c.z) : c.pts[0];
          const d = Math.hypot(q.x - p.x, q.z - p.z);
          if (d < bd) { bd = d; best = c; }
        }
        return best;
      },
      /**
       * その生き物の手前に立ち、横の底へ網を沈めて、底をなでるように横へ払って上げる
       * side: 払う向き（+1 = 右へ、-1 = 左へ）。省くと、壁ぎわの物は壁へ押しつける向き、まん中なら右から左
       */
      async scoop(id = 'unagi', side = 0, speed = 1.0, sneak = false) {
        const c = this.near(id);
        if (!c) return null;
        const q = c.crit ? V3(c.x, c.y, c.z) : c.pts[Math.floor(c.J * 0.3)].clone();
        const s = -q.z;
        this.tp(s - 1.0, clamp(q.x * 0.5, -0.3, 0.3), 0, -0.9);
        c.alarm = 0; if (c.state === 'flee') c.state = 'rest';
        const dir = side || (q.x > 0.2 ? 1 : -1);
        const x0 = clamp(q.x - dir * 0.42, -0.55, 0.55), x1 = clamp(q.x + dir * 0.4, -0.55, 0.55);
        g.aimLock = V3(x0, 0, q.z);
        if (sneak) g.input.keys.add('ShiftLeft');
        g.input.left = true; g.input.leftPressed = true;
        this.step(1);
        for (let i = 0; i < 200 && g.net.state === 'lower'; i++) this.step(1);
        this.step(4);
        g.input.leftPressed = false;
        const n = Math.round(Math.abs(x1 - x0) / speed * 60);
        // 払う間も、ねらう前後の位置は生き物について行く（人も見ながら合わせる）
        const zNow = () => (c.crit ? c.z : c.pts[Math.floor(c.J * 0.3)].z);
        for (let i = 0; i <= n; i++) { g.aimLock = V3(lerp(x0, x1, i / n), 0, zNow()); this.step(1); }
        // 網が払い終わる所まで追いつくのを待つ（水の中の網は少し遅れてついてくる）
        for (let i = 0; i < 40 && Math.abs(g.net.C.x - g.net.aim.x) > 0.012 && g.net.state === 'sweep'; i++) this.step(1);
        g.input.left = false;
        g.input.keys.delete('ShiftLeft');
        this.step(40);
        g.aimLock = null;
        return { id: c.id, state: c.state, cm: c.cm, mode: g.mode };
      },
      click() { g.input.leftPressed = true; this.step(1); g.input.leftPressed = false; },
      rclick() { g.input.rightPressed = true; this.step(1); g.input.rightPressed = false; },
      results(list = [['unagi', 58], ['unagi', 44], ['unagi', 36], ['suzuki', 41], ['mokuzu', 7.5], ['tenaga', 9], ['tenaga', 8], ['dojo', 12]]) {
        for (const [id, cm] of list) g.addCatch({ id, cm });
        g.day = save.data.days + 1;
        return g.endSession('gate');
      },
      unlockLegends() { for (const id of ZUKAN_IDS) save.zk(id).caught = Math.max(1, save.zk(id).caught); save.write(); g.newNight(g.nightDay || 1); },
      time(k) { g.timeK = k; },
      // Browser pane が隠れていても撮れるように: 1 コマ描いてすぐ受け取り口へ送る（確認用）
      async snap(n = 'shot', port = 5217) { this.step(1); const d = g.canvas.toDataURL('image/jpeg', 0.88); await fetch(`http://localhost:${port}/?n=${n}`, { method: 'POST', body: d }); return n; },
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
    this.world.lamp.shadow.mapSize.set(q === 'low' ? 1024 : 2048, q === 'low' ? 1024 : 2048);
    this.world.lamp.shadow.map?.dispose(); this.world.lamp.shadow.map = null;
    this.pr = pr;
    this.fx?.setPR(pr);
    this.fauna?.setPR(pr);
    this.scenery?.setPR(pr);
    this.resize?.();
  }

  applySettings() {
    const S = save.data.settings;
    this.player.sens = S.sens;
    this.player.invertY = S.invertY;
    this.player.fovBase = S.fov;
    this.world.lampIntensity = 60 * S.lamp;
    audio.setVolumes({ master: this.mute ? 0 : S.master, music: S.music, sfx: S.sfx, amb: S.amb });
    if (this.playing) { this.camera.fov = S.fov; this.camera.updateProjectionMatrix(); }
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
        case 'quit': this.ui.hide('pause'); this.mode = this.pausedFrom || 'play'; this.endSession('quit'); break;
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
    // 右クリック（逃がす）
    this.canvas.addEventListener('mousedown', (e) => { if (e.button === 2 && this.input.enabled && (this.input.locked || this.input.freeLook)) this.input.rightPressed = true; });
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.playing && !this.debug) this.pause(); });
  }
  get playing() { return ['play', 'show', 'pull'].includes(this.mode); }

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
    if (this.dawnLight) this.dawnLight.visible = false;
    // 最初のウナギ（s = 5.2）を、壁の上に置いた懐中電灯が照らしている
    this.body.group.visible = false;
    this.biku.group.visible = false;
    this.net.group.visible = false;
    this.world.setDawn(0);
    this.titleSpot = V3(0.1, bedAt(0.1, 5.3), -5.3);
    this.player.pos.set(0, bedAt(0, 3), -3);
  }
  titleCam(t) {
    const c = this.titleSpot;
    const cam = this.camera;
    const a = Math.sin(t * 0.07);
    cam.position.set(0.24 + a * 0.06, c.y + 0.98 + Math.sin(t * 0.21) * 0.02, c.z + 1.05 + Math.cos(t * 0.05) * 0.05);
    cam.lookAt(c.x - 0.02, c.y + 0.06, c.z - 0.3);
    cam.fov = 55;
    cam.updateProjectionMatrix();
    // 懐中電灯（農道側の壁の上から、斜めに水の中を照らす）
    const l = this.world.lamp;
    const lp = V3(-0.7, groundAt(6.2) + 0.1, -6.2);
    l.position.copy(lp);
    const dir = c.clone().add(V3(0.05, 0, -0.1)).sub(lp).normalize();
    l.target.position.copy(lp).addScaledVector(dir, 5);
    l.target.updateMatrixWorld();
    this.world.spill.position.copy(lp);
    l.intensity = 55; this.world.spill.intensity = 4;
    l.visible = this.world.spill.visible = true;
    U.uLampPos.value.copy(lp); U.uLampDir.value.copy(dir); U.uLampI.value = 55;
  }
  // 町に帰る（/unagi/?town のとき。暗くして音を消してから移る）
  toTown() {
    if (!TOWN || this.leaving) return;
    this.leaving = true;
    this.ui.only();
    this.ui.fade(true);
    audio.setVolumes({ master: 0 });
    setTimeout(() => { location.href = townURL(); }, 650);
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

  // ───────── 夜の始まり ─────────
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
    const lines = day === 1
      ? [{ text: '吉山　町はずれの田んぼ　午前三時', cls: 'day', wait: 1600 }, { text: '田んぼのあいだを流れる、コンクリートの側溝。', wait: 1700 }, { text: '昼間は、ただの水路にしか見えない。', wait: 1600 }, { text: 'でも夜、ライトで照らすと――', wait: 1800 }, { text: '鰻掬い。', cls: 'big', wait: 1600, sound: () => audio.taiko(0, 0.7, 70) }]
      : [{ text: `夜の側溝　${day}回目の夜　午前三時`, cls: 'day', wait: 1400 }, { text: legendUnlocked() && day % 2 ? '暗渠の奥で、何か太いものが動いたらしい。' : ['今夜も、カエルがうるさい。', 'ライトの先を、よく見て。', 'そっと歩け。網は向こうから手前へ。', '夜明けまでに、水門まで。'][day % 4], wait: 1600 }, { text: '鰻掬い。', cls: 'big', wait: 1400, sound: () => audio.taiko(0, 0.7, 70) }];
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
    if (this.nightDay !== this.day) this.newNight(this.day);
    this.timeK = 0;
    this.catches = [];
    this.total = 0;
    this.released = 0;
    this.scoops = 0;
    this.seen = new Set();
    this.ending = false;
    this.timers = [];
    this.hintsShown = new Set();
    this.bestToday = null;
    this.showing = null;
    this.pullS = null;
    this.playT0 = this.t;
    this.saidMany = false;
    this.emptyLifts = 0;
    this.warnedDawn = false;
    this.player.reset(START.x, START.s, 0);
    this.player.locked = false;
    this.player.lookOverride = null;
    this.net.state = 'carry';
    this.net.catches = [];
    this.net.chainInit = false;
    this.net.group.visible = true;
    this.body.group.visible = true;
    this.body.handMode = 'rod';
    this.biku.group.visible = true;
    this.biku.reset();
    this.world.setDawn(0);
    if (this.dawnLight) this.dawnLight.visible = false;
    this.input.consumeMouse();
    this.input.enabled = true;
    this.ui.showHud(true);
    this.ui.dimHud(false);
    this.noPause = false;
    this.camera.fov = save.data.settings.fov;
    this.camera.updateProjectionMatrix();
    audio.setMusic('play');
    audio.setAmbience('night');
    this.later(1.2, () => this.showHint('net', '<b>左クリック長押し</b>で、見ている所の底へ網を沈める。押したまま見る先を動かすと網も動き、<b>離すと上がる</b>。', 8));
    this.later(10, () => this.showHint('look', 'ライトの先の水の底をよく見よう。<b>黒くて長い影</b>がウナギ。水草の陰や、垂れた草の下にいる。', 7));
  }

  clearScene() {
    if (this.resultGroup) { this.scene.remove(this.resultGroup); this.resultGroup = null; }
    this.showing = null;
    this.ui.catchPanel(false);
    this.ui.struggle(false);
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
    this.input.rightPressed = false;
  }

  update(dt) {
    audio.updateMusic(dt);
    if (this.mode === 'pause') return;
    const ctx = this.faunaCtx;
    ctx.t = this.t;
    if (this.mode === 'title' || this.mode === 'loading' || this.mode === 'intro') {
      this.titleCam(this.t);
      this.fauna.update(dt, ctx);
      this.updateWorld(dt, this.titleSpot);
      return;
    }
    if (this.mode === 'results') {
      this.resultsCam(dt);
      this.fauna.updateTub(dt);
      this.updateWorld(dt, this.resultSpot);
      return;
    }
    // ─── 側溝 ───
    for (const tm of this.timers) { tm.t -= dt; if (tm.t <= 0 && !tm.done) { tm.done = true; tm.fn(); } }
    this.timers = this.timers.filter((t) => !t.done);
    this.updateTime(dt);
    const p = this.player, inp = this.input, net = this.net;
    p.slow = net.inWater ? 0.5 : this.mode === 'show' || this.mode === 'pull' ? 0.25 : 1;
    p.update(dt, inp, this.t);
    this.world.aimLamp(this.camera, 1, this.focusDist());
    if (this.mode === 'play') this.updatePlay(dt);
    else if (this.mode === 'show') this.updateShow(dt);
    else if (this.mode === 'pull') this.updatePull(dt);
    net.update(dt, { player: p, cam: this.camera, t: this.t, biku: this.biku });
    this.fauna.update(dt, ctx);
    this.handleFaunaEvents();
    this.updateBody(dt);
    this.biku.update(dt, this.body, p, this.t);
    this.updateWorld(dt, p.pos);
    this.updateHud(dt);
    this.updateSound(dt);
    const u = this.post.u;
    u.uDrops.value = Math.max(0, u.uDrops.value - dt * 0.3);
    u.uFlash.value = Math.max(0, u.uFlash.value - dt * 3);
    this.ui.lockHint(!this.input.locked && !this.input.freeLook && this.playing);
  }

  updateWorld(dt, focus) {
    const w = this.world;
    w.update(dt, this.t, this.camera, focus);
    this.scenery.update(dt, this.t, this.camera);
    this.fx.update(dt, (x, z) => levelAt(-z), FLOW);
    // 網からしたたる水
    if (this.dripT > 0) {
      this.dripT -= dt;
      if (Math.random() < dt * 40 * Math.min(1, this.dripT)) {
        const b = this.net.chain[this.net.chain.length - 2];
        this.fx.drip(b.x + (Math.random() - 0.5) * 0.12, b.y, b.z + (Math.random() - 0.5) * 0.12);
      }
    }
  }

  /** ヘッドライトが照らしている物までの距離（底・壁・自分の体・網のいちばん近いもの） */
  focusDist() {
    const cam = this.camera, net = this.net;
    if (this.mode === 'show' || net.state === 'lift' || net.state === 'show' || net.state === 'dump') return net.C.distanceTo(cam.position);
    const o = cam.position, d = V3(0, 0, -1).applyQuaternion(cam.quaternion);
    let t = 6;
    const b = bedAt(clamp(o.x, -HW, HW), -o.z);
    if (d.y < -0.02) t = Math.min(t, (o.y - b) / -d.y);
    if (Math.abs(d.x) > 1e-3) { const tw = (Math.sign(d.x) * HW - o.x) / d.x; if (tw > 0) t = Math.min(t, tw / 0.9); }
    // 水の中の網
    if (net.inWater) {
      const dn = net.C.clone().sub(o);
      const along = dn.dot(d);
      if (along > 0 && dn.lengthSq() - along * along < 0.05) t = Math.min(t, along);
    }
    // 暗渠の天井
    if (d.y > 0.02) { const tc = (0.99 - o.y) / d.y; if (tc > 0 && -o.z > CULVERT.s0 && -o.z < CULVERT.s1) t = Math.min(t, tc); }
    return t;
  }

  // ───── 夜明け ─────
  updateTime(dt) {
    if (!this.ending && this.mode !== 'show' && this.mode !== 'pull') this.timeK = Math.min(1, this.timeK + dt / SESSION);
    const k = this.timeK;
    this.world.setDawn(k);
    if (k > 0.8 && !this.warnedDawn) {
      this.warnedDawn = true;
      audio.bell();
      this.ui.toast('<b>東の空が白んできた</b><small>あと 1 分ほどで夜が明ける</small>', { cls: 'info', icon: '🌅' });
    }
    if (k >= 1 && !this.ending && this.mode === 'play' && this.net.state === 'carry') this.endSession('dawn');
  }

  // ───── 網をあやつる ─────
  updatePlay(dt) {
    const p = this.player, inp = this.input, net = this.net;
    if (!p.climb) {
      net.aimAt(p, this.camera);
      if (this.aimLock) { net.aim.set(this.aimLock.x, bedAt(this.aimLock.x, -this.aimLock.z), this.aimLock.z); }
    }
    if (inp.leftPressed && net.state === 'carry' && !p.climb && !this.ending) {
      net.press();
      this.scoops++;
    }
    if (!inp.left && (net.state === 'lower' || net.state === 'sweep')) this.onLift();
    // 水門のはしご
    if (p.s > S_END - 0.4) {
      this.ui.prompt('<kbd>E</kbd>はしごを上がって、今夜はおしまい');
      if (inp.pressed('KeyE')) this.endSession('gate');
    } else if (p.blocked === 'back') this.ui.prompt('ここから下流は格子でふさがれている');
    else this.ui.prompt('');
    // 場所のヒント
    const s = p.s;
    for (const d of DROPS) if (s > d.s - 5 && s < d.s - 2) this.showHint('drop', '落ち込みは、そのまま歩けば<b>よじ登れる</b>。下のたまりには<b>スズキ</b>が流れに向かって止まっていることがある。', 7);
    if (s > CULVERT.s0 - 3 && s < CULVERT.s0) this.showHint('culvert', '道の下の<b>暗渠</b>。中はかがんで進む。暗がりに何かいるかも。', 6);
    // 見つけたウナギ（ライトの中、4m 以内）
    this.spotT = (this.spotT || 0) - dt;
    if (this.spotT <= 0) {
      this.spotT = 0.25;
      let n = 0;
      const lp = U.uLampPos.value, ld = U.uLampDir.value;
      for (const c of this.fauna.list) {
        if (c.gone || c.id !== 'unagi' && c.id !== 'nushiUnagi') continue;
        const h = c.pts[Math.floor(c.J / 3)];
        const d = h.distanceTo(lp);
        if (d > 4.2) continue;
        const cone = h.clone().sub(lp).normalize().dot(ld);
        if (cone < Math.cos(0.42)) continue;
        n++;
        if (!this.seen.has(c)) { this.seen.add(c); }
      }
      if (n >= 1 && this.t - this.playT0 > 9) this.showHint('found', 'いた！ ウナギの<b>横</b>の底へ網を沈めて、押したまま<b>横へ払う</b>（見る先を左右へ動かす）。口に入ったら、離して上げる。', 8);
      if (n >= 3 && !this.saidMany && this.t - this.playT0 > 4) {
        this.saidMany = true;
        this.ui.telop('<div class="tl tl-catch" style="font-size:clamp(28px,5vh,48px)">こんなに、いる……！</div>', 2.2);
      }
    }
  }

  onLift() {
    const net = this.net;
    const inside = net.catches.filter((c) => c.state === 'bag');
    const legend = inside.find((c) => c.sp?.legend);
    if (legend) { this.startPull(legend); return; }
    net.lift();
    for (const c of inside) c.state = 'held';
    if (inside.length) this.startShow(inside);
    else {
      this.emptyLifts = (this.emptyLifts || 0) + 1;
      if (this.emptyLifts === 2) this.showHint('mouth', '網の口は<b>動かす向き</b>を向く。獲物の<b>右（か左）</b>に沈めて、底をなでるように<b>横へ払う</b>。', 7);
      this.later(0.55, () => { if (this.net.state === 'show' && !this.showing) this.net.state = 'carry'; });
    }
  }

  // ───── 主: 連打で持ち上げる ─────
  startPull(c) {
    this.mode = 'pull';
    this.pullS = { c, p: 0.3, t: 0, jerk: 0.4 };
    this.net.state = 'sweep';
    c.escT = 99;
    audio.taiko(0, 0.9, 50);
    this.post.u.uFlash.value = 0.3;
    this.ui.telop('<div class="tl tl-catch tl-legend">重い……！</div><div><span class="tl-sub red">網が上がらない！ 連打！</span></div>', 2);
  }
  updatePull(dt) {
    const s = this.pullS, inp = this.input, p = this.player;
    s.t += dt;
    this.net.aim.lerp(V3(this.net.C.x, this.net.aim.y, this.net.C.z), 0.2);
    if (inp.leftPressed) { s.p += 0.07; audio.heavy(); p.shake = Math.max(p.shake, 0.45); this.world.murk.add(this.net.C.x, this.net.C.z, 0.3, 0.25); this.world.water.ripple(this.net.C.x, this.net.C.z, 1.5); }
    s.p -= dt * 0.15;
    s.jerk -= dt;
    if (s.jerk <= 0) { s.jerk = rand(0.35, 0.8); s.p -= 0.05; p.shake = 0.8; audio.thrash(1.2); this.fx.splash(this.net.C.x, levelAt(-this.net.C.z), this.net.C.z, 10, 1); }
    this.ui.struggle(true, s.p);
    if (s.p >= 1) {
      this.ui.struggle(false);
      audio.taiko(0, 0.9, 60);
      s.c.state = 'held';
      this.mode = 'play';
      this.net.lift();
      this.startShow([s.c, ...this.net.catches.filter((x) => x !== s.c && x.state === 'bag').map((x) => { x.state = 'held'; return x; })]);
    } else if (s.p <= 0 || s.t > 12) {
      this.ui.struggle(false);
      this.fauna.escape(s.c, this.faunaCtx, 'swim');
      this.ui.telop(`<div class="tl tl-catch" style="-webkit-text-stroke-color:#5a5a5a">逃げられた…</div><div><span class="tl-sub blue">${s.c.sp.name}は、力ずくで網を押し返した</span></div>`, 2.2);
      audio.miss();
      this.mode = 'play';
      this.onLift();
    }
  }

  // ───── 掲げる → ビクへ／逃がす ─────
  startShow(list) {
    this.mode = 'show';
    const limitOf = (c) => {
      const b = c.sp.body;
      if (c.sp.legend) return 2.2;
      if (b === 'eel') return c.cm > 55 ? 1.7 : 2.3;
      if (b === 'bass') return 1.5;
      if (b === 'catfish') return 2.6;
      if (b === 'loach') return 3.2;
      return 99;
    };
    const small = list.filter((c) => c.id === 'unagi' && c.cm < SPECIES.unagi.release);
    const best = [...list].sort((a, b) => valueOf(b.sp, b.cm) - valueOf(a.sp, a.cm))[0];
    this.showing = { list, t: 0, limit: Math.min(...list.map(limitOf)), small, best, thr: 0 };
    this.player.lookOverride = { yaw: this.player.yaw, pitch: -0.62, k: 5, free: true };
    this.post.u.uDrops.value = 0.35;
    // テロップ
    const sp = best.sp;
    const nm = nameOf(sp, best.cm);
    const z = save.zk(best.id);
    const isNew = !z.caught;
    const record = best.cm > (z.best || 0) && z.caught > 0;
    const big = best.cm >= sp.size[0] + (sp.size[1] - sp.size[0]) * 0.7;
    const firstTonight = this.catches.length === 0;
    if (small.length === list.length) {
      this.ui.telop(`<div class="tl tl-catch" style="-webkit-text-stroke-color:#0a3a5a">${nm}</div><div><span class="tl-sub blue">${best.cm}cm　まだ小さい</span></div>`, 1.8, true);
      this.later(0.5, () => this.showHint('small', '<b>30cm</b> に届かないウナギは、大きくなって帰ってくるのを待とう。<b>クリック</b>で逃がす。', 6));
    } else if (sp.legend) {
      audio.legend();
      this.post.u.uFlash.value = 0.5;
      this.ui.bigShout('獲れたよー！', `伝説の${sp.name}！`, this.card(best, isNew), 4);
    } else if (firstTonight || isNew || (record && big)) {
      audio.celebrate();
      this.ui.bigShout('獲れたよー！', isNew ? '図鑑に登録！' : record ? '最大記録！' : null, this.card(best, isNew), 3);
    } else {
      audio.pickup(sp.rarity);
      this.ui.telop(`<div class="tl tl-catch">${nm}</div><div><span class="tl-sub">${best.cm}cm${list.length > 1 ? `　ほか ${list.length - 1}匹` : ''}</span></div>`, 1.4, true);
    }
    if (!save.data.hints.show) this.later(0.9, () => this.showHint('show', '<b>クリックでビクに入れる</b>。ぐずぐずしていると、ぬるっと逃げる。', 6));
  }
  card(c, isNew) {
    const v = valueOf(c.sp, c.cm);
    return `<div><div class="tl-card"><img src="${this.ui.thumbs[c.id] || ''}" alt=""><div class="n">${nameOf(c.sp, c.cm)} ${c.cm}cm<small>${isNew ? '図鑑に登録　' : ''}${weightOf(c.sp, c.cm)}g</small></div><div class="y">+${yen(v)}</div></div></div>`;
  }
  updateShow(dt) {
    const s = this.showing, inp = this.input, net = this.net;
    if (!s) { this.mode = 'play'; return; }
    s.t += dt;
    if (net.state !== 'show' && net.state !== 'lift' && net.state !== 'dump' && net.state !== 'release') { this.finishShow(); return; }
    // 暴れる音・しずく
    s.thr -= dt;
    if (s.thr <= 0 && net.state === 'show') {
      s.thr = rand(0.18, 0.45);
      const k = s.list.some((c) => c.sp.body === 'eel' || c.sp.body === 'bass') ? 1 : 0.4;
      audio.thrash(k);
      if (Math.random() < 0.5) this.fx.drip(net.C.x + rand(-0.1, 0.1), net.C.y - 0.15, net.C.z + rand(-0.1, 0.1));
      this.player.shake = Math.max(this.player.shake, 0.15 * k);
    }
    // 逃げるまでの残り
    const left = s.limit - s.t;
    const escK = clamp(1 - left / 0.9, 0, 1);
    for (const c of s.list) if (c.state === 'held') c.escaping = escK;
    const allSmall = s.small.length === s.list.length;
    const alien = s.list.every((c) => c.sp.alien);
    const sub = allSmall ? '<kbd>クリック</kbd>そっと逃がす' : alien ? '<kbd>クリック</kbd>ビクへ（外来種は逃がさない）' : `<kbd>クリック</kbd>ビクへ　<kbd>右クリック</kbd>逃がす${s.small.length ? '（小さいのは自動で逃がす）' : ''}`;
    if (net.state === 'show') this.ui.catchPanel(true, { title: allSmall ? 'まだ小さい。逃がしてやろう' : 'ビクに入れろ！', p: s.limit > 50 ? -1 : left / s.limit, sub, small: allSmall });
    if (net.state !== 'show' || s.t < 0.15) return;
    if (inp.leftPressed) { this.dumpOrRelease(allSmall ? 'release' : 'dump'); return; }
    if (inp.rightPressed && !alien) { this.dumpOrRelease('release'); return; }
    if (left <= 0) {
      // ぬるっと逃げる（時間のあるものだけ）
      const esc = s.list.filter((c) => c.state === 'held' && c.sp.body !== 'crab' && c.sp.body !== 'shrimp' && c.sp.body !== 'crayfish');
      for (const c of esc) this.fauna.escape(c, this.faunaCtx, 'jump');
      s.list = s.list.filter((c) => !esc.includes(c));
      s.small = s.small.filter((c) => !esc.includes(c));
      audio.miss();
      this.player.shake = 0.6;
      this.ui.telop(`<div class="tl tl-catch" style="-webkit-text-stroke-color:#5a5a5a">ぬるっ……</div><div><span class="tl-sub blue">網のふちを越えて、逃げられた</span></div>`, 1.8, true);
      this.showHint('slip', '上げたら<b>すぐクリック</b>でビクへ。ウナギはぬるぬるで、網のふちを越えて逃げる。', 6);
      if (!s.list.length) { net.state = 'carry'; this.finishShow(); }
      else s.limit = 99;
    }
  }
  dumpOrRelease(how) {
    const s = this.showing, net = this.net;
    this.ui.catchPanel(false);
    const keep = [], free = [];
    for (const c of s.list) {
      if (how === 'release' && !c.sp.alien) free.push(c);
      else if (c.id === 'unagi' && c.cm < SPECIES.unagi.release) free.push(c);
      else keep.push(c);
    }
    if (keep.length) {
      net.state = 'dump'; net.t = 0;
      this.later(0.42, () => {
        let eels = 0;
        for (const c of keep) {
          this.fauna.remove(c);
          net.release(c);
          const isNew = !save.zk(c.id).caught;
          this.addCatch({ id: c.id, cm: c.cm, isNew });
          if (c.sp.body === 'eel') eels++;
          const v = valueOf(c.sp, c.cm);
          this.ui.toast(`<b>${nameOf(c.sp, c.cm)}</b> ${c.cm}cm<em>${yen(v)}</em><small>${isNew ? '図鑑に登録！' : 'ビクに入れた'}</small>`, { img: this.ui.thumbs[c.id], cls: c.sp.legend ? 'legend' : isNew ? 'info' : '' });
        }
        this.biku.put(keep.length, eels);
        audio.biku(eels > 0);
      });
    }
    if (free.length) {
      if (!keep.length) { net.state = 'release'; net.t = 0; }
      this.later(keep.length ? 0.1 : 0.55, () => {
        for (const c of free) {
          net.release(c);
          const small = c.id === 'unagi' && c.cm < SPECIES.unagi.release;
          if (small) { this.released++; save.data.released = (save.data.released || 0) + 1; save.zk(c.id); if (!save.zk(c.id).caught) { /* 見ただけでは図鑑に載せない */ } }
          this.fauna.escape(c, this.faunaCtx, 'jump');
          c.state = 'fall';
          c.fallV = V3(rand(-0.2, 0.2), -0.3, rand(-0.3, -0.1));
        }
        audio.release();
        if (free.some((c) => c.id === 'unagi' && c.cm < SPECIES.unagi.release)) {
          audio.gentle();
          this.ui.telop('<div class="tl tl-catch" style="font-size:clamp(28px,5vh,46px);-webkit-text-stroke-color:#0a3a5a">大きくなって、帰ってこいよ</div>', 1.8, true);
        }
      });
    }
  }
  finishShow() {
    this.showing = null;
    this.ui.catchPanel(false);
    this.mode = 'play';
    this.player.lookOverride = null;
    this.net.catches = [];
    if (this.timeK >= 1 && !this.ending) this.later(0.6, () => this.endSession('dawn'));
  }

  addCatch({ id, cm, isNew = false }) {
    const sp = SPECIES[id];
    const value = valueOf(sp, cm);
    this.catches = this.catches || [];
    this.catches.push({ id, cm, value, isNew });
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
    this.ui.telop('<div class="tl tl-catch tl-legend">図鑑がそろった！</div><div><span class="tl-sub">次の夜から、水路の主が姿を見せる</span></div>', 4);
    this.ui.toast('<b>図鑑に「水路の主」のページが開いた</b><small>暗渠の奥の大ウナギと、二つ目の落ち込みの下の大スズキ</small>', { cls: 'info legend', icon: '★', dur: 7 });
  }

  // ───── 生き物の知らせ ─────
  handleFaunaEvents() {
    const ev = this.fauna.events;
    if (!ev.length) return;
    const P = this.player.pos;
    for (const e of ev) {
      const c = e.c;
      const q = c.crit ? V3(c.x, c.y, c.z) : c.pts[0];
      const d = q.distanceTo(P);
      if (e.type === 'flee') {
        if (c.sp?.body === 'bass') { audio.splash(0.8); this.world.water.ripple(q.x, q.z, 1.2); }
        else if (d < 4) audio.splash(0.25);
        if (c.sp?.body === 'eel' && this.player.noise > 0.6 && d < 1.8) this.showHint('quiet', '<b>Shift</b> を押すと<b>そっと歩ける</b>。じゃぶじゃぶ歩くと、ウナギに気づかれる。', 6);
        if (c.sp?.body === 'bass' && d < 4) this.showHint('bass', 'スズキは敏感。<b>Shift</b> でそっと近づき、<b>頭の先に網を沈めておいてから</b>歩いておどかすと、網へ飛びこむ。', 8);
      } else if (e.type === 'enter') {
        if (d < 3) audio.thrash(0.5);
        if (c.sp?.body === 'eel' || c.sp?.body === 'bass') this.showHint('lift', '入った！ <b>離して</b>網を上げろ！', 3);
      } else if (e.type === 'escape') {
        if (e.how === 'swim') this.showHint('liftfast', '網に入ったら<b>すぐ離して</b>上げよう。水の中では、口から出ていってしまう。', 6);
      } else if (e.type === 'hop') { if (d < 3) audio.flick(); }
      else if (e.type === 'frog') { /* 跳ぶ */ }
      else if (e.type === 'plop') { if (d < 6) audio.plop(1 - d / 8); }
    }
    this.fauna.events = [];
  }

  // ───── 体の手足 ─────
  updateBody(dt) {
    const p = this.player, b = this.body, net = this.net;
    const s = { pos: p.pos, yaw: p.yaw, speed: p.speed, crouch: p.crouch, groundY: p.pos.y, grips: net.grips, rodUp: net.axis };
    b.update(dt, s);
  }

  // ───── HUD・音 ─────
  updateHud(dt) {
    const p = this.player, ui = this.ui;
    const mins = 180 + this.timeK * 90;
    const clock = `${Math.floor(mins / 60)}:${String(Math.floor(mins % 60)).padStart(2, '0')}`;
    const left = Math.max(0, SESSION * (1 - this.timeK));
    const bt = this.bestToday;
    ui.updateHud({
      clock, left: left > 0 ? `夜明けまで ${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}` : '夜明け',
      timeK: this.timeK, dist: p.s, bagN: this.catches.length, bagBest: bt ? `いちばん: ${nameOf(SPECIES[bt.id], bt.cm)} ${bt.cm}cm` : '',
      released: this.released, total: this.total, cross: this.mode === 'play' && this.net.state !== 'lift',
    });
  }
  updateSound(dt) {
    const p = this.player, s = p.s;
    let fall = 0;
    for (const d of DROPS) fall = Math.max(fall, Math.exp(-Math.abs(s - d.s) / 3.5));
    fall = Math.max(fall, Math.exp(-Math.abs(s - S_GATE) / 3) * 0.5);
    let trickle = 0;
    for (const pp of PIPES) if (pp.flow > 0) trickle = Math.max(trickle, Math.exp(-Math.abs(s - pp.s) / 2.5) * (0.4 + pp.flow));
    const hum = Math.exp(-Math.hypot(p.pos.x - VENDING.x, s - VENDING.s) / 5);
    const culvert = smoothstep(CULVERT.s0 - 0.6, CULVERT.s0 + 0.6, s) * (1 - smoothstep(CULVERT.s1 - 0.6, CULVERT.s1 + 0.6, s));
    audio.setPlace({ fall, trickle, hum, culvert, dawn: this.timeK });
    const netV = this.net.inWater ? Math.min(1, this.net.vel.length() / 1.2) : 0;
    audio.setWade(Math.min(1, p.speed / 0.8 * 0.6 + netV));
    // 網を引くと水面に波紋
    this.netRipT = (this.netRipT || 0) - dt;
    if (this.net.inWater && netV > 0.1 && this.netRipT <= 0) {
      this.netRipT = 0.12;
      const x = this.net.surfaceCross();
      if (x) this.world.water.ripple(x.x, x.z, 0.3 + netV);
      this.world.murk.add(this.net.C.x, this.net.C.z, 0.12, 0.05 * netV);
    }
  }

  // ───────── 終わり・結果 ─────────
  async endSession(why = 'gate') {
    if (this.ending) return;
    this.ending = true;
    this.noPause = true;
    this.input.enabled = false;
    this.ui.warn('');
    this.ui.prompt('');
    if (why === 'dawn') {
      this.ui.telop('<div class="tl tl-catch" style="-webkit-text-stroke-color:#8a4a1a">夜が明けた</div>', 2);
      await new Promise((r) => setTimeout(r, 1300));
    }
    this.ui.fade(true);
    await new Promise((r) => setTimeout(r, 900));
    this.clearScene();
    this.input.unlock();
    this.mode = 'results';
    this.ui.showHud(false);
    this.body.group.visible = false;
    this.biku.group.visible = false;
    this.net.group.visible = false;
    this.setupResults();
    this.resultsCam(0, true);
    audio.setAmbience('results');
    audio.setMusic('results');
    await new Promise((r) => setTimeout(r, 300));
    this.ui.fade(false);

    const catches = this.catches || [];
    const items = [...catches].sort((a, b) => b.value - a.value).map((c) => {
      const sp = SPECIES[c.id];
      return { id: c.id, dish: sp.dish, label: `${nameOf(sp, c.cm)} ${c.cm}cm・${weightOf(sp, c.cm)}g`, value: c.value, isNew: c.isNew, legend: !!sp.legend };
    });
    const shown = [];
    const counts = {};
    for (const it of items) {
      counts[it.id] = (counts[it.id] || 0) + 1;
      if (counts[it.id] <= 4 || it.legend) shown.push(it);
      else {
        let g = shown.find((x) => x.group === it.id);
        if (!g) { g = { id: it.id, group: it.id, dish: SPECIES[it.id].dish, label: '', value: 0, n: 0 }; shown.push(g); }
        g.n++; g.value += it.value; g.label = `${SPECIES[it.id].name} ほか ${g.n}匹`;
      }
    }
    const total = this.total || 0;
    const rank = [...RANKS].reverse().find((r) => total >= r.min);
    const news = [];
    const stashed = stashCatch(catches);
    if (stashed) news.push(`${stashed}匹の獲物を持ち物に入れた`);
    save.data.days = this.day;
    if (total > save.data.best && total > 0) { news.push('自己最高記録！'); save.data.best = total; save.data.bestRank = rank.title; }
    for (const id of LEGEND_IDS) if (catches.some((c) => c.id === id)) news.push(`伝説の${SPECIES[id].name}をすくった！`);
    const fresh = catches.filter((c) => c.isNew).map((c) => SPECIES[c.id].name);
    if (fresh.length) news.push(`図鑑に登録: ${[...new Set(fresh)].join('・')}`);
    if (this.released) news.push(`小さいウナギを ${this.released}匹 逃がした`);
    if (this.legendNews) { news.push('図鑑がそろった！ 水路の主が現れる'); this.legendNews = false; }
    if (why === 'gate') news.push('水門まで歩ききった');
    save.write();
    const eels = catches.filter((c) => c.id === 'unagi' || c.id === 'nushiUnagi').length;
    const stats = [['見かけたウナギ', `${this.seen?.size || 0}匹`], ['すくったウナギ', `${eels}匹`], ['歩いた', `${Math.max(0, Math.round(this.player.s))}m`]];
    this.newNight(this.day + 1);
    this.setupResultsCatch();
    await this.ui.results({ day: this.day, items: shown, total, rank, news, stats });
  }

  // 夜明けの農道に置いたたらいに、獲物を放す（そばに網とビク）
  setupResults() {
    const w = this.world;
    const s = clamp(this.player.s, 8, S_END - 4);
    const g = new THREE.Group();
    const x0 = -2.0;
    const y0 = groundAt(s) + 0.035;
    const P = V3(x0, y0, -s);
    this.resultSpot = P;
    this.resultS = s;
    w.setDawn(1);
    this.world.lamp.visible = this.world.spill.visible = false;
    U.uLampI.value = 0;
    // たらい（白いプラスチック）
    const tubMat = new THREE.MeshStandardMaterial({ color: '#e6e9e6', roughness: 0.45, side: THREE.DoubleSide });
    const prof = [new THREE.Vector2(0, 0), new THREE.Vector2(0.31, 0), new THREE.Vector2(0.345, 0.02), new THREE.Vector2(0.385, 0.19), new THREE.Vector2(0.405, 0.2), new THREE.Vector2(0.41, 0.186)];
    const tub = new THREE.Mesh(new THREE.LatheGeometry(prof, 48), tubMat);
    tub.position.copy(P);
    tub.receiveShadow = tub.castShadow = true;
    g.add(tub);
    // 水（少し青く、底が透けて見える）
    const water = new THREE.Mesh(new THREE.CircleGeometry(0.378, 48).rotateX(-Math.PI / 2), new THREE.MeshPhysicalMaterial({ color: '#9fb8bc', roughness: 0.04, transmission: 0, transparent: true, opacity: 0.22, metalness: 0 }));
    water.position.copy(P).add(V3(0, 0.15, 0));
    water.renderOrder = 5;
    g.add(water);
    // たらいのそばに、今夜のタモ網を寝かせておく
    const net = this.net.makeProp();
    net.rotation.y = 2.68;
    net.position.set(P.x + 0.4, 0, P.z + 0.46);
    // 農道はかまぼこ形なので、枠と柄の下でいちばん高い地面にのせる（埋まらないように）
    const pd = V3(Math.sin(net.rotation.y), 0, Math.cos(net.rotation.y));
    let gy = -1e9;
    for (const d of [-0.2, 0, 0.2, 0.6, 1.0, 1.4, 1.8]) { const q = net.position.clone().addScaledVector(pd, d); gy = Math.max(gy, terrainAt(q.x, -q.z).y); }
    net.position.y = gy + 0.003;
    this.resultNet = net;
    g.add(net);
    this.scene.add(g);
    this.resultGroup = g;
    this.tub = { c: P.clone(), r: 0.33, y: y0 + 0.012, water: y0 + 0.15 };
    // 夜明けの光（東の空から、低く青白い光と、ほのかな朝焼け）
    if (!this.dawnLight) {
      this.dawnLight = new THREE.DirectionalLight('#ffd9c0', 1.2);
      this.scene.add(this.dawnLight, this.dawnLight.target);
    }
    this.dawnLight.visible = true;
    this.dawnLight.position.copy(P).add(V3(4, 3, -3));
    this.dawnLight.target.position.copy(P);
    this.dawnLight.castShadow = false;
    this.world.hemi.intensity = 1.5;
  }
  setupResultsCatch() {
    this.fauna.showTub(this.catches || [], this.tub);
  }
  resultsCam(dt, init) {
    const cam = this.camera;
    if (init) this.resT = 0;
    this.resT += dt;
    const c = this.tub ? this.tub.c : this.resultSpot;
    const k = smoothstep(0, 7, this.resT);
    // 側溝の側から、たらいを斜めに見下ろす（右に結果の紙が出るので、たらいは画面の左寄り）
    cam.position.set(c.x + 1.05 + Math.sin(this.resT * 0.08) * 0.04, c.y + lerp(1.0, 0.82, k), c.z + lerp(0.5, 0.36, k));
    cam.lookAt(c.x + 0.42, c.y + 0.02, c.z - 0.08);
    cam.fov = 48;
    cam.updateProjectionMatrix();
  }
}

export { S_STOP, HW };
