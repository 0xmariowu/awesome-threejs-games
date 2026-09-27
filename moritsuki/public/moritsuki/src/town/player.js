// 麦わら帽子の男の子（kid/）を動かす操作と、三人称カメラ
import * as THREE from 'three';
export { Kid } from './kid/index.js';

export class PlayerController {
  // kid は Kid.load() で作ったもの
  constructor(world, input, kid) {
    this.world = world;
    this.input = input;
    this.kid = kid;
    this.pos = new THREE.Vector3();
    this.vy = 0;
    this.onGround = true;
    this.facing = 0;
    this.speed = 0;
    this.camYaw = 0;
    this.camPitch = 0.28;
    this.camDist = 6.5;
    this.sens = 1;        // マウス感度（設定画面）
    this.camPos = new THREE.Vector3();
    this.frozen = false; // ファストトラベル中はカメラ操作を受けない
    this.fence = null;    // 進入禁止の輪（fence.js）
    this.fenceHit = null; this.fenceHitT = 9; // 最後に輪へ押し当てた点と、それからの時間
    addEventListener('wheel', (e) => { if (this.frozen) return; this.camDist = THREE.MathUtils.clamp(this.camDist * (1 + Math.sign(e.deltaY) * 0.12), 2.5, 22); }, { passive: true });
  }

  place(x, z, facing = 0) {
    this.pos.set(x, this.world.groundAt(x, z, 99), z);
    this.facing = facing;
    this.kid.root.position.copy(this.pos);
    this.kid.root.rotation.y = facing;
    this.kid.reset();
    this.camYaw = facing + Math.PI;
    this.camPos.set(x - Math.sin(facing) * this.camDist, this.pos.y + 3, z - Math.cos(facing) * this.camDist);
  }

  update(dt, camera) {
    const inp = this.input, W = this.world;
    const [mx, my] = inp.consumeMouse(dt);
    this.camYaw -= mx * 0.0032 * this.sens;
    this.camPitch = THREE.MathUtils.clamp(this.camPitch + my * 0.0026 * this.sens, -0.35, 1.25);
    if (inp.down('KeyQ')) this.camYaw += dt * 2.2;
    if (inp.down('KeyE') && !this.noKeyE) this.camYaw -= dt * 2.2; // 話しかけられる相手がいる間、E は「話す」
    // 入力（カメラ基準）
    let ix = 0, iz = 0;
    if (inp.down('KeyW') || inp.down('ArrowUp')) iz += 1;
    if (inp.down('KeyS') || inp.down('ArrowDown')) iz -= 1;
    if (inp.down('KeyA') || inp.down('ArrowLeft')) ix -= 1;
    if (inp.down('KeyD') || inp.down('ArrowRight')) ix += 1;
    const run = inp.down('ShiftLeft') || inp.down('ShiftRight');
    const len = Math.hypot(ix, iz);
    const fwdX = -Math.sin(this.camYaw), fwdZ = -Math.cos(this.camYaw);
    let dx = 0, dz = 0;
    if (len > 0) {
      ix /= len; iz /= len;
      dx = fwdX * iz - fwdZ * ix;
      dz = fwdZ * iz + fwdX * ix;
    }
    const target = len > 0 ? (run ? 7.5 : 3.6) : 0;
    this.speed += (target - this.speed) * Math.min(1, dt * (target > this.speed ? 6 : 9));
    const face0 = this.facing, x0 = this.pos.x, z0 = this.pos.z;
    if (len > 0) {
      const want = Math.atan2(dx, dz);
      let d = want - this.facing;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      this.facing += d * Math.min(1, dt * 12);
    }
    const mvx = Math.sin(this.facing) * this.speed * dt, mvz = Math.cos(this.facing) * this.speed * dt;
    this.fenceHitT += dt;
    this.move(mvx, mvz);
    // ジャンプと重力
    if (inp.pressed('Space') && this.onGround) { this.vy = 4.6; this.onGround = false; }
    this.vy -= 13 * dt;
    this.pos.y += this.vy * dt;
    const g = W.groundAt(this.pos.x, this.pos.z, this.pos.y + 0.5);
    if (this.pos.y <= g) { this.pos.y = g; this.vy = 0; this.onGround = true; }
    else if (this.pos.y - g > 0.15) this.onGround = false;
    // 見た目
    const k = this.kid;
    k.root.position.copy(this.pos);
    k.root.rotation.y = this.facing;
    // 見た目の速さは実際に進んだ距離から（壁に向かって走っても足踏みしない）
    const moved = Math.hypot(this.pos.x - x0, this.pos.z - z0) / dt;
    const turn = Math.atan2(Math.sin(this.facing - face0), Math.cos(this.facing - face0)) / dt;
    k.animate(dt, Math.min(this.speed, moved * 1.05), !this.onGround, { vy: this.vy, turn, ground: (x, z) => W.groundAt(x, z, this.pos.y + 0.5) });
    this.updateCamera(dt, camera);
  }

  // 操作していない時（タイトル画面など）も立って息をしている
  idle(dt) {
    const k = this.kid;
    k.root.position.copy(this.pos);
    k.root.rotation.y = this.facing;
    k.animate(dt, 0, false, { ground: (x, z) => this.world.groundAt(x, z, this.pos.y + 0.5) });
  }

  move(mx, mz) {
    const W = this.world, R = 0.32;
    const tryAt = (x, z) => {
      if (W.blocked(x, z)) return false;
      const g = W.groundAt(x, z, this.pos.y + 0.6);
      if (g - this.pos.y > 0.6) return false;
      return true;
    };
    let nx = this.pos.x + mx, nz = this.pos.z + mz;
    if (!tryAt(nx, nz)) {
      if (tryAt(this.pos.x + mx, this.pos.z)) nz = this.pos.z;
      else if (tryAt(this.pos.x, this.pos.z + mz)) nx = this.pos.x;
      else { nx = this.pos.x; nz = this.pos.z; }
    }
    // 壁・柵を押し返す
    for (let it = 0; it < 3; it++) {
      for (const s of W.segs.near(nx, nz)) {
        if (s.top < this.pos.y + 0.45) continue;
        const ex = s.bx - s.ax, ez = s.bz - s.az, l2 = ex * ex + ez * ez;
        let t = l2 ? ((nx - s.ax) * ex + (nz - s.az) * ez) / l2 : 0;
        t = Math.max(0, Math.min(1, t));
        const qx = s.ax + ex * t, qz = s.az + ez * t;
        let ddx = nx - qx, ddz = nz - qz;
        const d = Math.hypot(ddx, ddz), min = R + s.r;
        if (d < min) {
          if (d < 1e-4) { ddx = -ez; ddz = ex; }
          const l = Math.hypot(ddx, ddz) || 1;
          nx = qx + (ddx / l) * min; nz = qz + (ddz / l) * min;
        }
      }
    }
    // 進入禁止の輪の外へは出られない（輪に沿って滑る）
    const cl = this.fence?.clamp(nx, nz);
    if (cl) {
      // 輪に沿って歩いているだけなら「押し当て」にしない（外へ向かう分が大きいときだけ）
      if (Math.hypot(nx - cl[0], nz - cl[1]) > Math.hypot(mx, mz) * 0.35) {
        this.fenceHit = (this.fenceHit || new THREE.Vector3()).set(cl[0], this.pos.y + 1.0, cl[1]);
        this.fenceHitT = 0;
      }
      [nx, nz] = cl;
    }
    if (!W.blocked(nx, nz)) { this.pos.x = nx; this.pos.z = nz; }
  }

  // 三人称カメラの注視点（頭のあたり）
  camTarget(out = new THREE.Vector3()) { return out.set(this.pos.x, this.pos.y + 1.35, this.pos.z); }

  // 注視点から (yaw, pitch, dist) 離れたカメラ位置。建物にめり込まないよう手前に寄せ、地面より下にしない
  rigPose(tgt, yaw, pitch, dist, out = new THREE.Vector3()) {
    const W = this.world;
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    const dx = Math.sin(yaw) * cp, dz = Math.cos(yaw) * cp;
    const reach = Math.min(dist, 60);
    for (let s = 0.8; s < reach; s += 0.4) {
      if (W.solidAt(tgt.x + dx * s, tgt.y + sp * s, tgt.z + dz * s)) { dist = Math.max(1.2, s - 0.5); break; }
    }
    out.set(tgt.x + dx * dist, tgt.y + sp * dist, tgt.z + dz * dist);
    const gmin = W.groundAt(out.x, out.z, 99) + 0.45;
    if (out.y < gmin) out.y = gmin;
    return out;
  }

  updateCamera(dt, camera) {
    const tgt = this.camTarget();
    const want = this.rigPose(tgt, this.camYaw, this.camPitch, this.camDist);
    this.camPos.lerp(want, 1 - Math.exp(-dt * 14));
    camera.position.copy(this.camPos);
    camera.lookAt(tgt);
  }
}
