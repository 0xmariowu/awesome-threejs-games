// magic.js
const TAU$1 = Math.PI * 2;
const DEG$1 = Math.PI / 180;
const FONT_GR = '"GFS Neohellenic", "Noto Serif", "Times New Roman", serif';
const ZODIAC = ['ΚΡΙΟΣ', 'ΤΑΥΡΟΣ', 'ΔΙΔΥΜΟΙ', 'ΚΑΡΚΙΝΟΣ', 'ΛΕΩΝ', 'ΠΑΡΘΕΝΟΣ', 'ΧΗΛΑΙ', 'ΣΚΟΡΠΙΟΣ', 'ΤΟΞΟΤΗΣ', 'ΑΙΓΟΚΕΡΩΣ', 'ΥΔΡΟΧΟΟΣ', 'ΙΧΘΥΕΣ'];
const Y_UP = new THREE.Vector3(0, 1, 0);

const clamp$2 = (x, a, b) => (x < a ? a : x > b ? b : x);
const sstep$1 = (a, b, x) => { const t = clamp$2((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const damp = (dt, rate) => 1 - Math.exp(-dt * rate);
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const wrap180 = (d) => ((((d % 360) + 540) % 360) - 180);

const ATLAS_W = 4096, ATLAS_H = 256, ROW_PX = 80;
const ROW_A = { top: 24, mid: 64, bot: 104 };
const ROW_B = { top: 152, mid: 192, bot: 232 };
const BAND_K = (ROW_PX / ATLAS_W) * TAU$1;

const ORR = { r0: 0.30, dr: 0.113, bandOut: 1.24, disc: 1.30, lift: 1.3, sunR: 0.055 };
const BEAM = { r0: 0.06, r1: 1.1 };
ORR.bandIn = ORR.bandOut - (BAND_K * ORR.bandOut) / (1 + BAND_K / 2);
const RING_BODY = [1, 3, 4, 2, 5, 6, 7];
const RING_COL = [[0.72, 0.84, 1.0], [0.85, 0.87, 0.95], [1.0, 0.9, 0.62], [1.0, 0.7, 0.3], [1.0, 0.36, 0.2], [1.0, 0.88, 0.7], [1.0, 0.76, 0.4]];
const BODIES = [
  [0, 0.15, 0.0, [1, 1, 1]],
  [1, 0.075, 0.0, [1, 1, 1]],
  [2, 0.42, 0.0, [1, 1, 1]],
  [3, 0.075, 0.1, [0.9, 0.9, 0.95]],
  [3, 0.085, 0.3, [1.0, 0.93, 0.72]],
  [3, 0.075, 0.5, [1.0, 0.3, 0.16]],
  [3, 0.085, 0.7, [1.0, 0.92, 0.78]],
  [3, 0.085, 0.95, [1.0, 0.8, 0.45]],
  [4, 1.4, 0.0, [1, 1, 1]],
];
const TRAIL_N = 256;
const TRAIL_TAU = 0.2;
const MOON_RATE = 389.106;
const ALIGN_FLASH_T = 2.9;
const MOON_HELD = 1.6;
const HELD_SUN = [1.1, 2.0], HELD_DARK = [1.5, 2.1];
const RIB_SLOTS = 28, RIB_SEG = 40, RIB_HIST = 64, RIB_WIN = 0.24, RIB_W = 0.05, RIB_WMAX = 0.11;
const RIB_COL = [1.15, 0.8, 0.36];
const RUNE_LIFT = 0.42, RUNE_TILT = 0.24;

const COMP_GLSL = `
uniform vec3 uBoxC;
uniform vec3 uBoxH;
uniform vec2 uBoxCS;
uniform float uFloorY;
uniform vec3 uCapLo;
uniform vec3 uCapHi;
uniform vec3 uMgAbs;
uniform float uPostFog;
float mgBack(vec3 ro, vec3 rd, float dm) {
  float d = 1.0e4;
  if (rd.y > 1.0e-4) d = -ro.y / rd.y;
  else if (rd.y < -1.0e-4) d = (uFloorY - ro.y) / rd.y;
  d = max(d, dm);
  vec3 o = ro - uBoxC;
  vec3 lo = vec3(uBoxCS.x * o.x - uBoxCS.y * o.z, o.y, uBoxCS.y * o.x + uBoxCS.x * o.z);
  vec3 ld = vec3(uBoxCS.x * rd.x - uBoxCS.y * rd.z, rd.y, uBoxCS.y * rd.x + uBoxCS.x * rd.z);
  vec3 sd = vec3(ld.x < 0.0 ? -1.0 : 1.0, ld.y < 0.0 ? -1.0 : 1.0, ld.z < 0.0 ? -1.0 : 1.0);
  vec3 inv = sd / max(abs(ld), vec3(1.0e-5));
  vec3 ta = (-uBoxH - lo) * inv;
  vec3 tb = (uBoxH - lo) * inv;
  vec3 t1 = min(ta, tb);
  vec3 t2 = max(ta, tb);
  float tn = max(max(t1.x, t1.y), t1.z);
  float tf = min(min(t2.x, t2.y), t2.z);
  float hit = smoothstep(0.0, 0.3, tf - max(tn, dm));
  return mix(d, max(tn, dm), hit);
}
vec3 mgComp(vec3 wp) {
  if (cameraPosition.y > -0.05) return vec3(1.0);
  vec3 v = wp - cameraPosition;
  float dm = max(length(v), 1.0e-3);
  if (uPostFog > 0.5) return exp(-uMgAbs * dm * 0.3);
  vec3 rd = v / dm;
  float db = mgBack(cameraPosition, rd, dm);
  vec3 cap = mix(uCapLo, uCapHi, smoothstep(0.1, 0.3, abs(rd.y)));
  return exp(min(uMgAbs * (db - dm), cap));
}
`;

const MG_SOFT_GLSL = `
uniform sampler2D tSceneDepth;
uniform vec2 uMgRes;
uniform vec2 uMgProjZ;
varying float vMgZ;
float mgSoft(float soft) {
  float d = texture2D(tSceneDepth, gl_FragCoord.xy / uMgRes).x;
  if (d >= 0.99999) return 1.0;
  float sz = uMgProjZ.y / (2.0 * d - 1.0 + uMgProjZ.x);
  return clamp((sz - vMgZ) / soft, 0.0, 1.0);
}
`;

const NOISE_GLSL = `
float mgH(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float mgN(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(mgH(i), mgH(i + vec2(1.0, 0.0)), u.x), mix(mgH(i + vec2(0.0, 1.0)), mgH(i + vec2(1.0, 1.0)), u.x), u.y);
}
float mgNP(vec2 p, float P) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = mod(i.x, P);
  float b = mod(i.x + 1.0, P);
  return mix(mix(mgH(vec2(a, i.y)), mgH(vec2(b, i.y)), u.x), mix(mgH(vec2(a, i.y + 1.0)), mgH(vec2(b, i.y + 1.0)), u.x), u.y);
}
float mgH3(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
float mgN3(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(mgH3(i), mgH3(i + vec3(1.0, 0.0, 0.0)), f.x), mix(mgH3(i + vec3(0.0, 1.0, 0.0)), mgH3(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
             mix(mix(mgH3(i + vec3(0.0, 0.0, 1.0)), mgH3(i + vec3(1.0, 0.0, 1.0)), f.x), mix(mgH3(i + vec3(0.0, 1.0, 1.0)), mgH3(i + vec3(1.0, 1.0, 1.0)), f.x), f.y), f.z);
}
`;

const MOTE_VERT = `
uniform float uTime;
uniform float uPhase;
uniform float uRise;
uniform float uLevel;
uniform float uBright;
uniform vec3 uCenter;
uniform float uBottom;
uniform float uHeight;
uniform float uRIn;
uniform float uROut;
uniform float uPx;
uniform float uHeroR;
attribute vec4 aSeed;
attribute vec3 aKind;
varying vec3 vCol;
varying float vSoft;
${COMP_GLSL}
void main() {
  vCol = vec3(0.0);
  float bokeh = aKind.x > 0.034 ? 1.0 : 0.0;
  float hN = fract(aSeed.y + uRise * (0.55 + 0.9 * aSeed.w));
  float r = mix(uRIn, uROut, aSeed.x);
  r *= 0.9 + 0.3 * smoothstep(0.55, 1.0, hN);
  r += 0.06 * sin(uTime * 0.41 + aSeed.w * 37.0 + hN * 7.0);
  float swirl = uPhase * (0.45 + 0.55 * (1.0 - aSeed.x)) * (1.6 / (0.7 + r));
  float ang = aSeed.z + swirl + hN * 2.2;
  vec3 wp = vec3(uCenter.x + cos(ang) * r, uBottom + hN * uHeight, uCenter.z + sin(ang) * r);
  wp.y += 0.04 * sin(uTime * 0.8 + aSeed.w * 19.0);
  float th = fract(aSeed.w * 7.13 + aSeed.x * 3.71);
  float on = smoothstep(th, th + 0.15, uLevel * 1.15);
  float ends = smoothstep(0.0, 0.08, hN) * (1.0 - smoothstep(0.8, 1.0, hN));
  float tw = 0.62 + 0.38 * sin(uTime * (1.1 + 3.4 * aSeed.w) + aSeed.z * 17.0);
  float sp = pow(max(0.0, sin(uTime * (0.35 + 0.8 * fract(aSeed.w * 11.0)) + aSeed.x * 43.0)), 30.0);
  vec4 mv = viewMatrix * vec4(wp, 1.0);
  float z = max(-mv.z, 0.05);
  vec4 hv = viewMatrix * vec4(uCenter, 1.0);
  float zH = max(-hv.z, 0.1);
  float lat = length(mv.xy / z - hv.xy / zH);
  float cone = 1.0 - smoothstep(0.9 * uHeroR / zH, 1.6 * uHeroR / zH, lat);
  float front = 1.0 - smoothstep(zH - 0.7, zH - 0.1, z);
  float b = on * ends * uBright * aKind.z * (tw + sp * 2.5) * smoothstep(0.35, 1.3, z) * (1.0 - 0.9 * cone * front);
  b *= mix(1.0, smoothstep(zH + 0.3, zH + 1.2, z), bokeh);
  float px = aKind.x * uPx / z;
  float coc = uPx * 0.014 * abs(z - zH) / z;
  float pc = clamp(max(px, coc), 1.5, 48.0);
  b *= min(1.0, (px * px) / (pc * pc));
  vSoft = max(bokeh, smoothstep(1.5, 4.0, coc / max(px, 0.3)));
  if (b < 1.0e-4 || mv.z > -0.05) {
    gl_PointSize = 0.0;
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    return;
  }
  vec3 c = aKind.y < 0.72 ? vec3(1.0, 0.66, 0.26) : (aKind.y < 0.9 ? vec3(1.0, 0.85, 0.58) : vec3(0.32, 0.86, 1.0));
  vCol = c * b * mgComp(wp);
  gl_PointSize = pc;
  gl_Position = projectionMatrix * mv;
}
`;
const MOTE_FRAG = `
varying vec3 vCol;
varying float vSoft;
void main() {
  vec2 p = gl_PointCoord * 2.0 - 1.0;
  float d2 = dot(p, p);
  if (d2 > 1.0) discard;
  float crisp = exp(-d2 * 7.0) * (1.0 - d2);
  float soft = (0.6 + 0.4 * smoothstep(0.55, 0.9, d2)) * (1.0 - smoothstep(0.86, 1.0, d2));
  gl_FragColor = vec4(vCol * mix(crisp, soft, vSoft), 1.0);
}
`;

const SPARK_VERT = `
uniform float uNow;
uniform float uPx;
attribute vec3 aVel;
attribute vec4 aInfo;
attribute vec3 aCol;
varying vec3 vCol;
${COMP_GLSL}
void main() {
  vCol = vec3(0.0);
  float age = uNow - aInfo.x;
  if (age < 0.0 || age > aInfo.y) {
    gl_PointSize = 0.0;
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    return;
  }
  float k = 2.8;
  float e = (1.0 - exp(-k * age)) / k;
  vec3 wp = position + aVel * e;
  wp.y += 0.14 * (age - e);
  wp.x += sin(age * 2.9 + aInfo.w * 41.0) * 0.025 * age;
  wp.z += cos(age * 2.3 + aInfo.w * 29.0) * 0.025 * age;
  float u = age / aInfo.y;
  float fade = (1.0 - u) * (1.0 - u);
  float hot = exp(-age * 9.0);
  float flick = 0.8 + 0.2 * sin(age * 23.0 + aInfo.w * 90.0);
  vec4 mv = viewMatrix * vec4(wp, 1.0);
  float z = max(-mv.z, 0.05);
  float px = aInfo.z * (1.0 + 0.35 * hot) * uPx / z;
  float pc = clamp(px, 1.5, 32.0);
  float b = fade * flick * min(1.0, (px * px) / (pc * pc)) * smoothstep(0.2, 0.8, z);
  vCol = mix(aCol, vec3(1.6, 1.45, 1.2), hot * 0.3) * b * mgComp(wp);
  gl_PointSize = mv.z < -0.05 ? pc : 0.0;
  gl_Position = projectionMatrix * mv;
}
`;
const SPARK_FRAG = `
varying vec3 vCol;
void main() {
  vec2 p = gl_PointCoord * 2.0 - 1.0;
  float d2 = dot(p, p);
  if (d2 > 1.0) discard;
  float a = (exp(-d2 * 8.0) + exp(-d2 * 2.5) * 0.18) * (1.0 - d2);
  gl_FragColor = vec4(vCol * a, 1.0);
}
`;

const PULSE_VERT = `
uniform float uNow;
uniform vec3 uAxX;
uniform vec3 uAxY;
attribute vec4 aP;
attribute vec4 aT;
varying vec2 vUv;
varying float vAge;
varying float vKind;
varying float vSeed;
varying float vStr;
varying vec3 vW;
varying vec3 vComp;
${COMP_GLSL}
void main() {
  float age = (uNow - aT.x) / aT.y;
  vUv = position.xy;
  vKind = floor(aP.w);
  vSeed = fract(aP.w) * 2.0;
  vStr = aT.w;
  vAge = clamp(age, 0.0, 1.0);
  vW = aP.xyz;
  vComp = vec3(1.0);
  if (age < 0.0 || age > 1.0) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    return;
  }
  if (vKind < 0.5 || vKind > 1.5) {
    float R = vKind < 0.5 ? aT.z * (1.0 - pow(1.0 - vAge, 3.0)) + 0.03 : aT.z;
    vec3 wp = aP.xyz + (uAxX * position.x + uAxY * position.y) * R * 1.25;
    vW = wp;
    gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
  } else {
    vec4 mv = viewMatrix * vec4(aP.xyz, 1.0);
    float pull = min(0.35, max(-mv.z, 0.0) * 0.3);
    mv.xyz += normalize(vec3(0.0, 0.0, 1.0e-4) - mv.xyz) * pull;
    vComp = mgComp(aP.xyz);
    mv.xy += position.xy * aT.z * (0.7 + 0.5 * vAge);
    gl_Position = projectionMatrix * mv;
  }
}
`;
const PULSE_FRAG = `
varying vec2 vUv;
varying float vAge;
varying float vKind;
varying float vSeed;
varying float vStr;
varying vec3 vW;
varying vec3 vComp;
${COMP_GLSL}
void main() {
  float r = length(vUv);
  if (r > 1.0) discard;
  vec3 col;
  if (vKind < 0.5) {
    float R = 0.8;
    float w = mix(0.012, 0.05, vAge);
    float x = (r - R) / w;
    float line = exp(-x * x);
    float fringe = exp(-max(r - R, 0.0) / (w * 3.0)) * step(R, r) * 0.35;
    float wake = smoothstep(R * 0.3, R, r) * step(r, R) * 0.14;
    float ang = atan(vUv.y, vUv.x + 1.0e-6);
    float fil = 0.7 + 0.3 * sin(ang * 19.0 + vSeed * 30.0) * sin(ang * 5.0 - vAge * 9.0 + vSeed * 7.0);
    float fade = pow(1.0 - vAge, 1.5);
    col = (vec3(2.4, 1.7, 0.85) * line * fil + vec3(0.35, 1.0, 1.25) * fringe + vec3(1.0, 0.62, 0.28) * wake) * fade;
    if (col.r + col.g + col.b < 0.003) discard;
    col *= mgComp(vW);
  } else if (vKind > 1.5) {
    float x = (r - 0.8) / 0.045;
    float ring = exp(-x * x);
    float ang = atan(vUv.y, vUv.x + 1.0e-6);
    float d = mod(vAge * 7.85 + vSeed * 3.14 - ang, 6.2831853);
    float arc = exp(-d * 1.8);
    float teeth = 0.5 + 0.5 * pow(abs(sin(ang * 12.0)), 3.0);
    float fade = (1.0 - vAge) * smoothstep(0.0, 0.08, vAge);
    col = vec3(1.1, 0.82, 0.45) * ring * arc * teeth * fade * 1.5;
    if (col.r + col.g + col.b < 0.003) discard;
    col *= mgComp(vW);
  } else {
    float fade = exp(-vAge * 5.0) * smoothstep(0.0, 0.06, vAge + 0.02);
    float glow = exp(-r * r * 10.0) * 1.1 + exp(-r * 4.5) * 0.12;
    col = vec3(1.0, 0.8, 0.52) * glow * fade * (1.0 - smoothstep(0.75, 1.0, r)) * (0.2 + 0.8 * vStr * vStr) * vComp;
  }
  gl_FragColor = vec4(col * (0.45 + 0.55 * vStr), 1.0);
}
`;

const CONE_VERT = `
varying vec2 vUv;
varying vec3 vN;
varying vec3 vV;
varying vec3 vComp;
${COMP_GLSL}
void main() {
  vUv = uv;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vec4 mv = viewMatrix * w;
  vN = normalize(normalMatrix * normal);
  vV = -mv.xyz;
  vComp = mgComp(w.xyz);
  gl_Position = projectionMatrix * mv;
}
`;
const CONE_FRAG = `
uniform float uTime;
uniform float uAlpha;
uniform vec3 uColLo;
uniform vec3 uColHi;
uniform vec4 uFadeV;
uniform vec2 uFlow;
uniform float uStreakF;
uniform float uMote;
uniform float uFill;
varying vec2 vUv;
varying vec3 vN;
varying vec3 vV;
varying vec3 vComp;
${NOISE_GLSL}
void main() {
  float dc = length(vV);
  float face = abs(dot(normalize(vN), vV / max(dc, 1.0e-4)));
  float body = uFill + (1.0 - uFill) * pow(face, 1.3);
  float h = vUv.y;
  float s1 = mgNP(vec2(vUv.x * uStreakF + uTime * uFlow.x, h * 2.4 - uTime * uFlow.y), uStreakF);
  float s2 = mgNP(vec2(vUv.x * uStreakF * 0.5 - uTime * uFlow.x * 0.7, h * 1.3 - uTime * uFlow.y * 0.6 + 3.7), uStreakF * 0.5);
  float streak = smoothstep(0.32, 0.95, s1 * 0.6 + s2 * 0.55);
  float vfade = smoothstep(uFadeV.x, uFadeV.y, h) * (1.0 - smoothstep(uFadeV.z, uFadeV.w, h));
  float near = smoothstep(0.6, 2.2, dc);
  vec3 col = mix(uColLo, uColHi, smoothstep(0.05, 0.7, h));
  float I = body * vfade * near * (0.3 + streak) * uAlpha;
  if (uMote > 0.0) {
    vec2 mc = vec2(vUv.x * 56.0, h * 14.0 - uTime * 0.45), mi = floor(mc) + (gl_FrontFacing ? 0.0 : 91.0);
    vec2 mo = fract(mc) - 0.5 - (vec2(mgH(mi + 3.1), mgH(mi + 7.7)) - 0.5) * 0.6;
    float hs = mgH(mi);
    float mote = step(0.84, hs) * exp(-dot(mo * vec2(1.0, 0.55), mo * vec2(1.0, 0.55)) * 90.0) * (0.55 + 0.45 * sin(uTime * 2.3 + hs * 40.0));
    I += mote * vfade * near * uAlpha * uMote;
  }
  gl_FragColor = vec4(col * I * vComp, 1.0);
}
`;

const BEAM_VERT = `
varying vec3 vW;
varying float vMgZ;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  vec4 mv = viewMatrix * w;
  vMgZ = -mv.z;
  gl_Position = projectionMatrix * mv;
}
`;
const BEAM_FRAG = `
uniform float uTime;
uniform float uAlpha;
uniform vec3 uColLo;
uniform vec3 uColHi;
uniform vec3 uApex;
uniform vec3 uAxis;
uniform float uK;
uniform vec2 uY;
uniform vec3 uMgAbs;
varying vec3 vW;
${MG_SOFT_GLSL}
${NOISE_GLSL}
void main() {
  vec3 ro = cameraPosition, v = vW - ro;
  float tb = length(v);
  vec3 rd = v / max(tb, 1e-4);
  vec3 q = ro - uApex;
  float qy = dot(q, uAxis), dy = dot(rd, uAxis);
  vec3 qp = q - uAxis * qy, dp = rd - uAxis * dy;
  float a = dot(dp, dp) - uK * dy * dy, b = 2.0 * (dot(qp, dp) - uK * qy * dy), c = dot(qp, qp) - uK * qy * qy;
  float tin = 0.0;
  if (!(c <= 0.0 && qy >= uY.x && qy <= uY.y)) {
    float te = tb;
    float disc = b * b - 4.0 * a * c;
    if (disc >= 0.0 && abs(a) > 1e-6) {
      float s = sqrt(disc), t1 = (-b - s) / (2.0 * a), t2 = (-b + s) / (2.0 * a);
      float y1 = qy + dy * t1, y2 = qy + dy * t2;
      if (t1 > 0.0 && y1 >= uY.x && y1 <= uY.y) te = min(te, t1);
      if (t2 > 0.0 && y2 >= uY.x && y2 <= uY.y) te = min(te, t2);
    }
    if (abs(dy) > 1e-5) {
      for (int i = 0; i < 2; i++) {
        float yc = i == 0 ? uY.x : uY.y, t = (yc - qy) / dy;
        vec3 pc = qp + dp * t;
        if (t > 0.0 && dot(pc, pc) <= uK * yc * yc) te = min(te, t);
      }
    }
    tin = te;
  }
  float d = texture2D(tSceneDepth, gl_FragCoord.xy / uMgRes).x;
  float tex = tb;
  if (d < 0.99999) tex = min(tex, (uMgProjZ.y / (2.0 * d - 1.0 + uMgProjZ.x)) * tb / max(vMgZ, 1e-3));
  float L = tex - tin;
  if (L <= 1e-4) discard;
  float H = uY.y - uY.x, sk = sqrt(uK);
  float tc = clamp(-dot(qp, dp) / max(dot(dp, dp), 1e-6), tin, tex);
  vec3 xc = qp + dp * tc;
  float ph = atan(xc.z, xc.x) / 6.2831853 + 0.5;
  float ray = mgNP(vec2(ph * 36.0 + uTime * 0.05, 0.5), 36.0);
  ray = 0.45 + 0.9 * ray * ray + 0.8 * pow(mgNP(vec2(ph * 90.0 - uTime * 0.08, 3.1), 90.0), 6.0);
  vec3 acc = vec3(0.0);
  const int N = 7;
  float ds = L / float(N);
  for (int i = 0; i < N; i++) {
    float t = tin + (float(i) + 0.5) * ds;
    vec3 x = q + rd * t;
    float y = dot(x, uAxis);
    float hn = clamp((y - uY.x) / H, 0.0, 1.0);
    float rn = length(x - uAxis * y) / max(sk * y, 1e-4);
    float dens = exp(-rn * rn * 1.9) * (1.0 - smoothstep(0.78, 1.0, rn));
    dens *= (1.0 + 4.0 * exp(-hn * 9.0)) * smoothstep(0.0, 0.03, hn) * (1.0 - smoothstep(0.62, 1.0, hn));
    float band = 0.72 + 0.28 * smoothstep(0.2, 0.9, 0.5 + 0.5 * sin(hn * 70.0 - uTime * 4.2));
    acc += mix(uColLo, uColHi, smoothstep(0.0, 0.55, hn)) * (dens * band);
  }
  vec3 I = acc * ds * (ray * uAlpha * 1.3);
  I *= exp(-uMgAbs * tb * 0.3);
  gl_FragColor = vec4(I, 1.0);
}
`;

const RUNE_VERT = `
uniform vec3 uRC;
varying vec2 vUv;
varying vec3 vComp;
varying float vCam;
varying float vFront;
${COMP_GLSL}
void main() {
  vUv = uv;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vComp = mgComp(w.xyz);
  vCam = length(cameraPosition - w.xyz);
  vec2 rel = w.xz - uRC.xz;
  vec2 toCam = cameraPosition.xz - uRC.xz;
  vFront = dot(rel, toCam) / max(length(rel) * length(toCam), 1.0e-4);
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;
const RUNE_FRAG = `
uniform sampler2D uTex;
uniform float uTime;
uniform float uAlpha;
uniform float uSpin;
varying vec2 vUv;
varying vec3 vComp;
varying float vCam;
varying float vFront;
void main() {
  vec3 s = texture2D(uTex, vec2(gl_FrontFacing ? vUv.x : 1.0 - vUv.x, 0.59375 + vUv.y * 0.3125)).rgb;
  float back = gl_FrontFacing ? 1.0 : 0.3;
  float sweep = pow(0.5 + 0.5 * cos(vUv.x * 12.5663706 - uTime * (0.9 + 2.0 * uSpin)), 10.0);
  float flick = 0.94 + 0.06 * sin(uTime * 11.0 + vUv.x * 60.0);
  vec3 col = vec3(1.25, 0.88, 0.42) * s.r * (0.8 + 0.7 * sweep) + vec3(0.9, 0.55, 0.2) * s.g * 0.3 + vec3(0.8, 0.55, 0.25) * s.b * 0.06;
  float mask = 1.0 - smoothstep(-0.3, 0.3, vFront);
  col *= back * flick * uAlpha * mask * smoothstep(1.2, 3.0, vCam);
  gl_FragColor = vec4(col * vComp, 1.0);
}
`;

const RIB_VERT = `
attribute vec3 aUv;
attribute vec4 aCol;
varying vec3 vUv;
varying vec4 vCol;
varying vec3 vComp;
${COMP_GLSL}
void main() {
  vUv = aUv;
  vCol = aCol;
  vComp = aCol.a > 0.001 ? mgComp(position) : vec3(0.0);
  gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0);
}
`;
const RIB_FRAG = `
uniform float uTime;
varying vec3 vUv;
varying vec4 vCol;
varying vec3 vComp;
void main() {
  if (vCol.a < 0.001) discard;
  float y = vUv.y;
  float edge = 1.0 - y * y;
  float core = exp(-y * y * 6.0);
  float glow = exp(-y * y * 2.2) * edge;
  float fl = 0.82 + 0.18 * sin(vUv.x * 40.0 - uTime * 7.0 + vUv.z * 20.0);
  float dust = pow(max(0.0, sin(vUv.x * 150.0 + vUv.z * 50.0 - uTime * 3.0)), 30.0) * glow;
  vec3 col = vCol.rgb * (core * 0.8 + glow * 0.24) * fl + vec3(0.3, 0.72, 0.8) * glow * 0.05 + vCol.rgb * dust * 0.45;
  gl_FragColor = vec4(col * vCol.a * vComp, 1.0);
}
`;

const ORR_VERT = `
varying vec2 vP;
varying vec3 vW;
varying vec3 vComp;
varying float vMgZ;
varying float vDz;
${COMP_GLSL}
void main() {
  vP = position.xy;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  vComp = mgComp(w.xyz);
  vec4 mv = viewMatrix * w;
  vMgZ = -mv.z;
  vec3 c = modelMatrix[3].xyz;
  vDz = dot(w.xyz - c, normalize(c - cameraPosition));
  gl_Position = projectionMatrix * mv;
}
`;
const HOLO_GLSL = `
uniform vec3 uIntf;
float holoScan(float y, float t) {
  float sy = y * 349.0 - t * 2.3;
  float fw = fwidth(sy);
  return 1.0 - 0.3 * (0.5 + 0.5 * sin(sy)) * (1.0 - smoothstep(0.8, 2.4, fw));
}
float holoIntf(float y) {
  float e = (y - uIntf.x) / max(uIntf.y, 1.0e-3);
  return exp(-e * e) * uIntf.z;
}
`;
const ORR_FRAG = `
uniform sampler2D uText;
uniform sampler2D uTrail;
uniform float uTime;
uniform float uAlpha;
uniform float uReveal;
uniform float uR0;
uniform float uDR;
uniform float uBandIn;
uniform float uBandOut;
uniform vec3 uRC[7];
uniform float uDim;
uniform float uSpin;
uniform vec4 uWave;
uniform vec4 uFlashR;
uniform vec4 uBeam;
uniform vec3 uTear;
uniform float uFlick;
uniform vec3 uN;
uniform float uZo[12];
uniform float uZa[12];
varying vec2 vP;
varying vec3 vW;
varying vec3 vComp;
varying float vDz;
${MG_SOFT_GLSL}
${NOISE_GLSL}
${HOLO_GLSL}
float aline(float d, float w, float pw) {
  float we = max(w, pw * 0.75);
  return clamp((we - d) / pw + 0.5, 0.0, 1.0) * (w / we);
}
void main() {
  float il = holoIntf(vP.y);
  vec2 p = vP + vec2(0.012 * il, 0.0);
  float r = length(p);
  float pw = max(fwidth(r), 1.0e-5);
  float phi = atan(p.y, p.x + 1.0e-7);
  float tear = (r > uTear.x && r < uTear.y) ? uTear.z : 0.0;
  float a01 = (phi + tear) / 6.2831853;
  float dMaj = abs(fract(a01 * 12.0 + 0.5) - 0.5) * (6.2831853 / 12.0) * r;
  float dMin = abs(fract(a01 * 36.0 + 0.5) - 0.5) * (6.2831853 / 36.0) * r;
  float tpw = max(fwidth(dMaj), 1.0e-5);
  float u = fract(-a01);
  float u2 = fract(-a01 + 0.5) - 0.5;
  float bandV = (r - uBandIn) / (uBandOut - uBandIn);
  float ux = dFdx(u);
  float u2x = dFdx(u2);
  float uy = dFdy(u);
  float u2y = dFdy(u2);
  vec2 gx = vec2(abs(ux) < abs(u2x) ? ux : u2x, dFdx(bandV) * 0.3125);
  vec2 gy = vec2(abs(uy) < abs(u2y) ? uy : u2y, dFdy(bandV) * 0.3125);
  float c12 = u * 12.0;
  int zc = int(clamp(floor(c12), 0.0, 11.0));
  bool zRot = uZo[zc] > 0.5;
  float ut = (zRot != !gl_FrontFacing) ? (floor(c12) + 1.0 - fract(c12)) / 12.0 : u;
  float vt = zRot ? 1.0 - bandV : bandV;
  float across = abs(p.x * uBeam.y - p.y * uBeam.x);
  float bpw = max(fwidth(across), 1.0e-5);
  float along = dot(p, uBeam.xy);
  float wd = length(p - uWave.xy) - uWave.z;
  vec3 col = vec3(0.0);
  float fi = clamp(floor((r - uR0) / uDR + 0.5), 0.0, 6.0);
  int ri = int(fi);
  float o = r - (uR0 + fi * uDR);
  float d = abs(o);
  float rev = smoothstep(fi * 0.085, fi * 0.085 + 0.3, uReveal);
  float lw = fi == 3.0 ? 0.0042 : 0.0019 + 0.0016 * fract(fi * 0.618 + 0.31);
  float mis = 0.0045 * smoothstep(0.25, 1.3, r) + 0.6 * pw;
  float lw2 = max(lw, pw * 0.65), pw2 = pw * 3.0;
  vec3 line = vec3(aline(abs(o - mis), lw2, pw2), aline(d, lw2, pw2), aline(abs(o + mis), lw2, pw2)) * 0.85;
  float halo = exp(-d / (0.02 + pw * 3.5)) * (0.1 + 0.12 * smoothstep(0.002, 0.012, pw));
  float majR = step(-0.001, o) * (1.0 - smoothstep(0.013, 0.02, o));
  float minR = step(-0.001, o) * (1.0 - smoothstep(0.006, 0.01, o));
  float ticks = aline(dMaj, 0.0021, tpw * 1.8) * majR + aline(dMin, 0.0013, tpw * 1.8) * minR * 0.5;
  float tr = texture2D(uTrail, vec2(a01, (fi + 0.5) / 8.0)).r;
  float trail = tr * (exp(-o * o / 1.2e-4) * 1.3 + exp(-d / 0.03) * 0.22);
  vec3 metal = mix(vec3(0.95, 0.62, 0.32), vec3(1.0, 0.84, 0.5), fract(fi * 0.37 + 0.2));
  col += (metal * (line * 1.5 + halo * 0.7) + mix(metal, vec3(0.45, 0.8, 1.0), 0.45) * halo * 0.45 + vec3(0.9, 0.72, 0.45) * ticks * 0.8) * rev;
  col += uRC[ri] * trail * 2.4 * rev;
  float spoke = aline(dMaj, 0.0011, tpw) * smoothstep(uR0 - 0.06, uR0 + 0.08, r) * (1.0 - smoothstep(uBandIn - 0.06, uBandIn - 0.01, r));
  col += vec3(0.8, 0.62, 0.38) * spoke * 0.07 * smoothstep(0.4, 0.9, uReveal);
  float inBand = step(0.0, bandV) * step(bandV, 1.0);
  vec2 tv = vec2(ut, 0.09375 + clamp(vt, 0.0, 1.0) * 0.3125), gxs = gx * 1.7, gys = gy * 1.7;
  vec3 s = textureGrad(uText, tv, gxs, gys).rgb * inBand;
  float sr = textureGrad(uText, tv + vec2(0.0009, 0.0), gxs, gys).r * inBand * uZa[zc];
  float sb = textureGrad(uText, tv - vec2(0.0009, 0.0), gxs, gys).r * inBand * uZa[zc];
  s.rg *= uZa[zc];
  s.b = textureGrad(uText, vec2(u, 0.09375 + clamp(bandV, 0.0, 1.0) * 0.3125), gx, gy).b * inBand;
  float bandRev = clamp((uReveal - 0.5) / 0.5, 0.0, 1.0);
  float ccw = fract(a01);
  float shown = max(1.0 - smoothstep(bandRev - 0.015, bandRev, ccw), step(0.999, bandRev));
  float head = exp(-abs(ccw - bandRev) * 90.0) * (1.0 - step(0.999, bandRev)) * step(0.001, bandRev) * inBand;
  float gf = smoothstep(0.12, 0.42, abs(dot(normalize(cameraPosition - vW), uN)));
  col += (vec3(1.5 * sr, 1.05 * s.r, 0.5 * sb) + vec3(0.8, 0.45, 0.15) * s.g * 0.5 + vec3(0.6, 0.5, 0.35) * s.b * 0.25) * shown * gf;
  col += vec3(1.2, 0.95, 0.6) * head * gf;
  float field = (1.0 - smoothstep(0.1, uBandOut, r)) * 0.016 + exp(-r * 6.0) * 0.02;
  col += vec3(0.3, 0.55, 0.62) * field * 0.7 * smoothstep(0.2, 0.7, uReveal);
  float fr = length(p - uFlashR.xy) - uFlashR.z;
  float fpw = max(fwidth(fr), 1.0e-5) * 2.5;
  vec3 fl = vec3(aline(abs(fr - mis), 0.0032, fpw), aline(abs(fr), 0.0032, fpw), aline(abs(fr + mis), 0.0032, fpw));
  float fwk = exp(-abs(fr) / 0.016) * 0.3 + exp(-max(-fr, 0.0) / 0.09) * step(fr, 0.0) * 0.12;
  col += (vec3(0.45, 0.9, 1.1) * fl * 2.6 + vec3(0.55, 0.85, 1.0) * fwk) * uFlashR.w;
  float shim = 0.84 + 0.3 * mgN(p * 5.0 + vec2(uTime * 0.31, -uTime * 0.23)) * (0.7 + 0.3 * mgN(p * 17.0 - uTime * 0.6));
  col *= holoScan(vP.y, uTime) * shim;
  col *= (1.0 - 0.38 * smoothstep(-0.3, 1.0, vDz)) * (1.0 - 0.32 * smoothstep(uBandIn - 0.15, uBandOut, r));
  col = col * (1.0 + 1.3 * il) + vec3(0.35, 0.7, 0.85) * il * 0.05 * (1.0 - smoothstep(uBandOut - 0.1, uBandOut, r));
  col += vec3(1.8, 1.4, 0.8) * (aline(across, 0.0028, bpw * 2.5) + 0.12 * exp(-across / 0.01)) * step(0.0, along) * (1.0 - smoothstep(uBandIn - 0.05, uBandIn, along)) * uBeam.z;
  float wv = exp(-wd * wd / 0.003) * uWave.w;
  col *= 1.0 + wv * 3.5;
  col += vec3(1.2, 0.95, 0.6) * wv * 0.3;
  float near = smoothstep(0.45, 1.3, length(cameraPosition - vW));
  col *= uAlpha * uFlick * (1.0 - 0.62 * uDim) * near * (1.0 - smoothstep(uBandOut + 0.02, uBandOut + 0.055, r));
  gl_FragColor = vec4(col * vComp * mgSoft(0.08), 1.0);
}
`;

const BODY_VERT = `
uniform vec4 uBP[9];
uniform float uBS[9];
uniform vec3 uSunDir;
uniform float uSunR;
attribute vec4 aB;
attribute vec3 aCol;
varying vec2 vUv;
varying float vKind;
varying vec3 vCol;
varying float vAmp;
varying vec3 vL;
varying vec2 vMoon;
varying vec3 vComp;
varying vec3 vRight;
varying vec3 vUp;
varying vec3 vBack;
varying float vSeed;
varying float vMgZ;
varying float vSy;
varying vec3 vRay;
uniform vec4 uScanAx;
${COMP_GLSL}
void main() {
  int i = int(aB.x + 0.5);
  vec4 bp = uBP[i];
  vKind = aB.y;
  vCol = aCol;
  vAmp = bp.w;
  vSeed = aB.w;
  vUv = position.xy;
  vec4 mv = viewMatrix * vec4(bp.xyz, 1.0);
  vL = normalize((viewMatrix * vec4(uSunDir, 0.0)).xyz);
  vRight = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vUp = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  vBack = vec3(viewMatrix[0][2], viewMatrix[1][2], viewMatrix[2][2]);
  vRay = normalize(bp.xyz - cameraPosition);
  vec4 mm = viewMatrix * vec4(uBP[1].xyz, 1.0);
  float zs = max(-mv.z, 1.0e-3);
  vMoon = (mm.xy / max(-mm.z, 1.0e-3) - mv.xy / zs) * zs / uSunR;
  vComp = mgComp(bp.xyz);
  vMgZ = -mv.z;
  if (bp.w < 1.0e-4 || mv.z > -0.05) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    return;
  }
  float grow = aB.y < 1.5 ? max(1.0, zs / 3.5) : 1.0;
  mv.xy += position.xy * aB.z * uBS[i] * grow;
  vSy = dot(bp.xyz, uScanAx.xyz) - uScanAx.w + (dot(vRight, uScanAx.xyz) * position.x + dot(vUp, uScanAx.xyz) * position.y) * aB.z * uBS[i] * grow;
  gl_Position = projectionMatrix * mv;
}
`;
const BODY_FRAG = `
uniform float uTime;
uniform float uAlpha;
uniform float uEcl;
uniform float uCorona;
uniform float uBead;
uniform float uMoonDark;
uniform float uUmbra;
uniform vec3 uAxis;
uniform float uSunK;
uniform vec3 uMoonLV;
uniform float uMoonLK;
uniform vec3 uN;
varying vec2 vUv;
varying float vKind;
varying vec3 vCol;
varying float vAmp;
varying vec3 vL;
varying vec2 vMoon;
varying vec3 vComp;
varying vec3 vRight;
varying vec3 vUp;
varying vec3 vBack;
varying float vSeed;
varying float vSy;
varying vec3 vRay;
${NOISE_GLSL}
${MG_SOFT_GLSL}
${HOLO_GLSL}
vec3 mgSpin(vec3 v, vec3 k, float a) {
  float c = cos(a);
  float s = sin(a);
  return v * c + cross(k, v) * s + k * dot(k, v) * (1.0 - c);
}
vec3 orrMoon(vec2 q) {
  float rr = length(q) * 2.0;
  vec3 c = vec3(0.8, 0.86, 1.0) * exp(-max(rr - 1.0, 0.0) * 5.0) * 0.5 * (1.0 - smoothstep(1.4, 2.0, rr));
  float disc = 1.0 - smoothstep(0.9, 1.06, rr);
  if (disc > 0.0) {
    float r1 = min(rr, 0.999);
    vec3 n = vec3(q * 2.0 * (r1 / max(rr, 1.0e-4)), sqrt(max(0.0, 1.0 - r1 * r1)));
    vec3 nw = n.x * vRight + n.y * vUp + n.z * vBack;
    float maria = smoothstep(0.45, 0.72, mgN3(nw * 3.1 + 5.0));
    float lit = smoothstep(-0.04, 0.12, dot(n, normalize(mix(vL, uMoonLV, uMoonLK)))) * (1.0 - uMoonDark);
    vec3 m = vec3(0.93, 0.95, 1.0) * (1.0 - 0.38 * maria) * lit * 3.2 + vec3(0.07, 0.15, 0.2) * (1.0 - lit) * 0.7;
    m += vec3(0.75, 0.88, 1.0) * pow(1.0 - n.z, 4.0) * (0.25 + 0.6 * uMoonDark);
    c = mix(c, m, disc);
  }
  return c;
}
void main() {
  vec2 q = vUv;
  float r = length(q);
  if (r > 1.0) discard;
  vec3 col = vec3(0.0);
  if (vKind < 0.5) {
    float rr = r * 2.0;
    if (rr < 1.0) {
      vec3 n = vec3(q * 2.0, sqrt(max(0.0, 1.0 - rr * rr)));
      vec3 nw = mgSpin(n.x * vRight + n.y * vUp + n.z * vBack, uAxis, uTime * 0.3);
      float land = smoothstep(0.5, 0.58, mgN3(nw * 2.2 + 1.7) * 0.7 + mgN3(nw * 5.3) * 0.3);
      float cloud = smoothstep(0.58, 0.8, mgN3(nw * 4.1 + vec3(uTime * 0.04, 0.0, 0.0)));
      float day = smoothstep(-0.2, 0.35, dot(n, vL));
      vec3 base = mix(vec3(0.03, 0.30, 0.55), vec3(0.18, 0.56, 0.32), land);
      base = mix(base, vec3(0.9, 0.97, 1.0), cloud * 0.4);
      vec3 dl = n - vL;
      float umbra = exp(-dot(dl, dl) * 45.0) * uUmbra;
      float fres = pow(1.0 - n.z, 2.5);
      col = base * (0.3 + 1.5 * day) * (1.0 - 0.85 * umbra) + vec3(0.35, 1.0, 1.15) * fres * 1.7;
    } else {
      float h = rr - 1.0;
      col = vec3(0.22, 0.8, 1.0) * (exp(-h * 9.0) * 0.9 + exp(-h * 3.0) * 0.12) * (1.0 - smoothstep(0.7, 1.0, r));
    }
  } else if (vKind < 1.5) {
    vec2 dq = vec2(0.03, 0.0);
    col = vec3(orrMoon(q + dq).r, orrMoon(q).g, orrMoon(q - dq).b) * (1.0 - smoothstep(0.7, 1.0, r));
  } else if (vKind < 2.5) {
    float rd = r / uSunK;
    vec2 mo = q / uSunK - vMoon;
    float occ = (1.0 - smoothstep(1.0, 1.04, length(mo) / 1.035)) * uEcl;
    float disc = 1.0 - smoothstep(0.93, 1.0, rd);
    float limb = 1.0 - 0.4 * min(rd * rd, 1.0);
    float ang = atan(q.y, q.x + 1.0e-6);
    float rays = pow(abs(cos(ang * 6.0 + uTime * 0.12)), 22.0) * 0.8 + pow(abs(cos(ang * 5.0 - uTime * 0.09 + 0.7)), 36.0) * 0.6;
    float rf = exp(-max(rd - 1.0, 0.0) * 0.5) * smoothstep(0.9, 1.7, rd);
    float glow = exp(-rd * 1.1) * 0.9 + exp(-rd * 0.35) * 0.1;
    float hide = uEcl * (1.0 - smoothstep(0.3, 2.0, length(vMoon)));
    col = vec3(1.0, 0.86, 0.62) * disc * limb * 11.0 * (1.0 - occ);
    col += vec3(1.0, 0.7, 0.3) * (glow * 2.2 + rays * rf * 1.5) * (1.0 - 0.88 * hide);
    vec2 cs = vec2(cos(ang), sin(ang));
    float st = mgN(cs * 3.0 + 7.0) * 0.6 + mgN(cs * 9.0 + 3.0) * 0.4;
    float rc = max(rd - 1.0, 0.0);
    float cor = (exp(-rc * 1.3) * (0.25 + 1.3 * st * st) + exp(-rc * 7.0) * 1.2) * smoothstep(0.97, 1.06, rd);
    col += vec3(0.92, 0.96, 1.05) * cor * uCorona * 3.0;
    float xc = (rd - 1.035) / 0.03;
    col += vec3(1.0, 0.25, 0.45) * exp(-xc * xc) * uCorona * 1.8;
    vec2 bq = q / uSunK - vec2(0.64, 0.77);
    float bd = dot(bq, bq);
    col += vec3(1.0, 0.97, 0.9) * (exp(-bd * 50.0) * 28.0 + exp(-sqrt(bd) * 2.0) * 1.2 + exp(-abs(bq.y) * 30.0) * exp(-abs(bq.x) * 0.9) * 2.0) * uBead;
    col *= 1.0 - smoothstep(0.75, 1.0, r);
  } else if (vKind < 3.5) {
    float tw = 0.85 + 0.15 * sin(uTime * (2.0 + vSeed * 3.0) + vSeed * 20.0);
    float core = exp(-r * r * 90.0) * 5.0 + exp(-r * r * 14.0) * 0.55 + exp(-r * 5.0) * 0.1;
    float star = (exp(-abs(q.y) * 70.0) * exp(-abs(q.x) * 6.0) + exp(-abs(q.x) * 70.0) * exp(-abs(q.y) * 6.0)) * 0.3;
    col = vCol * (core + star) * tw;
    if (vSeed > 0.9) {
      vec3 w = q.x * vRight + q.y * vUp;
      float bn = dot(vRay, uN);
      bn = (bn < 0.0 ? -1.0 : 1.0) * max(abs(bn), 0.12);
      float e = (length(w - vRay * (dot(w, uN) / bn)) - 0.36) / 0.025;
      col += vCol * exp(-e * e) * 0.8;
    }
    col *= 1.0 - smoothstep(0.7, 1.0, r);
  } else {
    float g = exp(-r * r * 7.0) * 4.0 + exp(-r * 3.0) * 0.45;
    float streak = exp(-abs(q.y) * 55.0) * (1.0 - abs(q.x)) * 2.2;
    col = vec3(1.0, 0.84, 0.58) * (g + streak);
    col *= 1.0 - smoothstep(0.8, 1.0, r);
  }
  col *= holoScan(vSy, uTime) * (1.0 + 1.3 * holoIntf(vSy));
  gl_FragColor = vec4(col * vAmp * uAlpha * vComp * mgSoft(0.08), 1.0);
}
`;

function fontReady() {
  try { return !!(document.fonts && document.fonts.check('700 40px "GFS Neohellenic"', 'ΑΣ')); } catch (e) { return false; }
}

function spacedText(g, text, x, y, size, sp, stroke = false) {
  g.font = `700 ${size}px ${FONT_GR}`;
  let total = sp * (text.length - 1);
  for (let i = 0; i < text.length; i++) total += g.measureText(text[i]).width;
  let cx = x - total / 2;
  for (let i = 0; i < text.length; i++) {
    const w = g.measureText(text[i]).width;
    if (stroke) g.strokeText(text[i], cx + w / 2, y);
    else g.fillText(text[i], cx + w / 2, y);
    cx += w + sp;
  }
}

function drawAtlas(g) {
  const W = ATLAS_W, H = ATLAS_H, sector = W / 12;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = 'source-over';
  g.shadowColor = 'rgba(0,0,0,0)';
  g.shadowBlur = 0;
  g.shadowOffsetX = 0;
  g.shadowOffsetY = 0;
  g.fillStyle = '#000';
  g.fillRect(0, 0, W, H);
  g.globalCompositeOperation = 'lighter';
  g.textAlign = 'center';
  g.textBaseline = 'alphabetic';
  g.font = `700 100px ${FONT_GR}`;
  let widest = 1;
  for (const name of ZODIAC) {
    let w = 14 * (name.length - 1);
    for (let i = 0; i < name.length; i++) w += g.measureText(name[i]).width;
    widest = Math.max(widest, w);
  }
  const size = Math.max(20, Math.min(46, Math.floor((100 * sector * 0.8) / widest)));
  const sp = size * 0.14;
  const vline = (x, y0, y1) => {
    g.fillRect(x - 1.25, y0, 2.5, y1 - y0);
    if (x < 2) g.fillRect(x - 1.25 + W, y0, 2.5, y1 - y0);
  };
  const diamond = (x, y, h) => {
    g.beginPath();
    g.moveTo(x, y - h); g.lineTo(x + h, y); g.lineTo(x, y + h); g.lineTo(x - h, y);
    g.closePath();
    g.fill();
  };
  for (let row = 0; row < 2; row++) {
    const R = row ? ROW_B : ROW_A;
    g.fillStyle = 'rgb(0,0,255)';
    g.fillRect(0, R.top + 1.75, W, 2.5);
    g.fillRect(0, R.bot - 4.25, W, 2.5);
    for (let k = 0; k < 72; k++) {
      const x = (k / 72) * W;
      const len = k % 6 === 0 ? 13 : 6;
      vline(x, R.bot - 3 - len, R.bot - 3);
      if (!row) vline(x, R.top + 3, R.top + 3 + len * 0.6);
    }
    for (let s = 0; s < 12; s++) {
      const x = s * sector;
      if (row) vline(x, R.top + 3, R.bot - 3);
      else { diamond(x, R.mid, 7); if (s === 0) diamond(W, R.mid, 7); }
    }
    const base = R.mid + size * 0.35;
    for (let s = 0; s < 12; s++) {
      const x = row ? (1 - (s * 30 + 15) / 360) * W : (s + 0.5) * sector;
      g.save();
      g.shadowColor = 'rgb(0,255,0)';
      g.shadowBlur = 12;
      g.shadowOffsetX = 20000;
      g.fillStyle = 'rgb(0,255,0)';
      spacedText(g, ZODIAC[s], x - 20000, base, size, sp);
      g.restore();
      if (row) {
        g.fillStyle = 'rgb(255,0,0)';
        spacedText(g, ZODIAC[s], x, base, size, sp);
      } else {
        g.fillStyle = 'rgb(95,0,0)';
        spacedText(g, ZODIAC[s], x, base, size, sp);
        g.strokeStyle = 'rgb(255,0,0)';
        g.lineWidth = 1.7;
        g.lineJoin = 'round';
        spacedText(g, ZODIAC[s], x, base, size, sp, true);
      }
    }
  }
}

function makeAtlas() {
  const canvas = document.createElement('canvas');
  canvas.width = ATLAS_W;
  canvas.height = ATLAS_H;
  const g = canvas.getContext('2d');
  const ready = fontReady();
  drawAtlas(g);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.NoColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  return { canvas, g, tex, ready };
}

const ix = (H, n, L) => (H - (n - 1 - L) + 2 * RIB_HIST) % RIB_HIST;
const cr = (p0, p1, p2, p3, u) => {
  const u2 = u * u, u3 = u2 * u;
  return 0.5 * (2 * p1 + (p2 - p0) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u2 + (3 * p1 - p0 - 3 * p2 + p3) * u3);
};

class Magic {
  constructor(scene, { quality = 1 } = {}) {
    this.scene = scene;
    this.q = clamp$2(Number(quality) || 1, 0.25, 1);
    this.root = new THREE.Group();
    this.root.name = 'magic';
    this.root.visible = false;
    scene.add(this.root);

    this.now = 0;
    this.begun = false;
    this.disposed = false;
    this.M = new THREE.Vector3(0, -1e3, 0);
    this.yaw = 0;
    this.hy = 1.0;
    this.floorY = -20;
    this.axX = new THREE.Vector3(1, 0, 0);
    this.axZ = new THREE.Vector3(0, 0, 1);
    this.C = new THREE.Vector3();
    this.nS = new THREE.Vector3(0, -1, 0);
    this.ex = new THREE.Vector3(1, 0, 0);
    this.ey = new THREE.Vector3(0, 0, 1);
    this.sunDir = new THREE.Vector3(1, 0, 0);
    this.sunW = new THREE.Vector3();
    this.moonLine = new THREE.Vector3(0, 1, 0);
    this.moonPin = 0;
    this.moonFrom = null;
    this.lonOff = 0;
    this._pm = new THREE.Vector3();
    this._pq = new THREE.Vector3();
    this._a = new THREE.Vector3();
    this._b = new THREE.Vector3();
    this._sm = new THREE.Vector3();
    this._v2 = new THREE.Vector2();

    this.charge = 0; this.chargeS = 0; this.level = 0;
    this.beginHold = false; this.beginEnv = 0;
    this.spin = 0; this.spinS = 0;
    this.seatPulse = 0; this.flare = 0;
    this.phase = 0; this.rise = 0; this.runeSpin = 0;

    this.uTime = { value: 0 };
    this.uPx = { value: 900 };
    this.comp = {
      uBoxC: { value: new THREE.Vector3(0, -1e3, 0) },
      uBoxH: { value: new THREE.Vector3(0.8, 1.05, 0.6) },
      uBoxCS: { value: new THREE.Vector2(1, 0) },
      uFloorY: { value: -20 },
      uMgAbs: { value: new THREE.Vector3(0.26, 0.056, 0.043) },
      uPostFog: { value: 0 },
    };
    this.postU = {
      uPostFog: { value: 1 }, tSceneDepth: WATER.tSceneDepth,
      uMgRes: { value: new THREE.Vector2(2, 2) }, uMgProjZ: { value: new THREE.Vector2(-1, -0.1) },
    };
    this._fxBR = (renderer, sc, camera) => {
      const rt = renderer.getRenderTarget();
      if (rt) this.postU.uMgRes.value.set(rt.width, rt.height);
      else renderer.getDrawingBufferSize(this.postU.uMgRes.value);
      const pe = camera.projectionMatrix.elements;
      this.postU.uMgProjZ.value.set(pe[10], pe[14]);
    };
    this.capAmb = { uCapLo: { value: new THREE.Vector3(0.9, 0.5, 0.45) }, uCapHi: { value: new THREE.Vector3(1.8, 1.0, 0.9) } };
    const hi = { value: new THREE.Vector3(2.2, 1.1, 1.0) };
    this.capOrr = { uCapLo: hi, uCapHi: hi };
    this._setPx = (renderer, sc, camera) => {
      const rt = renderer.getRenderTarget();
      const h = rt ? rt.height : renderer.getDrawingBufferSize(this._v2).y;
      this.uPx.value = 0.5 * h * camera.projectionMatrix.elements[5];
    };

    this.atlas = makeAtlas();
    this._buildMotes();
    this._buildSparks();
    this._buildPulses();
    this._buildShaft();
    this._buildRune();
    this._buildRibbons();
    this._buildOrrery();
  }

  _mat(vertexShader, fragmentShader, uniforms, extra = {}, orr = false) {
    return new THREE.ShaderMaterial(Object.assign({
      uniforms: Object.assign({}, this.comp, orr ? this.capOrr : this.capAmb, uniforms),
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }, extra));
  }

  _add(obj, order) {
    obj.renderOrder = order;
    obj.visible = false;
    this.root.add(obj);
    return obj;
  }

  _addFx(obj, order) {
    obj.renderOrder = order;
    obj.visible = false;
    obj.onBeforeRender = this._fxBR;
    FX_SCENE.add(obj);
    return obj;
  }

  _buildMotes() {
    const N = Math.round(3200 * this.q);
    const seed = new Float32Array(N * 4), kind = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const loose = Math.random() < 0.3;
      const u1 = Math.max(Math.random(), 1e-6), u2 = Math.random();
      const gauss = Math.sqrt(-2 * Math.log(u1)) * Math.cos(TAU$1 * u2);
      seed[i * 4] = Math.pow(Math.random(), 0.85);
      seed[i * 4 + 1] = Math.random();
      seed[i * 4 + 2] = loose ? Math.random() * TAU$1 : (i % 3) * (TAU$1 / 3) + gauss * 0.32;
      seed[i * 4 + 3] = Math.random();
      const bokeh = Math.random() < 0.02;
      kind[i * 3] = bokeh ? 0.04 + Math.random() * 0.035 : 0.008 + Math.random() * Math.random() * 0.016;
      kind[i * 3 + 1] = Math.random();
      kind[i * 3 + 2] = bokeh ? 0.14 + Math.random() * 0.12 : 2.0 + Math.random() * 1.8;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
    g.setAttribute('aKind', new THREE.BufferAttribute(kind, 3));
    this.moteU = {
      uTime: this.uTime, uPx: this.uPx,
      uPhase: { value: 0 }, uRise: { value: 0 }, uLevel: { value: 0 }, uBright: { value: 0 },
      uCenter: { value: new THREE.Vector3() }, uBottom: { value: 0 }, uHeight: { value: 5 },
      uRIn: { value: 1 }, uROut: { value: 2.3 }, uHeroR: { value: 1 },
    };
    this.motes = this._add(new THREE.Points(g, this._mat(MOTE_VERT, MOTE_FRAG, this.moteU)), 9);
    this.motes.frustumCulled = false;
    this.motes.onBeforeRender = this._setPx;
  }

  _buildSparks() {
    const N = Math.max(400, Math.round(1100 * this.q));
    const info = new Float32Array(N * 4);
    for (let i = 0; i < N; i++) { info[i * 4] = -1e4; info[i * 4 + 1] = 1; }
    const dyn = (arr, n) => new THREE.BufferAttribute(arr, n).setUsage(THREE.DynamicDrawUsage);
    this.spPos = dyn(new Float32Array(N * 3), 3);
    this.spVel = dyn(new Float32Array(N * 3), 3);
    this.spInfo = dyn(info, 4);
    this.spCol = dyn(new Float32Array(N * 3), 3);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', this.spPos);
    g.setAttribute('aVel', this.spVel);
    g.setAttribute('aInfo', this.spInfo);
    g.setAttribute('aCol', this.spCol);
    this.spN = N; this.spHead = 0; this.spUntil = -1; this.spDirty = false;
    this.sparks = this._add(new THREE.Points(g, this._mat(SPARK_VERT, SPARK_FRAG, { uNow: this.uTime, uPx: this.uPx })), 11);
    this.sparks.frustumCulled = false;
    this.sparks.onBeforeRender = this._setPx;
  }

  _buildPulses() {
    const N = 24;
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]), 3));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    const t = new Float32Array(N * 4);
    for (let i = 0; i < N; i++) { t[i * 4] = -1e4; t[i * 4 + 1] = 1; }
    this.puP = new THREE.InstancedBufferAttribute(new Float32Array(N * 4), 4).setUsage(THREE.DynamicDrawUsage);
    this.puT = new THREE.InstancedBufferAttribute(t, 4).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('aP', this.puP);
    g.setAttribute('aT', this.puT);
    g.instanceCount = N;
    this.puN = N; this.puHead = 0; this.puUntil = -1;
    this.pulseU = { uNow: this.uTime, uAxX: { value: new THREE.Vector3(1, 0, 0) }, uAxY: { value: new THREE.Vector3(0, 1, 0) } };
    this.pulses = this._add(new THREE.Mesh(g, this._mat(PULSE_VERT, PULSE_FRAG, this.pulseU, { side: THREE.DoubleSide })), 11);
    this.pulses.frustumCulled = false;
  }

  _buildShaft() {
    const geo = new THREE.CylinderGeometry(0.55, 1.9, 20, 48, 20, true);
    geo.translate(0, 10, 0);
    this.shaftU = {
      uTime: this.uTime, uAlpha: { value: 0 },
      uColLo: { value: new THREE.Vector3(1.0, 0.8, 0.46) }, uColHi: { value: new THREE.Vector3(0.55, 0.9, 1.0) },
      uFadeV: { value: new THREE.Vector4(0.012, 0.05, 0.3, 0.92) },
      uFlow: { value: new THREE.Vector2(0.35, -0.08) }, uStreakF: { value: 36 }, uMote: { value: 0 }, uFill: { value: 0 },
    };
    this.shaft = this._add(new THREE.Mesh(geo, this._mat(CONE_VERT, CONE_FRAG, this.shaftU, { side: THREE.DoubleSide })), 7);
  }

  _buildRune() {
    const geo = new THREE.CylinderGeometry(1, 1, 1, 160, 1, true);
    this.runeU = { uTex: { value: this.atlas.tex }, uTime: this.uTime, uAlpha: { value: 0 }, uSpin: { value: 0 }, uRC: { value: new THREE.Vector3() } };
    this.rune = this._add(new THREE.Mesh(geo, this._mat(RUNE_VERT, RUNE_FRAG, this.runeU, { side: THREE.DoubleSide })), 9);
    this.rune.rotation.order = 'ZXY';
  }

  _buildRibbons() {
    const S = RIB_SLOTS, SEG = RIB_SEG, VPS = SEG * 2;
    const pos = new Float32Array(S * VPS * 3);
    const uv = new Float32Array(S * VPS * 3);
    const col = new Float32Array(S * VPS * 4);
    const idx = new Uint16Array(S * (SEG - 1) * 6);
    let k = 0;
    for (let s = 0; s < S; s++) {
      const seed = Math.random();
      for (let j = 0; j < SEG; j++) {
        for (let side = 0; side < 2; side++) {
          const v = (s * VPS + j * 2 + side) * 3;
          uv[v] = j / (SEG - 1); uv[v + 1] = side ? 1 : -1; uv[v + 2] = seed;
          pos[v + 1] = -1e3;
        }
        if (j < SEG - 1) {
          const a = s * VPS + j * 2;
          idx[k++] = a; idx[k++] = a + 2; idx[k++] = a + 1;
          idx[k++] = a + 1; idx[k++] = a + 2; idx[k++] = a + 3;
        }
      }
    }
    const g = new THREE.BufferGeometry();
    this.rbPos = new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.rbCol = new THREE.BufferAttribute(col, 4).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.rbPos);
    g.setAttribute('aUv', new THREE.BufferAttribute(uv, 3));
    g.setAttribute('aCol', this.rbCol);
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    this.ribbons = this._add(new THREE.Mesh(g, this._mat(RIB_VERT, RIB_FRAG, { uTime: this.uTime }, { side: THREE.DoubleSide })), 10);
    this.ribbons.frustumCulled = false;
    this.slots = [];
    for (let s = 0; s < S; s++) {
      this.slots.push({
        i: s, key: null, used: false, active: false, n: 0, head: -1, lastCommit: -1e9, fade: 0, cleared: true,
        px: new Float32Array(RIB_HIST), py: new Float32Array(RIB_HIST), pz: new Float32Array(RIB_HIST), pt: new Float64Array(RIB_HIST),
        cr: RIB_COL[0], cg: RIB_COL[1], cb: RIB_COL[2], speed: 0, shed: 0,
      });
    }
    this.slotByKey = new Map();
    this.rbPts = new Float32Array(SEG * 3);
    this.rbAge = new Float32Array(SEG);
  }

  _buildOrrery() {
    this.trF = new Float32Array(TRAIL_N * 8);
    this.trB = new Uint8Array(TRAIL_N * 8);
    this.trLive = false;
    const tt = new THREE.DataTexture(this.trB, TRAIL_N, 8, THREE.RedFormat, THREE.UnsignedByteType);
    tt.wrapS = THREE.RepeatWrapping;
    tt.wrapT = THREE.ClampToEdgeWrapping;
    tt.minFilter = THREE.LinearFilter;
    tt.magFilter = THREE.LinearFilter;
    tt.generateMipmaps = false;
    tt.needsUpdate = true;
    this.trTex = tt;

    this.orrU = {
      uText: { value: this.atlas.tex }, uTrail: { value: tt }, uTime: this.uTime,
      uAlpha: { value: 0 }, uReveal: { value: 0 }, uR0: { value: ORR.r0 }, uDR: { value: ORR.dr },
      uBandIn: { value: ORR.bandIn }, uBandOut: { value: ORR.bandOut },
      uRC: { value: RING_COL.map((c) => new THREE.Vector3(c[0], c[1], c[2])) },
      uDim: { value: 0 }, uSpin: { value: 0 }, uWave: { value: new THREE.Vector4() }, uFlashR: { value: new THREE.Vector4() }, uBeam: { value: new THREE.Vector4(1, 0, 0, 0) },
      uTear: { value: new THREE.Vector3() }, uFlick: { value: 1 }, uN: { value: new THREE.Vector3(0, 0, 1) },
      uZo: { value: new Float32Array(12) }, uZa: { value: new Float32Array(12).fill(1) },
      uIntf: { value: new THREE.Vector3(0, 0.01, 0) },
    };
    const disc = new THREE.RingGeometry(0.002, ORR.disc, 160, 12);
    this.orrDisc = this._addFx(new THREE.Mesh(disc, this._mat(ORR_VERT, ORR_FRAG, Object.assign({}, this.orrU, this.postU), { side: THREE.DoubleSide, depthTest: false }, true)), 10);
    this.orrDisc.matrixAutoUpdate = false;

    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]), 3));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    const B = new Float32Array(BODIES.length * 4), Cl = new Float32Array(BODIES.length * 3);
    BODIES.forEach(([kind, half, seed, c], i) => {
      B[i * 4] = i; B[i * 4 + 1] = kind; B[i * 4 + 2] = half; B[i * 4 + 3] = seed;
      Cl[i * 3] = c[0]; Cl[i * 3 + 1] = c[1]; Cl[i * 3 + 2] = c[2];
    });
    g.setAttribute('aB', new THREE.InstancedBufferAttribute(B, 4));
    g.setAttribute('aCol', new THREE.InstancedBufferAttribute(Cl, 3));
    g.instanceCount = BODIES.length;
    this.bodyU = {
      uTime: this.uTime, uAlpha: { value: 0 },
      uBP: { value: BODIES.map(() => new THREE.Vector4(0, -1e3, 0, 0)) },
      uBS: { value: BODIES.map(() => 1) },
      uSunDir: { value: new THREE.Vector3(1, 0, 0) }, uSunR: { value: ORR.sunR }, uSunK: { value: ORR.sunR / BODIES[2][1] },
      uEcl: { value: 0 }, uCorona: { value: 0 }, uBead: { value: 0 }, uMoonDark: { value: 0 }, uUmbra: { value: 0 },
      uAxis: { value: new THREE.Vector3(0, 1, 0) },
      uMoonLV: { value: new THREE.Vector3(0, 0, 1) }, uMoonLK: { value: 0 }, uIntf: this.orrU.uIntf, uN: this.orrU.uN,
      uScanAx: { value: new THREE.Vector4(0, 1, 0, 0) },
    };
    this.bodies = this._addFx(new THREE.Mesh(g, this._mat(BODY_VERT, BODY_FRAG, Object.assign({}, this.bodyU, this.postU), { depthTest: false }, true)), 11);
    this.bodies.frustumCulled = false;

    const bg = new THREE.CylinderGeometry(BEAM.r1, BEAM.r0, 1, 48, 1, false);
    bg.translate(0, 0.5, 0);
    this.beamU = {
      uTime: this.uTime, uAlpha: { value: 0 },
      uColLo: { value: new THREE.Vector3(1.0, 0.74, 0.4) }, uColHi: { value: new THREE.Vector3(0.45, 0.88, 1.0) },
      uApex: { value: new THREE.Vector3(0, -1e3, 0) }, uAxis: { value: new THREE.Vector3(0, 1, 0) },
      uK: { value: 1 }, uY: { value: new THREE.Vector2(0, 1) },
    };
    this.beam = this._addFx(new THREE.Mesh(bg, this._mat(BEAM_VERT, BEAM_FRAG, Object.assign({}, this.beamU, this.postU), { side: THREE.BackSide, depthTest: false })), 9);
    this.beam.frustumCulled = false;

    this.orrOn = false; this.orrT = 0; this.orrVis = 0;
    this._nd = new THREE.Vector3();
    this._nw = new THREE.Vector3();
    this.lon = new Float32Array([0, 50, 100, 150, 210, 270, 320]);
    this.prevLon = new Float32Array(7);
    this.omega = new Float32Array(7);
    this.skyMonths = 0; this.prevMonths = 0; this.skyFresh = false; this.skyInit = false;
    this.alignT = -1; this.flashDone = false;
    this.wave = { on: false, age: 0, s0: 0, speed: 1.9, cx: 0, cy: 0 };
    this.glitchT = 4; this.glitchLeft = 0;
  }

  begin(M, yaw = 0, size) {
    if (this.disposed || !M) return;
    this.now = U.uTime.value;
    this.begun = true;
    this.M.copy(M);
    this.yaw = yaw;
    const c = Math.cos(yaw), s = Math.sin(yaw);
    this.axX.set(c, 0, -s);
    this.axZ.set(s, 0, c);
    const sx = size ? Math.abs(size.x) : 1.5, sy = size ? Math.abs(size.y) : 2.0, sz = size ? Math.abs(size.z) : 1.0;
    this.hy = Math.max(sy, 0.8) * 0.5;
    const hw = Math.max(Math.max(sx, sz), 0.8) * 0.5;
    const hd = Math.max(Math.min(sx, sz), 0.5) * 0.5;
    const halfDiag = Math.hypot(hw, hd);
    let fy = NaN;
    try { fy = floorHeight(M.x, M.z); } catch (e) {  }
    this.floorY = Number.isFinite(fy) && fy < M.y ? fy : M.y - this.hy - 0.95;
    const cu = this.comp;
    cu.uBoxC.value.copy(M);
    cu.uBoxH.value.set(hw + 0.1, this.hy + 0.06, hd + 0.1);
    cu.uBoxCS.value.set(c, s);
    cu.uFloorY.value = this.floorY;
    const runeR = Math.max(1.22, halfDiag + 0.34);
    const mu = this.moteU;
    mu.uCenter.value.copy(M);
    mu.uBottom.value = this.floorY + 0.04;
    mu.uHeight.value = M.y + this.hy + 2.2 - mu.uBottom.value;
    mu.uRIn.value = halfDiag + 0.14;
    mu.uHeroR.value = Math.max(hw, this.hy) + 0.15;
    mu.uROut.value = runeR + 1.0;
    this.rune.scale.set(runeR, BAND_K * runeR, runeR);
    this.rune.position.set(M.x, M.y + this.hy + RUNE_LIFT, M.z);
    const sw = Math.max(1, (runeR + 0.55) / 1.75);
    this.shaft.scale.set(sw, 1, sw);
    this.shaft.position.set(M.x, this.floorY - 0.25, M.z);
    this.pulseU.uAxX.value.copy(this.axX);
    this.beam.position.set(M.x, M.y + this.hy + 0.02, M.z);
    const bh = Math.max(0.2, ORR.lift - 0.02);
    this.beam.scale.set(1, bh, 1);
    this.beam.updateMatrixWorld(true);
    const ya = (BEAM.r0 * bh) / (BEAM.r1 - BEAM.r0);
    this.beamU.uApex.value.set(M.x, M.y + this.hy + 0.02 - ya, M.z);
    this.beamU.uK.value = ((BEAM.r1 - BEAM.r0) / bh) ** 2;
    this.beamU.uY.value.set(ya, ya + bh);
    if (!this.atlas.ready && fontReady()) {
      this.atlas.ready = true;
      drawAtlas(this.atlas.g);
      this.atlas.tex.needsUpdate = true;
    }
    this.charge = this.chargeS = 0;
    this.beginHold = true;
    this.beginEnv = 0;
    this.spin = this.spinS = 0;
    this.orrOn = false;
    this.orrT = 0;
    this.alignT = -1;
    this.flashDone = false;
    this.moonLift = 0;
    this.moonHand = 0;
    this.moonPin = 0;
    this.moonFrom = null;
    this.lonOff = 0;
    this.bodyU.uMoonLK.value = 0;
    this.facing = null;
    this.wave.on = false;
    this.skyInit = false;
    this.trF.fill(0);
    this.trB.fill(0);
    this.trTex.needsUpdate = true;
    this.trLive = false;
    for (let i = 0; i < this.slots.length; i++) this._release(this.slots[i]);
    this.root.visible = true;
  }

  seat(pos, strength = 1, radius = 0) {
    if (this.disposed || !pos) return;
    this.now = Math.max(this.now, U.uTime.value);
    const s = clamp$2(Number(strength) || 0, 0, 1.5);
    this._pulse(pos, 1, 0.28 + 0.15 * s, 0.12 + 0.22 * s, s * 0.7);
    const R = Number(radius) > 0 ? Number(radius) : 0.05 + 0.1 * s;
    this._pulse(pos, 2, 0.55 + 0.2 * s, R, 0.5 + 0.5 * s);
    const n = Math.round((6 + 12 * s) * (0.5 + 0.5 * this.q));
    const X = this.axX, Z = this.axZ;
    for (let i = 0; i < n; i++) {
      const th = Math.random() * TAU$1;
      const cs = Math.cos(th), sn = Math.sin(th), f = Math.random() * 0.8 - 0.2;
      let dx = X.x * cs + Z.x * f + (Math.random() - 0.5) * 0.3;
      let dy = sn + (Math.random() - 0.5) * 0.3;
      let dz = X.z * cs + Z.z * f + (Math.random() - 0.5) * 0.3;
      const sp = ((0.25 + Math.random() * 0.55) * (0.7 + 0.4 * s)) / (Math.sqrt(dx * dx + dy * dy + dz * dz) || 1);
      dx *= sp; dy *= sp; dz *= sp;
      if (Math.random() < 0.7) this._spark(pos, dx, dy, dz, 0.9 + Math.random() * 0.9, 0.005 + Math.random() * 0.008, 1.05, 0.78, 0.4);
      else this._spark(pos, dx * 0.6, dy * 0.6 + 0.12, dz * 0.6, 1.2 + Math.random() * 1.0, 0.005 + Math.random() * 0.006, 0.55, 0.7, 0.8);
    }
    this.seatPulse = Math.max(this.seatPulse, Math.min(1, s));
    this.root.visible = true;
  }

  trail(key, pos, active = true, color) {
    if (this.disposed) return;
    let sl = this.slotByKey.get(key);
    if (!active) { if (sl) sl.active = false; return; }
    if (!pos) return;
    this.now = Math.max(this.now, U.uTime.value);
    if (!sl) {
      sl = this._freeSlot();
      sl.key = key; sl.used = true; sl.n = 0; sl.head = -1; sl.lastCommit = -1e9;
      this.slotByKey.set(key, sl);
    }
    const t = this.now;
    if (sl.n > 0) {
      const h = sl.head;
      const dx = pos.x - sl.px[h], dy = pos.y - sl.py[h], dz = pos.z - sl.pz[h];
      if ((!sl.active && t - sl.pt[h] > RIB_WIN) || dx * dx + dy * dy + dz * dz > 4) sl.n = 0;
    }
    sl.active = true;
    sl.fade = 1;
    sl.cleared = false;
    const c = color || RIB_COL, cm = Math.max(c[0], c[1], c[2]), ck = cm > 1.25 ? 1.25 / cm : 1;
    sl.cr = c[0] * ck; sl.cg = c[1] * ck; sl.cb = c[2] * ck;
    if (sl.n === 0 || t - sl.lastCommit >= 1 / 90) {
      sl.head = (sl.head + 1) % RIB_HIST;
      if (sl.n < RIB_HIST) sl.n++;
      sl.lastCommit = t;
    }
    const h = sl.head;
    sl.px[h] = pos.x; sl.py[h] = pos.y; sl.pz[h] = pos.z; sl.pt[h] = t;
    this.root.visible = true;
  }

  setCharge(k) { this.charge = clamp$2(Number(k) || 0, 0, 1.5); }

  setAbsorption(v) { if (v && v.isVector3) this.comp.uMgAbs.value = v; }

  orrery(on) {
    const want = !!on;
    if (want && !this.orrOn && this.orrT <= 0.001) this._wave(0, 0, 0.55, 1.6);
    this.orrOn = want;
    if (want) this.root.visible = true;
  }

  setSky(sky, months, spin = 0) {
    if (!sky) return;
    const P = sky.planets || [];
    const L = this.lon;
    if (Number.isFinite(sky.moon)) L[0] = sky.moon;
    if (Number.isFinite(P[0])) L[1] = P[0];
    if (Number.isFinite(P[1])) L[2] = P[1];
    if (Number.isFinite(sky.sun)) L[3] = sky.sun;
    if (Number.isFinite(P[2])) L[4] = P[2];
    if (Number.isFinite(P[3])) L[5] = P[3];
    if (Number.isFinite(P[4])) L[6] = P[4];
    if (Number.isFinite(months)) this.skyMonths = months;
    this.spin = clamp$2(Number(spin) || 0, -2, 2);
    this.skyFresh = true;
  }

  alignFlash() {
    if (this.alignT >= 0) return;
    this.alignT = 0;
    this.flashDone = false;
    this.root.visible = true;
  }

  moonWorld(out) {
    const b = this.bodyU && this.bodyU.uBP.value[1];
    if (!b || !(this.orrT > 0)) return false;
    out.set(b.x, b.y, b.z);
    return true;
  }

  moonBead(o, eye) {
    const b = this.bodyU && this.bodyU.uBP.value[1];
    if (!b || !(this.orrT > 0)) return false;
    o.p.set(b.x, b.y, b.z);
    const d = eye ? eye.distanceTo(o.p) : 0;
    o.r = 0.5 * BODIES[1][1] * this.bodyU.uBS.value[1] * Math.max(1, d / 3.5);
    o.a = (this.moonAmp || 0) * this.bodyU.uAlpha.value;
    o.dark = this.bodyU.uMoonDark.value;
    o.L.copy(this.sunDir);
    return true;
  }

  setFacing(dir) { this.facing = dir ? dir.clone().normalize() : null; }

  setMoonLine(dir, pin = 1, from = null) {
    if (dir) this.moonLine.copy(dir).normalize();
    this.moonPin = clamp$2(Number(pin) || 0, 0, 1);
    this.moonFrom = from ? (this.moonFrom || new THREE.Vector3()).copy(from) : null;
  }
  setLonOffset(rad) { this.lonOff = Number(rad) || 0; }
  setMoonLook(lv, k = 1) {
    if (lv) this.bodyU.uMoonLV.value.copy(lv).normalize();
    this.bodyU.uMoonLK.value = clamp$2(Number(k) || 0, 0, 1);
  }

  orreryInfo(out) {
    const o = out || this._info || (this._info = { center: new THREE.Vector3(), radius: 0, normal: new THREE.Vector3(), moon: new THREE.Vector3(), shown: 0 });
    if (!o.center) o.center = new THREE.Vector3();
    if (!o.normal) o.normal = new THREE.Vector3();
    if (!o.moon) o.moon = new THREE.Vector3();
    o.center.set(this.M.x, this.M.y + this.hy + ORR.lift, this.M.z);
    o.radius = ORR.bandOut;
    o.normal.copy(this.nS);
    const b = this.bodyU && this.bodyU.uBP.value[1];
    if (b && this.orrT > 0) o.moon.set(b.x, b.y, b.z);
    else o.moon.copy(o.center).addScaledVector(this.ex, ORR.r0);
    o.shown = this.orrT;
    return o;
  }

  update(dt, t, camera) {
    if (this.disposed || !camera) return;
    dt = clamp$2(Number(dt) || 0, 0, 0.1);
    this.now = t;
    this.uTime.value = t;
    if (!this.root.visible) {
      if (this.orrDisc.visible || this.bodies.visible) this.orrDisc.visible = this.bodies.visible = false;
      return;
    }
    const cam = camera.position;
    this._ambience(dt, t);
    if (this.spDirty) {
      this.spPos.needsUpdate = true;
      this.spVel.needsUpdate = true;
      this.spInfo.needsUpdate = true;
      this.spCol.needsUpdate = true;
      this.spDirty = false;
    }
    this.sparks.visible = t < this.spUntil;
    this.pulses.visible = t < this.puUntil;
    this._ribbons(dt, cam);
    this._orrery(dt, t, cam, camera);
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.root.removeFromParent();
    for (const o of [this.orrDisc, this.bodies]) {
      o.removeFromParent();
      o.geometry.dispose();
      o.material.dispose();
    }
    this.root.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) o.material.dispose();
    });
    this.atlas.tex.dispose();
    this.trTex.dispose();
    this.slotByKey.clear();
  }

  showAllForCompile(on) {
    const kids = this.root.children;
    if (on) {
      this._vis = kids.map((o) => o.visible);
      this._rootVis = this.root.visible;
      this.root.visible = true;
      for (const o of kids) o.visible = true;
    } else if (this._vis) {
      kids.forEach((o, i) => { o.visible = this._vis[i]; });
      this.root.visible = this._rootVis;
      this._vis = null;
    }
  }

  _spark(p, vx, vy, vz, life, size, r, g, b) {
    const i = this.spHead;
    this.spHead = (i + 1) % this.spN;
    const P = this.spPos.array, V = this.spVel.array, I = this.spInfo.array, C = this.spCol.array;
    P[i * 3] = p.x + vx * 0.02; P[i * 3 + 1] = p.y + vy * 0.02; P[i * 3 + 2] = p.z + vz * 0.02;
    V[i * 3] = vx; V[i * 3 + 1] = vy; V[i * 3 + 2] = vz;
    I[i * 4] = this.now; I[i * 4 + 1] = life; I[i * 4 + 2] = size; I[i * 4 + 3] = Math.random();
    C[i * 3] = r; C[i * 3 + 1] = g; C[i * 3 + 2] = b;
    this.spDirty = true;
    this.spUntil = Math.max(this.spUntil, this.now + life + 0.05);
    this.sparks.visible = true;
  }

  _shedMote(x, y, z) {
    const p = this._sm.set(x, y, z);
    const vx = (Math.random() - 0.5) * 0.12, vy = (Math.random() - 0.35) * 0.1, vz = (Math.random() - 0.5) * 0.12;
    if (Math.random() < 0.3) this._spark(p, vx, vy + 0.06, vz, 1.3 + Math.random(), 0.005 + Math.random() * 0.004, 0.5, 0.66, 0.75);
    else this._spark(p, vx, vy, vz, 1.0 + Math.random() * 1.2, 0.006 + Math.random() * 0.006, 0.95, 0.66, 0.3);
  }

  _pulse(p, kind, dur, size, strength) {
    const i = this.puHead;
    this.puHead = (i + 1) % this.puN;
    const P = this.puP.array, T = this.puT.array;
    P[i * 4] = p.x; P[i * 4 + 1] = p.y; P[i * 4 + 2] = p.z; P[i * 4 + 3] = kind + Math.random() * 0.49;
    T[i * 4] = this.now; T[i * 4 + 1] = dur; T[i * 4 + 2] = size; T[i * 4 + 3] = strength;
    this.puP.needsUpdate = true;
    this.puT.needsUpdate = true;
    this.puUntil = Math.max(this.puUntil, this.now + dur + 0.05);
    this.pulses.visible = true;
  }

  _wave(cx, cy, s0, speed) {
    const w = this.wave;
    w.on = true; w.age = 0; w.s0 = s0; w.speed = speed; w.cx = cx; w.cy = cy;
  }

  _freeSlot() {
    for (let i = 0; i < this.slots.length; i++) if (!this.slots[i].used) return this.slots[i];
    let best = this.slots[0], bestT = Infinity;
    for (let i = 0; i < this.slots.length; i++) {
      const s = this.slots[i];
      const tt = (s.n > 0 ? s.pt[s.head] : -1e9) + (s.active ? 1e6 : 0);
      if (tt < bestT) { bestT = tt; best = s; }
    }
    this._release(best);
    return best;
  }

  _release(s) {
    if (s.key !== null && this.slotByKey.get(s.key) === s) this.slotByKey.delete(s.key);
    s.key = null; s.used = false; s.active = false; s.n = 0; s.head = -1; s.fade = 0;
    if (!s.cleared) {
      const VPS = RIB_SEG * 2, P = this.rbPos.array, Cc = this.rbCol.array;
      for (let v = s.i * VPS; v < (s.i + 1) * VPS; v++) {
        P[v * 3] = 0; P[v * 3 + 1] = -1e3; P[v * 3 + 2] = 0;
        Cc[v * 4 + 3] = 0;
      }
      s.cleared = true;
      this.rbPos.needsUpdate = true;
      this.rbCol.needsUpdate = true;
    }
  }

  _ambience(dt, t) {
    this.chargeS += (this.charge - this.chargeS) * damp(dt, 2.5);
    if (this.beginHold) {
      this.beginEnv = Math.min(1, this.beginEnv + dt / 2.2);
      if (this.chargeS > 0.22) this.beginHold = false;
    } else this.beginEnv = Math.max(0, this.beginEnv - dt * 0.4);
    const level = this.begun ? Math.max(this.chargeS, 0.22 * sstep$1(0, 1, this.beginEnv)) : 0;
    this.level = level;
    this.spinS += (Math.abs(this.spin) - this.spinS) * damp(dt, 3);
    this.seatPulse *= Math.exp(-dt * 2.8);
    this.flare *= Math.exp(-dt * 1.3);
    const boost = 1 + 0.6 * this.seatPulse + 1.2 * this.flare;
    const on = level > 0.002;
    this.phase += dt * (0.26 + 1.9 * this.spinS) * (0.8 + 0.4 * level);
    this.rise += dt * (0.024 + 0.07 * this.spinS);
    const mu = this.moteU;
    mu.uPhase.value = this.phase;
    mu.uRise.value = this.rise;
    mu.uLevel.value = level;
    mu.uBright.value = (0.35 + 0.65 * level) * boost;
    this.motes.visible = on;
    this.shaftU.uAlpha.value = level * 0.075 * U.uLight.value * (1 + 0.4 * this.seatPulse + 0.8 * this.flare);
    this.shaft.quaternion.setFromUnitVectors(Y_UP, U.uSunW.value);
    this.shaft.visible = on;
    const ra = sstep$1(0.02, 0.3, level) * (1 - sstep$1(0, 1, this.orrT));
    this.runeU.uAlpha.value = ra * 0.65 * (1 + 0.9 * this.seatPulse + 1.0 * this.flare);
    this.runeU.uSpin.value = this.spinS;
    this.runeSpin += dt * (0.07 + 0.55 * this.spinS);
    this.rune.rotation.set(RUNE_TILT + 0.03 * Math.sin(t * 0.13), this.runeSpin, 0.03 * Math.cos(t * 0.11));
    this.rune.position.set(this.M.x, this.M.y + this.hy + RUNE_LIFT + 0.04 * Math.sin(t * 0.3), this.M.z);
    this.runeU.uRC.value.copy(this.rune.position);
    this.rune.visible = ra > 0.002;
  }

  _ribbons(dt, cam) {
    const SEG = RIB_SEG, VPS = SEG * 2, now = this.now;
    const P = this.rbPos.array, Cc = this.rbCol.array, pts = this.rbPts, age = this.rbAge;
    let any = false, dirty = false;
    for (let si = 0; si < this.slots.length; si++) {
      const s = this.slots[si];
      if (!s.used) continue;
      if (!s.active) s.fade = Math.max(0, s.fade - dt / 0.45);
      const n = s.n, H = s.head;
      const tHead = n > 0 ? s.pt[H] : -1e9;
      if (n === 0 || (!s.active && (s.fade <= 0 || now - tHead > RIB_WIN))) { this._release(s); continue; }
      any = true;
      const tTail = Math.max(s.pt[ix(H, n, 0)], now - RIB_WIN);
      const span = tHead - tTail;
      const base = s.i * VPS;
      if (n < 2 || span < 1e-4) {
        if (!s.cleared) {
          for (let v = base; v < base + VPS; v++) Cc[v * 4 + 3] = 0;
          s.cleared = true;
          dirty = true;
        }
        continue;
      }
      let k = n - 1;
      for (let j = 0; j < SEG; j++) {
        const tq = tHead - (j / (SEG - 1)) * span;
        while (k > 1 && s.pt[ix(H, n, k - 1)] > tq) k--;
        const a0 = ix(H, n, Math.max(k - 2, 0)), a1 = ix(H, n, k - 1), a2 = ix(H, n, k), a3 = ix(H, n, Math.min(k + 1, n - 1));
        const ta = s.pt[a1], tb = s.pt[a2];
        const u = tb > ta ? clamp$2((tq - ta) / (tb - ta), 0, 1) : 1;
        pts[j * 3] = cr(s.px[a0], s.px[a1], s.px[a2], s.px[a3], u);
        pts[j * 3 + 1] = cr(s.py[a0], s.py[a1], s.py[a2], s.py[a3], u);
        pts[j * 3 + 2] = cr(s.pz[a0], s.pz[a1], s.pz[a2], s.pz[a3], u);
        age[j] = now - tq;
      }
      const dts = span / (SEG - 1);
      const qx = pts[0] - pts[9], qy = pts[1] - pts[10], qz = pts[2] - pts[11];
      const vs = Math.sqrt(qx * qx + qy * qy + qz * qz) / Math.max(3 * dts, 1e-4);
      s.speed += (vs - s.speed) * damp(dt, 8);
      if (s.active) {
        s.shed += dt * 22 * sstep$1(0.15, 1.2, s.speed);
        while (s.shed >= 1) { s.shed -= 1; this._shedMote(pts[3], pts[4], pts[5]); }
      }
      const wv = RIB_W + (RIB_WMAX - RIB_W) * sstep$1(0.2, 2.5, s.speed);
      let sx0 = 0, sy0 = 0, sz0 = 0, have = false;
      for (let j = 0; j < SEG; j++) {
        const j0 = j > 0 ? j - 1 : 0, j1 = j < SEG - 1 ? j + 1 : SEG - 1;
        const x = pts[j * 3], y = pts[j * 3 + 1], z = pts[j * 3 + 2];
        const tx = pts[j0 * 3] - pts[j1 * 3], ty = pts[j0 * 3 + 1] - pts[j1 * 3 + 1], tz = pts[j0 * 3 + 2] - pts[j1 * 3 + 2];
        const vx = cam.x - x, vy = cam.y - y, vz = cam.z - z;
        let sx = ty * vz - tz * vy, sy = tz * vx - tx * vz, sz = tx * vy - ty * vx;
        const len = Math.sqrt(sx * sx + sy * sy + sz * sz);
        if (len > 1e-9) { sx /= len; sy /= len; sz /= len; sx0 = sx; sy0 = sy; sz0 = sz; have = true; }
        else if (have) { sx = sx0; sy = sy0; sz = sz0; }
        else { const l2 = Math.sqrt(vx * vx + vz * vz) || 1; sx = -vz / l2; sy = 0; sz = vx / l2; }
        const life = 1 - clamp$2(age[j] / RIB_WIN, 0, 1);
        const w = wv * Math.pow(life, 0.7) * (0.45 + 0.55 * sstep$1(0, 0.12, j / (SEG - 1)));
        const a = Math.pow(life, 2.2) * s.fade;
        const v0 = base + j * 2, v1 = v0 + 1;
        P[v0 * 3] = x - sx * w; P[v0 * 3 + 1] = y - sy * w; P[v0 * 3 + 2] = z - sz * w;
        P[v1 * 3] = x + sx * w; P[v1 * 3 + 1] = y + sy * w; P[v1 * 3 + 2] = z + sz * w;
        Cc[v0 * 4] = s.cr; Cc[v0 * 4 + 1] = s.cg; Cc[v0 * 4 + 2] = s.cb; Cc[v0 * 4 + 3] = a;
        Cc[v1 * 4] = s.cr; Cc[v1 * 4 + 1] = s.cg; Cc[v1 * 4 + 2] = s.cb; Cc[v1 * 4 + 3] = a;
      }
      s.cleared = false;
      dirty = true;
    }
    if (dirty) {
      this.rbPos.needsUpdate = true;
      this.rbCol.needsUpdate = true;
    }
    this.ribbons.visible = any;
  }

  _orrery(dt, t, cam, camera) {
    const was = this.orrT;
    this.orrT = clamp$2(this.orrT + (this.orrOn ? dt : -dt) / 1.2, 0, 1);
    if (this.orrT <= 0) {
      this.orrDisc.visible = false;
      this.bodies.visible = false;
      this.beam.visible = false;
      this.skyInit = false;
      return;
    }
    const C = this.C.set(this.M.x, this.M.y + this.hy + ORR.lift, this.M.z);
    const toCam = this._a.subVectors(cam, C);
    const dist = toCam.length();
    toCam.multiplyScalar(1 / Math.max(dist, 1e-4));
    const lean = clamp$2(1 - toCam.y * 3, 0, 1);
    const nT = this._b.copy(toCam);
    nT.y -= 1.5 * lean;
    nT.normalize();
    if (this.facing) nT.copy(this.facing);
    if (was <= 0) this.nS.copy(nT); else this.nS.lerp(nT, damp(dt, 2.2)).normalize();
    const n = this._nw.set(this.nS.x + 0.03 * Math.sin(t * 0.61), this.nS.y, this.nS.z + 0.03 * Math.cos(t * 0.47)).normalize();
    const ex = this.ex.copy(this.axZ).addScaledVector(n, -this.axZ.dot(n));
    if (ex.lengthSq() < 1e-6) ex.copy(this.axX).addScaledVector(n, -this.axX.dot(n));
    ex.normalize();
    if (this.lonOff) {
      const c = Math.cos(this.lonOff), sn = Math.sin(this.lonOff);
      this._pq.crossVectors(n, ex);
      ex.multiplyScalar(c).addScaledVector(this._pq, sn).normalize();
    }
    const ey = this.ey.crossVectors(n, ex);
    this.orrDisc.matrix.makeBasis(ex, ey, n).setPosition(C);
    this.orrDisc.matrixWorldNeedsUpdate = true;
    this.bodyU.uScanAx.value.set(ey.x, ey.y, ey.z, ey.dot(C));
    {
      const zo = this.orrU.uZo.value, za = this.orrU.uZa.value, rm = 0.5 * (ORR.bandIn + ORR.bandOut);
      const zp = this._zp || (this._zp = new THREE.Vector3()), zq = this._zq || (this._zq = new THREE.Vector3());
      for (let c = 0; c < 12; c++) {
        const ph = (-2 * Math.PI * (c + 0.5)) / 12, cs = Math.cos(ph), sn = Math.sin(ph);
        zp.copy(C).addScaledVector(ex, rm * cs).addScaledVector(ey, rm * sn);
        zq.copy(zp).addScaledVector(ex, 0.08 * cs).addScaledVector(ey, 0.08 * sn);
        zp.project(camera);
        zq.project(camera);
        let want = zo[c];
        if (zp.z < 1 && zq.z < 1) {
          const dx = (zq.x - zp.x) * camera.aspect, dy = zq.y - zp.y, l = Math.hypot(dx, dy);
          if (l > 1e-6) { if (dy / l < -0.25) want = 1; else if (dy / l > 0.25) want = 0; }
        }
        if (was <= 0) { zo[c] = want; za[c] = 1; }
        else if (want !== zo[c]) { za[c] -= dt / 0.18; if (za[c] <= 0) { za[c] = 0; zo[c] = want; } }
        else za[c] = Math.min(1, za[c] + dt / 0.18);
      }
    }
    if (was <= 0) this.skyInit = false;
    this._paintTrails(dt);

    let pin = 0, hw = 1;
    if (this.moonPin > 0) {
      hw = 0;
      const O = this.moonFrom || cam, dir = this.moonLine, dn = dir.dot(n);
      if (Math.abs(dn) >= 0.12) {
        this._pm.copy(dir).multiplyScalar(this._pq.subVectors(C, O).dot(n) / dn).add(O);
        hw = (1 - sstep$1(0.85 * ORR.bandIn, ORR.bandIn, this._pm.distanceTo(C))) * sstep$1(0.12, 0.3, Math.abs(dn));
        if (hw > 0) pin = this.moonPin;
      }
      hw += (1 - hw) * (1 - this.moonPin);
    }
    const held = pin > 0 && this.alignT >= 0;

    let glideA = 0, glideR = 0, beam = 0, dim = 0, moonDark = 0, ecl = 0, corona = 0, bead = 0, flashA = 0, umbra = 0;
    if (this.alignT >= 0) {
      const T = (this.alignT += dt), TF = ALIGN_FLASH_T;
      glideA = sstep$1(0.1, 0.8, T);
      glideR = ease(clamp$2((T - 0.4) / 1.5, 0, 1));
      beam = sstep$1(0.1, 0.8, T) * (1 - 0.85 * sstep$1(TF + 0.3, TF + 2.2, T));
      dim = sstep$1(0.8, 2.4, T) * (1 - sstep$1(TF, TF + 1.6, T));
      moonDark = held ? sstep$1(HELD_DARK[0], HELD_DARK[1], T) : sstep$1(0.7, 1.7, T);
      ecl = 1;
      corona = sstep$1(1.9, 2.8, T) * (1 - 0.3 * sstep$1(TF, TF + 1.8, T));
      const bx = (T - (TF - 0.08)) / 0.16;
      bead = Math.exp(-bx * bx);
      flashA = T < TF ? 0 : Math.exp(-(T - TF) * 3.0) * sstep$1(TF, TF + 0.05, T);
      umbra = sstep$1(1.5, 2.4, T);
      if (T - dt <= 0) this.glitchT = 0.45 + Math.random() * 0.25;
      if (T > 0.9 && T < TF + 0.4) { this.glitchLeft = 0; this.glitchT = Math.max(this.glitchT, TF + 0.8 - T); }
    }
    const lift = this.moonLift || 0;
    if (lift > 0) {
      const off = sstep$1(0.1, 0.55, lift), bl = (lift - 0.12) / 0.07;
      bead = Math.max(bead, Math.exp(-bl * bl));
      ecl *= 1 - off;
      corona *= 1 - off;
      umbra *= 1 - off;
    }

    const bp = this.bodyU.uBP.value, bs = this.bodyU.uBS.value, rev = this.orrT;
    bp[0].set(C.x, C.y, C.z, sstep$1(0, 0.25, rev));
    let lonM = this.lon[0], rM = ORR.r0, sunLon = this.lon[3], sunRr = ORR.r0 + 3 * ORR.dr;
    const SHd = this.sunHold || (this.sunHold = { g: 0, lon: 0, r: 0 });
    if (this.alignT < 0) SHd.g = 0;
    else if (held) SHd.g = Math.max(SHd.g, sstep$1(HELD_SUN[0], HELD_SUN[1], this.alignT));
    const gS = SHd.g;
    for (let i = 0; i < 7; i++) {
      const slot = RING_BODY[i];
      let lon = this.lon[i], r = ORR.r0 + i * ORR.dr, scale = i === 0 && pin > 0 ? MOON_HELD : 1;
      if (i === 0 && this.alignT >= 0) {
        if (!held) {
          lon = this.lon[0] + wrap180(this.lon[3] - this.lon[0]) * glideA;
          r += 3 * ORR.dr * glideR;
          scale = 1 + 0.52 * glideR;
        }
      } else if (i === 3 && gS > 0) {
        if (held) { SHd.lon = lonM; SHd.r = rM; }
        lon = sunLon = this.lon[3] + wrap180(SHd.lon - this.lon[3]) * gS;
        r = sunRr = sunRr + (SHd.r - sunRr) * gS;
      }
      let a = lon * DEG$1, ca = Math.cos(a) * r, sa = Math.sin(a) * r;
      if (i === 0 && pin > 0) {
        this._pq.set(C.x + ex.x * ca + ey.x * sa, C.y + ex.y * ca + ey.y * sa, C.z + ex.z * ca + ey.z * sa).lerp(this._pm, pin).sub(C);
        ca = this._pq.dot(ex); sa = this._pq.dot(ey);
        rM = Math.hypot(ca, sa);
        lonM = Math.atan2(sa, ca) / DEG$1;
        a = lonM * DEG$1;
      }
      const om = this.omega[i];
      const amp = sstep$1(i * 0.085 + 0.1, i * 0.085 + 0.35, rev) * (slot === 2 ? Math.max(0.6, 1 / (1 + om / 1500)) : slot === 1 ? (pin > 0 ? 1 : 1 / (1 + om / 900)) * hw : 1 / (1 + om / 900));
      if (slot === 1) this.moonAmp = amp;
      bp[slot].set(C.x + ex.x * ca + ey.x * sa, C.y + ex.y * ca + ey.y * sa, C.z + ex.z * ca + ey.z * sa, slot === 1 ? amp * (1 - (this.moonHand || 0)) : amp);
      bs[slot] = scale;
    }
    const la = sunLon * DEG$1, cl = Math.cos(la), sl = Math.sin(la);
    this.sunDir.set(ex.x * cl + ey.x * sl, ex.y * cl + ey.y * sl, ex.z * cl + ey.z * sl);
    const sunR = sunRr;
    this.sunW.set(bp[2].x, bp[2].y, bp[2].z);
    const toward = this._b.subVectors(cam, this.sunW);
    toward.multiplyScalar(0.2 / Math.max(toward.length(), 1e-4));
    bp[8].set(this.sunW.x + toward.x, this.sunW.y + toward.y, this.sunW.z + toward.z, flashA);
    bs[8] = 0.42 + 0.38 * (1 - flashA);
    this.orrU.uFlashR.value.set(cl * sunR, sl * sunR, 0.18 + 0.52 * (1 - flashA), flashA);
    if (this.alignT >= ALIGN_FLASH_T && !this.flashDone) {
      this.flashDone = true;
      this.flare = 1;
      this._wave(cl * sunR, sl * sunR, 1, 1.9);
      const nb = Math.round(150 * (0.5 + 0.5 * this.q));
      for (let i = 0; i < nb; i++) {
        const u = Math.random() * 2 - 1, ph = Math.random() * TAU$1, q = Math.sqrt(1 - u * u);
        const v = 0.6 + Math.random() * 1.2;
        const white = Math.random() < 0.3;
        this._spark(this.sunW, q * Math.cos(ph) * v, u * v, q * Math.sin(ph) * v, 1.2 + Math.random() * 1.2,
          0.01 + Math.random() * 0.018, white ? 2.2 : 2.0, white ? 2.0 : 1.35, white ? 1.6 : 0.55);
      }
    }
    const wv = this.wave, wu = this.orrU.uWave.value;
    if (wv.on) {
      wv.age += dt;
      const r = wv.age * wv.speed;
      if (r > 2.8) wv.on = false;
      wu.set(wv.cx, wv.cy, r, wv.on ? wv.s0 * Math.exp(-wv.age * 1.1) * (1 - sstep$1(2.2, 2.8, r)) : 0);
    } else wu.w = 0;

    this.glitchT -= dt;
    const tear = this.orrU.uTear.value, intf = this.orrU.uIntf.value;
    if (this.glitchT <= 0) {
      this.glitchT = 2.2 + Math.random() * 3.5;
      this.glitchDur = this.glitchLeft = 0.28 + Math.random() * 0.22;
      if (this.alignT < 0) {
        const r0 = ORR.r0 + Math.random() * (ORR.bandOut - ORR.r0 - 0.15);
        tear.set(r0, r0 + 0.05 + Math.random() * 0.15, (Math.random() < 0.5 ? -1 : 1) * (0.012 + Math.random() * 0.03));
      }
    }
    let flick = 1 - 0.06 * (0.5 + 0.5 * Math.sin(t * 1.9 + 2 * Math.sin(t * 0.7))) * (0.5 + 0.5 * Math.sin(t * 5.3 + 1.3))
      - 0.035 * (0.5 + 0.5 * Math.sin(t * 8.9 + 3 * Math.sin(t * 1.3))) - 0.03 * this.spinS;
    if (this.glitchLeft > 0) {
      this.glitchLeft -= dt;
      const u = 1 - Math.max(0, this.glitchLeft) / this.glitchDur, env = Math.sin(Math.PI * u);
      flick *= 1 - 0.14 * env;
      intf.set(-1.3 + 2.6 * u, 0.02, 0.7 * env);
      if (u > 0.3) tear.z = 0;
    } else { tear.z = 0; intf.z = 0; }

    let vis = 1;
    if (this.alignT < 0) {
      vis = 0;
      const vp = this._nd.copy(C).applyMatrix4(camera.matrixWorldInverse);
      if (-vp.z > 0.1) {
        vp.applyMatrix4(camera.projectionMatrix);
        vis = (1 - sstep$1(0.62, 0.95, Math.max(Math.abs(vp.x), Math.abs(vp.y)))) * (this.moonPin > 0 ? hw : 1);
      }
    }
    this.orrVis = was <= 0 ? vis : this.orrVis + (vis - this.orrVis) * damp(dt, 3.5);
    const A = sstep$1(0, 1, this.orrT) * sstep$1(1.2, 2.4, dist) * (0.85 + 0.15 * Math.min(1, this.chargeS)) * this.orrVis;
    const ou = this.orrU;
    ou.uAlpha.value = A;
    ou.uReveal.value = rev;
    ou.uDim.value = dim;
    ou.uSpin.value = this.spinS;
    ou.uFlick.value = flick;
    ou.uN.value.copy(n);
    ou.uBeam.value.set(cl, sl, beam, 0);
    const bu = this.bodyU;
    bu.uAlpha.value = A * flick;
    bu.uSunDir.value.copy(this.sunDir);
    bu.uEcl.value = ecl;
    bu.uCorona.value = corona;
    bu.uBead.value = bead;
    bu.uMoonDark.value = moonDark;
    bu.uUmbra.value = umbra;
    bu.uAxis.value.copy(n);
    this.beamU.uAlpha.value = A * 0.5 * flick * (1 + 0.4 * this.flare) * (1 - 0.5 * dim);
    this.orrDisc.visible = true;
    this.bodies.visible = true;
    this.beam.visible = A > 0.001;
  }

  _paintTrails(dt) {
    const F = this.trF;
    const k = Math.exp(-dt / TRAIL_TAU);
    let live = false;
    for (let i = 0; i < F.length; i++) {
      const v = F[i] * k;
      F[i] = v < 0.003 ? 0 : v;
      if (v >= 0.003) live = true;
    }
    if (this.skyFresh) {
      this.skyFresh = false;
      const dM = this.skyMonths - this.prevMonths;
      const reset = !this.skyInit || Math.abs(dM) > 4 || this.alignT >= 0;
      for (let b = 0; b < 7; b++) {
        const L = this.lon[b];
        if (reset) this.omega[b] *= Math.exp(-dt * 6);
        else {
          let d = L - this.prevLon[b];
          if (b === 0) d += 360 * Math.round((MOON_RATE * dM - d) / 360);
          else d = wrap180(d);
          const w = Math.abs(d) / Math.max(dt, 1e-3);
          this.omega[b] += (w - this.omega[b]) * damp(dt, 10);
          const g = 0.9 * sstep$1(25, 260, w);
          if (g > 0.01) { this._paintArc(b, this.prevLon[b], d, g, dt); live = true; }
        }
        this.prevLon[b] = L;
      }
      this.prevMonths = this.skyMonths;
      this.skyInit = true;
    } else {
      for (let b = 0; b < 7; b++) this.omega[b] *= Math.exp(-dt * 6);
    }
    if (live || this.trLive) {
      const B = this.trB;
      for (let i = 0; i < F.length; i++) B[i] = F[i] >= 1 ? 255 : (F[i] * 255) | 0;
      this.trTex.needsUpdate = true;
    }
    this.trLive = live;
  }

  _paintArc(b, lon0, d, g, dt) {
    const N = TRAIL_N, F = this.trF, row = b * N;
    const span = (Math.abs(d) / 360) * N;
    if (span >= N - 1) {
      for (let i = 0; i < N; i++) if (F[row + i] < g) F[row + i] = g;
      return;
    }
    const dir = d > 0 ? 1 : -1;
    const k0 = (lon0 / 360) * N;
    const steps = Math.max(1, Math.ceil(span));
    for (let s = 0; s <= steps; s++) {
      const f = s / steps;
      const i = ((Math.floor(k0 + dir * f * span) % N) + N) % N;
      const v = g * Math.exp(-((1 - f) * dt) / TRAIL_TAU);
      if (F[row + i] < v) F[row + i] = v;
    }
  }
}

var magic = Object.freeze({
  __proto__: null,
  Magic: Magic
});

