import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { Atmosphere, CLOUD_BANKS } from './atmosphere';
import { ArtMaterials } from './materials';
import { waterfall } from './waterfalls';
import { SkyEffects } from './effects';
import type { FlightView } from './input';
import { FlightCamera } from './flight-camera';
import { coinTemplate } from './coins';
import { ISLANDS, Simulation, SPECIES, type GameEvent, type Vec } from './simulation';

type Animated = { root: THREE.Group; eyes: THREE.Object3D[]; tendrils: THREE.Object3D[]; bank: number; previousYaw?: number; left?: THREE.Object3D; right?: THREE.Object3D; hindLeft?: THREE.Object3D; hindRight?: THREE.Object3D; tail?: THREE.Object3D };
const assetNames = ['airship', 'ray', 'whale', 'bird', 'moth', 'koi', 'jelly', 'island', 'lighthouse', 'ruins', 'orchard', 'food', 'pearl', 'island-distant', 'lighthouse-distant', 'ruins-distant', 'orchard-distant'] as const;
type AssetName = typeof assetNames[number];

export class SkyScene {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(46, 1, .3, 900);
  private assets = new Map<AssetName, THREE.Group>();
  private ship = new THREE.Group();
  private rotors: THREE.Object3D[] = [];
  private creatures = new Map<number, Animated>();
  private food = new Map<number, THREE.Group>();
  private pearls = new Map<number, THREE.Group>();
  private coin = new THREE.Group();
  private atmosphere = new Atmosphere();
  private art = new ArtMaterials();
  private composer: EffectComposer;
  private ao: GTAOPass;
  private falls: THREE.Group[] = [];
  private cloudBillows: { sprite: THREE.Sprite; x: number; phase: number }[] = [];
  private desiredCamera = new THREE.Vector3();
  private cameraAim = new THREE.Vector3();
  private currentAim = new THREE.Vector3();
  private flightCamera = new FlightCamera();
  private cameraArm = 0;
  private cameraOrigin = new THREE.Vector3();
  private cameraDirection = new THREE.Vector3();
  private cameraRay = new THREE.Raycaster();
  private cameraObstacles: THREE.Object3D[] = [];
  private shadowLight = new THREE.DirectionalLight('#fff0d5', 4.0);
  private lastTime = 0;
  private initial = true;
  private resizeObserver: ResizeObserver;
  private reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  private effects = new SkyEffects(this.reduced);
  private beacon?: THREE.PointLight;
  private frameSamples: number[] = [];
  private labelRay = new THREE.Raycaster();
  private cloudImmersion = 0;

  constructor(private container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.4));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.info.autoReset = false;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.domElement.setAttribute('aria-label', 'Fly your airship among the floating gardens');
    container.append(this.renderer.domElement);
    this.scene.fog = new THREE.Fog('#b9d3d5', 100, 390);
    this.scene.add(this.atmosphere.background);
    this.scene.add(this.effects.root);
    // White cloud bounce keeps the underside readable without flattening sun shadows.
    this.scene.add(new THREE.HemisphereLight('#dcefff', '#d8e5e7', .68));
    const fill = new THREE.DirectionalLight('#cde6fa', .60);
    fill.position.set(-55, 28, 65); this.scene.add(fill);
    const rim = new THREE.DirectionalLight('#d5edff', .65);
    rim.position.set(-45, 42, -70); this.scene.add(rim);
    this.shadowLight.position.set(65, 48, -35);
    this.shadowLight.castShadow = true;
    this.shadowLight.shadow.mapSize.set(4096, 4096);
    this.shadowLight.shadow.camera.left = -65;
    this.shadowLight.shadow.camera.right = 65;
    this.shadowLight.shadow.camera.top = 65;
    this.shadowLight.shadow.camera.bottom = -65;
    this.shadowLight.shadow.camera.near = 1;
    this.shadowLight.shadow.camera.far = 220;
    this.shadowLight.shadow.normalBias = .10;
    this.shadowLight.shadow.bias = -.00035;
    this.shadowLight.shadow.radius = 2.5;
    this.scene.add(this.shadowLight, this.shadowLight.target);
    const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
    this.composer = new EffectComposer(this.renderer, target);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.ao = new GTAOPass(this.scene, this.camera, 512, 512);
    this.ao.updateGtaoMaterial({ radius: 1.5, samples: 12 });
    this.ao.blendIntensity = .48;
    const renderAO = this.ao.render.bind(this.ao);
    this.ao.render = (...args) => {
      const translucent = [this.atmosphere.background, this.effects.root, ...this.falls, ...this.cloudBillows.map(({ sprite }) => sprite)];
      const visibility = translucent.map(object => object.visible);
      translucent.forEach(object => { object.visible = false; });
      renderAO(...args);
      translucent.forEach((object, i) => { object.visible = visibility[i]; });
    };
    this.composer.addPass(this.ao);
    this.composer.addPass(new UnrealBloomPass(new THREE.Vector2(512, 512), .16, .65, 1.25));
    this.composer.addPass(new OutputPass());
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container); this.resize();
  }

  async load(onProgress: (value: number) => void) {
    const loader = new GLTFLoader(); let count = 0;
    await Promise.all(assetNames.map(async name => {
      const gltf = await loader.loadAsync(`/assets/${name}.glb`);
      gltf.scene.traverse(o => {
        if (o instanceof THREE.Mesh) {
          o.castShadow = true; o.receiveShadow = true;
          this.art.apply(o);
        }
      });
      this.assets.set(name, gltf.scene);
      onProgress(++count / (assetNames.length + 2));
    }));
    const sky = await new THREE.TextureLoader().loadAsync('/assets/sky.png');
    sky.colorSpace = THREE.SRGBColorSpace;
    sky.mapping = THREE.EquirectangularReflectionMapping;
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromEquirectangular(sky).texture;
    // Scene.environmentIntensity controls materials without an explicit envMap.
    this.scene.environmentIntensity = .28;
    for (const asset of this.assets.values()) asset.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) if (material instanceof THREE.MeshStandardMaterial) {
        material.envMap = this.scene.environment;
        material.needsUpdate = true;
      }
    });
    pmrem.dispose(); sky.dispose();
    this.coin = coinTemplate(this.scene.environment);
    const cloudMap = await new THREE.TextureLoader().loadAsync('/assets/cloud-billow.png');
    cloudMap.colorSpace = THREE.SRGBColorSpace;
    const cloudMaterial = new THREE.SpriteMaterial({ map: cloudMap, transparent: true, depthWrite: false, opacity: .64, fog: false, side: THREE.DoubleSide });
    for (let i = 0; i < 20; i++) {
      const material = cloudMaterial.clone();
      material.color.set('#f5f7f5');
      material.rotation = Math.sin(i * 3.7) * .045;
      const sprite = new THREE.Sprite(material);
      const angle = i * 2.399;
      const radius = i < 12 ? 50 + i * 8 : 165 + i % 4 * 33;
      sprite.position.set(Math.sin(angle) * radius, i < 12 ? -22 - i % 3 * 3 : -10 + i % 4 * 3, Math.cos(angle) * radius);
      const size = i < 12 ? 65 + i % 3 * 13 : 100 + i % 4 * 17;
      sprite.scale.set(size * (i % 2 ? -1 : 1), size * (.52 + i % 3 * .07), 1);
      this.scene.add(sprite);
      this.cloudBillows.push({ sprite, x: sprite.position.x, phase: i * .7 });
    }
    for (const [i, bank] of CLOUD_BANKS.entries()) for (let j = 0; j < 2; j++) {
      const material = cloudMaterial.clone(); material.opacity = .44; material.color.set('#f5f7f5');
      const sprite = new THREE.Sprite(material);
      sprite.position.set(bank.center[0] + (j ? 21 : -17), bank.center[1] - 9 + j * 9, bank.center[2] + (j ? -25 : 20));
      sprite.scale.set(78 + j * 18, 42 + j * 8, 1);
      this.scene.add(sprite); this.cloudBillows.push({ sprite, x: sprite.position.x, phase: i + j * 2 });
    }
    this.ship = this.assets.get('airship')!.clone(true);
    this.ship.traverse(o => { if (o.name.startsWith('rotor_')) this.rotors.push(o); });
    this.ship.scale.setScalar(1.13); this.scene.add(this.ship);
    const gardens: AssetName[] = ['lighthouse', 'island', 'ruins', 'orchard', 'lighthouse', 'orchard'];
    for (const [index, i] of ISLANDS.entries()) {
      const island = this.assets.get(gardens[index])!.clone(true);
      island.position.set(i.x, i.y, i.z); island.rotation.y = i.rotation; island.scale.setScalar(i.scale);
      this.scene.add(island);
      island.traverse(object => { if (object instanceof THREE.Mesh) this.cameraObstacles.push(object); });
      if (index === 0 || index === 1 || index === 4) {
        const fall = waterfall(i.y + 27, this.art.time);
        const edge = new THREE.Vector3(3.0, .25, 3.1).multiplyScalar(i.scale).applyAxisAngle(new THREE.Vector3(0, 1, 0), i.rotation);
        fall.position.set(i.x + edge.x, i.y + edge.y, i.z + edge.z);
        fall.rotation.y = i.rotation;
        fall.scale.x = 1.3;
        this.scene.add(fall); this.falls.push(fall);
      }
    }
    // Distant gardens give the bounded sanctuary a wider landscape and parallax.
    for (let i = 0; i < 16; i++) {
      const a = i * Math.PI * 2 / 16 + .18;
      const island = this.assets.get(`${gardens[i % gardens.length]}-distant` as AssetName)!.clone(true);
      const radius = 155 + i % 4 * 43;
      island.position.set(Math.sin(a) * radius, -6 + i % 4 * 7, Math.cos(a) * radius);
      island.scale.setScalar(1.8 + i % 3 * .85); island.rotation.y = a;
      island.traverse(o => {
        if (!(o instanceof THREE.Mesh)) return;
        o.castShadow = false;
        if (/petal|cedar|brass/i.test((o.material as THREE.Material).name)) o.visible = false;
      });
      this.scene.add(island);
    }
    this.beacon = new THREE.PointLight('#ffd67d', 0, 65, 1.4);
    this.beacon.position.set(13.6, 20, -39); this.scene.add(this.beacon);
    this.scene.updateMatrixWorld(true);
    onProgress(1);
  }

  private animated(name: AssetName): Animated {
    const template = this.assets.get(name)!;
    const root = template.clone(true);
    const animated: Animated = { root, eyes: [], tendrils: [], bank: 0 };
    root.traverse(o => {
      if (o instanceof THREE.Mesh) {
        // Object3D.clone does not copy custom depth materials.
        o.customDepthMaterial = template.getObjectByName(o.name)?.customDepthMaterial;
        return;
      }
      if (o.name.startsWith('wing_left')) animated.left = o;
      if (o.name.startsWith('wing_right')) animated.right = o;
      if (o.name.startsWith('hind_left')) animated.hindLeft = o;
      if (o.name.startsWith('hind_right')) animated.hindRight = o;
      if (o.name.startsWith('tail')) animated.tail = o;
      if (o.name.startsWith('tentacle_')) animated.tendrils.push(o);
      if (o.name.startsWith('eye_left') || o.name.startsWith('eye_right')) animated.eyes.push(o);
    });
    this.scene.add(root); return animated;
  }

  resetCamera() { this.initial = true; this.flightCamera.reset(); }

  render(game: Simulation, elapsed: number, dt: number, view: FlightView) {
    this.lastTime = elapsed;
    this.art.time.value = this.reduced ? 0 : elapsed;
    for (const billow of this.cloudBillows) billow.sprite.position.x = billow.x + (this.reduced ? 0 : Math.sin(elapsed * .025 + billow.phase) * 1.5);
    this.ship.position.set(game.pos.x, game.pos.y + Math.sin(elapsed * 1.2) * (this.reduced ? 0 : .10), game.pos.z);
    this.ship.rotation.set(game.bodyPitch, game.yaw, game.bank, 'YXZ');
    for (const rotor of this.rotors) rotor.rotation.z += dt * (12 + game.speed * 2);
    const ids = new Set(game.creatures.map(c => c.id));
    for (const [id, c] of this.creatures) if (!ids.has(id)) { this.scene.remove(c.root); this.creatures.delete(id); }
    for (const c of game.creatures) {
      let visual = this.creatures.get(c.id);
      if (!visual) { visual = this.animated(c.species); this.creatures.set(c.id, visual); }
      const growth = 1 + Math.min(c.fed, 7) * .055;
      const happyPulse = c.happy > 2.45 && !this.reduced ? Math.sin((3 - c.happy) / .55 * Math.PI) * .065 : 0;
      const appear = c.spawn * c.spawn * (3 - 2 * c.spawn);
      const absorb = Math.max(.015, (1 - c.capture) ** .7);
      const scale = SPECIES[c.species].scale * growth * Math.max(.015, appear) * absorb;
      visual.root.visible = Math.hypot(c.pos.x - game.pos.x, c.pos.z - game.pos.z) < 108;
      const jellyPulse = c.species === 'jelly' && !this.reduced ? Math.sin(elapsed * 2.3 + c.phase) * .06 : 0;
      visual.root.scale.set(scale * (1 + happyPulse + jellyPulse), scale * (1 - happyPulse - jellyPulse * .6), scale * (1 + jellyPulse));
      visual.root.position.set(c.pos.x, c.pos.y + Math.sin(elapsed * 1.8 + c.phase) * .15, c.pos.z);
      const turn = visual.previousYaw === undefined || dt === 0 ? 0 : Math.atan2(Math.sin(c.yaw - visual.previousYaw), Math.cos(c.yaw - visual.previousYaw)) / dt;
      visual.bank += (THREE.MathUtils.clamp(-turn * .18, -.32, .32) - visual.bank) * (1 - Math.exp(-dt * 4));
      visual.previousYaw = c.yaw;
      visual.root.rotation.set(Math.sin(elapsed + c.phase) * .04, c.yaw, visual.bank + Math.sin(elapsed * .8 + c.phase) * .025, 'YXZ');
      const urgency = c.mode === 'flee' ? 1.65 : 1;
      const flapRate = c.species === 'moth' ? 11 : c.species === 'bird' ? 8 : c.species === 'koi' ? 3.6 : 1.8;
      const flapSize = c.species === 'moth' ? .62 : c.species === 'bird' ? .42 : .14;
      const flap = this.reduced ? 0 : Math.sin(elapsed * flapRate * urgency + c.phase) * flapSize * urgency;
      if (visual.left) visual.left.rotation.z = flap;
      if (visual.right) visual.right.rotation.z = -flap;
      if (visual.hindLeft) visual.hindLeft.rotation.z = flap * .85;
      if (visual.hindRight) visual.hindRight.rotation.z = -flap * .85;
      if (visual.tail) {
        if (c.species === 'koi') visual.tail.rotation.y = this.reduced ? 0 : Math.sin(elapsed * 3.8 + c.phase) * .28;
        else visual.tail.rotation.x = this.reduced ? 0 : Math.sin(elapsed * 2 + c.phase) * .18;
      }
      for (const [i, tendril] of visual.tendrils.entries()) {
        tendril.rotation.x = this.reduced ? 0 : Math.sin(elapsed * 1.8 + c.phase + i * .7) * .13;
        tendril.rotation.z = this.reduced ? 0 : Math.cos(elapsed * 1.3 + c.phase + i) * .11;
      }
      const blinkTime = (elapsed + c.phase * 2) % (4.1 + c.phase * .35);
      const blink = !this.reduced && blinkTime < .18 ? Math.max(.06, 1 - Math.sin(blinkTime / .18 * Math.PI)) : 1;
      for (const eye of visual.eyes) eye.scale.y = blink;
    }
    this.syncObjects(game.foods, this.food, 'food', elapsed);
    this.syncObjects(game.drops, this.pearls, 'pearl', elapsed);
    const mobile = this.container.clientWidth < 700;
    this.flightCamera.update(game.pos, game.yaw, game.pitch, view, dt, mobile);
    this.desiredCamera.copy(this.flightCamera.position);
    this.cameraOrigin.copy(game.pos); this.cameraOrigin.y += 1.5;
    this.cameraDirection.subVectors(this.desiredCamera, this.cameraOrigin);
    const armLength = this.cameraDirection.length();
    this.cameraRay.set(this.cameraOrigin, this.cameraDirection.normalize());
    this.cameraRay.near = .1; this.cameraRay.far = armLength + 1.5;
    const obstruction = this.cameraRay.intersectObjects(this.cameraObstacles, false)[0];
    const allowedArm = obstruction ? Math.min(armLength, Math.max(.5, obstruction.distance - 1.5)) : armLength;
    // Retract immediately at obstacles; extend smoothly when the view clears.
    this.cameraArm = this.initial || allowedArm < this.cameraArm ? allowedArm : THREE.MathUtils.lerp(this.cameraArm, allowedArm, 1 - Math.exp(-dt * 5));
    this.camera.position.copy(this.cameraOrigin).addScaledVector(this.cameraDirection, this.cameraArm);
    this.cameraAim.copy(this.flightCamera.aim).lerp(this.flightCamera.focus, 1 - this.cameraArm / armLength);
    this.currentAim.copy(this.cameraAim);
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(this.currentAim); this.initial = false;
    this.cloudImmersion += (this.atmosphere.localMist(this.camera.position) - this.cloudImmersion) * (1 - Math.exp(-dt * 2));
    const fog = this.scene.fog as THREE.Fog;
    fog.near = THREE.MathUtils.lerp(100, 3, this.cloudImmersion);
    fog.far = THREE.MathUtils.lerp(390, 75, this.cloudImmersion);
    const fov = this.reduced ? 46 : game.boosting ? 50 : 46;
    const nextFov = THREE.MathUtils.lerp(this.camera.fov, fov, 1 - Math.exp(-dt * 3));
    if (Math.abs(nextFov - this.camera.fov) > .005) { this.camera.fov = nextFov; this.camera.updateProjectionMatrix(); }
    this.effects.update(game, dt, this.camera, this.creatures);
    this.shadowLight.position.set(game.pos.x + 65, game.pos.y + 48, game.pos.z - 35);
    this.shadowLight.target.position.set(game.pos.x, game.pos.y - 4, game.pos.z - 18);
    if (this.beacon) this.beacon.intensity = game.restored ? 45 : 0;
    this.renderer.info.reset();
    this.atmosphere.render(this.renderer, this.camera, this.reduced ? 0 : elapsed);
    this.composer.render(dt);
    if (dt > 0) { this.frameSamples.push(dt); if (this.frameSamples.length > 120) this.frameSamples.shift(); }
  }

  private syncObjects(objects: { id: number; pos: Vec }[], visuals: Map<number, THREE.Group>, asset: AssetName, time: number) {
    const ids = new Set(objects.map(o => o.id));
    for (const [id, visual] of visuals) if (!ids.has(id)) { this.scene.remove(visual); visuals.delete(id); }
    for (const object of objects) {
      let visual = visuals.get(object.id);
      if (!visual) { visual = (asset === 'pearl' ? this.coin : this.assets.get(asset)!).clone(true); this.scene.add(visual); visuals.set(object.id, visual); }
      visual.position.set(object.pos.x, object.pos.y, object.pos.z);
      visual.rotation.y = asset === 'pearl' ? time * 3.8 + object.id : time;
      if (asset === 'pearl') { visual.rotation.z = Math.sin(time * 2 + object.id) * .14; visual.scale.setScalar(1.2); }
    }
  }

  effect(event: GameEvent) {
    this.effects.event(event);
  }

  project(pos: Vec) {
    const anchor = new THREE.Vector3(pos.x, pos.y, pos.z);
    const p = anchor.clone().project(this.camera);
    let visible = p.z < 1 && p.z > -1 && Math.abs(p.x) < .92 && Math.abs(p.y) < .85;
    if (visible) {
      const direction = anchor.sub(this.camera.position);
      this.labelRay.far = direction.length() - .3;
      this.labelRay.set(this.camera.position, direction.normalize());
      visible = this.labelRay.intersectObject(this.ship, true).length === 0;
    }
    return { x: (p.x * .5 + .5) * this.container.clientWidth, y: (-p.y * .5 + .5) * this.container.clientHeight, visible };
  }

  get stats() { return { calls: this.renderer.info.render.calls, triangles: this.renderer.info.render.triangles, fps: this.frameSamples.length / this.frameSamples.reduce((a, b) => a + b, 0), assets: this.assets.size }; }

  private resize() {
    const width = this.container.clientWidth, height = this.container.clientHeight;
    this.camera.aspect = width / height; this.camera.updateProjectionMatrix(); this.renderer.setSize(width, height);
    this.composer?.setSize(width, height);
    this.ao?.setSize(Math.round(width * .7), Math.round(height * .7));
    this.atmosphere.resize(width, height);
    this.effects.resize(height, this.renderer.getPixelRatio());
  }
}
