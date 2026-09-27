// 腰ビク（竹で編んだ魚かご）: 右の腰にひもでさげる。底は水につかる（獲物が弱らないように）
// 口は細く、上に網のふた。中に入れるとふたがはね、ウナギが入っているとときどきかごがゆれる
import * as THREE from 'three';
import { patchMaterial } from './shade.js';
import { bambooWeave, meshTexture } from './textures.js';
import { levelAt } from './ditch.js';

const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

export class Biku {
  constructor(scene) {
    this.group = new THREE.Group();
    scene.add(this.group);
    const tex = bambooWeave();
    tex.repeat.set(6, 3);
    const weave = patchMaterial(new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7, side: THREE.DoubleSide }), {
      fx: { key: 'biku', rough: 'roughnessFactor = mix(0.75, 0.3, smoothstep(0.03, -0.02, vWPos.y - ditchLevel(vec3(clamp(vWPos.x, -0.55, 0.55), vWPos.y, vWPos.z))));' },
    });
    // 胴: ふくらんだ壺の形（高さ 0.3m）
    const prof = [];
    for (let i = 0; i <= 14; i++) {
      const t = i / 14;
      const r = 0.06 + 0.075 * Math.sin(Math.min(1, t * 1.15) * Math.PI) - (t > 0.8 ? (t - 0.8) * 0.18 : 0);
      prof.push(new THREE.Vector2(Math.max(0.035, r), t * 0.3));
    }
    this.body = new THREE.Mesh(new THREE.LatheGeometry(prof, 20), weave);
    this.body.receiveShadow = true;
    // 底
    const bottom = new THREE.Mesh(new THREE.CircleGeometry(0.06, 16).rotateX(Math.PI / 2), weave);
    this.body.add(bottom);
    // 口の縁（竹の輪）と網のふた
    const rimMat = patchMaterial(new THREE.MeshStandardMaterial({ color: '#6b4f26', roughness: 0.6 }), {});
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.047, 0.007, 6, 18), rimMat);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.3;
    this.body.add(rim);
    const lidTex = meshTexture({ color: '#233020', cells: 6, line: 0.18 });
    this.lid = new THREE.Mesh(new THREE.CircleGeometry(0.05, 16), patchMaterial(new THREE.MeshStandardMaterial({ map: lidTex, alphaTest: 0.3, side: THREE.DoubleSide, roughness: 0.7 }), {}));
    this.lid.geometry.translate(0, 0.05, 0);
    this.lid.rotation.x = -Math.PI / 2;
    this.lidPivot = new THREE.Object3D();
    this.lidPivot.position.set(0, 0.3, -0.05);
    this.lidPivot.add(this.lid);
    this.body.add(this.lidPivot);
    this.group.add(this.body);
    // ひも
    this.cord = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 1, 6), rimMat);
    this.group.add(this.cord);
    this.pos = V3();
    this.vel = V3();
    this.n = 0;
    this.open = 0;
    this.shake = 0;
    this.eels = 0;
  }
  reset() { this.pos.set(0, 0, 0); this.vel.set(0, 0, 0); this.n = 0; this.eels = 0; }
  /** 口（世界） */
  mouth() { return this.body.localToWorld(V3(0, 0.31, 0)); }
  put(n, eels) { this.n += n; this.eels += eels; this.open = 1; this.shake = 1; }
  update(dt, body, player, t) {
    const q = body.fq;
    const hip = body.fp.clone().add(V3(0.2, 0.62 - player.crouch * 0.28, 0.04).applyQuaternion(q));
    const want = body.fp.clone().add(V3(0.23, 0.0, 0.08).applyQuaternion(q));
    const lv = levelAt(player.s);
    // 底が水に 12cm ほどつかる
    want.y = Math.max(lv - 0.12, player.pos.y + 0.02, hip.y - 0.62);
    if (!this.pos.lengthSq()) this.pos.copy(want);
    this.vel.addScaledVector(want.clone().sub(this.pos), dt * 45);
    this.vel.multiplyScalar(Math.exp(-dt * 7));
    this.pos.addScaledVector(this.vel, dt);
    this.body.position.copy(this.pos);
    // ウナギが中で動く
    this.shake = Math.max(0, this.shake - dt * 1.5);
    const wig = (this.eels > 0 ? (Math.max(0, Math.sin(t * 0.9 + 1.3) - 0.7) * 0.12) : 0) + this.shake * 0.08;
    this.body.rotation.set(Math.sin(t * 1.3) * 0.05 + Math.sin(t * 17) * wig, player.yaw + 0.4, Math.cos(t * 1.1) * 0.05 + Math.cos(t * 15) * wig);
    this.open = Math.max(0, this.open - dt * 1.6);
    this.lidPivot.rotation.x = -Math.min(1, this.open * 1.5) * 1.6;
    const top = this.mouth();
    const d = hip.clone().sub(top);
    this.cord.position.copy(top).addScaledVector(d, 0.5);
    this.cord.scale.set(1, d.length(), 1);
    this.cord.quaternion.setFromUnitVectors(V3(0, 1, 0), d.normalize());
  }
}
