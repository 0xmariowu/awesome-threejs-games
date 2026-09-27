// 主人公: 形（model.js）に、歩き・走り・待機・ジャンプの動きをつける
// 足は地面に置いた位置から動かさない（2 関節の IK）。帽子はバネで揺れる。
import * as THREE from 'three';
import { buildKid, J } from './model.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const mix = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const damp = (a, b, rate, dt) => a + (b - a) * (1 - Math.exp(-rate * dt));
const frac = (v) => v - Math.floor(v);

const V = () => new THREE.Vector3();
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _e = new THREE.Euler();
const _m = new THREE.Matrix4(), _mi = new THREE.Matrix4();
const _a = V(), _t = V(), _u = V(), _v = V(), _k = V(), _d = V(), _w = V();

// 足の寸法（足首から見た位置）
const ANKLE_H = J.L.an[1];
const BALL_Z = J.L.toe[2] - J.L.an[2];
const HEEL_Z = -0.056;

export class Kid {
  // 形はワーカーで作るので非同期
  static async load() { return new Kid(await buildKid()); }

  constructor(k) {
    this.root = k.root;
    this.bones = k.bones;
    this.parts = k.parts;
    this.face = k.face;
    this.hatPivot = k.hatPivot;
    this.stats = k.stats;
    this.head = k.bones.head;
    this.body = k.bones.hips;
    this.rest = {};
    for (const [n, b] of Object.entries(this.bones)) this.rest[n] = b.position.clone();
    this.legLen = {
      L1: this.bones.shinL.position.length(),
      L2: this.bones.footL.position.length(),
      r1: this.bones.shinL.position.clone().normalize(),
      r2: this.bones.footL.position.clone().normalize(),
    };

    this.phase = 0; // ラジアン。π ごとに片足が着地する
    this.p = 0;
    this.time = 0;
    this.s = { mov: 0, run: 0, speed: 0, air: 0, vy: 0, rise: 0, turn: 0, lean: 0, land: 0, landT: 9, idleT: 0, accel: 0, prevSpeed: 0 };
    this.look = { yaw: 0, pitch: 0, ty: 0, tp: 0, next: 3 };
    this.blink = { t: 2.5, v: 0, phase: -1, twice: false };
    this.expr = { happy: 0, mouth: 0 };
    this.hat = { rx: 0, rz: 0, vx: 0, vz: 0, y: 0, vy: 0, prev: null, vel: V(), acc: V(), first: true };
    this.feet = { L: { toe: 0 }, R: { toe: 0 } };
    this.weight = { v: 0.6, target: 1, next: 6 }; // 待機中にどちらの足に体重をのせるか（+1 = 左）
  }

  // ワープした時など: 帽子のバネと速さの記憶を捨てる
  reset() {
    const H = this.hat;
    H.first = true; H.rx = H.rz = H.vx = H.vz = H.y = H.vy = 0;
    H.vel.set(0, 0, 0); H.acc.set(0, 0, 0);
    this.s.prevSpeed = 0; this.s.accel = 0;
  }

  // speed: 水平の速さ(m/s)  air: 空中か  o: { vy, turn(rad/s), ground(x, z) → 地面の高さ }
  animate(dt, speed, inAir, o = {}) {
    if (dt <= 0) return;
    const S = this.s;
    this.time += dt;
    const vy = o.vy ?? 0, turn = o.turn ?? 0;

    // ---- 状態をなめらかに ----
    S.accel = damp(S.accel, clamp((speed - S.prevSpeed) / dt, -12, 12), 8, dt);
    S.prevSpeed = speed;
    S.speed = damp(S.speed, speed, 14, dt);
    S.mov = damp(S.mov, clamp(speed / 1.1, 0, 1), 9, dt);
    S.run = damp(S.run, sstep(2.4, 6.2, speed), 6, dt);
    if (inAir) { S.air = damp(S.air, 1, 14, dt); S.vy = vy; }
    else {
      if (S.air > 0.3 && S.landT > 0.2) { S.land = clamp(-S.vy / 7, 0.35, 1.1); S.landT = 0; }
      S.air = damp(S.air, 0, 20, dt);
    }
    S.landT += dt;
    S.rise = damp(S.rise, sstep(-2.5, 2.5, vy), 10, dt);
    S.turn = damp(S.turn, clamp(turn, -6, 6), 6, dt);
    S.idleT = S.mov < 0.08 && !inAir ? S.idleT + dt : 0;

    // ---- 足の運び ----
    const sp = S.speed, run = S.run, mov = S.mov;
    const freq = clamp(1.2 + sp * 0.24, 1.2, 3.0);
    const duty = mix(0.6, 0.35, run);
    this.p += freq * dt * clamp(mov * 3, 0, 1);
    this.phase = this.p * TAU;
    const stride = sp * duty / freq; // 接地している間に体が進む距離
    const k = clamp(sp / 1.6, 0, 1);
    const lift = mix(0.075, 0.13, run) * k;

    const B = this.bones;
    // 骨盤
    const bobW = 0.011 * Math.cos(TAU * 2 * (this.p - duty / 2));
    const bobR = -0.032 * Math.cos(TAU * 2 * (this.p - duty / 2));
    const land = S.landT < 0.45 ? S.land * Math.sin(Math.min(S.landT / 0.45, 1) * Math.PI) * Math.exp(-S.landT * 3) : 0;
    let hipY = mix(bobW, bobR, run) * k - 0.004 * mov - 0.034 * run - land * 0.11 * (1 - S.air);
    const breath = Math.sin(this.time * TAU * 0.28);
    const idleW = 1 - mov;
    // 待機: ときどき体重をのせる足を替える
    const Wt = this.weight;
    Wt.next -= dt;
    if (Wt.next < 0) { Wt.target = -Wt.target; Wt.next = 5 + Math.random() * 5; }
    Wt.v = damp(Wt.v, Wt.target, 1.6, dt);
    const idleOn = idleW * (1 - S.air);
    const wv = Wt.v * idleOn;
    const sway = (wv * 0.016 + Math.sin(this.time * 0.5) * 0.003 * idleOn);
    hipY -= 0.004 * idleW * (0.5 + 0.5 * breath);
    const cyc = Math.cos(TAU * this.p);
    const hipYaw = -0.16 * cyc * k * (1 - S.air);
    const hipRoll = 0.035 * Math.sin(TAU * 2 * this.p) * k * (1 - run) * (1 - S.air) + wv * 0.055;
    // 前傾（走る・加速する）と、曲がる向きへの傾き
    const leanF = 0.035 * mov + 0.16 * run + clamp(S.accel, -6, 8) * 0.012 * mov;
    S.lean = damp(S.lean, leanF, 6, dt);
    const bank = clamp(-S.turn * sp * 0.028, -0.28, 0.28) * (1 - S.air);

    // 空中の姿勢
    const rise = S.rise;
    const air = S.air;

    B.hips.position.set(this.rest.hips.x + sway, this.rest.hips.y + hipY, this.rest.hips.z);
    _e.set(S.lean * 0.35 + air * (0.1 - 0.25 * rise), hipYaw, hipRoll + bank, 'YXZ');
    B.hips.quaternion.setFromEuler(_e);
    B.hips.updateMatrix();

    // 足の目標（体のローカル: 足もとが原点）
    const ground = o.ground;
    if (ground) this.root.updateMatrixWorld();
    const off = { L: 0, R: 0 };
    const tgt = {};
    for (const side of ['L', 'R']) {
      const x = side === 'L' ? 1 : -1;
      const q = frac(this.p + (side === 'L' ? 0 : 0.5));
      let z, y, pitch, contact;
      if (q < duty) {
        const s = q / duty;
        z = stride * (0.5 - s);
        y = 0;
        pitch = -mix(0.3, 0.06, run) * (1 - sstep(0, 0.22, s)) * k + mix(0.42, 0.7, run) * sstep(0.62, 1, s) * k;
        contact = 1;
      } else {
        const s = (q - duty) / (1 - duty);
        const e = s * s * (3 - 2 * s);
        z = -stride / 2 + stride * e - run * 0.14 * Math.sin(Math.PI * Math.pow(s, 0.8)) * k;
        y = lift * Math.pow(Math.sin(Math.PI * s), 1.2) + run * 0.2 * k * Math.pow(Math.sin(Math.PI * Math.pow(s, 0.7)), 2);
        pitch = mix(mix(0.42, 0.7, run), -mix(0.3, 0.06, run), sstep(0.2, 1, s)) * k + run * 0.55 * Math.sin(Math.PI * s) * k;
        contact = 0;
      }
      // 待機の立ち位置へ混ぜる
      // 体重をのせていない足は少し前・外へ出してひざをゆるめる
      const free = Math.max(0, -Wt.v * x);
      const zIdle = x * 0.008 + free * 0.035, xIdle = x * (0.086 + free * 0.018);
      z = mix(zIdle, z, mov);
      y *= mov; pitch *= mov;
      let fx = mix(xIdle, x * mix(0.085, 0.06, run), mov);
      // 空中: 上りは片ひざを上げ、下りは両足をそろえて伸ばす
      if (air > 0.001) {
        const az = side === 'L' ? mix(0.05, 0.12, rise) : mix(-0.03, -0.12, rise);
        const ay = side === 'L' ? mix(0.07, 0.3, rise) : mix(0.05, 0.2, rise);
        const ap = side === 'L' ? mix(0.25, -0.2, rise) : mix(0.35, 0.8, rise);
        z = mix(z, az, air); y = mix(y, ay, air); pitch = mix(pitch, ap, air); fx = mix(fx, x * 0.09, air);
      }
      // 地面の起伏
      if (ground) {
        _w.set(fx, 0, z);
        this.root.localToWorld(_w);
        const g = ground(_w.x, _w.z) - this.root.position.y;
        off[side] = clamp(g, -0.3, 0.3) * (1 - air);
      }
      tgt[side] = { x: fx, y, z, pitch, contact };
    }
    const drop = Math.min(0, off.L, off.R);
    if (drop < 0) { B.hips.position.y += drop; B.hips.updateMatrix(); }
    for (const side of ['L', 'R']) {
      const t = tgt[side];
      // 足首の位置: かかとが上がる時はつま先の付け根、つま先が上がる時はかかとを支点に回す
      const piv = t.pitch > 0 ? BALL_Z : HEEL_Z;
      const pz = piv, py = t.pitch > 0 ? 0.012 : 0.0;
      const ax = 0 - pz, ay = ANKLE_H - py;
      const c = Math.cos(t.pitch), s = Math.sin(t.pitch);
      // Rx(pitch): (y, z) → (y c − z s, y s + z c)
      const ry = ay * c - ax * s, rz = ay * s + ax * c;
      _t.set(t.x, t.y + py + ry + off[side], t.z + pz + rz);
      this.solveLeg(side, _t, t.pitch);
      // つま先: 接地中にかかとが上がったら指の付け根で曲げる
      const toe = t.contact && t.pitch > 0 && t.y < 0.01 ? -t.pitch * 0.85 : 0;
      this.feet[side].toe = damp(this.feet[side].toe, toe, 25, dt);
      B['toe' + side].rotation.set(this.feet[side].toe, 0, 0);
    }

    // ---- 上半身 ----
    const chestYaw = 0.2 * cyc * k * (1 - air);
    const lean = S.lean;
    _e.set(lean * 0.4 + 0.012 * breath * idleW - air * 0.08 * rise, -hipYaw * 0.5 + wv * 0.04, -hipRoll * 0.75 - bank * 0.3, 'YXZ');
    B.spine.quaternion.setFromEuler(_e);
    _e.set(lean * 0.35 + 0.016 * breath * idleW, chestYaw - hipYaw * 0.3, -hipRoll * 0.4, 'YXZ');
    B.chest.quaternion.setFromEuler(_e);

    // 見回す（止まって少したったら）
    const L = this.look;
    L.next -= dt;
    if (S.idleT > 2.5 && L.next < 0) {
      const r = Math.random();
      L.ty = r < 0.3 ? 0 : (Math.random() - 0.5) * 1.3;
      L.tp = (Math.random() - 0.35) * 0.35;
      L.next = 1.8 + Math.random() * 2.8;
    }
    if (S.idleT < 0.5) { L.ty = 0; L.tp = 0; }
    // 会話中など: 外から見る向きを決める（[yaw, pitch]、pitch は負で見上げる）
    if (this.lookAt) { L.ty = this.lookAt[0]; L.tp = this.lookAt[1]; }
    L.yaw = damp(L.yaw, L.ty + S.turn * 0.1, 4, dt);
    L.pitch = damp(L.pitch, L.tp, 4, dt);
    const totalLean = lean * 0.75 + S.lean * 0.35 * 0 + air * (0.1 - 0.33 * rise);
    const headBob = run * k * 0.04 * Math.cos(TAU * 2 * (this.p - duty / 2));
    _e.set(-totalLean * 0.45 + L.pitch * 0.4, -chestYaw * 0.45 + L.yaw * 0.35, -bank * 0.2, 'YXZ');
    B.neck.quaternion.setFromEuler(_e);
    _e.set(-totalLean * 0.35 + L.pitch * 0.6 + headBob - air * 0.15 * rise, -chestYaw * 0.4 + L.yaw * 0.65, bank * 0.35, 'YXZ');
    B.head.quaternion.setFromEuler(_e);

    // ---- 腕 ----
    const armA = mix(0.42, 1.05, run) * k * (1 - air);
    for (const side of ['L', 'R']) {
      const x = side === 'L' ? 1 : -1;
      const sw = x * cyc; // 正 = 後ろへ
      const idleArm = Math.sin(this.time * 1.1 + x) * 0.03 * idleW;
      let ax = armA * sw + idleArm - lean * 0.3;
      let az = -x * mix(0.26, 0.2, run) - x * 0.03 * breath * idleW;
      let ay = -x * 0.25 * run * k;
      // 前に振った腕はよく曲げ、後ろの腕は少し伸ばす
      let elbow = mix(0.2, 1.05, run) * Math.max(k, 0.25) + mix(0.15, 0.55, run) * Math.max(0, -sw) * k - 0.2 * run * Math.max(0, sw) * k + 0.12 * idleW;
      // 空中: 上りは両手を上げ、下りは横に広げてバランス
      if (air > 0.001) {
        // 上り: 左手を突き上げ、右手は後ろへ。下り: 両手を横に広げる
        ax = mix(ax, mix(side === 'L' ? -0.5 : -0.2, side === 'L' ? -2.75 : 0.55, rise), air);
        az = mix(az, x * mix(side === 'L' ? 0.72 : 0.6, side === 'L' ? 0.15 : 0.3, rise), air);
        ay = mix(ay, 0, air);
        elbow = mix(elbow, mix(side === 'L' ? 0.65 : 0.45, side === 'L' ? 0.25 : 0.5, rise), air);
      }
      _e.set(ax, ay, az, 'XYZ');
      B['upperArm' + side].quaternion.setFromEuler(_e);
      B['forearm' + side].rotation.set(-elbow, x * 0.1 * run, 0, 'XYZ');
      B['hand' + side].rotation.set(-0.15 - 0.2 * run, 0, x * 0.1, 'XYZ');
    }

    this.updateHat(dt);
    this.updateFace(dt);
  }

  // 2 関節の IK。target は体のローカル（足もと原点）の足首の位置
  solveLeg(side, target, pitch) {
    const B = this.bones, thigh = B['thigh' + side], shin = B['shin' + side], foot = B['foot' + side];
    const { L1, L2, r1, r2 } = this.legLen;
    const hips = B.hips;
    // 骨盤のローカルへ
    _mi.copy(hips.matrix).invert();
    _t.copy(target).applyMatrix4(_mi);
    _a.copy(thigh.position);
    _d.subVectors(_t, _a);
    const dist = clamp(_d.length(), 0.05, L1 + L2 - 1e-4);
    _u.copy(_d).normalize();
    const cosA = clamp((L1 * L1 + dist * dist - L2 * L2) / (2 * L1 * dist), -1, 1);
    const A = Math.acos(cosA);
    // ひざは前へ（少し外向き）
    _v.set(side === 'L' ? 0.12 : -0.12, 0, 1);
    _v.addScaledVector(_u, -_v.dot(_u)).normalize();
    _k.copy(_u).multiplyScalar(Math.cos(A)).addScaledVector(_v, Math.sin(A));
    thigh.quaternion.setFromUnitVectors(r1, _k);
    // すね
    const kneeX = _a.x + _k.x * L1, kneeY = _a.y + _k.y * L1, kneeZ = _a.z + _k.z * L1;
    _d.set(_a.x + _u.x * dist - kneeX, _a.y + _u.y * dist - kneeY, _a.z + _u.z * dist - kneeZ).normalize();
    _q.copy(thigh.quaternion).invert();
    _d.applyQuaternion(_q);
    shin.quaternion.setFromUnitVectors(r2, _d);
    // 足: 体に対する向きが pitch になるように
    _q.copy(hips.quaternion).multiply(thigh.quaternion).multiply(shin.quaternion).invert();
    _q2.setFromEuler(_e.set(pitch, side === 'L' ? 0.1 : -0.1, 0, 'YXZ'));
    foot.quaternion.copy(_q).multiply(_q2);
  }

  updateHat(dt) {
    const H = this.hat;
    const p = this.head.getWorldPosition(_w);
    if (H.first || !H.prev) { H.prev = p.clone(); H.first = false; return; }
    const vx = (p.x - H.prev.x) / dt, vy = (p.y - H.prev.y) / dt, vz = (p.z - H.prev.z) / dt;
    H.prev.copy(p);
    _d.set((vx - H.vel.x) / dt, (vy - H.vel.y) / dt, (vz - H.vel.z) / dt);
    H.vel.set(vx, vy, vz);
    if (_d.length() > 60) _d.setLength(60); // ワープした時
    H.acc.lerp(_d, 1 - Math.exp(-dt * 25));
    // 頭の向きに直す
    this.head.getWorldQuaternion(_q).invert();
    _v.copy(H.acc).applyQuaternion(_q);
    const K = 170, D = 11, C = 0.0065;
    H.vx += (-K * H.rx - D * H.vx - C * _v.z * K) * dt; // 前へ加速すると前が浮く
    H.vz += (-K * H.rz - D * H.vz + C * _v.x * K) * dt;
    H.rx = clamp(H.rx + H.vx * dt, -0.22, 0.22);
    H.rz = clamp(H.rz + H.vz * dt, -0.2, 0.2);
    H.vy += (-260 * H.y - 14 * H.vy - _v.y * 0.9) * dt;
    H.y += H.vy * dt;
    if (H.y < 0) { H.y = 0; if (H.vy < 0) H.vy *= -0.2; }
    if (H.y > 0.03) { H.y = 0.03; H.vy = Math.min(H.vy, 0); }
    this.hatPivot.rotation.set(H.rx, 0, H.rz);
    this.hatPivot.position.y = this.hatBaseY ?? (this.hatBaseY = this.hatPivot.position.y);
    this.hatPivot.position.y = this.hatBaseY + H.y;
  }

  updateFace(dt) {
    const b = this.blink, S = this.s;
    b.t -= dt;
    if (b.phase < 0 && b.t <= 0) { b.phase = 0; }
    if (b.phase >= 0) {
      b.phase += dt;
      const T = 0.13;
      b.v = b.phase < T * 0.4 ? b.phase / (T * 0.4) : Math.max(0, 1 - (b.phase - T * 0.4) / (T * 0.6));
      if (b.phase >= T) {
        b.phase = -1; b.v = 0;
        if (!b.twice && Math.random() < 0.2) { b.twice = true; b.t = 0.09; }
        else { b.twice = false; b.t = 1.8 + Math.random() * 3.5; }
      }
    }
    const happy = S.air > 0.5 && S.rise > 0.3 ? 1 : 0;
    this.expr.happy = damp(this.expr.happy, happy, happy ? 20 : 6, dt);
    const mouth = Math.max(sstep(0.45, 0.9, S.run * S.mov), S.air > 0.5 ? 1 : 0);
    this.expr.mouth = damp(this.expr.mouth, mouth, 10, dt);
    this.face.uBlink.value = b.v;
    this.face.uHappy.value = this.expr.happy > 0.5 ? 1 : 0;
    this.face.uMouth.value = this.expr.mouth > 0.5 ? 1 : 0;
  }
}
