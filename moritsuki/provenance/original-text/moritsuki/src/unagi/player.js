// 主人公（一人称）: 側溝の中を歩く・見回す。落ち込みはよじ登る／下りる。暗渠ではかがむ
import * as THREE from 'three';
import { clamp, lerp, smoothstep } from './core/noise.js';
import { HW, DROPS, CULVERT, S_BACK, S_END, bedAt, levelAt } from './ditch.js';
import { EYE } from './body.js';

const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const BODY_R = 0.17;
export const S_STOP = S_END + 0.35;

export class Player {
  constructor(camera) {
    this.camera = camera;
    this.pos = V3();
    this.vel = V3();
    this.yaw = 0;          // 0 = 上流（-z）を向く
    this.pitch = -0.5;
    this.sens = 1;
    this.invertY = false;
    this.fovBase = 72;
    this.crouch = 0;
    this.crouchTarget = 0;
    this.locked = false;
    this.lookOverride = null;
    this.depth = 0;
    this.shake = 0;
    this.bobT = 0;
    this.speed = 0;
    this.noise = 0;        // 生き物をおどかす強さ（0..1）
    this.climb = null;
    this.stepPh = 0;
    this.onStep = null;    // 足を踏み出した（x, z, 強さ）
    this.onClimb = null;
    this.blocked = '';
    this.slow = 1;
  }

  get s() { return -this.pos.z; }
  get forward() { return V3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)); }

  reset(x, s, yaw = 0) {
    this.pos.set(x, bedAt(x, s), -s);
    this.vel.set(0, 0, 0);
    this.yaw = yaw; this.pitch = -0.5;
    this.crouch = 0; this.crouchTarget = 0;
    this.climb = null;
  }

  update(dt, input, t) {
    // 見回す
    const [mx, my] = input.consumeMouse(dt);
    this.mouse = [mx, my];
    if (this.lookOverride) {
      const o = this.lookOverride;
      let dy = o.yaw - this.yaw;
      dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      this.yaw += dy * (1 - Math.exp(-o.k * dt));
      this.pitch = lerp(this.pitch, o.pitch, 1 - Math.exp(-o.k * dt));
      if (o.free) { const s = 0.0022 * this.sens; this.yaw -= mx * s * 0.4; this.pitch -= my * s * 0.4 * (this.invertY ? -1 : 1); }
    } else {
      const s = 0.0022 * this.sens;
      this.yaw -= mx * s;
      this.pitch -= my * s * (this.invertY ? -1 : 1);
      this.pitch = clamp(this.pitch, -1.45, 0.9);
    }

    // 暗渠ではかがむ
    const sNow = this.s;
    const inCulv = sNow > CULVERT.s0 - 0.45 && sNow < CULVERT.s1 + 0.45;
    this.crouchTarget = inCulv ? 1 : this.forceCrouch ? 1 : 0;

    if (this.climb) this.updateClimb(dt);
    else this.walk(dt, input);

    this.crouch = lerp(this.crouch, this.crouchTarget, 1 - Math.exp(-6 * dt));
    this.depth = Math.max(0, levelAt(this.s) - this.pos.y);

    // カメラ
    const cam = this.camera;
    const moving = this.speed > 0.06;
    this.bobT += dt * (moving ? 2.6 + this.speed * 3.2 : 0);
    const bob = Math.sin(this.bobT * 2) * 0.014 * Math.min(this.speed * 2, 1);
    const sway = Math.sin(this.bobT) * 0.006 * Math.min(this.speed * 2, 1);
    let eye = this.pos.y + lerp(EYE, 0.66, this.crouch) + bob + (this.climb ? this.climb.eyeK : 0);
    const fw = this.forward;
    const ex = this.pos.x + fw.x * lerp(0.12, 0.2, this.crouch) + Math.cos(this.yaw) * sway, ez = this.pos.z + fw.z * lerp(0.12, 0.2, this.crouch) - Math.sin(this.yaw) * sway;
    this.shake = Math.max(0, this.shake - dt * 2.5);
    const sh = this.shake * this.shake;
    this.roll = lerp(this.roll || 0, -this.strafe * 0.012 + sway * 0.8, 1 - Math.exp(-4 * dt));
    cam.position.set(ex + (Math.random() - 0.5) * 0.01 * sh, eye + (Math.random() - 0.5) * 0.01 * sh, ez);
    cam.rotation.set(this.pitch + (Math.random() - 0.5) * 0.01 * sh, this.yaw, this.roll, 'YXZ');
    cam.updateMatrixWorld();
  }

  walk(dt, input) {
    const f = this.forward, r = V3(-f.z, 0, f.x);
    const want = V3();
    let fwdIn = 0, sideIn = 0;
    if (!this.locked) {
      if (input.down('KeyW')) { want.add(f); fwdIn += 1; }
      if (input.down('KeyS')) { want.sub(f); fwdIn -= 1; }
      if (input.down('KeyD')) { want.add(r); sideIn += 1; }
      if (input.down('KeyA')) { want.sub(r); sideIn -= 1; }
    }
    this.strafe = sideIn;
    if (want.lengthSq() > 0) want.normalize();
    // Shift: そっと歩く（水音が小さく、生き物に気づかれにくい）
    this.sneak = input.down('ShiftLeft') || input.down('ShiftRight');
    // 水の中は重い。網を水に入れている間・かがんでいる間はもっと遅い
    const maxV = (this.sneak ? 0.3 : 0.8) * this.slow * (1 - this.crouch * 0.5);
    const acc = 1 - Math.exp(-(want.lengthSq() ? 3.2 : 4.5) * dt);
    this.vel.x = lerp(this.vel.x, want.x * maxV, acc);
    this.vel.z = lerp(this.vel.z, want.z * maxV, acc);
    const nx = this.pos.x + this.vel.x * dt;
    const nz = this.pos.z + this.vel.z * dt;
    this.move(nx, nz);
    this.speed = Math.hypot(this.vel.x, this.vel.z);
    // 足: 底の高さへ
    const b = bedAt(this.pos.x, this.s);
    this.pos.y = lerp(this.pos.y, b, 1 - Math.exp(-14 * dt));
    // 足音（踏み出すたび）
    if (this.speed > 0.05) {
      const prev = this.stepPh;
      this.stepPh += dt * (1.2 + this.speed * 2.2);
      if (Math.floor(prev) !== Math.floor(this.stepPh)) {
        const side = Math.floor(this.stepPh) % 2 ? 1 : -1;
        const q = V3(Math.cos(this.yaw) * 0.1 * side, 0, -Math.sin(this.yaw) * 0.1 * side);
        this.onStep?.(this.pos.x + q.x, this.pos.z + q.z, Math.min(1, this.speed / 0.7) * (this.sneak ? 0.5 : 1));
      }
    }
    // 生き物をおどかす強さ
    this.noise = lerp(this.noise, clamp(this.speed / 0.75, 0, 1) * (this.sneak ? 0.6 : 1), 1 - Math.exp(-6 * dt));
  }

  /** 歩ける範囲・落ち込み */
  move(nx, nz) {
    this.blocked = '';
    const lim = HW - BODY_R;
    if (Math.abs(nx) > lim) { nx = Math.sign(nx) * lim; }
    let ns = -nz;
    const s0 = this.s;
    if (ns < S_BACK) { ns = S_BACK; this.blocked = 'back'; }
    if (ns > S_STOP) { ns = S_STOP; this.blocked = 'gate'; }
    // 落ち込み: 上流へ越えるならよじ登る、下流へ越えるなら下りる
    for (const d of DROPS) {
      if (s0 < d.s - 0.12 && ns >= d.s - 0.12) {
        this.startClimb(d, +1, nx);
        return;
      }
      if (s0 > d.s + 0.12 && ns <= d.s + 0.12) {
        this.startClimb(d, -1, nx);
        return;
      }
    }
    this.pos.x = nx;
    this.pos.z = -ns;
  }

  startClimb(d, dir, x) {
    const from = this.pos.clone();
    const ts = dir > 0 ? d.s + 0.3 : d.s - 0.35;
    const to = V3(x, bedAt(x, ts), -ts);
    this.climb = { t: 0, T: dir > 0 ? 1.05 : 0.6, from, to, dir, eyeK: 0 };
    this.vel.set(0, 0, 0);
    this.speed = 0;
    this.onClimb?.(dir);
  }
  updateClimb(dt) {
    const c = this.climb;
    c.t += dt;
    const k = clamp(c.t / c.T, 0, 1);
    const e = k * k * (3 - 2 * k);
    this.pos.x = lerp(c.from.x, c.to.x, e);
    this.pos.z = lerp(c.from.z, c.to.z, smoothstep(0.35, 1, k));
    // 上るときは一度沈んで（ひざをついて）から上がる
    const lift = c.dir > 0 ? smoothstep(0.15, 0.75, k) : smoothstep(0.1, 0.7, k);
    this.pos.y = lerp(c.from.y, c.to.y, lift);
    c.eyeK = c.dir > 0 ? -Math.sin(k * Math.PI) * 0.35 : -Math.sin(k * Math.PI) * 0.12;
    this.noise = 0.9;
    if (k >= 1) this.climb = null;
  }
}
