// ocean.js
const g7 = (x) => { const s = (+x).toPrecision(7); return /[.e]/.test(s) ? s : `${s}.0`; };

const WIND = (() => { const l = Math.hypot(0.91, -0.41); return [0.91 / l, -0.41 / l]; })();

const SPEC = (() => {
  let seed = 90719;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const gauss = () => Math.sqrt(-2 * Math.log(Math.max(rnd(), 1e-7))) * Math.cos(2 * Math.PI * rnd());
  const wa = Math.atan2(WIND[1], WIND[0]);
  const N = 40, L0 = 3.0, L1 = 0.3;
  const perOct = N / Math.log2(L0 / L1);
  const out = [];
  for (let i = 0; i < N; i++) {
    const f = (i + 0.15 + 0.7 * rnd()) / N;
    const L = L0 * Math.pow(L1 / L0, f);
    const k = (2 * Math.PI) / L;
    let th = Math.max(-2.6, Math.min(2.6, gauss() * (0.6 + 0.6 * f)));
    if (f > 0.6 && rnd() < 0.15) th += Math.PI;
    const vo = f < 0.5 ? 0.0013 : 0.0022;
    const amp = 0.8 + 0.4 * rnd();
    const v = (vo / perOct) * amp * amp;
    const w = Math.min(Math.sqrt(9.81 * k + 7.4e-5 * k * k * k), 38);
    out.push({ dx: Math.cos(wa + th), dz: Math.sin(wa + th), k, w, s: Math.sqrt(2 * v), v, ph: rnd() * 2 * Math.PI, gm: rnd(), gc: f > 0.45 ? 1 : 0 });
  }
  out.sort((a, b) => a.k - b.k);
  let acc = 0;
  for (let i = N - 1; i >= 0; i--) { acc += out[i].v; out[i].vt = acc; }
  return out;
})();
const NS = SPEC.length;

const RIP = [0.28, 0.148, 0.079, 0.042, 0.022, 0.0118].map((L, o) => {
  const k = (2 * Math.PI) / L, w = Math.sqrt(9.81 * k + 7.4e-5 * k * k * k);
  return { f: 1 / L, v: [0.0022, 0.0024, 0.0026, 0.0026, 0.0024, 0.0020][o], a: Math.atan2(WIND[1], WIND[0]) + [0.4, -0.9, 1.7, -2.3, 2.9, -0.6][o], c: w / k };
});
const fractJ = (x) => x - Math.floor(x);
function ripGrad(ix, iy, out) {
  ix = ((ix % 1024) + 1024) % 1024; iy = ((iy % 1024) + 1024) % 1024;
  let a = fractJ(ix * 0.1031), b = fractJ(iy * 0.1030), c = fractJ(ix * 0.0973);
  const d = a * (b + 33.33) + b * (c + 33.33) + c * (a + 33.33);
  a += d; b += d; c += d;
  const gx = fractJ((a + b) * c) * 2 - 1, gy = fractJ((a + c) * b) * 2 - 1, l = Math.hypot(gx, gy) || 1;
  out[0] = gx / l; out[1] = gy / l;
  return out;
}
const _g0 = [0, 0], _g1 = [0, 0], _g2 = [0, 0], _g3$1 = [0, 0];
function ripNoiseD(px, py, out) {
  const ix = Math.floor(px), iy = Math.floor(py), fx = px - ix, fy = py - iy;
  const ux = fx * fx * fx * (fx * (fx * 6 - 15) + 10), uy = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
  const dux = 30 * fx * fx * (fx * (fx - 2) + 1), duy = 30 * fy * fy * (fy * (fy - 2) + 1);
  const ga = ripGrad(ix, iy, _g0), gb = ripGrad(ix + 1, iy, _g1), gc = ripGrad(ix, iy + 1, _g2), gd = ripGrad(ix + 1, iy + 1, _g3$1);
  const va = ga[0] * fx + ga[1] * fy, vb = gb[0] * (fx - 1) + gb[1] * fy, vc = gc[0] * fx + gc[1] * (fy - 1), vd = gd[0] * (fx - 1) + gd[1] * (fy - 1);
  const k4 = va - vb - vc + vd;
  out[0] = va + ux * (vb - va) + uy * (vc - va) + ux * uy * k4;
  out[1] = ga[0] + ux * (gb[0] - ga[0]) + uy * (gc[0] - ga[0]) + ux * uy * (ga[0] - gb[0] - gc[0] + gd[0]) + dux * (uy * k4 + vb - va);
  out[2] = ga[1] + ux * (gb[1] - ga[1]) + uy * (gc[1] - ga[1]) + ux * uy * (ga[1] - gb[1] - gc[1] + gd[1]) + duy * (ux * k4 + vc - va);
  return out;
}
const RIP_G = (() => {
  const o = [0, 0, 0];
  let s = 0;
  const n = 8192;
  for (let i = 0; i < n; i++) { ripNoiseD(fractJ(i * 0.6180340) * 97, fractJ(i * 0.7548777) * 89, o); s += o[1] * o[1] + o[2] * o[2]; }
  return 1 / Math.sqrt(s / n);
})();
const RIP_VT = RIP.map((r, i) => RIP.slice(i).reduce((a, b) => a + b.v, 0));
const RIP_GLSL = `
const float OC_RIPG = ${g7(RIP_G)};
const float OC_RIPF[${RIP.length}] = float[${RIP.length}](${RIP.map((r) => g7(r.f)).join(', ')});
const float OC_RIPV[${RIP.length}] = float[${RIP.length}](${RIP.map((r) => g7(r.v)).join(', ')});
const float OC_RIPVT[${RIP.length}] = float[${RIP.length}](${RIP_VT.map((v) => g7(v)).join(', ')});
const float OC_RIPA[${RIP.length}] = float[${RIP.length}](${RIP.map((r) => g7(r.a)).join(', ')});
const float OC_RIPC[${RIP.length}] = float[${RIP.length}](${RIP.map((r) => g7(r.c)).join(', ')});
`;
const sarr = (type, f) => `${type}[${NS}](${SPEC.map(f).join(', ')})`;
const SPEC_GLSL = `
const int OD_N = ${NS};
const vec2 OD_DIR[${NS}] = ${sarr('vec2', (w) => `vec2(${g7(w.dx)}, ${g7(w.dz)})`)};
const float OD_K[${NS}] = ${sarr('float', (w) => g7(w.k))};
const float OD_W[${NS}] = ${sarr('float', (w) => g7(w.w))};
const float OD_S[${NS}] = ${sarr('float', (w) => g7(w.s))};
const float OD_H[${NS}] = ${sarr('float', (w) => g7(w.k < 16 ? w.s / w.k : 0))};
const float OD_V[${NS}] = ${sarr('float', (w) => g7(w.v))};
const float OD_VT[${NS}] = ${sarr('float', (w) => g7(w.vt))};
const float OD_P[${NS}] = ${sarr('float', (w) => g7(w.ph))};
const float OD_G[${NS}] = ${sarr('float', (w) => g7(w.gm))};
const float OD_C[${NS}] = ${sarr('float', (w) => g7(w.gc))};
`;

const HULL_N = 48;
const HULL$1 = Array.from({ length: HULL_N }, () => new THREE.Vector3());
const HULL_P = Array.from({ length: HULL_N }, () => new THREE.Vector2());
function waterlinePts(y) {
  const s = BOAT_SCALE;
  try {
    if (typeof hullPoint === 'function') {
      const p = new THREE.Vector3(), out = [];
      const vAt = (u) => {
        let lo = 0, hi = 1;
        for (let k = 0; k < 30; k++) { const m = 0.5 * (lo + hi); hullPoint(u, m, 1, p); if (p.y < y) lo = m; else hi = m; }
        return 0.5 * (lo + hi);
      };
      for (const side of [1, -1]) {
        for (let i = 0; i <= 96; i++) {
          const f = side > 0 ? i / 96 : 1 - i / 96;
          const u = Math.sin((f * 2 - 1) * Math.PI * 0.5) * 0.999;
          hullPoint(u, vAt(u), side, p);
          out.push({ x: p.x * s, z: p.z * s });
        }
      }
      return out;
    }
    if (typeof waterline === 'function') return waterline(96).map((q) => ({ x: q.x * s, z: q.z * s }));
  } catch (e) {  }
  return null;
}
function fillHull(pts) {
  for (let j = 0; j < HULL_N; j++) {
    const a = (2 * Math.PI * j) / HULL_N, dx = Math.sin(a), dz = Math.cos(a);
    let best = 0, nx = dx, nz = dz;
    if (pts) {
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i], q = pts[(i + 1) % pts.length];
        const ex = q.x - p.x, ez = q.z - p.z, den = dx * ez - dz * ex;
        if (Math.abs(den) < 1e-9) continue;
        const t = (p.x * ez - p.z * ex) / den, u = (dz * p.x - dx * p.z) / den;
        if (t > best && u >= -1e-6 && u <= 1 + 1e-6) { best = t; nx = ez; nz = -ex; }
      }
    }
    if (!(best > 0.1)) { best = 1 / Math.hypot(dx / 1.56, dz / 5.0); nx = dx / (1.56 * 1.56); nz = dz / 25.0; }
    const l = Math.hypot(nx, nz) || 1;
    const o = nx * dx + nz * dz < 0 ? -1 : 1;
    HULL$1[j].set(best, (o * nx) / l, (o * nz) / l);
    HULL_P[j].set(best * dx, best * dz);
  }
}
fillHull(waterlinePts(0));
const HULL_EXT = (() => {
  let x = 0, z = 0;
  for (let j = 0; j < HULL_N; j++) {
    const a = (2 * Math.PI * j) / HULL_N;
    x = Math.max(x, Math.abs(HULL$1[j].x * Math.sin(a)));
    z = Math.max(z, Math.abs(HULL$1[j].x * Math.cos(a)));
  }
  return [x > 0.3 ? x : 1.56, z > 1 ? z : 5.0];
})();

const SUN_REF = (() => {
  const s = SKY_UNIFORMS.uSkSunSea.value, L = SKY_UNIFORMS.uSunDir.value;
  const l = (0.2126 * s.x + 0.7152 * s.y + 0.0722 * s.z) * Math.max(L.y, 0.2);
  return l > 1e-4 ? 1 / l : 1.25;
})();

const VERT$4 = `
uniform float uTime;
attribute float aSpan;
varying vec3 vWorld;
varying vec2 vLag;
${WAVES_GLSL}
void main() {
  vec3 p = (modelMatrix * vec4(position, 1.0)).xyz;
  vec3 disp = vec3(0.0);
  for (int i = 0; i < NWAVES; i++) {
    float lam = 6.2831853 / W_K[i];
    float A = W_A[i] * (1.0 - smoothstep(lam * 0.14, lam * 0.26, aSpan));
    float ph = W_K[i] * dot(W_DIR[i], p.xz) - W_W[i] * uTime + W_P[i];
    disp.xz += (W_Q[i] * A * cos(ph)) * W_DIR[i];
    disp.y += A * sin(ph);
  }
  vLag = p.xz;
  vWorld = p + disp;
  gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
}
`;

const FRAG$3 = `
uniform float uTime;
uniform float uLight;
uniform float uPixAng;
uniform vec3 uSunW;
uniform vec4 uBoat;
uniform vec4 uBoatMot;
uniform vec2 uBoatTilt;
uniform float uBtLamp;
uniform vec3 uBtLampW;
uniform vec4 uRiseMir;
uniform vec3 uRiseDawn;
uniform vec3 uHull[${HULL_N}];
uniform vec2 uHullP[${HULL_N}];
uniform float uXing;
uniform float uLensR;
uniform float uSceneH;
${SKY_DECL}
${SKY_FUNCS}
${WAVES_GLSL}
${WAVE_SURF_GLSL}
${WL_GLSL}
${SPEC_GLSL}
${RIP_GLSL}
varying vec3 vWorld;
varying vec2 vLag;
#ifdef OC_SKIRT
varying vec3 vRun;
varying float vSkX;
varying vec4 vSkL;
varying float vSkM;
#endif

const vec2 OC_WIND = vec2(${g7(WIND[0])}, ${g7(WIND[1])});
const vec3 OC_LUMA = vec3(0.2126, 0.7152, 0.0722);
const float OC_F0 = 0.0204;
const float OC_VCAP = 0.0012;
const float OC_ESUN = 1.6;
const float OC_EMOON = 0.004;
const float OC_MOONW = 1.0;
const float OC_GLINTD = 2500.0;
const float OC_SUNREF = ${g7(SUN_REF)};
const vec3 OC_DEEP = vec3(0.0022, 0.0300, 0.0880);
const vec3 OC_THIN = vec3(0.0110, 0.1550, 0.1300);
const vec3 OC_SSS = vec3(0.040, 0.300, 0.340);
const bool OC_HULLFOAM = true;
const vec2 OC_HULL = vec2(${g7(HULL_EXT[0])}, ${g7(HULL_EXT[1])});
#ifdef OC_SKIRT
const vec3 SK_EXT = vec3(52.0, 44.0, 41.0);
const float SK_PAINT = 0.6;
${SPRAY_RUN_GLSL}
#endif
float ocCycles(vec2 d, float k, vec2 uh, float fa, float fb) {
  float du = dot(d, uh);
  float dw = d.x * uh.y - d.y * uh.x;
  return k * 0.1591549 * sqrt(du * du * fa * fa + dw * dw * fb * fb);
}
float ocKeep(float cyc) { return 1.0 - smoothstep(0.12, 0.4, cyc); }
float ocSchlick(float c) { float m = clamp(1.0 - c, 0.0, 1.0); float m2 = m * m; return OC_F0 + (1.0 - OC_F0) * m2 * m2 * m; }
float ocBeckmann(float nh, float m2) {
  float c2 = nh * nh;
  return exp((c2 - 1.0) / (c2 * m2)) / (3.14159265 * m2 * c2 * c2);
}
float ocSmith(float nv, float m2) {
  float a = nv / sqrt(max(m2 * (1.0 - nv * nv), 1e-9));
  return a < 1.6 ? (3.535 * a + 2.181 * a * a) / (1.0 + 2.276 * a + 2.577 * a * a) : 1.0;
}
float ocGlint(vec3 n, vec3 v, vec3 l, float m2, float nv) {
  float nl = dot(n, l);
  if (nl <= 0.0) return 0.0;
  vec3 hv = l + v;
  vec3 h = hv / max(length(hv), 1e-5);
  float nh = max(dot(n, h), 0.02);
  return ocSchlick(dot(v, h)) * ocBeckmann(nh, m2) * ocSmith(max(nv, 0.02), m2) * ocSmith(nl, m2) / (4.0 * max(nv, 0.08));
}
float ocGlintP(vec3 n, vec3 v, vec3 l, float m2, float omega) {
  vec3 hv = l + v;
  vec3 h = hv / max(length(hv), 1e-5);
  float nh = max(dot(n, h), 0.02);
  return ocBeckmann(nh, m2) * nh * omega / (4.0 * max(dot(v, h), 0.05));
}
float ocHash(vec3 p) {
  p = fract(p * vec3(0.1031, 0.1030, 0.0973));
  p += dot(p, p.yxz + 33.33);
  return fract((p.x + p.y) * p.z);
}
vec2 ocGr(vec2 i) {
  i = mod(i, 1024.0);
  vec3 p3 = fract(vec3(i.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  vec2 g = fract((p3.xx + p3.yz) * p3.zy) * 2.0 - 1.0;
  return g * inversesqrt(max(dot(g, g), 1e-6));
}
vec3 ocNoiseD(vec2 p) {
  vec2 i = floor(p), f = p - i;
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  vec2 du = 30.0 * f * f * (f * (f - 2.0) + 1.0);
  vec2 ga = ocGr(i), gb = ocGr(i + vec2(1.0, 0.0)), gc = ocGr(i + vec2(0.0, 1.0)), gd = ocGr(i + vec2(1.0, 1.0));
  float va = dot(ga, f), vb = dot(gb, f - vec2(1.0, 0.0)), vc = dot(gc, f - vec2(0.0, 1.0)), vd = dot(gd, f - vec2(1.0, 1.0));
  float k4 = va - vb - vc + vd;
  float v = va + u.x * (vb - va) + u.y * (vc - va) + u.x * u.y * k4;
  vec2 d = ga + u.x * (gb - ga) + u.y * (gc - ga) + u.x * u.y * (ga - gb - gc + gd) + du * (u.yx * k4 + vec2(vb, vc) - va);
  return vec3(v, d);
}
float ocPoisson(float lam, float u, float u2) {
  if (lam > 12.0) return max(lam + sqrt(lam) * sqrt(-2.0 * log(max(u, 1e-6))) * cos(6.2831853 * u2), 0.0);
  float p = exp(-lam), c = p, k = 0.0;
  for (int i = 0; i < 28; i++) {
    if (u <= c) break;
    k += 1.0;
    p *= lam / k;
    c += p;
  }
  return k;
}
float ocSparkle(vec2 q, vec2 uh, float fa, float fb, float P, float t) {
  float af = atan(uh.y, uh.x) * 2.5464791;
  float o0 = floor(af), wo = af - o0;
  float la = log2(max(fa, 1e-4)), lb = log2(max(fb, 1e-4));
  float La = floor(la) + 1.0, Lb = floor(lb) + 1.0;
  float wa = fract(la), wb = fract(lb);
  float sum = 0.0, sw2 = 0.0;
  for (int k = 0; k < 8; k++) {
    float io = float(k & 1), ia = float((k >> 1) & 1), ib = float((k >> 2) & 1);
    float w = mix(1.0 - wo, wo, io) * mix(1.0 - wa, wa, ia) * mix(1.0 - wb, wb, ib);
    if (w < 1e-3) continue;
    float ang = (o0 + io) * 0.39269908;
    vec2 e1 = vec2(cos(ang), sin(ang));
    vec2 uv = vec2(dot(q, e1), e1.x * q.y - e1.y * q.x);
    vec2 cs = exp2(vec2(La + ia, Lb + ib));
    vec3 id = vec3(floor(uv / cs), mod(o0 + io, 16.0) * 7.0 + (La + ia) * 131.0 + (Lb + ib) * 17.0);
    float tt = t * 3.0 + ocHash(id + 0.5);
    float ep = floor(tt);
    float pl = sin(3.14159265 * (tt - ep));
    float lam = max(OC_GLINTD * cs.x * cs.y * P, 1e-6);
    float n = ocPoisson(lam, ocHash(id + vec3(ep * 1.37, ep * 0.71, 3.3)), ocHash(id + vec3(ep * 0.53, 9.1, ep * 1.9)));
    float x = n / lam * (1.0 + (2.0 * pl * pl - 1.0) / (1.0 + 0.3 * lam));
    sum += w * (x - 1.0);
    sw2 += w * w;
  }
  return max(1.0 + sum * inversesqrt(max(sw2, 1e-6)), 0.0);
}
vec3 ocNoMagenta(vec3 c) {
  float m = min(c.r, c.b);
  if (c.g >= m) return c;
  float y0 = dot(c, OC_LUMA);
  c.g = m;
  return c * (y0 / max(dot(c, OC_LUMA), 1e-6));
}
float ocFoamPatch(vec2 q, float t, float fp) {
  vec2 a = vec2(dot(q, OC_WIND) - t * 0.25, dot(q, vec2(-OC_WIND.y, OC_WIND.x)));
  float pm = mix(0.08, smoothstep(0.66, 0.82, skNoise(a * vec2(0.22, 0.35) + vec2(3.1, 7.3))), 1.0 - smoothstep(0.3, 0.8, fp * 0.35));
  float st = mix(0.5, skNoise(vec2(a.x * 0.9, a.y * 3.2) + vec2(1.7, 4.1)), 1.0 - smoothstep(0.3, 0.8, fp * 3.2));
  float fl = mix(0.5, skNoise(vec2(a.x * 2.3, a.y * 5.1) + vec2(8.1, 2.9)), 1.0 - smoothstep(0.3, 0.8, fp * 5.1));
  return pm * smoothstep(0.38, 0.72, st * 0.65 + fl * 0.35);
}
float ocFreeboard(float s) {
  float b = max(s - 0.2, 0.0);
  return 0.92 + 0.258 * (s + 0.12) * (s + 0.12) + 0.305 * b * b * b;
}
vec3 ocHullAlbedo(float y, float b) {
  vec3 c = vec3(0.70, 0.66, 0.57) * (1.0 - 0.3 * (1.0 - smoothstep(0.06, 0.3, y)));
  c = mix(c, vec3(0.30, 0.03, 0.02), 1.0 - smoothstep(0.0, 0.01, abs(b - 0.346) - 0.012));
  c = mix(c, vec3(0.022, 0.02, 0.018), 1.0 - smoothstep(0.297, 0.313, b));
  return mix(vec3(0.016, 0.014, 0.012), c, smoothstep(0.045, 0.065, y));
}
vec4 ocHull(vec2 lp, vec3 d, out vec2 hp) {
  hp = vec2(0.0);
  vec2 dl = vec2(d.x * uBoat.z - d.z * uBoat.w, d.x * uBoat.w + d.z * uBoat.z);
  vec2 P = lp / OC_HULL, D = dl / OC_HULL;
  float A = dot(D, D), B = dot(P, D), C = dot(P, P) - 1.0;
  float disc = B * B - A * C;
  if (A < 1e-6 || C <= 0.0 || B >= 0.0 || disc <= 0.0) return vec4(-1.0);
  float t = (-B - sqrt(disc)) / A;
  hp = lp + dl * t;
  return vec4(t, d.y * t, hp.y / OC_HULL.y, disc / A);
}
float ocWaterline(vec2 hp) { return uBoatMot.w - hp.y * uBoatTilt.x + hp.x * uBoatTilt.y; }
float ocHullDist(vec2 lp, out vec2 n) {
  float d2 = 1e9;
  vec2 nb = vec2(0.0, 1.0), rb = vec2(0.0);
  vec2 a = uHullP[${HULL_N - 1}];
  for (int j = 0; j < ${HULL_N}; j++) {
    vec2 b = uHullP[j];
    vec2 e = b - a, w = lp - a;
    float s = clamp(dot(w, e) / max(dot(e, e), 1e-6), 0.0, 1.0);
    vec2 r = w - e * s;
    float dd = dot(r, r);
    if (dd < d2) {
      d2 = dd;
      rb = r;
      nb = vec2(e.y, -e.x);
      if (dot(nb, a + b) < 0.0) nb = -nb;
    }
    a = b;
  }
  nb /= max(length(nb), 1e-6);
  float ang = atan(lp.x, lp.y);
  float jf = (ang < 0.0 ? ang + 6.2831853 : ang) * ${g7(HULL_N / (2 * Math.PI))};
  float j0 = floor(jf);
  float rr = mix(uHull[int(mod(j0, ${HULL_N}.0))].x, uHull[int(mod(j0 + 1.0, ${HULL_N}.0))].x, jf - j0);
  float dist = sqrt(d2);
  bool inside = length(lp) < rr;
  n = inside ? nb : normalize(rb + nb * 0.002);
  return inside ? -dist : dist;
}
#ifdef OC_SKIRT
const float SK_LACE = 0.27;
float skLace(vec2 p, float fw) {
  vec2 i = floor(p), f = p - i;
  float d1 = 8.0, d2 = 8.0;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 g = vec2(float(x), float(y));
    vec2 o = vec2(ocHash(vec3(i + g, 1.7)), ocHash(vec3(i + g, 5.3)));
    float d = length(g + o - f);
    if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
  }
  float h = 0.085 + 1.5 * fw;
  return 1.0 - smoothstep(0.115 - h, 0.115 + h, d2 - d1);
}
#endif
void main() {
  vec3 toP = vWorld - cameraPosition;
  float dist = max(length(toP), 1e-3);
#ifdef OC_SKIRT
  if ((vRun.x < max(0.0015, 0.5 * dist * uPixAng) && vSkL.y < 0.005) || vSkX < -0.02) discard;
#endif
  vec3 rd = toP / dist;
  if (uXing > 0.5) {
    vec3 np = cameraPosition + rd * uLensR;
    float hN = np.y - waveSurfAt(np.xz, uTime) + wlRag(gl_FragCoord.x / uSceneH, uTime) * uLensR;
    if ((hN < 0.0) == gl_FrontFacing) discard;
  }
  float fb = dist * uPixAng;
  float fa = min(fb / max(abs(rd.y), 0.003), 4000.0);
  float lxz = length(rd.xz);
  vec2 uh = lxz > 1e-5 ? rd.xz / lxz : vec2(1.0, 0.0);
  vec2 q = vLag;
  float t = uTime;
  vec2 bd = vWorld.xz - uBoat.xy;
  bool nearBoat = dot(bd, bd) < 196.0;
  vec2 lp = vec2(bd.x * uBoat.z - bd.y * uBoat.w, bd.x * uBoat.w + bd.y * uBoat.z);
  float dh = 99.0, lee = 0.0, act = 0.0, bow = 0.0, hang = 0.0;
  vec2 nw = vec2(0.0, 1.0), nh = vec2(0.0, 1.0);
  if (nearBoat) {
    vec2 nl;
    dh = ocHullDist(lp, nl);
    nh = nl;
    nw = vec2(uBoat.z * nl.x + uBoat.w * nl.y, uBoat.z * nl.y - uBoat.w * nl.x);
    hang = atan(lp.x, lp.y);
    lee = smoothstep(0.1, 0.7, dot(nw, OC_WIND)) * exp(-max(dh, 0.0) / 3.5);
    act = 0.35 + clamp(2.2 * abs(uBoatMot.x) + 1.6 * abs(uBoatMot.y) * abs(lp.y) + 1.2 * abs(uBoatMot.z) * abs(lp.x), 0.0, 1.6);
    bow = smoothstep(0.35, 0.9, lp.y / OC_HULL.y);
  }
  vec2 sl = vec2(0.0);
  float jxx = 1.0, jzz = 1.0, jxz = 0.0, h = 0.0, var = 0.0, wv = 0.0;
  for (int i = 0; i < NWAVES; i++) {
    vec2 d = W_DIR[i];
    float f = ocKeep(ocCycles(d, W_K[i], uh, fa, fb));
    float ak = W_A[i] * W_K[i];
    if (f <= 0.0) { var += 0.5 * ak * ak; continue; }
    float ph = W_K[i] * dot(d, q) - W_W[i] * t + W_P[i];
    float c = cos(ph), s = sin(ph);
    float qs = W_Q[i] * ak * f * s;
    sl += d * (ak * f * c);
    jxx -= qs * d.x * d.x;
    jzz -= qs * d.y * d.y;
    jxz -= qs * d.x * d.y;
    h += W_A[i] * f * s;
    wv -= W_A[i] * W_W[i] * f * c;
    var += 0.5 * ak * ak * (1.0 - f * f);
  }
  float mq = 1.0 - smoothstep(0.3, 0.8, fa * 0.07);
  float gA = 1.0 + (skNoise(q * 0.07 + OC_WIND * (t * 0.02)) - 0.5) * 0.16 * mq;
  float gB = 1.0 + (skNoise(vec2(q.y, -q.x) * 0.07 + vec2(7.3, 2.9) - OC_WIND.yx * (t * 0.015)) - 0.5) * 0.16 * mq;
  float gC = (1.0 + (skNoise(q * 0.35 + vec2(1.9, 5.3) - OC_WIND * (t * 0.25)) - 0.5) * 0.24 * (1.0 - smoothstep(0.3, 0.8, fa * 0.35))) * (1.0 - 0.5 * lee);
  vec2 sm = vec2(0.0);
  float vm = 0.0, hw = 0.0;
  for (int i = 0; i < OD_N; i++) {
    float e = mix(gA, gB, OD_G[i]) * mix(1.0, gC, OD_C[i]);
    if (OD_K[i] * fb > 2.5) { vm += OD_VT[i] * e * e; break; }
    vec2 d = OD_DIR[i];
    float f = ocKeep(ocCycles(d, OD_K[i], uh, fa, fb));
    float ph = OD_K[i] * dot(d, q) - OD_W[i] * t + OD_P[i];
    sm += d * (OD_S[i] * e * f * cos(ph));
    hw += OD_H[i] * e * f * sin(ph);
    vm += OD_V[i] * e * e * (1.0 - f * f);
  }
  vec2 smR = sm;
  float gR = gC * gC;
  float vR = 0.0;
  {
    float fg = sqrt(fa * fb);
    vec2 warp = vec2(0.0);
    for (int o = 0; o < ${RIP.length}; o++) {
      float fo = OC_RIPF[o];
      float kp = (1.0 - smoothstep(0.15, 0.45, fo * fg)) * (1.0 - smoothstep(0.3, 0.55, fo * fa));
      if (kp <= 0.0) { vm += OC_RIPVT[o] * gR; vR += OC_RIPVT[o] * gR; break; }
      float vo = OC_RIPV[o] * gR;
      float an = OC_RIPA[o];
      vec2 da = vec2(cos(an), sin(an)), db = vec2(cos(an + 1.1), sin(an + 1.1));
      float sp = mod(t * OC_RIPC[o] * fo, 1024.0);
      vec2 p = q * fo + warp;
      vec3 na = ocNoiseD(vec2(dot(p, da) + sp, da.x * p.y - da.y * p.x + 17.0 * float(o)));
      vec3 nb = ocNoiseD(vec2(dot(p, db) + mod(t * OC_RIPC[o] * fo * 0.8, 1024.0) + 311.0, db.x * p.y - db.y * p.x + 5.0 + 23.0 * float(o)));
      vec2 ga = na.y * da + na.z * vec2(-da.y, da.x);
      vec2 gb = nb.y * db + nb.z * vec2(-db.y, db.x);
      sm += (ga + gb) * (0.70710678 * sqrt(vo) * OC_RIPG * kp);
      vm += vo * (1.0 - kp * kp);
      vR += vo;
      warp = (ga - gb) * 0.25;
    }
  }
  float vr = 0.0;
  if (nearBoat && dh < 10.0) {
    float ramp = act * (0.45 + 0.4 * clamp(-dot(nw, OC_WIND), 0.0, 1.0) + 0.6 * bow);
    float dd = max(dh, 0.0);
    for (int r = 0; r < 2; r++) {
      float kr = r == 0 ? 11.4 : 27.3;
      float wr = r == 0 ? 10.6 : 16.4;
      float a0 = (r == 0 ? 0.07 : 0.09) * ramp * exp(-dd / (r == 0 ? 2.4 : 1.2));
      float fr = ocKeep(ocCycles(nw, kr, uh, fa, fb));
      float ph = kr * dd - wr * t + hang * (r == 0 ? 3.0 : 7.0);
      vec2 si = nw * (a0 * fr * cos(ph));
      sm += si;
      if (r == 0) smR += si;
      vr += 0.5 * a0 * a0 * (1.0 - fr * fr);
    }
  }
  float slap = 0.0;
  if (OC_HULLFOAM && nearBoat && dh < 3.0) {
    float al = max(OC_HULL.y - lp.y, 0.0), dd0 = max(dh, 0.0);
    float sd = lp.x >= 0.0 ? 1.0 : -1.0;
    float aEnds = 1.0 - smoothstep(0.55, 0.85, abs(nh.y));
    slap = smoothstep(0.05, 0.45, wv - (uBoatMot.x - uBoatMot.y * lp.y + uBoatMot.z * lp.x));
    vec2 gAl = -vec2(uBoat.w, uBoat.z);
    float nearW = exp(-dd0 / 1.3) * aEnds * (0.6 + 0.4 * max(slap, 0.5 * bow)) * mix(0.5, 1.0, smoothstep(-0.05, 0.08, uSunDir.y));
    vec2 sw = vec2(0.0), swR = vec2(0.0);
    float swv = 0.0;
    for (int j = 0; j < 3; j++) {
      float fj = float(j);
      float kw = fj < 0.5 ? 5.5 : (fj < 1.5 ? 9.0 : 15.0);
      float th = (fj - 1.0) * 0.4 * sd;
      vec2 kd = cos(th) * nw + sin(th) * gAl;
      float ph = kw * (dd0 * cos(th) + al * sin(th)) - sqrt(9.81 * kw) * t + 2.1 * fj + 1.7 * sd;
      float env = smoothstep(0.3, 0.7, skNoise(vec2(al * (0.8 + 0.35 * fj) + 5.1 * sd + 3.3 * fj - t * 0.4, t * 0.3 + 1.7 * fj)));
      float st = (fj < 0.5 ? 0.40 : (fj < 1.5 ? 0.22 : 0.13)) * env;
      float kp = ocKeep(ocCycles(kd, kw, uh, fa, fb));
      sw += kd * (st * kp * cos(ph));
      if (j == 0) swR += kd * (st * kp * cos(ph));
      swv += 0.5 * st * st * (1.0 - kp * kp);
    }
    sm += sw * nearW;
    smR += swR * nearW;
    vr += 0.5 * swv * nearW;
  }
  sm *= inversesqrt(1.0 + dot(sm, sm) * 3.0);
  smR *= inversesqrt(1.0 + dot(smR, smR) * 3.0);
  float rip = gl_FrontFacing ? 1.0 : 0.45;
  float r2 = rip * rip;
  vec3 Ng = vec3(sl.y * jxz - jzz * sl.x, jxx * jzz - jxz * jxz, jxz * sl.x - sl.y * jxx);
#ifdef OC_SKIRT
  float skCr = (1.0 - smoothstep(0.0, 0.006, vSkX)) * (1.0 - smoothstep(0.04, 0.08, vRun.x)) * smoothstep(0.35, 0.6, skNoise(vec2(lp.y * 6.0 + lp.x * 2.0, t * 0.5)));
  vec3 Ng0 = Ng;
  Ng.xz -= vRun.yz * Ng.y * (1.0 - skCr);
#endif
  vec2 sa = sm * rip;
  vec3 N = normalize(vec3(Ng.x - sa.x * Ng.y, Ng.y, Ng.z - sa.y * Ng.y));
#ifdef OC_SKIRT
  {
    vec3 Nn = normalize(Ng), sp3 = vec3(sa.x, 0.0, sa.y);
    sp3 -= Nn * dot(Nn, sp3);
    N = normalize(mix(N, normalize(Nn - sp3), smoothstep(0.002, 0.02, vRun.x)));
  }
  float skFace = nearBoat ? smoothstep(0.003, 0.02, vRun.x) * (1.0 - smoothstep(0.06, 0.3, vSkX)) : 0.0;
  if (skFace > 0.0) {
    float yf = vWorld.y + 0.3 * t;
    float k1 = 1.0 - smoothstep(0.12, 0.4, 36.0 * fb), k2 = 1.0 - smoothstep(0.12, 0.4, 80.0 * fb);
    vec3 c1 = ocNoiseD(vec2(vSkL.x * 36.0 + 3.1, yf * 28.0));
    vec3 c2 = ocNoiseD(vec2(vSkL.x * 80.0 + 7.7, yf * 66.0 - 1.3 * t));
    vec2 gch = c1.yz * vec2(36.0, 28.0) * (0.006 * k1) + c2.yz * vec2(80.0, 66.0) * (0.0022 * k2);
    vec3 Tl = vec3(-nw.y, 0.0, nw.x), Uf = normalize(vec3(0.0, 1.0, 0.0) - N * N.y + vec3(0.0, 1e-4, 0.0));
    N = normalize(N - (Tl * gch.x + Uf * gch.y) * skFace);
  }
#endif
  vec3 dNx = dFdx(N), dNy = dFdy(N);
  float m2 = var + (vm + vr + OC_VCAP) * r2 + min(0.2 * (dot(dNx, dNx) + dot(dNy, dNy)), 0.06) + 2e-4;
  if (!gl_FrontFacing) m2 += (1.0 - r2) * vR;
  float m2g = m2 + 0.25 * uSunSize * uSunSize;
  float unres = clamp((var + vm * r2) / m2g, 0.0, 1.0);
  float sunVis = 1.0 - smoothstep(0.0, 1.0, uEclipse);
  float dark = skDark();
  vec3 L = uSunDir;
  vec3 sunC = uSkSunSea;
  vec3 col;
  if (gl_FrontFacing) {
    vec3 V = -rd;
    float nv = clamp(dot(N, V), 0.0, 1.0);
    float F = ocSchlick(min(sqrt(nv * nv + 0.6 * m2), 1.0));
    vec3 R0 = reflect(rd, N);
    float spread = sqrt(2.0 * m2);
    float into = 1.0 - smoothstep(-0.3 - 1.5 * spread, 0.06 + 1.5 * spread, R0.y);
    vec3 R = normalize(vec3(R0.x, abs(R0.y) + spread * 0.5 * (1.0 - nv) * (1.0 - nv), R0.z));
    vec3 sky = skyReflect(R, spread);
    float sunI = dot(sunC, OC_LUMA) * max(L.y, 0.0) * OC_SUNREF * sunVis;
    float moonI = dot(uSkMoonSea, OC_LUMA) * max(uMoonDir.y, 0.0) * 0.0175;
    float ka = exp(mix(log(1.0 + uMoonLit), log(0.35), smoothstep(-0.139, 0.139, L.y)));
    float light = (ka * uSkAmbLevel + 0.65 * (sunI + moonI)) * (1.0 - 0.94 * dark);
    float shadow = 0.0, occ = 0.0;
    if (nearBoat) {
      occ = exp(-max(dh, 0.0) / 0.7);
      vec2 hp;
      vec4 hs = ocHull(lp, L, hp);
      if (hs.x > 0.0) {
        float fs = ocFreeboard(hs.z);
        shadow = (1.0 - smoothstep(fs - 0.12, fs + 0.12, vWorld.y + hs.y - ocWaterline(hp))) * smoothstep(0.0, 0.05, hs.w) * step(0.0, L.y);
      }
      vec3 NR = normalize(vec3(Ng.x - smR.x * rip * Ng.y, Ng.y, Ng.z - smR.y * rip * Ng.y));
      float sR = sqrt(vR + vm + OC_VCAP + var);
      vec3 hAcc = vec3(0.0);
      float hSum = 0.0;
      for (int k = 0; k < 4; k++) {
        vec3 Nk = normalize(NR + vec3(uh.x, 0.0, uh.y) * ((float(k) - 1.5) * 0.8 * sR));
        vec4 hr = ocHull(lp, reflect(rd, Nk), hp);
        if (hr.x > 0.0) {
          float fr = ocFreeboard(hr.z);
          float yh = vWorld.y + hr.y - ocWaterline(hp);
          float bl = 0.05 + hr.x * (3.5 * sR + 2.0 * uPixAng);
          float bw = 0.08 + hr.x * 2.0 * sR / OC_HULL.x;
          float hm = (1.0 - smoothstep(fr - bl, fr + bl, yh)) * smoothstep(-0.03 - 0.3 * bl, 0.04, hr.y) * smoothstep(0.0, bw, hr.w);
          vec2 nl = hp / (OC_HULL * OC_HULL);
          nl /= max(length(nl), 1e-4);
          vec2 nh = vec2(uBoat.z * nl.x + uBoat.w * nl.y, uBoat.z * nl.y - uBoat.w * nl.x);
          vec3 lit = vec3(0.45, 0.5, 0.58) * (uSkAmbLevel * (1.0 - 0.94 * dark)) + sunC * (4.8 * max(dot(nh, L.xz), 0.0) * sunVis)
                   + uSkMoonSea * (0.075 * max(dot(nh, uMoonDir.xz), 0.0));
          hAcc += mix(ocHullAlbedo(yh, fr - yh) * lit, sky, 0.2) * hm;
          hSum += hm;
        }
      }
      if (hSum > 0.0) sky = mix(sky, hAcc / hSum, hSum * 0.25);
    }
    float cG = clamp(h * 3.0 + 0.1, 0.0, 1.0);
    float cW = clamp(hw * 18.0 + 0.45, 0.0, 1.0);
    vec3 Ns = normalize(Ng);
    float sunFace = clamp(dot(Ns, L) - L.y, 0.0, 1.0) * sunVis * step(0.0, L.y);
    float pch = smoothstep(0.42, 0.8, skNoise(q * 0.045 + vec2(3.7, 1.3) - OC_WIND * (t * 0.05)) * 0.75 + skNoise(q * 0.13 + vec2(8.1, 4.4) + OC_WIND.yx * (t * 0.08)) * 0.25)
              * (1.0 - smoothstep(0.3, 0.8, fa * 0.045));
    float sunUp = smoothstep(0.02, 0.25, L.y) * sunVis;
    float ll = length(L.xz);
    vec2 lh = ll > 1e-4 ? L.xz / ll : vec2(1.0, 0.0);
    float back = clamp(dot(uh, lh), 0.0, 1.0);
    float face = clamp(0.5 - dot(N.xz, uh) * 6.0, 0.0, 1.0);
    float thin = 0.3 * cG * cG * cG * cG + 0.7 * cW * cW * cW;
    float nvS = clamp(dot(Ns, V), 0.0, 1.0);
    float thru = (1.0 - smoothstep(0.2, 0.55, nvS)) * clamp(smoothstep(0.0, 0.3, nv - nvS) + thin * (0.3 + 0.7 * back), 0.0, 1.0)
               * smoothstep(0.01, 0.12, L.y) * sunVis;
#ifdef OC_SKIRT
    thru *= 1.0 - smoothstep(0.002, 0.02, vRun.x);
#endif
    float green = clamp(0.35 * cG * cG + 0.15 * cW * cW + (0.55 * pch * (0.5 + 0.5 * cG) + 0.25 * sunFace) * sunUp
                        + 1.2 * pch * (0.5 + 0.5 * cG) * thru, 0.0, 1.0);
    float sunLow = (1.0 - smoothstep(0.2, 0.45, L.y)) * smoothstep(0.07, 0.13, L.y) * sunVis;
    vec3 sunTint = mix(vec3(1.0), sunC / max(dot(sunC, OC_LUMA), 1e-6), sunLow);
    vec3 body = mix(OC_DEEP * (0.65 + 0.35 * cG), OC_THIN, green) * light * (1.0 + 1.6 * sunFace * sunTint);
    body *= 1.0 + 1.4 * pch * thru;
    body *= mix(vec3(1.0), vec3(0.92, 1.28, 0.86), 0.75 * sunLow);
    body *= 1.0 + 0.8 * (1.0 - smoothstep(0.25, 0.5, L.y)) * smoothstep(-0.02, 0.05, L.y);
    body += OC_SSS * sunC * (back * back * back * thin * thin * 2.0 * face * (1.0 - nv) * sunVis * 0.6 * (1.0 - shadow)
                             * (0.5 + 0.5 * smoothstep(0.05, 0.1, L.y)));
    body *= (1.0 - 0.55 * shadow) * (1.0 - 0.35 * occ);
#ifdef OC_SKIRT
    float hq = nearBoat ? smoothstep(0.003, 0.02, vRun.x) : 0.0;
    if (hq > 0.0) {
      float nv0 = clamp(dot(normalize(Ng0), V), 0.0, 1.0);
      float Fl = ocSchlick(min(sqrt(nv0 * nv0 + 0.6 * m2), 1.0));
      float nvh = clamp(dot(Ns, V), 0.0, 1.0), Fh = ocSchlick(min(sqrt(nvh * nvh + 0.6 * m2), 1.0));
      float ls = dot(sky, OC_LUMA), lumSea = mix(dot(body, OC_LUMA), ls, Fl);
      float need = (0.88 * lumSea - Fh * ls) / max(1.0 - Fh, 0.05);
      float reach = clamp(dot(Ns, L), 0.0, 1.0) * sunVis * step(0.0, L.y) * (1.0 - shadow);
      vec3 tint = mix(vec3(0.83, 1.03, 1.16), vec3(0.09, 1.26, 1.06) * sunTint, 0.55 * reach);
      tint /= max(dot(tint, OC_LUMA), 1e-4);
      body = mix(body, max(body, tint * max(need, 0.0)), hq);
    }
    if (nearBoat && vRun.x > 0.002 && vSkX < 0.6) {
      vec3 Tw = refract(rd, N, 0.7502);
      float hzi = -dot(Tw.xz, nw);
      if (hzi > 0.02) {
        float pth = max(vSkX, 0.0) / hzi;
        float yh = vWorld.y + Tw.y * pth - ocWaterline(lp);
        float frb = ocFreeboard(lp.y / OC_HULL.y);
        vec3 litP = vec3(0.45, 0.5, 0.58) * (uSkAmbLevel * (1.0 - 0.94 * dark)) + sunC * (4.8 * max(dot(nw, L.xz), 0.0) * sunVis)
                  + uSkMoonSea * (0.075 * max(dot(nw, uMoonDir.xz), 0.0));
        vec3 Nn = normalize(Ng);
        float rip = clamp(1.0 + 3.0 * dot(N.xz - Nn.xz, nw), 0.65, 1.1);
        vec3 pnt = ocHullAlbedo(yh, frb - yh) * litP * SK_PAINT * rip;
        vec3 tw = exp(-SK_EXT * pth);
        float see = smoothstep(0.002, 0.012, vRun.x) * (1.0 - smoothstep(0.008, 0.025, pth)) * smoothstep(0.02, 0.1, hzi);
        body = mix(body, pnt * tw + body * (1.0 - tw), see);
      }
    }
#endif
    sky = mix(sky, body * 2.5 + sky * 0.35, into * 0.35);
    col = mix(body, sky, F);
    float g = OC_ESUN * sunVis * ocGlint(N, V, L, m2g, nv);
    float gv = g * max(sunC.r, max(sunC.g, sunC.b));
    if (gv > 0.004) {
      float P = ocGlintP(N, V, L, m2g, 3.14159265 * uSunSize * uSunSize);
      g *= mix(1.0, ocSparkle(q, uh, fa, fb, P, t), smoothstep(0.1, 0.5, unres) * smoothstep(0.004, 0.02, gv));
    }
    g = g / (1.0 + g * 0.08);
    col += sunC * (g * (1.0 - shadow));
    if (uMoonLit > 0.0) {
      float m2m = m2 + 0.25 * SK_MOON_R * SK_MOON_R;
      float gm = OC_EMOON * ocGlint(N, V, uMoonDir, m2m, nv);
      gm = gm / (1.0 + gm * 0.5);
      float gmv = gm * max(uSkMoonSea.r, max(uSkMoonSea.g, uSkMoonSea.b));
      if (gmv > 0.002) {
        float Pm = ocGlintP(N, V, uMoonDir, m2m, 3.14159265 * SK_MOON_R * SK_MOON_R);
        gm *= mix(1.0, ocSparkle(q + 37.0, uh, fa, fb, Pm, t), 0.6 * smoothstep(0.1, 0.5, unres) * smoothstep(0.002, 0.01, gmv));
      }
      col += uSkMoonSea * gm;
    }
    if (uBtLamp > 0.0) {
      vec3 dl = uBtLampW - vWorld;
      float d2 = max(dot(dl, dl), 1.0);
      float gl = (2.5 * uBtLamp / d2) * ocGlint(N, V, dl * inversesqrt(d2), m2 + 0.002, nv);
      col += vec3(1.0, 0.62, 0.3) * (gl / (1.0 + gl));
    }
    if (uBead.w > 0.0) col += vec3(1.0, 0.96, 0.88) * min(OC_ESUN * 0.6 * uBead.w * ocGlint(N, V, normalize(uBead.xyz), m2g, nv), 6.0);
    if (dark > 0.0) col += vec3(0.70, 0.80, 1.00) * min(0.25 * dark * ocGlint(N, V, L, m2g + 0.006, nv), 4.0);
    float fSun = max(dot(Ns, L), 0.0) * sunVis * step(0.0, L.y);
    vec3 foamC = (vec3(0.88, 0.94, 1.0) * (0.9 * uSkAmbLevel + 0.65 * moonI) + sunC * (0.65 * OC_SUNREF * fSun)) * (1.1 * (1.0 - 0.94 * dark) * (1.0 - 0.3 * shadow));
    float nearF = smoothstep(28.0, 42.0, dist);
    float fm = ((1.0 - smoothstep(0.86, 0.91, Ng.y)) * 0.8 + smoothstep(0.36, 0.5, h) * 0.35) * nearF;
    if (fm > 0.001) col = mix(col, foamC, clamp(fm * ocFoamPatch(q, t, max(fa, fb)), 0.0, 1.0) * 0.55);
    if (OC_HULLFOAM && nearBoat && dh < 1.0) {
      float vh = uBoatMot.x - uBoatMot.y * lp.y + uBoatMot.z * lp.x;
      float closing = wv - vh;
      float dd = max(dh, 0.0);
      float along = max(OC_HULL.y - lp.y, 0.0);
      float side = lp.x >= 0.0 ? 1.0 : -1.0;
      float windw = clamp(-dot(nw, OC_WIND), 0.0, 1.0);
      float mem = 0.0;
      for (int k = 1; k <= 3; k++) {
        float tk = t - 0.6 * float(k), wk = 0.0;
        for (int i = 0; i < NWAVES; i++) wk -= W_A[i] * W_W[i] * cos(W_K[i] * dot(W_DIR[i], q) - W_W[i] * tk + W_P[i]);
        mem = max(mem, smoothstep(0.08, 0.55, wk - vh) * exp(-0.46 * float(k)));
      }
      float impact = max(smoothstep(0.08, 0.55, closing), mem) * (0.5 + 0.5 * bow + 0.3 * windw);
      float dayF = smoothstep(-0.05, 0.08, L.y);
      float ends = 1.0 - smoothstep(0.55, 0.85, abs(nh.y));
      float brk = smoothstep(0.3, 0.75, impact);
      float lw = max(0.03 + 0.05 * brk, 1.2 * fb);
      float gaps = 0.7 * skNoise(vec2(along * 2.6 + side * 11.7 - t * 0.6, t * 0.45 + side * 3.1))
                 + 0.3 * skNoise(vec2(along * 7.1 - side * 4.1 + t * 0.5, t * 0.8 - side * 8.3));
      float crest = (1.0 - smoothstep(0.5 * lw, lw, dd)) * smoothstep(0.6, 0.7, gaps) * brk * ends;
      crest *= 1.0 - smoothstep(0.0, 0.05, ocWaterline(lp) - vWorld.y);
      float nightA = mix(0.25, 1.0, dayF);
      col = mix(col, foamC * (0.9 + 0.3 * impact * dayF), clamp(crest, 0.0, 1.0) * 0.85 * nightA);
    }
#ifdef OC_SKIRT
    vec2 pc = vec2(vSkL.x * 38.0, -(vWorld.y + 0.1 * t) * 38.0 + vSkX * 25.0);
    vec2 fw2 = fwidth(pc);
    if (nearBoat && vSkL.y > 0.01) {
      float X = max(vSkM, 0.03) + 0.4 * vRun.x;
      float band = 1.0 - smoothstep(0.35 * X, X, vSkX + 0.25 * X * (skNoise(vec2(vSkL.x * 9.0 - 4.1, t * 0.6)) - 0.5));
      band *= smoothstep(0.0, 0.015, vSkX);
      if (band > 0.0) {
        vec2 rn = spRun(vSkL.z, vWorld.y - ocWaterline(lp), 0.0, 0.0, vSkL.w);
        float brk = smoothstep(0.48, 0.64, 0.7 * skNoise(vec2(vSkL.x * 2.6 + 1.3, t * 0.3)) + 0.3 * skNoise(vec2(vSkL.x * 7.0 - 2.1, t * 0.7)));
        float dens = min(vSkL.y * band * (0.3 + 0.9 * rn.y) * brk * sqrt(0.035 / X) * 1.4, 0.8);
        float fwc = max(fw2.x, fw2.y), kl = 1.0 - smoothstep(0.15, 0.5, fwc);
        float w = kl > 0.0 ? 0.55 * skLace(pc, fwc) + 0.45 * skLace(pc * 2.3 + 5.1, 2.3 * fwc) : SK_LACE;
        w = mix(SK_LACE, w, kl);
        float wd = 0.12 + kl * min(0.55 * fwc / (0.17 + 3.0 * fwc) + 1.035 * fwc / (0.17 + 6.9 * fwc), 0.2);
        float cov = smoothstep(1.175 - dens - wd, 1.175 - dens + wd, w + 0.1);
        col = mix(col, foamC * 0.95, min(cov, 0.55) * mix(0.3, 1.0, smoothstep(-0.05, 0.08, L.y)));
      }
    }
#endif
    col = ocNoMagenta(col);
    float twl = (1.0 - smoothstep(0.05, 0.25, L.y)) * smoothstep(-0.2, -0.04, L.y);
    if (twl > 0.0) {
      float onPath = smoothstep(0.965, 0.997, dot(uh, lh));
      col = mix(col, dot(col, OC_LUMA) * vec3(0.86, 0.97, 1.2), 0.75 * twl * (1.0 - onPath));
    }
    vec3 hz = skyBase(normalize(vec3(rd.x, 0.012, rd.z)));
    col = mix(col, hz, 1.0 - exp(-dist / 2600.0));
  } else {
    float ci = clamp(dot(rd, N), 0.0, 1.0);
    vec3 eta = vec3(1.3310, 1.3330, 1.3365);
    vec3 s2 = eta * eta * (1.0 - ci * ci);
    vec3 ct = sqrt(max(1.0 - s2, 0.0));
    vec3 rs = (eta * ci - ct) / max(eta * ci + ct, vec3(1e-5));
    vec3 rp = (ci - eta * ct) / max(ci + eta * ct, vec3(1e-5));
    float wT = clamp(3.0 * sqrt(m2), 0.02, 0.25);
    vec3 Rf = mix(clamp(0.5 * (rs * rs + rp * rp), 0.0, 1.0), vec3(1.0), smoothstep(vec3(1.0 - wT), vec3(1.0 + wT), s2));
    if (uRiseMir.w > 0.0) {
      float wR = wT + uRiseMir.w * (0.3 + 2.5 * fwidth(s2.g));
      vec3 s2c = min(s2, vec3(1.0 - wR));
      vec3 ctc = sqrt(1.0 - s2c), cic = sqrt(max(1.0 - s2c / (eta * eta), 0.0));
      vec3 rsc = (eta * cic - ctc) / max(eta * cic + ctc, vec3(1e-5)), rpc = (cic - eta * ctc) / max(cic + eta * ctc, vec3(1e-5));
      vec3 Rr = mix(0.5 * (rsc * rsc + rpc * rpc), vec3(1.0), smoothstep(vec3(1.0 - wR), vec3(1.0 + 0.5 * wR), s2));
      Rf = mix(Rf, Rr, min(uRiseMir.w / 0.6, 1.0));
    }
    vec3 Tf = 1.0 - Rf;
    vec3 T = refract(rd, -N, 1.333);
    vec3 Ts = dot(T, T) > 1e-6 ? T : vec3(rd.x, 0.0, rd.z);
    Ts = normalize(vec3(Ts.x, max(Ts.y, 0.002), Ts.z));
    float kap = clamp(1.333 * ci / max(ct.g, 0.05) - 1.0, 0.333, 10.0);
    vec3 win = skyReflect(Ts, kap * sqrt(0.5 * m2)) * Tf * 1.6;
    float sg = kap * sqrt(0.5 * m2g);
    float sT2 = uSunSize * uSunSize + sg * sg;
    float a2 = 2.0 * max(1.0 - dot(Ts, L), 0.0);
    win += sunC * Tf * (sunVis * min(0.03 * exp(-a2 / (2.0 * sT2)) / (6.2831853 * sT2), 18.0));
    if (uMoonLit > 0.0) {
      float r0 = SK_MOON_R;
      float smo = min(kap * sqrt(0.5 * m2), 1.5 * r0);
      float am = length(Ts - uMoonDir);
      float ew = 0.12 * r0 + 0.5 * smo + 1.5 * uPixAng;
      float mdisc = 1.0 - smoothstep(r0 - ew, r0 + ew, am);
      if (mdisc > 0.0) {
        vec3 e1 = normalize(abs(uMoonDir.y) < 0.99 ? cross(uMoonDir, vec3(0.0, 1.0, 0.0)) : vec3(1.0, 0.0, 0.0));
        vec3 e2 = cross(e1, uMoonDir);
        vec2 o = vec2(dot(Ts - uMoonDir, e1), dot(Ts - uMoonDir, e2)) / r0;
        float z = sqrt(max(1.0 - dot(o, o), 0.0));
        mdisc *= smoothstep(-0.08, 0.08, dot(o.x * e1 + o.y * e2 - z * uMoonDir, uSkMoonSun));
      }
      float glow = 0.02 * exp(-am / (5.0 * r0)) * (0.5 - 0.5 * dot(uSkMoonSun, uMoonDir));
      win += uSkMoonSea * Tf * ((mdisc + glow) * OC_MOONW * uMoonWin);
    }
    vec3 Rw = reflect(rd, N);
    vec3 deepC = mix(vec3(0.010, 0.110, 0.150), vec3(0.002, 0.022, 0.050), sqrt(clamp(-Rw.y, 0.0, 1.0))) * (uSkAmbLevel * max(uLight, (1.0 + uMoonLit) * (1.0 - smoothstep(-0.139, 0.139, uSunDir.y))));
    if (uRiseMir.w > 0.0) {
      deepC = max(deepC, uRiseMir.rgb * mix(1.0, 0.45, sqrt(clamp(-Rw.y, 0.0, 1.0))));
      float da = max(dot(normalize(Ts.xz + vec2(1e-5)), normalize(uSunDir.xz + vec2(1e-5))), 0.0);
      vec3 lid = uRiseMir.rgb * vec3(1.38, 1.28, 1.22) + uRiseDawn * ((0.4 + 0.6 * da * da) * (0.12 + 0.88 * exp(-max(Ts.y, 0.0) * 4.0)));
      win = win * (1.0 + uRiseMir.w) + lid * Tf;
    }
    col = win + deepC * Rf;
    vec3 sw2 = uSunW / max(length(uSunW), 1e-4);
    float sb = dot(sunC, OC_LUMA) * 1.1 * sunVis;
    if (sb > 0.0 && dot(rd, sw2) > 0.8) {
      vec3 bc = cross(sw2, vec3(0.0, 0.0, 1.0));
      vec3 b1 = bc / max(length(bc), 1e-4);
      vec3 b2 = cross(sw2, b1);
      vec2 pp = vec2(dot(rd, b1), dot(rd, b2));
      float th = length(pp);
      vec2 u = pp / max(th, 1e-6);
      float c3 = u.x * u.x * u.x - 3.0 * u.x * u.y * u.y;
      vec2 w = vec2(u.x * 0.9848 - u.y * 0.1736, u.x * 0.1736 + u.y * 0.9848);
      float c3b = w.x * w.x * w.x - 3.0 * w.x * w.y * w.y;
      float rays = pow(abs(c3), 80.0) + 0.45 * pow(abs(c3b), 140.0);
      float glare = rays * exp(-th * 10.0) * 2.2 + exp(-th * 40.0) * 3.0 + exp(-th * 6.0) * 0.35;
      col += vec3(1.0, 0.98, 0.93) * (glare * sb);
    }
  }
  gl_FragColor = vec4(clamp(col, 0.0, 24.0), 1.0);
}
`;

const WET_VERT = `
varying vec3 vW;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;
const WET_FRAG = `
uniform float uTime;
uniform float uWash;
${WAVES_GLSL}
varying vec3 vW;
float wbH(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float wbN(vec2 p) {
  vec2 i = floor(p), f = p - i;
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(wbH(i), wbH(i + vec2(1.0, 0.0)), u.x), mix(wbH(i + vec2(0.0, 1.0)), wbH(i + vec2(1.0, 1.0)), u.x), u.y);
}
void main() {
  float t = uTime;
  vec2 p = vW.xz;
  float hm = max(max(waveHeightAt(p, t), waveHeightAt(p, t - 0.4) - 0.015), max(waveHeightAt(p, t - 0.9) - 0.04, waveHeightAt(p, t - 1.6) - 0.08));
  float sa = (vW.x + vW.z) * 6.0;
  float top = hm + 0.04 + 0.14 * uWash + (wbN(vec2(sa, t * 0.35)) - 0.5) * 0.06 + (wbN(vec2(sa * 2.3, vW.y * 2.0 + t * 0.15)) - 0.5) * 0.05;
  float wet = 1.0 - smoothstep(top - 0.03, top + 0.06, vW.y);
  gl_FragColor = vec4(0.015, 0.02, 0.025, 0.22 * wet);
}
`;
function buildWetBand() {
  if (typeof hullPoint !== 'function') return null;
  const Y = [-0.1, 0.0, 0.07, 0.14, 0.21, 0.28, 0.36, 0.44, 0.52];
  const NU = 72;
  const p = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), d = new THREE.Vector3(), n = new THREE.Vector3();
  const vAt = (u, y) => {
    let lo = 0, hi = 1;
    for (let k = 0; k < 30; k++) { const m = 0.5 * (lo + hi); hullPoint(u, m, 1, p); if (p.y < y) lo = m; else hi = m; }
    return 0.5 * (lo + hi);
  };
  const pos = [], idx = [];
  for (const side of [1, -1]) {
    const base = pos.length / 3;
    for (let i = 0; i <= NU; i++) {
      const u = Math.sin(((i / NU) * 2 - 1) * Math.PI * 0.5) * 0.995;
      for (let j = 0; j < Y.length; j++) {
        const v = vAt(u, Y[j]);
        hullPoint(u, v, side, p);
        hullPoint(Math.min(1, u + 1e-3), v, side, a); hullPoint(Math.max(-1, u - 1e-3), v, side, b);
        hullPoint(u, Math.min(1, v + 1e-3), side, c); hullPoint(u, Math.max(0, v - 1e-3), side, d);
        a.sub(b); c.sub(d);
        n.crossVectors(a, c).normalize();
        if (n.x * side < 0) n.negate();
        pos.push(p.x + n.x * 0.004, p.y + n.y * 0.004, p.z + n.z * 0.004);
      }
    }
    for (let i = 0; i < NU; i++) {
      for (let j = 0; j + 1 < Y.length; j++) {
        const a0 = base + i * Y.length + j, a1 = a0 + 1, b0 = a0 + Y.length, b1 = b0 + 1;
        idx.push(a0, b0, a1, a1, b0, b1);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
  geo.setIndex(new THREE.BufferAttribute(new Uint32Array(idx), 1));
  return geo;
}

const SK_N = SPRAY_SLOTS;
const SK_EDGE = 1.1;
const SKIRT_VERT = `
uniform float uTime;
uniform vec4 uBoatMot;
uniform vec2 uBoatTilt;
uniform vec4 uSpA[${SK_N}];
uniform vec4 uSpB[${SK_N}];
uniform vec4 uSpC[${SK_N}];
uniform vec4 uSpD[${SK_N}];
uniform float uSkAct[${SK_N}];
uniform int uSkActN;
uniform float uSkLen;
uniform float uPixAng;
attribute vec3 aSk;
attribute vec4 aSs;
attribute vec4 aSh;
attribute vec3 aSa;
varying vec3 vWorld;
varying vec2 vLag;
varying vec3 vRun;
varying float vSkX;
varying vec4 vSkL;
varying float vSkM;
${WAVES_GLSL}
${SPRAY_RISE_GLSL || 'float spTongue(float a, vec4 C) { return 1.0; }\nfloat spTongueK(float a, float t, vec4 B, vec4 C) { return 1.0; }\nfloat spRise(float t, vec4 B) { return 0.0; }\nfloat spRiseAt(float t, vec4 B, vec4 C, float a) { return 0.0; }\nbool spAt(int i, float s, float sd, out float t, out float a, out float W) { t = 0.0; a = 0.0; W = 1.0; return false; }\nfloat spRiseSum(float s, float sd) { return 0.0; }'}
float skSea(vec2 w, float span, out vec2 p) {
  p = w;
  for (int j = 0; j < 3; j++) {
    vec2 dsp = vec2(0.0);
    for (int i = 0; i < NWAVES; i++) {
      float lam = 6.2831853 / W_K[i];
      float A = W_A[i] * (1.0 - smoothstep(lam * 0.14, lam * 0.26, span));
      dsp += W_DIR[i] * (W_Q[i] * A * cos(W_K[i] * dot(W_DIR[i], p) - W_W[i] * uTime + W_P[i]));
    }
    p = w - dsp;
  }
  float y = 0.0;
  for (int i = 0; i < NWAVES; i++) {
    float lam = 6.2831853 / W_K[i];
    float A = W_A[i] * (1.0 - smoothstep(lam * 0.14, lam * 0.26, span));
    y += A * sin(W_K[i] * dot(W_DIR[i], p) - W_W[i] * uTime + W_P[i]);
  }
  return y;
}
float skOut(float h) {
  return (h > 0.0 ? (aSh.x + aSa.z * h) * h : max(aSh.y * h, -0.08)) + h * (uBoatTilt.x * aSk.z - uBoatTilt.y * aSk.y);
}
float skRow(float d, float c) { return max(d < 0.0 ? c + d : c + d * (${g7(SK_EDGE)} - c) / ${g7(SK_EDGE)}, aSa.y); }
float skSoft(float x, float k) { return max(x, 0.0) + k * log(1.0 + exp(-abs(x) / k)); }
const int SK_M = 6;
int kn;
int ki[SK_M];
float kt[SK_M], ka[SK_M], kw[SK_M], kg[SK_M];
void skFind(float s, float sd) {
  kn = 0;
  for (int j = 0; j < ${SK_N}; j++) {
    if (j >= uSkActN) break;
    int i = int(uSkAct[j] + 0.5);
    float t, a, W;
    if (kn < SK_M && spAt(i, s, sd, t, a, W)) {
      ki[kn] = i; kt[kn] = t; ka[kn] = a; kw[kn] = W; kg[kn] = sd * uSpD[i].w < 0.0 ? -1.0 : 1.0;
      kn++;
    }
  }
}
float skRise(float da) {
  float R = 0.0;
  for (int k = 0; k < SK_M; k++) {
    if (k >= kn) break;
    int i = ki[k];
    R += spRiseAt(kt[k], uSpB[i], uSpC[i], ka[k] + kg[k] * da);
  }
  return R;
}
float skHeap(float dw, float c, float da) {
  float h = 0.0, x = dw - c;
  for (int k = 0; k < SK_M; k++) {
    if (k >= kn) break;
    int i = ki[k];
    vec4 B = uSpB[i], C = uSpC[i];
    float t = kt[k], a = ka[k] + kg[k] * da, W = kw[k];
    float g = exp(-a * a / (W * W));
    float L = B.w > 0.5 ? 0.05 + 0.06 * t : 0.025 + 0.04 * t, xs = skSoft(x, 0.2 * L), tg = spTongueK(a, t, B, C);
    h += spRise(t, B) * g * (B.w > 0.5 ? 0.85 * tg * exp(-xs / L) + 0.15 * exp(-xs / (3.0 * L)) : tg * exp(-xs / L));
    float E = B.z, tb = t - E / 9.81;
    if (tb > 0.0) {
      float xc = 0.05 + 0.75 * tb, wc = 0.1 + 0.2 * tb, dx = x - xc;
      h += 0.1 * min(E * E / 19.62, 0.3) * g * smoothstep(0.0, 0.1, tb) * exp(-tb / 0.4 - dx * dx / (wc * wc));
    }
  }
  return h * (1.0 - smoothstep(0.6, 1.05, dw));
}
vec4 skAer() {
  float A = 0.0, X = 0.0, best = 0.0, ab = 0.0, pb = 0.0;
  for (int k = 0; k < SK_M; k++) {
    if (k >= kn) break;
    int i = ki[k];
    vec4 B = uSpB[i], C = uSpC[i];
    float t = kt[k], a = ka[k], W = kw[k];
    float E = B.z, ta = E / 9.81;
    float kk = (B.w > 0.5 ? smoothstep(0.8, 2.4, E) : 0.6 * smoothstep(1.3, 2.4, E)) * exp(-a * a / (W * W));
    float w = kk * smoothstep(0.4 * ta, 0.4 * ta + 0.14, t) * exp(-max(t - 0.7 * ta, 0.0) / 0.3);
    A += w;
    X += w * (0.035 + 0.45 * max(t - 0.7 * ta, 0.0));
    if (w > best) { best = w; ab = a; pb = C.w * 37.0 + float(i) * 3.1; }
  }
  return vec4(min(A, 1.0), X / max(A, 1e-4), ab, pb);
}
void main() {
  vec2 n0 = aSk.yz;
  vec3 w0 = (modelMatrix * vec4(position, 1.0)).xyz;
  float sp0 = length(w0.xz - cameraPosition.xz);
  sp0 = max(${g7((2 * Math.PI) / 320)} * sp0, ${g7((3 * 0.00065) / 1.7)} * sp0 * sp0);
  vec2 p;
  float s = aSs.x, sd = aSs.y;
  skFind(s, sd);
  float R = kn > 0 ? skRise(0.0) : 0.0;
  float hq = skSea(w0.xz, sp0, p) - (uBoatMot.w - position.z * uBoatTilt.x + position.x * uBoatTilt.y);
  if (kn > 0) {
    vec3 q = position + vec3(n0.x, 0.0, n0.y) * skOut(hq + R);
    hq = skSea((modelMatrix * vec4(q, 1.0)).xz, sp0, p) - (uBoatMot.w - q.z * uBoatTilt.x + q.x * uBoatTilt.y);
  }
  float c = skOut(hq + R);
  vec2 nW = normalize((modelMatrix * vec4(n0.x, 0.0, n0.y, 0.0)).xz);
  vec3 vv = normalize(w0 - cameraPosition), nn = vec3(nW.x, 0.0, nW.y);
  float ppm = length(nn - vv * dot(vv, nn)) / max(length(w0 - cameraPosition) * uPixAng, 1e-6);
  float G = 0.015 * exp2(clamp(ceil(log2(1.5 / max(0.015 * ppm, 1e-4))), 0.0, 4.0));
  float rowD = aSk.x > 0.0 ? min(floor(aSk.x / G + 0.5) * G, ${g7(SK_EDGE)}) : aSk.x;
  float dw = skRow(rowD, c);
  vec3 w = (modelMatrix * vec4(position + vec3(n0.x, 0.0, n0.y) * dw, 1.0)).xyz;
  float rr = length(w.xz - cameraPosition.xz);
  float y = skSea(w.xz, max(${g7((2 * Math.PI) / 320)} * rr, ${g7((3 * 0.00065) / 1.7)} * rr * rr), p);
  float hk = 0.0, gx = 0.0, gs = 0.0;
  vec4 ae = vec4(0.0, 0.035, 0.0, 0.0);
  if (kn > 0) {
    hk = skHeap(dw, c, 0.0);
    float dm = skRow(aSk.x - aSh.z, c), dp = skRow(aSk.x + aSh.w, c), ds = aSa.x;
    gx = (skHeap(dp, c, 0.0) - skHeap(dm, c, 0.0)) / max(dp - dm, 0.002);
    gs = (skHeap(dw, skOut(hq + skRise(ds)), ds) - skHeap(dw, skOut(hq + skRise(-ds)), -ds)) / (2.0 * ds);
    ae = skAer();
  }
  vec2 n = normalize((modelMatrix * vec4(n0.x, 0.0, n0.y, 0.0)).xz);
  vec2 tg = normalize((modelMatrix * vec4(aSs.z, 0.0, aSs.w, 0.0)).xz);
  vRun = vec3(hk, tg * gs + n * gx);
  vSkX = dw - c;
  vSkL = vec4(s, ae.x, ae.z, ae.w);
  vSkM = ae.y;
  vLag = p;
  vWorld = vec3(w.x, y + hk, w.z);
  gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
}
`;
const SK_FAN = 8;
function buildSkirt() {
  if (typeof waterline !== 'function') return null;
  const S = BOAT_SCALE, NW = 360;
  const wl = waterline(NW, 0), w3 = waterline(NW, 0.3), w7 = waterline(NW, 0.7), wd = waterline(NW, -0.1);
  const port = [];
  for (let i = 0; i <= NW; i++) {
    const q = wl[i], l = Math.hypot(q.nx, q.nz) || 1, nx = q.nx / l, nz = q.nz / l;
    const out = (r) => (r.x - q.x) * nx + (r.z - q.z) * nz;
    const o3 = out(w3[i]), fq = (out(w7[i]) - (7 / 3) * o3) / 0.28;
    port.push({ x: q.x * S, z: q.z * S, nx, nz, s: 0, tx: 0, tz: 1, fu: Math.max((o3 - 0.09 * fq) / 0.3, 0), fq, fd: Math.max(-out(wd[i]) / 0.1, 0) });
  }
  for (let i = 1; i <= NW; i++) port[i].s = port[i - 1].s + Math.hypot(port[i].x - port[i - 1].x, port[i].z - port[i - 1].z);
  for (let i = 0; i <= NW; i++) {
    const i0 = Math.max(0, i - 1), i1 = Math.min(NW, i + 1), a = port[i0], b = port[i1], l = Math.hypot(b.x - a.x, b.z - a.z) || 1;
    port[i].tx = (b.x - a.x) / l; port[i].tz = (b.z - a.z) / l;
    port[i].ds = Math.max((b.s - a.s) / (i1 - i0), 0.005);
  }
  const fan = (q, a0, a1, s0) => {
    for (let k = 1; k < SK_FAN; k++) {
      const f = k / SK_FAN, an = a0 + (a1 - a0) * f, sd = f < 0.5 ? s0 : -s0;
      pts.push({ ...q, x: s0 * q.x * (1 - 2 * f), nx: Math.sin(an), nz: Math.cos(an), tx: sd * q.tx, side: sd });
    }
  };
  const pts = port.map((q) => ({ ...q, side: 1 }));
  const stem = port[NW], ast = Math.atan2(stem.nx, stem.nz);
  fan(stem, ast, -ast, 1);
  for (let i = NW - 1; i >= 1; i--) {
    const q = port[i];
    pts.push({ ...q, x: -q.x, nx: -q.nx, tx: -q.tx, side: -1 });
  }
  const stern = port[0], asn = Math.atan2(stern.nx, stern.nz);
  fan(stern, 2 * Math.PI - asn, asn, -1);
  const D = [-0.3, -0.14, -0.05, 0.0, 0.015, 0.03, 0.045, 0.06, 0.08, 0.1, 0.125, 0.155, 0.19, 0.235, 0.29, 0.36, 0.45, 0.6, 0.8, SK_EDGE];
  const M = pts.length, R = D.length;
  let area = 0;
  for (let i = 0; i < M; i++) { const a = pts[i], b = pts[(i + 1) % M]; area += a.x * b.z - b.x * a.z; }
  const up = area < 0;
  const pos = [], sk = [], ss = [], sh = [], sa = [], idx = [];
  for (const q of pts) {
    const din = -0.45 * Math.abs(q.x);
    D.forEach((d, j) => {
      pos.push(q.x, 0, q.z);
      sk.push(d, q.nx, q.nz);
      ss.push(q.s, q.side, q.tx, q.tz);
      sh.push(q.fu, q.fd, j ? d - D[j - 1] : D[1] - D[0], j + 1 < R ? D[j + 1] - d : d - D[j - 1]);
      sa.push(q.ds, din, q.fq);
    });
  }
  for (let i = 0; i < M; i++) {
    const i2 = (i + 1) % M;
    for (let j = 0; j + 1 < R; j++) {
      const a = i * R + j, b = a + 1, c = i2 * R + j, d = c + 1;
      if (up) idx.push(a, b, c, b, d, c);
      else idx.push(a, c, b, b, c, d);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('aSk', new THREE.Float32BufferAttribute(sk, 3));
  geo.setAttribute('aSs', new THREE.Float32BufferAttribute(ss, 4));
  geo.setAttribute('aSh', new THREE.Float32BufferAttribute(sh, 4));
  geo.setAttribute('aSa', new THREE.Float32BufferAttribute(sa, 3));
  geo.setIndex(idx);
  geo.userData.len = port[NW].s;
  return geo;
}

function buildGrid(detail = 1) {
  const M = Math.max(96, Math.round((320 * Math.min(1, Math.max(0.3, detail))) / 8) * 8), RMAX = 1650;
  const ring = (2 * Math.PI) / M;
  const quad = (3 * 0.00065) / 1.7;
  const radii = [0.2];
  while (radii[radii.length - 1] < RMAX) {
    const r = radii[radii.length - 1];
    const nr = r + Math.max(ring * r, quad * r * r);
    radii.push(nr > RMAX * 0.97 ? RMAX : nr);
  }
  const NRG = radii.length;
  const pos = new Float32Array((1 + NRG * M) * 3);
  const span = new Float32Array(1 + NRG * M);
  span[0] = radii[0];
  let k = 3, s = 1;
  for (let j = 0; j < NRG; j++) {
    const r = radii[j];
    const dr = Math.max(j + 1 < NRG ? radii[j + 1] - r : 0, j > 0 ? r - radii[j - 1] : r);
    const sp = Math.max(dr, ring * r);
    for (let i = 0; i < M; i++) {
      const a = i * ring;
      pos[k++] = r * Math.cos(a); pos[k++] = 0; pos[k++] = r * Math.sin(a);
      span[s++] = sp;
    }
  }
  const idx = new Uint32Array(M * 3 + (NRG - 1) * M * 6);
  let n = 0;
  for (let i = 0; i < M; i++) {
    idx[n++] = 0; idx[n++] = 1 + ((i + 1) % M); idx[n++] = 1 + i;
  }
  for (let j = 0; j + 1 < NRG; j++) {
    for (let i = 0; i < M; i++) {
      const i1 = (i + 1) % M;
      const a = 1 + j * M + i, b = 1 + j * M + i1, c = 1 + (j + 1) * M + i, d = 1 + (j + 1) * M + i1;
      idx[n++] = a; idx[n++] = b; idx[n++] = c;
      idx[n++] = b; idx[n++] = d; idx[n++] = c;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSpan', new THREE.BufferAttribute(span, 1));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  return geo;
}

class Ocean {
  constructor(scene, { detail = 1 } = {}) {
    const boat = LAYOUT.boat, hd = LAYOUT.boatHeading;
    this.mot = new THREE.Vector4();
    this.tilt = new THREE.Vector2();
    this.material = new THREE.ShaderMaterial({
      uniforms: Object.assign({}, SKY_UNIFORMS, {
        uTime: U.uTime, uLight: U.uLight, uSunW: U.uSunW, uPixAng: { value: 0.0008 },
        uBoat: { value: new THREE.Vector4(boat.x, boat.z, Math.cos(hd), Math.sin(hd)) },
        uBoatMot: { value: this.mot },
        uBoatTilt: { value: this.tilt },
        uBtLamp: (BT_U && BT_U.uBtLamp) || { value: 0 },
        uBtLampW: (BT_U && BT_U.uBtLampW) || { value: new THREE.Vector3() },
        uHull: { value: HULL$1 },
        uHullP: { value: HULL_P },
        uRiseMir: { value: new THREE.Vector4() },
        uRiseDawn: { value: new THREE.Vector3() },
        uXing: WATER.uXing, uLensR: WATER.uLensR, uSceneH: WATER.uSceneH,
      }),
      vertexShader: VERT$4,
      fragmentShader: FRAG$3,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    });
    this.mesh = new THREE.Mesh(buildGrid(detail), this.material);
    this.mesh.frustumCulled = false;
    const vp = new THREE.Vector4();
    const pix = this.material.uniforms.uPixAng;
    this.mesh.onBeforeRender = (renderer, scene, camera) => {
      renderer.getCurrentViewport(vp);
      const e = camera.projectionMatrix.elements[5];
      if (vp.w > 0 && e > 0) pix.value = 2 / (e * vp.w);
    };
    scene.add(this.mesh);

    this.wetU = { uTime: U.uTime, uWash: { value: 0 } };
    this.wetS = new THREE.Matrix4();
    this.wet = null;
    try {
      const wg = buildWetBand();
      if (wg) {
        const wet = new THREE.Mesh(wg, new THREE.ShaderMaterial({
          uniforms: this.wetU, vertexShader: WET_VERT, fragmentShader: WET_FRAG,
          transparent: true, depthWrite: false, side: THREE.DoubleSide,
          polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2,
        }));
        wet.frustumCulled = false;
        wet.matrixAutoUpdate = false;
        wet.matrixWorldAutoUpdate = false;
        wet.visible = false;
        wet.renderOrder = 2;
        wet.onBeforeRender = () => { if (this.boatGrp) wet.matrixWorld.multiplyMatrices(this.boatGrp.matrixWorld, this.wetS); };
        scene.add(wet);
        this.wet = wet;
      }
    } catch (e) { this.wet = null; }

    this.skirt = null;
    this.sprayU = null;
    const v4 = () => Array.from({ length: SK_N }, () => new THREE.Vector4(0, 0, 0, -100));
    this.skU = { uSpA: { value: v4() }, uSpB: { value: v4() }, uSpC: { value: v4() }, uSpD: { value: v4() }, uSkLen: { value: 11 }, uSkAct: { value: new Array(SK_N).fill(0) }, uSkActN: { value: 0 } };
    try {
      const sg = buildSkirt();
      if (sg) {
        this.skU.uSkLen.value = sg.userData.len;
        const sk = new THREE.Mesh(sg, new THREE.ShaderMaterial({
          uniforms: Object.assign({}, this.material.uniforms, this.skU),
          defines: { OC_SKIRT: '' },
          vertexShader: SKIRT_VERT,
          fragmentShader: FRAG$3,
          side: THREE.DoubleSide,
          polygonOffset: true,
          polygonOffsetFactor: 1,
          polygonOffsetUnits: 1,
        }));
        sk.frustumCulled = false;
        sk.renderOrder = -1;
        sk.onBeforeRender = this.mesh.onBeforeRender;
        scene.add(sk);
        this.skirt = sk;
      }
    } catch (e) { this.skirt = null; }

    this.scene = scene;
    this.foamObj = null;
    this.hideFoamRing = true;
    this.boatGrp = null;
    this.boatLook = 0;
    this.lastT = -1;
    this.lastY = 0;
    this.lastP = 0;
    this.lastR = 0;
  }
  update(camera) {
    this.mesh.position.set(camera.position.x, 0, camera.position.z);
    if ((!this.foamObj || !this.boatGrp || !this.sprayU) && this.boatLook < 600) { this.boatLook++; findBoat(this.scene, this); }
    if (this.foamObj && this.hideFoamRing && this.foamObj.visible) this.foamObj.visible = false;
    const f = this.foamObj || this.boatGrp;
    if (f) this.material.uniforms.uBoat.value.set(f.position.x, f.position.z, Math.cos(f.rotation.y), Math.sin(f.rotation.y));
    if (this.skirt && f) {
      this.skirt.position.set(f.position.x, 0, f.position.z);
      this.skirt.rotation.set(0, f.rotation.y, 0);
      const s = this.sprayU, k = this.skU;
      if (s && k.uSpA.value !== s.uSpA.value) {
        k.uSpA.value = s.uSpA.value; k.uSpB.value = s.uSpB.value; k.uSpC.value = s.uSpC.value; k.uSpD.value = s.uSpD.value;
      }
      if (s && s.uTime) {
        const t = s.uTime.value, A = s.uSpA.value, B = s.uSpB.value, act = k.uSkAct.value;
        let n = 0;
        for (let i = 0; i < A.length && n < act.length; i++) if (B[i].z > 0 && t - A[i].w >= -0.05 && t - A[i].w <= 3.02) act[n++] = i;
        k.uSkActN.value = n;
        this.skirt.visible = n > 0;
      }
    }
    const g = this.boatGrp;
    if (g) {
      const t = U.uTime.value, dt = t - this.lastT, m = this.mot;
      if (this.lastT >= 0 && dt > 1e-4 && dt < 0.5) {
        const k = 1 - Math.exp(-dt * 6);
        m.x += ((g.position.y - this.lastY) / dt - m.x) * k;
        m.y += ((g.rotation.x - this.lastP) / dt - m.y) * k;
        m.z += ((g.rotation.z - this.lastR) / dt - m.z) * k;
      }
      const ud = g.userData || {};
      m.w = g.position.y + (Number.isFinite(ud.waterline) ? ud.waterline : 0.17);
      this.tilt.set(Math.sin(g.rotation.x), Math.sin(g.rotation.z));
      if (this.hullFor !== ud || this.hullFit !== 'outline') {
        const wo = ud.waterlineOutline;
        if (Array.isArray(wo) && wo.length >= 8) {
          const sx = Math.abs(g.scale.x) || 1, sz = Math.abs(g.scale.z) || 1;
          fillHull(wo.map((q) => ({ x: (Array.isArray(q) ? q[0] : q.x) * sx, z: (Array.isArray(q) ? q[1] : q.z) * sz })));
          this.hullFit = 'outline'; this.hullFor = ud;
        } else if (this.hullFor !== ud && Number.isFinite(ud.waterlineLocalY)) {
          fillHull(waterlinePts(ud.waterlineLocalY));
          this.hullFit = 'lines'; this.hullFor = ud;
        }
      }
      this.lastT = t;
      this.lastY = g.position.y;
      this.lastP = g.rotation.x;
      this.lastR = g.rotation.z;
    }
    if (this.wet && g && !(g.userData && g.userData.hullWetBand)) {
      if (!this.wet.visible) {
        const k = g.scale && Math.abs(g.scale.x - 1) > 0.01 ? 1 : BOAT_SCALE;
        this.wetS.makeScale(k, k, k);
        this.wet.visible = true;
      }
      this.wetU.uWash.value = Math.min(1, 1.2 * Math.abs(this.mot.x) + 4 * Math.abs(this.mot.y));
    }
  }
}

function findBoat(scene, o) {
  const ch = scene.children, bx = LAYOUT.boat.x, bz = LAYOUT.boat.z;
  for (let i = 0; i < ch.length; i++) {
    const c = ch[i];
    const u = c.material && c.material.uniforms;
    if (!o.foamObj && u && u.uFoamSpark) o.foamObj = c;
    if (!o.sprayU && u && u.uSpA && u.uSpD && u.uBoatM) o.sprayU = u;
    if (!o.boatGrp && c.isGroup && c.rotation.order === 'YXZ' && Math.abs(c.position.x - bx) < 6 && Math.abs(c.position.z - bz) < 6) o.boatGrp = c;
  }
}

