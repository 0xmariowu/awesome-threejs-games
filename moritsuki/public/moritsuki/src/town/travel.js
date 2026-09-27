// ファストトラベル: F で空へ上がって町を見下ろし、行き先をクリックすると空を渡って降りていく
// カメラは「注視点・向き・傾き・距離」で表す。上昇・移動・降下はどれも van Wijk & Nuij の
// ズームとパンの最適経路（d3.interpolateZoom と同じ式）でつなぐので、遠い所ほど少し高く上がってから渡る。
// 傾きはカメラの距離（高さ）で決まり、上がるほど見下ろし、降りるほど水平に戻って主人公の背中に収まる。
import * as THREE from 'three';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { HorizontalTiltShiftShader } from 'three/addons/shaders/HorizontalTiltShiftShader.js';
import { VerticalTiltShiftShader } from 'three/addons/shaders/VerticalTiltShiftShader.js';
import { GAMES, NAMED } from './hud.js';
import { M, PLACES } from './layout.js';

const MAP_DIST = 430, MIN_DIST = 170, MAX_DIST = 950;
const MAP_PITCH = 0.98;          // 空から見下ろす傾き（約 56°）
const LOW = 6, HIGH = 220;       // この距離の間で、傾き・音・ぼかしが「空」へ移っていく
const RHO = Math.SQRT2, WK = 1.1; // 経路の曲がり具合と、距離→見える幅の換算
const UP_TIME = 1.35;

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const ease = (t) => t * t * t * (t * (t * 6 - 15) + 10);
const lerpAngle = (a, b, t) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t;
const skyK = (dist) => clamp01(Math.log(dist / LOW) / Math.log(HIGH / LOW));

// ズームとパンの最適経路。s: 0..1 → [x, z, w, パンの進み具合]
function zoomPath(x0, z0, w0, x1, z1, w1) {
  const dx = x1 - x0, dz = z1 - z0, d2 = dx * dx + dz * dz;
  if (d2 < 1e-4) {
    const S = Math.log(w1 / w0) / RHO;
    return { S: Math.abs(S), at: (s) => [x0 + dx * s, z0 + dz * s, w0 * Math.exp(RHO * S * s), s] };
  }
  const d1 = Math.sqrt(d2), r2 = RHO * RHO, r4 = r2 * r2;
  const b0 = (w1 * w1 - w0 * w0 + r4 * d2) / (2 * w0 * r2 * d1);
  const b1 = (w1 * w1 - w0 * w0 - r4 * d2) / (2 * w1 * r2 * d1);
  const q0 = Math.log(Math.sqrt(b0 * b0 + 1) - b0), q1 = Math.log(Math.sqrt(b1 * b1 + 1) - b1);
  const S = (q1 - q0) / RHO, ch0 = Math.cosh(q0);
  return {
    S,
    at: (s) => {
      const r = RHO * s * S + q0;
      const u = (w0 / (r2 * d1)) * (ch0 * Math.tanh(r) - Math.sinh(q0));
      return [x0 + u * dx, z0 + u * dz, (w0 * ch0) / Math.cosh(r), u];
    },
  };
}

export class FastTravel {
  // onGame(p): 遊び場のピン（hud.js の NAMED の game）を押したとき。unlocked(spot): その遊び場が遊べるか
  constructor({ camera, player, world, ground, mask, core, composer, gtao, fence, onArrive, onGame, unlocked = () => true, noLand = [] }) {
    this.onGame = onGame; this.unlocked = unlocked;
    this.modal = false;      // 遊び場のカードを出している間は地図を触れない
    this.fence = fence;      // 進入禁止の輪（地名のまわりにしか降りられない）
    this.noLand = noLand;    // 地面をクリックしても降りられない所 [x, z, r]（自分の家のまわり）
    this.gtao = gtao; this.aoBlend = gtao ? gtao.blendIntensity : 0;
    this.still = false;      // 空から見ていて、止まっている（影を描き直さなくてよい）
    this.camera = camera; this.player = player; this.world = world; this.ground = ground;
    this.mask = mask; this.core = core; this.onArrive = onArrive;
    this.state = 'off';      // off | up | map | go
    this.enabled = false;    // 歩きはじめてから
    this.rig = { x: 0, z: 0, ty: 0, yaw: 0, dist: 6.5 };
    this.distGoal = MAP_DIST;
    this.pull = 0;           // 建物をよけて手前に寄せている分
    this.sky = 0; this.rush = 0;
    this.focus = new THREE.Vector3();
    this.prevCam = new THREE.Vector3();
    this.el = document.getElementById('travel');
    this.tip = document.getElementById('tv-tip');
    this.hover = null;       // { x, z, ok, name, pin }
    this.cursor = { x: 0, y: 0, inside: false };

    // 行き先の候補（地名ごとに、立てる場所を探しておく）
    this.places = [];
    const pinsEl = document.getElementById('tv-pins');
    this.named = NAMED(); // カーソルの下の地名（行き先でない地名も）
    for (const n of this.named) {
      if (n.travel === false) continue;
      const home = n.name === '自分の家';
      if (n.game) { this.places.push(this.gamePin(n, pinsEl)); continue; }
      // 目印の建物は、建物の正面が見える決まった場所に降りる（landmarks.js が PLACES に書く）
      const spot = n.sea ? null : n.spot ? n.spot : home ? [PLACES.start.x, PLACES.start.z] : this.findSpot(n.x, n.z, Math.min(n.r, 45), true);
      const el = document.createElement(spot ? 'button' : 'div');
      el.className = 'tv-pin' + (spot ? '' : ' area') + (home ? ' home' : '');
      el.innerHTML = spot ? `<span class="lb">${n.name}</span><i></i>` : `<span class="lb">${n.name}</span>`;
      pinsEl.appendChild(el);
      // 降りたときに向く所（毎回同じ）: 家は歩きはじめと同じく道の先、駅は駅舎、
      // ほかは地名の中心が離れていればそちら、近ければいちばん開けた方
      let look = null;
      if (n.look) look = n.look;
      else if (home) look = [spot[0] + PLACES.street.dir[0] * 10, spot[1] + PLACES.street.dir[1] * 10];
      else if (n.name === '吉山駅' && PLACES.station.look) look = PLACES.station.look;
      else if (spot && Math.hypot(n.x - spot[0], n.z - spot[1]) > 4) look = [n.x, n.z];
      else if (spot) look = this.openView(spot[0], spot[1]);
      const p = { ...n, spot, el, y: 0, look };
      p.y = spot ? world.groundAt(spot[0], spot[1], 99) : Math.max(0, ground(n.x, n.z));
      if (spot) {
        el.addEventListener('pointerenter', () => { this.pinHover = p; });
        el.addEventListener('pointerleave', () => { if (this.pinHover === p) this.pinHover = null; });
      }
      this.places.push(p);
    }
    this.me = document.createElement('div');
    this.me.className = 'tv-me';
    this.me.innerHTML = '<span class="lb">自分</span><i></i>';
    pinsEl.appendChild(this.me);
    this.mePos = new THREE.Vector3();

    // 地面の目印（行き先の輪）
    const ringMat = new THREE.MeshBasicMaterial({ color: '#fffdf2', transparent: true, depthTest: false, depthWrite: false, fog: false, toneMapped: false });
    this.ring = new THREE.Group();
    const r1 = new THREE.Mesh(new THREE.RingGeometry(0.78, 1, 64).rotateX(-Math.PI / 2), ringMat);
    const r2 = new THREE.Mesh(new THREE.CircleGeometry(0.22, 32).rotateX(-Math.PI / 2), ringMat);
    this.ring.add(r1, r2);
    this.ring.traverse((o) => { o.renderOrder = 999; o.userData.noAO = true; o.frustumCulled = false; });
    this.ring.userData.noAO = true;
    this.ring.visible = false;
    this.ringMat = ringMat;

    // 空から見るときのジオラマ風のぼかし（画面の上下）
    this.tiltH = new ShaderPass(HorizontalTiltShiftShader);
    this.tiltV = new ShaderPass(VerticalTiltShiftShader);
    for (const p of [this.tiltH, this.tiltV]) { p.uniforms.r.value = 0.5; p.enabled = false; }
    const at = composer.passes.length - 1; // 出力の手前
    composer.insertPass(this.tiltV, at);
    composer.insertPass(this.tiltH, at);

    this.bindInput();
  }

  get active() { return this.state !== 'off'; }

  // ---------- 立てる場所 ----------
  canStand(x, z) {
    const W = this.world;
    if (!this.core.inside(x, z, 45)) return false;
    if (W.blocked(x, z) || (this.mask.get(x, z) & M.BLD) || W.waterDepth(x, z) > 0.05) return false;
    for (const [dx, dz] of [[0.9, 0], [-0.9, 0], [0, 0.9], [0, -0.9]]) if (W.blocked(x + dx, z + dz)) return false;
    const y = W.groundAt(x, z, 99);
    for (const s of W.segs.near(x, z)) {
      if (s.top < y + 0.45) continue;
      const ex = s.bx - s.ax, ez = s.bz - s.az, l2 = ex * ex + ez * ez;
      const t = l2 ? clamp01(((x - s.ax) * ex + (z - s.az) * ez) / l2) : 0;
      if (Math.hypot(x - s.ax - ex * t, z - s.az - ez * t) < s.r + 0.55) return false;
    }
    return true;
  }

  // (x, z) から見ていちばん開けた方向の点（建物・壁・水にぶつかるまでの距離が長い向き）
  openView(x, z) {
    let best = 0, bd = -1;
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2, dx = Math.sin(a), dz = Math.cos(a);
      let d = 0;
      while (d < 30 && !this.world.blocked(x + dx * (d + 1), z + dz * (d + 1)) && !(this.mask.get(x + dx * (d + 1), z + dz * (d + 1)) & M.BLD)) d += 1;
      if (d > bd + 0.5) { bd = d; best = a; }
    }
    return [x + Math.sin(best) * 10, z + Math.cos(best) * 10];
  }

  // (x, z) の近くで立てる場所。place: 地名の行き先（人の家の庭は避け、道を少し好む）
  findSpot(x, z, rMax, place = false) {
    let best = null, bestS = Infinity;
    for (let r = 0; r <= rMax; r += 1.5) {
      if (!place && best) break;
      if (r - 3 > bestS) break;
      const n = r === 0 ? 1 : Math.ceil((2 * Math.PI * r) / 1.5);
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2, px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
        if (!this.canStand(px, pz)) continue;
        const m = this.mask.get(px, pz);
        const s = r + (place ? ((m & M.LOT) ? 15 : 0) - ((m & M.ROAD) ? 3 : 0) : 0);
        if (s < bestS) { bestS = s; best = [px, pz]; }
      }
    }
    return best;
  }

  // ---------- 入力 ----------
  bindInput() {
    const el = this.el;
    addEventListener('keydown', (e) => {
      if (!this.enabled || e.repeat || this.modal) return;
      if (e.code === 'KeyF') {
        if (this.state === 'off') this.open();
        else if (this.state === 'map' || this.state === 'up') this.back();
      } else if (e.code === 'Escape' && this.state === 'map') this.back();
    });
    let down = null;
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    el.addEventListener('pointermove', (e) => {
      this.cursor.x = e.clientX; this.cursor.y = e.clientY; this.cursor.inside = true;
      if (!down || this.state !== 'map') return;
      if (!down.drag && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) down.drag = true;
      // 動かすのは update で 1 フレームに 1 回（ここで動かすと、次に描くまでカメラが古いままなので、
      // 1 フレームに何度もずれを足して行き過ぎ、描く回数が少ないほど画面がバタつく）
      if (down.drag && down.grab) this.dragTo = { x: e.clientX, y: e.clientY, grab: down.grab };
    });
    el.addEventListener('pointerleave', () => { this.cursor.inside = false; });
    el.addEventListener('pointerdown', (e) => {
      if (this.state !== 'map' || this.modal) return;
      if (e.button === 2) { this.back(); return; }
      if (e.button !== 0) return;
      el.setPointerCapture?.(e.pointerId);
      const g = this.rayPlane(e.clientX, e.clientY, this.rig.ty);
      down = { x: e.clientX, y: e.clientY, drag: false, grab: g, pin: this.pinAt(e.clientX, e.clientY) };
    });
    el.addEventListener('pointerup', (e) => {
      if (e.button !== 0 || !down) return;
      const d = down; down = null;
      this.dragTo = null;
      if (d.drag || this.state !== 'map') return;
      // ピン（またはピンのすぐ近く）を押したときは、いつもそのピンの地点・向きへ
      if (d.pin) { if (d.pin.game) this.onGame?.(d.pin); else this.go(this.pinTarget(d.pin)); return; }
      const h = this.hover;
      if (h && h.ok) this.go(h);
      else if (h) this.tip.classList.remove('nope'), void this.tip.offsetWidth, this.tip.classList.add('nope');
    });
    el.addEventListener('wheel', (e) => {
      e.stopPropagation();
      if (this.state !== 'map') return;
      this.distGoal = THREE.MathUtils.clamp(this.distGoal * Math.exp(Math.sign(e.deltaY) * 0.16), MIN_DIST, MAX_DIST);
    }, { passive: true });
  }

  // 遊び場のピン（アヒル島のモリ突き・南の浜の蛤突き）: 紺に橙の絵。押すと onGame
  gamePin(n, pinsEl) {
    const G = GAMES[n.game];
    const el = document.createElement('button');
    el.className = 'tv-pin game';
    el.innerHTML = `<span class="lb"><span class="gi">${G.icon}</span>${n.name}<small>${G.title}</small></span><i></i>`;
    pinsEl.appendChild(el);
    // 決まった場所（at）か、peak なら地名の座標のまわり（40 m）でいちばん高い所（島の頂）に立てる
    let spot = n.at || [n.x, n.z], top = this.ground(spot[0], spot[1]);
    if (G.peak) for (let dz = -40; dz <= 40; dz += 3) for (let dx = -40; dx <= 40; dx += 3) {
      const h = this.ground(n.x + dx, n.z + dz);
      if (dx * dx + dz * dz <= 1600 && h > top) { top = h; spot = [n.x + dx, n.z + dz]; }
    }
    const p = { ...n, spot, el, y: Math.max(0.5, top) + 2, look: null, info: G };
    el.addEventListener('pointerenter', () => { this.pinHover = p; });
    el.addEventListener('pointerleave', () => { if (this.pinHover === p) this.pinHover = null; });
    return p;
  }

  // 画面の点に近いピン（ラベルの上、または点から 34px 以内）
  pinAt(sx, sy) {
    if (this.pinHover) return this.pinHover;
    let best = null, bd = 34;
    for (const p of this.places) {
      if (!p.spot || !p.scr || this.hidden(p)) continue;
      const d = Math.hypot(sx - p.scr[0], sy - p.scr[1]);
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }

  // 地名の降りる所を変える（?debug で研究所を建て替えたとき）
  setSpot(name, spot, look) {
    const p = this.places.find((q) => q.name === name);
    if (!p) return;
    p.spot = spot; p.look = look;
    p.y = this.world.groundAt(spot[0], spot[1], 99);
  }
  pinTarget(p) { return { x: p.spot[0], z: p.spot[1], ok: true, name: p.name, face: p.look, game: p.game ? p : null }; }
  // まだ遊べない遊び場のピンは出さない
  hidden(p) { return !!p.unlock && !this.unlocked(p.unlock); }

  // ---------- 状態の切り替え ----------
  open() {
    const P = this.player, input = P.input;
    P.frozen = true;
    P.speed = 0;
    input.unlock();
    const t = P.camTarget();
    Object.assign(this.rig, { x: t.x, z: t.z, ty: t.y, yaw: P.camYaw, dist: this.camera.position.distanceTo(t) });
    this.pull = 0;
    this.distGoal = MAP_DIST;
    const gy = Math.max(0, this.ground(t.x, t.z));
    this.flight = { path: zoomPath(t.x, t.z, this.rig.dist * WK, t.x, t.z, MAP_DIST * WK), dur: UP_TIME, t: 0, ty0: t.y, ty1: gy, yaw0: P.camYaw, yaw1: P.camYaw, end: 'map' };
    // 今のカメラ（少し遅れて追っている）との差を、はじめの間に溶かす
    this.flight.offset = this.camera.position.clone().sub(this.pose(t, P.camYaw, this.pitchAt(this.rig.dist), this.rig.dist, new THREE.Vector3()));
    this.planBoost(this.flight);
    this.mePos.copy(P.pos);
    this.state = 'up';
    this.prevCam.copy(this.camera.position);
    this.el.querySelector('.tv-sub').textContent = this.fence?.limited ? '地名か、赤い輪の中をクリック' : '行きたい場所をクリック';
    document.body.classList.add('sky');
  }

  // はじめから空の上（飛び上がらずに、いちばん引いた高さで待つ）。
  // 自分の家からアヒル島の方を見て、湾・島・町がそろって入るところ。
  // 島のピンの札が「どこへ行こう？」のすぐ下（GAP px あけて）に来るよう、家から島への線の上で見る所をずらす
  openSky() {
    const P = this.player, I = PLACES.island, GAP = 26;
    P.frozen = true;
    P.speed = 0;
    this.pull = 0;
    this.distGoal = MAX_DIST;
    this.flight = null;
    this.mePos.copy(P.pos);
    this.state = 'map';
    this.el.querySelector('.tv-sub').textContent = this.fence?.limited ? '地名か、赤い輪の中をクリック' : '行きたい場所をクリック';
    this.el.classList.add('show');
    document.body.classList.add('sky');
    const pin = this.places.find((p) => p.game === 'mori');
    const head = this.el.querySelector('.tv-head');
    const want = head.offsetTop + head.offsetHeight + GAP + (pin ? pin.el.querySelector('.lb').offsetHeight + 13 : 50);
    const at = (k) => {
      const x = P.pos.x + (I.x - P.pos.x) * k, z = P.pos.z + (I.z - P.pos.z) * k;
      Object.assign(this.rig, { x, z, ty: Math.max(0, this.ground(x, z)), yaw: P.camYaw, dist: MAX_DIST });
    };
    if (pin) {
      // k が大きいほど島は画面の下へ。二分法で合わせる
      const cam = this.camera, tgt = new THREE.Vector3(), v = new THREE.Vector3();
      let lo = 0, hi = 1.2;
      for (let n = 0; n < 24; n++) {
        const k = (lo + hi) / 2;
        at(k);
        tgt.set(this.rig.x, this.rig.ty, this.rig.z);
        this.pose(tgt, this.rig.yaw, Math.min(1.45, this.pitchAt(MAX_DIST)), MAX_DIST, cam.position);
        cam.lookAt(tgt);
        cam.updateMatrixWorld();
        v.set(pin.spot[0], pin.y + 1, pin.spot[1]).project(cam);
        if (((1 - v.y) / 2) * innerHeight < want) lo = k; else hi = k;
      }
      at((lo + hi) / 2);
    } else at(0.58);
    this.prevCam.copy(this.camera.position);
  }

  // 自分のところへ戻る
  back() {
    const P = this.player;
    this.flyTo(P.pos.x, P.pos.z, P.camYaw, null);
    P.input.lock({ soft: true });
  }

  // 行き先へ
  go(h) {
    const P = this.player;
    let facing = this.rig.yaw + Math.PI; // 見ていた向きのまま降りる
    if (h.face) facing = Math.atan2(h.face[0] - h.x, h.face[1] - h.z);
    this.from = P.pos.clone();
    P.place(h.x, h.z, facing);
    P.speed = 0;
    this.dest = { x: h.x, z: h.z, y: P.pos.y };
    // 地名のまわりへ降りたら、禁止に戻したときの仮の輪はもういらない
    if (this.fence?.limited && this.fence.inside(h.x, h.z, false)) this.fence.setExtra(null);
    this.flyTo(h.x, h.z, facing + Math.PI, this.from);
    P.input.lock({ soft: true });
  }

  flyTo(x, z, yaw1, from) {
    const P = this.player, r = this.rig;
    const ty1 = P.pos.y + 1.35;
    // 降りきった所は、いつもの三人称カメラが建物をよけて置く位置そのもの（引き継ぎで動かない）
    const head = new THREE.Vector3(x, ty1, z);
    const d1 = Math.max(1.2, P.rigPose(head, yaw1, P.camPitch, P.camDist).distanceTo(head));
    const path = zoomPath(r.x, r.z, r.dist * WK, x, z, d1 * WK);
    const dur = THREE.MathUtils.clamp(0.55 * path.S + 0.5, 1.5, 3.4);
    this.flight = { path, dur, t: 0, ty0: r.ty, ty1, yaw0: r.yaw, yaw1, end: 'off', from, hop: from ? Math.hypot(x - from.x, z - from.z) : 0 };
    this.planBoost(this.flight);
    this.state = 'go';
    this.hover = null;
    this.tip.classList.remove('show');
    this.el.classList.remove('show');
  }

  land() {
    const P = this.player;
    this.state = 'off';
    this.flight = null;
    P.frozen = false;
    P.camYaw = this.rig.yaw;
    P.camPos.copy(this.camera.position);
    this.camera.near = 0.15; this.camera.updateProjectionMatrix();
    this.ring.visible = false;
    for (const p of [this.tiltH, this.tiltV]) p.enabled = false;
    if (this.gtao) { this.gtao.blendIntensity = this.aoBlend; this.gtao.enabled = true; }
    this.still = false;
    this.sky = 0; this.rush = 0;
    document.body.classList.remove('sky');
    this.onArrive?.();
  }

  // ---------- カメラ ----------
  // 飛行の途中の位置（e: 0..1）
  sample(f, e) {
    const [x, z, w, u] = f.path.at(e);
    return { x, z, dist: w / WK, ty: THREE.MathUtils.lerp(f.ty0, f.ty1, u), yaw: lerpAngle(f.yaw0, f.yaw1, e) };
  }

  // 主人公の近くで建物や木が間に入るところは、先回りしてカメラを高くして越える（寄せて飛び込むとカクッとなる）
  planBoost(f) {
    const N = 90, need = new Float32Array(N + 1), P = this.player;
    const tgt = new THREE.Vector3(), tmp = new THREE.Vector3();
    for (let i = 0; i <= N; i++) {
      const s = this.sample(f, i / N);
      if (s.dist >= 45) continue;
      tgt.set(s.x, s.ty, s.z);
      const base = this.pitchAt(s.dist);
      for (let b = 0; b <= 1.0001; b += 0.1) {
        const p = Math.min(1.45, base + b);
        need[i] = p - base;
        if (P.rigPose(tgt, s.yaw, p, s.dist, tmp).distanceTo(tgt) >= s.dist * 0.97 - 0.05) break;
      }
    }
    // 早めに上がって、ゆっくり戻る（折れ目はならす）
    const env = new Float32Array(N + 1);
    for (let i = 0; i <= N; i++) { let m = 0; for (let j = 0; j <= N; j++) m = Math.max(m, need[j] - Math.abs(i - j) * 0.035); env[i] = m; }
    f.boost = env.map((_, i) => (env[Math.max(0, i - 2)] + env[Math.max(0, i - 1)] + env[i] + env[Math.min(N, i + 1)] + env[Math.min(N, i + 2)]) / 5);
  }

  boostAt(f, e) {
    if (!f || !f.boost) return 0;
    const N = f.boost.length - 1, x = e * N, i = Math.min(N - 1, Math.floor(x));
    return THREE.MathUtils.lerp(f.boost[i], f.boost[i + 1], x - i);
  }

  // 傾きは距離で決まる（主人公の後ろのいつもの距離では、いつもの傾き）
  pitchAt(dist) {
    const lo = Math.max(LOW, this.player.camDist);
    const k = clamp01(Math.log(dist / lo) / Math.log(HIGH / lo));
    return THREE.MathUtils.lerp(this.player.camPitch, MAP_PITCH, k * k * (3 - 2 * k));
  }

  pose(tgt, yaw, pitch, dist, out) {
    const cp = Math.cos(pitch);
    return out.set(tgt.x + Math.sin(yaw) * cp * dist, tgt.y + Math.sin(pitch) * dist, tgt.z + Math.cos(yaw) * cp * dist);
  }

  clampRig() {
    const c = this.core;
    this.rig.x = THREE.MathUtils.clamp(this.rig.x, c.x0 + 40, c.x1 - 40);
    this.rig.z = THREE.MathUtils.clamp(this.rig.z, c.z0 + 40, c.z1 - 40);
  }

  // 画面の点から、高さ y の水平面へ
  rayPlane(sx, sy, y) {
    const ray = this.ray(sx, sy);
    if (Math.abs(ray.direction.y) < 1e-4) return null;
    const t = (y - ray.origin.y) / ray.direction.y;
    return t > 0 ? ray.origin.clone().addScaledVector(ray.direction, t) : null;
  }

  ray(sx, sy) {
    const v = new THREE.Vector2((sx / innerWidth) * 2 - 1, -(sy / innerHeight) * 2 + 1);
    const rc = (this._rc ||= new THREE.Raycaster());
    rc.setFromCamera(v, this.camera);
    return rc.ray;
  }

  // 画面の点から、地面（海は海面）へ
  pickGround(sx, sy) {
    const { origin: o, direction: d } = this.ray(sx, sy);
    const h = (x, z) => Math.max(0, this.ground(x, z));
    let t = this.camera.near, prev = t;
    while (t < 5000) {
      const x = o.x + d.x * t, z = o.z + d.z * t;
      if (o.y + d.y * t <= h(x, z)) {
        let a = prev, b = t;
        for (let i = 0; i < 8; i++) { const m = (a + b) / 2; if (o.y + d.y * m <= h(o.x + d.x * m, o.z + d.z * m)) b = m; else a = m; }
        return new THREE.Vector3(o.x + d.x * b, o.y + d.y * b, o.z + d.z * b);
      }
      prev = t;
      t += Math.max(1.5, t * 0.01);
    }
    return null;
  }

  // ---------- 毎フレーム ----------
  update(dt, input) {
    const cam = this.camera, P = this.player, r = this.rig;
    input.consumeMouse();
    P.kid.animate(dt, 0, false);
    P.kid.root.position.copy(P.pos);
    P.kid.root.rotation.y = P.facing;
    const tgt = new THREE.Vector3();
    let offset = null, boost = 0;

    if (this.state === 'up' || this.state === 'go') {
      const f = this.flight;
      f.t = Math.min(1, f.t + dt / f.dur);
      const e = ease(f.t);
      const smp = this.sample(f, e);
      const u = f.path.at(e)[3];
      r.x = smp.x; r.z = smp.z; r.dist = smp.dist; r.ty = smp.ty; r.yaw = smp.yaw;
      boost = this.boostAt(f, e);
      if (f.offset) offset = f.offset.clone().multiplyScalar(1 - ease(clamp01(f.t / 0.35)));
      // 自分の印は、行き先へひとっ跳び
      if (f.from) {
        const d = this.dest;
        this.mePos.set(THREE.MathUtils.lerp(f.from.x, d.x, u), THREE.MathUtils.lerp(f.from.y, d.y, u) + Math.sin(Math.PI * u) * Math.min(80, f.hop * 0.18), THREE.MathUtils.lerp(f.from.z, d.z, u));
      } else this.mePos.copy(P.pos);
    } else if (this.state === 'map') {
      // WASD で動かす、Q/E で回す、ホイールで高さ
      let ix = 0, iz = 0;
      if (input.down('KeyW') || input.down('ArrowUp')) iz += 1;
      if (input.down('KeyS') || input.down('ArrowDown')) iz -= 1;
      if (input.down('KeyA') || input.down('ArrowLeft')) ix -= 1;
      if (input.down('KeyD') || input.down('ArrowRight')) ix += 1;
      if (ix || iz) {
        const sp = r.dist * (input.down('ShiftLeft') ? 1.6 : 0.8) * dt / Math.hypot(ix, iz);
        const fx = -Math.sin(r.yaw), fz = -Math.cos(r.yaw);
        r.x += (fx * iz - fz * ix) * sp; r.z += (fz * iz + fx * ix) * sp;
        this.clampRig();
      }
      // マウスでつかんで動かす: つかんだ地点がカーソルの下に来るように（カメラは前のフレームのもの）
      if (this.dragTo) {
        const { x, y, grab } = this.dragTo;
        this.dragTo = null;
        const h = this.rayPlane(x, y, grab.y);
        if (h) { r.x += grab.x - h.x; r.z += grab.z - h.z; this.clampRig(); }
      }
      if (input.down('KeyQ')) r.yaw += dt * 1.4;
      if (input.down('KeyE')) r.yaw -= dt * 1.4;
      r.dist += (this.distGoal - r.dist) * (1 - Math.exp(-dt * 7));
      r.ty += (Math.max(0, this.ground(r.x, r.z)) - r.ty) * (1 - Math.exp(-dt * 3));
      this.mePos.copy(P.pos);
      const key = [r.x, r.z, r.ty * 10, r.dist, r.yaw * 100].map(Math.round).join();
      this.still = key === this.lastKey;
      this.lastKey = key;
    }

    // カメラの位置（近いときは建物をよけて手前に寄せ、戻るときはゆっくり）
    tgt.set(r.x, r.ty, r.z);
    const pitch = Math.min(1.45, this.pitchAt(r.dist) + boost);
    // （高いところでは注視点が地面なので、よけるのは主人公の近くにいる間だけ）
    let pull = 0;
    if (r.dist < 40) pull = Math.max(0, r.dist - P.rigPose(tgt, r.yaw, pitch, r.dist, new THREE.Vector3()).distanceTo(tgt));
    this.pull = pull > this.pull ? pull : this.pull + (pull - this.pull) * (1 - Math.exp(-dt * 5));
    this.pose(tgt, r.yaw, pitch, r.dist - this.pull, cam.position);
    const gmin = this.world.groundAt(cam.position.x, cam.position.z, 99) + 0.45;
    if (cam.position.y < gmin) cam.position.y = gmin;
    if (offset) cam.position.add(offset);
    cam.lookAt(tgt);
    const near = THREE.MathUtils.clamp(r.dist * 0.012, 0.15, 6);
    if (Math.abs(cam.near - near) > 0.01) { cam.near = near; cam.updateProjectionMatrix(); }
    this.focus.copy(tgt);

    // 空の具合: 音・ぼかし・影の範囲に使う
    this.sky = skyK(r.dist);
    const spd = cam.position.distanceTo(this.prevCam) / Math.max(dt, 1e-3);
    this.prevCam.copy(cam.position);
    this.rush += (clamp01(spd / 260) - this.rush) * (1 - Math.exp(-dt * 6));
    if (this.state !== 'map') this.still = false;
    // 接地の陰り（AO）は空では見えないので、上がるにつれて薄めて止める（重い）
    if (this.gtao) { this.gtao.blendIntensity = this.aoBlend * (1 - this.sky); this.gtao.enabled = this.sky < 0.97; }
    const blur = this.sky * this.sky;
    for (const [p, s] of [[this.tiltH, innerWidth], [this.tiltV, innerHeight]]) {
      p.enabled = blur > 0.01;
      p.uniforms[p === this.tiltH ? 'h' : 'v'].value = (blur * 5) / s;
    }

    if (this.state === 'up' && this.flight.t >= 1) {
      this.state = 'map';
      this.flight = null;
      this.el.classList.add('show');
    } else if (this.state === 'go' && this.flight.t >= 1) {
      this.land();
      return;
    }
    this.updateOverlay(dt);
  }

  updateOverlay(dt) {
    const cam = this.camera, W = innerWidth, H = innerHeight;
    const v = new THREE.Vector3();
    const place = (el, x, y, z, show = true) => {
      v.set(x, y, z).project(cam);
      const vis = show && v.z < 1 && Math.abs(v.x) < 1.2 && Math.abs(v.y) < 1.2;
      el.style.display = vis ? '' : 'none';
      if (vis) el.style.transform = `translate(${((v.x + 1) / 2) * W}px, ${((1 - v.y) / 2) * H}px)`;
    };
    const mapLike = this.state === 'map' || this.state === 'up';
    const pinsOn = this.state === 'map';
    for (const p of this.places) {
      const [x, z] = p.spot || [p.x, p.z];
      place(p.el, x, p.y + 1, z, pinsOn && !this.hidden(p));
      p.scr = pinsOn && p.el.style.display !== 'none' ? [((v.x + 1) / 2) * W, ((1 - v.y) / 2) * H] : null;
      p.el.classList.toggle('hot', (this.pinHover || this.pinSnap) === p);
    }
    // 自分の印（降りて本物が見えてくると消える）
    place(this.me, this.mePos.x, this.mePos.y + 1.5, this.mePos.z, this.rig.dist > 40);
    this.me.style.opacity = clamp01((this.rig.dist - 40) / 60);

    // カーソルの下の行き先
    const ring = this.ring;
    if (this.state === 'map') {
      let h = null;
      const near = this.modal ? null : this.cursor.inside ? this.pinAt(this.cursor.x, this.cursor.y) : this.pinHover;
      this.pinSnap = near;
      if (near) {
        h = this.pinTarget(near);
      } else if (this.cursor.inside && !this.modal) {
        const g = this.pickGround(this.cursor.x, this.cursor.y);
        if (g) {
          const s = this.core.inside(g.x, g.z, 45) ? this.findSpot(g.x, g.z, 9) : null;
          let name = null, best = Infinity;
          for (const n of this.named) { const d = Math.hypot(g.x - n.x, g.z - n.z); if (d < n.r && n.r < best && !n.sea) { best = n.r; name = n.name; } }
          h = s ? { x: s[0], z: s[1], ok: true, name } : { x: g.x, z: g.z, ok: false, name: null, sea: g.y < 0.05 };
          // 進入禁止のときは、地名のまわりの輪の中だけ
          if (h.ok && this.fence?.limited && !this.fence.inside(h.x, h.z)) h = { x: g.x, z: g.z, ok: false, name: null, fence: true };
          if (h.ok && this.noLand.some(([x, z, r]) => Math.hypot(h.x - x, h.z - z) < r)) h = { x: g.x, z: g.z, ok: false, name: null };
        }
      }
      this.hover = h;
      if (h) {
        const y = h.ok ? this.world.groundAt(h.x, h.z, 99) : Math.max(0, this.ground(h.x, h.z));
        ring.position.set(h.x, y + 0.2, h.z);
        ring.scale.setScalar(this.rig.dist * 0.024 * (1 + 0.08 * Math.sin(performance.now() / 180)));
        this.ringMat.color.set(h.ok ? '#fffdf2' : '#ff8a7a');
        this.ringMat.opacity = h.ok ? 0.95 : 0.6;
        ring.visible = true;
        this.tip.textContent = h.game ? `クリックで${h.game.info.title}へ` : h.ok ? (h.name ? `${h.name}へ` : 'ここへ行く') : h.fence ? '進入禁止（赤い輪の外）' : h.sea ? '海には降りられない' : 'ここには降りられない';
        this.tip.classList.toggle('bad', !h.ok);
        this.tip.style.transform = `translate(${this.cursor.x + 18}px, ${this.cursor.y + 14}px)`;
        this.tip.classList.add('show');
        this.el.style.cursor = h.ok ? 'pointer' : 'not-allowed';
      } else {
        ring.visible = false;
        this.tip.classList.remove('show');
        this.el.style.cursor = '';
      }
    } else if (this.state === 'go' && this.dest) {
      // 行き先の輪は、降りていく間に消える
      const k = clamp01((this.rig.dist - 25) / 120);
      ring.visible = k > 0 && !!this.flight.from;
      ring.position.set(this.dest.x, this.dest.y + 0.2, this.dest.z);
      ring.scale.setScalar(Math.max(8, this.rig.dist * 0.024));
      this.ringMat.color.set('#fffdf2');
      this.ringMat.opacity = 0.95 * k;
    } else ring.visible = false;
  }
}
