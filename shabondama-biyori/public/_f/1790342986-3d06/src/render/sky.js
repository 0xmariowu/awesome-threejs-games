// 空：一次散乱の大気をCPUで積分して空のテクスチャを焼く（太陽は固定）
// 春霞＝エアロゾル（ミー散乱）を多めにして、地平線を白く柔らかくする
import * as THREE from 'three';

export const SKY_W = 256, SKY_H = 256;

function raySphere(ox, oy, oz, dx, dy, dz, R) {
  const b = ox * dx + oy * dy + oz * dz;
  const c = ox * ox + oy * oy + oz * oz - R * R;
  const disc = b * b - c;
  if (disc < 0) return -1;
  const s = Math.sqrt(disc);
  const t0 = -b - s, t1 = -b + s;
  if (t0 > 0) return t0;
  return t1 > 0 ? t1 : -1;
}

export function dirFromSkyUV(u, v) {
  const y = v * 2 - 1;
  const r = Math.sqrt(Math.max(0, 1 - y * y));
  const phi = (u - 0.5) * Math.PI * 2;
  return [Math.sin(phi) * r, y, Math.cos(phi) * r];
}

export function bakeSky(sun, opt = {}) {
  const haze = opt.haze ?? 4.2;
  const Re = 6360e3, Ra = 6420e3;
  const bR = [5.802e-6, 13.558e-6, 33.1e-6];
  const bO = [0.65e-6, 1.881e-6, 0.085e-6]; // オゾンの吸収（地平線を青く、太陽を白く）
  const HR = 8000, HM = 1100;
  const bMs = 3.996e-6 * haze, bMe = bMs * 1.11;
  const g = 0.74;
  const oy = Re + 80;
  const W = SKY_W, H = SKY_H;
  const out = new Float32Array(W * H * 4);
  const VS = 28, LS = 8;
  const odToSun = (px, py, pz) => {
    const t = raySphere(px, py, pz, sun[0], sun[1], sun[2], Ra);
    if (raySphere(px, py, pz, sun[0], sun[1], sun[2], Re) > 0) return null;
    const ds = t / LS;
    let r = 0, m = 0;
    for (let i = 0; i < LS; i++) {
      const s = (i + 0.5) * ds;
      const qx = px + sun[0] * s, qy = py + sun[1] * s, qz = pz + sun[2] * s;
      const hh = Math.hypot(qx, qy, qz) - Re;
      r += Math.exp(-hh / HR) * ds; m += Math.exp(-hh / HM) * ds;
    }
    return [r, m];
  };
  const pR = (mu) => 3 / (16 * Math.PI) * (1 + mu * mu);
  const pM = (mu) => { const g2 = g * g; return 3 / (8 * Math.PI) * ((1 - g2) * (1 + mu * mu)) / ((2 + g2) * Math.pow(1 + g2 - 2 * g * mu, 1.5)); };
  const sunI = 22;
  for (let j = 0; j < H; j++) {
    for (let i = 0; i < W; i++) {
      let [dx, dy, dz] = dirFromSkyUV((i + 0.5) / W, (j + 0.5) / H);
      // 地平線より下は地平線の少し上の値を使う（地面は別に描く）
      if (dy < 0.004) { dy = 0.004; const r = Math.sqrt(1 - dy * dy) / Math.hypot(dx, dz); dx *= r; dz *= r; }
      const tmax = raySphere(0, oy, 0, dx, dy, dz, Ra);
      const tg = raySphere(0, oy, 0, dx, dy, dz, Re);
      const tend = tg > 0 ? tg : tmax;
      const mu = dx * sun[0] + dy * sun[1] + dz * sun[2];
      let odR = 0, odM = 0;
      const sR = [0, 0, 0], sM = [0, 0, 0];
      // 近いところを細かく刻む（二次の分布）
      let prev = 0;
      for (let k = 0; k < VS; k++) {
        const a = (k + 1) / VS;
        const t = tend * a * a;
        const ds = t - prev;
        const tm = (t + prev) * 0.5;
        prev = t;
        const px = dx * tm, py = oy + dy * tm, pz = dz * tm;
        const hh = Math.hypot(px, py, pz) - Re;
        const dR = Math.exp(-hh / HR) * ds, dM = Math.exp(-hh / HM) * ds;
        odR += dR; odM += dM;
        const L = odToSun(px, py, pz);
        if (!L) continue;
        for (let c = 0; c < 3; c++) {
          const tau = (bR[c] + bO[c] * 0.6) * (odR + L[0]) + bMe * (odM + L[1]);
          const T = Math.exp(-tau);
          sR[c] += T * dR; sM[c] += T * dM;
        }
      }
      const o = (j * W + i) * 4;
      for (let c = 0; c < 3; c++) out[o + c] = sunI * (sR[c] * bR[c] * pR(mu) + sM[c] * bMs * pM(mu));
      out[o + 3] = 1;
    }
  }
  // 太陽の色（地表での透過）
  const Ls = odToSun(0, oy, 0) || [0, 0];
  const sunT = [0, 1, 2].map((c) => Math.exp(-((bR[c] + bO[c] * 0.6) * Ls[0] + bMe * Ls[1])));
  // 露出の正規化：天頂を基準に
  const zi = (W / 2) | 0, zj = H - 2;
  const zen = out[(zj * W + zi) * 4 + 2];
  const k = (opt.zenith ?? 1.15) / zen;
  for (let q = 0; q < W * H; q++) { out[q * 4] *= k; out[q * 4 + 1] *= k; out[q * 4 + 2] *= k; }
  // 霞の色：地平線付近の平均（太陽の反対側寄りも含めて）
  const fog = [0, 0, 0];
  let fn = 0;
  const jh = Math.floor(H * 0.5 + 2);
  for (let i = 0; i < W; i++) {
    const [dx, dy, dz] = dirFromSkyUV((i + 0.5) / W, (jh + 0.5) / H);
    const mu = dx * sun[0] + dy * sun[1] + dz * sun[2];
    if (mu > 0.3) continue;
    const o = (jh * W + i) * 4;
    fog[0] += out[o]; fog[1] += out[o + 1]; fog[2] += out[o + 2]; fn++;
  }
  fog[0] /= fn; fog[1] /= fn; fog[2] /= fn;
  // 遠くの山は青く霞む：明るさは保ったまま色味を空色へ寄せる
  {
    const L = 0.2126 * fog[0] + 0.7152 * fog[1] + 0.0722 * fog[2];
    const tint = [0.8, 0.93, 1.12];
    const tl = 0.2126 * tint[0] + 0.7152 * tint[1] + 0.0722 * tint[2];
    for (let c = 0; c < 3; c++) fog[c] = fog[c] * 0.4 + tint[c] / tl * L * 0.6;
  }
  const sunScale = opt.sun ?? 3.45;
  const sunMax = Math.max(...sunT);
  // 真昼の光は白に近く（霞で少しだけ暖かい）
  const sunColor = sunT.map((v) => (0.45 + 0.55 * v / sunMax) * sunScale);
  return { data: out, w: W, h: H, sunColor, fogColor: fog, sunT };
}

// 放射照度の球面調和（L2）：空＋地面の照り返し
export function skySH(sky, sun, groundAlbedo = [0.16, 0.19, 0.12], opt = {}) {
  const { data, w, h, sunColor } = sky;
  const c = new Float64Array(27);
  const basis = (x, y, z) => [0.282095, 0.488603 * y, 0.488603 * z, 0.488603 * x, 1.092548 * x * y, 1.092548 * y * z, 0.315392 * (3 * z * z - 1), 1.092548 * x * z, 0.546274 * (x * x - y * y)];
  // 地面が受ける光（太陽＋空）→ 下半球の輝度
  let skyIrr = [0, 0, 0];
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const [x, y, z] = dirFromSkyUV((i + 0.5) / w, (j + 0.5) / h);
    const dOmega = (4 * Math.PI) / (w * h); // vが一様なので立体角は一定
    const o = (j * w + i) * 4;
    if (y > 0) for (let q = 0; q < 3; q++) skyIrr[q] += data[o + q] * y * dOmega;
  }
  const ground = [0, 1, 2].map((q) => groundAlbedo[q] * (sunColor[q] * Math.max(sun[1], 0) + skyIrr[q]) / Math.PI);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const [x, y, z] = dirFromSkyUV((i + 0.5) / w, (j + 0.5) / h);
    const dOmega = (4 * Math.PI) / (w * h);
    const o = (j * w + i) * 4;
    const L = y > 0 ? [data[o], data[o + 1], data[o + 2]] : ground;
    const b = basis(x, y, z);
    for (let k = 0; k < 9; k++) for (let q = 0; q < 3; q++) c[k * 3 + q] += L[q] * b[k] * dOmega;
  }
  // 余弦ローブで畳み込み、Lambertの π で割る
  const A = [Math.PI, 2 * Math.PI / 3, 2 * Math.PI / 3, 2 * Math.PI / 3, Math.PI / 4, Math.PI / 4, Math.PI / 4, Math.PI / 4, Math.PI / 4];
  const B = [0.282095, 0.488603, 0.488603, 0.488603, 1.092548, 1.092548, 0.315392, 1.092548, 0.546274];
  // 日なたと日かげの比を写真に近づける（空の光を少し弱める）。空の青さも少しだけ抜く
  // （実際の日かげは地面・木・霞の照り返しが混ざり、空の色ほど青くならない）
  const amb = opt.ambient ?? 0.88, desat = opt.desat ?? 0.14;
  const out = [];
  for (let k = 0; k < 9; k++) {
    const v = [0, 1, 2].map((q) => c[k * 3 + q] * A[k] * B[k] / Math.PI);
    const l = 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
    out.push(new THREE.Vector3(...v.map((x) => (x + (l - x) * desat) * amb)));
  }
  return { sh: out, ground, skyIrr };
}

export function skyTexture(sky) {
  const half = new Uint16Array(sky.data.length);
  for (let i = 0; i < sky.data.length; i++) half[i] = THREE.DataUtils.toHalfFloat(sky.data[i]);
  const t = new THREE.DataTexture(half, sky.w, sky.h, THREE.RGBAFormat, THREE.HalfFloatType);
  t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.ClampToEdgeWrapping;
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
}

export const SKY_GLSL = /* glsl */ `
uniform sampler2D tSky;
vec2 skyUV(vec3 d) { return vec2(atan(d.x, d.z) / 6.2831853 + 0.5, clamp(d.y * 0.5 + 0.5, 0.0, 1.0)); }
vec3 skyRadiance(vec3 d) {
  vec3 c = texture(tSky, skyUV(vec3(d.x, max(d.y, 0.004), d.z))).rgb;
  return c;
}
// 地平線より下も含む環境（反射・泡用）：下は霞んだ地面の色
uniform vec3 uGroundCol;
vec3 envRadiance(vec3 d) {
  vec3 s = skyRadiance(d);
  float below = smoothstep(0.0, -0.08, d.y);
  vec3 g = mix(uFogCol * 0.92, uGroundCol, smoothstep(-0.02, -0.35, d.y));
  return mix(s, g, below);
}
`;
