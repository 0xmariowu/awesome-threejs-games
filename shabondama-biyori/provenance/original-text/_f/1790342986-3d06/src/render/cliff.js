// 滝の崖：一続きの岩の面。地層の段（硬い層は張り出し、柔らかい薄い層は深く引っこむ）、何層も通る縦の節理と層ごとの割れ目、
// 割れ目で区切られた岩塊ごとに傾きの違う平らな割れ面（途中で折れる面もある）、角の欠けと丸み、大きなうねり、滝の裏のえぐれ。
// 地形の急な段（格子の坂）の少し手前にかぶせて、崖の見た目をこの面が受け持つ。谷の両側の壁にも同じ岩の面を沿わせ、崖の端をつなぐ
import * as THREE from 'three';
import { ALL, SHADOW } from './glsl.js';
import { SKY_GLSL } from './sky.js';
import { GORGE, gorgeWorld, gorgeLocal } from '../world/layout.js';
import { buildRocks } from './rocks.js';
import { cliffLine } from '../world/gen.js';
import { simplex2, fbm2, mulberry32, smoothstep, clamp, lerp } from '../util/noise.js';

const CVS = /* glsl */ `
${ALL}
${SHADOW}
attribute vec4 aShade;   // x=くぼみの陰(0..1) y=濡れ z=層の色の種 w=苔の付きやすさ
attribute vec4 aFace;    // x=面に沿った横の位置(m) y=岩塊の種 z=角(+)・くぼみ(-) w=柔らかい層
attribute float aV;      // 模様の縦の座標：面では高さ、上の縁の折り返しでは奥への距離を足す（平らな肩で模様が伸びない）
varying float vV;
varying vec3 vN;
varying vec3 vWorld;
varying vec4 vShade;
varying vec4 vFace;
void main() {
  vN = normal;
  vWorld = position;
  vShade = aShade;
  vFace = aFace;
  vV = aV;
  gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0);
}
`;
const CFS = /* glsl */ `
${ALL}
${SHADOW}
${SKY_GLSL}
varying vec3 vN;
varying vec3 vWorld;
varying vec4 vShade;
varying vec4 vFace;
varying float vV;
void main() {
#ifdef DEPTH
  gl_FragColor = vec4(1.0);
#else
  vec3 wp = vWorld;
  vec3 N = dot(vN, vN) > 1e-10 ? normalize(vN) : vec3(0.0, 0.0, 1.0);
  float cav = vShade.x, wet = vShade.y, tone = vShade.z, mossy = vShade.w;
  float A = vFace.x, bs = vFace.y, cvx = vFace.z, soft = vFace.w;
  vec2 q = vec2(A, vV);
  float dist = length(cameraPosition - wp);
  // 遠くでちらつく細かい模様は距離で消す
  float fFine = 1.0 - smoothstep(10.0, 45.0, dist);
  float fSpeck = 1.0 - smoothstep(3.0, 14.0, dist);
  float fCrack = 1.0 - smoothstep(12.0, 45.0, dist);
  // ---- 岩の肌 ----
  // 上を向いた肩・ゆるい面では、面の格子の座標だと模様が奥へ伸びるので、真上からの座標と混ぜる
  float wTop = smoothstep(0.45, 0.8, N.y);
  vec2 qt = wp.xz;
  #define TX(sc, off) (wTop > 0.001 ? mix(texture(tNoise, q * (sc) + (off)), texture(tNoise, qt * (sc) + (off)), wTop) : texture(tNoise, q * (sc) + (off)))
  float big = TX(0.031, bs * 3.7).g;
  float mid = TX(0.14, vec2(0.31, 0.77)).r;
  float fine = TX(vec2(0.8, 1.05), vec2(bs)).r;
  float grain = TX(3.4, vec2(0.5)).r;
  float speck = TX(0.8, vec2(bs * 5.0)).a;
  float vert = 1.0 - smoothstep(0.55, 0.85, N.y);   // 立った面だけの模様（層の縞・雨だれ）は上を向いた肩では消す
  float lam = mix(0.5, texture(tNoise, vec2(vV * 2.6 + mid * 0.35, A * 0.015 + tone * 5.0)).g, vert);   // 層の中の細かい縞
  // 層ごとの色：青みの灰〜暖かい灰、ときどき鉄の染み。岩塊ごとに少し違う
  vec3 base = mix(vec3(0.165, 0.172, 0.178), vec3(0.23, 0.215, 0.195), smoothstep(0.15, 0.85, tone));
  base = mix(base, vec3(0.25, 0.19, 0.13), smoothstep(0.84, 0.97, tone) * 0.55);
  base = mix(base, vec3(0.13, 0.125, 0.12), soft * 0.6);               // 柔らかい層は暗く細かい
  base *= 0.9 + 0.2 * bs;
  vec3 alb = base * (0.74 + 0.46 * big) * (0.84 + 0.32 * mid) * (0.88 + 0.24 * lam) * (0.86 + 0.28 * fine);
  alb *= mix(1.0, 0.84 + 0.32 * grain, fFine);
  // 斑晶（白い粒）
  alb = mix(alb, vec3(0.62, 0.61, 0.58), smoothstep(0.9, 0.985, speck) * fSpeck * 0.5);
  // 細い割れ：ゆがんだ等値線。ところどころだけ
  float cr = abs(texture(tNoise, q * vec2(0.07, 0.1) + vec2(bs * 3.0, 0.0)).r - 0.5 + (fine - 0.5) * 0.03);
  float crack = (1.0 - smoothstep(0.0, 0.008 + dist * 0.00015, cr)) * smoothstep(0.6, 0.72, texture(tNoise, q * 0.05 + 2.3).g) * fCrack;
  alb *= 1.0 - 0.6 * crack;
  // 雨だれの筋：張り出しの下から縦に伸びる暗い筋（黒い藻・鉄）と、ところどころ白い析出
  float st = texture(tNoise, vec2(A * 0.11 + bs * 0.05, vV * 0.011)).r;
  float st2 = texture(tNoise, vec2(A * 0.33, vV * 0.028 + 0.3)).r;
  float streak = smoothstep(0.46, 0.72, st * 0.72 + st2 * 0.4) * vert;
  alb *= mix(vec3(1.0), vec3(0.4, 0.4, 0.37), streak * (0.7 + 0.3 * (1.0 - cav)));
  // 大きな染み（上の棚から流れた水の跡・土の色）
  float stain = texture(tNoise, vec2(A * 0.045 + 0.7, vV * 0.012)).g;
  alb *= mix(vec3(1.0), vec3(0.72, 0.7, 0.64), smoothstep(0.45, 0.7, stain));
  alb = mix(alb, vec3(0.36, 0.355, 0.33), smoothstep(0.8, 0.92, st2 * 0.6 + big * 0.5) * (1.0 - wet) * 0.35);
  // 角は風化して明るく、くぼみは土がたまって暗い
  alb *= clamp(1.0 + 0.28 * cvx, 0.7, 1.3);
  alb *= mix(0.72, 1.0, smoothstep(0.15, 0.6, cav));
  // 地衣：乾いた日なたの面に丸い斑（淡い灰緑・ときどき黄土）
  float lm = mid * 0.55 + fine * 0.3 + grain * 0.15 * fFine;
  float lich = smoothstep(0.64, 0.7, lm + (big - 0.5) * 0.3) * (1.0 - wet) * smoothstep(0.35, 0.65, big) * smoothstep(0.4, 0.8, cav);
  vec3 lc = mix(vec3(0.44, 0.47, 0.41), vec3(0.52, 0.42, 0.2), step(0.8, texture(tNoise, q * 0.05 + 5.0).r));
  alb = mix(alb, lc * (0.7 + 0.35 * grain), lich * 0.55);
  // 苔：上を向いた棚・濡れた割れ目・張り出しの下の湿ったところ。縁はふさふさ途切れる
  float mossW = smoothstep(0.15, 0.55, N.y * 1.4 + (mid - 0.5) * 0.7 + wet * 0.4 + (mossy - 0.5) * 0.8 + (0.6 - cav) * 0.35 + streak * 0.15 - 0.05);
  mossW *= smoothstep(0.26, 0.58, fine + 0.25 * grain + 0.15 + wet * 0.1) * (0.35 + 0.65 * mossy);
  mossW = clamp(mossW * 1.3, 0.0, 1.0);
  vec3 mossC = mix(vec3(0.035, 0.065, 0.018), vec3(0.12, 0.18, 0.035), smoothstep(0.3, 0.8, fine * 0.6 + grain * 0.5));
  // しぶきのかかるところは黒緑の藻
  float algae = smoothstep(0.35, 0.85, wet) * smoothstep(0.4, 0.7, mid + 0.2 * st);
  alb = mix(alb, vec3(0.045, 0.055, 0.035), algae * 0.7);
  alb = mix(alb, mossC, mossW);
  // 濡れ：暗く（水が気孔を埋める）
  alb *= mix(1.0, 0.42, wet * (1.0 - mossW * 0.5));
  // ---- 細かい凹凸（画面の微分で面の向きをずらす） ----
  float hb = (mid * 0.35 + fine * 0.3 + grain * 0.14 * fFine + lam * 0.12 - crack * 0.25 + mossW * grain * 0.3) * 0.055;
  vec3 dpx = dFdx(wp), dpy = dFdy(wp);
  float dhx = dFdx(hb), dhy = dFdy(hb);
  vec3 r1 = cross(dpy, N), r2 = cross(N, dpx);
  float det = dot(dpx, r1);
  vec3 Nb = abs(det) * N - sign(det) * (dhx * r1 + dhy * r2);
  if (dot(Nb, Nb) > 1e-14) N = normalize(Nb);
  // ---- 光 ----
  float nl = max(dot(N, uSunDir), 0.0);
  float sh = sunShadow(wp, nl, gl_FragCoord.xy) * cloudShadow(wp);
  float ao = mix(0.22, 1.0, cav) * (0.62 + 0.38 * smoothstep(-0.7, 0.4, N.y));
  // 苔は光を少し回す（やわらかい）
  float wrap = mossW * 0.25;
  float dif = max((dot(N, uSunDir) + wrap) / (1.0 + wrap), 0.0);
  vec3 col = alb * (uSunCol * dif * sh * mix(0.4, 1.0, cav) + shIrr(N) * ao);
  // 張り出しの下は地面（草）の照り返しで少し明るい
  col += alb * shIrr(vec3(0.0, 1.0, 0.0)) * vec3(0.5, 0.62, 0.36) * 0.3 * smoothstep(0.0, -0.8, N.y) * mix(0.5, 1.0, cav);
  vec3 V = normalize(cameraPosition - wp);
  vec3 H = normalize(uSunDir + V);
  float nv = max(dot(N, V), 0.0);
  // 乾いた岩は鈍い光、濡れた岩は鋭い光と空の映り込み。染み出しの水膜はきらきら流れる
  float gl = texture(tNoise, vec2(A * 2.2, vV * 0.22 + uTime * 0.5)).r;
  float film = wet * (0.55 + 0.9 * smoothstep(0.55, 0.8, gl));
  float gloss = mix(10.0, 140.0, clamp(film, 0.0, 1.0));
  float spec = pow(max(dot(N, H), 0.0), gloss) * (gloss + 8.0) / 8.0 * 0.02;
  col += uSunCol * spec * (0.25 + 1.6 * film) * sh * (1.0 - mossW * 0.7);
  float F = 0.04 + 0.96 * pow(1.0 - nv, 5.0);
  if (film > 0.01) col += envRadiance(reflect(-V, N)) * F * clamp(film, 0.0, 1.0) * 0.55 * ao;
  if (any(isnan(col)) || any(isinf(col))) col = vec3(0.0);
  gl_FragColor = vec4(max(col, 0.0), 1.0);
#endif
}
`;

// 棚の草とシダ：弓なりに垂れる葉を何枚か束ねた株。風でゆれ、日に透ける
const PVS = /* glsl */ `
${ALL}
attribute vec4 iP;     // xyz, 大きさ
attribute vec4 iR;     // 向き, 外へ傾く向き(xz), 種
attribute vec3 aB;     // x=葉の根元からの割合 y=葉の横(-1..1) z=葉の番号
varying vec3 vWorld;
varying vec3 vB;
varying vec3 vN;
varying float vKind;
void main() {
  float sz = iP.w;
  float ang = iR.x + aB.z * 2.39996;
  float lean = 0.35 + 0.5 * fract(sin(aB.z * 12.9898 + iR.w * 78.233) * 43758.5453);
  float len = sz * (0.65 + 0.5 * fract(sin(aB.z * 4.1 + iR.w * 17.0) * 9631.7));
  // 葉：根元から外へ、先は重みで垂れる
  float t = aB.x;
  vec2 dir = vec2(cos(ang), sin(ang));
  // 株ごとに崖の外（iR.yz）へ寄せる
  dir = normalize(dir + iR.yz * 0.9 + 1e-4);
  float out_ = len * sin(lean + t * 0.9) * t;
  float up = len * (cos(lean) * t - 0.9 * t * t * (0.4 + lean * 0.6));
  vec2 side = vec2(-dir.y, dir.x);
  // 葉の幅：付け根と先は細い
  vKind = step(0.5, fract(iR.w * 7.3));
  float w = sz * 0.07 * sin(3.14159 * min(1.0, t * 1.05 + 0.04)) * mix(1.0, 1.9, vKind);
  vec3 p = iP.xyz + vec3(dir.x * out_, up, dir.y * out_) + vec3(side.x, 0.0, side.y) * aB.y * w;
  // 風のゆれ（先ほど大きい）
  vec2 wd = windAt(iP.xz);
  float sway = sin(uTime * 2.3 + iR.w * 30.0 + aB.z) * 0.06 + 0.04;
  p.xz += wd * sway * t * t * sz * 0.5;
  vWorld = p;
  vB = aB;
  vN = normalize(vec3(dir.x * -0.4, 1.0, dir.y * -0.4));
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}
`;
const PFS = /* glsl */ `
${ALL}
${SHADOW}
varying vec3 vWorld;
varying vec3 vB;
varying vec3 vN;
varying float vKind;
void main() {
  // シダは小葉の切れ込み、草は細い一枚
  float t = vB.x, x = abs(vB.y);
  float edge = vKind > 0.5 ? 0.55 + 0.45 * abs(sin(t * 34.0)) : 1.0 - 0.3 * t;
  if (x > edge) discard;
#ifdef DEPTH
  gl_FragColor = vec4(1.0);
#else
  vec3 N = normalize(vN);
  if (!gl_FrontFacing) N = -N;   // 裏から見た葉
  float h = fract(sin(vB.z * 3.7) * 437.5);
  vec3 alb = mix(vec3(0.1, 0.2, 0.042), vec3(0.25, 0.4, 0.08), t * 0.7 + h * 0.3);
  alb = mix(alb, vec3(0.2, 0.2, 0.08), smoothstep(0.85, 1.0, t) * 0.5);      // 先は少し枯れ色
  float sh = sunShadow(vWorld, 0.6, gl_FragCoord.xy) * cloudShadow(vWorld);
  vec3 V = normalize(cameraPosition - vWorld);
  float nl = abs(dot(N, uSunDir));
  float trans = pow(max(dot(-V, uSunDir), 0.0), 3.0) * 0.8;
  // 空の光は葉の向きと上向きの平均（影の中のシダが黒いくしにならない）
  vec3 skyUp = shIrr(vec3(0.0, 1.0, 0.0));
  vec3 amb = max(0.5 * (shIrr(N) + skyUp), skyUp * 0.45);
  vec3 col = alb * (uSunCol * (nl * 0.8 + trans * vec3(0.9, 1.1, 0.5)) * sh + amb * (0.65 + 0.35 * t));
  gl_FragColor = vec4(max(col, 0.0), 1.0);
#endif
}
`;

function plantGeometry(blades, segs) {
  const pos = [], b = [], idx = [];
  for (let k = 0; k < blades; k++) {
    const base = pos.length / 3;
    for (let j = 0; j <= segs; j++) {
      const t = j / segs;
      for (const sdd of [-1, 1]) { pos.push(0, 0, 0); b.push(t, sdd, k); }
    }
    for (let j = 0; j < segs; j++) { const a0 = base + j * 2; idx.push(a0, a0 + 1, a0 + 2, a0 + 1, a0 + 3, a0 + 2); }
  }
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aB', new THREE.Float32BufferAttribute(b, 3));
  g.setIndex(idx);
  return g;
}

const smax0 = (x, k) => 0.5 * (x + Math.sqrt(x * x + k * k));
// 面の出かた e（0..1）：地形の中 → 地形の坂にぴったり沿う皮 → 本来の岩の面。途中で宙に浮いた板にならない
let lastE = 0, lastFull = NaN;   // いちばん最後に求めた出かたと、出きったときの位置（棚の株・くぼみの陰に使う）
const emerge = (dIn, dSkin, dFull, e) => { lastE = e; lastFull = dFull; return e < 0.35 ? lerp(dIn, dSkin, e / 0.35) : lerp(dSkin, Math.max(dSkin, dFull), (e - 0.35) / 0.65); };
const smax = (a, b, k) => b + smax0(a - b, k);

// 岩の層をつくる：通しの節理（何層も続く）＋層ごとの割れ目。岩塊ごとの面の傾き・折れ・角の丸み
function makeStrata(r, y0, y1, a0, a1) {
  const master = [];
  for (let a = a0 + r() * 2; a < a1; a += 1.5 + r() * 3.4) master.push({ a, drift: (r() - 0.5) * 0.12 });
  const layers = [];
  for (let y = y0; y < y1;) {
    const soft = r() < 0.18;
    // 塊の層（割れ目が少なく、上下の層ともつながって見える）
    const massive = !soft && r() < 0.3;
    const t = soft ? 0.25 + r() * 0.45 : 0.8 + r() * r() * 3.4 + r() * 0.6 + (massive ? 1.2 : 0);
    const js = [];
    for (const m of master) if (r() < (soft ? 0.25 : massive ? 0.32 : 0.62)) js.push({ a: m.a + m.drift * (y - y0) + (r() - 0.5) * 0.18, d: 0.12 + r() * 0.3, w: 0.07 + r() * 0.13 });
    for (let a = a0 + r() * 3; a < a1; a += 1.6 + r() * 5) if (r() < (massive ? 0.2 : 0.55)) js.push({ a, d: 0.05 + r() * 0.22, w: 0.05 + r() * 0.09 });
    js.sort((p, q) => p.a - q.a);
    const J = [];
    for (const j of js) if (!J.length || j.a - J[J.length - 1].a > 0.6) J.push(j);
    const blocks = [];
    for (let i = 0; i <= J.length; i++) {
      blocks.push({
        o: (r() - 0.5) * 0.4, ta: (r() - 0.5) * 0.28, ty: (r() - 0.6) * 0.34,
        bev: 0.05 + r() * r() * 0.35, seed: r(),
        split: r() < 0.5 ? { k: (r() - 0.5) * 2.4, u: (r() - 0.5) * 0.7, s: (0.12 + r() * 0.3) * (r() < 0.5 ? 1 : -1) } : null,
        gone: !soft && r() < 0.06,      // 抜け落ちた岩塊（深い穴）
      });
    }
    layers.push({ y0: y, y1: y + t, p: soft ? -0.35 - r() * 0.25 : (r() - 0.4) * 0.7, tone: r(), soft, massive, J, blocks, e0: r() * 2.8, e1: r() * 2.8 });
    y += t;
  }
  const layerAt = (y) => {
    let lo = 0, hi = layers.length - 1;
    while (lo < hi) { const m = (lo + hi) >> 1; if (y < layers[m].y1) hi = m; else lo = m + 1; }
    return layers[lo];
  };
  // 面のずれ（外向き＋）と、その点の岩塊
  // dy, da: 面の行と列の間隔。細い溝・角の丸みは格子の間隔より細くしない（1列・1行だけ抜けてのこぎりの歯に見える）
  const disp = (a0, y0, dy = 0, da = 0) => {
    // 層はわずかに傾き、うねる。割れ目は少し斜めに、揺れながら通る
    const y = y0 + 0.035 * a0 + 0.5 * simplex2(a0 / 8 + 11, 0.3) + 0.12 * simplex2(a0 / 2.2, y0 / 3);
    const a = a0 + 0.07 * y0 + 0.2 * simplex2(y0 / 2.5, a0 / 9 + 4);
    const L = layerAt(y);
    const yb = y - L.y0, yt = L.y1 - y;
    const J = L.J;
    let bi = 0;
    while (bi < J.length && J[bi].a < a) bi++;
    const ja = bi > 0 ? J[bi - 1].a : a - 8, jb = bi < J.length ? J[bi].a : a + 8;
    const B = L.blocks[bi];
    const ac = (Math.max(ja, a - 5) + Math.min(jb, a + 5)) / 2, yc = (L.y0 + L.y1) / 2;
    // 岩塊の割れ面：それぞれ少し傾いた平面
    let p = L.p + B.o + B.ta * (a - ac) + B.ty * (y - yc);
    // 折れた面：斜めの線から先は別の傾きで引っこむ（稜が立つ）
    if (B.split) {
      const x = (a - ac - B.split.u * (jb - ja) * 0.5) * Math.sign(B.split.s) + B.split.k * (y - yc);
      p -= Math.abs(B.split.s) * smax0(x, 0.08);
    }
    if (B.gone) p -= 0.5;
    // 角の丸み（風化で欠けて丸くなる）：縦の割れ目の両側と層の上下
    const bn = B.bev * (0.25 + 1.5 * (0.5 + 0.5 * simplex2(a * 0.9 + B.seed * 40, y * 1.1))) + 0.03;
    const ex = Math.min(a - ja, jb - a);
    const tx = clamp(1 - ex / Math.max(bn * 1.4, da * 1.5), 0, 1);
    p -= bn * (1 - Math.sqrt(1 - tx * tx));
    const bb = Math.max(0.07, bn * 0.55, dy * 1.3), bt = Math.max(0.06, bn * 1.25, dy * 1.3);
    const tb = clamp(1 - yb / bb, 0, 1), tt = clamp(1 - yt / bt, 0, 1);
    p -= bb * (1 - Math.sqrt(1 - tb * tb)) + bt * (1 - Math.sqrt(1 - tt * tt));
    // 層の境目の細い溝（下の層との隙間）
    if (!L.massive) p -= 0.2 * Math.exp(-yb / Math.max(0.11, dy * 1.6));
    // 開いた割れ目（V字の溝）
    for (let i = Math.max(0, bi - 1); i <= Math.min(J.length - 1, bi); i++) {
      const j = J[i];
      const x = Math.abs(a - j.a) / Math.max(j.w, da * 1.7);
      if (x < 1) p -= j.d * (1 - x) ** 1.6;
    }
    // 大きなうねりと割れ面の細かいざらつき
    // 縦に通る大きな張り出しと入り江（崖の線が平らな壁にならないように）
    p += 0.9 * fbm2(a0 / 6.5 + 13, y0 / 30, 2);
    p += 0.6 * fbm2(a0 / 9 + 3.1, y0 / 6.5 - 1.7, 3) + 0.14 * fbm2(a0 / 3 - 7, y0 / 2.6, 2) + 0.05 * fbm2(a / 0.75, y / 0.75, 2) + 0.02 * simplex2(a / 0.28, y / 0.3);
    return { p, L, B };
  };
  return { layers, layerAt, disp };
}

// 格子の面をつくる：vtx(c, k) が位置・ずれ・濡れ・色の種などを返す。くぼみの陰と角は格子のずれ量からぼかして求める
function buildFace(cols, rows, faceRows, vtx) {
  const n = cols * rows;
  const pos = new Float32Array(n * 3), shade = new Float32Array(n * 4), face = new Float32Array(n * 4), dArr = new Float32Array(n), vArr = new Float32Array(n);
  for (let c = 0; c < cols; c++) for (let k = 0; k < rows; k++) {
    const o = c * rows + k;
    const v = vtx(c, k);
    pos[o * 3] = v.x; pos[o * 3 + 1] = v.y; pos[o * 3 + 2] = v.z;
    dArr[o] = v.dc ?? v.d; vArr[o] = v.V ?? v.y;
    shade[o * 4 + 1] = clamp(v.wet, 0, 1); shade[o * 4 + 2] = v.tone; shade[o * 4 + 3] = clamp(v.mossy, 0, 1);
    face[o * 4] = v.A; face[o * 4 + 1] = v.bs; face[o * 4 + 3] = v.soft;
  }
  // 箱のぼかし（累積和）：半径 rc 列 × rk 行
  const blur = (rc, rk) => {
    const S = new Float64Array((cols + 1) * (faceRows + 1));
    const W = faceRows + 1;
    for (let c = 0; c < cols; c++) for (let k = 0; k < faceRows; k++) S[(c + 1) * W + k + 1] = dArr[c * rows + k] + S[c * W + k + 1] + S[(c + 1) * W + k] - S[c * W + k];
    const out = new Float32Array(n);
    for (let c = 0; c < cols; c++) for (let k = 0; k < rows; k++) {
      const kk = Math.min(k, faceRows - 1);
      const c0 = Math.max(0, c - rc), c1 = Math.min(cols - 1, c + rc), k0 = Math.max(0, kk - rk), k1 = Math.min(faceRows - 1, kk + rk);
      const s = S[(c1 + 1) * W + k1 + 1] - S[c0 * W + k1 + 1] - S[(c1 + 1) * W + k0] + S[c0 * W + k0];
      out[c * rows + k] = s / ((c1 - c0 + 1) * (k1 - k0 + 1));
    }
    return out;
  };
  const bBig = blur(8, 9), bSmall = blur(2, 2);
  for (let c = 0; c < cols; c++) {
    // 張り出しの下：上 1m 以内でいちばん出ている量
    for (let k = 0; k < rows; k++) {
      const o = c * rows + k;
      const rel = dArr[o] - bBig[o];
      let cav = clamp(0.64 + rel * 1.5, 0, 1);
      if (k < faceRows) {
        let above = -9;
        for (let dk = 1; dk <= 11 && k + dk < faceRows; dk++) above = Math.max(above, dArr[c * rows + k + dk] - dk * 0.04);
        if (above > dArr[o] + 0.06) cav *= 1 - Math.min(0.5, (above - dArr[o]) * 0.8);
      }
      shade[o * 4] = cav;
      face[o * 4 + 2] = clamp((dArr[o] - bSmall[o]) * 7, -1, 1);
    }
  }
  const idx = new Uint32Array((cols - 1) * (rows - 1) * 6);
  let t = 0;
  // 端に畳んだ行どうしの面積のない三角形は入れない（使わない頂点は描かれないので軽くなる）
  const same = (i, j) => Math.abs(pos[i * 3] - pos[j * 3]) + Math.abs(pos[i * 3 + 1] - pos[j * 3 + 1]) + Math.abs(pos[i * 3 + 2] - pos[j * 3 + 2]) < 1e-5;
  for (let c = 0; c < cols - 1; c++) for (let k = 0; k < rows - 1; k++) {
    const a0 = c * rows + k, a1 = a0 + 1, b0 = a0 + rows, b1 = b0 + 1;
    const sa = same(a0, a1), sb = same(b0, b1);
    if (!sa && !same(a0, b0) && !same(a1, b0)) { idx[t++] = a0; idx[t++] = b0; idx[t++] = a1; }
    if (!sb && !same(a1, b0) && !same(a1, b1)) { idx[t++] = a1; idx[t++] = b0; idx[t++] = b1; }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aShade', new THREE.BufferAttribute(shade, 4));
  g.setAttribute('aFace', new THREE.BufferAttribute(face, 4));
  g.setAttribute('aV', new THREE.BufferAttribute(vArr, 1));
  g.setIndex(new THREE.BufferAttribute(idx.slice(0, t), 1));
  g.computeVertexNormals();
  mergeStacks(g, cols, rows);
  return g;
}

// 列の端に畳んだ行（同じ位置に重なった頂点）は法線を分け合う（細い三角形の向きだけを拾って黒い筋にならない）
function mergeStacks(g, cols, rows) {
  const P = g.attributes.position.array, Nn = g.attributes.normal.array;
  for (let c = 0; c < cols; c++) {
    let k0 = 0;
    for (let k = 1; k <= rows; k++) {
      const a = (c * rows + k0) * 3, b = (c * rows + k) * 3;
      if (k < rows && Math.abs(P[a] - P[b]) + Math.abs(P[a + 1] - P[b + 1]) + Math.abs(P[a + 2] - P[b + 2]) < 1e-4) continue;
      if (k - k0 > 1) {
        let x = 0, y = 0, z = 0;
        for (let j = k0; j < k; j++) { const o = (c * rows + j) * 3; x += Nn[o]; y += Nn[o + 1]; z += Nn[o + 2]; }
        const l = Math.hypot(x, y, z) || 1;
        for (let j = k0; j < k; j++) { const o = (c * rows + j) * 3; Nn[o] = x / l; Nn[o + 1] = y / l; Nn[o + 2] = z / l; }
      }
      k0 = k;
    }
  }
  g.attributes.normal.needsUpdate = true;
}

// 面の向き：out（外＝谷の中の側）を向くようにそろえる
function orient(g, cols, rows, faceRows, outX, outZ) {
  const nrm = g.attributes.normal, pos = g.attributes.position;
  const mid = Math.floor(cols / 2) * rows + Math.floor(faceRows / 2);
  const toOut = [outX - pos.getX(mid), outZ - pos.getZ(mid)];
  if (nrm.getX(mid) * toOut[0] + nrm.getZ(mid) * toOut[1] < 0) {
    const idx = g.index.array;
    for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; }
    g.index.needsUpdate = true;
    g.computeVertexNormals();
    mergeStacks(g, cols, rows);
  }
  g.computeBoundingSphere();
}

export function buildCliff(shared, world) {
  const tStart = performance.now();
  const G = world.gorge;
  const { N: NW, CELL, ORIGIN, height: HW } = world;
  const hAt = (x, z) => {
    const fi = clamp((x - ORIGIN) / CELL, 0, NW - 1.001), fj = clamp((z - ORIGIN) / CELL, 0, NW - 1.001);
    const i = Math.floor(fi), j = Math.floor(fj), u = fi - i, v = fj - j, k = j * NW + i;
    return lerp(lerp(HW[k], HW[k + 1], u), lerp(HW[k + NW], HW[k + NW + 1], u), v);
  };
  // 地形の描き方（terrain.js の区画：対角線の向きが市松に交互）と同じ三角形の高さ
  const hTri = (x, z) => {
    const fi = clamp((x - ORIGIN) / CELL, 0, NW - 1.001), fj = clamp((z - ORIGIN) / CELL, 0, NW - 1.001);
    const i = Math.floor(fi), j = Math.floor(fj), u = fi - i, v = fj - j, k = j * NW + i;
    const ha = HW[k], hb = HW[k + 1], hc = HW[k + NW], hd = HW[k + NW + 1];
    if ((i + j) & 1) return u + v <= 1 ? ha + (hb - ha) * u + (hc - ha) * v : hd + (hc - hd) * (1 - u) + (hb - hd) * (1 - v);
    return u >= v ? ha + (hb - ha) * u + (hd - hb) * v : ha + (hc - ha) * v + (hd - hc) * u;
  };
  const r = mulberry32(90210);
  // 地層は滝の崖と谷の両側の壁で共通（横の位置 A を角でつなぐので、層の線が角を回って続く）
  const S = makeStrata(r, G.poolLevel - 14, G.lipH + 6, -62, 62);
  const aLip = gorgeWorldInv(G.lip);
  // 上の縁の岩の頭：丸いこぶにせず、突き出した高さの層の下の境目で平らに切る（層の段がそのまま縁の段になる）
  const cragTop = (A, yTop, crag) => {
    if (crag < 0.05) return yTop + crag;
    const yc = yTop + crag, w = 0.035 * A + 0.5 * simplex2(A / 8 + 11, 0.3);
    const L = S.layerAt(yc + w);
    return Math.max(yTop + 0.06, L.y0 - w + 0.02);
  };
  // 滝の水が通るところ：崖の線からどれだけ手前か（高さごと。泡の抜け道として少し余裕を持つ）
  const H = G.lipH - G.poolLevel;
  // 面の基準線：崖の線をならしたもの（細かい凸凹のままだと、外へずらした面が自分と交差して裏返る）
  const lineS = (a) => { let sum = 0, w = 0; for (let e = -4; e <= 4; e += 0.25) { const k = Math.exp(-(e * e) / (2 * 1.8 * 1.8)); sum += cliffLine(a + e) * k; w += k; } return sum / w; };
  const sLine0 = lineS(aLip);
  const sLip = GORGE.sCliff - 0.3, sImp = GORGE.sPool + 3.8;
  const curtainD = (y) => {
    const f = clamp((G.lipH - y) / H, 0, 1);         // 落ちた割合
    const s = sLip - (sLip - sImp) * Math.sqrt(f);   // 放物線：横は時間に比例、落ちた高さは時間の2乗
    return sLine0 - s - 0.7;                          // これより奥（崖の線の側）に岩を置く
  };
  const seeps = Array.from({ length: 13 }, () => ({ a: (r() - 0.5) * 38, y: G.poolLevel + 3 + r() * (H - 3), w: 0.2 + r() * 0.45 }));
  const wetAt = (a, y, wf) => {
    // しぶきの届く範囲：滝のすぐ横は上まで、下の方は横へ広く
    const spray = Math.exp(-(((a - aLip) / (3.0 + 4.5 * smoothstep(G.poolLevel + 9, G.poolLevel, y))) ** 2)) * smoothstep(G.poolLevel + 12, G.poolLevel + 1, y);
    let wet = wf * 0.8 * (0.45 + 0.55 * smoothstep(G.lipH, G.poolLevel, y)) + 0.6 * spray + 0.85 * smoothstep(G.poolLevel + 1.0, G.poolLevel - 0.2, y);
    for (const sp of seeps) if (y < sp.y) wet += 0.6 * Math.exp(-(((a - sp.a) / sp.w) ** 2)) * smoothstep(0, 1.2, sp.y - y) * (0.6 + 0.4 * simplex2(a * 3, y * 0.4));
    return wet;
  };
  // 谷の床の半幅と岩の帯の高さ（gen.js の floorHalfW・carveGorge と同じ式）
  const fW = (s) => lerp(8.6 + 1.8 * Math.sin(s / 9.0) + 1.1 * Math.sin(s / 3.7 + 1.3), 14.8, smoothstep(376, 395, s));

  const group = new THREE.Group();
  const mat = new THREE.ShaderMaterial({ uniforms: { ...shared }, vertexShader: CVS, fragmentShader: CFS });
  const depthMat = new THREE.ShaderMaterial({ uniforms: { ...shared }, vertexShader: CVS, fragmentShader: CFS, defines: { DEPTH: '' } });
  const faces = [];   // 面ごとの列の情報とずれ（岩が面に埋まっていないかを見るため）
  const plantP = [], plantR = [];
  const pr = mulberry32(777);

  // 岩の面をひとつつくる。列 c は基準線上の点 (s0, a0) と外向き (nS, nA)（谷の座標）。行は下から上へ。
  // shape(C, v, y, D, dT, dTs) が基準線からのずれ d を返す（dT は地形の坂の位置、dTs はそれをならしたもの）
  const wall = ({ cols, dy, col, shape, dBack, dFront, out, wetOf, mossOf, plantOK, sig, da }) => {
    const colInfo = [];
    for (let c = 0; c < cols; c++) colInfo.push(col(c));
    // 上下の端は列の間でならす（となりの列と行の高さが大きくずれると、層の段が斜めに切られてのこぎりの歯になる）
    {
      const R = Math.ceil(sig * 2.5), yT = colInfo.map((C) => C.yTop), yB = colInfo.map((C) => C.yBot);
      for (let c = 0; c < cols; c++) {
        let st = 0, sb = 0, w = 0;
        for (let e = -R; e <= R; e++) { const cc = clamp(c + e, 0, cols - 1), k = Math.exp(-(e * e) / (2 * sig * sig)); st += yT[cc] * k; sb += yB[cc] * k; w += k; }
        colInfo[c].yTop = st / w; colInfo[c].yBot = Math.min(sb / w, colInfo[c].yTop - 0.6);
      }
    }
    // 行は全部の列で同じ高さにそろえる（列ごとに上下の端で割ると行が傾き、水平な層の段が格子を斜めに横切ってぎざぎざになる）
    // 列の上下の端より外の行は端に畳む（面積のない三角形になるだけ）
    let Y0 = 1e9, Y1 = -1e9;
    for (const C of colInfo) { Y0 = Math.min(Y0, C.yBot); Y1 = Math.max(Y1, C.yTop); }
    const NV = Math.min(700, Math.ceil((Y1 - Y0) / dy) + 1), dyG = (Y1 - Y0) / (NV - 1);
    const rowY = (C, k) => clamp(Y0 + k * dyG, C.yBot, C.yTop);
    const rows = NV + 4;
    // 地形の坂がどこまで手前に出ているか：列ごと・高さごとに、地形がその高さ以上になるいちばん外側。となりの列へ広げて、のこぎりの歯をならす
    const dStep = 0.1, DM = Math.round((dBack + dFront) / dStep) + 1, dStart = -dBack;
    const dT = new Float32Array(cols * NV);
    const under = new Uint8Array(cols * NV);   // 床より下（手前の端まで地形の方が高い）
    const Sfx = new Float32Array(DM);
    for (let c = 0; c < cols; c++) {
      const C = colInfo[c];
      for (let i = 0; i < DM; i++) {
        const dd = dStart + i * dStep;
        const [x, z] = gorgeWorld(C.s0 + C.nS * dd, C.a0 + C.nA * dd);
        Sfx[i] = hTri(x, z);
      }
      for (let i = DM - 2; i >= 0; i--) Sfx[i] = Math.max(Sfx[i], Sfx[i + 1]);
      for (let k = 0; k < NV; k++) {
        const y = rowY(C, k);
        let lo = 0, hi = DM - 1;
        if (Sfx[DM - 1] >= y) { dT[c * NV + k] = dStart + (DM - 1) * dStep; under[c * NV + k] = 1; continue; }   // 床より下
        if (Sfx[0] < y) { dT[c * NV + k] = NaN; continue; }   // 地形より上
        while (lo < hi) { const m = (lo + hi + 1) >> 1; if (Sfx[m] >= y) lo = m; else hi = m - 1; }
        // 標本のあいだは直線で補う（0.1m 刻みのままだと面が等高線の段になる）
        const f = lo < DM - 1 ? clamp((Sfx[lo] - y) / Math.max(1e-4, Sfx[lo] - Sfx[lo + 1]), 0, 1) : 0;
        dT[c * NV + k] = dStart + (lo + f) * dStep;
      }
      // 地形より上は、いちばん近い高さの値で埋める。床より下は、床の縁（いちばん下で坂を切るところ）からまっすぐ下へ
      let kl = -1, kf = -1;
      for (let k = 0; k < NV; k++) if (!Number.isNaN(dT[c * NV + k]) && !under[c * NV + k]) { if (kf < 0) kf = k; kl = k; }
      for (let k = 0; k < NV; k++) {
        if (Number.isNaN(dT[c * NV + k])) dT[c * NV + k] = kl >= 0 ? dT[c * NV + kl] : dStart;
        else if (under[c * NV + k] && kf >= 0) dT[c * NV + k] = dT[c * NV + kf];
      }
    }
    const dTw = new Float32Array(cols * NV);
    for (let c = 0; c < cols; c++) for (let k = 0; k < NV; k++) {
      let m = -99;
      for (let e = -7; e <= 7; e++) { const cc = c + e; if (cc >= 0 && cc < cols) m = Math.max(m, dT[cc * NV + k]); }
      dTw[c * NV + k] = m;
    }
    // ならした坂の位置（面の土台。坂の格子の凸凹を拾わない）
    const dTs = new Float32Array(cols * NV);
    {
      const RC = 14, RK = Math.max(4, Math.round(0.5 / dyG));
      const tmp = new Float32Array(cols * NV);
      for (let k = 0; k < NV; k++) {
        let s = 0, n = 0;
        for (let c = -RC; c < cols + RC; c++) {
          const ca = c + RC, cr = c - RC - 1;
          if (ca < cols && ca >= 0) { s += dTw[ca * NV + k]; n++; }
          if (cr >= 0 && cr < cols) { s -= dTw[cr * NV + k]; n--; }
          if (c >= 0 && c < cols) tmp[c * NV + k] = s / Math.max(1, n);
        }
      }
      for (let c = 0; c < cols; c++) {
        let s = 0, n = 0;
        for (let k = -RK; k < NV + RK; k++) {
          const ka = k + RK, kr = k - RK - 1;
          if (ka < NV && ka >= 0) { s += tmp[c * NV + ka]; n++; }
          if (kr >= 0 && kr < NV) { s -= tmp[c * NV + kr]; n--; }
          if (k >= 0 && k < NV) dTs[c * NV + k] = s / Math.max(1, n);
        }
      }
    }
    const D = new Float32Array(cols * NV), E = new Float32Array(cols * NV);
    let yTopC = 0;   // この列の最上段の高さ
    const g = buildFace(cols, rows, NV, (c, k) => {
      const C = colInfo[c];
      let y, d, L = null, B = null, V, dc;
      if (k < NV) {
        y = rowY(C, k);
        const v = (y - C.yBot) / Math.max(1e-3, C.yTop - C.yBot);
        const Dd = S.disp(C.A, y, dyG, da);
        L = Dd.L; B = Dd.B;
        lastE = 0; lastFull = NaN;
        d = shape(C, v, y, Dd, dTw[c * NV + k], dTs[c * NV + k], under[c * NV + k], dT[c * NV + k]);
        D[c * NV + k] = d; E[c * NV + k] = lastE;
        dc = Number.isNaN(lastFull) ? d : lastFull;   // くぼみの陰は出きったときの形で見る（出かけの端が深い穴として黒くならない）
        // まだ地形の中にある所は、その場の地面より上へ出さない（端で縦に切れた面が地面から突き出さない）
        // まず奥（坂の中）へ押しこんで地面に隠す。高さを下げると、上の層との間に下を向いた細い黒い三角ができる
        if (lastE < 1) {
          const [xc, zc] = gorgeWorld(C.s0 + C.nS * d, C.a0 + C.nA * d);
          if (hTri(xc, zc) - 0.08 < y) {
            let dd = d, ok = false;
            for (let j = 1; j <= 30; j++) {
              dd = d - j * 0.1;
              const [xj, zj] = gorgeWorld(C.s0 + C.nS * dd, C.a0 + C.nA * dd);
              if (hTri(xj, zj) - 0.08 >= y) { ok = true; break; }
            }
            const w = smoothstep(0.35, 1, lastE);
            if (ok) d = lerp(dd, d, w);
            else y = lerp(Math.min(y, hTri(xc, zc) - 0.08), y, w);
          }
          D[c * NV + k] = d;
        }
        if (k === NV - 1) yTopC = y;
      } else {
        // 上の縁から上の地面へ折り返す：最上段の実際の位置から奥へ数え、最後の行は坂の前（地形の中）まで入れる
        const q = k - NV + 1;
        const top = c * NV + NV - 1;
        const d4 = Math.min(D[top] - 2.3, dTw[top] - 0.5);
        d = D[top] - [0.065, 0.26, 0.57, 1][q - 1] * (D[top] - d4);
        const [xq, zq] = gorgeWorld(C.s0 + C.nS * d, C.a0 + C.nA * d);
        const hq = hAt(xq, zq);
        if (q < 4) {
          // 縁の真後ろで地形がまだ坂の途中なら、奥の地面の高さへつなぐ。縁から急に落とさない
          y = Math.min(yTopC - 0.05 * q, Math.max(hq, C.hBack - 0.1 * q) + 0.08 - 0.04 * q);
          y = Math.max(y, yTopC - (0.25 + 0.35 * q));
        } else y = Math.min(yTopC - 0.3, hq - 0.15);
        // 面が地形の中に隠れている列は、折り返しも地面の下へ（地面の上に帯が残らないように）
        y = lerp(y, Math.min(y, hq - 0.3), smoothstep(-0.05, -0.4, D[top] - dT[top]));
        V = yTopC + (D[top] - d) + (yTopC - y);
        L = S.layerAt(y);
      }
      const [x, z] = gorgeWorld(C.s0 + C.nS * d, C.a0 + C.nA * d);
      return { x, y, z, d, dc, V, A: C.A, bs: B ? B.seed : 0.5, soft: L.soft ? 1 : 0, tone: L.tone, wet: wetOf(C, y), mossy: mossOf(C, y) };
    });
    orient(g, cols, rows, NV, out[0], out[1]);
    // 棚（上を向いた面）に草とシダの株を置く
    const posA = g.attributes.position, nA = g.attributes.normal, sh = g.attributes.aShade;
    for (let c = 2; c < cols - 2; c++) for (let k = 2; k < NV - 1; k++) {
      const o = c * rows + k;
      const ny = nA.getY(o);
      if (ny < 0.45) continue;
      const C = colInfo[c];
      if (!plantOK(C) || E[c * NV + k] < 0.95) continue;
      if (rowY(C, k) - rowY(C, k - 1) < 1e-4) continue;   // 端に畳んだ行
      // 根元が地面より下の株（地形に隠れた面の上）は置かない
      if (posA.getY(o) - 0.03 < hAt(posA.getX(o), posA.getZ(o)) - 0.02) continue;
      const pchance = (ny - 0.45) * 0.22 * (0.6 + 0.8 * sh.getW(o)) * (rowY(C, k) > C.yTop - 0.8 ? 2.0 : 1) * (C.plantMul ?? 1);
      if (pr() > pchance) continue;
      // 外向き（谷の座標の外向きをワールドへ）
      let dx = C.nA, dz = -C.nS; const dl = Math.hypot(dx, dz) || 1; dx /= dl; dz /= dl;
      plantP.push(posA.getX(o), posA.getY(o) - 0.03, posA.getZ(o), 0.35 + pr() * pr() * 1.1);
      plantR.push(pr() * 6.283, dx, dz, pr());
    }
    const m = new THREE.Mesh(g, mat);
    m.userData.depthMaterial = depthMat;
    group.add(m);
    faces.push({ colInfo, D, NV, cols, Y0, dyG });
    return { colInfo, D };
  };

  // ---- 滝の崖 ----
  const A0 = -21.5, A1 = 21.5, DA = 0.1;
  wall({
    cols: Math.round((A1 - A0) / DA) + 1, dy: 0.07, dBack: 1.5, dFront: 3.0, sig: 2, da: DA,
    col: (c) => {
      const a = A0 + c * DA;
      const s0 = lineS(a);
      const sd = (lineS(a + 0.1) - lineS(a - 0.1)) / 0.2;
      const len = Math.hypot(1, sd);
      const [xt, zt] = gorgeWorld(s0 + 2.4, a);
      const yTop = hAt(xt, zt);
      const [xb, zb] = gorgeWorld(s0 - 2.6, a);
      let yBot = Math.max(hAt(xb, zb) - 0.9, G.poolLevel - 1.6);
      const hide = smoothstep(0.6, 2.2, yTop - yBot);
      if (yTop - yBot < 0.6) yBot = yTop - 0.6;
      const wf = Math.exp(-(((a - aLip) / 3.3) ** 2));
      // 上の縁は平らに切らず、岩の頭がところどころ地面より上へ突き出す（滝口のまわりは低く）
      const crag = Math.max(0, 1.5 * fbm2(a / 4.5 + 2.2, 0.7, 3) + 0.35) * (1 - smoothstep(0.1, 0.5, wf)) * hide;
      return { a, A: a, s0, a0: a, nS: -1 / len, nA: sd / len, yTop: cragTop(a, yTop, crag), hBack: yTop, yBot, hide, wf };
    },
    shape: (C, v, y, D, dTw, dTs, und, dT0) => {
      const a = C.a;
      // 地形の坂より必ず手前：下で約2m、上で0.5m
      let d = 2.0 - 1.2 * v + (0.3 + Math.max(-0.7, D.p)) * (1 - 0.55 * C.wf);
      // 滝の裏：落ちる水より奥へえぐる（下ほど深い）
      d = lerp(d, Math.min(d, curtainD(y)), C.wf);
      // てっぺんの角はほんの少しだけ丸める（上は平らな岩の肩→地面）
      d = lerp(d, Math.max(0.2, d - 0.25), smoothstep(0.975, 1.0, v));
      d = smax(d, dTw + 0.3, 0.2);
      // 両端は層ごとにずれて、谷の壁の岩の奥（地形の中）へ入る
      const edge = smoothstep(0, 2.0, Math.min(a - (A0 + D.L.e0 * 0.55), (A1 - D.L.e1 * 0.55) - a)) * C.hide;
      // 地形の中・皮は、その列の実際の地形より必ず奥（ならした坂が角ばった地形より手前に出て板に見えないように）
      return emerge(Math.max(Math.min(dTw, dT0), -1.5) - 0.7, Math.min(dTs, dT0) - 0.08, d, edge);
    },
    out: gorgeWorld(cliffLine(0) - 5, 0),
    wetOf: (C, y) => wetAt(C.a, y, C.wf),
    mossOf: (C, y) => 0.35 + C.wf * 0.4 + 0.25 * smoothstep(G.poolLevel + 5, G.poolLevel, y) + 0.12 * smoothstep(C.yTop - 2.5, C.yTop, y),
    plantOK: (C) => C.wf <= 0.35 && C.hide >= 0.9,
  });

  // ---- 谷の両側の壁：滝の崖の端から下流へ、床の縁の急な坂にだけ岩の帯をかぶせる（坂がゆるくなるところで地面に埋もれる） ----
  // 横の位置 A は崖の端の a から続けて数える（層・割れ目が角を回って続く）
  const DS = 0.15, sA = 352;
  const wallHide = {};   // 側ごと：s → 岩の帯の出かた（足元の岩を置くところ）
  for (const side of [-1, 1]) {
    const aJ = 17.4;
    const sB = lineS(side * aJ) - 0.4;           // 滝の崖の面の奥で止める
    const cols = Math.round((sB - sA) / DS) + 1;
    // 列ごとに、床の縁から外へ地形をなめて急な坂（45°より急）の下端と上端を探す
    const aL = new Float32Array(cols), yB = new Float32Array(cols), yT = new Float32Array(cols);
    for (let c = 0; c < cols; c++) {
      const s = sA + c * DS;
      const W = fW(s);
      const hs = [];
      for (let i = 0; i <= 72; i++) { const [x, z] = gorgeWorld(s, side * (W - 3 + i * 0.25)); hs.push(hTri(x, z)); }
      const sl = (i) => (hs[i + 1] - hs[i]) / 0.25;
      let i0 = -1, i1 = -1, gap = 0;
      for (let i = 0; i < 72; i++) {
        if (sl(i) > 1.25) { if (i0 < 0) i0 = i; i1 = i + 1; gap = 0; }
        else if (i0 >= 0 && ++gap > 4) break;
      }
      if (i0 < 0) { aL[c] = W + 1.5; yB[c] = hs[12]; yT[c] = hs[12]; continue; }
      aL[c] = W - 3 + (i0 + i1) * 0.125;
      yB[c] = hs[i0]; yT[c] = hs[i1];
    }
    // なめらかに（列ごとのばらつきで面がねじれないように）
    // R は 0.12m 刻みのときの列数（刻みが変わっても同じ幅でならす）
    const smooth = (A, R0) => { const R = Math.max(2, Math.round(R0 * 0.12 / DS)); const o = new Float32Array(cols); for (let c = 0; c < cols; c++) { let sm = 0, w = 0; for (let e = -R; e <= R; e++) { const cc = c + e; if (cc < 0 || cc >= cols) continue; const k = Math.exp(-(e * e) / (0.5 * R * R)); sm += A[cc] * k; w += k; } o[c] = sm / w; } return o; };
    const aLs = smooth(aL, 22), yBs = smooth(yB, 16), yTs = smooth(yT, 25);
    // 列ごとの形（面の向き・上下の端・地形の高さの幅）と岩の帯の出かた
    const pre = [];
    const hideR = new Float32Array(cols);
    for (let c = 0; c < cols; c++) {
      const s = sA + c * DS;
      const a0 = side * aLs[c];
      const g = side * (aLs[Math.min(cols - 1, c + 1)] - aLs[Math.max(0, c - 1)]) / ((Math.min(cols - 1, c + 1) - Math.max(0, c - 1)) * DS);
      const len = Math.hypot(1, g);
      const nS = side * g / len, nA = -side / len;
      const yBot = yBs[c] - 0.9;
      let hmax = -1e9, hmin = 1e9;
      for (let dd = -8; dd <= 3.2; dd += 0.4) { const [x, z] = gorgeWorld(s + nS * dd, a0 + nA * dd); const h = hTri(x, z); hmax = Math.max(hmax, h); hmin = Math.min(hmin, h); }
      // 面のてっぺんは、この列の地形のいちばん高いところより上へ出さない
      const yTop = Math.min(yTs[c] + 0.2, hmax - 0.15);
      hideR[c] = smoothstep(3.5, 6.5, yTop - yBot);
      pre.push({ s, a0, nS, nA, yBot, yTop, hmin });
    }
    // 出かたは s 方向に ±5m ほどならす（数列で埋もれた状態から全部出た状態へ跳ばない。岩の帯が数mかけて地面から出てくる）
    const hideS = new Float32Array(cols);
    {
      const R = Math.round(6 / DS), sg = 2.6 / DS;
      for (let c = 0; c < cols; c++) {
        let sm = 0, w = 0;
        for (let e = -R; e <= R; e++) { const cc = c + e; const k = Math.exp(-(e * e) / (2 * sg * sg)); sm += (cc < 0 || cc >= cols ? hideR[clamp(cc, 0, cols - 1)] : hideR[cc]) * k; w += k; }
        hideS[c] = sm / w;
      }
    }
    wallHide[side] = (s) => hideS[clamp(Math.round((s - sA) / DS), 0, cols - 1)];
    const sp = Array.from({ length: 9 }, () => ({ s: sA + 6 + r() * (sB - sA - 8), y: 0.4 + r() * 0.5, w: 0.25 + r() * 0.5 }));
    wall({
      cols, dy: 0.08, dBack: 8.0, dFront: 3.2, sig: 3, da: DS,
      col: (c) => {
        const P = pre[c], hide = hideS[c];
        const { s, a0, nS, nA } = P;
        // 岩の帯のない列は床より下にしまい、出かたに合わせて上の端を床から少しずつ上げる
        const f = smoothstep(0, 0.7, hide);
        const hBack = lerp(P.hmin - 0.5, P.yTop, f);
        const crag = Math.max(0, 0.9 * fbm2(s / 4.2 + side * 9.1, 2.3, 3) + 0.1) * hide;
        const yBot = Math.min(P.yBot, hBack - 0.6);
        const A = side * (aJ + (sB - s));
        return { s, A, s0: s, a0, nS, nA, yTop: cragTop(A, hBack, crag), hBack, yBot, hide, wf: 0, plantMul: 0.4, sp };
      },
      shape: (C, v, y, D, dTw, dTs, und, dT0) => {
        // 床より下（ゆるい地面の高さ）は地面の中へ：面が地面を這う板にならない
        if (und) return Math.min(dTw, dT0) + 0.35;
        // 土台はならした坂の位置。その上に岩塊の出入り（下の方ほど前へ張り出す）
        let d = dTs + 0.7 - 0.3 * v + (0.2 + Math.max(-0.6, D.p)) * 1.15;
        d = lerp(d, Math.max(dTs + 0.15, d - 0.25), smoothstep(0.975, 1.0, v));
        d = smax(d, dTw + 0.3, 0.2);
        // 下の縁は坂の中へ入れる（急な帯が坂の途中から始まるところで、面の下側が宙に浮かないように）
        d = lerp(d, dTw - 0.6, smoothstep(0.1, 0.0, v));
        // 下流の端は層ごとにずれて地形の中へ（岩の帯が斜面に埋もれて終わる）
        const e = smoothstep(0, 5, C.s - (sA + D.L.e0 * 2.2)) * C.hide;
        return emerge(Math.min(dTw, dT0) - 0.8, Math.min(dTs, dT0) - 0.08, d, e);
      },
      out: gorgeWorld((sA + sB) / 2, 0),
      wetOf: (C, y) => {
        let w = 0.7 * smoothstep(C.yBot + 1.6, C.yBot + 0.4, y);
        for (const q of C.sp) { const yq = C.yBot + q.y * (C.yTop - C.yBot); if (y < yq) w += 0.55 * Math.exp(-(((C.s - q.s) / q.w) ** 2)) * smoothstep(0, 1.2, yq - y); }
        return w;
      },
      mossOf: (C, y) => 0.28 + 0.3 * smoothstep(C.yBot + 4, C.yBot, y) + 0.15 * smoothstep(C.yTop - 3, C.yTop, y),
      plantOK: (C) => C.hide >= 0.9,
    });
  }

  if (plantP.length) {
    const pg = plantGeometry(7, 6);
    pg.setAttribute('iP', new THREE.InstancedBufferAttribute(new Float32Array(plantP), 4));
    pg.setAttribute('iR', new THREE.InstancedBufferAttribute(new Float32Array(plantR), 4));
    pg.instanceCount = plantP.length / 4;
    const pm = new THREE.ShaderMaterial({ uniforms: { ...shared }, vertexShader: PVS, fragmentShader: PFS, side: THREE.DoubleSide });
    const pdm = new THREE.ShaderMaterial({ uniforms: { ...shared }, vertexShader: PVS, fragmentShader: PFS, side: THREE.DoubleSide, defines: { DEPTH: '' } });
    const plants = new THREE.Mesh(pg, pm);
    plants.frustumCulled = false;
    plants.userData.depthMaterial = pdm;
    group.add(plants);
  }

  // 岩の面に埋まった岩（面の途中から宙に浮いて見える）を見分ける：岩の中心が面より奥で、床より十分上にある
  const buried = (q) => {
    const L = gorgeLocal(q.x, q.z);
    const yc = q.y + q.s * 0.3;
    for (const F of faces) {
      // いちばん近い列（基準線上の点）
      let best = -1, bd = 1e9;
      const n = F.cols;
      const step = Math.max(1, Math.floor(n / 60));
      for (let c = 0; c < n; c += step) { const C = F.colInfo[c]; const dd = (C.s0 - L.s) ** 2 + (C.a0 - L.a) ** 2; if (dd < bd) { bd = dd; best = c; } }
      for (let c = Math.max(0, best - step); c <= Math.min(n - 1, best + step); c++) { const C = F.colInfo[c]; const dd = (C.s0 - L.s) ** 2 + (C.a0 - L.a) ** 2; if (dd < bd) { bd = dd; best = c; } }
      const C = F.colInfo[best];
      if (bd > 36) continue;
      const along = (L.s - C.s0) * -C.nA + (L.a - C.a0) * C.nS;     // 基準線に沿った離れ
      if (Math.abs(along) > 0.6) continue;
      if (yc < C.yBot + 0.9 + 0.8 * q.s || yc > C.yTop) continue;
      if (q.y + 0.5 * q.s > C.hBack - 0.2) continue;   // 上の地面に載っている岩（滝口の脇など）は面の奥ではない
      const k = Math.round((yc - F.Y0) / F.dyG);
      const dF = F.D[best * F.NV + clamp(k, 0, F.NV - 1)];
      const dr = (L.s - C.s0) * C.nS + (L.a - C.a0) * C.nA;
      if (dr < dF + 0.25 * q.s) return true;
    }
    return false;
  };
  let nb = 0;
  for (const q of world.rocks) if (buried(q)) { q.buried = true; nb++; }

  // ---- 崖と壁の下のがれ（崩れて積もった角ばった石）と大きな落石 ----
  const rr = mulberry32(5150);
  const rk = [];
  const poolD = (x, z) => { const L = gorgeLocal(x, z); return Math.hypot(L.s - GORGE.sPool, L.a) - GORGE.poolR; };
  const put = (x, z, sz, o) => {
    const pd = poolD(x, z);
    if (pd < -1.0) return;
    const y = hAt(x, z);
    const q = { x, y: y - sz * (o.sink ?? 0.3), z, s: sz, rot: rr() * 6.283, tilt: (rr() - 0.5) * (o.tilt ?? 0.5), flat: o.flat ?? 0.68 + 0.3 * rr(),
      moss: o.moss ?? 0.3 + 0.45 * rr(), wet: Math.max(o.wet ?? 0, smoothstep(1.2, -0.6, pd)), kind: 1, vFix: o.v ?? (rr() < 0.7 ? 6 + Math.floor(rr() * 4) : 10 + Math.floor(rr() * 2)) };
    if (!buried(q)) rk.push(q); else nb++;
  };
  for (let a = -20; a < 20; a += 0.3 + rr() * 0.8) {
    if (Math.abs(a - aLip) < 3.4) continue;
    const e = rr();
    const sT = cliffLine(a) - 1.8 - Math.pow(e, 1.6) * 4.5;
    const [x, z] = gorgeWorld(sT, a + (rr() - 0.5) * 0.4);
    // 崖に近いほど大きく積もる
    put(x, z, (0.16 + Math.pow(rr(), 2.6) * 1.4) * (1.25 - 0.5 * e), { sink: 0.14 + 0.14 * rr() });
    if (rr() < 0.35) { const [x2, z2] = gorgeWorld(sT - 0.4 - rr(), a + (rr() - 0.5)); put(x2, z2, 0.1 + rr() * 0.22, { sink: 0.2 }); }
  }
  for (const side of [-1, 1]) {
    // 壁の足元：がれの帯と、ところどころ大きな落石（崖に近いほど多い）
    for (let s = sA + 3; s < lineS(side * 17) - 1; s += 0.35 + rr() * 0.9) {
      if (wallHide[side](s) < 0.5) { rr(); rr(); rr(); continue; }
      const W = fW(s);
      const e = rr();
      const a = side * (W + 0.8 - Math.pow(e, 1.5) * 3.2);
      const [x, z] = gorgeWorld(s, a);
      const near = smoothstep(sA, 396, s);
      put(x, z, (0.14 + Math.pow(rr(), 2.4) * (0.9 + 0.8 * near)) * (1.2 - 0.5 * e), { sink: 0.14 + 0.14 * rr(), moss: 0.45 + 0.45 * rr() });
      if (rr() < 0.08 + 0.1 * near) { const [x2, z2] = gorgeWorld(s + (rr() - 0.5) * 2, side * (W - 0.8 - rr() * 2.5)); put(x2, z2, 1.0 + rr() * 1.8, { sink: 0.22, moss: 0.55 + 0.4 * rr(), tilt: 0.6, v: 6 + Math.floor(rr() * 4) }); }
    }
  }
  const rocksG = buildRocks(shared, rk);
  group.add(rocksG);
  group.userData.rocks = rk;
  group.userData.faces = faces.map((F) => ({ NV: F.NV, cols: F.cols }));   // 確認用
  if (/[?&]dev/.test(location.search)) console.log(`cliff ${Math.round(performance.now() - tStart)}ms buried ${nb}`);
  return group;
}

// 滝口のワールド座標 → 谷の横の位置 a
function gorgeWorldInv(p) {
  const [x0] = gorgeWorld(GORGE.sCliff, 0);
  return p[0] - x0;
}
