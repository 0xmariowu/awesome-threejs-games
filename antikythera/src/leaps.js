// leaps.js
const MAXF = 6;
const MAXD = 3;
const MAXS = 48;
const NDROP = 56;
const NR = 9, NT = 28;
const HZ$1 = 60;
const HALF = 0.5 / 60;

function fishGeometry() {
  const pos = [], col = [], col2 = [], part = [], idx = [];
  const add = (x, y, z, c, c2, p, s) => { pos.push(x, y, z); col.push(...c); col2.push(...c2); part.push(p, s); return pos.length / 3 - 1; };
  const NZ = 22, NA = 14, ring0 = 0;
  for (let i = 0; i <= NZ; i++) {
    const u = i / NZ, z = -0.5 + u;
    const r = 0.085 * Math.pow(Math.max(Math.sin(Math.PI * (0.08 + 0.92 * u)), 0), 0.7) + (i === NZ ? 0 : 0.002);
    for (let j = 0; j < NA; j++) {
      const a = (j / NA) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
      const y = r * ca, x = r * 0.74 * sa;
      const up = ca;
      const ff = up > 0.35 ? [0.012, 0.03, 0.1] : up > -0.3 ? [0.86, 0.89, 0.93] : [0.95, 0.95, 0.95];
      const mu = up > 0.4 ? [0.24, 0.27, 0.24] : up > -0.35 ? [0.82, 0.84, 0.85] : [0.93, 0.93, 0.91];
      add(x, y - 0.006, z, ff, mu, 0, 0);
    }
  }
  for (let i = 0; i < NZ; i++) {
    for (let j = 0; j < NA; j++) {
      const a = ring0 + i * NA + j, b = ring0 + i * NA + ((j + 1) % NA), c = a + NA, d = b + NA;
      idx.push(a, c, b, b, c, d);
    }
  }
  const tf = [0.16, 0.18, 0.22], tm = [0.3, 0.32, 0.3];
  {
    const A = add(0, 0.028, -0.47, tf, tm, 2, 0), B = add(0, 0.16, -0.72, tf, tm, 2, 0), C = add(0, 0.0, -0.6, tf, tm, 2, 0);
    const D = add(0, 0, -0.48, tf, tm, 2, 0), E = add(0, -0.028, -0.47, tf, tm, 2, 0), F = add(0, -0.2, -0.77, tf, tm, 2, 0);
    idx.push(A, B, C, A, C, D, E, C, F, E, D, C);
  }
  const pf = [0.2, 0.23, 0.28], pf2 = [0.26, 0.3, 0.36], mp = [0.6, 0.6, 0.57];
  for (const s of [1, -1]) {
    const R1 = add(s * 0.055, 0.02, 0.28, pf, mp, 1, s), R2 = add(s * 0.055, 0.02, 0.18, pf, mp, 1, s);
    const L1 = add(s * 0.26, 0.09, 0.19, pf2, mp, 1, s), T0 = add(s * 0.46, 0.15, -0.03, pf2, mp, 1, s);
    const T2 = add(s * 0.37, 0.12, -0.14, pf2, mp, 1, s), T3 = add(s * 0.2, 0.06, -0.02, pf, mp, 1, s);
    idx.push(R1, L1, T3, R1, T3, R2, L1, T0, T3, T0, T2, T3);
    const P1 = add(s * 0.04, -0.045, 0.0, pf, mp, 3, s), P2 = add(s * 0.04, -0.045, -0.09, pf, mp, 3, s);
    const P3 = add(s * 0.2, 0.0, -0.19, pf2, mp, 3, s), P4 = add(s * 0.12, -0.02, -0.25, pf2, mp, 3, s);
    idx.push(P1, P3, P2, P2, P3, P4);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('aCol2', new THREE.Float32BufferAttribute(col2, 3));
  g.setAttribute('aFP', new THREE.Float32BufferAttribute(part, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
const FISH_DECL = `
attribute vec4 iFin;
attribute vec3 aCol2;
attribute vec2 aFP;
vec3 lpFold(vec3 p) {
  if (aFP.x > 0.5 && aFP.x < 1.5 || aFP.x > 2.5) {
    float s = aFP.y;
    vec3 piv = aFP.x < 1.5 ? vec3(s * 0.055, 0.02, 0.23) : vec3(s * 0.04, -0.045, -0.04);
    vec3 q = (p - piv) * mix(1.0, 0.28, iFin.w);
    float b = s * (1.0 - iFin.x) * 1.3;
    float c = cos(b), sn = sin(b);
    q = vec3(q.x * c + q.z * sn, q.y - 0.2 * abs(q.x) * (1.0 - iFin.x), -q.x * sn + q.z * c);
    return piv + q;
  }
  return p;
}
vec3 lpFoldN(vec3 n) {
  if (aFP.x > 0.5 && aFP.x < 1.5 || aFP.x > 2.5) {
    float b = aFP.y * (1.0 - iFin.x) * 1.3;
    float c = cos(b), sn = sin(b);
    return vec3(n.x * c + n.z * sn, n.y, -n.x * sn + n.z * c);
  }
  return n;
}
float lpBend(float z) { float w = min(max(0.1 - z, 0.0) / 0.6, 1.25); return iFin.z * 0.05 * sin(iFin.y + z * 7.0) * w * w; }
`;

function dolphinGeometry() {
  const pos = [], col = [], idx = [];
  const add = (x, y, z, c) => { pos.push(x, y, z); col.push(c[0], c[1], c[2]); return pos.length / 3 - 1; };
  const mix3 = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
  const back = [0.035, 0.042, 0.052], flank = [0.15, 0.17, 0.2], belly = [0.62, 0.62, 0.58];
  const U = [0, 0.06, 0.14, 0.24, 0.36, 0.48, 0.6, 0.7, 0.79, 0.86, 0.9, 0.93, 0.965, 1];
  const R = [0.008, 0.017, 0.031, 0.055, 0.08, 0.098, 0.104, 0.1, 0.087, 0.071, 0.048, 0.029, 0.021, 0.004];
  const NA = 16;
  for (let i = 0; i < U.length; i++) {
    const u = U[i], z = -0.5 + u, r = R[i];
    const k = u < 0.3 ? 1.55 - 0.5 * (u / 0.3) : 1.05;
    const y0 = u >= 0.9 ? -0.014 * ((u - 0.9) / 0.1) : u > 0.76 ? 0.006 : 0;
    for (let j = 0; j < NA; j++) {
      const a = (j / NA) * Math.PI * 2, up = Math.cos(a);
      const c = up > 0.1 ? mix3(flank, back, smoothstep(0.1, 0.6, up)) : mix3(belly, flank, smoothstep(-0.65, -0.05, up));
      add(r * 0.92 * Math.sin(a), y0 + r * k * up, z, c);
    }
  }
  for (let i = 0; i < U.length - 1; i++) {
    for (let j = 0; j < NA; j++) {
      const a = i * NA + j, b = i * NA + ((j + 1) % NA), c = a + NA, d = b + NA;
      idx.push(a, c, b, b, c, d);
    }
  }
  { const F0 = add(0, 0.083, 0.13, back), M = add(0, 0.16, -0.01, back), T = add(0, 0.205, -0.1, back), B = add(0, 0.13, -0.06, back), F1 = add(0, 0.075, -0.07, back);
    idx.push(F0, M, F1, M, B, F1, M, T, B); }
  for (const s of [1, -1]) {
    const P0 = add(s * 0.06, -0.04, 0.21, flank), P1 = add(s * 0.062, -0.05, 0.15, flank), P2 = add(s * 0.18, -0.1, 0.09, flank);
    idx.push(P0, P2, P1);
    const A = add(0, 0, -0.47, back), E = add(s * 0.07, 0, -0.505, back), Lt = add(s * 0.155, 0.004, -0.585, back), N = add(0, 0, -0.54, back);
    idx.push(A, E, Lt, A, Lt, N);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
const DOL_DECL = `
attribute vec4 iFin;
float lpBendV(float z) { float w = min(max(0.12 - z, 0.0) / 0.62, 1.2); return iFin.z * 0.03 * sin(iFin.y + z * 5.0) * w * w; }
`;

const FX_VERT = `
uniform float uTime;
uniform float uResY;
attribute vec4 aK;
attribute vec4 iA;
attribute vec4 iB;
attribute vec4 iC;
varying vec4 vD;
varying vec4 vE;
varying vec3 vW;
varying float vKind;
${WAVES_GLSL}
float lpSea(vec2 p, float t) {
  float fade = exp(-length(p - cameraPosition.xz) / 240.0);
  vec2 d = vec2(0.0);
  for (int i = 0; i < NWAVES; i++) {
    float ph = W_K[i] * dot(W_DIR[i], p) - W_W[i] * t + W_P[i];
    d += W_Q[i] * W_A[i] * W_DIR[i] * cos(ph);
  }
  return waveHeightAt(p - d * fade, t) * fade;
}
float lpHash(float n) { return fract(sin(n) * 43758.5453123); }
void main() {
  float age = uTime - iA.w;
  vKind = aK.x;
  vE = iB;
  if (aK.x < 0.5) {
    float i = aK.y, s = iB.z, E = iB.x, R = iB.y, k = iC.z;
    float h1 = lpHash(s + i * 1.713), h2 = lpHash(s * 1.37 + i * 2.917), h3 = lpHash(s * 0.71 + i * 5.113), h4 = lpHash(s * 2.03 + i * 0.619);
    float ta = age - h4 * 0.07;
    float v = E * (0.25 + 0.75 * sqrt(h1));
    float el = mix(mix(0.9, 1.52, h2 * h2), mix(0.3, 0.85, h2), k);
    float az = mix(h3 * 6.2832, atan(iC.y, iC.x) + (h3 - 0.5) * 1.4, k);
    vec3 dir = vec3(cos(az) * cos(el), sin(el), sin(az) * cos(el));
    vec3 p0 = iA.xyz + vec3(cos(az), 0.0, sin(az)) * R * 0.3 * h4;
    float T = 2.0 * v * sin(el) / 9.81 + 0.08;
    float tc = clamp(ta, 0.0, T);
    vec3 vel = dir * v + vec3(0.0, -9.81 * tc, 0.0);
    vec3 p = p0 + dir * v * tc + vec3(0.0, -4.905 * tc * tc, 0.0);
    float alive = step(0.0, ta) * (1.0 - smoothstep(0.7 * T, T, ta));
    float sz = R * 0.011 * (0.4 + 1.3 * h1 * h1) * (1.0 + 0.3 * clamp(ta / T, 0.0, 1.0));
    vec4 ma = viewMatrix * vec4(p, 1.0), mb = viewMatrix * vec4(p - vel * 0.025, 1.0);
    float pix = 2.0 * max(-ma.z, 0.05) / (projectionMatrix[1][1] * uResY);
    float szD = max(sz, 0.8 * pix);
    vec2 ax = mb.xy - ma.xy;
    float len = length(ax);
    vec2 an = len > 1e-5 ? ax / len : vec2(0.0, 1.0), pn = vec2(-an.y, an.x);
    vec4 mv = ma;
    mv.xy += pn * aK.z * szD + an * (aK.w > 0.0 ? len + szD : -szD);
    float cov = (sz * sz) / (szD * (szD + 0.5 * len));
    gl_Position = projectionMatrix * mv;
    if (alive <= 0.001) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    vD = vec4(aK.z, aK.w, alive * clamp(cov * 2.5, 0.3, 1.0) * (0.6 + 0.4 * h2), len / max(len + 2.0 * szD, 1e-5));
    vW = p;
  } else {
    float R = iB.y;
    float Rd = min(0.3 * R + 0.5 * max(age, 0.0) + 0.25, 3.5);
    vec2 q = aK.zw * aK.y * Rd;
    vec2 pw = iA.xz + q;
    vec3 p = vec3(pw.x, lpSea(pw, uTime) + 0.01, pw.y);
    vW = p;
    vD = vec4(q, age, R);
    gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
    if (age < 0.0 || age > iC.w) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
  }
}
`;
const FX_FRAG = `
uniform vec3 uKeyDir;
uniform vec3 uKeyCol;
uniform vec3 uSkyCol;
uniform vec3 uSeaCol;
uniform float uTime;
varying vec4 vD;
varying vec4 vE;
varying vec3 vW;
varying float vKind;
const vec3 LP_LUMA = vec3(0.2126, 0.7152, 0.0722);
vec3 lpCap(vec3 c, float L) { return c * min(1.0, L / max(dot(c, LP_LUMA), 1e-6)); }
float lpH2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float lpN(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(lpH2(i), lpH2(i + vec2(1.0, 0.0)), u.x), mix(lpH2(i + vec2(0.0, 1.0)), lpH2(i + vec2(1.0, 1.0)), u.x), u.y);
}
void main() {
  vec3 V = normalize(vW - cameraPosition);
  float cf = max(dot(V, normalize(uKeyDir)), 0.0);
  float capL = 1.3 * 0.223 * dot(uSkyCol + uKeyCol * 0.8, LP_LUMA);
  vec3 white = lpCap(uSkyCol * 1.1 + uKeyCol * 0.8 * (0.36 + 1.4 * pow(cf, 5.0)), capL);
  if (vKind < 0.5) {
    float along = abs(vD.y) - vD.w;
    float e = max(along, 0.0) / max(1.0 - vD.w, 1e-3);
    float r2 = vD.x * vD.x + e * e;
    if (r2 > 1.0) discard;
    float a = vD.z * (1.0 - r2) * 0.8;
    vec3 c = lpCap(uSkyCol * 0.62 + uKeyCol * 0.8 * (0.06 + 1.9 * pow(cf, 6.0)), capL);
    gl_FragColor = vec4(c * a, a);
    return;
  }
  vec2 q = vD.xy;
  float age = vD.z, R = vD.w, r = length(q), sd = vE.z;
  float fr = R * (0.26 + 0.2 * min(age, 1.5));
  float n = lpN(q * 13.0 + sd * 7.0 + vec2(0.0, age * 0.4)) * 0.6 + lpN(q * 31.0 - sd * 3.0) * 0.4;
  float fade = exp(-age / (0.3 + 0.45 * vE.w));
  float edge = 1.0 - smoothstep(0.15 * fr, fr, r + 0.5 * (n - 0.5) * fr);
  float lace = 1.0 - abs(2.0 * lpN(q * 22.0 + sd * 5.0 - vec2(age * 0.3, 0.0)) - 1.0);
  float foam = 0.75 * vE.w * fade * edge * smoothstep(0.35 + 0.35 * (1.0 - fade), 0.6 + 0.3 * (1.0 - fade), n) * smoothstep(0.45, 0.85, lace);
  float front = 0.25 * R + 0.5 * age;
  float lam = 0.09 + 0.2 * clamp(r / max(front, 0.05), 0.0, 1.0);
  float ph = 6.2832 * (r - 0.28 * age) / lam;
  float band = 1.0 - smoothstep(0.25, 0.6, fwidth(ph) / 6.2832);
  float w = smoothstep(front + 0.03, front - 0.3, r) * smoothstep(0.15 * R, 0.4 * R + 0.1, r) * exp(-age / 1.6) / (1.0 + 1.3 * r);
  vec2 toC = normalize(cameraPosition.xz - vW.xz);
  float s = cos(ph) * dot(q / max(r, 1e-3), toC) * w * band * min(1.0, vE.x * 0.6);
  vec3 lit = lpCap(uSkyCol * 0.9 + uKeyCol * 0.25 * pow(cf, 3.0), capL), dark = uSeaCol * 0.5;
  float ra = clamp(abs(s) * 0.3, 0.0, 0.16);
  vec3 rc = s > 0.0 ? lit : dark;
  float a = foam * 0.92 + ra * (1.0 - foam * 0.92);
  vec3 c = white * foam * 0.92 + rc * ra * (1.0 - foam * 0.92);
  gl_FragColor = vec4(c, a);
}
`;
function fxGeometry() {
  const g = new THREE.InstancedBufferGeometry();
  const k = [], idx = [];
  for (let i = 0; i < NDROP; i++) {
    const b = k.length / 4;
    for (const [cx, cy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) k.push(0, i, cx, cy);
    idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }
  const d0 = k.length / 4;
  for (let i = 0; i <= NR; i++) {
    const r = Math.pow(i / NR, 1.2);
    for (let j = 0; j < NT; j++) { const a = (j / NT) * Math.PI * 2; k.push(1, r, Math.cos(a), Math.sin(a)); }
  }
  for (let i = 0; i < NR; i++) {
    for (let j = 0; j < NT; j++) {
      const a = d0 + i * NT + j, b = d0 + i * NT + ((j + 1) % NT), c = a + NT, d = b + NT;
      idx.push(a, c, b, b, c, d);
    }
  }
  g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array((k.length / 4) * 3), 3));
  g.setAttribute('aK', new THREE.Float32BufferAttribute(k, 4));
  g.setIndex(idx);
  const ia = (n) => { const a = new THREE.InstancedBufferAttribute(new Float32Array(MAXS * 4), 4); a.setUsage(THREE.DynamicDrawUsage); g.setAttribute(n, a); return a; };
  const A = ia('iA'), B = ia('iB'), C = ia('iC');
  for (let i = 0; i < MAXS; i++) A.array[i * 4 + 3] = -1e3;
  g.instanceCount = MAXS;
  return { g, A, B, C };
}

class Leaps {
  constructor(scene, lightU, seaH) {
    this.seaH = seaH;
    let seed = null;
    try { const q = new URLSearchParams(location.search).get('seed'); if (q !== null && /^\d+$/.test(q)) seed = +q; } catch (e) {  }
    this.rng = makeRng$1(seed !== null ? (seed * 7919 + 1901) >>> 0 : (Date.now() ^ 0x5f3759df) >>> 0);
    const geo = fishGeometry();
    this.fin = new THREE.InstancedBufferAttribute(new Float32Array(MAXF * 4), 4);
    this.fin.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('iFin', this.fin);
    const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.28, metalness: 0.35, side: THREE.DoubleSide });
    m.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\n' + FISH_DECL)
        .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nobjectNormal = lpFoldN(objectNormal);')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed = lpFold(transformed);\ntransformed.x += lpBend(transformed.z);')
        .replace('#include <color_vertex>', '#include <color_vertex>\nvColor.xyz = mix(color.xyz, aCol2, iFin.w);');
    };
    m.customProgramCacheKey = () => 'lp-fish-1';
    this.fishMesh = new THREE.InstancedMesh(geo, m, MAXF);
    this.fishMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.fishMesh.frustumCulled = false;
    this.fishMesh.castShadow = false;
    this.fishMesh.receiveShadow = false;
    this.fishMesh.name = 'leaps-fish';
    { const z0 = new THREE.Matrix4().makeScale(0, 0, 0); for (let i = 0; i < MAXF; i++) this.fishMesh.setMatrixAt(i, z0); }
    scene.add(this.fishMesh);
    const dg = dolphinGeometry();
    this.dfin = new THREE.InstancedBufferAttribute(new Float32Array(MAXD * 4), 4);
    this.dfin.setUsage(THREE.DynamicDrawUsage);
    dg.setAttribute('iFin', this.dfin);
    const dm = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.42, metalness: 0.0, envMapIntensity: 0.6, side: THREE.DoubleSide });
    dm.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\n' + DOL_DECL)
        .replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed.y += lpBendV(transformed.z);');
    };
    dm.customProgramCacheKey = () => 'lp-dolphin-1';
    this.dolMesh = new THREE.InstancedMesh(dg, dm, MAXD);
    this.dolMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.dolMesh.frustumCulled = false;
    this.dolMesh.castShadow = false;
    this.dolMesh.receiveShadow = false;
    this.dolMesh.name = 'leaps-dolphin';
    { const z0 = new THREE.Matrix4().makeScale(0, 0, 0); for (let i = 0; i < MAXD; i++) this.dolMesh.setMatrixAt(i, z0); }
    scene.add(this.dolMesh);
    const fx = fxGeometry();
    this.fxA = fx.A; this.fxB = fx.B; this.fxC = fx.C;
    this.fxU = {
      uTime: { value: 0 }, uResY: ROPE_U.uRbResY,
      uKeyDir: lightU.uKeyDir, uKeyCol: lightU.uKeyCol, uSkyCol: lightU.uSkyCol, uSeaCol: lightU.uSeaCol,
    };
    this.fxMesh = new THREE.Mesh(fx.g, new THREE.ShaderMaterial({
      uniforms: this.fxU, vertexShader: FX_VERT, fragmentShader: FX_FRAG,
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      blending: THREE.CustomBlending, blendEquation: THREE.AddEquation,
      blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
      blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4,
    }));
    this.fxMesh.frustumCulled = false;
    this.fxMesh.renderOrder = 3;
    this.fxMesh.name = 'leaps-splash';
    scene.add(this.fxMesh);
    this.fish = [];
    this.evs = [];
    this.slot = 0; this.used = 0; this.live = false;
    this.sEnd = new Float32Array(MAXS);
    this.next = Infinity;
    this.state = '';
    this.n = 0;
    this.log = [];
    this._v = new THREE.Vector3(); this._v2 = new THREE.Vector3(); this._v3 = new THREE.Vector3(); this._f = new THREE.Vector3(); this._q = new THREE.Quaternion();
    this._wb = null;
    this._e = new THREE.Euler(0, 0, 0, 'YXZ'); this._m = new THREE.Matrix4(); this._s = new THREE.Vector3(); this._p = new THREE.Vector3();
    this.first = true;
  }

  _wordBoxes() {
    const out = [];
    if (typeof document === 'undefined') return out;
    const gl = document.getElementById('gl');
    const c = gl && gl.getBoundingClientRect();
    if (!c || c.width < 2 || c.height < 2) return out;
    const m = 0.03 * c.height;
    for (const sel of ['#title .t-logo', '#title .t-story', '#title .t-dive', '#story', '#headline', '#end .e-main', '#end .e-credit']) {
      const e = document.querySelector(sel);
      if (!e || e.closest('[hidden]') || !(e.textContent || '').trim()) continue;
      const cs = getComputedStyle(e);
      if (cs.visibility === 'hidden' || cs.display === 'none') continue;
      const r = e.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) continue;
      out.push([((r.left - m - c.left) / c.width) * 2 - 1, ((r.right + m - c.left) / c.width) * 2 - 1,
        1 - ((r.bottom + m - c.top) / c.height) * 2, 1 - ((r.top - m - c.top) / c.height) * 2]);
    }
    return out;
  }

  _shows(camera, x, z, y, boat, title, loose = false) {
    const v = this._v.set(x, y, z).project(camera);
    if (!(v.z < 1 && v.z > -1)) return false;
    if (!loose && (Math.abs(v.x) > 0.84 || v.y < -0.82 || v.y > 0.8)) return false;
    if (loose && (v.y < -0.95 || v.y > 0.9)) return false;
    const wb = this._wb;
    if (wb && wb.length) {
      const top = this._v2.set(x, y > 0.6 ? 2.2 : 1.1, z).project(camera), bot = this._v3.set(x, 0, z).project(camera);
      for (const b of wb) {
        const x0 = Math.min(top.x, bot.x), x1 = Math.max(top.x, bot.x), y0 = Math.min(top.y, bot.y), y1 = Math.max(top.y, bot.y);
        if (x1 > b[0] && x0 < b[1] && y1 > b[2] && y0 < b[3]) return false;
      }
    }
    if (boat) {
      const c = camera.position, dx = x - c.x, dz = z - c.z, L = Math.hypot(dx, dz) || 1;
      const bx = boat.x - c.x, bz = boat.z - c.z, along = (bx * dx + bz * dz) / L;
      if (Math.hypot(x - boat.x, z - boat.z) < 6.5) return false;
      if (along > 0 && along < L - 1 && Math.abs(bx * dz - bz * dx) / L < 7) return false;
    }
    return true;
  }

  _spawn(t, camera, boat, title, kindWant) {
    const r = this.rng, c = camera.position;
    const f = this._f; camera.getWorldDirection(f); f.y = 0;
    if (f.lengthSq() < 1e-6) return false;
    f.normalize();
    const rx = -f.z, rz = f.x;
    const hfov = Math.atan(Math.tan((camera.fov * Math.PI) / 360) * (camera.aspect || 1.5));
    const u0 = r(), kind = kindWant !== undefined ? kindWant : u0 < 0.4 ? 0 : u0 < 0.7 ? 1 : 2;
    const fly = kind === 0;
    const ext = kind === 0 ? 30 : kind === 1 ? 6 : 14, hy = kind === 2 ? 1.0 : 0.4;
    this._wb = this._wordBoxes();
    for (let tries = 0; tries < 24; tries++) {
      const d = kind === 2 ? 24 + 40 * r() : tries >= 12 ? 6 + 8 * r() : kind === 0 ? 8 + 8 * r() : 12 + 12 * r();
      const a = (r() * 2 - 1) * hfov * 0.75;
      const x = c.x + (f.x * Math.cos(a) + rx * Math.sin(a)) * d, z = c.z + (f.z * Math.cos(a) + rz * Math.sin(a)) * d;
      if (!this._shows(camera, x, z, hy, boat, title, fly)) continue;
      let plan = null;
      for (let h = 0; h < 4 && !plan; h++) {
        const side = r() < 0.5 ? 1 : -1, off = kind === 0 ? (r() < 0.5 ? -1 : 1) * (fly ? 0.1 + 0.7 * r() : 0.3 + 0.8 * r()) : (r() - 0.5) * 1.2;
        const hx = rx * side * Math.cos(off) + f.x * Math.sin(off), hz = rz * side * Math.cos(off) + f.z * Math.sin(off);
        const short = fly && h >= 2;
        if (!this._shows(camera, x + hx * (fly ? 12 : ext), z + hz * (fly ? 12 : ext), hy, boat, title, fly)) continue;
        plan = kind === 0 ? this._planFlyer(x, z, hx, hz, short) : kind === 1 ? this._planMullet(x, z, hx, hz) : this._planDolphin(x, z, hx, hz);
        if (fly) {
          const fish = plan.fish;
          for (let s = 0; s < fish.length && plan; s++) {
            const tr = fish[s].tr;
            for (let j = 0; j <= 8; j++) {
              const i = Math.min(tr.n - 1, Math.round((j / 8) * (tr.n - 1)));
              if (!this._shows(camera, tr.x[i], tr.z[i], hy, boat, title, !(s === 0 && j >= 3 && j <= 5))) { plan = null; break; }
            }
          }
        } else for (const [px, pz] of plan.check) if (!this._shows(camera, px, pz, hy, boat, title)) { plan = null; break; }
      }
      if (!plan) continue;
      for (const F of plan.fish) { F.t0 = t + F.delay; this.fish.push(F); }
      for (const e of plan.evs) { e[0] += t + HALF; this.evs.push(e); }
      this.evs.sort((p, q) => p[0] - q[0]);
      this.n++;
      this.log.push([+t.toFixed(2), ['flyer', 'mullet', 'dolphin'][kind], +x.toFixed(1), +z.toFixed(1), plan.fish.length]);
      return true;
    }
    return false;
  }

  _track(n) { const a = () => new Float32Array(n); return { n, x: a(), z: a(), h: a(), yaw: a(), pit: a(), rol: a(), spr: a(), amp: a() }; }

  _planFlyer(x0, z0, hx, hz, short = false) {
    const r = this.rng, fish = [], evs = [], check = [];
    const u0 = r(), school = u0 < 0.15 ? 1 : u0 < 0.35 ? 2 : u0 < 0.6 ? 3 : u0 < 0.82 ? 4 : 5;
    for (let s = 0; s < school; s++) {
      const delay = s ? 0.08 + 0.45 * r() : 0;
      const lat = s ? (r() < 0.5 ? -1 : 1) * (0.5 + 1.6 * r()) : 0, back = s ? -(0.3 + 2.2 * r()) : 0;
      const turn = (r() - 0.5) * 0.12;
      const cs = Math.cos(turn), sn = Math.sin(turn), dx = hx * cs - hz * sn, dz = hx * sn + hz * cs;
      let x = x0 + dx * back - dz * lat, z = z0 + dz * back + dx * lat;
      const taxi1 = 0.25 + 0.25 * r(), g1 = short ? 0.55 + 0.35 * r() : 0.8 + 0.7 * r(), h1 = 0.6 + 0.45 * r();
      const two = r() < 0.3 && !short, taxi2 = 0.22 + 0.2 * r(), g2 = 0.8 + 0.6 * r(), h2 = 0.45 + 0.3 * r();
      const segs = [['out', 0.12], ['taxi', taxi1], ['glide', g1, h1]];
      if (two) segs.push(['taxi', taxi2], ['glide', g2, h2]);
      segs.push(['in', 0.22]);
      let T = 0;
      for (const sg of segs) T += sg[1];
      const n = Math.ceil(T * HZ$1) + 2, tr = this._track(n);
      let v = 9 + 2 * r(), vT = 14 + 3 * r(), si = 0, st = 0, pat = 0;
      const yaw = Math.atan2(dx, dz);
      const L = 0.3 + 0.08 * r();
      let hPrev = -0.15;
      for (let i = 0; i < n; i++) {
        const dt = 1 / HZ$1;
        while (si < segs.length - 1 && st > segs[si][1]) { st -= segs[si][1]; si++; }
        const sg = segs[si], u = clamp$9(st / sg[1], 0, 1);
        let h = 0.04, spr = 1, amp = 0, pit = 0;
        if (sg[0] === 'out') { h = lerp$4(-0.14, 0.04, u); spr = 0.2 * u; amp = 1; pit = 0.25; v += (vT - v) * 1.5 * dt; }
        else if (sg[0] === 'taxi') {
          h = 0.035; spr = si === 1 ? smoothstep(0, 0.7, u) : 1; amp = 1; pit = 0.1;
          v += (vT - v) * 3 * dt;
          if ((pat -= dt) <= 0) {
            pat = 0.07 + 0.03 * r();
            evs.push([delay + i * dt, x - dx * L * 0.6, z - dz * L * 0.6, 1.7 + 0.6 * r(), 0.34, -dx, -dz, 0.5, 0.6, 1.8, 0, 0]);
          }
        } else if (sg[0] === 'glide') {
          const H = sg[2], Tg = sg[1];
          h = 0.03 + (H - 0.03) * (1 - Math.exp(-st / 0.22)) * (1 - smoothstep(0.3 * Tg, Tg, st));
          spr = 1; amp = 0.15 * (1 - smoothstep(0, 0.2, st)); v -= 0.016 * v * v * dt;
        } else { h = lerp$4(0.03, -0.4, u); spr = 1 - smoothstep(0, 0.6, u); amp = 0.4; v *= 1 - 3 * dt; }
        const vy = (h - hPrev) * HZ$1;
        pit = sg[0] === 'glide' ? 0.06 + Math.atan2(vy, v) * 0.8 : sg[0] === 'in' ? -0.25 : pit;
        hPrev = h;
        x += dx * v * dt; z += dz * v * dt;
        tr.x[i] = x; tr.z[i] = z; tr.h[i] = h; tr.yaw[i] = yaw; tr.pit[i] = pit; tr.rol[i] = 0.05 * Math.sin(i * 0.11 + s);
        tr.spr[i] = spr; tr.amp[i] = amp;
        if (i === Math.round(0.1 * HZ$1)) evs.push([delay + i * dt, x, z, 1.9, 0.5, dx, dz, 0.7, 0.55, 2.4, s ? 0 : 0.3, 0]);
        if (!s && sg[0] === 'taxi' && st < dt * 0.99) evs.push([delay + i * dt, x, z, 0, 0, 0, 0, 0, 0, 0, 0.12, sg[1]]);
        st += dt;
      }
      const e = Math.min(n - 1, Math.round((T - 0.16) * HZ$1));
      evs.push([delay + e / HZ$1, tr.x[e], tr.z[e], 2.0, 0.55, dx, dz, 0.5, 0.65, 2.8, s ? 0.18 : 0.35, 0]);
      fish.push({ tr, delay, kind: 0, len: L, dur: T, ph: r() * 6 });
      check.push([tr.x[0], tr.z[0]], [tr.x[n >> 1], tr.z[n >> 1]], [tr.x[n - 1], tr.z[n - 1]]);
    }
    return { fish, evs, check };
  }

  _planMullet(x0, z0, hx, hz) {
    const r = this.rng, evs = [], check = [];
    const leaps = 1 + (r() < 0.6 ? 1 : 0) + (r() < 0.35 ? 1 : 0);
    const L = 0.4 + 0.1 * r();
    const plan = [];
    let x = x0, z = z0, t = 0, T = 0;
    let dx = hx, dz = hz;
    for (let j = 0; j < leaps; j++) {
      const v0 = 3.6 + 1.0 * r(), th = 1.0 + 0.35 * r(), vh = v0 * Math.cos(th), vy = v0 * Math.sin(th);
      const Tf = (vy + Math.sqrt(vy * vy - 2 * 9.81 * 0.14)) / 9.81;
      const roll = (r() < 0.5 ? -1 : 1) * (0.9 + 0.6 * r());
      plan.push({ t, x, z, dx, dz, vh, vy, Tf, roll });
      T = t + Tf;
      x += dx * vh * Tf; z += dz * vh * Tf;
      t = T + 0.7 + 1.1 * r();
      const tu = (r() - 0.5) * 0.7, c = Math.cos(tu), s = Math.sin(tu), nx = dx * c - dz * s;
      dz = dx * s + dz * c; dx = nx;
      x += dx * (0.6 + 1.2 * r()); z += dz * (0.6 + 1.2 * r());
    }
    const n = Math.ceil(T * HZ$1) + 2, tr = this._track(n);
    let k = 0;
    for (let i = 0; i < n; i++) {
      const tt = i / HZ$1;
      while (k < plan.length - 1 && tt > plan[k].t + plan[k].Tf + 0.05) k++;
      const P = plan[k], u = tt - P.t;
      const out = u >= 0 && u <= P.Tf;
      const uc = clamp$9(u, 0, P.Tf), vy = P.vy - 9.81 * uc;
      tr.x[i] = P.x + P.dx * P.vh * uc; tr.z[i] = P.z + P.dz * P.vh * uc;
      tr.h[i] = out ? -0.14 + P.vy * uc - 4.905 * uc * uc : -1.5;
      tr.yaw[i] = Math.atan2(P.dx, P.dz);
      const w = smoothstep(0.15 * P.Tf, 0.95 * P.Tf, uc);
      tr.pit[i] = lerp$4(Math.atan2(vy, P.vh) * 0.85, -0.25, w * 0.8);
      tr.rol[i] = P.roll * w;
      tr.spr[i] = 0; tr.amp[i] = 1.6 - 0.8 * w;
    }
    for (const P of plan) {
      const ex = P.x + P.dx * P.vh * 0.04, ez = P.z + P.dz * P.vh * 0.04;
      evs.push([P.t + 0.04, ex, ez, 1.5, 0.42, P.dx, P.dz, 0.25, 0.35, 2.2, 0.28, 0]);
      const lx = P.x + P.dx * P.vh * P.Tf, lz = P.z + P.dz * P.vh * P.Tf;
      evs.push([P.t + P.Tf - 0.03, lx, lz, 2.6, 0.8, P.dx, P.dz, 0.2, 0.9, 3.2, 0.6, 0]);
      check.push([ex, ez], [lx, lz]);
    }
    return { fish: [{ tr, delay: 0, kind: 1, len: L, dur: T + 0.05, ph: r() * 6 }], evs, check };
  }

  _planDolphin(x0, z0, hx, hz) {
    const r = this.rng, fish = [], evs = [], check = [];
    const u0 = r(), pod = u0 < 0.35 ? 1 : u0 < 0.75 ? 2 : 3;
    for (let s = 0; s < pod; s++) {
      const delay = s ? 0.3 + 0.5 * r() + 0.35 * (s - 1) : 0;
      const lat = s ? (s % 2 ? 1 : -1) * (1.3 + 1.4 * r()) : 0, back = s ? -(0.6 + 1.8 * r()) : 0;
      let x = x0 + hx * back - hz * lat, z = z0 + hz * back + hx * lat, dx = hx, dz = hz;
      const L = 2.0 + 0.4 * r(), H0 = -1.1;
      const leaps = 1 + (r() < 0.65 ? 1 : 0) + (r() < 0.3 ? 1 : 0);
      const plan = [];
      let t = 0, T = 0;
      for (let j = 0; j < leaps; j++) {
        const vy = 6.2 + 1.2 * r(), vh = 4.2 + 1.2 * r(), Tf = (2 * vy) / 9.81, roll = (r() - 0.5) * 0.3;
        plan.push({ t, x, z, dx, dz, vy, vh, Tf, roll });
        check.push([x + dx * vh * Tf * 0.5, z + dz * vh * Tf * 0.5]);
        T = t + Tf;
        x += dx * vh * Tf; z += dz * vh * Tf;
        const gap = 0.9 + 0.7 * r();
        t = T + gap;
        const tu = (r() - 0.5) * 0.3, c = Math.cos(tu), sn = Math.sin(tu), nx = dx * c - dz * sn;
        dz = dx * sn + dz * c; dx = nx;
        x += dx * vh * gap; z += dz * vh * gap;
      }
      const n = Math.ceil(T * HZ$1) + 2, tr = this._track(n);
      let k = 0;
      const st = plan.map(() => ({ nOut: false, tOut: false, nIn: false, tIn: false }));
      for (let i = 0; i < n; i++) {
        const tt = i / HZ$1;
        while (k < plan.length - 1 && tt > plan[k].t + plan[k].Tf + 0.05) k++;
        const P = plan[k], u = tt - P.t, out = u >= 0 && u <= P.Tf;
        const uc = clamp$9(u, 0, P.Tf), vyN = P.vy - 9.81 * uc;
        const px = P.x + P.dx * P.vh * uc, pz = P.z + P.dz * P.vh * uc;
        const h = out ? H0 + P.vy * uc - 4.905 * uc * uc : -3;
        const pit = Math.atan2(vyN, P.vh);
        tr.x[i] = px; tr.z[i] = pz; tr.h[i] = h;
        tr.yaw[i] = Math.atan2(P.dx, P.dz); tr.pit[i] = pit; tr.rol[i] = P.roll * Math.sin(Math.PI * clamp$9(uc / P.Tf, 0, 1));
        tr.spr[i] = 0; tr.amp[i] = 0.15 + 0.75 * (1 - smoothstep(-0.3, 0.4, h));
        if (!out) continue;
        const hs = 0.5 * L * Math.sin(pit), hc = 0.5 * L * Math.cos(pit), E = st[k];
        const nx = px + P.dx * hc, nz = pz + P.dz * hc, fx = px - P.dx * hc, fz = pz - P.dz * hc;
        const lead = s ? 0.5 : 1;
        if (!E.nOut && vyN > 0 && h + hs > 0) { E.nOut = true; evs.push([delay + tt, nx, nz, 3.0, 0.8, P.dx, P.dz, 0.65, 0.55, 3.0, 0.3 * lead, 0]); check.push([nx, nz]); }
        if (!E.tOut && vyN > 0 && h - hs > 0) { E.tOut = true; evs.push([delay + tt, fx, fz, 2.2, 0.6, P.dx, P.dz, 0.4, 0.4, 2.4, 0, 0]); }
        if (!E.nIn && vyN < 0 && h + hs < 0) { E.nIn = true; evs.push([delay + tt, nx, nz, 3.4, 1.2, P.dx, P.dz, 0.35, 0.95, 3.5, 0.45 * lead, 0]); check.push([nx, nz]); }
        if (!E.tIn && vyN < 0 && h - hs < 0) { E.tIn = true; evs.push([delay + tt, fx, fz, 3.0, 1.0, P.dx, P.dz, 0.3, 0.9, 3.2, 0.3 * lead, 0]); }
      }
      fish.push({ tr, delay, kind: 2, len: L, dur: T + 0.05, ph: r() * 6 });
    }
    return { fish, evs, check };
  }

  _splash(t, e, camera) {
    if (!this.live) { this.slot = 0; this.used = 0; }
    let i = -1;
    for (let k = 0; k < MAXS; k++) { const j = (this.slot + k) % MAXS; if (j >= this.used || this.sEnd[j] <= t) { i = j; break; } }
    if (i < 0) return;
    this.slot = (i + 1) % MAXS;
    this.used = Math.max(this.used, i + 1);
    this.live = true;
    const y = this.seaH(e[1], e[2], t);
    const A = this.fxA.array, B = this.fxB.array, C = this.fxC.array, o = i * 4;
    A[o] = e[1]; A[o + 1] = y; A[o + 2] = e[2]; A[o + 3] = t;
    B[o] = e[3]; B[o + 1] = e[4]; B[o + 2] = (i * 17.31 + (t % 97) * 3.7) % 211; B[o + 3] = e[8];
    const dl = Math.hypot(e[5], e[6]) || 1;
    C[o] = e[5] / dl; C[o + 1] = e[6] / dl; C[o + 2] = e[7]; C[o + 3] = e[9];
    this.sEnd[i] = t + Math.max(e[9], 1.2);
    this.fxA.needsUpdate = this.fxB.needsUpdate = this.fxC.needsUpdate = true;
  }

  _sound(t, e, camera) {
    const ak = typeof window !== 'undefined' ? window.__ak : null, au = ak && ak.audio;
    if (!au || typeof au.fishSplash !== 'function' || !camera) return;
    const c = camera.position, f = this._f;
    camera.getWorldDirection(f);
    const dx = e[1] - c.x, dz = e[2] - c.z, d = Math.hypot(dx, dz, c.y) || 1;
    const pan = clamp$9((dx * -f.z + dz * f.x) / Math.max(Math.hypot(dx, dz), 1e-3), -1, 1);
    au.fishSplash(+e[10].toFixed(3), +pan.toFixed(3), +d.toFixed(2), (this.n * 31 + this.evs.length * 7) % 997, +e[11].toFixed(3));
  }

  update(t, dt, camera, sunDir, above) {
    const G = typeof window !== 'undefined' && window.__ak ? window.__ak.G : null;
    const st = G ? G.state : 'title';
    const seen = !!camera && above > 0.25;
    const day = !sunDir || sunDir.y > 0.02;
    const okState = st === 'title' || st === 'dive' || st === 'end';
    const allowed = seen && day && okState && !(G && G.paused);
    if (st !== this.state) {
      if (st === 'title') this.next = t + HALF + 4 + 5 * this.rng();
      else if (st === 'end') this.next = Math.max(this.next, t + 9 + 8 * this.rng());
      this.state = st;
    }
    if (t >= this.next) {
      if (!allowed) this.next = t + 1.5 + HALF;
      else {
        const surf = G && window.__ak.surface;
        const boat = surf && surf.p ? { x: surf.p.x, z: surf.p.z } : null;
        if (this._spawn(t, camera, boat, st === 'title') || this._spawn(t, camera, boat, st === 'title', 2)) this.next = t + 15 + 30 * this.rng();
        else this.next = t + 1.5 + HALF;
      }
    }
    while (this.evs.length && this.evs[0][0] <= t) {
      const e = this.evs.shift();
      if (!seen) continue;
      if (e[4] > 0) this._splash(e[0], e, camera);
      if (e[10] > 0) this._sound(t, e, camera);
    }
    let nf = 0, nd = 0;
    for (let i = this.fish.length - 1; i >= 0; i--) if (t > this.fish[i].t0 + this.fish[i].dur + 0.1) this.fish.splice(i, 1);
    for (let i = 0; i < this.fish.length; i++) {
      const F = this.fish[i], tr = F.tr, u = (t - F.t0) * HZ$1, dol = F.kind === 2;
      if (u < 0 || (dol ? nd >= MAXD : nf >= MAXF)) continue;
      const i0 = Math.min(Math.floor(u), tr.n - 1), i1 = Math.min(i0 + 1, tr.n - 1), w = Math.min(u - i0, 1);
      const L = (k) => lerp$4(k[i0], k[i1], w);
      const x = L(tr.x), z = L(tr.z), h = L(tr.h);
      if (h < (dol ? -1.6 : -0.6)) continue;
      const fol = dol ? 1 : 1 - 0.4 * smoothstep(0.1, 0.6, h);
      const y = this.seaH(x, z, t) * fol + h;
      this._e.set(-L(tr.pit), L(tr.yaw), L(tr.rol), 'YXZ');
      this._q.setFromEuler(this._e);
      this._s.setScalar(F.len);
      this._m.compose(this._p.set(x, y, z), this._q, this._s);
      const j = dol ? nd++ : nf++, arr = dol ? this.dfin.array : this.fin.array;
      (dol ? this.dolMesh : this.fishMesh).setMatrixAt(j, this._m);
      F.ph += dt * (dol ? 7 : F.kind ? 16 : L(tr.amp) > 0.5 ? 38 : 9);
      arr[j * 4] = L(tr.spr); arr[j * 4 + 1] = F.ph; arr[j * 4 + 2] = L(tr.amp); arr[j * 4 + 3] = F.kind;
    }
    this.fishMesh.count = nf;
    this.fishMesh.visible = nf > 0 && seen;
    if (nf) { this.fishMesh.instanceMatrix.needsUpdate = true; this.fin.needsUpdate = true; }
    this.dolMesh.count = nd;
    this.dolMesh.visible = nd > 0 && seen;
    if (nd) { this.dolMesh.instanceMatrix.needsUpdate = true; this.dfin.needsUpdate = true; }
    let live = false;
    for (let i = 0; i < this.used; i++) if (this.sEnd[i] > t) { live = true; break; }
    this.live = live;
    this.fxU.uTime.value = t;
    this.fxMesh.geometry.instanceCount = Math.max(1, this.used);
    this.fxMesh.visible = live && seen;
    this.first = false;
  }
}

