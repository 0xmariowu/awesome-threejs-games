// クサフグ拾いの本体: 状態の流れ・歩く・赤く光る点・手をずぼっと突っ込む・ふくらむフグ・石だった・バケツ・潮・結果
import * as THREE from 'three';
import { audio } from './core/audio.js';
import { Input } from './core/input.js';
import { Post } from './post.js';
import { World } from './world.js';
import { Backdrop } from './backdrop.js';
import { Field, LOW_TIDE, HIGH_TIDE } from './field.js';
import { Shine, EYE_COL } from './shine.js';
import { Pebbles } from './pebbles.js';
import { Aim } from './aim.js';
import { Body } from './body.js';
import { Player } from './player.js';
import { FX } from './fx.js';
import { Fugu } from './fugu.js';
import { Bucket } from './bucket.js';
import { renderThumbs } from './thumbs.js';
import { FUGU, ZUKAN_IDS, RANKS, SHARP_RANK, LEGEND_RANK, LEGEND_AT, BUCKET_MAX, DECOY, kusaTotal, rollSize } from './species.js';
import { UI, fullName, pct } from './ui.js';
import { save } from './save.js';
import { townLink } from '../shared/townLink.js';
import { clamp, lerp, smoothstep, RNG } from './core/noise.js';

// 町から来たとき（/kusafugu/?town）: タイトル・結果に「町に帰る」、獲った物は町の持ち物へ
const { TOWN, townURL, applyTownTexts, stashCatch } = townLink({ from: 'kusafugu', title: 'クサフグ拾い — 外の浜（吉山）' });

const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const SESSION = 300;               // 満ち潮までの遊べる時間（秒）
const START = { x: 12, z: 5.5 };
const REACH = [0.18, 0.78];        // 手を突っ込める距離（足もとから）
const DEEP = 0.5;                  // これより深いと、手が砂に届かない
const POOL = 16;                   // 近くのもぐったフグの模型の数
const MILESTONES = [5, 10, 15, 20, 25];
const rand = (a, b) => a + (b - a) * Math.random();
const ease = (k) => k * k * (3 - 2 * k);

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.mode = 'loading';
    this.t = 0;
    this.timers = [];
    const q = new URLSearchParams(location.search);
    this.debug = q.has('debug');
    this.mute = q.has('mute');
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
    this.shine = new Shine(this.scene);
    this.applyQuality(S.quality);
    this.resize();
    addEventListener('resize', () => this.resize());

    this.ui.loading(0.78, 'フグを砂にもぐらせています');
    await tick();
    this.newField(save.data.days + 1);
    this.pebbles = new Pebbles(this.scene);
    this.aim = new Aim(this.scene);
    this.fx = new FX(this.scene, this.overlay);
    this.fx.setPR(this.pr);
    this.player = new Player(this.camera, this.world);
    this.body = new Body(this.scene, this.camera);
    this.bucket = new Bucket(this.scene);
    this.hand = { L: this.newHand(-1), R: this.newHand(1) };
    // 近くのもぐったフグ（どれもクサフグの姿。正体はつかむまでわからない）
    this.pool = Array.from({ length: POOL }, (_, i) => {
      const f = new Fugu('kusa', 13, 0.13 + i * 0.061);
      f.group.visible = false;
      this.scene.add(f.group);
      return { f, it: null };
    });
    this.applySettings();

    this.ui.loading(0.86, '図鑑の挿絵を描いています');
    await tick();
    Object.assign(this.ui.thumbs, renderThumbs(ZUKAN_IDS));

    this.ui.loading(0.94, 'シェーダーを温めています');
    await tick();
    this.titleSetup();
    this.titleCam(0);
    this.world.aimHead(this.camera, 1);
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
    // 見分けの確認ページ（?lab）
    if (new URLSearchParams(location.search).has('lab')) {
      const { startLab } = await import('./lab.js');
      const go = () => { removeEventListener('pointerdown', go); audio.init(); this.input.lock(); startLab(this); };
      this.ui.hint('クリックで、見分けの確認をはじめる', 30);
      addEventListener('pointerdown', go);
    }
  }

  newField(day) {
    this.field = new Field(this.world.beach, day, START, this.legendOpen());
    for (const p of this.pool || []) { p.it = null; p.f.group.visible = false; }
    this.pebbles?.update(0, 0, this.field, (x, z) => this.world.groundAt(x, z), true);
  }
  /** 伝説（トラフグ）が砂にまじるか: クサフグを合計 LEGEND_AT 匹獲ったら */
  legendOpen() { return kusaTotal(save.data.zukan) >= LEGEND_AT; }
  /** 開放の知らせ。トラフグが砂にまじるのは次の夜から（今夜の浜は入れかえない） */
  unlockLegend(delay = 1.6) {
    if (save.data.legend || !this.legendOpen()) return;
    save.data.legend = true;
    save.write();
    this.legendNews = true;
    this.later(delay, () => {
      audio.celebrate();
      this.ui.telop(`<div class="tl tl-legend">${this.ui.chars('伝説開放', 0.08)}</div><div><span class="tl-sub">クサフグ ${LEGEND_AT} 匹！　次の夜から、この浜に……トラフグ！？</span></div><div><span class="tl-sub">いるわけがない。いるわけがないのだが。</span></div>`, 4.6, true);
      this.ui.toast(`<b>次の夜から</b>、<b>トラフグ</b>が砂にまじる<small>50 匹に 1 匹。光り方は、クサフグと同じ</small>`, { cls: 'info', img: this.ui.thumbs.tora, dur: 7 });
    });
  }
  newHand(sg) { return { sg, pos: V3(), vel: V3(), palm: V3(0, -1, 0), fwd: V3(0, 0, -1), pose: 'rest', init: false, lastPos: V3(), speed: 0 }; }

  installDebug() {
    const g = this;
    window.dbg = {
      async play() { while (g.mode !== 'title') await new Promise((r) => setTimeout(r, 100)); g.ui.only(); g.beginPlay(); },
      step(n = 1, dt = 1 / 60) { for (let i = 0; i < n; i++) { g.t += dt; g.update(dt); g.input.endFrame(); } g.post.u.uTime.value = g.t; g.post.render(); },
      freeze() { g.loop = () => {}; },
      tp(x, z, yaw = Math.PI, pitch = -0.6) { g.player.reset(x, z, yaw); g.player.pitch = pitch; g.bucket.reset(); for (const h of Object.values(g.hand)) h.init = false; },
      // いちばん近いフグ（'fugu'）・光る物（'decoy'）
      near(kind = 'fugu', id = null) {
        const p = g.player.pos;
        let best = null, bd = 1e9;
        for (const it of kind === 'fugu' ? g.field.fugu : g.field.decoys) {
          if (!it.alive || (id && it.id !== id) || (it.state && it.state !== 'bur')) continue;
          const d = Math.hypot(it.x - p.x, it.z - p.z);
          if (d < bd) { bd = d; best = it; }
        }
        return best;
      },
      // it の手前 0.55m に立って、そこをねらう
      aimAt(it, dist = 0.55) {
        const h = it.kind === 'fugu' ? g.field.head(it) : it;
        const a = Math.random() * 6.28;
        const px = h.x + Math.cos(a) * dist, pz = h.z + Math.sin(a) * dist;
        g.player.reset(px, pz, Math.atan2(-(h.x - px), -(h.z - pz)));
        g.player.pitch = -0.9;
        g.aimLock = { x: h.x, z: h.z };
        g.bucket.reset();
        for (const hh of Object.values(g.hand)) hh.init = false;
      },
      grab() { g.input.leftPressed = true; this.step(1); },
      catchNear(kind = 'fugu') { const it = this.near(kind); this.aimAt(it); this.step(20); this.grab(); this.step(200); g.aimLock = null; return it; },
      results(n = 20, legend = false) {
        for (let i = 0; i < n; i++) { const id = legend && i === 0 ? 'tora' : i % 11 === 5 ? 'higan' : i % 13 === 7 ? 'shosai' : 'kusa'; g.addCatch({ id, cm: rollSize(FUGU[id], Math.random(), Math.random()), seed: Math.random() }); }
        g.grabs = Math.round(n * 1.25); g.stones = g.grabs - n;
        g.day = save.data.days + 1;
        return g.endSession(n >= BUCKET_MAX ? 'full' : 'tide');
      },
      tide(k) { g.tideT = k; },
      // 自動で一晩遊ぶ（量の調整用）: 前 5m で光っている物から、skill の割合で本物（ほかは石）を選んで、そっと近づいてつかむ
      bot(secs = 300, skill = 0.75, dt = 1 / 30) {
        const p = g.player, inp = g.input;
        let T = 0, target = null, stuck = 0;
        while (T < secs && g.mode === 'play' && !g.ending) {
          T += dt;
          inp.keys.delete('KeyW'); inp.keys.delete('ShiftLeft');
          if (!g.grab) {
            if (!target || !target.alive || (target.state && target.state !== 'bur') || stuck > 12) {
              stuck = 0;
              const real = Math.random() < skill;
              let best = null, bd = 6;
              for (const it of g.field.around(p.pos.x, p.pos.z, 6)) {
                if (!it.alive || (it.kind === 'fugu') !== real || (it.state && it.state !== 'bur')) continue;
                const d = Math.hypot(it.x - p.pos.x, it.z - p.pos.z);
                if (d > 0.3 && d < bd && g.world.tide + 0.02 - g.world.groundAt(it.x, it.z) < DEEP - 0.05) { bd = d; best = it; }
              }
              target = best;
              if (!target) { p.yaw += 0.8; inp.keys.add('KeyW'); }
            }
            if (target) {
              const h = target.kind === 'fugu' ? g.field.head(target) : target;
              const d = Math.hypot(h.x - p.pos.x, h.z - p.pos.z);
              p.yaw = Math.atan2(-(h.x - p.pos.x), -(h.z - p.pos.z));
              if (d > 0.62) { inp.keys.add('KeyW'); if (d < 2) inp.keys.add('ShiftLeft'); stuck += dt; }
              else { g.aimLock = { x: h.x, z: h.z }; inp.leftPressed = true; target = null; }
            }
          }
          g.t += dt; g.update(dt); inp.endFrame(); g.aimLock = g.grab ? g.aimLock : null;
        }
        inp.keys.clear();
        return { T: Math.round(T), caught: g.catches.length, stones: g.stones, misses: g.misses, grabs: g.grabs };
      },
      legend() { const z = save.zk('kusa'); if (!g.legendOpen()) z.caught = (z.caught || 0) + LEGEND_AT; save.write(); return g.legendOpen(); },
      // 画像を手もとの受け口（node recv.mjs）へ送る
      async snap(name = 's', port = 5219, w = 1280, h = 720) {
        g.renderer.setSize(w, h, false); g.post.setSize(w, h); g.camera.aspect = w / h; g.camera.updateProjectionMatrix(); g.shine.setViewH(h * g.pr);
        g.post.render();
        await fetch(`http://localhost:${port}/?n=${name}`, { method: 'POST', body: g.renderer.domElement.toDataURL('image/jpeg', 0.88) });
        return name;
      },
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
    this.shine?.setViewH(h * (this.pr || 1));
  }

  applyQuality(q) {
    const dpr = devicePixelRatio || 1;
    const pr = q === 'low' ? Math.min(dpr, 1) * 0.75 : q === 'high' ? Math.min(dpr, 1.5) : Math.min(dpr, 1);
    this.renderer.setPixelRatio(pr);
    this.post.setPixelRatio(pr);
    this.post.bloom.enabled = q !== 'low';
    this.pr = pr;
    this.fx?.setPR(pr);
    this.shine?.setPR(pr);
    this.resize?.();
  }

  applySettings() {
    const S = save.data.settings;
    this.player.sens = S.sens;
    this.player.invertY = S.invertY;
    this.player.fovBase = S.fov;
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
        case 'quit': this.ui.hide('pause'); this.mode = 'play'; this.endSession('quit'); break;
        case 'again': this.startSession(); break;
        case 'toTitle': this.toTitle(); break;
        case 'toTown': this.toTown(); break;
      }
    };
    document.addEventListener('click', (e) => { const b = e.target.closest('[data-act]'); if (b) act(b.dataset.act); });
    addEventListener('keydown', (e) => {
      if (e.code === 'Escape' && this.overlayId) this.closeOverlay();
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
  get playing() { return this.mode === 'play'; }

  openOverlay(id) {
    this.overlayFrom = this.mode === 'pause' ? 'pause' : 'title';
    this.overlayId = id;
    if (id === 'zukan') this.ui.openZukan(); else this.ui.show(id);
    this.ui.hide(this.overlayFrom);
  }
  closeOverlay() {
    if (!this.overlayId) return;
    this.ui.hide(this.overlayId);
    this.overlayId = null;
    this.ui.show(this.overlayFrom);
    if (this.overlayFrom === 'title') this.ui.titleRecord();
  }

  later(sec, fn) { const tm = { t: sec, fn }; this.timers.push(tm); return tm; }
  showHint(key, html, dur = 5) {
    if (this.hintsShown?.has(key)) return false;
    const seen = save.data.hints[key] || 0;
    if (seen >= 2) return false;
    this.hintsShown?.add(key);
    save.data.hints[key] = seen + 1;
    this.ui.hint(html, dur);
    return true;
  }

  // ───────── タイトル: 夜の浅瀬の砂に、赤く光る点がいくつも。1 匹だけ、ライトの中を泳いでいる ─────────
  titleSetup() {
    const x = 4.5, z = 17;
    const w = this.world;
    this.titleSpot = V3(x, w.groundAt(x, z), z);
    w.tide = LOW_TIDE + 0.05;
    w.setMoon(0);
    if (!this.titleItems) {
      // 砂にもぐったフグ（本物の眼）と、まぎらわしい石
      const rng = new RNG(4242);
      const fugu = [], dec = [];
      for (let i = 0; i < 7; i++) {
        // カメラの前（沖の側）に扇形に
        fugu.push({ kind: 'fugu', id: 'kusa', glintCm: rng.range(10, 15), seed: rng.next(), x: x + rng.range(-1.3, 1.3), z: z + rng.range(-0.2, 2.6), yaw: rng.range(0, 6.28), alive: true, state: 'bur', eyeT: rng.range(0, 50) });
      }
      for (let i = 0; i < 12; i++) {
        const tilt = rng.range(0, 0.7), az = rng.range(0, 6.28);
        dec.push({ kind: 'decoy', x: x + rng.range(-1.6, 1.6), z: z + rng.range(-0.3, 3), n: [Math.sin(tilt) * Math.cos(az), Math.cos(tilt), Math.sin(tilt) * Math.sin(az)], sharp: rng.next() < 0.5 ? rng.range(0.3, 1) : rng.range(6, 20), str: rng.range(0.9, 1.4), col: [1, 0.15, 0.06], size: 0.015, seed: rng.next(), alive: true });
      }
      this.titleItems = { fugu, dec };
      this.titleFish = new Fugu('kusa', 14, 0.71);
      this.scene.add(this.titleFish.group);
    }
    this.titleFish.group.visible = true;
    this.titleCenter = this.titleSpot.clone();
    this.body.group.visible = false;
    this.bucket.group.visible = false;
    this.bucket.cord.visible = false;
  }
  titleCam(t, dt = 1 / 60) {
    const c = this.titleSpot, w = this.world;
    // 低い所から、沖（南）へ向かってゆっくり横に流れる。手前の砂に赤い光、奥に漁火と水平線
    const a = Math.sin(t * 0.05) * 0.35;
    const cam = this.camera;
    const back = 1.25;
    cam.position.set(c.x - Math.sin(a) * back + Math.sin(t * 0.07) * 0.3, w.tide + 0.62 + Math.sin(t * 0.25) * 0.03, c.z - Math.cos(a) * back);
    cam.lookAt(c.x + Math.sin(a) * 0.9, c.y + 0.12, c.z + Math.cos(a) * 0.9);
    cam.fov = 55;
    cam.updateProjectionMatrix();
    // 1 匹だけ、光の中をゆっくり泳ぐ
    const f = this.titleFish;
    if (f) {
      const fa = t * 0.22;
      const fx = c.x + Math.cos(fa) * 0.45, fz = c.z + 0.35 + Math.sin(fa) * 0.3;
      f.group.position.set(fx, w.groundAt(fx, fz) + 0.05 + Math.sin(t * 0.9) * 0.012, fz);
      f.group.rotation.set(0, Math.atan2(-Math.sin(fa) * 0.45, Math.cos(fa) * 0.3), Math.sin(t * 1.3) * 0.05);
      f.pose('swim', dt, { speed: 0.7 });
    }
  }
  // 町に帰る（/kusafugu/?town のとき。暗くして音を消してから移る）
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
    audio.setStroke(0);
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
      ? [{ text: '外の浜　夜八時半　満ち潮のはじまり', cls: 'day', wait: 1500 },
        { text: 'フグは、釣るものだと思っていた。', wait: 1700 },
        { text: '夜の波打ち際。クサフグは砂にもぐって眠る。', wait: 1800 },
        { text: 'ライトを当てると、眼が赤く光る。', wait: 1600 },
        { text: 'そこへ、手をずぼっと――', wait: 1500 },
        { text: 'つかめる。', cls: 'big', wait: 1100, sound: () => audio.squeak(0, 1) },
        { text: 'ただし、赤く光るのは眼だけじゃない。', wait: 1700 },
        { text: 'クサフグ拾い。', cls: 'big', wait: 1600, sound: () => audio.taiko(0, 0.7, 70) }]
      : [{ text: `外の浜　${day}回目の夜`, cls: 'day', wait: 1200 },
        { text: ['今夜も、波打ち際に赤い光がいくつも。', '眼か、石か。よく見て、手を出せ。', '近くでは、そっと歩く。', '頭を動かすと、光り方が変わるものがある。', 'バケツは 30 匹でいっぱい。'][day % 5], wait: 1600 },
        ...(this.legendOpen() ? [{ text: 'なぜか、トラフグが出るといううわさ。', wait: 1500 }] : []),
        { text: 'クサフグ拾い。', cls: 'big', wait: 1400, sound: () => audio.taiko(0, 0.7, 70) }];
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
    if (this.titleFish) this.titleFish.group.visible = false;
    this.tideT = 0;
    this.catches = [];
    this.grabs = 0;
    this.stones = 0;
    this.misses = 0;
    this.combo = 0;
    this.lastCatchT = -99;
    this.grab = null;
    this.ending = false;
    this.endingNow = false;
    this.warnedTide = false;
    this.timers = [];
    this.hintsShown = new Set();
    this.bestToday = null;
    this.nextWander = rand(5, 9);
    this.scared = 0;
    this.world.tide = LOW_TIDE;
    this.player.reset(START.x, START.z, Math.PI);
    this.player.pitch = -0.55;
    this.player.locked = false;
    this.player.lookOverride = null;
    this.player.crouchTarget = 0;
    for (const h of Object.values(this.hand)) h.init = false;
    this.body.group.visible = true;
    this.bucket.group.visible = true;
    this.bucket.clear();
    this.bucket.reset();
    this.aim.clearHoles();
    this.pebbles.update(START.x, START.z, this.field, (x, z) => this.world.groundAt(x, z), true);
    this.input.enabled = true;
    this.ui.showHud(true);
    this.ui.dimHud(false);
    this.noPause = false;
    this.camera.fov = save.data.settings.fov;
    this.camera.updateProjectionMatrix();
    audio.setMusic('play');
    audio.setAmbience('beach');
    this.legendNews = false;
    this.unlockLegend(3);
    this.later(1.2, () => this.showHint('look', '足もとの砂を、ヘッドライトで照らしながら歩こう。<b>赤く光る点</b>を探せ。', 7));
    this.later(14, () => { if (!this.grabs) this.showHint('walk', '光は、沖へ少し歩いた<b>すねくらいの深さ</b>に多い。', 6); });
  }

  clearScene() {
    if (this.grab?.fish) { this.scene.remove(this.grab.fish.group); this.grab.fish.dispose(); }
    if (this.grab?.prop) this.scene.remove(this.grab.prop);
    for (const p of this.flying || []) this.scene.remove(p.m);
    this.flying = [];
    this.grab = null;
    this.aimLock = null;
    if (this.player) this.player.lookOverride = null;
    this.ui.prompt('');
    this.ui.warn('');
    this.aim?.setReticle(false);
    for (const p of this.pool || []) { p.it = null; p.f.group.visible = false; }
    this.shine?.begin(); this.shine?.end();
  }

  pause() {
    if (!this.playing) return;
    this.mode = 'pause';
    this.input.enabled = false;
    this.ui.show('pause');
  }
  resume() {
    if (this.mode !== 'pause') return;
    this.ui.hide('pause');
    this.mode = 'play';
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
      this.titleCam(this.t, dt);
      w.aimHead(this.camera, 0.9, this.camera.position.distanceTo(this.titleSpot));
      this.updateWorld(dt, this.titleSpot);
      this.titleShine();
      return;
    }
    if (this.mode === 'results') {
      this.bucket.updateFish(dt);
      this.resultsCam(dt);
      w.aimHead(this.camera, 0.55, 0.9);
      this.updateWorld(dt, this.resultSpot);
      this.shine.begin(); this.shine.end();
      return;
    }
    // ─── 浜 ───
    for (const tm of this.timers) { tm.t -= dt; if (tm.t <= 0 && !tm.done) { tm.done = true; tm.fn(); } }
    this.timers = this.timers.filter((t) => !t.done);
    this.updateTide(dt);
    const p = this.player, inp = this.input;
    p.sneak = inp.down('ShiftLeft') || inp.down('ShiftRight');
    p.update(dt, inp, this.t);
    w.aimHead(this.camera, 1, this.subjectDist());
    if (this.mode === 'play') this.updatePlay(dt);
    this.updateFugu(dt);
    this.updateHands(dt);
    this.updateBody(dt);
    this.bucket.follow(dt, this.body, this.t, p);
    this.updateFlying(dt);
    this.pebbles.update(p.pos.x, p.pos.z, this.field, (x, z) => w.groundAt(x, z));
    this.updateWorld(dt, p.pos);
    this.updateShine();
    this.updateHud(dt);
    const u = this.post.u;
    u.uDrops.value = Math.max(0, u.uDrops.value - dt * 0.3);
    u.uFlash.value = Math.max(0, u.uFlash.value - dt * 3);
    this.ui.lockHint(!this.input.locked && !this.input.freeLook && this.playing);
  }

  /** ヘッドライトが照らしている物までの距離（持ち上げたフグ・砂） */
  subjectDist() {
    const cam = this.camera.position;
    // 手に持ったフグを見ている間も、まわりが暗くなりすぎないように
    if (this.grab?.fish && this.grab.phase !== 'lift') return Math.max(0.75, cam.distanceTo(this.grab.fish.group.position));
    if (this.grab?.prop) return Math.max(0.7, cam.distanceTo(this.grab.prop.position));
    const w = this.world, hl = w.head;
    const d = hl.target.position.clone().sub(hl.position).normalize();
    for (let t = 0.1; t < 4; t += 0.08) {
      const x = hl.position.x + d.x * t, y = hl.position.y + d.y * t, z = hl.position.z + d.z * t;
      if (y <= w.groundAt(x, z)) return t;
    }
    return 4;
  }

  updateWorld(dt, focus) {
    const w = this.world;
    w.update(dt, this.t, this.camera, focus);
    this.post.water.setBig(w.waves.big);
    this.backdrop.update(dt, this.t, this.camera);
    this.aim.update(dt, (x, z) => w.groundAt(x, z));
    this.fx.update(dt, (x, z) => w.waterAt(x, z, this.t));
  }

  // ───── 光る点 ─────
  updateShine() {
    const p = this.player, w = this.world;
    const meshEyes = [];
    const pe = [V3(), V3()], pa = [V3(), V3()];
    for (const s of this.pool) {
      if (!s.it || s.it.state === 'bur' || !s.f.group.visible) continue;
      for (let k = 0; k < 2; k++) {
        s.f.eyeWorld(k, pe[k], pa[k]);
        const ax = pa[k].clone(); ax.y += 0.75; ax.normalize(); // 光を返す向きは上寄り（field.buriedEyes とそろえる）
        meshEyes.push({ x: pe[k].x, y: pe[k].y, z: pe[k].z, dx: ax.x, dy: ax.y, dz: ax.z, seed: s.it.seed });
      }
    }
    this.shine.begin();
    this.field.gatherShine(this.shine, p.pos.x, p.pos.z, 8, (x, z) => w.groundAt(x, z), this.t, meshEyes);
    this.shine.end();
  }
  titleShine() {
    const w = this.world, gA = (x, z) => w.groundAt(x, z);
    this.shine.begin();
    const eyes = [{}, {}];
    for (const f of this.titleItems.fugu) {
      this.field.buriedEyes(f, gA, this.t, eyes);
      for (const e of eyes) this.shine.add(e.x, e.y, e.z, e.dx, e.dy, e.dz, 0, 1.6, f.seed, 1, EYE_COL);
    }
    for (const d of this.titleItems.dec) this.shine.add(d.x, gA(d.x, d.z) + 0.002, d.z, d.n[0], d.n[1], d.n[2], 1, d.sharp, d.seed, d.str, d.col);
    // 泳いでいる 1 匹の眼も
    const f = this.titleFish, pe = V3(), pa = V3();
    if (f?.group.visible) for (let k = 0; k < 2; k++) { f.eyeWorld(k, pe, pa); pa.y += 0.75; pa.normalize(); this.shine.add(pe.x, pe.y, pe.z, pa.x, pa.y, pa.z, 0, 1.6, 0.3, 1, EYE_COL); }
    this.shine.end();
  }

  // ───── 潮 ─────
  updateTide(dt) {
    if (!this.ending && this.mode === 'play' && !this.lab) this.tideT = Math.min(1, this.tideT + dt / SESSION);
    const k = this.tideT;
    this.world.tide = lerp(LOW_TIDE, HIGH_TIDE, k * 0.7 + k * k * 0.3);
    this.world.setMoon(k);
    if (k > 0.8 && !this.warnedTide) {
      this.warnedTide = true;
      audio.bell();
      this.ui.toast('<b>潮が満ちてきた</b><small>あと 1 分ほどで、浜へ上がる時間</small>', { cls: 'info', icon: '🌊' });
    }
    if (k >= 1 && !this.ending && this.mode === 'play' && !this.grab) this.endSession('tide');
  }

  // ───── 歩く・ねらう・突っ込む ─────
  updatePlay(dt) {
    const p = this.player, inp = this.input, w = this.world;
    // 右クリック長押しで、しゃがんでよく見る
    const look = inp.right && inp.enabled && !this.grab;
    p.crouchTarget = look || (this.grab && this.grab.phase === 'dive') ? 1 : this.grab ? 0.5 : 0;
    p.crouchK = this.grab ? 10 : 5;
    const T = this.aimPoint();
    const hot = T.ok && this.field.glintNear(T.x, T.z, 0.045);
    const showRet = !this.grab && T.hit;
    this.aim.setReticle(showRet, T.x, T.z, hot ? 1 : 0, T.ok ? 0 : 1);
    // 突っ込む（左クリック・スペース）
    const press = (inp.leftPressed || inp.pressed('Space')) && inp.enabled;
    if (press && !this.grab) {
      if (!T.hit || !T.ok) {
        this.ui.word(T.deep ? '深くて届かない' : '届かない', innerWidth / 2 / this.hz, innerHeight * 0.6 / this.hz, 'miss');
        if (T.far) this.showHint('far', '手が届くのは、<b>足もとから 80cm</b>くらいまで。近づいてから、ずぼっと。', 5);
      } else this.startPlunge(T);
    }
    // ばしゃばしゃ歩くと、近くのフグが驚いて逃げる
    const deep = w.tide + 0.02 - w.groundAt(p.pos.x, p.pos.z);
    if (p.speed > 0.8 && !p.sneak && deep > 0.05) {
      let n = 0;
      for (const f of this.field.around(p.pos.x, p.pos.z, 1.3)) {
        if (f.kind !== 'fugu' || !f.alive || f.state !== 'bur') continue;
        const d = Math.hypot(f.x - p.pos.x, f.z - p.pos.z);
        if (d < 1.3 && Math.random() < dt * 1.6 * (1.3 - d) * (p.speed - 0.6)) { this.flee(f, p.pos, 1); n++; }
      }
      if (n) {
        this.scared += n;
        if (this.scared >= 2) this.showHint('sneak', 'ばしゃばしゃ歩くと、フグが逃げる。光の近くでは <b>Shift</b> を押して<b>そっと</b>歩こう。', 7);
      }
    }
    // 案内
    if (this.grab) this.ui.prompt('');
    else if (hot && T.ok) this.ui.prompt('<kbd>左クリック</kbd> で手をずぼっ！');
    else if (look) this.ui.prompt('しゃがんで、よく見る……');
    else this.ui.prompt('');
    // ときどき、眠っていたフグが少し泳いで、またもぐる（前の方、2〜5m）
    this.nextWander -= dt;
    if (this.nextWander <= 0) {
      this.nextWander = rand(6, 12);
      const fw = p.forward;
      for (let k = 0; k < 15; k++) {
        const d = rand(2, 5), a = rand(-0.6, 0.6);
        const x = p.pos.x + (fw.x * Math.cos(a) - fw.z * Math.sin(a)) * d, z = p.pos.z + (fw.z * Math.cos(a) + fw.x * Math.sin(a)) * d;
        const f = this.field.nearestFugu(x, z, 1);
        if (f && f.state === 'bur') { this.flee(f, null, 0.35); break; }
      }
    }
  }

  /** 画面の真ん中の先の砂の上。手の届く所に寄せる（遠い時は far） */
  aimPoint() {
    const cam = this.camera, p = this.player, w = this.world;
    const ro = cam.position, rd = V3(0, 0, -1).applyQuaternion(cam.quaternion);
    if (this.aimLock) { const x = this.aimLock.x, z = this.aimLock.z; return { x, z, y: w.groundAt(x, z), ok: true, hit: true }; }
    let hit = null, prev = 0;
    for (let t = 0.05; t < 3.2; t += 0.03) {
      const x = ro.x + rd.x * t, y = ro.y + rd.y * t, z = ro.z + rd.z * t;
      if (y <= w.groundAt(x, z)) {
        let a = prev, b = t;
        for (let k = 0; k < 6; k++) { const m = (a + b) / 2; const yy = ro.y + rd.y * m; if (yy <= w.groundAt(ro.x + rd.x * m, ro.z + rd.z * m)) b = m; else a = m; }
        hit = { x: ro.x + rd.x * b, z: ro.z + rd.z * b };
        break;
      }
      prev = t;
    }
    if (!hit) return { hit: false, ok: false };
    let x = hit.x, z = hit.z;
    const dx = x - p.pos.x, dz = z - p.pos.z, d = Math.hypot(dx, dz);
    const far = d > REACH[1] + 0.02;
    if (d < REACH[0] && d > 1e-4) { x = p.pos.x + dx / d * REACH[0]; z = p.pos.z + dz / d * REACH[0]; }
    const depth = w.tide + 0.02 - w.groundAt(x, z);
    const deep = depth > DEEP;
    return { x, z, y: w.groundAt(x, z), hit: true, far, deep, ok: !far && !deep && depth > 0.0 };
  }

  startPlunge(T) {
    const p = this.player;
    const r = V3(-p.forward.z, 0, p.forward.x);
    const side = (T.x - p.pos.x) * r.x + (T.z - p.pos.z) * r.z < -0.04 ? 'L' : 'R';
    const h = this.hand[side];
    this.grab = { phase: 'dive', t: 0, T: V3(T.x, T.y, T.z), side, from: h.pos.clone(), waited: 0 };
    this.grabs++;
    save.data.grabs = (save.data.grabs || 0) + 1;
    this.aim.setReticle(false);
  }

  updateGrab(dt) {
    const G = this.grab, p = this.player, w = this.world;
    if (!G) return;
    G.t += dt;
    if (G.phase === 'dive') {
      if (p.crouch < 0.55 && G.waited < 0.22) { G.waited += dt; G.t = 0; G.from.copy(this.hand[G.side].pos); return; }
      const T = G.T;
      if (G.t > 0.07 && !G.splashed) {
        G.splashed = true;
        audio.plunge();
        this.post.water.ripple(T.x, T.z, 1.2);
      }
      if (G.t >= 0.2) {
        const g = w.groundAt(T.x, T.z);
        this.aim.hole(T.x, g, T.z);
        this.fx.sandPuff(T.x, g + 0.01, T.z, 10, 0.07, 1.1);
        this.fx.glow(T.x, g + 0.03, T.z, 12, 0.08, 1.1);
        this.fx.bubbles(T.x, g + 0.02, T.z, 5, 0.06);
        w.murk.add(T.x, T.z, 0.13, 0.1);
        this.resolvePlunge();
      }
    } else if (G.phase === 'miss') {
      if (G.t > 0.45) this.grab = null;
    } else if (G.phase === 'stone') this.updateStone(dt);
    else this.updateCatch(dt);
  }

  resolvePlunge() {
    const G = this.grab, T = G.T, f = this.field;
    const { fugu, decoy } = f.grabAt(T.x, T.z);
    if (fugu) { this.startCatch(fugu); return; }
    if (decoy) { this.startStone(decoy); return; }
    G.phase = 'miss'; G.t = 0;
    this.misses++;
    this.popWord('スカッ', T, 'miss');
    audio.miss();
    this.combo = 0;
    this.scareAround(T, 0.55, 0.35);
    if (this.misses >= 2 && !this.catches.length) this.showHint('aim', '赤く光る点に、<b>ねらいの輪のまん中</b>を合わせてから、ずぼっ。', 6);
  }

  /** 水音でまわりのフグが驚く */
  scareAround(T, r, pr) {
    let n = 0;
    for (const f of this.field.around(T.x, T.z, r)) {
      if (f.kind !== 'fugu' || !f.alive || f.state !== 'bur') continue;
      if (Math.hypot(f.x - T.x, f.z - T.z) < r && Math.random() < pr) { this.later(rand(0.05, 0.35), () => { if (f.state === 'bur' && f.alive) this.flee(f, T, 1); }); n++; }
    }
    return n;
  }

  // ───── 獲れた ─────
  startCatch(it) {
    const G = this.grab, w = this.world;
    // 砂の中から出てくるのは本当の姿（種類も大きさも）
    const slot = this.pool.find((s) => s.it === it);
    if (slot) { slot.it = null; slot.f.group.visible = false; }
    const fish = new Fugu(it.id, it.cm, it.seed);
    this.scene.add(fish.group);
    const g = w.groundAt(it.x, it.z);
    fish.group.position.set(it.x, g - fish.L * 0.02, it.z);
    fish.group.rotation.set(0, it.yaw, 0);
    fish.setSand(1);
    it.state = 'caught';
    this.field.remove(it);
    G.phase = 'lift'; G.t = 0;
    G.it = it; G.fish = fish;
    // 手の中のフグがよく見えるように、少し顔を上げる
    this.player.lookOverride = { yaw: this.player.yaw, pitch: Math.max(this.player.pitch, -0.42), k: 6 };
    G.from = fish.group.position.clone();
    G.q0 = fish.group.quaternion.clone();
    G.puffT = 0;
    G.spit = Math.random() < 0.28 && !it.id.startsWith('tora');
    audio.squeak(0.05, 0.8);
    this.player.shake = Math.max(this.player.shake, it.id === 'tora' ? 0.9 : 0.25);
    this.fx.sandPuff(it.x, g + 0.01, it.z, 14, 0.1, 1.4);
  }

  heldPose(fish) {
    const cam = this.camera;
    const fwd = V3(0, 0, -1).applyQuaternion(cam.quaternion), up = V3(0, 1, 0).applyQuaternion(cam.quaternion), right = V3(1, 0, 0).applyQuaternion(cam.quaternion);
    const big = fish.id === 'tora';
    const dist = big ? 0.62 : 0.17 + fish.L * 0.75;
    const pos = cam.position.clone().addScaledVector(fwd, dist).addScaledVector(up, big ? -0.1 : -0.035).addScaledVector(right, 0.015);
    // 頭を右へ、背を上へ、右の横腹をこちらへ（少し斜め前から）
    const z = right.clone().multiplyScalar(0.92).addScaledVector(fwd, 0.4).normalize();
    const y = up.clone().addScaledVector(fwd, 0.25);
    y.addScaledVector(z, -y.dot(z)).normalize();
    const x = new THREE.Vector3().crossVectors(y, z);
    const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
    return { pos, q, up, fwd, right };
  }

  updateCatch(dt) {
    const G = this.grab, fish = G.fish, it = G.it, w = this.world;
    const m = fish.group;
    const legend = it.id === 'tora';
    if (G.phase === 'lift') {
      const k = ease(smoothstep(0, legend ? 0.7 : 0.45, G.t));
      const hp = this.heldPose(fish);
      m.position.lerpVectors(G.from, hp.pos, k);
      m.position.y += Math.sin(k * Math.PI) * 0.05;
      m.quaternion.slerpQuaternions(G.q0, hp.q, k);
      fish.pose('flail', dt, { speed: 1.2 });
      fish.setSand(Math.max(0, 1 - G.t * 2.5));
      const wy = w.waterAt(m.position.x, m.position.z, this.t);
      if (!G.surfaced && (m.position.y > wy || G.t >= 0.45)) {
        G.surfaced = true;
        audio.splash(legend ? 1.3 : 0.7);
        this.fx.splash(m.position.x, wy, m.position.z, legend ? 40 : 16, legend ? 1.5 : 1.0);
        this.fx.glow(m.position.x, wy - 0.03, m.position.z, 20, 0.1, 1.3);
        this.post.water.ripple(m.position.x, m.position.z, legend ? 3 : 1.5);
        G.celebrate = this.addCatch({ id: it.id, cm: it.cm, seed: it.seed, pos: m.position.clone() });
        G.dur = legend ? 4.6 : G.celebrate ? 2.6 : 1.5;
      }
      if (G.t >= (legend ? 0.7 : 0.45)) { G.phase = 'hold'; G.t = 0; }
    } else if (G.phase === 'hold') {
      const hp = this.heldPose(fish);
      m.position.lerp(hp.pos, 1 - Math.exp(-14 * dt));
      m.quaternion.slerp(hp.q, 1 - Math.exp(-10 * dt));
      // 手の中で、ぷくーっとふくらむ（ときどき、キュッ、キュッ）
      G.puffT += dt;
      const pk = smoothstep(0.05, 0.95, G.puffT);
      fish.setPuff(pk * (legend ? 0.8 : 1));
      if (!G.puffed && G.puffT > 0.05) { G.puffed = true; audio.puff(0.8); }
      G.sq = (G.sq ?? 0.35) - dt;
      if (G.sq <= 0) { G.sq = rand(0.28, 0.6); audio.squeak(0, 1, legend ? 0.6 : 1 + (13 - it.cm) * 0.02); if (Math.random() < 0.5) this.popWord('キュッ', m.position, 'squeak'); }
      m.rotateZ(Math.sin(this.t * 17) * 0.012 * (1 - pk * 0.6));
      fish.pose(pk > 0.6 ? 'float' : 'flail', dt, { speed: 1.2 });
      fish.setSand(0);
      fish.setWet(1 - smoothstep(0.5, 3, G.t) * 0.3);
      if (Math.random() < dt * 10) {
        const b = new THREE.Box3().setFromObject(m);
        this.fx.drip(lerp(b.min.x, b.max.x, Math.random()), b.min.y, lerp(b.min.z, b.max.z, Math.random()));
        if (Math.random() < 0.2) audio.drip(0, 0.4);
      }
      // ぴゅっ（口から水を吹く）
      if (G.spit && !G.spat && G.t > 1.0) {
        G.spat = true;
        const mouth = V3(0, 0, 0.42).applyMatrix4(m.matrixWorld);
        const toCam = this.camera.position.clone().sub(mouth).normalize();
        for (let i = 0; i < 18; i++) this.fx.air.emit(mouth.x, mouth.y, mouth.z, toCam.x * 2 + rand(-0.3, 0.3), toCam.y * 2 + rand(0, 0.6), toCam.z * 2 + rand(-0.3, 0.3), 0.004 + Math.random() * 0.006, 0.6, 2);
        audio.spit();
        this.later(0.12, () => { this.post.u.uDrops.value = 0.75; this.popWord('ぴゅっ', mouth, 'squeak'); });
        this.showHint('spit', 'ふくらむ時に吸った水を、ぴゅっと吹くことがある。', 4);
      }
      const skip = this.input.leftPressed || this.input.pressed('Space');
      if (G.t > (G.dur ?? 1.5) || (skip && G.t > (legend ? 1.6 : 0.35))) { G.phase = 'toss'; G.t = 0; G.from2 = m.position.clone(); }
    } else if (G.phase === 'toss') {
      const k = smoothstep(0, 0.34, G.t);
      const b = this.bucket.mouth();
      m.position.lerpVectors(G.from2, b, k);
      m.position.y += Math.sin(k * Math.PI) * 0.12;
      m.rotateX(dt * 5);
      fish.pose('float', dt);
      if (k >= 1) {
        this.scene.remove(m);
        fish.dispose();
        this.bucket.add(it.id, it.cm, it.seed, true);
        this.player.lookOverride = null;
        this.fx.splash(b.x, b.y - 0.1, b.z, 6, 0.5);
        audio.bucket(this.catches.length);
        this.grab = null;
        if (this.catches.length === 1) this.later(0.5, () => this.showHint('more', '眠っているフグは、つかめば逃げない。<b>群れているところ</b>には、まだいる。', 6));
        if (this.catches.length >= BUCKET_MAX) this.endSession('full');
        else if (this.catches.length === BUCKET_MAX - 5) this.ui.toast('<b>バケツがいっぱいになってきた</b><small>あと 5 匹で、いっぱい</small>', { cls: 'info', icon: '🪣', dur: 3.5 });
        else if (this.tideT >= 1) this.endSession('tide');
      }
    }
  }

  /** 獲った数を足す。祝うか（初・大物・区切り・伝説）を返す */
  addCatch({ id, cm, seed, pos = null }) {
    const sp = FUGU[id];
    this.catches = this.catches || [];
    const z = save.zk(id);
    const isNew = !z.caught;
    const record = z.caught > 0 && cm > (z.best || 0);
    this.catches.push({ id, cm, seed, isNew });
    z.caught = (z.caught || 0) + 1;
    z.best = Math.max(z.best || 0, cm);
    save.data.total = (save.data.total || 0) + 1;
    save.write();
    if (this.mode === 'play') this.unlockLegend();
    if (!this.bestToday || cm > this.bestToday.cm) this.bestToday = { id, cm };
    this.combo = this.t - this.lastCatchT < 9 ? this.combo + 1 : 1;
    this.lastCatchT = this.t;
    const n = this.catches.length;
    const big = cm >= sp.size[0] + (sp.size[1] - sp.size[0]) * 0.82;
    const mile = MILESTONES.includes(n);
    const first = n === 1;
    const rare = id !== 'kusa';
    let celebrate = false;
    const img = this.ui.thumbs[id + '_puff'] || this.ui.thumbs[id] || '';
    const card = `<div><div class="tl-card"><img src="${img}" alt=""><div class="n">${fullName(sp)} ${cm}cm<small>${isNew ? '図鑑に登録' : record ? '最大記録！' : `${n}匹目`}</small></div></div></div>`;
    if (sp.legend) {
      celebrate = true;
      this.later(0.35, () => {
        audio.celebrate(); audio.taiko(1.9, 0.9, 46); audio.taiko(2.1, 0.9, 46);
        this.ui.telop(`<div class="tl tl-legend">${this.ui.chars('トラフグ！？', 0.07)}</div><div><span class="tl-sub">${isNew ? 'なんで、こんな浅瀬に……！　図鑑に登録' : 'また、いた……！　いるわけがないのに'}</span></div>${card}`, 4.4, true);
      });
      if (this.player) this.player.shake = Math.max(this.player.shake, 0.8);
    } else if (rare) {
      celebrate = true;
      this.later(0.3, () => { audio.celebrate(); this.ui.bigShout(isNew ? 'あれっ！？' : 'また出た！', `クサフグじゃない、${sp.name}だ！`, card, 3); });
    } else if (first || isNew) {
      celebrate = true;
      this.later(0.3, () => { audio.celebrate(); this.ui.bigShout('獲れたよー！', first && !isNew ? '今夜の一匹目！' : 'ほんとに手でつかめた！', card, 2.8); });
    } else if (big || record) {
      celebrate = true;
      this.later(0.25, () => { audio.pickup(1); audio.taiko(0, 0.6, 64); this.ui.telop(`<div class="tl tl-catch">でかい！</div>${card}`, 2.2, true); });
    } else if (mile) {
      this.later(0.1, () => { audio.milestone(); this.ui.telop(`<div class="tl tl-count">${this.ui.chars(`${n}匹！`, 0.06)}</div>`, 1.5); });
    } else {
      audio.pickup(0);
      if (this.combo >= 2) audio.combo(this.combo);
    }
    if (pos) this.popWord('+1', pos, 'plus');
    this.ui.toast(`<b>${fullName(sp)}</b> ${cm}cm<small>${isNew ? '図鑑に登録！' : record ? '最大記録！' : `${n}匹目`}</small>`, { img, cls: isNew || rare ? 'info' : '', dur: 2.6 });
    return celebrate;
  }

  // ───── 石だった ─────
  startStone(d) {
    const G = this.grab;
    d.alive = false;
    this.field.remove(d);
    const prop = this.pebbles.makeProp(d);
    this.scene.add(prop);
    const g = this.world.groundAt(d.x, d.z);
    prop.position.set(d.x, g, d.z);
    G.phase = 'stone'; G.t = 0; G.prop = prop; G.d = d; G.from = prop.position.clone();
    this.stones++;
    save.data.stones = (save.data.stones || 0) + 1;
    save.write();
    this.combo = 0;
    const n = this.scareAround(G.T, 1.0, 0.55);
    const info = DECOY[d.type];
    this.later(0.28, () => {
      audio.stone(d.type);
      this.popWord(info.word, prop.position, 'stone');
      if (n) this.later(0.4, () => this.ui.toast(`<b>${info.name}</b>だった<small>水音で、まわりのフグが${n}匹逃げた</small>`, { icon: '🪨', dur: 2.6 }));
      else this.ui.toast(`<b>${info.name}</b>だった<small>${info.sub}</small>`, { icon: '🪨', dur: 2.6 });
    });
    if (this.stones === 1) this.later(1.4, () => this.showHint('stone', '赤く光るのは、眼だけじゃない。<b>頭を動かしたり、しゃがんだり</b>して、光り方をよく見比べよう。', 8));
    if (this.stones === 4) this.later(1.4, () => this.showHint('pair', '眼は<b>2つ並んで</b>光ることが多い。でも石も、たまたま並ぶ。', 7));
  }
  updateStone(dt) {
    const G = this.grab, m = G.prop;
    if (G.t < 1.1) {
      const hp = this.heldPose({ id: 'kusa', L: 0.1 });
      const k = ease(smoothstep(0, 0.4, G.t));
      m.position.lerpVectors(G.from, hp.pos.clone().addScaledVector(hp.up, 0.01), k);
      m.rotation.y += dt * 1.5;
    } else {
      // ぽいっと横へ投げる
      if (!G.thrown) {
        G.thrown = true;
        const cam = this.camera;
        const right = V3(1, 0, 0).applyQuaternion(cam.quaternion), fwd = V3(0, 0, -1).applyQuaternion(cam.quaternion);
        const v = right.multiplyScalar(G.side === 'L' ? -1.6 : 1.6).addScaledVector(fwd, 1.2).add(V3(0, 1.8, 0));
        this.flying.push({ m, v, t: 0 });
        G.prop = null;
        this.grab = null;
      }
    }
    void dt;
  }
  updateFlying(dt) {
    for (const f of [...this.flying]) {
      f.t += dt;
      f.v.y -= 9.8 * dt;
      f.m.position.addScaledVector(f.v, dt);
      f.m.rotation.x += dt * 9;
      const wy = this.world.waterAt(f.m.position.x, f.m.position.z, this.t);
      if (f.m.position.y < wy || f.t > 3) {
        audio.plop();
        this.fx.splash(f.m.position.x, wy, f.m.position.z, 8, 0.6);
        this.post.water.ripple(f.m.position.x, f.m.position.z, 0.8);
        this.scene.remove(f.m);
        this.flying.splice(this.flying.indexOf(f), 1);
      }
    }
  }

  // ───── フグ: もぐっている姿（近くだけ）・驚いて逃げる・またもぐる ─────
  /** f を泳がせる。from があればそこから遠ざかる。speed: 1 = 驚いて逃げる、小さいとのんびり */
  flee(f, from, speed = 1) {
    if (f.state !== 'bur') return;
    let a = Math.random() * Math.PI * 2;
    if (from) a = Math.atan2(f.x - from.x, f.z - from.z) + rand(-0.6, 0.6);
    const scared = speed > 0.6;
    f.state = 'swim';
    f.swim = { t: 0, a, v: scared ? rand(0.8, 1.2) : rand(0.18, 0.3), dur: scared ? rand(1.2, 2.2) : rand(2.5, 4.5), h: 0, scared, bury: 0 };
    const g = this.world.groundAt(f.x, f.z);
    this.fx.sandPuff(f.x, g + 0.01, f.z, scared ? 8 : 3, 0.06, scared ? 1 : 0.4);
    if (scared) {
      const p = this.player.pos;
      const d = Math.hypot(f.x - p.x, f.z - p.z);
      if (d < 4) audio.bolt(clamp((f.x - p.x) * 0.3, -0.8, 0.8), clamp(1.5 - d * 0.3, 0.3, 1));
      this.world.murk.add(f.x, f.z, 0.08, 0.05);
    }
  }

  updateFugu(dt) {
    const p = this.player, w = this.world, F = this.field;
    // 泳いでいるフグ
    for (const f of F.fugu) {
      if (f.state !== 'swim') continue;
      const S = f.swim;
      S.t += dt;
      const g0 = w.groundAt(f.x, f.z);
      if (S.t < S.dur) {
        S.a += Math.sin(this.t * 1.3 + f.seed * 9) * dt * 0.6;
        const nx = f.x + Math.sin(S.a) * S.v * dt, nz = f.z + Math.cos(S.a) * S.v * dt;
        const d = w.tide - w.groundAt(nx, nz);
        if (d > 0.06 && d < 0.55) { f.x = nx; f.z = nz; F.moved(f); } else S.a += Math.PI * 0.7;
        S.v *= Math.exp(-dt * (S.scared ? 0.6 : 0.1));
        S.h = lerp(S.h, S.scared ? 0.06 : 0.04, 1 - Math.exp(-6 * dt));
        f.yaw = S.a;
      } else {
        // またもぐる
        S.bury += dt;
        S.h = lerp(S.h, 0, 1 - Math.exp(-5 * dt));
        if (Math.random() < dt * 14) this.fx.sandPuff(f.x, g0 + 0.01, f.z, 1, 0.04, 0.4);
        if (S.bury > 0.6) { f.state = 'bur'; f.swim = null; }
      }
    }
    // 近くのフグに模型を割り当てる（泳いでいるのを先に）
    const near = [];
    for (const f of F.around(p.pos.x, p.pos.z, 3.4)) {
      if (f.kind !== 'fugu' || !f.alive) continue;
      const d = Math.hypot(f.x - p.pos.x, f.z - p.pos.z);
      if (d < 3.4 || f.state === 'swim') near.push([f.state === 'swim' ? d - 10 : d, f]);
    }
    near.sort((a, b) => a[0] - b[0]);
    const want = new Set(near.slice(0, POOL).map((x) => x[1]));
    for (const s of this.pool) if (s.it && (!want.has(s.it) || !s.it.alive)) { s.it = null; s.f.group.visible = false; }
    for (const f of want) {
      if (this.pool.some((s) => s.it === f)) continue;
      const s = this.pool.find((q) => !q.it);
      if (!s) break;
      s.it = f;
      s.f.group.visible = true;
      s.f.group.scale.setScalar(f.glintCm / 100);
      s.f.L = f.glintCm / 100;
      s.f.u.uSeed.value = f.seed;
    }
    const eyeUp = 0.0006;
    for (const s of this.pool) {
      const f = s.it;
      if (!f) continue;
      const m = s.f.group, L = f.glintCm / 100;
      const g = w.groundAt(f.x, f.z);
      if (f.state === 'bur') {
        // 眼の上半分だけが砂から出るように、体を沈める
        const eyeY = g + eyeUp + L * 0.009;
        const ey = s.f.eyes[0].m.position.y * L;
        m.position.set(f.x, eyeY - ey, f.z);
        m.rotation.set(-0.12, f.yaw, 0);   // 少し頭を上げて、眼だけを砂から出す
        s.f.setSand(1);
        s.f.pose('rest', dt);
      } else {
        const S = f.swim;
        const bury = S ? smoothstep(0, 0.6, S.bury) : 1;
        const swimY = g + L * 0.11 + S.h;
        const eyeY = g + eyeUp + L * 0.009 - s.f.eyes[0].m.position.y * L;
        m.position.set(f.x, lerp(swimY, eyeY, bury), f.z);
        m.rotation.set(Math.sin(this.t * 3 + f.seed * 5) * 0.05, f.yaw, Math.sin(this.t * 2 + f.seed) * 0.06);
        s.f.setSand(bury * 0.8);
        s.f.pose(bury > 0.5 ? 'rest' : 'swim', dt, { speed: S?.scared ? 1.6 : 0.8 });
      }
    }
  }

  // ───── 手と体 ─────
  updateHands(dt) {
    const p = this.player, w = this.world;
    this.updateGrab(dt);
    const f = p.forward, r = V3(-f.z, 0, f.x);
    const G = this.grab;
    for (const key of ['L', 'R']) {
      const h = this.hand[key], sg = h.sg;
      let pos, palm, fwd, pose;
      if (G && G.side === key && (G.phase === 'dive' || G.phase === 'miss')) {
        const T = G.T;
        if (G.phase === 'dive') {
          const k = smoothstep(0, 0.14, G.t);
          const above = V3(T.x, T.y + 0.07, T.z);
          pos = G.from.clone().lerp(above, ease(k));
          if (G.t > 0.14) pos = above.clone().lerp(V3(T.x, T.y - 0.02, T.z), smoothstep(0.14, 0.2, G.t));
          palm = V3(0, -1, 0); fwd = f.clone().addScaledVector(r, sg * 0.25).normalize(); pose = G.t > 0.15 ? 'grab' : 'flat';
        } else {
          pos = V3(T.x, T.y + smoothstep(0, 0.35, G.t) * 0.1 - 0.02, T.z);
          palm = V3(0, -1, 0); fwd = f.clone(); pose = 'dig';
        }
      } else if (G && G.side === key && G.fish && (G.phase === 'lift' || G.phase === 'hold')) {
        // フグを手のひらに縦長にのせる（指先は尾の方へ、腹を下から支える）
        const cq = this.camera.quaternion;
        const cr = V3(1, 0, 0).applyQuaternion(cq), cf = V3(0, 0, -1).applyQuaternion(cq);
        cf.y = 0; cf.normalize();
        const c = G.fish.center();
        palm = V3(0, 1, 0).addScaledVector(cf, -0.2).normalize();
        pos = c.clone().addScaledVector(palm, -(G.fish.radius * 0.92 + 0.014));
        fwd = cr.clone().multiplyScalar(-sg).addScaledVector(cf, 0.35).normalize();
        pose = 'hold';
      } else if (G && G.side === key && G.phase === 'stone' && G.prop) {
        // 手のひらを開くと、石がのっている
        const cq = this.camera.quaternion;
        const cr = V3(1, 0, 0).applyQuaternion(cq), cf = V3(0, 0, -1).applyQuaternion(cq);
        cf.y = 0; cf.normalize();
        palm = V3(0, 1, 0).addScaledVector(cf, -0.5).normalize();
        pos = G.prop.position.clone().addScaledVector(palm, -(G.d.size * 0.4 + 0.011));
        fwd = cr.clone().multiplyScalar(-sg * 0.35).addScaledVector(cf, 0.9).addScaledVector(V3(0, 1, 0), 0.3).normalize();
        pose = 'open';
      } else {
        // ふだんは体のわきに。しゃがむと、ひざの上へ
        const ck = smoothstep(0.3, 0.9, p.crouch);
        pos = p.pos.clone().add(V3(0, lerp(0.62, 0.42, ck), 0)).addScaledVector(f, lerp(0.08, 0.3, ck)).addScaledVector(r, sg * lerp(0.2, 0.16, ck));
        palm = r.clone().multiplyScalar(-sg).lerp(V3(0, -1, 0), ck * 0.7).normalize();
        fwd = V3(0, -1, 0).lerp(f.clone().addScaledVector(r, sg * 0.35), ck).normalize();
        pose = ck > 0.5 ? 'flat' : 'rest';   // しゃがむと、ひざの上に手をのせる
      }
      if (!h.init) { h.pos.copy(pos); h.init = true; }
      h.lastPos.copy(h.pos);
      const rate = G && G.side === key ? 40 : 14;
      h.pos.lerp(pos, 1 - Math.exp(-rate * dt));
      h.palm.copy(palm); h.fwd.copy(fwd); h.pose = pose;
      h.speed = lerp(h.speed, h.pos.distanceTo(h.lastPos) / Math.max(dt, 1e-3), 1 - Math.exp(-10 * dt));
      // 水の中をかき回すと夜光虫が光り、水面に波紋
      const wy = w.waterAt(h.pos.x, h.pos.z, this.t);
      if (h.pos.y < wy - 0.02 && h.speed > 0.15) {
        if (Math.random() < dt * 30 * Math.min(1, h.speed)) this.fx.glow(h.pos.x, h.pos.y + 0.01, h.pos.z, 1, 0.05, 1);
        h.ripT = (h.ripT || 0) - dt;
        if (h.ripT <= 0) { h.ripT = 0.22; this.post.water.ripple(h.pos.x, h.pos.z, 0.35); }
      }
    }
  }

  updateBody(dt) {
    const p = this.player, b = this.body;
    const s = { pos: p.pos, yaw: p.yaw, speed: p.speed, crouch: p.crouch, groundY: p.pos.y, grips: null, rodUp: null };
    for (const key of ['L', 'R']) {
      const h = this.hand[key];
      s[key === 'L' ? 'handL' : 'handR'] = { pos: h.pos, palm: h.palm, fwd: h.fwd, pose: h.pose };
    }
    b.update(dt, s);
    audio.setLap(clamp((p.waterY - this.world.tide) / 0.15, 0, 1) * smoothstep(0.05, 0.3, p.depth) * (p.sneak ? 0.4 : 1));
    // 歩くと足もとの夜光虫が光る（そっと歩くと少し）
    if (p.speed > 0.15 && p.depth > 0.05 && Math.random() < dt * (p.sneak ? 6 : 20) * p.speed) {
      const fw = p.forward;
      this.fx.glow(p.pos.x + fw.x * 0.1 + (Math.random() - 0.5) * 0.2, p.pos.y + 0.03, p.pos.z + fw.z * 0.1 + (Math.random() - 0.5) * 0.2, 2, 0.08, 1);
    }
  }

  popWord(text, pos, cls) {
    const v = pos.clone ? pos.clone().project(this.camera) : V3(pos.x, pos.y ?? 0, pos.z).project(this.camera);
    if (v.z < 1) this.ui.word(text, (v.x + 1) / 2 * innerWidth / this.hz, (1 - v.y) / 2 * innerHeight / this.hz - 20, cls);
  }

  // ───── HUD ─────
  sharpText() {
    const hits = this.catches?.length || 0, tries = hits + (this.stones || 0);
    return { text: tries ? `${hits} / ${tries}` : '—', cls: !tries ? '' : hits / tries >= 0.8 ? 'good' : hits / tries < 0.5 ? 'bad' : '' };
  }
  updateHud() {
    const mins = 20 * 60 + 30 + this.tideT * 30;
    const clock = `${Math.floor(mins / 60)}:${String(Math.floor(mins % 60)).padStart(2, '0')}`;
    const left = Math.max(0, SESSION * (1 - this.tideT));
    const bt = this.bestToday;
    const sh = this.sharpText();
    this.ui.updateHud({
      clock, left: left > 0 ? `潮が満ちるまで ${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}` : '満ち潮',
      tideT: this.tideT, bagN: this.catches.length, kg: bt ? `いちばん ${bt.cm}cm` : '', bagBest: '',
      sharp: sh.text, sharpCls: sh.cls, sneak: this.player.sneak,
      combo: this.t - this.lastCatchT < 9 ? this.combo : 0,
    });
  }

  // ───────── 終わり・結果 ─────────
  async endSession(reason = 'tide') {
    if (this.endingNow) return;
    this.endingNow = true;
    this.ending = true;
    this.noPause = true;
    this.input.enabled = false;
    this.ui.warn('');
    this.ui.prompt('');
    if (reason === 'tide') { this.ui.telop('<div class="tl tl-catch">満ち潮</div><div><span class="tl-sub blue">今夜は、ここまで</span></div>', 1.6); await new Promise((r) => setTimeout(r, 1200)); }
    if (reason === 'full') {
      audio.celebrate();
      this.ui.telop(`<div class="tl tl-big">${this.ui.chars('バケツいっぱい！', 0.06)}</div><div><span class="tl-sub red">${BUCKET_MAX}匹。釣るより、ずっと早い</span></div>`, 2.6, true);
      await new Promise((r) => setTimeout(r, 2400));
    }
    this.ui.fade(true);
    await new Promise((r) => setTimeout(r, 900));
    const catches = this.catches || [];
    this.clearScene();
    this.input.unlock();
    this.mode = 'results';
    this.ui.showHud(false);
    this.body.group.visible = false;
    this.setupResults(catches);
    this.resultsCam(0, true);
    audio.setAmbience('results');
    audio.setMusic('results');
    await new Promise((r) => setTimeout(r, 300));
    this.ui.fade(false);
    this.endingNow = false;

    const groups = {};
    for (const c of catches) {
      const g = groups[c.id] || (groups[c.id] = { id: c.id, n: 0, best: 0, isNew: false });
      g.n++; g.best = Math.max(g.best, c.cm); g.isNew = g.isNew || c.isNew;
    }
    const items = ZUKAN_IDS.filter((id) => groups[id]).map((id) => {
      const g = groups[id], sp = FUGU[id];
      return { id, n: g.n, name: fullName(sp), label: `いちばん大きいのは ${g.best}cm`, isNew: g.isNew };
    }).sort((a, b) => (FUGU[b.id].rarity - FUGU[a.id].rarity));
    const n = catches.length;
    const tries = n + this.stones;
    const k = tries ? n / tries : 0;
    const legendTonight = catches.some((c) => FUGU[c.id].legend);
    let rank = [...RANKS].reverse().find((r) => n >= r.min);
    if (n >= BUCKET_MAX && tries && k >= 0.9) rank = SHARP_RANK;
    if (legendTonight) rank = LEGEND_RANK;
    const news = [];
    const stashed = stashCatch(catches);
    if (stashed) news.push(`${stashed}匹のフグを持ち物に入れた`);
    save.data.days = this.day;
    if (n > save.data.best && n > 0) { news.push('一晩の最高記録！'); save.data.best = n; save.data.bestRank = rank.title; }
    if (tries >= 10 && k > (save.data.bestSharp || 0)) { if (save.data.bestSharp) news.push('見分けの最高記録！'); save.data.bestSharp = k; }
    const fresh = catches.filter((c) => c.isNew).map((c) => fullName(FUGU[c.id]));
    if (fresh.length) news.push(`図鑑に登録: ${[...new Set(fresh)].join('・')}`);
    if (this.legendNews) news.push('伝説開放: 次の夜から、トラフグが砂にまじる');
    save.write();
    const why = reason === 'full' ? 'バケツが、いっぱいになった。' : reason === 'quit' ? '浜から上がった。' : '潮が満ちて、今夜はおしまい。';
    const stats = [['手を突っ込んだ', `${this.grabs}回`], ['石だった', `${this.stones}回`], ['スカッ', `${this.misses}回`]];
    this.newField(this.day + 1);
    await this.ui.results({ day: this.day, why, count: n, items, sharp: tries ? `${pct(k)}` : '—', rank, news, stats });
  }

  // 獲ったフグを、ランタンのそばに置いたバケツの中で泳がせる。右は結果の紙が重なるので、バケツは画面の左に
  setupResults(catches) {
    const w = this.world, bd = this.backdrop;
    const P = bd.campSpot.clone();
    w.tide = 0.12;
    const pos = V3(P.x - 0.35, w.groundAt(P.x - 0.35, P.z + 0.25), P.z + 0.25);
    this.resultSpot = P;
    this.bucket.group.visible = true;
    this.bucket.clear();
    this.bucket.place(pos, 0.4);
    catches.forEach((c, i) => this.bucket.add(c.id, c.cm, c.seed, i >= catches.length - 3));
    // トラフグはバケツに入りきらないので、バケツの手前（カメラの側）の砂に寝かせる
    const toCam = V3(Math.sin(0.55), 0, Math.cos(0.55)), side = V3(Math.cos(0.55), 0, -Math.sin(0.55));
    const spot = pos.clone().addScaledVector(toCam, 0.24).addScaledVector(side, -0.3);
    this.bucket.bigSpot = this.bucket.group.worldToLocal(spot.clone());
    this.bucket.bigYaw = Math.atan2(side.x, side.z) - 0.4 + 0.3;
    this.resultCenter = pos.clone().add(V3(0, 0.18, 0));
    bd.lanternLight.intensity = 1.2;
  }
  resultsCam(dt, init) {
    const cam = this.camera;
    if (init) this.resT = 0;
    this.resT += dt;
    const c = this.resultCenter || this.resultSpot;
    const k = smoothstep(0, 7, this.resT);
    // 海の側の斜め上から、バケツの中をのぞく。バケツは画面の左に（右は結果の紙が重なる）。ゆっくり寄る
    const a = 0.55 + this.resT * 0.01;
    const R = lerp(0.95, 0.78, k);
    cam.position.set(c.x + Math.sin(a) * R, c.y + lerp(0.78, 0.66, k), c.z + Math.cos(a) * R);
    const right = V3(Math.cos(a), 0, -Math.sin(a));
    cam.lookAt(c.x + right.x * 0.3, c.y - 0.1, c.z + right.z * 0.3);
    cam.fov = 48;
    cam.updateProjectionMatrix();
  }
}

const tick = () => new Promise((r) => setTimeout(r, 0));
