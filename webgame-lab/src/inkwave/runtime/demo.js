import * as THREE from "three";
import * as reference from "./config.js";
import {
  EventBus,
  SimulationClock,
  chooseObjective,
  RESCUE_WEIGHTS,
  surfaceResponse,
} from "../systems.ts";
import { Level } from "./world/level.js";
import { Physics, GroundHit } from "./game/physics.js";
import { PaintSystem } from "./world/paint.js";
import { createTextureLibrary } from "./world/texlib.js";
import { createLevelMaterial } from "./world/levelMaterial.js";
import { Environment } from "./world/environment.js";
import { PropKit } from "./world/props.js";
import { NavGraph } from "./game/nav.js";
import { createCharacterType } from "./game/character.js";
import { createActorType } from "./game/actor.js";
import { createWeaponSystems } from "./game/weapons.js";
import { createCameraType } from "./game/cameraRig.js";
import { createPlayerControllerType } from "./game/player.js";
import { createBotType } from "./game/bots.js";
import { FX } from "./fx/fx.js";
import { initFxHooks } from "./fx/fxHooks.js";
import { AudioEngine } from "./audio/audio.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { GTAOPass } from "three/addons/postprocessing/GTAOPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { GradeShader } from "./grade.js";
import { LabInput } from "./input.js";
import { FrameStats } from "./frameStats.js";
import { SkillSequence } from "./skillSequence.js";
import { bakeAO } from "./world/bakeAO.js";

const box = (min, max, pattern = 0, color = "#d6d3c8") => ({
  kind: "box",
  min,
  max,
  pattern,
  color,
});
export function courseLayout(seed = 1) {
  const single = [
    box([-12, -1, -15], [12, 0, 15], 10),
    box([-12, 0, 14], [12, 3, 15], 5),
    box([-9, 0, -2], [-5, 0.25, 1], 1),
    box([-9, 0, 1], [-5, 0.5, 3], 1),
    box([-9, 0, 3], [-5, 0.75, 5], 1),
    {
      kind: "ramp",
      low: [5, 0, -4],
      high: [5, 2, 3],
      width: 3,
      thickness: 0.5,
      pattern: 4,
      color: "#c5d3cc",
    },
    box([3.5, 0, 3], [6.5, 2, 6], 4),
    box([-2, 0, 3], [2, 3, 3.5], 13),
  ];
  for (let i = 0; i < 6; i++)
    single.push(
      box(
        [-10 + i * 3.6, 0, 10],
        [-7.1 + i * 3.6, 2.5, 11],
        [0, 1, 2, 6, 11, 15][i],
      ),
    );
  if (seed > 1)
    for (let i = 0; i < 4; i++) {
      const x = Math.sin(seed * 13 + i * 41) * 8,
        z = -5 + Math.cos(seed * 7 + i) * 3;
      single.push(
        box([x, 0, z], [x + 1, 0.4 + (i % 3) * 0.4, z + 1], seed % 14),
      );
    }
  return {
    bounds: { minX: -12, maxX: 12, minZ: -15, maxZ: 15 },
    spawnPads: [
      [0, 0, -10],
      [0, 0, 8],
    ],
    spawnBarrier: 0,
    single,
    half: [],
  };
}
function clonePreset() {
  return Object.fromEntries(
    Object.entries(reference).map(([k, v]) => [
      k,
      k === "PROGRESSION"
        ? { ...v }
        : typeof v === "object"
          ? structuredClone(v)
          : v,
    ]),
  );
}

/** Owns one playable world. The caller owns renderer, camera and animation loop. */
export class InkwaveDemo {
  constructor(renderer, scene, camera, kind) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.kind = kind;
    this.events = new EventBus();
    this.clock = new SimulationClock();
    this.frameStats = new FrameStats();
    this.presentation = 'source';
    this.presentationToken = 0;
    this.aoMode = 'none';
    this.feedbackLayers = { particles: true, camera: true, sound: true };
    this.skill = new SkillSequence(cue => this.presentSkillCue(cue));
    this.preset = clonePreset();
    this.settings = { ...reference.DEFAULT_SETTINGS, cameraShake: 1 };
    this.teamColors = [new THREE.Color("#ff8a14"), new THREE.Color("#2f5bff")];
    this.actors = [];
    this.bots = [];
    this.time = 0;
    this.frames = 0;
    this.disposed = false;
    this.seed = 1;
    this.feedback = true;
    this.cameraMode = "tuned";
    this.animation = true;
    this.footPlanting = true;
    this.stepSmoothing = true;
    this.policy = "turf";
    this.goalPolicy = "turf";
    this.auto = false;
    this.match = {
      playing: () => !this.clock.paused,
      canRespawn: () => true,
      attract: false,
    };
    this.previous = {
      background: scene.background,
      environment: scene.environment,
      fog: scene.fog,
      toneMapping: renderer.toneMapping,
      exposure: renderer.toneMappingExposure,
      shadow: renderer.shadowMap.enabled,
      shadowType: renderer.shadowMap.type,
    };
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    this.input = new LabInput(renderer.domElement);
  }
  async init() {
    this.level = new Level(courseLayout(this.seed));
    this.physics = new Physics(this.level);
    this.paint = new PaintSystem(this.renderer, this.level, {
      atlasSize: 2048,
      maxDensity: 24,
      cell: 0.25,
    });
    this.texlib = await createTextureLibrary(this.renderer, { size: 256 });
    if (this.disposed) {
      this.texlib.dispose();
      return;
    }
    if (this.kind === 'materials') {
      const started = performance.now();
      this.aoTexture = await bakeAO(this.level, this.physics, { cancelled: () => this.disposed });
      if (this.disposed) return;
      this.aoBakeMs = performance.now() - started;
      this.aoMode = 'baked';
    }
    this.material = createLevelMaterial(
      this.paint.texture,
      this.paint.size,
      null,
      {
        texlib: this.texlib,
        lightmap: this.aoTexture,
        paint: this.paint,
        getLocalActor: () => this.local,
      },
    );
    this.mesh = new THREE.Mesh(
      this.level.buildGeometry(this.paint.size),
      this.material,
    );
    this.mesh.receiveShadow = true;
    this.mesh.castShadow = true;
    this.scene.add(this.mesh);
    this.environment = new Environment(this.renderer, this.scene, {
      bounds: this.level.bounds,
      shadowSize: 1024,
    });
    this.fx = new FX(this.scene, { quality: "medium" });
    this.fx.setLighting(this.environment.getSkyColors());
    this.nav = new NavGraph(this.level, this.physics);
    const ws = createWeaponSystems(this);
    this.projectiles = new ws.Projectiles(this.scene);
    this.Character = createCharacterType(this);
    this.Actor = createActorType(this, ws.WeaponRunner);
    this.Bot = createBotType(this);
    this.rig = new (createCameraType(this))(this.camera);
    this.rig.yaw = 0;
    this.rig.pitch = -0.18;
    this.local = this.addActor(0, false, [0, 0, -9]);
    this.controller = new (createPlayerControllerType(this))(
      this.local,
      this.rig,
      this.input,
    );
    this.rig.follow(this.local, true);
    this.rig.update(1 / 60);
    this.hooks = initFxHooks(this);
    this.events.on("recoil", (e) => {
      if (this.feedback) this.rig.recoil(e.amount);
    });
    this.events.on("shake", (e) => {
      if (this.feedback) this.rig.addShake(e.amount, e.pos);
    });
    this.events.on("hit", (e) => {
      if (e.attacker?.isLocal) {
        this.lastHit = this.time;
        if (this.feedback) this.audio?.play("hit_marker", { volume: 0.6 });
      }
    });
    this.events.on("actor:footstep", (e) => {
      if (this.feedback && e.actor?.isLocal)
        this.audio?.play(
          e.surface === 1
            ? "step_ink"
            : e.surface === 2
              ? "step_enemy"
              : "step_dry",
          { volume: 0.5 },
        );
    });
    this.buildProps();
    this.makeDebugGeometry();
    this.seedPaint();
    if (this.kind === "paint") {
      this.probeMesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.4, 20, 12),
        new THREE.MeshStandardMaterial({
          color: "#fbefd3",
          emissive: "#3b504b",
          metalness: 0.3,
          roughness: 0.2,
        }),
      );
      this.probeMesh.position.set(-10, 0.4, -8);
      this.scene.add(this.probeMesh);
      this.probeHit = new GroundHit();
      this.probe = { hp: 100, energy: 30, owner: 0, speed: 3 };
    }
    if (this.kind === "ai") {
      this.goalMarkers = new THREE.Group();
      for (const [x, z] of [
        [-8, -7],
        [7, 8],
      ]) {
        const m = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.6),
          new THREE.MeshStandardMaterial({
            color: "#8af4cd",
            emissive: "#1d5144",
          }),
        );
        m.position.set(x, 1.4, z);
        this.goalMarkers.add(m);
      }
      this.scene.add(this.goalMarkers);
    }
    if (["combat", "ai", "diagnostics"].includes(this.kind))
      this.setActorCount(this.kind === "ai" ? 6 : 3);
    if (
      ["materials", "paint", "world", "audio", "ui", "ai"].includes(this.kind)
    ) {
      this.overview = true;
      this.camera.position.set(20, 18, -23);
      this.camera.lookAt(0, 0, 1);
      this.camera.fov = 48;
      this.camera.updateProjectionMatrix();
      this.orbit = new OrbitControls(this.camera, this.renderer.domElement);
      this.orbit.target.set(0, 0, 1);
      this.orbit.enableDamping = true;
      this.orbit.maxPolarAngle = 1.48;
      this.orbit.minDistance = 4;
      this.orbit.maxDistance = 60;
      if (this.kind === "materials") {
        this.camera.position.set(12, 7, -1);
        this.orbit.target.set(0, 1, 10);
      }
      this.orbit.update();
    }
    const size = this.renderer.getSize(new THREE.Vector2());
    const target = new THREE.WebGLRenderTarget(size.x, size.y, {
      type: THREE.HalfFloatType,
      samples: 4,
    });
    this.composer = new EffectComposer(this.renderer, target);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(size, 0.18, 0.5, 0.92);
    this.grade = new ShaderPass(GradeShader);
    this.output = new OutputPass();
    if (this.kind === 'materials') {
      this.aoPass = new GTAOPass(this.scene, this.camera, size.x, size.y);
      this.aoPass.enabled = false;
      this.aoPass.blendIntensity = .8;
      this.composer.addPass(this.aoPass);
    }
    this.composer.addPass(this.bloom);
    this.composer.addPass(this.grade);
    this.composer.addPass(this.output);
    this.post = true;
    this.ready = true;
  }
  setAO(mode) {
    if (!['none', 'baked', 'realtime'].includes(mode)) throw new Error('Invalid AO mode');
    this.aoMode = mode;
    this.material.userData.uniforms.uAO.value = mode === 'baked' ? 1 : 0;
    if (this.aoPass) this.aoPass.enabled = mode === 'realtime';
  }
  async setPresentation(name) {
    if (!['source', 'fox'].includes(name)) throw new Error('Invalid character presentation');
    const token = ++this.presentationToken;
    if (name === 'source') { this.presentation = name; return; }
    if (this.clipCharacter) { this.presentation = 'fox'; return; }
    const [{GLTFLoader}, {ClipCharacter}] = await Promise.all([
      import('three/addons/loaders/GLTFLoader.js'), import('./game/clipCharacter.js'),
    ]);
    const gltf = await new GLTFLoader().loadAsync('/assets/Fox.glb');
    const character = new ClipCharacter(gltf);
    if (this.disposed || token !== this.presentationToken) { character.dispose(); return; }
    this.clipCharacter = character;
    this.scene.add(character.root);
    this.presentation = 'fox';
  }
  replayRoute(mode = 'tuned') {
    this.reset(); this.checkpoint('steps'); this.auto = false;
    this.cameraMode = mode === 'tuned' ? 'tuned' : 'direct';
    this.footPlanting = this.stepSmoothing = mode === 'tuned';
    this.route = { mode, elapsed:0, complete:false, maxStepOffset:0 };
  }
  playSkill(name) {
    const origin = this.local.pos.clone().add(new THREE.Vector3(0, 1, 0));
    const target = this.local.pos.clone().add(new THREE.Vector3(Math.sin(this.local.yaw)*4, .2, Math.cos(this.local.yaw)*4));
    this.skill.play(name, {origin, target, color:this.teamColors[0]});
  }
  presentSkillCue(cue) {
    const {origin, target, color} = cue.context;
    const k = cue.strength;
    this.events.emit('skill:' + cue.type, {recipe:cue.recipe, strength:k});
    if (this.feedbackLayers.particles) {
      if (cue.type === 'charge') this.fx.chargeGlow(origin, color, k);
      if (cue.type === 'beam') this.fx.beamTrail(origin, target, color, k);
      if (cue.type === 'impact') this.fx.explosion(target, color, 1.8*k);
      if (cue.type === 'ring') this.fx.ring(target, new THREE.Vector3(0,1,0), color, {radius:2*k,life:.65});
    }
    if (cue.type === 'impact') {
      if (this.feedbackLayers.camera) this.rig.addShake(.3*k, target);
      if (this.feedbackLayers.sound) this.audio?.play('bomb_explode', {pos:target,volume:.5});
    }
  }
  addActor(team, bot, pos) {
    const a = new this.Actor({
      team,
      name: bot ? "Agent " + this.actors.length : "Player",
      isLocal: !bot,
      isBot: bot,
      slot: this.actors.length,
      CharacterClass: this.Character,
    });
    this.actors.push(a);
    this.scene.add(a.character.root);
    a.spawnAt(new THREE.Vector3(...pos), team ? Math.PI : 0);
    a.invuln = 0;
    if (bot) {
      a.bot = new this.Bot(a);
      this.bots.push(a.bot);
    }
    return a;
  }
  setActorCount(n) {
    while (this.actors.length < n) {
      const i = this.actors.length;
      this.addActor(i % 2, true, [
        -7 + (i % 5) * 3,
        0,
        6 - Math.floor(i / 5) * 3,
      ]);
    }
    while (this.actors.length > n) {
      const a = this.actors.pop();
      this.bots = this.bots.filter((b) => b.a !== a);
      a.weaponRunner.reset();
      a.character.dispose();
    }
  }
  buildProps() {
    this.props?.dispose();
    this.props = new PropKit(this.scene, { quality: "medium" });
    const types = [
      "bench",
      "planter",
      "vending",
      "bollard",
      "trashbin",
      "tree",
    ];
    types.forEach((type, i) =>
      this.props.add(type, {
        pos: [-10 + i * 4, 0, -13],
        seed: this.seed * 47 + i,
        scale: type === "tree" ? 0.55 : 1,
      }),
    );
    this.props.build();
  }
  makeDebugGeometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(
        this.nav.nodes.flatMap((n) => [n.x, n.y + 0.08, n.z]),
        3,
      ),
    );
    this.navDots = new THREE.Points(
      g,
      new THREE.PointsMaterial({
        size: 0.12,
        color: "#6affc0",
        depthTest: false,
      }),
    );
    this.navDots.visible = this.kind === "ai";
    this.scene.add(this.navDots);
    this.wire = new THREE.LineSegments(
      new THREE.WireframeGeometry(this.mesh.geometry),
      new THREE.LineBasicMaterial({
        color: "#161b20",
        transparent: true,
        opacity: 0.5,
      }),
    );
    this.wire.visible = false;
    this.scene.add(this.wire);
  }
  seedPaint() {
    this.paint.clear();
    for (let i = 0; i < 6; i++)
      this.paint.splat(new THREE.Vector3(-3, 0, -8 + i * 2), 1.5, 0, {
        instant: true,
      });
    this.paint.splat(new THREE.Vector3(0, 1.5, 2.99), 2, 0, { instant: true });
    this.paint.splat(new THREE.Vector3(4, 0, -8), 2, 1, { instant: true });
  }
  stamp() {
    this.paint.splat(
      new THREE.Vector3(
        Math.sin(this.time * 1.7) * 7,
        0,
        Math.cos(this.time) * 6,
      ),
      1.9,
      this.stampTeam || 0,
    );
  }
  paintAt(x, y) {
    const r = this.renderer.domElement.getBoundingClientRect();
    const ray = new THREE.Raycaster();
    ray.setFromCamera(
      new THREE.Vector2(
        ((x - r.left) / r.width) * 2 - 1,
        (-(y - r.top) / r.height) * 2 + 1,
      ),
      this.camera,
    );
    const hit = ray.intersectObject(this.mesh)[0];
    if (hit) this.paint.splat(hit.point, 1.4, this.stampTeam || 0);
  }
  enableAudio() {
    if (!this.audio) {
      this.audio = new AudioEngine();
      this.audio.init();
      this.audio.setVolumes({ master: 0.45, music: 0.45, sfx: 0.75 });
    } else this.audio.resume();
  }
  sound(name) {
    this.enableAudio();
    this.audio.play(name);
  }
  music(track) {
    this.enableAudio();
    this.audio.music.play(track, { fade: 0.4 });
  }
  burst() {
    const p = this.local.pos.clone().add(new THREE.Vector3(0, 1, 3));
    if (this.feedback) {
      this.fx.explosion(p, this.teamColors[0], 3);
      this.rig.addShake(0.6, p);
      this.audio?.play("bomb_explode", { pos: p });
    }
    this.paint.splat(p, 3, 0);
    this.events.emit("lab:impact", { pos: p });
  }
  checkpoint(name) {
    const places = {
      start: [0, 0, -9],
      steps: [-7, 0, -4],
      ramp: [5, 0, -6],
      wall: [0, 0, 0.7],
      edge: [5, 2, 5.4],
    };
    const p = places[name] || places.start;
    this.local.spawnAt(new THREE.Vector3(...p), 0);
    this.local.invuln = 0;
    this.rig.yaw = 0;
    this.rig.pitch = -0.18;
    this.rig.follow(this.local, true);
  }
  reset() {
    this.skill.cancel();
    this.route = null;
    this.projectiles.clear();
    this.fx.clear();
    this.seedPaint();
    this.actors.forEach((a, i) => {
      a.spawnAt(
        new THREE.Vector3(i ? -7 + i * 3 : 0, 0, i ? 6 : -9),
        i ? Math.PI : 0,
      );
      a.invuln = 0;
    });
    this.bots.forEach((b) => b.reset());
    this.clock.reset();
    this.time = 0;
    if (this.probe) {
      this.probeMesh.position.x = -10;
      this.probe.hp = 100;
      this.probe.energy = 30;
    }
    this.rig.follow(this.local, true);
  }
  tick(dt) {
    this.time += dt;
    this.input.pollPad();
    this.controller.enabled = !this.overview;
    this.controller.update(dt);
    this.skill.update(dt);
    if (this.route && !this.route.complete) {
      this.route.elapsed += dt;
      const t = this.route.elapsed;
      this.local.intent.move.set(0, 0, t < 1.6 ? 1 : t < 2.5 ? -1 : t < 4.2 ? 1 : 0);
      this.local.intent.jump = t >= 3 && t < 3.04;
      this.local.intent.fire = this.local.intent.sub = this.local.intent.special = this.local.intent.squid = false;
      this.route.maxStepOffset = Math.max(this.route.maxStepOffset, Math.abs(this.local.smoothY));
      if (t >= 5) { this.route.complete = true; this.local.intent.move.set(0, 0, 0); }
    }
    if (this.auto && !this.overview && !this.route) {
      this.local.intent.move.set(
        Math.sin(this.time * 0.65),
        0,
        Math.cos(this.time * 0.65),
      );
      this.local.intent.jump = this.time % 3 < 0.1;
    }
    for (const b of this.bots)
      if (!(this.kind === "ai" && this.goalPolicy === "rescue")) b.update(dt);
    if (this.kind === "ai" && this.goalPolicy === "rescue")
      this.rescueIntent(dt);
    if (this.probeMesh) this.updateProbe(dt);
    for (const a of this.actors) {
      a.update(dt);
    }
    if (this.clipCharacter) {
      const visible = this.presentation === 'fox';
      this.clipCharacter.root.visible = visible && this.local.alive;
      this.local.character.root.visible = !visible && this.local.alive;
      if (visible) {
        this.local.visualPos(this.clipCharacter.root.position);
        this.clipCharacter.root.rotation.y = this.local.yaw;
        this.clipCharacter.update(dt, { speed:Math.hypot(this.local.vel.x, this.local.vel.z), grounded:this.local.grounded });
      }
    }
    this.projectiles.update(dt);
    this.hooks.update(dt);
    this.fx.update(dt, this.camera);
    this.props.update(dt, this.time);
    this.environment.update(dt, this.camera);
    if (!this.overview) {
      if (this.cameraMode === "tuned") this.rig.update(dt);
      else {
        const p = this.local.pos;
        this.camera.position.set(
          p.x - Math.sin(this.rig.yaw) * 4.5,
          p.y + 2.4,
          p.z - Math.cos(this.rig.yaw) * 4.5,
        );
        this.camera.lookAt(
          p.x + Math.sin(this.rig.yaw) * 10,
          p.y + 1.5,
          p.z + Math.cos(this.rig.yaw) * 10,
        );
      }
    }
    this.input.endFrame();
  }
  updateProbe(dt) {
    const p = this.probeMesh.position,
      h = this.physics.groundProbe(p.x, 0, p.z, 0.2, 0.3, 0.1, this.probeHit);
    const owner = h.hit ? this.paint.sample(h.face, h.u, h.v) : 0,
      response = surfaceResponse(owner, 0, this.policy);
    this.probe.owner = owner;
    this.probe.speed = 3 * response.speed;
    this.probe.hp = THREE.MathUtils.clamp(this.probe.hp - response.damage * dt, 0, 100);
    this.probe.energy = THREE.MathUtils.clamp(this.probe.energy + response.refill * dt, 0, 100);
    p.x += this.probe.speed * dt;
    this.probeMesh.rotation.z -= (this.probe.speed * dt) / 0.4;
    this.probeMesh.material.color.set(
      owner ? this.teamColors[owner - 1] : "#fbefd3",
    );
    if (p.x > 10) {
      p.x = -10;
      this.probe.hp = 100;
      this.probe.energy = 30;
    }
  }
  rescueIntent(dt) {
    this.rescueTimer = (this.rescueTimer || 0) - dt;
    const replan = this.rescueTimer <= 0;
    if (replan) this.rescueTimer = 0.25;
    for (const b of this.bots) {
      const a = b.a;
      if (!a.alive) continue;
      if (replan) {
        const goals = [
          {
            id: "near",
            p: new THREE.Vector3(-8, 0, -7),
            empty: 0.3,
            enemy: 0,
            progress: 0,
            teammates: 0,
          },
          {
            id: "front",
            p: new THREE.Vector3(7, 0, 8),
            empty: 0.8,
            enemy: 0.7,
            progress: 0.8,
            teammates: 2,
          },
        ];
        const scored = chooseObjective(
            goals.map((g) => ({ ...g, distance: g.p.distanceTo(a.pos) })),
            RESCUE_WEIGHTS,
          ),
          g = goals.find((g) => g.id === scored[0].id);
        b.rescueGoal = g.id;
        b.rescuePath = this.nav.path(
          this.nav.nearest(a.pos),
          this.nav.nearest(g.p),
          a.team,
        );
        b.rescueIndex = 1;
        this.goalScores = scored;
      }
      const path = b.rescuePath;
      let n = path && this.nav.nodes[path[b.rescueIndex]];
      if (n && Math.hypot(n.x - a.pos.x, n.z - a.pos.z) < 0.35) {
        b.rescueIndex++;
        n = this.nav.nodes[path[b.rescueIndex]];
      }
      if (n) {
        a.intent.move.set(n.x - a.pos.x, 0, n.z - a.pos.z).normalize();
        a.aimYaw = Math.atan2(a.intent.move.x, a.intent.move.z);
        a.aimPitch = 0;
      } else a.intent.move.set(0, 0, 0);
      a.intent.fire = a.intent.sub = a.intent.special = a.intent.squid = false;
      a.intent.jump = !!n && n.y > a.pos.y + 0.3;
    }
  }
  frame(dt) {
    if (!this.ready || this.disposed) return;
    this.frameStats.push(dt);
    this.orbit?.update();
    this.clock.advance(dt * (this.timeScale ?? 1), (h) => this.tick(h));
    this.paint.flush(dt);
    this.material.userData.uniforms.uTime.value = this.time;
    this.material.userData.uniforms.uSeeA.value.copy(this.camera.position);
    this.material.userData.uniforms.uSeeB.value.copy(this.local.pos).y += 1;
    this.material.userData.uniforms.uSeeOn.value = this.overview ? 0 : 1;
    this.audio?.setListener(
      this.camera.position,
      this.camera.getWorldDirection(new THREE.Vector3()),
    );
    const size = this.renderer.getSize(new THREE.Vector2());
    if (this.lastW !== size.x || this.lastH !== size.y) {
      this.composer.setSize(size.x, size.y);
      this.lastW = size.x;
      this.lastH = size.y;
    }
    this.grade.uniforms.uAspect.value = size.x / size.y;
    if (this.gradedTheme !== this.environment.theme) {
      for (const [key, value] of Object.entries(this.environment.grade)) {
        const uniform = this.grade.uniforms[key];
        if (uniform) {
          if (Array.isArray(value)) uniform.value.fromArray(value);
          else uniform.value = value;
        }
      }
      this.gradedTheme = this.environment.theme;
    }
    this.bloom.enabled = this.grade.enabled = this.post;
    if (this.post || this.aoMode === 'realtime') this.composer.render(dt);
    else this.renderer.render(this.scene, this.camera);
    this.frames++;
  }
  snapshot() {
    const a = this.local;
    return {
      ready: !!this.ready,
      frameTimes: this.frameStats.snapshot(),
      presentation: this.presentation,
      clipWeights: this.clipCharacter ? {...this.clipCharacter.weights} : null,
      route: this.route ? {...this.route} : null,
      ao: { mode:this.aoMode, bakeMs:this.aoBakeMs, atlas:this.aoTexture?.image.width, rays:this.aoTexture?.userData.rays },
      skill: { name:this.skill.name, active:this.skill.active, time:this.skill.time, next:this.skill.next },
      feedbackLayers: {...this.feedbackLayers},
      frames: this.frames,
      ticks: this.clock.ticks,
      time: +this.time.toFixed(2),
      position: a?.pos.toArray().map((v) => +v.toFixed(3)),
      speed: a ? +Math.hypot(a.vel.x, a.vel.z).toFixed(2) : 0,
      grounded: a?.grounded,
      motor: a
        ? {
            y: a.pos.y,
            visualY: a.pos.y + a.smoothY,
            stepOffset: a.smoothY,
            jumpBuffer: a.jumpBuffer,
            coyote: a.coyote,
            groundNormal: a.groundN.toArray(),
            groundTeam: a.groundTeam,
          }
        : null,
      body: a?.character.dbg,
      cameraRig: this.rig
        ? {
            pivot: this.rig.pivot.toArray(),
            arm: this.rig.curDist,
            wantedArm: this.rig.wantDist,
            landingDip: this.rig.dipS.x,
            recoil: this.rig.kick,
            trauma: this.rig.trauma,
          }
        : null,
      form: a?.anim.form,
      ink: a ? +a.ink.toFixed(1) : 0,
      hp: a?.hp,
      coverage: this.paint?.coverage(),
      actors: this.actors.length,
      navNodes: this.nav?.nodes.length,
      textureLayers: this.texlib?.names.length,
      paintVersion: this.paint?.version,
      events: { ...this.events.counts },
      listeners: this.events.size,
      drawCalls: this.renderer.info.render.calls,
      triangles: this.renderer.info.render.triangles,
      geometries: this.renderer.info.memory.geometries,
      textures: this.renderer.info.memory.textures,
      audio: this.audio?.stats() || { state: "not started" },
      fx: this.fx?.stats(),
      goalScores: this.goalScores,
      botStates: this.bots.map((b) => ({
        name: b.a.name,
        position: b.a.pos.toArray(),
        mode: this.goalPolicy === "rescue" ? "rescue" : b.mode,
        goal: this.goalPolicy === "rescue" ? b.rescueGoal : b.goal,
        pathLength:
          (this.goalPolicy === "rescue" ? b.rescuePath : b.path)?.length || 0,
      })),
      probe: this.probe
        ? { ...this.probe, x: this.probeMesh.position.x }
        : null,
      propStats: this.props?.stats(),
      cameraMode: this.cameraMode,
      post: this.post,
      goalPolicy: this.goalPolicy,
      theme: this.environment?.theme,
      seed: this.seed,
      lastHit: this.lastHit,
      policy: this.policy,
      surface: surfaceResponse(this.stampTeam ? 2 : 1, 0, this.policy),
      droppedSeconds: this.clock.droppedSeconds,
    };
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.presentationToken++;
    this.skill.cancel();
    this.clipCharacter?.dispose();
    this.aoTexture?.dispose();
    this.ready = false;
    this.input.dispose();
    this.orbit?.dispose();
    this.hooks?.dispose();
    this.audio?.dispose();
    this.actors.forEach((a) => {
      a.weaponRunner.reset();
      a.character.dispose();
    });
    this.composer?.passes.forEach((p) => p.dispose?.());
    this.composer?.dispose();
    this.projectiles?.dispose();
    this.fx?.dispose();
    this.props?.dispose();
    this.environment?.dispose();
    this.paint?.dispose();
    this.texlib?.dispose();
    if (this.goalMarkers) {
      this.scene.remove(this.goalMarkers);
      this.goalMarkers.traverse((o) => {
        o.geometry?.dispose();
        o.material?.dispose();
      });
    }
    for (const o of [this.mesh, this.navDots, this.wire, this.probeMesh])
      if (o) {
        this.scene.remove(o);
        o.geometry.dispose();
        o.material.dispose();
      }
    this.events.clear();
    Object.assign(this.scene, {
      background: this.previous.background,
      environment: this.previous.environment,
      fog: this.previous.fog,
    });
    this.renderer.toneMapping = this.previous.toneMapping;
    this.renderer.toneMappingExposure = this.previous.exposure;
    this.renderer.shadowMap.enabled = this.previous.shadow;
    this.renderer.shadowMap.type = this.previous.shadowType;
  }
}
