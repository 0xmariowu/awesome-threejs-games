// 側溝の生き物: 置き方・動き・驚き方・網との関係・目の反射
// ・ウナギ: 水草の陰・垂れた草の下で休む／底を這って探す。足音や網に驚くと、驚かせた物から離れる向きへ逃げて、また隠れる
//   頭の向こうに網を置いて追えば、自分から網へ入る。手前へ引けば、網の口が下をくぐってすくえる
// ・スズキ: 落ち込みの下のたまりで上流を向いて止まる。敏感で、驚くと一気に走る
// ・カニ: ライトが近いとはさみを振り上げて威張る。ゆっくり横歩きで逃げる
// ・テナガエビ・ザリガニ: 驚くと尾をたたんで後ろへはね飛ぶ
// ・ドジョウ: 驚くと泥にもぐる（しばらくしてまた出てくる）
// ・ナマズ: のっそり
// ・カエル: 壁の上・水草の上。近づくと水へ跳びこむ（獲れない）
import * as THREE from 'three';
import { SpineSet, spinePoint } from './spine.js';
import { crabGeo, shrimpGeo, crayfishGeo, frogGeo, critterMaterial, critterDepthMaterial, CRITTER_EYES } from './critters.js';
import { FISH, buildFishGeometry, fishMaterialMaker, fishEye } from './fish/fishmodel.js';
import { SPECIES } from './species.js';
import { Glow } from './glow.js';
import { U } from './shade.js';
import { HW, DROPS, CULVERT, S_BACK, S_END, S_GATE, PIPES, WEEDS, bedAt, levelAt, groundAt, floorC } from './ditch.js';
import { RNG, clamp, lerp, smoothstep } from './core/noise.js';

const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;
const angDiff = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
const S_MIN = S_BACK + 0.4, S_MAX = S_GATE - 0.5;

// 種類ごとの体の型（魚は銛一本の魚の作り方で作った形。r = 体の太さの半分 ÷ 全長）
const BODY = {
  eel: { J: 30, fish: FISH.unagi, r: 0.022, max: 64 },
  loach: { J: 14, fish: FISH.dojo, r: 0.045, max: 24 },
  catfish: { J: 16, fish: FISH.namazu, r: 0.065, max: 6 },
  bass: { J: 12, fish: FISH.suzuki, r: 0.09, max: 8 },
  bassBig: { J: 12, fish: FISH.suzukiBig, r: 0.09, max: 2 },
};
for (const k in BODY) BODY[k].eye = fishEye(BODY[k].fish);
/** 種の体の型（伝説のスズキは模様のちがう別の型） */
const bodyOf = (sp) => (sp.body === 'bass' && sp.legend ? 'bassBig' : sp.body);
const CRIT = {
  crab: { geo: crabGeo, max: 16, eyes: CRITTER_EYES.crab },
  shrimp: { geo: shrimpGeo, max: 70, eyes: CRITTER_EYES.shrimp },
  crayfish: { geo: crayfishGeo, max: 16, eyes: CRITTER_EYES.crayfish },
  frog: { geo: frogGeo, max: 12, eyes: CRITTER_EYES.frog },
};

// 関節の体の群れ（InstancedMesh）
class CritterSet {
  constructor(scene, key, def) {
    this.max = def.max;
    const g = def.geo();
    this.anim = new Float32Array(def.max * 4);
    this.vis = new Float32Array(def.max);
    g.setAttribute('aAnim', new THREE.InstancedBufferAttribute(this.anim, 4).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aVis', new THREE.InstancedBufferAttribute(this.vis, 1).setUsage(THREE.DynamicDrawUsage));
    this.mesh = new THREE.InstancedMesh(g, critterMaterial(key), def.max);
    this.mesh.customDepthMaterial = critterDepthMaterial();
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    scene.add(this.mesh);
    this.used = 0;
    this.m4 = new THREE.Matrix4();
    this.q = new THREE.Quaternion();
  }
  alloc() { const i = this.used++; this.mesh.count = this.used; this.vis[i] = 1; return i; }
  reset() { this.used = 0; this.mesh.count = 0; }
  /** 位置・向き（yaw: +z を前とした y まわり、pitch, roll）・大きさ */
  place(i, x, y, z, yaw, size, pitch = 0, roll = 0) {
    this.q.setFromEuler(new THREE.Euler(pitch, yaw, roll, 'YXZ'));
    this.m4.compose(V3(x, y, z), this.q, V3(size, size, size));
    this.mesh.setMatrixAt(i, this.m4);
  }
  setAnim(i, walkPh, walkAmt, raise, curl) { const a = this.anim; a[i * 4] = walkPh; a[i * 4 + 1] = walkAmt; a[i * 4 + 2] = raise; a[i * 4 + 3] = curl; }
  commit() {
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.geometry.attributes.aAnim.needsUpdate = true;
    this.mesh.geometry.attributes.aVis.needsUpdate = true;
  }
}

// 側溝の中の、ある s での水位・底
const bed = (x, s) => bedAt(clamp(x, -HW, HW), s);
const inReach = (s) => s > S_MIN && s < S_MAX;

export class Fauna {
  constructor(scene, overlay, plants) {
    this.scene = scene;
    this.plants = plants;
    this.sets = {};
    for (const k in BODY) this.sets[k] = new SpineSet(scene, { J: BODY[k].J, max: BODY[k].max, geo: buildFishGeometry(BODY[k].fish), key: k, makeMaterial: fishMaterialMaker(BODY[k].fish) });
    this.crit = {};
    for (const k in CRIT) this.crit[k] = new CritterSet(scene, k, CRIT[k]);
    this.eyes = new Glow(overlay, 520, { renderOrder: 6 });
    this.list = [];
    this.events = [];   // ゲームへの知らせ（しぶき・逃げた など）
  }
  setPR(pr) { this.eyes.setPR(pr); }

  // ───────── 置く ─────────
  spawn(day, { legends = false } = {}) {
    for (const k in this.sets) this.sets[k].reset();
    for (const k in this.crit) this.crit[k].reset();
    this.list = [];
    const rng = (this.rng = new RNG(day * 7919 + 17));
    const hides = this.plants.hideSpots;
    // s の選び方: 上流ほど多い
    const pickS = (a = 1, b = S_END - 1) => {
      for (let k = 0; k < 20; k++) {
        const s = rng.range(a, b);
        if (rng.next() < 0.45 + 0.55 * (s / 100)) return s;
      }
      return rng.range(a, b);
    };
    const nearHide = (kinds) => {
      const cand = hides.filter((h) => kinds.includes(h.kind) && inReach(h.s) && h.s > 2);
      if (!cand.length) return null;
      // 上流の方を少し多く
      for (let k = 0; k < 10; k++) { const h = rng.pick(cand); if (rng.next() < 0.5 + 0.5 * (h.s / 100)) return h; }
      return rng.pick(cand);
    };
    // ウナギ
    const eelCm = () => {
      const r = rng.next();
      if (r < 0.17) return rng.range(21, 29.5);          // 小さいの（逃がす）
      return lerp(30, 76, Math.pow(rng.next(), 1.35));
    };
    for (let i = 0; i < 48; i++) {
      // 半分ほどは開けた底（夜はエサを探して出てくる）。残りは隠れ場所から体を出している
      const h = rng.chance(0.55) ? nearHide(['hang', 'sekisho', 'ebimo', 'cress', 'stone', 'pipe', 'pool']) : null;
      const s = h ? h.s + rng.range(-0.3, 0.3) : pickS(3);
      const x = h ? clamp(h.x * rng.range(0.4, 0.85) + rng.range(-0.08, 0.08), -HW + 0.08, HW - 0.08) : rng.range(-HW + 0.12, HW - 0.12);
      this.addSpine('unagi', eelCm(), x, s, rng.range(0, TAU), rng.chance(0.55) ? 'rest' : 'forage', h);
    }
    // 最初の数メートルに、見つけやすいのを 1 匹（はじめての人向け）
    this.addSpine('unagi', 46, 0.12, 5.2, Math.PI * 0.9, 'rest', null);
    // スズキ（落ち込みの下のたまりで、上流を向く）
    for (const d of DROPS) for (let k = 0; k < 2; k++) this.addSpine('suzuki', rng.range(26, 54), rng.range(-0.3, 0.3), d.s - rng.range(0.4, 1.4), Math.PI, 'hold');
    this.addSpine('suzuki', rng.range(24, 40), 0.1, rng.range(62.5, 66), Math.PI, 'hold');
    // ドジョウ（泥のたまる壁ぎわ）
    for (let i = 0; i < 16; i++) {
      const s = pickS(4), side = rng.chance(0.5) ? 1 : -1;
      this.addSpine('dojo', rng.range(8, 17), side * rng.range(0.25, 0.5), s, rng.range(0, TAU), 'rest');
    }
    // ナマズ
    for (let i = 0; i < 3; i++) {
      const h = nearHide(['cress', 'pool', 'ebimo']);
      const s = h ? h.s : pickS(20);
      this.addSpine('namazu', rng.range(30, 58), h ? h.x * 0.8 : 0, s, rng.range(0, TAU), 'rest', h);
    }
    // 伝説
    if (legends) {
      const where = rng.chance(0.5) ? { s: 60 + rng.range(-1.5, 1.5), x: 0.2 } : { s: S_END - 0.6, x: -0.2 };
      this.addSpine('nushiUnagi', rng.range(108, 124), where.x, where.s, Math.PI * 0.5, 'rest');
      this.addSpine('nushiSuzuki', rng.range(82, 94), 0, DROPS[1].s - 1.0, Math.PI, 'hold');
    }
    // カニ（壁ぎわ・パイプ・水門）
    for (let i = 0; i < 12; i++) {
      const pp = rng.chance(0.4) ? rng.pick(PIPES) : null;
      const s = pp ? pp.s + rng.range(-0.5, 0.5) : i < 2 ? S_END - rng.range(0, 1.5) : pickS(6);
      const side = pp ? pp.side : rng.chance(0.5) ? 1 : -1;
      this.addCrit('mokuzu', 'crab', rng.range(4.5, 9), side * rng.range(0.35, 0.5), s);
    }
    // テナガエビ（どこにでも。水草に多い）
    for (let i = 0; i < 62; i++) {
      const h = rng.chance(0.6) ? nearHide(['ebimo', 'sekisho', 'cress', 'stone', 'hang']) : null;
      const s = h ? h.s + rng.range(-0.4, 0.4) : pickS(2);
      const x = h ? clamp(h.x + rng.range(-0.2, 0.2), -HW + 0.05, HW - 0.05) : rng.range(-HW + 0.05, HW - 0.05);
      this.addCrit('tenaga', 'shrimp', rng.range(5, 11), x, s);
    }
    // ザリガニ
    for (let i = 0; i < 12; i++) {
      const h = nearHide(['sekisho', 'ebimo', 'cress']);
      const s = h ? h.s + rng.range(-0.4, 0.4) : pickS(3);
      this.addCrit('zarigani', 'crayfish', rng.range(6, 12), h ? h.x : rng.range(-0.4, 0.4), s);
    }
    // カエル（壁の上）
    for (let i = 0; i < 11; i++) {
      const s = pickS(2), side = rng.chance(0.6) ? 1 : -1;
      this.addCrit(null, 'frog', rng.range(0.08, 0.12) * 100, side * (HW + 0.06), s, true);
    }
    for (const k in this.sets) this.sets[k].commit();
    for (const k in this.crit) this.crit[k].commit();
  }

  addSpine(id, cm, x, s, yaw, state, hide = null) {
    const sp = SPECIES[id];
    const kind = bodyOf(sp);
    const set = this.sets[kind];
    if (set.used >= set.max) return null;
    const L = cm / 100 * (kind === 'bass' ? 1.0 : 1.0);
    const row = set.alloc(L, this.rng.next());
    const J = set.J;
    const c = {
      id, sp, kind, cm: Math.round(cm * 10) / 10, L, set, row, J, seg: L / (J - 1), r: BODY[kind].r * L,
      pts: Array.from({ length: J }, () => V3()), ups: Array.from({ length: J }, () => V3(0, 1, 0)), disp: null,
      dir: V3(-Math.sin(yaw), 0, -Math.cos(yaw)), speed: 0, ph: this.rng.range(0, 10), state, stT: this.rng.range(2, 12), alarm: 0,
      hide, home: { x, s }, active: true, t: 0, wig: 0, seed: this.rng.next(), eyeK: 0, gone: false,
    };
    // 最初の形: 頭から後ろへ、ゆるいS字で置く
    const hx = x, hz = -s;
    let px = hx, pz = hz;
    let a = Math.atan2(-c.dir.x, -c.dir.z);
    const bend = this.rng.range(-1, 1);
    for (let j = 0; j < J; j++) {
      const t = j / (J - 1);
      if (j > 0) {
        a += (Math.sin(t * 5 + c.ph) * 0.35 + bend * 0.12) * (kind === 'eel' ? 7 : 3) / (J - 1);
        px += Math.sin(a) * c.seg; pz += Math.cos(a) * c.seg;
      }
      const cx = clamp(px, -HW + c.r, HW - c.r);
      c.pts[j].set(cx, bed(cx, -pz) + c.r * 0.8, pz);
    }
    if (kind === 'bass' || kind === 'bassBig') { c.pts.forEach((p) => (p.y = bed(p.x, -p.z) + 0.1 + c.L * 0.12)); c.disp = c.pts.map((p) => p.clone()); }
    this.list.push(c);
    this.writeSpine(c);
    return c;
  }

  addCrit(id, kind, cm, x, s, isFrog = false) {
    const set = this.crit[kind];
    if (set.used >= set.max) return null;
    const i = set.alloc();
    const L = kind === 'crab' ? cm / 100 : kind === 'frog' ? cm / 100 : cm / 100 * 0.85;
    const y = isFrog ? groundAt(s) + 0.02 : bed(x, s);
    const c = {
      id, sp: id ? SPECIES[id] : null, kind, cm: Math.round(cm * 10) / 10, L, set, i, crit: true, frog: isFrog,
      x, y, z: -s, yaw: this.rng.range(0, TAU), speed: 0, state: isFrog ? 'sit' : 'rest', stT: this.rng.range(1, 8),
      walkPh: 0, walkAmt: 0, raise: 0, curl: 0, vy: 0, alarm: 0, t: 0, seed: this.rng.next(), active: true, gone: false, home: { x, s },
    };
    if (isFrog) c.yaw = x > 0 ? -Math.PI / 2 : Math.PI / 2;  // 側溝の方を向く
    this.list.push(c);
    this.placeCrit(c);
    return c;
  }

  // ───────── 描く ─────────
  writeSpine(c) {
    const pts = c.disp || c.pts;
    for (let j = 0; j < c.J; j++) {
      const a = pts[Math.max(0, j - 1)], b = pts[Math.min(c.J - 1, j + 1)];
      const T = a.clone().sub(b).normalize();
      const u = c.ups[j];
      if (!c.upOverride) u.set(0, 1, 0);
      u.addScaledVector(T, -u.dot(T));
      if (u.lengthSq() < 1e-6) u.set(1, 0, 0);
      u.normalize();
    }
    c.set.write(c.row, pts, c.ups);
  }
  placeCrit(c) {
    const size = c.L;
    c.set.place(c.i, c.x, c.y, c.z, c.yaw, size, c.pitch || 0, c.roll || 0);
    c.set.setAnim(c.i, c.walkPh, c.walkAmt, c.raise, c.curl);
    c.set.vis[c.i] = c.gone ? 0 : 1;
  }

  // ───────── 動かす ─────────
  /**
   * ctx: { t, player: { pos, speed, noise }, net: Net, cam, murk, fx, ripple(x,z,s) }
   */
  update(dt, ctx) {
    const P = ctx.player.pos;
    const ps = -P.z;
    for (const c of this.list) {
      if (c.gone) continue;
      const s = c.crit ? -c.z : -c.pts[0].z;
      c.near = Math.abs(s - ps) < 26;
      if (!c.near && c.state !== 'bag' && c.state !== 'held') continue;
      c.t += dt;
      if (c.crit) this.updateCrit(c, dt, ctx);
      else this.updateSpine(c, dt, ctx);
    }
    for (const k in this.sets) this.sets[k].commit();
    for (const k in this.crit) this.crit[k].commit();
    this.updateEyes(ctx);
  }

  /** 驚かせる物（足・網）からの「こわさ」: 近さと速さ */
  threat(c, hx, hz, ctx) {
    const P = ctx.player.pos, net = ctx.net;
    const body = c.sp?.body;
    const sens = c.sp ? (body === 'bass' ? 2.0 : body === 'eel' ? 0.75 : body === 'loach' ? 1.1 : body === 'catfish' ? 0.6 : 1) : 1;
    const feetSens = body === 'bass' ? 1.3 : sens;
    // 網への気づきやすさ（夜のウナギ・ナマズはのんびりしていて、枠が体にふれるまで気づかないことが多い）
    const netSens = (ctx.player.sneak ? 0.7 : 1) * (body === 'bass' ? 1.35 : body === 'eel' ? 0.42 : body === 'catfish' ? 0.38 : body === 'loach' ? 0.55 : body === 'shrimp' ? 0.45 : 0.55);
    let th = 0, sx = 0, sz = 0;
    // 足: 歩く速さで水が揺れる
    const dp = Math.hypot(hx - P.x, hz - P.z);
    const R = (0.32 + ctx.player.noise * 1.3) * feetSens;
    if (dp < R) { const k = (1 - dp / R); th += k * k * 2.2; sx += (hx - P.x) / (dp + 1e-3) * k; sz += (hz - P.z) / (dp + 1e-3) * k; }
    // 網: 水の中で動く枠（速いほど水が押されて気づかれる）
    if (net.inWater) {
      const dn = Math.hypot(hx - net.C.x, hz - net.C.z);
      const v = Math.min(net.vel.length(), 2);
      const Rn = (0.12 + v * 0.22) * netSens;
      if (dn < Rn) { const k = 1 - dn / Rn; th += k * (0.25 + v * 1.4); sx += (hx - net.C.x) / (dn + 1e-3) * k * 1.5; sz += (hz - net.C.z) / (dn + 1e-3) * k * 1.5; }
    }
    // 網を入れた時のしぶき
    if (net.splashT < 0.3) {
      const dd = Math.hypot(hx - net.C.x, hz - net.C.z);
      const Rs = 0.55 * netSens;
      if (dd < Rs) th += (1 - dd / Rs) * 1.2 * net.splashK;
    }
    return { th, sx, sz };
  }

  // ───── 背骨の体 ─────
  updateSpine(c, dt, ctx) {
    const head = c.pts[0];
    const s = -head.z;
    const net = ctx.net;
    const eel = c.kind === 'eel', bass = c.kind === 'bass' || c.kind === 'bassBig', loach = c.kind === 'loach';
    const legend = !!c.sp.legend;
    if (c.state === 'bag' || c.state === 'held') { this.inBag(c, dt, ctx); this.writeSpine(c); return; }
    if (c.state === 'fall') { this.fallBack(c, dt, ctx); this.writeSpine(c); return; }
    if (c.state === 'buried') {
      c.stT -= dt;
      if (c.stT <= 0) { c.state = 'rest'; c.set.setVisible(c.row, true); c.stT = 3; ctx.murk?.add(head.x, head.z, 0.1, 0.2); }
      return;
    }
    // 網に入ったか
    if (net.inWater && !c.stuckCool) {
      let inside = 0, headIn = net.inBag(head);
      for (let j = 0; j < c.J; j += 2) if (net.inBag(c.pts[j])) inside++;
      const frac = inside / Math.ceil(c.J / 2);
      // 袋に入る長さ（約 34cm）より長い体は、頭と前の方が入ればよい
      const need = Math.min(legend ? 0.5 : bass ? 0.5 : 0.42, 0.34 / c.L);
      if ((headIn && frac > need * 0.7) || frac > need + 0.12) {
        c.state = 'bag'; c.bagT = 0; c.escT = (legend ? 1.6 : bass ? 0.9 : eel ? 2.4 : 2.2) * (0.8 + this.rng.next() * 0.4);
        net.catchIn(c);
        this.events.push({ type: 'enter', c });
        return;
      }
    }
    c.stuckCool = Math.max(0, (c.stuckCool || 0) - dt);
    // こわさ
    const { th, sx, sz } = this.threat(c, head.x, head.z, ctx);
    c.alarm = Math.max(c.alarm * Math.exp(-dt * 1.2), th);
    const scared = c.alarm > (bass ? 0.35 : legend ? 1.4 : eel ? 0.9 : 0.8);
    if (scared && c.state !== 'flee') {
      c.state = 'flee';
      c.stT = bass ? 1.0 + this.rng.next() : eel ? this.rng.range(0.9, 2.2) : 1.2;
      // 逃げる向き: こわい物から離れる向き（側溝なので前後が主）
      const l = Math.hypot(sx, sz) || 1;
      let fx = sx / l, fz = sz / l;
      if (Math.abs(fz) < 0.35) fz = (this.rng.chance(0.5) ? 1 : -1) * 0.6;
      c.fleeDir = V3(fx * 0.4, 0, fz).normalize();
      c.react = eel ? this.rng.range(0.25, 0.5) : bass ? 0.05 : c.kind === 'catfish' ? 0.35 : 0.15;
      // ドジョウは泥にもぐる（気づいてから一瞬おいて）
      c.willBury = loach && this.rng.chance(0.55);
      if (c.willBury) c.react = this.rng.range(0.2, 0.4);
      this.events.push({ type: 'flee', c });
    }
    // 状態ごとの動き
    let want = 0, turn = 0;
    const dirA = Math.atan2(c.dir.x, c.dir.z);
    let targetA = dirA;
    c.stT -= dt;
    switch (c.state) {
      case 'rest':
        want = 0;
        if (c.stT <= 0) { c.state = this.rng.chance(eel ? 0.6 : 0.4) ? 'forage' : 'rest'; c.stT = this.rng.range(4, 14); }
        break;
      case 'forage': {
        want = eel ? 0.07 + 0.04 * Math.sin(c.t * 0.3 + c.seed * 9) : bass ? 0.1 : loach ? 0.05 : 0.06;
        // ゆっくりさまよう向き（自分の向きに足すと輪を描いてしまうので、向きそのものをゆっくり変える）
        if (c.wA === undefined) c.wA = dirA;
        c.wA += (Math.sin(c.t * 0.37 + c.seed * 13) * 0.6 + Math.sin(c.t * 0.11 + c.seed * 7) * 0.3) * dt;
        targetA = c.wA;
        // 家（隠れ場所）から離れすぎない
        const dh = Math.hypot(c.home.x - head.x, -c.home.s - head.z);
        if (dh > 2.5) { targetA = Math.atan2(c.home.x - head.x, -c.home.s - head.z); c.wA = targetA; }
        if (c.stT <= 0) { c.state = 'rest'; c.stT = this.rng.range(5, 16); }
        break;
      }
      case 'hold':
        // スズキ: 上流（-z）を向いて、ひれでその場に止まる
        want = 0.02;
        targetA = Math.PI + Math.sin(c.t * 0.4 + c.seed * 5) * 0.15;
        if (Math.abs(-c.home.s - head.z) > 0.6) { targetA = Math.atan2(c.home.x - head.x, -c.home.s - head.z); want = 0.2; }
        break;
      case 'flee': {
        if (c.react > 0) {
          c.react -= dt; want = 0;
          if (c.react <= 0 && c.willBury) {
            c.willBury = false;
            c.state = 'buried'; c.stT = this.rng.range(5, 10);
            c.set.setVisible(c.row, false);
            ctx.murk?.add(head.x, head.z, 0.12, 0.5);
            ctx.fx?.silt(head.x, head.y, head.z, 8);
            this.writeSpine(c);
            return;
          }
          break;
        }
        want = bass ? 2.2 : legend ? 0.7 : eel ? 0.75 : c.kind === 'catfish' ? 0.35 : 0.5;
        targetA = Math.atan2(c.fleeDir.x, c.fleeDir.z);
        turn = 1;
        if (c.stT <= 0) {
          // 近くの隠れ場所で休む
          c.state = 'rest'; c.stT = this.rng.range(6, 14); c.alarm = 0;
          const h = this.plants.nearestHide(head.x, s, 2.5);
          if (h) c.home = { x: h.x, s: h.s };
          else c.home = { x: head.x, s };
          if (bass) { c.state = 'hold'; c.home = { x: 0, s: this.poolNear(s) }; }
        }
        break;
      }
    }
    // 向きを変える
    // ゆっくり泳ぐときは、曲がる半径が体の長さの 1/4 より小さくならないように
    const rate = turn ? (bass ? 9 : 6) : Math.min(1.6, 0.3 + c.speed / (0.25 * c.L));
    const da = clamp(angDiff(dirA, targetA), -rate * dt, rate * dt);
    let na = dirA + da;
    // 壁・端から離れる
    const nx = head.x + Math.sin(na) * 0.08, nzS = -(head.z + Math.cos(na) * 0.08);
    if (Math.abs(nx) > HW - c.r * 1.5) na += Math.sign(angDiff(na, Math.atan2(-Math.sign(nx), 0))) * 3 * dt;
    if (nzS < S_BACK + 0.2 || nzS > S_GATE - 0.3) na += 2.5 * dt;
    c.dir.set(Math.sin(na), 0, Math.cos(na));
    c.speed = lerp(c.speed, want, 1 - Math.exp(-(want > c.speed ? 5 : 3) * dt));
    // 頭を動かす（くねくね: 頭が左右に振れて、体がその道をたどる）
    if (c.speed > 0.005) {
      c.wig += dt * c.speed / Math.max(c.L * 0.55, 0.05) * TAU * (eel ? 1 : bass ? 1.5 : 1.2);
      const amp = (eel ? 0.09 : bass ? 0.04 : 0.06) * c.L;
      const lat = V3(c.dir.z, 0, -c.dir.x);
      const w = Math.cos(c.wig) * amp * (c.wig - (c.wigPrev || 0));
      c.wigPrev = c.wig;
      head.addScaledVector(c.dir, c.speed * dt).addScaledVector(lat, w);
    } else if (eel) {
      // じっとしていても、頭だけ少し動く
      head.x += Math.sin(c.t * 1.3 + c.seed * 10) * 0.0004;
    }
    head.x = clamp(head.x, -HW + c.r, HW - c.r);
    const hs = clamp(-head.z, S_BACK, S_GATE - 0.15);
    head.z = -hs;
    // 落ち込み: 上り下りできる（ウナギは段を這い上がる）
    // 体を頭の道にそわせる
    // 1 節で曲がれる角度に上限（くるりと輪になったり、折れたりしない）。休むとゆっくりほどける
    const maxBend = (eel ? 5.2 : bass ? 2.2 : 3.2) / (c.J - 1);
    const relax = c.speed < 0.02 ? 1 - Math.exp(-dt * 0.25) : 0;
    for (let j = 1; j < c.J; j++) {
      const a = c.pts[j - 1], b = c.pts[j];
      let dx = b.x - a.x, dz = b.z - a.z;
      if (j >= 2) {
        const pa = c.pts[j - 2];
        const pd = Math.atan2(a.x - pa.x, a.z - pa.z);
        let ang = angDiff(pd, Math.atan2(dx, dz));
        if (Math.abs(ang) > maxBend * 0.4) ang *= 1 - relax;
        ang = clamp(ang, -maxBend, maxBend);
        const hl = Math.hypot(dx, dz) || 1e-4;
        dx = Math.sin(pd + ang) * hl; dz = Math.cos(pd + ang) * hl;
      }
      const dy = b.y - a.y;
      const l = Math.hypot(dx, dy, dz) || 1e-4;
      b.set(a.x + dx * c.seg / l, a.y + dy * c.seg / l, a.z + dz * c.seg / l);
    }
    // 底にそわせる（スズキは底から浮いて泳ぐ）
    for (let j = 0; j < c.J; j++) {
      const p = c.pts[j];
      p.x = clamp(p.x, -HW + c.r * 0.6, HW - c.r * 0.6);
      const ss = -p.z;
      const t = j / (c.J - 1);
      const r = c.r * (eel ? (1 - t * 0.7) : 1);
      const b = bed(p.x, ss) + r * 0.85;
      if (bass) {
        const want = Math.min(bed(p.x, ss) + 0.08 + c.L * 0.1, levelAt(ss) - 0.05);
        p.y = lerp(p.y, want, 1 - Math.exp(-4 * dt));
      } else {
        const lift = c.state === 'flee' && j < 3 ? 0.01 : 0;
        p.y = lerp(p.y, b + lift, 1 - Math.exp(-12 * dt));
        p.y = Math.max(p.y, b - 0.005);
      }
    }
    // スズキ: 尾を振る（表示用の位置にだけ足す）
    if (bass) {
      c.beat = (c.beat || 0) + dt * (3 + c.speed * 9);
      const lat = V3(c.dir.z, 0, -c.dir.x);
      for (let j = 0; j < c.J; j++) {
        const t = j / (c.J - 1);
        const A = c.L * (0.012 + 0.09 * t * t) * (0.4 + Math.min(c.speed, 1.5));
        c.disp[j].copy(c.pts[j]).addScaledVector(lat, Math.sin(c.beat - t * 3.2) * A);
      }
    }
    // 泳ぐと泥が舞う・水面に波紋
    if (c.speed > 0.3 && Math.random() < dt * 8) ctx.murk?.add(head.x, head.z, 0.1, 0.06 * (bass ? 0.5 : 1));
    if (c.state === 'flee' && c.speed > 0.4 && Math.random() < dt * (bass ? 10 : 3)) ctx.ripple?.(head.x, head.z, bass ? 0.9 : 0.4);
    this.writeSpine(c);
  }
  poolNear(s) {
    let best = DROPS[0].s - 0.8;
    for (const d of DROPS) if (Math.abs(d.s - 0.8 - s) < Math.abs(best - s)) best = d.s - 0.8;
    return best;
  }

  /** 網の中: 袋の中で丸まって暴れる。水の中のうちは、しばらくすると口から出ていく */
  inBag(c, dt, ctx) {
    const net = ctx.net;
    c.bagT += dt;
    const F = net.frame; // { C, N(口の向き), R: 右, Up }
    const depthMax = net.depth * 0.8;
    const legend = !!c.sp?.legend;
    const thrash = c.state === 'held' ? 1 : 0.6;
    const t = c.t;
    if (c.crit) return;
    // 形: 袋の軸のまわりに巻く（長いほど何周も）
    const J = c.J;
    const along = -1; // 袋は口の向きの反対へ
    const L = c.L;
    const rad = Math.min(net.R * 0.55, 0.03 + L * 0.12);
    const turns = c.kind === 'eel' ? L / (TAU * rad) * 0.7 : 0.25;
    const escK = c.escaping || 0;
    for (let j = 0; j < J; j++) {
      const u = j / (J - 1);
      const th = u * turns * TAU + t * (c.kind === 'eel' ? 2.2 : 0) + Math.sin(t * 7 + u * 9) * 0.5 * thrash;
      let d = lerp(0.06, depthMax, 0.3 + 0.7 * (c.kind === 'eel' ? u : 0.5 + (u - 0.5) * 0.3));
      let rr = rad * (0.6 + 0.4 * Math.sin(u * 5 + t * 3)) + Math.sin(t * 11 + u * 13) * 0.012 * thrash;
      if (c.kind !== 'eel') { rr = (u - 0.5) * Math.min(L, net.R * 1.8) * 0.9; d = depthMax * 0.75 + Math.sin(t * 9) * 0.02 * thrash; }
      // 逃げようとして頭を口へ
      if (escK > 0 && u < 0.35) d = lerp(d, -0.02 - (0.35 - u) * 0.3, escK);
      const p = c.pts[j];
      if (c.kind === 'eel') {
        // 袋のくさりに沿って巻く（袋を突き抜けない）。口から外へ出かけている所だけは口の外
        if (d < 0) p.copy(F.C).addScaledVector(F.N, along * d).addScaledVector(F.R, Math.cos(th) * rr).addScaledVector(F.Up, Math.sin(th) * rr);
        else p.copy(net.bagPoint(d, Math.cos(th) * rr, Math.sin(th) * rr));
      } else {
        // 魚: 袋の底で体を横たえて、ばたばた
        const flop = Math.sin(t * 12 + u * 3) * 0.04 * thrash * (u - 0.5);
        p.copy(net.bagPoint(Math.max(0.02, d), rr, flop - net.R * 0.25, 0.85));
      }
    }
    if (c.disp) c.disp.forEach((q, j) => q.copy(c.pts[j]));
    c.upOverride = true;
    for (let j = 0; j < J; j++) c.ups[j].copy(c.kind === 'eel' ? F.N : F.Up);
    // 水の中なら、いずれ口から出ていく
    if (c.state === 'bag' && net.inWater) {
      c.escT -= dt;
      if (c.escT <= 0) this.escape(c, ctx, 'swim');
    }
  }
  /** 網から出る（swim: 水の中で口から、jump: 持ち上げた網から水へ落ちる） */
  escape(c, ctx, how) {
    const net = ctx.net;
    net.release(c);
    c.upOverride = false;
    c.stuckCool = 1.5;
    c.escaping = 0;
    if (c.crit) {
      // カニ・エビ: 網からこぼれて水へ
      c.state = 'fallc'; c.vx = (Math.random() - 0.5) * 0.6; c.vy = 0.8; c.vz = (Math.random() - 0.5) * 0.6; c.pitch = 0;
      this.events.push({ type: 'escape', c, how });
      return;
    }
    if (how === 'swim') {
      c.state = 'flee'; c.stT = 1.6; c.alarm = 2; c.react = 0;
      c.fleeDir = net.frame.N.clone().setY(0).normalize();
      // 口の外へ体を並べなおす
      const head = c.pts[0];
      head.copy(net.C).addScaledVector(net.frame.N, 0.05);
      head.y = bed(head.x, -head.z) + c.r;
      for (let j = 1; j < c.J; j++) c.pts[j].copy(head).addScaledVector(c.fleeDir, -c.seg * j);
      c.dir.copy(c.fleeDir);
      this.events.push({ type: 'escape', c, how });
    } else {
      c.state = 'fall';
      c.fallV = V3((Math.random() - 0.5) * 0.8, 1.2, (Math.random() - 0.5) * 0.8);
      c.fallT = 0;
      this.events.push({ type: 'escape', c, how });
    }
  }
  /** 網からこぼれて、水へ落ちる */
  fallBack(c, dt, ctx) {
    c.fallT += dt;
    c.fallV.y -= 9.8 * dt;
    const off = c.fallV.clone().multiplyScalar(dt);
    for (const p of c.pts) p.add(off);
    if (c.disp) c.disp.forEach((q, j) => q.copy(c.pts[j]));
    const head = c.pts[0];
    const s = -head.z;
    const lv = levelAt(s);
    if (head.y < lv) {
      ctx.splash?.(head.x, lv, head.z, 0.8);
      c.state = 'flee'; c.stT = 2; c.alarm = 2; c.react = 0;
      c.fleeDir = V3(Math.random() - 0.5, 0, Math.random() < 0.5 ? 1 : -1).normalize();
      c.dir.copy(c.fleeDir);
      for (const p of c.pts) { p.x = clamp(p.x, -HW + c.r, HW - c.r); p.y = Math.max(p.y, bed(p.x, -p.z) + c.r); }
      if (c.crit) { c.x = clamp(head.x, -HW + 0.05, HW - 0.05); c.z = head.z; }
    }
  }

  // ───── 関節の体 ─────
  updateCrit(c, dt, ctx) {
    const net = ctx.net;
    const s = -c.z;
    if (c.frog) return this.updateFrog(c, dt, ctx);
    if (c.state === 'bag' || c.state === 'held') {
      // 袋の底で足をばたつかせる
      const F = net.frame;
      const k = c.bagIdx || 0;
      const p = net.bagPoint(net.depth * 0.6, Math.sin(k * 2.3) * 0.05, -net.R * 0.3 + (k % 3) * 0.02, 0.6);
      c.x = p.x; c.y = p.y; c.z = p.z;
      c.yaw += dt * Math.sin(c.t * 3 + k);
      c.walkPh += dt * 14; c.walkAmt = 1; c.raise = c.kind === 'shrimp' ? 0 : 0.8; c.curl = c.kind === 'crab' ? 0 : 0.5 + 0.5 * Math.sin(c.t * 9);
      c.pitch = Math.sin(c.t * 4) * 0.5;
      if (c.state === 'bag' && net.inWater) { c.escT -= dt; if (c.escT <= 0) { net.release(c); c.state = 'flee'; c.stT = 1; c.stuckCool = 1.5; c.pitch = 0; c.y = bed(c.x, -c.z); } }
      this.placeCrit(c);
      return;
    }
    if (c.state === 'fallc') {
      c.vy -= 9.8 * dt;
      c.y += c.vy * dt; c.x += c.vx * dt; c.z += c.vz * dt;
      c.pitch += dt * 8;
      if (c.y < levelAt(-c.z)) { ctx.splash?.(c.x, levelAt(-c.z), c.z, 0.4); c.state = 'flee'; c.stT = 1; c.pitch = 0; c.x = clamp(c.x, -HW + 0.05, HW - 0.05); c.y = bed(c.x, -c.z); }
      this.placeCrit(c);
      return;
    }
    // 網に入ったか
    c.stuckCool = Math.max(0, (c.stuckCool || 0) - dt);
    if (net.inWater && !c.stuckCool && net.inBag(V3(c.x, c.y + c.L * 0.1, c.z))) {
      c.state = 'bag'; c.escT = c.kind === 'crab' ? 3.5 : 2.5; c.bagIdx = net.catches.length;
      net.catchIn(c);
      this.events.push({ type: 'enter', c });
      return;
    }
    const { th, sx, sz } = this.threat(c, c.x, c.z, ctx);
    c.alarm = Math.max(c.alarm * Math.exp(-dt * 1.5), th);
    c.stT -= dt;
    const shrimpy = c.kind === 'shrimp' || c.kind === 'crayfish';
    // ライトが近いとはさみを上げる（カニ・ザリガニ）
    const toLamp = Math.hypot(c.x - U.uLampPos.value.x, c.z - U.uLampPos.value.z);
    const lit = U.uLampI.value > 1 && toLamp < 1.6;
    const wantRaise = c.kind === 'crab' ? (lit || c.alarm > 0.3 ? 1 : 0.1) : c.kind === 'crayfish' ? (c.alarm > 0.2 ? 1 : 0.2) : 0;
    c.raise = lerp(c.raise, wantRaise, 1 - Math.exp(-4 * dt));
    if (c.state === 'jump') {
      // 尾をたたんで後ろへはね飛ぶ
      c.jt += dt;
      const k = c.jt / 0.35;
      c.curl = Math.sin(Math.min(k, 1) * Math.PI);
      const v = (1 - Math.min(k, 1)) * c.jv;
      c.x -= Math.sin(c.yaw) * v * dt; c.z -= Math.cos(c.yaw) * v * dt;
      c.x = clamp(c.x, -HW + 0.04, HW - 0.04);
      c.y = bed(c.x, -c.z) + Math.sin(Math.min(k, 1) * Math.PI) * 0.05;
      if (k >= 1.2) { c.state = 'rest'; c.stT = this.rng.range(3, 8); c.alarm = 0; c.curl = 0; }
    } else if (c.alarm > (c.kind === 'crab' ? 0.9 : 0.7) && c.state !== 'flee') {
      if (shrimpy) {
        c.state = 'jump'; c.jt = 0; c.jv = c.kind === 'shrimp' ? this.rng.range(1.4, 2.4) : this.rng.range(1.0, 1.6);
        // 驚かせた物の方に頭を向けて、後ろへ跳ぶ
        c.yaw = Math.atan2(-sx, -sz);
        ctx.murk?.add(c.x, c.z, 0.08, 0.08);
        this.events.push({ type: 'hop', c });
      } else {
        c.state = 'flee'; c.stT = 1.5; c.fleeA = Math.atan2(sx, sz);
      }
    } else if (c.state === 'flee') {
      // 横歩きで逃げる（カニ）
      const sp = c.kind === 'crab' ? 0.14 : 0.1;
      c.x += Math.sin(c.fleeA) * sp * dt; c.z += Math.cos(c.fleeA) * sp * dt;
      c.walkPh += dt * 12; c.walkAmt = 1;
      c.yaw = lerp(c.yaw, c.fleeA + Math.PI / 2, 1 - Math.exp(-3 * dt));
      if (c.stT <= 0) { c.state = 'rest'; c.stT = 4; c.alarm = 0; }
    } else {
      // ときどき少し歩く
      if (c.state === 'rest' && c.stT <= 0) { c.state = 'walk'; c.stT = this.rng.range(0.8, 2.5); c.wa = c.yaw + this.rng.range(-1, 1); }
      if (c.state === 'walk') {
        const sp = c.kind === 'crab' ? 0.05 : 0.03;
        c.x += Math.sin(c.wa) * sp * dt; c.z += Math.cos(c.wa) * sp * dt;
        c.walkPh += dt * 8; c.walkAmt = 1;
        c.yaw = lerp(c.yaw, c.kind === 'crab' ? c.wa + Math.PI / 2 : c.wa, 1 - Math.exp(-2 * dt));
        if (c.stT <= 0) { c.state = 'rest'; c.stT = this.rng.range(3, 10); }
      } else c.walkAmt = lerp(c.walkAmt, 0, 1 - Math.exp(-5 * dt));
    }
    c.x = clamp(c.x, -HW + 0.04, HW - 0.04);
    c.z = -clamp(-c.z, S_BACK, S_GATE - 0.2);
    if (c.state !== 'jump') c.y = bed(c.x, -c.z);
    this.placeCrit(c);
  }

  updateFrog(c, dt, ctx) {
    const P = ctx.player.pos;
    const d = Math.hypot(c.x - P.x, c.z - P.z);
    if (c.state === 'sit') {
      c.curl = 0;
      if (d < 1.1 + ctx.player.noise * 0.8 || (ctx.net.inWater && Math.hypot(c.x - ctx.net.C.x, c.z - ctx.net.C.z) < 0.4)) {
        // 水へ跳びこむ
        c.state = 'leap'; c.vy = 1.6; c.vx = -Math.sign(c.x) * 0.9; c.vz = (Math.random() - 0.5) * 0.8;
        c.yaw = Math.atan2(c.vx, c.vz);
        this.events.push({ type: 'frog', c });
      }
    } else if (c.state === 'leap') {
      c.vy -= 9.8 * dt;
      c.x += c.vx * dt; c.y += c.vy * dt; c.z += c.vz * dt;
      c.curl = 1; c.pitch = -0.4;
      const lv = levelAt(-c.z);
      if (c.y < lv && Math.abs(c.x) < HW) {
        ctx.splash?.(c.x, lv, c.z, 0.45);
        ctx.ripple?.(c.x, c.z, 1.2);
        this.events.push({ type: 'plop', c });
        c.state = 'swim'; c.stT = 2.5; c.y = lv - 0.02; c.pitch = 0;
      }
    } else if (c.state === 'swim') {
      // 水面を少し泳いで、もぐって消える
      c.stT -= dt;
      c.z += Math.cos(c.yaw) * 0.25 * dt; c.x += Math.sin(c.yaw) * 0.25 * dt;
      c.x = clamp(c.x, -HW + 0.05, HW - 0.05);
      c.curl = 0.5 + 0.5 * Math.sin(c.t * 8);
      c.y = lerp(c.y, bed(c.x, -c.z), 1 - Math.exp(-dt * (c.stT < 1.2 ? 3 : 0.2)));
      if (c.stT <= 0) { c.gone = true; }
    }
    this.placeCrit(c);
  }

  // ───── 目の反射 ─────
  updateEyes(ctx) {
    const G = this.eyes;
    const lp = U.uLampPos.value, ld = U.uLampDir.value;
    const I = U.uLampI.value;
    const cone = U.uLampCone.value;
    const cam = ctx.cam.position;
    let n = 0;
    const e = V3(), to = V3();
    const put = (p, nrm, col, k, size = 0.004) => {
      to.copy(p).sub(lp);
      const d = to.length();
      to.divideScalar(d);
      const c = smoothstep(cone.x, cone.y, to.dot(ld));
      if (c < 0.01) return;
      const face = nrm ? smoothstep(-0.2, 0.6, -nrm.dot(to)) : 1;
      const b = c * face * I / (d * d + 0.1) * k * 0.55;
      if (b < 0.004) return;
      G.set(n++, p.x, p.y, p.z, col[0], col[1], col[2], Math.min(b, 40), size, 2.1);
    };
    for (const c of this.list) {
      if (c.gone || !c.near || n > G.max - 4) continue;
      if (c.state === 'buried') continue;
      if (c.crit) {
        const eyes = CRIT[c.kind].eyes;
        const col = c.frog ? [0.75, 0.95, 0.55] : c.sp.eye.col;
        const k = c.frog ? 0.9 : c.sp.eye.k;
        const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(c.pitch || 0, c.yaw, 0, 'YXZ'));
        const fwd = V3(0, 0, 1).applyQuaternion(q);
        for (const [x, y, z] of eyes) {
          e.set(x, y, z).applyQuaternion(q).multiplyScalar(c.L).add(V3(c.x, c.y, c.z));
          put(e, fwd.clone().negate().multiplyScalar(-1).add(V3(Math.sign(x) * 0.5, 0.2, 0).applyQuaternion(q)).normalize(), col, k, c.kind === 'shrimp' ? 0.003 : 0.004);
        }
        continue;
      }
      const sp = c.sp;
      if (!sp.eye || sp.eye.k <= 0) continue;
      const pts = c.disp || c.pts;
      const eo = BODY[c.kind].eye;
      for (const sd of [-1, 1]) {
        spinePoint(pts, c.ups, c.L, eo[0], sd * eo[1], eo[2], 0, e);
        const nrmv = spinePoint(pts, c.ups, c.L, eo[0], sd * (eo[1] + 0.02), eo[2], 0.01, V3()).sub(e).normalize();
        put(e, nrmv, sp.eye.col, sp.eye.k, c.kind === 'bass' || c.kind === 'bassBig' ? 0.006 * (sp.legend ? 1.6 : 1) : 0.0035);
      }
    }
    G.commit(n);
  }

  /** 近くの生き物の数（ヒント用） */
  countNear(pos, r, kind = null) {
    let n = 0;
    for (const c of this.list) {
      if (c.gone || c.frog) continue;
      if (kind && c.id !== kind) continue;
      const p = c.crit ? V3(c.x, c.y, c.z) : c.pts[0];
      if (p.distanceTo(pos) < r) n++;
    }
    return n;
  }
  // ───── 結果: たらいの中 ─────
  /** 獲った生き物を、たらいの中に放す（tub: { c: 中心, r: 半径, y: 底, water: 水面 }） */
  showTub(list, tub) {
    for (const k in this.sets) this.sets[k].reset();
    for (const k in this.crit) this.crit[k].reset();
    this.list = [];
    this.tub = tub;
    this.rng = new RNG(4242);
    const rng = this.rng;
    const pick = [...list].sort((a, b) => b.value - a.value).slice(0, 26);
    let k = 0;
    for (const it of pick) {
      const sp = SPECIES[it.id];
      if (!sp) continue;
      if (BODY[sp.body]) {
        const c = this.addSpine(it.id, it.cm, 0, 5, 0, 'tub');
        if (!c) continue;
        c.tubA = rng.range(0, TAU);
        c.tubR = Math.min(tub.r * 0.8, 0.08 + c.L * 0.25) * rng.range(0.7, 1.0);
        c.tubV = (sp.body === 'eel' ? rng.range(0.05, 0.12) : rng.range(0.04, 0.08)) * (rng.chance(0.5) ? 1 : -1);
        c.tubY = tub.y + 0.02 + (k % 3) * 0.02;
        const hx = tub.c.x + Math.cos(c.tubA) * c.tubR, hz = tub.c.z + Math.sin(c.tubA) * c.tubR;
        for (let j = 0; j < c.J; j++) {
          const a = c.tubA - Math.sign(c.tubV) * (j * c.seg) / Math.max(c.tubR, 0.05);
          c.pts[j].set(tub.c.x + Math.cos(a) * c.tubR, c.tubY + c.r * 0.6, tub.c.z + Math.sin(a) * c.tubR);
        }
        void hx; void hz;
        if (c.disp) c.disp.forEach((q, j) => q.copy(c.pts[j]));
        this.writeSpine(c);
      } else {
        const kind = sp.body;
        const c = this.addCrit(it.id, kind, it.cm, 0, 5);
        if (!c) continue;
        const a = rng.range(0, TAU), r = rng.range(0.05, tub.r * 0.75);
        c.x = tub.c.x + Math.cos(a) * r; c.z = tub.c.z + Math.sin(a) * r; c.y = tub.y + 0.005 * k;
        c.state = 'tub'; c.yaw = rng.range(0, TAU);
        this.placeCrit(c);
      }
      k++;
    }
    for (const kk in this.sets) this.sets[kk].commit();
    for (const kk in this.crit) this.crit[kk].commit();
    this.eyes.commit(0);
  }
  updateTub(dt) {
    const tub = this.tub;
    if (!tub) return;
    for (const c of this.list) {
      c.t += dt;
      if (c.crit) {
        c.walkPh += dt * 4; c.walkAmt = 0.3 + 0.3 * Math.sin(c.t * 0.7 + c.seed * 9);
        c.raise = c.kind === 'crab' ? 0.5 + 0.5 * Math.sin(c.t * 0.5 + c.seed * 3) : 0.2;
        c.yaw += dt * 0.2 * Math.sin(c.t * 0.3 + c.seed * 7);
        this.placeCrit(c);
        continue;
      }
      c.tubA += c.tubV * dt / Math.max(c.tubR, 0.05);
      c.wig += dt * 5;
      const head = c.pts[0];
      const wob = Math.sin(c.wig) * 0.015;
      head.set(tub.c.x + Math.cos(c.tubA) * (c.tubR + wob), c.tubY + c.r * 0.6, tub.c.z + Math.sin(c.tubA) * (c.tubR + wob));
      for (let j = 1; j < c.J; j++) {
        const a = c.pts[j - 1], b = c.pts[j];
        const d = b.clone().sub(a);
        const l = d.length() || 1e-4;
        b.copy(a).addScaledVector(d, c.seg / l);
        // たらいの壁の中へ
        const dx = b.x - tub.c.x, dz = b.z - tub.c.z;
        const rr = Math.hypot(dx, dz);
        if (rr > tub.r * 0.95) { b.x = tub.c.x + dx / rr * tub.r * 0.95; b.z = tub.c.z + dz / rr * tub.r * 0.95; }
        b.y = c.tubY + c.r * 0.6;
      }
      if (c.disp) {
        const lat = V3();
        for (let j = 0; j < c.J; j++) {
          const t = j / (c.J - 1);
          const T = c.pts[Math.max(0, j - 1)].clone().sub(c.pts[Math.min(c.J - 1, j + 1)]).normalize();
          lat.set(T.z, 0, -T.x);
          c.disp[j].copy(c.pts[j]).addScaledVector(lat, Math.sin(c.wig * 1.5 - t * 3) * c.L * 0.04 * t * t);
        }
      }
      this.writeSpine(c);
    }
    for (const k in this.sets) this.sets[k].commit();
    for (const k in this.crit) this.crit[k].commit();
  }

  /** 獲られた生き物を消す */
  remove(c) {
    c.gone = true;
    if (c.crit) { c.set.vis[c.i] = 0; }
    else c.set.setVisible(c.row, false);
  }
}
