// 夜の側溝の世界: 側溝・水・空・光（ヘッドライト・月・街灯）をまとめる
import * as THREE from 'three';
import { U } from './shade.js';
import { NightSky } from './sky.js';
import { Channel } from './channel.js';
import { WaterSurface, Murk } from './water.js';
import { Plants } from './plants.js';
import { levelAt, bedAt, groundAt, HW } from './ditch.js';
import { clamp, lerp } from './core/noise.js';

const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

export class World {
  constructor(scene, waterScene, renderer) {
    this.scene = scene;
    this.waterScene = waterScene;
    this.renderer = renderer;
    this.dawn = 0;
  }

  async build(progress) {
    const scene = this.scene;
    progress?.(0.05, 'コンクリートを打っています');
    await tick();
    this.channel = new Channel();
    scene.add(this.channel.group);

    progress?.(0.12, '水草を植えています');
    await tick();
    this.plants = new Plants(scene);

    progress?.(0.2, '水を流しています');
    await tick();
    this.water = new WaterSurface();
    this.waterScene.add(this.water.group);
    this.murk = new Murk();
    this.water.setMurk(this.murk);
    this.jets = this.channel.pipeOut.map((p) => this.water.addJet(p)).filter(Boolean);

    progress?.(0.3, '星を灯しています');
    await tick();
    this.sky = new NightSky();
    scene.add(this.sky.mesh);

    // 月明かり（東の低い細い月。青白く、とても弱い）
    this.moon = new THREE.DirectionalLight('#9fb4e6', 0.05);
    this.moon.position.copy(U.uMoonDir.value).multiplyScalar(50);
    scene.add(this.moon, this.moon.target);
    this.hemi = new THREE.HemisphereLight('#2a3a60', '#0a0c10', 0.12);
    scene.add(this.hemi);

    // ヘッドライト（額の上。視線の少し下を照らす）
    const lamp = (this.lamp = new THREE.SpotLight('#fff3e2', 60, 40, 0.5, 0.55, 2));
    lamp.castShadow = true;
    lamp.shadow.mapSize.set(2048, 2048);
    lamp.shadow.camera.near = 0.08;
    lamp.shadow.camera.far = 30;
    lamp.shadow.bias = -0.00012;
    lamp.shadow.normalBias = 0.012;
    scene.add(lamp, lamp.target);
    // 周りの弱い光（ヘッドライトの反射板からもれる光。円のふちがくっきりしすぎないように）
    this.spill = new THREE.SpotLight('#ffe9d0', 6, 30, 1.05, 0.7, 2);
    this.spill.target = lamp.target;
    scene.add(this.spill);
    this.lampOn = 1;
    this.setLamp({ angle: 0.46, pen: 0.75, intensity: 60 });

    // 金属・水にぬれた物に映る夜空（ほぼ暗い）
    const pm = new THREE.PMREMGenerator(this.renderer);
    const envScene = new THREE.Scene();
    envScene.background = new THREE.Color('#0a1020');
    const hemi = new THREE.Mesh(new THREE.SphereGeometry(10, 16, 8), new THREE.MeshBasicMaterial({ color: '#141c30', side: THREE.BackSide }));
    envScene.add(hemi);
    this.envMap = pm.fromScene(envScene, 0.02).texture;
    scene.environment = this.envMap;
    scene.environmentIntensity = 0.35;
    pm.dispose();
    progress?.(0.4, '');
  }

  setLamp({ angle, pen, intensity }) {
    const l = this.lamp;
    l.angle = angle;
    l.penumbra = pen;
    l.intensity = intensity;
    U.uLampCone.value.set(Math.cos(angle), Math.cos(angle * (1 - pen)));
    U.uLampI.value = intensity;
  }

  /**
   * ヘッドライトをカメラに合わせる（額の少し上から、視線の少し下へ）
   * focus: 照らしている物までの距離（m）。近いと自動で暗くする（ヘッドライトの自動調光のように）
   */
  aimLamp(cam, on = 1, focus = null) {
    const l = this.lamp;
    const up = V3(0, 1, 0).applyQuaternion(cam.quaternion);
    const fwd = V3(0, 0, -1).applyQuaternion(cam.quaternion);
    l.position.copy(cam.position).addScaledVector(up, 0.075).addScaledVector(fwd, 0.04);
    const dir = fwd.clone().addScaledVector(up, -0.12).normalize();
    l.target.position.copy(l.position).addScaledVector(dir, 5);
    l.target.updateMatrixWorld();
    l.visible = on > 0.01;
    // 見ている先までの距離（底の面との交点）
    let d = focus;
    if (d == null) {
      const s = -cam.position.z;
      const b = bedAt(clamp(cam.position.x, -HW, HW), s);
      d = dir.y < -0.05 ? (cam.position.y - b) / -dir.y : 4;
    }
    const auto = clamp((d / 1.4) ** 2, 0.3, 1);
    this.autoK = lerp(this.autoK ?? 1, auto, 0.15);
    l.intensity = this.lampIntensity * on * this.autoK;
    this.spill.position.copy(l.position);
    this.spill.visible = l.visible;
    this.spill.intensity = l.intensity * U.uLampSpill.value;
    U.uLampPos.value.copy(l.position);
    U.uLampDir.value.copy(dir);
    U.uLampI.value = l.intensity;
  }
  get lampIntensity() { return this._li ?? 60; }
  set lampIntensity(v) { this._li = v; }

  /** 夜明け（0: 午前 3 時 → 1: 4 時半） */
  setDawn(k) {
    this.dawn = k;
    const d = clamp((k - 0.45) / 0.55, 0, 1);
    const dd = d * d;
    U.uDawn.value = dd;
    U.uSkyZenith.value.setRGB(lerp(0.002, 0.03, dd), lerp(0.005, 0.05, dd), lerp(0.016, 0.12, dd));
    U.uSkyHorizon.value.setRGB(lerp(0.012, 0.16, dd), lerp(0.018, 0.14, dd), lerp(0.04, 0.2, dd));
    U.uFogCol.value.setRGB(lerp(0.006, 0.07, dd), lerp(0.009, 0.075, dd), lerp(0.018, 0.1, dd));
    this.hemi.intensity = lerp(0.12, 0.9, dd);
    this.hemi.color.setRGB(lerp(0.16, 0.5, dd), lerp(0.23, 0.55, dd), lerp(0.38, 0.7, dd));
    this.moon.intensity = lerp(0.05, 0.02, dd);
    this.scene.environmentIntensity = lerp(0.35, 0.65, dd);
  }

  waterAt(x, z) { return levelAt(-z); }
  bedAt(x, z) { return bedAt(x, -z); }
  groundAt(z) { return groundAt(-z); }
  inWater(x, z) { return Math.abs(x) < HW; }

  update(dt, t, cam, focus) {
    U.uTime.value = t;
    this.sky.update(cam);
    const f = focus || cam.position;
    this.murk.follow(f.z);
    this.murk.update(dt);
    this.water.setMurk(this.murk);
  }
}

const tick = () => new Promise((r) => setTimeout(r, 0));
