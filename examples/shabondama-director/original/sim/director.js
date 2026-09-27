// 進行と視点：吹く → 泡を追って中へ入る → 風まかせに漂う → 割れる → 次の場所で吹く
import * as THREE from 'three';
import { HOUSES, KNOLL, SHRINE, BRIDGE, POND, riverZ, riverDZ, GORGE, gorgeWorld, RIDGE } from '../world/layout.js';
import { mulberry32, clamp, smoothstep, lerp } from '../util/noise.js';

const V3 = THREE.Vector3;
const TAU = Math.PI * 2;
const wrapPi = (a) => { while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a; };
const dirOf = (yaw, pitch, out = new V3()) => out.set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
const smoother = (t) => t * t * t * (t * (t * 6 - 15) + 10);

export function makeSpots(groundAt, world) {
  const spots = [];
  const h1 = HOUSES.find((h) => h.id === 'h1');
  const c = Math.cos(h1.rot), s = Math.sin(h1.rot);
  // 座敷の奥から、開け放った縁側ごしに谷を見る（軒・柱・縁板が額縁になる）
  const lx = 0.0, lz = 3.1;
  const ex = h1.x + lx * c + lz * s, ez = h1.z - lx * s + lz * c;
  const toKnoll = Math.atan2(KNOLL.x - ex, KNOLL.z - ez);
  spots.push({ id: 'engawa', pos: new V3(ex, h1.y + 0.55 + 1.05, ez), yaw: toKnoll * 0.5 + h1.rot * 0.5, pitch: -0.02 });
  // 川の土手（桜並木の脇）
  {
    const x = -150, zr = riverZ(x);
    const n = -1 / Math.sqrt(1 + riverDZ(x) ** 2);
    const z = zr + n * 8.2;
    spots.push({ id: 'dote', pos: new V3(x, groundAt(x, z) + 1.55, z), yaw: Math.atan2(1, riverDZ(x)) - 0.25, pitch: -0.04 });
  }
  // 一本桜の小丘
  {
    const x = KNOLL.x + 6, z = KNOLL.z + 9;
    spots.push({ id: 'knoll', pos: new V3(x, groundAt(x, z) + 1.5, z), yaw: 0.35, pitch: -0.06 });
  }
  // 神社の石段の中ほど（谷を見下ろす）
  {
    const x = SHRINE.x + 0.4, z = SHRINE.stepsFrom + 14;
    spots.push({ id: 'shrine', pos: new V3(x, groundAt(x, z) + 1.55, z), yaw: Math.PI - 0.1, pitch: -0.12 });
  }
  // 橋の上
  spots.push({ id: 'bridge', pos: new V3(BRIDGE.x + 0.8, world.bridgeDeck + 1.5, BRIDGE.z + 2), yaw: Math.PI / 2 + 0.15, pitch: -0.05 });
  // 滝の谷を下る向き
  const [ux, uz] = gorgeWorld(GORGE.sCliff, 0), [dx0, dz0] = gorgeWorld(GORGE.sIn - 40, 0);
  const downYaw = Math.atan2(dx0 - ux, dz0 - uz);
  // ため池の堤（谷の奥に滝が見える）
  {
    const x = POND.x + 3, z = POND.z + POND.rz + 4;
    const [fx, fz] = gorgeWorld(GORGE.sCliff, 0);
    spots.push({ id: 'pond', pos: new V3(x, groundAt(x, z) + 1.55, z), yaw: Math.atan2(fx - x, fz - z), pitch: 0.02, windPlan: [[0, Math.atan2(fx - x, fz - z)], [75, downYaw + 0.5]] });
  }
  // 滝つぼのほとり：岩の上から滝を見上げる
  // 風：はじめは滝へ向かい（崖に沿って昇る）、しばらくすると谷を下る（池と谷を見下ろしながら帰る）
  {
    const [x, z] = gorgeWorld(GORGE.sPool - GORGE.poolR - 4.0, -4.2);
    const [fx, fz] = gorgeWorld(GORGE.sCliff - 1, 0.5);
    const yaw = Math.atan2(fx - x, fz - z);
    spots.push({ id: 'taki', pos: new V3(x, groundAt(x, z) + 1.6, z), yaw, pitch: 0.16, windPlan: [[0, yaw], [18, downYaw]] });
  }
  // 山の上の見晴らし：谷を見下ろす
  {
    const x = RIDGE.x + 3, z = RIDGE.z + RIDGE.r * 0.5;
    spots.push({ id: 'toge', pos: new V3(x, groundAt(x, z) + 1.6, z), yaw: Math.atan2(RIDGE.lookX - x, RIDGE.lookZ - z), pitch: -0.13 });
  }
  return spots;
}

export class Director {
  constructor({ camera, world, flight, wind, groundAt, canopyAt, spots, landmarks, trees }) {
    this.camera = camera;
    this.world = world;
    this.flight = flight;
    this.wind = wind;
    this.groundAt = groundAt;
    this.canopyAt = canopyAt;
    this.spots = spots;
    this.landmarks = landmarks;
    this.trees = trees;
    this.rand = mulberry32((Math.random() * 1e9) | 0);
    this.bubbles = [];
    this.main = null;
    this.state = 'title';
    this.t = 0;          // 状態に入ってからの時間
    this.time = 0;
    this.spotIdx = 0;
    this.spot = spots[0];
    this.yaw = this.spot.yaw; this.pitch = this.spot.pitch;
    this.yawV = 0; this.pitchV = 0;
    this.pos = this.spot.pos.clone();
    this.focus = 40; this.aperture = 55;
    this.film = 0;       // 自分の泡の膜の見え方
    this.flash = 0;
    this.pop = -1;       // 割れる進み（-1=なし）
    this.popPoint = new THREE.Vector2(0.5, 0.5);
    this.fade = 0;       // 白への溶け
    this.hint = 0;
    this.gaze = null;
    this.gazeT = 8;
    this.heading = this.spot.yaw;
    this.recent = [];
    this.tmp = new V3();
    this.wand = { visible: true, pos: new V3(), quat: new THREE.Quaternion(), blow: 0 };
    this.lastVel = new V3();
    this.autoBlowAt = -1;
    this.uiTitle = 1;
    // 見まわし（手で動かした向き）と自動の視線の混ぜ具合
    this.manual = { yaw: 0, pitch: 0, w: 0, idle: 99, active: false, keys: false, vy: 0, vp: 0, fy: 0, fp: 0 };
    this.lastBubbleGaze = -1e9;
    // はじめの場所：8か所からランダム
    this.placeAtSpot(Math.floor(this.rand() * this.spots.length));
    this.dispYaw = this.yaw; this.dispPitch = this.pitch;
  }

  placeAtSpot(i) {
    this.spotIdx = i;
    this.spot = this.spots[i];
    this.pos.copy(this.spot.pos);
    this.yaw = this.spot.yaw; this.pitch = this.spot.pitch;
    this.yawV = this.pitchV = 0;
    this.bubbles = [];
    this.main = null;
    this.film = 0; this.pop = -1;
    this.focus = 45;
    this.wand.visible = true;
    // 場所が変わったら、手で向けた視線はいったん解く
    if (this.manual) { this.manual.w = 0; this.manual.vy = 0; this.manual.vp = 0; }
  }

  click() {
    if (this.state === 'title' || this.state === 'ready') this.startBlow();
  }

  // 最初から：白く溶けて、8か所のどこか（いまの場所とは別）の題字の画面から始め直す
  restart() {
    if (this.state === 'restart' || this.state === 'restartIn') return;
    this.state = 'restart';
    this.t = 0;
    this.fadeFrom = this.fade;
  }

  startBlow() {
    this.liftEp = null; this.altSeg = null;
    this.state = 'blow';
    this.t = 0;
    this.spawned = 0;
    this.uiTitleTarget = 0;
    // 風を視線の向きへ（最初の数十秒だけ）。ずれは少し残す
    const want = Math.PI / 2 - this.spot.yaw + (this.rand() - 0.5) * (this.spot.windPlan ? 0.15 : 0.5);
    this.wind.aimAt(want);
    this.windStep = 1;
    const r = this.rand;
    this.blowPlan = [];
    const n = 11 + Math.floor(r() * 3);
    for (let k = 0; k < n; k++) this.blowPlan.push({ at: 0.12 + k * (0.12 + r() * 0.07), r: 0.009 + r() * r() * 0.03, role: 'free' });
    this.mainIdx = 3;
    this.blowPlan[this.mainIdx].r = 0.038;
    this.blowPlan[this.mainIdx].role = 'main';
    // 一緒に飛ぶ泡：6つ（中くらい〜大きめ）
    for (const i of [1, 2, 5, 6, 8, 10]) { this.blowPlan[i].role = 'comp'; this.blowPlan[i].r = 0.03 + r() * 0.026; }
    if (this.onBlow) this.onBlow();
  }

  spawnFromWand(plan) {
    const isMain = plan.role === 'main', isComp = plan.role === 'comp';
    const r = this.rand;
    const f = dirOf(this.yaw, this.pitch);
    const right = new V3().crossVectors(f, new V3(0, 1, 0)).normalize();
    const p = this.wand.pos.clone().addScaledVector(f, 0.05);
    const sp = 1.3 + r() * 1.1;
    const v = f.clone().multiplyScalar(sp).addScaledVector(right, (r() - 0.5) * (isMain || isComp ? 0.9 : 2.6)).add(new V3(0, 0.15 + r() * (isMain || isComp ? 0.35 : 0.9), 0));
    const b = {
      pos: p, vel: v, r: plan.r, age: 0, life: isMain ? (this.mainLife || (95 + r() * 60)) : isComp ? 1e9 : 12 + r() * 40,
      phase: r() * 100, film: 210 + r() * 190, main: isMain, comp: isComp, grow: 0, vis: 1, immune: isMain ? 18 : isComp ? 1e9 : 4,
    };
    // ほかの泡は一つずつ別の向きへ散っていく
    if (!isMain && !isComp) { const a = r() * Math.PI * 2, s = 0.35 + r() * 0.75; b.drift = [Math.cos(a) * s, (r() - 0.35) * 0.35, Math.sin(a) * s]; }
    this.bubbles.push(b);
    return b;
  }

  // 視線の中心の奥行き（地面＋樹冠に当たるまで）
  raycastFocus(pos, dir) {
    let t = 0.8;
    // 森の中から見るときは、近くの樹冠の高さは数えない（木の幹の間から遠くを見る）
    const inCanopy = pos.y < this.groundAt(pos.x, pos.z) + this.canopyAt(pos.x, pos.z);
    for (let i = 0; i < 70; i++) {
      const x = pos.x + dir.x * t, y = pos.y + dir.y * t, z = pos.z + dir.z * t;
      const g = this.groundAt(x, z) + (inCanopy && t < 40 ? 0 : this.canopyAt(x, z));
      if (y < g) return t;
      t = t * 1.09 + 0.3;
      if (t > 900) break;
    }
    return 600;
  }

  pickGaze() {
    const r = this.rand;
    const p = this.pos;
    const cands = [];
    for (const lm of this.landmarks) {
      const d = p.distanceTo(lm.pos);
      if (d < 18 || (d > 320 && !lm.far)) continue;
      if (this.recent.includes(lm.id)) continue;
      if (lm.last !== undefined && this.time - lm.last < 70) continue;
      const yaw = Math.atan2(lm.pos.x - p.x, lm.pos.z - p.z);
      const dy = Math.abs(wrapPi(yaw - this.heading));
      if (dy > 1.9) continue;
      cands.push({ lm, w: lm.w * (lm.far ? 0.7 : (1 - d / 360)) * (1.2 - dy / 2.2) });
    }
    // 近くを漂う仲間の泡（いま視野の中にあるものだけ・ときどき）
    const fwd = dirOf(this.yaw, this.pitch);
    if (this.time - this.lastBubbleGaze > 35) for (const b of this.bubbles) {
      if (b === this.main || b.vis < 0.5 || b.popping !== undefined) continue;
      const dv = b.pos.clone().sub(p);
      const d = dv.length();
      if (d < 1.0 || d > 6) continue;
      if (dv.normalize().dot(fwd) < 0.8) continue;
      if (b.life - b.age < 8) continue;
      cands.push({ bubble: b, w: 1.4 });
    }
    if (!cands.length || r() < 0.2) return null;
    let sum = cands.reduce((a, c) => a + Math.max(c.w, 0.01), 0), x = r() * sum;
    for (const c of cands) { x -= Math.max(c.w, 0.01); if (x <= 0) return c; }
    return cands[0];
  }

  // どこかから流れてくる泡の群れ：視点のまわりの少し離れたところに生まれ、それぞれ別の向きへ漂う
  spawnDrifters() {
    const r = this.rand, cam = this.camera.position;
    const fwd = dirOf(this.yaw, this.pitch);
    const n = 3 + Math.floor(r() * 6);
    // 見えるところ（前方の左右どちらか寄り）に生まれることが多い
    const side = (r() < 0.5 ? -1 : 1) * (0.35 + r() * 0.8);
    const ang = Math.atan2(fwd.x, fwd.z) + side;
    const d = 9 + r() * 26;
    const cx = cam.x + Math.sin(ang) * d, cz = cam.z + Math.cos(ang) * d;
    const gy = this.groundAt(cx, cz);
    const cy = Math.max(gy + 1.2 + r() * 6, cam.y + (r() - 0.5) * 5);
    const dirA = r() * Math.PI * 2;
    for (let i = 0; i < n; i++) {
      const a = dirA + (r() - 0.5) * 2.2, s = 0.3 + r() * 0.9;
      this.bubbles.push({
        pos: new V3(cx + (r() - 0.5) * 3, cy + (r() - 0.5) * 2, cz + (r() - 0.5) * 3), vel: new V3(Math.cos(a) * s, 0.1, Math.sin(a) * s),
        r: 0.012 + r() * r() * 0.035, age: 0, life: 10 + r() * 22, phase: r() * 100, film: 200 + r() * 200, main: false, comp: false,
        grow: 0.4, vis: 1, immune: 2.5, drift: [Math.cos(a) * s, (r() - 0.4) * 0.3, Math.sin(a) * s], drifter: true,
      });
    }
  }

  update(dt) {
    this.time += dt;
    this.t += dt;
    const r = this.rand;
    const cam = this.camera;
    // 流れてくる泡（多すぎないように）
    this.driftT = (this.driftT ?? 6 + r() * 6) - dt;
    if (this.driftT <= 0) {
      this.driftT = 7 + r() * 12;
      const live = this.bubbles.filter((b) => b.drifter).length;
      if (live < 22 && this.state !== 'restart' && this.state !== 'after') this.spawnDrifters();
    }
    // ---- 泡の物理 ----
    for (const b of this.bubbles) {
      if (b.dead) continue;
      if (b.drifter && b.pos.distanceTo(cam.position) > 130) { b.dead = true; continue; }
      b.immune = Math.max(0, (b.immune || 0) - dt);
      b.grow = Math.min(1, b.grow + dt * 3.5);
      if (b.popping !== undefined) { b.popping += dt; b.vis = Math.max(0, 1 - b.popping / 0.07); if (b.popping > 0.1) b.dead = true; continue; }
      if (b.rel) continue;
      const res = this.flight.step(b, dt, this.tmp);
      if (res) { b.popping = 0; b.popReason = res; if (b === this.main) this.onMainPop(res); else if (this.onBubblePop) this.onBubblePop(b); }
    }
    for (const b of this.bubbles) if (b.rel && b.popping === undefined && !b.dead) this.stepCompanion(b, dt);
    this.bubbles = this.bubbles.filter((b) => !b.dead);

    // ---- 状態 ----
    const eye = this.spot.pos;
    let wantYaw = this.yaw, wantPitch = this.pitch;
    let wantFocus = this.focus, wantAperture = 55;
    if (this.state === 'title' || this.state === 'ready') {
      this.pos.copy(eye).add(new V3(Math.sin(this.time * 0.4) * 0.01, Math.sin(this.time * 0.7) * 0.012, 0));
      wantYaw = this.spot.yaw + Math.sin(this.time * 0.13) * 0.03;
      wantPitch = this.spot.pitch + Math.sin(this.time * 0.11) * 0.01;
      wantFocus = this.raycastFocus(this.pos, dirOf(this.yaw, this.pitch)) * 0.85;
      wantAperture = 60;
      // 手前に見どころ（縁側の前の猫）があれば、ときどきピントがそちらへ移って戻る（13秒のうち約6秒）
      const sub = this.focusSubject && this.focusSubject();
      if (sub) {
        const dv = sub.clone().sub(this.pos);
        const d = dv.length();
        const ph = this.time % 13;
        if (d < 14 && dv.normalize().dot(dirOf(this.yaw, this.pitch)) > 0.8 && ph > 4.5 && ph < 10.5) wantFocus = d;
      }
      this.hint = Math.min(1, this.hint + dt * 0.5);
      if (this.state === 'ready' && this.t > 4.5) this.startBlow();
    } else if (this.state === 'blow') {
      this.hint = Math.max(0, this.hint - dt * 2);
      this.wand.blow = Math.min(1, this.t / 0.3);
      for (const [k, plan] of this.blowPlan.entries()) {
        if (!plan.done && this.t >= plan.at) { plan.done = true; const b = this.spawnFromWand(plan); if (k === this.mainIdx) this.main = b; }
      }
      this.pos.copy(eye);
      if (this.main) {
        const d = this.main.pos.clone().sub(this.pos);
        wantYaw = Math.atan2(d.x, d.z) * 0.6 + this.spot.yaw * 0.4;
        wantPitch = Math.atan2(d.y, Math.hypot(d.x, d.z)) * 0.6 + this.spot.pitch * 0.4;
        wantFocus = Math.max(1.2, d.length());
      } else wantFocus = 1.2;
      wantAperture = 26;
      if (this.t > 2.3 && this.main) { this.state = 'follow'; this.t = 0; this.followFrom = this.pos.clone(); }
      if (this.t > 5 && !this.main) { this.state = 'ready'; this.t = 0; }
    } else if (this.state === 'follow') {
      this.wand.blow = Math.max(0, 1 - this.t * 2);
      const T = 3.4;
      const k = smoother(clamp(this.t / T, 0, 1));
      this.pos.lerpVectors(this.followFrom, this.main.pos, k);
      const d = this.main.pos.clone().sub(this.pos);
      const dl = d.length();
      const vh = Math.hypot(this.main.vel.x, this.main.vel.z);
      const head = vh > 0.1 ? Math.atan2(this.main.vel.x, this.main.vel.z) : this.yaw;
      const lookYaw = dl > 0.3 ? Math.atan2(d.x, d.z) : head;
      wantYaw = lerp(lookYaw, head, smoothstep(0.55, 1.0, k));
      wantPitch = dl > 0.3 ? lerp(Math.atan2(d.y, Math.hypot(d.x, d.z)), -0.06, smoothstep(0.6, 1, k)) : -0.06;
      this.heading = head;
      wantFocus = Math.max(0.3, dl * 0.9);
      if (k > 0.8) wantFocus = lerp(wantFocus, this.raycastFocus(this.pos, dirOf(this.yaw, this.pitch)), smoothstep(0.8, 1, k));
      // 泡の膜を通り抜ける
      this.film = smoothstep(0.82, 1.0, k);
      this.flash = Math.exp(-((k - 0.93) ** 2) / 0.0012);
      if (this.t >= T) {
        this.state = 'ride'; this.t = 0; this.gazeT = 6; this.wand.visible = false;
        const comps = this.bubbles.filter((b) => b.comp && b.popping === undefined);
        comps.forEach((b, i) => this.attachCompanion(b, i));
      }
    } else if (this.state === 'ride') {
      const m = this.main;
      // 場所ごとの風の台本（滝の谷：昇ってから下る）
      const wp = this.spot.windPlan;
      if (wp) {
        this.windStep = this.windStep ?? 1;
        if (this.windStep < wp.length && this.t >= wp[this.windStep][0]) { this.wind.aimAt(Math.PI / 2 - wp[this.windStep][1]); this.windStep++; }
      }
      // 好みの高さ：15〜45秒ごとに乱数で選び直す（低め2.5〜6m 55%・中ほど6〜14m 30%・高め15〜32m 15%）。ゆっくりそちらへ移る
      if (!this.altSeg || this.altSeg.t > this.altSeg.dur) {
        const q = r();
        const target = q < 0.55 ? 2.5 + r() * 3.5 : q < 0.85 ? 6 + r() * 8 : 15 + r() * 17;
        this.altSeg = { t: 0, dur: 15 + r() * 30, target };
        // 高めを選んだときは上昇気流に乗って上がる
        if (target > 15 && !this.liftPlan && !this.liftEp) this.liftEp = { t: 0, dur: 10 + (target - 15) * 0.6 + r() * 6, peak: 0.8 + r() * 0.4 };
      }
      this.altSeg.t += dt;
      m.prefAlt = m.prefAlt === undefined ? this.altSeg.target : m.prefAlt + (this.altSeg.target - m.prefAlt) * (1 - Math.exp(-dt / 6));
      // 書き出しの台本では、決めた時刻に上昇気流に乗る
      if (this.liftPlan && !this.liftPlan.used && !this.liftEp && this.t >= this.liftPlan.at) { this.liftEp = { t: 0, dur: this.liftPlan.dur, peak: this.liftPlan.peak }; this.liftPlan.used = true; }
      if (this.liftEp) {
        const e = this.liftEp;
        e.t += dt;
        m.lift = e.peak * Math.pow(Math.max(0, Math.sin(Math.PI * Math.min(1, e.t / e.dur))), 0.6);
        if (e.t > e.dur) { this.liftEp = null; m.lift = 0; }
      } else m.lift = 0;
      this.pos.copy(m.pos);
      // 泡のかすかな揺れ
      this.pos.y += Math.sin(this.time * 2.3 + m.phase) * 0.006;
      const vh = Math.hypot(m.vel.x, m.vel.z);
      if (vh > 0.15) {
        const h = Math.atan2(m.vel.x, m.vel.z);
        this.heading += wrapPi(h - this.heading) * (1 - Math.exp(-dt / 2.5));
      }
      const alt = this.pos.y - this.groundAt(this.pos.x, this.pos.z);
      const basePitch = -lerp(0.05, 0.36, smoothstep(3, 90, alt));
      this.gazeT -= dt;
      if (this.gazeT <= 0) {
        if (this.gaze) { this.gaze = null; this.gazeT = 5 + r() * 6; }
        else {
          this.gaze = this.pickGaze();
          this.gazeT = this.gaze ? 6 + r() * 5 : 4 + r() * 4;
          if (this.gaze && this.gaze.lm) { this.gaze.lm.last = this.time; this.recent.push(this.gaze.lm.id); if (this.recent.length > 5) this.recent.shift(); }
          if (this.gaze && this.gaze.bubble) this.lastBubbleGaze = this.time;
        }
      }
      wantYaw = this.heading + Math.sin(this.time * 0.07) * 0.25;
      wantPitch = basePitch + Math.sin(this.time * 0.09) * 0.04;
      let gazeDist = -1;
      if (this.gaze) {
        const tp = this.gaze.lm ? this.gaze.lm.pos : this.gaze.bubble.pos;
        if (this.gaze.bubble && (this.gaze.bubble.dead || this.gaze.bubble.popping !== undefined)) { this.gaze = null; this.gazeT = 3; }
        else {
          const d = tp.clone().sub(this.pos);
          const gy = Math.atan2(d.x, d.z);
          const lim = 1.4;
          wantYaw = this.heading + clamp(wrapPi(gy - this.heading), -lim, lim);
          const pmin = -lerp(0.2, 0.7, smoothstep(6, 40, alt));
          wantPitch = clamp(Math.atan2(d.y, Math.hypot(d.x, d.z)), pmin, 0.25);
          gazeDist = d.length();
        }
      }
      const fdir = dirOf(this.yaw, this.pitch);
      // 見ている物が画面の真ん中近くに来てからピントを送る
      let onCenter = false;
      if (this.gaze && gazeDist > 0) {
        const tp = this.gaze.lm ? this.gaze.lm.pos : this.gaze.bubble.pos;
        onCenter = tp.clone().sub(this.pos).normalize().dot(fdir) > 0.965;
      }
      wantFocus = onCenter ? gazeDist : Math.max(6, this.raycastFocus(this.pos, fdir));
      wantAperture = lerp(62, 40, smoothstep(5, 80, alt));
      this.film = Math.min(1, this.film + dt);
      this.flash *= Math.exp(-dt * 6);
      this.lastVel.copy(m.vel);
    } else if (this.state === 'pop') {
      this.pop = Math.min(1, this.t / 0.45);
      this.film = Math.max(0, 1 - this.t / 0.2);
      this.pos.addScaledVector(this.lastVel, dt * Math.exp(-this.t * 0.8));
      this.pos.y -= dt * 0.25 * this.t;
      wantYaw = this.yaw; wantPitch = this.pitch - dt * 0.05;
      if (this.t > 1.2) { this.state = 'after'; this.t = 0; }
    } else if (this.state === 'after') {
      this.pop = -1;
      this.pos.addScaledVector(this.lastVel, dt * 0.3 * Math.exp(-this.t));
      this.fade = Math.min(0.86, (this.t / 1.6) ** 1.5 * 0.86);
      wantYaw = this.yaw + dt * 0.02; wantPitch = this.pitch;
      if (this.t > 2.0) {
        // 次の場所（前と違うところ）
        let i = Math.floor(r() * this.spots.length);
        if (i === this.spotIdx) i = (i + 1) % this.spots.length;
        this.placeAtSpot(i);
        this.state = 'fadein'; this.t = 0;
        this.focus = this.raycastFocus(this.pos, dirOf(this.yaw, this.pitch));
      }
    } else if (this.state === 'restart') {
      this.fade = Math.min(0.92, this.fadeFrom + (0.92 - this.fadeFrom) * smoother(Math.min(1, this.t / 0.75)));
      this.film = Math.max(0, this.film - dt * 2);
      if (this.t > 0.85) {
        this.bubbles = []; this.main = null; this.liftEp = null; this.gaze = null; this.gazeT = 8;
        this.pop = -1; this.flash = 0; this.film = 0;
        let i = Math.floor(this.rand() * this.spots.length);
        if (i === this.spotIdx) i = (i + 1) % this.spots.length;
        this.placeAtSpot(i);
        this.yawV = this.pitchV = 0;
        this.focus = this.raycastFocus(this.pos, dirOf(this.yaw, this.pitch)) * 0.85;
        this.state = 'restartIn'; this.t = 0;
        this.hint = 0;
        if (this.onRestart) this.onRestart();
      }
    } else if (this.state === 'restartIn') {
      this.fade = Math.max(0, 0.92 * (1 - smoother(Math.min(1, this.t / 1.6))));
      this.pos.copy(this.spot.pos);
      wantYaw = this.spot.yaw; wantPitch = this.spot.pitch;
      wantFocus = this.raycastFocus(this.pos, dirOf(this.yaw, this.pitch)) * 0.85;
      if (this.t > 1.6) { this.state = 'title'; this.t = 0; }
    } else if (this.state === 'fadein') {
      this.fade = Math.max(0, 0.86 * (1 - this.t / 1.8));
      this.pos.copy(eye);
      wantYaw = this.spot.yaw; wantPitch = this.spot.pitch;
      wantFocus = this.raycastFocus(this.pos, dirOf(this.yaw, this.pitch)) * 0.85;
      if (this.t > 1.8) { this.state = 'ready'; this.t = 0; }
    }
    // ---- 視線のばね（やわらかく追う）：臨界減衰のばね。見る先が変わっても、動き出しも止まりも滑らか ----
    // hl＝目標まで半分寄る時間。ω＝1.68/hl で半分まで寄る時間が hl になる（一次遅れのときと同じ速さ）
    const hl = this.state === 'ride' ? 1.6 : this.state === 'blow' ? 0.5 : 0.8;
    const w = 1.68 / hl, ex = Math.exp(-w * dt);
    {
      const e = -wrapPi(wantYaw - this.yaw), j = (this.yawV + w * e) * dt;
      this.yaw += (e + j) * ex - e;
      this.yawV = (this.yawV - w * j) * ex;
    }
    {
      const e = this.pitch - wantPitch, j = (this.pitchV + w * e) * dt;
      this.pitch = wantPitch + (e + j) * ex;
      this.pitchV = (this.pitchV - w * j) * ex;
    }
    // ---- 見まわし：手で動かしている間とその後しばらくは手の向き。触らなければ自動の視線へ戻る ----
    const M = this.manual;
    if (M.active || M.keys) {
      M.idle = 0;
      if (dt > 0) { M.vy += (M.fy / dt - M.vy) * 0.45; M.vp += (M.fp / dt - M.vp) * 0.45; }
    } else {
      M.idle += dt;
      M.yaw += M.vy * dt; M.pitch += M.vp * dt;
      M.vy *= Math.exp(-dt * 4.5); M.vp *= Math.exp(-dt * 4.5);
      if (M.idle > 10) M.w = Math.max(0, M.w - dt / 2.5);
    }
    M.fy = 0; M.fp = 0;
    M.pitch = clamp(M.pitch, -1.3, 1.2);
    const mw = smoother(M.w);
    this.dispYaw = this.yaw + wrapPi(M.yaw - this.yaw) * mw;
    this.dispPitch = this.pitch + (M.pitch - this.pitch) * mw;
    if (M.w > 0.3 && (this.state === 'ride' || this.state === 'title' || this.state === 'ready' || this.state === 'fadein')) {
      const dd = dirOf(this.dispYaw, this.dispPitch);
      const fr = this.raycastFocus(this.pos, dd);
      wantFocus = this.state === 'ride' ? Math.max(6, fr) : fr * 0.85;
    }
    const fk = 1 - Math.exp(-dt / (this.state === 'blow' ? 0.25 : 0.7));
    this.focus = Math.exp(Math.log(this.focus) + (Math.log(Math.max(0.25, wantFocus)) - Math.log(this.focus)) * fk);
    // 近くにピントがあるときは背景が溶けすぎないよう絞る（無限遠のボケを約12pxまで）
    wantAperture = Math.min(wantAperture, 6.5 * Math.max(this.focus, 0.3));
    this.aperture += (wantAperture - this.aperture) * (1 - Math.exp(-dt / 1.0));
    // ---- カメラ ----
    cam.position.copy(this.pos);
    const f = dirOf(this.dispYaw, this.dispPitch);
    cam.up.set(0, 1, 0);
    cam.lookAt(this.pos.x + f.x, this.pos.y + f.y, this.pos.z + f.z);
    if (this.state === 'ride') cam.rotateZ(Math.sin(this.time * 0.5 + 1.3) * 0.012);
    cam.updateMatrixWorld();
    // 杖（しゃぼん玉の輪）：視点の少し前・下。吹いたあとはその場に残る
    if (this.wand.visible && (this.state === 'title' || this.state === 'ready' || this.state === 'fadein' || this.state === 'restartIn' || (this.state === 'blow' && this.t < 0.05))) {
      const q = cam.quaternion;
      this.wand.pos.set(0.05, -0.15, -0.4).applyQuaternion(q).add(cam.position);
      this.wand.quat.copy(q);
    }
    // 題字の見え方
    this.uiTitle += ((this.state === 'title' || this.state === 'restartIn' ? 1 : 0) - this.uiTitle) * (1 - Math.exp(-dt * 2));
  }

  // 一緒に飛ぶ泡：泡の進む向きを基準にした「居場所」へゆっくり寄りながら、居場所そのものもゆらゆら動く
  attachCompanion(b, i) {
    const r = this.rand, m = this.main;
    // [左右の角度, 上下の角度, 距離]：4つは画面の中、2つは画面の端の外（見まわすと見える）
    const D = [[-0.42, 0.06, 3.4], [0.3, -0.1, 2.3], [-0.12, 0.16, 5.6], [0.52, 0.12, 4.4], [-1.05, -0.05, 2.9], [1.15, 0.08, 6.8]];
    const d = D[i % D.length];
    b.slot = { th: d[0] + (r() - 0.5) * 0.3, el: d[1] + (r() - 0.5) * 0.15, R: d[2] * (0.85 + r() * 0.3), p: [r() * 6.28, r() * 6.28, r() * 6.28, r() * 6.28] };
    b.rel = b.pos.clone().sub(m.pos);
    b.life = b.age + m.life * (0.55 + r() * 0.75);
  }
  stepCompanion(b, dt) {
    const m = this.main;
    if (!m) return;
    // 居場所は「自動の視線」を基準にする（手で見まわしても泡はその場に残る）
    const h = this.yaw, pc = this.pitch, T = this.time, s = b.slot;
    const th = s.th + 0.28 * Math.sin(T * 0.037 + s.p[0]) + 0.12 * Math.sin(T * 0.091 + s.p[1]);
    const el = pc + s.el + 0.1 * Math.sin(T * 0.05 + s.p[2]);
    const R = s.R * (1 + 0.2 * Math.sin(T * 0.043 + s.p[3]));
    const fx = Math.sin(h), fz = Math.cos(h);
    const rx = Math.cos(h), rz = -Math.sin(h);
    const ce = Math.cos(el) * R;
    const tx = fx * ce * Math.cos(th) + rx * ce * Math.sin(th);
    const tz = fz * ce * Math.cos(th) + rz * ce * Math.sin(th);
    const ty = Math.sin(el) * R;
    const k = 1 - Math.exp(-dt / 5);
    b.rel.x += (tx - b.rel.x) * k; b.rel.y += (ty - b.rel.y) * k; b.rel.z += (tz - b.rel.z) * k;
    // 泡ひとつひとつの小さな揺れ
    b.rel.x += Math.sin(T * 0.83 + s.p[0] * 3) * 0.05 * dt;
    b.rel.y += Math.sin(T * 0.61 + s.p[1] * 3) * 0.04 * dt;
    b.rel.z += Math.sin(T * 0.77 + s.p[2] * 3) * 0.05 * dt;
    // 目の前に近づきすぎない
    const rl = b.rel.length();
    if (rl < 1.6) b.rel.multiplyScalar(1.6 / Math.max(rl, 1e-3));
    b.pos.copy(m.pos).add(b.rel);
    const minY = this.groundAt(b.pos.x, b.pos.z) + this.flight.landAt(b.pos.x, b.pos.z) + b.r + 0.25;
    if (b.pos.y < minY) { b.pos.y = minY; b.rel.y = b.pos.y - m.pos.y; }
    b.vel.copy(m.vel);
    b.age += dt;
    if (b.age > b.life) { b.popping = 0; b.popReason = 'age'; if (this.onBubblePop) this.onBubblePop(b); }
  }

  // ---- 見まわしの入力 ----
  beginLook() {
    const M = this.manual;
    if (M.w < 0.999) { M.yaw = this.dispYaw; M.pitch = this.dispPitch; M.vy = 0; M.vp = 0; }
    M.w = 1; M.idle = 0;
  }
  look(dx, dy, viewH) {
    const M = this.manual;
    if (!M.active) { this.beginLook(); M.active = true; }
    const k = (this.camera.fov * Math.PI / 180) / Math.max(200, viewH);
    M.yaw += dx * k; M.pitch += dy * k;
    M.fy += dx * k; M.fp += dy * k;
  }
  endLook() { this.manual.active = false; }
  lookKeys(dt, kx, ky) {
    const M = this.manual;
    const on = kx !== 0 || ky !== 0;
    if (on && !M.keys) this.beginLook();
    M.keys = on;
    if (on) { M.yaw += kx * 1.2 * dt; M.pitch += ky * 0.8 * dt; M.fy += kx * 1.2 * dt; M.fp += ky * 0.8 * dt; }
  }

  onMainPop(reason) {
    if (this.onPop) this.onPop(reason, this.main);
    // 一緒に飛んでいた泡は、そのまま風に乗って流れていく
    for (const b of this.bubbles) if (b.rel) { b.rel = null; b.vel.copy(this.main.vel); b.immune = 30; }
    this.state = 'pop';
    this.t = 0;
    this.popPoint.set(0.35 + this.rand() * 0.3, 0.4 + this.rand() * 0.3);
    this.popReason = reason;
  }

  // 描画用の泡の一覧（主人公の泡は中にいる間は描かない）
  renderList() {
    const out = [];
    for (const b of this.bubbles) {
      if (b === this.main && (this.state === 'ride' || (this.state === 'follow' && this.t > 3.0))) continue;
      out.push({ x: b.pos.x, y: b.pos.y, z: b.pos.z, r: b.r * (0.3 + 0.7 * b.grow), phase: b.phase, film: b.film, age: b.age / b.life, vis: b.vis });
    }
    return out;
  }
}
