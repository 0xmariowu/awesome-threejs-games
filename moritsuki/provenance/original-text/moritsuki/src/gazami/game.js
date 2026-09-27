// ガザミ拾いの本体: 状態の流れ・砂をなでる・「いてっ」・手を突っ込む・獲れた演出・挟まれる「いてー」・潮・結果
import * as THREE from 'three';
import { audio } from './core/audio.js';
import { Input } from './core/input.js';
import { Post } from './post.js';
import { World } from './world.js';
import { Backdrop } from './backdrop.js';
import { Field, LOW_TIDE, HIGH_TIDE } from './field.js';
import { Sense } from './sense.js';
import { Body } from './body.js';
import { Player } from './player.js';
import { FX } from './fx.js';
import { Crab } from './crabs.js';
import { renderThumbs } from './thumbs.js';
import { CRABS, ZUKAN_IDS, RANKS, LEGEND_RANK, LEGEND_AT, gazamiTotal, valueOf, weightOf } from './species.js';
import { UI, yen, kg, fullName } from './ui.js';
import { save } from './save.js';
import { townLink } from '../shared/townLink.js';
import { NetBag } from './netbag.js';
import { clamp, lerp, smoothstep, RNG } from './core/noise.js';

// 町から来たとき（/gazami/?town）: タイトル・結果に「町に帰る」、獲った物は町の持ち物へ
const { TOWN, townURL, applyTownTexts, stashCatch } = townLink({ from: 'gazami', title: 'ガザミ拾い — 内の浜（吉山）' });

const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const SESSION = 300;               // 満ち潮までの遊べる時間（秒）
const OUCH_MAX = 5;                // 「いてー」がこの数で帰る
const START = { x: 12, z: 5 };
const REACH = [0.2, 0.72];         // 手を突っ込める距離（足もとから）
const DEEP = 0.47;                 // これより深いと、しゃがんでも手が砂に届かない
const STROKE_HZ = 1.2;             // 手のひらで円を描く速さ（1 秒に何周）
const MILESTONES = [10, 25, 50, 75, 100, 150, 200, 300, 500];
const rand = (a, b) => a + (b - a) * Math.random();
const ease = (k) => k * k * (3 - 2 * k);

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
    this.applyQuality(S.quality);
    this.resize();
    addEventListener('resize', () => this.resize());

    this.ui.loading(0.78, 'カニを砂にもぐらせています');
    await tick();
    this.newField(save.data.days + 1);
    this.sense = new Sense(this.scene);
    this.fx = new FX(this.scene, this.overlay);
    this.fx.setPR(this.pr);
    this.player = new Player(this.camera, this.world);
    this.body = new Body(this.scene, this.camera);
    this.body.handMode = 'free';
    this.bag = new NetBag(this.scene);
    this.walkers = [];
    this.hand = { L: this.newHand(-1), R: this.newHand(1) };
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
  }

  newField(day) {
    this.field = new Field(this.world.beach, day, START, this.legendOpen());
  }
  /** レジェンド（タラバガニ）が浜に現れるか: ガザミを合計 LEGEND_AT 匹拾ったら */
  legendOpen() { return gazamiTotal(save.data.zukan) >= LEGEND_AT; }
  /**
   * 開放の知らせ（拾った数が LEGEND_AT をこえた時）。タラバガニが砂にまじるのは次の夜から（次の夜の浜は endSession で作る）。
   * 開放前のセーブで、すでに今夜の浜にまじっている時だけ「今夜から」
   */
  unlockLegend(delay = 1.6) {
    if (save.data.legend || !this.legendOpen()) return;
    save.data.legend = true;
    save.write();
    const when = this.field.legend ? '今夜から' : '次の夜から';
    this.legendNews = when;
    this.later(delay, () => {
      audio.celebrate();
      this.ui.telop(`<div class="tl tl-legend">${this.ui.chars('レジェンド開放', 0.07)}</div><div><span class="tl-sub">ガザミ ${LEGEND_AT} 匹！　${when}、タラバガニが浜に出る！</span></div><div><span class="tl-sub">北の海の王さまが、この浜に迷いこんだらしい……</span></div>`, 4.6, true);
      this.ui.toast(`<b>${when}</b>、<b>タラバガニ</b>が出現<small>100 匹に 1 匹。「いてっ」の輪郭が、とにかくでかい</small>`, { cls: 'info', img: this.ui.thumbs.taraba, dur: 7 });
    });
  }
  newHand(sg) { return { sg, pos: V3(), vel: V3(), palm: V3(0, -1, 0), fwd: V3(0, 0, -1), pose: 'rest', flinch: 0, init: false, lastPos: V3(), speed: 0 }; }

  installDebug() {
    const g = this;
    window.dbg = {
      async play() { while (g.mode !== 'title') await new Promise((r) => setTimeout(r, 100)); g.ui.only(); g.beginPlay(); },
      step(n = 1, dt = 1 / 60) { for (let i = 0; i < n; i++) { g.t += dt; g.update(dt); g.input.endFrame(); } g.post.u.uTime.value = g.t; g.post.render(); },
      freeze() { g.loop = () => {}; },
      tp(x, z, yaw = Math.PI, pitch = -0.9) { g.player.reset(x, z, yaw); g.player.pitch = pitch; g.bag.reset(); for (const h of Object.values(g.hand)) h.init = false; },
      // いちばん近いカニ（id で種類をしぼる）
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
      // カニ it の後ろ（front = true なら前）にしゃがんで、甲羅をねらう
      aimAt(it, front = false) {
        const fx = Math.sin(it.yaw), fz = Math.cos(it.yaw);
        const s = front ? 1 : -1;
        const px = it.x + fx * 0.42 * s, pz = it.z + fz * 0.42 * s;
        const yaw = Math.atan2(-(it.x - px), -(it.z - pz));
        g.player.reset(px, pz, yaw);
        g.player.pitch = -1.1;
        g.aimLock = { x: it.x, z: it.z };
        for (const h of Object.values(g.hand)) h.init = false;
      },
      stroke(on = true) { g.input.left = on; },
      plunge() { g.input.right = true; this.step(1); g.input.right = false; },
      catchNear(id) { const it = this.near(id); this.aimAt(it); this.step(30); this.plunge(); this.step(90); g.aimLock = null; return it; },
      pinch(id) { const it = this.near(id); this.aimAt(it, true); this.step(20); g.startPinch(it, 'R'); return it; },
      results(n = 40, legend = false) {
        for (let i = 0; i < n; i++) { const id = legend && i === 0 ? 'taraba' : ['taiwanM', 'taiwanF', 'ishigani'][i % 7 === 0 ? 2 : i % 2]; const sp = CRABS[id]; g.addCatch({ id, cm: Math.round(rand(sp.size[0], sp.size[1]) * 10) / 10, seed: Math.random() }); }
        g.day = save.data.days + 1;
        return g.endSession('tide');
      },
      home() { g.ouch = OUCH_MAX; g.goHome(); },
      // 自動で一晩遊ぶ（調整用）: 群れ場を歩いて砂をなで、輪郭が出たら後ろへ回ってつかむ。[秒, 獲った数, いてっ, いてー, 突っ込んだ数]
      bot(secs = 300, dt = 1 / 30) {
        const p = g.player, inp = g.input;
        const s0 = g.field.spots[0];
        this.tp(s0.x, s0.z - s0.r - 0.5, Math.PI, -1.0);
        let T = 0; const log = [];
        while (T < secs && g.mode !== 'results' && !g.ending) {
          T += dt; inp.right = false;
          if (g.mode === 'play' && !g.grab) {
            const o = g.sense.active.find((a) => a.it.alive || a.it.walk);
            inp.left = true;
            if (o) {
              const it = o.it, d = Math.hypot(it.x - p.pos.x, it.z - p.pos.z);
              const bx = it.x - Math.sin(it.yaw) * 0.45, bz = it.z - Math.cos(it.yaw) * 0.45;
              const db = Math.hypot(bx - p.pos.x, bz - p.pos.z);
              if (d < 0.7 && (db < 0.35 || o.age > 1.2)) { g.aimLock = { x: it.x, z: it.z }; inp.right = !g._rightWas; inp.keys.delete('KeyW'); }
              else { const tx = db < 0.35 ? it.x : bx, tz = db < 0.35 ? it.z : bz; p.yaw = Math.atan2(-(tx - p.pos.x), -(tz - p.pos.z)); inp.keys.add('KeyW'); }
            } else {
              g.aimLock = null;
              const ok = g.field.spots.filter((s) => g.world.tide + 0.02 - g.world.groundAt(s.x, s.z) < 0.42);
              const s = ok.reduce((a, b) => (Math.hypot(b.x - p.pos.x, b.z - p.pos.z) < Math.hypot(a.x - p.pos.x, a.z - p.pos.z) ? b : a), ok[0]);
              if (Math.hypot(s.x - p.pos.x, s.z - p.pos.z) > s.r * 0.9) p.yaw = Math.atan2(-(s.x - p.pos.x), -(s.z - p.pos.z)) + (Math.random() - 0.5) * 0.5;
              else p.yaw += (Math.random() - 0.5) * 0.1;
              inp.keys.add('KeyW');
            }
          } else if (g.mode === 'pinch') { inp.left = false; inp.keys.delete('KeyW'); inp.mdx = (Math.floor(T * 8) % 2 ? 1 : -1) * 80; }
          else inp.keys.delete('KeyW');
          g.t += dt; g.update(dt); inp.endFrame();
          if (Math.floor(T) % 60 === 0 && Math.floor(T) !== Math.floor(T - dt)) log.push([Math.floor(T), g.catches.length, g.pricks, g.ouch, g.plunges]);
        }
        inp.keys.delete('KeyW'); inp.left = false; g.aimLock = null;
        return log;
      },
      tide(k) { g.tideT = k; },
      // レジェンドを開放して（ガザミの数をそろえて）、いちばん近いタラバガニの後ろへ
      legend(go = true) {
        const z = save.zk('taiwanM');
        if (!g.legendOpen()) z.caught = (z.caught || 0) + LEGEND_AT;
        if (g.mode === 'play') g.unlockLegend(0.2);
        g.field.addLegends();
        const it = this.near('taraba');
        if (go && it && g.mode === 'play') this.aimAt(it);
        return it;
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
        case 'quit': this.ui.hide('pause'); this.mode = this.pausedFrom || 'play'; this.endSession('quit'); break;
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
  get playing() { return ['play', 'pinch'].includes(this.mode); }

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

  // ───────── タイトル: 浅瀬の砂の上のタイワンガザミを、ヘッドライトで照らす ─────────
  titleSetup() {
    // 水深 25cm ほどの所（浅すぎると、うねりのたびに泡が立ってライトで白くかすむ）
    const x = 4.5, z = 19;
    const g = this.world.groundAt(x, z);
    this.titleSpot = V3(x, g, z);
    // ライトの輪の中を、3 匹のカニが歩きまわる（オス・メス・イシガニ）
    if (!this.titleCrabs) {
      this.titleCrabs = [['taiwanM', 18, 0.61, 0, 0], ['taiwanF', 15, 0.23, 0.3, 0.25], ['ishigani', 9.5, 0.47, -0.28, -0.2]].map(([id, cm, seed, dx, dz]) => {
        const crab = new Crab(id, cm, seed);
        this.scene.add(crab.group);
        return { crab, x: x + dx, z: z + dz, yaw: Math.random() * 6.28, dir: 1, v: 0, mode: 'walk', timer: rand(1, 3) };
      });
      this.titleCrab = this.titleCrabs[0].crab;
    }
    for (const c of this.titleCrabs) c.crab.group.visible = true;
    this.titleCenter = this.titleSpot.clone();
    this.body.group.visible = false;
    this.bag.group.visible = false;
    this.world.tide = LOW_TIDE;
    this.world.setMoon(0);
  }
  titleCam(t, dt = 1 / 60) {
    this.updateTitleCrabs(dt);
    // カメラは 3 匹のまん中をゆっくり回りながら追う
    const cs = this.titleCrabs || [];
    const tc = V3();
    for (const c of cs) tc.add(V3(c.x, 0, c.z));
    if (cs.length) tc.multiplyScalar(1 / cs.length); else tc.copy(this.titleSpot);
    this.titleCenter.lerp(V3(tc.x, this.world.groundAt(tc.x, tc.z), tc.z), 1 - Math.exp(-1.5 * dt));
    const c = this.titleCenter;
    const a = t * 0.045 + 2.35;
    const R = 0.72;
    const cam = this.camera;
    cam.position.set(c.x + Math.cos(a) * R, this.world.tide + 0.38 + Math.sin(t * 0.3) * 0.03, c.z + Math.sin(a) * R);
    cam.lookAt(c.x - Math.cos(a) * 0.05, c.y + 0.03, c.z - Math.sin(a) * 0.05);
    cam.fov = 50;
    cam.updateProjectionMatrix();
  }
  /** タイトルのカニ: 横歩きで歩きまわり、ぶつかりそうになると向き合って威嚇する */
  updateTitleCrabs(dt) {
    const cs = this.titleCrabs;
    if (!cs || !cs[0].crab.group.visible) return;
    this.updateWanderers(cs, this.titleSpot, 0.55, dt);
  }
  /**
   * カニを輪の中で歩きまわらせる（タイトル・結果）。home を中心に半径 radius。
   * avoid = [{ x, z, r }]: 近づかない物（クーラーボックス・ランタン）
   */
  updateWanderers(cs, home, radius, dt, avoid = []) {
    const w = this.world;
    for (const c of cs) {
      c.timer -= dt;
      if (c.timer <= 0) {
        const r = Math.random();
        if (c.mode === 'threat' || r < 0.7) {
          c.dir = Math.random() < 0.5 ? 1 : -1;
          // 威嚇のあとは、相手と反対の横へ、しばらく落ち着いて歩く
          if (c.mode === 'threat' && c.away) {
            const lx0 = Math.cos(c.yaw), lz0 = -Math.sin(c.yaw);
            c.dir = (c.x - c.away.x) * lx0 + (c.z - c.away.z) * lz0 > 0 ? 1 : -1;
            c.calm = rand(2.5, 4.5); c.away = null;
          }
          c.mode = 'walk'; c.vt = rand(0.07, 0.16) * (c.crab.king ? 0.55 : 1); c.timer = rand(1.5, 3.5);
        } else { c.mode = 'threat'; c.timer = rand(1.2, 2.2); }
        c.turn = rand(-0.5, 0.5);
      }
      // ほかのカニに近づいたら、向き合って威嚇（威嚇のあとは、しばらく相手から離れて歩く）
      c.calm = Math.max(0, (c.calm || 0) - dt);
      for (const o of cs) {
        if (o === c) continue;
        const ox = o.x - c.x, oz = o.z - c.z, d = Math.hypot(ox, oz);
        const near = (c.crab.R + o.crab.R) * 0.75;
        if (d < near && c.mode === 'walk' && c.calm <= 0) { c.mode = 'threat'; c.timer = rand(1, 1.8); c.face = Math.atan2(ox, oz); c.away = o; }
        // 重なったら押し広げる
        const minD = (c.crab.R + o.crab.R) * 0.42;
        if (d < minD && d > 1e-4) { const k = (minD - d) * 0.5 / d; c.x -= ox * k; c.z -= oz * k; }
      }

      if (c.mode === 'threat' && c.face !== undefined) { let dy = c.face - c.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); c.yaw += dy * (1 - Math.exp(-3 * dt)); }
      else c.face = undefined;
      const want = c.mode === 'walk' ? c.dir * (c.vt || 0.1) : 0;
      c.v += (want - c.v) * (1 - Math.exp(-4 * dt));
      c.yaw += (c.turn || 0) * dt * (c.mode === 'walk' ? 1 : 0);
      const lx = Math.cos(c.yaw), lz = -Math.sin(c.yaw);
      c.x += lx * c.v * dt; c.z += lz * c.v * dt;
      // 輪から出そうになったら、または物にぶつかりそうなら、向きを変える
      const dx = c.x - home.x, dz = c.z - home.z, dd = Math.hypot(dx, dz);
      let turnBack = dd > radius && (dx * lx + dz * lz) * Math.sign(c.v) > 0;
      for (const o of avoid) {
        const ox = c.x - o.x, oz = c.z - o.z;
        if (Math.hypot(ox, oz) < o.r + c.crab.R * 0.5 && (ox * lx + oz * lz) * Math.sign(c.v) < 0) turnBack = true;
      }
      if (turnBack) { c.dir *= -1; c.v *= 0.3; }
      const m = c.crab.group;
      m.position.set(c.x, w.groundAt(c.x, c.z) + c.crab.standH, c.z);
      m.rotation.set(0, c.yaw, 0);
      c.crab.pose(c.mode, dt, { v: c.v });
    }
  }
  // 町に帰る（/gazami/?town のとき。暗くして音を消してから移る）
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
      ? [{ text: '内の浜　夜八時半　満ち潮のはじまり', cls: 'day', wait: 1500 },
        { text: '夜になると、カニは浅瀬へ寄ってくる。', wait: 1700 },
        { text: '砂を、両手のひらでなでる。', wait: 1500 },
        { text: '右手は時計回り、左手はその反対。', wait: 1600 },
        { text: '硬いものに、手がふれたら――', wait: 1500 },
        { text: 'いてっ。', cls: 'big', wait: 1100, sound: () => audio.prick() },
        { text: 'そこに、いる。', wait: 1300 },
        { text: 'ガザミ拾い。', cls: 'big', wait: 1600, sound: () => audio.taiko(0, 0.7, 70) }]
      : [{ text: `内の浜　${day}回目の夜`, cls: 'day', wait: 1200 },
        { text: ['今夜も、浅瀬はカニだらけ。', '一匹いたら、まわりにもいる。', 'ハサミは前。つかむのは後ろから。', '「いてっ」ときたら、すぐ突っ込め。', '絆創膏は、多めに持ってきた。'][day % 5], wait: 1600 },
        ...(this.legendOpen() ? [{ text: '北の海の王さまも、どこかにいるらしい。', wait: 1500 }] : []),
        { text: 'ガザミ拾い。', cls: 'big', wait: 1400, sound: () => audio.taiko(0, 0.7, 70) }];
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
    for (const c of this.titleCrabs || []) c.crab.group.visible = false;
    this.tideT = 0;
    this.catches = [];
    this.total = 0;
    this.grams = 0;
    this.ouch = 0;
    this.pricks = 0;
    this.plunges = 0;
    this.combo = 0;
    this.lastCatchT = -99;
    this.stroking = false;
    this.strokeK = 0;
    this.phase = 0;
    this.pause0 = 0;
    this.grab = null;
    this.pinchS = null;
    this.ending = false;
    this.warnedTide = false;
    this.timers = [];
    this.hintsShown = new Set();
    this.hardSeen = new Map();
    this.bestToday = null;
    this.idleT = 0;
    this.nextWalker = rand(4, 8);
    this.strokeFx = 0;
    this.world.tide = LOW_TIDE;
    this.player.reset(START.x, START.z, Math.PI);
    this.player.locked = false;
    this.player.lookOverride = null;
    this.player.crouchTarget = 0;
    for (const h of Object.values(this.hand)) h.init = false;
    for (const a of this.body.arms) a.hand.clearBandaids();
    this.body.group.visible = true;
    this.bag.group.visible = true;
    this.bag.set(0);
    this.bag.reset();
    this.sense.clear();
    this.sense.clearHoles();
    this.input.enabled = true;
    this.ui.showHud(true);
    this.ui.dimHud(false);
    this.ui.setOuch(0);
    this.noPause = false;
    this.camera.fov = save.data.settings.fov;
    this.camera.updateProjectionMatrix();
    audio.setMusic('play');
    audio.setAmbience('beach');
    this.legendNews = false;
    this.unlockLegend(3);
    this.later(1.0, () => this.showHint('stroke', '<b>左クリックを押している間</b>、しゃがんで両手で砂をなでる。押したまま <b>W A S D</b> で、なでながら進める。', 8));
    this.later(12, () => { if (!this.pricks) this.showHint('walk', '沖の方へ少し歩いて、<b>ひざくらいの深さ</b>の砂をなでてみよう。', 6); });
  }

  clearScene() {
    for (const w of [...(this.walkers || [])]) this.dropWalker(w);
    if (this.grab?.crab) { this.scene.remove(this.grab.crab.group); this.grab.crab.dispose(); }
    if (this.pinchS?.crab) { this.scene.remove(this.pinchS.crab.group); this.pinchS.crab.dispose(); }
    for (const c of this.resultCrabs || []) { this.scene.remove(c.crab.group); c.crab.dispose(); }
    this.resultCrabs = null;
    this.grab = null;
    this.pinchS = null;
    this.ui.shake(false);
    this.ui.prompt('');
    this.ui.warn('');
    this.sense?.setReticle(false);
    audio.setStroke(0);
  }

  pause() {
    if (!this.playing) return;
    this.pausedFrom = this.mode;
    this.mode = 'pause';
    this.input.enabled = false;
    audio.setStroke(0);
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
      this.titleCam(this.t, dt);
      w.aimHead(this.camera, 0.85, this.camera.position.distanceTo(this.titleCenter));
      this.updateWorld(dt, this.titleSpot);
      return;
    }
    if (this.mode === 'results') {
      if (this.resultCrabs) this.updateWanderers(this.resultCrabs, this.resultHome, this.resultR, dt, this.resultAvoid);
      this.resultsCam(dt);
      w.aimHead(this.camera, 0.45, 1.0);
      this.updateWorld(dt, this.resultSpot);
      return;
    }
    // ─── 浜 ───
    for (const tm of this.timers) { tm.t -= dt; if (tm.t <= 0 && !tm.done) { tm.done = true; tm.fn(); } }
    this.timers = this.timers.filter((t) => !t.done);
    this.updateTide(dt);
    const p = this.player, inp = this.input;
    p.update(dt, inp, this.t);
    w.aimHead(this.camera, 1, this.subjectDist());
    if (this.mode === 'play') this.updatePlay(dt);
    else if (this.mode === 'pinch') this.updatePinch(dt);
    else if (this.mode === 'ending') this.updateEnding(dt);
    this.updateWalkers(dt);
    this.updateHands(dt);
    this.updateBody(dt);
    this.bag.update(dt, this.body, this.t, p);
    this.updateWorld(dt, p.pos);
    this.updateHud(dt);
    this._rightWas = inp.right;
    const u = this.post.u;
    u.uDrops.value = Math.max(0, u.uDrops.value - dt * 0.25);
    u.uFlash.value = Math.max(0, u.uFlash.value - dt * 3);
    this.ui.lockHint(!this.input.locked && !this.input.freeLook && this.playing);
  }

  /** ヘッドライトが照らしている物までの距離（持ち上げたカニ・砂） */
  subjectDist() {
    const cam = this.camera.position;
    if (this.grab?.crab && this.grab.phase !== 'lift') return cam.distanceTo(this.grab.crab.group.position);
    if (this.grab?.crab) return Math.min(0.9, cam.distanceTo(this.grab.crab.group.position) + 0.2);
    if (this.pinchS) return cam.distanceTo(this.pinchS.crab.group.position);
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
    this.sense.update(dt, (x, z) => w.groundAt(x, z));
    this.fx.update(dt, (x, z) => w.waterAt(x, z, this.t));
  }

  // ───── 潮 ─────
  updateTide(dt) {
    if (!this.ending && this.mode === 'play') this.tideT = Math.min(1, this.tideT + dt / SESSION);
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

  // ───── 砂をなでる・ねらう・突っ込む ─────
  updatePlay(dt) {
    const p = this.player, inp = this.input, w = this.world;
    const depth = w.tide + 0.02 - w.groundAt(p.pos.x, p.pos.z);
    const wantStroke = inp.left && inp.enabled && !this.grab;
    const tooDeep = depth > DEEP;
    const tooShallow = depth < 0.04;
    this.stroking = wantStroke && !tooDeep;
    p.crouchTarget = this.stroking || this.grab ? 1 : 0;
    p.crouchK = this.grab ? 12 : 6;
    if (wantStroke && tooDeep) { this.ui.warn('ここは深くて、しゃがむと顔がつかる', true); this.showHint('deep', '深すぎる所では手が砂に届かない。<b>浅い方</b>へもどろう。', 5); }
    else if (this.ui.last.warn?.startsWith('ここは深くて')) this.ui.warn('');
    // 手のひらの円（「いてっ」の直後は少し止まる）
    this.pause0 = Math.max(0, this.pause0 - dt);
    this.strokeK += ((this.stroking ? 1 : 0) - this.strokeK) * (1 - Math.exp(-7 * dt));
    if (this.stroking && p.crouch > 0.55 && this.pause0 <= 0) this.phase += dt * Math.PI * 2 * STROKE_HZ;
    // しゃがんだら、手もとが見えるように少しうつむく（自分で見回している間はしない）
    if (this.stroking && p.pitch > -1.12 && Math.abs(p.mouse?.[1] || 0) < 0.5) p.pitch = lerp(p.pitch, -1.18, 1 - Math.exp(-2.5 * dt));
    // ねらい
    const T = this.aimPoint();
    let hot = null;
    for (const o of this.sense.active) {
      if (!o.it.alive && !o.it.walk) continue;
      if (this.field.over(o.it, T.x, T.z, 0.04)) { hot = o.it; break; }
    }
    for (const wk of this.walkers) if (!hot && this.field.over(wk, T.x, T.z, 0.04)) hot = wk;
    const showRet = !this.grab && (p.crouch > 0.4 || this.sense.active.length > 0 || this.walkers.some((x) => x.walk?.seen));
    this.sense.setReticle(showRet && T.ok, T.x, T.z, hot ? 1 : 0);
    // 突っ込む（右クリック・スペース）
    const pressR = (inp.right && !this._rightWas) || inp.pressed('Space');
    if (pressR && !this.grab && inp.enabled) {
      if (!T.ok) this.ui.word('届かない', innerWidth / 2 / this.hz, innerHeight * 0.62 / this.hz, 'miss');
      else this.startPlunge(T);
    }
    // 手ざわり
    if (this.stroking && this.strokeK > 0.8 && p.crouch > 0.75) this.feel(dt);
    // なでる音
    const hs = (this.hand.L.speed + this.hand.R.speed) * 0.5;
    audio.setStroke(this.stroking && p.crouch > 0.6 ? 1 : 0, clamp(hs / 0.8, 0, 1));
    // 案内
    if (this.grab) this.ui.prompt('');
    else if (hot) this.ui.prompt('<kbd>右クリック</kbd>（<kbd>Space</kbd>）で手を突っ込め！');
    else if (this.sense.active.length) this.ui.prompt('ねらいの輪を<b>青い輪郭</b>に合わせて <kbd>右クリック</kbd>');
    else if (tooShallow && wantStroke) this.ui.prompt('ここは浅すぎる。もう少し沖へ');
    else this.ui.prompt('');
    if (!this.stroking && !this.grab) this.idleT += dt; else this.idleT = 0;
  }

  /** 画面の真ん中の先の砂の上（手の届く所に寄せる） */
  aimPoint() {
    const cam = this.camera, p = this.player, w = this.world;
    const ro = cam.position, rd = V3(0, 0, -1).applyQuaternion(cam.quaternion);
    if (this.aimLock) { const x = this.aimLock.x, z = this.aimLock.z; return { x, z, y: w.groundAt(x, z), ok: true }; }
    let hit = null;
    let prev = 0;
    for (let t = 0.05; t < 2.5; t += 0.03) {
      const x = ro.x + rd.x * t, y = ro.y + rd.y * t, z = ro.z + rd.z * t;
      if (y <= w.groundAt(x, z)) {
        // 手前の点との間で詰める
        let a = prev, b = t;
        for (let k = 0; k < 6; k++) { const m = (a + b) / 2; const yy = ro.y + rd.y * m; if (yy <= w.groundAt(ro.x + rd.x * m, ro.z + rd.z * m)) b = m; else a = m; }
        hit = { x: ro.x + rd.x * b, z: ro.z + rd.z * b };
        break;
      }
      prev = t;
    }
    const hx = V3(rd.x, 0, rd.z);
    if (hx.lengthSq() < 1e-6) hx.copy(p.forward); else hx.normalize();
    let x, z;
    if (hit) { x = hit.x; z = hit.z; } else { x = p.pos.x + hx.x * REACH[1]; z = p.pos.z + hx.z * REACH[1]; }
    // 手の届く輪の中へ
    const dx = x - p.pos.x, dz = z - p.pos.z;
    const d = Math.hypot(dx, dz);
    const dd = clamp(d, REACH[0], REACH[1]);
    if (d > 1e-4) { x = p.pos.x + dx / d * dd; z = p.pos.z + dz / d * dd; }
    const depth = w.tide + 0.02 - w.groundAt(x, z);
    return { x, z, y: w.groundAt(x, z), ok: depth < DEEP + 0.05 && depth > 0.02 };
  }

  /** 手のひらが砂の中のものにさわる */
  feel(dt) {
    const f = this.field, t = this.t;
    for (const key of ['L', 'R']) {
      const h = this.hand[key];
      if (h.flinch > 0 || h.speed < 0.05) continue;
      const hit = f.touching(h.pos.x, h.pos.z, 0.035);
      if (hit) {
        const it = hit.it;
        if (t - it.lastTouch < 0.9) { it.lastTouch = t; continue; }
        it.lastTouch = t;
        this.prick(it, key, hit);
        return;
      }
      const hd = f.hardAt(h.pos.x, h.pos.z, 0.028);
      if (hd && (!this.hardSeen.has(hd.key) || t - this.hardSeen.get(hd.key) > 2.5)) {
        this.hardSeen.set(hd.key, t);
        audio.hard(hd.kind, key === 'R' ? 0.3 : -0.3);
        this.popWord(hd.kind === 'ishi' ? 'コツ' : 'ザリ', h.pos, 'dull');
        this.hardN = (this.hardN || 0) + 1;
        if (this.hardN === 3) this.showHint('hard', '<b>コツ</b>は石、<b>ザリ</b>は貝殻。カニなら、とげが刺さって<b>「いてっ」</b>とくる。', 6);
      }
    }
    void dt;
  }

  /** 甲羅の棘が手のひらに刺さった */
  prick(it, key, hit) {
    const h = this.hand[key], sp = it.sp;
    this.pricks++;
    it.pricks++;
    it.anger = Math.min(2, it.anger + 0.45);
    // たまに不意打ちで挟まれる（前から触ったとき・何度もさわって怒らせたとき）
    const front = hit.lz > it.hl * 0.25 ? 2.4 : 1;
    const surprise = 0.0022 * sp.pinch * front * (1 + (it.pricks - 1) * 0.8) * (this.catches.length < 3 && !save.data.pinches ? 0.2 : this.tideT < 0.2 ? 0.5 : 1);
    if (Math.random() < surprise) { this.startPinch(it, key); return; }
    audio.prick(key === 'R' ? 0.3 : -0.3);
    const legend = !!sp.legend;
    this.popWord(legend ? ['いててっ！？', 'いてててっ！', 'とげだらけ！？'][Math.floor(Math.random() * 3)] : ['いてっ', 'いてっ', 'いてっ！', 'いたっ', 'チクッ'][Math.floor(Math.random() * 5)], h.pos, 'ouch');
    h.flinch = 0.42;
    this.pause0 = legend ? 0.5 : 0.3;
    this.player.shake = Math.max(this.player.shake, legend ? 0.6 : 0.3);
    this.sense.reveal(it, legend ? 5.5 : 3.6);
    // タラバガニ: はじめて触れた時は、でかい輪郭に気づく
    if (legend && it.pricks === 1) {
      audio.taiko(0.15, 0.9, 46); audio.taiko(0.5, 0.9, 42);
      this.later(0.35, () => this.ui.telop('<div class="tl tl-legend">……でかい。</div><div><span class="tl-sub">この輪郭、ガザミじゃない！</span></div>', 2.6, true));
    }
    const g = this.world.groundAt(it.x, it.z);
    this.fx.glow(h.pos.x, h.pos.y + 0.02, h.pos.z, 10, 0.06, 1.2);
    this.fx.sandPuff(h.pos.x, g + 0.01, h.pos.z, 3, 0.05, 0.5);
    this.world.murk.add(h.pos.x, h.pos.z, 0.08, 0.04);
    // 何度もさわると、逃げ出すことがある
    if (!it.fleeAt && Math.random() < (it.pricks > 1 ? 0.55 : 0.22) * (legend ? 0.4 : 1)) it.fleeAt = this.t + rand(1.6, 2.8) * (legend ? 1.5 : 1);
    if (this.pricks === 1) this.later(0.5, () => this.showHint('first', 'いてっ！ 砂の中に<b>青い輪郭</b>が見えた。ねらいの輪を合わせて<b>右クリック</b>（Space）で手を突っ込め！', 8));
    if (this.pricks === 6) this.later(0.3, () => this.showHint('front', '輪郭の<b>ハサミの側</b>から手を出すと挟まれる。<b>後ろから</b>つかもう。', 7));
  }

  // ───── 手を突っ込む ─────
  startPlunge(T) {
    const p = this.player;
    const r = V3(-p.forward.z, 0, p.forward.x);
    const side = (T.x - p.pos.x) * r.x + (T.z - p.pos.z) * r.z < -0.04 ? 'L' : 'R';
    const h = this.hand[side];
    this.grab = { phase: 'dive', t: 0, T: V3(T.x, T.y, T.z), side, from: h.pos.clone(), waited: 0 };
    this.plunges++;
    this.sense.setReticle(false);
  }

  updateGrab(dt) {
    const G = this.grab, p = this.player, w = this.world;
    if (!G) return;
    G.t += dt;
    if (G.phase === 'dive') {
      // しゃがみきってから（最大 0.25 秒待つ）
      if (p.crouch < 0.6 && G.waited < 0.25) { G.waited += dt; G.t = 0; G.from.copy(this.hand[G.side].pos); return; }
      const T = G.T;
      if (G.t > 0.07 && !G.splashed) {
        G.splashed = true;
        audio.plunge();
        this.post.water.ripple(T.x, T.z, 1.2);
      }
      if (G.t >= 0.2) {
        const g = w.groundAt(T.x, T.z);
        this.sense.hole(T.x, g, T.z);
        this.fx.sandPuff(T.x, g + 0.01, T.z, 10, 0.07, 1.1);
        this.fx.glow(T.x, g + 0.03, T.z, 18, 0.09, 1.3);
        this.fx.bubbles(T.x, g + 0.02, T.z, 5, 0.06);
        w.murk.add(T.x, T.z, 0.14, 0.12);
        this.resolvePlunge();
      }
    } else if (G.phase === 'miss') {
      if (G.t > 0.45) this.grab = null;
    } else if (G.phase === 'lift' || G.phase === 'hold' || G.phase === 'toss') this.updateCatch(dt);
  }

  resolvePlunge() {
    const G = this.grab, T = G.T, f = this.field;
    // 突っ込んだ所の下のカニ（歩いているのも）
    let best = null, be = 1;
    for (const it of f.around(T.x, T.z, 0.3)) {
      if (!it.alive) continue;
      const o = f.over(it, T.x, T.z, 0.035);
      if (o && o.e < be) { be = o.e; best = { it, ...o }; }
    }
    for (const wk of this.walkers) {
      const o = f.over(wk, T.x, T.z, 0.045);
      if (o && o.e < be) { be = o.e; best = { it: wk, ...o }; }
    }
    if (!best) {
      G.phase = 'miss'; G.t = 0;
      const hd = f.hardAt(T.x, T.z, 0.04);
      this.popWord(hd ? (hd.kind === 'ishi' ? '石…' : '貝殻…') : 'スカッ', T, 'miss');
      audio.miss();
      this.combo = 0;
      if (this.plunges >= 3 && this.catches.length === 0) this.showHint('aim', '「いてっ」の後に出る<b>青い輪郭</b>の上に、ねらいの輪を重ねてから突っ込もう。', 6);
      return;
    }
    const it = best.it;
    if (Math.random() < this.pinchChance(it, best)) { this.grab = null; this.startPinch(it, G.side); return; }
    this.startCatch(it);
  }

  /** 挟まれる確率: ハサミ（前）の側から手を出すほど高い */
  pinchChance(it, o) {
    const p = this.player;
    const fx = Math.sin(it.yaw), fz = Math.cos(it.yaw);
    let tx = p.pos.x - it.x, tz = p.pos.z - it.z;
    const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;
    const dot = fx * tx + fz * tz;
    let k = dot > 0.45 ? 0.08 : dot > -0.25 ? 0.02 : 0.005;
    if (o.lz > it.hl * 0.3) k += 0.03;
    else if (o.lz < -it.hl * 0.3) k *= 0.6;
    k *= it.sp.pinch * (1 + it.anger * 0.35) * (it.walk ? 1.4 : 1);
    // はじめのうちは、まず獲れる楽しさを（最初の 1 分は手加減）
    if (this.catches.length < 2 && !save.data.pinches) k *= 0.25;
    else if (this.tideT < 0.2) k *= 0.5;
    return clamp(k, 0, 0.85);
  }

  // ───── 獲れた ─────
  startCatch(it) {
    const G = this.grab, w = this.world;
    let crab;
    if (it.walk) { crab = it.walk.crab; this.walkers.splice(this.walkers.indexOf(it), 1); it.walk = null; G.fromWalker = true; }
    else { crab = new Crab(it.id, it.cm, it.seed); this.scene.add(crab.group); }
    it.alive = false; it.caught = true;
    this.field.remove(it);
    this.sense.hide(it);
    if (!crab.group.parent || !G.fromWalker) {
      const g = w.groundAt(it.x, it.z);
      crab.group.position.set(it.x, g - it.depth - crab.H * 0.2, it.z);
      crab.group.rotation.set(0, it.yaw, 0);
    }
    crab.setWet(1);
    G.phase = 'lift'; G.t = 0;
    G.it = it; G.crab = crab;
    G.from = crab.group.position.clone();
    G.q0 = crab.group.quaternion.clone();
    audio.grabbed();
    this.player.shake = Math.max(this.player.shake, 0.25);
  }

  heldPose(big = false, crab = null) {
    const cam = this.camera;
    const fwd = V3(0, 0, -1).applyQuaternion(cam.quaternion), up = V3(0, 1, 0).applyQuaternion(cam.quaternion), right = V3(1, 0, 0).applyQuaternion(cam.quaternion);
    // タラバガニは脚が長いので、腕をのばして遠くに持つ
    const king = crab?.king;
    const pos = cam.position.clone().addScaledVector(fwd, king ? 0.62 : big ? 0.44 : 0.4).addScaledVector(up, king ? -0.05 : -0.09).addScaledVector(right, 0.03);
    // 背中をこちらへ向け、前（ハサミ）を向こう上へ
    const y = fwd.clone().multiplyScalar(-0.72).addScaledVector(up, 0.7).normalize();
    const z = up.clone().multiplyScalar(0.72).addScaledVector(fwd, 0.7);
    z.addScaledVector(y, -z.dot(y)).normalize();
    const x = new THREE.Vector3().crossVectors(y, z);
    const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
    return { pos, q };
  }

  updateCatch(dt) {
    const G = this.grab, crab = G.crab, it = G.it, w = this.world;
    const m = crab.group;
    if (G.phase === 'lift') {
      const k = ease(smoothstep(0, 0.42, G.t));
      const hp = this.heldPose(false, crab);
      m.position.lerpVectors(G.from, hp.pos, k);
      m.position.y += Math.sin(k * Math.PI) * 0.05;
      m.quaternion.slerpQuaternions(G.q0, hp.q, k);
      crab.pose('flail', dt, { speed: 1.2 });
      const wy = w.waterAt(m.position.x, m.position.z, this.t);
      // 水から出た（深い所で持ち上げきれなくても、持ち上げ終わったら数える）
      if (!G.surfaced && (m.position.y > wy || G.t >= 0.42)) {
        G.surfaced = true;
        audio.splash(0.8);
        this.fx.splash(m.position.x, wy, m.position.z, 18, 1.0);
        this.fx.glow(m.position.x, wy - 0.03, m.position.z, 24, 0.1, 1.4);
        this.post.water.ripple(m.position.x, m.position.z, 1.6);
        G.celebrate = this.addCatch({ id: it.id, cm: it.cm, seed: it.seed, pos: m.position.clone() });
        G.dur = it.sp.legend ? 4.2 : G.celebrate ? 2.3 : 0.55;
      }
      if (G.t >= 0.42) { G.phase = 'hold'; G.t = 0; }
    } else if (G.phase === 'hold') {
      const hp = this.heldPose(G.celebrate, crab);
      m.position.lerp(hp.pos, 1 - Math.exp(-14 * dt));
      m.quaternion.slerp(hp.q, 1 - Math.exp(-10 * dt));
      // ぶらぶら暴れる
      m.rotateZ(Math.sin(this.t * 13) * 0.02);
      crab.pose('flail', dt, { speed: 1.3 });
      if (Math.random() < dt * 3) audio.clack(0, 0.5);
      if (Math.random() < dt * 16) {
        const b = new THREE.Box3().setFromObject(m);
        this.fx.drip(lerp(b.min.x, b.max.x, Math.random()), b.min.y, lerp(b.min.z, b.max.z, Math.random()));
        if (Math.random() < 0.25) audio.drip(0, 0.4);
      }
      crab.setWet(1 - smoothstep(0.3, 3, G.t) * 0.5);
      // 右クリックで、すぐ網袋へ（次へ急ぐとき）
      const skip = (this.input.right && !this._rightWas) || this.input.pressed('Space');
      if (G.t > (G.dur ?? 0.55) || (skip && G.t > (it.sp.legend ? 1.5 : 0.15))) { G.phase = 'toss'; G.t = 0; G.from2 = m.position.clone(); }
    } else if (G.phase === 'toss') {
      const k = smoothstep(0, 0.32, G.t);
      const b = this.bag.mouth();
      m.position.lerpVectors(G.from2, b, k);
      m.position.y += Math.sin(k * Math.PI) * 0.12;
      m.scale.setScalar(1 - k * 0.45);
      m.rotateX(dt * 6);
      crab.pose('flail', dt);
      if (k >= 1) {
        this.bag.set(this.catches.length);
        audio.bag(this.catches.length);
        this.scene.remove(m);
        crab.dispose();
        this.grab = null;
        if (this.catches.length === 1) this.later(0.4, () => this.showHint('more', '一匹いたら、まわりにもいる。<b>すぐそば</b>をなでてみよう。', 6));
        if (this.tideT >= 1) this.endSession('tide');
      }
    }
  }

  /** 獲った数を足す。祝うか（大物・初・区切りの数）を返す */
  addCatch({ id, cm, seed, pos = null }) {
    const sp = CRABS[id];
    const value = valueOf(sp, cm);
    const grams = weightOf(sp, cm);
    this.catches = this.catches || [];
    const z = save.zk(id);
    const isNew = !z.caught;
    const record = z.caught > 0 && cm > (z.best || 0);
    this.catches.push({ id, cm, seed, value, isNew, grams });
    this.total = (this.total || 0) + value;
    this.grams = (this.grams || 0) + grams;
    z.caught = (z.caught || 0) + 1;
    z.best = Math.max(z.best || 0, cm);
    save.data.total = (save.data.total || 0) + 1;
    save.write();
    if (this.mode === 'play' || this.mode === 'pinch') this.unlockLegend();
    if (!this.bestToday || cm > this.bestToday.cm) this.bestToday = { id, cm };
    // 連続
    this.combo = this.t - this.lastCatchT < 7 ? this.combo + 1 : 1;
    this.lastCatchT = this.t;
    const n = this.catches.length;
    const big = cm >= sp.size[0] + (sp.size[1] - sp.size[0]) * 0.82;
    const mile = MILESTONES.includes(n);
    const first = n === 1;
    let celebrate = false;
    const card = `<div><div class="tl-card"><img src="${this.ui.thumbs[id] || ''}" alt=""><div class="n">${fullName(sp)} ${cm}cm<small>${isNew ? '図鑑に登録　' : record ? '最大記録！　' : ''}${grams}g</small></div><div class="y">+${yen(value)}</div></div></div>`;
    if (sp.legend) {
      // レジェンド: いつでも大さわぎ
      celebrate = true;
      this.later(0.3, () => {
        audio.celebrate(); audio.taiko(1.9, 0.9, 50); audio.taiko(2.1, 0.9, 50);
        this.ui.telop(`<div class="tl tl-legend">${this.ui.chars('タラバガニ！？', 0.06)}</div><div><span class="tl-sub">${isNew ? 'なんで内の浜に……！　図鑑に登録' : 'また、いた……！'}</span></div>${card}`, 4.2, true);
      });
      if (this.player) this.player.shake = Math.max(this.player.shake, 0.8);
    } else if (first || isNew) {
      celebrate = true;
      this.later(0.3, () => { audio.celebrate(); this.ui.bigShout('獲れたよー！', first && !isNew ? '今夜の一匹目！' : null, card, 2.8); });
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
    this.ui.toast(`<b>${fullName(sp)}</b> ${cm}cm<em>${yen(value)}</em><small>${isNew ? '図鑑に登録！' : record ? '最大記録！' : `${n}匹目`}</small>`, { img: this.ui.thumbs[id], cls: isNew ? 'info' : '', dur: 2.6 });
    return celebrate;
  }

  // ───── 挟まれた「いてー」 ─────
  startPinch(it, side = 'R') {
    const p = this.player;
    let crab;
    if (it.walk) { crab = it.walk.crab; this.walkers.splice(this.walkers.indexOf(it), 1); it.walk = null; }
    else { crab = new Crab(it.id, it.cm, it.seed); this.scene.add(crab.group); }
    it.alive = false;
    this.field.remove(it);
    this.sense.hide(it);
    crab.setWet(1);
    this.grab = null;
    this.stroking = false;
    this.mode = 'pinch';
    const h = this.hand[side];
    this.pinchS = { it, crab, t: 0, side, phase: 'yank', from: h.pos.clone(), sx: 0, lastDir: 0, travel: 0, p: 0, th: 0.5, thV: 0, prevSx: 0, finger: Math.random() < 0.7 ? 0 : 1, shakes: 0 };
    this.ouch++;
    save.data.pinches = (save.data.pinches || 0) + 1;
    save.write();
    this.combo = 0;
    this.ui.setOuch(this.ouch, true);
    this.ui.hurt();
    audio.pinch();
    audio.setStroke(0);
    p.shake = 1.4;
    p.crouchTarget = 0.4;
    p.lookOverride = { yaw: p.yaw, pitch: -0.22, k: 7 };
    const words = ['いてーーっ！！', 'いってぇーー！！', 'いたたたたっ！！', 'ぎゃーーっ！！'];
    const wd = this.ouch >= OUCH_MAX ? 'いってぇーーっ！！' : words[(this.ouch - 1) % words.length];
    const subs = this.ouch === 1 ? ['ハサミに挟まれた！', '指が、指がーっ！', 'はなせーっ！'] : ['また挟まれた！', '指が、指がーっ！', 'はなせーっ！', 'なんでこっちから行ったの！'];
    const sub = it.sp.legend ? 'タラバガニのハサミだ！ とげも痛い！' : it.sp.model === 'ishi' ? 'イシガニだ！ 力が強い！' : subs[Math.floor(Math.random() * subs.length)];
    this.ui.telop(`<div class="tl tl-ouch">${this.ui.chars(wd, 0.035)}</div><div><span class="tl-sub red">${sub}</span></div>`, 2.4);
    const g = this.world.groundAt(h.pos.x, h.pos.z);
    this.fx.sandPuff(h.pos.x, g + 0.01, h.pos.z, 10, 0.08, 1.2);
    this.fx.glow(h.pos.x, g + 0.04, h.pos.z, 26, 0.1, 1.5);
    this.world.murk.add(h.pos.x, h.pos.z, 0.18, 0.15);
    this.later(0.6, () => { if (this.mode === 'pinch') this.ui.shake(true, 0); });
    if (save.data.pinches === 1) this.later(1.4, () => this.showHint('shake', '<b>マウスを左右にぶんぶん</b>振って振りほどけ！', 5));
  }

  /** 挟んでいる指の先（世界） */
  fingerTip(side, i) {
    const hand = this.body.arms[side === 'R' ? 1 : 0].hand;
    const j = hand.fingers[i].joints[2];
    j.updateWorldMatrix(true, false);
    return j.localToWorld(V3(0, 0.016, 0));
  }

  updatePinch(dt) {
    const s = this.pinchS, p = this.player, inp = this.input, cam = this.camera;
    s.t += dt;
    const crab = s.crab, m = crab.group;
    const fwd = V3(0, 0, -1).applyQuaternion(cam.quaternion), up = V3(0, 1, 0).applyQuaternion(cam.quaternion), right = V3(1, 0, 0).applyQuaternion(cam.quaternion);
    const L = crab.W * 0.62 + 0.03;
    if (s.phase === 'yank' || s.phase === 'shake') {
      // 手を振る（マウスの左右・A D の交互）
      const mx = p.mouse ? p.mouse[0] : 0;
      let push = mx * 0.0009;
      for (const k of ['KeyA', 'KeyD']) if (inp.pressed(k)) push += (k === 'KeyA' ? -1 : 1) * 0.06;
      s.sx = clamp(s.sx + push, -0.17, 0.17);
      s.sx *= Math.exp(-dt * 3.2);
      const v = (s.sx - s.prevSx) / Math.max(dt, 1e-3);
      s.prevSx = s.sx;
      if (s.phase === 'shake') {
        const dir = Math.sign(v);
        if (Math.abs(v) > 0.25) {
          if (dir !== s.lastDir) { if (s.travel > 0.07) { s.shakes++; s.p += 0.2 + (crab.sp.pinch > 1.5 ? -0.05 : 0); audio.shake(1); this.player.shake = Math.max(this.player.shake, 0.35); s.thV += dir * 5; } s.travel = 0; s.lastDir = dir; }
          s.travel += Math.abs(v) * dt;
        }
        this.ui.shake(true, s.p);
      }
      // 手の位置: 顔の前へ引き上げて、左右に振る
      const target = cam.position.clone().addScaledVector(fwd, 0.42).addScaledVector(up, 0.1).addScaledVector(right, 0.06 + s.sx);
      const h = this.hand[s.side];
      const k = ease(smoothstep(0, 0.28, s.t));
      // 手の甲をこちらへ、指を上へ（挟まれた指の先から、カニがぶら下がる）
      h.override = { pos: s.from.clone().lerp(target, k), palm: fwd.clone().multiplyScalar(0.9).addScaledVector(right, -0.25).normalize(), fwd: up.clone().multiplyScalar(-0.35).addScaledVector(right, s.side === 'R' ? -0.9 : 0.9).normalize(), pose: s.finger === 0 ? 'pinched' : 'pinched2' };
      if (s.phase === 'yank' && s.t > 0.28) s.phase = 'shake';
      // ぶら下がったカニ（振り子）: 手を横に振った加速で揺れる
      const ah = clamp((v - (s.prevV || 0)) / Math.max(dt, 1e-3), -60, 60);
      s.prevV = v;
      s.thV += (-9.8 / L * Math.sin(s.th) - ah / L * Math.cos(s.th) * 0.5) * dt;
      s.thV *= Math.exp(-dt * 1.2);
      s.th = clamp(s.th + s.thV * dt, -1.3, 1.3);
      const tip = this.fingerTip(s.side, s.finger);
      const dirDown = up.clone().multiplyScalar(-Math.cos(s.th)).addScaledVector(right, Math.sin(s.th));
      // 向き: 前（ハサミ）を上（指の方）へ、背中をこちらへ
      const z = dirDown.clone().multiplyScalar(-1);
      const y = fwd.clone().multiplyScalar(-1);
      y.addScaledVector(z, -y.dot(z)).normalize();
      const x = new THREE.Vector3().crossVectors(y, z);
      m.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
      // 挟んでいる側のハサミは閉じ、もう片方は振り回す
      crab.pose('flail', dt, { speed: 1.6, open: [0.35 + 0.3 * Math.sin(this.t * 9), 0.02] });
      // ハサミの先が指先に来るように、体ごとずらす
      m.position.copy(tip).addScaledVector(dirDown, L);
      m.updateMatrixWorld(true);
      const ct = crab.clawTip(-1);
      m.position.add(tip.clone().sub(ct));
      if (Math.random() < dt * 5) audio.clack(0, 0.7);
      if (Math.random() < dt * 12) this.fx.drip(m.position.x, m.position.y - 0.03, m.position.z);
      // 振りほどいた／あきらめて離した
      if (s.p >= 1 || s.t > 5.5) this.releasePinch(v);
    } else if (s.phase === 'fly') {
      const F = s.fly;
      F.t += dt;
      if (F.toBag) {
        const k = smoothstep(0, 0.5, F.t);
        const b = this.bag.mouth();
        m.position.lerpVectors(F.from, b, k);
        m.position.y += Math.sin(k * Math.PI) * 0.22;
        m.rotateZ(dt * 12);
        m.scale.setScalar(1 - k * 0.4);
        if (k >= 1) this.finishPinch(true);
      } else {
        F.vel.y -= 9.8 * dt;
        m.position.addScaledVector(F.vel, dt);
        m.rotateX(dt * 9); m.rotateZ(dt * 5);
        const wy = this.world.waterAt(m.position.x, m.position.z, this.t);
        if (m.position.y < wy) {
          this.fx.splash(m.position.x, wy, m.position.z, 20, 1.1);
          this.fx.glow(m.position.x, wy - 0.02, m.position.z, 30, 0.14, 1.5);
          this.post.water.ripple(m.position.x, m.position.z, 2);
          audio.splash(0.9);
          this.finishPinch(false);
        }
      }
      crab.pose('flail', dt, { speed: 1.8 });
      const h = this.hand[s.side];
      const target = cam.position.clone().addScaledVector(fwd, 0.4).addScaledVector(up, 0.0).addScaledVector(right, 0.06);
      h.override = { pos: h.pos.clone().lerp(target, 0.2), palm: fwd.clone(), fwd: up.clone(), pose: 'splay' };
    }
  }

  releasePinch(v) {
    const s = this.pinchS, m = s.crab.group, cam = this.camera;
    this.ui.shake(false);
    audio.fling();
    const right = V3(1, 0, 0).applyQuaternion(cam.quaternion), fwd = V3(0, 0, -1).applyQuaternion(cam.quaternion);
    const dir = Math.sign(v || s.sx || (Math.random() - 0.5));
    // 振りほどけたら、4 割は網袋に飛びこむ（結果オーライ）。時間切れで離したら水へ
    const toBag = s.p >= 1 && Math.random() < 0.4;
    s.phase = 'fly';
    s.fly = { t: 0, toBag, from: m.position.clone(), vel: right.clone().multiplyScalar(dir * 2.2).addScaledVector(fwd, 1.2).add(V3(0, 1.6, 0)) };
    this.player.lookOverride = null;
  }

  finishPinch(toBag) {
    const s = this.pinchS, it = s.it;
    this.scene.remove(s.crab.group);
    s.crab.dispose();
    const hand = this.body.arms[s.side === 'R' ? 1 : 0].hand;
    this.hand[s.side].override = null;
    this.pinchS = null;
    this.mode = 'play';
    this.player.lookOverride = null;
    if (toBag) {
      this.addCatch({ id: it.id, cm: it.cm, seed: it.seed });
      this.bag.set(this.catches.length);
      audio.bag(this.catches.length);
      this.later(0.15, () => this.ui.telop('<div class="tl tl-ok">結果オーライ！</div><div><span class="tl-sub">網袋に飛びこんだ</span></div>', 1.8));
    } else {
      this.later(0.1, () => this.ui.telop(`<div class="tl tl-catch" style="-webkit-text-stroke-color:#3a4a6a">逃げられた…</div>`, 1.4, true));
    }
    // 挟まれた指に絆創膏
    this.later(toBag ? 1.2 : 0.8, () => {
      hand.addBandaid(s.finger);
      audio.bandaid();
      if (this.ouch >= OUCH_MAX) this.goHome();
      else if (this.ouch === OUCH_MAX - 1) this.ui.toast('<b>指がもう限界</b><small>あと 1 回挟まれたら、帰る</small>', { cls: 'bad', icon: '🩹', dur: 4 });
    });
  }

  // ───── もう帰るぅ… ─────
  goHome() {
    if (this.ending) return;
    this.ending = true;
    this.mode = 'ending';
    this.noPause = true;
    this.stroking = false;
    this.grab = null;
    audio.setStroke(0);
    this.ui.prompt('');
    this.ui.shake(false);
    this.sense.setReticle(false);
    const p = this.player;
    p.crouchTarget = 0;
    p.lookOverride = { yaw: p.yaw + 0.25, pitch: 0.28, k: 0.9 };
    this.later(0.5, () => { audio.sadTrombone(); this.ui.telop(`<div class="tl tl-home">${this.ui.chars('もう帰るぅ…', 0.12)}</div><div><span class="tl-sub blue">指が、もう、限界</span></div>`, 3.4); });
    this.later(4.2, () => this.endSession('pinch'));
  }
  updateEnding(dt) { void dt; }

  // ───── 砂の上を歩くカニ・逃げるカニ ─────
  updateWalkers(dt) {
    const p = this.player, w = this.world, f = this.field;
    // 「いてっ」の後、しばらくして逃げ出す
    if (this.mode === 'play') {
      for (const o of this.sense.active) {
        const it = o.it;
        if (it.alive && it.fleeAt && this.t > it.fleeAt && !it.walk && !(this.grab && this.grab.it === it)) { it.fleeAt = 0; this.spawnWalker(it, true); }
      }
      // ときどき、群れ場のカニが砂から出て歩く（前の方、2〜7m）
      this.nextWalker -= dt;
      if (this.nextWalker <= 0 && this.walkers.length < 5) {
        this.nextWalker = rand(2.5, 6);
        const fw = p.forward;
        let pick = null;
        for (let k = 0; k < 20 && !pick; k++) {
          const d = rand(2, 6.5), a = rand(-0.8, 0.8);
          const x = p.pos.x + (fw.x * Math.cos(a) - fw.z * Math.sin(a)) * d, z = p.pos.z + (fw.z * Math.cos(a) + fw.x * Math.sin(a)) * d;
          const it = f.nearest(x, z, 1.2);
          if (it && !it.walk && !this.sense.isRevealed(it)) pick = it;
        }
        if (pick) this.spawnWalker(pick, false);
      }
    }
    for (const it of [...this.walkers]) {
      const W = it.walk, crab = W.crab, m = crab.group;
      W.t += dt;
      const g = w.groundAt(it.x, it.z);
      const d = Math.hypot(it.x - p.pos.x, it.z - p.pos.z);
      // 照らされた／近づかれたら逃げる
      if (!W.flee && (d < 1.1 || (d < 2.4 && this.lit(it.x, g, it.z) > 0.6 && W.t > 1.2))) {
        W.flee = true; W.t2 = 0; W.speed = rand(0.5, 0.75) * (crab.king ? 0.55 : 1); W.threatT = rand(0.5, 0.9) * (crab.king ? 2 : 1);
        // 人から遠い方の横へ
        const lx = Math.cos(it.yaw), lz = -Math.sin(it.yaw);
        W.dir = (it.x - p.pos.x) * lx + (it.z - p.pos.z) * lz > 0 ? 1 : -1;
      }
      if (W.phase === 'rise') {
        const k = smoothstep(0, 0.5, W.t);
        m.position.set(it.x, g - crab.H * (1 - k) + crab.standH * k, it.z);
        crab.pose('idle', dt);
        if (W.t > 0.5) { W.phase = 'walk'; W.t2 = 0; }
      } else if (W.phase === 'walk') {
        W.t2 += dt;
        // 見つかったら、まずハサミをふり上げて威嚇。それから逃げる
        const threat = W.flee && W.threatT > 0;
        if (threat) { W.threatT -= dt; W.t2 = 0; }
        const sp = threat ? 0 : W.flee ? W.speed : crab.king ? 0.06 : 0.1;
        const lx = Math.cos(it.yaw), lz = -Math.sin(it.yaw);
        const nx = it.x + lx * W.dir * sp * dt, nz = it.z + lz * W.dir * sp * dt;
        const depth = w.tide - w.groundAt(nx, nz);
        if (depth > 0.05 && depth < 0.6) { it.x = nx; it.z = nz; f.moved(it); }
        else W.dir *= -1;
        it.yaw += Math.sin(this.t * 0.7 + it.seed * 9) * dt * 0.3;
        m.position.set(it.x, w.groundAt(it.x, it.z) + crab.standH, it.z);
        m.rotation.set(0, it.yaw, 0);
        crab.pose(threat ? 'threat' : 'walk', dt, { v: W.dir * sp });
        if (Math.random() < dt * (W.flee ? 14 : 2)) {
          this.fx.sandPuff(it.x, m.position.y - 0.02, it.z, 2, 0.05, 0.4);
          if (W.flee) this.fx.glow(it.x, m.position.y, it.z, 2, 0.05, 0.9);
        }
        if (this.sense.isRevealed(it)) this.sense.reveal(it, 1.8);
        if (this.lit(it.x, g, it.z) > 0.25) W.seen = true;
        if ((W.flee && W.t2 > W.fleeT) || (!W.flee && W.t2 > W.life)) { W.phase = 'bury'; W.t = 0; }
      } else if (W.phase === 'bury') {
        const k = smoothstep(0, 0.45, W.t);
        m.position.set(it.x, g + crab.standH * (1 - k) - crab.H * 0.9 * k, it.z);
        crab.pose('rest', dt);
        if (Math.random() < dt * 20) this.fx.sandPuff(it.x, g + 0.01, it.z, 2, 0.06, 0.5);
        if (W.t > 0.45) { it.anger *= 0.5; this.dropWalker(it); }
      }
    }
  }
  spawnWalker(it, flee) {
    const crab = new Crab(it.id, it.cm, it.seed);
    this.scene.add(crab.group);
    crab.group.position.set(it.x, this.world.groundAt(it.x, it.z) - crab.H, it.z);
    crab.group.rotation.set(0, it.yaw, 0);
    it.walk = { crab, t: 0, t2: 0, phase: 'rise', flee, speed: flee ? rand(0.7, 1.0) : 0.1, dir: Math.random() < 0.5 ? 1 : -1, life: rand(3, 6), fleeT: rand(0.9, 1.6), seen: false };
    this.walkers.push(it);
    this.fx.sandPuff(it.x, this.world.groundAt(it.x, it.z) + 0.01, it.z, 6, 0.08, 0.8);
    if (flee) {
      audio.clack(0, 0.5); audio.clack(0.06, 0.5);
      this.popWord('あっ、逃げた！', V3(it.x, this.world.groundAt(it.x, it.z) + 0.05, it.z), 'miss');
      this.showHint('flee', 'もたもたしていると、カニは<b>横歩きで逃げる</b>。見えているうちに突っ込め！', 5);
    }
  }
  dropWalker(it) {
    const W = it.walk;
    if (!W) return;
    this.scene.remove(W.crab.group);
    W.crab.dispose();
    it.walk = null;
    const i = this.walkers.indexOf(it);
    if (i >= 0) this.walkers.splice(i, 1);
  }
  /** ヘッドライトの当たり具合（0..） */
  lit(x, y, z) {
    const U = this.world.head;
    const v = V3(x, y, z).sub(U.position);
    const d2 = Math.max(v.lengthSq(), 0.01);
    const dir = U.target.position.clone().sub(U.position).normalize();
    const c = v.normalize().dot(dir);
    return c > Math.cos(U.angle) ? U.intensity / Math.pow(d2, 0.7) * smoothstep(Math.cos(U.angle), Math.cos(U.angle * 0.5), c) : 0;
  }

  // ───── 手と体 ─────
  updateHands(dt) {
    const p = this.player, w = this.world;
    this.updateGrab(dt);
    const f = p.forward, r = V3(-f.z, 0, f.x);
    const G = this.grab;
    const crouchK = smoothstep(0.35, 0.85, p.crouch);
    for (const key of ['L', 'R']) {
      const h = this.hand[key], sg = h.sg;
      h.flinch = Math.max(0, h.flinch - dt);
      let pos, palm, fwd, pose;
      if (h.override && this.mode === 'pinch' && this.pinchS?.side === key) {
        ({ pos, palm, fwd, pose } = h.override);
      } else if (G && G.side === key) {
        // 突っ込む手
        const T = G.T;
        if (G.phase === 'dive') {
          const k = smoothstep(0, 0.14, G.t);
          const above = V3(T.x, T.y + 0.07, T.z);
          pos = G.from.clone().lerp(above, ease(k));
          if (G.t > 0.14) pos = above.clone().lerp(V3(T.x, T.y - 0.025, T.z), smoothstep(0.14, 0.2, G.t));
          palm = V3(0, -1, 0); fwd = f.clone().addScaledVector(r, sg * 0.25).normalize(); pose = G.t > 0.15 ? 'grab' : 'flat';
        } else if (G.phase === 'miss') {
          pos = V3(T.x, T.y + smoothstep(0, 0.35, G.t) * 0.08 - 0.02, T.z);
          palm = V3(0, -1, 0); fwd = f.clone(); pose = 'grab';
        } else {
          // カニの甲羅の後ろのふちをつかむ（親指は下、指は甲羅の上へかぶせる）
          const m = G.crab.group;
          const cz = V3(0, 0, 1).applyQuaternion(m.quaternion), cy = V3(0, 1, 0).applyQuaternion(m.quaternion);
          pos = m.position.clone().addScaledVector(cz, -(G.crab.L * 0.5 + 0.04)).addScaledVector(cy, -0.004);
          palm = cz.clone().multiplyScalar(0.85).addScaledVector(cy, -0.35).normalize();
          fwd = cy.clone().multiplyScalar(0.8).addScaledVector(cz, 0.45).normalize();
          pose = 'grab';
        }
      } else if (G && (G.phase === 'lift' || G.phase === 'hold' || G.phase === 'toss')) {
        // もう片方の手は、体のわきへ下ろしておく
        pos = p.pos.clone().add(V3(0, 0.5, 0)).addScaledVector(f, 0.12).addScaledVector(r, sg * 0.24);
        palm = r.clone().multiplyScalar(-sg); fwd = V3(0, -1, 0); pose = 'rest';
      } else {
        // なでる手（右は時計回り、左はその反対。そろえて）
        const ph = this.phase;
        const ox = sg * Math.cos(ph), oy = -Math.sin(ph);
        const c = p.pos.clone().addScaledVector(f, 0.5).addScaledVector(r, sg * 0.17);
        const sp = c.clone().addScaledVector(r, ox * 0.1).addScaledVector(f, oy * 0.1);
        const g = w.groundAt(sp.x, sp.z);
        const hover = this.stroking ? 0 : 0.06;
        sp.y = g + 0.013 + hover + (h.flinch > 0 ? Math.sin((h.flinch / 0.42) * Math.PI) * 0.09 : 0);
        if (h.flinch > 0) { sp.addScaledVector(r, Math.sin(this.t * 60) * 0.01); }
        const rest = p.pos.clone().add(V3(0, 0.62 - p.crouch * 0.2, 0)).addScaledVector(f, 0.08).addScaledVector(r, sg * 0.2);
        const k = Math.max(this.strokeK, crouchK * 0.9);
        pos = rest.lerp(sp, k);
        const palmR = r.clone().multiplyScalar(-sg);
        palm = palmR.lerp(V3(0, -1, 0), k).normalize();
        const fwdS = f.clone().addScaledVector(r, sg * 0.28).normalize();
        fwd = V3(0, -1, 0).lerp(fwdS, k).normalize();
        pose = k > 0.5 ? (h.flinch > 0 ? 'splay' : 'flat') : 'rest';
      }
      if (!h.init) { h.pos.copy(pos); h.init = true; }
      h.lastPos.copy(h.pos);
      const rate = G && G.side === key ? 40 : this.mode === 'pinch' ? 30 : 22;
      h.pos.lerp(pos, 1 - Math.exp(-rate * dt));
      h.palm.copy(palm); h.fwd.copy(fwd); h.pose = pose;
      h.speed = lerp(h.speed, h.pos.distanceTo(h.lastPos) / Math.max(dt, 1e-3), 1 - Math.exp(-10 * dt));
      // 水の中をかき回すと夜光虫が光り、水面に波紋
      const wy = w.waterAt(h.pos.x, h.pos.z, this.t);
      if (h.pos.y < wy - 0.02 && h.speed > 0.15) {
        if (Math.random() < dt * 30 * Math.min(1, h.speed)) this.fx.glow(h.pos.x, h.pos.y + 0.01, h.pos.z, 1, 0.05, 1);
        h.ripT = (h.ripT || 0) - dt;
        if (h.ripT <= 0) { h.ripT = 0.22; this.post.water.ripple(h.pos.x, h.pos.z, 0.35); }
        h.murkT = (h.murkT || 0) - dt;
        if (h.murkT <= 0 && this.stroking) { h.murkT = 0.3; w.murk.add(h.pos.x, h.pos.z, 0.07, 0.025); }
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
    // 足もとの水のさざめき
    audio.setLap(clamp((p.waterY - this.world.tide) / 0.15, 0, 1) * smoothstep(0.05, 0.3, p.depth));
    // 歩くと足もとも光る
    if (p.speed > 0.2 && p.depth > 0.05 && Math.random() < dt * 20 * p.speed) {
      const fw = p.forward;
      this.fx.glow(p.pos.x + fw.x * 0.1 + (Math.random() - 0.5) * 0.2, p.pos.y + 0.03, p.pos.z + fw.z * 0.1 + (Math.random() - 0.5) * 0.2, 2, 0.08, 1);
    }
  }

  popWord(text, pos, cls) {
    const v = pos.clone ? pos.clone().project(this.camera) : V3(pos.x, pos.y, pos.z).project(this.camera);
    if (v.z < 1) this.ui.word(text, (v.x + 1) / 2 * innerWidth / this.hz, (1 - v.y) / 2 * innerHeight / this.hz - 20, cls);
  }

  // ───── HUD ─────
  updateHud() {
    const mins = 20 * 60 + 30 + this.tideT * 30;
    const clock = `${Math.floor(mins / 60)}:${String(Math.floor(mins % 60)).padStart(2, '0')}`;
    const left = Math.max(0, SESSION * (1 - this.tideT));
    const bt = this.bestToday;
    this.ui.updateHud({
      clock, left: left > 0 ? `潮が満ちるまで ${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}` : '満ち潮',
      tideT: this.tideT, bagN: this.catches.length, kg: kg(this.grams || 0), bagBest: bt ? `いちばん ${bt.cm}cm` : '',
      total: this.total, combo: this.t - this.lastCatchT < 7 ? this.combo : 0,
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
    audio.setStroke(0);
    if (reason === 'tide') { this.ui.telop('<div class="tl tl-catch">満ち潮</div><div><span class="tl-sub blue">今夜は、ここまで</span></div>', 1.6); await new Promise((r) => setTimeout(r, 1200)); }
    this.ui.fade(true);
    await new Promise((r) => setTimeout(r, 900));
    this.clearScene();
    this.input.unlock();
    this.mode = 'results';
    this.ui.showHud(false);
    this.body.group.visible = false;
    this.bag.group.visible = false;
    const catches = this.catches || [];
    this.setupResults(catches);
    this.resultsCam(0, true);
    audio.setAmbience('results');
    audio.setMusic('results');
    await new Promise((r) => setTimeout(r, 300));
    this.ui.fade(false);
    this.endingNow = false;

    // 種類ごとにまとめる
    const groups = {};
    for (const c of catches) {
      const g = groups[c.id] || (groups[c.id] = { id: c.id, n: 0, value: 0, grams: 0, best: 0, isNew: false });
      g.n++; g.value += c.value; g.grams += c.grams; g.best = Math.max(g.best, c.cm); g.isNew = g.isNew || c.isNew;
    }
    const items = Object.values(groups).sort((a, b) => b.value - a.value).map((g) => {
      const sp = CRABS[g.id];
      return { id: g.id, n: g.n, dish: sp.dish, label: `${fullName(sp)}　最大 ${g.best}cm・${kg(g.grams)}`, value: g.value, isNew: g.isNew };
    });
    const n = catches.length;
    const total = this.total || 0;
    const legendTonight = catches.some((c) => CRABS[c.id].legend);
    const rank = legendTonight ? LEGEND_RANK : [...RANKS].reverse().find((r) => n >= r.min);
    const news = [];
    const stashed = stashCatch(catches);
    if (stashed) news.push(`${stashed}匹のカニを持ち物に入れた`);
    save.data.days = this.day;
    if (n > save.data.best && n > 0) { news.push('一晩の最高記録！'); save.data.best = n; save.data.bestRank = rank.title; }
    if (total > (save.data.bestValue || 0)) save.data.bestValue = total;
    const fresh = catches.filter((c) => c.isNew).map((c) => fullName(CRABS[c.id]));
    if (fresh.length) news.push(`図鑑に登録: ${[...new Set(fresh)].join('・')}`);
    if (this.legendNews) news.push(`レジェンド開放: ${this.legendNews}、タラバガニが出現`);
    save.write();
    const why = reason === 'pinch' ? '「いてー」が5回。もう帰るぅ…' : reason === 'quit' ? '浜から上がった。' : '潮が満ちて、今夜はおしまい。';
    const stats = [['いてっ', `${this.pricks}回`], ['いてー', `${this.ouch}回`], ['突っ込んだ', `${this.plunges}回`]];
    // 次の夜のために砂の中を入れかえる
    this.newField(this.day + 1);
    await this.ui.results({ day: this.day, why, count: n, grams: this.grams || 0, items, total, rank, news, stats });
  }

  // 獲れたカニを、ランタンのそばの浜に放して歩かせる（大きい順に最大 12 匹。種類はなるべくまぜる）
  // 右側は結果の紙が重なるので、カニは画面の左側の浜で歩かせる
  setupResults(catches) {
    const w = this.world, bd = this.backdrop;
    const P = bd.campSpot.clone();
    w.tide = 0.12;
    const home = V3(P.x - 0.55, 0, P.z + 0.55);
    this.resultSpot = P;
    this.resultHome = home;
    this.resultR = 0.95;
    this.resultAvoid = [{ x: P.x + 0.62, z: P.z - 0.3, r: 0.36 }, { x: P.x - 0.42, z: P.z - 0.5, r: 0.12 }];
    const sorted = [...catches].sort((a, b) => b.cm - a.cm);
    const list = [];
    for (const id of ['taraba', 'taiwanM', 'taiwanF', 'ishigani']) { const c = sorted.find((x) => x.id === id); if (c) list.push(c); }
    for (const c of sorted) { if (list.length >= 12) break; if (!list.includes(c)) list.push(c); }
    const rng = new RNG(this.day * 31 + list.length);
    const placed = [];
    this.resultCrabs = list.map((c) => {
      const crab = new Crab(c.id, c.cm, c.seed, { wet: 0.55 });
      this.scene.add(crab.group);
      let x = 0, z = 0;
      for (let k = 0; k < 40; k++) {
        const a = rng.range(0, Math.PI * 2), r = Math.sqrt(rng.next()) * this.resultR * 0.9;
        x = home.x + Math.cos(a) * r; z = home.z + Math.sin(a) * r * 0.75;
        if (this.resultAvoid.some((o) => Math.hypot(x - o.x, z - o.z) < o.r + 0.1)) continue;
        if (placed.some((q) => Math.hypot(x - q.x, z - q.z) < (q.R + crab.R) * 0.8)) continue;
        break;
      }
      placed.push({ x, z, R: crab.R });
      return { crab, x, z, yaw: rng.range(0, Math.PI * 2), dir: 1, v: 0, mode: rng.next() < 0.25 ? 'threat' : 'walk', timer: rng.range(0.3, 2.5), calm: rng.range(0, 2) };
    });
    this.updateWanderers(this.resultCrabs, home, this.resultR, 0, this.resultAvoid);
    this.resultCenter = V3(home.x, w.groundAt(home.x, home.z) + 0.05, home.z);
    bd.lanternLight.intensity = 2.6;
  }
  resultsCam(dt, init) {
    const cam = this.camera;
    if (init) this.resT = 0;
    this.resT += dt;
    const c = this.resultCenter || this.resultSpot;
    const k = smoothstep(0, 6, this.resT);
    // 海の側の低い所から、浜を歩くカニと、その向こうのランタン・クーラーボックスを見る
    // （見る所をカニの群れより右へずらし、群れが画面の左に来るように）
    const a = -0.12 + this.resT * 0.015;
    const R = lerp(1.9, 1.6, k);
    cam.position.set(c.x + Math.sin(a) * R + 0.35, c.y + lerp(0.85, 0.7, k), c.z + Math.cos(a) * R);
    cam.lookAt(c.x + 0.85, c.y - 0.05, c.z - 0.35);
    cam.fov = 50;
    cam.updateProjectionMatrix();
  }
}

const tick = () => new Promise((r) => setTimeout(r, 0));
