// バケツ（獲ったフグを生かしておく）
// ・遊んでいる間は、腰のひもで結んで水に浮かべて引いて歩く（中の水面と、泳ぐフグが見える）
// ・入れたばかりのフグは、ふくらんだまま水面に浮いて、しばらくするとしぼんで泳ぎだす
// ・結果の画面では、ランタンのそばの浜に置く（中を上からのぞく）
// ・トラフグは入りきらない（頭がバケツからはみ出す）
import * as THREE from 'three';
import { patchMaterial } from './shade.js';
import { Fugu } from './fugu.js';
import { clamp, lerp, smoothstep } from './core/noise.js';

const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export const B_R0 = 0.155, B_R1 = 0.125, B_H = 0.27, B_WATER = 0.17; // 口の半径・底の半径・高さ・水の深さ

function bucketGeo() {
  // 外側と内側を 1 枚で（厚み 5mm）。口に丸いふち
  const pts = [];
  const t = 0.005;
  pts.push(new THREE.Vector2(0, 0));
  pts.push(new THREE.Vector2(B_R1 - 0.01, 0));
  pts.push(new THREE.Vector2(B_R1, 0.01));
  for (let i = 1; i <= 8; i++) { const k = i / 8; pts.push(new THREE.Vector2(lerp(B_R1, B_R0, k), k * B_H)); }
  pts.push(new THREE.Vector2(B_R0 + 0.008, B_H + 0.002));
  pts.push(new THREE.Vector2(B_R0 + 0.009, B_H - 0.01));
  pts.push(new THREE.Vector2(B_R0 - t, B_H - 0.004));
  for (let i = 8; i >= 1; i--) { const k = i / 8; pts.push(new THREE.Vector2(lerp(B_R1, B_R0, k) - t, k * B_H * 0.995)); }
  pts.push(new THREE.Vector2(B_R1 - t, t));
  pts.push(new THREE.Vector2(0, t));
  const g = new THREE.LatheGeometry(pts, 40);
  g.computeVertexNormals();
  return g;
}

export class Bucket {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);
    const plastic = patchMaterial(new THREE.MeshStandardMaterial({ color: '#2f7fc4', roughness: 0.42, side: THREE.DoubleSide }), { caustics: true });
    this.shell = new THREE.Mesh(bucketGeo(), plastic);
    this.shell.castShadow = true;
    this.group.add(this.shell);
    // 取っ手（針金と、にぎりの黒い筒）
    const wire = new THREE.MeshStandardMaterial({ color: '#b9bec2', roughness: 0.3, metalness: 0.8 });
    const arc = new THREE.Mesh(new THREE.TorusGeometry(B_R0 + 0.012, 0.0022, 6, 40, Math.PI), wire);
    arc.position.y = B_H;
    this.handle = arc;
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.1, 10), new THREE.MeshStandardMaterial({ color: '#1d1f21', roughness: 0.6 }));
    grip.rotation.z = Math.PI / 2;
    grip.position.y = B_R0 + 0.012;
    arc.add(grip);
    this.group.add(arc);
    // 中の水（ヘッドライトに光る水面。うすく色がつく）
    const wm = patchMaterial(new THREE.MeshStandardMaterial({ color: '#1a3a3c', roughness: 0.04, metalness: 0, transparent: true, opacity: 0.22, depthWrite: false }), {
      caustics: false,
      fx: {
        key: 'bucket-water',
        normal: `{
          vec2 q = vWPos.xz * 60.0;
          vec3 d = vec3(sin(q.x + uTime * 3.0) * 0.08 + sin(q.y * 1.3 - uTime * 2.4) * 0.06, 0.0, cos(q.y + uTime * 2.7) * 0.08 + cos(q.x * 1.1 + uTime * 3.3) * 0.05);
          normal = normalize(normal + (viewMatrix * vec4(d, 0.0)).xyz);
        }`,
      },
    });
    this.water = new THREE.Mesh(new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2), wm);
    this.water.renderOrder = 3;
    this.group.add(this.water);
    // ロープ（腰から）
    this.cord = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 1, 6), new THREE.MeshStandardMaterial({ color: '#d7c9a2', roughness: 0.85 }));
    scene.add(this.cord);
    this.fish = [];
    this.pos = V3();
    this.vel = V3();
    this.mode = 'float';
    this.level = B_WATER;
  }

  setWaterLevel(h) {
    this.level = h;
    const r = lerp(B_R1, B_R0, h / B_H) - 0.006;
    this.water.position.y = h;
    this.water.scale.setScalar(r);
  }

  /** フグを 1 匹入れる（fresh: 入れたばかりで、ふくらんでいる） */
  add(id, cm, seed, fresh = true) {
    const big = id === 'tora';
    const f = new Fugu(id, cm, seed, { lod: !big });
    this.group.add(f.group);
    const a = Math.random() * Math.PI * 2;
    const o = {
      f, big, a, r: Math.random() * 0.06, h: 0.03 + Math.random() * 0.1, sp: (0.5 + Math.random() * 0.6) * (Math.random() < 0.5 ? 1 : -1),
      puff: fresh ? 1 : 0, calm: fresh ? 4 + Math.random() * 5 : 0, t: Math.random() * 10,
    };
    f.setPuff(o.puff);
    this.fish.push(o);
    return o;
  }
  clear() { for (const o of this.fish) { this.group.remove(o.f.group); o.f.dispose(); } this.fish = []; }
  /** 口（入れる所）の世界の位置 */
  mouth() { return this.group.localToWorld(V3(0, B_H + 0.05, 0)); }
  reset() { this.pos.set(0, 0, 0); this.vel.set(0, 0, 0); }

  /** 腰に結んで引く（遊んでいる間） */
  follow(dt, body, t, player) {
    this.placed = false;
    const q = body.fq;
    const want = body.fp.clone().add(V3(0.44, 0, -0.02).applyQuaternion(q));  // 右のわき（前を見ている時は見えない）
    const wy = player.world.waterAt(want.x, want.z, t);
    const g = player.world.groundAt(want.x, want.z);
    // 浮かぶ（中に水と魚が入っているので、ふちの下まで沈む）。浅い所では底につく
    want.y = Math.max(wy - B_H * 0.72, g);
    if (!this.pos.lengthSq()) this.pos.copy(want);
    this.vel.addScaledVector(want.clone().sub(this.pos), dt * 30);
    this.vel.multiplyScalar(Math.exp(-dt * 5));
    this.pos.addScaledVector(this.vel, dt);
    this.group.position.copy(this.pos);
    const tilt = (this.pos.y > g + 0.01 ? 1 : 0.2);
    this.group.rotation.set(Math.sin(t * 1.1) * 0.05 * tilt + this.vel.z * 0.3, player.yaw + 0.5, Math.cos(t * 0.9) * 0.05 * tilt - this.vel.x * 0.3);
    this.handle.rotation.set(0, 0, 0);
    this.handle.rotation.x = -0.9;
    // ロープ: 腰から取っ手へ
    const hip = body.fp.clone().add(V3(0.14, 0.62 - player.crouch * 0.26, 0.04).applyQuaternion(q));
    const top = this.group.localToWorld(V3(0, B_H * 0.9, -0.1));
    const d = hip.clone().sub(top);
    this.cord.visible = true;
    this.cord.position.copy(top).addScaledVector(d, 0.5);
    this.cord.scale.set(1, d.length(), 1);
    this.cord.quaternion.setFromUnitVectors(V3(0, 1, 0), d.normalize());
    this.setWaterLevel(B_WATER);
    this.updateFish(dt);
  }

  /** 浜に置く（結果の画面） */
  place(p, yaw = 0) {
    this.group.position.copy(p);
    this.group.rotation.set(0, yaw, 0);
    this.placed = true;
    this.group.updateMatrixWorld(true);
    this.handle.rotation.set(-1.35, 0, 0);
    this.cord.visible = false;
    this.setWaterLevel(B_WATER);
  }

  /** 中のフグ: 水の中をぐるぐる泳ぐ。入れたばかりのは水面に浮いて、しぼむと泳ぎだす */
  updateFish(dt) {
    const n = this.fish.length;
    for (const o of this.fish) {
      o.t += dt;
      const f = o.f;
      if (o.big && this.placed) {
        // 浜では: バケツに入りきらないので、横の砂の上に寝かせてある（ときどき、ひれを動かす）
        const b = this.bigSpot || V3(-0.32, 0, 0.34);
        f.group.position.set(b.x, f.L * 0.1, b.z);
        f.group.rotation.set(0, (this.bigYaw ?? 1.9), 0.08);
        o.puff = Math.max(0, o.puff - dt * 0.2);
        f.setPuff(o.puff * 0.5 + 0.08);
        f.setWet(0.8);
        f.pose(Math.sin(o.t * 0.7) > 0.6 ? 'swim' : 'rest', dt, { speed: 0.4 });
        continue;
      }
      if (o.big) {
        // トラフグ: 入りきらず、頭がふちからはみ出している
        f.group.position.set(0.02, this.level + 0.04, 0.05);
        f.group.rotation.set(-1.0, 0.4, 0.1 * Math.sin(o.t * 2));
        o.puff = Math.max(0, o.puff - dt * 0.08);
        f.setPuff(o.puff * 0.6);
        f.pose('swim', dt, { speed: 0.6 });
        continue;
      }
      o.calm -= dt;
      if (o.calm > 0) {
        // ふくらんで、腹を上に水面に浮く
        const R = f.radius;
        f.group.position.set(Math.cos(o.a) * o.r, this.level - R * 0.35, Math.sin(o.a) * o.r);
        o.a += dt * 0.15;
        f.group.rotation.set(Math.PI * 0.85, o.a, Math.sin(o.t * 1.3) * 0.2);
        f.pose('float', dt);
      } else {
        o.puff = Math.max(0, o.puff - dt * 0.35);
        // 混んでいるほど、内側も泳ぐ
        const rr = lerp(0.06, B_R1 - 0.05, 0.5 + 0.5 * Math.sin(o.t * 0.3 + o.a * 3)) * (n > 12 ? 0.9 : 1);
        o.a += dt * o.sp * (0.9 / Math.max(rr, 0.05)) * 0.12;
        const hh = clamp(0.03 + o.h + Math.sin(o.t * 0.7) * 0.02, 0.025, this.level - 0.03);
        f.group.position.set(Math.cos(o.a) * rr, hh, Math.sin(o.a) * rr);
        // 進む向き（円の接線）へ
        const yaw = Math.atan2(-Math.sin(o.a) * Math.sign(o.sp), Math.cos(o.a) * Math.sign(o.sp));
        f.group.rotation.set(0, yaw, Math.sin(o.t * 2) * 0.08);
        f.pose('swim', dt, { speed: 0.8 });
      }
      f.setPuff(o.puff);
    }
  }
}
