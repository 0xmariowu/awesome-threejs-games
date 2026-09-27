// 南の浜の世界: 地形・空・光・水の計算・背景・砂の上の跡をまとめる
import * as THREE from 'three';
import { SkyDome } from '../world/sky.js';
import { U } from './shade.js';
import { Beach } from './beach.js';
import { Waves, Murk } from './water.js';

export class World {
  constructor(scene, renderer) {
    this.scene = scene;
    this.renderer = renderer;
    this.tide = 0;
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

    progress?.(0.3, '空を広げています');
    await tick();
    // 空は銛一本の空（アセット）をそのまま使い、色と太陽はこちらの uniform をつなぐ
    this.sky = new SkyDome();
    const su = this.sky.mesh.material.uniforms;
    for (const k of ['uTime', 'uSunDir', 'uSunCol', 'uSkyZenith', 'uSkyHorizon', 'uAirFogCol']) su[k] = U[k];
    su.uUnder = { value: 0 };
    su.uWaterDeep = { value: new THREE.Color('#0b3a52') };
    scene.add(this.sky.mesh);

    // 光: 真夏の昼前。太陽は南東の高い所
    this.sun = new THREE.DirectionalLight('#fff6ea', 2.9);
    this.sun.castShadow = true;
    const sc = this.sun.shadow.camera;
    sc.left = -4; sc.right = 4; sc.top = 4; sc.bottom = -4; sc.near = 1; sc.far = 40;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.02;
    scene.add(this.sun, this.sun.target);
    this.hemi = new THREE.HemisphereLight('#cfe6ff', '#c9b58c', 1.05);
    scene.add(this.hemi);
    this.setSun(0.35);

    // 金属（アルミの柄・鉄の爪）に映る空
    const pm = new THREE.PMREMGenerator(this.renderer);
    const envScene = new THREE.Scene();
    const envSky = new SkyDome();
    const eu = envSky.mesh.material.uniforms;
    for (const k of ['uTime', 'uSunDir', 'uSunCol', 'uSkyZenith', 'uSkyHorizon', 'uAirFogCol']) eu[k] = U[k];
    eu.uUnder = { value: 0 };
    eu.uWaterDeep = { value: new THREE.Color('#6d7f7a') };
    envSky.mesh.scale.setScalar(0.05);
    envScene.add(envSky.mesh);
    const ground = new THREE.Mesh(new THREE.CircleGeometry(40, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#b8a782' }));
    ground.position.y = -1;
    envScene.add(ground);
    this.envMap = pm.fromScene(envScene, 0.02).texture;
    scene.environment = this.envMap;
    scene.environmentIntensity = 0.55;
    pm.dispose();
    progress?.(0.5, '');
  }

  /** 時刻（d = 0: 10:30 → 1: 12:00）で太陽の位置を決める */
  setSun(d) {
    const az = THREE.MathUtils.degToRad(138 + d * 36); // 北から時計回り
    const el = THREE.MathUtils.degToRad(66 + d * 9);
    const v = U.uSunDir.value.set(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)).normalize();
    this.sunDir = v;
  }

  /** 足もとの水面の高さ */
  waterAt(x, z, t, out = null) { return this.waves.height(x, z, t, this.tide, true, out); }
  groundAt(x, z) { return this.beach.heightAt(x, z); }

  update(dt, t, cam, focus) {
    U.uTime.value = t;
    U.uTide.value = this.tide;
    this.sky.update(cam);
    // 影は主人公のまわりだけ細かく
    const f = focus || cam.position;
    const sd = this.sunDir;
    const snap = 8 / 2048;
    const fx = Math.round(f.x / snap) * snap, fz = Math.round(f.z / snap) * snap;
    this.sun.position.set(fx + sd.x * 20, f.y + sd.y * 20, fz + sd.z * 20);
    this.sun.target.position.set(fx, f.y, fz);
    this.murk.follow(f.x, f.z);
    this.murk.update(dt, this.waves.flow(f.x, f.z, t, this.tide));
  }
}

const tick = () => new Promise((r) => setTimeout(r, 0));
