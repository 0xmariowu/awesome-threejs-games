import{a as e,t}from"./three.module-e53_FFk2.js";import{$ as n,$r as r,Hn as i,Ja as a,Rn as o,U as s,Wi as c,Yt as l,ar as u,ea as d,ft as f,io as p,ir as m,no as h,pa as g,ro as _,rr as v,ta as y,tr as b}from"./three.core-DtjtRha-.js";import{a as x,d as S,f as C,i as w,n as T}from"./index-DGqtqlWq.js";var E=`
varying vec3 vDir;
void main() {
  vDir = position;
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;
}
`,D=`
${x}
${w}

uniform sampler2D uNoise;
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uSunColor;        // palette sun colour (linear)
uniform vec4 uSun;             // x: disk intensity, y: angular radius (rad), z: glow strength, w: twilight 0..1
uniform vec3 uBelt;            // belt of Venus colour (anti-solar pink band at twilight)
uniform vec3 uCloudLight;      // colour * intensity of the light on clouds (sun or moon)
uniform vec3 uCloudLightDir;
uniform vec3 uCloudAmbTop;
uniform vec3 uCloudAmbBot;
uniform vec4 uCloud;           // x coverage, y base altitude, z thickness, w density (1/m)
uniform vec4 uCloudWind;       // xy cumulus offset (m), zw cirrus offset (m)
uniform vec4 uCirrus;          // x amount, y altitude, z lit boost, w unused
uniform vec4 uNight;           // x night 0..1, y star brightness, z milky way, w aurora
uniform vec3 uMoonDir;
uniform vec3 uMoon2Dir;
uniform vec4 uMoon;            // x radius (rad), y brightness, z moon2 radius, w moon2 brightness
uniform mat3 uStarRot;         // world -> sky (celestial) frame
uniform float uPixelAngle;     // radians per pixel (for star size / texture LOD)
uniform float uTime;

varying vec3 vDir;

#define PI 3.14159265
#define TAU 6.2831853

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
vec2 hash22(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}
float hgPhase(float mu, float g) {
  float g2 = g * g;
  return (1.0 - g2) / (4.0 * PI * pow(max(1.0 + g2 - 2.0 * g * mu, 1e-4), 1.5));
}

// ---------------------------------------------------------------- sky gradient
// Deep zenith blue -> a bright, pale blue-white band -> the warm horizon colour. Going through a
// luminous pale middle (instead of lerping dark blue straight into orange) avoids muddy lavender.
vec3 skyBase(vec3 rd) {
  float y = max(rd.y, 0.0);
  float mu = dot(rd, uAtmoSunDir);
  float air = exp(-y * 2.6);                       // ~airmass: 1 at the horizon, 0.07 overhead
  float lumH = dot(uHorizon, vec3(0.2126, 0.7152, 0.0722));
  float lumZ = dot(uZenith, vec3(0.2126, 0.7152, 0.0722));
  vec3 pale = mix(uZenith / max(lumZ, 1e-4), vec3(1.0), 0.74) * mix(lumZ, lumH, 0.7);
  vec3 col = mix(uZenith, pale, smoothstep(0.08, 0.95, air));
  col = mix(col, uHorizon, pow(air, 6.0));
  // the half of the sky around the sun is brighter and warmer, the far side deeper
  float side = 0.5 + 0.5 * mu;
  col *= mix(0.8, 1.16, side * side);
  // Mie: broad warm glow + aureole, strongest low in the sky
  float sunUp = smoothstep(-0.2, 0.02, uAtmoSunDir.y);
  vec3 glowCol = mix(uSunColor, vec3(dot(uSunColor, vec3(0.2126, 0.7152, 0.0722))) * vec3(1.2, 1.0, 0.72), 0.3);
  float g = uSun.z * sunUp * (hgPhase(mu, 0.82) * 0.8 + hgPhase(mu, 0.45) * 0.55) * (0.45 + 0.55 * air);
  // near the sun the forward-scattered gold replaces the blue rather than tinting it
  col = col * (1.0 - clamp(g * 0.55, 0.0, 0.85)) + glowCol * g;
  // moonlit night: the sky around the moon turns a deep luminous blue
  float mmu = dot(rd, uMoonDir);
  col += vec3(0.32, 0.42, 0.75) * uNight.x * uMoon.y * (0.0025 + 0.02 * hgPhase(mmu, 0.55)) * smoothstep(-0.05, 0.1, uMoonDir.y);
  // twilight: belt of Venus opposite the sun, earth-shadow blue beneath it
  float anti = max(-mu, 0.0);
  float belt = exp(-pow((y - 0.09) / 0.07, 2.0)) * (0.3 + 0.7 * anti);
  col += uBelt * belt * uSun.w;
  col *= 1.0 - 0.3 * uSun.w * exp(-pow(y / 0.045, 2.0)) * anti;
  return col;
}

// ---------------------------------------------------------------- sun disk
vec3 sunDisk(vec3 rd) {
  float cosA = dot(rd, uAtmoSunDir);
  float r = uSun.y;
  float cosR = cos(r);
  if (cosA < cosR - 0.002) return vec3(0.0);
  float ang = acos(clamp(cosA, -1.0, 1.0));
  float x = ang / r;
  float aa = uPixelAngle / r * 1.2;
  float cover = 1.0 - smoothstep(1.0 - aa, 1.0 + aa, x);
  float mu = sqrt(max(1.0 - x * x, 0.0));
  float limb = 1.0 - 0.55 * (1.0 - mu) - 0.2 * (1.0 - mu * mu);
  // redden and dim toward the horizon (extinction)
  float ext = smoothstep(-0.02, 0.12, uAtmoSunDir.y);
  vec3 tint = mix(uSunColor * vec3(1.0, 0.72, 0.5), uSunColor, ext);
  return tint * uSun.x * limb * cover;
}

// ---------------------------------------------------------------- stars + Milky Way
vec2 cubeUV(vec3 d, out float face) {
  vec3 a = abs(d);
  if (a.x >= a.y && a.x >= a.z) { face = d.x > 0.0 ? 0.0 : 1.0; return d.yz / a.x; }
  if (a.y >= a.z) { face = d.y > 0.0 ? 2.0 : 3.0; return d.xz / a.y; }
  face = d.z > 0.0 ? 4.0 : 5.0;
  return d.xy / a.z;
}

vec3 starLayer(vec2 uv, float face, float n, float density, float bright, float pxUV) {
  vec2 g = (uv * 0.5 + 0.5) * n;
  vec2 cell = floor(g);
  vec2 f = g - cell;
  vec2 id = cell + face * 1013.0;
  float h = hash12(id);
  if (h > density) return vec3(0.0);
  vec2 pos = 0.2 + 0.6 * hash22(id + 7.1);
  float d = length(f - pos) / n;              // in uv units
  float sigma = pxUV * 0.75;
  float core = exp(-d * d / (2.0 * sigma * sigma));
  float m = h / density;                      // 0..1 within the population
  float b = bright * (0.06 + 2.6 * pow(1.0 - m, 12.0) + 0.35 * pow(1.0 - m, 4.0));
  float tw = 0.75 + 0.25 * sin(uTime * (1.3 + 2.7 * hash12(id + 3.3)) + h * 91.0);
  float temp = hash12(id + 11.7);
  vec3 c = temp < 0.25 ? vec3(1.0, 0.72, 0.5) : temp < 0.55 ? vec3(1.0, 0.93, 0.84) : vec3(0.75, 0.85, 1.0);
  return c * b * core * tw;
}

vec3 nightSky(vec3 rd) {
  vec3 sd = uStarRot * rd;
  // Milky Way: a tilted great circle in the celestial frame
  vec3 gN = normalize(vec3(0.42, 0.28, 0.86));
  vec3 gE1 = normalize(cross(gN, vec3(0.0, 1.0, 0.0)));
  vec3 gE2 = cross(gN, gE1);
  float gb = dot(sd, gN);
  float gl = atan(dot(sd, gE2), dot(sd, gE1));
  vec2 guv = vec2(gl / TAU * 5.0, gb * 2.2);
  vec4 n1 = textureLod(uNoise, guv * vec2(1.0, 1.0) + vec2(0.13, 0.4), 1.5);
  vec4 n2 = textureLod(uNoise, guv * vec2(3.0, 3.0) + vec2(0.71, 0.2), 1.0);
  float core = exp(-pow(gb / 0.17, 2.0));
  float wide = exp(-pow(gb / 0.34, 2.0));
  float bulge = exp(-pow(length(vec2(gl - 0.9, gb * 2.0)) / 0.9, 2.0));
  float clouds = smoothstep(0.35, 0.8, n1.r * 0.6 + n2.g * 0.4);
  float dust = smoothstep(0.45, 0.72, n2.b * 0.7 + n1.a * 0.3) * exp(-pow((gb - 0.02 * sin(gl * 3.0)) / 0.07, 2.0));
  float mw = (wide * 0.25 + core * (0.55 + 0.9 * clouds) + bulge * 1.3 * core) * (1.0 - 0.85 * dust);
  vec3 mwCol = mix(vec3(0.55, 0.62, 0.85), vec3(1.0, 0.86, 0.68), clamp(core * 0.6 + bulge, 0.0, 1.0));
  vec3 col = mwCol * mw * 0.055 * uNight.z;

  float face;
  vec2 uv = cubeUV(sd, face);
  float pxUV = uPixelAngle * (1.0 + dot(uv, uv)) * 0.5;
  float mwStars = core * (1.0 - dust) * (0.6 + 0.8 * clouds);
  col += starLayer(uv, face, 64.0, 0.09, 1.0, pxUV) * uNight.y;
  col += starLayer(uv + 0.37, face + 6.0, 150.0, 0.08, 0.3, pxUV) * uNight.y;
  col += starLayer(uv + 0.71, face + 12.0, 380.0, 0.015 + 0.2 * mwStars, 0.11, pxUV) * uNight.y;
  return col;
}

// ---------------------------------------------------------------- moons
// Disk of a sphere of angular radius r in direction md, lit from the sun. Returns rgb, a = coverage.
vec4 moonDisk(vec3 rd, vec3 md, float r, float seed, vec3 albedoTint) {
  float c = dot(rd, md);
  if (c < cos(r * 3.2)) return vec4(0.0);
  vec3 right = normalize(cross(md, vec3(0.0, 1.0, 0.0)));
  vec3 up = cross(right, md);
  vec2 p = vec2(dot(rd, right), dot(rd, up)) / r;
  float rr = length(p);
  float aa = uPixelAngle / r * 1.3;
  float cover = 1.0 - smoothstep(1.0 - aa, 1.0 + aa, rr);
  if (cover <= 0.0) return vec4(0.0);
  float z = sqrt(max(1.0 - rr * rr, 0.0));
  vec3 n = right * p.x + up * p.y - md * z;
  float lit = dot(n, uAtmoSunDir);
  float light = smoothstep(-0.04, 0.12, lit) * (0.35 + 0.65 * max(lit, 0.0));
  vec4 t1 = textureLod(uNoise, p * 0.23 + seed, 0.0);
  vec4 t2 = textureLod(uNoise, p * 0.61 + seed * 1.7, 0.0);
  float maria = smoothstep(0.52, 0.66, t1.r * 0.7 + t2.b * 0.3);
  float craters = smoothstep(0.78, 0.95, t2.a) * 0.35;
  float alb = (0.9 - 0.38 * maria + craters) * (0.92 + 0.08 * z);
  vec3 col = albedoTint * alb * light + albedoTint * 0.015 * (1.0 - light); // earthshine
  return vec4(col, cover);
}

// the pale twin: a faint ring seen almost edge-on
vec4 ringOf(vec3 rd, vec3 md, float r) {
  float c = dot(rd, md);
  if (c < cos(r * 3.2)) return vec4(0.0);
  vec3 right = normalize(cross(md, vec3(0.0, 1.0, 0.0)));
  vec3 up = cross(right, md);
  vec2 p = vec2(dot(rd, right), dot(rd, up)) / r;
  // ring plane tilted 76° toward the viewer, rotated 24°
  float ca = cos(0.42), sa = sin(0.42);
  vec2 q = vec2(ca * p.x + sa * p.y, -sa * p.x + ca * p.y);
  float tilt = 0.24;                       // cos of the tilt: flattening of the ellipse
  float s = q.y / tilt;                    // depth along the view axis (moon radii), sign = side
  float rho = length(vec2(q.x, s));
  float band = smoothstep(1.55, 1.62, rho) * (1.0 - smoothstep(2.35, 2.55, rho));
  band *= 0.55 + 0.45 * sin(rho * 38.0) * sin(rho * 11.0 + 1.0);
  band *= 0.75 + 0.25 * smoothstep(1.9, 2.0, rho); // Cassini-like gap
  // hidden behind the disk on the far side
  float rr = length(p);
  float behind = step(0.0, s) * (1.0 - smoothstep(0.98, 1.02, rr));
  float a = band * (1.0 - behind) * 0.55;
  return vec4(vec3(0.85, 0.86, 0.8) * a, a);
}

// ---------------------------------------------------------------- aurora
vec3 aurora(vec3 rd) {
  if (rd.y < 0.03) return vec3(0.0);
  float north = smoothstep(0.05, 0.5, -rd.z);
  if (north <= 0.0) return vec3(0.0);
  vec3 acc = vec3(0.0);
  float t = uTime;
#ifdef SKY_LITE
  const int N = 8;
#else
  const int N = 16;
#endif
  // slices through a curtain layer: p = where the ray crosses "height" h (curtains are vertical
  // sheets, so a ray meets each sheet at one height: bottom hem cyan, upper fringe amber)
  for (int i = 0; i < N; i++) {
    float fi = (float(i) + 0.5) / float(N);
    float h = 1.0 + fi * 2.4;
    vec2 p = rd.xz / rd.y * h;
    float wav = 0.5 * sin(p.x * 0.5 + t * 0.018) + 0.3 * sin(p.x * 1.3 - t * 0.03 + 1.3);
    wav += 0.4 * (textureLod(uNoise, vec2(p.x * 0.04 + t * 0.001, 0.31), 0.0).r - 0.5);
    float d1 = abs(p.y + 2.6 + wav);
    float d2 = abs(p.y + 4.2 + wav * 1.3 + 0.6 * sin(p.x * 0.3 + 2.0));
    float sheet = exp(-d1 * d1 * 9.0) + 0.55 * exp(-d2 * d2 * 6.0);
    // fine vertical rays drifting along the curtain
    float r1 = textureLod(uNoise, vec2(p.x * 0.9 + t * 0.004, 0.73), 0.0).b;
    float r2 = textureLod(uNoise, vec2(p.x * 2.7 - t * 0.006, 0.21), 0.0).r;
    float rays = 0.12 + 4.0 * pow(r1 * 0.6 + r2 * 0.4, 4.0);
    float fade = pow(1.0 - fi, 2.0) * smoothstep(0.0, 0.1, fi);
    vec3 c = mix(vec3(0.36, 0.88, 1.0), vec3(1.0, 0.64, 0.32), smoothstep(0.25, 0.85, fi));
    acc += c * sheet * rays * fade;
  }
  return acc * north * (1.6 / float(N));
}

// ---------------------------------------------------------------- clouds
// Cumulus = a heightfield in a slab: coverage c(x,z) from tiled noise decides where a column of
// cloud stands and how tall it is (flat base, domed top); see cumulus() for how it is rendered.
float cloudWeather;  // large-scale coverage offset for this pixel (set in cumulus())
float cloudCoverage(vec2 xz, float fp, bool detail) {
  vec2 p = xz + uCloudWind.xy;
  float lod0 = log2(max(fp * 256.0 / 36000.0, 1e-3));
  float lod1 = log2(max(fp * 256.0 / 11500.0, 1e-3));
  float a = textureLod(uNoise, p / 36000.0, lod0).r;
  float b = textureLod(uNoise, p / 11500.0 + vec2(0.37, 0.61), lod1).g;
  float n = a * 0.6 + b * 0.4;
  if (detail) {
    float lod2 = log2(max(fp * 256.0 / 2700.0, 1e-3));
    vec4 d = textureLod(uNoise, p / 2700.0 + vec2(0.13, 0.29), lod2);
    n += (d.b - 0.5) * 0.28 + (d.a - 0.55) * 0.1;
  }
  float cov = clamp(uCloud.x + cloudWeather, 0.0, 1.0);
  return clamp((n - (1.0 - cov)) / (cov * 0.6 + 0.05), 0.0, 1.0);
}
float cloudTop(float c) { return uCloud.y + uCloud.z * pow(c, 0.85); }
float cloudBot(float c) { float k = 1.0 - c; return uCloud.y + uCloud.z * 0.09 * k * k; }
// > 0 inside a cloud column (metres to the nearer of its top/bottom surfaces)
float cloudSDF(vec3 p, float fp, bool detail, out float c) {
  c = cloudCoverage(p.xz, fp, detail);
  if (c <= 0.0) return -100.0;
  return min(cloudTop(c) - p.y, p.y - cloudBot(c));
}

// Relief-mapped heightfield clouds: find the first surface the ray hits (linear search + binary
// refinement: exact, stable edges with no noise or slicing), then light that surface — heightfield
// normal, soft self-shadowing marched toward the light, silver lining on thin backlit edges,
// sky/ground ambient with occlusion, and an opacity from how long the ray stays inside.
// Returns rgb = premultiplied colour, a = transmittance; dist = hit distance.
vec4 cumulus(vec3 ro, vec3 rd, out float dist) {
  dist = 0.0;
  float base = uCloud.y;
  float topY = uCloud.y + uCloud.z;
  if (uCloud.x <= 0.0) return vec4(0.0, 0.0, 0.0, 1.0);
  float t0, t1;
  if (ro.y < base) {
    if (rd.y <= 0.01) return vec4(0.0, 0.0, 0.0, 1.0);
    t0 = (base - ro.y) / rd.y;
    t1 = (topY - ro.y) / rd.y;
  } else if (ro.y > topY) {
    if (rd.y >= -0.01) return vec4(0.0, 0.0, 0.0, 1.0);
    t0 = (topY - ro.y) / rd.y;
    t1 = (base - ro.y) / rd.y;
  } else {
    t0 = 0.0;
    t1 = rd.y > 0.0 ? (topY - ro.y) / rd.y : (rd.y < 0.0 ? (base - ro.y) / rd.y : 60000.0);
  }
  t1 = min(t1, t0 + 26000.0);
  if (t0 > 110000.0) return vec4(0.0, 0.0, 0.0, 1.0);
  vec2 mid = ro.xz + rd.xz * (0.5 * (t0 + t1)) + uCloudWind.xy * 0.35;
  cloudWeather = (textureLod(uNoise, mid / 90000.0 + vec2(0.71, 0.13), 0.0).b - 0.5) * 0.55;
#if defined(SKY_ENV)
  const int STEPS = 6;
  const int REFINE = 3;
  const bool DETAIL = false;
#elif defined(SKY_LITE)
  const int STEPS = 7;
  const int REFINE = 3;
  const bool DETAIL = true;
#else
  const int STEPS = 12;
  const int REFINE = 5;
  const bool DETAIL = true;
#endif
  float dt = (t1 - t0) / float(STEPS);
  float slope = 2.0 * uPixelAngle / max(abs(rd.y), 0.12);
  float c;
  float tOut = t0;
  float tIn = -1.0;
  for (int i = 0; i <= STEPS; i++) {
    float t = t0 + float(i) * dt;
    if (cloudSDF(ro + rd * t, t * slope, DETAIL, c) > 0.0) { tIn = t; break; }
    tOut = t;
  }
  if (tIn < 0.0) return vec4(0.0, 0.0, 0.0, 1.0);
  if (tIn > t0) {
    for (int k = 0; k < REFINE; k++) {
      float tm = 0.5 * (tOut + tIn);
      if (cloudSDF(ro + rd * tm, tm * slope, DETAIL, c) > 0.0) tIn = tm; else tOut = tm;
    }
  }
  float th = tIn;
  dist = th;
  vec3 p = ro + rd * th;
  float fp = th * slope;
  float cH;
  cloudSDF(p, fp, DETAIL, cH);
  float top = cloudTop(cH);
  float bot = cloudBot(cH);
  bool onBottom = (p.y - bot) < (top - p.y);

  // surface normal from the heightfield gradient (flat, dark bases; domed, billowy tops/sides)
  float e = max(35.0, fp * 2.0);
  float cx = cloudCoverage(p.xz + vec2(e, 0.0), fp, DETAIL);
  float cz = cloudCoverage(p.xz + vec2(0.0, e), fp, DETAIL);
  vec3 n = onBottom
    ? normalize(vec3((cloudBot(cx) - bot) / e, -1.0, (cloudBot(cz) - bot) / e))
    : normalize(vec3(-(cloudTop(cx) - top) / e, 1.0, -(cloudTop(cz) - top) / e));

  vec3 L = uCloudLightDir;
  float cc;
  // soft self-shadow toward the light (other billows, the column above)
  float occ = smoothstep(0.0, 50.0, cloudSDF(p + L * 110.0, fp, false, cc)) * 0.8
            + smoothstep(0.0, 90.0, cloudSDF(p + L * 330.0, fp, false, cc)) * 1.1;
#if !defined(SKY_ENV)
  occ += smoothstep(0.0, 140.0, cloudSDF(p + L * 800.0, fp, false, cc)) * 1.3;
#endif
  float sh = exp(-occ * 1.5);
  float ndl = dot(n, L);
  float diff = clamp(ndl * 0.62 + 0.38, 0.0, 1.0);
  float mu = dot(rd, L);
  // thin, backlit edges glow (forward scattering through little cloud)
  float thinness = 1.0 - smoothstep(0.0, 0.55, cH);
  float silver = pow(max(mu, 0.0), 7.0) * (0.35 + 1.8 * thinness);
  // (+ light that has wandered through the cloud: keeps shaded flanks from going dead grey)
  vec3 direct = uCloudLight * (sh * diff * 0.95 + silver * (0.3 + 0.7 * sh) + 0.12);
  // ambient: sky above, haze/ground bounce below; bases under thick columns are darker
  float up = clamp(n.y * 0.5 + 0.5, 0.0, 1.0);
  vec3 amb = mix(uCloudAmbBot, uCloudAmbTop, up * up);
  float hf = clamp((p.y - base) / max(top - base, 1.0), 0.0, 1.0);
  float ao = mix(0.5 + 0.35 * thinness, 1.0, smoothstep(0.0, 0.7, hf));
  vec3 col = direct + amb * ao;

  // opacity: how long the ray stays in cloud past the surface
  float in1 = smoothstep(0.0, 70.0, cloudSDF(p + rd * 90.0, fp, false, cc));
  float in2 = smoothstep(0.0, 160.0, cloudSDF(p + rd * 320.0, fp, false, cc));
  float alpha = 1.0 - exp(-uCloud.w * (30.0 + 120.0 * in1 + 420.0 * in2));
  // feathered rims where the column fades out entirely
  alpha *= smoothstep(0.0, 0.07, cH);
  return vec4(col * alpha, 1.0 - alpha);
}

// ---------------------------------------------------------------- distant cloud banks
// Towering cumulus far beyond the mountain ring, painted in (azimuth, elevation) space: a
// seam-free presence/height profile along the horizon (seam due south, kept empty), billowy
// Worley edges, shading from a pseudo-normal (density gradient) against the real light, silver
// rims when backlit, sunset light climbing up the towers, and their feet lost in the haze.
float bankDensity(float az, float el, out float H) {
  float u = az * (1.0 / PI);
  float pr = textureLod(uNoise, vec2(u * 0.85 + 0.12, 0.17), 0.0).r;
  float pr2 = textureLod(uNoise, vec2(u * 2.1 + 0.6, 0.63), 0.0).b;
  float sector = smoothstep(2.95, 2.35, abs(az));
  // towers of 7-17 deg in the NE-E (front-lit at sunset), a lower bank in the SW-W by the sun
  H = sector * smoothstep(0.44, 0.66, pr) * (0.08 + 0.5 * pr2 * pr2);
  vec2 q = vec2(az, el) * vec2(5.5, 5.5);
  float b1 = textureLod(uNoise, q + vec2(0.2, 0.5 + uTime * 0.0004), 0.0).g;
  float b2 = textureLod(uNoise, q * 2.3 + vec2(0.6, 0.1), 0.0).a;
  float bil = b1 * 0.7 + b2 * 0.3;
  return H - el + (bil - 0.52) * (0.03 + 0.2 * H);
}
vec4 cloudBanks(vec3 rd, vec3 hazeCol) {
  float el = asin(clamp(rd.y, -1.0, 1.0));
  if (el > 0.5 || el < -0.03) return vec4(0.0);
  float az = atan(rd.x, -rd.z);        // 0 north, +pi/2 east, -pi/2 west, +-pi south
  float H;
  float D = bankDensity(az, el, H);
  if (D <= 0.0) return vec4(0.0);
  float alpha = smoothstep(0.0, 0.014, D);
  // pseudo-normal from the density gradient (screen-space-ish, in angle units)
  float h2;
  float e = 0.006;
  float Du = bankDensity(az + e, el, h2) - D;
  float Dv = bankDensity(az, el + e, h2) - D;
  vec3 tang = vec3(cos(az), 0.0, sin(az));
  vec3 outw = vec3(sin(az), 0.0, -cos(az));
  vec3 n = normalize(-tang * (Du / e) * 0.06 - vec3(0.0, 1.0, 0.0) * (Dv / e) * 0.06 - outw * 0.55);
  vec3 L = uCloudLightDir;
  float ndl = dot(n, L);
  float wrap = clamp(ndl * 0.65 + 0.35, 0.0, 1.0);
  // low sun: light climbs the towers (bases in the earth's shadow), tops stay lit longest
  float rel = clamp(el / max(H, 0.02), 0.0, 1.0);
  float climb = mix(1.0, smoothstep(0.05, 0.95, rel), 1.0 - smoothstep(0.04, 0.3, L.y));
  float thin = 1.0 - smoothstep(0.0, 0.03, D);
  float back = max(dot(outw, L), 0.0);
  float rim = thin * pow(max(dot(rd, L), 0.0), 5.0) * back * 2.5;
  vec3 amb = mix(uCloudAmbBot, uCloudAmbTop, rel);
  vec3 col = uCloudLight * (wrap * climb * (0.75 - 0.35 * back) + rim) * 0.72 * (1.0 - 0.6 * uNight.x) + amb * (0.6 + 0.25 * rel);
  // they are 40-90 km away: heavy haze, strongest at their feet
  float hz = mix(0.35, 0.92, exp(-el * 14.0));
  col = mix(col, hazeCol, hz);
  return vec4(col * alpha, alpha);
}

vec4 cirrus(vec3 ro, vec3 rd) {
  if (rd.y <= 0.015 || uCirrus.x <= 0.0) return vec4(0.0);
  float t = (uCirrus.y - ro.y) / rd.y;
  vec2 p = ro.xz + rd.xz * t + uCloudWind.zw;
  float fp = t * uPixelAngle * 2.0 / max(rd.y, 0.1);
  // streaks stretched along a slanted wind axis
  vec2 q = vec2(0.83 * p.x + 0.55 * p.y, -0.55 * p.x + 0.83 * p.y);
  vec2 u1 = q * vec2(1.0 / 38000.0, 1.0 / 9000.0);
  vec2 u2 = q * vec2(1.0 / 9000.0, 1.0 / 1600.0);
  float a = textureLod(uNoise, u1, log2(max(fp * 256.0 / 9000.0, 1e-3))).b;
  float b = textureLod(uNoise, u2 + vec2(0.3, 0.1), log2(max(fp * 256.0 / 1600.0, 1e-3))).r;
  float ciPatch = textureLod(uNoise, p / 70000.0 + vec2(0.4, 0.8), 0.0).r;
  float d = smoothstep(0.5, 0.8, a * 0.75 + b * 0.25) * smoothstep(0.35, 0.7, b) * smoothstep(0.42, 0.62, ciPatch);
  d *= uCirrus.x * smoothstep(0.015, 0.12, rd.y);
  float mu = dot(rd, uCloudLightDir);
  vec3 col = uCloudLight * (0.3 + 2.6 * hgPhase(mu, 0.7) * uCirrus.z) + uCloudAmbTop * 0.8;
  return vec4(col * d, d);
}

// ---------------------------------------------------------------- main
void main() {
  vec3 rd = normalize(vDir);
  vec3 ro = cameraPosition;

  // haze band: the same atmosphere the fog uses, integrated to "infinity"
  vec3 hazeCol = atmoInscatter(rd);
  // the sky's haze band: the fog integrated to "infinity" along a ray tilted 1.8x steeper so the
  // band hugs the horizon, minus what the zenith already has (the gradient above models that
  // scattering itself) — identical to the fog at the horizon line, where terrain meets sky
  vec3 rdH = normalize(vec3(rd.x, rd.y * 1.8, rd.z));
  float opt = atmoOptical(ro, rdH, 60000.0);
  float optZ = atmoOptical(ro, vec3(0.0, 1.0, 0.0), 60000.0);
  float optSky = max(opt - optZ, 0.0);
  float F = 1.0 - exp(-optSky);
  // clouds get the share of that haze that lies in front of them (never hazier than the sky beyond)
  float optInf = max(atmoOptical(ro, rd, 60000.0), 1e-4);

  vec3 space;
  if (rd.y < 0.0) {
#ifdef SKY_ENV
    // below the horizon: the ground (dark, earthy) fading into the haze toward the horizon
    vec3 ground = (uCloudAmbBot * 0.35 + uCloudLight * max(uCloudLightDir.y, 0.0) * 0.05);
    space = mix(ground, hazeCol, exp(rd.y * 9.0));
    F = 0.0;
#else
    space = hazeCol;
#endif
  } else {
    space = skyBase(rd);
#ifndef SKY_ENV
    float ext = exp(-opt * 1.2);  // extinction for things beyond the atmosphere
    vec3 celestial = vec3(0.0);
    if (uNight.x > 0.001) {
      celestial += nightSky(rd) * uNight.x;
      celestial += aurora(rd) * uNight.w;
    }
    celestial += sunDisk(rd);
    vec4 m1 = moonDisk(rd, uMoonDir, uMoon.x, 0.17, vec3(1.0, 0.97, 0.92));
    vec4 m2 = moonDisk(rd, uMoon2Dir, uMoon.z, 0.61, vec3(0.86, 0.93, 0.88));
    vec4 rg = ringOf(rd, uMoon2Dir, uMoon.z);
    // moons occlude stars; in daylight they are pale (sky light adds on top)
    celestial = celestial * (1.0 - m1.a) + m1.rgb * uMoon.y;
    celestial = celestial * (1.0 - m2.a) * (1.0 - rg.a * 0.5) + m2.rgb * uMoon.w + rg.rgb * uMoon.w * 0.5;
    // soft moon halo
    float mh = max(dot(rd, uMoonDir), 0.0);
    celestial += vec3(0.5, 0.6, 0.85) * uMoon.y * 0.02 * (pow(mh, 900.0) * 3.0 + pow(mh, 60.0) * 0.4) * uNight.x;
    space += celestial * ext;
#endif
  }

  vec3 col = mix(space, hazeCol, F);
  vec4 bk = cloudBanks(rd, hazeCol);
  col = col * (1.0 - bk.a) + bk.rgb;

  // clouds (in front of the sky, hazed by the air between us and them)
  float cdist;
  vec4 cu = cumulus(ro, rd, cdist);
  vec4 ci = cirrus(ro, rd);
  if (ci.a > 0.0) {
    float fci = 1.0 - exp(-optSky * clamp(atmoOptical(ro, rd, (uCirrus.y - ro.y) / max(rd.y, 0.02)) / optInf, 0.0, 1.0));
    vec3 cc = mix(ci.rgb, hazeCol * ci.a, fci);
    col = col * (1.0 - ci.a) + cc;
  }
  if (cu.a < 1.0) {
    float fc = 1.0 - exp(-optSky * clamp(atmoOptical(ro, rd, cdist) / optInf, 0.0, 1.0));
    vec3 cc = mix(cu.rgb, hazeCol * (1.0 - cu.a), fc);
    col = col * cu.a + cc;
  }

  gl_FragColor = vec4(max(col, vec3(0.0)), 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`,O=256;function k(e){let t=S(C(e)),n=new Uint8Array(256);for(let e=0;e<256;e++)n[e]=e;for(let e=255;e>0;e--){let r=Math.floor(t()*(e+1)),i=n[e];n[e]=n[r],n[r]=i}let r=new Uint8Array(512);for(let e=0;e<512;e++)r[e]=n[e&255];return r}var A=[1,-1,1,-1,1.41421,-1.41421,0,0],j=[1,1,-1,-1,0,0,1.41421,-1.41421];function M(e,t,n,r){let i=Math.floor(e),a=Math.floor(t),o=e-i,s=t-a,c=(i%n+n)%n,l=(a%n+n)%n,u=(c+1)%n,d=(l+1)%n,f=(e,t,n,i)=>{let a=r[r[e]+t]&7;return A[a]*n+j[a]*i},p=o*o*o*(o*(o*6-15)+10),m=s*s*s*(s*(s*6-15)+10),h=f(c,l,o,s),g=f(u,l,o-1,s),_=f(c,d,o,s-1),v=f(u,d,o-1,s-1),y=h+(g-h)*p;return(y+(_+(v-_)*p-y)*m)*.9}function N(e,t,n,r){let i=Math.floor(e),a=Math.floor(t),o=9;for(let s=-1;s<=1;s++)for(let c=-1;c<=1;c++){let l=i+c,u=a+s,d=(l%n+n)%n,f=(u%n+n)%n,p=r[r[d]+f],m=r[r[d+17]+(f+91&255)],h=l+p/255,g=u+m/255,_=h-e,v=g-t,y=_*_+v*v;y<o&&(o=y)}return Math.sqrt(o)}function P(e,t,n,r,i){let a=0,o=.5,s=0,c=1;for(let l=0;l<r;l++)a+=o*M(e*n*c,t*n*c,n*c,i),s+=o,o*=.5,c*=2;return a/s}function F(e,t,n,r,i){let a=0,o=.6,s=0,c=1;for(let l=0;l<r;l++)a+=o*(1-Math.min(1,N(e*n*c,t*n*c,n*c,i))),s+=o,o*=.45,c*=2;return a/s}function I(){let e=k(`sky-a`),t=k(`sky-b`),n=k(`sky-c`),s=k(`sky-d`),l=new Uint8Array(O*O*4),u=e=>e<0?0:e>1?1:e;for(let r=0;r<O;r++){let i=r/O;for(let a=0;a<O;a++){let o=a/O,c=(r*O+a)*4,d=P(o,i,4,6,e)*.5+.5,f=F(o,i,5,3,t),p=P(o,i,8,5,n)*.5+.5,m=1-Math.min(1,N(o*12,i*12,12,s));l[c]=u((d-.5)*1.35+.5)*255,l[c+1]=u(f*1.15-.05)*255,l[c+2]=u((p-.5)*1.35+.5)*255,l[c+3]=u(m)*255}}let d=new f(l,O,O,r,a);return d.wrapS=c,d.wrapT=c,d.magFilter=o,d.minFilter=i,d.generateMipmaps=!0,d.colorSpace=``,d.needsUpdate=!0,d}function L(r,i,{size:a=128,periodic:s=!0}={}){let{renderer:c,scene:f,camera:p}=r,m=new e(a,{type:l,generateMipmaps:!1,minFilter:o,magFilter:o,depthBuffer:!1}),h=new d,v=new u(new g(1,32,16),i);v.frustumCulled=!1,h.add(v);let y=new n(.1,10,m);y.coordinateSystem=c.coordinateSystem,y.updateCoordinateSystem();let b=y.children,x=new t(c);x.compileCubemapShader();let S=null,C=6,w=!1,T=new _(1e9,0,0),E=-1e9;function D(){y.position.copy(p.position),y.updateMatrixWorld(!0),v.position.copy(p.position),v.updateMatrixWorld(!0),T.copy(p.position)}function O(e){c.setRenderTarget(m,e),c.render(h,b[e])}function k(){S=x.fromCubemap(m.texture,S),f.environment!==S.texture&&(f.environment=S.texture)}return{get texture(){return S?S.texture:null},refreshNow(e=E){let t=c.getRenderTarget(),n=c.getActiveCubeFace(),r=c.getActiveMipmapLevel();D();for(let e=0;e<6;e++)O(e);k(),c.setRenderTarget(t,n,r),C=6,w=!1,E=e},request(){C<6?w=!0:C=0},update(e){if(C===6){let t=T.distanceToSquared(p.position)>202500;if(w||s&&(t||e-E>12))w=!1,C=0;else return}let t=c.getRenderTarget(),n=c.getActiveCubeFace(),r=c.getActiveMipmapLevel();C===0&&D(),C<6&&(O(C),C++),C===6&&(k(),E=e),c.setRenderTarget(t,n,r)}}}var R=(e,t,n)=>{let r=Math.min(1,Math.max(0,(n-e)/(t-e)));return r*r*(3-2*r)};function z(e){try{let t=e.getContext(),n=t.getExtension(`WEBGL_debug_renderer_info`),r=n?t.getParameter(n.UNMASKED_RENDERER_WEBGL):t.getParameter(t.RENDERER);return/swiftshader|llvmpipe|softpipe|software/i.test(String(r))}catch{return!1}}async function B(e){let{env:t,camera:n,renderer:r,scene:i}=e,a=t.palette,o=new URLSearchParams(window.location.search).get(`skyq`),c=o===`full`?!1:o===`lite`||e.quality.level===`low`||z(r),l=I(),d={...e.atmosphereUniforms,uNoise:{value:l},uZenith:{value:new s},uHorizon:{value:new s},uSunColor:{value:new s},uSun:{value:new p(30,b.degToRad(.7),.5,0)},uBelt:{value:new s},uCloudLight:{value:new s},uCloudLightDir:{value:new _(0,1,0)},uCloudAmbTop:{value:new s},uCloudAmbBot:{value:new s},uCloud:{value:new p(.44,2600,1300,.016)},uCloudWind:{value:new p(0,0,0,0)},uCirrus:{value:new p(.8,8200,1,0)},uNight:{value:new p(0,1,1,1)},uMoonDir:{value:t.moonDir},uMoon2Dir:{value:t.moon2Dir},uMoon:{value:new p(b.degToRad(.95),1,b.degToRad(.55),1)},uStarRot:{value:new v},uPixelAngle:{value:.001},uTime:{value:0}},f={uniforms:d,vertexShader:E,fragmentShader:D,side:1,depthWrite:!1,depthTest:!0,fog:!1},x=new y({...f,defines:c?{SKY_LITE:``}:{}});x.name=`sky`;let S=new y({...f,defines:{SKY_ENV:``}});S.name=`sky-env`;let C=new u(new g(1,40,20),x);C.name=`sky`,C.frustumCulled=!1,C.renderOrder=1e4,C.matrixAutoUpdate=!1,C.onBeforeRender=(e,t,n)=>{let r=n.far||1e4;C.matrixWorld.makeScale(r*.9,r*.9,r*.9).setPosition(n.position)},i.add(C),i.background=null;let w=new s,O=new s(`#aebfff`),k=new s(`#d89aa8`),A=new m;function j(){let e=d,n=t.sunElevation;e.uZenith.value.copy(a.zenith),e.uHorizon.value.copy(a.horizon),e.uSunColor.value.copy(a.sun);let r=R(-1.2,.8,n);e.uSun.value.x=34*r*(.35+.65*R(0,14,n)),e.uSun.value.z=.25+a.glow*1.1,e.uSun.value.w=t.twilight,e.uBelt.value.copy(k).multiplyScalar(.45*R(-7,-1,n)+.1);let i=R(-7.5,-1.5,n);i>.001?(e.uCloudLight.value.copy(a.cloud).multiplyScalar(a.cloudIntensity*i),e.uCloudLightDir.value.copy(t.sunDir),e.uCloudLightDir.value.y<-.12&&(e.uCloudLightDir.value.y=-.12),e.uCloudLightDir.value.normalize()):(e.uCloudLight.value.copy(O).multiplyScalar(a.moonIntensity*.24),e.uCloudLightDir.value.copy(t.moonDir)),e.uCloudAmbTop.value.copy(a.zenith).multiplyScalar(.75).add(w.copy(a.horizon).multiplyScalar(.18)),e.uCloudAmbBot.value.copy(a.fog).lerp(a.zenith,.4).multiplyScalar(.72).add(w.copy(a.hemiGround).multiplyScalar(.3)),e.uNight.value.x=t.night,e.uNight.value.y=1,e.uNight.value.z=1,e.uNight.value.w=R(.55,1,t.night)*.85,e.uMoon.value.y=.35+2.1*t.night,e.uMoon.value.w=.22+1.1*t.night,A.makeRotationAxis(T,t.hour/24*Math.PI*2),e.uStarRot.value.setFromMatrix4(A)}j();let M=e.quality.level,N=L(e,S,{size:c&&z(r)?32:M===`high`?256:M===`low`?64:128,periodic:!c});r.compile(i,n),N.refreshNow(0),t.setIblActive(!0);let P=t.hour;t.onChange(()=>{j();let n=Math.abs(t.hour-P)>.25&&t.speed===0;P=t.hour,n||e.params.shot?N.refreshNow(d.uTime.value):N.request()});let F=new h,B=new h(7.5,-3.2),V=new h(19,5);return e.sky={uniforms:d,mesh:C,material:x,get envMap(){return N.texture},refreshEnvironment(){N.refreshNow(d.uTime.value)},get cloudCoverage(){return d.uCloud.value.x},set cloudCoverage(e){d.uCloud.value.x=Math.min(1,Math.max(0,e)),N.request()}},{order:-10,update(e,t){let i=d;i.uTime.value=t,i.uCloudWind.value.x+=B.x*e,i.uCloudWind.value.y+=B.y*e,i.uCloudWind.value.z+=V.x*e,i.uCloudWind.value.w+=V.y*e,r.getDrawingBufferSize(F);let a=b.degToRad(n.fov);i.uPixelAngle.value=2*Math.tan(a/2)/Math.max(1,F.y),N.update(t)}}}export{B as build};