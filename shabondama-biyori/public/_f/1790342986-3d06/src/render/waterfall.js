// 滝：滝口から滝つぼへ落ちる水の幕（上は透きとおり、落ちるほど白く泡立ち、下ではちぎれる）
// ＋滝口の上の急な流れ（渓流の段の落ち口は水面そのもので描く：water.js）。模様は水と同じ速さで流れる（落ちるほど速い）
import * as THREE from 'three';
import { ALL, SHADOW } from './glsl.js';
import { SKY_GLSL } from './sky.js';

const G = 9.8;

const FVS = /* glsl */ `
${ALL}
attribute vec4 aF;     // x=横(-1..1) y=落ちはじめからの時間(s) z=落ちた割合(0..1) w=種（幕ごと）
attribute vec3 aN;     // 面の向き
attribute vec3 aT;     // 横の向き（u の増える向き）
varying vec4 vF;
varying vec3 vWorld;
varying vec3 vN;
varying vec3 vT;
void main() {
  vF = aF;
  vN = aN;
  vT = aT;
  vec3 p = position;
  // 幕のゆらぎ：落ちるほど横に揺れる
  float sw = aF.z * aF.z;
  p += aN * sin(uTime * 3.1 + aF.x * 2.3 + aF.w * 7.0 + aF.y * 4.0) * 0.08 * sw;
  vWorld = p;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}
`;
const FFS = /* glsl */ `
${ALL}
${SHADOW}
${SKY_GLSL}
uniform float uKind;   // 0=大きな滝 1=段の落ち口 2=崖の上の急流
varying vec4 vF;
varying vec3 vWorld;
varying vec3 vN;
varying vec3 vT;
float nz(vec2 p) { return texture(tNoise, p).r; }
void main() {
  float u = vF.x, t = vF.y, v = vF.z, sd = vF.w;
  // 水と一緒に流れる模様（時間で下へ。落ちるほど速いので模様は縦に伸びる）
  float ph = t - uTime;
  float white, a, rope = 0.5, dR = 0.0;
  // 模様の大きさ：tNoise の r は 1/16、g は 1/4、b（細胞）は 1/16 の粒。幕の半幅は約2.3m、落ちる速さは平均約9m/s
  float n2 = nz(vec2(u * 0.8 + sd * 1.7, ph * 0.5));
  float n3 = nz(vec2(u * 1.2 - sd, ph * 1.1));
  if (uKind < 0.5) {
    // 大きな滝：滝口はなめらかに透きとおり、すぐ白く砕ける。
    // 水は太い筋（幅30cmほど）に分かれ、その中を房（1mほどの塊）が頭を先にして落ち、後ろに細い尾を引く。
    // 表面は細かく泡立って波打つ。下ほど筋がほどけて隙間ができる
    rope = texture(tNoise, vec2(u * 1.6 + sd * 4.3, ph * 0.47)).g;
    float ropeF = nz(vec2(u * 0.95 + sd * 2.0, ph * 0.39));
    // 泡立つ表面の乱れ（12cm×30cmほどの崩れた粒）
    vec2 tq = vec2(u * 1.2 + sd * 3.0, ph * 2.0);
    float turb = nz(tq);
    float turb2 = nz(vec2(u * 2.9 - sd * 2.0, ph * 0.6));      // 細い尾の筋
    // 面の傾き：乱れと筋の横の変化（泡の起伏と筋の丸みの明暗）
    float e = 0.03;
    dR = (nz(tq + vec2(e * 1.2, 0.0)) - turb) / e * 0.35 + (texture(tNoise, vec2((u + e) * 1.6 + sd * 4.3, ph * 0.47)).g - rope) / e * 0.3;
    // 房：頭（明るく厚い）
    float cl = texture(tNoise, vec2(u * 0.18 + sd * 2.7, ph * 0.59)).b;
    float head = smoothstep(0.6, 0.3, cl);
    float st = nz(vec2(u * 0.6 + sd * 4.3, ph * 0.3));
    float aer = smoothstep(0.01, 0.13, v + (st - 0.5) * 0.1);
    // 泡の包み（50cm×80cmほど）
    float pk = nz(vec2(u * 0.29 + sd * 1.3, ph * 0.73)) * 0.6 + nz(vec2(u * 0.6 - sd, ph * 1.4)) * 0.4;
    white = aer * clamp(0.6 + 0.18 * (rope - 0.5) + 0.22 * head + 0.5 * (pk - 0.5) + 0.35 * (turb - 0.5) + 0.25 * (turb2 - 0.5), 0.0, 1.0);
    float split = smoothstep(0.12, 1.0, v);
    float wid = 1.0 - smoothstep(0.62 + 0.28 * (n2 - 0.5) - 0.2 * v, 1.0, abs(u));
    float body = smoothstep(0.26 + 0.3 * split, 0.46 + 0.24 * split, rope * 0.36 + ropeF * 0.14 + head * 0.22 + turb2 * 0.16 + pk * 0.18 + n3 * 0.06);
    // 下の方は筋がほどけるが、真ん中は最後まで厚い（落ち口は白く濁る）
    a = wid * mix(0.98, body, (0.2 + 0.62 * split) * (0.55 + 0.45 * smoothstep(0.2, 0.7, abs(u))));
    // 縁はしずくの筋にちぎれる
    float fringe = smoothstep(0.6, 0.98, abs(u)) * smoothstep(0.62, 0.86, turb2 * 0.6 + n3 * 0.5);
    a = max(a, fringe * 0.6 * split);
  } else {
    float n1 = nz(vec2(u * 1.3 + sd * 1.55, ph * 0.45));
    float ropes = texture(tNoise, vec2(u * 1.6 + sd * 2.5, ph * 0.06)).g;
    white = 0.35 + 0.45 * smoothstep(0.3, 0.8, n2 * 0.6 + n1 * 0.4);
    float edge = 1.0 - smoothstep(0.72 + 0.2 * (n2 - 0.5) - 0.12 * v, 1.0, abs(u));
    float breakup = smoothstep(0.45, 1.0, v);
    float strands = smoothstep(0.25 + 0.35 * breakup, 0.6 + 0.2 * breakup, ropes * 0.55 + n1 * 0.3 + n3 * 0.25);
    a = mix(0.95, 0.78, v) * edge * mix(1.0, strands, 0.55 + 0.4 * breakup);
    a *= 0.55 + 0.45 * smoothstep(0.3, 0.7, n3 * 0.5 + ropes * 0.5);
  }
  // 上の端はなめらかに始まり、下の端は泡に溶ける
  a *= smoothstep(0.0, 0.03, v) * (1.0 - smoothstep(0.9, 1.0, v));
  if (a < 0.01) discard;
  vec3 N = dot(vN, vN) > 1e-10 ? normalize(vN) : vec3(0.0, 0.0, 1.0);
  vec3 V = normalize(cameraPosition - vWorld);
  if (dot(N, V) < 0.0) N = -N;
  // 筋の丸み：横の向きへ面を傾ける（筋の片側が明るく、片側が陰る）
  vec3 Tn = dot(vT, vT) > 1e-10 ? normalize(vT) : vec3(1.0, 0.0, 0.0);
  vec3 Nr = N - Tn * clamp(dR * 0.3, -0.8, 0.8);
  Nr = dot(Nr, Nr) > 1e-8 ? normalize(Nr) : N;
  float sh = sunShadow(vWorld, 0.7, gl_FragCoord.xy) * cloudShadow(vWorld);
  // 泡立った白い水：光を四方へ散らす（前からも後ろからも明るい）。筋の陰の側は少し暗い
  float diff = 0.5 + 0.5 * max(dot(Nr, uSunDir), 0.0);
  float back = pow(max(dot(-V, uSunDir), 0.0), 4.0) * 0.8;
  float occl = 0.82 + 0.18 * clamp(0.5 + (rope - 0.5) * 1.2, 0.0, 1.0);
  vec3 foam = vec3(0.9, 0.93, 0.96) * (uSunCol * (diff + back) * sh * 0.85 + shIrr(Nr) * 1.3) * occl;
  // 透きとおった水：空を映し、奥の岩は暗く見える
  vec3 R = reflect(-V, N);
  float F = 0.03 + 0.97 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
  vec3 clear = mix(vec3(0.02, 0.05, 0.05) * (shIrr(N) + uSunCol * 0.3 * sh), envRadiance(R), F) + uSunCol * pow(max(dot(R, uSunDir), 0.0), 120.0) * 3.0 * sh;
  vec3 col = mix(clear, foam * (0.8 + 0.32 * n2), white);
  // 流れの筋の明暗
  col *= 0.9 + 0.2 * n3 * white;
  float alpha = a * mix(0.6, 1.0, white);
  if (any(isnan(col))) col = vec3(0.0);
  gl_FragColor = vec4(col * alpha, alpha);
}
`;

// 幕の格子：Pは (u, v) → 位置 を返す関数
function sheet(P, nu, nv, seed, tOf, out) {
  const base = out.pos.length / 3;
  for (let j = 0; j <= nv; j++) {
    const v = j / nv;
    for (let i = 0; i <= nu; i++) {
      const u = (i / nu) * 2 - 1;
      const p = P(u, v);
      // 面の向き：横と縦の差分
      const pu = P(Math.min(1, u + 0.02), v), pv = P(u, Math.min(1, v + 0.01));
      const pu0 = P(Math.max(-1, u - 0.02), v), pv0 = P(u, Math.max(0, v - 0.01));
      const a = [pu[0] - pu0[0], pu[1] - pu0[1], pu[2] - pu0[2]];
      const b = [pv[0] - pv0[0], pv[1] - pv0[1], pv[2] - pv0[2]];
      const n = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
      const l = Math.hypot(...n) || 1;
      out.pos.push(...p);
      out.nrm.push(n[0] / l, n[1] / l, n[2] / l);
      const al = Math.hypot(...a) || 1;
      out.tan.push(a[0] / al, a[1] / al, a[2] / al);
      out.f.push(u, tOf(v), v, seed);
    }
  }
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    const a = base + j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1;
    out.idx.push(a, c, b, b, c, d);
  }
}

function mesh(shared, data, kind, order) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(data.pos, 3));
  g.setAttribute('aN', new THREE.Float32BufferAttribute(data.nrm, 3));
  g.setAttribute('aT', new THREE.Float32BufferAttribute(data.tan, 3));
  g.setAttribute('aF', new THREE.Float32BufferAttribute(data.f, 4));
  g.setIndex(data.idx);
  const mat = new THREE.ShaderMaterial({
    uniforms: { ...shared, uKind: { value: kind } },
    vertexShader: FVS, fragmentShader: FFS,
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
  });
  const m = new THREE.Mesh(g, mat);
  m.frustumCulled = false;
  m.renderOrder = order;
  m.userData.farShadow = false; m.userData.nearShadow = false;
  return m;
}

export function buildWaterfall(shared, gorge) {
  const group = new THREE.Group();
  const [lx, ly, lz] = gorge.lip;
  const [px, py, pz] = gorge.impact;
  const H = ly - py + 0.25;
  // 落ちる向き（水平）と横
  let dx = px - lx, dz = pz - lz;
  const dl = Math.hypot(dx, dz); dx /= dl; dz /= dl;
  const sx = -dz, sz = dx;
  const T = Math.sqrt((2 * H) / G);
  const v0 = dl / T;
  // 大きな滝：奥の幕と手前の幕（少しずらして厚みを出す）
  const big = { pos: [], nrm: [], tan: [], f: [], idx: [] };
  // 奥行き・幅・横のずれ・揺れの違う5枚を重ねて、水の厚みと房の重なりを出す
  for (const [off, wMul, shift, seed] of [[-0.34, 0.84, -0.12, 0.37], [-0.12, 1.0, 0.04, 0.71], [0.08, 0.9, 0.22, 0.13], [0.26, 0.66, -0.38, 0.53], [0.44, 0.48, 0.5, 0.91]]) {
    const P = (u, v) => {
      const t = Math.sqrt(v) * T;             // 落ちた高さの割合 → 時間
      // 半幅：下で広がり、ところどころくびれる
      const w = (1.5 + 1.6 * Math.pow(v, 0.75)) * wMul * (1 + 0.1 * Math.sin(v * 6.5 + seed * 11));
      const c = shift * (0.4 + 0.6 * v) + 0.2 * Math.sin(v * 4.3 + seed * 17) * v;
      const fwd = v0 * t + off * (0.3 + v);
      const y = ly + 0.12 - 0.5 * G * t * t * (H / (0.5 * G * T * T));
      return [lx + dx * fwd + sx * (u * w + c), y, lz + dz * fwd + sz * (u * w + c)];
    };
    sheet(P, 20, 60, seed, (v) => Math.sqrt(v) * T, big);
  }
  group.add(mesh(shared, big, 0, 2));
  // 崖の上の急な流れ：川床に沿った白い帯
  const up = gorge.upper;
  if (up.length > 2) {
    const tor = { pos: [], nrm: [], tan: [], f: [], idx: [] };
    // 下（滝口）からの道のり
    const L = [0];
    for (let i = 1; i < up.length; i++) L.push(L[i - 1] + Math.hypot(up[i][0] - up[i - 1][0], up[i][1] - up[i - 1][1], up[i][2] - up[i - 1][2]));
    const total = L[L.length - 1];
    const at = (d) => {
      let i = 1;
      while (i < L.length - 1 && L[i] < d) i++;
      const k = (d - L[i - 1]) / Math.max(1e-6, L[i] - L[i - 1]);
      return [0, 1, 2].map((c) => up[i - 1][c] + (up[i][c] - up[i - 1][c]) * k);
    };
    const P = (u, v) => {
      const d = (1 - v) * total;
      const p = at(d), p2 = at(Math.min(total, d + 1));
      let tx = p2[0] - p[0], tz = p2[2] - p[2];
      const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;
      const w = 0.45 + 0.2 * Math.sin(d * 0.7) + 0.1 * Math.sin(d * 2.3);
      return [p[0] - tz * u * w, p[1] + 0.05 + 0.05 * (1 - u * u), p[2] + tx * u * w];
    };
    // 流れの速さ ≈ 3m/s（道のり÷速さ＝時間）
    sheet(P, 6, Math.max(8, Math.round(total / 1.5)), 0.53, (v) => ((v) * total) / 3.0, tor);
    group.add(mesh(shared, tor, 2, 1));
  }
  return group;
}
