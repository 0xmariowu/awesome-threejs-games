// 描画の土台: 物理ベースの光・空からの環境光・接地の陰り（GTAO）・銛一本と同じ空の色
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SkyDome } from '../world/sky.js';
import { U } from '../core/shaderPatch.js';
import { gradePass } from './scenery/haze.js';

export const SUN_DIR = new THREE.Vector3(0.42, 0.78, 0.46).normalize();

export function setSkyColors() {
  U.uUnder.value = 0;
  U.uSunDir.value.copy(SUN_DIR);
  U.uSunCol.value.set('#fff6ea');
  U.uSkyZenith.value.set('#2262c4');
  U.uSkyHorizon.value.set('#b8ddf2');
  U.uAirFogCol.value.set('#c4dce9');
  U.uWaterShallow.value.set('#29acb4');
  U.uWaterDeep.value.set('#083e59');
}

// preserve: 描いた絵を画面のあとも残す（確認ページの toDataURL 用。ゲームでは毎フレームの複製になるので付けない）
export function createRenderer(canvas, { preserve = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: preserve });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  return renderer;
}

// 太陽・空の光・環境マップ
export function setupLights(scene, renderer, { shadowSize = 4096, shadowRange = 55 } = {}) {
  setSkyColors();
  const sun = new THREE.DirectionalLight('#fff4e2', 3.4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(shadowSize, shadowSize);
  Object.assign(sun.shadow.camera, { left: -shadowRange, right: shadowRange, top: shadowRange, bottom: -shadowRange, near: 1, far: 500 });
  sun.shadow.bias = -0.0003;
  sun.shadow.normalBias = 0.035;
  sun.shadow.radius = 2;
  scene.add(sun, sun.target);
  const hemi = new THREE.HemisphereLight('#c4dcf5', '#8f8a6a', 1.0);
  scene.add(hemi);
  // 空を環境マップに焼く（反射と、陰の青み）
  const sky = new SkyDome();
  const envScene = new THREE.Scene();
  envScene.add(sky.mesh);
  const ground = new THREE.Mesh(new THREE.CircleGeometry(900, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#6f7a5a' }));
  ground.position.y = -30;
  envScene.add(ground);
  const pm = new THREE.PMREMGenerator(renderer);
  const env = pm.fromScene(envScene, 0.02).texture;
  scene.environment = env;
  scene.environmentIntensity = 1.0;
  pm.dispose();
  const skyMesh = new SkyDome();
  scene.add(skyMesh.mesh);
  return { sun, hemi, sky: skyMesh };
}

// 影のカメラを見ている場所へ（テクセル単位でそろえる）
export function followShadow(sun, x, y, z) {
  const S = sun.shadow.camera.right, snap = (2 * S) / sun.shadow.mapSize.x;
  const lx = Math.round(x / snap) * snap, lz = Math.round(z / snap) * snap;
  const D = 200 + Math.max(0, S - 60);
  sun.target.position.set(lx, y, lz);
  sun.position.set(lx + SUN_DIR.x * D, y + SUN_DIR.y * D, lz + SUN_DIR.z * D);
}

// 影を落とす範囲（半径 m）。空から見下ろすときは広げる
export function setShadowRange(sun, r) {
  const c = sun.shadow.camera;
  if (Math.abs(c.right - r) < 0.5) return;
  Object.assign(c, { left: -r, right: r, top: r, bottom: -r, far: Math.max(500, 420 + r * 2) });
  c.updateProjectionMatrix();
}

// AO_SCALE: 接地の陰り（GTAO）を計算する解像度。陰りは柔らかいので半分でも見た目はほぼ同じで、計算は 1/4 になる
const AO_SCALE = 0.5;

// aoFromDepth: 陰りの計算に、ふつうに描いたときの深度をそのまま使う（シーンをもう一度描かない。法線は深度から作る）。
// false にすると、葉と草を外したシーンで法線と深度を描き直す（元のやり方）
export function createComposer(renderer, scene, camera, { ao = true, aoFromDepth = true, grade = false } = {}) {
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: 4 });
  if (ao && aoFromDepth) rt.depthTexture = new THREE.DepthTexture(size.x, size.y); // composer の 2 枚目にも複製される
  const composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));
  let gtao = null;
  if (ao) {
    gtao = new GTAOPass(scene, camera, Math.ceil(size.x * AO_SCALE), Math.ceil(size.y * AO_SCALE));
    const setSize = gtao.setSize.bind(gtao);
    gtao.setSize = (w, h) => setSize(Math.ceil(w * AO_SCALE), Math.ceil(h * AO_SCALE));
    gtao.updateGtaoMaterial({ radius: 0.9, distanceExponent: 1.5, thickness: 1.2, scale: 1.0, samples: 12 });
    gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 12 });
    gtao.blendIntensity = 0.85;
    const orig = gtao.render.bind(gtao);
    if (aoFromDepth) {
      gtao.setGBuffer(rt.depthTexture);
      // 2 枚の描画先は毎フレーム入れかわるので、いま絵が入っている方の深度を読む
      gtao.render = (renderer2, writeBuffer, readBuffer, ...rest) => {
        const d = readBuffer.depthTexture;
        gtao.gtaoMaterial.uniforms.tDepth.value = d;
        gtao.pdMaterial.uniforms.tDepth.value = d;
        orig(renderer2, writeBuffer, readBuffer, ...rest);
      };
    } else {
      // 葉や草（透明の抜きがある板）は AO の下準備から外す（四角く陰らないように）
      const hidden = [];
      gtao.render = (...args) => {
        scene.traverseVisible((o) => { if (o.userData.noAO) hidden.push(o); });
        for (const o of hidden) o.visible = false;
        orig(...args);
        for (const o of hidden) o.visible = true;
        hidden.length = 0;
      };
    }
    composer.addPass(gtao);
  }
  composer.addPass(new OutputPass());
  // 仕上げの色（町のゲーム画面だけ。確認ページは素の色で見る）
  if (grade) composer.addPass(gradePass());
  const resize = () => {
    renderer.setSize(innerWidth, innerHeight);
    composer.setSize(innerWidth, innerHeight);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
  };
  addEventListener('resize', resize);
  return { composer, gtao, resize };
}
