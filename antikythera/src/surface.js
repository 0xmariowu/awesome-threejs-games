// surface.js
function seaH(x, z, t, fade) {
  let dx = 0, dz = 0;
  for (let i = 0; i < WAVES.length; i++) {
    const W = WAVES[i];
    const c = Math.cos(W.k * (W.dx * x + W.dz * z) - W.w * t + W.ph);
    dx += W.Q * W.A * W.dx * c; dz += W.Q * W.A * W.dz * c;
  }
  const px = x - dx * fade, pz = z - dz * fade;
  let y = 0;
  for (let i = 0; i < WAVES.length; i++) {
    const W = WAVES[i];
    y += W.A * Math.sin(W.k * (W.dx * px + W.dz * pz) - W.w * t + W.ph);
  }
  return y * fade;
}
function orbital(x, z, t, fade, out, o) {
  let ux = 0, uz = 0;
  for (let i = 0; i < WAVES.length; i++) {
    const W = WAVES[i];
    const a = W.Q * W.A * W.w * Math.sin(W.k * (W.dx * x + W.dz * z) - W.w * t + W.ph) * fade;
    ux += a * W.dx; uz += a * W.dz;
  }
  out[o] = ux; out[o + 1] = uz;
}

const FOAM_VERT$1 = `
uniform float uTime;
attribute vec2 aFoam;
varying vec2 vFoam;
varying vec3 vFw;
${WAVES_GLSL}
float fmSea(vec2 p, float t) {
  float fade = exp(-length(p - cameraPosition.xz) / 240.0);
  vec2 d = vec2(0.0);
  for (int i = 0; i < NWAVES; i++) {
    float ph = W_K[i] * dot(W_DIR[i], p) - W_W[i] * t + W_P[i];
    d += W_Q[i] * W_A[i] * W_DIR[i] * cos(ph);
  }
  return waveHeightAt(p - d * fade, t) * fade;
}
void main() {
  vec3 w = (modelMatrix * vec4(position, 1.0)).xyz;
  w.y = fmSea(w.xz, uTime) + 0.035;
  vFw = w;
  vFoam = aFoam;
  gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
}
`;
const FOAM_FRAG$1 = `
uniform float uTime;
uniform float uFoamLight;
uniform float uFoamSpark;
uniform float uFoamUnder;
varying vec2 vFoam;
varying vec3 vFw;
${GLSL_NOISE}
void main() {
  float t = uTime;
  float across = vFoam.x;
  float n1 = sgNoise(vec3(vFw.xz * 3.2 + vec2(t * 0.11, -t * 0.07), t * 0.25));
  float n2 = sgNoise(vec3(vFw.xz * 8.5 - vec2(t * 0.2, t * 0.13), t * 0.4));
  float lace = smoothstep(0.42, 0.72, n1 * 0.62 + n2 * 0.48);
  float core = 1.0 - smoothstep(0.02, 0.32, across);
  float pulse = 0.75 + 0.25 * sin(t * 1.3 + vFoam.y * 0.9);
  float mask = max(core * (0.55 + 0.45 * lace) * pulse, lace * (1.0 - smoothstep(0.25, 1.0, across)) * 0.8);
  vec3 col = vec3(0.86, 0.9, 0.92) * uFoamLight;
  float dist = length(vFw - cameraPosition);
  float fadeS = 1.0 - smoothstep(8.0, 40.0, dist);
  float sp = pow(sgNoise(vec3(vFw.xz * 20.0, t * 1.7)), 14.0) * 7.0 * uFoamSpark * fadeS;
  col += vec3(1.0, 0.95, 0.85) * sp * lace;
  gl_FragColor = vec4(col, clamp(mask * 0.78, 0.0, 1.0) * (1.0 - 0.6 * uFoamUnder));
}
`;
function buildFoam(boat) {
  const s = boat.scale;
  const src = [];
  for (const p of waterline(72, SINK / s)) {
    const q = new THREE.Vector2(p.x * s, p.z * s);
    if (!src.length || q.distanceTo(src[src.length - 1]) > 0.02) src.push(q);
  }
  if (src.length > 2 && src[0].distanceTo(src[src.length - 1]) < 0.02) src.pop();
  const M = src.length, NW = 7;
  const pos = [], foam = [], idx = [];
  let arc = 0;
  for (let i = 0; i < M; i++) {
    const a = src[(i - 1 + M) % M], b = src[(i + 1) % M], p = src[i];
    if (i > 0) arc += p.distanceTo(src[i - 1]);
    const t = new THREE.Vector2().subVectors(b, a).normalize();
    const n = new THREE.Vector2(t.y, -t.x);
    if (n.dot(p) < 0) n.negate();
    const width = 0.5 + 0.6 * Math.abs(n.y);
    for (let j = 0; j <= NW; j++) {
      const w = -0.08 + (width + 0.08) * Math.pow(j / NW, 1.3);
      pos.push(p.x + n.x * w, 0, p.y + n.y * w);
      foam.push(j / NW, arc);
    }
  }
  const cols = NW + 1;
  for (let i = 0; i < M; i++) {
    const i2 = (i + 1) % M;
    for (let j = 0; j < NW; j++) {
      const a = i * cols + j, b = a + 1, c = i2 * cols + j, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aFoam', new THREE.Float32BufferAttribute(foam, 2));
  g.setIndex(idx);
  const uniforms = { uTime: U.uTime, uFoamLight: { value: 1 }, uFoamSpark: { value: 1 }, uFoamUnder: { value: 0 } };
  const m = new THREE.ShaderMaterial({
    uniforms, vertexShader: FOAM_VERT$1, fragmentShader: FOAM_FRAG$1,
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4,
  });
  const mesh = new THREE.Mesh(g, m);
  mesh.frustumCulled = false;
  mesh.renderOrder = 2;
  return { mesh, uniforms };
}

function buildAnchor() {
  const B = new Builder({});
  const iron = [0.2, 0.17, 0.15];
  B.add(new THREE.CylinderGeometry(0.045, 0.062, 1.5, 20), { m: mat(0, 0.75, 0), color: iron });
  const arc = [];
  for (let i = 0; i <= 30; i++) { const a = -Math.PI + 0.35 + ((Math.PI - 0.7) * i) / 30; arc.push(new V3$2(0.56 * Math.cos(a), 0.62 + 0.56 * Math.sin(a), 0)); }
  B.add(sweep$1(arc, { nk: 14, shape: circle$1((s) => 0.05 - 0.018 * Math.abs(s - 0.5) * 2, 14), up: new V3$2(0, 0, 1), capStart: true, capEnd: true }), { color: iron });
  for (const sd of [-1, 1]) {
    const a = sd > 0 ? -0.35 : -Math.PI + 0.35;
    const tip = new V3$2(0.56 * Math.cos(a), 0.62 + 0.56 * Math.sin(a), 0);
    B.add(new THREE.SphereGeometry(1, 16, 10), { m: mat(tip.x - sd * 0.06, tip.y + 0.07, 0, 0, 0, sd * 0.55, 0.13, 0.2, 0.035), color: iron });
  }
  B.add(new THREE.CylinderGeometry(0.035, 0.035, 1.35, 14), { m: mat(0, 1.4, 0, Math.PI / 2, 0, 0), color: [0.16, 0.14, 0.12] });
  for (const z of [-0.68, 0.68]) B.add(new THREE.SphereGeometry(0.06, 14, 10), { m: mat(0, 1.4, z), color: iron });
  B.add(new THREE.TorusGeometry(0.12, 0.024, 12, 36), { m: mat(0, 1.62, 0, 0, Math.PI / 2, 0), color: iron });
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.6, roughness: 0.65 });
  patchMaterial(m, { encrust: 0.85, encScale: 6, crust: [0.62, 0.32, 0.14], pink: [0.8, 0.44, 0.52], algae: [0.3, 0.5, 0.2] });
  const mesh = new THREE.Mesh(B.build(), m);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

const GULL_DECL = `
attribute vec4 aWing;
attribute vec4 aGullPose;
uniform float uRbResY;
mat3 glRz(float a) { float c = cos(a); float s = sin(a); return mat3(c, s, 0.0, -s, c, 0.0, 0.0, 0.0, 1.0); }
mat3 glRy(float a) { float c = cos(a); float s = sin(a); return mat3(c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c); }
`;
const GULL_NORMAL = `
mat3 glRS = mat3(1.0);
mat3 glRW = mat3(1.0);
vec3 glSP = vec3(0.0);
vec3 glWP = vec3(0.0);
if (aWing.y > 0.5) {
  float sd = aWing.x;
  glRS = glRz(sd * aGullPose.x) * glRy(sd * aGullPose.y);
  glSP = vec3(sd * 0.05, 0.012, 0.03);
  if (aWing.y > 1.5) { glRW = glRz(sd * aGullPose.z) * glRy(sd * aGullPose.w); glWP = vec3(sd * 0.33, 0.012, 0.02); }
  objectNormal = glRS * (glRW * objectNormal);
}
`;
const GULL_BEGIN = `
if (aWing.y > 0.5) {
  vec3 gp = transformed;
  if (aWing.y > 1.5) gp = glWP + glRW * (gp - glWP);
  transformed = glSP + glRS * (gp - glSP);
}
if (abs(aWing.z) > 0.5) {
  vec4 gmv = modelViewMatrix * instanceMatrix * vec4(transformed, 1.0);
  float gzv = max(-gmv.z, 0.05);
  float gsc = max(length(instanceMatrix[0].xyz), 1e-3);
  float gpix = 2.0 * gzv / (projectionMatrix[1][1] * uRbResY) / gsc;
  float gex = max(0.0, 0.6 * gpix - aWing.w);
  vec3 gup = aWing.y > 0.5 ? glRS * (glRW * vec3(0.0, 1.0, 0.0)) : vec3(0.0, 1.0, 0.0);
  transformed += gup * aWing.z * gex;
}
`;
function gullGeometry() {
  const B = new Builder({ aWing: 4 });
  const prof = [[0.001, -0.3], [0.018, -0.27], [0.035, -0.2], [0.06, -0.1], [0.072, -0.02], [0.07, 0.06], [0.056, 0.13], [0.042, 0.17], [0.046, 0.2], [0.047, 0.23], [0.038, 0.265], [0.02, 0.285], [0.001, 0.292]];
  const body = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 18);
  body.rotateX(Math.PI / 2);
  body.scale(1, 0.85, 1);
  body.computeVertexNormals();
  B.add(body, { color: (p) => (p.y > 0.025 && p.z > -0.16 && p.z < 0.12 ? [0.36, 0.38, 0.42] : [0.82, 0.82, 0.8]), aWing: [0, 0, 0, 0] });
  const beak = new THREE.ConeGeometry(0.014, 0.075, 10);
  beak.rotateX(Math.PI / 2);
  B.add(beak, { m: mat(0, -6e-3, 0.325), color: [0.78, 0.56, 0.06], aWing: [0, 0, 0, 0] });
  B.add(new THREE.SphereGeometry(1, 14, 8), { m: mat(0, 0.006, -0.29, 0, 0, 0, 0.058, 0.009, 0.09), color: [0.85, 0.85, 0.83], aWing: (p, n) => [0, 0, n.y >= 0 ? 1 : -1, 0.009] });
  const LE = (x) => (x <= 0.33 ? lerp$4(0.05, 0.068, (x - 0.05) / 0.28) : lerp$4(0.068, -0.05, Math.pow((x - 0.33) / 0.39, 1.5)));
  const TE = (x) => (x <= 0.33 ? lerp$4(-0.125, -0.12, (x - 0.05) / 0.28) : lerp$4(-0.12, -0.062, Math.pow((x - 0.33) / 0.39, 2.0)));
  const TH = (x) => lerp$4(0.022, 0.005, smoothstep(0.05, 0.72, x));
  const xs = [0.05, 0.09, 0.13, 0.18, 0.23, 0.28, 0.33, 0.38, 0.44, 0.5, 0.56, 0.61, 0.66, 0.69, 0.71, 0.72];
  const NC = 8;
  for (const side of [1, -1]) {
    for (const surf of [1, -1]) {
      const pos = [], col = [], wing = [], idx = [];
      for (let i = 0; i < xs.length; i++) {
        const x = xs[i];
        for (let j = 0; j < NC; j++) {
          const u = j / (NC - 1);
          const z = LE(x) + (TE(x) - LE(x)) * u;
          const th = TH(x) * 2.6 * Math.sqrt(u) * (1 - u);
          const camber = 0.6 * 4 * u * (1 - u) * TH(x);
          pos.push(side * x, camber + (surf > 0 ? th : -0.35 * th), z);
          let c;
          if (surf > 0) {
            c = [0.34, 0.36, 0.40];
            if (u > 0.86 && x < 0.56) c = [0.76, 0.76, 0.74];
            if (x > 0.56) c = [0.035, 0.035, 0.04];
            if (x > 0.625 && x < 0.69 && u > 0.35 && u < 0.62) c = [0.8, 0.8, 0.78];
          } else c = x > 0.6 ? [0.16, 0.16, 0.17] : [0.78, 0.78, 0.76];
          col.push(...c);
          wing.push(side, x <= 0.331 ? 1 : 2, surf, Math.max(0.002, th * 0.7));
        }
      }
      for (let i = 0; i < xs.length - 1; i++) {
        for (let j = 0; j < NC - 1; j++) {
          const a = i * NC + j, b = a + NC, c = a + 1, d = b + 1;
          if (side * surf > 0) idx.push(a, b, c, c, b, d); else idx.push(a, c, b, c, d, b);
        }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      g.setAttribute('aWing', new THREE.Float32BufferAttribute(wing, 4));
      g.setIndex(idx);
      g.computeVertexNormals();
      B.add(g, {});
    }
  }
  return B.build();
}

const GLIDE$1 = [0.14, 0.06, -0.22, 0.26], FOLD = [0.04, 1.38, 0.02, 0.3];
class Gulls {
  constructor(scene, rng) {
    const N = 6;
    const geo = gullGeometry();
    this.pose = new THREE.InstancedBufferAttribute(new Float32Array(N * 4), 4);
    this.pose.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aGullPose', this.pose);
    const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78, metalness: 0, side: THREE.DoubleSide });
    m.onBeforeCompile = (shader) => {
      shader.uniforms.uRbResY = ROPE_U.uRbResY;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\n' + GULL_DECL)
        .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\n' + GULL_NORMAL)
        .replace('#include <begin_vertex>', '#include <begin_vertex>\n' + GULL_BEGIN);
    };
    m.customProgramCacheKey = () => 'sg-gull-1';
    this.mesh = new THREE.InstancedMesh(geo, m, N);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = false;
    scene.add(this.mesh);
    this.birds = [];
    for (let i = 0; i < N; i++) {
      this.birds.push({
        ox: (rng() - 0.5) * 12, oz: (rng() - 0.5) * 12,
        pos: new V3$2(LAYOUT.boat.x + (rng() - 0.5) * 40, 10 + rng() * 14, LAYOUT.boat.z - 10 + (rng() - 0.5) * 40),
        hd: rng() * 6.28, speed: 7.5 + rng() * 1.5, alt: 9 + rng() * 15, bias: (rng() < 0.5 ? -1 : 1) * (0.5 + rng() * 0.2),
        ph: rng() * 10, flap: 0, flapUntil: 0, nextFlap: 1 + rng() * 5, fph: rng() * 6, bank: 0, pitch: 0,
        e: GLIDE$1.slice(), state: 'fly', st: 0, from: new V3$2(),
      });
    }
    this.floatAt = new V3$2(2.3, 0, 16.4);
    this.home = new V3$2(LAYOUT.boat.x, 0, LAYOUT.boat.z); this.fw3 = new V3$2(); this.snap = true;
    this.q = new THREE.Quaternion(); this.eul = new THREE.Euler(0, 0, 0, 'YXZ'); this.m4 = new THREE.Matrix4();
    this.sc = new V3$2(1.0, 1.0, 1.0);
  }
  update(t, dt, fadeAt, cam) {
    const arr = this.pose.array;
    if (cam) {
      cam.getWorldDirection(this.fw3);
      this.fw3.y = 0;
      if (this.fw3.lengthSq() > 1e-6) {
        this.fw3.normalize();
        const hx = cam.position.x + this.fw3.x * 42 - this.fw3.z * 24, hz = cam.position.z + this.fw3.z * 42 + this.fw3.x * 24;
        const k = this.snap ? 1 : 1 - Math.exp(-dt / 8);
        this.home.x += (hx - this.home.x) * k; this.home.z += (hz - this.home.z) * k;
      }
    }
    for (let i = 0; i < this.birds.length; i++) {
      const b = this.birds[i];
      b.st += dt;
      let tgt = GLIDE$1, flapW = 0;
      if (this.snap && b.state === 'fly') b.pos.set(this.home.x + b.ox + Math.sin(b.hd) * 8, b.alt, this.home.z + b.oz + Math.cos(b.hd) * 8);
      if (i === 0 && b.state === 'fly' && b.st > 12) { b.state = 'approach'; b.st = 0; b.from.copy(b.pos); }
      if (b.state === 'fly') {
        const hcx = this.home.x + b.ox, hcz = this.home.z + b.oz;
        const toC = Math.atan2(hcx - b.pos.x, hcz - b.pos.z);
        const dist = Math.hypot(hcx - b.pos.x, hcz - b.pos.z);
        let dh = toC - b.hd; dh = Math.atan2(Math.sin(dh), Math.cos(dh));
        const turn = b.bias + 0.18 * Math.sin(t * 0.17 + b.ph) + dh * smoothstep(8, 22, dist) * 1.2;
        b.hd += turn * dt;
        b.pos.x += Math.sin(b.hd) * b.speed * dt;
        b.pos.z += Math.cos(b.hd) * b.speed * dt;
        const alt = b.alt + 3 * Math.sin(t * 0.21 + b.ph);
        const climb = (alt - b.pos.y) * (1 - Math.exp(-dt * 0.6));
        b.pos.y += climb;
        if (t > b.nextFlap) { b.flapUntil = t + 0.8 + (b.ph % 0.6); b.nextFlap = b.flapUntil + 7 + ((b.ph * 7.3) % 7); }
        flapW = t < b.flapUntil || alt - b.pos.y > 2.5 ? 1 : 0;
        b.bank = lerp$4(b.bank, clamp$9(-turn * b.speed / 9.81, -0.65, 0.65), 1 - Math.exp(-dt * 3));
        b.pitch = lerp$4(b.pitch, clamp$9(-climb / Math.max(dt, 1e-3) / b.speed, -0.3, 0.3), 1 - Math.exp(-dt * 2));
      } else if (b.state === 'approach') {
        const u = Math.min(1, b.st / 6.5), e = u * u * (3 - 2 * u);
        const tx = this.floatAt.x, tz = this.floatAt.z, ty = seaH(tx, tz, t, fadeAt) + 0.35;
        const px = lerp$4(b.from.x, tx, e), pz = lerp$4(b.from.z, tz, e);
        const py = lerp$4(b.from.y, ty, Math.pow(u, 1.4)) + Math.sin(u * Math.PI) * 1.5;
        if (Math.hypot(px - b.pos.x, pz - b.pos.z) > 1e-4) b.hd = Math.atan2(px - b.pos.x, pz - b.pos.z);
        b.pos.set(px, py, pz);
        b.bank = lerp$4(b.bank, 0, 1 - Math.exp(-dt * 2));
        b.pitch = lerp$4(b.pitch, u > 0.85 ? -0.5 : 0.12, 1 - Math.exp(-dt * 3));
        tgt = u > 0.85 ? [0.9, 0.1, 0.2, 0.2] : [0.26, 0.15, -0.2, 0.35];
        flapW = u > 0.88 ? 1 : 0;
        if (u >= 1) { b.state = 'float'; b.st = 0; }
      } else if (b.state === 'float') {
        const x = this.floatAt.x + Math.sin(t * 0.05) * 0.6, z = this.floatAt.z + Math.cos(t * 0.04) * 0.4;
        const y = seaH(x, z, t, fadeAt);
        const e = 0.25, gx = (seaH(x + e, z, t, fadeAt) - seaH(x - e, z, t, fadeAt)) / (2 * e), gz = (seaH(x, z + e, t, fadeAt) - seaH(x, z - e, t, fadeAt)) / (2 * e);
        b.pos.set(x, y + 0.02, z);
        b.hd += dt * 0.05 * Math.sin(t * 0.3);
        b.pitch = lerp$4(b.pitch, -Math.atan(gx * Math.sin(b.hd) + gz * Math.cos(b.hd)), 1 - Math.exp(-dt * 4));
        b.bank = lerp$4(b.bank, Math.atan(gx * Math.cos(b.hd) - gz * Math.sin(b.hd)), 1 - Math.exp(-dt * 4));
        tgt = FOLD;
        if (b.st > 38) { b.state = 'takeoff'; b.st = 0; }
      } else {
        const u = Math.min(1, b.st / 2.5);
        b.pos.x += Math.sin(b.hd) * (2 + 7 * u) * dt;
        b.pos.z += Math.cos(b.hd) * (2 + 7 * u) * dt;
        b.pos.y += (0.4 + 3.5 * u) * dt;
        b.pitch = lerp$4(b.pitch, -0.25, 1 - Math.exp(-dt * 3));
        flapW = 1;
        if (u >= 1) { b.state = 'fly'; b.st = -40; }
      }
      b.flap = lerp$4(b.flap, flapW, 1 - Math.exp(-dt * 6));
      b.fph += dt * Math.PI * 2 * 3.1;
      const s = Math.sin(b.fph), c = Math.cos(b.fph);
      const k = 1 - Math.exp(-dt * 8);
      for (let j = 0; j < 4; j++) b.e[j] = lerp$4(b.e[j], tgt[j], k);
      arr[i * 4] = lerp$4(b.e[0] + 0.03 * Math.sin(t * 1.3 + b.ph), 0.12 + 0.72 * s, b.flap);
      arr[i * 4 + 1] = lerp$4(b.e[1], 0.08 + 0.1 * c, b.flap);
      arr[i * 4 + 2] = lerp$4(b.e[2], -0.2 + 0.42 * Math.sin(b.fph - 0.7), b.flap);
      arr[i * 4 + 3] = lerp$4(b.e[3], 0.25 + 0.25 * Math.max(0, -c), b.flap);
      this.eul.set(b.pitch, b.hd, b.bank, 'YXZ');
      this.q.setFromEuler(this.eul);
      this.m4.compose(b.pos, this.q, this.sc);
      this.mesh.setMatrixAt(i, this.m4);
    }
    this.snap = false;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.pose.needsUpdate = true;
  }
}

const STATIONS = [[0, 4.5], [0, -4.6], [1.2, 2.6], [1.62, 0], [1.3, -2.5], [-1.2, 2.6], [-1.62, 0], [-1.3, -2.5]];
const HSTEP = 1 / 120;
const WH = (2 * Math.PI) / 2.3, ZH = 0.35;
const WP = (2 * Math.PI) / 2.9, ZP = 0.45;
const WR$1 = (2 * Math.PI) / 4.1, ZR = 0.13;
const UMEAN = 4.0, CW = 7.5e-4;
const UREF = 5.5;
const CF1 = 0.08, CF2 = 0.25, CL1 = 0.8, CL2 = 2.5;
const K1 = 0.06, K3 = 0.08;
const IYI = 0.05, CY1 = 0.3, CY2 = 0.8;
const CRD = 0.35;
const YSOFT = 0.22, KYS = 0.6;
const CORB = 1.4, CORBY = 0.12;
const HEADING = -1.039;
const WOFF = Math.atan2(-0.91, 0.41) - HEADING;
const MOOR = { aoff: 0.06 };
const SINK = 0;
const DIVER_HEEL = 0.028;
const SPRAY_K = {
  thrSlap: 0.2, slapK: 3.0, slapMax: 3.1, slapW: 0.6, bowMin: 1.1, bowRand: 1.1, afterSlap: 0.9,
  thrLick: 0.55, lickIn: 1.5, lickK: 3.2, lickMax: 2.6, lickW: 0.36, lickCool0: 1.4, lickCoolR: 1.6, gap0: 0.25, gapR: 0.6,
  lickSeen: 0.85, lickHid: 1.3, seenSlap: 1.4, seenLick: 1.9, guard: 1.7, guardK: 0.55, slapGap: 3.2,
  faceMin: 0.35, faceSeen: 0.5, ladderPr: 5,
};

class Surface {
  constructor(scene) {
    const rng = makeRng$1(1900);
    this.island = buildIsland();
    scene.add(this.island.group);

    this.boat = buildBoat();
    this.heading = HEADING;
    this.scene = scene;
    const bg = this.boat.group;
    bg.position.set(LAYOUT.boat.x, 0, LAYOUT.boat.z);
    bg.userData.waterline = 0;
    bg.userData.waterlineLocalY = 0;
    bg.userData.hullWetBand = true;
    bg.rotation.set(0, this.heading, 0, 'YXZ');
    scene.add(bg);
    bg.updateMatrixWorld(true);
    this.roller = this.boat.roller.clone();
    this.rollerRest = this.roller.clone().applyMatrix4(bg.matrixWorld);
    this.rollerNow = new V3$2();
    this.lamp = this.boat.lantern.clone();
    this.lampW = new V3$2();
    this.lampLight = new THREE.PointLight(0xff9038, 0, 14, 2);
    this.lampLight.castShadow = false;
    scene.add(this.lampLight);

    const foam = buildFoam(this.boat);
    this.foam = foam.mesh;
    this.foamU = foam.uniforms;
    scene.add(this.foam);

    const ay = floorHeight(LAYOUT.anchor.x, LAYOUT.anchor.z);
    const r0 = this.rollerRest;
    const anchor = buildAnchor();
    anchor.rotation.set(Math.PI / 2 - 0.2, 0, 0.12);
    const anchorG = new THREE.Group();
    anchorG.position.set(LAYOUT.anchor.x, ay - 0.08, LAYOUT.anchor.z);
    anchorG.rotation.y = Math.atan2(r0.x - LAYOUT.anchor.x, r0.z - LAYOUT.anchor.z);
    anchorG.add(anchor);
    scene.add(anchorG);
    anchorG.updateMatrixWorld(true);
    const ring = new V3$2(0, 1.62, 0).applyMatrix4(anchor.matrixWorld);
    this.anchorRing = ring.clone();
    {
      const hx = r0.x - ring.x, hz = r0.z - ring.z, X = Math.hypot(hx, hz), ux = hx / X, uz = hz / X;
      const xs = 0.66 * X;
      const td = new V3$2(ring.x + ux * (X - xs), 0, ring.z + uz * (X - xs));
      td.y = floorHeight(td.x, td.z) + 0.025;
      const Hs = r0.y - td.y;
      let lo = 0.2, hi = 2000;
      for (let k = 0; k < 80; k++) { const a = (lo + hi) / 2; if (a * (Math.cosh(xs / a) - 1) > Hs) lo = a; else hi = a; }
      const ca = (lo + hi) / 2;
      const pts = [];
      const NS = 36;
      for (let i = 0; i <= NS; i++) {
        const s = i / NS;
        const wob = 0.3 * Math.sin(s * 6.5 + 0.7) * Math.sin(s * Math.PI);
        const x = ring.x + (td.x - ring.x) * s - uz * wob, z = ring.z + (td.z - ring.z) * s + ux * wob;
        pts.push(new V3$2(x, lerp$4(ring.y, floorHeight(x, z) + 0.025, smoothstep(0, 0.12, s)), z));
      }
      const NC = 180;
      for (let i = 1; i <= NC; i++) {
        const x = xs * (i / NC);
        pts.push(new V3$2(td.x + ux * x, td.y + ca * (Math.cosh(x / ca) - 1), td.z + uz * x));
      }
      pts[pts.length - 1].copy(r0);
      let sTD = 0, sTot = 0;
      for (let i = 1; i < pts.length; i++) { sTot += pts[i].distanceTo(pts[i - 1]); if (i === NS) sTD = sTot; }
      const rope = new RopeBuilder().add(pts, 0.019, [0.13, 0.12, 0.08], { follow: (s) => (s <= sTD ? 0 : Math.pow((s - sTD) / (sTot - sTD), 2)) });
      this.anchorMat = ropeMaterial({ fuzz: 1 });
      if (!this.anchorMat.userData.rb) this.anchorMat.userData.rb = { uRbMin: { value: 0.72 }, uRbFuzz: { value: 1 } };
      patchMaterial(this.anchorMat);
      this.anchorRope = new THREE.Mesh(rope.build(), this.anchorMat);
      this.anchorRope.frustumCulled = false;
      this.anchorRope.onBeforeRender = this.boat.ropes.onBeforeRender;
      scene.add(this.anchorRope);
    }
    patchMaterial(this.boat.ropeMaterial);

    {
      const c = LAYOUT.titleCam, f = new V3$2(c.lookX - c.x, 0, c.lookZ - c.z).normalize(), r = new V3$2(-f.z, 0, f.x);
      const at = (d, s) => new V3$2(c.x + f.x * d + r.x * s, 0, c.z + f.z * d + r.z * s);
      const A = at(5.5, 0.6), Bf = at(7.3, 2.6);
      this.flPts = new THREE.CatmullRomCurve3([at(4.2, -0.5), A, Bf, at(8.9, 3.9), at(10.7, 5.4)], false, 'centripetal').getSpacedPoints(48);
      const nP = this.flPts.length;
      this.flSink = new Float32Array(nP);
      this.flPts.forEach((p, i) => {
        const near = Math.min(p.distanceTo(A), p.distanceTo(Bf));
        this.flSink[i] = 0.03 * Math.min(1, near / 0.8) + 0.35 * smoothstep(0.75, 1, i / (nP - 1));
      });
      this.flMat = ropeMaterial();
      patchMaterial(this.flMat);
      this.flRope = new THREE.Mesh(new RopeBuilder().add(this.flPts, 0.011, [0.17, 0.14, 0.1]).build(), this.flMat);
      this.flRope.frustumCulled = false;
      this.flRope.onBeforeRender = this.boat.ropes.onBeforeRender;
      scene.add(this.flRope);
      const prof = [[0.001, -0.13], [0.04, -0.128], [0.058, -0.11], [0.066, -0.06], [0.068, 0], [0.066, 0.06], [0.058, 0.11], [0.04, 0.128], [0.001, 0.13]];
      const cork = new THREE.LatheGeometry(prof.map(([x, y]) => new THREE.Vector2(x, y)), 18);
      cork.rotateZ(Math.PI / 2);
      const CB = new Builder({ aMat: 4, aDyn: 4 });
      part(CB, cork, { c: [0.34, 0.25, 0.16], r: 0.95, t: T.PLAIN });
      part(CB, new THREE.TorusGeometry(0.068, 0.007, 6, 22).rotateY(Math.PI / 2).translate(0.07, 0, 0), { c: [0.16, 0.13, 0.09], r: 0.9 });
      part(CB, new THREE.TorusGeometry(0.068, 0.007, 6, 22).rotateY(Math.PI / 2).translate(-0.07, 0, 0), { c: [0.16, 0.13, 0.09], r: 0.9 });
      const cg = CB.build();
      const yaw = Math.atan2(Bf.x - A.x, Bf.z - A.z) - Math.PI / 2;
      this.corks = [A, Bf].map((p, i) => {
        const m = new THREE.Mesh(cg, this.boat.material);
        m.castShadow = false;
        m.receiveShadow = false;
        scene.add(m);
        return { m, p: p.clone(), yaw: yaw + (i ? 0.25 : -0.15) };
      });
      this._fn = new V3$2(); this._fup = new V3$2(0, 1, 0); this._fqa = new THREE.Quaternion(); this._fqb = new THREE.Quaternion();
    }

    this.gulls = new Gulls(scene, rng);
    this.horizon = new Horizon(scene, this.island.lighthouse);
    this.flare = new Flare();
    scene.add(this.flare.mesh);

    this.laundry = new Laundry();
    scene.add(this.laundry.mesh);
    this.lnA = new V3$2(); this.lnB = new V3$2(); this.fw = new V3$2();
    this.sw = new V3$2(); this.swv = new V3$2(); this._q = new THREE.Quaternion(); this._d = new V3$2(); this._w = new V3$2();
    this._rp = new V3$2(); this._rp0 = new V3$2(); this._rv = new V3$2(); this._rv0 = new V3$2(); this._ra = new V3$2(); this._rpN = 0; this._sww = new V3$2();
    this.orb = new Float32Array(6);
    this.flagIdle = 0;

    this.spray = new Spray();
    scene.add(this.spray.mesh);
    {
      const wl = waterline(48, SINK / this.boat.scale), SC = this.boat.scale, ps = new V3$2();
      this.prY = SINK / SC;
      const nearest = (z, side) => {
        let best = 0, bd = 1e9;
        wl.forEach((q, i) => { if (Math.sign(q.x) === side && Math.abs(q.z - z) < bd) { bd = Math.abs(q.z - z); best = i; } });
        return best;
      };
      const em = (i, side) => {
        const q = wl[i], qa = wl[Math.max(0, i - 1)], qb = wl[Math.min(wl.length - 1, i + 1)];
        sidePoint(q.z, 0.08, side, ps);
        const fl = clamp$9(((ps.x - q.x) * q.nx + (ps.z - q.z) * q.nz) / Math.max(ps.y, 0.2), 0, 0.8);
        const dsl = Math.hypot(qb.x - qa.x, qb.z - qa.z) || 1;
        const kap = Math.min(Math.acos(clamp$9(qa.nx * qb.nx + qa.nz * qb.nz, -1, 1)) / dsl, 3) / SC;
        return { x: q.x * SC, z: q.z * SC, nx: q.nx, nz: q.nz, fl, kap };
      };
      let bow = 0;
      wl.forEach((q, i) => { if (q.z > wl[bow].z) bow = i; });
      const pick = [[bow, 1]];
      for (const side of [1, -1]) for (const z of [3.5, 1.9, 0.1, -1.9, -3.7]) pick.push([nearest(z, side), side]);
      const np = pick.length;
      this.prN = np;
      const f32 = () => new Float32Array(np);
      this.prX = f32(); this.prZ = f32(); this.prNX = f32(); this.prNZ = f32();
      this.prRel = f32(); this.prCool = f32(); this.prThr = f32(); this.prImp = f32(); this.prPk = f32(); this.prArm = f32(); this.prUrge = f32(); this.prFar = f32();
      this.emX = f32(); this.emZ = f32(); this.emNX = f32(); this.emNZ = f32(); this.emFl = f32(); this.emKap = f32();
      pick.forEach(([i, side], k) => {
        const q = wl[i], m = em(i, side);
        this.prX[k] = q.x; this.prZ[k] = q.z; this.prNX[k] = q.nx; this.prNZ[k] = q.nz;
        this.emX[k] = m.x; this.emZ[k] = m.z; this.emNX[k] = m.nx; this.emNZ[k] = m.nz; this.emFl[k] = m.fl; this.emKap[k] = m.kap;
        this.prThr[k] = SPRAY_K.thrLick;
        this.prCool[k] = 1 + k * 0.3;
      });
      this.bowPts = [em(nearest(4.45, 1), 1), em(nearest(4.45, -1), -1)];
      this.spray.hull([...this.bowPts, ...pick.slice(1).map(([i]) => wl[i])]);
      this.prInit = false;
    }
    this._lcx = 0; this._lcz = 30;
    this.leaps = new Leaps(scene, this.spray.uniforms, (x, z, t) => seaH(x, z, t, Math.exp(-Math.hypot(x - this._lcx, z - this._lcz) / 240)));
    this.bowCool = 1.0; this.lickCool = 0.5; this.slapThr = SPRAY_K.thrSlap; this.slapN = 0; this.lickN = 0; this.lickSlot = 0;
    this.bowPk = 0; this.bowArm = 0; this.bowUrge = false;
    this.seenT = 0; this.slapSeen = -100;
    this.rollS = 0;
    this._invS = new THREE.Matrix4().makeScale(1 / this.boat.scale, 1 / this.boat.scale, 1 / this.boat.scale);
    this._pv = new V3$2(); this._pv2 = new V3$2();
    this.orbP = new Float32Array(2);
    this.srng = makeRng$1(2024);
    this.keyL = null; this.skyL = null; this.lightLook = 0;
    this.heelT = 0;
    this.diverLoad = null; this.dLoad = 0;
    this.pumpA = 0; this.pumpW = 0; this.needle = 2.356; this.rud = 0; this.sand = 0; this.airMax = 1; this.slapT = -100;
    {
      const S = this.spray, B = this.boat, tp = B.tether.pos, rungs = B.dive.rungs;
      const dry = rungs.filter((r) => r.y > 0.05);
      const rung = dry[dry.length - 1] || rungs[0];
      const bowR = deckAt(4.7), sq = deckAt(-4.85);
      S.drip(0, tp.x + 0.09, tp.y - 0.04, tp.z - 0.03, 0.9, 0.9);
      S.drip(1, tp.x + 0.08, tp.y - 0.05, tp.z + 0.03, 1.3, 0.8);
      S.drip(2, rung.x + 0.02, rung.y - 0.02, rung.z, 0.7, 1);
      S.drip(3, B.roller.x, B.roller.y - 0.05, B.roller.z + 0.06, 1.1, 0.7);
      S.drip(4, sq.xe + 0.1, sq.ys - 0.02, -4.97, 1.6, 0.5);
      S.drip(5, bowR.xe + 0.06, bowR.ys - 0.04, 4.7, 0.3, 0);
      S.drip(6, -(bowR.xe + 0.06), bowR.ys - 0.04, 4.7, 0.3, 0);
      S.drip(7, B.tether.water.x + 0.03, 0.4, B.tether.water.z, 1.8, 0.5);
    }

    const S = this.boat.scale;
    this.stX = new Float32Array(8); this.stZ = new Float32Array(8); this.sea = new Float32Array(8);
    let sx2 = 0, sz2 = 0;
    STATIONS.forEach(([x, z], i) => { this.stX[i] = x * S; this.stZ[i] = z * S; sx2 += (x * S) ** 2; sz2 += (z * S) ** 2; });
    this.SX2 = sx2; this.SZ2 = sz2;
    this.bowD = this.boat.roller.z * S;
    this.f0x = Math.sin(this.heading + MOOR.aoff); this.f0z = Math.cos(this.heading + MOOR.aoff);
    this.avx = this.anchorRing.x; this.avz = this.anchorRing.z;
    const D = Math.hypot(this.avx - (LAYOUT.boat.x + Math.sin(this.heading) * this.bowD), this.avz - (LAYOUT.boat.z + Math.cos(this.heading) * this.bowD));
    const drag0 = CW * UMEAN * UMEAN;
    let lo = 0, hi = 5;
    for (let k = 0; k < 40; k++) { const m = (lo + hi) / 2; if (K1 * m + K3 * m * m * m < drag0) lo = m; else hi = m; }
    this.L0 = D - lo;
    this.p = { x: LAYOUT.boat.x, z: LAYOUT.boat.z, vx: 0, vz: 0, yaw: this.heading, vyaw: 0, y: 0, vy: 0, pit: 0, vpit: 0, rol: 0, vrol: 0, acc: 0, wx: 0, wz: 0, gust: 0 };
    this.night = 0;
  }

  _step(h) {
    const p = this.p;
    const sp = Math.sin(p.pit), sr = Math.sin(p.rol);
    let sS = 0, sZ = 0, sX = 0;
    for (let i = 0; i < 8; i++) {
      const lx = this.stX[i], lz = this.stZ[i];
      const s = this.sea[i] - (p.y - lz * sp + lx * sr);
      sS += s; sZ += s * lz; sX += s * lx;
    }
    p.vy += (WH * WH * sS / 8 - 2 * ZH * WH * p.vy) * h;
    p.vpit += (-WP * WP * sZ / this.SZ2 - 2 * ZP * WP * p.vpit) * h;
    p.vrol += (WR$1 * WR$1 * (sX / this.SX2 + this.heelT) - 2 * ZR * WR$1 * p.vrol + 0.004 * p.gust) * h;
    p.y += p.vy * h; p.pit += p.vpit * h; p.rol += p.vrol * h;
    const fx = Math.sin(p.yaw), fz = Math.cos(p.yaw), lxv = Math.cos(p.yaw), lzv = -Math.sin(p.yaw);
    const rwx = p.wx - p.vx, rwz = p.wz - p.vz, rw = Math.hypot(rwx, rwz);
    const wfx = CW * rw * rwx, wfz = CW * rw * rwz;
    const vf = p.vx * fx + p.vz * fz, vl = p.vx * lxv + p.vz * lzv;
    const df = -(CF1 * vf + CF2 * vf * Math.abs(vf)), dl = -(CL1 * vl + CL2 * vl * Math.abs(vl));
    const bx = p.x + fx * this.bowD, bz = p.z + fz * this.bowD;
    const ax = this.avx - bx, az = this.avz - bz, d = Math.hypot(ax, az) || 1;
    const ext = Math.max(0, d - this.L0);
    const vbx = p.vx + p.vyaw * this.bowD * fz, vbz = p.vz - p.vyaw * this.bowD * fx;
    const rate = -(vbx * ax + vbz * az) / d;
    const T = ext > 0 ? Math.max(0, K1 * ext + K3 * ext * ext * ext + CRD * rate) : 0;
    const rfx = (T * ax) / d, rfz = (T * az) / d;
    const O = this.orb;
    p.vx += (wfx + df * fx + dl * lxv + rfx + CORB * (O[2] - p.vx)) * h;
    p.vz += (wfz + df * fz + dl * lzv + rfz + CORB * (O[3] - p.vz)) * h;
    p.x += p.vx * h; p.z += p.vz * h;
    const tRope = fz * this.bowD * rfx - fx * this.bowD * rfz;
    const wa = 0.9 * this.boat.scale;
    const tWind = -fz * wa * wfx + fx * wa * wfz;
    const tSwell = CORBY * ((O[0] - O[4]) * lxv + (O[1] - O[5]) * lzv);
    const dy = p.yaw - this.heading, over = Math.abs(dy) - YSOFT;
    const tSoft = over > 0 ? -Math.sign(dy) * KYS * over : 0;
    p.vyaw += ((tRope + tWind) * IYI + tSwell + tSoft - CY1 * p.vyaw - CY2 * p.vyaw * Math.abs(p.vyaw)) * h;
    p.yaw += p.vyaw * h;
  }

  _spray(t, dt, fade, camera, e) {
    const p = this.p, bg = this.boat.group, S = this.spray, U = S.uniforms, K = SPRAY_K, rng = this.srng;
    U.uTime.value = t;
    if (camera && camera.aspect) U.uAspect.value = camera.aspect;
    if (!this.keyL && (this.lightLook -= dt) <= 0) {
      this.lightLook = 2;
      this.scene.traverse((o) => {
        if (o.isDirectionalLight && o.castShadow && !this.keyL) this.keyL = o;
        if (o.isHemisphereLight && !this.skyL) this.skyL = o;
      });
    }
    if (this.keyL) {
      const kl = this.keyL;
      U.uKeyDir.value.subVectors(kl.position, kl.target.position).normalize();
      U.uKeyCol.value.set(kl.color.r, kl.color.g, kl.color.b).multiplyScalar(kl.intensity);
    } else {
      U.uKeyDir.value.copy(SKY_UNIFORMS.uSunDir.value);
      U.uKeyCol.value.setScalar(3.1 * (1 - e));
    }
    if (BT_U.uBtKey) BT_U.uBtKey.value.copy(U.uKeyCol.value);
    if (ROPE_U.uRbKey) ROPE_U.uRbKey.value.copy(U.uKeyCol.value);
    if (ROPE_U.uRbSun) ROPE_U.uRbSun.value.copy(SKY_UNIFORMS.uSunDir.value);
    if (this.skyL) {
      const hl = this.skyL;
      U.uSkyCol.value.set(hl.color.r, hl.color.g, hl.color.b).multiplyScalar(hl.intensity);
      U.uSeaCol.value.set(hl.groundColor.r, hl.groundColor.g, hl.groundColor.b).multiplyScalar(hl.intensity * 0.35);
    } else {
      U.uSkyCol.value.set(0.56, 0.72, 0.9).multiplyScalar(1 - 0.9 * e);
      U.uSeaCol.value.set(0.1, 0.13, 0.15).multiplyScalar(1 - 0.9 * e);
    }
    U.uBoatM.value.copy(bg.matrixWorld).multiply(this._invS);
    U.uGrav.value.set(0, -9.81, 0).applyQuaternion(this._q);
    U.uWindB.value.set(p.wx, 0, p.wz).applyQuaternion(this._q);
    const cyaw = Math.cos(p.yaw), syaw = Math.sin(p.yaw), idt = 1 / Math.max(dt, 1e-3);
    this.bowCool -= dt; this.lickCool -= dt;
    const cam = camera && camera.position, late = t - this.seenT - K.guard, starve = late > 0;
    const urgeK = starve ? K.guardK + (0.15 - K.guardK) * Math.min(late / 0.8, 1) : 1, gapped = t - this.slapSeen > K.slapGap;
    for (let k = 0; k < this.prN; k++) {
      const v = this._pv.set(this.prX[k], this.prY, this.prZ[k]).applyMatrix4(bg.matrixWorld);
      const nx = this.prNX[k] * cyaw + this.prNZ[k] * syaw, nz = -this.prNX[k] * syaw + this.prNZ[k] * cyaw;
      let facing = true, seen = true;
      if (cam) {
        const dx = cam.x - v.x, dz = cam.z - v.z, dc = Math.hypot(dx, dz) || 1;
        if (k === 0) this.stemD = dc;
        this.prFar[k] = dc - (this.stemD || dc);
        let fd = (dx * nx + dz * nz) / dc;
        if (k === 0) {
          fd = -1;
          for (const q of this.bowPts) fd = Math.max(fd, (dx * (q.nx * cyaw + q.nz * syaw) + dz * (-q.nx * syaw + q.nz * cyaw)) / dc);
        }
        facing = fd > K.faceMin;
        seen = fd > K.faceSeen && k !== K.ladderPr;
        if (seen && camera.isCamera) {
          const pr = this._pv2.copy(v).project(camera);
          seen = pr.z < 1 && Math.abs(pr.x) < 0.95 && Math.abs(pr.y) < 0.95;
        }
      }
      const hs = seaH(v.x, v.z, t, fade), rel = hs - v.y;
      const drel = this.prInit && dt > 0 ? (rel - this.prRel[k]) * idt : 0;
      this.prRel[k] = rel;
      orbital(v.x, v.z, t, fade, this.orbP, 0);
      const vin = -((this.orbP[0] - p.vx) * nx + (this.orbP[1] - p.vz) * nz);
      const imp = k === 0 ? Math.max(drel, 0) + 0.5 * Math.max(vin, 0)
        : Math.max(drel, 0) * smoothstep(0, 0.12, vin) + K.lickIn * Math.max(vin, 0);
      this.prImp[k] = imp;
      this.prCool[k] -= dt;
      const y0 = SINK + clamp$9(rel, -0.06, 0.6);
      if (k === 0) {
        const urge = (starve && facing) || gapped, mul = gapped ? Math.min(urgeK, 0.5) : urge ? urgeK : 1;
        if (this.bowPk <= 0) {
          if ((this.bowCool > 0 && !gapped) || t - this.slapT < 0.6 || imp <= this.slapThr * mul || rel < -0.1) continue;
          this.bowPk = imp; this.bowArm = t; this.bowUrge = urge;
        }
        this.bowPk = Math.max(this.bowPk, imp);
        if (imp > this.bowPk - 0.02 && t - this.bowArm < 0.45) continue;
        const pk = this.bowPk;
        this.bowPk = 0;
        let E = Math.min(K.slapK * pk, K.slapMax) * (0.92 + 0.16 * rng());
        if (this.bowUrge) E = Math.max(E, K.seenSlap + 0.15 + 0.6 * rng());
        if (E >= K.seenSlap && seen) this.seenT = t;
        for (let b = 0; b < 2; b++) {
          const q = this.bowPts[b];
          S.burst(t, q.x, y0, q.z, q.nx, q.nz, E * (0.92 + 0.16 * rng()), 1, K.slapW * (0.85 + 0.3 * rng()), q.fl, q.kap, b);
        }
        BT_U.uBtSlapP.value.set(this.bowPts[0].z, y0, t, 1);
        BT_U.uBtSlapS.value.set(this.bowPts[1].z, y0, t, 0.8 + 0.2 * rng());
        this.slapT = t;
        this.slapN++;
        const shows = E >= K.seenSlap;
        if (shows) this.slapSeen = t;
        this.bowCool = shows ? K.bowMin + K.bowRand * rng() : 0.5 + 0.3 * rng();
        if (shows) this.lickCool = Math.max(this.lickCool, K.afterSlap);
        this.slapThr = K.thrSlap * (0.85 + 0.3 * rng());
      } else {
        const thr = this.prThr[k] * (facing ? (starve ? urgeK : K.lickSeen) : K.lickHid);
        if (this.prPk[k] <= 0) {
          if (this.lickCool > 0 || this.prCool[k] > 0 || imp <= thr || rel < -0.12) continue;
          this.prPk[k] = imp; this.prArm[k] = t; this.prUrge[k] = facing && starve ? 1 : 0;
        }
        this.prPk[k] = Math.max(this.prPk[k], imp);
        if (imp > this.prPk[k] - 0.02 && t - this.prArm[k] < 0.45) continue;
        const pk = this.prPk[k];
        this.prPk[k] = 0;
        if (this.lickCool > 0) continue;
        let E = Math.min(K.lickK * pk, K.lickMax);
        if (this.prUrge[k]) E = Math.max(E, Math.min(K.lickMax, K.seenLick + 0.15 + 0.35 * rng() + 0.06 * Math.max(this.prFar[k], 0)));
        if (E >= K.seenLick && seen) this.seenT = t;
        const W = K.lickW * (0.8 + 0.4 * rng());
        S.burst(t, this.emX[k], y0, this.emZ[k], this.emNX[k], this.emNZ[k], E, 0, W, this.emFl[k], this.emKap[k], k + 1);
        BT_U.uBtLick.value[this.lickSlot].set(this.emZ[k], y0, t, Math.sign(this.emX[k]) * (Math.round(W * 1000) + Math.min(E, 9.99) / 10));
        this.lickSlot = (this.lickSlot + 1) % BT_U.uBtLick.value.length;
        this.lickN++;
        this.prCool[k] = K.lickCool0 + K.lickCoolR * rng();
        this.lickCool = K.gap0 + K.gapR * rng();
        this.prThr[k] = K.thrLick * (0.85 + 0.3 * rng());
      }
    }
    this.prInit = true;
    const SA = U.uSpA.value, SB = U.uSpB.value, SD = U.uSpD.value;
    for (let i = 0; i < SA.length; i++) {
      const a = SA[i];
      if (SB[i].z <= 0 || t - a.w > 4) continue;
      const v = this._pv.set(a.x, 0, a.z).applyMatrix4(U.uBoatM.value);
      a.y = SINK + clamp$9(seaH(v.x, v.z, t, fade) - v.y, -0.6, 0.6);
      const ts = t - a.w, E = SB[i].z, ta = E / 9.81, D = SD[i];
      const S = D.y < 0.5 ? BT_U.uBtSlapP.value : BT_U.uBtSlapS.value;
      if (SB[i].w > 0.5 && ts < 1 && S.z === a.w) {
        const lip = ts < ta ? E * ts - 4.905 * ts * ts : (E * E) / 19.62 - 2.2 * (ts - ta) * (ts - ta);
        S.y = Math.max(S.y, a.y + Math.max(0.2 * (D.x - a.y), 0) + Math.max(lip, 0));
      }
    }
    const fwd = p.vx * Math.sin(p.yaw) + p.vz * Math.cos(p.yaw);
    const want = clamp$9(0.2 + 0.55 * this.prImp[0] + 1.5 * Math.max(fwd, 0), 0, 1);
    this.rollS += (want - this.rollS) * (1 - Math.exp(-dt * (want > this.rollS ? 6 : 1.2)));
    const bw = Math.exp(-Math.max(0, t - this.slapT) / 2.5);
    S.dripStrength(5, bw);
    S.dripStrength(6, bw * 0.9);
  }

  _floatLine(t, cx, cz) {
    const P = this.flRope.geometry.attributes.position, pts = this.flPts;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const y = seaH(p.x, p.z, t, Math.exp(-Math.hypot(p.x - cx, p.z - cz) / 240)) - this.flSink[i];
      P.setY(2 * i, y); P.setY(2 * i + 1, y);
    }
    P.needsUpdate = true;
    for (let i = 0; i < this.corks.length; i++) {
      const c = this.corks[i], x = c.p.x, z = c.p.z, f = Math.exp(-Math.hypot(x - cx, z - cz) / 240);
      const y = seaH(x, z, t, f);
      const gx = (seaH(x + 0.2, z, t, f) - seaH(x - 0.2, z, t, f)) / 0.4, gz = (seaH(x, z + 0.2, t, f) - seaH(x, z - 0.2, t, f)) / 0.4;
      c.m.position.set(x, y + 0.03, z);
      this._fn.set(-gx, 1, -gz).normalize();
      this._fqa.setFromUnitVectors(this._fup, this._fn);
      this._fqb.setFromAxisAngle(this._fup, c.yaw);
      c.m.quaternion.multiplyQuaternions(this._fqa, this._fqb);
    }
  }

  _animate(t, dt, bg) {
    const G = typeof window !== 'undefined' && window.__ak ? window.__ak.G : null;
    const st = G ? G.state : 'title';
    this.pumpA = 2.35;
    this.needle = 2.356;
    const rT = clamp$9(-this.p.vyaw * 0.8 + 0.02 * Math.sin(t * 0.83) + 0.4 * this.p.vrol * 0.1, -0.14, 0.14);
    this.rud += (rT - this.rud) * (1 - Math.exp(-dt / 0.5));
    if (G && G.airOn && Number.isFinite(G.air)) { this.airMax = Math.max(this.airMax, G.air); this.sand = clamp$9(1 - G.air / this.airMax, 0, 1); }
    else if (st === 'title' || st === 'dive') this.sand = 0;
    BT_U.uBtAnim.value.set(this.pumpA, this.needle, this.rud, this.sand);
  }

  update(t, dt = 1 / 60, camera = null, sunDir = null, eclipse = null) {
    dt = Math.min(Math.max(dt || 0, 0), 0.1);
    const sun = sunDir || SKY_UNIFORMS.uSunDir.value;
    const ecl = eclipse === null || eclipse === undefined ? SKY_UNIFORMS.uEclipse.value : eclipse;
    const cx = camera ? camera.position.x : 0, cz = camera ? camera.position.z : 30;
    const p = this.p;

    const gust = 0.6 * Math.sin(t * 0.21) + 0.4 * Math.sin(t * 0.53 + 1.3) + 0.3 * Math.sin(t * 1.7 + 0.4) * Math.sin(t * 0.37);
    const U0 = UMEAN + 1.0 * gust;
    const dW = 0.2 * Math.sin(t * 0.031) + 0.1 * Math.sin(t * 0.083 + 2.0) + 0.06 * Math.sin(t * 0.19 + 0.7);
    const wd = this.heading + WOFF + dW;
    p.wx = -Math.sin(wd) * U0;
    p.wz = -Math.cos(wd) * U0;
    p.gust = gust;
    {
      let want = 0;
      if (this.diverLoad !== null && this.diverLoad !== undefined) want = this.diverLoad;
      else {
        const G = typeof window !== 'undefined' && window.__ak ? window.__ak.G : null;
        if (G) want = G.state === 'title' || (G.state === 'dive' && G.dive && G.dive.phase === 'stand') ? 1 : 0;
      }
      this.dLoad += (want - this.dLoad) * (1 - Math.exp(-dt / 0.12));
    }
    this.heelT = (-0.095 * ((p.wx - p.vx) * Math.cos(p.yaw) - (p.wz - p.vz) * Math.sin(p.yaw))) / UMEAN - DIVER_HEEL * this.dLoad;

    const fade = Math.exp(-Math.hypot(p.x - cx, p.z - cz) / 240);
    const cy = Math.cos(p.yaw), sy = Math.sin(p.yaw);
    for (let i = 0; i < 8; i++) {
      const lx = this.stX[i], lz = this.stZ[i];
      this.sea[i] = seaH(p.x + lx * cy + lz * sy, p.z - lx * sy + lz * cy, t, fade);
    }
    orbital(p.x + sy * this.stZ[0], p.z + cy * this.stZ[0], t, fade, this.orb, 0);
    orbital(p.x, p.z, t, fade, this.orb, 2);
    orbital(p.x + sy * this.stZ[1], p.z + cy * this.stZ[1], t, fade, this.orb, 4);
    p.acc += dt;
    let n = 0;
    while (p.acc >= HSTEP && n < 10) { this._step(HSTEP); p.acc -= HSTEP; n++; }
    if (n >= 10) p.acc = 0;
    if (!Number.isFinite(p.y + p.pit + p.rol + p.x + p.z + p.yaw)) {
      Object.assign(p, { x: LAYOUT.boat.x, z: LAYOUT.boat.z, vx: 0, vz: 0, yaw: this.heading, vyaw: 0, y: 0, vy: 0, pit: 0, vpit: 0, rol: 0, vrol: 0 });
    }
    p.pit = clamp$9(p.pit, -0.2, 0.2); p.rol = clamp$9(p.rol, -0.3, 0.3);
    p.x = clamp$9(p.x, LAYOUT.boat.x - 3, LAYOUT.boat.x + 3); p.z = clamp$9(p.z, LAYOUT.boat.z - 3, LAYOUT.boat.z + 3);
    if (Math.abs(p.yaw - this.heading) > 0.5) { p.yaw = clamp$9(p.yaw, this.heading - 0.5, this.heading + 0.5); p.vyaw = 0; }

    const bg = this.boat.group;
    bg.position.set(p.x, p.y, p.z);
    bg.rotation.set(p.pit, p.yaw, p.rol, 'YXZ');
    bg.updateMatrixWorld(true);
    this.rollerNow.copy(this.roller).applyMatrix4(bg.matrixWorld);
    ROPE_U.uRbBowDelta.value.subVectors(this.rollerNow, this.rollerRest);

    this._q.copy(bg.quaternion).invert();
    this._rp.set(0, 2.0, 0).applyMatrix4(bg.matrixWorld);
    if (dt > 1e-4) {
      if (this._rpN > 0) this._rv.subVectors(this._rp, this._rp0).divideScalar(dt);
      if (this._rpN > 1) {
        const k = 1 - Math.exp(-dt / 0.06);
        this._ra.x += (clamp$9((this._rv.x - this._rv0.x) / dt, -6, 6) - this._ra.x) * k;
        this._ra.y += (clamp$9((this._rv.y - this._rv0.y) / dt, -6, 6) - this._ra.y) * k;
        this._ra.z += (clamp$9((this._rv.z - this._rv0.z) / dt, -6, 6) - this._ra.z) * k;
      }
      this._rp0.copy(this._rp); this._rv0.copy(this._rv); this._rpN = Math.min(this._rpN + 1, 2);
    }
    this._d.set(-this._ra.x, -9.81 - this._ra.y, -this._ra.z).normalize().applyQuaternion(this._q);
    this._w.set(p.wx, 0, p.wz).applyQuaternion(this._q);
    BT_U.uBtWind.value.set(this._w.x, this._w.y, this._w.z, Math.max(0.2, Math.hypot(p.wx, p.wz) / UREF));
    {
      const tx = this._d.x + this._w.x * 0.0035, ty = this._d.y + 1, tz = this._d.z + this._w.z * 0.0035;
      const KS = 30, CS = 1.2, sw = this.sw, sv = this.swv;
      sv.x += (KS * (tx - sw.x) - CS * sv.x) * dt; sv.y += (KS * (ty - sw.y) - CS * sv.y) * dt; sv.z += (KS * (tz - sw.z) - CS * sv.z) * dt;
      sw.x += sv.x * dt; sw.y += sv.y * dt; sw.z += sv.z * dt;
      ROPE_U.uRbSway.value.copy(sw);
    }
    this.lnA.copy(this.boat.laundry.a).applyMatrix4(bg.matrixWorld);
    this.lnB.copy(this.boat.laundry.b).applyMatrix4(bg.matrixWorld);
    this.fw.set(p.wx, 0, p.wz);
    if (!camera || (camera.position.y > -5 && camera.position.distanceToSquared(this.lnA) < 90000)) {
      if (this.flagIdle > 0.3) this.laundry.ready = false;
      this.flagIdle = 0;
      this.laundry.update(dt, t, this.lnA, this.lnB, this.fw, this._sww.copy(this.sw).applyQuaternion(bg.quaternion));
    } else this.flagIdle += dt;
    this._animate(t, dt, bg);

    this.foam.position.set(p.x, 0, p.z);
    this.foam.rotation.set(0, p.yaw, 0);
    const e = clamp$9(ecl, 0, 1);
    const sunVis = Math.pow(1 - e, 0.8);
    this.foamU.uFoamLight.value = (0.22 * (1 - 0.85 * e) + 1.0 * Math.max(sun.y, 0) * sunVis) * U.uLight.value;
    this.foamU.uFoamSpark.value = 1 - e;
    const camY = camera ? camera.position.y : 2;
    const camSea = camera ? waveHeight(cx, cz, t) : 0;
    this.foamU.uFoamUnder.value = camY < camSea ? 1 : 0;
    const rb = this.anchorMat && this.anchorMat.userData.rb;
    if (rb && rb.uRbMin) rb.uRbMin.value = camY < camSea ? 0.3 : 0.72;

    this._floatLine(t, cx, cz);

    const sprayOn = !camera || (camY > camSea - 0.05 && (p.x - cx) * (p.x - cx) + (p.z - cz) * (p.z - cz) < 22500);
    this.spray.mesh.visible = sprayOn;
    if (sprayOn) this._spray(t, dt, fade, camera, clamp$9(ecl, 0, 1));

    FLAG_U.uFgDay.value = 1 - e;
    const nightT = smoothstep(0.25, 0.8, e);
    this.night += (nightT - this.night) * (1 - Math.exp(-dt * (nightT > this.night ? 1.3 : 0.55)));
    if (this.night < 1e-4) this.night = 0;
    NIGHT_U.uSgNight.value = this.night;
    this.lampW.copy(this.lamp).addScaledVector(ROPE_U.uRbSway.value, 0.25).applyMatrix4(bg.matrixWorld);
    BT_U.uBtLamp.value = this.night;
    BT_U.uBtLampW.value.copy(this.lampW);
    this.lampLight.position.copy(this.lampW);
    this.lampLight.intensity = this.night * 3.5 * (0.88 + 0.08 * Math.sin(t * 11.3) * Math.sin(t * 3.7) + 0.04 * Math.sin(t * 23.1));

    const ak = typeof window !== 'undefined' ? window.__ak : null;
    const post = ak ? ak.post : null;
    const cu = post && post.compMat ? post.compMat.uniforms : null;
    if (cu && cu.uHaze && cu.uHazeDen) {
      const hz = cu.uHaze.value, lt = U.uLight.value;
      POST_U.uSgPost.value.set(hz.x * lt, hz.y * lt, hz.z * lt, cu.uHazeDen.value);
    }

    HAZE_U.uSgSunBlend.value = sunBlend(sun);
    const beamDir = this.island.update(t, this.night);
    this.horizon.update(t, this.night, this.lampW, beamDir);
    const gullsOn = sun.y > -0.07 && camY > camSea;
    if (gullsOn && !this.gulls.mesh.visible) this.gulls.snap = true;
    this.gulls.update(t, dt, Math.exp(-Math.hypot(this.gulls.floatAt.x - cx, this.gulls.floatAt.z - cz) / 240), camera);
    this._lcx = cx; this._lcz = cz;
    this.leaps.update(t, dt, camera, sun, camY - camSea);
    this.flare.update(dt, sun, ecl, camY - Math.max(camSea, 0));
    this.flare.mesh.visible = camY > camSea + 0.02;
    this.gulls.mesh.visible = gullsOn;
  }
}

