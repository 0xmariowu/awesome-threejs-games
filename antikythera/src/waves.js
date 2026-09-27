// waves.js
const RAW = [
  [0.92, -0.39, 19.0, 0.20, 0.55, 0.0],
  [0.55, -0.83, 12.2, 0.12, 0.50, 1.7],
  [0.99, 0.12, 7.6, 0.07, 0.45, 4.1],
  [-0.3, -0.95, 4.9, 0.04, 0.40, 2.3],
  [0.75, 0.66, 2.9, 0.022, 0.35, 5.2],
];

const WAVES = RAW.map(([dx, dz, L, A, Q, ph]) => {
  const l = Math.hypot(dx, dz);
  const k = (2 * Math.PI) / L;
  return { dx: dx / l, dz: dz / l, k, w: Math.sqrt(9.81 * k), A, Q, ph };
});

function waveHeight(x, z, t) {
  let y = 0;
  for (const W of WAVES) y += W.A * Math.sin(W.k * (W.dx * x + W.dz * z) - W.w * t + W.ph);
  return y;
}

function waveSlope(x, z, t) {
  let sx = 0, sz = 0;
  for (const W of WAVES) {
    const c = W.A * W.k * Math.cos(W.k * (W.dx * x + W.dz * z) - W.w * t + W.ph);
    sx += c * W.dx; sz += c * W.dz;
  }
  return [sx, sz];
}

function waveHeightDisp(x, z, t) {
  let px = x, pz = z;
  for (let j = 0; j < 3; j++) {
    let dx = 0, dz = 0;
    for (const W of WAVES) {
      const c = W.Q * W.A * Math.cos(W.k * (W.dx * px + W.dz * pz) - W.w * t + W.ph);
      dx += c * W.dx; dz += c * W.dz;
    }
    px = x - dx; pz = z - dz;
  }
  return waveHeight(px, pz, t);
}

const f = (v) => v.toFixed(6);
const N$1 = WAVES.length;
const WAVES_GLSL = `
const int NWAVES = ${N$1};
const vec2 W_DIR[${N$1}] = vec2[${N$1}](${WAVES.map((W) => `vec2(${f(W.dx)}, ${f(W.dz)})`).join(', ')});
const float W_K[${N$1}] = float[${N$1}](${WAVES.map((W) => f(W.k)).join(', ')});
const float W_W[${N$1}] = float[${N$1}](${WAVES.map((W) => f(W.w)).join(', ')});
const float W_A[${N$1}] = float[${N$1}](${WAVES.map((W) => f(W.A)).join(', ')});
const float W_Q[${N$1}] = float[${N$1}](${WAVES.map((W) => f(W.Q)).join(', ')});
const float W_P[${N$1}] = float[${N$1}](${WAVES.map((W) => f(W.ph)).join(', ')});
float waveHeightAt(vec2 p, float t) {
  float y = 0.0;
  for (int i = 0; i < NWAVES; i++) y += W_A[i] * sin(W_K[i] * dot(W_DIR[i], p) - W_W[i] * t + W_P[i]);
  return y;
}
`;

