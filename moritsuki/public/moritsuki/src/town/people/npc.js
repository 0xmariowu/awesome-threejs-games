// 町の人（夏海・磯貝博士）を動かす: 立ち姿のポーズ（腕は 2 関節の IK）、足は地面に置いて向きを変えるときは踏みかえる、
// 視線（頭・首・目）、まばたき・口の形（しゃべる文字の母音）・表情、身ぶり、ポニーテールのばね。
import * as THREE from 'three';
import { buildPerson, CHARS } from './model.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const mix = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const damp = (a, b, rate, dt) => a + (b - a) * (1 - Math.exp(-rate * dt));
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _q3 = new THREE.Quaternion(), _e = new THREE.Euler();
const _m = new THREE.Matrix4(), _m2 = new THREE.Matrix4(), _mi = new THREE.Matrix4();
const _a = V(), _b = V(), _c = V(), _d = V(), _t = V(), _u = V(), _v = V(), _k = V(), _w = V();

// ---------- ポーズ（腕の目標は体の静止ポーズの座標: 足もと原点、+z が前、本人の左が +x）----------
// w: 手首の位置  p: ひじを向ける方向  f: 指先の向き  n: 手のひらの向き  h: 手の形
const arm = (w, p, f, n, h = 'relaxed') => ({ w, p, f, n, h });
const mirror = (a) => arm([-a.w[0], a.w[1], a.w[2]], [-a.p[0], a.p[1], a.p[2]], [-a.f[0], a.f[1], a.f[2]], [-a.n[0], a.n[1], a.n[2]], a.h);

const POSES = {
  natsumi: (() => {
    const down = arm([0.205, 0.8, 0.02], [0.35, 0, -1], [0.15, -1, 0.12], [-1, 0, 0.15]);
    const hip = arm([0.182, 0.972, -0.045], [1, 0.15, -0.55], [0.05, -0.5, 0.86], [-1, 0.1, 0], 'relaxed');
    const back = arm([0.045, 0.885, -0.155], [1, 0, -0.25], [-0.65, -0.72, -0.1], [0, 0.15, -1]);
    const open = arm([-0.15, 0.99, 0.19], [-0.5, -1, -0.35], [0.25, 0.25, 1], [0.35, 1, 0]);
    return {
      stand: { L: down, R: mirror(down), body: { weight: 0.5, lean: 0.0, head: [0, 0, 0] } },
      hipL: { L: hip, R: mirror(down), body: { weight: -0.9, lean: 0.01, tilt: 0.03, head: [0.02, 0, -0.05] } },
      hips: { L: hip, R: mirror(hip), body: { weight: 0.6, lean: -0.02, head: [-0.03, 0, 0] } },
      behind: { L: back, R: mirror(back), body: { weight: 0.9, lean: 0.015, head: [0.03, 0, 0.06] } },
      talk: { L: down, R: open, body: { weight: -0.4, lean: 0.02, head: [0, 0, 0] } },
      talkHip: { L: hip, R: open, body: { weight: -0.7, lean: 0.02, head: [0, 0, -0.04] } },
    };
  })(),
  isogai: (() => {
    const down = arm([0.225, 0.84, 0.03], [0.35, 0, -1], [0.12, -1, 0.15], [-1, 0, 0.15]);
    const back = arm([0.04, 0.975, -0.205], [1, 0.05, -0.15], [-0.7, -0.62, -0.1], [0, 0.1, -1]);
    const chinR = arm([-0.03, 1.37, 0.215], [-0.1, -1, 0.45], [0.12, 0.95, -0.28], [0, 0.1, -1], 'relaxed');
    const hold = arm([-0.05, 1.15, 0.235], [1, -0.5, -0.1], [-1, 0.05, 0.1], [0, 0.95, -0.3]);
    const lect = arm([-0.21, 1.32, 0.22], [-0.45, -1, -0.15], [0.05, 1, 0.12], [0.15, 0.1, -1], 'point');
    const open = arm([-0.17, 1.07, 0.24], [-0.5, -1, -0.3], [0.25, 0.25, 1], [0.35, 1, 0]);
    return {
      stand: { L: down, R: mirror(down), body: { weight: 0.4, lean: -0.01, head: [0, 0, 0] } },
      behind: { L: back, R: mirror(back), body: { weight: 0.2, lean: -0.035, head: [-0.02, 0, 0] } },
      chin: { L: hold, R: chinR, body: { weight: -0.6, lean: 0.02, head: [0.12, 0.1, 0.06] } },
      lecture: { L: back, R: lect, body: { weight: 0.3, lean: -0.03, head: [-0.04, 0, 0] } },
      talk: { L: back, R: open, body: { weight: 0.3, lean: -0.01, head: [0, 0, 0] } },
    };
  })(),
};

// 身ぶり（決まった長さ）: 腕・体の目標を時間で上書きする
const GESTURES = {
  wave: { dur: 2.0, arm: 'R', target: (t, s) => arm([-0.34 - Math.sin(t * 12) * 0.055, s.h * 1.035, 0.13], [-0.8, -1, -0.3], [-0.15 + Math.sin(t * 12) * 0.3, 1, 0.05], [0, 0.1, 1]), body: { head: [-0.04, 0, 0.1], lean: -0.02 } },
  nod: { dur: 0.7, head: (t) => [Math.sin(Math.min(1, t / 0.7) * Math.PI * 2) * 0.16 * (1 - t / 0.9), 0, 0] },
  bow: { dur: 1.8, lean: (t) => Math.sin(Math.min(1, t / 1.8) * Math.PI) * 0.42 },
  fist: { dur: 1.3, arm: 'R', target: (t, s) => arm([-0.14, s.h * 0.72 + Math.max(0, Math.sin(t * 8)) * 0.03 * (t < 0.8 ? 1 : 0), 0.14], [-0.6, -1, -0.1], [0.05, 1, 0.25], [1, 0, 0.2], 'fist'), body: { head: [-0.05, 0, -0.05] } },
  band: { dur: 1.6, arm: 'R', target: (t, s) => arm([-0.13, s.h * 0.965, 0.04], [-1, -0.3, -0.2], [0.35, 0.75, 0.3], [0.9, 0, -0.3]), body: { head: [0.05, 0.12, -0.12] } },
  stretch: { dur: 2.6, both: true, target: (t, s, side) => arm([side * 0.07, s.h * 1.2, 0.0], [side * 1, 0, -0.3], [-side * 0.3, 1, 0], [0, 0, side > 0 ? 1 : -1]), body: { lean: -0.07, head: [-0.15, 0, 0] } },
  glasses: { dur: 1.2, arm: 'R', target: (t, s) => arm([-0.045, s.h * 0.84, 0.2], [-0.2, -1, 0.3], [0.08, 0.85, -0.52], [0.2, -0.2, -1], 'point'), body: { head: [0.05, 0, 0] } },
  point: { dur: 2.2, arm: 'R', target: (t, s) => arm([-0.21, s.h * 0.78, 0.22], [-0.45, -1, -0.15], [0.05, 1, 0.12], [0.15, 0.1, -1], 'point'), body: { head: [-0.05, 0, 0] } },
  laugh: { dur: 1.4, lean: (t) => -0.06 * Math.sin(Math.min(1, t / 1.4) * Math.PI), head: (t) => [-0.12 * Math.sin(Math.min(1, t / 1.4) * Math.PI) + Math.sin(t * 22) * 0.02 * (1 - t / 1.4), 0, 0] },
  tilt: { dur: 1.6, head: (t) => [0, 0, 0.22 * Math.sin(Math.min(1, t / 1.6) * Math.PI)] },
};

// かなの母音 → 口の形（0 = 閉じ 1 = あ 2 = い・え・う 3 = 笑い）
const VOWEL = (() => {
  const m = new Map();
  const rows = ['あかさたなはまやらわがざだばぱぁゃ', 'いきしちにひみりぎじぢびぴぃ', 'うくすつぬふむゆるぐずづぶぷぅゅ', 'えけせてねへめれげぜでべぺぇ', 'おこそとのほもよろをごぞどぼぽぉょ'];
  const kata = (s) => [...s].map((c) => String.fromCharCode(c.charCodeAt(0) + 0x60)).join('');
  const shape = [1, 2, 2, 2, 1];
  rows.forEach((r, i) => { for (const c of r + kata(r)) m.set(c, shape[i]); });
  return m;
})();
export const mouthOf = (ch) => (VOWEL.has(ch) ? VOWEL.get(ch) : /[ー〜]/.test(ch) ? -1 : /[一-鿿]/.test(ch) ? 1 + ((ch.charCodeAt(0) >> 1) % 2) : 0);

export class Npc {
  static async load(id) { return new Npc(await buildPerson(id)); }

  constructor(P) {
    this.id = P.id;
    this.P = P;
    this.C = CHARS[P.id];
    this.root = P.root;
    this.bones = P.bones;
    this.face = P.face;
    this.hands = P.hands;
    this.stats = P.stats;
    this.meshes = P.meshes;
    const J = this.C.RIG.J;
    this.J = J;
    this.height = P.id === 'isogai' ? 1.7 : 1.6;
    this.rest = {};
    for (const [n, b] of Object.entries(this.bones)) this.rest[n] = b.position.clone();
    // 腕の寸法（静止ポーズの向き）
    this.armDim = {};
    for (const s of ['L', 'R']) {
      const sh = V(...J[s].sh), el = V(...J[s].el), wr = V(...J[s].wr);
      const r1 = el.clone().sub(sh), r2 = wr.clone().sub(el);
      const L1 = r1.length(), L2 = r2.length();
      r1.normalize(); r2.normalize();
      const pole = V(0, 0, -1).addScaledVector(r1, r1.z).normalize(); // 静止ポーズのひじは後ろ
      this.armDim[s] = { L1, L2, r1, r2, pole, chestOff: V(J.chest[0], J.chest[1], J.chest[2]) };
    }
    this.legLen = {
      L1: this.bones.shinL.position.length(),
      L2: this.bones.footL.position.length(),
      r1: this.bones.shinL.position.clone().normalize(),
      r2: this.bones.footL.position.clone().normalize(),
    };
    this.ankleH = J.L.an[1];
    this.poses = POSES[P.id];
    this.base = P.id === 'isogai' ? 'behind' : 'hipL';
    this.pose = this.base;
    // 今の腕の状態（なめらかに目標へ）
    const init = this.poses[this.pose];
    this.armState = { L: this.cloneArm(init.L), R: this.cloneArm(init.R) };
    this.handShape = { L: 'relaxed', R: 'relaxed' };
    this.bodyState = { weight: 0, lean: 0, tilt: 0, head: [0, 0, 0] };
    this.time = Math.random() * 10;
    this.yaw = 0; this.yawTarget = 0;
    this.pos = V();
    this.ground = () => 0;
    this.feet = { L: null, R: null };
    this.stepping = null; // { side, t, from, to }
    this.look = { yaw: 0, pitch: 0, eyeX: 0, eyeY: 0, has: 0 };
    this.blink = { t: 2, v: 0, phase: -1 };
    this.mood = 'normal';
    this.mouth = { v: 0, hold: 0, shape: 0 };
    this.gest = null;
    this.idle = { next: 6 + Math.random() * 6, drift: [0, 0], driftNext: 2 };
    this.talking = false;
    this.pony = P.extra.pony ? { u: P.extra.pony.u, x: V(), v: V(), prev: null, vel: V(), acc: V() } : null;
    this.debugTPose = false;
    this.visible = true;
  }

  cloneArm(a) {
    return { w: V(...a.w), p: V(...a.p).normalize(), f: V(...a.f).normalize(), n: V(...a.n).normalize(), h: a.h };
  }

  // 置く（向きは yaw）。足は立ち位置にそろえる
  place(x, z, yaw = 0, ground) {
    if (ground) this.ground = ground;
    this.pos.set(x, this.ground(x, z), z);
    this.yaw = this.yawTarget = yaw;
    this.root.position.copy(this.pos);
    this.root.rotation.y = yaw;
    this.homeYaw = yaw;
    this.feet.L = this.footHome('L');
    this.feet.R = this.footHome('R');
    this.stepping = null;
    if (this.pony) this.pony.prev = null;
  }
  // 足の置き場所（世界）: 体の向きと立ち方から
  footHome(side, yaw = this.yawTarget) {
    const x = side === 'L' ? 1 : -1;
    const w = this.bodyState.weight * x; // 正 = この足に体重
    const lx = x * (0.095 + Math.max(0, -w) * 0.025), lz = 0.012 + Math.max(0, -w) * 0.04;
    const s = Math.sin(yaw), c = Math.cos(yaw);
    const wx = this.pos.x + lx * c + lz * s, wz = this.pos.z - lx * s + lz * c;
    return { x: wx, z: wz, y: this.ground(wx, wz), yaw: yaw + x * (0.1 + Math.max(0, -w) * 0.05) };
  }

  faceTo(x, z) { this.yawTarget = Math.atan2(x - this.pos.x, z - this.pos.z); }
  faceYaw(y) { this.yawTarget = y; }

  // 会話の口: 1 文字ずつ（talk.js が文字を出すたびに呼ぶ）
  speak(ch) {
    const m = mouthOf(ch);
    if (m < 0) { this.mouth.hold = 0.09; return; }
    this.mouth.shape = m;
    this.mouth.hold = m ? 0.085 : 0.05;
  }
  setMood(m) { this.mood = m || 'normal'; }
  setPose(name) { this.pose = this.poses[name] ? name : this.base; }
  gesture(name) { if (GESTURES[name]) this.gest = { name, t: 0, g: GESTURES[name] }; }

  // 確認ページ用: 自分で 1 文字ずつしゃべる
  say(text, { mood = 'normal' } = {}) {
    this.setMood(mood);
    this.sayQ = text ? { text: [...text], i: 0, t: 0 } : null;
    this.talking = !!text;
    this.setPose(text ? (this.poses.talk ? 'talk' : this.base) : this.base);
  }

  // ---------- ふだんのふるまい（町で使う）----------
  // player: 主人公の頭の位置（世界）。近づくと目で追い、はじめて来たら手を振る。話していない間は、ときどき身ぶりをする
  // active: 遊んでいる間だけ（タイトル画面では手を振らずに取っておく）
  live(dt, player, active = true) {
    const B = this.beh || (this.beh = { t: 0, next: 5 + Math.random() * 5, hold: 0, poseT: 0, greeted: false, away: 99, face: 0 });
    B.t += dt;
    const d = player ? Math.hypot(player.x - this.pos.x, player.z - this.pos.z) : 99;
    let look = null;
    if (this.talking) return player;
    // 見る: 8 m 以内（真後ろは見ない）
    if (d < 8) look = player;
    // はじめて近づいたら（しばらく離れていたら）手を振って笑う
    if (d > 16) B.away += dt; else if (active && d < 7.5 && B.away > 6) {
      B.away = 0;
      this.gesture('wave');
      this.setMood('happy');
      B.face = 2.2;
    }
    if (B.face > 0) { B.face -= dt; if (B.face <= 0) this.setMood('normal'); }
    // すぐそばで長く見ていると、体ごと向く（離れたら元の向きへ）
    if (d < 3.2) {
      const yaw = Math.atan2(player.x - this.pos.x, player.z - this.pos.z);
      if (Math.abs(wrap(yaw - this.yaw)) > 0.7) B.hold += dt; else B.hold = 0;
      if (B.hold > 1.2) { this.faceYaw(yaw); B.hold = 0; }
    } else if (d > 6 && Math.abs(wrap(this.homeYaw - this.yawTarget)) > 0.05) {
      B.hold += dt;
      if (B.hold > 2.5) { this.faceYaw(this.homeYaw); B.hold = 0; }
    }
    // 身ぶり・姿勢の入れかえ
    if (B.poseT > 0) { B.poseT -= dt; if (B.poseT <= 0) { this.setPose(this.base); if (this.mood === 'think') this.setMood('normal'); } }
    B.next -= dt;
    if (B.next < 0 && !this.gest) {
      B.next = 7 + Math.random() * 8;
      const r = Math.random();
      if (this.id === 'natsumi') {
        if (r < 0.25) this.gesture('band');
        else if (r < 0.4) this.gesture('stretch');
        else if (r < 0.65) { this.setPose('behind'); B.poseT = 5 + Math.random() * 4; }
        else if (r < 0.8) { this.setPose('hips'); B.poseT = 4 + Math.random() * 3; }
        else this.gesture('tilt');
      } else {
        if (r < 0.3) this.gesture('glasses');
        else if (r < 0.65) { this.setPose('chin'); this.setMood('think'); B.poseT = 4 + Math.random() * 3; }
        else if (r < 0.8) { this.setPose('stand'); B.poseT = 4 + Math.random() * 4; }
        else this.gesture('nod');
      }
    }
    return look;
  }

  // 会話のはじめ・おわり（talk.js）
  beginTalk(player) {
    this.talking = true;
    this.gest = null;
    if (player) this.faceTo(player.x, player.z);
    this.setPose(this.poses.talk ? (this.id === 'natsumi' ? 'talkHip' : 'talk') : this.base);
    if (this.beh) { this.beh.poseT = 0; this.beh.away = 0; this.beh.face = 0; }
  }
  endTalk() {
    this.talking = false;
    this.setMood('normal');
    this.setPose(this.base);
    if (this.beh) { this.beh.next = 4 + Math.random() * 3; this.beh.hold = 0; }
  }

  // look: 見る点（世界）か null。talking = 話し中
  update(dt, { look = null } = {}) {
    if (dt <= 0) return;
    this.time += dt;
    if (this.sayQ) {
      const q = this.sayQ;
      q.t += dt;
      while (q.t > 0.055 && q.i < q.text.length) { q.t -= 0.055; this.speak(q.text[q.i++]); }
      if (q.i >= q.text.length && q.t > 1.2) { q.i = 0; q.t = -1.2; }
    }
    this.updateBody(dt, look);
    this.updateFace(dt, look);
    this.updatePony(dt);
  }

  // ---------- 体 ----------
  updateBody(dt, look) {
    const B = this.bones;
    if (this.debugTPose) {
      for (const b of Object.values(B)) b.quaternion.identity();
      for (const [n, b] of Object.entries(B)) b.position.copy(this.rest[n]);
      this.root.position.copy(this.pos); this.root.rotation.y = this.yaw;
      return;
    }
    // 向き: 目標へ回る（速さに上限）
    const dy = wrap(this.yawTarget - this.yaw);
    const turnRate = clamp(dy * 4, -2.6, 2.6);
    this.yaw += turnRate * dt * (Math.abs(dy) > 0.01 ? 1 : 0);
    this.root.position.set(this.pos.x, this.pos.y, this.pos.z);
    this.root.rotation.y = this.yaw;
    this.root.updateMatrixWorld();

    // ポーズ目標 + 身ぶり
    const pose = this.poses[this.pose] || this.poses[this.base];
    const g = this.gest;
    if (g) { g.t += dt; if (g.t > g.g.dur) this.gest = null; }
    const gw = g ? sstep(0, 0.25, g.t) * (1 - sstep(g.g.dur - 0.35, g.g.dur, g.t)) : 0;
    const bodyT = { ...{ weight: 0, lean: 0, tilt: 0, head: [0, 0, 0] }, ...pose.body };
    const S = { h: this.height, k: 1 };
    for (const side of ['L', 'R']) {
      let tgt = pose[side];
      if (g && gw > 0.001 && g.g.target && (g.g.both || g.g.arm === side)) tgt = g.g.target(g.t, S, side === 'L' ? 1 : -1);
      const st = this.armState[side];
      const rate = g && (g.g.arm === side || g.g.both) ? 9 : 4.5;
      st.w.x = damp(st.w.x, tgt.w[0], rate, dt); st.w.y = damp(st.w.y, tgt.w[1], rate, dt); st.w.z = damp(st.w.z, tgt.w[2], rate, dt);
      for (const k of ['p', 'f', 'n']) {
        _a.set(...tgt[k]).normalize();
        st[k].lerp(_a, 1 - Math.exp(-rate * dt)).normalize();
      }
      // 手の形は、目標に近づいたら切りかえる
      const want = tgt.h || 'relaxed';
      if (want !== this.handShape[side] && st.w.distanceTo(_a.set(...tgt.w)) < 0.12) this.setHand(side, want);
    }
    const bs = this.bodyState;
    let weight = bodyT.weight;
    // 待機中はときどき体重を反対の足へ
    const I = this.idle;
    I.driftNext -= dt;
    if (I.driftNext < 0) { I.drift = [(Math.random() - 0.5) * 0.12, (Math.random() - 0.5) * 0.25]; I.driftNext = 2 + Math.random() * 3; }
    bs.weight = damp(bs.weight, weight, 1.8, dt);
    bs.lean = damp(bs.lean, bodyT.lean + (g && g.g.lean ? g.g.lean(g.t) : 0) + (g && g.g.body?.lean ? g.g.body.lean * gw : 0), 6, dt);
    bs.tilt = damp(bs.tilt, bodyT.tilt || 0, 3, dt);
    const gh = g && g.g.body?.head ? g.g.body.head : [0, 0, 0];
    for (let k = 0; k < 3; k++) bs.head[k] = damp(bs.head[k], bodyT.head[k] + gh[k] * gw, 4, dt);
    const headAdd = g && g.g.head ? g.g.head(g.t) : [0, 0, 0];

    // ---- 足: 地面に置いたまま。体が回ったり体重を替えたら踏みかえる ----
    this.updateFeet(dt);
    const breath = Math.sin(this.time * TAU * 0.24);
    const wv = bs.weight; // +1 = 左足に体重
    const sway = wv * 0.028;
    B.hips.position.set(this.rest.hips.x + sway, this.rest.hips.y - 0.012 - Math.abs(wv) * 0.006, this.rest.hips.z);
    // 腰（骨盤）はあまり傾けない（前掛け・白衣を太ももが突き抜けないように）。お辞儀は背骨で曲げる
    const leanHip = clamp(bs.lean, -0.04, 0.05), leanUp = bs.lean - leanHip;
    _e.set(leanHip * 0.4, -wv * 0.05, wv * 0.045 + bs.tilt, 'YXZ');
    B.hips.quaternion.setFromEuler(_e);
    B.hips.updateMatrix();
    for (const side of ['L', 'R']) this.placeLeg(side);

    // ---- 上半身 ----
    _e.set(leanHip * 0.35 + leanUp * 0.6 + 0.01 * breath, wv * 0.03, -wv * 0.035 - bs.tilt * 0.6, 'YXZ');
    B.spine.quaternion.setFromEuler(_e);
    _e.set(leanHip * 0.3 + leanUp * 0.45 + 0.014 * breath, wv * 0.02, -wv * 0.02 - bs.tilt * 0.3, 'YXZ');
    B.chest.quaternion.setFromEuler(_e);
    B.spine.updateMatrix(); B.chest.updateMatrix();

    // ---- 頭・首: 見る点へ（限界をこえたら体ごと向く）----
    const L = this.look;
    let ty = I.drift[1] * 0.4, tp = I.drift[0] * 0.3;
    if (look) {
      this.root.updateMatrixWorld();
      _a.copy(look);
      this.root.worldToLocal(_a);
      _a.y -= this.height - 0.1;
      const yaw = Math.atan2(_a.x, _a.z), pitch = -Math.atan2(_a.y, Math.hypot(_a.x, _a.z));
      L.has = damp(L.has, 1, 3, dt);
      ty = clamp(yaw, -1.15, 1.15);
      tp = clamp(pitch, -0.45, 0.55);
      if (Math.abs(yaw) > 1.35) { ty = 0; tp = 0; } // 真後ろは見ない
    } else L.has = damp(L.has, 0, 2, dt);
    L.yaw = damp(L.yaw, ty, 5, dt);
    L.pitch = damp(L.pitch, tp, 5, dt);
    const hb = bs.head;
    _e.set(L.pitch * 0.35 + hb[0] * 0.4 - bs.lean * 0.3 + headAdd[0] * 0.3, L.yaw * 0.35 + hb[1] * 0.4, hb[2] * 0.3 + headAdd[2] * 0.3, 'YXZ');
    B.neck.quaternion.setFromEuler(_e);
    _e.set(L.pitch * 0.6 + hb[0] * 0.6 - bs.lean * 0.3 + headAdd[0] * 0.7 - 0.012 * breath, L.yaw * 0.6 + hb[1] * 0.6, hb[2] * 0.7 + headAdd[2] * 0.7, 'YXZ');
    B.head.quaternion.setFromEuler(_e);
    // 目: 頭で向ききれない分
    L.eyeX = clamp((ty - L.yaw * 0.95) * 0.012 + (look ? 0 : I.drift[1] * 0.004), -0.0034, 0.0034);
    L.eyeY = clamp(-(tp - L.pitch * 0.95) * 0.008, -0.002, 0.0018);

    // ---- 腕（胸の骨のローカルで IK）----
    for (const side of ['L', 'R']) this.solveArm(side, breath);
  }

  setHand(side, shape) {
    const H = this.hands[side];
    if (!H[shape]) shape = 'relaxed';
    for (const [k, m] of Object.entries(H)) m.visible = k === shape;
    this.handShape[side] = shape;
  }

  // 足の置き場所の更新と、踏みかえ
  updateFeet(dt) {
    const F = this.feet;
    if (!F.L) { F.L = this.footHome('L'); F.R = this.footHome('R'); }
    const st = this.stepping;
    if (st) {
      st.t += dt / 0.3;
      if (st.t >= 1) { F[st.side] = st.to; this.stepping = null; }
    } else {
      // いちばんずれている足を 1 本ずつ
      let worst = null, wd = 0;
      for (const side of ['L', 'R']) {
        const h = this.footHome(side, this.yaw + clamp(wrap(this.yawTarget - this.yaw), -0.5, 0.5));
        const f = F[side];
        const d = Math.hypot(h.x - f.x, h.z - f.z) + Math.abs(wrap(h.yaw - f.yaw)) * 0.12;
        if (d > wd) { wd = d; worst = { side, h }; }
      }
      const moving = Math.abs(wrap(this.yawTarget - this.yaw)) > 0.05;
      if (worst && (wd > (moving ? 0.055 : 0.09))) this.stepping = { side: worst.side, t: 0, from: F[worst.side], to: worst.h };
    }
  }

  // 足首の目標（体のローカル）→ IK
  placeLeg(side) {
    const F = this.feet[side], st = this.stepping && this.stepping.side === side ? this.stepping : null;
    let wx = F.x, wz = F.z, wy = F.y, fyaw = F.yaw, lift = 0, pitch = 0;
    if (st) {
      const t = sstep(0, 1, st.t);
      wx = mix(st.from.x, st.to.x, t); wz = mix(st.from.z, st.to.z, t); wy = mix(st.from.y, st.to.y, t);
      fyaw = st.from.yaw + wrap(st.to.yaw - st.from.yaw) * t;
      lift = Math.sin(Math.PI * st.t) * 0.055;
      pitch = Math.sin(Math.PI * st.t) * -0.25;
    }
    _t.set(wx, wy + lift, wz);
    this.root.worldToLocal(_t);
    const ry = wrap(fyaw - this.yaw);
    _t.y += this.ankleH;
    this.solveLeg(side, _t, pitch, ry);
  }

  // 2 関節の IK（kid/index.js と同じ）。target は体のローカル（足もと原点）の足首の位置
  solveLeg(side, target, pitch, yaw) {
    const B = this.bones, thigh = B['thigh' + side], shin = B['shin' + side], foot = B['foot' + side];
    const { L1, L2, r1, r2 } = this.legLen;
    const hips = B.hips;
    _mi.copy(hips.matrix).invert();
    _t.copy(target).applyMatrix4(_mi);
    _a.copy(thigh.position);
    _d.subVectors(_t, _a);
    const dist = clamp(_d.length(), 0.05, L1 + L2 - 2e-3);
    _u.copy(_d).normalize();
    const cosA = clamp((L1 * L1 + dist * dist - L2 * L2) / (2 * L1 * dist), -1, 1);
    const A = Math.acos(cosA);
    _v.set(side === 'L' ? 0.12 : -0.12, 0, 1);
    _v.applyAxisAngle(_w.set(0, 1, 0), yaw * 0.6);
    _v.addScaledVector(_u, -_v.dot(_u)).normalize();
    _k.copy(_u).multiplyScalar(Math.cos(A)).addScaledVector(_v, Math.sin(A));
    thigh.quaternion.setFromUnitVectors(r1, _k);
    const kneeX = _a.x + _k.x * L1, kneeY = _a.y + _k.y * L1, kneeZ = _a.z + _k.z * L1;
    _d.set(_a.x + _u.x * dist - kneeX, _a.y + _u.y * dist - kneeY, _a.z + _u.z * dist - kneeZ).normalize();
    _q.copy(thigh.quaternion).invert();
    _d.applyQuaternion(_q);
    shin.quaternion.setFromUnitVectors(r2, _d);
    _q.copy(hips.quaternion).multiply(thigh.quaternion).multiply(shin.quaternion).invert();
    _q2.setFromEuler(_e.set(pitch, yaw, 0, 'YXZ'));
    foot.quaternion.copy(_q).multiply(_q2);
    B['toe' + side].quaternion.identity();
  }

  // 腕の IK: 手首を目標へ、ひじは p の向きへ、手は指先 f・手のひら n の向きに
  solveArm(side, breath) {
    const B = this.bones, st = this.armState[side], D = this.armDim[side];
    const up = B['upperArm' + side], fo = B['forearm' + side], ha = B['hand' + side];
    const s = side === 'L' ? 1 : -1;
    // 目標（体の静止座標）→ 胸の骨のローカル（静止時の胸の位置を引く）
    _t.copy(st.w).sub(D.chestOff);
    _t.y += 0.004 * breath;
    const S = up.position;
    _d.subVectors(_t, S);
    const dist = clamp(_d.length(), 0.06, D.L1 + D.L2 - 2e-3);
    _u.copy(_d).normalize();
    const cosA = clamp((D.L1 * D.L1 + dist * dist - D.L2 * D.L2) / (2 * D.L1 * dist), -1, 1);
    const A = Math.acos(cosA);
    _v.copy(st.p).addScaledVector(_u, -st.p.dot(_u));
    if (_v.lengthSq() < 1e-6) _v.set(0, 0, -1);
    _v.normalize();
    _k.copy(_u).multiplyScalar(Math.cos(A)).addScaledVector(_v, Math.sin(A)); // 上腕の向き
    // 上腕: 静止の (r1, ひじの向き) → (k, v を k に直交させたもの)
    _a.copy(_v).addScaledVector(_k, -_v.dot(_k)).normalize();
    basis(_m, D.r1, D.pole);
    basis(_m2, _k, _a);
    _m2.multiply(_m.transpose());
    up.quaternion.setFromRotationMatrix(_m2);
    // 前腕: 上腕のローカルで、静止の向き r2 → 手首への向き
    _b.copy(S).addScaledVector(_k, D.L1); // ひじ
    _c.subVectors(_t, _b).normalize();
    _q.copy(up.quaternion).invert();
    _c.applyQuaternion(_q);
    fo.quaternion.setFromUnitVectors(D.r2, _c);
    // 手: 胸のローカルでの向き（手のメッシュの -y = 指先、手のひら = -x（左）/ +x（右））
    _a.copy(st.f);
    _b.copy(st.n).addScaledVector(_a, -st.n.dot(_a)).normalize();
    basis(_m2, _a, _b);
    basis(_m, _w.set(0, -1, 0), _c.set(-1, 0, 0)); // 手のメッシュのローカル（左右とも「手のひら」を -x として組み、右は鏡像なので手のひらの向きを反転）
    if (s < 0) { _b.negate(); basis(_m2, _a, _b); }
    _m2.multiply(_m.transpose());
    _q2.setFromRotationMatrix(_m2);                 // 手のメッシュの向き（胸のローカル）
    _q3.setFromAxisAngle(_w.set(0, 0, 1), s * this.C.RIG.aLo).invert();
    _q2.multiply(_q3);                              // 手の骨の向き（胸のローカル）
    _q.copy(up.quaternion).multiply(fo.quaternion).invert();
    ha.quaternion.copy(_q).multiply(_q2);
    // 手首は曲がりすぎない
    const ang = 2 * Math.acos(clamp(Math.abs(ha.quaternion.w), 0, 1));
    if (ang > 1.25) ha.quaternion.slerp(_q.identity(), 1 - 1.25 / ang);
  }

  // ---------- 顔 ----------
  updateFace(dt) {
    const b = this.blink, F = this.face;
    b.t -= dt;
    if (b.phase < 0 && b.t <= 0) b.phase = 0;
    if (b.phase >= 0) {
      b.phase += dt;
      const T = 0.14;
      b.v = b.phase < T * 0.4 ? b.phase / (T * 0.4) : Math.max(0, 1 - (b.phase - T * 0.4) / (T * 0.6));
      if (b.phase >= T) { b.phase = -1; b.v = 0; b.t = Math.random() < 0.15 ? 0.12 : 1.6 + Math.random() * 3.8; }
    }
    // 口: 文字ごとの形を短く保つ
    const M = this.mouth;
    M.hold -= dt;
    let mouth = M.hold > 0 ? M.shape : 0;
    const mood = this.mood;
    let eyes = 0, brow = 0, tilt = 0;
    if (mood === 'happy') { eyes = M.hold > 0 ? 0 : 1; if (!mouth) mouth = 3; }
    else if (mood === 'laugh') { eyes = 1; mouth = M.hold > 0 ? (mouth ? 3 : 1) : 3; }
    else if (mood === 'wink') { eyes = 2; if (!mouth) mouth = 3; }
    else if (mood === 'think') { eyes = this.id === 'isogai' ? 2 : 0; brow = 0.0025; tilt = -0.05; }
    else if (mood === 'surprise') { brow = 0.0045; if (!mouth) mouth = 2; }
    else if (mood === 'trouble') { brow = 0.001; tilt = -0.09; }
    else if (mood === 'smile') { if (!mouth) mouth = 0; }
    F.uBlink.value = eyes === 0 || (eyes === 2 && this.C === CHARS.natsumi) ? b.v : 0;
    F.uEyes.value = eyes;
    F.uMouth.value = mouth;
    F.uBrow.value = damp(F.uBrow.value, brow, 10, dt);
    F.uBrowTilt.value = damp(F.uBrowTilt.value, tilt, 10, dt);
    F.uLook.value.set(this.look.eyeX, this.look.eyeY);
  }

  // ---------- ポニーテール: 頭の加速度と傾きでばねのように揺れる ----------
  updatePony(dt) {
    const P = this.pony;
    if (!P) return;
    const head = this.bones.head;
    const p = head.getWorldPosition(_w);
    if (!P.prev) { P.prev = p.clone(); return; }
    _a.subVectors(p, P.prev).divideScalar(dt);
    P.prev.copy(p);
    _b.subVectors(_a, P.vel).divideScalar(dt);
    P.vel.copy(_a);
    if (_b.length() > 40) _b.setLength(40);
    P.acc.lerp(_b, 1 - Math.exp(-dt * 20));
    head.getWorldQuaternion(_q).invert();
    // 重力の向き（頭のローカル）と、静止時の下向きとの差 → 垂れる向きへずらす
    _c.set(0, -1, 0).applyQuaternion(_q);
    _d.set(_c.x * 0.2, (_c.y + 1) * 0.2, _c.z * 0.2);
    // 加速と反対へ
    _v.copy(P.acc).applyQuaternion(_q).multiplyScalar(-0.012);
    _d.add(_v);
    // ばね
    const K = 55, Dm = 5.5;
    P.v.x += (K * (_d.x - P.x.x) - Dm * P.v.x) * dt;
    P.v.y += (K * (_d.y - P.x.y) - Dm * P.v.y) * dt;
    P.v.z += (K * (_d.z - P.x.z) - Dm * P.v.z) * dt;
    P.x.addScaledVector(P.v, dt);
    if (P.x.length() > 0.12) P.x.setLength(0.12);
    // ゆるい風
    const wind = Math.sin(this.time * 1.3) * 0.004 + Math.sin(this.time * 3.1) * 0.002;
    P.u.uSwing.value.set(P.x.x + wind, P.x.y, P.x.z);
  }
}

// v1, v2（直交化する）から回転行列の基底 [v1, v2, v1×v2]
const _bx = V(), _by = V(), _bz = V();
function basis(m, v1, v2) {
  _bx.copy(v1).normalize();
  _by.copy(v2).addScaledVector(_bx, -v2.dot(_bx)).normalize();
  _bz.crossVectors(_bx, _by);
  return m.makeBasis(_bx, _by, _bz);
}
