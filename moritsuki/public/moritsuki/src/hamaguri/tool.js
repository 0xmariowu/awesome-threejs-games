// 棒を構えて突く
// ・狙い: 視線と砂の交点に棒の先を向ける（体から 0.3〜0.62m の範囲）。棒は胸の前の一点と先を結ぶ向きに傾く
// ・突き: 振り上げ → 突き下ろし → 止め → 引き上げ。クリック連打で 1 回ずつ（先に押した分はためておく）、押しっぱなしで一定のリズム
// ・突き下ろす瞬間に砂の中を調べ、爪が殻に届くならそこで止まる（カチン）。届かなければ砂に刺さる（ザクッ）
import * as THREE from 'three';
import { makeRodMesh, TINE, SHAFT_TOP, GRIPS, TINE_NODES } from './rod.js';
import { clamp, lerp } from './core/noise.js';

const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export const PEN = 0.085;     // 爪が砂に刺さる深さ
const HOVER = 0.035;          // 構えている時の、砂からの爪の先の高さ
const RAISE = 0.15;           // 振り上げの高さ
const T_RAISE = 0.06, T_PLUNGE = 0.065, T_HOLD = 0.05, T_LIFT = 0.11;
const AUTO = 0.3;             // 押しっぱなしの間隔

const easeOut = (t) => 1 - (1 - t) ** 3;
const easeIn = (t) => t * t;

export class Tool {
  constructor(scene) {
    this.mesh = makeRodMesh();
    scene.add(this.mesh);
    this.head = V3();         // 爪の付け根（格子）の中心の目標（砂の上）
    this.headS = null;        // なめらかに追う位置
    this.lift = HOVER;        // 砂から爪の先までの高さ（負 = 刺さっている）
    this.phase = 'idle';
    this.t = 0;
    this.queue = 0;
    this.autoT = 0;
    this.count = 0;
    this.axis = V3(0, 1, 0);
    this.yaw = 0;
    this.shake = 0;
    this.stopAt = -PEN;
    this.pending = null;
    this.onStrike = null;     // (結果) => void  突き下ろしきった時
    this.onPlunge = null;     // 突き下ろし始め（音・水しぶき）
    this.planted = null;      // 掘っている間は砂に立てておく { pos }
    this.visible = true;
  }

  get busy() { return this.phase !== 'idle'; }
  /** 爪の先の中心（世界） */
  tipCenter(out = V3()) { return out.copy(this.headS).addScaledVector(this.axis, -TINE); }

  /** 爪の先の [x, z]（突き下ろす先の砂の上） */
  tines(center, yaw) {
    const c = Math.cos(yaw), s = Math.sin(yaw);
    return TINE_NODES.map(([x, z]) => [center.x + x * c + z * s, center.z - x * s + z * c]);
  }

  aim(player, camera, world) {
    // 視線と地面（足もとの高さ）の交点
    const dir = V3(0, 0, -1).applyQuaternion(camera.quaternion);
    const g0 = world.groundAt(player.pos.x, player.pos.z);
    let dx, dz;
    if (dir.y < -0.05) {
      const t = (camera.position.y - g0) / -dir.y;
      dx = camera.position.x + dir.x * t - player.pos.x;
      dz = camera.position.z + dir.z * t - player.pos.z;
    } else { dx = dir.x * 9; dz = dir.z * 9; }
    // 体の前（向きから ±50° の範囲）、0.3〜0.62m
    const fwd = V3(-Math.sin(player.yaw), 0, -Math.cos(player.yaw));
    let ang = Math.atan2(dx * fwd.z - dz * fwd.x, dx * fwd.x + dz * fwd.z);
    ang = clamp(ang, -0.85, 0.85);
    const d = clamp(Math.hypot(dx, dz), 0.3, 0.62);
    const c = Math.cos(ang), s = Math.sin(ang);
    const hx = fwd.x * c - fwd.z * s, hz = fwd.x * s + fwd.z * c;
    this.head.set(player.pos.x + hx * d, 0, player.pos.z + hz * d);
    this.aimYaw = player.yaw;
  }

  press() { if (this.queue < 2) this.queue++; }

  update(dt, { player, world, holding, t }) {
    const sp = this;
    // なめらかに狙いを追う（突いている間はほとんど動かさない）
    if (!this.headS) this.headS = this.head.clone();
    const follow = this.phase === 'plunge' || this.phase === 'hold' ? 0 : this.phase === 'lift' ? 6 : 16;
    this.headS.x = lerp(this.headS.x, this.head.x, 1 - Math.exp(-follow * dt));
    this.headS.z = lerp(this.headS.z, this.head.z, 1 - Math.exp(-follow * dt));
    this.yaw = lerp(this.yaw, this.aimYaw ?? player.yaw, 1 - Math.exp(-10 * dt));

    // 押しっぱなし: 一定のリズムで
    if (holding) { this.autoT -= dt; if (this.autoT <= 0 && this.queue === 0 && (this.phase === 'idle' || this.phase === 'lift')) { this.queue = 1; } }
    else this.autoT = 0;

    this.t += dt;
    switch (this.phase) {
      case 'idle':
        this.lift = lerp(this.lift, HOVER, 1 - Math.exp(-12 * dt));
        if (this.queue > 0 && !this.planted) this.start();
        break;
      case 'raise': {
        const k = clamp(this.t / T_RAISE, 0, 1);
        this.lift = lerp(this.from, RAISE, easeOut(k));
        if (k >= 1) this.beginPlunge(world);
        break;
      }
      case 'plunge': {
        const k = clamp(this.t / T_PLUNGE, 0, 1);
        this.lift = lerp(RAISE, this.stopAt, easeIn(k));
        if (k >= 1) {
          this.phase = 'hold'; this.t = 0;
          this.onStrike?.(this.pending);
          if (this.pending?.hit) { this.shake = 1; this.lift = this.stopAt + 0.006; }
        }
        break;
      }
      case 'hold': {
        if (this.pending?.hit) this.lift = this.stopAt + 0.006 * Math.exp(-this.t * 30) * Math.cos(this.t * 90);
        const hold = this.pending?.hit ? T_HOLD * 1.6 : T_HOLD;
        if (this.t >= hold || (this.queue > 0 && this.t >= hold * 0.4)) { this.phase = 'lift'; this.t = 0; this.from = this.lift; }
        break;
      }
      case 'lift': {
        const k = clamp(this.t / T_LIFT, 0, 1);
        this.lift = lerp(this.from, HOVER + 0.03, easeOut(k));
        // 連打なら引き上げの途中で次へ
        if (this.queue > 0 && k > 0.45) { this.start(); break; }
        if (k >= 1) { this.phase = 'idle'; this.t = 0; }
        break;
      }
    }
    this.shake = Math.max(0, this.shake - dt * 5);
    this.pose(player, world, t);
  }

  start() {
    this.queue = Math.max(0, this.queue - 1);
    this.autoT = AUTO;
    this.phase = 'raise';
    this.t = 0;
    this.from = this.lift;
  }

  beginPlunge(world) {
    this.phase = 'plunge';
    this.t = 0;
    this.count++;
    // 突く先を決めて、砂の中を調べる
    const c = this.headS;
    const g = world.groundAt(c.x, c.z);
    const tines = this.tines(c, this.yaw);
    const hit = world.field ? world.field.stab(tines, PEN) : null;
    this.stopAt = hit ? -hit.depth : -PEN * (0.9 + Math.random() * 0.1);
    this.pending = { hit, x: c.x, z: c.z, g, yaw: this.yaw, tines, tine: hit ? tines[hit.tine] : null };
    this.onPlunge?.(this.pending);
  }

  /** 棒の姿勢: 先（格子）と胸の前の一点を結ぶ */
  pose(player, world, t) {
    const m = this.mesh;
    if (this.planted) {
      // 掘っている間: 穴のそばの砂に立てておく
      const p = this.planted.pos;
      m.position.copy(p);
      m.quaternion.setFromAxisAngle(V3(0, 1, 0), this.planted.yaw);
      m.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(V3(1, 0, 0).applyAxisAngle(V3(0, 1, 0), this.planted.yaw), 0.12));
      this.axis.set(0, 1, 0).applyQuaternion(m.quaternion);
      this.grips = null;
      return;
    }
    const c = this.headS;
    const g = world.groundAt(c.x, c.z);
    const head = V3(c.x, g + TINE + this.lift, c.z);
    // 胸の前の点（突くと手ごと下がる）
    const fwd = V3(-Math.sin(player.yaw), 0, -Math.cos(player.yaw));
    const right = V3(-fwd.z, 0, fwd.x);
    const top = player.pos.clone().addScaledVector(fwd, 0.2).addScaledVector(right, 0.16).add(V3(0, 0.88 + (this.lift - HOVER) * 0.9 - player.crouch * 0.45, 0));
    this.axis.copy(top).sub(head).normalize();
    // 手ごたえの震え
    const sh = this.shake * this.shake;
    head.x += Math.sin(t * 173) * 0.003 * sh; head.z += Math.cos(t * 151) * 0.003 * sh;
    m.position.copy(head);
    const q = new THREE.Quaternion().setFromUnitVectors(V3(0, 1, 0), this.axis);
    // 格子の向き = 体の向き
    const qy = new THREE.Quaternion().setFromAxisAngle(V3(0, 1, 0), this.yaw);
    m.quaternion.copy(q).multiply(qy);
    this.grips = GRIPS.map((k) => head.clone().addScaledVector(this.axis, k)).reverse();
    this.topPoint = head.clone().addScaledVector(this.axis, SHAFT_TOP);
  }

  /** 柄が水面を切る所（波紋用） */
  surfaceCross(waterY) {
    const h = this.mesh.position;
    if (this.axis.y < 0.05) return null;
    const k = (waterY - h.y) / this.axis.y;
    if (k < 0 || k > SHAFT_TOP) return null;
    return h.clone().addScaledVector(this.axis, k);
  }
}
