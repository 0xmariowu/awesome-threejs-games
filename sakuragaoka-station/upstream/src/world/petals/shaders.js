// GLSL for the petal system. All motion is a pure function of uTime (deterministic screenshots).
// Lighting mimics the scene's MeshToonMaterial (4-band ramp, hemisphere ambient, real sun shadow map)
// and adds thin-petal translucency + a rim glow when the petal is between the camera and the sun.

const COMMON_V = /* glsl */`
uniform float uTime; uniform vec2 uWind; uniform float uGust; uniform vec3 uSunDir;
uniform sampler2D uDens; uniform vec4 uDensRect; uniform vec2 uDensSize;
uniform vec4 uTr[4]; uniform vec4 uTr2[4];
uniform float uResY; uniform float uMinPx; uniform float uFar;

vec3 h33(vec3 p3){ p3 = fract(p3 * vec3(.1031, .1030, .0973)); p3 += dot(p3, p3.yxz + 33.33); return fract((p3.xxy + p3.yxx) * p3.zyx); }
// analytic integral of the core's uGust(t) = 0.5 + 0.28 sin(.37t) + 0.14 sin(1.13t+1.7) + 0.08 sin(2.9t+.4)
float gustI(float t){ return 0.5*t - 0.7568*cos(0.37*t) - 0.1239*cos(1.13*t + 1.7) - 0.0276*cos(2.9*t + 0.4); }
// uDens (half float, raw): r = airborne density 0..1, g = landing surface y (m), b = roof clearance above it (m, 0 = open sky)
vec4 densAt(vec2 xz){ return texture2D(uDens, (xz - uDensRect.xy) * uDensRect.zw); }
float groundAt(vec2 xz){
  vec2 uv = (xz - uDensRect.xy) * uDensRect.zw;
  float hl = texture2D(uDens, uv).g;
  float hn = texture2D(uDens, (floor(uv * uDensSize) + 0.5) / uDensSize).g;
  return abs(hl - hn) > 0.07 ? hn : hl;   // steps (curbs, platform edges) stay crisp, slopes stay smooth
}
vec3 rotAxis(vec3 v, vec3 k, float a){ float c = cos(a), s = sin(a); return v*c + cross(k, v)*s + k*dot(k, v)*(1.0 - c); }
`;

export const FALL_VERT = /* glsl */`
#include <common>
#include <fog_pars_vertex>
#include <shadowmap_pars_vertex>
${COMMON_V}
attribute vec4 aA;   // origin xyz, kind
attribute vec4 aB;   // 4 seeds
attribute vec4 aC;   // size, fall speed, radius / half box, ground Y / box height
varying vec2 vUv; varying vec3 vN; varying vec3 vW; varying float vTint; varying float vCov; varying float vGlint;

// wind drift + falling-leaf sway + spiral + coherent flow + travelling gust fronts
vec3 flight(float t1, float t0, vec4 s, vec3 h, vec3 p0){
  vec2 wd = normalize(uWind);
  float wl = length(uWind);
  float drift = wl * (0.42*(t1 - t0) + 0.9*(gustI(t1) - gustI(t0)));
  vec3 o = vec3(wd.x*drift, 0.0, wd.y*drift);
  float sa = h.x*6.2831; vec2 sd = vec2(cos(sa), sin(sa));
  float sf = 0.8 + 1.1*s.z; float A = 0.16 + 0.46*s.y;
  float ph = sf*t1 + s.w*6.2831;
  o.xz += sd * A * sin(ph);
  o.y += 0.11 * A * cos(2.0*ph);
  float R = 0.07 + 0.38*h.y; float w = (1.0 + 2.1*h.z) * (s.x > 0.5 ? 1.0 : -1.0);
  float pa = w*t1 + h.x*6.2831;
  o.xz += R * vec2(cos(pa), sin(pa));
  vec3 q = p0 * 0.09;
  o.x += 0.8*sin(q.z*1.7 + t1*0.23 + 1.3) + 0.4*sin(q.y*2.3 + t1*0.41);
  o.z += 0.8*sin(q.x*1.9 - t1*0.19 + 2.1) + 0.4*cos(q.y*1.6 - t1*0.37);
  o.y += 0.3*sin(q.x*1.3 + q.z*1.1 + t1*0.31);
  float front = dot(p0.xz + o.xz, wd) * 0.07 - t1*0.55;
  float g = pow(max(0.0, sin(front)), 6.0) * (0.35 + uGust);
  o.y += 0.65*g; o.xz += wd * 0.55 * g;
  return o;
}

// train gust: lift + drag + vortex behind/along moving cars, small eddies at open doors
vec3 trainWake(vec3 P, vec4 s, float t, out float wsum, out float inside){
  vec3 o = vec3(0.0); wsum = 0.0; inside = 0.0;
  for (int i = 0; i < 4; i++){
    vec4 A = uTr[i]; vec4 B = uTr2[i];
    if (B.z < 0.5) continue;
    float v = A.z; float sp = abs(v); float dir = v < 0.0 ? -1.0 : 1.0; float hl = A.w;
    float along = (P.x - A.x) * dir;
    float behind = -(along + hl);
    float dz = P.z - A.y; float adz = abs(dz);
    if (behind > -2.0*hl && behind < 0.0 && adz < 1.45 && P.y > 0.28 && P.y < 3.9) inside = 1.0;
    float sideF = exp(-max(adz - 1.3, 0.0) * 0.55);
    float under = 1.0 - smoothstep(1.2, 1.6, adz);
    float hF = 1.0 - smoothstep(3.8, 7.0, P.y);
    float sF = smoothstep(0.4, 12.0, sp);
    float body = smoothstep(-2.0*hl - 3.0, -2.0*hl + 5.0, behind) * (1.0 - step(0.0, behind));
    float wake = step(0.0, behind) * exp(-behind / 24.0) * (0.55 + 0.45*smoothstep(0.0, 5.0, behind));
    float lift = sF * hF * sideF * (body * 0.4 * (1.0 - under) + wake);
    float drag = sF * sideF * hF * smoothstep(-2.0*hl, 10.0, behind) * exp(-max(behind - 10.0, 0.0) / 150.0);
    float ph = s.x*6.2831 + t*(2.0 + 2.2*s.y) - behind*0.2;
    o += vec3(dir * drag * (1.4 + 2.6*s.z),
              lift * (1.3 + 1.4*s.w + 0.9*sin(ph)),
              sign(dz + 1e-4) * lift * (0.35 + 1.0*(0.5 + 0.5*cos(ph))) );
    wsum += lift + drag*0.2;
    float st = (1.0 - sF) * B.x;
    if (st > 0.01) {
      float zD = A.y + B.y * 1.55;
      float nz = exp(-(P.z - zD)*(P.z - zD) / 0.8);
      float inX = 1.0 - smoothstep(hl - 1.0, hl + 0.5, abs(P.x - A.x));
      float dxd = mod(P.x - (A.x - hl + 3.0) + 3.0, 6.0) - 3.0;
      float df = exp(-dxd*dxd / 1.2);
      float e = st * nz * inX * df * (0.65 + 0.35*sin(t*0.7 + s.y*6.2831));
      float ph2 = s.x*6.2831 + t*(1.2 + 1.1*s.z);
      o += e * vec3(0.34*cos(ph2), 0.1 + 0.34*(0.5 + 0.5*sin(ph2*1.3 + s.w*4.0)), 0.34*sin(ph2));
      wsum += e * 0.9;
    }
  }
  return o;
}

void main(){
  float kind = aA.w; vec4 s = aB; float size = aC.x; float vFall = aC.y;
  float t = uTime;
  vec3 P; float fade = 1.0; float flyK = 1.0; float cov = 1.0;
  vec3 hs3 = h33(s.xyz * 97.13 + 3.7);
  vTint = s.z;
  if (kind < 0.5) {
    // ---------------- canopy emitter: spawn in the crown, flutter down, land, rest, fade
    float r = aC.z; float gB = aC.w;
    float drop = max(aA.y - gB, 1.0) + 0.3*r;
    float T = drop / vFall + 3.4;
    float tt = t + s.x * 211.0;
    float cyc = floor(tt / T); float age = tt - cyc * T;
    vec3 h = h33(vec3(s.y*131.7 + cyc*0.6180339, s.z*71.3 + cyc*1.3247, s.w*53.1 + cyc*0.37));
    float th = h.x*6.2831, rr = sqrt(h.y)*0.95;
    vec3 sp = aA.xyz + vec3(cos(th)*rr*r, (h.z - 0.6)*0.9*r, sin(th)*rr*r);
    float t0 = t - age;
    vec3 fo = flight(t, t0, s, h, sp);
    P = sp + fo; P.y -= vFall * age;
    float gS = groundAt(sp.xz);
    float aL = max(sp.y - gS, 0.0) / vFall;
    vec3 fL = flight(t0 + aL, t0, s, h, sp);
    float gL = groundAt(sp.xz + fL.xz);
    aL = max(sp.y + fL.y - gL, 0.0) / vFall;
    if (age > aL) {
      vec3 f2 = flight(t0 + aL, t0, s, h, sp);
      P = vec3(sp.x + f2.x, 0.0, sp.z + f2.z);
      P.xz += normalize(uWind) * 0.14 * (1.0 - exp(-(age - aL) * 1.3));
      P.y = groundAt(P.xz) + 0.014;
      flyK = 0.0;
    } else {
      float gH = groundAt(P.xz);
      P.y = max(P.y, gH + 0.014);
      flyK = smoothstep(0.0, 0.5, P.y - gH);
    }
    fade = smoothstep(0.0, 0.6, age) * (1.0 - smoothstep(T - 0.8, T, age));
    vec4 D = densAt(P.xz);
    float ceil = D.b;
    if (ceil > 0.05) fade *= smoothstep(ceil - 0.25, ceil, P.y - D.g);
  } else if (kind > 3.5 && kind < 4.5) {
    // ---------------- resting on ballast / platform: only the train gust lifts these
    P = aA.xyz; flyK = 0.0;
  } else if (kind > 5.5) {
    // ---------------- train swirl (SPEC 八): petals riding the car's wake / eddying at open doors
    int j = int(aC.z + 0.5);
    vec4 A = uTr[j]; vec4 B = uTr2[j];
    float v = A.z, sp = abs(v), dir = v < 0.0 ? -1.0 : 1.0, hl = A.w;
    float moving = smoothstep(0.8, 6.5, sp) * B.z;
    if (aC.w > 1.5) {
      // dragged along the car sides at bogie / window height, streaming from the front to the tail
      float u = fract(s.x + t * (0.07 + 0.06 * s.y));
      float side = s.z < 0.5 ? -1.0 : 1.0;
      P = vec3(A.x + dir * (hl - u * 2.0 * hl), 0.0, A.y + side * (1.52 + 0.3 * s.w + 0.1 * sin(t * 3.1 + s.x * 40.0)));
      P.y = groundAt(P.xz) + 0.18 + (0.25 + 0.95 * s.w) * (0.5 + 0.5 * sin(u * 11.0 + s.y * 6.2831 + t * 2.0));
      fade = moving * smoothstep(0.0, 0.08, u) * (1.0 - smoothstep(0.88, 1.0, u));
    } else if (aC.w < 0.5) {
      // lifted at the tail, left behind by the slowing air, rolled in a counter-rotating vortex pair
      float Tc = 2.6 + 1.6 * s.z;
      float tau = fract(s.x + t / Tc) * Tc;
      float side = s.y < 0.5 ? -1.0 : 1.0;
      float dist = 1.2 + sp * tau * (0.55 + 0.25 * s.w);
      float R = (0.3 + 0.6 * s.w) * (0.6 + 0.4 * smoothstep(0.0, 1.5, tau));
      float phi = s.y * 6.2831 + side * tau * (4.5 + 3.0 * s.z);
      float yc = 0.55 + 0.9 * (1.0 - exp(-tau * 1.6)) * (0.6 + 0.8 * s.z) - 0.25 * tau;
      P = vec3(A.x - dir * (hl + dist), 0.0, A.y + side * (0.95 + 0.35 * s.w) + R * cos(phi));
      P.y = max(groundAt(P.xz) + 0.03, groundAt(P.xz) + yc + R * sin(phi));
      P.x += dir * 0.6 * sin(phi * 0.5 + s.w * 4.0);
      fade = moving * smoothstep(0.0, 0.25, tau) * (1.0 - smoothstep(Tc * 0.6, Tc, tau)) * (1.0 - smoothstep(18.0, 40.0, dist));
    } else {
      // stopped, doors open: little loops just outside each door
      float door = floor(s.x * 5.999);
      float dx = -hl + 3.0 + 6.0 * door;
      float phi = s.y * 6.2831 + t * (0.9 + 1.3 * s.z) * (s.w < 0.5 ? -1.0 : 1.0);
      float R = (0.22 + 0.45 * s.z) * (0.75 + 0.25 * sin(t * 0.8 + s.y * 6.2831));
      vec3 c = vec3(A.x + dx + (s.w - 0.5) * 1.2, 0.0, A.y + B.y * (1.95 + 0.5 * s.w));
      P = c + vec3(R * cos(phi), 0.0, R * sin(phi) * 0.7);
      P.y = groundAt(P.xz) + 0.12 + (0.25 + 0.9 * s.w) * (0.5 + 0.5 * sin(phi * 0.7 + s.z * 5.0)) + 0.1 * sin(t * 2.3 + s.x * 30.0);
      fade = (1.0 - moving) * smoothstep(0.0, 0.4, B.x) * B.z;
    }
    flyK = 1.0;
  } else {
    // ---------------- camera-following ambient fields (near 1, mid 2, far 3, defocus 5)
    float hb = aC.z, H = aC.w;
    vec3 p0 = aA.xyz;
    vec3 fo = flight(t, 0.0, s, hs3, p0);
    vec2 xz = p0.xz + fo.xz;
    vec2 rel = mod(xz - cameraPosition.xz + hb, 2.0*hb) - hb;
    xz = cameraPosition.xz + rel;
    vec4 D = densAt(xz);
    float g = D.g;
    float yy = mod(p0.y - vFall*t + fo.y, H);
    bool nearK = kind < 1.5 || kind > 4.5;
    float base = nearK ? max(cameraPosition.y - 1.75, g) : g;
    P = vec3(xz.x, base + yy, xz.y);
    float ed = max(abs(rel.x), abs(rel.y));
    fade = (1.0 - smoothstep(hb*0.74, hb, ed)) * smoothstep(0.0, 0.6, yy) * (1.0 - smoothstep(H - 1.2, H, yy));
    float dn = nearK ? 0.3 + 0.7*D.r : D.r;
    fade *= smoothstep(s.w - 0.12, s.w + 0.12, dn);
    float ceil = D.b;
    if (ceil > 0.05) fade *= smoothstep(ceil - 0.3, ceil, P.y - g);
    fade *= smoothstep(-0.02, 0.2, P.y - g);
    if (nearK) fade *= 1.0 - smoothstep(10.0, 16.0, cameraPosition.y - g);   // no petal cloud around a high free camera
  }

  // ---------------- train gust
  float wk = 0.0, inside = 0.0;
  if (kind < 5.5) P += trainWake(P, s, t, wk, inside);
  else wk = 0.6;
  if (kind > 3.5 && kind < 4.5) {
    flyK = clamp(wk * 2.2, 0.0, 1.0);
    P.xz += (vec2(sin(t*2.3 + s.x*6.2831), cos(t*1.9 + s.y*6.2831)) * 0.22 + normalize(uWind) * 0.7) * clamp(wk, 0.0, 1.5);
    P.y += 0.1 * clamp(wk, 0.0, 1.0) * sin(t*3.1 + s.z*6.2831);
  }
  if (inside > 0.5 && kind != 4.0) fade = 0.0;

  // ---------------- orientation: rest pose (flat, random yaw) blended with tumbling flight
  vec3 lp = position * size;
  float yaw = s.x*6.2831 + s.y*3.0;
  float cy = cos(yaw), sy = sin(yaw);
  vec3 rp = vec3(cy*lp.x + sy*lp.z, lp.y, -sy*lp.x + cy*lp.z);
  vec3 rn = vec3(cy*normal.x + sy*normal.z, normal.y, -sy*normal.x + cy*normal.z);
  vec3 ax = normalize(h33(s.zyx*17.31) * 2.0 - 1.0 + vec3(0.0, 0.0001, 0.0));
  float spin = (1.3 + 4.0*s.z) * (s.y > 0.5 ? 1.0 : -1.0);
  float ang;
  if (s.w < 0.4) { ax = normalize(vec3(ax.x, ax.y*0.2, ax.z) + vec3(0.0001)); ang = 1.05*sin((0.9 + 1.4*s.z)*t + s.x*6.2831) + 0.22*spin*t; }
  else ang = spin*t + s.x*6.2831;
  ang += 1.5*(gustI(t) - 0.5*t) + wk*4.5;
  vec3 fp = rotAxis(rp, ax, ang), fnn = rotAxis(rn, ax, ang);
  vec3 vtx = mix(rp, fp, flyK);
  vec3 nrm = normalize(mix(rn, fnn, flyK) + vec3(0.0, 1e-4, 0.0));

  // ---------------- screen-size floor: far petals become tiny pink glints instead of vanishing
  vec4 mc = viewMatrix * vec4(P, 1.0);
  float dist = -mc.z;
  float px = size * projectionMatrix[1][1] * uResY * 0.5 / max(dist, 0.05);
  float k = max(1.0, uMinPx / max(px, 1e-3));
  cov = 1.0 / pow(k, 0.85);
  vGlint = 1.0 - 1.0 / k;
  #ifdef SOFT
    fade *= smoothstep(0.12, 0.3, dist);
  #else
    fade *= smoothstep(0.2, 0.42, dist);
  #endif
  fade *= 1.0 - smoothstep(uFar * 0.75, uFar, dist);
  vCov = cov;
  if (fade < 0.02 || cov < 0.03 || dist < 0.0) { gl_Position = vec4(0.0, 0.0, 2.0, 1.0); vUv = uv; vN = vec3(0.0, 1.0, 0.0); vW = P; return; }
  vtx *= k * smoothstep(0.0, 1.0, fade);

  vec4 worldPosition = vec4(P + vtx, 1.0);
  vW = worldPosition.xyz; vN = nrm; vUv = uv;
  vec3 transformedNormal = mat3(viewMatrix) * nrm;
  #include <shadowmap_vertex>
  vec4 mvPosition = viewMatrix * worldPosition;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`;

const LIGHT_F = /* glsl */`
uniform vec3 uSunDir; uniform vec3 uSunCol, uSkyCol, uGndCol;
float petalShadow(){
  float sh = 1.0;
  #if defined( USE_SHADOWMAP ) && ( NUM_DIR_LIGHT_SHADOWS > 0 )
    DirectionalLightShadow dls = directionalLightShadows[ 0 ];
    sh = getShadow( directionalShadowMap[ 0 ], dls.shadowMapSize, dls.shadowIntensity, dls.shadowBias, dls.shadowRadius, vDirectionalShadowCoord[ 0 ] );
  #endif
  return sh;
}
float toonBand(float ndl){ return ndl < 0.0 ? 0.0 : (ndl < 0.12 ? 0.42 : (ndl < 0.42 ? 0.8 : 1.0)); }
`;

export const FALL_FRAG = /* glsl */`
#include <common>
#include <packing>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <shadowmap_pars_fragment>
${LIGHT_F}
uniform sampler2D uTex; uniform vec3 uColA, uColB, uColBase, uGlowCol; uniform float uOpacity;
varying vec2 vUv; varying vec3 vN; varying vec3 vW; varying float vTint; varying float vCov; varying float vGlint;
void main(){
  vec4 tx = texture2D(uTex, vUv);
  #ifdef SOFT
    float a = tx.a * uOpacity;
  #else
    float a = tx.r;
  #endif
  a *= vCov;
  if (a < 0.04) discard;
  vec3 alb = mix(uColA, uColB, vTint);
  alb = mix(alb, uColBase, (1.0 - smoothstep(0.02, 0.36, vUv.y)) * 0.55);
  alb *= 1.0 - 0.06 * tx.b;
  vec3 N = normalize(vN); vec3 V = normalize(cameraPosition - vW);
  if (dot(N, V) < 0.0) N = -N;
  float ndl = dot(N, uSunDir);
  float sh = petalShadow();
  // thin petal: sky light wraps around it and sunlight passes through, so the shaded side stays a
  // pale lavender-pink instead of going grey; backlit petals glow at the rim (SPEC 十八)
  vec3 amb = mix(uGndCol, uSkyCol, 0.55 + 0.45 * N.y) * RECIPROCAL_PI * 1.38;
  vec3 sun = uSunCol * RECIPROCAL_PI * sh;
  float back = clamp(-ndl, 0.0, 1.0);
  float lit = max(toonBand(ndl), toonBand(-ndl) * 0.5);
  vec3 col = alb * (amb + sun * lit);
  float fwd = pow(clamp(dot(-V, uSunDir), 0.0, 1.0), 3.0);
  col += alb * vec3(1.0, 0.78, 0.84) * sun * (0.12 * sqrt(back) + 0.42 * back * fwd);
  col += uGlowCol * sun * tx.g * fwd * (0.35 + 0.65 * back) * 0.55;
  col *= 1.0 + vGlint * 0.22;
  gl_FragColor = vec4(col, a);
  #include <fog_fragment>
}
`;

// ------------------------------------------------------------------ floating (river rafts, gutter water)
export const FLOAT_VERT = /* glsl */`
#include <common>
#include <fog_pars_vertex>
#include <shadowmap_pars_vertex>
uniform float uTime; uniform float uResY; uniform float uFar;
attribute vec4 aA; // start xyz, seed
attribute vec4 aB; // flow dir xyz (unit), length
attribute vec4 aC; // width, length, yaw, phase (m)
attribute vec4 aD; // speed, meander amp, meander phase, cell + tint
varying vec2 vUv; varying vec3 vN; varying vec3 vW; varying float vTint;
void main(){
  float s = mod(aC.w + aD.x * uTime, aB.w);
  vec3 dir = aB.xyz; vec2 nrm = normalize(vec2(-dir.z, dir.x) + vec2(1e-5, 0.0));
  vec3 P = aA.xyz + dir * s;
  P.xz += nrm * aD.y * sin(s * 0.05 + aD.z) + nrm * aD.y * 0.35 * sin(uTime * 0.11 + aA.w * 6.2831);
  float fl = min(2.0, aB.w * 0.15);
  float fade = smoothstep(0.0, fl, s) * (1.0 - smoothstep(aB.w - fl, aB.w, s));
  float yaw = aC.z + 0.25 * sin(uTime * 0.07 + aA.w * 6.2831) + s * 0.004 * (aA.w - 0.5);
  float cy = cos(yaw), sy = sin(yaw);
  vec3 lp = vec3(position.x * aC.x, position.y, position.z * aC.y) * fade;
  vec3 rp = vec3(cy*lp.x + sy*lp.z, lp.y, -sy*lp.x + cy*lp.z);
  P.y += 0.004 * sin(uTime * 0.9 + P.x * 0.6 + aA.w * 6.0);
  float cell = floor(aD.w);
  vTint = fract(aD.w);
  #ifdef SHEET
    vUv = uv * 0.5 + vec2(mod(cell, 2.0), floor(cell / 2.0)) * 0.5;
  #else
    vUv = uv;
  #endif
  vec3 nrmW = normalize(vec3(0.06 * sin(aA.w * 40.0), 1.0, 0.06 * cos(aA.w * 31.0)));
  vec4 worldPosition = vec4(P + rp, 1.0);
  vW = worldPosition.xyz; vN = nrmW;
  vec3 transformedNormal = mat3(viewMatrix) * nrmW;
  #include <shadowmap_vertex>
  vec4 mvPosition = viewMatrix * worldPosition;
  if (fade < 0.01 || -mvPosition.z > uFar) { gl_Position = vec4(0.0, 0.0, 2.0, 1.0); return; }
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`;

export const FLOAT_FRAG = /* glsl */`
#include <common>
#include <packing>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <shadowmap_pars_fragment>
${LIGHT_F}
uniform sampler2D uTex; uniform vec3 uColA, uColB;
varying vec2 vUv; varying vec3 vN; varying vec3 vW; varying float vTint;
void main(){
  vec4 tx = texture2D(uTex, vUv);
  if (tx.a < 0.08) discard;
  vec3 alb = tx.rgb * mix(uColA, uColB, vTint) * 0.94;
  vec3 N = normalize(vN);
  float ndl = dot(N, uSunDir);
  float sh = petalShadow();
  vec3 amb = mix(uGndCol, uSkyCol, 0.5 + 0.5 * N.y) * RECIPROCAL_PI;
  // petals on water catch sky light from everywhere: shade softens instead of going purple
  vec3 col = alb * (amb * 1.5 + uSunCol * RECIPROCAL_PI * mix(0.62, 1.0, sh) * toonBand(ndl));
  // wet, slightly cooler where it touches the water
  col = mix(col, col * vec3(0.9, 0.93, 1.02), 0.35 * (1.0 - tx.a));
  gl_FragColor = vec4(col, tx.a);
  #include <fog_fragment>
}
`;
