// しゃぼん玉日和：起動と毎フレームの処理
import * as THREE from 'three';
import { generateWorld } from './world/gen.js';
import { buildWorldTextures, buildNoiseTexture } from './render/worldtex.js';
import { bakeSky, skySH, skyTexture } from './render/sky.js';
import { Terrain, buildFarTerrain } from './render/terrain.js';
import { Post } from './render/post.js';
import { Shadows } from './render/shadows.js';
import { buildCloudCoverage, Clouds } from './render/clouds.js';
import { Wind } from './sim/wind.js';
import { Water } from './render/water.js';
import { Trees } from './render/trees.js';
import { buildLeafAtlas, loadLeafAtlas } from './render/leaves.js';
import { Grass } from './render/grass.js';
import { buildBuildings, buildWires } from './render/buildings.js';
import { BubbleRenderer } from './render/bubbles.js';
import { buildWand } from './render/wand.js';
import { Particles } from './render/particles.js';
import { buildKoinobori } from './render/koinobori.js';
import { buildBirds } from './render/birds.js';
import { buildRocks } from './render/rocks.js';
import { buildWaterfall } from './render/waterfall.js';
import { buildCliff } from './render/cliff.js';
import { Fauna } from './sim/fauna.js';
import { Birds } from './sim/fauna_birds.js';
import { Butterflies } from './render/butterflies.js';
import { FaunaMore } from './sim/fauna_more.js';
import { SP } from './world/gen.js';
import { Profiler } from './render/profiler.js';
import { Ambient } from './audio/ambient.js';
import { Flight } from './sim/flight.js';
import { Director, makeSpots } from './sim/director.js';
import { HOUSES, OUTBUILDINGS, KNOLL, SHRINE, BRIDGE, POND, riverZ, RIDGE, snowRange } from './world/layout.js';
import { T as TT } from './world/gen.js';

const params = new URLSearchParams(location.search);
const DEV = params.has('dev');
// 書き出しモード：固定の時間刻み・決まった乱数で1コマずつ描いて送る
const CAPTURE = params.has('capture');
if (CAPTURE) {
  let a = (Number(params.get('seed') || 1) * 2654435761) >>> 0;
  Math.random = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
// 起動の段階ごとの時刻（重い所を調べる用）
const mark = (s) => (window.__boot ||= []).push([s, Math.round(performance.now())]);
const status = (s) => { mark(s || '(ready)'); const el = document.getElementById('status'); if (el) el.textContent = s; };
mark('modules');
// 次の描画を一度はさんでから続ける（読み込み中の文字が固まって見えないように）。描画が止まっている画面では0.1秒で進む
const tick = () => new Promise((r) => { let done = false; const go = () => { if (!done) { done = true; setTimeout(r, 0); } }; requestAnimationFrame(go); setTimeout(go, 100); });

window.addEventListener('error', (e) => { window.__fatal = String(e.message || e); });
window.addEventListener('unhandledrejection', (e) => { window.__fatal = String(e.reason && e.reason.stack || e.reason); });

const app = {
  ready: false,
  frames: 0,
  _waiters: [],
  debug: null,
  waitFrames(n) { return new Promise((res) => this._waiters.push({ at: this.frames + n, res })); },
  measure(sec) {
    return new Promise((res) => {
      const t0 = performance.now(), f0 = this.frames;
      const times = [];
      let last = t0;
      const step = () => {
        const t = performance.now(); times.push(t - last); last = t;
        if (t - t0 < sec * 1000) requestAnimationFrame(step);
        else {
          times.sort((a, b) => a - b);
          res({ fps: ((this.frames - f0) / ((t - t0) / 1000)).toFixed(1), p50: times[times.length >> 1].toFixed(1), p90: times[Math.floor(times.length * 0.9)].toFixed(1), res: [app.w, app.h] });
        }
      };
      requestAnimationFrame(step);
    });
  },
};
window.__app = app;

async function boot() {
  const canvas = document.getElementById('c');
  // WebGL2 がない環境
  const probe = document.createElement('canvas').getContext('webgl2');
  if (!probe) { status('この端末のブラウザでは表示できません（WebGL2 が必要です）'); return; }
  // 触って操作する小さな画面は軽い設定
  const LITE = params.has('lite') || ((navigator.maxTouchPoints || 0) > 0 && Math.min(screen.width, screen.height) < 900);
  app.lite = LITE;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, stencil: false, powerPreference: 'high-performance', reversedDepthBuffer: true, preserveDrawingBuffer: CAPTURE });
  renderer.autoClear = false;
  renderer.setPixelRatio(1);
  const reversed = renderer.state.buffers.depth.getReversed() || renderer.capabilities.reversedDepthBuffer === true;
  const gl = renderer.getContext();
  const REV = !!gl.getExtension('EXT_clip_control');
  console.log('reversed depth', REV, 'float linear', !!gl.getExtension('OES_texture_float_linear'));
  void reversed;

  // 葉の絵（焼いた画像）は地形をつくる間に読み込む
  const atlasP = loadLeafAtlas('assets/leaves.png').catch((e) => { console.warn('leaf atlas fallback', e); return null; });
  status('地形をつくっています');
  await tick();
  const world = generateWorld((s) => DEV && console.log(s));
  app.world = world;
  status('田んぼに水を張っています');
  await tick();
  const wtex = buildWorldTextures(world);

  const sunDir = new THREE.Vector3(-0.36, 0.78, 0.51).normalize();
  const sky = bakeSky([sunDir.x, sunDir.y, sunDir.z], { haze: 3.2 });
  const { sh, ground } = skySH(sky, [sunDir.x, sunDir.y, sunDir.z]);
  const wind = new Wind(Math.random());

  const shared = {
    uTime: { value: 0 },
    uFrame: { value: 0 },
    uSunDir: { value: sunDir },
    uSunCol: { value: new THREE.Vector3(...sky.sunColor) },
    uSH: { value: sh },
    uWind: { value: new THREE.Vector4(1, 0, 1.5, 0.8) },
    uWindOff: { value: new THREE.Vector2() },
    uCloudOff: { value: new THREE.Vector2() },
    uCloud: { value: new THREE.Vector4(1250, 2350, 0.5, 12000) },
    uFog: { value: new THREE.Vector4(0.00024, 0.0015, 0, 0) },
    uFogCol: { value: new THREE.Vector3(...sky.fogColor) },
    uFogSun: { value: new THREE.Vector3(...sky.sunColor).multiplyScalar(0.18) },
    uWorld: { value: new THREE.Vector4(world.ORIGIN, world.CELL, world.N, 0) },
    uGroundCol: { value: new THREE.Vector3(...ground) },
    tHW: { value: wtex.tHW },
    tNoise: { value: buildNoiseTexture() },
    tCloudCov: { value: buildCloudCoverage() },
    tSky: { value: skyTexture(sky) },
  };
  const textures = { tNorm: { value: wtex.tNorm }, tMatA: { value: wtex.tMatA }, tMatB: { value: wtex.tMatB }, tMatC: { value: wtex.tMatC }, tFlow: { value: wtex.tFlow }, tSdf: { value: wtex.tSdf }, tType: { value: wtex.tType } };
  app.shared = shared;

  const shadows = new Shadows(renderer, shared, REV);
  const scene = new THREE.Scene();
  const terrain = new Terrain(world, shared, textures);
  scene.add(terrain.group);
  terrain.levels.forEach((l) => { l.mesh.userData.nearShadow = false; });
  const far = buildFarTerrain(shared);
  scene.add(far);
  status('木を植えています');
  await tick();
  const atlas = (await atlasP) || buildLeafAtlas(2048);
  mark('atlas');
  app.atlas = atlas;
  const trees = new Trees(world, shared, atlas.tex);
  mark('trees');
  scene.add(trees.group);
  app.trees = trees;
  const grass = new Grass(world, shared, textures, LITE);
  mark('grass');
  scene.add(grass.group);
  const groundAt = (x, z) => {
    const N = world.N, fi = Math.min(N - 1.001, Math.max(0, (x - world.ORIGIN) / world.CELL)), fj = Math.min(N - 1.001, Math.max(0, (z - world.ORIGIN) / world.CELL));
    const i = Math.floor(fi), j = Math.floor(fj), u = fi - i, v = fj - j, k = j * N + i, H = world.height;
    return (H[k] * (1 - u) + H[k + 1] * u) * (1 - v) + (H[k + N] * (1 - u) + H[k + N + 1] * u) * v;
  };
  app.groundAt = groundAt;
  status('家を建てています');
  await tick();
  const bld = buildBuildings(shared, world, groundAt);
  scene.add(bld.mesh);
  const wires = buildWires(shared, bld.poles);
  scene.add(wires);
  const wand = buildWand(shared);
  scene.add(wand);
  // 鯉のぼり（h2の庭）
  const h2 = HOUSES.find((h) => h.id === 'h2');
  const kc = Math.cos(h2.rot), ks = Math.sin(h2.rot);
  const kx = h2.x + (-9.5) * kc + 8.5 * ks, kz = h2.z - (-9.5) * ks + 8.5 * kc;
  const koiBase = new THREE.Vector3(kx, groundAt(kx, kz) - 0.3, kz);
  scene.add(buildKoinobori(shared, koiBase));
  status('生きものを放しています');
  await tick();
  // 滝の崖（一続きの岩の面）。生き物より先に作る：崖に埋まった岩に印が付き、セキレイの止まり場所から外れる
  const cliff = buildCliff(shared, world);
  scene.add(cliff);
  // 生き物（白鷺・スズメ・セキレイ・ツバメ・鳶・カルガモ・カエル・魚・ウサギ・鹿）と蝶
  const fauna = new Fauna({ shared, world, groundAt, poles: bld.poles, rings: (x, z, st) => pushRing(x, z, st) });
  const faunaG = new THREE.Group();
  for (const m of fauna.meshes) faunaG.add(m);
  scene.add(faunaG);
  app.fauna = fauna;
  // 鳥（第2弾）：アオサギ・カワセミ・キジ・カラス・キジバト・メジロ・シジュウカラ・ヒバリ・ウグイス・ムクドリ・ヒヨドリ
  const birds2 = new Birds({ shared, world, groundAt, poles: bld.poles, trees, rings: (x, z, st) => pushRing(x, z, st) });
  scene.add(birds2.group);
  app.birds2 = birds2;
  // 生きもの（追加分）：キツネ・タヌキ・リス・ニワトリ・ネコ・カメ・アメンボ・オタマジャクシ
  const fauna3 = new FaunaMore({ shared, world, groundAt, rings: (x, z, st) => pushRing(x, z, st) });
  const fauna3G = new THREE.Group();
  for (const m of fauna3.meshes) fauna3G.add(m);
  scene.add(fauna3G);
  app.fauna3 = fauna3;
  const butterflies = new Butterflies(shared, textures);
  scene.add(butterflies.mesh);
  app.butterflies = butterflies;
  app.renderer = renderer;
  void buildBirds;
  // 岩（滝の谷・山の上・川の上手）
  const rocksG = buildRocks(shared, world.rocks);
  scene.add(rocksG);
  // 滝・段の落ち口・崖の上の急流
  const fallsG = buildWaterfall(shared, world.gorge);
  scene.add(fallsG);
  // 地面の上の植物の高さ・樹冠の高さ（泡の衝突とピント合わせ用）
  const texelAt = (x, z) => {
    const i = Math.max(0, Math.min(world.N - 1, Math.round((x - world.ORIGIN) / world.CELL)));
    const j = Math.max(0, Math.min(world.N - 1, Math.round((z - world.ORIGIN) / world.CELL)));
    return j * world.N + i;
  };
  const PLANT = { [TT.FLOODED]: 0.08, [TT.SEEDLING]: 0.16, [TT.RENGE]: 0.12, [TT.TILLED]: 0.02, [TT.FALLOW]: 0.2, [TT.FIELD]: 0.15, [TT.MEADOW]: 0.3, [TT.BANK]: 0.35, [TT.LEVEE_BIG]: 0.3, [TT.KNOLL]: 0.2, [TT.NANOHANA]: 0.95, [TT.FOREST]: 0.5, [TT.BAMBOO]: 0.1, [TT.GARDEN]: 0.15 };
  const landAt = (x, z) => {
    const k = texelAt(x, z);
    const w = world.water[k] > -1000 ? world.water[k] - world.height[k] : 0;
    return Math.max(PLANT[world.type[k]] ?? 0.02, w);
  };
  const canopyAt = (x, z) => world.forest[texelAt(x, z)] * 12;
  app.landAt = landAt;
  // 建物（泡がよける箱）
  const obstacles = [];
  for (const h of HOUSES) {
    if (h.id === 'h1') {
      // 始まりの家：座敷の前半分（吹く場所）は開けておく
      const c = Math.cos(h.rot), s2 = Math.sin(h.rot), zc = (-h.d / 2 + 0.8) / 2;
      obstacles.push({ x: h.x + zc * s2, z: h.z + zc * c, hw: h.w / 2 + 0.3, hd: (h.d / 2 + 0.8) / 2, rot: h.rot, top: h.y + (h.info?.top || 8), base: h.y - 1 });
      continue;
    }
    obstacles.push({ x: h.x, z: h.z, hw: h.w / 2 + 0.3, hd: h.d / 2 + 0.3, rot: h.rot, top: h.y + (h.info?.top || 8), base: h.y - 1 });
  }
  for (const o of OUTBUILDINGS) {
    const h = HOUSES.find((q) => q.id === o.of);
    const c = Math.cos(h.rot), s2 = Math.sin(h.rot);
    obstacles.push({ x: h.x + o.off[0] * c + o.off[1] * s2, z: h.z - o.off[0] * s2 + o.off[1] * c, hw: o.w / 2 + 0.3, hd: o.d / 2 + 0.3, rot: h.rot + o.rot, top: h.y + 5.5, base: h.y - 1 });
  }
  obstacles.push({ x: SHRINE.x, z: SHRINE.toriiZ, hw: 3.5, hd: 0.6, rot: 0, top: groundAt(SHRINE.x, SHRINE.toriiZ) + 5.2 });
  // 滝の水の幕（泡が飛びこむと割れる）
  {
    const [lx, ly, lz] = world.gorge.lip, [ix, iy, iz] = world.gorge.impact;
    obstacles.push({ x: (lx + ix) / 2, z: (lz + iz) / 2, hw: 3.0, hd: 1.4, rot: Math.atan2(ix - lx, iz - lz), top: ly + 0.5, base: iy - 1 });
  }
  // 大きな岩
  for (const q of world.rocks) if (q.s > 1.1 && !q.buried) obstacles.push({ x: q.x, z: q.z, hw: q.s * 0.42, hd: q.s * 0.42, rot: q.rot, top: q.y + q.s * (0.2 + 0.62 * q.flat), base: q.y - 1 });
  obstacles.push({ x: SHRINE.x, z: SHRINE.shrineZ, hw: 2.6, hd: 2.4, rot: 0, top: groundAt(SHRINE.x, SHRINE.shrineZ) + 5 });
  // 見どころ（視線がときどき向かう）
  const V = THREE.Vector3;
  const landmarks = [
    { id: 'sakura', pos: new V(KNOLL.x, groundAt(KNOLL.x, KNOLL.z) + 8, KNOLL.z), w: 1.6 },
    { id: 'torii', pos: new V(SHRINE.x, groundAt(SHRINE.x, SHRINE.toriiZ) + 3, SHRINE.toriiZ), w: 1.3 },
    { id: 'shrine', pos: new V(SHRINE.x, groundAt(SHRINE.x, SHRINE.shrineZ) + 3, SHRINE.shrineZ), w: 0.8 },
    { id: 'bridge', pos: new V(BRIDGE.x, world.bridgeDeck, BRIDGE.z), w: 0.7 },
    { id: 'pond', pos: new V(POND.x, world.pondLevel, POND.z), w: 0.9 },
    { id: 'namiki', pos: new V(-185, groundAt(-185, riverZ(-185) - 11) + 5, riverZ(-185) - 11), w: 1.2 },
    ...HOUSES.map((h) => ({ id: h.id, pos: new V(h.x, h.y + 4, h.z), w: 1.0 })),
    { id: 'koi', pos: koiBase.clone().add(new V(2, 9, 0)), w: 1.5 },
    // 滝・山の上・遠くの雪山（遠くても視線が向く）
    { id: 'taki', pos: new V((world.gorge.lip[0] + world.gorge.impact[0]) / 2, (world.gorge.lip[1] + world.gorge.impact[1]) / 2, (world.gorge.lip[2] + world.gorge.impact[2]) / 2), w: 2.0 },
    { id: 'ridge', pos: new V(RIDGE.x, (RIDGE.y || 110) + 3, RIDGE.z), w: 0.7 },
    { id: 'yuki', pos: (() => { const x = 13500, z = -5300; return new V(x, 2200 + snowRange(x, z) * 0.15, z); })(), w: 1.1, far: true },
  ];
  obstacles.push({ x: koiBase.x, z: koiBase.z, hw: 0.4, hd: 0.4, rot: 0, top: koiBase.y + 11.6, base: koiBase.y - 1 });

  const camera = new THREE.PerspectiveCamera(55, 16 / 9, 0.08, 40000);
  if (REV) camera._reversedDepth = true;
  camera.position.set(-160, 26, -150);
  camera.lookAt(-40, 0, 40);
  camera.fov = 52; camera.updateProjectionMatrix();
  app.camera = camera;

  const post = new Post(renderer, shared);
  post.initChain();
  const clouds = new Clouds(renderer, shared, post.depthU);
  const bubbleR = new BubbleRenderer(shared, post.depthU, 64, textures.tType.value);
  bubbleR.attachPov(post.final);  // 泡の視点の膜へ環境図と膜の雑音
  app.bubbles = [];
  // 花びらの出どころ：桜の樹冠
  const emitters = world.trees.filter((t) => t.sp === SP.SAKURA).map((t) => (t.hero ? { x: t.x, y: t.y + 11, z: t.z, r: 11 } : { x: t.x, y: t.y + 5.5 * t.s, z: t.z, r: 4.5 * t.s }));
  // 一本桜は花びらを多めに（同じ出どころを重ねる）
  const heroE = emitters.find((e) => e.r > 10);
  if (heroE) for (let i = 0; i < 9; i++) emitters.unshift(heroE);
  const particles = new Particles(shared, post.depthU, emitters, LITE, world.gorge.impact, { lip: world.gorge.lip, halfW: 2.7 });
  const flight = new Flight({ wind, groundAt, trees, obstacles, landAt, lipH: world.gorge.lipH });
  const spots = makeSpots(groundAt, world);
  const director = new Director({ camera, world, flight, wind, groundAt, canopyAt, spots, landmarks, trees });
  // 縁側で始まったときのピントの見どころ：縁側の前の日なたで丸くなる猫
  director.focusSubject = () => {
    if (director.spot.id !== 'engawa') return null;
    const c = fauna3.cats.find((q) => q.home === 'engawa');
    return c ? new THREE.Vector3(c.x, c.y + 0.12, c.z) : null;
  };
  app.director = director;
  if (params.get('life')) director.mainLife = Number(params.get('life'));
  app.pops = [];
  // ---- 音 ----
  const audio = new Ambient();
  app.audio = audio;
  const sndBtn = document.getElementById('snd');
  let muted = false;
  try { muted = localStorage.getItem('shabon-muted') === '1'; } catch {}
  const setMuted = (m) => {
    muted = m;
    audio.setMuted(m);
    try { localStorage.setItem('shabon-muted', m ? '1' : '0'); } catch {}
    if (sndBtn) {
      sndBtn.classList.toggle('muted', m);
      sndBtn.setAttribute('aria-label', m ? '音を出す' : '音を消す');
      sndBtn.setAttribute('aria-pressed', m ? 'true' : 'false');
    }
  };
  setMuted(muted);
  // ---- メニュー（ふだんは隠す。Esc で開く：つづける・最初から・音） ----
  const menuEl = document.getElementById('menu');
  const menuBtn = document.getElementById('menuBtn');
  const soundItem = menuEl?.querySelector('[data-act="sound"]');
  const syncSound = () => { if (soundItem) soundItem.textContent = muted ? '音：なし' : '音：あり'; };
  // 全画面：使えない画面（スマホの一部など）では項目ごと隠す
  const fsItem = menuEl?.querySelector('[data-act="fullscreen"]');
  const fsEl = () => document.fullscreenElement || document.webkitFullscreenElement;
  const fsCan = !!(document.fullscreenEnabled || document.webkitFullscreenEnabled);
  if (fsItem && !fsCan) fsItem.hidden = true;
  const syncFs = () => { if (fsItem) fsItem.textContent = fsEl() ? '全画面を終える' : '全画面'; };
  const toggleFs = () => {
    const d = document.documentElement;
    if (fsEl()) (document.exitFullscreen || document.webkitExitFullscreen)?.call(document)?.catch?.(() => {});
    else (d.requestFullscreen || d.webkitRequestFullscreen)?.call(d)?.catch?.(() => {});
  };
  app.paused = false;
  const openMenu = (open) => {
    if (!menuEl) return;
    app.paused = open;
    menuEl.hidden = !open;
    syncSound();
    syncFs();
    if (open) { menuEl.querySelector('button')?.focus(); audio.duck?.(true); }
    else { canvas.focus?.(); audio.duck?.(false); last = performance.now(); }
  };
  app.openMenu = openMenu;
  menuEl?.addEventListener('pointerdown', (e) => e.stopPropagation());
  menuEl?.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) { if (e.target === menuEl) openMenu(false); return; }
    audio.unlock();
    const act = b.dataset.act;
    if (act === 'resume') openMenu(false);
    else if (act === 'restart') { openMenu(false); director.restart(); }
    else if (act === 'sound') { setMuted(!muted); syncSound(); }
    else if (act === 'fullscreen') {
      // 全画面にするときはメニューを閉じて景色へ戻る。終えるときはメニューを開いたまま
      const entering = !fsEl();
      toggleFs();
      if (entering) openMenu(false);
    }
  });
  // さわって操作する画面：ふれたあとしばらくだけ、隅にメニューの印を出す
  let menuBtnTimer = 0;
  if (menuBtn) {
    menuBtn.addEventListener('pointerdown', (e) => e.stopPropagation());
    menuBtn.addEventListener('click', (e) => { e.stopPropagation(); openMenu(true); });
  }
  const showMenuBtn = () => {
    if (!menuBtn) return;
    menuBtn.hidden = false;
    menuBtn.classList.add('on');
    clearTimeout(menuBtnTimer);
    menuBtnTimer = setTimeout(() => menuBtn.classList.remove('on'), 3200);
  };
  document.addEventListener('visibilitychange', () => { if (document.hidden) audio.suspend(); else audio.resume(); });
  director.onBlow = () => audio.blow();
  director.onPop = (reason, b) => { audio.pop(1); app.pops.push({ reason, age: b.age.toFixed(1), y: b.pos.y.toFixed(1) }); if (DEV) console.log('pop', reason, b.age.toFixed(1)); };
  // ほかの泡が割れる音は、すぐそば（8m以内）のものだけ小さく
  director.onBubblePop = (b) => { const d = b.pos.distanceTo(camera.position); if (d < 8) audio.pop(0.5 * (1 - d / 8)); };
  const titleEl = document.getElementById('title');
  const hintEl = document.getElementById('hint');
  // キーボードのある画面では、案内にメニューの開き方を添える
  try { if (matchMedia('(pointer: fine)').matches) { const sub = hintEl?.querySelector('.sub'); if (sub) sub.textContent = 'ドラッグで見まわせます・Esc でメニュー'; } } catch {}
  // ---- 入力：ふれて離す＝吹く、ドラッグ＝見まわす（泡の動きは風だけ） ----
  let drag = null;
  canvas.addEventListener('pointerdown', (e) => {
    audio.unlock();
    if (app.paused) return;
    if (e.pointerType === 'touch') showMenuBtn();
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: 0 };
    try { canvas.setPointerCapture(e.pointerId); } catch {}
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    drag.x = e.clientX; drag.y = e.clientY;
    drag.moved += Math.abs(dx) + Math.abs(dy);
    if (drag.moved > 6) { director.look(dx, dy, canvas.clientHeight); canvas.classList.add('dragging'); }
  });
  const endDrag = (e, cancel) => {
    if (!drag || (e && e.pointerId !== drag.id)) return;
    if (!cancel && drag.moved <= 6) director.click();
    director.endLook();
    canvas.classList.remove('dragging');
    drag = null;
  };
  canvas.addEventListener('pointerup', (e) => endDrag(e, false));
  canvas.addEventListener('pointercancel', (e) => endDrag(e, true));
  const keys = new Set();
  window.addEventListener('keydown', (e) => {
    audio.unlock();
    if (e.code === 'Escape') { e.preventDefault(); openMenu(!app.paused); return; }
    if (app.paused) return;
    if ((e.code === 'Space' || e.code === 'Enter') && e.target !== sndBtn) director.click();
    if (e.code === 'KeyF') document.documentElement.requestFullscreen?.().catch(() => {});
    if (e.code === 'KeyM') setMuted(!muted);
    if (e.code.startsWith('Arrow')) { keys.add(e.code); e.preventDefault(); }
  });
  // 全画面ではブラウザが Esc を先に使って全画面を解く（ページには届かない）→ 解けたらメニューを開く
  const onFsChange = () => { syncFs(); if (!fsEl() && !app.paused && app.ready) openMenu(true); };
  document.addEventListener('fullscreenchange', onFsChange);
  document.addEventListener('webkitfullscreenchange', onFsChange);
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => keys.clear());
  const water = new Water(world, shared, textures, post.depthU);
  // 水の輪（カエル・魚・鴨・ツバメ）：いちばん古い枠に書く
  const pushRing = (x, z, st) => {
    const arr = water.uniforms.uRings.value;
    let best = 0, bt = 1e9;
    for (let i = 0; i < arr.length; i++) { const tb = arr[i].w <= 0 ? -1e9 : arr[i].z; if (tb < bt) { bt = tb; best = i; } }
    arr[best].set(x, z, shared.uTime.value, st);
  };
  const waterScene = new THREE.Scene();
  waterScene.add(water.group);
  let sceneRT, litRT;
  // 描く解像度：画面のCSS寸法×（Retinaは最大1.25倍）×可変の倍率
  const q = { scale: Number(params.get('scale') || 0), samples: 4, lastChange: 0, ema: 1 / 60 };
  const cssSize = () => [Math.max(2, window.innerWidth), Math.max(2, window.innerHeight)];
  const dprEff = () => (CAPTURE ? 1 : Math.min(window.devicePixelRatio || 1, 1.25));
  if (CAPTURE) q.scale = 1;
  if (!q.scale) {
    const [cw, ch] = cssSize();
    const px = cw * ch * dprEff() ** 2;
    q.scale = Math.min(1, Math.sqrt((LITE ? 0.9e6 : 2.1e6) / px));
    q.auto = true;
  }
  const resize = () => {
    const [cw, ch] = cssSize();
    const k = dprEff() * q.scale;
    renderer.setPixelRatio(k);
    renderer.setSize(cw, ch, false);
    const w = canvas.width, h = canvas.height;
    app.w = w; app.h = h;
    camera.aspect = w / h;
    // 縦長の画面では視野を広げる
    camera.fov = w < h ? 64 : 52;
    camera.updateProjectionMatrix();
    sceneRT?.dispose(); litRT?.dispose();
    const dt = new THREE.DepthTexture(w, h, THREE.FloatType);
    q.samples = q.scale < 0.72 ? 2 : 4;
    sceneRT = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: q.samples, depthTexture: dt, depthBuffer: true });
    litRT = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, depthBuffer: false });
    post.final.uniforms.uRes.value.set(w, h);
    post.resizeChain(w, h);
    clouds.resize(w, h);
    post.final.uniforms.uExposure.value = Number(params.get('exp') || 0.79);
    // 書き出しでは粒子を切る（毎コマ動く粒は圧縮のノイズになる）
    post.final.uniforms.uGrain.value = CAPTURE ? 0 : 1;
  };
  resize();
  // 重いときは解像度を下げ、余裕があれば少し上げる
  document.addEventListener('visibilitychange', () => { q.lastChange = performance.now(); q.ema = 1 / 60; });
  app.adapt = (dt, now) => {
    if (!q.auto || document.hidden) return;
    // タブの切り替えなどで止まっていた間の長い間隔は数えない
    if (dt > 0.2) { q.lastChange = now; return; }
    q.ema += (dt - q.ema) * 0.05;
    if (now - q.lastChange < 3000) return;
    let ns = q.scale;
    // 下げるのはすぐ、上げるのは長く余裕が続いたときだけ（行ったり来たりしない）
    if (q.ema > 1 / 46) { ns = Math.max(0.5, q.scale * 0.88); q.downs = (q.downs || 0) + 1; }
    else if (q.ema < 1 / 58.5 && now - q.lastChange > 12000 + (q.downs || 0) * 8000) ns = Math.min(q.maxScale || 1, q.scale * 1.04);
    if (Math.abs(ns - q.scale) > 0.01) { if (ns < q.scale && (q.downs || 0) > 2) q.maxScale = Math.min(q.maxScale || 1, q.scale); q.scale = ns; q.lastChange = now; q.ema = 1 / 60; resize(); }
  };
  app.quality = () => ({ scale: +q.scale.toFixed(2), w: app.w, h: app.h, samples: q.samples, ema: +(q.ema * 1000).toFixed(1) });
  window.addEventListener('resize', resize);

  status('仕上げています');
  await tick();
  // 遠距離の影（一度だけ）
  mark('farShadow:start');
  shadows.renderFar(scene, sunDir, (cam) => { terrain.update(cam, true); trees.cullFar(cam, true); });
  mark('farShadow:end');
  // 近距離の影の対象（木の近景など）
  const nearFocus = new THREE.Vector3();

  status('');
  app.ready = true;
  // 最初の数フレームを描いてから読み込み画面を消す
  const loadingEl = document.getElementById('loading');
  let loadingT = 0;
  app.debugView = ({ pos, look, fov, rel }) => {
    app.useDirector = false;
    app.debug = { pos, look };
    camera.position.set(...pos);
    if (rel) camera.position.y += groundAt(pos[0], pos[2]);
    const lk = new THREE.Vector3(...look);
    if (rel) lk.y += groundAt(look[0], look[2]);
    camera.lookAt(lk);
    if (fov) { camera.fov = fov; camera.updateProjectionMatrix(); }
  };

  const prof = new Profiler(gl, params.has('prof'));
  app.skip = {};
  app.groups = { grass: grass.group, trees: trees.group, bld: bld.mesh, far, terrain: terrain.group, fauna: faunaG, birds2: birds2.group, fauna3: fauna3G, bfly: butterflies.mesh, rocks: rocksG, falls: fallsG, cliff };
  app.prof = () => prof.report();
  let last = performance.now();
  // ---- 1コマ分の時間を進める ----
  const simulate = (dt) => {
    shared.uTime.value += dt;
    shared.uFrame.value = (shared.uFrame.value + 1) % 64;
    wind.update(dt);
    flight.update(dt);
    if (app.useDirector !== false) {
      director.lookKeys(dt, (keys.has('ArrowLeft') ? 1 : 0) - (keys.has('ArrowRight') ? 1 : 0), (keys.has('ArrowUp') ? 1 : 0) - (keys.has('ArrowDown') ? 1 : 0));
      director.update(dt);
      if (audio.started) {
        const cp = camera.position;
        audio.update(dt, { gust: wind.gustField(cp.x, cp.z), speed: wind.speed, alt: cp.y - groundAt(cp.x, cp.z), state: director.state });
      }
      app.focus = director.focus;
      app.aperture = director.aperture;
      app.bubbles = director.renderList();
      post.final.uniforms.uFilm.value = director.film;
      post.final.uniforms.uFlash.value = director.flash;
      post.final.uniforms.uPop.value = director.pop;
      post.final.uniforms.uPopPt.value.copy(director.popPoint);
      post.final.uniforms.uAge.value = director.main ? director.main.age / director.main.life : 0;
      post.final.uniforms.uFade.value = director.fade;
      post.final.uniforms.uFadeCol.value.setRGB(0.93, 0.95, 0.96);
      wand.visible = director.wand.visible;
      wand.position.copy(director.wand.pos);
      wand.quaternion.copy(director.wand.quat);
      wand.rotateX(-0.25); wand.rotateZ(0.15);
      if (titleEl) titleEl.style.opacity = String(director.uiTitle);
      if (hintEl) hintEl.style.opacity = String(director.hint * (director.state === 'title' || director.state === 'ready' ? 1 : 0));
    } else { wand.visible = false; }
    fauna.update(dt, camera.position);
    birds2.update(dt, camera.position);
    fauna3.update(dt, camera.position);
    shared.uWind.value.set(wind.dir[0], wind.dir[1], wind.speed, wind.gust);
    shared.uWindOff.value.set(wind.off[0], wind.off[1]);
    shared.uCloudOff.value.x += dt * 4.0; shared.uCloudOff.value.y += dt * 1.5;
  };
  // ---- 1コマ描く ----
  const render = () => {
    for (const k in app.groups) app.groups[k].visible = !app.skip[k];
    camera.updateMatrixWorld();
    post.setCamera(camera, REV);
    trees.update(camera);
    butterflies.update(camera);
    // 近距離の影：視線の先の地面のあたり
    {
      const f = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
      const hgt = Math.max(2, camera.position.y - 0);
      nearFocus.copy(camera.position).addScaledVector(f, Math.min(45, 12 + hgt * 0.6));
      prof.begin('shadowNear');
      if (!app.skip.shadow && (!LITE || app.frames % 2 === 0)) shadows.renderNear(scene, sunDir, nearFocus, 55, () => {});
    }
    terrain.update(camera);
    grass.update(camera, groundAt(camera.position.x, camera.position.z), renderer);

    prof.begin('main');
    renderer.setRenderTarget(sceneRT);
    renderer.setClearColor(0x000000, 1);
    renderer.clear(true, true, false);
    renderer.render(scene, camera);
    prof.begin('water');
    // 水面（不透明の色と深度を読みながら同じ描画先へ）
    water.update(camera, sceneRT, app.w, app.h);
    if (!app.skip.water) renderer.render(waterScene, camera);

    prof.begin('clouds');
    if (!app.skip.clouds) post.composite.uniforms.tClouds.value = clouds.render(post, sceneRT.depthTexture, camera);
    // 画面空間の遮蔽（半分の解像度。軽い設定では省く）
    prof.begin('ao');
    const aoOn = !app.skip.ao && !LITE;
    if (aoOn) post.composite.uniforms.tAO.value = post.ao(sceneRT.depthTexture, camera);
    post.composite.uniforms.uAO.value = aoOn ? (app.aoStr ?? 0.85) : 0;
    prof.begin('composite');
    post.composite.uniforms.uClouds.value = app.skip.clouds ? 0 : 1;
    post.composite.uniforms.tColor.value = sceneRT.texture;
    post.composite.uniforms.tDepth.value = sceneRT.depthTexture;
    post.run(post.composite, litRT);
    // 被写界深度 → 光のにじみ → 色調
    // 絞りとボケの上限は画面の高さに比例（解像度が変わってもボケ方は同じ）
    const rs = app.h / 900;
    post.cocMat.uniforms.uFocus.value.set(app.focus || 60, (app.aperture ?? 70) * rs, 36 * rs);
    prof.begin('dof');
    if (!app.skip.dof) post.dof(litRT.texture, sceneRT.depthTexture);
    else post.run(post.copyMat || (post.copyMat = new THREE.ShaderMaterial({ uniforms: { t: { value: null } }, vertexShader: 'varying vec2 vUv; void main(){ vUv = position.xy*0.5+0.5; gl_Position = vec4(position.xy,0.0,1.0); }', fragmentShader: 'uniform sampler2D t; varying vec2 vUv; void main(){ gl_FragColor = texture(t, vUv); }', depthTest: false, depthWrite: false })), post.dofRT);
    if (app.skip.dof) post.copyMat.uniforms.t.value = litRT.texture;
    prof.begin('particles');
    // 花びら・綿毛・塵
    if (!app.skip.particles) particles.render(renderer, camera, post.dofRT, app.w, app.h, post.cocMat.uniforms.uFocus.value, sceneRT.depthTexture);
    // しゃぼん玉（被写界深度のあとに、それぞれのボケで重ねる）
    prof.begin('bubbles');
    bubbleR.probe(renderer, camera);  // 泡の映り込みの環境図
    if (app.bubbles.length) {
      bubbleR.update(app.bubbles, camera, app.w, app.h, post.cocMat.uniforms.uFocus.value, sceneRT.depthTexture);
      bubbleR.render(renderer, camera, post.dofRT);
    }
    prof.begin('bloom');
    const bloomTex = app.skip.bloom ? null : post.bloom(post.dofRT.texture);
    prof.begin('final');
    post.final.uniforms.tColor.value = post.dofRT.texture;
    post.final.uniforms.tBloom.value = bloomTex;
    post.final.uniforms.uBloom.value = app.skip.bloom ? 0 : (app.bloom ?? 0.07);
    post.run(post.final, null);
    prof.frame();
  };
  const frame = () => {
    requestAnimationFrame(frame);
    const now = performance.now();
    // メニューを開いている間は止める（最後の画をそのまま見せる）
    if (app.paused) { last = now; return; }
    const rawDt = (now - last) / 1000;
    const dt = Math.min(0.05, rawDt);
    last = now;
    if (app.frames > 30) app.adapt(rawDt, now);
    simulate(dt);
    if (app.frames < 3) mark(`frame${app.frames}:start`);
    render();
    if (app.frames < 3 || app.frames === 9) mark(`frame${app.frames}:end`);
    // 読み込み画面を描画に合わせて消す（タイマーに頼らない）
    if (loadingEl && !loadingEl.hidden && app.frames > 8) {
      loadingT += rawDt;
      loadingEl.style.transition = 'none';
      loadingEl.style.opacity = String(Math.max(0, 1 - loadingT / 1.4));
      if (loadingT > 1.4) loadingEl.hidden = true;
    }
    app.frames++;
    for (let i = app._waiters.length - 1; i >= 0; i--) if (app.frames >= app._waiters[i].at) { app._waiters[i].res(); app._waiters.splice(i, 1); }
  };
  if (CAPTURE) runCapture({ simulate, render, director, wind, camera, groundAt, canvas, app, loadingEl, titleEl, hintEl, sndBtn, params });
  else frame();
}

// ---- 書き出し：台本どおりに1コマずつ進めて、サーバーのffmpegへ送る ----
async function runCapture({ simulate, render, director, wind, camera, groundAt, canvas, app, loadingEl, titleEl, hintEl, sndBtn, params }) {
  [loadingEl, titleEl, hintEl, sndBtn].forEach((el) => el && (el.hidden = true));
  const fps = Number(params.get('fps') || 60);
  const dur = Number(params.get('dur') || 42);
  const every = Number(params.get('every') || 1);        // 下見：何コマおきに描くか
  const out = params.get('out') || 'intro';
  const stills = params.has('stills');                    // 下見は静止画で保存
  const S = {
    blowAt: Number(params.get('blow') || 3.4),
    life: Number(params.get('life') || 32),
    liftAt: Number(params.get('liftat') || 11),
    liftDur: Number(params.get('liftdur') || 24),
    liftPeak: Number(params.get('liftpeak') || 1.7),
  };
  director.mainLife = S.life;
  director.liftPlan = { at: S.liftAt, dur: S.liftDur, peak: S.liftPeak };
  // 始める場所（engawa / dote / knoll / shrine / bridge / pond）
  if (params.get('spot')) { const i = director.spots.findIndex((sp) => sp.id === params.get('spot')); if (i >= 0) director.placeAtSpot(i); }
  // 書き出す範囲（秒）。範囲の前は描かずに進める
  const from = Number(params.get('from') || 0), to = Number(params.get('to') || dur);
  // 手で見まわす台本 look=始め,終わり,左右(rad),上下(rad)
  const lookPlan = params.get('look') ? params.get('look').split(',').map(Number) : null;
  let lookBase = null;
  const ease = (u) => u * u * u * (u * (u * 6 - 15) + 10);
  const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  // 見まわしの始まりで視線の動きが途切れないよう、直前の回る速さを引き継ぐ
  let lastDisp = null, dispV = { y: 0, p: 0 };
  const events = [], samples = [];
  director.onBlow = () => events.push({ t: simT, type: 'blow' });
  director.onPop = () => events.push({ t: simT, type: 'pop', s: 1 });
  director.onBubblePop = (b) => { const d = b.pos.distanceTo(camera.position); if (d < 25) events.push({ t: simT, type: 'pop', s: 0.55 * (1 - d / 25) }); };
  let simT = 0;
  const dt = 1 / fps;
  const total = Math.round(dur * fps);
  // 雲の積み重ねなどを落ち着かせるため、最初に少しだけ空回し
  for (let i = 0; i < 20; i++) { simulate(dt); render(); }
  simT = 0;
  if (!stills) await fetch(`/api/video/start?name=${out}&fps=${fps / every}&w=${params.get('ow') || 1920}&h=${params.get('oh') || 1080}`, { method: 'POST' });
  const t0 = performance.now();
  const fFrom = Math.round(from * fps), fTo = Math.min(total, Math.round(to * fps));
  for (let f = 0; f < fTo; f++) {
    if (Math.abs(simT - S.blowAt) < dt * 0.5 && director.state === 'title') director.click();
    if (lookPlan) {
      const [l0, l1, dy, dp = 0] = lookPlan, M = director.manual;
      if (simT >= l0 && simT <= l1) {
        if (!lookBase) { director.beginLook(); M.active = true; lookBase = { y: M.yaw, p: M.pitch, vy: dispV.y, vp: dispV.p }; }
        const u = ease((simT - l0) / (l1 - l0)), carry = 0.35 * (1 - Math.exp(-(simT - l0) / 0.35));
        M.yaw = lookBase.y + lookBase.vy * carry + dy * u; M.pitch = lookBase.p + lookBase.vp * carry + dp * u;
      } else if (lookBase && M.active) director.endLook();
    }
    simulate(dt);
    if (lastDisp) dispV = { y: wrap(director.dispYaw - lastDisp.y) / dt, p: (director.dispPitch - lastDisp.p) / dt };
    lastDisp = { y: director.dispYaw, p: director.dispPitch };
    if (f % Math.round(0.1 * fps) === 0) {
      const cp = camera.position;
      samples.push({ t: +simT.toFixed(3), g: +wind.gustField(cp.x, cp.z).toFixed(3), sp: +wind.speed.toFixed(3), alt: +(cp.y - groundAt(cp.x, cp.z)).toFixed(2), st: director.state,
        yaw: +director.dispYaw.toFixed(4), pitch: +director.dispPitch.toFixed(4), x: +cp.x.toFixed(2), y: +cp.y.toFixed(2), z: +cp.z.toFixed(2), focus: +director.focus.toFixed(2) });
    }
    // 範囲の少し前から描いて、時間方向に積み重ねる効果（雲など）をなじませる
    if (f < fFrom) { if (f >= fFrom - 30) render(); simT += dt; continue; }
    if ((f - fFrom) % every === 0) {
      render();
      const blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', stills ? 0.9 : 0.95));
      if (stills) await fetch(`/api/still?name=${out}_${String((f - fFrom) / every).padStart(4, '0')}.jpg`, { method: 'POST', body: blob });
      else await fetch('/api/video/frame', { method: 'POST', body: blob });
      window.__capProgress = `${f + 1}/${total} ${((performance.now() - t0) / (f + 1)).toFixed(0)}ms/f state=${director.state}`;
    }
    simT += dt;
  }
  if (!stills) await fetch('/api/video/end', { method: 'POST' });
  await fetch(`/api/log?name=${out}-events.json`, { method: 'POST', body: JSON.stringify({ fps, dur, events, samples }) });
  window.__capDone = true;
}

boot().catch((e) => { console.error(e); window.__fatal = String(e && e.stack || e); status('起動できませんでした：' + String(e && e.message || e).slice(0, 160)); });
