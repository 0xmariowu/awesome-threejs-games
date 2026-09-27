// 共通GLSL：雑音（JSと同じ整数ハッシュ）・風・空・霞・光・影
export const WORLD_UNIFORMS = /* glsl */ `
uniform float uTime;
uniform vec3 uSunDir;
uniform vec3 uSunCol;
uniform vec3 uSH[9];
uniform vec4 uWind;      // xy=平均の風向（単位）, z=平均風速, w=突風の強さ
uniform vec2 uWindOff;   // 突風の模様の移流量
uniform vec2 uCloudOff;
uniform vec4 uCloud;     // x=雲底, y=雲頂, z=被覆のしきい値, w=タイル長
uniform vec4 uFog;       // x=密度, y=高さ減衰, z=基準高さ, w=太陽側の強さ
uniform vec3 uFogCol;
uniform vec3 uFogSun;
uniform vec4 uWorld;     // x=原点, y=セル, z=N, w=予備
uniform sampler2D tHW;   // r=高さ g=水面（texelFetch）
uniform sampler2D tNoise;
uniform sampler2D tCloudCov;
uniform float uFrame;
`;

export const NOISE = /* glsl */ `
uint pcg(uint v) {
  uint state = v * 747796405u + 2891336453u;
  uint word = ((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u;
  return (word >> 22u) ^ word;
}
float hashI2(ivec2 p) { return float(pcg(uint(p.x) + pcg(uint(p.y))) >> 8u) / 16777216.0; }
float hashI3(ivec3 p) { return float(pcg(uint(p.x) + pcg(uint(p.y) + pcg(uint(p.z)))) >> 8u) / 16777216.0; }
uint hashU2(ivec2 p) { return pcg(uint(p.x) + pcg(uint(p.y))); }
float vnoise2(vec2 x) {
  vec2 i = floor(x);
  vec2 f = x - i;
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  ivec2 ii = ivec2(i);
  float a = hashI2(ii), b = hashI2(ii + ivec2(1, 0)), c = hashI2(ii + ivec2(0, 1)), d = hashI2(ii + ivec2(1, 1));
  return a + (b - a) * u.x + (c - a) * u.y + (a - b - c + d) * u.x * u.y;
}
float ign(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
float sat(float x) { return clamp(x, 0.0, 1.0); }
vec3 sat3(vec3 x) { return clamp(x, 0.0, 1.0); }
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
`;

// 風（JSの sim/wind.js と同じ式）
export const WIND = /* glsl */ `
float gustField(vec2 p) {
  vec2 d = uWind.xy;
  vec2 c = vec2(-d.y, d.x);
  vec2 q = p - uWindOff;
  float a = dot(q, d), b = dot(q, c);
  float g = vnoise2(vec2(a / 34.0, b / 70.0)) * 0.65 + vnoise2(vec2(a / 13.0, b / 23.0) + 17.0) * 0.35;
  return smoothstep(0.34, 0.86, g);
}
vec2 windAt(vec2 p) {
  float g = gustField(p);
  return uWind.xy * uWind.z * (0.55 + uWind.w * g * 1.6);
}
`;

export const LIGHT = /* glsl */ `
const float PI = 3.14159265;
vec3 shIrr(vec3 n) {
  return uSH[0] + uSH[1] * n.y + uSH[2] * n.z + uSH[3] * n.x + uSH[4] * n.x * n.y + uSH[5] * n.y * n.z
    + uSH[6] * (3.0 * n.z * n.z - 1.0) + uSH[7] * n.x * n.z + uSH[8] * (n.x * n.x - n.y * n.y);
}
float hg(float mu, float g) { float g2 = g * g; return (1.0 - g2) / (4.0 * PI * pow(1.0 + g2 - 2.0 * g * mu, 1.5)); }
float cloudShadow(vec3 wp) {
  vec2 p = wp.xz + uSunDir.xz / max(uSunDir.y, 0.2) * (uCloud.x - wp.y);
  float cov = texture(tCloudCov, (p + uCloudOff) / uCloud.w).r;
  // 積雲の影：直射をほとんど遮る（残りは雲を抜けた散乱光）。縁は雲の厚みの分だけぼける
  float c = smoothstep(uCloud.z - 0.01, uCloud.z + 0.13, cov);
  return 1.0 - 0.72 * c;
}
// 霞（高さで薄くなる指数の霧）
float fogOptical(vec3 ro, vec3 rd, float dist) {
  float a = uFog.x, b = uFog.y;
  float ch = ro.y - uFog.z;
  float t = rd.y * b;
  float base = a * exp(-b * ch);
  float f = abs(t) > 1e-4 ? (1.0 - exp(-dist * t)) / t : dist;
  return base * f;
}
vec3 fogColor(vec3 rd) {
  float mu = dot(rd, uSunDir);
  return uFogCol + uFogSun * (hg(mu, 0.7) * 4.0 * PI * 0.16 + 0.12);
}
vec3 applyFog(vec3 col, vec3 ro, vec3 wp) {
  vec3 d = wp - ro;
  float dist = length(d);
  vec3 rd = d / max(dist, 1e-4);
  // 霞（エアロゾル）：高さで薄くなる。白っぽく、太陽の側で明るい
  vec3 odM = fogOptical(ro, rd, dist) * vec3(0.92, 1.0, 1.12);
  // 空気そのもの（レイリー）：高さでほとんど薄くならない。遠い山ほど青く沈む
  float hR = max(ro.y, 0.0) * 1.25e-4;
  float tR = rd.y * 1.25e-4;
  float lR = abs(tR) > 1e-7 ? (1.0 - exp(-dist * tR)) / tR : dist;
  // 近く（数十m）では効かせない：日かげの暗い色に青が乗って幹や軒下が青黒く転ぶのを防ぐ。遠い山にだけ効く
  vec3 odR = vec3(5.8e-6, 13.5e-6, 33.1e-6) * 1.6 * exp(-hR) * lR * (dist / (dist + 250.0));
  vec3 od = odM + odR;
  vec3 T = exp(-od);
  vec3 cM = fogColor(rd);
  vec3 cR = uFogCol * vec3(0.62, 0.84, 1.3) * (1.0 + 0.25 * max(dot(rd, uSunDir), 0.0));
  vec3 src = (cM * odM + cR * odR) / max(od, vec3(1e-6));
  return col * T + src * (1.0 - T);
}
`;

// 影の参照（近距離は毎フレーム、遠距離は起動時に一度）
export const SHADOW = /* glsl */ `
uniform highp sampler2DShadow tShadowN;
uniform highp sampler2DShadow tShadowF;
uniform mat4 uShadowNMat;
uniform mat4 uShadowFMat;
uniform vec4 uShadowP; // x=近距離の1テクセル(uv), y=遠距離の1テクセル, z=近距離の有効, w=予備
const vec2 POISSON[8] = vec2[8](vec2(-0.613, 0.617), vec2(0.170, -0.040), vec2(-0.299, -0.792), vec2(0.645, 0.493),
  vec2(-0.651, -0.235), vec2(0.421, -0.734), vec2(-0.118, 0.957), vec2(0.923, -0.146));
float shadowTap(highp sampler2DShadow s, vec3 uvz, float r, float rot, float bias) {
  float c = cos(rot), sn = sin(rot);
  mat2 R = mat2(c, sn, -sn, c);
  float acc = 0.0;
  for (int i = 0; i < 8; i++) acc += texture(s, vec3(uvz.xy + R * POISSON[i] * r, uvz.z - bias * uShadowP.w));
  return acc / 8.0;
}
float sunShadow(vec3 wp, float nl, vec2 frag) {
  float rot = ign(frag + uFrame * 7.13) * 6.2831;
  float sF = 1.0;
  vec4 pf = uShadowFMat * vec4(wp, 1.0);
  vec3 uf = pf.xyz / pf.w;
  if (all(greaterThan(uf.xy, vec2(0.0))) && all(lessThan(uf.xy, vec2(1.0))) && uf.z > 0.0 && uf.z < 1.0)
    sF = shadowTap(tShadowF, uf, uShadowP.y * 1.6, rot, 0.0009 + 0.0012 * (1.0 - nl));
  if (uShadowP.z > 0.5) {
    vec4 pn = uShadowNMat * vec4(wp, 1.0);
    vec3 un = pn.xyz / pn.w;
    vec2 e = min(un.xy, 1.0 - un.xy);
    float fade = sat(min(e.x, e.y) * 12.0);
    if (fade > 0.0 && un.z > 0.0 && un.z < 1.0) {
      float sN = shadowTap(tShadowN, un, uShadowP.x * 2.2, rot, 0.0006 + 0.0010 * (1.0 - nl));
      sF = mix(sF, min(sN, sF + 0.25), fade);
    }
  }
  return sF;
}
`;

// 世界テクスチャの座標
export const WORLDTEX = /* glsl */ `
vec2 worldUV(vec2 p) { return ((p - uWorld.x) / uWorld.y + 0.5) / uWorld.z; }
ivec2 worldTexel(vec2 p) { return ivec2(clamp(floor((p - uWorld.x) / uWorld.y + 0.5), vec2(0.0), vec2(uWorld.z - 1.0))); }
float heightFetch(ivec2 t) { return texelFetch(tHW, t, 0).r; }
float heightAt(vec2 p) {
  vec2 f = (p - uWorld.x) / uWorld.y;
  vec2 i = floor(f);
  vec2 u = f - i;
  ivec2 t = ivec2(clamp(i, vec2(0.0), vec2(uWorld.z - 2.0)));
  float a = texelFetch(tHW, t, 0).r, b = texelFetch(tHW, t + ivec2(1, 0), 0).r;
  float c = texelFetch(tHW, t + ivec2(0, 1), 0).r, d = texelFetch(tHW, t + ivec2(1, 1), 0).r;
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
`;

export const ALL = WORLD_UNIFORMS + NOISE + WIND + LIGHT + WORLDTEX;
