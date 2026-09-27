// 岩：いくつもの割れ面で切った凸の塊（面は平らに近く、稜は欠けて丸い）に、割れ面のざらつき・風化のくぼみを刻んだ形を数種類つくり、
// 置き場所ごとに回して並べる。近くは細かい形、遠くは粗い形（毎フレーム、視点からの距離で振り分ける）。
// 肌：粒と斑晶・細い割れ・角の風化（明るい）・くぼみの土・地衣の斑・上面の苔。水面の下と水際は濡れて暗く光る
import * as THREE from 'three';
import { ALL, SHADOW } from './glsl.js';
import { SKY_GLSL } from './sky.js';
import { simplex3, mulberry32 } from '../util/noise.js';

const RVS = /* glsl */ `
${ALL}
${SHADOW}
attribute vec4 iPos;   // xyz, 大きさ
attribute vec4 iRot;   // 向き, 傾き, 平たさ, 種
attribute vec4 iMat;   // 苔, 濡れ, 岩の種類(0=花崗岩 1=安山岩), 色の種
attribute vec2 aCurv;  // x=稜(+)・くぼみ(-) y=まわりに遮られる割合
varying vec3 vN;
varying vec3 vWorld;
varying vec3 vObj;
varying vec4 vMat;
varying vec3 vCurv;    // x=稜 y=遮り z=地面からの高さ（物体の中の割合）
void main() {
  float c = cos(iRot.x), s = sin(iRot.x);
  float ct = cos(iRot.y), st = sin(iRot.y);
  vec3 p = position * vec3(1.0, iRot.z, 1.0);
  vec3 n = normal * vec3(1.0, 1.0 / max(iRot.z, 0.2), 1.0);
  n = dot(n, n) > 1e-12 ? normalize(n) : vec3(0.0, 1.0, 0.0);
  // 傾き（x軸まわり）→ 向き（y軸まわり）
  p = vec3(p.x, p.y * ct - p.z * st, p.y * st + p.z * ct);
  n = vec3(n.x, n.y * ct - n.z * st, n.y * st + n.z * ct);
  p = vec3(p.x * c + p.z * s, p.y, -p.x * s + p.z * c);
  n = vec3(n.x * c + n.z * s, n.y, -n.x * s + n.z * c);
  vec3 wp = iPos.xyz + p * iPos.w;
  vN = n;
  vWorld = wp;
  vObj = position * iPos.w + iRot.w * 17.0;
  vMat = iMat;
  vCurv = vec3(aCurv, position.y + 0.5);
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
}
`;
const RFS = /* glsl */ `
${ALL}
${SHADOW}
${SKY_GLSL}
varying vec3 vN;
varying vec3 vWorld;
varying vec3 vObj;
varying vec4 vMat;
varying vec3 vCurv;
float tri3(vec3 p, vec3 w, float sc, int ch) {
  vec4 a = texture(tNoise, p.zy * sc), b = texture(tNoise, p.xz * sc), c = texture(tNoise, p.xy * sc);
  return (ch == 0 ? a.r : ch == 1 ? a.g : ch == 2 ? a.b : a.a) * w.x + (ch == 0 ? b.r : ch == 1 ? b.g : ch == 2 ? b.b : b.a) * w.y + (ch == 0 ? c.r : ch == 1 ? c.g : ch == 2 ? c.b : c.a) * w.z;
}
void main() {
#ifdef DEPTH
  gl_FragColor = vec4(1.0);
#else
  vec3 wp = vWorld;
  vec3 N = dot(vN, vN) > 1e-10 ? normalize(vN) : vec3(0.0, 1.0, 0.0);
  vec3 an = abs(N); an = an * an * an * an; an /= max(an.x + an.y + an.z, 1e-5);
  vec3 q = vObj;
  float dist = length(cameraPosition - wp);
  float fFine = 1.0 - smoothstep(6.0, 30.0, dist);
  float fSpeck = 1.0 - smoothstep(2.5, 10.0, dist);
  float moss0 = vMat.x, wet0 = vMat.y, kind = vMat.z, rs = vMat.w;
  float edge = vCurv.x, occ = vCurv.y, hy = vCurv.z;
  // ---- 肌 ----
  float big = tri3(q, an, 0.09, 1);
  float mid = tri3(q, an, 0.45, 0);
  float fine = tri3(q, an, 1.6, 0);
  float grain = tri3(q, an, 5.5, 0);
  float speck = tri3(q, an, 0.9, 3);
  float strata = tri3(q * vec3(1.0, 6.0, 1.0), an, 0.16, 1);
  // 岩の種類：花崗岩（明るい灰に黒と白の粒）〜安山岩（暗い青灰、細かい）
  vec3 cG = mix(vec3(0.2, 0.198, 0.19), vec3(0.25, 0.235, 0.215), rs);
  vec3 cA = mix(vec3(0.135, 0.142, 0.148), vec3(0.19, 0.178, 0.162), rs);
  vec3 alb = mix(cG, cA, kind);
  alb *= (0.76 + 0.42 * big) * (0.84 + 0.3 * mid) * (0.86 + 0.26 * fine) * mix(1.0, 0.9 + 0.2 * strata, kind);
  alb *= mix(1.0, 0.82 + 0.36 * grain, fFine);
  // 粒：花崗岩は黒雲母（黒）と長石（白）、安山岩は白い斑晶
  float sp = smoothstep(0.86, 0.97, speck) * fSpeck;
  float spd = smoothstep(0.1, 0.02, speck) * fSpeck;
  alb = mix(alb, vec3(0.7, 0.68, 0.64), sp * 0.55);
  alb = mix(alb, vec3(0.05, 0.05, 0.05), spd * 0.5 * (1.0 - kind));
  // 細い割れ
  float cr = abs(tri3(q, an, 0.12, 0) - 0.5 + (fine - 0.5) * 0.04);
  float crack = (1.0 - smoothstep(0.0, 0.008 + dist * 0.0002, cr)) * smoothstep(0.6, 0.72, tri3(q, an, 0.07, 1)) * (1.0 - smoothstep(18.0, 60.0, dist));
  alb *= 1.0 - 0.4 * crack;
  // 角は風化して明るく、くぼみは土と影で暗い
  alb *= clamp(1.0 + 0.3 * edge, 0.72, 1.35);
  alb *= mix(0.6, 1.0, smoothstep(0.1, 0.8, occ));
  // 下は土がはねて茶色っぽく暗い
  float low = 1.0 - smoothstep(0.08, 0.32, hy);
  alb = mix(alb, alb * vec3(0.72, 0.64, 0.52), low * 0.7);
  // 地衣（乾いた面）：丸い斑。淡い灰緑、ときどき黄橙
  // 地衣は不揃いな縁の斑（大きな群れ＋小さな点）
  float lm = mid * 0.55 + fine * 0.3 + grain * 0.15 * fFine;
  float lich = smoothstep(0.64, 0.7, lm + (big - 0.5) * 0.3) * smoothstep(0.3, 0.6, big + 0.25 * N.y) * (1.0 - wet0) * smoothstep(0.25, 0.5, hy);
  lich = max(lich, smoothstep(0.93, 0.97, tri3(q, an, 2.1, 3)) * 0.6 * fFine * (1.0 - wet0));
  vec3 lc = mix(vec3(0.46, 0.49, 0.43), vec3(0.58, 0.46, 0.2), step(0.8, tri3(q, an, 0.05, 0)));
  alb = mix(alb, lc * (0.62 + 0.3 * grain), lich * 0.5);
  // 苔：上を向いた面から。縁は細かく途切れる
  float mossW = smoothstep(0.35, 0.8, N.y + (mid - 0.5) * 0.9 + (moss0 - 0.5) * 0.9 + (0.5 - occ) * 0.2 - 0.1) * moss0;
  mossW *= smoothstep(0.32, 0.62, fine + 0.3 * grain + 0.1);
  mossW = clamp(mossW * 1.5, 0.0, 1.0);
  vec3 mossC = mix(vec3(0.035, 0.065, 0.018), vec3(0.11, 0.17, 0.035), smoothstep(0.3, 0.8, fine * 0.5 + grain * 0.6));
  alb = mix(alb, mossC, mossW);
  // 水面の下・水際：濡れて暗い（水面の高さは世界の水面から）
  float wl = texelFetch(tHW, worldTexel(wp.xz), 0).g;
  float under = wl > -100.0 ? smoothstep(wl + 0.12, wl - 0.02, wp.y) : 0.0;
  float wet = clamp(max(wet0 * mix(0.35, 1.0, low + (1.0 - hy) * 0.5), under), 0.0, 1.0);
  alb = mix(alb, alb * vec3(0.6, 0.62, 0.5), under * 0.5);            // 水の中は藻でくすむ
  alb *= mix(1.0, 0.42, wet * (1.0 - mossW * 0.5));
  // ---- 細かい凹凸 ----
  float hb = (mid * 0.3 + fine * 0.35 + grain * 0.18 * fFine - crack * 0.3 + mossW * grain * 0.4) * 0.05;
  vec3 dpx = dFdx(wp), dpy = dFdy(wp);
  float dhx = dFdx(hb), dhy = dFdy(hb);
  vec3 r1 = cross(dpy, N), r2 = cross(N, dpx);
  float det = dot(dpx, r1);
  vec3 Nb = abs(det) * N - sign(det) * (dhx * r1 + dhy * r2);
  if (dot(Nb, Nb) > 1e-14) N = normalize(Nb);
  // ---- 光 ----
  float nl = max(dot(N, uSunDir), 0.0);
  float sh = sunShadow(wp, nl, gl_FragCoord.xy) * cloudShadow(wp);
  float ao = mix(0.35, 1.0, occ) * (0.55 + 0.45 * smoothstep(-0.7, 0.5, N.y)) * mix(0.55, 1.0, smoothstep(0.0, 0.25, hy));
  float wrap = mossW * 0.25;
  float dif = max((dot(N, uSunDir) + wrap) / (1.0 + wrap), 0.0);
  vec3 col = alb * (uSunCol * dif * sh + shIrr(N) * ao);
  // 逆光で平たい黒い円盤に見えないよう、空の光を少しだけ全体に回す
  col += alb * shIrr(vec3(0.0, 1.0, 0.0)) * 0.14 * mix(0.6, 1.0, occ);
  vec3 V = normalize(cameraPosition - wp);
  vec3 H = normalize(uSunDir + V);
  float gloss = mix(12.0, 160.0, wet);
  col += uSunCol * pow(max(dot(N, H), 0.0), gloss) * (gloss + 8.0) / 8.0 * 0.02 * (0.25 + 1.8 * wet) * sh * (1.0 - mossW * 0.7);
  float F = 0.04 + 0.96 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
  col += envRadiance(reflect(-V, N)) * F * wet * (1.0 - under * 0.7) * 0.5 * ao;
  if (any(isnan(col)) || any(isinf(col))) col = vec3(0.0);
  gl_FragColor = vec4(max(col, 0.0), 1.0);
#endif
}
`;

// 形：割れ面（平面）の交わり＝凸の塊。稜はなめらかな最小値で欠けて丸く、面には割れのざらつきと貝殻状のうねり、
// 丸い石は川や風雨で角が大きく落ち、表面に風化のくぼみ。下は平たく（地面に座る）
function rockShape(seed, kind, detail) {
  const r = mulberry32(seed);
  const g = new THREE.IcosahedronGeometry(0.5, detail);
  const pos = g.attributes.position;
  const blocky = kind === 1, slab = kind === 2;
  const planes = [];
  const np = blocky ? 10 + Math.floor(r() * 4) : slab ? 8 : 9 + Math.floor(r() * 4);
  for (let i = 0; i < np; i++) {
    const th = r() * Math.PI * 2, ph = Math.acos(r() * 1.7 - 0.85);
    const n = [Math.sin(ph) * Math.cos(th), Math.cos(ph) * (slab ? 0.4 : 0.85), Math.sin(ph) * Math.sin(th)];
    const l = Math.hypot(...n);
    planes.push({ n: n.map((x) => x / l), d: blocky ? 0.25 + r() * 0.13 : slab ? 0.3 + r() * 0.12 : 0.28 + r() * 0.13 });
  }
  // 上と下の面（層の割れ）
  planes.push({ n: [0, 1, 0], d: (slab ? 0.16 : blocky ? 0.26 : 0.34) + r() * 0.08 });
  planes.push({ n: [0, -1, 0], d: slab ? 0.14 : 0.3 });
  if (blocky) { const a = r() * 6.28; planes.push({ n: [Math.cos(a), 0, Math.sin(a)], d: 0.28 }); }
  const kR = blocky ? 0.0075 : slab ? 0.01 : 0.017;       // 稜の丸み（大きいと石けんのような塊になる）
  const o = [r() * 10, r() * 10, r() * 10];
  // 欠け落ちたくぼみ（凸のままだと小石のように見える）
  const dents = [];
  for (let i = 0; i < 3; i++) {
    const th = r() * Math.PI * 2, ph = Math.acos(r() * 1.6 - 0.8);
    dents.push({ n: [Math.sin(ph) * Math.cos(th), Math.cos(ph), Math.sin(ph) * Math.sin(th)], w: 0.25 + r() * 0.35, d: 0.02 + r() * 0.05 });
  }
  const P = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const l = Math.hypot(x, y, z);
    const nx = x / l, ny = y / l, nz = z / l;
    // 外形の大きなゆがみ（球の半径）
    const R0 = 0.5 * (1 + 0.14 * simplex3(nx * 1.1 + o[0], ny * 1.1 + o[1], nz * 1.1 + o[2]));
    // 平面までの距離（この向きの光線）→ なめらかな最小値
    let sum = Math.exp(-R0 / kR);
    for (const p of planes) {
      const c = nx * p.n[0] + ny * p.n[1] + nz * p.n[2];
      if (c > 0.02) sum += Math.exp(-(p.d / c) / kR);
    }
    let rad = -kR * Math.log(sum);
    // 割れ面のざらつき：細かい凹凸と貝殻状のうねり（稜のあたりは欠け）
    const f = 3.2;
    const n1 = simplex3(nx * f + o[1], ny * f + o[2], nz * f + o[0]);
    const n2 = simplex3(nx * f * 2.3 - o[2], ny * f * 2.3, nz * f * 2.3 + o[1]);
    const n3 = simplex3(nx * f * 5.5 + o[0], ny * f * 5.5 - o[1], nz * f * 5.5);
    const ridge = 1 - Math.abs(simplex3(nx * 2.1 - o[0], ny * 2.1 + o[2], nz * 2.1 - o[1]));
    // 稜の近く（平面のどれかにほぼ接している）は欠けやすい：いちばん近い平面との差で見分ける
    rad += blocky || slab ? 0.008 * n1 + 0.004 * n2 + 0.002 * n3 - 0.02 * ridge * ridge * ridge
      : 0.01 * n1 + 0.004 * n2 + 0.002 * n3 - 0.016 * Math.max(0, simplex3(nx * 3.7 + 3, ny * 3.7, nz * 3.7 - 2) - 0.35);
    for (const dn of dents) {
      const c = nx * dn.n[0] + ny * dn.n[1] + nz * dn.n[2];
      const t = (1 - c) / (dn.w * dn.w);
      if (t < 4) rad -= dn.d * Math.exp(-t * 2.5);
    }
    let yy = ny * rad;
    // 下は平たく（地面に座る）
    if (yy < -0.2) yy = -0.2 + (yy + 0.2) * 0.3;
    P[i * 3] = nx * rad; P[i * 3 + 1] = yy; P[i * 3 + 2] = nz * rad;
  }
  // 大きさをそろえる：横の広がりが置き場所の大きさ（直径 s）になるように（割れ面で削ると一回り小さくなる）
  let rx = 0, rz = 0;
  for (let i = 0; i < pos.count; i++) { rx = Math.max(rx, Math.abs(P[i * 3])); rz = Math.max(rz, Math.abs(P[i * 3 + 2])); }
  const ks = Math.min(1.8, Math.max(1, 0.5 / Math.max(0.05, (rx + rz) / 2)));
  for (let i = 0; i < P.length; i++) P[i] *= ks;
  pos.array.set(P);
  // 同じ位置の頂点をまとめてからなめらかな法線（継ぎ目の割れを防ぐ）
  const merged = mergeByPos(g);
  merged.computeVertexNormals();
  // 稜とくぼみ：となりの頂点が法線の向きへどれだけ下がっているか。遮り：法線の向きの上に自分の形があるか（近似）
  const mp = merged.attributes.position, mn = merged.attributes.normal, idx = merged.index.array;
  const nv = mp.count;
  const acc = new Float32Array(nv), cnt = new Float32Array(nv);
  for (let t = 0; t < idx.length; t += 3) {
    for (let e = 0; e < 3; e++) {
      const a = idx[t + e], b = idx[t + (e + 1) % 3];
      const dx = mp.getX(b) - mp.getX(a), dy = mp.getY(b) - mp.getY(a), dz = mp.getZ(b) - mp.getZ(a);
      const dl = Math.hypot(dx, dy, dz) || 1;
      acc[a] += -(dx * mn.getX(a) + dy * mn.getY(a) + dz * mn.getZ(a)) / dl; cnt[a]++;
      acc[b] += (dx * mn.getX(b) + dy * mn.getY(b) + dz * mn.getZ(b)) / dl; cnt[b]++;
    }
  }
  // 2回ならして、ひとつの稜の幅を数頂点に
  let cv = new Float32Array(nv);
  for (let i = 0; i < nv; i++) cv[i] = acc[i] / Math.max(1, cnt[i]);
  const nb = Array.from({ length: nv }, () => []);
  for (let t = 0; t < idx.length; t += 3) for (let e = 0; e < 3; e++) nb[idx[t + e]].push(idx[t + (e + 1) % 3]);
  for (let it = 0; it < 2; it++) {
    const nx = new Float32Array(nv);
    for (let i = 0; i < nv; i++) { let s = cv[i] * 2, c = 2; for (const j of nb[i]) { s += cv[j]; c++; } nx[i] = s / c; }
    cv = nx;
  }
  const curv = new Float32Array(nv * 2);
  const sc = detail >= 9 ? 15 : detail >= 5 ? 9 : detail >= 4 ? 6 : 3.5;
  for (let i = 0; i < nv; i++) {
    curv[i * 2] = Math.max(-1, Math.min(1, cv[i] * sc));
    // 遮り：下を向く面・地面に近い面ほど空が見えない
    const y = mp.getY(i), ny = mn.getY(i);
    curv[i * 2 + 1] = Math.max(0, Math.min(1, 0.72 + 0.28 * ny + 0.6 * (y + 0.2) - Math.max(0, -cv[i] * sc) * 0.35));
  }
  const ig = new THREE.InstancedBufferGeometry();
  ig.setAttribute('position', merged.attributes.position);
  ig.setAttribute('normal', merged.attributes.normal);
  ig.setAttribute('aCurv', new THREE.BufferAttribute(curv, 2));
  ig.setIndex(merged.index);
  return ig;
}

function mergeByPos(g) {
  const pos = g.attributes.position;
  const map = new Map(), remap = new Uint32Array(pos.count), out = [];
  for (let i = 0; i < pos.count; i++) {
    const k = `${Math.round(pos.getX(i) * 1e5)},${Math.round(pos.getY(i) * 1e5)},${Math.round(pos.getZ(i) * 1e5)}`;
    let j = map.get(k);
    if (j === undefined) { j = out.length / 3; map.set(k, j); out.push(pos.getX(i), pos.getY(i), pos.getZ(i)); }
    remap[i] = j;
  }
  const idx = [];
  if (g.index) for (const v of g.index.array) idx.push(remap[v]);
  else for (let i = 0; i < pos.count; i++) idx.push(remap[i]);
  const m = new THREE.BufferGeometry();
  m.setAttribute('position', new THREE.Float32BufferAttribute(out, 3));
  m.setIndex(idx);
  return m;
}

// 形は起動時に一度だけつくり、崖の下の岩などでも使い回す
const V = 12;   // 0〜5 丸い石、6〜9 角ばった岩塊（崖）、10〜11 板状（層の割れた岩）
const KIND = (v) => (v >= 10 ? 2 : v >= 6 ? 1 : 0);
const shapeCache = new Map();
const shapeOf = (v, detail) => {
  const key = v * 10 + detail;
  if (!shapeCache.has(key)) shapeCache.set(key, rockShape(1000 + v * 77, KIND(v), detail));
  return shapeCache.get(key);
};

// rocks: { x, y, z, s, rot, tilt, v, moss, wet, flat, kind? }。kind は 0=花崗岩 1=安山岩（なければ置き場所の湿りから）
export function buildRocks(shared, rocks, opt = {}) {
  const tStart = performance.now();
  const group = new THREE.Group();
  const byV = Array.from({ length: V }, () => []);
  // 形の選び方：水に洗われる石は丸く、ほかは角ばった塊・板状の割れ石もまぜる（置き場所の種から）
  rocks.forEach((q, i) => {
    let v = q.vFix;
    if (v === undefined) {
      const h = (Math.sin(i * 12.9898 + q.x * 0.137 + q.z * 0.071) * 43758.5453) % 1;
      const u = Math.abs(h), w = (u * 7.31) % 1;
      v = q.wet >= 0.85 ? Math.floor(w * 6) : u < 0.45 ? 6 + Math.floor(w * 4) : u < 0.6 ? 10 + Math.floor(w * 2) : Math.floor(w * 6);
    }
    byV[v % V].push(q);
  });
  const mat = new THREE.ShaderMaterial({ uniforms: { ...shared }, vertexShader: RVS, fragmentShader: RFS });
  const depthMat = new THREE.ShaderMaterial({ uniforms: { ...shared }, vertexShader: RVS, fragmentShader: RFS, defines: { DEPTH: '' } });
  const lods = [];
  for (let v = 0; v < V; v++) {
    const list = byV[v];
    if (!list.length) continue;
    const n = list.length;
    const P = new Float32Array(n * 4), R = new Float32Array(n * 4), M = new Float32Array(n * 4);
    list.forEach((q, i) => {
      const kind = q.kind ?? (opt.kind ?? (v >= 6 || q.wet > 0.3 || q.moss > 0.5 ? 1 : 0));
      // 割れ面で切った形は丸い石より背が低いので、少し持ち上げて平たさもゆるめる（草に埋もれて見えなくならないように）
      const fl = 0.3 + 0.7 * q.flat;
      P.set([q.x, q.y + q.s * (0.18 * q.flat + 0.1), q.z, q.s], i * 4);
      R.set([q.rot, q.tilt, fl, v + i * 0.013], i * 4);
      M.set([q.moss, q.wet, kind, ((i * 0.618 + v * 0.37) % 1)], i * 4);
    });
    // 近い形（細かい）と遠い形（粗い）：同じ並びを距離で振り分けてそれぞれの属性へ詰める
    const mk = (detail) => {
      const src = shapeOf(v, detail);
      const g = new THREE.InstancedBufferGeometry();
      for (const k of ['position', 'normal', 'aCurv']) g.setAttribute(k, src.attributes[k]);
      g.setIndex(src.index);
      const a = { iPos: new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4), iRot: new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4), iMat: new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4) };
      for (const k in a) { a[k].setUsage(THREE.DynamicDrawUsage); g.setAttribute(k, a[k]); }
      g.instanceCount = 0;
      const m = new THREE.Mesh(g, mat);
      m.frustumCulled = false;
      m.userData.depthMaterial = depthMat;
      group.add(m);
      return { g, a };
    };
    lods.push({ P, R, M, n, list, near: mk(9), far: mk(4), key: '' });
  }
  // 振り分け：大きさに応じた距離より近いものは細かい形（見る向きが大きく変わったときだけ詰め直す）
  const assign = (cam) => {
    for (const L of lods) {
      let nn = 0, nf = 0;
      const sel = [];
      for (let i = 0; i < L.n; i++) {
        const dx = L.P[i * 4] - cam.x, dy = L.P[i * 4 + 1] - cam.y, dz = L.P[i * 4 + 2] - cam.z;
        const lim = 7 + L.P[i * 4 + 3] * 5.5;
        // 崖・壁の面に埋まった岩（cliff.js が印をつける）は描かない
        sel.push(L.list[i].buried ? 2 : dx * dx + dy * dy + dz * dz < lim * lim ? 1 : 0);
      }
      const key = sel.join('');
      if (key === L.key) continue;
      L.key = key;
      for (let i = 0; i < L.n; i++) {
        if (sel[i] === 2) continue;
        const T = sel[i] ? L.near : L.far;
        const j = sel[i] ? nn++ : nf++;
        T.a.iPos.array.set(L.P.subarray(i * 4, i * 4 + 4), j * 4);
        T.a.iRot.array.set(L.R.subarray(i * 4, i * 4 + 4), j * 4);
        T.a.iMat.array.set(L.M.subarray(i * 4, i * 4 + 4), j * 4);
      }
      for (const T of [L.near, L.far]) for (const k in T.a) T.a[k].needsUpdate = true;
      L.near.g.instanceCount = nn; L.far.g.instanceCount = nf;
    }
  };
  // 最初に描かれる空の物体で、そのコマの視点から振り分ける（影の工程では描かれないので、直前の視点のまま）
  const hg = new THREE.BufferGeometry();
  hg.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0, 0, 0, 0], 3));
  hg.setDrawRange(0, 0);
  const hook = new THREE.Mesh(hg, new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }));
  hook.frustumCulled = false;
  hook.renderOrder = -1e9;
  const last = new THREE.Vector3(1e9, 0, 0);
  hook.onBeforeRender = (_r, _s, cam) => {
    if (cam.position.distanceToSquared(last) < 0.25) return;
    last.copy(cam.position);
    assign(cam.position);
  };
  group.add(hook);
  assign(new THREE.Vector3(1e9, 0, 0));
  if (/[?&]dev/.test(location.search)) console.log(`rocks ${rocks.length} ${Math.round(performance.now() - tStart)}ms`);
  return group;
}
