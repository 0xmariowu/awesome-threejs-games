// fx.js
const TAU$5 = Math.PI * 2;

const TORCH = {
  uTorchPos: { value: new THREE.Vector3(0, -100, 0) },
  uTorchDir: { value: new THREE.Vector3(0, -1, 0) },
  uTorchK: { value: 0 },
  uTorchCos: { value: 0.86 },
};

const LIGHT = {
  uSunCol: { value: new THREE.Vector3(2.43, 2.7, 2.7) },
  uSkyCol: { value: new THREE.Vector3(0.08, 0.24, 0.38) },
  uSunDir: { value: new THREE.Vector3(0, 1, 0) },
  uPx: { value: 624 },
  uFxRes: { value: new THREE.Vector2(2, 2) },
  uProjZ: { value: new THREE.Vector2(-1, -0.1) },
  uWarmNear: U.uWarmNear,
};
const DOFU = { uDof: { value: new THREE.Vector3(4, 0, 16) }, uDofK: { value: new THREE.Vector3(16, 1, 16) } };
const FOG = Object.assign({ uTime: U.uTime, uLight: U.uLight, uSunW: U.uSunW, uWaterY: U.uWaterY }, WATER);
const FXCAM = { pos: new THREE.Vector3(0, -5, 0), fwd: new THREE.Vector3(0, 0, -1) };
const _v2 = new THREE.Vector2();
function fxBeforeRender(renderer, scene, camera) {
  const rt = renderer.getRenderTarget();
  if (rt) LIGHT.uFxRes.value.set(rt.width, rt.height);
  else LIGHT.uFxRes.value.copy(renderer.getDrawingBufferSize(_v2));
  const pe = camera.projectionMatrix.elements;
  LIGHT.uPx.value = 0.5 * LIGHT.uFxRes.value.y * pe[5];
  LIGHT.uProjZ.value.set(pe[10], pe[14]);
  const e = camera.matrixWorld.elements;
  FXCAM.pos.set(e[12], e[13], e[14]);
  FXCAM.fwd.set(-e[8], -e[9], -e[10]);
}

const SIZE_K = '1.44';

const TORCH_GLSL = `
uniform vec3 uTorchPos;
uniform vec3 uTorchDir;
uniform float uTorchK;
uniform float uTorchCos;
float torchAt(vec3 wp) {
  vec3 L = wp - uTorchPos;
  float dl = max(length(L), 1e-3);
  float cone = smoothstep(uTorchCos, mix(uTorchCos, 1.0, 0.6), dot(L / dl, uTorchDir));
  return uTorchK * cone / (0.3 + dl * dl);
}
`;

const FX_GLSL = `
uniform vec3 uSunCol;
uniform vec3 uSkyCol;
uniform vec3 uSunDir;
vec3 fxLight(vec3 wp, float fwd) {
  vec3 V = normalize(wp - cameraPosition);
  float f = pow(max(dot(V, uSunDir), 0.0), 3.0);
  return uSunCol * (0.2 + fwd * f) + uSkyCol * 0.9;
}
uniform float uWarmNear;
vec3 fxSand(vec3 wp) {
  float near = (1.0 - smoothstep(2.5, 9.0, distance(wp, cameraPosition))) * uWarmNear;
  return (uSunCol * (0.3 + 0.55 * clamp(uSunDir.y, 0.0, 1.0)) + uSkyCol * 1.1) * mix(vec3(1.0), vec3(1.22, 0.98, 0.9), near);
}
`;

const FXV_GLSL = `
uniform float uTime;
uniform float uLight;
uniform vec3 uSunW;
uniform float uWaterY;
uniform float uCamRel;
uniform float uLensR;
uniform float uInAir;
${WAVES_GLSL}
${WAVE_SURF_GLSL}
${WATER_GLSL}
${WL_GLSL}
varying vec3 vT;
varying vec3 vLin;
varying float vZ;
float fxFog(vec3 wp, float inAir) {
  vec3 v = wp - cameraPosition;
  float dm = max(length(v), 1.0e-4);
  vec3 V = v / dm;
  float lensAir = step(0.0, uCamRel);
  if (abs(uCamRel) < 0.8) {
    vec3 np = cameraPosition + V * uLensR;
    float rag = 0.0;
    if (uLensR < 0.1) {
      vec4 cp = projectionMatrix * viewMatrix * vec4(wp, 1.0);
      rag = wlRag((cp.x / max(cp.w, 1e-4) * 0.5 + 0.5) * projectionMatrix[1][1] / projectionMatrix[0][0], uTime) * uLensR;
    }
    lensAir = step(uWaterY + waveSurfAt(np.xz, uTime), np.y + rag);
  }
  vT = vec3(1.0);
  vLin = vec3(0.0);
  if (inAir < 0.5) {
    vT = exp(-uAbs * dm);
    vLin = waterScatter(V, dm, max(-uCamRel, 0.0));
  }
  return 1.0 - abs(lensAir - inAir);
}
`;

const FXF_GLSL = `
uniform sampler2D tSceneDepth;
uniform vec2 uFxRes;
uniform vec2 uProjZ;
varying vec3 vT;
varying vec3 vLin;
varying float vZ;
float fxSoft(float soft, float bias) {
  float d = texture2D(tSceneDepth, gl_FragCoord.xy / uFxRes).x;
  if (d >= 0.99999) return 1.0;
  float sz = uProjZ.y / (2.0 * d - 1.0 + uProjZ.x);
  return clamp((sz - vZ + bias) / soft, 0.0, 1.0);
}
`;

class Pool {
  constructor(scene, max, { vert, frag, blending = THREE.AdditiveBlending, order = 6, uniforms = {},
    dynSize = false, dynSeed = false, velAttr = false, maxPx = 160, near = 0.05, inAir = false }) {
    this.max = max;
    this.keep = 1;
    this.pos = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max).fill(1);
    this.size = new Float32Array(max);
    this.seed = new Float32Array(max);
    this.col = new Float32Array(max * 3);
    this.ground = new Float32Array(max).fill(-1e9);
    this.rest = new Uint8Array(max);
    this.head = 0;
    this.tail = 0;
    this.span = 0;
    this.newAt = 0;
    this.newN = 0;
    this.alive = 0;
    this.seen = false;
    const g = (this.geo = new THREE.BufferGeometry());
    this.dyn = [];
    this.stat = [];
    const mk = (arr, n, name, dyn) => {
      const a = new THREE.BufferAttribute(arr, n).setUsage(THREE.DynamicDrawUsage);
      g.setAttribute(name, a);
      (dyn ? this.dyn : this.stat).push({ a, n, r0: { start: 0, count: 0 }, r1: { start: 0, count: 0 } });
      return a;
    };
    this.aPos = mk(this.pos, 3, 'position', true);
    this.aLife = mk(new Float32Array(max), 1, 'aLife', true);
    mk(this.size, 1, 'aSize', dynSize);
    mk(this.seed, 1, 'aSeed', dynSeed);
    mk(this.col, 3, 'aCol', false);
    mk(this.ground, 1, 'aGround', false);
    if (velAttr) mk(this.vel, 3, 'aVel', true);
    g.setDrawRange(0, 0);
    this.mat = new THREE.ShaderMaterial({
      uniforms: Object.assign({ uMaxPx: { value: maxPx }, uNear: { value: near }, uInAir: { value: inAir ? 1 : 0 } }, FOG, TORCH, LIGHT, uniforms),
      vertexShader: vert, fragmentShader: frag,
      transparent: true, depthWrite: false, depthTest: false, blending,
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = order;
    this.points.onBeforeRender = (r, s, c) => { this.seen = true; fxBeforeRender(r, s, c); };
    FX_SCENE.add(this.points);
  }

  spawn(x, y, z, vx, vy, vz, life, size, r = 1, g = 1, b = 1, ground = -1e9) {
    if (this.keep < 1 && Math.random() > this.keep) return -1;
    const i = this.head, n = this.max;
    this.head = i + 1 === n ? 0 : i + 1;
    if (this.span < n) this.span++;
    else this.tail = this.head;
    if (this.newN === 0) this.newAt = i;
    if (this.newN < n) this.newN++;
    const i3 = i * 3;
    this.pos[i3] = x; this.pos[i3 + 1] = y; this.pos[i3 + 2] = z;
    this.vel[i3] = vx; this.vel[i3 + 1] = vy; this.vel[i3 + 2] = vz;
    this.life[i] = life; this.maxLife[i] = life; this.size[i] = size;
    this.seed[i] = Math.random();
    this.col[i3] = r; this.col[i3 + 1] = g; this.col[i3 + 2] = b;
    this.ground[i] = ground;
    this.rest[i] = 0;
    return i;
  }

  step(dt, fn) {
    const n = this.max, span = this.span;
    if (span === 0 && this.newN === 0) return;
    const L = this.aLife.array, life = this.life, maxLife = this.maxLife, P = this.pos, V = this.vel;
    let i = this.tail, alive = 0;
    for (let k = 0; k < span; k++) {
      if (life[i] > 0) {
        life[i] -= dt;
        if (fn !== null) fn(i, dt);
        const i3 = i * 3;
        P[i3] += V[i3] * dt;
        P[i3 + 1] += V[i3 + 1] * dt;
        P[i3 + 2] += V[i3 + 2] * dt;
        const l = life[i] / maxLife[i];
        if (l > 0) { L[i] = l; alive++; } else L[i] = 0;
      } else L[i] = 0;
      i = i + 1 === n ? 0 : i + 1;
    }
    this.alive = alive;
    for (let k = 0; k < this.dyn.length; k++) upload(this.dyn[k], this.tail, span, n);
    if (this.newN > 0) {
      for (let k = 0; k < this.stat.length; k++) upload(this.stat[k], this.newAt, this.newN, n);
      this.newN = 0;
    }
    while (this.span > 0 && life[this.tail] <= 0) { this.tail = this.tail + 1 === n ? 0 : this.tail + 1; this.span--; }
    if (this.span === 0) this.geo.setDrawRange(0, 0);
    else if (this.tail + this.span <= n) this.geo.setDrawRange(this.tail, this.span);
    else this.geo.setDrawRange(0, n);
    this.mat.visible = !this.seen || this.span > 0;
  }
}

function upload(u, start, count, max) {
  const a = u.a, R = a.updateRanges;
  a.needsUpdate = true;
  if (R.length) { R.length = 0; return; }
  if (count >= max || count <= 0) return;
  const k = u.n;
  if (start + count <= max) {
    u.r0.start = start * k; u.r0.count = count * k;
    R.push(u.r0);
  } else {
    u.r0.start = start * k; u.r0.count = (max - start) * k;
    u.r1.start = 0; u.r1.count = (start + count - max) * k;
    R.push(u.r0, u.r1);
  }
}

const VERT$1 = `
uniform float uPx;
uniform float uMaxPx;
uniform float uNear;
uniform float uVeil;
attribute float aLife;
attribute float aSize;
attribute float aSeed;
attribute vec3 aCol;
varying float vLife;
varying float vSeed;
varying vec3 vCol;
varying float vTorch;
varying vec3 vW;
varying float vPx;
varying float vFade;
${TORCH_GLSL}
${FXV_GLSL}
void main() {
  vLife = aLife; vSeed = aSeed; vCol = aCol; vW = position;
  vTorch = torchAt(position);
  float vis = fxFog(position, uInAir);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  float z = max(-mv.z, 0.05);
  vZ = z;
  float px = aSize * ${SIZE_K} * uPx / z;
  vPx = clamp(px, 1.0, uMaxPx);
  vFade = min(1.0, px * px) * smoothstep(uNear * 0.45, uNear, z);
  if (uVeil > 0.5 && floor(aSeed) == 2.0) { vPx = max(vPx, 1.6); vFade = max(vFade, 0.35 * smoothstep(uNear * 0.45, uNear, z)); }
  gl_PointSize = aLife > 0.0 && vFade > 0.002 && vis > 0.5 ? vPx : 0.0;
  gl_Position = projectionMatrix * mv;
}
`;

const GRAIN_VERT = `
uniform float uPx;
uniform float uMaxPx;
uniform float uNear;
attribute float aLife;
attribute float aSize;
attribute float aSeed;
attribute vec3 aCol;
attribute vec3 aVel;
varying float vLife;
varying float vSeed;
varying vec3 vCol;
varying float vTorch;
varying vec3 vW;
varying float vFade;
varying vec2 vDir;
varying float vLen;
${TORCH_GLSL}
${FXV_GLSL}
void main() {
  vLife = aLife; vSeed = aSeed; vCol = aCol; vW = position;
  vTorch = torchAt(position);
  float vis = fxFog(position, uInAir);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  float z = max(-mv.z, 0.05);
  vZ = z;
  float px = aSize * ${SIZE_K} * uPx / z, w = clamp(px, 1.0, uMaxPx);
  vFade = min(1.0, px * px) * smoothstep(uNear * 0.45, uNear, z);
  float Ls = 0.0;
  vDir = vec2(0.0, 1.0);
  if (floor(aSeed) >= 2.0) {
    float run = floor(aSeed) == 3.0 ? 1.0 : 0.0;
    vec4 mv2 = modelViewMatrix * vec4(position - aVel * mix(0.012, 0.01, run), 1.0);
    vec2 d = (mv.xy / z - mv2.xy / max(-mv2.z, 0.05)) * uPx;
    Ls = min(length(d), mix(3.0, 4.0, run));
    if (Ls > 0.01) vDir = normalize(vec2(d.x, -d.y));
    vFade *= mix(1.0, w / (w + Ls), 0.3);
  }
  vLen = Ls / (w + Ls);
  gl_PointSize = aLife > 0.0 && vFade > 0.002 && vis > 0.5 ? w + Ls : 0.0;
  gl_Position = projectionMatrix * mv;
}
`;

const SILT_VERT = `
uniform float uPx;
uniform float uAdapt;
uniform sampler2D tSceneColor;
uniform sampler2D tSceneDepth;
uniform vec2 uFxRes;
uniform vec2 uProjZ;
attribute float aLife;
attribute float aSize;
attribute float aSeed;
attribute vec3 aCol;
attribute float aGround;
varying float vLife;
varying float vSeed;
varying vec3 vAlb;
varying vec3 vLit;
varying float vTorch;
varying vec3 vC;
varying float vR;
varying vec3 vRt;
varying vec3 vUp;
varying float vGround;
varying float vThin;
varying vec3 vKick;
${TORCH_GLSL}
${FX_GLSL}
${FXV_GLSL}
void main() {
  vLife = aLife; vSeed = aSeed; vAlb = aCol;
  vGround = aGround;
  vTorch = torchAt(position);
  float kind = floor(aSeed);
  float vis = fxFog(position, kind == 1.0 ? 1.0 : 0.0);
  vLit = fxLight(position, kind == 2.0 ? 1.2 : 0.5) * (kind == 2.0 ? 1.4 : 1.0);
  if (kind > 3.5) vLit = fxSand(position) * (kind == 6.0 ? 0.42 : kind == 5.0 ? 0.6 : 1.0);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  float z = max(-mv.z, 0.05);
  vZ = z;
  float age = 1.0 - aLife;
  float room = aGround > -1.0e8 ? clamp((position.y - aGround) / 0.2, 0.35, 1.0) : 1.0;
  float wispK = kind == 3.0 ? 1.0 : 0.0, billK = kind == 4.0 ? 1.0 : 0.0, fallK = kind == 5.0 ? 1.0 : 0.0, cloudK = kind == 6.0 ? 1.0 : 0.0;
  float grow = 1.0 + min(age * mix(1.7, 1.2, wispK), 1.0) * mix(room, 1.0, cloudK) * mix(1.0, 0.5, wispK);
  grow += (billK * 0.45 + fallK * 1.0 + cloudK * 0.3) * (1.0 - (1.0 - age) * (1.0 - age)) * mix(room, 1.0, cloudK);
  vThin = 1.0 / pow(grow, mix(mix(2.0, 1.2, max(billK, fallK)), 0.75, cloudK));
  float D = aSize * grow * ${SIZE_K};
  float px = D * uPx / z;
  vThin *= mix(mix(smoothstep(0.12, 0.45, z), smoothstep(0.45, 0.8, z), billK), smoothstep(0.5, 0.9, z), cloudK);
  float pc = clamp(px, 1.0, mix(mix(220.0, 70.0, billK), 120.0, cloudK));
  vR = 0.5 * D * pc / max(px, 1.0e-3);
  vC = position;
  vRt = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vUp = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  if (kind == 7.0) {
    float dm = distance(position, cameraPosition), kg = 1.0 + 0.7 * age, km = 1.05 * min(dm / z, 2.0);
    px = aSize * ${SIZE_K} * kg * km * uPx / z;
    pc = clamp(px, 1.0, 220.0);
    vR = 0.5 * aSize * ${SIZE_K} * kg * km * pc / px;
    vKick = vec3(vR / km, min(0.5 * vR / km, 0.035 * kg) * (1.0 - 0.2 * age), 2.0 / (kg * kg) * smoothstep(0.15, 0.5, z));
    vec4 gc = projectionMatrix * viewMatrix * vec4(position.x, aGround, position.z, 1.0);
    vec2 g0 = gc.xy / gc.w * 0.5 + 0.5, o = vec2(0.5, 0.25) * pc / uFxRes;
    vec3 bed = vec3(0.0), fw = -vec3(viewMatrix[0][2], viewMatrix[1][2], viewMatrix[2][2]);
    float bw = 0.0, by = 0.0;
    for (int k = 0; k < 5; k++) {
      vec2 uv = g0 + o * vec2(k == 1 ? 1.0 : k == 2 ? -1.0 : 0.0, k == 3 ? 1.0 : k == 4 ? -1.0 : 0.0), nd = uv * 2.0 - 1.0;
      float sz = uProjZ.y / (2.0 * texture2D(tSceneDepth, uv).x - 1.0 + uProjZ.x), w = step(abs(sz - gc.w), 0.1 + 0.03 * gc.w);
      bed += texture2D(tSceneColor, uv).rgb * w; bw += w;
      by += (cameraPosition.y + (vRt.y * nd.x / projectionMatrix[0][0] + vUp.y * nd.y / projectionMatrix[1][1] + fw.y) * sz) * w;
    }
    vGround = bw > 0.5 ? by / bw : aGround;
    float dw = max(uWaterY - position.y, 0.0);
    vec3 dn = exp(-vec3(0.11, 0.033, 0.026) * dw);
    dn = mix(dn, vec3(dot(dn, vec3(0.2126, 0.7152, 0.0722))), uAdapt);
    vLit = bw > 0.5 ? bed / bw : aCol * (uSunCol * dn * (0.1 + 0.17 * clamp(uSunDir.y, 0.0, 1.0)) + uSkyCol * 0.14)
      * mix(vec3(1.0), vec3(1.22, 0.98, 0.9), (1.0 - smoothstep(2.5, 9.0, dm)) * clamp((1.0 - exp(-0.077 * dw)) / 0.7, 0.0, 1.0));
    vT = exp(-waterTau(dm));
    vTorch = 0.0;
  }
  gl_PointSize = aLife > 0.0 && vis > 0.5 ? pc : 0.0;
  gl_Position = projectionMatrix * mv;
}
`;

const SILT_FRAG = `
uniform sampler2D uPuff;
uniform float uTime;
varying float vLife;
varying float vSeed;
varying vec3 vAlb;
varying vec3 vLit;
varying float vTorch;
varying vec3 vC;
varying float vR;
varying vec3 vRt;
varying vec3 vUp;
varying float vGround;
varying float vThin;
varying vec3 vKick;
uniform sampler2D tSceneColor;
${FXF_GLSL}
void main() {
  vec2 p = gl_PointCoord - 0.5;
  float sd = fract(vSeed);
  float kind = floor(vSeed);
  float mist = kind == 1.0 ? 1.0 : 0.0;
  float air = kind == 2.0 ? 1.0 : 0.0;
  float fall = kind == 5.0 ? 1.0 : 0.0, cloud = kind == 6.0 ? 1.0 : 0.0;
  vec2 pe = p * vec2(1.0 + fall * 0.35 * vLife, 1.0 + 0.7 * cloud);
  float ang = sd * 6.2831853 + (1.0 - vLife) * (sd - 0.5) * 2.4;
  float cs = cos(ang), sn = sin(ang);
  vec2 pr = mix(pe, p, cloud);
  vec2 q = vec2(cs * pr.x - sn * pr.y, sn * pr.x + cs * pr.y);
  float wisp = kind == 3.0 ? 1.0 : 0.0;
  q.y *= 1.0 + 0.9 * wisp;
  if (dot(q, q) > 0.25) discard;
  vec2 cell = floor(fract(vec2(sd * 7.0, sd * 13.0)) * 2.0) * 0.5;
  float puff = texture2D(uPuff, cell + (q + 0.5) * 0.5).r;
  float soft = 1.0;
  if (vGround > -1.0e8) {
    vec3 wp = vC + (vRt * p.x - vUp * p.y) * (2.0 * vR);
    vec3 rd = normalize(wp - cameraPosition);
    soft = smoothstep(0.0, mix(0.09, 0.03, cloud), (wp.y - vGround) / max(-rd.y, 0.12));
  }
  float fade = smoothstep(0.0, 0.35, vLife) * mix(smoothstep(1.0, 0.88, vLife), smoothstep(1.0, 0.94, vLife), max(mist, air));
  if (kind == 7.0) {
    vec3 wk = vC + (vRt * p.x - vUp * p.y) * (2.0 * vR), rw = normalize(wk - cameraPosition);
    vec3 ks = vec3(1.0 / vKick.x, 1.0 / vKick.y, 1.0 / vKick.x), ko = (cameraPosition - vC) * ks, kd = rw * ks;
    float qa = dot(kd, kd), qb = dot(ko, kd), qc = dot(ko, ko) - 1.0, qd = qb * qb - qa * qc;
    if (qd <= 0.0) discard;
    qd = sqrt(qd);
    float db = texture2D(tSceneDepth, gl_FragCoord.xy / uFxRes).x;
    float t0 = max((-qb - qd) / qa, 0.0), ts = db < 0.99999 ? uProjZ.y / (2.0 * db - 1.0 + uProjZ.x) / dot(rw, cross(vUp, vRt)) : 1.0e4;
    float t1 = min((-qb + qd) / qa, ts);
    if (t1 <= t0) discard;
    float tau = 0.75 / vKick.y * ((qa * t0 * t0 / 3.0 + qb * t0 + qc) * t0 - (qa * t1 * t1 / 3.0 + qb * t1 + qc) * t1);
    vec3 km = ko + kd * (0.5 * (t0 + t1));
    vec2 kq = vec2(cs * km.x - sn * km.z, sn * km.x + cs * km.z);
    tau *= smoothstep(0.05, 0.75, texture2D(uPuff, cell + (kq * 0.5 + 0.5) * 0.5).r) * 1.4;
    float ka = 0.25 * (1.0 - exp(-vKick.z * tau)) * smoothstep(1.0, 0.94, vLife) * smoothstep(0.0, 0.5, vLife);
    float tb = rw.y < -0.001 ? (vGround - cameraPosition.y) / rw.y : 1.0e4;
    ka *= 1.0 - 0.9 * smoothstep(0.12, 0.5, (tb - ts) * max(-rw.y, 0.02) / vKick.y);
    const vec3 LW = vec3(0.2126, 0.7152, 0.0722);
    ka *= mix(0.12, 1.0, smoothstep(0.12, 0.35, dot(texture2D(tSceneColor, gl_FragCoord.xy / uFxRes).rgb, LW) / max(dot(vLit, LW), 1.0e-4)));
    gl_FragColor = vec4(vLit * (1.25 + 0.45 * clamp(0.5 + 0.5 * km.y, 0.0, 1.0)) * vT + vLin, ka);
    return;
  }
  float fz = 0.0;
  if (air > 0.5) {
    vec2 fg = (q + 0.5) * 24.0, fq = floor(fg);
    fz = step(0.88, fract(sin(dot(fq, vec2(12.9898, 78.233)) + floor(uTime * 14.0) * 0.371 + sd * 91.0) * 43758.5453))
       * (1.0 - smoothstep(0.18, 0.4, length(fract(fg) - 0.5)));
  }
  float bill = kind == 4.0 ? 1.0 : 0.0;
  if (bill > 0.5) puff = smoothstep(0.3, 1.0, puff) * smoothstep(0.5, 0.1, length(q));
  if (cloud > 0.5) puff = smoothstep(0.42, 1.0, puff) * smoothstep(0.5, 0.12, length(pe));
  if (fall > 0.5) {
    puff = smoothstep(0.4, 1.0, puff) * smoothstep(0.5, 0.1, length(pe));
    const vec3 LW5 = vec3(0.2126, 0.7152, 0.0722);
    puff *= mix(0.3, 1.0, smoothstep(0.15, 0.45, dot(texture2D(tSceneColor, gl_FragCoord.xy / uFxRes).rgb, LW5) / max(dot(vLit, LW5), 1.0e-4)));
  }
  float a = puff * fade * vThin * soft * (mist > 0.5 ? 0.1 : air > 0.5 ? 0.3 : wisp > 0.5 ? 0.3 : bill > 0.5 ? 0.38 : cloud > 0.5 ? 0.2 : fall > 0.5 ? 0.24 : 0.42) * fxSoft(air > 0.5 ? 0.3 : 0.08, 0.02);
  float shade = 0.86 + 0.28 * (0.5 - gl_PointCoord.y);
  vec3 c = vAlb * (vLit * shade * (1.0 + fz * 0.9 * air) + vec3(vTorch * mix(0.22, 0.05, max(cloud, fall))));
  c = mix(c, dot(c, vec3(0.3, 0.55, 0.15)) * vec3(1.08, 1.0, 0.86), max(0.7 * cloud, 0.8 * fall));
  gl_FragColor = vec4(c * vT + vLin, clamp(a, 0.0, 1.0));
}
`;

const BUBBLE_FRAG = `
uniform float uTime;
varying float vLife;
varying float vSeed;
varying float vTorch;
varying float vPx;
varying float vFade;
${FX_GLSL}
${FXF_GLSL}
void main() {
  vec2 p = gl_PointCoord * 2.0 - 1.0;
  p.y = -p.y;
  float sd = fract(vSeed), kind = floor(vSeed);
  vec2 q = p;
  if (kind == 1.0) {
    float ang = atan(p.y, p.x);
    float wob = 0.07 * sin(ang * 3.0 + uTime * (7.0 + 4.0 * sd) + sd * 40.0) + 0.05 * sin(ang * 5.0 - uTime * 9.0 + sd * 17.0);
    q = vec2(p.x, (p.y - 0.14) / 0.52) * (1.0 + wob);
    float skirt = -0.32 - 0.12 * p.x * p.x + 0.05 * sin(p.x * 9.0 + uTime * 11.0 + sd * 30.0);
    if (p.y < skirt) discard;
  }
  float d = length(q);
  if (d > 1.0) discard;
  float aa = clamp((1.0 - d) * vPx * 0.5, 0.0, 1.0);
  vec3 Ld = uSunCol * 0.32 + uSkyCol * 1.5 + vec3(vTorch * 0.6);
  vec3 silver = mix(vec3(dot(Ld, vec3(0.3, 0.5, 0.2))), Ld, 0.3);
  float up = q.y / max(d, 1.0e-3);
  float tir = smoothstep(0.6, 0.84, d), edge = smoothstep(0.88, 1.0, d);
  float ring = tir * (0.28 + 0.9 * pow(clamp(0.5 + 0.5 * up, 0.0, 1.0), 1.5)) * (1.0 - 0.55 * edge);
  float capK = kind == 1.0 ? 1.0 : 0.0;
  vec3 col = mix(silver * mix(0.5, 0.32, capK), silver * ring, tir);
  float a = mix(mix(0.12, 0.16, capK), (0.5 + 0.42 * (0.5 + 0.5 * up)) * (1.0 - 0.25 * edge), tir);
  vec2 g = q - vec2(-0.3, 0.46);
  float glint = exp(-dot(g, g) * 34.0);
  col += Ld * glint * 1.3;
  a = max(a, 0.85 * glint);
  float tiny = 1.0 - smoothstep(2.5, 7.0, vPx);
  col = mix(col, silver * 0.95, tiny);
  a = mix(a, 0.9 * (1.0 - d * d), tiny);
  if (kind == 2.0) {
    float tw = step(0.7, fract(sin(sd * 91.7 + floor(uTime * 12.0 + sd * 7.0) * 1.37) * 43758.5453));
    col = silver * (0.7 + 0.8 * tw);
    a = (0.28 + 0.55 * tw) * (1.0 - d * d);
  }
  a *= aa * smoothstep(0.0, 0.08, vLife) * vFade * fxSoft(0.04, 0.0);
  gl_FragColor = vec4(col * vT + vLin, clamp(a, 0.0, 1.0));
}
`;

const SPARK_FRAG$1 = `
varying float vLife;
varying vec3 vCol;
varying float vFade;
${FXF_GLSL}
void main() {
  vec2 p = gl_PointCoord * 2.0 - 1.0;
  float d = dot(p, p);
  if (d > 1.0) discard;
  float a = exp(-d * 6.0) * (1.0 - d) * vLife * vFade * fxSoft(0.05, 0.01);
  gl_FragColor = vec4(vCol * vT * 1.7, a);
}
`;

const FLAKE_FRAG = `
varying float vLife;
varying float vSeed;
varying vec3 vCol;
varying float vTorch;
varying vec3 vW;
varying float vFade;
${FX_GLSL}
${FXF_GLSL}
void main() {
  vec2 p = gl_PointCoord * 2.0 - 1.0;
  float id = fract(sin(dot(vCol, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
  float ta = vSeed * 2.4 + id * 6.2831;
  float ang = id * 6.2831 + vSeed * 0.5;
  vec2 q = mat2(cos(ang), -sin(ang), sin(ang), cos(ang)) * p;
  float face = abs(cos(ta));
  q.y /= max(face, 0.14);
  float qa = atan(q.y, q.x);
  float edge = 0.78 + 0.16 * sin(qa * 3.0 + id * 29.0) * sin(qa * 5.0 - id * 11.0) + 0.06 * sin(qa * 11.0 + id * 7.0);
  float d = length(q);
  if (d > edge) discard;
  float rim = smoothstep(edge - 0.3, edge - 0.05, d);
  vec3 base = mix(vCol, vCol * 0.7 + vec3(0.2, 0.19, 0.17), rim * 0.5);
  float flash = pow(abs(sin(ta + 0.7)), 18.0);
  vec3 c = base * (0.4 + 0.6 * face) * (fxLight(vW, 0.3) + vec3(vTorch * 0.35)) * (1.0 + flash * 1.0);
  float a = smoothstep(0.0, 0.2, vLife) * vFade * (1.0 - smoothstep(edge - 0.08, edge, d) * 0.6);
  gl_FragColor = vec4(c * vT + vLin, a * fxSoft(0.03, 0.012));
}
`;

const GRAIN_FRAG = `
uniform float uTime;
varying float vLife;
varying float vSeed;
varying vec3 vCol;
varying float vTorch;
varying vec3 vW;
varying float vFade;
varying vec2 vDir;
varying float vLen;
${FX_GLSL}
${FXF_GLSL}
void main() {
  vec2 p = gl_PointCoord - 0.5;
  float hl = 0.5 * vLen, s = clamp(dot(p, vDir), -hl, hl);
  vec2 e = (p - vDir * s) / max(0.5 * (1.0 - vLen), 1.0e-3);
  float d = dot(e, e);
  if (d > 1.0) discard;
  float kind = floor(vSeed), mote = kind == 1.0 ? 1.0 : 0.0, sed = kind >= 2.0 ? 1.0 : 0.0, run = kind == 3.0 ? 1.0 : 0.0;
  float sd = fract(vSeed);
  float tw = pow(abs(sin(sd * 91.0 + uTime * (4.0 + sd * 7.0))), 40.0) * step(0.85, fract(sd * 5.3));
  float brush = kind == 2.0 ? 1.0 : 0.0;
  float glint = mix(tw * (0.6 + vTorch * 1.2), tw * min(vTorch, 1.5) * 2.2, mote) * (1.0 - sed) + tw * 1.4 * brush;
  vec3 c = vCol * (mix(fxLight(vW, 0.5), fxSand(vW) * mix(mix(0.5, 0.72, brush), 0.34, run), sed) + vec3(vTorch * mix(0.6, mix(0.08, 0.04, run), sed))) * (mix(1.0, 0.4, mote) + glint);
  float a = smoothstep(1.0, 0.35, d) * smoothstep(0.0, 0.12, vLife) * vFade * mix(1.0, 0.55, mote) * mix(1.0, 0.9, run) * fxSoft(0.02, 0.01);
  gl_FragColor = vec4(c * vT + vLin, a);
}
`;

const GLOW_FRAG = `
varying float vLife;
varying float vFade;
${FXF_GLSL}
void main() {
  vec2 p = gl_PointCoord * 2.0 - 1.0;
  float d = dot(p, p);
  if (d > 1.0) discard;
  float a = exp(-d * 6.0) * sin(vLife * 3.14159) * vFade * fxSoft(0.05, 0.01);
  gl_FragColor = vec4(vec3(0.15, 0.75, 1.0) * vT * a * 1.3, a);
}
`;

const SPRAY_VERT = `
uniform float uPx;
uniform vec3 uDof;
uniform vec3 uDofK;
attribute float aLife;
attribute float aSize;
attribute float aSeed;
attribute vec3 aCol;
attribute vec3 aVel;
varying float vLife;
varying vec3 vCol;
varying vec3 vW;
varying vec2 vDir;
varying float vLen;
varying float vK;
varying float vG;
${FXV_GLSL}
void main() {
  vLife = aLife; vCol = aCol; vW = position;
  float vis = fxFog(position, uInAir);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vec4 mv2 = modelViewMatrix * vec4(position + aVel * 0.0083, 1.0);
  float z = max(-mv.z, 0.05), z2 = max(-mv2.z, 0.05);
  vZ = z;
  vec2 d = (mv2.xy / z2 - mv.xy / z) * uPx;
  float diam = aSize * ${SIZE_K} * uPx / z;
  float rc = (z - uDof.x) / z * uDof.y;
  float coc = rc < 0.0 ? min(-rc * uDof.z, uDofK.x) : min(rc * uDof.z * uDofK.y, uDofK.z);
  float w0 = max(diam, 1.2), w = w0 + coc;
  float L = min(length(d), 64.0);
  float S = w + L;
  vDir = L > 0.01 ? normalize(vec2(d.x, -d.y)) : vec2(0.0, 1.0);
  vLen = L / S;
  vK = min(1.0, diam / 1.2) * mix(1.0, w / S, 0.85) * (w0 * w0) / (w * w) * smoothstep(0.2, 0.7, z);
  vG = 0.5 + 0.5 * (w0 * w0) / (w * w);
  gl_PointSize = aLife > 0.0 && vis > 0.5 ? S : 0.0;
  gl_Position = projectionMatrix * mv;
}
`;
const SPRAY_FRAG = `
varying float vLife;
varying vec3 vCol;
varying vec3 vW;
varying vec2 vDir;
varying float vLen;
varying float vK;
varying float vG;
${FX_GLSL}
${FXF_GLSL}
void main() {
  vec2 p = gl_PointCoord - 0.5;
  float hl = 0.5 * vLen;
  float s = clamp(dot(p, vDir), -hl, hl);
  float r = max(0.5 * (1.0 - vLen), 1.0e-3);
  float d = length(p - vDir * s) / r;
  if (d > 1.0) discard;
  float fade = smoothstep(0.0, 0.05, vLife) * fxSoft(0.05, 0.0);
  float lead = vLen > 0.05 ? smoothstep(-0.3, 0.9, s / max(hl, 1.0e-4)) : 1.0;
  float a = (1.0 - smoothstep(0.4, 1.0, d)) * vK * fade * mix(0.45, 1.0, lead);
  vec3 V = normalize(vW - cameraPosition);
  float cb = dot(V, uSunDir);
  vec3 body = vCol * mix(0.3 * uSkyCol * vec3(0.6, 0.8, 0.85), mix(0.5 * uSkyCol * vec3(0.72, 0.9, 0.92), 1.1 * uSkyCol, lead), smoothstep(-0.3, 0.3, p.y));
  float gl = (1.0 - smoothstep(0.0, 0.45, d)) * fade * min(1.0, 3.0 * sqrt(vK)) * mix(0.2, 1.0, lead * lead);
  float fwd = smoothstep(0.1, 0.95, cb);
  vec3 ab = (acos(clamp(-cb, -1.0, 1.0)) - vec3(0.738, 0.724, 0.708)) / 0.012;
  vec3 bow = exp(-ab * ab);
  vec3 pt = uSunCol * ((0.9 + 2.4 * fwd * fwd + 3.0 * pow(max(cb, 0.0), 8.0)) * vec3(1.0) + 2.5 * bow) * gl * (2.0 * vG - 1.0);
  pt *= min(1.0, 2.5 / max(dot(pt, vec3(0.2126, 0.7152, 0.0722)), 1.0e-4));
  gl_FragColor = vec4((body * a + pt) * vT + vLin * a, a);
}
`;

const CROWN_GLSL = `
uniform vec4 uCrown;
uniform float uSeed;
uniform vec4 uLop;
uniform vec2 uFace;
float crownJet(float a) {
  float lo = 0.83 + 0.05 * sin(a + 0.4 + uSeed * 1.7) + 0.04 * sin(a * 3.0 + 4.1 + uSeed * 2.0) + uFace.y * cos(2.0 * (a - uFace.x));
  float hi = 0.035 * sin(a * 9.0 + 0.7 + uSeed * 3.0) + 0.025 * sin(a * 14.0 + 2.3 + uSeed * 4.0) + 0.02 * sin(a * 23.0 + 1.1 + uSeed * 5.3);
  return (lo + hi) * (1.0 + uLop.x * cos(a - uLop.y));
}
float crownOut(float a) { return 0.83 + 0.08 * sin(a + 2.2 + uSeed * 1.3) + 0.1 * sin(a * 3.0 + 1.1 + uSeed) + 0.05 * sin(a * 11.0 + 0.3 + uSeed * 2.1) + 0.4 * uFace.y * cos(2.0 * (a - uFace.x)); }
float crownSide(float a) {
  if (uHullOn < 0.5) return 0.0;
  vec2 n = normalize(uHullN.xz + vec2(1.0e-5, 0.0));
  return -(cos(a) * n.x + sin(a) * n.y);
}
float crownSideJ(float c) { return 1.0 - 0.35 * smoothstep(0.2, 0.9, c) - 0.25 * smoothstep(0.3, 0.95, -c); }
float crownSideO(float c) { return 1.0 - 0.3 * smoothstep(0.2, 0.9, c) + 0.4 * smoothstep(0.3, 0.95, -c); }
vec2 crownAt(float a, float v, float t) {
  t = max(t - uLop.z * (0.5 - 0.5 * cos(a - uLop.y)), 0.0);
  float age = t * v;
  float k = exp(-(t - age) / uCrown.w), c = crownSide(a);
  return vec2(uCrown.x + uCrown.y * k * crownOut(a) * crownSideO(c) * age / (1.0 + 1.1 * age), uCrown.z * k * crownJet(a) * crownSideJ(c) * age - 4.9 * age * age);
}
`;
const crownJet = (a, sd, fa = 0, fk = 0) => 0.83 + 0.05 * Math.sin(a + 0.4 + sd * 1.7) + 0.04 * Math.sin(a * 3 + 4.1 + sd * 2) + fk * Math.cos(2 * (a - fa))
  + 0.035 * Math.sin(a * 9 + 0.7 + sd * 3) + 0.025 * Math.sin(a * 14 + 2.3 + sd * 4) + 0.02 * Math.sin(a * 23 + 1.1 + sd * 5.3);
const crownJetAt = (k, nf, sd) => (0.5 + 0.5 * Math.sin(k * 7.13 + sd * 1.31) < 0.15 ? -1 : (TAU$5 * (k + 0.5 + 0.38 * Math.sin(k * 2.39996 + sd))) / nf);
const crownJetL = (k, sd) => { const h = 0.5 + 0.5 * Math.sin(k * 4.1 + sd * 1.7); return 0.12 + 0.88 * h * h * h; };
const crownOut = (a, sd, fa = 0, fk = 0) => 0.83 + 0.08 * Math.sin(a + 2.2 + sd * 1.3) + 0.1 * Math.sin(a * 3 + 1.1 + sd) + 0.05 * Math.sin(a * 11 + 0.3 + sd * 2.1) + 0.4 * fk * Math.cos(2 * (a - fa));
const ssC = (e0, e1, x) => { const u = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return u * u * (3 - 2 * u); };
const crownSideJ = (c) => 1 - 0.35 * ssC(0.2, 0.9, c) - 0.25 * ssC(0.3, 0.95, -c);
const crownSideO = (c) => 1 - 0.3 * ssC(0.2, 0.9, c) + 0.4 * ssC(0.3, 0.95, -c);

const CROWN_VERT = `
uniform vec3 uC;
uniform vec3 uC0;
uniform float uT;
uniform float uTime;
uniform float uClose;
uniform vec3 uFin;
uniform vec3 uHullP;
uniform vec3 uHullN;
uniform float uHullOn;
attribute vec2 aUV;
varying vec2 vUV;
varying vec3 vW;
varying vec3 vN;
varying float vH;
varying float vMu;
varying float vMv;
varying float vAl;
varying float vMir;
${WAVES_GLSL}
${CROWN_GLSL}
float gMir = 0.0;
vec3 crownPos(float a, float v) {
  vec2 ry = crownAt(a, v, uT);
  ry.x = mix(ry.x, ry.x * 0.35, uClose * (1.0 - smoothstep(0.0, 0.1, v)));
  vec2 cc = mix(uC.xz, uC0.xz, smoothstep(0.0, 0.1, v));
  vec3 p = vec3(cc.x + cos(a) * ry.x, 0.0, cc.y + sin(a) * ry.x);
  p.y = waveHeightAt(p.xz, uTime) + max(ry.y, -0.02);
  float hd = dot(p - uHullP, uHullN);
  gMir = uHullOn > 0.5 ? max(-hd, 0.0) : 0.0;
  if (uHullOn > 0.5 && hd < 0.0) { p -= 2.0 * hd * uHullN; p.y -= 0.8 * hd; }
  return p;
}
const float CROWN_VX = 0.15;
float crownJL() { return uFin.z * smoothstep(0.03, 0.3, uT) + 0.04; }
vec3 crownPosX(float a, float v) {
  if (v <= 1.0) return crownPos(a, v);
  vec3 p1 = crownPos(a, 1.0);
  return p1 + normalize(p1 - crownPos(a, 0.97) + vec3(0.0, 1.0e-5, 0.0)) * ((v - 1.0) / CROWN_VX) * crownJL();
}
void main() {
  float a = aUV.x * 6.2831853;
  float v = aUV.y * (1.0 + CROWN_VX);
  vec3 p = crownPosX(a, v);
  vMir = gMir;
  vec3 pa = crownPosX(a + 0.02, v), vp = crownPosX(a, v + 0.02), vm = crownPosX(a, max(v - 0.02, 0.0));
  vN = cross(pa - p, vp - vm);
  vMu = length(pa - p) / (0.02 / 6.2831853);
  vMv = length(vp - vm) / max(1.0e-3, v + 0.02 - max(v - 0.02, 0.0));
  vAl = v > 1.0 ? (v - 1.0) / CROWN_VX * crownJL() : (v - 1.0) * length(crownPos(a, 1.0) - crownPos(a, 0.96)) / 0.04;
  vH = crownAt(a, min(v, 1.0), uT).y;
  vUV = vec2(aUV.x, v);
  vW = p;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}
`;
const PNOISE_GLSL = `
float fxH(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float fxNP(vec2 p, float P) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = mod(i.x, P);
  float b = mod(i.x + 1.0, P);
  return mix(mix(fxH(vec2(a, i.y)), fxH(vec2(b, i.y)), u.x), mix(fxH(vec2(a, i.y + 1.0)), fxH(vec2(b, i.y + 1.0)), u.x), u.y);
}
float fxN(vec2 p) { return fxNP(p, 1.0e6); }
`;
const SPLASH_GLSL = `
vec3 skyIn(vec3 R) {
  vec2 sh = normalize(uSunDir.xz + vec2(1.0e-4, 0.0));
  vec2 rh = normalize(R.xz + vec2(1.0e-4, 0.0));
  float toSun = pow(max(dot(rh, sh), 0.0), 3.0);
  vec3 hor = uSkyCol * 1.3 + uSunCol * (0.04 + 0.16 * toSun);
  if (R.y >= 0.0) return mix(hor, uSkyCol * 0.95, sqrt(R.y));
  return mix(hor * 0.4, uSkyCol * 0.14, sqrt(-R.y));
}
vec3 rippled(vec3 N, vec2 q, float P, float amp) {
  N = normalize(N);
  float n0 = fxNP(q, P), nx = fxNP(q + vec2(0.4, 0.0), P), ny = fxNP(q + vec2(0.0, 0.4), P);
  vec3 tu = normalize(cross(vec3(0.0, 1.0, 0.0), N) + vec3(1.0e-4, 0.0, 0.0));
  vec3 tv = cross(N, tu);
  return normalize(N + (tu * (nx - n0) + tv * (ny - n0)) * (amp / 0.4));
}
vec4 splashWater2(vec3 N, vec3 N0, vec3 wp, float aer, float thick) {
  vec3 V = normalize(cameraPosition - wp);
  if (dot(N, V) < 0.0) N = -N;
  if (dot(N0, V) < 0.0) N0 = -N0;
  float nv = clamp(dot(N, V), 0.0, 1.0);
  float F = 0.02 + 0.98 * pow(1.0 - nv, 5.0);
  float F2 = 2.0 * F / (1.0 + F);
  vec3 L = uSunDir;
  vec3 H = normalize(L + V);
  float nh = clamp(dot(N, H), 0.0, 1.0);
  float Fh = 0.02 + 0.98 * pow(1.0 - clamp(dot(H, V), 0.0, 1.0), 5.0);
  vec3 glint = uSunCol * Fh * (pow(nh, 1200.0) * 40.0 + pow(nh, 160.0) * 1.2) * step(0.0, dot(N, L));
  glint *= min(1.0, 2.5 / max(dot(glint, vec3(0.2126, 0.7152, 0.0722)), 1.0e-4));
  float cb = dot(-V, L);
  float back = pow(max(cb, 0.0), 6.0);
  vec3 R = skyIn(reflect(-V, N));
  float bend = clamp(1.0 + 3.0 * (dot(N, V) - dot(N0, V)), 0.4, 1.8);
  vec3 thru = (uSkyCol * 0.62 + uSunCol * 0.07) * bend;
  float aT = (0.08 + 0.1 * thick) * (0.6 + 0.4 * bend);
  vec3 clear = R * F2 + glint + uSunCol * vec3(1.0, 0.96, 0.86) * back * 0.08 * thick + thru * aT * (1.0 - F2);
  float aClear = F2 + (1.0 - F2) * aT;
  float wrap = pow(max(dot(N, L) * 0.5 + 0.5, 0.0), 1.4);
  float fw = pow(max(cb, 0.0), 2.0);
  vec3 white = uSunCol * vec3(1.0, 0.96, 0.88) * (0.34 * wrap + 0.75 * fw + 0.5 * back) + uSkyCol * (0.5 + 0.25 * N.y) + glint * 0.4;
  white *= min(1.0, 2.2 / max(dot(white, vec3(0.2126, 0.7152, 0.0722)), 1.0e-4));
  float AW = 0.38 + 0.22 * thick;
  return vec4(mix(clear, white * AW, aer), mix(aClear, AW, aer));
}
vec4 splashWater(vec3 N, vec3 wp, float aer, float thick) { return splashWater2(N, N, wp, aer, thick); }
`;
const CROWN_FRAG = `
uniform float uT;
uniform float uS;
uniform float uSeed;
uniform float uBrief;
uniform vec4 uLop;
uniform vec3 uFin;
uniform float uLife;
uniform vec3 uHullP;
uniform vec3 uHullN;
uniform float uHullOn;
varying vec2 vUV;
varying vec3 vW;
varying vec3 vN;
varying float vH;
varying float vMu;
varying float vMv;
varying float vAl;
varying float vMir;
${FX_GLSL}
${PNOISE_GLSL}
${SPLASH_GLSL}
float sminC(float a, float b, float k) { float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0); return mix(b, a, h) - k * h * (1.0 - h); }
void main() {
  float u = vUV.x, v = vUV.y, t = uT;
  float up = smoothstep(0.01, 0.04, vH);
  if (up < 0.01) discard;
  float Mu = max(vMu, 1.0e-3), Mv = max(vMv, 1.0e-3), K = uFin.y;
  float tt = max(t - uLop.z * (0.5 - 0.5 * cos(u * 6.2831853 - uLop.y)), 0.0);
  float age = tt * min(v, 1.0), tl = tt - age;
  float gr = smoothstep(0.03, 0.3, t);
  float lipD = (0.012 + 0.035 * fxNP(vec2(u * 13.0, 1.3), 13.0) + 0.025 * gr * fxNP(vec2(u * 47.0, 4.7 + t * 1.5), 47.0)
    + 0.015 * gr * abs(2.0 * fxNP(vec2(u * 131.0, 2.9 + t * 3.0), 131.0) - 1.0)) * K;
  float rent = K * Mv * (smoothstep(0.45, 0.8, fxNP(vec2(u * 29.0, 5.9), 29.0)) * (0.04 + 0.42 * smoothstep(0.04, 0.3, t))
    + smoothstep(0.55, 0.85, fxNP(vec2(u * 71.0, 3.3), 71.0)) * 0.14 * smoothstep(0.06, 0.35, t));
  float along = vAl + lipD + rent;
  float NF = uFin.x, Lmax = uFin.z * gr;
  float dF = 1.0e3, dB = 1.0e3, tipK = 0.0;
  float fk = u * NF;
  for (int j = -1; j <= 1; j++) {
    float k = floor(fk) + float(j);
    float km = mod(k, NF);
    if (0.5 + 0.5 * sin(km * 7.13 + uSeed * 1.31) < 0.15) continue;
    float uk = (k + 0.5 + 0.38 * sin(km * 2.39996 + uSeed)) / NF;
    float du = u - uk; du -= floor(du + 0.5);
    float across = du * Mu;
    float hk = 0.5 + 0.5 * sin(km * 4.1 + uSeed * 1.7);
    float L = Lmax * (0.12 + 0.88 * hk * hk * hk);
    float lean = 0.12 * sin(km * 5.71 + uSeed * 0.9);
    float wb = (0.005 + 0.007 * (0.5 + 0.5 * sin(km * 7.3 + uSeed * 2.3))) * gr * mix(0.6, 1.0, K);
    float a = clamp(along, 0.0, L);
    float r = mix(wb, 0.55 * wb, a / max(L, 1.0e-4));
    float ax = across - lean * a;
    float b = length(vec2(across - lean * L, along - L)) - 1.6 * wb;
    dF = min(dF, min(length(vec2(ax, along - a)) - r, b));
    dB = min(dB, b);
    tipK = max(tipK, (1.0 - smoothstep(0.0, max(1.5 * wb, 1.0e-4), abs(ax) - r)) * smoothstep(L - 0.03 - 0.08 * K, L, along) * step(along, L + wb));
  }
  dF = max(dF, (smoothstep(0.75, 1.2, t) - fxN(vec2(u * NF * 1.7, along * 25.0))) * 0.06);
  float dTop = sminC(along, dF, 0.015 * K + 0.003);
  float nA = fxNP(vec2(u * 37.0, 2.1), 37.0);
  float aS = mix(mix(0.28, 0.45, nA), mix(0.04, 0.08, nA), uBrief) + 0.05 * mix(1.0, 0.3, uBrief) * (fxNP(vec2(u * 113.0, tl * 9.0), 113.0) - 0.5);
  float dAge = (age - aS) * Mv / max(tt, 0.05);
  float NR = floor(NF * 1.5), fr = u * NR, dR = 1.0e3;
  for (int j = -1; j <= 1; j++) {
    float k = floor(fr) + float(j), km = mod(k, NR);
    float h1 = fxH(vec2(km, uSeed * 7.0)), h2 = fxH(vec2(km + 31.7, uSeed * 3.0));
    if (h1 < 0.3) continue;
    float ur = (k + 0.5 + 0.7 * (h2 - 0.5) + 0.35 * (fxN(vec2(km * 3.3, tl * 12.0)) - 0.5)) / NR;
    float du = u - ur; du -= floor(du + 0.5);
    float w = mix(0.45 * Mu / NR, 0.003 + 0.005 * h1, smoothstep(-0.01, 0.07, age - aS));
    dR = min(dR, abs(du * Mu) - w);
  }
  float brkS = mix(smoothstep(0.55, 1.0, age), smoothstep(0.2, 0.4, age), uBrief);
  dR = max(max(dR, (brkS - fxNP(vec2(u * NR, tl * 70.0), NR)) * 0.08), dTop);
  float dH = -1.0e3;
  if (dAge < 0.03 && age > 0.05 && v > 0.3) {
    vec2 hq = vec2(u * 64.0, tl * 22.0);
    hq += 0.6 * vec2(fxNP(vec2(u * 23.0, tl * 9.0), 23.0) - 0.5, fxNP(vec2(u * 23.0 + 7.7, tl * 9.0 + 3.1), 23.0) - 0.5);
    vec2 hi = floor(hq), hf = fract(hq);
    vec2 cs = vec2(Mu / 64.0, Mv / (max(tt, 0.05) * 22.0) / 3.5);
    float hu = smoothstep(0.3, 0.6, v);
    for (int j = -1; j <= 1; j++) {
      for (int i = -1; i <= 1; i++) {
        vec2 o = vec2(float(i), float(j)), cl = hi + o;
        cl.x = mod(cl.x, 64.0);
        vec2 rp = vec2(fxH(cl + uSeed), fxH(cl + 17.3 + uSeed));
        float rh = clamp((age - 0.06 - 0.1 * fxH(cl + 5.1)) * (0.8 + 0.6 * fxH(cl + 9.2)), 0.0, 0.42 * cs.x) * step(0.3, fxH(cl + 3.7)) * hu;
        dH = max(dH, rh - length((o + rp - hf) * cs));
      }
    }
    dH -= smoothstep(-0.08, -0.02, along) * 0.2;
  }
  float dSheet = max(max(along, dAge), dH);
  float d = min(sminC(dSheet, dF, 0.015 * K + 0.003), dR);
  float cov = clamp(0.5 - d / max(fwidth(d), 1.0e-4), 0.0, 1.0);
  cov *= up * smoothstep(0.0, 0.025, t) * (1.0 - smoothstep(uLife - 0.2, uLife, t)) * clamp(0.75 + 0.25 * uS, 0.0, 1.0);
  if (uHullOn > 0.5) cov *= smoothstep(0.0, 0.07, abs(dot(vW - uHullP, uHullN)));
  if (uBrief > 0.5) cov *= 1.0 - smoothstep(0.01, 0.06, vMir);
  if (cov < 0.01) discard;
  float beadK = 1.0 - smoothstep(-0.003, 0.003, dB);
  float brk = smoothstep(0.45, 0.62, 0.7 * fxNP(vec2(u * 70.0, tl * 25.0 + t * 3.0), 70.0) + 0.3 * fxNP(vec2(u * 190.0, t * 9.0), 190.0));
  float edgeK = exp(min(dSheet, 0.0) / 0.012) * step(dSheet, 0.004) * brk * smoothstep(0.3, 0.7, v);
  float strK = (1.0 - step(dSheet, 0.004)) * (0.12 + 0.45 * brkS);
  float colH = (0.06 + 0.14 * fxNP(vec2(u * 38.0, t * 2.0), 38.0)) * mix(0.5, 1.0, K) * smoothstep(0.0, 0.05, t);
  float footK = (1.0 - smoothstep(0.35 * colH, colH, v * Mv)) * smoothstep(0.3, 0.55, 0.6 * fxNP(vec2(u * 90.0, tl * 30.0), 90.0) + 0.4 * fxNP(vec2(u * 23.0, t * 2.5), 23.0));
  float aer = clamp(0.95 * max(beadK, tipK) + 0.55 * edgeK + 0.85 * footK + strK, 0.0, 1.0);
  aer = mix(aer, max(aer, 0.45 + 0.4 * max(beadK, tipK)), uBrief);
  vec3 N0 = normalize(vN);
  vec3 N = rippled(vN, vec2(u * 96.0, tl * 30.0), 96.0, 1.0 - 0.5 * aer);
  vec4 c = splashWater2(N, N0, vW, aer, mix(0.3, 1.0, max(aer, 1.0 - step(dSheet, 0.004))));
  float spk = smoothstep(0.86, 0.97, fxNP(vec2(u * 360.0, tl * 300.0 + t * 30.0), 360.0));
  c.rgb += uSunCol * spk * aer * (0.25 + 1.2 * pow(max(dot(normalize(vW - cameraPosition), uSunDir), 0.0), 3.0)) * c.a;
  float strk = smoothstep(0.2, 0.8, fxNP(vec2(u * 140.0, tl * 6.0), 140.0)) * mix(0.45, 1.0, fxNP(vec2(u * 43.0, tl * 20.0), 43.0));
  c *= mix(mix(0.3, 1.0, strk), 1.0, aer);
  gl_FragColor = c * cov;
}
`;

const JET_VERT = `
uniform vec3 uC;
uniform float uT;
uniform float uTime;
uniform vec4 uJet;
uniform vec3 uHullP;
uniform vec3 uHullN;
uniform float uHullOn;
attribute vec2 aUV;
varying vec2 vUV;
varying vec3 vW;
varying vec3 vN;
varying float vH;
${WAVES_GLSL}
void main() {
  float a = aUV.x * 6.2831853;
  float v = aUV.y;
  float tj = max(uT - uJet.x, 0.0);
  float hd = max(uJet.y * tj - 4.9 * tj * tj, 0.0);
  float vv = min(v, 0.93);
  float h = hd * pow(vv / 0.93, 0.85);
  float r = mix(uJet.z, uJet.w, smoothstep(0.0, 0.4, vv));
  r *= 1.0 + 0.15 * (1.0 - smoothstep(0.0, 0.1, vv)) + 0.35 * exp(-pow((vv - 0.88) / 0.07, 2.0)) * (0.6 + 0.8 * fract(sin(floor(a * 1.3) * 12.9898 + floor(tj * 9.0) * 78.233) * 43758.5453));
  r *= 0.82 + 0.18 * sin(a * 3.0 + vv * 13.0 - tj * 10.0) * sin(a * 5.0 - vv * 9.0 + 1.7) + 0.12 * sin(a * 7.0 + vv * 23.0 - tj * 6.0);
  vec2 dir = vec2(cos(a), sin(a));
  vec3 n = vec3(dir.x, 0.15, dir.y);
  if (v > 0.93) {
    float c = (v - 0.93) / 0.07 * 1.5707963;
    float lump = 0.85 + 0.3 * (0.5 + 0.5 * sin(a * 3.0 + tj * 9.0 + 1.3) * sin(a * 2.0 - tj * 5.0));
    h += r * lump * sin(c) * 0.9;
    r *= cos(c);
    n = vec3(dir.x * cos(c), sin(c), dir.y * cos(c));
  }
  vec2 sway = vec2(sin(h * 3.1 + uJet.x * 20.0), cos(h * 2.3 + uJet.x * 13.0)) * 0.035 * h;
  vec3 p = vec3(uC.x + dir.x * r + sway.x, 0.0, uC.z + dir.y * r + sway.y);
  p.y = waveHeightAt(p.xz, uTime) + h;
  float hd2 = dot(p - uHullP, uHullN);
  if (uHullOn > 0.5 && hd2 < 0.0) { p -= 2.0 * hd2 * uHullN; p.y -= 0.8 * hd2; }
  vN = n;
  vH = h;
  vUV = aUV;
  vW = p;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}
`;
const JET_FRAG = `
uniform float uT;
uniform vec4 uJet;
varying vec2 vUV;
varying vec3 vW;
varying vec3 vN;
varying float vH;
${FX_GLSL}
${PNOISE_GLSL}
${SPLASH_GLSL}
void main() {
  float tj = uT - uJet.x;
  if (tj <= 0.0) discard;
  float u = vUV.x, v = vUV.y;
  float st = fxNP(vec2(u * 16.0, v * 2.0 - tj * 3.0), 16.0) * 0.6 + fxNP(vec2(u * 41.0, v * 5.0 - tj * 5.0), 41.0) * 0.4;
  float brkW = step(0.55, fxNP(vec2(u * 96.0, v * 14.0 - tj * 5.0), 96.0));
  float footLine = (1.0 - smoothstep(0.0, 0.03, v)) * step(0.5, fxNP(vec2(u * 60.0, tj * 5.0), 60.0));
  float headK = smoothstep(0.12, 0.3, tj) * smoothstep(0.78, 0.95, v);
  float aer = clamp(smoothstep(0.78, 0.92, st) * 0.3 + headK * brkW * 0.55 + footLine * 0.5, 0.0, 1.0);
  float bl = fxNP(vec2(u * 9.0, v * 11.0 - tj * 3.0), 9.0) * 0.65 + fxNP(vec2(u * 23.0, v * 27.0 + tj * 2.0), 23.0) * 0.35;
  float brk = mix(smoothstep(0.4, 1.0, tj) * 0.8, 0.72, headK);
  float sd = bl - brk;
  float solid = clamp(0.5 + sd / max(fwidth(sd), 1.0e-4), 0.0, 1.0);
  float cov = solid * smoothstep(0.0, 0.04, tj) * smoothstep(0.0, 0.03, vH) * (1.0 - smoothstep(0.55, 0.8, tj));
  if (cov < 0.01) discard;
  float side = abs(dot(normalize(vN), normalize(cameraPosition - vW)));
  float rag = fxNP(vec2(u * 30.0, v * 12.0 - tj * 8.0), 30.0);
  cov *= smoothstep(0.02, 0.3, side + 0.25 * rag - 0.1);
  if (cov < 0.01) discard;
  vec3 N0 = normalize(vN);
  vec3 N = rippled(vN, vec2(u * 24.0, v * 7.0 - tj * 6.0), 24.0, 0.45 * (1.0 - 0.5 * aer));
  gl_FragColor = splashWater2(N, N0, vW, aer, 0.25) * cov;
}
`;

const RING_GLSL = `
float ringEta(float r, float t) {
  float A = mix(0.035 * uS, 0.01, uSmall);
  float rr = max(r, 0.1);
  float env = exp(-pow((r - 1.05 * t) / (0.35 + 0.3 * t), 2.0)) + 0.5 * step(r, 1.05 * t);
  float e = A * sqrt(0.5 / (0.5 + r)) * env * cos(9.81 * t * t / (4.0 * rr)) * exp(-t / 3.5) * smoothstep(mix(0.3, 0.0, uSmall), mix(0.7, 0.2, uSmall), t) * smoothstep(0.05, 0.3, r);
  float th = t - (uJ0 - 0.3);
  e += (1.0 - uSmall) * 0.07 * sin(3.14159265 * clamp(th / 0.8, 0.0, 1.0)) * step(0.0, th) * exp(-r * r / 0.09);
  return e;
}
`;
const FOAM_VERT = `
uniform vec3 uC;
uniform float uR;
uniform float uTime;
uniform float uT;
uniform float uS;
uniform float uJ0;
uniform float uSmall;
attribute vec2 aUV;
varying vec2 vQ;
varying vec3 vW;
${WAVES_GLSL}
${RING_GLSL}
void main() {
  float a = aUV.x * 6.2831853;
  vec2 q = vec2(cos(a), sin(a)) * aUV.y * uR;
  vec3 p = vec3(uC.x + q.x, 0.0, uC.z + q.y);
  vec3 disp = vec3(0.0);
  for (int i = 0; i < NWAVES; i++) {
    float ph = W_K[i] * dot(W_DIR[i], p.xz) - W_W[i] * uTime + W_P[i];
    disp.xz += (W_Q[i] * W_A[i] * cos(ph)) * W_DIR[i];
    disp.y += W_A[i] * sin(ph);
  }
  float r = length(q), t = uT;
  float lam = 8.0 * 3.14159265 * r * r / max(9.81 * t * t, 1e-3);
  float eta = ringEta(r, t) * smoothstep(2.5, 5.0, lam / (0.06 + 0.1 * r));
  float side = cameraPosition.y > waveHeightAt(cameraPosition.xz, uTime) ? 1.0 : -1.0;
  vQ = q;
  vW = p + disp + vec3(0.0, 0.012 * side + eta, 0.0);
  gl_Position = projectionMatrix * viewMatrix * vec4(vW, 1.0);
}
`;
const FOAM_FRAG = `
uniform float uT;
uniform float uS;
uniform float uR0;
uniform float uSmall;
uniform float uJ0;
uniform float uRing;
uniform float uRim;
uniform float uLand;
varying vec2 vQ;
varying vec3 vW;
${FX_GLSL}
${PNOISE_GLSL}
${SPLASH_GLSL}
${RING_GLSL}
void main() {
  float t = uT, s = uS;
  vec2 q = vQ;
  float r = length(q);
  float ir = 1.0 + 0.4 * (fxN(q * 1.2 + 3.1) - 0.5) + 0.22 * (fxN(q * 3.7 - 1.7) - 0.5);
  float rr = r * ir;
  float R1 = uR0 + 0.2 + uRim * (0.45 + 0.5 * (1.0 - exp(-t * 0.55))) + 0.05 * t;
  float rn = rr / max(R1, 0.3);
  float wR = (0.2 + 0.25 * t / (1.0 + 0.35 * t)) * (0.6 + 0.35 * uRim);
  float ring = exp(-(rr - R1) * (rr - R1) / (wR * wR));
  float n1 = fxN(q * 2.6 + vec2(t * 0.1, -t * 0.08) + 11.0);
  float n2 = fxN(q * 7.5 - vec2(t * 0.22, t * 0.16) + 7.3);
  float n3 = fxN(q * 21.0 + vec2(t * 0.45, -t * 0.3) + 2.9);
  float lace = 1.0 - abs(n2 * 2.0 - 1.0);
  float fizz = 1.0 - abs(n3 * 2.0 - 1.0);
  float cells = n1 * 0.3 + lace * 0.5 + fizz * 0.2;
  float streak = fxNP(vec2((atan(q.y, q.x) / 6.2831853 + 0.5) * 26.0, r * 1.3 - t * 0.5), 26.0);
  float early = exp(-t / 1.3);
  float inner = 1.0 - smoothstep(0.55, 1.0, rn);
  float boil = smoothstep(0.5, 0.82, fxN(q * 2.1 + vec2(0.0, t * 0.8) + 5.0)) * exp(-max(t - uJ0, 0.0) / 2.0) * smoothstep(uJ0, uJ0 + 0.4, t) * inner;
  float sk = r - (uR0 + mix(0.55, 0.2, uSmall) * t / (1.0 + 1.5 * t));
  float skirt = exp(-sk * sk / mix(0.03, 0.003, uSmall)) * (1.0 - mix(smoothstep(0.1 + 0.4 * uLand, 0.3 + 0.9 * uLand, t), smoothstep(0.1, 0.3, t), uSmall)) * mix(smoothstep(0.0, 0.03, t), 1.0, uSmall) * (0.45 + 0.55 * n2);
  float rain = (1.0 - uSmall) * uRing * smoothstep(0.3 * uRim, 0.7 * uRim, r) * (1.0 - smoothstep(1.5 * uRim, 2.4 * uRim, r))
    * smoothstep(0.45 * uLand, uLand, t) * exp(-max(t - uLand, 0.0) / 1.4);
  float frk = smoothstep(0.6, 0.8, 0.6 * fxN(q * 34.0 + 3.7) + 0.4 * fxN(q * 11.0 - 1.3));
  float densR = ring * 0.8 * uRing * smoothstep(uLand - 0.5, uLand + 0.1, t) * (0.6 + 0.5 * streak) + 0.5 * skirt + 0.9 * rain * frk;
  float densB = boil * 0.85;
  float dens = mix(densR + densB, 0.8 * skirt, uSmall);
  dens *= smoothstep(0.0, 0.06, t) * (1.0 - smoothstep(4.0, 10.5, t)) * clamp(0.6 + 0.4 * s, 0.4, 1.2);
  float f = smoothstep(1.0 - dens, 1.0 - dens + 0.28, cells + 0.2 * early);
  float lk = smoothstep(0.3, 0.6, cells);
  float hole = (1.0 - uSmall) * (1.0 - smoothstep(uR0 - 0.05, uR0 + 0.1, r)) * (1.0 - smoothstep(uJ0 - 0.3, uJ0 + 0.3, t));
  bool under = cameraPosition.y < vW.y;
  vec3 col;
  float a;
  if (under) {
    vec3 Vu = normalize(vW - cameraPosition);
    float kS = smoothstep(0.62, 0.7, Vu.y);
    col = mix(0.3 * uSkyCol, mix(0.35, 0.6, f) * (uSkyCol + 0.3 * uSunCol), kS);
    a = min(0.45, 0.5 * f) * lk;
  } else {
    vec3 lit = uSunCol * (0.12 + 0.45 * max(uSunDir.y, 0.0)) + uSkyCol * 0.8;
    vec3 fc = vec3(0.94, 0.95, 0.96) * lit * (0.8 + 0.25 * fizz) * mix(0.72, 1.0, smoothstep(0.45, 1.0, f)) + uSunCol * pow(fizz, 14.0) * 0.3;
    vec3 sc = vec3(0.16, 0.5, 0.46) * (uSkyCol * 0.8 + uSunCol * 0.06);
    float boilK = (1.0 - uSmall) * densB / max(densR + densB, 1.0e-4);
    float aF = f * lk * mix(0.85, 0.5, boilK) * mix(1.0, 0.55, uSmall), aS = smoothstep(0.1, 0.9, dens) * (1.0 - f) * 0.25 * (1.0 - hole) * (1.0 - uSmall);
    a = aF + aS * (1.0 - aF);
    col = (fc * aF + sc * aS * (1.0 - aF)) / max(a, 1.0e-4);
    float ah = 0.22 * hole * smoothstep(0.0, 0.05, t);
    float a2 = a + ah * (1.0 - a);
    col = (col * a + vec3(0.02, 0.07, 0.08) * uSkyCol * 2.0 * ah * (1.0 - a)) / max(a2, 1.0e-4);
    a = a2;
  }
  float sl = (ringEta(r + 0.01, t) - ringEta(max(r - 0.01, 0.0), t)) / 0.02;
  vec2 dr2 = r > 1.0e-4 ? q / r : vec2(0.0);
  vec3 Nn = normalize(vec3(-sl * dr2.x, 1.0, -sl * dr2.y));
  float ra = 0.0;
  vec3 rc = vec3(0.0);
  if (!under) {
    vec3 V = normalize(cameraPosition - vW);
    float F0 = 0.02 + 0.98 * pow(1.0 - clamp(V.y, 0.0, 1.0), 5.0);
    float Fn = 0.02 + 0.98 * pow(1.0 - clamp(dot(Nn, V), 0.0, 1.0), 5.0);
    vec3 c0 = skyIn(reflect(-V, vec3(0.0, 1.0, 0.0))) * F0, c1 = skyIn(reflect(-V, Nn)) * Fn;
    float dl = dot(c1 - c0, vec3(0.3, 0.5, 0.2));
    ra = clamp(abs(dl) * 3.0, 0.0, 0.6);
    rc = dl > 0.0 ? c1 * 1.6 + uSkyCol * 0.2 : vec3(0.0, 0.03, 0.045);
  } else {
    vec3 Vu = normalize(vW - cameraPosition);
    ra = clamp(abs(sl) * 6.0, 0.0, 0.35) * smoothstep(0.62, 0.7, Vu.y);
    rc = uSkyCol * 1.3 + uSunCol * 0.1;
  }
  float A = a + ra * (1.0 - a);
  if (A < 0.01) discard;
  gl_FragColor = vec4((col * a + rc * ra * (1.0 - a)) / A, A);
}
`;

const PART_VERT = `
uniform float uPx;
uniform vec3 uDrift;
attribute vec4 aSeed;
varying float vA;
varying vec3 vCol;
${FX_GLSL}
${FXV_GLSL}
void main() {
  float s = aSeed.x, hs = aSeed.z;
  vec3 p = position + uDrift * (0.7 + 0.6 * fract(s * 7.31))
    + vec3(sin(uTime * 0.17 + s * 40.0), 0.5 * sin(uTime * 0.11 + s * 17.0), cos(uTime * 0.13 + s * 30.0)) * (0.15 + 0.25 * fract(s * 3.7));
  p.y -= uTime * (0.003 + 0.012 * fract(s * 5.1));
  vec3 rel = mod(p - cameraPosition + hs, 2.0 * hs) - hs;
  p = cameraPosition + rel;
  float vis = fxFog(p, 0.0);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float d = max(-mv.z, 0.01);
  vZ = d;
  gl_Position = projectionMatrix * mv;
  float own = aSeed.y * 0.001 * ${SIZE_K} * uPx / d;
  float px = max(own, 1.3);
  float edge = max(abs(rel.x), max(abs(rel.y), abs(rel.z)));
  vA = min(1.0, (own * own + 0.3) / (px * px)) * aSeed.w
     * smoothstep(1.6, 3.5, d) * (1.0 - smoothstep(hs * 0.7, hs, edge))
     * step(p.y, uWaterY + waveHeightAt(p.xz, uTime) - 0.3) * step(uCamRel, -0.02) * vis;
  vCol = mix(vec3(0.86, 0.9, 0.84), vec3(0.78, 0.74, 0.62), fract(s * 13.0)) * fxLight(p, 0.9);
  gl_PointSize = vA > 0.003 ? px + 1.0 : 0.0;
}
`;
const PART_FRAG = `
varying float vA;
varying vec3 vCol;
${FXF_GLSL}
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float r = length(c) * 2.0;
  float a = exp(-r * r * 2.8) * (1.0 - smoothstep(0.75, 1.0, r)) * vA;
  if (a < 0.003) discard;
  gl_FragColor = vec4(vCol * vT + vLin, a * fxSoft(0.3, 0.0));
}
`;

function puffTexture() {
  const S = 128, N = S * 2;
  const c = document.createElement('canvas');
  c.width = c.height = N;
  const g = c.getContext('2d');
  const img = g.createImageData(N, N);
  for (let cell = 0; cell < 4; cell++) {
    const ox = (cell & 1) * S, oy = (cell >> 1) * S, sd = cell * 7.31 + 1.7;
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const u = ((x + 0.5) / S) * 2 - 1, v = ((y + 0.5) / S) * 2 - 1;
        let n = 0, a = 0.5, f = 2.2;
        for (let o = 0; o < 5; o++) { n += a * (0.5 + 0.5 * noise2(u * f + sd, v * f - sd * 1.3)); a *= 0.5; f *= 2.03; }
        n /= 0.96875;
        const rr = Math.hypot(u, v);
        const r = rr + (n - 0.5) * 0.55;
        let e = 1 - Math.min(1, Math.max(0, (r - 0.2) / 0.7));
        e = e * e * (3 - 2 * e);
        const rim = Math.min(1, Math.max(0, (1 - rr) / 0.25));
        const val = e * rim * (0.45 + 0.8 * n);
        const k = ((oy + y) * N + ox + x) * 4;
        const b = Math.max(0, Math.min(255, Math.round(val * 255)));
        img.data[k] = img.data[k + 1] = img.data[k + 2] = b;
        img.data[k + 3] = 255;
      }
    }
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace;
  return t;
}

const _m4$1 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion();
const _s$1 = new THREE.Vector3(), _p = new THREE.Vector3(), _ax = new THREE.Vector3();
const _siltBounce = { spread: 0.02, color: [0.62, 0.56, 0.45], up: 0.06, life: 2.4, size: 0.01, ground: 0 };
const _grainBounce = { spread: 0.01, up: 0.12, ground: 0 };
class Chunks {
  constructor(scene, max, fx) {
    this.max = max;
    this.fx = fx;
    const geo = new THREE.IcosahedronGeometry(1, 1);
    const pa = geo.attributes.position;
    for (let i = 0; i < pa.count; i++) {
      const x = pa.getX(i), y = pa.getY(i), z = pa.getZ(i);
      const n = 0.68 + 0.32 * (0.5 + 0.5 * noise3(x * 1.9 + 3.1, y * 1.9, z * 1.9));
      pa.setXYZ(i, x * n, y * n * 0.5, z * n * 0.8);
    }
    geo.computeVertexNormals();
    const mat = patchMaterial(new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0 }));
    this.mesh = new THREE.InstancedMesh(geo, mat, max);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(max * 3).fill(1), 3);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.renderOrder = 3;
    this.pos = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.quat = new Float32Array(max * 4);
    this.spin = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.size = new Float32Array(max);
    this.ground = new Float32Array(max);
    this.rest = new Uint8Array(max);
    this.head = 0;
    this.active = false;
    _m4$1.makeScale(0, 0, 0);
    for (let i = 0; i < max; i++) this.mesh.setMatrixAt(i, _m4$1);
    scene.add(this.mesh);
  }
  spawn(pos, vel, size, color, ground) {
    const i = this.head;
    this.head = (this.head + 1) % this.max;
    const i3 = i * 3, i4 = i * 4;
    this.pos[i3] = pos.x; this.pos[i3 + 1] = pos.y; this.pos[i3 + 2] = pos.z;
    this.vel[i3] = vel.x; this.vel[i3 + 1] = vel.y; this.vel[i3 + 2] = vel.z;
    _q.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
    this.quat[i4] = _q.x; this.quat[i4 + 1] = _q.y; this.quat[i4 + 2] = _q.z; this.quat[i4 + 3] = _q.w;
    const w = 5 + Math.random() * 9;
    _ax.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize().multiplyScalar(w);
    this.spin[i3] = _ax.x; this.spin[i3 + 1] = _ax.y; this.spin[i3 + 2] = _ax.z;
    this.life[i] = 10 + Math.random() * 5;
    this.size[i] = size;
    this.ground[i] = ground;
    this.rest[i] = 0;
    const sh = 0.85 + Math.random() * 0.3;
    this.mesh.instanceColor.setXYZ(i, color[0] * sh, color[1] * sh, color[2] * sh);
    this.mesh.instanceColor.needsUpdate = true;
    this.active = true;
  }
  update(dt, cur) {
    if (!this.active) return;
    let alive = 0;
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      const i3 = i * 3, i4 = i * 4;
      if (this.life[i] <= 0) { _m4$1.makeScale(0, 0, 0); this.mesh.setMatrixAt(i, _m4$1); continue; }
      alive++;
      const s = this.size[i];
      _q.set(this.quat[i4], this.quat[i4 + 1], this.quat[i4 + 2], this.quat[i4 + 3]);
      if (!this.rest[i]) {
        const k = Math.exp(-3 * dt);
        this.vel[i3] = this.vel[i3] * k + cur.x * (1 - k);
        this.vel[i3 + 1] = (this.vel[i3 + 1] - 1.4 * dt) * k;
        this.vel[i3 + 2] = this.vel[i3 + 2] * k + cur.z * (1 - k);
        this.pos[i3] += this.vel[i3] * dt;
        this.pos[i3 + 1] += this.vel[i3 + 1] * dt;
        this.pos[i3 + 2] += this.vel[i3 + 2] * dt;
        _ax.set(this.spin[i3], this.spin[i3 + 1], this.spin[i3 + 2]);
        const w = _ax.length();
        if (w > 1e-4) { _q2.setFromAxisAngle(_ax.divideScalar(w), w * dt); _q.premultiply(_q2); }
        const floorY = this.ground[i] + s * 0.35;
        if (this.pos[i3 + 1] < floorY) {
          this.pos[i3 + 1] = floorY;
          const vy = this.vel[i3 + 1];
          if (vy < -0.12) {
            this.vel[i3 + 1] = -vy * 0.28;
            this.vel[i3] *= 0.5; this.vel[i3 + 2] *= 0.5;
            this.spin[i3] *= 0.45; this.spin[i3 + 1] *= 0.45; this.spin[i3 + 2] *= 0.45;
            _p.set(this.pos[i3], this.ground[i], this.pos[i3 + 2]);
            _siltBounce.size = 0.01 + s;
            _siltBounce.ground = this.ground[i];
            this.fx.silt(_p, 2, _siltBounce);
            _grainBounce.ground = this.ground[i];
            this.fx.grains(_p, 4, _grainBounce);
          } else {
            this.rest[i] = 1;
            this.vel[i3] = this.vel[i3 + 1] = this.vel[i3 + 2] = 0;
          }
        }
        this.quat[i4] = _q.x; this.quat[i4 + 1] = _q.y; this.quat[i4 + 2] = _q.z; this.quat[i4 + 3] = _q.w;
      }
      const fade = Math.min(1, this.life[i] / 1.2);
      _p.set(this.pos[i3], this.pos[i3 + 1], this.pos[i3 + 2]);
      _s$1.setScalar(s * fade);
      _m4$1.compose(_p, _q, _s$1);
      this.mesh.setMatrixAt(i, _m4$1);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    this.active = alive > 0;
  }
}

class Splash {
  constructor(scene, fx) {
    this.fx = fx;
    this.on = false;
    this.t = 0;
    this.s = 1;
    this.c = new THREE.Vector3();
    this.c0 = new THREE.Vector3();
    this.seed = 0;
    this.R0 = 0.3;
    this.VR = 2;
    this.VZ = 4;
    this.j0 = 0.3;
    this.jetV = 4;
    this.acc = { rim: 0, mist: 0, jet: 0, boil: 0 };
    this.crownOn = false;
    this.seen = false;
    this.small = false;
    this.tClose = -1;
    this.life = 0.7; this.Rb = 0.3; this.R1 = 0.3; this.tR = 0; this.brief = false; this.rim = 1; this.land = 1;
    this._tp = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, tip: false };
    const grid = (NU, NV, vPow) => {
      const n = (NU + 1) * (NV + 1);
      const uv = new Float32Array(n * 2), idx = [];
      for (let j = 0; j <= NV; j++) {
        for (let i = 0; i <= NU; i++) {
          const k = (j * (NU + 1) + i) * 2;
          uv[k] = i / NU;
          uv[k + 1] = Math.pow(j / NV, vPow);
        }
      }
      for (let j = 0; j < NV; j++) {
        for (let i = 0; i < NU; i++) {
          const a = j * (NU + 1) + i, b = a + 1, c = a + NU + 1, d = c + 1;
          idx.push(a, b, c, b, d, c);
        }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
      g.setAttribute('aUV', new THREE.BufferAttribute(uv, 2));
      g.setIndex(idx);
      g.setDrawRange(0, 0);
      return g;
    };
    const mesh = (geo, U2, vert, frag, extra, order) => {
      const m = new THREE.Mesh(geo, new THREE.ShaderMaterial(Object.assign({
        uniforms: U2, vertexShader: vert, fragmentShader: frag,
        transparent: true, depthWrite: false, side: THREE.DoubleSide,
      }, extra)));
      m.frustumCulled = false;
      m.renderOrder = order;
      m.onBeforeRender = () => { this.seen = true; };
      scene.add(m);
      return m;
    };
    const sheetU = () => Object.assign({ uC: { value: new THREE.Vector3() }, uT: { value: 0 }, uS: { value: 1 }, uTime: U.uTime }, LIGHT);
    this.hullU = { uHullP: { value: new THREE.Vector3() }, uHullN: { value: new THREE.Vector3(1, 0, 0) }, uHullOn: { value: 0 } };
    this.crownU = Object.assign(sheetU(), { uCrown: { value: new THREE.Vector4(0.3, 2, 4, 0.13) }, uSeed: { value: 0 }, uClose: { value: 0 }, uC0: { value: new THREE.Vector3() }, uFin: { value: new THREE.Vector3(128, 1, 0.5) }, uLife: { value: 0.7 }, uBrief: { value: 0 }, uLop: { value: new THREE.Vector4() }, uFace: { value: new THREE.Vector2() } }, this.hullU);
    this.crown = mesh(grid(256, 64, 0.8), this.crownU, CROWN_VERT, CROWN_FRAG, { premultipliedAlpha: true }, 7);
    this.jetU = Object.assign(sheetU(), { uJet: { value: new THREE.Vector4(0.3, 4, 0.18, 0.07) } }, this.hullU);
    this.jet = mesh(grid(64, 32, 1), this.jetU, JET_VERT, JET_FRAG, { premultipliedAlpha: true }, 7);
    this.foamU = Object.assign({ uC: { value: new THREE.Vector3() }, uT: { value: 0 }, uS: { value: 1 }, uR: { value: 8 }, uR0: { value: 0.3 }, uSmall: { value: 0 }, uJ0: { value: 99 }, uRing: { value: 1 }, uRim: { value: 1.2 }, uLand: { value: 1 }, uTime: U.uTime }, LIGHT);
    this.foam = mesh(grid(96, 48, 1.4), this.foamU, FOAM_VERT, FOAM_FRAG,
      { polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4 }, 3);
    this.meshes = [this.crown, this.jet, this.foam];
  }

  start(p, s, sy, opts) {
    this.on = true;
    this.t = opts && opts.small ? 0.03 : 0;
    this.s = s;
    this.c.set(p.x, sy, p.z);
    this.c0.copy(this.c);
    this.seed = rnd$1() * TAU$5;
    this.acc.rim = this.acc.mist = this.acc.jet = this.acc.boil = this.acc.haze = 0;
    this.small = !!(opts && opts.small);
    this.brief = !this.small && !!(opts && opts.brief);
    this.crownU.uBrief.value = this.brief ? 1 : 0;
    const lop = this.brief && opts && opts.lop;
    this.crownU.uLop.value.set(lop ? lop[0] : 0, lop ? lop[1] : 0, lop ? lop[2] : 0, 0);
    const face = !this.small && !this.brief ? (opts && Number.isFinite(opts.face) ? opts.face : rnd$1() * TAU$5) : 0;
    this.crownU.uFace.value.set(face, this.small || this.brief ? 0 : opts && Number.isFinite(opts.face) ? 0.12 : 0.09);
    this.crownOn = !this.small;
    this.tClose = -1;
    this.crownU.uClose.value = 0;
    this.hullU.uHullOn.value = 0;
    if (this.small) {
      const u = opts && Number.isFinite(opts.U) ? opts.U : 1;
      this.R0 = 0.09; this.VR = 0.5; this.VZ = 0.6 + 0.35 * u;
      this.crownU.uCrown.value.set(this.R0, this.VR, this.VZ, 0.06);
      this.j0 = 99; this.jetV = 0; this.tR = 0;
      this.foamU.uR0.value = 0.08; this.foamU.uR.value = 0.8; this.foamU.uSmall.value = 1; this.foamU.uJ0.value = 99;
      this.crownU.uFin.value.set(6, 0.35, 0.05);
    } else {
      this.Rb = opts && Number.isFinite(opts.R0) ? opts.R0 : 0.30 + 0.04 * s;
      this.R1 = opts && Number.isFinite(opts.R1) ? opts.R1 : this.Rb;
      this.tR = opts && Number.isFinite(opts.tR) ? opts.tR : 0;
      this.R0 = this.Rb;
      this.VR = opts && Number.isFinite(opts.VR) ? opts.VR : 2.8 + 1.1 * s;
      this.VZ = opts && Number.isFinite(opts.VZ) ? opts.VZ : 5.4 + 1.6 * s;
      this.crownU.uCrown.value.set(this.R0, this.VR, this.VZ, opts && Number.isFinite(opts.w) ? opts.w : 0.13);
      this.j0 = this.brief ? 99 : opts && Number.isFinite(opts.j0) ? opts.j0 : 0.3 + 0.08 * rnd$1();
      this.jetV = 3.4 + 1.8 * s;
      this.foamU.uR0.value = this.R0; this.foamU.uR.value = 8; this.foamU.uSmall.value = 0; this.foamU.uJ0.value = this.j0;
      this.foamU.uRing.value = this.brief ? 0 : 1;
      this.crownU.uFin.value.set(this.brief ? 56 : 128, this.brief ? 0.55 : 1, this.brief ? 0.14 : (0.28 + 0.22 * s) * Math.min(1.3, this.VZ / 7));
    }
    this.crownU.uSeed.value = this.seed;
    this.life = !this.small && opts && Number.isFinite(opts.life) ? opts.life : this.small ? 0.7 : Math.min(1.9, Math.max(0.7, (2.1 * this.VZ) / 9.8 + 0.1));
    this.crownU.uLife.value = this.life;
    this.land = 0.85 * this.life;
    this.rim = this.R0 + (this.VR * 0.85 * this.land) / (1 + 1.1 * this.land);
    this.foamU.uRim.value = this.rim; this.foamU.uLand.value = this.land;
    this.jetU.uJet.value.set(this.j0, this.jetV, 0.12 + 0.03 * s, 0.065 + 0.015 * s);
    for (let k = 0; k < 3; k++) {
      const u = k === 0 ? this.crownU : k === 1 ? this.jetU : this.foamU;
      u.uC.value.copy(this.c);
      u.uS.value = s;
      u.uT.value = 0;
    }
    this.crownU.uC0.value.copy(this.c);
    for (let k = 0; k < this.meshes.length; k++) {
      const m = this.meshes[k], on = !(this.small && k <= 1) && !(this.brief && k === 1);
      m.geometry.setDrawRange(0, on ? Infinity : 0); m.material.visible = on;
    }
  }
  track(x, z) {
    if (!this.on) return;
    this.c.x = x; this.c.z = z;
    this.crownU.uC.value.copy(this.c); this.jetU.uC.value.copy(this.c); this.foamU.uC.value.copy(this.c);
  }
  close() { if (this.on && this.tClose < 0) this.tClose = this.t; }
  setHull(p, n) { this.hullU.uHullP.value.copy(p); this.hullU.uHullN.value.copy(n).normalize(); this.hullU.uHullOn.value = 1; }
  _side(a) {
    if (this.hullU.uHullOn.value < 0.5) return 0;
    const n = this.hullU.uHullN.value, l = Math.hypot(n.x, n.z) || 1;
    return -(Math.cos(a) * n.x + Math.sin(a) * n.z) / l;
  }
  _j(a) { const L = this.crownU.uLop.value, F = this.crownU.uFace.value; return crownJet(a, this.seed, F.x, F.y) * crownSideJ(this._side(a)) * (1 + L.x * Math.cos(a - L.y)); }
  _td(a) { const L = this.crownU.uLop.value; return L.z * (0.5 - 0.5 * Math.cos(a - L.y)); }
  _o(a) { const F = this.crownU.uFace.value; return crownOut(a, this.seed, F.x, F.y) * crownSideO(this._side(a)); }

  update(dt, time) {
    if (!this.on) {
      if (this.seen) for (let k = 0; k < this.meshes.length; k++) this.meshes[k].material.visible = false;
      return;
    }
    const t = (this.t += dt), s = this.s, A = this.acc;
    this.crownU.uT.value = t;
    this.jetU.uT.value = t;
    this.foamU.uT.value = t;
    if (this.tClose >= 0) { const k = Math.min(1, (t - this.tClose) / 0.12); this.crownU.uClose.value = k * k * (3 - 2 * k); }
    if (this.small) {
      if (this.crownOn && t > 0.5) { this.crownOn = false; this.crown.geometry.setDrawRange(0, 0); this.crown.material.visible = false; }
      if (t > 0.6) { this.on = false; this.foam.geometry.setDrawRange(0, 0); this.foam.material.visible = false; }
      return;
    }
    if (this.tR > 0) {
      const k = Math.min(1, t / this.tR), R = this.Rb + (this.R1 - this.Rb) * k * k * (3 - 2 * k);
      this.R0 = R; this.crownU.uCrown.value.x = R; this.foamU.uR0.value = R;
    }
    const L = this.life;
    if (this.crownOn && t > L && t > this.j0 + 1.2) {
      this.crownOn = false;
      for (let k = 0; k < 2; k++) { const m = this.meshes[k]; m.geometry.setDrawRange(0, 0); m.material.visible = false; }
    } else if (this.crownOn && t > L && this.crown.material.visible) { this.crown.geometry.setDrawRange(0, 0); this.crown.material.visible = false; }
    if (this.brief && t > L) {
      this.on = false;
      for (let k = 0; k < this.meshes.length; k++) { const m = this.meshes[k]; m.geometry.setDrawRange(0, 0); m.material.visible = false; }
      return;
    }
    const kb = this.brief ? 0.3 : 1;
    if (t > 0.03 && t < L - 0.1) {
      A.rim += dt * 9000 * s * kb * ssC(0.03, 0.1, t) * Math.exp(-t / 0.5);
      while (A.rim >= 1) { A.rim -= 1; this._rimDrop(t, time); }
    }
    if (t > 0.03 && t < 0.75 * L) {
      A.mist += dt * 7000 * s * kb * Math.exp(-t / 0.45);
      while (A.mist >= 1) { A.mist -= 1; this._mist(t, time); }
    }
    const tj = t - this.j0;
    if (tj > 0.05 && tj < 0.75) {
      A.jet += dt * 400 * s * Math.exp(-tj / 0.35);
      while (A.jet >= 1) { A.jet -= 1; this._jetDrop(tj, time); }
    }
    if (t < 4.5 && !this.brief) {
      A.boil += dt * 190 * s * Math.exp(-t / 1.2);
      while (A.boil >= 1) { A.boil -= 1; this._bubble(time); }
    }
    if (t > 11) {
      this.on = false;
      this.foam.geometry.setDrawRange(0, 0);
      this.foam.material.visible = false;
    }
  }

  _tip(t, ft) {
    let a = -1, j, tip = false, tipL = 0;
    if (t > 0.06 && rnd$1() < ft) {
      const F = this.crownU.uFin.value, NF = F.x;
      for (let n = 0; n < 4 && !tip; n++) {
        const k = Math.floor(rnd$1() * NF);
        a = crownJetAt(k, NF, this.seed);
        if (a < 0) continue;
        tip = true; tipL = F.z * ssC(0.03, 0.3, t) * crownJetL(k, this.seed) - 0.02;
      }
    }
    if (tip) j = this._j(a);
    else {
      a = rnd$1() * TAU$5; j = this._j(a);
      for (let k = 0; k < 2 && rnd$1() > j - 0.35; k++) { a = rnd$1() * TAU$5; j = this._j(a); }
    }
    t = Math.max(0, t - this._td(a));
    const jr = this._o(a), g = 1 + 1.1 * t;
    let y = this.VZ * j * t - 4.9 * t * t;
    if (y < 0.05) return null;
    let r = this.R0 + this.VR * jr * t / g;
    if (tip) {
      const t2 = 0.97 * t, k2 = Math.exp(-(t - t2) / this.crownU.uCrown.value.w);
      const dr = r - (this.R0 + (this.VR * k2 * jr * t2) / (1 + 1.1 * t2)), dy = y - (this.VZ * k2 * j * t2 - 4.9 * t2 * t2), dl = Math.hypot(dr, dy) || 1;
      r += (dr / dl) * tipL; y += (dy / dl) * tipL;
    }
    const cx = Math.cos(a), cz = Math.sin(a), vr = this.VR * jr / (g * g), P = this._tp;
    P.x = this.c0.x + cx * r; P.z = this.c0.z + cz * r; P.y = y;
    P.vx = cx * vr; P.vz = cz * vr; P.vy = this.VZ * j - 9.8 * t; P.tip = tip;
    return P;
  }

  _rimDrop(t, time) {
    const P = this._tip(t, 0.6);
    if (!P) return;
    const out = 0.3 + rnd$1() * 1.1, c = 0.92 + rnd$1() * 0.08, x = P.x, z = P.z;
    const cx = P.vx, cz = P.vz, vl = Math.hypot(cx, cz) || 1;
    const size = P.tip ? 0.003 + 0.005 * Math.pow(rnd$1(), 1.5) : rnd$1() < 0.07 ? 0.006 + 0.004 * rnd$1() : 0.001 + 0.005 * Math.pow(rnd$1(), 1.8);
    this.fx.spray.spawn(x, waveHeight(x, z, time) + P.y, z,
      P.vx + (cx / vl) * out + (rnd$1() - 0.5) * 0.8, P.vy * (0.9 + 0.2 * rnd$1()) + (rnd$1() - 0.5) * 0.8, P.vz + (cz / vl) * out + (rnd$1() - 0.5) * 0.8,
      3, size, c, c, c);
  }

  _jetDrop(tj, time) {
    const V = this.jetV;
    const h = V * tj - 4.9 * tj * tj;
    if (h < 0.1) return;
    const a = rnd$1() * TAU$5, r = 0.05 + rnd$1() * 0.1;
    const x = this.c.x + Math.cos(a) * r, z = this.c.z + Math.sin(a) * r;
    const side = 0.25 + rnd$1() * 1.1;
    const c = 0.92 + rnd$1() * 0.08;
    this.fx.spray.spawn(x, waveHeight(x, z, time) + h, z,
      Math.cos(a) * side, V - 9.8 * tj + (rnd$1() - 0.2) * 1.4, Math.sin(a) * side,
      2.5, rnd$1() < 0.3 ? 0.005 + 0.01 * rnd$1() : 0.001 + 0.004 * Math.pow(rnd$1(), 1.6), c, c, c);
  }

  _mist(t, time) {
    const P = this._tip(t, 0.7);
    if (!P) return;
    const x = P.x + (rnd$1() - 0.5) * 0.06, z = P.z + (rnd$1() - 0.5) * 0.06, c = 0.93 + rnd$1() * 0.06;
    const th = rnd$1() * TAU$5, ph = Math.acos(2 * rnd$1() - 1), sp = 0.4 + 1.6 * rnd$1();
    this.fx.spray.spawn(x, waveHeight(x, z, time) + P.y, z,
      P.vx * 0.8 + Math.sin(ph) * Math.cos(th) * sp, P.vy * 0.8 + Math.cos(ph) * sp, P.vz * 0.8 + Math.sin(ph) * Math.sin(th) * sp,
      0.35 + 0.45 * rnd$1(), 0.0001 + 0.0004 * rnd$1(), c, c, c);
  }

  _bubble(time) {
    const a = rnd$1() * TAU$5, r = Math.pow(rnd$1(), 0.7) * (0.3 + 0.4 * this.rim);
    const x = this.c.x + Math.cos(a) * r, z = this.c.z + Math.sin(a) * r;
    const big = rnd$1() < 0.07;
    this.fx._bubble(x, waveHeight(x, z, time) - 0.12 - rnd$1() * 0.6, z,
      (rnd$1() - 0.5) * 0.3, 0.3 + rnd$1() * 0.5, (rnd$1() - 0.5) * 0.3,
      2 + rnd$1() * 2.5, big ? 0.016 + rnd$1() * 0.024 : 0.002 + Math.pow(rnd$1(), 2) * 0.01, big);
  }
}

const rnd$1 = Math.random;
const CRUST = [[0.46, 0.5, 0.4], [0.55, 0.56, 0.44], [0.62, 0.53, 0.33], [0.7, 0.6, 0.4], [0.5, 0.47, 0.38]];

function makeParticulate() {
  const nMid = 1700, nFar = 1500, n = nMid + nFar;
  const pos = new Float32Array(n * 3), seed = new Float32Array(n * 4);
  let s = 12345;
  const rng = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  for (let i = 0; i < n; i++) {
    const mid = i < nMid, hs = mid ? 9 : 22;
    pos[i * 3] = (rng() - 0.5) * 2 * hs;
    pos[i * 3 + 1] = (rng() - 0.5) * 2 * hs;
    pos[i * 3 + 2] = (rng() - 0.5) * 2 * hs;
    seed[i * 4] = rng();
    seed[i * 4 + 1] = mid ? 2.5 + 5.5 * Math.pow(rng(), 2) : 7 + 13 * Math.pow(rng(), 2);
    seed[i * 4 + 2] = hs;
    seed[i * 4 + 3] = mid ? 0.3 + 0.35 * rng() : 0.25 + 0.3 * rng();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
  const mat = new THREE.ShaderMaterial({
    uniforms: Object.assign({ uDrift: { value: new THREE.Vector3() }, uInAir: { value: 0 } }, FOG, LIGHT),
    vertexShader: PART_VERT, fragmentShader: PART_FRAG,
    transparent: true, depthWrite: false, depthTest: false, blending: THREE.NormalBlending,
  });
  const pts = new THREE.Points(g, mat);
  pts.frustumCulled = false;
  pts.renderOrder = 5;
  pts.userData.fxUnder = true;
  pts.visible = false;
  pts.onBeforeRender = fxBeforeRender;
  FX_SCENE.add(pts);
  return pts;
}
const MOTES_PER = 72;
const MOTE_VERT$1 = `
uniform vec4 uArchP[3];
uniform vec4 uArchQ[3];
uniform float uArchK;
uniform float uPx;
attribute vec4 aSeed;
varying float vA;
varying vec3 vCol;
${FXV_GLSL}
${SUNSH_GLSL}
float archFade(vec4 Q, float h) { return smoothstep(-0.5, 0.35, h) * (1.0 - smoothstep(Q.y * 0.45, Q.y, h)); }
void main() {
  int i = int(aSeed.x + 0.5);
  vec4 P = uArchP[i], Q = uArchQ[i];
  vec3 S = normalize(uSunW);
  vec3 e1 = normalize(cross(S, vec3(0.0, 0.0, 1.0))), e2 = cross(S, e1);
  float r1 = aSeed.y, r2 = aSeed.z, r3 = aSeed.w;
  float H = Q.y * 0.55, h = 0.25 + mod(r1 * H - uTime * (0.03 + 0.05 * r3), H);
  float rho = P.w * 1.05 * sqrt(r2), th = r3 * 6.2831853 + uTime * (0.05 + 0.08 * r1) * (r2 < 0.5 ? 1.0 : -1.0);
  vec3 A = P.xyz + S * ((Q.x + h - P.y) / max(S.y, 0.2));
  vec3 p = A + (e1 * cos(th) + e2 * sin(th)) * rho + vec3(sin(uTime * 0.21 + r1 * 30.0), 0.0, cos(uTime * 0.17 + r2 * 40.0)) * 0.12;
  float vis = fxFog(p, 0.0);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float d = max(-mv.z, 0.01);
  vZ = d;
  gl_Position = projectionMatrix * mv;
  float lit = exp(-1.8 * rho * rho / (P.w * P.w)) * archFade(Q, h) * smoothstep(0.0, 1.0, h / 0.6) * sunLit(p);
  float tw = 0.55 + 0.45 * sin(uTime * (1.3 + 2.1 * r2) + r1 * 50.0);
  vA = Q.z * lit * tw * vis * uArchK * uLight * smoothstep(0.8, 2.0, d) * step(uCamRel, -0.02);
  vCol = vec3(0.9, 1.0, 0.84) * (1.6 + 1.4 * r3);
  float px = clamp(0.03 * uPx / d, 1.6, 5.0);
  gl_PointSize = vA > 0.004 ? px + 1.5 : 0.0;
}
`;
const MOTE_FRAG$1 = `
varying float vA;
varying vec3 vCol;
${FXF_GLSL}
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float r = length(c) * 2.0;
  float a = (exp(-r * r * 5.0) + 0.25 * exp(-r * r * 1.2)) * (1.0 - smoothstep(0.8, 1.0, r)) * vA;
  if (a < 0.003) discard;
  gl_FragColor = vec4(vCol * vT, a * fxSoft(0.3, 0.0));
}
`;
function makeArchMotes() {
  const n = MOTES_PER * 3, pos = new Float32Array(n * 3), seed = new Float32Array(n * 4);
  let s = 90210;
  const rng = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  for (let i = 0; i < n; i++) { seed[i * 4] = Math.floor(i / MOTES_PER); seed[i * 4 + 1] = rng(); seed[i * 4 + 2] = rng(); seed[i * 4 + 3] = rng(); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
  const mat = new THREE.ShaderMaterial({
    uniforms: Object.assign({ uInAir: { value: 0 } }, FOG, LIGHT, ARCH, SUNSH),
    vertexShader: MOTE_VERT$1, fragmentShader: MOTE_FRAG$1,
    transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
  });
  Object.defineProperty(mat, 'visible', { get: () => ARCH.uArchK.value > 0.001, set() {} });
  const pts = new THREE.Points(g, mat);
  pts.frustumCulled = false;
  pts.renderOrder = 5;
  pts.userData.fxUnder = true;
  pts.visible = false;
  pts.onBeforeRender = fxBeforeRender;
  FX_SCENE.add(pts);
  return pts;
}
const SAND = [[0.86, 0.80, 0.66], [0.72, 0.64, 0.50], [0.95, 0.93, 0.88], [0.42, 0.37, 0.30], [0.62, 0.52, 0.40]];
const DRIFT = 0.075;
const DRIFT_X = 0.96, DRIFT_Z = 0.28;
const EXH_DUR = 1.0;
const BUBBLES_MAX = 17000;

class FX {
  constructor(scene, { particles = 1 } = {}) {
    this.scene = scene;
    const puff = puffTexture();
    this.bubbles = new Pool(scene, BUBBLES_MAX, { vert: VERT$1, frag: BUBBLE_FRAG, blending: THREE.NormalBlending, order: 7, dynSize: true, maxPx: 64, near: 1.0, uniforms: { uVeil: { value: 1 } } });
    this.bubbles.wake = new Float32Array(BUBBLES_MAX);
    this.bubbles.stick = new Float32Array(BUBBLES_MAX);
    this._bq = new Float32Array(64 * 4);
    this._bqN = 0;
    this.silts = new Pool(scene, 4600, { vert: SILT_VERT, frag: SILT_FRAG, blending: THREE.NormalBlending, order: 6, uniforms: { uPuff: { value: puff } } });
    this.flakes = new Pool(scene, 2000, { vert: VERT$1, frag: FLAKE_FRAG, blending: THREE.NormalBlending, order: 6, dynSeed: true });
    this.sand = new Pool(scene, 5000, { vert: GRAIN_VERT, frag: GRAIN_FRAG, blending: THREE.NormalBlending, order: 6, velAttr: true });
    this.sparks = new Pool(scene, 1400, { vert: VERT$1, frag: SPARK_FRAG$1, order: 8 });
    this.glow = new Pool(scene, 900, { vert: VERT$1, frag: GLOW_FRAG, order: 8 });
    this.spray = new Pool(scene, 16000, { vert: SPRAY_VERT, frag: SPRAY_FRAG, blending: THREE.NormalBlending, order: 8, velAttr: true, inAir: true, uniforms: DOFU });
    for (const p of [this.bubbles, this.sand, this.silts, this.flakes, this.spray]) p.keep = Math.min(1, Math.max(0.2, +particles || 1));
    this.spray.mat.premultipliedAlpha = true;
    this._sq = new Float32Array(48 * 4);
    this._sqN = 0;
    this.hull = { on: false, p: new THREE.Vector3(), n: new THREE.Vector3(1, 0, 0) };
    this.part = makeParticulate();
    this.archMotes = ARCH.uArchK.value > 0.001 ? makeArchMotes() : null;
    this._drift = new THREE.Vector2();
    this.splash = new Splash(scene, this);
    this.splashB = [new Splash(scene, this), new Splash(scene, this)];
    this.splashL = new Splash(scene, this);
    this.rubble = new Chunks(scene, 72, this);
    this.current = new THREE.Vector3(0.05, 0.0, 0.03);
    this._v = new THREE.Vector3();
    this._r = new THREE.Vector3();
    this._u = new THREE.Vector3();
    this._sun = null;
    this._hemi = null;
    this._look = 0;
    this._t = 0; this._T = 0;
    this._cx = 0; this._cz = 0;
    this._fx = 0; this._fz = 0;
    this.exh = [];
    for (let k = 0; k < 4; k++) this.exh.push({ on: false, t: 0, ref: null, p: new THREE.Vector3(), nS: 0, nB: 0, dS: 0, dB: 0 });

    this._stepB = (i, h) => {
      const B = this.bubbles, P = B.pos, V = B.vel, i3 = i * 3, t = this._t;
      const y = P[i3 + 1], s = B.size[i];
      V[i3] += (this._cx - V[i3]) * 1.5 * h + Math.sin(t * 9 + i) * 0.4 * h;
      V[i3 + 2] += (this._cz - V[i3 + 2]) * 1.5 * h + Math.cos(t * 8 + i * 1.3) * 0.4 * h;
      const vt = s < 0.0025 ? 0.06 + 90 * s : Math.min(0.26 + s * 11, 0.85);
      const wk = B.wake[i];
      V[i3 + 1] += (vt + wk - V[i3 + 1]) * Math.min(1, 15 * h);
      if (B.stick[i] > 0) B.stick[i] -= h;
      else if (wk !== 0) B.wake[i] = Math.abs(wk) < 1e-3 ? 0 : wk * Math.exp(-h / 0.6);
      let sz = s;
      if (s > 0.012 && B.seed[i] >= 1 && B.seed[i] < 2 && this._bqN < 64 && rnd$1() < 0.5 * h) {
        sz = s * 0.79;
        const q = this._bqN++ * 4;
        this._bq[q] = P[i3]; this._bq[q + 1] = y; this._bq[q + 2] = P[i3 + 2]; this._bq[q + 3] = sz;
      }
      B.size[i] = sz * (1 + (0.33 / (Math.max(0.3, -y) + 10)) * V[i3 + 1] * h);
      if (y > -0.75 && y > waveHeight(P[i3], P[i3 + 2], this._T) - 0.06 - s * 0.5) B.life[i] = 0;
    };
    this._stepSP = (i, h) => {
      const S = this.spray, P = S.pos, V = S.vel, i3 = i * 3;
      V[i3 + 1] -= 9.8 * h;
      if (this.hull.on) {
        const Hh = this.hull, dd = (P[i3] - Hh.p.x) * Hh.n.x + (P[i3 + 2] - Hh.p.z) * Hh.n.z;
        if (dd < 0) {
          const vn = V[i3] * Hh.n.x + V[i3 + 2] * Hh.n.z;
          if (vn < 0) { V[i3] -= 1.6 * vn * Hh.n.x; V[i3 + 2] -= 1.6 * vn * Hh.n.z; }
          P[i3] -= dd * Hh.n.x; P[i3 + 2] -= dd * Hh.n.z;
        }
      }
      const k = 1 - (0.35 + 0.004 / (S.size[i] + 0.002)) * h;
      V[i3] *= k; V[i3 + 2] *= k;
      if (V[i3 + 1] < 0 && P[i3 + 1] < 0.6) {
        const sy = waveHeight(P[i3], P[i3 + 2], this._T);
        if (P[i3 + 1] < sy + 0.01) {
          S.life[i] = 0;
          if (S.size[i] > 0.007 && S.rest[i] === 0 && this._sqN < 48) {
            const q = this._sqN++ * 4;
            this._sq[q] = P[i3]; this._sq[q + 1] = sy; this._sq[q + 2] = P[i3 + 2]; this._sq[q + 3] = S.size[i];
          }
        }
      }
    };
    this._stepS = (i, h) => {
      const S = this.silts, P = S.pos, V = S.vel, i3 = i * 3, t = this._t;
      const kind = Math.floor(S.seed[i]);
      const x = P[i3], y = P[i3 + 1], z = P[i3 + 2];
      if (kind === 7) {
        const dx = V[i3] - this._fx, dy = V[i3 + 1] + 0.015, dz = V[i3 + 2] - this._fz;
        const kd = Math.min(1, (2.2 + 7 * Math.hypot(dx, dy, dz)) * h), ph = S.seed[i] * 40.0;
        V[i3] -= (dx - Math.sin(t * 0.9 + ph + y * 7.0) * 0.012) * kd;
        V[i3 + 1] -= dy * kd;
        V[i3 + 2] -= (dz - Math.cos(t * 0.8 + ph * 0.7 + x * 7.0) * 0.012) * kd;
        const g = S.ground[i];
        if (y < g + 0.005) { P[i3 + 1] = g + 0.005; if (V[i3 + 1] < 0) V[i3 + 1] = 0; }
        return;
      }
      if (kind === 2) {
        const ka = 1.2 * h;
        V[i3] += (this._cx - V[i3]) * ka;
        V[i3 + 1] += (0.45 - V[i3 + 1]) * ka;
        V[i3 + 2] += (this._cz - V[i3 + 2]) * ka;
        if (y > -0.8 && y > waveHeight(x, z, this._T) - 0.15) S.life[i] = 0;
        return;
      }
      const k = (kind === 4 ? 1.0 : kind === 5 ? 1.6 : kind === 6 ? 2.4 : 0.8) * h;
      const age = 1 - S.life[i] / S.maxLife[i];
      const ph = S.seed[i] * 40.0;
      const lift = kind === 3 ? 0.012 : kind === 4 ? 0.02 : kind === 5 ? -8e-3 - 0.09 * (1 - age) * (1 - age) : kind === 6 ? 0.025 * (1 - age) * (1 - age) - 0.01 * age : 0.05;
      V[i3] += (this._fx + Math.sin(t * 0.9 + ph + y * 7.0) * 0.03 - V[i3]) * k;
      V[i3 + 1] += (lift * (1 - age) + Math.sin(t * 0.6 + ph * 1.3 + z * 6.0) * (kind === 6 ? 0.003 : 0.012) - V[i3 + 1]) * k;
      V[i3 + 2] += (this._fz + Math.cos(t * 0.8 + ph * 0.7 + x * 7.0) * 0.03 - V[i3 + 2]) * k;
      const g = S.ground[i] + (kind === 6 ? 0.01 : 0.005);
      if (y < g) { P[i3 + 1] = g; if (V[i3 + 1] < 0) V[i3 + 1] *= -0.3; }
    };
    this._stepF = (i, h) => {
      const F = this.flakes, i3 = i * 3;
      if (F.rest[i]) return;
      const ph = F.seed[i] * 2.4;
      F.vel[i3 + 1] -= 0.4 * h;
      const k = 1 - 1.8 * h;
      F.vel[i3] = F.vel[i3] * k + (this._cx + Math.cos(ph) * 0.14) * 1.8 * h;
      F.vel[i3 + 1] *= k;
      F.vel[i3 + 2] = F.vel[i3 + 2] * k + (this._cz + Math.sin(ph * 0.7) * 0.14) * 1.8 * h;
      F.seed[i] += h * (1.5 + (i % 5) * 0.6);
      if (F.pos[i3 + 1] < F.ground[i]) {
        F.pos[i3 + 1] = F.ground[i];
        F.vel[i3] = F.vel[i3 + 1] = F.vel[i3 + 2] = 0;
        F.rest[i] = 1;
        F.life[i] = Math.min(F.life[i], 2.5 + Math.random() * 2.0);
        F.maxLife[i] = 15;
      }
    };
    this._stepR = (i, h) => {
      const R = this.sand, V = R.vel, i3 = i * 3, st = R.rest[i];
      if (st === 1) return;
      if (st === 2) {
        const k = 1.2 * h;
        V[i3] += (this._cx - V[i3]) * k;
        V[i3 + 1] += (0.01 - V[i3 + 1]) * k;
        V[i3 + 2] += (this._cz - V[i3 + 2]) * k;
        return;
      }
      const k = 1 - 3.0 * h;
      let g = 0.95, wx = 0, wz = 0;
      if (R.seed[i] >= 3 && R.seed[i] < 4) {
        g = 0.95 * Math.min(1.15, Math.max(0.38, R.size[i] / 0.0016));
        const ph = R.seed[i] * 97.0, t = this._t;
        wx = Math.sin(t * 1.3 + ph) * 0.04; wz = Math.cos(t * 1.1 + ph * 0.7) * 0.04;
      }
      V[i3] = V[i3] * k + (this._cx + wx) * 3.0 * h;
      V[i3 + 1] = (V[i3 + 1] - g * h) * k;
      V[i3 + 2] = V[i3 + 2] * k + (this._cz + wz) * 3.0 * h;
      if (R.pos[i3 + 1] < R.ground[i]) {
        R.pos[i3 + 1] = R.ground[i];
        if (V[i3 + 1] < -0.1 && Math.floor(R.seed[i]) === 2) { V[i3 + 1] *= -0.3; V[i3] *= 0.45; V[i3 + 2] *= 0.45; return; }
        V[i3] = V[i3 + 1] = V[i3 + 2] = 0;
        R.rest[i] = 1;
        R.life[i] = Math.min(R.life[i], 1.2 + Math.random() * 1.5);
        R.maxLife[i] = 14;
      }
    };
    this._stepP = (i, h) => {
      const P = this.sparks, V = P.vel, i3 = i * 3;
      V[i3 + 1] -= 0.2 * h;
      const k = 1 - 2.0 * h;
      V[i3] *= k; V[i3 + 1] *= k; V[i3 + 2] *= k;
    };
  }

  _smallSize(lo, hi) { const r = rnd$1(); return lo + r * r * (hi - lo); }
  _bubble(x, y, z, vx, vy, vz, life, size, cap) {
    const top = waveHeight(x, z, U.uTime.value) - 0.07 - size;
    if (y > top) y = Math.max(top - (y - top), top - 1.2);
    const i = this.bubbles.spawn(x, y, z, vx, vy, vz, life, size);
    if (cap) this.bubbles.seed[i] += 1;
    this.bubbles.wake[i] = 0;
    this.bubbles.stick[i] = 0;
    return i;
  }

  exhale(camera, strength = 1) {
    const f = this._v.set(0, 0, -1).applyQuaternion(camera.quaternion);
    const r = this._r.set(1, 0, 0).applyQuaternion(camera.quaternion);
    const u = this._u.set(0, 1, 0).applyQuaternion(camera.quaternion);
    const n = Math.floor(44 * strength);
    for (let i = 0; i < n; i++) {
      const side = rnd$1() < 0.5 ? -1 : 1;
      const o = 0.2 + rnd$1() * 0.14;
      const cap = i < 2;
      this._bubble(
        camera.position.x + f.x * 0.4 + r.x * side * o - u.x * 0.3 + (rnd$1() - 0.5) * 0.06,
        camera.position.y + f.y * 0.4 + r.y * side * o - u.y * 0.3,
        camera.position.z + f.z * 0.4 + r.z * side * o - u.z * 0.3 + (rnd$1() - 0.5) * 0.06,
        r.x * side * 0.2 + (rnd$1() - 0.5) * 0.12, 0.4 + rnd$1() * 0.4, r.z * side * 0.2 + (rnd$1() - 0.5) * 0.12,
        3.5 + rnd$1() * 2.5, cap ? 0.018 + rnd$1() * 0.012 : this._smallSize(0.0025, 0.012), cap);
    }
  }

  exhaleFrom(p, strength = 1) {
    let e = this.exh[0];
    for (let k = 0; k < this.exh.length; k++) {
      const x = this.exh[k];
      if (!x.on) { e = x; break; }
      if (x.t > e.t) e = x;
    }
    e.on = true;
    e.t = 0;
    e.ref = p;
    e.p.copy(p);
    e.nS = Math.round((85 + rnd$1() * 50) * strength);
    e.nB = Math.round((2 + rnd$1() * 2.5) * strength);
    e.dS = 0;
    e.dB = 0;
  }

  _exhales(dt) {
    for (let k = 0; k < this.exh.length; k++) {
      const e = this.exh[k];
      if (!e.on) continue;
      e.t += dt;
      if (e.ref && e.ref.distanceToSquared(e.p) < 2.25) e.p.copy(e.ref);
      const src = e.p;
      const u = Math.min(1, e.t / EXH_DUR);
      const wS = Math.floor(e.nS * (1 - (1 - u) * (1 - u)));
      const wB = Math.floor(e.nB * Math.min(1, e.t / 0.35));
      for (; e.dB < wB; e.dB++) {
        this._bubble(src.x + (rnd$1() - 0.5) * 0.04, src.y + rnd$1() * 0.03, src.z + (rnd$1() - 0.5) * 0.04,
          (rnd$1() - 0.5) * 0.12, 0.3 + rnd$1() * 0.2, (rnd$1() - 0.5) * 0.12, 4 + rnd$1() * 2, 0.02 + rnd$1() * 0.03, true);
      }
      for (; e.dS < wS; e.dS++) {
        this._bubble(src.x + (rnd$1() - 0.5) * 0.06, src.y + rnd$1() * 0.04, src.z + (rnd$1() - 0.5) * 0.06,
          (rnd$1() - 0.5) * 0.32, 0.25 + rnd$1() * 0.35, (rnd$1() - 0.5) * 0.32, 3.5 + rnd$1() * 2.5, this._smallSize(0.0022, 0.009), false);
      }
      if (u >= 1) { e.on = false; e.ref = null; }
    }
  }

  setHull(p, n) {
    if (!p || !n) { this.hull.on = false; return; }
    this.hull.p.copy(p); this.hull.n.set(n.x, 0, n.z).normalize(); this.hull.on = true;
  }
  setDof(focus, aperture, maxPx = 16, near = 16, farK = 1, far = 16) { DOFU.uDof.value.set(focus, aperture, maxPx); DOFU.uDofK.value.set(near, farK, far); }
  splashAt(p, strength = 1, opts = null) {
    const s = Math.max(0.5, Math.min(1.6, strength));
    const time = U.uTime.value;
    const sy = waveHeight(p.x, p.z, time);
    this.splash.start(p, s, sy, opts);
    const sp = this.splash, R0 = sp.R0;
    const nf = Math.round(1400 * s);
    for (let i = 0; i < nf; i++) {
      const th = rnd$1() * TAU$5, r = R0 * (0.8 + 0.4 * rnd$1()), j = sp._j(th);
      const up = (2.0 + Math.pow(rnd$1(), 1.4) * 6.5) * j * (0.75 + 0.25 * s);
      const out = (0.8 + Math.pow(rnd$1(), 0.8) * 3.4) * sp._o(th);
      const c = 0.92 + rnd$1() * 0.08;
      this.spray.spawn(p.x + Math.cos(th) * r, sy + 0.04 + rnd$1() * 0.1, p.z + Math.sin(th) * r,
        Math.cos(th) * out, up, Math.sin(th) * out, 3, rnd$1() < 0.06 ? 0.004 + 0.005 * rnd$1() : 0.0005 + 0.0035 * Math.pow(rnd$1(), 2.2), c, c, c);
    }
  }
  splashSmall(p, u = 1, i = 0) {
    const sp = this.splashB[i ? 1 : 0];
    sp.start(p, 0.3, waveHeight(p.x, p.z, U.uTime.value), { small: true, U: u });
    return sp;
  }
  splashLegs(p, strength = 0.6, opts = null) {
    const sp = this.splashL;
    sp.start(p, Math.max(0.5, Math.min(1.6, strength)), waveHeight(p.x, p.z, U.uTime.value), Object.assign({}, opts, { brief: true }));
    return sp;
  }
  _airCluster(x, y, z, n, life) {
    for (let i = 0; i < n; i++) {
      const th = rnd$1() * TAU$5, ph = Math.acos(2 * rnd$1() - 1), r = 0.15 * Math.cbrt(rnd$1());
      const j = this._bubble(x + Math.sin(ph) * Math.cos(th) * r, y + Math.cos(ph) * r, z + Math.sin(ph) * Math.sin(th) * r,
        (rnd$1() - 0.5) * 0.1, 0.1 + rnd$1() * 0.1, (rnd$1() - 0.5) * 0.1, life * (0.8 + 0.4 * rnd$1()), 0.0005 + 0.0015 * rnd$1(), false);
      this.bubbles.seed[j] = 2 + (this.bubbles.seed[j] % 1);
    }
  }
  airTrail(x, y, z, top, n, w = 0) {
    const H = Math.max(0.02, top - y);
    for (let i = 0; i < n; i++) {
      const hh = rnd$1() * H, th = rnd$1() * TAU$5, rad = Math.sqrt(rnd$1()) * 0.14, fine = rnd$1() < 0.8;
      const j = this._bubble(x + Math.cos(th) * rad, y + hh, z + Math.sin(th) * rad, (rnd$1() - 0.5) * 0.12, 0.08 + rnd$1() * 0.12, (rnd$1() - 0.5) * 0.12,
        1.5 + rnd$1() * 2.0, fine ? 0.0005 + 0.0015 * rnd$1() : 0.003 * Math.pow(4, Math.pow(rnd$1(), 1.8)), false);
      if (fine) this.bubbles.seed[j] = 2 + (this.bubbles.seed[j] % 1);
      if (w > 0 && rnd$1() < 0.3) this.bubbles.wake[j] = -(0.4 + 0.4 * rnd$1()) * w;
    }
  }
  entrain(p, w, n, r = 0.25, trail = 0.6, lens = null, share = 0) {
    const la = lens ? Math.atan2(lens.z, lens.x) : 0;
    for (let i = 0; i < n; i++) {
      const toL = lens !== null && rnd$1() < share, far = !toL && rnd$1() < 0.08;
      const th = toL ? la + (rnd$1() - 0.5) * 1.6 : rnd$1() * TAU$5, rad = toL ? 0.6 + rnd$1() : far ? r + rnd$1() * 1.1 : r * Math.sqrt(rnd$1()), hh = rnd$1() * trail;
      const q = rnd$1(), cap = q > 0.955, fine = q < 0.3;
      const size = cap ? 0.015 + rnd$1() * 0.02 : fine ? 0.0005 + rnd$1() * 0.0015 : 0.0025 * Math.pow(10, Math.pow(rnd$1(), 1.3));
      const out = (toL ? 0.1 + 0.2 * rnd$1() : far ? 0.4 * rnd$1() : 0.15 * rnd$1());
      const j = this._bubble(p.x + Math.cos(th) * rad, p.y + hh, p.z + Math.sin(th) * rad, Math.cos(th) * out, 0, Math.sin(th) * out,
        (fine ? 2.5 : 4) + rnd$1() * 3, size, cap);
      if (fine) this.bubbles.seed[j] = 2 + (this.bubbles.seed[j] % 1);
      if (w > 0) {
        const near = !far && !toL && rnd$1() < 0.5;
        this.bubbles.wake[j] = near ? -w * (0.85 + 0.15 * rnd$1()) : toL ? -w * (0.1 + 0.2 * rnd$1()) : -w * (0.5 + 0.45 * rnd$1()) * (1 - (0.5 * hh) / Math.max(0.01, trail)) * (far ? 0.5 : 1);
        if (near) this.bubbles.stick[j] = 0.1 + 0.5 * rnd$1();
      }
    }
  }
  cling(p, w, n, r = 0.08, lens = null, share = 0) {
    const la = lens ? Math.atan2(lens.z, lens.x) : 0;
    for (let i = 0; i < n; i++) {
      if (lens !== null && rnd$1() < share) {
        const a = la + (rnd$1() - 0.5) * 1.6, rd = 0.5 + 0.9 * rnd$1(), o = 0.1 + 0.2 * rnd$1();
        const j = this._bubble(p.x + Math.cos(a) * rd, p.y + (rnd$1() - 0.5) * 0.4, p.z + Math.sin(a) * rd, Math.cos(a) * o, -0.2 * w, Math.sin(a) * o,
          3 + rnd$1() * 2, this._smallSize(0.003, 0.012), false);
        this.bubbles.wake[j] = -0.2 * w;
        continue;
      }
      const th = rnd$1() * TAU$5, ph = Math.acos(2 * rnd$1() - 1), rad = r * (0.6 + 0.4 * rnd$1());
      const j = this._bubble(p.x + Math.sin(ph) * Math.cos(th) * rad, p.y + Math.cos(ph) * rad, p.z + Math.sin(ph) * Math.sin(th) * rad,
        0, -w, 0, 3 + rnd$1() * 2, this._smallSize(0.003, 0.012), false);
      this.bubbles.wake[j] = -w;
      this.bubbles.stick[j] = 0.15 + 0.8 * rnd$1() * rnd$1();
    }
  }

  burstAt(p, strength = 1, opts = null) {
    const s = strength, T = U.uTime.value, w = opts && Number.isFinite(opts.w) ? Math.max(0, opts.w) : 0;
    const y0 = p.y + 0.22 - 0.25, H = Math.max(0.05, waveHeight(p.x, p.z, T) - 0.08 - y0);
    const n = Math.floor(900 * s);
    for (let i = 0; i < n; i++) {
      const hh = Math.pow(rnd$1(), 0.8) * H, th = rnd$1() * TAU$5, rad = Math.sqrt(rnd$1()) * (0.12 + 0.25 * hh);
      const r = rnd$1(), cap = r > 0.985, fine = r < 0.4;
      const size = cap ? 0.02 + rnd$1() * 0.02 : fine ? 0.0005 + rnd$1() * 0.0015 : 0.003 * Math.pow(6.5, Math.pow(rnd$1(), 1.3));
      const j = this._bubble(p.x + Math.cos(th) * rad, y0 + hh, p.z + Math.sin(th) * rad,
        (rnd$1() - 0.5) * 0.3, 0.1 + rnd$1() * 0.2, (rnd$1() - 0.5) * 0.3, 1.6 + rnd$1() * 2.6, size, cap);
      if (fine) this.bubbles.seed[j] = 2 + (this.bubbles.seed[j] % 1);
      if (w > 0 && rnd$1() < 0.4) this.bubbles.wake[j] = -(0.5 + 0.4 * rnd$1()) * w;
    }
    const nc = Math.round(8 * s);
    for (let i = 0; i < nc; i++) {
      const hh = rnd$1() * H, th = rnd$1() * TAU$5, rad = Math.sqrt(rnd$1()) * (0.12 + 0.25 * hh);
      this._airCluster(p.x + Math.cos(th) * rad, y0 + hh, p.z + Math.sin(th) * rad, 40, 1.6 + rnd$1() * 1.4);
    }
  }

  bubbleBurst(camera, strength = 1, opts = null) {
    const f = this._v.set(0, 0, -1).applyQuaternion(camera.quaternion);
    const p = camera.position, T = U.uTime.value, minY = opts && Number.isFinite(opts.minY) ? opts.minY : -Infinity;
    const n = Math.floor(700 * strength);
    for (let i = 0; i < n; i++) {
      const th = rnd$1() * TAU$5, ph = Math.acos(2 * rnd$1() - 1), r = 0.25 + Math.pow(rnd$1(), 0.6) * 1.8;
      const cap = rnd$1() < 0.05;
      const bx = p.x + Math.sin(ph) * Math.cos(th) * r + f.x * 0.6, bz = p.z + Math.sin(ph) * Math.sin(th) * r + f.z * 0.6;
      let by = p.y + Math.cos(ph) * r * 0.8 + f.y * 0.6 - 0.2;
      if (by < minY) by = minY + rnd$1() * Math.max(0.05, waveHeight(bx, bz, T) - 0.08 - minY);
      this._bubble(
        bx,
        by,
        bz,
        (rnd$1() - 0.5) * 0.6, 0.1 + rnd$1() * 0.2, (rnd$1() - 0.5) * 0.6,
        1.6 + rnd$1() * 2.4, cap ? 0.018 + rnd$1() * 0.03 : this._smallSize(0.002, 0.013), cap);
    }
    const nc = Math.round(6 * strength);
    for (let i = 0; i < nc; i++) {
      const th = rnd$1() * TAU$5, r = 1.4 + rnd$1() * 1.4;
      const x = p.x + Math.cos(th) * r + f.x * 1.2, z = p.z + Math.sin(th) * r + f.z * 1.2;
      this._airCluster(x, Math.max(minY, Math.min(p.y - 0.3 - rnd$1() * 1.2, waveHeight(x, z, T) - 0.3)), z, 40, 1.2 + rnd$1() * 0.8);
    }
  }

  breach(camera, strength = 1) {
    const p = camera.position, T = U.uTime.value;
    const n = Math.round(60 * strength);
    for (let i = 0; i < n; i++) {
      const th = rnd$1() * TAU$5, r = 0.35 + rnd$1() * 0.6;
      const x = p.x + Math.cos(th) * r, z = p.z + Math.sin(th) * r;
      const out = 0.2 + rnd$1() * 0.7, up = 0.6 + Math.pow(rnd$1(), 1.5) * 2.2;
      const c = 0.9 + rnd$1() * 0.1;
      this.spray.spawn(x, waveHeight(x, z, T) + 0.02 + rnd$1() * 0.1, z, Math.cos(th) * out, up, Math.sin(th) * out,
        2, 0.002 + 0.01 * Math.pow(rnd$1(), 2.5), c, c, c);
    }
  }

  bubbleTrail(camera, dt) {
    const p = camera.position;
    const n = Math.floor(150 * dt + rnd$1());
    for (let i = 0; i < n; i++) {
      const th = rnd$1() * TAU$5, r = 0.3 + rnd$1() * 0.9;
      this._bubble(p.x + Math.cos(th) * r, p.y + (rnd$1() - 0.2) * 1.2, p.z + Math.sin(th) * r,
        (rnd$1() - 0.5) * 0.4, 0.5 + rnd$1() * 0.8, (rnd$1() - 0.5) * 0.4, 1.5 + rnd$1() * 2, this._smallSize(0.0025, 0.012), false);
    }
  }

  bubbleColumn(x, y, z, n = 1) {
    for (let i = 0; i < n; i++) this._bubble(x + (rnd$1() - 0.5) * 0.1, y, z + (rnd$1() - 0.5) * 0.1, 0, 0.4 + rnd$1() * 0.4, 0, 6, this._smallSize(0.0025, 0.008), false);
  }

  silt(pos, n, { spread = 0.12, color = [0.60, 0.55, 0.45], up = 0.14, life = 3.4, size = 0.03, push = null, ground = -1e9, inner = 0, billow = false, sink = false, cloud = false } = {}) {
    const wisp = ground > -1e8 && !billow && !sink && !cloud;
    if (wisp) { size = Math.min(size, 0.032) * 0.85; life = Math.min(life, 2.3); up = Math.min(up, 0.07); }
    if (ground < -1e8 && pos.y < -0.5) ground = floorHeight(pos.x, pos.z) - 0.01;
    for (let i = 0; i < n; i++) {
      const th = rnd$1() * TAU$5, r = inner + Math.sqrt(rnd$1()) * Math.max(0, spread - inner);
      const v = 0.04 + rnd$1() * 0.16;
      const c = 0.84 + rnd$1() * 0.32;
      let vx = Math.cos(th) * v, vz = Math.sin(th) * v, vy = up * (0.3 + rnd$1() * 1.1);
      if (push) { vx += push.x * (0.4 + rnd$1()); vy += push.y * (0.4 + rnd$1()); vz += push.z * (0.4 + rnd$1()); }
      if (wisp) vy = Math.min(vy, 0.08);
      const k = this.silts.spawn(pos.x + Math.cos(th) * r, pos.y + rnd$1() * 0.02, pos.z + Math.sin(th) * r, vx, vy, vz,
        life * (0.65 + rnd$1() * 0.7), size * (0.55 + rnd$1() * 0.9), color[0] * c, color[1] * c, color[2] * c, ground);
      if (wisp) this.silts.seed[k] += 3;
      else if (billow) this.silts.seed[k] += 4;
      else if (sink) this.silts.seed[k] += 5;
      else if (cloud) this.silts.seed[k] += 6;
    }
  }

  chips(pos, normal, n, palette, { ground = -1e9, push = null, speed = 1 } = {}) {
    const P = palette || CRUST;
    for (let i = 0; i < n; i++) {
      const c = P[Math.floor(rnd$1() * P.length)];
      const s = (0.2 + rnd$1() * 0.4) * speed;
      let vx = normal.x * s + (rnd$1() - 0.5) * 0.3, vy = normal.y * s + (rnd$1() - 0.5) * 0.2 + 0.12, vz = normal.z * s + (rnd$1() - 0.5) * 0.3;
      if (push) { vx += push.x * 0.5; vy += push.y * 0.5; vz += push.z * 0.5; }
      const sh = 0.85 + rnd$1() * 0.3;
      this.flakes.spawn(pos.x, pos.y, pos.z, vx, vy, vz, 3.0 + rnd$1() * 2.5, 0.003 + 0.017 * Math.pow(rnd$1(), 2.2),
        c[0] * sh, c[1] * sh, c[2] * sh, ground);
      const nc = 2 + (rnd$1() < 0.5 ? 1 : 0);
      for (let k = 0; k < nc; k++) {
        this.flakes.spawn(pos.x, pos.y, pos.z, vx * 0.7 + (rnd$1() - 0.5) * 0.2, vy * 0.8 + rnd$1() * 0.08, vz * 0.7 + (rnd$1() - 0.5) * 0.2,
          2.0 + rnd$1() * 2.0, 0.0025 + rnd$1() * 0.004, c[0] * sh, c[1] * sh, c[2] * sh, ground);
      }
      const R = this.sand, nd = 4 + Math.floor(rnd$1() * 4);
      for (let k = 0; k < nd; k++) {
        R.spawn(pos.x + (rnd$1() - 0.5) * 0.02, pos.y + rnd$1() * 0.01, pos.z + (rnd$1() - 0.5) * 0.02,
          vx * 0.5 + (rnd$1() - 0.5) * 0.12, 0.05 + rnd$1() * 0.1, vz * 0.5 + (rnd$1() - 0.5) * 0.12,
          1.6 + rnd$1() * 1.6, 0.0016 + rnd$1() * 0.0018, c[0] * 1.1, c[1] * 1.1, c[2] * 1.1, ground);
      }
    }
  }

  grains(pos, n, { spread = 0.03, push = null, up = 0.2, ground = -1e9, palette = SAND, size = 0, sed = false, stream = false, scatter = 1 } = {}) {
    for (let i = 0; i < n; i++) {
      const c = palette[Math.floor(rnd$1() * palette.length)];
      const th = rnd$1() * TAU$5, r = Math.sqrt(rnd$1()) * spread;
      const sp = (0.05 + rnd$1() * 0.25) * scatter;
      let vx = Math.cos(th) * sp, vz = Math.sin(th) * sp, vy = up * (0.4 + rnd$1());
      if (push && stream) { vx += push.x; vy += push.y; vz += push.z; }
      else if (push) { vx += push.x * (0.3 + rnd$1() * 0.6); vy += push.y * (0.3 + rnd$1() * 0.6); vz += push.z * (0.3 + rnd$1() * 0.6); }
      const sh = 0.75 + rnd$1() * 0.5;
      const k = this.sand.spawn(pos.x + Math.cos(th) * r, pos.y + rnd$1() * 0.01, pos.z + Math.sin(th) * r, vx, vy, vz,
        2.5 + rnd$1() * 2.5, size > 0 ? size * (0.6 + rnd$1() * 0.8) : 0.0008 + rnd$1() * 0.0016, c[0] * sh, c[1] * sh, c[2] * sh, ground);
      if (sed) this.sand.seed[k] += stream ? 3 : 2;
    }
  }

  chunk(pos, vel, size, color, ground = -1e9) { this.rubble.spawn(pos, vel, size, color, ground); }

  motes(pos, n, spread = 0.1) {
    const R = this.sand;
    for (let i = 0; i < n; i++) {
      const k = R.spawn(pos.x + (rnd$1() - 0.5) * spread, pos.y + rnd$1() * spread * 0.5, pos.z + (rnd$1() - 0.5) * spread,
        (rnd$1() - 0.5) * 0.1, 0.03 + rnd$1() * 0.08, (rnd$1() - 0.5) * 0.1,
        1.2 + rnd$1() * 1.6, 0.0012 + rnd$1() * 0.0012, 0.85, 0.9, 0.82);
      R.rest[k] = 2;
      R.seed[k] += 1;
    }
  }

  kick(pos, n, { color = [0.60, 0.55, 0.45], dir = null, fan = Math.PI, rim = 0.08, oval = 1, speed = 0.3, up = 0.08, life = 1.4, size = 0.04, ground = -1e9 } = {}) {
    const a0 = dir ? Math.atan2(dir.z, dir.x) : 0;
    for (let i = 0; i < n; i++) {
      const f = dir ? (rnd$1() * 2 - 1) * fan : rnd$1() * TAU$5, th = a0 + f;
      const r = rim * oval / Math.hypot(oval * Math.cos(f), Math.sin(f)) * (0.8 + 0.6 * rnd$1());
      const cx = Math.cos(th), cz = Math.sin(th), v = speed * (0.45 + 0.8 * rnd$1()), c = 0.84 + rnd$1() * 0.32;
      const k = this.silts.spawn(pos.x + cx * r, pos.y + rnd$1() * 0.01, pos.z + cz * r, cx * v, up * (0.3 + rnd$1()), cz * v,
        life * (0.7 + rnd$1() * 0.6), size * (0.75 + rnd$1() * 0.25), color[0] * c, color[1] * c, color[2] * c, ground);
      this.silts.seed[k] += 7;
    }
  }

  sparkBurst(pos, n = 40, spread = 0.6, color = [1.0, 0.75, 0.35]) {
    for (let i = 0; i < n; i++) {
      const th = rnd$1() * TAU$5, ph = Math.acos(2 * rnd$1() - 1);
      const s = spread * (0.3 + rnd$1());
      this.sparks.spawn(pos.x, pos.y, pos.z,
        Math.sin(ph) * Math.cos(th) * s, Math.cos(ph) * s * 0.8 + 0.1, Math.sin(ph) * Math.sin(th) * s,
        0.6 + rnd$1() * 0.9, 0.006 + rnd$1() * 0.012, color[0], color[1], color[2]);
    }
  }

  flakeBurst(pos, n = 90, spread = 0.5) {
    const palette = [[0.16, 0.46, 0.36], [0.30, 0.58, 0.44], [0.42, 0.28, 0.14], [0.55, 0.22, 0.12], [0.8, 0.84, 0.72]];
    for (let i = 0; i < n; i++) {
      const th = rnd$1() * TAU$5, ph = Math.acos(2 * rnd$1() - 1);
      const s = spread * (0.2 + rnd$1());
      const c = palette[Math.floor(rnd$1() * palette.length)];
      this.flakes.spawn(pos.x, pos.y, pos.z, Math.sin(ph) * Math.cos(th) * s, Math.cos(ph) * s, Math.sin(ph) * Math.sin(th) * s,
        1.5 + rnd$1() * 1.5, 0.006 + rnd$1() * 0.012, c[0], c[1], c[2]);
    }
  }

  plankton(center, intensity, dt) {
    const n = Math.floor(intensity * 180 * dt + rnd$1());
    for (let i = 0; i < n; i++) {
      const th = rnd$1() * TAU$5, r = 0.6 + rnd$1() * 7;
      this.glow.spawn(center.x + Math.cos(th) * r, Math.min(center.y + (rnd$1() - 0.5) * 5, -0.5), center.z + Math.sin(th) * r,
        (rnd$1() - 0.5) * 0.05, (rnd$1() - 0.5) * 0.05, (rnd$1() - 0.5) * 0.05, 0.6 + rnd$1() * 1.4, 0.006 + rnd$1() * 0.01);
    }
  }

  _lights() {
    const kids = this.scene.children;
    for (let k = 0; k < kids.length; k++) {
      const o = kids[k];
      if (o.isDirectionalLight && (!this._sun || (o.castShadow && !this._sun.castShadow))) this._sun = o;
      if (o.isHemisphereLight && !this._hemi) this._hemi = o;
    }
  }

  _flow() {
    const f = FXCAM.fwd;
    let hx = f.x, hz = f.z;
    const hl = Math.hypot(hx, hz);
    if (hl > 1e-3) { hx /= hl; hz /= hl; } else { hx = 0; hz = -1; }
    let ax = DRIFT_X, az = DRIFT_Z;
    const al0 = ax * hx + az * hz;
    ax -= hx * al0; az -= hz * al0;
    const al = Math.hypot(ax, az);
    if (al < 0.2) { ax = -hz; az = hx; } else { ax /= al; az /= al; }
    this._fx = this._cx + (ax * 0.85 + hx * 0.45) * DRIFT;
    this._fz = this._cz + (az * 0.85 + hz * 0.45) * DRIFT;
  }

  setAbsorption(v) { if (v && v.isVector3 && v !== WATER.uAbs.value) WATER.uAbs.value.copy(v); }

  update(dt, pr) {
    if (!this._sun || !this._hemi) { if ((this._look = (this._look + 1) % 30) === 1) this._lights(); }
    const Lu = LIGHT;
    if (this._sun) {
      const c = this._sun.color, k = this._sun.intensity;
      Lu.uSunCol.value.set(c.r * k, c.g * k, c.b * k);
      Lu.uSunDir.value.subVectors(this._sun.position, this._sun.target.position);
      if (Lu.uSunDir.value.lengthSq() > 1e-8) Lu.uSunDir.value.normalize(); else Lu.uSunDir.value.set(0, 1, 0);
    }
    if (this._hemi) {
      const c = this._hemi.color, k = this._hemi.intensity;
      Lu.uSkyCol.value.set(c.r * k, c.g * k, c.b * k);
    }
    this._t = U.uTime.value;
    this._T = this._t;
    this._cx = this.current.x;
    this._cz = this.current.z;
    this._flow();
    this._exhales(dt);
    this.splash.update(dt, this._T);
    this.splashL.update(dt, this._T);
    for (let k = 0; k < this.splashB.length; k++) this.splashB[k].update(dt, this._T);
    this.bubbles.step(dt, this._stepB);
    for (let q = 0; q < this._bqN; q++) {
      const o = q * 4, x = this._bq[o], y = this._bq[o + 1], z = this._bq[o + 2], s = this._bq[o + 3];
      this._bubble(x + (rnd$1() - 0.5) * s * 2, y - s * 0.5, z + (rnd$1() - 0.5) * s * 2, (rnd$1() - 0.5) * 0.16, 0.2, (rnd$1() - 0.5) * 0.16, 3 + rnd$1() * 3, s, s > 0.01);
      for (let m = 0; m < 4; m++) {
        const j = this._bubble(x + (rnd$1() - 0.5) * 0.03, y - rnd$1() * 0.02, z + (rnd$1() - 0.5) * 0.03, (rnd$1() - 0.5) * 0.1, 0.1, (rnd$1() - 0.5) * 0.1, 2 + rnd$1() * 2, 0.0006 + 0.0014 * rnd$1(), false);
        this.bubbles.seed[j] = 2 + (this.bubbles.seed[j] % 1);
      }
    }
    this._bqN = 0;
    this.spray.step(dt, this._stepSP);
    for (let q = 0; q < this._sqN; q++) {
      const o = q * 4, nd = rnd$1() < 0.5 ? 2 : 1;
      for (let m = 0; m < nd; m++) {
        const th = rnd$1() * TAU$5, sp = 0.2 + rnd$1() * 0.4;
        const j = this.spray.spawn(this._sq[o], this._sq[o + 1] + 0.01, this._sq[o + 2], Math.cos(th) * sp, 0.7 + rnd$1() * 0.9, Math.sin(th) * sp,
          1, this._sq[o + 3] * (0.25 + rnd$1() * 0.2), 0.95, 0.95, 0.95);
        this.spray.rest[j] = 1;
      }
    }
    this._sqN = 0;
    this._drift.x += dt * 0.03;
    this._drift.y += dt * 0.017;
    this.part.material.uniforms.uDrift.value.set(this._drift.x + U.uSurge.value.x * 1.1, 0, this._drift.y + U.uSurge.value.z * 1.1);
    this.silts.step(dt, this._stepS);
    this.flakes.step(dt, this._stepF);
    this.sand.step(dt, this._stepR);
    this.sparks.step(dt, this._stepP);
    this.glow.step(dt, null);
    this.rubble.update(dt, this.current);
  }
}

