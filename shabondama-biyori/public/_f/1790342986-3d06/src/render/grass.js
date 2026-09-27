// 草と花：視点のまわりの4つの輪（近いほど細かい）。一株ずつ世界の格子に固定され、地表の種類で植物が決まる
// 株ごとの判定（種類・高さ・花・風・影）は、輪ごとの小さな前処理（1画素＝1株）で毎フレーム1回だけ計算し、頂点はそれを読む
import * as THREE from 'three';
import { ALL, SHADOW } from './glsl.js';

// 1株の形：葉がnb枚（各seg節・節ごとに左右2頂点）＋札がnc枚（花・小葉など、4頂点）
function tuftGeometry(nb, seg, nc) {
  const pos = [], idx = [];
  for (let b = 0; b < nb; b++) {
    const base = pos.length / 4;
    for (let s = 0; s <= seg; s++) { const t = s / seg; pos.push(b, t, -1, 0, b, t, 1, 0); }
    for (let s = 0; s < seg; s++) { const a = base + s * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  for (let c = 0; c < nc; c++) {
    const fb = pos.length / 4;
    pos.push(c, 0, -1, 1, c, 0, 1, 1, c, 1, 1, 1, c, 1, -1, 1);
    idx.push(fb, fb + 1, fb + 2, fb, fb + 2, fb + 3);
  }
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('aB', new THREE.Float32BufferAttribute(pos, 4));
  // three.js が position を必要とするので形だけ入れる
  g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(pos.length / 4 * 3), 3));
  g.setIndex(idx);
  return g;
}

// 株元の地面の板：3×3の格子（凸の稜線で板の中ほどが地形の下にもぐらないように）
function groundGeometry() {
  const pos = [], idx = [];
  for (let j = 0; j <= 2; j++) for (let i = 0; i <= 2; i++) pos.push(0, j / 2, i - 1, 1);
  for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) { const a = j * 3 + i; idx.push(a, a + 4, a + 1, a, a + 3, a + 4); }   // 上から見て反時計回り（表）
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('aB', new THREE.Float32BufferAttribute(pos, 4));
  g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(pos.length / 4 * 3), 3));
  g.setIndex(idx);
  return g;
}

// 地形の網目と同じ高さ（近景の地形は1.5mの格子を三角形で張る。対角線は市松に交互＝terrain.js と同じ）。
// なめらかな補間だと、へこんだ所で地形の三角形の下に株元が埋まる
const TERRAIN_Y = /* glsl */ `
float terrainY(vec2 p) {
  vec2 f = (p - uWorld.x) / uWorld.y;
  vec2 i = floor(f);
  vec2 u = f - i;
  ivec2 t = ivec2(clamp(i, vec2(0.0), vec2(uWorld.z - 2.0)));
  float a = texelFetch(tHW, t, 0).r, b = texelFetch(tHW, t + ivec2(1, 0), 0).r;
  float c = texelFetch(tHW, t + ivec2(0, 1), 0).r, d = texelFetch(tHW, t + ivec2(1, 1), 0).r;
  if (((t.x + t.y) & 1) == 1) return u.x + u.y <= 1.0 ? a + (b - a) * u.x + (c - a) * u.y : d + (c - d) * (1.0 - u.x) + (b - d) * (1.0 - u.y);
  return u.x >= u.y ? a + (b - a) * u.x + (d - b) * u.y : a + (c - a) * u.y + (d - c) * u.x;
}
// 高さと、その三角形の傾き（dy/dx, dy/dz）を同じ4点から
float terrainYG(vec2 p, out vec2 g) {
  vec2 f = (p - uWorld.x) / uWorld.y;
  vec2 i = floor(f);
  vec2 u = f - i;
  ivec2 t = ivec2(clamp(i, vec2(0.0), vec2(uWorld.z - 2.0)));
  float a = texelFetch(tHW, t, 0).r, b = texelFetch(tHW, t + ivec2(1, 0), 0).r;
  float c = texelFetch(tHW, t + ivec2(0, 1), 0).r, d = texelFetch(tHW, t + ivec2(1, 1), 0).r;
  if (((t.x + t.y) & 1) == 1) {
    if (u.x + u.y <= 1.0) { g = vec2(b - a, c - a) / uWorld.y; return a + (b - a) * u.x + (c - a) * u.y; }
    g = vec2(d - c, d - b) / uWorld.y; return d + (c - d) * (1.0 - u.x) + (b - d) * (1.0 - u.y);
  }
  if (u.x >= u.y) { g = vec2(b - a, d - b) / uWorld.y; return a + (b - a) * u.x + (d - b) * u.y; }
  g = vec2(d - c, c - a) / uWorld.y; return a + (c - a) * u.y + (d - c) * u.x;
}
`;

// ---- 前処理：1画素＝1株。地表の種類から植物・花・高さを決め、風と影をここで1回だけ引く ----
const PRE_VS = /* glsl */ `
void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }
`;
const PRE_FS = /* glsl */ `
precision highp float;
precision highp int;
${ALL}
${SHADOW}
${TERRAIN_Y}
uniform sampler2D tType, tSdf;
uniform vec2 uCenter;
uniform float uSpacing, uN, uLevel, uGroundY;
uniform vec4 uFade;   // x,y=現れる距離 z,w=消える距離
uniform mat4 uViewProj;
uniform vec3 uCam;
layout(location = 0) out vec4 o0;   // xyz=根元 w=種類
layout(location = 1) out vec4 o1;   // xy=風 z=突風 w=日なた
layout(location = 2) out vec4 o2;   // x=現れ具合 y=枯れ z=色の斑 w=花
layout(location = 3) out vec4 o3;   // x=高さ y=茂り zw=刈り株（株の中心から）
float h1(uint h, uint k) { return float(pcg(h + k * 0x9E3779B9u) >> 8u) / 16777216.0; }
// 田植えの格子（条0.30m×株0.18m）のうち、この区画に入る株
bool hillIn(ivec2 cellI, out vec2 hp) {
  vec2 c = (vec2(cellI) + 0.5) * uSpacing;
  hp = (floor(c / vec2(0.30, 0.18)) + 0.5) * vec2(0.30, 0.18);
  vec2 lo = vec2(cellI) * uSpacing;
  if (uLevel > 0.5) return true;
  return all(greaterThanEqual(hp, lo)) && all(lessThan(hp, lo + uSpacing));
}
void main() {
  o0 = vec4(0.0); o1 = vec4(0.0); o2 = vec4(0.0); o3 = vec4(0.0, 0.0, 99.0, 99.0);
  int n = int(uN);
  ivec2 g = ivec2(gl_FragCoord.xy) - ivec2(n / 2);
  ivec2 cellI = ivec2(floor(uCenter / uSpacing)) + g;
  uint hh = hashU2(cellI + ivec2(int(uLevel) * 7919, 0));
  vec2 jit = vec2(h1(hh, 1u), h1(hh, 2u)) - 0.5;
  vec2 p = (vec2(cellI) + 0.5 + jit * 0.9) * uSpacing;
  float dist = distance(p, uCam.xz);
  float fade = smoothstep(uFade.x, uFade.y, dist) * (1.0 - smoothstep(uFade.z, uFade.w, dist));
  if (uFade.x <= 0.0) fade = 1.0 - smoothstep(uFade.z, uFade.w, dist);
  if (fade <= 0.001) return;
  // 視錐台の外なら捨てる（まず粗く：高さは視点の地面で代用）
  vec4 cp0 = uViewProj * vec4(p.x, uGroundY, p.y, 1.0);
  if (cp0.w < -3.0 || any(greaterThan(abs(cp0.xy), vec2(cp0.w * 1.6 + 4.0)))) return;
  float gy = terrainY(p);
  vec4 cp = uViewProj * vec4(p.x, gy + 0.5, p.y, 1.0);
  if (cp.w < -2.5 || any(greaterThan(abs(cp.xy), vec2(cp.w * 1.25 + 2.2)))) return;

  ivec2 tx = worldTexel(p);
  vec4 ty = texelFetch(tType, tx, 0);
  int tc = int(ty.x * 255.0 + 0.5);
  float forest = ty.z;
  vec4 sd = texture(tSdf, worldUV(p));
  float r0 = h1(hh, 3u), r1 = h1(hh, 4u), r2 = h1(hh, 5u), r3 = h1(hh, 6u);

  // ---- 植物の種類 ----
  // kind: 0=なし 1=野の草 2=苗 3=れんげ 4=菜の花 5=休耕田の草 6=畑の葉 7=葦 8=笹 9=畦の草 10=短い草 11=シダ
  int kind = 0;
  bool paddy = tc >= 1 && tc <= 6;
  bool levee = paddy && sd.x < 0.5;
  vec2 hp;
  if (levee) kind = 9;
  else if (tc == 2) {
    // 苗：田植えの格子の株
    if (uLevel < 2.5 && hillIn(cellI, hp)) { kind = 2; p = hp + jit * 0.012; }
  }
  else if (tc == 3) kind = 3;
  else if (tc == 4) kind = r0 < 0.04 ? 10 : 0;
  else if (tc == 5) {
    kind = 5;
    if (uLevel < 1.5 && hillIn(cellI, hp)) o3.zw = hp - p;   // 去年の刈り株
  }
  else if (tc == 6 || tc == 15) { float row = abs(fract(p.x / 0.75) - 0.5); kind = row < 0.12 ? 6 : 0; }
  else if (tc == 7 || tc == 12 || tc == 13 || tc == 18 || tc == 0) kind = 1;
  else if (tc == 19) kind = r0 < 0.62 ? 4 : 1;
  else if (tc == 8) kind = sd.y > -0.35 ? 10 : 0;
  else if (tc == 9) { float c = min(sd.w, abs(sd.y + 1.45)); kind = c < 0.28 ? 10 : (c > 1.05 ? 1 : 0); }
  else if (tc == 14) {
    // 庭：ところどころに低い草と白詰草のまとまり
    float pn = texture(tNoise, p / 7.5).g + 0.25 * texture(tNoise, p / 2.1).r;
    kind = (pn > 0.72 && r0 < 0.85) ? 1 : (r0 < 0.03 ? 10 : 0);
  }
  else if (tc == 16) kind = (forest < 0.9 && r0 < 0.35) ? 8 : 0;
  else if (tc == 24) kind = r0 < 0.5 ? 11 : (r0 < 0.72 ? 10 : 0);   // 苔の床：シダと低い草
  else if (tc == 21) {
    // 岩棚：平らなところにだけシダ
    float sl = abs(heightAt(p + vec2(0.6, 0.0)) - heightAt(p - vec2(0.6, 0.0))) + abs(heightAt(p + vec2(0.0, 0.6)) - heightAt(p - vec2(0.0, 0.6)));
    kind = (sl < 0.6 && r0 < 0.32) ? 11 : 0;
  }
  if (tc == 12 && sd.z < 5.6) kind = 7;
  if (tc == 11 && sd.z > 3.7) kind = 7;
  if (kind == 0) return;
  // 遠い輪は背の低い物を間引く
  if (uLevel > 2.5 && (kind == 2 || kind == 6 || kind == 10)) return;
  if (kind == 2) gy = terrainY(p);

  // ---- 高さ・茂り・枯れ・花 ----
  float H = 0.3, dry = 0.0;
  int fl = 0;   // 0なし 1たんぽぽ 2白詰草 3れんげ 4菜の花 5綿毛 6すみれ 7いぬふぐり 8ほとけのざ 9すぎな 10葦の穂
  float cl = texture(tNoise, p / 28.0 + 0.37).b;          // 白詰草・すぎなのまとまり（約1.7mの胞）
  float pz = texture(tNoise, p / 9.0 + 0.11).r;
  float dens = clamp(0.35 + 1.1 * texture(tNoise, p / 3.3 + 0.5).r + 0.25 * (texture(tNoise, p / 23.0).g - 0.5), 0.45, 1.25);
  float fd = tc == 18 ? 2.0 : 1.0;
  if (kind == 1 || kind == 9) {
    H = mix(0.16, 0.42, r1) * (kind == 9 ? 0.85 : 1.0) * (tc == 18 ? 0.7 : 1.0) * mix(0.75, 1.1, dens - 0.3);
    dry = smoothstep(0.72, 0.95, texture(tNoise, p / 23.0).g + r2 * 0.25) * 0.8;
    if (kind == 9 && cl < 0.3 && r3 < 0.55) fl = 9;
    else if (kind == 1 && cl < 0.24 && r3 < 0.4) fl = r3 < 0.3 ? 2 : 1;
    else if (r3 < 0.045 * fd) fl = 1;
    else if (r3 < 0.054 * fd) fl = 5;
    else if (r3 < 0.066 * fd) fl = 2;
    else if (r3 < 0.08 * fd) fl = 6;
    else if (r3 < 0.1 * fd && pz > 0.5) fl = 7;
  } else if (kind == 2) {
    H = mix(0.15, 0.23, r1);
  } else if (kind == 3) {
    H = mix(0.08, 0.16, r1);
    if (r3 < 0.12) fl = 3;
  } else if (kind == 4) {
    H = mix(0.7, 1.15, r1);
    fl = 4;
  } else if (kind == 5) {
    H = mix(0.08, 0.26, r1);
    dry = r2 < 0.4 ? 0.7 + 0.3 * r2 : 0.15;
    if (pz > 0.55 && r3 < 0.3) fl = 8;
    else if (r3 < 0.07) fl = 7;
    else if (r3 < 0.1) fl = 1;
  } else if (kind == 6) {
    H = mix(0.12, 0.22, r1);
  } else if (kind == 7) {
    H = mix(0.8, 1.5, r1); dry = 0.55 + 0.4 * r2;
    if (r3 < 0.22) fl = 10;
  } else if (kind == 8) {
    H = mix(0.35, 0.75, r1);
  } else if (kind == 10) {
    H = mix(0.05, 0.14, r1);
    if (r3 < 0.1) fl = 7;
    else if (r3 < 0.15) fl = 8;
    else if (r3 < 0.18) fl = 1;
  } else if (kind == 11) {
    H = mix(0.28, 0.58, r1);
  }
  float mott = sat(texture(tNoise, p / 17.0).g * 1.2 - 0.1) * 0.65 + texture(tNoise, p / 4.3 + 0.2).r * 0.35;

  // 影は株ごとに一度（近距離の影→遠距離の影）
  float sh = 1.0;
  vec3 sp = vec3(p.x, gy + H * 0.6, p.y);
  vec4 pn = uShadowNMat * vec4(sp, 1.0);
  vec3 un = pn.xyz / pn.w;
  if (uShadowP.z > 0.5 && all(greaterThan(un.xy, vec2(0.02))) && all(lessThan(un.xy, vec2(0.98))) && un.z > 0.0 && un.z < 1.0) {
    sh = texture(tShadowN, vec3(un.xy, un.z - 0.0008 * uShadowP.w));
  } else {
    vec4 pf = uShadowFMat * vec4(sp, 1.0);
    vec3 uf = pf.xyz / pf.w;
    if (all(greaterThan(uf.xy, vec2(0.0))) && all(lessThan(uf.xy, vec2(1.0))) && uf.z > 0.0 && uf.z < 1.0)
      sh = texture(tShadowF, vec3(uf.xy, uf.z - 0.0015 * uShadowP.w));
  }
  sh *= cloudShadow(sp);

  // 斜面の急さ（0〜0.95）を種類の小数部に入れる。急な斜面では遠い輪の葉を太らせすぎない
  float ge = max(uSpacing, 0.6);
  vec2 gg = vec2(terrainY(p + vec2(ge, 0.0)) - terrainY(p - vec2(ge, 0.0)), terrainY(p + vec2(0.0, ge)) - terrainY(p - vec2(0.0, ge))) / (2.0 * ge);
  float steep = min(0.95, sat((1.0 - inversesqrt(1.0 + dot(gg, gg))) * 2.2));
  o0 = vec4(p.x, gy, p.y, float(kind) + steep);
  o1 = vec4(windAt(p), gustField(p), sh);
  o2 = vec4(fade, dry, mott, float(fl));
  o3.xy = vec2(H * fade, dens);
}
`;

const GRASS_VS = /* glsl */ `
${ALL}
${TERRAIN_Y}
uniform sampler2D tI0, tI1, tI2, tI3;
attribute vec4 aB;   // x=要素の番号 y=根元からの割合 z=左右(-1,1) w=0:葉 1:札
uniform vec2 uCenter;
uniform vec4 uSub;   // 描く範囲（格子の中の長方形）xy=始まり z=幅
uniform float uSpacing, uN, uLevel, uSeg, uNB, uPxH;
varying vec3 vCol;
varying vec3 vN;
varying vec3 vWorld;
varying vec4 vA;     // x=葉の根元からの割合 y=左右 z=株の中の高さの割合 w=形
varying vec4 vB;     // x=日なた y=透け z=根元の暗さ w=つや
varying vec3 vFCol;
#ifdef GROUND
centroid varying vec3 vFUv;   // 株元の板の座標は三角形の内側で補間する（板の縁の画素で外挿しない。下の GROUND の注）
#else
varying vec3 vFUv;   // xy=札の座標 z=種
#endif

float h1(uint h, uint k) { return float(pcg(h + k * 0x9E3779B9u) >> 8u) / 16777216.0; }
void collapse() { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); vCol = vec3(0.0); vA = vec4(0.0); vB = vec4(0.0); vFCol = vec3(0.0); vFUv = vec3(0.0); vN = vec3(0.0, 1.0, 0.0); vWorld = vec3(0.0); }

struct In { int kind; int fl; float H, dry, mott, dens, lv, gst, steep; vec2 w; uint hh; float r1, r2, r3; };
struct Bl { vec2 off; float lift; int parent; float L, W, th0, kap, az, tw, stiff, trans, maxA, gloss; int shape; vec3 cB, cM, cT; };
vec2 dir2(float a) { return vec2(cos(a), sin(a)); }
vec2 rot2v(vec2 q, float a) { float c = cos(a), s = sin(a); return vec2(c * q.x - s * q.y, s * q.x + c * q.y); }
const vec3 STRAW = vec3(0.34, 0.27, 0.15);

// 1枚の葉（茎・花茎も）の決め方。false＝この株では使わない
bool bladeP(In c, int e, out Bl b) {
  uint bh = c.hh + uint(e) * 1013u;
  float ra = h1(bh, 11u), rb = h1(bh, 12u), rc = h1(bh, 13u), rd = h1(bh, 14u), re = h1(bh, 15u), rf = h1(bh, 16u);
  int nb = int(uNB);
  float lv = c.lv;
  // 既定：野の草の葉（株の中心から外へ開く）
  b.az = ra * 6.2831;
  // 株の芯から少し開き、半分ほどは区画の中に散らばる（株の格子が見えないように）
  b.off = dir2(b.az) * (0.004 + 0.02 * rd) + (vec2(rb, rc) - 0.5) * uSpacing * (h1(bh, 20u) < 0.45 ? 0.35 : 1.0);
  b.lift = 0.0; b.parent = -1;
  b.L = c.H * (0.55 + 0.6 * rd);
  b.W = 0.0046 * (0.7 + 0.6 * re);
  b.th0 = 0.06 + 0.42 * rf;
  b.kap = (0.2 + 1.35 * rc) * smoothstep(0.06, 0.34, b.L);
  b.tw = (rb - 0.5) * 1.8;
  b.stiff = 1.0; b.trans = 1.0; b.maxA = 2.3; b.gloss = 0.5;
  b.shape = 0;
  vec3 yel = vec3(0.23, 0.34, 0.05), blu = vec3(0.08, 0.19, 0.055);
  b.cT = mix(blu, yel, sat(re * 0.75 + c.mott * 0.7 - 0.25));
  b.cM = b.cT * vec3(0.7, 0.8, 0.68);
  // 根元の鞘は淡い黄緑（暗がりは光の遮りで出す。色まで暗いと根元が黒い棘になる）
  b.cB = mix(b.cT, vec3(0.24, 0.24, 0.12), 0.45) * 0.9;
  int k = c.kind;

  if (k == 1 || k == 9 || k == 5 || k == 10) {
    bool special = false;
    // 花や小さな草の役
    if (c.fl == 1 || c.fl == 5) {
      if (e == 0) {   // 花茎（綿毛は背が伸びる）
        b.shape = 1; b.L = c.fl == 5 ? mix(0.22, 0.38, rd) : mix(0.1, 0.24, rd); b.L = min(b.L, c.H * 1.4 + 0.06);
        b.W = 0.0017; b.th0 = 0.04 + 0.2 * rf; b.kap = -0.1 + 0.3 * rc; b.stiff = 2.2; b.off *= 0.3;
        b.cB = vec3(0.16, 0.12, 0.08); b.cM = vec3(0.12, 0.16, 0.06); b.cT = vec3(0.13, 0.18, 0.06); b.tw = 0.0;
        special = true;
      } else if (e <= 3 && nb >= 5) {   // ロゼットの葉（地面に広がる）
        b.shape = 5; b.L = mix(0.09, 0.17, rd); b.W = 0.013; b.th0 = 1.05 + 0.3 * rf; b.kap = 0.15; b.maxA = 1.55;
        b.off = dir2(b.az) * 0.01; b.tw = 0.2; b.stiff = 3.0; b.gloss = 0.6;
        b.cB = vec3(0.07, 0.1, 0.03); b.cM = vec3(0.045, 0.12, 0.025); b.cT = vec3(0.07, 0.16, 0.03);
        special = true;
      }
    } else if (c.fl == 2 && e <= 2) {
      // 白詰草：花茎1本と小葉の柄2本
      b.shape = 1; b.W = e == 0 ? 0.0013 : 0.0009; b.tw = 0.0;
      b.L = e == 0 ? mix(0.09, 0.17, rd) : mix(0.035, 0.09, rd);
      b.th0 = e == 0 ? 0.08 : 0.25 + 0.5 * rf; b.kap = e == 0 ? 0.25 : 0.4; b.stiff = 2.0; b.off *= 0.4;
      b.cB = vec3(0.12, 0.14, 0.07); b.cM = vec3(0.1, 0.16, 0.06); b.cT = vec3(0.12, 0.18, 0.06);
      special = true;
    } else if (c.fl == 6 && e <= 1) {
      // すみれ：うつむく花茎と葉の柄
      b.shape = 1; b.W = 0.001; b.tw = 0.0; b.stiff = 2.0; b.off *= 0.3;
      b.L = e == 0 ? mix(0.06, 0.11, rd) : mix(0.03, 0.06, rd);
      b.th0 = e == 0 ? 0.15 : 0.5; b.kap = e == 0 ? 1.5 : 0.4;
      b.cB = vec3(0.12, 0.08, 0.1); b.cM = vec3(0.09, 0.12, 0.06); b.cT = vec3(0.14, 0.08, 0.14);
      special = true;
    } else if (c.fl == 8 && e == 0) {
      // ほとけのざ：四角い茎
      b.shape = 1; b.W = 0.0018; b.tw = 0.0; b.stiff = 2.0; b.off *= 0.3;
      b.L = mix(0.08, 0.18, rd); b.th0 = 0.1 + 0.25 * rf; b.kap = 0.3;
      b.cB = vec3(0.16, 0.08, 0.08); b.cM = vec3(0.12, 0.12, 0.05); b.cT = vec3(0.12, 0.14, 0.05);
      special = true;
    } else if (c.fl == 9 && e <= 3) {
      if (e == 3 && rb < 0.45) {
        // つくし：節のはかまと茶色の穂
        b.shape = 9; b.L = mix(0.08, 0.17, rd); b.W = 0.0032; b.th0 = 0.03 + 0.12 * rf; b.kap = 0.08; b.stiff = 3.0; b.tw = 0.0;
        b.cB = vec3(0.4, 0.33, 0.22); b.cM = vec3(0.42, 0.35, 0.24); b.cT = vec3(0.24, 0.15, 0.08); b.trans = 0.4;
      } else {
        // すぎな：節ごとに輪生する細い枝
        b.shape = 8; b.L = mix(0.12, 0.3, rd); b.W = 0.02; b.th0 = 0.04 + 0.25 * rf; b.kap = 0.1 + 0.35 * rc; b.stiff = 1.4; b.tw = 0.0;
        b.cB = vec3(0.09, 0.14, 0.05); b.cM = vec3(0.07, 0.16, 0.03); b.cT = vec3(0.12, 0.24, 0.045);
      }
      special = true;
    }
    if (!special) {
      // 茂りの薄いところは葉を減らす
      // 茂りの薄いところの余りの葉は、根元を埋める短い下葉にする（近い2輪だけ）
      bool under = float(e) + 0.5 > float(nb) * c.dens + 0.5 && e > 0;
      if (under && lv > 1.5) return false;
      if (k == 10) { b.L *= 0.9; b.W *= 1.1; }
      if (under) {
        b.L = c.H * (0.22 + 0.25 * rd); b.W *= 1.25; b.th0 = 0.45 + 0.6 * rf; b.kap = 0.6 + 0.6 * rc; b.maxA = 1.7; b.stiff = 2.2;
        b.off = dir2(b.az) * 0.01 + (vec2(rb, rc) - 0.5) * uSpacing * 0.9;
        b.cT *= 0.95; b.cM *= 0.92; b.trans = 1.0;
      }
      float rg = h1(bh, 17u);
      if (rg < 0.1 + 0.45 * c.dry) {
        // 去年の枯れ草（寝て、日に焼けた藁色）
        b.th0 = 0.95 + 0.55 * rf; b.kap = 0.35; b.maxA = 1.62; b.L *= 0.85; b.stiff = 3.0; b.trans = 0.45; b.gloss = 0.35;
        vec3 s = STRAW * (0.6 + 0.6 * rc);
        b.cB = s * 0.55; b.cM = s * 0.85; b.cT = s;
      } else if (!under && lv < 1.5 && h1(bh, 19u) < (k == 5 ? 0.02 : 0.07) && k != 10) {
        // イネ科の穂（細い茎の先に小穂）
        b.shape = 2; b.L = c.H * mix(1.15, 1.7, rd); b.W = 0.0011; b.th0 = 0.04 + 0.16 * rf; b.kap = 0.25 + 0.5 * rc; b.stiff = 1.6; b.tw = 0.0;
        b.cB = vec3(0.12, 0.15, 0.06); b.cM = vec3(0.11, 0.17, 0.05); b.cT = mix(vec3(0.2, 0.17, 0.1), vec3(0.16, 0.12, 0.13), rb);
      } else {
        if (h1(bh, 18u) < 0.22 + 0.3 * c.dry) b.cT = mix(b.cT, STRAW * 1.1, 0.55);   // 先枯れ
        b.cB = mix(b.cB, STRAW * 0.6, c.dry * 0.5);
      }
    }
    // 去年の刈り株（休耕田）
    if (k == 5 && e >= nb - 3 && c.fl != 9 && lv < 1.5) {
      b.shape = 1; b.L = mix(0.05, 0.11, rd); b.W = 0.0024; b.th0 = 0.03 + 0.28 * rf; b.kap = 0.05; b.stiff = 4.0; b.tw = 0.0; b.trans = 0.35; b.gloss = 0.3;
      b.off = vec2(9e3);   // 目印：刈り株の位置を使う
      vec3 s = STRAW * vec3(0.95, 0.95, 1.0) * (0.55 + 0.45 * rc);
      b.cB = s * 0.6; b.cM = s * 0.9; b.cT = s * 0.8;
    }
  } else if (k == 2) {
    // 苗：1株に3〜4本、扇に開く若い葉
    b.off = dir2(b.az) * 0.004;
    b.L = c.H * (0.65 + 0.45 * rd); b.W = 0.0027; b.th0 = 0.1 + 0.45 * rf; b.kap = 0.3 + 0.6 * rc; b.stiff = 1.6; b.tw = (rb - 0.5) * 0.8;
    b.cB = vec3(0.13, 0.2, 0.08); b.cM = vec3(0.12, 0.26, 0.05); b.cT = vec3(0.21, 0.37, 0.06) * (0.9 + 0.2 * re); b.gloss = 0.45;
  } else if (k == 3) {
    // れんげ：羽状の小葉が地面を覆う
    if (e == 0 && c.fl == 3) {
      b.shape = 1; b.L = c.H * 1.25 + 0.05; b.W = 0.0014; b.th0 = 0.1; b.kap = 0.35; b.stiff = 2.0; b.tw = 0.0; b.off *= 0.3;
      b.cB = vec3(0.1, 0.13, 0.06); b.cM = vec3(0.1, 0.16, 0.05); b.cT = vec3(0.12, 0.16, 0.06);
    } else {
      b.shape = 4; b.L = c.H * (0.9 + 0.6 * rd); b.W = 0.02; b.th0 = 0.35 + 0.55 * rf; b.kap = 0.25 + 0.45 * rc; b.maxA = 1.6; b.stiff = 1.6; b.tw = 0.3;
      b.off = dir2(b.az) * 0.01 + (vec2(rb, rc) - 0.5) * uSpacing * 0.45;
      b.cB = vec3(0.085, 0.17, 0.04); b.cM = vec3(0.11, 0.235, 0.05); b.cT = vec3(0.155, 0.31, 0.062) * (0.85 + 0.3 * re); b.gloss = 0.55; b.trans = 1.1;
    }
  } else if (k == 4 && lv > 1.5) {
    // 遠い菜の花：茎は描かない（数画素の棒になる）。房の下の葉の茂みを2枚だけ、房は札で高さをずらして置く
    if (e > 1) return false;
    b.shape = 0; b.L = c.H * (0.3 + 0.15 * rd); b.W = 0.024; b.th0 = 0.7 + 0.4 * rf; b.kap = 0.5; b.maxA = 1.9; b.stiff = 1.6;
    b.cB = vec3(0.07, 0.12, 0.055); b.cM = vec3(0.085, 0.15, 0.06); b.cT = vec3(0.11, 0.18, 0.06); b.trans = 0.8; b.gloss = 0.35;
  } else if (k == 4) {
    // 菜の花：主茎・脇枝・茎を抱く葉
    int nBr = nb >= 8 ? 2 : (nb >= 2 ? 1 : 0);
    vec3 gl = vec3(0.075, 0.13, 0.065);
    b.gloss = 0.4; b.trans = 0.7;
    if (e == 0) {
      b.shape = 1; b.L = c.H; b.W = 0.0032; b.th0 = 0.02 + 0.12 * rf; b.kap = 0.04 + 0.14 * rc; b.stiff = 2.4; b.tw = 0.0; b.off *= 0.2;
      b.cB = gl * 0.8; b.cM = gl; b.cT = gl * vec3(1.1, 1.2, 0.9);
    } else if (e <= nBr) {
      b.parent = 0; b.lift = 0.45 + 0.3 * rd;
      b.shape = 1; b.L = c.H * (0.3 + 0.2 * rc); b.W = 0.0022; b.th0 = 0.35 + 0.35 * rf; b.kap = -0.3; b.stiff = 2.0; b.tw = 0.0;
      b.cB = gl; b.cM = gl; b.cT = gl * vec3(1.1, 1.2, 0.9);
    } else {
      if (lv > 0.5 && e > nBr + 2) return false;   // 中の輪では茎を抱く葉を2枚に
      b.parent = 0; b.lift = 0.04 + 0.45 * rd;
      b.shape = 6; b.L = mix(0.2, 0.1, rd) * (0.8 + 0.4 * rc) * (c.H / 0.9); b.W = 0.017; b.th0 = 0.75 + 0.45 * rf; b.kap = 0.5 + 0.5 * rc; b.stiff = 1.6; b.tw = 0.7 * (rb - 0.5);
      b.cB = vec3(0.06, 0.11, 0.055); b.cM = vec3(0.065, 0.125, 0.06); b.cT = vec3(0.08, 0.15, 0.065); b.gloss = 0.35;
    }
  } else if (k == 6) {
    // 畑の葉：丸い葉のロゼット（小松菜など）
    b.shape = 7; b.off = dir2(b.az) * 0.006;
    b.L = c.H * (0.7 + 0.45 * rd); b.W = 0.024; b.th0 = 0.4 + 0.5 * rf; b.kap = 0.3 + 0.35 * rc; b.stiff = 2.0; b.tw = 0.4 * (rb - 0.5);
    b.cB = vec3(0.08, 0.14, 0.05); b.cM = vec3(0.06, 0.15, 0.04); b.cT = vec3(0.1, 0.22, 0.05); b.gloss = 0.6;
  } else if (k == 7) {
    // 葦：去年の枯れた茎（折れたものも）と、根元の若い芽
    int nOld = max(1, int(float(nb) * 0.3 + 0.5)), nLeaf = max(1, int(float(nb) * 0.35 + 0.5));
    if (e >= nOld && e < nOld + nLeaf) {
      // 去年の枯れ葉：根元から弓なりに垂れる細長い葉（遠くでも葦原が枯れ色の茂みに見える）
      b.L = c.H * mix(0.35, 0.6, rd); b.W = 0.006; b.th0 = 0.25 + 0.5 * rf; b.kap = 0.9 + 1.0 * rc; b.maxA = 2.2; b.stiff = 1.5; b.trans = 0.6; b.gloss = 0.4;
      vec3 s = STRAW * (0.8 + 0.45 * re);
      b.cB = s * 0.6; b.cM = s * 0.9; b.cT = s * 1.05;
    } else if (e < nOld) {
      bool broken = rb < 0.25 && e > 0;
      b.shape = 1; b.L = c.H * mix(0.75, 1.15, rd) * (broken ? 0.55 : 1.0); b.W = 0.0028; b.th0 = 0.03 + 0.18 * rf; b.kap = broken ? 2.6 : 0.1 + 0.3 * rc; b.maxA = broken ? 2.2 : 1.2;
      b.stiff = 3.2; b.tw = 0.0; b.trans = 0.45; b.gloss = 0.6; b.off *= 0.6;
      vec3 s = STRAW * (0.85 + 0.4 * re);
      b.cB = s * 0.6; b.cM = s * 0.9; b.cT = s * 1.1;
    } else {
      b.L = (c.H / 1.15) * mix(0.25, 0.6, rd); b.W = 0.0055; b.th0 = 0.08 + 0.3 * rf; b.kap = 0.5 + 0.8 * rc; b.stiff = 1.3;
      b.cB = vec3(0.1, 0.14, 0.05); b.cM = vec3(0.08, 0.18, 0.04); b.cT = vec3(0.14, 0.27, 0.05);
    }
  } else if (k == 8) {
    // 笹：細い稈に、横へ張る笹の葉
    b.gloss = 0.7;
    if (e == 0) {
      b.shape = 1; b.L = c.H; b.W = 0.0022; b.th0 = 0.05 + 0.25 * rf; b.kap = 0.25; b.stiff = 3.0; b.tw = 0.0; b.off *= 0.2;
      b.cB = vec3(0.1, 0.1, 0.05); b.cM = vec3(0.06, 0.1, 0.03); b.cT = vec3(0.05, 0.1, 0.03);
    } else {
      b.parent = 0; b.lift = 0.45 + 0.55 * rd;
      b.shape = 10; b.L = mix(0.12, 0.2, rc); b.W = 0.016; b.th0 = 1.0 + 0.4 * rf; b.kap = 0.3 + 0.35 * rb; b.maxA = 2.0; b.tw = 0.5 * (rb - 0.5); b.stiff = 1.8;
      b.cB = vec3(0.025, 0.06, 0.018); b.cM = vec3(0.03, 0.075, 0.02); b.cT = vec3(0.045, 0.095, 0.022);
      b.trans = 0.6;
    }
  } else if (k == 11) {
    // シダ：株の芯から弓なりに垂れる羽状の葉
    b.shape = 3; b.off = dir2(b.az) * 0.02;
    b.L = c.H * (0.7 + 0.55 * rd); b.W = 0.058; b.th0 = 0.25 + 0.4 * rf; b.kap = 0.8 + 0.8 * rc; b.maxA = 2.4; b.tw = 0.35 * (rb - 0.5); b.stiff = 1.2;
    b.cB = vec3(0.03, 0.065, 0.02); b.cM = vec3(0.05, 0.12, 0.025); b.cT = vec3(0.12, 0.24, 0.05) * (0.8 + 0.35 * re);
    b.trans = 1.15; b.gloss = 0.45;
  }
  // 遠い輪は株が疎らになる分だけ幅を広げて、同じくらい地面を覆う。切り抜きの形はやめる
  // 茎・穂・つくし・葦の枯れ茎は太らせない（画面で細すぎる分は頂点で網点の覆いに替える）
  float wm = lv < 0.5 ? 1.0 : (lv < 1.5 ? 2.3 : (lv < 2.5 ? 4.8 : 10.0));
  wm = mix(wm, sqrt(wm), c.steep);   // 急な斜面では板の縞・カーテンに見えないように
  bool thin = b.shape == 1 || b.shape == 2 || b.shape == 9;
  if (!thin) b.W *= b.W > 0.008 ? sqrt(wm) : wm;   // 幅の広い葉はもともと覆うので控えめに
  if (lv > 1.5 && b.shape >= 3 && b.shape != 9) b.shape = 0;
  return true;
}

// 葉の曲がり（根元からの角度が先へ向かって増える）。wv=風、fl=そよぎ
vec2 thetaAt(Bl b, vec2 dA, vec2 wv, float s) {
  return dA * (b.th0 + b.kap * pow(s, 1.4)) + wv * pow(s, 1.2);
}
// 根元からk節目までを積み上げる（節の長さは一定＝風で伸び縮みしない）
vec3 integ(Bl b, vec2 dA, vec2 wv, int k) {
  vec3 q = vec3(0.0);
  float st = b.L / uSeg;
  for (int i = 0; i < 8; i++) {
    if (i >= k) break;
    vec2 th = thetaAt(b, dA, wv, (float(i) + 0.5) / uSeg);
    float a = length(th);
    vec2 d = a > 1e-4 ? th / a : dA;
    a = min(a, b.maxA);
    q += vec3(d.x * sin(a), cos(a), d.y * sin(a)) * st;
  }
  return q;
}
vec2 windOf(In c, Bl b, vec2 p, uint bh) {
  // 風で倒れる量＋穂波（風の向きに進む波）＋葉ごとのそよぎ
  float ph = dot(p, uWind.xy) * 0.9 - uTime * (1.6 + 0.6 * c.gst) + h1(bh, 21u) * 1.2;
  float wave = 0.5 + 0.5 * sin(ph);
  float fl = sin(uTime * (2.4 + 1.8 * h1(bh, 22u)) + h1(bh, 23u) * 6.2831) * (0.06 + 0.08 * c.gst);
  vec2 perp = vec2(-uWind.y, uWind.x);
  return (c.w * (0.07 + 0.07 * c.gst) * (0.6 + 0.8 * wave) + uWind.xy * fl + perp * fl * 0.6) / b.stiff;
}

// 札（花・小葉）。type: 1たんぽぽ 2白詰草 3れんげ 4菜の花 5綿毛 6すみれ 7いぬふぐり 8ほとけのざ 9三つ葉 10ハート形の葉 11葦の穂
// orient: 0=視点を向く 1=上向きの皿（少し視点へ） 2=水平の葉 3=横向き
struct Cd { int type; int stalk; float size; vec3 col; int orient; vec2 off; float hgt; float asp; };
bool cardP(In c, int ci, out Cd d) {
  uint ch = c.hh + uint(ci) * 7331u + 99u;
  float ra = h1(ch, 31u), rb = h1(ch, 32u), rc = h1(ch, 33u);
  d.type = 0; d.stalk = -1; d.size = 0.02; d.col = vec3(1.0); d.orient = 0; d.off = vec2(0.0); d.hgt = 0.0; d.asp = 1.0;
  int k = c.kind, f = c.fl;
  if (f == 1 && ci == 0) { d.type = 1; d.stalk = 0; d.size = mix(0.017, 0.023, ra); d.col = vec3(1.0, 0.6, 0.02) * (0.9 + 0.15 * rb); d.orient = 1; }
  else if (f == 5 && ci == 0) { d.type = 5; d.stalk = 0; d.size = mix(0.022, 0.028, ra); d.col = vec3(0.86, 0.86, 0.83); d.orient = 0; }
  else if (f == 2 && ci == 0) { d.type = 2; d.stalk = 0; d.size = mix(0.011, 0.015, ra); d.col = vec3(0.86, 0.87, 0.8); d.orient = 0; }
  else if (f == 2 && ci <= 2) { d.type = 9; d.stalk = ci; d.size = mix(0.014, 0.02, ra); d.col = vec3(0.05, 0.13, 0.03); d.orient = 2; }
  else if (f == 3 && ci == 0) { d.type = 3; d.stalk = 0; d.size = mix(0.013, 0.017, ra); d.col = vec3(0.62, 0.2, 0.44); d.orient = 1; }
  else if (f == 4 && c.lv > 1.5) {
    // 遠い菜の花：茎のない房を数枚、高さと位置をずらして少し縦長に（帯が黄色の連なりに見える）
    d.type = 4; d.stalk = -1; d.orient = 0; d.asp = 1.35;
    d.size = mix(0.05, 0.066, ra) * (c.lv < 2.5 ? 1.4 : 1.9);
    d.off = (vec2(rb, rc) - 0.5) * uSpacing * 0.75; d.hgt = c.H * (0.7 + 0.3 * h1(ch, 34u));
    d.col = vec3(1.0, 0.7, 0.02) * (0.85 + 0.2 * h1(ch, 35u));
    return true;
  }
  else if (f == 4 && ci <= 2) {
    int nb = int(uNB);
    int nBr = nb >= 8 ? 2 : (nb >= 2 ? 1 : 0);
    if (ci > nBr) return false;
    d.type = 4; d.stalk = ci; d.size = (ci == 0 ? mix(0.042, 0.056, ra) : mix(0.032, 0.044, ra)); d.col = vec3(1.0, 0.7, 0.02) * (0.88 + 0.2 * rb); d.orient = 0;
    d.asp = 1.0 + 0.3 * c.lv;
    d.size *= 1.0 + c.lv * 0.3;
    return true;
  }
  else if (f == 6 && ci == 0) { d.type = 6; d.stalk = 0; d.size = mix(0.009, 0.012, ra); d.col = vec3(0.2, 0.06, 0.46); d.orient = 3; }
  else if (f == 6 && ci == 1) { d.type = 10; d.stalk = 1; d.size = mix(0.014, 0.019, ra); d.col = vec3(0.04, 0.1, 0.025); d.orient = 2; }
  else if (f == 7 && c.lv < 1.5) {
    // いぬふぐり：地面すれすれの小さな青い花が数輪
    d.type = 7; d.size = mix(0.0045, 0.006, ra); d.col = vec3(0.22, 0.38, 0.95); d.orient = 1;
    d.off = (vec2(rb, rc) - 0.5) * uSpacing * 0.8; d.hgt = 0.02 + 0.05 * h1(ch, 34u);
  }
  else if (f == 8 && ci == 0) { d.type = 8; d.stalk = 0; d.size = mix(0.016, 0.022, ra); d.col = vec3(0.55, 0.12, 0.4); d.orient = 0; }
  else if (f == 10 && ci == 0) {
    // 葦の穂：冬を越した淡い藁色。遠くでも大きくしすぎない
    d.type = 11; d.stalk = 0; d.size = mix(0.1, 0.15, ra) * min(1.0 + c.lv * 0.3, 1.3); d.col = vec3(0.58, 0.47, 0.3) * (0.9 + 0.2 * rb); d.orient = 0;
    return true;
  }
  if (d.type == 0) return false;
  d.size *= 1.0 + c.lv * 0.8;
  return true;
}

void main() {
  int id = gl_InstanceID;
  int n = int(uN);
  int sw = int(uSub.z + 0.5);
  ivec2 gi = ivec2(uSub.xy + 0.5) + ivec2(id % sw, id / sw);
  vec4 d0 = texelFetch(tI0, gi, 0);
  if (d0.w < 0.5) { collapse(); return; }
  vec4 d1 = texelFetch(tI1, gi, 0), d2 = texelFetch(tI2, gi, 0), d3 = texelFetch(tI3, gi, 0);
  ivec2 cellI = ivec2(floor(uCenter / uSpacing)) + gi - ivec2(n / 2);
  In c;
  c.kind = int(d0.w); c.steep = fract(d0.w); c.fl = int(d2.w + 0.5);
  c.H = d3.x; c.dens = d3.y; c.dry = d2.y; c.mott = d2.z; c.lv = uLevel;
  c.w = d1.xy; c.gst = d1.z;
  c.hh = hashU2(cellI + ivec2(int(uLevel) * 7919, 0));
  c.r1 = h1(c.hh, 4u); c.r2 = h1(c.hh, 5u); c.r3 = h1(c.hh, 6u);
  float fade = d2.x;
  vec2 p = d0.xz;
  float gy = d0.y;
  vec3 root0 = vec3(p.x, gy - 0.015, p.y);
  float vary = 0.82 + 0.36 * h1(c.hh, 7u);
  float lv = uLevel;
  int e = int(aB.x + 0.5);
  float t = aB.y;
  vec3 pos, nrm, col;
  float shape, trans = 1.0, gloss = 0.5, hf;

  vec3 col2 = vec3(0.0);
#if defined(GROUND)
  {
    // ---- 株元の地面：地面の色に掛ける暗がり（密な根元の陰・枯れ草の茶）。地面の日なた・日陰はそのまま残る ----
    int k = c.kind;
    // 種類の境目で明るさが段にならないよう、茂る草（野・畦・葦・菜の花）は同じ暗がりにそろえる
    float op = 0.0;
    vec3 cA = vec3(0.22, 0.28, 0.16), cT2 = vec3(0.46, 0.4, 0.27);
    if (k == 1 || k == 9 || k == 4) op = 1.0;
    else if (k == 7) { op = 1.0; cA = vec3(0.26, 0.28, 0.18); cT2 = vec3(0.5, 0.43, 0.3); }
    else if (k == 3) { op = 0.85; cA = vec3(0.3, 0.42, 0.24); cT2 = vec3(0.4, 0.5, 0.3); }
    else if (k == 5) { op = 0.8; cA = vec3(0.42, 0.4, 0.28); cT2 = vec3(0.6, 0.52, 0.36); }
    else if (k == 10) op = 0.45;
    else if (k == 8 || k == 11) { op = 0.6; cA = vec3(0.26, 0.28, 0.18); }
    if (op <= 0.0) { collapse(); return; }
    cT2 = mix(cT2, vec3(0.7, 0.58, 0.38), c.dry * 0.7);
    float dcam = distance(p, cameraPosition.xz);
    // 距離では切らない（遠い輪まで続け、遠くは葉の覆いが増える分だけ控えめに）。隣の輪と重なるところは足して1枚分
    op *= fade * mix(1.0, 0.6, smoothstep(10.0, 60.0, dcam)) * (1.0 - smoothstep(60.0, 108.0, dcam));
    // 茂りの濃いところほど根元は暗く、薄いところは明るい（葉の多さのむらが迷彩柄にならないように）
    if (k == 1 || k == 9 || k == 5) op *= mix(0.55, 1.0, sat((c.dens - 0.45) / 0.7));
    if (op < 0.02) { collapse(); return; }
    // 板は区画の中心に置き、隣の区画の中心まで広げる（重みは山形＝隣り合う板の重みの和がどこでも1）。
    // 掛け合わせは「暗がり^重み」なので、重なっても濃さがむらにならない（株の散らばりで斑にしない）
    vec2 q = vec2(aB.z, aB.y * 2.0 - 1.0);
    vec2 xz = (vec2(cellI) + 0.5 + q) * uSpacing;
    vec2 tg;
    pos = vec3(xz.x, terrainYG(xz, tg), xz.y);   // 持ち上げない（稜線で地形の縁より上にはみ出して、奥の景色に暗い線を掛ける）
    // 板の平らな面が地形の凸の折れ目の下にもぐらないよう、視線に沿って視点の方へ寄せる（画面上の位置は変わらない。
    // 葉は板の後に描くので根元は暗くならない）
    vec3 tc = cameraPosition - pos;
    float tl = length(tc);
    pos += tc / max(tl, 1e-3) * min(0.1 + uSpacing * 0.15 + 0.006 * tl, tl * 0.5);
    // 地形の傾き（斑を三方向から投影して、急な斜面で筋に引き伸ばさない）
    // 頂点ごとに引く（稜線の向こうへ垂れた部分は視点に背を向けるので、画面で消せる）
    nrm = normalize(vec3(-tg.x, 1.0, -tg.y));
    col = cA; col2 = cT2;
    shape = 200.0; trans = op; gloss = 0.2;
    hf = k == 4 ? smoothstep(10.0, 35.0, dcam) : 0.0;   // 遠い菜の花の下は、隙間から見える花で黄緑に
    vFUv = vec3(q, h1(c.hh, 42u));
    t = 0.0;
  }
#elif !defined(CARDS)
  {
    // ---- 葉・茎 ----
    Bl b;
    if (!bladeP(c, e, b)) { collapse(); return; }
    uint bh = c.hh + uint(e) * 1013u;
    vec2 dA = dir2(b.az);
    vec3 root = root0 + vec3(b.off.x, 0.0, b.off.y);
    if (b.off.x > 8e3) root = root0 + vec3(d3.z, 0.0, d3.w) + vec3((h1(bh, 24u) - 0.5) * 0.03, 0.0, (h1(bh, 25u) - 0.5) * 0.03);
    if (b.off.x > 8e3 && d3.z > 90.0) { collapse(); return; }
    if (b.parent >= 0) {
      // 親の茎の節に付ける
      Bl pb;
      bladeP(c, b.parent, pb);
      uint pbh = c.hh + uint(b.parent) * 1013u;
      int kl = int(b.lift * uSeg + 0.5);
      root = root0 + vec3(pb.off.x, 0.0, pb.off.y) + integ(pb, dir2(pb.az), windOf(c, pb, p, pbh), kl);
    }
    vec2 wv = windOf(c, b, p, bh);
    int kk = int(t * uSeg + 0.5);
    vec3 cpos = root + integ(b, dA, wv, kk);
    vec2 th = thetaAt(b, dA, wv, t);
    float a = length(th);
    vec2 d = a > 1e-4 ? th / a : dA;
    a = min(a, b.maxA);
    vec3 tang = vec3(d.x * sin(a), cos(a), d.y * sin(a));
    // 葉の面は曲がる向きを向き、先へ向かってねじれる
    vec3 side0 = vec3(-dA.y, 0.0, dA.x);
    vec3 bin = normalize(cross(tang, side0) + vec3(0.0, 1e-5, 0.0));
    float twa = b.tw * t;
    vec3 side = normalize(side0 * cos(twa) + bin * sin(twa));
    // 幅の形
    float wdt = b.W;
    if (b.shape == 0) wdt *= (0.55 + 0.45 * smoothstep(0.0, 0.2, t)) * (1.0 - pow(t, 2.4));
    else if (b.shape == 1) wdt *= 1.0 - 0.35 * t;
    else if (b.shape == 2) wdt *= t > 0.68 ? 3.2 * (1.0 - smoothstep(0.93, 1.0, t)) + 0.4 : 1.0;
    else if (b.shape == 3) wdt *= pow(sin(3.1416 * clamp(t * 0.92 + 0.08, 0.0, 1.0)), 0.6) * (1.0 - 0.3 * t);
    else if (b.shape == 4) wdt *= 0.75 + 0.25 * smoothstep(0.0, 0.4, t);
    else if (b.shape == 5) wdt *= smoothstep(0.0, 0.35, t) * 0.7 + 0.3 - 0.25 * t;
    else if (b.shape == 6 || b.shape == 10) wdt *= sin(3.1416 * clamp(t * 0.9 + 0.1, 0.0, 1.0)) * 0.95 + 0.05;
    else if (b.shape == 7) wdt *= 0.3 + 0.7 * smoothstep(0.1, 0.65, t);
    else if (b.shape == 8) wdt *= smoothstep(0.0, 0.2, t) * (1.0 - 0.75 * t);
    else if (b.shape == 9) wdt *= t > 0.66 ? 1.45 : 1.0;
    // 画面で約0.8画素より細い所は太らせずに、覆い（本当の幅÷描いた幅）を下げて薄める
    float pxm = 2.0 * max(-(viewMatrix * vec4(cpos, 1.0)).z, 0.05) / (projectionMatrix[1][1] * uPxH);
    float wmin = pxm * 0.4, cov = 1.0;
    if (wdt < wmin) { cov = wdt / wmin; wdt = wmin; }
    pos = cpos + side * wdt * aB.z;
    pos.y = max(pos.y, gy - 0.02);
    vec3 fn = normalize(cross(side, tang) + vec3(0.0, 1e-5, 0.0));
    // 断面の折れ（中肋）で左右の面をすこし傾ける
    float fold = b.shape == 1 || b.shape == 2 || b.shape == 9 ? 0.9 : 0.35;
    nrm = normalize(fn + side * aB.z * fold + vec3(0.0, lv * 0.25, 0.0));
    col = t < 0.5 ? mix(b.cB, b.cM, t * 2.0) : mix(b.cM, b.cT, t * 2.0 - 1.0);
    // 遠い輪は根元を明るく（上から見たときの黒い点々を防ぐ）
    col = mix(col, b.cM, min(1.0, lv * 0.35) * (1.0 - t));
    col *= vary;
    shape = float(b.shape);
    trans = b.trans; gloss = b.gloss;
    hf = clamp((pos.y - gy) / max(c.H, 0.04), 0.0, 1.0);
    vFUv = vec3(cov, 0.0, h1(bh, 26u));
  }
#else
  {
    // ---- 札：花・小葉 ----
    Cd cd;
    if (!cardP(c, e, cd) || fade < 0.3) { collapse(); return; }
    uint chh = c.hh + uint(e) * 7331u + 99u;
    vec3 tip;
    if (cd.stalk >= 0) {
      Bl sb;
      if (!bladeP(c, cd.stalk, sb)) { collapse(); return; }
      uint sbh = c.hh + uint(cd.stalk) * 1013u;
      vec3 sroot = root0 + vec3(sb.off.x, 0.0, sb.off.y);
      if (sb.parent >= 0) {
        Bl pb;
        bladeP(c, sb.parent, pb);
        uint pbh = c.hh + uint(sb.parent) * 1013u;
        sroot = root0 + vec3(pb.off.x, 0.0, pb.off.y) + integ(pb, dir2(pb.az), windOf(c, pb, p, pbh), int(sb.lift * uSeg + 0.5));
      }
      tip = sroot + integ(sb, dir2(sb.az), windOf(c, sb, p, sbh), int(uSeg + 0.5));
    } else {
      tip = root0 + vec3(cd.off.x, cd.hgt, cd.off.y);
      tip.xz += c.w * (0.07 + 0.07 * c.gst) * cd.hgt * 0.7;   // 茎のない房も風に傾く
    }
    vec3 camR = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
    vec3 camU = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
    vec3 toC = cameraPosition - tip;
    toC /= max(length(toC), 1e-4);
    vec3 U, W, nn;
    vec2 tl = (vec2(h1(chh, 35u), h1(chh, 36u)) - 0.5);
    if (cd.orient == 0) {
      U = camR; W = camU; nn = toC;
      if (cd.type == 4) tip += camU * cd.size * 0.35;
      if (cd.type == 11) tip += camU * cd.size * -0.7;
    } else {
      if (cd.orient == 1) nn = normalize(normalize(vec3(tl.x * 0.9 + uSunDir.x * 0.35, 1.0, tl.y * 0.9 + uSunDir.z * 0.35)) + toC * 0.55);
      else if (cd.orient == 2) nn = normalize(vec3(tl.x * 0.6, 1.0, tl.y * 0.6));
      else { vec2 od = dir2(h1(chh, 37u) * 6.2831); nn = normalize(normalize(vec3(od.x, -0.15, od.y)) + toC * 0.6); }
      vec3 ax = abs(nn.y) < 0.95 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
      U = normalize(cross(ax, nn)); W = cross(nn, U);
      if (cd.orient == 3) { U = -U; }
    }
    vec2 q = vec2(aB.z, aB.y * 2.0 - 1.0);
    pos = tip + (U * q.x + W * q.y * cd.asp) * cd.size;
    nrm = nn;
    col = cd.col;
    shape = 100.0 + float(cd.type);
    trans = 1.0; gloss = 0.4;
    hf = 1.0;
    vFUv = vec3(q, h1(chh, 38u));
    t = 1.0;
    col2 = col;
  }
#endif
  vCol = col;
  vFCol = col2;
  vN = nrm;
  vWorld = pos;
  vA = vec4(t, aB.z, hf, shape);
  // 茂りが濃いほど根元は暗い
  // 根元の暗さは株元の地面の暗がり（GROUND）と同じくらいに。葉が隙間の地面より暗くならないように
  float aoB = c.kind == 1 || c.kind == 9 || c.kind == 5 ? mix(0.78, 0.55, sat(c.dens - 0.3)) : (c.kind == 4 || c.kind == 7 ? 0.62 : 0.7);
  vB = vec4(d1.w, trans, mix(aoB, 1.0, min(1.0, lv * 0.3)), gloss);
  gl_Position = projectionMatrix * viewMatrix * vec4(pos, 1.0);
}
`;

const GRASS_FS = /* glsl */ `
${ALL}
uniform float uLevel;
varying vec3 vCol;
varying vec3 vN;
varying vec3 vWorld;
varying vec4 vA;
varying vec4 vB;
varying vec3 vFCol;
#ifdef GROUND
centroid varying vec3 vFUv;
#else
varying vec3 vFUv;
#endif

// 三方向からの投影（斜面では横からの投影を混ぜる。平らなら1回だけ引く）
vec4 triTex(vec3 w, vec3 tw, float f, float o) {
  vec4 r = texture(tNoise, w.xz * f + o) * tw.y;
  if (tw.x > 0.02) r += texture(tNoise, w.zy * f + o) * tw.x;
  if (tw.z > 0.02) r += texture(tNoise, w.xy * f + o) * tw.z;
  return r;
}
float aaStep(float edge, float x) { float w = max(fwidth(x), 1e-4) * 0.75; return smoothstep(edge - w, edge + w, x); }
float hsh(float x) { return fract(sin(x * 127.1 + 11.7) * 43758.5453); }
vec2 rot2(vec2 q, float a) { float c = cos(a), s = sin(a); return vec2(c * q.x - s * q.y, s * q.x + c * q.y); }

void main() {
#ifdef GROUND
  {
    // 株元の地面：斑の暗い緑と枯れ草の茶を地面の色に掛ける
    vec2 wq = vWorld.xz;
    float dc = distance(vWorld, cameraPosition);
    vec3 tw = pow(abs(vN), vec3(4.0));
    tw /= tw.x + tw.y + tw.z;
    float n1 = triTex(vWorld, tw, 0.37, 0.0).r, n2 = triTex(vWorld, tw, 2.3, 0.3).r;
    // 重み（山形）は0〜1に収める。板の縁にかかる画素は、網点なし（MSAA）だと画素の中心で色を決めるので、
    // 中心が三角形の外にあると座標が±1の外へ外挿されて重みが負になり、「暗がり^負」で数十〜数百倍に明るくなる。
    // 板が真横を向く所（土手や丘の盛り上がって折れる稜線）ほど外挿が大きく、白く光る線とちらつく点になっていた
    float a = sat(1.0 - abs(vFUv.x)) * sat(1.0 - abs(vFUv.y)) * vB.y;
    // 真上から見ると葉が地面をよく覆うので、地面の暗がりは控えめに
    float vn = dot(normalize(cameraPosition - vWorld), vN);
    a *= mix(1.0, 0.6, smoothstep(0.35, 0.95, vn));
    // 稜線の向こうへ垂れた部分は、板の三角形そのものが裏を向くので表だけの描画で消える。
    // 頂点の法線の補間で切ると、稜線の手前まで暗がりが薄れて明るい縁が一本通るので、ここでは切らない
    // 斑は遠くで振れ幅を下げ、20〜40mの大きなむらを足す（上から見て迷彩柄にならないように）
    float amp = mix(1.0, 0.35, smoothstep(8.0, 45.0, dc));
    float big = texture(tNoise, wq * 0.031 + 0.7).g - 0.5;
    vec3 tint = mix(vCol, vFCol, smoothstep(0.45, 0.95, n1 + (n2 - 0.5) * 0.3) * 0.45 * amp) * (1.0 + (n2 - 0.5) * 0.16 * amp + big * 0.18);
    float nf = 1.0 - smoothstep(4.0, 14.0, dc);
    // 近くは根元の隙間（落ち葉・枯れ草の暗がり）と日に焼けた枯れ草のかけらの細かな斑
    float n3 = nf > 0.0 ? triTex(vWorld, tw, 9.0, 0.5).r : 0.5;
    tint *= mix(1.0, 0.72 + 0.5 * smoothstep(0.35, 0.75, n3), nf);
    // 日なたでは草むらの中の影（直射が葉にさえぎられる）でさらに暗く、日陰では控えめに
    tint = pow(clamp(tint, 0.03, 1.0), vec3(0.8 * mix(0.7, 1.15, vB.x)));
    tint *= mix(vec3(1.0), vec3(1.45, 1.2, 0.5), vA.z);
    gl_FragColor = vec4(pow(tint, vec3(a)), 1.0);
    return;
  }
#else
  vec3 alb = vCol;
  float alpha = 1.0;
  vec3 N = normalize(vN);
  vec3 V = normalize(cameraPosition - vWorld);
  vec3 L = uSunDir;
  float t = vA.x, u = vA.y, hf = vA.z;
  int shp = int(vA.w + 0.5);
  float trans = vB.y, gloss = vB.w;
  float sh = vB.x;
  float aoB = vB.z;
  // 株の中の高さで、根元へ向かって暗く（周りの葉にさえぎられる）
  float ao = mix(aoB, 1.0, smoothstep(0.0, 0.85, hf));
  float self = mix(0.8, 1.0, smoothstep(0.05, 0.7, hf));
  float au = abs(u);
#ifndef CARDS
  bool card = false;
  {
    if (shp == 2) {
      // 穂：小穂が互い違いに付く
      if (t > 0.66) {
        float k = (t - 0.66) * 26.0;
        float sp = abs(fract(k + (u > 0.0 ? 0.5 : 0.0)) - 0.5) * 2.0;
        float r = 0.32 + 0.68 * (1.0 - sp);
        alpha = 1.0 - aaStep(r * (1.0 - smoothstep(0.9, 1.0, t)), au);
        alpha = max(alpha, 1.0 - aaStep(0.18, au));
      }
    } else if (shp == 3) {
      // シダ：互い違いの羽片、羽片の縁に小さな切れ込み
      float np = 13.0;
      float k = t * np - au * 1.3;
      float fk = fract(k + (u > 0.0 ? 0.5 : 0.0));
      float pw = 0.34 * (1.0 - pow(au, 1.6)) * (1.0 + 0.25 * sin(au * 38.0));
      float pin = 1.0 - aaStep(pw, abs(fk - 0.5));
      alpha = max(pin * (1.0 - aaStep(0.97, au)), 1.0 - aaStep(0.07, au));
      alb *= 0.85 + 0.25 * au;
      if (au < 0.07) alb *= vec3(1.1, 1.05, 0.8);
    } else if (shp == 4) {
      // れんげの葉：対になった丸い小葉と先端の1枚
      float np = 5.0;
      float k = t * np;
      float fk = fract(k) - 0.5;
      float d = length(vec2(fk * 1.35, (au - 0.52) * 1.25));
      float lf = 1.0 - aaStep(0.44, d);
      float term = 1.0 - aaStep(0.36, length(vec2((t - 0.9) * 5.0, u * 0.9)));
      alpha = max(max(lf * step(t, 0.8), term), 1.0 - aaStep(0.07, au));
      alb *= 0.9 + 0.15 * (1.0 - d);
    } else if (shp == 5) {
      // たんぽぽの葉：付け根へ向く鋸の歯
      float k = fract(t * 5.0 + 0.2);
      float edge = 0.55 + 0.45 * k;
      alpha = 1.0 - aaStep(edge * (1.0 - smoothstep(0.8, 1.0, t) * 0.6), au);
      if (au < 0.1) alb *= vec3(1.4, 1.2, 1.1);
    } else if (shp == 6 || shp == 10) {
      // 菜の花・笹の葉：なめらかな縁と中肋
      float edge = 1.0 - 0.04 * sin(t * 40.0);
      alpha = 1.0 - aaStep(edge, au);
      if (au < 0.08) alb *= shp == 10 ? vec3(1.25, 1.2, 1.0) : vec3(1.3, 1.3, 1.1);
      alb *= 0.92 + 0.08 * cos(au * 9.0);
      if (shp == 10 && au > 0.82) alb = mix(alb, vec3(0.42, 0.38, 0.26), smoothstep(0.82, 0.95, au) * 0.8);   // 冬を越した笹の白い縁
    } else if (shp == 7) {
      // 丸い葉：葉脈と波打つ縁
      float edge = 1.0 - 0.06 * sin(t * 30.0) - 0.4 * smoothstep(0.85, 1.0, t) * au;
      alpha = 1.0 - aaStep(edge, au);
      float vein = 1.0 - smoothstep(0.0, 0.05, abs(fract(t * 6.0 - au * 0.7) - 0.5) * au);
      alb *= 0.92 + 0.1 * vein;
      if (au < 0.07) alb *= vec3(1.35, 1.3, 1.15);
    } else if (shp == 8) {
      // すぎな：節ごとに輪生する細い枝（上向き）
      float k = t * 9.0 - au * 0.9;
      float br = 1.0 - aaStep(0.09, abs(fract(k) - 0.5) - 0.38);
      float needle = 1.0 - aaStep(0.07 * (1.0 - au), abs(fract(k) - 0.88));
      alpha = max(max(needle * step(0.08, t), 0.0) * (1.0 - aaStep(0.95, au)), 1.0 - aaStep(0.09, au));
      alb *= 0.9 + 0.2 * au;
    } else if (shp == 9) {
      // つくし：はかまの節と、六角の網目の穂
      if (t > 0.66) {
        float cell = abs(fract(t * 38.0 + (u > 0.0 ? 0.5 : 0.0)) - 0.5);
        alb = mix(vec3(0.2, 0.13, 0.07), vec3(0.3, 0.2, 0.1), cell * 2.0);
        alpha = 1.0 - aaStep(1.0 - 0.3 * smoothstep(0.93, 1.0, t), au);
      } else {
        float node = 1.0 - smoothstep(0.0, 0.035, abs(fract(t * 5.2) - 0.08));
        alb = mix(alb, vec3(0.16, 0.1, 0.06), node);
      }
    } else if (shp == 0) {
      // 草の葉：縦の筋
      alb *= 0.93 + 0.07 * cos(au * 9.4);
    }
    alpha *= vFUv.x;
    if (alpha < 0.02) discard;
  }
#else
  bool card = true;
  {
    // ---- 花・小葉の札 ----
    int ty = shp - 100;
    vec2 q = vFUv.xy;
    float seed = vFUv.z;
    q = rot2(q, seed * 6.2831);
    float r = length(q);
    float an = atan(q.y, q.x + 1e-5);
    vec3 fc = vFCol;
    trans = 0.9;
    ao = mix(1.0, ao, 0.4);
    self = 1.0;
    vec3 camR = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
    vec3 camU = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
    vec2 qs = vFUv.xy;   // 回さない座標（球の陰影用）
    if (ty == 1) {
      // たんぽぽ：3重の舌状花。外ほど長く、中心ほど橙
      float a = 0.0, idv = 0.0;
      for (int l = 0; l < 3; l++) {
        float fl = float(l);
        float nf = 30.0 - fl * 8.0;
        float fi = an / 6.2831 * nf + fl * 0.37;
        float ix = floor(fi);
        float len = (1.0 - fl * 0.24) * (0.86 + 0.14 * hsh(ix + fl * 17.0 + seed * 9.0));
        float wa = (0.05 + 0.012 * fl) / max(r, 0.05) * nf / 6.2831;
        wa *= sqrt(sat((len - r) / 0.12));
        float d = abs(fract(fi) - 0.5);
        float on = (1.0 - aaStep(wa, d)) * (1.0 - aaStep(len, r)) * step(0.06, r);
        if (on > a) idv = hsh(ix * 3.1 + fl);
        a = max(a, on);
      }
      a = max(a, 1.0 - aaStep(0.3, r));
      alpha = a;
      alb = mix(fc * vec3(1.0, 0.72, 0.4), fc, smoothstep(0.1, 0.65, r)) * (0.85 + 0.25 * idv);
    } else if (ty == 5) {
      // 綿毛：放射状の細い柄と、先に開く冠毛。手前を向く冠毛は細かな粒に見える
      float nf = 64.0;
      float fi = an / 6.2831 * nf;
      float d = abs(fract(fi) - 0.5) * r * 6.2831 / nf;
      float ray = (1.0 - aaStep(0.008, d)) * smoothstep(0.12, 0.25, r) * (1.0 - aaStep(0.84, r));
      float tr = 0.86 + 0.07 * hsh(floor(fi) + seed * 17.0);
      float tips = (1.0 - aaStep(0.07, abs(r - tr))) * (0.6 + 0.4 * hsh(floor(fi) * 1.7));
      vec2 gq = rot2(q, 0.7) * 16.0;
      vec2 gi2 = floor(gq);
      vec2 go = vec2(hsh(dot(gi2, vec2(1.0, 57.0)) + seed), hsh(dot(gi2, vec2(13.0, 7.0)) + seed)) - 0.5;
      float dots = (1.0 - aaStep(0.22, length(fract(gq) - 0.5 + go * 0.6))) * (1.0 - aaStep(0.8, r)) * (0.35 + 0.3 * go.x);
      alpha = max(max(ray * 0.5, tips), dots);
      alpha = max(alpha, (1.0 - aaStep(0.1, r)) * 0.9);
      alb = r < 0.1 ? vec3(0.22, 0.15, 0.09) : fc;
      trans = 1.6;
    } else if (ty == 2) {
      // 白詰草：細い筒の小花が外へ向く玉。輪郭はぎざぎざ、下の古い花は褐色に垂れる
      float r2q = dot(qs, qs);
      vec3 ns = vec3(qs, sqrt(max(0.0, 1.0 - r2q)));
      float spk = hsh(floor(an / 6.2831 * 22.0 + seed * 7.0));
      alpha = 1.0 - aaStep(0.72 + 0.24 * spk * smoothstep(0.4, 0.9, sqrt(r2q)), sqrt(r2q));
      vec3 np = ns * 5.5 + seed * 7.0;
      float fl = sin(np.x * 3.1 + np.y * 1.3) * sin(np.y * 2.7 - np.z * 1.9) * sin(np.z * 2.3 + np.x * 1.7);
      alb = fc * (0.68 + 0.42 * smoothstep(-0.3, 0.6, fl));
      alb = mix(alb, vec3(0.45, 0.34, 0.26), (1.0 - smoothstep(-0.8, -0.25, qs.y)) * 0.75);
      alb = mix(alb, vec3(0.62, 0.66, 0.5), (1.0 - ns.z) * 0.3);
      N = normalize(camR * ns.x + camU * ns.y + V * ns.z);
      trans = 0.6;
    } else if (ty == 3) {
      // れんげ：7〜9の蝶形花が輪になる（外は紅紫、内は白）
      float nf = 8.0;
      float fi = an / 6.2831 * nf;
      float da = (fract(fi) - 0.5) * 6.2831 / nf;
      float perp = abs(sin(da)) * r;
      float along = r;
      float w = 0.24 * pow(max(sin(3.1416 * sat((along - 0.12) / 0.88)), 0.0), 0.6);
      alpha = (1.0 - aaStep(w, perp)) * step(0.12, along);
      alpha = max(alpha, 1.0 - aaStep(0.2, r));
      alb = mix(vec3(0.82, 0.74, 0.8), fc, smoothstep(0.3, 0.75, along));
      alb *= 0.85 + 0.2 * smoothstep(0.0, w + 1e-3, w - perp);
    } else if (ty == 4) {
      // 菜の花の房：上に黄緑のつぼみの丸い塊、そのまわりに十字の4弁の花が段になって開き、下に若い莢
      vec2 qq = vFUv.xy;
      float a = 0.0, cen = 0.0, pet = 0.0, sh2 = 1.0, fv = 1.0, gap = 0.0, pods = 0.0;
      // 遠くて房が数画素になったら、花の粒を塗りつぶした房の形に替える（細かな弁が網点で消えないように。粒の計算も省く）
      float lodk = smoothstep(0.05, 0.16, length(fwidth(qq)));
      vec2 bc = vec2(0.0, 0.3);
      float bd = length((qq - bc) * vec2(1.0, 1.2));
      float bud = 1.0 - aaStep(0.3 + 0.03 * sin(atan(qq.y - bc.y, qq.x + 1e-5) * 7.0), bd);
      vec2 bq = (qq - bc) * 11.0;
      float bb = length(fract(bq) - 0.5);
      vec3 budC = mix(vec3(0.22, 0.32, 0.05), vec3(0.62, 0.52, 0.04), smoothstep(0.08, 0.3, bd));
      budC *= 0.7 + 0.4 * (1.0 - smoothstep(0.15, 0.55, bb));
      if (lodk < 0.98) {
      for (int i = 0; i < 14; i++) {
        float fi = float(i);
        // 段（上ほど小さな輪）ごとに花を回して並べる
        float ring = floor(fi / 5.0);
        float k = fi - ring * 5.0;
        float aa = (k + 0.5 * ring + seed * 3.0) * 1.2566 + hsh(fi + seed * 11.0) * 0.5;
        float rr = 0.72 - ring * 0.2;
        vec2 c = vec2(cos(aa) * rr, sin(aa) * rr * 0.45 + 0.1 - ring * -0.12);
        float front = sin(aa);   // 奥（上側）の花は他の花に隠れる
        vec2 dq = qq - c;
        // 横を向く花は細く縮んで見える
        float sq = mix(1.0, 0.45, abs(cos(aa)) * rr);
        dq.x /= sq;
        dq = rot2(dq, fi * 1.7 + seed);
        float d2 = dot(dq, dq);
        float R = 0.17 + 0.035 * hsh(fi + seed * 7.0);
        float c2 = abs(dq.x * dq.x - dq.y * dq.y) / max(d2, 1e-5);
        float env = R * (0.18 + 0.82 * pow(c2, 0.6));
        float d = sqrt(d2);
        float on = 1.0 - aaStep(env, d);
        if (on > 0.5 && (a < 0.5 || front < 0.2)) { pet = d / R; sh2 = 0.62 + 0.38 * (1.0 - max(front, 0.0)); fv = 0.78 + 0.4 * hsh(fi * 5.3 + seed * 3.0); gap = (1.0 - smoothstep(0.2, 0.55, c2)) * smoothstep(0.25, 0.6, d / R); }
        a = max(a, on);
        cen = max(cen, (1.0 - aaStep(0.045, d)) * on);
      }
      // 若い莢（花の下から斜め下へ）
      for (int j = 0; j < 5; j++) {
        float fj = float(j);
        float ang = -1.5708 + (fj - 2.0) * 0.36 + (hsh(fj + seed * 3.0) - 0.5) * 0.25;
        vec2 dd = vec2(cos(ang), sin(ang));
        vec2 o = qq - vec2(0.0, -0.15);
        float al = dot(o, dd);
        float pp = abs(dot(o, vec2(-dd.y, dd.x)));
        pods = max(pods, (1.0 - aaStep(0.022, pp)) * step(0.0, al) * (1.0 - aaStep(0.62 + 0.2 * hsh(fj + seed), al)));
      }
      }
      alpha = max(max(a, bud), pods);
      // 花弁：付け根が濃く先が淡い、細かな脈
      // 花ごとの明るさの違い・弁の付け根の濃さと弁の間の影・中心の緑の雌しべと橙の葯
      alb = fc * (0.6 + 0.5 * smoothstep(0.1, 0.8, pet)) * sh2 * fv * (1.0 - 0.35 * gap);
      alb = mix(alb, vec3(0.3, 0.36, 0.04), cen * 0.8);
      if (a < 0.5) alb = bud > 0.5 ? budC : vec3(0.09, 0.16, 0.05);
      // 遠くの房：花の塊をいくつか寄せたでこぼこの形（丸い円盤に見せない）。上の塊ほど明るい
      float blob = 0.0, bsh = 0.0;
      if (lodk > 0.02) {
        for (int i = 0; i < 5; i++) {
          float fi = float(i);
          vec2 bo = vec2(hsh(fi * 3.1 + seed * 13.0) - 0.5, hsh(fi * 7.7 + seed * 5.0) - 0.5) * vec2(0.9, 1.1) + vec2(0.0, 0.1);
          float br = 0.24 + 0.14 * hsh(fi * 1.9 + seed * 3.0);
          float on = 1.0 - aaStep(br, length(qq - bo));
          if (on > blob) bsh = 0.8 + 0.3 * sat(bo.y + 0.5) + 0.12 * hsh(fi + seed);
          blob = max(blob, on);
        }
      }
      alpha = mix(alpha, blob, lodk);
      alb = mix(alb, fc * bsh, lodk);
      vec3 ns = vec3(qq * 0.75, sqrt(max(0.0, 1.0 - dot(qq, qq) * 0.56)));
      N = normalize(camR * ns.x + camU * ns.y + V * ns.z);
      trans = 1.2;
    } else if (ty == 6) {
      // すみれ：上2・横2・下1の花弁、下の花弁に白い喉と紫の筋
      vec2 qq = vFUv.xy;
      float a = 0.0;
      float lower = 0.0;
      for (int i = 0; i < 5; i++) {
        float ang = i == 0 ? 1.95 : i == 1 ? 1.2 : i == 2 ? 2.85 : i == 3 ? 0.3 : -1.5708;
        float len = i == 4 ? 0.95 : i < 2 ? 0.85 : 0.8;
        float wid = i == 4 ? 0.36 : 0.3;
        vec2 dd = vec2(cos(ang), sin(ang));
        float al = dot(qq, dd);
        float pp = dot(qq, vec2(-dd.y, dd.x));
        float d = length(vec2((al - len * 0.5) / (len * 0.5), pp / wid));
        float on = 1.0 - aaStep(1.0, d);
        if (i == 4) lower = on;
        a = max(a, on);
      }
      alpha = a;
      alb = fc;
      float throat = 1.0 - smoothstep(0.05, 0.35, length(qq - vec2(0.0, -0.15)));
      alb = mix(alb, vec3(0.8, 0.8, 0.82), throat * 0.8);
      alb = mix(alb, fc * 0.4, lower * (1.0 - smoothstep(0.0, 0.02, abs(fract(atan(qq.y + 0.1, qq.x + 1e-5) * 3.0) - 0.5) - 0.44)) * 0.8);
      alb = mix(alb, vec3(0.6, 0.6, 0.1), 1.0 - aaStep(0.07, length(qq)));
    } else if (ty == 7) {
      // いぬふぐり：4弁（下の1枚は小さい）、濃い青の筋と白い中心
      float env = 0.95 - 0.28 * smoothstep(0.6, 1.0, -sin(an)) ;
      float lob = 0.75 + 0.25 * pow(abs(cos(2.0 * an)), 0.4);
      alpha = 1.0 - aaStep(env * lob, r);
      float vein = 1.0 - smoothstep(0.0, 0.03, abs(fract(an / 6.2831 * 24.0) - 0.5) - 0.44);
      alb = mix(vec3(0.85, 0.88, 0.95), fc, smoothstep(0.12, 0.35, r));
      alb = mix(alb, fc * 0.35, vein * smoothstep(0.2, 0.4, r) * 0.7);
    } else if (ty == 8) {
      // ほとけのざ：段の葉（丸く波打つ）の上に、上向きの細い筒の花
      vec2 qq = vFUv.xy;
      float lf = 0.0;
      for (int s = -1; s <= 1; s += 2) {
        vec2 o = qq - vec2(float(s) * 0.42, -0.35);
        float rr = length(o * vec2(1.0, 1.5));
        float ang = atan(o.y, o.x + 1e-5);
        lf = max(lf, 1.0 - aaStep(0.42 + 0.05 * sin(ang * 9.0), rr));
      }
      float fl = 0.0, hood = 0.0;
      for (int i = 0; i < 5; i++) {
        float fi = float(i);
        float ang = 0.75 + fi * 0.4 + (hsh(fi + seed * 5.0) - 0.5) * 0.2;
        vec2 dd = vec2(cos(ang), sin(ang));
        vec2 o = qq - vec2(0.0, -0.35);
        float al = dot(o, dd);
        float pp = abs(dot(o, vec2(-dd.y, dd.x)));
        float w = mix(0.035, 0.11, smoothstep(0.35, 0.95, al));
        float on = (1.0 - aaStep(w, pp)) * step(0.0, al) * (1.0 - aaStep(1.05, al));
        if (on > fl) hood = smoothstep(0.7, 1.0, al);
        fl = max(fl, on);
      }
      alpha = max(lf, fl);
      alb = fl > 0.5 ? mix(fc * 0.85, fc * 1.15, hood) : vec3(0.06, 0.13, 0.035) * (0.85 + 0.2 * lf);
    } else if (ty == 9) {
      // 三つ葉：先がくぼんだ3枚の小葉、白いV字の斑
      float a = 0.0, chev = 0.0;
      for (int i = 0; i < 3; i++) {
        float ang = float(i) * 2.0944;
        vec2 dd = vec2(cos(ang), sin(ang));
        float al = dot(q, dd);
        float pp = dot(q, vec2(-dd.y, dd.x));
        float d = length(vec2((al - 0.5) / 0.5, pp / 0.4));
        float notch = 1.0 - smoothstep(0.08, 0.14, length(vec2(al - 1.0, pp)));
        float on = (1.0 - aaStep(1.0, d)) * (1.0 - notch);
        if (on > 0.5) chev = 1.0 - smoothstep(0.035, 0.07, abs(al - 0.42 - abs(pp) * 0.7));
        a = max(a, on);
      }
      alpha = a;
      alb = mix(fc, vec3(0.2, 0.3, 0.12), chev * 0.7);
      trans = 1.0; gloss = 0.55;
    } else if (ty == 10) {
      // ハート形の葉
      vec2 hq = q * 1.15 + vec2(0.0, 0.1);
      hq.y = -hq.y;
      float x2 = hq.x * hq.x, y = hq.y * 1.1;
      float hv = pow(x2 + y * y - 1.0, 3.0) - x2 * y * y * y;
      alpha = 1.0 - aaStep(0.0, hv);
      alb = fc * (0.9 + 0.2 * (1.0 - smoothstep(0.0, 0.06, abs(hq.x))));
      trans = 0.9; gloss = 0.5;
    } else if (ty == 11) {
      // 葦の穂（去年の名残り）：ほぐれた房が片側へ垂れる
      // 軸は茎の先から片側へ弓なりに垂れ、枝は軸から下へ流れる細い毛の束。冬を越してまばらにほつれている
      vec2 qq = vFUv.xy;
      float sdir = seed > 0.5 ? 1.0 : -1.0;
      float s0 = (0.95 - qq.y) / 1.9;
      float xc = sdir * 0.55 * pow(sat(s0), 1.6);
      float w = 0.04 + 0.3 * pow(sin(3.1416 * sat(s0 * 1.05)), 0.7) * (0.8 + 0.4 * seed);
      float dx = (qq.x - xc) * sdir;
      // 毛の束：垂れる向きに沿った筋。束ごとに長さと濃さが違う
      float fib = dx * 26.0 + s0 * 5.0;
      float fi = floor(fib);
      float fr = hsh(fi * 1.37 + seed * 29.0);
      float hair = 1.0 - aaStep(0.18 + 0.2 * fr, abs(fract(fib) - 0.5));
      float ragged = step(0.3, fr) * step(abs(dx) / max(w, 1e-3), 0.55 + 0.45 * hsh(fi * 3.7 + seed));
      float rach = 1.0 - aaStep(0.016, abs(dx));
      float inside = step(0.0, s0) * step(s0, 1.0);
      alpha = max(hair * ragged, rach * step(s0, 0.92)) * inside;
      alb = mix(fc * vec3(1.05, 0.98, 0.9), fc * vec3(0.72, 0.64, 0.6), fr) * (0.85 + 0.3 * sat(1.0 - s0));
      // 遠くで毛の筋が画素より細くなったら、ほつれた房のやわらかい影に替える（刻みの帯に見せない）
      float lodr = smoothstep(0.03, 0.12, length(fwidth(qq)));
      float soft = inside * (1.0 - smoothstep(0.55, 1.0, abs(dx) / max(w, 1e-3))) * (0.45 + 0.35 * hsh(floor(s0 * 6.0) + seed * 7.0));
      alpha = mix(alpha, soft, lodr);
      alb = mix(alb, fc * (0.95 + 0.15 * sat(1.0 - s0)), lodr);
      trans = 1.3;
      gloss = 0.15;
    }
    // 遠くて花が数画素になったら、細かな弁の形をやめて丸く塗る（網点で花が消えないように）
    if (ty <= 8 && ty != 4) {
      float lodf = smoothstep(0.1, 0.3, length(fwidth(vFUv.xy)));
      alpha = mix(alpha, 1.0 - aaStep(0.75, length(vFUv.xy)), lodf);
      alb = mix(alb, fc, lodf * 0.7);
    }
    if (alpha < 0.03) discard;
    if (dot(N, V) < 0.0) N = -N;
  }
#endif
  if (!card && dot(N, V) < 0.0) N = -N;

  // ---- 光：日なた（拡散＋葉を透ける光＋つや）と空の光 ----
  float NL = dot(N, L);
  float sd = sh * self;
  // 拡散は上向きに寄せた法線で（細い葉の面の向きより、草むら全体の向きで光る）
  // 薄い葉は両面から光を受ける：下を向いた面（弓なりの葉の裏）も上向きに折り返して、裏が真っ黒な棘にならないように
  vec3 Nu = card ? N : normalize(vec3(N.x, abs(N.y), N.z) + vec3(0.0, 0.55, 0.0));
  float NLd = card ? NL : dot(Nu, L);
  // 細い葉は光が回り込む（面の向きで真っ黒にしない）
  vec3 col = alb * uSunCol * (card ? sat(NLd) : sat((NLd + 0.3) / 1.3)) * sd;
  // 透過：裏から日が当たると黄緑に透ける（逆光でいちばん強い）
  vec3 tAlb = alb * vec3(1.15, 1.3, 0.55) + vec3(0.01, 0.02, 0.0);
  float fwd = pow(sat(dot(-V, L)), 3.0);
  col += tAlb * uSunCol * (sat(-NL) * 0.7 + fwd * 0.45) * trans * sd;
  // 空の光（上向きに寄せた法線で。根元は暗く）
  vec3 Na = card ? normalize(N + vec3(0.0, 0.7, 0.0)) : normalize(Nu + vec3(0.0, 0.4, 0.0));
  col += alb * shIrr(Na) * ao;
  // つや：葉の表のワックス。斜めから見るほど空が映る
  float rough = mix(0.55, 0.3, gloss);
  vec3 Hh = normalize(L + V);
  float nh = sat(dot(N, Hh));
  float a2 = rough * rough * rough * rough;
  float dn = nh * nh * (a2 - 1.0) + 1.0;
  float D = a2 / (3.1416 * dn * dn);
  float nv = sat(dot(N, V));
  float F = 0.04 + 0.96 * pow(1.0 - sat(dot(Hh, V)), 5.0);
  col += uSunCol * min(D * F * 0.25, 3.0) * sat(NL) * sd * (card ? 0.4 : 1.0);
  float Fv = 0.04 + 0.96 * pow(1.0 - nv, 5.0);
  col += shIrr(reflect(-V, N) * vec3(1.0, 1.0, 1.0)) * Fv * 0.35 * gloss * ao;
  gl_FragColor = vec4(max(col, vec3(0.0)), alpha);
#endif
}
`;

export class Grass {
  constructor(world, shared, textures, lite = false) {
    this.group = new THREE.Group();
    this.group.userData.grass = this;   // 確認用（__app.groups.grass.userData.grass.hide）
    let L = [
      { spacing: 0.145, n: 152, fade: [0, 0, 11, 14.5], nb: 8, seg: 4, nc: 3 },
      { spacing: 0.29, n: 152, fade: [11, 14.5, 25, 29], nb: 5, seg: 3, nc: 2 },
      { spacing: 0.58, n: 152, fade: [25, 29, 52, 58], nb: 3, seg: 3, nc: 3 },
      { spacing: 1.16, n: 152, fade: [52, 58, 100, 110], nb: 2, seg: 2, nc: 2 },
    ];
    if (lite) L = L.map((c) => ({ ...c, spacing: c.spacing * 1.35, n: Math.round(c.n * 0.74), nb: Math.max(2, c.nb - 2) }));
    // 前処理の描き先（全画面の三角形1枚）
    const tri = new THREE.BufferGeometry();
    tri.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    this.preScene = new THREE.Scene();
    this.preCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.pxH = { value: 720 };   // 描き先の高さ（画素）
    this.levels = L.map((c, i) => {
      const rt = new THREE.WebGLRenderTarget(c.n, c.n, {
        count: 4, type: THREE.FloatType, format: THREE.RGBAFormat,
        minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: false, stencilBuffer: false, generateMipmaps: false,
      });
      const common = {
        uCenter: { value: new THREE.Vector2() }, uSpacing: { value: c.spacing }, uN: { value: c.n }, uLevel: { value: i }, uSub: { value: new THREE.Vector4(0, 0, c.n, c.n) },
      };
      const pre = new THREE.ShaderMaterial({
        uniforms: {
          ...shared, ...textures, ...common,
          uFade: { value: new THREE.Vector4(...c.fade) }, uViewProj: { value: new THREE.Matrix4() }, uGroundY: { value: 0 }, uCam: { value: new THREE.Vector3() },
        },
        vertexShader: PRE_VS, fragmentShader: PRE_FS, glslVersion: THREE.GLSL3,
        depthTest: false, depthWrite: false,
      });
      const preMesh = new THREE.Mesh(tri, pre);
      preMesh.frustumCulled = false;
      // 葉と札は別の描画（札の重いシェーダーを葉で走らせない）
      const mk = (geo, def) => {
        geo.instanceCount = c.n * c.n;
        const mat = new THREE.ShaderMaterial({
          uniforms: {
            ...shared, ...common,
            tI0: { value: rt.textures[0] }, tI1: { value: rt.textures[1] }, tI2: { value: rt.textures[2] }, tI3: { value: rt.textures[3] },
            uSeg: { value: c.seg }, uNB: { value: c.nb }, uPxH: this.pxH,
          },
          defines: def,
          vertexShader: GRASS_VS, fragmentShader: GRASS_FS,
          // 株元の地面は表だけ（稜線の向こうの斜面の板は裏になって消える）
          side: def.GROUND !== undefined ? THREE.FrontSide : THREE.DoubleSide,
          // 株元の地面は網点で抜かずに色を掛ける（網点＝市松模様を出さない）。葉と札は網点で抜く
          alphaToCoverage: def.GROUND === undefined,
          depthWrite: def.GROUND === undefined,
        });
        if (def.GROUND !== undefined) {
          // 掛け合わせ（下の色×この色）
          Object.assign(mat, { blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.DstColorFactor, blendDst: THREE.ZeroFactor });
        }
        const mesh = new THREE.Mesh(geo, mat);
        mesh.frustumCulled = false;
        // 描く順：地形などの不透明物 → 株元の地面（掛け合わせ） → 葉と札。葉は後から上書きされるので、板の暗がりが葉の根元に乗らない
        mesh.renderOrder = def.GROUND !== undefined ? 1 : 2;
        this.group.add(mesh);
        return mesh;
      };
      const groundMesh = mk(groundGeometry(), { GROUND: '' });
      const mesh = mk(tuftGeometry(c.nb, c.seg, 0), {});
      const cardMesh = mk(tuftGeometry(0, c.seg, c.nc), { CARDS: '' });
      return { ...c, mesh, cardMesh, groundMesh, geos: [mesh, cardMesh, groundMesh].filter(Boolean).map((m) => m.geometry), pre, preMesh, rt, common };
    });
    this._vp = new THREE.Matrix4();
    this._pts = Array.from({ length: 8 }, () => new THREE.Vector3());
  }
  update(camera, groundY, renderer) {
    // 前処理は浮動小数の描き先に描く。拡張がない端末では草を出さない（理由をログに）
    if (renderer && this._ok === undefined) {
      this._ok = renderer.extensions.has('EXT_color_buffer_float');
      if (!this._ok) console.warn('grass: EXT_color_buffer_float がないため草花を描きません');
    }
    if (this._ok === false) { this.group.visible = false; return; }
    if (renderer) this.pxH.value = renderer.domElement.height || 720;
    this._vp.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    const f = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    const fl = Math.hypot(f.x, f.z) || 1;
    const alt = camera.position.y - groundY;
    // 画面の縁の視線の向き（四隅と上の縁の途中。上の縁は遠くで弧になるので間も取る）
    const th = Math.tan(camera.fov * Math.PI / 360) * 1.08, tw = th * camera.aspect;
    const P = this._pts;
    let pi = 0;
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [-0.5, 1], [0, 1], [0.5, 1], [1, 1], [0, -1]]) {
      P[pi++].set(sx * tw, sy * th, -1).applyQuaternion(camera.quaternion);
    }
    const prevRT = renderer ? renderer.getRenderTarget() : null;
    this.levels.forEach((lv, i) => {
      // 高いところからは細かい輪を省く
      const maxAlt = [22, 45, 90, 170][i];
      const on = alt < maxAlt && this.group.visible;
      const hide = this.hide || {};
      lv.mesh.visible = on && !hide.blades;
      lv.cardMesh.visible = on && !hide.cards;
      if (lv.groundMesh) lv.groundMesh.visible = on && !hide.ground;
      const half = lv.n * lv.spacing * 0.5;
      const shift = half * 0.45 * Math.min(1, fl * 1.4);
      const cx = camera.position.x + (f.x / fl) * shift, cz = camera.position.z + (f.z / fl) * shift;
      const snap = lv.spacing * 4;
      const ucx = Math.round(cx / snap) * snap, ucz = Math.round(cz / snap) * snap;
      lv.common.uCenter.value.set(ucx, ucz);
      // 画面の四隅の視線が地面に届く所（遠くはこの輪の届く距離まで）を囲む長方形の株だけを描く
      const R = lv.fade[3] + 1.5, m = 1.5;
      const P = this._pts;
      let x0 = camera.position.x - m, x1 = camera.position.x + m, z0 = camera.position.z - m, z1 = camera.position.z + m;
      for (const p of P) {
        let d = R;
        if (p.y < -1e-3) d = Math.min(R, (alt + 6 + lv.fade[3] * 0.1) / -p.y * Math.hypot(p.x, p.z));   // 遠い輪ほど、視点の真下より低い地形の分の余白を広く
        const hl = Math.hypot(p.x, p.z) || 1;
        const x = camera.position.x + (p.x / hl) * d, z = camera.position.z + (p.z / hl) * d;
        x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z);
      }
      const bx = Math.floor(ucx / lv.spacing) - (lv.n >> 1), bz = Math.floor(ucz / lv.spacing) - (lv.n >> 1);
      const gx0 = Math.max(0, Math.floor(x0 / lv.spacing) - bx - 1), gx1 = Math.min(lv.n - 1, Math.floor(x1 / lv.spacing) - bx + 1);
      const gz0 = Math.max(0, Math.floor(z0 / lv.spacing) - bz - 1), gz1 = Math.min(lv.n - 1, Math.floor(z1 / lv.spacing) - bz + 1);
      const sw = Math.max(1, gx1 - gx0 + 1), sh = Math.max(0, gz1 - gz0 + 1);
      lv.common.uSub.value.set(gx0, gz0, sw, sh);
      for (const g of lv.geos) g.instanceCount = sw * sh;
      const u = lv.pre.uniforms;
      u.uViewProj.value.copy(this._vp);
      u.uGroundY.value = groundY;
      u.uCam.value.copy(camera.position);
      if (renderer && on) {
        this.preScene.add(lv.preMesh);
        renderer.setRenderTarget(lv.rt);
        renderer.render(this.preScene, this.preCam);
        this.preScene.remove(lv.preMesh);
      }
    });
    if (renderer) renderer.setRenderTarget(prevRT);
  }
}
