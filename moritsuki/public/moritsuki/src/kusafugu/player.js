// 主人公（一人称）: 水の中を歩く（Shift でそっと）・見回す・しゃがむ。波に押される
import * as THREE from 'three';
import { clamp, lerp, smoothstep } from './core/noise.js';
import { BOUNDS, GROYNE } from './beach.js';
import { EYE } from './body.js';

const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

export class Player {
  constructor(camera, world) {
    this.camera = camera;
    this.world = world;
    this.pos = V3();
    this.vel = V3();
    this.yaw = Math.PI; // 南（海）を向く
    this.pitch = -0.7;
    this.sens = 1;
    this.invertY = false;
    this.fovBase = 72;
    this.crouch = 0;         // 0 立つ → 1 しゃがむ
    this.crouchTarget = 0;
    this.crouchK = 5;
    this.locked = false;
    this.lookOverride = null;
    this.depth = 0;          // 足もとの水深
    this.waterY = 0;
    this.shake = 0;
    this.bobT = 0;
    this.roll = 0;
    this.speed = 0;
    this.eyeDip = 0;         // 波で顔が水につかる量
    this._w = {};
    this.blocked = '';
    this.sneak = false;      // そっと歩く（Shift）
  }

  reset(x, z, yaw = Math.PI) {
    this.pos.set(x, this.world.groundAt(x, z), z);
    this.vel.set(0, 0, 0);
    this.yaw = yaw; this.pitch = -0.7;
    this.crouch = 0; this.crouchTarget = 0;
  }

  get forward() { return V3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)); }

  update(dt, input, t) {
    const w = this.world;
    // 見回す
    const [mx, my] = input.consumeMouse(dt);
    this.mouse = [mx, my];
    if (this.lookOverride) {
      const o = this.lookOverride;
      let dy = o.yaw - this.yaw;
      dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      this.yaw += dy * (1 - Math.exp(-o.k * dt));
      this.pitch = lerp(this.pitch, o.pitch, 1 - Math.exp(-o.k * dt));
    } else if (!this.locked || this.lookFree) {
      const s = 0.0022 * this.sens;
      this.yaw -= mx * s;
      this.pitch -= my * s * (this.invertY ? -1 : 1);
      this.pitch = clamp(this.pitch, -1.48, 0.95);
    }

    // 歩く（水が深いほど重い）
    const wi = this._w;
    this.waterY = w.waterAt(this.pos.x, this.pos.z, t, wi);
    const ground = w.groundAt(this.pos.x, this.pos.z);
    this.depth = Math.max(0, this.waterY - ground);
    const f = this.forward, r = V3(-f.z, 0, f.x);
    const want = V3();
    if (!this.locked) {
      if (input.down('KeyW')) want.add(f);
      if (input.down('KeyS')) want.sub(f);
      if (input.down('KeyD')) want.add(r);
      if (input.down('KeyA')) want.sub(r);
    }
    if (want.lengthSq() > 0) want.normalize();
    const maxV = lerp(1.9, 0.45, smoothstep(0.05, 0.85, this.depth)) * (1 - this.crouch * 0.75) * (this.sneak ? 0.36 : 1);
    const acc = 1 - Math.exp(-(want.lengthSq() ? 5 : 3.5) * dt);
    this.vel.x = lerp(this.vel.x, want.x * maxV, acc);
    this.vel.z = lerp(this.vel.z, want.z * maxV, acc);
    // 波の往復で押される（波の山で岸へ、引きで沖へ）
    const flow = w.waves.flow(this.pos.x, this.pos.z, t, w.tide);
    const push = clamp(flow, -1.2, 1.6) * smoothstep(0.1, 0.6, this.depth) * (0.08 + this.crouch * 0.12);
    const nx = this.pos.x + (this.vel.x) * dt;
    const nz = this.pos.z + (this.vel.z - push * 0.35) * dt;
    this.move(nx, nz);
    this.speed = Math.hypot(this.vel.x, this.vel.z);
    this.pos.y = w.groundAt(this.pos.x, this.pos.z);

    // しゃがむ
    this.crouch = lerp(this.crouch, this.crouchTarget, 1 - Math.exp(-this.crouchK * dt));

    // カメラ
    const cam = this.camera;
    this.bobT += dt * (this.speed > 0.08 ? 3.2 + this.speed * 3 : 0);
    const bob = Math.sin(this.bobT * 2) * 0.012 * Math.min(this.speed * 2, 1);
    let eye = this.pos.y + lerp(EYE, 0.64, this.crouch) + bob;
    // しゃがんでいる時、大きな波が来ると顔が水をかぶる
    this.eyeDip = Math.max(0, this.waterY + 0.04 - eye);
    const fw = this.forward;
    const ex = this.pos.x + fw.x * lerp(0.15, 0.34, this.crouch), ez = this.pos.z + fw.z * lerp(0.15, 0.34, this.crouch);
    // 波で体がゆれる
    this.roll = lerp(this.roll, clamp(-wi.gx * 0.3, -0.012, 0.012) * smoothstep(0.2, 0.7, this.depth), 1 - Math.exp(-2 * dt));
    this.shake = Math.max(0, this.shake - dt * 2.5);
    const sh = this.shake * this.shake;
    cam.position.set(ex + (Math.random() - 0.5) * 0.01 * sh, eye + (Math.random() - 0.5) * 0.01 * sh, ez);
    cam.rotation.set(this.pitch + (Math.random() - 0.5) * 0.01 * sh, this.yaw, this.roll, 'YXZ');
    cam.updateMatrixWorld();
  }

  /** 歩ける範囲・突堤・深すぎる所 */
  move(nx, nz) {
    const w = this.world, B = BOUNDS;
    this.blocked = '';
    nx = clamp(nx, B.x0, B.x1);
    nz = clamp(nz, B.z0, B.z1);
    if (nx <= B.x0 || nx >= B.x1) this.blocked = 'side';
    if (nz >= B.z1) this.blocked = 'deep';
    // 突堤
    if (nx > GROYNE.x0 - 0.4 && nz > GROYNE.z0 && nz < GROYNE.z1) { nx = GROYNE.x0 - 0.4; this.blocked = 'groyne'; }
    // 深すぎる所へは進めない（胸より深い）
    const g = w.groundAt(nx, nz);
    const d = w.tide + 0.05 - g;
    if (d > 1.0) {
      const g0 = w.groundAt(this.pos.x, this.pos.z);
      if (g < g0) { this.blocked = 'deep'; return; }
    }
    this.pos.x = nx; this.pos.z = nz;
  }
}
