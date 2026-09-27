// 吉山の町: 起動と毎フレームの更新
import * as THREE from 'three';
import { Input } from '../core/input.js';
import { loadTownData, SegIndex, Mask } from './data.js';
import { buildMasks, PLACES, M } from './layout.js';
import { buildTerrain, makeGround, carveWater } from './terrain.js';
import { TownWater, TOWN_FOG } from './water.js';
import { U } from '../core/shaderPatch.js';
import { createRenderer, setupLights, createComposer, followShadow, setShadowRange } from './render.js';
import { TreeSet, updateTrees } from './assets/trees.js';
import { buildRoads } from './roads.js';
import { Buildings } from './buildings.js';
import { scatterTrees, fitTree } from './nature.js';
import { buildPoles } from './props.js';
import { buildLandmarks } from './landmarks.js';
import { Lots } from './lots.js';
import { osmBlocks } from './blocks.js';
import { Grass } from './grass.js';
import { PlayerController, Kid } from './player.js';
import { Hud } from './hud.js';
import { Ambience } from './ambience.js';
import { TIME, FOCUS } from './materials.js';
import { FastTravel } from './travel.js';
import { Fence, FENCE_R } from './fence.js';
import { trimVectors } from './scenery/plan.js';
import { installHaze } from './scenery/haze.js';
import { shapeValley } from './scenery/landscape.js';
import { buildPaddies } from './scenery/paddies.js';
import { buildForest } from './scenery/forest.js';
import { buildLevees, buildRowTrees } from './scenery/river.js';
import { reshapeFront, markFront, frontParcels, buildFront, PADDY_W, channelStrip } from './scenery/frontage.js';
import { PlantedTrees, loadPlanted } from './scenery/planted.js';
import { buildHamlets } from './scenery/hamlets.js';
import { PlantEditor } from './plant.js';
import { loadPeople, TownPeople } from './people/town.js';
import { Talk } from './people/talk.js';
import { StagePick } from './stagePick.js';
import { progress } from '../shared/progress.js';
import { QuestBook } from './quests.js';
import { Bag, QuestHud, notifyGive, notifyReward } from './bag.js';

const $ = (id) => document.getElementById(id);
let lastT = performance.now(), lastLabel = '開始';
export const bootTimes = [];
const status = (t) => {
  const now = performance.now();
  bootTimes.push([lastLabel, Math.round(now - lastT)]);
  lastT = now; lastLabel = t;
  $('load-msg').textContent = t;
  return new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
};

// 構造物の上面（橋・防波堤・ホーム）
class Deck {
  constructor(core) {
    this.m = new Mask(core.x0, core.z0, core.x1 - core.x0, core.z1 - core.z0, 1);
    this.h = new Float32Array(this.m.nx * this.m.nz).fill(-Infinity);
  }
  line(x, z, r, y) {
    const m = this.m;
    for (let dz = -r; dz <= r; dz += 0.9) for (let dx = -r; dx <= r; dx += 0.9) {
      if (dx * dx + dz * dz > r * r) continue;
      const c = m.cell(x + dx, z + dz);
      if (c >= 0) this.h[c] = Math.max(this.h[c], y);
    }
  }
  poly(p, y) {
    const tmp = new Mask(this.m.x0, this.m.z0, this.m.nx, this.m.nz, 1);
    tmp.fillPoly(p, 1);
    for (let i = 0; i < tmp.a.length; i++) if (tmp.a[i]) this.h[i] = Math.max(this.h[i], y);
  }
  at(x, z) { const c = this.m.cell(x, z); return c < 0 ? -Infinity : this.h[c]; }
}

async function boot() {
  installHaze(); // もや（低い所ほど濃い空気遠近）
  const renderer = createRenderer($('c'));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.15, 9000);
  // 光・空（銛一本の午前中と同じ色）・環境マップ
  const { sun, sky } = setupLights(scene, renderer, { shadowSize: 4096, shadowRange: 60 });
  scene.fog = new THREE.FogExp2(U.uAirFogCol.value.clone(), TOWN_FOG.value);
  const { composer, gtao } = createComposer(renderer, scene, camera, { grade: true });

  // 主人公の形はワーカーで作るので、町を作る前に頼んでおく
  const kidP = Kid.load();
  // 町の人（定食屋の夏海・研究所の磯貝博士）も同じくワーカーで
  const peopleP = loadPeople();
  await status('地図を読み込んでいます');
  const data = await loadTownData(new URL('./data/', import.meta.url).href);
  // 行かない所の町並み（家・細い道・線路）は描かない
  trimVectors(data.V);
  // 定食屋の前（山側）は、道・用水路・田んぼ・農道・公園を手で並べる
  reshapeFront(data.V);
  // 山すそをならして谷の平地を広く見せる
  shapeValley(data);
  const mask = buildMasks(data);
  markFront(mask);
  const water = carveWater(data, mask);
  // 町並みの外の川に土手を盛る（並木はあとで）
  const levees = buildLevees(data, mask, water);
  const ground = makeGround(data);
  const deck = new Deck(data.core);
  const segs = new SegIndex(16);
  // ?debug: 湊さんの家・研究所の大きさ（段階）をその場でえらべる（stagePick.js）
  const DEBUG = new URLSearchParams(location.search).has('debug');
  // ?arrive=teishoku: 遊び場から帰ってきた（空の上から始まり、自分は定食屋の前にいる）
  const ARRIVE = new URLSearchParams(location.search).get('arrive');
  // 進みぐあい（お小遣い・持ち物・頼まれごと）。わたしてあった所は、帰ってきたときにはもう建てかわっている
  progress.load();
  const quests = new QuestBook(progress);
  quests.settleOnLoad();
  progress.write();
  PLACES.owner.stage = progress.data.stages.owner;
  PLACES.lab.stage = progress.data.stages.lab;
  const ctx = { data, ground, mask, deck, segs, debug: DEBUG };
  await status('道と岸壁をつくっています');
  scene.add(buildRoads(ctx));
  await status('町をつくっています');
  const B = new Buildings(ctx);
  const forest = new TreeSet();
  const lots = new Lots(ctx, B, forest);
  const landmarks = buildLandmarks(ctx, B, forest, lots.kit);
  scene.add(landmarks);
  const sites = landmarks.userData.sites; // 建て替えできる敷地（湊さんの家・研究所）
  osmBlocks(ctx, lots.kit, data.V);
  await status('家');
  lots.build(data.V);
  for (const m of lots.meshes()) scene.add(m);
  for (const m of B.meshes()) scene.add(m);
  await status('地形をつくっています');
  const T = buildTerrain(data, mask, water);
  scene.add(T.coreMesh, T.outerMesh);
  await status('なちゃっとの記憶を呼び戻しています');
  // 田んぼの区画案（なければ自動で並べる）
  const paddyPlan = await fetch(new URL('./data/paddy-plan.json', import.meta.url)).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  const paddies = buildPaddies(ctx, T, [], lots.fieldLots, paddyPlan, frontParcels(ground));
  scene.add(paddies);
  paddies.userData.sink(T.coreMesh, data.core, 0.35, T.kinds, T.canopy); // 区画の下は草を生やさない
  paddies.userData.sink(T.outerMesh, data.outer, 0.6);
  // 定食屋の前の用水路・水門・田の水と苗・ひまわり・農道の電柱
  const front = buildFront(ctx, T, paddies, forest);
  scene.add(front);
  // 田の中の集落・農家・林・一本木（田はそのまま、上に屋敷の盛り土をかぶせる。木の樹冠は森といっしょに描く）
  const farms = buildHamlets(ctx, paddies);
  scene.add(farms);
  ctx.extraCrowns = farms.userData.crowns;
  await status('山の森');
  ctx.paddyCovered = paddies.userData.covered; // 田の上には森の木を植えない
  const woods = buildForest(ctx, T);
  scene.add(woods);
  const rowTrees = buildRowTrees(ctx, levees);
  scene.add(rowTrees);
  await status('木を植えています');
  scatterTrees(ctx, forest, T, B.gardenTrees);
  // 木はすべて新しい種類（trees2.js）に置きかえ、家に埋もれないように大きさ・種類を決める
  const treeFit = fitTree(ctx);
  const treeGroup = forest.build({ variants: 4, fit: treeFit });
  scene.add(treeGroup);
  // 建て替えできる敷地の木も同じ当てはめで植える（建て替えるとその木だけ植え直す）
  for (const s of Object.values(sites)) s.plantTrees(treeGroup, treeFit);
  // 手で植えた木（見せたい景色のアラを隠す。?plant の植樹モードで植えて data/planted-trees.json に書く）
  const plantedData = await loadPlanted(new URL('./data/planted-trees.json', import.meta.url));
  const planted = new PlantedTrees(ground, plantedData.trees);
  scene.add(planted.group);
  await status('電柱');
  scene.add(buildPoles(ctx).group);
  await status('草');
  // 建てかわる敷地は、今は草がなくても草の区画を用意しておく（小さい段階で空いた所に生える）
  const grass = new Grass(ctx, T, { ensure: Object.values(sites).map((s) => s.rect) });
  for (const s of Object.values(sites)) s.grass = grass;
  { const s = channelStrip(); if (s) { grass.uniforms.uNoGrass.value.set(s[0], s[1], s[2], s[3]); grass.uniforms.uNoGrassW.value = s[4]; } }
  scene.add(grass.group);
  await status('草と電柱');
  await status('海と空');
  const water2 = new TownWater(data, T);
  scene.add(water2.group);

  // ---------- 歩ける場所 ----------
  const core = data.core;
  const cellOf = (x, z) => {
    const i = Math.round((x - core.x0) / core.step), j = Math.round((z - core.z0) / core.step);
    return i < 0 || j < 0 || i >= core.nx || j >= core.nz ? -1 : j * core.nx + i;
  };
  const world = {
    segs,
    groundAt(x, z, refY) {
      const t = ground(x, z), d = deck.at(x, z);
      return d > t && d <= refY + 0.65 ? d : t;
    },
    waterDepth(x, z) {
      const t = ground(x, z), c = cellOf(x, z);
      const lv = c >= 0 && T.water.kindAt[c] ? T.water.level[c] : 0;
      return Math.max(0, lv - t);
    },
    blocked(x, z) {
      if (!core.inside(x, z, 40)) return true;
      const d = deck.at(x, z);
      if (d > -1e9 && d > ground(x, z)) return false;
      const c = cellOf(x, z);
      if (c >= 0 && T.canopy[c] > 2.2 && !(mask.get(x, z) & M.ROAD)) return true; // 道の上は森でも通れる
      return this.waterDepth(x, z) > 0.75;
    },
    solidAt(x, y, z) {
      const c = cellOf(x, z);
      const g = ground(x, z) + (c >= 0 ? T.canopy[c] : 0);
      if (y < g + 0.3) return true;
      return (mask.get(x, z) & M.BLD) && y < ground(x, z) + 9;
    },
  };

  const input = new Input($('c'));
  input.dragLook = true;
  const player = new PlayerController(world, input, await kidP);
  const st = PLACES.start;
  player.place(st.x, st.z, Math.atan2(PLACES.street.dir[0], PLACES.street.dir[1]));
  scene.add(player.kid.root);
  const hud = new Hud();
  const amb = new Ambience();
  // 進入禁止の輪: 地名（ファストトラベル先）のまわりだけ歩ける。?debug のときだけ、メニューで解除できる
  // （ふだんは解除のボタンを出さず、?debug で解除したままになっていても輪はいつも出す）
  const fence = new Fence({ ground, groundAt: (x, z) => world.groundAt(x, z, 99) });
  const FKEY = 'yoshiyama.free';
  if (DEBUG) try { fence.free = localStorage.getItem(FKEY) === '1'; } catch (e) { /* 保存できない環境 */ }
  fence.alpha = fence.free ? 0 : 1;
  player.fence = fence;
  scene.add(fence.group);
  // F: 空から行き先をえらぶ
  // 自分の家は行き先にしない（ピンも、まわりの地面も）。家のまわりは歩ける範囲にも入れない
  const homeSpot = PLACES.home.spot || [PLACES.start.x, PLACES.start.z];
  const travel = new FastTravel({ camera, player, world, ground, mask, core, composer, gtao, fence,
    noLand: [[homeSpot[0], homeSpot[1], FENCE_R + 6]],
    onGame: (p) => openGame(p),
    unlocked: (spot) => progress.unlocked(spot),
    onArrive: () => {
      hud.cur = null; // 着いた場所の名前をもう一度出す
      $('paused').classList.toggle('show', !input.locked && !input.freeLook);
    } });
  // 歩ける所: 研究所は降りる所のまわりの円、定食屋は店の前の道と店の敷地の並び。
  // 道ぞいは店に向かって左（南東）へ 20 m、右（北西）へ 10 m 広げる。山側は道の前の田の半分まで（田には入れないので、道ぞいに幕を出さない）
  const shokudoZone = () => {
    const S = PLACES.street, P = PLACES.teishoku;
    const t = (P.x - S.a[0]) * S.dir[0] + (P.z - S.a[1]) * S.dir[1], off = (P.x - S.a[0]) * S.n[0] + (P.z - S.a[1]) * S.n[1];
    const t0 = t - P.w / 2 - 20, t1 = t + P.w / 2 + 10;
    const o0 = -(PADDY_W[0] + PADDY_W[1]) / 2, o1 = off + P.d / 2; // 田の半分（山側）〜 敷地の奥（海側）
    const tc = (t0 + t1) / 2, oc = (o0 + o1) / 2;
    return { x: S.a[0] + S.dir[0] * tc + S.n[0] * oc, z: S.a[1] + S.dir[1] * tc + S.n[1] * oc, ux: S.dir[0], uz: S.dir[1], hw: (t1 - t0) / 2, hd: (o1 - o0) / 2 };
  };
  // 研究所は降りる所のまわりの円。成長段階（?debug で建て替え）のときは建物の前の広がりも足す（landmarks.js の labLayout）
  const setZones = () => fence.setZones([{ x: PLACES.lab.spot[0], z: PLACES.lab.spot[1], r: FENCE_R }, sites.lab.place?.zone, shokudoZone()].filter(Boolean));
  setZones();
  // 自分の家のまわりは歩けないので、進入禁止のときは定食屋の前の道から歩きはじめる
  if (!fence.free || ARRIVE === 'teishoku') {
    const [sx, sz] = PLACES.teishoku.spot, [lx, lz] = PLACES.teishoku.look;
    player.place(sx, sz, Math.atan2(lx - sx, lz - sz));
  }
  // 解除中に輪の外へ出ていたら、禁止に戻したときはその場所のまわりを仮の輪にする
  const setFree = (free) => {
    fence.free = free;
    if (!free && !fence.inside(player.pos.x, player.pos.z)) fence.setExtra(player.pos.x, player.pos.z);
    try { localStorage.setItem(FKEY, free ? '1' : '0'); } catch (e) { /* 保存できない環境 */ }
    const b = $('fence-btn');
    b.setAttribute('aria-pressed', free);
    b.querySelector('small').textContent = free ? '解除中' : 'オフ';
  };
  if (DEBUG) setFree(fence.free);
  else $('fence-btn').remove();
  // ---------- メニュー（Esc）と設定 ----------
  let fpsCap = 60; // 描く回数の上限（0 = 画面のリフレッシュレートまで）
  const SKEY = 'yoshiyama.settings';
  const DEF = { master: 0.8, insects: 0.8, env: 0.8, sfx: 0.8, sens: 1, fps: 60 };
  const S = { ...DEF };
  try { Object.assign(S, JSON.parse(localStorage.getItem(SKEY) || '{}')); } catch (e) { /* 保存できない環境 */ }
  // ?mute: 確認・デバッグ用に音を消す（保存した設定は変えない）
  const MUTE = new URLSearchParams(location.search).has('mute');
  const applySet = (k, v) => { if (k === 'sens') player.sens = v; else if (k === 'fps') fpsCap = v; else amb.setVolume(k, MUTE && k === 'master' ? 0 : v); };
  for (const k in DEF) applySet(k, S[k]);
  const saveSet = () => { try { localStorage.setItem(SKEY, JSON.stringify(S)); } catch (e) { /* 保存できない環境 */ } };
  const setInputs = [...document.querySelectorAll('#settings [data-set]')];
  const fmt = (inp) => {
    const k = inp.dataset.set, v = Number(inp.value);
    if (inp.tagName === 'SELECT') return;
    inp.nextElementSibling.textContent = k === 'sens' ? v.toFixed(2) : Math.round(v * 100);
    inp.style.setProperty('--p', ((v - inp.min) / (inp.max - inp.min)) * 100 + '%');
  };
  const syncInputs = () => setInputs.forEach((inp) => { inp.value = S[inp.dataset.set]; fmt(inp); });
  setInputs.forEach((inp) => inp.addEventListener('input', () => {
    const k = inp.dataset.set;
    S[k] = Number(inp.value);
    fmt(inp); applySet(k, S[k]); saveSet();
  }));
  let screen = null; // null | 'menu' | 'settings' | 'credits' | 'bag'
  let lockT = 0;     // ポインターロックが外れた時刻（その Esc でメニューを閉じてしまわないように）
  const showScreen = (s) => {
    screen = s;
    $('menu').classList.toggle('show', s === 'menu');
    $('settings').classList.toggle('show', s === 'settings');
    $('credits').classList.toggle('show', s === 'credits');
    $('bag').classList.toggle('show', s === 'bag');
    $('paused').classList.remove('show');
    if (s === 'settings') syncInputs();
    if (s === 'bag') { bag.show(); amb.chime('open'); } else bag.hide();
    input.enabled = playing && !s;
    travel.enabled = playing && !s;
  };
  const openMenu = () => {
    if (!playing || travel.active || screen) return;
    pick?.close();
    input.unlock();
    showScreen('menu');
  };
  const resume = () => { showScreen(null); input.lock(); };
  // 持ち物（I）: 歩いているときに開く。もう一度 I か Esc で閉じる
  const openBag = () => {
    if (!playing || travel.active || talk.active || pick?.active || plant?.active || screen) return;
    showScreen('bag');
    input.unlock();
  };
  document.querySelectorAll('#menu [data-act], #settings [data-act], #credits [data-act], #bag [data-act]').forEach((b) => b.addEventListener('click', () => {
    const a = b.dataset.act;
    if (a === 'resume' || a === 'bag-close') resume();
    else if (a === 'bag') showScreen('bag');
    else if (a === 'settings') showScreen('settings');
    else if (a === 'credits') showScreen('credits');
    else if (a === 'back') showScreen('menu');
    else if (a === 'travel') { showScreen(null); travel.open(); }
    else if (a === 'fence' && DEBUG) setFree(!fence.free);
    else if (a === 'reset') { Object.assign(S, DEF); for (const k in DEF) applySet(k, S[k]); saveSet(); syncInputs(); }
  }));
  addEventListener('keydown', (e) => {
    if (e.code === 'KeyI' && !e.repeat) { if (screen === 'bag') resume(); else openBag(); return; }
    if (e.code === 'Escape' && $('game-card').classList.contains('show')) { $('game-card').querySelector('.gc-no').click(); return; }
    if (e.code !== 'Escape' || !playing || travel.active || e.repeat) return;
    if (performance.now() - lockT < 350) return;
    if (screen === 'bag') resume();
    else if (screen === 'settings' || screen === 'credits') showScreen('menu');
    else if (screen === 'menu') resume();
    else if (!input.locked) openMenu();
  });
  scene.add(travel.ring);

  // ---------- 町の人と会話 ----------
  const people = new TownPeople({ npcs: await peopleP, scene, world, segs });
  const talk = new Talk({ people: people.list.map((npc) => ({ npc, id: npc.id })), player, world, input, camera, scene });
  talk.onStart = () => { travel.enabled = false; };
  talk.onChar = (ch) => { if (!/[\s　、。，．！？!?…「」『』（）ー〜]/.test(ch)) amb.blip(); };
  talk.onEnd = () => { travel.enabled = playing && !screen; questHud.update(); };
  // 頼まれごと: 話しかけると先に頼みごとの話（quests.js）。わたした・もらったときは知らせを出す
  talk.director = quests;
  quests.on = {
    give: (want) => { notifyGive(want); amb.chime('give'); },
    reward: (yen) => { notifyReward(yen); amb.chime('coin'); const w = $('wallet'); w.classList.remove('bump'); void w.offsetWidth; w.classList.add('bump'); },
    change: () => questHud.update(),
  };
  const bag = new Bag({ progress, quests });
  const questHud = new QuestHud({ progress, quests });
  // 研究所を建て替えたら、降りる所・歩ける範囲・磯貝博士の立つ所を建物に合わせる
  sites.lab.onChange = (s) => {
    PLACES.lab.spot = s.place.spot; PLACES.lab.look = s.place.look;
    travel.setSpot('水産研究所', s.place.spot, s.place.look);
    setZones();
    PLACES.lab.npc = s.place.npc; PLACES.lab.npcYaw = s.place.npcYaw;
    people.move('isogai', ...s.place.npc, s.place.npcYaw);
  };
  // わたしてあった所は、見ていないあいだに建てかえる（空から遠くを見ているとき、または建物が画面の外でそばにいないとき）
  const frustum = new THREE.Frustum(), _pm = new THREE.Matrix4(), _box = new THREE.Box3();
  let rebuildT = 0;
  const rebuildHidden = (dt) => {
    if ((rebuildT -= dt) > 0 || talk.active) return;
    rebuildT = 0.5;
    for (const { id, site } of quests.pending()) {
      const s = sites[site], [x0, z0, x1, z1] = s.rect, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
      _pm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      frustum.setFromProjectionMatrix(_pm);
      _box.min.set(x0, -5, z0); _box.max.set(x1, 80, z1);
      const seen = frustum.intersectsBox(_box);
      const camFar = Math.hypot(camera.position.x - cx, camera.position.y, camera.position.z - cz) > 300;
      const away = Math.hypot(player.pos.x - cx, player.pos.z - cz) > 40;
      if (!camFar && (seen || !away)) continue;
      s.build(Math.min(s.levels.length - 1, (progress.data.stages[site] ?? 0) + 1));
      quests.rebuilt(id);
    }
  };
  // 遊び場のピン（アヒル島・南の浜・内の浜・外の浜・田んぼの側溝）→ 行くかどうかのカード → モリ突き（mori/?town）・蛤突き・ガザミ拾い・クサフグ拾い・鰻掬い（/<遊び>/?town）へ
  const gameCard = $('game-card');
  let gameOpen = null;
  const openGame = (p) => {
    travel.modal = true;
    gameOpen = p.info;
    gameCard.querySelector('.gc-icon').innerHTML = p.info.icon.replace(/#0b3a5a/g, '#f0a41c');
    gameCard.querySelector('.gc-sub').textContent = p.name;
    gameCard.querySelector('.gc-title').textContent = p.info.title;
    gameCard.querySelector('.gc-lead').innerHTML = p.info.lead;
    gameCard.querySelector('.gc-go').textContent = p.info.go;
    gameCard.classList.add('show');
  };
  const closeGame = () => { gameCard.classList.remove('show'); travel.modal = false; };
  gameCard.querySelector('.gc-no').addEventListener('click', closeGame);
  gameCard.addEventListener('pointerdown', (e) => { if (e.target === gameCard) closeGame(); });
  gameCard.querySelector('.gc-go').addEventListener('click', () => {
    const q = ['mute', 'debug'].filter((k) => new URLSearchParams(location.search).has(k));
    const url = gameOpen.url + q.map((k) => '&' + k).join('');
    $('fade').classList.add('on');
    amb.setVolume('master', 0);
    setTimeout(() => { location.href = url; }, 650);
  });
  $('bag-btn').addEventListener('click', openBag);
  // ?debug: 湊さんの家・研究所の前の目印で E → 大きさ（段階）をえらんで建て替える
  let pick = null;
  if (DEBUG) {
    pick = new StagePick({ sites: Object.values(sites), player, input, camera, scene, world });
    pick.onOpen = () => { travel.enabled = false; talk.enabled = false; };
    pick.onClose = () => { travel.enabled = playing && !screen; talk.enabled = true; };
  }

  // 植樹モード（?plant のときだけ。P で出入り）
  let plant = null;
  if (new URLSearchParams(location.search).has('plant')) {
    plant = new PlantEditor({ camera, canvas: $('c'), input, player, ground, planted, base: plantedData.trees, baseViews: plantedData.views, scene });
    plant.canToggle = () => playing && !screen && !travel.active;
    plant.onToggle = (on) => {
      travel.enabled = !on;
      if (!on) $('paused').classList.add('show'); // マウスの固定はクリックで戻す
    };
    const kh = document.createElement('div');
    kh.className = 'kh sub';
    kh.innerHTML = '<kbd>P</kbd><span>植樹モード</span>';
    $('keyhint').appendChild(kh);
  }


  await status('完了');
  // ---------- 開始 ----------
  $('loading').classList.remove('show');
  // いつも空の上から行き先をえらぶ（はじめて来たときも、遊び場から帰ってきたときも）
  let playing = false;
  const begin = () => {
    $('hud').classList.add('show');
    input.enabled = true;
    playing = true;
    travel.enabled = true;
    travel.openSky();
  };
  begin();
  // 音は、はじめて触ったときに鳴らしはじめる（ブラウザはそれまで音を出させない）
  const wake = () => { amb.start(); removeEventListener('pointerdown', wake, true); removeEventListener('keydown', wake, true); };
  addEventListener('pointerdown', wake, true);
  addEventListener('keydown', wake, true);
  $('c').addEventListener('click', () => { if (playing && !screen && !plant?.active && !input.locked && !input.freeLook) { $('paused').classList.remove('show'); input.lock(); } });
  // Esc でマウスが離れたら、モリ突きと同じくメニューを開く
  input.onLockChange = (locked) => {
    if (locked) { $('paused').classList.remove('show'); return; }
    lockT = performance.now();
    if (playing && !travel.active && !screen && !plant?.active) openMenu();
  };
  $('menu-btn').addEventListener('click', openMenu);

  if (new URLSearchParams(location.search).has('debug')) {
    window.town = { pick, sites, progress, quests, bag, questHud, rebuildHidden, amb,
      // 確認用: 持ち物を足す・頼まれごとの物をそろえる・進みぐあいを消す
      give: (id, n = 1) => { progress.add(id, n); progress.write(); questHud.update(); },
      fill: (who) => { const q = quests.quest(who); if (q) for (const [id, n] of Object.entries(q.want)) progress.add(id, Math.max(0, n - progress.count(id))); progress.write(); questHud.update(); },
      resetProgress: () => { progress.reset(); location.reload(); }, people, talk, planted, plant, paddies, woods, farms, front, scene, camera, player, world, data, mask, T, PLACES, renderer, begin, hud, B, lots, grass, composer, treeGroup, treeFit, bootTimes, travel, fence, setFree,
      tp: (x, z, f) => player.place(x, z, f ?? player.facing),
      // 確認用: 好きな位置から見る（town.look(null) で戻る）
      look: (p, t) => { dbgCam = p ? { p: new THREE.Vector3(...p), t: new THREE.Vector3(...t) } : null; } };
  }

  // ---------- ループ ----------
  let dbgCam = null;
  const clock = new THREE.Clock();
  let lastStep = 0, wasGround = true;

  // ---------- 音: 足もとの地面と、まわりのようす ----------
  const GRASSY = new Set(['grass', 'farm', 'paddy', 'levee', 'forest', 'yard']);
  const surfaceAt = (p) => {
    if (p.y > ground(p.x, p.z) + 0.08) return 'asphalt'; // 地面より上 = 橋・防波堤・ホーム（コンクリート）
    const m = mask.get(p.x, p.z), c = cellOf(p.x, p.z), kind = c >= 0 ? T.kinds[c] : 'town';
    if (kind === 'sand' || kind === 'sea' || (m & M.BEACH)) return 'sand';
    if (m & (M.ROAD | M.PAVE)) return 'asphalt';
    if (m & (M.LAWN | M.LEVEE)) return 'grass';
    if (m & (M.LOT | M.FARMSTEAD)) return 'gravel';
    return GRASSY.has(kind) ? 'grass' : 'soil';
  };
  const chan = channelStrip(); // 定食屋の前の用水路 [ax, az, bx, bz, 半幅]
  const furins = [PLACES.teishoku, PLACES.home]; // 風鈴を吊るした軒先
  const around = { nearSea: 0, water: 0, paddy: 0, forest: 0, furin: 0, furinPan: 0 };
  let soundT = 0;
  const RING = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [0.7, 0.7], [-0.7, 0.7], [0.7, -0.7], [-0.7, -0.7]];
  const kindCount = (p, r, want) => {
    let n = 0;
    for (const [dx, dz] of RING) { const c = cellOf(p.x + dx * r, p.z + dz * r); if (c >= 0 && T.kinds[c] === want) n++; }
    return n;
  };
  const smooth = (a, b, x) => THREE.MathUtils.smoothstep(x, a, b);
  const _right = new THREE.Vector3();
  const aroundSound = (p) => {
    let sea = 0;
    for (const [dx, dz] of [[0, 0], [25, 0], [-25, 0], [0, 25], [0, -25], [45, 45], [-45, 45], [45, -45], [-45, -45]]) if (ground(p.x + dx, p.z + dz) < -0.3) sea++;
    around.nearSea = Math.min(1, sea / 4);
    // 水路（線分までの距離）と、川・池（水のマス）
    let w = 0;
    if (chan) {
      const [ax, az, bx, bz] = chan, ux = bx - ax, uz = bz - az;
      const s = Math.max(0, Math.min(1, ((p.x - ax) * ux + (p.z - az) * uz) / (ux * ux + uz * uz)));
      w = 1 - smooth(2, 16, Math.hypot(p.x - ax - ux * s, p.z - az - uz * s));
    }
    around.water = Math.max(w, Math.min(1, (kindCount(p, 6, 'water') + kindCount(p, 14, 'water')) / 6));
    around.paddy = Math.min(1, (kindCount(p, 12, 'paddy') + kindCount(p, 30, 'paddy')) / 8);
    around.forest = Math.min(1, (kindCount(p, 10, 'forest') + kindCount(p, 25, 'forest')) / 8);
    // 風鈴: いちばん近い軒先。向きはカメラの右を +
    let best = 0, bx = 0, bz = 0;
    for (const f of furins) {
      const fx = f.x, fz = f.z, v = 1 - smooth(4, 24, Math.hypot(p.x - fx, p.z - fz));
      if (v > best) { best = v; bx = fx; bz = fz; }
    }
    around.furin = best;
    if (best > 0) {
      _right.setFromMatrixColumn(camera.matrixWorld, 0);
      const dx = bx - p.x, dz = bz - p.z, d = Math.hypot(dx, dz) || 1;
      around.furinPan = (dx * _right.x + dz * _right.z) / d;
    }
  };
  // 描く回数を上限までに間引く（高リフレッシュレートの画面で GPU が回りっぱなしにならないように）。
  // メニューを開いている間・タイトル画面・ほかのウィンドウを触っている間は 30 回まで
  let lastFrame = -1e9;
  // フレームレートの表示: 実際に描いた回数を 0.5 秒ごとに数える
  const fpsEl = $('fps');
  let fpsN = 0, fpsT = performance.now();
  const loop = (now = performance.now()) => {
    requestAnimationFrame(loop);
    let cap = fpsCap;
    if (screen || !playing || !document.hasFocus()) cap = cap ? Math.min(cap, 30) : 30;
    if (cap) {
      const iv = 1000 / cap, e = now - lastFrame;
      if (e < iv - 1) return;
      // 描く時刻は iv ごとの目盛りに合わせて進める（now - e % iv だと、e が iv をわずかに下回ったときに
      // 目盛りが 1 つずれ、120Hz の画面で 8ms と 17ms の間隔がまざってガタつく）。大きく遅れたら今から数えなおす
      lastFrame = e > iv * 3 ? now : lastFrame + iv;
    }
    const dt = Math.min(clock.getDelta(), 0.05);
    TIME.value += dt;
    U.uTime.value = TIME.value;
    rebuildHidden(dt);
    if (travel.active) { travel.update(dt, input); talk.hidePrompt(); }
    else if (playing && !screen) { if (!talk.update(dt, camera) && !pick?.update(dt, camera)) player.update(dt, camera); }
    else { player.idle(dt); if (!talk.active && !pick?.active) player.updateCamera(dt, camera); talk.hidePrompt(); pick?.hidePrompt(); }
    people.update(dt, { camera, player, active: playing && !screen && !travel.active });
    if (dbgCam) { camera.position.copy(dbgCam.p); camera.lookAt(dbgCam.t); }
    fence.update(dt, { time: TIME.value, player, camera, sky: travel.active ? travel.sky : 0, walking: playing && !screen && !travel.active });
    const p = player.pos;
    // カメラと主人公の間の葉を透かす（空から見ているときはしない）
    FOCUS.value.set(p.x, p.y + 1.1, p.z, travel.active || dbgCam ? 0 : 1);
    // 影のカメラはプレイヤー（空から見ているときは見ている所）について行く
    const fc = dbgCam ? dbgCam.t : travel.active ? travel.focus : p;
    setShadowRange(sun, travel.active ? Math.max(60, Math.min(700, travel.rig.dist * 1.1)) : 60);
    followShadow(sun, fc.x, fc.y, fc.z);
    sun.shadow.autoUpdate = !travel.still; // 空から止まって見ている間は影を描き直さない
    sky.update(camera);
    water2.update(camera);
    grass.update(camera, player.pos, travel.active ? Math.max(0, camera.position.y - ground(camera.position.x, camera.position.z) - 12) : 0);
    landmarks.userData.update(TIME.value);
    if (playing) {
      if (!travel.active) hud.update(p);
      // 足音（ジャンプの着地も）
      const ph = Math.floor(player.kid.phase / Math.PI);
      if (!travel.active) {
        if (ph !== lastStep && player.speed > 0.8 && player.onGround) amb.step(surfaceAt(p), player.speed > 5);
        if (player.onGround && !wasGround) amb.land(surfaceAt(p));
      }
      lastStep = ph; wasGround = player.onGround;
      // まわりのようす（海・水路・田・林・風鈴）は 0.25 秒ごとに見る
      if ((soundT -= dt) <= 0) { soundT = 0.25; aroundSound(p); }
      amb.update(dt, { ...around, time: TIME.value, sky: travel.sky, rush: travel.rush });
    }
    input.endFrame();
    // 遠くの木の区画は描かない
    updateTrees(treeGroup, camera, { far: travel.active ? Math.max(420, travel.rig.dist * 1.5) : 420 });
    planted.update(camera, travel.active ? Math.max(420, travel.rig.dist * 1.5) : 420);
    plant?.update();
    woods.userData.update(camera);
    front.userData.update(camera, player);
    composer.render();
    fpsN++;
    if (now - fpsT >= 500) {
      const fps = (fpsN * 1000) / (now - fpsT);
      fpsEl.textContent = Math.round(fps) + ' FPS';
      // 色は今の上限（メニュー中は 30 など）に対して: 8 割未満で黄、半分未満で赤
      const goal = cap || 60;
      fpsEl.className = fps < goal * 0.5 ? 'bad' : fps < goal * 0.8 ? 'low' : '';
      fpsN = 0; fpsT = now;
    }
  };
  loop();
}

boot().catch((e) => {
  console.error(e);
  $('load-msg').textContent = '読み込みに失敗しました: ' + e.message;
});
