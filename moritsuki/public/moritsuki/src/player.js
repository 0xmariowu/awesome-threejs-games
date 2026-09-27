// ダイバー（プレイヤー）: 泳ぎ・浮力・息・気配・カメラ
import * as THREE from 'three';
import { clamp, lerp, smoothstep } from './core/noise.js';
import { audio } from './core/audio.js';

const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

export const BREATH_SEC = 58;
// 緊急浮上：ふだんの浮上（Space、最大 2.1m/s）の3倍の速さでまっすぐ上へ
export const EMERGENCY_UP = 2.1 * 3;

export class Player {
  constructor(camera, world) {
    this.camera = camera;
    this.world = world;
    this.pos = V3();
    this.vel = V3();
    this.yaw = 0;
    this.pitch = 0;
    this.fwd = V3(0, 0, -1);
    this.state = 'surface';
    this.breath = 1;
    this.noise = 0;
    this.stillTime = 0;
    this.kickPhase = 0;
    this.bob = 0;
    this.surfaceTime = 0;
    this.locked = false; // 演出中は操作不可
    this.submerged = false;
    this.nearBottom = false;
    this.shotNoise = 0;
    this.sens = 1;
    this.invertY = false;
    this.fovBase = 72;
    this.zoom = 0;
    this.roll = 0;
    this.events = { surfaced: null, dived: null };
    this.breathTimer = 0;
    this.lastKick = 0;
    this.shake = 0;
    this.lookOverride = null;
    this.emergency = false;
    this.emBubble = 0;
  }

  reset(pos, yaw) {
    this.pos.copy(pos);
    this.vel.set(0, 0, 0);
    this.yaw = yaw;
    this.pitch = -0.05;
    this.state = 'surface';
    this.breath = 1;
    this.noise = 0;
    this.surfaceTime = 10;
  }

  get depth() { return Math.max(0, -this.pos.y); }

  update(dt, input, t, opts = {}) {
    const w = this.world;
    const cam = this.camera;
    // 視点
    const [mx, my] = input.consumeMouse(dt);
    if (!this.locked) {
      const k = 0.0021 * this.sens * (1 - this.zoom * 0.45);
      this.yaw -= mx * k;
      this.pitch -= my * k * (this.invertY ? -1 : 1);
      this.pitch = clamp(this.pitch, -1.52, 1.45);
    }
    if (this.lookOverride) {
      const lo = this.lookOverride;
      let dy = lo.yaw - this.yaw;
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      this.yaw += dy * (1 - Math.exp(-lo.k * dt));
      this.pitch = lerp(this.pitch, lo.pitch, 1 - Math.exp(-lo.k * dt));
    }
    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    this.fwd.set(-Math.sin(this.yaw) * cp, sp, -Math.cos(this.yaw) * cp);
    const right = V3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const flatF = V3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));

    let f = 0, s = 0, u = 0;
    const sprint = !this.locked && (input.down('ShiftLeft') || input.down('ShiftRight'));
    if (!this.locked) {
      if (input.down('KeyW')) f += 1;
      if (input.down('KeyS')) f -= 1;
      if (input.down('KeyD')) s += 1;
      if (input.down('KeyA')) s -= 1;
      if (input.down('Space')) u += 1;
      if (input.down('KeyC') || input.down('ControlLeft')) u -= 1;
    }
    this.emergency = !this.locked && this.state === 'dive' && input.down('KeyQ');
    const emergency = this.emergency;
    const moving = f !== 0 || s !== 0 || u !== 0 || emergency;
    const waveY = w.waterAt(this.pos.x, this.pos.z, t);

    if (this.state === 'surface') {
      this.surfaceTime += dt;
      // 水面を泳ぐ
      const wish = V3().addScaledVector(flatF, f).addScaledVector(right, s);
      if (wish.lengthSq() > 0) wish.normalize().multiplyScalar(sprint ? 2.1 : 1.4);
      this.vel.x = lerp(this.vel.x, wish.x, 1 - Math.exp(-2 * dt));
      this.vel.z = lerp(this.vel.z, wish.z, 1 - Math.exp(-2 * dt));
      this.vel.y = 0;
      this.pos.x += this.vel.x * dt;
      this.pos.z += this.vel.z * dt;
      this.pos.y = lerp(this.pos.y, waveY + 0.16, 1 - Math.exp(-10 * dt));
      // 息の回復
      if (this.surfaceTime > 0.35) this.breath = Math.min(1, this.breath + dt * 0.3);
      this.breathTimer -= dt;
      if (this.breath < 0.98 && this.breathTimer <= 0) { audio.breathe(true); this.breathTimer = 1.4; }
      // 潜る: Cキー、または下を向いて前進
      if (!this.locked && (u < 0 || (f > 0 && this.pitch < -0.45))) {
        this.state = 'dive';
        this.vel.y = -1.6;
        this.vel.addScaledVector(this.fwd, 0.6);
        this.pos.y = waveY - 0.35;
        audio.splash(0.7);
        w.particles.bubbles(this.pos.x, this.pos.y - 0.3, this.pos.z, 20, 0.6, 1.4);
        this.events.dived?.();
      }
    } else {
      // 潜水
      const maxV = sprint ? 3.5 : 2.1;
      const wish = V3().addScaledVector(this.fwd, f).addScaledVector(right, s).addScaledVector(V3(0, 1, 0), u);
      if (wish.lengthSq() > 0) wish.normalize();
      // フィンキックのリズム
      if (moving) {
        this.kickPhase += dt * (emergency ? 12 : sprint ? 8.5 : 5.5);
        if (this.kickPhase - this.lastKick > Math.PI * 2) { this.lastKick = this.kickPhase; audio.kick(emergency ? 1.5 : sprint ? 1.2 : 0.7); }
      }
      let k;
      if (emergency) {
        // 横へはほとんど動かず、まっすぐ水面へ
        wish.set(wish.x * 0.5, 0, wish.z * 0.5).add(V3(0, EMERGENCY_UP, 0));
        k = 4.5;
        this.emBubble -= dt;
        if (this.emBubble <= 0) {
          this.emBubble = 0.09;
          w.particles.bubbles(this.pos.x + this.fwd.x * 0.3, this.pos.y - 0.2, this.pos.z + this.fwd.z * 0.3, 4, 0.25, 1.6);
        }
      } else {
        const surge = moving ? 0.82 + 0.18 * Math.sin(this.kickPhase) : 0;
        wish.multiplyScalar(maxV * surge);
        k = moving ? 2.0 : 0.85;
      }
      this.vel.lerp(wish.lengthSq() > 0 ? wish : this.vel.clone().multiplyScalar(0.3), 1 - Math.exp(-k * dt));
      // 浮力: 浅いと浮き、深いと沈む
      if (u === 0 && !emergency) {
        const buoy = 0.32 - smoothstep(0, 13, this.depth) * 0.5;
        this.vel.y += buoy * dt;
      }
      this.pos.addScaledVector(this.vel, dt);
      // 地形
      const g = w.groundAt(this.pos.x, this.pos.z);
      this.nearBottom = this.pos.y - g < 1.6;
      if (this.pos.y < g + 0.45) { this.pos.y = g + 0.45; if (this.vel.y < 0) this.vel.y *= -0.1; }
      w.pushOutOfRocks(this.pos, 0.38, this.vel);
      // 浮上
      if (this.pos.y > waveY - 0.22 && (this.vel.y > -0.05 || u > 0 || emergency)) {
        this.state = 'surface';
        this.surfaceTime = 0;
        this.vel.y = 0;
        audio.splash(0.8);
        w.particles.spray(this.pos.x, waveY + 0.05, this.pos.z, 24);
        this.events.surfaced?.();
      }
      // 息
      const rate = (1 + this.depth / 22 + (sprint && moving ? 0.9 : 0) + (opts.strain || 0)) / BREATH_SEC;
      this.breath -= rate * dt;
      // 吐く泡
      this.breathTimer -= dt;
      if (this.breathTimer <= 0) {
        this.breathTimer = this.breath < 0.3 ? 1.3 : 3.5 + Math.random() * 2;
        if (this.breath < 0.55) {
          const m = V3(0, -0.12, 0).applyEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ'));
          w.particles.bubbles(this.pos.x + m.x + this.fwd.x * 0.2, this.pos.y + m.y, this.pos.z + m.z + this.fwd.z * 0.2, 5, 0.05, 1.2);
          audio.bubbles(3, 0.03);
        }
      }
    }

    // 陸地と外洋の境界
    const gg = w.groundAt(this.pos.x, this.pos.z);
    if (gg > -0.25) {
      const back = V3(this.pos.x, 0, this.pos.z).normalize();
      this.pos.x += back.x * dt * 3;
      this.pos.z += back.z * dt * 3;
      this.vel.x *= 0.5; this.vel.z *= 0.5;
      this.onShore = true;
    } else this.onShore = false;
    const r = Math.hypot(this.pos.x, this.pos.z);
    this.outOfBounds = r > w.playRadius - 12;
    if (r > w.playRadius) {
      this.pos.x *= w.playRadius / r;
      this.pos.z *= w.playRadius / r;
    }

    // 気配 (0..1)
    const speed = this.vel.length();
    this.shotNoise = Math.max(0, this.shotNoise - dt * 0.8);
    let target = Math.pow(clamp(speed / 3.3, 0, 1), 0.9) + (sprint && moving ? 0.25 : 0) + this.shotNoise;
    if (this.state === 'surface') target *= 0.6;
    target = clamp(target, 0, 1);
    this.noise = target > this.noise ? lerp(this.noise, target, 1 - Math.exp(-8 * dt)) : lerp(this.noise, target, 1 - Math.exp(-1.6 * dt));
    this.stillTime = speed < 0.35 && this.state === 'dive' ? this.stillTime + dt : 0;
    this.submerged = this.state === 'dive';

    // カメラ
    this.zoom = lerp(this.zoom, opts.zoom ? 1 : 0, 1 - Math.exp(-8 * dt));
    cam.fov = this.fovBase - this.zoom * 18 - (opts.charge || 0) * 4;
    cam.updateProjectionMatrix();
    this.bob += dt;
    let rollT = 0, yOff = 0;
    if (this.state === 'surface') {
      const wx = w.waterAt(this.pos.x + 0.5, this.pos.z, t) - w.waterAt(this.pos.x - 0.5, this.pos.z, t);
      rollT = -wx * 0.35;
    } else {
      rollT = Math.sin(t * 0.6) * 0.012 - s * 0.03;
      yOff = Math.sin(this.kickPhase) * 0.012;
    }
    this.roll = lerp(this.roll, rollT, 1 - Math.exp(-3 * dt));
    this.shake = Math.max(0, this.shake - dt * 2.5);
    const sh = this.shake * this.shake;
    cam.position.copy(this.pos);
    cam.position.y += yOff;
    cam.rotation.set(this.pitch + (Math.random() - 0.5) * sh * 0.06, this.yaw + (Math.random() - 0.5) * sh * 0.06, this.roll, 'YXZ');
  }
}
