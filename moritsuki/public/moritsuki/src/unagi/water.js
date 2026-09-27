// 側溝の水
// ・水面は区間ごとの平らな帯（落ち込みの縁の手前で下がる）。描くときに、先に描いた水以外の色と深度を読んで
//   屈折（底・足・網がゆがむ）＋吸収＋ヘッドライトの光が水の中で散る光（泥が舞うと光の筋が白く浮かぶ）＋夜空の映り込み
// ・流れ: さざ波・浮いたごみの粒・落ち込みの下の泡は、みな下流（+z）へ流れる
// ・落ち込み・水門・パイプから落ちる水のすだれ
// ・にごり: 歩くと底の泥が舞い、下流へ流れていく（上流へ進むと前の水はいつも澄んでいる）
import * as THREE from 'three';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { U, COMMON_GLSL } from './shade.js';
import { HW, S_GRATE, S_FAR, S_GATE, DROPS, FLOW, levelAt, floorC } from './ditch.js';
import { clamp } from './core/noise.js';

const MAX_RIP = 16;
// 画面の色と深度（水の処理で読む。重ねて描く物も深度を自分で比べる）
export const SCREEN = {
  tScene: { value: null },
  tDepth: { value: null },
  uRes: { value: new THREE.Vector2(1, 1) },
  uProjInv: { value: new THREE.Matrix4() },
  uCamWorld: { value: new THREE.Matrix4() },
  uViewProj: { value: new THREE.Matrix4() },
};
// 街灯・自販機など（水面に映る光）
export const PT = {
  uPtPos: { value: [new THREE.Vector3(0, -99, 0), new THREE.Vector3(0, -99, 0), new THREE.Vector3(0, -99, 0)] },
  uPtCol: { value: [new THREE.Color(0, 0, 0), new THREE.Color(0, 0, 0), new THREE.Color(0, 0, 0)] },
};

export const SCREEN_GLSL = /* glsl */ `
uniform sampler2D tScene;
uniform sampler2D tDepth;
uniform vec2 uRes;
uniform mat4 uProjInv;
uniform mat4 uCamWorld;
uniform mat4 uViewProj;
vec3 worldAt(vec2 uv, float z) {
  vec4 v = uProjInv * vec4(uv * 2.0 - 1.0, z * 2.0 - 1.0, 1.0);
  v /= v.w;
  return (uCamWorld * vec4(v.xyz, 1.0)).xyz;
}
`;

const VS = /* glsl */ `
  varying vec3 vW;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec4 w = modelMatrix * vec4(position, 1.0);
    vW = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

const WATER_FS = /* glsl */ `
  ${COMMON_GLSL}
  ${SCREEN_GLSL}
  uniform sampler2D tMurk;
  uniform vec4 uMurkMap;   // x0, z0, 幅, 長さ
  uniform vec4 uRip[${MAX_RIP}];
  uniform vec3 uPtPos[3];
  uniform vec3 uPtCol[3];
  uniform float uDbg;
  varying vec3 vW;

  float murkAt(vec2 p) {
    vec2 uv = (p - uMurkMap.xy) / uMurkMap.zw;
    if (any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0)))) return 0.0;
    return texture2D(tMurk, uv).r;
  }
  // 流れのさざ波の高さ（q は流れに乗せた座標）
  float waveH(vec2 q, float t) {
    float h = (un_vn(q * vec2(5.0, 2.6) + vec2(0.0, t * 0.15)) - 0.5) * 0.0045;
    h += (un_vn(q * vec2(13.0, 8.0) + vec2(3.1, -t * 0.4)) - 0.5) * 0.002;
    h += (un_vn(q * vec2(31.0, 26.0) + vec2(7.7, t * 0.9)) - 0.5) * 0.0008;
    return h;
  }
  // 落ち込みの下のわき立つ水（s = 距離、どれだけ落ち込みの下に近いか）
  float boilAt(float s) {
    float b = 0.0;
    ${DROPS.map((d) => `b = max(b, exp(-max(${d.s.toFixed(2)} - s, 0.0) / 1.1) * step(s, ${d.s.toFixed(2)}));`).join('\n    ')}
    b = max(b, exp(-max(${S_GATE.toFixed(2)} - s, 0.0) / 0.7) * step(s, ${S_GATE.toFixed(2)}) * 0.45);
    return b;
  }
  // 落ち込みの縁（なめらかに引きこまれる水面）
  float crestAt(float s) {
    float c = 0.0;
    ${DROPS.map((d) => `c = max(c, 1.0 - smoothstep(0.0, 0.9, s - ${d.s.toFixed(2)}) * step(${d.s.toFixed(2)}, s));`).join('\n    ')}
    return c;
  }
  vec2 ripGrad(vec2 p) {
    vec2 g = vec2(0.0);
    for (int i = 0; i < ${MAX_RIP}; i++) {
      vec4 r = uRip[i];
      float age = uTime - r.z;
      if (age < 0.0 || age > 2.2) continue;
      vec2 c = r.xy + vec2(0.0, age * FLOW_V);
      vec2 d = p - c;
      float dist = length(d) + 1e-4;
      float front = age * 0.45;
      float x = dist - front;
      float env = exp(-x * x * 140.0) * exp(-age * 1.9) * r.w / (1.0 + dist * 5.0);
      g += d / dist * cos(x * 90.0) * env * 0.8;
    }
    return g;
  }
  // ヘッドライトの光が水の中で散る（視線の水の中の道のりに沿って足し合わせる）
  vec3 lampScatter(vec3 p0, vec3 dir, float L, vec3 sig, float sS) {
    vec3 acc = vec3(0.0);
    float dt = L / 6.0;
    for (int i = 0; i < 6; i++) {
      float t = (float(i) + 0.5) * dt;
      vec3 q = p0 + dir * t;
      vec3 lv = q - uLampPos;
      float d = length(lv);
      vec3 ld = lv / d;
      float cone = smoothstep(uLampCone.x, uLampCone.y, dot(ld, uLampDir)) + uLampSpill * smoothstep(uLampCone2.x, uLampCone2.y, dot(ld, uLampDir));
      float lvl = ditchLevel(q);
      float dw = max(lvl - q.y, 0.0) / max(-ld.y, 0.2);
      acc += cone * exp(-sig * (dw + t)) / (d * d + 0.08);
    }
    return acc * dt * sS * uLampI;
  }

  void main() {
    vec2 suv = gl_FragCoord.xy / uRes;
    float zs = texture2D(tDepth, suv).x;
    if (gl_FragCoord.z > zs + 1e-6) discard;
    vec3 V = normalize(vW - cameraPosition);
    float dist = length(vW - cameraPosition);
    float s = -vW.z;
    float t = uTime;

    // ── 水面の向き
    vec2 q = vec2(vW.x, vW.z - t * FLOW_V);
    float e = 0.012;
    float boil = boilAt(s);
    float crest = crestAt(s);
    float amp = mix(1.0, 0.25, crest) * (1.0 + boil * 5.0);
    float h0 = waveH(q, t), hx = waveH(q + vec2(e, 0.0), t), hz = waveH(q + vec2(0.0, e), t);
    vec2 g = vec2(hx - h0, hz - h0) / e * amp;
    if (boil > 0.02) {
      vec2 qb = vec2(vW.x, vW.z - t * FLOW_V * 2.5);
      float b0 = un_vn(qb * 7.0 + t * 1.3), bx = un_vn((qb + vec2(e, 0.0)) * 7.0 + t * 1.3), bz = un_vn((qb + vec2(0.0, e)) * 7.0 + t * 1.3);
      g += vec2(bx - b0, bz - b0) / e * 0.012 * boil;
    }
    // 壁ぎわの細かい波
    float wallK = smoothstep(${(HW - 0.08).toFixed(2)}, ${HW.toFixed(2)}, abs(vW.x));
    g += (vec2(un_vn(q * 40.0 + t), un_vn(q * 40.0 - t + 5.0)) - 0.5) * 0.05 * wallK;
    g += ripGrad(vW.xz);
    float fade = exp(-dist * 0.12);
    g *= 0.35 + 0.65 * fade;
    vec3 n = normalize(vec3(-g.x, 1.0, -g.y));

    // ── 水の向こう（屈折）
    vec3 behind = worldAt(suv, zs);
    float thick0 = zs >= 0.99999 ? 3.0 : length(behind - vW);
    vec3 T = refract(V, n, 1.0 / 1.333);
    vec3 target = vW + T * min(thick0, 1.2);
    vec4 cl = uViewProj * vec4(target, 1.0);
    vec2 uvR = cl.xy / cl.w * 0.5 + 0.5;
    vec2 off = uvR - suv;
    float edge = smoothstep(0.0, 0.16, suv.y) * smoothstep(0.0, 0.06, 1.0 - suv.y) * smoothstep(0.0, 0.08, suv.x) * smoothstep(0.0, 0.08, 1.0 - suv.x);
    uvR = clamp(suv + off * edge, vec2(0.002), vec2(0.998));
    float zr = texture2D(tDepth, uvR).x;
    vec3 wr = worldAt(uvR, zr);
    // 屈折先が水より手前の物（足・網の柄）なら、ずらさない
    if (zr < gl_FragCoord.z || wr.y > vW.y + 0.005) { uvR = suv; wr = behind; }
    vec3 refr = texture2D(tScene, uvR).rgb;
    float path = min(length(wr - vW), 6.0);

    // ── にごりと吸収・光の散乱
    float mk = murkAt(vW.xz) * 0.6 + murkAt(mix(vW.xz, wr.xz, 0.5)) * 0.4;
    mk += boil * 0.25;
    vec3 sig = uWaterSigma + mk * vec3(3.2, 3.5, 4.0);
    vec3 trans = exp(-sig * path);
    float sS = 0.0025 + mk * 0.05;
    vec3 scat = lampScatter(vW, T, min(path, 1.4), sig, sS) * mix(vec3(0.55, 0.62, 0.42), vec3(0.62, 0.52, 0.34), clamp(mk, 0.0, 1.0));
    // 月明かりのほのかな水の色
    vec3 amb = vec3(0.004, 0.007, 0.009) * (1.0 + uDawn * 6.0);
    vec3 body = refr * trans + scat + amb * (1.0 - trans);

    // ── 映り込み
    vec3 R = reflect(V, n);
    R.y = abs(R.y);
    vec3 refl = nightSky(R) * 0.85;
    // 壁の間なので、横へ向く反射は暗い壁が映る
    float sideK = smoothstep(0.25, 0.75, abs(R.x) / max(R.y + abs(R.x), 1e-3));
    refl = mix(refl, vec3(0.006, 0.006, 0.007), sideK * 0.7);
    float ndv = clamp(dot(n, -V), 0.0, 1.0);
    float F = 0.02 + 0.98 * pow(1.0 - ndv, 5.0);
    // ヘッドライトの照り返し
    vec3 Ld = uLampPos - vW;
    float dl = length(Ld);
    Ld /= dl;
    vec3 H = normalize(Ld - V);
    float nh = max(dot(n, H), 0.0);
    float cone = lampCone(vW);
    vec3 spec = vec3(1.0, 0.97, 0.9) * (pow(nh, 16000.0) * 10.0 + pow(nh, 1500.0) * 0.3) * cone * uLampI / (dl * dl + 0.2) * 0.12;
    // 街灯・自販機の光の映り込み（光の柱のように揺れる）
    for (int i = 0; i < 3; i++) {
      vec3 pd = uPtPos[i] - vW;
      float pl = length(pd);
      vec3 Hp = normalize(pd / pl - V);
      float np = max(dot(n, Hp), 0.0);
      spec += uPtCol[i] * (pow(np, 700.0) * 6.0 + pow(np, 60.0) * 0.08) / (1.0 + pl * pl * 0.02);
    }
    // 照り返しも水面の反射の強さ（真上から見るとほとんど映らない）に従う
    spec *= F * 6.0;
    vec3 col = mix(body, refl, F) + spec;
    if (uDbg > 0.5) { gl_FragColor = vec4(uDbg < 1.5 ? trans : uDbg < 2.5 ? refr : uDbg < 3.5 ? vec3(path / 2.0, mk, F) : uDbg > 4.5 ? vec3(pow(zs, 40.0), pow(gl_FragCoord.z, 40.0), 0.0) : vec3(thick0 / 2.0, length(behind - cameraPosition) / 5.0, dist / 5.0), 1.0); return; }

    // ── 浮いたごみ・泡（流れに乗る）。ライトが当たると光る
    float lit = cone * uLampI / (dl * dl + 0.2) * 0.02 + 0.0015 + uDawn * 0.02;
    vec2 fq = q * vec2(26.0, 18.0);
    vec2 fi = floor(fq);
    float fh = un_h21(fi);
    vec2 fp = fract(fq) - (0.3 + 0.4 * un_h22(fi));
    float fleck = step(0.975, fh) * (1.0 - smoothstep(0.03, 0.08, length(fp * vec2(1.0, 1.4))));
    col = mix(col, vec3(0.62, 0.58, 0.48) * min(lit, 0.9) * 2.0, fleck * 0.7 * (1.0 - crest));
    // 泡: 落ち込みの下から流れていく泡。細かい泡のかたまりが、流れでちぎれて筋になる
    //   網目がそろって見えないよう、座標をゆがめて、切れ切れにする
    vec2 fb = vec2(vW.x * 5.0, (vW.z - t * FLOW_V * 1.5) * 3.0);
    vec2 warp = vec2(un_fbm(fb * 1.3 + 4.1), un_fbm(fb * 1.3 + 9.7)) - 0.5;
    vec2 fp2 = vec2(vW.x * 16.0, (vW.z - t * FLOW_V * 1.8) * 7.0) + warp * 3.0;
    float cells = un_voro(fp2, t * 0.7);
    float lace = 1.0 - smoothstep(0.0, 0.05 + boil * 0.07, cells);
    lace *= smoothstep(0.3, 0.7, un_vn(fp2 * 0.9 + 2.3));               // 筋は途中で切れる
    float patchy = smoothstep(0.45, 0.8, un_fbm(fb + warp));
    float foam = lace * patchy * min(boil * 1.4, 1.0) * 0.7;
    // 落ちたすぐ下は細かい泡がかたまる
    float bub = smoothstep(0.55, 0.9, un_vn(fp2 * 2.3)) * smoothstep(0.35, 0.7, un_fbm(fb * 2.0 - warp));
    foam = max(foam, smoothstep(0.7, 1.0, boil) * bub * 0.75);
    // ライトの前でも白飛びしない明るさ
    float flit = min(lit, 0.9) * clamp(pow(dl / 0.9, 2.0), 0.25, 1.0);
    col = mix(col, vec3(0.8, 0.82, 0.78) * flit * 1.6, clamp(foam, 0.0, 0.7));

    // 夜のもや
    float af = 1.0 - exp(-uFog * dist * 0.5);
    col = mix(col, uFogCol, af);
    if (any(isnan(col)) || any(isinf(col))) col = vec3(0.0);
    gl_FragColor = vec4(clamp(col, vec3(0.0), vec3(8.0)), 1.0);
  }
`;

// 落ちる水のすだれ（uv.x = 横、uv.y = 落ち始めからの割合）
const FALL_FS = /* glsl */ `
  ${COMMON_GLSL}
  ${SCREEN_GLSL}
  uniform float uFlowK;
  varying vec3 vW;
  varying vec2 vUv;
  void main() {
    vec2 suv = gl_FragCoord.xy / uRes;
    float zs = texture2D(tDepth, suv).x;
    if (gl_FragCoord.z > zs + 1e-6) discard;
    float t = uTime;
    // 縦のすじ（落ちながら流れる）。すじの間は透けて向こうが見える
    float x = vUv.x;
    float s1 = un_vn(vec2(x * 38.0, vUv.y * 1.5 - t * 4.5));
    float s2 = un_vn(vec2(x * 110.0 + 7.0, vUv.y * 3.0 - t * 7.5));
    float s3 = un_vn(vec2(x * 260.0 + 3.0, vUv.y * 6.0 - t * 11.0));
    float streak = s1 * 0.5 + s2 * 0.35 + s3 * 0.25;
    float sheet = smoothstep(0.35, 0.8, streak);
    // 下へ行くほど泡立って白い
    float foam = smoothstep(0.45, 1.0, vUv.y) * smoothstep(0.4, 0.75, s2 + s3 * 0.4);
    vec2 off = vec2(streak - 0.5, 0.0) * 0.02;
    vec3 back = texture2D(tScene, suv + off).rgb;
    vec3 Ld = uLampPos - vW;
    float dl = length(Ld);
    float lit = lampCone(vW) * uLampI / (dl * dl + 0.2);
    // 水の膜の照り返し（すじに沿った明るい線）
    vec3 V = normalize(vW - cameraPosition);
    vec3 glint = vec3(0.95, 0.97, 1.0) * lit * 0.012 * pow(s3, 6.0) * 3.0;
    vec3 white = vec3(0.8, 0.85, 0.82) * (lit * 0.012 + 0.004 + uDawn * 0.05);
    vec3 col = back * 0.85 + glint;
    col = mix(col, white, clamp(sheet * 0.35 + foam * 0.75, 0.0, 1.0));
    float a = clamp(0.25 + sheet * 0.35 + foam * 0.5, 0.0, 0.9) * uFlowK * smoothstep(0.0, 0.06, vUv.x) * smoothstep(1.0, 0.94, vUv.x);
    gl_FragColor = vec4(col, a);
  }
`;

export class WaterSurface {
  constructor() {
    this.group = new THREE.Group();
    this.uniforms = { ...U, ...SCREEN, ...PT, uDbg: { value: 0 }, tMurk: { value: null }, uMurkMap: { value: new THREE.Vector4(0, 0, 1, 1) }, uRip: { value: Array.from({ length: MAX_RIP }, () => new THREE.Vector4(0, 0, -99, 0)) } };
    this.material = new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: VS, fragmentShader: WATER_FS, depthTest: false, depthWrite: false });
    // 区間: 水位が途切れる所で分ける
    const cuts = [S_GRATE - 3.4, ...DROPS.map((d) => d.s), S_GATE, S_FAR];
    for (let i = 0; i < cuts.length - 1; i++) {
      const a = cuts[i] + (i > 0 ? 0.001 : 0), b = cuts[i + 1] - 0.001;
      const rows = [];
      for (let s = a; s < b; s += 0.25) rows.push(s);
      rows.push(b);
      // 縁の手前は細かく
      for (const d of DROPS) if (d.s > a - 0.01 && d.s < a + 0.01) for (let k = 0.02; k < 0.9; k += 0.05) rows.push(d.s + k);
      rows.sort((x, y) => x - y);
      const X = 4;
      const pos = [], idx = [], uv = [];
      for (const s of rows) for (let j = 0; j <= X; j++) {
        const x = -HW + (j / X) * HW * 2;
        pos.push(x, levelAt(s), -s);
        uv.push(j / X, s);
      }
      for (let r = 0; r < rows.length - 1; r++) for (let j = 0; j < X; j++) {
        const p0 = r * (X + 1) + j;
        idx.push(p0, p0 + 1, p0 + X + 1, p0 + 1, p0 + X + 2, p0 + X + 1);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      g.setIndex(idx);
      const m = new THREE.Mesh(g, this.material);
      m.frustumCulled = true;
      g.computeBoundingSphere();
      this.group.add(m);
    }
    this.ripI = 0;
    this.falls = [];
    this.fallMat = (k) => new THREE.ShaderMaterial({ uniforms: { ...U, ...SCREEN, uFlowK: { value: k } }, vertexShader: VS, fragmentShader: FALL_FS, transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide });
    // 落ち込みのすだれ
    for (const d of DROPS) {
      const y0 = levelAt(d.s + 0.001), y1 = levelAt(d.s - 0.01);
      this.addFall({ s: d.s, x0: -HW, x1: HW, y0, y1, v0: 0.55, k: 1 });
    }
    // 水門の板を越える薄い水
    const gt = levelAt(S_GATE + 0.5) - 0.03;
    this.addFall({ s: S_GATE - 0.03, x0: -HW + 0.02, x1: HW - 0.02, y0: gt + 0.02, y1: levelAt(S_GATE - 0.1), v0: 0.25, k: 0.6 });
  }

  /** 横に長いすだれ（s の縁から下流へ放物線で落ちる） */
  addFall({ s, x0, x1, y0, y1, v0, k }) {
    const H = y0 - y1;
    const T = Math.sqrt((2 * Math.max(H, 0.02)) / 9.8);
    const X = 10, Y = 10;
    const pos = [], uv = [], idx = [];
    for (let j = 0; j <= Y; j++) {
      const tt = (j / Y) * T;
      const z = -s + v0 * tt;
      const y = y0 - 0.5 * 9.8 * tt * tt;
      for (let i = 0; i <= X; i++) {
        pos.push(x0 + (x1 - x0) * (i / X), y, z);
        uv.push(i / X, j / Y);
      }
    }
    for (let j = 0; j < Y; j++) for (let i = 0; i < X; i++) {
      const a = j * (X + 1) + i;
      idx.push(a, a + X + 1, a + 1, a + 1, a + X + 1, a + X + 2);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    const m = new THREE.Mesh(g, this.fallMat(k));
    m.renderOrder = 2;
    this.group.add(m);
    this.falls.push(m);
  }

  /** パイプからの水（外へ飛び出して水面へ落ちる細い流れ） */
  addJet({ x, y, z, side, r, flow }) {
    if (flow <= 0) return;
    const v0 = 0.25 + flow * 0.5;
    const yl = levelAt(-z);
    const T = Math.sqrt((2 * Math.max(y - yl, 0.02)) / 9.8);
    const Y = 12, X = 6;
    const w = r * (0.6 + flow * 0.5);
    const pos = [], uv = [], idx = [];
    for (let j = 0; j <= Y; j++) {
      const tt = (j / Y) * T;
      const px = x - side * v0 * tt;
      const py = y - 0.5 * 9.8 * tt * tt;
      for (let i = 0; i <= X; i++) {
        const a = (i / X) * Math.PI;
        pos.push(px, py + Math.sin(a) * w * 0.25, z + Math.cos(a) * w * (1 - 0.3 * j / Y));
        uv.push(i / X, j / Y);
      }
    }
    for (let j = 0; j < Y; j++) for (let i = 0; i < X; i++) {
      const a = j * (X + 1) + i;
      idx.push(a, a + X + 1, a + 1, a + 1, a + X + 1, a + X + 2);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    const m = new THREE.Mesh(g, this.fallMat(0.55 + flow * 0.4));
    m.renderOrder = 2;
    this.group.add(m);
    return { x: x - side * v0 * T, z, flow };
  }

  ripple(x, z, s = 1) {
    const r = this.uniforms.uRip.value[this.ripI++ % MAX_RIP];
    r.set(x, z, U.uTime.value, s);
  }
  setMurk(m) {
    this.uniforms.tMurk.value = m.tex;
    this.uniforms.uMurkMap.value.set(m.x0, m.z0, m.W, m.L);
  }
}

// ───────── 画面の処理: 水以外の上に水面・すだれ・重ねる物を描く ─────────
const CopyShader = {
  uniforms: { tDiffuse: { value: null } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
  fragmentShader: `uniform sampler2D tDiffuse; varying vec2 vUv; void main(){ gl_FragColor = texture2D(tDiffuse, vUv); }`,
};

export class WaterPass extends Pass {
  constructor(camera, waterScene, overlayScene) {
    super();
    this.camera = camera;
    this.waterScene = waterScene;
    this.overlay = overlayScene;
    this.copy = new FullScreenQuad(new THREE.ShaderMaterial({ ...CopyShader, uniforms: THREE.UniformsUtils.clone(CopyShader.uniforms), depthTest: false, depthWrite: false }));
  }
  render(renderer, writeBuffer, readBuffer) {
    const cam = this.camera;
    SCREEN.tScene.value = readBuffer.texture;
    SCREEN.tDepth.value = readBuffer.depthTexture;
    SCREEN.uRes.value.set(readBuffer.width, readBuffer.height);
    SCREEN.uProjInv.value.copy(cam.projectionMatrixInverse);
    SCREEN.uCamWorld.value.copy(cam.matrixWorld);
    SCREEN.uViewProj.value.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    const ac = renderer.autoClear;
    renderer.autoClear = false;
    this.copy.material.uniforms.tDiffuse.value = readBuffer.texture;
    this.copy.render(renderer);
    renderer.render(this.waterScene, cam);
    renderer.render(this.overlay, cam);
    renderer.autoClear = ac;
  }
}

// ───────── にごり（泥煙）の場: 側溝の幅 × 主人公のまわり 36m ─────────
export class Murk {
  constructor() {
    this.RX = 16; this.RZ = 288;
    this.W = HW * 2 + 0.2; this.L = 36;
    this.x0 = -this.W / 2; this.z0 = -this.L / 2;
    this.a = new Float32Array(this.RX * this.RZ);
    this.b = new Float32Array(this.RX * this.RZ);
    this.px = new Uint8Array(this.RX * this.RZ);
    this.tex = new THREE.DataTexture(this.px, this.RX, this.RZ, THREE.RedFormat, THREE.UnsignedByteType);
    this.tex.magFilter = this.tex.minFilter = THREE.LinearFilter;
    this.tex.needsUpdate = true;
    this.shift = 0;
  }
  get cell() { return this.L / this.RZ; }
  /** 範囲の中心を主人公の z に合わせる（マス単位で中身をずらす） */
  follow(z) {
    const cz = this.z0 + this.L / 2;
    const sz = Math.round((z - cz) / this.cell);
    if (Math.abs(sz) < 16) return;
    this.scroll(sz);
    this.z0 += sz * this.cell;
  }
  scroll(sz) {
    const { RX, RZ } = this;
    const a = this.a, b = this.b;
    b.fill(0);
    for (let j = 0; j < RZ; j++) {
      const sj = j + sz;
      if (sj < 0 || sj >= RZ) continue;
      for (let i = 0; i < RX; i++) b[j * RX + i] = a[sj * RX + i];
    }
    this.a = b; this.b = a;
  }
  /** 泥煙を足す（x, z, 半径 m, 濃さ） */
  add(x, z, r, amt) {
    const { RX, RZ } = this;
    const cx = this.W / RX, cz = this.cell;
    const ci = (x - this.x0) / cx - 0.5, cj = (z - this.z0) / cz - 0.5;
    const ri = r / cx, rj = r / cz;
    const i0 = Math.max(0, Math.floor(ci - ri * 2)), i1 = Math.min(RX - 1, Math.ceil(ci + ri * 2));
    const j0 = Math.max(0, Math.floor(cj - rj * 2)), j1 = Math.min(RZ - 1, Math.ceil(cj + rj * 2));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const d2 = ((i - ci) / ri) ** 2 + ((j - cj) / rj) ** 2;
      this.a[j * RX + i] = Math.min(1.6, this.a[j * RX + i] + amt * Math.exp(-d2));
    }
  }
  at(x, z) {
    const i = Math.floor((x - this.x0) / (this.W / this.RX)), j = Math.floor((z - this.z0) / this.cell);
    if (i < 0 || j < 0 || i >= this.RX || j >= this.RZ) return 0;
    return this.a[j * this.RX + i];
  }
  /** 下流（+z）へ流れながら広がって薄まる */
  update(dt) {
    const { RX, RZ } = this;
    this.shift += (FLOW * 0.9 * dt) / this.cell;
    const sh = Math.floor(this.shift);
    this.shift -= sh;
    if (sh > 0) this.scroll(-sh);
    const a = this.a, b = this.b;
    const decay = Math.exp(-dt / 16);
    const k = clamp(dt * 2.5, 0, 0.22);
    for (let j = 1; j < RZ - 1; j++) for (let i = 0; i < RX; i++) {
      const c = a[j * RX + i];
      const l = a[j * RX + Math.max(0, i - 1)], r = a[j * RX + Math.min(RX - 1, i + 1)];
      const n = l + r + a[(j - 1) * RX + i] + a[(j + 1) * RX + i];
      b[j * RX + i] = (c + (n * 0.25 - c) * k) * decay;
    }
    this.a = b; this.b = a;
    for (let i = 0; i < RX * RZ; i++) this.px[i] = Math.min(255, this.a[i] * 160);
    this.tex.needsUpdate = true;
  }
}

export { floorC };
