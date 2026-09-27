// main.js
const V3 = THREE.Vector3;
const nextFrame = () => new Promise((r) => {
  let done = false;
  const go = () => { if (!done) { done = true; r(); } };
  requestAnimationFrame(go);
  setTimeout(go, 60);
});
const isTouch = matchMedia('(pointer: coarse)').matches;
const TIER = (() => {
  const s = Math.min(screen.width || innerWidth, screen.height || innerHeight);
  const mobile = !!(navigator.userAgentData && navigator.userAgentData.mobile);
  return (isTouch && s <= 500) || mobile ? 'phone' : isTouch ? 'tablet' : 'laptop';
})();
const TQ = {
  laptop: { q: 1, pr: [1.5, 1.5, 0.7], step: 0.15, shadow: 2048, soft: true, caustics: 512, farBlur: 1, post: { samples: 4, godDiv: 2, bloomDiv: 2 }, shadowEvery: 1 },
  tablet: { q: 0.75, pr: [1.25, 1.5, 0.7], step: 0.15, shadow: 2048, soft: true, caustics: 512, farBlur: 1, post: { samples: 4, godDiv: 2, bloomDiv: 2 }, shadowEvery: 1 },
  phone: { q: 0.4, pr: [1.25, 1.5, 0.6], step: 0.1, shadow: 1024, soft: false, caustics: 128, farBlur: 0, post: { samples: 0, godDiv: 6, bloomDiv: 4 }, shadowEvery: 4, detail: 0.35, rock: 0.6, fish: 0.45, scatter: 0.7, terrain: 1.4, sea: 0.6, fx: 0.5 },
}[TIER];
if (TIER === 'phone' && ((navigator.deviceMemory || 8) <= 4 || (navigator.hardwareConcurrency || 8) <= 4)) TQ.pr[0] -= TQ.step;
const QUALITY = TQ.q;
if (TIER === 'phone') document.documentElement.classList.add('tier-phone');
const SEED = (() => { const v = new URLSearchParams(location.search).get('seed'); return v !== null && /^\d+$/.test(v) ? +v : null; })();

UI.init();

const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false, premultipliedAlpha: !HDR_ASK });
const MAX_PR = Math.min(window.devicePixelRatio || 1, TQ.pr[0]);
const viewSize = () => [Math.max(2, canvas.clientWidth || window.innerWidth || 2), Math.max(2, canvas.clientHeight || window.innerHeight || 2)];
const capPR = () => { const [w, h] = viewSize(); return Math.max(Math.min(1, MAX_PR), Math.min(MAX_PR, Math.sqrt(4.1e6 / (w * h)))); };
let pr = capPR();
renderer.setPixelRatio(pr);
renderer.setSize(...viewSize(), false);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.shadowMap.autoUpdate = TQ.shadowEvery <= 1;
renderer.shadowMap.needsUpdate = true;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, 1, 0.06, 3000);
const baseFov = 60;
let fovAdd = 0;
function applyLens() {
  const f = FRAME.lens(baseFov + fovAdd);
  if (f !== camera.fov) { camera.fov = f; camera.updateProjectionMatrix(); }
}
function fitFov() {
  const [vw, vh] = viewSize();
  camera.aspect = FRAME.aspect(vw / vh);
  camera.updateProjectionMatrix();
  applyLens();
}
function easeFov(add, dt) {
  if (add === fovAdd) return;
  let n = fovAdd + (add - fovAdd) * (1 - Math.exp(-dt * 2));
  if (Math.abs(add - n) < 0.01) n = add;
  fovAdd = n;
  applyLens();
}
fitFov();
const NEED = { title: 0.44, dive: 0.6, explore: 0.62, clean: 0.5, assemble: 1.06, crank: 0.85, eclipse: 0.85, end: 0.85 };
function needNow() {
  const w = NEED[G.state] || NEED.title, k = FRAME.tall;
  if (!(k > 0)) return w;
  if (G.state === 'assemble' && !G.puzzle && G.asm && G.asm.pzDone) return lerp$4(w, 0.62, k);
  if (G.state === 'eclipse' && G.fin && !G.breached) return lerp$4(w, lerp$4(0.42, w, smoothstep(G.fin.RISE - 2.5, G.fin.RISE, G.st)), k);
  return w;
}

const SUN_TITLE = new V3(-0.3, 0.88, -0.36).normalize();
const SUN_GOLD = new V3(-0.9355, 0.0958, 0.3407).normalize();
new V3(0.30, 0.56, -0.77).normalize();
const sunDir = SUN_GOLD.clone();
function refracted(d, out) {
  const hl = Math.hypot(d.x, d.z) || 1;
  const sinA = Math.sqrt(Math.max(0, 1 - d.y * d.y));
  const sinW = sinA / 1.333, cosW = Math.sqrt(1 - sinW * sinW);
  return out.set((d.x / hl) * sinW, cosW, (d.z / hl) * sinW);
}
refracted(SUN_TITLE, U.uSunW.value);

const sun = new THREE.DirectionalLight(0xfff3df, 3.0);
sun.castShadow = true;
sun.shadow.mapSize.set(TQ.shadow, TQ.shadow);
Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 170 });
sun.shadow.camera.updateProjectionMatrix();
sun.shadow.bias = -3e-4;
sun.shadow.normalBias = 0.035;
scene.add(sun, sun.target);
const hemi = new THREE.HemisphereLight(0xa6ecff, 0x40584c, 0.9);
scene.add(hemi);
const glowLight = new THREE.PointLight(0xffc27a, 0, 11, 1.5);
scene.add(glowLight);
const TORCH_I = 2.0;
const torch = new THREE.SpotLight(0xffffff, 0, 0, 0.14, 0.9, 0);
torch.color.setRGB(0.62, 0.95, 0.88);
torch.position.set(0, -100, 0);
scene.add(torch, torch.target);

class SonarWave {
  constructor() {
    this.speed = 26;
    this.dur = 2.4;
    this.u = { uA: { value: 0 }, uTime: U.uTime };
    const shell = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 32), new THREE.ShaderMaterial({
      uniforms: this.u,
      vertexShader: `varying vec3 vN; varying vec3 vV; varying vec3 vP;
        void main(){ vN = normalize(normalMatrix * normal); vP = position; vec4 mv = modelViewMatrix * vec4(position, 1.0); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform float uA; uniform float uTime; varying vec3 vN; varying vec3 vV; varying vec3 vP;
        void main(){
          float f = pow(1.0 - abs(dot(vN, vV)), 2.2);
          float bands = 0.7 + 0.3 * sin(vP.y * 36.0 - uTime * 7.0);
          gl_FragColor = vec4(vec3(0.35, 1.0, 0.9) * f * bands * uA * 0.35, f * uA);
        }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    }));
    this.ringU = { uA: { value: 0 } };
    const ring = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
      uniforms: this.ringU,
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `uniform float uA; varying vec2 vUv;
        void main(){
          float r = length(vUv - 0.5) * 2.0;
          float band = smoothstep(0.86, 0.975, r) * smoothstep(1.0, 0.98, r);
          float wake = smoothstep(0.25, 0.975, r) * step(r, 0.975) * 0.1;
          float a = (band + wake) * uA;
          gl_FragColor = vec4(vec3(0.4, 1.0, 0.92) * a * 2.4, a);
        }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    }));
    ring.rotation.x = -Math.PI / 2;
    shell.frustumCulled = ring.frustumCulled = false;
    this.shell = shell;
    this.ring = ring;
    this.mesh = new THREE.Group();
    this.mesh.visible = false;
    this.t = 9;
    scene.add(this.mesh);
  }
  start(p) { this.t = 0; this.mesh.position.copy(p); this.mesh.visible = true; }
  update(dt) {
    if (!this.mesh.visible) { U.uPingA.value = 0; return; }
    this.t += dt;
    const r = 0.5 + this.t * this.speed;
    this.shell.scale.setScalar(r);
    this.ring.scale.setScalar(r);
    const k = Math.max(0, 1 - this.t / this.dur);
    const outside = smoothstep(-1.5, 1.5, camera.position.distanceTo(this.mesh.position) - r);
    this.u.uA.value = k * k * outside;
    this.ringU.uA.value = k;
    U.uPingPos.value.copy(this.mesh.position);
    U.uPingR.value = r;
    U.uPingA.value = Math.sqrt(k);
    if (this.t > this.dur) { this.mesh.visible = false; U.uPingA.value = 0; }
  }
}

let caustics, sky, ocean, world, wreck, surface, fx, mechanism, fragments, post, envUnder, envSky, heroEnv, sonar, prints;
let life$1 = null, critters$1 = null, magic$1 = null, diver$1 = null;
function mg(fn) {
  if (!magic$1) return;
  try { fn(magic$1); } catch (e) { console.warn('[antikythera] magic:', e); magic$1 = null; }
}
function hidePrompt() { if (UI.prompt) UI.prompt(0, 0, '', '', false); }
let audio$1 = new Proxy({}, { get: (_, k) => (k === 'breathe' ? () => ({ exhaleAt: 1.0 }) : k === 'toggleMute' ? () => false : () => {}) });
let obstacles = [];
let fishObs = [];
let capsules = [];
let playerCaps = [];
function jarCaps(amph, all = false) {
  const out = [], q = new THREE.Quaternion(), a = new V3(), b = new V3();
  const WHOLE = [[-0.23, 0.1, 0.155], [0.16, 0.44, 0.1]], BROKEN = [[-0.23, 0.06, 0.155]];
  for (const j of amph) {
    q.copy(j.quaternion);
    for (const [y0, y1, r] of j.kind === 2 ? BROKEN : WHOLE) {
      a.set(0, y0, 0).applyQuaternion(q).add(j.position);
      b.set(0, y1, 0).applyQuaternion(q).add(j.position);
      const fl = floorHeight((a.x + b.x) / 2, (a.z + b.z) / 2);
      if (!all && Math.max(a.y, b.y) + r < fl + 0.06) continue;
      if (!all && j.position.y - floorHeight(j.position.x, j.position.z) > 0.42) continue;
      out.push({ ax: a.x, ay: a.y, az: a.z, bx: b.x, by: b.y, bz: b.z, r: all ? r + 0.012 : r, jar: true });
    }
  }
  return out;
}
const player = new Player(camera, canvas);
const guide = new Guide(UI);
const ASM_SPEED = 1.85;
const raycaster = new THREE.Raycaster();

const G = {
  state: 'loading', st: 0, run: 0, timing: false,
  found: 0, months: 0, crankV: 0, crankInput: 0, hold: false, lastGlyph: 0, lastClack: 0, stopT: 0,
  breathT: 2.2, exhaleIn: -1, coverage: 0, sep: 2, exposure: 1, light: 1,
  mech: null, breached: false, diamond: false, shake: 0,
  sonarCD: 0, sonarT: 0, sonarUsed: false, siltAcc: 0,
  cleanItem: null, brush: null, autoBrush: false, misses: 0, puzzle: null, settleT: 0, blendT: 0,
  underOn: true,
};
const PSW = { sea: true, island: true, adapt: true };

const touch = new Touch({
  canvas, camera, player, G, UI,
  api: {
    sonar: () => sonarPing(),
    canBrush: () => G.state === 'explore' && !!G.cleanHint,
    target: () => (G.state === 'explore' ? cleanTarget() : null),
    rubStart: (it) => { if (G.state === 'explore' && it && it.state === 'buried') startClean(it); },
    brushFrom: (x, y, id) => {
      if (G.state !== 'clean') return;
      setPtr({ clientX: x, clientY: y, pointerType: 'touch' });
      ptr.down = true;
      ptr.button = 0;
      G.bRel = id; G.bRelX = x; G.bRelY = y; G.bRelSync = true;
      G.bMoved = U.uTime.value;
    },
    leave: () => abortClean(),
    cleaning: () => G.state === 'clean' && !!G.cleanItem && G.cleanItem.state === 'cleaning',
    cleanFrac: () => (G.closeup ? G.closeup.progress / CLEAN_TARGET : 0),
    faceable: () => G.sonarT > 0 || !!(UI.c && UI.c.mkOn) || !!G.lead,
    finds: () => (fragments ? fragments.items : []),
    busy: () => !!fragments && fragments.busy(),
    wheels: () => wheels,
    aimCentre: () => ptr.ndc.set(0, 0),
  },
});

const lookQ = (() => {
  const m = new THREE.Matrix4(), up = new V3(0, 1, 0);
  return (pos, target, roll = 0) => {
    m.lookAt(pos, target, up);
    const q = new THREE.Quaternion().setFromRotationMatrix(m);
    if (roll) q.multiply(new THREE.Quaternion().setFromAxisAngle(new V3(0, 0, 1), roll));
    return q;
  };
})();
const _lqM = new THREE.Matrix4(), _lqUp = new V3(0, 1, 0);
function lookInto(q, pos, target) { _lqM.lookAt(pos, target, _lqUp); return q.setFromRotationMatrix(_lqM); }

async function fontsReady() {
  try {
    await Promise.race([
      Promise.all([
        document.fonts.load('600 40px "Cinzel"', 'Antikythera'),
        document.fonts.load('400 20px "Alegreya Sans"', 'Begin the dive'),
        document.fonts.load('400 20px "EB Garamond"', 'ΑΒΓΔΕΖΗΘΣΩ Dive'),
      ]),
      new Promise((r) => setTimeout(r, 2500)),
    ]);
  } catch (e) {  }
}

let wheels = null;
let titleRoots = [], underRoots = [];

const bootMarks = [];
const mark = (s) => bootMarks.push([s, Math.round(performance.now())]);

async function boot() {
  mark('start');
  UI.loading(0.04, 'Charting the strait');
  await fontsReady();
  mark('fonts');
  let snap = new Set(scene.children);
  caustics = new Caustics(TQ.caustics);
  sky = new Sky(scene);
  ocean = new Ocean(scene, { detail: TQ.sea || 1 });
  titleRoots = scene.children.filter((c) => !snap.has(c));
  UI.loading(0.12, 'Raising the swell');
  await nextFrame();
  mark('sky+ocean');
  world = new World(scene, { quality: QUALITY * (TQ.scatter || 1), seed: Number.isFinite(G.seed) ? G.seed : SEED, detail: TQ.rock || 1, terrain: TQ.terrain || 1 });
  UI.loading(0.4, 'Growing the seagrass');
  await nextFrame();
  mark('world');
  wreck = new Wreck(scene, { detail: TQ.detail || 1 });
  UI.loading(0.52, 'Sinking the cargo');
  await nextFrame();
  mark('wreck');
  snap = new Set(scene.children);
  surface = new Surface(scene);
  fx = new FX(scene, { particles: TQ.fx || 1 });
  titleRoots.push(...scene.children.filter((c) => !snap.has(c)));
  sonar = new SonarWave();
  prints = new Prints(scene, groundAt);
  obstacles = [...world.obstacles, ...wreck.obstacles];
  fishObs = [...obstacles, ...(wreck.fishObstacles || [])];
  capsules = wreck.capsules || [];
  playerCaps = capsules.concat(jarCaps(wreck.amphorae || []));
  UI.loading(0.6, 'Cutting 1,900 bronze teeth');
  await nextFrame();
  mark('surface');
  mechanism = new Mechanism(scene, { aniso: renderer.capabilities.getMaxAnisotropy(), quality: Math.max(QUALITY, 1) });
  mark('mechanism');
  mechanism.group.updateMatrixWorld(true);
  const mb = new THREE.Box3().setFromObject(mechanism.group);
  G.mechBase = mb.min.y - mechanism.group.position.y;
  G.mech = { M: new V3(), yaw: 0, size: mb.getSize(new V3()) };
  siteApply(siteOf(new V3(LAYOUT.assembly.x, 0, LAYOUT.assembly.z), SITE_YAW, 'R'));
  UI.loading(0.74, 'Burying the fragments');
  await nextFrame();
  fragments = new Fragments(scene, fx, {
    onPickup: (i) => { audio$1.pickup(i); UI.hint(''); },
    onScan: () => audio$1.scan(1.1),
    onReveal: (i) => {
      const n = Math.min(3, fragments.collected + 1);
      UI.fact(i, { title: FACTS[i].title, text: FACTS[i].text, line: (touch.mode ? COPY.nextTouch : COPY.next)[n - 1] });
    },
    onUncover: (i) => audio$1.reveal(i),
    onTick: (c) => audio$1.tick(c),
    crack: (k) => audio$1.crack(k),
    onEcho: (i, delay) => { if (audio$1.echo) audio$1.echo(delay, i); },
    pour: () => audio$1.sandPour(1.4),
    kneel: () => audio$1.kneel?.(),
    onCollected: (i, n) => {
      UI.fillSlot(i);
      G.found = n;
      const next = routeTarget(player.pos);
      guide.event('discovered', {
        n, i, title: FACTS[i].title, text: FACTS[i].text,
        next: next ? bearing(player.pos.x, player.pos.z, player.yaw, next.item.home.x, next.item.home.z) : null,
      });
      if (n === 3) G.foundT = AIR_TOTAL - G.air;
      if (diver$1 && diver$1.bagFill) diver$1.bagFill(clamp$9(n / 3, 0, 1));
      audio$1.stow?.(n);
      if (n === 2) siteChoose(fragments.items.findIndex((x) => x.state === 'buried'), i);
      if (n === 3 && G.site && !G.site.placed) siteNow(true);
    },
  });
  UI.loading(0.82, 'Stocking the reef');
  await nextFrame();
  mark('fragments');
  const spots = {
    reefs: world.reefSpots,
    wreck: { x: LAYOUT.wreck.x, y: floorHeight(LAYOUT.wreck.x, LAYOUT.wreck.z), z: LAYOUT.wreck.z },
    hull: { x: LAYOUT.hull.x, y: floorHeight(LAYOUT.hull.x, LAYOUT.hull.z), z: LAYOUT.hull.z },
    meadow: LAYOUT.meadow,
  };
  try {
    const mod = await Promise.resolve().then(function () { return life; });
    life$1 = mod.createLife({
      scene, floorHeight: groundAt, obstacles: fishObs, patchMaterial, quality: QUALITY * (TQ.fish || 1), spots, fx,
      capsules: jarCaps(wreck.amphorae || [], true),
      rockTops: world.rockTops, rockSides: world.rockSides,
      solids: { capsules, scatter: [world.group, wreck.group], support: player.support },
      avoid: [...LAYOUT.frags.map((f) => ({ x: f.x, z: f.z, r: 2.4 })), { x: LAYOUT.assembly.x, z: LAYOUT.assembly.z, r: 5 }],
    });
  } catch (e) { console.warn('[antikythera] marine life unavailable:', e); }
  try {
    const mod = await Promise.resolve().then(function () { return critters; });
    critters$1 = mod.createCritters({
      scene, floorHeight: groundAt, rockTops: world.rockTops, rockSides: world.rockSides, amphorae: wreck.amphorae,
      avoid: [...LAYOUT.frags.map((f) => ({ x: f.x, z: f.z, r: 2.4 })), { x: LAYOUT.assembly.x, z: LAYOUT.assembly.z, r: 5 }, { x: LAYOUT.landing.x, z: LAYOUT.landing.z, r: 3.5 }],
      obstacles: fishObs, meadow: LAYOUT.meadow,
      patchMaterial, quality: QUALITY,
    });
  } catch (e) { console.warn('[antikythera] reef critters unavailable:', e); }
  try {
    const mod = await Promise.resolve().then(function () { return magic; });
    magic$1 = new mod.Magic(scene, { quality: QUALITY });
  } catch (e) { console.warn('[antikythera] magic effects unavailable:', e); }
  moonOrb = makeMoonOrb();
  FX_SCENE.add(moonOrb);
  try {
    const mod = await Promise.resolve().then(function () { return audio; });
    audio$1 = new mod.AudioEngine();
  } catch (e) { console.warn('[antikythera] audio unavailable:', e); }
  mark('life+critters+magic+audio');
  UI.loading(0.9, 'Lighting the sea');
  envUnder = makeUnderwaterEnv(renderer, U.uSunW.value);
  envSky = makeSkyEnv(renderer);
  heroEnv = makeHeroEnv(renderer);
  try {
    const mod = await Promise.resolve().then(function () { return diver; });
    diver$1 = mod.createDiver({ patchMaterial, envMap: envUnder, quality: 'high' });
  } catch (e) { console.warn('[antikythera] diver model unavailable, using a stand-in:', e); diver$1 = null; }
  if (!diver$1) diver$1 = makeStandInDiver();
  scene.add(diver$1.group);
  siteBake();
  await nextFrame();
  siteStand();
  for (let a = 0; a < 3; a++) {
    for (let b = 0; b < 3; b++) if (a !== b) SITE_CANDS[a][b] = siteFor(fragments.items[a].home, fragments.items[b].home, fragments.items.filter((x, k) => k !== a).map((x) => x.home));
    await nextFrame();
  }
  mark('sites');
  if (diver$1.onVent) {
    const _evp = new V3(), _evc = [0, 0, 0], _evq = new V3(), _evd = new V3(), _eva = new Array(13);
    diver$1.onVent((p, n, kind) => {
      if (n >= 20 && G.state === 'explore' && !player.valveUsed) n = 6;
      if (p.y < waveHeight(p.x, p.z, U.uTime.value) - 0.1) {
        if (kind === 'seep') {
          for (let i = 0; i < n; i++) fx._bubble(p.x + (Math.random() - 0.5) * 0.05, p.y, p.z + (Math.random() - 0.5) * 0.05, (Math.random() - 0.5) * 0.05, 0.15, (Math.random() - 0.5) * 0.05, 4, 0.0005 + 0.0015 * Math.random(), false);
          return;
        }
        fx.bubbleColumn(p.x, p.y, p.z, n); if (n < 12) EXH.n += n;
      }
    });
    diver$1.onStep((side, p, k) => {
      if (G.state === 'title' || p.y > -0.5) return;
      const S = player.support ? player.support(p.x, p.z) : groundAt(p.x, p.z), kind = player.supportKind || 0;
      if (p.y - S > 0.3) return;
      _evp.set(p.x, S + 0.02, p.z);
      const cur = player.drift || _zero3, fewer = 1 / (1 + 2.5 * Math.hypot(cur.x, cur.z));
      _evq.set(player.vel.x * 0.3 + cur.x * 0.6, 0, player.vel.z * 0.3 + cur.z * 0.6);
      if (kind === 1 || kind === 3) {
        bootKick(side === 'left' ? 1 : 0, p, S, kind, k, _evc, fewer);
        fx.grains(_evp, Math.round(3 + 4 * k), { spread: 0.08, up: 0.08 + 0.06 * k, push: _evq, ground: S });
        return;
      }
      sandAlbedo(p.x, p.z, 0.2, _evc);
      if (prints && kind === 0 && (G.state !== 'clean' || fragments.cu.downT < 0) && terrainAttrs(p.x, p.z, _eva)[3] > 0.5) {
        diver$1.group.getWorldDirection(_evd);
        const l = Math.hypot(_evd.x, _evd.z) || 1;
        prints.stamp(p.x, p.z, -_evd.x / l, -_evd.z / l, k, U.uTime.value);
      }
      bootKick(side === 'left' ? 1 : 0, p, S, kind, k, _evc, fewer);
    });
    if (diver$1.onDrip) diver$1.onDrip((p, sz) => { if (fx.spray && fx.spray.spawn) fx.spray.spawn(p.x, p.y, p.z, (Math.random() - 0.5) * 0.04, -0.15, (Math.random() - 0.5) * 0.04, 1.6, sz, 0.9, 0.93, 0.96); });
  }
  fragments.setDiver(diver$1);
  if (diver$1.setTetherLength) diver$1.setTetherLength(44.5);
  diver$1.setFade(0);
  titleRoots.push(diver$1.group);
  mechanism.setEnv(heroEnv, 0.85);
  for (const it of fragments.items) { it.gear.material.envMap = heroEnv; it.gear.material.envMapIntensity = 0.9; }
  fragments.items.forEach((it, i) => {
    const own = mechanism.gears && HERO_GEARS[i] && mechanism.gears[HERO_GEARS[i].id];
    if (!it.gear || !own || !own.mesh) return;
    const old = it.gear.geometry;
    it.gear.geometry = addAngleAttribute(own.mesh.geometry.clone());
    old.dispose();
  });
  fragments.tool.group.traverse((o) => { if (o.isMesh && o.material.metalness > 0.5) { o.material.envMap = heroEnv; o.material.envMapIntensity = 0.7; } });
  makeWheels();
  post = new Post(renderer, scene, camera, TQ.post);
  post.farBlur *= TQ.farBlur;
  post.lensText = new LensText(post, renderer);
  if (diver$1 && diver$1.setTetherWater) diver$1.setTetherWater({ ...WATER, uLightK: post.compMat.uniforms.uLightK });
  for (const w of wheels) w.mesh.traverse((o) => { if (o.isMesh && !o.material.transparent) { o.userData.sand = true; post.wheels.push(o); } });
  post.sandAt = floorHeight;
  for (const g of Object.values(mechanism.gears || {})) if (g.mesh) post.wheels.push(g.mesh);
  ABS_HOME.copy(post.compMat.uniforms.uAbs.value);
  gpuInit();
  if (fx.setAbsorption) fx.setAbsorption(post.compMat.uniforms.uAbs.value);
  mg((m) => m.setAbsorption && m.setAbsorption(post.compMat.uniforms.uAbs.value));
  setTitleCamera(0);
  await nextFrame();
  mark('assets');
  const titleSet = new Set(titleRoots);
  underRoots = scene.children.filter((c) => !titleSet.has(c) && !c.isLight && c !== sun.target && c !== torch.target);
  for (const o of underRoots) { o.userData.preHide = o.visible; o.visible = false; }
  scene.onBeforeRender = () => { if (!G.underOn) for (const o of underRoots) { o.userData.seaVis = o.visible; o.visible = false; } };
  scene.onAfterRender = () => { if (!G.underOn) for (const o of underRoots) o.visible = o.userData.seaVis; };
  let creep = 0.9;
  const creepT = setInterval(() => { creep += (0.99 - creep) * 0.08; UI.loading(creep, 'Polishing the bronze'); }, 200);
  try {
    scene.environment = envSky;
    renderer.setRenderTarget(post.sceneRT);
    const ps = titleRoots.map((o) => (renderer.compileAsync ? renderer.compileAsync(o, camera, scene) : renderer.compile(o, camera, scene)));
    renderer.setRenderTarget(null);
    await Promise.all(ps);
  } catch (e) { console.warn(e); }
  renderer.setRenderTarget(null);
  clearInterval(creepT);
  mark('compiled-title');
  startAudio();
  if (player.restPose) { try { player.restPose(new V3(), 0, -0.12, moveEnv()); } catch (e) {  } }
  try { await post.warm([caustics]); } catch (e) { console.warn(e); }
  for (const tx of texturesOf(titleRoots)) { try { renderer.initTexture(tx); } catch (e) {  } }
  setState('title');
  for (let i = 0; i < 2; i++) { tick(last + 1000 / 60); await nextFrame(); }
  const casters = [];
  for (const r of titleRoots) r.traverse((o) => { if ((o.isMesh || o.isPoints || o.isLine) && o.castShadow && o.geometry) casters.push(o); });
  warmDraw(casters, scene.environment);
  mark('warmed-title');
  {
    const creepT2 = setInterval(() => { creep += (0.995 - creep) * 0.06; UI.loading(creep); }, 200);
    G.underFast = true;
    const under = precompileUnder().catch((e) => console.warn(e));
    await Promise.race([under, new Promise((r) => setTimeout(r, UNDER_WAIT * 1000))]);
    G.underFast = false;
    clearInterval(creepT2);
    UI.loading(1);
  }
  UI.hideLoading();
  last = performance.now();
  requestAnimationFrame(frame);
  const auto = new URLSearchParams(location.hash.slice(1)).get('auto');
  if (auto) runAuto(auto);
}

function texturesOf(roots) {
  const texs = new Set();
  const grab = (v) => { if (v && v.isTexture && !v.isRenderTargetTexture && !v.isDepthTexture && v.image) texs.add(v); };
  for (const o of roots) {
    o.traverse((c) => {
      const ms = c.material ? (Array.isArray(c.material) ? c.material : [c.material]) : [];
      for (const m of ms) {
        for (const k in m) grab(m[k]);
        if (m.uniforms) for (const k in m.uniforms) grab(m.uniforms[k] && m.uniforms[k].value);
      }
    });
  }
  return texs;
}

const UNDER_WAIT = 20;
async function precompileUnder() {
  const ps = [];
  for (const o of underRoots) {
    const envWas = scene.environment;
    try {
      scene.environment = envUnder;
      renderer.setRenderTarget(post.sceneRT);
      ps.push(renderer.compileAsync ? renderer.compileAsync(o, camera, scene) : Promise.resolve(renderer.compile(o, camera, scene)));
    } catch (e) { console.warn(e); }
    renderer.setRenderTarget(null);
    scene.environment = envWas;
    if (!G.underFast) await nextFrame();
  }
  await Promise.allSettled(ps);
  mark('compiled-under');
  let nt = 0;
  for (const t of texturesOf(underRoots)) {
    try { renderer.initTexture(t); } catch (e) {  }
    if (!G.underFast || ++nt % 4 === 0) await nextFrame();
  }
  mark('textures');
  await warmUnder();
  mark('warmed');
  G.compiled = true;
  revealUnder();
  diveAskedGo();
}

const WARM_LAYER = 7;
async function warmUnder() {
  if (!post || !post.sceneRT) return;
  const list = [];
  scene.traverse((o) => {
    if (!(o.isMesh || o.isPoints || o.isLine || o.isSprite) || !o.geometry) return;
    let shown = true;
    for (let p = o; p; p = p.parent) if (!p.visible) { shown = false; break; }
    const idle = (o.isInstancedMesh && o.count === 0) || o.geometry.drawRange.count === 0;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const unseen = !(o.geometry._listeners && o.geometry._listeners.dispose && o.geometry._listeners.dispose.length);
    if (!shown || idle || unseen || mats.some((m) => m && m.visible === false)) list.push(o);
  });
  let i = 0;
  while (i < list.length) {
    const batch = [];
    const bn = G.underFast ? 24 : 10, bv = G.underFast ? 600000 : 200000;
    for (let verts = 0; i < list.length && batch.length < bn && verts < bv; i++) {
      batch.push(list[i]);
      const pos = list[i].geometry.attributes.position;
      verts += pos ? pos.count : 0;
    }
    warmDraw(batch, envUnder);
    await nextFrame();
  }
}
function warmDraw(objs, env) {
  const hook = THREE.Object3D.prototype.onBeforeRender;
  const lights = [];
  scene.traverse((o) => { if (o.isLight) { o.layers.enable(WARM_LAYER); lights.push(o); } });
  const cam = camera.clone();
  cam.layers.set(WARM_LAYER);
  const envWas = scene.environment;
  const shown = [], undo = [], mShown = [];
  for (const o of objs) {
    undo.push([o, o.frustumCulled, o.isInstancedMesh ? o.count : -1, o.geometry.drawRange.count, o.onBeforeRender]);
    if (o.onBeforeRender !== hook) o.onBeforeRender = hook;
    o.layers.enable(WARM_LAYER);
    o.frustumCulled = false;
    if (o.isInstancedMesh && o.count === 0) o.count = 1;
    if (o.geometry.drawRange.count === 0) o.geometry.drawRange.count = 3;
    for (let p = o; p; p = p.parent) if (!p.visible) { p.visible = true; shown.push(p); }
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) if (m && m.visible === false) { m.visible = true; mShown.push(m); }
  }
  try {
    scene.environment = env;
    renderer.setRenderTarget(post.sceneRT);
    renderer.render(scene, cam);
  } catch (e) { console.warn(e); }
  renderer.setRenderTarget(null);
  scene.environment = envWas;
  for (const p of shown) p.visible = false;
  for (const m of mShown) m.visible = false;
  for (let k = undo.length - 1; k >= 0; k--) {
    const [o, fc, n, dr, obr] = undo[k];
    o.onBeforeRender = obr;
    o.frustumCulled = fc;
    if (n >= 0) o.count = n;
    o.geometry.drawRange.count = dr;
    o.layers.disable(WARM_LAYER);
  }
  for (const l of lights) l.layers.disable(WARM_LAYER);
}

function revealUnder() {
  if (!G.compiled || G.revealed || G.state === 'title' || G.state === 'loading') return;
  const n = G.state === 'dive' && G.dive && G.dive.v19 ? 2 : underRoots.length;
  let i = G.revealI || 0;
  for (const end = Math.min(underRoots.length, i + n); i < end; i++) underRoots[i].visible = underRoots[i].userData.preHide !== false;
  G.revealI = i;
  if (i >= underRoots.length) G.revealed = true;
}

function runAuto(what) {
  const until = (cond, then) => { const i = setInterval(() => { if (cond()) { clearInterval(i); then(); } }, 100); };
  until(() => UI.ldGone, startDive);
  until(() => G.state === 'explore', () => {
    if (what === 'explore') return;
    if (what === 'journal') { setTimeout(() => UI.journal && UI.journal.open(true), 1500); return; }
    if (what === 'discover' || what === 'radio') {
      const it = fragments.items[0];
      player.place(it.home.clone().add(new V3(1.8, 0.8, 1.2)), Math.atan2(1.8, 1.2), -0.2);
      if (what === 'radio') return;
      setTimeout(() => { startClean(it); G.eHeld = true; }, 800);
      until(() => G.state === 'explore' && it.state === 'collecting' && it.t > 2.4, () => { G.eHeld = false; G.paused = true; });
    }
  });
}

function setState(s) {
  G.lensAdd = 0;
  const prev = G.state;
  G.state = s;
  G.st = 0;
  const enter = ENTER[s];
  if (enter) enter(prev);
}

const ENTER = {
  title() {
    UI.showTitle(true);
    audio$1.setMode('title');
    audio$1.setMusic('title');
  },
  dive() {
    UI.showTitle(false);
    G.timing = true;
    G.run = 0;
    G.dive = { from: camera.position.clone(), fromQ: camera.quaternion.clone(), splashed: false, dolphins: false };
    if (diver$1 && diver$1.setTetherFade) diver$1.setTetherFade(1);
    if (diver$1 && diver$1.setTether && surface && surface.boat) enterDive19();
    audio$1.setMusic('off');
  },
  explore(prev) {
    audio$1.setMusic('explore');
    if (prev !== 'clean') sunDir.copy(SUN_TITLE);
    if (life$1 && life$1.rare) life$1.rare.auto(true);
    G.hoPath = prev === 'dive' && !!(G.dive && G.dive.v19); G.hoP = null;
    if (prev === 'dive' && G.dive && G.dive.v19) {
      const D = G.dive;
      G.cine = { pos: camera.position.clone(), q: camera.quaternion.clone(), v: OP19.Vout.clone(), dq: camera.quaternion.clone().multiply(OP19.qPrev.clone().invert()), ref: new V3() };
      G.hoT = 0;
      G.hoOff = null;
      player.place(diver$1.group.position.clone(), Number.isFinite(D.psi) ? D.psi : D.psiLand, -0.12);
      player.vel.set(0, 0, 0);
      player.body.pitch = 0;
      G.glide = null;
      player.lastInput = performance.now();
      G.blendT = G.blendDur = 6;
      G.hoDive = true;
      G.air = AIR_TOTAL;
      G.airOn = true;
      G.airWarn = 0;
      G.foundT = null;
      G.hudAt = 0.9;
      G.hintAt = 1.9;
      if (diver$1.setTetherLength) diver$1.setTetherLength(60, 60);
      if (diver$1.setTetherPayOnly) diver$1.setTetherPayOnly(false, { rate: 0.4, dur: 3 });
      if (diver$1.setTetherCheck) diver$1.setTetherCheck(0, 0);
      G.hoDip0 = D.touch ? Math.max(0, D.dp || 0) : 0; G.hoDipT = 0;
      if (diver$1.setLandDip) diver$1.setLandDip(G.hoDip0);
      if (diver$1.reach) { diver$1.reach('right', null, 0); diver$1.reach('left', null, 0); }
      if (diver$1.setLinePin) diver$1.setLinePin(null);
      if (surface) surface.diverLoad = null;
      guide.event('explore-start');
    } else if (prev === 'dive') {
      G.cine = { pos: camera.position.clone(), q: camera.quaternion.clone(), v: G.dive && G.dive.camV ? G.dive.camV.clone() : new V3() };
      G.cine.dq = G.dive && G.dive.prevQ ? camera.quaternion.clone().multiply(G.dive.prevQ.clone().invert()) : null;
      G.hoT = 0;
      const f = DV.f, pitch = Math.asin(clamp$9(f.y, -1, 1));
      player.place(DV.p.clone(), Math.atan2(-f.x, -f.z), clamp$9(pitch, -0.9, 0.25));
      player.vel.set(0, 0, 0);
      G.glide = { v: DV.v.clone(), t: 0 };
      G.cine.ref = new V3();
      player.body.pitch = clamp$9(pitch, -1, 0.8);
      player.lastInput = performance.now();
      G.blendT = G.blendDur = 6;
      G.hoDive = true;
      G.air = AIR_TOTAL;
      G.airOn = true;
      G.airWarn = 0;
      G.foundT = null;
      G.hudAt = 0.9;
      G.hintAt = 1.9;
      guide.event('explore-start');
    } else if (prev === 'clean') {
      G.cine = { pos: camera.position.clone(), q: camera.quaternion.clone(), v: _tcV.clone(), ref: new V3() };
      G.arcSpin = _tcW.clone();
      const ex = fragments.closeupExit();
      _hbF.set(0, 0, -1).applyQuaternion(camera.quaternion);
      player.place(ex.pos, Math.atan2(-_hbF.x, -_hbF.z), Math.asin(clamp$9(_hbF.y, -1, 1)), { bodyYaw: ex.yaw });
      player.body.pitch = ex.bodyPitch;
      G.blendT = G.blendDur = 6;
      G.hoDive = false;
      G.hoOff = null;
      G.hoArc0 = 0;
      G.hoArcT = 0;
      G.hoArcDir = null;
      G.blendArc = true;
      G.fb = 0;
      G.arcFocus = new V3(0, 0, -1).applyQuaternion(G.cine.q).multiplyScalar(camera.position.distanceTo(ex.pos)).add(camera.position);
      if (life$1 && life$1.setFeed) life$1.setFeed(null, false);
    } else {
      UI.showHUD(true);
    }
    player.enabled = true;
    if (prev !== 'dive') UI.showSonar(true);
  },
  clean(prev) {
    const it = G.cleanItem;
    if (G.site && !G.site.placed && it && it.state === 'buried' && fragments.items.filter((x) => x.state === 'buried').length === 1) siteNow(true);
    player.enabled = false;
    player.pressing = player.holding = false;
    fragments.beginCloseup(it, { camera, diver: diver$1, player, env: moveEnv(), fovBase: baseFov });
    G.cuHo = prev === 'explore' ? { x: new V3(), v: _tcV.clone(), r: new V3(), w: _tcW.clone(), t: 0 } : null;
    if (life$1 && life$1.setFeed) life$1.setFeed(it.home, true);
    guide.event('clean-start');
    G.bndc = G.bndc || new THREE.Vector2();
    G.bMoved = 0;
    G.bRel = null;
    UI.hint('');
    hidePrompt();
    G.cleanHint = false;
    UI.marker(0, 0, 0, false, true);
    UI.showSonar(false);
    UI.showClean(true, fragments.collected === 0);
    UI.clean(0);
    canvas.classList.add('mode-brush');
  },
  assemble(prev) {
    G.airOn = false;
    player.enabled = false;
    player.releaseLock();
    UI.hint('');
    UI.story('');
    UI.hideFact();
    UI.showHUD(false);
    UI.showSonar(false);
    UI.marker(0, 0, 0, false, true);
    UI.letterbox(true);
    hidePrompt();
    G.settleT = 0;
    G.flyC = null;
    guide.event('assemble');
    mg((m) => { m.begin(G.mech.M, G.mech.yaw, G.mech.size); m.setCharge(0.15); });
    G.asm = { t: 0, T: 0, started: true, seat: null, rig: false, pending: undefined, step: -2, walkIn: false, rock: -1 };
    G.lens = { x: fovAdd, v: 0, to: ASM_LENS, w: 1.9 };
    G.lensAdd = fovAdd;
    asmBegin(!!(diver$1 && diver$1.group.visible && (prev === 'explore' || prev === 'clean')));
    rigTake();
    audio$1.assembleSwell();
    audio$1.setMusic('assemble');
    mechanism.startAssembly({
      fx, onLand: landPart, onSocket: asmSocket,
      onCrack: (k, big) => { audio$1.crack(0.6 + 0.4 * big); audio$1.sandPour(0.5); },
      onLump: (k, left, total) => fragments.openLump(k, left, total),
      pile: fragments.pile && fragments.pile[0].mesh.visible ? fragments.pileLumps() : null,
    });
  },
  crank() {
    UI.showCrank(true);
    UI.crank(0, 0);
    guide.event('crank');
    mechanism.setAvoid(null);
    crankHint('');
    audio$1.setMusic('crank');
    G.ckSaid = false;
    G.ckGo = false;
    G.ckCue = null;
    canvas.classList.add('mode-crank');
    G.crankV = 0;
    G.months = 0;
    G.stopT = 0;
    G.holdT = 0;
    G.crankTurn = 0;
    G.crankW = 0;
    G.arrived = false;
    G.glyphP = null;
    G.ckLens0 = fovAdd;
    G.orbC = G.mech.M.clone().add(new V3(0, Math.max(G.mech.size.y, 0.8) * 0.5 + 1.3, 0));
    G.ck = crankKeys();
    const walking = !!(G.asm && G.asm.walkIn);
    if (!walking) { G.ckStand = null; G.ckLen = 0; }
    G.ckGrip = 0;
    G.ckApp = 0;
    G.ckInU = 0;
    G.camC = 0;
    G.camCV = 0;
    G.camTrack = null;
    const M = G.mech.M, cp = camera.position, t0 = U.uTime.value;
    G.ckIn = {
      phi: Math.atan2(cp.x - M.x, cp.z - M.z) - G.mech.yaw - Math.sin(t0 * 0.23) * 0.02,
      r: Math.hypot(cp.x - M.x, cp.z - M.z) / FRAME.reach(baseFov + fovAdd),
      h: cp.y - M.y - Math.sin(t0 * 0.31) * 0.025,
      look: cp.clone().add(new V3(0, 0, -1).applyQuaternion(camera.quaternion).multiplyScalar(Math.max(1, cp.distanceTo(M)))),
    };
    mg((m) => m.orrery(true));
    const Sv = G.site, C = _ckC.set(G.mech.M.x, G.mech.M.y + G.mech.size.y / 2 + ORR_LIFT, G.mech.M.z);
    const exV = _ckX.set(Math.sin(G.mech.yaw), 0, Math.cos(G.mech.yaw)).addScaledVector(Sv.nV, -Sv.nV.z * Math.cos(G.mech.yaw) - Sv.nV.x * Math.sin(G.mech.yaw)).normalize();
    const eyV = _ckY.crossVectors(Sv.nV, exV), dE = _ckD.subVectors(Sv.E, C);
    mg((m) => { m.setLonOffset(Math.atan2(dE.dot(eyV), dE.dot(exV)) - skyState(SAROS).sun * DEG$3 - SUN_SHORT); m.setMoonLine(MOON_W, 1, null); m.setMoonLook(moonLit(), 1); });
  },
  eclipse() {
    UI.showCrank(false);
    guide.event('eclipse');
    canvas.classList.remove('mode-crank');
    G.orbOff = false;
    mg((m) => m.setCharge(0.55));
    G.orrFlat = false;
    if (mechanism.setEnergy) mechanism.setEnergy(0.2);
    audio$1.setCrank(0);
    audio$1.setMusic('eclipse');
    G.breached = false;
    G.finLine = false;
    G.lbOff = false;
    if (camera.aspect >= 1 && camera.aspect < 1.5) { G.lbOff = true; UI.letterbox(false, 1.6); }
    G.clear = 0;
    G.wet = 0;
    G.coverage = 0;
    G.glowHome = null;
    const ct = G.camTrack;
    G.finV0 = ct && ct.init ? ct.v.clone().clampLength(0, 1.5) : null;
    G.lookS = ct && ct.init ? ct.f.clone() : null;
    G.lookSV = ct && ct.init ? ct.fv.clone().clampLength(0, 0.6) : new V3();
    G.lookT = null;
    G.breachT = 0;
    SKY_UNIFORMS.uEclipse.value = 0;
    SKY_UNIFORMS.uBead.value.w = 0;
    if (SKY_UNIFORMS.uMoonLit) SKY_UNIFORMS.uMoonLit.value = 1;
    if (SKY_UNIFORMS.uMoonPhase) SKY_UNIFORMS.uMoonPhase.value = -1;
    G.fin = buildRise();
    G.dvGone = false;
    mg((m) => m.setMoonLine(MOON_W, 1, null));
    mg((m) => { if (m.setFacing) m.setFacing(null); m.alignFlash(); });
    UI.story('It modeled the Sun\u00a0and\u00a0Moon and predicted eclipses.', { ms: 4700, delay: 600, after: true });
  },
  end() {
    G.timing = false;
    UI.letterbox(false);
    UI.showHUD(false);
    UI.showEnd(G.found >= 3 && Number.isFinite(G.foundT) ? G.foundT : G.found >= 3 && Number.isFinite(G.air) ? AIR_TOTAL - G.air : null);
    audio$1.setMode('surface');
    audio$1.setMusic('end');
    G.endFrom = G.fin ? G.fin.S.clone() : surfacePoint();
    G.endCam = null;
    G.endMore = false;
    G.endHintOn = false;
    const z = () => ({ yaw: 0, pitch: 0, dolly: 0 });
    G.eo = { at: z(), v: z(), want: z(), ptrs: new Map(), pinch: 0, pinch0: 0, moved: 0, used: false, tookT: -1, keep: 0, keepK: 0 };
  },
};

const AIR_TOTAL = 120;
const _ckC = new V3(), _ckX = new V3(), _ckY = new V3(), _ckD = new V3();
function airHeld() {
  if (G.state === 'clean') { const s = G.cleanItem && G.cleanItem.state; return s === 'lifting' || s === 'collecting'; }
  return G.state === 'explore' && (fragments.busy() || UI.factUp());
}
function airCues() {
  const W = COPY.air;
  while (G.airWarn < W.length && G.air < W[G.airWarn][0]) {
    const [, text, level] = W[G.airWarn++];
    UI.airWarn(text, level);
    if (audio$1.airWarn) audio$1.airWarn(level, G.air);
  }
  if (G.air <= 0 && G.airWarn <= W.length) {
    G.airWarn = W.length + 1;
    if (window.__akNoAirFail) return;
    audio$1.outOfAir?.();
    G.airOn = false;
    player.enabled = false;
    UI.hint('');
    hidePrompt();
    UI.story('Hauled up to the boat.', { ms: 4600 });
    setTimeout(() => UI.fadeOut(true), 2800);
    setTimeout(() => location.reload(), 4400);
  }
}

const _gc = new V3(), _zero3 = new V3(), _hoQ = new THREE.Quaternion();
const _lsP = new V3();
function glideCurrent(x, y, z) {
  const c = currentAt(x);
  const k = Math.exp(-G.glide.t / 1.3) / 0.3;
  return _gc.set(c.x + G.glide.v.x * k, c.y + G.glide.v.y * k * 0.6, c.z + G.glide.v.z * k);
}

const _tpE = new THREE.Euler(0, 0, 0, 'YXZ'), _tpB = new V3();
function titlePose(t) {
  const c = LAYOUT.titleCam;
  const pos = new V3(c.x + Math.sin(t * 0.11) * 0.35, c.y + waveHeight(c.x, c.z, t) * 0.75, c.z);
  const roll = Math.sin(t * 0.5) * 0.012 + waveHeight(c.x + 1.5, c.z, t) * 0.01;
  if (c.hz == null) {
    const target = new V3(c.lookX + Math.sin(t * 0.07) * 4, c.lookY + Math.sin(t * 0.13) * 0.6, c.lookZ);
    return { pos, q: lookQ(pos, target, roll) };
  }
  if (!G.titleB) G.titleB = surface && surface.boat ? surface.boat.group.position.clone() : new V3(LAYOUT.boat.x, 0, LAYOUT.boat.z);
  _tpB.copy(G.titleB);
  const F = c.fov || 60, a = camera.aspect, vt = Math.tan((FRAME.lens(F) * DEG$3) / 2), ht = vt * a;
  const back0 = clamp$9(Math.pow(1.7778 / a, 0.85), 1, 1.45);
  const back = a >= 1.25 ? back0 : Math.max(back0 * (1 - FRAME.tall), 1.349 * FRAME.reach(F));
  pos.x = _tpB.x + (pos.x - _tpB.x) * back;
  pos.z = _tpB.z + (pos.z - _tpB.z) * back;
  const bx = FRAME.x(c.bx - 0.05 * clamp$9((1.78 - a) / 0.6, 0, 1));
  const yaw = Math.atan2(-(_tpB.x - pos.x), -(_tpB.z - pos.z)) + Math.atan((2 * bx - 1) * ht) + Math.sin(t * 0.07) * 0.012;
  const pitch = Math.atan((2 * FRAME.y(c.hz, 0.42) - 1) * vt) + Math.sin(t * 0.13) * 0.005;
  return { pos, q: new THREE.Quaternion().setFromEuler(_tpE.set(pitch, yaw, roll)) };
}
function setTitleCamera(t) {
  G.lensAdd = (LAYOUT.titleCam.fov || 60) - 60;
  const p = titlePose(t);
  camera.position.copy(p.pos);
  camera.quaternion.copy(p.q);
}

const DV = {
  p: new V3(), v: new V3(), f: new V3(0, 0, -1), q: new THREE.Quaternion(), qs: new THREE.Quaternion(),
  cam: new V3(), look: new V3(), tgt: new V3(), up: new V3(0, 1, 0), wreck: new V3(LAYOUT.wreck.x + 1, -17.2, LAYOUT.wreck.z + 4),
};
const _flat = new V3();
const BS = { local: new V3(), foot: new V3(), out: new V3(), up: new V3(), along: new V3(), q: new THREE.Quaternion(), side: 0 };
function boatStand(ref) {
  const bg = surface.boat.group;
  bg.updateMatrixWorld();
  if (!BS.side) {
    const ds = bg.userData.diverSpot;
    if (ds && ds.pos && ds.rail) {
      BS.side = ds.out && ds.out.x < 0 ? -1 : 1;
      BS.local.set(ds.rail.x, ds.rail.y + 0.02, ds.rail.z);
    } else {
      const loc = bg.worldToLocal((ref || camera.position).clone());
      BS.side = loc.x >= 0 ? 1 : -1;
      const z = -1.2, dk = deckAt(z);
      BS.local.set(BS.side * (dk.xe + 0.05), dk.ys + 0.02, z);
    }
  }
  BS.foot.copy(BS.local).applyMatrix4(bg.matrixWorld);
  bg.getWorldQuaternion(BS.q);
  BS.out.set(BS.side, 0, 0).applyQuaternion(BS.q);
  BS.up.set(0, 1, 0).applyQuaternion(BS.q);
  BS.along.set(0, 0, 1).applyQuaternion(BS.q);
  return BS;
}
const _tHose = new V3();
function diverTethers(onDeck) {
  if (!diver$1 || !diver$1.setTether || !surface || !surface.boat) return;
  const bt = surface.boat, g = bt.group, A = (g.userData && g.userData.tetherPoint) || {};
  g.updateMatrixWorld();
  const side = BS.side || 1;
  const hose = onDeck ? A.pump : A.pos;
  if (hose) _tHose.copy(hose);
  else { const z = onDeck ? -1.3 : -1.45, dk = deckAt(z); _tHose.set(onDeck ? 0.25 * side : side * (dk.xe + 0.03), dk.ys + (onDeck ? 0.78 : 0.22), z); }
  _tHose.applyMatrix4(g.matrixWorld);
  diver$1.setTether(_tHose);
}
const _obX = new V3(), _obY = new V3(), _obZ = new V3(), _obM = new THREE.Matrix4();
function orientTo(q, dir, up) {
  _obZ.copy(dir).negate().normalize();
  _obX.crossVectors(up, _obZ);
  if (_obX.lengthSq() < 1e-6) _obX.set(1, 0, 0);
  _obX.normalize();
  _obY.crossVectors(_obZ, _obX).normalize();
  _obM.makeBasis(_obX, _obY, _obZ);
  return q.setFromRotationMatrix(_obM);
}
function titleDiver(dt, t) {
  if (!diver$1 || !surface) return;
  if (diver$1.setTether && surface.boat) { titleDiver19(dt, t); return; }
  const S = boatStand(camera.position);
  diver$1.group.position.copy(S.foot).addScaledVector(S.up, 0.95);
  diver$1.group.quaternion.copy(orientTo(DV.q, S.out, S.up));
  DV.look.copy(S.out).addScaledVector(S.along, Math.sin(t * 0.21) * 0.5);
  diverTethers(true);
  diver$1.update(dt, t, { speed: 0, thrust: 0, turnRate: 0, climb: 0, lookDir: DV.look, reach: 0, pose: 'deck', floor: S.foot.y });
  diver$1.setFade(1);
}

const _dvPrev = new V3(), _dvD = new V3(), _dvW = new V3(), _dvQ = new THREE.Quaternion();
function updateDiveLegacy(dt, t) {
  const T = G.st, D = G.dive, h = Math.min(dt, 1 / 30);
  const S = boatStand(D.from);
  if (!D.init) {
    D.init = true;
    D.phase = 'stand';
    D.tAir = 0;
    D.tWater = 0;
    D.camV = new V3();
  }
  if (D.phase === 'stand') {
    DV.p.copy(S.foot).addScaledVector(S.up, 0.95);
    orientTo(DV.qs, S.out, S.up);
    if (diver$1) {
      diver$1.group.position.copy(DV.p);
      diver$1.group.quaternion.copy(DV.qs);
      diver$1.update(h, t, { speed: 0, thrust: 0, turnRate: 0, climb: 0, lookDir: S.out, reach: 0, pose: T > 1.15 ? 'crouch' : 'stand' });
      diver$1.setFade(1);
    }
    const td = Math.min(T, 3);
    DV.cam.copy(S.foot).addScaledVector(S.along, 5.4 - 0.25 * td).addScaledVector(S.out, 1.9 + 0.2 * td);
    DV.cam.y = 1.25 + waveHeight(DV.cam.x, DV.cam.z, t) * 0.6;
    const u = easeInOut$1(clamp$9(T / 1.7, 0, 1));
    G.lensAdd = ((LAYOUT.titleCam.fov || 60) - 60) * (1 - u);
    _dvPrev.copy(camera.position);
    camera.position.copy(D.from).lerp(DV.cam, u);
    DV.look.copy(S.foot).addScaledVector(S.up, 1.1).addScaledVector(S.out, 0.8);
    camera.quaternion.copy(D.fromQ).slerp(lookQ(camera.position, DV.look), u);
    D.camV.subVectors(camera.position, _dvPrev).divideScalar(h);
    DV.cam.copy(camera.position);
    if (T > 1.85) {
      if (!G.compiled) { if (T > 2.9) guide.once('air', 'Checking your air. One moment.', 2600); }
      else {
        D.phase = 'air';
        DV.v.copy(S.out).multiplyScalar(2.8).addScaledVector(DV.up, 2.2);
        const drop = DV.p.y - (waveHeight(DV.p.x, DV.p.z, t) - 0.15);
        D.airT = (2.2 + Math.sqrt(2.2 * 2.2 + 19.6 * Math.max(0, drop))) / 9.8;
        if (diver$1) diver$1.setPose('streamline', 0.22);
      }
    }
  } else {
    const surf = waveHeight(DV.p.x, DV.p.z, t);
    if (D.phase === 'air') {
      D.tAir += h;
      DV.v.y -= 9.8 * h;
      if (diver$1 && diver$1.diveProgress) diver$1.diveProgress(clamp$9(D.tAir / (D.airT || 0.9), 0, 1));
      if (DV.p.y < surf - 0.15) {
        D.phase = 'water';
        if (diver$1 && diver$1.diveProgress) diver$1.diveProgress(1);
        audio$1.splash();
        if (life$1 && life$1.setDescent) life$1.setDescent(DV.p, DV.wreck);
        fx.burstAt(DV.tgt.set(DV.p.x, surf - 0.3, DV.p.z), 1);
        fx.splashAt(DV.tgt.set(DV.p.x, surf, DV.p.z), clamp$9(DV.v.length() / 6, 0.7, 1.4));
        D.entry = new V3(DV.p.x, surf, DV.p.z);
        G.shake = Math.max(G.shake, 0.06);
      }
    } else {
      D.tWater += h;
      const k = smoothstep(0.3, 1.3, D.tWater);
      DV.tgt.copy(DV.wreck).sub(DV.p);
      DV.tgt.y *= smoothstep(1.5, 6, DV.tgt.length());
      DV.tgt.normalize().multiplyScalar(4.0);
      DV.v.multiplyScalar(Math.exp(-2.4 * h * (1 - k)));
      DV.v.lerp(DV.tgt, (1 - Math.exp(-2.4 * h)) * k);
      if (D.tWater < 1.1) fx.bubbleColumn(DV.p.x, DV.p.y + 0.3, DV.p.z, 3);
    }
    DV.p.addScaledVector(DV.v, h);
    const vl = DV.v.length();
    if (vl > 0.05) DV.f.copy(DV.v).divideScalar(vl);
    orientTo(DV.q, DV.f, DV.up);
    const swim = D.phase === 'water' && D.tWater > 0.45;
    if (diver$1) {
      diver$1.group.position.copy(DV.p);
      diver$1.group.quaternion.copy(DV.qs).slerp(DV.q, smoothstep(0.0, 0.25, D.tAir + D.tWater));
      diver$1.update(h, t, {
        speed: vl, thrust: swim ? 0.85 : 0, turnRate: 0, climb: clamp$9(DV.v.y / 3, -1, 1),
        lookDir: DV.f, reach: 0, pose: swim ? 'swim' : 'streamline',
      });
    }
    _flat.set(DV.f.x, 0, DV.f.z);
    if (_flat.lengthSq() < 1e-4) _flat.copy(S.out);
    _flat.normalize();
    _dvW.copy(S.foot).addScaledVector(S.along, 4.2).addScaledVector(S.out, 2.6);
    _dvW.y = waveHeight(_dvW.x, _dvW.z, t) * 0.8 + (D.phase === 'air' ? 0.55 : 0.3);
    if (D.phase === 'water') {
      DV.tgt.copy(DV.p).addScaledVector(_flat, -3.3).addScaledVector(DV.up, 1.1);
      _dvW.lerp(DV.tgt, smoothstep(0.35, 1.0, D.tWater));
    }
    const cw = 2.8;
    D.camV.addScaledVector(_dvD.subVectors(_dvW, DV.cam), cw * cw * h).multiplyScalar(Math.max(0, 1 - 2 * cw * h));
    D.camV.clampLength(0, 6);
    DV.cam.addScaledVector(D.camV, h);
    camera.position.copy(DV.cam);
    DV.look.copy(DV.p).addScaledVector(DV.v, D.phase === 'air' ? 0.25 : 0.35);
    if (D.phase === 'water' && D.entry) DV.look.lerp(D.entry, 1 - smoothstep(0.3, 0.8, D.tWater));
    D.prevQ = (D.prevQ || new THREE.Quaternion()).copy(camera.quaternion);
    _dvQ.copy(lookQ(camera.position, DV.look));
    const ang = camera.quaternion.angleTo(_dvQ);
    if (ang > 1e-5) camera.quaternion.rotateTowards(_dvQ, Math.min(ang * (1 - Math.exp(-h * 5)), 1.6 * h));
    const moved = player.keys.KeyW || player.keys.KeyA || player.keys.KeyD || player.keys.KeyS;
    const low = DV.p.y - floorHeight(DV.p.x, DV.p.z) < 4.5 || DV.p.distanceTo(DV.wreck) < 2.5;
    if (D.phase === 'water' && ((low && D.tWater > 2) || D.tWater > 6.5 || (moved && D.tWater > 0.9))) { setState('explore'); return; }
  }
  const under = camera.position.y < waveHeightDisp(camera.position.x, camera.position.z, t);
  if (under && !D.camUnder) {
    D.camUnder = true;
    sunDir.copy(SUN_TITLE);
    audio$1.setMode('underwater');
    if (fx.bubbleBurst) fx.bubbleBurst(camera, 0.8);
    G.splash = 0.9;
  }
  post.setDof(camera.position.distanceTo(DV.p), 0.08, dt);
  if (!D.dolphins && D.phase === 'water' && D.tWater > 0.6) {
    D.dolphins = true;
    if (life$1 && life$1.startDolphins) {
      const side = life$1.startDolphins(camera.position.clone(), new V3(0, 0, -1).applyQuaternion(camera.quaternion));
      if (audio$1.dolphins) audio$1.dolphins(side);
    }
  }
}

function updateDive(dt, t) {
  if (G.dive && G.dive.v19) updateDive19(dt, t);
  else updateDiveLegacy(dt, t);
}


const DIVE_RAMP = 1;
const DIVE_RAMP_HURRY = 1;
const PL0_19 = 0.42;
const PERCH_IN = 0.0, PERCH_DN = 0.0;
const G19 = 9.81, RHO19 = 1025, M19 = 150;
const AIR0_19 = 0.007;
const Q_PUMP19 = 0.002;
const VCRACK19 = 0.0003;
const STREAM19 = 0.43;
const KNEES19 = 2.2;
const CHECK19 = 0.6;
const JUMP19 = { shuf: 0.08, lean: 0.38, load: 0.26};
const PUP19 = 0.08, POUT19 = 0.10;
const LEG19 = 0.92;
const LEGD19 = 0.03, LEGT19 = 0.30;
function legExt19(tr) { return sm5((tr - LEGD19) / LEGT19); }
const TITLE_AP19 = 0.14;
const AP_PUSH19 = 0.1;
const APIN19 = 1.0;
const AP_ENTRY19 = 0.16;
const _Y19 = new V3(0, 1, 0), _X19 = new V3(1, 0, 0), _Z19 = new V3(0, 0, 1);
const _v19a = new V3(), _v19b = new V3(), _v19c = new V3(), _v19d = new V3(), _v19e = new V3(), _v19f = new V3();
const _q19a = new THREE.Quaternion(), _q19b = new THREE.Quaternion(), _q19c = new THREE.Quaternion();
const _e19 = new THREE.Euler(0, 0, 0, 'YXZ');
const _e19r = new THREE.Euler(0, 0, 0, 'YXZ');
const cl01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const sm5 = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * u * (u * (6 * u - 15) + 10));
const sm5d = (u) => (u <= 0 || u >= 1 ? 0 : 30 * u * u * (u - 1) * (u - 1));
const ARC19 = {
  jumpLead: 0.80,
  pushK: 0.5, pushMin: 2.25, pushMax: 2.85,
  pushRise: 0.40, pushFall: 0.36,
  riseMax: 6 * Math.PI / 180,
  bIn: 4 * Math.PI / 180,
  ride: 2.6,
  R: 2.7,
  eRev: 7 * Math.PI / 180, tRev: 1.1,
  cxA: 0.47, cxRev: 0.43, cyRev: 0.58,
  fovDrop: 16, fovRev: 14,
  b1: 0.15, b1End: 4.0, b2Start: 2.5,
  settle: 0.6,
};
function smF19(u) {
  const a = ARC19.pushRise, b = ARC19.pushFall, I = (x) => x * x * x * x * (x * (x - 3) + 2.5), tot = 1 - 0.5 * a - 0.5 * b;
  if (u <= 0) return 0; if (u >= 1) return 1;
  const s = u < a ? a * I(u / a) : u <= 1 - b ? 0.5 * a + (u - a) : 0.5 * a + (1 - a - b) + b * (0.5 - I((1 - u) / b));
  return s / tot;
}
function softCap19(v, m) {
  const l = v.length(), k = 0.9 * m;
  if (l <= k || l < 1e-9) return v;
  return v.multiplyScalar((k + 0.1 * m * Math.tanh((l - k) / (0.1 * m))) / l);
}
function softSat19(v, m) {
  const l = v.length();
  if (l < 1e-9) return v;
  return v.multiplyScalar((m * Math.tanh(l / m)) / l);
}
function hash19(a, b) {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
const ENTRY_SEED = Number.isFinite(G.seed) ? G.seed >>> 0 : (() => {
  try { const q = new URLSearchParams(location.search).get('seed'); if (q !== null && q !== '' && Number.isFinite(+q)) return +q >>> 0; } catch (e) {  }
  return (Math.random() * 4294967296) >>> 0;
})();
function rng19(s) { return () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const RARE19 = (() => { try { const q = new URLSearchParams(location.search).get('rare'); return q === 'stingray' || q === 'eagleRays' || q === 'shark' || q === 'none' ? q : null; } catch (e) { return null; } })();
function entryDice19(rng) {
  const r = rng, E = {};
  const n = r();
  E.podN = n < 0.2 ? 1 : n < 0.65 ? 2 : 3;
  E.side = r() < 0.5 ? 1 : -1;
  E.tauRoll = 2.9 + 0.9 * r();
  E.rollDur = 1.1 + 0.4 * r();
  E.rollDir = r() < 0.5 ? 1 : -1;
  E.rDist = r();
  E.half2 = r() < 0.3;
  E.j1 = r(); E.j2 = r();
  E.mill = r() < 0.5 ? 1 : -1;
  E.awe = [0, 1, 2, 3].map(() => 0.35 * r());
  E.aweSide = r() < 0.5 ? 1 : -1;
  E.rare = r() < 0.25;
  const k = r();
  E.rareKind = k < 0.5 ? 'stingray' : k < 0.8 ? 'eagleRays' : 'shark';
  E.rareR = r();
  E.take = r();
  E.turn = r(); E.valve = r(); E.sweep = r();
  if (RARE19) { E.rare = RARE19 !== 'none'; if (E.rare) E.rareKind = RARE19; }
  return E;
}

const ST19 = { seat: new V3(), up: new V3(), out: new V3(), side: new V3(), notch: new V3(), q: new THREE.Quaternion() };
function station19() {
  const bt = surface.boat, bg = bt.group;
  bg.updateMatrixWorld();
  bg.getWorldQuaternion(ST19.q);
  ST19.up.set(0, 1, 0).applyQuaternion(ST19.q);
  if (bt.dive) {
    ST19.seat.copy(bt.dive.rail).applyMatrix4(bg.matrixWorld).addScaledVector(ST19.up, 0.03);
    ST19.out.copy(bt.dive.out).applyQuaternion(ST19.q);
    ST19.notch.copy(bt.tether && bt.tether.pos ? bt.tether.pos : bt.dive.rail).applyMatrix4(bg.matrixWorld);
  } else {
    const S = boatStand(G.dive && G.dive.from ? G.dive.from : camera.position);
    ST19.seat.copy(S.foot).addScaledVector(S.up, 0.05);
    ST19.out.copy(S.out);
    ST19.notch.copy(ST19.seat).addScaledVector(S.along, -0.4);
  }
  ST19.out.y = 0;
  if (ST19.out.lengthSq() < 1e-8) ST19.out.set(1, 0, 0);
  ST19.out.normalize();
  ST19.side.set(-ST19.out.z, 0, ST19.out.x);
  return ST19;
}

let perchName = null;
function perchPose() {
  if (perchName === null) perchName = diver$1.setPose && diver$1.setPose('perch', 0.4) ? 'perch' : 'bound';
  return perchName;
}
const _pch19 = { vel: new V3(), look: new V3(), hand: new V3(), palm: new V3(0, -1, 0), cur: new V3(), line: new V3() };
function perchDiver(dt, t, lean, dip, wander, hands, press, X) {
  const S = ST19, g = diver$1.group;
  const pose = perchPose();
  const sb = pose === 'bound' ? 1 : 0;
  if (X) {
    const u2 = lean * lean, uS = u2 * (3 - 2 * lean);
    g.position.copy(S.seat).addScaledVector(S.up, 0.07 - PERCH_DN * sb + PUP19 * uS).addScaledVector(S.out, POUT19 * u2 * lean + X.shuf - PERCH_IN * sb);
  } else g.position.copy(S.seat).addScaledVector(S.up, 0.07 - PERCH_DN * sb + 0.02 * lean).addScaledVector(S.out, 0.07 * lean - PERCH_IN * sb);
  g.quaternion.setFromAxisAngle(_Y19, Math.atan2(-S.out.x, -S.out.z));
  _pch19.vel.set(0, pose === 'bound' ? 0.6 : 0, 0);
  _pch19.look.copy(S.out).applyAxisAngle(_Y19, wander).multiplyScalar(Math.cos(dip)).addScaledVector(_Y19, -Math.sin(dip));
  diverTethers(false);
  if (diver$1.reach) {
    if (X) g.updateMatrixWorld();
    for (let k = 0; k < 2; k++) {
      const side = k ? 'left' : 'right', wk = X ? (k ? X.hL : X.hR) : hands;
      if (wk <= 0.002) { if (X) reachIdle19(side); continue; }
      const pushH = X && side !== X.lineHand, off = X && !pushH ? 0.24 : k ? 0.37 : 0.33;
      _pch19.hand.copy(S.seat).addScaledVector(S.side, k ? -off : off).addScaledVector(S.out, (k ? 0.07 : 0.06) + (X ? 0.05 * X.capOut : 0)).addScaledVector(S.up, 0.01 - 0.01 * press);
      if (X && X.lineK > 0 && side === X.lineHand && diver$1.anchors.lifeline) {
        const gq = g.quaternion, sg = side === 'right' ? 1 : -1, kn = (diver$1.anchors.chest || diver$1.anchors.lifeline).getWorldPosition(_pch19.line);
        kn.addScaledVector(_v19c.set(0, 1, 0).applyQuaternion(gq), -0.1).addScaledVector(_v19c.set(0, 0, -1).applyQuaternion(gq), 0.14).addScaledVector(_v19c.set(1, 0, 0).applyQuaternion(gq), 0.15 * sg);
        _pch19.hand.lerp(kn, X.lineK);
        reach19(side, _pch19.hand, wk, X.lineK > 0.5 ? { grip: 1 } : { grip: 1, palm: _pch19.palm }, dt);
      } else if (X) reach19(side, _pch19.hand, wk, { grip: 1, palm: _pch19.palm }, dt, true);
      else diver$1.reach(side, _pch19.hand, wk, { grip: 1, palm: _pch19.palm });
    }
    if (X && diver$1.setLinePin) diver$1.setLinePin(X.lineK > 0.5 ? X.lineHand : null, HOLD19);
  }
  _pch19.cur.copy(currentAt(g.position.x, -1, g.position.z));
  const P = { pose, vel: _pch19.vel, grounded: false, waterY: waveHeightDisp(g.position.x, g.position.z, t), lookDir: _pch19.look, current: _pch19.cur, support: surface.boat.group, perchGo: X ? lean * lean : lean };
  if (X) { P.dive = X.dive; P.perchRoll = X.roll; P.effort = X.effort; P.perchLoad = X.load || 0; }
  diver$1.update(dt, t, P);
  diver$1.setFade(1);
}

function titleDiver19(dt, t) {
  station19();
  if (!G.plate19) { G.plate19 = true; if (diver$1.setFaceplate) diver$1.setFaceplate(0); }
  if (surface.boat.dive) surface.diverLoad = 1;
  perchDiver(dt, t, 0, 0.12 + 0.05 * Math.sin(t * 0.17), 0.35 * Math.sin(t * 0.11), 1, 0);
  post.setDof(camera.position.distanceTo(diver$1.anchors.helmet.getWorldPosition(_v19a)), TITLE_AP19, dt);
  post.setDofShape(16, 1, 16);
}

function landSite19(S, hu) {
  const t = U.uTime.value;
  const rx = S.seat.x + S.out.x * 0.17, rz = S.seat.z + S.out.z * 0.17, sea = waveHeightDisp(rx, rz, t);
  let px = rx, pz = rz;
  for (let it = 0; it < 2; it++) {
    const P = fallState19({ y: sea + 0.89, w: -0.22, legs: 0.6, vx: S.out.x * 0.62, vz: S.out.z * 0.62, ox: S.out.x, oz: S.out.z, landY: floorHeight(px, pz) + 0.95, x0: rx, z0: rz });
    runFall19(P, sea);
    px = rx + P.hxT; pz = rz + P.hzT;
    if (hu) hu.set(rx + P.hxH, 0, rz + P.hzH);
  }
  return landNear19(px, pz);
}
function landNear19(bx, bz) {
  const slope = (x, z) => {
    const h0 = floorHeight(x, z);
    let m = 0;
    for (let i = 0; i < 8; i++) { const a = (i * Math.PI) / 4; m = Math.max(m, Math.abs(floorHeight(x + Math.cos(a) * 0.6, z + Math.sin(a) * 0.6) - h0)); }
    return Math.atan(m / 0.6);
  };
  const room = (x, z) => {
    let m = 99;
    for (const o of obstacles) if (!o.stone && !o.fan) m = Math.min(m, Math.hypot(x - o.x, z - o.z) - o.r);
    for (const p of capsules || []) {
      const abx = p.bx - p.ax, abz = p.bz - p.az, l2 = abx * abx + abz * abz;
      const h = l2 > 1e-8 ? clamp$9(((x - p.ax) * abx + (z - p.az) * abz) / l2, 0, 1) : 0;
      m = Math.min(m, Math.hypot(x - p.ax - abx * h, z - p.az - abz * h) - p.r);
    }
    return m;
  };
  let best = [bx, bz], bs = Infinity;
  const tryAt = (x, z, pen) => {
    const sl = slope(x, z), rm = room(x, z), ok = sl <= 12 * DEG$3 && rm >= 2.5;
    const score = sl + pen + (ok ? 0 : 10 + Math.max(0, 2.5 - rm));
    if (score < bs) { bs = score; best = [x, z]; }
    return ok;
  };
  if (!tryAt(bx, bz, 0)) {
    for (const r of [0.75, 1.5]) {
      let any = false;
      for (let i = 0; i < 8; i++) { const a = (i * Math.PI) / 4; if (tryAt(bx + Math.cos(a) * r, bz + Math.sin(a) * r, r * 0.02)) any = true; }
      if (any) break;
    }
  }
  return new V3(best[0], floorHeight(best[0], best[1]) + 0.95, best[1]);
}

function probeRest19(pos, yaw) {
  if (player.restPose) { try { const r = player.restPose(pos, yaw, -0.12, moveEnv()); if (r && r.pos && r.q) return r; } catch (e) {  } }
  const cp = _v19a.copy(camera.position), cq = _q19a.copy(camera.quaternion);
  player.place(pos, yaw, -0.12);
  player.updateCamera(1 / 60, moveEnv());
  const r = { pos: player.camPos.clone(), q: player.camQuat.clone(), fov: player.cam.fov || 0 };
  camera.position.copy(cp);
  camera.quaternion.copy(cq);
  return r;
}

function bez19(out, P0, C1, C2, P3, s) {
  const m = 1 - s, b0 = m * m * m, b1 = 3 * m * m * s, b2 = 3 * m * s * s, b3 = s * s * s;
  return out.set(P0.x * b0 + C1.x * b1 + C2.x * b2 + P3.x * b3, P0.y * b0 + C1.y * b1 + C2.y * b2 + P3.y * b3, P0.z * b0 + C1.z * b1 + C2.z * b2 + P3.z * b3);
}
function bezD19(out, P0, C1, C2, P3, s) {
  const m = 1 - s, a = 3 * m * m, b = 6 * m * s, c = 3 * s * s;
  return out.set((C1.x - P0.x) * a + (C2.x - C1.x) * b + (P3.x - C2.x) * c, (C1.y - P0.y) * a + (C2.y - C1.y) * b + (P3.y - C2.y) * c, (C1.z - P0.z) * a + (C2.z - C1.z) * b + (P3.z - C2.z) * c);
}
const GL5X = [-0.9061798459, -0.5384693101, 0, 0.5384693101, 0.9061798459], GL5W = [0.2369268851, 0.4786286705, 0.5688888889, 0.4786286705, 0.2369268851];

function arcOver19(D, t) {
  const A = (D.A = {}), P0 = D.P0, Hs = D.Hseat;
  A.bT = Math.atan2(P0.x - Hs.x, P0.z - Hs.z);
  A.bA = A.bT - ARC19.bIn;
  A.XA = new V3(D.pHu.x + Math.sin(A.bA) * ARC19.ride, 0, D.pHu.z + Math.cos(A.bA) * ARC19.ride);
  A.XA.y = waveHeightDisp(A.XA.x, A.XA.z, t) + 0.3;
  const h = new V3(P0.x - A.XA.x, 0, P0.z - A.XA.z);
  if (h.lengthSq() < 1e-6) h.copy(ST19.out); else h.normalize();
  A.pDir = h;
  A.C1 = P0.clone().lerp(A.XA, 0.35).addScaledVector(_Y19, 0.3);
  A.C2 = A.XA.clone().addScaledVector(h, 3.0).addScaledVector(_Y19, 0.5);
  _e19.setFromQuaternion(D.fromQ, 'YXZ');
  A.th0 = _e19.x; A.psi0 = _e19.y; A.rl0 = _e19.z;
  const vt = Math.tan(((baseFov + 4) * DEG$3) / 2);
  A.psiA = Math.atan2(-(D.pHu.x - A.XA.x), -(D.pHu.z - A.XA.z)) + Math.atan((2 * ARC19.cxA - 1) * camera.aspect * vt);
  A.psiA = A.psi0 + wrapA(A.psiA - A.psi0);
  A.pd = null;
  return A;
}
function arcTilt19(D, t) {
  const A = D.A, P0 = D.P0, Hs = D.Hseat, tq = D.Tr + 0.3, want = smF19(Math.min(1, tq / D.TL));
  const q = _v19e, pp = _v19f.copy(P0), L = [0];
  for (let i = 1; i <= 32; i++) { bez19(q, P0, A.C1, A.C2, A.XA, i / 32); L.push(L[i - 1] + q.distanceTo(pp)); pp.copy(q); }
  let s = 1;
  for (let i = 1; i <= 32; i++) if (L[i] >= want * L[32]) { s = (i - 1 + (want * L[32] - L[i - 1]) / Math.max(1e-6, L[i] - L[i - 1])) / 32; break; }
  const lr = bez19(_v19e, P0, A.C1, A.C2, A.XA, s), top = _v19d.copy(Hs); top.y += 0.22 + PUP19;
  lr.y = waveHeightDisp(lr.x, lr.z, t + tq) + 0.03;
  const wy = waveHeightDisp(Hs.x + ST19.out.x * 0.15, Hs.z + ST19.out.z * 0.15, t + D.Tr);
  const a1 = Math.atan2(top.y - lr.y, Math.hypot(top.x - lr.x, top.z - lr.z)), a2 = Math.atan2(wy - lr.y, Math.hypot(Hs.x - lr.x, Hs.z - lr.z));
  const fMax = (baseFov + ARC19.fovDrop * (camera.aspect < 1 ? 0.5 : 1)) * DEG$3, fMin = Math.min(58 * DEG$3, fMax);
  const fq = clamp$9(2 * Math.atan(Math.tan(0.5 * Math.max(0.05, a1 - a2)) / 0.58), fMin, Math.min(70 * DEG$3, fMax));
  A.thP = clamp$9(a1 - Math.atan(0.58 * Math.tan(fq / 2)), A.th0 - ARC19.riseMax, A.th0 + ARC19.riseMax);
  A.fP = clamp$9(Math.max(fq, 2 * Math.atan(Math.tan(Math.max(0, a1 - A.thP)) / 0.76)), fMin, fMax);
}
function arcPlan19(D) {
  const A = D.A;
  A.tHu = D.fHelmet ? D.tHu : D.Thu; A.tLens = D.lensUnder ? D.tLens : A.tHu + 0.07; A.Tland = D.Tland; A.TE = D.Tland + ARC19.settle;
  arcEnds19(D, A, A);
  A.dBx = 0; A.Trp = null;
  return A;
}
function arcEnds19(D, A, out) {
  const hl = _v19d.set(D.pLand.x, D.landY + (D.hOff || 0.67), D.pLand.z), r = D.rest;
  const dx = r.pos.x - hl.x, dy = r.pos.y - hl.y, dz = r.pos.z - hl.z, R = Math.hypot(dx, dy, dz) || 1;
  out.bE = Math.atan2(dx, dz); out.RE = R; out.eE = Math.asin(clamp$9(dy / R, -1, 1));
  const v = _v19e.set(hl.x, hl.y - 0.6, hl.z).sub(r.pos).applyQuaternion(_q19c.copy(r.q).invert());
  const vt = Math.tan(((baseFov + (r.fov || 0)) * DEG$3) / 2), z = Math.max(0.3, -v.z);
  out.cxE = clamp$9(0.5 + (0.5 * v.x) / (z * vt * camera.aspect), 0.25, 0.75);
  out.cyE = clamp$9(0.5 + (0.5 * v.y) / (z * vt), 0.25, 0.75);
  out.fovE = r.fov || 0;
  out.dB = wrapA(out.bE - A.bA);
  return out;
}
const sm19 = (x) => sm5(cl01(x));
function ae19(A, k, T) { return A.Trp === null ? A[k] : lerp$4(A[k], A.n[k], sm19((T - A.Trp) / Math.max(0.5, A.TE - A.Trp))); }
function arcW19(A, T) {
  return ARC19.b1 * sm19((T - A.tHu) / (A.tLens + ARC19.b1End - A.tHu)) + (1 - ARC19.b1) * sm19((T - A.tLens - ARC19.b2Start) / Math.max(0.5, A.TE - A.tLens - ARC19.b2Start));
}
function arcBear19(A, T) {
  return A.bA + A.dB * arcW19(A, T) + (A.Trp !== null ? A.dBx * sm19((T - A.Trp) / Math.max(0.5, A.TE - A.Trp)) : 0);
}
function arcElev19(A, T) {
  const tau = T - A.tLens;
  return tau < ARC19.tRev ? lerp$4(A.e0 === undefined ? ARC19.eRev : A.e0, ARC19.eRev, sm19(tau / ARC19.tRev)) : lerp$4(ARC19.eRev, ae19(A, 'eE', T), sm19((tau - ARC19.tRev) / Math.max(0.5, A.TE - A.tLens - ARC19.tRev)));
}
const arcR19 = (A, T) => lerp$4(ARC19.R, ae19(A, 'RE', T), sm19((T - A.Tland + 2.5) / (A.TE - A.Tland + 2.5)));
function arcCx19(A, T) {
  const tau = T - A.tLens;
  return lerp$4(lerp$4(ARC19.cxA, ARC19.cxRev, sm19(tau / ARC19.tRev)), ae19(A, 'cxE', T), sm19((tau - ARC19.b2Start) / Math.max(0.5, A.TE - A.tLens - ARC19.b2Start)));
}
function arcCy19(A, T) {
  const tau = T - A.tLens;
  return lerp$4(lerp$4(0.5, ARC19.cyRev, sm19((T - A.tHu) / (A.tLens + ARC19.tRev - A.tHu))), ae19(A, 'cyE', T), sm19((tau - ARC19.tRev) / Math.max(0.5, A.TE - A.tLens - ARC19.tRev)));
}
function arcLens19(A, T) {
  const tau = T - A.tLens, k = camera.aspect < 1 ? 0.5 : 1;
  return tau < ARC19.tRev ? lerp$4(ARC19.fovDrop, ARC19.fovRev, sm19(tau / ARC19.tRev)) * k : lerp$4(ARC19.fovRev * k, ae19(A, 'fovE', T), sm19((tau - ARC19.tRev) / Math.max(0.5, A.TE - A.tLens - ARC19.tRev)));
}
function arcPost19(A, T) {
  const e = arcElev19(A, T), R = arcR19(A, T), vt = Math.tan(((baseFov + arcLens19(A, T)) * DEG$3) / 2);
  return -Math.atan2(R * Math.sin(e) + 0.6, R * Math.cos(e)) - Math.atan((2 * arcCy19(A, T) - 1) * vt);
}
function arcPitch19(D, T) {
  const A = D.A;
  if (D.phase !== 'fall' || T < D.Tr) return A.th0 + (A.thP - A.th0) * sm19(T / Math.max(0.3, D.Tr));
  if (!A.pd) {
    const t1 = A.tLens + ARC19.tRev, p1 = arcPost19(A, t1), v1 = (arcPost19(A, t1 + 0.05) - arcPost19(A, t1 - 0.05)) / 0.1;
    A.pd = { t0: D.Tr, t1, L: Math.max(0.5, t1 - D.Tr), p1, v1 };
  }
  const P = A.pd;
  if (T < P.t1) {
    const u = (T - P.t0) / P.L, u3 = u * u * u;
    return A.thP + (P.p1 - A.thP) * sm5(u) + P.v1 * P.L * u3 * (-4 + u * (7 - 3 * u));
  }
  return arcPost19(A, T) + (P.p1 - arcPost19(A, P.t1)) * (1 - sm5((T - P.t1) / 0.8));
}
function arcReplan19(D) {
  arcPlan19(D);
  D.A.short = D.A.dB > -10 * DEG$3;
  if (D.A.short) D.A.dB = -10 * DEG$3;
  D.A.sgn = -1;
}
function arcReprobe19(D, T) {
  const A = D.A, o = arcEnds19(D, A, {});
  A.n = o;
  A.dBx = A.short ? 0 : clamp$9(wrapA(o.bE - (A.bA + A.dB)), -25 * DEG$3, 3 * DEG$3);
  A.Trp = T;
}

function enterDive19() {
  const D = G.dive, t = U.uTime.value;
  D.v19 = true;
  D.phase = 'perch';
  D.tr = 0;
  D.tau = null;
  D.skyK = 0;
  D.tB1 = null;
  D.tP = null;
  D.lensGo = false;
  D.spray = null; D.sprN = G.lensSpray ? G.lensSpray.n : 0;
  const S = station19();
  D.pHu = new V3();
  D.land = landSite19(S, D.pHu);
  if (Math.hypot(D.land.x - LAYOUT.landing.x, D.land.z - LAYOUT.landing.z) > 1.5) console.warn('[antikythera] he lands', D.land.x.toFixed(2), D.land.z.toFixed(2), 'away from LAYOUT.landing: move the reef with it');
  const M = _v19b.set(LAYOUT.wreck.x, 0, LAYOUT.wreck.z).lerp(fragments.items[0].home, 0.45);
  D.M = M.clone();
  if (life$1 && life$1.setDescent) life$1.setDescent(new V3(S.seat.x, waveHeightDisp(S.seat.x, S.seat.z, t), S.seat.z), D.land, D.M);
  D.psiLand = Math.atan2(-(M.x - D.land.x), -(M.z - D.land.z));
  D.psiOut = Math.atan2(-S.out.x, -S.out.z);
  D.dPsi = wrapA(D.psiLand - D.psiOut);
  D.psi0 = Math.atan2(S.out.x, S.out.z);
  const a = titlePose(t), b = titlePose(t + 1 / 60);
  D.P0 = D.from.clone();
  D.V0 = b.pos.sub(a.pos).multiplyScalar(60);
  D.rest = probeRest19(D.land, D.psiLand); D.restPsi = D.psiLand;
  D.psiRest = _e19.setFromQuaternion(D.rest.q, 'YXZ').y;
  D.side = (D.P0.x - S.seat.x) * Math.cos(D.psi0) - (D.P0.z - S.seat.z) * Math.sin(D.psi0) >= 0 ? 1 : -1;
  D.rng = rng19((ENTRY_SEED ^ Math.imul((G.dives = (G.dives || 0) + 1), 0x9e3779b9)) >>> 0);
  D.E = entryDice19(D.rng);
  D.Hseat = diver$1.anchors.helmet.getWorldPosition(new V3());
  arcOver19(D, t);
  {
    const XA = D.A.XA, C1 = D.A.C1, C2 = D.A.C2;
    let Lp = 0;
    const pp = D.P0.clone(), q = new V3();
    for (let i = 1; i <= 16; i++) { bez19(q, D.P0, C1, C2, XA, i / 16); Lp += q.distanceTo(pp); pp.copy(q); }
    D.Lpath = Lp;
    D.TL = clamp$9(ARC19.pushK * Math.sqrt(Lp), ARC19.pushMin, ARC19.pushMax);
  }
  D.Tr = D.TL - ARC19.jumpLead;
  D.jT0 = 0;
  arcTilt19(D, t); D.tiltSeat = false;
  {
    const pr = D.psiRest, pl = D.psiLand, ox = 0.55 * D.side, oz = 1.6;
    const wx = Math.cos(pr) * ox + Math.sin(pr) * oz, wz = -Math.sin(pr) * ox + Math.cos(pr) * oz;
    D.lineHand = wx * Math.cos(pl) - wz * Math.sin(pl) > 0 ? 'left' : 'right';
    D.pushHand = D.lineHand === 'left' ? 'right' : 'left';
  }
  D.valveHand = D.pushHand;
  if (diver$1.anchors.exhaust) { diver$1.group.updateMatrixWorld(); D.valveHand = diver$1.group.worldToLocal(diver$1.anchors.exhaust.getWorldPosition(_v19a)).x >= 0 ? 'right' : 'left'; }
  if (life$1 && life$1.setEntry) {
    life$1.setEntry({ seed: ENTRY_SEED ^ G.dives, station: S.seat.clone(), out: S.out.clone(), entry: D.pHu.clone().setY(waveHeightDisp(D.pHu.x, D.pHu.z, t)), land: D.land.clone(), face: D.M.clone(), lens: D.A.XA.clone(), mill: D.E.mill });
  }
  if (life$1 && life$1.rare) life$1.rare.auto(false);
  hookBreath();
  if (surface.boat.dive) surface.diverLoad = 1;
  if (diver$1.setTetherLength) diver$1.setTetherLength(60, 60);
  if (diver$1.setTetherCheck) diver$1.setTetherCheck(0, 0);
  if (diver$1.setLandDip) diver$1.setLandDip(0);
  RF19.right.on = RF19.left.on = false;
  SH19.right = SH19.left = null;
  G.hoDip = 0;
  OP19.init = false;
}

function fallState19(o) {
  const P = Object.assign({
    y: 0, w: 0, legs: 0.6, legs0: null, airF: AIR0_19, hx: 0, hz: 0, vx: 0, vz: 0, cvx: 0, cvz: 0, ox: 1, oz: 0,
    th: 0, thV: 0.3, rl: 0, rlV: 0, Eent: 0, s: 0, f: 0, Va: AIR0_19, acc: 0, clock: 0, sT: 0, pushK: 1,
    landY: -20, x0: 0, z0: 0, touch: false, vTouch: 0, hxT: 0, hzT: 0, hxH: 0, hzH: 0,
    tV: null, tStill: null, spr: 0, lk: 0.5, dp: 0, dpV: 0, dpA: 0,
    eHips: null, eCors: null, eHelmet: null, eTouch: null, psi: 0, psiV: 0, twist: 0, sweep: 0, fT: null,
  }, o);
  if (!Number.isFinite(P.legs0)) P.legs0 = P.legs;
  return P;
}
function fall19Step(P, h, surf, surfV, cx, cz) {
  const tr = P.clock - P.sT;
  P.legs = P.legs0 + (LEG19 - P.legs0) * legExt19(tr);
  const s = clamp$9(P.legs - P.y + surf, 0, 1.82);
  const L = cl01(s / 0.9), Tq = cl01((s - 0.9) / 0.62), Hh = cl01((s - 1.52) / 0.3);
  const zc = Math.max(0, surf - (P.y + 0.4));
  const wr = P.w + surfV * (1 - cl01(zc / 2));
  const Va = P.airF / (1 + zc / 10);
  const V = 0.030 * L + (0.057 + 0.7 * Va) * Tq + (0.018 + 0.3 * Va) * Hh;
  if (!P.touch) P.spr = smoothstep(4.0, 0.0, P.y - P.landY);
  const str = P.eHelmet === null ? 0 : smoothstep(0, 0.5, P.clock - P.eHelmet) * (1 - smoothstep(0, 1.0, P.spr));
  const CdA = (0.06 * L + 0.16 * Tq + 0.02 * Hh) * (1 - (1 - STREAM19) * str) * (1 + KNEES19 * P.spr);
  const u0 = cl01(s / 0.9), u1 = cl01((s - 1.15) / 0.45), u2 = cl01((s - 1.52) / 0.3);
  const ma = 5 * u0 * u0 * (3 - 2 * u0) + 25 * u1 * u1 * (3 - 2 * u1) + 5 * u2 * u2 * (3 - 2 * u2);
  const dma = (30 * u0 * (1 - u0)) / 0.9 + (150 * u1 * (1 - u1)) / 0.45 + (30 * u2 * (1 - u2)) / 0.3;
  const Fs = M19 * G19 * 0.35 * (1 - smoothstep(0.03, 0.15, tr)) * P.pushK;
  const Wn = M19 * G19 - RHO19 * G19 * V, Fc = P.touch ? 0 : Math.max(0, Wn) * CHECK19 * smoothstep(4.2, 1.2, P.y - P.landY);
  const aF = (Wn - 0.5 * RHO19 * CdA * wr * Math.abs(wr) - wr * Math.abs(wr) * dma - Fs - Fc) / (M19 + ma);
  if (!P.touch && P.y <= P.landY) {
    P.touch = true; P.eTouch = P.clock; P.vTouch = P.w; P.hxT = P.hx; P.hzT = P.hz;
    P.lk = clamp$9(Math.abs(P.w) / 1.2, 0.2, 1);
    P.dp = P.landY - P.y; P.dpV = P.w; P.dpA = 0;
  }
  if (P.touch) {
    const tt = P.clock - P.eTouch, d0 = 0.035 + 0.045 * P.lk;
    const want = 144 * (d0 - P.dp) - 2 * 0.8 * 12 * P.dpV;
    P.dpA += clamp$9(want - P.dpA, -300 * h, 300 * h);
    P.dpV += P.dpA * h; P.dp += P.dpV * h;
    if (P.tStill === null && tt > 0.1 && Math.abs(P.dpV) < 0.02) P.tStill = P.clock;
    P.w = P.dpV; P.y = P.landY - P.dp; P.acc = P.dpA;
  } else {
    P.w += aF * h;
    P.y -= P.w * h;
    P.acc = aF;
  }
  if (P.eCors === null && s > 0) P.Eent += (0.5 * RHO19 * CdA * wr * wr + wr * wr * dma) * Math.abs(wr) * h;
  if (P.eHelmet !== null && !P.touch) {
    if (P.y - P.landY < 5.5) P.airF += Q_PUMP19 * h;
    if (P.tV === null && surf - (P.y + 0.67) > 3.0) P.tV = P.clock;
    if (P.tV !== null && P.clock >= P.tV + 0.3 && P.clock < P.tV + 0.6) P.airF -= (VCRACK19 / 0.3) * h;
    P.airF = Math.min(P.airF, ((M19 - 3) / RHO19 - 0.105) * (1 + zc / 10));
  }
  if (tr < 0.12) {
    const ap = 3.0 * (1 - smoothstep(0.05, 0.12, tr)), vo = P.vx * P.ox + P.vz * P.oz;
    if (vo < 0.70) { const dv = Math.min(ap * h, 0.70 - vo); P.vx += P.ox * dv; P.vz += P.oz * dv; }
  }
  const f = cl01(s / 1.82);
  if (P.touch) { const kb = Math.min(1, h / 0.06); P.vx -= P.vx * kb; P.vz -= P.vz * kb; }
  else if (f > 0) {
    const rx = P.vx - P.cvx, rz = P.vz - P.cvz, k = f * (1.0 * Math.hypot(rx, rz) + 0.55) * h;
    P.vx -= rx * k; P.vz -= rz * k;
    P.cvx += (cx - P.cvx) * h * f; P.cvz += (cz - P.cvz) * h * f;
  }
  P.hx += P.vx * h; P.hz += P.vz * h;
  P.thV += (-1.69 * P.th - 1.56 * P.thV) * f * h; P.th += P.thV * h;
  P.rlV += (-1.69 * P.rl - 1.56 * P.rlV) * f * h; P.rl += P.rlV * h;
  {
    let al = tr < 0.12 ? P.twist / 0.12 : 0;
    if (P.eCors !== null && P.sweep) { const u = (P.clock - P.eCors - SWEEP19.t0) / SWEEP19.d; if (u > 0 && u < 1) al += (2 * P.sweep * Math.sin(Math.PI * u) ** 2) / SWEEP19.d; }
    P.psiV += (al - (TURN19D + 0.7 * Math.abs(P.psiV)) * P.psiV * f) * h;
    P.psi += P.psiV * h;
  }
  P.s = s; P.f = f; P.Va = Va;
  P.clock += h;
  if (P.fT && P.fT.length < 1200 && P.clock - P.sT >= P.fT.length / 60) P.fT.push(f);
  if (P.eHips === null && s > 0.95) P.eHips = P.clock;
  if (P.eCors === null && s > 1.25) P.eCors = P.clock;
  if (P.eHelmet === null && P.y + 0.87 < surf) { P.eHelmet = P.clock; P.hxH = P.hx; P.hzH = P.hz; }
}
const _fl19 = new V3();
function flow19(x, y, z) {
  const s = U.uSurge.value, c = currentAt(x);
  return _fl19.set(c.x - s.x * 0.7, 0, c.z - s.z * 0.7);
}
function runFall19(P, surf) {
  let cx = 0, cz = 0, next = -1;
  for (let i = 0; i < 240 * 40 && P.eTouch === null; i++) {
    if (P.clock >= next) { const c = flow19(P.x0 + P.hx, P.y - 0.9, P.z0 + P.hz); cx = c.x; cz = c.z; next = P.clock + 0.25; }
    fall19Step(P, 1 / 240, surf, 0, cx, cz);
  }
  if (P.eTouch === null) { P.eTouch = P.clock; P.hxT = P.hx; P.hzT = P.hz; P.vTouch = P.w; }
  return P;
}
function predict19(D, surf, fT = null) {
  const P = fallState19({
    y: D.y, w: D.w, legs: D.legs, legs0: D.legs0, airF: D.airF, hx: D.hx, hz: D.hz, vx: D.vx, vz: D.vz, cvx: D.cvx, cvz: D.cvz, ox: D.ox, oz: D.oz,
    th: D.th, thV: D.thV, rl: D.rl, rlV: D.rlV, Eent: D.Eent, clock: D.clock, sT: D.sT, pushK: D.pushK, landY: D.landY, x0: D.x0, z0: D.z0,
    touch: D.touch, vTouch: D.vTouch, hxT: D.hxT, hzT: D.hzT, eHips: D.eHips, eCors: D.eCors, eHelmet: D.eHelmet, eTouch: D.eTouch,
    tV: D.tV === undefined ? null : D.tV, tStill: D.tStill === undefined ? null : D.tStill, spr: D.spr || 0,
    lk: D.lk || 0.5, dp: D.dp || 0, dpV: D.dpV || 0, dpA: D.dpA || 0, psi: D.psi || 0, psiV: D.psiV || 0, twist: D.twist || 0, sweep: D.sweep || 0, fT,
  });
  return P.eTouch === null ? runFall19(P, surf) : P;
}
function turnPlan19(D, fT, eCors, dPsi, share) {
  const run = (tw, sw) => {
    let ps = 0, pv = 0;
    const h = 1 / 240;
    for (let k = 0; k < 7 * 240; k++) {
      const tr = k * h, j = tr * 60, j0 = Math.min(fT.length - 1, Math.floor(j)), f = fT.length ? lerp$4(fT[j0], fT[Math.min(fT.length - 1, j0 + 1)], j - Math.floor(j)) : 1;
      let al = tr < 0.12 ? tw / 0.12 : 0;
      const u = (D.sT + tr - eCors - SWEEP19.t0) / SWEEP19.d;
      if (u > 0 && u < 1) al += (2 * sw * Math.sin(Math.PI * u) ** 2) / SWEEP19.d;
      pv += (al - (TURN19D + 0.7 * Math.abs(pv)) * pv * f) * h; ps += pv * h;
    }
    return ps;
  };
  const sg = dPsi < 0 ? -1 : 1, a = Math.abs(dPsi);
  const tw = sg * Math.min(TURN19.twistMax, (share * a) / Math.max(0.2, run(1, 0)));
  let lo = 0, hi = TURN19.sweepMax;
  if (Math.abs(run(tw, sg * hi)) < a) lo = hi;
  else for (let i = 0; i < 18; i++) { const m = 0.5 * (lo + hi); if (Math.abs(run(tw, sg * m)) < a) lo = m; else hi = m; }
  return { twist: tw, sweep: sg * lo };
}

function release19(D, S, t) {
  D.phase = 'fall';
  audio$1.leaveRail?.();
  const g = diver$1.group.position, sv = D.seatV || _v19a.set(0, 0, 0);
  D.y = D.yTr = g.y;
  D.w = -sv.y;
  const so = sv.x * S.out.x + sv.z * S.out.z, vp = clamp$9(0.70 - so, 0.35, (POUT19 * 2) / Math.max(0.4, D.pressDur || 0.45));
  D.vx = S.out.x * vp + sv.x;
  D.vz = S.out.z * vp + sv.z;
  D.ox = S.out.x; D.oz = S.out.z;
  D.hx = D.hz = 0; D.cvx = D.cvz = 0;
  D.airF = AIR0_19; D.Va = AIR0_19; D.Eent = 0; D.s = 0; D.f = 0; D.acc = 0;
  D.th = 0; D.thV = 0.18; D.rl = 0; D.rlV = (D.lineHand === 'left' ? 1 : -1) * 0.05;
  D.psi = D.psiOut; D.psiV = 0; D.twist = 0; D.sweep = 0;
  let fy = Infinity;
  if (diver$1.anchors.rightFoot && diver$1.anchors.leftFoot) fy = Math.min(diver$1.anchors.rightFoot.getWorldPosition(_v19b).y, diver$1.anchors.leftFoot.getWorldPosition(_v19c).y);
  D.legs = D.legs0 = Number.isFinite(fy) ? clamp$9(g.y - fy, 0.4, 0.95) : 0.48;
  D.x0 = g.x; D.z0 = g.z;
  D.out = S.out.clone();
  D.landY = D.land.y;
  D.clock = D.sT = G.st;
  D.pushK = 1; D.pushLet = { right: null, left: null }; D.pushLoc = {}; D.wIn = {};
  D.touch = false; D.contact = false; D.wetHeld = true; D.vTouch = 0; D.hxT = D.hzT = 0;
  D.tV = null; D.tStill = null; D.spr = 0; D.lk = 0.5; D.dp = 0; D.dpV = 0; D.dpA = 0; D.jo = 0; D.joV = 0; D.aLP = undefined;
  D.pre = 0; D.dipH = 0;
  D.pressK = surface.boat.dive && Number.isFinite(surface.diverLoad) ? surface.diverLoad : 1;
  D.eHips = D.eCors = D.eHelmet = D.eTouch = null;
  D.fBoots = D.fCors = D.fHelmet = D.fTouch = D.fPlop = false;
  D.boot = [0, 1].map(() => ({ init: false, on: false, p: new V3(), y0: 0, wet0: false, sp: null }));
  D.seed = D.E ? D.E.take : hash19(D.sT, 3.7);
  D.valveAt = null; D.gLog = []; D.mv = { valve: null, shut: null, spread: null };
  D.palm = { right: { v: new V3(), ok: false }, left: { v: new V3(), ok: false } };
  D.capP = {};
  for (const hd of ['right', 'left']) D.capP[hd] = S.seat.clone().addScaledVector(S.side, hd === 'right' ? 0.2 : -0.2).addScaledVector(S.out, 0.11);
  D.px = g.x; D.py = g.y; D.pz = g.z;
  if (surface.boat.dive) surface.diverLoad = D.pressK * 0.35;
  if (diver$1.setTetherPayOnly) diver$1.setTetherPayOnly(true);
  if (fx.setHull && hull19(S).ok) fx.setHull(H19.p, H19.n);
  const surf = waveHeightDisp(g.x, g.z, t);
  let fT = [], P = predict19(D, surf, fT);
  D.Dres = new V3(D.land.x - (D.x0 + P.hxT), 0, D.land.z - (D.z0 + P.hzT));
  if (Math.hypot(D.Dres.x, D.Dres.z) > 0.6) {
    D.land = landNear19(D.x0 + P.hxT, D.z0 + P.hzT);
    D.landY = D.land.y;
    fT = [];
    P = predict19(D, surf, fT);
    D.Dres.set(D.land.x - (D.x0 + P.hxT), 0, D.land.z - (D.z0 + P.hzT));
    const r = probeRest19(D.land, D.psiLand);
    D.rest.pos.copy(r.pos); D.rest.q.copy(r.q); D.rest.fov = r.fov; D.restPsi = D.psiLand;
  }
  D.Thips = P.eHips; D.Tcors = P.eCors; D.Thu = P.eHelmet; D.Tland = P.eTouch; D.vLand = P.vTouch;
  {
    const dPsi = wrapA(D.psiLand - D.psiOut);
    if (Math.abs(dPsi) > 3 * DEG$3 && P.eCors !== null) {
      const o = turnPlan19(D, fT, P.eCors, dPsi, TURN19.share + 0.1 * ((D.E && D.E.turn) || 0.5) - 0.05);
      D.twist = o.twist; D.sweep = o.sweep;
    }
  }
  if (D.pHu && P.eHelmet !== null) D.pHu.set(D.x0 + P.hxH, 0, D.z0 + P.hzH);
  D.pLand = D.land.clone();
  D.hOff = 0.67;
  if (D.A) {
    const bx = Math.sin(D.psiLand), bz = Math.cos(D.psiLand), nx = S.notch.x - D.land.x, nz = S.notch.z - D.land.z, nl = Math.hypot(nx, nz) || 1;
    const toward = (sg) => { const th = sg * 40 * DEG$3; return ((bx * Math.cos(th) + bz * Math.sin(th)) * nx + (-bx * Math.sin(th) + bz * Math.cos(th)) * nz) / nl; };
    const side = [1, -1].map((sg) => {
      const r = probeRest19(D.pLand, D.psiLand + sg * 30 * DEG$3), o = { rest: r };
      const D2 = { pLand: D.pLand, landY: D.landY, hOff: D.hOff, rest: r };
      arcEnds19(D2, D.A, o);
      return { sg, r, dB: o.dB, to: toward(sg) };
    });
    side.sort((a, b) => a.to - b.to);
    let pick = side[0];
    if (pick.dB > -10 * DEG$3 && side[1].to < 0.6 && side[1].dB <= -10 * DEG$3) pick = side[1];
    D.restSg = pick.sg;
    D.A.sides = side.map((o) => [o.sg, +(o.dB / DEG$3).toFixed(1), +o.to.toFixed(2)]);
    D.rest.pos.copy(pick.r.pos); D.rest.q.copy(pick.r.q); D.rest.fov = pick.r.fov; D.restPsi = D.psiLand;
    arcReplan19(D);
  }
}

const TURN19 = { share: 0.45, twistMax: 0.8, sweepMax: 2.2 };
const TURN19D = 1.2;
const SWEEP19 = { t0: 0.1, d: 1.3 };
function yaw19(D, T, dt, x, z) {
  const want = Math.atan2(-(D.M.x - x), -(D.M.z - z)), err = wrapA(want - D.psi);
  const tS = D.eCors !== null ? D.eCors + SWEEP19.t0 + SWEEP19.d : null;
  const hold = tS === null ? 0 : 0.25 * err * smoothstep(tS + 1.2, tS + 2.2, T);
  const wn = D.fHelmet ? 0.012 * Math.sin(T * 0.85 + D.seed * 6.3) + 0.008 * Math.sin(T * 1.31 + 2.1 + D.seed * 3.1) : 0;
  const c = currentAt(x, D.y), cl = Math.hypot(c.x, c.z);
  const wv = !D.fHelmet || D.touch || cl < 1e-3 ? 0 : clamp$9(0.3 * cl * Math.sin(wrapA(Math.atan2(c.x, c.z) - D.psi)), -0.01, 0.01);
  const kL = smoothstep(D.Tland - 3.8, D.Tland - 3.4, T), still = D.touch ? 1 : kL;
  D.psiV = D.psiV * Math.exp(-10 * still * dt) + (hold + wn + wv) * (1 - still) * dt;
}

const _hd19 = { p: new V3(), q: new V3(), r: new V3(), k: new V3(), fw: new V3(), rt: new V3(), l: new V3(), m: new V3(), h: new V3(), pw: new V3() };
const HOLD19 = 0.7;
const AIRAB19 = 62;
const LET19 = [0.04, 0.09], AIRT19 = 0.6;
const DAB19 = 28, DFW19 = 12, EXTD19 = 0.53;
const EXTA19 = 0.55;
const WLIFT19 = 7, SWA19 = 16, SWS19 = 3;
const VALVE19 = { up: 1.6, at: 0.4, down: 1.4 }, VALVER19 = 0.33;
const PALMW19 = (250 * Math.PI) / 180;
const RF19 = { right: { p: new V3(), v: new V3(), on: false }, left: { p: new V3(), v: new V3(), on: false } };
function reach19(side, target, w, opts, dt, direct = false, vmx = 0) {
  const R = RF19[side], g = diver$1.group;
  g.updateMatrixWorld();
  const loc = g.worldToLocal(_hd19.l.copy(target));
  if (!R.on || direct || !(dt > 0)) { R.p.copy(loc); R.v.set(0, 0, 0); R.on = true; }
  else {
    const n = Math.max(1, Math.ceil(dt * 240)), h = dt / n;
    const ch = diver$1.anchors.chest ? diver$1.anchors.chest.getWorldPosition(_hd19.m) : g.position;
    const vmax = vmx > 0 ? vmx : ch.y < waveHeightDisp(ch.x, ch.z, U.uTime.value) ? 1.5 : 2.5;
    for (let i = 0; i < n; i++) {
      R.v.addScaledVector(_hd19.m.subVectors(loc, R.p), 144 * h).addScaledVector(R.v, -24 * h);
      const l = R.v.length();
      if (l > vmax) R.v.multiplyScalar(vmax / l);
      R.p.addScaledVector(R.v, h);
    }
  }
  diver$1.reach(side, g.localToWorld(_hd19.l.copy(R.p)), w, opts);
}
function reachIdle19(side) {
  const R = RF19[side], an = diver$1.anchors[side === 'left' ? 'leftHand' : 'rightHand'];
  diver$1.reach(side, null, 0);
  if (!an) return;
  diver$1.group.updateMatrixWorld();
  R.p.copy(diver$1.group.worldToLocal(an.getWorldPosition(_hd19.l))); R.v.set(0, 0, 0); R.on = true;
}
const _fl19a = new V3(), _fl19b = new V3(), _fl19c = new V3(), _fl19d = new V3();
const SH19 = { right: null, left: null };
function shoulder19(out, side) {
  const ch = diver$1.anchors.chest;
  if (!ch) return null;
  if (!SH19[side]) {
    const an = diver$1.anchors[side === 'left' ? 'leftHand' : 'rightHand'], b = an && an.parent && an.parent.parent ? an.parent.parent.parent : null;
    if (!b) return null;
    diver$1.group.updateMatrixWorld();
    SH19[side] = ch.worldToLocal(b.getWorldPosition(new V3()));
  }
  return ch.localToWorld(out.copy(SH19[side]));
}
const _aq19 = new THREE.Quaternion();
function armT19(out, side, ab, fwd, ext, lvl = false) {
  const gq = diver$1.anchors.chest ? diver$1.anchors.chest.getWorldQuaternion(_aq19) : diver$1.group.quaternion, sg = side === 'right' ? 1 : -1;
  const up = _fl19a.set(0, 1, 0).applyQuaternion(gq), rt = _fl19b.set(1, 0, 0).applyQuaternion(gq), fw = _fl19c.set(0, 0, -1).applyQuaternion(gq);
  if (!shoulder19(out, side)) {
    if (diver$1.anchors.chest) diver$1.anchors.chest.getWorldPosition(out).addScaledVector(fw, -0.17).addScaledVector(up, 0.03);
    else out.copy(diver$1.group.position).addScaledVector(up, 0.48);
    out.addScaledVector(rt, 0.18 * sg);
  }
  if (lvl) { up.set(0, 1, 0).applyQuaternion(diver$1.group.quaternion); fw.addScaledVector(up, -fw.dot(up)).normalize(); rt.crossVectors(fw, up).normalize(); }
  const a = ab * DEG$3, f = fwd * DEG$3;
  const d = _fl19d.copy(up).multiplyScalar(-Math.cos(a)).addScaledVector(rt, sg * Math.sin(a)).multiplyScalar(Math.cos(f)).addScaledVector(fw, Math.sin(f)).normalize();
  return out.addScaledVector(d, ext);
}
const _pl19 = { right: new V3(), left: new V3() }, _ai19 = new V3();
function palm19(hand, ab, k) {
  const gq = diver$1.group.quaternion, sg = hand === 'right' ? 1 : -1, a = ab * DEG$3;
  const up = _fl19a.set(0, 1, 0).applyQuaternion(gq), rt = _fl19b.set(1, 0, 0).applyQuaternion(gq);
  return _pl19[hand].set(0, -0, 0).addScaledVector(up, -Math.sin(a) * k).addScaledVector(rt, -sg * Math.cos(a) * k).normalize();
}
const _pq19 = { a: new THREE.Quaternion(), b: new THREE.Quaternion(), i: new THREE.Quaternion(), w: new V3(), o: new V3() };
function palmTo19(D, hand, want, dt) {
  const P = D.palm[hand], gq = diver$1.group.quaternion, gi = _pq19.i.copy(gq).invert();
  const w = _pq19.w.copy(want).applyQuaternion(gi).normalize();
  if (!P.ok) {
    const an = diver$1.anchors[hand === 'left' ? 'leftHand' : 'rightHand'];
    if (an) P.v.set(0, 0, 1).applyQuaternion(an.getWorldQuaternion(_pq19.a)).applyQuaternion(gi); else P.v.copy(w);
    P.ok = true;
  }
  const a = P.v.angleTo(w), mx = PALMW19 * Math.max(0, dt);
  if (a > mx && a > 1e-5) { _pq19.b.setFromUnitVectors(P.v, w); _pq19.a.identity().slerp(_pq19.b, mx / a); P.v.applyQuaternion(_pq19.a).normalize(); }
  else P.v.copy(w);
  return _pq19.o.copy(P.v).applyQuaternion(gq);
}
const AIRR19 = 0.9, _ai19s = new V3(), _ai19c = new V3(), _ai19q = { a: new THREE.Quaternion(), b: new THREE.Quaternion() };
function airT19(D, T, hand, own, lag, out) {
  if (!D.pushLoc[hand]) D.pushLoc[hand] = diver$1.group.worldToLocal(D.capP[hand].clone());
  const t = T - D.pushLet[hand] - 0.1 * lag, u = sm5(t / AIRT19);
  const sh = armT19(_ai19s, hand, 0, 0, 0), c = diver$1.group.localToWorld(_ai19c.copy(D.pushLoc[hand])).sub(sh), rc = Math.min(c.length(), 0.59);
  armT19(_ai19, hand, AIRAB19 + (own ? 2 : -2), own ? 12 : 16, EXTA19, true).sub(sh).normalize();
  c.normalize();
  _ai19q.b.setFromUnitVectors(c, _ai19); _ai19q.a.identity().slerp(_ai19q.b, u);
  c.applyQuaternion(_ai19q.a);
  out.copy(sh).addScaledVector(c, lerp$4(rc, EXTA19, sm5(t / AIRR19)));
  return u;
}
function hands19(D, T, dt, x, z) {
  if (!diver$1.reach) return;
  const oh = D.pushHand, mv = D.mv;
  const gq = diver$1.group.quaternion;
  const fw = _hd19.fw.set(0, 0, -1).applyQuaternion(gq), rt = _hd19.rt.set(1, 0, 0).applyQuaternion(gq);
  {
    const aUp = G19 - (D.acc || 0);
    if (D.aLP === undefined) D.aLP = aUp;
    const n2 = Math.max(1, Math.ceil(dt * 240)), h2 = dt / n2;
    for (let i = 0; i < n2; i++) {
      D.aLP += (aUp - D.aLP) * Math.min(1, h2 / 0.25);
      D.joV += (-144 * D.jo - 24 * D.joV - 0.5 * (aUp - D.aLP)) * h2;
      D.jo += D.joV * h2;
    }
  }
  for (const hd of ['right', 'left']) if (D.pushLet[hd] === null && T >= D.sT + LET19[hd === oh ? 0 : 1]) D.pushLet[hd] = T;
  const letK = (hd) => (D.pushLet[hd] === null ? 1 : 1 - smoothstep(D.pushLet[hd], D.pushLet[hd] + 0.1, T));
  D.pushK = Math.max(letK('right'), letK('left'));
  if (D.armGo && D.wLift === undefined) D.wLift = clamp$9(1.6 * Math.max(0, D.w || 0), 2, WLIFT19);
  const tSw = D.eCors !== null ? D.eCors + SWEEP19.t0 : null, dSw = D.sweep > 0 ? 1 : D.sweep < 0 ? -1 : 0;
  const aSw = SWA19 * clamp$9(Math.abs(D.sweep || 0) / 1.2, 0.5, 1) * (0.85 + 0.3 * ((D.E && D.E.sweep) || 0.5));
  if (tSw !== null && !D.gSw) { D.gSw = true; D.gLog.push(['sweep', tSw, 'both', SWEEP19.d]); }
  for (let k = 0; k < 2; k++) {
    const hand = k ? 'left' : 'right', sg = k ? -1 : 1, own = hand === oh;
    const lag = own ? 0 : 0.2, ph = own ? 0 : 2.3;
    if (D.pushLet[hand] === null) { reach19(hand, D.capP[hand], 1, { grip: 1, palm: _pch19.palm }, dt, true); continue; }
    if (!D.armGo) {
      const u = airT19(D, T, hand, own, lag, _hd19.r);
      reach19(hand, _hd19.r, 1, { grip: lerp$4(0.3, 0.2, u), palm: palmTo19(D, hand, palm19(hand, lerp$4(12, AIRAB19, u), 1), dt) }, dt, false, 1.6);
      continue;
    }
    if (D.tWater === undefined) D.tWater = T;
    let w = 1, grip = 0.8, vmx = 0;
    const pd = (own ? 0 : Math.PI) + D.seed * 4.1;
    const dA = 1.6 * Math.sin(0.9 * T + pd) + 0.8 * Math.sin(0.53 * T + 1.3 + pd), dF = 2 * Math.sin(0.7 * T + 0.6 + pd);
    const tw = T - D.tWater - (own ? 0 : 0.08);
    const kL = sm5(tw / 0.3), u = tSw === null ? 0 : cl01((T - tSw - (own ? 0 : 0.06)) / SWEEP19.d), kP = sm5(u);
    const sw = (u - Math.sin(2 * Math.PI * u) / (2 * Math.PI)) * (1 - sm5((T - (tSw || T) - SWEEP19.d - 0.5) / SWS19)), dF2 = -dSw * sg;
    let abN = lerp$4(AIRAB19 - 2 + (D.wLift || 0) * kL, DAB19 + dA, kP);
    const fwN = lerp$4(lerp$4(14, 10, kL), DFW19 + dF, kP) + dF2 * aSw * sw, exN = lerp$4(EXTA19 - 0.02 * kL, EXTD19 + 0.004 * Math.sin(0.8 * T + 1.7 + pd), kP);
    armT19(_hd19.q, hand, abN, fwN, exN, true);
    armT19(_hd19.p, hand, abN, fwN, exN);
    _hd19.q.lerp(_hd19.p, kP);
    airT19(D, T, hand, own, lag, _hd19.k);
    const wE = sm5(tw / 0.35);
    if (wE < 1) _hd19.q.copy(_hd19.k.lerp(_hd19.q, wE));
    const pk = dSw ? Math.sin(Math.PI * u) : 0;
    let pw = _hd19.pw.copy(palm19(hand, abN, 1)).addScaledVector(fw, dF2 * 1.2 * pk).normalize();
    if (mv.spread !== null) {
      const kA = hand === D.valveHand && mv.valve !== null ? sm5((T - mv.spread) / VALVE19.down) : sm5((T - mv.spread - 0.15) / 1.2);
      if (kA > 0) {
        const dA2 = 1.5 * Math.sin(T * 0.8 + D.seed * 5.1 + ph), dF3 = 2 * Math.sin(T * 0.6 + D.seed * 2.3 + ph);
        armT19(_hd19.p, hand, 34 + dA2, 20 + dF3, 0.54 + 0.004 * Math.sin(T * 0.9 + 1.1 + ph), true);
        _hd19.q.lerp(_hd19.p, kA);
        abN = lerp$4(abN, 34, kA);
        pw.lerp(palm19(hand, abN, 1), kA).normalize();
      }
    }
    if (hand === D.valveHand && mv.valve !== null && diver$1.anchors.exhaust) {
      const eU = sm5((T - mv.valve) / VALVE19.up), eD = mv.spread !== null ? sm5((T - mv.spread) / VALVE19.down) : 0, vk = eU * (1 - eD);
      if (vk > 0) {
        const sh = armT19(_hd19.k, hand, 0, 0, 0);
        const e = diver$1.anchors.exhaust.getWorldPosition(_hd19.r).addScaledVector(rt, 0.06 * sg).sub(sh).normalize();
        const h = _hd19.h.subVectors(_hd19.q, sh), r0 = h.length() || 1;
        h.divideScalar(r0);
        _pq19.b.setFromUnitVectors(h, e); _pq19.a.identity().slerp(_pq19.b, vk);
        h.applyQuaternion(_pq19.a).addScaledVector(fw, 0.2 * Math.sin(Math.PI * vk)).normalize();
        _hd19.q.copy(sh).addScaledVector(h, lerp$4(r0, VALVER19, vk));
        grip = lerp$4(grip, 0.9, vk);
        const rd = _hd19.r.subVectors(_hd19.q, sh).normalize();
        const to = diver$1.anchors.chest.getWorldPosition(_hd19.p).lerp(diver$1.anchors.helmet.getWorldPosition(_hd19.m), vk).sub(_hd19.q);
        to.addScaledVector(rd, -to.dot(rd));
        if (to.lengthSq() > 1e-4) pw.lerp(to.normalize(), smoothstep(0, 0.25, vk)).normalize();
        vmx = 3;
      }
    }
    if (D.touch) {
      armT19(_hd19.p, hand, 22, 10, 0.54, true);
      const kT = sm5((T - (D.tTouch || T)) / 0.9);
      _hd19.q.lerp(_hd19.p, kT); abN = lerp$4(abN, 22, kT);
      pw.lerp(palm19(hand, abN, 1), kT).normalize();
      w *= 1 - sm5((T - (D.tTouch || T) - 0.9) / 0.8);
    }
    if (w <= 0.002) { reachIdle19(hand); continue; }
    _hd19.q.y += D.jo;
    reach19(hand, _hd19.q, w, { grip, palm: palmTo19(D, hand, pw, dt) }, dt, false, vmx);
  }
  if (diver$1.setLinePin) diver$1.setLinePin(null, HOLD19);
}

const _fv = { vel: new V3(), look: new V3(), cur: new V3(), hand: new V3(), p0: new V3(), q: new THREE.Quaternion(), keel: new V3(), int: [new V3(), new V3(), new V3()], wl: new V3(), sc: [0, 0, 0] };
const DIVE19 = { suitAir: 0.3, landV: 0, legs: true, glances: true, free: true, perch: false, landDip: -1, spread: 0, ext: -1 };
const EENT19 = 450;
const CLING19 = [['helmet', 0.2, 100], ['chest', 0.18, 80], ['rimF', 0.08, 40], ['rimB', 0.08, 40], ['cuffR', 0.05, 32], ['cuffL', 0.05, 32],
  ['wFbottom', 0.08, 32], ['wBbottom', 0.08, 32], ['bag', 0.06, 24], ['rightFoot', 0.08, 24], ['leftFoot', 0.08, 24]];
const PLUME19 = 240;
const _ld19 = new V3();
function lensDir19(x, z) {
  const dx = camera.position.x - x, dz = camera.position.z - z, l = Math.hypot(dx, dz);
  return l > 0.3 ? _ld19.set(dx / l, 0, dz / l) : null;
}
const DOL19 = { pre: 1.3, post: 1.1, band: [4.6, 5.2], bandPortrait: [5.2, 5.8], lag: [0, 0.8, 1.5], dd: [0, 1.1, 1.8], dy: [0, 0.07, 0.12], span: 0.26 };
function planDolphins19(D, T) {
  const E = D.E, A = D.A, port = camera.aspect < 1;
  const tRoll = D.tLens + E.tauRoll, t0 = tRoll - DOL19.pre, band = port ? DOL19.bandPortrait : DOL19.band;
  const d = lerp$4(band[0], band[1], E.rDist), xHim = 2 * arcCx19(A, tRoll) - 1, s = E.side, yR = port ? -0.47 : -0.52, sp = DOL19.span;
  const P = [[-1 * s, -0.2 + 0.08 * E.j1, d + 1.4], [xHim - sp * s, yR, d], [xHim + sp * s, yR + 0.02, d], [1.0 * s, -0.1 + 0.08 * E.j2, d + 1.8]];
  const tE = [0, DOL19.pre, DOL19.pre + E.rollDur, DOL19.pre + E.rollDur + DOL19.post];
  D.dol = { t0, tRoll, tRollEnd: tRoll + E.rollDur, tEnd: t0 + tE[3], side: s, called: false, on: false };
  if (life$1 && life$1.startDolphins) {
    life$1.startDolphins({ at: t0 - T, tE, P, n: E.podN, rollDir: E.rollDir, half2: E.half2, lag: DOL19.lag, dd: DOL19.dd, dy: DOL19.dy, rng: D.rng });
    D.dol.on = true;
  }
  const aw = E.awe, t1 = D.tLens + 1.2 + aw[0], t2 = D.dol.on ? tRoll - 1.3 + 0.3 * aw[1] : t1 + 2.4;
  D.awe = { i: -1, t0: 0, from: new V3(), cur: new V3(), d1: new V3(1, 0, 0), at: [t1, t2, Math.max(t2 + 2.0, D.dol.on ? D.dol.tRollEnd + 0.25 : 0) + aw[2], null] };
  if (D.mv) {
    const tSw = (D.eCors !== null && D.eCors !== undefined ? D.eCors : T) + SWEEP19.t0 + SWEEP19.d;
    let tv = D.dol.on ? D.dol.tRollEnd + 0.3 + 0.45 * (E.valve || 0) : D.tLens + 4.2 + 0.5 * (E.valve || 0);
    tv = Math.min(Math.max(tv, tSw + 1.5), D.Tland - 3.0);
    D.mv.valve = diver$1.anchors.exhaust ? tv : null;
    D.mv.spread = tv + VALVE19.up + VALVE19.at; D.mv.shut = tv + VALVE19.up + 0.15;
    if (D.mv.valve !== null) D.gLog.push(['valve', tv, D.valveHand, VALVE19.up + VALVE19.at + VALVE19.down]);
    D.gLog.push(['spread', D.mv.spread, 'both', 1.2]);
  }
  if (E.rare && life$1 && life$1.rare && life$1.rare.schedule) {
    const L = D.pLand, fl = floorHeight(L.x, L.z), at = Math.max(0, D.dol.tRollEnd + 1.1 - T), now = T + at;
    const cam = [camera.position.x, camera.position.y, camera.position.z];
    if (E.rareKind === 'stingray') D.rareP = life$1.rare.schedule('stingray', { near: [L.x, fl, L.z], camera: cam, lower: true, side: 'open', dist: 4.2 + 1.0 * E.rareR, flushR: 5.8, at });
    else if (E.rareKind === 'eagleRays') D.rareP = life$1.rare.schedule('eagleRays', { near: [L.x, fl + 1.5, L.z], camera: cam, dist: 7.5, count: E.rareR < 0.5 ? 2 : 3, side: 'open', closeIn: Math.max(1, D.Tland - now), at });
    else D.rareP = life$1.rare.schedule('shark', { near: [L.x, fl + 1.5, L.z], camera: cam, dist: 10 + 2 * E.rareR, depth: D.landY + 3, side: 'open', closeIn: Math.max(1, D.Tland - 1.5 - now), at });
  }
}

const AWE19 = [{ ease: 1.3, to: 'school' }, { ease: 0.9, to: 'dolphin' }, { ease: 1.4, to: 'other' }, { ease: 1.6, to: 'down' }];
const _aw19 = { a: new V3(), h: new V3(), l: new V3(), p: new V3(), m: new V3(), q: new THREE.Quaternion(), i: new THREE.Quaternion() };
const AWER19 = (22 * Math.PI) / 180, AWED19 = (30 * Math.PI) / 180;
function awe19(D, T, x, z, lk, dt) {
  const W = D.awe, fw = _aw19.h.set(-Math.sin(D.psi), 0, -Math.cos(D.psi));
  if (W) W.at[3] = Math.max(D.Tland - 3.2, W.at[2] + 1.6) + 0.3 * D.E.awe[3];
  if (W) { if (W.psiP !== undefined) { const dp = wrapA(D.psi - W.psiP); W.cur.applyAxisAngle(_Y19, dp); W.from.applyAxisAngle(_Y19, dp); } W.psiP = D.psi; }
  let i = -1;
  if (W) for (let k = 0; k < 4; k++) if (T >= W.at[k] && !(k === 2 && W.at[3] - W.at[2] < 1.0)) i = k;
  if (i < 0) { lk.copy(fw).multiplyScalar(Math.cos(0.12)).addScaledVector(_Y19, -Math.sin(0.12)); if (W) W.cur.copy(lk); return; }
  if (i !== W.i) { W.i = i; W.t0 = T; W.from.copy(W.cur); }
  const H = OP19.H, tg = _aw19.a, to = AWE19[i].to;
  let dn = 10 * DEG$3;
  if (to === 'school') {
    const c = life$1 && life$1.entryFocus ? life$1.entryFocus(H, 5, 6, _aw19.p) : null;
    if (c) tg.set(c.x - H.x, 0, c.z - H.z);
    const pM = D.dol && D.dol.on && life$1.dolphinLead ? life$1.dolphinLead(_aw19.m, 0.5 * (D.dol.tRoll + D.dol.tRollEnd) - T) : null;
    const sd = pM ? Math.sign(fw.z * (pM.x - H.x) - fw.x * (pM.z - H.z)) : 0;
    if (sd && c && Math.sign(fw.z * tg.x - fw.x * tg.z) !== sd) tg.set(0, 0, 0);
    if (!c || tg.lengthSq() < 0.04) tg.copy(fw).applyAxisAngle(_Y19, 40 * DEG$3 * (sd || D.E.aweSide));
    tg.normalize(); W.d1.copy(tg);
  } else if (to === 'dolphin') {
    const p = life$1 && life$1.dolphinLead ? life$1.dolphinLead(_aw19.p, 0.3) : null;
    if (p) { tg.subVectors(p, H); const hz = Math.hypot(tg.x, tg.z); dn = Math.min(0.65, Math.max(0, Math.atan2(-tg.y, hz))); tg.y = 0; }
    const tM = D.dol ? 0.5 * (D.dol.tRoll + D.dol.tRollEnd) - T : 0, pM = p && tM > 0.3 ? life$1.dolphinLead(_aw19.m, tM) : null;
    if (pM) tg.set(pM.x - H.x, 0, pM.z - H.z);
    if (!p || tg.lengthSq() < 0.04) tg.copy(W.d1);
    tg.normalize();
  } else if (to === 'other') {
    const cy = fw.z * W.from.x - fw.x * W.from.z;
    tg.copy(fw).applyAxisAngle(_Y19, (cy > 0 ? -1 : 1) * 40 * DEG$3);
  } else {
    tg.set(D.land.x + fw.x * 2 - H.x, 0, D.land.z + fw.z * 2 - H.z);
    const hz = tg.length();
    dn = clamp$9(Math.atan2(H.y - D.land.y, Math.max(0.5, hz)), 0.25, 0.65);
    if (hz < 0.05) tg.copy(fw); else tg.normalize();
  }
  const L = _aw19.l.set(camera.position.x - H.x, 0, camera.position.z - H.z);
  if (L.lengthSq() > 0.01) {
    L.normalize();
    if (tg.dot(L) > Math.cos(15 * DEG$3)) tg.applyAxisAngle(_Y19, (L.x * tg.z - L.z * tg.x >= 0 ? -1 : 1) * 20 * DEG$3);
  }
  tg.multiplyScalar(Math.cos(dn)).addScaledVector(_Y19, -Math.sin(dn));
  lk.copy(W.from).lerp(tg, sm5((T - W.t0) / AWE19[i].ease)).normalize();
  const ang = W.cur.angleTo(lk), mx = (to === 'dolphin' ? AWED19 : AWER19) * (dt || 0);
  if (ang > mx && ang > 1e-5) {
    _aw19.q.setFromUnitVectors(W.cur, lk); _aw19.i.identity().slerp(_aw19.q, mx / ang);
    lk.copy(W.cur).applyQuaternion(_aw19.i).normalize();
  }
  W.cur.copy(lk);
}
function fall19Frame(D, S, dt, t) {
  const T = G.st;
  const n = Math.max(1, Math.ceil(dt * 240)), h = dt / n;
  const surf0 = waveHeightDisp(D.px, D.pz, t), surfV = (waveHeightDisp(D.px, D.pz, t + 0.02) - surf0) / 0.02;
  const c0 = currentAt(D.px, D.py - 0.9, D.pz), ccx = c0.x, ccz = c0.z;
  for (let i = 0; i < n; i++) fall19Step(D, h, surf0 + surfV * i * h, surfV, ccx, ccz);
  if (D.tWater !== undefined && !D.touch) {
    const kS = smoothstep(0.35, 0.55, T - D.tWater) * (1 - smoothstep(1.4, 1.7, T - D.tWater));
    if (kS > 0) D.thV += (-4 * D.th - 2.5 * D.thV) * kS * dt;
  }
  D.pace = (D.pace || 0) + (Math.max(0, D.w || 0) - (D.pace || 0)) * (1 - Math.exp(-dt / 0.4));
  if (diver$1.setTetherCheck) {
    const kc = D.touch ? 1 - smoothstep(D.tTouch + 0.4, D.tTouch + 1.4, T) : smoothstep(4.2, 1.2, D.y - D.landY);
    diver$1.setTetherCheck(kc, D.touch ? 0 : Math.max(0, D.w || 0));
  }
  if (D.touch && D.tTouch === undefined) D.tTouch = D.eTouch;
  if (D.touch && !D.contact && T - D.tTouch > 0.15 && D.tStill !== null) D.contact = true;
  D.clock = T;
  if (!D.fHelmet && D.eHelmet === null && D.y - surf0 < 1.6) {
    const P = fallState19({ y: D.y, w: D.w, legs: D.legs, legs0: D.legs0, airF: D.airF, th: D.th, thV: D.thV, Eent: D.Eent, clock: D.clock, sT: D.sT, pushK: D.pushK, landY: D.landY, eHips: D.eHips, eCors: D.eCors });
    for (let i = 0; i < 240 && P.eHelmet === null; i++) fall19Step(P, 1 / 240, surf0 + surfV * (P.clock - T), surfV, 0, 0);
    if (P.eHelmet !== null) D.Thu = P.eHelmet;
  }
  if (surface.boat.dive) surface.diverLoad = (D.pressK || 1) * 0.35 * (1 - smoothstep(0.03, 0.15, T - D.sT)) * (D.pushK === undefined ? 1 : D.pushK);
  const f = cl01((D.yTr - D.y) / Math.max(0.1, D.yTr - D.landY)), k = smoothstep(0.1, 0.85, f);
  const x = D.x0 + D.hx + D.Dres.x * k, z = D.z0 + D.hz + D.Dres.z * k;
  _fv.vel.set((x - D.px) / Math.max(dt, 1e-4), (D.y - D.py) / Math.max(dt, 1e-4), (z - D.pz) / Math.max(dt, 1e-4));
  D.px = x; D.py = D.y; D.pz = z;
  const g = diver$1.group;
  g.position.set(x, D.y, z);
  yaw19(D, T, dt, x, z);
  const rk = D.fHelmet && !D.touch ? smoothstep(D.tHu || T, (D.tHu || T) + 2, T) * (1 - smoothstep(D.Tland - 1.5, D.Tland - 0.3, T)) : 0;
  const rkP = rk * (4.2 * Math.sin(T * 0.95 + D.seed * 7.3) + 1.3 * Math.sin(T * 2.1 + 1.9)) * DEG$3, rkR = rk * (3.4 * Math.sin(T * 0.73 + D.seed * 3.9 + 0.6) + 1.1 * Math.sin(T * 1.7 + 0.3)) * DEG$3;
  g.quaternion.setFromAxisAngle(_Y19, D.psi).multiply(_fv.q.setFromAxisAngle(_X19, -D.th - rkP)).multiply(_fv.q.setFromAxisAngle(_Z19, D.rl + rkR));
  D.psiD = D.psi;

  waterline19(_fv.wl, t);
  const toL = lensDir19(x, z);
  if (D.eCors !== null && !D.fCors) {
    D.fCors = true;
    D.tCors = T;
    D.entry = new V3(_fv.wl.x, waveHeightDisp(_fv.wl.x, _fv.wl.z, t), _fv.wl.z);
    D.splashS = clamp$9(D.Eent / EENT19, 0.5, 1.4);
    const VZc = 5.4 + 1.6 * D.splashS, VRc = 2.8 + 1.1 * D.splashS;
    fx.splashAt(D.entry, D.splashS, { j0: Math.max(0.1, D.Thu - T) + 0.30, R0: 0.31, VZ: VZc, VR: VRc, face: Math.atan2(-Math.cos(D.psi), -Math.sin(D.psi)) });
    lensSpray19(D.entry, 1.1 * VRc + 1.4, 7.5 + 1.5 * D.splashS, D.splashS / 1.2, 'body');
    if (D.spL && D.spL.close) D.spL.close();
    if (fx.entrain) { const y0 = D.y - 0.4; fx.entrain(_v19a.set(x, y0, z), Math.max(0, D.w), Math.round(3200 * D.splashS), 0.45, Math.max(0.1, D.entry.y - 0.1 - y0), toL, 0.15); }
    if (hull19(S).ok && fx.splash.setHull) fx.splash.setHull(H19.p, H19.n);
    if (audio$1.splashBody) audio$1.splashBody(D.splashS); else audio$1.splash(D.splashS);
    flinch19(0.5);
    if (life$1 && life$1.splash) life$1.splash(D.entry, D.splashS);
    if (diver$1.setWet) diver$1.setWet(1);
    if (diver$1.plunge) diver$1.plunge(D.w + surfV);
  }
  if (D.fCors && !D.fHelmet && fx.splash && fx.splash.track) fx.splash.track(_fv.wl.x, _fv.wl.z);
  else if (D.spL && !D.fCors && D.spL.track) D.spL.track(_fv.wl.x, _fv.wl.z);
  if (D.eHelmet !== null && !D.fHelmet) {
    D.fHelmet = true;
    audio$1.helmetUnder?.(D.w);
    if (diver$1.onInhale && !G.diveBreathHook) G.diveBreathHook = diver$1.onInhale((b) => { const Dv = G.dive; if (G.state === 'dive' && Dv && Dv.fHelmet && !Dv.relAt && !Dv.fTouch) audio$1.diveBreath?.(b && b.duration); });
    D.tHu = T;
    diver$1.anchors.helmet.getWorldPosition(_v19a);
    if (fx.splash && fx.splash.track) fx.splash.track(_v19a.x, _v19a.z);
    fx.burstAt(_v19a, 1.8, { w: D.w });
    if (fx.splash && fx.splash.close) fx.splash.close();
    if (fx.cling) for (const [an, r, nc] of CLING19) if (diver$1.anchors[an]) fx.cling(diver$1.anchors[an].getWorldPosition(_v19b), Math.max(0, D.w), nc, r, toL, 0.2);
    const P = predict19(D, surf0);
    D.Tland = P.eTouch; D.vLand = P.vTouch;
    D.pLand.set(D.x0 + P.hxT + D.Dres.x, D.landY, D.z0 + P.hzT + D.Dres.z);
    if (D.A) arcReplan19(D);
    D.relAt = T + 0.4;
  }
  if (D.fHelmet && T < D.tHu + 0.5 && fx.airTrail) {
    diver$1.anchors.helmet.getWorldPosition(_v19a);
    D.trAcc = (D.trAcc || 0) + 420 * dt;
    const nT = Math.floor(D.trAcc);
    if (nT > 0) { D.trAcc -= nT; fx.airTrail(_v19a.x, _v19a.y + 0.2, _v19a.z, waveHeightDisp(_v19a.x, _v19a.z, t) - 0.08, nT, D.w); }
  }
  if (D.fCors && T < (D.tHu || T) + 1.2 && fx.entrain) {
    D.enAcc = (D.enAcc || 0) + 3400 * Math.exp(-(T - D.tCors) / 0.6) * dt;
    const nE = Math.floor(D.enAcc);
    if (nE > 0) { D.enAcc -= nE; fx.entrain(_v19a.set(x, D.y - 0.35, z), Math.max(0, D.w), nE, 0.35, 1.6, toL, 0.15); }
  }
  if (D.fHelmet && T < D.tHu + 0.6 && fx.entrain) {
    D.coAcc = (D.coAcc || 0) + 5200 * (1 - smoothstep(0.15, 0.6, T - D.tHu)) * dt;
    const nC = Math.floor(D.coAcc);
    if (nC > 0) { D.coAcc -= nC; fx.entrain(_v19a.set(x, D.y - 0.95, z), Math.max(0, D.w), nC, 0.5, 1.9, toL, 0.15); }
  }
  if (D.fHelmet && T < D.tHu + 2.5 && fx.cling) {
    D.shAcc = (D.shAcc || 0) + 520 * Math.exp(-(T - D.tHu) / 1.0) * dt;
    for (; D.shAcc >= 1; D.shAcc -= 1) {
      const [an, r] = CLING19[Math.floor(Math.random() * CLING19.length)];
      if (diver$1.anchors[an]) fx.cling(diver$1.anchors[an].getWorldPosition(_v19b), Math.max(0, D.w), 1, r, toL, 0.2);
    }
  }
  const vS = D.mv ? D.mv.shut : null;
  EXH.dive = D.fHelmet ? PLUME19 * smoothstep(D.tHu, D.tHu + 0.3, T) * (vS === null ? 1 : 1 - smoothstep(vS, vS + 0.8, T)) : 0;
  if (D.fCors && !D.fPlop && fx.splash && fx.splash.on && fx.splash.t >= fx.splash.j0) { D.fPlop = true; if (audio$1.plop) audio$1.plop(D.splashS / 1.4); }
  if (D.relAt && T >= D.relAt) { D.relAt = 0; if (diver$1.breathe) diver$1.breathe('release'); audio$1.release?.(); }
  if (D.fHelmet && D.wetHeld && T > D.tHu + 0.8) { D.wetHeld = false; if (diver$1.setWet) diver$1.setWet(null); }
  if (D.valveAt === null && D.fHelmet && surf0 - (D.y + 0.67) > 3.0) {
    D.valveAt = T;
    audio$1.valve?.(1);
    if (fx.exhaleFrom && diver$1.anchors.exhaust) fx.exhaleFrom(diver$1.anchors.exhaust.getWorldPosition(new V3()), 1.5);
  }
  if (D.mv && D.mv.valve !== null && D.mv.shut !== null && !D.mv.snd && T >= D.mv.shut) { D.mv.snd = true; audio$1.valve?.(0); }
  _fv.keel.set(S.notch.x, surface.boat.group.position.y - 1.0, S.notch.z);
  if (D.touch && !D.fTouch) {
    D.fTouch = true;
    audio$1.land?.(Math.abs(D.vTouch || 0));
    D.landAct = new V3(x, D.landY, z);
    D.psiEnd = D.psi;
    const r = probeRest19(D.landAct, D.psiEnd + (D.restSg || 0) * 30 * DEG$3);
    D.rest.pos.copy(r.pos); D.rest.q.copy(r.q); D.rest.fov = r.fov; D.restPsi = D.psiEnd;
    const lk = clamp$9(Math.abs(D.vTouch) / 1.2, 0.2, 1), fh = floorHeight(x, z);
    sandAlbedo(x, z, 0.2, _fv.sc);
    for (const kk of ['rightFoot', 'leftFoot']) {
      const an = diver$1.anchors[kk];
      if (!an) continue;
      an.getWorldPosition(_v19a);
      _v19a.y = fh + 0.01;
      fx.kick(_v19a, Math.round(2 + 3 * lk), { color: _fv.sc, rim: 0.1, speed: 0.15 + 0.2 * lk, up: 0.02 + 0.04 * lk, life: 2.2 + 1.2 * lk, size: 0.2 + 0.08 * lk, ground: fh });
    }
    fx.kick(_v19a.set(x, fh + 0.01, z), Math.round(4 + 3 * lk), { color: _fv.sc, rim: 0.22, speed: 0.2 + 0.2 * lk, up: 0.02 + 0.03 * lk, life: 2.5 + 1.2 * lk, size: 0.18 + 0.06 * lk, ground: fh });
  }

  let pose = 'land';
  if (!D.touch) pose = !D.fHelmet ? 'step' : 'sink';
  if (pose === 'step' && diver$1.diveProgress) diver$1.diveProgress(0.18 + 0.82 * cl01((T - D.sT) / Math.max(0.05, (D.Thips || D.sT + 0.45) - D.sT)));
  const lk = _fv.look;
  if (!D.fHelmet) lk.set(-Math.sin(D.psi), 0, -Math.cos(D.psi)).multiplyScalar(Math.cos(0.6)).addScaledVector(_Y19, -Math.sin(0.6));
  else if (!D.touch) awe19(D, T, x, z, lk, dt);
  else lk.set(D.M.x - x, 0, D.M.z - z).normalize().multiplyScalar(Math.cos(0.15)).addScaledVector(_Y19, -Math.sin(0.15));
  diverTethers(false);
  hands19(D, T, dt);
  _fv.cur.copy(currentAt(x, D.y)).multiplyScalar(D.touch ? smoothstep((D.tTouch || T) + 1.8, (D.tTouch || T) + 3.5, T) : 1);
  DIVE19.perch = false;
  DIVE19.bow = 0;
  DIVE19.glances = !(D.tau !== null && !D.touch);
  DIVE19.suitAir = clamp$9(0.15 + (0.35 * D.Va) / 0.030, 0, 1);
  DIVE19.landV = D.touch ? D.vTouch : 0;
  DIVE19.touch = D.touch;
  DIVE19.landDip = D.touch ? clamp$9(D.dp / 0.1, 0, 1.2) : -1;
  DIVE19.spread = 0;
  DIVE19.knees = D.spr || 0;
  DIVE19.ext = legExt19(T - D.sT);
  D.pre = Math.max(D.pre || 0, D.touch ? 1 : smoothstep(1.0, 0.0, D.y - D.landY));
  DIVE19.prep = D.pre;
  if (!D.armGo && diver$1.anchors.chest && diver$1.anchors.chest.getWorldPosition(_v19a).y < waveHeightDisp(_v19a.x, _v19a.z, t)) D.armGo = true;
  DIVE19.armGo = !!D.armGo;
  _fv.int[0].copy(_fv.keel); _fv.int[1].copy(D.M); _fv.int[2].copy(D.land);
  let eff = D.fCors ? lerp$4(0.8, 0.55, cl01((T - D.tCors) / 8)) : 0.8;
  eff = Math.max(eff, 0.72 * smoothstep(6.5, 4.5, D.y - D.landY));
  diver$1.update(dt, t, { pose, vel: _fv.vel, grounded: D.touch, floor: floorHeight, waterY: waveHeightDisp(x, z, t), current: _fv.cur, lookDir: lk, effort: eff, interest: _fv.int, dive: DIVE19, perchGo: 1 });
  diver$1.setFade(1);

  if (!D.fHips) {
    for (let a2 = 0; a2 < 2; a2++) {
      const B = D.boot[a2], an = diver$1.anchors[a2 ? 'leftFoot' : 'rightFoot'];
      if (!an) continue;
      an.getWorldPosition(_v19a);
      const sea = waveHeightDisp(_v19a.x, _v19a.z, t);
      if (!B.init) { B.init = true; B.p.copy(_v19a); B.y0 = _v19a.y; B.wet0 = _v19a.y - 0.06 < sea; continue; }
      const vy = (_v19a.y - B.p.y) / Math.max(dt, 1e-4);
      B.p.copy(_v19a);
      if (!B.on) {
        if (B.wet0 ? _v19a.y < B.y0 - 0.06 : _v19a.y - 0.06 < sea) { B.on = true; bootSplash19(D, B, a2, _v19a, sea, Math.max(0.2, surfV - vy)); }
      } else if (B.sp && B.sp.track) B.sp.track(_v19a.x, _v19a.z);
    }
  }
  if (D.eHips !== null && !D.fHips) D.fHips = true;
  if (D.fBoots && !D.fCors && fx.spray && fx.spray.spawn) {
    waterline19(_v19a, t);
    const sea = waveHeightDisp(_v19a.x, _v19a.z, t), U = Math.max(0, (D.w || 0) + surfV), wd = D.fHips ? 0.46 : 0.3;
    D.clAcc = (D.clAcc || 0) + Math.min(3600, (160 * U * U * wd) / 0.3) * dt;
    for (; D.clAcc >= 1; D.clAcc -= 1) {
      const th = hash19(D.seed + D.clAcc * 0.37, T * 13.1) * 6.2832, lop = 1 + 0.55 * Math.sin(th - D.seed * 5.3 - 4 * (T - D.sT));
      const rr = wd * 0.5 + 0.02 + 0.03 * hash19(T * 7.7, D.clAcc), up = Math.min(6.5, (0.4 + 1.1 * Math.pow(hash19(D.clAcc * 3.1, T), 1.5)) * U * lop), ov = (0.2 + 0.6 * hash19(T * 3.3, D.clAcc * 1.7)) * U * lop;
      const q = hash19(D.clAcc * 5.3, T * 2.9), c = 0.93 + 0.06 * hash19(T, D.clAcc * 9.1);
      fx.spray.spawn(_v19a.x + Math.cos(th) * rr, sea + 0.01, _v19a.z + Math.sin(th) * rr, Math.cos(th) * ov, up, Math.sin(th) * ov, 2.2,
        q < 0.06 ? 0.005 + 0.004 * hash19(th, T * 1.3) : q < 0.4 ? 0.002 + 0.003 * hash19(T, th) : 0.0005 + 0.001 * hash19(th, T), c, c, c);
    }
  }
}
const _wl19 = [new V3(), new V3()];
function waterline19(out, t) {
  const A = diver$1.anchors, p0 = diver$1.group.position;
  const p1 = A.chest.getWorldPosition(_wl19[0]), p2 = A.helmet.getWorldPosition(_wl19[1]);
  const s0 = p0.y - waveHeightDisp(p0.x, p0.z, t), s1 = p1.y - waveHeightDisp(p1.x, p1.z, t), s2 = p2.y - waveHeightDisp(p2.x, p2.z, t);
  if (s0 >= 0) return out.set(p0.x, 0, p0.z);
  if (s1 >= 0) { const k = -s0 / Math.max(1e-6, s1 - s0); return out.set(lerp$4(p0.x, p1.x, k), 0, lerp$4(p0.z, p1.z, k)); }
  if (s2 >= 0) { const k = -s1 / Math.max(1e-6, s2 - s1); return out.set(lerp$4(p1.x, p2.x, k), 0, lerp$4(p1.z, p2.z, k)); }
  return out.set(p2.x, 0, p2.z);
}
const H19 = { p: new V3(), n: new V3(), ok: false };
function hull19(S) {
  const bg = surface.boat.group, ds = bg.userData && bg.userData.diverSpot;
  H19.ok = false;
  if (!ds || !ds.rungs || !ds.rungs.length) return H19;
  let best = ds.rungs[0], bd = Infinity;
  for (const r of ds.rungs) { const d = Math.abs(r.y + 0.027); if (d < bd) { bd = d; best = r; } }
  bg.updateMatrixWorld();
  H19.p.copy(best).applyMatrix4(bg.matrixWorld).addScaledVector(S.out, -0.075);
  H19.n.copy(S.out);
  H19.ok = true;
  return H19;
}
function bootSplash19(D, B, a, p, sea, U) {
  const nd = clamp$9(Math.round(10 * U * U), 6, 110);
  if (fx.spray && fx.spray.spawn) {
    for (let i = 0; i < nd; i++) {
      const flat = Math.random() < 0.6, th = Math.random() * 6.2832, r = 0.06 + Math.random() * 0.05;
      const up = (flat ? 0.15 + 0.35 * Math.random() : 0.6 + 0.8 * Math.random()) * U, ov = (flat ? 0.8 + 1.4 * Math.random() : 0.15 + 0.35 * Math.random()) * U;
      const c = 0.93 + Math.random() * 0.06;
      fx.spray.spawn(p.x + Math.cos(th) * r, sea + 0.01, p.z + Math.sin(th) * r, Math.cos(th) * ov, up, Math.sin(th) * ov, 1.6, 0.0006 + 0.0028 * Math.pow(Math.random(), 1.5), c, c, c);
    }
  }
  B.sp = fx.splashSmall ? fx.splashSmall(_v19f.set(p.x, sea, p.z), U, a) : null;
  if (B.sp && B.sp.setHull && hull19(ST19).ok) B.sp.setHull(H19.p, H19.n);
  if (audio$1.slap) audio$1.slap(clamp$9(U / 3, 0, 1), a);
  if (!D.fBoots) {
    D.fBoots = true;
    if (audio$1.splashBody) audio$1.splash(clamp$9(U / 3.5, 0.6, 1.4));
    lensSpray19(p, 0.93 * U, Math.min(4.5, 1.55 * U), clamp$9(U / 3.5, 0, 1), 'legs');
    if (life$1 && life$1.setDescent) life$1.setDescent(new V3(D.px, sea, D.pz), D.land, D.M);
    if (life$1 && life$1.splash) life$1.splash(_v19e.set(D.px, sea, D.pz), 0, true);
    if (fx.splashLegs && G.dive && G.dive.v19) {
      const T = G.st, tH = Math.max(0.1, (D.Thips || T + 0.3) - T), tC = Math.max(tH, (D.Tcors || T + 0.35) - T);
      D.spL = fx.splashLegs(_v19e.set(D.px, sea, D.pz), clamp$9(0.25 + 0.3 * U, 0.5, 1.4), { R0: 0.16, R1: 0.27, tR: tH, w: 2 * Math.max(0.2, tC), life: tC + 0.25, VZ: 1.0 + 0.9 * U, VR: 0.5 + 0.4 * U, lop: [0.45, Math.atan2(p.z - D.pz, p.x - D.px), 0.07] });
      if (D.spL && D.spL.setHull && hull19(ST19).ok) D.spL.setHull(H19.p, H19.n);
    }
  }
}
const lensR19 = () => (WATER.uLensR ? WATER.uLensR.value : LENS_DIVE19);
function lensSpray19(p, vo, vu, s, src) {
  const LR = lensR19(), cp = camera.position, d0 = Math.hypot(cp.x - p.x, cp.z - p.z), h = cp.y - LR - p.y;
  const vc = d0 > 1e-3 ? Math.max(0, (OP19.Vout.x * (p.x - cp.x) + OP19.Vout.z * (p.z - cp.z)) / d0) : 0, d = (d0 * vo) / Math.max(0.5, vo + vc);
  const under = cp.y + LR < waveHeightDisp(cp.x, cp.z, U.uTime.value), disc = vu * vu - 2 * 9.8 * h;
  const reach = disc > 0 ? (vo * (vu + Math.sqrt(disc))) / 9.8 : 0;
  const k = !under && reach > 0 ? clamp$9((1.3 * reach - d) / (0.3 * reach), 0, 1) * clamp$9(s, 0, 1) : 0;
  _v19f.copy(p).project(camera);
  const L = G.lensSpray || (G.lensSpray = { t: 0, src: '', k: 0, eta: 0, x: 0, y: 0, n: 0 });
  L.t = G.st; L.src = src; L.k = k; L.eta = d / Math.max(0.5, vo); L.x = _v19f.x; L.y = _v19f.y; L.n++;
}

const RAMP = { k: 1, k0: 1, k1: 1, t: 0 };
function diveRamp(rdt) {
  let want = 1;
  const D = G.dive;
  if (G.state === 'dive' && D && D.v19 && D.phase === 'fall' && D.tau !== null && D.tau >= 1.0 && !D.brake && D.y - D.landY > 5.5) {
    const k = player.keys;
    want = k.KeyW || k.KeyA || k.KeyS || k.KeyD || k.ArrowUp || k.ArrowDown || k.ArrowLeft || k.ArrowRight ? DIVE_RAMP_HURRY : DIVE_RAMP;
  }
  if (want !== RAMP.k1) { RAMP.k0 = RAMP.k; RAMP.k1 = want; RAMP.t = 0; }
  if (RAMP.k !== RAMP.k1) {
    RAMP.t += rdt;
    const s = Math.sin(0.5 * Math.PI * Math.min(1, RAMP.t / 0.5));
    RAMP.k = RAMP.t >= 0.5 ? RAMP.k1 : RAMP.k0 + (RAMP.k1 - RAMP.k0) * s * s;
  }
  return RAMP.k;
}

const OP19 = {
  X: new V3(), V: new V3(), Q: new THREE.Quaternion(), W: new V3(), acc: new V3(),
  Xt: new V3(), XtP: new V3(), Vt: new V3(), H: new V3(), HP: new V3(), vH: new V3(),
  pos: new V3(), posP: new V3(), Vout: new V3(), qPrev: new THREE.Quaternion(),
  o: new V3(), fl: 0, flv: 0, flT: 1, flK: 0, roll: 0, init: false,
  Hm: new V3(), Hmv: new V3(), Hr: new V3(), qdP: new THREE.Quaternion(), Wt: new V3(),
  B: new V3(), XtR: new V3(), qdLP: new THREE.Quaternion(), qdLPi: false, wyLP: 0, Hs: new V3(), Hsv: new V3(),
  lim: { init: false, p: new V3(), pt: new V3(), v: new V3(), a: new V3(), q: new THREE.Quaternion() },
  E: new V3(), Ev: new V3(), Ea: new V3(), pDir: new V3(), pDirOk: false, wasPush: false, ayP: 0,
};
function flinch19(k) { OP19.flT = 0; OP19.flK = k; }

const HR19 = 0.20, DNT19 = 0.42, DNV19 = 2.2;
const LENS_DIVE19 = 0.035;
const LENS_CLR19 = 0.12;
const TX19 = (() => { let lo = 0, hi = 1; for (let k = 0; k < 40; k++) { const x = 0.5 * (lo + hi); if (DNV19 * DNT19 * (x * x * x - 0.5 * x * x * x * x) < HR19) lo = x; else hi = x; } return DNT19 * 0.5 * (lo + hi); })();
const _hp19 = { h: 0, v: 0, a: 0 };
function hPlan19(T, P, tDn) {
  const L = P.t1 - P.t0, u = cl01((T - P.t0) / L), dh = HR19 - P.h0;
  let h = P.h0 + dh * sm5(u), v = (dh * sm5d(u)) / L, a = u > 0 && u < 1 ? (dh * 60 * u * (1 - u) * (1 - 2 * u)) / (L * L) : 0;
  if ((P.v0 || P.a0) && u < 1) {
    const v0 = P.v0 || 0, a0 = P.a0 || 0, u2 = u * u, u3 = u2 * u;
    h += v0 * L * (u - 6 * u3 + 8 * u3 * u - 3 * u3 * u2) + a0 * L * L * (0.5 * u2 - 1.5 * u3 + 1.5 * u3 * u - 0.5 * u3 * u2);
    v += v0 * (1 - 18 * u2 + 32 * u3 - 15 * u3 * u) + a0 * L * (u - 4.5 * u2 + 6 * u3 - 2.5 * u3 * u);
    a += (v0 * (-36 * u + 96 * u2 - 60 * u3)) / L + a0 * (1 - 9 * u + 18 * u2 - 10 * u3);
  }
  if (T > tDn) {
    const vD = P.vDn || DNV19, Tr = DNT19, x = (T - tDn) / Tr, xc = Math.min(1, x);
    h -= vD * Tr * (x < 1 ? x * x * x - 0.5 * x * x * x * x : x - 0.5);
    v -= vD * xc * xc * (3 - 2 * xc);
    a -= x < 1 ? (vD * 6 * x * (1 - x)) / Tr : 0;
  }
  _hp19.h = h; _hp19.v = v; _hp19.a = a;
  return _hp19;
}
function pushEnd19(O, Xt, w, z, amax, vmax, ff, dt) {
  const n = Math.max(1, Math.ceil(dt * 240)), h = dt / n;
  for (let i = 1; i <= n; i++) {
    _v19b.lerpVectors(O.XtP, Xt, i / n);
    const a = _v19c.subVectors(_v19b, O.E).multiplyScalar(w * w);
    a.x += 2 * z * w * (O.Vt.x * ff - O.Ev.x); a.y += 2 * z * w * (O.Vt.y * ff - O.Ev.y); a.z += 2 * z * w * (O.Vt.z * ff - O.Ev.z);
    softSat19(a, amax);
    _v19e.subVectors(a, O.Ea);
    const dl = _v19e.length(), jm = 40 * h;
    if (dl > jm) a.copy(O.Ea).addScaledVector(_v19e, jm / dl);
    O.Ea.copy(a);
    O.Ev.addScaledVector(a, h);
    softCap19(O.Ev, vmax);
    O.E.addScaledVector(O.Ev, h);
  }
}
function op19(dt, t, rdt) {
  const D = G.dive, O = OP19, T = G.st;
  const fall = D.phase === 'fall', tau = D.tau; diver$1.group.position;
  diver$1.anchors.helmet.getWorldPosition(O.H);
  if (!O.init) { O.HP.copy(O.H); O.vH.set(0, 0, 0); O.Hm.copy(O.H); O.Hmv.set(0, 0, 0); O.Hs.copy(O.H); O.Hsv.set(0, 0, 0); }
  else {
    O.vH.lerp(_v19a.subVectors(O.H, O.HP).divideScalar(Math.max(dt, 1e-4)), 1 - Math.exp(-dt / 0.06));
    const n = Math.max(1, Math.ceil(dt * 240)), h = dt / n;
    for (let i = 0; i < n; i++) {
      O.Hmv.addScaledVector(_v19a.subVectors(O.H, O.Hm), 36 * h).addScaledVector(O.Hmv, -12 * h); O.Hm.addScaledVector(O.Hmv, h);
      O.Hsv.addScaledVector(_v19a.subVectors(O.H, O.Hs), 4 * h).addScaledVector(O.Hsv, -4 * h); O.Hs.addScaledVector(O.Hsv, h);
    }
  }
  O.HP.copy(O.H);
  const Hr = O.Hr.copy(O.Hs).lerp(O.H, fall ? smoothstep(D.sT, D.sT + 0.9, T) : 0);
  if (D.pHu && D.tB1 !== null && D.tB1 !== undefined) {
    const kH = smoothstep(D.tB1, D.tB1 + 1.0, T) * (1 - (fall ? smoothstep(D.Thu, D.Thu + 0.5, T) : 0));
    Hr.x = lerp$4(Hr.x, D.pHu.x, kH); Hr.z = lerp$4(Hr.z, D.pHu.z, kH);
  }
  const Bm = O.B.copy(O.H); Bm.y -= 0.6;
  const A = D.A, Thu = fall ? D.Thu : D.Tr + 0.75, Tland = fall ? D.Tland : Thu + 15;
  const tr = fall ? T - D.sT : 0;
  const wR1 = fall ? sm5((T - (Tland - 2.4)) / 1.8) : 0;
  const wR2 = fall && D.touch ? sm5((T - D.tTouch) / 1.2) : 0;
  const kU = D.lensUnder ? smoothstep(0, 0.3, tau) : 0;
  const kDn = D.lensUnder ? 1 - smoothstep(6.5, 9.0, tau) : 0;
  D.wR = wR2; D.wR1 = wR1;
  const arc = fall && D.lensUnder && A.TE !== undefined;
  let cx = ARC19.cxA, cy = 0.5, lens = 0;
  const Xt = O.Xt;
  const wyT = waveHeightDisp(A.XA.x, A.XA.z, t);
  if (!O.init) O.wyLP = wyT; else O.wyLP += (wyT - O.wyLP) * (1 - Math.exp(-dt / 0.8));
  if (arc) {
    const b = arcBear19(A, T), e = arcElev19(A, T), R = arcR19(A, T), ce = Math.cos(e);
    Xt.set(Hr.x + Math.sin(b) * R * ce, Hr.y + R * Math.sin(e), Hr.z + Math.cos(b) * R * ce);
    Xt.y = Math.min(Xt.y, waveHeightDisp(Xt.x, Xt.z, t) - 0.35);
    cx = arcCx19(A, T); cy = arcCy19(A, T);
    lens = arcLens19(A, T);
  } else {
    const kG = D.tB1 !== null && D.tB1 !== undefined ? smoothstep(D.tB1, D.tB1 + 0.8, T) : 0;
    Xt.set(A.XA.x, lerp$4(O.wyLP, wyT, sm5((T - (D.TL - 0.9)) / 1.2)) + lerp$4(0.32, 0.2, kG), A.XA.z);
  }
  lens = lerp$4(lens, D.rest.fov, wR2);
  if (wR2 > 0) {
    const pv = D.landAct || D.pLand, da = (Number.isFinite(D.psi) && Number.isFinite(D.restPsi) ? D.psi - D.restPsi : 0), ca = Math.cos(da), sa = Math.sin(da);
    const rx = D.rest.pos.x - pv.x, rz = D.rest.pos.z - pv.z;
    _v19f.set(pv.x + rx * ca + rz * sa, D.rest.pos.y, pv.z - rx * sa + rz * ca);
    Xt.lerp(_v19f, wR2);
  }
  standOff19(Xt);
  if (!O.init) { O.XtP.copy(Xt); O.Vt.set(0, 0, 0); }
  else O.Vt.lerp(_v19a.subVectors(Xt, O.XtP).divideScalar(Math.max(dt, 1e-4)), 1 - Math.exp(-dt / 0.08));

  const push = T < D.TL;
  if (!O.init) {
    O.X.copy(D.P0); O.V.set(0, 0, 0);
    O.Q.copy(D.fromQ); O.W.set(0, 0, 0);
    O.pos.copy(D.P0); O.posP.copy(D.P0); O.qPrev.copy(D.fromQ);
    O.acc.set(0, 0, 0);
    O.sPush = undefined; O.psiHold = undefined; O.qPl = null; O.qdInit = false; O.qdLPi = false; O.lim.init = false;
    O.E.copy(Xt); O.Ev.set(0, 0, 0); O.Ea.set(0, 0, 0); O.pDirOk = false; O.wasPush = false;
    O.init = true;
  }
  let pY = 0, pVy = 0, pAy = 0, kPl = 0;
  if ((D.tB1 !== null && D.tB1 !== undefined && T >= 0.23 * D.TL) || (G.compiled && T >= D.TL - 1.2)) {
    const rp = push ? O.E : O.X, rv = push ? O.Ev : O.V, vx = rv.x * 0.02, vz = rv.z * 0.02;
    const wy0 = waveHeightDisp(rp.x, rp.z, t), wyP = waveHeightDisp(rp.x + vx, rp.z + vz, t + 0.02), wyM = waveHeightDisp(rp.x - vx, rp.z - vz, t - 0.02);
    const wyV = (wyP - wyM) / 0.04, wyA = clamp$9((wyP - 2 * wy0 + wyM) / 0.0004, -6, 6);
    if (!D.plan) {
      const t0 = T - dt, L = Math.max(0.5, (fall ? D.Thu : D.Tr + 0.8) + 0.08 - TX19 - t0);
      D.plan = { t0, t1: t0 + L, h0: O.X.y - waveHeightDisp(rp.x, rp.z, t - dt), v0: O.V.y - wyV, a0: (push ? O.ayP || 0 : O.acc.y) - wyA };
    }
    const P = D.plan;
    D.tDn = fall ? D.Thu + 0.08 - TX19 : Infinity;
    if (fall && P.vDn === undefined && T >= D.tDn) P.vDn = clamp$9((D.w || 0) + 0.4, DNV19, 2.8);
    const H = hPlan19(T, P, D.tDn);
    pY = wy0 + H.h; pVy = wyV + H.v; pAy = wyA + H.a;
    kPl = D.lensUnder ? 1 - sm5((T - D.tLens - 0.4) / 0.5) : 1;
  }
  const pace = D.pace || 0;
  D.lag = fall && D.lensUnder ? clamp$9(O.X.y - Xt.y, 0, 2) : 0;
  D.pv = fall && D.lensUnder ? clamp$9(O.Vt.length(), pace, pace + 1.5) : pace;
  let w = 4.5, z = fall ? 1.0 : 0.9, amax = 3, vmax = 3.6;
  if (fall) { w = lerp$4(3, 3.5, kU); amax = lerp$4(3, Math.max(lerp$4(2.0, 2.3, kDn), 1.8 + 0.45 * pace), kU); vmax = lerp$4(3.6, Math.max(lerp$4(2.0, 2.6, kDn), 0.4 + 1.2 * D.pv + 0.5 * D.lag), kU); }
  w = lerp$4(w, 2.6, wR1); z = lerp$4(z, 1.0, wR1); amax = lerp$4(amax, Math.max(1.2, 0.9 * pace), wR1); vmax = lerp$4(vmax, Math.max(1.6, 1.2 * pace), wR1);
  w = lerp$4(w, 4.0, wR2); amax = lerp$4(amax, 1.9, wR2); vmax = lerp$4(vmax, 2.0, wR2);
  const ff = fall ? smoothstep(0.05, 0.25, tr) : 1;
  if (push) {
    const TL = D.TL, u = cl01(T / TL);
    pushEnd19(O, Xt, w, z, amax, vmax, ff, dt);
    const E = O.E, C2 = _v19b.copy(E).addScaledVector(A.pDir, 3.0).addScaledVector(_Y19, 0.5), P0 = D.P0, C1 = A.C1;
    const spd = (x) => bezD19(_v19e, P0, C1, C2, E, x).length();
    const len = (x) => { let L0 = 0; for (let k = 0; k < 5; k++) L0 += GL5W[k] * spd(0.5 * x * (1 + GL5X[k])); return 0.5 * x * L0; };
    const total = len(1), want = total * smF19(u);
    let s = O.sPush !== undefined ? O.sPush : u;
    for (let it = 0; it < 5; it++) s = clamp$9(s - (len(s) - want) / Math.max(1e-6, spd(s)), 0, 1);
    O.sPush = s;
    _v19f.copy(O.X);
    bez19(O.X, P0, C1, C2, E, s);
    if (kPl > 0) O.X.y = lerp$4(O.X.y, pY, kPl);
    {
      const tD = Number.isFinite(D.tDn) ? D.tDn : Infinity, kc = tD === Infinity ? 1 : 1 - smoothstep(tD - 0.2, tD - 0.05, T);
      if (kc > 0) {
        const fl = waveHeightDisp(O.X.x, O.X.z, t) + LENS_CLR19, y = O.X.y, hk = Math.max(0.06 - Math.abs(y - fl), 0) / 0.06;
        O.X.y = lerp$4(y, Math.max(y, fl) + hk * hk * 0.015, kc);
      }
    }
    const vy0 = O.V.y;
    O.V.subVectors(O.X, _v19f).divideScalar(Math.max(dt, 1e-4));
    O.ayP = (O.V.y - vy0) / Math.max(dt, 1e-4);
    O.acc.set(0, 0, 0);
    O.wasPush = true;
  } else {
    if (O.wasPush) { O.wasPush = false; O.acc.copy(O.Ea); }
    const dMax = arc ? Math.max(2.8, arcR19(A, T) + 0.35) : 2.8, dMin = 2.0, kd = fall && !D.lensUnder ? 12 : 6;
    const n = Math.max(1, Math.ceil(dt * 240)), h = dt / n;
    for (let i = 1; i <= n; i++) {
      _v19b.lerpVectors(O.XtP, Xt, i / n);
      let vty = O.Vt.y * ff;
      if (kPl > 0) { _v19b.y = lerp$4(_v19b.y, pY + pVy * (i * h - dt), kPl); vty = lerp$4(vty, pVy, kPl); }
      const a = _v19c.subVectors(_v19b, O.X).multiplyScalar(w * w);
      a.x += 2 * z * w * (O.Vt.x * ff - O.V.x); a.y += 2 * z * w * (vty - O.V.y) + pAy * kPl; a.z += 2 * z * w * (O.Vt.z * ff - O.V.z);
      const ayP = a.y;
      if (fall && wR1 < 1) {
        const dx = O.X.x - O.H.x, dy = O.X.y - O.H.y, dz = O.X.z - O.H.z, d = Math.hypot(dx, dy, dz);
        const k = (d > dMax ? -Math.min(6, 6 * (d - dMax)) : d < dMin ? Math.min(kd, kd * (dMin - d)) : 0) * (1 - wR1);
        if (k && d > 1e-4) a.addScaledVector(_v19d.set(dx, dy, dz), k / d);
      }
      avoid19(O, D, t, a);
      { const vl = O.V.length(), av = a.dot(O.V); if (vl > 0.8 * vmax && av > 0) a.addScaledVector(O.V, (-av / (vl * vl)) * smoothstep(0.8 * vmax, vmax, vl)); }
      const pl = kPl > 0.01, ayK = pl ? lerp$4(a.y, ayP, kPl) : 0;
      if (pl) a.y = 0;
      softSat19(a, pl ? Math.sqrt(Math.max(0.25, amax * amax - ayK * ayK)) : amax);
      _v19e.subVectors(a, O.acc);
      if (pl) _v19e.y = 0;
      const dl = _v19e.length(), jm = 40 * h;
      if (dl > jm) { const ay0 = a.y; a.copy(O.acc).addScaledVector(_v19e, jm / dl); if (pl) a.y = ay0; }
      if (pl) a.y = ayK;
      O.acc.copy(a);
      O.V.addScaledVector(a, h);
      if (fall) {
        const vy = clamp$9(O.V.y, -vmax, vmax);
        O.V.y = 0; softCap19(O.V, Math.sqrt(Math.max(0.25, vmax * vmax - vy * vy))); O.V.y = vy;
      } else softCap19(O.V, vmax);
      O.X.addScaledVector(O.V, h);
      if (kPl > 0) { O.X.y = lerp$4(O.X.y, pY + pVy * (i * h - dt), kPl); O.V.y = lerp$4(O.V.y, pVy, kPl); }
      guards19(O, D, t, wR1, h);
    }
  }
  O.XtP.copy(Xt);

  const aim = _v19a.copy(Bm).addScaledVector(_v19c.subVectors(O.vH, O.V), 0.1 * (1 - wR1));
  const lp = O.lim.init && !push ? O.lim.p : O.X;
  const qd = aimQ19(_q19a, lp, aim, cx, cy);
  const kF = D.lensUnder ? 1 - sm5((T - D.tLens) / 0.8) : 1, kFv = D.lensUnder ? 1 - sm5((T - D.tLens) / 1.2) : 1;
  const pitP = arcPitch19(D, T);
  _e19.setFromQuaternion(qd, 'YXZ');
  let yawQ = _e19.y, rlQ = 0, lensA = 0;
  if (kF > 0 || kFv > 0) {
    const fov = !fall ? A.fP : lerp$4(A.fP, (baseFov + ARC19.fovDrop * (camera.aspect < 1 ? 0.5 : 1)) * DEG$3, sm5((T - D.sT) / 0.9));
    const uY = cl01(T / D.TL), yaw = A.psi0 + (A.psiA - A.psi0) * (0.5 * uY * uY * (3 - 2 * uY) + 0.5 * sm5(uY)), rl = A.rl0 * (1 - sm19(T / D.TL));
    yawQ += wrapA(yaw - yawQ) * kF; rlQ = rl * kF;
    lensA = fov / DEG$3 - baseFov;
    if (push) lensA = lerp$4(-3, lensA, sm5(cl01(T / D.TL)));
    lens = lerp$4(lens, lensA, kFv);
  }
  let pitQ = pitP;
  if (wR2 > 0) {
    const f = _v19b.set(0, 0, -1).applyQuaternion(D.rest.q), s = Math.max(1, _v19c.subVectors(Bm, D.rest.pos).dot(f));
    _e19r.setFromQuaternion(aimQ19(_q19c, lp, _v19d.copy(D.rest.pos).addScaledVector(f, s), 0.5, 0.5), 'YXZ');
    yawQ += wrapA(_e19r.y - yawQ) * wR2;
    pitQ = lerp$4(pitP, _e19r.setFromQuaternion(D.rest.q, 'YXZ').x, wR2);
  }
  qd.setFromEuler(_e19.set(pitQ, yawQ, rlQ, 'YXZ'));
  if (!O.qPl) { O.qPl = new THREE.Quaternion(); O.qPlP = new THREE.Quaternion(); O.qPlOk = false; }
  if (push) O.qPl.copy(qd);
  if (fall && !push) {
    _e19.setFromQuaternion(qd, 'YXZ');
    if (O.psiHold !== undefined && wrapA(_e19.y - O.psiHold) * A.sgn < 0) { _e19.y = O.psiHold; qd.setFromEuler(_e19); }
    O.psiHold = _e19.y;
  }
  if (!O.qdLPi) { O.qdLP.copy(qd); O.qdLPi = true; } else O.qdLP.slerp(qd, 1 - Math.exp(-dt / 0.25));
  if (O.qdInit) {
    _q19b.copy(qd).multiply(_q19c.copy(O.qdP).invert());
    if (_q19b.w < 0) { _q19b.x = -_q19b.x; _q19b.y = -_q19b.y; _q19b.z = -_q19b.z; _q19b.w = -_q19b.w; }
    const sn = Math.hypot(_q19b.x, _q19b.y, _q19b.z), ang = 2 * Math.atan2(sn, _q19b.w);
    _v19b.set(_q19b.x, _q19b.y, _q19b.z).multiplyScalar(sn > 1e-9 ? ang / sn / Math.max(dt, 1e-4) : 0);
    O.Wt.lerp(_v19b, 1 - Math.exp(-dt / 0.1));
  } else { O.Wt.set(0, 0, 0); O.qdInit = true; }
  O.qdP.copy(qd);
  {
    const kUr = D.lensUnder ? smoothstep(0.1, 0.5, tau) : 0, wr = lerp$4(4.5, 5, kU), cap = lerp$4(0.78, Math.max(0.52, 0.3 + 0.18 * (D.pace || 0)), kUr);
    const n = Math.max(1, Math.ceil(dt * 240)), h = dt / n;
    for (let i = 0; i < n; i++) {
      _q19b.copy(qd).multiply(_q19c.copy(O.Q).invert());
      if (_q19b.w < 0) { _q19b.x = -_q19b.x; _q19b.y = -_q19b.y; _q19b.z = -_q19b.z; _q19b.w = -_q19b.w; }
      const sn = Math.hypot(_q19b.x, _q19b.y, _q19b.z), ang = 2 * Math.atan2(sn, _q19b.w);
      const e = sn > 1e-9 ? _v19b.set(_q19b.x, _q19b.y, _q19b.z).multiplyScalar(ang / sn) : _v19b.set(0, 0, 0);
      O.W.addScaledVector(e, wr * wr * h).addScaledVector(_v19e.subVectors(O.Wt, O.W), 2 * (fall ? 1.0 : 0.9) * wr * h);
      softCap19(O.W, cap);
      const wl = O.W.length();
      if (wl > 1e-9) O.Q.premultiply(_q19c.setFromAxisAngle(_v19c.copy(O.W).divideScalar(wl), wl * h)).normalize();
    }
  }
  const pos = O.pos.copy(O.X), q = camera.quaternion;
  if (push) {
    if (O.qPlOk && dt > 0) {
      _q19b.copy(O.qPl).multiply(_q19c.copy(O.qPlP).invert());
      if (_q19b.w < 0) { _q19b.x = -_q19b.x; _q19b.y = -_q19b.y; _q19b.z = -_q19b.z; _q19b.w = -_q19b.w; }
      const sn = Math.hypot(_q19b.x, _q19b.y, _q19b.z), ang = 2 * Math.atan2(sn, _q19b.w);
      O.W.set(_q19b.x, _q19b.y, _q19b.z).multiplyScalar(sn > 1e-9 ? ang / sn / dt : 0);
    }
    O.qPlP.copy(O.qPl); O.qPlOk = true;
    O.Q.copy(O.qPl);
    q.copy(O.qPl);
  } else q.copy(O.Q);

  const live = 1 - wR2, liveU = 1 - 0.5 * wR2, trr = D.tr;
  _v19b.set(1, 0, 0).applyQuaternion(q);
  const rollT = clamp$9(-6e-3 * O.acc.dot(_v19b), -1 * DEG$3, 1 * DEG$3) * live * (1 - wR1);
  O.roll += (rollT - O.roll) * (1 - Math.exp(-rdt * 8));
  if (O.flT < 0.15) { O.flv += 427 * O.flK * Math.sin((Math.PI * O.flT) / 0.15) ** 2 * rdt; O.flT += rdt; }
  O.flv += (-18 * 18 * O.fl - 2 * 0.35 * 18 * O.flv) * rdt;
  O.fl += O.flv * rdt;
  const relC = pos.y - waveHeightDisp(pos.x, pos.z, t);
  const kw = smoothstep(0.05, -0.4, relC), ka = (1 - kw) * live * smoothstep(0, 0.6, trr), ku = kw * liveU;
  const s = Math.sin;
  const trem = s(trr * 19.2) * 0.6 + s(trr * 29.5 + 1.3) * 0.4;
  const nx = ka * (0.004 * s(trr * 3.77 + 1.1) + 0.0003 * s(trr * 23.9 + 0.4));
  const kNy = D.plan ? kPl * sm5((T - D.plan.t0) / 0.5) : 0;
  const ny = (ka * (0.006 * s(trr * 1.76 + 0.3) + 0.0003 * trem) - 0.004 * O.fl) * (1 - kNy);
  const nz = ku * 0.015 * s(trr * 1.26 + 0.8);
  const np = ka * ((0.17 * s(trr * 2.3 + 0.5) + 0.08 * s(trr * 5.65 + 2)) * DEG$3 + 0.05 * DEG$3 * trem) + ku * 0.5 * DEG$3 * s(trr * 1.45 + 1.7) - 0.17 * DEG$3 * O.fl;
  const ny2 = ka * (0.14 * s(trr * 1.9 + 2.4) + 0.06 * s(trr * 6.1 + 0.2)) * DEG$3;
  const nr = ka * (0.28 * s(trr * 2.0 + 0.9) + 0.12 * s(trr * 6.9 + 1.4)) * DEG$3 + ku * 1.2 * DEG$3 * s(trr * 1.07 + 0.2) + O.roll;
  _v19b.set(nx, ny, nz).applyQuaternion(q);
  camera.position.copy(pos).add(_v19b);
  q.multiply(_q19b.setFromEuler(_e19.set(np, ny2, nr, 'YXZ')));
  {
    const Lm = O.lim, under = D.lensUnder;
    if (!Lm.init) { Lm.p.copy(camera.position); Lm.pt.copy(camera.position); Lm.v.set(0, 0, 0); Lm.a.set(0, 0, 0); Lm.q.copy(q); Lm.init = true; }
    else if (push || dt <= 0) {
      const v2 = _v19b.subVectors(camera.position, Lm.p).divideScalar(Math.max(dt, 1e-4));
      Lm.a.subVectors(v2, Lm.v).divideScalar(Math.max(dt, 1e-4)); Lm.v.copy(v2);
      Lm.p.copy(camera.position); Lm.pt.copy(camera.position); Lm.q.copy(q);
    } else {
      const ku = under ? smoothstep(0, 0.3, tau) : 0;
      const eL = under ? Math.min(1, Math.max(0, camera.position.distanceTo(Lm.p) - 0.1)) : 0;
      const pc = D.pace || 0, aMax = under ? Math.max(lerp$4(1.9, 2.2, kDn), 1.8 + 0.45 * pc) + 1.5 * eL : 2.8, jMax = 35, vMax = under ? Math.max(lerp$4(1.85, 2.5, kDn), 0.5 + 1.2 * Math.max(pc, D.pv || 0) + 0.5 * (D.lag || 0)) : 3.6, wMax = lerp$4(44, Math.max(28, 16 + 10 * pc), ku) * DEG$3, wn = 25;
      const vt = _v19c.subVectors(camera.position, Lm.pt).divideScalar(dt);
      const aD = softSat19(_v19b.subVectors(camera.position, Lm.p).multiplyScalar(wn * wn), 4 + 3 * eL).addScaledVector(_v19f.subVectors(vt, Lm.v), 2 * wn);
      const vl = Lm.v.length();
      if (vl > 0.8 * vMax) aD.addScaledVector(Lm.v, (-12 * (vl - 0.8 * vMax)) / vl);
      const jm = jMax * dt;
      if (kPl > 0.01) {
        const ay = clamp$9(Lm.a.y + clamp$9(aD.y - Lm.a.y, -jm, jm), -aMax, aMax), aH = Math.sqrt(Math.max(0.25, aMax * aMax - ay * ay));
        _v19f.set(aD.x - Lm.a.x, 0, aD.z - Lm.a.z);
        const jl = _v19f.length(), jh = Math.sqrt(Math.max(0, jm * jm - (ay - Lm.a.y) ** 2));
        if (jl > jh) { aD.x = Lm.a.x + (_v19f.x * jh) / jl; aD.z = Lm.a.z + (_v19f.z * jh) / jl; }
        const hl = Math.hypot(aD.x, aD.z);
        if (hl > aH) { aD.x *= aH / hl; aD.z *= aH / hl; }
        aD.y = ay;
      } else {
        _v19f.subVectors(aD, Lm.a);
        const jl = _v19f.length();
        if (jl > jm) aD.copy(Lm.a).addScaledVector(_v19f, jm / jl);
        if (aD.length() > aMax) aD.setLength(aMax);
      }
      Lm.a.copy(aD);
      Lm.v.addScaledVector(aD, dt);
      Lm.p.addScaledVector(Lm.v, dt);
      Lm.pt.copy(camera.position);
      camera.position.copy(Lm.p);
      _q19b.copy(q).multiply(_q19c.copy(Lm.q).invert());
      if (_q19b.w < 0) { _q19b.x = -_q19b.x; _q19b.y = -_q19b.y; _q19b.z = -_q19b.z; _q19b.w = -_q19b.w; }
      const ang = 2 * Math.atan2(Math.hypot(_q19b.x, _q19b.y, _q19b.z), _q19b.w), wm = wMax * dt;
      if (ang > wm) Lm.q.slerp(q, wm / ang); else Lm.q.copy(q);
      q.copy(Lm.q);
    }
  }
  if (kPl > 0 && D.plan) {
    const H2 = hPlan19(T, D.plan, D.tDn), cx2 = push ? O.E.x : camera.position.x, cz2 = push ? O.E.z : camera.position.z;
    const wyC = waveHeightDisp(cx2, cz2, t), wyCV = (waveHeightDisp(cx2, cz2, t + 0.02) - waveHeightDisp(cx2, cz2, t - 0.02)) / 0.04;
    camera.position.y = lerp$4(camera.position.y, wyC + H2.h, kNy);
    if (O.lim.init) { O.lim.p.y = camera.position.y; O.lim.v.y = lerp$4(O.lim.v.y, wyCV + H2.v, kNy); }
  }
  const wy = waveHeightDisp(camera.position.x, camera.position.z, t);
  if (!D.lensGo) { const d = camera.position.y - wy - 0.03; if (d < 0.4) camera.position.y = wy + 0.03 + 0.05 * Math.log1p(Math.exp(d / 0.05)); }
  if (D.lensGo && !D.lensUnder && !push && T < (D.tDn || Infinity) + 0.05 && camera.position.y < wy + 0.004) camera.position.y = wy + 0.004;
  if (D.lensUnder && camera.position.y > wy) camera.position.y = wy;
  O.Vout.subVectors(camera.position, O.posP).divideScalar(Math.max(dt, 1e-4));
  O.posP.copy(camera.position);
  G.lensAdd = lens;
  snapFov(lens);
  const fd = camera.position.distanceTo(O.H);
  O.fdV = O.fdP === undefined ? 0 : lerp$4(O.fdV, (fd - O.fdP) / Math.max(dt, 1e-4), 1 - Math.exp(-dt / 0.05));
  O.fdP = fd;
  const kI = smoothstep(0, APIN19, T);
  const kE = D.tB1 !== null && D.tB1 !== undefined ? smoothstep(D.tB1, D.tB1 + 0.9, T) : 0, kX = tau !== null ? smoothstep(0.5, 2.0, tau) : 0;
  const ap = lerp$4(lerp$4(lerp$4(TITLE_AP19, AP_PUSH19, kI), AP_ENTRY19, kE), 0.05, kX);
  post.setDof(Math.max(0.3, fd + clamp$9(O.fdV, -4, 4) * 0.2), ap * live, dt);
  const kS = kE * (1 - kX);
  post.setDofShape(lerp$4(16, 7, kS), lerp$4(1, 1.5, kS), lerp$4(16, 10, kS));
  if (life$1 && life$1.setLensFrame) life$1.setLensFrame(O.X, O.Q, camera.fov, camera.aspect);
}
function aimQ19(q, pos, aim, cx, cy) {
  lookInto(q, pos, aim);
  const vt = Math.tan((camera.fov * DEG$3) / 2);
  q.premultiply(_q19b.setFromAxisAngle(_Y19, Math.atan((2 * cx - 1) * camera.aspect * vt)));
  q.multiply(_q19b.setFromAxisAngle(_X19, -Math.atan((2 * cy - 1) * vt)));
  return q;
}

function standOff19(X) {
  const R = diver$1.tether && diver$1.tether.hose, P = R && R.points;
  if (!P || !(R.length > 0.3)) return;
  let s = 0, ax = 0, az = 0;
  const reach = 0.9;
  for (let i = 0; i < P.length; i += 3) {
    const dx = X.x - P[i], dy = X.y - P[i + 1], dz = X.z - P[i + 2], d = Math.hypot(dx, dy, dz);
    if (d >= reach) continue;
    const h = Math.hypot(dx, dz), kk = 1 - d / reach;
    if (h > 1e-4) { ax += (dx / h) * kk * kk; az += (dz / h) * kk * kk; }
    const sk = reach * kk * kk * (3 - 2 * kk);
    if (sk > s) s = sk;
  }
  const al = Math.hypot(ax, az);
  if (s <= 0 || al < 1e-6) return;
  X.x += (ax / al) * s;
  X.z += (az / al) * s;
}

function avoid19(O, D, t, a) {
  const X = O.X, V = O.V;
  const sp = fx.splash;
  if (sp && sp.on && sp.t < 1.1 && !D.lensUnder) {
    const wy = waveHeightDisp(X.x, X.z, t);
    if (X.y > wy - 0.05 && X.y < wy + 1.3) {
      const R = sp.R0 + (sp.VR * 1.1 * sp.t) / (1 + 1.1 * sp.t) + 0.9;
      const dx = X.x - sp.c.x, dz = X.z - sp.c.z, d = Math.hypot(dx, dz);
      if (d < R && d > 1e-4) { const k = 20 * (R - d) - 4 * Math.min(0, (V.x * dx + V.z * dz) / d); a.x += (dx / d) * k; a.z += (dz / d) * k; }
    }
  }
  const tt = diver$1.tether;
  if (tt) {
    const psi = Math.atan2(X.x - O.H.x, X.z - O.H.z), rx = Math.cos(psi), rz = -Math.sin(psi);
    let mMax = 0, sgn = 1;
    const R = tt.hose, P = R && R.points;
    if (P && R.length > 0.3) {
      for (let i = 0; i < P.length; i += 3) {
        const dx = X.x - P[i], dy = X.y - P[i + 1], dz = X.z - P[i + 2], d2 = dx * dx + dy * dy + dz * dz;
        if (d2 < 0.36) { const m = (1 - Math.sqrt(d2) / 0.6) ** 2; if (m > mMax) { mMax = m; sgn = dx * rx + dz * rz >= 0 ? 1 : -1; } }
      }
    }
    if (mMax > 0) { const vn = (V.x * rx + V.z * rz) * sgn, k = 25 * mMax - 5 * Math.min(0, vn) * Math.sqrt(mMax); a.x += rx * sgn * k; a.z += rz * sgn * k; }
  }
}
function guards19(O, D, t, wR1, h) {
  const X = O.X, V = O.V;
  const wy = waveHeightDisp(X.x, X.z, t);
  if (!D.lensGo && X.y < wy + 0.045) { X.y = wy + 0.045; if (V.y < 0) V.y = 0; }
  if (D.lensUnder) {
    if (X.y > wy) { X.y = wy; if (V.y > 0) V.y = 0; }
  }
  if (D.phase === 'fall' && wR1 < 0.5) {
    const dx = X.x - O.H.x, dy = X.y - O.H.y, dz = X.z - O.H.z, d = Math.hypot(dx, dy, dz), rM = D.A && D.A.TE !== undefined ? Math.max(3.6, arcR19(D.A, G.st) + 0.6) : 3.6;
    if (d > rM) {
      X.set(O.H.x + (dx * rM) / d, O.H.y + (dy * rM) / d, O.H.z + (dz * rM) / d);
      const vn = (V.x * dx + V.y * dy + V.z * dz) / d;
      if (vn > 0) V.addScaledVector(_v19c.set(dx, dy, dz), -vn / d);
    }
  }
  const tt = diver$1.tether;
  if (tt) {
    const psi = Math.atan2(X.x - O.H.x, X.z - O.H.z);
    const rx = Math.cos(psi), rz = -Math.sin(psi);
    let mMax = 0, sgn = 1;
    const R = tt.hose, P = R && R.points;
    if (P && R.length > 0.3) {
      for (let i = 0; i < P.length; i += 3) {
        const dx = X.x - P[i], dy = X.y - P[i + 1], dz = X.z - P[i + 2];
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 < 0.0225) { const m = 0.15 - Math.sqrt(d2); if (m > mMax) { mMax = m; sgn = dx * rx + dz * rz >= 0 ? 1 : -1; } }
      }
    }
    if (mMax > 0) {
      const push = mMax * (1 - Math.exp(-h / 0.05));
      X.x += rx * sgn * push; X.z += rz * sgn * push;
      const vn = (V.x * rx + V.z * rz) * sgn;
      if (vn < 0) { V.x -= rx * sgn * vn; V.z -= rz * sgn * vn; }
    }
  }
  const fh = floorHeight(X.x, X.z) + 1.0;
  if (X.y < fh) { X.y = fh; if (V.y < 0) V.y = 0; }
}

const PX19 = { hR: 1, hL: 1, shuf: 0, roll: 0, capOut: 0, lineK: 0, lineHand: 'right', dive: DIVE19, effort: 0, load: 0 };
function updateDive19(dt, t) {
  const D = G.dive, T = G.st, rdt = G.rdt || dt;
  D.tr += rdt;
  if (D.tau !== null) D.tau += rdt;
  OP19.qPrev.copy(camera.quaternion);
  const S = station19();
  if (D.phase === 'perch') {
    D.TL;
    if (!D.shP) { D.shP = [new V3(), new V3(), new V3(), new V3()]; D.shT = [0, 0, 0, 0]; D.shN = 0; D.shI = 0; D.seatV = new V3(); }
    D.shI = (D.shI + 1) % 4;
    D.shP[D.shI].copy(S.seat); D.shT[D.shI] = T; D.shN = Math.min(4, D.shN + 1);
    if (D.shN >= 2) { const j = (D.shI + 4 - Math.min(3, D.shN - 1)) % 4; D.seatV.subVectors(D.shP[D.shI], D.shP[j]).divideScalar(Math.max(1e-4, T - D.shT[j])); }
    if (!D.held) { D.held = true; if (diver$1.breathe) diver$1.breathe('hold'); }
    const J = JUMP19, Gt = D.Tr - D.jT0;
    const tSh = D.jT0, tLe = tSh + J.shuf * Gt, tLo = tLe + J.lean * Gt, tPr = Math.min(tLo + J.load * Gt, D.Tr - 0.4);
    if (D.tB1 === null && T >= tLe) {
      if (G.compiled) { D.tB1 = T; D.tLean = tLo - tLe; audio$1.gather?.(D.Tr - T); }
      else {
        D.jT0 += dt; D.Tr += dt;
        D.hold = (D.hold || 0) + dt;
        if (D.hold > 0.5) guide.once('air', 'Checking your air. One moment.', 2600);
        if (T - (D.tugAt || 0) > 2.5) { D.tugAt = T; if (diver$1.tug) diver$1.tug(1); }
      }
    }
    const b = D.tB1;
    if (b !== null && D.tP === null && T >= tPr - 1e-6) { D.tP = T; D.pressDur = D.Tr - T; }
    const u = D.tP !== null ? cl01((T - D.tP) / D.pressDur) : 0;
    const uS = sm5((T - tSh) / (tLo - tSh)), uLe = b !== null ? smoothstep(0, 1, (T - b) / (tLo - tLe)) : 0, uLo = b !== null ? sm5((T - tLo) / (tPr - tLo)) : 0;
    const tugOff = D.tugAt !== undefined && T - D.tugAt < 1.25 ? 1 - smoothstep(1.0, 1.25, T - D.tugAt) : 0;
    PX19.hR = 1;
    PX19.hL = 1 - tugOff;
    PX19.shuf = 0.07 * uS;
    PX19.roll = 2.5 * Math.sin(Math.PI * cl01((T - tSh) / (tLo - tSh)));
    PX19.capOut = uS;
    PX19.lineK = 0;
    PX19.lineHand = null;
    PX19.load = D.tP !== null ? uLo * (1 - sm5((T - D.tP) / 0.25)) : uLo;
    PX19.effort = 0.2 + 0.3 * uS + 0.3 * uLe;
    DIVE19.perch = true;
    DIVE19.bow = lerp$4(34 * uLe - 4 * uLo, 8, u * u * (3 - 2 * u));
    const dip = lerp$4(lerp$4(0.12, 0.72, uLe), 0.45, u);
    if (surface.boat.dive) surface.diverLoad = 1 + 0.2 * uLo + 0.35 * u;
    perchDiver(dt, t, u, dip, 0, 1, u, PX19);
    if (!D.tiltSeat) { D.tiltSeat = true; diver$1.anchors.helmet.getWorldPosition(D.Hseat); arcTilt19(D, t - T); }
    if (b !== null && D.tP !== null && T >= D.Tr - 1e-6) release19(D, S, t);
  } else fall19Frame(D, S, dt, t);
  if (!D.lensGo && D.tB1 !== null && D.tB1 !== undefined && T >= D.tB1 + 0.5) { D.lensGo = true; D.tGo = T; }
  op19(dt, t, rdt);
  if (D.phase === 'fall' && life$1 && life$1.setDiver) life$1.setDiver(OP19.H, _fv.vel, diver$1.tether && diver$1.tether.hose ? diver$1.tether.hose.points : null);
  const rel = camera.position.y - waveHeightDisp(camera.position.x, camera.position.z, t);
  if (!D.lensUnder && D.phase === 'fall' && D.lensGo && rel <= 0 && T >= (D.tDn || 0) - 0.05) {
    D.lensUnder = true;
    D.tau = 0;
    D.tLens = T;
    if (D.A) {
      D.A.tLens = T;
      const hx = camera.position.x - OP19.H.x, hy = camera.position.y - OP19.H.y, hz = camera.position.z - OP19.H.z;
      D.A.e0 = Math.asin(clamp$9(hy / Math.max(0.3, Math.hypot(hx, hy, hz)), -1, 1));
      planDolphins19(D, T);
    }
    if (fx.setHull) fx.setHull(null);
    audio$1.setMode('underwater');
    const gu = post.gradeMat && post.gradeMat.uniforms;
    if (gu && gu.uPlungeK) gu.uPlungeK.value = 0.3;
    else D.plK = true;
  }
  if (D.plK && D.tau !== null && D.tau < 0.9 - PL0_19 && post._plT !== undefined) post._plT = PL0_19 + D.tau;
  if (WATER.uLensR) WATER.uLensR.value = D.lensUnder && rel < -0.6 ? 0.2 : LENS_DIVE19;
  if (post.gradeMat && post.gradeMat.uniforms.uChurn) post.gradeMat.uniforms.uChurn.value = !D.lensUnder || D.tau < 0.7 ? 1 : 0;
  {
    const gu = post.gradeMat && post.gradeMat.uniforms, L = G.lensSpray;
    if (gu && gu.uSpray) {
      if (L && L.n !== D.sprN) {
        D.sprN = L.n;
        if (L.k > 0.02 && !D.lensUnder) {
          const tX = D.phase === 'fall' && D.Thu ? D.Thu + 0.08 - 0.1 : Infinity, t0 = Math.max(L.t + 0.12, Math.min(L.t + L.eta, tX));
          if (!D.spray) D.spray = { t0, k: 0, x: clamp$9(L.x, -1, 1), y: clamp$9(L.y, -1, 1) };
          D.spray.t0 = Math.min(D.spray.t0, t0); D.spray.k = Math.max(D.spray.k, clamp$9(L.k, 0, 1));
        }
      }
      const S1 = D.spray;
      gu.uSpray.value.set(S1 && T >= S1.t0 && !(D.lensUnder && D.tau > 0.25) ? T - S1.t0 : -1, S1 ? S1.k : 0, S1 ? S1.x : 0, S1 ? S1.y : 0);
    }
  }
  if (D.lensUnder) {
    D.skyK = Math.max(D.skyK, smoothstep(0.5, 10, -rel));
    sunDir.copy(SUN_GOLD).lerp(SUN_TITLE, D.skyK).normalize();
  }
  if (D.dol && D.dol.on && !D.dol.called && T >= D.dol.t0) { D.dol.called = true; if (audio$1.dolphins) audio$1.dolphins(-D.dol.side); }
  if (!D.reprobed && D.phase === 'fall' && D.Tland && T >= D.Tland - 3.0) {
    D.reprobed = true;
    { const P = predict19(D, waveHeightDisp(D.px, D.pz, t)); D.pLand.set(D.x0 + P.hxT + D.Dres.x, D.landY, D.z0 + P.hzT + D.Dres.z); }
    D.psiL = D.psi;
    D.hOff = OP19.H.y - diver$1.group.position.y;
    const r = probeRest19(D.pLand, D.psi + (D.restSg || 1) * 30 * DEG$3);
    D.rest.pos.copy(r.pos); D.rest.q.copy(r.q); D.rest.fov = r.fov; D.restPsi = D.psi;
    if (D.A && D.A.TE !== undefined) arcReprobe19(D, T);
  }
  if (D.contact) {
    D.hStill = OP19.vH.length() < 0.05 ? (D.hStill || 0) + dt : 0;
    const k = player.keys, go = k.KeyW || k.KeyA || k.KeyS || k.KeyD || k.ArrowUp || k.ArrowDown || k.ArrowLeft || k.ArrowRight || k.Space || !!(player.stick && player.stick.on);
    if ((T >= D.tTouch + 0.7 && D.hStill >= 0.15 && OP19.Vout.length() <= 0.35) || T >= D.tTouch + 1.0 || (T >= D.tTouch + 0.4 && go)) setState('explore');
  }
}

const _cur = new V3();
function currentAt(x, y, z) {
  const s = U.uSurge.value;
  const drop = smoothstep(20, 36, x);
  return _cur.set(s.x * 0.7 + drop * 0.9, 0, s.z * 0.7 + drop * 0.12);
}

function sonarPing(repeat = false) {
  if (G.state !== 'explore') return;
  if (G.sonarCD > 0) {
    if (!repeat) {
      UI.sonarDenied();
      if (audio$1.sonarNotReady) audio$1.sonarNotReady(); else if (audio$1.tick) audio$1.tick(0);
    }
    return;
  }
  G.sonarCD = 7;
  G.sonarT = 8;
  G.sonarUsed = true;
  G.ping = 1;
  G.rapAt = U.uTime.value;
  audio$1.sonar();
  fragments.ping(player.pos, sonar.speed);
  sonar.start(player.pos);
  const near = fragments.nearestUncollected(player.pos);
  guide.event('sonar', {
    echo: fragments.items.some((it) => it.state === 'buried'),
    dist: near ? near.dist : Infinity, delay: near ? near.dist / sonar.speed : 0,
  });
  UI.dismissFact(Math.max(1500, UI.factReadMs()));
}

const _awSpot = new V3();
function startClean(it) {
  if (!it || fragments.busy()) return;
  const dx = it.home.x - player.pos.x, dz = it.home.z - player.pos.z, d = Math.hypot(dx, dz);
  if (G.state === 'explore' && d > CLEAN_RANGE && player.autoWalk) {
    if (player.auto && player.auto.item === it) return;
    _awSpot.set(it.home.x - (dx / d) * 0.95, 0, it.home.z - (dz / d) * 0.95);
    player.autoWalk(_awSpot, () => { G.arriveClean = it; }, it.home);
    if (player.auto) player.auto.item = it;
    return;
  }
  G.cleanItem = it;
  setState('clean');
}

const WALK_IN = 6;
const _center = new THREE.Vector2(0, 0);
function pickFragment() {
  raycaster.setFromCamera(document.pointerLockElement ? _center : ptr.ndc, camera);
  return fragments.pickRay(raycaster.ray, camera.position.distanceTo(player.pos) + WALK_IN);
}
const _ahP = new V3();
function aheadFind() {
  let best = null, bd = WALK_IN;
  for (const it of fragments.items) {
    if (it.state !== 'buried') continue;
    const dx = it.home.x - player.pos.x, dz = it.home.z - player.pos.z, d = Math.hypot(dx, dz);
    if (d >= bd || dx * _camFwd.x + dz * _camFwd.z < 0) continue;
    _ahP.copy(it.home).project(camera);
    if (_ahP.z >= 1 || Math.abs(_ahP.x) > 0.9 || Math.abs(_ahP.y) > 0.9) continue;
    bd = d; best = it;
  }
  return best;
}
const _camFwd = new V3();
function findAhead() {
  if (!(FRAME.tall > 0)) return 0;
  const P = player, fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw);
  let best = 0;
  for (const it of fragments.items) {
    if (it.state !== 'buried') continue;
    const dx = it.home.x - P.pos.x, dz = it.home.z - P.pos.z, d = Math.hypot(dx, dz);
    if (d < 0.5 || d > 7) continue;
    best = Math.max(best, smoothstep(0.82, 0.92, (dx * fx + dz * fz) / d) * (1 - smoothstep(6, 7, d)));
  }
  return best;
}
function cleanTarget() {
  _camFwd.set(0, 0, -1).applyQuaternion(camera.quaternion);
  return fragments.cleanable(player.pos, CLEAN_RANGE, camera.position, _camFwd) || pickFragment() || aheadFind();
}
let _moveEnv = null;
function moveEnv() {
  if (!_moveEnv) _moveEnv = { floor: groundAt, ceiling: -1.4, obstacles, capsules: playerCaps.length ? playerCaps : capsules || [], support: player.support, ground: groundMeshes() };
  return _moveEnv;
}
let _grounds = null;
function groundMeshes() {
  if (!_grounds) { const m = scene.getObjectByName('wreck-sediment'); _grounds = m ? [m] : []; }
  return _grounds;
}
const _koBuf = new Float32Array(7 * 24);
const HOSE_KEEP = { explore: 1, clean: 1, assemble: 1, crank: 1 };
function koCap(n, ax, ay, az, bx, by, bz, r) {
  const o = n * 7;
  if (o + 7 > _koBuf.length) return n;
  _koBuf[o] = ax; _koBuf[o + 1] = ay; _koBuf[o + 2] = az; _koBuf[o + 3] = bx; _koBuf[o + 4] = by; _koBuf[o + 5] = bz; _koBuf[o + 6] = r;
  return n + 1;
}
const _pEnv = { floor: groundAt, ceiling: -1.4, obstacles: null, capsules: null, radius: 68, current: null, stepPhase: NaN, finPhase: 0, tether: { anchor: null, maxLen: 44.5 }, bag: 0, findNear: 0, pull: null, ground: null, ropes: null, planted: true };
let _ropes = null;
function diverRopes() {
  if (!_ropes && diver$1 && diver$1.tether && diver$1.tether.hose) _ropes = [diver$1.tether.hose.points];
  return _ropes;
}
const _pull = new V3();
function pullToBoat(a) {
  _pull.set(_tHose.x - player.pos.x, 0, _tHose.z - player.pos.z);
  const l = _pull.length();
  return l > 1e-3 ? _pull.multiplyScalar(a / l) : null;
}
const _tnP = new V3();
function tenderPull(secs) {
  const L = diver$1 && diver$1.tether && diver$1.tether.hose;
  if (!L || !L.points || !diver$1.notice) return;
  const P = L.points, i = Math.min(P.length / 3 - 1, 48) * 3;
  diver$1.notice(_tnP.set(P[i], P[i + 1], P[i + 2]), secs);
}
function lineSignals(dt) {
  const now = U.uTime.value;
  if (G.tRamp && diver$1 && diver$1.setTetherLength) {
    const R = G.tRamp;
    R.h = Math.max(44.5, R.h - 0.4 * dt);
    diver$1.setTetherLength(R.h);
    if (R.h <= 44.5) G.tRamp = null;
  }
  if (!diver$1 || !diver$1.tug) return;
  const L = diver$1.tether && diver$1.tether.hose, taken = !L || !(L.tension < 0.2) || G.st > 6;
  if (!G.lineSaid && !G.tRamp && taken && player.grounded && player.landT > 1.5 && player.vel.length() < 0.1 && G.st > 1.5) {
    G.lineSaid = 1;
    diver$1.tug(1);
    G.tenderAt = now + 1.5;
  }
  if (G.tenderAt && now >= G.tenderAt) { G.tenderAt = 0; tenderPull(1.3); }
  if (G.airOn && G.air < 30 && (G.lineSaid || 0) < 2) {
    G.lineSaid = 2;
    tenderPull(2.2);
    G.tugBackAt = now + 2.45;
  }
  if (G.tugBackAt && now >= G.tugBackAt) { G.tugBackAt = 0; diver$1.tug(4); }
}
const _pev = new V3(), _pevc = [0, 0, 0], _pevq = new V3();
function playerEvents() {
  if (G.wallHintOff && U.uTime.value > G.wallHintOff) { G.wallHintOff = 0; if (!G.cleanHint) UI.hint(''); }
  const evs = player.takeEvents ? player.takeEvents() : null;
  if (!evs || !evs.length) return;
  for (const e of evs) {
    if (e.type === 'dump' && diver$1 && diver$1.anchors && diver$1.anchors.exhaust) {
      diver$1.anchors.exhaust.getWorldPosition(_pev);
      if (_pev.y < waveHeight(_pev.x, _pev.z, U.uTime.value) - 0.1) {
        fx.bubbleColumn(_pev.x, _pev.y, _pev.z, e.n || 30);
        if (fx.exhaleFrom) fx.exhaleFrom(_pev.clone(), 2);
      }
    } else if ((e.type === 'bound' || (e.type === 'land' && e.v > 1.2)) && diver$1 && diver$1.anchors) {
      const k = e.type === 'bound' ? 0.8 : 1, cur = player.drift || _zero3, fewer = 1 / (1 + 2.5 * Math.hypot(cur.x, cur.z));
      for (const f of ['rightFoot', 'leftFoot']) {
        const a = diver$1.anchors[f];
        if (!a) continue;
        a.getWorldPosition(_pev);
        const S = player.support(_pev.x, _pev.z), kind = player.supportKind || 0;
        if (_pev.y - S > 0.4) continue;
        _pev.y = S + 0.02;
        if (kind === 1 || kind === 3) { fx.grains(_pev, 5, { spread: 0.1, up: 0.1, ground: S }); continue; }
        sandAlbedo(_pev.x, _pev.z, 0.2, _pevc);
        const n = Math.max(1, Math.round(3 * fewer));
        for (let i = 0; i < 4; i++) {
          const ang = (i + Math.random()) * (Math.PI / 2);
          _pevq.set(Math.cos(ang) * 0.22 * k + cur.x * 0.6, 0, Math.sin(ang) * 0.22 * k + cur.z * 0.6);
          fx.silt(_pev, n, { spread: 0.14, color: _pevc, up: 0.05 + 0.04 * k, life: 2.2, size: 0.05, push: _pevq, ground: S });
        }
        fx.grains(_pev, 6, { spread: 0.12, up: 0.12, push: _pevq, ground: S });
      }
    } else if (e.type === 'wall') {
      if (!G.cleanHint) { UI.hint(touch.mode ? COPY.wallTouch : 'Hold [Space] to float up over it'); G.wallHintOff = U.uTime.value + 4.5; }
    } else if (e.type === 'brink') UI.story('Too deep. Keep to the wreck.', { ms: 3600, keep: true });
    else if (e.type === 'tether') UI.story('The air hose reaches no farther.', { ms: 3600, keep: true });
    else if (e.type === 'blowup') UI.story('Too much air in the suit.', { ms: 3000, keep: true });
    else if (e.type === 'knock') G.knockAt = U.uTime.value;
  }
}
const _tcP = new V3(), _tcQ = new THREE.Quaternion(), _tcV = new V3(), _tcW = new V3(), _tcD = new THREE.Quaternion();
let _tcSt = -1;
function camMotion(dt) {
  if (_tcSt >= 0 && G.st > _tcSt && dt > 0) {
    _tcV.subVectors(camera.position, _tcP).divideScalar(dt);
    _tcD.copy(_tcQ).invert().premultiply(camera.quaternion);
    if (_tcD.w < 0) _tcD.set(-_tcD.x, -_tcD.y, -_tcD.z, -_tcD.w);
    const s = Math.sqrt(Math.max(0, 1 - _tcD.w * _tcD.w)), a = 2 * Math.atan2(s, _tcD.w);
    if (s > 1e-7) _tcW.set(_tcD.x / s, _tcD.y / s, _tcD.z / s).multiplyScalar(a / dt); else _tcW.set(0, 0, 0);
  } else { _tcV.set(0, 0, 0); _tcW.set(0, 0, 0); }
  _tcP.copy(camera.position);
  _tcQ.copy(camera.quaternion);
  _tcSt = G.st;
}
const _fbH = new V3(), _fbF = new V3(), _fbR = new V3();
function findBias(dt) {
  if (G.blendT > 0) { G.fb = 0; G.fbV = 0; return; }
  let want = 0;
  const it = player.auto || G.arriveClean ? null : fragments.cleanable(player.pos, 3.5);
  if (it && diver$1 && diver$1.anchors && diver$1.anchors.head) {
    camera.updateMatrixWorld();
    diver$1.anchors.head.getWorldPosition(_fbH).project(camera);
    _fbF.copy(it.home).project(camera);
    if (_fbF.z < 1 && _fbH.z < 1) {
      const dx = (_fbF.x - _fbH.x) * camera.aspect, dy = _fbF.y - _fbH.y;
      want = (1 - smoothstep(0.1, 0.3, Math.hypot(dx, dy))) * 0.5 * (dx >= 0 ? 1 : -1);
    }
  }
  const fw = 3.2, ff = 1 + 2 * dt * fw, fh = dt * fw * fw, fd = 1 / (ff + dt * fh), f0 = G.fb || 0, fv = G.fbV || 0;
  G.fb = (ff * f0 + dt * fv + dt * fh * want) * fd;
  G.fbV = (fv + fh * (want - f0)) * fd;
  if (Math.abs(G.fb) < 0.002) return;
  _fbR.set(G.fb > 0 ? 1 : -1, 0, 0).applyQuaternion(camera.quaternion);
  const room = player._cast(camera.position, _fbR, Math.abs(G.fb), moveEnv(), 0.3, 0.3, 0);
  camera.position.addScaledVector(_fbR, Math.min(Math.abs(G.fb), room));
}

new V3(); const _arcT = new V3(), _arcF = new V3(), _arcUp = new V3(0, 1, 0), _arcM = new THREE.Matrix4(), _arcA = new V3(), _arcB = new V3(), _arcS = new V3();
const _rtLeft = [], _rtPerm2 = [[0, 1], [1, 0]], _rtPerm3 = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];
const _rtD = (a, b) => Math.hypot(a.x - b.x, a.z - b.z), _rtS = new V3();
function routeTarget(pos) {
  const near = fragments.nearestUncollected(pos);
  if (!near || !G.mech) return near;
  if (near.dist < 6) { G.rtItem = near.item; return near; }
  _rtLeft.length = 0;
  for (const it of fragments.items) if (it.state === 'buried') _rtLeft.push(it);
  if (_rtLeft.length < 2 || _rtLeft.length > 3) { G.rtItem = near.item; return near; }
  const M = surfacePoint(_rtS), perms = _rtLeft.length === 2 ? _rtPerm2 : _rtPerm3;
  let best = null, bc = Infinity, cur = Infinity;
  for (const pm of perms) {
    let c = _rtD(pos, _rtLeft[pm[0]].home);
    for (let k = 1; k < pm.length; k++) c += _rtD(_rtLeft[pm[k - 1]].home, _rtLeft[pm[k]].home);
    c += _rtD(_rtLeft[pm[pm.length - 1]].home, M);
    if (c < bc) { bc = c; best = _rtLeft[pm[0]]; }
    if (_rtLeft[pm[0]] === G.rtItem && c < cur) cur = c;
  }
  if (G.rtItem && G.rtItem.state === 'buried' && cur < bc + 2) best = G.rtItem;
  G.rtItem = best;
  return { item: best, dist: best.home.distanceTo(pos) };
}
const _hoN = new V3();
function updateExplore(dt, t) {
  const target = routeTarget(player.pos);
  const atPile = G.found === 3 && G.site && G.site.placed;
  const goal = target ? target.item.home : atPile ? G.site.tgt.item.home : null;
  if (player.keys.KeyF && goal) {
    const h = goal;
    const dx = h.x - player.pos.x, dz = h.z - player.pos.z;
    const ty = Math.atan2(-dx, -dz), tp = clamp$9(Math.atan2(h.y - player.pos.y, Math.hypot(dx, dz)) + 0.14, -0.9, 0.5);
    const k = 1 - Math.exp(-dt * 5);
    player.yaw += Math.atan2(Math.sin(ty - player.yaw), Math.cos(ty - player.yaw)) * k;
    player.pitch += (tp - player.pitch) * k;
  }
  G.inspecting = false;
  player.inspect = 0;
  if (G.hoDip0 > 0 && diver$1 && diver$1.setLandDip) {
    G.hoDipT += dt;
    const k = sm5(G.hoDipT / 1.6);
    diver$1.setLandDip(G.hoDip0 * (1 - k));
    if (k >= 1) G.hoDip0 = 0;
  }
  if (G.hoDive && !G.hoOff && G.blendT === G.blendDur && player.adoptLens) {
    const gv = G.glide && G.glide.v;
    G.glide = null;
    player.adoptLens(camera, diver$1 && diver$1.group, { glideV: gv, landing: !!(diver$1 && diver$1.pose === 'land') });
    const Th = diver$1 && diver$1.tether;
    G.tRamp = Th && Th.hose ? { h: Math.max(44.5, Th.hose.length || 0) } : null;
    if (!G.tRamp && diver$1 && diver$1.setTetherLength) diver$1.setTetherLength(44.5);
    G.lineSaid = 0; G.tenderAt = 0; G.tugBackAt = 0;
  }
  if (G.glide) {
    G.glide.t += dt * (player.keys.KeyW || player.keys.KeyS || player.keys.KeyA || player.keys.KeyD ? 4 : 1);
    if (G.glide.t > 6) G.glide = null;
  }
  lineSignals(dt);
  const PE = _pEnv;
  PE.obstacles = obstacles;
  PE.capsules = playerCaps.length ? playerCaps : capsules;
  PE.current = G.glide && !player.adoptLens ? glideCurrent : currentAt;
  PE.stepPhase = diver$1 && Number.isFinite(diver$1.stepPhase) ? diver$1.stepPhase : NaN;
  PE.finPhase = diver$1 && diver$1.finPhase;
  PE.tether.anchor = _tHose;
  PE.bag = fragments.collected / 3;
  PE.findNear = fragments.cleanable(player.pos, 3) ? 1 : 0;
  PE.findAhead = findAhead();
  PE.pull = G.airOn && G.air < 10 ? pullToBoat(0.4) : null;
  PE.ground = groundMeshes();
  PE.ropes = diverRopes();
  PE.planted = !diver$1 || !diver$1.footing || (Math.abs(diver$1.footing.gap) < 0.03 && ((diver$1.stepPhase % 0.5) + 0.5) % 0.5 < 0.13);
  if (player.auto && player.auto.click) { if (ptr.down) player.holding = player.pressing = false; else player.auto.click = false; }
  player.update(dt, t, PE);
  playerEvents();
  easeFov(player.cam.fov, dt);
  let blendK = 1;
  if (G.blendT > 0) {
    const w = G.blendArc ? lerp$4(0.4, 2.0, smoothstep(0, 0.6, G.hoArcT || 0)) : 2.0, wr = 3.2;
    if (!G.hoOff) {
      G.hoOff = new V3().copy(G.cine.pos).addScaledVector(G.cine.v || _zero3, dt).sub(camera.position);
      G.hoOffV = G.cine.v ? G.cine.v.clone().sub(G.cine.ref || player.vel) : new V3();
      G.hoW = 1;
      G.hoWV = 0;
      if (G.hoPath) G.hoP = new V3().copy(G.cine.pos).addScaledVector(G.cine.v || _zero3, dt);
    } else if (G.hoPath && G.hoP && (G.hoT || 0) < 0.35) {
      G.hoP.addScaledVector(G.cine.v || _zero3, dt * Math.exp(-(G.hoT || 0) / 0.14));
      _hoN.copy(G.hoP).sub(camera.position);
      G.hoOffV.copy(_hoN).sub(G.hoOff).divideScalar(Math.max(dt, 1e-4));
      G.hoOff.copy(_hoN);
    } else {
      G.hoOffV.addScaledVector(G.hoOff, -w * w * dt).multiplyScalar(Math.max(0, 1 - 2 * w * dt));
      G.hoOff.addScaledVector(G.hoOffV, dt);
    }
    camera.position.add(G.hoOff);
    if (G.blendArc) {
      G.hoArc0 = Math.max(G.hoArc0 || 0.01, G.hoOff.length());
      const s = Math.sin(Math.PI * clamp$9(1 - G.hoOff.length() / G.hoArc0, 0, 1));
      if (!G.hoArcDir) {
        const px = G.hoOff.z, pz = -G.hoOff.x, pl = Math.hypot(px, pz);
        G.hoArcDir = pl > 1e-4 ? new V3(px / pl, 0, pz / pl) : new V3(1, 0, 0);
        _arcS.set(camera.position.x - 0.5 * G.hoOff.x - player.pos.x, 0, camera.position.z - 0.5 * G.hoOff.z - player.pos.z);
        let sd = G.hoArcDir.dot(_arcS);
        if (Math.abs(sd) < 0.3) { const sl = G.hoArcDir.x * (camera.position.x - player.pos.x) + G.hoArcDir.z * (camera.position.z - player.pos.z); if (Math.abs(sl) > 0.05) sd = sl; }
        if (sd < 0) G.hoArcDir.negate();
        G.hoArcAmp = clamp$9(1.15 - Math.abs(sd), 0.5, 1.15);
      }
      camera.position.addScaledVector(G.hoArcDir, (G.hoArcAmp || 0.5) * s);
      camera.position.y += 0.2 * s;
      fragments.keepClear(camera.position);
      G.hoArcT = (G.hoArcT || 0) + dt;
      if (G.arcSpin) {
        const aw = G.arcSpin.length() * Math.exp(-G.hoArcT / 0.25) * dt;
        if (aw > 1e-7) G.arcFocus.sub(camera.position).applyAxisAngle(_arcS.copy(G.arcSpin).normalize(), aw).add(camera.position);
      }
      _arcT.set(player.pos.x, player.pos.y + 0.15, player.pos.z);
      _arcA.subVectors(G.arcFocus, camera.position).normalize();
      _arcB.subVectors(_arcT, camera.position).normalize();
      _arcA.lerp(_arcB, Math.max(1 - clamp$9(G.hoW, 0, 1), smoothstep(0, 0.35, G.hoArcT))).normalize();
      _arcF.copy(camera.position).add(_arcA);
      _arcM.lookAt(camera.position, _arcF, _arcUp);
      G.cine.q.setFromRotationMatrix(_arcM);
    }
    G.hoWV += (-wr * wr * G.hoW - 2 * wr * G.hoWV) * dt;
    G.hoW = Math.max(0, G.hoW + G.hoWV * dt);
    G.hoT = (G.hoT || 0) + dt;
    if (G.cine.dq) G.cine.q.premultiply(_hoQ.identity().slerp(G.cine.dq, Math.exp(-G.hoT / 0.35)));
    camera.quaternion.slerp(G.cine.q, clamp$9(G.blendArc ? Math.max(G.hoW, smoothstep(0.15, 0.9, G.hoOff.length())) : G.hoW, 0, 1));
    blendK = 1 - clamp$9(G.hoW, 0, 1);
    G.blendT -= dt;
    if (G.blendT <= 0 || (G.hoOff.lengthSq() < 1e-6 && G.hoOffV.lengthSq() < 1e-6 && G.hoW < 1e-3)) { G.blendT = 0; G.hoOff = null; G.blendArc = false; G.hoArc0 = 0; }
  }
  findBias(dt);
  updateDiverFromPlayer(dt, t, G.hoDive ? 1 : blendK);
  camMotion(dt);
  G.cuHo = null;
  if (G.arriveClean) {
    const it = G.arriveClean;
    G.arriveClean = null;
    if (it.state === 'buried' && !fragments.busy()) { G.cleanItem = it; setState('clean'); return; }
  }
  if (G.hudAt && G.st >= G.hudAt) { G.hudAt = 0; UI.showHUD(true); UI.showSonar(true); }
  if (G.hintAt && G.st >= G.hintAt) {
    G.hintAt = 0;
    if (!player.keys.KeyW && player.vel.length() < 0.6 && !G.cleanHint) {
      guide.hint(touch.mode ? COPY.controlsTouch : COPY.controls, 6);
    }
  }
  if (G.hintOff && G.st >= G.hintOff) { G.hintOff = 0; if (G.found === 0 && !G.cleanHint) UI.hint(''); }
  INTERACT.uPlayer.value.copy(player.pos);
  fragments.update(dt, t, camera, player.pos, diverPresenter());
  if (G.site && !G.site.placed) siteNow();
  if (atPile && !fragments.busy() && pileWay(dt) < SITE_ARRIVE) { setState('assemble'); return; }
  finSilt(dt);
  breathe(dt);
  const near = cleanTarget(), going = !!(player.auto && player.auto.item);
  if (near && !going && !fragments.busy()) {
    if (UI.prompt) {
      _proj.copy(near.home).add(_promptLift).project(camera);
      const [W, H] = viewSize();
      const vis = _proj.z < 1 && Math.abs(_proj.x) < 1.05 && Math.abs(_proj.y) < 1.05;
      UI.prompt((_proj.x * 0.5 + 0.5) * W, (-_proj.y * 0.5 + 0.5) * H, touch.mode ? COPY.findPromptTouch : COPY.findPrompt, '', vis);
      if (!G.cleanHint) { G.cleanHint = true; UI.hint(''); }
    } else if (!G.cleanHint) { G.cleanHint = true; UI.hint(touch.mode ? COPY.findPromptTouch : COPY.findPrompt); }
  } else if (G.cleanHint) { G.cleanHint = false; UI.hint(''); hidePrompt(); }
  const nearNow = !!near && !fragments.busy();
  if (nearNow && !G.nearSaid) { G.nearSaid = true; guide.event('near'); } else if (!nearNow) G.nearSaid = false;
  const gf = guide.update(dt, {
    state: 'explore', found: G.found, sonarUsed: G.sonarUsed, near: nearNow,
    target: target ? target.item.home : null, pos: player.pos, yaw: player.yaw,
    air: G.air, idle: player.idleSeconds ? player.idleSeconds() : null, face: !!player.keys.KeyF,
    touch: touch.mode, hud: !G.hudAt,
  });
  const mk = player.keys;
  if (UI.factUp() && !fragments.busy() && (mk.KeyW || mk.KeyS || mk.KeyA || mk.KeyD || mk.Space || mk.KeyC || player.holding)) UI.dismissFact(Math.max(1800, UI.factReadMs()));
  if (gf.beacon) fragments.beacon = Math.max(fragments.beacon, 0.6);
  updateMarker(atPile ? (fragments.busy() ? null : G.site.tgt) : G.sonarT > 0 || gf.marker || player.keys.KeyF ? target : null);
  markersMore(!atPile && G.sonarT > 0 && !fragments.busy() ? target : null);
}
function pileWay(dt) {
  const S = G.site, d = Math.hypot(player.pos.x - S.pile.x, player.pos.z - S.pile.z);
  S.tgt.dist = Math.hypot(player.pos.x - S.tgt.item.home.x, player.pos.z - S.tgt.item.home.z);
  if (d < S.best - 0.5) { S.best = d; S.stall = 0; } else S.stall += dt;
  S.hintT += dt;
  _proj.copy(S.tgt.item.home).project(camera);
  const off = _proj.z > 1 || Math.abs(_proj.x) > 0.9 || Math.abs(_proj.y) > 0.9;
  if (off && (S.hintT < dt * 1.5 || S.stall > 6)) { S.stall = 0; guide.hint(isTouch ? COPY.facePileTouch : COPY.facePile, 6); }
  else if (!off && (guide.mine === COPY.facePile || guide.mine === COPY.facePileTouch)) guide.unhint();
  return d;
}

const _presP = new V3(), _presS = new V3(), _pf = new V3(), _pu = new V3(), _pRt = new V3();
const presenter = { pos: _presP, stow: _presS };
function diverPresenter() {
  if (!diver$1 || !diver$1.group.visible) return null;
  _pf.set(0, 0, -1).applyQuaternion(diver$1.group.quaternion);
  _pu.set(0, 1, 0).applyQuaternion(diver$1.group.quaternion);
  _pRt.set(1, 0, 0).applyQuaternion(diver$1.group.quaternion);
  _presP.copy(player.pos).addScaledVector(_pf, 0.72).addScaledVector(_pRt, 0.1).addScaledVector(_pu, 0.12);
  _presP.y += 0.28;
  _presS.copy(player.pos).addScaledVector(_pu, 0.05);
  return presenter;
}

const _rch = new V3(), _dhD = new V3(), _dhR = new V3(), _dhO1 = { grip: 1 }, _dhO2 = { grip: 0.8 }, _dhO3 = { grip: 0.4 };
function diverHands() {
  G.lookFind = null;
  if (!diver$1 || !diver$1.reach) return;
  if (fragments.applyHands(diver$1)) return;
  diver$1.hold('right', false);
  diver$1.hold('left', false);
  const C = player.climb;
  if (C && C.on) {
    _dhR.set(-C.dir.z, 0, C.dir.x);
    diver$1.reach('right', _rch.copy(C.edge).addScaledVector(_dhR, 0.18), C.hands, _dhO1);
    diver$1.reach('left', _rch.copy(C.edge).addScaledVector(_dhR, -0.18), C.hands, _dhO1);
    return;
  }
  const ch = diver$1.anchors && diver$1.anchors.chest;
  if (!ch) return;
  const u = G.rapAt ? U.uTime.value - G.rapAt : 9;
  if (u < 0.8) {
    const w = smoothstep(0, 0.15, u) * (1 - smoothstep(0.62, 0.8, u));
    const tap = Math.max(Math.exp(-(((u - 0.25) / 0.04) ** 2)), Math.exp(-(((u - 0.47) / 0.04) ** 2)));
    ch.getWorldPosition(_rch);
    _dhD.set(0, 0, -1).applyQuaternion(diver$1.group.quaternion);
    _rch.addScaledVector(_dhD, 0.14 - 0.1 * tap);
    diver$1.reach('right', _rch, w, _dhO2);
    return;
  }
  const hv = Math.hypot(player.vel.x, player.vel.z);
  if (hv > 0.5) return;
  let best = null, bd = 2.5;
  for (const it of fragments.items) {
    if (it.state !== 'buried') continue;
    const d = Math.hypot(it.home.x - player.pos.x, it.home.z - player.pos.z);
    if (d < bd) { bd = d; best = it; }
  }
  if (!best) return;
  G.lookFind = best.home;
  ch.getWorldPosition(_rch);
  _dhD.subVectors(best.home, _rch).normalize();
  _rch.addScaledVector(_dhD, 0.45);
  _rch.y -= 0.1;
  diver$1.reach('right', _rch, 0.3 * smoothstep(2.5, 1.7, bd) * (1 - smoothstep(0.25, 0.5, hv)), _dhO3);
}
const _dvE = new THREE.Euler(0, 0, 0, 'YXZ'), _dvLook = new V3(), _mouth = new V3();
const _dvY = new V3(0, 1, 0), _dvF = new V3(), _dvCur = new V3(), _dvH = new V3();
const _dvP = { pose: 'stand', vel: null, grounded: true, floor: null, waterY: 0, current: null, lookDir: null, effort: 0, lean: 0, valve: 0, blowup: 0, intent: null, speed: 0, thrust: 0, turnRate: 0, slope: 0, reach: 0, climb: 0 };
function updateDiverFromPlayer(dt, t, blendK = 1) {
  if (!diver$1) return;
  const b = player.body, walker = !!player.adoptLens;
  diver$1.group.position.copy(player.pos);
  if (walker) diver$1.group.quaternion.setFromAxisAngle(_dvY, b.yaw);
  else diver$1.group.quaternion.setFromEuler(_dvE.set(b.pitch, b.yaw, b.roll, 'YXZ'));
  _dvLook.set(0, 0, -1).applyQuaternion(camera.quaternion);
  diverHands();
  if (G.lookFind) _dvLook.lerp(_dvF.subVectors(G.lookFind, player.pos).normalize(), 0.6).normalize();
  const su = G.rapAt ? U.uTime.value - G.rapAt - 0.6 : 9;
  if (su > 0 && su < 1.6) _dvLook.applyAxisAngle(_dvY, 0.6 * Math.sin((2 * Math.PI * su) / 1.6) * Math.sin((Math.PI * su) / 1.6));
  const ku = G.knockAt ? U.uTime.value - G.knockAt : 9;
  if (ku < 0.3) { _dvLook.y += 0.5 * Math.sin((Math.PI * ku) / 0.3); _dvLook.normalize(); }
  diverTethers(false);
  _dvCur.copy(currentAt(player.pos.x, player.pos.y + 0.5, player.pos.z));
  const P = _dvP, hv = Math.hypot(player.vel.x, player.vel.z);
  if (walker) {
    P.pose = player.pose; P.grounded = player.grounded; P.floor = player.groundFn;
    P.effort = player.effort; P.lean = player.lean; P.valve = player.valve; P.blowup = player.blowup;
    P.intent = player.intent || null;
    P.slope = diver$1.caps && diver$1.caps.lean ? player.slope : ((7 + 18 * Math.min(1, hv / 1.4) - player.lean) * (Math.PI / 180)) / 0.45;
  } else {
    P.pose = player.vel.length() > 0.35 || player.thrust > 0.1 ? 'swim' : 'hover';
    P.grounded = undefined; P.floor = groundAt; P.slope = 0; P.intent = null;
  }
  P.vel = player.vel; P.current = _dvCur; P.lookDir = _dvLook;
  P.speed = player.vel.length(); P.thrust = player.thrust; P.turnRate = b.yawRate;
  diver$1.update(dt, t, P);
  if (walker) ropeSilt(dt);
  if (walker) bootKicks(dt);
  let hd = player.lensDistance;
  if (diver$1.anchors && diver$1.anchors.helmet) hd = camera.position.distanceTo(diver$1.anchors.helmet.getWorldPosition(_dvH));
  diver$1.setFade(smoothstep(0.35, 0.6, hd) * smoothstep(0.1, 0.6, G.blendArc ? 1 : blendK));
}
const _rsP = new V3(), _rsPrev = [null, null], _rsO = { spread: 0.06, color: [0.66, 0.62, 0.52], up: 0.05, life: 2.5, size: 0.04, ground: 0 };
let _rsT = 0;
function ropeSilt(dt) {
  _rsT += dt;
  if (_rsT < 0.12 || !diver$1 || !diver$1.tether) return;
  const h = _rsT;
  _rsT = 0;
  let n = 0;
  const ropes = [diver$1.tether.hose];
  for (let r = 0; r < ropes.length; r++) {
    const R = ropes[r];
    if (!R || !R.points) continue;
    const P = R.points;
    const prev = _rsPrev[r];
    if (!prev || prev.length !== P.length) { _rsPrev[r] = Float32Array.from(P); continue; }
    for (let i = 0; i + 2 < P.length && n < 4; i += 12) {
      const x = P[i], y = P[i + 1], z = P[i + 2], g = player.groundFn(x, z);
      if (y - g > 0.07) continue;
      if (Math.hypot(x - prev[i], z - prev[i + 2]) / h < 0.12) continue;
      _rsO.ground = g;
      fx.silt(_rsP.set(x, g + 0.02, z), 1, _rsO);
      n++;
    }
    prev.set(P);
  }
}

const _bk = { p: [new V3(), new V3()], at: [new V3(0, -1e9, 0), new V3(0, -1e9, 0)], fw: [new V3(), new V3()], lo: [0, 0], down: [0, 0], h: [0, 0], n: [0, 0], vd: [0, 0], vh: [0, 0], sp: 0, dec: 0, dt: 1 / 60, t: -1, knee: 0, kneeT: 0, kneeP: new V3(), kneeS: 0, kneeN: 0 };
const _bkq = new V3(), _bkd = new V3(), _bkc = [0, 0, 0], _bka = new Array(13), _bkO = { color: _bkc, dir: _bkd, fan: 1.9, rim: 0.09, oval: 1, speed: 0.3, up: 0.08, life: 1.4, size: 0.04, ground: 0 };
const _bkG = { spread: 0.1, up: 0.1, push: new V3(), ground: 0 };
function bootKick(a, p, S, kind, k, col, fewer) {
  const an = diver$1.anchors && diver$1.anchors[a ? 'leftFoot' : 'rightFoot'];
  if (!an) return;
  an.getWorldPosition(_bkq);
  _bkO.ground = _bkG.ground = S;
  _bkc[0] = col[0]; _bkc[1] = col[1]; _bkc[2] = col[2];
  const sand = kind === 1 || kind === 3 ? 0 : kind === 2 ? 1 : smoothstep(0.3, 0.7, terrainAttrs(p.x, p.z, _bka)[3]);
  const cu = G.state === 'clean' && fragments.cu.downT >= 0, n0 = sand * fewer * (cu ? 0.5 : 1);
  if (_bkq.distanceTo(p) > 0.25) {
    _bk.knee = 1; _bk.kneeT = 0; _bk.kneeP.set(p.x, S + 0.01, p.z); _bk.kneeS = S; _bk.kneeN = n0;
    kneeKick(_bk.kneeP, 0.6 * n0, S);
    return;
  }
  diver$1.group.getWorldDirection(_bkd);
  const l = Math.hypot(_bkd.x, _bkd.z) || 1;
  _bkd.set(-_bkd.x / l, 0, -_bkd.z / l);
  const q = _bk.p[a], dt = Math.max(_bk.dt, 1e-3), fresh = U.uTime.value - _bk.t < 0.1, o = _bk.at[1 - a];
  const vd = fresh ? Math.max(_bk.vd[a], (q.y - _bkq.y) / dt) : 0, vh = fresh ? Math.max(_bk.vh[a], Math.hypot(q.x - _bkq.x, q.z - _bkq.z) / dt) : 0;
  const drop = Math.hypot(o.x - p.x, o.z - p.z) < 1.2 ? Math.max(0, o.y - S - 0.02) : 0, tw = Math.abs(player.body.yawRate || 0);
  const h = fresh ? clamp$9(0.1 + 0.5 * vd + 0.12 * vh + 0.15 * _bk.dec + 0.35 * tw + 2 * drop, 0.08, 1) : 0.8 * k;
  _bk.down[a] = 1; _bk.at[a].set(p.x, S + 0.02, p.z); _bk.lo[a] = _bkq.y; _bk.fw[a].copy(_bkd); _bk.h[a] = h; _bk.n[a] = n0;
  const n = Math.round((4 + 6 * h) * n0);
  if (n < 1) return;
  _bkq.set(p.x, S + 0.01, p.z);
  _bkO.fan = Math.PI; _bkO.rim = 0.13; _bkO.oval = 0.45; _bkO.speed = 0.12 + 0.3 * h; _bkO.up = 0.01 + 0.04 * h; _bkO.life = 0.9 + 0.8 * h; _bkO.size = 0.09 + 0.04 * h;
  fx.kick(_bkq, n, _bkO);
  _bkG.spread = 0.1; _bkG.up = 0.05 + 0.1 * h; _bkG.push.set(_bkd.x * 0.12 * h, 0, _bkd.z * 0.12 * h);
  fx.grains(_bkq, Math.round((2 + 5 * h) * n0), _bkG);
}
function kneeKick(p, n0, S, up = 0.02) {
  const n = Math.round(3 * n0);
  if (n < 1) return;
  _bkO.ground = S; _bkO.dir = null; _bkO.rim = 0.06; _bkO.oval = 1; _bkO.speed = 0.08; _bkO.up = up; _bkO.life = 1.2; _bkO.size = 0.08;
  fx.kick(p, n, _bkO);
  _bkO.dir = _bkd;
}
function bootKicks(dt) {
  if (!diver$1 || !diver$1.anchors || !diver$1.anchors.rightFoot || dt <= 0) return;
  const sp = Math.hypot(player.vel.x, player.vel.z), fresh = U.uTime.value - _bk.t < 0.1;
  _bk.dec += (Math.max(0, (_bk.sp - sp) / dt) - _bk.dec) * Math.min(1, 10 * dt);
  _bk.sp = sp; _bk.dt = dt; _bk.t = U.uTime.value;
  const fade = fresh ? Math.exp(-dt / 0.12) : 0;
  for (let a = 0; a < 2; a++) {
    const o = _bkq.copy(_bk.p[a]), q = diver$1.anchors[a ? 'leftFoot' : 'rightFoot'].getWorldPosition(_bk.p[a]);
    _bk.vd[a] = fresh ? Math.max(_bk.vd[a] * fade, (o.y - q.y) / dt) : 0; _bk.vh[a] = fresh ? Math.max(_bk.vh[a] * fade, Math.hypot(q.x - o.x, q.z - o.z) / dt) : 0;
    if (!_bk.down[a]) continue;
    const P = _bk.at[a];
    _bk.lo[a] = Math.min(_bk.lo[a], q.y);
    if (Math.hypot(q.x - P.x, q.z - P.z) > 0.3) { _bk.down[a] = 0; continue; }
    if (q.y - _bk.lo[a] < 0.04) continue;
    _bk.down[a] = 0;
    const h = 0.4 * _bk.h[a] + 0.6 * clamp$9(sp / 1.25, 0, 1), f = _bk.fw[a];
    const n = Math.round((1 + 2 * h) * _bk.n[a]);
    if (n < 1) continue;
    sandAlbedo(P.x, P.z, 0.2, _bkc);
    _bkq.set(P.x + f.x * 0.12, P.y - 0.012, P.z + f.z * 0.12);
    _bkd.set(-f.x, 0, -f.z);
    _bkO.ground = P.y - 0.02; _bkO.fan = 0.8; _bkO.rim = 0.04; _bkO.oval = 1; _bkO.speed = 0.06 + 0.15 * h; _bkO.up = 0.02 + 0.03 * h; _bkO.life = 0.7 + 0.5 * h; _bkO.size = 0.07 + 0.03 * h;
    fx.kick(_bkq, n, _bkO);
    _bkG.ground = P.y - 0.02; _bkG.spread = 0.04; _bkG.up = 0.08; _bkG.push.set(-f.x * 0.15 * h, 0, -f.z * 0.15 * h);
    fx.grains(_bkq, Math.round((1 + 3 * h) * _bk.n[a]), _bkG);
  }
  if (_bk.knee && diver$1.pose !== 'kneel' && (_bk.kneeT += dt) > 0.3) {
    _bk.knee = 0;
    sandAlbedo(_bk.kneeP.x, _bk.kneeP.z, 0.2, _bkc);
    kneeKick(_bk.kneeP, 0.6 * _bk.kneeN, _bk.kneeS, 0.05);
  }
}

function makeStandInDiver() {
  const g = new THREE.Group();
  const suit = patchMaterial(new THREE.MeshStandardMaterial({ color: 0x15181a, roughness: 0.5 }));
  const metal = patchMaterial(new THREE.MeshStandardMaterial({ color: 0x8a8f94, metalness: 0.6, roughness: 0.4 }));
  const add = (geo, mat, x, y, z, rx = Math.PI / 2) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.x = rx; m.castShadow = m.receiveShadow = true; g.add(m); return m; };
  add(new THREE.CapsuleGeometry(0.19, 0.75, 6, 14), suit, 0, 0, -0.1);
  add(new THREE.CylinderGeometry(0.09, 0.09, 0.62, 16), metal, 0, 0.22, -0.05);
  add(new THREE.SphereGeometry(0.12, 16, 12), suit, 0, 0.04, -0.72, 0);
  for (const s of [-1, 1]) {
    add(new THREE.CapsuleGeometry(0.075, 0.72, 4, 10), suit, 0.12 * s, -0.02, 0.62);
    add(new THREE.BoxGeometry(0.2, 0.012, 0.5), suit, 0.13 * s, -0.04, 1.22, 0);
  }
  const mouth = new THREE.Object3D(); mouth.position.set(0, -0.06, -0.84); g.add(mouth);
  const torch = new THREE.Object3D(); torch.position.set(-0.25, 0, -0.9); g.add(torch);
  return {
    group: g, update() {}, setPose() {}, dispose() {},
    setFade(a) { g.visible = a > 0.02; },
    anchors: { mouth, torch, head: mouth, rightHand: torch, leftHand: torch },
  };
}

function finSilt(dt) {
  if (diver$1 && diver$1.onStep) return;
  if (!player.thrust || player.thrust < 0.2) return;
  const byaw = player.body.yaw;
  const fx0 = player.pos.x + Math.sin(byaw) * 1.25, fz0 = player.pos.z + Math.cos(byaw) * 1.25;
  const fy = player.pos.y - 0.25;
  const fh = groundAt(fx0, fz0);
  const clear = fy - fh;
  if (clear > 1.2) return;
  G.siltAcc += dt * (1.2 - clear) * 14 * player.thrust;
  while (G.siltAcc > 1) {
    G.siltAcc -= 1;
    const p = new V3(fx0 + (Math.random() - 0.5) * 0.6, fh + 0.05, fz0 + (Math.random() - 0.5) * 0.6);
    fx.silt(p, 3, { spread: 0.35, color: [0.72, 0.66, 0.52], up: 0.3, life: 4.0, size: 0.06, push: new V3(Math.sin(byaw), 0.2, Math.cos(byaw)).multiplyScalar(0.25) });
  }
}

let breathHooked = false;
function diverBreathing() {
  if (!diver$1 || !diver$1.onExhale || !diver$1.group.visible) return false;
  if (G.state !== 'explore' && G.state !== 'dive' && G.state !== 'crank' && G.state !== 'clean' && G.state !== 'assemble') return false;
  diver$1.anchors.mouth.getWorldPosition(_mouth);
  return _mouth.y < waveHeight(_mouth.x, _mouth.z, U.uTime.value) - 0.1;
}
function hookBreath() {
  if (breathHooked || !diver$1 || !diver$1.onExhale) return;
  breathHooked = true;
  if (diver$1.onInhale) diver$1.onInhale(() => { G.inhaleAt = U.uTime.value; G.audioBreathIn = Math.max(0, (G.i2e || 1.9) - 1.3); });
  diver$1.onExhale(() => {
    if (G.inhaleAt) G.i2e = clamp$9(U.uTime.value - G.inhaleAt, 0.8, 3.5);
    if (diverBreathing()) { if (!diver$1.onVent) fx.exhaleFrom(_mouth, 1); else EXH.ex = 0.45; }
  });
}
const EXH_RATE = 34;
const EXH = { p: new V3(), q: new V3(), on: false, own: 0, acc: 0, n: 0, ex: 0, dive: 0, lump: 0 };
function exhaustStream(dt) {
  const own = EXH.n;
  EXH.n = 0;
  if (G.state !== 'dive') EXH.dive = 0;
  if (!diver$1 || !diver$1.onVent || !fx || !fx._bubble || !diver$1.group.visible || !diver$1.anchors.exhaust || dt <= 0) { EXH.on = false; return; }
  diver$1.anchors.exhaust.getWorldPosition(EXH.p);
  const t = U.uTime.value;
  if (EXH.p.y > waveHeight(EXH.p.x, EXH.p.z, t) - 0.12) { EXH.on = false; return; }
  if (!EXH.on) { EXH.on = true; EXH.q.copy(EXH.p); EXH.own = 0; EXH.acc = 0; }
  EXH.own += (own / dt - EXH.own) * (1 - Math.exp(-dt));
  EXH.ex = Math.max(0, EXH.ex - dt);
  const pulse = 0.55 + 0.9 * Math.pow(Math.max(0, Math.sin(t * Math.PI * 4)), 2);
  const want = EXH_RATE * pulse * (diver$1.exhaling ? 1.35 : 1) + (EXH.ex > 0 ? 70 : 0) + EXH.dive;
  EXH.acc += Math.max(0, want - EXH.own) * dt;
  const n = Math.min(40, Math.floor(EXH.acc));
  EXH.acc -= Math.floor(EXH.acc);
  for (let i = 0; i < n; i++) {
    const k = (i + Math.random()) / n, r = Math.random(), cap = r < 0.05;
    const size = cap ? 0.016 + Math.random() * 0.012 : r < 0.3 ? 0.006 + Math.random() * 0.006 : 0.0022 + Math.random() * 0.0038;
    fx._bubble(EXH.q.x + (EXH.p.x - EXH.q.x) * k + (Math.random() - 0.5) * 0.03, EXH.q.y + (EXH.p.y - EXH.q.y) * k,
      EXH.q.z + (EXH.p.z - EXH.q.z) * k + (Math.random() - 0.5) * 0.03,
      (Math.random() - 0.5) * 0.08, 0.2 + Math.random() * 0.1, (Math.random() - 0.5) * 0.08, 14 + Math.random() * 4, size, cap);
  }
  if (EXH.dive > 0) {
    EXH.lump -= dt;
    if (EXH.lump <= 0) {
      EXH.lump = 0.16 + 0.24 * Math.random();
      const nl = Math.round((3 + Math.random() * 5) * Math.min(1, EXH.dive / PLUME19));
      for (let i = 0; i < nl; i++) {
        const cap = i < 2 || Math.random() < 0.35;
        fx._bubble(EXH.p.x + (Math.random() - 0.5) * 0.05, EXH.p.y + Math.random() * 0.04, EXH.p.z + (Math.random() - 0.5) * 0.05,
          (Math.random() - 0.5) * 0.15, 0.35 + Math.random() * 0.25, (Math.random() - 0.5) * 0.15, 8 + Math.random() * 4, cap ? 0.012 + Math.random() * 0.018 : 0.006 + Math.random() * 0.006, cap);
      }
    }
  }
  EXH.q.copy(EXH.p);
}

function breathe(dt) {
  if (diver$1 && diver$1.onExhale) {
    hookBreath();
    if (diverBreathing()) {
      if (G.audioBreathIn >= 0) { G.audioBreathIn -= dt; if (G.audioBreathIn < 0) audio$1.breathe(); }
      G.breathT = 1.5;
      return;
    }
  }
  G.breathT -= dt;
  if (G.breathT <= 0) {
    const r = audio$1.breathe();
    G.exhaleIn = r && r.exhaleAt ? r.exhaleAt : 1.0;
    G.breathT = 5.0 + Math.random() * 1.2;
  }
  if (G.exhaleIn > 0) {
    G.exhaleIn -= dt;
    if (G.exhaleIn <= 0) {
      if (diver$1 && diver$1.group.visible && (G.state === 'explore' || G.state === 'dive')) {
        diver$1.anchors.mouth.getWorldPosition(_mouth);
        fx.exhaleFrom(_mouth, 1);
      } else fx.exhale(camera, 1);
    }
  }
}

const _proj = new V3();
const _promptLift = new V3(0, 0.35, 0);
const _mkLift = new V3(0, 0.5, 0);
const _mmP = new V3(), _mmL = [];
function markersMore(target) {
  _mmL.length = 0;
  if (target) {
    const [W, H] = viewSize();
    for (const it of fragments.items) {
      if (it.state !== 'buried' || it === target.item) continue;
      _mmP.copy(it.home).add(_mkLift).project(camera);
      _mmL.push({ x: (_mmP.x * 0.5 + 0.5) * W, y: (-_mmP.y * 0.5 + 0.5) * H, behind: _mmP.z > 1, dist: Math.hypot(it.home.x - player.pos.x, it.home.z - player.pos.z) });
    }
  }
  UI.markersMore(_mmL);
}
function updateMarker(target) {
  if (!target || fragments.busy()) { UI.marker(0, 0, 0, false); return; }
  _proj.copy(target.item.home).add(_mkLift).project(camera);
  const [W, H] = viewSize();
  UI.marker((_proj.x * 0.5 + 0.5) * W, (-_proj.y * 0.5 + 0.5) * H, target.dist, true, { behind: _proj.z > 1 });
}

const _hrP = new V3(), _hrV = new V3(), _hrXs = new Float32Array(1024), _hrYs = new Float32Array(1024);
function heroRects(it) {
  const [W, H] = viewSize(), out = [];
  camera.updateMatrixWorld();
  const f = (H / 2) / Math.tan((camera.fov * Math.PI) / 360);
  const blob = (p, R) => {
    _hrV.copy(p).applyMatrix4(camera.matrixWorldInverse);
    const d = -_hrV.z;
    if (d < camera.near) return;
    p.project(camera);
    const x = (p.x * 0.5 + 0.5) * W, y = (-p.y * 0.5 + 0.5) * H, r = Math.min(H * 0.3, (R * f) / d);
    out.push({ x0: x - r, y0: y - r, x1: x + r, y1: y + r });
  };
  if (diver$1 && diver$1.group && diver$1.group.visible) {
    diver$1.group.updateMatrixWorld(true);
    diver$1.group.traverse((o) => { if (o.isBone && !/hose|line|tether|rope/i.test(o.name)) blob(o.getWorldPosition(_hrP), 0.13); });
    const A = diver$1.anchors || {};
    if (A.head) blob(A.head.getWorldPosition(_hrP), 0.24);
    for (const k of ['rightHand', 'leftHand']) if (A[k]) blob(A[k].getWorldPosition(_hrP), 0.12);
  }
  const lump = it && it.lump, pos = lump && lump.visible && lump.geometry && lump.geometry.attributes.position;
  if (pos) {
    lump.updateMatrixWorld(true);
    const n = pos.count, step = Math.max(1, Math.floor(n / 400));
    let m = 0, y0 = Infinity, y1 = -Infinity;
    for (let v = 0; v < n && m < 1024; v += step) {
      _hrP.fromBufferAttribute(pos, v).applyMatrix4(lump.matrixWorld);
      _hrV.copy(_hrP).applyMatrix4(camera.matrixWorldInverse);
      if (-_hrV.z < camera.near) continue;
      _hrP.project(camera);
      const x = (_hrP.x * 0.5 + 0.5) * W, y = (-_hrP.y * 0.5 + 0.5) * H;
      _hrXs[m] = x; _hrYs[m] = y; m++;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
    if (m) {
      const NB = 6, bh = Math.max(1, (y1 - y0) / NB), pad = H * 0.02 + 0.12 * (y1 - y0);
      for (let b = 0; b < NB; b++) {
        const top = y0 + b * bh, bot = top + bh;
        let x0 = Infinity, x1 = -Infinity;
        for (let k = 0; k < m; k++) {
          const y = _hrYs[k];
          if (y >= top && (y < bot || b === NB - 1)) { if (_hrXs[k] < x0) x0 = _hrXs[k]; if (_hrXs[k] > x1) x1 = _hrXs[k]; }
        }
        if (x1 >= x0) out.push({ x0: x0 - pad, y0: top - pad, x1: x1 + pad, y1: bot + pad, w: 3 });
      }
    }
  }
  return out;
}

function factClock(dt) {
  if (UI.tickFact) UI.tickFact(dt);
}

const _clE = new V3(), _clI = new THREE.Quaternion(), _hbF = new V3();
function cleanLens(o, dt) {
  camera.position.copy(o.camPos);
  camera.quaternion.copy(o.camQuat);
  const H = G.cuHo;
  if (!H || dt <= 0) { fragments.keepClear(camera.position); return; }
  H.t += dt;
  const w = 4.5, det = 1 / (1 + 2 * dt * w + dt * dt * w * w);
  H.v.addScaledVector(H.x, -dt * w * w).multiplyScalar(det);
  H.x.addScaledVector(H.v, dt);
  const wr = 5, dr = 1 / (1 + 2 * dt * wr + dt * dt * wr * wr);
  H.w.addScaledVector(H.r, -dt * wr * wr).multiplyScalar(dr);
  H.r.addScaledVector(H.w, dt);
  camera.position.add(H.x);
  const ang = H.r.length();
  if (ang > 1e-8) camera.quaternion.premultiply(_clI.setFromAxisAngle(_clE.copy(H.r).divideScalar(ang), ang));
  fragments.keepClear(camera.position);
  if (H.t > 0.3 && H.x.length() < 5e-4 && H.v.length() < 0.01 && ang < 5e-4 && H.w.length() < 0.01) G.cuHo = null;
}
const _brushIn = { ndc: null, press: false, moveAge: 9, auto: false, touch: false };
function updateClean(dt, t) {
  if (G.site && !G.site.placed) siteNow();
  _brushIn.ndc = G.bndc;
  _brushIn.press = ptr.down && ptr.button === 0;
  _brushIn.moveAge = U.uTime.value - (G.bMoved || 0);
  _brushIn.auto = !!(G.autoBrush || G.eHeld);
  _brushIn.touch = ptr.type === 'touch';
  if (diver$1) diverTethers(false);
  const o = fragments.updateCloseup(dt, t, _brushIn);
  G.closeup = o;
  cleanLens(o, dt);
  camera.updateMatrixWorld();
  camMotion(dt);
  G.lensAdd = o.fovAdd;
  if (o.brush > 0) guide.event('clean-stroke');
  audio$1.brush(o.brush, fragments.cu && fragments.cu.tipV, o.progress / CLEAN_TARGET, G.cleanItem ? G.cleanItem.i : -1);
  if (o.uncovered) {
    audio$1.brush(0);
    UI.showClean(false);
    canvas.classList.remove('mode-brush');
    G.autoBrush = false;
  } else if (G.cleanItem.state === 'cleaning') {
    UI.clean(o.progress / CLEAN_TARGET);
    const cu = fragments.cu;
    if (cu.downT >= 0 || (!cu.plan.walk && cu.t > cu.blend * 0.5)) UI.cleanReady();
  }
  fragments.update(dt, t, camera, player.pos);
  breathe(dt);
  guide.update(dt, { state: 'clean' });
  if (o.release) setState('explore');
}

function abortClean() {
  if (G.state !== 'clean' || !G.cleanItem || G.cleanItem.state !== 'cleaning') return;
  audio$1.brush(0);
  fragments.abortCloseup();
  UI.showClean(false);
  canvas.classList.remove('mode-brush');
  G.autoBrush = false;
  setState('explore');
}

const GO_AP = 0.05;
const ASM_LENS = -14;
const ASM_CLEAR0 = 0.2;
const HERO_TRAIL = [3.2, 2.2, 0.9];
const SAND_PUFF = [0.62, 0.6, 0.52];
const SILT_OUT = { spread: 0.45, color: SAND_PUFF, up: 0.35, life: 3.0, size: 0.05 };
const GRAIN_OUT = { spread: 0.3, up: 0.5 };
const GRIT_SILT = { spread: 0.3, color: [0.5, 0.46, 0.38], up: 0.06, life: 2.4, size: 0.035 };
const GRIT_GRAIN = { spread: 0.25, up: 0.12 };
const PLACE_OPTS = { direct: true };
const _aUp = new V3(0, 1, 0), _aZ = new V3(0, 0, 1);
const _qZY = new THREE.Quaternion().setFromUnitVectors(_aZ, _aUp);
const smoother = (x) => { x = clamp$9(x, 0, 1); return x * x * x * (x * (x * 6 - 15) + 10); };
function bez(out, a, b, c, d, u) {
  const v = 1 - u;
  return out.copy(a).multiplyScalar(v * v * v).addScaledVector(b, 3 * v * v * u).addScaledVector(c, 3 * v * u * u).addScaledVector(d, u * u * u);
}

function mgTrail(key, pos, on, col) {
  if (!magic$1) return;
  try { magic$1.trail(key, pos, on, col); } catch (e) { console.warn('[antikythera] magic:', e); magic$1 = null; }
}
function mgCharge(k) {
  if (!magic$1) return;
  try { magic$1.setCharge(k); } catch (e) { console.warn('[antikythera] magic:', e); magic$1 = null; }
}
function mgSeat(p, s, r) {
  if (!magic$1) return;
  try { magic$1.seat(p, s, r); } catch (e) { console.warn('[antikythera] magic:', e); magic$1 = null; }
}

const GLOW_ASM = new THREE.Color(1.0, 0.84, 0.6);
const GLOW_FIN = new THREE.Color(1.0, 0.76, 0.48);
const _glowD = new V3();
function placeGlow() {
  const M = G.mech.M;
  _glowD.set(M.x - camera.position.x, 0, M.z - camera.position.z);
  const l = _glowD.length();
  if (l > 1e-3) _glowD.multiplyScalar(1 / l); else _glowD.set(-Math.sin(G.mech.yaw), 0, -Math.cos(G.mech.yaw));
  glowLight.position.set(M.x + _glowD.x * 0.7, M.y + 0.05, M.z + _glowD.z * 0.7);
}
function glowTo(i, col, dt, rate) {
  const k = 1 - Math.exp(-dt * rate);
  glowLight.intensity += (i - glowLight.intensity) * k;
  glowLight.color.lerp(col, k);
}

function snapFov(add) {
  fovAdd = add;
  applyLens();
}

const ASM_MARKS = [
  [0.45, 0.38, 4.2, 3.9, 0.55, 0.45, 0.05],
  [0.34, 0.1, 4.4, 3.6, 0.45, 0.3, 0.05],
  null,
  [-0.02, -0.2, 4.1, 3.7, 0.45, 0.35, 0.05],
  null,
  [-0.26, -0.44, 4.0, 3.6, 0.2, 0.3, 0.0],
  null,
  [0.08, 0.26, 4.8, 4.5, -0.4, -0.3, 0.15],
  [0.4, 0.48, 5.6, 5.2, 0.7, 0.55, 0.05],
];
const ASM_LEN = [3.2, 4.8, 1, 3.0, 1, 4.8, 1, 5.2, 5.4];
const PZ_MARK = [0.0, 3.6, 0.8, -0.25];

const AX$1 = new Float64Array(6), AV = new Float64Array(6), AT = new Float64Array(6);
function rigStep(dt, w) {
  const a = w * w, b = 2 * w;
  for (let i = 0; i < 6; i++) {
    AV[i] += (a * (AT[i] - AX$1[i]) - b * AV[i]) * dt;
    AX$1[i] += AV[i] * dt;
  }
}
const _aim = new V3();
function rigApply(t) {
  const { M, yaw } = G.mech;
  const phi = AX$1[0] + Math.sin(t * 0.21) * 0.011 + Math.sin(t * 0.53 + 1.3) * 0.004;
  const h = AX$1[2] + Math.sin(t * 0.31 + 0.7) * 0.018 + Math.sin(t * 0.83) * 0.004;
  const a = yaw + phi, r = AX$1[1] * FRAME.reach(baseFov + ASM_LENS);
  camera.position.set(M.x + Math.sin(a) * r, M.y + h, M.z + Math.cos(a) * r);
  _aim.set(M.x + Math.cos(yaw) * AX$1[4] + Math.sin(yaw) * AX$1[5], M.y + AX$1[3] + Math.sin(t * 0.27 + 2.1) * 0.01, M.z - Math.sin(yaw) * AX$1[4] + Math.cos(yaw) * AX$1[5]);
  lookInto(camera.quaternion, camera.position, _aim);
}
function asmMark() {
  const S = G.asm, A = mechanism.assembly, pz = G.puzzle;
  AT[5] = 0;
  const step = S.started && A ? A.step : 0;
  if (pz || pzWaiting()) {
    AT[0] = PZ_MARK[0]; AT[1] = PZ_MARK[1]; AT[2] = PZ_MARK[2]; AT[3] = PZ_MARK[3]; AT[4] = 0;
    return;
  }
  if (S.seat && (step === 2 || step === 4 || step === 6)) {
    for (let i = 0; i < 5; i++) AT[i] = S.seat[i];
    return;
  }
  let m, u;
  if (!S.started) { m = ASM_MARKS[0]; u = 0; }
  else if (A.done || step >= ASM_MARKS.length) { m = ASM_MARKS[ASM_MARKS.length - 1]; u = 1 + 0.2 * Math.min(1.5, G.settleT); }
  else { m = ASM_MARKS[step] || ASM_MARKS[Math.max(0, step - 1)]; u = clamp$9(A.stepT / ASM_LEN[step], 0, 1); }
  AT[0] = lerp$4(m[0], m[1], u); AT[1] = lerp$4(m[2], m[3], u); AT[2] = lerp$4(m[4], m[5], u); AT[3] = m[6]; AT[4] = 0;
  if (step <= 1 && !(A && A.done) && G.site && G.site.lay) AT[4] = SITE_LAY[G.site.lay].aim * spol(SITE_LAY[G.site.lay].pile, SITE_PILE)[0];
}

const DW_UP = 0.95;
const DW_R = 0.34;
const dwIs1901 = () => !!(diver$1 && typeof diver$1.setTether === 'function');
const goSpeed = () => (dwIs1901() ? 1.7 : 1.9);
const dwBrisk = () => G.state === 'assemble' && !!G.asm && !G.asm.walkIn;
const dwAccUp = () => (dwBrisk() ? 2.2 : dwIs1901() ? 0.8 : 1.2);
const dwAccDown = () => (dwBrisk() ? 3.0 : 1.2);
const DW_EASE = 0.25;
const DW_TURN = 1.25;
const DW_RISE = 0.8;
const _dwCtx = { speed: 0, thrust: 0, turnRate: 0, climb: 0, lookDir: new V3(0, 0, -1), reach: 0, pose: 'hover', vel: new V3(), floor: floorHeight, waterY: 0, effort: 0.2, grounded: undefined, slope: undefined, lean: undefined, colliders: null };
let _dwCol = null;
const _dwA = new V3(), _dwB = new V3(), _dwH = new V3(), _dwE = new THREE.Euler(0, 0, 0, 'YXZ');

function mcoords(p, out) {
  const { M, yaw } = G.mech, c = Math.cos(yaw), s = Math.sin(yaw), dx = p.x - M.x, dz = p.z - M.z;
  return out.set(dx * c - dz * s, 0, dx * s + dz * c);
}
function mframe(r, f, out) {
  const { M, yaw } = G.mech, c = Math.cos(yaw), s = Math.sin(yaw);
  out.set(M.x + c * r + s * f, 0, M.z - s * r + c * f);
  out.y = floorHeight(out.x, out.z) + DW_UP;
  return out;
}

function dwStart(p, v, yaw, fade = 1) {
  const W = G.dw || (G.dw = { p: new V3(), v: new V3(), vy: 0, yaw: 0, yawV: 0, path: [], speed: 1, arrived: true, arrT: 9, look: new V3(), lookV: new V3(), lookInit: false, fade: 1 });
  W.p.copy(p);
  W.v.set(v ? v.x : 0, 0, v ? v.z : 0);
  W.vy = v ? clamp$9(v.y, -0.9, 0.9) : 0;
  W.yaw = yaw;
  W.yawV = 0;
  W.path.length = 0;
  W.arrived = true;
  W.arrT = 9;
  W.lookInit = false;
  W.fade = fade;
  W.y0 = clamp$9(p.y - (floorHeight(p.x, p.z) + DW_UP), -0.6, 0.6);
  W.age = 0;
  W.kneelT = 9;
  W.vmax = Math.max(0.3, Math.hypot(W.v.x, W.v.z));
  W.carry = Math.hypot(W.v.x, W.v.z);
  W.spPrev = Math.hypot(W.v.x, W.v.z);
  W.aF = 0;
  W.stuck = 0;
  return W;
}
function routeLen(pts, p) {
  let d = 0, x = p.x, z = p.z;
  for (let i = 0; i < pts.length; i++) { d += Math.hypot(pts[i].x - x, pts[i].z - z); x = pts[i].x; z = pts[i].z; }
  return d;
}
function dwGo(points, speed, brake = 1.1) {
  const W = G.dw;
  W.path.length = 0;
  for (let i = 0; i < points.length; i++) W.path.push(points[i].clone());
  W.speed = speed;
  W.brake = brake;
  W.arrived = false;
  W.arrT = 0;
}
function dwLeft() {
  const W = G.dw;
  let d = 0, x = W.p.x, z = W.p.z;
  for (let i = 0; i < W.path.length; i++) { d += Math.hypot(W.path[i].x - x, W.path[i].z - z); x = W.path[i].x; z = W.path[i].z; }
  return d;
}

function dwRoute(p, q) {
  const cs = 0.5, pad = 12;
  const x0 = Math.min(p.x, q.x) - pad, z0 = Math.min(p.z, q.z) - pad;
  const nx = Math.ceil((Math.max(p.x, q.x) + pad - x0) / cs) + 1, nz = Math.ceil((Math.max(p.z, q.z) + pad - z0) / cs) + 1;
  const N = nx * nz, shut = new Uint8Array(N);
  const disc = (cx, cz, r) => {
    const i0 = Math.max(0, Math.floor((cx - r - x0) / cs)), i1 = Math.min(nx - 1, Math.ceil((cx + r - x0) / cs));
    const j0 = Math.max(0, Math.floor((cz - r - z0) / cs)), j1 = Math.min(nz - 1, Math.ceil((cz + r - z0) / cs));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const dx = x0 + i * cs - cx, dz = z0 + j * cs - cz;
      if (dx * dx + dz * dz <= r * r) shut[j * nx + i] = 1;
    }
  };
  for (let k = 0; k < obstacles.length; k++) {
    const o = obstacles[k], fl = floorHeight(o.x, o.z);
    if (o.y + o.r < fl + 0.3 || o.y - o.r > fl + 1.9) continue;
    disc(o.x, o.z, o.r + DW_R + 0.12);
  }
  for (let k = 0; k < capsules.length; k++) {
    const c = capsules[k], fl = floorHeight((c.ax + c.bx) / 2, (c.az + c.bz) / 2);
    if (Math.max(c.ay, c.by) + c.r < fl + 0.3 || Math.min(c.ay, c.by) - c.r > fl + 1.9) continue;
    const n = Math.max(1, Math.ceil(Math.hypot(c.bx - c.ax, c.bz - c.az) / (cs * 0.5)));
    for (let m = 0; m <= n; m++) disc(c.ax + ((c.bx - c.ax) * m) / n, c.az + ((c.bz - c.az) * m) / n, c.r + DW_R + 0.05);
  }
  const amph = wreck && wreck.amphorae;
  if (amph) for (let k = 0; k < amph.length; k++) disc(amph[k].position.x, amph[k].position.z, 0.32 + DW_R);
  if (G.state === 'assemble' || dwMachine()) {
    for (let fr = -MB_F; fr <= MB_F + 1e-6; fr += cs * 0.5) for (let rr = -MB_R; rr <= MB_R + 1e-6; rr += cs * 0.5) {
      mframe(rr, fr, _dwH);
      disc(_dwH.x, _dwH.z, DW_R + 0.3);
    }
  }
  const cell = (x, z) => clamp$9(Math.round((z - z0) / cs), 0, nz - 1) * nx + clamp$9(Math.round((x - x0) / cs), 0, nx - 1);
  const open = (c) => {
    if (!shut[c]) return c;
    const ci = c % nx, cj = (c - ci) / nx;
    for (let r = 1; r < 8; r++) {
      for (let j = Math.max(0, cj - r); j <= Math.min(nz - 1, cj + r); j++) {
        for (let i = Math.max(0, ci - r); i <= Math.min(nx - 1, ci + r); i++) if (!shut[j * nx + i]) return j * nx + i;
      }
    }
    return c;
  };
  const s = open(cell(p.x, p.z)), goal = open(cell(q.x, q.z));
  const gi = goal % nx, gj = (goal - gi) / nx;
  const gc = new Float32Array(N).fill(Infinity), came = new Int32Array(N).fill(-1), done = new Uint8Array(N);
  const hp = [], hf = [];
  const push = (id, f) => {
    let i = hp.length;
    hp.push(id); hf.push(f);
    while (i > 0) { const pa = (i - 1) >> 1; if (hf[pa] <= f) break; hp[i] = hp[pa]; hf[i] = hf[pa]; i = pa; }
    hp[i] = id; hf[i] = f;
  };
  const pop = () => {
    const top = hp[0], lid = hp.pop(), lf = hf.pop();
    if (hp.length) {
      let i = 0;
      for (;;) {
        let c = 2 * i + 1;
        if (c >= hp.length) break;
        if (c + 1 < hp.length && hf[c + 1] < hf[c]) c++;
        if (hf[c] >= lf) break;
        hp[i] = hp[c]; hf[i] = hf[c]; i = c;
      }
      hp[i] = lid; hf[i] = lf;
    }
    return top;
  };
  const est = (id) => { const i = id % nx; return Math.hypot(i - gi, (id - i) / nx - gj); };
  gc[s] = 0;
  push(s, est(s));
  while (hp.length) {
    const u = pop();
    if (u === goal) break;
    if (done[u]) continue;
    done[u] = 1;
    const ui = u % nx, uj = (u - ui) / nx;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      if (!di && !dj) continue;
      const i = ui + di, j = uj + dj;
      if (i < 0 || j < 0 || i >= nx || j >= nz) continue;
      const v = j * nx + i;
      if (shut[v] || done[v]) continue;
      if (di && dj && (shut[uj * nx + i] || shut[j * nx + ui])) continue;
      const ng = gc[u] + (di && dj ? 1.4142 : 1);
      if (ng < gc[v]) { gc[v] = ng; came[v] = u; push(v, ng + est(v)); }
    }
  }
  if (goal !== s && came[goal] < 0) return [q.clone()];
  const cells = [];
  for (let c = goal; c !== -1; c = came[c]) cells.push(c);
  cells.reverse();
  const cx = (c) => x0 + (c % nx) * cs, cz = (c) => z0 + ((c - (c % nx)) / nx) * cs;
  const sight = (ax, az, bx, bz) => {
    const n = Math.ceil(Math.hypot(bx - ax, bz - az) / (cs * 0.4));
    for (let k = 1; k < n; k++) if (shut[cell(ax + ((bx - ax) * k) / n, az + ((bz - az) * k) / n)]) return false;
    return true;
  };
  const out = [];
  let ax = p.x, az = p.z, a = 0;
  while (a < cells.length - 1) {
    let b = cells.length - 1;
    while (b > a + 1 && !sight(ax, az, cx(cells[b]), cz(cells[b]))) b--;
    a = b;
    ax = cx(cells[b]);
    az = cz(cells[b]);
    if (a < cells.length - 1) out.push(new V3(ax, floorHeight(ax, az) + DW_UP, az));
  }
  out.push(q.clone());
  return out;
}

const MB_R = 0.8, MB_F = 0.6;
const dwMachine = () => (G.asm && G.asm.started) || G.state === 'crank' || G.state === 'eclipse';
function dwAway(vd, dx, dz, rr, zone = 1.2) {
  const d = Math.hypot(dx, dz);
  if (d > rr + zone || d < 1e-5) return;
  const nx = dx / d, nz = dz / d, k = 1 - clamp$9((d - rr) / zone, 0, 1);
  const into = -(vd.x * nx + vd.z * nz);
  if (into <= 0) return;
  let tx = -nz, tz = nx;
  if (tx * vd.x + tz * vd.z < 0) { tx = -tx; tz = -tz; }
  vd.x += (nx + tx) * into * k;
  vd.z += (nz + tz) * into * k;
}
function dwSteer(vd) {
  const p = G.dw.p, fl = p.y - DW_UP;
  for (let i = 0; i < obstacles.length; i++) {
    const o = obstacles[i];
    if (o.y + o.r < fl + 0.3 || o.y - o.r > fl + 1.9) continue;
    dwAway(vd, p.x - o.x, p.z - o.z, o.r + DW_R);
  }
  for (let i = 0; i < capsules.length; i++) {
    const c = capsules[i];
    if (Math.max(c.ay, c.by) + c.r < fl + 0.3 || Math.min(c.ay, c.by) - c.r > fl + 1.9) continue;
    const abx = c.bx - c.ax, abz = c.bz - c.az, l2 = abx * abx + abz * abz;
    const h = l2 > 1e-6 ? clamp$9(((p.x - c.ax) * abx + (p.z - c.az) * abz) / l2, 0, 1) : 0;
    dwAway(vd, p.x - c.ax - abx * h, p.z - c.az - abz * h, c.r + DW_R - 0.08);
  }
  if (dwMachine()) {
    const yaw = G.mech.yaw, cs = Math.cos(yaw), sn = Math.sin(yaw);
    mcoords(p, _dwH);
    const er = _dwH.x - clamp$9(_dwH.x, -MB_R, MB_R), ef = _dwH.z - clamp$9(_dwH.z, -MB_F, MB_F);
    dwAway(vd, cs * er + sn * ef, -sn * er + cs * ef, DW_R, 0.35);
  }
}
function dwPush(p) {
  const fl = p.y - DW_UP;
  for (let i = 0; i < obstacles.length; i++) {
    const o = obstacles[i];
    if (o.y + o.r < fl + 0.3 || o.y - o.r > fl + 1.9) continue;
    const dx = p.x - o.x, dz = p.z - o.z, d = Math.hypot(dx, dz), rr = o.r + DW_R;
    if (d < rr && d > 1e-5) { p.x += (dx / d) * (rr - d); p.z += (dz / d) * (rr - d); }
  }
  for (let i = 0; i < capsules.length; i++) {
    const c = capsules[i];
    if (Math.max(c.ay, c.by) + c.r < fl + 0.3 || Math.min(c.ay, c.by) - c.r > fl + 1.9) continue;
    const abx = c.bx - c.ax, abz = c.bz - c.az, l2 = abx * abx + abz * abz;
    const h = l2 > 1e-6 ? clamp$9(((p.x - c.ax) * abx + (p.z - c.az) * abz) / l2, 0, 1) : 0;
    const dx = p.x - c.ax - abx * h, dz = p.z - c.az - abz * h, d = Math.hypot(dx, dz), rr = c.r + DW_R - 0.08;
    if (d < rr && d > 1e-5) { p.x += (dx / d) * (rr - d); p.z += (dz / d) * (rr - d); }
  }
  if (dwMachine()) {
    mcoords(p, _dwH);
    const qx = Math.abs(_dwH.x) - MB_R, qz = Math.abs(_dwH.z) - MB_F;
    const ox = Math.max(qx, 0), oz = Math.max(qz, 0), out = Math.hypot(ox, oz);
    const d = out > 0 ? out : Math.max(qx, qz);
    if (d < DW_R) {
      if (out > 1e-5) { _dwH.x += Math.sign(_dwH.x) * (ox / out) * (DW_R - d); _dwH.z += Math.sign(_dwH.z) * (oz / out) * (DW_R - d); }
      else if (qx > qz) _dwH.x += Math.sign(_dwH.x) * (DW_R - d);
      else _dwH.z += Math.sign(_dwH.z) * (DW_R - d);
      const y = p.y;
      mframe(_dwH.x, _dwH.z, p);
      p.y = y;
    }
  }
}

function dwUpdate(dt, t, look, face, pose = 'hover', pitch = 0, effort = 0.2, claim = 0) {
  const W = G.dw, v = W.v, n19 = dwIs1901();
  W.age += dt;
  if (pose === 'kneel' && !W.path.length) W.kneelT = 0; else W.kneelT += dt;
  const rising = W.kneelT < DW_RISE;
  const up = dwAccUp(), down = dwAccDown();
  W.carry = Math.max(0, (W.carry || 0) - DW_EASE * dt);
  const pace = Math.max(W.speed, n19 ? W.carry : 0);
  if (W.path.length) {
    const g = W.path[0], last = W.path.length === 1;
    _dwA.set(g.x - W.p.x, 0, g.z - W.p.z);
    const d = _dwA.length();
    if (!last && d < 0.8) W.path.shift();
    else {
      let vd = last ? Math.min(pace, Math.sqrt((W.brake || 1.1) * Math.max(0, d - 0.01))) : pace;
      if (rising) vd = 0;
      if (n19 && d > 1e-5) vd *= dwBrisk() ? smoothstep(1.2, 0.5, Math.abs(wrapA(Math.atan2(-_dwA.x, -_dwA.z) - W.yaw))) : smoothstep(0.9, 0.35, Math.abs(wrapA(Math.atan2(-_dwA.x, -_dwA.z) - W.yaw)));
      _dwA.multiplyScalar(d > 1e-5 ? vd / d : 0);
      dwSteer(_dwA);
      const sl = Math.hypot(_dwA.x, _dwA.z);
      if (sl > pace) _dwA.multiplyScalar(pace / sl);
      _dwB.subVectors(_dwA, v).setY(0);
      const acc = (Math.min(sl, pace) > Math.hypot(v.x, v.z) ? up : down) * dt;
      if (_dwB.lengthSq() > acc * acc) _dwB.setLength(acc);
      v.add(_dwB);
      if (last && ((d < 0.06 && v.length() < 0.08) || (d < 0.2 && W.arrT > 3 && v.length() < 0.15))) { W.path.length = 0; W.arrived = true; W.arrT = 0; }
    }
  }
  if (!W.path.length) { const k = Math.exp(-dt * 5); v.x *= k; v.z *= k; }
  W.arrT += dt;
  const px = W.p.x, pz = W.p.z;
  W.p.x += v.x * dt;
  W.p.z += v.z * dt;
  dwPush(W.p);
  if (dt > 1e-5) {
    v.set((W.p.x - px) / dt, 0, (W.p.z - pz) / dt);
    W.vmax = Math.max(pace * 1.1, W.vmax - down * dt);
    const vl = v.length(), vm = Math.max(0.3, W.vmax);
    if (vl > vm) v.multiplyScalar(vm / vl);
    if (W.path.length && !rising && vl < 0.08) {
      W.stuck = (W.stuck || 0) + dt;
      if (W.stuck > 1.2) {
        W.stuck = 0;
        const q = W.path[W.path.length - 1].clone(), r = dwRoute(W.p, q);
        W.path.length = 0;
        for (let i = 0; i < r.length; i++) W.path.push(r[i]);
      }
    } else W.stuck = 0;
  }
  const sp = Math.hypot(v.x, v.z);
  const fy = floorHeight(W.p.x, W.p.z) + DW_UP;
  let slope = 0, vy = 0;
  if (n19) {
    W.p.y = fy + W.y0 * (1 - smoother(W.age / 0.3));
    if (sp > 0.02) {
      const ux = v.x / sp, uz = v.z / sp, e = 0.35;
      const gr = (floorHeight(W.p.x + ux * e, W.p.z + uz * e) - floorHeight(W.p.x - ux * e, W.p.z - uz * e)) / (2 * e);
      slope = Math.atan(gr);
      vy = gr * sp;
    }
    W.vy = vy;
  } else {
    W.vy += (4 * (fy - W.p.y) - 4 * W.vy) * dt;
    W.vy = clamp$9(W.vy, -0.9, 0.9);
    W.p.y += W.vy * dt;
    if (W.p.y < fy - 0.25) { W.p.y = fy - 0.25; if (W.vy < 0) W.vy = 0; }
    vy = W.vy;
  }
  let ty = W.yaw;
  const gB = dwBrisk() && W.path.length ? W.path[0] : null;
  if (gB && Math.hypot(gB.x - W.p.x, gB.z - W.p.z) > 0.3) ty = Math.atan2(-(gB.x - W.p.x), -(gB.z - W.p.z));
  else if (W.path.length && sp > 0.2) ty = Math.atan2(-v.x, -v.z);
  else if (W.path.length && n19) { const g = W.path[0]; if (Math.hypot(g.x - W.p.x, g.z - W.p.z) > 0.3) ty = Math.atan2(-(g.x - W.p.x), -(g.z - W.p.z)); }
  else if (face) ty = Math.atan2(-(face.x - W.p.x), -(face.z - W.p.z));
  const kT = dwBrisk() ? 2.6 : 1, turnMax = dwBrisk() ? 4.0 : DW_TURN;
  W.yawV += (6.25 * kT * kT * wrapA(ty - W.yaw) - 5 * kT * W.yawV) * dt;
  if (n19) W.yawV = clamp$9(W.yawV, -turnMax, turnMax);
  W.yaw += W.yawV * dt;
  const pt = pitch + (n19 ? 0 : clamp$9(W.vy * 0.4, -0.35, 0.2) * clamp$9(sp / 0.5, 0, 1));
  diver$1.group.position.copy(W.p);
  diver$1.group.quaternion.setFromEuler(_dwE.set(pt, W.yaw, 0, 'YXZ'));
  if (!W.lookInit) { W.look.copy(look); W.lookV.set(0, 0, 0); W.lookInit = true; }
  _dwB.subVectors(look, W.look);
  W.lookV.addScaledVector(_dwB, 12 * dt).multiplyScalar(Math.exp(-7 * dt));
  W.look.addScaledVector(W.lookV, dt);
  _dwH.set(W.p.x, W.p.y + 0.72, W.p.z);
  _dwCtx.lookDir.subVectors(W.look, _dwH).normalize();
  _dwCtx.pose = sp > 0.14 && !rising ? 'swim' : pose;
  _dwCtx.speed = sp;
  _dwCtx.thrust = W.path.length ? clamp$9(sp / 1.2, 0.2, 1) : 0;
  _dwCtx.turnRate = W.yawV;
  _dwCtx.climb = n19 ? 0 : clamp$9(W.vy / 2, -1, 1);
  _dwCtx.vel.set(v.x, vy, v.z);
  _dwCtx.effort = effort;
  if (dt > 1e-5) { const a = (sp - W.spPrev) / dt; W.aF += (a - W.aF) * (1 - Math.exp(-dt * 4)); }
  W.spPrev = sp;
  _dwCtx.grounded = n19 ? true : undefined;
  _dwCtx.slope = n19 ? slope : undefined;
  _dwCtx.lean = n19 ? clamp$9(15 * clamp$9(sp / 0.85, 0, 1.3) + 9 * W.aF, -5, 24) : undefined;
  _dwCtx.colliders = dwMachine() && mechanism.parts && mechanism.parts.case ? (_dwCol || (_dwCol = [mechanism.parts.case.obj])) : null;
  const stow = !!(fragments && typeof fragments.applyHands === 'function' && fragments.applyHands(diver$1));
  if (!stow && typeof diver$1.reach === 'function') {
    if (!(claim & 1)) diver$1.reach('right', null, 0);
    if (!(claim & 2)) diver$1.reach('left', null, 0);
    if (typeof diver$1.hold === 'function') {
      if (!(claim & 1)) diver$1.hold('right', false);
      if (!(claim & 2)) diver$1.hold('left', false);
    }
  }
  W.fade = Math.min(1, W.fade + dt / 0.6);
  if (typeof diverTethers === 'function') diverTethers(false);
  diver$1.update(dt, t, _dwCtx);
  bootKicks(dt);
  diver$1.setFade(W.fade);
}

const CV = { p: new V3(), v: new V3(), init: false }, _cvD = new V3();
function trackCamVel(dt) {
  if (!CV.init || dt <= 0) { CV.p.copy(camera.position); CV.v.set(0, 0, 0); CV.init = true; return; }
  _cvD.subVectors(camera.position, CV.p).divideScalar(dt);
  if (_cvD.lengthSq() > 400) _cvD.set(0, 0, 0);
  CV.v.lerp(_cvD, 1 - Math.exp(-dt * 30));
  CV.p.copy(camera.position);
  if (!G.mech) return;
  crossPoint(_xvP);
  if (XV.init && dt > 0) XV.v.lerp(_cvD.subVectors(_xvP, XV.p).divideScalar(dt), 1 - Math.exp(-dt * 20));
  if (XV.v.lengthSq() > 400) XV.v.set(0, 0, 0);
  XV.p.copy(_xvP);
  XV.init = true;
}
const XV = { p: new V3(), v: new V3(), init: false }, _xvP = new V3();

const _abV = new V3();
const ROUND_WALK = [1.7, 2.4];
const ROUND_T = 9.5;
function asmBegin(live) {
  const S = G.site, W0 = S.watch;
  if (live) {
    dwStart(diver$1.group.position, player.vel, player.body.yaw, smoothstep(0.55, 1.1, player.lensDistance));
  } else {
    const p = mframe(1.6, 5.4, new V3());
    dwStart(p, null, Math.atan2(-(W0.x - p.x), -(W0.z - p.z)), 0);
    camera.position.copy(mframe(2.6, 8.8, _abV)).setY(p.y + 0.9);
    lookInto(camera.quaternion, camera.position, p);
    CV.v.set(0, 0, 0);
    XV.v.set(0, 0, 0);
  }
  const R = S.round || [];
  S.far = null;
  if (!R.length) { dwGo(dwRoute(G.dw.p, W0), goSpeed(), 2.6); return; }
  const out = dwRoute(G.dw.p, R[0]), round = [];
  let p = R[0];
  for (const q of [...R.slice(1), W0]) { round.push(...dwRoute(p, q)); p = q; }
  if (wayHidden(R[0], round)) { const way = [...out, ...round]; dwGo(way, clamp$9(routeLen(way, G.dw.p) / ROUND_T, ROUND_WALK[0], ROUND_WALK[1])); }
  else { S.far = R[0]; dwGo(out, goSpeed(), 2.6); }
}
const _whCam = new THREE.PerspectiveCamera(), _whP = new V3(), _whQ = new V3();
function wayHidden(p, pts) {
  const { M, yaw } = G.mech, c = Math.cos(yaw), s = Math.sin(yaw), Lay = G.site && SITE_LAY[G.site.lay];
  const across = Lay ? Lay.aim * spol(Lay.pile, SITE_PILE)[0] : 0, hero = { 2: 2, 4: 1, 6: 0 }, seq = [];
  ASM_MARKS.forEach((m, i) => {
    if (m) seq.push([m[0], m[2], m[4], m[6], i <= 1 ? across : 0], [m[1], m[3], m[5], m[6], i <= 1 ? across : 0]);
    else seq.push([PZ_MARK[0], PZ_MARK[1], PZ_MARK[2], PZ_MARK[3], 0], seatMark(hero[i]));
  });
  const m8 = ASM_MARKS[ASM_MARKS.length - 1];
  seq.push([lerp$4(m8[0], m8[1], 1.3), lerp$4(m8[2], m8[3], 1.3), lerp$4(m8[4], m8[5], 1.3), m8[6], 0]);
  Object.assign(_whCam, { fov: baseFov + ASM_LENS, aspect: camera.aspect, near: 0.1, far: 200 });
  _whCam.updateProjectionMatrix();
  for (let i = 0; i < seq.length; i++) {
    for (const f of i + 1 < seq.length ? [0, 1 / 3, 2 / 3] : [0]) {
      const k = seq[i].map((v, j) => (f ? lerp$4(v, seq[i + 1][j], f) : v)), a = yaw + k[0];
      _whCam.position.set(M.x + Math.sin(a) * k[1], M.y + k[2], M.z + Math.cos(a) * k[1]);
      lookInto(_whCam.quaternion, _whCam.position, _whQ.set(M.x + c * k[4], M.y + k[3], M.z - s * k[4]));
      _whCam.updateMatrixWorld(true);
      let x = p.x, z = p.z;
      for (const q of pts) {
        const n = Math.max(1, Math.ceil(Math.hypot(q.x - x, q.z - z) / 0.4));
        for (let u = 1; u <= n; u++) {
          const wx = lerp$4(x, q.x, u / n), wz = lerp$4(z, q.z, u / n), fl = floorHeight(wx, wz);
          for (const h of [0.05, 0.95, 1.9]) {
            _whP.set(wx, fl + h, wz).project(_whCam);
            if (_whP.z < 1 && Math.abs(_whP.x) < 1.06 && Math.abs(_whP.y) < 1.06) return false;
          }
        }
        x = q.x; z = q.z;
      }
    }
  }
  return true;
}

function camClearOf(p) {
  const W = G.dw;
  if (!W || !diver$1 || !diver$1.group.visible) return;
  const cy = clamp$9(p.y, W.p.y - DW_UP + 0.2, W.p.y + 0.95);
  const dx = p.x - W.p.x, dy = p.y - cy, dz = p.z - W.p.z, d = Math.hypot(dx, dy, dz), R = 0.8;
  if (d < R && d > 1e-5) { const k = (R - d) / d; p.x += dx * k; p.y += dy * k; p.z += dz * k; }
}

const _ctF = new V3(), _ctP = new V3();
function crossPoint(out) {
  const M = G.mech.M, cp = camera.position;
  _ctF.set(0, 0, -1).applyQuaternion(camera.quaternion);
  const lam = (M.x - cp.x) * _ctF.x + (M.y - cp.y) * _ctF.y + (M.z - cp.z) * _ctF.z;
  return out.copy(cp).addScaledVector(_ctF, clamp$9(lam, 1, 40));
}
function rigTake() {
  const { M, yaw } = G.mech, cp = camera.position, t = U.uTime.value, v = CV.v;
  const dx = cp.x - M.x, dz = cp.z - M.z, rr = Math.max(0.6, Math.hypot(dx, dz));
  const phi = Math.atan2(dx, dz) - yaw - (Math.sin(t * 0.21) * 0.011 + Math.sin(t * 0.53 + 1.3) * 0.004);
  const kR = FRAME.reach(baseFov + ASM_LENS);
  AX$1[0] = ASM_MARKS[0][0] + wrapA(phi - ASM_MARKS[0][0]);
  AX$1[1] = rr / kR;
  AX$1[2] = cp.y - M.y - (Math.sin(t * 0.31 + 0.7) * 0.018 + Math.sin(t * 0.83) * 0.004);
  AV[0] = (dz * v.x - dx * v.z) / (rr * rr);
  AV[1] = (dx * v.x + dz * v.z) / rr / kR;
  AV[2] = v.y;
  const c = Math.cos(yaw), s = Math.sin(yaw);
  crossPoint(_ctP);
  AX$1[4] = (_ctP.x - M.x) * c - (_ctP.z - M.z) * s;
  AX$1[5] = (_ctP.x - M.x) * s + (_ctP.z - M.z) * c;
  AX$1[3] = _ctP.y - M.y - Math.sin(t * 0.27 + 2.1) * 0.01;
  AV[4] = XV.v.x * c - XV.v.z * s;
  AV[5] = XV.v.x * s + XV.v.z * c;
  AV[3] = XV.v.y;
  G.asm.rig = true;
}

function lensStep(dt) {
  const L = G.lens;
  if (!L) return;
  const w = L.w || 1.2;
  L.v += (w * w * (L.to - L.x) - 2 * w * L.v) * dt;
  L.x += L.v * dt;
  fovAdd = L.x;
  applyLens();
  G.lensAdd = fovAdd;
}

function asmSocket(h) {
  const S = G.asm, w = wheels && wheels[h];
  if (w && w.fitted) { wheelHomeDue(w); return; }
  if (S.pzDone) return;
  if (G.puzzle) { if (G.puzzle.slot !== h) pzOpen(h); }
  else if (S.rig && pzClear()) startPuzzle(h);
  else S.pending = h;
}
const _pzCam = new THREE.PerspectiveCamera(), _pzP = new V3();
function pzClear() {
  const W = G.dw, { M, yaw } = G.mech;
  if (!W || W.arrived || !diver$1 || !diver$1.group.visible) return true;
  const a = yaw + PZ_MARK[0];
  Object.assign(_pzCam, { fov: baseFov + ASM_LENS, aspect: camera.aspect, near: 0.1, far: 200 });
  _pzCam.updateProjectionMatrix();
  _pzCam.position.set(M.x + Math.sin(a) * PZ_MARK[1], M.y + PZ_MARK[2], M.z + Math.cos(a) * PZ_MARK[1]);
  lookInto(_pzCam.quaternion, _pzCam.position, _pzP.set(M.x, M.y + PZ_MARK[3], M.z));
  _pzCam.updateMatrixWorld(true);
  for (const h of [0.05, 0.95, 1.9]) {
    _pzP.set(W.p.x, W.p.y - DW_UP + h, W.p.z).project(_pzCam);
    if (_pzP.z < 1 && Math.abs(_pzP.x) < 1.15 && Math.abs(_pzP.y) < 1.15) return false;
  }
  return true;
}

function dwSeen(p) {
  for (const h of [0.05, 0.95, 1.9]) {
    _pzP.set(p.x, p.y - DW_UP + h, p.z).project(camera);
    if (_pzP.z < 1 && Math.abs(_pzP.x) < 1.2 && Math.abs(_pzP.y) < 1.2) return true;
  }
  return false;
}

const _adL = new V3(), _adF = new V3(), _adN = [];
function asmDiver(dt, t) {
  const S = G.asm, W = G.dw, M = G.mech.M;
  if (!diver$1 || !W) return;
  if (S.walkIn) { crankDiver(dt, t); return; }
  if (G.flyC) _adL.copy(G.flyC.mesh.position);
  else if (G.puzzle && (G.puzzle.held || G.puzzle.hoverW)) _adL.copy(G.puzzle.held ? G.puzzle.held.mesh.position : G.puzzle.hoverW.mesh.position);
  else {
    const n = mechanism.flying ? mechanism.flying(_adN).length : 0;
    if (n) _adL.copy(_adN[0].pos);
    else if (G.puzzle && G.puzzle.slot >= 0) _adL.copy(PLACES[G.puzzle.slot].tgt);
    else _adL.set(M.x, M.y + 0.2, M.z);
  }
  const lh = Math.max(0.5, Math.hypot(_adL.x - W.p.x, _adL.z - W.p.z)), ly = W.p.y + 0.72 - Math.tan(20 * DEG$3) * lh;
  if (_adL.y < ly) _adL.y = ly;
  _adF.set(M.x, W.p.y, M.z);
  dwUpdate(dt, t, _adL, _adF, 'hover');
}

function landPart(w, pt) {
  const big = pt.kind === 'plate' || pt.kind === 'dialSet';
  const set = !!(pt.parts && pt.parts.length > 1);
  fx.silt(w, big ? 16 : set ? 8 : 4, { spread: big ? 0.6 : 0.3, color: [0.62, 0.6, 0.52], up: 0.12, life: 2.8, size: 0.04 });
  const now = U.uTime.value;
  if (now - G.lastClack > 0.07) {
    G.lastClack = now;
    if (pt.hero === undefined || !audio$1.heroSeat) audio$1.clack(big ? 1 : set ? 0.8 : 0.55 + Math.random() * 0.4, pt.kind === 'gear' ? 0.9 + Math.random() * 0.3 : 0.75, pt.kind);
  }
  if (big) G.shake = Math.max(G.shake, 0.18);
  mgSeat(w, big || pt.hero !== undefined ? 1 : set ? 0.8 : pt.kind === 'gear' ? 0.6 : 0.4);
  if (pt.hero !== undefined) { timeWarp(0.5, 0.3); G.asm.rock = 0; audio$1.heroSeat?.(pt.hero, 1.6); }
}

const _flyBuf = [], _flyNow = new Set(), _flySeen = new Map(), _flyDel = [];
const _flyEnd = (last, name) => { if (!_flyNow.has(name)) { mgTrail(name, last, false); _flyDel.push(name); } };
function updateTrails() {
  if (!magic$1 || !mechanism.flying) return;
  const list = mechanism.flying(_flyBuf);
  _flyNow.clear();
  for (let i = 0; i < list.length; i++) {
    const f = list[i];
    _flyNow.add(f.name);
    let last = _flySeen.get(f.name);
    if (!last) { last = new V3(); _flySeen.set(f.name, last); }
    last.copy(f.pos);
    mgTrail(f.name, f.pos, true);
  }
  _flyDel.length = 0;
  _flySeen.forEach(_flyEnd);
  for (let i = 0; i < _flyDel.length; i++) _flySeen.delete(_flyDel[i]);
}

const PZ_FRONT = 0.62;
const PZ_REST = [[2, -0.95, 1.08], [1, 0, 0.95], [0, 0.95, 1.08]];
const PZ_LEAN = 0.42;
const PZ_CUE = 4;
const PZ_NEXT = [0.45, 0.9];
const PZ_ORDER = [2, 1, 0];
const PLACE_NAME = ['The main axle', 'Among the Moon’s wheels', 'Behind the spiral plate'];
const PZ_WHY = [
  [null, 'Too big for the Moon’s small wheels.', '224 teeth: one too many for the spiral’s 223 cells.'],
  ['The main axle takes the 224-tooth wheel.', null, '127 teeth: too few for the spiral’s 223 cells.'],
  ['The main axle takes the 224-tooth wheel.', 'Too big for the Moon’s small wheels.', null],
];
const PZ_IN = [[1, 0.45, 0.5], [0.55, 1, 0.55], [0.5, 0.45, 1]];
const PZ_HINT_FINE = 'Drag the wheels you discovered into place · [1] [2] [3] Pick · [Enter] Fit';
const PZ_HINT_TOUCH = COPY.puzzleTouch;
const NUMS = Array.from({ length: 256 }, (_, i) => String(i));
const LBL = [0, 1, 2, 3, 4, 5].map(() => ({ x: NaN, y: NaN, text: '' }));
const LBL_NONE = [];
const pzAsk = [];

const CAND_VS = `varying vec3 vO; varying vec3 vN; varying vec3 vV;
  void main() {
    vO = position;
    vN = normalize(normalMatrix * normal);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vV = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }`;
const CAND_FS = `uniform float uSw; uniform float uSwK; uniform float uHov; uniform float uHint; uniform vec3 uTeeth; uniform float uT;
  varying vec3 vO; varying vec3 vN; varying vec3 vV;
  void main() {
    float r = length(vO.xy);
    float tooth = smoothstep(uTeeth.x - 0.0003, uTeeth.x + 0.0002, r);
    float tip = smoothstep(uTeeth.y, uTeeth.z, r);
    float a = fract(0.25 - atan(vO.y, vO.x) * 0.15915494);
    float b = uSw - a;
    float head = exp(-abs(b) * 70.0) * (1.0 - step(0.999, uSw));
    float fres = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.0);
    vec3 gold = vec3(1.0, 0.7, 0.34);
    vec3 c = gold * tooth * uSwK * (step(0.0, b) * 0.14 + head * 1.8);
    c += gold * tooth * uHov * 0.2;
    float gl = pow(max(0.0, sin(a * 18.8496 - uT * 0.9)), 24.0);
    c += vec3(1.0, 0.85, 0.6) * tip * gl * (0.05 + 0.4 * uHov);
    c += vec3(0.9, 0.6, 0.25) * uHint * (0.3 + 0.7 * fres);
    gl_FragColor = vec4(c, 1.0);
  }`;
function wheelLook(spec, n) {
  const m = mechanism;
  if (typeof m.looseWheel === 'function') {
    try {
      const L = m.looseWheel({ id: spec.id, N: spec.N, spokes: spec.spokes, thickness: spec.thick });
      if (L && L.obj && L.u) return { obj: L.obj, u: L.u, glow: L.glow || null, own: true };
    } catch (e) { console.warn('[antikythera] looseWheel:', e); }
  }
  if (typeof m._wheel === 'function' && typeof m._bz === 'function') {
    try {
      const hero = spec.idx >= 0 && m.gears && m.gears[spec.id];
      const W = hero ? null : m._wheel({ id: spec.id, N: spec.N, spokes: spec.spokes, thick: spec.thick });
      const src = hero ? hero.mat : null;
      const pt = { glow: { value: 0 }, corrode: { value: 0 }, luU: { value: new THREE.Vector2() }, seed: hero ? hero.pt.seed : 40 + n * 7.31 };
      const col = src ? [src.color.r, src.color.g, src.color.b] : spec.N > 150 ? [0.96, 0.7, 0.4] : spec.N % 3 === 0 ? [0.92, 0.48, 0.28] : [0.88, 0.58, 0.28];
      const gear = src && src.userData.bz ? src.userData.bz.bzGear.value.toArray() : [W.rootR, W.tipR, W.bossR, W.rimIn];
      const mat = m._bz(pt, col, src ? src.roughness : spec.N > 150 ? 0.17 : 0.2, { gear, pulses: clamp$9(Math.round(spec.N / 45), 1, 5), seed: spec.N * 0.13 });
      mat.envMap = heroEnv;
      mat.envMapIntensity = 0.85 * 0.6 * (mat.userData.envK || 1);
      if (W && W.wheel) W.wheel.dispose();
      return { obj: new THREE.Mesh(hero ? hero.mesh.geometry : W.geo, mat), u: null, glow: pt.glow, own: false };
    } catch (e) { console.warn('[antikythera] placement wheels: falling back to plain teeth', e); }
  }
  const geo = gearGeometry(spec.N, { spokes: spec.spokes, thickness: spec.thick });
  geo.computeBoundingSphere();
  const patS = { value: 2.6 / Math.max(1e-4, geo.boundingSphere.radius) };
  const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(0.52, 0.36, 0.2), metalness: 0.82, roughness: 0.44, emissive: new THREE.Color(0.05, 0.025, 0.008) });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uPatS = patS;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uPatS;\nfloat cdPat;')
      .replace('#include <color_fragment>', `#include <color_fragment>
  {
    float pn = uwFbm3(vObjPos * uPatS);
    float pm = uwFbm3(vObjPos * uPatS * 3.1 + 7.0);
    cdPat = smoothstep(0.52, 0.68, pn + 0.1 * pm);
    vec3 verd = mix(vec3(0.14, 0.27, 0.22), vec3(0.33, 0.43, 0.35), pm);
    diffuseColor.rgb *= 0.8 + 0.35 * pm;
    diffuseColor.rgb = mix(diffuseColor.rgb, verd, cdPat * 0.85);
  }`)
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\n  metalnessFactor = mix(metalnessFactor, 0.08, cdPat);\n  roughnessFactor = mix(roughnessFactor, 0.86, cdPat);');
  };
  mat.customProgramCacheKey = () => 'candidate';
  patchMaterial(mat);
  mat.envMap = heroEnv;
  mat.envMapIntensity = 0.6;
  return { obj: new THREE.Mesh(geo, mat), u: null, glow: null, own: false };
}

function makeWheels() {
  const sc = mechanism.scale;
  wheels = HERO_GEARS.map((g, idx) => {
    const look = wheelLook({ idx, id: g.id, N: g.N, spokes: g.spokes, thick: g.thickness }, idx);
    const mesh = look.obj;
    mesh.scale.setScalar(sc);
    mesh.visible = false;
    mesh.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    const M = g.m, r = (g.N * M) / 2;
    let u = look.u ? { sw: look.u.sweep, swK: look.u.sweepK, hov: look.u.hover, hint: look.u.hint } : null;
    if (!u) {
      u = { sw: { value: 0 }, swK: { value: 0 }, hov: { value: 0 }, hint: { value: 0 } };
      const ovl = new THREE.Mesh(mesh.geometry, new THREE.ShaderMaterial({
        uniforms: { uSw: u.sw, uSwK: u.swK, uHov: u.hov, uHint: u.hint, uTeeth: { value: new V3(r - 1.15 * M, r, r + M) }, uT: U.uTime },
        vertexShader: CAND_VS, fragmentShader: CAND_FS,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2,
      }));
      ovl.renderOrder = 6;
      mesh.add(ovl);
    }
    scene.add(mesh);
    return {
      idx, N: g.N, rw: (r + M) * sc, label: `${g.N} teeth`, trailKey: `pick${idx}`,
      mesh, u, glow: look.glow, state: 'off', t: 0, T: 0, k: 0, s: 0, sv: 0, ang: 0, hov: 0, lift: 0, tipA: 0, tipB: 0,
      counted: false, sweepT: -1, tick: 0, arc: false, broke: false, place: -1, fitted: false, knocked: false, home: false, g0: 0, carry: false,
      vel: new V3(), tgt: new V3(), rest: new V3(), restQ: new THREE.Quaternion(), spot: new V3(), qFlat: new THREE.Quaternion(), stop: new V3(),
      from: new V3(), fromQ: new THREE.Quaternion(), b0: new V3(), b1: new V3(), b2: new V3(), b3: new V3(),
    };
  });
}

const PLACES = [0, 1, 2].map((idx) => ({ idx, seat: new V3(), axisW: new V3(), q: new THREE.Quaternion(), mouth: new V3(), tgt: new V3() }));
const _pzF = new V3(), _pzR = new V3(), _pzO = new V3(), _pzD = new V3(), _pzQm = new THREE.Quaternion();
function placesInit(c) {
  const { M, yaw } = G.mech;
  _pzF.set(Math.sin(yaw), 0, Math.cos(yaw));
  _pzR.set(Math.cos(yaw), 0, -Math.sin(yaw));
  _pzO.copy(M).addScaledVector(_pzF, PZ_FRONT);
  mechanism.inner.updateMatrixWorld(true);
  mechanism.inner.getWorldQuaternion(_pzQm);
  for (let i = 0; i < 3; i++) {
    const P = PLACES[i], pt = mechanism.parts[HERO_GEARS[i].id];
    mechanism.inner.localToWorld(P.seat.copy(pt.final.p));
    P.axisW.copy(pt.axis).applyQuaternion(_pzQm).normalize();
    P.q.copy(_pzQm).multiply(pt.final.q);
    P.mouth.copy(P.seat).addScaledVector(P.axisW, (_pzO.dot(_pzF) - P.seat.dot(_pzF)) / Math.max(0.2, P.axisW.dot(_pzF)));
    _pzD.subVectors(P.seat, c);
    P.tgt.copy(c).addScaledVector(_pzD, (_pzO.dot(_pzF) - c.dot(_pzF)) / Math.min(-1e-3, _pzD.dot(_pzF)));
  }
  mechanism.handZ = mechanism.inner.worldToLocal(_pzD.copy(_pzO)).z;
}
const _pzBusy = (w) => (w.state === 'go' && !w.home) || w.state === 'wrong';
const asmWaitsOn = (i) => { const A = mechanism.assembly; return !!A && !!A.waiting && A.heroWaiting === i; };
const placeLit = (i) => i >= 0 && !!G.puzzle && G.puzzle.slot === i && !wheels.some(_pzBusy);
const pzOut = (w) => w.state === 'held' || (w.state === 'go' && !w.home) || w.state === 'wrong' || w.state === 'back' || w.state === 'park';
const pzInWay = (w) => pzOut(w) && !((w.state === 'back' || w.state === 'park') && w.t >= 0.5 * w.T);
const pzWaiting = () => !!wheels && wheels.some((w) => w.state === 'fitted' || w.state === 'park');
function pzCam(out) {
  const { M, yaw } = G.mech, a = yaw + PZ_MARK[0], r = PZ_MARK[1] * FRAME.reach(baseFov + ASM_LENS);
  return out.set(M.x + Math.sin(a) * r, M.y + PZ_MARK[2], M.z + Math.cos(a) * r);
}

const _pzV = new V3(), _pzN = new V3(), _pzC = new V3(), _pzT = new V3();
const _cz = new THREE.Quaternion(), _cq = new THREE.Quaternion(), _cq2 = new THREE.Quaternion(), _cv = new V3(), _cw = new V3();
function startPuzzle(h) {
  const M = G.mech.M;
  pzCam(_pzC);
  placesInit(_pzC);
  const pz = (G.puzzle = { held: null, by: '', hover: -1, hoverW: null, slot: -1, n: 0, cue: false, idle: 0, autoT: 0, nextT: 0, focusP: new V3() });
  G.hintPulse = false;
  pz.focusP.copy(M).addScaledVector(_pzF, 0.55);
  pz.focusP.y -= 0.3;
  for (let k = 0; k < 3; k++) {
    const i = PZ_REST[k][0], w = wheels[i];
    _pzV.copy(M).addScaledVector(_pzR, PZ_REST[k][1]).addScaledVector(_pzF, PZ_REST[k][2]);
    const fl = floorHeight(_pzV.x, _pzV.z);
    _pzN.set(_pzC.x - _pzV.x, 0, _pzC.z - _pzV.z).normalize().multiplyScalar(Math.cos(PZ_LEAN));
    _pzN.y = Math.sin(PZ_LEAN);
    w.restQ.setFromUnitVectors(_aZ, _pzN).multiply(_cz.setFromAxisAngle(_aZ, 0.6 + 2.1 * k));
    const hx = _pzC.x - _pzV.x, hz = _pzC.z - _pzV.z, hl = Math.hypot(hx, hz) || 1, sL = Math.sin(PZ_LEAN), cL = Math.cos(PZ_LEAN);
    const bx = _pzV.x + (hx / hl) * w.rw * sL, bz = _pzV.z + (hz / hl) * w.rw * sL;
    let by = -Infinity;
    for (const f of [-0.7, -0.35, 0, 0.35, 0.7]) {
      const s = f * w.rw, arc = (w.rw - Math.sqrt(w.rw * w.rw - s * s)) * cL;
      by = Math.max(by, floorHeight(bx + (hz / hl) * s, bz - (hx / hl) * s) - arc);
    }
    w.rest.set(_pzV.x, by + 0.02 + w.rw * cL, _pzV.z);
    w.spot.set(_pzV.x, fl - w.rw - 0.05, _pzV.z);
    w.qFlat.setFromAxisAngle(_aUp, Math.random() * 6.283).multiply(_qZY);
    w.k = k; w.state = 'in'; w.t = -0.22 * k; w.arc = false; w.broke = false;
    w.fitted = false; w.home = false; w.carry = false; w.place = -1; w.counted = false; w.sweepT = -1; w.tick = 0; w.hov = 0; w.ang = 0;
    w.u.sw.value = 0; w.u.swK.value = 0; w.u.hov.value = 0; w.u.hint.value = 0;
    if (w.glow) w.glow.value = 0;
    w.mesh.visible = false;
  }
  UI.puzzle(true);
  UI.puzzleHint(touch.mode ? PZ_HINT_TOUCH : PZ_HINT_FINE);
  audio$1.sandPour(0.8);
  pzOpen(h);
}
function pzOpen(h) {
  const pz = G.puzzle;
  pz.slot = h;
  pz.nextT = 0;
  pz.cue = false;
  pz.idle = 0;
  mechanism.sockLit = h;
  guide.event('puzzle');
  G.hintPulse = false;
  if (audio$1.slotCall) audio$1.slotCall(h); else if (pz.n) audio$1.tick(0.5);
}

function updateWheels(dt, t) {
  if (!wheels) return;
  const hint = pzCued();
  for (let i = 0; i < 3; i++) {
    const w = wheels[i];
    if (w.state === 'off') continue;
    w.t += dt;
    if (w.state === 'in') wheelIn(w, dt);
    else if (w.state === 'rest') wheelRest(w, dt);
    else if (w.state === 'held') wheelHeld(w, dt);
    else if (w.state === 'go') wheelGoStep(w);
    else if (w.state === 'fitted') wheelWait(w, t, dt);
    else if (w.state === 'wrong') wheelWrong(w);
    else if (w.state === 'back' || w.state === 'park') wheelBackStep(w, dt);
    wheelHomeDue(w);
    if (w.sweepT >= 0) {
      w.sweepT += dt;
      const s = Math.min(1, w.sweepT / 0.95);
      w.u.sw.value = s;
      w.u.swK.value = 1;
      const n = Math.floor(s * 24);
      if (n > w.tick) { w.tick = n; audio$1.tick(s); }
      if (s >= 1) { w.sweepT = -1; w.counted = true; }
    }
    w.u.hint.value = i === hint && w.state === 'rest' ? 0.22 + 0.18 * Math.sin(t * 4.5) : Math.max(0, w.u.hint.value - dt * 2);
  }
}
function pzCued() {
  const pz = G.puzzle;
  return pz && pz.slot >= 0 && (pz.cue || G.hintPulse) ? pz.slot : -1;
}

function wheelIn(w, dt) {
  if (w.t < 0) return;
  if (!w.arc) {
    w.arc = true;
    w.mesh.visible = true;
    w.b0.copy(w.spot);
    w.b1.copy(w.spot).addScaledVector(_aUp, w.rw * 2.2);
    w.b2.copy(w.rest).addScaledVector(_aUp, 0.3).addScaledVector(_pzF, 0.08);
    w.b3.copy(w.rest);
    w.s = 0;
    w.sv = 1.1;
  }
  const om = 4.6;
  w.sv += (om * om * (1 - w.s) - 2 * om * w.sv) * dt;
  w.s += w.sv * dt;
  bez(w.mesh.position, w.b0, w.b1, w.b2, w.b3, Math.min(1, w.s));
  if (!w.broke && w.mesh.position.y > w.spot.y + w.rw + 0.02) {
    w.broke = true;
    _cv.set(w.spot.x, w.spot.y + w.rw + 0.05, w.spot.z);
    fx.silt(_cv, 12, SILT_OUT);
    fx.grains(_cv, 12, GRAIN_OUT);
  }
  const x = clamp$9(w.s, 0, 1);
  w.mesh.quaternion.copy(w.qFlat).slerp(w.restQ, smoother(x / 0.8)).multiply(_cz.setFromAxisAngle(_aZ, 2.4 * (1 - x) * (1 - x)));
  if (w.glow) w.glow.value = 0.5 * (1 - x);
  if (w.t > 0.9 && 1 - w.s < 0.006 && Math.abs(w.sv) < 0.05) {
    if (w.glow) w.glow.value = 0;
    w.mesh.position.copy(w.rest);
    w.mesh.quaternion.copy(w.restQ);
    _cv.set(w.rest.x, w.rest.y - w.rw * Math.cos(PZ_LEAN), w.rest.z);
    fx.silt(_cv, 5, GRIT_SILT);
    audio$1.tick(0.8);
    w.state = 'rest';
  }
}

function wheelRest(w, dt) {
  const pz = G.puzzle;
  w.hov += ((pz && pz.hoverW === w ? 1 : pzCued() === w.idx ? 0.5 : 0) - w.hov) * (1 - Math.exp(-dt * 10));
  w.mesh.position.copy(w.rest).addScaledVector(_aUp, 0.03 * w.hov);
  w.mesh.quaternion.copy(w.restQ);
  w.u.hov.value = w.hov;
}

function wheelHeld(w, dt) {
  const om = 12;
  _cv.subVectors(w.tgt, w.mesh.position).multiplyScalar(om * om).addScaledVector(w.vel, -2 * om);
  w.vel.addScaledVector(_cv, dt);
  w.mesh.position.addScaledVector(w.vel, dt);
  w.lift = Math.min(1, w.lift + dt / 0.45);
  w.ang += dt * 0.35;
  const k = 1 - Math.exp(-dt * 8);
  w.tipA += (clamp$9(-w.vel.dot(_pzR) * 0.2, -0.28, 0.28) - w.tipA) * k;
  w.tipB += (clamp$9(w.vel.y * 0.2, -0.28, 0.28) - w.tipB) * k;
  _cq.setFromAxisAngle(_aUp, w.tipA).multiply(_cq2.setFromAxisAngle(_pzR, w.tipB)).multiply(_pzQm).multiply(_cz.setFromAxisAngle(_aZ, w.ang));
  w.mesh.quaternion.copy(w.fromQ).slerp(_cq, smoother(w.lift));
  w.hov += (1 - w.hov) * (1 - Math.exp(-dt * 10));
  w.u.hov.value = w.hov;
}

function wheelLift(w, by) {
  const pz = G.puzzle;
  if (w.state === 'in' && w.glow) w.glow.value = 0;
  pz.held = w;
  pz.by = by;
  pz.idle = 0;
  w.state = 'held'; w.t = 0; w.lift = 0; w.tipA = 0; w.tipB = 0;
  w.vel.set(0, 0, 0);
  w.tgt.copy(w.mesh.position);
  w.fromQ.copy(w.mesh.quaternion);
  _cv.set(1, 0, 0).applyQuaternion(w.fromQ).applyQuaternion(_cq.copy(_pzQm).invert());
  w.ang = Math.atan2(_cv.y, _cv.x);
  if (!w.counted && w.sweepT < 0) { w.sweepT = 0; w.tick = 0; }
  _cv.set(w.rest.x, w.rest.y - w.rw * Math.cos(PZ_LEAN), w.rest.z);
  fx.silt(_cv, 5, GRIT_SILT);
  audio$1.tick(0.6);
}

function wheelTry(w, p) {
  if (!placeLit(p)) { wheelBack(w); return; }
  if (p === w.idx) w.fitted = true;
  G.puzzle.idle = 0;
  if (w.fitted && !asmWaitsOn(w.idx)) {
    if (w.state === 'rest') { w.state = 'fitted'; w.t = 0; w.T = 0; }
    else wheelBack(w, true);
    pzTaken(w, false);
    return;
  }
  wheelGo(w, p);
}

function wheelGo(w, p) {
  const P = PLACES[p];
  w.state = 'go'; w.place = p; w.t = 0; w.arc = false;
  w.fromQ.copy(w.mesh.quaternion);
  w.g0 = w.glow ? w.glow.value : 0;
  const d = w.mesh.position.distanceTo(P.mouth);
  w.T = clamp$9(0.25 + d * 0.3, w.home ? 0.5 : 0.3, 0.95);
  w.b0.copy(w.mesh.position);
  if (w.carry) w.b1.copy(w.b0).addScaledVector(w.vel, w.T / 3);
  else w.b1.copy(w.b0).addScaledVector(w.vel, 0.1).addScaledVector(_aUp, Math.min(0.3, d * 0.25));
  w.b2.copy(P.mouth).addScaledVector(P.axisW, Math.min(0.3, d * 0.3));
  w.b3.copy(P.mouth);
  G.flyC = w;
}
const easeFrom = (x) => x + x * x - x * x * x;
function wheelGoStep(w) {
  const P = PLACES[w.place], right = w.place === w.idx;
  const x = clamp$9(w.t / w.T, 0, 1), f = w.carry ? easeFrom(x) : easeInOut$1(x);
  bez(w.mesh.position, w.b0, w.b1, w.b2, w.b3, f);
  w.mesh.quaternion.copy(w.fromQ).slerp(P.q, smoother(f));
  if (right) {
    if (w.glow) w.glow.value = w.home ? lerp$4(w.g0, 1, f) : smoothstep(0.35, 1, f);
    mgTrail(w.trailKey, w.mesh.position, true, HERO_TRAIL);
  }
  if (x < 1) return;
  if (!right) {
    w.state = 'wrong'; w.t = 0; w.knocked = false;
    w.stop.lerpVectors(P.mouth, P.seat, PZ_IN[w.idx][w.place]);
    return;
  }
  mgTrail(w.trailKey, w.mesh.position, false);
  if (!w.home) pzTaken(w, true);
  wheelHand(w);
}

function pzTaken(w, straight) {
  if (audio$1.align) audio$1.align(w.idx); else { audio$1.clack(0.45, 1.6); audio$1.tick(1); }
  mgSeat(w.mesh.position, 0.55, 0.2);
  guide.event('puzzle-right');
  const pz = G.puzzle;
  if (pz) { pz.slot = -1; pz.n++; pz.nextT = straight ? PZ_NEXT[1] : Math.max(PZ_NEXT[0], w.T); mechanism.sockLit = -1; UI.story(''); }
  if (wheels[0].fitted && wheels[1].fitted && wheels[2].fitted) finishPuzzle();
}

const PZ_WAIT_GLOW = 0.55;
function wheelWait(w, t, dt) {
  const k = smoothstep(0, 0.8, w.t);
  w.mesh.position.copy(w.rest);
  w.mesh.quaternion.copy(w.restQ);
  w.hov = Math.max(0, w.hov - 0.05);
  w.u.hov.value = w.hov;
  if (w.glow) w.glow.value += (PZ_WAIT_GLOW * (1 - 0.12 * k * (0.5 + 0.5 * Math.sin(t * 2.1 + w.idx))) - w.glow.value) * (1 - Math.exp(-dt * 8));
}
function wheelHomeDue(w) {
  if ((w.state === 'fitted' || w.state === 'park') && asmWaitsOn(w.idx) && !wheels.some((o) => o !== w && pzOut(o))) wheelHome(w);
}
function wheelHome(w) {
  w.carry = w.state === 'park';
  if (!w.carry) {
    w.vel.set(0, 0, 0);
    _cv.set(w.rest.x, w.rest.y - w.rw * Math.cos(PZ_LEAN), w.rest.z);
    fx.silt(_cv, 5, GRIT_SILT);
    audio$1.tick(0.6);
  }
  w.home = true;
  wheelGo(w, w.idx);
  G.asm.seat = G.puzzle || pzWaiting() ? null : seatMark(w.idx);
}

function wheelHand(w) {
  w.state = 'off';
  w.mesh.visible = false;
  if (w.glow) w.glow.value = 0;
  mgTrail(w.trailKey, w.mesh.position, false);
  if (G.flyC === w) G.flyC = null;
  G.asm.seat = G.puzzle || pzWaiting() ? null : seatMark(w.idx);
  mechanism.placeHero(w.idx, w.mesh.position, w.mesh.quaternion, PLACE_OPTS);
}

const WR = [0.22, 0.5, 0.8];
function wheelWrong(w) {
  const P = PLACES[w.place], T = w.t;
  if (T < WR[0]) {
    const x = T / WR[0];
    w.mesh.position.lerpVectors(P.mouth, w.stop, x * x);
    w.mesh.quaternion.copy(P.q);
    return;
  }
  if (!w.knocked) {
    w.knocked = true;
    if (audio$1.wrong) audio$1.wrong(); else audio$1.clack(0.8, 0.42);
    GRIT_SILT.spread = w.rw * 0.6;
    _cv.copy(w.stop).addScaledVector(_aUp, -w.rw * 0.5);
    fx.silt(_cv, 10, GRIT_SILT);
    fx.grains(_cv, 12, GRIT_GRAIN);
    G.shake = Math.max(G.shake, 0.05);
    G.misses++;
    guide.event('puzzle-wrong');
    if (G.puzzle) { UI.story(PZ_WHY[w.idx][w.place], { ms: 6000 }); G.puzzle.cue = true; }
    if (G.flyC === w) G.flyC = null;
  }
  if (T < WR[1]) {
    const k = 1 - (T - WR[0]) / (WR[1] - WR[0]);
    w.mesh.position.copy(w.stop).addScaledVector(P.axisW, 0.014 * Math.abs(Math.sin(T * 38)) * k).addScaledVector(_pzR, 0.006 * Math.sin(T * 61) * k);
    w.mesh.quaternion.copy(P.q).multiply(_cz.setFromAxisAngle(_aZ, Math.sin(T * 70) * 0.04 * k));
    return;
  }
  if (T < WR[2]) {
    w.mesh.position.lerpVectors(w.stop, P.mouth, easeInOut$1((T - WR[1]) / (WR[2] - WR[1])));
    w.mesh.quaternion.copy(P.q);
    return;
  }
  w.vel.set(0, 0, 0);
  wheelBack(w);
}

function wheelBack(w, lit = false) {
  w.state = lit ? 'park' : 'back'; w.t = 0;
  if (!lit) w.place = -1;
  w.fromQ.copy(w.mesh.quaternion);
  w.g0 = w.glow ? w.glow.value : 0;
  const d = w.mesh.position.distanceTo(w.rest);
  w.T = clamp$9(0.45 + d * 0.3, 0.55, 1.1);
  w.b0.copy(w.mesh.position);
  w.b1.copy(w.b0).addScaledVector(w.vel, 0.1).addScaledVector(_pzF, 0.2);
  w.b2.copy(w.rest).addScaledVector(_aUp, 0.35);
  w.b3.copy(w.rest);
  if (G.flyC === w) G.flyC = null;
}
const _wbP = new V3();
function wheelBackStep(w, dt) {
  const f = easeInOut$1(clamp$9(w.t / w.T, 0, 1)), lit = w.state === 'park';
  _wbP.copy(w.mesh.position);
  bez(w.mesh.position, w.b0, w.b1, w.b2, w.b3, f);
  if (dt > 0) w.vel.subVectors(w.mesh.position, _wbP).divideScalar(dt);
  w.mesh.quaternion.copy(w.fromQ).slerp(w.restQ, smoother(f));
  w.hov = Math.max(0, w.hov - 0.05);
  w.u.hov.value = w.hov;
  if (lit && w.glow) w.glow.value = lerp$4(w.g0, PZ_WAIT_GLOW, smoothstep(0, 0.6, f));
  if (f < 1) return;
  _cv.set(w.rest.x, w.rest.y - w.rw * Math.cos(PZ_LEAN), w.rest.z);
  fx.silt(_cv, 6, GRIT_SILT);
  audio$1.tick(0.6);
  w.vel.set(0, 0, 0);
  w.state = lit ? 'fitted' : 'rest';
  w.t = 0;
}

function seatMark(idx) {
  const { M, yaw } = G.mech;
  const pt = mechanism.parts[HERO_GEARS[idx].id];
  const w = mechanism.inner.localToWorld(_cw.copy(pt.final.p));
  const lx = (w.x - M.x) * Math.cos(yaw) - (w.z - M.z) * Math.sin(yaw);
  return [PZ_MARK[0] * 0.5, 3.5, 0.3, w.y - M.y + 0.1, lx * 0.85];
}

function finishPuzzle() {
  if (G.puzzle) G.asm.pzFocus = G.puzzle.focusP;
  G.puzzle = null;
  G.asm.pzDone = true;
  mechanism.sockFocus = -1;
  mechanism.sockLit = -1;
  UI.puzzle(false);
  UI.puzzleLabels(LBL_NONE);
  UI.story('');
  UI.puzzleHint('');
  canvas.style.cursor = '';
}

const wheelReady = (w) => w.state === 'rest' || (w.state === 'in' && w.broke && w.s > 0.5);
const _pc = new V3(), _pr = new V3(), _camR = new V3();
function wheelAt(ndc, slack, minPx = 0) {
  _camR.set(1, 0, 0).applyQuaternion(camera.quaternion);
  const [vw, vh] = viewSize(), minN = (2 * minPx) / vh;
  let best = null, bd = Infinity;
  for (let i = 0; i < 3; i++) {
    const w = wheels[i];
    if (!wheelReady(w)) continue;
    _pc.copy(w.mesh.position).project(camera);
    _pr.copy(w.mesh.position).addScaledVector(_camR, w.rw).project(camera);
    const rN = Math.abs(_pr.x - _pc.x) * camera.aspect;
    if (minPx) { _pc.x = clamp$9(_pc.x, -1 + 48 / vw, 1 - 48 / vw); _pc.y = clamp$9(_pc.y, -1 + 48 / vh, 1 - 48 / vh); }
    const d = Math.hypot((ndc.x - _pc.x) * camera.aspect, ndc.y - _pc.y);
    if (d < Math.max(rN * slack, minN) && d < bd) { bd = d; best = w; }
  }
  return best;
}
const _rayD = new V3();
function planeHit(x, y, out) {
  _rayD.set(x, y, 0.5).unproject(camera).sub(camera.position).normalize();
  const dn = _rayD.dot(_pzF);
  if (dn > -0.05) return false;
  return !!out.copy(camera.position).addScaledVector(_rayD, (_pzO.dot(_pzF) - camera.position.dot(_pzF)) / dn);
}
function placeAt(x, y, cur, minPx = 0) {
  const i = G.puzzle ? G.puzzle.slot : -1;
  if (!placeLit(i)) return -1;
  _camR.set(1, 0, 0).applyQuaternion(camera.quaternion);
  const P = PLACES[i];
  _pc.copy(P.seat).project(camera);
  _pr.copy(P.seat).addScaledVector(_camR, wheels[i].rw).project(camera);
  const rN = Math.max(0.14, 1.3 * Math.abs(_pr.x - _pc.x) * camera.aspect, (2 * minPx) / viewSize()[1]);
  const d = Math.hypot((x - _pc.x) * camera.aspect, y - _pc.y) - (i === cur ? 0.04 : 0);
  return d < rN ? i : -1;
}

const _lp = new V3(), _camUp = new V3();
const _pzFl = { h: 0, lh: 0 };
function pzCountFloor(H) {
  if (_pzFl.h !== H) {
    const el = document.querySelector('#puzzle .pz-label.on:not(.pz-place)');
    _pzFl.lh = el && el.textContent ? el.offsetHeight : 0;
    if (!_pzFl.lh) return H;
    _pzFl.h = H;
  }
  const lh = _pzFl.lh, hint = document.getElementById('pzHint'), r = hint ? hint.getBoundingClientRect() : null;
  const top = r && r.top > H / 2 ? r.bottom - Math.max(r.height, lh) : H;
  return Math.min(H, top) - lh - 6;
}
function puzzleStep(dt) {
  const pz = G.puzzle;
  if (pz.nextT > 0 && (pz.nextT -= dt) <= 0) {
    const h = PZ_ORDER.find((i) => !wheels[i].fitted), A = mechanism.assembly;
    if (h !== undefined && pz.slot !== h && A && A.waiting && A.heroWaiting === h) pzOpen(h);
  }
  if (pz.slot >= 0) pz.idle += dt;
  if (pz.idle > PZ_CUE) pz.cue = true;
  for (let j = 0; j < pzAsk.length; j += 2) {
    const a = wheels[pzAsk[j]], p = pzAsk[j + 1] < 0 ? pz.slot : pzAsk[j + 1];
    if (!a || a.fitted || p > 2 || (p >= 0 && wheels[p].fitted)) { pzAsk.splice(j, 2); j -= 2; }
    else if (a.state === 'rest' && placeLit(p)) { pzAsk.splice(j, 2); wheelTry(a, p); break; }
  }
  const w = pz.held;
  let hov = -1;
  if (w) {
    if (pz.by === 'key') {
      hov = placeLit(pz.slot) ? pz.slot : -1;
      if (hov >= 0) w.tgt.copy(PLACES[hov].tgt);
    } else if (planeHit(ptr.ndc.x, ptr.ndc.y + (ptr.type === 'mouse' ? 0 : touch.lift(60)), _pzT)) {
      _pzV.subVectors(_pzT, _pzO);
      _pzT.copy(_pzO).addScaledVector(_pzR, clamp$9(_pzV.dot(_pzR), -1.7, 1.7));
      _pzT.y = clamp$9(_pzO.y + _pzV.y, floorHeight(_pzT.x, _pzT.z) + w.rw + 0.06, _pzO.y + 1.25);
      hov = placeAt(ptr.ndc.x, ptr.ndc.y + (ptr.type === 'mouse' ? 0 : touch.lift(60)), pz.hover, ptr.type === 'mouse' ? 0 : 48);
      if (hov >= 0) _pzT.lerp(PLACES[hov].tgt, 0.75 * (1 - smoothstep(0.04, 0.36, _pzT.distanceTo(PLACES[hov].tgt))));
      w.tgt.copy(_pzT);
    } else hov = pz.hover;
    pz.hoverW = null;
  } else pz.hoverW = ptr.seen && ptr.type === 'mouse' && G.lastInput !== 'key' ? wheelAt(ptr.ndc, 1.05) : null;
  if (hov !== pz.hover) {
    pz.hover = hov;
    if (hov >= 0) audio$1.tick(0.35);
  }
  mechanism.sockFocus = hov;
  const cur = w ? 'grabbing' : pz.hoverW ? 'grab' : 'default';
  if (canvas.style.cursor !== cur) canvas.style.cursor = cur;
  if (pz.hoverW) {
    pz.idle = 0;
    if (!pz.hoverW.counted && pz.hoverW.sweepT < 0) { pz.hoverW.sweepT = 0; pz.hoverW.tick = 0; }
  }
  if (pz.idle > 6 && !w) {
    pz.autoT -= dt;
    if (pz.autoT <= 0) {
      pz.autoT = 0.5;
      for (let k = 0; k < 3; k++) {
        const c = wheels[PZ_REST[k][0]];
        if (c.state === 'rest' && !c.counted && c.sweepT < 0) { c.sweepT = 0; c.tick = 0; break; }
      }
    }
  }
  const W = canvas.clientWidth || window.innerWidth, H = canvas.clientHeight || window.innerHeight, yMax = pzCountFloor(H);
  _camUp.set(0, 1, 0).applyQuaternion(camera.quaternion);
  for (let i = 0; i < 3; i++) {
    const c = wheels[i], L = LBL[c.k];
    if (!(c.state === 'rest' || c.state === 'held' || c.state === 'back') || (!c.counted && c.sweepT < 0)) { L.x = NaN; continue; }
    _lp.copy(c.mesh.position).addScaledVector(_camUp, -(c.rw + 0.04)).project(camera);
    L.x = (_lp.x * 0.5 + 0.5) * W;
    L.y = Math.min((-_lp.y * 0.5 + 0.5) * H, yMax);
    L.text = c.counted ? c.label : NUMS[Math.min(NUMS.length - 1, Math.round(c.u.sw.value * c.N))];
  }
  for (let i = 0; i < 3; i++) {
    const L = LBL[3 + i];
    if (i !== pz.slot) { L.x = NaN; continue; }
    _lp.copy(PLACES[i].seat).addScaledVector(_camUp, wheels[i].rw + 0.04).project(camera);
    L.x = (_lp.x * 0.5 + 0.5) * W;
    L.y = (-_lp.y * 0.5 + 0.5) * H;
    L.text = PLACE_NAME[i];
  }
  UI.puzzleLabels(LBL);
}

function puzzleDown(e) {
  const pz = G.puzzle;
  if (!pz || pz.held) return;
  const w = wheelAt(ptr.ndc, e.pointerType === 'mouse' ? 1.05 : 1.25, e.pointerType === 'mouse' ? 0 : 36);
  if (!w) return;
  G.lastInput = e.pointerType === 'mouse' ? 'mouse' : 'touch';
  wheelLift(w, 'ptr');
}
function puzzleUp(cancel = false) {
  const pz = G.puzzle;
  if (!pz || !pz.held || pz.by !== 'ptr') return;
  const w = pz.held;
  pz.held = null;
  if (pz.hover >= 0 && !cancel) wheelTry(w, pz.hover); else wheelBack(w);
  pz.hover = -1;
}

function puzzleKey(e) {
  const pz = G.puzzle;
  const c = e.code;
  const k = c === 'Digit1' || c === 'Numpad1' ? 0 : c === 'Digit2' || c === 'Numpad2' ? 1 : c === 'Digit3' || c === 'Numpad3' ? 2 : -1;
  if (k >= 0) {
    const w = wheels[PZ_REST[k][0]];
    e.preventDefault();
    if (!wheelReady(w) || (pz.held && pz.by === 'ptr')) return;
    G.lastInput = 'key';
    if (pz.held) { const h = pz.held; pz.held = null; wheelBack(h); }
    wheelLift(w, 'key');
    return;
  }
  if (c === 'Enter' || c === 'Space') {
    e.preventDefault();
    if (pz.held && pz.by === 'key' && placeLit(pz.slot)) { const w = pz.held; pz.held = null; wheelTry(w, pz.slot); }
    return;
  }
  if (c === 'Escape' && pz.held && pz.by === 'key') { const w = pz.held; pz.held = null; wheelBack(w); }
}

const _gCtx = { state: 'assemble', puzzle: 0, puzzleHint: '' };
const ASM_SETTLE = 0.5;
function updateAssemble(dt, t) {
  const S = G.asm, A = mechanism.assembly;
  S.t += dt;
  S.T += dt;
  if (G.dw) mechanism.setAvoid(G.dw.p, A && A.step <= 0 ? ASM_CLEAR0 : DW_R + 0.5);
  mechanism.holdArrivals = !!wheels && wheels.some(pzInWay);
  const done = mechanism.updateAssembly(dt * ASM_SPEED, t);
  updateTrails();
  const PL = mechanism.partList;
  let seated = 0;
  for (let i = 0; i < PL.length; i++) if (PL[i].state === 'seated') seated++;
  const frac = seated / Math.max(1, PL.length);
  mgCharge(0.15 + 0.6 * frac);
  if (G.site && G.site.wall && fragments.pileGone()) siteUnwall();
  const Sw = G.site;
  if (!S.walkIn && A && G.dw && !G.dw.arrived && Sw && Sw.round && Sw.round.length && !Sw.far && mechanism.seated('dialSet') && !dwSeen(G.dw.p) && !dwSeen(Sw.watch)) {
    G.dw.p.copy(Sw.watch);
    G.dw.v.set(0, 0, 0);
    G.dw.path.length = 0;
    G.dw.arrived = true;
    G.dw.arrT = 0;
  }
  if (!S.walkIn && A && G.dw && G.dw.arrived && diver$1 && mechanism.seated('dialSet')) {
    if (!S.stand) { S.stand = crankStand(true); S.way = crankPath(S.stand); S.walkT = routeLen(S.way, G.dw.p) / CK_WALK + 2.4; }
    const left = mechanism.assemblyLeft() / ASM_SPEED + ASM_SETTLE;
    if (A.done || left <= S.walkT) { S.walkIn = true; G.ckStand = S.stand; crankWalk(S.way); }
  }
  asmDiver(dt, t);
  if (S.rock >= 0) {
    S.rock += dt;
    const x = Math.min(1, S.rock / 1.6), s = Math.sin(Math.PI * x);
    mechanism.setMonths(0.5 * s * s);
    audio$1.rock?.(x);
    if (x >= 1) S.rock = -1;
  }
  if (S.pending !== undefined && S.rig && pzClear()) { const h = S.pending; S.pending = undefined; startPuzzle(h); }
  const pz = G.puzzle;
  asmMark();
  rigStep(dt, S.T < 3 ? 2.0 : pz ? 1.3 : 1.6);
  rigApply(t);
  camClearOf(camera.position);
  lensStep(dt);
  updateWheels(dt, t);
  if (G.puzzle) puzzleStep(dt);
  _gCtx.puzzle = G.puzzle ? 1 : 0;
  const gf = guide.update(dt, _gCtx);
  G.hintPulse = !!(G.puzzle && gf.pulse);
  glowTo(0.35 + 0.55 * frac, GLOW_ASM, dt, 1.2);
  let fd = camera.position.distanceTo(_aim), ap = 0.2;
  if (G.flyC) { fd = camera.position.distanceTo(G.flyC.mesh.position); ap = 0.18; }
  else if (G.puzzle) { fd = camera.position.distanceTo(G.puzzle.held ? G.puzzle.held.mesh.position : G.puzzle.focusP); ap = 0.1; }
  else if (S.pzFocus && pzWaiting()) { fd = camera.position.distanceTo(S.pzFocus); ap = 0.1; }
  post.setDof(fd, Math.max(GO_AP * (1 - smoothstep(0, 1.2, S.T)), ap * smoothstep(0.2, 1.8, S.T)), dt);
  breathe(dt);
  if (done && !G.puzzle) {
    G.settleT += dt;
    const near = !S.walkIn || !G.dw || G.dw.arrived || dwLeft() < 0.4;
    if (G.settleT > ASM_SETTLE && (near || G.settleT > 6)) setState('crank');
  }
}

const DEG$3 = Math.PI / 180;
const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const dirAzEl = (az, el, out) => out.set(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el));
const SUN_AZ_SET = Math.atan2(SUN_TITLE.x, -SUN_TITLE.z);
const SUN_EL_DAY = Math.asin(SUN_TITLE.y);
const SUN_AZ_RISE = 85 * DEG$3;
const MOON_AZ = 133 * DEG$3, MOON_EL = 15 * DEG$3;
const MOON_DIR = dirAzEl(MOON_AZ, MOON_EL, new V3());
const BREACH_AZ = MOON_AZ - 8 * DEG$3;
const BREACH_LOOK = dirAzEl(BREACH_AZ, 13 * DEG$3, new V3());
function setSun(az, el) { dirAzEl(az, el, sunDir); }

const MOON_W = refracted(MOON_DIR, new V3());
const SITE_PILE = 2.6;
const SITE_LAY = {
  R: { pile: 120, watch: [70, 5.0], round: [], phi: [40, 100], pen: 0, aim: 0.4 },
  L: { pile: -120, watch: [70, 5.0], round: [[-40, 5.5], [-30, 7.2], [15, 7.0], [55, 6.2]], phi: [-100, -40], pen: 0.25, aim: 0.1 },
};
const SITE_YAW = Math.PI - MOON_AZ;
const SITE_R = [4, 9];
const SITE_DP = [4, 7, 5];
const SITE_FACE = 30 * DEG$3;
const SITE_ARRIVE = 2.0;
const SITE_KEEP = 6;
const SITE_GRID = 0.25;
const SITE_CAMS = [[29, 5.4], [23, 4.9], [19, 4.4], [6, 3.6], [0, 3.6], [-11, 3.7], [-25, 3.6], [15, 4.5], [27, 5.2], [35, 3.0], [110, 3.2]];
const ORR_LIFT = 1.3, ORR_SUN = 0.30 + 3 * 0.113;
const SITE_WHEELS = [[-0.95, 1.08], [0, 0.95], [0.95, 1.08]];
const SITE_CANDS = [[null, null, null], [null, null, null], [null, null, null]];
const SCLR = { x0: 0, z0: 0, nx: 0, nz: 0, d: null, c: null, h: null, w: null };
const SITE_WRECK_UP = 0.08;
function siteBake() {
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const it of fragments.items) {
    const h = it.home;
    x0 = Math.min(x0, h.x - 14); x1 = Math.max(x1, h.x + 14); z0 = Math.min(z0, h.z - 14); z1 = Math.max(z1, h.z + 14);
  }
  x0 = Math.min(x0, LAYOUT.assembly.x - 6); x1 = Math.max(x1, LAYOUT.assembly.x + 6); z0 = Math.min(z0, LAYOUT.assembly.z - 6); z1 = Math.max(z1, LAYOUT.assembly.z + 6);
  const g = SITE_GRID, nx = Math.ceil((x1 - x0) / g) + 1, nz = Math.ceil((z1 - z0) / g) + 1;
  const d = new Float32Array(nx * nz), dc = new Float32Array(nx * nz), hh = new Float32Array(nx * nz), amph = (wreck && wreck.amphorae) || [];
  const wk = siteWreck(x0, z0, nx, nz), solid = [];
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const x = x0 + i * g, z = z0 + j * g, fl = floorHeight(x, z);
    hh[j * nx + i] = fl;
    const up = wk[j * nx + i] - fl;
    if (up > SITE_WRECK_UP) solid.push(i, j, up > 0.8 ? 1 : 0);
    let e0 = 9, e1 = 9;
    for (let k = 0; k < obstacles.length; k++) {
      const o = obstacles[k], e = Math.hypot(x - o.x, z - o.z) - o.r;
      if (e > e0 && e > e1) continue;
      if (o.y + o.r > fl - 0.3 && o.y - o.r < fl + 4) e0 = Math.min(e0, e);
      if (o.y + o.r > fl + 0.8 && o.y - o.r < fl + 3) e1 = Math.min(e1, e);
    }
    for (let k = 0; k < capsules.length; k++) {
      const c = capsules[k], lo = Math.min(c.ay, c.by) - c.r, hi = Math.max(c.ay, c.by) + c.r;
      if (hi < fl - 0.3 || lo > fl + 4) continue;
      const abx = c.bx - c.ax, abz = c.bz - c.az, l2 = abx * abx + abz * abz;
      const h = l2 > 1e-6 ? clamp$9(((x - c.ax) * abx + (z - c.az) * abz) / l2, 0, 1) : 0;
      const e = Math.hypot(x - c.ax - abx * h, z - c.az - abz * h) - c.r;
      e0 = Math.min(e0, e);
      if (hi > fl + 0.8 && lo < fl + 3) e1 = Math.min(e1, e);
    }
    for (let k = 0; k < amph.length; k++) e0 = Math.min(e0, Math.hypot(x - amph[k].position.x, z - amph[k].position.z) - 0.32);
    d[j * nx + i] = e0;
    dc[j * nx + i] = e1;
  }
  const R = Math.ceil(1.5 / g), dw = new Float32Array(nx * nz).fill(9);
  for (let s = 0; s < solid.length; s += 3) {
    const si = solid[s], sj = solid[s + 1], tall = solid[s + 2];
    for (let j = Math.max(0, sj - R); j <= Math.min(nz - 1, sj + R); j++) for (let i = Math.max(0, si - R); i <= Math.min(nx - 1, si + R); i++) {
      const e = Math.max(0, Math.hypot(i - si, j - sj) * g - g / 2), k = j * nx + i;
      if (e < d[k]) d[k] = e;
      if (e < dw[k]) dw[k] = e;
      if (tall && e < dc[k]) dc[k] = e;
    }
  }
  Object.assign(SCLR, { x0, z0, nx, nz, d, c: dc, h: hh, w: dw });
}
function siteWreck(x0, z0, nx, nz) {
  const top = new Float32Array(nx * nz).fill(-1e9), g = SITE_GRID;
  if (!wreck || !wreck.group) return top;
  wreck.group.updateMatrixWorld(true);
  const mark = (x, y, z) => {
    const i = Math.round((x - x0) / g), j = Math.round((z - z0) / g);
    if (i >= 0 && j >= 0 && i < nx && j < nz && y > top[j * nx + i]) top[j * nx + i] = y;
  };
  const x1 = x0 + (nx - 1) * g, z1 = z0 + (nz - 1) * g, _p = new V3();
  wreck.group.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || !o.material || Array.isArray(o.material)) return;
    const key = o.material.customProgramCacheKey ? String(o.material.customProgramCacheKey()) : '';
    if (!/^(wk-(wood|misc|bronze|marble|life|sponge)|wld2-terrain)/.test(key)) return;
    const pos = o.geometry.attributes.position, I = o.geometry.index ? o.geometry.index.array : null;
    const P = new Float32Array(pos.count * 3);
    for (let v = 0; v < pos.count; v++) { _p.fromBufferAttribute(pos, v).applyMatrix4(o.matrixWorld); P[v * 3] = _p.x; P[v * 3 + 1] = _p.y; P[v * 3 + 2] = _p.z; }
    const nt = I ? I.length / 3 : pos.count / 3;
    for (let t = 0; t < nt; t++) {
      const a = (I ? I[t * 3] : t * 3) * 3, b = (I ? I[t * 3 + 1] : t * 3 + 1) * 3, c = (I ? I[t * 3 + 2] : t * 3 + 2) * 3;
      const ax = P[a], ay = P[a + 1], az = P[a + 2], bx = P[b], by = P[b + 1], bz = P[b + 2], cx = P[c], cy = P[c + 1], cz = P[c + 2];
      if ((bz - az) * (cx - ax) - (bx - ax) * (cz - az) <= 0) continue;
      const mx = Math.min(ax, bx, cx), Mx = Math.max(ax, bx, cx), mz = Math.min(az, bz, cz), Mz = Math.max(az, bz, cz);
      if (Mx < x0 || mx > x1 || Mz < z0 || mz > z1) continue;
      mark(ax, ay, az); mark(bx, by, bz); mark(cx, cy, cz);
      const i0 = Math.ceil((mx - x0) / g), i1 = Math.floor((Mx - x0) / g), j0 = Math.ceil((mz - z0) / g), j1 = Math.floor((Mz - z0) / g);
      const den = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
      if (i1 < i0 || j1 < j0 || Math.abs(den) < 1e-10) continue;
      for (let i = Math.max(0, i0); i <= Math.min(nx - 1, i1); i++) for (let j = Math.max(0, j0); j <= Math.min(nz - 1, j1); j++) {
        const x = x0 + i * g, z = z0 + j * g;
        const w1 = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / den, w2 = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / den, w3 = 1 - w1 - w2;
        if (w1 < -1e-4 || w2 < -1e-4 || w3 < -1e-4) continue;
        const y = w1 * ay + w2 * by + w3 * cy, k = j * nx + i;
        if (y > top[k]) top[k] = y;
      }
    }
  });
  return top;
}
function siteFloor(x, z) {
  const fx = clamp$9((x - SCLR.x0) / SITE_GRID, 0, SCLR.nx - 1.001), fz = clamp$9((z - SCLR.z0) / SITE_GRID, 0, SCLR.nz - 1.001);
  const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j, H = SCLR.h, k = j * SCLR.nx + i;
  return (H[k] * (1 - u) + H[k + 1] * u) * (1 - v) + (H[k + SCLR.nx] * (1 - u) + H[k + SCLR.nx + 1] * u) * v;
}
function siteClear(x, z, cam = false, F = cam ? SCLR.c : SCLR.d) {
  const i = Math.round((x - SCLR.x0) / SITE_GRID), j = Math.round((z - SCLR.z0) / SITE_GRID);
  return i < 0 || j < 0 || i >= SCLR.nx || j >= SCLR.nz ? -1 : F[j * SCLR.nx + i];
}
const SITE_STAND = new V3(1.25, 0, 0.25);
function siteStand() {
  if (diver$1 && mechanism.crankKnobWorld) mcoords(crankStand(true).p, SITE_STAND);
}
function siteRoom(x, z) {
  const fl = floorHeight(x, z), amph = (wreck && wreck.amphorae) || [];
  let e = siteClear(x, z, false, SCLR.w) - DW_R - SITE_GRID * 0.71;
  for (let k = 0; k < obstacles.length; k++) {
    const o = obstacles[k];
    if (o.y + o.r < fl + 0.3 || o.y - o.r > fl + 1.9) continue;
    e = Math.min(e, Math.hypot(x - o.x, z - o.z) - o.r - DW_R - 0.12);
  }
  for (let k = 0; k < capsules.length; k++) {
    const c = capsules[k];
    if (Math.max(c.ay, c.by) + c.r < fl + 0.3 || Math.min(c.ay, c.by) - c.r > fl + 1.9) continue;
    const abx = c.bx - c.ax, abz = c.bz - c.az, l2 = abx * abx + abz * abz;
    const h = l2 > 1e-6 ? clamp$9(((x - c.ax) * abx + (z - c.az) * abz) / l2, 0, 1) : 0;
    e = Math.min(e, Math.hypot(x - c.ax - abx * h, z - c.az - abz * h) - c.r - DW_R - 0.05);
  }
  for (let k = 0; k < amph.length; k++) e = Math.min(e, Math.hypot(x - amph[k].position.x, z - amph[k].position.z) - 0.32 - DW_R);
  return e;
}
const _swA = new V3(), _swB = new V3();
function siteWalk(M, yaw, round, W) {
  const st = sframe(M, yaw, SITE_STAND.x, SITE_STAND.z, new V3());
  if (siteRoom(st.x, st.z) < 0) return false;
  const way = [...round, W, st];
  for (let s = 0; s < way.length - 1; s++) {
    _swA.copy(way[s]); _swB.copy(way[s + 1]);
    const n = Math.ceil(Math.hypot(_swB.x - _swA.x, _swB.z - _swA.z) / 0.25);
    for (let k = 1; k < n; k++) if (siteRoom(lerp$4(_swA.x, _swB.x, k / n), lerp$4(_swA.z, _swB.z, k / n)) < -0.08) return false;
  }
  return true;
}
function sframe(M, yaw, x, z, out) { const c = Math.cos(yaw), s = Math.sin(yaw); return out.set(M.x + c * x + s * z, 0, M.z - s * x + c * z); }
const spol = (deg, r) => [r * Math.sin(deg * DEG$3), r * Math.cos(deg * DEG$3)];
const _svC = new V3(), _svT = new V3(), _svN = new V3(), _svU = new V3();
function siteVantage(M, out, E, n = null) {
  _svC.set(M.x, M.y + G.mech.size.y / 2 + ORR_LIFT, M.z);
  out.copy(_svC).addScaledVector(MOON_W, -3.4);
  for (let k = 0; k < 4; k++) {
    _svT.subVectors(out, _svC).normalize();
    _svN.copy(_svT);
    _svN.y -= 1.5 * clamp$9(1 - _svT.y * 3, 0, 1);
    _svN.normalize();
    _svU.copy(_svT).addScaledVector(_svN, -_svT.dot(_svN)).normalize();
    E.copy(_svC).addScaledVector(_svU, ORR_SUN);
    out.copy(E).addScaledVector(MOON_W, -3.4);
  }
  if (n) n.copy(_svN);
  return out;
}
const siteRound = (M, yaw, Lay) => Lay.round.map(([d, r]) => { const [x, z] = spol(d, r); return sframe(M, yaw, x, z, new V3()); });
function siteOf(M, yaw, lay, score = 0) {
  const Lay = SITE_LAY[lay], pp = spol(Lay.pile, SITE_PILE), ww = spol(Lay.watch[0], Lay.watch[1]);
  const c = { lay, yaw, score, M: M.clone(), pile: sframe(M, yaw, pp[0], pp[1], new V3()), watch: sframe(M, yaw, ww[0], ww[1], new V3()), round: siteRound(M, yaw, Lay), vantage: new V3(), E: new V3() };
  if (!c.M.y) c.M.y = floorHeight(M.x, M.z) - 0.05 - G.mechBase;
  siteVantage(c.M, c.vantage, c.E);
  return c;
}
function siteFor(H, F, others) {
  const appr = Math.atan2(H.x - F.x, -(H.z - F.z)), all = [], surf = surfacePoint();
  const M = new V3(), P = new V3(), W = new V3(), V = new V3(), E = new V3(), q = new V3();
  const run = (dpLo, dpHi, faceK) => {
    for (const key of ['R', 'L']) {
      const Lay = SITE_LAY[key], pp = spol(Lay.pile, SITE_PILE), ww = spol(Lay.watch[0], Lay.watch[1]);
      for (let yd = -35; yd <= 35; yd += 5) {
        const yaw = SITE_YAW + yd * DEG$3, c = Math.cos(yaw), s = Math.sin(yaw);
        for (let ph = Lay.phi[0]; ph <= Lay.phi[1]; ph += 5) {
          for (let r = SITE_R[0]; r <= SITE_R[1] + 1e-6; r += 0.5) {
            const hx = r * Math.sin(ph * DEG$3), hz = r * Math.cos(ph * DEG$3);
            M.set(H.x - (c * hx + s * hz), 0, H.z - (-s * hx + c * hz));
            sframe(M, yaw, pp[0], pp[1], P);
            const dP = Math.hypot(P.x - H.x, P.z - H.z);
            if (dP < dpLo || dP > dpHi) continue;
            if (others.some((o) => Math.hypot(M.x - o.x, M.z - o.z) < 3.5 || Math.hypot(P.x - o.x, P.z - o.z) < 2.5)) continue;
            let ok = true, lo = Infinity, hi = -Infinity;
            for (let a = -1; a <= 1.001 && ok; a += 0.25) for (let b = -0.75; b <= 0.751; b += 0.25) {
              sframe(M, yaw, a, b, q);
              if (siteClear(q.x, q.z) < 0.35) { ok = false; break; }
              const h = siteFloor(q.x, q.z);
              lo = Math.min(lo, h); hi = Math.max(hi, h);
            }
            if (!ok || hi - lo > 0.3) continue;
            for (const w of SITE_WHEELS) { sframe(M, yaw, w[0], w[1], q); if (siteClear(q.x, q.z) < 0.5) ok = false; }
            if (!ok || siteClear(P.x, P.z) < 0.95) continue;
            sframe(M, yaw, ww[0], ww[1], W);
            if (siteClear(W.x, W.z) < 0.5 || siteClear(sframe(M, yaw, SITE_STAND.x, SITE_STAND.z, q).x, q.z) < 0.3) continue;
            if (Lay.round.some(([d, r]) => { const [x, z] = spol(d, r); sframe(M, yaw, x, z, q); return siteClear(q.x, q.z) < 0.5; })) continue;
            M.y = lo - 0.05 - G.mechBase;
            siteVantage(M, V, E);
            if (siteClear(V.x, V.z, true) < 0.8) continue;
            let camc = 9;
            for (const k of SITE_CAMS) { const [x, z] = spol(k[0], k[1]); sframe(M, yaw, x, z, q); camc = Math.min(camc, siteClear(q.x, q.z, true)); }
            const face = Math.abs(wrapA(Math.atan2(P.x - H.x, -(P.z - H.z)) - appr));
            const lat = Math.hypot(V.x - surf.x, V.z - surf.z);
            const score = 0.05 * lat + 0.9 * Math.abs(dP - SITE_DP[2]) + 2 * Math.max(0, 1 - camc) + 1.2 * (hi - lo) + faceK * Math.max(0, (face - SITE_FACE) / DEG$3) + Lay.pen;
            all.push({ lay: key, yaw, score, M: M.clone(), pile: P.clone(), watch: W.clone(), round: siteRound(M, yaw, Lay), vantage: V.clone(), E: E.clone() });
          }
        }
      }
    }
  };
  run(SITE_DP[0], SITE_DP[1], 0.04);
  if (!all.length) run(3.5, 8, 0);
  if (!all.length) return [siteOf(new V3(LAYOUT.assembly.x, 0, LAYOUT.assembly.z), SITE_YAW, 'R')];
  all.sort((a, b) => a.score - b.score);
  const out = [];
  for (const c of all) {
    if (out.every((o) => o.M.distanceTo(c.M) >= 1.5) && siteWalk(c.M, c.yaw, c.round, c.watch)) out.push(c);
    if (out.length === SITE_KEEP) break;
  }
  if (!out.length) out.push(all[0]);
  return out;
}
function siteChoose(last, from) {
  if (last < 0 || from < 0 || last === from) return;
  const cands = SITE_CANDS[last] && SITE_CANDS[last][from];
  if (!cands || !cands.length) return;
  siteClearUp();
  G.site = { cands, placed: false, last, from };
}
const _snP = new V3(), _snR = new V3();
function discOut(c, r) {
  if (c.distanceTo(camera.position) > 25) return true;
  _snR.set(1, 0, 0).applyQuaternion(camera.quaternion).setY(0).normalize();
  const fl = floorHeight(c.x, c.z);
  for (let k = -1; k <= 1; k++) for (let h = 0; h <= 1; h++) {
    _snP.set(c.x + _snR.x * r * k, fl + 1.5 * h, c.z + _snR.z * r * k).project(camera);
    if (_snP.z < 1 && Math.abs(_snP.x) < 1.1 && Math.abs(_snP.y) < 1.1) return false;
  }
  return true;
}
function siteNow(force = false) {
  const S = G.site;
  if (!S || S.placed) return;
  let pick = S.cands.find((c) => discOut(c.M, 2.3) && discOut(c.pile, 1.2) && discOut(c.watch, 0.7));
  if (!pick && force) pick = S.cands.find((c) => discOut(c.pile, 1.2)) || S.cands[0];
  if (pick) sitePlace(pick);
}
const SITE_FOOT = [[0, 0], [-0.85, -0.6], [0.85, -0.6], [-0.85, 0.6], [0.85, 0.6]];
const _spQ = new V3();
function siteApply(c) {
  const M = G.mech.M;
  let lo = Infinity;
  for (const [x, z] of SITE_FOOT) { sframe(c.M, c.yaw, x, z, _spQ); lo = Math.min(lo, floorHeight(_spQ.x, _spQ.z)); }
  M.set(c.M.x, lo - 0.05 - G.mechBase, c.M.z);
  G.mech.yaw = c.yaw;
  mechanism.place(M, c.yaw);
  const V = new V3(), E = new V3(), n = new V3();
  siteVantage(M, V, E, n);
  const S = G.site || (G.site = {});
  Object.assign(S, { placed: true, M, yaw: c.yaw, lay: c.lay, pile: c.pile.clone(), watch: c.watch.clone(), round: (c.round || []).map((p) => p.clone()), vantage: V, E, nV: n, hintT: 0, best: Infinity, stall: 0 });
  for (const p of [S.watch, ...S.round]) p.y = floorHeight(p.x, p.z) + DW_UP;
  S.tgt = { item: { home: new V3(c.pile.x, floorHeight(c.pile.x, c.pile.z) + 0.2, c.pile.z) }, dist: 0 };
  return S;
}
function sitePlace(c) {
  const S = siteApply(c);
  fragments.placePile(c);
  S.tgt.item.home.y = fragments.pileTop;
  siteScatter(S.M, S.pile, S.watch);
  S.wall = { x: S.pile.x, y: floorHeight(S.pile.x, S.pile.z), z: S.pile.z, r: 0.95, wall: true };
  obstacles.push(S.wall);
  player.setWall(S.wall, true);
  if (critters$1 && critters$1.keepOut) { critters$1.keepOut(S.M.x, S.M.z, 2.6); critters$1.keepOut(S.pile.x, S.pile.z, 1.3); }
}
function siteUnwall() {
  const S = G.site;
  if (!S || !S.wall) return;
  const k = obstacles.indexOf(S.wall);
  if (k >= 0) obstacles.splice(k, 1);
  player.setWall(S.wall, false);
  S.wall = null;
}
function siteClearUp() {
  siteUnwall();
  G.site = null;
}
const _ssM = new THREE.Matrix4(), _ssP = new V3(), _ssZ = new THREE.Matrix4().makeScale(0, 0, 0);
function siteScatter(M, pile, watch) {
  let n = 0;
  scene.traverse((o) => {
    if (!o.isInstancedMesh || !o.material || Array.isArray(o.material)) return;
    const key = o.material.customProgramCacheKey ? String(o.material.customProgramCacheKey()) : '';
    if (!/^(wld2-|wk-)/.test(key)) return;
    if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
    if (o.geometry.boundingSphere.radius > 0.8) return;
    let hit = false;
    for (let i = 0; i < o.count; i++) {
      o.getMatrixAt(i, _ssM);
      _ssP.setFromMatrixPosition(_ssM).applyMatrix4(o.matrixWorld);
      if (Math.hypot(_ssP.x - M.x, _ssP.z - M.z) < 2.3 || Math.hypot(_ssP.x - pile.x, _ssP.z - pile.z) < 1.2 || Math.hypot(_ssP.x - watch.x, _ssP.z - watch.z) < 0.7) {
        o.setMatrixAt(i, _ssZ);
        hit = true;
        n++;
      }
    }
    if (hit) o.instanceMatrix.needsUpdate = true;
  });
  G.siteHid = n;
}

function hermiteKeys(K, c, j) {
  const n = K.length;
  if (c <= K[0][0]) return K[0][j];
  if (c >= K[n - 1][0]) return K[n - 1][j];
  let i = 0;
  while (i < n - 2 && c > K[i + 1][0]) i++;
  const t0 = K[i][0], h = K[i + 1][0] - t0, u = (c - t0) / h;
  const sl = (a, b) => (K[b][j] - K[a][j]) / (K[b][0] - K[a][0]);
  const m0 = i > 0 ? 0.5 * (sl(i - 1, i) + sl(i, i + 1)) : sl(i, i + 1);
  const m1 = i + 2 < n ? 0.5 * (sl(i, i + 1) + sl(i + 1, i + 2)) : sl(i, i + 1);
  const u2 = u * u, u3 = u2 * u;
  return (2 * u3 - 3 * u2 + 1) * K[i][j] + (u3 - 2 * u2 + u) * h * m0 + (3 * u2 - 2 * u3) * K[i + 1][j] + (u3 - u2) * h * m1;
}

function crankKeys() {
  const M = G.mech.M, yaw = G.mech.yaw;
  const phiOf = (p) => Math.atan2(p.x - M.x, p.z - M.z) - yaw;
  const pk = phiOf(mechanism.crankWorld), pf = phiOf(mechanism.frontCenter);
  const dir = -(Math.sign(wrapA(pf - pk)) || -1);
  const B = pk + wrapA(pf - pk);
  const A = B + dir * 0.3;
  const C = pk + dir * 0.35;
  const ck = mechanism.crankWorld.lerp(M, 0.3);
  const fr = mechanism.frontCenter, bk = mechanism.backSarosCenter;
  const afr = fr.clone().lerp(ck, 0.35);
  const bl = bk.clone();
  bl.y += 0.5;
  const mid = M.clone().add(new V3(0, 0.05, 0));
  const Vt = G.site.vantage, phiV = Math.atan2(Vt.x - M.x, Vt.z - M.z) - yaw;
  const rV = Math.hypot(Vt.x - M.x, Vt.z - M.z), hV = Vt.y - M.y;
  const Dv = B + dir * Math.PI + wrapA(phiV - (B + dir * Math.PI));
  const K = [
    [0.00, A, 3.0, 0.35, afr.x, afr.y, afr.z],
    [0.52, C, 3.2, 1.0, mid.x, mid.y, mid.z],
    [0.88, Dv - dir * 0.1, rV + 0.35, hV - 0.1, bl.x, bl.y, bl.z],
    [1.00, Dv, rV, hV, bl.x, bl.y, bl.z],
  ];
  return { K, dir };
}

function crankHint(s) {
  if (G.chText === s) return;
  G.chText = s;
  UI.crankHint(s);
}

const CUE = { turn: Math.PI / 2, idle: 2, r: 0.16, px: [30, 64], inT: 0.5, backT: 1.2, outK: 10 };
const _cuP = new V3(), _cuR = new V3();
function ckCue(dt, gripped, acting) {
  const C = G.ckCue || (G.ckCue = { k: 0, turned: 0, idle: 0, back: false });
  C.turned += Math.abs(G.crankW || 0) * dt;
  C.idle = acting ? 0 : C.idle + dt;
  if (C.idle >= CUE.idle && C.turned > 0) { C.turned = 0; C.back = true; }
  const want = gripped && !G.arrived ? 1 - smoothstep(0, CUE.turn, C.turned) : 0;
  if (want > C.k) C.k = Math.min(want, C.k + dt / (C.back ? CUE.backT : CUE.inT));
  else C.k += (want - C.k) * (1 - Math.exp(-dt * CUE.outK));
  if (C.k < 0.01 && want === 0) C.k = 0;
}
function ckCuePlace() {
  const C = G.ckCue;
  if (!C) return;
  camera.updateMatrixWorld();
  mechanism.crankKnobWorld(_cuP);
  _cuR.setFromMatrixColumn(camera.matrixWorld, 0).multiplyScalar(CUE.r).add(_cuP);
  _cuP.project(camera);
  _cuR.project(camera);
  const [W, H] = viewSize();
  const x = (_cuP.x * 0.5 + 0.5) * W, y = (-_cuP.y * 0.5 + 0.5) * H;
  const r = clamp$9(Math.hypot((_cuR.x - _cuP.x) * 0.5 * W, (_cuR.y - _cuP.y) * 0.5 * H), CUE.px[0], CUE.px[1]);
  const seen = _cuP.z < 1 && x > -r && x < W + r && y > -r && y < H + r;
  UI.crankCue(seen ? C.k : 0, x, y, r);
}

const _kn = new V3(), _ka = new V3(), _kh = new V3(), _kp = new V3(), _kb = new V3(), _kw = new V3();
const _kL = new V3(), _kLd = new V3(), _kLp = new V3(), _kPalm = new V3(), _kO = new V3(), _kF = new V3();
const _kRo = { grip: 1, palm: _kPalm }, _kLo = { grip: 0.25, palm: _kLp };
const CK_WALK = 1.35;
const CK_BRAKE = 2.0;
function crankFrame(final) {
  mechanism.crankKnobWorld(_kn, final);
  mechanism.crankAxisWorld(_ka, final);
  const base = mechanism.crankWorld;
  _kh.copy(base).addScaledVector(_ka, _kp.subVectors(_kn, base).dot(_ka));
}
function crankStand(final = false) {
  if (final) crankFrame(true);
  const n19 = dwIs1901();
  _kb.copy(mechanism.backSarosCenter).sub(G.mech.M).setY(0).normalize();
  _kw.set(_ka.x, 0, _ka.z).normalize();
  const S = { p: new V3(), face: new V3(), n19, stance: false };
  if (n19 && typeof diver$1.crankStance === 'function') {
    diver$1.crankStance(_kh, _ka, S.p);
    const yaw = Number.isFinite(S.p.yaw) ? S.p.yaw : Math.atan2(_kw.x, _kw.z);
    S.p.addScaledVector(_kw, -0.2);
    S.face.set(S.p.x - Math.sin(yaw) * 2, 0, S.p.z - Math.cos(yaw) * 2);
    S.stance = true;
  } else if (n19) {
    S.p.copy(_kh).addScaledVector(_kw, 0.3).addScaledVector(_kb, 0.36);
    S.face.copy(S.p).addScaledVector(_kb, -2).addScaledVector(_kw, -0.7);
  } else {
    _kF.copy(_kw).multiplyScalar(0.85).addScaledVector(_kb, 0.5).normalize();
    S.p.copy(_kh).addScaledVector(_kF, 0.97);
    S.face.copy(_kh);
  }
  mcoords(S.p, _kF);
  if (Math.abs(_kF.z) < MB_F + DW_R && Math.abs(_kF.x) < MB_R + DW_R + 0.04) mframe(Math.sign(_kF.x || 1) * (MB_R + DW_R + 0.04), _kF.z, S.p);
  S.p.y = floorHeight(S.p.x, S.p.z) + DW_UP;
  return S;
}
function crankPath(S) {
  const path = [];
  mcoords(G.dw.p, _kp);
  mcoords(S.p, _kF);
  const sx = Math.max(_kF.x, MB_R + DW_R);
  if (_kp.x < MB_R + DW_R + 0.5) {
    if (_kp.z > -MB_F && _kp.x > -1.1400000000000001) path.push(mframe(MB_R + 0.8, MB_F + 0.55, new V3()));
    else path.push(...dwRoute(G.dw.p, S.p).slice(0, -1));
  }
  if (!S.stance && _kF.x < MB_R + DW_R + 0.45) path.push(mframe(sx + 0.5, _kF.z - 0.55, new V3()));
  path.push(S.p);
  return path;
}
function crankWalk(path) {
  dwGo(path, CK_WALK, CK_BRAKE);
  G.ckLen = Math.max(0.5, routeLen(path, G.dw.p));
}
function crankDiver(dt, t, fin) {
  if (!diver$1 || !mechanism.crankKnobWorld) return;
  crankFrame(false);
  const base = mechanism.crankWorld;
  if (!G.ckStand) {
    const S = (G.ckStand = crankStand());
    if (fin || !G.dw || !diver$1.group.visible) {
      const w = fin ? S.p : G.site.watch;
      dwStart(w, null, Math.atan2(-(S.face.x - w.x), -(S.face.z - w.z)), fin ? 1 : 0);
    }
    if (!fin) crankWalk(crankPath(S));
  }
  const S = G.ckStand, W = G.dw;
  if (!fin && !W.arrived && W.path.length) {
    const left = dwLeft(), best = S.best === undefined ? Infinity : S.best;
    if (left < best - 0.05) { S.best = left; S.held = 0; } else S.held = (S.held || 0) + dt;
    if (S.held > 1.5 && left < 1.5) { W.path.length = 0; W.arrived = true; W.arrT = 0; }
  }
  G.ckApp = fin || W.arrived || !G.ckLen ? 1 : smoothstep(0.35, 1, 1 - dwLeft() / G.ckLen);
  const on = fin ? 1 : W.arrived ? 0.5 + 0.5 * smoothstep(0, 0.3, W.arrT) : W.path.length ? 0.5 * (1 - smoothstep(0.12, 0.5, dwLeft())) : 0;
  const fT = G.state === 'eclipse' ? G.st : 60;
  const hold = fin ? 1 - smoothstep(0.7, 1.9, fT) : 1;
  G.ckGrip = on;
  _kPalm.copy(_ka).negate();
  const canReach = typeof diver$1.reach === 'function';
  if (canReach && S.n19 && mechanism.crankGripSD) ckGrip(on * hold);
  else if (canReach) diver$1.reach('right', _kn, on * hold, _kRo);
  if (!S.n19 && canReach) {
    _kLd.set(-1, -0.6, 0).applyQuaternion(diver$1.group.quaternion);
    _kLd.addScaledVector(_ka, -_kLd.dot(_ka)).normalize();
    _kL.copy(base).addScaledVector(_kLd, 0.2).addScaledVector(_ka, 0.012);
    _kLp.copy(_ka).negate();
    diver$1.reach('left', _kL, on * hold, _kLo);
  }
  _kO.copy(_kn);
  if (fin && G.fin) _kO.lerp(G.fin.O, smoothstep(0.4, 2.2, fT));
  const pose = S.n19 && on * hold > 0.3 ? 'crank' : 'hover';
  _dwCtx.crankPhase = S.n19 ? ckPhase() : undefined;
  _dwCtx.crankSink = S.n19 ? Math.max(0, W.p.y - _kh.y - KG.h0) : undefined;
  dwUpdate(dt, t, _kO, W.arrived ? S.face : null, pose, S.n19 ? 0 : 0.12 * on, clamp$9(0.25 + Math.abs(G.crankW || 0) / 5, 0, 1), S.n19 ? 1 : 3);
  _dwCtx.crankPhase = undefined;
  _dwCtx.crankSink = undefined;
}
const KG = { side: 0, follow: [-0.6, 0.3], gap: 0.004, along: 0.012, roll: 0.12, h0: -0.1 };
const _kGn = new V3(), _kGr = new V3(), _kGt = new V3(), _kGc = new V3(), _kGe = new V3(), _kGs = new V3(), _kGa = new V3();
const _kGo = { grip: 1, palm: new V3(), fingers: new V3(), touch: (x, y, z) => mechanism.crankGripSD(x, y, z), squeeze: true, snug: true, dev: 0.3, pole: new V3(0.9, -0.1, 0) };
function ckGrip(w) {
  mechanism.crankGripFrame();
  _kGr.set(0, 1, 0).cross(_ka).normalize();
  _kGa.set(0, 1, 0).addScaledVector(_ka, -_ka.y).normalize();
  _kGc.subVectors(_kn, _kh);
  const th = Math.atan2(_kGc.dot(_kGr), _kGc.dot(_kGa));
  const side = KG.side + KG.follow[0] * Math.sin(th) + KG.follow[1] * (Math.cos(th) - 1);
  _kGn.copy(_kGa).multiplyScalar(Math.cos(side)).addScaledVector(_kGr, Math.sin(side)).normalize();
  _kGo.fingers.crossVectors(_ka, _kGn);
  _kGo.palm.copy(_kGn).multiplyScalar(-Math.cos(KG.roll)).addScaledVector(_ka, Math.sin(KG.roll));
  _kGt.copy(_kn).addScaledVector(_kGn, mechanism.crankKnobR + KG.gap).addScaledVector(_ka, KG.along);
  diver$1.reach('right', _kGt, w, _kGo);
}
function ckPhase() {
  _kGc.subVectors(_kn, _kh);
  const W = G.dw;
  if (!W || !W.p) return undefined;
  _kGe.set(W.p.x, W.p.y + 1.35, W.p.z).sub(_kh);
  _kGe.addScaledVector(_ka, -_kGe.dot(_ka)).negate();
  if (_kGe.lengthSq() < 1e-6) return undefined;
  _kGe.normalize();
  _kGs.crossVectors(_ka, _kGe);
  return Math.atan2(-_kGc.dot(_kGs), _kGc.dot(_kGe));
}

const _trkF = new V3(), _trkD = new V3();
function trackCam(dt) {
  const T = G.camTrack || (G.camTrack = { p: new V3(), v: new V3(), f: new V3(), fv: new V3(), init: false });
  _trkF.set(0, 0, -1).applyQuaternion(camera.quaternion);
  if (!T.init || dt <= 0) { T.p.copy(camera.position); T.f.copy(_trkF); T.v.set(0, 0, 0); T.fv.set(0, 0, 0); T.init = true; return T; }
  const k = 1 - Math.exp(-dt * 30);
  T.v.lerp(_trkD.subVectors(camera.position, T.p).divideScalar(dt), k);
  T.fv.lerp(_trkD.subVectors(_trkF, T.f).divideScalar(dt), k);
  T.p.copy(camera.position);
  T.f.copy(_trkF);
  return T;
}

const _ckLook = new V3(), _ckAim = new V3();
const CK_AIM = 0.3;
function onGlyph(kind) {
  const now = U.uTime.value;
  if (now - G.lastGlyph > 0.06) { G.lastGlyph = now; audio$1.glyph(kind); }
}
function updateCrank(dt, t) {
  const gripped = G.ckGrip === undefined || G.ckGrip > 0.6;
  const input = gripped ? Math.max(0, G.crankInput) : 0;
  const back = gripped ? Math.max(0, -G.crankInput) : 0;
  G.crankInput = 0;
  const turning = (gripped && G.hold) || input > 0.01 || Math.abs(G.crankV) > 0.3;
  if (turning) guide.event('crank-turn');
  if (turning && !G.ckSaid) { G.ckSaid = true; UI.story('Eclipses repeat in a cycle of 223 lunar months.', { ms: 4500 }); }
  guide.update(dt, { state: 'crank', turning });
  const holding = gripped && G.hold;
  G.holdT = holding ? G.holdT + dt : Math.max(0, G.holdT - dt * 3);
  const remaining = SAROS - G.months;
  const drive = holding ? 6 + 26 * smoothstep(0, 2, G.holdT) : 0;
  G.crankV += drive * dt + input * 7.5;
  if (back > 0 && G.crankV > 0) G.crankV = Math.max(0, G.crankV - back * 7.5);
  G.crankV *= Math.exp(-(holding ? 0.3 : 3.5) * dt);
  G.crankV = clamp$9(G.crankV, -6, Math.min(32, Math.max(0.9, remaining * 3.6)));
  G.months = clamp$9(G.months + G.crankV * dt, 0, SAROS);
  if (SAROS - G.months < 0.02) { G.months = SAROS; G.crankV = 0; }
  mechanism.setMonths(G.months);
  const wHand = Math.sign(G.crankV) * Math.min(5.3, Math.abs(G.crankV) * (3.5 / 7.5));
  G.crankW += (wHand - G.crankW) * (1 - Math.exp(-dt * 6));
  G.crankTurn += G.crankW * dt;
  if (mechanism.setCrankAngle) mechanism.setCrankAngle(G.crankTurn);
  const spin = G.crankV / 32;
  if (mechanism.setEnergy) mechanism.setEnergy(clamp$9(0.3 + Math.abs(spin) * 0.7, 0, 1));
  if (magic$1) {
    try {
      magic$1.setSky(skyState(G.months), G.months, spin);
      magic$1.setCharge(0.75 + 0.25 * Math.min(1, Math.abs(spin)));
    } catch (e) { console.warn('[antikythera] magic:', e); magic$1 = null; }
  }
  mechanism.updateGlyphs(dt, onGlyph);
  audio$1.setCrank(clamp$9(Math.abs(G.crankV) / 26, 0, 1), G.months, G.crankTurn);
  UI.crank(G.months, (G.months * SYN) / TROP);
  if (G.months >= SAROS) {
    if (!G.arrived) {
      G.arrived = true;
      if (audio$1.saros) audio$1.saros(); else audio$1.clack(1, 0.6);
      timeWarp(0.6, 0.3);
      G.glyphP = mechanism.backSarosCenter;
      crankHint('');
    }
  }
  if (gripped && G.months > 0.25) G.ckGo = true;
  crankHint(gripped && !G.ckGo && !G.arrived ? COPY.crankGo : '');
  UI.crankState(gripped, !!G.ckGo);

  const p = clamp$9(G.months / SAROS, 0, 1);
  const w = 1.7;
  G.camCV += (w * w * (p - G.camC) - 2 * w * G.camCV) * dt;
  G.camC = clamp$9(G.camC + G.camCV * dt, 0, 1);
  const c = G.camC;
  if (mechanism.lightUp) mechanism.lightUp(c);
  setSun(SUN_AZ_SET, lerp$4(SUN_EL_DAY, -5 * DEG$3, smoothstep(0.06, 1.0, c)));
  const M = G.mech.M, K = G.ck.K;
  let phi = hermiteKeys(K, c, 1), r = hermiteKeys(K, c, 2), h = hermiteKeys(K, c, 3);
  _ckLook.set(hermiteKeys(K, c, 4), hermiteKeys(K, c, 5), hermiteKeys(K, c, 6));
  G.ckInU = Math.min((G.ckInU || 0) + dt / 2.4, Math.max(G.ckInU || 0, G.ckApp === undefined ? 1 : G.ckApp));
  const inK = easeInOut$1(clamp$9(G.ckInU, 0, 1));
  G.lensAdd = (G.ckLens0 || 0) * (1 - inK);
  if (inK < 1) {
    const e = G.ckIn;
    let d = wrapA(phi - e.phi);
    if (e.d !== undefined) d = e.d + wrapA(d - e.d);
    e.d = d;
    phi = e.phi + d * inK;
    r = lerp$4(e.r, r, inK);
    h = lerp$4(e.h, h, inK);
    _ckLook.lerpVectors(e.look, _ckLook, inK);
  }
  if (FRAME.tall > 0 && G.dw && G.dw.p) {
    _ckAim.set(G.dw.p.x, G.dw.p.y + 0.3, G.dw.p.z);
    _ckLook.lerp(_ckAim, CK_AIM * FRAME.tall * (1 - smoothstep(0.55, 0.85, c)));
  }
  phi += Math.sin(t * 0.23) * 0.02;
  h += Math.sin(t * 0.31) * 0.025;
  r *= FRAME.reach(baseFov + fovAdd);
  const a = G.mech.yaw + phi;
  camera.position.set(M.x + Math.sin(a) * r, M.y + h, M.z + Math.cos(a) * r);
  camClearOf(camera.position);
  lookInto(camera.quaternion, camera.position, _ckLook);
  crankDiver(dt, t);
  if (G.arrived) glowTo(1.6, GLOW_FIN, dt, 4); else glowTo(0.9, GLOW_ASM, dt, 1.5);
  const gk = G.glyphP ? smoothstep(0, 0.5, G.stopT) : 0;
  const fd = camera.position.distanceTo(_ckLook);
  post.setDof(G.glyphP ? lerp$4(fd, camera.position.distanceTo(G.glyphP), gk) : fd, lerp$4(magic$1 ? 0.08 : 0.2, 0.16, gk), dt);
  breathe(dt);
  ckCue(dt, gripped, input > 0.002 || holding);
  trackCam(dt);
  if (G.arrived) G.stopT += dt;
  if (G.stopT > 0.8 && G.camC > 0.9) setState('eclipse');
}

const RISE_PACE = 0.75;
const V_RISE = 4.0 / RISE_PACE;
const V_LAST = 0.8;
const RISE_MIN = 6.6 * RISE_PACE, RISE_MAX = 7.6 * RISE_PACE;
const riseAt = (s) => ORB_T0 + s * RISE_PACE;
const WATER_CLEAR = new V3(0.8, 0.42, 0.4), ABS_HOME = new V3();
const _rp = new V3(), _rt = new V3(), _lk = new V3(), _lb = new V3(), _cd = new V3(), _ot = new V3();
function surfacePoint(out = new V3()) { return out.set(LAYOUT.assembly.x - 3.5, 0.45, LAYOUT.assembly.z - 1.0); }
new V3(); new V3(); new V3();
let _foot = null;
const _bf = new V3();
function boatFoot() {
  const b = surface && surface.boat;
  if (_foot || !b) return _foot;
  const box = new THREE.Box3();
  for (const m of [b.hull, b.props]) {
    if (!m || !m.geometry) continue;
    if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
    box.union(m.geometry.boundingBox);
  }
  if (box.isEmpty()) return null;
  _foot = [[box.min.x, box.min.z], [box.min.x, box.max.z], [box.max.x, box.min.z], [box.max.x, box.max.z]].map(([x, z]) => new V3(x, 0, z));
  return _foot;
}
const _bs = { lo: 0, hi: 0 };
function boatSpan(p, az, b, out) {
  const f = boatFoot(), g = surface && surface.boat && surface.boat.group;
  if (!f || !g) return false;
  const fx = Math.sin(az), fz = -Math.cos(az);
  let lo = Infinity, hi = -Infinity;
  for (const c of f) {
    _bf.copy(c).applyMatrix4(g.matrixWorld);
    const dx = _bf.x - p.x, dz = _bf.z - p.z;
    const a = Math.atan2(dx * -fz + dz * fx, dx * fx + dz * fz + b);
    if (a < lo) lo = a;
    if (a > hi) hi = a;
  }
  out.lo = lo; out.hi = hi;
  return true;
}
const BOAT_M = 4 * DEG$3;
const SUN_M = 3 * DEG$3;
function boatKeep(p, az, vfov = camera.fov, sunAz = NaN, soft = 0) {
  if (!boatSpan(p, az, 0, _bs)) return 0;
  let lo = _bs.lo, hi = _bs.hi;
  if (Number.isFinite(sunAz)) { const s = wrapA(sunAz - az); lo = Math.min(lo, s - SUN_M); hi = Math.max(hi, s + SUN_M); }
  return FRAME.keep(lo, hi, vfov, BOAT_M, soft);
}
const KEEP_SOFT = 3.5 * DEG$3;
function finKeep(p, az, sr = 0, mk = 0) {
  const bw = FRAME.tall > 0 ? FRAME.tall : 1;
  return moonKeep(bw * ((1 - sr) * boatKeep(p, az, camera.fov, NaN, KEEP_SOFT) + (sr ? sr * boatKeep(p, az, camera.fov, SUN_AZ_RISE, KEEP_SOFT) : 0)), az, camera.fov, mk);
}
const MOON_M = 5 * DEG$3;
function moonKeep(th, az, vfov, mk) {
  const w = mk * FRAME.tall;
  if (!(w > 0)) return th;
  const h = Math.atan(Math.tan((vfov * DEG$3) / 2) * camera.aspect) - MOON_M, m = wrapA(MOON_AZ - az);
  if (!(h > 0)) return th;
  return th + (clamp$9(th, m - h, m + h) - th) * Math.min(w, 1);
}
const KEEP_LET = 0.8;
function endKeep(k, dt) {
  const o = G.state === 'end' ? G.eo : null;
  if (!o || o.tookT < 0) { if (o) o.keep = o.keepK = k; return k; }
  o.tookT += dt;
  o.keep += (k - o.keepK) * (1 - smoothstep(0, KEEP_LET, o.tookT));
  o.keepK = k;
  return o.keep;
}
function turnLook(v, th) {
  if (!th) return v;
  const c = Math.cos(th), s = Math.sin(th), x = v.x;
  v.x = x * c - v.z * s;
  v.z = v.z * c + x * s;
  return v;
}
function sunriseKeep(T2, dt, p, az) {
  const R = G.fin, w = smoothstep(9.5, 12, T2) * (1 - smoothstep(16, 19, T2));
  let need = 0;
  if (w > 0) {
    const h = Math.atan(Math.tan((camera.fov * DEG$3) / 2) * camera.aspect) - BOAT_M, s = wrapA(SUN_AZ_RISE - az);
    const fits = (b) => !boatSpan(p, az, b, _bs) || Math.max(_bs.hi, s + SUN_M) - Math.min(_bs.lo, s - SUN_M) <= 2 * h;
    if (h > 0 && !fits(0)) {
      let a = 0, b = 40;
      if (fits(b)) { for (let i = 0; i < 14; i++) { const m = 0.5 * (a + b); if (fits(m)) b = m; else a = m; } }
      need = b;
    }
  }
  if (!R) return w;
  const k = 2.2, x = R.srB || 0, v = R.srV || 0;
  if (dt > 0) { R.srV = v + (k * k * (w * need - x) - 2 * k * v) * dt; R.srB = x + R.srV * dt; }
  const b = R.srB || 0;
  if (b > 0) { p.x -= Math.sin(az) * b; p.z += Math.cos(az) * b; }
  return w;
}
const dirTo = (p, out) => out.subVectors(p, camera.position).normalize();
function softElev(v, maxEl, fallback) {
  const el = Math.asin(clamp$9(v.y, -1, 1));
  if (el <= 0) return v;
  const e2 = maxEl * Math.tanh(el / maxEl);
  let hx = v.x, hz = v.z;
  const hl = Math.hypot(hx, hz);
  if (hl < 1e-4) { hx = fallback.x; hz = fallback.z; } else { hx /= hl; hz /= hl; }
  const c = Math.cos(e2);
  return v.set(hx * c, Math.sin(e2), hz * c);
}

const ORB_U = {
  uSize: { value: 0.1 },
  uQ: { value: 8 },
  uA: { value: 0 },
  uK: { value: 0 },
  uOrr: { value: new V3(1, 1, 5) },
  uL: { value: new V3(0, 0, 1) },
  uC: { value: new V3(0, 1, 0) },
  uRho: { value: 0.016 },
  uImg: { value: new THREE.Vector4(1, 1, 0, 0) },
  uWob: { value: new V3(0, 0, 1) },
  uVeil: { value: new V3(1, 1, 1) },
  uOcc: { value: 1 },
  uGlim: { value: new V3(0, 3, 0) },
  uDance: { value: new THREE.Vector4(0, 0, 0, 0) },
};
let moonOrb = null;
function makeMoonOrb() {
  const mat = new THREE.ShaderMaterial({
    uniforms: Object.assign({}, SKY_UNIFORMS, ORB_U),
    vertexShader: `
      uniform float uSize;
      varying vec2 vP;
      varying vec3 vRay;
      void main() {
        vP = position.xy;
        vec3 c = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        vec3 rt = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
        vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
        vec3 w = c + (rt * position.x + up * position.y) * uSize;
        vRay = w - cameraPosition;
        gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
      }`,
    fragmentShader: `
      ${SKY_DECL}
      ${SKY_FUNCS}
      ${MOON_GLSL}
      uniform float uQ;
      uniform float uA;
      uniform float uK;
      uniform vec3 uOrr;
      uniform vec3 uL;
      uniform vec3 uC;
      uniform float uRho;
      uniform vec4 uImg;
      uniform vec3 uWob;
      uniform vec3 uVeil;
      uniform float uOcc;
      uniform vec3 uGlim;
      uniform vec4 uDance;
      varying vec2 vP;
      varying vec3 vRay;
      float orbHash(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
      void main() {
        vec2 q = vP * uQ;
        float r = length(q);
        float fw = max(fwidth(r), 1e-4);
        vec3 col = vec3(0.0);
        float cov = 0.0;
        if (uK < 1.0) {
          float bc = 1.0 - smoothstep(1.0 - fw, 1.0 + fw, r);
          vec3 b = vec3(0.0);
          if (r < 1.0 + fw) {
            vec3 n = vec3(q, sqrt(max(0.0, 1.0 - r * r)));
            float maria = smoothstep(0.45, 0.72, skNoise(n.xy / (1.0 + n.z) * 3.1 + uOrr.z) * 0.7 + skNoise(n.xy * 6.3 + 2.1) * 0.3);
            float lit = smoothstep(-0.04, 0.12, dot(n, uL)) * (1.0 - uOrr.y);
            b = vec3(0.93, 0.95, 1.0) * (1.0 - 0.38 * maria) * lit * 3.2 + vec3(0.07, 0.15, 0.2) * (1.0 - lit) * 0.7;
            b += vec3(0.75, 0.88, 1.0) * pow(1.0 - n.z, 4.0) * (0.25 + 0.6 * uOrr.y);
            b *= bc;
          }
          b += vec3(0.8, 0.86, 1.0) * exp(-max(r - 1.0, 0.0) * 6.0) * 0.4 * (1.0 - smoothstep(1.4, 2.0, r)) * (1.0 - bc);
          col = b * (uOrr.x * (1.0 - uK));
          cov = bc * (1.0 - uK);
        }
        if (uK > 0.0) {
          vec3 v = normalize(vRay);
          vec3 e1 = normalize(cross(uC, vec3(0.0, 1.0, 0.0))), e2 = cross(e1, uC);
          vec2 o = vec2(dot(v, e1), dot(v, e2)) / (max(dot(v, uC), 0.5) * uRho);
          float t = uWob.x * 0.42;
          vec2 rp = vec2(skNoise(o * 1.3 + vec2(t * 0.8, -t * 0.55)), skNoise(o * 1.3 + vec2(7.3 - t * 0.6, 2.9 + t * 0.9))) - 0.5;
          rp += 0.25 * (vec2(skNoise(o * 3.1 + vec2(3.1 - t * 1.3, t * 0.9)), skNoise(o * 3.1 + vec2(1.9 + t * 1.05, 5.7 - t * 1.45))) - 0.5);
          rp += uGlim.z * 0.38 * (vec2(skNoise(o * 3.6 + vec2(t * 1.5, -t * 1.2)), skNoise(o * 3.6 + vec2(4.4 - t * 1.35, 1.3 + t * 1.6))) - 0.5);
          vec2 rl = vec2(skNoise(o * 0.55 + vec2(t * 1.1, -t * 0.8)), skNoise(o * 0.55 + vec2(5.1 - t * 0.9, 2.3 + t * 1.2))) - 0.5;
          rl += 0.45 * (vec2(skNoise(o * 1.2 + vec2(-t * 1.6, t * 1.2)), skNoise(o * 1.2 + vec2(3.3 + t * 1.35, 7.9 - t * 1.75))) - 0.5);
          vec2 rf = vec2(skNoise(o * 3.7 + vec2(t * 1.5, -t * 1.2)), skNoise(o * 3.7 + vec2(2.7 - t * 1.3, 6.1 + t * 1.55))) - 0.5;
          vec2 oa = (o - 0.6 * uDance.xy - rp * (0.75 * uImg.w) - rl * uDance.z - rf * (0.3 * uDance.z)) / uImg.xy;
          vec3 M = uMoonDir;
          vec3 f1 = normalize(cross(M, vec3(0.0, 1.0, 0.0))), f2 = cross(f1, M);
          vec3 va = normalize(M + (oa.x * f1 + oa.y * f2) * SK_MOON_R);
          vec3 halo;
          float pa = (length(fwidth(oa)) + uImg.z) * SK_MOON_R;
          vec4 mo = skMoon(va, pa, halo);
          if (uImg.z > 0.04) {
            vec3 hx;
            for (int i = 0; i < 6; i++) {
              float an = float(i) * 1.0471976 + 0.4;
              vec2 ob = oa + 0.5 * uImg.z * vec2(cos(an), sin(an));
              mo += skMoon(normalize(M + (ob.x * f1 + ob.y * f2) * SK_MOON_R), pa, hx);
            }
            mo /= 7.0;
          }
          float pl = skNoise(vec2(o.x * 0.7 + o.y * 0.9, o.y * 1.6) + vec2(t * 1.2, -t * 1.6));
          mo.rgb *= 1.0 + 0.12 * uDance.w * (2.0 * pl - 1.0);
          mo.rgb *= mix(1.0, 0.4 + 1.2 * smoothstep(0.32, 0.75, skNoise(o * 2.3 + vec2(-t * 0.9, t * 0.65))), uGlim.z);
          float rw = length(o * vec2(0.6, 1.0));
          vec3 glow = uSkMoonSea * (uWob.y * (0.07 * exp(-rw / 1.1) + 0.022 * exp(-rw / 3.2)) * (0.8 + 0.4 * skNoise(o * 1.7 + vec2(t * 1.1, -t * 0.8))));
          glow += uSkMoonSea * (uDance.w * 0.12 * exp(-(o.x * o.x) / 1.8 - (o.y * o.y) / 12.0) * (0.6 + 0.8 * pl));
          vec2 gc = vec2(o.x * 1.5, o.y * 0.9), gi = floor(gc), gf = fract(gc) - 0.5;
          float gh = orbHash(gi + 17.0);
          vec2 gj = vec2(orbHash(gi + 3.7), orbHash(gi + 9.1)) - 0.5;
          vec2 gd = gf - gj * 0.5;
          vec2 gw = fwidth(gc), s0 = vec2(0.00714, 0.0353), s2 = s0 + 0.6 * gw * gw;
          float gk = exp(-0.5 * dot(gd * gd, 1.0 / s2)) * sqrt((s0.x * s0.y) / (s2.x * s2.y));
          gk *= (1.0 - smoothstep(0.3, 0.5, abs(gf.x))) * (1.0 - smoothstep(0.3, 0.5, abs(gf.y)));
          float tw = pow(max(0.0, sin(t * (0.9 + 1.3 * fract(gh * 7.13)) + gh * 41.0)), 2.0) * (1.0 + uDance.w * (1.0 * pl - 0.4));
          float genv = exp(-(o.x * o.x) / 4.0 - (o.y * o.y) / (uGlim.y * uGlim.y));
          vec3 glint = uSkMoonSea * (gk * tw * step(0.8, gh) * genv * (0.32 * uGlim.x));
          float fq = 1.0 - smoothstep(0.2, 0.95, length(vP));
          col += (mo.rgb + (halo * uWob.z + glow) * (fq * fq) + glint) * uK;
          cov += mo.a * uK;
        }
        col *= 1.0 - smoothstep(0.72, 1.0, length(vP));
        gl_FragColor = vec4(col * uVeil * uA, cov * uOcc * uA);
      }`,
    transparent: true, depthWrite: false, depthTest: false,
    blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  m.frustumCulled = false;
  m.visible = false;
  m.renderOrder = 30;
  return m;
}

const RISE_WAYS = [];
for (const o of [0, 2, -2, 3, 4, -4, 5, 6]) for (const b of [0, 2, -2]) for (const f of [1.6, 2.2, 2.8]) RISE_WAYS.push([o, b, f * RISE_PACE, 3.0 * RISE_PACE]);
const RISE_HID = 4, RISE_ROUGH = 0.5 * RISE_PACE * RISE_PACE;
function buildRise() {
  const O = G.orbC.clone(), S0 = surfacePoint(), S = moonClear(S0), P0 = camera.position.clone();
  let T = null;
  for (const slow of [true, false]) {
    let B = null;
    for (const [o, b, f, x] of RISE_WAYS) {
      const r = riseTrack(P0, S, o, b, f, x, slow);
      r.cost = r.RISE + RISE_HID * r.hid + RISE_ROUGH * r.rough;
      if (!B || r.cost < B.cost - 1e-3) B = r;
    }
    if (!T || B.hid < T.hid - 0.05) T = B;
    if (T.hid < 0.05) break;
  }
  const K = T.K, RISE = T.RISE;
  const vEnd = risePos(K, RISE, new V3()).sub(risePos(K, RISE - 0.02, new V3())).divideScalar(0.02);
  const bLens = FRAME.lens(baseFov, NEED.eclipse);
  const bAz = BREACH_AZ + (FRAME.tall > 0 ? moonKeep(FRAME.tall * boatKeep(S, BREACH_AZ, bLens), BREACH_AZ, bLens, 1) : 0);
  return {
    K, O, S, vEnd, RISE, moonW: MOON_W.clone(), across: Math.hypot(S.x - P0.x, S.z - P0.z), bend: T.bend, side: T.side, fall: T.fall, stop: T.stop, hid: T.hid, rough: T.rough, pace: T.vc,
    S0: S.distanceTo(S0) > 1e-3 ? S0 : null,
    breach: bAz === BREACH_AZ ? BREACH_LOOK : dirAzEl(bAz, 13 * DEG$3, new V3()), bTurn: bAz - BREACH_AZ,
    moonH: new V3(MOON_DIR.x, 0, MOON_DIR.z).normalize(),
    dial: mechanism.backSarosCenter,
    orb: {
      took: false, bead: { p: new V3(), r: 0.05, a: 1, dark: 1, L: new V3(0, 1, 0) }, d0: 1,
      rho: 0.016, a0: 1, dark0: 1, s: 0, stretch: 1, wand: new V3(), look: new V3(0, 1, 0), app: MOON_W.clone(), dir: MOON_W.clone(),
    },
  };
}
const V_OUT = 4.0 + V_LAST;
function riseTrack(P0, S, side, bend, fall, stop, slow = true) {
  const Ka = P0.clone().addScaledVector(MOON_W, 0.12), K1 = P0.clone().addScaledVector(MOON_W, 0.45);
  const K2 = K1.clone().addScaledVector(MOON_W, 0.3);
  K2.y += 1.0;
  const hl = Math.hypot(MOON_DIR.x, MOON_DIR.z), hx = MOON_DIR.x / hl, hz = MOON_DIR.z / hl;
  const ox = -hz * side + hx * bend, oz = hx * side + hz * bend;
  const A = new V3(K2.x, K1.y + 3, K2.z), mid = new V3((K2.x + S.x) / 2 + ox, 0, (K2.z + S.z) / 2 + oz);
  const near = (x, z, r) => segDist(x, z, A, mid) < r + 1.5 || segDist(x, z, mid, S) < r + 1.5;
  let top = -Infinity;
  for (const o of obstacles) if (near(o.x, o.z, o.r)) top = Math.max(top, o.y + o.r);
  for (const c of capsules) if (near((c.ax + c.bx) / 2, (c.az + c.bz) / 2, c.r + Math.hypot(c.bx - c.ax, c.bz - c.az) / 2)) top = Math.max(top, Math.max(c.ay, c.by) + c.r);
  A.y = Math.max(A.y, top + 1.5);
  const Lp = K1.distanceTo(K2) + K2.distanceTo(A) + Math.hypot(A.distanceTo(S), 1.2 * Math.hypot(ox, oz));
  const v1 = 0.4, TA = 1.3 * RISE_PACE, TB = 3.2 * RISE_PACE, TC = 1.8 * RISE_PACE, TL = 1.4 * RISE_PACE;
  let D = TA + TL + (Lp - ((v1 + V_RISE) / 2) * TA - (V_RISE + V_LAST / 2) * TL) / V_RISE, vOut = V_OUT;
  const Dc = clamp$9(D, slow ? RISE_MIN : 0, RISE_MAX);
  if (Dc < D) vOut = (Lp - (v1 * TA) / 2 - (V_LAST * TL) / 2) / (Dc - TA / 2) + V_LAST;
  D = Dc;
  const Y = S.y - K1.y;
  let vc = Math.max(0.5, (Y - (v1 * TA) / 2 - (vOut * TB) / 2) / (D - TA / 2 - TB / 2));
  if (vc > vOut) vc = vOut = Math.max(0.5, (Y - (v1 * TA) / 2) / (D - TA / 2));
  const vAt = (u) => (u < TA ? v1 + (vc - v1) * smoothstep(0, TA, u) : u > D - TB ? vc + (vOut - vc) * smoothstep(D - TB, D, u) : vc);
  const m = Math.ceil(D / 0.2), h = D / m, st = h / 8, up = new Float32Array(m + 1);
  for (let k = 1; k <= m; k++) {
    up[k] = up[k - 1];
    for (let e = 0; e < 8; e++) up[k] += vAt((k - 1) * h + (e + 0.5) * st) * st;
  }
  let T0 = 0;
  while (T0 < m && K1.y + (up[T0] * Y) / up[m] < A.y - 0.5) T0++;
  const TH = clamp$9(T0 * h, 0.2, Math.max(0.2, D - stop - TC)), RISE = ORB_T0 + D;
  const vOn = (u) => smoothstep(TH, TH + TC, u) * (1 - smoothstep(D - stop, D, u)), go = new Float32Array(m + 1);
  for (let k = 1; k <= m; k++) {
    go[k] = go[k - 1];
    for (let e = 0; e < 8; e++) go[k] += vOn((k - 1) * h + (e + 0.5) * st) * st;
  }
  const K = [[0, P0.x, P0.y, P0.z], [ORB_T0 - 0.8, Ka.x, Ka.y, Ka.z], [ORB_T0, K1.x, K1.y, K1.z]];
  for (let k = 1; k <= m; k++) {
    const u = k * h, e = go[k] / go[m], f = smoothstep(0, TH, u), w = sm5((u - TH) / (0.5 * (D - TH))) * (1 - sm5((u - D + fall) / fall));
    const bx = K1.x + (K2.x - K1.x) * f, bz = K1.z + (K2.z - K1.z) * f;
    K.push([ORB_T0 + u, bx + (S.x - bx) * e + ox * w, K1.y + (up[k] * Y) / up[m], bz + (S.z - bz) * e + oz * w]);
  }
  const last = K[K.length - 1];
  last[1] = S.x; last[2] = S.y; last[3] = S.z;
  const p = new V3(), q = new V3();
  let hid = 0;
  for (let T = ORB_T0; T < RISE; T += 0.05) {
    risePos(K, T, p);
    slerpDir(MOON_W, MOON_DIR, moonSlide(RISE, T, -p.y), q);
    if (hullHides(p, q, HULL_BOX.pad)) hid += 0.05;
  }
  let rough = 0;
  for (let k = 3; k < K.length - 1; k++) {
    const a = K[k - 1], b = K[k], d = K[k + 1], ha = b[0] - a[0], hb = d[0] - b[0];
    const ax = ((d[1] - b[1]) / hb - (b[1] - a[1]) / ha) / (0.5 * (ha + hb)), az = ((d[3] - b[3]) / hb - (b[3] - a[3]) / ha) / (0.5 * (ha + hb));
    rough = Math.max(rough, Math.hypot(ax, az) * clamp$9(8 / (S.y - b[2] + 4), 0.3, 1));
  }
  return { K, RISE, hid, bend, side, fall, stop, vc, rough };
}
function risePos(K, T, out) {
  return out.set(hermiteKeys(K, T, 1), hermiteKeys(K, T, 2), hermiteKeys(K, T, 3));
}
function segDist(x, z, a, b) {
  const abx = b.x - a.x, abz = b.z - a.z, l2 = abx * abx + abz * abz;
  const h = l2 > 1e-6 ? clamp$9(((x - a.x) * abx + (z - a.z) * abz) / l2, 0, 1) : 0;
  return Math.hypot(x - a.x - abx * h, z - a.z - abz * h);
}
function moonClear(S0) {
  const b = surface && surface.boat;
  if (!b) return S0.clone();
  const g = b.group, HB = hullBreadth(), room = HULL_BOX.pad * 2;
  const n = Math.hypot(MOON_DIR.x, MOON_DIR.z), rx = -MOON_DIR.z / n, rz = MOON_DIR.x / n;
  let lo = Infinity, hi = -Infinity;
  const q = new V3();
  const at = (x, y, z, r) => {
    q.set(x, y, z).applyQuaternion(g.quaternion).add(g.position);
    const lat = (q.x - S0.x) * rx + (q.z - S0.z) * rz;
    lo = Math.min(lo, lat - r);
    hi = Math.max(hi, lat + r);
  };
  for (let yi = 0; yi < HB_NY; yi++) {
    for (let zi = 0; zi < HB_NZ; zi++) {
      const hb = HB[yi * HB_NZ + zi];
      if (hb > 0) for (const x of [-hb, hb]) at(x, HB_Y0 + yi * HB_DY, HB_Z0 + zi * HB_DZ, room);
    }
  }
  const pg = b.props && b.props.geometry;
  if (pg) {
    if (!pg.boundingBox) pg.computeBoundingBox();
    for (const z of [HULL_BOX.hz, pg.boundingBox.max.z]) for (const x of [-0.15, 0.15]) at(x, 1.5, z, HULL_BOX.pad);
  }
  if (hi < 0 || lo > 0) return S0.clone();
  const d = hi < -lo ? hi : lo;
  return S0.clone().set(S0.x + rx * d, S0.y, S0.z + rz * d);
}
const HULL_BOX = { hx: 1.9, hz: 5.9, y0: -1.25, y1: 1.45, pad: 0.5 };
const HB_Z0 = -6, HB_DZ = 0.25, HB_NZ = 49, HB_Y0 = -1.4, HB_DY = 0.15, HB_NY = 21;
let _hullHB = null;
function hullBreadth() {
  if (_hullHB) return _hullHB;
  const T = new Float32Array(HB_NZ * HB_NY), p = new V3();
  for (let i = 0; i <= 100; i++) {
    for (let k = 0; k <= 50; k++) {
      hullPoint(i / 50 - 1, k / 50, 1, p);
      const zi = Math.round((p.z - HB_Z0) / HB_DZ), yi = Math.round((p.y - HB_Y0) / HB_DY);
      if (zi >= 0 && zi < HB_NZ && yi >= 0 && yi < HB_NY) T[yi * HB_NZ + zi] = Math.max(T[yi * HB_NZ + zi], p.x);
    }
  }
  return (_hullHB = T);
}
const _hbP = new V3(), _hbD = new V3(), _hbQ = new THREE.Quaternion(), _hbLo = [0, 0, 0], _hbHi = [0, 0, 0];
function hullHides(p, u, pad = 0) {
  if (!surface || !surface.boat) return false;
  const g = surface.boat.group, H = HULL_BOX, HB = hullBreadth();
  _hbQ.copy(g.quaternion).invert();
  _hbP.subVectors(p, g.position).applyQuaternion(_hbQ);
  _hbD.copy(u).applyQuaternion(_hbQ);
  _hbLo[0] = -1.9 - pad; _hbLo[1] = H.y0 - pad; _hbLo[2] = -5.9 - pad;
  _hbHi[0] = H.hx + pad; _hbHi[1] = H.y1 + pad; _hbHi[2] = H.hz + pad;
  let t0 = 0, t1 = Infinity;
  for (let k = 0; k < 3; k++) {
    const o = _hbP.getComponent(k), d = _hbD.getComponent(k);
    if (Math.abs(d) < 1e-9) { if (o < _hbLo[k] || o > _hbHi[k]) return false; continue; }
    let a = (_hbLo[k] - o) / d, b = (_hbHi[k] - o) / d;
    if (a > b) { const s = a; a = b; b = s; }
    t0 = Math.max(t0, a);
    t1 = Math.min(t1, b);
    if (t0 > t1) return false;
  }
  const n = Math.max(1, Math.ceil((t1 - t0) / 0.1)), rz = Math.round(pad / HB_DZ), ry = Math.round(pad / HB_DY);
  for (let i = 0; i <= n; i++) {
    const t = t0 + ((t1 - t0) * i) / n, x = Math.abs(_hbP.x + _hbD.x * t);
    const zi = Math.round((_hbP.z + _hbD.z * t - HB_Z0) / HB_DZ), yi = Math.round((_hbP.y + _hbD.y * t - HB_Y0) / HB_DY);
    for (let b = Math.max(0, yi - ry); b <= Math.min(HB_NY - 1, yi + ry); b++) {
      for (let a = Math.max(0, zi - rz); a <= Math.min(HB_NZ - 1, zi + rz); a++) {
        const hb = HB[b * HB_NZ + a];
        if (hb > 0 && x < hb + pad) return true;
      }
    }
  }
  return false;
}
new V3();

const ORB_T0 = 3.3, ORB_X = 0.28, ORB_DV = 0.9 / RISE_PACE;
const SUN_SHORT = 40 * DEG$3;
let _mLit = null;
function moonLit() {
  if (!_mLit) {
    const L = dirAzEl(SUN_AZ_RISE, FIN_SUN[0][1] * DEG$3, new V3()), A = new V3().crossVectors(MOON_DIR, _yAxis).normalize(), B = new V3().crossVectors(A, MOON_DIR);
    _mLit = new V3(L.dot(A), L.dot(B), -L.dot(MOON_DIR)).normalize();
  }
  return _mLit;
}
const LOOK_T1 = riseAt(1.8), LOOK_TAU = 0.8;
const SLIDE_T0 = -6 * RISE_PACE, SLIDE_T1 = -0.8 * RISE_PACE, SLIDE_K = 0.66, SLIDE_D = 7.0;
function moonSlide(RISE, T, depth) {
  const sl0 = Math.max(RISE + SLIDE_T0, LOOK_T1 + 0.3 * RISE_PACE);
  return SLIDE_K * sm5((T - sl0) / (RISE + SLIDE_T1 - sl0)) + (1 - SLIDE_K) * sm5((SLIDE_D - depth) / (SLIDE_D - 0.12));
}
const _oP = new V3(), _oF = new V3(), _oE = new V3(), _oS = new V3();
function slerpDir(a, b, s, out) {
  const th = Math.acos(clamp$9(a.dot(b), -1, 1));
  if (th < 1e-4) return out.copy(a).lerp(b, s).normalize();
  const k = Math.sin(th);
  return out.copy(a).multiplyScalar(Math.sin((1 - s) * th) / k).addScaledVector(b, Math.sin(s * th) / k);
}
const _sN = new V3(), _sI = new V3(), _sH = new V3();
function swellMoon(cam, u, t, out) {
  const d = Math.max(0, -cam.y) / Math.max(u.y, 0.2);
  const x = cam.x + u.x * d, z = cam.z + u.z * d;
  const [sx, sz] = waveSlope(x, z, t);
  _sN.set(-sx, 1, -sz).normalize();
  _sI.copy(MOON_DIR).negate();
  const eta = 1 / 1.333, ci = -_sN.dot(_sI), k = 1 - eta * eta * (1 - ci * ci);
  if (k <= 0) out.copy(u);
  else out.copy(_sI).multiplyScalar(eta).addScaledVector(_sN, eta * ci - Math.sqrt(k)).negate().normalize();
  _sH.set(MOON_DIR.x, 0, MOON_DIR.z).normalize();
  const a = waveSlope(x + _sH.x * 1.5, z + _sH.z * 1.5, t), b = waveSlope(x - _sH.x * 1.5, z - _sH.z * 1.5, t);
  return 1 + clamp$9(((a[0] - b[0]) * _sH.x + (a[1] - b[1]) * _sH.z) * 4, -0.3, 0.3);
}
function updateOrb(T, t, dt) {
  const R = G.fin, O = R.orb, cam = camera.position;
  if (magic$1) magic$1.moonLift = smoothstep(ORB_T0 + ORB_X, ORB_T0 + ORB_X + 1.2, T);
  if (!moonOrb) return;
  const beadOn = T < ORB_T0 + ORB_X && !!magic$1 && !!magic$1.moonBead && magic$1.moonBead(O.bead, cam);
  if (T < ORB_T0) {
    moonOrb.visible = false;
    SKY_UNIFORMS.uMoonWin.value = 0;
    if (magic$1) magic$1.moonHand = 0;
    if (beadOn) { O.rho = O.bead.r / Math.max(O.bead.p.distanceTo(cam), 0.1); O.look.subVectors(O.bead.p, cam).normalize(); }
    return;
  }
  if (!O.took) { O.took = true; O.a0 = O.bead.a; O.dark0 = O.bead.dark; O.d0 = Math.max(0.3, O.bead.p.distanceTo(cam)); }
  const hand = smoothstep(ORB_T0, ORB_T0 + ORB_X, T);
  if (magic$1) magic$1.moonHand = hand;
  const p = _oP;
  const wy = waveHeight(cam.x, cam.z, t);
  const s = (O.s = sm5((cam.y - wy + 4.2) / 4.08));
  slerpDir(R.moonW, MOON_DIR, moonSlide(R.RISE, T, wy - cam.y), O.app);
  const st = swellMoon(cam, O.app, t, _oS), sw = (1 - s) * smoothstep(riseAt(1.4), riseAt(3.4), T);
  _oE.subVectors(_oS, O.app).multiplyScalar(0.3).clampLength(0, 0.022);
  const kw = 1 - Math.exp(-dt / 0.35);
  O.wand.lerp(_oE, kw);
  O.dir.copy(O.app).addScaledVector(O.wand, sw).normalize();
  O.stretch = lerp$4(O.stretch, lerp$4(1, st, sw), kw);
  const Ls = Math.max(wy - cam.y, 0) / Math.max(O.app.y, 0.2);
  p.copy(cam).addScaledVector(O.dir, Math.max(Math.min(O.d0 + ORB_DV * (T - ORB_T0), Ls), 0.3));
  O.look.copy(O.app);
  const d = p.distanceTo(cam);
  moonOrb.position.copy(p);
  ORB_U.uC.value.copy(_oF.subVectors(p, cam).normalize());
  const rho = lerp$4(O.rho, MOON_R, Math.max(s, smoothstep(riseAt(0.3), riseAt(2.0), T)));
  ORB_U.uRho.value = rho;
  ORB_U.uSize.value = ORB_U.uQ.value * rho * d;
  const k = smoothstep(riseAt(1.4), riseAt(3.4), T);
  ORB_U.uK.value = k;
  ORB_U.uL.value.copy(moonLit());
  ORB_U.uOrr.value.set(O.a0, O.dark0 * (1 - smoothstep(riseAt(0.5), riseAt(1.7), T)), 5.0);
  const ab = post.compMat.uniforms.uAbs.value;
  const Lw = Math.max(wy - cam.y, 0) / Math.max(_oF.y, 0.2), Le = (Lw * 5.5) / (Lw + 5.5);
  const b0 = Math.exp(-ab.x * d * 0.3), b1 = Math.exp(-ab.y * d * 0.3), b2 = Math.exp(-ab.z * d * 0.3);
  ORB_U.uVeil.value.set(lerp$4(b0, Math.exp((-ab.x * Le * Le) / (Le + 4.5)), k), lerp$4(b1, Math.exp(-ab.y * Le), k), lerp$4(b2, Math.exp(-ab.z * Le), k));
  const vv = ORB_U.uVeil.value;
  ORB_U.uOcc.value = clamp$9(0.2126 * vv.x + 0.7152 * vv.y + 0.0722 * vv.z, 0.3, 1) * lerp$4(1, lerp$4(0.12, 1, G.breached ? smoothstep(0.0, 0.3, G.breachT) : 0), k);
  const dep = Math.max(wy - cam.y, 0), u = 1 - s;
  ORB_U.uImg.value.set(lerp$4(1, 0.92, u), lerp$4(1, 0.62 * O.stretch, u), u * lerp$4(0.16, 0.42, smoothstep(0.5, 12, dep)), u * lerp$4(0.16, 0.5, smoothstep(0.5, 10, dep)));
  ORB_U.uGlim.value.set(1.6 * u * smoothstep(0.8, 5, dep), lerp$4(2.2, 4.2, smoothstep(2, 12, dep)), u * smoothstep(1.2, 9, dep));
  const out = G.breached ? smoothstep(0.08, 0.5, G.breachT) : 0;
  const nr = smoothstep(6.5, 0.8, dep) * (1 - out) * k;
  if (nr > 0) {
    const ta = t * 1.0;
    const jx = 0.55 * Math.sin(ta * 2.1 + 0.7) + 0.22 * Math.sin(ta * 3.7 + 2.9) + 0.08 * Math.sin(ta * 6.3 + 1.1);
    const jy = 0.75 * Math.sin(ta * 1.6 + 2.1) + 0.25 * Math.sin(ta * 4.1 + 0.4) + 0.08 * Math.sin(ta * 7.1 + 3.3);
    const sy = 1 + nr * (0.55 + 0.35 * Math.sin(ta * 2.6 + 1.3) + 0.06 * Math.sin(ta * 5.3));
    const sx = 1 + nr * (0.12 * Math.sin(ta * 3.1 + 0.4) - 0.06);
    ORB_U.uImg.value.x *= sx;
    ORB_U.uImg.value.y *= sy;
    ORB_U.uImg.value.z += nr * 0.42;
    ORB_U.uDance.value.set(nr * jx, nr * jy, nr * 0.75, nr * 0.55);
    ORB_U.uGlim.value.x = Math.max(ORB_U.uGlim.value.x, 0.7 * nr);
    ORB_U.uGlim.value.y = Math.max(ORB_U.uGlim.value.y, 2.6);
  } else ORB_U.uDance.value.set(0, 0, 0, 0);
  ORB_U.uWob.value.set(t * 1.7, Math.max(u * lerp$4(0.6, 1.0, smoothstep(0.5, 8, dep)), 0.75 * nr), 0);
  O.hid = (O.hid || 0) + ((hullHides(cam, O.dir, 0) ? 1 : 0) - (O.hid || 0)) * (1 - Math.exp(-dt / 0.1));
  ORB_U.uA.value = hand * (1 - out) * (1 - O.hid);
  SKY_UNIFORMS.uMoonWin.value = out;
  moonOrb.visible = ORB_U.uA.value > 0.002;
}

const _lkV = new V3(), _lkA = new V3(), _lkD = new V3();
function lookSpring(target, dt, maxW) {
  if (!G.lookS) { G.lookS = new V3(0, 0, -1).applyQuaternion(camera.quaternion); G.lookSV = new V3(); }
  if (!G.lookT) { G.lookT = target.clone(); G.lookTV = new V3(); }
  if (dt <= 0) return;
  const lw = 2.4;
  _lkV.subVectors(target, G.lookT).divideScalar(dt).clampLength(0, 1.2);
  _lkA.subVectors(_lkV, G.lookTV).divideScalar(dt).clampLength(0, 3);
  G.lookTV.copy(_lkV);
  G.lookT.copy(target);
  _lkD.subVectors(_lkV, G.lookSV).multiplyScalar(2 * lw).addScaledVector(_cd.subVectors(target, G.lookS), lw * lw).add(_lkA);
  G.lookSV.addScaledVector(_lkD, dt);
  if (maxW) G.lookSV.clampLength(0, maxW);
  G.lookS.addScaledVector(G.lookSV, dt).normalize();
}

function updateEclipse(dt, t) {
  mg((m) => audio$1.eclipseAt?.(m.alignT, m.flashDone));
  const R = G.fin;
  const T = G.st;
  const RISE = R.RISE;
  if (diver$1 && diver$1.setTetherFade) diver$1.setTetherFade(T < RISE && !G.breached ? 1 - smoothstep(0.8, 1.8, T) : 1);
  if (G.breached) G.breachT += dt;
  if (T < RISE) {
    const x = clamp$9(T / RISE, 0, 1);
    const pos = risePos(R.K, T, _rp);
    if (G.finV0) pos.addScaledVector(G.finV0, T * Math.exp(-T / 0.7));
    pos.y += waveHeight(pos.x, pos.z, t) * 0.85 * smoothstep(RISE - 1.1, RISE, T);
    camera.position.copy(pos);
    G.clear = smoothstep(riseAt(0.3), riseAt(2.4), T);
    setSun(SUN_AZ_SET + wrapA(SUN_AZ_RISE - SUN_AZ_SET) * smoothstep(0.15, 0.5, x), lerp$4(-5, -12, smoothstep(0, 0.6, x)) * DEG$3);
    updateOrb(T, t, dt);
    post.setDof(0.93, 0, dt);
    if (diver$1) crankDiver(dt, t, true);
    const oa = moonOrb && moonOrb.visible ? ORB_U.uA.value * (1 - smoothstep(riseAt(2.7), riseAt(4.7), T)) : 0;
    const wk = smoothstep(riseAt(-0.1), riseAt(1.1), T);
    if (!G.glowHome) G.glowHome = glowLight.position.clone();
    if (moonOrb) glowLight.position.lerpVectors(G.glowHome, moonOrb.position, wk);
    glowLight.color.setRGB(lerp$4(1.0, 0.72, wk), lerp$4(0.76, 0.86, wk), lerp$4(0.48, 1.0, wk));
    glowLight.intensity = lerp$4(1.6, 2.6 * oa, wk);
    if (!G.orrFlat && T > ORB_T0) { G.orrFlat = true; mg((m) => m.setFacing && m.setFacing(m.nS)); }
    if (T < ORB_T0) {
      const wDial = 1 - smoothstep(0.0, 1.1, T);
      _ot.copy(R.O).add(G.site.E).multiplyScalar(0.5);
      _ot.y -= 0.2;
      _ot.y += bandOrrery(pos, _ot, 1 - wDial);
      _lk.set(0, 0, 0).addScaledVector(dirTo(R.dial, _cd), wDial).addScaledVector(dirTo(_ot, _cd), 1 - wDial).normalize();
    } else {
      if (!R.look0) {
        R.look0 = (G.lookT || G.lookS).clone();
        R.lookV0 = G.lookTV ? G.lookTV.clone() : new V3();
        R.lookT0 = T - dt;
      }
      _lb.copy(R.look0).addScaledVector(R.lookV0, LOOK_TAU * (1 - Math.exp(-(T - R.lookT0) / LOOK_TAU))).normalize();
      slerpDir(_lb, R.orb.app, 0.5 - 0.5 * Math.cos(Math.PI * clamp$9((T - ORB_T0) / (LOOK_T1 - ORB_T0), 0, 1)), _lk);
      finLookLead(T - RISE, _lk, ORB_T0 - RISE);
    }
    lookSpring(_lk, dt, 0.75);
    softElev(_lk.copy(G.lookS), 64 * DEG$3, R.moonH);
    const kIn = T > ORB_T0 ? smoothstep(ORB_T0, RISE, T) : 0;
    if (kIn > 0) turnLook(_lk, kIn * finKeep(R.S, Math.atan2(_lk.x, -_lk.z), 0, 1));
    camera.quaternion.copy(lookQ(pos, _rt.copy(pos).add(_lk)));
    if (!G.orbOff && pos.y > R.O.y + 3.5) { G.orbOff = true; mg((m) => { m.orrery(false); m.setCharge(0.15); }); }
    if (!G.lbOff && T > RISE - 4.8 * RISE_PACE) { G.lbOff = true; UI.letterbox(false, 2.8 * RISE_PACE); }
    if (G.breached) beadLights(-12);
    if (pos.y < -1.2 && G.dark > 0.5) fx.plankton(pos, (G.dark - 0.5) * 2.0, dt);
  } else {
    const T2 = T - RISE;
    finaleShot(T2, t, dt);
    if (moonOrb && moonOrb.visible) updateOrb(T, t, dt);
    if (!G.finLine && T2 > 0.8) { G.finLine = true; UI.title('<span class="hl-l">The</span> <span class="hl-l">Antikythera</span> <span class="hl-l">mechanism</span>', { hold: 4200, name: true, html: true }); }
    if (diver$1) crankDiver(dt, t, true);
    if (T2 > END_T2) { const over = T2 - END_T2; setState('end'); G.endOff = over; }
  }
  if (!G.breached && camera.position.y > waveHeightDisp(camera.position.x, camera.position.z, t) + 0.02) {
    G.breached = true;
    G.breachT = 0;
    G.wet = 1;
    if (fx.breach) fx.breach(camera);
    audio$1.surfaceBreach();
    audio$1.setMode('surface');
    if (audio$1.drips) audio$1.drips();
  }
  if (G.breached && audio$1.setNight) audio$1.setNight(G.dark);
}

const END_AZ = 79.6 * DEG$3, END_EL = -6.1 * DEG$3, END_FOV = 48;
const FIN_LOOK = [
  [-1.6, MOON_AZ, MOON_EL],
  [1.8, BREACH_AZ, 11 * DEG$3],
  [5.0, 86 * DEG$3, 2.5 * DEG$3],
  [6.6, 81 * DEG$3, 1.5 * DEG$3],
  [9.8, 80.3 * DEG$3, 0.3 * DEG$3],
  [12.5, END_AZ, END_EL],
  [14.5, END_AZ - 0.1 * DEG$3, END_EL],
  [54.0, END_AZ - 2 * DEG$3, END_EL],
];
function finLookT(T2) {
  const t0 = FIN_LOOK[0][0], h = FIN_LOOK[1][0] - t0, u = (T2 - t0) / h;
  return u <= 0 ? t0 : u >= 1 ? T2 : t0 + h * u * u * (2 - u);
}
const _flL = [0, 0], _flR = [0, 0];
function finLookLead(T2, look, T2a) {
  const lead = (t, out) => { const lt = finLookT(t); out[0] = hermiteKeys(FIN_LOOK, lt, 1) - FIN_LOOK[0][1]; out[1] = hermiteKeys(FIN_LOOK, lt, 2) - FIN_LOOK[0][2]; return out; };
  let da, de;
  if (T2 >= 0) { lead(T2, _flL); da = _flL[0]; de = _flL[1]; }
  else {
    lead(0, _flL); lead(0.01, _flR);
    const ease = (c0, c1) => {
      const v = (c1 - c0) / 0.01, D = Math.min(-T2a, Math.abs(v) > 1e-6 ? Math.abs((3 * c0) / v) : -T2a), x = clamp$9((T2 + D) / D, 0, 1);
      return c0 * x * x * (3 - 2 * x) + v * D * x * x * (x - 1);
    };
    da = ease(_flL[0], _flR[0]); de = ease(_flL[1], _flR[1]);
  }
  const az = Math.atan2(look.x, -look.z) + da, el = Math.asin(clamp$9(look.y, -1, 1)) + de;
  return dirAzEl(az, el, look);
}
const FIN_POS = [
  [0.0, 0, 0.45, 0],
  [3.5, -0.12, 0.5, -0.02],
  [6.5, -0.8, 0.8, -0.08],
  [9.5, -6.5, 2.2, 0.4],
  [14.0, -14.5, 3.3, 0.9],
  [54.0, -18, 3.7, 1.1],
];
const GLIDE_T0 = 14, GLIDE_TAU = 4.15, GLIDE_EASE = 10;
const GLIDE_W = (2 * Math.PI) / 96;
const GLIDE = { side: 2.4, bias: 1.0, up: 0.6, upRate: 1.5, pivot: 70 };
const END_F = new V3(Math.sin(END_AZ), 0, -Math.cos(END_AZ)), END_R = new V3(Math.cos(END_AZ), 0, Math.sin(END_AZ));
const FIN_V = [1, 2, 3].map((j) => (hermiteKeys(FIN_POS, GLIDE_T0, j) - hermiteKeys(FIN_POS, GLIDE_T0 - 1e-3, j)) / 1e-3);
const _glide = new V3();
function endGlide(T2, out) {
  const s = Math.max(0, T2 - GLIDE_T0), u = Math.min(1, s / GLIDE_EASE), g = GLIDE;
  const ph = GLIDE_W * (s < GLIDE_EASE ? GLIDE_EASE * (u * u * u - 0.5 * u * u * u * u) : s - 0.5 * GLIDE_EASE);
  return out.set(g.side * Math.sin(ph) + g.bias * (1 - Math.cos(ph)), g.up * (1 - Math.cos(ph * g.upRate)), -1.6 * (1 - Math.cos(ph)));
}
const FIN_SUN = [[0, -12], [1.5, -11.2], [3.5, -7.2], [5.2, -3.2], [6.4, -1], [8.8, 0.3], [14, 1.5], [22, 2.6], [40, 4.2], [80, 5]];
const finSunEl = (T2) => hermiteKeys(FIN_SUN, T2, 1);
const END_T2 = 6.3;
const END_MORE = END_T2 + 3.0;
const _endP = new V3(), _endL = new V3(), _endT = new V3();
const END_SUNX = 0.15;
const END_WIDE = 1.2;
function endAspectYaw(p, az) {
  const a = camera.aspect;
  if (a >= 1.77) return 0;
  const vt = Math.tan((camera.fov * DEG$3) / 2), h169 = vt * 1.7778, ha = vt * a;
  const tb = wrapA(Math.atan2(LAYOUT.boat.x - p.x, -(LAYOUT.boat.z - p.z)) - az);
  const want = FRAME.y(Math.tan(tb) / h169 - 0.1 * clamp$9((1.78 - a) / 0.6, 0, 1), 0.36);
  const sunRoom = wrapA(SUN_AZ_RISE - az) - Math.atan(END_SUNX * ha);
  return clamp$9(tb - Math.atan(want * ha), 0, clamp$9(sunRoom, 0, FRAME.y(12, 24) * DEG$3));
}
const endSunX = (a) => Math.min(0.8, 0.36 + 0.45 / a);
function endSunAz(az) {
  const ha = Math.tan((camera.fov * DEG$3) / 2) * camera.aspect;
  const to = SUN_AZ_RISE + Math.atan(endSunX(camera.aspect) * ha), w = 4 * DEG$3, d = (az - to) / w;
  return to + w * (d > 30 ? d : Math.log1p(Math.exp(d)));
}
const FIN_DOF = [80, 36, 3.4, 5.3];
const FIN_SHARP = 0.45;
const FIN_FAR = [0.7, 1.3, 3.6, 5.2];
const FIN_ON = 5;
const FIN_MID = [2.5, 14, 35, 250];
const FIN_NEAR = 0.75;
const FIN_FOOT = [0.5, 0.75, 1, 1.3];
const FIN_BOAT = [3.5, 8];
const DOF_MOON = 400;
const _fdB = new V3(), _fdR = new V3(), _fdQ = new THREE.Quaternion();
function finDof(T2, t, dt) {
  const p = camera.position, ty = Math.tan((camera.fov * DEG$3) / 2);
  _fdR.set(0, -ty, -1).applyQuaternion(camera.quaternion);
  let dn = 0;
  if (_fdR.y < 0) {
    const s = Math.max(0.2, p.y - waveHeightDisp(p.x, p.z, t)) / -_fdR.y;
    let h = -1;
    for (const f of FIN_FOOT) h = Math.max(h, waveHeightDisp(p.x + _fdR.x * s * f, p.z + _fdR.z * s * f, t));
    dn = -_fdR.y / Math.max(0.2, p.y - h);
  }
  let zB = 0;
  if (surface && surface.boat) {
    const bp = surface.boat.group.position, r = FIN_BOAT[1], tx = ty * camera.aspect;
    _fdB.set(bp.x, bp.y + FIN_BOAT[0], bp.z).sub(p).applyQuaternion(_fdQ.copy(camera.quaternion).invert());
    const z = -_fdB.z;
    if (z > -r && Math.abs(_fdB.x) < z * tx + r * Math.hypot(1, tx) && Math.abs(_fdB.y) < z * ty + r * Math.hypot(1, ty)) zB = Math.max(z, r + 1);
  }
  const [a0, a1, ta, tb] = FIN_DOF, [f0, f1, tc, td] = FIN_FAR;
  const cf = lerp$4(f0, f1, smoothstep(tc, td, T2));
  const dp = (zB > 0 ? 1 / Math.max(3, zB - FIN_ON) : Math.max((cf / (FIN_NEAR + cf)) * dn, 1 / DOF_MOON)) * (1 + 0.045 * (1 + Math.sin(t * 0.43)) * smoothstep(10, 14, T2));
  const D = G.breached ? Math.min(lerp$4(a0, a1, smoothstep(ta, tb, T2)), cf / dp) * smoothstep(0, 0.7, G.breachT) : 0;
  const zR = zB > 0 ? zB : 14;
  post.setBokehShape(FIN_NEAR, Math.max(FIN_MID[2], FIN_MID[0] * zR), Math.max(FIN_MID[3], FIN_MID[1] * zR));
  post.setDof(1 / dp, (D * dp) / 8, dt, 1, dn > 0 && !(zB > 0) ? (1 + Math.max(FIN_SHARP, FIN_NEAR) / Math.max(D * dp, 1e-6)) / dn : Infinity);
}
const _blP = new V3();
function beadLights(sunEl) {
  const gu = post.gradeMat.uniforms;
  camera.updateMatrixWorld();
  const put = (p, k, u) => {
    p.project(camera);
    u.value.set((p.x * 0.5 + 0.5) * camera.aspect, p.y * 0.5 + 0.5, p.z < 1 ? k : 0, 0);
  };
  put(_blP.copy(MOON_DIR).add(camera.position), 0.18 * (1 - smoothstep(-3, 1, sunEl)), gu.uBeadMoon);
  put(_blP.copy(sunDir).add(camera.position), 2.2 * smoothstep(-1.4, 0.6, sunEl), gu.uBeadSun);
  put(_blP.copy(surface.lampW), 0.16 * surface.night, gu.uBeadLamp);
}
const ISLE_T = [8, 44], ISLE_TURN = -62 * DEG$3;
function endIsleK(T2) {
  const u = clamp$9((T2 - ISLE_T[0]) / (ISLE_T[1] - ISLE_T[0]), 0, 1), k = u * u * (3 - 2 * u);
  const o = G.state === 'end' ? G.eo : null;
  if (!o || o.tookT < 0 || o.isle === undefined) { if (o) o.isle = o.isleK = k; return k; }
  o.isle += (k - o.isleK) * (1 - smoothstep(0, KEEP_LET, o.tookT));
  o.isleK = k;
  return o.isle;
}
function finaleShot(T2, t, dt) {
  setSun(SUN_AZ_RISE, finSunEl(T2) * DEG$3);
  G.lensAdd = (END_FOV - 60) * smoothstep(6.5, 13, T2);
  const S = G.fin ? G.fin.S : surfacePoint(), S0 = (G.fin && G.fin.S0) || S;
  const tp = Math.min(T2, GLIDE_T0);
  const y = hermiteKeys(FIN_POS, tp, 2);
  const onWater = 1 - smoothstep(0.7, 2.4, y);
  const sway = onWater * smoothstep(0, 2, T2);
  const kE = FRAME.reach(END_FOV), u = smoothstep(12, 20, T2), ox = S.x + (S0.x - S.x) * u, oz = S.z + (S0.z - S.z) * u;
  _endP.set(ox + hermiteKeys(FIN_POS, tp, 1) * kE + Math.sin(t * 0.37) * 0.08 * sway, y, oz + hermiteKeys(FIN_POS, tp, 3) * kE + Math.cos(t * 0.29) * 0.06 * sway);
  const sr = FRAME.tall > 0 ? sunriseKeep(T2, dt, _endP, hermiteKeys(FIN_LOOK, Math.min(T2, 60), 1)) : 0;
  _endP.y += waveHeight(_endP.x, _endP.z, t) * 0.85 * onWater;
  if (G.fin && G.fin.vEnd) _endP.addScaledVector(G.fin.vEnd, T2 * Math.exp(-T2 / 0.45));
  let glideYaw = 0;
  if (T2 > GLIDE_T0) {
    const k = GLIDE_TAU * (1 - Math.exp(-(T2 - GLIDE_T0) / GLIDE_TAU));
    _endP.x += FIN_V[0] * k * kE;
    _endP.y += FIN_V[1] * k;
    _endP.z += FIN_V[2] * k * kE;
    endGlide(T2, _glide);
    _endP.addScaledVector(END_R, _glide.x).addScaledVector(END_F, _glide.z);
    _endP.y += _glide.y;
    glideYaw = -Math.atan2(_glide.x, GLIDE.pivot - _glide.z);
  }
  const lt = finLookT(Math.min(T2, 54));
  const baseAz = hermiteKeys(FIN_LOOK, lt, 1) + glideYaw;
  const az = camera.aspect >= END_WIDE ? endSunAz(baseAz) : baseAz + endAspectYaw(_endP, baseAz) * smoothstep(6.5, 13, T2);
  const isle = T2 > ISLE_T[0] ? ISLE_TURN * endIsleK(T2) : 0;
  if (isle) {
    const c = Math.cos(isle), s = Math.sin(isle), dx = _endP.x - LAYOUT.boat.x, dz = _endP.z - LAYOUT.boat.z;
    _endP.x = LAYOUT.boat.x + dx * c - dz * s;
    _endP.z = LAYOUT.boat.z + dz * c + dx * s;
  }
  dirAzEl(az + isle, hermiteKeys(FIN_LOOK, lt, 2), _endL);
  if (G.lookS && dt > 0) {
    lookSpring(_endL, dt, 0);
    softElev(_endL.copy(G.lookS), 64 * DEG$3, G.fin ? G.fin.moonH : _endL);
    turnLook(_endL, endKeep(finKeep(_endP, Math.atan2(_endL.x, -_endL.z), sr, 1 - smoothstep(5, 9, T2)), dt));
  }
  if (G.state === 'end' && G.eo) endOrbit(_endP, _endL, t, dt);
  camera.position.copy(_endP);
  camera.quaternion.copy(lookQ(_endP, _endT.copy(_endP).add(_endL), Math.sin(t * 0.8) * 0.018 * onWater * smoothstep(0, 1.5, T2)));
  finDof(T2, t, dt);
  beadLights(finSunEl(T2));
  if (audio$1.dawn) audio$1.dawn(finSunEl(T2)); else if (audio$1.sunrise) audio$1.sunrise(clamp$9((T2 - 2) / 10, 0, 1));
  if (audio$1.setNight) audio$1.setNight(G.dark);
}
function updateEnd(dt, t) {
  const T2 = END_T2 + (G.endOff || 0) + G.st;
  finaleShot(T2, t, dt);
  if (diver$1) crankDiver(dt, t, true);
  if (!G.endMore && T2 > END_MORE) { G.endMore = true; UI.endMore(); }
  if (G.endMore && !G.endHintOn && T2 > END_MORE + 1.4) { G.endHintOn = true; UI.endHint(!!(G.eo && G.eo.used)); }
}

const EO = { pivot: 17, pitch: [-0.16, 0.5], dolly: [-0.55, 0.5], rate: 2.6, w: 12, sea: 0.4, tap: 12 };
const EO_KEYS = ['yaw', 'pitch', 'dolly'];
const _eoP = new V3(), _eoA = new V3(), _eoR = new V3(), _eoQ = new THREE.Quaternion();
function endOrbit(p, l, t, dt) {
  const o = G.eo;
  const w = EO.w, n = Math.ceil(dt * 120), h = dt / Math.max(n, 1);
  let any = 0;
  for (const k of EO_KEYS) {
    for (let i = 0; i < n; i++) {
      o.v[k] += (w * w * (o.want[k] - o.at[k]) - 2 * w * o.v[k]) * h;
      o.at[k] += o.v[k] * h;
    }
    any += Math.abs(o.at[k]) + Math.abs(o.v[k]);
  }
  if (any < 1e-6) return;
  const s = EO.sea, e0 = p.y - waveHeight(p.x, p.z, t) - 1.1 - s / 2;
  _eoP.copy(p).addScaledVector(l, EO.pivot);
  _eoA.subVectors(p, _eoP).multiplyScalar(Math.exp(o.at.dolly));
  _eoR.crossVectors(l, _yAxis).normalize();
  _eoQ.setFromAxisAngle(_eoR, -o.at.pitch);
  _eoA.applyQuaternion(_eoQ);
  _eoQ.setFromAxisAngle(_yAxis, o.at.yaw);
  _eoA.applyQuaternion(_eoQ);
  p.copy(_eoP).add(_eoA);
  const m = Math.min(0, e0) - Math.max(0.2 - Math.abs(e0), 0) ** 2 / 0.8;
  const f = waveHeight(p.x, p.z, t) + 1.1 + s / 2 + m, e = p.y - f;
  if (e < 0) p.y = f + (e > -s ? e + e * e / (2 * s) : -s / 2);
  l.subVectors(_eoP, p).normalize();
}
function endUsed() {
  const o = G.eo;
  if (o.used) return;
  o.used = true;
  if (G.endHintOn) UI.endHint(true);
}
function endTook(o) {
  if (o.tookT < 0) o.tookT = 0;
}
function endGrab(e) {
  const o = G.eo;
  if (!o) return;
  try { canvas.setPointerCapture(e.pointerId); } catch (err) {  }
  o.ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY });
  if (o.ptrs.size === 2) {
    const [a, b] = [...o.ptrs.values()];
    o.pinch = Math.hypot(a.x - b.x, a.y - b.y);
    o.pinch0 = o.want.dolly;
  }
}
function endDrag(e) {
  const o = G.eo, q = o && o.ptrs.get(e.pointerId);
  if (!q) return;
  const dx = e.clientX - q.x, dy = e.clientY - q.y;
  q.x = e.clientX;
  q.y = e.clientY;
  if (o.ptrs.size >= 2) {
    const [a, b] = [...o.ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
    if (o.pinch > 1 && d > 1) o.want.dolly = clamp$9(o.pinch0 - Math.log(d / o.pinch), EO.dolly[0], EO.dolly[1]);
  } else {
    const r = canvas.getBoundingClientRect(), k = EO.rate / Math.max(r.width, 1);
    o.want.yaw -= dx * k;
    o.want.pitch = clamp$9(o.want.pitch + dy * k, EO.pitch[0], EO.pitch[1]);
    if (Math.hypot(o.want.yaw, o.want.pitch) >= EO.tap * k) endTook(o);
  }
  if (Math.hypot(q.x - q.x0, q.y - q.y0) >= EO.tap) endTook(o);
  o.moved += Math.abs(dx) + Math.abs(dy);
  if (o.moved > 14) endUsed();
}
function endLetGo(e) {
  const o = G.eo;
  if (!o || !o.ptrs.delete(e.pointerId)) return;
  if (o.ptrs.size < 2) o.pinch = 0;
  if (G.endMore) try { document.getElementById('again').focus({ preventScroll: true }); } catch (err) {  }
}

const _focus = new V3(), _lx = new V3(), _ly = new V3(), _yAxis = new V3(0, 1, 0), _zAxis = new V3(0, 0, 1);
const cUnderSun = new THREE.Color(0.9, 1.0, 1.0), cAirSun = new THREE.Color(1.0, 0.95, 0.88);
const cHemiSkyU = new THREE.Color(0.2, 0.56, 0.9), cHemiGndU = new THREE.Color(0.05, 0.12, 0.14);
const cSandBounce = new THREE.Color(0.8, 0.9, 0.74);
const cHemiSkyA = new THREE.Color(0.62, 0.8, 1.0), cHemiGndA = new THREE.Color(0.32, 0.4, 0.44);
const _sl = { sunColor: new THREE.Color(), hemiSky: new THREE.Color(), hemiGround: new THREE.Color(), haze: new THREE.Color(), envTint: new THREE.Color() };
const cMoonLight = new THREE.Color(0.58, 0.68, 0.95), cDuskSun = new THREE.Color(1.0, 0.5, 0.26);
const cHemiSkyN = new THREE.Color(0.1, 0.15, 0.28), cHemiGndN = new THREE.Color(0.02, 0.03, 0.05);
const cHazeDay = new THREE.Color(0.46, 0.68, 0.98), cHazeDawn = new THREE.Color(0.92, 0.62, 0.46), cHazeNight = new THREE.Color(0.035, 0.05, 0.09);
const _hz = new THREE.Color();
const cHazeAway = new THREE.Color(1.1, 0.98, 1.12), cHazeSun = new THREE.Color(1.355, 0.935, 0.603), _hzG = new THREE.Color(), _camF = new V3();
const _vuF = new V3(), _ldK = new V3();
const KU_EASE = 0.28;
const UW = { sunC: new THREE.Color(), sunI: 0, hC: new THREE.Color(), hG: new THREE.Color(), hI: 0, envI: 0, exp: 0 };
function viewUnder(wy) {
  const lu = post.compMat.uniforms.uLensR, LR = lu ? lu.value : 0.08;
  camera.getWorldDirection(_vuF);
  const pitch = Math.asin(clamp$9(_vuF.y, -1, 1)), hf = (camera.fov * DEG$3) / 2;
  const lo = Math.sin(Math.max(pitch - hf, -Math.PI / 2)), hi = Math.sin(Math.min(pitch + hf, Math.PI / 2));
  const f = clamp$9((-(camera.position.y - wy) / LR - lo) / Math.max(hi - lo, 1e-3), 0, 1);
  return f * f * (3 - 2 * f);
}

const RISE_LIGHT = 0.3, RISE_D = 9;
const RISE_WATER = [new V3(0.09, 0.3, 0.35), new V3(0.016, 0.095, 0.13), new V3(0.005, 0.04, 0.071)];
const RISE_MIR = new V3(0.022, 0.088, 0.112), RISE_DAWN = new V3(0.2, 0.11, 0.05);
const RISE_GOD = 1.25;
const EXP_TOP = 0.88, EXP_OUT = 2.3, EXP_EASE = [0.2, 3.4];
function riseExposure(wy) {
  if (G.state !== 'eclipse' || !G.fin) return 1;
  if (G.breached) return lerp$4(1, EXP_OUT, 1 - smoothstep(EXP_EASE[0], EXP_EASE[1], G.breachT));
  const under = lerp$4(1, EXP_TOP, (G.kS || 0) * smoothstep(1.1, 0.15, wy - camera.position.y));
  const rel = camera.position.y - waveHeightDisp(camera.position.x, camera.position.z, U.uTime.value);
  return lerp$4(under, EXP_OUT, smoothstep(BREACH_AIR[0], BREACH_AIR[1], rel));
}
const BREACH_AIR = [-0.07, 0.02];
const _wHome = [];
let _godHome = 0.9;
function riseLight(wy) {
  let k = 0;
  if (G.state === 'eclipse' && G.fin) {
    const dep = wy - camera.position.y;
    k = smoothstep(riseAt(1.6), riseAt(3.2), G.st) * (1 - smoothstep(0.5, RISE_D, dep));
    if (G.breached) k *= 1 - smoothstep(0.6, 1.6, G.breachT);
  }
  if (k === G.kS) return k;
  G.kS = k;
  const cu = post.compMat.uniforms, W = [cu.uWaterUp, cu.uWaterMid, cu.uWaterDeep];
  if (!_wHome.length) { for (const w of W) _wHome.push(w.value.clone()); _godHome = cu.uGodStr.value; }
  const e = k * k * (3 - 2 * k);
  for (let i = 0; i < 3; i++) W[i].value.lerpVectors(_wHome[i], RISE_WATER[i], e);
  cu.uGodStr.value = _godHome * lerp$4(1, (0.22 * RISE_GOD) / RISE_LIGHT, e);
  const ou = ocean && ocean.material && ocean.material.uniforms;
  if (ou && ou.uRiseMir) {
    ou.uRiseMir.value.set(RISE_MIR.x * e, RISE_MIR.y * e, RISE_MIR.z * e, 0.6 * e);
    ou.uRiseDawn.value.copy(RISE_DAWN).multiplyScalar(e);
  }
  return k;
}

const _swW = new V3();
function updateEnvironment(dt, t) {
  const clr = G.state === 'eclipse' || G.state === 'end' ? G.clear || 0 : 0;
  if (clr !== G.clearSet && post) {
    G.clearSet = clr;
    post.compMat.uniforms.uAbs.value.set(ABS_HOME.x * lerp$4(1, WATER_CLEAR.x, clr), ABS_HOME.y * lerp$4(1, WATER_CLEAR.y, clr), ABS_HOME.z * lerp$4(1, WATER_CLEAR.z, clr));
  }
  SKY_UNIFORMS.uSunDir.value.copy(sunDir);
  if (SKY_UNIFORMS.uMoonDir) SKY_UNIFORMS.uMoonDir.value.copy(MOON_DIR);
  refracted(sunDir.y < -0.03 ? MOON_DIR : G.state === 'title' ? SUN_TITLE : sunDir, U.uSunW.value);
  const fo = G.state === 'eclipse' && G.fin && sunDir.y < -0.03 ? G.fin.orb : null;
  if (fo && fo.took) slerpDir(fo.dir, _swW.copy(U.uSunW.value), G.breached ? smoothstep(0.3, 2.0, G.breachT) : 0, U.uSunW.value);
  const wy = waveHeightDisp(camera.position.x, camera.position.z, t);
  const under = camera.position.y < wy;
  const kUg = viewUnder(wy);
  const lensR = post.compMat.uniforms.uLensR ? post.compMat.uniforms.uLensR.value : 0.2;
  let kU = kUg;
  if (G.state === 'dive' && (lensR < 0.1 || (G.kUt >= 0 && G.kUt < KU_EASE))) {
    if (kUg <= 0) G.kUt = -1;
    else if (!(G.kUt >= 0)) G.kUt = 0;
    else G.kUt += dt;
    kU = Math.min(kUg, G.kUt >= 0 ? smoothstep(0, KU_EASE, G.kUt) : 0);
  } else G.kUt = kUg > 0 ? KU_EASE : -1;
  G.seaY = wy;
  G.kU = kU;
  G.kUg = kUg;
  const day = smoothstep(-0.1, 0.35, G.state === 'dive' ? SUN_TITLE.y : sunDir.y);
  const night = 1 - smoothstep(-0.17, 0.05, sunDir.y);
  G.dark = lerp$4(night, 1 - day, kU);
  const kS = riseLight(wy);
  const lw = lerp$4(lerp$4(0.22, 1, Math.pow(day, 1.2)), RISE_LIGHT, kS);
  G.light = lerp$4(1, lw, kS > 0 ? Math.min(1, kU / 0.2) : kU);
  U.uLight.value = G.light;
  post.compMat.uniforms.uLightK.value = lw / G.light;
  const dwy = Math.abs(camera.position.y - wy);
  const wantNear = lensR < 0.1 && dwy < lensR * 1.4 ? 0.003 : lensR < 0.1 && dwy < 0.1 ? 0.015 : under || dwy < 0.7 ? 0.06 : 0.5;
  if (camera.near !== wantNear) { camera.near = wantNear; camera.updateProjectionMatrix(); }
  if (surface && surface.island) surface.island.group.visible = !(kU >= 1 && camera.position.y < wy - 1 && PSW.island);
  const moonUp = kU < 1 && sunDir.y < -0.03;
  let ld = kU >= 1 ? U.uSunW.value : moonUp ? MOON_DIR : sunDir;
  if (kU > 0 && kU < 1) ld = _ldK.copy(ld).lerp(U.uSunW.value, kU).normalize();
  _focus.copy(camera.position);
  _focus.y = lerp$4(camera.position.y, Math.max(camera.position.y - 6, -40), kU);
  _lx.crossVectors(Math.abs(ld.y) > 0.99 ? _zAxis : _yAxis, ld).normalize();
  _ly.crossVectors(ld, _lx);
  const texel = 60 / 2048;
  const px = Math.floor(_focus.dot(_lx) / texel) * texel;
  const py = Math.floor(_focus.dot(_ly) / texel) * texel;
  sun.target.position.copy(_lx).multiplyScalar(px).addScaledVector(_ly, py).addScaledVector(ld, _focus.dot(ld));
  sun.position.copy(sun.target.position).addScaledVector(ld, 80);
  sun.shadow.normalBias = lerp$4(0.06, 0.035, kU);
  const shTex = sun.shadow.map ? sun.shadow.map.depthTexture : null;
  SUNSH.uShMap.value = shTex && shTex.compareFunction ? shTex : null;
  SUNSH.uShMat.value = sun.shadow.matrix;
  SUNSH.uShOn.value = SUNSH.uShMap.value && kU > 0 ? 1 : 0;
  sun.shadow.intensity = lerp$4(1, lerp$4(1, 0.28, smoothstep(3, 14, -_focus.y)), kU);
  const cu = post.compMat.uniforms;
  let expTarget;
  if (kU > 0) {
    sun.color.copy(cUnderSun);
    sun.intensity = 2.9 * day;
    hemi.color.copy(cHemiSkyU);
    const hb = camera.position.y - floorHeight(camera.position.x, camera.position.z);
    hemi.groundColor.copy(cHemiGndU).lerp(cSandBounce, 1 - smoothstep(3, 16, hb));
    hemi.intensity = 0.3 * lerp$4(0.24, 1, day);
    scene.environment = envUnder;
    scene.environmentIntensity = 0.3 * lerp$4(0.25, 1, day);
    expTarget = (G.state === 'clean' ? 0.54 : 0.8) + 0.5 * (1 - day);
    if (kU < 1) { UW.sunC.copy(sun.color); UW.sunI = sun.intensity; UW.hC.copy(hemi.color); UW.hG.copy(hemi.groundColor); UW.hI = hemi.intensity; UW.envI = scene.environmentIntensity; UW.exp = expTarget; }
  }
  if (kU < 1) {
    if (skyLight && skyLight(sunDir, _sl)) {
      if (_sl.sunColor && _sl.sunColor.isColor) sun.color.copy(_sl.sunColor);
      sun.intensity = Number.isFinite(_sl.sunIntensity) ? _sl.sunIntensity : 3.1;
      if (_sl.hemiSky && _sl.hemiSky.isColor) hemi.color.copy(_sl.hemiSky);
      if (_sl.hemiGround && _sl.hemiGround.isColor) hemi.groundColor.copy(_sl.hemiGround);
      hemi.intensity = Number.isFinite(_sl.hemiIntensity) ? _sl.hemiIntensity : 0.9;
      _hz.copy(_sl.haze && _sl.haze.isColor ? _sl.haze : cHazeDay);
      cu.uHazeDen.value = Number.isFinite(_sl.hazeDensity) ? _sl.hazeDensity : 0.0003;
      expTarget = Number.isFinite(_sl.exposure) ? _sl.exposure : 0.95;
    } else {
      sun.color.copy(cDuskSun).lerp(cAirSun, smoothstep(0.0, 0.3, sunDir.y));
      sun.intensity = 3.1 * smoothstep(-0.02, 0.12, sunDir.y);
      hemi.color.copy(cHemiSkyN).lerp(cHemiSkyA, 1 - night);
      hemi.groundColor.copy(cHemiGndN).lerp(cHemiGndA, 1 - night);
      hemi.intensity = lerp$4(0.25, 0.9, 1 - night);
      _hz.copy(cHazeDawn).lerp(cHazeDay, smoothstep(0.05, 0.3, sunDir.y)).lerp(cHazeNight, night);
      cu.uHazeDen.value = 0.0003;
      expTarget = 0.95 + 0.55 * night;
    }
    const gold = sunDir.y > 0 ? 1 - smoothstep(0.16, 0.42, sunDir.y) : 0;
    if (gold > 0) {
      sun.intensity *= lerp$4(1, 1.2, gold);
      sun.color.g = Math.min(sun.color.g, lerp$4(sun.color.g, 0.7 * sun.color.r, gold));
      const hs = Math.max(hemi.color.r, hemi.color.b), hg = Math.max(hemi.groundColor.r, hemi.groundColor.b);
      if (hemi.color.g > hs) hemi.color.g = lerp$4(hemi.color.g, hs, gold);
      if (hemi.groundColor.g > hg) hemi.groundColor.g = lerp$4(hemi.groundColor.g, hg, gold);
      camera.getWorldDirection(_camF);
      const hl = 0.2126 * _hz.r + 0.7152 * _hz.g + 0.0722 * _hz.b;
      _hzG.copy(cHazeAway).lerp(cHazeSun, smoothstep(-0.3, 0.9, _camF.dot(sunDir))).multiplyScalar(hl);
      _hz.lerp(_hzG, gold);
    }
    if (sunDir.y > -0.05 && sunDir.y < 0.3) {
      camera.getWorldDirection(_camF);
      cu.uHazeDen.value *= lerp$4(1, 0.3, smoothstep(0.5, 0.9, _camF.dot(sunDir)) * (1 - smoothstep(0.12, 0.3, sunDir.y)));
    }
    if (moonUp) {
      const fromSky = _sl.moonColor && _sl.moonColor.isColor && Number.isFinite(_sl.moonIntensity) && _sl.moonIntensity > 0;
      sun.color.copy(fromSky ? _sl.moonColor : cMoonLight);
      sun.intensity = Math.max(fromSky ? _sl.moonIntensity : 0, 0.3) * smoothstep(-0.03, -0.14, sunDir.y);
    }
    cu.uHaze.value.set(_hz.r, _hz.g, _hz.b);
    scene.environment = envSky;
    const envDay = _sl.envTint && _sl.envTint.isColor ? clamp$9(0.2126 * _sl.envTint.r + 0.7152 * _sl.envTint.g + 0.0722 * _sl.envTint.b, 0.4, 1) : 1;
    scene.environmentIntensity = lerp$4(envDay, 0.07, night);
    if (kU > 0) {
      sun.color.lerp(UW.sunC, kU);
      sun.intensity = lerp$4(sun.intensity, UW.sunI, kU);
      hemi.color.lerp(UW.hC, kU);
      hemi.groundColor.lerp(UW.hG, kU);
      hemi.intensity = lerp$4(hemi.intensity, UW.hI, kU);
      if (kU < 0.5) scene.environmentIntensity *= 1 - smoothstep(0, 0.5, kU);
      else { scene.environment = envUnder; scene.environmentIntensity = UW.envI * smoothstep(0.5, 1, kU); }
      expTarget = lerp$4(expTarget, UW.exp, kU);
    }
  }
  U.uCausticStr.value = G.noCaustics ? 0 : kU;
  U.uWarmNear.value = kU;
  G.exposure = lerp$4(G.exposure, expTarget, 1 - Math.exp(-dt * (expTarget < G.exposure ? 3.2 : 1.5)));
  renderer.toneMappingExposure = G.exposure * riseExposure(wy);
  post.hdrK = G.breached ? smoothstep(-0.035, 0.0, sunDir.y) : 0;
  const gm = post.gradeMat.uniforms;
  const gA = (1 - smoothstep(0.2, 0.45, sunDir.y)) * smoothstep(-0.08, 0.0, sunDir.y), gg = gA * (1 - kU);
  gm.uSat.value = lerp$4(lerp$4(1.08, 1.04, gA) - 0.22 * night, 1.1, kU);
  gm.uContrast.value = lerp$4(lerp$4(1.12, 1.1, gg), 1.22, kU);
  gm.uLift.value.set(0.004 * gg, 0.006 * gg + 0.0022 * kU, 0.011 * gg + 0.0036 * kU);
  gm.uGain.value.set(1 + 0.13 * gg, 1 + 0.03 * gg, 1 - 0.11 * gg);
  gm.uVignette.value = G.state === 'title' ? 0.3 : G.state === 'clean' ? 0.62 : lerp$4(0.4, 0.58, kU);
  if (G.mech && G.state !== 'eclipse') placeGlow();
  fx.current.copy(currentAt(camera.position.x, camera.position.y, camera.position.z)).multiplyScalar(0.6);
  if (G.state !== 'clean' && G.state !== 'assemble' && G.state !== 'crank' && G.state !== 'dive' && G.state !== 'title' && G.state !== 'eclipse' && G.state !== 'end') {
    post.setDof(G.state === 'explore' ? player.lensDistance + 0.4 : 0.93, 0, dt);
  }
  if (G.state === 'clean' && G.closeup) post.setDof(G.closeup.dofFocus, G.closeup.dofAperture, dt);
  post.farDeep += ((G.state === 'explore' || G.state === 'clean' ? 1 : 0) - post.farDeep) * (1 - Math.exp(-dt * 2));
  if (diver$1 && diver$1.setTetherFocus) diver$1.setTetherFocus(kU > 0.5 ? post.dof.focus : 0);
  updateTorch(dt);
}

const SEA_SHOW = 0.4;
function seaSide(rdt) {
  if (!G.revealed || !PSW.sea) { G.underOn = true; return; }
  const ahead = camera.position.y - G.seaY + Math.min(0, CV.v.y) * 0.15;
  if ((G.kUg !== undefined ? G.kUg : G.kU) > 0 || ahead < SEA_SHOW) { G.underOn = true; G.dryT = 0; }
  else { G.dryT = (G.dryT || 0) + rdt; if (G.dryT >= 0.5) G.underOn = false; }
}

const _tAim = new V3();
const SHAFT_UP = 6;
function updateTorch(dt) {
  const on = G.state === 'clean' && !G.torchOff ? 1 : 0;
  const was = G.torch || 0;
  G.torch = was + (on - was) * (1 - Math.exp(-dt * (on ? 1.2 : 1.0)));
  if (!on && G.torch < 0.002) {
    G.torch = 0;
    torch.intensity = 0;
    TORCH.uTorchK.value = 0;
    return;
  }
  const tp = fragments.torchPose;
  if (G.cleanItem && G.cleanItem.lump) _tAim.copy(G.cleanItem.lump.position);
  else if (tp && tp.active) _tAim.copy(tp.aim);
  if (was < 0.002) torch.target.position.copy(_tAim);
  else torch.target.position.lerp(_tAim, 1 - Math.exp(-dt * 1.5));
  torch.target.updateMatrixWorld();
  torch.position.copy(torch.target.position).addScaledVector(U.uSunW.value, SHAFT_UP);
  torch.intensity = G.torch * TORCH_I;
  TORCH.uTorchPos.value.copy(torch.target.position).addScaledVector(U.uSunW.value, 1.5);
  TORCH.uTorchDir.value.copy(U.uSunW.value).negate();
  TORCH.uTorchCos.value = 0.84;
  TORCH.uTorchK.value = G.torch;
}

let last = performance.now();
const AS = {
  lv: [1], i: 0,
  gl: null, ext: null, q: [], qi: 0,
  ms: 0, has: false, seen: 0,
  hot: 0, cool: 0, settle: 1, calm: 0,
  miss: [], probe: 20, tried: -1,
  bar: [], fails: [],
  clock: 0,
};
function scaleLevels() {
  if (TIER === 'phone') return [1, 0.88, 0.77, 0.68, 0.6];
  const floor = ((window.devicePixelRatio || 1) >= 1.5 ? 1.2 : 0.85) / pr;
  return (pr >= 1.25 ? [1, 0.9] : [1, 0.92]).filter((s, k) => k === 0 || s >= floor - 1e-6);
}
function setScaleLevel(i) {
  AS.i = i;
  post.setScale(AS.lv[i]);
  AS.settle = 1; AS.hot = 0; AS.cool = 0; AS.calm = 0; AS.miss.length = 0;
}
function gpuInit() {
  AS.gl = renderer.getContext();
  AS.ext = AS.gl.getExtension('EXT_disjoint_timer_query_webgl2');
  if (AS.ext) for (let i = 0; i < 4; i++) AS.q.push({ q: AS.gl.createQuery(), busy: false });
  AS.lv = scaleLevels();
}
function gpuBegin() {
  if (!AS.ext || !PSW.adapt) return false;
  const s = AS.q[AS.qi];
  if (s.busy) return false;
  AS.gl.beginQuery(AS.ext.TIME_ELAPSED_EXT, s.q);
  return true;
}
function gpuEnd(on) {
  if (!on) return;
  AS.gl.endQuery(AS.ext.TIME_ELAPSED_EXT);
  AS.q[AS.qi].busy = true;
  AS.qi = (AS.qi + 1) % AS.q.length;
}
function gpuRead() {
  const gl = AS.gl, e = AS.ext;
  if (!e) return;
  const disj = gl.getParameter(e.GPU_DISJOINT_EXT);
  for (let k = 0; k < AS.q.length; k++) {
    const s = AS.q[(AS.qi + k) % AS.q.length];
    if (!s.busy || !gl.getQueryParameter(s.q, gl.QUERY_RESULT_AVAILABLE)) continue;
    const v = gl.getQueryParameter(s.q, gl.QUERY_RESULT) / 1e6;
    s.busy = false;
    if (disj || !(v > 0)) continue;
    AS.ms = AS.has ? lerp$4(AS.ms, v, 1 - Math.exp(-Math.max(AS.clock - AS.seen, 1 / 60) / 0.3)) : v;
    AS.has = true;
    AS.seen = AS.clock;
  }
}
function scaleDown() {
  const f = (AS.fails[AS.i] = (AS.fails[AS.i] || 0) + 1);
  AS.bar[AS.i] = f > 1 ? AS.clock + Math.min(120, 15 * 2 ** (f - 2)) : 0;
  AS.tried = -1;
  setScaleLevel(Math.min(AS.lv.length - 1, AS.i + 1));
}
function adapt(rawDt) {
  if (!PSW.adapt || !post) return;
  const dt = Math.min(rawDt, 0.1);
  AS.clock += dt;
  AS.settle -= dt;
  gpuRead();
  if (G.state === 'dive') { AS.hot = 0; AS.cool = 0; AS.tried = -1; AS.miss.length = 0; return; }
  if (rawDt <= 0.1) { AS.miss.push(rawDt > MISS_S ? 1 : 0); if (AS.miss.length > 60) AS.miss.shift(); }
  const timed = AS.has && AS.clock - AS.seen < 1;
  const misses = AS.miss.reduce((a, b) => a + b, 0);
  const over = timed ? AS.ms >= FRAME_MS - 0.7 : misses >= 6;
  AS.hot = over ? AS.hot + dt : 0;
  AS.calm = over ? 0 : AS.calm + dt;
  if (AS.i === 0 && AS.calm > 60) { AS.bar.length = 0; AS.fails.length = 0; }
  if (AS.tried >= 0) {
    if (AS.clock - AS.tried > (timed ? 1.5 : 3)) AS.tried = -1;
    else if (timed ? AS.ms >= FRAME_MS - 0.7 : rawDt > MISS_S && rawDt <= 0.1) {
      if (!timed) AS.probe = Math.min(160, AS.probe * 2);
      scaleDown();
      return;
    }
  }
  if (AS.settle > 0) return;
  if (AS.hot >= 0.5 && AS.i < AS.lv.length - 1) { scaleDown(); return; }
  if (AS.i === 0 || (AS.bar[AS.i - 1] || 0) > AS.clock) { AS.cool = 0; return; }
  AS.cool = (timed ? AS.ms < FRAME_MS * 0.87 : misses === 0) ? AS.cool + dt : 0;
  const upOK = G.state === 'explore' || G.state === 'clean' || G.state === 'title' || G.state === 'end';
  if (upOK && AS.cool >= (timed ? 3 : AS.probe)) { setScaleLevel(AS.i - 1); AS.tried = AS.clock; }
}

const FRAME_MS = TIER === 'phone' ? 1000 / 30 : 1000 / 60, MISS_S = (FRAME_MS * 1.2) / 1000;
const TICK_MIN = TIER === 'phone' ? FRAME_MS - 3 : 0;
let lastTick = -1e9;
function frame(now) {
  requestAnimationFrame(frame);
  if (TICK_MIN && now - lastTick < TICK_MIN) return;
  lastTick = now;
  tick(now);
}

const warp = { t: 0, dur: 0, k: 1 };
function timeWarp(dur, k) { warp.t = 0; warp.dur = dur; warp.k = k; }
function warpScale(rdt) {
  if (warp.dur <= 0) return 1;
  warp.t += rdt;
  if (warp.t >= warp.dur) { warp.dur = 0; return 1; }
  const s = Math.sin((Math.PI * warp.t) / warp.dur);
  return 1 - (1 - warp.k) * s * s;
}

function bandStep(dt) {
  if (BAND$1.k > 0) bandKeep();
  BAND$1.update(dt, camera.aspect, isTouch);
  const z = BAND$1.zoom;
  if (camera.zoom !== z) { camera.zoom = z; camera.updateProjectionMatrix(); }
  BAND$1.words = BAND$1.bar > 0 ? UI.barWords() : null;
}
const _bkV = new V3(), _bkP = new V3(), _bkN = new V3(), _bkB = new THREE.Box3();
const BK_FRONT = ['ring0', 'ring1', 'ring2', 'ring3', 'ring4', 'dragon', 'moonPtr', 'sunPtr'];
function bandKeep() {
  camera.updateMatrixWorld();
  const pz = G.puzzle, mw = mechanism.inner.matrixWorld, A = mechanism.assembly;
  if (G.state === 'crank') {
    _bkN.set(0, 0, 1).transformDirection(mw);
    _bkV.copy(mechanism.parts.frontAsm.cInner).applyMatrix4(mw);
    const front = _bkP.subVectors(camera.position, _bkV).dot(_bkN) > 0;
    _bkB.makeEmpty();
    for (const n of front ? BK_FRONT : ['backDials']) if (mechanism.parts[n]) _bkB.union(mechanism.parts[n].boxInner);
    bandFitBox(_bkB, mw, 0.05, 1);
    if (diver$1 && diver$1.anchors) bandFitSpan(diver$1.anchors.helmet.getWorldPosition(_bkV), _aUp, -0.3, 0.26, 0.04);
    bandFitBox(mechanism.parts.case.boxInner, mw, 0.04, Math.max(1 - smoothstep(0.1, 0.5, G.ckInU || 0), smoothstep(0.7, 0.95, G.camC)));
  } else if (G.state === 'assemble') {
    if (pz && pz.slot >= 0) {
      const r = wheels[pz.slot].rw;
      _bkV.set(0, 1, 0).applyQuaternion(camera.quaternion);
      bandFitSpan(PLACES[pz.slot].seat, _bkV, -r - 0.04, r + 0.2, 0.04);
    }
    _bkB.makeEmpty();
    for (const pt of mechanism.partList) if (pt.state === 'seated') _bkB.union(pt.boxInner);
    if (A && (A.done || A.step >= 8)) bandFitBox(mechanism.parts.case.boxInner, mw, 0.04, A.done ? 1 : smoothstep(0, 2, A.stepT));
    else if (!_bkB.isEmpty()) bandFitBox(_bkB, mw, 0.04, 0);
  }
}
function lensY(p, th) {
  _bkV.copy(p).applyMatrix4(camera.matrixWorldInverse);
  return -_bkV.z < camera.near ? NaN : _bkV.y / (-_bkV.z * th);
}
function bandFitBox(b, mw, m, w) {
  const th = Math.tan((camera.fov * DEG$3) / 2), h = BAND$1.h;
  let y0 = Infinity, y1 = -Infinity;
  for (let i = 0; i < 8; i++) {
    const y = lensY(_bkP.set(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y, i & 4 ? b.max.z : b.min.z).applyMatrix4(mw), th);
    if (!Number.isFinite(y)) return;
    y0 = Math.min(y0, y);
    y1 = Math.max(y1, y);
  }
  BAND$1.fit(y0, 0, m, Math.max(w, 1 - smoothstep(0.035, 0.07, -y0 - h)));
  BAND$1.fit(0, y1, m, Math.max(w, 1 - smoothstep(0.035, 0.07, y1 - h)));
}
function bandFitSpan(p, up, a, b, m, w) {
  const th = Math.tan((camera.fov * DEG$3) / 2);
  const y0 = lensY(_bkP.copy(p).addScaledVector(up, a), th), y1 = lensY(_bkP.copy(p).addScaledVector(up, b), th);
  if (Number.isFinite(y0) && Number.isFinite(y1)) BAND$1.fit(Math.min(y0, y1), Math.max(y0, y1), m, w);
}
const _boF = new V3(), _boR = new V3(), _boU = new V3(), _boA = new V3(), _boB = new V3();
function bandOrrery(pos, aim, w, m = 0.05) {
  if (!(BAND$1.k > 0) || !BAND$1.desk || !magic$1 || !magic$1.orreryInfo) return 0;
  const o = magic$1.orreryInfo();
  if (!(o.shown > 0.05)) return 0;
  const D = _boF.subVectors(aim, pos).length();
  _boF.divideScalar(D);
  _boR.crossVectors(_boF, _aUp).normalize();
  _boU.crossVectors(_boR, _boF);
  _boA.set(0, 1, 0).cross(o.normal);
  if (_boA.lengthSq() < 1e-6) _boA.set(1, 0, 0);
  _boA.normalize();
  _boB.crossVectors(o.normal, _boA);
  const th = Math.tan((camera.fov * DEG$3) / 2);
  let y0 = Infinity, y1 = -Infinity;
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    _bkP.copy(o.center).addScaledVector(_boA, Math.cos(a) * o.radius).addScaledVector(_boB, Math.sin(a) * o.radius).sub(pos);
    const z = _bkP.dot(_boF);
    if (z < 0.3) return 0;
    y0 = Math.min(y0, _bkP.dot(_boU) / (z * th));
    y1 = Math.max(y1, _bkP.dot(_boU) / (z * th));
  }
  const e = BAND$1.h - m;
  const s = Math.min(Math.max(0, y1 - e), Math.max(0, y0 + e));
  BAND$1.fit(y0 - s, y1 - s, m, w);
  return D * s * th;
}

function tick(now) {
  const rawDt = (now - last) / 1000;
  const rdt = Math.min(0.05, Math.max(0.0001, rawDt));
  G.rdt = rdt;
  const dtW = rdt * warpScale(rdt);
  const dt = dtW * diveRamp(rdt);
  G.rampK = RAMP.k;
  last = now;
  touch.update(rdt);
  if (G.paused) { post.render(dt); return; }
  if (!G.revealed) revealUnder();
  G.st += dt;
  if (G.timing) G.run += rdt;
  const airHold = !!G.airOn && airHeld();
  if (G.airOn && (G.state === 'explore' || G.state === 'clean') && !airHold) { G.air = Math.max(0, G.air - dt); airCues(); }
  U.uTime.value += dt;
  const t = U.uTime.value;
  G.sonarCD = Math.max(0, G.sonarCD - dt);
  G.sonarT = Math.max(0, G.sonarT - dt);
  G.ping = Math.max(0, (G.ping || 0) - dt * 1.3);
  G.splash = Math.max(0, (G.splash || 0) - dt * 1.7);
  if (post) {
    post.gradeMat.uniforms.uPing.value = G.ping;
    post.gradeMat.uniforms.uSplash.value = G.splash;
    G.wet = Math.max(0, (G.wet || 0) - dt * 0.24);
    post.gradeMat.uniforms.uWet.value = G.wet;
  }

  const need = needNow();
  switch (G.state) {
    case 'title': setTitleCamera(t); titleDiver(dt, t); break;
    case 'dive': updateDive(dt, t); break;
    case 'explore': updateExplore(dt, t); break;
    case 'clean': updateClean(dt, t); break;
    case 'assemble': updateAssemble(dt, t); break;
    case 'crank': updateCrank(dt, t); break;
    case 'eclipse': updateEclipse(dt, t); break;
    case 'end': updateEnd(dt, t); break;
  }
  trackCamVel(dt);
  if (G.state !== 'explore') markersMore(null);
  if (G.state !== 'explore' && G.state !== 'clean') fragments.update(dt, t, camera, null);
  factClock(dt);
  if (G.shake > 0) {
    G.shake = Math.max(0, G.shake - dt * 1.4);
    const s = G.shake * G.shake * 0.05;
    camera.position.x += (Math.random() - 0.5) * s;
    camera.position.y += (Math.random() - 0.5) * s;
  }
  if (G.airOn) UI.air(G.air, AIR_TOTAL, airHold);
  if (G.state !== 'explore') easeFov(G.lensAdd || 0, dt);
  FRAME.update(dt, need);
  applyLens();
  if (G.state === 'crank') ckCuePlace();
  if (diver$1 && G.state === 'loading') diver$1.setFade(0);
  if (G.state === 'explore') UI.sonar(G.sonarCD / 7, G.sonarCD <= 0);
  exhaustStream(dt);
  if (window.__camHook) window.__camHook(camera, G);
  if (G.state !== 'explore') INTERACT.uPlayer.value.copy(camera.position);

  updateEnvironment(dt, t);
  seaSide(rdt);
  caustics.render(renderer);
  sky.update(camera, dt);
  ocean.update(camera);
  world.update(dt, t, camera, pr);
  surface.update(t, dt, camera, sunDir, G.dark || 0);
  fx.update(dt, pr);
  if (fx.setDof) fx.setDof(post.dof.focus, post.dof.aperture, 16, post.dof.near, post.dof.farK, post.dof.far);
  if (prints) prints.update(U.uTime.value, camera, sunDir);
  mg((m) => m.update(dt, t, camera));
  sonar.update(dt);
  if (life$1 && life$1.setHose && diver$1 && diver$1.tether && diver$1.tether.hose && HOSE_KEEP[G.state]) life$1.setHose(diver$1.tether.hose.points);
  if (life$1 && life$1.setKeepOut) {
    let n = diver$1 && typeof diver$1.bodyCapsules === 'function' ? diver$1.bodyCapsules(_koBuf, 0) / 7 : 0;
    const cuI = fragments && fragments.cu && fragments.cu.active ? fragments.cu.it : null;
    if (cuI) {
      const p = cuI.lump.position, c = camera.position;
      n = koCap(koCap(n, c.x, c.y, c.z, p.x, p.y, p.z, 0.3), p.x, p.y, p.z, p.x, p.y, p.z, 0.3);
    }
    if (G.mech && (G.state === 'assemble' || G.state === 'crank' || G.state === 'eclipse')) {
      const M = G.mech.M, fl = floorHeight(M.x, M.z);
      n = koCap(n, M.x, fl, M.z, M.x, fl + 2.3, M.z, 1.0);
    }
    life$1.setKeepOut(_koBuf, n);
  }
  const focusPos = G.state === 'explore' ? player.pos : camera.position;
  if (life$1) {
    try {
      life$1.update(dt, t, { position: focusPos, velocity: player.vel, state: G.state, camera });
      if (life$1.setCalm) life$1.setCalm(G.dark || 0);
    } catch (e) { console.warn(e); life$1 = null; }
  }
  if (critters$1) {
    try { critters$1.update(dt, t, focusPos); } catch (e) { console.warn(e); critters$1 = null; }
  }
  audio$1.listen?.(diver$1 && diver$1.anchors && diver$1.anchors.helmet ? camera.position.distanceTo(diver$1.anchors.helmet.getWorldPosition(_lsP)) : 99, Math.max(0, -camera.position.y), G.state === 'clean' || G.state === 'assemble' || G.state === 'crank' ? 1 : 0, Math.hypot(camera.position.x - LAYOUT.hull.x, camera.position.z - LAYOUT.hull.z));
  if (!renderer.shadowMap.autoUpdate) { const n = (G.shadowN = (G.shadowN || 0) + 1); renderer.shadowMap.needsUpdate = n === 1 || n % TQ.shadowEvery === 0; }
  bandStep(dtW);
  const timing = gpuBegin();
  post.render(dtW);
  gpuEnd(timing);
  adapt(rawDt);
  hitchGuard();
}

const HITCH = { p: -1, g: 0, t: 0, list: [] };
function hitchGuard() {
  if (!G.compiled) return;
  const inf = renderer.info, p = inf.programs.length, g = inf.memory.geometries, t = inf.memory.textures;
  if (HITCH.p >= 0 && (p > HITCH.p || g > HITCH.g || t > HITCH.t) && HITCH.list.length < 200) {
    HITCH.list.push({ state: G.state, st: +G.st.toFixed(2), programs: p - HITCH.p, geometries: g - HITCH.g, textures: t - HITCH.t });
  }
  HITCH.p = p; HITCH.g = g; HITCH.t = t;
}

const ptr = { x: 0, y: 0, ndc: new THREE.Vector2(), down: false, button: 0, prevAng: null, type: 'mouse', seen: false };
function setPtr(e) {
  const r = canvas.getBoundingClientRect();
  ptr.x = e.clientX - r.left;
  ptr.y = e.clientY - r.top;
  ptr.ndc.set((ptr.x / r.width) * 2 - 1, -(ptr.y / r.height) * 2 + 1);
  ptr.type = e.pointerType || 'mouse';
}
canvas.addEventListener('pointerdown', (e) => {
  setPtr(e);
  ptr.down = true;
  ptr.button = e.button;
  if (G.state === 'explore') {
    if (e.button === 2) sonarPing();
    else if (e.pointerType === 'mouse' && document.pointerLockElement) {
      const it = cleanTarget();
      if (it && !fragments.busy()) {
        startClean(it);
        if (player.auto) player.auto.click = true;
      }
    }
    G.tap = { t: performance.now(), x: e.clientX, y: e.clientY };
  } else if (G.state === 'clean') {
    const mouse = e.pointerType === 'mouse';
    if (e.pointerType === 'touch') {
      G.bRel = e.pointerId; G.bRelX = e.clientX; G.bRelY = e.clientY; G.bRelSync = true;
      if (G.bndc && fragments.canSteer() && fragments.onStone(ptr.ndc)) { G.bndc.set(ptr.ndc.x, ptr.ndc.y); G.bRelSync = false; }
    }
    else if (G.bndc && !(mouse && document.pointerLockElement)) { G.bndc.set(ptr.ndc.x, ptr.ndc.y + (mouse ? 0 : touch.lift(44))); G.bMoved = U.uTime.value; }
  } else if (G.state === 'assemble') {
    puzzleDown(e);
  } else if (G.state === 'crank') {
    ckTrace(true);
  } else if (G.state === 'end') {
    endGrab(e);
  }
});
addEventListener('pointermove', (e) => {
  setPtr(e);
  if (G.state === 'end') endDrag(e);
  if (ptr.type === 'mouse') { ptr.seen = true; if (G.lastInput === 'key') G.lastInput = 'mouse'; }
  const rel = G.bRel != null && e.pointerId === G.bRel;
  if (rel && !(G.state === 'clean' && G.bndc && fragments.canSteer())) { G.bRelX = e.clientX; G.bRelY = e.clientY; }
  if (G.state === 'clean' && G.bndc && fragments.canSteer()) {
    if ((e.pointerType === 'mouse' && document.pointerLockElement) || rel) {
      const r = canvas.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        let mx = e.movementX || 0, my = e.movementY || 0;
        if (rel) {
          if (G.bRelSync) { fragments.syncNdc(G.bndc); G.bRelSync = false; }
          mx = e.clientX - G.bRelX; my = e.clientY - G.bRelY;
          G.bRelX = e.clientX; G.bRelY = e.clientY;
        }
        G.bndc.x = clamp$9(G.bndc.x + (mx * 2) / r.width, -1, 1);
        G.bndc.y = clamp$9(G.bndc.y - (my * 2) / r.height, -1, 1);
        if (rel && fragments.onStone(ptr.ndc)) {
          const k = 1 - Math.exp(-Math.hypot(mx, my) / 12);
          G.bndc.x += (ptr.ndc.x - G.bndc.x) * k;
          G.bndc.y += (ptr.ndc.y - G.bndc.y) * k;
        }
      }
    } else G.bndc.set(ptr.ndc.x, ptr.ndc.y + (e.pointerType === 'mouse' ? 0 : touch.lift(44)));
    G.bMoved = U.uTime.value;
  }
  if (G.state === 'crank' && ptr.down && !(e.pointerType === 'touch' && touch.live)) ckTrace(false);
});
function ckTrace(start) {
  const k = ptr.ck || (ptr.ck = { fx: 0, fy: 0, px: 0, py: 0, h: null });
  if (start || ptr.prevAng === null) { k.fx = k.px = ptr.x; k.fy = k.py = ptr.y; k.h = null; ptr.prevAng = 0; return; }
  k.fx += (ptr.x - k.fx) * 0.5;
  k.fy += (ptr.y - k.fy) * 0.5;
  const sx = k.fx - k.px, sy = k.fy - k.py;
  if (Math.hypot(sx, sy) < 3) return;
  const h = Math.atan2(sy, sx);
  if (k.h !== null) {
    const d = wrapA(h - k.h);
    if (Math.abs(d) < 60 * DEG$3) G.crankInput += d;
  }
  k.h = h; k.px = k.fx; k.py = k.fy;
}
addEventListener('pointerup', (e) => {
  if (G.state === 'assemble') puzzleUp();
  if (G.state === 'end') endLetGo(e);
  const tp = G.tap;
  if (G.state === 'explore' && ptr.down && tp && e.button !== 2 && (e.pointerType !== 'mouse' || !document.pointerLockElement) &&
      performance.now() - tp.t < 250 && Math.hypot(e.clientX - tp.x, e.clientY - tp.y) < 10) {
    const it = cleanTarget();
    if (it && !fragments.busy()) startClean(it);
  }
  G.tap = null;
  ptr.down = false;
  ptr.prevAng = null;
  if (G.bRel != null && e.pointerId === G.bRel) G.bRel = null;
});
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
addEventListener('pointercancel', (e) => { if (G.state === 'assemble') puzzleUp(true); if (G.state === 'end') endLetGo(e); });
canvas.addEventListener('wheel', (e) => {
  if (G.state === 'crank') e.preventDefault();
  if (G.state === 'end' && G.eo) {
    G.eo.want.dolly = clamp$9(G.eo.want.dolly + e.deltaY * 0.0012, EO.dolly[0], EO.dolly[1]);
    endTook(G.eo);
    endUsed();
    e.preventDefault();
  }
}, { passive: false });

addEventListener('keydown', (e) => {
  if (G.state === 'assemble' && G.puzzle && !e.repeat) puzzleKey(e);
  if (e.code === 'Space' && G.state === 'crank') { G.hold = true; e.preventDefault(); }
  if ((e.code === 'Enter' || e.code === 'Space') && G.state === 'title') { e.preventDefault(); if (!e.repeat) startDive(); }
  if (e.code === 'Enter' && G.state === 'end' && G.endMore) { e.preventDefault(); if (!e.repeat) document.getElementById('again').click(); }
  if (e.code === 'KeyQ') sonarPing(e.repeat);
  if (e.code === 'KeyE') {
    G.eHeld = true;
    if (G.state === 'explore') startClean(cleanTarget());
    else if (G.state === 'clean') G.autoBrush = true;
  }
  if (e.code === 'Escape' && G.state === 'clean') abortClean();
});
addEventListener('journalchange', (e) => {
  const open = !!(e.detail && e.detail.open);
  if (open) { player.releaseLock(); player.holding = false; player.keys = Object.create(null); }
  G.paused = open;
});
addEventListener('keyup', (e) => {
  if (e.code === 'Space') G.hold = false;
  if (e.code === 'KeyE') {
    G.autoBrush = false;
    G.eHeld = false;
    if (G.state === 'clean' && G.bndc) fragments.syncNdc(G.bndc);
  }
});

let audioStarted = false;
async function startAudio() {
  if (audioStarted) { audio$1.start(); return; }
  audioStarted = true;
  try {
    await audio$1.start();
  } catch (e) {  }
}
addEventListener('pointerdown', startAudio, { once: true });
addEventListener('keydown', startAudio, { once: true });

function startDive() {
  if (G.state !== 'title' || !UI.ldGone || G.diveAsked) return;
  if (player.requestLock) player.requestLock();
  startAudio();
  touch.onDive();
  audio$1.uiClick();
  if (!G.compiled) {
    G.diveAsked = true;
    document.getElementById('dive').classList.add('asked');
    setTimeout(diveAskedGo, DIVE_WAIT * 1000);
    setTimeout(() => { if (G.diveAsked) document.getElementById('diveWaitLine').hidden = false; }, DIVE_SAY * 1000);
    return;
  }
  setState('dive');
}
const DIVE_WAIT = 15;
const DIVE_SAY = 1;
function diveAskedGo() {
  if (!G.diveAsked) return;
  G.diveAsked = false;
  document.getElementById('dive').classList.remove('asked');
  if (G.state === 'title') setState('dive');
}
document.getElementById('dive').addEventListener('click', startDive);
document.getElementById('dive').addEventListener('pointerenter', () => audio$1.uiHover());
document.getElementById('again').addEventListener('click', () => location.reload());
document.getElementById('sonarBtn').addEventListener('click', (e) => { e.stopPropagation(); sonarPing(); });
document.getElementById('mute').addEventListener('click', (e) => {
  const m = audio$1.toggleMute();
  e.currentTarget.setAttribute('aria-pressed', String(!!m));
});
document.getElementById('fs').addEventListener('click', () => {
  try {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen().catch(() => {});
  } catch (e) {  }
});

let capNow = pr;
function onResize() {
  const cap = capPR();
  if (cap !== capNow) { capNow = pr = cap; renderer.setPixelRatio(pr); }
  renderer.setSize(...viewSize(), false);
  fitFov();
  if (post) {
    AS.lv = scaleLevels();
    if (AS.i >= AS.lv.length) { AS.i = AS.lv.length - 1; post.scale = AS.lv[AS.i]; }
    post.setSize();
  }
}
addEventListener('resize', onResize);
if (window.ResizeObserver) new ResizeObserver(onResize).observe(canvas);

window.__ak = {
  renderer, scene, camera, G, player, U, floorHeight, bootMarks, perf: PSW, hitches: HITCH.list,
  get post() { return post; }, get mechanism() { return mechanism; }, get life() { return life$1; },
  get fragments() { return fragments; }, get world() { return world; }, get audio() { return audio$1; },
  get critters() { return critters$1; }, get wheels() { return wheels; }, get magic() { return magic$1; },
  get diver() { return diver$1; }, get surface() { return surface; }, get prints() { return prints; }, get fx() { return fx; },
  touch, tier: TIER, frame: FRAME,
  setScale: (s) => { if (s === undefined) { PSW.adapt = true; setScaleLevel(0); } else { PSW.adapt = false; post.setScale(s); } return AS.lv; },
  step: (n = 1, dtMs = 1000 / 60) => {
    for (let i = 0; i < n; i++) tick(last + dtMs);
    return `${G.state} ${G.st.toFixed(2)}`;
  },
  metrics: () => {
    const info = renderer.info;
    const prevAuto = info.autoReset;
    info.autoReset = false;
    info.reset();
    renderer.setRenderTarget(post.sceneRT);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    const r = info.render;
    const out = { sceneDrawCalls: r.calls, sceneTriangles: r.triangles, points: r.points, lines: r.lines };
    info.reset();
    const gl = renderer.getContext();
    gl.finish();
    const t0 = performance.now();
    post.render(1 / 60);
    gl.finish();
    out.frameMsSync = +(performance.now() - t0).toFixed(2);
    out.drawCallsWithPost = info.render.calls;
    info.autoReset = prevAuto;
    const seen = new Set();
    let bytes = 0;
    const add = (tex) => {
      if (!tex || !tex.isTexture || seen.has(tex.uuid)) return;
      seen.add(tex.uuid);
      const img = tex.image || {};
      const bpp = tex.type === THREE.HalfFloatType ? 8 : tex.type === THREE.FloatType ? 16 : 4;
      bytes += (img.width || 0) * (img.height || 0) * bpp * (tex.generateMipmaps ? 4 / 3 : 1);
    };
    scene.traverse((o) => {
      for (const m of o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : []) {
        for (const k in m) if (m[k] && m[k].isTexture) add(m[k]);
        if (m.uniforms) for (const k in m.uniforms) { const v = m.uniforms[k] && m.uniforms[k].value; if (v && v.isTexture) add(v); }
      }
    });
    let rtBytes = 0;
    for (const rt of [post.sceneRT, post.compRT, post.godRT, caustics.raw, caustics.tmp, caustics.rt]) {
      if (rt) rtBytes += rt.width * rt.height * (rt.texture.type === THREE.HalfFloatType ? 8 : 4) * Math.max(1, rt.samples || 1);
    }
    Object.assign(out, {
      programs: info.programs.length, geometries: info.memory.geometries, textures: info.memory.textures,
      materialTexMB: +(bytes / 1048576).toFixed(1), renderTargetMB: +(rtBytes / 1048576).toFixed(1),
      pixelRatio: renderer.getPixelRatio(), buffer: [renderer.domElement.width, renderer.domElement.height],
    });
    return out;
  },
  skipToCrank: () => {
    if (G.site && !G.site.placed) siteNow(true);
    for (const pt of mechanism.partList) {
      pt.obj.visible = true;
      if (pt.final) { pt.obj.position.copy(pt.final.p); pt.obj.quaternion.copy(pt.final.q); pt.obj.scale.copy(pt.final.s); }
      pt.corrode.value = 0;
      pt.state = 'seated';
    }
    for (const s of mechanism.sockets || []) s.visible = false;
    for (const m of mechanism.glyphMats || []) m.opacity = 1;
    mechanism.assembly = { done: true };
    UI.showTitle(false);
    player.enabled = false;
    mg((m) => { m.begin(G.mech.M, G.mech.yaw, G.mech.size); m.setCharge(0.75); });
    setState('crank');
  },
  heroRects: (i) => heroRects(fragments && fragments.items[i]),
  setState: (s) => setState(s), startClean: (i) => startClean(fragments.items[i]),
  place: (w, p = -1) => { pzAsk.push(w | 0, p | 0); },
  pickSite: (last, from, k = 0) => {
    siteChoose(last, from);
    if (!G.site || G.site.placed) return null;
    sitePlace(G.site.cands[Math.min(k, G.site.cands.length - 1)]);
    const S = G.site;
    return { M: S.M.toArray(), yaw: S.yaw, lay: S.lay, pile: S.pile.toArray(), watch: S.watch.toArray(), vantage: S.vantage.toArray(), E: S.E.toArray(), hid: G.siteHid };
  },
  siteCands: () => SITE_CANDS.map((r) => r.map((c) => c && c.map((x) => ({ lay: x.lay, yaw: +x.yaw.toFixed(3), score: +x.score.toFixed(2), M: x.M.toArray().map((v) => +v.toFixed(2)), pile: x.pile.toArray().map((v) => +v.toFixed(2)) })))),
  moon: () => {
    const b = magic$1 && magic$1.bodyU ? magic$1.bodyU.uBP.value[1] : null, O = G.fin && G.fin.orb;
    const shown = magic$1 && magic$1.orrT > 0 && magic$1.bodyU ? magic$1.bodyU.uAlpha.value : 0;
    return {
      bead: b ? { p: [b.x, b.y, b.z], a: b.w * shown } : null,
      orb: moonOrb && moonOrb.visible ? { p: moonOrb.position.toArray(), a: ORB_U.uA.value, rho: ORB_U.uRho.value, k: ORB_U.uK.value } : null,
      win: SKY_UNIFORMS.uMoonWin.value * (SKY_UNIFORMS.uMoonLit ? SKY_UNIFORMS.uMoonLit.value : 1),
      dir: O ? O.dir.toArray() : MOON_W.toArray(), sky: MOON_DIR.toArray(),
      under: camera.position.y < waveHeight(camera.position.x, camera.position.z, U.uTime.value),
    };
  },
  sight: (kind, o) => (life$1 && life$1.rare ? life$1.rare.force(kind, o) : null),
  get dive() {
    const D = G.dive;
    return { seed: ENTRY_SEED, lensQ: OP19.Q, lensX: OP19.X, A: D && D.A, dol: D && D.dol, awe: D && D.awe, E: D && D.E, T: G.st };
  },
};

boot().catch((e) => {
  console.error(e);
  UI.loading(1, 'Something went wrong while building the scene. Try reloading.');
});

