// core.js
const WATER_Y = 0;

THREE.ShaderChunk.envmap_physical_pars_fragment = THREE.ShaderChunk.envmap_physical_pars_fragment
  .replace('envMapRotation * worldNormal, 1.0 )', 'envMapRotation * worldNormal, 0.85 )');

const FX_SCENE = new THREE.Scene();

const U = {
  uTime: { value: 0 },
  uCaustics: { value: null },
  uCausticTile: { value: 6.0 },
  uCausticStr: { value: 1.0 },
  uWarmNear: { value: 0 },
  uSunW: { value: new THREE.Vector3(0, 1, 0) },
  uWaterY: { value: WATER_Y },
  uLight: { value: 1 },
  uSurge: { value: new THREE.Vector3() },
  uPingPos: { value: new THREE.Vector3() },
  uPingR: { value: 0 },
  uPingA: { value: 0 },
};

const ARCH = {
  uArchP: { value: [0, 1, 2].map(() => new THREE.Vector4(0, -999, 0, 1)) },
  uArchQ: { value: [0, 1, 2].map(() => new THREE.Vector4(-999, 1, 0, 0)) },
  uArchK: { value: 0 },
};
const SUNSH = {
  uShMap: { value: null },
  uShMat: { value: new THREE.Matrix4() },
  uShOn: { value: 0 },
};
const SUNSH_GLSL = `
uniform sampler2DShadow uShMap;
uniform mat4 uShMat;
uniform float uShOn;
float sunLit(vec3 p) {
  if (uShOn < 0.5) return 1.0;
  vec3 s = (uShMat * vec4(p, 1.0)).xyz;
  if (s.x < 0.002 || s.x > 0.998 || s.y < 0.002 || s.y > 0.998 || s.z > 1.0) return 1.0;
  return texture(uShMap, vec3(s.xy, s.z - 0.0004));
}
`;
const ARCH_GLSL = `
uniform vec4 uArchP[3];
uniform vec4 uArchQ[3];
uniform float uArchK;
float archFade(vec4 Q, float h) { return smoothstep(-0.5, 0.35, h) * (1.0 - smoothstep(Q.y * 0.45, Q.y, h)); }
`;

const FS_VERT = `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const NOISE_GLSL$1 = `
float uwHash13(vec3 p3) { p3 = fract(p3 * 0.1031); p3 += dot(p3, p3.zyx + 31.32); return fract((p3.x + p3.y) * p3.z); }
float uwNoise3(vec3 x) {
  vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  float n000 = uwHash13(i);
  float n100 = uwHash13(i + vec3(1.0, 0.0, 0.0));
  float n010 = uwHash13(i + vec3(0.0, 1.0, 0.0));
  float n110 = uwHash13(i + vec3(1.0, 1.0, 0.0));
  float n001 = uwHash13(i + vec3(0.0, 0.0, 1.0));
  float n101 = uwHash13(i + vec3(1.0, 0.0, 1.0));
  float n011 = uwHash13(i + vec3(0.0, 1.0, 1.0));
  float n111 = uwHash13(i + vec3(1.0, 1.0, 1.0));
  return mix(mix(mix(n000, n100, f.x), mix(n010, n110, f.x), f.y),
             mix(mix(n001, n101, f.x), mix(n011, n111, f.x), f.y), f.z);
}
float uwFbm3(vec3 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { s += a * uwNoise3(p); p = p * 2.03 + vec3(1.7, 9.2, 3.1); a *= 0.5; }
  return s;
}
float uwHash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float uwNoise2(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(uwHash12(i), uwHash12(i + vec2(1.0, 0.0)), f.x), mix(uwHash12(i + vec2(0.0, 1.0)), uwHash12(i + vec2(1.0, 1.0)), f.x), f.y);
}
`;

const SHAFT_GLSL = `
vec2 uwSway(vec2 e, float t) {
  return e + vec2(0.8, 0.6) * (0.9 * sin(dot(e, vec2(0.8, 0.6)) * 0.21 - t * 1.05))
           + vec2(-0.5, 0.87) * (0.6 * sin(dot(e, vec2(-0.5, 0.87)) * 0.27 - t * 1.3 + 1.7));
}
float uwBundleAt(vec2 s, float t) {
  vec2 q = s * 0.14;
  float n = uwNoise2(q + vec2(t * 0.021, -t * 0.014)) * 0.62
          + uwNoise2(mat2(0.8, -0.6, 0.6, 0.8) * q * 2.3 + vec2(-t * 0.033, t * 0.026) + 7.1) * 0.38;
  return smoothstep(0.46, 0.78, n);
}
float uwBundle(vec2 e, float t) { return uwBundleAt(uwSway(e, t), t); }
float uwRays(vec2 e, float t) {
  vec2 s = uwSway(e, t);
  float r = textureLod(uCaustics, s / (uCausticTile * 1.9), 3.3).g * 5.0;
  return uwBundleAt(s, t) * clamp(r, 0.25, 2.2);
}
float uwRaysSoft(vec2 e, float t, float w) {
  vec2 s = uwSway(e, t);
  vec2 q = s * 0.14;
  float n2 = uwNoise2(mat2(0.8, -0.6, 0.6, 0.8) * q * 2.3 + vec2(-t * 0.033, t * 0.026) + 7.1);
  float n = uwNoise2(q + vec2(t * 0.021, -t * 0.014)) * 0.62 + (0.5 + (n2 - 0.5) * (1.0 - 0.5 * w)) * 0.38;
  float b = smoothstep(0.46 - 0.12 * w, 0.78 + 0.08 * w, n) * (1.0 - 0.175 * w);
  float r = textureLod(uCaustics, s / (uCausticTile * 1.9), 3.3 + 1.8 * w).g * 5.0;
  return b * clamp(r, 0.25, 2.2);
}
`;

const WAVE_SURF_GLSL = `
float waveSurfAt(vec2 p, float t) {
  vec2 p0 = p;
  for (int j = 0; j < 3; j++) {
    vec2 dsp = vec2(0.0);
    for (int i = 0; i < NWAVES; i++) dsp += W_Q[i] * W_A[i] * W_DIR[i] * cos(W_K[i] * dot(W_DIR[i], p0) - W_W[i] * t + W_P[i]);
    p0 = p - dsp;
  }
  return waveHeightAt(p0, t);
}
`;

const WATER = {
  uAbs: { value: new THREE.Vector3(0.40, 0.105, 0.085) },
  uKd: { value: new THREE.Vector3(0.07, 0.042, 0.026) },
  uWaterDeep: { value: new THREE.Vector3(0.003, 0.034, 0.068) },
  uWaterMid: { value: new THREE.Vector3(0.004, 0.074, 0.128) },
  uWaterUp: { value: new THREE.Vector3(0.030, 0.270, 0.380) },
  uWaterSun: { value: new THREE.Vector3(0.050, 0.250, 0.190) },
  uAdapt: { value: 0.72 },
  uCamRel: { value: 10 },
  uLensR: { value: 0.2 },
  uXing: { value: 0 },
  uSceneH: { value: 720 },
  tSceneDepth: { value: null },
  tSceneColor: { value: null },
};

const WATER_GLSL = `
uniform vec3 uAbs;
uniform vec3 uKd;
uniform vec3 uWaterDeep;
uniform vec3 uWaterMid;
uniform vec3 uWaterUp;
uniform vec3 uWaterSun;
vec3 waterColor(vec3 V, float camDepth) {
  float u = V.y + 0.05;
  vec3 c = u >= 0.0 ? mix(uWaterMid, uWaterUp, smoothstep(0.0, 0.8, u))
                    : mix(uWaterMid, uWaterDeep, smoothstep(0.0, 0.8, -u));
  float mu = dot(V, uSunW);
  c += uWaterSun * (0.3 * pow(0.5 + 0.5 * mu, 4.0) + 0.7 * pow(max(mu, 0.0), 24.0));
  return c * exp(-camDepth * uKd) * uLight;
}
vec3 waterTau(float L) {
  vec3 t = uAbs * L;
  t.r *= L / (L + 12.0);
  return t;
}
vec3 waterScatter(vec3 V, float L, float camDepth) {
  vec3 ce = max(uAbs - uKd * V.y, uAbs * 0.35);
  return waterColor(V, camDepth) * (uAbs / ce) * (1.0 - exp(-ce * L));
}
`;

const VERT_WORLD = `
{
  mat4 uwM = modelMatrix;
  #ifdef USE_INSTANCING
    uwM = modelMatrix * instanceMatrix;
  #endif
  vec4 uwP = uwM * vec4(transformed, 1.0);
  vWPos = uwP.xyz;
  vWNrm = normalize((vec4(transformedNormal, 0.0) * viewMatrix).xyz);
  vObjPos = transformed;
  vObjScale = length(uwM[0].xyz);
}
`;

const FRAG_DECL = `
uniform sampler2D uCaustics;
uniform float uCausticTile;
uniform float uCausticStr;
uniform float uWarmNear;
uniform vec3 uSunW;
uniform float uWaterY;
uniform float uTime;
uniform float uLight;
uniform float uAdapt;
uniform float uEncrust;
uniform float uEncScale;
uniform vec3 uCrustCol;
uniform vec3 uPinkCol;
uniform vec3 uAlgaeCol;
uniform float uBumpAmt;
uniform float uBumpScale;
uniform float uCorrode;
uniform float uCorrodeScale;
uniform vec3 uPingPos;
uniform float uPingR;
uniform float uPingA;
varying vec3 vWPos;
varying vec3 vWNrm;
varying vec3 vObjPos;
varying float vObjScale;
${NOISE_GLSL$1}
${SHAFT_GLSL}
${ARCH_GLSL}
vec3 uwCaustic(vec3 wp) {
  float depth = uWaterY - wp.y;
  if (depth <= 0.0) return vec3(0.0);
  float s = depth / max(uSunW.y, 0.2);
  vec2 e = wp.xz + uSunW.xz * s;
  float far = smoothstep(6.0, 30.0, distance(wp, cameraPosition));
  float bias = clamp(0.35 + depth * 0.05, 0.35, 1.6) + far * 1.2;
  vec2 w = vec2(sin(e.y * 0.61 + uTime * 0.23) + sin(e.x * 0.37 - uTime * 0.17 + 1.3),
                sin(e.x * 0.53 - uTime * 0.19 + 2.1) + sin(e.y * 0.29 + uTime * 0.13 + 0.7)) * 0.35;
  vec3 c1 = texture2D(uCaustics, (e + w) / uCausticTile, bias).rgb;
  vec3 c2 = texture2D(uCaustics, (mat2(0.766, -0.643, 0.643, 0.766) * e - w * 0.7) / (uCausticTile * 1.618) + vec2(0.37, 0.61), bias + 0.3).rgb;
  vec3 c = mix(c1, c2, mix(0.25, 0.45, smoothstep(3.0, 15.0, depth)));
  return min(c, vec3(3.0)) * exp(-depth * 0.011);
}
`;

const FRAG_ENCRUST = `
float uwEnc = 0.0;
#ifdef UW_ENCRUST
{
  vec3 ep = vWPos * uEncScale;
  float up = clamp(vWNrm.y, 0.0, 1.0);
  float n1 = uwFbm3(ep * 1.9);
  float n2 = uwFbm3(ep * 0.9 + 11.0);
  float n3 = uwFbm3(ep * 2.7 + 5.0);
  float crust = smoothstep(0.58, 0.72, n1 + up * 0.08) * uEncrust;
  float pink = smoothstep(0.60, 0.74, n2) * uEncrust;
  float algae = smoothstep(0.66, 0.88, up * 0.7 + n3 * 0.55) * uEncrust;
  vec3 c = diffuseColor.rgb;
  c = mix(c, uCrustCol * (0.85 + 0.3 * n3), crust * 0.7);
  c = mix(c, uPinkCol * (0.8 + 0.4 * n1), pink * 0.7);
  c = mix(c, uAlgaeCol * (0.8 + 0.4 * n2), algae * 0.75);
  diffuseColor.rgb = c;
  uwEnc = clamp(max(crust, max(pink, algae)), 0.0, 1.0);
}
#endif
float uwCorr = 0.0;
float uwRim = 0.0;
float uwCorrH = 0.0;
#ifdef UW_CORRODE
{
  vec3 op = vObjPos * (vObjScale * uCorrodeScale * 0.35);
  float cn = uwFbm3(op);
  vec3 ow = vObjPos * vObjScale;
  float sweep = uwNoise3(ow * 1.1 + 2.7) * 0.75 + uwNoise3(ow * 2.9 + 8.1) * 0.25;
  float edge = sweep + (cn - 0.5) * 0.05 - (uCorrode * 1.16 - 0.08);
  uwCorr = 1.0 - smoothstep(-0.03, 0.0, edge);
  uwRim = exp(-abs(edge) * 80.0) * 0.26 * smoothstep(0.0, 0.1, uCorrode) * (1.0 - smoothstep(0.9, 1.0, uCorrode));
  float pit = uwNoise3(op * 2.6 + 9.0);
  float tone = uwNoise3(op * 0.6 + 3.0);
  vec3 verd = mix(vec3(0.15, 0.29, 0.24), vec3(0.21, 0.35, 0.29), tone);
  verd = mix(verd, vec3(0.34, 0.37, 0.31), smoothstep(0.6, 0.85, cn) * 0.45);
  float pits = smoothstep(0.62, 0.8, pit);
  verd = mix(verd, vec3(0.28, 0.12, 0.07), pits * 0.75);
  diffuseColor.rgb = mix(diffuseColor.rgb, verd, uwCorr);
  uwCorrH = (cn - 0.5) * 0.8 - pits * 0.6;
}
#endif
`;

const FRAG_ROUGH = `
#ifdef UW_ENCRUST
  roughnessFactor = mix(roughnessFactor, 0.92, uwEnc);
  metalnessFactor = mix(metalnessFactor, 0.0, uwEnc);
#endif
#ifdef UW_CORRODE
  roughnessFactor = mix(roughnessFactor, 0.9, uwCorr);
  metalnessFactor = mix(metalnessFactor, 0.06, uwCorr);
#endif
`;

const FRAG_EMISSIVE = `
#ifdef UW_CORRODE
  totalEmissiveRadiance += vec3(1.0, 0.62, 0.30) * uwRim * 0.8;
#endif
if (uPingA > 0.001) {
  float pingD = length(vWPos.xz - uPingPos.xz) - uPingR;
  pingD += (uwNoise3(vec3(vWPos.xz * 0.9, uPingR * 0.15)) - 0.5) * 0.9;
  float pw = max(0.35, fwidth(pingD) * 1.5);
  float band = exp(-pingD * pingD / (pw * pw)) * (0.35 / pw);
  float trail = pingD < 0.0 ? exp(pingD * 0.28) * 0.12 : 0.0;
  float face = mix(0.3, 1.0, smoothstep(0.1, 0.6, vWNrm.y));
  float fade = smoothstep(0.6, 2.5, uPingR) * (1.0 - smoothstep(20.0, 29.0, uPingR));
  totalEmissiveRadiance += vec3(0.16, 0.78, 0.70) * min((band * 0.55 + trail) * face * fade * uPingA, 0.9);
}
`;

const FRAG_BUMP = `
#ifdef UW_BUMP
{
  vec3 bp = vWPos * uBumpScale;
  float be = 0.07;
  float b0 = uwFbm3(bp);
  vec3 gW = vec3(uwFbm3(bp + vec3(be, 0.0, 0.0)) - b0, uwFbm3(bp + vec3(0.0, be, 0.0)) - b0, uwFbm3(bp + vec3(0.0, 0.0, be)) - b0) / be;
  vec3 gV = (viewMatrix * vec4(gW, 0.0)).xyz;
  gV -= normal * dot(normal, gV);
  normal = normalize(normal - gV * uBumpAmt);
}
#endif
#ifdef UW_CORRODE
{
  vec3 uwSp = -vViewPosition;
  vec3 uwSx = normalize(dFdx(uwSp)), uwSy = normalize(dFdy(uwSp));
  vec3 uwR1 = cross(uwSy, normal), uwR2 = cross(normal, uwSx);
  float uwDet = dot(uwSx, uwR1) * faceDirection;
  float uwH = uwCorrH * uwCorr;
  vec3 uwGr = sign(uwDet) * (dFdx(uwH) * uwR1 + dFdy(uwH) * uwR2);
  normal = normalize(abs(uwDet) * normal - uwGr * 0.6);
}
#endif
`;

const FRAG_CAUSTIC_PRE = `
vec3 causticMod = vec3(1.0);
if (vWPos.y < uWaterY) {
  float lightDepth = uWaterY - vWPos.y;
  vec3 cz = uwCaustic(vWPos);
  float cK = uCausticStr * mix(1.0, 0.46, smoothstep(4.0, 18.0, lightDepth)) * (1.0 - 0.5 * smoothstep(10.0, 40.0, distance(vWPos, cameraPosition)));
  causticMod = mix(vec3(1.0), vec3(0.6) + cz * 1.9, cK);
  float sP = lightDepth / max(uSunW.y, 0.2);
  float pb = uwBundle(vWPos.xz + uSunW.xz * sP, uTime);
  float pk = uCausticStr * smoothstep(2.0, 8.0, lightDepth);
  causticMod *= mix(vec3(1.0), mix(vec3(0.4, 0.42, 0.47), vec3(1.98, 1.92, 1.6), pb), pk);
  vec3 uwDn = exp(-vec3(0.11 * (1.0 - 0.3 * pb * pk), 0.033, 0.026) * lightDepth);
  causticMod *= mix(uwDn, vec3(dot(uwDn, vec3(0.2126, 0.7152, 0.0722))), uAdapt);
}
causticMod *= uLight;
`;

const FRAG_WARM = `
if (uWarmNear > 0.001 && vWPos.y < uWaterY) {
  float uwDeep = clamp((1.0 - exp(-0.077 * (uWaterY - vWPos.y))) / 0.7, 0.0, 1.0);
  vec3 uwWarm = mix(vec3(1.0), vec3(1.22, 0.98, 0.9), (1.0 - smoothstep(2.5, 9.0, distance(vWPos, cameraPosition))) * uwDeep * uWarmNear);
  reflectedLight.directDiffuse *= uwWarm;
  reflectedLight.indirectDiffuse *= uwWarm;
  #if defined( STANDARD )
    reflectedLight.directSpecular *= mix(vec3(1.0), uwWarm, metalnessFactor);
    reflectedLight.indirectSpecular *= mix(vec3(1.0), uwWarm, metalnessFactor);
  #endif
}
`;

const FRAG_ARCH = `
if (uArchK > 0.001 && vWPos.y < uWaterY) {
  vec3 aS = normalize(uSunW), aE = vec3(0.0);
  for (int i = 0; i < 3; i++) {
    vec4 P = uArchP[i], Q = uArchQ[i];
    vec3 v = vWPos - P.xyz;
    float a = dot(v, aS), R2 = P.w * P.w;
    float r2 = max(dot(v, v) - a * a, 0.0) / R2;
    vec3 dp = P.xyz + aS * ((Q.x + 0.3 - P.y) / max(aS.y, 0.2)) - vWPos;
    float l2 = dot(dp, dp);
    if (Q.z <= 0.0 || (r2 > 7.0 && l2 > 36.0)) continue;
    vec3 aN = normalize(vWNrm);
    float h = vWPos.y - Q.x;
    float hs = Q.y;
    float sh = exp(-r2 * 1.8) * archFade(Q, h) * (1.0 - smoothstep(hs - 0.3, hs + 0.5, h));
    #ifdef UW_SUNLIT
    sh *= uwSunLit;
    #endif
    float web = 1.0;
    if (sh > 0.01) {
      vec2 ae = vWPos.xz + aS.xz * ((uWaterY - vWPos.y) / max(aS.y, 0.2));
      web = 0.45 + 1.5 * texture2D(uCaustics, ae / uCausticTile + vec2(0.13 * float(i), 0.0), 0.8).g
                 + 0.6 * texture2D(uCaustics, ae / (uCausticTile * 1.618) + vec2(0.37, 0.61), 1.4).g;
    }
    float bo = max(dot(aN, dp) * inversesqrt(l2 + 1e-3), 0.0) / (1.0 + l2 / (R2 * 3.0)) * (1.0 - smoothstep(16.0, 36.0, l2));
    float rim = 0.0;
    if (r2 < 7.0 && h > 0.6) {
      vec3 aV = cameraPosition - vWPos;
      float cd = length(aV);
      vec3 pp = v - aS * a;
      rim = pow(1.0 - clamp(dot(aN, aV / cd), 0.0, 1.0), 2.5) * max(-dot(aN, pp) * inversesqrt(dot(pp, pp) + 1e-4), 0.0) * exp(-r2 * 0.22)
          * smoothstep(0.6, 1.6, h) * smoothstep(4.0, 10.0, cd);
    }
    float up = dot(aN, aS);
    aE += Q.z * (sh * (0.8 * max(up, 0.0) + 0.2 * smoothstep(-0.25, 0.3, up)) * web + Q.w * (bo + rim * 0.9));
  }
  reflectedLight.directDiffuse += diffuseColor.rgb * vec3(0.86, 1.0, 0.84) * aE * (uArchK * uLight);
}
`;

const DIR_TARGET$1 = 'getDirectionalLightInfo( directionalLight, directLight );';
const DIR_SHADOW = 'directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;';
function sunLitCapture(lfb) {
  if (!lfb.includes(DIR_SHADOW)) return lfb;
  return '#define UW_SUNLIT\nfloat uwSunLit = 1.0;\n' + lfb.replace(DIR_SHADOW, '{ float uwShK = ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;\n\t\tdirectLight.color *= uwShK;\n\t\tuwSunLit = min( uwSunLit, 1.0 - ( 1.0 - uwShK ) / max( directionalLightShadow.shadowIntensity, 0.05 ) ); }');
}

function patchMaterial(mat, o = {}) {
  if (mat.userData.uwPatched) return mat;
  mat.userData.uwPatched = true;
  const prev = mat.onBeforeCompile;
  const prevKey = mat.customProgramCacheKey();
  const defs = {};
  const feat = [];
  if (o.encrust) { defs.UW_ENCRUST = ''; feat.push('E'); }
  if (o.bump) { defs.UW_BUMP = ''; feat.push('B'); }
  if (o.corrode) { defs.UW_CORRODE = ''; feat.push('C'); }
  mat.defines = Object.assign({}, mat.defines || {}, defs);
  const local = {
    uEncrust: { value: o.encrust || 0 },
    uEncScale: { value: o.encScale || 1.6 },
    uCrustCol: { value: new THREE.Color().setRGB(...(o.crust || [0.86, 0.84, 0.76])) },
    uPinkCol: { value: new THREE.Color().setRGB(...(o.pink || [0.86, 0.42, 0.58])) },
    uAlgaeCol: { value: new THREE.Color().setRGB(...(o.algae || [0.30, 0.52, 0.18])) },
    uBumpAmt: { value: o.bump || 0 },
    uBumpScale: { value: o.bumpScale || 2.0 },
    uCorrode: o.corrodeU || { value: o.corrode ? 1 : 0 },
    uCorrodeScale: { value: o.corrodeScale || 55 },
  };
  mat.userData.uw = local;
  mat.onBeforeCompile = function (shader, renderer) {
    if (prev) prev.call(this, shader, renderer);
    Object.assign(shader.uniforms, {
      uCaustics: U.uCaustics, uCausticTile: U.uCausticTile, uCausticStr: U.uCausticStr, uWarmNear: U.uWarmNear,
      uSunW: U.uSunW, uWaterY: U.uWaterY, uTime: U.uTime, uLight: U.uLight, uAdapt: WATER.uAdapt,
      uPingPos: U.uPingPos, uPingR: U.uPingR, uPingA: U.uPingA,
    }, ARCH, local);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;\nvarying vec3 vWNrm;\nvarying vec3 vObjPos;\nvarying float vObjScale;')
      .replace('#include <project_vertex>', '#include <project_vertex>\n' + VERT_WORLD);
    let fs = shader.fragmentShader;
    fs = fs.replace('#include <common>', '#include <common>\n' + FRAG_DECL);
    fs = fs.replace('#include <color_fragment>', '#include <color_fragment>\n' + FRAG_ENCRUST);
    fs = fs.replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\n' + FRAG_ROUGH);
    fs = fs.replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n' + FRAG_BUMP);
    fs = fs.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n' + FRAG_EMISSIVE);
    const lfb = THREE.ShaderChunk.lights_fragment_begin;
    if (lfb.includes(DIR_TARGET$1)) {
      fs = fs.replace('#include <lights_fragment_begin>',
        FRAG_CAUSTIC_PRE + sunLitCapture(lfb).replace(DIR_TARGET$1, DIR_TARGET$1 + '\n\t\tdirectLight.color *= causticMod;'));
    } else {
      fs = fs.replace('#include <lights_fragment_end>',
        '#include <lights_fragment_end>\n' + FRAG_CAUSTIC_PRE + 'reflectedLight.directDiffuse *= causticMod;');
    }
    fs = fs.replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\n' + FRAG_WARM + FRAG_ARCH);
    shader.fragmentShader = fs;
  };
  mat.customProgramCacheKey = () => prevKey + '|uw' + feat.join('');
  return mat;
}

const CAUSTIC_WAVES = [[3, 1], [1, 3], [-2, 3], [4, -1], [-4, 2], [5, 3], [2, -5], [-5, -2], [6, 1], [-1, 7], [7, -4], [-6, 5]];
const CAUSTIC_MARGIN = 0.2;
const CAUSTIC_MESH_VERT = `
uniform float uTime;
uniform float uTile;
uniform float uDepth;
uniform vec4 uW[12];
varying vec2 vOld;
varying vec2 vNew;
void main() {
  vec2 p = position.xy;
  vec2 grad = vec2(0.0);
  for (int i = 0; i < 12; i++) {
    vec4 w = uW[i];
    grad += w.xy * w.z * cos(6.2831853 * dot(w.xy, p) - uTime * w.w + float(i) * 1.7);
  }
  vec3 n = normalize(vec3(-grad.x, 1.0, -grad.y));
  vec3 r = refract(vec3(0.0, -1.0, 0.0), n, 0.7502);
  vOld = p;
  vNew = p + r.xz * (uDepth / max(-r.y, 0.3)) / uTile;
  gl_Position = vec4(vNew * 2.0 - 1.0, 0.0, 1.0);
}
`;
const CAUSTIC_MESH_FRAG = `
varying vec2 vOld;
varying vec2 vNew;
void main() {
  float a0 = length(dFdx(vOld)) * length(dFdy(vOld));
  float a1 = length(dFdx(vNew)) * length(dFdy(vNew));
  float I = a0 / max(a1, a0 * 0.08);
  gl_FragColor = vec4(vec3(I * 0.2), 1.0);
}
`;

const CAUSTIC_BLUR_FRAG = `
uniform sampler2D tSrc;
uniform vec2 uDir;
varying vec2 vUv;
void main() {
  vec3 c = texture2D(tSrc, vUv).rgb * 0.2042;
  c += (texture2D(tSrc, fract(vUv + uDir)).rgb + texture2D(tSrc, fract(vUv - uDir)).rgb) * 0.1802;
  c += (texture2D(tSrc, fract(vUv + uDir * 2.0)).rgb + texture2D(tSrc, fract(vUv - uDir * 2.0)).rgb) * 0.1238;
  c += (texture2D(tSrc, fract(vUv + uDir * 3.0)).rgb + texture2D(tSrc, fract(vUv - uDir * 3.0)).rgb) * 0.0663;
  c += (texture2D(tSrc, fract(vUv + uDir * 4.0)).rgb + texture2D(tSrc, fract(vUv - uDir * 4.0)).rgb) * 0.0276;
  gl_FragColor = vec4(c, 1.0);
}
`;

class Caustics {
  constructor(size = 512, { grid = 160, depth = 9, steep = 0.035, speed = 0.35, blur = 2.2 } = {}) {
    const opts = (mips) => ({
      type: THREE.HalfFloatType,
      wrapS: THREE.RepeatWrapping, wrapT: THREE.RepeatWrapping,
      minFilter: mips ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter, magFilter: THREE.LinearFilter,
      generateMipmaps: mips, depthBuffer: false,
    });
    this.raw = new THREE.WebGLRenderTarget(size, size, opts(false));
    this.tmp = new THREE.WebGLRenderTarget(size, size, opts(false));
    this.rt = new THREE.WebGLRenderTarget(size, size, opts(true));
    this.blurMat = new THREE.ShaderMaterial({
      uniforms: { tSrc: { value: null }, uDir: { value: new THREE.Vector2() } },
      vertexShader: FS_VERT, fragmentShader: CAUSTIC_BLUR_FRAG, depthTest: false, depthWrite: false,
    });
    this.blurStep = blur / size;
    this.blurScene = new THREE.Scene();
    const bq = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.blurMat);
    bq.frustumCulled = false;
    this.blurScene.add(bq);
    const tile = U.uCausticTile.value;
    const waves = CAUSTIC_WAVES.map(([kx, ky]) => {
      const kl = Math.hypot(kx, ky);
      const kWorld = (2 * Math.PI * kl) / tile;
      return new THREE.Vector4(kx, ky, steep / kl, Math.sqrt(9.81 * kWorld) * speed);
    });
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uTime: U.uTime, uTile: U.uCausticTile, uDepth: { value: depth }, uW: { value: waves } },
      vertexShader: CAUSTIC_MESH_VERT, fragmentShader: CAUSTIC_MESH_FRAG,
      transparent: true, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, side: THREE.DoubleSide,
    });
    const span = 1 + 2 * CAUSTIC_MARGIN;
    const segs = Math.round(grid * span);
    const geo = new THREE.PlaneGeometry(span, span, segs, segs);
    geo.translate(0.5, 0.5, 0);
    const mesh = new THREE.Mesh(geo, this.mat);
    mesh.frustumCulled = false;
    this.scene = new THREE.Scene();
    this.scene.add(mesh);
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this._cc = new THREE.Color();
    this._n = 0;
    U.uCaustics.value = this.rt.texture;
  }
  render(renderer) {
    if (U.uCausticStr.value <= 0 && this._n > 0) return;
    this._n++;
    const prev = renderer.getRenderTarget();
    renderer.getClearColor(this._cc);
    const ca = renderer.getClearAlpha();
    renderer.setClearColor(0x000000, 1);
    renderer.setRenderTarget(this.raw);
    renderer.render(this.scene, this.cam);
    const bu = this.blurMat.uniforms;
    bu.tSrc.value = this.raw.texture;
    bu.uDir.value.set(this.blurStep, 0);
    renderer.setRenderTarget(this.tmp);
    renderer.render(this.blurScene, this.cam);
    bu.tSrc.value = this.tmp.texture;
    bu.uDir.value.set(0, this.blurStep);
    renderer.setRenderTarget(this.rt);
    renderer.render(this.blurScene, this.cam);
    renderer.setRenderTarget(prev);
    renderer.setClearColor(this._cc, ca);
  }
}

function makeUnderwaterEnv(renderer, sunW) {
  const scene = new THREE.Scene();
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: { uSun: { value: sunW.clone() }, uAdapt: { value: WATER.uAdapt.value } },
    vertexShader: `varying vec3 vD; void main(){ vD = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      uniform vec3 uSun; uniform float uAdapt; varying vec3 vD;
      void main(){
        vec3 d = normalize(vD);
        vec3 up = vec3(0.34, 0.95, 1.05);
        vec3 mid = vec3(0.025, 0.26, 0.34);
        vec3 lo = vec3(0.008, 0.07, 0.12);
        vec3 c = d.y > 0.0 ? mix(mid, up * 0.55, pow(d.y, 0.8)) : mix(mid, lo, pow(-d.y, 0.6));
        c += up * smoothstep(0.58, 0.74, d.y) * 1.1;
        c = mix(c, vec3(dot(c, vec3(0.2126, 0.7152, 0.0722))), uAdapt * 0.55);
        float s = max(dot(d, uSun), 0.0);
        c += vec3(1.0, 0.98, 0.9) * (pow(s, 48.0) * 5.0 + pow(s, 6.0) * 0.4);
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(10, 48, 24), mat));
  const pmrem = new THREE.PMREMGenerator(renderer);
  const rt = pmrem.fromScene(scene, 0.03, 0.1, 100);
  pmrem.dispose();
  return rt.texture;
}

function makeHeroEnv(renderer) {
  const scene = new THREE.Scene();
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    vertexShader: `varying vec3 vD; void main(){ vD = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      varying vec3 vD;
      float box(vec3 d, vec3 c, float w, float h) {
        vec3 t1 = normalize(cross(c, vec3(0.0, 1.0, 0.0)));
        vec3 t2 = cross(t1, c);
        float x = dot(d, t1), y = dot(d, t2), z = dot(d, c);
        return step(0.0, z) * smoothstep(w, w * 0.8, abs(x)) * smoothstep(h, h * 0.8, abs(y));
      }
      void main(){
        vec3 d = normalize(vD);
        vec3 top = vec3(1.05, 0.86, 0.60);
        vec3 mid = vec3(0.24, 0.16, 0.09);
        vec3 bot = vec3(0.03, 0.05, 0.05);
        vec3 c = d.y > 0.0 ? mix(mid, top, pow(d.y, 0.9)) : mix(mid, bot, pow(-d.y, 0.5));
        c += vec3(0.10, 0.55, 0.60) * pow(max(0.0, 1.0 - abs(d.y)), 8.0) * 0.45;
        c += vec3(5.0, 4.5, 3.6) * box(d, normalize(vec3(0.6, 0.55, 0.6)), 0.32, 0.2);
        c += vec3(2.6, 2.8, 3.0) * box(d, normalize(vec3(-0.8, 0.25, 0.3)), 0.14, 0.5);
        c += vec3(1.8, 1.4, 0.9) * box(d, normalize(vec3(0.1, 0.9, -0.4)), 0.45, 0.28);
        c += vec3(1.2, 1.0, 0.7) * box(d, normalize(vec3(0.2, 0.1, -0.95)), 0.25, 0.12);
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(10, 64, 32), mat));
  const pmrem = new THREE.PMREMGenerator(renderer);
  const rt = pmrem.fromScene(scene, 0.015, 0.1, 100);
  pmrem.dispose();
  return rt.texture;
}

const VIEWPOS_GLSL = `
vec3 viewPos(vec2 uv, float d) {
  vec4 c = vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0);
  vec4 v = uProjInv * c;
  return v.xyz / v.w;
}
`;

const GOD_FRAG = `
uniform sampler2D tDepth;
uniform sampler2D uCaustics;
uniform float uCausticTile;
uniform mat4 uProjInv;
uniform mat4 uViewInv;
uniform vec3 uCamPos;
uniform vec3 uSunW;
uniform float uWaterY;
uniform float uTime;
uniform float uLight;
varying vec2 vUv;
${VIEWPOS_GLSL}
${NOISE_GLSL$1}
${SHAFT_GLSL}
${SUNSH_GLSL}
float ign(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
float shaftLit(vec3 p, float s) {
  float l = sunLit(p);
  if (l > 0.999) return 1.0;
  if (s >= 3.5) l = mix(l, 1.0, (1.0 - sunLit(p + uSunW * (s - 3.0))) * mix(0.7, 0.9, smoothstep(4.0, 18.0, s)));
  return mix(0.12, 1.0, l);
}
void main() {
  if (uCamPos.y > uWaterY + 0.5) { gl_FragColor = vec4(0.0); return; }
  float d = texture2D(tDepth, vUv).x;
  vec3 wp = (uViewInv * vec4(viewPos(vUv, d), 1.0)).xyz;
  vec3 ro = uCamPos;
  vec3 rd = wp - ro;
  float len = length(rd);
  rd /= max(len, 1e-4);
  float far = d >= 0.99999 ? 200.0 : min(len, 200.0);
  float maxT = min(far, 60.0);
  if (rd.y > 0.001) maxT = min(maxT, max((uWaterY - ro.y) / rd.y, 0.0));
  const int STEPS = 20;
  float stepT = maxT / float(STEPS);
  float t = stepT * ign(gl_FragCoord.xy);
  float acc = 0.0;
  float mu0 = dot(rd, uSunW);
  float wv = smoothstep(0.4, 0.92, sqrt(max(1.0 - mu0 * mu0, 0.0)))
           * (1.0 - smoothstep(13.0, 18.0, uWaterY - ro.y));
  for (int i = 0; i < STEPS; i++) {
    vec3 p = ro + rd * t;
    float s = max(uWaterY - p.y, 0.0) / max(uSunW.y, 0.2);
    vec2 e = p.xz + uSunW.xz * s;
    float w = wv * (0.8 + 0.2 * smoothstep(0.0, 14.0, s));
    acc += (uwRaysSoft(e, uTime, w) * shaftLit(p, s) - 0.24) * exp(-s * 0.05) * exp(-t * 0.05) * stepT;
    t += stepT;
  }
  float mu = dot(rd, uSunW);
  float night = 1.0 - smoothstep(0.3, 0.75, uLight);
  float g = mix(0.5, 0.2, night);
  float phase = (1.0 - g * g) / pow(1.0 + g * g - 2.0 * g * mu, 1.5);
  float k = (0.03 + 0.02 * phase) * mix(1.0, 0.18, night);
  gl_FragColor = vec4(vec3(0.8, 1.0, 0.76) * acc * k, far);
}
`;

const GOD_BLUR_FRAG = `
uniform sampler2D tSrc;
uniform vec2 uDir;
varying vec2 vUv;
void main() {
  vec4 c0 = texture2D(tSrc, vUv);
  float z0 = c0.a;
  float tol = 0.06 + 0.12 * z0;
  vec3 acc = c0.rgb * 0.2270;
  float ws = 0.2270;
  for (int i = 1; i <= 4; i++) {
    float w0 = i == 1 ? 0.1946 : i == 2 ? 0.1216 : i == 3 ? 0.0541 : 0.0162;
    vec2 o = uDir * (float(i) * 1.6);
    vec4 a = texture2D(tSrc, vUv + o);
    vec4 b = texture2D(tSrc, vUv - o);
    float wa = w0 * exp(-abs(a.a - z0) / tol);
    float wb = w0 * exp(-abs(b.a - z0) / tol);
    acc += a.rgb * wa + b.rgb * wb;
    ws += wa + wb;
  }
  gl_FragColor = vec4(acc / ws, z0);
}
`;

const WL_GLSL = `
float wlH1(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float wlN(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(wlH1(i), wlH1(i + vec2(1.0, 0.0)), f.x), mix(wlH1(i + vec2(0.0, 1.0)), wlH1(i + vec2(1.0, 1.0)), f.x), f.y);
}
float wlRag(float x, float t) {
  return (wlN(vec2(x * 2.2 + t * 1.1, t * 0.7)) - 0.5) * 0.30
       + (wlN(vec2(x * 6.5 - t * 2.3, 3.1 + t * 1.3)) - 0.5) * 0.16
       + (wlN(vec2(x * 17.0 + t * 3.9, 7.3 - t * 0.9)) - 0.5) * 0.06
       + (wlN(vec2(x * 41.0 - t * 5.3, 11.9)) - 0.5) * 0.02;
}
`;

const COMP_FRAG = `
uniform sampler2D tScene;
uniform sampler2D tDepth;
uniform sampler2D tGod;
uniform mat4 uProjInv;
uniform mat4 uViewInv;
uniform vec3 uCamPos;
uniform float uTime;
uniform float uLight;
uniform float uWaterY;
uniform vec3 uSunW;
uniform float uGodStr;
uniform float uGodOn;
uniform vec2 uGodRes;
uniform vec2 uRes;
uniform vec3 uHaze;
uniform float uHazeDen;
uniform float uLensR;
uniform float uCamRel;
uniform vec3 uSheet;
uniform float uLightK;
uniform float uXing;
uniform float uHistK;
uniform mat4 uCamPV;
const float MIR_D = 0.1;
uniform sampler2D tHist;
uniform mat4 uHistPV;
uniform mat4 uHistProjInv;
uniform mat4 uHistViewInv;
uniform vec3 uHistPos;
varying vec2 vUv;
${VIEWPOS_GLSL}
${WAVES_GLSL}
${WAVE_SURF_GLSL}
${NOISE_GLSL$1}
${WATER_GLSL}
${WL_GLSL}
${ARCH_GLSL}
${SUNSH_GLSL}
float archErf(float x) { float a = abs(x), t = 1.0 + a * (0.278393 + a * (0.230389 + a * (0.000972 + a * 0.078108))); t *= t; return sign(x) * (1.0 - 1.0 / (t * t)); }
vec3 archVol(vec3 o, vec3 V, float t1) {
  vec3 S = normalize(uSunW), acc = vec3(0.0);
  float b = dot(V, S), s2 = max(1.0 - b * b, 0.03);
  vec3 e1 = normalize(cross(S, vec3(0.0, 0.0, 1.0)));
  for (int i = 0; i < 3; i++) {
    vec4 P = uArchP[i], Q = uArchQ[i];
    if (Q.z <= 0.0) continue;
    vec3 w = o - P.xyz;
    float d = dot(V, w), e = dot(S, w);
    vec3 wl = w - S * e;
    float hl = o.y - Q.x, rl = length(wl) / P.w;
    float t0 = 6.0 * (1.0 - smoothstep(1.0, 3.5, rl)) * (1.0 - smoothstep(Q.y, Q.y + 3.0, hl));
    if (t0 >= t1) continue;
    float ua = clamp(e, (Q.x - P.y) / max(S.y, 0.2), (Q.x + Q.y - P.y) / max(S.y, 0.2));
    float prox = mix(0.12, 1.0, smoothstep(2.2, 6.5, length(w - S * ua) / P.w));
    float tc = (b * e - d) / s2, sc = (e - b * d) / s2;
    vec3 c = w + V * tc - S * sc;
    float r2 = dot(c, c) / (P.w * P.w);
    if (r2 > 6.0 || tc < t0 - 3.0 * P.w || tc > t1 + 3.0 * P.w) continue;
    float sg = P.w / sqrt(1.8 * s2);
    float run = 0.886227 * sg * (archErf((t1 - tc) / sg) - archErf((t0 - tc) / sg));
    float h = o.y + V.y * clamp(tc, t0, t1) - Q.x;
    float fade = exp(-1.8 * r2);
    if (fade < 1e-3) continue;
    float ta = max(t0, tc - 1.7 * sg), tb = min(t1, tc + 1.7 * sg);
    if (tb <= ta) continue;
    float lw = 0.0, ls = 0.0;
    for (int k = 0; k < 5; k++) {
      float tk = mix(ta, tb, (float(k) + 0.5) / 5.0), gk = exp(-(tk - tc) * (tk - tc) / (sg * sg));
      ls += gk * archFade(Q, o.y + V.y * tk - Q.x) * sunLit(o + V * tk);
      lw += gk;
    }
    fade *= ls / max(lw, 1e-5);
    if (fade < 1e-3) continue;
    float xs = dot(c, e1) / P.w;
    float sn = uwNoise2(vec2(xs * 4.4 + float(i) * 5.7, h * 0.05 + uTime * 0.04)) * 0.55
             + uwNoise2(vec2(xs * 8.5 + float(i) * 3.1 + 11.0, h * 0.08 - uTime * 0.03)) * 0.45;
    float streak = 0.2 + 1.9 * smoothstep(0.28, 0.78, sn);
    float ph = 0.55 + 0.9 * pow(max(b, 0.0), 3.0);
    float near = mix(0.1, 1.2, smoothstep(3.0, 16.0, tc));
    acc += vec3(0.8, 1.0, 0.76) * (Q.z * run * fade * streak * ph * near * prox) * exp(-waterTau(clamp(tc, t0, t1)));
  }
  return acc;
}
vec4 histAlong(vec3 o, vec3 V, inout float t) {
  vec4 h = vec4(0.0, 0.0, 0.0, 1.0e4);
  for (int i = 0; i < 3; i++) {
    vec4 c = uHistPV * vec4(o + V * t, 1.0);
    vec2 q = clamp(c.xy / max(c.w, 1e-4) * 0.5 + 0.5, 0.5 / uRes, 1.0 - 0.5 / uRes);
    h = texture2D(tHist, q);
    vec4 fp = uHistProjInv * vec4(q * 2.0 - 1.0, 1.0, 1.0);
    vec3 dH = normalize(mat3(uHistViewInv) * (fp.xyz / fp.w));
    t = max(dot(uHistPos + dH * h.a - o, V), 0.004);
  }
  return h;
}
vec3 godUp(vec2 uv, float z) {
  vec2 st = uv * uGodRes - 0.5;
  vec2 b = floor(st), f = st - b;
  float tol = 0.08 + 0.1 * z;
  vec3 acc = vec3(0.0);
  float ws = 0.0;
  for (int j = 0; j < 2; j++) {
    for (int i = 0; i < 2; i++) {
      vec4 g = texture2D(tGod, (b + vec2(float(i), float(j)) + 0.5) / uGodRes);
      float w = (i == 0 ? 1.0 - f.x : f.x) * (j == 0 ? 1.0 - f.y : f.y) * exp(-abs(g.a - z) / tol) + 1e-5;
      acc += g.rgb * w;
      ws += w;
    }
  }
  return acc / ws;
}
float sceneZ(vec2 q) { return -viewPos(q, texture2D(tDepth, q).x).z; }
vec3 inscat(vec3 V, float Lw, float camDepth, vec2 q, float dx, float under) {
  vec3 s = waterScatter(V, Lw, camDepth);
  if (uGodOn > 0.5 && under > 0.001) s = max(s + godUp(q, min(dx, 200.0)) * (uGodStr * uLight * under), s * 0.35);
  return s;
}
const float UNDERSIDE_K = 1.0;
vec3 underside(vec3 hp, vec3 V, float camDepth) {
  vec2 e = vec2(0.06, 0.0);
  float h0 = waveSurfAt(hp.xz, uTime);
  vec3 N = vec3(-(waveSurfAt(hp.xz + e.xy, uTime) - h0) / e.x, 1.0, -(waveSurfAt(hp.xz + e.yx, uTime) - h0) / e.x);
  vec2 rq = hp.xz * 7.0 + vec2(uTime * 0.8, -uTime * 0.6);
  N = normalize(N + vec3(uwNoise2(rq) - 0.5, 0.0, uwNoise2(rq + 5.2) - 0.5) * 0.5);
  float ci = abs(dot(V, N));
  float tir = smoothstep(0.8, 1.1, 1.777 * (1.0 - ci * ci));
  vec3 Rw = reflect(V, N);
  Rw.y = -abs(Rw.y);
  return mix(uHaze * uLight * 0.6, waterScatter(Rw, 30.0, camDepth) * uLightK * UNDERSIDE_K, tir);
}
void main() {
  vec2 uv = vUv;
  float d = texture2D(tDepth, uv).x;
  bool sky = d >= 0.99999;
  vec3 wp = (uViewInv * vec4(viewPos(uv, d), 1.0)).xyz;
  vec3 V = normalize(wp - uCamPos);
  float dist = sky ? 1.0e4 : length(wp - uCamPos);
  float camDepth = max(uWaterY - uCamPos.y, 0.0);
  float under = 1.0;
  float L = dist;
  float men = 0.0;
  vec2 menOff = vec2(0.0);
  float menB = 0.0, sheetB = 0.0;
  vec2 sheetOff = vec2(0.0);
  float usynK = 0.0;
  vec3 usynC = vec3(0.0);
  float histK = 0.0;
  float mirK = 0.0;
  vec3 mirP = vec3(0.0);
  if (uCamRel > 0.8) {
    under = 0.0;
    L = 0.0;
  } else if (uCamRel > -0.45) {
    vec3 np = uCamPos + V * uLensR;
    float surfN = uWaterY + waveSurfAt(np.xz, uTime);
    float sp = 1.0 - smoothstep(0.06, 0.1, uLensR);
    float xw = uv.x * uRes.x / uRes.y;
    float rag = (uwNoise2(np.xz * 11.0 + vec2(uTime * 0.9, -uTime * 0.7)) - 0.5) * 0.010
              + (uwNoise2(np.xz * 31.0 - vec2(uTime * 1.9, uTime * 1.4)) - 0.5) * 0.003;
    if (sp > 0.0) rag = mix(rag, wlRag(xw, uTime) * uLensR, sp);
    float hN = np.y - surfN + rag;
    vec2 gh = vec2(dFdx(hN), dFdy(hN));
    float gw = max(length(gh), 1e-9);
    float hy = hN / gw / uRes.y;
    under = 1.0 - smoothstep(-0.012, 0.012, hy);
    if (uLensR < 0.1 && uXing < 0.5 && abs(uCamRel) < 0.03 && (sky || dist > 200.0) && V.y < -0.005) under = 1.0;
    float Lw = V.y > 1e-4 ? min(dist, max(surfN - np.y, 0.0) / V.y) : dist;
    bool fromAbove = uCamRel > 0.0;
    bool past = sky || (fromAbove ? dist > 200.0 || wp.y > uWaterY + waveSurfAt(wp.xz, uTime) - 0.05
                                  : wp.y > uWaterY + waveSurfAt(wp.xz, uTime) + 0.05 + 0.002 * dist);
    if (uLensR < 0.1 && past) {
      if (V.y > 1e-4) {
        usynK = 1.0 - smoothstep(0.6, 0.72, V.y);
        usynC = underside(np + V * Lw, V, camDepth);
      } else if (fromAbove && uXing < 0.5) Lw = 40.0;
    }
    if (uLensR < 0.1 && sp > 0.0 && V.y > 1e-3) {
      mirK = under * (1.0 - smoothstep(0.015, 0.1, V.y)) * (1.0 - smoothstep(0.0, MIR_D, abs(uCamRel)));
      mirP = np + V * min(Lw, 5.0);
    }
    if (uXing > 1.5 && uHistK > 0.5 && sp > 0.0 && under < 0.999) histK = 1.0;
    float La = 0.0;
    if (!sky && V.y < 0.0 && histK < 0.5) {
      float sub = uWaterY + waveSurfAt(wp.xz, uTime) - wp.y;
      La = smoothstep(0.5, 0.8, sub) * sub / max(-V.y, 0.08);
    }
    L = mix(La, Lw, under);
    float MW = mix(0.006, 0.011, sp);
    men = exp(-hy * hy / (MW * MW));
    menOff = -gh / gw * (hy / MW) * men * mix(0.007, 0.012, sp);
    float m1 = (hy - mix(0.0012, 0.003, sp)) / mix(0.0022, 0.004, sp), m2 = (hy + mix(0.008, 0.013, sp)) / mix(0.006, 0.009, sp);
    menB = mix(0.2, 0.32, sp) * exp(-m1 * m1) - mix(0.1, 0.16, sp) * exp(-m2 * m2);
    if (sp > 0.0 && abs(hy) < 0.05) {
      const float CW = 0.024;
      float xc = xw / CW;
      for (int j = -1; j <= 1; j++) {
        float id = floor(xc) + float(j);
        if (wlH1(vec2(id, 3.7)) > 0.6) continue;
        float h2 = wlH1(vec2(id, 8.1)), r = 0.003 + 0.010 * h2 * h2;
        vec2 d = vec2(xw - (id + 0.5 + (wlH1(vec2(id, 1.3)) - 0.5) * 0.5) * CW, hy - (0.001 + 0.7 * r)) / r;
        float d2 = dot(d, d);
        if (d2 >= 1.0) continue;
        float dd = sqrt(d2), body = (1.0 - smoothstep(0.8, 1.0, dd)) * sp;
        menOff += vec2(-d.x * r * uRes.y / uRes.x, -d.y * r) * 1.7 * body;
        menB += (0.22 * smoothstep(0.3, 0.9, -d.y) * (1.0 - smoothstep(0.7, 0.9, dd)) - 0.3 * smoothstep(0.75, 0.92, dd) * (1.0 - smoothstep(0.95, 1.0, dd))) * sp;
      }
    }
    if (uSheet.x > 0.001 && hy < 0.02) {
      float sk = uSheet.x * smoothstep(0.02, -0.003, hy) * exp(min(hy, 0.0) / uSheet.y);
      if (sk > 0.002) {
        vec2 pa = vec2(uv.x * uRes.x / uRes.y, uv.y);
        vec2 q = vec2(pa.x * 9.0, pa.y * 3.0 - uSheet.z * 2.6);
        vec2 sw = vec2(uwNoise2(q), uwNoise2(q * vec2(1.3, 1.1) + 7.1)) - 0.5;
        float riv = uwNoise2(vec2(pa.x * 26.0, pa.y * 1.4 - uSheet.z * 3.4));
        sheetOff = (sw * vec2(0.6, 1.0) * 0.011 + vec2(0.0, (riv - 0.5) * 0.006)) * sk * mix(1.0, 2.0, sp);
        sheetB = (riv - 0.5) * 0.06 * sk * mix(1.0, 1.6, sp);
      }
    }
  }
  vec2 wob = under * smoothstep(3.0, 10.0, dist) * vec2(sin(uv.y * 23.0 + uTime * 1.7), cos(uv.x * 19.0 + uTime * 1.3)) * 0.0011;
  float z0 = -viewPos(uv, d).z;
  vec2 hs = sign(wob) * 0.5 / uRes;
  vec2 ua = uv + wob - hs, ub = uv + wob + hs;
  float za = -viewPos(ua, texture2D(tDepth, ua).x).z, zb = -viewPos(ub, texture2D(tDepth, ub).x).z;
  wob *= step(max(abs(za - z0), abs(zb - z0)), 0.1 + 0.05 * z0);
  vec3 col = texture2D(tScene, uv + wob + menOff + sheetOff).rgb;
  if (usynK > 0.0) col = mix(col, usynC, usynK * under);
  if (mirK > 0.0) {
    vec2 rq = mirP.xz * 7.0 + vec2(uTime * 0.8, -uTime * 0.6);
    vec2 rw = vec2(uwNoise2(rq), uwNoise2(rq + 5.2)) - 0.5;
    vec2 hs = normalize(vec2(-V.z, V.x) + 1e-5);
    vec3 Vr = normalize(vec3(V.x + hs.x * rw.y * 0.03, -V.y * (1.0 + 0.9 * rw.x) - 0.002, V.z + hs.y * rw.y * 0.03));
    vec4 c = uCamPV * vec4(uCamPos + Vr * 50.0, 1.0);
    vec2 qr = c.xy / max(c.w, 1e-4) * 0.5 + 0.5;
    float inF = step(0.0, c.w) * smoothstep(0.0, 0.04, min(min(qr.x, 1.0 - qr.x), min(qr.y, 1.0 - qr.y)));
    if (inF > 0.0) {
      float dr0 = texture2D(tDepth, qr).x;
      float dr = dr0 >= 0.99999 ? 1.0e4 : length(viewPos(qr, dr0));
      vec3 mi = waterScatter(Vr, dr, camDepth) * uLightK;
      if (uGodOn > 0.5) mi = max(mi + godUp(qr, min(dr, 200.0)) * (uGodStr * uLight * uLightK), mi * 0.35);
      vec3 mir = texture2D(tScene, qr).rgb * exp(-waterTau(dr)) + mi;
      col = mix(col, mir, mirK * inF);
    }
  }
  float distA = dist;
  bool skyA = sky;
  if (histK > 0.0) {
    vec3 Vb = normalize(mat3(uViewInv) * viewPos(uv + wob + menOff + sheetOff, 1.0));
    float tH = 1.0e3;
    vec4 h = histAlong(uCamPos, vec3(Vb.x, abs(Vb.y), Vb.z), tH);
    vec3 ca = h.rgb;
    if (Vb.y < 0.0) {
      float fr = 0.02 + 0.98 * pow(1.0 - min(-Vb.y, 1.0), 5.0);
      ca = ca * fr + waterScatter(Vb, 40.0, camDepth) * uLightK * (1.0 - fr);
    }
    col = mix(ca, col, under);
    distA = h.a;
    skyA = h.a > 5000.0;
  }
  if (any(isnan(col)) || any(isinf(col))) col = vec3(0.0);
  float fl = dot(col, vec3(0.2126, 0.7152, 0.0722));
  if (fl > 24.0) col *= 24.0 / fl;
  vec3 ins = vec3(0.0);
  if (L > 1e-4) {
    col *= exp(-waterTau(L));
    ins = waterScatter(V, L, camDepth) * uLightK;
  }
  if (uGodOn > 0.5 && under > 0.001) ins = max(ins + godUp(uv, min(dist, 200.0)) * (uGodStr * uLight * uLightK * under), ins * 0.35);
  vec3 archIns = vec3(0.0);
  if (uArchK > 0.001 && under > 0.001) archIns = archVol(uCamPos, V, min(dist, 90.0)) * (0.45 * uArchK * uLight * uLightK * under);
  col += ins + archIns;
  vec2 off = menOff + sheetOff;
  if (L > 1e-4 && dot(off * uRes, off * uRes) < 0.25) {
    vec2 ox = vec2(1.0 / uRes.x, 0.0), oy = vec2(0.0, 1.0 / uRes.y);
    vec4 dz = abs(vec4(sceneZ(uv + ox), sceneZ(uv - ox), sceneZ(uv + oy), sceneZ(uv - oy)) - z0);
    bvec4 offS = greaterThan(dz, vec4(0.1 + 0.05 * z0));
    if (any(offS)) {
      const vec3 LW = vec3(0.2126, 0.7152, 0.0722);
      vec2 on[4] = vec2[4](ox, -ox, oy, -oy);
      vec3 cn[4];
      for (int i = 0; i < 4; i++) cn[i] = texture2D(tScene, uv + on[i]).rgb;
      vec3 c = texture2D(tScene, uv + wob + off).rgb, cs = c, co = c;
      vec2 o = ox;
      float best = -1.0;
      for (int i = 0; i < 4; i++) {
        for (int j = 0; j < 4; j++) {
          vec3 e = cn[j] - cn[i];
          if (offS[i] && !offS[j] && dot(e, e) > best) { best = dot(e, e); co = cn[i]; cs = cn[j]; o = on[i]; }
        }
      }
      if (best < 0.0) for (int i = 0; i < 4; i++) if (dot(cn[i], LW) > dot(co, LW)) { co = cn[i]; o = on[i]; }
      vec3 e = cs - co, cr = c / max(co, vec3(1e-4));
      float fm = min(min(cr.r, cr.g), cr.b);
      float f = clamp(best >= 0.0 ? min(dot(cs - c, e) / (dot(e, e) + 1e-3), fm) : dot(co, LW) > dot(c, LW) ? fm : 0.0, 0.0, 1.0);
      co *= min(1.0, 24.0 / max(dot(co, LW), 1e-4));
      float dO = texture2D(tDepth, uv + o).x;
      float distO = dO >= 0.99999 ? 1.0e4 : length(viewPos(uv + o, dO));
      float LO = L < dist - 0.01 && V.y > 0.0 ? min(L, distO) : max(L + distO - dist, 0.0);
      vec3 insO = ins * inscat(V, LO, camDepth, uv + o, distO, under) / max(inscat(V, L, camDepth, uv, dist, under), vec3(1e-6));
      vec3 corr = f * (co * (exp(-waterTau(LO)) - exp(-waterTau(L))) + insO - ins);
      if (!any(isnan(corr)) && !any(isinf(corr))) col += corr;
    }
  }
  if (!skyA) col = mix(col, uHaze * uLight, (1.0 - exp(-distA * uHazeDen)) * (1.0 - under));
  col *= 1.0 + menB + sheetB;
  gl_FragColor = vec4(col, 1.0);
}
`;

const HIST_FRAG = `
uniform sampler2D tScene;
uniform sampler2D tDepth;
uniform mat4 uProjInv;
varying vec2 vUv;
${VIEWPOS_GLSL}
void main() {
  float d = texture2D(tDepth, vUv).x;
  gl_FragColor = vec4(texture2D(tScene, vUv).rgb, d >= 0.99999 ? 1.0e4 : min(length(viewPos(vUv, d)), 1.0e4));
}
`;

const UP_FRAG = `
uniform sampler2D tSrc;
uniform vec2 uSrc;
varying vec2 vUv;
void main() {
  vec2 st = vUv * uSrc - 0.5;
  vec2 b = floor(st), f = st - b;
  vec2 w0 = f * (-0.5 + f * (1.0 - 0.5 * f));
  vec2 w1 = 1.0 + f * f * (-2.5 + 1.5 * f);
  vec2 w2 = f * (0.5 + f * (2.0 - 1.5 * f));
  vec2 w3 = f * f * (-0.5 + 0.5 * f);
  vec2 w12 = w1 + w2;
  vec2 t0 = (b - 0.5) / uSrc, t3 = (b + 2.5) / uSrc, t12 = (b + 0.5 + w2 / w12) / uSrc;
  vec3 c = texture2D(tSrc, vec2(t12.x, t0.y)).rgb * (w12.x * w0.y)
         + texture2D(tSrc, vec2(t0.x, t12.y)).rgb * (w0.x * w12.y)
         + texture2D(tSrc, t12).rgb * (w12.x * w12.y)
         + texture2D(tSrc, vec2(t3.x, t12.y)).rgb * (w3.x * w12.y)
         + texture2D(tSrc, vec2(t12.x, t3.y)).rgb * (w12.x * w3.y);
  c /= w12.x * (w0.y + w12.y + w3.y) + (w0.x + w3.x) * w12.y;
  ivec2 i = ivec2(b), m = ivec2(uSrc) - 1;
  vec3 p = texelFetch(tSrc, clamp(i, ivec2(0), m), 0).rgb;
  vec3 q = texelFetch(tSrc, clamp(i + ivec2(1, 0), ivec2(0), m), 0).rgb;
  vec3 r = texelFetch(tSrc, clamp(i + ivec2(0, 1), ivec2(0), m), 0).rgb;
  vec3 s = texelFetch(tSrc, clamp(i + ivec2(1, 1), ivec2(0), m), 0).rgb;
  gl_FragColor = vec4(clamp(c, min(min(p, q), min(r, s)), max(max(p, q), max(r, s))), 1.0);
}
`;

const DOF_FRAG = `
uniform sampler2D tDiffuse;
uniform sampler2D tDepth;
uniform mat4 uProjInv;
uniform float uFocus;
uniform float uAperture;
uniform float uMaxBlur;
uniform vec3 uCocK;
uniform vec2 uRes;
uniform float uFarK;
uniform vec3 uFar;
varying vec2 vUv;
float viewZ(vec2 uv) {
  float d = texture2D(tDepth, uv).x;
  vec4 c = vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0);
  vec4 v = uProjInv * c;
  return -v.z / v.w;
}
float cocFar(float z) { return uFarK * uFar.z * smoothstep(uFar.x, uFar.y, z); }
float coc(float z) {
  float r = (z - uFocus) / max(z, 0.001) * uAperture;
  return max(r < 0.0 ? min(-r * uMaxBlur, uCocK.x) : min(r * uMaxBlur * uCocK.y, uCocK.z), cocFar(z));
}
vec3 tap(vec2 uv, float cap) {
  vec3 s = texture2D(tDiffuse, uv).rgb;
  float l = dot(s, vec3(0.2126, 0.7152, 0.0722));
  return s * min(1.0, cap / max(l, 1e-4));
}
void main() {
  vec3 base = texture2D(tDiffuse, vUv).rgb;
  if (uAperture <= 0.0 && uFarK <= 0.0) { gl_FragColor = vec4(base, 1.0); return; }
  if (uAperture <= 0.0 && texture2D(tDepth, vUv).x >= 0.99999) { gl_FragColor = vec4(base, 1.0); return; }
  float zc = viewZ(vUv);
  float cc = coc(zc);
  if (cc < 0.6) { gl_FragColor = vec4(base, 1.0); return; }
  if (uAperture <= 0.0) {
    vec3 acc = base;
    float wsum = 1.0;
    for (int i = 1; i <= 12; i++) {
      float fi = float(i);
      float r = sqrt(fi / 12.0);
      float a = fi * 2.39996323;
      vec2 suv = vUv + vec2(cos(a), sin(a)) * r * cc / uRes;
      float w = clamp((cocFar(viewZ(suv)) - r * cc) * 0.7 + 1.0, 0.0, 1.0);
      acc += texture2D(tDiffuse, suv).rgb * w;
      wsum += w;
    }
    gl_FragColor = vec4(acc / wsum, 1.0);
    return;
  }
  float cap = mix(40.0, 3.0, smoothstep(0.6, 3.0, cc));
  float kb = smoothstep(0.6, 3.0, cc);
  vec3 s0 = tap(vUv, cap);
  float w0 = 1.0 / (1.0 + kb * dot(s0, vec3(0.2126, 0.7152, 0.0722)));
  vec3 acc = s0 * w0;
  float wsum = w0;
  const int N = 32;
  float nf = min(floor(10.0 + cc * 1.4), float(N));
  for (int i = 1; i <= N; i++) {
    float fi = float(i);
    if (fi > nf) break;
    float r = sqrt(fi / nf);
    float a = fi * 2.39996323;
    vec2 suv = vUv + vec2(cos(a), sin(a)) * r * cc / uRes;
    float cs = coc(viewZ(suv));
    vec3 s = tap(suv, cap);
    float w = clamp((cs - r * cc) * 0.5 + 1.0, 0.0, 1.0) / (1.0 + kb * dot(s, vec3(0.2126, 0.7152, 0.0722)));
    acc += s * w;
    wsum += w;
  }
  gl_FragColor = vec4(acc / wsum, 1.0);
}
`;

const BK_COC = `
uniform sampler2D tDepth;
uniform mat4 uProjInv;
uniform float uFocus;
uniform float uAperture;
uniform float uBkK;
uniform float uBkNear;
uniform float uBkFar;
uniform vec2 uBkFarZ;
float bkZ(vec2 uv) {
  float d = texture2D(tDepth, uv).x;
  vec4 v = uProjInv * vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0);
  return -v.z / v.w;
}
float bkCoc(float z) {
  float c = (1.0 - uFocus / max(z, 0.001)) * uAperture * uBkK;
  if (uBkFarZ.y > 0.0 && c > 0.0) c = uAperture * uBkK * smoothstep(uBkFarZ.x, uBkFarZ.y, z);
  return clamp(c, -uBkNear, uBkFar);
}
`;
const BK_SPLIT = `
uniform float uBkCap;
float bkSplit(vec4 s) {
  float l = dot(s.rgb, vec3(0.2126, 0.7152, 0.0722));
  return smoothstep(0.25 * uBkCap, 0.75 * uBkCap, l) * smoothstep(0.8, 2.0, abs(s.a));
}
`;
const BK_DOWN = `
uniform sampler2D tDiffuse;
uniform vec2 uTexel;
${BK_COC}
varying vec2 vUv;
void main() {
  vec2 o = 0.5 * uTexel;
  float z = min(min(bkZ(vUv - o), bkZ(vUv + o)), min(bkZ(vUv + vec2(o.x, -o.y)), bkZ(vUv + vec2(-o.x, o.y))));
  vec3 c = texture2D(tDiffuse, vUv).rgb;
  if (any(isnan(c)) || any(isinf(c))) c = vec3(0.0);
  gl_FragColor = vec4(c, bkCoc(z));
}
`;
const BK_GATHER = `
uniform sampler2D tBk;
uniform vec2 uTexel;
${BK_SPLIT}
varying vec2 vUv;
vec3 bkBase(vec4 s) { return s.rgb * (1.0 - bkSplit(s)); }
void main() {
  vec4 c0 = texture2D(tBk, vUv);
  float cc = c0.a, R = abs(cc);
  vec3 acc = bkBase(c0);
  if (R < 0.5) { gl_FragColor = vec4(acc, cc); return; }
  float rot = 6.2831853 * fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
  float jr = fract(52.9829189 * fract(dot(gl_FragCoord.xy + vec2(17.0, 29.0), vec2(0.00583715, 0.06711056))));
  float wsum = 1.0;
  for (int k = 1; k <= 3; k++) {
    float r = (float(k) - jr) / 3.0 * R;
    int n = 8 * k;
    for (int i = 0; i < 24; i++) {
      if (i >= n) break;
      float a = rot + (float(i) + 0.5 * float(k)) * 6.2831853 / float(n);
      vec4 s = texture2D(tBk, vUv + vec2(cos(a), sin(a)) * (r * uTexel));
      float w = clamp(abs(s.a) - r + 1.0, 0.0, 1.0);
      acc += bkBase(s) * w;
      wsum += w;
    }
  }
  gl_FragColor = vec4(acc / wsum, cc);
}
`;
const BK_SPRITE_VERT = `
uniform sampler2D tBk;
uniform vec2 uTexel;
uniform float uBkRim;
${BK_SPLIT}
varying vec3 vCol;
varying float vR;
void main() {
  vec3 e = vec3(0.0);
  float cw = 0.0;
  for (int i = 0; i < 4; i++) {
    vec2 o = vec2(float(i - 2 * (i / 2)) - 0.5, float(i / 2) - 0.5) * uTexel;
    vec4 s = texture2D(tBk, position.xy + o);
    vec3 x = s.rgb * bkSplit(s);
    e += x;
    cw += dot(x, vec3(0.2126, 0.7152, 0.0722)) * abs(s.a);
  }
  float le = dot(e, vec3(0.2126, 0.7152, 0.0722));
  vR = max(cw / max(le, 1e-6), 1.0);
  vCol = e / (3.14159265 * vR * vR * (1.0 + 0.4 * uBkRim));
  gl_Position = le > 1e-4 ? vec4(position.xy * 2.0 - 1.0, 0.0, 1.0) : vec4(0.0, 0.0, 2.0, 1.0);
  gl_PointSize = 2.0 * vR + 2.0;
}
`;
const BK_SPRITE_FRAG = `
uniform float uBkRim;
varying vec3 vCol;
varying float vR;
void main() {
  float r = length(gl_PointCoord - 0.5) * (2.0 * vR + 2.0) / vR;
  float a = 1.0 - smoothstep(1.0 - 0.8 / vR, 1.0 + 0.8 / vR, r);
  gl_FragColor = vec4(vCol * (a * (1.0 + uBkRim * smoothstep(0.45, 0.98, r))), 0.0);
}
`;
const BK_COMP = `
uniform sampler2D tDiffuse;
uniform sampler2D tBlur;
uniform vec2 uHalf;
${BK_COC}
varying vec2 vUv;
void main() {
  vec3 sharp = texture2D(tDiffuse, vUv).rgb;
  float c = bkCoc(bkZ(vUv));
  float k = smoothstep(0.3, 1.2, abs(c));
  if (k <= 0.0) { gl_FragColor = vec4(sharp, 1.0); return; }
  vec3 acc = vec3(0.0);
  float ws = 0.0;
  for (int j = 0; j < 4; j++) {
    vec2 d = vec2(float(j - 2 * (j / 2)), float(j / 2)) - 0.5;
    vec4 s = texture2D(tBlur, vUv + d / uHalf);
    float w = 1.0 / (1.0 + 4.0 * abs(s.a - c) / max(abs(c), 1.0));
    acc += s.rgb * w;
    ws += w;
  }
  gl_FragColor = vec4(mix(sharp, ws > 1e-5 ? acc / ws : sharp, k), 1.0);
}
`;

const GRADE_FRAG = `
uniform sampler2D tDiffuse;
uniform float uTime;
uniform float uVignette;
uniform float uCA;
uniform float uSat;
uniform vec3 uGain;
uniform vec3 uLift;
uniform float uFade;
uniform vec3 uFadeCol;
uniform float uFlash;
uniform float uGrain;
uniform float uContrast;
uniform float uPing;
uniform float uSplash;
uniform float uWet;
uniform float uAspect;
uniform vec2 uBar;
uniform sampler2D tWheels;
uniform float uWheels;
uniform vec4 uWords;
uniform float uWordsK;
varying vec2 vUv;
float gHash(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float gNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(gHash(i), gHash(i + vec2(1.0, 0.0)), f.x), mix(gHash(i + vec2(0.0, 1.0)), gHash(i + vec2(1.0, 1.0)), f.x), f.y);
}
uniform float uWetT;
uniform float uPlungeT;
uniform float uPlungeK;
uniform vec4 uSpray;
uniform float uChurn;
uniform vec4 uWl;
uniform vec2 uWlS;
uniform mat3 uCamR;
${WL_GLSL}
float wlOver(vec2 uv) {
  vec3 V = normalize(uCamR * vec3((uv.x * 2.0 - 1.0) * uWl.y * uWl.z, (uv.y * 2.0 - 1.0) * uWl.y, -1.0));
  return uWl.x + V.y - dot(uWlS, V.xz) + wlRag(uv.x * uAspect, uTime);
}
vec2 gHash2(vec2 p) { return vec2(gHash(p), gHash(p + 17.31)); }
float gSpec = 0.0;
float gSmear = 0.0;
uniform float uSmearT;
float gLip = 0.0;
uniform vec4 uBeadMoon;
uniform vec4 uBeadSun;
uniform vec4 uBeadLamp;
uniform vec3 uBeadMoonC;
uniform vec3 uBeadSunC;
uniform vec3 uBeadLampC;
vec3 gGlint = vec3(0.0);
#ifdef LT_UPRIGHT
vec2 gLtFr = vec2(0.0);
#endif
const float BEAD_DC = 0.87;
const float BEAD_FAR = 0.76;
float beadSee(float u) { return (exp(1.8 * u) - 1.0) / 5.05; }
float beadAt(float s) { return log(1.0 + 5.05 * s) / 1.8; }
void beadGlint(vec2 p, vec2 c, float r, float w, vec4 L, vec3 col) {
  if (L.z <= 0.0) return;
  vec2 dl = L.xy - c;
  float D = length(dl);
  float u = beadAt(min(D / BEAD_FAR, 1.0));
  vec2 g = c - dl / max(D, 1e-4) * r * BEAD_DC * u;
  vec2 e = (p - g) / max(0.09 * r, 0.0011);
  float u4 = u * u * u * u;
  gGlint += col * (L.z * w * exp(-dot(e, e)) * (1.0 - u4 * u4) * r / (r + 0.012));
}
void lensBead(vec2 p, vec2 c, float r, float w, float sag, float run, inout vec2 o, inout float gain) {
  if (w <= 0.0 || r <= 0.0) return;
  vec2 d = (p - c) / r;
  d.y *= d.y < 0.0 ? 0.86 - 0.12 * sag : 1.14 + 0.1 * sag - 0.6 * run;
  float d2 = dot(d, d);
  if (d2 >= 1.0) return;
  float dd = sqrt(d2);
  float body = (1.0 - smoothstep(0.9, 1.0, dd)) * w;
  vec2 rel = p - c;
#ifdef LT_UPRIGHT
  float lm = 0.55 + 0.55 * dd * dd;
  vec2 s = c + rel * lm;
  s.y -= r * (0.03 + 0.08 * sag);
  gLtFr = mix(gLtFr, rel * lm * 0.022 * smoothstep(0.5, BEAD_DC, dd) * vec2(1.0 / uAspect, 1.0), body);
#else
  float far = min(0.04 + 20.0 * r, BEAD_FAR);
  vec2 s = c - rel / max(length(rel), 1e-5) * far * beadSee(min(dd / BEAD_DC, 1.0));
  s.y -= far * (0.09 + 0.14 * sag);
#endif
  o = mix(o, (s - p) * vec2(1.0 / uAspect, 1.0), body);
  float rim = smoothstep(BEAD_DC - 0.05, BEAD_DC + 0.03, dd) * (1.0 - smoothstep(0.95, 1.0, dd));
  gain *= 1.0 - rim * w * 0.55;
  gain += w * 0.2 * smoothstep(0.3, 0.85, -d.y) * (1.0 - smoothstep(0.75, BEAD_DC, dd));
}
void beadGlints(vec2 p, vec2 c, float r, float w) {
  beadGlint(p, c, r, w, uBeadMoon, uBeadMoonC);
  beadGlint(p, c, r, w, uBeadSun, uBeadSunC);
  beadGlint(p, c, r, w, uBeadLamp, uBeadLampC);
}
float sheetFront(float ax, float ts) {
  float xc = ax / uAspect * 2.0 - 1.0;
  float fall = 0.2 * ts + 0.7 * ts * ts;
  float arch = 0.2 * (1.0 - xc * xc) * smoothstep(0.0, 0.3, ts) - 0.05;
  float wav = 0.04 * (gNoise(vec2(ax * 2.7, ts * 1.2)) - 0.5) + 0.014 * (gNoise(vec2(ax * 9.0 + 3.0, ts * 2.5)) - 0.5);
  float fing = 0.12 * pow(gNoise(vec2(ax * 6.3, 1.7)), 3.0) * smoothstep(0.08, 0.45, ts);
  return 1.12 - fall + arch + wav - fing;
}
float sheetPassed(float ax, float y) {
  float xc = ax / uAspect * 2.0 - 1.0;
  float f = max(1.07 + 0.2 * (1.0 - xc * xc) - y, 0.0);
  return (-0.2 + sqrt(0.04 + 2.8 * f)) / 1.4;
}
const int NBIG = 14;
uniform vec4 uDropA[NBIG];
uniform vec4 uDropB[NBIG];
uniform vec4 uDropC[NBIG];
uniform vec4 uDropS[NBIG];
uniform vec4 uDropD[NBIG];
float dropX(vec4 C, float run) {
  return C.x + C.z * (sin(run * 9.0 + C.y) - sin(C.y) + 0.35 * (sin(run * 23.0 + 1.7 * C.y) - sin(1.7 * C.y)));
}
const float SWEEP_DY = 0.005;
float swept(vec2 c, float r) {
  for (int i = 0; i < NBIG; i++) {
    vec4 S = uDropS[i], D = uDropD[i];
    if (S.z > 0.0) {
      vec2 ab = vec2(S.w, D.w) - S.xy;
      vec2 q = c - S.xy - ab * clamp(dot(c - S.xy, ab) / max(dot(ab, ab), 1e-9), 0.0, 1.0);
      q.y /= q.y < 0.0 ? 1.36 : 1.15;
      float rr = 1.12 * S.z + r;
      if (dot(q, q) < rr * rr) return 1.0;
    }
    if (D.z > 0.0) {
      float R = 1.12 * D.z + r;
      float y0 = max(D.y, c.y - 1.15 * R), y1 = min(D.x, c.y + 1.36 * R);
      vec4 C = uDropC[i];
      if (y0 > y1 || abs(c.x - C.x) > R + 3.0 * C.z) continue;
      float k0 = ceil(y0 / SWEEP_DY);
      for (int k = 0; k < 64; k++) {
        float yk = (k0 + float(k)) * SWEEP_DY;
        if (yk > y1) break;
        vec2 q = vec2(c.x - dropX(C, D.x - yk), c.y - yk);
        q.y /= q.y < 0.0 ? 1.36 : 1.15;
        if (dot(q, q) < R * R) return 1.0;
      }
    }
  }
  return 0.0;
}
bool beadAt0(int L, vec2 id, out vec2 c, out float r0) {
  float cs = L == 0 ? 0.012 : L == 1 ? 0.026 : L == 2 ? 0.05 : 0.095;
  float pr = L == 0 ? 0.5 : L == 1 ? 0.46 : L == 2 ? 0.42 : 0.36;
  vec2 sh = vec2(float(L) * 7.31, float(L) * 3.17);
  vec2 cc = (id - sh + 0.5) * cs;
  c = cc; r0 = 0.0;
  pr *= mix(1.15, 0.7, smoothstep(0.1, 1.0, cc.y));
  pr *= mix(0.45, 1.1, max(smoothstep(0.2, 0.45, abs(cc.x / uAspect - 0.5)), smoothstep(0.32, 0.08, cc.y)));
  if (gHash(id + float(L) * 17.0) > pr) return false;
  float hr = gHash(id + 3.7);
  r0 = cs * (0.1 + 0.26 * hr * hr);
  vec2 jit = (gHash2(id + 1.3) - 0.5) * max(0.0, 1.0 - 2.0 * r0 / cs - 0.04);
  c = (id + 0.5 + jit - sh) * cs;
  return true;
}
bool beadOf(int L, vec2 id, float ts, out vec2 c, out float r, out float r0, out float age) {
  r = 0.0; age = 0.0;
  if (!beadAt0(L, id, c, r0)) return false;
  r = r0;
  vec2 lf = L == 0 ? vec2(0.9, 2.6) : L == 1 ? vec2(1.3, 3.4) : L == 2 ? vec2(1.7, 4.4) : vec2(2.2, 5.3);
  float born = sheetPassed(c.x, c.y);
  age = ts - born;
  if (age <= 0.0) return false;
  float life = mix(lf.x, lf.y, pow(gHash(id + 5.5), 1.5));
  float txt = (1.0 - smoothstep(0.4, 0.47, c.x / uAspect)) * smoothstep(0.12, 0.2, c.y) * (1.0 - smoothstep(0.74, 0.82, c.y));
  life = mix(life, min(life, 5.6 - born), txt);
  float left = 1.0 - age / life;
  if (left <= 0.0) return false;
  r *= sqrt(left);
  return true;
}
bool beadJoined(int L, vec2 c, float r0) {
  for (int L2 = 1; L2 < 4; L2++) {
    if (L2 <= L) continue;
    float cs = L2 == 1 ? 0.026 : L2 == 2 ? 0.05 : 0.095;
    vec2 sh = vec2(float(L2) * 7.31, float(L2) * 3.17);
    vec2 g = c / cs + sh, id = floor(g), f = g - id;
    vec2 st = vec2(f.x < 0.5 ? -1.0 : 1.0, f.y < 0.5 ? -1.0 : 1.0);
    for (int k = 0; k < 4; k++) {
      vec2 cid = id + (k == 1 ? vec2(st.x, 0.0) : k == 2 ? vec2(0.0, st.y) : k == 3 ? st : vec2(0.0));
      vec2 c2; float r2;
      if (!beadAt0(L2, cid, c2, r2)) continue;
      vec2 d = c - c2;
      float rr = r0 + r2 * 1.05;
      if (dot(d, d) < rr * rr) return true;
    }
  }
  return false;
}
vec2 lensWater(vec2 uv, out float gain) {
  gain = 1.0;
  if (uWetT < 0.0) return vec2(0.0);
  float ts = uWetT;
  vec2 p = vec2(uv.x * uAspect, uv.y);
  vec2 o = vec2(0.0);
  float on = smoothstep(0.0, 0.04, ts);
  float mid = mix(0.4, 1.0, smoothstep(0.08, 0.34, length(p - vec2(0.5 * uAspect, 0.5))));
  float burst = on * exp(-ts / 0.13);
  if (burst > 0.01) {
    vec2 q = p * 6.0 + vec2(0.0, ts * 8.0);
    o += (vec2(gNoise(q), gNoise(q + 7.7)) - 0.5) * 0.12 * burst * mid;
    gain += 0.1 * burst;
    gSmear = max(gSmear, burst);
  }
  if (ts < 1.7) {
    float yF = sheetFront(p.x, ts);
    float dy = p.y - yF;
    if (dy < 0.06) {
      float sheet = (1.0 - smoothstep(-0.012, 0.004, dy)) * on;
      vec2 q = vec2(p.x * 6.0, p.y * 2.2 + ts * 3.2);
      vec2 w = vec2(gNoise(q), gNoise(q * vec2(1.1, 1.3) + 5.3)) - 0.5;
      vec2 q2 = vec2(p.x * 2.3 + 1.7, p.y * 1.1 + ts * 2.1);
      vec2 w2 = vec2(gNoise(q2), gNoise(q2 + 3.9)) - 0.5;
      float riv = pow(gNoise(vec2(p.x * 22.0, p.y * 0.9 + ts * 3.6)), 4.0);
      float thick = 0.6 + 0.4 * smoothstep(-0.35, 0.0, dy);
      o += (w * 0.03 + w2 * 0.022 + vec2(riv * 0.014, riv * 0.005)) * sheet * mid * thick;
      gain += sheet * (0.05 + 0.16 * riv);
      gSmear = max(gSmear, sheet * thick * (0.55 + 0.45 * gNoise(vec2(p.x * 9.0, p.y * 1.5 + ts * 2.8))));
      float lp = (dy + 0.02) / 0.022;
      float lip = exp(-lp * lp);
      o.y += lp * lip * 0.018 * mid;
      gain += 0.2 * lip * smoothstep(0.0, -1.0, lp) - 0.16 * lip * smoothstep(0.0, 1.0, lp);
      gLip += 0.025 * lip * smoothstep(0.0, -1.0, lp);
    }
  }
  for (int L = 0; L < 4; L++) {
    float cs = L == 0 ? 0.012 : L == 1 ? 0.026 : L == 2 ? 0.05 : 0.095;
    vec2 sh = vec2(float(L) * 7.31, float(L) * 3.17);
    vec2 c; float r, r0, age;
    if (!beadOf(L, floor(p / cs + sh), ts, c, r, r0, age)) continue;
    vec2 dp = p - c;
    if (dot(dp, dp) > r * r * 1.6) continue;
    if (beadJoined(L, c, r0)) continue;
    float w = smoothstep(0.0, 0.1, age) * (1.0 - swept(c, r0));
    lensBead(p, c, r, w, 0.0, 0.0, o, gain);
    beadGlints(p, c, r, w);
  }
  for (int i = 0; i < NBIG; i++) {
    vec4 A = uDropA[i], B = uDropB[i];
    float run = B.z - p.y;
    if (B.w <= 0.0 || p.y < A.y || run < 0.0) continue;
    vec4 C = uDropC[i];
    float e = (p.x - dropX(C, run)) / C.w;
    if (abs(e) > 1.6) continue;
    float wet = exp(-(p.y - A.y) / B.w);
    float film = wet * wet;
    film *= film;
    film *= smoothstep(0.0, 0.3, gNoise(vec2(run * 24.0, C.y * 5.0)) - 0.75 * (1.0 - film));
    o.x += e * exp(-e * e) * film * 0.003 / uAspect;
    float k0 = floor(run / 0.022);
    for (int j = -1; j <= 1; j++) {
      float k = k0 + float(j), hk = gHash(vec2(k, C.y * 13.0));
      if (hk >= 0.42) continue;
      float kr = (k + 0.5 + 0.4 * (gHash(vec2(k + 7.9, C.y)) - 0.5)) * 0.022;
      vec2 pc = vec2(dropX(C, kr) + (gHash(vec2(k + 3.1, C.y)) - 0.5) * C.w, B.z - kr);
      float rk = min(C.w * (0.18 + 0.9 * hk * hk / 0.18), 0.0062), wk = wet;
      if (A.w > 0.0) {
        vec2 q = pc - A.xy;
        q.y *= q.y < 0.0 ? 0.86 - 0.12 * B.x : 1.14 + 0.1 * B.x - 0.6 * B.y;
        wk *= smoothstep(A.z + rk, 1.25 * A.z + 2.0 * rk, length(q));
      }
      lensBead(p, pc, rk, wk, 0.0, 0.0, o, gain);
    }
  }
  for (int i = 0; i < NBIG; i++) {
    vec4 A = uDropA[i];
    if (A.w <= 0.0) continue;
    vec2 dp = p - A.xy;
    if (dot(dp, dp) > A.z * A.z * 3.3) continue;
    lensBead(p, A.xy, A.z, A.w, uDropB[i].x, uDropB[i].y, o, gain);
    beadGlints(p, A.xy, A.z, A.w);
  }
  return o;
}
void airBead(vec2 p, vec2 c, float r, float w, inout vec2 o, inout float gain) {
  if (w <= 0.0 || r <= 0.0) return;
  vec2 d = (p - c) / r;
  float d2 = dot(d, d);
  if (d2 >= 1.0) return;
  float dd = sqrt(d2);
  float body = (1.0 - smoothstep(0.8, 1.0, dd)) * w;
  o += (p - c) * vec2(1.0 / uAspect, 1.0) * 1.3 * body;
  float rim = smoothstep(0.6, 0.9, dd) * (1.0 - smoothstep(0.9, 1.0, dd));
  gain += (0.14 * body + 0.14 * rim) * w;
  vec2 hg = d - vec2(-0.35, 0.42);
  gSpec += exp(-dot(hg, hg) * 30.0) * w * 0.05;
}
vec2 plunge(vec2 uv, inout float gain) {
  float ts = uPlungeT;
  vec2 p = vec2(uv.x * uAspect, uv.y);
  vec2 o = vec2(0.0);
  float w = smoothstep(0.0, 0.05, ts) * (1.0 - smoothstep(0.55, 0.95, ts));
  if (w <= 0.0) return o;
  for (int i = 0; i < 8; i++) {
    float fi = float(i);
    if (gHash(vec2(fi, 4.2)) > uPlungeK * 0.9) continue;
    float hx = gHash(vec2(fi, 1.1));
    float x0 = (hx < 0.5 ? 0.04 + 0.44 * hx : 0.52 + 0.44 * hx) * uAspect;
    float y0 = 0.12 + 0.72 * gHash(vec2(fi, 2.3));
    float r = 0.004 + 0.009 * pow(gHash(vec2(fi, 3.1)), 2.0);
    float t0 = 0.06 + 0.4 * gHash(vec2(fi, 5.7));
    float tt = max(ts - t0, 0.0);
    vec2 c = vec2(x0, y0) + vec2(0.003 * sin(ts * 41.0 + fi * 3.0), 0.002 * sin(ts * 33.0 + fi)) * (1.0 - smoothstep(0.0, 0.05, tt))
           + vec2(0.03 * sin(fi * 2.7) * tt, 0.25 * tt + 2.2 * tt * tt);
    airBead(p, c, r, w, o, gain);
  }
  return o;
}
vec2 sprayDrops(vec2 uv, inout float gain) {
  vec2 o = vec2(0.0);
  float ts = uSpray.x;
  if (ts < 0.0 || uSpray.y <= 0.001) return o;
  float gone = uPlungeT >= 0.0 ? smoothstep(uWl.w > 0.5 ? 0.06 : 0.0, uWl.w > 0.5 ? 0.12 : 0.015, uPlungeT) : 0.0;
  if (gone >= 1.0) return o;
  vec2 p = vec2(uv.x * uAspect, uv.y);
  vec2 from = vec2((0.5 + 0.5 * uSpray.z) * uAspect, 0.5 + 0.5 * uSpray.w);
  for (int L = 0; L < 3; L++) {
    float cs = L == 0 ? 0.03 : L == 1 ? 0.06 : 0.11;
    vec2 sh = vec2(float(L) * 5.13 + 1.7, float(L) * 2.71 + 0.9);
    vec2 id = floor(p / cs + sh);
    vec2 cc = (id - sh + 0.5) * cs;
    float pr = uSpray.y * (L == 0 ? 0.2 : L == 1 ? 0.1 : 0.05) * mix(0.25, 1.0, exp(-dot(cc - from, cc - from) * 2.2)) * mix(1.0, 0.5, smoothstep(0.35, 0.9, cc.y));
    if (gHash(id + 31.0 + float(L) * 9.0) > pr) continue;
    float hr = gHash(id + 13.7);
    float r = cs * (0.08 + 0.26 * hr * hr);
    vec2 jit = (gHash2(id + 5.3) - 0.5) * max(0.0, 1.0 - 2.0 * r / cs - 0.04);
    float at = 0.12 * gHash(id + 7.1);
    float age = ts - at;
    if (age <= 0.0) continue;
    vec2 c = (id + 0.5 + jit - sh) * cs;
    float run = smoothstep(0.1, 0.6, age) * smoothstep(0.03, 0.08, r);
    c.y -= run * (0.04 * age + 0.3 * age * age) * r / 0.08;
    vec2 dp = p - c;
    if (dot(dp, dp) > r * r * 1.6) continue;
    float w = smoothstep(0.0, 0.03, age) * (1.0 - gone);
    if (uWl.w > 0.5) w *= smoothstep(-0.05, 0.02, wlOver(vec2(c.x / uAspect, c.y)));
    if (w <= 0.0) continue;
    lensBead(p, c, r, w, 0.3 * run, run, o, gain);
    beadGlints(p, c, r, w);
  }
  return o;
}
vec2 churn(vec2 uv, inout float gain) {
  float ts = uPlungeT;
  vec2 o = vec2(0.0);
  if (uChurn <= 0.0 || ts < 0.0 || ts > 0.6) return o;
  vec2 p = vec2(uv.x * uAspect, uv.y);
  float bu = exp(-ts / 0.05) * smoothstep(0.0, 0.02, ts) * uChurn;
  if (bu > 0.01) {
    vec2 q = p * 7.0 + vec2(0.0, -ts * 9.0);
    o += (vec2(gNoise(q), gNoise(q + 4.1)) - 0.5) * 0.05 * bu;
    gain += 0.05 * bu;
  }
  for (int L = 0; L < 3; L++) {
    float cs = L == 0 ? 0.022 : L == 1 ? 0.04 : 0.07;
    float rise = L == 0 ? 0.9 : L == 1 ? 0.65 : 0.45, up = rise * ts + 0.8 * rise * ts * ts;
    vec2 sh = vec2(float(L) * 4.31 + 0.7, float(L) * 2.13 + 0.2);
    vec2 id = floor((p - vec2(0.0, up)) / cs + sh);
    vec2 c0 = (id - sh + 0.5) * cs;
    float edge = smoothstep(0.15, 0.45, abs(c0.x / uAspect - 0.5));
    float pr = (L == 0 ? 0.24 : L == 1 ? 0.16 : 0.09) * uChurn * mix(1.0, 0.12, smoothstep(0.04, 0.55, c0.y)) * mix(0.55, 1.0, edge);
    if (gHash(id + 51.0 + float(L) * 7.0) > pr) continue;
    float hr = gHash(id + 23.1);
    float r = cs * (0.12 + 0.28 * hr * hr);
    vec2 c = c0 + (gHash2(id + 9.7) - 0.5) * cs * max(0.0, 1.0 - 2.0 * r / cs - 0.04) + vec2(0.0, up);
    float life = (L == 0 ? 0.14 : 0.2) + 0.3 * gHash(id + 3.3), age = ts - 0.03 * (1.0 - c0.y);
    float w = smoothstep(0.0, 0.03, age) * (1.0 - smoothstep(0.6 * life, life, age));
    if (w <= 0.0) continue;
    vec2 dp = p - c;
    if (dot(dp, dp) > r * r) continue;
    airBead(p, c, r, w, o, gain);
  }
  return o;
}
void main() {
  float gain;
  vec2 off = lensWater(vUv, gain);
  if (uSpray.x >= 0.0) off += sprayDrops(vUv, gain);
  if (uPlungeT >= 0.0) { off += plunge(vUv, gain); off += churn(vUv, gain); }
  vec2 suv = 1.0 - abs(1.0 - abs(vUv + off));
  vec2 d = vUv - 0.5;
  float r2 = dot(d, d);
  vec3 c0 = texture2D(tDiffuse, suv).rgb;
  if (gSmear > 0.01) {
    vec2 pa = vec2(vUv.x * uAspect, vUv.y);
    float rv = gNoise(vec2(pa.x * 22.0, pa.y * 0.9 + uWetT * 3.6));
    float rl = mix(0.55, 1.6, smoothstep(0.3, 0.8, rv)) * mix(0.75, 1.2, gNoise(vec2(pa.x * 3.1 + 5.3, 1.7)));
    float sl = (gNoise(vec2(pa.x * 4.3 + 9.1, pa.y * 0.6 + 2.2)) - 0.5) * 0.4;
    vec2 sd = vec2(sl * 0.028 / uAspect, 0.028) * (gSmear * rl);
    float jt = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
    vec3 lo = min(c0, vec3(uSmearT)), e0 = max(c0 - uSmearT, 0.0), acc = e0;
    float ws = 1.0;
    for (int i = 0; i < 9; i++) {
      float f = (float(i) + jt) / 9.0, wt = 1.0 - 0.7 * f;
      acc += max(texture2D(tDiffuse, clamp(suv + sd * f, 0.0, 1.0)).rgb - uSmearT, 0.0) * wt;
      ws += wt;
    }
    for (int i = 0; i < 3; i++) {
      float f = (float(i) + jt) / 3.0, wt = 1.0 - 0.7 * f;
      acc += max(texture2D(tDiffuse, clamp(suv - sd * (0.3 * f), 0.0, 1.0)).rgb - uSmearT, 0.0) * wt;
      ws += wt;
    }
    acc /= ws;
    c0 = lo + acc + 1.2 * max(acc - e0, 0.0);
  }
  vec3 col = c0;
  if (uCA > 0.0) {
    vec2 off = d * smoothstep(0.05, 0.45, r2) * uCA * 0.012;
    float rr = texture2D(tDiffuse, suv - off).r;
    float bb = texture2D(tDiffuse, suv + off).b;
    float kc = (1.0 - smoothstep(0.0, 0.06, gSmear)) / (1.0 + 0.8 * max(max(c0.r, c0.g), max(rr, bb)));
    col.r = mix(c0.r, rr, kc);
    col.b = mix(c0.b, bb, kc);
  }
  col = col * gain + vec3(0.9, 0.95, 1.0) * (gSpec + gLip * min(1.0, 8.0 * dot(c0, vec3(0.2126, 0.7152, 0.0722)))) + gGlint;
  col = 0.18 * pow(max(col, vec3(0.0)) / 0.18, vec3(uContrast));
  float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = max(mix(vec3(l), col, uSat), 0.0);
  col = col * uGain + uLift;
  col *= mix(1.0, smoothstep(0.95, 0.18, sqrt(r2) * 1.25), uVignette);
  float gt = floor(uTime * 24.0);
  float gn = gHash(floor(gl_FragCoord.xy) + vec2(fract(gt * 0.1731) * 911.0, fract(gt * 0.3717) * 577.0)) - 0.5;
  col *= 1.0 + gn * uGrain * 3.0 * smoothstep(0.003, 0.05, l) * (1.0 - smoothstep(0.6, 3.0, l));
  col = mix(col, uFadeCol, uFade);
  col += vec3(uFlash);
  if (uBar.x > 0.0) {
    float past = uBar.x - min(vUv.y, 1.0 - vUv.y);
    float bar = clamp(past * uBar.y + 0.5, 0.0, 1.0);
    if (bar > 0.0) {
      float wh = 0.0;
      if (uWheels > 0.0) {
        vec2 wt = 0.35 / vec2(uAspect * uBar.y, uBar.y);
        wh = min(texture2D(tWheels, vUv + wt).r, texture2D(tWheels, vUv - wt).r);
        wh *= wh;
      }
      vec2 wd = max(uWords.xy - vUv, vUv - uWords.zw) * vec2(uAspect, 1.0) * uBar.y;
      if (uWords.z > uWords.x) wh *= mix(1.0, smoothstep(4.0, 18.0, max(wd.x * 2.0, wd.y)), uWordsK);
      col *= 1.0 - bar * (1.0 - wh);
    }
  }
  gl_FragColor = vec4(col, 1.0);
}
`;
const GRADE_WATER = GRADE_FRAG.slice(0, GRADE_FRAG.lastIndexOf('void main()'));

const MASK_VERT = `
varying float vY;
void main() {
  vec4 p = modelMatrix * vec4(position, 1.0);
  vY = p.y;
  gl_Position = projectionMatrix * viewMatrix * p;
}
`;
const MASK_FRAG = `
uniform sampler2D tDepth;
uniform vec2 uRes;
uniform vec2 uNF;
uniform float uK;
uniform float uWhole;
uniform float uBarH;
uniform vec2 uSand;
varying float vY;
float viewZ(float d) { return uNF.x * uNF.y / (uNF.y - d * (uNF.y - uNF.x)); }
void main() {
  float z = gl_FragCoord.z, d = texture2D(tDepth, gl_FragCoord.xy / uRes).r;
  float tx = uRes.x / float(textureSize(tDepth, 0).x);
  float tol = 2e-6 + (abs(dFdx(z)) + abs(dFdy(z))) * (0.5 * tx + 0.5);
  bool hid = z > d + tol;
  if (hid && (uWhole <= 0.0 || vY < uSand.x + max(uSand.y, 0.015) || viewZ(z) - viewZ(d) > 0.012)) discard;
  float v = gl_FragCoord.y / uRes.y, past = (uBarH - min(v, 1.0 - v)) / max(uBarH, 1e-4);
  float k = uWhole > 0.0 ? smoothstep(uSand.x, uSand.x + uSand.y, vY) : 1.0 - smoothstep(0.45, 0.95, past);
  if (k <= 0.0) discard;
  gl_FragColor = vec4(sqrt(uK * k));
}
`;
const BK_MIN = 0.06, BK_FADE = 0.3, BK_SAND = 4;
const _bkS = new THREE.Sphere(), _bkV$1 = new THREE.Vector3(), _bkC = new THREE.Color(), _bkW = new THREE.Vector4();
const shown = (o) => { for (; o; o = o.parent) if (!o.visible) return false; return true; };
function maskK(renderer, scene, camera, geometry, material) {
  const u = this.userData;
  material.uniforms.uK.value = u.k ?? 1;
  material.uniforms.uWhole.value = u.whole ? 1 : 0;
  material.uniforms.uSand.value.set(u.whole ? u.sandY : -1e4, u.sandH || 0.004);
  material.uniformsNeedUpdate = true;
}

function fxBusy() {
  const k = FX_SCENE.children;
  for (let i = 0; i < k.length; i++) {
    const o = k[i];
    if (o.visible && (!o.material || o.material.visible)) return true;
  }
  return false;
}

class CompPass extends Pass {
  constructor(post) {
    super();
    this.post = post;
    this.quad = new FullScreenQuad(post.compMat);
    this.upQuad = new FullScreenQuad(post.upMat);
  }
  render(renderer, writeBuffer) {
    const p = this.post, low = p.compRT, out = this.renderToScreen ? null : writeBuffer, u = p.upMat.uniforms;
    if (!low && p._warmNow) {
      u.tSrc.value = p.sceneRT.texture;
      renderer.setRenderTarget(out);
      this.upQuad.render(renderer);
    }
    renderer.setRenderTarget(low || out);
    this.quad.render(renderer);
    if (!low) return;
    u.tSrc.value = low.texture;
    renderer.setRenderTarget(out);
    this.upQuad.render(renderer);
  }
}

class FxPass extends Pass {
  constructor(post) {
    super();
    this.post = post;
    this.needsSwap = false;
  }
  render(renderer, writeBuffer, readBuffer) {
    const post = this.post;
    if (!post._fxReady) return;
    const warm = post._fxWarm.length > 0;
    if (!warm && !fxBusy()) return;
    const ac = renderer.autoClear;
    renderer.autoClear = false;
    renderer.setRenderTarget(readBuffer);
    if (warm) {
      const o = post._fxWarm.shift();
      if (o.geometry && o.material) {
        const dr = o.geometry.drawRange, c0 = dr.count, v0 = o.visible, m0 = o.material.visible;
        dr.count = 1;
        o.visible = true;
        o.material.visible = true;
        renderer.render(o, post.camera);
        dr.count = c0;
        o.visible = v0;
        o.material.visible = m0;
      }
    }
    if (fxBusy()) renderer.render(FX_SCENE, post.camera);
    renderer.autoClear = ac;
  }
}

class DofPass extends Pass {
  constructor(post) {
    super();
    this.post = post;
    this.quad = new FullScreenQuad();
  }
  _draw(renderer, mat, target) {
    this.quad.material = mat;
    renderer.setRenderTarget(target);
    this.quad.render(renderer);
  }
  render(renderer, writeBuffer, readBuffer) {
    const p = this.post, warm = p._warmNow;
    if (p.dof.bokeh > 0 || warm) {
      p.bkDownMat.uniforms.tDiffuse.value = readBuffer.texture;
      this._draw(renderer, p.bkDownMat, p.bkA);
      this._draw(renderer, p.bkGatherMat, p.bkB);
      const ac = renderer.autoClear;
      renderer.autoClear = false;
      renderer.render(p.bkScene, p.fsCam);
      renderer.autoClear = ac;
      p.bkCompMat.uniforms.tDiffuse.value = readBuffer.texture;
      this._draw(renderer, p.bkCompMat, writeBuffer);
      if (!warm) return;
    }
    p.dofMat.uniforms.tDiffuse.value = readBuffer.texture;
    this._draw(renderer, p.dofMat, writeBuffer);
  }
}

const NBIG = 14;
const SMEAR_SHOWN = 0.3;
const DROPS = [
  [0.12, 0.8, 0.052, 0.55, 40],
  [0.13, 0.46, 0.026, 0, 3.2],
  [0.28, 0.9, 0.05, 0.45, 40],
  [0.36, 0.24, 0.022, 0, 2.8],
  [0.05, 0.14, 0.034, 0.5, 40],
  [0.72, 0.86, 0.058, 1.1, 40],
  [0.87, 0.68, 0.045, 1.5, 40],
  [0.875, 0.4, 0.027, 0, 4.6],
  [0.64, 0.2, 0.034, 1.9, 40],
  [0.93, 0.92, 0.03, 0, 4.4],
  [0.66, 0.68, 0.027, 0, 5.2],
  [0.48, 0.9, 0.024, 0, 4.0],
  [0.79, 0.12, 0.022, 0, 4.4],
  [0.45, 0.08, 0.02, 0, 3.6],
];
const LD = { grav: 3, drag: 4, rc: 0.029, feed: 1.2, hold: 1.08, trailTau: 1.6, merge: 0.15 };
const DS = { WAIT: 0, SIT: 1, RUN: 2, STOP: 3, MERGE: 4, TRAIL: 5, OFF: 6 };
function dropReach(sag, run, dx, dy) {
  const sy = dy < 0 ? 0.86 - 0.12 * sag : 1.14 + 0.1 * sag - 0.6 * run;
  const l = Math.hypot(dx, dy) || 1;
  return 1 / Math.hypot(dx / l, (dy / l) * sy);
}
class LensDrops {
  constructor() {
    const v4 = () => Array.from({ length: NBIG }, () => new THREE.Vector4());
    this.A = v4();
    this.B = v4();
    this.C = v4();
    this.S = v4();
    this.D = v4();
    this.d = [];
  }
  static pathX(d, run) {
    const s = d.seed;
    return d.x0 + d.amp * (Math.sin(run * 9 + s) - Math.sin(s) + 0.35 * (Math.sin(run * 23 + 1.7 * s) - Math.sin(1.7 * s)));
  }
  start(aspect) {
    this.d = DROPS.map(([ux, uy, r, go, life], i) => {
      const xc = ux * 2 - 1, f = Math.max(1.07 + 0.2 * (1 - xc * xc) - uy, 0);
      return {
        x0: ux * aspect, x: ux * aspect, y: uy, yTop: uy, V: r * r * r, V0: 0, go, st: DS.WAIT,
        born: (-0.2 + Math.sqrt(0.04 + 2.8 * f)) / 1.4,
        kE: (1.5 * r * r) / life,
        rc: LD.rc * (0.92 + 0.16 * ((i * 0.618) % 1)),
        seed: 1.3 + i * 2.17, amp: 0.004 + 0.004 * ((i * 0.37) % 1),
        v: 0, tGo: 0, sag: 0, wet: 0, hw: 0.42 * r, into: -1,
        yLow: uy, rRun: 0, xEnd: ux * aspect, yEnd: uy,
      };
    });
    for (let i = 0; i < NBIG; i++) {
      const d = this.d[i];
      if (d) { this.S[i].set(d.x0, d.y, Math.cbrt(d.V), d.x0); this.D[i].set(0, 0, 0, d.y); }
      else { this.S[i].set(0, 0, 0, 0); this.D[i].set(0, 0, 0, 0); }
    }
  }
  clear() {
    this.d = [];
    for (let i = 0; i < NBIG; i++) { this.A[i].w = 0; this.B[i].w = 0; this.S[i].z = 0; this.D[i].z = 0; }
  }
  update(ts, dt) {
    const D = this.d, ss = THREE.MathUtils.smoothstep;
    for (const d of D) {
      if (d.st === DS.OFF || ts < d.born) continue;
      if (d.st === DS.WAIT) d.st = DS.SIT;
      if (d.st === DS.MERGE) {
        const e = D[d.into], k = 1 - Math.exp(-dt / 0.05), dv = Math.min(d.V, (d.V0 * dt) / LD.merge);
        d.x += (e.x - d.x) * k;
        d.y += (e.y - d.y) * k;
        if (d.rRun === 0) { d.xEnd = d.x; d.yEnd = d.y; }
        d.V -= dv;
        e.V += dv;
        if (d.V <= 1e-12) d.st = d.wet > 0 ? DS.TRAIL : DS.OFF;
        continue;
      }
      if (d.st !== DS.TRAIL) {
        d.V = Math.max(0, d.V - d.kE * Math.cbrt(d.V) * dt);
        if (d.V < 3e-9) d.st = d.wet > 0 ? DS.TRAIL : DS.OFF;
      }
      if (d.st === DS.SIT) {
        d.sag = ss(ts - d.born, 0, Math.max(d.go, 1.5));
        if (d.go > 0 && ts - d.born > d.go) { d.st = DS.RUN; d.tGo = ts; d.yTop = d.y; }
      }
      if (d.st === DS.RUN || d.st === DS.STOP) {
        const r = Math.cbrt(d.V), run = d.yTop - d.y;
        const rc = d.rc * (1 + 0.2 * (0.6 * Math.sin(run * 41 + d.seed) + 0.4 * Math.sin(run * 97 + 2.3 * d.seed)));
        if (d.st === DS.RUN) {
          d.v = Math.max(0, d.v + (LD.grav * (1 - (rc / r) ** 2) - LD.drag * d.v) * dt);
          const ds = d.v * dt;
          d.y -= ds;
          d.V *= Math.exp((-0.05 * ds) / r);
          if (d.v < 0.01 && r < rc) { d.st = DS.STOP; d.v = 0; }
        } else {
          d.V *= Math.exp(LD.feed * dt);
          if (r > rc * LD.hold) d.st = DS.RUN;
        }
        d.x = LensDrops.pathX(d, d.yTop - d.y);
        d.hw = 0.42 * Math.cbrt(d.V);
        d.wet = ((d.yTop - d.y) / Math.max(ts - d.tGo, 0.25)) * LD.trailTau;
        d.yLow = Math.min(d.yLow, d.y);
        d.rRun = Math.max(d.rRun, Math.cbrt(d.V));
        if (d.y + r < -0.01) d.st = DS.TRAIL;
      }
      if (d.st === DS.TRAIL && (d.wet *= Math.exp(-dt / 0.5)) < 0.004) d.st = DS.OFF;
    }
    for (const d of D) d.run = d.st === DS.RUN || d.st === DS.STOP ? Math.min(1, d.v / 0.25, (d.yTop - d.y) / (0.9 * Math.cbrt(d.V) + 1e-6)) : 0;
    for (let i = 0; i < D.length; i++) {
      const a = D[i];
      if (a.st !== DS.RUN && a.st !== DS.STOP) continue;
      for (let j = 0; j < D.length; j++) {
        const b = D[j];
        if (j === i || (b.st !== DS.SIT && b.st !== DS.RUN && b.st !== DS.STOP)) continue;
        const ra = Math.cbrt(a.V), rb = Math.cbrt(b.V), dx = b.x - a.x, dy = b.y - a.y;
        if (Math.hypot(dx, dy) > ra * dropReach(a.sag, a.run, dx, dy) + rb * dropReach(b.sag, b.run, -dx, -dy)) continue;
        const f = b.st === DS.SIT || ra >= rb ? b : a;
        f.st = DS.MERGE;
        f.into = f === b ? i : j;
        f.V0 = f.V;
        f.run = 0;
        if (f === a) break;
      }
    }
    for (let i = 0; i < NBIG; i++) {
      const d = D[i], A = this.A[i], B = this.B[i], C = this.C[i];
      if (d) {
        this.S[i].w = d.xEnd;
        this.D[i].set(d.rRun > 0 ? d.yTop : 0, d.yLow, d.rRun, d.yEnd);
      }
      if (!d || d.st === DS.OFF || d.st === DS.WAIT) { A.w = 0; B.w = 0; continue; }
      A.set(d.x, d.y, Math.cbrt(d.V), d.st === DS.TRAIL ? 0 : ss(ts - d.born, 0, 0.12));
      B.set(d.sag, d.run, d.yTop, d.st === DS.SIT ? 0 : d.wet);
      C.set(d.x0, d.seed, d.amp, d.hw);
    }
  }
}

class Post {
  constructor(renderer, scene, camera, { samples = 4, godDiv = 2, bloomDiv = 2 } = {}) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.fsCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.godDiv = godDiv;
    const { w, h } = this._size();

    this.scale = 1;
    this.samples = samples;
    this.sceneRT = this._sceneTarget(w, h);
    this.compRT = null;
    this.depthTex = this.sceneRT.depthTexture;
    const gw = Math.max(1, Math.floor(w / godDiv)), gh = Math.max(1, Math.floor(h / godDiv));
    this.godRT = new THREE.WebGLRenderTarget(gw, gh, { type: THREE.HalfFloatType, depthBuffer: false });
    this.godRT2 = new THREE.WebGLRenderTarget(gw, gh, { type: THREE.HalfFloatType, depthBuffer: false });

    const camU = () => ({
      uProjInv: { value: new THREE.Matrix4() },
      uViewInv: { value: new THREE.Matrix4() },
      uCamPos: { value: new THREE.Vector3() },
    });
    const fsScene = (mat) => {
      const s = new THREE.Scene();
      const q = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
      q.frustumCulled = false;
      s.add(q);
      return s;
    };

    this.godMat = new THREE.ShaderMaterial({
      uniforms: Object.assign(camU(), {
        tDepth: { value: this.depthTex },
        uCaustics: U.uCaustics,
        uCausticTile: U.uCausticTile,
        uSunW: U.uSunW,
        uWaterY: U.uWaterY,
        uTime: U.uTime,
        uLight: U.uLight,
      }, SUNSH),
      vertexShader: FS_VERT, fragmentShader: GOD_FRAG, depthTest: false, depthWrite: false,
    });
    this.godScene = fsScene(this.godMat);
    this.godBlurMat = new THREE.ShaderMaterial({
      uniforms: { tSrc: { value: null }, uDir: { value: new THREE.Vector2() } },
      vertexShader: FS_VERT, fragmentShader: GOD_BLUR_FRAG, depthTest: false, depthWrite: false,
    });
    this.godBlurScene = fsScene(this.godBlurMat);

    this.histRT = new THREE.WebGLRenderTarget(this.sceneRT.width, this.sceneRT.height, { type: THREE.HalfFloatType, depthBuffer: false });
    this.histMat = new THREE.ShaderMaterial({
      uniforms: Object.assign(camU(), { tScene: { value: this.sceneRT.texture }, tDepth: { value: this.depthTex } }),
      vertexShader: FS_VERT, fragmentShader: HIST_FRAG, depthTest: false, depthWrite: false,
    });
    this.histScene = fsScene(this.histMat);
    this._histT = -1;
    if (renderer.initRenderTarget) renderer.initRenderTarget(this.histRT);

    this.compMat = new THREE.ShaderMaterial({
      uniforms: Object.assign(camU(), {
        tScene: { value: this.sceneRT.texture },
        tDepth: { value: this.depthTex },
        tGod: { value: this.godRT.texture },
        uTime: U.uTime,
        uLight: U.uLight,
        uWaterY: U.uWaterY,
        uSunW: U.uSunW,
        uGodStr: { value: 0.9 },
        uGodOn: { value: 0 },
        uGodRes: { value: new THREE.Vector2(gw, gh) },
        uRes: { value: new THREE.Vector2(w, h) },
        uHaze: { value: new THREE.Vector3(0.46, 0.68, 0.98) },
        uHazeDen: { value: 0.0003 },
        uSheet: { value: new THREE.Vector3() },
        uLightK: { value: 1 },
        uHistK: { value: 0 },
        uCamPV: { value: new THREE.Matrix4() },
        tHist: { value: this.histRT.texture },
        uHistPV: { value: new THREE.Matrix4() },
        uHistProjInv: { value: new THREE.Matrix4() },
        uHistViewInv: { value: new THREE.Matrix4() },
        uHistPos: { value: new THREE.Vector3() },
      }, WATER, ARCH, SUNSH),
      vertexShader: FS_VERT, fragmentShader: COMP_FRAG, depthTest: false, depthWrite: false,
    });
    this.upMat = new THREE.ShaderMaterial({
      uniforms: { tSrc: { value: null }, uSrc: { value: new THREE.Vector2(w, h) } },
      vertexShader: FS_VERT, fragmentShader: UP_FRAG, depthTest: false, depthWrite: false,
    });

    this.drops = new LensDrops();
    this.wheels = [];
    this.maskRT = new THREE.WebGLRenderTarget(w, h, { format: THREE.RedFormat, depthBuffer: false });
    this.maskMat = new THREE.ShaderMaterial({
      uniforms: { tDepth: { value: this.depthTex }, uRes: { value: new THREE.Vector2(w, h) }, uNF: { value: new THREE.Vector2(0.1, 1000) }, uK: { value: 1 }, uWhole: { value: 0 }, uBarH: { value: 0 }, uSand: { value: new THREE.Vector2(-1e4, 0.004) } },
      vertexShader: MASK_VERT, fragmentShader: MASK_FRAG, depthTest: false, depthWrite: false,
      blending: THREE.CustomBlending, blendEquation: THREE.MaxEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
    });
    this.maskScene = new THREE.Scene();
    this.maskScene.matrixWorldAutoUpdate = false;
    this._mask = new Map();
    this.gradeMat = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null },
        uTime: U.uTime,
        uVignette: { value: 0.38 },
        uCA: { value: 0.13 },
        uSat: { value: 1.12 },
        uGain: { value: new THREE.Vector3(1, 1, 1) },
        uLift: { value: new THREE.Vector3(0, 0, 0) },
        uFade: { value: 0 },
        uFadeCol: { value: new THREE.Vector3(0, 0, 0) },
        uFlash: { value: 0 },
        uGrain: { value: 0.022 },
        uContrast: { value: 1.12 },
        uPing: { value: 0 },
        uSplash: { value: 0 },
        uWet: { value: 0 },
        uWetT: { value: -1 },
        uSmearT: { value: 0.1 },
        uPlungeT: { value: -1 },
        uPlungeK: { value: 1 },
        uSpray: { value: new THREE.Vector4(-1, 0, 0, 0) },
        uChurn: { value: 0 },
        uWl: { value: new THREE.Vector4(10, 0.5, w / h, 0) },
        uWlS: { value: new THREE.Vector2() },
        uCamR: { value: new THREE.Matrix3() },
        uAspect: { value: w / h },
        uBar: { value: new THREE.Vector2(0, h) },
        tWheels: { value: this.maskRT.texture },
        uWheels: { value: 0 },
        uWords: { value: new THREE.Vector4() },
        uWordsK: { value: 0 },
        uDropA: { value: this.drops.A },
        uDropB: { value: this.drops.B },
        uDropC: { value: this.drops.C },
        uDropS: { value: this.drops.S },
        uDropD: { value: this.drops.D },
        uBeadMoon: { value: new THREE.Vector4() },
        uBeadSun: { value: new THREE.Vector4() },
        uBeadLamp: { value: new THREE.Vector4() },
        uBeadMoonC: { value: new THREE.Vector3(0.75, 0.85, 1.0) },
        uBeadSunC: { value: new THREE.Vector3(1.0, 0.68, 0.38) },
        uBeadLampC: { value: new THREE.Vector3(1.0, 0.55, 0.2) },
      },
      vertexShader: FS_VERT, fragmentShader: GRADE_FRAG, depthTest: false, depthWrite: false,
    });

    this.dofMat = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null },
        tDepth: { value: this.depthTex },
        uProjInv: { value: new THREE.Matrix4() },
        uFocus: { value: 4 },
        uAperture: { value: 0 },
        uMaxBlur: { value: 16 },
        uCocK: { value: new THREE.Vector3(16, 1, 16) },
        uRes: { value: new THREE.Vector2(w, h) },
        uFarK: { value: 0 },
        uFar: { value: new THREE.Vector3(9, 30, 2.4) },
      },
      vertexShader: FS_VERT, fragmentShader: DOF_FRAG, depthTest: false, depthWrite: false,
    });
    this.dof = { focus: 4, aperture: 0, near: 16, farK: 1, far: 16, bokeh: 0, bkNear: 18 };
    this._bkH = h;

    const hw = Math.max(1, w >> 1), hh = Math.max(1, h >> 1);
    const half = () => new THREE.WebGLRenderTarget(hw, hh, { type: THREE.HalfFloatType, depthBuffer: false });
    this.bkA = half();
    this.bkB = half();
    const du = this.dofMat.uniforms;
    this.bkU = {
      tDepth: du.tDepth, uProjInv: du.uProjInv, uFocus: du.uFocus, uAperture: du.uAperture,
      uBkK: { value: 8 },
      uBkNear: { value: 18 },
      uBkFar: { value: 18 },
      uBkFarZ: { value: new THREE.Vector2(0, 0) },
      uBkCap: { value: 3 },
      uBkRim: { value: 0.7 },
    };
    const bkMat = (frag, u) => new THREE.ShaderMaterial({
      uniforms: Object.assign({}, this.bkU, u), vertexShader: FS_VERT, fragmentShader: frag, depthTest: false, depthWrite: false,
    });
    this.bkDownMat = bkMat(BK_DOWN, { tDiffuse: { value: null }, uTexel: { value: new THREE.Vector2(1 / w, 1 / h) } });
    this.bkGatherMat = bkMat(BK_GATHER, { tBk: { value: this.bkA.texture }, uTexel: { value: new THREE.Vector2(1 / hw, 1 / hh) } });
    this.bkCompMat = bkMat(BK_COMP, { tDiffuse: { value: null }, tBlur: { value: this.bkB.texture }, uHalf: { value: new THREE.Vector2(hw, hh) } });
    this.bkPoints = new THREE.Points(new THREE.BufferGeometry(), new THREE.ShaderMaterial({
      uniforms: Object.assign({}, this.bkU, { tBk: { value: this.bkA.texture }, uTexel: this.bkGatherMat.uniforms.uTexel }),
      vertexShader: BK_SPRITE_VERT, fragmentShader: BK_SPRITE_FRAG, depthTest: false, depthWrite: false,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
      blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
    }));
    this.bkPoints.frustumCulled = false;
    this.bkScene = new THREE.Scene();
    this.bkScene.add(this.bkPoints);
    this._bkSize(w, h);

    this.composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType }));
    this.compPass = new CompPass(this);
    this.dofPass = new DofPass(this);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.095, 0.5, 1.3);
    const bloomSize = this.bloom.setSize.bind(this.bloom);
    this.bloom.setSize = (bw, bh) => bloomSize(Math.max(2, Math.floor(bw / bloomDiv)), Math.max(2, Math.floor(bh / bloomDiv)));
    this.gradePass = new ShaderPass(this.gradeMat);
    this.outPass = HDR_ASK ? hdrOutputPass() : new OutputPass();
    this.hdr = HDR_ASK ? new Hdr(renderer.domElement, this.outPass) : null;
    this.hdrK = 0;
    if (this.hdr) this.hdr.init();
    this.fxPass = new FxPass(this);
    this.composer.addPass(this.compPass);
    this.composer.addPass(this.dofPass);
    this.composer.addPass(this.fxPass);
    this.composer.addPass(this.bloom);
    this.composer.addPass(this.gradePass);
    this.composer.addPass(this.outPass);
    this.composer.setPixelRatio(1);
    this.composer.setSize(w, h);
    this.godEnabled = true;
    this._warm = 2;
    this.farBlur = 1;
    this.farDeep = 0;
    this._rel0 = null;
    this._wetT = -1;
    this._plT = -1;
    this._vRel = 0;
    this._shT = 0;
    this._wet0 = 0;
    this._spl0 = 0;
    WATER.tSceneDepth.value = this.depthTex;
    WATER.tSceneColor.value = this.sceneRT.texture;
    this._fxReady = false;
    this._fxWarm = [];
    try {
      renderer.setRenderTarget(this.composer.readBuffer);
      const p = renderer.compileAsync ? renderer.compileAsync(FX_SCENE, camera) : Promise.resolve(renderer.compile(FX_SCENE, camera));
      p.then(() => { this._fxWarm = FX_SCENE.children.slice(); this._fxReady = true; }, () => { this._fxReady = true; });
    } catch (e) { console.warn(e); this._fxReady = true; }
    renderer.setRenderTarget(null);
  }

  _size() {
    const v = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    return { w: Math.max(2, Math.floor(v.x)), h: Math.max(2, Math.floor(v.y)) };
  }

  _sceneTarget(w, h) {
    const sw = Math.max(2, Math.round(w * this.scale)), sh = Math.max(2, Math.round(h * this.scale));
    const depth = new THREE.DepthTexture(sw, sh);
    depth.type = THREE.UnsignedIntType;
    return new THREE.WebGLRenderTarget(sw, sh, { type: THREE.HalfFloatType, samples: this.samples ?? 4, depthTexture: depth, stencilBuffer: false });
  }
  _compTarget(rt) {
    return new THREE.WebGLRenderTarget(rt.width, rt.height, { type: THREE.HalfFloatType, depthBuffer: false });
  }
  _useScene(rt, comp) {
    this.sceneRT = rt;
    this.compRT = comp;
    this.depthTex = rt.depthTexture;
    const cu = this.compMat.uniforms;
    cu.tScene.value = rt.texture;
    cu.tDepth.value = rt.depthTexture;
    cu.uRes.value.set(rt.width, rt.height);
    this.upMat.uniforms.uSrc.value.set(rt.width, rt.height);
    this.godMat.uniforms.tDepth.value = rt.depthTexture;
    this.dofMat.uniforms.tDepth.value = rt.depthTexture;
    if (this.maskMat) this.maskMat.uniforms.tDepth.value = rt.depthTexture;
    WATER.tSceneDepth.value = rt.depthTexture;
    const hu = this.histMat.uniforms;
    hu.tScene.value = rt.texture;
    hu.tDepth.value = rt.depthTexture;
    this._histT = -1;
  }
  setScale(s) {
    if (s === this.scale) return;
    this.scale = s;
    const { w, h } = this._size(), r = this.renderer, prev = r.getRenderTarget();
    const next = this._sceneTarget(w, h), comp = s < 1 ? this._compTarget(next) : null;
    for (const t of [next, comp]) {
      if (!t) continue;
      if (r.initRenderTarget) r.initRenderTarget(t);
      r.setRenderTarget(t);
      r.clear();
    }
    r.setRenderTarget(prev);
    if (this._next) { this._next.dispose(); if (this._nextComp) this._nextComp.dispose(); }
    this._next = next;
    this._nextComp = comp;
  }

  warm(more = []) {
    const r = this.renderer, s = new THREE.Scene(), quad = new THREE.PlaneGeometry(2, 2), seen = new Set();
    const add = (m) => {
      if (!m || !m.isMaterial || seen.has(m)) return;
      seen.add(m);
      const q = new THREE.Mesh(quad, m);
      q.frustumCulled = false;
      s.add(q);
    };
    for (const o of [this, this.bloom, ...more]) for (const k in o) { const v = o[k]; if (Array.isArray(v)) v.forEach(add); else add(v); }
    const pts = new THREE.Points(this.bkPoints.geometry, this.bkPoints.material);
    pts.frustumCulled = false;
    s.add(pts);
    const prev = r.getRenderTarget();
    r.setRenderTarget(this.composer.readBuffer);
    const p = r.compileAsync ? r.compileAsync(s, this.fsCam) : Promise.resolve(r.compile(s, this.fsCam));
    r.setRenderTarget(prev);
    return p.finally(() => quad.dispose());
  }

  setDof(focus, aperture, dt = 1, bokeh = 0, hold = Infinity) {
    const k = 1 - Math.exp(-dt * 5);
    if (this.dof.aperture <= 0.002) { this.dof.focus = Math.min(hold, focus); this.dof.bokeh = bokeh ? 1 : 0; }
    else if (this.dof.bokeh) this.dof.focus = Math.min(hold, 1 / (1 / this.dof.focus + (1 / focus - 1 / this.dof.focus) * k));
    else this.dof.focus += (focus - this.dof.focus) * k;
    this.dof.aperture += (aperture - this.dof.aperture) * k;
    if (this.dof.aperture < 0.002 && aperture === 0) this.dof.aperture = 0;
  }
  setDofShape(near = 16, farK = 1, far = 16) { this.dof.near = near; this.dof.farK = farK; this.dof.far = far; }
  setBokehShape(near = 18, z0 = 0, z1 = 0) {
    this.dof.bkNear = near;
    this.bkU.uBkNear.value = near * (this._bkH || 1200) / 1200;
    this.bkU.uBkFarZ.value.set(z0, z1);
  }

  _bkSize(w, h) {
    const hw = Math.max(1, w >> 1), hh = Math.max(1, h >> 1);
    const qw = Math.ceil(hw / 2), qh = Math.ceil(hh / 2), p = new Float32Array(qw * qh * 3);
    for (let j = 0, n = 0; j < qh; j++) for (let i = 0; i < qw; i++, n += 3) { p[n] = (2 * i + 1) / hw; p[n + 1] = (2 * j + 1) / hh; }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    this.bkPoints.geometry.dispose();
    this.bkPoints.geometry = g;
    this.bkU.uBkK.value = 8 * h / 1200;
    this.bkU.uBkNear.value = this.dof.bkNear * h / 1200;
    this.bkU.uBkFar.value = 18 * h / 1200;
    this._bkH = h;
  }

  setSize() {
    const { w, h } = this._size();
    const gw = Math.max(1, Math.floor(w / this.godDiv)), gh = Math.max(1, Math.floor(h / this.godDiv));
    this.dofMat.uniforms.uRes.value.set(w, h);
    this.bkA.setSize(gw, gh);
    this.bkB.setSize(gw, gh);
    this.bkDownMat.uniforms.uTexel.value.set(1 / w, 1 / h);
    this.bkGatherMat.uniforms.uTexel.value.set(1 / gw, 1 / gh);
    this.bkCompMat.uniforms.uHalf.value.set(gw, gh);
    this._bkSize(w, h);
    this.gradeMat.uniforms.uAspect.value = w / h;
    this.gradeMat.uniforms.uBar.value.y = h;
    this.maskRT.setSize(w, h);
    this.maskMat.uniforms.uRes.value.set(w, h);
    if (this._next) {
      this.sceneRT.dispose();
      if (this.compRT) this.compRT.dispose();
      this._useScene(this._next, this._nextComp);
      this._next = this._nextComp = null;
    }
    const sw = Math.max(2, Math.round(w * this.scale)), sh = Math.max(2, Math.round(h * this.scale));
    this.sceneRT.setSize(sw, sh);
    if (this.scale < 1 && !this.compRT) this.compRT = this._compTarget(this.sceneRT);
    else if (this.scale >= 1 && this.compRT) { this.compRT.dispose(); this.compRT = null; }
    if (this.compRT) this.compRT.setSize(sw, sh);
    this.compMat.uniforms.uRes.value.set(sw, sh);
    this.upMat.uniforms.uSrc.value.set(sw, sh);
    this.histRT.setSize(sw, sh);
    this._histT = -1;
    this.compMat.uniforms.uGodRes.value.set(gw, gh);
    this.godRT.setSize(gw, gh);
    this.godRT2.setSize(gw, gh);
    this.composer.setPixelRatio(1);
    this.composer.setSize(w, h);
  }

  _breakout(dt) {
    const gu = this.gradeMat.uniforms, bar = BAND$1.bar, warm = this._warmNow;
    gu.uBar.value.x = bar;
    gu.uWheels.value = 0;
    if (!warm && (bar < 1e-3 || !this.wheels.length)) return;
    const cam = this.camera, P = cam.projectionMatrix.elements, V = cam.matrixWorldInverse, e = 1 - 2 * bar;
    let n = 0;
    if (!this._maskWarm) {
      this._maskWarm = new THREE.Mesh(new THREE.PlaneGeometry(1e-3, 1e-3), this.maskMat);
      this._maskWarm.frustumCulled = false;
      this.maskScene.add(this._maskWarm);
    }
    this._maskWarm.visible = warm;
    if (warm) n++;
    for (const m of this.wheels) {
      let s = this._mask.get(m);
      if (!s) {
        s = new THREE.Mesh(m.geometry, this.maskMat);
        s.matrixAutoUpdate = false;
        s.onBeforeRender = maskK;
        this.maskScene.add(s);
        this._mask.set(m, s);
      }
      s.visible = false;
      const g = m.geometry, u = s.userData, seen = u.seen;
      u.seen = false;
      if (!g || !shown(m)) { u.k = 0; continue; }
      if (!g.boundingSphere) g.computeBoundingSphere();
      _bkS.copy(g.boundingSphere).applyMatrix4(m.matrixWorld);
      _bkV$1.copy(_bkS.center).applyMatrix4(V);
      const z = -_bkV$1.z;
      if (z < cam.near) { u.k = 0; continue; }
      u.seen = true;
      const y = (P[5] * _bkV$1.y + P[9] * _bkV$1.z) / z, ry = (P[5] * _bkS.radius) / z;
      const x = (P[0] * _bkV$1.x + P[8] * _bkV$1.z) / z, rx = (P[0] * _bkS.radius) / z;
      const on = ry >= BK_MIN && Math.abs(x) - rx < 1 && Math.abs(y) + ry > e && Math.abs(y) - ry < e;
      u.k = !seen ? (on ? 1 : 0) : THREE.MathUtils.clamp((u.k || 0) + (on ? dt : -dt) / BK_FADE, 0, 1);
      if (u.k <= 0) continue;
      s.geometry = g;
      s.matrixWorld.copy(m.matrixWorld);
      s.visible = true;
      u.whole = !!m.userData.sand;
      if (u.whole && this.sandAt) {
        const c = _bkS.center, me = m.matrixWorld.elements;
        u.sandY = this.sandAt(c.x, c.z) - 0.004;
        const ny = me[9] / (Math.hypot(me[8], me[9], me[10]) || 1);
        const px = (2 * z) / (P[5] * gu.uBar.value.y);
        u.sandH = Math.max(0.002, BK_SAND * px * Math.sqrt(Math.max(0, 1 - ny * ny)));
      } else u.sandY = -1e4;
      n++;
    }
    const W = BAND$1.words, wo = gu.uWords.value, wk = gu.uWordsK;
    if (W) {
      _bkW.set(W[0], 1 - W[3], W[2], 1 - W[1]);
      if (wk.value <= 0) wo.copy(_bkW);
      else wo.lerp(_bkW, 1 - Math.exp(-dt / 0.07));
    }
    wk.value = THREE.MathUtils.clamp(wk.value + (W ? dt : -dt) / 0.2, 0, 1);
    if (!n) return;
    this.maskMat.uniforms.uNF.value.set(cam.near, cam.far);
    this.maskMat.uniforms.uBarH.value = bar;
    const r = this.renderer, ca = r.getClearAlpha();
    r.getClearColor(_bkC);
    r.setClearColor(0x000000, 0);
    r.setRenderTarget(this.maskRT);
    r.render(this.maskScene, cam);
    r.setClearColor(_bkC, ca);
    gu.uWheels.value = warm ? 0 : 1;
  }

  _xing(rel, dt) {
    const cu = this.compMat.uniforms, LR = cu.uLensR.value, cam = this.camera;
    if (this._histT >= 0) this._histT += dt;
    cu.uSceneH.value = this.sceneRT.height;
    let x = 0;
    if (LR < 0.1 && rel < 0.15 && rel > -0.3) {
      const e = cam.matrixWorld.elements, ty = Math.tan((cam.fov * Math.PI) / 360), tx = ty * cam.aspect;
      let lo = 1, hi = -1;
      for (let j = -1; j <= 1; j++) {
        for (let i = -1; i <= 1; i++) {
          const a = i * tx, b = j * ty;
          const dx = e[0] * a + e[4] * b - e[8], dy = e[1] * a + e[5] * b - e[9], dz = e[2] * a + e[6] * b - e[10];
          const vy = dy / Math.hypot(dx, dy, dz);
          lo = Math.min(lo, vy);
          hi = Math.max(hi, vy);
        }
      }
      const m = 0.3 * LR, under = rel + LR * lo - m < 0, air = rel + LR * hi + m > 0;
      if (!under) x = -1;
      else if (air) x = rel > 0 ? 1 : 2;
    }
    cu.uXing.value = Math.max(x, 0);
    cu.uHistK.value = x === 2 && this._histT >= 0 && this._histT < 0.25 ? 1 : 0;
    return x;
  }

  _camUniforms(mat) {
    const cam = this.camera;
    mat.uniforms.uProjInv.value.copy(cam.projectionMatrixInverse);
    mat.uniforms.uViewInv.value.copy(cam.matrixWorld);
    mat.uniforms.uCamPos.value.setFromMatrixPosition(cam.matrixWorld);
  }

  render(dt) {
    const r = this.renderer;
    if (this._old) { for (const t of this._old) if (t) t.dispose(); this._old = null; }
    if (this._next) {
      this._old = [this.sceneRT, this.compRT];
      this._useScene(this._next, this._nextComp);
      this._next = this._nextComp = null;
    }
    this.camera.updateMatrixWorld();
    this._camUniforms(this.godMat);
    this._camUniforms(this.compMat);
    const cu = this.compMat.uniforms;
    cu.uCamPV.value.multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse);
    const du = this.dofMat.uniforms;
    du.uProjInv.value.copy(this.camera.projectionMatrixInverse);
    du.uFocus.value = this.dof.focus;
    du.uAperture.value = this.dof.aperture;
    du.uCocK.value.set(this.dof.near, this.dof.farK, this.dof.far);
    this.bkU.uBkCap.value = 1.1 / Math.max(0.05, r.toneMappingExposure);
    this.gradeMat.uniforms.uSmearT.value = SMEAR_SHOWN / Math.max(0.05, r.toneMappingExposure);
    const cp = cu.uCamPos.value;
    const rel = cp.y - (WATER_Y + waveHeightDisp(cp.x, cp.z, U.uTime.value));
    cu.uCamRel.value = rel;
    const gu = this.gradeMat.uniforms;
    {
      const LR = cu.uLensR.value, cam = this.camera, e = 0.05, tt = U.uTime.value;
      gu.uWl.value.set(rel / Math.max(LR, 1e-3), Math.tan((cam.fov * Math.PI) / 360), cam.aspect, LR < 0.1 ? 1 : 0);
      if (LR < 0.1) {
        gu.uWlS.value.set((waveHeightDisp(cp.x + e, cp.z, tt) - waveHeightDisp(cp.x - e, cp.z, tt)) / (2 * e), (waveHeightDisp(cp.x, cp.z + e, tt) - waveHeightDisp(cp.x, cp.z - e, tt)) / (2 * e));
        gu.uCamR.value.setFromMatrix4(cam.matrixWorld);
      }
    }
    const plOn = this._plT >= 0 && this._plT < 1, wetOn = this._wetT >= 0 && this._wetT < 1.5;
    if (this._rel0 !== null && Math.abs(rel - this._rel0) < 0.6) {
      if (this._rel0 > 0 && rel <= 0 && !plOn) this._plT = 0;
      if (this._rel0 < -0.16 && rel >= -0.16 && !wetOn) this._wetT = 0;
    }
    if (gu.uSplash.value > this._spl0 + 0.3 && !plOn) this._plT = 0;
    if (gu.uWet.value > this._wet0 + 0.3 && !wetOn) this._wetT = 0;
    if (this._wetT === 0) this.drops.start(gu.uAspect.value);
    if (dt > 0) {
      const vIn = this._rel0 !== null && Math.abs(rel - this._rel0) < 0.6 ? (rel - this._rel0) / dt : 0;
      this._vRel += (THREE.MathUtils.clamp(vIn, -4, 4) - this._vRel) * (1 - Math.exp(-dt / 0.06));
      this._shT += dt;
    }
    const down = Math.max(0, -this._vRel), lineV = down / Math.max(0.02, cu.uLensR.value * this.camera.fov * Math.PI / 180);
    const ss = THREE.MathUtils.smoothstep;
    cu.uSheet.value.set(ss(down, 0.0, 0.08) * (0.4 + 0.5 * ss(down, 0.1, 0.6)), THREE.MathUtils.clamp(lineV * 0.2, 0.03, 0.18), this._shT);
    this._rel0 = rel;
    this._spl0 = gu.uSplash.value;
    this._wet0 = gu.uWet.value;
    gu.uPlungeT.value = this._plT;
    gu.uWetT.value = this._wetT;
    if (this._wetT >= 0) this.drops.update(this._wetT, dt);
    else if (this.drops.d.length) this.drops.clear();
    if (this._plT >= 0 && (this._plT += dt) > 1.3) this._plT = -1;
    if (this._wetT >= 0 && (this._wetT += dt) > 7.5) this._wetT = -1;
    du.uFarK.value = this.farBlur * THREE.MathUtils.smoothstep(-rel, 0.05, 1.2);
    const fdp = this.farDeep;
    du.uFar.value.set(9 - 3 * fdp, 30 - 2 * fdp, (2.4 + 1.0 * fdp) * du.uRes.value.y / 900);
    const fk = FX_SCENE.children;
    for (let i = 0; i < fk.length; i++) if (fk[i].userData.fxUnder) fk[i].visible = rel < 0.6;
    const warm = this._warm > 0;
    if (warm) this._warm--;
    this._warmNow = warm;
    const god = this.godEnabled && (rel < 0.3 || warm);
    cu.uGodOn.value = god ? 1 : 0;
    const xu = this._xing(rel, dt);
    r.setRenderTarget(this.sceneRT);
    r.render(this.scene, this.camera);
    if (xu === -1 || xu === 1) {
      const hu = this.histMat.uniforms;
      this._camUniforms(this.histMat);
      r.setRenderTarget(this.histRT);
      r.render(this.histScene, this.fsCam);
      cu.uHistPV.value.multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse);
      cu.uHistProjInv.value.copy(this.camera.projectionMatrixInverse);
      cu.uHistViewInv.value.copy(this.camera.matrixWorld);
      cu.uHistPos.value.copy(hu.uCamPos.value);
      this._histT = 0;
    }
    this._breakout(dt);
    if (god) {
      r.setRenderTarget(this.godRT);
      r.render(this.godScene, this.fsCam);
      const bu = this.godBlurMat.uniforms;
      bu.tSrc.value = this.godRT.texture;
      bu.uDir.value.set(1 / this.godRT.width, 0);
      r.setRenderTarget(this.godRT2);
      r.render(this.godBlurScene, this.fsCam);
      bu.tSrc.value = this.godRT2.texture;
      bu.uDir.value.set(0, 1 / this.godRT.height);
      r.setRenderTarget(this.godRT);
      r.render(this.godBlurScene, this.fsCam);
    }
    this.dofPass.enabled = warm || this.dof.aperture > 0 || du.uFarK.value > 0.001;
    r.setRenderTarget(null);
    if (this.hdr) this.hdr.begin(this.hdrK);
    this.composer.render(dt);
    if (this.hdr) this.hdr.present();
    if (this.lensText) this.lensText.update(dt);
  }
}

