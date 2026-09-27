// ゲーム本体: 状態遷移・一日の流れ・漁のロジック・演出
import * as THREE from 'three';
import { U } from './core/shaderPatch.js';
import { audio } from './core/audio.js';
import { Input } from './core/input.js';
import { Post } from './core/post.js';
import { World } from './world/world.js';
import { Ecosystem } from './fish/creatures.js';
import { Player, BREATH_SEC } from './player.js';
import { Spear, makeSpearProp } from './spear.js';
import { UI, ZUKAN_ORDER, LEGEND_ORDER, legendUnlocked, entryOf, yen } from './ui.js';
import { save } from './save.js';
import { SPECIES, PICKUPS, RANKS, valueOf } from './fish/species.js';
import { prepareFishTextures } from './fish/models.js';
import { makeDisplayModel, renderThumbs } from './fish/thumbs.js';
import { clamp, lerp, smoothstep, RNG } from './core/noise.js';
import { TOWN, TOWN_RANKS, applyTownTexts, townIntro, stashCatch, townURL } from './townMode.js';

const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const DAY_LEN = 360;
const GRACE = 25;
const rand = (a, b) => a + (b - a) * Math.random();

// 時間帯ごとの色 (d = 0 朝 → 1 日没)
const KEYS = [
  { d: 0.0, sun: '#fff0d8', zen: '#2d6cc4', hor: '#c2def0', fog: '#c8dce6', sh: '#26a0ab', dp: '#073a55', si: 2.7, hi: 1.0, fd: 0.026 },
  { d: 0.45, sun: '#ffffff', zen: '#1d5fc4', hor: '#b4dcf2', fog: '#c2dcea', sh: '#2ab2b9', dp: '#08405c', si: 3.2, hi: 1.1, fd: 0.022 },
  { d: 0.8, sun: '#ffdcaa', zen: '#3d6cb0', hor: '#f1d8b6', fog: '#e6d2bc', sh: '#2896a0', dp: '#08324a', si: 2.5, hi: 0.85, fd: 0.026 },
  { d: 1.0, sun: '#ff9148', zen: '#34457e', hor: '#ff9f68', fog: '#d89a78', sh: '#236a78', dp: '#041a2b', si: 1.5, hi: 0.5, fd: 0.034 },
  { d: 1.15, sun: '#ff6a30', zen: '#1f2a52', hor: '#e0704a', fog: '#8a5a50', sh: '#1a4a58', dp: '#031220', si: 0.8, hi: 0.32, fd: 0.045 },
];
const _c1 = new THREE.Color(), _c2 = new THREE.Color();
function envAt(d) {
  let i = 0;
  while (i < KEYS.length - 2 && d > KEYS[i + 1].d) i++;
  const a = KEYS[i], b = KEYS[i + 1];
  const t = smoothstep(a.d, b.d, d);
  const col = (k) => _c1.set(a[k]).lerp(_c2.set(b[k]), t).clone();
  return { sun: col('sun'), zen: col('zen'), hor: col('hor'), fog: col('fog'), sh: col('sh'), dp: col('dp'), si: lerp(a.si, b.si, t), hi: lerp(a.hi, b.hi, t), fd: lerp(a.fd, b.fd, t) };
}

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.mode = 'loading';
    this.t = 0;
    this.dayTime = 0;
    this.bag = [];
    this.dayCatch = [];
    this.total = 0;
    this.timers = [];
    this.maxDepth = 0;
    this.debug = new URLSearchParams(location.search).has('debug');
  }

  // ───────── 初期化 ─────────
  async init() {
    applyTownTexts(); // 町から来たとき（/mori/?town）は舞台の文言を差しかえる
    save.load();
    const S = save.data.settings;
    const renderer = (this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: false, powerPreference: 'high-performance' }));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0x000000, 1, 2); // フォグ用のdefineを有効化（色は独自）
    // near を小さくしすぎると遠景の深度精度が落ちてちらつくので 0.1 に
    this.camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.1, 1150);
    this.scene.add(this.camera);
    this.sun = new THREE.DirectionalLight('#ffffff', 3);
    this.scene.add(this.sun, this.sun.target);
    this.hemi = new THREE.HemisphereLight('#bfe3ff', '#c8b890', 1.0);
    this.scene.add(this.hemi);

    this.ui = new UI();
    this.input = new Input(this.canvas);
    this.input.dragLook = this.debug;
    this.post = new Post(renderer, this.scene, this.camera);
    this.applyQuality(S.quality);
    this.resize();
    addEventListener('resize', () => this.resize());

    // 魚の模様はワーカーで塗る（地形づくりと並行して進む）
    const fishTex = prepareFishTextures();
    this.world = new World(this.scene);
    await this.world.build((p, m) => this.ui.loading(p * 0.8, m));
    this.ui.loading(0.82, '生き物を放しています');
    await fishTex;
    await new Promise((r) => setTimeout(r, 0));
    this.eco = new Ecosystem(this.scene, this.world);
    this.eco.spawnAll();
    for (const id of LEGEND_ORDER) this.eco.instancerFor(SPECIES[id]);
    if (legendUnlocked()) this.eco.spawnLegends();
    this.eco.onBite = (c) => this.onBite(c);
    this.player = new Player(this.camera, this.world);
    this.player.events.surfaced = () => this.onSurfaced();
    this.player.events.dived = () => this.onDived();
    this.spear = new Spear(this.camera);
    this.spear.root.visible = false;
    this.applySettings();

    this.ui.loading(0.88, '図鑑の挿絵を描いています');
    await new Promise((r) => setTimeout(r, 0));
    this.renderThumbs();

    this.ui.loading(0.94, 'シェーダーを温めています');
    await new Promise((r) => setTimeout(r, 0));
    this.setEnv(0.35, true);
    this.titleCam(0);
    try { await renderer.compileAsync(this.scene, this.camera); } catch (e) { renderer.compile(this.scene, this.camera); }
    this.post.render();
    this.ui.loading(1, '準備完了');
    this.loadMs = Math.round(performance.now());

    this.bindUI();
    window.game = this;
    if (this.debug) this.installDebug();
    this.last = performance.now();
    requestAnimationFrame((t) => this.loop(t));
    await new Promise((r) => setTimeout(r, 400));
    this.toTitle(true);
  }

  // ?debug のときだけ使う検証用ヘルパー
  installDebug() {
    const g = this;
    window.dbg = {
      async play() {
        while (g.mode !== 'title') await new Promise((r) => setTimeout(r, 100));
        g.ui.only(); g.beginPlay();
      },
      dive(x, y, z, yaw = 0, pitch = 0) {
        const p = g.player;
        if (p.state !== 'dive') { p.state = 'dive'; g.onDived(); }
        p.pos.set(x, y, z); p.vel.set(0, 0, 0); p.yaw = yaw; p.pitch = pitch; p.breath = 1;
      },
      step(n = 1, dt = 1 / 60) {
        for (let i = 0; i < n; i++) { g.t += dt; U.uTime.value = g.t; g.update(dt); g.input.endFrame(); }
        g.post.render();
      },
      find(id) { return g.eco.creatures.find((c) => c.sp.id === id && c.alive); },
      // 図鑑をすべて埋めて伝説を解放する
      unlockLegends() {
        for (const id of ZUKAN_ORDER) { const z = save.zk(id); z.seen = true; z.caught = Math.max(1, z.caught || 0); }
        save.write();
        g.onLegendUnlock();
      },
      // 生き物 c を距離 dist・高さ up から狙う位置へ
      aimAt(c, dist = 2.6, up = 0.6, side = 0.4, freeze = true) {
        const f = V3(0, 0, 1).applyQuaternion(c.root.quaternion);
        const sd = V3(f.z, 0, -f.x);
        const from = c.pos.clone().addScaledVector(sd, dist).addScaledVector(f, side).add(V3(0, up, 0));
        this.dive(from.x, from.y, from.z);
        const d = c.pos.clone().sub(from);
        g.player.yaw = Math.atan2(-d.x, -d.z);
        g.player.pitch = Math.asin(d.y / d.length());
        if (freeze) { c._upd = c._upd || c.update; c.update = () => {}; }
        return from.distanceTo(c.pos);
      },
      shoot(holdFrames = 45) {
        g.input.left = true; g.input.leftPressed = true; this.step(holdFrames);
        g.input.left = false; this.step(20);
      },
      surface() { const p = g.player; p.pos.y = -0.1; p.vel.set(0, 0.6, 0); p.pitch = 0; this.step(2); },
      // 適当な漁果で結果画面を出す
      results(list = [['ishidai', 44, true], ['budai', 38], ['akahata', 31], ['iseebi', 27], ['kasago', 22, true], ['mejina', 35], ['hirame', 52]]) {
        for (const [id, cm, head] of list) {
          const sp = SPECIES[id];
          const v = valueOf(sp, cm, head);
          g.dayCatch.push({ id, name: sp.name, cm, value: v, headshot: head, dish: sp.dish, rarity: sp.rarity, label: `${sp.name} ${cm}cm${head ? '・一撃' : ''}` });
          g.total += v;
        }
        g.day = save.data.days + 1;
        return g.endDay();
      },
    };
  }

  resize() {
    const w = innerWidth, h = innerHeight;
    this.renderer.setSize(w, h, false);
    // 画面サイズに合わせて HUD とパネルを拡縮
    this.hz = Math.max(0.6, Math.min(1.25, Math.min(h / 920, w / 1560)));
    document.documentElement.style.setProperty('--hz', this.hz.toFixed(3));
    document.documentElement.style.setProperty('--pz', Math.max(0.62, Math.min(1, h / 860, w / 1180)).toFixed(3));
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.post.setSize(w, h);
  }

  applyQuality(q) {
    const dpr = devicePixelRatio || 1;
    const pr = q === 'low' ? Math.min(dpr, 1) * 0.7 : q === 'high' ? Math.min(dpr, 1.5) : Math.min(dpr, 1);
    this.renderer.setPixelRatio(pr);
    this.post.setPixelRatio(pr);
    this.post.bloom.enabled = q !== 'low';
    this.pr = pr;
    if (this.world) {
      this.world.snow.uniforms.uPR.value = pr;
      this.world.particles.uniforms.uPR.value = pr;
    }
    this.resize?.();
  }

  applySettings() {
    const S = save.data.settings;
    this.player.sens = S.sens;
    this.player.invertY = S.invertY;
    this.player.fovBase = S.fov;
    // ?mute: 確認・デバッグ用に音を消す（保存した設定は変えない）
    audio.setVolumes({ master: new URLSearchParams(location.search).has('mute') ? 0 : S.master, music: S.music, sfx: S.sfx });
    // ちらつき軽減: 光の筋・浮遊物・ブルーム・画面のゆらぎを止める
    this.calm = !!S.calm;
    this.world.rays.mesh.visible = !this.calm;
    this.world.snow.mesh.visible = !this.calm;
    this.post.bloom.enabled = !this.calm && S.quality !== 'low';
    this.post.u.uWobble.value = this.calm ? 0 : 1;
    this.world.snow.uniforms.uPR.value = this.pr;
    this.world.particles.uniforms.uPR.value = this.pr;
  }

  bindUI() {
    const act = (a) => {
      audio.init();
      switch (a) {
        case 'start': this.startDay(); break;
        case 'zukan': this.openOverlay('zukan'); break;
        case 'howto': this.openOverlay('howto'); break;
        case 'settings': this.openOverlay('settings'); break;
        case 'back': this.closeOverlay(); break;
        case 'resume': this.resume(); break;
        case 'quit': this.quitDay(); break;
        case 'again': this.startDay(); break;
        case 'toTitle': this.toTitle(); break;
        case 'toTown': this.toTown(); break;
      }
    };
    document.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]');
      if (b) act(b.dataset.act);
    });
    addEventListener('keydown', (e) => {
      if (e.code === 'Escape' && this.overlay) this.closeOverlay();
      else if (e.code === 'Escape' && this.mode === 'play' && !this.input.locked) this.pause();
    });
    this.ui.bindSettings((k, v) => {
      if (k === 'quality') this.applyQuality(v);
      this.applySettings();
    });
    this.input.onFreeLook = () => { if (this.mode === 'play') this.freeLookHint(0.2); };
    this.input.onLockChange = (locked) => {
      if (this.mode === 'play' && !locked && !this.noPause) this.pause();
      this.ui.lockHint(false);
    };
    this.canvas.addEventListener('click', () => {
      if (this.mode === 'play' && !this.input.locked) this.input.lock();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.mode === 'play' && !this.debug) this.pause();
    });
  }

  openOverlay(id) {
    this.overlayFrom = this.mode === 'pause' ? 'pause' : 'title';
    this.overlay = id;
    if (id === 'zukan') this.ui.openZukan(this.cavePlace()); else this.ui.show(id);
    this.ui.hide(this.overlayFrom);
  }
  // 図鑑のヒント用：島から見たヌシの洞窟の方角と水深（コンパスと同じ向き）
  cavePlace() {
    const c = this.world?.boss?.center;
    if (!c) return {};
    const b = ((THREE.MathUtils.radToDeg(Math.atan2(c.x, -c.z)) % 360) + 360) % 360;
    const dir = ['北', '北東', '東', '南東', '南', '南西', '西', '北西'][Math.round(b / 45) % 8];
    return { dir, depth: Math.round(-c.y) };
  }
  closeOverlay() {
    if (!this.overlay) return;
    this.ui.hide(this.overlay);
    this.overlay = null;
    this.ui.show(this.overlayFrom);
    if (this.overlayFrom === 'title') this.ui.titleRecord();
  }

  // ───────── サムネイル ─────────
  renderThumbs() {
    Object.assign(this.ui.thumbs, renderThumbs([...ZUKAN_ORDER, ...LEGEND_ORDER]));
  }

  // 展示用モデル（図鑑・獲れたよー・焼き魚）: fish/thumbs.js（吉山の町の持ち物のアイコンと共通）
  makeDisplayModel(id, cm, thumb = false) { return makeDisplayModel(id, cm, thumb); }

  // ───────── 環境（時間帯） ─────────
  setEnv(d, force) {
    const e = envAt(d);
    const elev = d <= 0.45 ? lerp(0.5, 1.2, smoothstep(0, 0.45, d)) : lerp(1.2, 0.02, smoothstep(0.45, 1.08, d));
    const az = lerp(3.7, 6.35, clamp(d, 0, 1.1));
    const sd = U.uSunDir.value.set(Math.cos(elev) * Math.sin(az), Math.sin(elev), Math.cos(elev) * Math.cos(az)).normalize();
    U.uSunCol.value.copy(e.sun);
    U.uSkyZenith.value.copy(e.zen);
    U.uSkyHorizon.value.copy(e.hor);
    U.uAirFogCol.value.copy(e.fog);
    U.uWaterShallow.value.copy(e.sh);
    U.uWaterDeep.value.copy(e.dp);
    U.uFogDensity.value = e.fd;
    this.sun.color.copy(e.sun);
    this.sun.intensity = e.si;
    this.sun.position.copy(sd).multiplyScalar(100).add(this.camera.position);
    this.sun.target.position.copy(this.camera.position);
    this.hemi.color.copy(e.zen).lerp(new THREE.Color('#ffffff'), 0.45);
    this.hemi.intensity = e.hi;
    this.envD = d;
    void force;
  }

  // ───────── タイトル ─────────
  titleCam(t) {
    const w = this.world;
    if (!this.titleSpot) {
      // キビナゴの群れがいる岩礁を舞台にし、メジナの群れとブダイも呼び寄せる
      const ball = this.eco.swarms.find((s) => s.squeeze !== undefined);
      const c = ball ? ball.home.clone().add(V3(-4, -3.2, -4)) : V3(w.clusters[0].x, w.clusters[0].y, w.clusters[0].z);
      this.titleSpot = c;
      const grp = this.eco.groups.find((g) => g.sp.id === 'mejina');
      if (grp) {
        grp.home.copy(c).add(V3(2, 3, -2));
        grp.center.copy(grp.home);
        grp.members.forEach((m) => m.pos.copy(grp.home).add(m.offset));
        grp.target = null;
      }
      this.eco.creatures.filter((x) => x.sp.id === 'budai').slice(0, 3).forEach((b, i) => {
        b.home.copy(c).add(V3(Math.cos(i * 2) * 4, 0, Math.sin(i * 2) * 4));
        b.pos.copy(b.home).setY(w.groundAt(b.home.x, b.home.z) + 1);
        b.target = null;
      });
    }
    const c = this.titleSpot;
    const a = t * 0.035 + 0.6;
    const R = 11;
    const cam = this.camera;
    cam.position.set(c.x + Math.cos(a) * R, Math.min(c.y + 3.2 + Math.sin(t * 0.2) * 0.6, -1.2), c.z + Math.sin(a) * R);
    const g = w.groundAt(cam.position.x, cam.position.z);
    if (cam.position.y < g + 1.5) cam.position.y = g + 1.5;
    cam.lookAt(c.x - Math.cos(a) * 2, c.y + 1.6, c.z - Math.sin(a) * 2);
    cam.fov = 60;
    cam.updateProjectionMatrix();
  }

  toTitle(first = false) {
    this.mode = 'title';
    this.clearDayScene();
    this.input.enabled = false;
    this.input.unlock();
    this.ui.showHud(false);
    this.spear.root.visible = false;
    this.ui.titleRecord();
    this.ui.only('title');
    this.setEnv(0.35);
    this.post.u.uMask.value = 0;
    this.post.u.uDrops.value = 0;
    this.post.u.uBlackout.value = 0;
    this.post.u.uFade.value = 0;
    audio.setMusic('title');
    audio.setAmbience('title');
    if (first) {
      // 最初のクリックで音を有効化
      const unlock = () => { audio.init(); audio.setMusic('title'); audio.setAmbience('title'); removeEventListener('pointerdown', unlock); };
      addEventListener('pointerdown', unlock);
    }
  }

  // 町（空の上）へ帰る（町から来たときだけ）
  toTown() {
    if (!TOWN || this.leaving) return;
    this.leaving = true;
    this.input.unlock();
    audio.setMusic('none');
    audio.setAmbience('off');
    this.ui.fade(true);
    setTimeout(() => { location.href = townURL(); }, 700);
  }

  // ───────── 一日の開始 ─────────
  async startDay() {
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
    const lines = TOWN ? townIntro(day, () => audio.taiko(0, 0.7, 70)) : day === 1
      ? [{ text: `無人島生活　${day}日目`, cls: 'day', wait: 1300 }, { text: '食料は、ない。', wait: 1300 }, { text: '頼れるのは——', wait: 1100 }, { text: '銛一本。', cls: 'big', wait: 1600, sound: () => audio.taiko(0, 0.7, 70) }]
      : [{ text: `無人島生活　${day}日目`, cls: 'day', wait: 1200 }, { text: legendUnlocked() && day % 2 ? '沖を、巨大な影が巡っている。' : ['今日も腹が減った。', '昨日より、深く。', '海は今日も青い。', 'ヌシは、まだ洞窟にいる。'][day % 4], wait: 1400 }, { text: '銛一本。', cls: 'big', wait: 1400, sound: () => audio.taiko(0, 0.7, 70) }];
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
    this.clearDayScene();
    this.mode = 'play';
    this.day = save.data.days + 1;
    this.dayTime = 0;
    this.bag = [];
    this.dayCatch = [];
    this.total = 0;
    this.maxDepth = 0;
    this.timers = [];
    this.celebrating = false;
    this.blackout = null;
    this.struggle = null;
    this.ending = false;
    this.graceT = 0;
    this.warnedSunset = false;
    this.sunsetMsg = false;
    this.seenThisDay = new Set();
    this.hintsShown = new Set();
    this.underTime = 0;
    const w = this.world;
    this.player.reset(w.start, 0);
    this.player.pos.y = w.waterAt(w.start.x, w.start.z, this.t) + 0.16;
    this.player.locked = false;
    this.player.lookOverride = null;
    this.spear.root.visible = true;
    this.spear.state = 'ready';
    this.spear.raise = 0;
    this.spear.s = 0;
    this.spear.charge = 0;
    this.input.enabled = true;
    this.ui.showHud(true);
    this.ui.dimHud(false);
    this.post.u.uMask.value = 1;
    this.post.u.uDrops.value = 0.8;
    this.noPause = false;
    audio.setMusic('surface');
    audio.setAmbience('surface');
    if (this.input.freeLook) this.freeLookHint(11);
    this.later(1.6, () => this.showHint('dive', '<b>C</b> キー（または下を向いて <b>W</b>）で潜る。<b>Space</b> で浮上。', 6));
  }

  clearDayScene() {
    if (this.catchGroup) { this.scene.remove(this.catchGroup); this.catchGroup = null; }
    this.catchProps = null;
    if (this.display) { this.display.mesh.parent?.remove(this.display.mesh); this.display = null; }
    if (this.lowering) { this.lowering.parent?.remove(this.lowering); this.lowering = null; }
    this.raiseTarget = 0;
    if (this.spear?.fish) this.spear.detachFish();
  }

  pause() {
    if (this.mode !== 'play') return;
    this.mode = 'pause';
    this.input.enabled = false;
    audio.stopCharge();
    if (this.spear.state === 'charging') { this.spear.state = 'ready'; this.spear.charge = 0; }
    this.ui.show('pause');
  }
  resume() {
    if (this.mode !== 'pause') return;
    this.ui.hide('pause');
    this.mode = 'play';
    this.input.enabled = true;
    this.input.lock();
  }
  quitDay() {
    this.ui.hide('pause');
    this.mode = 'play';
    // 浮上していない獲物は失う
    if (this.bag.length) this.bag = [];
    this.endDay();
  }

  freeLookHint(delay) {
    this.later(delay, () => this.ui.hint('この環境ではマウスを固定できないため、<b>マウスの動き</b>で見回します。<b>画面の端</b>にカーソルを寄せると回り続けます。', 7));
  }

  later(sec, fn) { const tm = { t: sec, fn }; this.timers.push(tm); return tm; }

  showHint(key, html, dur = 5) {
    if (this.hintsShown.has(key)) return;
    const seen = save.data.hints[key] || 0;
    if (seen >= 2) return;
    this.hintsShown.add(key);
    save.data.hints[key] = seen + 1;
    this.ui.hint(html, dur);
  }

  // ───────── メインループ ─────────
  loop(now) {
    requestAnimationFrame((t) => this.loop(t));
    const dt = Math.min((now - this.last) / 1000, 0.05);
    this.last = now;
    this.t += dt;
    U.uTime.value = this.t;
    try {
      this.update(dt);
    } catch (e) {
      console.error(e);
    }
    this.post.render();
    this.input.endFrame();
  }

  update(dt) {
    const w = this.world;
    const cam = this.camera;
    audio.updateMusic(dt);

    if (this.mode === 'title' || this.mode === 'loading' || this.mode === 'intro') {
      this.titleCam(this.t);
      this.updateWorld(dt, this.dummyPlayer());
      return;
    }
    if (this.mode === 'results') {
      this.updateWorld(dt, this.dummyPlayer());
      this.updateCatchProps(dt);
      this.resultsCam(dt);
      return;
    }
    if (this.mode === 'pause') {
      return;
    }
    // ─── play ───
    for (const tm of this.timers) { tm.t -= dt; if (tm.t <= 0 && !tm.done) { tm.done = true; tm.fn(); } }
    this.timers = this.timers.filter((t) => !t.done);

    const p = this.player;
    const sp = this.spear;
    const inp = this.input;
    if (!this.celebrating && !this.blackout && !this.ending) this.dayTime += dt;
    const dayT = this.dayTime / DAY_LEN;
    this.setEnv(Math.min(dayT, 1.05));

    const charging = sp.state === 'charging';
    p.update(dt, inp, this.t, {
      zoom: inp.right && !p.locked && p.submerged,
      charge: charging ? sp.charge : 0,
      strain: this.struggle ? 1.4 : 0,
    });
    if (p.submerged) this.maxDepth = Math.max(this.maxDepth, p.depth);
    this.post.u.uUnder.value = cam.position.y < w.waterAt(cam.position.x, cam.position.z, this.t) ? 1 : 0;

    // 銛
    if (!p.locked && !this.struggle && inp.enabled) {
      if (inp.leftPressed) {
        if (!p.submerged) this.showHint('surfaceSpear', '銛は<b>潜ってから</b>使おう（<b>C</b> で潜る）', 3);
        else if (sp.startCharge()) audio.startCharge();
      }
      if (sp.state === 'charging') {
        audio.setCharge(sp.charge);
        if (!inp.left) {
          audio.stopCharge();
          if (sp.release()) {
            audio.shoot(sp.power);
            p.shotNoise = Math.max(p.shotNoise, 0.25 + sp.power * 0.2);
            this.thrustHit = false;
            const d = sp.worldDir();
            w.particles.bubbles(cam.position.x + d.x * 1.2, cam.position.y + d.y * 1.2 - 0.1, cam.position.z + d.z * 1.2, 10, 0.2, 0.9);
          }
        }
        if (!p.submerged) { sp.state = 'ready'; sp.charge = 0; audio.stopCharge(); }
      }
    }
    const prevState = sp.state;
    // 銛を掲げるのは「獲れたよー」の間だけ（途中でタイトルへ戻っても次の日に掲げたまま残らない）
    sp.raise = lerp(sp.raise, this.celebrating ? this.raiseTarget || 0 : 0, 1 - Math.exp(-5 * dt));
    sp.stow = lerp(sp.stow || 0, !p.submerged && !this.celebrating ? 1 : 0, 1 - Math.exp(-6 * dt));
    if (this.lowering && sp.raise < 0.03) { this.lowering.parent?.remove(this.lowering); this.lowering = null; }
    if (this.display?.sw?.uPhase) { this.display.sw.uAmp.value = 0.16; this.display.sw.uPhase.value += dt * 14; }
    if (this.writhe?.sw?.uPhase) this.writhe.sw.uPhase.value += dt * 22;
    sp.update(dt, { moving: p.vel.length() > 0.4, sprint: inp.down('ShiftLeft'), t: this.t });
    if (sp.state === 'thrust' || prevState === 'thrust') this.checkThrust();
    if (prevState === 'extended' && sp.state === 'retract' && !this.thrustHit) {
      this.eco.scareAround(sp.tipWorld, 5, 0.4);
      audio.swoosh();
    }
    if (this.struggle) this.updateStruggle(dt);

    this.updateWorld(dt, p);
    this.updateInteract();
    this.updateBreath(dt);
    this.updateDayEnd(dt, dayT);
    this.updateHintsAndHud(dt, dayT);
    // マウスが固定されていない間は、再開方法をずっと表示する
    this.ui.lockHint(!this.input.locked && !this.input.freeLook && !this.blackout && !this.ending && !this.celebrating);

    // 演出の後処理
    const u = this.post.u;
    u.uDrops.value = Math.max(0, u.uDrops.value - dt * (p.submerged ? 3 : 0.22));
    u.uFlash.value = Math.max(0, u.uFlash.value - dt * 3);
    u.uRed.value = Math.max(0, u.uRed.value - dt * 1.2);
    u.uFocus.value = p.zoom;
  }

  dummyPlayer() {
    if (!this._dummy) this._dummy = { pos: V3(0, 500, 0), fwd: V3(0, 0, -1), noise: 0, stillTime: 0, submerged: false, nearBottom: false, vel: V3() };
    return this._dummy;
  }

  updateWorld(dt, player) {
    const w = this.world;
    const cam = this.camera;
    const under = cam.position.y < w.waterAt(cam.position.x, cam.position.z, this.t);
    U.uUnder.value = under ? 1 : 0;
    this.post.u.uUnder.value = under ? 1 : 0;
    this.post.u.uTime.value = this.t;
    w.update(dt, this.t, cam);
    this.eco.camPos = cam.position;
    cam.updateMatrixWorld();
    this.eco.camera = cam;
    this.eco.update(dt, this.t, player);
    const sunUp = smoothstep(0.02, 0.4, U.uSunDir.value.y);
    w.rays.update(dt, cam, U.uSunDir.value, under ? sunUp * smoothstep(-40, -2, cam.position.y) * 1.3 + 0.1 : 0);
    w.particles.update(dt, (x, z) => w.waterAt(x, z, this.t));
    U.uCaustic.value = sunUp;
    this.sun.position.copy(U.uSunDir.value).multiplyScalar(100).add(cam.position);
    this.sun.target.position.copy(cam.position);
  }

  // ───────── 突きの判定 ─────────
  checkThrust() {
    const sp = this.spear, w = this.world;
    if (this.thrustHit) return;
    const p0 = sp.prevTipWorld, p1 = sp.tipWorld;
    const hit = this.eco.hitScan(p0, p1);
    if (hit) { this.thrustHit = true; this.onHit(hit.c, hit.h); return; }
    const g = w.groundAt(p1.x, p1.z);
    const inSand = p1.y < g + 0.02;
    const inRock = !inSand && w.insideRock(p1, -0.04);
    if (inSand || inRock) {
      // 砂や岩に当たった：すぐそばの獲物は押さえ込んで獲れる（岩陰のイセエビ・砂地のヒラメ）
      const pin = this.eco.hitScan(p0, p1, 0.1);
      if (pin && pin.c.kind !== 'turtle') { this.thrustHit = true; this.onHit(pin.c, pin.h); return; }
    }
    if (inSand) {
      this.thrustHit = true;
      sp.stop(false);
      w.particles.sandPuff(p1.x, g, p1.z, 14, 0.7);
      audio.sandBurst();
      this.eco.scareAround(p1, 4.5, 0.35);
      return;
    }
    if (inRock) {
      this.thrustHit = true;
      sp.stop(false);
      audio.clink();
      w.particles.sparkle(p1.x, p1.y, p1.z, 6);
      w.particles.sandPuff(p1.x, p1.y, p1.z, 6, 0.4);
      this.eco.scareAround(p1, 4.5, 0.35);
    }
  }

  onHit(c, h) {
    const sp = this.spear, w = this.world, p = this.player;
    const tip = sp.tipWorld;
    if (c.kind === 'turtle') {
      sp.stop(false);
      audio.clink();
      c.scare();
      this.eco.scareAround(tip, 8, 0.6);
      this.ui.toast('<b>ウミガメは獲っちゃダメ！</b><small>甲羅に弾かれた。そっとしておこう。</small>', { cls: 'bad', icon: '🐢' });
      return;
    }
    c.caught = true;
    c.alive = false;
    if (c.den) { c.den.occupied = false; }
    if (c.perch) { c.perch.taken = false; }
    c.headshot = h.head;
    c.materialize();
    sp.attach(c);
    this.eco.scareAround(tip, 5, 0.5);
    w.particles.bubbles(tip.x, tip.y, tip.z, 14, 0.2, 1);
    p.shake = 0.5;
    audio.hit();
    const fs = c.sp.fighter;
    const fights = fs === 0 || (fs && c.cm >= fs);
    if (fights) {
      sp.state = 'struggle';
      const legend = !!c.sp.legend;
      this.struggle = { c, p: 0.4, t: 0, str: legend ? 3.4 : 1 + c.weight / 7, jerk: 0.5, legend, tow: legend ? c.dir.clone().setY(0).normalize() : null };
      this.post.u.uFlash.value = legend ? 0.45 : 0.25;
      if (legend) {
        p.shake = 1.2;
        this.ui.telop(`<div class="tl tl-catch tl-legend">伝説の${c.sp.name}だ！</div><div><span class="tl-sub red">引きずり込まれる！ 連打で耐えろ！</span></div>`, 2);
        audio.taiko(0, 0.9, 52);
        this.later(0.18, () => audio.taiko(0, 0.7, 58));
      } else {
        this.ui.telop(`<div class="tl tl-catch">${c.sp.name}だ！</div><div><span class="tl-sub red">デカい！ 暴れている！</span></div>`, 1.6);
        audio.taiko(0, 0.6, 60);
      }
      return;
    }
    this.landCatch(c);
  }

  landCatch(c) {
    const sp = this.spear;
    sp.stop(true);
    this.post.u.uFlash.value = 0.35;
    audio.catchJingle(c.sp.rarity || 1);
    const sub = `${c.cm}cm${c.headshot ? '　一撃！' : ''}`;
    this.ui.telop(`<div class="tl tl-catch">${c.sp.name}</div><div><span class="tl-sub${c.headshot ? ' red' : ''}">${sub}</span></div>`, 1.5);
    if (c.sw?.uAmp) c.sw.uAmp.value = 0.2;
    this.writhe = c;
    this.bagTimer = this.later(1.15, () => this.toBag(c));
  }

  toBag(c) {
    const sp = this.spear, w = this.world;
    const item = {
      id: c.sp.id, name: c.sp.name, cm: c.cm, value: valueOf(c.sp, c.cm, c.headshot),
      headshot: c.headshot, dish: c.sp.dish, rarity: c.sp.rarity || 1,
      label: `${c.sp.name} ${c.cm}cm${c.headshot ? '・一撃' : ''}`,
    };
    this.bag.push(item);
    const tip = sp.tipWorld;
    w.particles.sparkle(tip.x, tip.y, tip.z, 14);
    sp.detachFish();
    sp.state = 'retract'; sp.t = 0; sp.from = sp.s;
    this.writhe = null;
    this.eco.creatures = this.eco.creatures.filter((x) => x !== c);
    this.eco.queueRespawn(c.sp, rand(50, 100));
    this.ui.toast(`<b>${item.name}</b> ${item.cm}cm<em>${yen(item.value)}</em><small>スカリに入れた${item.headshot ? '（一撃・鮮度ボーナス）' : ''}</small>`, { img: this.ui.thumbs[item.id] });
    audio.pickup();
    if (this.bag.length === 1) this.showHint('surface', '獲物は<b>浮上して</b>初めて確定する。息が尽きると失うぞ！', 5);
    if (!this.player.submerged && !this.celebrating && !this.blackout) this.celebrate();
  }

  updateStruggle(dt) {
    const s = this.struggle, sp = this.spear, p = this.player, inp = this.input;
    s.t += dt;
    const c = s.c;
    if (inp.leftPressed) {
      s.p += 0.085 / Math.sqrt(s.str);
      audio.tug();
      p.shake = Math.max(p.shake, 0.35);
      const tip = sp.tipWorld;
      this.world.particles.bubbles(tip.x, tip.y, tip.z, 4, 0.15, 0.8);
    }
    s.p -= dt * (0.075 + 0.03 * s.str);
    s.jerk -= dt;
    if (s.jerk <= 0) {
      s.jerk = rand(0.35, 0.9);
      s.p -= 0.035 * Math.sqrt(s.str);
      p.shake = 0.9;
      p.yaw += (Math.random() - 0.5) * 0.06;
      p.pitch += (Math.random() - 0.5) * 0.04;
      audio.flee();
    }
    if (c.sw?.uAmp) { c.sw.uAmp.value = 0.28; c.sw.uPhase.value += dt * 26; }
    // 伝説の魚はダイバーごと沖へ引きずって泳ぐ（少しずつ深みへ）
    if (s.tow) {
      const w = this.world;
      s.tow.applyAxisAngle(V3(0, 1, 0), Math.sin(s.t * 0.9) * dt * 0.5);
      const k = 1.6 * (1 - s.p * 0.5);
      p.pos.addScaledVector(s.tow, k * dt);
      p.pos.y -= dt * 0.25;
      const g = w.groundAt(p.pos.x, p.pos.z);
      if (p.pos.y < g + 0.6) p.pos.y = g + 0.6;
      w.pushOutOfRocks(p.pos, 0.38, p.vel);
      p.shake = Math.max(p.shake, 0.25);
      if (Math.random() < dt * 6) { const tip = sp.tipWorld; w.particles.bubbles(tip.x, tip.y, tip.z, 3, 0.3, 0.9); }
    }
    // 緊急浮上するなら獲物は放す（暴れる魚ごと浮上して仕留める近道にはしない）
    if (p.emergency) s.p = -1;
    this.ui.struggle(true, s.p);
    if (s.p >= 1) {
      this.struggle = null;
      this.ui.struggle(false);
      audio.taiko(0, 0.8, 64);
      this.landCatch(c);
    } else if (s.p <= 0 || s.t > 11) {
      this.struggle = null;
      this.ui.struggle(false);
      sp.fish = null;
      this.scene.attach(c.root);
      c.caught = false;
      c.alive = true;
      c.alert = 1;
      if (c.sp.type === 'den') { c.state = 'hide'; c.out = 0; c.timer = 12; if (c.den) c.den.occupied = true; }
      else if (c.sp.type === 'boss') { c.startFlee(V3().subVectors(c.pos, p.pos).normalize(), 4); }
      else c.startFlee(V3().subVectors(c.pos, p.pos).normalize(), 3);
      sp.state = 'retract'; sp.t = 0; sp.from = sp.s;
      this.ui.telop(`<div class="tl tl-catch" style="-webkit-text-stroke-color:#5a5a5a">逃げられた…</div><div><span class="tl-sub blue">${c.sp.name}　${c.cm}cm</span></div>`, 1.8);
      audio.swoosh();
    }
  }

  // ───────── 拾う ─────────
  updateInteract() {
    const p = this.player, w = this.world, cam = this.camera;
    // 息が少ない時は、拾うより先に緊急浮上のキーを出す
    if (p.submerged && !p.locked && !this.blackout && p.breath < 0.28) {
      this.ui.prompt(p.emergency ? '緊急浮上中…' : '<kbd>Q</kbd>長押しで緊急浮上');
      return;
    }
    if (!p.submerged || p.locked || this.struggle) { this.ui.prompt(''); return; }
    let best = null, bd = 1.9;
    const f = p.fwd;
    for (const it of w.pickups) {
      if (!it.alive) continue;
      const dx = it.pos.x - cam.position.x, dy = it.pos.y - cam.position.y, dz = it.pos.z - cam.position.z;
      const d = Math.hypot(dx, dy, dz);
      if (d > bd) continue;
      if ((dx * f.x + dy * f.y + dz * f.z) / d < 0.55) continue;
      best = it; bd = d;
    }
    if (best) {
      this.ui.prompt(`<kbd>E</kbd>${best.def.name}を拾う`);
      if (this.input.pressed('KeyE')) this.collect(best);
    } else this.ui.prompt('');
  }

  collect(it) {
    const w = this.world;
    w.collect(it);
    const v = Math.round(rand(it.def.value[0], it.def.value[1]) / 10) * 10;
    this.bag.push({ id: it.type, name: it.def.name, cm: null, value: v, dish: it.def.dish, rarity: it.def.rarity, label: it.def.name, pickup: true });
    w.particles.sparkle(it.pos.x, it.pos.y + 0.05, it.pos.z, 10);
    audio.pickup();
    this.ui.toast(`<b>${it.def.name}</b><em>${yen(v)}</em><small>スカリに入れた</small>`, { img: this.ui.thumbs[it.type] });
    const z = save.zk(it.type);
    if (!z.seen) { z.seen = true; }
    if (it.type === 'awabi') this.ui.telop(`<div class="tl tl-catch">アワビ！</div><div><span class="tl-sub">大当たり！</span></div>`, 1.6);
    if (this.bag.length === 1) this.showHint('surface', '獲物は<b>浮上して</b>初めて確定する。息が尽きると失うぞ！', 5);
  }

  // ───────── 息・ブラックアウト ─────────
  updateBreath(dt) {
    const p = this.player, u = this.post.u;
    const low = p.submerged ? clamp(1 - p.breath / 0.28, 0, 1) : 0;
    this._lowO2 = lerp(this._lowO2 || 0, low, 1 - Math.exp(-3 * dt));
    u.uLowO2.value = this._lowO2;
    this.hbT = (this.hbT || 0) - dt;
    if (low > 0 && this.hbT <= 0) {
      audio.heartbeat(0.5 + low * 0.7);
      this.hbT = lerp(1.1, 0.55, low);
      this.pulse = 1;
    }
    this.pulse = Math.max(0, (this.pulse || 0) - dt * 2.5);
    u.uPulse.value = this.pulse;
    if (p.submerged && p.breath < 0.18 && !this.blackout) this.ui.warn('息が限界！　Q で緊急浮上！');
    else if (!this.blackout && this.ending !== 'grace') this.ui.warn('');

    if (p.submerged && p.breath <= 0 && !this.blackout) this.startBlackout();
    if (this.blackout) {
      const b = this.blackout;
      b.t += dt;
      if (b.t < 2.2) u.uBlackout.value = smoothstep(0, 2.2, b.t);
      else if (!b.rescued) {
        b.rescued = true;
        u.uBlackout.value = 1;
        const lost = this.bag.length;
        this.bag = [];
        if (this.spear.fish) { const c = this.spear.detachFish(); this.eco.creatures = this.eco.creatures.filter((x) => x !== c); this.eco.queueRespawn(c.sp, 60); }
        this.struggle = null;
        this.ui.struggle(false);
        this.spear.state = 'ready';
        this.spear.s = 0;
        p.state = 'surface';
        p.pos.y = this.world.waterAt(p.pos.x, p.pos.z, this.t) + 0.16;
        p.vel.set(0, 0, 0);
        p.breath = 0.35;
        p.surfaceTime = 0;
        p.pitch = 0;
        this.dayTime += 30;
        audio.setAmbience('surface');
        audio.setMusic('surface');
        this.ui.warn('');
        this.later(0.6, () => {
          audio.gasp();
          this.ui.telop(`<div class="tl tl-catch" style="-webkit-text-stroke-color:#444">ブラックアウト…</div><div><span class="tl-sub blue">${lost ? `スカリの獲物 ${lost}匹を失った` : 'なんとか水面へ…'}（45分経過）</span></div>`, 3);
        });
      } else if (b.t > 3.2) {
        u.uBlackout.value = Math.max(0, 1 - (b.t - 3.2) / 1.2);
        if (b.t > 4.4) { this.blackout = null; p.locked = false; u.uBlackout.value = 0; }
      }
    }
  }

  startBlackout() {
    this.blackout = { t: 0 };
    this.player.locked = true;
    audio.stopCharge();
    audio.blackout();
    this.ui.warn('');
    if (this.spear.state === 'charging') { this.spear.state = 'ready'; this.spear.charge = 0; }
  }

  onBite(c) {
    const p = this.player;
    p.breath = Math.max(0.02, p.breath - 0.17);
    p.shake = 1.2;
    const push = V3().subVectors(p.pos, c.pos).normalize();
    p.vel.addScaledVector(push, 2.2);
    this.post.u.uRed.value = 1;
    audio.bite();
    this.ui.toast('<b>ウツボに噛まれた！</b><small>息 −10秒　巣穴には近づきすぎないこと</small>', { cls: 'bad', icon: '⚠' });
    this.eco.scareAround(p.pos, 6, 0.5);
  }

  // ───────── 浮上・潜行 ─────────
  onDived() {
    audio.setAmbience('under');
    audio.setMusic('under');
    this.post.u.uDrops.value = 0;
    this.later(0.8, () => this.showHint('spear', '<b>左クリック長押し</b>でゴムを引き、<b>離して</b>突く。右クリックで狙いを定める。', 6));
  }

  onSurfaced() {
    const p = this.player;
    audio.setAmbience('surface');
    audio.setMusic('surface');
    this.post.u.uDrops.value = 1;
    if (this.blackout) return;
    this.later(0.1, () => audio.gasp());
    if (this.struggle?.legend) {
      // 伝説の魚は水面で大暴れして外れる（浮上して仕留める近道にはしない）
      this.struggle.p = -1;
      this.updateStruggle(0);
    } else if (this.struggle) {
      // 暴れる魚ごと浮上 → 仕留めたことにする
      const c = this.struggle.c;
      this.struggle = null;
      this.ui.struggle(false);
      this.landCatch(c);
      return;
    }
    if (this.writhe && this.bagTimer && !this.bagTimer.done) {
      // 獲物を持ったまま浮上
      this.bagTimer.done = true;
      this.toBag(this.writhe);
      return;
    }
    if (this.bag.length && !this.celebrating) this.celebrate();
    void p;
  }

  celebrate() {
    const p = this.player, sp = this.spear, w = this.world;
    this.celebrating = true;
    p.locked = true;
    audio.stopCharge();
    if (sp.state === 'charging') { sp.state = 'ready'; sp.charge = 0; }
    const bag = this.bag;
    this.bag = [];
    const best = bag.reduce((a, b) => (b.value > a.value ? b : a), bag[0]);
    const sum = bag.reduce((s, i) => s + i.value, 0);
    // 島の方を向いて、獲物を掲げる
    const toIsland = Math.atan2(p.pos.x, p.pos.z);
    p.lookOverride = { yaw: toIsland, pitch: 0.2, k: 3 };
    const disp = this.makeDisplayModel(best.id, best.cm);
    this.display = disp;
    const m = disp.mesh;
    const holder = new THREE.Group();
    holder.add(m);
    m.rotation.set(0, Math.PI / 2, 0);
    if (SPECIES[best.id]?.flat) m.rotation.set(0, Math.PI / 2, Math.PI / 2);
    if (SPECIES[best.id]?.model === 'octopus') m.rotation.set(Math.PI / 2, 0, 0);
    // イセエビは背中のトゲと触角がこちらに見えるよう、少しひねる
    if (SPECIES[best.id]?.model === 'lobster') m.rotation.set(0, Math.PI / 2, 0.7);
    const bl = Math.max((best.cm || 20) / 100, 0.15);
    holder.scale.setScalar(Math.min(2.4, Math.max(0.72 / bl, Math.min(0.9, 1.4 / bl))));
    sp.tipAnchor.add(holder);
    holder.position.set(0, 0, 0.05);
    this.display = { mesh: holder, sw: disp.sw };
    this.raiseTarget = 1;
    audio.celebrate();
    w.particles.spray(p.pos.x + p.fwd.x, p.pos.y, p.pos.z + p.fwd.z, 40);
    const extra = bag.length > 1 ? `　ほか${bag.length - 1}匹` : '';
    const card = `<div><div class="tl-card"><img src="${this.ui.thumbs[best.id] || ''}" alt=""><div class="n">${best.name}${best.cm ? ` ${best.cm}cm` : ''}<small>${bag.length}つの獲物${extra ? '（' + bag.map((b) => b.name).slice(0, 4).join('・') + (bag.length > 4 ? '…' : '') + '）' : ''}</small></div><div class="y">+${yen(sum)}</div></div></div>`;
    this.ui.dimHud(true);
    this.later(0.35, () => this.ui.bigShout('獲れたよー！', null, card, 3.4));
    this.later(4.1, () => {
      // 確定
      this.dayCatch.push(...bag);
      this.total += sum;
      const wasUnlocked = legendUnlocked();
      for (const it of bag) {
        const z = save.zk(it.id);
        z.seen = true;
        z.caught = (z.caught || 0) + 1;
        if (it.cm && it.cm > (z.best || 0)) z.best = it.cm;
      }
      save.write();
      if (!wasUnlocked && legendUnlocked()) this.later(1.6, () => this.onLegendUnlock());
      this.raiseTarget = 0;
      this.lowering = holder;
      this.display = null;
      p.lookOverride = null;
      p.locked = false;
      this.celebrating = false;
      this.ui.dimHud(false);
      audio.coin();
    });
  }

  // 図鑑の全種類を捕獲した：沖に伝説の魚が現れる
  onLegendUnlock() {
    this.legendNews = true;
    this.eco.spawnLegends(this.player.pos);
    if (this.mode !== 'play') return;
    audio.horn();
    this.later(0.3, () => audio.taiko(0, 0.9, 50));
    this.later(0.6, () => audio.catchJingle(5));
    this.post.u.uFlash.value = 0.3;
    this.ui.telop('<div class="tl tl-catch tl-legend">伝説の魚が現れた</div><div><span class="tl-sub">島から50mほど沖を、巨大な影が巡りはじめた</span></div>', 4.2);
    this.later(1.2, () => this.ui.toast('<b>図鑑に「伝説」のページが開いた</b><small>クロマグロとバショウカジキ。回遊の道筋で待ち伏せろ</small>', { cls: 'info legend', icon: '★', dur: 6 }));
  }

  // ───────── 一日の終わり ─────────
  updateDayEnd(dt, dayT) {
    const p = this.player;
    if (!this.warnedSunset && dayT > 0.83) {
      this.warnedSunset = true;
      audio.horn();
      this.ui.toast('<b>日が傾いてきた</b><small>あと1時間ほどで日が暮れる</small>', { cls: 'info', icon: '🌅' });
    }
    if (dayT < 1 || this.ending === true || this.celebrating) return;
    if (!p.submerged && !this.blackout && !this.struggle) { this.endDay(); return; }
    if (p.submerged) {
      this.ending = 'grace';
      this.graceT += dt;
      this.ui.warn(`日没！　浮上して帰ろう（${Math.max(0, Math.ceil(GRACE - this.graceT))}）`, true);
      if (this.graceT > GRACE && !this.blackout) this.startBlackout();
    }
  }

  async endDay() {
    if (this.ending === true) return;
    this.ending = true;
    this.noPause = true;
    this.input.enabled = false;
    this.ui.warn('');
    this.ui.prompt('');
    audio.stopCharge();
    this.ui.fade(true);
    await new Promise((r) => setTimeout(r, 900));
    this.input.unlock();
    this.mode = 'results';
    this.ui.showHud(false);
    this.spear.root.visible = false;
    this.post.u.uMask.value = 0;
    this.post.u.uDrops.value = 0;
    this.post.u.uBlackout.value = 0;
    this.post.u.uLowO2.value = 0;
    this.setEnv(1.02);
    this.setupCatchDisplay();
    this.resultsCam(0, true);
    audio.setAmbience('surface');
    audio.setMusic('results');
    await new Promise((r) => setTimeout(r, 300));
    this.ui.fade(false);

    // 集計
    const items = [];
    const shells = {};
    for (const it of this.dayCatch) {
      if (it.pickup) {
        shells[it.id] = shells[it.id] || { ...it, count: 0, value: 0 };
        shells[it.id].count++;
        shells[it.id].value += it.value;
      } else items.push(it);
    }
    items.sort((a, b) => b.value - a.value);
    for (const s of Object.values(shells)) items.push({ ...s, label: `${s.name} ×${s.count}` });
    const total = this.total;
    const rank = [...(TOWN ? TOWN_RANKS : RANKS)].reverse().find((r) => total >= r.min);
    const news = [];
    // 町から来たときは、獲物を町の持ち物に入れる
    const stashed = stashCatch(this.dayCatch);
    if (stashed) news.push(`${stashed}つの獲物を持ち物に入れた`);
    save.data.days = this.day;
    if (total > save.data.best && total > 0) { news.push('自己最高記録！'); save.data.best = total; save.data.bestRank = rank.title; }
    if (this.dayCatch.some((i) => i.id === 'kue')) news.push('この海のヌシ・クエを仕留めた！');
    for (const id of LEGEND_ORDER) if (this.dayCatch.some((i) => i.id === id)) news.push(`伝説の${SPECIES[id].name}を仕留めた！`);
    if (this.legendNews) { news.push('図鑑を制覇！ 沖に伝説の魚が現れた'); this.legendNews = false; }
    const newSp = [...new Set(this.dayCatch.map((i) => i.id))].filter((id) => save.data.zukan[id]?.caught === this.dayCatch.filter((x) => x.id === id).length);
    if (newSp.length) news.push(`図鑑に登録: ${newSp.map((id) => entryOf(id).name).join('・')}`);
    save.write();
    await this.ui.results({ day: this.day, items, total, rank, news });
  }

  // 本日の漁果を、焚き火のそばの砂浜にどさっと並べる（実物大・向きはばらばら・重なってもいい）
  setupCatchDisplay() {
    const w = this.world;
    const g = new THREE.Group();
    const fp = w.firePos.clone();
    const toSea = V3(fp.x, 0, fp.z).normalize();
    const side = V3(-toSea.z, 0, toSea.x);
    const rng = new RNG(this.day * 97 + this.dayCatch.length * 7 + 1);
    // 焚き火の近くで、いちばん平らな乾いた砂地（岩のない所）を探して置き場にする
    let P = null, bestScore = Infinity;
    for (let d = 1.0; d <= 9; d += 0.25) {
      for (let sd = -3; sd <= 1.5; sd += 0.25) {
        const q = fp.clone().addScaledVector(toSea, d).addScaledVector(side, sd);
        const h = w.groundAt(q.x, q.z);
        if (h < 0.7 || h > 1.9) continue;
        // 半径 0.9m の輪の上の高低差で平らさを測る
        let lo = h, hi = h;
        for (let a = 0; a < 8; a++) {
          const hh = w.groundAt(q.x + Math.cos(a * Math.PI / 4) * 0.9, q.z + Math.sin(a * Math.PI / 4) * 0.9);
          lo = Math.min(lo, hh); hi = Math.max(hi, hh);
        }
        if (w.insideRock(V3(q.x, h + 0.15, q.z), 0.7)) continue;
        const score = hi - lo + d * 0.02 + Math.abs(sd + 0.9) * 0.015;
        if (score < bestScore) { bestScore = score; P = q.setY(h); }
      }
    }
    if (!P) { P = fp.clone().addScaledVector(toSea, 1.5).addScaledVector(side, -0.9); P.y = w.groundAt(P.x, P.z); }
    const UP = V3(0, 1, 0);

    const list = this.dayCatch.slice(0, 40).map((it) => {
      const sp = SPECIES[it.id];
      const len = sp ? (it.cm || sp.size[0]) / 100 : 0.1;
      return { it, sp, len, rad: sp ? len * (sp.model === 'lobster' ? 0.55 : 0.42) : 0.06 };
    });
    list.sort((a, b) => b.len - a.len);
    const area = list.reduce((s, o) => s + o.rad * o.rad, 0);
    const R = 0.14 + Math.sqrt(area) * 0.62;
    const placed = [];
    this.catchProps = [];
    const box = new THREE.Box3();
    for (const o of list) {
      const m = this.makeDisplayModel(o.it.id, o.it.cm);
      const mesh = m.mesh;
      const inner = new THREE.Group(); // 向き・崩れた傾き
      inner.add(mesh);
      const fish = o.sp && !o.sp.model;
      let up = 1; // 魚のローカル +x（体の横方向）が上を向くなら 1
      if (fish) {
        // 横倒し。横倒しだと体の左右の反りが上下になるので、尾が砂から持ち上がる向きにだけ反らせる
        if (!o.sp.flat && rng.chance(0.5)) { mesh.rotation.z = -Math.PI / 2; up = -1; } else mesh.rotation.z = Math.PI / 2;
        m.sw.uAmp.value = 0;
        m.sw.uFold.value = 1;
        m.sw.uBend.value = up * rng.range(0.02, 0.13);
      } else if (o.sp) {
        m.sw.uAmp.value = 0.05; // イセエビの触角・タコの腕がまだ動く
      } else {
        mesh.scale.setScalar(1.25); // 貝・ウニ
      }
      // 置き場所：なるべく重ならない所を数回探し、重なったら上に乗せる
      let best = null;
      for (let t = 0; t < 14; t++) {
        const a = rng.range(0, Math.PI * 2), r = Math.sqrt(rng.next()) * R;
        const x = Math.cos(a) * r * 1.25, z = Math.sin(a) * r * 0.8;
        let ov = 0;
        for (const p of placed) ov += Math.max(0, (p.rad + o.rad) * 0.62 - Math.hypot(p.x - x, p.z - z));
        if (!best || ov < best.ov) best = { x, z, ov };
        if (ov === 0) break;
      }
      const W = P.clone().addScaledVector(side, best.x).addScaledVector(toSea, best.z);
      // 下に先に置いた獲物があれば、その上に乗る（高さは地面から法線方向に測る）
      let lift = 0, stacked = false;
      for (const p of placed) {
        if (Math.hypot(p.x - best.x, p.z - best.z) < (p.rad + o.rad) * 0.5) { lift = Math.max(lift, p.top - 0.01); stacked = true; }
      }
      inner.rotation.set(rng.range(-0.05, 0.05) + (stacked ? rng.range(-0.16, 0.16) : 0), rng.range(0, Math.PI * 2), stacked ? rng.range(-0.16, 0.16) : rng.range(-0.04, 0.04));
      inner.updateMatrixWorld(true);
      box.setFromObject(inner);
      inner.position.y = lift - box.min.y - 0.004; // いちばん低い所が砂の表面に来る
      // 地面の傾きに合わせて寝かせる
      const holder = new THREE.Group();
      holder.position.set(W.x, w.groundAt(W.x, W.z), W.z);
      holder.quaternion.setFromUnitVectors(UP, w.terrain.normalAt(W.x, W.z));
      holder.add(inner);
      // 地面は曲面なので、実際の頂点（反りも含む）を地面と照らし合わせ、砂に 4mm だけ沈む高さに合わせる
      // （他の獲物の上に乗っている物は、めり込む時だけ持ち上げる）
      const pen = this.penetration(holder, inner, fish ? m.sw.uBend.value : 0);
      if (!stacked || pen > 0.004) inner.position.y += pen - 0.004;
      // タコは外套膜が高く盛り上がるが、上に乗るのは広がった腕の上なので、腕の高さで数える
      const top = o.sp?.model === 'octopus' ? inner.position.y + box.min.y + 0.07 * o.len : inner.position.y + box.max.y;
      placed.push({ x: best.x, z: best.z, rad: o.rad, top });
      g.add(holder);
      this.catchProps.push({ inner, sw: m.sw, fish, len: o.len, baseY: inner.position.y, rotZ: inner.rotation.z, flop: 0 });
    }

    // 下の砂は、滴った海水で濡れて色が濃い
    if (list.length) {
      const c = document.createElement('canvas');
      c.width = c.height = 128;
      const cx = c.getContext('2d');
      for (let i = 0; i < 26; i++) {
        const x = 64 + rng.range(-26, 26), y = 64 + rng.range(-26, 26), r = rng.range(20, 44);
        const gr = cx.createRadialGradient(x, y, 0, x, y, r);
        gr.addColorStop(0, 'rgba(58,40,22,0.2)');
        gr.addColorStop(1, 'rgba(58,40,22,0)');
        cx.fillStyle = gr;
        cx.fillRect(0, 0, 128, 128);
      }
      const wet = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({
        map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4,
      }));
      // 地面の傾きに沿わせる（長い方を横向きに）
      const n = w.terrain.normalAt(P.x, P.z);
      wet.quaternion.setFromUnitVectors(UP, n).multiply(new THREE.Quaternion().setFromAxisAngle(UP, Math.atan2(-side.z, side.x)));
      wet.scale.set(R * 3.4, 1, R * 2.4);
      wet.position.copy(P).addScaledVector(n, 0.012);
      g.add(wet);
    }

    // 相棒の銛も手前に寝かせておく
    const spearProp = makeSpearProp();
    const dir = side.clone().multiplyScalar(-1).addScaledVector(toSea, 0.25).normalize();
    const mid = P.clone().addScaledVector(toSea, -R * 0.95 - 0.25).addScaledVector(side, 0.2);
    const tip = mid.clone().addScaledVector(dir, 0.9), butt = mid.clone().addScaledVector(dir, -0.9);
    tip.y = w.groundAt(tip.x, tip.z) + 0.012;
    butt.y = w.groundAt(butt.x, butt.z) + 0.009;
    spearProp.position.copy(butt);
    spearProp.lookAt(butt.clone().multiplyScalar(2).sub(tip)); // -z（穂先）を tip へ向ける
    g.add(spearProp);

    // 焚き火の照り返し（夕日の逆光で獲物が沈まないように）
    const glow = new THREE.PointLight('#ffb27a', 5, 7, 1.5);
    glow.position.copy(P).addScaledVector(toSea, -1.6).addScaledVector(side, 0.9).add(V3(0, 1.3, 0));
    g.add(glow);

    this.scene.add(g);
    this.catchGroup = g;
    this.catchCenter = P;
    this.catchR = R;
    this.flopT = 1.2;
  }

  /** 置いた物がどれだけ砂にめり込んでいるか（負なら浮いている。地面の法線方向。魚の反りはシェーダーと同じ式で再現） */
  penetration(holder, inner, bend) {
    const w = this.world, v = V3();
    holder.updateMatrixWorld(true);
    let worst = -Infinity;
    inner.traverse((o) => {
      if (!o.isMesh) return;
      const pos = o.geometry.attributes.position, ab = o.geometry.attributes.aBody;
      const step = Math.max(1, Math.floor(pos.count / 300));
      for (let i = 0; i < pos.count; i += step) {
        v.fromBufferAttribute(pos, i);
        if (ab && bend) v.x += bend * ab.getX(i) ** 2;
        v.applyMatrix4(o.matrixWorld);
        worst = Math.max(worst, w.groundAt(v.x, v.z) - v.y);
      }
    });
    const ny = V3(0, 1, 0).applyQuaternion(holder.quaternion).y;
    return worst / Math.max(ny, 0.5);
  }

  /** ときどき魚が跳ねる（まだ生きている） */
  updateCatchProps(dt) {
    if (!this.catchProps) return;
    this.flopT -= dt;
    if (this.flopT <= 0) {
      const fish = this.catchProps.filter((p) => p.fish && p.flop === 0);
      if (fish.length) fish[Math.floor(Math.random() * fish.length)].flop = 0.0001;
      this.flopT = 1.2 + Math.random() * 2.2;
    }
    for (const p of this.catchProps) {
      if (!(p.flop > 0)) continue;
      p.flop += dt;
      const k = p.flop / 0.75;
      if (k >= 1) {
        p.flop = 0;
        p.sw.uAmp.value = 0;
        p.inner.position.y = p.baseY;
        p.inner.rotation.z = p.rotZ;
        continue;
      }
      // くねる振れ幅のぶん体を浮かせてから跳ねる（砂にめり込まない）
      const env = Math.sin(k * Math.PI);
      p.sw.uAmp.value = 0.16 * env;
      p.sw.uPhase.value += dt * 34;
      p.inner.position.y = p.baseY + 0.16 * env * p.len + Math.abs(Math.sin(k * Math.PI * 3)) * 0.03 * (1 - k);
      p.inner.rotation.z = p.rotZ + Math.sin(k * 20) * 0.1 * env;
    }
  }

  resultsCam(dt, init) {
    const cam = this.camera;
    const fp = this.world.firePos;
    const toSea = V3(fp.x, 0, fp.z).normalize();
    const side = V3(-toSea.z, 0, toSea.x);
    const P = this.catchCenter || fp.clone().addScaledVector(toSea, 1.5);
    const R = this.catchR || 0.4;
    if (init) this.resT = 0;
    this.resT += dt;
    // 獲物の山にゆっくり寄っていく
    const k = smoothstep(0, 5, this.resT);
    const a = Math.sin(this.resT * 0.08) * 0.1;
    // 焚き火は右手（成績カードの裏）に外し、獲物の山を左手前に、夕日の海を背景に
    const pos = P.clone()
      .addScaledVector(toSea, -(lerp(1.7, 0.85, k) + R * 1.05))
      .addScaledVector(side, -0.1 + R * 0.3 + a)
      .add(V3(0, lerp(1.7, 1.15, k) + R * 0.75, 0));
    pos.y = Math.max(pos.y, this.world.groundAt(pos.x, pos.z) + 0.8);
    cam.position.copy(pos);
    cam.lookAt(P.clone().addScaledVector(toSea, 0.15 + R * 0.3).addScaledVector(side, 0.5 + R * 0.9).add(V3(0, 0.05, 0)));
    cam.fov = 56;
    cam.updateProjectionMatrix();
  }

  // ───────── HUD ─────────
  /** 気配の段階（境目で表示がパタパタしないよう、上げ下げで閾値をずらす） */
  noiseLevel(n) {
    const lv = this._noiseLv || 0;
    const up = [0.18, 0.48], down = [0.12, 0.4];
    let next = lv;
    if (lv < 2 && n > up[lv]) next = lv + 1;
    else if (lv > 0 && n < down[lv - 1]) next = lv - 1;
    this._noiseLv = next;
    return next;
  }

  updateHintsAndHud(dt, dayT) {
    const p = this.player, cam = this.camera, ui = this.ui, sp = this.spear;
    if (p.submerged) this.underTime += dt;
    if (this.underTime > 18) this.showHint('breath', '<b>息</b>に注意。深く潜るほど早く減っていく。', 5);
    if (p.submerged && p.stillTime > 3 && p.nearBottom) this.showHint('still', '海底でじっとしていると、好奇心の強い魚が<b>寄ってくる</b>…', 5);
    if (p.outOfBounds) ui.warn('これ以上は沖に流される…', true);

    // 狙っている生き物
    let tag = null;
    let inReach = '';
    if (p.submerged && !p.locked) {
      let c = this.eco.aimed(cam.position, p.fwd, 10, this.aimTarget);
      // 一瞬視線から外れても、しばらくは同じ相手を表示し続ける
      if (c) this.aimLost = 0;
      else if (this.aimTarget?.alive && (this.aimLost = (this.aimLost || 0) + dt) < 0.4) c = this.aimTarget;
      if (c !== this.aimTarget) this.tagXY = null;
      this.aimTarget = c;
      if (c) {
        const top = c.pos.clone().add(V3(0, c.radius + 0.12 + c.len * 0.1, 0));
        const v = top.project(cam);
        if (v.z < 1) {
          const z = save.zk(c.sp.id);
          let isNew = false;
          if (!z.seen) {
            z.seen = true;
            save.write();
            this.seenThisDay.add(c.sp.id);
            isNew = true;
            this.ui.toast(`<b>新発見！</b> ${c.sp.name}<small>図鑑に姿が記録された</small>`, { cls: 'info', img: this.ui.thumbs[c.sp.id] });
            audio.catchJingle(1);
          }
          const eye = c.alert < 0.35 ? '' : c.alert < 0.68 ? 'wary' : 'alarm';
          const hidden = c.hittable === false;
          const tx = ((v.x + 1) / 2 * innerWidth) / this.hz, ty = ((1 - v.y) / 2 * innerHeight) / this.hz;
          if (!this.tagXY) this.tagXY = { x: tx, y: ty };
          const k = 1 - Math.exp(-14 * dt);
          this.tagXY.x += (tx - this.tagXY.x) * k;
          this.tagXY.y += (ty - this.tagXY.y) * k;
          tag = {
            x: this.tagXY.x, y: this.tagXY.y,
            name: c.sp.name, sub: hidden ? '隠れている…' : `約${c.cm}cm　${c.pos.distanceTo(cam.position).toFixed(1)}m`,
            eye, isNew: false, rare: (c.sp.rarity || 1) >= 3, legend: !!c.sp.legend,
          };
          const dd = c.pos.distanceTo(cam.position);
          if (dd < sp.minRange - 0.1) inReach = 'close';
          else if (sp.state === 'charging' && !hidden && dd - c.radius - c.len * 0.2 < sp.reachFor(sp.charge)) inReach = 'in';
          if (!this.hintsShown.has('approach') && dd < 8) this.showHint('approach', '<b>ゆっくり</b>近づこう。速く泳ぐと「気配」で気づかれる。', 5);
        }
      }
    }
    ui.tag(tag);

    const h = Math.floor(9 + dayT * 9), mi = Math.floor(((9 + dayT * 9) % 1) * 60);
    const left = Math.max(0, DAY_LEN - this.dayTime);
    const b = ((-THREE.MathUtils.radToDeg(p.yaw) % 360) + 360) % 360;
    const hb = ((THREE.MathUtils.radToDeg(Math.atan2(-p.pos.x, p.pos.z)) % 360) + 360) % 360;
    const rate = (1 + p.depth / 22) / BREATH_SEC;
    ui.updateHud({
      bearing: b, homeBearing: hb,
      clock: `${String(Math.min(h, 18)).padStart(2, '0')}:${String(h >= 18 ? 0 : mi).padStart(2, '0')}`,
      left: left > 0 ? `日没まで ${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}` : '日没',
      dayT,
      depth: p.submerged ? p.depth : 0, maxDepth: this.maxDepth,
      breath: p.breath, breathSec: p.submerged ? p.breath / rate : p.breath * BREATH_SEC, surface: !p.submerged,
      bagN: this.bag.length, bagY: this.bag.reduce((s, i) => s + i.value, 0), total: this.total,
      charge: sp.state === 'charging' ? sp.charge : 0, inReach, submerged: p.submerged,
      noise: p.noise, noiseLv: this.noiseLevel(p.noise), still: p.stillTime > 1,
    });
  }
}
