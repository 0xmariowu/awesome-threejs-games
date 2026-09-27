// boat.js
const T = {
  PLAIN: 0, WOOD: 1, DECK: 2, CANVAS: 3, WICKER: 4, PAINT: 5, SPONGE: 6, CLAY: 7, METAL: 8, CLOTH: 9,
  HULL: 10, BULWARK: 11, TIMBER: 12, GLASS: 13, DIAL: 14, NAME: 15, SAND: 16, HOSE: 17, NET: 18, GRIP: 19,
};

const C = {
  white: lin(0xe2dccb), black: lin(0x262320), red: lin(0xa8322a), ochre: lin(0xc99a3a),
  primer: lin(0xc0662e), deck: lin(0xb89366), deckGrey: lin(0x9a8f7c), tar: lin(0x1e1a16),
  wood: [0.30, 0.19, 0.10], woodDark: [0.15, 0.09, 0.05], woodGrey: [0.34, 0.25, 0.16], spar: [0.36, 0.25, 0.14],
  teak: lin(0x7a4e2a), brass: [0.78, 0.56, 0.20], iron: [0.035, 0.034, 0.033],
  hemp: lin(0xa68b5b), tarred: lin(0x4a3b2a), manila: lin(0xa39478), canvas: lin(0xd8cbaa), canvasDressed: lin(0xc29a62),
  wicker: [0.40, 0.27, 0.12], spongeTan: lin(0xc49a5c), spongeDark: lin(0x3a2c1f),
  clay: lin(0xb4643c), rubber: [0.028, 0.027, 0.026], glass: [0.55, 0.56, 0.52], dial: [0.80, 0.78, 0.71],
  sack: lin(0xa89572), navy: lin(0x1b2433), cotton: lin(0xe6ddc8),
};

const BOAT_SCALE = 1;
const CAP = 0.05;
function railY(u) { const b = Math.max(u - 0.2, 0); return 0.92 + 0.258 * (u + 0.12) * (u + 0.12) + 0.305 * b * b * b; }
function sheerY(u) { return railY(u) - CAP; }
const bulwarkH = (u) => 0.34 - 0.04 * u * u;
function deckEdgeY(u) { return railY(u) - bulwarkH(u); }
function keelY(u) {
  const lin_ = -1.05 + 0.23 * Math.min(Math.max((u + 1) / 1.75, 0), 1);
  const ff = Math.max(0, (u - 0.72) / 0.28);
  return lin_ + 0.27 * ff * ff;
}
function mono(xs, ys) {
  const n = xs.length, d = [], m = [];
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  m.push(d[0]);
  for (let i = 1; i < n - 1; i++) m.push(d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2);
  m.push(d[n - 2]);
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b;
    if (s > 9) { const t = 3 / Math.sqrt(s); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; }
  }
  return (x) => {
    if (x <= xs[0]) return ys[0] + m[0] * (x - xs[0]);
    if (x >= xs[n - 1]) return ys[n - 1] + m[n - 1] * (x - xs[n - 1]);
    let i = 0;
    while (x > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i], t = (x - xs[i]) / h, t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1];
  };
}
const stemZ = mono([-0.55, -0.35, -0.1, 0.2, 0.6, 1.0, 1.35, 1.52, 1.66], [4.30, 4.66, 4.84, 4.95, 5.08, 5.30, 5.62, 5.80, 5.86]);
const sternZ = (y) => { const t = (y + 1.05) / 2.12; return -4.7 - 0.92 * t - 0.03 * t * (1 - t); };
const Y_K1 = keelY(1), Y_S1 = sheerY(1), Y_K0 = keelY(-1), Y_S0 = sheerY(-1);
function endZ(u, ty) { return u >= 0 ? stemZ(Y_K1 + (Y_S1 - Y_K1) * ty) : -sternZ(Y_K0 + (Y_S0 - Y_K0) * ty); }
function halfB(u) {
  const c = 0.08;
  if (u >= c) { const t = (u - c) / (1 - c); return 1.9 * Math.pow(Math.max(0, 1 - t * t), 0.6); }
  const t = (c - u) / (1 + c);
  return 1.9 * Math.pow(Math.max(0, 1 - Math.pow(t, 2.3)), 0.55);
}
const BODY = { rise: 20, riseEnd: 60, hollow: 1.6, end0: 0.4, end1: 0.95, round: 0.16, keep: 0.8 };
function sstep$8(a, b, x) { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); }
function hullPoint(u, v, side, out, lines = false) {
  const a = Math.pow(Math.abs(u), 1.6);
  const nx = 2.5 - 1.55 * a, ny = 2.1 - 1.0 * a;
  const th = Math.min(Math.max(v, 0), 1) * Math.PI * 0.5;
  const sx = Math.pow(Math.sin(th), 2 / nx);
  const ty = 1 - Math.pow(Math.max(Math.cos(th), 0), 2 / ny);
  const yk = keelY(u), ys = sheerY(u);
  const fl = 0.10 + 0.22 * Math.abs(u) * Math.abs(u);
  const hb = halfB(u);
  let x = hb * sx * (1 - fl * Math.pow(1 - ty, 1.5));
  const tw = -yk / (ys - yk);
  if (!lines && ty < tw) {
    const s = ty / tw, qw = 1 - tw;
    const xw = hb * Math.pow(1 - Math.pow(qw, ny), 1 / nx) * (1 - fl * Math.pow(qw, 1.5));
    const e = sstep$8(BODY.end0, BODY.end1, Math.abs(u));
    const rise = (BODY.rise + (BODY.riseEnd - BODY.rise) * e) * Math.PI / 180;
    const xf = (-yk / Math.tan(rise)) * Math.pow(s, 1 + (BODY.hollow - 1) * e);
    const k = Math.max(BODY.round * xw, 1e-4), h = Math.max(k - Math.abs(x - xf), 0) / k;
    const xb = Math.min(x, xf) - h * h * k * 0.25 * sstep$8(0, 0.35, s);
    x += (xb - x) * (1 - sstep$8(BODY.keep, 1, s));
  }
  return out.set(side * x, yk + (ys - yk) * ty, u * endZ(u, ty));
}
const _a$1 = new V3$2(), _b$1 = new V3$2(), _c$1 = new V3$2(), _d$1 = new V3$2();
function vAtY(u, y) {
  let lo = 0, hi = 1;
  for (let k = 0; k < 32; k++) {
    const m = (lo + hi) * 0.5;
    hullPoint(u, m, 1, _a$1);
    if (_a$1.y < y) lo = m; else hi = m;
  }
  return (lo + hi) * 0.5;
}
function hullNormal(u, v, side, out) {
  const e = 1e-3;
  hullPoint(Math.min(1, u + e), v, side, _a$1); hullPoint(Math.max(-1, u - e), v, side, _b$1);
  hullPoint(u, Math.min(1, v + e), side, _c$1); hullPoint(u, Math.max(0, v - e), side, _d$1);
  _a$1.sub(_b$1); _c$1.sub(_d$1);
  out.crossVectors(_a$1, _c$1).normalize();
  if (out.x * side < 0) out.negate();
  return out;
}
function uAtZ(z, y = 0.5) {
  let lo = -1, hi = 1;
  for (let k = 0; k < 34; k++) {
    const m = (lo + hi) * 0.5;
    hullPoint(m, vAtY(m, Math.min(y, sheerY(m) - 1e-3)), 1, _b$1);
    if (_b$1.z < z) lo = m; else hi = m;
  }
  return (lo + hi) * 0.5;
}

const DECK_N = 200, PLANK_T = 0.045;
const DECK = { z: new Float32Array(DECK_N + 1), ye: new Float32Array(DECK_N + 1), xe: new Float32Array(DECK_N + 1), yr: new Float32Array(DECK_N + 1), u: new Float32Array(DECK_N + 1) };
for (let i = 0; i <= DECK_N; i++) {
  const u = -0.982 + (1.964 * i) / DECK_N;
  const ye = deckEdgeY(u);
  hullPoint(u, vAtY(u, ye), 1, _a$1);
  DECK.z[i] = _a$1.z; DECK.ye[i] = ye; DECK.xe[i] = Math.max(0, _a$1.x - PLANK_T); DECK.yr[i] = railY(u); DECK.u[i] = u;
}
DECK.z[0]; DECK.z[DECK_N];
const camberAt = (xe) => 0.07 * Math.min(1, xe / 1.5);
function deckAt(z, x = 0) {
  let lo = 0, hi = DECK_N;
  if (z <= DECK.z[0]) hi = 1;
  else if (z >= DECK.z[DECK_N]) lo = DECK_N - 1;
  else while (hi - lo > 1) { const m = (lo + hi) >> 1; if (DECK.z[m] < z) lo = m; else hi = m; }
  const t = Math.min(1, Math.max(0, (z - DECK.z[lo]) / ((DECK.z[hi] - DECK.z[lo]) || 1)));
  const ye = DECK.ye[lo] + (DECK.ye[hi] - DECK.ye[lo]) * t;
  const xe = DECK.xe[lo] + (DECK.xe[hi] - DECK.xe[lo]) * t;
  const yr = DECK.yr[lo] + (DECK.yr[hi] - DECK.yr[lo]) * t;
  const w = xe > 0 ? Math.min(1, Math.abs(x) / xe) : 1;
  return { y: ye + camberAt(xe) * (1 - w * w), xe, ys: yr, edge: ye, u: DECK.u[lo] + (DECK.u[hi] - DECK.u[lo]) * t };
}
function sidePoint(z, below, side, out, nrm) {
  let lo = -1, hi = 1;
  for (let k = 0; k < 30; k++) {
    const m = (lo + hi) * 0.5;
    hullPoint(m, vAtY(m, sheerY(m) - below), 1, _b$1);
    if (_b$1.z < z) lo = m; else hi = m;
  }
  const u = (lo + hi) * 0.5, v = vAtY(u, sheerY(u) - below);
  hullPoint(u, v, side, out);
  if (nrm) hullNormal(u, v, side, nrm);
  return out;
}
function waterline(n = 72, y = 0) {
  const pts = [];
  const p = new V3$2(), nn = new V3$2();
  for (const side of [1, -1]) {
    for (let i = 0; i <= n; i++) {
      const s = side > 0 ? i / n : 1 - i / n;
      const u = Math.sin((s * 2 - 1) * Math.PI * 0.5) * 0.999;
      const v = vAtY(u, y);
      hullPoint(u, v, side, p);
      hullNormal(u, v, side, nn);
      const l = Math.hypot(nn.x, nn.z) || 1;
      pts.push({ x: p.x, z: p.z, nx: nn.x / l, nz: nn.z / l });
    }
  }
  return pts;
}
function waterlineOutline(n = 96, y = 0) {
  const out = [];
  for (const q of waterline(n, y)) {
    const last = out[out.length - 1];
    if (!last || Math.hypot(q.x - last.x, q.z - last.z) > 0.01) out.push({ x: +q.x.toFixed(4), z: +q.z.toFixed(4) });
  }
  if (out.length > 2 && Math.hypot(out[0].x - out[out.length - 1].x, out[0].z - out[out.length - 1].z) < 0.01) out.pop();
  let a = 0;
  for (let i = 0; i < out.length; i++) { const p = out[i], q = out[(i + 1) % out.length]; a += p.x * q.z - q.x * p.z; }
  if (a < 0) out.reverse();
  return out;
}

const DIVE_Z = -1.2;
const PUMP_Z = -0.45;
const MAST_Z = 1.95;
const MIZ_Z = -3.55, MIZ_X = -0.3;
const BT_U = {
  uBtLamp: { value: 0 }, uBtLampW: { value: new V3$2() }, uBtSway: ROPE_U.uRbSway, uBtKey: { value: new V3$2() },
  uBtAnim: { value: new THREE.Vector4() },
  uBtSlapP: { value: new THREE.Vector4(4.6, 0, -100, 0) }, uBtSlapS: { value: new THREE.Vector4(4.6, 0, -100, 0) },
  uBtLick: { value: Array.from({ length: 4 }, () => new THREE.Vector4(0, 0, -100, 0)) },
  uBtDay: { value: 1 },
  uBtName: { value: null },
  uBtWind: { value: new THREE.Vector4(1, 0, 0, 1) },
  uBtDial: { value: null },
};
const FLAG_U = { uFgDay: BT_U.uBtDay };
const RUD_A = new V3$2(0, -0.62, sternZ(-0.62)), RUD_B = new V3$2(0, 1.0, sternZ(1.0));
const RUD_K = new V3$2().subVectors(RUD_B, RUD_A).normalize();
const g7$1 = (v) => (+v).toFixed(6);

const BOAT_VERT_DECL = `
attribute vec4 aMat;
attribute vec4 aDyn;
attribute vec4 aAnim;
uniform float uBtTime;
uniform vec3 uBtSway;
uniform vec4 uBtAnim;
uniform vec4 uBtWind;
varying vec4 vBtMat;
varying vec3 vBtL;
varying vec3 vBtW;
varying vec2 vBtUv;
const vec3 BT_RUDK = vec3(${g7$1(RUD_K.x)}, ${g7$1(RUD_K.y)}, ${g7$1(RUD_K.z)});
vec3 btRotV(vec3 d, vec3 k, float a) { float c = cos(a); float s = sin(a); return d * c + cross(k, d) * s + k * dot(k, d) * (1.0 - c); }
void btFrame(out vec3 o, out vec3 k, out float a) {
  o = vec3(0.0); k = vec3(1.0, 0.0, 0.0); a = 0.0;
  if (aAnim.x > 0.5 && aAnim.x < 1.5) { o = vec3(0.0, aAnim.y, aAnim.z); a = uBtAnim.x + aAnim.w; }
  else if (aAnim.x > 1.5 && aAnim.x < 2.5) { o = vec3(aAnim.y, aAnim.z, 0.0); k = vec3(0.0, 0.0, 1.0); a = uBtAnim.y; }
  else if (aAnim.x > 2.5) { o = vec3(0.0, aAnim.y, aAnim.z); k = BT_RUDK; a = uBtAnim.z; }
}
`;
const BOAT_VERT_NORMAL = `
vec3 btO; vec3 btK; float btA;
btFrame(btO, btK, btA);
if (aAnim.x > 0.5) objectNormal = btRotV(objectNormal, btK, btA);
`;
const BOAT_VERT_BEGIN = `
vBtMat = aMat;
vBtL = position;
vBtUv = uv;
if (aAnim.x > 0.5) transformed = btO + btRotV(transformed - btO, btK, btA);
if (aDyn.x != 0.0) {
  vec3 btSw = uBtSway * abs(aDyn.x);
  if (aDyn.x < 0.0) btSw.x = max(btSw.x, 0.0);
  transformed += btSw;
}
if (aDyn.y > 0.0) {
  float btG = uBtWind.w;
  vec3 btWd = uBtWind.xyz / max(length(uBtWind.xyz), 1e-4);
  float btPh = dot(position, vec3(1.7, 0.9, 1.3));
  float btFl = 0.6 * sin(uBtTime * 6.3 + position.x * 5.1 + position.z * 3.7) + 0.4 * sin(uBtTime * 11.7 + position.z * 9.3 - position.x * 4.1);
  transformed += objectNormal * (btFl * aDyn.y * (0.4 + 0.6 * btG));
  float btBr = 0.6 * sin(uBtTime * 1.15 + btPh) + 0.4 * sin(uBtTime * 2.3 - btPh * 1.7 + 1.3);
  transformed += objectNormal * (aDyn.z * (0.55 * btG * btG + 0.45 * btBr * (0.5 + 0.5 * btG)));
  float btHm = 0.55 + 0.25 * sin(uBtTime * 4.7 - btPh * 3.0) + 0.2 * sin(uBtTime * 8.9 - btPh * 5.3);
  transformed += (btWd * (btHm * btG) + objectNormal * (0.6 * sin(uBtTime * 7.3 - btPh * 4.1))) * aDyn.w;
}
`;
const BOAT_FRAG_DECL = `
uniform float uBtTime;
uniform float uBtLamp;
uniform vec3 uBtSun;
uniform float uBtDay;
uniform vec3 uBtLampW;
uniform vec3 uBtKey;
uniform vec4 uBtSlapP;
uniform vec4 uBtSlapS;
uniform vec4 uBtLick[4];
uniform vec4 uBtAnim;
uniform sampler2D uBtName;
uniform sampler2D uBtDial;
varying vec4 vBtMat;
varying vec3 vBtL;
varying vec3 vBtW;
varying vec2 vBtUv;
${WAVES_GLSL}
${GLSL_NOISE}
float btBand(float x, float a, float b, float aa) { return smoothstep(a - aa, a + aa, x) * (1.0 - smoothstep(b - aa, b + aa, x)); }
vec3 btHash3(vec3 p) {
  p = fract(p * vec3(0.1031, 0.1030, 0.0973));
  p += dot(p, p.yxz + 33.33);
  return fract((p.xxy + p.yxx) * p.zyx);
}
float btCell(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  float d = 8.0;
  for (int z = -1; z <= 1; z++) for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec3 o = vec3(float(x), float(y), float(z));
    vec3 r = o + btHash3(i + o) - f;
    d = min(d, dot(r, r));
  }
  return sqrt(d);
}
float btLine(float q, float w, float fw) {
  fw = max(fw, 1e-5);
  float d = abs(fract(q + 0.5) - 0.5);
  float l = (1.0 - smoothstep(w - fw, w + fw, d)) * min(1.0, 2.0 * w / fw);
  return mix(l, 2.0 * w, smoothstep(0.25, 0.5, fw));
}
float btSea(vec2 p, float t) {
  float fade = exp(-length(p - cameraPosition.xz) / 240.0);
  vec2 d = vec2(0.0);
  for (int i = 0; i < NWAVES; i++) {
    float ph = W_K[i] * dot(W_DIR[i], p) - W_W[i] * t + W_P[i];
    d += W_Q[i] * W_A[i] * W_DIR[i] * cos(ph);
  }
  return waveHeightAt(p - d * fade, t) * fade;
}
vec3 btGrain(vec3 c, vec2 q, float seed, float fq) {
  float gf = 1.0 - smoothstep(0.35, 0.9, fq * 60.0);
  float g = sgNoise(vec3(q.x * 1.4, q.y * 60.0, seed * 3.7));
  float g2 = sgNoise(vec3(q.x * 0.25, q.y * 7.0, seed * 5.1 + 2.0));
  return c * (0.9 + 0.2 * mix(0.5, g, gf)) * (0.86 + 0.26 * g2);
}
`;
const BOAT_FRAG_COLOR = `
float btRough = vBtMat.x;
float btMetal = vBtMat.y;
float btH = 0.0;
float btSlapOK = 0.0;
vec2 btFUv = fwidth(vBtUv);
vec3 btFL = fwidth(vBtL);
float btFW = fwidth(vBtMat.w);
int btType = int(vBtMat.z + 0.5);
{
  vec3 c = diffuseColor.rgb;
  vec3 lp = vBtL;
  vec2 q = vBtUv;
  float n1 = sgFbm(lp * vec3(1.3, 4.0, 1.3));
  if (btType == 0) {
    c *= 0.92 + 0.14 * sgNoise(lp * 9.0);
  } else if (btType == 1) {
    c = btGrain(c, q, vBtMat.w, btFUv.y);
    float gl = sgNoise(vec3(q.x * 1.4, q.y * 90.0, vBtMat.w * 3.7 + 1.0));
    float glf = 1.0 - smoothstep(0.35, 0.9, btFUv.y * 90.0);
    c *= 1.0 - 0.28 * smoothstep(0.55, 0.85, gl) * glf;
    float chq = q.y * 14.0 + 3.0 * sgNoise(vec3(q.x * 0.8, vBtMat.w, 2.0));
    float chk = btLine(chq, 0.02, fwidth(chq)) * smoothstep(0.5, 0.8, sgNoise(vec3(q.x * 2.0, q.y * 4.0, vBtMat.w)));
    c *= 1.0 - 0.45 * chk;
    c = mix(c, c * vec3(0.9, 0.88, 0.84) + vec3(0.03, 0.028, 0.024), smoothstep(0.5, 0.8, sgFbm(lp * 2.1 + vBtMat.w)) * 0.5);
    btH = (sgNoise(vec3(q.x * 1.4, q.y * 60.0, vBtMat.w * 3.7)) - 0.5) * 0.0006 - 0.0004 * chk;
  } else if (btType == 2) {
    vec3 ao = c;
    float pw = 0.12;
    float qx = q.y / pw;
    float id = floor(qx + 0.5);
    float fq = btFUv.y / pw;
    float pf = fract(qx + 0.5);
    float sW = 0.03 + 0.012 * sgNoise(vec3(q.x * 3.1, id * 1.7, 2.0));
    float smear = smoothstep(0.7, 0.88, sgNoise(vec3(q.x * 5.3, id * 3.1, 8.0)));
    float seam = btLine(qx + 0.5, sW, fq);
    float seamS = max(btLine(qx + 0.5, sW + 0.06 * smear, fq) - seam, 0.0);
    float off = sgHash2(vec2(id, 7.3)) * 3.4;
    float bj = btLine((q.x + off) / 3.4, 0.0022, btFUv.x / 3.4);
    float h = sgHash2(vec2(id, 1.7));
    vec3 wood = mix(vec3(0.40, 0.25, 0.11), vec3(0.30, 0.18, 0.08), h);
    float gf = 1.0 - smoothstep(0.35, 0.9, btFUv.y * 50.0);
    float g = sgNoise(vec3(q.x * 1.2, q.y * 50.0, id));
    float g2 = sgNoise(vec3(q.x * 0.3, q.y * 9.0, id + 4.0));
    wood *= (0.88 + 0.22 * mix(0.5, g, gf)) * (0.9 + 0.2 * g2);
    float kc = floor(q.x / 1.3 + h);
    vec2 kdv = vec2((fract(q.x / 1.3 + h) - 0.5) * 1.3, (pf - 0.3 - 0.4 * sgHash2(vec2(id, kc))) * pw);
    float knot = (1.0 - smoothstep(0.005, 0.012, length(kdv * vec2(0.5, 1.0)))) * step(0.6, sgHash2(vec2(id + 0.5, kc)));
    wood = mix(wood, vec3(0.13, 0.075, 0.035), knot * 0.85);
    float wear = max(max(exp(-dot(lp.xz - vec2(0.0, ${g7$1(PUMP_Z)}), lp.xz - vec2(0.0, ${g7$1(PUMP_Z)})) / 1.3), exp(-dot(lp.xz - vec2(1.0, ${g7$1(DIVE_Z)}), lp.xz - vec2(1.0, ${g7$1(DIVE_Z)})) / 0.5)), exp(-dot(lp.xz - vec2(0.0, -4.3), lp.xz - vec2(0.0, -4.3)) / 0.6));
    wear = clamp(wear * 0.9 + 0.22 * smoothstep(0.35, 0.75, sgFbm(vec3(q * 0.8, 3.0))), 0.0, 1.0);
    vec3 grey = vec3(0.27, 0.24, 0.19) * (0.9 + 0.2 * h);
    wood = mix(wood, grey * (0.9 + 0.2 * mix(0.5, g, gf)), wear * 0.85);
    float dirt = sgFbm(vec3(q * 1.3, 2.0));
    wood *= 0.82 + 0.28 * dirt;
    float stain = smoothstep(0.62, 0.75, sgFbm(vec3(q * 0.9 + 11.0, 1.0)));
    wood = mix(wood, wood * vec3(0.55, 0.47, 0.38), stain * 0.6);
    float fzz = lp.z / 0.33, fxz = (fzz - floor(fzz + 0.5)) * 0.33;
    float bd = min(length(vec2(fxz, (pf - 0.27) * pw)), length(vec2(fxz, (pf - 0.73) * pw)));
    float bung = (1.0 - smoothstep(0.0055, 0.0072, bd)) * (1.0 - smoothstep(0.003, 0.01, max(btFL.x, btFL.z)));
    wood = mix(wood, wood * vec3(1.18, 1.1, 0.98) * (0.9 + 0.2 * sgNoise(lp * 900.0)), bung * 0.45);
    float dn = sgFbm(vec3(lp.xz * 6.0, 1.3)) + 0.25 * sgNoise(vec3(lp.xz * 23.0, 4.0));
    float dd = min(min(length((lp.xz - vec2(1.42, ${g7$1(DIVE_Z)})) * vec2(1.0, 0.8)) / 0.5, length(lp.xz - vec2(1.55, ${g7$1(DIVE_Z - 0.4)})) / 0.3),
                   min(min(length(lp.xz - vec2(-0.52, 2.62)) / 0.25, length(lp.xz - vec2(-0.84, 2.42)) / 0.22),
                       min(length((lp.xz - vec2(-0.6, -3.1)) * vec2(1.0, 0.8)) / 0.26, length(lp.xz - vec2(1.12, 2.62)) / 0.24)));
    dd += (dn - 0.62) * 0.55;
    float damp = 1.0 - smoothstep(0.72, 0.92, dd);
    float tide = btBand(dd, 0.93, 1.06, fwidth(dd) + 0.01) * (1.0 - damp);
    float saltN = sgFbm(vec3(q * vec2(1.1, 2.3), 5.0));
    float salt = smoothstep(0.52, 0.76, saltN + 0.28 * smoothstep(0.45, 0.95, vBtMat.w)) * (0.4 + 0.6 * smoothstep(0.45, 0.8, mix(0.5, g, gf))) * (1.0 - damp);
    salt = max(salt * 0.5, tide * 0.15);
    wood = mix(wood, vec3(0.62, 0.61, 0.58), salt);
    vec2 spv = lp.xz - vec2(1.36, ${g7$1(DIVE_Z)});
    float reg = 1.0 - smoothstep(0.22, 0.55, length(spv * vec2(1.0, 1.35)));
    float scuff = smoothstep(0.6, 0.82, sgNoise(vec3(spv.x * 6.0, spv.y * 48.0, 6.0))) * smoothstep(0.35, 0.7, sgNoise(vec3(spv * 4.0, 9.0))) * reg;
    float lead = smoothstep(0.7, 0.86, sgNoise(vec3(spv.x * 9.0, spv.y * 26.0, 12.0))) * reg * 0.8;
    wood = mix(wood, vec3(0.44, 0.38, 0.29), scuff * 0.75);
    wood = mix(wood, vec3(0.13, 0.135, 0.14), lead * 0.6);
    float edge = smoothstep(0.9 - btFW, 0.9 + btFW, vBtMat.w);
    c = mix(wood, vec3(0.05, 0.045, 0.04) * (0.8 + 0.4 * dirt), edge);
    float sm = max(seam, bj) * (1.0 - edge);
    vec3 pitch = vec3(0.012, 0.010, 0.008) * (0.85 + 0.3 * sgNoise(vec3(q.x * 40.0, id, 1.0)));
    c = mix(c, pitch, sm * 0.95);
    c = mix(c, pitch * 1.6, seamS * 0.7 * (1.0 - edge));
    c *= mix(1.0, 0.64, damp);
    c *= ao * (1.0 - 0.3 * smoothstep(0.86, 0.99, vBtMat.w));
    btRough = 0.7 + 0.16 * dirt - 0.1 * (1.0 - wear) * (1.0 - edge);
    btRough = mix(btRough, 0.3 + 0.2 * sgNoise(vec3(q.x * 9.0, id, 3.0)), max(sm, seamS * 0.8));
    btRough = mix(btRough, 0.95, salt * 0.8);
    btRough = mix(btRough, 0.88, scuff);
    btRough = mix(btRough, 0.45, lead);
    btRough = mix(btRough, 0.55, damp * 0.8);
    btH = -0.0005 * sm + 0.00015 * bung - 0.0002 * scuff + (g - 0.5) * 0.0005 * gf;
  } else if (btType == 3) {
    float fq = max(btFUv.x, btFUv.y);
    float seam = btLine(q.y / 0.55, 0.012, btFUv.y / 0.55);
    float wx = q.x / 0.004, wy = q.y / 0.004;
    float wf = 1.0 - smoothstep(0.3, 0.7, fq / 0.004);
    float weave = sin(wx * 3.1416) * sin(wy * 3.1416) * wf;
    float n = sgFbm(vec3(q * 1.7, vBtMat.w));
    c *= 0.84 + 0.24 * n + 0.05 * weave;
    float stain = smoothstep(0.58, 0.8, sgFbm(vec3(q * 0.6 + 7.0, vBtMat.w + 1.0)));
    c = mix(c, c * vec3(0.62, 0.5, 0.36), stain * 0.55);
    c *= 1.0 - 0.18 * seam;
    btH = (n - 0.5) * 0.002 + weave * 0.0002 - 0.0006 * seam;
  } else if (btType == 4) {
    float rows = q.y / 0.0105;
    float ri = floor(rows), rf = fract(rows);
    float stq = q.x * 48.0 + 0.5 * mod(ri, 2.0);
    float sf = fract(stq);
    float fr = max(btFUv.y / 0.0105, btFUv.x * 48.0);
    float wf = 1.0 - smoothstep(0.3, 0.7, fr);
    float rnd = sin(rf * 3.1416);
    float over = 0.75 + 0.25 * sin(sf * 6.2832);
    float strand = sgHash2(vec2(ri, floor(stq * 0.25)));
    c *= mix(0.8, 0.55 + 0.45 * rnd * over, wf) * (0.82 + 0.3 * mix(0.5, strand, wf)) * (0.85 + 0.3 * sgNoise(lp * 6.0));
    btH = (rnd * over - 0.5) * 0.0015 * wf;
  } else if (btType == 5) {
    float wz = vBtMat.w, top = vBtMat.y;
    btMetal = 0.0;
    float big = sgFbm(lp * 16.0);
    float fine = 0.6 * sgNoise(lp * 38.0) + 0.4 * sgNoise(lp * 95.0);
    float wr = wz * (0.7 + 0.5 * top);
    float bareV = 0.6 * big + 0.4 * fine + 0.9 * wr;
    float chipV = fine + 0.12 * wr;
    float chip = max(smoothstep(0.99, 1.03, bareV), smoothstep(0.84, 0.86, chipV));
    float under = max(smoothstep(0.93, 0.98, bareV), smoothstep(0.815, 0.835, chipV)) * (1.0 - chip);
    vec3 wood = btGrain(vec3(0.17, 0.12, 0.08), vec2(lp.z, (lp.x + lp.y) * 9.0), 3.0, btFL.z);
    wood = mix(wood, vec3(0.2, 0.19, 0.17), 0.25) * (0.85 + 0.3 * sgNoise(lp * 12.0));
    c *= 0.88 + 0.24 * n1;
    c = mix(c, vec3(0.22, 0.21, 0.2), under * 0.7);
    c = mix(c, wood, chip);
    float notch = (1.0 - smoothstep(0.045, 0.08, abs(lp.z - ${g7$1(DIVE_Z - 0.4)}))) * step(0.0, lp.x) * smoothstep(0.2, 0.6, top);
    float sq = lp.z / 0.0032 + 2.5 * sgNoise(vec3(lp.x * 25.0, lp.z * 4.0, 1.0));
    float score = btLine(sq, 0.16, fwidth(sq));
    vec3 chafe = mix(vec3(0.12, 0.085, 0.055), vec3(0.035, 0.028, 0.02), smoothstep(0.4, 0.7, sgNoise(lp * 60.0))) * (0.8 + 0.35 * score);
    c = mix(c, chafe, notch);
    btRough = mix(btRough + 0.1 * (n1 - 0.5), mix(0.84, 0.68, clamp(wr - 0.5, 0.0, 1.0)), chip);
    btRough = mix(btRough, 0.64, notch);
    btH = -0.0005 * chip + 0.00025 * under - 0.0003 * score * notch;
  } else if (btType == 6) {
    float clean = step(0.5, vBtMat.w);
    float px = btFL.x + btFL.y + btFL.z;
    float cA = btCell(lp * 150.0);
    float cB = btCell(lp * 380.0 + 3.1);
    float cC = btCell(lp * 60.0 + 7.0);
    float fA = 1.0 - smoothstep(0.3, 0.8, px * 150.0);
    float fB = 1.0 - smoothstep(0.3, 0.8, px * 380.0);
    float fC = 1.0 - smoothstep(0.3, 0.8, px * 60.0);
    float psz = 0.08 + 0.16 * sgNoise(lp * 45.0);
    float pore = (1.0 - smoothstep(psz, psz + 0.16, cA)) * fA;
    float canal = (1.0 - smoothstep(0.1, 0.22, btCell(lp * 52.0 + 11.0))) * step(0.62, sgNoise(lp * 26.0)) * fC;
    float mesh = (1.0 - smoothstep(0.18, 0.4, cB)) * fB;
    float con = (1.0 - smoothstep(0.0, 0.55, cC)) * fC;
    float fib = mix(0.5, sgNoise(lp * 800.0), fB);
    c *= 0.8 + 0.34 * sgFbm(lp * 18.0);
    c = mix(c, c * vec3(0.42, 0.36, 0.3), pore * mix(0.5, 0.85, clean));
    c = mix(c, c * 0.18, canal);
    c *= mix(1.0, 0.72, mesh * mix(0.35, 1.0, clean));
    c *= 0.88 + 0.24 * fib;
    c *= 1.0 + 0.22 * con * (1.0 - clean);
    btRough = 0.96;
    btH = 0.0012 * con - 0.0012 * pore - 0.002 * canal - 0.0004 * mesh;
  } else if (btType == 7) {
    float sn = sgFbm(lp * 11.0);
    c *= 0.82 + 0.3 * sn;
    c = mix(c, c * 0.62, (1.0 - smoothstep(0.0, 0.25, fract(lp.y * 0.0) + q.y)) * 0.0);
    c = mix(c, vec3(0.55, 0.5, 0.42), smoothstep(0.65, 0.8, sgFbm(lp * 4.0 + 5.0)) * 0.35);
    btH = (sn - 0.5) * 0.0015;
  } else if (btType == 8) {
    float pt = sgFbm(lp * 7.0 + 3.0);
    float tar = sgNoise(lp * 22.0);
    if (vBtMat.w < 1.0) {
      float rec = vBtMat.w;
      float gr = sgNoise(lp * 140.0);
      float pm = smoothstep(0.6, 0.8, 0.55 * pt + 0.45 * gr) * smoothstep(0.8, 0.98, rec);
      float tarn = smoothstep(0.45, 0.95, rec) * (0.4 + 0.4 * pt);
      c *= (0.78 + 0.3 * tar) * (1.0 + 0.3 * (1.0 - rec) * (1.0 - rec));
      c = mix(c, c * vec3(0.5, 0.42, 0.3), tarn * 0.5);
      c = mix(c, vec3(0.13, 0.17, 0.13) * (0.8 + 0.4 * gr), pm);
      btMetal = mix(btMetal, 0.0, pm);
      btRough = mix(btRough * mix(0.65, 1.0, rec) + (tar - 0.5) * 0.1, 0.85, pm);
      btH = pm * (tar - 0.5) * 0.0008;
    } else {
      float rs = smoothstep(0.5, 0.72, pt + 0.25 * sgNoise(lp * 31.0)) * (vBtMat.w - 1.0);
      c *= 0.85 + 0.3 * tar;
      c = mix(c, vec3(0.20, 0.075, 0.025) * (0.7 + 0.6 * tar), rs);
      btMetal = mix(btMetal, 0.0, rs);
      btRough = mix(btRough, 0.9, rs);
      btH = rs * (tar - 0.5) * 0.0015;
    }
  } else if (btType == 9) {
    float wx = q.x / 0.003, wy = q.y / 0.003;
    float wf = 1.0 - smoothstep(0.3, 0.7, max(btFUv.x, btFUv.y) / 0.003);
    float weave = sin(wx * 3.1416) * sin(wy * 3.1416) * wf;
    float n = sgFbm(lp * 5.0 + vBtMat.w);
    c *= 0.82 + 0.3 * n + 0.08 * weave;
    btH = weave * 0.0003 + (n - 0.5) * 0.002;
  } else if (btType == 10) {
    float below = vBtMat.w;
    float aB = btFW + 1e-4;
    float side = q.x < 0.0 ? -1.0 : 1.0;
    float gfH = 1.0 - smoothstep(0.35, 0.9, btFL.y * 45.0);
    float grain = mix(0.5, sgNoise(vec3(lp.z * 1.1, lp.y * 45.0, lp.x * 45.0)), gfH);
    float pq = abs(q.x) * 13.0;
    float sid = floor(pq);
    float seam = btLine(pq, 0.02, fwidth(pq));
    float butt = btLine((lp.z + sgHash2(vec2(sid, side)) * 4.3) / 4.3, 0.0007, btFL.z / 4.3) * step(0.08, fract(pq)) * step(fract(pq), 0.92);
    float plk = max(seam, butt);
    float fz = lp.z / 0.33, fi = floor(fz + 0.5), fx = (fz - fi) * 0.33;
    float sf = fract(pq);
    float nf = 1.0 - smoothstep(0.003, 0.01, max(btFL.z, btFL.y));
    float nd = min(length(vec2(fx, (sf - 0.27) * 0.16)), length(vec2(fx, (sf - 0.73) * 0.16)));
    float nail = (1.0 - smoothstep(0.004, 0.0075, nd)) * nf;
    float weep = (1.0 - smoothstep(0.0, 0.006, abs(fx))) * smoothstep(0.02, 0.27, sf) * (1.0 - smoothstep(0.27, 0.3, sf)) * step(0.72, sgHash2(vec2(fi, sid + side * 31.0))) * nf;
    vec3 col = ${'vec3'}(${C.white.map(g7$1).join(', ')}) * (0.9 + 0.12 * n1) * (0.93 + 0.12 * grain);
    float bl = sgFbm(lp * vec3(0.5, 1.3, 0.5) + 11.0);
    col = mix(col, col * vec3(0.9, 0.9, 0.86), smoothstep(0.45, 0.75, bl) * 0.6);
    col = mix(col, col * vec3(1.02, 0.98, 0.9), (1.0 - smoothstep(0.2, 0.5, bl)) * 0.4);
    float band = 1.0 - smoothstep(0.305 - aB, 0.305 + aB, below);
    float stripe = btBand(below, 0.168, 0.206, aB);
    float lzA = abs(fract(lp.z / 0.24) - 0.5) * 0.24, lzB = abs(below - 0.187);
    float loz = 1.0 - smoothstep(0.85, 1.0 + 3.0 * max(btFL.z, aB) / 0.012, lzA / 0.022 + lzB / 0.012);
    float redl = btBand(below, 0.334, 0.358, aB);
    vec3 blk = ${'vec3'}(${C.black.map(g7$1).join(', ')}) * (0.8 + 0.4 * n1);
    col = mix(col, blk, band);
    col = mix(col, ${'vec3'}(${C.ochre.map(g7$1).join(', ')}) * (0.85 + 0.2 * grain), stripe * band);
    col = mix(col, ${'vec3'}(${C.red.map(g7$1).join(', ')}) * 0.8, loz * stripe * band);
    col = mix(col, ${'vec3'}(${C.red.map(g7$1).join(', ')}) * (0.8 + 0.3 * n1), redl);
    float scz = abs(fract((lp.z + 0.4) / 1.55) - 0.5) * 1.55;
    float scup = (1.0 - smoothstep(0.055, 0.06 + btFL.z, scz)) * btBand(below, 0.245, 0.29, aB) * step(abs(lp.z), 3.6);
    float sc2 = abs(fract((lp.z + 0.4) / 1.55) - 0.5) * 1.55;
    float run = smoothstep(0.55, 0.9, sgNoise(vec3(lp.z * 26.0, lp.y * 1.2, side * 3.0))) * 0.5 + exp(-sc2 / 0.05) * step(abs(lp.z), 3.6) * 0.8;
    col = mix(col, col * vec3(0.8, 0.76, 0.66), run * smoothstep(0.3, 0.45, below) * (1.0 - smoothstep(0.45, 0.95, below)) * 0.55);
    float ch = 0.6 * sgNoise(lp * 36.0) + 0.4 * sgNoise(lp * 92.0);
    float rub = exp(-abs(lp.z - ${g7$1(DIVE_Z - 0.4)}) * 4.0) * step(0.0, lp.x) * (1.0 - smoothstep(0.1, 0.5, below)) + exp(-abs(lp.z - ${g7$1(MAST_Z)}) * 5.0) * (1.0 - smoothstep(0.15, 0.6, below)) + smoothstep(4.7, 5.4, lp.z) * 0.6;
    float edgeP = btLine(pq, 0.05, fwidth(pq));
    float cm = clamp(0.02 + 0.06 * band + 0.9 * rub + 0.3 * edgeP, 0.0, 1.2);
    float chip = smoothstep(0.86 - 0.13 * cm, 0.88 - 0.13 * cm, ch);
    float chipE = smoothstep(0.835 - 0.13 * cm, 0.86 - 0.13 * cm, ch) - chip;
    col *= 1.0 - 0.1 * chipE;
    col = mix(col, mix(vec3(0.46, 0.44, 0.38), vec3(0.2, 0.15, 0.1), band) * (0.8 + 0.4 * grain), chip * 0.85);
    float rs = 0.0;
    for (int i = 0; i < 4; i++) {
      float zc = i == 0 ? ${g7$1(MAST_Z + 0.22)} : (i == 1 ? ${g7$1(MAST_Z - 0.38)} : (i == 2 ? ${g7$1(MIZ_Z)} : 5.25));
      float wz = i == 3 ? 0.08 : 0.025;
      float tb = i == 3 ? 0.05 : 0.33;
      rs += exp(-abs(lp.z - zc) / wz) * smoothstep(tb - 0.02, tb + 0.05, below) * (1.0 - smoothstep(tb + 0.1, tb + 0.55, below)) * (0.6 + 0.4 * sgNoise(vec3(lp.z * 60.0, below * 3.0, side)));
    }
    col = mix(col, vec3(0.20, 0.085, 0.03), clamp(rs, 0.0, 1.0) * 0.55 * (1.0 - band * 0.6));
    col = mix(col, col * vec3(0.55, 0.62, 0.42), weep * 0.35);
    col = mix(col, col * 0.7, nail * 0.35 * (1.0 - band));
    float aY = btFL.y + 1e-4;
    float wob = 0.012 * sin(lp.z * 3.1 + side) + 0.012 * (n1 - 0.5);
    float tar = 1.0 - smoothstep(0.055 + wob - aY, 0.055 + wob + aY, lp.y);
    float n2 = sgNoise(vec3(lp.z * 2.7, lp.y * 9.0, lp.x * 2.7));
    vec3 tarc = ${'vec3'}(${C.tar.map(g7$1).join(', ')}) * (0.9 + 0.8 * sgFbm(lp * vec3(2.0, 6.0, 2.0)));
    tarc = mix(tarc, vec3(0.022, 0.026, 0.016) * (0.8 + 0.4 * n1), smoothstep(0.45, 0.7, sgFbm(lp * vec3(1.6, 3.2, 1.6) + 5.0)) * 0.6);
    tarc *= 0.85 + 0.4 * smoothstep(0.8, 0.92, sgNoise(lp * 34.0));
    float scum = (1.0 - smoothstep(0.06, 0.24 + 0.1 * n2, lp.y)) * (1.0 - tar);
    col = mix(col, col * vec3(0.68, 0.66, 0.55), scum * 0.65);
    col = mix(col, tarc, tar);
    float weedTop = 0.03 + 0.06 * n2 + 0.05 * (1.0 - smoothstep(-5.0, -2.0, lp.z));
    float weed = (1.0 - smoothstep(weedTop - 0.02, weedTop + 0.01, lp.y)) * smoothstep(-0.3, -0.03, lp.y) * smoothstep(0.35, 0.6, sgNoise(vec3(lp.z * 14.0, lp.y * 2.0, lp.x * 3.0)));
    col = mix(col, vec3(0.045, 0.068, 0.028) * (0.7 + 0.6 * n2), weed * 0.6);
    col = mix(col, vec3(0.006, 0.005, 0.004), scup);
    col *= 1.0 - mix(0.22, 0.45, tar) * plk;
    btRough = mix(0.58 + 0.12 * n1, 0.45 + 0.1 * n1, band);
    btRough = mix(btRough, 0.78, max(tar, chip));
    btRough = mix(btRough, 0.4, weed);
    btH = -0.0012 * plk - 0.0005 * chip + 0.0004 * nail + (n1 - 0.5) * 0.0004 + (grain - 0.5) * 0.0002 * (1.0 - band);
    btSlapOK = 1.0;
    float slm = 1.0 - smoothstep(-0.4, -0.2, lp.y);
    float sn = sgFbm(lp * vec3(0.9, 2.6, 0.9) + 17.0);
    vec3 slime = mix(vec3(0.075, 0.068, 0.044), vec3(0.052, 0.064, 0.036), smoothstep(0.35, 0.7, sn)) * (0.85 + 0.3 * n2);
    col = mix(col, slime * (1.0 - 0.45 * plk), slm);
    c = col;
  } else if (btType == 11) {
    float below = vBtMat.w, edgeT = vBtMat.y, isTH = step(0.635, vBtMat.x);
    btMetal = 0.0;
    vec3 col = ${'vec3'}(${C.primer.map(g7$1).join(', ')}) * 0.72 * (0.85 + 0.25 * n1);
    col = mix(col, col * vec3(0.5, 0.46, 0.42), smoothstep(0.16, 0.34, below) * 0.7);
    float run = smoothstep(0.62, 0.86, sgNoise(vec3(lp.z * 28.0, lp.y * 1.4, lp.x * 2.0))) * smoothstep(0.03, 0.14, below);
    col = mix(col, col * vec3(0.6, 0.53, 0.45), run * 0.45);
    float pq = abs(q.x) * 13.0;
    col *= 1.0 - 0.28 * btLine(pq, 0.03, fwidth(pq)) * (1.0 - isTH);
    float ch = 0.6 * sgNoise(lp * 34.0) + 0.4 * sgNoise(lp * 88.0);
    float chipV = ch + 0.08 * (1.0 - smoothstep(0.0, 0.08, below)) + 0.36 * edgeT;
    float chip = smoothstep(0.845, 0.865, chipV);
    float chipE = smoothstep(0.815, 0.845, chipV) - chip;
    col *= 1.0 - 0.2 * chipE;
    col = mix(col, btGrain(vec3(0.18, 0.12, 0.07), vec2(lp.z + lp.x, lp.y), 4.0, btFL.y), chip);
    btRough = 0.62 + 0.2 * chip;
    btH = -0.0006 * chip + 0.0002 * chipE;
    c = col;
  } else if (btType == 12) {
    float aY = btFL.y + 1e-4;
    float tar = 1.0 - smoothstep(0.06 - aY, 0.06 + aY, lp.y);
    c *= 0.8 + 0.4 * n1;
    float ch = 0.6 * sgNoise(lp * 82.0) + 0.4 * sgNoise(lp * 195.0);
    c = mix(c, vec3(0.25, 0.18, 0.11), smoothstep(0.84, 0.87, ch) * (1.0 - tar));
    vec3 tarc = ${'vec3'}(${C.tar.map(g7$1).join(', ')}) * (0.9 + 0.6 * sgFbm(lp * 5.0));
    tarc = mix(tarc, vec3(0.05, 0.07, 0.03), smoothstep(0.5, 0.75, sgFbm(lp * 3.0 + 2.0)) * 0.6);
    c = mix(c, tarc, tar);
    btRough = mix(0.5, 0.8, tar);
    btSlapOK = 1.0;
  } else if (btType == 13) {
    diffuseColor.a = clamp(0.3 + 0.5 * vBtMat.w, 0.06, 1.0);
    btRough = 0.05;
  } else if (btType == 18) {
    float qa = q.x * 26.0, qb = q.y * 16.0;
    float fa = fwidth(qa + qb) + 1e-4;
    float tw = max(btLine(qa + qb, 0.1, fa), btLine(qa - qb, 0.1, fa));
    float kn = (1.0 - smoothstep(0.1, 0.18, length(vec2(fract(qa + qb + 0.5) - 0.5, fract(qa - qb + 0.5) - 0.5)))) * (1.0 - smoothstep(0.2, 0.5, fa));
    diffuseColor.a = clamp(max(tw, kn), 0.0, 1.0);
    if (diffuseColor.a < 0.05) discard;
    c *= 0.8 + 0.3 * sgNoise(lp * 40.0);
  } else if (btType == 14) {
    vec2 d = q - 0.5;
    float r = length(d) * 2.0;
    c = texture2D(uBtDial, q).rgb;
    c *= (1.0 - 0.22 * smoothstep(0.8, 1.0, r)) * (0.95 + 0.05 * sgNoise(lp * 300.0));
    btRough = 0.25;
  } else if (btType == 19) {
    float along = q.y;
    float worn = smoothstep(0.1, 0.3, along) * (1.0 - smoothstep(0.72, 0.9, along));
    vec3 wood = btGrain(c, vec2(along * 0.15, q.x * 0.5), 5.0, btFUv.y);
    c = mix(wood * vec3(0.95, 0.93, 0.9) + 0.03, wood * vec3(0.6, 0.48, 0.38), worn);
    float sc = sgNoise(vec3(q.x * 90.0, along * 12.0, 2.0));
    c *= 1.0 - 0.12 * smoothstep(0.6, 0.9, sc) * worn;
    btRough = mix(0.72, 0.26, worn);
    btH = (sc - 0.5) * 0.0002 * worn;
  } else if (btType == 15) {
    vec4 nm = texture2D(uBtName, q);
    vec3 col = vec3(0.56, 0.47, 0.32) * (0.9 + 0.12 * n1);
    col = mix(col, ${'vec3'}(${C.ochre.map(g7$1).join(', ')}) * 0.9, nm.g);
    col = mix(col, ${'vec3'}(${C.navy.map(g7$1).join(', ')}), nm.r);
    float ch = 0.6 * sgNoise(lp * 80.0) + 0.4 * sgNoise(lp * 190.0);
    col = mix(col, vec3(0.34, 0.3, 0.24), smoothstep(0.84, 0.87, ch));
    c = col;
    btRough = 0.72;
    btSlapOK = 1.0;
  } else if (btType == 16) {
    float run = uBtAnim.w;
    float lvl = vBtMat.w < 0.5 ? mix(1.0, 0.0, run) : run;
    if (q.y > lvl + 0.001) discard;
    c *= 0.9 + 0.2 * sgNoise(lp * 400.0);
  } else if (btType == 17) {
    float sp = btLine(q.x / 0.05 + q.y, 0.08, fwidth(q.x / 0.05 + q.y));
    c *= (0.85 + 0.3 * n1) * (1.0 - 0.25 * sp);
    btH = -0.0003 * sp;
  }
  diffuseColor.rgb = c;
}
if (vBtW.y < 2.0 && btType != 13 && btType != 14) {
  float t = uBtTime;
  float h0 = btSea(vBtW.xz, t);
  float h1 = btSea(vBtW.xz, t - 0.8) - 0.035;
  float h2 = btSea(vBtW.xz, t - 1.7) - 0.09;
  float hw = max(h0, max(h1, h2));
  float edge = hw + 0.05 + 0.07 * sgNoise(vec3(vBtW.xz * 4.0, t * 0.5));
  float wet = 1.0 - smoothstep(edge - 0.05, edge + 0.03, vBtW.y), wg = 0.0, wl = 0.0;
  if (btSlapOK > 0.5) {
    vec4 S = vBtL.x > 0.0 ? uBtSlapP : uBtSlapS;
    float age = t - S.z;
    if (age > 0.0 && age < 10.0) {
      vec3 lp = vBtL;
      float reach = S.y - 0.1 * sgNoise(vec3(lp.z * 3.0, 0.0, S.z));
      float along = 1.0 - smoothstep(0.45, 1.5, abs(lp.z - S.x));
      float dry = exp(-age / 3.5);
      float tA = 0.35;
      float top = reach - 0.3 * max(age - tA, 0.0);
      float film = (1.0 - smoothstep(top - 0.06, top + 0.04, lp.y));
      vec3 nb = cross(dFdx(lp), dFdy(lp));
      nb /= max(length(nb), 1e-12);
      float zf = lp.z + clamp(nb.y * nb.z / max(nb.x * nb.x + nb.z * nb.z, 0.1), -1.5, 1.5) * lp.y;
      zf += 0.03 * (sgNoise(vec3(zf * 5.0, lp.y * 2.5, S.z)) - 0.5);
      float rc = floor(zf / 0.055);
      float h1 = fract(sin(rc * 12.9898 + S.z * 78.233) * 43758.5453), h2 = fract(h1 * 17.31 + 0.13), h3 = fract(h1 * 41.7 + 0.61), h4 = fract(h1 * 7.07 + 0.37);
      float rw = 0.0025 + 0.005 * h3;
      float rdry = reach - 0.02 - 0.2 * h4 - 0.1 * max(age - (1.0 + 2.5 * h2), 0.0);
      float runnel = step(0.3, h1) * (1.0 - smoothstep(0.5 * rw, 1.5 * rw, abs(zf - (rc + 0.2 + 0.6 * h2) * 0.055)))
        * (1.0 - smoothstep(rdry - 0.03, rdry, lp.y)) * smoothstep(0.8 * tA, 1.2 * tA, age) * exp(-age / (2.5 + 3.0 * h3));
      float damp = 0.3 * (1.0 - smoothstep(reach - 0.12, reach, lp.y));
      wet = max(wet, along * S.w * dry * max(max(film, damp), runnel * 0.2));
      wg = max(wg, along * S.w * runnel * 0.85);
    }
    for (int i = 0; i < 4; i++) {
      vec4 K = uBtLick[i];
      float ka = t - K.z, kq = abs(K.w);
      if (ka < 0.0 || ka > 5.0 || K.w * vBtL.x <= 0.0) continue;
      float kw = floor(kq) * 0.001, kE = fract(kq) * 10.0, kap = kE / 9.81;
      float dz = abs(vBtL.z - K.x) / max(kw, 0.01);
      float kn = sgNoise(vec3(vBtL.z * 9.0, ka * 0.3, K.z)), kr = sgNoise(vec3(vBtL.z * 38.0, 1.3, K.z));
      float kh = ka < kap ? kE * ka - 4.905 * ka * ka : kE * kE / 19.62 - 0.3 * (ka - kap);
      float ktop = K.y + max(kh, 0.0) * max(1.0 - 0.8 * dz * dz, 0.0) * (0.8 + 0.2 * kn) - 0.02 * kr;
      float kin = (1.0 - smoothstep(ktop - 0.012, ktop + 0.004, vBtL.y)) * (1.0 - smoothstep(0.5, 1.1, dz + 0.2 * kn));
      wl = max(wl, kin * exp(-ka / 1.6));
    }
  }
  diffuseColor.rgb *= mix(1.0, 0.55, wet) * (1.0 - 0.2 * wl * (1.0 - wet));
  btRough = mix(btRough, 0.09, max(max(wet, wg), wl));
}
`;
const BOAT_FRAG_EMIT = `
{
  vec3 nW = normalize((vec4(normal, 0.0) * viewMatrix).xyz);
  vec3 lv = uBtLampW - vBtW;
  float ld = length(lv);
  float ndl = max(dot(nW, lv / max(ld, 1e-3)), 0.0) * 0.75 + 0.25;
  float ldc = max(ld, 0.4);
  if (btType != 13) totalEmissiveRadiance += diffuseColor.rgb * vec3(1.0, 0.54, 0.18) * (uBtLamp * 1.3 * ndl / (1.0 + ldc * ldc * 2.5));
  if (btType == 13) totalEmissiveRadiance += vec3(1.0, 0.46, 0.12) * uBtLamp * 16.0 * max(vBtMat.w, 0.0) * (0.9 + 0.1 * sin(uBtTime * 13.0) * sin(uBtTime * 4.1));
  {
    vec3 rV = normalize(vBtW - cameraPosition);
    vec3 rL = normalize(uBtSun);
    float rLow = (1.0 - smoothstep(0.12, 0.4, rL.y)) * smoothstep(-0.05, 0.02, rL.y);
    float rFr = pow(1.0 - clamp(abs(dot(nW, rV)), 0.0, 1.0), 3.0);
    float rBk = pow(max(dot(rV, rL), 0.0), 4.0);
    totalEmissiveRadiance += uBtKey * vec3(1.0, 0.72, 0.42) * rFr * rBk * rLow * 0.35;
  }
  if (btType == 3) {
    vec3 sd = normalize(uBtSun);
    float back = max(0.0, -dot(nW, sd)) * uBtDay * smoothstep(-0.04, 0.08, sd.y);
    totalEmissiveRadiance += diffuseColor.rgb * vec3(1.0, 0.9, 0.72) * back * 0.55;
  }
}
`;
const BOAT_FRAG_AMB = `
{
  vec3 btV = normalize(vBtW - cameraPosition);
  vec3 btL = normalize(uBtSun);
  float btLow = (1.0 - smoothstep(0.12, 0.4, btL.y)) * smoothstep(-0.05, 0.02, btL.y);
  vec3 btNw = normalize((vec4(normal, 0.0) * viewMatrix).xyz);
  float btBack = btLow * smoothstep(0.15, 0.75, dot(btV, btL)) * (1.0 - smoothstep(-0.1, 0.3, dot(btNw, btL)));
  float btSub = 1.0 - smoothstep(-0.15, 0.05, vBtW.y - btSea(vBtW.xz, uBtTime));
  float btDown = smoothstep(-0.15, -0.95, btNw.y);
  float btAmb = (1.0 - 0.7 * btBack) * (1.0 - btSub * mix(0.35, 0.9, btDown));
  float btUp = 0.5 + 0.5 * btNw.y;
  vec3 btSeaE = vec3(0.2, 3.0, 4.6) * (0.04 + 2.4 * btUp * btUp) * btSub * uLight;
  #if defined( RE_IndirectDiffuse )
    iblIrradiance *= btAmb;
    irradiance = irradiance * btAmb + btSeaE;
  #endif
  #if defined( RE_IndirectSpecular )
    radiance *= mix(1.0, 0.55, max(btBack, btSub));
  #endif
}
`;

function nameTexture() {
  if (typeof document === 'undefined') return null;
  const cv = document.createElement('canvas');
  cv.width = 1024; cv.height = 160;
  const g = cv.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, cv.width, cv.height);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = 'bold 92px Georgia, "Times New Roman", "Palatino", serif';
  const txt = 'ΚΑΛΛΙΟΠΗ';
  g.fillStyle = '#00ff00'; g.fillText(txt, cv.width / 2 + 5, cv.height / 2 + 6);
  g.globalCompositeOperation = 'lighter';
  g.fillStyle = '#ff0000'; g.fillText(txt, cv.width / 2, cv.height / 2);
  g.globalCompositeOperation = 'source-over';
  const tex = new THREE.CanvasTexture(cv);
  tex.anisotropy = 8;
  tex.colorSpace = THREE.NoColorSpace;
  return tex;
}

function dialTexture() {
  if (typeof document === 'undefined') return null;
  const S = 512, cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const g = cv.getContext('2d'), cx = S / 2, cy = S / 2, R = S * 0.48;
  g.fillStyle = '#b8a47c'; g.fillRect(0, 0, S, S);
  const grad = g.createRadialGradient(cx - R * 0.2, cy - R * 0.25, R * 0.1, cx, cy, R);
  grad.addColorStop(0, '#f3ecda'); grad.addColorStop(1, '#d9ccad');
  g.fillStyle = grad; g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.fill();
  const A0 = (-135 * Math.PI) / 180, A1 = (135 * Math.PI) / 180;
  const ang = (f) => A0 + (A1 - A0) * f;
  const P = (a, r) => [cx + Math.sin(a) * r, cy - Math.cos(a) * r];
  const tick = (a, r0, r1, w) => { const [x0, y0] = P(a, r0), [x1, y1] = P(a, r1); g.lineWidth = w; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); };
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.strokeStyle = g.fillStyle = '#17140f';
  g.lineWidth = 3; g.beginPath(); g.arc(cx, cy, R * 0.9, A0 - Math.PI / 2, A1 - Math.PI / 2); g.stroke();
  for (let v = 0; v <= 100; v += 2) tick(ang(v / 100), R * 0.9, R * (v % 10 === 0 ? 0.76 : v % 5 === 0 ? 0.8 : 0.84), v % 10 === 0 ? 5 : 2);
  g.font = 'bold 36px Georgia, "Times New Roman", serif';
  for (let v = 0; v <= 100; v += 10) { const [x, y] = P(ang(v / 100), R * 0.63); g.fillText(String(v), x, y); }
  g.strokeStyle = g.fillStyle = '#8c2016';
  g.lineWidth = 2; g.beginPath(); g.arc(cx, cy, R * 0.47, A0 - Math.PI / 2, A1 - Math.PI / 2); g.stroke();
  for (let f = 0; f <= 225; f += 25) tick(ang(f / 225), R * 0.47, R * (f % 50 === 0 ? 0.4 : 0.43), f % 50 === 0 ? 3 : 2);
  g.font = '22px Georgia, "Times New Roman", serif';
  for (let f = 0; f <= 200; f += 50) { const [x, y] = P(ang(f / 225), R * 0.32); g.fillText(String(f), x, y); }
  g.font = 'italic 21px Georgia, "Times New Roman", serif';
  g.fillText('FEET OF WATER', cx, cy + R * 0.76);
  g.fillStyle = '#17140f';
  g.font = 'bold 22px Georgia, "Times New Roman", serif';
  g.fillText('POUNDS', cx, cy + R * 0.61);
  g.font = 'italic 16px Georgia, "Times New Roman", serif';
  g.fillText('LONDON', cx, cy + R * 0.17);
  const rg = g.createRadialGradient(cx, cy, R * 0.78, cx, cy, R);
  rg.addColorStop(0, 'rgba(90,70,40,0)'); rg.addColorStop(1, 'rgba(90,70,40,0.35)');
  g.fillStyle = rg; g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.fill();
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function boatMaterial() {
  if (!BT_U.uBtName.value) BT_U.uBtName.value = nameTexture();
  if (!BT_U.uBtDial.value) BT_U.uBtDial.value = dialTexture();
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0, side: THREE.DoubleSide, alphaToCoverage: true });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uBtTime = U.uTime;
    shader.uniforms.uBtLamp = BT_U.uBtLamp;
    shader.uniforms.uBtLampW = BT_U.uBtLampW;
    shader.uniforms.uBtSway = BT_U.uBtSway;
    shader.uniforms.uBtSun = SKY_UNIFORMS.uSunDir;
    shader.uniforms.uBtDay = BT_U.uBtDay;
    shader.uniforms.uBtKey = BT_U.uBtKey;
    shader.uniforms.uBtAnim = BT_U.uBtAnim;
    shader.uniforms.uBtSlapP = BT_U.uBtSlapP;
    shader.uniforms.uBtSlapS = BT_U.uBtSlapS;
    shader.uniforms.uBtLick = BT_U.uBtLick;
    shader.uniforms.uBtName = BT_U.uBtName;
    shader.uniforms.uBtDial = BT_U.uBtDial;
    shader.uniforms.uBtWind = BT_U.uBtWind;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\n' + BOAT_VERT_DECL)
      .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\n' + BOAT_VERT_NORMAL)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n' + BOAT_VERT_BEGIN)
      .replace('#include <project_vertex>', '#include <project_vertex>\nvBtW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n' + BOAT_FRAG_DECL)
      .replace('#include <color_fragment>', '#include <color_fragment>\n' + BOAT_FRAG_COLOR)
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nroughnessFactor = clamp(btRough, 0.04, 1.0);\nmetalnessFactor = clamp(btMetal, 0.0, 1.0);')
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\nnormal = sgBump(-vViewPosition, normal, btH, faceDirection);')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n' + BOAT_FRAG_EMIT)
      .replace('#include <lights_fragment_maps>', '#include <lights_fragment_maps>\n' + BOAT_FRAG_AMB);
  };
  m.customProgramCacheKey = () => 'sg-boat-20';
  patchMaterial(m);
  return m;
}
function gridGeo(pos, am, uv, idx) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aMat', new THREE.BufferAttribute(am, 4));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
function part(B, geo, o = {}) {
  B.add(geo, {
    m: o.mx, color: o.c || [1, 1, 1],
    aMat: o.am || [o.r !== undefined ? o.r : 0.7, o.mt || 0, o.t || 0, o.w || 0],
    aDyn: o.dyn, aAnim: o.anim,
    uvs: o.uvs, uvSwap: o.uvSwap,
  });
}
function offsetRect(a0, a1, hb, cr, taper) {
  const rr = roundRect((a1 - a0) / 2, hb, cr, 3);
  const ac = (a0 + a1) / 2;
  const f = (s, k, out) => {
    rr(s, k, out);
    const sc = taper ? taper(s) : 1;
    out[0] = (out[0] + ac) * sc;
    out[1] *= sc;
  };
  f.nk = rr.nk;
  return f;
}
function timberShape(a0, depth, half, cr = 0.02) {
  const unit = roundRect(0.5, 0.5, cr, 3);
  const f = (s, k, out) => {
    unit(s, k, out);
    const d = depth(s), h = half(s);
    out[0] = a0 + (out[0] + 0.5) * (d - a0);
    out[1] *= 2 * h;
  };
  f.nk = unit.nk;
  return f;
}
const smooth$2 = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const box = (w, h, d, r = 0.008) => roundBox(w, h, d, Math.min(r, w * 0.3, h * 0.3, d * 0.3), 1, 1);
const lathe$2 = (prof, seg = 32, phi0 = 0) =>
  new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(Math.max(r, 0.0005), y)), seg, phi0);
const deckY = (z, x = 0) => deckAt(z, x).y;
function innerX(z, y) {
  const u = uAtZ(z, y);
  hullPoint(u, vAtY(u, Math.min(y, sheerY(u) - 1e-3)), 1, _c$1);
  return Math.max(0, _c$1.x - PLANK_T);
}
const POST_P = RUD_K.clone();
const POST_A = new V3$2(0, POST_P.z, -POST_P.y);
const RUD_O = RUD_A.clone().addScaledVector(POST_A, 0.1);
const NOTCH_Z = DIVE_Z - 0.4;
new V3$2();

function buildHull$1(B) {
  const p = new V3$2(), nn = new V3$2(), q = new V3$2();
  {
    const NU = 190, NV = 46, cols = 2 * NV + 1, n = (NU + 1) * cols;
    const pos = new Float32Array(n * 3), am = new Float32Array(n * 4), uv = new Float32Array(n * 2);
    const gl = new Float32Array(NV + 1);
    for (let i = 0; i <= NU; i++) {
      const u = Math.sin(((i / NU) * 2 - 1) * Math.PI * 0.5);
      const yr = railY(u);
      hullPoint(u, 0, 1, q);
      gl[0] = 0;
      for (let j = 1; j <= NV; j++) { hullPoint(u, j / NV, 1, p); gl[j] = gl[j - 1] + p.distanceTo(q); q.copy(p); }
      const G = gl[NV];
      let G0 = 0;
      hullPoint(u, 0, 1, q, true);
      for (let j = 1; j <= NV; j++) { hullPoint(u, j / NV, 1, p, true); G0 += p.distanceTo(q); q.copy(p); }
      G0 = G0 || 1;
      for (let j = 0; j < cols; j++) {
        const jj = Math.abs(j - NV), side = j < NV ? -1 : 1;
        hullPoint(u, jj / NV, side, p);
        const k = i * cols + j;
        pos[k * 3] = p.x; pos[k * 3 + 1] = p.y; pos[k * 3 + 2] = p.z;
        am[k * 4] = 0.55; am[k * 4 + 2] = T.HULL; am[k * 4 + 3] = yr - p.y;
        uv[k * 2] = side * Math.max(0, 1 - (G - gl[jj]) / G0);
      }
    }
    const idx = [];
    for (let i = 0; i < NU; i++) for (let j = 0; j < cols - 1; j++) {
      const a = i * cols + j, b = a + 1, c = a + cols, d = c + 1;
      idx.push(a, b, c, b, d, c);
    }
    B.add(gridGeo(pos, am, uv, idx), { color: [1, 1, 1] });
  }
  {
    const NU = 150, NVi = 9, cols = NVi + 1;
    const pos = [], am = [], uv = [], idx = [];
    let base = 0;
    for (const side of [-1, 1]) {
      for (let i = 0; i <= NU; i++) {
        const u = -0.986 + (1.972 * i) / NU;
        const yr = railY(u), vd = vAtY(u, deckEdgeY(u) - 0.04);
        for (let k = 0; k <= NVi; k++) {
          const v = vd + ((1 - vd) * k) / NVi;
          hullPoint(u, v, side, p);
          hullNormal(u, v, side, nn);
          let x = p.x - nn.x * PLANK_T;
          if (side * x < 0.004) x = side * 0.004;
          pos.push(x, p.y - nn.y * PLANK_T, p.z - nn.z * PLANK_T);
          am.push(0.62, 0, T.BULWARK, yr - p.y);
          uv.push(side * v, 0);
        }
      }
      for (let i = 0; i < NU; i++) for (let k = 0; k < NVi; k++) {
        const a = base + i * cols + k, b = a + 1, c = a + cols, d = c + 1;
        if (side > 0) idx.push(a, c, b, b, c, d); else idx.push(a, b, c, b, d, c);
      }
      base += (NU + 1) * cols;
    }
    B.add(gridGeo(new Float32Array(pos), new Float32Array(am), new Float32Array(uv), idx), { color: [1, 1, 1] });
  }
}
function buildDeck(B, spots) {
  const aoAt = (x, z) => {
    let a = 1;
    for (const s of spots) {
      let d;
      if (s.length === 4) d = Math.max(0, Math.hypot(x - s[0], z - s[1]) - s[2]);
      else d = Math.hypot(Math.max(0, Math.abs(x - s[0]) - s[2]), Math.max(0, Math.abs(z - s[1]) - s[3]));
      a *= 1 - s[s.length - 1] * Math.exp(-(d / 0.13) * (d / 0.13));
    }
    return a;
  };
  {
    const NW = 40, cols = NW + 1;
    const pos = [], am = [], uv = [], idx = [];
    for (let i = 0; i <= DECK_N; i++) {
      const xe = DECK.xe[i] + 0.012, z = DECK.z[i], ye = DECK.ye[i], cb = camberAt(DECK.xe[i]);
      for (let j = 0; j <= NW; j++) {
        const w = (j / NW) * 2 - 1;
        pos.push(w * xe, ye + cb * (1 - w * w), z);
        am.push(0.72, 0, T.DECK, Math.abs(w));
        uv.push(z, w * xe);
      }
    }
    for (let i = 0; i < DECK_N; i++) for (let j = 0; j < NW; j++) {
      const a = i * cols + j, b = a + 1, c = a + cols, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
    B.add(gridGeo(new Float32Array(pos), new Float32Array(am), new Float32Array(uv), idx), { color: (p) => { const a = aoAt(p.x, p.z); return [a, a, a]; } });
  }
}
function buildHullRest(B) {
  const p = new V3$2(), nn = new V3$2();
  for (const side of [-1, 1]) {
    const cap = [];
    for (let i = 0; i <= 180; i++) {
      const u = -0.994 + (1.988 * i) / 180;
      hullPoint(u, 1, side, p);
      const notch = side > 0 ? Math.exp(-(((p.z - NOTCH_Z) / 0.09) ** 2)) : 0;
      cap.push(new V3$2(side * Math.max(Math.abs(p.x) - PLANK_T * 0.5 + 0.01, 0.02), sheerY(u) + CAP * 0.5 - 0.014 * notch, p.z));
    }
    part(B, sweep$1(cap, { nk: 14, shape: offsetRect(-CAP * 0.5, CAP * 0.5, 0.056, 0.016, (s) => 0.75 + 0.25 * smooth$2(0, 0.03, s) * smooth$2(1, 0.97, s)), up: new V3$2(0, 1, 0), capStart: true, capEnd: true }), {
      c: C.black,
      am: (pp, nn) => {
        const zN = side > 0 ? Math.exp(-(((pp.z - NOTCH_Z) / 0.09) ** 4)) : 0;
        const zL = side > 0 ? Math.exp(-(((pp.z - DIVE_Z) / 0.3) ** 4)) : 0;
        let zS = 0;
        for (const cz of CHAIN_Z) zS = Math.max(zS, 0.45 * Math.exp(-(((pp.z - cz) / 0.1) ** 2)));
        const zB = 0.35 * smooth$2(4.6, 5.4, pp.z) + 0.25 * smooth$2(-4.6, -5.3, pp.z);
        return [0.5, Math.max(nn.y, 0), T.PAINT, Math.min(1, 0.04 + Math.max(zN, zL, zS, zB))];
      },
    });
    const pts = [], nrm = [];
    for (let i = 0; i <= 150; i++) {
      const u = -0.975 + (1.95 * i) / 150;
      const v = vAtY(u, railY(u) - 0.272);
      hullPoint(u, v, side, p);
      hullNormal(u, v, side, nn);
      pts.push(p.clone().addScaledVector(nn, 0.002));
      nrm.push(nn.clone());
    }
    part(B, sweep$1(pts, { normals: nrm, nk: 16, shape: offsetRect(-6e-3, 0.03, 0.028, 0.012, (s) => 0.4 + 0.6 * smooth$2(0, 0.05, s) * smooth$2(1, 0.95, s)) }), { c: C.black, r: 0.48, t: T.PAINT, w: 0.12 });
  }
  for (const side of [-1, 1]) {
    for (let z = -4.62; z <= 4.4; z += 0.33) {
      const d = deckAt(z), top = d.ys - CAP, bot = d.edge - 0.01, ym = (top + bot) * 0.5;
      const x0 = innerX(z - 0.03, ym), x1 = innerX(z + 0.03, ym), xm = (x0 + x1) * 0.5;
      const ry = Math.atan2(side * (x1 - x0), 0.06);
      const yr = d.ys;
      const cr = Math.cos(ry), sr = Math.sin(ry);
      part(B, box(0.07, top - bot, 0.055, 0.008), {
        mx: mat(side * (xm - 0.046), ym, z, 0, ry, 0), c: [1, 1, 1],
        am: (pp, nn) => {
          const ax = Math.abs(nn.x * cr - nn.z * sr), az = Math.abs(nn.x * sr + nn.z * cr), ay = Math.abs(nn.y);
          return [0.64, Math.min(1, Math.max(0, (1 - Math.max(ax, ay, az)) / 0.25)), T.BULWARK, yr - pp.y];
        },
      });
    }
  }
  {
    const ctrl = [];
    const yTop = railY(-1) + 0.02;
    for (let k = 0; k <= 8; k++) { const y = yTop + (-1.05 - yTop) * (k / 8); ctrl.push(new V3$2(0, y, sternZ(y))); }
    for (let k = 1; k < 18; k++) { hullPoint(-1 + (2 * k) / 18, 0, 1, p); ctrl.push(new V3$2(0, p.y, p.z)); }
    for (let k = 0; k <= 12; k++) { const y = -0.55 + (1.66 + 0.55) * (k / 12); ctrl.push(new V3$2(0, y, stemZ(y))); }
    const pts = new THREE.CatmullRomCurve3(ctrl, false, 'centripetal').getSpacedPoints(300);
    const nrm = pts.map((qq, i) => {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
      const t = new V3$2().subVectors(b, a).normalize();
      return new V3$2(0, -t.z, t.y);
    });
    const L = pts.length - 1;
    const sAt = (i) => i / L;
    let sHeel = 0, sFore = 1;
    pts.forEach((pp, i) => { if (pp.y < -1 && sHeel === 0) sHeel = sAt(i); if (pp.z > 4.2 && pp.y < -0.5) sFore = sAt(i); });
    const depth = (s) => 0.09 + 0.05 * smooth$2(sHeel - 0.02, sHeel + 0.04, s) * smooth$2(sFore + 0.04, sFore - 0.02, s) - 0.03 * smooth$2(0.93, 1, s);
    const half = (s) => 0.058 + 0.01 * smooth$2(sHeel, sHeel + 0.05, s) * smooth$2(sFore, sFore - 0.05, s) - 0.012 * smooth$2(0.95, 1, s);
    part(B, sweep$1(pts, { normals: nrm, nk: 16, shape: timberShape(-0.05, depth, half, 0.022), capStart: true, capEnd: true }), { c: C.black, r: 0.5, t: T.TIMBER });
    const top = pts[L];
    part(B, new THREE.SphereGeometry(0.052, 18, 12), { mx: mat(0, top.y + 0.005, top.z + 0.012, 0, 0, 0, 1, 0.8, 1.1), c: C.black, r: 0.45, t: T.PAINT, w: 0.25 });
  }
  {
    const heel = RUD_O.clone().addScaledVector(POST_P, -0.62);
    const A = POST_A, P = POST_P, X = new V3$2().crossVectors(A, P).normalize();
    const s = new THREE.Shape();
    s.moveTo(0.04, 0.12);
    s.quadraticCurveTo(0.045, 0.0, 0.16, 0.0);
    s.lineTo(0.34, 0.02);
    s.quadraticCurveTo(0.56, 0.05, 0.58, 0.32);
    s.quadraticCurveTo(0.6, 0.62, 0.54, 0.85);
    s.quadraticCurveTo(0.46, 1.25, 0.26, 1.5);
    s.quadraticCurveTo(0.16, 1.62, 0.15, 1.85);
    s.lineTo(0.14, 2.82);
    s.quadraticCurveTo(0.13, 2.9, 0.05, 2.9);
    s.lineTo(0.0, 2.86);
    s.lineTo(0.0, 1.3);
    s.quadraticCurveTo(0.0, 1.1, 0.04, 1.0);
    s.lineTo(0.04, 0.12);
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.07, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 2, curveSegments: 16, steps: 1 });
    g.translate(0, 0, -0.035);
    const M = new THREE.Matrix4().makeBasis(A, P, X).setPosition(heel);
    const anim = [3, RUD_O.y, RUD_O.z, 0];
    part(B, g, { mx: M, c: C.black, r: 0.5, t: T.TIMBER, anim });
    for (const k of [0.35, 1.0, 1.7]) {
      const c0 = heel.clone().addScaledVector(P, k).addScaledVector(A, -0.03);
      part(B, box(0.26, 0.035, 0.1, 0.01), { mx: new THREE.Matrix4().makeBasis(A, P, X).setPosition(c0), c: C.iron, r: 0.6, mt: 0.5, t: T.METAL, w: 1.6 });
    }
    const head = heel.clone().addScaledVector(P, 2.72).addScaledVector(A, 0.06);
    const f = new V3$2(0, 0, 1);
    const tp = [head.clone().addScaledVector(f, -0.12), head.clone().add(new V3$2(0, 0.05, 0.35)), head.clone().add(new V3$2(0, 0.1, 0.9)), head.clone().add(new V3$2(0, 0.1, 1.4)), head.clone().add(new V3$2(0, 0.06, 1.62))];
    const tc = new THREE.CatmullRomCurve3(tp).getSpacedPoints(50);
    const e = tc[tc.length - 1];
    const scroll = [];
    for (let k = 1; k <= 26; k++) {
      const th = (k / 26) * Math.PI * 1.6, r = 0.07 * (1 - 0.55 * k / 26);
      scroll.push(new V3$2(0, e.y - 0.07 + Math.cos(th) * r, e.z + Math.sin(th) * r));
    }
    const all = [...tc, ...scroll];
    all.length - 1;
    part(B, sweep$1(all, { nk: 14, shape: circle$1((ss) => (ss < 0.75 ? 0.045 - 0.014 * (ss / 0.75) : 0.031 - 0.012 * ((ss - 0.75) / 0.25)), 14), capStart: true, capEnd: true }), { c: C.woodDark, r: 0.42, t: T.WOOD, w: 6, anim });
    TILLER.end = e.clone(); TILLER.grip = tc[Math.round(0.82 * 50)].clone();
  }
  for (const side of [-1, 1]) {
    const zc = 4.05, hl = 0.56, b0 = 0.37, b1 = 0.535, NZ = 40, NB = 5;
    const pos = [], am = [], uv = [], idx = [];
    for (let i = 0; i <= NZ; i++) {
      const z = zc - hl + (2 * hl * i) / NZ;
      for (let j = 0; j <= NB; j++) {
        const bl = b1 + ((b0 - b1) * j) / NB;
        sidePoint(z, bl, side, p, nn);
        p.addScaledVector(nn, 0.014);
        pos.push(p.x, p.y, p.z);
        am.push(0.72, 0, T.NAME, 0);
        uv.push(side > 0 ? 1 - i / NZ : i / NZ, j / NB);
      }
    }
    for (let i = 0; i < NZ; i++) for (let j = 0; j < NB; j++) {
      const a = i * (NB + 1) + j, b = a + 1, c = a + NB + 1, d = c + 1;
      if (side > 0) idx.push(a, c, b, b, c, d); else idx.push(a, b, c, b, d, c);
    }
    B.add(gridGeo(new Float32Array(pos), new Float32Array(am), new Float32Array(uv), idx), { color: [1, 1, 1] });
    const ring = [];
    const corner = (z, bl) => { sidePoint(z, bl, side, p, nn); return p.clone().addScaledVector(nn, 0.014); };
    for (let i = 0; i <= 20; i++) ring.push(corner(zc - hl + (2 * hl * i) / 20, b0 - 0.005));
    for (let j = 1; j <= 4; j++) ring.push(corner(zc + hl + 0.005, b0 + ((b1 - b0) * j) / 4));
    for (let i = 20; i >= 0; i--) ring.push(corner(zc - hl + (2 * hl * i) / 20, b1 + 0.005));
    for (let j = 3; j >= 0; j--) ring.push(corner(zc - hl - 0.005, b0 + ((b1 - b0) * j) / 4));
    part(B, sweep$1(ring, { nk: 8, shape: circle$1(0.006, 8) }), { c: C.ochre, r: 0.55, t: T.PLAIN });
  }
  {
    const zc = 0.85, d = deckAt(zc), y0 = d.y - 0.02;
    for (const [w, h, dd, x, z] of [[1.1, 0.18, 0.06, 0, zc + 0.45], [1.1, 0.18, 0.06, 0, zc - 0.45], [0.06, 0.18, 0.84, 0.52, zc], [0.06, 0.18, 0.84, -0.52, zc]]) {
      part(B, box(w, h, dd, 0.012), { mx: mat(x, y0 + 0.09, z), c: C.woodGrey, r: 0.72, t: T.WOOD, w: 3 });
    }
    for (let k = 0; k < 5; k++) part(B, box(0.215, 0.04, 0.95, 0.01), { mx: mat(-0.44 + k * 0.22, y0 + 0.2, zc, 0, 0, (k - 2) * 0.006), c: [0.29, 0.21, 0.13], r: 0.85, t: T.WOOD, w: 4 + k });
    for (const x of [-0.3, 0.3]) part(B, box(0.05, 0.03, 1.0, 0.008), { mx: mat(x, y0 + 0.235, zc), c: C.woodDark, r: 0.7, t: T.WOOD, w: 9 });
    const zf = 3.1, df = deckAt(zf), yf = df.y - 0.02;
    for (const [w, h, dd, x, z] of [[0.66, 0.32, 0.05, 0, zf + 0.3], [0.66, 0.26, 0.05, 0, zf - 0.3], [0.05, 0.3, 0.62, 0.31, zf], [0.05, 0.3, 0.62, -0.31, zf]]) {
      part(B, box(w, h, dd, 0.01), { mx: mat(x, yf + h * 0.5, z), c: C.woodGrey, r: 0.7, t: T.WOOD, w: 11 });
    }
    part(B, box(0.6, 0.02, 0.56, 0.005), { mx: mat(0, yf + 0.03, zf), c: [0.01, 0.01, 0.01], r: 1 });
    part(B, box(0.72, 0.04, 0.44, 0.01), { mx: mat(0, yf + 0.33, zf - 0.2, -0.05, 0, 0), c: C.woodGrey, r: 0.7, t: T.WOOD, w: 12 });
  }
  {
    const z = WINDLASS.z, y = deckY(z) - 0.02;
    for (const x of [-0.4, 0.4]) {
      part(B, box(0.1, 0.46, 0.24, 0.015), { mx: mat(x, y + 0.23, z), c: C.woodDark, r: 0.65, t: T.WOOD, w: 13 });
    }
    const g = new THREE.CylinderGeometry(0.11, 0.11, 0.7, 8, 1);
    part(B, g, { mx: mat(0, y + WINDLASS.h, z, 0, 0, Math.PI / 2), c: C.woodGrey, r: 0.7, t: T.WOOD, w: 14 });
    for (const x of [-0.3, 0.3]) part(B, new THREE.CylinderGeometry(0.118, 0.118, 0.035, 16), { mx: mat(x, y + WINDLASS.h, z, 0, 0, Math.PI / 2), c: C.iron, r: 0.6, mt: 0.5, t: T.METAL, w: 1.7 });
    part(B, box(0.04, 0.05, 0.22, 0.008), { mx: mat(0.12, y + WINDLASS.h + 0.12, z - 0.08, 0.5, 0, 0), c: C.iron, r: 0.6, mt: 0.5, t: T.METAL, w: 1.5 });
    const sz = 3.82;
    part(B, box(0.14, 0.52, 0.14, 0.02), { mx: mat(-0.1, deckY(sz) + 0.24, sz), c: C.woodDark, r: 0.6, t: T.WOOD, w: 15 });
  }
  for (const side of [-1, 1]) {
    for (const z of CHAIN_Z) {
      const pts = [], nrm = [];
      for (let k = 0; k <= 16; k++) {
        const bl = 0.4 - (0.4 * k) / 16;
        const pp = sidePoint(z, bl, side, new V3$2(), nn);
        pts.push(pp.addScaledVector(nn, 0.005 + 0.032 * Math.exp(-(((bl - 0.222) / 0.045) ** 2)))); nrm.push(nn.clone());
      }
      const topP = pts[pts.length - 1].clone(), topN = nrm[nrm.length - 1].clone();
      pts.push(topP.clone().add(new V3$2(side * 0.01, 0.05, 0))); nrm.push(topN.clone());
      part(B, sweep$1(pts, { normals: nrm, nk: 12, shape: offsetRect(0, 0.011, 0.022, 0.004) }), { c: C.iron, r: 0.62, mt: 0.2, t: T.METAL, w: 1.8 });
      for (const k of [2, 8, 14]) part(B, new THREE.CylinderGeometry(0.011, 0.012, 1, 10), { mx: matAlong(pts[k], pts[k].clone().addScaledVector(nrm[k], 0.017)), c: C.iron, r: 0.6, mt: 0.2, t: T.METAL, w: 1.9 });
      const de = topP.clone().add(new V3$2(side * 0.012, 0.16, 0));
      part(B, new THREE.TorusGeometry(0.062, 0.009, 8, 24), { mx: mat(de.x, de.y, de.z, 0, Math.PI / 2, 0), c: C.iron, r: 0.6, mt: 0.2, t: T.METAL, w: 1.7 });
      part(B, lathe$2([[0.001, -0.03], [0.05, -0.03], [0.058, -0.015], [0.06, 0.0], [0.058, 0.015], [0.05, 0.03], [0.001, 0.03]], 20), { mx: mat(de.x, de.y, de.z, 0, 0, Math.PI / 2), c: C.woodDark, r: 0.6, t: T.WOOD, w: 16 });
      DEADEYES.push({ side, z, p: de.clone() });
    }
  }
  for (const side of [-1, 1]) for (const z of [2.9, -2.55]) {
    const d = deckAt(z), x = innerX(z, d.ys) + 0.02;
    for (const dz of [-0.07, 0.07]) part(B, new THREE.CylinderGeometry(0.017, 0.02, 0.2, 10), { mx: mat(side * x, d.ys + 0.09, z + dz), c: C.woodDark, r: 0.6, t: T.WOOD, w: 17 });
  }
}
const WINDLASS = { z: 4.55, h: 0.27 };
const CHAIN_Z = [MAST_Z + 0.22, MAST_Z - 0.38];
const TILLER = { end: new V3$2(), grip: new V3$2() };
const DEADEYES = [];
function wadGeo(rng, r) {
  const g = new THREE.SphereGeometry(r, 16, 11);
  g.scale(0.8 + rng() * 0.5, 0.62 + rng() * 0.35, 0.8 + rng() * 0.5);
  const o = rng() * 100;
  return lump(g, (p) => r * (0.3 * fbm3(p.x * 9 + o, p.y * 9, p.z * 9, 3) + 0.08 * fbm3(p.x * 31, p.y * 31 + o, p.z * 31, 2)));
}
function spongeGeo(rng, r, fresh, seg = 22) {
  const g = new THREE.SphereGeometry(1, seg, Math.round(seg * 0.7));
  const P = g.attributes.position, n = P.count;
  const sx = 0.8 + rng() * 0.4, sy = 0.7 + rng() * 0.4, sz = 0.8 + rng() * 0.4;
  const o = rng() * 100;
  const osc = [];
  for (let k = 0, nk = 1 + Math.floor(rng() * 3.4); k < nk; k++) {
    const th = rng() * Math.PI * 2, el = 0.45 + rng() * 0.95;
    osc.push({ d: new V3$2(Math.cos(th) * Math.cos(el), Math.sin(el), Math.sin(th) * Math.cos(el)), a: 0.13 + rng() * 0.15, dep: 0.3 + rng() * 0.3 });
  }
  const v = new V3$2(), lob = new Float32Array(n);
  let mean = 0;
  for (let i = 0; i < n; i++) {
    v.fromBufferAttribute(P, i);
    lob[i] = 0.34 * fbm3(v.x * 1.6 + o, v.y * 1.6, v.z * 1.6, 3) + 0.13 * fbm3(v.x * 4.2, v.y * 4.2 + o, v.z * 4.2, 2) + 0.05 * fbm3(v.x * 11 + o, v.y * 11, v.z * 11 - o, 2);
    mean += lob[i];
  }
  mean /= n;
  const base = fresh ? C.spongeDark : C.spongeTan, tint = 0.85 + rng() * 0.3;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    v.fromBufferAttribute(P, i);
    const lo = lob[i] - mean;
    let rad = 1 + lo, dark = 0;
    for (const s of osc) {
      const u = Math.acos(Math.min(1, Math.max(-1, v.dot(s.d)))) / s.a;
      if (u < 1) { rad -= s.dep * Math.pow(1 - u * u, 1.5); dark = Math.max(dark, Math.pow(1 - u, 0.6)); }
      else if (u < 1.7) rad += 0.05 * Math.sin(((u - 1) / 0.7) * Math.PI);
    }
    let y = v.y * rad * sy;
    const yb = -0.55 * sy;
    if (y < yb) y = yb + (y - yb) * 0.45;
    P.setXYZ(i, v.x * rad * sx * r, y * r, v.z * rad * sz * r);
    const k = (1 - 0.85 * dark) * tint * (0.92 + 0.6 * lo);
    col[i * 3] = base[0] * k; col[i * 3 + 1] = base[1] * k; col[i * 3 + 2] = base[2] * k;
  }
  g.computeVertexNormals();
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}
function ringPts(center, axis, radius, n = 18) {
  const a = axis.clone().normalize();
  const t1 = Math.abs(a.y) > 0.9 ? new V3$2(1, 0, 0) : new V3$2(0, 1, 0);
  const u = new V3$2().crossVectors(a, t1).normalize(), w = new V3$2().crossVectors(a, u);
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const th = (i / n) * Math.PI * 2;
    pts.push(center.clone().addScaledVector(u, Math.cos(th) * radius).addScaledVector(w, Math.sin(th) * radius));
  }
  return pts;
}
function flake(c, r0, turns, y0, rng, n = 28, jitter = 0.015, thick = 0.02) {
  const pts = [];
  const ph = rng() * 6.28;
  for (let i = 0; i <= turns * n; i++) {
    const th = (i / n) * Math.PI * 2 + ph;
    const r = r0 + jitter * Math.sin(th * 3.0 + ph) + jitter * 0.6 * Math.sin(th * 7.0) + 0.012 * Math.sin(i / n * 2.1);
    pts.push(new V3$2(c.x + Math.cos(th) * r * 1.08, y0 + (i / (turns * n)) * thick * turns * 0.5, c.z + Math.sin(th) * r));
  }
  return pts;
}
function flemish(c, r0, r1, turns, y, n = 30) {
  const pts = [];
  for (let i = 0; i <= turns * n; i++) {
    const th = (i / n) * Math.PI * 2;
    const r = r0 + ((r1 - r0) * i) / (turns * n);
    pts.push(new V3$2(c.x + Math.cos(th) * r, y + 0.003 * Math.sin(th * 5), c.z + Math.sin(th) * r));
  }
  return pts;
}
const TWINE = [0.30, 0.24, 0.15];
function heightUV(g) {
  const P = g.attributes.position, uv = g.attributes.uv;
  let y0 = 1e9, y1 = -1e9;
  for (let i = 0; i < P.count; i++) { y0 = Math.min(y0, P.getY(i)); y1 = Math.max(y1, P.getY(i)); }
  for (let i = 0; i < P.count; i++) uv.setY(i, (P.getY(i) - y0) / Math.max(y1 - y0, 1e-6));
  return g;
}

function buildBoat() {
  const rng = makeRng$1(1901);
  const spec = { aMat: 4, aDyn: 4, aAnim: 4 };
  const HB = new Builder(spec);
  const PB = new Builder(spec);
  const RB = new RopeBuilder();
  DEADEYES.length = 0;
  buildHull$1(HB);
  buildHullRest(HB);
  new V3$2(0, 1.66, stemZ(1.66));

  const mb = deckY(MAST_Z), MB = mb - 0.25, MT = mb + 8.0;
  const mastAt = (y) => new V3$2(0, y, MAST_Z + (0.22 * (y - MB)) / (MT - MB));
  {
    const pts = []; for (let i = 0; i <= 24; i++) pts.push(mastAt(MB + ((MT - MB) * i) / 24));
    part(PB, sweep$1(pts, { nk: 22, shape: circle$1((s) => 0.105 - 0.042 * s, 22), capEnd: true }), { c: C.spar, r: 0.55, t: T.WOOD, w: 21 });
    part(HB, lathe$2([[0.1, 0], [0.17, 0.0], [0.175, 0.03], [0.14, 0.07], [0.106, 0.075]], 28), { mx: mat(0, mb - 0.01, MAST_Z + 0.006), c: C.woodDark, r: 0.6, t: T.WOOD, w: 22 });
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      part(HB, box(0.035, 0.06, 0.05, 0.006), { mx: mat(Math.cos(a) * 0.125, mb + 0.07, MAST_Z + 0.01 + Math.sin(a) * 0.125, 0, -a, 0.15), c: C.woodDark, r: 0.75, t: T.WOOD, w: 23 + k });
    }
    const top = mastAt(MT);
    part(PB, box(0.12, 0.2, 0.16, 0.02), { mx: mat(0, MT - 0.18, top.z - 0.005), c: C.woodDark, r: 0.6, t: T.WOOD, w: 31 });
    part(PB, new THREE.CylinderGeometry(0.075, 0.075, 0.04, 20), { mx: mat(0, MT - 0.62, mastAt(MT - 0.62).z), c: C.iron, r: 0.6, mt: 0.5, t: T.METAL, w: 1.6 });
    part(PB, lathe$2([[0.001, -0.07], [0.035, -0.065], [0.045, -0.03], [0.045, 0.03], [0.035, 0.065], [0.001, 0.07]], 16), { mx: mat(0.0, MT - 0.35, top.z - 0.1, 0, 0, Math.PI / 2), c: C.woodDark, r: 0.6, t: T.WOOD, w: 32 });
  }
  const snot = mastAt(mb + 0.95).add(new V3$2(0.0, 0, -0.12));
  const peak = new V3$2(-0.16, mb + 8.3, MAST_Z - 2.7);
  {
    const pts = []; for (let i = 0; i <= 40; i++) pts.push(new V3$2().lerpVectors(snot, peak, i / 40));
    part(PB, sweep$1(pts, { nk: 14, shape: circle$1((s) => 0.033 + 0.026 * Math.pow(Math.sin(Math.PI * Math.min(1, s * 1.1)), 0.7), 14), capStart: true, capEnd: true }), { c: C.spar, r: 0.55, t: T.WOOD, w: 33 });
  }
  {
    const b0 = mb + 1.05, b1 = MT - 0.55;
    const bundle = [];
    for (let i = 0; i <= 70; i++) {
      const s = i / 70, y = b0 + (b1 - b0) * s;
      const m = mastAt(y);
      bundle.push(new V3$2(0.015 * Math.sin(s * 9), y, m.z - 0.1 - 0.13 * Math.pow(Math.sin(Math.PI * s), 0.8)));
    }
    const rB = (s) => 0.07 + 0.13 * Math.pow(Math.sin(Math.PI * s), 0.75);
    const fold = (s, k, out) => {
      const th = (k / 22) * Math.PI * 2, r = rB(s);
      const f = 1 + 0.12 * Math.sin(3 * th + s * 37) + 0.07 * Math.sin(5 * th - s * 61) + 0.05 * Math.sin(2 * th + s * 13)
        - 0.16 * Math.pow(Math.max(0, Math.cos(Math.PI * ((s * 6.5) % 1))), 10);
      out[0] = Math.cos(th) * r * f * 1.2; out[1] = Math.sin(th) * r * f * 0.85;
    };
    part(PB, sweep$1(bundle, { nk: 22, shape: fold, up: new V3$2(0, 0, -1), capStart: true, capEnd: true }), { c: C.canvasDressed, r: 0.88, t: T.CANVAS, w: 1, dyn: [0, 0.002, 0.012, 0.006] });
    for (const s of [0.16, 0.31, 0.46, 0.61, 0.76, 0.9]) {
      const c = bundle[Math.round(s * 70)];
      RB.add(ringPts(c.clone().add(new V3$2(0, 0, 0.02)), new V3$2(0, 1, 0), rB(s) * 1.05 + 0.02, 22), 0.007, C.hemp);
    }
    const h0 = mastAt(MT - 0.4).add(new V3$2(0, 0, -0.08)), h1 = peak.clone().add(new V3$2(0.02, -0.1, 0.06));
    const head = catenary(h0, h1, 0.55, 40);
    const rH = (s) => 0.035 + 0.05 * Math.pow(Math.sin(Math.PI * s), 0.6);
    part(PB, sweep$1(head, { nk: 14, shape: (s, k, out) => { const th = (k / 14) * Math.PI * 2; const r = rH(s) * (1 + 0.1 * Math.sin(4 * th + s * 30)); out[0] = Math.cos(th) * r; out[1] = Math.sin(th) * r * 0.7; }, up: new V3$2(0, 1, 0), capStart: true, capEnd: true }), { c: C.canvasDressed, r: 0.88, t: T.CANVAS, w: 2, dyn: [0, 0.003, 0.014, 0.012] });
    const NU = 16, NV = 8, pos = [], uvA = [], dyn = [], idx = [];
    for (let i = 0; i <= NU; i++) {
      const s = i / NU;
      const top = head[Math.round(s * 40)];
      const bot = bundle[Math.round(70 * (0.72 + 0.26 * (1 - s)))].clone().add(new V3$2(0, 0, -0.08));
      for (let j = 0; j <= NV; j++) {
        const t = j / NV;
        const p = new V3$2().lerpVectors(top, bot, t * (0.18 + 0.1 * Math.sin(Math.PI * s)));
        p.x += 0.1 * Math.sin(Math.PI * t) * (0.4 + 0.6 * Math.sin(Math.PI * s)) + 0.02 * Math.sin(s * 17 + t * 9);
        p.z -= 0.08 * Math.sin(Math.PI * t) * Math.sin(Math.PI * s);
        pos.push(p.x, p.y, p.z);
        uvA.push(s * 3.2, t * 2.4);
        const ss = Math.sin(Math.PI * t) * Math.sin(Math.PI * s);
        dyn.push(0, 0.002 + 0.004 * ss, 0.02 * ss, 0.025 * ss * t);
      }
    }
    for (let i = 0; i < NU; i++) for (let j = 0; j < NV; j++) {
      const a = i * (NV + 1) + j, b = a + NV + 1, c = a + 1, d = b + 1;
      idx.push(a, b, c, c, b, d);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvA, 2));
    g.setAttribute('aDyn', new THREE.Float32BufferAttribute(dyn, 4));
    g.setIndex(idx);
    g.computeVertexNormals();
    part(PB, g, { c: C.canvasDressed, r: 0.9, t: T.CANVAS, w: 3 });
  }
  const bsHeel = new V3$2(-0.1, deckY(3.9) + 0.36, 3.9), bsTip = new V3$2(-0.1, 1.74, 7.35);
  {
    const pts = []; for (let i = 0; i <= 24; i++) pts.push(new V3$2().lerpVectors(bsHeel, bsTip, i / 24));
    part(PB, sweep$1(pts, { nk: 16, shape: circle$1((s) => 0.07 - 0.028 * s, 16), capStart: true, capEnd: true }), { c: C.spar, r: 0.6, t: T.WOOD, w: 34 });
    const d = new V3$2().subVectors(bsTip, bsHeel).normalize();
    const j0 = bsHeel.clone().addScaledVector(d, 2.1), j1 = bsHeel.clone().addScaledVector(d, 3.3);
    const jib = []; for (let i = 0; i <= 30; i++) jib.push(new V3$2().lerpVectors(j0, j1, i / 30).add(new V3$2(0, 0.075, 0)));
    const rJ = (s) => 0.04 + 0.05 * Math.pow(Math.sin(Math.PI * s), 0.7);
    part(PB, sweep$1(jib, { nk: 14, shape: (s, k, out) => { const th = (k / 14) * Math.PI * 2; const r = rJ(s) * (1 + 0.12 * Math.sin(3 * th + s * 40)); out[0] = Math.cos(th) * r; out[1] = Math.sin(th) * r * 1.1; }, up: new V3$2(0, 1, 0), capStart: true, capEnd: true }), { c: C.canvas, r: 0.9, t: T.CANVAS, w: 4, dyn: [0, 0.002, 0.006, 0.005] });
    for (const s of [0.2, 0.5, 0.8]) RB.add(ringPts(jib[Math.round(s * 30)], d, rJ(s) + 0.012, 14), 0.006, C.hemp);
    for (const k of [0, 0.06, 0.12]) RB.add(ringPts(new V3$2(-0.1, 1.44 + k * 0.4, 5.66 + k), d, 0.085, 14), 0.008, C.tarred);
    RB.add(catenary(bsTip.clone().add(new V3$2(0, -0.04, -0.05)), new V3$2(0, 0.3, stemZ(0.3) + 0.06), 0.1, 16), 0.011, C.tarred);
  }
  const mzB = deckY(MIZ_Z, MIZ_X), mzT = new V3$2(MIZ_X - 0.02, mzB + 4.1, MIZ_Z - 0.32);
  {
    const b = new V3$2(MIZ_X, mzB - 0.1, MIZ_Z);
    const pts = []; for (let i = 0; i <= 14; i++) pts.push(new V3$2().lerpVectors(b, mzT, i / 14));
    part(PB, sweep$1(pts, { nk: 14, shape: circle$1((s) => 0.06 - 0.025 * s, 14), capEnd: true }), { c: C.spar, r: 0.55, t: T.WOOD, w: 35 });
    part(HB, lathe$2([[0.058, 0], [0.1, 0], [0.1, 0.04], [0.062, 0.05]], 18), { mx: mat(MIZ_X, mzB - 0.005, MIZ_Z), c: C.woodDark, r: 0.6, t: T.WOOD, w: 36 });
    const bun = []; for (let i = 0; i <= 30; i++) { const s = i / 30; bun.push(new V3$2().lerpVectors(b, mzT, 0.3 + 0.55 * s).add(new V3$2(0.0, 0, -0.07 - 0.04 * Math.sin(Math.PI * s)))); }
    const rM = (s) => 0.04 + 0.055 * Math.pow(Math.sin(Math.PI * s), 0.7);
    part(PB, sweep$1(bun, { nk: 14, shape: (s, k, out) => { const th = (k / 14) * Math.PI * 2; const r = rM(s) * (1 + 0.1 * Math.sin(3 * th + s * 29)); out[0] = Math.cos(th) * r; out[1] = Math.sin(th) * r; }, up: new V3$2(0, 0, -1), capStart: true, capEnd: true }), { c: C.canvasDressed, r: 0.9, t: T.CANVAS, w: 5, dyn: [0, 0.002, 0.008, 0.005] });
    for (const s of [0.25, 0.55, 0.85]) RB.add(ringPts(bun[Math.round(s * 30)], new V3$2().subVectors(mzT, b), rM(s) + 0.01, 14), 0.006, C.hemp);
  }
  const AWN = { z0: 1.2, z1: -2.95 };
  const ridgeA = mastAt(mb + 2.55).add(new V3$2(0, 0, -0.12)), ridgeB = new V3$2(MIZ_X + 0.05, mzB + 2.35, MIZ_Z - 0.05);
  const ridge = (z) => { const t = (ridgeA.z - z) / (ridgeA.z - ridgeB.z); const p = new V3$2().lerpVectors(ridgeA, ridgeB, t); p.y -= 0.14 * 4 * t * (1 - t); return p; };
  const battenAt = (z) => { const d = deckAt(z); return new V3$2(-(d.xe - 0.12), d.y + 1.62, z); };
  {
    const NU = 64, NV = 14, pos = [], uvA = [], dyn = [], idx = [];
    const scal = (s) => 0.045 * Math.pow(Math.sin(Math.PI * ((s * 11) % 1)), 0.6);
    for (let i = 0; i <= NU; i++) {
      const s = i / NU, z = AWN.z0 + (AWN.z1 - AWN.z0) * s;
      const R = ridge(z), Bt = battenAt(z);
      const endS = Math.pow(Math.abs(2 * s - 1), 6);
      for (let j = 0; j <= NV; j++) {
        const t = j / NV;
        let p, billow = 0, hem = 0;
        if (t <= 0.78) {
          const tt = t / 0.78;
          p = new V3$2().lerpVectors(R, Bt, tt);
          p.y -= 0.11 * Math.sin(Math.PI * tt) * (0.8 + 0.2 * Math.sin(Math.PI * s));
          p.y += 0.02 * Math.sin(s * 23 + tt * 7) * Math.sin(Math.PI * tt);
          billow = 0.045 * Math.sin(Math.PI * tt) * (0.55 + 0.45 * Math.sin(Math.PI * s));
          hem = 0.02 * endS * Math.sin(Math.PI * tt);
        } else {
          const tt = (t - 0.78) / 0.22;
          p = Bt.clone().add(new V3$2(-0.02 * tt, -0.3 * tt - scal(s) * tt * tt, 0));
          hem = 0.07 * Math.pow(tt, 1.3) + 0.02 * endS;
        }
        pos.push(p.x, p.y, p.z);
        uvA.push(z, t * 2.6);
        dyn.push(0, 0.002 + 0.005 * endS, billow, hem);
      }
    }
    for (let i = 0; i < NU; i++) for (let j = 0; j < NV; j++) {
      const a = i * (NV + 1) + j, b = a + NV + 1, c = a + 1, d = b + 1;
      idx.push(a, b, c, c, b, d);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvA, 2));
    g.setAttribute('aDyn', new THREE.Float32BufferAttribute(dyn, 4));
    g.setIndex(idx);
    g.computeVertexNormals();
    { const N = g.attributes.normal, Dy = g.attributes.aDyn; for (let k = 0; k < Dy.count; k++) if (N.getY(k) < 0) Dy.setZ(k, -Dy.getZ(k)); }
    part(PB, g, { c: C.canvasDressed, r: 0.9, t: T.CANVAS, w: 6 });
    const roll = []; for (let i = 0; i <= 30; i++) { const z = AWN.z0 - 0.1 + (AWN.z1 - AWN.z0 + 0.2) * (i / 30); roll.push(ridge(z).add(new V3$2(0.09, -0.05, 0))); }
    part(PB, sweep$1(roll, { nk: 12, shape: circle$1((s) => 0.055 + 0.01 * Math.sin(s * 40), 12), up: new V3$2(0, 1, 0), capStart: true, capEnd: true }), { c: C.canvasDressed, r: 0.9, t: T.CANVAS, w: 7 });
    for (let z = AWN.z0 - 0.3; z > AWN.z1; z -= 0.7) RB.add(ringPts(ridge(z).add(new V3$2(0.08, -0.05, 0)), new V3$2(0, 0, 1), 0.072, 12), 0.006, C.hemp);
    const bts = []; for (let i = 0; i <= 20; i++) bts.push(battenAt(AWN.z0 + 0.1 + (AWN.z1 - AWN.z0 - 0.2) * (i / 20)));
    part(PB, sweep$1(bts, { nk: 10, shape: circle$1(0.028, 10), capStart: true, capEnd: true }), { c: C.woodGrey, r: 0.7, t: T.WOOD, w: 37 });
    for (const z of [0.75, -2.5]) {
      const Bt = battenAt(z), d = deckAt(z);
      const foot = new V3$2(Bt.x - 0.05, d.edge - 0.02, z), topS = Bt.clone().add(new V3$2(-0.03, 0.22, 0));
      const dir = new V3$2().subVectors(topS, foot).normalize();
      const shaft = []; for (let i = 0; i <= 16; i++) shaft.push(new V3$2().lerpVectors(foot, topS, i / 16));
      part(PB, sweep$1(shaft, { nk: 12, shape: circle$1(0.028, 12), capStart: true, capEnd: true }), { c: C.woodGrey, r: 0.66, t: T.WOOD, w: 38 });
      part(PB, box(0.012, 0.5, 0.13, 0.004), { mx: new THREE.Matrix4().makeBasis(new V3$2(1, 0, 0), dir, new V3$2(0, 0, 1)).setPosition(topS.clone().addScaledVector(dir, 0.25)), c: C.woodGrey, r: 0.66, t: T.WOOD, w: 39 });
      for (const h of [d.ys - 0.02, Bt.y]) RB.add(ringPts(new V3$2(Bt.x - 0.04, h, z), dir, 0.036, 12), 0.006, C.hemp);
    }
    for (let z = AWN.z0 - 0.2; z > AWN.z1; z -= 0.8) {
      const Bt = battenAt(z), d = deckAt(z);
      RB.add(catenary(Bt.clone().add(new V3$2(-0.02, -0.02, 0)), new V3$2(-(d.xe + 0.02), d.ys + 0.01, z + 0.15), 0.03, 8), 0.005, C.hemp, { sway: 0.03 });
    }
    RB.add(catenary(ridgeA, ridgeB, 0.14, 40), 0.009, C.hemp);
  }
  const pz = PUMP_Z, pd = deckY(pz), AX = pd + 0.8, WX = 0.42, WR = 0.36, HR = 0.31;
  const PUMP = { z: pz, axle: AX, wx: WX, hr: HR, deck: pd };
  {
    part(HB, box(0.8, 0.05, 0.64, 0.01), { mx: mat(0, pd + 0.02, pz), c: C.woodDark, r: 0.7, t: T.WOOD, w: 40 });
    part(PB, box(0.62, 0.84, 0.5, 0.018), { mx: mat(0, pd + 0.46, pz), c: C.teak, r: 0.45, t: T.WOOD, w: 41, uvSwap: true });
    part(PB, box(0.67, 0.04, 0.55, 0.012), { mx: mat(0, pd + 0.9, pz), c: C.teak, r: 0.42, t: T.WOOD, w: 42 });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const X = sx * 0.31, Z = pz + sz * 0.25, FL = 0.034, TH = 0.0035, H = 0.8, Y = pd + 0.46;
      const recX = (pp) => [0.24, 1, T.METAL, 0.06 + 0.88 * smooth$2(0.2, 1.0, Math.abs(pp.z - Z) / FL)];
      const recZ = (pp) => [0.24, 1, T.METAL, 0.06 + 0.88 * smooth$2(0.2, 1.0, Math.abs(pp.x - X) / FL)];
      part(PB, box(TH, H, FL, 0.0015), { mx: mat(X + sx * TH * 0.5, Y, Z - sz * FL * 0.5), c: C.brass, am: recX });
      part(PB, box(FL, H, TH, 0.0015), { mx: mat(X - sx * FL * 0.5, Y, Z + sz * TH * 0.5), c: C.brass, am: recZ });
      for (let k = 0; k < 5; k++) {
        const y = Y - H / 2 + 0.07 + (k * (H - 0.14)) / 4;
        part(PB, new THREE.CylinderGeometry(0.0042, 0.0042, 0.0016, 10), { mx: mat(X + sx * TH, y, Z - sz * FL * 0.6, 0, 0, Math.PI / 2), c: C.brass, am: [0.3, 1, T.METAL, 0.7] });
        part(PB, new THREE.CylinderGeometry(0.0042, 0.0042, 0.0016, 10), { mx: mat(X - sx * FL * 0.6, y, Z + sz * TH, Math.PI / 2, 0, 0), c: C.brass, am: [0.3, 1, T.METAL, 0.7] });
      }
    }
    for (const sz of [-1, 1]) {
      const zf = pz + sz * 0.253;
      for (const [w, h, x, y] of [[0.5, 0.028, 0, pd + 0.8], [0.5, 0.028, 0, pd + 0.14], [0.028, 0.66, -0.236, pd + 0.47], [0.028, 0.66, 0.236, pd + 0.47]]) {
        part(PB, box(w, h, 0.012, 0.004), { mx: mat(x, y, zf), c: C.teak, r: 0.42, t: T.WOOD, w: 63 });
      }
      part(PB, box(0.4, 0.56, 0.008, 0.006), { mx: mat(0, pd + 0.47, zf - sz * 0.001), c: C.teak.map((v) => v * 0.9), r: 0.45, t: T.WOOD, w: 64 });
    }
    part(PB, new THREE.CylinderGeometry(0.1, 0.1, 0.006, 32).scale(1, 1, 0.45), { mx: mat(0, pd + 0.3, pz + 0.252, Math.PI / 2, 0, 0), c: C.brass, r: 0.35, mt: 1, t: T.METAL, w: 0.7 });
    const gc = new V3$2(0, pd + 0.62, pz + 0.253);
    part(PB, new THREE.TorusGeometry(0.086, 0.012, 12, 40), { mx: mat(gc.x, gc.y, gc.z + 0.012), c: C.brass, r: 0.28, mt: 1, t: T.METAL, w: 0.35 });
    part(PB, new THREE.CylinderGeometry(0.09, 0.09, 0.02, 32), { mx: mat(gc.x, gc.y, gc.z + 0.002, Math.PI / 2, 0, 0), c: C.brass, r: 0.3, mt: 1, t: T.METAL, w: 0.4 });
    part(PB, new THREE.CircleGeometry(0.078, 40), { mx: mat(gc.x, gc.y, gc.z + 0.0135), c: C.dial, r: 0.2, t: T.DIAL });
    const ns = new THREE.Shape();
    ns.moveTo(-24e-4, -0.012); ns.lineTo(-13e-4, 0.026); ns.lineTo(-35e-5, 0.064); ns.lineTo(0.00035, 0.064); ns.lineTo(0.0013, 0.026); ns.lineTo(0.0024, -0.012); ns.lineTo(-24e-4, -0.012);
    const NDL = { c: [0.025, 0.03, 0.045], r: 0.35, mt: 0.6, anim: [2, gc.x, gc.y, 0] };
    part(PB, new THREE.ExtrudeGeometry(ns, { depth: 0.0012, bevelEnabled: false }), Object.assign({ mx: mat(gc.x, gc.y, gc.z + 0.0155) }, NDL));
    part(PB, new THREE.CylinderGeometry(0.0055, 0.0055, 0.0014, 18), Object.assign({ mx: mat(gc.x, gc.y - 0.014, gc.z + 0.0162, Math.PI / 2, 0, 0) }, NDL));
    part(PB, new THREE.CylinderGeometry(0.006, 0.0065, 0.005, 14), { mx: mat(gc.x, gc.y, gc.z + 0.0185, Math.PI / 2, 0, 0), c: C.brass, r: 0.3, mt: 1, t: T.METAL, w: 0.2 });
    part(PB, new THREE.CircleGeometry(0.08, 32), { mx: mat(gc.x, gc.y, gc.z + 0.023), c: C.glass, r: 0.04, t: T.GLASS, w: -0.46 });
    for (const sx of [-1, 1]) part(PB, new THREE.CylinderGeometry(0.05, 0.055, 0.06, 20), { mx: mat(sx * 0.335, AX, pz, 0, 0, Math.PI / 2), c: C.brass, r: 0.32, mt: 1, t: T.METAL, w: 0.45 });
    part(PB, new THREE.CylinderGeometry(0.022, 0.022, 2 * WX + 0.12, 14), { mx: mat(0, AX, pz, 0, 0, Math.PI / 2), c: C.iron, r: 0.45, mt: 0.8, t: T.METAL, w: 1.2, anim: [1, AX, pz, 0] });
    for (const sx of [-1, 1]) {
      const anim = [1, AX, pz, sx > 0 ? 0 : Math.PI];
      const wx = sx * WX;
      const W = (g, mx, o = {}) => part(PB, g, Object.assign({ mx, c: C.iron, r: 0.42, mt: 0.15, t: T.METAL, w: 1.12, anim }, o));
      W(new THREE.TorusGeometry(WR, 0.026, 12, 96).scale(1, 1, 1.5), mat(wx, AX, pz, 0, Math.PI / 2, 0));
      W(new THREE.CylinderGeometry(0.07, 0.07, 0.09, 24), mat(wx, AX, pz, 0, 0, Math.PI / 2));
      W(new THREE.CylinderGeometry(0.045, 0.045, 0.11, 20), mat(wx + sx * 0.03, AX, pz, 0, 0, Math.PI / 2));
      for (let k = 0; k < 6; k++) {
        const a0 = (k * Math.PI) / 3 + 0.2;
        const spoke = [];
        for (let i = 0; i <= 10; i++) {
          const r = 0.06 + (WR - 0.08) * (i / 10), a = a0 + 0.35 * Math.sin((i / 10) * Math.PI) * (i / 10);
          spoke.push(new V3$2(wx, AX + Math.cos(a) * r, pz + Math.sin(a) * r));
        }
        W(sweep$1(spoke, { nk: 8, shape: circle$1((s) => 0.017 - 0.005 * s, 8), capStart: true, capEnd: true }));
      }
      const hp = new V3$2(wx, AX + HR, pz);
      W(new THREE.CylinderGeometry(0.014, 0.014, 0.22, 10), mat(hp.x + sx * 0.1, hp.y, hp.z, 0, 0, Math.PI / 2));
      W(lathe$2([[0.001, 0], [0.024, 0.0], [0.028, 0.02], [0.025, 0.07], [0.028, 0.12], [0.026, 0.145], [0.001, 0.15]], 14), mat(hp.x + sx * 0.055, hp.y, hp.z, 0, 0, -sx * Math.PI / 2), { c: [0.3, 0.2, 0.12], r: 0.45, mt: 0, t: T.GRIP, w: 43 });
      W(new THREE.SphereGeometry(0.03, 12, 8), mat(hp.x + sx * 0.03, hp.y, hp.z));
    }
    const cock = new V3$2(0.2, pd + 0.95, pz + 0.12);
    part(PB, new THREE.CylinderGeometry(0.03, 0.035, 0.08, 16), { mx: mat(cock.x, cock.y, cock.z), c: C.brass, r: 0.3, mt: 1, t: T.METAL, w: 0.5 });
    part(PB, new THREE.TorusGeometry(0.035, 0.012, 10, 20, Math.PI / 2), { mx: mat(cock.x + 0.035, cock.y + 0.04, cock.z, Math.PI / 2, 0, 0), c: C.brass, r: 0.3, mt: 1, t: T.METAL, w: 0.5 });
    part(PB, box(0.09, 0.012, 0.02, 0.004), { mx: mat(cock.x, cock.y + 0.055, cock.z, 0, 0.5, 0), c: C.brass, r: 0.3, mt: 1, t: T.METAL, w: 0.3 });
    PUMP.outlet = new V3$2(cock.x + 0.075, cock.y + 0.04, cock.z);
    const hg = new V3$2(-0.19, pd + 0.92, pz - 0.1), HH = 0.19;
    for (const y of [0.006, HH - 0.006]) part(PB, new THREE.CylinderGeometry(0.048, 0.048, 0.012, 20), { mx: mat(hg.x, hg.y + y, hg.z), c: C.woodDark, r: 0.5, t: T.WOOD, w: 44 });
    for (let k = 0; k < 3; k++) { const a = (k / 3) * Math.PI * 2; part(PB, new THREE.CylinderGeometry(0.006, 0.006, HH, 8), { mx: mat(hg.x + Math.cos(a) * 0.04, hg.y + HH / 2, hg.z + Math.sin(a) * 0.04), c: C.woodDark, r: 0.5, t: T.WOOD, w: 45 }); }
    const bulb = [[0.004, 0.012], [0.028, 0.02], [0.034, 0.045], [0.028, 0.075], [0.006, 0.093], [0.004, 0.095], [0.006, 0.097], [0.028, 0.115], [0.034, 0.145], [0.028, 0.17], [0.004, 0.178]];
    part(PB, lathe$2(bulb, 24), { mx: mat(hg.x, hg.y, hg.z), c: C.glass, r: 0.04, t: T.GLASS, w: 0 });
    part(PB, heightUV(lathe$2([[0.001, 0.1], [0.026, 0.12], [0.031, 0.145], [0.026, 0.168], [0.001, 0.172]], 16)), { mx: mat(hg.x, hg.y, hg.z), c: [0.66, 0.52, 0.32], r: 0.9, t: T.SAND, w: 0 });
    part(PB, heightUV(lathe$2([[0.001, 0.014], [0.027, 0.022], [0.031, 0.04], [0.02, 0.06], [0.001, 0.085]], 16)), { mx: mat(hg.x, hg.y, hg.z), c: [0.66, 0.52, 0.32], r: 0.9, t: T.SAND, w: 1 });
  }
  const outside = (z, y, off = 0) => {
    const u = uAtZ(z, y), v = vAtY(u, Math.min(y, sheerY(u) - 1e-3));
    const p = hullPoint(u, v, 1, new V3$2()), n = hullNormal(u, v, 1, new V3$2());
    return p.addScaledVector(n, off);
  };
  const railTop = (z, side = 1) => { const d = deckAt(z); return new V3$2(side * (innerX(z, d.ys - 0.03) + PLANK_T * 0.5 + 0.01), d.ys, z); };

  const DIVE = {};
  {
    const z = DIVE_Z, rt = railTop(z), rungs = [];
    for (const dz of [-0.2, 0.2]) {
      const zz = z + dz, r2 = railTop(zz);
      const pts = [r2.clone().add(new V3$2(0.075, 0.2, 0)), r2.clone().add(new V3$2(0.085, 0.02, 0))];
      for (let y = r2.y - 0.12; y > -1.05; y -= 0.12) pts.push(outside(zz, y, 0.075 + 0.05 * Math.max(0, -y)));
      const curve = new THREE.CatmullRomCurve3(pts).getSpacedPoints(40);
      part(PB, sweep$1(curve, { nk: 10, shape: roundRect(0.03, 0.018, 0.008, 2), up: new V3$2(0, 0, 1), capStart: true, capEnd: true }), { c: [0.15, 0.12, 0.085], r: 0.75, t: T.WOOD, w: 46 });
      const hk = [r2.clone().add(new V3$2(0.08, 0.06, 0)), r2.clone().add(new V3$2(0.0, 0.075, 0)), r2.clone().add(new V3$2(-0.075, 0.05, 0)), r2.clone().add(new V3$2(-0.085, -0.03, 0))];
      part(PB, sweep$1(new THREE.CatmullRomCurve3(hk).getSpacedPoints(12), { nk: 8, shape: circle$1(0.009, 8), capStart: true, capEnd: true }), { c: C.iron, r: 0.6, mt: 0.5, t: T.METAL, w: 1.8 });
    }
    for (let y = rt.y - 0.2; y > -1; y -= 0.28) {
      const a = outside(z - 0.2, y, 0.075 + 0.05 * Math.max(0, -y)), b = outside(z + 0.2, y, 0.075 + 0.05 * Math.max(0, -y));
      part(PB, new THREE.CylinderGeometry(0.018, 0.018, 1, 10), { mx: matAlong(a, b), c: [0.15, 0.12, 0.085], r: 0.75, t: T.WOOD, w: 47 });
      rungs.push(a.clone().lerp(b, 0.5));
    }
    const dx = innerX(z, deckY(z) + 0.1) - 0.24;
    DIVE.pos = new V3$2(dx, deckY(z, dx), z);
    DIVE.out = new V3$2(1, 0, 0);
    DIVE.up = new V3$2(0, 1, 0);
    DIVE.rail = rt.clone();
    DIVE.ladderTop = rt.clone().add(new V3$2(0.08, 0.02, 0));
    DIVE.ladderBottom = rungs[rungs.length - 1].clone();
    DIVE.rungs = rungs;
    DIVE.rungStep = 0.28;
  }
  const notch = railTop(NOTCH_Z);
  notch.y -= 0.012;
  const cz = -2.12, cy = deckY(cz) + 0.2, cx = innerX(cz, cy) - 0.035;
  const cleatP = new V3$2(cx, cy, cz);
  part(PB, box(0.03, 0.05, 0.07, 0.008), { mx: mat(cx + 0.014, cy + 0.02, cz), c: C.woodDark, r: 0.6, t: T.WOOD, w: 61 });
  part(PB, sweep$1(new THREE.CatmullRomCurve3([new V3$2(cx + 0.005, cy + 0.035, cz - 0.12), new V3$2(cx - 0.004, cy + 0.052, cz - 0.05), new V3$2(cx - 0.006, cy + 0.055, cz), new V3$2(cx - 0.004, cy + 0.052, cz + 0.05), new V3$2(cx + 0.005, cy + 0.035, cz + 0.12)]).getSpacedPoints(18), { nk: 10, shape: circle$1((s) => 0.017 - 0.008 * Math.abs(s - 0.5) * 2, 10), capStart: true, capEnd: true }), { c: C.woodDark, r: 0.55, t: T.WOOD, w: 62 });
  const TETHER = { pos: notch.clone(), pump: PUMP.outlet.clone(), cleat: cleatP.clone() };
  const LINES = {};
  {
    const hc = new V3$2(0.62, 0, -1.5), hy = deckY(hc.z, hc.x) + 0.024;
    const coil = flake(hc, 0.29, 4.5, hy, rng, 30, 0.02, 0.012);
    coil[coil.length - 1]; const bot = coil[0];
    const o = PUMP.outlet;
    const fromPump = new THREE.CatmullRomCurve3([o, o.clone().add(new V3$2(0.12, 0.02, 0)), new V3$2(o.x + 0.28, pd + 0.45, o.z - 0.2), new V3$2(bot.x + 0.1, hy + 0.06, bot.z + 0.25), bot]).getSpacedPoints(30);
    const outer = coil[coil.length - 1];
    const toRail = [outer, outer.clone().add(new V3$2(0.2, 0.0, -0.05)), new V3$2(1.2, deckY(-1.6, 1.2) + 0.025, -1.62), new V3$2(1.52, deckY(-1.6, 1.5) + 0.03, -1.61), new V3$2(1.64, notch.y - 0.12, NOTCH_Z - 0.02), new V3$2(1.7, notch.y + 0.03, NOTCH_Z - 0.03)];
    const onCap = [notch.clone().add(new V3$2(-0.045, 0.026, -0.012)), notch.clone().add(new V3$2(0, 0.022, 0))];
    LINES.hose = { coil: [...fromPump, ...coil.slice(1)], run: new THREE.CatmullRomCurve3([...toRail, ...onCap]).getSpacedPoints(44) };
  }
  TETHER.water = outside(NOTCH_Z, 0.0, 0.06);

  for (const [bx, bz, full] of [[0.62, 1.52, 1], [-0.98, 0.2, 1], [-0.92, -2.15, 0.4]]) {
    const y0 = deckY(bz, bx) - 0.01;
    part(PB, lathe$2([[0.001, 0], [0.16, 0], [0.19, 0.02], [0.23, 0.12], [0.26, 0.26], [0.28, 0.38], [0.285, 0.4]], 40), { mx: mat(bx, y0, bz), c: C.wicker, r: 0.85, t: T.WICKER, uvs: [1, 0.4] });
    part(PB, new THREE.TorusGeometry(0.285, 0.018, 10, 56), { mx: mat(bx, y0 + 0.4, bz, Math.PI / 2, 0, 0), c: C.wicker, r: 0.85, t: T.WICKER, uvs: [1, 0.1] });
    for (let k = 0; k < Math.round(13 * full); k++) {
      const a = rng() * 6.28, rr = Math.sqrt(rng()) * 0.18;
      const r = 0.035 + rng() * rng() * 0.05, fresh = rng() < 0.55;
      const sg = spongeGeo(rng, r, fresh);
      part(PB, sg, { mx: mat(bx + Math.cos(a) * rr, y0 + 0.4 * full - 0.07 + rng() * 0.12, bz + Math.sin(a) * rr, (rng() - 0.5) * 0.9, rng() * 6.28, (rng() - 0.5) * 0.9), c: sg.attributes.color, r: 0.95, t: T.SPONGE, w: fresh ? 0 : 1 });
    }
  }
  {
    const bx = -0.62, bz = -3.05, y0 = deckY(bz, bx) - 0.01, Hh = 0.6;
    const prof = [[0.001, 0.02], [0.16, 0.02]];
    for (let k = 0; k <= 16; k++) { const t = k / 16; prof.push([0.175 + 0.038 * Math.sin(Math.PI * t), t * Hh]); }
    prof.push([0.165, Hh - 0.02], [0.001, Hh - 0.02]);
    part(PB, lathe$2(prof, 40), { mx: mat(bx, y0, bz, 0, 1.3, 0), c: C.wood, r: 0.7, t: T.WOOD, w: 48, uvSwap: true, uvs: [Hh, 1] });
    for (const t of [0.07, 0.27, 0.73, 0.93]) part(PB, new THREE.TorusGeometry(0.175 + 0.038 * Math.sin(Math.PI * t) + 0.004, 0.009, 8, 56), { mx: mat(bx, y0 + t * Hh, bz, Math.PI / 2, 0, 0), c: C.iron, r: 0.6, mt: 0.6, t: T.METAL, w: 1.5 });
    part(PB, new THREE.CylinderGeometry(0.17, 0.17, 0.025, 30), { mx: mat(bx, y0 + Hh + 0.005, bz), c: C.woodGrey, r: 0.7, t: T.WOOD, w: 49 });
    part(PB, lathe$2([[0.001, 0], [0.05, 0], [0.055, 0.07], [0.058, 0.075]], 18), { mx: mat(bx + 0.06, y0 + Hh + 0.02, bz - 0.04), c: [0.5, 0.5, 0.48], r: 0.35, mt: 0.9, t: T.METAL, w: 0.1 });
    for (const [jx, jz, s] of [[-0.52, 2.62, 1], [-0.84, 2.42, 0.9]]) {
      const jy = deckY(jz, jx) - 0.01;
      part(PB, lathe$2([[0.001, 0], [0.07, 0], [0.11, 0.04], [0.16, 0.16], [0.17, 0.26], [0.14, 0.38], [0.075, 0.46], [0.055, 0.5], [0.066, 0.53], [0.058, 0.545], [0.04, 0.54], [0.038, 0.5]].map(([r, y]) => [r * s, y * s]), 36), { mx: mat(jx, jy, jz, 0, rng() * 6, 0), c: C.clay, r: 0.85, t: T.CLAY });
      RB.add(ringPts(new V3$2(jx, jy + 0.5 * s, jz), new V3$2(0, 1, 0), 0.062 * s, 12), 0.006, C.hemp);
      part(PB, wadGeo(rng, 0.03), { mx: mat(jx, jy + 0.55 * s, jz), c: [0.3, 0.26, 0.2], r: 0.95, t: T.CLOTH });
    }
    for (const [sx, sz, ry, lie] of [[0.52, 3.55, 0.3, 0], [0.2, 3.98, -0.4, 1], [-0.5, 3.62, 1.2, 0]]) {
      const prof = [[0.001, 0], [0.15, 0.004], [0.19, 0.04], [0.205, 0.12], [0.195, 0.22], [0.16, 0.3], [0.1, 0.36], [0.05, 0.395], [0.034, 0.41], [0.048, 0.43], [0.06, 0.46], [0.045, 0.49], [0.001, 0.495]];
      const g = lathe$2(prof, 30);
      const o = rng() * 50;
      lump(g, (p) => 0.012 * fbm3(p.x * 11 + o, p.y * 11, p.z * 11, 3) + 0.01 * Math.sin(Math.atan2(p.z, p.x) * 7 + p.y * 9) * smooth$2(0.36, 0.44, p.y));
      const ys = lie ? 0.82 : 0.9;
      g.scale(1.08, ys, 0.92);
      const sy = deckY(sz, sx);
      const M = lie ? mat(sx, sy + 0.2, sz, 0, ry, Math.PI / 2 - 0.12) : mat(sx, sy - 0.005, sz, 0, ry, 0);
      part(PB, g, { mx: M, c: C.sack.map((v) => v * (0.9 + 0.2 * rng())), r: 0.95, t: T.CLOTH, w: rng() * 5 });
      const neck = new V3$2(0, ys * 0.415, 0).applyMatrix4(M);
      const ax = new V3$2(0, 1, 0).applyMatrix4(new THREE.Matrix4().extractRotation(M));
      RB.add(ringPts(neck, ax, 0.04, 14), 0.005, TWINE);
    }
  }
  {
    const sweepOar = (p0, p1) => {
      const pts = []; for (let i = 0; i <= 60; i++) pts.push(new V3$2().lerpVectors(p0, p1, i / 60));
      const shape = (s, k, out) => {
        const th = (k / 16) * Math.PI * 2;
        const r = s < 0.06 ? 0.024 : s < 0.09 ? 0.024 + (s - 0.06) * 0.4 : 0.036 - 0.008 * smooth$2(0.1, 0.72, s);
        const tb = smooth$2(0.72, 0.8, s);
        const tip = s > 0.84 ? Math.sqrt(Math.max(0.0004, 1 - ((s - 0.84) / 0.16) ** 2)) : 1;
        out[0] = Math.cos(th) * (r + (0.012 - r) * tb) * (0.3 + 0.7 * tip);
        out[1] = Math.sin(th) * (r + (0.07 - r) * tb) * tip;
      };
      part(PB, sweep$1(pts, { nk: 16, shape, up: new V3$2(0, 1, 0), capStart: true, capEnd: true }), { c: C.woodGrey, r: 0.66, t: T.WOOD, w: 50 + rng() * 3 });
    };
    for (const [zA, zB, k] of [[2.55, -1.7, 0.2], [2.35, -1.9, 0.3]]) {
      const xa = -(deckAt(zA).xe - k), xb = -(deckAt(zB).xe - k);
      sweepOar(new V3$2(xa, deckY(zA, xa) + 0.03, zA), new V3$2(xb, deckY(zB, xb) + 0.03, zB));
    }
    const h0 = new V3$2(-(deckAt(-1.9).xe - 0.12), 0, -1.9), h1 = new V3$2(-(deckAt(-4.4).xe - 0.1), 0, -4.4);
    h0.y = deckY(h0.z, h0.x) + 0.08; h1.y = deckY(h1.z, h1.x) + 0.04;
    const hk = []; for (let i = 0; i <= 30; i++) hk.push(new V3$2().lerpVectors(h0, h1, i / 30));
    part(PB, sweep$1(hk, { nk: 10, shape: circle$1(0.02, 10), capStart: true, capEnd: true }), { c: C.woodGrey, r: 0.68, t: T.WOOD, w: 53 });
    part(PB, new THREE.TorusGeometry(0.045, 0.009, 8, 20, Math.PI * 1.3), { mx: mat(h0.x, h0.y + 0.03, h0.z + 0.05, 0, Math.PI / 2, 0), c: C.iron, r: 0.6, mt: 0.5, t: T.METAL, w: 1.7 });
    const gx = 1.12, gz = 2.62, gy = deckY(gz, gx);
    part(PB, lathe$2([[0.001, 0.0], [0.14, 0.0], [0.15, 0.03], [0.2, 0.32], [0.215, 0.36], [0.2, 0.36]], 30), { mx: mat(gx, gy, gz, 0.0, 0, 0.0), c: C.woodGrey, r: 0.7, t: T.WOOD, w: 54, uvSwap: true });
    for (const t of [0.05, 0.3]) part(PB, new THREE.TorusGeometry(0.148 + 0.2 * t * 0.3, 0.007, 8, 40), { mx: mat(gx, gy + t, gz, Math.PI / 2, 0, 0), c: C.iron, r: 0.6, mt: 0.5, t: T.METAL, w: 1.6 });
    part(PB, new THREE.CircleGeometry(0.135, 30), { mx: mat(gx, gy + 0.003, gz, -Math.PI / 2, 0, 0), c: [0.1, 0.12, 0.1], r: 0.05, t: T.GLASS, w: 0 });
    const cx = 0.52, cz = -4.4, cy = deckY(cz, cx), cr = 0.08;
    const CP = (x, y, z) => new V3$2(cx + x * Math.cos(cr) + z * Math.sin(cr), cy + y, cz - x * Math.sin(cr) + z * Math.cos(cr));
    const CM = (x, y, z) => { const q = CP(x, y, z); return mat(q.x, q.y, q.z, 0, cr, 0); };
    const chestC = [0.2, 0.125, 0.07];
    for (let k = 0; k < 3; k++) part(HB, box(0.42, 0.096, 0.34, 0.006), { mx: CM(0, 0.05 + k * 0.1, 0), c: chestC.map((v) => v * (0.92 + 0.16 * rng())), r: 0.7, t: T.WOOD, w: 55 + k });
    part(HB, box(0.44, 0.035, 0.36, 0.008), { mx: CM(0, 0.318, 0), c: chestC, r: 0.62, t: T.WOOD, w: 58.5 });
    for (const x of [-0.13, 0.13]) {
      part(HB, box(0.03, 0.004, 0.365, 0.0015), { mx: CM(x, 0.3375, 0), c: C.iron, r: 0.6, mt: 0.3, t: T.METAL, w: 1.6 });
      part(HB, box(0.03, 0.3, 0.004, 0.0015), { mx: CM(x, 0.16, 0.172), c: C.iron, r: 0.6, mt: 0.3, t: T.METAL, w: 1.6 });
    }
    for (const s of [-1, 1]) RB.add(catenary(CP(s * 0.218, 0.24, -0.07), CP(s * 0.218, 0.24, 0.07), 0.05, 12), 0.008, C.hemp);
    PUMP.captainSeat = cy + 0.34;
    const sx = 0.62, sz = -2.9, sy = deckY(sz, sx), stoolC = [0.26, 0.18, 0.11];
    part(PB, new THREE.CylinderGeometry(0.15, 0.15, 0.035, 22), { mx: mat(sx, sy + 0.34, sz), c: stoolC, r: 0.62, t: T.WOOD, w: 56 });
    for (let k = 0; k < 3; k++) { const a = (k / 3) * Math.PI * 2 + 0.3; part(PB, new THREE.CylinderGeometry(0.018, 0.022, 0.36, 8), { mx: matAlong(new V3$2(sx + Math.cos(a) * 0.08, sy + 0.33, sz + Math.sin(a) * 0.08), new V3$2(sx + Math.cos(a) * 0.13, sy, sz + Math.sin(a) * 0.13)), c: stoolC, r: 0.7, t: T.WOOD, w: 57 }); }
    const ga = new V3$2(0.5, deckY(4.25, 0.5) + 0.03, 4.25);
    part(PB, new THREE.CylinderGeometry(0.02, 0.02, 0.5, 10), { mx: mat(ga.x, ga.y, ga.z, Math.PI / 2, 0.4, 0), c: C.iron, r: 0.6, mt: 0.5, t: T.METAL, w: 1.9 });
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + 0.4, tip = new V3$2(Math.cos(a) * 0.16, Math.sin(a) * 0.16, 0);
      const fl = [new V3$2(0, 0, 0), new V3$2(tip.x * 0.6, tip.y * 0.6, -0.02), new V3$2(tip.x, tip.y, -0.1)];
      const M = mat(ga.x - 0.1, ga.y, ga.z - 0.23, 0, 0.4, 0);
      part(PB, sweep$1(new THREE.CatmullRomCurve3(fl).getSpacedPoints(8), { nk: 8, shape: circle$1((s) => 0.016 - 0.01 * s, 8), capEnd: true }), { mx: M, c: C.iron, r: 0.6, mt: 0.5, t: T.METAL, w: 1.9 });
    }
    const jz = -3.35, jr = railTop(jz, -1);
    const NU = 12, NV = 10, pos = [], uvJ = [], idx = [];
    for (let i = 0; i <= NU; i++) {
      const s = i / NU;
      for (let j = 0; j <= NV; j++) {
        const t = j / NV, a = (t - 0.5) * Math.PI * 1.15;
        const hang = Math.max(0, Math.abs(t - 0.5) - 0.12) * 1.2;
        const x = jr.x - 0.06 * Math.sin(a) * 1.4 + (t < 0.5 ? 0.02 : -0.06) * hang * 3 * 0;
        const y = jr.y + 0.035 * Math.cos(a) - hang * 0.9 - 0.02 * Math.sin(s * 9 + t * 5);
        pos.push(x + (t < 0.5 ? 1 : -1) * 0.0 + (t - 0.5) * 0.12 * (hang > 0 ? 1 : 0), y, jz + (s - 0.5) * 0.5 + 0.02 * Math.sin(t * 7));
        uvJ.push(s * 0.5, t * 0.8);
      }
    }
    for (let i = 0; i < NU; i++) for (let j = 0; j < NV; j++) { const a = i * (NV + 1) + j, b = a + NV + 1, c = a + 1, d = b + 1; idx.push(a, b, c, c, b, d); }
    const jg = new THREE.BufferGeometry();
    jg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    jg.setAttribute('uv', new THREE.Float32BufferAttribute(uvJ, 2));
    jg.setIndex(idx);
    jg.computeVertexNormals();
    part(PB, jg, { c: lin(0x5a4633), r: 0.95, t: T.CLOTH, w: 7 });
  }
  {
    const hz = DIVE_Z + 0.55, hp = railTop(hz); hp.x -= 0.27; hp.y -= 0.03;
    const g = new THREE.SphereGeometry(0.16, 20, 14, 0, Math.PI * 2, 0.35, Math.PI - 0.35);
    g.scale(0.8, 1.35, 0.8);
    g.translate(0, -0.25, 0);
    const piv = hp.y;
    part(PB, g, { mx: mat(hp.x - 0.05, hp.y, hp.z), c: TWINE, r: 0.9, t: T.NET, w: 0, dyn: (p) => [Math.max(0, piv - p.y) * 0.9, 0] });
    for (let k = 0; k < 3; k++) {
      const sg = spongeGeo(rng, 0.045 + rng() * 0.02, true);
      part(PB, sg, { mx: mat(hp.x - 0.05 + (rng() - 0.5) * 0.06, hp.y - 0.36 + k * 0.08, hp.z + (rng() - 0.5) * 0.06, (rng() - 0.5) * 1.2, rng() * 6.28, 0), c: sg.attributes.color, r: 0.95, t: T.SPONGE, w: 0, dyn: [0.38 - k * 0.08, 0] });
    }
    RB.add([new V3$2(hp.x + 0.04, hp.y + 0.03, hp.z), new V3$2(hp.x - 0.05, hp.y - 0.06, hp.z)], 0.005, TWINE);
  }
  const LOUT = new V3$2(0, 0, 1);
  const mR = 0.105 - (0.042 * (mb + 2.5 - MB)) / (MT - MB);
  const lanternHook = mastAt(mb + 2.5).addScaledVector(LOUT, mR + 0.21);
  const lantern = lanternHook.clone().add(new V3$2(0, -0.28, 0));
  {
    const L0 = lantern, lev = (p) => [Math.max(0, lanternHook.y - p.y) * 0.9, 0];
    const at = (y) => mat(L0.x, L0.y + y, L0.z);
    const brass = (w) => ({ c: C.brass, r: 0.3, mt: 1, t: T.METAL, w, dyn: lev });
    part(PB, lathe$2([[0.001, -0.13], [0.056, -0.13], [0.067, -0.124], [0.071, -0.108], [0.068, -0.09], [0.057, -0.082], [0.036, -0.078], [0.001, -0.078]], 32), Object.assign({ mx: at(0) }, brass(0.45)));
    part(PB, new THREE.CylinderGeometry(0.011, 0.012, 0.012, 12), Object.assign({ mx: mat(L0.x, L0.y - 0.078, L0.z - 0.04) }, brass(0.5)));
    part(PB, lathe$2([[0.001, -0.08], [0.028, -0.08], [0.03, -0.066], [0.022, -0.052], [0.014, -0.046], [0.012, -0.03], [0.001, -0.03]], 20), Object.assign({ mx: at(0) }, brass(0.6)));
    part(PB, new THREE.CylinderGeometry(0.009, 0.009, 0.004, 12), Object.assign({ mx: mat(L0.x, L0.y - 0.062, L0.z + 0.03, Math.PI / 2, 0, 0) }, brass(0.3)));
    part(PB, lathe$2([[0.03, -0.05], [0.044, -0.042], [0.054, -0.022], [0.058, 0.0], [0.056, 0.024], [0.048, 0.046], [0.036, 0.06]], 32), { mx: at(0), c: C.glass, r: 0.05, t: T.GLASS, w: 0.12, dyn: lev });
    part(PB, new THREE.TorusGeometry(0.036, 0.005, 8, 28), Object.assign({ mx: mat(L0.x, L0.y - 0.05, L0.z, Math.PI / 2, 0, 0) }, brass(0.4)));
    for (const a0 of [Math.PI / 2 - 0.6, Math.PI / 2 + 0.6, -Math.PI / 2 - 0.6, -Math.PI / 2 + 0.6]) {
      const wire = [];
      for (let k = 0; k <= 10; k++) {
        const y = -0.05 + 0.11 * (k / 10), r = 0.05 + 0.017 * Math.sin(Math.PI * (k / 10));
        wire.push(new V3$2(L0.x + Math.cos(a0) * r, L0.y + y, L0.z + Math.sin(a0) * r));
      }
      part(PB, sweep$1(wire, { nk: 6, shape: circle$1(0.0022, 6), capStart: true, capEnd: true }), brass(0.5));
    }
    part(PB, lathe$2([[0.034, 0.058], [0.056, 0.064], [0.062, 0.074], [0.052, 0.09], [0.028, 0.104], [0.022, 0.118], [0.03, 0.12], [0.031, 0.128], [0.022, 0.138], [0.001, 0.141]], 32), Object.assign({ mx: at(0) }, brass(0.55)));
    for (const sx of [-1, 1]) {
      const tube = [new V3$2(L0.x + sx * 0.074, L0.y - 0.1, L0.z), new V3$2(L0.x + sx * 0.074, L0.y + 0.05, L0.z), new V3$2(L0.x + sx * 0.066, L0.y + 0.078, L0.z), new V3$2(L0.x + sx * 0.048, L0.y + 0.09, L0.z)];
      part(PB, sweep$1(new THREE.CatmullRomCurve3(tube).getSpacedPoints(16), { nk: 10, shape: circle$1(0.0065, 10), capStart: true, capEnd: true }), brass(0.5));
    }
    part(PB, lathe$2([[0.001, -0.026], [0.005, -0.022], [0.0085, -0.012], [0.0085, 0.0], [0.006, 0.012], [0.003, 0.022], [0.001, 0.03]], 16), { mx: at(0), c: [1, 0.8, 0.5], r: 0.5, t: T.GLASS, w: 1.4, dyn: lev });
    const bail = [];
    for (let k = 0; k <= 24; k++) { const f = Math.PI * (k / 24); bail.push(new V3$2(L0.x + 0.078 * Math.cos(f), L0.y + 0.07 + 0.2 * Math.sin(f), L0.z)); }
    part(PB, sweep$1(bail, { nk: 6, shape: circle$1(0.0026, 6), capStart: true, capEnd: true }), { c: C.iron, r: 0.55, mt: 0.6, t: T.METAL, w: 1.3, dyn: lev });
    const hkB = mastAt(mb + 2.5).addScaledVector(LOUT, mR - 0.02);
    const hook = [hkB, hkB.clone().addScaledVector(LOUT, 0.08), hkB.clone().addScaledVector(LOUT, 0.17).add(new V3$2(0, -4e-3, 0)), lanternHook.clone().add(new V3$2(0, -0.012, 0)), lanternHook.clone().addScaledVector(LOUT, 0.02).add(new V3$2(0, 0.03, 0))];
    part(PB, sweep$1(new THREE.CatmullRomCurve3(hook).getSpacedPoints(20), { nk: 8, shape: circle$1((q) => 0.009 - 0.003 * q, 8), capStart: true, capEnd: true }), { c: C.iron, r: 0.6, mt: 0.5, t: T.METAL, w: 1.6 });
  }
  const roller = new V3$2(0.09, 1.47, stemZ(1.47) + 0.04);
  {
    const wy = deckY(WINDLASS.z) - 0.02 + WINDLASS.h;
    for (let k = 0; k < 3; k++) RB.add(ringPts(new V3$2(0.06 * k - 0.06, wy, WINDLASS.z), new V3$2(1, 0, 0), 0.128, 18), 0.018, C.tarred);
    RB.add(new THREE.CatmullRomCurve3([new V3$2(0.08, wy + 0.12, WINDLASS.z + 0.02), new V3$2(0.09, wy + 0.2, WINDLASS.z + 0.5), roller.clone().add(new V3$2(0, 0.045, -0.05))]).getSpacedPoints(24), 0.018, C.tarred);
    for (const x of [roller.x - 0.07, roller.x + 0.07]) part(HB, box(0.03, 0.12, 0.16, 0.008), { mx: mat(x, roller.y, roller.z - 0.02), c: C.woodDark, r: 0.6, t: T.WOOD, w: 58 });
    part(HB, new THREE.CylinderGeometry(0.035, 0.035, 0.12, 14), { mx: mat(roller.x, roller.y, roller.z, 0, 0, Math.PI / 2), c: C.iron, r: 0.6, mt: 0.5, t: T.METAL, w: 1.8 });
  }
  {
    const mh = mastAt(MT - 0.72);
    for (const d of DEADEYES) {
      const up = d.p.clone().add(new V3$2(-d.side * 0.02, 0.36, 0));
      part(PB, lathe$2([[0.001, -0.028], [0.046, -0.028], [0.054, -0.012], [0.056, 0.0], [0.054, 0.012], [0.046, 0.028], [0.001, 0.028]], 18), { mx: mat(up.x, up.y, up.z, 0, 0, Math.PI / 2), c: C.woodDark, r: 0.6, t: T.WOOD, w: 59 });
      for (const k of [-0.025, 0, 0.025]) RB.add([d.p.clone().add(new V3$2(0, 0.02, k)), up.clone().add(new V3$2(0, -0.02, k))], 0.0045, C.hemp);
      RB.add(catenary(new V3$2(d.side * 0.06, mh.y, mh.z), up.clone().add(new V3$2(0, 0.03, 0)), 0.02, 30), 0.011, C.tarred);
    }
    RB.add(catenary(mastAt(MT - 0.5).add(new V3$2(0, 0, 0.05)), bsTip.clone().add(new V3$2(0, 0.03, -0.02)), 0.08, 40), 0.011, C.tarred);
    RB.add(catenary(mastAt(MT - 0.3).add(new V3$2(0, 0, -0.06)), peak.clone().add(new V3$2(0.02, 0.04, 0)), 0.1, 24), 0.009, C.hemp, { sway: 0.1 });
    RB.add(ringPts(snot.clone().add(new V3$2(0, 0, 0.1)), new V3$2(0, 1, 0), 0.13, 16), 0.009, C.hemp);
    const hl = mastAt(MT - 0.35).add(new V3$2(0.07, 0, -0.02));
    RB.add([hl, mastAt(mb + 1.15).add(new V3$2(0.12, 0, 0.0))], 0.008, C.hemp);
    RB.add(catenary(mastAt(MT - 0.9).add(new V3$2(-0.06, 0, -0.1)), mastAt(mb + 1.2).add(new V3$2(-0.14, 0, 0.02)), 0.12, 30), 0.008, C.hemp, { sway: 0.12 });
    RB.add(flake(new V3$2(0.26, 0, MAST_Z + 0.22), 0.12, 3, mb + 0.015, rng, 22, 0.01, 0.008), 0.008, C.hemp);
    for (const side of [-1, 1]) {
      const z = MIZ_Z - 0.9, r = railTop(z, side);
      RB.add(catenary(mzT.clone().add(new V3$2(side * 0.03, -0.15, 0)), r.clone().add(new V3$2(-side * 0.02, 0.02, 0)), 0.03, 20), 0.008, C.tarred);
    }
    const sq = railTop(-4.85);
    const stern = [new V3$2(0.42, deckY(-4.72, 0.42) + 0.14, -4.72), sq.clone().add(new V3$2(-0.02, 0.04, 0)), sq.clone().add(new V3$2(0.12, -0.02, -0.12)), new V3$2(sq.x + 1.3, 0.2, -6.9), new V3$2(sq.x + 1.9, -0.25, -7.8)];
    RB.add(new THREE.CatmullRomCurve3(stern).getSpacedPoints(40), 0.014, C.hemp, { swayFn: (u) => Math.max(0, u - 0.3) * 0.5 });
    part(HB, box(0.1, 0.2, 0.1, 0.02), { mx: mat(0.42, deckY(-4.72, 0.42) + 0.1, -4.72), c: C.woodDark, r: 0.6, t: T.WOOD, w: 60 });
    RB.add(flemish(new V3$2(-0.32, 0, -4.8), 0.04, 0.21, 6, deckY(-4.8, -0.32) + 0.012, 28), 0.012, C.hemp);
    RB.add(flemish(new V3$2(-0.3, 0, 4.05), 0.04, 0.2, 5, deckY(4.05, -0.3) + 0.012, 28), 0.013, C.tarred);
  }
  let LAUNDRY;
  {
    const d = DEADEYES.find((e) => e.side > 0 && e.z === CHAIN_Z[0]);
    const up = d.p.clone().add(new V3$2(-0.02, 0.36, 0)), mh = mastAt(MT - 0.72).add(new V3$2(0.06, 0, 0));
    const a = new V3$2().lerpVectors(up, mh, 0.2);
    const fsA = mastAt(MT - 0.5).add(new V3$2(0, 0, 0.05)), fsB = bsTip.clone();
    const tf = (fsA.y - (a.y + 0.2)) / (fsA.y - fsB.y);
    const b = new V3$2().lerpVectors(fsA, fsB, tf);
    LAUNDRY = { a, b };
    RB.add(catenary(a, b, 0.12, 30), 0.005, C.hemp, { sway: 0.12 });
  }
  {
    const d = DEADEYES.find((e) => e.side < 0 && e.z === CHAIN_Z[1]);
    const sh = d.p.clone().add(new V3$2(0.02, 0.36, 0)).lerp(mastAt(MT - 0.72), 0.12);
    const lines = [[mastAt(mb + 1.95).add(new V3$2(-0.08, 0, -0.06)), sh, 0.14, 6, true]];
    const bA = battenAt(AWN.z0 - 0.25), bB = battenAt(AWN.z1 + 0.35);
    lines.push([bA.clone().add(new V3$2(0, -0.03, 0)), bB.clone().add(new V3$2(0, -0.03, 0)), 0.0, 9, false]);
    for (const [a, b, sag, n, own] of lines) {
      const pts = catenary(a, b, sag, 30);
      if (own) RB.add(pts, 0.005, TWINE, { sway: sag });
      for (let k = 1; k <= n; k++) {
        const s = k / (n + 1), p = pts[Math.round(s * 30)];
        const len = 0.08 + rng() * 0.12, r = 0.035 + rng() * 0.045, fresh = rng() < 0.3;
        const c = new V3$2(p.x + (rng() - 0.5) * 0.03, p.y - len - r * 0.55, p.z);
        const w0 = own ? 4.8 * s * (1 - s) * sag : 0;
        RB.add([p, new V3$2(p.x, c.y + r * 0.45, c.z)], 0.004, TWINE, { swayFn: (u) => w0 + u * len });
        const sg = spongeGeo(rng, r, fresh);
        part(PB, sg, { mx: mat(c.x, c.y, c.z, (rng() - 0.5) * 0.8, rng() * 6.28, (rng() - 0.5) * 0.8), c: sg.attributes.color, r: 0.95, t: T.SPONGE, w: fresh ? 0 : 1, dyn: [w0 + len + r * 0.6, 0] });
      }
    }
  }

  {
    const hose = LINES.hose;
    part(PB, sweep$1(hose.coil, { nk: 10, shape: circle$1(0.024, 10) }), { c: C.rubber, r: 0.32, t: T.HOSE });
    part(PB, sweep$1(hose.run, { nk: 10, shape: circle$1(0.024, 10), capEnd: true }), { c: C.rubber, r: 0.32, t: T.HOSE });
  }

  buildDeck(HB, [
    [0, PUMP_Z, 0.42, 0.34, 0.55], [0, MAST_Z, 0.13, 0.6], [MIZ_X, MIZ_Z, 0.08, 0.5],
    [-0.62, -3.05, 0.22, 0.6], [0.62, 1.52, 0.2, 0.5], [-0.98, 0.2, 0.2, 0.5], [-0.92, -2.15, 0.2, 0.45],
    [-0.52, 2.62, 0.1, 0.5], [-0.84, 2.42, 0.1, 0.5], [0.52, 3.55, 0.2, 0.45], [0.2, 3.95, 0.2, 0.45], [-0.5, 3.62, 0.2, 0.45],
    [0, 0.85, 0.55, 0.45, 0.4], [0, 3.1, 0.33, 0.3, 0.4], [-0.4, WINDLASS.z, 0.05, 0.12, 0.4], [0.4, WINDLASS.z, 0.05, 0.12, 0.4],
    [-0.1, 3.82, 0.07, 0.07, 0.45], [0.62, -1.5, 0.3, 0.22], [0.52, -4.4, 0.21, 0.17, 0.5],
    [0.62, -2.9, 0.12, 0.25], [1.12, 2.62, 0.15, 0.35], [0.42, -4.72, 0.05, 0.05, 0.4],
  ]);

  const bmat = boatMaterial();
  const group = new THREE.Group();
  group.name = 'kalliopi';
  const hull = new THREE.Mesh(HB.build(), bmat);
  hull.castShadow = true; hull.receiveShadow = true;
  const props = new THREE.Mesh(PB.build(), bmat);
  props.castShadow = true; props.receiveShadow = true;
  const rmat = ropeMaterial();
  const ropes = new THREE.Mesh(RB.build(), rmat);
  trackResolution(ropes);
  group.add(hull, props, ropes);
  group.userData.diverSpot = { pos: DIVE.pos, out: DIVE.out, up: DIVE.up, rail: DIVE.rail, ladderTop: DIVE.ladderTop, ladderBottom: DIVE.ladderBottom, rungs: DIVE.rungs, rungStep: DIVE.rungStep };
  group.userData.tetherPoint = TETHER;
  group.userData.waterlineOutline = waterlineOutline(96, 0);
  return {
    group, material: bmat, ropeMaterial: rmat, ropes, hull, props, roller, lantern, lanternHook, laundry: LAUNDRY,
    waterline: waterline(), scale: BOAT_SCALE, pump: PUMP, dive: DIVE, tether: TETHER, tiller: TILLER,
  };
}
const LAUNDRY = [
  { w: 0.92, h: 0.74, nx: 23, ny: 19, at: 0.36, kind: 0, pegs: [2, 9, 13, 20], im: 0.8 },
  { w: 0.62, h: 0.8, nx: 16, ny: 20, at: 0.74, kind: 1, pegs: [1, 7, 14], im: 0.4 },
];
const CLOTH_FRAG_DECL = `
${GLSL_NOISE}
uniform vec3 uClSun;
uniform float uClDay;
uniform float uClLamp;
uniform vec3 uClLampW;
varying vec2 vClUv;
varying float vClKind;
varying vec3 vClW;
`;
const CLOTH_FRAG_COLOR = `
float clH = 0.0;
{
  vec2 q = vClUv;
  vec3 c;
  if (vClKind < 0.5) {
    float ax = abs(q.x - 0.5);
    float sleeveBot = 0.56 + 0.3 * clamp((ax - 0.25) / 0.25, 0.0, 1.0);
    bool body = ax < 0.25 && q.y > 0.015 + 0.02 * sin(q.x * 40.0) * 0.0;
    bool sleeve = ax < 0.5 && q.y > sleeveBot;
    if (!(body || sleeve)) discard;
    if (q.y > 0.945 && ax < 0.075) discard;
    c = vec3(${C.cotton.map(g7$1).join(', ')}) * 0.86;
    float pl = 1.0 - smoothstep(0.012, 0.018, abs(q.x - 0.5));
    c *= 1.0 - 0.1 * pl * step(q.y, 0.94);
    float bt = 1.0 - smoothstep(0.006, 0.01, length(vec2(q.x - 0.5, (fract(q.y * 7.0) - 0.5) / 7.0)));
    c = mix(c, vec3(0.3, 0.27, 0.22), bt * step(0.3, q.y) * step(q.y, 0.9));
    c *= 1.0 - 0.12 * (1.0 - smoothstep(0.0, 0.02, abs(ax - 0.25))) * step(sleeveBot, q.y);
    c *= 1.0 - 0.15 * smoothstep(0.55, 0.8, sgNoise(vec3(q * 6.0, 2.0))) * (1.0 - smoothstep(0.0, 0.3, q.y));
  } else {
    float ax = abs(q.x - 0.5);
    float gap = q.y < 0.52 ? 0.015 + 0.16 * (0.52 - q.y) : -1.0;
    if (ax < gap) discard;
    if (ax > 0.5 - 0.08 * (1.0 - q.y)) discard;
    c = vec3(${lin(0x3b4a66).map(g7$1).join(', ')}) * (0.85 + 0.25 * sgNoise(vec3(q * vec2(5.0, 9.0), 1.0)));
    c = mix(c, c * 1.35 + 0.03, smoothstep(0.55, 0.8, sgNoise(vec3(q * 3.0, 4.0))) * 0.5);
    c *= 1.0 - 0.25 * step(0.9, q.y);
    float patchM = (1.0 - smoothstep(0.07, 0.08, max(abs(q.x - 0.3), abs(q.y - 0.35) * 0.8)));
    c = mix(c, vec3(0.2, 0.17, 0.13), patchM * 0.8);
  }
  float wx = q.x * 0.9 / 0.003, wy = q.y * 0.8 / 0.003;
  float wf = 1.0 - smoothstep(0.3, 0.7, max(fwidth(wx), fwidth(wy)));
  float weave = sin(wx * 3.1416) * sin(wy * 3.1416) * wf;
  float slub = sgNoise(vec3(q.x * 90.0, q.y * 8.0, 1.0)) + sgNoise(vec3(q.x * 11.0, q.y * 70.0, 2.0));
  c *= 0.92 + 0.08 * slub + 0.05 * weave;
  diffuseColor.rgb = c;
  clH = weave * 0.0002 + (slub - 1.0) * 0.0003;
}
`;
const CLOTH_FRAG_EMIT = `
{
  vec3 nW = normalize((vec4(normal, 0.0) * viewMatrix).xyz);
  vec3 sd = normalize(uClSun);
  float back = max(0.0, -dot(nW, sd)) * uClDay * smoothstep(-0.04, 0.08, sd.y);
  totalEmissiveRadiance += diffuseColor.rgb * vec3(1.0, 0.93, 0.8) * back * (vClKind < 0.5 ? 0.5 : 0.3);
  vec3 lv = uClLampW - vClW;
  totalEmissiveRadiance += diffuseColor.rgb * vec3(1.0, 0.54, 0.18) * uClLamp * 0.5 / (1.0 + dot(lv, lv) * 3.0);
}
`;
function clothMaterial() {
  const m = new THREE.MeshStandardMaterial({ roughness: 0.93, metalness: 0, side: THREE.DoubleSide });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uClSun = SKY_UNIFORMS.uSunDir;
    shader.uniforms.uClDay = BT_U.uBtDay;
    shader.uniforms.uClLamp = BT_U.uBtLamp;
    shader.uniforms.uClLampW = BT_U.uBtLampW;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aKind;\nvarying vec2 vClUv;\nvarying float vClKind;\nvarying vec3 vClW;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvClUv = uv;\nvClKind = aKind;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvClW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n' + CLOTH_FRAG_DECL)
      .replace('#include <color_fragment>', '#include <color_fragment>\n' + CLOTH_FRAG_COLOR)
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\nnormal = sgBump(-vViewPosition, normal, clH, faceDirection);')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n' + CLOTH_FRAG_EMIT);
  };
  m.customProgramCacheKey = () => 'sg-laundry-1';
  return m;
}
class Laundry {
  constructor() {
    this.cfg = { h: 1 / 120, it: 3, tb: 0.34, kp: 1.7, kd: 0.35, drag: 1.0, g: 9.81 };
    let n = 0;
    this.pieces = LAUNDRY.map((P) => { const o = { ...P, base: n }; n += P.nx * P.ny; return o; });
    this.n = n;
    this.pos = new Float32Array(n * 3); this.prev = new Float32Array(n * 3); this.nrm = new Float32Array(n * 3);
    this.acc = new Float32Array(n * 3); this.pin = new Uint8Array(n); this.pinS = new Float32Array(n);
    this.im = new Float32Array(n);
    for (const P of this.pieces) this.im.fill(P.im || 1, P.base, P.base + P.nx * P.ny);
    const ca = [], cb = [], cr = [], ck = [], tri = [], uv = [], kind = [];
    const tA = new Int32Array(n), lA = new Float32Array(n);
    for (const P of this.pieces) {
      const id = (i, j) => P.base + j * P.nx + i;
      const dx = P.w / (P.nx - 1), dy = P.h / (P.ny - 1), dd = Math.hypot(dx, dy);
      const add = (a, b, r, k) => { ca.push(a); cb.push(b); cr.push(r); ck.push(k); };
      for (let j = 0; j < P.ny; j++) for (let i = 0; i < P.nx; i++) {
        if (i + 1 < P.nx) add(id(i, j), id(i + 1, j), dx, 1);
        if (j + 1 < P.ny) add(id(i, j), id(i, j + 1), dy, 1);
        if (i + 1 < P.nx && j + 1 < P.ny) { add(id(i, j), id(i + 1, j + 1), dd, 0.5); add(id(i + 1, j), id(i, j + 1), dd, 0.5); }
        if (i + 2 < P.nx) add(id(i, j), id(i + 2, j), 2 * dx, 0.12);
        if (j + 2 < P.ny) add(id(i, j), id(i, j + 2), 2 * dy, 0.12);
        uv.push(i / (P.nx - 1), 1 - j / (P.ny - 1));
        kind.push(P.kind);
      }
      for (const i of P.pegs) this.pin[id(i, 0)] = 1;
      for (let j = 0; j < P.ny; j++) for (let i = 0; i < P.nx; i++) {
        this.pinS[id(i, j)] = P.at + ((i / (P.nx - 1)) - 0.5) * P.w;
        let best = -1, bd = 1e9;
        for (const pi of P.pegs) { const d = Math.hypot((i - pi) * dx, j * dy); if (d < bd) { bd = d; best = id(pi, 0); } }
        tA[id(i, j)] = best; lA[id(i, j)] = bd * 1.03;
      }
      for (let j = 0; j < P.ny - 1; j++) for (let i = 0; i < P.nx - 1; i++) {
        const a = id(i, j), b = id(i + 1, j), c = id(i, j + 1), d = id(i + 1, j + 1);
        tri.push(a, c, b, b, c, d);
      }
    }
    this.ca = Int32Array.from(ca); this.cb = Int32Array.from(cb); this.cr = Float32Array.from(cr); this.ck = Float32Array.from(ck);
    this.tA = tA; this.lA = lA;
    this.tri = Uint16Array.from(tri);
    const nt = this.tri.length / 3;
    this.ph = new Float32Array(nt * 6);
    this.inv = new Float32Array(n);
    for (let q = 0; q < nt; q++) {
      const a = this.tri[q * 3], b = this.tri[q * 3 + 1], c = this.tri[q * 3 + 2];
      const u = (uv[a * 2] + uv[b * 2] + uv[c * 2]) / 3, v = (uv[a * 2 + 1] + uv[b * 2 + 1] + uv[c * 2 + 1]) / 3;
      const p0 = -2.6 * u + 1.9 * v, p1 = -2.1 * u - 2.3 * v + 1.0, p2 = -3.2 * u + 1.2 * v + 2.0;
      this.ph[q * 6] = Math.sin(p0); this.ph[q * 6 + 1] = Math.cos(p0);
      this.ph[q * 6 + 2] = Math.sin(p1); this.ph[q * 6 + 3] = Math.cos(p1);
      this.ph[q * 6 + 4] = Math.sin(p2); this.ph[q * 6 + 5] = Math.cos(p2);
      this.inv[a] += 1; this.inv[b] += 1; this.inv[c] += 1;
    }
    for (let k = 0; k < n; k++) this.inv[k] = this.inv[k] > 0 ? 1 / this.inv[k] : 0;
    const g = new THREE.BufferGeometry();
    this.pAttr = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.nAttr = new THREE.BufferAttribute(this.nrm, 3).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.pAttr);
    g.setAttribute('normal', this.nAttr);
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setAttribute('aKind', new THREE.Float32BufferAttribute(kind, 1));
    g.setIndex(new THREE.BufferAttribute(this.tri, 1));
    this.mesh = new THREE.Mesh(g, clothMaterial());
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = false;
    this.a0 = new V3$2(); this.b0 = new V3$2(); this.a1 = new V3$2(); this.b1 = new V3$2(); this.w = new V3$2();
    this.sw = new V3$2();
    this._p = new V3$2();
    this.accT = 0;
    this.ready = false;
  }
  _pinAt(k, f, out) {
    const ax = this.a0.x + (this.a1.x - this.a0.x) * f, ay = this.a0.y + (this.a1.y - this.a0.y) * f, az = this.a0.z + (this.a1.z - this.a0.z) * f;
    const bx = this.b0.x + (this.b1.x - this.b0.x) * f, by = this.b0.y + (this.b1.y - this.b0.y) * f, bz = this.b0.z + (this.b1.z - this.b0.z) * f;
    const L = Math.hypot(bx - ax, by - ay, bz - az) || 1;
    Math.min(0.98, Math.max(0.02, this.pinS[k] / L + (this.pinS[k] < 1 ? 0 : 0)));
    const su = this._frac(k, L);
    const sg = 4.8 * su * (1 - su) * 0.12;
    const x = ax + (bx - ax) * su + this.sw.x * sg, y = ay + (by - ay) * su - 0.12 * 4 * su * (1 - su) + this.sw.y * sg, z = az + (bz - az) * su + this.sw.z * sg;
    return out.set(x, y, z);
  }
  _frac(k, L) {
    for (const P of this.pieces) if (k >= P.base && k < P.base + P.nx * P.ny) return Math.min(0.98, Math.max(0.02, P.at + (this.pinS[k] - P.at) / L));
    return 0.5;
  }
  reset(a, b) {
    this.a0.copy(a); this.a1.copy(a); this.b0.copy(b); this.b1.copy(b);
    for (const P of this.pieces) {
      const dy = P.h / (P.ny - 1);
      for (let j = 0; j < P.ny; j++) for (let i = 0; i < P.nx; i++) {
        const k = P.base + j * P.nx + i;
        this._pinAt(P.base + i, 1, this._p);
        this.pos[k * 3] = this.prev[k * 3] = this._p.x;
        this.pos[k * 3 + 1] = this.prev[k * 3 + 1] = this._p.y - j * dy;
        this.pos[k * 3 + 2] = this.prev[k * 3 + 2] = this._p.z + 0.01 * j;
      }
    }
    this.ready = true;
    this._normals();
  }
  update(dt, t, a, b, wind, sway) {
    if (sway) this.sw.copy(sway);
    if (!this.ready) this.reset(a, b);
    this.a0.copy(this.a1); this.b0.copy(this.b1); this.a1.copy(a); this.b1.copy(b);
    this.w.copy(wind);
    const H = this.cfg.h;
    this.accT += Math.min(Math.max(dt, 0), 0.1);
    let steps = Math.floor(this.accT / H);
    if (steps > 12) { steps = 12; this.accT = 0; } else this.accT -= steps * H;
    for (let s = 0; s < steps; s++) this._step(t - (steps - 1 - s) * H, (s + 1) / steps);
    if (steps === 0) return;
    this._normals();
    this.pAttr.needsUpdate = true;
    this.nAttr.needsUpdate = true;
  }
  _step(t, f) {
    const C = this.cfg, P = this.pos, Q = this.prev, A = this.acc; this.nrm; const n = this.n, h = C.h;
    const W = this.w, wl = Math.sqrt(W.x * W.x + W.y * W.y + W.z * W.z);
    const gust = 1 + 0.3 * Math.sin(t * 0.37) + 0.2 * Math.sin(t * 1.1 + 1.1) + 0.1 * Math.sin(t * 2.9 + 0.3);
    A.fill(0);
    const T3 = this.tri, PH = this.ph, ih = 1 / (3 * h), tb = wl * C.tb, KP = C.kp, KD = C.kd;
    const gx = W.x * gust, gy = W.y * gust, gz = W.z * gust;
    const s0 = Math.sin(t * 5.3), c0 = Math.cos(t * 5.3), s1 = Math.sin(t * 4.1), c1 = Math.cos(t * 4.1), s2 = Math.sin(t * 6.7), c2 = Math.cos(t * 6.7);
    for (let q = 0, e = 0; q < T3.length; q += 3, e += 6) {
      const a = T3[q] * 3, b = T3[q + 1] * 3, c = T3[q + 2] * 3;
      const e1x = P[b] - P[a], e1y = P[b + 1] - P[a + 1], e1z = P[b + 2] - P[a + 2];
      const e2x = P[c] - P[a], e2y = P[c + 1] - P[a + 1], e2z = P[c + 2] - P[a + 2];
      let nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x;
      const nl = Math.sqrt(nx * nx + ny * ny + nz * nz);
      if (nl < 1e-12) continue;
      nx /= nl; ny /= nl; nz /= nl;
      const ux = gx + tb * (s0 * PH[e + 1] + c0 * PH[e]);
      const uy = gy + tb * 0.5 * (s1 * PH[e + 3] + c1 * PH[e + 2]);
      const uz = gz + tb * (s2 * PH[e + 5] + c2 * PH[e + 4]);
      const rx = ux - (P[a] - Q[a] + P[b] - Q[b] + P[c] - Q[c]) * ih;
      const ry = uy - (P[a + 1] - Q[a + 1] + P[b + 1] - Q[b + 1] + P[c + 1] - Q[c + 1]) * ih;
      const rz = uz - (P[a + 2] - Q[a + 2] + P[b + 2] - Q[b + 2] + P[c + 2] - Q[c + 2]) * ih;
      const vn = nx * rx + ny * ry + nz * rz;
      const s = KP * vn * (vn < 0 ? -vn : vn);
      const fx = s * nx + KD * (rx - vn * nx), fy = s * ny + KD * (ry - vn * ny), fz = s * nz + KD * (rz - vn * nz);
      A[a] += fx; A[a + 1] += fy; A[a + 2] += fz;
      A[b] += fx; A[b + 1] += fy; A[b + 2] += fz;
      A[c] += fx; A[c + 1] += fy; A[c + 2] += fz;
    }
    const INV = this.inv, keepV = Math.exp(-C.drag * h), h2 = h * h, PIN = this.pin, G = C.g;
    for (let k = 0, i = 0; k < n; k++, i += 3) {
      if (PIN[k]) {
        this._pinAt(k, f, this._p);
        Q[i] = P[i]; Q[i + 1] = P[i + 1]; Q[i + 2] = P[i + 2];
        P[i] = this._p.x; P[i + 1] = this._p.y; P[i + 2] = this._p.z;
        continue;
      }
      const w = INV[k] * this.im[k];
      const x = P[i], y = P[i + 1], z = P[i + 2];
      P[i] = x + (x - Q[i]) * keepV + A[i] * w * h2;
      P[i + 1] = y + (y - Q[i + 1]) * keepV + (A[i + 1] * w - G) * h2;
      P[i + 2] = z + (z - Q[i + 2]) * keepV + A[i + 2] * w * h2;
      Q[i] = x; Q[i + 1] = y; Q[i + 2] = z;
    }
    const CA = this.ca, CB = this.cb, CR = this.cr, CK = this.ck, m = CA.length;
    for (let it = 0; it < C.it; it++) {
      for (let q = 0; q < m; q++) {
        const ia = CA[q], ib = CB[q], a = ia * 3, b = ib * 3;
        const dx = P[b] - P[a], dy = P[b + 1] - P[a + 1], dz = P[b + 2] - P[a + 2];
        const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (len < 1e-9) continue;
        const pa = PIN[ia], pb = PIN[ib];
        if (pa && pb) continue;
        const corr = ((len - CR[q]) / len) * CK[q] * (pa || pb ? 1 : 0.5);
        const cx = dx * corr, cy = dy * corr, cz = dz * corr;
        if (!pa) { P[a] += cx; P[a + 1] += cy; P[a + 2] += cz; }
        if (!pb) { P[b] -= cx; P[b + 1] -= cy; P[b + 2] -= cz; }
      }
    }
    const TA = this.tA, LA = this.lA;
    for (let k = 0, i = 0; k < n; k++, i += 3) {
      if (PIN[k]) continue;
      const a = TA[k] * 3, dx = P[i] - P[a], dy = P[i + 1] - P[a + 1], dz = P[i + 2] - P[a + 2], d2 = dx * dx + dy * dy + dz * dz, L = LA[k];
      if (d2 > L * L) { const r = L / Math.sqrt(d2); P[i] = P[a] + dx * r; P[i + 1] = P[a + 1] + dy * r; P[i + 2] = P[a + 2] + dz * r; }
    }
  }
  _normals() {
    const P = this.pos, N = this.nrm, T3 = this.tri;
    N.fill(0);
    for (let q = 0; q < T3.length; q += 3) {
      const a = T3[q] * 3, b = T3[q + 1] * 3, c = T3[q + 2] * 3;
      const e1x = P[b] - P[a], e1y = P[b + 1] - P[a + 1], e1z = P[b + 2] - P[a + 2];
      const e2x = P[c] - P[a], e2y = P[c + 1] - P[a + 1], e2z = P[c + 2] - P[a + 2];
      const nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x;
      N[a] += nx; N[a + 1] += ny; N[a + 2] += nz;
      N[b] += nx; N[b + 1] += ny; N[b + 2] += nz;
      N[c] += nx; N[c + 1] += ny; N[c + 2] += nz;
    }
    for (let k = 0; k < this.n * 3; k += 3) {
      const l = Math.sqrt(N[k] * N[k] + N[k + 1] * N[k + 1] + N[k + 2] * N[k + 2]) || 1;
      N[k] /= l; N[k + 1] /= l; N[k + 2] /= l;
    }
  }
}
const SPRAY_SLOTS = 16;
const SHEET_U = 32, SHEET_S = 8, CROWN_U = 20, CROWN_S = 8, SP_DROPS = 360, SP_MIST = 48, DRIPS = 8, DRIP_K = 6;
const SP_FILM = SHEET_U * SHEET_S, SP_CROWN = SP_FILM + CROWN_U * CROWN_S, SP_DROP = SP_CROWN + SP_DROPS;
const SPRAY_PER = SP_DROP + SP_MIST;
const SPRAY_LIFE = 3.3;
const SP_NA = 25, SP_A = 1.2, SP_NY = 11, SP_Y0 = -0.3, SP_DY = 0.15;
const SP_HEAP = 0.07;
const SPRAY_RISE_GLSL = `
float spRh(float x) { return fract(sin(x * 91.3458) * 47453.5453); }
float spRn(float x) { float i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f); return mix(spRh(i), spRh(i + 1.0), f); }
float spTongue(float a, vec4 C) {
  float p = C.w * 6.2831853, k = 15.0 + 7.0 * fract(C.w * 7.13);
  return 1.0 + 0.14 * sin(a * k + p) + 0.06 * sin(a * k * 1.45 - 2.7 * p);
}
float spTongueK(float a, float t, vec4 B, vec4 C) {
  float tg = spTongue(a, C);
  if (B.w < 0.5) return tg;
  float p = C.w * 53.7;
  return tg * (1.0 + 0.5 * (spRn(a * 11.0 + p + 3.0 * t) + 0.6 * spRn(a * 23.0 - p - 5.0 * t) - 0.8));
}
float spRise(float t, vec4 B) {
  float E = B.z, ta = E / 9.81;
  float h = (B.w > 0.5 ? 0.6 : 0.9) * E * E / 19.62;
  h = ${g7$1(SP_HEAP)} * tanh(h / ${g7$1(SP_HEAP)});
  float tr = 0.45 * ta + 0.03;
  return h * smoothstep(0.0, tr, t) * exp(-max(t - tr, 0.0) / (0.12 + 0.06 * (1.0 - B.w)));
}
float spRiseAt(float t, vec4 B, vec4 C, float a) {
  float W = C.x * (1.0 + 0.3 * t);
  return spRise(t, B) * exp(-a * a / (W * W)) * spTongueK(a, t, B, C);
}
bool spAt(int i, float s, float sd, out float t, out float a, out float W) {
  vec4 D = uSpD[i];
  t = uTime - uSpA[i].w;
  a = s - D.z;
  W = uSpC[i].x * (1.0 + 0.3 * t);
  if (t < 0.0 || t > 3.0 || uSpB[i].z <= 0.0) return false;
  if (sd * D.w < 0.0) a = s + D.z > uSkLen ? 2.0 * uSkLen - s - D.z : -(s + D.z);
  return abs(a) < 3.0 * W;
}
float spRiseSum(float s, float sd) {
  float R = 0.0, t, a, W;
  for (int i = 0; i < ${SPRAY_SLOTS}; i++) if (spAt(i, s, sd, t, a, W)) R += spRiseAt(t, uSpB[i], uSpC[i], a);
  return R;
}
`;
const SPRAY_RUN_GLSL = `
float spH(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float spN(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(spH(i), spH(i + vec2(1.0, 0.0)), f.x), mix(spH(i + vec2(0.0, 1.0)), spH(i + vec2(1.0, 1.0)), f.x), f.y);
}
float spRunK(float ph) { return 30.0 + 18.0 * fract(ph * 0.1731); }
vec2 spRunF(float a, float Y, float hb, float tr, float ph, float fo, float fm) {
  float k = spRunK(ph);
  a += 0.02 * (spN(vec2(Y * 9.0 + ph, a * 6.0)) - 0.5) + 0.008 * fo * (spN(vec2(Y * 26.0 - ph, a * 17.0 + 2.3)) - 0.5);
  float n1 = spN(vec2(a * k + ph, Y * 3.2 - 0.3 * ph)), n2 = mix(0.5, spN(vec2(a * k * 2.3 - ph, Y * 6.0 + 1.7)), fo);
  float rv = n1 + 0.35 * (n2 - 0.5) * smoothstep(0.2, 0.6, n1);
  rv = mix(0.5, rv, fm);
  float thr = tr * mix(-0.2, 0.62, smoothstep(0.0, 0.85, hb));
  return vec2(smoothstep(thr - 0.04, thr + 0.22, rv), clamp((rv - thr) * 1.6, 0.0, 1.0));
}
vec2 spRun(float a, float Y, float hb, float tr, float ph) { return spRunF(a, Y, hb, tr, ph, 1.0, 1.0); }
`;
const SPRAY_VARY = `
varying vec2 vQ;
varying float vLen;
varying float vA;
varying float vRole;
varying float vCover;
varying vec3 vPos;
varying vec3 vN;
varying float vAer;
varying vec2 vHl;
varying vec2 vUp;
varying float vPh;
varying float vKey;
varying float vLit;
varying float vTear;
varying vec4 vLd;
`;
const SPRAY_VERT$1 = `
${SPRAY_VARY}
uniform float uTime;
uniform vec4 uSpA[${SPRAY_SLOTS}];
uniform vec4 uSpB[${SPRAY_SLOTS}];
uniform vec4 uSpC[${SPRAY_SLOTS}];
uniform vec4 uSpD[${SPRAY_SLOTS}];
uniform float uSkLen;
uniform float uSlot0;
uniform sampler2D uSpT;
uniform vec4 uDripA[${DRIPS}];
uniform vec4 uDripB[${DRIPS}];
uniform mat4 uBoatM;
uniform vec3 uGrav;
uniform vec3 uWindB;
uniform float uResY;
uniform float uAspect;
uniform vec3 uKeyDir;
uniform vec3 uSkSunSea;
uniform float uEclipse;
attribute vec2 aCorner;
attribute vec4 aSeed;
attribute vec2 aIdx;
${WAVES_GLSL}
${SPRAY_RISE_GLSL}
${SPRAY_RUN_GLSL}
float spSea(vec2 p, float t) {
  float fade = exp(-length(p - cameraPosition.xz) / 240.0);
  vec2 d = vec2(0.0);
  for (int i = 0; i < NWAVES; i++) {
    float ph = W_K[i] * dot(W_DIR[i], p) - W_W[i] * t + W_P[i];
    d += W_Q[i] * W_A[i] * W_DIR[i] * cos(ph);
  }
  return waveHeightAt(p - d * fade, t) * fade;
}
float spSunUp() { return smoothstep(0.04, 0.2, dot(uSkSunSea, vec3(0.2126, 0.7152, 0.0722))) * (1.0 - smoothstep(0.8, 1.0, uEclipse)); }
float spHash(float x) { return fract(sin(x * 12.9898) * 43758.5453); }
float spNoise1(float x) { float i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f); return mix(spHash(i), spHash(i + 1.0), f); }
vec4 spHullP(float e, float a, float Y, out vec3 N) {
  float fi = clamp((a + ${g7$1(SP_A)}) / ${g7$1((2 * SP_A) / (SP_NA - 1))}, 0.0, ${SP_NA - 1}.0);
  float fj = (Y - ${g7$1(SP_Y0)}) / ${g7$1(SP_DY)};
  float i0 = min(floor(fi), ${SP_NA - 2}.0), j0 = clamp(floor(fj), 0.0, ${SP_NY - 2}.0);
  float ti = fi - i0, tj = fj - j0;
  int i = int(i0), r = int(e + 0.5) * ${SP_NY * 2} + int(j0);
  vec4 p = mix(mix(texelFetch(uSpT, ivec2(i, r), 0), texelFetch(uSpT, ivec2(i + 1, r), 0), ti),
               mix(texelFetch(uSpT, ivec2(i, r + 1), 0), texelFetch(uSpT, ivec2(i + 1, r + 1), 0), ti), tj);
  r += ${SP_NY};
  vec4 n = mix(mix(texelFetch(uSpT, ivec2(i, r), 0), texelFetch(uSpT, ivec2(i + 1, r), 0), ti),
               mix(texelFetch(uSpT, ivec2(i, r + 1), 0), texelFetch(uSpT, ivec2(i + 1, r + 1), 0), ti), tj);
  N = normalize(n.xyz);
  p.w = clamp(p.w, 0.0, 1.0);
  return p;
}
vec3 spFilm(float u, float s, float t, vec4 A, vec4 B, vec4 C, vec4 D, float useR, out vec3 N, out vec3 f) {
  float E = B.z;
  float uc = u * 2.0 - 1.0;
  float prof = sqrt(max(1.0 - uc * uc, 0.0));
  float a = uc * C.x * (1.0 + 0.5 * t);
  float V = E * (0.3 + 0.7 * prof) * pow(spTongue(a, C), 0.35) * (0.92 + 0.16 * spNoise1(uc * 2.0 - C.w * 23.0));
  float ta = V / 9.81;
  float lip = t < ta ? V * t - 4.905 * t * t : V * V / 19.62 - 2.2 * (t - ta) * (t - ta);
  vec3 ww = (uBoatM * vec4(spHullP(D.y, a, 0.0, N).xyz, 1.0)).xyz;
  float lvl = clamp(spSea(ww.xz, uTime) - ww.y, -0.6, 0.6), R = useR > 0.5 ? spRiseSum(D.z + a, D.w) : 0.0;
  R *= 0.9;
  vec3 pf = spHullP(D.y, a, lvl + R, N).xyz;
  ww = (uBoatM * vec4(pf, 1.0)).xyz;
  lvl = clamp(spSea(ww.xz, uTime) - (uBoatM * vec4(pf.x, 0.0, pf.z, 1.0)).y, -0.6, 0.6);
  float foot = lvl + R;
  float top = lvl + max(0.2 * (D.x - lvl), 0.0) + lip;
  float band = top - foot;
  top = max(top, foot);
  float Y = s <= 1.0 ? mix(top, foot, s) : foot - 0.5 * (s - 1.0);
  vec4 p = spHullP(D.y, a, Y, N);
  float th = mix(0.002, 0.01 + 0.012 * E, min(s * s, 1.0)) * (1.0 - 0.5 * smoothstep(ta, ta + 0.5, t));
  float curl = 0.02 * smoothstep(1.9, 2.6, E) * smoothstep(0.5 * ta, ta, t) * (1.0 - smoothstep(0.0, 0.1, s));
  f = vec3(p.w * (B.w < 0.5 ? smoothstep(0.002, 0.01, band) : smoothstep(0.008, 0.035, band)), th, max(band, 0.0));
  return p.xyz + N * (0.004 + th + curl);
}
float spTear(float kind, float E, float apex, float t) {
  return (kind > 0.5 ? mix(0.6, 1.0, smoothstep(1.4, 2.4, E)) : 0.45) * smoothstep(0.15 * apex, apex + 0.1, t);
}
vec2 spThrowWin(float apex) { return vec2(0.12 * apex + 0.02, 0.85 * apex + 0.02); }
vec3 spThrow(float u, float tl, vec4 A, vec4 B, vec4 C, vec4 D, out vec3 v, out vec3 N) {
  vec3 f;
  vec3 p = spFilm(u, 0.0, tl, A, B, C, D, 0.0, N, f);
  float E = B.z, ta = E / 9.81, uc = u * 2.0 - 1.0;
  vec3 up = vec3(0.0, 1.0, 0.0);
  vec3 upT = normalize(up - N * N.y);
  vec3 tg = normalize(cross(up, N) + vec3(1e-4, 0.0, 0.0));
  float Vj = 1.664 * pow(E, 0.55) * (1.3 + 0.9 * C.y) * (1.0 - 0.4 * clamp(tl / ta, 0.0, 1.0));
  Vj *= (0.6 + 0.4 * sqrt(max(1.0 - uc * uc, 0.0))) * (0.9 + 0.2 * spNoise1(uc * 3.0 + C.w * 17.0));
  float ob = 0.2 + 0.5 * C.y + 0.45 * (1.0 - smoothstep(1.5, 2.6, E));
  v = normalize(upT + up * 0.55 + N * ob + tg * 0.7 * uc) * Vj;
  return p;
}
float spCrownTear(float E) { return mix(0.06, 0.1, smoothstep(1.6, 2.8, E)); }
float spFh(float i, float w, float k) { return fract(sin(i * 17.13 + w * 311.7 + k * 5.37) * 43758.5453); }
vec4 spFinger(float w, float u1, float u2, float u3) {
  float nf = 3.0 + floor(3.0 * fract(w * 7.77 + 0.31)), tot = 0.0;
  for (int i = 0; i < 8; i++) { float h = spFh(float(i), w, 0.0); tot += float(i) < nf ? 0.12 + 2.9 * h * h * h : 0.0; }
  float pick = u1 * tot, acc = 0.0, fi = 0.0;
  for (int i = 0; i < 8; i++) {
    if (float(i) >= nf) break;
    float h = spFh(float(i), w, 0.0);
    acc += 0.12 + 2.9 * h * h * h;
    fi = float(i);
    if (pick <= acc) break;
  }
  float hs = spFh(fi, w, 0.0);
  float c = 0.07 + 0.86 * spFh(fi, w, 1.0), wd = 0.02 + 0.05 * spFh(fi, w, 2.0) + 0.1 * hs * hs;
  float g = u2 + fract(u2 * 3.7 + u3 * 1.3) - 1.0;
  return vec4(clamp(c + wd * g, 0.02, 0.98), clamp(0.8 * spFh(fi, w, 3.0) + 0.3 * (u3 - 0.5), 0.0, 1.0),
              0.75 + 0.5 * spFh(fi, w, 4.0), 2.0 * spFh(fi, w, 5.0) - 1.0);
}
float spSigma(float E, float W) { return 1.5 * max(E * E / 9.61, 0.65 * smoothstep(0.9, 1.4, E)) * (W / 0.6); }
void spQuad(vec3 wp, vec3 vel, float rad, float expo, float a, float minPx) {
  vec3 tail = wp - vel * expo;
  vec4 ch = projectionMatrix * (viewMatrix * vec4(wp, 1.0));
  vec4 ct = projectionMatrix * (viewMatrix * vec4(tail, 1.0));
  if (ch.w < 0.2 || ct.w < 0.2 || a < 0.002) return;
  vec2 asp = vec2(uAspect, 1.0);
  vec2 hN = ch.xy / ch.w * asp, tN = ct.xy / ct.w * asp;
  vec2 dd = hN - tN;
  float L = length(dd);
  vec2 dir = L > 1e-6 ? dd / L : vec2(0.0, 1.0);
  vec2 perp = vec2(dir.y, -dir.x);
  float rN = rad * projectionMatrix[1][1] / ch.w;
  float rD = max(rN, minPx / uResY);
  vCover = clamp(rN / rD, 0.0, 1.0);
  vN = vec3(rD * uResY * 0.5, 0.0, 0.0);
  float along = aCorner.y;
  vec2 base = mix(tN, hN, along) + dir * (along * 2.0 - 1.0) * rD + perp * aCorner.x * rD;
  float ww = mix(ct.w, ch.w, along);
  gl_Position = vec4(base / asp * ww, mix(ct.z / ct.w, ch.z / ch.w, along) * ww, ww);
  vQ = vec2(aCorner.x, mix(-1.0, L / rD + 1.0, along));
  vLen = L / rD;
  vA = a;
  vPos = wp;
  vec4 cl = projectionMatrix * (viewMatrix * vec4(wp + normalize(uKeyDir) * 0.25, 1.0));
  vec2 ld = cl.w > 0.01 ? cl.xy / cl.w * asp - hN : vec2(0.0, 1.0);
  ld = dot(ld, ld) > 1e-12 ? normalize(ld) : vec2(0.0, 1.0);
  vHl = vec2(dot(ld, perp), dot(ld, dir));
  vUp = vec2(perp.y, dir.y);
}
void spClump(vec3 c, vec3 vel, float hl, float hw, float expo, float sig, float a, vec2 sea) {
  float sp = length(vel);
  vec3 dir = sp > 1e-4 ? vel / sp : vec3(0.0, 1.0, 0.0);
  float hle = hl + 0.5 * sp * expo;
  vec4 ch = projectionMatrix * (viewMatrix * vec4(c + dir * hle, 1.0));
  vec4 ct = projectionMatrix * (viewMatrix * vec4(c - dir * hle, 1.0));
  if (ch.w < 0.2 || ct.w < 0.2 || a < 0.002) return;
  vUp = vec2(c.y - dir.y * hle - sea.x, c.y + dir.y * hle - sea.y);
  vec2 asp = vec2(uAspect, 1.0);
  vec2 hN = ch.xy / ch.w * asp, tN = ct.xy / ct.w * asp;
  vec2 dd = hN - tN;
  float L = length(dd);
  vec2 dirS = L > 1e-6 ? dd / L : vec2(0.0, 1.0);
  vec2 perp = vec2(dirS.y, -dirS.x);
  vHl = vec2(perp.y, 1.0 - smoothstep(-2.5, -0.5, vel.y));
  vec4 cl = projectionMatrix * (viewMatrix * vec4(c + normalize(uKeyDir) * 0.25, 1.0));
  vec2 cm = 0.5 * (hN + tN), ld = cl.w > 0.01 ? cl.xy / cl.w * asp - cm : vec2(0.0, 1.0);
  ld = dot(ld, ld) > 1e-12 ? normalize(ld) : vec2(0.0, 1.0);
  vLd = vec4(dot(ld, perp), dot(ld, dirS), perp.y, dirS.y);
  float wc = 0.5 * (ch.w + ct.w), P = projectionMatrix[1][1] / wc;
  float rN = hw * P, rD = max(rN, 1.5 / uResY);
  float along = aCorner.y;
  vec2 base = mix(tN, hN, along) + dirS * (along * 2.0 - 1.0) * rD + perp * aCorner.x * rD;
  float ww = mix(ct.w, ch.w, along);
  gl_Position = vec4(base / asp * ww, mix(ct.z / ct.w, ch.z / ch.w, along) * ww, ww);
  vQ = vec2(aCorner.x, mix(-1.0, L / rD + 1.0, along));
  vLen = L / rD;
  float rw = rD / P, hp = max(0.5 * L / P, rw);
  vA = a * sig / (3.1416 * rw * hp);
  vN = vec3(rD * uResY * 0.5, rw, sp * expo / (2.0 * hle));
  vPos = c;
  vRole = 2.0;
}
void spRing(vec3 c, float age, float life, float size, float amp) {
  float u = age / life;
  if (u < 0.0 || u > 1.0 || amp < 0.002) return;
  float R = size * (0.3 + 1.3 * sqrt(u));
  vec3 wp = vec3(c.x + aCorner.x * R, c.y + 0.015, c.z + (aCorner.y * 2.0 - 1.0) * R);
  gl_Position = projectionMatrix * (viewMatrix * vec4(wp, 1.0));
  vQ = vec2(aCorner.x, aCorner.y * 2.0 - 1.0);
  vA = amp * (1.0 - u) * (1.0 - u) * smoothstep(0.0, 0.06, u);
  vCover = clamp(R * projectionMatrix[1][1] / max(gl_Position.w, 1e-3) * uResY * 0.25, 0.0, 1.0);
  vRole = 4.0;
  vPos = wp;
}
vec3 spBal(vec3 p0, vec3 v0, vec3 vt, float k, float a) { return p0 + vt * a + (v0 - vt) * (1.0 - exp(-k * a)) / k; }
vec3 spAt(vec3 p0, vec3 v0, vec3 vt, float k, float a) { return (uBoatM * vec4(spBal(p0, v0, vt, k, a), 1.0)).xyz; }
float spLand(vec3 p0, vec3 v0, vec3 vt, float k, float age) {
  float lo = -1.0, hi = -1.0, prev = 0.0;
  bool up = false;
  for (int i = 1; i <= 8; i++) {
    float a = age * float(i) / 8.0;
    vec3 w = spAt(p0, v0, vt, k, a);
    bool u = w.y > spSea(w.xz, uTime - age + a);
    if (up && !u) { lo = prev; hi = a; break; }
    if (u) up = true;
    prev = a;
  }
  if (hi < 0.0) return -1.0;
  for (int j = 0; j < 5; j++) {
    float m = 0.5 * (lo + hi);
    vec3 w = spAt(p0, v0, vt, k, m);
    if (w.y > spSea(w.xz, uTime - age + m)) lo = m; else hi = m;
  }
  return 0.5 * (lo + hi);
}
void main() {
  gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
  vA = 0.0; vLen = 0.0; vCover = 1.0; vAer = 0.0; vHl = vec2(0.0, 1.0); vUp = vec2(0.0, 1.0);
  vQ = vec2(0.0); vN = vec3(0.0, 1.0, 0.0); vPos = vec3(0.0); vRole = 0.0; vPh = 0.0; vKey = 1.0; vLit = 1.0; vTear = 0.0; vLd = vec4(0.0, 1.0, 0.0, 1.0);
  int si = int(aIdx.x + 0.5);
  if (si < ${SPRAY_SLOTS}) si = int(mod(float(si) + uSlot0, ${SPRAY_SLOTS}.0) + 0.5);
  float part = aIdx.y;
  float r1 = aSeed.x, r2 = aSeed.y, r3 = aSeed.z, r4 = aSeed.w;
  vec3 up = vec3(0.0, 1.0, 0.0);
  vPh = r1 * 31.7 + r3 * 17.3 + float(si) * 3.1;
  if (si >= ${SPRAY_SLOTS}) {
    int di = si - ${SPRAY_SLOTS};
    vec4 D = uDripA[di], E = uDripB[di];
    if (D.w <= 0.0 || E.x < 0.02) return;
    float per = D.w * ${DRIP_K}.0 * (0.7 + 0.6 * r1);
    float cyc = uTime / per + r2;
    float age = fract(cyc) * per;
    float jit = fract(sin(floor(cyc) * 12.9898 + part * 7.13 + float(di) * 3.7) * 43758.5453);
    if (jit > E.x) return;
    float hang = 0.2 + 0.35 * r3;
    float rad = 0.0022 + 0.0022 * r4;
    vec3 p0 = D.xyz + vec3((r1 - 0.5) * 0.03, 0.0, (r2 - 0.5) * 0.03);
    vRole = 1.0;
    if (age < hang) {
      vec4 w = uBoatM * vec4(p0 - vec3(0.0, rad * smoothstep(0.0, hang, age), 0.0), 1.0);
      spQuad(w.xyz, vec3(0.0), rad * (0.4 + 0.6 * smoothstep(0.0, hang, age)), 0.0, 0.85, 1.0);
      return;
    }
    float a = age - hang;
    vec4 w0 = uBoatM * vec4(p0, 1.0);
    vec3 g = mat3(uBoatM) * uGrav;
    vec3 wp = w0.xyz + 0.5 * g * a * a;
    float sea = spSea(wp.xz, uTime);
    if (wp.y > sea) { spQuad(wp, g * a, rad, 0.011, 0.9, 1.1); return; }
    float aL = sqrt(max(2.0 * (w0.y - sea) / 9.81, 0.0));
    vec3 land = w0.xyz + 0.5 * g * aL * aL;
    spRing(vec3(land.x, sea, land.z), a - aL, 0.85, 0.045 + 0.03 * r4, 0.7 * E.x);
    return;
  }
  vec4 A = uSpA[si], B = uSpB[si], Cc = uSpC[si], D = uSpD[si];
  float t = uTime - A.w, E = B.z, kind = B.w;
  if (t < 0.0 || E <= 0.0) return;
  float role = part < ${SP_FILM}.0 ? 0.0 : (part < ${SP_CROWN}.0 ? 3.0 : (part < ${SP_DROP}.0 ? 2.0 : 5.0));
  vRole = role;
  float apex = E / 9.81;
  vec3 n = vec3(B.x, 0.0, B.y);
  vLit = max(dot(normalize(mat3(uBoatM) * n), normalize(uKeyDir)), 0.0);
  vKey = smoothstep(0.0, 0.6, vLit);
  if (role < 0.5) {
    if (t > 2.5 * apex + 0.6) return;
    float ci = mod(part, ${SHEET_U}.0), cj = floor(part / ${SHEET_U}.0);
    float u = (ci + aCorner.x * 0.5 + 0.5) / ${SHEET_U}.0;
    float j = cj + aCorner.y;
    float s = j < ${SHEET_S - 1}.5 ? pow(j / ${SHEET_S - 1}.0, 1.4) : 1.25;
    vPh = Cc.w * 37.0 + float(si) * 3.1;
    vec3 N, f;
    vec3 pl = spFilm(u, s, t, A, B, Cc, D, 1.0, N, f);
    vec4 w = uBoatM * vec4(pl, 1.0);
    vA = smoothstep(0.0, 0.04, t) * f.x * (1.0 - smoothstep(0.8, 1.0, s));
    vAer = smoothstep(1.9, 2.6, E) * smoothstep(0.6 * apex, apex, t) * (1.0 - smoothstep(apex, apex + 0.25, t));
    vCover = smoothstep(1.1, 2.4, E) * (kind > 0.5 ? 1.0 : 0.5) * smoothstep(0.03, 0.08, t) * (1.0 - smoothstep(0.45 * apex, 0.9 * apex + 0.03, t));
    vTear = spTear(kind, E, apex, t);
    vN = normalize(mat3(uBoatM) * N);
    vPos = w.xyz;
    vQ = vec2(u, s);
    vHl = vec2((u * 2.0 - 1.0) * Cc.x * (1.0 + 0.5 * t), pl.y);
    vUp = f.yz;
    vLen = 0.3 * max(t - apex, 0.0);
    vec3 toE = cameraPosition - w.xyz;
    gl_Position = projectionMatrix * (viewMatrix * vec4(w.xyz + toE * (0.03 / max(length(toE), 0.1)), 1.0));
    return;
  }
  vec2 tw = spThrowWin(apex);
  if (role > 2.5 && role < 3.5) {
    float tear = spCrownTear(E);
    if (E < (kind > 0.5 ? 0.7 : 1.5) || t < tw.x + 0.004 || t > tw.y + tear + 0.05) return;
    float pc = part - ${SP_FILM}.0;
    float ci = mod(pc, ${CROWN_U}.0), cj = floor(pc / ${CROWN_U}.0);
    float u = (ci + aCorner.x * 0.5 + 0.5) / ${CROWN_U}.0;
    float j = (cj + aCorner.y) / ${CROWN_S}.0;
    float tl = min(mix(tw.x, tw.y, pow(j, 1.35)), t), age = t - tl;
    vec3 v, N;
    vec3 p0 = spThrow(u, tl, A, B, Cc, D, v, N);
    vec3 vt = uGrav + uWindB * 0.25;
    vec3 wp = spAt(p0, v, vt, 1.0, age);
    vec3 vl = vt + (v - vt) * exp(-age);
    vec3 tg = normalize(cross(up, N) + vec3(1e-4, 0.0, 0.0));
    vN = normalize(mat3(uBoatM) * cross(tg, normalize(vl + 1e-4 * up)));
    float uc = u * 2.0 - 1.0;
    vA = (1.0 - smoothstep(0.55, 1.0, abs(uc))) * smoothstep(-0.01, 0.015, wp.y - spSea(wp.xz, uTime)) * smoothstep(0.0, 0.03, t - tw.x);
    vTear = smoothstep(0.012, tear * mix(1.0, 0.45, smoothstep(2.3, 2.9, E)), age);
    vAer = smoothstep(1.5, 2.6, E) * (1.0 - smoothstep(0.0, 0.6, j));
    vUp = vec2(smoothstep(0.9, 2.4, E) * (kind > 0.5 ? 1.0 : 0.35), 0.0);
    vQ = vec2(u, j);
    vHl = vec2(uc * Cc.x * (1.0 + 0.5 * tl), age);
    vPos = wp;
    gl_Position = projectionMatrix * (viewMatrix * vec4(wp, 1.0));
    return;
  }
  vec4 rs = fract(sin(aSeed * vec4(12.9898, 78.233, 37.719, 94.673) + Cc.w * vec4(71.3, 19.1, 53.7, 33.9)) * 43758.5453);
  r1 = rs.x; r2 = rs.y; r3 = rs.z; r4 = rs.w;
  if (role > 4.5) {
    float mk = kind > 0.5 ? smoothstep(1.3, 2.6, E) : 0.0;
    if (r2 >= mk) return;
    float tb = mix(tw.x, tw.y, 0.7 * r1), life = 1.0 + 1.0 * r4, age = t - tb;
    if (age < 0.0 || age > life) return;
    vec3 v, N;
    vec3 p0 = spThrow(0.08 + 0.84 * r3, tb, A, B, Cc, D, v, N);
    v *= 0.5 + 0.4 * fract(r1 * 7.31 + r3 * 3.17);
    vec3 vt = uWindB * 0.5 + normalize(uGrav) * 0.04;
    vec3 wp = spAt(p0, v, vt, 7.0, age);
    vec3 vl = vt + (v - vt) * exp(-7.0 * age);
    float sz = 0.03 + 0.2 * sqrt(age) * (0.7 + 0.6 * r2 / mk);
    spQuad(wp, mat3(uBoatM) * vl, sz, 0.1, smoothstep(0.0, 0.1, age) * (1.0 - smoothstep(0.4 * life, life, age)) * 0.05 / (1.0 + 6.0 * age), 1.0);
    vRole = 5.0;
    return;
  }
  vPh = r1 * 31.7 + r3 * 17.3 + Cc.w * 57.1;
  float keep = kind > 0.5 ? mix(0.8, 1.0, smoothstep(1.0, 2.4, E)) : mix(0.4, 0.9, smoothstep(0.7, 1.8, E));
  if (r2 >= keep) return;
  float q2 = r2 / keep, q5 = fract(r1 * 7.31 + r3 * 3.17), q6 = fract(r4 * 5.77 + r1 * 1.93), q7 = fract(r3 * 3.71 + r2 * 9.13);
  float rad = 0.0005 + 0.0055 * pow(r4, mix(2.4, 1.2, smoothstep(1.4, 2.8, E)));
  float k = 9.81 / (9.5 * (1.0 - exp(-rad / 0.0012)));
  float life = 1.6, ringLife = 0.8 + 0.3 * r4;
  vec3 p0, v0;
  float age;
  if (q7 < 0.85 && E >= 0.7) {
    vec4 fg = spFinger(Cc.w, r3, q5, r1);
    float tb = mix(tw.x, tw.y, pow(fg.y, 1.5)), at = spCrownTear(E) * (0.35 + 0.75 * q5);
    age = t - tb - at;
    if (age < 0.0 || age > life + ringLife) return;
    vec3 v, N;
    vec3 pl = spThrow(fg.x, tb, A, B, Cc, D, v, N);
    vec3 tg = normalize(cross(up, N) + vec3(1e-4, 0.0, 0.0));
    v = (v + tg * length(v) * 0.3 * fg.w + N * length(v) * 0.3 * (fract(fg.z * 13.7 + fg.x * 7.1) - 0.5)) * fg.z;
    vec3 vs = uGrav + uWindB * 0.25;
    p0 = spBal(pl, v, vs, 1.0, at);
    v0 = vs + (v - vs) * exp(-at);
    float e = length(v0);
    v0 = v0 * (0.9 + 0.2 * q2) + N * e * 0.2 * (q6 - 0.3) + tg * e * 0.2 * (q5 - 0.5);
  } else {
    float e = E / 4.0, tb = apex * (0.3 + 0.9 * r1), ub = 0.06 + 0.88 * r3, sb = 0.01 * q2;
    age = t - tb;
    if (age < 0.0 || age > life + ringLife) return;
    vec3 Nd, fd;
    p0 = spFilm(ub, sb, tb, A, B, Cc, D, 1.0, Nd, fd);
    float ab = (ub * 2.0 - 1.0) * Cc.x * (1.0 + 0.5 * tb);
    if (fd.x < 0.3 || fd.z < 0.02 || spRun(ab, p0.y, 1.0 - sb, spTear(kind, E, apex, tb), Cc.w * 37.0 + float(si) * 3.1).x < 0.5) return;
    v0 = (spFilm(ub, sb, tb + 0.01, A, B, Cc, D, 0.0, Nd, fd) - p0) * 100.0;
    vec3 tg = normalize(cross(up, Nd) + vec3(1e-4, 0.0, 0.0));
    v0 += Nd * e * (0.1 + 0.55 * q2) + tg * e * 1.0 * (q6 - 0.5) + up * e * (0.9 * q5 - 0.2);
  }
  vec3 vt = uWindB * 0.15 + uGrav / k;
  vec3 wp = spAt(p0, v0, vt, k, age);
  vec3 vl = vt + (v0 - vt) * exp(-k * age);
  float sig = spSigma(E, Cc.x) / (keep * ${SP_DROPS}.0) * (0.5 + q6);
  float sp0 = length(v0), hl = 0.03 + 0.05 * sp0 * age, hw = min(0.006 + 0.06 * age, 0.03);
  vec3 vw = mat3(uBoatM) * vl, dw = normalize(vw + 1e-5 * up);
  float hle = hl + 0.001 * length(vw);
  vec3 wh = wp + dw * hle, wt = wp - dw * hle;
  vec2 sea = vec2(spSea(wt.xz, uTime), spSea(wh.xz, uTime));
  if (max(wh.y - sea.y, wt.y - sea.x) < 0.0) {
    if (fract(r4 * 3.31 + r2 * 7.73) > 0.33) return;
    float aL = spLand(p0, v0, vt, k, age);
    if (aL < 0.0) return;
    vec3 lw = spAt(p0, v0, vt, k, aL);
    spRing(vec3(lw.x, spSea(lw.xz, uTime), lw.z), age - aL, 0.6 * ringLife, 0.03 + 7.0 * rad, min(0.08 + 30.0 * sig, 0.25));
    return;
  }
  if (age > life) return;
  float nk = 1.0 - smoothstep(4.0, 9.0, length(wp - cameraPosition)), ck = 0.4 * nk * smoothstep(0.15, 0.35, age);
  if (fract(r4 * 7.93 + r1 * 3.37) < ck) return;
  sig /= 1.0 - ck;
  hl = mix(hl, min(hl, 0.12), nk);
  hw = mix(hw, min(hw, 0.035), nk);
  float a = smoothstep(0.0, 0.03, age) * (1.0 - smoothstep(0.8 * life, life, age));
  vAer = 1.0;
  vec3 kD = normalize(uKeyDir);
  float behind = (1.0 - smoothstep(0.15, 0.4, kD.y)) * smoothstep(0.0, 0.5, dot(normalize(wp - cameraPosition), kD));
  float sunUp = spSunUp();
  vKey = max(vKey, smoothstep(0.9, 1.5, spBal(p0, v0, vt, k, age).y) * (1.0 - behind) * sunUp);
  hl = mix(max(hw, 0.008), hl, sunUp);
  spClump(wp, vw, hl, hw, mix(0.002, 0.004, nk) * mix(0.3, 1.0, sunUp), sig, a, sea);
  vTear = age;
}
`;
const SP_SUNREF = (() => {
  const s = SKY_UNIFORMS.uSkSunSea.value, L = SKY_UNIFORMS.uSunDir.value;
  const l = (0.2126 * s.x + 0.7152 * s.y + 0.0722 * s.z) * Math.max(L.y, 0.2);
  return l > 1e-4 ? 1 / l : 1.25;
})();
const SPRAY_FRAG$1 = `
${SPRAY_VARY}
${SKY_DECL}
${SKY_FUNCS}
uniform float uTime;
uniform vec3 uKeyDir;
uniform vec3 uKeyCol;
uniform vec3 uSkyCol;
uniform vec3 uSeaCol;
uniform float uLamp;
uniform vec3 uLampW;
const vec3 SP_SEA = vec3(0.004, 0.022, 0.04);
const vec3 SP_BODY = vec3(0.10, 0.13, 0.19);
${SPRAY_RUN_GLSL}
vec3 spEnv(vec3 R, float spread) {
  vec3 sky = skyReflect(vec3(R.x, abs(R.y), R.z), spread);
  float Fs = 0.02 + 0.98 * pow(1.0 - abs(R.y), 5.0);
  return mix(sky * Fs + SP_SEA * uSkAmbLevel, sky, smoothstep(-0.02, 0.02, R.y));
}
const vec3 SP_LUMA = vec3(0.2126, 0.7152, 0.0722);
float spSunUp() { return smoothstep(0.04, 0.2, dot(uSkSunSea, SP_LUMA)) * (1.0 - skDark()); }
float spCapL() {
  float moonI = dot(uSkMoonSea, SP_LUMA) * max(uMoonDir.y, 0.0) * 0.0175;
  vec3 foam = (vec3(0.88, 0.94, 1.0) * (0.9 * uSkAmbLevel + 0.65 * moonI) + uSkSunSea * (0.65 * ${g7$1(SP_SUNREF)})) * (1.1 * (1.0 - 0.94 * skDark()));
  return max(dot(foam, SP_LUMA) * spSunUp(), 1.3 * 0.223 * dot(uSkyCol + uKeyCol * vLit, SP_LUMA));
}
vec3 spCap(vec3 c, float L) { return c * min(1.0, L / max(dot(c, SP_LUMA), 1e-6)); }
void main() {
  vec3 V = normalize(vPos - cameraPosition);
  vec3 Ld = normalize(uKeyDir);
  float cf = dot(V, Ld);
  vec3 keyLit = uKeyCol * vKey;
  vec3 lv = uLampW - vPos;
  vec3 lamp = vec3(1.0, 0.54, 0.18) * uLamp * 0.8 / (1.0 + dot(lv, lv) * 1.6);
  float capL = spCapL();
  vec3 white = spCap(uSkyCol * 1.1 + keyLit * (0.36 + 1.4 * pow(max(cf, 0.0), 5.0)), capL) + lamp;
  white = mix(white, vec3(dot(white, vec3(0.3333))), 0.1);
  float keyK = smoothstep(0.4, 1.6, dot(keyLit, vec3(0.2126, 0.7152, 0.0722)) / max(dot(uSkyCol, vec3(0.2126, 0.7152, 0.0722)), 1e-3));
  vec3 col;
  float a;
  if (vRole < 0.5) {
    float u = vQ.x, s = vQ.y, al = vHl.x, Y = vHl.y + vLen, band = max(vUp.y, 0.005);
    float hb = 1.0 - s, dl = s * band;
    float kr = spRunK(vPh) * fwidth(al);
    float fmR = 1.0 - smoothstep(0.12, 0.3, kr);
    vec2 r0 = spRunF(al, Y, hb, vTear, vPh, 1.0 - smoothstep(0.12, 0.3, 2.3 * kr), mix(0.35, 1.0, fmR));
    vec2 dA = vec2(dFdx(al), dFdy(al)), dY = vec2(dFdx(Y), dFdy(Y)), dR = vec2(dFdx(r0.y), dFdy(r0.y));
    float det = dA.x * dY.y - dA.y * dY.x;
    vec2 gr = abs(det) > 1e-14 ? vec2(dR.x * dY.y - dR.y * dY.x, dA.x * dR.y - dA.y * dR.x) / det : vec2(0.0);
    gr = clamp(gr * 0.005, vec2(-0.25), vec2(0.25)) * fmR;
    vec3 N = normalize(vN);
    if (dot(N, V) > 0.0) N = -N;
    vec3 Tl = cross(N, vec3(0.0, 1.0, 0.0));
    Tl = dot(Tl, Tl) > 1e-6 ? normalize(Tl) : vec3(1.0, 0.0, 0.0);
    vec3 Up = normalize(cross(Tl, N));
    if (Up.y < 0.0) Up = -Up;
    N = normalize(N - (Tl * gr.x + Up * gr.y) * 2.2);
    float flw = Y * 7.0 - 2.0 * uTime;
    N = normalize(N + (Tl * (spN(vec2(al * 55.0 + vPh, flw)) - 0.5) + Up * 0.5 * (spN(vec2(al * 31.0 - vPh, flw * 1.7 + 4.1)) - 0.5)) * 0.22 * fmR);
    float F = 0.02 + 0.98 * pow(1.0 - clamp(abs(dot(N, V)), 0.0, 1.0), 5.0);
    vec3 env = spEnv(reflect(V, N), 0.03);
    float nh = max(dot(N, normalize(Ld - V)), 0.0);
    float sunF = smoothstep(0.5, 1.0, vKey) * keyK;
    float paintL = 0.223 * dot(uSkyCol + uKeyCol * max(dot(normalize(vN), Ld), 0.0), SP_LUMA) + dot(lamp, SP_LUMA);
    float flank = smoothstep(0.1, 0.6, r0.y) * mix(0.3, 1.0, fmR);
    float gbk = smoothstep(0.4, 0.75, spN(vec2(al * 42.0 + vPh, flw * 1.3 + 0.7)));
    float spec = pow(nh, 140.0) * 5.0 * gbk;
    vec3 lobe = spCap(keyLit * (pow(nh, 30.0) * 0.5 + pow(nh, 8.0) * 0.12) * flank * sunF, 0.1 * paintL);
    float edge = 1.0 - smoothstep(0.35, 1.0, abs(u * 2.0 - 1.0) + 0.35 * (spN(vec2(Y * 8.0 + vPh, uTime * 0.5)) - 0.5));
    float lipF = smoothstep(0.0, 0.015 + 0.02 * spN(vec2(al * 9.0 + vPh, 3.1)), dl - 0.012 * spN(vec2(al * 14.0 - vPh, uTime * 0.7)));
    float cov = vA * edge * lipF * r0.x;
    float wet = (0.02 + 0.08 * r0.y * r0.y) * mix(1.0, 0.5, smoothstep(0.4, 0.9, hb));
    a = min(F + wet * 0.4 * (1.0 - F), 1.0) * cov;
    col = spCap((env * F + lamp * 0.3 * F) * cov + lobe * cov, paintL * a) + spCap(keyLit * spec, 4.0 * capL) * cov;
    float lw = (0.01 + 0.025 * spN(vec2(al * 9.0 + vPh, 3.1))) * (0.6 + 0.8 * spN(vec2(al * 3.3 - vPh, 7.7)));
    float lipB = smoothstep(0.0, max(lw, 3.0 * fwidth(dl)), dl - 0.012 * spN(vec2(al * 14.0 - vPh, uTime * 0.7)));
    float drn = (1.0 - smoothstep(0.0, 0.045, vLen)) * (1.0 - smoothstep(0.5, 0.65, vTear));
    float bead = 4.0 * lipB * (1.0 - lipB) * vA * edge * smoothstep(0.2, 0.6, r0.x) * smoothstep(0.02, 0.25, r0.y) * drn * smoothstep(0.25, 0.6, spN(vec2(al * 7.0 + vPh, 1.7)));
    col += (spEnv(normalize(reflect(V, N) + vec3(0.0, 0.6, 0.0)), 0.08) * 0.3 + spCap(keyLit * pow(nh, 12.0), capL) * 0.35) * bead;
    a += bead * 0.06 * (1.0 - a);
    float tipO = smoothstep(0.15, 0.45, r0.x) * (0.55 + 0.45 * (1.0 - smoothstep(0.5, 0.95, r0.x)));
    float brk = smoothstep(0.35, 0.7, 0.65 * spN(vec2(al * 6.0 + vPh, uTime * 0.6)) + 0.35 * spN(vec2(al * 17.0 - vPh, uTime * 1.3 + 2.1)));
    float lwC = max(0.03 + 0.04 * spN(vec2(al * 5.0 - vPh, 5.3)), 4.0 * fwidth(dl));
    float dC = dl - 0.012 * spN(vec2(al * 14.0 - vPh, uTime * 0.7));
    float cw = smoothstep(0.0, 0.3 * lwC, dC) * (1.0 - smoothstep(0.4 * lwC, lwC, dC));
    float fc = mix(0.55, smoothstep(0.3, 0.7, spN(vec2(al * 70.0 + vPh, dl * 70.0 - uTime * 3.0))), fmR);
    float fl = cw * vA * edge * smoothstep(0.1, 0.5, r0.x) * drn * vCover * smoothstep(0.04, 0.1, band) * tipO * brk * fc * (0.6 + 0.4 * spN(vec2(al * 2.3 - vPh, 2.3)));
    col = col * (1.0 - 0.85 * fl) + white * 0.85 * fl;
    a = a * (1.0 - 0.85 * fl) + 0.85 * fl;
    float tip = smoothstep(0.75, 1.0, hb) * smoothstep(0.15, 0.5, r0.x) * (1.0 - smoothstep(0.5, 0.9, r0.x));
    float wa = 0.6 * vA * vAer * tip * smoothstep(0.45, 0.75, spN(vec2(al * 30.0 + vPh, uTime * 2.3)));
    col = col * (1.0 - wa) + white * 0.97 * wa;
    a = a * (1.0 - wa) + wa;
  } else if (vRole > 2.5 && vRole < 3.5) {
    float j = vQ.y, al = vHl.x;
    vec2 wq = vec2(al * 24.0 + vPh, j * 2.2 - vPh);
    wq += 0.9 * (vec2(spN(wq * 0.43 + 3.1), spN(wq.yx * 0.37 - 1.7)) - 0.5);
    vec2 wr = mat2(0.8, -0.6, 0.6, 0.8) * vec2(al * 57.0 - vPh, j * 4.5 + 1.3);
    float stk = spN(vec2(al * 38.0 + vPh * 1.3, j * 1.4 - vPh)) * 0.7 + 0.3 * spN(vec2(al * 91.0 - vPh, j * 2.6 + 1.9));
    float fn = 0.65 * spN(wq) + 0.35 * spN(wr) + 0.18 * (stk - 0.5);
    float tr = vTear * 1.15 - 0.1;
    float cov = vA * smoothstep(tr - 0.06, tr + 0.2, fn);
    vec3 N = normalize(vN);
    if (dot(N, V) > 0.0) N = -N;
    N = normalize(N + 0.14 * (vec3(spN(wq * 0.9 + 7.7), spN(wr * 0.4 + 4.1), spN(wq.yx * 0.85 - 2.7)) - 0.5));
    float F = (0.02 + 0.98 * pow(1.0 - clamp(abs(dot(N, V)), 0.0, 1.0), 5.0)) * (0.25 + 0.75 * smoothstep(0.3, 0.75, stk));
    vec3 env = spEnv(reflect(V, N), 0.06);
    float nh = max(dot(N, normalize(Ld - V)), 0.0);
    float spec = pow(nh, 60.0) * 3.0 + pow(nh, 16.0) * 0.35;
    float fwd = pow(max(cf, 0.0), 10.0) * 2.5;
    col = (env * F + spCap(keyLit * spec, 2.0 * capL) + spCap(keyLit * fwd * (1.0 - F), 0.5 * capL) + lamp * 0.2 * F) * cov;
    a = 0.35 * F * cov;
    float root = (1.0 - smoothstep(0.0, 0.05, vHl.y)) * cov * (0.4 + 0.6 * stk);
    col += (spEnv(normalize(reflect(V, N) + vec3(0.0, 0.6, 0.0)), 0.08) * 0.35 + spCap(keyLit * (0.2 + 1.4 * pow(nh, 12.0)), capL) * 0.3) * root;
    a += root * 0.05 * (1.0 - a);
    float rim = 1.0 - smoothstep(0.0, 0.2, j);
    float veil = 1.0 - exp(-cov * vUp.x * (0.02 + 0.08 * vTear) * rim);
    col = col * (1.0 - veil) + white * veil;
    a = a * (1.0 - veil) + veil;
    float tip = smoothstep(tr - 0.03, tr + 0.02, fn) * (1.0 - smoothstep(tr + 0.02, tr + 0.1, fn));
    float th = vA * tip * 0.12;
    col += spEnv(reflect(V, N), 0.06) * th;
    a += th * 0.3 * (1.0 - a);
    float tipW = smoothstep(tr - 0.05, tr + 0.02, fn) * (1.0 - smoothstep(tr + 0.03, tr + 0.16, fn));
    float wa = 0.95 * vA * vAer * tipW * smoothstep(0.4, 0.75, spN(vec2(al * 40.0 + vPh, uTime * 3.0)));
    col = col * (1.0 - wa) + white * wa;
    a = a * (1.0 - wa) + wa;
  } else if (vRole > 4.5) {
    float along = vQ.y < 0.0 ? vQ.y : max(vQ.y - vLen, 0.0);
    float d = length(vec2(vQ.x, along));
    if (d > 1.0) discard;
    float w = (1.0 - smoothstep(0.0, 1.0, d)) * smoothstep(0.2, 0.8, spN(vec2(vQ.x * 1.7 + vPh, vQ.y * 0.6 + vPh * 0.3)));
    float g = 0.8, ph = (1.0 - g * g) / (12.566 * pow(1.0 + g * g - 2.0 * g * cf, 1.5));
    a = vA * w;
    col = (spCap(keyLit * ph, 1.5 * capL) + uSkyCol * 0.06 + lamp * 0.05) * a;
  } else if (vRole > 3.5) {
    float d = length(vQ);
    if (d > 1.0) discard;
    float crest = exp(-pow((d - 0.8) / 0.07, 2.0)) + 0.4 * exp(-pow((d - 0.5) / 0.06, 2.0));
    float trough = exp(-pow((d - 0.66) / 0.08, 2.0));
    a = (0.03 * crest + 0.06 * trough) * vA * vCover;
    col = (uSkyCol * 0.2 + lamp) * crest * vA * vCover * 0.25;
  } else if (vRole > 1.5 && vRole < 2.5) {
    float along = vQ.y < 0.0 ? vQ.y : max(vQ.y - vLen, 0.0);
    float sa = clamp((vQ.y + 1.0) / (vLen + 2.0), 0.0, 1.0);
    float dry = smoothstep(-0.004, 0.006, mix(vUp.x, vUp.y, sa));
    float br = smoothstep(0.02, 0.12, vTear);
    float t0 = vA / (1.0 + vA / 2.5);
    float ppm = vN.x / max(vN.y, 1e-5);
    float near = smoothstep(90.0, 180.0, ppm);
    float fb = vHl.y;
    float dense = smoothstep(0.6, 2.2, t0) * br * (1.0 - 0.3 * near) * (1.0 - fb) * (1.0 - fb) * mix(0.35, 1.0, keyK);
    float wdt = sqrt(clamp(min(sa, 1.0 - sa) * (2.2 + 0.3 * vLen), 0.0, 1.0));
    float rx = abs(vQ.x) / max(wdt, 0.05);
    float prof = exp(-2.0 * rx * rx) * (1.0 - smoothstep(0.6, 1.0, rx));
    vec2 P = vQ * vN.x;
    vec2 gr = vec2(max(1.5, 0.3 * vN.x), max(mix(3.0, 2.2, fb), 0.6 * vN.x));
    gr.y = mix(gr.x, gr.y, spSunUp());
    float nz = 0.62 * spN(P / gr + vec2(vPh, -vPh)) + 0.38 * spN(P / (0.47 * gr) + vec2(-1.3 * vPh, 2.1 + vPh));
    float D = prof * (0.45 + 1.1 * nz);
    float thr = mix(0.55, 1.02, fb) - 0.15 * dense;
    float aw = fwidth(D) * 0.7 + 0.025;
    if (vQ.x * vQ.x + along * along >= 1.0) discard;
    float torn = smoothstep(thr - aw, thr + aw, D);
    float od = 1.0 - exp(-t0 * (0.5 + 1.0 * nz));
    float thin = (1.0 - 0.85 * fb * br) * (1.0 - 0.5 * fb) * mix(1.0, 0.45 + 0.55 * smoothstep(0.02, 0.3, min(vUp.x, vUp.y)), fb);
    vec3 clear = spCap(uSkyCol * 0.6 + keyLit * (0.15 + 0.9 * pow(max(cf, 0.0), 5.0)), 0.8 * capL) + lamp * 0.3;
    vec3 trn = uKeyCol * vec3(1.0, 0.82, 0.6) * (0.08 + 1.1 * pow(max(cf, 0.0), 4.0));
    vec3 whiteC = mix(spCap(uSkyCol * 0.75 + trn, 0.85 * capL) + lamp, white, keyK);
    float aE = (torn * mix(0.55, 0.97, dense) + (1.0 - torn) * 0.04 * prof) * od * thin * dry * (1.0 - near);
    a = aE * mix(mix(0.3, 0.1, fb), 1.0, dense);
    col = mix(clear * 0.8, whiteC, dense) * aE;
    if (near > 0.0) {
      vec2 Pq = vQ * vN.x;
      float Lq = vLen * vN.x, stk = vN.z * Lq, nd = (1.0 + 2.0 * smoothstep(0.1, 1.2, t0) + 3.5 * dense) * (1.0 - 0.6 * fb);
      vec3 skyC = uSkyCol * 0.9 + lamp * 0.3, seaC = uSeaCol * 0.25 + SP_SEA * uSkAmbLevel;
      vec3 pk = spCap(uSkyCol * 1.3 + keyLit * (0.3 + 1.4 * pow(max(cf, 0.0), 4.0)), capL);
      vec3 gl = spCap(keyLit * (1.0 + 4.0 * pow(max(cf, 0.0), 3.0)), 1.5 * capL);
      for (int k = 0; k < 10; k++) {
        float fk = float(k);
        float h1 = spH(vec2(vPh, fk * 3.1 + 0.7)), h2 = spH(vec2(fk * 1.7 + 2.9, vPh)), h3 = spH(vec2(vPh * 0.37 + fk, 5.9)), h4 = spH(vec2(fk + 9.1, vPh * 1.3));
        if (fk >= floor(nd + h4)) break;
        float Dd = min(2.2 - log(max(fract(h4 * 7.13 + h1 * 3.7), 1e-4)) / 0.9, 6.0), Dp = Dd * ppm * 0.001, R = max(0.5 * Dp, mix(0.6 + 0.5 * h2, 0.5, fb));
        float Lk = stk * mix(0.6, 1.2, smoothstep(1.0, 5.0, Dd)) * (0.8 + 0.4 * h1);
        float s = 0.5 + 0.5 * (h1 + h2 - 1.0);
        vec2 q = Pq - vec2((h3 - 0.5) * 1.2 * vN.x * sqrt(max(1.0 - (2.0 * s - 1.0) * (2.0 * s - 1.0), 0.1)), s * max(Lq - Lk, 0.0));
        vec2 qc = vec2(q.x, q.y - clamp(q.y, 0.0, Lk));
        float r = length(qc);
        float cov = 1.0 - smoothstep(R - 0.6, R + 0.6, r);
        if (cov <= 0.0) continue;
        float dk = smoothstep(-0.004, 0.006, mix(vUp.x, vUp.y, clamp((s * max(Lq - Lk, 0.0) + vN.x) / (Lq + 2.0 * vN.x), 0.0, 1.0)));
        float yu = dot(qc, vLd.zw) / R, xl = dot(qc, vLd.xy) / R;
        float sz = min(0.25 * Dp * Dp / (R * R), 1.0);
        float ec = 2.0 * R / (2.0 * R + Lk);
        float tl = Lk > 0.5 ? clamp(q.y / Lk, 0.0, 1.0) : 0.5;
        float tap = mix(1.0, 0.35 + 0.65 * smoothstep(0.0, 0.4, tl) * smoothstep(0.0, 0.4, 1.0 - tl), smoothstep(1.0, 3.0, Lk / max(2.0 * R, 0.5)));
        float rim = smoothstep(1.6, 3.0, R) * smoothstep(0.5, 0.8, r / R) * (1.0 - smoothstep(0.85, 1.05, r / R)) * (1.0 - smoothstep(0.5, 1.5, Lk / max(2.0 * R, 0.5)));
        float cat = smoothstep(0.35, 0.8, yu) * (1.0 - smoothstep(0.8, 1.1, yu));
        float glt = smoothstep(0.2, 0.7, xl) * (1.0 - smoothstep(0.7, 1.1, xl)) * smoothstep(0.6, 1.6, Dp) * max(0.3 + 0.7 * sin(uTime * 37.0 + vPh * 7.0 + fk * 2.1) * sin(uTime * 23.0 + fk), 0.0);
        float w = near * cov * sz * dk * mix(0.8, 1.0, br) * ec * tap * (1.0 - 0.5 * fb);
        float lk = 0.3 + 0.7 * h3 * h3;
        float vr = 0.2 + 1.6 * h3 * h3 * h3;
        vec3 em = skyC * (0.15 + 0.35 * (1.0 - smoothstep(-0.8, -0.2, yu))) * (1.0 - rim) + seaC * rim + pk * cat * lk * mix(0.5, 1.0, smoothstep(1.2, 2.5, R)) + gl * glt * 1.6 * step(0.72, h2);
        float ad = w * (0.18 + 0.55 * rim);
        em = mix(em * vr, whiteC * 1.05, 0.65 * dense);
        ad = mix(ad, w * 0.85, 0.65 * dense);
        col = col * (1.0 - ad) + em * w;
        a += ad * (1.0 - a);
      }
    }
  } else {
    float along = vQ.y < 0.0 ? vQ.y : max(vQ.y - vLen, 0.0);
    vec2 q = vec2(vQ.x, along);
    float d = length(q);
    float qy = dot(q, vUp);
    float disc = 1.0 - smoothstep(0.5, 1.0, d);
    vec3 body = mix(uSkyCol * 0.6, uSeaCol, smoothstep(-0.5, 0.5, qy));
    float hd = length(vec2(vQ.x, vQ.y - vLen) - 0.42 * vCover * vHl);
    float cl = min(8.0 * vCover, 1.0);
    float glint = (1.0 - smoothstep(0.0, clamp(0.8 / max(vN.x, 0.1), mix(1.0, 0.32, vCover), 1.0), hd)) * (0.6 + 4.0 * pow(max(cf, 0.0), 6.0));
    glint *= cl * (0.6 + 0.4 * spH(vec2(vPh, floor(uTime * 30.0))));
    float blur = 2.0 / (2.0 + vLen);
    a = vA * disc * cl * 0.9 * blur;
    col = (body + lamp) * a + keyLit * glint * 1.1 * vA;
  }
  if (a < 0.002 && dot(col, col) < 1e-7) discard;
  gl_FragColor = vec4(col, a);
}
`;
class Spray {
  constructor() {
    const n = SPRAY_SLOTS * SPRAY_PER + DRIPS * DRIP_K;
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(12), 3));
    g.setAttribute('aCorner', new THREE.Float32BufferAttribute([-1, 0, 1, 0, -1, 1, 1, 1], 2));
    g.setIndex([0, 1, 2, 2, 1, 3]);
    const seed = new Float32Array(n * 4), idx = new Float32Array(n * 2), rng = makeRng$1(4077), ND = DRIPS * DRIP_K;
    const partSeed = Float32Array.from({ length: SPRAY_PER * 4 }, () => rng());
    for (let i = 0; i < n; i++) {
      if (i < ND) {
        for (let c = 0; c < 4; c++) seed[i * 4 + c] = rng();
        idx[i * 2] = SPRAY_SLOTS + Math.floor(i / DRIP_K); idx[i * 2 + 1] = i % DRIP_K;
      } else {
        const j = i - ND, part = j % SPRAY_PER;
        for (let c = 0; c < 4; c++) seed[i * 4 + c] = partSeed[part * 4 + c];
        idx[i * 2] = Math.floor(j / SPRAY_PER); idx[i * 2 + 1] = part;
      }
    }
    g.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seed, 4));
    g.setAttribute('aIdx', new THREE.InstancedBufferAttribute(idx, 2));
    g.instanceCount = n;
    const v4 = (k, x, y, z, w) => Array.from({ length: k }, () => new THREE.Vector4(x, y, z, w));
    this.uniforms = Object.assign({}, SKY_UNIFORMS, {
      uTime: { value: 0 },
      uSpA: { value: v4(SPRAY_SLOTS, 0, 0, 0, -100) }, uSpB: { value: v4(SPRAY_SLOTS, 1, 0, 0, 0) }, uSpC: { value: v4(SPRAY_SLOTS, 0.3, 0, 0, 0) },
      uSpD: { value: v4(SPRAY_SLOTS, 0, 0, 0, 0) }, uSpT: { value: null }, uSkLen: { value: 11 }, uSlot0: { value: 0 },
      uDripA: { value: v4(DRIPS, 0, 0, 0, 0) }, uDripB: { value: v4(DRIPS, 0, 0, 0, 0) },
      uBoatM: { value: new THREE.Matrix4() }, uGrav: { value: new V3$2(0, -9.81, 0) }, uWindB: { value: new V3$2() },
      uResY: ROPE_U.uRbResY, uAspect: { value: 16 / 9 },
      uKeyDir: { value: new V3$2(0, 1, 0) }, uKeyCol: { value: new V3$2(3, 3, 3) },
      uSkyCol: { value: new V3$2(0.56, 0.72, 0.9) }, uSeaCol: { value: new V3$2(0.1, 0.13, 0.15) },
      uLamp: BT_U.uBtLamp, uLampW: BT_U.uBtLampW,
    });
    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms, vertexShader: SPRAY_VERT$1, fragmentShader: SPRAY_FRAG$1,
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      blending: THREE.CustomBlending, blendEquation: THREE.AddEquation,
      blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
      blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
    });
    this.mesh = new THREE.Mesh(g, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 3;
    this.mesh.onBeforeRender = () => this.cull();
    this.slot = 0;
    this.count = 0;
    this.bigCount = 0;
  }
  hull(pts) {
    const NU = 1000, S = new Float32Array(NU + 1), p = new V3$2(), nn = new V3$2();
    let px = 0, pz = 0;
    for (let i = 0; i <= NU; i++) {
      const u = -0.999 + (1.998 * i) / NU;
      hullPoint(u, vAtY(u, 0), 1, p);
      S[i] = i ? S[i - 1] + Math.hypot(p.x - px, p.z - pz) : 0;
      px = p.x; pz = p.z;
    }
    const uAt = (s) => {
      if (s <= 0) return -0.999;
      if (s >= S[NU]) return 0.999;
      let lo = 0, hi = NU;
      while (hi - lo > 1) { const m = (lo + hi) >> 1; if (S[m] < s) lo = m; else hi = m; }
      return -0.999 + (1.998 * (lo + (s - S[lo]) / ((S[hi] - S[lo]) || 1))) / NU;
    };
    const sAt = (u) => { const f = ((u + 0.999) / 1.998) * NU, i = Math.min(NU - 1, Math.max(0, Math.floor(f))); return S[i] + (S[i + 1] - S[i]) * (f - i); };
    const data = new Float32Array(SP_NA * SP_NY * 2 * 4 * pts.length);
    this.emS = new Float32Array(pts.length); this.emSide = new Float32Array(pts.length); this.wlLen = S[NU];
    this.uniforms.uSkLen.value = S[NU];
    pts.forEach((q, e) => {
      const side = q.x < 0 ? -1 : 1, s0 = sAt(uAtZ(q.z, 0));
      this.emS[e] = s0; this.emSide[e] = side;
      for (let i = 0; i < SP_NA; i++) {
        const sa = s0 - SP_A + (2 * SP_A * i) / (SP_NA - 1), u = uAt(sa), w = sa > 0 && sa < S[NU] ? 1 : 0;
        for (let j = 0; j < SP_NY; j++) {
          const v = vAtY(u, SP_Y0 + SP_DY * j);
          hullPoint(u, v, side, p);
          hullNormal(u, v, side, nn);
          const o = ((e * SP_NY * 2 + j) * SP_NA + i) * 4, on = o + SP_NY * SP_NA * 4;
          data[o] = p.x; data[o + 1] = p.y; data[o + 2] = p.z; data[o + 3] = w;
          data[on] = nn.x; data[on + 1] = nn.y; data[on + 2] = nn.z; data[on + 3] = 0;
        }
      }
    });
    const tex = new THREE.DataTexture(data, SP_NA, SP_NY * 2 * pts.length, THREE.RGBAFormat, THREE.FloatType);
    tex.minFilter = tex.magFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    tex.needsUpdate = true;
    this.uniforms.uSpT.value = tex;
  }
  cull() {
    const U = this.uniforms, A = U.uSpA.value, B = U.uSpB.value, t = U.uTime.value;
    let n = 0;
    for (let k = 0; k < SPRAY_SLOTS; k++) {
      const s = (this.slot - 1 - k + 2 * SPRAY_SLOTS) % SPRAY_SLOTS, age = t - A[s].w;
      if (B[s].z > 0 && age > -1 && age < SPRAY_LIFE) n = k + 1;
    }
    U.uSlot0.value = (this.slot - n + SPRAY_SLOTS) % SPRAY_SLOTS;
    this.mesh.geometry.instanceCount = DRIPS * DRIP_K + n * SPRAY_PER;
  }
  drip(i, x, y, z, interval, strength) {
    this.uniforms.uDripA.value[i].set(x, y, z, interval);
    this.uniforms.uDripB.value[i].x = strength;
  }
  dripStrength(i, s) { this.uniforms.uDripB.value[i].x = s; }
  roll() {}
  burst(t, x, y, z, nx, nz, E, kind, W, flare, kappa, e = 0) {
    const s = this.slot, U = this.uniforms;
    this.slot = (s + 1) % SPRAY_SLOTS;
    U.uSpA.value[s].set(x, y, z, t);
    U.uSpB.value[s].set(nx, nz, E, kind);
    U.uSpC.value[s].set(W, flare, kappa, (this.count * 0.618034) % 1);
    U.uSpD.value[s].set(y, e, this.emS ? this.emS[e] : 0, this.emSide ? this.emSide[e] : 1);
    this.count++;
    if (kind) this.bigCount++;
  }
}

