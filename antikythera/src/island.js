// island.js
const ROT = 0.18;
const POST_U = { uSgPost: { value: new THREE.Vector4(0, 0, 0, 0) } };
const KEY = 'isle19';

const LAND_GLSL = `
uniform float uSgHazeDen;
uniform float uSgHazeMax;
uniform float uSgFogDen;
uniform float uSgFogH;
uniform float uSgSunBlend;
uniform float uSgEnv;
uniform float uSgSky;
uniform float uSgNight;
uniform float uSgDehaze;
uniform vec4 uSgPost;
varying vec3 vSgW;
varying float vSgRidge;
varying float vSgFaint;
const vec3 SG_LUM = vec3(0.2126, 0.7152, 0.0722);
float sgAO = 1.0;
float sgCrest = 0.0;
vec3 sgChroma(vec3 c) { float l = dot(c, SG_LUM); return l > 1e-7 ? c / l : vec3(1.0); }
vec3 sgGold(vec3 c) {
  float k = (1.0 - smoothstep(0.16, 0.42, uSunDir.y)) * step(0.0, uSunDir.y) * (1.0 - uSgNight);
  return vec3(c.r, mix(c.g, min(c.g, 0.7 * c.r), k), c.b);
}
`;
function landLook(shader, o = {}) {
  Object.assign(shader.uniforms, SKY_UNIFORMS, HAZE_U, NIGHT_U, POST_U, {
    uSgDehaze: { value: o.dehaze || 0 },
    uSgHazeDen: { value: o.den !== undefined ? o.den : 1 / 15000 },
    uSgHazeMax: { value: o.max !== undefined ? o.max : 0.6 },
    uSgEnv: { value: o.env !== undefined ? o.env : 0.5 },
    uSgSky: { value: o.sky !== undefined ? o.sky : 0 },
    uSgFogDen: { value: o.fog !== undefined ? o.fog : 0 },
    uSgFogH: { value: o.fogH !== undefined ? o.fogH : 40 },
  });
  const vis = o.vis || null, ridge = o.ridge || null, faint = o.faint || null;
  let vs = shader.vertexShader;
  vs = vs.replace('#include <common>', `#include <common>
varying vec3 vSgW;
varying float vSgRidge;
varying float vSgFaint;
${vis ? `attribute vec2 ${vis};\nvarying vec2 vSgVis;` : ''}
${ridge ? `attribute float ${ridge};` : ''}
${faint ? `attribute float ${faint};` : ''}`);
  vs = vs.replace('#include <project_vertex>', `#include <project_vertex>
{
  vec4 sgWp = vec4(transformed, 1.0);
  #ifdef USE_INSTANCING
    sgWp = instanceMatrix * sgWp;
  #endif
  vSgW = (modelMatrix * sgWp).xyz;
  ${vis ? `vSgVis = ${vis};` : ''}
  vSgRidge = ${ridge || '0.0'};
  vSgFaint = ${faint || '0.0'};
}`);
  shader.vertexShader = vs;
  let fs = shader.fragmentShader;
  fs = fs.replace('#include <common>', `#include <common>
${SKY_DECL}
${SKY_FUNCS}
${LAND_GLSL}
${vis ? 'varying vec2 vSgVis;' : ''}`);
  const sunGate = vis
    ? 'float sgSunVis = mix(vSgVis.x, vSgVis.y, uSgSunBlend);\n' +
      'float sgLow = (1.0 - smoothstep(0.12, 0.3, uSunDir.y)) * smoothstep(0.35, 0.6, uSgSunBlend);\n' +
      'float sgLine = 300.0 * (1.0 - clamp(uSunDir.y / 0.14, 0.0, 1.0));\n' +
      'sgSunVis = mix(sgSunVis, min(sgSunVis, smoothstep(sgLine - 70.0, sgLine + 30.0, vSgW.y)), sgLow);\n'
    : 'float sgSunVis = 1.0;\n';
  fs = fs.replace('#include <lights_fragment_begin>', sunGate +
    'sgSunVis = mix(0.55, sgSunVis * smoothstep(-0.02, 0.03, uSunDir.y), smoothstep(-0.035, -0.005, uSunDir.y));\n' +
    THREE.ShaderChunk.lights_fragment_begin.replace(DIR_TARGET, DIR_TARGET +
      '\n\t\tdirectLight.color = sgGold(directLight.color) * (sgSunVis * mix(1.0, sgAO, 0.3) * (1.0 + 0.3 * sgCrest));'));
  fs = fs.replace('#include <lights_fragment_maps>', `#include <lights_fragment_maps>
#if defined( RE_IndirectDiffuse )
  {
    vec3 sgAmb = irradiance * min(1.0, uSgEnv * 1.2) + iblIrradiance * uSgEnv;
    if (uSgSky > 0.0) {
      vec3 sgN = inverseTransformDirection(normal, viewMatrix);
      vec3 sgSk = mix(skyBase(vec3(0.0, 1.0, 0.0)), skyBase(normalize(vec3(sgN.x, 0.3 + max(sgN.y, 0.0), sgN.z))), 0.4);
      vec3 sgT = mix(vec3(1.0), sgChroma(sgSk), 0.22);
      sgAmb = mix(sgAmb, dot(sgAmb, SG_LUM) * sgT, uSgSky);
    }
    irradiance = sgAmb * sgAO;
    iblIrradiance = vec3(0.0);
  }
#endif
#if defined( RE_IndirectSpecular )
  radiance *= uSgEnv * sgAO;
#endif`);
  fs = fs.replace('#include <opaque_fragment>', `#include <opaque_fragment>
{
  vec3 sgV = vSgW - cameraPosition;
  float sgD = length(sgV);
  vec3 sgDir = sgV / max(sgD, 0.001);
  float sgBack = pow(max(dot(sgDir, uSunDir), 0.0), 3.0) * (1.0 - skDark()) * smoothstep(-0.03, 0.05, uSunDir.y);
  vec3 sgDawn = mix(vec3(1.0, 0.66, 0.38), vec3(1.0, 0.52, 0.24), 1.0 - smoothstep(0.04, 0.25, uSunDir.y));
  gl_FragColor.rgb += vSgRidge * sgDawn * sgBack * (0.55 + 0.5 * (1.0 - smoothstep(0.05, 0.3, uSunDir.y))) * (1.0 - uSgNight);
  float sgHc = max(cameraPosition.y, 0.0), sgHp = max(vSgW.y, 0.0), sgDh = sgHp - sgHc;
  float sgE0 = exp(-sgHc / uSgFogH);
  float sgLayer = abs(sgDh) > 0.5 ? uSgFogH * (sgE0 - exp(-sgHp / uSgFogH)) / sgDh : sgE0;
  float sgF = min(1.0 - exp(-sgD * (uSgHazeDen + uSgFogDen * sgLayer)), uSgHazeMax);
  sgF = max(sgF, vSgFaint);
  float sgFace = smoothstep(0.55, 0.9, dot(sgDir, uSunDir)) * (1.0 - smoothstep(0.12, 0.3, uSunDir.y));
  sgF = min(sgF, mix(uSgHazeMax, 0.12, sgFace));
  vec2 sgHd = normalize(sgDir.xz + vec2(1e-5)), sgSd = normalize(uSunDir.xz + vec2(1e-5));
  if (dot(sgHd, sgSd) > 0.906) {
    float sgSg = sgSd.x * sgHd.y - sgSd.y * sgHd.x >= 0.0 ? 1.0 : -1.0;
    sgHd = vec2(sgSd.x * 0.906 - sgSd.y * 0.423 * sgSg, sgSd.x * 0.423 * sgSg + sgSd.y * 0.906);
  }
  vec3 sgHor = skyBase(normalize(vec3(sgHd.x, 0.035, sgHd.y)));
  vec3 sgSun = sgGold(uSkSunSea);
  vec3 sgGoldC = dot(sgSun, SG_LUM) > 1e-6 ? sgChroma(sgSun) : sgChroma(sgHor);
  vec3 sgBlue = sgChroma(skyBase(vec3(0.0, 1.0, 0.0)));
  float sgFw = 0.5 + 0.45 * smoothstep(-0.2, 0.95, dot(sgDir, uSunDir)) + 0.18 * (1.0 - smoothstep(700.0, 1600.0, sgD));
  vec3 sgHcol = sgChroma(sgHor);
  vec3 sgTint = mix(sgHcol, sgChroma(mix(sgBlue, sgGoldC, sgFw)), 0.45 * (1.0 - smoothstep(0.2, 0.65, sgF)));
  vec3 sgHz = mix(vec3(1.0), sgTint, 0.8) * dot(sgHor, SG_LUM) * 0.92;
  sgHz = mix(sgHz, sgHor * 0.9, max(max(uSgNight, skDark()), 1.0 - smoothstep(-0.02, 0.06, uSunDir.y)));
  sgF = mix(sgF, 0.2 * (1.0 - exp(-sgD / 1400.0)), uSgNight);
  gl_FragColor.rgb = mix(gl_FragColor.rgb, sgHz, sgF);
  if (uSgPost.w > 0.0 && uSgDehaze > 0.0) {
    float fP = 1.0 - exp(-sgD * uSgPost.w);
    float kf = fP * uSgDehaze * (1.0 - smoothstep(0.7, 0.92, fP));
    vec3 sgO = gl_FragColor.rgb;
    vec3 sgDz = max((sgO * (1.0 - fP + kf) - uSgPost.rgb * kf) / max(1.0 - fP, 0.05), vec3(0.0));
    gl_FragColor.rgb = clamp(sgDz, sgO * 0.6, sgO * 1.6 + 0.02);
  }
}`);
  shader.fragmentShader = fs;
}

const CAPE = { x: -505, z: 150, rx: 85, rz: 115 };
const capeMask = (x, z) => Math.exp(-(((x - CAPE.x) / CAPE.rx) ** 2 + ((z - CAPE.z) / CAPE.rz) ** 2));
const COAST = [
  [CAPE.x, CAPE.z, CAPE.rx, CAPE.rz, 0.17],
  [-392, 236, 42, 52, -0.07],
  [-255, 296, 60, 48, 0.045],
  [40, 318, 70, 45, 0.035],
];
const _rv = { cut: 0, u: 0 };
function ravine(x, z) {
  const th = Math.atan2(x, z + 160);
  const u = th * 430 + 34 * fbm2(x * 0.005 + 3.1, z * 0.005 - 1.7, 3) + 10 * fbm2(x * 0.02, z * 0.02 + 5.5, 2);
  const P = 160 + 36 * fbm2(u * 0.003 + 9.1, 0.3, 2);
  const sp = Math.abs(Math.sin((Math.PI * u) / P));
  _rv.cut = Math.pow(1 - sp, 1.7) * (1 - capeMask(x, z));
  _rv.u = u;
  return _rv;
}
const tent = (u) => { const f = u - Math.floor(u); return 1 - Math.abs(2 * f - 1); };
function buttress(x, z) {
  const u = (x * 0.15 - z * 0.06 + 3.0 * fbm2(x * 0.01, z * 0.01, 2)) / 6.2832;
  return 0.7 * tent(u) + 0.3 * tent(u * 2.3 + 0.37);
}
function flute(x, z) {
  const u = (x * 0.24 + z * 0.1 + 2.0 * fbm2(x * 0.02 + 3.3, z * 0.02, 2)) / 6.2832;
  return tent(u);
}
function coastR(x, z, cut, bt) {
  const ax = x < 0 ? 560 : 640;
  const nx = x / ax, nz = z / 300;
  let r = Math.sqrt(nx * nx + nz * nz);
  r += 0.06 * fbm2(x * 0.0042 + 11.3, z * 0.0042 - 4.1, 4) + 0.018 * fbm2(x * 0.017, z * 0.017 + 7.7, 3) + 0.006 * fbm2(x * 0.06, z * 0.06 + 2.2, 2);
  for (const [cx, cz, rx, rz, k] of COAST) r -= k * Math.exp(-(((x - cx) / rx) ** 2 + ((z - cz) / rz) ** 2));
  const cp = capeMask(x, z);
  r += 0.04 * cp * bt + 0.014 * (1 - cp) * (1 - cut) * flute(x, z);
  return r + 0.03 * cut;
}
function ridgeH(x, z) {
  let R = 124 + 86 * smoothstep(-40, 220, x) * (1 - smoothstep(380, 660, x));
  R += 18 * fbm2(x * 0.004 + 1.3, z * 0.002 + 7.1, 3) + 22 * ridged2(x * 0.006 + 2.0, z * 0.006, 3);
  return R - 34 * smoothstep(-400, -575, x);
}
function baseH(x, z) {
  const rv = ravine(x, z), cut = rv.cut, u = rv.u;
  const cape = capeMask(x, z), bt = buttress(x, z);
  const d = (1 - coastR(x, z, cut, bt)) * 300;
  if (d < -70) return -40;
  const w = Math.pow(cut, 0.7);
  const Hs = 30 + 14 * fbm2(x * 0.007 + 5.0, z * 0.007, 3) + cape * (22 - 9 * bt);
  const Hm = 4 + 3 * fbm2(u * 0.02, 1.7, 2);
  const Hc = lerp$4(Hs, Hm, w);
  const wc = lerp$4(10 + 5 * (1 - cape), 26, w);
  if (d < 0) return -8 + d * 1.3;
  if (d < wc) { const t = d / wc; return -8 + (Hc + 8) * (1 - Math.pow(1 - t, 1.3)); }
  const s = clamp$9((d - wc) / 280, 0, 1);
  const R = ridgeH(x, z);
  const f = 0.1 * smoothstep(0, 0.18, s) + 0.9 * Math.pow(smoothstep(0.18, 1.0, s), 0.85);
  const spur = Hs + (R - Hs) * f;
  const bed = Hm + (R * 0.93 - Hm) * Math.pow(s, 1.35);
  let h = lerp$4(spur, bed, w * (1 - smoothstep(0.8, 1.0, s)));
  h += cape * 48 * smoothstep(8, 150, d);
  const u2 = u * 2.9 + 20 * fbm2(x * 0.012, z * 0.012 + 4.4, 2);
  const g2 = Math.pow(1 - Math.abs(Math.sin((Math.PI * u2) / 160)), 2.2);
  h -= g2 * 10 * smoothstep(0.05, 0.3, s) * (1 - smoothstep(0.75, 0.95, s)) * (1 - w);
  h += 6 * (ridged2(x * 0.02 + 5.0, z * 0.02, 3) - 0.5) * smoothstep(0, 0.1, s) + 2.0 * fbm2(x * 0.06, z * 0.06, 2);
  h += 3.2 * (ridged2(x * 0.045 + 1.7, z * 0.045 - 2.1, 3) - 0.5) * smoothstep(0, 0.08, s);
  return h;
}
const ALONIA = [];
function islandH(x, z) {
  let h = baseH(x, z);
  for (const A of ALONIA) {
    const dd = Math.hypot(x - A.x, z - A.z);
    if (dd < A.r + 5) h = lerp$4(A.h, h, smoothstep(A.r - 0.5, A.r + 5, dd));
  }
  return Math.max(h, -40);
}
function slopeOf(f, x, z) {
  const gx = (f(x + 2, z) - f(x - 2, z)) / 4, gz = (f(x, z + 2) - f(x, z - 2)) / 4;
  return 1 - 1 / Math.hypot(gx, 1, gz);
}
{
  const rng = makeRng$1(1901);
  for (let t = 0; t < 4000 && ALONIA.length < 5; t++) {
    const x = -540 + rng() * 760, z = -40 + rng() * 300;
    const h = baseH(x, z);
    if (h < 14 || h > 115 || ravine(x, z).cut > 0.15 || slopeOf(baseH, x, z) > 0.06) continue;
    if (ALONIA.some((A) => Math.hypot(A.x - x, A.z - z) < 110)) continue;
    ALONIA.push({ x, z, h: h + 0.2, r: 6 + rng() * 2.5 });
  }
}

const TERR_FRAG = `
float isH = 0.0;
float isWet = 0.0;
{
  vec3 wp = vSgW;
  vec3 c = diffuseColor.rgb;
  vec3 nW = normalize(vIsNrmW);
  vec3 fwp = fwidth(wp);
  float px = max(max(fwp.x, fwp.y), fwp.z);
  float fine = 1.0 - smoothstep(0.7, 1.8, px);
  float n1 = sgFbm(wp * 0.06);
  float n2 = sgNoise(wp * 0.29);
  float rockW = 1.0 - smoothstep(0.5, 0.78, nW.y);
  float cliff = 1.0 - smoothstep(0.3, 0.52, nW.y);
  float sy = wp.y + 3.5 * sgNoise(vec3(wp.xz * 0.03, 1.0)) + 0.06 * dot(wp.xz, vec2(0.6, 0.8));
  float bed = sgNoise(vec3(wp.xz * 0.012, sy * 0.42));
  float bedF = mix(0.5, sgNoise(vec3(wp.xz * 0.04, sy * 1.6)), fine);
  vec3 rock = mix(vec3(0.46, 0.455, 0.45), vec3(0.57, 0.565, 0.55), smoothstep(0.3, 0.72, bed));
  rock = mix(rock, vec3(0.31, 0.305, 0.30), smoothstep(0.5, 0.85, n1) * 0.75);
  rock = mix(rock, vec3(0.33, 0.32, 0.31), smoothstep(0.5, 0.8, sgFbm(wp * 0.018 + 4.0)) * 0.55 * cliff);
  float jnt = 0.0;
  {
    float sj = atan(wp.x - IS_C.x, wp.z - IS_C.y) * 450.0 + 6.0 * sgNoise(vec3(wp.xz * 0.05, wp.y * 0.02)) + 0.12 * wp.y;
    float jc = fract(sj / 9.0 + 0.6 * sgNoise(vec3(wp.xz * 0.012, 7.0)));
    float jw = 0.035 + px / 9.0;
    float seg = smoothstep(0.52, 0.62, sgNoise(vec3(floor(sj / 9.0) * 1.37, wp.y / 11.0, 1.0)));
    jnt = (1.0 - smoothstep(jw * 0.5, jw, abs(jc - 0.5))) * seg * cliff;
    rock = mix(rock, vec3(0.07, 0.068, 0.065), jnt * 0.7 * mix(0.6, 1.0, fine));
  }
  rock = mix(rock, vec3(0.64, 0.61, 0.55), smoothstep(0.7, 0.84, sgNoise(vec3(wp.xz * 0.03, wp.y * 0.05) + 11.0)) * 0.6 * cliff);
  float lip = 0.0, und = 0.0, lk = 0.0;
  {
    float bt = sy / 6.5 + 0.55 * sgNoise(vec3(wp.xz * 0.012, 2.0)) + 0.25 * sgNoise(vec3(wp.xz * 0.05, 4.0));
    float fb = fract(bt);
    float bl = 1.0 - smoothstep(0.08, 0.25, fwidth(bt));
    float sAl = atan(wp.x - IS_C.x, wp.z - IS_C.y) * 450.0;
    float run = smoothstep(0.4, 0.58, sgNoise(vec3(sAl * 0.045, floor(bt) * 1.7, 3.0)));
    float cl2 = cliff * cliff;
    lip = smoothstep(0.84, 0.97, fb) * bl * cl2 * run;
    und = (1.0 - smoothstep(0.0, 0.18, fb)) * bl * cl2 * run;
    lk = fb * bl * cl2 * run;
  }
  rock *= 1.0 + 0.16 * lip - 0.42 * und;
  rock *= 0.92 + 0.12 * (bedF - 0.5) * cliff + 0.14 * (n2 - 0.5);
  float streak = sgNoise(vec3(wp.x * 0.45, wp.y * 0.04, wp.z * 0.45)) * sgNoise(vec3(wp.x * 1.3, wp.y * 0.1, wp.z * 1.3) + 3.1);
  rock = mix(rock, vec3(0.11, 0.105, 0.095), smoothstep(0.24, 0.56, streak) * 0.4 * cliff * (0.5 + sgNoise(vec3(wp.xz * 0.02, 9.0))));
  rock = mix(rock, vec3(0.30, 0.12, 0.06), smoothstep(0.62, 0.8, sgNoise(wp * 0.11 + 7.3)) * 0.5 * rockW * (1.0 - cliff));
  c = mix(c, rock, rockW);
  float mid = (1.0 - smoothstep(0.8, 0.93, nW.y)) * (1.0 - rockW);
  if (mid > 0.01) {
    float ly = (wp.y + 6.0 * sgNoise(vec3(wp.xz * 0.02, 3.0))) / 9.0;
    float lf = 1.0 - smoothstep(0.15, 0.4, fwidth(ly));
    float ledge = mix(0.12, smoothstep(0.64, 0.8, fract(ly)), lf) * smoothstep(0.45, 0.62, sgNoise(vec3(wp.xz * 0.045, floor(ly) * 2.3)));
    c = mix(c, rock * 0.95, ledge * mid * 0.85);
    isH += ledge * mid * 0.6 * lf;
  }
  float phD = vIsBake.w * (1.0 - rockW);
  if (phD > 0.01) {
    vec2 q = wp.xz / 1.7;
    vec2 cid = floor(q), f = fract(q) - 0.5;
    float hs = sgHash2(cid);
    vec2 o = (vec2(sgHash2(cid + 7.1), sgHash2(cid + 3.3)) - 0.5) * 0.5;
    float r = 0.18 + 0.16 * sgHash2(cid + 1.9);
    float e = px / 1.7;
    float dot1 = step(hs, phD) * (1.0 - smoothstep(r - e, r + e, length(f - o)));
    float res = 1.0 - smoothstep(0.3, 0.7, e);
    float cov = mix(phD * 0.32, dot1, res);
    c = mix(c, vec3(0.12, 0.135, 0.08) * (0.8 + 0.4 * hs), cov);
    isH += dot1 * res * 0.45;
  }
  float terr = vIsBake.y * (1.0 - rockW);
  if (terr > 0.01) {
    float ty = wp.y / 3.0;
    float fty = max(fwidth(ty), 1e-4);
    float lv = 1.0 - smoothstep(0.12, 0.3, fty);
    float run = smoothstep(0.38, 0.52, sgNoise(vec3(wp.xz * 0.05, floor(ty) * 1.7)));
    float wall = (1.0 - smoothstep(0.05 - fty, 0.05 + fty, abs(fract(ty + 0.5) - 0.5))) * min(1.0, 0.1 / fty) * lv * run;
    float shade = (1.0 - smoothstep(0.07 - fty, 0.07 + fty, abs(fract(ty + 0.6) - 0.5))) * min(1.0, 0.12 / fty) * lv * run;
    vec3 field = mix(vec3(0.54, 0.49, 0.28), vec3(0.41, 0.37, 0.20), sgNoise(vec3(wp.xz * 0.03, floor(ty) * 3.1)));
    c = mix(c, field, terr * 0.6);
    c = mix(c, vec3(0.40, 0.38, 0.34), wall * terr * 0.45);
    c *= 1.0 - 0.25 * shade * terr;
    isH += wall * terr * 0.25;
  }
  for (int i = 0; i < 5; i++) {
    vec4 A = uIsAlon[i];
    if (A.z <= 0.0) continue;
    float dd = length(wp.xz - A.xy);
    if (dd > A.z + 2.0) continue;
    float disc = 1.0 - smoothstep(A.z - px, A.z + px, dd);
    float rim = 1.0 - smoothstep(0.35, 0.35 + px, abs(dd - A.z));
    c = mix(c, vec3(0.50, 0.47, 0.41) * (0.9 + 0.2 * sgNoise(vec3(wp.xz * 1.1, 2.0))), disc);
    c = mix(c, vec3(0.34, 0.325, 0.30), rim * 0.8);
    isH += rim * 0.3;
  }
  float nY = 1.3 + 0.9 * sgNoise(vec3(wp.xz * 0.02, 5.0));
  float notch = (1.0 - smoothstep(0.5, 1.05, abs(wp.y - nY - 0.6))) * max(cliff, 0.7 * rockW) * (0.65 + 0.35 * sgNoise(vec3(wp.xz * 0.3, wp.y * 1.5)));
  c = mix(c, vec3(0.03, 0.029, 0.027), notch * 0.9);
  isH -= notch * 0.9;
  float bb = (1.0 - smoothstep(0.2, 1.0 + 0.8 * n2, wp.y)) * smoothstep(-0.8, 0.1, wp.y) * (0.4 + 0.6 * rockW);
  c = mix(c, vec3(0.03, 0.03, 0.028), bb * 0.8);
  isWet = 1.0 - smoothstep(-0.2, 0.9, wp.y);
  c *= 1.0 - 0.4 * isWet;
  if (wp.y < 10.0 && cliff > 0.3) {
    float sAlong = atan(wp.x - IS_C.x, wp.z - IS_C.y) * 450.0;
    float cell = floor(sAlong / 30.0);
    if (sgHash2(vec2(cell, 17.0)) > 0.6) {
      float cx = (cell + 0.3 + 0.4 * sgHash2(vec2(cell, 3.0))) * 30.0;
      float w = 3.0 + 4.0 * sgHash2(vec2(cell, 5.0));
      float hg = 2.5 + 4.5 * sgHash2(vec2(cell, 9.0));
      vec2 q = vec2((sAlong - cx) / w, (wp.y + 0.4) / hg);
      float arch = length(vec2(q.x, max(q.y, 0.0)));
      float cave = (1.0 - smoothstep(1.0 - px / w, 1.0 + px / w, arch)) * step(-0.25, q.y);
      c = mix(c, vec3(0.008, 0.009, 0.01), cave * cliff);
    }
  }
  c = mix(c, vec3(dot(c, SG_LUM)) * vec3(0.9, 0.96, 1.1), 0.6 * uSgNight);
  diffuseColor.rgb = c;
  sgAO = vIsBake.x;
  sgCrest = vIsBake.z;
  isH += ((bedF - 0.5) * 0.35 * cliff + (n2 - 0.5) * 0.5) * fine;
  isH += (lk * 0.55 - und * 0.35) - jnt * 0.6;
  isH += cliff * (sgFbm(wp * 0.3) - 0.5) * 0.7 * fine;
  sgAO *= 1.0 - 0.55 * und - 0.35 * jnt;
}
`;
function terrainMaterial() {
  const alon = [0, 1, 2, 3, 4].map((i) => new THREE.Vector4(0, 0, 0, 0));
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 });
  m.userData.alon = alon;
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uIsAlon = { value: alon };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 aBake;\nvarying vec4 vIsBake;\nvarying vec3 vIsNrmW;')
      .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nvIsNrmW = normalize(mat3(modelMatrix) * objectNormal);\nvIsBake = aBake;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nuniform vec4 uIsAlon[5];\nvarying vec4 vIsBake;\nvarying vec3 vIsNrmW;\nconst vec2 IS_C = vec2(${LAYOUT.island.x.toFixed(1)}, ${LAYOUT.island.z.toFixed(1)});\n` + GLSL_NOISE)
      .replace('#include <color_fragment>', '#include <color_fragment>\n' + TERR_FRAG)
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nroughnessFactor = mix(0.95, 0.32, isWet);')
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\nnormal = sgBump(-vViewPosition, normal, isH, faceDirection);');
    landLook(shader, { den: 1 / 30000, fog: 1 / 12000, fogH: 45, max: 0.4, env: 0.16, sky: 1, vis: 'aVis', ridge: 'aRidge', dehaze: 1 });
  };
  m.customProgramCacheKey = () => KEY + '-terrain';
  return m;
}

const X0 = -620, X1 = 700, DX = 2.2, Z0 = -330, Z1 = 356;
function computeGrid(ctx) {
  const xs = [];
  for (let x = X0; x <= X1 + 1e-6; x += DX) xs.push(x);
  const zs = [];
  for (let z = Z0; z < -80; z += 5) zs.push(z);
  for (let z = -80; z <= Z1 + 1e-6; z += 2) zs.push(z);
  const nx = xs.length, nz = zs.length;
  const H = new Float32Array(nx * nz), CUT = new Float32Array(nx * nz);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { H[j * nx + i] = islandH(xs[i], zs[j]); CUT[j * nx + i] = _rv.cut; }
  ctx.grid = { xs, zs, H, CUT, nx, nz };
}
function gridH(ctx, x, z) {
  const { xs, zs, H, nx, nz } = ctx.grid;
  const fi = clamp$9((x - X0) / DX, 0, nx - 1.001);
  let j = 0;
  if (z <= zs[0]) j = 0; else if (z >= zs[nz - 1]) j = nz - 2;
  else { let lo = 0, hi = nz - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (zs[m] <= z) lo = m; else hi = m; } j = lo; }
  const i = Math.floor(fi), tx = fi - i;
  const tz = clamp$9((z - zs[j]) / (zs[j + 1] - zs[j]), 0, 1);
  const h00 = H[j * nx + i], h10 = H[j * nx + i + 1], h01 = H[(j + 1) * nx + i], h11 = H[(j + 1) * nx + i + 1];
  return lerp$4(lerp$4(h00, h10, tx), lerp$4(h01, h11, tx), tz);
}

const toLocal = (v) => { const c = Math.cos(ROT), s = Math.sin(ROT); return new V3$2(v.x * c - v.z * s, v.y, v.x * s + v.z * c).normalize(); };
const SUNS = [toLocal(SUN_TITLE$1), toLocal(SUN_FINALE)];
function makeOcc(ctx, bumps) {
  const d = 3, x0 = X0, z0 = Z0;
  const nx = Math.floor((X1 - X0) / d) + 1, nz = Math.floor((Z1 - Z0) / d) + 1;
  const h = new Float32Array(nx * nz);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) h[j * nx + i] = gridH(ctx, x0 + i * d, z0 + j * d);
  for (const b of bumps || []) {
    const rs = b.r !== undefined ? Math.max(b.r, 1.6) : 0;
    const r = b.r !== undefined ? rs : Math.hypot(b.w, b.d) / 2 + d;
    const cs = Math.cos(b.yaw || 0), sn = Math.sin(b.yaw || 0);
    for (let j = Math.max(0, Math.floor((b.z - r - z0) / d)); j <= Math.min(nz - 1, Math.ceil((b.z + r - z0) / d)); j++) {
      for (let i = Math.max(0, Math.floor((b.x - r - x0) / d)); i <= Math.min(nx - 1, Math.ceil((b.x + r - x0) / d)); i++) {
        const px = x0 + i * d - b.x, pz = z0 + j * d - b.z;
        const inside = b.r !== undefined ? px * px + pz * pz <= rs * rs
          : Math.abs(px * cs - pz * sn) <= b.w / 2 + 0.5 && Math.abs(px * sn + pz * cs) <= b.d / 2 + 0.5;
        if (inside) h[j * nx + i] = Math.max(h[j * nx + i], b.top);
      }
    }
  }
  return { d, x0, z0, nx, nz, h };
}
function occAt(O, x, z) {
  const fx = (x - O.x0) / O.d, fz = (z - O.z0) / O.d;
  if (fx < 0 || fz < 0 || fx >= O.nx - 1 || fz >= O.nz - 1) return -40;
  const i = fx | 0, j = fz | 0, tx = fx - i, tz = fz - j, k = j * O.nx + i, h = O.h;
  return (h[k] * (1 - tx) + h[k + 1] * tx) * (1 - tz) + (h[k + O.nx] * (1 - tx) + h[k + O.nx + 1] * tx) * tz;
}
const CAM_L = (() => {
  const x = LAYOUT.assembly.x - 3.5 - LAYOUT.island.x, z = LAYOUT.assembly.z - 1.0 - LAYOUT.island.z, c = Math.cos(ROT), s = Math.sin(ROT);
  return { x: x * c - z * s, y: 1.25, z: x * s + z * c };
})();
function skyline(O, x, y, z) {
  const dx = x - CAM_L.x, dz = z - CAM_L.z, D = Math.hypot(dx, dz);
  if (D < 1) return 0;
  const ux = dx / D, uz = dz / D, a = (y - CAM_L.y) / D;
  let maxB = -1e9, s = 3;
  for (let k = 0; k < 80 && s < 800; k++) {
    const b = (occAt(O, x + ux * s, z + uz * s) - CAM_L.y) / (D + s);
    if (b > maxB) { maxB = b; if (maxB > a) return 0; }
    s += Math.max(3, s * 0.08);
  }
  for (let f = 20; f < D - 4; f += Math.max(3, f * 0.04)) {
    if ((occAt(O, CAM_L.x + ux * f, CAM_L.z + uz * f) - CAM_L.y) / f > a + 0.0006) return 0;
  }
  return smoothstep(0, 0.0035, a - maxB);
}
function sunVis(O, x, y, z, Ls) {
  let res = 1, t = 1.5;
  for (let s = 0; s < 56; s++) {
    const py = y + Ls.y * t;
    if (py > 270) break;
    const hh = occAt(O, x + Ls.x * t, z + Ls.z * t);
    res = Math.min(res, (py - hh) / (0.05 * t + 0.5));
    if (res < -1) break;
    t += Math.max(1.5, t * 0.1);
    if (t > 1400) break;
  }
  return smoothstep(-0.6, 1.0, res);
}

const mix3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const STUBBLE = [0.46, 0.40, 0.20], STRAW = [0.53, 0.47, 0.26], FALLOW = [0.32, 0.26, 0.14];
const TERRA = [0.30, 0.17, 0.09], SCRUB = [0.04, 0.05, 0.03], SHINGLE = [0.55, 0.53, 0.49];
function phryganaAt(x, z, h, slope, scrub) {
  return 0.55 * smoothstep(-0.35, 0.15, fbm2(x * 0.013 - 2.2, z * 0.013 + 6.1, 3)) * (1 - scrub) * smoothstep(6, 16, h) * (1 - smoothstep(0.55, 0.7, slope));
}
function terraceAt(x, z, h, slope) {
  return smoothstep(0.1, 0.3, fbm2(x * 0.012 + 9, z * 0.012 - 4, 2)) * (1 - smoothstep(0.16, 0.26, slope)) * smoothstep(12, 20, h) * (1 - smoothstep(100, 125, h));
}
function buildTerrain(ctx) {
  const { xs, zs, H, CUT, nx, nz } = ctx.grid;
  const n = nx * nz;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3);
  const bake = new Float32Array(n * 4), vis = new Float32Array(n * 2), ridge = new Float32Array(n);
  const hAt = (i, j) => H[clamp$9(j, 0, nz - 1) * nx + clamp$9(i, 0, nx - 1)];
  const R1 = [[5, 0], [-5, 0], [0, 5], [0, -5], [4, 4], [-4, 4], [4, -4], [-4, -4]];
  const R2 = R1.map(([a, b]) => [a * 3, b * 3]), R3 = R1.map(([a, b]) => [a * 7, b * 7]);
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const k = j * nx + i, x = xs[i], z = zs[j], h = H[k];
      pos[k * 3] = x; pos[k * 3 + 1] = h; pos[k * 3 + 2] = z;
      const dxl = xs[Math.min(nx - 1, i + 1)] - xs[Math.max(0, i - 1)];
      const dzl = zs[Math.min(nz - 1, j + 1)] - zs[Math.max(0, j - 1)];
      const gx = (hAt(i + 1, j) - hAt(i - 1, j)) / dxl, gz = (hAt(i, j + 1) - hAt(i, j - 1)) / dzl;
      const il = 1 / Math.hypot(gx, 1, gz);
      nor[k * 3] = -gx * il; nor[k * 3 + 1] = il; nor[k * 3 + 2] = -gz * il;
      const slope = 1 - il;
      const cut = CUT[k];
      const n1 = fbm2(x * 0.02 + 7, z * 0.02, 3), n2 = fbm2(x * 0.07, z * 0.07 + 3, 2), n3 = fbm2(x * 0.008 - 2, z * 0.008 + 9, 2);
      let c = mix3(STUBBLE, STRAW, smoothstep(-0.2, 0.3, n1) * 0.6);
      c = mix3(c, FALLOW, smoothstep(0.05, 0.4, n3) * 0.55);
      c = mix3(c, TERRA, smoothstep(0.15, 0.42, n2) * 0.3);
      const scrub = clamp$9(smoothstep(0.16, 0.65, cut) * smoothstep(5, 15, h) * 0.9 + smoothstep(0.3, 0.52, slope) * (1 - smoothstep(0.6, 0.72, slope)) * 0.3, 0, 0.9);
      c = mix3(c, SCRUB, scrub);
      const shore = smoothstep(2.6, 0.4, h) * (1 - smoothstep(0.3, 0.6, slope));
      c = mix3(c, SHINGLE, shore * 0.85);
      col[k * 3] = c[0]; col[k * 3 + 1] = c[1]; col[k * 3 + 2] = c[2];
      let a1 = 0, a2 = 0, a3 = 0;
      for (const [di, dj] of R1) a1 += hAt(i + di, j + dj);
      for (const [di, dj] of R2) a2 += hAt(i + di, j + dj);
      for (const [di, dj] of R3) a3 += hAt(i + di, j + dj);
      a1 /= 8; a2 /= 8; a3 /= 8;
      const cav = 0.034 * Math.max(0, a1 - h) + 0.011 * Math.max(0, a2 - h) + 0.005 * Math.max(0, a3 - h);
      bake[k * 4] = clamp$9(1 - cav, 0.25, 1);
      bake[k * 4 + 1] = terraceAt(x, z, h, slope) * (1 - scrub);
      bake[k * 4 + 2] = clamp$9((h - a2 - 1.0) / 9, 0, 1) * smoothstep(3, 12, h);
      bake[k * 4 + 3] = phryganaAt(x, z, h, slope, scrub);
      if (h > -1.5) {
        vis[k * 2] = sunVis(ctx.occF, x, h + 0.6, z, SUNS[0]);
        vis[k * 2 + 1] = sunVis(ctx.occF, x, h + 0.6, z, SUNS[1]);
      } else { vis[k * 2] = 1; vis[k * 2 + 1] = 1; }
      ridge[k] = h > 3 ? skyline(ctx.occT, x, h + 0.5, z) : 0;
    }
  }
  const idx = [];
  for (let j = 0; j < nz - 1; j++) {
    for (let i = 0; i < nx - 1; i++) {
      const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1;
      if (H[a] < -12 && H[b] < -12 && H[c] < -12 && H[d] < -12) continue;
      idx.push(a, c, b, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('aBake', new THREE.BufferAttribute(bake, 4));
  g.setAttribute('aVis', new THREE.BufferAttribute(vis, 2));
  g.setAttribute('aRidge', new THREE.BufferAttribute(ridge, 1));
  g.setIndex(new THREE.BufferAttribute(new Uint32Array(idx), 1));
  g.computeBoundingSphere();
  const mesh = new THREE.Mesh(g, terrainMaterial());
  return mesh;
}
const VEG_VERT = `
vIsVegY = clamp(position.y, 0.0, 1.0);
#ifdef USE_INSTANCING
{
  vec3 isc = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
  vec4 ic = modelViewMatrix * instanceMatrix * vec4(0.0, 0.5, 0.0, 1.0);
  float zv = max(-ic.z, 1.0);
  float pxs = max(isc.x, isc.y) * projectionMatrix[1][1] * uRbResY * 0.5 / zv;
  transformed *= smoothstep(1.3, 2.8, pxs);
}
#endif
`;
function vegMaterial() {
  const m = new THREE.MeshStandardMaterial({ roughness: 0.95, metalness: 0, vertexColors: true });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uRbResY = ROPE_U.uRbResY;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uRbResY;\nvarying float vIsVegY;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n' + VEG_VERT);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vIsVegY;')
      .replace('#include <color_fragment>', '#include <color_fragment>\nsgAO = mix(0.45, 1.0, smoothstep(0.0, 0.8, vIsVegY));\ndiffuseColor.rgb = mix(diffuseColor.rgb, vec3(dot(diffuseColor.rgb, SG_LUM)), 0.6 * uSgNight);');
    landLook(shader, { den: 1 / 30000, fog: 1 / 12000, fogH: 45, max: 0.4, env: 0.16, sky: 1, vis: 'aVis', dehaze: 1 });
  };
  m.customProgramCacheKey = () => KEY + '-veg';
  return m;
}
function indexed(g) {
  const P = g.attributes.position, map = new Map(), pos = [], idx = [];
  for (let i = 0; i < P.count; i++) {
    const key = P.getX(i).toFixed(4) + ',' + P.getY(i).toFixed(4) + ',' + P.getZ(i).toFixed(4);
    let k = map.get(key);
    if (k === undefined) { k = pos.length / 3; map.set(key, k); pos.push(P.getX(i), P.getY(i), P.getZ(i)); }
    idx.push(k);
  }
  const o = new THREE.BufferGeometry();
  o.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  o.setAttribute('normal', new THREE.Float32BufferAttribute(pos.slice(), 3));
  o.setIndex(idx);
  return o;
}
function shrubGeo() {
  const g = indexed(new THREE.IcosahedronGeometry(1, 0));
  const P = g.attributes.position, N = g.attributes.normal;
  for (let i = 0; i < P.count; i++) {
    const x = P.getX(i), y = P.getY(i), z = P.getZ(i);
    const k = 1 + 0.18 * Math.sin(x * 4.1 + 1.3) * Math.cos(y * 3.3 + z * 2.7);
    P.setXYZ(i, x * k * 0.5, Math.max(0, y * k * 0.5 + 0.38), z * k * 0.5);
    const nx = x * 0.6, ny = y * 0.6 + 0.6, nz = z * 0.6, l = Math.hypot(nx, ny, nz);
    N.setXYZ(i, nx / l, ny / l, nz / l);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(P.count * 3).fill(1), 3));
  return g;
}
function placeVegetation(ctx, rng) {
  const list = [];
  const slopeAt = (x, z) => slopeOf((a, b) => gridH(ctx, a, b), x, z);
  for (let t = 0; t < 240000 && list.length < 6500; t++) {
    const x = X0 + rng() * (X1 - X0), z = -300 + rng() * 650;
    const h = gridH(ctx, x, z);
    if (h < 4) continue;
    const s = slopeAt(x, z);
    if (s > 0.6) continue;
    const cut = ravine(x, z).cut;
    if (ALONIA.some((A) => Math.hypot(A.x - x, A.z - z) < A.r + 3)) continue;
    const clump = smoothstep(-0.05, 0.35, fbm2(x * 0.02 + 4.4, z * 0.02 - 1.2, 3));
    const p = 0.02 + 0.85 * smoothstep(0.2, 0.7, cut) * smoothstep(6, 16, h) + 0.28 * smoothstep(0.28, 0.5, s) + 0.45 * clump;
    if (rng() > p * 0.55) continue;
    const w = 1.6 + rng() * 2.6, ht = w * (0.4 + rng() * 0.3), tint = rng();
    const c = [lerp$4(0.022, 0.045, tint), lerp$4(0.03, 0.058, tint), lerp$4(0.016, 0.03, tint)];
    list.push({ x, y: h - 0.15 * ht, z, sx: w, sy: ht, sz: w * (0.8 + rng() * 0.4), c });
  }
  ctx.shrubBumps = list.map((o) => ({ x: o.x, z: o.z, r: o.sx * 0.45, top: o.y + o.sy * 0.85 }));
  return list;
}
function buildVegetation(ctx, list, rng) {
  const material = vegMaterial();
  const geo = shrubGeo();
  const vis = new Float32Array(list.length * 2);
  list.forEach((o, i) => {
    const hy = o.y + o.sy * 0.7 + 0.3;
    vis[i * 2] = sunVis(ctx.occT, o.x, hy, o.z, SUNS[0]);
    vis[i * 2 + 1] = sunVis(ctx.occT, o.x, hy, o.z, SUNS[1]);
  });
  geo.setAttribute('aVis', new THREE.InstancedBufferAttribute(vis, 2));
  const mesh = new THREE.InstancedMesh(geo, material, Math.max(1, list.length));
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), pos = new V3$2(), sc = new V3$2(), col = new THREE.Color();
  list.forEach((o, i) => {
    e.set((rng() - 0.5) * 0.12, rng() * 6.28, (rng() - 0.5) * 0.12);
    q.setFromEuler(e);
    m4.compose(pos.set(o.x, o.y, o.z), q, sc.set(o.sx, o.sy, o.sz));
    mesh.setMatrixAt(i, m4);
    mesh.setColorAt(i, col.setRGB(o.c[0], o.c[1], o.c[2]));
  });
  mesh.count = list.length;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.computeBoundingSphere();
  return mesh;
}

const K_LIME = 0, K_STONE = 1, K_DARK = 4;
const VILLAGE_FRAG = `
{
  float pxm = length(fwidth(vSgW));
  float keep = smoothstep(1.2, 2.2, vIsDet.w / max(pxm, 1e-3));
  diffuseColor.rgb = mix(diffuseColor.rgb, vIsDet.rgb, vIsDet.w > 0.0 ? keep : 0.0);
  vec3 wp = vSgW, nW = normalize(vIsNrmW);
  float kd = vIsKind.x, hb = vIsKind.y;
  float fine = 1.0 - smoothstep(0.06, 0.25, pxm);
  float n1 = sgNoise(wp * 0.35);
  vec3 c = diffuseColor.rgb;
  if (kd < 0.5) {
    c *= 0.93 + 0.1 * n1 + 0.06 * (sgNoise(wp * 4.3) - 0.5) * fine;
    float run = smoothstep(0.6, 0.95, sgNoise(vec3(wp.x * 2.3, wp.y * 0.2, wp.z * 2.3))) * fine;
    c *= 1.0 - 0.12 * run * (1.0 - abs(nW.y));
    c *= 1.0 - 0.25 * (1.0 - smoothstep(0.0, 0.8, hb));
  } else if (kd < 1.5) {
    vec2 tg = normalize(vec2(-nW.z, nW.x) + vec2(1e-4));
    float u = dot(wp.xz, tg), v = wp.y / 0.34;
    float row = floor(v);
    float bl = 0.42 + 0.3 * sgHash2(vec2(row, 7.0));
    float uu = (u + 0.9 * sgHash2(vec2(row, 1.0))) / bl;
    float tone = sgHash2(vec2(row, floor(uu)) + 3.1);
    float mv = min(fract(v), 1.0 - fract(v)), mu = min(fract(uu), 1.0 - fract(uu)) * bl / 0.34;
    float mort = 1.0 - smoothstep(0.05, 0.13, min(mv, mu));
    float lod = fine * (1.0 - smoothstep(0.12, 0.35, fwidth(v)));
    c *= mix(1.0, (0.78 + 0.44 * tone) * mix(1.0, 0.7, mort), lod) * (0.9 + 0.14 * n1);
    c *= 1.0 - 0.2 * (1.0 - smoothstep(0.0, 0.6, hb));
  }
  diffuseColor.rgb = c;
}
`;
function featureMaterial() {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0 });
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 aDet;\nattribute vec2 aKind;\nvarying vec4 vIsDet;\nvarying vec2 vIsKind;\nvarying vec3 vIsNrmW;')
      .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nvIsNrmW = normalize(mat3(modelMatrix) * objectNormal);')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvIsDet = aDet;\nvIsKind = aKind;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec4 vIsDet;\nvarying vec2 vIsKind;\nvarying vec3 vIsNrmW;\n' + GLSL_NOISE)
      .replace('#include <color_fragment>', '#include <color_fragment>\n' + VILLAGE_FRAG);
    landLook(shader, { den: 1 / 30000, fog: 1 / 12000, fogH: 45, max: 0.4, env: 0.14, sky: 1, vis: 'aVis', dehaze: 1 });
  };
  m.customProgramCacheKey = () => KEY + '-features';
  return m;
}
const LIME = [0.62, 0.6, 0.55], STONE = [0.34, 0.31, 0.26], EARTH$1 = [0.24, 0.19, 0.13], DARK = [0.025, 0.022, 0.02];
function buildFeatures(ctx, rng) {
  const B = new Builder({ aDet: 4, aVis: 2, aKind: 2 });
  const add = (geo, c, mx, det = null, kind = K_LIME, foot = null, vis = undefined) => B.add(geo, {
    m: mx, color: c, aDet: det ? [det[0], det[1], det[2], det[3]] : [0, 0, 0, 0],
    aKind: foot === null ? [kind, 9] : (p) => [kind, p.y - foot], aVis: vis,
  });
  const hAt = (x, z) => gridH(ctx, x, z);
  const visAt = (x, y, z) => [sunVis(ctx.occT, x, y, z, SUNS[0]), sunVis(ctx.occT, x, y, z, SUNS[1])];
  ctx.houses = [];
  ALONIA.forEach((A, n) => {
    const nk = Math.round((A.r * 2 * Math.PI) / 1.1);
    for (let k = 0; k < nk; k++) {
      const a = (k / nk) * Math.PI * 2 + rng() * 0.05, x = A.x + Math.cos(a) * A.r, z = A.z + Math.sin(a) * A.r;
      const s = 0.8 + rng() * 0.4;
      add(new THREE.BoxGeometry(1.0 * s, 0.45 * s, 0.5 * s), STONE.map((v) => v * (0.85 + rng() * 0.3)), mat(x, A.h + 0.1, z, 0, -a, 0), null, K_STONE, A.h - 0.2, visAt(x, A.h + 0.4, z));
    }
    if (n > 3) return;
    const a = rng() * 6.28, hx = A.x + Math.cos(a) * (A.r + 9), hz = A.z + Math.sin(a) * (A.r + 9);
    const h = hAt(hx, hz), yaw = rng() * 6.28, w = 3.2 + rng() * 1.2, dp = 2.6 + rng() * 0.8, ht = 2.3 + rng() * 0.4;
    ctx.houses.push({ x: hx, z: hz, w, d: dp, yaw, top: h + ht });
    const hv = visAt(hx, h + ht + 0.3, hz);
    add(new THREE.BoxGeometry(w, ht + 1.2, dp), STONE.map((v) => v * (0.9 + rng() * 0.2)), mat(hx, h + ht / 2 - 0.6, hz, 0, yaw, 0), null, K_STONE, h - 1.2);
    add(new THREE.BoxGeometry(w + 0.3, 0.3, dp + 0.3), EARTH$1, mat(hx, h + ht + 0.1, hz, 0, yaw, 0), null, K_STONE, null, hv);
    const cs = Math.cos(yaw), sn = Math.sin(yaw);
    add(new THREE.BoxGeometry(0.8, 1.6, 0.12), mix3(STONE, DARK, 0.5), mat(hx + sn * (dp / 2 + 0.02), h + 0.8, hz + cs * (dp / 2 + 0.02), 0, yaw, 0), [...DARK, 0.8], K_DARK, null, hv);
  });
  {
    let best = null;
    for (let t = 0; t < 900; t++) {
      const x = -470 + rng() * 170, z = -60 + rng() * 150;
      const h = hAt(x, z);
      if (ravine(x, z).cut > 0.2) continue;
      if (!best || h > best.h) best = { x, z, h };
    }
    const { x, z, h } = best;
    const yaw = 0.25, cs = Math.cos(yaw), sn = Math.sin(yaw);
    ctx.chapel = best;
    ctx.houses.push({ x, z, w: 5.2, d: 8.2, yaw, top: h + 5.8 });
    const cv = visAt(x, h + 5, z);
    add(new THREE.BoxGeometry(4.6, 4.4, 7.6), LIME, mat(x, h + 1.2, z, 0, yaw, 0), null, K_LIME, h - 1.0);
    const vault = new THREE.CylinderGeometry(2.35, 2.35, 7.8, 16, 1, false, 0, Math.PI);
    vault.rotateZ(Math.PI / 2); vault.rotateY(Math.PI / 2);
    add(vault, LIME, mat(x, h + 3.4, z, 0, yaw, 0), null, K_LIME, null, cv);
    const s = new THREE.Shape();
    s.moveTo(-1.3, 0); s.lineTo(1.3, 0); s.lineTo(1.3, 1.9); s.quadraticCurveTo(0, 3.0, -1.3, 1.9); s.lineTo(-1.3, 0);
    const hole = new THREE.Path(); hole.moveTo(-0.45, 0.45); hole.lineTo(0.45, 0.45); hole.lineTo(0.45, 1.3); hole.absarc(0, 1.3, 0.45, 0, Math.PI, false); hole.lineTo(-0.45, 0.45);
    s.holes.push(hole);
    add(new THREE.ExtrudeGeometry(s, { depth: 0.45, bevelEnabled: false, curveSegments: 10 }), LIME, mat(x - 3.82 * sn, h + 3.3, z - 3.82 * cs, 0, yaw, 0), null, K_LIME, null, cv);
    add(new THREE.BoxGeometry(1.0, 2.0, 0.2), mix3(LIME, DARK, 0.5), mat(x - 3.82 * sn, h + 0.9, z - 3.82 * cs, 0, yaw, 0), [...DARK, 0.9], K_DARK, null, cv);
    add(new THREE.BoxGeometry(9, 0.6, 12), STONE, mat(x, h - 0.2, z, 0, yaw, 0), null, K_STONE, h - 0.6);
  }
  return B;
}

const TCAM = { x: LAYOUT.titleCam.x, z: LAYOUT.titleCam.z };
const atAz = (az, r) => ({ x: TCAM.x + Math.sin((az * Math.PI) / 180) * r, z: TCAM.z - Math.cos((az * Math.PI) / 180) * r });
const DISTANT = [
  { ...atAz(-36.5, 1450), rot: -0.2, ax: 380, az: 160, peak: 78, seed: 21, edge: 0.88, faint: 0, rug: 1 },
  { ...atAz(-47, 2150), rot: -0.35, ax: 560, az: 220, peak: 125, seed: 23, edge: 0.86, faint: 0, rug: 1 },
  { ...atAz(-40, 2750), rot: -0.45, ax: 900, az: 120, peak: 48, seed: 29, edge: 0.8, faint: 0.62 },
  { x: 2350, z: -1450, rot: -0.55, ax: 900, az: 260, peak: 190, seed: 11, edge: 0.72, faint: 0, cutX: 400, rim: true },
];
function distH(D, x, z) {
  const r = Math.hypot(x / D.ax, z / D.az) + 0.12 * fbm2(x * 0.004 + D.seed, z * 0.004, 3);
  let mask = smoothstep(1.0, D.edge, r);
  if (D.cutX !== undefined) mask *= smoothstep(D.cutX + 25, D.cutX - 15, x + 20 * fbm2(z * 0.01, D.seed, 2));
  let h = D.peak * Math.pow(mask, 0.85) * (D.rug ? 0.4 + 0.75 * ridged2(x * 0.0032 + D.seed, z * 0.0032, 3) + 0.12 * fbm2(x * 0.012, z * 0.012 + D.seed, 2) : 0.55 + 0.6 * ridged2(x * 0.0035 + D.seed, z * 0.0035, 4));
  h += 6 * fbm2(x * 0.02, z * 0.02 + D.seed, 2) * mask;
  return mask > 0.001 ? h : -3;
}
const CAM_W = { x: LAYOUT.assembly.x - 3.5, z: LAYOUT.assembly.z - 1.0 };
function buildDistant() {
  const B = new Builder({ aVis: 2, aRidge: 1, aFaint: 1 });
  for (const D of DISTANT) {
    const NX = 170, NZ = 48;
    const g = new THREE.PlaneGeometry(D.ax * 2.3, D.az * 2.3, NX, NZ);
    g.rotateX(-Math.PI / 2);
    const P = g.attributes.position, cs = Math.cos(D.rot), sn = Math.sin(D.rot);
    const hs = new Float32Array(P.count);
    for (let i = 0; i < P.count; i++) { hs[i] = Math.max(distH(D, P.getX(i), P.getZ(i)), -3); P.setY(i, hs[i]); }
    g.computeVertexNormals();
    const N = g.attributes.normal;
    const loc = (v) => new V3$2(v.x * cs - v.z * sn, v.y, v.x * sn + v.z * cs);
    const Ls = [loc(D.rim ? SUN_FINALE : SUN_TITLE$1)];
    const cam = loc(new V3$2(CAM_W.x - D.x, 0, CAM_W.z - D.z));
    const col = [], vis = [], rim = [], fnt = [];
    for (let i = 0; i < P.count; i++) {
      const x = P.getX(i), z = P.getZ(i), h = hs[i], ny = N.getY(i);
      const t = clamp$9(h / D.peak, 0, 1), steep = 1 - smoothstep(0.55, 0.8, ny);
      let c = mix3(mix3(STUBBLE, FALLOW, 0.4 + 0.4 * fbm2(x * 0.01 + D.seed, z * 0.01, 2)), [0.10, 0.11, 0.07], 0.35 * smoothstep(0.2, 0.6, t));
      c = mix3(c, [0.47, 0.45, 0.41], steep * 0.8);
      col.push(...c);
      for (const Lv of Ls) {
        let res = 1, s = 5;
        if (h > 0) for (let k = 0; k < 20; k++) {
          const py = h + 1 + Lv.y * s;
          if (py > D.peak + 20) break;
          res = Math.min(res, (py - distH(D, x + Lv.x * s, z + Lv.z * s)) / (0.05 * s + 1));
          if (res < -1) break;
          s += Math.max(6, s * 0.18);
        }
        const v = smoothstep(-0.6, 1.0, res);
        vis.push(v, v);
      }
      let sky = 0;
      if (D.rim && h > 0.3 * D.peak) {
        const dx = x - cam.x, dz = z - cam.z, Dd = Math.hypot(dx, dz), ux = dx / Dd, uz = dz / Dd, a = (h - 1.25) / Dd;
        let maxB = -1e9;
        for (let s = 8; s < 900; s += Math.max(10, s * 0.1)) maxB = Math.max(maxB, (distH(D, x + ux * s, z + uz * s) - 1.25) / (Dd + s));
        sky = smoothstep(0, 0.002, a - maxB);
      }
      rim.push(sky * 0.8);
      fnt.push(D.faint);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setAttribute('aVis', new THREE.Float32BufferAttribute(vis, 2));
    g.setAttribute('aRidge', new THREE.Float32BufferAttribute(rim, 1));
    g.setAttribute('aFaint', new THREE.Float32BufferAttribute(fnt, 1));
    B.add(g, { m: mat(D.x, 0, D.z, 0, D.rot, 0) });
  }
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 });
  m.onBeforeCompile = (shader) => landLook(shader, { den: 1 / 9000, fog: 1 / 9000, fogH: 60, max: 0.7, env: 0.2, sky: 1, vis: 'aVis', ridge: 'aRidge', faint: 'aFaint', dehaze: 1 });
  m.customProgramCacheKey = () => KEY + '-distant';
  return new THREE.Mesh(B.build(), m);
}

const CF_VERT = `
varying vec2 vCf;
varying vec3 vCw;
void main() {
  vCf = uv;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vCw = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;
const CF_FRAG = `
${SKY_DECL}
${SKY_FUNCS}
${GLSL_NOISE}
uniform float uTime;
uniform float uLight;
uniform float uSgNight;
varying vec2 vCf;
varying vec3 vCw;
void main() {
  float t = uTime;
  float surge = 0.5 + 0.5 * sin(vCf.x * 0.045 - t * 0.9 + 3.0 * sgNoise(vec3(vCf.x * 0.02, 0.0, t * 0.05)));
  float n = sgNoise(vec3(vCf.x * 0.35, vCf.y * 2.0 - t * 0.6, t * 0.2));
  float h = mix(0.3, 1.0, surge) * (0.6 + 0.4 * n);
  float a = (1.0 - smoothstep(0.0, h, vCf.y)) * smoothstep(-0.02, 0.1, vCf.y);
  vec3 V = normalize(vCw - cameraPosition);
  float glint = pow(max(dot(V, uSunDir), 0.0), 6.0) * 0.8;
  vec3 sun = uSkSunSea;
  sun.g = min(sun.g, mix(sun.g, 0.7 * sun.r, 1.0 - smoothstep(0.16, 0.42, uSunDir.y)));
  vec3 col = vec3(0.8, 0.82, 0.84) * (skyBase(vec3(0.0, 1.0, 0.0)) * 2.2 + sun * (0.55 + glint)) * uLight * (1.0 - 0.7 * skDark()) * (1.0 - 0.85 * uSgNight);
  float d = length(vCw - cameraPosition);
  col = mix(col, skyBase(normalize(vec3(V.x, 0.035, V.z))) * 0.9, (1.0 - exp(-d / 9000.0)) * 0.6);
  gl_FragColor = vec4(col, a * 0.85);
}
`;
function buildCoastFoam(ctx) {
  const { xs, zs, H, nx, nz } = ctx.grid;
  const pts = new Map(), adj = new Map();
  const link = (p, q) => {
    if (!adj.has(p)) adj.set(p, []);
    if (!adj.has(q)) adj.set(q, []);
    adj.get(p).push(q); adj.get(q).push(p);
  };
  for (let j = 0; j < nz - 1; j++) {
    for (let i = 0; i < nx - 1; i++) {
      const E = [[`h${i},${j}`, i, j, i + 1, j], [`v${i + 1},${j}`, i + 1, j, i + 1, j + 1], [`h${i},${j + 1}`, i, j + 1, i + 1, j + 1], [`v${i},${j}`, i, j, i, j + 1]];
      const crossed = [];
      for (const e of E) {
        const h0 = H[e[2] * nx + e[1]], h1 = H[e[4] * nx + e[3]];
        if ((h0 > 0) !== (h1 > 0)) {
          crossed.push(e[0]);
          if (!pts.has(e[0])) {
            const t = h0 / (h0 - h1);
            pts.set(e[0], [xs[e[1]] + (xs[e[3]] - xs[e[1]]) * t, zs[e[2]] + (zs[e[4]] - zs[e[2]]) * t]);
          }
        }
      }
      for (let k = 0; k + 1 < crossed.length; k += 2) link(crossed[k], crossed[k + 1]);
    }
  }
  const seen = new Set(), chains = [];
  const walk = (s) => {
    const c = [s]; seen.add(s);
    let cur = s;
    for (;;) {
      const nxt = (adj.get(cur) || []).find((q) => !seen.has(q));
      if (!nxt) break;
      c.push(nxt); seen.add(nxt); cur = nxt;
    }
    if ((adj.get(cur) || []).includes(s) && c.length > 2) c.push(s);
    return c;
  };
  for (const [k, v] of adj) if (v.length === 1 && !seen.has(k)) chains.push(walk(k));
  for (const k of adj.keys()) if (!seen.has(k)) chains.push(walk(k));
  const pos = [], uv = [], idx = [];
  ctx.coast = [];
  for (const ch of chains) {
    if (ch.length < 12) continue;
    let arc = 0, prev = null;
    const base = pos.length / 3;
    for (let i = 0; i < ch.length; i++) {
      const [x, z] = pts.get(ch[i]);
      if (prev) arc += Math.hypot(x - prev[0], z - prev[1]);
      prev = [x, z];
      const gx = gridH(ctx, x + 1.5, z) - gridH(ctx, x - 1.5, z), gz = gridH(ctx, x, z + 1.5) - gridH(ctx, x, z - 1.5);
      const gl = Math.hypot(gx, gz) || 1;
      const ox = x - (gx / gl) * 1.2, oz = z - (gz / gl) * 1.2;
      const top = 1.6 + 0.9 * fbm2(x * 0.05, z * 0.05, 2);
      ctx.coast.push([x, z, gx / gl, gz / gl]);
      pos.push(ox, -0.35, oz, ox, top, oz);
      uv.push(arc, 0, arc, 1);
      if (i > 0) { const a = base + (i - 1) * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeBoundingSphere();
  const m = new THREE.ShaderMaterial({
    uniforms: Object.assign({}, SKY_UNIFORMS, { uTime: U.uTime, uLight: U.uLight, uSgNight: NIGHT_U.uSgNight }),
    vertexShader: CF_VERT, fragmentShader: CF_FRAG, transparent: true, depthWrite: false, side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(g, m);
  mesh.renderOrder = 1;
  return mesh;
}

function buildBoulders(ctx, material, rng) {
  const g = new THREE.IcosahedronGeometry(1, 0);
  const P = g.attributes.position;
  for (let i = 0; i < P.count; i++) {
    const x = P.getX(i), y = P.getY(i), z = P.getZ(i);
    const k = 1 + 0.28 * Math.sin(x * 3.1 + 1.3) * Math.cos(y * 2.7 + z * 1.9) + 0.14 * Math.sin(z * 5.3 + x * 4.1);
    P.setXYZ(i, x * k, y * k * 0.72, z * k);
  }
  g.computeVertexNormals();
  g.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(P.count * 3).fill(1), 3));
  const list = [];
  (ctx.coast || []).forEach(([x, z, nx, nz], i) => {
    if (i % 2) return;
    const top = gridH(ctx, x + nx * 8, z + nz * 8);
    const high = smoothstep(10, 35, top);
    const n = Math.floor(rng() * (1.5 + 3.5 * high));
    for (let k = 0; k < n; k++) {
      const off = -2 + rng() * 5;
      const px = x - nx * off + (rng() - 0.5) * 4, pz = z - nz * off + (rng() - 0.5) * 4;
      const s = 0.6 + rng() * rng() * (1.8 + 2.8 * high);
      list.push([px, Math.min(gridH(ctx, px, pz), 0.2) - s * 0.35 + rng() * s * 0.5 * high, pz, s]);
    }
  });
  const vis = new Float32Array(list.length * 2);
  list.forEach(([x, y, z, s], i) => { vis[i * 2] = sunVis(ctx.occT, x, y + s, z, SUNS[0]); vis[i * 2 + 1] = sunVis(ctx.occT, x, y + s, z, SUNS[1]); });
  g.setAttribute('aVis', new THREE.InstancedBufferAttribute(vis, 2));
  const mesh = new THREE.InstancedMesh(g, material, Math.max(1, list.length));
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), pv = new V3$2(), sc = new V3$2(), col = new THREE.Color();
  list.forEach(([x, y, z, s], i) => {
    e.set((rng() - 0.5) * 0.6, rng() * 6.28, (rng() - 0.5) * 0.6);
    q.setFromEuler(e);
    m4.compose(pv.set(x, y, z), q, sc.set(s * (0.8 + rng() * 0.5), s * (0.6 + rng() * 0.5), s * (0.8 + rng() * 0.5)));
    mesh.setMatrixAt(i, m4);
    const v = 0.6 + rng() * 0.55;
    mesh.setColorAt(i, col.setRGB(0.47 * v, 0.45 * v, 0.415 * v));
  });
  mesh.count = list.length;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.computeBoundingSphere();
  return mesh;
}

function buildIsland() {
  const rng = makeRng$1(1900);
  const ctx = {};
  const group = new THREE.Group();
  const land = new THREE.Group();
  land.position.set(LAYOUT.island.x, 0, LAYOUT.island.z);
  land.rotation.y = ROT;
  computeGrid(ctx);
  ctx.occT = makeOcc(ctx, null);
  const vegList = placeVegetation(ctx, rng);
  const fb = buildFeatures(ctx, rng);
  ctx.occF = makeOcc(ctx, [...ctx.houses, ...ctx.shrubBumps]);
  const terrain = buildTerrain(ctx);
  ALONIA.forEach((A, i) => terrain.material.userData.alon[i].set(A.x, A.z, A.r, 1));
  const veg = buildVegetation(ctx, vegList, rng);
  fb.setDefault('aVis', (p) => [sunVis(ctx.occT, p.x, p.y + 0.4, p.z, SUNS[0]), sunVis(ctx.occT, p.x, p.y + 0.4, p.z, SUNS[1])]);
  const features = new THREE.Mesh(fb.build(), featureMaterial());
  const surf = buildCoastFoam(ctx);
  const rocks = buildBoulders(ctx, veg.material, rng);
  land.add(terrain, veg, features, surf, rocks);
  const distant = buildDistant();
  group.add(land, distant);
  group.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
  land.updateMatrixWorld(true);
  const beamDir = new V3$2(1, 0, 0);
  const update = (t) => { return beamDir; };
  return { group, land, terrain, veg, village: features, distant, lighthouse: null, update };
}

