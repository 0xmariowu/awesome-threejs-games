// ゴム付きの手銛（竹の柄・鉄の三又・黒ゴム。一人称視点のモデルと、溜め→突き→引き戻しの動き）
import * as THREE from 'three';
import { patchMaterial } from './core/shaderPatch.js';
import { clamp, lerp } from './core/noise.js';

const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const HAND = V3(0.16, -0.2, -0.52);
const AIM = V3(0, 0, -4.6);
const SHAFT = 1.62;
const BUTT_BEHIND = 0.16;
export const MIN_CHARGE = 0.12;

const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

// ───────── 形状 ─────────
// 竹の節の位置（尻からの距離）
const NODES = [0.2, 0.55, 0.9, 1.25];
const WRAP0 = SHAFT - 0.13; // 穂先側の黒い巻きの始まり

/** 竹の繊維と節の色むら（u = 周方向、v = 尻→穂先） */
function bambooTexture() {
  const W = 32, H = 1024;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = '#d6bb82';
  g.fillRect(0, 0, W, H);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  // 縦の繊維
  for (let x = 0; x < W; x++) {
    g.fillStyle = rnd() < 0.5 ? `rgba(120,86,40,${0.05 + rnd() * 0.1})` : `rgba(255,240,200,${0.05 + rnd() * 0.12})`;
    g.fillRect(x, 0, 1, H);
  }
  for (let i = 0; i < 40; i++) {
    g.fillStyle = `rgba(110,78,36,${0.08 + rnd() * 0.12})`;
    g.fillRect(Math.floor(rnd() * W), Math.floor(rnd() * H), 1, 20 + rnd() * 120);
  }
  // 日焼けのむら
  for (let i = 0; i < 18; i++) {
    const y = rnd() * H, h = 30 + rnd() * 90;
    const gr = g.createLinearGradient(0, y, 0, y + h);
    gr.addColorStop(0, 'rgba(150,110,50,0)');
    gr.addColorStop(0.5, `rgba(150,110,50,${0.08 + rnd() * 0.1})`);
    gr.addColorStop(1, 'rgba(150,110,50,0)');
    g.fillStyle = gr;
    g.fillRect(0, y, W, h);
  }
  // 節（濃い輪と、そのすぐ上の明るい稜）
  for (const n of NODES) {
    const y = H - (n / SHAFT) * H;
    const gr = g.createLinearGradient(0, y - 18, 0, y + 18);
    gr.addColorStop(0, 'rgba(120,85,40,0)');
    gr.addColorStop(0.45, 'rgba(120,85,40,0.35)');
    gr.addColorStop(0.5, 'rgba(70,48,22,0.85)');
    gr.addColorStop(0.56, 'rgba(255,236,190,0.5)');
    gr.addColorStop(1, 'rgba(120,85,40,0)');
    g.fillStyle = gr;
    g.fillRect(0, y - 18, W, 36);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

/** 回転体（+y が前）。v は長さ方向の実寸にそろえる */
function lathe(samples, seg) {
  const geo = new THREE.LatheGeometry(samples.map(([r, y]) => new THREE.Vector2(r, y)), seg);
  const p = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setY(i, p.getY(i) / SHAFT);
  return geo;
}

function bambooGeometry() {
  const ys = [];
  for (let y = 0; y <= WRAP0 + 0.005; y += 0.02) ys.push(y);
  for (const n of NODES) for (let d = -0.012; d <= 0.0121; d += 0.002) ys.push(n + d);
  ys.sort((a, b) => a - b);
  return lathe(ys.map((y) => {
    let r = 0.0079 - 0.0013 * (y / SHAFT);
    for (const n of NODES) {
      const d = y - n;
      r += 0.0011 * Math.exp(-((d / 0.005) ** 2)) - 0.00035 * Math.exp(-((d / 0.0012) ** 2));
    }
    return [r, y];
  }), 14);
}

/** 穂先側の黒い糸巻き（細かい段）と、鉄の軸へ絞る先端 */
function wrapGeometry() {
  const s = [[0.0072, WRAP0 - 0.002]];
  for (let i = 0; i <= 90; i++) {
    const t = i / 90;
    let r = 0.0084 + 0.00025 * Math.abs(Math.sin(i * 1.7));
    if (t > 0.85) r = lerp(0.0084, 0.0042, (t - 0.85) / 0.15);
    s.push([r, WRAP0 + t * (SHAFT - WRAP0)]);
  }
  return lathe(s, 14);
}

/** 尻の金具（丸い石突き） */
function buttGeometry() {
  const s = [];
  for (let i = 0; i <= 12; i++) {
    const a = (i / 12) * Math.PI / 2;
    s.push([0.0086 * Math.sin(a) + 0.0001, -0.03 + 0.012 * (1 - Math.cos(a))]);
  }
  s.push([0.0086, 0.028], [0.0078, 0.03]);
  return lathe(s, 14);
}

/** 平たく開いた三又（黒い鉄、返し付き） */
function tridentGeometry() {
  const parts = [];
  const add = (g) => parts.push(g.index ? g.toNonIndexed() : g);
  const y0 = SHAFT;
  // 軸
  const stem = new THREE.CylinderGeometry(0.0036, 0.0042, 0.06, 10);
  stem.translate(0, y0 + 0.028, 0);
  add(stem);
  // 付け根の小さなこぶから、三本の歯が扇状に開く
  const knot = new THREE.SphereGeometry(0.0046, 10, 8);
  knot.scale(1.25, 1.3, 0.9);
  knot.translate(0, y0 + 0.058, 0);
  add(knot);
  for (const sx of [-1, 0, 1]) {
    const ang = sx * 0.12;
    const d = new THREE.Vector3(Math.sin(ang), Math.cos(ang), 0);
    const p0 = new THREE.Vector3(sx * 0.0018, y0 + 0.058, 0);
    const p1 = p0.clone().addScaledVector(d, 0.16);
    add(new THREE.TubeGeometry(new THREE.LineCurve3(p0, p1), 4, 0.0021, 7, false));
    // 尖った先
    const tip = new THREE.ConeGeometry(0.0021, 0.024, 7);
    tip.rotateZ(-ang);
    tip.translate(p1.x + d.x * 0.012, p1.y + d.y * 0.012, 0);
    add(tip);
    // 返し（外側・後ろ向き。中央の歯は両側）
    for (const out of sx === 0 ? [-1, 1] : [sx]) {
      const phi = Math.PI + ang - out * 0.5;
      const barb = new THREE.ConeGeometry(0.0015, 0.016, 5);
      barb.rotateZ(-phi);
      const side = new THREE.Vector3(d.y, -d.x, 0).multiplyScalar(out * 0.0034);
      barb.translate(p1.x - d.x * 0.006 + side.x, p1.y - d.y * 0.006 + side.y, 0);
      add(barb);
    }
  }
  let n = 0;
  for (const g of parts) n += g.attributes.position.count;
  const pos = new Float32Array(n * 3), nrm = new Float32Array(n * 3);
  let o = 0;
  for (const g of parts) {
    pos.set(g.attributes.position.array, o * 3);
    nrm.set(g.attributes.normal.array, o * 3);
    o += g.attributes.position.count;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  return geo;
}

/** 銛の本体（竹の柄・黒い巻き・三又・尻金具）。ローカル -z が穂先 */
function spearBody(mat) {
  const mBamboo = mat({ map: bambooTexture(), roughness: 0.46, metalness: 0 });
  const mWrap = mat({ color: '#161616', roughness: 0.55 });
  const mIron = mat({ color: '#1e1f21', metalness: 0.75, roughness: 0.34 });
  const body = new THREE.Group();
  body.rotation.x = -Math.PI / 2; // 部品は +y を前として作る
  body.add(new THREE.Mesh(bambooGeometry(), mBamboo));
  body.add(new THREE.Mesh(wrapGeometry(), mWrap));
  body.add(new THREE.Mesh(tridentGeometry(), mIron));
  // 尻金具と、ゴムを通す環
  body.add(new THREE.Mesh(buttGeometry(), mIron));
  const eye = new THREE.Mesh(new THREE.TorusGeometry(0.0085, 0.0022, 6, 16), mIron);
  eye.rotation.y = Math.PI / 2;
  eye.position.y = -0.036;
  body.add(eye);
  return body;
}

/** 置き物としての銛（結果画面で砂浜に寝かせる） */
export function makeSpearProp() {
  const g = new THREE.Group();
  g.add(spearBody((o) => patchMaterial(new THREE.MeshStandardMaterial(o), { caustics: false })));
  return g;
}

/** 2点を結ぶ円錐台（腕） */
function limb(a, b, ra, rb, m) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rb, ra, a.distanceTo(b), 16, 1, true), m);
  mesh.position.copy(a).add(b).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(V3(0, 1, 0), b.clone().sub(a).normalize());
  return mesh;
}

export class Spear {
  constructor(camera) {
    this.camera = camera;
    this.root = new THREE.Group();
    camera.add(this.root);
    this.dir = AIM.clone().sub(HAND).normalize();
    this.q = new THREE.Quaternion().setFromUnitVectors(V3(0, 0, -1), this.dir);

    const mat = (o) => patchMaterial(new THREE.MeshStandardMaterial(o), { caustics: false });
    const body = spearBody(mat);
    const mRubber = mat({ color: '#1b1b1d', roughness: 0.62 });
    const mGlove = mat({ color: '#2a2f35', roughness: 0.62 });
    const mSleeve = mat({ color: '#141b22', roughness: 0.5, metalness: 0.05 });

    // 銛本体（竹の柄＋黒い巻き＋鉄の三又。ローカル -z が前）
    this.shaft = new THREE.Group();
    this.shaft.add(body);
    this.tipAnchor = new THREE.Object3D();
    this.tipAnchor.position.z = -SHAFT - 0.12;
    this.shaft.add(this.tipAnchor);
    this.shaft.quaternion.copy(this.q);
    this.root.add(this.shaft);

    // ゴム（黒い輪を親指に掛けて引く。尻の環 → 親指の二本）
    this.bands = [0, 1].map(() => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.0034, 0.0034, 1, 7), mRubber);
      this.root.add(m);
      return m;
    });
    this.thumbPoint = HAND.clone().add(V3(-0.013, 0.016, -0.03).applyQuaternion(this.q));

    // 手と腕
    this.hand = new THREE.Group();
    // 手の甲（シャフトの右下）
    const palm = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), mGlove);
    palm.scale.set(0.034, 0.03, 0.05);
    palm.position.set(0.03, -0.016, 0.004);
    palm.rotation.z = 0.5;
    this.hand.add(palm);
    // 指: シャフトを巻くように握る（トーラスの軸 = シャフト）
    for (let i = 0; i < 4; i++) {
      const arc = Math.PI * (1.15 - i * 0.05);
      const fg = new THREE.Mesh(new THREE.TorusGeometry(0.0205, 0.0092, 8, 14, arc), mGlove);
      fg.rotation.z = -0.55;
      fg.position.set(0.004, -0.002, -0.034 + i * 0.019);
      this.hand.add(fg);
      const a = -0.55 + arc;
      const tipS = new THREE.Mesh(new THREE.SphereGeometry(0.0092, 8, 6), mGlove);
      tipS.position.set(0.004 + Math.cos(a) * 0.0205, -0.002 + Math.sin(a) * 0.0205, -0.034 + i * 0.019);
      this.hand.add(tipS);
    }
    const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.0095, 0.038, 4, 8), mGlove);
    thumb.rotation.set(Math.PI / 2, 0, 0);
    thumb.position.set(-0.013, 0.016, -0.05);
    this.hand.add(thumb);
    // 親指の付け根に掛けたゴムの輪
    const loop = new THREE.Mesh(new THREE.TorusGeometry(0.0125, 0.0042, 6, 16), mRubber);
    loop.position.set(-0.013, 0.016, -0.03);
    this.hand.add(loop);
    // 手首の袖口
    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.03, 14), mat({ color: '#2a4c6a', roughness: 0.6 }));
    cuff.rotation.x = Math.PI / 2;
    cuff.position.set(0.03, -0.02, 0.05);
    this.hand.add(cuff);
    this.hand.position.copy(HAND);
    this.hand.quaternion.copy(this.q);
    this.root.add(this.hand);
    // 腕：手首から肘、肩へつながったウェットスーツの袖（カメラ基準。掲げても手と離れない）
    const wrist = HAND.clone().add(V3(0.03, -0.02, 0.06).applyQuaternion(this.q));
    const elbow = V3(0.27, -0.37, -0.2);
    const shoulder = V3(0.32, -0.82, 0.02); // 二の腕は画面の下へ抜ける（掲げても途中で切れて見えない）
    this.root.add(limb(wrist, elbow, 0.03, 0.044, mSleeve));
    const eb = new THREE.Mesh(new THREE.SphereGeometry(0.046, 14, 10), mSleeve);
    eb.position.copy(elbow);
    this.root.add(eb);
    this.root.add(limb(elbow, shoulder, 0.046, 0.056, mSleeve));

    this.state = 'ready';
    this.charge = 0;
    this.s = 0;
    this.t = 0;
    this.power = 0;
    this.reach = 0;
    this.fish = null;
    this.bobT = 0;
    this.raise = 0;
    this.showS = null; // 獲れたよー で掲げている間の銛の出し具合
    this.tipWorld = V3();
    this.prevTipWorld = V3();
    this.visible = true;
    this.hold = -0.0;
    this.updateMatrices();
  }

  /** 銛の伸び s のときの、目から穂先までの距離 */
  tipDist(s) { return HAND.clone().addScaledVector(this.dir, s - BUTT_BEHIND + SHAFT + 0.12).length(); }
  get minRange() { return this.tipDist(-0.6); }
  reachFor(charge) { return this.tipDist(0.6 + 2.1 * charge); }

  get thrusting() { return this.state === 'thrust'; }
  get busy() { return this.state !== 'ready' && this.state !== 'charging'; }

  startCharge() {
    if (this.state !== 'ready') return false;
    this.state = 'charging';
    this.charge = 0;
    return true;
  }

  release() {
    if (this.state !== 'charging') return false;
    if (this.charge < MIN_CHARGE) { this.state = 'ready'; this.charge = 0; return false; }
    this.power = this.charge;
    this.reach = 0.6 + 2.1 * this.power;
    this.state = 'thrust';
    this.t = 0;
    this.from = this.s;
    this.charge = 0;
    return true;
  }

  /** 突きを止める（岩・魚に当たった） */
  stop(keepFish = false) {
    this.state = keepFish ? 'hauling' : 'retract';
    this.t = 0;
    this.from = this.s;
  }

  /** 見た目の長さ len の獲物を銛の先に掲げて見せる時の銛の出し具合（大物は視界をふさがないよう遠くへ） */
  static holdFor(len) {
    return -0.62 + Math.max(0, len - 0.9) * 1.2;
  }

  attach(creature) {
    this.fish = creature;
    this.tipAnchor.attach(creature.root);
    // 大きな獲物は視界をふさがない距離で止める（刺さった所より手前には寄せない）
    this.holdS = Math.min(Math.max(this.s, -0.62), Spear.holdFor(creature.len));
  }

  detachFish() {
    const f = this.fish;
    this.fish = null;
    this.holdS = null;
    if (f) f.root.parent?.remove(f.root);
    return f;
  }

  update(dt, { charging, moving, sprint, t }) {
    this.prevTipWorld.copy(this.tipWorld);
    switch (this.state) {
      case 'charging':
        this.charge = Math.min(1, this.charge + dt / 0.75);
        this.s = lerp(this.s, -0.6 * easeOut(this.charge), 1 - Math.exp(-18 * dt));
        break;
      case 'thrust': {
        this.t += dt;
        const T = 0.07 + 0.06 * this.power;
        const k = clamp(this.t / T, 0, 1);
        this.s = lerp(this.from, this.reach, easeOut(k));
        if (k >= 1) { this.state = 'extended'; this.t = 0; }
        break;
      }
      case 'extended':
        this.t += dt;
        if (this.t > 0.07) { this.state = 'retract'; this.t = 0; this.from = this.s; }
        break;
      case 'retract': {
        this.t += dt;
        const k = clamp(this.t / 0.34, 0, 1);
        this.s = lerp(this.from, 0, easeInOut(k));
        if (k >= 1) { this.state = 'ready'; this.s = 0; }
        break;
      }
      case 'hauling': {
        // 獲物を手元に引き寄せて見せる
        this.t += dt;
        const k = clamp(this.t / 0.45, 0, 1);
        this.s = lerp(this.from, this.holdS ?? -0.62, easeInOut(k));
        break;
      }
      case 'struggle':
        this.s = lerp(this.s, Math.max(0.4, this.holdS ?? 0) + Math.sin(t * 17) * 0.05, 1 - Math.exp(-6 * dt));
        break;
      default:
        this.s = lerp(this.s, this.showS ?? 0, 1 - Math.exp(-10 * dt));
    }
    // ゆらぎ
    this.bobT += dt * (moving ? (sprint ? 8.5 : 5.5) : 1.2);
    const bobA = moving ? 0.008 : 0.003;
    this.root.position.set(Math.sin(this.bobT * 0.5) * bobA, Math.sin(this.bobT) * bobA, 0);
    // 水面では銛を下げておく
    const st = this.stow || 0;
    this.root.position.y -= st * 0.42;
    this.root.position.x += st * 0.08;
    // 掲げる演出
    this.root.rotation.x = this.raise * 0.44 - st * 0.35;
    this.root.rotation.z = this.raise * 0.08;
    this.root.position.x += this.raise * 0.03;
    this.root.position.y += this.raise * -0.06;
    this.root.position.z += this.raise * -0.1;
    this.updateMatrices();
    this.shaft.updateWorldMatrix(true, true);
    this.tipAnchor.getWorldPosition(this.tipWorld);
    if (this.state === 'thrust' && this.t <= dt) this.prevTipWorld.copy(this.tipWorld).addScaledVector(this.worldDir(), -0.3);
  }

  worldDir() {
    return this.dir.clone().applyQuaternion(this.camera.quaternion);
  }

  updateMatrices() {
    const butt = HAND.clone().addScaledVector(this.dir, this.s - BUTT_BEHIND);
    this.shaft.position.copy(butt);
    // ゴム: 尻の環 → 親指に掛けた輪（環の所で細く集まり、親指側で開くV字）
    const hp = this.thumbPoint;
    const eye = butt.clone().addScaledVector(this.dir, -0.036);
    const side = V3(1, 0, 0).applyQuaternion(this.q).multiplyScalar(0.012);
    [1, -1].forEach((sg, i) => {
      const a = eye.clone().addScaledVector(side, sg * 0.3);
      const b = hp.clone().addScaledVector(side, sg * 0.85);
      const m = this.bands[i];
      const mid = a.clone().add(b).multiplyScalar(0.5);
      const len = a.distanceTo(b);
      m.position.copy(mid);
      m.scale.set(1 - clamp(len - 0.3, 0, 0.6) * 0.5, Math.max(len, 0.01), 1 - clamp(len - 0.3, 0, 0.6) * 0.5);
      m.quaternion.setFromUnitVectors(V3(0, 1, 0), b.clone().sub(a).normalize());
      m.visible = len > 0.02;
    });
  }
}
