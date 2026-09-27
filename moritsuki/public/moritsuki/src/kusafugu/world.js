// 夜の南の浜: 地形・夜空・月あかり・ヘッドライト・水の計算をまとめる
import * as THREE from 'three';
import { U } from './shade.js';
import { NightSky } from './sky.js';
import { Beach } from './beach.js';
import { Waves, Murk } from './water.js';

const HEAD_I = 2.1;            // ヘッドライトの明るさ（光度）
export const HEAD_DECAY = 1.4; // 距離での弱まり（2 だと手元だけ真っ白に飛ぶので、目がなれた見え方に寄せて緩める）
const HEAD_ANGLE = 0.72;       // 光の輪の外の半角（広めのワイドビーム）
const HEAD_DOWN = 0.26;        // 目線より少し下を照らす（手もとが輪の中に入るように）

export class World {
  constructor(scene, renderer) {
    this.scene = scene;
    this.renderer = renderer;
    this.tide = 0;
    this.headOn = 1;
    this._w = {};
  }

  async build(progress) {
    const scene = this.scene;
    progress?.(0.05, '浜の砂をならしています');
    await tick();
    this.beach = new Beach();
    scene.add(this.beach.group);
    this.waves = new Waves(this.beach);
    this.murk = new Murk();

    progress?.(0.3, '夜空に星をまいています');
    await tick();
    this.sky = new NightSky();
    scene.add(this.sky.mesh);

    // 月あかり: 南東の空、低め。青白く、ごく弱い
    this.moon = new THREE.DirectionalLight('#a9bde3', 0.07);
    scene.add(this.moon, this.moon.target);
    this.hemi = new THREE.HemisphereLight('#2a3a5c', '#0c0b09', 0.07);
    scene.add(this.hemi);
    this.setMoon(0);

    // ヘッドライト（おでこ）: 手元の砂と水の中を照らす。手の影を落とす
    const hl = (this.head = new THREE.SpotLight('#fff4e4', HEAD_I, 0, HEAD_ANGLE, 0.55, HEAD_DECAY));
    hl.castShadow = true;
    hl.shadow.mapSize.set(1024, 1024);
    hl.shadow.camera.near = 0.05;
    hl.shadow.camera.far = 9;
    hl.shadow.bias = -0.0006;
    hl.shadow.normalBias = 0.012;
    scene.add(hl, hl.target);
    // ヘッドライトのまわりの弱い光（手もと・腕が真っ黒にならないように）
    this.spill = new THREE.SpotLight('#ffe9d0', HEAD_I * 0.1, 0, 1.15, 0.9, HEAD_DECAY);
    scene.add(this.spill, this.spill.target);
    U.uHeadCone.value.set(Math.cos(HEAD_ANGLE), Math.cos(HEAD_ANGLE * (1 - 0.55)));

    // 濡れた殻・手に映る夜の空
    const pm = new THREE.PMREMGenerator(this.renderer);
    const envScene = new THREE.Scene();
    const envSky = new NightSky();
    envSky.uniforms.uStars.value = 0;
    envSky.mesh.scale.setScalar(0.05);
    envScene.add(envSky.mesh);
    const ground = new THREE.Mesh(new THREE.CircleGeometry(40, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#0b0c0e' }));
    ground.position.y = -1;
    envScene.add(ground);
    this.envMap = pm.fromScene(envScene, 0.02).texture;
    scene.environment = this.envMap;
    scene.environmentIntensity = 0.5;
    pm.dispose();
    progress?.(0.5, '');
  }

  /** 夜の時刻（k = 0: 20:30 → 1: 21:00）で月の位置を決める */
  setMoon(k) {
    const az = THREE.MathUtils.degToRad(146 + k * 5); // 北から時計回り
    const el = THREE.MathUtils.degToRad(22 + k * 3);
    const v = U.uSunDir.value.set(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)).normalize();
    this.moonDir = v;
  }

  /**
   * ヘッドライトを頭（カメラ）に合わせる。on = 0..1
   * subject: 照らしている物までの距離（m）。近い物ほど暗くして、目がなれたように見せる
   */
  aimHead(cam, on = 1, subject = 0.9) {
    this.headOn = on;
    const hl = this.head;
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(cam.quaternion);
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(cam.quaternion);
    hl.position.copy(cam.position).addScaledVector(up, 0.075).addScaledVector(fwd, 0.04);
    const dir = fwd.clone().applyAxisAngle(right, -HEAD_DOWN).normalize();
    hl.target.position.copy(hl.position).addScaledVector(dir, 3);
    hl.target.updateMatrixWorld();
    const ex = Math.min(1.3, Math.max(0.28, Math.pow(Math.max(subject, 0.2) / 0.9, HEAD_DECAY)));
    this.expo = this.expo === undefined ? ex : this.expo + (ex - this.expo) * 0.12;
    const I = HEAD_I * on * this.expo;
    hl.intensity = I;
    this.spill.position.copy(hl.position);
    this.spill.target.position.copy(hl.position).addScaledVector(dir.clone().lerp(fwd, 0.3).addScaledVector(up, -0.4).normalize(), 3);
    this.spill.target.updateMatrixWorld();
    this.spill.intensity = I * 0.1;
    U.uHeadPos.value.copy(hl.position);
    U.uHeadDir.value.copy(dir);
    U.uHeadI.value = I;
  }

  /** 足もとの水面の高さ */
  waterAt(x, z, t, out = null) { return this.waves.height(x, z, t, this.tide, true, out); }
  groundAt(x, z) { return this.beach.heightAt(x, z); }

  update(dt, t, cam, focus) {
    U.uTime.value = t;
    U.uTide.value = this.tide;
    this.sky.update(cam);
    const f = focus || cam.position;
    const md = this.moonDir;
    this.moon.position.set(f.x + md.x * 20, f.y + md.y * 20, f.z + md.z * 20);
    this.moon.target.position.set(f.x, f.y, f.z);
    this.murk.follow(f.x, f.z);
    this.murk.update(dt, this.waves.flow(f.x, f.z, t, this.tide));
  }
}

const tick = () => new Promise((r) => setTimeout(r, 0));
