// trains — two 2-car 桜川電鉄 EMUs (5000形), timetable traffic, doors, lights, interiors,
// passenger silhouettes, petals resting on the roof, dynamic colliders and services.rail.
import * as THREE from 'three';
import { Buckets, M, GEO } from './trains/builder.js';
import { buildCar, WHEEL_R, roofY, XE, XS, CAB_BACK } from './trains/car.js';
import { createTrainTextures, CAR_NUMBERS } from './trains/textures.js';
import { CFG, stateAt, crossingFor, frontX, tailX, TRAIN_LEN, PERIOD } from './trains/schedule.js';

const BODY_DEFS = { paint: {}, metal: {}, matte: {}, interior: {}, glass: {}, iLight: {}, led: { uv: true }, head: {}, tail: {}, decal: { uv: true }, petal: { uv: true } };
const DOOR_DEFS = { paint: {}, glass: {}, decal: { uv: true } };
const NO_SHADOW = new Set(['glass', 'iLight', 'led', 'head', 'tail', 'decal', 'petal', 'interior']);
const LOD_KEYS = new Set(['interior', 'iLight', 'petal']); // hidden when the train is far from the camera
const LOD_FAR = 95;
const DOOR_SLIDE = 0.66;
const mod = (a, n) => ((a % n) + n) % n;

// ------------------------------------------------------------------ materials
function specMat(ctx, name, shin, str, lo, hi) {
  const m = ctx.mat.toon('#ffffff', { vertexColors: true, paint: 0, name: 'trains.' + name });
  if (m.userData.trainSpec) return m;
  m.userData.trainSpec = true;
  const base = m.onBeforeCompile;
  m.onBeforeCompile = (shader, renderer) => {
    if (base) base.call(m, shader, renderer);
    shader.uniforms.uSunW = ctx.shared.uSunDir;
    shader.uniforms.uSpec = { value: new THREE.Vector4(shin, str, lo, hi) };
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uSunW; uniform vec4 uSpec;')
      .replace('#include <opaque_fragment>', /* glsl */`{
        vec3 Ls = normalize((viewMatrix * vec4(uSunW, 0.0)).xyz);
        vec3 Vv = normalize(vViewPosition);
        vec3 Hh = normalize(Ls + Vv);
        float nh = max(dot(normal, Hh), 0.0);
        float sp = smoothstep(uSpec.z, uSpec.w, pow(nh, uSpec.x));
        float dd = dot(reflectedLight.directDiffuse, vec3(0.3333));
        float dc = max(dot(diffuseColor.rgb, vec3(0.3333)), 0.03);
        float lit = smoothstep(0.3, 0.62, dd / dc);
        outgoingLight += vec3(1.0, 0.95, 0.88) * sp * lit * uSpec.y;
        float rim = pow(1.0 - clamp(dot(normal, Vv), 0.0, 1.0), 5.0);
        outgoingLight += vec3(0.92, 0.94, 1.0) * rim * lit * uSpec.y * 0.22;
      }
      #include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => 'paint|trainSpec';
  return m;
}

function makeMaterials(ctx, tex) {
  const { mat } = ctx;
  const led = mat.emissive('#ffffff', 1.3, { map: tex.led });
  led.polygonOffset = true; led.polygonOffsetFactor = -2; led.polygonOffsetUnits = -4;
  return {
    paint: specMat(ctx, 'paint', 26, 0.2, 0.5, 0.62),
    metal: specMat(ctx, 'metal', 70, 0.5, 0.45, 0.55),
    matte: mat.toon('#ffffff', { vertexColors: true, paint: 0 }),
    interior: mat.toon('#ffffff', { vertexColors: true, paint: 0, emissive: '#40301f', emissiveIntensity: 1, name: 'trains.interior' }),
    glass: mat.glass({ tint: '#8ca5b9', opacity: 0.3 }),
    iLight: mat.emissive('#fff4e2', 1.15),
    led,
    head: mat.emissive('#fff8ee', 2.4),
    tail: mat.emissive('#ff3a36', 1.9),
    lamp: mat.emissive('#ff5040', 1.6),
    decal: mat.decal('#ffffff', { map: tex.decal, paint: 0 }),
    petal: mat.foliage('#ffffff', tex.petal, { vertexColors: true, paint: 0 }),
  };
}

// ------------------------------------------------------------------ one train (2 cars)
function buildTrain(ctx, id, tex, MAT) {
  const cfg = CFG[id];
  const B = new Buckets(BODY_DEFS), dNeg = new Buckets(DOOR_DEFS), dPos = new Buckets(DOOR_DEFS);
  const rng = ctx.rng('trains.' + id);
  const wheelsets = [], lamps = [];
  for (let c = 0; c < 2; c++) {
    const carSign = c === 0 ? 1 : -1;
    const carM = M([carSign * 9, 0, 0], [0, c === 0 ? 0 : Math.PI, 0]);
    B.push(carM); dNeg.push(carM); dPos.push(carM);
    const ws = [], lp = [];
    buildCar(B, {
      lit: c === 0 ? 'head' : 'tail', animSide: c === 0 ? -1 : 1, carSign, doorsNeg: dNeg, doorsPos: dPos,
      uv: { dec: tex.dec, led: tex.ledUV },
      numFront: 'num' + ((id === 'A' ? 0 : 2) + c), numSide: 'num' + ((id === 'A' ? 4 : 6) + c),
      destKey: 'dest' + id, runKey: 'run' + id, lcdKey: 'lcd' + id, sideKey: 'side' + id,
      panto: c === 1, motor: c === 1, rng, crew: c === 0 ? 'driver' : 'conductor', jakurei: c === 1,
      wheelsets: ws, lamps: lp,
    });
    B.pop(); dNeg.pop(); dPos.pop();
    for (const w of ws) wheelsets.push(new THREE.Vector3(...w).applyMatrix4(carM));
    for (const l of lp) lamps.push(new THREE.Vector3(...l).applyMatrix4(carM));
  }
  // ---- gangway between the cars (train frame, x ∈ [-0.2, 0.2])
  B.box('matte', 0.44, 2.02, 1.12, [0, 2.3, 0], '#5d5f6b');
  for (let i = 0; i < 5; i++) {
    const x = -0.16 + i * 0.08;
    for (const [w, h, d, y, z] of [[0.035, 2.1, 0.04, 2.3, -0.6], [0.035, 2.1, 0.04, 2.3, 0.6], [0.035, 0.04, 1.24, 3.33, 0]]) B.box('matte', w, h, d, [x, y, z], i % 2 ? '#6a6c78' : '#51535e');
  }
  B.box('metal', 0.5, 0.03, 0.96, [0, 1.3, 0], '#9aa1a8');
  B.box('metal', 0.56, 0.12, 0.14, [0, 0.9, 0], '#50555e');
  for (const z of [-0.95, -0.72, 0.8]) B.tube('matte', [[0.2, 1.1, z], [0.1, 0.84, z * 1.02], [-0.1, 0.84, z * 1.02], [-0.2, 1.1, z]], 0.028, '#2f3038', 12, 6);
  B.tube('matte', [[0.62, roofY(0.62) + 0.085, 0.62], [0.28, 3.97, 0.62], [-0.28, 3.97, 0.62], [-0.62, roofY(0.62) + 0.085, 0.62]], 0.024, '#3a3a44', 12, 6);

  const group = new THREE.Group(); group.name = 'train-' + id;
  const lod = [];
  const addMeshes = (buckets, parent, mats) => {
    for (const [k, g] of Object.entries(buckets.merge())) {
      const mesh = new THREE.Mesh(g, mats[k]);
      if (LOD_KEYS.has(k) && buckets === B) lod.push(mesh);
      mesh.name = `train${id}-${k}`;
      mesh.castShadow = !NO_SHADOW.has(k); mesh.receiveShadow = k !== 'glass' && k !== 'iLight' && k !== 'led' && k !== 'head' && k !== 'tail';
      if (k === 'petal') ctx.noOutline(mesh);
      parent.add(mesh);
    }
  };
  addMeshes(B, group, MAT);
  // far LOD: one warm-grey box per car stands in for the saloon + cab behind the tinted glass
  const P = new Buckets({ interior: {} });
  for (const sg of [1, -1]) P.box('interior', XS - 0.1 - XE - 0.1, 2.1, 2.6, [sg * (9 + (XS - 0.1 + XE + 0.1) / 2), 1.3 + 1.05, 0], '#8d8279');
  const proxy = new THREE.Mesh(P.merge().interior, MAT.interior);
  proxy.name = 'train' + id + '-farInterior'; proxy.visible = false; proxy.receiveShadow = true;
  group.add(proxy);
  const gNeg = new THREE.Group(), gPos = new THREE.Group();
  gNeg.name = 'doorsNeg'; gPos.name = 'doorsPos';
  addMeshes(dNeg, gNeg, MAT); addMeshes(dPos, gPos, MAT);
  group.add(gNeg, gPos);
  // car side lamps (lit while the doors are open)
  const lampGeo = [];
  for (const p of lamps) { const g = GEO.box().clone().scale(0.075, 0.075, 0.012); g.translate(p.x, p.y, p.z); lampGeo.push(g); }
  const lampMesh = new THREE.Mesh(ctx.geo.mergeGeometries(lampGeo, false), MAT.lamp);
  lampMesh.name = `train${id}-lamps`; lampMesh.visible = false;
  group.add(lampMesh);
  group.rotation.y = cfg.dir > 0 ? 0 : Math.PI;
  group.position.set(cfg.stopX, 0, cfg.z);
  ctx.add(group);
  return { id, cfg, group, gNeg, gPos, lampMesh, lod, proxy, far: false, wheelsets, tris: B.tris + dNeg.tris + dPos.tris, st: stateAt(cfg, 0), sound: new THREE.Vector3(cfg.stopX, 1.6, cfg.z) };
}

function wheelsetGeometry() {
  const B = new Buckets({ w: {} });
  const RX = [Math.PI / 2, 0, 0];
  for (const s of [-1, 1]) {
    const z = s * 0.56;
    B.cyl('w', WHEEL_R, WHEEL_R, 0.12, [0, 0, z], '#a8adb3', RX, 26, true);
    B.cyl('w', 0.46, 0.46, 0.024, [0, 0, z - s * 0.066], '#6a6f77', RX, 26);
    B.add('w', GEO.circle(26), M([0, 0, z + s * 0.06], [0, s > 0 ? 0 : Math.PI, 0], [WHEEL_R * 2, WHEEL_R * 2, 1]), '#5d6169');
    B.add('w', GEO.circle(26), M([0, 0, z - s * 0.06], [0, s > 0 ? Math.PI : 0, 0], [WHEEL_R * 2, WHEEL_R * 2, 1]), '#5d6169');
    B.cyl('w', 0.36, 0.36, 0.122, [0, 0, z], '#555960', RX, 22, true);
    B.cyl('w', 0.14, 0.15, 0.2, [0, 0, z + s * 0.04], '#7a8088', RX, 14);
    for (let k = 0; k < 3; k++) {
      const a = k * Math.PI * 2 / 3;
      B.box('w', 0.07, 0.05, 0.012, [Math.cos(a) * 0.26, Math.sin(a) * 0.26, z + s * 0.066], '#8e949c', [0, 0, a]);
    }
  }
  B.cyl('w', 0.075, 0.075, 1.02, [0, 0, 0], '#6a6f77', RX, 12);
  return B.merge().w;
}

// ------------------------------------------------------------------ build
export async function build(ctx) {
  const { L } = ctx;
  const tex = createTrainTextures(ctx);
  const MAT = makeMaterials(ctx, tex);
  const trains = ['A', 'B'].map(id => buildTrain(ctx, id, tex, MAT));

  // wheelsets (instanced, rotate with the odometer)
  const wsGeo = wheelsetGeometry();
  const nWs = trains.reduce((n, T) => n + T.wheelsets.length, 0);
  const wheels = new THREE.InstancedMesh(wsGeo, MAT.metal, nWs);
  wheels.name = 'train-wheelsets'; wheels.castShadow = true; wheels.receiveShadow = true; wheels.frustumCulled = false;
  wheels.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  ctx.add(wheels);
  const _m = new THREE.Matrix4(), _t = new THREE.Matrix4(), _r = new THREE.Matrix4(), _zero = new THREE.Matrix4().makeScale(0, 0, 0);

  // ---------------- services.rail
  const pub = trains.map(T => ({ id: T.id, track: T.cfg.track, x: T.cfg.stopX, z: T.cfg.z, length: TRAIN_LEN, dir: T.cfg.dir, speed: 0, doorsOpen: 0, stopped: true, visible: true, front: 0, tail: 0, braking: false, dest: T.cfg.dest }));
  const memo = new Map(); let memoT = NaN;
  const cross = (x) => {
    const t = ctx.time || 0;
    if (t !== memoT) { memo.clear(); memoT = t; }
    const key = Math.round(x * 100);
    let v = memo.get(key);
    if (!v) { v = trains.map(T => crossingFor(T.cfg, x, t)); memo.set(key, v); }
    return v;
  };
  const rail = {
    trains: pub,
    crossingActive(x) { return cross(x).some(Boolean); },
    crossingApproach(x) { const v = cross(x); const o = { fromWest: false, fromEast: false }; trains.forEach((T, i) => { if (v[i]) { if (T.cfg.dir > 0) o.fromWest = true; else o.fromEast = true; } }); return o; },
    stateAt: (id, t) => stateAt(CFG[id], t),
  };
  ctx.services.rail = rail;

  // ---------------- physics: one moving box per visible train
  ctx.physics.addDynamic(() => {
    const out = [];
    for (const T of trains) { const s = stateAt(T.cfg, ctx.time || 0); if (s.visible) out.push({ cx: s.x, cz: T.cfg.z, w: TRAIN_LEN + 0.4, d: 2.86, rotY: 0, y0: 0.2, y1: 4.2 }); }
    return out;
  });

  // ---------------- audio
  const au = ctx.audio;
  const safe = (f) => { try { return f(); } catch (e) { return null; } };
  for (const T of trains) T.run = safe(() => au && au.loop && au.loop('trainRun', { position: () => T.sound, volume: 0.9 }));
  const PLAT = { A: new THREE.Vector3(17, L.PLATFORM.y + 2.2, (L.PLATFORM.south.z0 + L.PLATFORM.south.z1) / 2), B: new THREE.Vector3(17, L.PLATFORM.y + 2.2, (L.PLATFORM.north.z0 + L.PLATFORM.north.z1) / 2) };
  const doorPos = (id) => new THREE.Vector3(17, 2.2, CFG[id].z + (id === 'A' ? 1.4 : -1.4));
  const play = (name, opts) => safe(() => au && au.play && au.play(name, opts));
  const trainPos = (id) => trains.find(T => T.id === id).sound.clone();
  const events = [
    // Train A (1番線, 花見台行き)
    { at: 0.8, fn: () => play('announce', { text: 'さくらがおか、さくらがおかです。ご乗車ありがとうございます。', position: PLAT.A }) },
    { at: CFG.A.doors[0], fn: () => play('doorOpen', { position: doorPos('A') }) },
    { at: 36, fn: () => play('departMelody', { position: PLAT.A }) },
    { at: 40.2, fn: () => play('announce', { text: '1番線、ドアが閉まります。ご注意ください。', position: PLAT.A }) },
    { at: 42, fn: () => play('doorChime', { position: doorPos('A') }) },
    { at: CFG.A.doors[1], fn: () => play('doorClose', { position: doorPos('A') }) },
    { at: 108, fn: () => play('announce', { text: 'まもなく、1番線に、花見台行きの電車がまいります。黄色い線の内側でお待ちください。', position: PLAT.A }) },
    { at: mod(CFG.A.arriveT - 8 / CFG.A.brake, PERIOD), fn: () => play('trainBrake', { position: trainPos('A') }) },
    // Train B (2番線, 春日野行き)
    { at: 12, fn: () => play('announce', { text: 'まもなく、2番線に、春日野行きの電車がまいります。黄色い線の内側でお待ちください。', position: PLAT.B }) },
    { at: mod(CFG.B.arriveT - 8 / CFG.B.brake, PERIOD), fn: () => play('trainBrake', { position: trainPos('B') }) },
    { at: 32.8, fn: () => play('announce', { text: 'さくらがおか、さくらがおかです。春日野行きです。', position: PLAT.B }) },
    { at: CFG.B.doors[0], fn: () => play('doorOpen', { position: doorPos('B') }) },
    { at: 64, fn: () => play('departMelody', { position: PLAT.B }) },
    { at: 66.2, fn: () => play('announce', { text: '2番線、ドアが閉まります。ご注意ください。', position: PLAT.B }) },
    { at: 68, fn: () => play('doorChime', { position: doorPos('B') }) },
    { at: CFG.B.doors[1], fn: () => play('doorClose', { position: doorPos('B') }) },
  ];
  let prevT = null;

  // ---------------- per-frame
  const listener = new THREE.Vector3();
  function update(dt, t) {
    let wi = 0;
    listener.copy(ctx.player?.position || listener);
    trains.forEach((T, i) => {
      const s = stateAt(T.cfg, t); T.st = s;
      const g = T.group;
      g.visible = s.visible;
      if (s.visible) g.position.set(s.x, 0, T.cfg.z);
      const d = s.doors;
      T.gNeg.position.x = -DOOR_SLIDE * d; T.gPos.position.x = DOOR_SLIDE * d;
      T.lampMesh.visible = d > 0.01;
      // wheels
      _t.makeRotationY(g.rotation.y).setPosition(g.position);
      const ang = -s.s / WHEEL_R;
      for (const w of T.wheelsets) {
        if (!s.visible) { wheels.setMatrixAt(wi++, _zero); continue; }
        _r.makeRotationZ(ang).setPosition(w.x, w.y, w.z);
        _m.multiplyMatrices(_t, _r);
        wheels.setMatrixAt(wi++, _m);
      }
      // sound source: nearest point of the train to the listener
      // distance LOD (camera to the nearest point of the train)
      if (s.visible && ctx.camera) {
        const cp = ctx.camera.position, lo = Math.min(frontX(s), tailX(s)), hi = Math.max(frontX(s), tailX(s));
        const far = Math.hypot(cp.x - Math.max(lo, Math.min(hi, cp.x)), cp.z - T.cfg.z) > LOD_FAR;
        if (far !== T.far) { T.far = far; for (const m of T.lod) m.visible = !far; T.proxy.visible = far; }
      }
      if (s.visible) T.sound.set(Math.max(Math.min(frontX(s), tailX(s)), Math.min(Math.max(frontX(s), tailX(s)), listener.x)), 1.4, T.cfg.z);
      else T.sound.set(T.cfg.dir * 2000, 1.4, T.cfg.z);
      if (T.run && T.run.setParam) safe(() => T.run.setParam('speed', s.visible ? s.v : 0));
      // publish
      const p = pub[i];
      p.x = s.visible ? s.x : T.cfg.dir * 1e4; p.speed = s.v; p.doorsOpen = d; p.stopped = s.stopped; p.visible = s.visible;
      p.front = frontX(s); p.tail = tailX(s); p.braking = s.braking;
    });
    wheels.instanceMatrix.needsUpdate = true;
    // timetable sound events (only in real time, never in big jumps)
    if (prevT !== null && t > prevT && t - prevT < 1.0) {
      const a = mod(prevT, PERIOD), b = mod(t, PERIOD);
      for (const e of events) {
        const hit = a <= b ? (e.at > a && e.at <= b) : (e.at > a || e.at <= b);
        if (hit) e.fn();
      }
    }
    prevT = t;
  }
  ctx.onUpdate(update);
  update(0, ctx.time || 0);
  prevT = null;
}
