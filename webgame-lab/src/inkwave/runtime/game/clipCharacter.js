import { AnimationMixer, Box3, Group, Vector3 } from 'three';

/** GLB presentation adapter. The motor/camera own world motion; clips own pose.
 * Clip names and calibration belong to each asset. Source procedural foot IK is not applied.
 */
export class ClipCharacter {
  constructor(gltf, { height = 1, idle = 'Survey', walk = 'Walk', run = 'Run', forwardYaw = 0 } = {}) {
    this.root = new Group();
    this.model = gltf.scene;
    const bounds = new Box3().setFromObject(this.model), center = bounds.getCenter(new Vector3());
    const scale = height / Math.max(.001, bounds.max.y - bounds.min.y);
    this.model.scale.multiplyScalar(scale);
    this.model.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale);
    const facing = new Group(); facing.rotation.y = forwardYaw; facing.add(this.model); this.root.add(facing);
    this.model.traverse(o => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
    this.mixer = new AnimationMixer(this.model);
    this.actions = {};
    for (const [key, name] of Object.entries({idle, walk, run})) {
      const clip = gltf.animations.find(c => c.name === name);
      if (!clip) throw new Error(`Missing ${key} animation: ${name}`);
      this.actions[key] = this.mixer.clipAction(clip).play();
    }
    this.weights = { idle: 1, walk: 0, run: 0 };
    this.update(0, { speed: 0, grounded: true });
  }
  update(dt, {speed, grounded}) {
    const moving = grounded ? Math.min(1, speed / .6) : 0;
    const run = Math.min(1, Math.max(0, (speed - 2) / 3));
    const target = {idle:1 - moving, walk:moving * (1 - run), run:moving * run};
    for (const key of Object.keys(target)) {
      this.weights[key] += (target[key] - this.weights[key]) * (dt ? 1 - Math.exp(-dt * 14) : 1);
      this.actions[key].setEffectiveWeight(this.weights[key]);
    }
    this.actions.walk.setEffectiveTimeScale(Math.max(.25, speed / 2));
    this.actions.run.setEffectiveTimeScale(Math.max(.25, speed / 6));
    this.mixer.update(dt);
  }
  dispose() {
    this.mixer.stopAllAction(); this.mixer.uncacheRoot(this.model); this.root.removeFromParent();
    const geometries = new Set(), materials = new Set(), textures = new Set();
    this.model.traverse(o => {
      if (o.geometry) geometries.add(o.geometry);
      for (const m of Array.isArray(o.material) ? o.material : o.material ? [o.material] : []) {
        materials.add(m); for (const value of Object.values(m)) if (value?.isTexture) textures.add(value);
      }
      o.skeleton?.dispose();
    });
    for (const resource of [...geometries, ...materials, ...textures]) resource.dispose();
  }
}
