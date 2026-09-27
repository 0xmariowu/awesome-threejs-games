// 浅い海の水面（画面処理で描く）
// ・うねり（岸へ寄せる 3 本）＋さざ波。浅いほど波が立って前が切り立ち、水深に応じて頭打ち（砕ける）
// ・波打ち際は寄せて返す（打ち上げ）
// ・CPU（足もとの水位・押される力）と GPU（描画）で同じ式を使う
// 描き方: 先に水以外を描いた色と深度から、画素ごとに視線と水面の交点を探し、
//   上からは 屈折（水の中の砂・足がゆがむ）＋吸収・にごり＋空の映り込み＋泡、
//   水の中からは スネルの窓と水の色。レンズが水面をまたぐと画面に水面の線が走る
import * as THREE from 'three';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { U, COMMON_GLSL } from './shade.js';
import { clamp, smoothstep } from './core/noise.js';

const G = 9.81;
// うねり: 進む向き(x,z)・波長・振幅・周期
const SWELL = [
  [0.07, -1, 26, 0.13, 7.8],
  [-0.16, -1, 15.5, 0.075, 6.1],
  [0.24, -1, 9.8, 0.038, 4.7],
].map(([dx, dz, L, A, T]) => { const l = Math.hypot(dx, dz); return { dx: dx / l, dz: dz / l, k: (2 * Math.PI) / L, A, w: (2 * Math.PI) / T }; });
// さざ波
const CHOP = [
  [0.72, 0.69, 3.4, 0.009],
  [-0.92, 0.39, 2.2, 0.0065],
  [0.18, 0.98, 1.35, 0.0042],
  [-0.55, -0.83, 0.85, 0.0026],
].map(([dx, dz, L, A]) => { const l = Math.hypot(dx, dz); const k = (2 * Math.PI) / L; return { dx: dx / l, dz: dz / l, k, A, w: Math.sqrt(G * k) }; });
// 波の群れ（数十秒ごとに大きめの波が続く）
const SET_K = (2 * Math.PI) / 150, SET_W = (2 * Math.PI) / 52;

const f5 = (v) => v.toFixed(5);
export const WAVE_GLSL = /* glsl */ `
uniform sampler2D tBed;
uniform vec4 uBedMap;   // x0, z0, size, -
uniform vec4 uBig;      // 大波の塊: 中心の z, 強さ, 幅, -
float bedAt(vec2 p) {
  vec2 uv = (p - uBedMap.xy) / uBedMap.z;
  return texture2D(tBed, clamp(uv, 0.0, 1.0)).r;
}
// 波の強さの包絡（群れ・大波）
float waveEnv(vec2 p, float t) {
  float e = 0.74 + 0.26 * sin(${f5(SET_K)} * -p.y - ${f5(SET_W)} * t);
  e += uBig.y * exp(-pow((p.y - uBig.x) / uBig.z, 2.0));
  return e;
}
// 水面の高さ（x: 高さ, yz: 勾配, w: 砕け・泡）。chop = さざ波も入れるか
vec4 waterHG(vec2 p, float t, bool chop) {
  float bed = bedAt(p);
  float d = uTide - bed;
  float inland = smoothstep(-9.0, 3.0, p.y);
  float env = waveEnv(p, t) * inland;
  float sk = smoothstep(1.3, 0.35, d) * 0.72;
  float peak = smoothstep(1.2, 0.3, d) * 0.55;
  float shoal = smoothstep(0.0, 0.32, d) * (1.0 + 0.55 * smoothstep(1.5, 0.45, d));
  float S = 0.0; vec2 gS = vec2(0.0);
  ${SWELL.map((s) => `{
    vec2 dir = vec2(${f5(s.dx)}, ${f5(s.dz)});
    float ph = ${f5(s.k)} * dot(dir, p) - ${f5(s.w)} * t;
    float ps = ph - sk * sin(ph);
    float f = sin(ps);
    float fp = 0.5 * (f + 1.0);
    float g = mix(f, fp * fp * 2.0 - 1.0 + 0.25 * peak, peak);
    float dg = mix(1.0, fp * 2.0, peak) * cos(ps) * (1.0 - sk * cos(ph));
    float a = ${f5(s.A)} * env * shoal;
    S += a * g;
    gS += a * dg * ${f5(s.k)} * dir;
  }`).join('\n  ')}
  // 水深で頭打ち（砕ける）
  float Hm = 0.42 * max(d, 0.0) + 0.012;
  float r = S / Hm;
  float th = tanh(r);
  float h = Hm * th;
  vec2 grad = gS * (1.0 - th * th);
  // 砕け: 頭打ちに近い波の前の面（波は -z へ進むので前の面は z 方向の勾配が正）
  float brk = smoothstep(0.55, 0.95, r) * smoothstep(-0.02, 0.08, gS.y);
  // 波打ち際の打ち上げ
  {
    vec2 dir = vec2(${f5(SWELL[0].dx)}, ${f5(SWELL[0].dz)});
    float ph = ${f5(SWELL[0].k)} * dot(dir, p) - ${f5(SWELL[0].w)} * t - 0.6;
    float s = 0.5 + 0.5 * sin(ph);
    float wgt = smoothstep(-0.4, 0.04, d) * (1.0 - smoothstep(0.08, 0.5, d)) * inland;
    float amp = 0.13 * env;
    float s3 = s * s * s;
    h += amp * s3 * wgt;
    grad += amp * 3.0 * s * s * 0.5 * cos(ph) * ${f5(SWELL[0].k)} * dir * wgt;
    brk = max(brk, smoothstep(0.35, 0.9, s) * wgt * smoothstep(0.1, -0.05, d - amp * s3));
  }
  if (chop) {
    float ck = smoothstep(0.0, 0.18, d + 0.05);
    ${CHOP.map((c) => `{
      vec2 dir = vec2(${f5(c.dx)}, ${f5(c.dz)});
      float ph = ${f5(c.k)} * dot(dir, p) - ${f5(c.w)} * t;
      h += ${f5(c.A)} * ck * sin(ph);
      grad += ${f5(c.A * c.k)} * ck * cos(ph) * dir;
    }`).join('\n    ')}
  }
  return vec4(uTide + h, grad, brk);
}
`;

/** CPU 側の波（GPU の WAVE_GLSL と同じ式） */
export class Waves {
  constructor(beach) {
    this.beach = beach;
    this.big = { z: 999, amp: 0, width: 9 };
  }
  env(x, z, t) {
    let e = 0.74 + 0.26 * Math.sin(SET_K * -z - SET_W * t);
    e += this.big.amp * Math.exp(-(((z - this.big.z) / this.big.width) ** 2));
    return e;
  }
  /** 水面の高さ（out があれば {h, gx, gz, brk} を入れる） */
  height(x, z, t, tide, chop = true, out = null) {
    const bed = this.beach.texHeight(x, z);
    const d = tide - bed;
    const inland = smoothstep(-9, 3, z);
    const env = this.env(x, z, t) * inland;
    const sk = smoothstep(1.3, 0.35, d) * 0.72;
    const peak = smoothstep(1.2, 0.3, d) * 0.55;
    const shoal = smoothstep(0, 0.32, d) * (1 + 0.55 * smoothstep(1.5, 0.45, d));
    let S = 0, gx = 0, gz = 0;
    for (const s of SWELL) {
      const ph = s.k * (s.dx * x + s.dz * z) - s.w * t;
      const ps = ph - sk * Math.sin(ph);
      const f = Math.sin(ps);
      const fp = 0.5 * (f + 1);
      const g = f + (fp * fp * 2 - 1 + 0.25 * peak - f) * peak;
      const dg = (1 + (fp * 2 - 1) * peak) * Math.cos(ps) * (1 - sk * Math.cos(ph));
      const a = s.A * env * shoal;
      S += a * g;
      gx += a * dg * s.k * s.dx; gz += a * dg * s.k * s.dz;
    }
    const Hm = 0.42 * Math.max(d, 0) + 0.012;
    const r = S / Hm, th = Math.tanh(r);
    let h = Hm * th;
    let brk = smoothstep(0.55, 0.95, r) * smoothstep(-0.02, 0.08, gz);
    gx *= 1 - th * th; gz *= 1 - th * th;
    {
      const s0 = SWELL[0];
      const ph = s0.k * (s0.dx * x + s0.dz * z) - s0.w * t - 0.6;
      const s = 0.5 + 0.5 * Math.sin(ph);
      const wgt = smoothstep(-0.4, 0.04, d) * (1 - smoothstep(0.08, 0.5, d)) * inland;
      const amp = 0.13 * env;
      h += amp * s * s * s * wgt;
      const dd = amp * 1.5 * s * s * Math.cos(ph) * s0.k * wgt;
      gx += dd * s0.dx; gz += dd * s0.dz;
      brk = Math.max(brk, smoothstep(0.35, 0.9, s) * wgt * smoothstep(0.1, -0.05, d - amp * s * s * s));
    }
    if (chop) {
      const ck = smoothstep(0, 0.18, d + 0.05);
      for (const c of CHOP) {
        const ph = c.k * (c.dx * x + c.dz * z) - c.w * t;
        h += c.A * ck * Math.sin(ph);
        gx += c.A * c.k * ck * Math.cos(ph) * c.dx; gz += c.A * c.k * ck * Math.cos(ph) * c.dz;
      }
    }
    if (out) { out.h = tide + h; out.gx = gx; out.gz = gz; out.brk = brk; out.d = d; }
    return tide + h;
  }
  /** 水の流れ（波の往復）の向きと速さの目安: 波の山で岸へ、谷で沖へ */
  flow(x, z, t, tide) {
    const bed = this.beach.texHeight(x, z);
    const d = Math.max(tide - bed, 0.05);
    const eta = this.height(x, z, t, tide, false) - tide;
    const c = Math.sqrt(G * d);
    return (eta / d) * c; // +: 岸（-z）へ
  }
}

// ───────── 描画: 水面の画面処理 ─────────
const MAX_RIP = 12;
const WaterShader = {
  uniforms: {
    tDiffuse: { value: null },
    tDepth: { value: null },
    tMurk: { value: null },
    uMurkMap: { value: new THREE.Vector4(0, 0, 20, 0) },
    uProjInv: { value: new THREE.Matrix4() },
    uCamWorld: { value: new THREE.Matrix4() },
    uViewProj: { value: new THREE.Matrix4() },
    uCamPos: { value: new THREE.Vector3() },
    uRip: { value: Array.from({ length: MAX_RIP }, () => new THREE.Vector4(0, 0, -99, 0)) },
    uClarity: { value: 1 },
    uRes: { value: new THREE.Vector2(1, 1) },
    tBed: { value: null },
    uBedMap: { value: new THREE.Vector4(-400, -200, 800, 0) },
    uBig: { value: new THREE.Vector4(999, 0, 9, 0) },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
  fragmentShader: /* glsl */ `
    ${COMMON_GLSL}
    ${WAVE_GLSL}
    uniform sampler2D tDiffuse;
    uniform sampler2D tDepth;
    uniform sampler2D tMurk;
    uniform vec4 uMurkMap;
    uniform mat4 uProjInv;
    uniform mat4 uCamWorld;
    uniform mat4 uViewProj;
    uniform vec3 uCamPos;
    uniform vec4 uRip[${MAX_RIP}];
    uniform float uClarity;
    uniform vec2 uRes;
    varying vec2 vUv;

    vec3 worldAt(vec2 uv, float z) {
      vec4 v = uProjInv * vec4(uv * 2.0 - 1.0, z * 2.0 - 1.0, 1.0);
      v /= v.w;
      return (uCamWorld * vec4(v.xyz, 1.0)).xyz;
    }
    float murkAt(vec2 p) {
      vec2 uv = (p - uMurkMap.xy) / uMurkMap.z + 0.5;
      if (any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0)))) return 0.0;
      return texture2D(tMurk, uv).r;
    }
    // さざ波より細かい水面のきらめき（法線だけ）
    vec2 detailGrad(vec2 p, float t) {
      vec2 g = vec2(0.0);
      g += vec2(0.62, 0.78) * cos(dot(vec2(0.62, 0.78), p) * 9.1 - t * 6.6) * 0.022;
      g += vec2(-0.91, 0.41) * cos(dot(vec2(-0.91, 0.41), p) * 13.3 - t * 8.1) * 0.017;
      g += vec2(0.13, -0.99) * cos(dot(vec2(0.13, -0.99), p) * 21.2 - t * 10.0) * 0.012;
      g += vec2(-0.55, -0.83) * cos(dot(vec2(-0.55, -0.83), p) * 31.7 - t * 12.2) * 0.008;
      g += (vec2(hm_vn(p * 6.0 + t * 0.7), hm_vn(p * 6.0 - t * 0.6 + 4.0)) - 0.5) * 0.05;
      return g;
    }
    // 足・棒が水面を切るところの波紋
    vec2 ripGrad(vec2 p) {
      vec2 g = vec2(0.0);
      for (int i = 0; i < ${MAX_RIP}; i++) {
        vec4 r = uRip[i];
        float age = uTime - r.z;
        if (age < 0.0 || age > 2.6) continue;
        vec2 d = p - r.xy;
        float dist = length(d) + 1e-4;
        float front = age * 0.55;
        float x = dist - front;
        float env = exp(-x * x * 90.0) * exp(-age * 1.6) * r.w / (1.0 + dist * 6.0);
        g += d / dist * cos(x * 70.0) * env * 0.9;
      }
      return g;
    }
    float foamTex(vec2 p, float t) {
      float n = hm_fbm(p * 1.9 + vec2(t * 0.05, -t * 0.21));
      float n2 = hm_vn(p * 7.0 - vec2(0.0, t * 0.5));
      return n * 0.75 + n2 * 0.35;
    }

    void main() {
      vec2 uv = vUv;
      float zb = texture2D(tDepth, uv).x;
      vec3 sceneCol = texture2D(tDiffuse, uv).rgb;
      vec3 ro = worldAt(uv, 0.0);
      vec3 far = worldAt(uv, min(zb, 0.99999));
      vec3 rd = normalize(far - ro);
      float sceneT = zb >= 0.99999 ? 1e5 : length(far - ro);

      vec4 w0 = waterHG(ro.xz, uTime, false);
      bool under = ro.y < w0.x;

      // 交点を探す範囲: 波の高さの幅の中だけ
      float yTop = uTide + 0.32 + uBig.y * 0.2, yBot = uTide - 0.32;
      float tA = 0.0, tB = min(sceneT, 3000.0);
      if (rd.y < -1e-4) {
        if (ro.y > yTop) tA = (yTop - ro.y) / rd.y;
        tB = min(tB, (yBot - ro.y) / rd.y);
      } else if (rd.y > 1e-4) {
        if (ro.y < yBot) tA = (yBot - ro.y) / rd.y;
        tB = min(tB, (yTop - ro.y) / rd.y);
      }
      bool hit = false;
      float tw = 0.0;
      vec4 wh = w0;
      if (tB > tA) {
        float prevT = tA;
        vec3 p = ro + rd * tA;
        float prevD = p.y - waterHG(p.xz, uTime, false).x;
        if (under && tA == 0.0) prevD = -1.0;
        // 区間が短い（見下ろしている）ほど少ない段数で
        float seg = tB - tA;
        int N = int(clamp(ceil(seg * 1.4), 3.0, 22.0));
        for (int i = 1; i <= 22; i++) {
          if (i > N) break;
          float k = float(i) / float(N);
          float t = tA + (tB - tA) * k * k;
          p = ro + rd * t;
          float dd = p.y - waterHG(p.xz, uTime, false).x;
          if (sign(dd) != sign(prevD)) {
            // はさみうち法で 1 回だけ詰める（二分法より少ない計算で十分な精度）
            float a = prevT, b = t, da = prevD, db = dd;
            float t1 = a + (b - a) * da / (da - db);
            vec3 q = ro + rd * t1;
            float d1 = q.y - waterHG(q.xz, uTime, false).x;
            if (sign(d1) == sign(da)) { a = t1; da = d1; } else { b = t1; db = d1; }
            tw = a + (b - a) * da / (da - db);
            hit = true;
            break;
          }
          prevT = t; prevD = dd;
        }
      }

      vec3 col = sceneCol;
      vec3 sd = normalize(uSunDir);
      float sunUp = smoothstep(0.02, 0.4, sd.y);

      if (hit) {
        vec3 pw = ro + rd * tw;
        wh = waterHG(pw.xz, uTime, true);
        float fade = exp(-tw * 0.02);
        vec2 g = wh.yz * 2.2 + (detailGrad(pw.xz, uTime) * (0.4 + 0.6 * fade) + ripGrad(pw.xz)) * fade;
        // 近くの水面の細かいさざ波（太陽の照り返しをきらめきに割る）
        float near = exp(-tw * 0.25);
        g += (vec2(hm_vn(pw.xz * 38.0 + uTime * 1.3), hm_vn(pw.xz * 38.0 - uTime * 1.1 + 7.7)) - 0.5) * 0.09 * near;
        g += (vec2(hm_vn(pw.xz * 91.0 - uTime * 2.1), hm_vn(pw.xz * 91.0 + uTime * 1.7 + 3.3)) - 0.5) * 0.05 * near;
        vec3 n = normalize(vec3(-g.x, 1.0, -g.y));
        float depthHere = uTide - bedAt(pw.xz);
        float brk = wh.w;
        // にごり: 砕けた波のまわり・波打ち際・突いた所
        float murk = murkAt(pw.xz);
        murk += brk * 0.55 + smoothstep(0.3, 0.02, depthHere) * 0.25;

        if (!under) {
          // ───── 上から見た水面 ─────
          float thick = max(sceneT - tw, 0.0);
          vec3 T = refract(rd, n, 1.0 / 1.333);
          float drop = thick * max(-rd.y, 0.02);
          float tT = drop / max(-T.y, 0.12);
          vec3 pr = pw + T * tT;
          vec4 cl = uViewProj * vec4(pr, 1.0);
          vec2 uvR = cl.xy / cl.w * 0.5 + 0.5;
          // 屈折先が画面の外に出る所（画面の下のふち）は、ずらす量を縮める
          {
            vec2 off = uvR - uv;
            // ふちに近いほど屈折を弱める（引き伸ばしのすじが出ないように）
            float edge = smoothstep(0.0, 0.16, uv.y) * smoothstep(0.0, 0.1, 1.0 - uv.y) * smoothstep(0.0, 0.08, uv.x) * smoothstep(0.0, 0.08, 1.0 - uv.x);
            off *= edge;
            vec2 room = mix(uv - 0.002, 0.998 - uv, step(0.0, off));
            vec2 sc = clamp(room / max(abs(off), vec2(1e-5)), 0.0, 1.0);
            uvR = uv + off * min(sc.x, sc.y);
          }
          vec3 refr = sceneCol;
          float path = min(tT, thick);
          // 屈折先が水より手前の物（手・足・棒）に当たるなら、ずらす量を縮めて探す（手の形の影が出ないように）
          if (thick < 1e4) {
            vec2 off = uvR - uv;
            for (int k = 0; k < 4; k++) {
              float f = k == 0 ? 1.0 : k == 1 ? 0.6 : k == 2 ? 0.32 : 0.12;
              vec2 u2 = uv + off * f;
              float zr = texture2D(tDepth, u2).x;
              vec3 wr = worldAt(u2, min(zr, 0.99999));
              if (zr < 0.99999 && wr.y < pw.y + 0.01) {
                refr = texture2D(tDiffuse, u2).rgb;
                path = length(wr - pw);
                break;
              }
            }
          }
          float mk = murkAt(pr.xz) * 0.6 + murk * 0.4;
          vec3 sigma = (vec3(0.62, 0.21, 0.25) + mk * vec3(1.1, 1.2, 1.4)) / uClarity;
          vec3 trans = exp(-sigma * min(path, 60.0));
          vec3 scat = uWaterTint * (0.28 + 0.5 * sunUp) + vec3(0.42, 0.38, 0.27) * mk * 0.35 * sunUp;
          vec3 body = refr * trans + scat * (1.0 - trans) * 0.62;
          // 遠くの深い海は濃い藍色
          body = mix(body, vec3(0.03, 0.2, 0.3) * (0.4 + 0.6 * sunUp), smoothstep(1.5, 9.0, depthHere) * (1.0 - trans.g));
          vec3 R = reflect(rd, n);
          R.y = abs(R.y);
          vec3 refl = skyColor(R);
          float ndv = clamp(dot(n, -rd), 0.0, 1.0);
          float F = 0.02 + 0.98 * pow(1.0 - ndv, 5.0);
          float sdr = max(dot(R, sd), 0.0);
          vec3 spec = uSunCol * (pow(sdr, 2200.0) * 7.0 + pow(sdr, 300.0) * 0.06) * sunUp;
          col = mix(body, refl, F) + spec;
          // 泡: 砕けた波・打ち上げの縁・漂う泡
          if (brk > 0.01 || depthHere < 0.32) {
            float ft = foamTex(pw.xz, uTime);
            float foam = smoothstep(0.62 - brk * 0.5, 0.95, ft + brk * 0.55) * brk;
            float rest = smoothstep(0.72, 0.95, hm_vn(pw.xz * 0.9 + vec2(0.0, uTime * 0.08)) * 0.7 + ft * 0.35) * smoothstep(0.32, 0.05, depthHere) * 0.35;
            foam = max(foam, rest * smoothstep(0.55, 0.9, ft));
            col = mix(col, vec3(0.95, 0.97, 1.0) * (0.55 + 0.5 * sunUp), clamp(foam, 0.0, 0.92) * (0.35 + 0.65 * fade));
          }
        } else {
          // ───── 水の中から見上げた水面 ─────
          vec3 T = refract(rd, -n, 1.333);
          vec3 wcol = uWaterTint * (0.25 + 0.45 * sunUp);
          vec3 up;
          if (dot(T, T) < 1e-4) up = wcol * 0.8;
          else {
            vec2 uvS = clamp(uv + n.xz * 0.04, 0.001, 0.999);
            float zS = texture2D(tDepth, uvS).x;
            up = zS >= 0.99999 ? skyColor(T) + uSunCol * pow(max(dot(T, sd), 0.0), 300.0) * 12.0 : texture2D(tDiffuse, uvS).rgb;
            up *= 0.85;
            float c = clamp(dot(-rd, n), 0.0, 1.0);
            up = mix(wcol, up, smoothstep(0.64, 0.78, c));
          }
          vec3 sigma = (vec3(0.62, 0.21, 0.25) + murk * vec3(1.9, 2.1, 2.4)) / uClarity;
          vec3 trans = exp(-sigma * tw);
          col = up * trans + wcol * (1.0 - trans);
        }
      } else if (under) {
        // 視線がずっと水の中（水の中の砂・足を見ている）
        float path = min(sceneT, 30.0);
        float murk = murkAt(ro.xz) * 0.5 + murkAt((ro + rd * min(path, 3.0)).xz) * 0.5 + w0.w * 0.5;
        vec3 sigma = (vec3(0.62, 0.21, 0.25) + murk * vec3(1.9, 2.1, 2.4)) / uClarity;
        vec3 trans = exp(-sigma * path);
        vec3 wcol = uWaterTint * (0.25 + 0.45 * sunUp) + vec3(0.45, 0.42, 0.3) * murk * 0.4;
        // 水の中はぼやける
        vec2 px = 1.0 / uRes;
        float bl = 2.0 + murk * 4.0;
        vec3 blur = (texture2D(tDiffuse, uv + vec2(px.x, px.y) * bl).rgb + texture2D(tDiffuse, uv + vec2(-px.x, px.y) * bl).rgb +
                     texture2D(tDiffuse, uv + vec2(px.x, -px.y) * bl).rgb + texture2D(tDiffuse, uv - px * bl).rgb) * 0.25;
        col = mix(sceneCol, blur, 0.7) * trans + wcol * (1.0 - trans);
      }

      // レンズが水面をまたぐ所: 細い光る線と、少しのゆがみ
      float ld = ro.y - w0.x;
      col = mix(col, col * 0.55 + vec3(0.35, 0.45, 0.45), exp(-ld * ld * 90000.0) * 0.8);
      // ブルーム前の保険: NaN/無限大を消し、極端に明るい画素を抑える
      if (any(isnan(col)) || any(isinf(col))) col = vec3(0.0);
      gl_FragColor = vec4(clamp(col, vec3(0.0), vec3(7.0)), 1.0);
    }
  `,
};

export class WaterPass extends Pass {
  constructor(camera, beach, murk) {
    super();
    this.camera = camera;
    this.uniforms = { ...THREE.UniformsUtils.clone(WaterShader.uniforms) };
    for (const k in U) this.uniforms[k] = U[k];
    this.uniforms.tBed.value = beach.heightTex;
    const T = beach.hTex;
    this.uniforms.uBedMap.value.set(T.x0, T.z0, T.size, 0);
    this.murk = murk;
    this.uniforms.tMurk.value = murk.tex;
    this.material = new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: WaterShader.vertexShader, fragmentShader: WaterShader.fragmentShader, depthTest: false, depthWrite: false });
    this.fsQuad = new FullScreenQuad(this.material);
    this.ripI = 0;
  }
  /** 水面を切る波紋を足す（x, z, 強さ） */
  ripple(x, z, s = 1) {
    const r = this.uniforms.uRip.value[this.ripI++ % MAX_RIP];
    r.set(x, z, U.uTime.value, s);
  }
  setBig(big) { this.uniforms.uBig.value.set(big.z, big.amp, big.width, 0); }
  render(renderer, writeBuffer, readBuffer) {
    const cam = this.camera, u = this.uniforms;
    u.tDiffuse.value = readBuffer.texture;
    u.tDepth.value = readBuffer.depthTexture;
    u.uProjInv.value.copy(cam.projectionMatrixInverse);
    u.uCamWorld.value.copy(cam.matrixWorld);
    u.uViewProj.value.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
    u.uCamPos.value.copy(cam.position);
    u.uRes.value.set(readBuffer.width, readBuffer.height);
    const m = this.murk;
    u.uMurkMap.value.set(m.cx, m.cz, m.size, 0);
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    this.fsQuad.render(renderer);
  }
  dispose() { this.material.dispose(); this.fsQuad.dispose(); }
}

// ───────── にごり（砂煙）の場: 主人公のまわり 20m 四方 ─────────
export class Murk {
  constructor() {
    this.R = 128;
    this.size = 20;
    this.cx = 0; this.cz = 0;
    this.a = new Float32Array(this.R * this.R);
    this.b = new Float32Array(this.R * this.R);
    this.px = new Uint8Array(this.R * this.R);
    this.tex = new THREE.DataTexture(this.px, this.R, this.R, THREE.RedFormat, THREE.UnsignedByteType);
    this.tex.magFilter = this.tex.minFilter = THREE.LinearFilter;
    this.tex.needsUpdate = true;
  }
  /** 範囲の中心を主人公に合わせる（1 マス単位で中身をずらす） */
  follow(x, z) {
    const cell = this.size / this.R;
    const sx = Math.round((x - this.cx) / cell), sz = Math.round((z - this.cz) / cell);
    if (Math.abs(sx) < 8 && Math.abs(sz) < 8) return;
    const R = this.R, a = this.a, b = this.b;
    b.fill(0);
    for (let j = 0; j < R; j++) {
      const sj = j + sz;
      if (sj < 0 || sj >= R) continue;
      for (let i = 0; i < R; i++) {
        const si = i + sx;
        if (si < 0 || si >= R) continue;
        b[j * R + i] = a[sj * R + si];
      }
    }
    this.a = b; this.b = a;
    this.cx += sx * cell; this.cz += sz * cell;
  }
  /** 砂煙を足す（x, z, 半径 m, 濃さ） */
  add(x, z, r, amt) {
    const R = this.R, cell = this.size / R;
    const ci = (x - this.cx) / cell + R / 2, cj = (z - this.cz) / cell + R / 2;
    const rc = r / cell;
    const i0 = Math.max(0, Math.floor(ci - rc * 2)), i1 = Math.min(R - 1, Math.ceil(ci + rc * 2));
    const j0 = Math.max(0, Math.floor(cj - rc * 2)), j1 = Math.min(R - 1, Math.ceil(cj + rc * 2));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const d2 = ((i - ci) ** 2 + (j - cj) ** 2) / (rc * rc);
      this.a[j * R + i] = Math.min(1.6, this.a[j * R + i] + amt * Math.exp(-d2));
    }
  }
  at(x, z) {
    const R = this.R, cell = this.size / R;
    const i = Math.round((x - this.cx) / cell + R / 2 - 0.5), j = Math.round((z - this.cz) / cell + R / 2 - 0.5);
    if (i < 0 || j < 0 || i >= R || j >= R) return 0;
    return this.a[j * R + i];
  }
  /** にごりは広がりながら薄まり、波の往復で少し流れる（flow: 岸向きの速さ） */
  update(dt, flow = 0) {
    const R = this.R, a = this.a, b = this.b;
    const decay = Math.exp(-dt / 2.6);
    const k = clamp(dt * 3.5, 0, 0.24);
    const cell = this.size / R;
    this.shift = (this.shift || 0) + (flow * 0.35 * dt) / cell;
    const sh = Math.trunc(this.shift);
    this.shift -= sh;
    for (let j = 1; j < R - 1; j++) {
      const sj = clamp(j + sh, 1, R - 2);
      for (let i = 1; i < R - 1; i++) {
        const c = a[sj * R + i];
        const n = a[sj * R + i - 1] + a[sj * R + i + 1] + a[(sj - 1) * R + i] + a[(sj + 1) * R + i];
        b[j * R + i] = (c + (n * 0.25 - c) * k) * decay;
      }
    }
    this.a = b; this.b = a;
    const px = this.px;
    for (let i = 0; i < R * R; i++) px[i] = Math.min(255, this.a[i] * 160);
    this.tex.needsUpdate = true;
  }
}
