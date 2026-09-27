// 生き物のAI・当たり判定・装飾の小魚・ウミガメ
import * as THREE from 'three';
import { SPECIES, DECOR_FISH, weightOf } from './species.js';
import { makeFishMesh, makeOctopusMesh, makeLobsterMesh, makeTurtle, buildFishGeometry, paintFishTexture, fishAssets, makeFishMaterial } from './models.js';
import { makeLobsterShadow } from './lobster.js';
import { clamp, lerp, smoothstep, damp } from '../core/noise.js';
import { audio } from '../core/audio.js';

const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const _a = V3(), _b = V3(), _c = V3(), _d = V3(), _e = V3();
const rand = (a, b) => a + (b - a) * Math.random();
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// 線分同士の最近点距離 (p1-q1, p2-q2) → {dist, s(第1線分上), t(第2線分上)}
export function segSeg(p1, q1, p2, q2) {
  const d1 = _a.subVectors(q1, p1), d2 = _b.subVectors(q2, p2), r = _c.subVectors(p1, p2);
  const a = d1.dot(d1), e = d2.dot(d2), f = d2.dot(r);
  let s, t;
  if (a <= 1e-8 && e <= 1e-8) { s = t = 0; }
  else if (a <= 1e-8) { s = 0; t = clamp(f / e, 0, 1); }
  else {
    const c = d1.dot(r);
    if (e <= 1e-8) { t = 0; s = clamp(-c / a, 0, 1); }
    else {
      const b = d1.dot(d2), den = a * e - b * b;
      s = den !== 0 ? clamp((b * f - c * e) / den, 0, 1) : 0;
      t = (b * s + f) / e;
      if (t < 0) { t = 0; s = clamp(-c / a, 0, 1); } else if (t > 1) { t = 1; s = clamp((b - c) / a, 0, 1); }
    }
  }
  const c1 = _d.copy(p1).addScaledVector(d1, s);
  const c2 = _e.copy(p2).addScaledVector(d2, t);
  return { dist: c1.distanceTo(c2), s, t };
}

// 突ける魚は海中で実寸より大きく見せる（マスク越しの見え方と、見つけやすさのため）。魚種ごとの sp.vis があればそちら
export const FISH_VIS = 1.5;
// イセエビは体長に対して見た目を少し大きく（触角が見つけやすいように）
const LOBSTER_VIS = 1.35;
/** 見た目の長さ（m）。当たり判定もこれに合わせる */
export function visLen(sp, cm) {
  return (cm / 100) * (sp.model ? 1 : sp.vis ?? FISH_VIS);
}
/** モデルに掛ける倍率。水中・銛の先・獲れたよー・浜で同じ大きさに見せるため、どこでもこれを使う */
export function visScale(sp, cm) {
  return visLen(sp, cm) * (sp.model === 'lobster' ? LOBSTER_VIS : 1);
}
// ウツボ（体長3m近く）の巣穴に使う岩の最小の大きさ
const EEL_DEN_ROCK = 1.8;

function sizeFor(sp, bias = 0) {
  const [a, b] = sp.size;
  const k = clamp(Math.pow(Math.random(), 1.7 - bias) , 0, 1);
  return Math.round(a + (b - a) * k);
}

// ───────── 生き物 ─────────
export class Creature {
  constructor(eco, sp, opts = {}) {
    this.eco = eco;
    this.world = eco.world;
    this.sp = sp;
    this.cm = opts.cm || sizeFor(sp, opts.bias || 0);
    this.kind = sp.model || 'fish';
    this.len = visLen(sp, this.cm);
    this.weight = weightOf(sp, this.cm);
    this.root = new THREE.Group();
    if (this.kind === 'fish') {
      // 魚は魚種ごとのまとめ描き（InstancedMesh）で描く。ここでは位置と姿勢だけを持つ
      this.model = new THREE.Object3D();
      if (sp.flat) this.model.rotation.z = Math.PI / 2;
      this.sw = { uPhase: { value: 0 }, uAmp: { value: 0.06 }, uBend: { value: 0 } };
      this.instanced = true;
    } else {
      const built = this.kind === 'octopus' ? makeOctopusMesh() : makeLobsterMesh();
      this.model = built.mesh;
      this.sw = built.sw;
      if (this.kind === 'lobster') this.model.add(makeLobsterShadow());
    }
    this.model.scale.setScalar(visScale(sp, this.cm));
    this.root.add(this.model);
    if (this.instanced) eco.instancerFor(sp).add(this);
    this.pos = this.root.position;
    this.dir = V3(0, 0, 1);
    this.desired = V3(0, 0, 1);
    this.speed = 0;
    this.targetSpeed = 0;
    this.state = 'wander';
    this.alert = 0;
    this.timer = 0;
    this.target = null;
    this.home = opts.home ? opts.home.clone() : V3();
    this.phase = Math.random() * 10;
    this.alive = true;
    this.hittable = true;
    this.radius = this.kind === 'fish' ? this.len * sp.shape.height * 0.5 : this.kind === 'octopus' ? this.len * 0.22 : this.len * 0.2;
    this.yawPrev = 0;
    this.bend = 0;
    this.seen = false;
    this.curiousCool = rand(3, 8);
    this.group = opts.group || null;
    this.route = opts.route || null;
    this.offset = opts.offset || V3();
    this.den = opts.den || null;
    this.perch = opts.perch || null;
    this.biteCool = 0;
    this.out = 1; // 巣穴からの出具合
    if (opts.pos) this.pos.copy(opts.pos);
    if (opts.dir) this.dir.copy(opts.dir);
    this.init();
    eco.scene.add(this.root);
  }

  init() {
    const sp = this.sp, w = this.world;
    if (sp.type === 'perch' && this.perch) {
      this.state = 'sit';
      this.pos.copy(this.perch.pos).addScaledVector(this.perch.normal, this.radius * 0.9);
      const a = Math.random() * 6.28;
      this.dir.set(Math.cos(a), 0, Math.sin(a));
      this.perch.taken = true;
    } else if (sp.type === 'sand') {
      this.state = 'buried';
      this.pos.y = w.groundAt(this.pos.x, this.pos.z) + this.len * 0.035;
      const a = Math.random() * 6.28;
      this.dir.set(Math.cos(a), 0, Math.sin(a));
    } else if (sp.type === 'den' && this.den) {
      this.den.occupied = true;
      this.state = 'out';
      this.dir.copy(this.denDir);
      this.pos.copy(this.denPoint(1));
    } else if (sp.type === 'boss') {
      this.state = 'hover';
      this.pos.copy(this.bossPoint(w.boss.pos));
      this.dir.copy(w.boss.out);
    } else {
      const a = Math.random() * 6.28;
      this.dir.set(Math.cos(a), 0, Math.sin(a));
    }
    this.applyTransform(0);
  }

  get denDir() {
    const d = this.den.dir;
    if (!this.sp.eel) return d;
    const a = 0.3;
    return _c.set(d.x * Math.cos(a), Math.sin(a), d.z * Math.cos(a));
  }

  denPoint(out) {
    const d = this.den;
    const k = this.kind === 'octopus' ? 0.12 : this.kind === 'lobster' ? this.len * 0.3 : this.sp.eel ? -this.len * 0.2 : -this.len * 0.15;
    const inside = -this.len * 0.75;
    // ウツボは傾けた体の軸に沿って出入りする（隠れる時は奥の海底へ潜り込み、尾が岩の裏へ突き抜けない）
    return _a.copy(d.pos).addScaledVector(this.sp.eel ? this.denDir : d.dir, lerp(inside, k, out)).clone();
  }

  get headPos() {
    const f = _a.set(0, 0, 1).applyQuaternion(this.root.quaternion);
    return this.pos.clone().addScaledVector(f, this.len * 0.4);
  }

  // 突きの当たり判定
  hitTest(p0, p1, extra = 0) {
    if (!this.alive || !this.hittable) return null;
    const assist = 0.05 + extra;
    if (this.kind === 'octopus') {
      const c = this.pos.clone().add(V3(0, this.len * 0.18, 0));
      const r = segSeg(p0, p1, c, c);
      return r.dist < this.len * 0.3 + assist ? { s: r.s, head: true } : null;
    }
    const f = V3(0, 0, 1).applyQuaternion(this.root.quaternion);
    const L = this.kind === 'lobster' ? this.len * 0.45 : this.len * 0.42;
    const head = this.pos.clone().addScaledVector(f, L);
    const tail = this.pos.clone().addScaledVector(f, -L * 0.9);
    const rad = (this.kind === 'lobster' ? this.len * 0.16 : this.radius * 1.15) + assist;
    const r = segSeg(p0, p1, head, tail);
    if (r.dist < rad) return { s: r.s, head: r.t < 0.3 };
    return null;
  }

  // 気配の感知
  sense(dt, player) {
    const sp = this.sp;
    const dx = player.pos.x - this.pos.x, dy = player.pos.y - this.pos.y, dz = player.pos.z - this.pos.z;
    const d = Math.hypot(dx, dy, dz);
    this.dist = d;
    if (d > 30) { this.alert = Math.max(0, this.alert - dt * 0.3); return d; }
    const noise = player.noise;
    const look = Math.max(0, -(player.fwd.x * dx + player.fwd.y * dy + player.fwd.z * dz) / (d || 1));
    // 気づく範囲: 静かに泳げば狭く、騒がしいと広い（遊びやすさ優先で控えめ）
    const R = sp.sense * (1.2 + noise * 4.8) * (1 + look * 0.2) * (player.submerged ? 1 : 0.6);
    let stim = d < R ? (1 - d / R) * (0.28 + noise * 1.2) : 0;
    const personal = this.len * 0.8 + 0.55 + sp.shy * 0.3;
    if (d < personal) stim += (1 - d / personal) * 0.85 * (this.state === 'curious' ? 0.35 : 1);
    // 伝説の魚は、進路で息をひそめて待つダイバーにはほとんど気づかない（待ち伏せが決まる）
    if (sp.legend && player.stillTime > 0.8) stim *= 0.3;
    const rate = stim * sp.shy * 3.9 - 0.3;
    this.alert = clamp(this.alert + rate * dt, 0, 1);
    return d;
  }

  scare(amount) { this.alert = clamp(this.alert + amount * (0.4 + this.sp.shy * 0.8), 0, 1); }

  // 共通の舵取り
  steer(dt, turnMul = 1) {
    const w = this.world;
    const p = this.pos;
    const g = w.groundAt(p.x, p.z);
    const minAlt = this.minAlt ?? 0.3;
    if (p.y < g + minAlt) this.desired.y += (g + minAlt - p.y) * 1.5;
    if (p.y > -0.8) this.desired.y -= (p.y + 0.8) * 1.5 + 0.2;
    // 前方の岩を避ける
    if (this.dist < 60) {
      const ahead = _b.copy(p).addScaledVector(this.dir, this.len * 1.5 + this.speed * 0.7);
      const rock = w.insideRock(ahead, 0.15);
      if (rock) {
        _c.set(p.x - rock.x, 0, p.z - rock.z).normalize();
        this.desired.addScaledVector(_c, 1.6);
        this.desired.y += 0.6;
      }
    }
    const r = Math.hypot(p.x, p.z);
    if (r > w.playRadius - 6) this.desired.addScaledVector(_c.set(-p.x / r, 0, -p.z / r), 1.5);
    this.desired.normalize();
    const turn = this.sp.turn * turnMul;
    this.dir.lerp(this.desired, 1 - Math.exp(-turn * dt)).normalize();
    // 急な上下を抑える
    if (Math.abs(this.dir.y) > 0.6) { this.dir.y = Math.sign(this.dir.y) * 0.6; this.dir.normalize(); }
    this.speed = lerp(this.speed, this.targetSpeed, 1 - Math.exp(-3 * dt));
    p.addScaledVector(this.dir, this.speed * dt);
    // 拘束
    const g2 = w.groundAt(p.x, p.z);
    if (p.y < g2 + this.radius * 0.8 + 0.03) p.y = g2 + this.radius * 0.8 + 0.03;
    if (p.y > -0.35) p.y = -0.35;
    if (this.dist < 60 && this.kind === 'fish') w.pushOutOfRocks(p, this.radius * 0.5);
  }

  applyTransform(dt) {
    const yaw = Math.atan2(this.dir.x, this.dir.z);
    const pitch = Math.asin(clamp(this.dir.y, -1, 1));
    let dy = yaw - this.yawPrev;
    if (dy > Math.PI) dy -= Math.PI * 2; if (dy < -Math.PI) dy += Math.PI * 2;
    this.yawPrev = yaw;
    const yawRate = dt > 0 ? dy / dt : 0;
    this.bend = lerp(this.bend, clamp(-yawRate * 0.05, -0.18, 0.18), 1 - Math.exp(-6 * dt));
    this.root.rotation.set(this.kind === 'fish' || this.kind === 'lobster' ? -pitch : 0, yaw, 0, 'YXZ');
    // 泳ぎのアニメーション
    if (this.kind === 'fish') {
      const bodyLens = this.speed / Math.max(this.len, 0.05);
      const freq = 2.2 + Math.min(bodyLens, 8) * 1.6;
      this.phase += dt * freq;
      this.sw.uPhase.value = this.phase;
      this.sw.uAmp.value = lerp(this.sw.uAmp.value, (this.sp.eel ? 0.1 : 0.035) + Math.min(bodyLens, 5) * 0.018, 1 - Math.exp(-4 * dt));
      this.sw.uBend.value = this.bend;
    }
  }

  update(dt, t, player) {
    if (!this.alive) return;
    const sp = this.sp;
    const d = this.sense(dt, player);
    this.desired.copy(this.dir);
    const toPlayer = _d.subVectors(player.pos, this.pos);
    const away = V3(-toPlayer.x, -toPlayer.y * 0.3, -toPlayer.z).normalize();
    this.timer -= dt;
    this.biteCool -= dt;
    this.curiousCool -= dt;
    this.minAlt = 0.3;
    const far = d > 70;

    switch (sp.type) {
      case 'reef': this.updateReef(dt, player, d, away); break;
      case 'group':
      case 'school': this.updateGroup(dt, player, d, away); break;
      case 'perch': this.updatePerch(dt, player, d, away); break;
      case 'sand': this.updateSand(dt, player, d, away); break;
      case 'den': this.updateDen(dt, t, player, d, away); break;
      case 'boss': this.updateBoss(dt, player, d, away); break;
      case 'legend': this.updateLegend(dt, player, d, away); break;
    }
    if (!far || (Math.floor(t * 10) + this.phase) % 3 < 1) this.applyTransform(dt);
  }

  startFlee(away, dur = rand(1.5, 2.6)) {
    if (this.state !== 'flee') audio.flee();
    this.state = 'flee';
    this.timer = dur;
    this.fleeDir = away.clone();
    this.fleeDir.y = clamp(this.fleeDir.y + 0.15, -0.3, 0.5);
    this.fleeDir.normalize();
  }

  // ─── 岩礁を泳ぐ魚 ───
  updateReef(dt, player, d, away) {
    const sp = this.sp, w = this.world;
    this.minAlt = sp.alt[0];
    if (this.state !== 'flee' && this.alert > 0.72) this.startFlee(away);
    if (this.state === 'flee') {
      this.desired.copy(this.fleeDir);
      this.targetSpeed = sp.burst * (this.timer > 0.6 ? 1 : 0.6);
      if (this.timer <= 0) { this.state = 'wander'; this.target = null; this.alert *= 0.5; }
      this.steer(dt, 1.8);
      return;
    }
    // 好奇心: じっとしているダイバーに寄ってくる
    if (this.state !== 'curious' && sp.curious > 0 && player.stillTime > 1.2 && player.submerged && d < 13 && this.alert < 0.35 && this.curiousCool <= 0) {
      if (Math.random() < sp.curious * 0.45 * dt * (player.nearBottom ? 1.6 : 1)) { this.state = 'curious'; this.timer = rand(8, 15); }
    }
    if (this.state === 'curious') {
      const keep = 2.1 + this.cm / 100;
      _a.subVectors(this.pos, player.pos);
      const dd = _a.length();
      if (dd > keep + 0.5) {
        const tgt = player.pos.clone().addScaledVector(_a.normalize(), keep);
        this.desired.subVectors(tgt, this.pos).normalize();
        this.targetSpeed = sp.cruise * 0.9;
      } else if (dd < keep - 0.5) {
        this.desired.copy(_a.normalize());
        this.targetSpeed = sp.cruise * 0.5;
      } else {
        // 横を向いたり、こちらを見たり
        const side = V3(-_a.z, 0, _a.x).normalize();
        this.desired.copy(Math.sin(this.timer * 0.7 + this.phase) > 0 ? side : _a.clone().negate().normalize());
        this.targetSpeed = 0.08;
      }
      this.minAlt = 0.3;
      if (this.timer <= 0 || player.stillTime < 0.2 && player.noise > 0.35) { this.state = 'wander'; this.curiousCool = rand(6, 12); this.target = null; }
      this.steer(dt, 1.2);
      return;
    }
    // うろうろ
    if (!this.target || this.timer <= 0 || this.pos.distanceTo(this.target) < 0.8) {
      const a = Math.random() * 6.28, r = rand(2, 10);
      const x = this.home.x + Math.cos(a) * r, z = this.home.z + Math.sin(a) * r;
      const g = w.groundAt(x, z);
      this.target = V3(x, Math.min(g + rand(sp.alt[0], sp.alt[1]), -1), z);
      this.timer = rand(5, 11);
      this.graze = Math.random() < 0.3 ? rand(1.5, 3.5) : 0;
    }
    if (this.graze > 0 && this.pos.distanceTo(this.target) < 2) {
      this.graze -= dt;
      this.targetSpeed = 0.06;
      this.desired.set(this.dir.x, -0.2, this.dir.z).normalize();
    } else {
      this.desired.subVectors(this.target, this.pos).normalize();
      this.targetSpeed = sp.cruise * (0.7 + 0.3 * Math.sin(this.phase * 0.05));
    }
    this.steer(dt);
  }

  // ─── 群れ ───
  updateGroup(dt, player, d, away) {
    const g = this.group, sp = this.sp;
    // 群れは誰か一匹が気づくと全員逃げるので、閾値を少し高めに
    if (this.alert > 0.82 && g.fleeT <= 0) { g.fleeT = rand(2.2, 3.2); g.fleeDir = away.clone().setY(0.1).normalize(); audio.flee(); }
    if (d < 1.6 + this.len) { this.desired.copy(away); this.targetSpeed = sp.burst * 0.8; this.steer(dt, 2.5); return; }
    const tgt = _a.copy(g.center).add(_b.copy(this.offset).applyAxisAngle(V3(0, 1, 0), g.spin));
    this.desired.subVectors(tgt, this.pos);
    const dist = this.desired.length();
    this.desired.normalize().multiplyScalar(Math.min(dist, 2)).add(_c.copy(g.dir).multiplyScalar(1.2));
    // 近すぎる仲間から離れる
    for (const o of g.members) {
      if (o === this || !o.alive) continue;
      const dx = this.pos.x - o.pos.x, dy = this.pos.y - o.pos.y, dz = this.pos.z - o.pos.z;
      const dd = dx * dx + dy * dy + dz * dz;
      const min = (this.len + o.len) * 0.9;
      if (dd < min * min && dd > 1e-6) { const k = (min - Math.sqrt(dd)) * 2; this.desired.x += dx * k; this.desired.y += dy * k; this.desired.z += dz * k; }
    }
    this.targetSpeed = g.speed * (0.8 + Math.min(dist, 3) * 0.15);
    this.minAlt = 1.0;
    this.steer(dt, g.fleeT > 0 ? 2.2 : 1);
  }

  // ─── 岩の上で待つ魚 ───
  updatePerch(dt, player, d, away) {
    const sp = this.sp, w = this.world;
    if (this.state === 'sit') {
      if (this.alert > 0.7) {
        const cand = w.perches.filter((p) => !p.taken && p !== this.perch && p.pos.distanceTo(this.pos) < 14 && p.pos.distanceTo(player.pos) > 4);
        if (this.perch) this.perch.taken = false;
        if (cand.length) { this.perch = pick(cand); this.perch.taken = true; this.state = 'dart'; this.timer = 5; audio.flee(); }
        else { this.perch = null; this.startFlee(away); }
        return;
      }
      const goal = _a.copy(this.perch.pos).addScaledVector(this.perch.normal, this.radius * 0.95);
      this.pos.lerp(goal, 1 - Math.exp(-2 * dt));
      this.speed = 0;
      // 近いとこちらを向く
      if (d < 5) { this.desired.set(-away.x, 0, -away.z).normalize(); this.dir.lerp(this.desired, 1 - Math.exp(-1.2 * dt)).normalize(); }
      this.dir.y = lerp(this.dir.y, -this.perch.normal.y * 0.0, 0.1);
      this.dir.normalize();
      if (this.kind === 'fish') this.sw.uAmp.value = 0.012;
      return;
    }
    if (this.state === 'dart') {
      const goal = _a.copy(this.perch.pos).addScaledVector(this.perch.normal, this.radius);
      this.desired.subVectors(goal, this.pos);
      const dd = this.desired.length();
      this.desired.normalize();
      this.targetSpeed = Math.min(sp.burst * 0.8, dd * 2 + 0.3);
      this.minAlt = 0.05;
      if (dd < 0.35 || this.timer <= 0) { this.state = 'sit'; this.alert = 0.2; }
      this.steer(dt, 2.2);
      return;
    }
    // flee → 近くの空いた止まり場を探す
    this.desired.copy(this.fleeDir || away);
    this.targetSpeed = sp.burst;
    if (this.timer <= 0) {
      const cand = w.perches.filter((p) => !p.taken && p.pos.distanceTo(this.pos) < 25);
      if (cand.length) { this.perch = pick(cand); this.perch.taken = true; this.state = 'dart'; this.timer = 8; }
      else this.timer = 1;
    }
    this.steer(dt, 1.5);
  }

  // ─── 砂に潜るヒラメ ───
  updateSand(dt, player, d, away) {
    const sp = this.sp, w = this.world;
    if (this.state === 'buried') {
      this.speed = 0;
      this.hittable = true;
      const g = w.groundAt(this.pos.x, this.pos.z);
      this.pos.y = lerp(this.pos.y, g + this.len * 0.03, 1 - Math.exp(-3 * dt));
      this.sw.uAmp.value = 0.006;
      if (this.alert > 0.62 || (d < 1.1 && player.noise > 0.15)) {
        this.state = 'burst';
        this.timer = rand(1.4, 2.4);
        this.fleeDir = V3(away.x, 0.25, away.z).normalize();
        w.particles.sandPuff(this.pos.x, this.pos.y, this.pos.z, 26, 1.2);
        audio.sandBurst();
      }
      return;
    }
    if (this.state === 'burst') {
      this.desired.copy(this.fleeDir);
      this.targetSpeed = sp.burst;
      this.minAlt = 0.25;
      if (this.timer <= 0) { this.state = 'settle'; this.timer = 4; }
      this.steer(dt, 1.2);
      return;
    }
    // 着底
    const g = w.groundAt(this.pos.x, this.pos.z);
    this.desired.set(this.dir.x, -0.5, this.dir.z).normalize();
    this.targetSpeed = 0.6;
    this.minAlt = 0.0;
    this.steer(dt, 1);
    if (this.pos.y < g + 0.12 || this.timer <= 0) {
      this.state = 'buried';
      this.alert = 0;
      this.dir.y = 0; this.dir.normalize();
      w.particles.sandPuff(this.pos.x, g, this.pos.z, 10, 0.7);
    }
  }

  // ─── 巣穴の住人 ───
  updateDen(dt, t, player, d, away) {
    const sp = this.sp, w = this.world;
    const k = this.kind;
    if (!this.den) { this.alive = false; return; }
    if (this.state === 'out' || this.state === 'hide' || this.state === 'peek') {
      if (this.state === 'out' && this.alert > 0.6) {
        if (k === 'octopus' && this.alert > 0.8 && Math.random() < 0.6) {
          // 墨を吐いて逃げる
          w.particles.ink(this.pos.x, this.pos.y + 0.1, this.pos.z, 34);
          audio.ink();
          const free = w.dens.filter((dn) => !dn.occupied && dn.pos.distanceTo(this.pos) < 30 && dn.pos.distanceTo(player.pos) > 6);
          if (free.length) {
            this.den.occupied = false;
            this.den = pick(free);
            this.den.occupied = true;
          }
          this.state = 'jet';
          this.timer = 6;
          this.hittable = true;
          return;
        }
        this.state = 'hide';
        this.timer = rand(6, 11);
        if (k === 'lobster') { audio.flee(); this.flip = 1; }
      }
      if (this.state === 'hide') {
        this.out = Math.max(0, this.out - dt * 2.5);
        if (this.timer <= 0) { this.state = 'peek'; this.alert = Math.min(this.alert, 0.3); }
      } else if (this.state === 'peek') {
        this.out = Math.min(1, this.out + dt * 0.45);
        if (this.alert > 0.55) { this.state = 'hide'; this.timer = rand(5, 9); }
        if (this.out >= 1) this.state = 'out';
      } else {
        this.out = Math.min(1, this.out + dt);
        // タコはたまに散歩
        if (k === 'octopus' && this.alert < 0.15 && Math.random() < dt * 0.04) {
          const a = Math.random() * 6.28;
          const x = this.den.pos.x + this.den.dir.x * 1.5 + Math.cos(a) * 1.4, z = this.den.pos.z + this.den.dir.z * 1.5 + Math.sin(a) * 1.4;
          this.target = V3(x, w.groundAt(x, z) + 0.04, z);
          this.state = 'roam';
          this.timer = rand(6, 12);
        }
      }
      this.hittable = this.out > 0.55;
      const goal = this.denPoint(this.out);
      if (k === 'octopus') goal.y = Math.max(goal.y, w.groundAt(goal.x, goal.z) + 0.02);
      // イセエビは砂に脚をつけ、岩の下の隙間から出入りする
      if (k === 'lobster') goal.y = w.groundAt(goal.x, goal.z) + 0.158 * this.model.scale.y;
      this.pos.lerp(goal, 1 - Math.exp(-6 * dt));
      this.dir.lerp(this.denDir, 1 - Math.exp(-3 * dt)).normalize();
      // ウツボは噛みつく
      if (sp.danger && this.state === 'out' && this.headPos.distanceTo(player.pos) < 1.1 && this.biteCool <= 0 && player.submerged) {
        this.biteCool = 5;
        this.lunge = 0.35;
        this.eco.onBite?.(this);
      }
      if (this.lunge > 0) {
        this.lunge -= dt;
        this.pos.addScaledVector(_a.subVectors(player.pos, this.pos).normalize(), Math.sin((this.lunge / 0.35) * Math.PI) * 0.25);
      }
      this.animateDenizen(t, dt);
      return;
    }
    if (this.state === 'roam') {
      if (this.alert > 0.5) { this.state = 'out'; this.target = null; return; }
      const dd = this.pos.distanceTo(this.target);
      if (dd > 0.1) this.pos.addScaledVector(_a.subVectors(this.target, this.pos).normalize(), Math.min(dd, dt * 0.25));
      this.pos.y = w.groundAt(this.pos.x, this.pos.z) + 0.03;
      if (this.timer <= 0) { this.state = 'return'; }
      this.hittable = true;
      this.animateDenizen(t, dt);
      return;
    }
    if (this.state === 'return' || this.state === 'jet') {
      const goal = this.denPoint(1);
      const v = _a.subVectors(goal, this.pos);
      const dd = v.length();
      const spd = this.state === 'jet' ? (this.timer > 4.5 ? 3.2 : 1.6) : 0.35;
      if (this.state === 'jet') {
        v.y += Math.max(0, 1.5 - (this.pos.y - w.groundAt(this.pos.x, this.pos.z))) * 1.5;
      }
      this.pos.addScaledVector(v.normalize(), Math.min(dd, dt * spd));
      const g = w.groundAt(this.pos.x, this.pos.z);
      if (this.pos.y < g + 0.03) this.pos.y = g + 0.03;
      w.pushOutOfRocks(this.pos, 0.05);
      if (this.state === 'jet') { this.dir.copy(v).multiplyScalar(-1).setY(0).normalize(); this.sw.uCurl.value = -0.4; }
      if (dd < 0.2 || this.timer <= 0 && this.state === 'jet' && dd < 1) {
        this.pos.copy(goal);
        this.state = this.state === 'jet' ? 'hide' : 'out';
        this.out = this.state === 'hide' ? 0.6 : 1;
        this.timer = rand(8, 14);
        if (this.sw.uCurl) this.sw.uCurl.value = 0;
      }
      this.hittable = true;
      this.animateDenizen(t, dt);
    }
  }

  animateDenizen(t, dt) {
    if (this.kind === 'octopus') {
      this.sw.uAmp.value = this.state === 'jet' ? 0.3 : 0.08 + (this.state === 'roam' ? 0.06 : 0);
      // 驚くと体色が赤黒くなり、落ち着くと戻る
      this.sw.uAlarm.value = damp(this.sw.uAlarm.value, this.state === 'jet' || this.state === 'hide' ? 1 : Math.min(1, this.alert * 1.4), 4, dt);
      this.model.scale.setScalar(this.len * (0.8 + 0.2 * this.out));
    } else if (this.kind === 'lobster') {
      // 警戒すると触角を広げて持ち上げ、穴から出るときは歩き、逃げるときは尾で打って後ずさる
      const sw = this.sw;
      const outV = dt > 0 ? (this.out - (this.prevOut ?? this.out)) / dt : 0;
      this.prevOut = this.out;
      sw.uAmp.value = 0.06 + (this.alert > 0.3 ? 0.02 : 0);
      sw.uAlert.value = damp(sw.uAlert.value, this.alert > 0.3 ? 1 : this.alert * 2, 3, dt);
      sw.uWalk.value = damp(sw.uWalk.value, Math.abs(outV) > 0.05 && !(this.flip > 0) ? 1 : 0, 8, dt);
      if (this.flip > 0) {
        this.flip = Math.max(0, this.flip - dt * 2.2);
        sw.uCurl.value = Math.sin((1 - this.flip) * Math.PI) * 1.1;
      } else sw.uCurl.value = 0;
    } else {
      this.sw.uAmp.value = 0.03 + Math.sin(t * 1.3 + this.phase) * 0.01;
      this.speed = 0.15;
    }
  }

  // ─── ヌシ ───
  // 巨大なヌシの体が岩や斜面に埋まらない位置：尾の先が洞窟の奥の岩の手前に収まり、腹が海底から浮く高さ
  bossPoint(p) {
    const w = this.world, B = w.boss, C = B.center, n = _e.copy(B.out).negate();
    if (this.caveBack === undefined) {
      // 洞窟の奥（口と反対向き）で岩が始まる所を一度だけ測る
      const y = C.y + Math.max(1.1, this.len * 0.42);
      this.caveBack = 6;
      for (let s = 0; s < 8; s += 0.1) {
        const q = C.clone().addScaledVector(n, s);
        q.y = y;
        if (w.insideRock(q, 0.05)) { this.caveBack = s; break; }
      }
    }
    const d = p.clone().sub(C);
    const s = d.dot(n);
    const sMax = this.caveBack - 0.3 - this.len * 0.5;
    const q = p.clone().addScaledVector(n, Math.min(s, sMax) - s);
    q.y = C.y + Math.max(1.1, this.len * 0.42);
    return q;
  }

  updateBoss(dt, player, d, away) {
    const sp = this.sp, w = this.world;
    const B = w.boss;
    if (this.state === 'flee') {
      this.desired.copy(this.fleeDir);
      this.targetSpeed = sp.burst;
      if (this.timer <= 0) { this.state = 'return'; }
      this.steer(dt, 1.2);
      return;
    }
    if (this.state === 'return') {
      const home = this.bossPoint(B.pos);
      this.desired.subVectors(home, this.pos).normalize();
      this.targetSpeed = 0.8;
      this.steer(dt, 1);
      if (this.pos.distanceTo(home) < 0.8) { this.state = 'hover'; this.alert = 0.2; }
      return;
    }
    const wary = d < 8 && (player.noise > 0.3 || this.alert > 0.45);
    if (this.alert > 0.93 && d < 2.2) { this.startFlee(away, 3); return; }
    const goal = this.bossPoint(wary ? B.back : B.pos);
    const v = _a.subVectors(goal, this.pos);
    const dd = v.length();
    this.desired.copy(d < 10 ? _b.subVectors(player.pos, this.pos).setY(0).normalize() : B.out);
    // 洞窟の口から大きく外れた向きは取らない（横を向くと体が岩に埋まる）
    {
      const ao = Math.atan2(B.out.x, B.out.z);
      let da = Math.atan2(this.desired.x, this.desired.z) - ao;
      while (da > Math.PI) da -= Math.PI * 2;
      while (da < -Math.PI) da += Math.PI * 2;
      da = clamp(da, -0.7, 0.7);
      this.desired.set(Math.sin(ao + da), 0, Math.cos(ao + da));
    }
    if (dd > 0.2) this.pos.addScaledVector(v.normalize(), Math.min(dd, dt * (wary ? 0.9 : 0.35)));
    this.dir.lerp(this.desired, 1 - Math.exp(-1.2 * dt)).normalize();
    this.speed = wary && dd > 0.3 ? 0.6 : 0.12;
    this.sw.uAmp.value = 0.03;
  }

  // ─── 伝説：沖の回遊ルートを高速で巡る ───
  // ルートの目印（LegendRoute）の決まった位置を追い、遅れたら速く、先に出たら緩める。気づくと群れごとルートの外へ逸れる
  updateLegend(dt, player, d, away) {
    const sp = this.sp, R = this.route;
    this.minAlt = 1.5;
    if (!R) { this.targetSpeed = sp.cruise; this.steer(dt); return; }
    if (this.state !== 'flee' && this.alert > 0.8) R.flee(away);
    if (this.state === 'flee') {
      this.desired.copy(this.fleeDir);
      this.targetSpeed = sp.burst * (this.timer > 0.8 ? 1 : 0.75);
      if (this.timer <= 0) { this.state = 'route'; this.alert *= 0.4; }
      this.steer(dt, 1.3);
      return;
    }
    const T = R.slot(this.offset, _a);
    const lead = _b.subVectors(T, this.pos);
    const along = lead.dot(R.tan);
    this.desired.copy(lead).addScaledVector(R.tan, 5 + this.len).normalize();
    // 群れの仲間とぶつからない
    for (const o of R.members) {
      if (o === this || !o.alive) continue;
      const dx = this.pos.x - o.pos.x, dy = this.pos.y - o.pos.y, dz = this.pos.z - o.pos.z;
      const dd = dx * dx + dy * dy + dz * dz;
      const min = (this.len + o.len) * 0.45;
      if (dd < min * min && dd > 1e-6) { const k = (min - Math.sqrt(dd)) * 0.6; this.desired.x += dx * k; this.desired.y += dy * k; this.desired.z += dz * k; }
    }
    // ダイバーの体をすり抜けないよう、慌てずに少しだけ避けて通る
    const clear = this.len * 0.2 + 1.3;
    if (d < clear + 1.2) {
      _c.set(this.pos.x - player.pos.x, 0, this.pos.z - player.pos.z).normalize();
      this.desired.addScaledVector(_c, (clear + 1.2 - d) * 0.8);
    }
    this.targetSpeed = clamp(R.speed + along * 0.5, sp.cruise * 0.5, sp.burst * 0.8);
    this.steer(dt);
  }

  /** 突かれた魚だけ個別のモデルに切り替える（銛に刺さったまま動かすため） */
  materialize() {
    if (!this.instanced) return;
    const built = makeFishMesh(this.sp);
    built.mesh.scale.copy(this.model.scale);
    built.mesh.rotation.copy(this.model.rotation);
    for (const k of ['uPhase', 'uAmp', 'uBend']) built.sw[k].value = this.sw[k].value;
    this.root.remove(this.model);
    this.root.add(built.mesh);
    this.model = built.mesh;
    this.sw = built.sw;
    this.instanced = false;
    this.eco.instancerFor(this.sp).remove(this);
  }

  remove() {
    if (this.instanced) { this.eco.instancerFor(this.sp).remove(this); this.instanced = false; }
    this.alive = false;
    if (this.den) this.den.occupied = false;
    if (this.perch) this.perch.taken = false;
    this.root.parent?.remove(this.root);
  }
}

// ───────── 魚種ごとのまとめ描き ─────────
// 近くの魚は高精細、遠くの魚は軽いモデルで描く（同じ材質・同じ泳ぎの属性）
const _frustum = new THREE.Frustum();
const _pm = new THREE.Matrix4();
const _sph = new THREE.Sphere();
const _mm = new THREE.Matrix4();
const NEAR_LOD = 13;
class FishInstancer {
  constructor(scene, sp, cap) {
    const { geo, far, tex } = fishAssets(sp);
    this.cap = cap;
    const mat = makeFishMaterial(sp, tex, 'inst');
    this.lods = [geo, far].map((g) => {
      const swim = new Float32Array(cap * 3);
      const attr = new THREE.InstancedBufferAttribute(swim, 3).setUsage(THREE.DynamicDrawUsage);
      const gg = g.clone();
      gg.setAttribute('iSwim', attr);
      const mesh = new THREE.InstancedMesh(gg, mat, cap);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.frustumCulled = false; // 個体ごとに自前で視錐台判定する
      mesh.count = 0;
      scene.add(mesh);
      return { mesh, swim, attr, n: 0 };
    });
    this.members = [];
  }
  add(c) { this.members.push(c); }
  remove(c) { const i = this.members.indexOf(c); if (i >= 0) this.members.splice(i, 1); }
  update(camera) {
    if (camera) {
      _pm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      _frustum.setFromProjectionMatrix(_pm);
    }
    for (const l of this.lods) l.n = 0;
    const cp = camera?.position;
    for (const c of this.members) {
      if (!c.root.visible) continue;
      if (camera && !_frustum.intersectsSphere(_sph.set(c.pos, c.len * 0.7 + 0.2))) continue;
      const near = !cp || c.pos.distanceToSquared(cp) < (NEAR_LOD + c.len * 6) ** 2;
      const l = this.lods[near ? 0 : 1];
      if (l.n >= this.cap) continue;
      c.root.updateMatrix();
      c.model.updateMatrix();
      _mm.multiplyMatrices(c.root.matrix, c.model.matrix);
      l.mesh.setMatrixAt(l.n, _mm);
      l.swim[l.n * 3] = c.sw.uPhase.value;
      l.swim[l.n * 3 + 1] = c.sw.uAmp.value;
      l.swim[l.n * 3 + 2] = c.sw.uBend.value;
      l.n++;
    }
    for (const l of this.lods) {
      l.mesh.count = l.n;
      l.mesh.instanceMatrix.needsUpdate = true;
      l.attr.needsUpdate = true;
    }
  }
}

// ───────── 群れの制御 ─────────
class Group {
  constructor(sp, center, home, waypoints) {
    this.sp = sp;
    this.center = center.clone();
    this.home = home.clone();
    this.dir = V3(1, 0, 0);
    this.members = [];
    this.fleeT = 0;
    this.fleeDir = V3(1, 0, 0);
    this.spin = 0;
    this.speed = sp.cruise;
    this.waypoints = waypoints;
    this.wp = 0;
    this.target = null;
  }
  update(dt, world) {
    this.fleeT -= dt;
    this.spin += dt * 0.08;
    const sp = this.sp;
    let desired;
    if (this.fleeT > 0) {
      desired = this.fleeDir;
      this.speed = lerp(this.speed, sp.burst * 0.85, 1 - Math.exp(-4 * dt));
    } else {
      if (!this.target || this.center.distanceTo(this.target) < 3) {
        if (this.waypoints) { this.wp = (this.wp + 1) % this.waypoints.length; this.target = this.waypoints[this.wp].clone(); }
        else {
          const a = Math.random() * 6.28, r = rand(3, 14);
          const x = this.home.x + Math.cos(a) * r, z = this.home.z + Math.sin(a) * r;
          this.target = V3(x, 0, z);
        }
        const g = world.groundAt(this.target.x, this.target.z);
        this.target.y = Math.min(g + rand(sp.alt ? sp.alt[0] : 3, sp.alt ? sp.alt[1] : 7), -1.5);
      }
      desired = _a.subVectors(this.target, this.center).normalize();
      this.speed = lerp(this.speed, sp.cruise, 1 - Math.exp(-1 * dt));
    }
    this.dir.lerp(desired, 1 - Math.exp(-1.2 * dt)).normalize();
    this.center.addScaledVector(this.dir, this.speed * dt);
    const g = world.groundAt(this.center.x, this.center.z);
    if (this.center.y < g + 1.5) this.center.y = g + 1.5;
    if (this.center.y > -1.2) this.center.y = -1.2;
    const r = Math.hypot(this.center.x, this.center.z);
    if (r > world.playRadius - 10) { this.center.x *= 0.999; this.center.z *= 0.999; this.target = null; }
    // 全員がいなくなったら
    this.members = this.members.filter((m) => m.alive);
  }
}

// ───────── 伝説の回遊ルート ─────────
// 島の岸から約50m沖、海岸線のうねりに沿って島を一周する道筋。目印がルートを進み、魚はその決まった位置（slot）を追う
const ROUTE_N = 256;
const TAU = Math.PI * 2;
class LegendRoute {
  constructor(world, sp, R, sgn, th0, yk) {
    this.world = world;
    this.sp = sp;
    this.sgn = sgn;
    this.th = th0;
    this.members = [];
    this.speed = sp.cruise;
    this.fleeT = 0;
    this.panicked = new Set();
    // 海岸線のうねり（warpedRadius）が一定になる半径をたどる
    const raw = [];
    for (let i = 0; i < ROUTE_N; i++) {
      const a = (i / ROUTE_N) * TAU, cx = Math.cos(a), cz = Math.sin(a);
      let r = R;
      for (let k = 0; k < 8; k++) r += (R - world.radiusAt(cx * r, cz * r)) * 0.8;
      raw.push(r);
    }
    // 急な曲がりをならす
    const rs = raw.map((_, i) => {
      let sum = 0;
      for (let k = -4; k <= 4; k++) sum += raw[(i + k + ROUTE_N) % ROUTE_N];
      return sum / 9;
    });
    // 泳ぐ高さ：中層。岩の上は越え、背鰭の先まで水面下に収める
    const ceil = sp.ceil ?? -2.4;
    const ys = rs.map((r, i) => {
      const a = (i / ROUTE_N) * TAU, x = Math.cos(a) * r, z = Math.sin(a) * r;
      const g = world.groundAt(x, z);
      let y = clamp(g * yk, g + 2.2, ceil);
      const q = V3(x, y, z);
      for (let k = 0; k < 20 && y < ceil && world.insideRock(q.setY(y), 1.3); k++) y += 0.35;
      return Math.min(y, ceil);
    });
    // 高さは前後の高い方に寄せてからならす（岩の手前から浮き上がる）
    const ym = ys.map((_, i) => { let m = -99; for (let k = -6; k <= 6; k++) m = Math.max(m, ys[(i + k + ROUTE_N) % ROUTE_N]); return m; });
    this.pts = rs.map((r, i) => {
      let y = 0;
      for (let k = -5; k <= 5; k++) y += ym[(i + k + ROUTE_N) % ROUTE_N];
      const a = (i / ROUTE_N) * TAU;
      return V3(Math.cos(a) * r, y / 11, Math.sin(a) * r);
    });
    this.pos = V3();
    this.tan = V3(1, 0, 0);
    this.nrm = V3(0, 0, 1);
    this.place();
  }
  point(th, out) {
    const f = ((((th / TAU) % 1) + 1) % 1) * ROUTE_N;
    const i = Math.floor(f) % ROUTE_N, t = f - Math.floor(f);
    return out.copy(this.pts[i]).lerp(this.pts[(i + 1) % ROUTE_N], t);
  }
  place() {
    this.point(this.th, this.pos);
    const d = TAU / ROUTE_N;
    this.point(this.th + d * this.sgn, this.tan).sub(this.point(this.th - d * this.sgn, _e)).normalize();
    this.nrm.set(this.tan.z, 0, -this.tan.x).normalize();
  }
  /** 群れの中の決まった位置（off.x 横・off.y 上・off.z 後ろ） */
  slot(off, out) {
    return out.copy(this.pos).addScaledVector(this.nrm, off.x).addScaledVector(this.tan, -off.z).setY(this.pos.y + off.y);
  }
  flee(away) {
    const dir = V3(away.x, 0, away.z).normalize().multiplyScalar(1.1).add(this.tan).setY(-0.1).normalize();
    for (const m of this.members) if (m.alive && m.state !== 'flee') m.startFlee(dir, rand(1.8, 2.6));
    this.fleeT = 2.6;
  }
  update(dt, player, eco) {
    this.fleeT -= dt;
    // 銛に掛かった仲間がいれば、残りは一斉に逃げる
    for (const m of this.members) {
      if (m.caught && !m.alive && !this.panicked.has(m)) {
        this.panicked.add(m);
        this.flee(_d.subVectors(this.pos, player.pos));
      }
    }
    this.members = this.members.filter((m) => m.alive || (m.caught && eco.creatures.includes(m)));
    let lag = 0;
    for (const m of this.members) if (m.alive && m.state !== 'flee') lag = Math.max(lag, this.slot(m.offset, _c).sub(m.pos).dot(this.tan));
    const sp = this.sp;
    const want = this.fleeT > 0 ? sp.burst * 0.85 : lag > 12 ? sp.cruise * 0.55 : sp.cruise;
    this.speed = lerp(this.speed, want, 1 - Math.exp(-1.5 * dt));
    const r = Math.hypot(this.pos.x, this.pos.z) || 100;
    this.th = (this.th + (this.sgn * this.speed * dt) / r + TAU) % TAU;
    this.place();
  }
}
// 群れの並び：先頭と、斜め後ろの左右（全長 3.4m のときの間隔）
const TUNA_SLOTS = [V3(0, 0, 0), V3(-2.4, 0.45, 3.4), V3(2.5, -0.35, 3.0)];

// ───────── 装飾の小魚 ─────────
const swarmAssets = new Map();
function swarmAsset(def, detail) {
  if (!swarmAssets.has(def)) {
    const geo = buildFishGeometry(def, detail);
    const mat = makeFishMaterial(def, paintFishTexture(def, def.texScale ?? 0.5), 'swarm');
    swarmAssets.set(def, { geo, mat });
  }
  return swarmAssets.get(def);
}

class Swarm {
  constructor(scene, def, anchors, perAnchor, radius) {
    const asset = swarmAsset(def, 0.2);
    const geo = asset.geo.clone();
    const n = anchors.length * perAnchor;
    const phases = new Float32Array(n);
    for (let i = 0; i < n; i++) phases[i] = Math.random() * 20;
    geo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phases, 1));
    this.mesh = new THREE.InstancedMesh(geo, asset.mat, Math.max(n, 1));
    this.mesh.count = n;
    scene.add(this.mesh);
    this.fish = [];
    this.size = def.size;
    // 見えない所は描かないよう、アンカー群を囲む球を境界にする
    const center = V3();
    anchors.forEach((a) => center.add(a));
    center.multiplyScalar(1 / Math.max(anchors.length, 1));
    let R = 0;
    anchors.forEach((a) => (R = Math.max(R, a.distanceTo(center))));
    this.center = center;
    this.R = R + radius + 3;
    this.mesh.boundingSphere = new THREE.Sphere(center.clone(), this.R);
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._e = new THREE.Euler();
    this._s = V3();
    anchors.forEach((a) => {
      for (let k = 0; k < perAnchor; k++) {
        const f = {
          anchor: a, pos: a.clone().add(V3(rand(-1, 1), rand(0, 1), rand(-1, 1)).multiplyScalar(radius)),
          r: rand(0.3, radius), w: rand(0.2, 0.45) * (Math.random() < 0.5 ? -1 : 1), ph: rand(0, 6.28), y: rand(0.15, radius * 0.8),
          scatter: V3(), dir: V3(1, 0, 0), s: def.size * rand(0.8, 1.2),
        };
        this._m.compose(f.pos, this._q.identity(), this._s.set(f.s, f.s, f.s));
        this.mesh.setMatrixAt(this.fish.length, this._m);
        this.fish.push(f);
      }
    });
  }
  update(dt, t, player, camPos) {
    const vis = camPos.distanceTo(this.center) - this.R < 65;
    this.mesh.visible = vis;
    if (!vis) return;
    let dirty = false;
    this.fish.forEach((f, i) => {
      dirty = true;
      const a = f.ph + t * f.w;
      const tx = f.anchor.x + Math.cos(a) * f.r + f.scatter.x;
      const ty = f.anchor.y + f.y + Math.sin(t * 0.7 + f.ph) * 0.1 + f.scatter.y;
      const tz = f.anchor.z + Math.sin(a) * f.r + f.scatter.z;
      const dx = f.pos.x - player.pos.x, dy = f.pos.y - player.pos.y, dz = f.pos.z - player.pos.z;
      const dp = Math.hypot(dx, dy, dz);
      if (dp < 2.2) f.scatter.addScaledVector(V3(dx, dy * 0.5, dz).normalize(), (2.2 - dp) * dt * 4);
      f.scatter.multiplyScalar(Math.exp(-0.5 * dt));
      if (f.scatter.length() > 2.5) f.scatter.setLength(2.5);
      const nx = lerp(f.pos.x, tx, 1 - Math.exp(-2 * dt)), ny = lerp(f.pos.y, ty, 1 - Math.exp(-2 * dt)), nz = lerp(f.pos.z, tz, 1 - Math.exp(-2 * dt));
      const vx = nx - f.pos.x, vy = ny - f.pos.y, vz = nz - f.pos.z;
      const vl = Math.hypot(vx, vy, vz);
      if (vl > 1e-5) f.dir.lerp(V3(vx / vl, vy / vl * 0.5, vz / vl), 1 - Math.exp(-8 * dt)).normalize();
      f.pos.set(nx, ny, nz);
      this._e.set(-Math.asin(clamp(f.dir.y, -1, 1)), Math.atan2(f.dir.x, f.dir.z), 0, 'YXZ');
      this._q.setFromEuler(this._e);
      this._m.compose(f.pos, this._q, this._s.set(f.s, f.s, f.s));
      this.mesh.setMatrixAt(i, this._m);
    });
    if (dirty) this.mesh.instanceMatrix.needsUpdate = true;
  }
}

// ───────── キビナゴの群れ（渦を巻くベイトボール） ─────────
class BaitBall {
  constructor(scene, world, center, n = 160) {
    const def = DECOR_FISH.kibinago;
    const asset = swarmAsset(def, 0.2);
    const geo = asset.geo.clone();
    const phases = new Float32Array(n);
    for (let i = 0; i < n; i++) phases[i] = Math.random() * 20;
    geo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phases, 1));
    this.mesh = new THREE.InstancedMesh(geo, asset.mat, n);
    this.mesh.boundingSphere = new THREE.Sphere(center.clone(), 6);
    scene.add(this.mesh);
    this.world = world;
    this.center = center.clone();
    this.home = center.clone();
    this.vel = V3();
    this.squeeze = 1;
    this.fish = [];
    for (let i = 0; i < n; i++) {
      this.fish.push({
        th: Math.random() * 6.28, ph: rand(-1, 1), r: rand(0.6, 1), w: rand(0.8, 1.1),
        s: def.size * rand(0.8, 1.2), pos: center.clone(), dir: V3(1, 0, 0), k: Math.random(),
      });
    }
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._e = new THREE.Euler(); this._s = V3();
    this.wander = V3();
  }
  update(dt, t, player, camPos) {
    const vis = camPos.distanceTo(this.center) < 70;
    this.mesh.visible = vis;
    if (!vis) return;
    this.mesh.boundingSphere.center.copy(this.center);
    // ダイバーから離れ、ボールを締める
    const away = V3().subVectors(this.center, player.pos);
    const threat = clamp((7 - away.length()) / 7, 0, 1) * (0.4 + player.noise);
    if (threat > 0) this.vel.addScaledVector(away.normalize(), threat * 3 * dt);
    this.vel.addScaledVector(V3().subVectors(this.home, this.center), 0.02 * dt);
    this.vel.x += Math.sin(t * 0.13) * 0.05 * dt;
    this.vel.z += Math.cos(t * 0.11) * 0.05 * dt;
    this.vel.multiplyScalar(Math.exp(-0.8 * dt));
    this.center.addScaledVector(this.vel, dt);
    const g = this.world.groundAt(this.center.x, this.center.z);
    this.center.y = clamp(this.center.y, g + 2.2, -2.5);
    this.squeeze = lerp(this.squeeze, 1 - threat * 0.45, 1 - Math.exp(-3 * dt));
    const R = 2.4 * this.squeeze;
    this.fish.forEach((f, i) => {
      // ゆったり回る（速すぎると細い魚がちらついて見える）
      f.th += dt * f.w * (0.38 + threat * 0.5) / f.r;
      const rr = R * f.r * (0.85 + 0.15 * Math.sin(t * 0.25 + f.k * 6));
      const y = f.ph * R * 0.55 + Math.sin(t * 0.35 + f.k * 9) * 0.15;
      const tx = this.center.x + Math.cos(f.th) * rr, tz = this.center.z + Math.sin(f.th) * rr, ty = this.center.y + y;
      f.pos.x = lerp(f.pos.x, tx, 1 - Math.exp(-3 * dt));
      f.pos.y = lerp(f.pos.y, ty, 1 - Math.exp(-3 * dt));
      f.pos.z = lerp(f.pos.z, tz, 1 - Math.exp(-3 * dt));
      // 向きは円の接線から直接求める（毎フレームの揺れを出さない）
      f.dir.lerp(_a.set(-Math.sin(f.th), 0, Math.cos(f.th)), 1 - Math.exp(-4 * dt)).normalize();
      this._e.set(-Math.asin(clamp(f.dir.y, -1, 1)), Math.atan2(f.dir.x, f.dir.z), 0, 'YXZ');
      this._q.setFromEuler(this._e);
      this._m.compose(f.pos, this._q, this._s.set(f.s, f.s, f.s));
      this.mesh.setMatrixAt(i, this._m);
    });
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

// ───────── ウミガメ ─────────
class Turtle {
  constructor(scene, world) {
    this.world = world;
    this.g = makeTurtle();
    this.g.scale.setScalar(1.05);
    scene.add(this.g);
    this.ang = Math.random() * 6.28;
    this.R = 95;
    this.pos = this.g.position;
    this.dir = V3(1, 0, 0);
    this.breathT = rand(30, 60);
    this.mode = 'cruise';
    this.fleeT = 0;
    this.alive = true;
    this.hittable = true;
    this.kind = 'turtle';
    this.update(0, 0);
  }
  hitTest(p0, p1) {
    const r = segSeg(p0, p1, this.pos, this.pos);
    return r.dist < 0.5 ? { s: r.s, head: false } : null;
  }
  update(dt, t, player) {
    this.breathT -= dt;
    if (this.breathT < 0 && this.mode === 'cruise') { this.mode = 'breathe'; }
    const spd = this.fleeT > 0 ? 0.035 : 0.012;
    this.fleeT -= dt;
    this.ang += dt * spd;
    const R = this.R + Math.sin(this.ang * 3) * 20;
    const x = Math.cos(this.ang) * R, z = Math.sin(this.ang) * R;
    const g = this.world.groundAt(x, z);
    let y;
    if (this.mode === 'breathe') {
      y = lerp(this.pos.y, -0.25, 1 - Math.exp(-0.35 * dt));
      if (this.pos.y > -0.4) { this.mode = 'hold'; this.holdT = 3; }
    } else if (this.mode === 'hold') {
      y = -0.3;
      this.holdT -= dt;
      if (this.holdT < 0) { this.mode = 'cruise'; this.breathT = rand(45, 80); }
    } else {
      y = lerp(this.pos.y, Math.max(g + 2.2, -9 + Math.sin(this.ang * 5) * 2), 1 - Math.exp(-0.3 * dt));
    }
    const np = V3(x, Math.max(y, g + 0.8), z);
    const v = np.clone().sub(this.pos);
    if (dt > 0 && v.lengthSq() > 1e-8) this.dir.lerp(v.normalize(), 1 - Math.exp(-2 * dt)).normalize();
    this.pos.copy(np);
    this.g.rotation.set(-Math.asin(clamp(this.dir.y, -1, 1)) * 0.6, Math.atan2(this.dir.x, this.dir.z), 0, 'YXZ');
    const fl = this.g.userData.flippers;
    const s = Math.sin(t * (this.fleeT > 0 ? 3 : 1.2));
    for (const f of fl) {
      if (f.front) { f.pivot.rotation.z = f.side * (0.1 + s * 0.55); f.pivot.rotation.y = f.side * s * 0.25; }
      else f.pivot.rotation.z = f.side * Math.sin(t * 1.2 + 1) * 0.2;
    }
    this.g.userData.head.rotation.y = Math.sin(t * 0.4) * 0.2;
  }
  scare() { this.fleeT = 8; }
}

// ───────── 生態系マネージャ ─────────
export class Ecosystem {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.creatures = [];
    this.groups = [];
    this.swarms = [];
    this.respawnQueue = [];
    this.instancers = new Map();
    this.frame = 0;
    this.onBite = null;
    this.legendRoutes = [];
    this.legendsOn = false;
  }

  instancerFor(sp) {
    if (!this.instancers.has(sp)) this.instancers.set(sp, new FishInstancer(this.scene, sp, Math.ceil(sp.count * 1.6) + 24));
    return this.instancers.get(sp);
  }

  spawnAll() {
    const w = this.world;
    for (const sp of Object.values(SPECIES)) {
      if (sp.type === 'group' || sp.type === 'school' || sp.type === 'legend') continue;
      for (let i = 0; i < sp.count; i++) this.spawn(sp);
    }
    // メジナの群れ
    const mj = SPECIES.mejina;
    for (let gi = 0; gi < Math.round(mj.count / mj.groupSize); gi++) this.spawnGroup(mj, mj.groupSize);
    // アジの群れ（沖を回遊）
    // アジは4つの大きな群れ（沖2・ドロップオフ沿い2）
    for (let r = 0; r < 4; r++) this.spawnGroup(SPECIES.aji, Math.round(SPECIES.aji.count / 4), null, r);

    // 装飾の小魚
    // 近いアンカー同士をまとめて小さな塊ごとに描く（視界外は描画しない）
    const chunked = (anchors, def, per, radius) => {
      const cells = new Map();
      for (const a of anchors) {
        const k = `${Math.floor(a.x / 45)},${Math.floor(a.z / 45)}`;
        if (!cells.has(k)) cells.set(k, []);
        cells.get(k).push(a);
      }
      for (const list of cells.values()) this.swarms.push(new Swarm(this.scene, def, list, per, radius));
    };
    const coral = (w.coralSpots || []).map((p) => p.clone().add(V3(0, 0.3, 0)));
    chunked(coral, DECOR_FISH.suzume, 20, 1.6);
    const fans = (w.fanSpots || []).filter((p) => p.y < -6).map((p) => p.clone().add(V3(0, 0.6, 0)));
    chunked(fans, DECOR_FISH.hanadai, 30, 2.4);
    // 岩礁の岩の上にも小魚の群れ（青いスズメダイと橙のハナダイ）
    const rockTops = w.clusters.map((c) => V3(c.x, c.y + 1.8, c.z));
    chunked(rockTops.filter((_, i) => i % 2 === 0), DECOR_FISH.suzume, 26, 2.0);
    chunked(rockTops.filter((_, i) => i % 2 === 1), DECOR_FISH.hanadai, 26, 2.2);
    if (w.anemones?.length) chunked(w.anemones, DECOR_FISH.kumanomi, 2, 0.25);
    // キビナゴのベイトボール（岩礁の上の中層）
    const cl = w.clusters.filter((c) => c.y < -4.5).slice(0, 20);
    for (const c of cl) this.swarms.push(new BaitBall(this.scene, w, V3(c.x + 4, c.y + 3.2, c.z + 4), 180));

    this.turtle = new Turtle(this.scene, w);
  }

  spawnPoint(sp, awayFrom) {
    const w = this.world;
    const ok = (p) => !awayFrom || p.distanceTo(awayFrom) > 30;
    const zone = sp.zone;
    let list = zone === 'reef' ? w.spots.reef : zone === 'deepreef' ? w.spots.deepreef : zone === 'sand' ? w.spots.sand : w.spots.open;
    list = list.filter(ok);
    if (!list.length) return null;
    // 同じ地点に重ならないよう少し散らす
    const p = pick(list).clone();
    p.x += rand(-4, 4);
    p.z += rand(-4, 4);
    return p;
  }

  spawn(sp, awayFrom = null) {
    const w = this.world;
    const opts = {};
    if (sp.type === 'perch') {
      const cand = w.perches.filter((p) => !p.taken && p.depth < -3 && p.depth > -15 && (!awayFrom || p.pos.distanceTo(awayFrom) > 30));
      if (!cand.length) return null;
      opts.perch = pick(cand);
      opts.bias = clamp(-opts.perch.depth / 20, 0, 0.6);
    } else if (sp.type === 'den') {
      const cand = w.dens.filter((d) => !d.occupied && d.depth < -2.5 && (!sp.eel || d.rock.size >= EEL_DEN_ROCK) && (!awayFrom || d.pos.distanceTo(awayFrom) > 30));
      if (!cand.length) return null;
      opts.den = pick(cand);
    } else if (sp.type === 'boss') {
      opts.bias = 0.2;
    } else {
      const p = this.spawnPoint(sp, awayFrom);
      if (!p) return null;
      const g = w.groundAt(p.x, p.z);
      p.y = sp.alt ? g + rand(sp.alt[0], sp.alt[1]) : g + 0.1;
      p.y = Math.min(p.y, -1);
      opts.pos = p;
      opts.home = p;
      opts.bias = clamp(-g / 25, 0, 0.6);
    }
    const c = new Creature(this, sp, opts);
    this.creatures.push(c);
    return c;
  }

  spawnGroup(sp, n, awayFrom = null, route = 0) {
    const w = this.world;
    let center, waypoints = null;
    if (sp.type === 'school') {
      // 回遊ルートは群れごとに別の沖の地点を巡る
      const open = w.spots.open;
      waypoints = (open.length >= (route + 1) * 6 ? open.slice(route * 6, route * 6 + 6) : open.slice(0, 6)).map((p) => p.clone());
      if (!waypoints.length) return;
      center = waypoints[0].clone();
      center.y = w.groundAt(center.x, center.z) + 5;
    } else {
      center = this.spawnPoint(sp, awayFrom);
      if (!center) return;
      center.y = w.groundAt(center.x, center.z) + 3;
    }
    const g = new Group(sp, center, center, waypoints);
    const spread = sp.type === 'school' ? 1.2 + Math.sqrt(n) * 0.38 : 1.6 + Math.sqrt(n) * 0.45;
    const baseSize = sizeFor(sp);
    for (let i = 0; i < n; i++) {
      const off = V3(rand(-1, 1), rand(-0.5, 0.5), rand(-1, 1)).multiplyScalar(spread);
      const c = new Creature(this, sp, { pos: center.clone().add(off), home: center, group: g, offset: off, cm: Math.round(baseSize * rand(0.85, 1.15)) });
      c.cm = clamp(c.cm, sp.size[0], sp.size[1]);
      g.members.push(c);
      this.creatures.push(c);
    }
    this.groups.push(g);
  }

  // ─── 伝説 ───
  /** 伝説の魚を放す（バショウカジキ3匹・クロマグロ3匹の群れ×3）。awayFrom の近くには出さない */
  spawnLegends(awayFrom = null) {
    if (this.legendsOn) return;
    this.legendsOn = true;
    const { kuromaguro: tuna, bashou: sail } = SPECIES;
    for (let i = 0; i < sail.count; i++) this.spawnLegendRoute(sail, 1, (i / sail.count) * TAU + 0.4, i % 2 ? -1 : 1, i / Math.max(1, sail.count - 1), awayFrom);
    const nSchool = Math.round(tuna.count / tuna.schoolSize);
    for (let i = 0; i < nSchool; i++) this.spawnLegendRoute(tuna, tuna.schoolSize, (i / nSchool) * TAU + 1.45, i % 2 ? 1 : -1, i / Math.max(1, nSchool - 1), awayFrom);
  }

  spawnLegendRoute(sp, n, th, sgn, k, awayFrom) {
    const R = lerp(sp.route[0], sp.route[1], k);
    const route = new LegendRoute(this.world, sp, R, sgn, th, rand(0.5, 0.62));
    // 近くに湧かないよう、目印をダイバーから離れた所まで進めておく
    for (let i = 0; i < 64 && awayFrom && route.pos.distanceTo(awayFrom) < 70; i++) { route.th += TAU / 64; route.place(); }
    this.legendRoutes.push(route);
    for (let i = 0; i < n; i++) this.spawnLegendMember(route, n > 1 ? TUNA_SLOTS[i % TUNA_SLOTS.length] : V3());
    return route;
  }

  spawnLegendMember(route, slot) {
    const sp = route.sp;
    const cm = sizeFor(sp, 0.3);
    const offset = slot.clone().multiplyScalar(((cm / 100) * sp.vis) / 3.4);
    offset.slot = slot;
    const pos = route.slot(offset, V3()).addScaledVector(route.tan, -6);
    const c = new Creature(this, sp, { pos, route, offset, cm });
    c.state = 'route';
    c.dir.copy(route.tan);
    c.speed = sp.cruise;
    c.applyTransform(0);
    route.members.push(c);
    this.creatures.push(c);
    return c;
  }

  /** 獲った伝説の代わり：欠けた群れに戻すか、空いた道筋にまた一匹放す（ダイバーの近くには出さない） */
  respawnLegend(sp, player) {
    const cap = sp.schoolSize || 1;
    const live = (r) => r.members.filter((m) => m.alive);
    const r = this.legendRoutes.find((r) => r.sp === sp && live(r).length < cap && r.pos.distanceTo(player.pos) > 60);
    if (!r) return false;
    const slots = cap > 1 ? TUNA_SLOTS : [V3()];
    const used = live(r).map((m) => m.offset.slot);
    this.spawnLegendMember(r, slots.find((s) => !used.includes(s)) || slots[0]);
    return true;
  }

  queueRespawn(sp, delay) { this.respawnQueue.push({ sp, t: sp.legend ? Math.max(delay, rand(150, 220)) : delay }); }

  update(dt, t, player) {
    for (const g of this.groups) g.update(dt, this.world);
    for (const r of this.legendRoutes) r.update(dt, player, this);
    this.groups = this.groups.filter((g) => g.members.length > 0 || g.sp.type === 'school');
    const cam = this.camPos || player.pos;
    this.frame++;
    for (let i = 0; i < this.creatures.length; i++) {
      const c = this.creatures[i];
      // 遠くの魚は3フレームに1回だけ考える（数が多くても軽く保つ）
      const far = c.pos.distanceToSquared(player.pos) > 60 * 60 && c.pos.distanceToSquared(cam) > 60 * 60;
      if (far) {
        c._acc = (c._acc || 0) + dt;
        if ((this.frame + i) % 3 !== 0) continue;
        c.update(c._acc, t, player);
        c._acc = 0;
      } else {
        c._acc = 0;
        c.update(dt, t, player);
      }
      if (c.alive) c.root.visible = c.pos.distanceToSquared(cam) < 85 * 85;
    }
    for (const inst of this.instancers.values()) inst.update(this.camera);
    for (const s of this.swarms) s.update(dt, t, player, cam);
    this.turtle?.update(dt, t, player);
    // 復活
    for (const r of this.respawnQueue) {
      r.t -= dt;
      if (r.t <= 0) {
        r.done = true;
        const sp = r.sp;
        if (sp.legend) {
          // ダイバーの近くにしか空きがなければ、少し待ってからもう一度
          if (!this.respawnLegend(sp, player)) { r.done = false; r.t = 20; }
        } else if (sp.type === 'school' || sp.type === 'group') {
          // 欠けた群れに一匹だけ戻す（満員なら新しい群れを一匹から始める）
          const cap = sp.groupSize || Infinity;
          const sch = this.groups.filter((g) => g.sp === sp && g.members.length < cap).sort((a, b) => a.members.length - b.members.length)[0];
          if (!sch && sp.type === 'group') this.spawnGroup(sp, 1, player.pos);
          else if (sch) {
            const c = new Creature(this, sp, { pos: sch.center.clone(), home: sch.center, group: sch, offset: V3(rand(-2, 2), rand(-0.5, 0.5), rand(-2, 2)) });
            sch.members.push(c);
            this.creatures.push(c);
          }
        } else this.spawn(sp, player.pos);
      }
    }
    this.respawnQueue = this.respawnQueue.filter((r) => !r.done);
  }

  /** 突きの軌跡と当たる生き物を探す（最初に当たったもの） */
  /** extra: 当たり判定の上乗せ（砂に刺さった時、そばの獲物を押さえ込む用） */
  hitScan(p0, p1, extra = 0) {
    let best = null;
    for (const c of this.creatures) {
      if (!c.alive || c.caught) continue;
      if (c.pos.distanceToSquared(p1) > 16) continue;
      const h = c.hitTest(p0, p1, extra);
      if (h && (!best || h.s < best.h.s)) best = { c, h };
    }
    if (this.turtle) {
      const h = this.turtle.hitTest(p0, p1);
      if (h && (!best || h.s < best.h.s)) best = { c: this.turtle, h };
    }
    return best;
  }

  scareAround(p, radius, amount) {
    for (const c of this.creatures) {
      if (!c.alive) continue;
      const d = c.pos.distanceTo(p);
      if (d < radius) c.scare(amount * (1 - d / radius));
    }
  }

  /** 視線上の生き物（ターゲット表示用） */
  aimed(origin, dir, maxDist = 9, prev = null) {
    let best = null, bestScore = Infinity;
    for (const c of this.creatures) {
      if (!c.alive || c.caught) continue;
      _a.subVectors(c.pos, origin);
      const along = _a.dot(dir);
      if (along < 0.3 || along > maxDist) continue;
      const perp = _b.copy(_a).addScaledVector(dir, -along).length();
      // 直前に狙っていた相手は外れにくく（群れの中でタグが飛び回らないように）
      const sticky = c === prev ? 1.8 : 1;
      const tol = (Math.max(c.len * 0.45, 0.18) + along * 0.03) * sticky;
      if (perp < tol) {
        const score = (along + perp * 4) * (c === prev ? 0.5 : 1);
        if (score < bestScore) { bestScore = score; best = c; }
      }
    }
    return best;
  }
}
