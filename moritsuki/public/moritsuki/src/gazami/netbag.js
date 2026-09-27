// 腰にぶら下げた網袋（獲るたびにふくらむ。水に浮いて波にゆれる。中でカニがもぞもぞ動く）
import * as THREE from 'three';
import { patchMaterial } from './shade.js';

const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

function netTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 128, 128);
  g.strokeStyle = '#e8ecef';
  g.lineWidth = 5;
  for (let i = -128; i < 256; i += 32) {
    g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 128, 128); g.stroke();
    g.beginPath(); g.moveTo(i + 128, 0); g.lineTo(i, 128); g.stroke();
  }
  // 結び目
  g.fillStyle = '#f4f6f8';
  for (let y = 0; y < 128; y += 32) for (let x = 0; x < 128; x += 32) { g.beginPath(); g.arc(x + 16, y, 4, 0, Math.PI * 2); g.fill(); g.beginPath(); g.arc(x, y + 16, 4, 0, Math.PI * 2); g.fill(); }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(5, 3);
  return t;
}
// 中身: 青いオスと茶色のメスの甲羅が重なったまだら（とげの先が赤い点）
function lumpTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#1b2233';
  g.fillRect(0, 0, 256, 256);
  const cols = ['#27407a', '#2c4a8c', '#4d5a36', '#3e4a2e', '#223a70', '#6a7aa8', '#51402c'];
  for (let i = 0; i < 70; i++) {
    const x = Math.random() * 256, y = Math.random() * 256, w = 16 + Math.random() * 18;
    g.save();
    g.translate(x, y); g.rotate(Math.random() * Math.PI);
    const gr = g.createRadialGradient(-w * 0.2, -w * 0.15, 1, 0, 0, w);
    const col = cols[i % cols.length];
    gr.addColorStop(0, '#9fb6dd'); gr.addColorStop(0.3, col); gr.addColorStop(1, '#0c0f16');
    g.fillStyle = gr;
    g.beginPath(); g.ellipse(0, 0, w, w * 0.45, 0, 0, Math.PI * 2); g.fill();
    // 横のとげ
    g.strokeStyle = col; g.lineWidth = 2.5;
    g.beginPath(); g.moveTo(-w * 1.25, 0); g.lineTo(w * 1.25, 0); g.stroke();
    // 脚
    g.strokeStyle = 'rgba(160,180,220,0.6)'; g.lineWidth = 1.5;
    for (let k = -2; k <= 2; k++) { g.beginPath(); g.moveTo(k * w * 0.3, w * 0.3); g.lineTo(k * w * 0.5, w * 0.8); g.stroke(); }
    g.restore();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export class NetBag {
  constructor(scene) {
    this.group = new THREE.Group();
    scene.add(this.group);
    // 袋: 下がふくらんだしずく形
    const geo = new THREE.SphereGeometry(1, 24, 18);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i);
      const k = 1 - Math.max(0, y) * 0.55;
      p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k);
      p.setY(i, y * 1.25);
    }
    geo.computeVertexNormals();
    this.net = new THREE.Mesh(geo, patchMaterial(new THREE.MeshStandardMaterial({ map: netTexture(), alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.8, color: '#dfe6ea' }), { caustics: true }));
    this.net.castShadow = true;
    this.lump = new THREE.Mesh(new THREE.IcosahedronGeometry(0.9, 2), patchMaterial(new THREE.MeshStandardMaterial({ map: lumpTexture(), roughness: 0.45 }), { caustics: true }));
    this.lump.castShadow = true;
    // 腰ひも
    this.cord = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 1, 6), new THREE.MeshStandardMaterial({ color: '#d0d4d8', roughness: 0.8 }));
    this.group.add(this.net, this.lump, this.cord);
    this.n = 0;
    this.size = 0.05;
    this.pos = V3();
    this.vel = V3();
  }
  set(n) { this.n = n; }
  /** 瞬間移動の後は、ばねで追わずにその場へ */
  reset() { this.pos.set(0, 0, 0); this.vel.set(0, 0, 0); }
  /** 貝を入れる口（世界） */
  mouth() { return this.pos.clone().add(V3(0, this.size * 1.1, 0)); }
  update(dt, body, t, player) {
    const target = Math.min(0.23, 0.05 + Math.sqrt(this.n) * 0.02);
    this.size += (target - this.size) * (1 - Math.exp(-4 * dt));
    // 腰の右後ろ。水面に浮かぶ
    const q = body.fq;
    const hip = body.fp.clone().add(V3(0.2, 0.55 - player.crouch * 0.25, 0.06).applyQuaternion(q));
    const want = body.fp.clone().add(V3(0.26, 0, 0.12).applyQuaternion(q));
    const wy = player.world.waterAt(want.x, want.z, t);
    want.y = Math.max(wy - this.size * 0.55, player.pos.y + this.size * 1.2);
    if (!this.pos.lengthSq()) this.pos.copy(want);
    // ばねでついてくる
    this.vel.addScaledVector(want.clone().sub(this.pos), dt * 40);
    this.vel.multiplyScalar(Math.exp(-dt * 6));
    this.pos.addScaledVector(this.vel, dt);
    this.net.position.copy(this.pos);
    this.net.scale.setScalar(this.size);
    this.net.rotation.set(Math.sin(t * 1.3) * 0.15, t * 0.2, Math.cos(t * 1.1) * 0.12);
    this.lump.visible = this.n > 0;
    this.lump.position.copy(this.pos).add(V3(0, -this.size * 0.2, 0));
    this.lump.scale.set(this.size * 0.82, this.size * 0.7, this.size * 0.82);
    this.lump.rotation.copy(this.net.rotation);
    // 中でカニが動く
    if (this.n > 0) this.lump.rotation.y += Math.sin(t * 5.3) * 0.08 + Math.sin(t * 8.1) * 0.04;
    const top = this.pos.clone().add(V3(0, this.size * 1.2, 0));
    const d = hip.clone().sub(top);
    this.cord.position.copy(top).addScaledVector(d, 0.5);
    this.cord.scale.set(1, d.length(), 1);
    this.cord.quaternion.setFromUnitVectors(V3(0, 1, 0), d.normalize());
  }
}
