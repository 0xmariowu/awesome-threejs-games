// タモ網（ふつうの玉網）
// ・まっすぐなアルミの柄（2 段）の先に、丸い枠（直径 40cm）がまっすぐ付いている。柄の線は枠の中心を通る
// ・網は枠の面に垂直に付いた袋（深さ 38cm、細かい目の黒緑のナイロン）
// ・掬い方: 枠を立てて下の縁を川底につけ、口を横へ向けたまま、底をなでるように右から左（左から右）へ払う
//   口は網を動かす向きを向く（動かす向きを変えると、柄をひねって口の向きが変わる）
// ・構え（carry）: 水面の少し上、体の右前
// ・押す（lower → sweep）: 見ている所の底へ網を沈める。視線を動かすと網も水の中を追う（水の重さで遅れる）
// ・離す（lift）: 一気に上げて、口を上に向けて目の前に掲げる（show）
// ・ビクへ（dump）／逃がす（release）
// 網の中の判定: 口の面より奥、袋の深さの中、口の半径の中
import * as THREE from 'three';
import { patchMaterial } from './shade.js';
import { meshTexture } from './textures.js';
import { HW, bedAt, levelAt } from './ditch.js';
import { clamp, lerp } from './core/noise.js';

const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const UP = V3(0, 1, 0);
const RINGS = 8, RAD = 28;
export const POLE_L = 1.6;

export class Net {
  constructor(scene) {
    this.R = 0.2;
    this.depth = 0.38;
    this.group = new THREE.Group();
    scene.add(this.group);
    const alu = patchMaterial(new THREE.MeshStandardMaterial({ color: '#8c9094', roughness: 0.42, metalness: 0.6 }), {});
    const frameM = patchMaterial(new THREE.MeshStandardMaterial({ color: '#232b25', roughness: 0.45, metalness: 0.35 }), {});
    const grip = patchMaterial(new THREE.MeshStandardMaterial({ color: '#1b1c1e', roughness: 0.8 }), {});
    // 柄（原点 = 枠の付け根、+y = 手元の方）
    this.pole = new THREE.Group();
    const p1 = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.95, 12), alu);
    p1.position.y = 0.06 + 0.475;
    const p2 = new THREE.Mesh(new THREE.CylinderGeometry(0.0135, 0.0135, 0.62, 12), alu);
    p2.position.y = 0.06 + 0.95 + 0.29;
    const joint = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.017, 0.05, 12), grip);
    joint.position.y = 0.06 + 0.95;
    const g1 = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.3, 12), grip);
    g1.position.y = POLE_L - 0.16;
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.017, 10, 8), grip);
    cap.position.y = POLE_L;
    // 枠と柄をつなぐ金具（柄と一直線）
    const ferrule = new THREE.Mesh(new THREE.CylinderGeometry(0.0125, 0.009, 0.07, 12), frameM);
    ferrule.position.y = 0.03;
    this.pole.add(p1, p2, joint, g1, cap, ferrule);
    this.pole.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    this.group.add(this.pole);
    // 枠（リング）
    this.ring = new THREE.Mesh(new THREE.TorusGeometry(this.R, 0.0062, 8, 56), frameM);
    this.ring.castShadow = true;
    this.group.add(this.ring);
    // 網袋（細かい目のナイロン: 離れると薄い黒緑の紗に見える）。影は落とさない（目が細かく、光が抜ける）
    const tex = meshTexture({ color: '#ffffff', cells: 10, line: 0.22 });
    tex.repeat.set(14, 5);
    this.bagMat = patchMaterial(new THREE.MeshStandardMaterial({ alphaMap: tex, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide, roughness: 0.65, color: '#1f2b22' }), {
      fx: { key: 'netbag', rough: 'roughnessFactor = mix(0.7, 0.25, smoothstep(0.05, -0.02, vWPos.y - ditchLevel(vec3(clamp(vWPos.x, -0.55, 0.55), vWPos.y, vWPos.z))));' },
    });
    const nv = RINGS * (RAD + 1);
    const pos = new Float32Array(nv * 3 + 3);
    const uv = new Float32Array(nv * 2 + 2);
    const idx = [];
    for (let r = 0; r < RINGS; r++) for (let k = 0; k <= RAD; k++) {
      uv[(r * (RAD + 1) + k) * 2] = k / RAD;
      uv[(r * (RAD + 1) + k) * 2 + 1] = r / (RINGS - 1);
    }
    uv[nv * 2] = 0.5; uv[nv * 2 + 1] = 1;
    for (let r = 0; r < RINGS - 1; r++) for (let k = 0; k < RAD; k++) {
      const a = r * (RAD + 1) + k, b = a + RAD + 1;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
    // 袋の底（最後の輪をとじる）
    for (let k = 0; k < RAD; k++) { const a = (RINGS - 1) * (RAD + 1) + k; idx.push(a, nv, a + 1); }
    this.bagGeo = new THREE.BufferGeometry();
    this.bagGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.bagGeo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    this.bagGeo.setIndex(idx);
    this.bag = new THREE.Mesh(this.bagGeo, this.bagMat);
    this.bag.frustumCulled = false;
    this.group.add(this.bag);

    this.C = V3(0, 1, -1);        // 枠の中心
    this.N = V3(-1, 0, 0);        // 口の向き（枠の面の法線）
    this.A = V3(0, 0.6, 0.8).normalize();   // 柄の向き（枠の中心 → 手元）
    this.frame = { C: this.C, N: this.N, R: V3(1, 0, 0), Up: V3(0, 1, 0) };
    this.vel = V3();
    this.aim = V3();
    this.side = -1;               // 口を向ける横の向き（-1: 自分の左, 1: 右）。沈めるたびに左へもどす
    this.flipT = 0;
    this.state = 'carry';
    this.t = 0;
    this.catches = [];
    this.inWater = false;
    this.splashT = 9;
    this.splashK = 0;
    this.chain = Array.from({ length: RINGS }, () => V3());
    this.chainPrev = Array.from({ length: RINGS }, () => V3());
    this.chainInit = false;
    this.grips = null;
    this.axis = V3(0, 1, 0);
    this.onEnterWater = null;
    this.onLeaveWater = null;
    this._wasIn = false;
  }

  /** 見ている所の底（網を沈める先）。体から 0.5〜1.6m、左右は壁の内 */
  aimAt(player, camera) {
    const dir = V3(0, 0, -1).applyQuaternion(camera.quaternion);
    const b = bedAt(player.pos.x, player.s);
    let px, pz;
    if (dir.y < -0.05) {
      const t = (camera.position.y - (b + 0.05)) / -dir.y;
      px = camera.position.x + dir.x * t; pz = camera.position.z + dir.z * t;
    } else { px = camera.position.x + dir.x * 3; pz = camera.position.z + dir.z * 3; }
    let dx = px - player.pos.x, dz = pz - player.pos.z;
    const d = Math.hypot(dx, dz) || 1e-3;
    const dd = clamp(d, 0.5, 1.6);
    dx *= dd / d; dz *= dd / d;
    this.aim.set(player.pos.x + dx, 0, player.pos.z + dz);
    this.aim.y = bedAt(this.aim.x, -this.aim.z);
  }

  inBag(p) {
    const v = p.clone().sub(this.C);
    const d = -v.dot(this.N);                 // 口より奥が +
    // 口を壁へ押しつけているときは、口と壁のあいだにはさまった物も入る（壁ごとすくう）
    let dMin = 0;
    if (Math.abs(this.N.x) > 0.7) {
      const gap = HW - this.C.x * Math.sign(this.N.x);
      // 枠が斜めでも、縁が壁にふれていれば押しつけている
      const rim = gap - this.R * Math.sqrt(Math.max(0, 1 - this.N.x * this.N.x));
      if (gap < 0.07 || rim < 0.035) dMin = -(gap + 0.01) / Math.abs(this.N.x);
    }
    if (d < dMin || d > this.depth * 0.95) return false;
    v.addScaledVector(this.N, d);
    // 枠の下の縁は底をこすり、袋の下側は底に沿って引きずられる: 枠の中心より下は広く入る
    const up = UP.clone().addScaledVector(this.N, -this.N.y);
    if (up.lengthSq() > 1e-4) {
      up.normalize();
      const vy = v.dot(up);
      if (vy < 0) v.addScaledVector(up, -vy * 0.45);
    }
    return v.length() < this.R * (1 - 0.3 * (d / this.depth)) * 0.96;
  }
  catchIn(c) { if (!this.catches.includes(c)) this.catches.push(c); }
  release(c) { this.catches = this.catches.filter((x) => x !== c); }

  press() { if (this.state === 'carry') { this.state = 'lower'; this.t = 0; this.side = -1; this.flipT = 0; } }
  lift() {
    if (this.state === 'lower' || this.state === 'sweep') { this.state = 'lift'; this.t = 0; this.liftFrom = this.C.clone(); this.liftN = this.N.clone(); }
  }

  /** 手元（胸の前）の位置 */
  handPoint(player) {
    const fwd = V3(-Math.sin(player.yaw), 0, -Math.cos(player.yaw));
    const right = V3(-fwd.z, 0, fwd.x);
    const h = player.pos.clone().addScaledVector(fwd, 0.22 - player.crouch * 0.05).addScaledVector(right, 0.12).add(V3(0, 0.86 - player.crouch * 0.42, 0));
    if (this.state === 'show' || this.state === 'lift') {
      // 掲げるときは柄を右へ寝かせて持つ（枠は柄と同じ面なので、口をこちらへ向けられる）
      const k = this.state === 'show' ? 1 : clamp(this.t / 0.38, 0, 1);
      h.addScaledVector(right, 0.22 * k).addScaledVector(fwd, 0.06 * k);
      h.y += 0.1 + 0.2 * k;
    }
    return h;
  }

  /** 構え・見せる所の目標 */
  targets(player, cam) {
    const fwd = V3(-Math.sin(player.yaw), 0, -Math.cos(player.yaw));
    const right = V3(-fwd.z, 0, fwd.x);
    const camF = V3(0, 0, -1).applyQuaternion(cam.quaternion);
    const camU = V3(0, 1, 0).applyQuaternion(cam.quaternion);
    const camR = V3(1, 0, 0).applyQuaternion(cam.quaternion);
    const lv = levelAt(player.s);
    const crouch = player.crouch;
    // 構え: 体の右前、水面の少し上。枠は立てておく
    const carryC = player.pos.clone().addScaledVector(fwd, 0.9 - crouch * 0.25).addScaledVector(right, 0.3);
    carryC.y = lv + this.R + 0.06;
    carryC.x = clamp(carryC.x, -HW + 0.03, HW - 0.03);
    // 見せる: 目の前、口を上（少しこちら）へ
    const showC = cam.position.clone().addScaledVector(camF, 0.58).addScaledVector(camU, -0.14).addScaledVector(camR, -0.08);
    const showN = camF.clone().negate().multiplyScalar(0.7).addScaledVector(UP, 0.7).normalize();
    return { fwd, right, carryC, showC, showN };
  }

  update(dt, { player, cam, t, biku }) {
    this.t += dt;
    this.splashT += dt;
    const T = this.targets(player, cam);
    const prevC = this.C.clone();
    const k = (r) => 1 - Math.exp(-r * dt);
    const hand = this.handPoint(player);
    let wantN = null;
    switch (this.state) {
      case 'carry': {
        this.C.lerp(T.carryC, k(8));
        wantN = T.right.clone().multiplyScalar(this.side);
        break;
      }
      case 'lower':
      case 'sweep': {
        // 枠の下の縁が底につく高さ
        const tgt = this.aim.clone();
        tgt.y = bedAt(tgt.x, -tgt.z) + this.R * 0.97;
        // 枠は壁にめりこまない（枠の面の横幅）
        const ext = this.R * Math.sqrt(Math.max(0, 1 - this.N.x * this.N.x)) + 0.012;
        tgt.x = clamp(tgt.x, -HW + ext, HW - ext);
        if (this.state === 'lower') {
          // 水面の上を運んでから、まっすぐ沈める。そっと（Shift）なら静かに
          const hd = Math.hypot(this.C.x - tgt.x, this.C.z - tgt.z);
          const above = levelAt(-this.C.z) + this.R + 0.04;
          if (hd > 0.07) {
            this.C.x += (tgt.x - this.C.x) * k(10); this.C.z += (tgt.z - this.C.z) * k(10);
            this.C.y += (Math.max(above, tgt.y) - this.C.y) * k(10);
          } else {
            this.C.x = tgt.x; this.C.z = tgt.z;
            const dy = (tgt.y - this.C.y) * k(10);
            this.C.y += player.sneak ? Math.max(dy, -0.22 * dt) : dy;
          }
          if ((Math.abs(this.C.y - tgt.y) < 0.03 && hd < 0.07) || this.t > (player.sneak ? 3 : 0.7)) { this.state = 'sweep'; this.t = 0; }
        } else {
          // 水の中は重い: 速さに上限
          const d = tgt.clone().sub(this.C);
          const l = d.length();
          const step = Math.min(l, 1.25 * dt, l * k(7));
          if (l > 1e-5) this.C.addScaledVector(d, step / l);
        }
        this.C.x = clamp(this.C.x, -HW + ext, HW - ext);
        const minY = bedAt(this.C.x, -this.C.z) + this.R * 0.9;
        if (this.C.y < minY) this.C.y = minY;
        // 口の向き: 払う向き（横の動き）へ。止まっている間は前の向きのまま
        const toH = hand.clone().sub(this.C).setY(0);
        if (toH.lengthSq() < 1e-6) toH.copy(T.fwd).negate();
        toH.normalize();
        const lat = V3(toH.z, 0, -toH.x);           // 手元から見て右
        // 口の向きは「右から左へ払う」（口が左、袋が右へのびる）を基本にして、
        // 反対へはっきり払い続けたときだけ向きを変える（小さなぶれで袋がひるがえらないように）
        const vl = this.vel.dot(lat);
        if (Math.sign(vl) !== this.side && Math.abs(vl) > 0.3) this.flipT += dt;
        else this.flipT = Math.max(0, this.flipT - dt * 2);
        if (this.flipT > 0.16) { this.side = -this.side; this.flipT = 0; }
        wantN = lat.multiplyScalar(this.side);
        break;
      }
      case 'lift': {
        const kk = clamp(this.t / 0.38, 0, 1);
        const e = 1 - (1 - kk) * (1 - kk) * (1 - kk);
        this.C.lerpVectors(this.liftFrom, T.showC, e);
        this.C.y += Math.sin(kk * Math.PI) * 0.1;
        wantN = this.liftN.clone().lerp(T.showN, e).normalize();
        if (kk >= 1) { this.state = 'show'; this.t = 0; }
        break;
      }
      case 'show': {
        const sw = Math.sin(t * 2.3) * 0.006;
        this.C.lerp(T.showC.clone().add(V3(0, sw, 0)), k(10));
        wantN = T.showN;
        break;
      }
      case 'dump': {
        // ビクの口の上へ運んで、口を下へ向けて落とす
        const kk = clamp(this.t / 0.55, 0, 1);
        const m = biku.mouth().add(V3(0, 0.14, 0));
        this.C.lerp(m.clone().addScaledVector(T.fwd, 0.12), k(12));
        const down = V3(0, -1, 0).addScaledVector(T.fwd, -0.3).normalize();
        wantN = kk > 0.35 ? down : T.showN;
        if (kk >= 1) { this.state = 'carry'; this.t = 0; this.dumpDone = true; }
        break;
      }
      case 'release': {
        // 前の水面へそっと下ろして、口を下へ
        const kk = clamp(this.t / 0.7, 0, 1);
        const p = T.carryC.clone();
        p.y = levelAt(player.s) + 0.02 - kk * 0.1;
        this.C.lerp(p, k(8));
        wantN = V3(0, -0.5, 0).addScaledVector(T.fwd, 0.85).normalize();
        if (kk >= 1) { this.state = 'carry'; this.t = 0; this.releaseDone = true; }
        break;
      }
    }
    // 柄の向き（枠の中心 → 手元）と、口の向き（柄に垂直。柄のまわりにひねって向きを変える）
    this.A.copy(hand).sub(this.C).normalize();
    if (wantN) this.turnMouth(wantN, k(this.state === 'sweep' ? 9 : 12));
    this.vel.copy(this.C).sub(prevC).divideScalar(Math.max(dt, 1e-4));
    // 水に入った・出た
    const lv = levelAt(-this.C.z);
    const low = this.C.y - this.R * 0.6;
    this.inWater = (this.state === 'lower' || this.state === 'sweep') && low < lv && Math.abs(this.C.x) < HW;
    const wet = low < lv && Math.abs(this.C.x) < HW;
    if (wet && !this._wasIn) {
      this.splashT = 0;
      this.splashK = clamp(Math.abs(this.vel.y) / 1.6 + Math.hypot(this.vel.x, this.vel.z) * 0.25, 0.08, 1) * (player.sneak ? 0.5 : 1);
      this.onEnterWater?.(this.C.clone(), this.splashK);
    }
    if (!wet && this._wasIn) this.onLeaveWater?.(this.C.clone(), clamp(this.vel.length() / 2, 0.2, 1));
    this._wasIn = wet;
    this.pose(hand);
    this.simBag(dt, lv);
  }

  turnMouth(wantN, kk) {
    const A = this.A;
    const n = wantN.clone().addScaledVector(A, -wantN.dot(A));
    if (n.lengthSq() < 1e-4) return;
    n.normalize();
    const cur = this.N.clone().addScaledVector(A, -this.N.dot(A));
    if (cur.lengthSq() < 1e-4) cur.copy(n); else cur.normalize();
    const ang = Math.acos(clamp(cur.dot(n), -1, 1));
    if (ang > 1e-4) {
      const axis = V3().crossVectors(cur, n);
      if (axis.lengthSq() < 1e-8) axis.copy(A);
      axis.normalize();
      cur.applyAxisAngle(axis, Math.min(ang, ang * kk + 0.015));
    }
    this.N.copy(cur.addScaledVector(A, -cur.dot(A)).normalize());
  }

  /** 枠と柄の姿勢 */
  pose(hand) {
    const F = this.frame, N = this.N, A = this.A;
    // 枠の面の中の向き: A（柄）と B（柄に垂直）
    const B = V3().crossVectors(N, A).normalize();
    F.Up.copy(A); F.R.copy(B);
    this.ring.position.copy(this.C);
    this.ring.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(A, B, N));
    // 付け根: 枠の縁の、柄の側
    const att = this.C.clone().addScaledVector(A, this.R);
    this.att = att;
    this.axis.copy(A);
    this.pole.position.copy(att);
    this.pole.quaternion.setFromUnitVectors(UP, A);
    // 握る所: 右手は柄の後ろ（手元より先）、左手は手元の少し前
    const reach = hand.distanceTo(att);
    const g0 = Math.min(reach, POLE_L - 0.45);
    this.grips = [att.clone().addScaledVector(A, Math.min(POLE_L - 0.05, g0 + 0.34)), att.clone().addScaledVector(A, Math.max(0.3, g0 - 0.08))];
  }

  /** 網袋: 輪のくさり。水の中は流れと動きで後ろへなびき、空気の中は垂れる */
  simBag(dt, lv) {
    const ch = this.chain, pv = this.chainPrev;
    const seg = this.depth / (RINGS - 1);
    if (!this.chainInit) {
      for (let r = 0; r < RINGS; r++) { ch[r].copy(this.C).addScaledVector(this.N, -seg * r); pv[r].copy(ch[r]); }
      this.chainInit = true;
    }
    ch[0].copy(this.C); pv[0].copy(this.C);
    const load = this.catches.length ? 1 : 0;
    const h = Math.min(dt, 1 / 30);
    for (let r = 1; r < RINGS; r++) {
      const p = ch[r];
      const inW = p.y < lv && Math.abs(p.x) < HW;
      const v = p.clone().sub(pv[r]);
      v.multiplyScalar(inW ? 0.72 : 0.94);
      pv[r].copy(p);
      // 形を保つ力（口の奥へまっすぐ）。水の中は、口の反対側へ水平にのばす
      const back = this.N.clone().negate();
      if (inW) { back.y *= 0.3; back.normalize(); }
      const rest = this.C.clone().addScaledVector(back, seg * r * 0.95);
      const acc = rest.sub(p).multiplyScalar(inW ? 36 : 10);
      acc.y -= inW ? 0.25 : 9.8 * (0.35 + load * 0.4) * (r / RINGS);
      if (inW) acc.z += 0.3 * (r / RINGS);   // 流れ
      p.add(v).addScaledVector(acc, h * h);
      // 水の中で袋がむちのようにしならないよう、1 コマに動ける量をおさえる
      if (inW) { const mv = p.clone().sub(pv[r]); const ml = mv.length(), mx = 1.6 * h; if (ml > mx) p.copy(pv[r]).addScaledVector(mv, mx / ml); }
    }
    for (let it = 0; it < 3; it++) for (let r = 1; r < RINGS; r++) {
      const a = ch[r - 1], b = ch[r];
      const d = b.clone().sub(a);
      const l = d.length() || 1e-4;
      b.copy(a).addScaledVector(d, seg / l);
      if (Math.abs(b.x) < HW) {
        b.y = Math.max(b.y, bedAt(clamp(b.x, -HW, HW), -b.z) + 0.02);
        b.x = clamp(b.x, -HW + 0.03, HW - 0.03);
      }
    }
    // メッシュ
    const pos = this.bagGeo.attributes.position.array;
    const F = this.frame;
    const prevT = this.N.clone().negate();
    let last = null;
    this.rings = this.rings || [];
    for (let r = 0; r < RINGS; r++) {
      const c = ch[r];
      const T = r === 0 ? this.N.clone().negate() : ch[r].clone().sub(ch[r - 1]).normalize();
      if (r > 0) prevT.lerp(T, 0.6).normalize();
      const q = new THREE.Quaternion().setFromUnitVectors(this.N.clone().negate(), prevT);
      const Rv = F.R.clone().applyQuaternion(q), Uv = F.Up.clone().applyQuaternion(q);
      const u = r / (RINGS - 1);
      const rad = this.R * (r === 0 ? 1 : (1 - 0.7 * Math.pow(u, 1.3)) * (1 + (load ? 0.06 : 0) * Math.sin(u * Math.PI)));
      for (let kk = 0; kk <= RAD; kk++) {
        const a = (kk / RAD) * Math.PI * 2;
        const ca = Math.cos(a), sa = Math.sin(a);
        const wob = r === 0 ? 0 : 0.008 * Math.sin(a * 5 + r * 1.7);
        const i = (r * (RAD + 1) + kk) * 3;
        pos[i] = c.x + (Uv.x * ca + Rv.x * sa) * (rad + wob);
        pos[i + 1] = c.y + (Uv.y * ca + Rv.y * sa) * (rad + wob);
        pos[i + 2] = c.z + (Uv.z * ca + Rv.z * sa) * (rad + wob);
      }
      last = { c, T: prevT.clone() };
      this.rings[r] = { c: c.clone(), R: Rv, U: Uv, rad };
    }
    const ti = RINGS * (RAD + 1) * 3;
    pos[ti] = last.c.x + last.T.x * 0.04; pos[ti + 1] = last.c.y + last.T.y * 0.04; pos[ti + 2] = last.c.z + last.T.z * 0.04;
    this.bagGeo.attributes.position.needsUpdate = true;
    this.bagGeo.computeVertexNormals();
  }

  /**
   * 袋の中の点: 口から d の深さ（袋のくさりに沿って）で、その輪の面の中を (a, b) だけずらした所。
   * ずれは輪の半径の k 倍までにおさめる（中の獲物が袋を突き抜けないように）
   */
  bagPoint(d, a, b, k = 0.72) {
    const rs = this.rings;
    if (!rs || !rs.length) return this.C.clone().addScaledVector(this.N, -d);
    const seg = this.depth / (RINGS - 1);
    const f = clamp(d / seg, 0, RINGS - 1.001);
    const i = Math.floor(f), t = f - i;
    const r0 = rs[i], r1 = rs[i + 1];
    const c = r0.c.clone().lerp(r1.c, t);
    const R = r0.R.clone().lerp(r1.R, t).normalize(), U = r0.U.clone().lerp(r1.U, t).normalize();
    const rad = lerp(r0.rad, r1.rad, t) * k;
    const l = Math.hypot(a, b);
    const s = l > rad ? rad / l : 1;
    return c.addScaledVector(R, a * s).addScaledVector(U, b * s);
  }

  /**
   * 結果の場面の置き物: 地面に寝かせたタモ網（原点 = 枠の中心、地面 y = 0）。
   * 枠は平らに寝て、柄は +z へのび、ぬれた袋は +x 側へ平たく広がる
   */
  makeProp() {
    const g = new THREE.Group();
    const ring = new THREE.Mesh(this.ring.geometry, this.ring.material);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.0065;
    ring.castShadow = true;
    g.add(ring);
    const pole = this.pole.clone();
    pole.position.set(0, 0.012, this.R);
    pole.quaternion.setFromUnitVectors(UP, V3(0, 0.012, 1).normalize());
    g.add(pole);
    // 袋: 枠から横へ、しわを寄せながら平たく
    const geo = new THREE.BufferGeometry();
    for (const k of ['position', 'uv']) geo.setAttribute(k, this.bagGeo.attributes[k].clone());
    geo.setIndex(this.bagGeo.index.clone());
    const pos = geo.attributes.position.array;
    const seg = this.depth / (RINGS - 1);
    let tip = V3();
    for (let r = 0; r < RINGS; r++) {
      const u = r / (RINGS - 1);
      const rad = this.R * (r === 0 ? 1 : 1 - 0.62 * Math.pow(u, 1.2));
      const cx = r === 0 ? 0 : this.R * 0.25 + r * seg * 0.82;
      for (let kk = 0; kk <= RAD; kk++) {
        const a = (kk / RAD) * Math.PI * 2;
        const i = (r * (RAD + 1) + kk) * 3;
        const wr = r === 0 ? 0 : 0.012 * Math.sin(a * 4 + r * 1.9);
        pos[i] = cx + Math.cos(a) * rad * (r === 0 ? 1 : 0.3) + wr;
        pos[i + 1] = r === 0 ? 0.004 : 0.004 + 0.009 * (0.5 + 0.5 * Math.sin(a * 3 + r * 2.3)) * (1 - u * 0.5);
        pos[i + 2] = Math.sin(a) * rad;
      }
      tip.set(cx + 0.03, 0.004, 0);
    }
    const ti = RINGS * (RAD + 1) * 3;
    pos[ti] = tip.x; pos[ti + 1] = tip.y; pos[ti + 2] = tip.z;
    geo.computeVertexNormals();
    const bag = new THREE.Mesh(geo, this.bagMat);
    bag.renderOrder = 4;
    g.add(bag);
    return g;
  }

  /** 柄が水面を切る所（波紋用） */
  surfaceCross() {
    if (!this.att) return null;
    const lv = levelAt(-this.att.z);
    const a = this.att, ax = this.axis;
    if (Math.abs(ax.y) < 1e-3) return null;
    const k = (lv - a.y) / ax.y;
    if (k < 0 || k > POLE_L) return null;
    return a.clone().addScaledVector(ax, k);
  }
}
