// world.js
let lastRock = 0;
let ROCK_DETAIL = 1;
function floorRaw(x, z) {
  let h = -21 + 0.055 * z - 0.02 * x;
  h += fbm2(x * 0.018 + 3.1, z * 0.018 - 1.7, 4) * 3.4;
  h += fbm2(x * 0.075, z * 0.075, 3) * 0.55;
  const dw = Math.hypot(x - LAYOUT.wreck.x, z - LAYOUT.wreck.z);
  const r = ridged2(x * 0.035 + 7.3, z * 0.035 - 2.2, 4);
  const rock = Math.max(0, r - 0.55) * 7.0 * smoothstep(14, 28, dw);
  lastRock = rock;
  h += rock;
  h += 1.15 * Math.exp(-((x - LAYOUT.wreck.x) ** 2) / 60 - ((z - LAYOUT.wreck.z) ** 2) / 110);
  h -= smoothstep(LAYOUT.dropoffX - 6, LAYOUT.dropoffX + 22, x) * 40;
  h -= 3.4 * smoothstep(12.5, 25, z) * (1 - smoothstep(8, 16, Math.abs(x + 1.5)));
  h -= 0.4 * Math.exp(-(((x + 2.0 - (z - 7) * 0.08) / 1.5) ** 2)) * smoothstep(6.5, 9.5, z) * (1 - smoothstep(20, 26, z));
  return h;
}
const ASSEMBLY_H = floorRaw(LAYOUT.assembly.x, LAYOUT.assembly.z);

function floorHeight(x, z) {
  let h = floorRaw(x, z);
  const da = Math.hypot(x - LAYOUT.assembly.x, z - LAYOUT.assembly.z);
  if (da < 12) h = lerp$4(h, ASSEMBLY_H + 0.5 * smoothstep(3, 8, da), smoothstep(12, 8, da));
  meadowField(x, z, h);
  return h + MF.matte;
}
function sandAlbedo(x, z, organic = 0, out = [0, 0, 0]) {
  const n1 = fbm2(x * 0.11, z * 0.11, 3), zone = fbm2(x * 0.021 - 7, z * 0.021 + 2, 2);
  const og = smoothstep(0.0, 0.8, organic) * 0.1;
  out[0] = lerp$4(0.63 + n1 * 0.05 + zone * 0.03, 0.44, og);
  out[1] = lerp$4(0.58 + n1 * 0.045 + zone * 0.02, 0.39, og);
  out[2] = lerp$4(0.47 + n1 * 0.035, 0.28, og);
  return out;
}
const SEDIMENT = { material: null };
const TATTR = { xs: null, zs: null, nx: 0, AX: null, AZ: null, col: null, ter: null, ter2: null, nrm: null };
function terrainAttrs(x, z, out) {
  const T = TATTR;
  if (!T.xs) {
    sandAlbedo(x, z, 0, out);
    out[3] = 1; out[4] = 0; out[5] = 0; out[6] = 1; out[7] = 0; out[8] = 1; out[9] = 0; out[10] = 0; out[11] = 1; out[12] = 0;
    return out;
  }
  const xs = T.xs, zs = T.zs, nx = T.nx, i = cellOf(xs, T.AX, x), j = cellOf(zs, T.AZ, z);
  const fx = clamp$9((x - xs[i]) / (xs[i + 1] - xs[i]), 0, 1), fz = clamp$9((z - zs[j]) / (zs[j + 1] - zs[j]), 0, 1);
  const ka = j * nx + i, kb = ka + 1, kc = ka + nx, kd = kc + 1;
  let wa, wb, wc, wd;
  if (fx + fz <= 1) { wa = 1 - fx - fz; wb = fx; wc = fz; wd = 0; } else { wa = 0; wb = 1 - fz; wc = 1 - fx; wd = fx + fz - 1; }
  const C = T.col, A = T.ter, B = T.ter2, N = T.nrm;
  for (let c = 0; c < 3; c++) out[c] = C[ka * 3 + c] * wa + C[kb * 3 + c] * wb + C[kc * 3 + c] * wc + C[kd * 3 + c] * wd;
  for (let c = 0; c < 4; c++) out[3 + c] = A[ka * 4 + c] * wa + A[kb * 4 + c] * wb + A[kc * 4 + c] * wc + A[kd * 4 + c] * wd;
  for (let c = 0; c < 3; c++) out[7 + c] = B[ka * 3 + c] * wa + B[kb * 3 + c] * wb + B[kc * 3 + c] * wc + B[kd * 3 + c] * wd;
  let ax = 0, ay = 0, az = 0;
  ax = N[ka * 3] * wa + N[kb * 3] * wb + N[kc * 3] * wc + N[kd * 3] * wd;
  ay = N[ka * 3 + 1] * wa + N[kb * 3 + 1] * wb + N[kc * 3 + 1] * wc + N[kd * 3 + 1] * wd;
  az = N[ka * 3 + 2] * wa + N[kb * 3 + 2] * wb + N[kc * 3 + 2] * wc + N[kd * 3 + 2] * wd;
  const l = Math.sqrt(ax * ax + ay * ay + az * az) || 1;
  out[10] = ax / l; out[11] = ay / l; out[12] = az / l;
  return out;
}
const HARD = { tops: [], sides: [], boulderTops: [], boulders: [], rock: null, boulderGeo: null };
function asmWander(x, z) {
  const a = Math.atan2(z - LAYOUT.assembly.z, x - LAYOUT.assembly.x), c = Math.cos(a), s = Math.sin(a);
  return 1 - 0.28 * clamp$9(0.5 + 0.9 * noise2(c * 1.4 + 3.1, s * 1.4 - 0.7) + 0.4 * noise2(c * 3.3, s * 3.3 + 5.2), 0, 1);
}

const MEADOWS = [
  { x: LAYOUT.meadow.x, z: LAYOUT.meadow.z, rx: LAYOUT.meadow.r * 1.25, rz: LAYOUT.meadow.r },
  { x: -42, z: -7, rx: 14, rz: 21 },
  { x: 21, z: -38, rx: 19, rz: 11 },
  { x: -19, z: -47, rx: 15, rz: 9 },
];
const HULL_ENDS = [
  LAYOUT.hull.x - Math.sin(LAYOUT.hull.rot) * 21, LAYOUT.hull.z - Math.cos(LAYOUT.hull.rot) * 21,
  LAYOUT.hull.x + Math.sin(LAYOUT.hull.rot) * 12, LAYOUT.hull.z + Math.cos(LAYOUT.hull.rot) * 12,
];
const MF = { cover: 0, matte: 0, fringe: 0, sand: 0 };
function meadowMask(x, z) {
  let m = smoothstep(13, 18, Math.hypot(x - LAYOUT.assembly.x, z - LAYOUT.assembly.z) * asmWander(x, z));
  if (m <= 0) return 0;
  for (const f of LAYOUT.frags) m *= smoothstep(5, 8, Math.hypot(x - f.x, z - f.z));
  m *= smoothstep(4, 6.5, Math.hypot(x - LAYOUT.arm.x, z - LAYOUT.arm.z)) * smoothstep(4, 6.5, Math.hypot(x - LAYOUT.torso.x, z - LAYOUT.torso.z));
  m *= smoothstep(7, 9.5, Math.hypot(x - LAYOUT.arch.x, z - LAYOUT.arch.z));
  for (const f of LAYOUT.formations || []) { const fr = f.kind === 'stack' ? f.r * 1.3 : f.kind === 'window' ? f.len + f.t : f.R + f.t * 1.5; m *= smoothstep(fr + 1, fr + 3, Math.hypot(x - f.x, z - f.z)); }
  if (LAYOUT.anchor) m *= smoothstep(1.8, 3.4, Math.hypot(x - LAYOUT.anchor.x, z - LAYOUT.anchor.z));
  const sx = HULL_ENDS[0], sz = HULL_ENDS[1], ux = HULL_ENDS[2] - sx, uz = HULL_ENDS[3] - sz;
  const t = clamp$9(((x - sx) * ux + (z - sz) * uz) / (ux * ux + uz * uz), 0, 1);
  m *= smoothstep(8, 12, Math.hypot(x - sx - ux * t, z - sz - uz * t));
  for (const c of LAYOUT.rockClusters) m *= smoothstep(c.s * 2.4, c.s * 3.4, Math.hypot(x - c.x, z - c.z));
  for (const c of LAYOUT.outcrops || []) m *= smoothstep(c.s * 2.4, c.s * 3.4, Math.hypot(x - c.x, z - c.z));
  for (const c of LAYOUT.pinnacles || []) m *= smoothstep(c.r * 2, c.r * 3, Math.hypot(x - c.x, z - c.z));
  for (const o of LAYOUT.reef) m *= smoothstep(o.r * o.len + 1, o.r * o.len + 3, Math.hypot(x - o.x, z - o.z));
  return m;
}
function corridorN(x, z) {
  const u = x + 9 * fbm2(x * 0.03 + 5.2, z * 0.03 - 1.1, 2), v = z + 9 * fbm2(x * 0.03 - 3.7, z * 0.03 + 8.4, 2);
  return fbm2(u * 0.032 + 1.3, v * 0.032 + 2.9, 3);
}
function meadowField(x, z, h) {
  MF.cover = 0; MF.matte = 0; MF.fringe = 0; MF.sand = 0;
  let e = 9, r = 1;
  for (const m of MEADOWS) {
    const dx = (x - m.x) / m.rx, dz = (z - m.z) / m.rz, d = Math.sqrt(dx * dx + dz * dz);
    if (d < e) { e = d; r = Math.min(m.rx, m.rz); }
  }
  if (e > 1.75 || h < -36) return;
  const gate = smoothstep(-35, -31.5, h) * (1 - smoothstep(0.05, 0.3, lastRock));
  if (gate <= 0) return;
  const mask = gate * meadowMask(x, z);
  if (mask <= 0) return;
  const wA = fbm2(x * 0.045 + 3.3, z * 0.045 - 7.1, 3), wB = fbm2(x * 0.17 - 1.7, z * 0.17 + 4.4, 2);
  const inside = (1 - e - 0.3 * wA) * r + 1.6 * wB;
  MF.fringe = mask * smoothstep(-7, -1, inside) * (1 - smoothstep(-1, 0.5, inside));
  if (inside < -1) return;
  const n0 = corridorN(x, z);
  const gx = (corridorN(x + 0.35, z) - n0) / 0.35, gz = (corridorN(x, z + 0.35) - n0) / 0.35;
  const dist = Math.abs(n0) / Math.max(Math.hypot(gx, gz), 1e-4) + 0.25 * wB;
  const hw = 1 + 1.5 * smoothstep(-0.25, 0.25, fbm2(x * 0.035 + 11, z * 0.035 - 6, 2));
  const bo = fbm2(x * 0.085 + 2.1, z * 0.085 + 8.3, 2) + 0.05 * wB;
  const edgeC = smoothstep(-1, 1.2, inside);
  const open = smoothstep(hw - 0.3, hw + 0.4, dist) * (1 - smoothstep(0.31, 0.36, bo));
  MF.cover = mask * edgeC * open;
  MF.sand = mask * edgeC * (1 - open);
  const scarp = smoothstep(hw, hw + 0.4, dist) * (1 - smoothstep(0.315, 0.34, bo)) * smoothstep(0.7, 1.2, inside);
  MF.matte = mask * scarp * (0.3 + 0.6 * smoothstep(-0.3, 0.3, fbm2(x * 0.022 - 4.2, z * 0.022 + 1.9, 2))) * (0.92 + 0.08 * wB);
}

function inClearings(x, z, pad = 0) {
  if (Math.hypot(x - LAYOUT.wreck.x, (z - LAYOUT.wreck.z) * 0.75) < 9 + pad) return true;
  if (Math.hypot(x - LAYOUT.assembly.x, z - LAYOUT.assembly.z) < 6.5 + pad) return true;
  for (const f of LAYOUT.frags) if (Math.hypot(x - f.x, z - f.z) < 2.2 + pad) return true;
  if (Math.hypot(x - LAYOUT.arm.x, z - LAYOUT.arm.z) < 1.6 + pad) return true;
  if (Math.hypot(x - LAYOUT.torso.x, z - LAYOUT.torso.z) < 1.8 + pad) return true;
  return false;
}

function nearGameplay(x, z, pad = 0) {
  if (Math.hypot(x - LAYOUT.assembly.x, z - LAYOUT.assembly.z) < 6.5 + pad) return true;
  for (const f of LAYOUT.frags) if (Math.hypot(x - f.x, z - f.z) < 2.4 + pad) return true;
  if (Math.hypot(x - LAYOUT.arm.x, z - LAYOUT.arm.z) < 1.6 + pad) return true;
  if (Math.hypot(x - LAYOUT.torso.x, z - LAYOUT.torso.z) < 1.8 + pad) return true;
  if (Math.hypot(x - LAYOUT.hull.x, z - LAYOUT.hull.z) < 1.4 + pad) return true;
  return false;
}

function nearAssembly(x, z, r) { return Math.hypot(x - LAYOUT.assembly.x, z - LAYOUT.assembly.z) < r; }

function asmKeep(x, z) { return smoothstep(3.5, 10.5, Math.hypot(x - LAYOUT.assembly.x, z - LAYOUT.assembly.z) * asmWander(x, z)); }
function nearFinds(x, z, pad = 0) {
  for (const f of LAYOUT.frags) if (Math.hypot(x - f.x, z - f.z) < 2.4 + pad) return true;
  if (Math.hypot(x - LAYOUT.arm.x, z - LAYOUT.arm.z) < 1.6 + pad) return true;
  if (Math.hypot(x - LAYOUT.torso.x, z - LAYOUT.torso.z) < 1.8 + pad) return true;
  return Math.hypot(x - LAYOUT.hull.x, z - LAYOUT.hull.z) < 1.4 + pad;
}

const WRECK_LIFE = { grow: null };
const INTERACT = { uPlayer: { value: new THREE.Vector3(0, -999, 0) } };

const WU = {
  uSurge: U.uSurge,
  uTime: U.uTime,
  uPlayer: INTERACT.uPlayer,
  uCamPos: { value: new THREE.Vector3(0, -12, 0) },
  uTexA: { value: null },
  uTexB: { value: null },
  uTexC: { value: null },
  uGk: { value: new THREE.Vector2(1, 1) },
};

const Y$1 = new THREE.Vector3(0, 1, 0);
const X = new THREE.Vector3(1, 0, 0);
const ZA$1 = new THREE.Vector3(0, 0, 1);
const fract = (v) => v - Math.floor(v);
function hashI(i, j, s) {
  let h = (Math.imul(i | 0, 374761393) + Math.imul(j | 0, 668265263) + Math.imul(s | 0, 1440662683)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
const gf$3 = (v) => (Number.isInteger(v) ? v.toFixed(1) : String(v));

function builder(spec) {
  const arrs = spec.map(() => []);
  const idx = [];
  let n = 0;
  return {
    v(...vals) {
      let o = 0;
      for (let a = 0; a < spec.length; a++) {
        const s = spec[a][1];
        for (let k = 0; k < s; k++) arrs[a].push(vals[o++]);
      }
      return n++;
    },
    t(a, b, c) { idx.push(a, b, c); },
    q(a, b, c, d) { idx.push(a, c, b, b, c, d); },
    get count() { return n; },
    build(normals = false) {
      const g = new THREE.BufferGeometry();
      spec.forEach(([name, s], a) => g.setAttribute(name, new THREE.Float32BufferAttribute(arrs[a], s)));
      g.setIndex(idx);
      if (normals) g.computeVertexNormals();
      return g;
    },
  };
}

const GRAD = (() => {
  const a = new Float32Array(512);
  for (let i = 0; i < 256; i++) { const t = (i / 256) * Math.PI * 2; a[i * 2] = Math.cos(t); a[i * 2 + 1] = Math.sin(t); }
  return a;
})();

function makeNoiseTextures() {
  const N = 256, NN = N * N;
  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  const pnoise = (x, y, px, py, seed) => {
    const gx = (x * px) / N, gy = (y * py) / N;
    const x0 = Math.floor(gx), y0 = Math.floor(gy);
    const fx = gx - x0, fy = gy - y0;
    const x0w = ((x0 % px) + px) % px, y0w = ((y0 % py) + py) % py;
    const x1w = (x0w + 1) % px, y1w = (y0w + 1) % py;
    const ga = (hashI(x0w, y0w, seed) * 256) | 0, gb = (hashI(x1w, y0w, seed) * 256) | 0;
    const gc = (hashI(x0w, y1w, seed) * 256) | 0, gd = (hashI(x1w, y1w, seed) * 256) | 0;
    const a = GRAD[ga * 2] * fx + GRAD[ga * 2 + 1] * fy;
    const b = GRAD[gb * 2] * (fx - 1) + GRAD[gb * 2 + 1] * fy;
    const c = GRAD[gc * 2] * fx + GRAD[gc * 2 + 1] * (fy - 1);
    const d = GRAD[gd * 2] * (fx - 1) + GRAD[gd * 2 + 1] * (fy - 1);
    const u = fade(fx), v = fade(fy);
    const ab = a + (b - a) * u, cd = c + (d - c) * u;
    return ab + (cd - ab) * v;
  };
  const fbm = (x, y, px, py, oct, seed) => {
    let s = 0, amp = 0.5, n = 0;
    for (let o = 0; o < oct; o++) { s += amp * pnoise(x, y, px << o, py << o, seed + o * 31); n += amp; amp *= 0.5; }
    return s / n;
  };
  const W = [0, 0, 0];
  const worley = (x, y, C, seed) => {
    const cs = N / C;
    const gx = x / cs, gy = y / cs;
    const ix = Math.floor(gx), iy = Math.floor(gy);
    let f1 = 9, f2 = 9, id = 0;
    for (let j = -1; j <= 1; j++) {
      for (let i = -1; i <= 1; i++) {
        const cx = ix + i, cy = iy + j;
        const wx = ((cx % C) + C) % C, wy = ((cy % C) + C) % C;
        const fx = cx + 0.1 + 0.8 * hashI(wx, wy, seed), fy = cy + 0.1 + 0.8 * hashI(wx, wy, seed + 7);
        const d = Math.hypot(fx - gx, fy - gy);
        if (d < f1) { f2 = f1; f1 = d; id = hashI(wx, wy, seed + 13); } else if (d < f2) f2 = d;
      }
    }
    W[0] = f1; W[1] = f2; W[2] = id;
  };
  const hA = new Float32Array(NN), hB = new Float32Array(NN), st = new Float32Array(NN), vC = new Float32Array(NN);
  const f1a = new Float32Array(NN), idA = new Float32Array(NN), edgeC = new Float32Array(NN), f1c = new Float32Array(NN);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const k = y * N + x, px = x + 0.5, py = y + 0.5;
      hA[k] = fbm(px, py, 8, 8, 3, 101);
      hB[k] = fbm(px, py, 4, 4, 2, 211);
      st[k] = fbm(px, py, 3, 48, 2, 307);
      vC[k] = fbm(px, py, 16, 16, 2, 401);
      worley(px, py, 16, 503); f1a[k] = W[0]; idA[k] = W[2];
      worley(px, py, 8, 607); edgeC[k] = W[1] - W[0]; f1c[k] = W[0];
    }
  }
  const norm = (arr) => {
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < arr.length; i++) { const v = arr[i]; if (v < lo) lo = v; if (v > hi) hi = v; }
    const s = 1 / Math.max(1e-6, hi - lo);
    for (let i = 0; i < arr.length; i++) arr[i] = (arr[i] - lo) * s;
  };
  norm(hA); norm(hB); norm(st); norm(vC);
  const grad = (h, out) => {
    let gmax = 1e-6;
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const k = y * N + x;
        const gx = (h[y * N + ((x + 1) % N)] - h[y * N + ((x + N - 1) % N)]) * 0.5 * N;
        const gy = (h[((y + 1) % N) * N + x] - h[((y + N - 1) % N) * N + x]) * 0.5 * N;
        out[k * 2] = gx; out[k * 2 + 1] = gy;
        gmax = Math.max(gmax, Math.abs(gx), Math.abs(gy));
      }
    }
    return gmax;
  };
  const gA = new Float32Array(NN * 2), gB = new Float32Array(NN * 2);
  const mA = grad(hA, gA), mB = grad(hB, gB);
  const b8 = (v) => Math.max(0, Math.min(255, Math.round(v * 255)));
  const dA = new Uint8Array(NN * 4), dB = new Uint8Array(NN * 4), dC = new Uint8Array(NN * 4);
  for (let k = 0; k < NN; k++) {
    dA[k * 4] = b8(0.5 + (0.5 * gA[k * 2]) / mA); dA[k * 4 + 1] = b8(0.5 + (0.5 * gA[k * 2 + 1]) / mA);
    dA[k * 4 + 2] = b8(hA[k]); dA[k * 4 + 3] = b8(f1a[k]);
    dB[k * 4] = b8(0.5 + (0.5 * gB[k * 2]) / mB); dB[k * 4 + 1] = b8(0.5 + (0.5 * gB[k * 2 + 1]) / mB);
    dB[k * 4 + 2] = b8(hB[k]); dB[k * 4 + 3] = b8(st[k]);
    dC[k * 4] = b8(idA[k]); dC[k * 4 + 1] = b8(edgeC[k]); dC[k * 4 + 2] = b8(vC[k]); dC[k * 4 + 3] = b8(f1c[k]);
  }
  const mk = (d) => {
    const t = new THREE.DataTexture(d, N, N, THREE.RGBAFormat, THREE.UnsignedByteType);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.magFilter = THREE.LinearFilter;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.generateMipmaps = true;
    t.anisotropy = 8;
    t.needsUpdate = true;
    return t;
  };
  return { A: mk(dA), B: mk(dB), C: mk(dC), gk: new THREE.Vector2(2 * mA, 2 * mB) };
}

const W_VERT = `
uniform vec3 uSurge;
uniform float uTime;
uniform vec3 uPlayer;
uniform vec3 uCamPos;
float wHv(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec3 wInstPos() {
  #ifdef USE_INSTANCING
    return (modelMatrix * vec4(instanceMatrix[3].xyz, 1.0)).xyz;
  #else
    return (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  #endif
}
vec3 wSwayEnv(vec3 ip, float gust) {
  float ph = dot(ip.xz, vec2(0.21, 0.17));
  vec3 sw = vec3(uSurge.x, 0.0, uSurge.z);
  float w = sin(dot(ip.xz, vec2(0.47, 0.29)) - uTime * 1.25) + 0.6 * sin(dot(ip.xz, vec2(-0.23, 0.61)) - uTime * 0.83 + 1.7);
  sw += vec3(0.86, 0.0, 0.51) * (w * 0.045 * gust);
  sw += vec3(sin(uTime * 1.3 + ph), 0.0, cos(uTime * 1.1 + ph * 1.3)) * 0.035;
  return sw;
}
vec3 wPush(vec3 ip) {
  vec3 toB = vec3(ip.x - uPlayer.x, 0.0, ip.z - uPlayer.z);
  float dB = length(toB);
  float nearY = 1.0 - smoothstep(0.8, 2.6, abs(uPlayer.y - ip.y - 0.3));
  float push = (1.0 - smoothstep(0.3, 1.9, dB)) * nearY;
  return toB / max(dB, 0.001) * (push * 0.75);
}
vec3 wSway(vec3 ip, float gust) { return wSwayEnv(ip, gust) + wPush(ip); }
float wInstScale() {
  #ifdef USE_INSTANCING
    return max(length(instanceMatrix[1].xyz), 1e-3);
  #else
    return 1.0;
  #endif
}
vec3 wToLocal(vec3 v) {
  #ifdef USE_INSTANCING
    mat3 m = mat3(instanceMatrix);
    return (transpose(m) * v) / max(dot(m[0], m[0]), 1e-4);
  #else
    return v;
  #endif
}
float wFadeAt(float d, float far, vec3 ip) {
  float s = far - 12.0 + 6.0 * wHv(ip.xz * 1.93 + 0.37);
  return 1.0 - smoothstep(s, s + 6.0, d);
}
`;

const W_FRAG = `
uniform sampler2D uTexA;
uniform sampler2D uTexB;
uniform sampler2D uTexC;
uniform vec2 uGk;
float wH2(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec3 wPerturb(vec3 n, vec3 gW) {
  vec3 gV = (viewMatrix * vec4(gW, 0.0)).xyz;
  gV -= n * dot(n, gV);
  return normalize(n - gV);
}
vec3 wTriW(vec3 n) { vec3 w = pow(abs(n), vec3(4.0)); return w / (w.x + w.y + w.z + 1e-5); }
vec4 wTriA(vec3 p, vec3 dx, vec3 dy, vec3 w, float s, out float cell) {
  vec4 a = textureGrad(uTexA, p.zy * s, dx.zy * s, dy.zy * s);
  vec4 b = textureGrad(uTexA, p.xz * s, dx.xz * s, dy.xz * s);
  vec4 c = textureGrad(uTexA, p.xy * s, dx.xy * s, dy.xy * s);
  vec2 ga = (a.rg - 0.5) * uGk.x;
  vec2 gb = (b.rg - 0.5) * uGk.x;
  vec2 gc = (c.rg - 0.5) * uGk.x;
  vec3 g = vec3(0.0, ga.y, ga.x) * w.x + vec3(gb.x, 0.0, gb.y) * w.y + vec3(gc.x, gc.y, 0.0) * w.z;
  cell = a.a * w.x + b.a * w.y + c.a * w.z;
  return vec4(g * s, a.b * w.x + b.b * w.y + c.b * w.z);
}
vec4 wTriC(vec3 p, vec3 dx, vec3 dy, vec3 w, float s) {
  return textureGrad(uTexC, p.zy * s, dx.zy * s, dy.zy * s) * w.x
       + textureGrad(uTexC, p.xz * s, dx.xz * s, dy.xz * s) * w.y
       + textureGrad(uTexC, p.xy * s, dx.xy * s, dy.xy * s) * w.z;
}
float wGlowK() {
  return smoothstep(0.35, 1.0, uLight) * exp(-length(vWPos - cameraPosition) * 0.045);
}
vec3 wBumpH(vec3 n, float h) {
  vec3 vp = -vViewPosition;
  vec3 dpx = dFdx(vp);
  vec3 dpy = dFdy(vp);
  float hx = dFdx(h);
  float hy = dFdy(h);
  vec3 r1 = cross(dpy, n);
  vec3 r2 = cross(n, dpx);
  float det = dot(dpx, r1);
  vec3 sg = sign(det) * (hx * r1 + hy * r2);
  return normalize(abs(det) * n - sg);
}
`;

const AO_APPLY = `
reflectedLight.indirectDiffuse *= wAO;
reflectedLight.indirectSpecular *= wAO;
`;

const TRANSLUCENT = (k) => `
#if NUM_DIR_LIGHTS > 0
{
  float wBk = max(-dot(geometryNormal, directLight.direction), 0.0);
  float wFw = pow(max(dot(-geometryViewDir, directLight.direction), 0.0), 3.0);
  float wTk = mix(0.25, 1.0, wGlowK()) * exp(-length(vWPos - cameraPosition) * 0.03);
  reflectedLight.directDiffuse += diffuseColor.rgb * vec3(1.0, 1.08, 0.72) * directLight.color * ((wBk * 0.45 + wFw * 0.8) * ${k} * wTk);
}
#endif
`;

const FLUO_LIGHTS = `
#if NUM_DIR_LIGHTS > 0
reflectedLight.directDiffuse += wFluo * (dot(directLight.color, vec3(0.0, 0.5, 0.5)) * (0.2 + 0.8 * max(dot(geometryNormal, directLight.direction), 0.0)) * wGlowK());
#endif
`;
const FLUO_AMBIENT = 'totalEmissiveRadiance += wFluo * (0.12 * uLight * wGlowK());\n';

const PIG_WB = `
#if defined( RE_IndirectDiffuse )
{
  float wPk = wPig * uWarmNear * (1.0 - smoothstep(6.0, 16.0, length(vWPos - cameraPosition)));
  if (wPk > 0.001) {
    irradiance = mix(irradiance, vec3(dot(irradiance, vec3(0.2126, 0.7152, 0.0722))), wPk);
    iblIrradiance = mix(iblIrradiance, vec3(dot(iblIrradiance, vec3(0.2126, 0.7152, 0.0722))), wPk);
    reflectedLight.directDiffuse *= mix(vec3(1.0), clamp(vec3(dot(causticMod, vec3(0.2126, 0.7152, 0.0722))) / max(causticMod, vec3(1e-4)), 0.7, 1.8), wPk);
  }
}
#endif
`;

const plantVert = (hExpr, amp, far, extra = '', scaled = false) => `
vec3 wIp = wInstPos();
float wDc = distance(wIp, uCamPos);
if (wDc > ${gf$3(far)}) { gl_Position = vec4(0.0, 0.0, 2.0, 1.0); return; }
{
  float wH = clamp(${hExpr}, 0.0, 1.5);
  vec3 wSw = wToLocal(${scaled ? 'wSwayEnv(wIp, 1.0) * wInstScale() + wPush(wIp)' : 'wSway(wIp, 1.0)'});
  float wB = wH * wH * ${gf$3(amp)};
  transformed += vec3(wSw.x, 0.0, wSw.z) * wB;
  transformed.y -= length(wSw.xz) * wB * 0.25;
}
${extra}
transformed *= wFadeAt(wDc, ${gf$3(far)}, wIp);
`;
const cullVert = (far, extra = '') => `
float wFd = 1.0;
{
  vec3 wIc = wInstPos();
  float wDc = distance(wIc, uCamPos);
  if (wDc > ${gf$3(far)}) { gl_Position = vec4(0.0, 0.0, 2.0, 1.0); return; }
  wFd = wFadeAt(wDc, ${gf$3(far)}, wIc);
}
${extra}
transformed *= wFd;
`;

function worldMaterial(mat, key, o = {}) {
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, WU, o.uniforms || {});
    let vs = shader.vertexShader;
    let fs = shader.fragmentShader;
    vs = vs.replace('#include <common>', '#include <common>\n' + W_VERT + (o.vDecl || ''));
    if (o.vNormal) vs = vs.replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\n' + o.vNormal);
    if (o.vBegin) vs = vs.replace('#include <begin_vertex>', '#include <begin_vertex>\n' + o.vBegin);
    fs = fs.replace('#include <common>', '#include <common>\n' + W_FRAG + (o.fDecl || ''));
    if (o.fColor) fs = fs.replace('#include <color_fragment>', '#include <color_fragment>\n' + o.fColor);
    if (o.fRough) fs = fs.replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\n' + o.fRough);
    if (o.fNormal) fs = fs.replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n' + o.fNormal);
    if (o.fEmissive) fs = fs.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n' + o.fEmissive);
    if (o.fLights) fs = fs.replace('#include <lights_fragment_maps>', '#include <lights_fragment_maps>\n' + o.fLights);
    if (o.fAO) fs = fs.replace('#include <aomap_fragment>', '#include <aomap_fragment>\n' + o.fAO);
    shader.vertexShader = vs;
    shader.fragmentShader = fs;
  };
  mat.customProgramCacheKey = () => 'wld2-' + key;
  return patchMaterial(mat, o.patch || {});
}

function swayDepthMaterial(key, vDecl, vBegin) {
  const m = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, WU);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\n' + W_VERT + vDecl)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n' + vBegin);
  };
  m.customProgramCacheKey = () => 'wld2-depth-' + key;
  return m;
}

const TILE = 25;
const TILE_MIN_TRIS = 200000;
const TILE_PAD = 1.0;
function makeInstanced(geo, mat, items, { cast = false, receive = true, extra = null, depth = null, tiles = false, tile = TILE } = {}) {
  const tris = (geo.index ? geo.index.count : geo.attributes.position.count) / 3;
  const cells = new Map();
  if (tiles || tris * items.length >= TILE_MIN_TRIS) {
    items.forEach((it, i) => {
      const k = it.tile || `${Math.floor(it.p.x / tile)},${Math.floor(it.p.z / tile)}`;
      let a = cells.get(k);
      if (!a) cells.set(k, (a = []));
      a.push(i);
    });
  }
  if (cells.size < 2) return instancedPart(geo, mat, items, items.map((_, i) => i), { cast, receive, extra, depth, pad: 0 });
  if (!geo.boundingSphere) geo.computeBoundingSphere();
  const group = new THREE.Group();
  for (const idx of cells.values()) {
    const tg = new THREE.BufferGeometry();
    tg.setIndex(geo.index);
    for (const k in geo.attributes) tg.setAttribute(k, geo.attributes[k]);
    tg.boundingSphere = geo.boundingSphere;
    group.add(instancedPart(tg, mat, items, idx, { cast, receive, extra, depth, pad: TILE_PAD }));
  }
  return group;
}
function shareGeo(geo) {
  const tg = new THREE.BufferGeometry();
  tg.setIndex(geo.index);
  for (const k in geo.attributes) if (!geo.attributes[k].isInstancedBufferAttribute) tg.setAttribute(k, geo.attributes[k]);
  if (!geo.boundingSphere) geo.computeBoundingSphere();
  tg.boundingSphere = geo.boundingSphere;
  return tg;
}
function instancedPart(geo, mat, items, idx, { cast, receive, extra, depth, pad }) {
  const n = Math.max(1, idx.length);
  if (extra) {
    for (const [name, size, fn] of extra) {
      const arr = new Float32Array(n * size);
      idx.forEach((i, j) => {
        const v = fn(items[i], i);
        if (size === 1) arr[j] = v; else for (let k = 0; k < size; k++) arr[j * size + k] = v[k];
      });
      geo.setAttribute(name, new THREE.InstancedBufferAttribute(arr, size));
    }
  }
  const mesh = new THREE.InstancedMesh(geo, mat, n);
  const M = new THREE.Matrix4();
  idx.forEach((i, j) => {
    const it = items[i];
    M.compose(it.p, it.q, it.s);
    mesh.setMatrixAt(j, M);
    if (it.c) mesh.setColorAt(j, it.c);
  });
  mesh.count = idx.length;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  if (depth) mesh.customDepthMaterial = depth;
  mesh.computeBoundingSphere();
  mesh.boundingSphere.radius += pad;
  return mesh;
}
const _lf = new THREE.Frustum(), _lm = new THREE.Matrix4(), _ls = new THREE.Sphere(), _lnear = [];
class LodSet {
  constructor(items, geoN, geoF, mat, extra, d) {
    this.items = items;
    this.d = d;
    this.st = new Uint8Array(items.length);
    const all = items.map((_, i) => i), o = { cast: false, receive: true, extra, depth: null, pad: 1.0 };
    this.near = instancedPart(geoN, mat, items, all, o);
    this.far = instancedPart(geoF, mat, items, all, o);
    this.M = this.near.instanceMatrix.array.slice();
    this.X = (extra || []).map(([name, size]) => [name, size, this.near.geometry.attributes[name].array.slice()]);
    this.c = items.map((it) => { const u = new THREE.Vector3(0, 0.5 * it.s.y, 0).applyQuaternion(it.q).add(it.p); return [u.x, u.y, u.z, 0.75 * Math.max(it.s.x, it.s.y) + 0.35]; });
    this.first = true;
  }
  static updateAll(sets, camera, max) {
    camera.updateMatrixWorld();
    _lf.setFromProjectionMatrix(_lm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    const cam = camera.position, near = _lnear;
    near.length = 0;
    for (const S of sets) {
      S.want = S.want || new Uint8Array(S.items.length);
      for (let i = 0; i < S.items.length; i++) {
        const c = S.c[i], dd = Math.hypot(c[0] - cam.x, c[1] - cam.y, c[2] - cam.z);
        _ls.center.set(c[0], c[1], c[2]); _ls.radius = c[3];
        const w = !_lf.intersectsSphere(_ls) ? 0 : (S.st[i] === 2 ? dd < S.d + 0.5 : dd < S.d - 0.5) ? 2 : 1;
        S.want[i] = w;
        if (w === 2) near.push(dd, S.st[i] === 2 ? 1 : 0, sets.indexOf(S), i);
      }
    }
    if (near.length / 4 > max) {
      const ord = [];
      for (let k = 0; k < near.length; k += 4) ord.push(k);
      ord.sort((a, b) => near[a] - near[b]);
      ord.forEach((k, r) => { if (r >= max + (near[k + 1] ? 3 : 0) && near[k] > 5.0) sets[near[k + 2]].want[near[k + 3]] = 1; });
    }
    for (const S of sets) if (S.shared) S.far.count = 0;
    for (const S of sets) S.apply();
  }
  update(camera) { LodSet.updateAll([this], camera, Infinity); }
  static shareFar(sets, geoF, mat, extra) {
    const all = [].concat(...sets.map((S) => S.items));
    const far = instancedPart(geoF, mat, all, all.map((_, i) => i), { cast: false, receive: true, extra, depth: null, pad: 1.0 });
    for (const S of sets) { S.far = far; S.shared = true; S.first = true; }
    return far;
  }
  apply() {
    const n = this.items.length;
    let changed = this.first || this.shared;
    for (let i = 0; i < n; i++) if (this.want[i] !== this.st[i]) { this.st[i] = this.want[i]; changed = true; }
    this.first = false;
    if (!changed) return;
    let a = 0, b = this.shared ? this.far.count : 0;
    const MN = this.near.instanceMatrix.array, MF = this.far.instanceMatrix.array;
    for (let i = 0; i < n; i++) {
      const s = this.st[i];
      if (!s) continue;
      const nr = s === 2, j = nr ? a++ : b++;
      (nr ? MN : MF).set(this.M.subarray(i * 16, i * 16 + 16), j * 16);
      for (const [name, size, src] of this.X) (nr ? this.near : this.far).geometry.attributes[name].array.set(src.subarray(i * size, i * size + size), j * size);
    }
    for (const [m, k] of [[this.near, a], [this.far, b]]) {
      m.count = k;
      m.visible = k > 0;
      m.instanceMatrix.needsUpdate = true;
      for (const [name] of this.X) m.geometry.attributes[name].needsUpdate = true;
    }
  }
}
function orient$1(nx, ny, nz, upBias, spin) {
  const n = new THREE.Vector3(nx, ny, nz).lerp(Y$1, upBias).normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(Y$1, n);
  return q.multiply(new THREE.Quaternion().setFromAxisAngle(Y$1, spin));
}
const sv = (s) => new THREE.Vector3(s, s, s);

function meadowAt(x, z) {
  floorHeight(x, z);
  return MF.cover;
}

function gridAxis(c, half, inner, s0, grow) {
  const step = (d) => s0 + Math.max(0, d - inner) * grow;
  const up = [c];
  for (;;) {
    const last = up[up.length - 1], st = step(last - c);
    if (last + st >= half - 0.5 * st) break;
    up.push(last + st);
  }
  up.push(half);
  const down = [];
  let v = c;
  for (;;) {
    const st = step(c - v);
    if (v - st <= -half + 0.5 * st) break;
    v -= st;
    down.push(v);
  }
  down.push(-half);
  return Float64Array.from([...down.reverse(), ...up]);
}
function axisLUT(xs) {
  const lo = xs[0], hi = xs[xs.length - 1], N = 4096;
  const lut = new Int32Array(N + 1);
  let i = 0;
  for (let b = 0; b <= N; b++) {
    const v = lo + ((hi - lo) * b) / N;
    while (i < xs.length - 2 && xs[i + 1] <= v) i++;
    lut[b] = i;
  }
  return { lo, inv: N / (hi - lo), lut, N, last: xs.length - 2 };
}
function cellOf(xs, A, v) {
  if (v <= A.lo) return 0;
  let i = A.lut[Math.min(A.N, Math.floor((v - A.lo) * A.inv))];
  while (i < A.last && xs[i + 1] <= v) i++;
  while (i > 0 && xs[i] > v) i--;
  return i;
}
function makeGrid(xs, zs, H, S, CV = null, FR = null) {
  const nx = xs.length, AX = axisLUT(xs), AZ = axisLUT(zs);
  const bil = (A, x, z) => {
    const i = cellOf(xs, AX, x), j = cellOf(zs, AZ, z);
    const fx = clamp$9((x - xs[i]) / (xs[i + 1] - xs[i]), 0, 1), fz = clamp$9((z - zs[j]) / (zs[j + 1] - zs[j]), 0, 1);
    const k = j * nx + i;
    return lerp$4(lerp$4(A[k], A[k + 1], fx), lerp$4(A[k + nx], A[k + nx + 1], fx), fz);
  };
  return {
    cover(x, z) { return CV ? bil(CV, x, z) : 0; },
    fringe(x, z) { return FR ? bil(FR, x, z) : 0; },
    height(x, z) {
      const i = cellOf(xs, AX, x), j = cellOf(zs, AZ, z);
      const fx = clamp$9((x - xs[i]) / (xs[i + 1] - xs[i]), 0, 1), fz = clamp$9((z - zs[j]) / (zs[j + 1] - zs[j]), 0, 1);
      const k = j * nx + i;
      const a = H[k], b = H[k + 1], c = H[k + nx], d = H[k + nx + 1];
      return fx + fz <= 1 ? a + (b - a) * fx + (c - a) * fz : d + (c - d) * (1 - fx) + (b - d) * (1 - fz);
    },
    normal(x, z) {
      const i = cellOf(xs, AX, x), j = cellOf(zs, AZ, z);
      const dx = xs[i + 1] - xs[i], dz = zs[j + 1] - zs[j];
      const fx = clamp$9((x - xs[i]) / dx, 0, 1), fz = clamp$9((z - zs[j]) / dz, 0, 1);
      const k = j * nx + i;
      const a = H[k], b = H[k + 1], c = H[k + nx], d = H[k + nx + 1];
      const sx = fx + fz <= 1 ? (b - a) / dx : (d - c) / dx;
      const sz = fx + fz <= 1 ? (c - a) / dz : (d - b) / dz;
      return new THREE.Vector3(-sx, 1, -sz).normalize();
    },
    sand(x, z) {
      const i = cellOf(xs, AX, x), j = cellOf(zs, AZ, z);
      const fx = clamp$9((x - xs[i]) / (xs[i + 1] - xs[i]), 0, 1), fz = clamp$9((z - zs[j]) / (zs[j + 1] - zs[j]), 0, 1);
      const k = j * nx + i;
      return lerp$4(lerp$4(S[k], S[k + 1], fx), lerp$4(S[k + nx], S[k + nx + 1], fx), fz);
    },
  };
}

const TER_VDECL = `
attribute vec4 aTer;
attribute vec3 aTer2;
varying vec4 vTer;
varying vec3 vTer2;
`;
const TER_FDECL = `
varying vec4 vTer;
varying vec3 vTer2;
`;
const TER_FCOLOR = `
vec3 wDx = dFdx(vWPos);
vec3 wDy = dFdy(vWPos);
float wFoot = max(length(wDx), length(wDy));
float wDist = length(vWPos - cameraPosition);
vec3 wGrad = vec3(0.0);
float wAO = vTer.w;
float wRough = 0.94;
float wSpark = 0.0;
vec3 wSparkN = vec3(0.0, 1.0, 0.0);
float wSheen = 0.0;
vec3 wFluo = vec3(0.0);
{
  vec2 p = vWPos.xz;
  vec2 pdx = wDx.xz;
  vec2 pdy = wDy.xz;
  float sand = vTer.x;
  float canopy = vTer.y;
  float litter = vTer.z;
  float organic = vTer2.z;
  float rip = vTer2.y * (1.0 - 0.6 * smoothstep(8.0, 40.0, wDist));
  vec3 col = diffuseColor.rgb;
  vec4 mA = texture2D(uTexB, p * 0.029 + vec2(0.31, 0.17));
  vec4 mB = texture2D(uTexB, p * 0.113 + vec2(0.63, 0.41));
  vec4 mC = texture2D(uTexB, p * 0.37 + vec2(0.17, 0.89));
  vec4 mD = texture2D(uTexB, p * 0.21 + vec2(0.47, 0.13));
  float gold = smoothstep(0.45, 0.8, mA.b);
  float silt = smoothstep(0.5, 0.85, 1.0 - mA.b) * smoothstep(0.3, 0.7, mB.b);
  col *= mix(vec3(1.0), vec3(1.06, 1.0, 0.88), gold * 0.8);
  col *= mix(vec3(1.0), vec3(0.9, 0.92, 0.95), silt * 0.8);
  col *= 0.94 + 0.12 * mC.b;
  float org = organic * smoothstep(0.35, 0.7, mD.b + (mC.b - 0.5) * 0.3);
  col = mix(col, col * vec3(0.7, 0.68, 0.58), org * 0.75);
  vec4 wa = texture2D(uTexB, p * 0.061 + vec2(0.13, 0.57));
  vec4 wb = texture2D(uTexB, p * 0.17 + vec2(0.71, 0.29));
  vec2 d1 = vec2(0.86, 0.51);
  float ph1 = dot(p, d1) * 7.4 + (wa.b - 0.5) * 9.0;
  vec2 gp1 = d1 * 7.4 + (wa.rg - 0.5) * (uGk.y * 0.061 * 9.0);
  float h1 = 0.5 + 0.5 * cos(ph1);
  float a1 = (0.35 + 0.65 * smoothstep(0.3, 0.7, mB.b)) * (1.0 - smoothstep(0.08, 0.3, wFoot * 1.18)) * rip;
  vec2 d2 = vec2(0.28, 0.96);
  float ph2 = dot(p, d2) * 15.7 + (wb.b - 0.5) * 11.0;
  vec2 gp2 = d2 * 15.7 + (wb.rg - 0.5) * (uGk.y * 0.17 * 11.0);
  float a2 = smoothstep(0.35, 0.8, mD.b) * (1.0 - smoothstep(0.08, 0.3, wFoot * 2.5)) * rip;
  vec2 d3 = vec2(0.97, -0.24);
  float kR = 52.0;
  float ph3 = dot(p, d3) * kR + (mC.b - 0.5) * 7.0 + (wb.b - 0.5) * 16.0 + (wa.b - 0.5) * 24.0;
  vec2 gp3 = d3 * kR + (mC.rg - 0.5) * (uGk.y * 0.37 * 7.0) + (wb.rg - 0.5) * (uGk.y * 0.17 * 16.0) + (wa.rg - 0.5) * (uGk.y * 0.061 * 24.0);
  float asy = ph3 + 0.5 * sin(ph3);
  float h3 = 0.5 + 0.5 * cos(asy);
  float dh3 = -0.5 * sin(asy) * (1.0 + 0.5 * cos(ph3));
  float a3 = (0.3 + 0.7 * smoothstep(0.25, 0.65, mD.b)) * (1.0 - smoothstep(0.12, 0.4, wFoot * kR * 0.159)) * rip;
  wGrad.xz += gp1 * (-0.5 * sin(ph1) * 0.022 * a1) + gp2 * (-0.5 * sin(ph2) * 0.006 * a2) + gp3 * (dh3 * 0.009 * a3);
  col *= 1.0 + 0.03 * (h1 - 0.5) * a1 + 0.07 * (h3 - 0.5) * a3;
  wAO *= 1.0 - 0.04 * (1.0 - h1) * a1 - 0.12 * (1.0 - h3) * a3;
  vec4 g1 = texture2D(uTexA, p * 1.85 + vec2(0.11, 0.83));
  vec4 g2 = texture2D(uTexA, p * 7.3 + vec2(0.47, 0.19));
  vec4 gc = texture2D(uTexC, p * 21.0 + vec2(0.37, 0.61));
  wGrad.xz += (g1.rg - 0.5) * (uGk.x * 1.85 * 0.0016) + (g2.rg - 0.5) * (uGk.x * 7.3 * 0.0006);
  float grainK = 0.4 + 0.6 * (1.0 - smoothstep(0.0015, 0.006, wFoot));
  col *= 1.0 + ((gc.b - 0.5) * 0.16 + (g2.b - 0.5) * 0.08) * grainK;
  float det = smoothstep(0.4, 0.75, g1.b) * max((1.0 - h1) * a1, (1.0 - h3) * a3);
  col = mix(col, col * vec3(0.9, 0.88, 0.84), det * 0.5);
  vec4 sc = texture2D(uTexC, p * 1.85 + vec2(0.11, 0.83));
  float chip = step(0.995, sc.r) * (1.0 - smoothstep(0.05, 0.08, g1.a))
    * (1.0 - smoothstep(0.002, 0.006, wFoot)) * sand * (1.0 - canopy);
  col = mix(col, mix(vec3(0.72, 0.7, 0.65), vec3(0.7, 0.57, 0.56), step(0.5, g2.b)), chip * 0.65);
  wSpark = chip * step(0.999, sc.r);
  wSparkN = normalize(vec3(sin(g1.b * 517.0), 2.4, cos(g1.b * 311.0)));
  float bedK = sand * (1.0 - canopy) * (1.0 - smoothstep(12.0, 28.0, wDist));
  float sgPat = 0.0, sgHash = 0.0;
  if (bedK > 0.001) {
    vec2 sgq = p * 0.23 + vec2(0.29, 0.61), shq = p * 0.19 + vec2(0.83, 0.07);
    sgPat = smoothstep(0.5, 0.8, textureGrad(uTexB, sgq, pdx * 0.23, pdy * 0.23).b + (mD.b - 0.5) * 0.3);
    sgHash = smoothstep(0.55, 0.85, textureGrad(uTexB, shq, pdx * 0.19, pdy * 0.19).b + (mB.b - 0.5) * 0.3) * (1.0 - sgPat);
    col *= mix(vec3(1.0), vec3(0.88, 0.82, 0.87), sgPat * bedK * 0.8);
    col *= mix(vec3(1.0), vec3(1.05, 1.02, 0.94), sgHash * bedK * 0.7);
  }
  float sgNear = (1.0 - smoothstep(3.0, 8.0, wDist)) * sand * (1.0 - canopy);
  if (sgNear > 0.001) {
    float sgTr = smoothstep(0.35, 0.8, max((1.0 - h1) * a1, (1.0 - h3) * a3));
    float sgDen = 0.02 * smoothstep(0.3, 0.7, mC.b + (g1.b - 0.5) * 0.4) + 0.26 * max(sgPat, sgHash) + 0.2 * sgTr;
    vec2 sgId = floor(p * 40.0), sgF = fract(p * 40.0) - 0.5;
    float k1 = wH2(sgId + 3.1), k2 = wH2(sgId + 11.7), k3 = wH2(sgId + 23.9), k4 = wH2(sgId + 37.3), k5 = wH2(sgId + 51.9) * 6.2832;
    vec2 sgV = mat2(cos(k5), sin(k5), -sin(k5), cos(k5)) * (sgF - (vec2(k2, k3) - 0.5) * 0.24) * vec2(1.0, 1.0 + 0.5 * k3);
    float sgAng = atan(sgV.y, sgV.x);
    float sgR = (0.05 + 0.22 * k4 * k4 * k4) * (1.0 + 0.12 * sin(sgAng * 2.0 + k2 * 6.28) + 0.07 * sin(sgAng * 5.0 + k3 * 6.28));
    float sgD = (length(sgV) - sgR) / 40.0;
    float sgAa = max(wFoot, 0.0006);
    float sgA = step(1.0 - sgDen, k1) * (1.0 - smoothstep(-sgAa - 0.001, sgAa, sgD));
    vec3 sgM = mix(vec3(0.46, 0.27, 0.27), vec3(0.56, 0.33, 0.31), k4);
    vec3 sgS = mix(vec3(0.74, 0.69, 0.58), vec3(0.76, 0.62, 0.49), k4);
    vec3 sgP = mix(vec3(0.3, 0.27, 0.14), vec3(0.4, 0.33, 0.17), k4);
    vec3 sgB = vec3(0.21, 0.2, 0.18) * (0.8 + 0.4 * k4);
    float sgKs = step(0.3 + 0.35 * sgPat - 0.2 * sgHash, k3);
    vec3 sgCol = mix(mix(mix(sgM, sgS, sgKs), sgP, step(0.7, k3)), sgB, step(0.88, k3));
    float sgRes = 1.0 - smoothstep(0.003, 0.008, wFoot);
    col = mix(col, sgCol, sgA * sgRes * sgNear * (0.45 + 0.3 * k2));
    wFluo = sgCol * vec3(1.0, 0.35, 0.4) * (0.14 * sgA * sgRes * (1.0 - sgKs) * sgNear);
  }
  if (litter > 0.01) {
    vec2 cid = floor(p * 2.4);
    vec2 cp = p - (cid + 0.5) / 2.4;
    float r1 = wH2(cid);
    float r2 = wH2(cid + 17.31);
    float r3 = wH2(cid + 41.73);
    float r4 = wH2(cid + 7.19);
    float ang = r2 * 6.2831853;
    vec2 dir = vec2(cos(ang), sin(ang));
    float halfLen = 0.045 + 0.065 * r3;
    vec2 q = cp - (vec2(r3, r4) - 0.5) * (0.41 - 2.0 * halfLen);
    float along = dot(q, dir);
    float across = dot(q, vec2(-dir.y, dir.x)) - along * along * (r4 - 0.5) * 3.0;
    float sd = max(abs(along) - halfLen, abs(across) - (0.004 + 0.003 * r4));
    float aa = max(wFoot, 0.0006);
    float m = step(1.0 - 0.28 * litter, r1) * (1.0 - smoothstep(-aa, aa, sd)) * (1.0 - smoothstep(0.004, 0.012, wFoot));
    vec3 lc = mix(vec3(0.46, 0.37, 0.2), vec3(0.33, 0.29, 0.15), r2);
    lc = mix(lc, vec3(0.6, 0.54, 0.4), step(0.82, r3));
    col = mix(col, lc, m * 0.85);
  }
  if (canopy > 0.01) {
    mat2 r3 = mat2(0.978, 0.208, -0.208, 0.978);
    float fib = textureGrad(uTexB, r3 * p * 2.3, (r3 * pdx) * 2.3, (r3 * pdy) * 2.3).a;
    vec3 matte = mix(vec3(0.19, 0.16, 0.09), vec3(0.28, 0.23, 0.13), fib) * (0.9 + 0.2 * g1.b);
    float wall = 1.0 - smoothstep(0.5, 0.82, normalize(vWNrm).y);
    vec2 wq = vec2(dot(p, vec2(0.51, -0.86)) * 0.6, vWPos.y * 3.2);
    float lay = textureGrad(uTexB, wq, dFdx(wq), dFdy(wq)).a;
    vec3 wallC = mix(vec3(0.1, 0.075, 0.045), vec3(0.26, 0.2, 0.12), lay) * (0.85 + 0.3 * g2.b);
    wallC = mix(wallC, col, smoothstep(0.55, 0.8, g1.b) * 0.35);
    mat2 rs = mat2(0.86, 0.51, -0.51, 0.86);
    vec2 sq = (rs * p) * vec2(0.17, 0.125);
    float bl = textureGrad(uTexB, sq, (rs * pdx) * vec2(0.17, 0.125), (rs * pdy) * vec2(0.17, 0.125)).a;
    float pt = texture2D(uTexB, p * 0.043 + vec2(0.37, 0.71)).b;
    float gust = sin(dot(p, vec2(0.47, 0.29)) - uTime * 1.25) + 0.6 * sin(dot(p, vec2(-0.23, 0.61)) - uTime * 0.83 + 1.7);
    vec3 leaf = mix(vec3(0.15, 0.2, 0.07), vec3(0.25, 0.29, 0.1), bl) * (0.78 + 0.44 * pt);
    leaf = mix(leaf, vec3(0.33, 0.27, 0.13), smoothstep(0.62, 0.9, mA.b) * 0.45);
    leaf *= 1.0 + 0.08 * gust;
    float farK = smoothstep(7.0, 24.0, wDist);
    vec3 top = mix(leaf * 0.55 + matte * 0.25, leaf, farK);
    col = mix(col, mix(top, wallC, wall), canopy);
    wAO *= 1.0 - canopy * (1.0 - wall) * mix(0.28, 0.05, farK);
    wGrad *= 1.0 - canopy * 0.7;
    wRough = mix(wRough, 0.62, canopy * farK * (1.0 - wall));
    wSheen = canopy * farK * (1.0 - wall) * (0.55 + 0.45 * gust);
  }
  if (sand < 0.995) {
    float rk = 1.0 - sand;
    vec3 nW = normalize(vWNrm);
    vec3 tw = wTriW(nW);
    float c1;
    float c2;
    vec4 r1 = wTriA(vWPos, wDx, wDy, tw, 0.7, c1);
    vec4 r2 = wTriA(vWPos, wDx, wDy, tw, 2.9, c2);
    float rkm = smoothstep(0.1, 0.9, rk + (r1.w - 0.5) * 0.45 + (mC.b - 0.5) * 0.2) * smoothstep(0.0, 0.15, rk);
    vec3 rc = diffuseColor.rgb * (0.8 + 0.4 * r2.w);
    float pit = (1.0 - smoothstep(0.05, 0.12, c2)) * smoothstep(0.5, 0.7, r1.w) * smoothstep(0.35, 0.85, rk);
    rc *= (1.0 - 0.4 * pit) * (0.9 + 0.2 * (1.0 - c1));
    col = mix(col, rc, rkm);
    wGrad += (r1.xyz * 0.045 + r2.xyz * 0.013) * rkm;
    wAO *= 1.0 - 0.3 * pit * rkm;
    wRough = mix(wRough, 0.88, rkm);
  }
  diffuseColor.rgb = col * mix(1.0, wAO, 0.3);
}
`;
const TER_FLIGHTS = `
#if NUM_DIR_LIGHTS > 0
if (wSpark > 0.0) {
  vec3 wSn = normalize((viewMatrix * vec4(wSparkN, 0.0)).xyz);
  vec3 wHv2 = normalize(directLight.direction + geometryViewDir);
  reflectedLight.directSpecular += directLight.color * (pow(max(dot(wSn, wHv2), 0.0), 120.0) * wSpark * 2.5);
}
if (wSheen > 0.0) {
  vec3 wHs = normalize(directLight.direction + geometryViewDir);
  reflectedLight.directSpecular += directLight.color * diffuseColor.rgb * (pow(max(dot(geometryNormal, wHs), 0.0), 6.0) * wSheen * 0.9);
}
#endif
`;

let TER_K = 1;
function buildTerrain$1(occl, patches = []) {
  const xs = gridAxis(LAYOUT.wreck.x, 150, 50, 0.3 * TER_K, 0.045);
  const zs = gridAxis(LAYOUT.wreck.z, 150, 50, 0.3 * TER_K, 0.045);
  const nx = xs.length, nz = zs.length, count = nx * nz;
  const pos = new Float32Array(count * 3);
  const H = new Float32Array(count), R = new Float32Array(count), S = new Float32Array(count);
  const MT = new Float32Array(count), CV = new Float32Array(count), FR = new Float32Array(count), SA = new Float32Array(count);
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const x = xs[i], z = zs[j], k = j * nx + i;
      const h = floorHeight(x, z);
      H[k] = h; R[k] = lastRock;
      MT[k] = MF.matte; CV[k] = MF.cover; FR[k] = MF.fringe; SA[k] = MF.sand;
      pos[k * 3] = x; pos[k * 3 + 1] = h; pos[k * 3 + 2] = z;
    }
  }
  const PB = new Map(), pbk = (i, j) => i * 4096 + j;
  for (const pt of patches) {
    for (let i = Math.floor((pt.x - pt.r * 1.5 - 0.5) / 4); i <= Math.floor((pt.x + pt.r * 1.5 + 0.5) / 4); i++) {
      for (let j = Math.floor((pt.z - pt.r * 1.5 - 0.5) / 4); j <= Math.floor((pt.z + pt.r * 1.5 + 0.5) / 4); j++) { let a = PB.get(pbk(i, j)); if (!a) PB.set(pbk(i, j), (a = [])); a.push(pt); }
    }
  }
  const idx = new Uint32Array((nx - 1) * (nz - 1) * 6);
  let t = 0;
  for (let j = 0; j < nz - 1; j++) {
    for (let i = 0; i < nx - 1; i++) {
      const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1;
      idx[t++] = a; idx[t++] = c; idx[t++] = b;
      idx[t++] = b; idx[t++] = c; idx[t++] = d;
    }
  }
  const blur = (src, alongX) => {
    const out = new Float32Array(count);
    for (let j = 0; j < nz; j++) {
      for (let i = 0; i < nx; i++) {
        let s = 0, w = 0;
        for (let o = -2; o <= 2; o++) {
          const ii = alongX ? clamp$9(i + o, 0, nx - 1) : i, jj = alongX ? j : clamp$9(j + o, 0, nz - 1);
          const wt = o === 0 ? 6 : Math.abs(o) === 1 ? 4 : 1;
          s += src[jj * nx + ii] * wt; w += wt;
        }
        out[j * nx + i] = s / w;
      }
    }
    return out;
  };
  const H0 = new Float32Array(count);
  for (let k = 0; k < count; k++) H0[k] = H[k] - MT[k];
  const Hs = blur(blur(H0, true), false);
  const nrm = new Float32Array(count * 3), slopeB = new Float32Array(count);
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const i0 = Math.max(0, i - 1), i1 = Math.min(nx - 1, i + 1), j0 = Math.max(0, j - 1), j1 = Math.min(nz - 1, j + 1);
      const ddx = xs[i1] - xs[i0], ddz = zs[j1] - zs[j0], k = j * nx + i;
      const bx = (Hs[j * nx + i1] - Hs[j * nx + i0]) / ddx, bz = (Hs[j1 * nx + i] - Hs[j0 * nx + i]) / ddz;
      slopeB[k] = 1 - 1 / Math.sqrt(bx * bx + 1 + bz * bz);
      const sx = bx + (MT[j * nx + i1] - MT[j * nx + i0]) / ddx, sz = bz + (MT[j1 * nx + i] - MT[j0 * nx + i]) / ddz;
      const l = Math.sqrt(sx * sx + 1 + sz * sz);
      nrm[k * 3] = -sx / l; nrm[k * 3 + 1] = 1 / l; nrm[k * 3 + 2] = -sz / l;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  const grid = makeGrid(xs, zs, H, S, CV, FR);

  const BK = 8, nb = Math.ceil(300 / BK);
  const buckets = Array.from({ length: nb * nb }, () => []);
  for (const o of occl) {
    const r = o.r * 4;
    const bj0 = clamp$9(Math.floor((o.z - r + 150) / BK), 0, nb - 1), bj1 = clamp$9(Math.floor((o.z + r + 150) / BK), 0, nb - 1);
    const bi0 = clamp$9(Math.floor((o.x - r + 150) / BK), 0, nb - 1), bi1 = clamp$9(Math.floor((o.x + r + 150) / BK), 0, nb - 1);
    for (let bj = bj0; bj <= bj1; bj++) for (let bi = bi0; bi <= bi1; bi++) buckets[bj * nb + bi].push(o);
  }

  const col = new Float32Array(count * 3), ter = new Float32Array(count * 4), ter2 = new Float32Array(count * 3);
  const dirs = [];
  for (let a = 0; a < 8; a++) dirs.push([Math.cos((a * Math.PI) / 4), Math.sin((a * Math.PI) / 4)]);
  const radii = [1.2, 3.4];
  for (let k = 0; k < count; k++) {
    const slope = slopeB[k];
    const clear = smoothstep(8, 11, Math.hypot(pos[k * 3] - LAYOUT.assembly.x, pos[k * 3 + 2] - LAYOUT.assembly.z));
    S[k] = 1 - clamp$9(smoothstep(0.14, 0.38, slope) + smoothstep(0.12, 0.6, R[k]), 0, 1) * clear;
  }
  for (let k = 0; k < count; k++) {
    const x = pos[k * 3], y = pos[k * 3 + 1], z = pos[k * 3 + 2];
    const nx3 = nrm[k * 3], ny = nrm[k * 3 + 1], nz3 = nrm[k * 3 + 2];
    let occ = 0;
    for (const [dx, dz] of dirs) {
      for (const m of radii) occ += Math.max(0, Math.atan2(grid.height(x + dx * m, z + dz * m) - y, m));
    }
    let ao = clamp$9(1 - (occ / 16) * 1.35, 0.38, 1);
    let prox = 0;
    const list = buckets[clamp$9(Math.floor((z + 150) / BK), 0, nb - 1) * nb + clamp$9(Math.floor((x + 150) / BK), 0, nb - 1)];
    for (const o of list) {
      const dx = o.x - x, dz = o.z - z, lim = o.r * 4;
      if (dx > lim || dx < -lim || dz > lim || dz < -lim) continue;
      const dh = Math.sqrt(dx * dx + dz * dz);
      if (dh > lim) continue;
      prox = Math.max(prox, 1 - smoothstep(o.foot, o.foot * 1.8, dh));
      const dy = o.y - y;
      const d2 = dh * dh + dy * dy, d = Math.sqrt(d2);
      const cosT = (dx * nx3 + dy * ny + dz * nz3) / Math.max(d, 1e-3);
      ao *= 1 - Math.min(0.6, ((o.r * o.r) / Math.max(d2, 1e-3)) * (0.25 + 0.75 * Math.max(0, cosT)) * 0.8);
    }
    const sand = S[k], rocky = 1 - sand, slope = 1 - ny;
    let bedG = 0, bedRm = 0, bedM = 0;
    const pl = PB.get(pbk(Math.floor(x / 4), Math.floor(z / 4)));
    if (pl) {
      for (const pt of pl) {
        const dx = x - pt.x, dz = z - pt.z, d = Math.hypot(dx, dz);
        if (d > pt.r * 1.5 + 0.5) continue;
        const e = bedRim(pt, Math.atan2(dz, dx)) - d;
        if (pt.kind === 'grass') { bedG = Math.max(bedG, smoothstep(-0.1, 0.35, e)); bedRm = Math.max(bedRm, 1 - smoothstep(0.1, 0.55, Math.abs(e + 0.1))); }
        else bedM = Math.max(bedM, smoothstep(-0.45, 0.25, e) * (pt.kind === 'rubble' ? 1 : 0.6));
      }
    }
    const md = CV[k];
    const canopy = md * smoothstep(0.75, 0.9, sand) * (1 - smoothstep(0.35, 0.6, prox));
    const litter = clamp$9(Math.max(FR[k] * 1.2 + SA[k], bedRm * 0.95, bedG * 0.55), 0, 1) * sand * (1 - 0.5 * canopy);
    const organic = clamp$9(Math.max(litter * 0.8, smoothstep(0.03, 0.35, md), FR[k] * 0.6, bedG), 0, 1) * sand * (1 - 0.6 * canopy);
    let rip = sand * (1 - 0.9 * prox) * (1 - canopy) * smoothstep(-37, -25, y) * (1 - smoothstep(0.06, 0.2, slope));
    rip *= (1 - bedG) * (1 - 0.85 * bedM);
    const n1 = fbm2(x * 0.11, z * 0.11, 3), n2 = fbm2(x * 0.23 + 5, z * 0.23 - 3, 3);
    const zone = fbm2(x * 0.021 - 7, z * 0.021 + 2, 2);
    let sr = 0.63 + n1 * 0.05 + zone * 0.03, sg = 0.58 + n1 * 0.045 + zone * 0.02, sb = 0.47 + n1 * 0.035;
    const og = smoothstep(0.0, 0.8, organic) * 0.1;
    sr = lerp$4(sr, 0.44, og); sg = lerp$4(sg, 0.39, og); sb = lerp$4(sb, 0.28, og);
    let rr = 0.46 + 0.12 * n2, rg = 0.43 + 0.1 * n2, rb = 0.38 + 0.08 * n2;
    const pink = smoothstep(0.06, 0.32, fbm2(x * 0.2 + 5, z * 0.2, 3));
    rr = lerp$4(rr, 0.66, pink * 0.55); rg = lerp$4(rg, 0.34, pink * 0.55); rb = lerp$4(rb, 0.46, pink * 0.55);
    const alg = smoothstep(0.82, 0.96, ny) * 0.55;
    rr = lerp$4(rr, 0.2, alg); rg = lerp$4(rg, 0.36, alg); rb = lerp$4(rb, 0.12, alg);
    const deep = smoothstep(-30, -45, y);
    let cr = lerp$4(sr, rr, rocky), cg = lerp$4(sg, rg, rocky), cb = lerp$4(sb, rb, rocky);
    cr = lerp$4(cr, 0.36, deep * 0.55); cg = lerp$4(cg, 0.38, deep * 0.55); cb = lerp$4(cb, 0.38, deep * 0.55);
    cr = lerp$4(cr, 0.3, bedG * 0.6); cg = lerp$4(cg, 0.27, bedG * 0.6); cb = lerp$4(cb, 0.2, bedG * 0.6);
    cr = lerp$4(cr, 0.44, bedM * 0.75); cg = lerp$4(cg, 0.35, bedM * 0.75); cb = lerp$4(cb, 0.36, bedM * 0.75);
    col[k * 3] = cr; col[k * 3 + 1] = cg; col[k * 3 + 2] = cb;
    ter[k * 4] = sand; ter[k * 4 + 1] = canopy; ter[k * 4 + 2] = litter; ter[k * 4 + 3] = clamp$9(ao, 0.25, 1);
    ter2[k * 3] = prox; ter2[k * 3 + 1] = rip; ter2[k * 3 + 2] = organic;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('aTer', new THREE.BufferAttribute(ter, 4));
  geo.setAttribute('aTer2', new THREE.BufferAttribute(ter2, 3));
  Object.assign(TATTR, { xs, zs, nx, AX: axisLUT(xs), AZ: axisLUT(zs), col, ter, ter2, nrm });

  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.94, metalness: 0, envMapIntensity: 0.45 });
  worldMaterial(mat, 'terrain', {
    vDecl: TER_VDECL,
    vBegin: 'vTer = aTer;\nvTer2 = aTer2;',
    fDecl: TER_FDECL,
    fColor: TER_FCOLOR,
    fRough: 'roughnessFactor = wRough;',
    fNormal: 'normal = wPerturb(normal, wGrad);',
    fLights: TER_FLIGHTS + FLUO_LIGHTS,
    fEmissive: FLUO_AMBIENT,
    fAO: AO_APPLY,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  SEDIMENT.material = mat;
  return { mesh, grid };
}

function bedHash(k) { return fract(k * 0.618034 + fract(k * 0.1339) * 0.37); }
const JC = [0, 0];
function jointCells(x, z, cell, seed) {
  const gx = x / cell, gz = z / cell;
  const ix = Math.floor(gx), iz = Math.floor(gz);
  let f1 = 9, f2 = 9, id = 0;
  for (let j = -1; j <= 1; j++) {
    for (let i = -1; i <= 1; i++) {
      const cx = ix + i, cz = iz + j;
      const dx = cx + 0.15 + 0.7 * hashI(cx, cz, seed) - gx, dz = cz + 0.15 + 0.7 * hashI(cx, cz, seed + 5) - gz;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d < f1) { f2 = f1; f1 = d; id = hashI(cx, cz, seed + 9); } else if (d < f2) f2 = d;
    }
  }
  JC[0] = id; JC[1] = (f2 - f1) * 0.5 * cell;
}
function bedS(x, y, z, fault) {
  const yy = y + 0.25 * Math.sin(0.37 * x + 0.21 * z) + 0.12 * Math.sin(0.9 * z - 0.5 * x) + fault;
  return yy / 0.36 + 0.5 * Math.sin(yy * 1.9 + 0.7) + 0.28 * Math.sin(yy * 4.6 + 2.1);
}
const bedRec = (k) => 0.12 * Math.pow(1 - bedHash(k), 2.8);
function bedOffset(s, patch) {
  const k = Math.floor(s), f = s - k;
  const r = bedRec(k) + (bedRec(k + 1) - bedRec(k)) * smoothstep(0.7, 1.0, f);
  return -r * patch;
}
function undercut(y, amt) { return 1 - amt * Math.exp(-((y + 0.08) ** 2) / 0.012); }

function blockShape(rng, o1, o2, nBlocks, bevel, o = {}) {
  const blocks = [], jmin = o.jmin || 0.62;
  for (let b = 0; b < nBlocks; b++) {
    const planes = [];
    const bs = b === 0 ? 1 : 0.62 + rng() * 0.3;
    const tr = 0.55 + rng() * 0.4, tk = b === 0 ? 1 : 0.8 + rng() * 0.4;
    const top = o.top ? o.top * (b === 0 ? 1 : 0.6 + 0.3 * tk) : tr * tk;
    const ox = b === 0 ? 0 : (rng() - 0.5) * 0.7, oy = b === 0 ? 0 : (rng() - 0.3) * 0.3, oz = b === 0 ? 0 : (rng() - 0.5) * 0.7;
    const add = (nx, ny, nz, c) => {
      const l = Math.hypot(nx, ny, nz);
      nx /= l; ny /= l; nz /= l;
      planes.push([nx, ny, nz, Math.max(0.2, c + nx * ox + ny * oy + nz * oz)]);
    };
    add(0, 1, 0, top);
    add(0, -1, 0, 1.0);
    const nj = 4 + Math.floor(rng() * 3), a0 = rng() * Math.PI * 2;
    for (let k = 0; k < nj; k++) {
      const a = a0 + (k / nj) * Math.PI * 2 + (rng() - 0.5) * 0.8, el = (rng() - 0.5) * 0.35;
      add(Math.cos(a) * Math.cos(el), Math.sin(el), Math.sin(a) * Math.cos(el), (jmin + rng() * (1 - jmin)) * bs);
    }
    for (let k = 0; k < 2; k++) {
      const a = rng() * Math.PI * 2, el = 0.35 + rng() * 0.6;
      add(Math.cos(a) * Math.cos(el), Math.sin(el), Math.sin(a) * Math.cos(el), (0.72 + rng() * 0.25) * Math.max(bs, top));
    }
    blocks.push(planes);
  }
  const kb = bevel, ku = bevel * 0.7;
  const solid = (vx, vy, vz) => {
    let su = 0;
    for (const planes of blocks) {
      let s = 0;
      for (const p of planes) {
        const c = vx * p[0] + vy * p[1] + vz * p[2];
        if (c > 1e-4) s += Math.exp(-(p[3] / c) / kb);
      }
      const t = s > 0 ? -kb * Math.log(s) : 3;
      su += Math.exp(Math.min(t, 3) / ku);
    }
    return ku * Math.log(su);
  };
  const shape = (vx, vy, vz) => {
    let r = solid(vx, vy, vz);
    r *= 1 + 0.09 * fbm3(vx * 1.5 + o1, vy * 1.5, vz * 1.5 - o2, 3) + 0.045 * fbm3(vx * 3.6 - o2, vy * 3.6, vz * 3.6 + o1, 2)
      + 0.018 * fbm3(vx * 7.9 + o2, vy * 7.9, vz * 7.9 - o1, 2);
    if (o.chip) r *= 1 + o.chip * (0.06 * Math.abs(fbm3(vx * 4.4 - o1, vy * 4.4 + o2, vz * 4.4, 2)) - 0.035 + 0.022 * fbm3(vx * 12 + o2, vy * 12, vz * 12 - o1, 1));
    return clamp$9(r, 0.45, 1.35);
  };
  shape.solid = solid;
  return shape;
}

function planRocks(rng) {
  const plan = [];
  for (const cl of LAYOUT.rockClusters) {
    for (let i = 0; i < cl.n; i++) {
      const ang = rng() * Math.PI * 2;
      const rad = i === 0 ? 0 : cl.s * (0.8 + rng() * 1.3);
      const x = cl.x + Math.cos(ang) * rad, z = cl.z + Math.sin(ang) * rad;
      if (inClearings(x, z, 1.5)) continue;
      const r = cl.s * (i === 0 ? 1.0 : 0.42 + rng() * 0.5);
      const sy = 0.55 + rng() * 0.45;
      const sx = r * (0.9 + rng() * 0.45), sz = r * (0.9 + rng() * 0.45);
      const o1 = rng() * 100, o2 = rng() * 100;
      const y = floorHeight(x, z) - r * sy * 0.22;
      const yaw = rng() * Math.PI * 2;
      plan.push({ x, y, z, r, sy, sx, sz, o1, o2, yaw, main: i === 0 });
    }
  }
  for (const cl of LAYOUT.outcrops || []) {
    const r0 = makeRng$1(Math.round(cl.x * 131 + cl.z * 7919) >>> 0);
    for (let i = 0; i < cl.n; i++) {
      const ang = r0() * Math.PI * 2, rad = i === 0 ? 0 : cl.s * (0.8 + r0() * 1.3) * (cl.spread || 1);
      const x = cl.x + Math.cos(ang) * rad, z = cl.z + Math.sin(ang) * rad;
      if (inClearings(x, z, 1.5)) continue;
      const r = cl.s * (i === 0 ? 1.0 : 0.42 + r0() * 0.5), sy = (0.6 + r0() * 0.55) * (cl.tall || 1);
      const sx = r * (0.9 + r0() * 0.45), sz = r * (0.9 + r0() * 0.45), o1 = r0() * 100, o2 = r0() * 100;
      if (!siteRockClear(x, z, Math.max(sx, sz) * 1.1)) continue;
      plan.push({ x, y: floorHeight(x, z) - r * sy * 0.22, z, r, sy, sx, sz, o1, o2, yaw: r0() * Math.PI * 2, main: i === 0, det: 9, mid: true });
    }
  }
  for (const pn of LAYOUT.pinnacles || []) {
    const r0 = makeRng$1(Math.round(pn.x * 197 + pn.z * 4513) >>> 0);
    for (let i = 0; i < 3; i++) {
      const ang = r0() * Math.PI * 2, rad = i === 0 ? 0 : pn.r * (0.7 + r0() * 0.5);
      const x = pn.x + Math.cos(ang) * rad, z = pn.z + Math.sin(ang) * rad;
      const r = pn.r * (i === 0 ? 1 : 0.45 + r0() * 0.3), sy = pn.sy * (i === 0 ? 1 : 0.45 + r0() * 0.35);
      const sx = r * (0.85 + r0() * 0.3), sz = r * (0.85 + r0() * 0.3), o1 = r0() * 100, o2 = r0() * 100;
      plan.push({ x, y: floorHeight(x, z) - r * sy * 0.12, z, r, sy, sx, sz, o1, o2, yaw: r0() * Math.PI * 2, main: i === 0, det: 7, far: true });
    }
  }
  return plan;
}
function reefRich(x, z) { return 1 - 0.85 * smoothstep(7, 18, Math.hypot(x - LAYOUT.landing.x, z - LAYOUT.landing.z)); }

function planReef(rng) {
  const out = [];
  const block = (o, x, z, yaw, ax, az, hv, opt = {}) => {
    const T = opt.top || 0.8, sq = opt.squat || 1.1;
    let sx = ax / 0.9, sz = az / 0.9;
    const V = opt.on ? hv / (T + 0.26) : hv / (T + 0.12);
    if (V > sq * Math.min(sx, sz)) { if (sz < sx) sz = V / sq; else sx = V / sq; }
    const r = Math.min(sx, sz), sy = V / r;
    const y = opt.on ? opt.on.top + 0.26 * V : floorHeight(x, z) + (0.12 - (opt.sink || 0)) * V;
    const ry = -yaw, cy = Math.cos(ry), sn = Math.sin(ry);
    let groove = null;
    if (opt.gx !== undefined) {
      const gl = Math.hypot(opt.gx, opt.gz) || 1, ux = (cy * opt.gx - sn * opt.gz) / gl, uz = (sn * opt.gx + cy * opt.gz) / gl;
      groove = { y: opt.gy, amt: opt.gamt || 0.16, w: 0.1, ux: ux * (sz / sx), uz, ph: (x * 1.7 + z * 2.3) % 6.283 };
      const ul = Math.hypot(groove.ux, groove.uz) || 1;
      groove.ux /= ul; groove.uz /= ul;
    }
    const near = Math.hypot(x - LAYOUT.landing.x, z - LAYOUT.landing.z) < 6, sm = Math.max(sx, sz) < 0.5;
    const det = clamp$9(Math.round(Math.max(sx, sz) * (near ? 11 : 6.5)), sm ? 8 : near ? 12 : 10, 16) + 1;
    const p = {
      x, y, z, r, sy, sx, sz, o1: rng() * 100, o2: rng() * 100, yaw: ry, main: false, reef: o, kind: o.kind,
      det, nb: opt.nb || 1, bev: opt.bev || 0.055, T, top: y + T * V, jmin: opt.chip ? 0.7 : 0.8, chip: opt.chip || 0,
      notch: opt.notch || 0, groove, tilt: opt.tilt || 0, tip: opt.tip || 0, bedR: Math.max(sx, sz) * 0.8, jk: 1.35, part: opt.part || 'base',
    };
    out.push(p);
    return p;
  };
  for (const o of LAYOUT.reef) {
    const stone = o.kind === 'stone' || o.kind === 'knoll' || o.kind === 'rubble';
    const j = stone ? 0.3 : 0.5, ja = rng() * Math.PI * 2, jd = j * Math.sqrt(rng());
    const cx = o.x + Math.cos(ja) * jd, cz = o.z + Math.sin(ja) * jd;
    const yaw = o.yaw + (rng() - 0.5) * 0.42, k = 0.92 + rng() * 0.16;
    const ax = Math.cos(yaw), az = Math.sin(yaw);
    const tl = Math.hypot(LAYOUT.landing.x - cx, LAYOUT.landing.z - cz) || 1, lx = (LAYOUT.landing.x - cx) / tl, lz = (LAYOUT.landing.z - cz) / tl;
    const LN = LAYOUT.landing.lens, tv = Math.hypot(LN.x - cx, LN.z - cz) || 1, vx = (LN.x - cx) / tv, vz = (LN.z - cz) / tv;
    const at = (along, off) => [cx + ax * along - az * off, cz + az * along + ax * off];
    if (o.kind === 'wall') {
      const len = 2 * o.r * o.len * k, thick = 1.5 * (o.r / o.len) * k, H = o.h * k;
      const sgn = -az * lx + ax * lz > 0 ? 1 : -1;
      const base = [];
      for (let b = 0; b < 2; b++) {
        const u = b ? 1 : -1, bx = len * 0.31 * (0.95 + rng() * 0.1), bz = thick * 0.5 * (0.9 + rng() * 0.15);
        const hb = H * (0.42 + rng() * 0.2) * (1 - 0.08 * rng());
        const [x, z] = at(u * (len * 0.5 - bx * 0.95) + (rng() - 0.5) * 0.2, (rng() - 0.5) * 0.25);
        base.push(block(o, x, z, yaw + (rng() - 0.5) * 0.16, bx, bz, hb,
          { nb: 2, gx: -az * sgn, gz: ax * sgn, gy: 0.3 + rng() * 0.15, gamt: 0.15 + rng() * 0.06, tilt: (rng() - 0.5) * 0.12 }));
      }
      const nt = len > 5.5 ? 2 : 1;
      for (let t = 0; t < nt; t++) {
        const u = nt === 1 ? (rng() - 0.5) * 0.5 : (t ? 0.42 : -0.42) + (rng() - 0.5) * 0.16, on = base[u > 0 ? 1 : 0];
        const fwd = nt === 1 ? rng() < 0.5 : t === 1, bz = thick * 0.5 * (0.62 + rng() * 0.12), bx = len * (0.2 + rng() * 0.06);
        const off = sgn * (fwd ? thick * 0.5 - bz + 0.12 + rng() * 0.12 : -(0.15 + rng() * 0.15));
        const [x, z] = at(u * len * 0.5, off);
        block(o, x, z, yaw + (rng() - 0.5) * 0.2, bx, bz, Math.max(0.35, H - (on.top - floorHeight(on.x, on.z))) * (0.9 + rng() * 0.2), { on, top: 0.78, part: 'top' });
      }
      const fu = (rng() - 0.5) * 1.2, [fx, fz] = at(fu * len * 0.5, sgn * (thick * 0.5 + 0.35 + rng() * 0.2));
      block(o, fx, fz, yaw + 0.5 + rng(), 0.45 + rng() * 0.15, 0.35 + rng() * 0.1, 0.35 + rng() * 0.15, { top: 0.7, tilt: (rng() - 0.5) * 0.4, part: 'fallen' });
    } else if (o.kind === 'ledge') {
      block(o, cx, cz, yaw, o.r * o.len * 0.9 * k, (o.r / o.len) * 0.95 * k, o.h * k, { nb: 2, gx: lx, gz: lz, gy: 0.02, gamt: 0.26, notch: 0.05 });
    } else if (o.kind === 'shelf') {
      const bx = o.r * o.len * 0.9 * k, bz = (o.r / o.len) * 0.95 * k, np = rng() < 0.5 ? 2 : 3;
      for (let b = 0; b < np; b++) {
        const [x, z] = at(((b + 0.5) / np - 0.5) * 2 * bx + (rng() - 0.5) * 0.15, (rng() - 0.5) * 0.3);
        block(o, x, z, yaw + (rng() - 0.5) * 0.3, (bx / np - 0.05) * (0.9 + rng() * 0.15), bz * (0.85 + rng() * 0.2), o.h * k * (0.8 + rng() * 0.35),
          { top: 0.7, bev: 0.08, chip: 0.6, sink: 0.08 + rng() * 0.1, tilt: (rng() - 0.5) * 0.14, tip: (rng() - 0.5) * 0.12, part: 'shelf' });
      }
      const out = bz * 0.95 + 0.35 + rng() * 0.2;
      block(o, cx - lx * out, cz - lz * out, yaw + (rng() - 0.5) * 0.3, bx * (0.75 + rng() * 0.15), bz * 0.75, o.h * k * 0.55,
        { top: 0.72, bev: 0.08, chip: 0.6, sink: 0.08, tilt: (rng() - 0.5) * 0.12, part: 'step' });
    } else if (o.kind === 'knoll') {
      const bx = o.r * o.len * 0.9 * k, bz = (o.r / o.len) * 0.9 * k;
      const lz = -Math.sin(yaw) * vx + Math.cos(yaw) * vz > 0 ? 1 : -1, bkx = Math.sin(yaw) * lz, bkz = -Math.cos(yaw) * lz;
      block(o, cx, cz, yaw, bx, bz * 1.05, 1.52 * (0.96 + rng() * 0.08),
        { nb: 2, sink: 0.24, tilt: lz * (0.1 + rng() * 0.05), tip: 0.07 + rng() * 0.05, chip: 0.5, bev: 0.045, squat: 1.9 });
      const [sx0, sz0] = at(bx * 0.85, (rng() - 0.5) * 0.2);
      block(o, sx0, sz0, yaw + Math.PI / 2 + (rng() - 0.5) * 0.35, bz, bx * 0.55, o.h * k * (1.14 + rng() * 0.06),
        { sink: 0.14, tilt: 0.16 + rng() * 0.08, tip: (rng() - 0.5) * 0.12, squat: 4, chip: 0.7, bev: 0.04, top: 0.74, part: 'slab' });
      const [wx, wz] = at(-bx * (0.3 + rng() * 0.15), 0);
      block(o, wx + bkx * bz * 0.85, wz + bkz * bz * 0.85, yaw + (rng() - 0.5) * 0.7, bx * 0.55, bz * 0.5, o.h * k * (0.9 + rng() * 0.08),
        { sink: 0.16, tilt: lz * (0.2 + rng() * 0.08), tip: (rng() - 0.5) * 0.16, squat: 4, chip: 0.8, bev: 0.04, top: 0.72, part: 'back' });
      for (const [u, w] of [[bx * 1.25, -lz * bz * 0.6], [-bx * 0.3, -lz * bz * 1.45]]) {
        const [fx, fz] = at(u + (rng() - 0.5) * 0.2, w);
        block(o, fx, fz, yaw + rng() * 3, 0.26 + rng() * 0.1, 0.2 + rng() * 0.06, 0.2 + rng() * 0.1, { top: 0.66, sink: 0.12, tilt: (rng() - 0.5) * 0.5, chip: 1, bev: 0.03, part: 'foot' });
      }
    } else if (o.kind === 'rubble') {
      for (let b = 0; b < 3; b++) {
        const s = b === 1 ? 1 : 0.62 + rng() * 0.22, [x, z] = at((b - 1) * o.r * o.len * 0.52 + (rng() - 0.5) * 0.15, (rng() - 0.5) * o.r * 0.5);
        block(o, x, z, yaw + (rng() - 0.5) * 1.1, o.r * 0.6 * s * k, o.r * 0.44 * s * k, o.h * k * s * (0.85 + rng() * 0.3),
          { top: 0.66, bev: 0.028, tilt: (rng() - 0.5) * 0.45, chip: 1, sink: 0.12, part: 'rubble' });
      }
    } else {
      const bx = o.r * o.len * 0.9 * k, bz = (o.r / o.len) * 0.9 * k * 1.15;
      block(o, cx, cz, yaw, bx, bz, o.h * k * 1.2, { nb: 2, top: 0.9, bev: 0.09, tilt: (rng() - 0.5) * 0.34, tip: (rng() - 0.5) * 0.24, chip: 1.3, sink: 0.16 });
      for (let b = 0, nb = rng() < 0.6 ? 2 : 1; b < nb; b++) {
        const a = (b ? -1 : 1) * (0.5 + rng() * 0.6), [x, z] = at(Math.cos(a) * bx * 1.15, Math.sin(a) * bz * 1.35);
        block(o, x, z, yaw + rng() * 3, bx * (0.38 + rng() * 0.15), bz * (0.42 + rng() * 0.15), o.h * k * (0.6 + rng() * 0.3),
          { top: 0.8, bev: 0.07, tilt: (rng() - 0.5) * 0.6, chip: 1.3, sink: 0.12, part: 'chip' });
      }
    }
  }
  return out;
}

function planArch() {
  const ax = LAYOUT.arch.x, az = LAYOUT.arch.z;
  const y = floorHeight(ax, az) - 1.1;
  const q = new THREE.Quaternion().setFromAxisAngle(Y$1, 0.9);
  const dir = new THREE.Vector3(1, 0, 0).applyQuaternion(q);
  const spheres = [];
  for (let k = 0; k <= 8; k++) {
    const th = (k / 8) * Math.PI;
    spheres.push({ x: ax + dir.x * Math.cos(th) * 3.9, y: y + Math.sin(th) * 3.9 * 1.05, z: az + dir.z * Math.cos(th) * 3.9, r: 1.55 });
  }
  return { ax, az, y, q, dir, spheres };
}

const ARCH_LIGHT = { archL: [1.55, 13, 1.05, 0.5], archN: [1.15, 11, 0.8, 0.45], big: [1.2, 10, 0.7, 0.22] };
function archShaft(f, mx, mz, S) {
  const y0 = floorHeight(mx, mz);
  let soff = 0.6;
  while (soff < 12 && f(mx, y0 + soff, mz) > 0) soff += 0.1;
  if (soff >= 12) return null;
  const sy = Math.max(S.y, 0.2), hl = Math.hypot(S.x, S.z) || 1, ux = S.x / hl, uz = S.z / hl, top = y0 + soff + 7;
  const lit = (x, y, z) => { for (let t = 0.35; y + S.y * t < top; t += 0.3) if (f(x + S.x * t, y + S.y * t, z + S.z * t) < 0.05) return false; return true; };
  const roofed = (x, y, z) => { for (let yy = y + 0.3; yy < top; yy += 0.35) if (f(x, yy, z) < 0) return true; return false; };
  let best = null;
  for (let du = -4; du <= 4.01; du += 0.5) {
    for (let dv = -1.2; dv <= 1.21; dv += 0.6) {
      const bx = mx + ux * du - uz * dv, bz = mz + uz * du + ux * dv, by = floorHeight(bx, bz);
      let n = 0;
      for (let k = 0; k < 6; k++) {
        const h = ((k + 0.5) / 6) * soff, t = h / sy, x = bx + S.x * t, y = by + h, z = bz + S.z * t;
        if (f(x, y, z) > 0.3 && roofed(x, y, z) && lit(x, y, z)) n++;
      }
      const sc = n - 0.04 * Math.hypot(du, dv);
      if (n > 0 && (!best || sc > best.sc)) best = { x: bx, z: bz, y: by, n, sc };
    }
  }
  return best ? { x: best.x, z: best.z, y: best.y, soff, n: best.n } : null;
}
function archLights(forms, arch, q) {
  const P = ARCH.uArchP.value, Q = ARCH.uArchQ.value;
  const S = U.uSunW.value.clone().normalize(), sy = Math.max(S.y, 0.2);
  let i = 0;
  const set = (b, o) => {
    const ym = b.soff * 0.5;
    P[i].set(b.x + (S.x * ym) / sy, b.y + ym, b.z + (S.z * ym) / sy, o[0]);
    Q[i].set(b.y, b.soff, o[2], o[3]);
    i++;
  };
  for (const F of forms) {
    const o = ARCH_LIGHT[F.name];
    if (!o || !F.hole || i > 2) continue;
    const lx = F.hole.x0;
    const f = (x, y, z) => { const l = lsLocal(F, x, z); return lsField(F, l[0], y - F.y0, l[1], false, true); };
    const b = archShaft(f, F.x + lx * F.c, F.z - lx * F.s, S);
    if (b) set(b, o);
  }
  if (arch && i < 3) {
    const f = (x, y, z) => { let d = 1e9; for (const s of arch.spheres) d = Math.min(d, Math.hypot(x - s.x, y - s.y, z - s.z) - s.r); return d; };
    const b = archShaft(f, arch.ax, arch.az, S);
    if (b) set(b, ARCH_LIGHT.big);
  }
  for (; i < 3; i++) { P[i].set(0, -999, 0, 1); Q[i].set(-999, 1, 0, 0); }
  ARCH.uArchK.value = q > 0.5 ? 1 : 0;
}

const _lsE = new THREE.Euler(), _lsM = new THREE.Matrix4();
function lsBlock(rng, x, y, z, hx, hy, hz, yaw, tilt, tip, r, n = 3) {
  const e = _lsM.makeRotationFromEuler(_lsE.set(tilt, yaw, tip, 'YXZ')).elements, cuts = [], low = y - hy < 0.3;
  for (let k = 0; k < n * 2; k++) {
    const edge = k < n, sx = rng() < 0.5 ? -1 : 1, sy = low || rng() < 0.65 ? 1 : -1, sz = rng() < 0.5 ? -1 : 1;
    let nx = sx * (0.35 + rng()), ny = edge ? (rng() - 0.5) * 0.2 : sy * (0.25 + rng() * 0.7), nz = sz * (0.35 + rng());
    const l = Math.hypot(nx, ny, nz);
    nx /= l; ny /= l; nz /= l;
    cuts.push([nx, ny, nz, (nx * sx * hx + (edge ? 0 : ny * sy * hy) + nz * sz * hz) * (edge ? 0.8 + rng() * 0.12 : 0.7 + rng() * 0.2)]);
  }
  return { x, y, z, hx, hy, hz, r, cuts, m: [e[0], e[1], e[2], e[4], e[5], e[6], e[8], e[9], e[10]], R: Math.hypot(hx, hy, hz) };
}
function lsBlockD(b, x, y, z) {
  const dx = x - b.x, dy = y - b.y, dz = z - b.z, m = b.m;
  const px = m[0] * dx + m[1] * dy + m[2] * dz, py = m[3] * dx + m[4] * dy + m[5] * dz, pz = m[6] * dx + m[7] * dy + m[8] * dz;
  const qx = Math.abs(px) - b.hx + b.r, qy = Math.abs(py) - b.hy + b.r, qz = Math.abs(pz) - b.hz + b.r;
  let d = Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0) - b.r;
  for (const c of b.cuts) d = Math.max(d, px * c[0] + py * c[1] + pz * c[2] - c[3]);
  return d;
}
function lsRec(k) { const h = bedHash(k); return h > 0.72 ? 0.2 + 0.3 * ((h - 0.72) / 0.28) : 0.035 * h; }
function lsBedS(F, x, y, z) {
  const yy = y + F.y0 + 0.16 * Math.sin(0.37 * x + 0.21 * z + F.ph) + 0.07 * Math.sin(0.9 * z - 0.5 * x);
  return yy / 0.78 + 0.4 * Math.sin(yy * 0.95 + F.ph) + 0.22 * Math.sin(yy * 2.4 + 2.1);
}
const LS_OUT = 0.22, LS_IN = 1.38;
function lsField(F, x, y, z, fine = true, bare = false) {
  const K = F.k;
  let d = 1e9;
  for (const b of F.blocks) {
    if (Math.hypot(x - b.x, y - b.y, z - b.z) - b.R > d + K) continue;
    const db = lsBlockD(b, x, y, z);
    if (d > 1e8) d = db;
    else { const h = clamp$9(0.5 + (0.5 * (db - d)) / K, 0, 1); d = db + (d - db) * h - K * h * (1 - h); }
  }
  if (d > 1.4) return d;
  const T = F.hole;
  if (T && T.sq) {
    const u = clamp$9((y - T.y0) / T.b, 0, 1), a = T.a * (1 - T.nar * u) * (1 + 0.035 * Math.sin(y * 1.3 + z * 0.8 + T.ph) + 0.025 * Math.sin(z * 2.1 - y * 0.7));
    const top = T.y0 + T.b * (1 + 0.025 * Math.sin(x * 1.1 + z * 0.9 + T.ph)), bot = T.y0 - 1.5, rc = Math.min(T.sq, a * 0.6);
    const qx = Math.abs(x - T.x0) - (a - rc), qy = Math.abs(y - (top + bot) / 2) - ((top - bot) / 2 - rc);
    const sd = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - rc;
    d = Math.max(d, -sd);
  } else if (T) {
    const u = clamp$9((y - T.y0) / T.b, 0, 1), a = T.a * (1 - T.nar * u * u) * (1 + 0.06 * Math.sin(y * 1.3 + z * 0.8 + T.ph) + 0.04 * Math.sin(z * 2.1 - y * 0.7));
    const bb = T.b * (1 + 0.05 * Math.sin(x * 1.1 + z * 0.9 + T.ph)), e = Math.pow(Math.abs((x - T.x0) / a) ** T.p + Math.abs((y - T.y0) / bb) ** T.p, 1 / T.p);
    d = Math.max(d, (1 - e) * Math.min(a, bb) * 0.9);
  }
  if (bare) return d;
  const s = lsBedS(F, x, y, z), kb = Math.floor(s), f = s - kb, r0 = lsRec(kb + F.bs), r1 = lsRec(kb + 1 + F.bs);
  const rk = F.stack ? 0.22 + 0.45 * clamp$9(0.5 + fbm2(Math.atan2(z, x) * 1.3 + F.ph, y * 0.6, 2) * 1.8, 0, 1) : 1;
  d += rk * (r0 + (r1 - r0) * smoothstep(0.8, 1.0, f)) * (0.3 + 0.95 * clamp$9(0.5 + fbm2(x * 0.42 + 3.7 + F.ph, z * 0.42 - 1.3, 2) * 1.6, 0, 1));
  for (const j of F.joints) { const t = Math.abs(x * j[0] + z * j[1] - j[2]); if (t < j[4]) { const w = 1 - t / j[4]; d += j[3] * w * w; } }
  d += F.scour * Math.exp(-(((y - 0.35) / 0.3) ** 2));
  if (fine && d < 0.45 && d > -0.45) {
    d += 0.13 * fbm3(x * 0.34 + F.ph, y * 0.34, z * 0.34, 2) + 0.075 * fbm3(x * 1.05, y * 1.05 + F.ph, z * 1.05, 2);
    if (F.stack) d += 0.08 * fbm3(x * 2.4 + F.ph, y * 0.32, z * 2.4, 2) + 0.06 * fbm3(x * 0.9 - F.ph, y * 0.5, z * 0.9, 2);
  }
  return d;
}
function lsLocal(F, x, z) { const dx = x - F.x, dz = z - F.z; return [dx * F.c - dz * F.s, dx * F.s + dz * F.c]; }

function planForm(o) {
  const rng = makeRng$1(Math.round(o.x * 131 + o.z * 71) + 9), blocks = [], joints = [];
  const yaw = o.kind === 'stack' ? 0 : o.yaw || 0;
  const F = { name: o.name, kind: o.kind, x: o.x, z: o.z, ax: o.x, az: o.z, y0: floorHeight(o.x, o.z), c: Math.cos(yaw), s: Math.sin(yaw), yaw, blocks, joints,
    k: o.kind === 'stack' ? 0.26 : 0.1, ph: rng() * 6.28, bs: Math.floor(rng() * 60), hole: null, scour: 0.16, stack: o.kind === 'stack' };
  const B = (x, y, z, hx, hy, hz, yw, tl, tp, r, n) => blocks.push(lsBlock(rng, x, y, z, hx, hy, hz, yw, tl, tp, r, n));
  const j = (a) => (rng() - 0.5) * a;
  if (o.kind === 'arch') {
    const R = o.R, t = o.t, top = R * o.sy + t - o.sink, lt = t * 1.7, hv = o.heavy || 0, lw = t * 1.35, ld = t * 1.4;
    B(R * 0.55 + j(0.3), (top + 0.3 - 1.2) / 2, j(0.3), R * 0.55 + lw * (1 + hv * 0.35), (top + 0.3 + 1.2) / 2, ld * (1 + hv * 0.12), j(0.15), j(0.05), j(0.06), 0.14, 4);
    B(-R * 0.55 + j(0.3), (top - 0.35 - 1.2) / 2, j(0.3), R * 0.5 + lw, (top - 0.35 + 1.2) / 2, ld * 0.92, j(0.15), j(0.05), j(0.06), 0.14, 4);
    for (const sd of [1, -1]) B(sd * R * 0.3 + j(0.3), top - lt * 0.5 + j(0.12), j(0.25), R * 0.42, lt * 0.55, ld * (0.9 + rng() * 0.12), j(0.1), j(0.06), j(0.08), 0.12, 3);
    if (hv) B(R * 0.85 + j(0.3), top + t * 0.35, j(0.3), lw * 1.1, t * 0.7, ld * 0.85, j(0.4), j(0.1), j(0.1), 0.12, 3);
    for (const u of [0.02, -0.42, 0.46]) joints.push([1, j(0.4), R * u + j(0.3), 0.3, 0.17]);
    for (const sd of [1, -1]) joints.push([1, j(0.5), sd * (R + lw * 0.2) + j(0.4), 0.16, 0.14]);
    F.hole = { x0: 0.3 + j(0.3), y0: -1, a: R - lw * 0.45, b: top - lt + 1.0, nar: 0.25, p: 2.4, ph: rng() * 6.28 };
    F.k = 0.22;
  } else if (o.kind === 'window') {
    const Lh = o.len, ht = o.h, tk = o.t, mx = Math.max(Lh * 0.46, (o.hw || 0) + 0.65);
    for (const [cx, hx, hh, dz] of [[-Lh * 0.62, Lh * 0.42, ht * 0.7, tk * 0.95], [0, mx, ht, tk], [Lh * 0.62, Lh * 0.42, ht * 0.62, tk * 0.9]]) {
      const hy = (hh + 1.1) / 2;
      B(cx + j(0.3), hh - hy + j(0.12), j(0.25), hx, hy, dz * (0.9 + rng() * 0.15), j(0.12), j(0.06), j(0.07), 0.1, 3);
    }
    B(j(Lh * 0.5), ht + 0.05, j(0.3), Lh * 0.24, 0.42, tk * 0.75, j(0.5), j(0.12), j(0.12), 0.1, 3);
    for (const u of [-0.36, 0.34]) joints.push([1, j(0.4), Lh * u + j(0.4), 0.2, 0.15]);
    F.hole = { x0: j(0.3), y0: -0.8, a: o.hw, b: o.hh + 0.8, nar: 0.05, p: 2.2, ph: rng() * 6.28, sq: o.rc || 0.9 };
    F.k = 0.18;
  } else {
    const r = o.r, H = o.h, lx = Math.cos(o.leanYaw) * Math.sin(o.lean), lz = Math.sin(o.leanYaw) * Math.sin(o.lean);
    let yb = -0.9;
    const sh = [0.24, 0.17, 0.22, 0.16, 0.21], wk = [1.18, 0.92, 1.05, 0.88, 1.0];
    sh.forEach((f, i) => {
      const hh = ((H + 0.9) * f) / 2 + 0.08, w = r * wk[i] * (0.9 + rng() * 0.2), cy = yb + hh;
      B(lx * Math.max(0, cy) + j(0.25), cy, lz * Math.max(0, cy) + j(0.25), w * (0.85 + rng() * 0.3), hh, w * (0.85 + rng() * 0.3), rng() * 3, j(0.08), j(0.08), 0.06, 4);
      yb += hh * 2 - 0.16;
    });
    const ca = rng() * 6.28;
    B(lx * H + Math.cos(ca) * r * 0.35, H - 0.2, lz * H + Math.sin(ca) * r * 0.35, r * 1.3, 0.42, r * 1.05, ca, j(0.12), j(0.12), 0.06, 4);
    joints.push([Math.cos(F.ph), Math.sin(F.ph), j(0.4), 0.16, 0.13]);
    F.scour = 0.24;
  }
  const lo = [1e9, -1.05, 1e9], hi = [-1e9, -1e9, -1e9];
  for (const b of blocks) {
    lo[0] = Math.min(lo[0], b.x - b.R); lo[2] = Math.min(lo[2], b.z - b.R);
    hi[0] = Math.max(hi[0], b.x + b.R); hi[1] = Math.max(hi[1], b.y + b.R); hi[2] = Math.max(hi[2], b.z + b.R);
  }
  F.lo = lo; F.hi = hi; F.R = Math.hypot(Math.max(-lo[0], hi[0]), hi[1], Math.max(-lo[2], hi[2]));
  F.spheres = []; F.feet = [];
  for (const b of blocks) {
    const long = b.hx >= b.hz, half = long ? b.hx : b.hz, rr = Math.min(b.hx, b.hz, b.hy * 1.2) * 0.95;
    const ax = long ? b.m[0] : b.m[6], az = long ? b.m[2] : b.m[8], al = Math.hypot(ax, az) || 1;
    const n = Math.max(1, Math.ceil(half / rr - 0.25)), m = Math.max(1, Math.ceil(b.hy / rr - 0.25));
    for (let j = 0; j < m; j++) {
      const y = m === 1 ? b.y : b.y + ((j / (m - 1)) * 2 - 1) * (b.hy - rr);
      for (let i = 0; i < n; i++) {
        const u = n === 1 ? 0 : ((i / (n - 1)) * 2 - 1) * (half - rr), lx = b.x + (ax / al) * u, lzz = b.z + (az / al) * u;
        const fv = lsField(F, lx, y, lzz, false, true), r1 = fv > -rr * 0.5 ? -fv * 0.9 : rr;
        if (r1 < 0.22) continue;
        const s = { x: F.x + lx * F.c + lzz * F.s, y: F.y0 + y, z: F.z - lx * F.s + lzz * F.c, r: r1 };
        F.spheres.push(s);
        if (y - rr < 0.3) F.feet.push(s);
      }
    }
  }
  F.solid = { kind: 'wall', form: F };
  return F;
}

function netsMesh(f, lo, hi, h, fb = null, out = 0, inn = 0) {
  const nx = Math.ceil((hi[0] - lo[0]) / h) + 2, ny = Math.ceil((hi[1] - lo[1]) / h) + 2, nz = Math.ceil((hi[2] - lo[2]) / h) + 2;
  const V = new Float32Array(nx * ny * nz), NXY = nx * ny;
  let C = null, cnx = 0, cny = 0;
  if (fb) {
    cnx = Math.ceil(nx / 3) + 1; cny = Math.ceil(ny / 3) + 1;
    const cnz = Math.ceil(nz / 3) + 1;
    C = new Float32Array(cnx * cny * cnz);
    for (let k = 0, i = 0; k < cnz; k++) for (let jy = 0; jy < cny; jy++) for (let ix = 0; ix < cnx; ix++, i++) C[i] = fb(lo[0] + ix * 3 * h, lo[1] + jy * 3 * h, lo[2] + k * 3 * h);
  }
  const m = h * 1.5 * Math.sqrt(3) * 1.3;
  for (let k = 0, i = 0; k < nz; k++) {
    for (let jy = 0; jy < ny; jy++) {
      for (let ix = 0; ix < nx; ix++, i++) {
        if (C) {
          const c = C[Math.round(ix / 3) + Math.round(jy / 3) * cnx + Math.round(k / 3) * cnx * cny];
          if (c > out + m || c < -inn - m) { V[i] = c; continue; }
        }
        V[i] = f(lo[0] + ix * h, lo[1] + jy * h, lo[2] + k * h);
      }
    }
  }
  const cx = nx - 1, cxy = (nx - 1) * (ny - 1), cell = new Int32Array(cxy * (nz - 1)).fill(-1), pos = [];
  const CO = [0, 1, nx, nx + 1, NXY, NXY + 1, NXY + nx, NXY + nx + 1];
  const OX = [0, 1, 0, 1, 0, 1, 0, 1], OY = [0, 0, 1, 1, 0, 0, 1, 1], OZ = [0, 0, 0, 0, 1, 1, 1, 1];
  const ED = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]], cv = new Float32Array(8);
  for (let k = 0; k < nz - 1; k++) {
    for (let jy = 0; jy < ny - 1; jy++) {
      for (let ix = 0; ix < nx - 1; ix++) {
        const i0 = ix + jy * nx + k * NXY;
        let m = 0;
        for (let c = 0; c < 8; c++) { cv[c] = V[i0 + CO[c]]; if (cv[c] < 0) m |= 1 << c; }
        if (m === 0 || m === 255) continue;
        let sx = 0, sy = 0, sz = 0, n = 0;
        for (const [a, b] of ED) {
          if ((cv[a] < 0) === (cv[b] < 0)) continue;
          const t = cv[a] / (cv[a] - cv[b]);
          sx += OX[a] + (OX[b] - OX[a]) * t; sy += OY[a] + (OY[b] - OY[a]) * t; sz += OZ[a] + (OZ[b] - OZ[a]) * t; n++;
        }
        cell[ix + jy * cx + k * cxy] = pos.length / 3;
        pos.push(lo[0] + (ix + sx / n) * h, lo[1] + (jy + sy / n) * h, lo[2] + (k + sz / n) * h);
      }
    }
  }
  const idx = [], CI = (ix, jy, k) => cell[ix + jy * cx + k * cxy];
  const quad = (a, b, c, d, flip) => { if (a < 0 || b < 0 || c < 0 || d < 0) return; if (flip) idx.push(a, c, b, a, d, c); else idx.push(a, b, c, a, c, d); };
  for (let k = 1; k < nz - 1; k++) {
    for (let jy = 1; jy < ny - 1; jy++) {
      for (let ix = 1; ix < nx - 1; ix++) {
        const i0 = ix + jy * nx + k * NXY, s0 = V[i0] < 0;
        if (s0 !== V[i0 + 1] < 0) quad(CI(ix, jy - 1, k - 1), CI(ix, jy, k - 1), CI(ix, jy, k), CI(ix, jy - 1, k), !s0);
        if (s0 !== V[i0 + nx] < 0) quad(CI(ix - 1, jy, k - 1), CI(ix, jy, k - 1), CI(ix, jy, k), CI(ix - 1, jy, k), s0);
        if (s0 !== V[i0 + NXY] < 0) quad(CI(ix - 1, jy - 1, k), CI(ix, jy - 1, k), CI(ix, jy, k), CI(ix - 1, jy, k), !s0);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  return g;
}
function formGeometry(F) {
  const h = F.kind === 'arch' ? 0.26 : F.kind === 'window' ? 0.19 : 0.14;
  const g = netsMesh((x, y, z) => lsField(F, x, y, z), [F.lo[0] - h, F.lo[1], F.lo[2] - h], [F.hi[0] + h, F.hi[1] + h, F.hi[2] + h], h,
    (x, y, z) => lsField(F, x, y, z, false, true), LS_OUT, LS_IN);
  const P = g.attributes.position, n = P.count, beds = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = P.getX(i), y = P.getY(i), z = P.getZ(i);
    beds[i] = Math.floor(lsBedS(F, x, y, z));
    P.setXYZ(i, F.x + x * F.c + z * F.s, F.y0 + y, F.z - x * F.s + z * F.c);
  }
  g.computeVertexNormals();
  return { g, beds };
}

const ICO_V = (() => { const t = (1 + Math.sqrt(5)) / 2; return [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]]; })();
const ICO_F = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
  [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
function icoSphere(n) {
  const pos = [], idx = [];
  const shared = new Map();
  const vert = (A, wa, B, wb, C, wc) => {
    let key = null;
    if (wa === 0 || wb === 0 || wc === 0) {
      const parts = [];
      if (wa) parts.push([A, wa]);
      if (wb) parts.push([B, wb]);
      if (wc) parts.push([C, wc]);
      parts.sort((u, v) => u[0] - v[0]);
      key = parts.map((q) => q[0] + ':' + q[1]).join('|');
      const hit = shared.get(key);
      if (hit !== undefined) return hit;
    }
    const a = ICO_V[A], b = ICO_V[B], c = ICO_V[C];
    const x = a[0] * wa + b[0] * wb + c[0] * wc, y = a[1] * wa + b[1] * wb + c[1] * wc, z = a[2] * wa + b[2] * wb + c[2] * wc;
    const l = Math.sqrt(x * x + y * y + z * z);
    const id = pos.length / 3;
    pos.push(x / l, y / l, z / l);
    if (key) shared.set(key, id);
    return id;
  };
  for (const [A, B, C] of ICO_F) {
    const g = [];
    for (let i = 0; i <= n; i++) {
      g[i] = [];
      for (let j = 0; j <= n - i; j++) g[i][j] = vert(A, n - i - j, B, i, C, j);
    }
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n - i; j++) {
        idx.push(g[i][j], g[i + 1][j], g[i][j + 1]);
        if (j < n - i - 1) idx.push(g[i + 1][j], g[i + 1][j + 1], g[i][j + 1]);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  return geo;
}

function limestoneOffset(x, y, z, cx, cz, r, w, cell, seed, jk = 1) {
  jointCells(x, z, cell, seed);
  const fault = (JC[0] - 0.5) * 0.3;
  const s = bedS(x, y, z, fault);
  const patch = 0.1 + 1.15 * clamp$9(0.5 + fbm2(x * 0.6 + 3.7, z * 0.6 - 1.3, 2) * 1.6, 0, 1);
  const joint = -Math.pow(Math.max(0, 1 - JC[1] / (0.22 * jk)), 2) * 0.05 * jk;
  return { off: (bedOffset(s, patch) + joint) * r * w, bed: Math.floor(s) };
}

function clusterRockGeometry(p) {
  const g = icoSphere(Math.max(5, Math.round(ROCK_DETAIL * (p.det || (p.reef ? clamp$9(Math.round(p.r * 11), 11, 32) + 1 : clamp$9(Math.round(p.r * 8), 10, 21) + 1)))));
  const P = g.attributes.position, n = P.count;
  const rng = makeRng$1(Math.floor(p.o1 * 1000) + 17);
  const shape = blockShape(rng, p.o1, p.o2, p.nb || 1 + Math.floor(rng() * 2.6), p.bev || Math.max(0.06, 0.15 / p.r), { top: p.T, jmin: p.jmin, chip: p.chip });
  const notch = p.nb ? 0.02 + rng() * 0.02 + (p.notch || 0) : 0.03 + rng() * 0.05 + (p.notch || 0);
  const G = p.groove;
  const up0 = new Float32Array(n), beds = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let x = P.getX(i), y = P.getY(i), z = P.getZ(i);
    const d = shape(x, y, z);
    up0[i] = y;
    x *= d; y *= d; z *= d;
    if (y < -0.25) y = -0.25 + (y + 0.25) * 0.35;
    let u = undercut(y, notch);
    if (G) u *= 1 - grooveCut(G, x, y, z);
    P.setXYZ(i, x * u, y, z * u);
  }
  const q = new THREE.Quaternion().setFromAxisAngle(Y$1, p.yaw);
  if (p.tilt) q.multiply(new THREE.Quaternion().setFromAxisAngle(X, p.tilt));
  if (p.tip) q.multiply(new THREE.Quaternion().setFromAxisAngle(ZA$1, p.tip));
  g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(p.x, p.y, p.z), q, new THREE.Vector3(p.sx, p.r * p.sy, p.sz)));
  const bedR = p.bedR || p.r;
  const erode = !p.reef ? 0 : p.kind === 'knoll' ? 0.27 : p.kind === 'stone' || p.kind === 'rubble' ? Math.min(0.19, 0.06 + 0.1 * p.r) : 0;
  for (let i = 0; i < n; i++) {
    const x = P.getX(i), y = P.getY(i), z = P.getZ(i);
    const dx = x - p.x, dz = z - p.z, dl = Math.sqrt(dx * dx + dz * dz) || 1;
    const lo = limestoneOffset(x, y, z, p.x, p.z, bedR, (1 - up0[i] * up0[i]) * smoothstep(-0.6, -0.1, up0[i]) + 0.0, 2.6, 71, p.jk || 1);
    beds[i] = lo.bed;
    let off = lo.off;
    if (erode) {
      const side = 1 - smoothstep(0.55, 0.9, up0[i]);
      const b = fbm3(x * 1.6 + p.o1, y * 1.8 - p.o2, z * 1.6 + p.o2, 3), k = fbm3(x * 4.6 - p.o2, y * 4.2 + p.o1, z * 4.6, 2);
      const big = fbm3(x * 0.7 - p.o1, y * 0.9, z * 0.7 + p.o1, 2);
      off += erode * side * (b * 1.3 - Math.abs(k) * 0.9 + big * 1.1 + 0.2);
    }
    P.setXYZ(i, x + (dx / dl) * off, y, z + (dz / dl) * off);
  }
  g.computeVertexNormals();
  p.shape = shape;
  p.qi = q.invert();
  p.notchK = notch;
  return { g, beds };
}
function grooveCut(G, x, y, z) {
  const a = Math.atan2(z, x), ph = G.ph || 0;
  const gy = G.y + 0.07 * Math.sin(a * 2 + ph) + 0.035 * Math.sin(a * 5 + ph * 1.7);
  const k = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(a * 3 + ph * 2.3));
  return G.amt * k * Math.exp(-((y - gy) ** 2) / (G.w * G.w)) * smoothstep(0.05, 0.6, (x * G.ux + z * G.uz) / (Math.hypot(x, z) || 1));
}
const _ib = new THREE.Vector3();
function inBlock(p, x, y, z, k = 0.95, full = false) {
  if (p.form) {
    const F = p.form, [lx, lz] = lsLocal(F, x, z), ly = y - F.y0;
    if (lx < F.lo[0] - 0.3 || lx > F.hi[0] + 0.3 || ly < F.lo[1] - 0.3 || ly > F.hi[1] + 0.3 || lz < F.lo[2] - 0.3 || lz > F.hi[2] + 0.3) return false;
    return lsField(F, lx, ly, lz, full) < (k - 1) * 0.5;
  }
  const dx = x - p.x, dy = y - p.y, dz = z - p.z, R = Math.max(p.sx, p.sz, p.r * p.sy) * 1.4;
  if (dx * dx + dy * dy + dz * dz > R * R) return false;
  const v = _ib.set(dx, dy, dz).applyQuaternion(p.qi);
  let ux = v.x / p.sx, uy = v.y / (p.r * p.sy), uz = v.z / p.sz;
  const G = p.groove;
  let u = undercut(uy, p.notchK || 0);
  if (G) u *= 1 - grooveCut(G, ux, uy, uz);
  ux /= u; uz /= u;
  if (uy < -0.25) uy = -0.25 + (uy + 0.25) / 0.35;
  const l = Math.hypot(ux, uy, uz);
  return l < 1e-6 || l < k * (full ? p.shape : p.shape.solid)(ux / l, uy / l, uz / l);
}

const _ia = new THREE.Vector3(), _iq = new THREE.Quaternion();
function inArch(arch, x, y, z, k = 1) {
  const v = _ia.set(x - arch.ax, y - arch.y, z - arch.az).applyQuaternion(_iq.copy(arch.q).invert());
  v.y /= 1.05;
  const th = clamp$9(Math.atan2(v.y, v.x), 0, Math.PI), cx = Math.cos(th) * 3.9, cy = Math.sin(th) * 3.9;
  const ox = v.x - cx, oy = v.y - cy, oz = v.z, ol = Math.hypot(ox, oy, oz);
  if (ol > 1.35 * 2.4) return false;
  if (ol < 1e-6) return true;
  const sx = cx + (ox / ol) * 1.35, sy = cy + (oy / ol) * 1.35, sz = (oz / ol) * 1.35;
  const d = 1 + 0.45 * fbm3(sx * 0.45 + 3, sy * 0.45, sz * 0.45, 4) + 0.12 * fbm3(sx * 1.4, sy * 1.4 + 7, sz * 1.4, 3) + 0.04 * fbm3(sx * 3.3 - 2, sy * 3.3, sz * 3.3 + 5, 2);
  const legs = 1 + 0.5 * smoothstep(1.2, -0.5, sy);
  return ol < k * 1.35 * d * legs;
}

function archGeometry(arch) {
  let g = new THREE.TorusGeometry(3.9, 1.35, 44, 160, Math.PI);
  g.deleteAttribute('uv');
  g.deleteAttribute('normal');
  g = mergeVertices(g);
  const P = g.attributes.position, n = P.count;
  const offs = new Float32Array(n * 3), beds = new Float32Array(n);
  const v = new THREE.Vector3(), c = new THREE.Vector3(), off = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    v.fromBufferAttribute(P, i);
    const th = Math.atan2(v.y, v.x);
    c.set(Math.cos(th) * 3.9, Math.sin(th) * 3.9, 0);
    off.copy(v).sub(c);
    const d = 1 + 0.45 * fbm3(v.x * 0.45 + 3, v.y * 0.45, v.z * 0.45, 4) + 0.12 * fbm3(v.x * 1.4, v.y * 1.4 + 7, v.z * 1.4, 3)
      + 0.04 * fbm3(v.x * 3.3 - 2, v.y * 3.3, v.z * 3.3 + 5, 2);
    const legs = 1 + 0.5 * smoothstep(1.2, -0.5, v.y);
    off.multiplyScalar(d * legs);
    offs[i * 3] = off.x; offs[i * 3 + 1] = off.y; offs[i * 3 + 2] = off.z;
    v.copy(c).add(off);
    P.setXYZ(i, v.x, v.y, v.z);
  }
  g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(arch.ax, arch.y, arch.az), arch.q, new THREE.Vector3(1, 1.05, 1)));
  const od = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    od.set(offs[i * 3], offs[i * 3 + 1], offs[i * 3 + 2]).applyQuaternion(arch.q);
    const hl = Math.hypot(od.x, od.z), ol = od.length();
    const x = P.getX(i), y = P.getY(i), z = P.getZ(i);
    const lo = limestoneOffset(x, y, z, 0, 0, 1.35, ol > 1e-4 ? hl / ol : 0, 2.6, 71);
    beds[i] = lo.bed;
    if (hl < 1e-4 || ol < 1e-4) continue;
    P.setXYZ(i, x + (od.x / hl) * lo.off, y, z + (od.z / hl) * lo.off);
  }
  g.computeVertexNormals();
  return { g, beds };
}

function scatterRockGeometry(seed, detail, jointsOn) {
  const rng = makeRng$1(seed);
  const g = icoSphere(detail + 1);
  const P = g.attributes.position, n = P.count;
  const shape = blockShape(rng, rng() * 100, rng() * 100, 1 + Math.floor(rng() * 2), detail >= 6 ? 0.06 : 0.1);
  const notch = 0.03 + rng() * 0.05;
  const flat = 0.74 + rng() * 0.24;
  const beds = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const ux = P.getX(i), uy = P.getY(i), uz = P.getZ(i);
    const d = shape(ux, uy, uz);
    let x = ux * d, y = uy * d * flat, z = uz * d;
    if (y < -0.3) y = -0.3 + (y + 0.3) * 0.4;
    const u = undercut(y, notch);
    x *= u; z *= u;
    const hl = Math.hypot(x, z) || 1;
    const lo = limestoneOffset(x * 1.7, y * 1.7, z * 1.7, 0, 0, 1, (1 - uy * uy) * (jointsOn ? 1 : 0.6), 1.6, seed);
    beds[i] = lo.bed;
    P.setXYZ(i, x + (x / hl) * lo.off, y, z + (z / hl) * lo.off);
  }
  g.computeVertexNormals();
  bakeRock(g, beds, { base: -0.2, hScale: 0.8, ns: 2.2 });
  return g;
}

function bakeRock(g, beds, ctx) {
  const P = g.attributes.position, Nm = g.attributes.normal, n = P.count;
  const pa = P.array, na = Nm.array, idx = g.index.array;
  const sx = new Float32Array(n), sy = new Float32Array(n), sz = new Float32Array(n), cnt = new Float32Array(n), el = new Float32Array(n);
  const acc = (i, j, k) => {
    sx[i] += pa[j * 3] + pa[k * 3]; sy[i] += pa[j * 3 + 1] + pa[k * 3 + 1]; sz[i] += pa[j * 3 + 2] + pa[k * 3 + 2]; cnt[i] += 2;
    const ex = pa[j * 3] - pa[i * 3], ey = pa[j * 3 + 1] - pa[i * 3 + 1], ez = pa[j * 3 + 2] - pa[i * 3 + 2];
    el[i] += Math.sqrt(ex * ex + ey * ey + ez * ez);
  };
  for (let t = 0; t < idx.length; t += 3) { const a = idx[t], b = idx[t + 1], c = idx[t + 2]; acc(a, b, c); acc(b, c, a); acc(c, a, b); }
  let cav = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const inv = 1 / Math.max(1, cnt[i]);
    const lx = sx[i] * inv - pa[i * 3], ly = sy[i] * inv - pa[i * 3 + 1], lz = sz[i] * inv - pa[i * 3 + 2];
    const e = el[i] / Math.max(1, cnt[i] * 0.5);
    cav[i] = (lx * na[i * 3] + ly * na[i * 3 + 1] + lz * na[i * 3 + 2]) / Math.max(1e-5, e);
  }
  const smooth = (src) => {
    const s2 = new Float32Array(n), c2 = new Float32Array(n);
    for (let t = 0; t < idx.length; t += 3) {
      const a = idx[t], b = idx[t + 1], c = idx[t + 2];
      s2[a] += src[b] + src[c]; s2[b] += src[c] + src[a]; s2[c] += src[a] + src[b];
      c2[a] += 2; c2[b] += 2; c2[c] += 2;
    }
    for (let i = 0; i < n; i++) s2[i] = (src[i] * 2 + s2[i]) / (2 + c2[i]);
    return s2;
  };
  cav = smooth(smooth(cav));
  let wide = cav;
  for (let it = 0; it < 6; it++) wide = smooth(wide);
  const ns = ctx.ns || 1, rich = ctx.rich || 0, oc = ctx.coarse ? 1 : 2;
  let occl = null;
  if (ctx.occl) {
    let cx = 0, cy = 0, cz = 0;
    for (let i = 0; i < n; i++) { cx += pa[i * 3]; cy += pa[i * 3 + 1]; cz += pa[i * 3 + 2]; }
    cx /= n; cy /= n; cz /= n;
    let rad = 0;
    for (let i = 0; i < n; i++) rad = Math.max(rad, (pa[i * 3] - cx) ** 2 + (pa[i * 3 + 1] - cy) ** 2 + (pa[i * 3 + 2] - cz) ** 2);
    rad = Math.sqrt(rad);
    occl = ctx.occl.filter((o) => o !== ctx.self && Math.hypot(o.x - cx, o.y - cy, o.z - cz) < rad + 5 * o.r);
  }
  const col = new Float32Array(n * 3), rk = new Float32Array(n * 4), rk2 = new Float32Array(n * 4), rk3 = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = pa[i * 3], y = pa[i * 3 + 1], z = pa[i * 3 + 2];
    const nx = na[i * 3], ny = na[i * 3 + 1], nz = na[i * 3 + 2];
    const hB = ctx.grid ? y - ctx.grid.height(x, z) : (y - ctx.base) * ctx.hScale;
    let ao = clamp$9(1 - Math.max(0, cav[i]) * 2.0, 0.62, 1) * clamp$9(1 - Math.max(0, wide[i]) * 3.5, 0.72, 1);
    ao *= lerp$4(1, lerp$4(0.72, 1, smoothstep(-0.05, 0.35, hB)), smoothstep(0.85, -0.3, ny));
    ao *= lerp$4(0.7, 1, smoothstep(-0.85, 0.25, ny));
    if (occl) {
      for (const o of occl) {
        const dx = o.x - x, dy = o.y - y, dz = o.z - z;
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 > 25 * o.r * o.r || d2 < 1e-6) continue;
        const d = Math.sqrt(d2), cosT = (dx * nx + dy * ny + dz * nz) / d;
        if (cosT <= 0) continue;
        ao *= 1 - Math.min(0.3, ((o.r * o.r) / d2) * cosT * 0.6);
      }
    }
    ao = clamp$9(ao, 0.5, 1);
    const qx = x * ns, qy = y * ns, qz = z * ns;
    const nA = fbm3(qx * 0.9 + 3, qy * 0.9, qz * 0.9, oc), nB = fbm3(qx * 1.3 + 9, qy * 1.3, qz * 1.3 - 4, oc);
    const nC = fbm3(qx * 1.1 - 7, qy * 1.1 + 2, qz * 1.1, oc), nD = fbm3(qx * 0.8, qy * 0.8 + 5, qz * 0.8, oc);
    const shallow = ctx.grid ? smoothstep(-38, -18, y) : 0.8;
    const sandW = clamp$9(smoothstep(0.5, 0.02, hB) * smoothstep(-0.1, 0.55, ny) + smoothstep(0.86, 0.97, ny) * smoothstep(0.05, 0.3, nD) * 0.7
      + smoothstep(0.24, 0.0, hB) * smoothstep(-0.7, 0.2, ny) * 0.85, 0, 1);
    const wall = rich * smoothstep(0.55, 0.2, ny);
    rk[i * 4] = smoothstep(0.3, 0.8, ny) * clamp$9(0.62 + nD * 1.2, 0, 1) * (0.45 + 0.55 * shallow);
    rk[i * 4 + 1] = clamp$9((1 - smoothstep(0.3, 0.85, ny)) * clamp$9(0.55 + nA * 1.8, 0, 1) * (0.65 + 0.35 * (1 - ao)) + 0.05 * wall, 0, 1);
    rk[i * 4 + 2] = clamp$9(smoothstep(0.08, 0.28, nB) * smoothstep(0.55, -0.1, ny) + 0.04 * wall, 0, 1);
    rk[i * 4 + 3] = clamp$9(smoothstep(0.0, -0.7, ny) * clamp$9(0.4 + nC * 1.6, 0, 1) + (1 - ao) * 0.15, 0, 1);
    if (ctx.shade) {
      const hl = Math.hypot(nx, nz) || 1, vx = ctx.view.x - x, vz = ctx.view.z - z, vl = Math.hypot(vx, vz) || 1;
      const face = (nx * vx + nz * vz) / (hl * vl), under = smoothstep(-0.15, -0.55, ny);
      rk3[i] = rich * Math.max(ctx.shade[i], under) * smoothstep(0.4, 0.1, ny) * smoothstep(0.12, 0.3, hB) * Math.max(smoothstep(-0.15, 0.35, face), under * 0.6);
    }
    rk2[i * 4] = ao;
    rk2[i * 4 + 1] = sandW * (1 - 0.35 * wall);
    rk2[i * 4 + 2] = clamp$9(0.5 + nB * 1.6 + nC * 0.8, 0, 1);
    rk2[i * 4 + 3] = smoothstep(-0.08, 0.15, fbm3(qx * 0.5, qy * 0.5 + 3, qz * 0.5, oc));
    const s1 = fbm3(qx * 0.6, qy * 0.6, qz * 0.6, oc + 1);
    const bh = bedHash(beds[i]), bh2 = bedHash(beds[i] * 1.7 + 3.1);
    let r = 0.45 + 0.09 * s1, gg = 0.42 + 0.075 * s1, bb = 0.36 + 0.06 * s1;
    const shade = 0.9 + 0.16 * bh;
    r *= shade; gg *= shade; bb *= shade;
    const och = (bh2 > 0.7 ? 0.45 : 0) * (0.6 + 0.4 * s1), gry = (bh2 < 0.22 ? 0.4 : 0);
    r = lerp$4(r, 0.5, och); gg = lerp$4(gg, 0.4, och); bb = lerp$4(bb, 0.28, och);
    r = lerp$4(r, 0.36, gry); gg = lerp$4(gg, 0.37, gry); bb = lerp$4(bb, 0.37, gry);
    col[i * 3] = r; col[i * 3 + 1] = gg; col[i * 3 + 2] = bb;
  }
  if (ctx.shade) {
    let w = rk3;
    for (let it = 0; it < 4; it++) w = smooth(w);
    for (let i = 0; i < n; i++) {
      const x = pa[i * 3], y = pa[i * 3 + 1], z = pa[i * 3 + 2];
      const patch = smoothstep(0.52, 0.66, 0.5 + fbm3(x * 2.4 + 11, y * 2.4, z * 2.4 - 5, 2) * 1.5) * smoothstep(0.42, 0.6, 0.5 + fbm3(x * 0.8 - 3, y * 0.8 + 9, z * 0.8, 2) * 1.6);
      rk3[i] = clamp$9(smoothstep(0.18, 0.42, w[i]) * smoothstep(0.05, 0.25, rk3[i] + w[i] * 0.6) * patch * 1.25, 0, 1);
    }
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('aRk', new THREE.BufferAttribute(rk, 4));
  g.setAttribute('aRk2', new THREE.BufferAttribute(rk2, 4));
  g.setAttribute('aRk3', new THREE.BufferAttribute(rk3, 1));
}

const ROCK_VDECL = `
attribute vec4 aRk;
attribute vec4 aRk2;
attribute float aRk3;
varying vec4 vRk;
varying vec4 vRk2;
varying float vIr;
varying float vPz;
`;
const ROCK_VBEGIN = 'vRk = aRk;\nvRk2 = aRk2;\nvIr = 0.5;\nvPz = aRk3;';
const ROCK_VBEGIN_INST = `
{
  vec3 wIc = wInstPos();
  float wDc = distance(wIc, uCamPos);
  if (wDc > uFar) { gl_Position = vec4(0.0, 0.0, 2.0, 1.0); return; }
  vIr = wHv(wIc.xz * 1.37 + 0.2);
  transformed *= wFadeAt(wDc, uFar, wIc);
}
vRk = aRk;
vRk2 = aRk2;
vPz = 0.0;
`;
const ROCK_FDECL = `
varying vec4 vRk;
varying vec4 vRk2;
varying float vIr;
varying float vPz;
`;
const ROCK_FCOLOR = `
vec3 wDx = dFdx(vWPos);
vec3 wDy = dFdy(vWPos);
float wFootR = max(length(wDx), length(wDy));
vec3 wGrad = vec3(0.0);
float wCrH = 0.0;
float wAO = vRk2.x;
float wRough = 0.88;
float wBounce = 0.0;
vec3 wFluo = vec3(0.0);
float wPig = 0.0;
{
  vec3 nW = normalize(vWNrm);
  vec3 tw = wTriW(nW);
  wBounce = 0.08 * uLight * (1.0 - smoothstep(-0.3, 0.55, nW.y));
  float cellL;
  float cellS;
  vec4 d1 = wTriA(vWPos, wDx, wDy, tw, 0.62, cellL);
  vec4 d2 = wTriA(vWPos, wDx, wDy, tw, 2.6, cellS);
  vec4 cc = wTriC(vWPos + vec3(d1.w - 0.5, d2.w - 0.5, d1.w * d2.w - 0.25) * 0.14, wDx, wDy, tw, 0.42);
  float n1 = d1.w;
  float n2 = d2.w;
  float ir = vIr;
  vec3 stone = diffuseColor.rgb * (0.82 + 0.36 * n2);
  float cmask = vRk2.w * (1.0 - tw.y * 0.6) * (1.0 - smoothstep(0.01, 0.03, wFootR)) * smoothstep(0.35, 0.6, cc.b + (n1 - 0.5) * 0.5);
  float cDist = length(vWPos - cameraPosition), cFw = fwidth(cc.g);
  float cFade = 1.0 - smoothstep(3.5, 8.0, cDist);
  float crack = (1.0 - smoothstep(0.0, 0.1 + 3.0 * cFw, cc.g)) * cmask * cFade;
  float cHalo = (1.0 - smoothstep(0.0, 0.18 + 3.0 * cFw, cc.g)) * cmask * cFade;
  wCrH = -0.012 * (1.0 - smoothstep(0.0, 0.12 + 3.0 * cFw, cc.g)) * cmask * cFade;
  float pit = (1.0 - smoothstep(0.05, 0.12, cellS)) * smoothstep(0.62, 0.8, n1);
  stone *= (1.0 - 0.06 * crack) * (1.0 - 0.2 * pit);
  wAO *= (1.0 - 0.08 * crack) * (1.0 - 0.1 * cHalo) * (1.0 - 0.1 * pit);
  float turf = smoothstep(0.36, 0.74, vRk.x + (n1 - 0.5) * 0.4 + (n2 - 0.5) * 0.45 + (cc.b - 0.5) * 0.3 + (ir - 0.5) * 0.15);
  turf = max(turf, smoothstep(0.5, 0.9, nW.y) * smoothstep(0.1, 0.55, n1 + (cc.b - 0.5) * 0.4) * 0.9);
  float cellF = 0.5;
  vec4 d3 = wTriA(vWPos, wDx, wDy, tw, 0.3, cellF);
  float lob = d3.w;
  float cv = vRk.y * 0.65 + (n1 - 0.5) * 0.75 + (cc.a - 0.5) * 0.12 + 0.12;
  float cor = smoothstep(0.43, 0.6, cv) * smoothstep(0.32, 0.6, lob + (cc.b - 0.5) * 0.2);
  float cavK = clamp((1.0 - vRk2.x) * 2.2 - 0.2, 0.0, 1.0);
  float hideK = clamp(cavK * 1.2 + smoothstep(0.35, -0.3, nW.y) * 0.7 + (1.0 - abs(nW.y)) * 0.25, 0.0, 1.0);
  hideK *= smoothstep(0.28, 0.62, lob + (n1 - 0.5) * 0.45);
  cor *= mix(0.45, 1.0, hideK);
  float corRim = clamp(smoothstep(0.38, 0.45, cv) - cor, 0.0, 1.0);
  float wNear = 1.0 - smoothstep(4.0, 11.0, length(vWPos - cameraPosition));
  float mot = 0.5, cellM = 0.5;
  if (wNear > 0.0 && vPz > 0.004) { vec4 d4 = wTriA(vWPos, wDx, wDy, tw, 8.5, cellM); mot = mix(0.5, clamp(d4.w * 0.7 + (1.0 - cellM) * 0.55 - 0.12, 0.0, 1.0), wNear); }
  float nich = clamp((1.0 - vRk2.x) * 2.6 - 0.35, -0.3, 0.6);
  float spgR = vRk.z + (n1 - 0.5) * 0.3 + (lob - 0.5) * 0.5 + nich * 0.3 + (n2 - 0.5) * 0.3 + (cc.a - 0.5) * 0.14 + (cc.b - 0.5) * 0.1;
  float spg = smoothstep(0.56, 0.74, spgR) * mix(0.55, 1.0, clamp(nich * 1.8 + 0.3, 0.0, 1.0)) * mix(0.55, 1.0, smoothstep(0.3, 0.6, lob + (n1 - 0.5) * 0.4));
  float pur = smoothstep(0.5, 0.7, vRk.w + (lob - 0.5) * 0.45 + (n2 - 0.5) * 0.3) * mix(0.2, 1.0, hideK);
  float dust = smoothstep(0.38, 0.78, vRk2.y + (n2 - 0.5) * 0.5 + (cc.b - 0.5) * 0.25);
  vec3 col = stone;
  col = mix(col, vec3(0.6, 0.53, 0.54), corRim * 0.12);
  vec3 corC = mix(mix(vec3(0.46, 0.39, 0.38), vec3(0.52, 0.44, 0.42), n2), mix(mix(vec3(0.5, 0.26, 0.27), vec3(0.54, 0.3, 0.29), n2), mix(vec3(0.42, 0.22, 0.28), vec3(0.46, 0.25, 0.3), n2), hideK), wNear) * (0.94 + 0.12 * (1.0 - cellL));
  col = mix(col, corC, cor * mix(0.75, 0.85, wNear));
  vec3 purC = mix(mix(vec3(0.3, 0.25, 0.26), vec3(0.37, 0.31, 0.31), n1), mix(vec3(0.42, 0.18, 0.18), vec3(0.36, 0.15, 0.2), smoothstep(0.35, 0.65, n2)), wNear);
  float purK = pur * (1.0 - 0.5 * cor) * mix(0.25, 0.45, wNear);
  col = mix(col, purC, purK);
  float pk = fract(vRk2.z + ir * 0.37);
  vec3 spC = mix(vec3(0.66, 0.26, 0.1), vec3(0.55, 0.16, 0.08), smoothstep(0.28, 0.36, pk));
  spC = mix(spC, vec3(0.6, 0.2, 0.09), smoothstep(0.52, 0.6, pk));
  spC = mix(spC, vec3(0.68, 0.38, 0.18), smoothstep(0.76, 0.84, pk));
  vec3 spF = mix(vec3(0.7, 0.42, 0.2), vec3(0.58, 0.28, 0.2), smoothstep(0.28, 0.36, pk));
  spF = mix(spF, vec3(0.7, 0.6, 0.28), smoothstep(0.52, 0.6, pk));
  spF = mix(spF, vec3(0.72, 0.48, 0.22), smoothstep(0.76, 0.84, pk));
  spF = mix(vec3(dot(spF, vec3(0.3, 0.5, 0.2))), spF, 0.55) * 0.9;
  float und = smoothstep(-0.2, -0.45, nW.y);
  spC = mix(spC, vec3(0.86, 0.72, 0.12), und * smoothstep(0.9, 0.925, pk) * (1.0 - smoothstep(0.965, 0.99, pk)));
  spC = mix(spC, vec3(0.36, 0.12, 0.16), und * smoothstep(0.04, 0.065, pk) * (1.0 - smoothstep(0.13, 0.155, pk)));
  spC = mix(spC, vec3(dot(spC, vec3(0.3, 0.5, 0.2))), 0.35) * 0.86;
  spF = mix(spF, stone, 0.45);
  spC = mix(spC, spC.gbr * vec3(1.0, 0.7, 0.9) + vec3(0.12, 0.02, 0.0), 0.18 * smoothstep(0.35, 0.75, cc.a));
  spC = mix(spF, spC, wNear) * (0.8 + 0.34 * n2 * (0.6 + 0.4 * cc.b));
  spC = mix(spC, stone, 0.22 + 0.25 * (1.0 - smoothstep(0.62, 0.9, spgR)));
  float spE = spg * (1.0 - spg) * 4.0;
  col = mix(col, spC, spg * 0.78);
  wAO *= 1.0 - 0.1 * spE * wNear;
  wCrH += 0.006 * spg * wNear * (0.6 + 0.8 * n2);
  wFluo = (corC * vec3(1.0, 0.4, 0.45) * (cor * 0.26) + purC * vec3(1.0, 0.3, 0.4) * (purK * 0.26) + spC * vec3(1.0, 0.6, 0.25) * (spg * 0.4)) * (0.34 * wNear);
  float upF = smoothstep(0.45, 0.95, nW.y);
  vec3 tuC = stone * mix(vec3(0.6, 0.64, 0.42), vec3(0.74, 0.76, 0.52), n2) * (0.88 + 0.2 * (1.0 - cellS));
  tuC = mix(tuC, vec3(0.22, 0.2, 0.12) * (0.8 + 0.4 * n2), upF * 0.9);
  col = mix(col, tuC, turf * 0.9);
  col = mix(col, mix(stone, vec3(0.4, 0.37, 0.29), 0.75) * (0.85 + 0.2 * n2), dust * 0.6);
  col *= mix(1.0, 0.8, upF * (0.35 + 0.65 * max(turf, dust)));
  wFluo *= (1.0 - 0.9 * turf) * (1.0 - 0.6 * dust) * mix(1.0, wAO, 0.5);
  float pz = vPz > 0.004 ? smoothstep(0.18, 0.5, vPz + (mot - 0.5) * 0.45) : 0.0;
  vec3 pzC = mix(vec3(0.6, 0.34, 0.05), vec3(0.84, 0.55, 0.1), smoothstep(0.3, 0.75, mot)) * (0.9 + 0.2 * n2);
  col = mix(col, pzC, pz * 0.92);
  wFluo += pzC * vec3(1.0, 0.62, 0.1) * (pz * 0.1 * wNear);
  wPig = 0.5 * max(max(max(cor, purK), spg) * (1.0 - turf) * (1.0 - 0.6 * dust), pz);
  float wFarS = smoothstep(9.0, 20.0, length(vWPos - cameraPosition));
  diffuseColor.rgb = col * mix(1.0, wAO, 0.5 * (1.0 - 0.5 * wFarS)) * (1.0 + 0.45 * wFarS);
  float bare = (1.0 - turf) * (1.0 - spg) * (1.0 - dust);
  float wClose = 1.0 - smoothstep(1.5, 5.0, length(vWPos - cameraPosition));
  wGrad = d1.xyz * (0.008 * (1.0 - 0.7 * dust) + 0.004 * cor + 0.01 * bare * wClose) + d2.xyz * (0.007 * bare + 0.007 * turf + 0.003 * spg + 0.006 * bare * wClose)
    + d3.xyz * (0.004 * max(spg, pz) * wNear);
  wRough = mix(mix(mix(0.88, 0.5, spg), 0.62, pz), 1.0, turf);
}
`;
const ROCK_OPTS = {
  fDecl: ROCK_FDECL,
  fColor: ROCK_FCOLOR,
  fEmissive: 'totalEmissiveRadiance += diffuseColor.rgb * wBounce;\n' + FLUO_AMBIENT,
  fLights: FLUO_LIGHTS + PIG_WB,
  fRough: 'roughnessFactor = wRough;',
  fNormal: 'normal = wBumpH(wPerturb(normal, wGrad), wCrH);',
  fAO: AO_APPLY,
};

function reefView(p) {
  const LN = LAYOUT.landing.lens, LD = LAYOUT.landing;
  if (p.kind !== 'knoll' && p.kind !== 'stone' && p.kind !== 'rubble') return LD;
  const a = Math.atan2(p.z - LN.z, p.x - LN.x) - Math.atan2(LD.z - LN.z, LD.x - LN.x);
  return Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < 0.7 ? LN : LD;
}
function blocksNear(p, blocks, pad) {
  const R = Math.max(p.sx, p.sz, p.r * p.sy) * 1.4 + pad;
  return blocks.filter((b) => b.form || Math.hypot(b.x - p.x, b.y - p.y, b.z - p.z) < R + Math.max(b.sx, b.sz, b.r * b.sy) * 1.4);
}
function reefShade(g, blocks, grid) {
  const P = g.attributes.position.array, N = g.attributes.normal.array, n = P.length / 3, out = new Float32Array(n);
  const sun = U.uSunW.value, T = [0.12, 0.25, 0.42, 0.65, 0.95, 1.35];
  for (let i = 0; i < n; i++) {
    const x = P[i * 3] + N[i * 3] * 0.04, y = P[i * 3 + 1] + N[i * 3 + 1] * 0.04, z = P[i * 3 + 2] + N[i * 3 + 2] * 0.04;
    if (y - grid.height(x, z) < 0.05) continue;
    let s = 0;
    for (const t of T) {
      const qx = x + sun.x * t, qy = y + sun.y * t, qz = z + sun.z * t;
      if (blocks.some((b) => inBlock(b, qx, qy, qz, 0.97))) { s = 1 - t / 2.2; break; }
    }
    out[i] = s;
  }
  return out;
}
function cullBuried(g, grid) {
  const P = g.attributes.position, I = g.index.array, keep = [], below = new Uint8Array(P.count);
  for (let i = 0; i < P.count; i++) below[i] = P.getY(i) < grid.height(P.getX(i), P.getZ(i)) - 0.06 ? 1 : 0;
  for (let t = 0; t < I.length; t += 3) if (!(below[I[t]] && below[I[t + 1]] && below[I[t + 2]])) keep.push(I[t], I[t + 1], I[t + 2]);
  g.setIndex(keep);
}

function buildRocks(plan, arch, grid, occl, forms = []) {
  const geos = [], fgeos = [], xmid = [], xfar = [], standOn = [], obstacles = [], reefSpots = [], tops = [], sides = [], reefTops = [], reefSides = [], reef = [];
  const rms = {};
  let rt = performance.now();
  const rlap = (k) => { const n = performance.now(); rms[k] = Math.round(n - rt); rt = n; };
  const built = plan.map((p) => clusterRockGeometry(p)), blocks = plan.filter((p) => p.reef).concat(forms.map((f) => f.solid));
  rlap('shapes');
  const collect = (g, p, nb = blocks) => {
    const P = g.attributes.position.array, N = g.attributes.normal.array, A = g.attributes.aRk3 && g.attributes.aRk3.array;
    const T = p && p.reef ? reefTops : tops, S = p && p.reef ? reefSides : sides;
    for (let i = 0; i < P.length / 3; i++) {
      const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2];
      const hB = y - grid.height(x, z);
      if (hB < 0.05) continue;
      if (p && p.reef && nb.some((b) => b !== p && inBlock(b, x, y, z, 0.98))) continue;
      const ny = N[i * 3 + 1];
      const e = { x, y, z, nx: N[i * 3], ny, nz: N[i * 3 + 2], hB };
      if (p && p.reef) e.b = p;
      if (ny > 0.55) T.push(e);
      else if (ny > -0.35) S.push(e);
      if (p && p.reef) reef.push(Object.assign({ o: p.reef, k: reefRich(x, z), sh: p.shade[i], pz: A ? A[i] : 0 }, e));
    }
  };
  plan.forEach((p, k) => {
    const { g, beds } = built[k];
    const nearB = p.reef ? blocksNear(p, blocks, 1.5) : null;
    if (p.reef) p.shade = reefShade(g, nearB, grid);
    bakeRock(g, beds, { grid, occl, self: occl[k], rich: p.reef ? reefRich(p.x, p.z) : 0, shade: p.reef ? p.shade : null, view: p.reef ? reefView(p) : null, coarse: !p.reef });
    if (p.reef) cullBuried(g, grid);
    collect(g, p, nearB);
    (p.far ? xfar : p.mid ? xmid : geos).push(g);
    if (p.reef) {
      const ax = 0.98 * p.sx, az = 0.98 * p.sz, rr = Math.min(ax, az), half = Math.max(ax, az), m = Math.max(1, Math.ceil(half / rr - 0.25));
      const c = Math.cos(p.yaw), s = Math.sin(p.yaw), dx = ax >= az ? c : s, dz = ax >= az ? -s : c, fl = floorHeight(p.x, p.z);
      const ys = p.top - fl > 1.6 * rr ? [p.top - rr * 0.8, fl + rr * 0.6] : [p.top - rr * 0.8];
      for (const y of ys) {
        for (let i = 0; i < m; i++) {
          const u = m === 1 ? 0 : ((i / (m - 1)) * 2 - 1) * (half - rr);
          const o = { x: p.x + dx * u, y, z: p.z + dz * u, r: rr, rock: true };
          if (p.kind === 'knoll' || p.kind === 'stone' || p.kind === 'shelf' || p.kind === 'rubble') o.stone = true;
          obstacles.push(o);
        }
      }
      return;
    }
    obstacles.push({ x: p.x, y: p.y + p.r * p.sy * 0.25, z: p.z, r: Math.min(p.sx, p.sz) * 0.95, rock: true });
    if (p.main) reefSpots.push({ x: p.x, y: p.y + p.r * p.sy * 1.05, z: p.z });
  });
  rlap('bake');
  {
    const { g, beds } = archGeometry(arch);
    bakeRock(g, beds, { grid, occl, self: null });
    collect(g);
    geos.push(g);
    for (const s of arch.spheres) obstacles.push({ x: s.x, y: s.y, z: s.z, r: s.r });
    reefSpots.push({ x: arch.ax, y: arch.y + 5.4, z: arch.az });
  }
  const sun = U.uSunW.value, ST = [0.15, 0.3, 0.5, 0.75, 1.05, 1.45];
  rlap('arch');
  for (const f of forms) {
    const { g, beds } = formGeometry(f);
    rlap('net_' + f.kind);
    const fr = (x, z) => Math.max(reefRich(x, z), 0.6);
    bakeRock(g, beds, { grid, occl, self: null, rich: fr(f.ax, f.az) });
    cullBuried(g, grid);
    const t0 = tops.length, s0 = sides.length;
    collect(g);
    const free = (e) => !blocks.some((b) => b !== f.solid && inBlock(b, e.x, e.y, e.z, 0.98));
    reefTops.push(...tops.splice(t0).filter(free));
    reefSides.push(...sides.splice(s0).filter(free));
    const Pp = g.attributes.position.array, N = g.attributes.normal.array, o = { kind: 'wall', name: f.name }, b = f.solid;
    for (let i = 0; i < Pp.length / 3; i += 5) {
      const x = Pp[i * 3], y = Pp[i * 3 + 1], z = Pp[i * 3 + 2], hB = y - grid.height(x, z), nx = N[i * 3], ny = N[i * 3 + 1], nz = N[i * 3 + 2];
      if (hB < 0.12) continue;
      const e = { x, y, z, nx, ny, nz, hB, o, b, k: fr(x, z), sh: 0, pz: 0 };
      if (!free(e)) continue;
      const px = x + nx * 0.06, py = y + ny * 0.06, pz = z + nz * 0.06;
      for (const t of ST) if (inBlock(b, px + sun.x * t, py + sun.y * t, pz + sun.z * t, 1, false)) { e.sh = 1 - t / 2.4; break; }
      reef.push(e);
    }
    fgeos.push(g);
    {
      const P = g.attributes.position, I = g.index.array, keep = [], T = f.hole;
      const over = (i) => {
        if (!T) return false;
        const [lx, lz] = lsLocal(f, P.getX(i), P.getZ(i)), ly = P.getY(i) - f.y0;
        return ly > 2.0 && Math.abs(lx - T.x0) < T.a * 0.97 && lz > f.lo[2] - 0.5 && lz < f.hi[2] + 0.5;
      };
      for (let t = 0; t < I.length; t += 3) if (!(over(I[t]) && over(I[t + 1]) && over(I[t + 2]))) keep.push(I[t], I[t + 1], I[t + 2]);
      const rg = new THREE.BufferGeometry();
      rg.setAttribute('position', P);
      rg.setIndex(keep);
      standOn.push(rg);
    }
    for (const s of f.spheres) obstacles.push({ x: s.x, y: s.y, z: s.z, r: s.r, rock: true });
  }
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88, metalness: 0, envMapIntensity: 0.6 });
  worldMaterial(mat, 'rock', Object.assign({ vDecl: ROCK_VDECL, vBegin: ROCK_VBEGIN }, ROCK_OPTS));
  const mk = (gs) => { const m = new THREE.Mesh(mergeGeometries(gs), mat); m.castShadow = true; m.receiveShadow = true; return m; };
  rlap('forms');
  const xall = xmid.concat(xfar), midMesh = xall.length ? mk(xall) : null, farMesh = null;
  if (midMesh) { midMesh.castShadow = false; midMesh.name = 'rock-far'; }
  const po = (gg) => { const q = new THREE.BufferGeometry(); q.setAttribute('position', gg.attributes.position); q.setIndex(gg.index); return q; };
  const both = fgeos.length ? mergeGeometries(geos.concat(fgeos)) : null;
  const mesh = both ? mk([both]) : mk(geos);
  let stand = mesh;
  if (standOn.length || xmid.length || both) stand = new THREE.Mesh(mergeGeometries([...geos.map(po), ...standOn, ...xmid.map(po)]));
  const formMesh = !both && fgeos.length ? mk(fgeos) : null;
  rlap('merge');
  return { mesh, formMesh, midMesh, farMesh, stand, obstacles, reefSpots, tops, sides, reefTops, reefSides, reef, ms: rms };
}

function scatterRockMaterial(key, far) {
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88, metalness: 0, envMapIntensity: 0.6 });
  return worldMaterial(mat, key, Object.assign({
    vDecl: ROCK_VDECL + 'uniform float uFar;\n',
    vBegin: ROCK_VBEGIN_INST,
    uniforms: { uFar: { value: far } },
  }, ROCK_OPTS));
}

function planBoulders(plan, arch, q, solid = plan) {
  const rng = makeRng$1(4242);
  const out = [];
  const target = Math.floor(150 * q);
  const foot = (p) => 0.5 * (p.sx + p.sz);
  let tries = 0;
  while (out.length < target && tries < target * 40) {
    tries++;
    const r0 = rng();
    let x, z;
    if (r0 < 0.45) {
      const p = plan[Math.floor(rng() * plan.length)];
      const a = rng() * Math.PI * 2, d = foot(p) * (1.1 + rng() * 1.6);
      x = p.x + Math.cos(a) * d; z = p.z + Math.sin(a) * d;
    } else if (r0 < 0.65) {
      x = 27 + rng() * 18; z = (rng() - 0.5) * 90;
    } else if (r0 < 0.8) {
      const s0 = arch.spheres[rng() < 0.5 ? 0 : 8];
      const a = rng() * Math.PI * 2, d = 2 + rng() * 5;
      x = s0.x + Math.cos(a) * d; z = s0.z + Math.sin(a) * d;
    } else {
      x = (rng() - 0.5) * 120; z = (rng() - 0.5) * 120;
    }
    const s = 0.35 + Math.pow(rng(), 1.6) * 1.15;
    if (inClearings(x, z, 1.2 + s)) continue;
    const h = floorHeight(x, z);
    if (h < -50) continue;
    if (meadowAt(x, z) > 0.55 && rng() < 0.85) continue;
    let bad = false;
    for (const p of solid) if (Math.hypot(x - p.x, z - p.z) < foot(p) * 1.05 + s * 0.7) { bad = true; break; }
    if (!bad) for (const b of out) if (Math.hypot(x - b.x, z - b.z) < (b.s + s) * 0.8) { bad = true; break; }
    if (!bad) for (const sp of arch.spheres) if (Math.hypot(x - sp.x, z - sp.z) < 1.8 + s * 0.6) { bad = true; break; }
    if (bad) continue;
    const sy = s * (0.75 + rng() * 0.4);
    const ta = rng() * Math.PI * 2, tilt = rng() * 0.35;
    const qq = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(Math.cos(ta), 0, Math.sin(ta)), tilt)
      .multiply(new THREE.Quaternion().setFromAxisAngle(Y$1, rng() * Math.PI * 2));
    out.push({ x, z, y: h - sy * 0.2, s, sy, q: qq, tint: 0.88 + rng() * 0.24 });
  }
  const V = varyRng(4242 ^ 0x51);
  const LD = LAYOUT.landing, LB = { x: LD.x + (LD.lens.x - LD.x) * 2.15, z: LD.z + (LD.lens.z - LD.z) * 2.15 };
  const lanes = [[LD, LB], [LD, LAYOUT.frags[0]], [LD, LAYOUT.frags[1]]];
  for (let i = 0; i < LAYOUT.frags.length; i++) for (let j = i + 1; j < LAYOUT.frags.length; j++) lanes.push([LAYOUT.frags[i], LAYOUT.frags[j]]);
  const laneD = (x, z) => {
    let m = Infinity;
    for (const [a, b] of lanes) {
      const ux = b.x - a.x, uz = b.z - a.z, t = clamp$9(((x - a.x) * ux + (z - a.z) * uz) / (ux * ux + uz * uz), 0, 1);
      m = Math.min(m, Math.hypot(x - a.x - ux * t, z - a.z - uz * t));
    }
    return m;
  };
  const RP = { x: LAYOUT.anchor.x + (LAYOUT.boat.x - LAYOUT.anchor.x) * 0.38, z: LAYOUT.anchor.z + (LAYOUT.boat.z - LAYOUT.anchor.z) * 0.38 };
  const keeps = (x, z) => {
    const ux = LAYOUT.anchor.x - RP.x, uz = LAYOUT.anchor.z - RP.z, t = clamp$9(((x - RP.x) * ux + (z - RP.z) * uz) / (ux * ux + uz * uz), 0, 1);
    return [Math.min(...LAYOUT.frags.map((f) => Math.hypot(x - f.x, z - f.z))), Math.hypot(x - LAYOUT.assembly.x, z - LAYOUT.assembly.z), Math.hypot(x - RP.x - ux * t, z - RP.z - uz * t)];
  };
  const WANT = [5.5, 9, 1.5];
  const turnY = new THREE.Quaternion();
  for (const b of out) {
    const d0 = laneD(b.x, b.z), m0 = meadowAt(b.x, b.z), k0 = keeps(b.x, b.z), turn = (V() - 0.5) * 1.4;
    const site0 = siteRockClear(b.x, b.z, b.s);
    for (let t = 0; site0 && t < 4; t++) {
      const a = V() * Math.PI * 2, d = (0.3 + 0.8 * V()) * (1 - t * 0.2), x = b.x + Math.cos(a) * d, z = b.z + Math.sin(a) * d, s = b.s;
      if (inClearings(x, z, 1.2 + s) || floorHeight(x, z) < -50 || !siteRockClear(x, z, s)) continue;
      if (laneD(x, z) < Math.min(d0, 2 + s) || (meadowAt(x, z) > 0.55 && m0 <= 0.55)) continue;
      if (keeps(x, z).some((k, j) => k < Math.min(k0[j], WANT[j] + s))) continue;
      let bad = false;
      for (const p of solid) if (Math.hypot(x - p.x, z - p.z) < foot(p) * 1.05 + s * 0.7) { bad = true; break; }
      if (!bad) for (const o of out) if (o !== b && Math.hypot(x - o.x, z - o.z) < (o.s + s) * 0.8) { bad = true; break; }
      if (!bad) for (const sp of arch.spheres) if (Math.hypot(x - sp.x, z - sp.z) < 1.8 + s * 0.6) { bad = true; break; }
      if (bad) continue;
      b.ox = b.x; b.oz = b.z;
      b.x = x; b.z = z; b.y = floorHeight(x, z) - b.sy * 0.2;
      break;
    }
    b.q.premultiply(turnY.setFromAxisAngle(Y$1, turn));
  }
  return out;
}

function planCobbles(plan, boulders, grid, q, solid = plan) {
  const rng = makeRng$1(777), J = varyRng(777);
  const bx = (b) => (b.ox !== undefined ? b.ox : b.x), bz = (b) => (b.oz !== undefined ? b.oz : b.z);
  const out = [];
  const target = Math.floor(760 * q);
  const foot = (p) => 0.5 * (p.sx + p.sz);
  const c = new THREE.Color();
  let tries = 0;
  while (out.length < target && tries < target * 14) {
    tries++;
    const r0 = rng();
    let x, z;
    if (r0 < 0.35) {
      const p = plan[Math.floor(rng() * plan.length)];
      const a = rng() * Math.PI * 2, d = foot(p) * (1.02 + rng() * 1.5);
      x = p.x + Math.cos(a) * d; z = p.z + Math.sin(a) * d;
    } else if (r0 < 0.58 && boulders.length) {
      const b = boulders[Math.floor(rng() * boulders.length)];
      const a = rng() * Math.PI * 2, d = b.s * (0.9 + rng() * 1.8);
      x = bx(b) + Math.cos(a) * d; z = bz(b) + Math.sin(a) * d;
    } else if (r0 < 0.7) {
      x = LAYOUT.hull.x + rng.gauss() * 1.8; z = LAYOUT.hull.z + rng.gauss() * 4.5;
    } else if (r0 < 0.84) {
      x = 25 + rng() * 20; z = (rng() - 0.5) * 90;
    } else {
      x = (rng() - 0.5) * 120; z = (rng() - 0.5) * 120;
    }
    const s = 0.07 + Math.pow(rng(), 2) * 0.28;
    if (nearGameplay(x, z, 0.5) || nearAssembly(x, z, 9.5)) continue;
    let h = grid.height(x, z);
    if (h < -48) continue;
    let bad = false;
    for (const p of solid) if (Math.hypot(x - p.x, z - p.z) < foot(p) * 0.98) { bad = true; break; }
    if (!bad) for (const b of boulders) if (Math.hypot(x - bx(b), z - bz(b)) < b.s * 0.8) { bad = true; break; }
    if (bad) continue;
    const keeps = (x2, z2) => {
      if (nearGameplay(x2, z2, 0.5) || nearAssembly(x2, z2, 9.5) || Math.hypot(x2 - LAYOUT.landing.x, z2 - LAYOUT.landing.z) < 1.1 + s) return false;
      if ((LAYOUT.siteSpots || []).some((k) => Math.hypot(x2 - k[0], z2 - k[1]) - s < k[2]) || grid.height(x2, z2) < -48) return false;
      for (const p of solid) if (Math.hypot(x2 - p.x, z2 - p.z) < foot(p) * 0.98) return false;
      for (const b of boulders) if (Math.hypot(x2 - b.x, z2 - b.z) < b.s * 0.8) return false;
      return true;
    };
    for (let t = 0; t < 3; t++) {
      const a = J() * Math.PI * 2, d = 0.15 + 0.45 * J(), x2 = x + Math.cos(a) * d, z2 = z + Math.sin(a) * d;
      if (keeps(x2, z2)) { x = x2; z = z2; h = grid.height(x, z); break; }
    }
    const nrm = grid.normal(x, z);
    const qq = new THREE.Quaternion().setFromUnitVectors(Y$1, nrm)
      .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(rng() - 0.5, 0, rng() - 0.5).normalize(), rng() * 0.4))
      .multiply(new THREE.Quaternion().setFromAxisAngle(Y$1, rng() * Math.PI * 2));
    const t = 0.6 + rng() * 0.25;
    out.push({ p: new THREE.Vector3(x, h - s * 0.32, z), q: qq, s: new THREE.Vector3(s, s * (0.7 + rng() * 0.5), s), c: c.setRGB(t, t * 0.97, t * 0.93).clone() });
  }
  return out;
}

const BED_CAV = [[0.85, [0.6, 0.48, 0.1], [0.78, 0.68, 0.2], 0], [0.15, [0.6, 0.46, 0.1], [0.8, 0.56, 0.14], 0]];
const BED_HA = [Math.sin(LAYOUT.hull.rot), Math.cos(LAYOUT.hull.rot)], BED_HB = [Math.cos(LAYOUT.hull.rot), -Math.sin(LAYOUT.hull.rot)];
function segDist$2(x, z, a, b) {
  const ux = b.x - a.x, uz = b.z - a.z, l2 = ux * ux + uz * uz || 1e-9;
  const t = clamp$9(((x - a.x) * ux + (z - a.z) * uz) / l2, 0, 1);
  return Math.hypot(x - a.x - ux * t, z - a.z - uz * t);
}
const BED_WALKS = [[LAYOUT.landing, LAYOUT.frags[0]], [LAYOUT.landing, LAYOUT.frags[1]], [LAYOUT.frags[0], LAYOUT.frags[1]], [LAYOUT.frags[1], LAYOUT.frags[2]], [LAYOUT.frags[0], LAYOUT.frags[2]]];
const BED_NORTH = [LAYOUT.landing, { x: -1.25, z: 10.95 }];
const BED_NORTH2 = [{ x: -1.25, z: 10.95 }, { x: -2.2, z: 17.5 }];
const BED_ROPE = [{ x: LAYOUT.anchor.x + (LAYOUT.boat.x - LAYOUT.anchor.x) * 0.38, z: LAYOUT.anchor.z + (LAYOUT.boat.z - LAYOUT.anchor.z) * 0.38 }, LAYOUT.anchor];
const BED_LENS = (() => { const dx = 7.36 - LAYOUT.landing.x, dz = 2.48 - LAYOUT.landing.z, l = Math.hypot(dx, dz); return [LAYOUT.landing, { x: LAYOUT.landing.x - (dx / l) * 7, z: LAYOUT.landing.z - (dz / l) * 7 }]; })();
function siteRockClear(x, z, r) {
  for (const k of LAYOUT.siteKeep || []) if (Math.hypot(x - k.x, z - k.z) - r < k.r + 1.2) return false;
  for (const w of LAYOUT.siteWays || []) {
    for (let i = 0; i < w.length; i++) if (Math.hypot(x - w[i][0], z - w[i][1]) < 1.8 + r) return false;
    for (let i = 0; i < w.length - 1; i++) if (segDist$2(x, z, { x: w[i][0], z: w[i][1] }, { x: w[i + 1][0], z: w[i + 1][1] }) < 1.3 + r) return false;
  }
  return true;
}
function siteWayClear(x, up, z, r) {
  if (up > 4.2) return true;
  for (const w of LAYOUT.siteWays || []) {
    for (let i = 0; i < w.length; i++) if (Math.hypot(x - w[i][0], z - w[i][1]) < 1.3 + r) return false;
    if (up < 1.9) for (let i = 0; i < w.length - 1; i++) if (segDist$2(x, z, { x: w[i][0], z: w[i][1] }, { x: w[i + 1][0], z: w[i + 1][1] }) < 0.9 + r) return false;
  }
  return true;
}
function bedClear(x, z, r, low, why = null, near = -1) {
  const no = (k) => { if (why) why[k] = (why[k] || 0) + 1; return false; };
  if (Math.hypot(x - LAYOUT.landing.x, z - LAYOUT.landing.z) - r < (low ? 1.6 : 2.2)) return no('landing');
  const dx = x - LAYOUT.hull.x, dz = z - LAYOUT.hull.z, s = dx * BED_HA[0] + dz * BED_HA[1], b = dx * BED_HB[0] + dz * BED_HB[1];
  const hw = 3.3 * (1 - 0.72 * Math.pow(smoothstep(0.35, 1.0, Math.abs(s + 4.5) / 16.5), 1.3));
  if (low) {
    if (s > -21.5 && s < 12.8 && b > -hw - 1.4 - r && b < hw + 0.6 + r) return no('hull');
    if (s > -5 && s < 9.0 && b > -r && b < 8.8 + r) return no('spill');
  } else {
    if (s > -22.5 && s < 13.5 && b > -hw - 2.0 - r && b < hw + 2.0 + r) return no('hull');
    if (s > -5.5 && s < 9.5 && b > -r && b < 9.5 + r) return no('spill');
    if (segDist$2(x, z, BED_LENS[0], BED_LENS[1]) - r < 2.2) return no('lens');
    for (const k of LAYOUT.siteKeep || []) if (Math.hypot(x - k.x, z - k.z) - r < k.r) return no('site');
    if (!siteWayClear(x, 0, z, r)) return no('site');
  }
  for (let i = 0; i < LAYOUT.frags.length; i++) if (Math.hypot(x - LAYOUT.frags[i].x, z - LAYOUT.frags[i].z) - r < (i === near ? 1.8 : 5.5)) return no('find');
  for (const [a, bb] of BED_WALKS) if (segDist$2(x, z, a, bb) - r < 1.5) return no('walk');
  if (segDist$2(x, z, BED_NORTH[0], BED_NORTH[1]) - r < 1.5 || segDist$2(x, z, BED_NORTH2[0], BED_NORTH2[1]) - r < 1.5) return no('north');
  if (segDist$2(x, z, BED_ROPE[0], BED_ROPE[1]) - r < 1.5) return no('rope');
  if (Math.hypot(x - LAYOUT.arm.x, z - LAYOUT.arm.z) - r < 3.0 || Math.hypot(x - LAYOUT.torso.x, z - LAYOUT.torso.z) - r < 3.0) return no('arm');
  if (low) for (const k of LAYOUT.siteSpots || []) if (Math.hypot(x - k[0], z - k[1]) - r < k[2]) return no('spot');
  return Math.hypot(x - LAYOUT.assembly.x, z - LAYOUT.assembly.z) - r >= (low ? 3.0 : 9.0) || no('machine');
}
const BED_SITES2 = [[13.75, -0.61, 2.6], [11.16, -0.52, 2.0], [7.06, 9.7, 2.6], [6.09, 7.28, 2.0], [12.31, -1.24, 2.6], [9.77, -0.7, 2.0],
  [-13.45, -0.06, 2.6], [-11.52, -1.8, 2.0], [-9.99, -4.7, 2.0], [-10.8, -2.8, 2.0],
  [5.67, -19.21, 2.6], [3.08, -19.34, 2.0], [9.0, -17.82, 2.6], [6.52, -18.62, 2.0], [4.38, -20.02, 2.6], [1.84, -19.48, 2.0]];
function bedSites2Clear(x, z, r) {
  for (const k of BED_SITES2) if (Math.hypot(x - k[0], z - k[1]) - r < k[2]) return false;
  for (const k of LAYOUT.siteSpots || []) if (Math.hypot(x - k[0], z - k[1]) - r < k[2] + 0.5) return false;
  return true;
}
function bedRim(pt, a) { return pt.r * (0.72 + pt.lob * Math.sin(a * 2 + pt.ph) + 0.14 * Math.sin(a * 3.7 + pt.ph * 2.1)); }
function planBed(R, solid, arch, forms, boulders, q) {
  const bed = { boulders: [], patches: [], why: {} };
  const foot = (p) => 0.5 * (p.sx + p.sz);
  const feet = [arch.spheres[0], arch.spheres[8]].map((s) => ({ x: s.x, z: s.z, r: 1.9 })).concat(...forms.map((f) => f.feet.map((s) => ({ x: s.x, z: s.z, r: s.r * 1.2 }))));
  const no = (k) => { bed.why[k] = (bed.why[k] || 0) + 1; return false; };
  const CELL = 4, cells = new Map(), key = (i, j) => i * 4096 + j;
  let reach = 0;
  const bin = (o, rr) => { reach = Math.max(reach, rr); const k = key(Math.floor(o.x / CELL), Math.floor(o.z / CELL)); let a = cells.get(k); if (!a) cells.set(k, (a = [])); a.push(o); };
  for (const p of solid) bin({ x: p.x, z: p.z, rk: foot(p) }, foot(p) * 1.05);
  for (const b of boulders) bin({ x: b.x, z: b.z, bs: b.s }, b.s * 0.8);
  const free = (x, z, r, spur = false) => {
    if (!bed.patches.every((f) => Math.hypot(f.x - x, f.z - z) > (f.r + r) * 0.8)) return no('patch');
    for (const s of feet) if (Math.hypot(x - s.x, z - s.z) < s.r + r) return no('form');
    const n = Math.ceil((reach + r) / CELL), i0 = Math.floor(x / CELL), j0 = Math.floor(z / CELL);
    for (let i = i0 - n; i <= i0 + n; i++) for (let j = j0 - n; j <= j0 + n; j++) {
      const a = cells.get(key(i, j));
      if (a) for (const o of a) {
        const d = Math.hypot(x - o.x, z - o.z);
        if (o.rk !== undefined ? d < (spur ? o.rk * 0.8 + r * 0.45 : o.rk * 1.05 + r) : d < o.bs * 0.8 + r) return no(o.rk !== undefined ? 'rock' : 'boulder');
      }
    }
    return floorHeight(x, z) > -40 || no('deep');
  };
  const boulder = (x, z, s, sy) => {
    const ta = R() * Math.PI * 2, tilt = R() * 0.3;
    const qq = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(Math.cos(ta), 0, Math.sin(ta)), tilt).multiply(new THREE.Quaternion().setFromAxisAngle(Y$1, R() * Math.PI * 2));
    bed.boulders.push({ x, z, y: floorHeight(x, z) - sy * 0.2, s, sy, q: qq, tint: 0.86 + R() * 0.22, bed: true });
  };
  const place = (x, z, kind, r, near = -1, fresh = false) => {
    if (!bedClear(x, z, r, kind === 'grass' || kind === 'rubble', bed.why, near) || !free(x, z, r, kind === 'spur')) return false;
    if (fresh && !bedSites2Clear(x, z, r * 1.3)) return no('site2');
    const pt = { x, z, r, kind, seed: Math.floor(R() * 1e9), ph: R() * 6.28, lob: 0.2 + R() * 0.2, fresh };
    bed.patches.push(pt);
    if (kind === 'knot') {
      for (let k = 0, n = 2 + Math.floor(R() * 4); k < n; k++) {
        const a = R() * Math.PI * 2, d = k ? r * (0.35 + R() * 0.55) : 0, s = k ? 0.3 + R() * 0.35 : 0.55 + R() * 0.35;
        boulder(x + Math.cos(a) * d, z + Math.sin(a) * d, s, s * (0.62 + R() * 0.35));
      }
    } else if (kind === 'spur') {
      const yaw = R() * Math.PI, n = 3 + Math.floor(R() * 3), len = (r - 0.8) * 2;
      for (let k = 0; k < n; k++) {
        const u = (k / (n - 1) - 0.5) * len, mid = 1 - Math.abs(u) / (len * 0.5 + 0.5), s = 0.6 + (0.4 + R() * 0.6) * mid;
        boulder(x + Math.cos(yaw) * u + (R() - 0.5) * 0.6, z + Math.sin(yaw) * u + (R() - 0.5) * 0.6, s, s * (0.75 + R() * 0.45));
      }
    } else if (kind === 'low') boulder(x, z, r, r * (0.5 + R() * 0.15));
    else if (kind === 'rubble' && R() < 0.4 && !fresh) {
      const bx = x + (R() - 0.5) * r, bz = z + (R() - 0.5) * r, bs = 0.28 + R() * 0.18, by = 0.2 + R() * 0.12;
      if (siteWayClear(bx, 0, bz, bs) && !(LAYOUT.siteKeep || []).some((k) => Math.hypot(bx - k.x, bz - k.z) - bs < k.r)) boulder(bx, bz, bs, by);
    }
    return true;
  };
  const kindOf = (u) => (u < 0.36 ? 'grass' : u < 0.66 ? 'rubble' : 'knot');
  const sizeOf = (k) => (k === 'grass' ? 0.9 + R() * 1.7 : k === 'rubble' ? 0.8 + R() * 1.2 : 0.8 + R() * 0.7);
  const from = [LAYOUT.landing, LAYOUT.landing, LAYOUT.frags[1]];
  LAYOUT.frags.forEach((f, i) => {
    const a0 = Math.atan2(f.z - from[i].z, f.x - from[i].x);
    for (const side of [-1, 1]) {
      for (let t = 0; t < 8; t++) {
        const a = a0 + side * (0.55 + R() * 0.8), d = 3.2 + R() * 1.8, s = 0.7 + R() * 0.3;
        if (place(f.x + Math.cos(a) * d, f.z + Math.sin(a) * d, 'low', s)) break;
      }
    }
  });
  const dense = clamp$9(0.35 + 0.65 * q, 0.3, 1), lens = BED_WALKS.map(([A, B]) => Math.hypot(B.x - A.x, B.z - A.z));
  const tot = lens.reduce((a, b) => a + b, 0), target = Math.round(110 * dense);
  for (let t = 0, got = 0; t < Math.round(2000 * dense) && got < target; t++) {
    const kind = kindOf(R()), r = sizeOf(kind);
    let x, z;
    if (R() < 0.7) {
      let u = R() * tot, w = 0;
      while (w < lens.length - 1 && u > lens[w]) u -= lens[w++];
      const [A, B] = BED_WALKS[w], ux = (B.x - A.x) / lens[w], uz = (B.z - A.z) / lens[w], side = R() < 0.5 ? -1 : 1, off = 1.5 + r + Math.pow(R(), 1.7) * 7;
      x = A.x + ux * u - uz * side * off; z = A.z + uz * u + ux * side * off;
    } else {
      const f = LAYOUT.frags[Math.floor(R() * 3)], a = R() * Math.PI * 2, d = 3 + r + R() * 7;
      x = f.x + Math.cos(a) * d; z = f.z + Math.sin(a) * d;
    }
    if (place(x, z, kind, r)) got++;
  }
  for (let t = 0, got = 0; t < Math.round(1200 * dense) && got < Math.round(48 * dense); t++) {
    const kind = R() < 0.5 ? 'grass' : 'rubble', r = 0.45 + R() * 0.55;
    let u = R() * tot, w = 0;
    while (w < lens.length - 1 && u > lens[w]) u -= lens[w++];
    const [A, B] = BED_WALKS[w], ux = (B.x - A.x) / lens[w], uz = (B.z - A.z) / lens[w], side = R() < 0.5 ? -1 : 1, off = 1.5 + r + Math.pow(R(), 2) * 2.5;
    if (place(A.x + ux * u - uz * side * off, A.z + uz * u + ux * side * off, kind, r)) got++;
  }
  for (let t = 0, got = 0; t < Math.round(700 * dense) && got < Math.round(13 * dense); t++) {
    const r = 1.9 + R() * 1.2;
    let x, z;
    if (R() < 0.6) {
      let u = R() * tot, w = 0;
      while (w < lens.length - 1 && u > lens[w]) u -= lens[w++];
      const [A, B] = BED_WALKS[w], ux = (B.x - A.x) / lens[w], uz = (B.z - A.z) / lens[w], side = R() < 0.5 ? -1 : 1, off = 9 + R() * 10;
      x = A.x + ux * u - uz * side * off; z = A.z + uz * u + ux * side * off;
    } else {
      const f = LAYOUT.frags[Math.floor(R() * 3)], a = R() * Math.PI * 2, d = 9 + R() * 10;
      x = f.x + Math.cos(a) * d; z = f.z + Math.sin(a) * d;
    }
    if (place(x, z, 'spur', r)) got++;
  }
  for (let t = 0, got = 0; t < 600 && got < Math.round(22 * dense); t++) {
    const a = R() * Math.PI * 2, r = 0.7 + R() * 1.0, d = 3.2 + r + R() * (5.6 - r);
    if (place(LAYOUT.assembly.x + Math.cos(a) * d, LAYOUT.assembly.z + Math.sin(a) * d, R() < 0.7 ? 'rubble' : 'grass', r)) got++;
  }
  if (q < 0.7) return bed;
  LAYOUT.frags.forEach((f, i) => {
    const a0 = Math.atan2(f.z - from[i].z, f.x - from[i].x);
    for (let t = 0, got = 0; t < 900 && got < 26; t++) {
      const u = R(), sd = R() < 0.5 ? -1 : 1, r = 0.4 + R() * (u < 0.45 ? 0.8 : 0.45);
      const a = u < 0.45 ? a0 + (R() - 0.5) * 2.1 : u < 0.8 ? a0 + sd * (1.05 + R() * 0.8) : a0 + Math.PI + (R() - 0.5) * 2.2;
      const d0 = u < 0.45 ? 3.0 : u < 0.8 ? 1.6 : 3.2, d = d0 + 1.3 * r + R() * (6.2 - d0 - r), kind = R() < 0.55 ? 'grass' : 'rubble';
      if (place(f.x + Math.cos(a) * d, f.z + Math.sin(a) * d, kind, r, i, true)) got++;
    }
  });
  for (let t = 0, got = 0; t < 3200 && got < 110; t++) {
    const kind = R() < 0.55 ? 'grass' : 'rubble', r = 0.45 + R() * 0.85;
    let u = R() * tot, w = 0;
    while (w < lens.length - 1 && u > lens[w]) u -= lens[w++];
    const [A, B] = BED_WALKS[w], ux = (B.x - A.x) / lens[w], uz = (B.z - A.z) / lens[w], side = R() < 0.5 ? -1 : 1, off = 1.5 + r + Math.pow(R(), 1.6) * 2.6;
    if (place(A.x + ux * u - uz * side * off, A.z + uz * u + ux * side * off, kind, r, -1, true)) got++;
  }
  LAYOUT.frags.forEach((f, i) => {
    const b0 = Math.atan2(from[i].z - f.z, from[i].x - f.x);
    for (let t = 0, got = 0; t < 700 && got < 8; t++) {
      const sd = R() < 0.5 ? -1 : 1, r = 0.3 + R() * 0.35, a = b0 + sd * (0.25 + R() * 0.6), d = 2.0 + 1.3 * r + R() * (3.0 - 1.3 * r);
      if (place(f.x + Math.cos(a) * d, f.z + Math.sin(a) * d, R() < 0.5 ? 'grass' : 'rubble', r, i, true)) got++;
    }
  });
  return bed;
}
function realiseBed(bed, grid, blockers, q) {
  const out = { stones: [], maerl: [], shoots: [], pad: [], hali: [], star: [], cysto: [], apl: [] }, c = new THREE.Color();
  const blocked = (x, z) => blockers.some((b) => (x - b.x) ** 2 + (z - b.z) ** 2 < b.r2);
  const n0 = clamp$9(q, 0.3, 1.2);
  const walkD = (x, z) => Math.min(...BED_WALKS.map(([a, b]) => segDist$2(x, z, a, b)), segDist$2(x, z, BED_NORTH[0], BED_NORTH[1]));
  for (const pt of bed.patches) {
    const n = n0 * (1.3 - 0.85 * smoothstep(3.0, 10.0, walkD(pt.x, pt.z)));
    const R = makeRng$1(pt.seed), rim = (a) => bedRim(pt, a);
    const spot = (fill) => {
      const a = R() * Math.PI * 2, d = pt.r * Math.sqrt(R()) * fill, x = pt.x + Math.cos(a) * d, z = pt.z + Math.sin(a) * d;
      return { x, z, e: rim(a) - d };
    };
    const ground = (x, z, s) => new THREE.Quaternion().setFromUnitVectors(Y$1, grid.normal(x, z)).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(R() - 0.5, 0, R() - 0.5).normalize(), R() * s)).multiply(new THREE.Quaternion().setFromAxisAngle(Y$1, R() * Math.PI * 2));
    const area = Math.PI * pt.r * pt.r;
    if (pt.kind === 'grass') {
      for (let k = 0, m = Math.round(area * (pt.fresh ? 62 : 44) * n); k < m; k++) {
        const s = spot(1.15);
        if (s.e < 0 || grid.sand(s.x, s.z) < 0.6 || blocked(s.x, s.z)) continue;
        const edge = 1 - smoothstep(0.05, 0.45, s.e), pt2 = clamp$9(0.5 + 1.4 * fbm2(s.x * 0.05 + 3.7, s.z * 0.05 - 1.2, 2), 0, 1);
        c.setRGB((0.84 + R() * 0.22) * (1.1 - 0.24 * pt2) * (1 + 0.22 * edge), (0.86 + R() * 0.22) * (0.9 + 0.2 * pt2) * (1 - 0.2 * edge), (0.8 + R() * 0.26) * (1.04 - 0.14 * pt2) * (1 - 0.42 * edge));
        out.shoots.push({ p: new THREE.Vector3(s.x, grid.height(s.x, s.z) - 0.02, s.z), q: new THREE.Quaternion().setFromAxisAngle(Y$1, R() * Math.PI * 2), s: sv((pt.fresh ? 1.15 : 1.0) * (1.0 + R() * 0.5) * (1 - 0.5 * edge)), c: c.clone() });
      }
      if (q >= 0.7) {
        const R2 = makeRng$1(pt.seed ^ 0x51a7);
        for (let k = 0, m = R2() < 0.7 ? 1 + Math.floor(R2() * 3) : 0; k < m; k++) {
          const a = R2() * Math.PI * 2, d = rim(a) * (0.8 + R2() * 0.2), x = pt.x + Math.cos(a) * d, z = pt.z + Math.sin(a) * d;
          if (blocked(x, z) || grid.sand(x, z) < 0.5) continue;
          const y = grid.height(x, z), nn = grid.normal(x, z);
          if (R2() < 0.3) out.star.push({ p: new THREE.Vector3(x, y + 0.004, z), q: new THREE.Quaternion().setFromAxisAngle(Y$1, R2() * 6.28), s: sv(0.85 + R2() * 0.45), c: new THREE.Color(0.88, 0.07 + R2() * 0.06, 0.03), tile: 'reef' });
          else out.cysto.push({ p: new THREE.Vector3(x, y - 0.02, z), q: orient$1(nn.x, nn.y, nn.z, 0.8, R2() * 6.28), s: sv(0.8 + R2() * 0.6), c: new THREE.Color(0.85 + R2() * 0.3, 0.85 + R2() * 0.25, 0.8 + R2() * 0.25), tile: 'reef' });
        }
      }
      continue;
    }
    const fill = pt.kind === 'rubble' ? 1.1 : pt.kind === 'spur' ? 1.0 : 1.35, nr = Math.round(area * (pt.kind === 'rubble' ? 38 : pt.kind === 'spur' ? 4 : 11) * n);
    for (let k = 0; k < nr; k++) {
      const sp = spot(fill);
      if (sp.e < -0.2 || blocked(sp.x, sp.z) || grid.sand(sp.x, sp.z) < 0.4) continue;
      const maerl = R() < 0.72, s = maerl ? 0.025 + Math.pow(R(), 1.6) * 0.04 : 0.07 + Math.pow(R(), 2) * 0.17;
      if (maerl) { const t = 0.88 + R() * 0.24; out.maerl.push({ p: new THREE.Vector3(sp.x, grid.height(sp.x, sp.z) + s * 0.1, sp.z), q: ground(sp.x, sp.z, 1.2), s: sv(s), c: new THREE.Color(t, t, t), v: 2 }); continue; }
      const t = 0.6 + R() * 0.25;
      out.stones.push({ p: new THREE.Vector3(sp.x, grid.height(sp.x, sp.z) - s * 0.3, sp.z), q: ground(sp.x, sp.z, 0.5), s: new THREE.Vector3(s, s * (0.65 + R() * 0.4), s), c: c.setRGB(t, t * 0.97, t * 0.93).clone() });
    }
    const tint = () => new THREE.Color(0.9 + R() * 0.2, 0.9 + R() * 0.2, 0.85 + R() * 0.2);
    for (let k = 0, m = 1 + Math.floor(R() * area * (pt.fresh ? 1.7 : 1.2) * n); k < m; k++) {
      const sp = spot(0.9);
      if (sp.e < 0 || blocked(sp.x, sp.z)) continue;
      const y = grid.height(sp.x, sp.z), nn = grid.normal(sp.x, sp.z), u = R();
      if (u < 0.5 || (pt.fresh && u < 0.9)) out.pad.push({ p: new THREE.Vector3(sp.x, y - 0.008, sp.z), q: orient$1(nn.x, nn.y, nn.z, 0.35, R() * 6.28), s: sv(0.7 + R() * 0.5), c: tint(), tile: 'reef' });
      else if (u < 0.9) out.hali.push({ p: new THREE.Vector3(sp.x, y - 0.006, sp.z), q: orient$1(nn.x, nn.y, nn.z, 0.5, R() * 6.28), s: sv(0.75 + R() * 0.5), c: tint(), tile: 'reef' });
      else out.star.push({ p: new THREE.Vector3(sp.x, y + 0.004, sp.z), q: new THREE.Quaternion().setFromAxisAngle(Y$1, R() * 6.28), s: sv(0.9 + R() * 0.4), c: new THREE.Color(0.88, 0.07 + R() * 0.05, 0.03), tile: 'reef' });
    }
    if (q >= 0.7 && pt.kind !== 'spur') {
      const R2 = makeRng$1(pt.seed ^ 0x51a7), nc = Math.round((pt.kind === 'knot' ? 1.5 : 1.0) * (1.5 + area * 1.4) * n);
      for (let k = 0; k < nc; k++) {
        const a = R2() * Math.PI * 2, d = pt.r * Math.sqrt(R2()) * 0.95, x = pt.x + Math.cos(a) * d, z = pt.z + Math.sin(a) * d;
        if (rim(a) - d < 0 || blocked(x, z) || grid.sand(x, z) < 0.4) continue;
        const y = grid.height(x, z), nn = grid.normal(x, z), u = R2();
        if (u < 0.72) out.cysto.push({ p: new THREE.Vector3(x, y - 0.02, z), q: orient$1(nn.x, nn.y, nn.z, 0.8, R2() * 6.28), s: sv(0.85 + R2() * 0.75), c: new THREE.Color(0.85 + R2() * 0.3, 0.85 + R2() * 0.25, 0.8 + R2() * 0.25), tile: 'reef' });
        else {
          const ax = R2() < 0.45, sz = 0.5 + R2() * 0.35;
          out.apl.push({ p: new THREE.Vector3(x, y - 0.02, z), q: orient$1(nn.x, nn.y, nn.z, 0.55, R2() * 6.28), s: ax ? new THREE.Vector3(sz * 0.8, sz * 1.35, sz * 0.8) : sv(sz), c: ax ? new THREE.Color(1.08, 0.56, 0.5) : new THREE.Color(1, 0.92 + 0.12 * R2(), 1), tile: 'reef' });
        }
      }
    }
  }
  return out;
}

function posidoniaShoot() {
  const rng = makeRng$1(505);
  const b = builder([['position', 3], ['normal', 3], ['aP', 4], ['aSide', 2]]);
  const LEAVES = 5, SEGS = 5;
  for (let k = 0; k < LEAVES; k++) {
    const age = k / (LEAVES - 1);
    const side = k === 0 ? 0 : k % 2 === 1 ? 1 : -1;
    const lean = side * (0.08 + 0.1 * Math.ceil(k / 2)) + (rng() - 0.5) * 0.06;
    const len = 0.36 + 0.36 * age + rng() * 0.1;
    const hw = 0.0078 * (0.9 + rng() * 0.25);
    const zo = (k - 2) * 0.0022;
    const outp = (rng() - 0.5) * 0.35;
    const twist = (rng() - 0.5) * 1.6;
    const seed = rng();
    const rows = [];
    for (let s = 0; s <= SEGS; s++) {
      const t = s / SEGS;
      const cx = lean * len * t * t, cy = len * t, cz = zo + outp * len * t * t;
      const tx = 2 * lean * len * t, ty = len, tz = 2 * outp * len * t;
      const tl = Math.hypot(tx, ty, tz);
      const tw = twist * t;
      let wx = Math.cos(tw), wz = Math.sin(tw), wy = -(wx * tx + wz * tz) / ty;
      const wl = Math.hypot(wx, wy, wz);
      wx /= wl; wy /= wl; wz /= wl;
      const nx = (ty * wz - tz * wy) / tl, ny = (tz * wx - tx * wz) / tl, nz = (tx * wy - ty * wx) / tl;
      const w = hw * (t < 0.8 ? 1 : lerp$4(1, 0.4, (t - 0.8) / 0.2));
      const l = b.v(cx - wx * w, cy - wy * w, cz - wz * w, nx, ny, nz, t, -1, seed, age, -wx * w, -wz * w);
      const r = b.v(cx + wx * w, cy + wy * w, cz + wz * w, nx, ny, nz, t, 1, seed, age, wx * w, wz * w);
      rows.push([l, r]);
    }
    for (let s = 0; s < SEGS; s++) b.q(rows[s][0], rows[s][1], rows[s + 1][0], rows[s + 1][1]);
  }
  for (const sz of [-1, 1]) {
    const seed = rng();
    const h = 0.045 + rng() * 0.025, w = 0.0095;
    const z0 = sz * 0.004;
    const a = b.v(-w, 0, z0, 0, 0, sz, 0, -1, seed, 2, -w, 0);
    const c = b.v(w, 0, z0, 0, 0, sz, 0, 1, seed, 2, w, 0);
    const d = b.v(-w * 0.8, h, z0 + sz * 0.002, 0, 0, sz, 1, -1, seed, 2, -w * 0.8, 0);
    const e = b.v(w * 0.8, h, z0 + sz * 0.002, 0, 0, sz, 1, 1, seed, 2, w * 0.8, 0);
    b.q(a, c, d, e);
  }
  return b.build();
}

const POSI_VDECL = `
attribute vec4 aP;
attribute vec2 aSide;
varying vec4 vP;
varying float vLen;
`;
const POSI_VNORMAL = `
vec3 wIp = wInstPos();
float wIh = wHv(wIp.xz * 3.17 + 0.71);
float wD = distance(wIp, uCamPos);
if (wD > 56.0) { gl_Position = vec4(0.0, 0.0, 2.0, 1.0); return; }
float wFs = 40.0 + 10.0 * wIh;
float wSink = 1.0 - smoothstep(wFs, wFs + 6.0, wD);
float wT = aP.x;
float wIsLeaf = step(aP.w, 1.5);
float wLenJ = mix(1.0, mix(0.72, 1.25, wHv(vec2(wIh * 13.1, aP.z * 7.7))), wIsLeaf);
vec3 wLeaf = position * wLenJ;
vec3 wSw = wToLocal(wSway(wIp, 1.0));
float wBend = wT * wT * 0.95 * wLenJ * wIsLeaf;
wLeaf += vec3(wSw.x, 0.0, wSw.z) * wBend;
wLeaf += objectNormal * (sin(uTime * 2.4 + wT * 5.5 + aP.z * 6.2832 + wIh * 6.2832) * 0.035 * wT * wIsLeaf);
wLeaf.y -= length(wSw.xz) * wBend * 0.45;
wLeaf *= wSink;
objectNormal = normalize(objectNormal + vec3(wSw.x, 0.0, wSw.z) * (wT * 0.6 * wIsLeaf));
vP = vec4(wT, aP.y, fract(aP.z + wIh * 7.13), aP.w);
vLen = wLenJ * (0.36 + 0.36 * min(aP.w, 1.0));
`;
const POSI_FDECL = `
varying vec4 vP;
varying float vLen;
`;
const POSI_FCOLOR = `
float wT = vP.x;
float wTrans = 1.0;
{
  float s = vP.y;
  float seed = vP.z;
  float age = vP.w;
  vec3 c;
  if (age > 1.5) {
    c = mix(vec3(0.17, 0.11, 0.05), vec3(0.3, 0.21, 0.1), fract(seed * 7.0)) * (0.8 + 0.4 * abs(sin(s * 9.0 + wT * 30.0)));
    wTrans = 0.2;
  } else {
    vec3 young = mix(vec3(0.13, 0.29, 0.06), vec3(0.2, 0.36, 0.08), seed);
    vec3 old = mix(vec3(0.24, 0.25, 0.08), vec3(0.32, 0.29, 0.11), seed);
    c = mix(young, old, age);
    c = mix(vec3(0.5, 0.53, 0.34), c, smoothstep(0.0, 0.06, wT));
    c *= 0.92 + 0.08 * cos(s * 20.0);
    vec4 tn = texture2D(uTexC, vec2(s * 0.08 + seed * 5.3, wT * 0.9 + seed * 2.1));
    float tipStart = mix(0.97, 0.6, age) - seed * 0.12 + (tn.b - 0.5) * 0.08;
    float tip = smoothstep(tipStart, tipStart + 0.05, wT);
    vec3 brown = mix(vec3(0.38, 0.24, 0.08), vec3(0.74, 0.66, 0.46), smoothstep(tipStart + 0.08, tipStart + 0.3, wT));
    c = mix(c, brown, tip);
    vec2 eu = vec2(s * 0.075 + seed * 3.7, wT * vLen * 10.0 + seed * 1.3);
    vec4 ep = texture2D(uTexA, eu);
    vec4 epId = texture2D(uTexC, eu);
    float spk = (1.0 - smoothstep(0.12, 0.24, ep.a)) * step(0.45, epId.r) * smoothstep(0.3, 0.85, wT) * age;
    c = mix(c, mix(vec3(0.72, 0.55, 0.58), vec3(0.8, 0.78, 0.72), epId.r), spk * 0.9);
    wTrans = 1.0 - tip * 0.6;
  }
  #ifdef USE_COLOR
    c *= vColor.rgb;
  #endif
  c *= mix(0.5, 1.0, smoothstep(0.0, 0.55, wT));
  diffuseColor.rgb = c;
}
`;

function seagrassOK(x, z, grid, blockers, asm = true) {
  if (inClearings(x, z, 1.0) || (asm && nearAssembly(x, z, 9.0))) return false;
  if (grid.height(x, z) < -34) return false;
  if (grid.sand(x, z) < 0.8) return false;
  for (const b of blockers) {
    const dx = x - b.x, dz = z - b.z;
    if (dx * dx + dz * dz < b.r2) return false;
  }
  return true;
}

function buildPosidonia(rng, q, grid, blockers, extra = []) {
  const R = varyRng(6061);
  const items = [];
  const target = Math.floor(24000 * q), nEdge = Math.floor(target * 0.08);
  const c = new THREE.Color();
  const wsum = MEADOWS.reduce((s, m) => s + m.rx * m.rz, 0);
  const pickM = () => {
    let u = R() * wsum;
    for (const m of MEADOWS) { u -= m.rx * m.rz; if (u <= 0) return m; }
    return MEADOWS[0];
  };
  const push = (x, z, asm = true) => {
    if (!seagrassOK(x, z, grid, blockers, asm)) return;
    const pt = clamp$9(0.5 + 1.4 * fbm2(x * 0.05 + 3.7, z * 0.05 - 1.2, 2), 0, 1);
    c.setRGB((0.84 + R() * 0.22) * (1.1 - 0.24 * pt), (0.86 + R() * 0.22) * (0.9 + 0.2 * pt), (0.8 + R() * 0.26) * (1.04 - 0.14 * pt));
    items.push({
      p: new THREE.Vector3(x, grid.height(x, z) - 0.02, z),
      q: new THREE.Quaternion().setFromAxisAngle(Y$1, R() * Math.PI * 2),
      s: sv(0.8 + R() * 0.45), c: c.clone(),
    });
  };
  let tries = 0;
  while (items.length < target - nEdge && tries < target * 8) {
    tries++;
    const m = pickM();
    const x = m.x + (R() * 2 - 1) * m.rx * 1.15, z = m.z + (R() * 2 - 1) * m.rz * 1.15;
    const cov = grid.cover(x, z);
    if (cov < 0.3 || R() > cov) continue;
    const run = 3 + Math.floor(R() * 5), ang = R() * Math.PI * 2, step = 0.07 + R() * 0.05;
    for (let k = 0; k < run && items.length < target - nEdge; k++) {
      const xx = x + Math.cos(ang) * step * k + (R() - 0.5) * 0.05, zz = z + Math.sin(ang) * step * k + (R() - 0.5) * 0.05;
      if (k && grid.cover(xx, zz) < 0.25) break;
      push(xx, zz);
    }
  }
  tries = 0;
  while (items.length < target && tries < nEdge * 60) {
    tries++;
    const m = pickM();
    const x = m.x + (R() * 2 - 1) * m.rx * 1.45, z = m.z + (R() * 2 - 1) * m.rz * 1.45;
    const fr = grid.fringe(x, z);
    if (fr < 0.08 || R() > fr * 0.6) continue;
    const n = 4 + Math.floor(R() * 10), rad = 0.18 + R() * 0.4;
    for (let k = 0; k < n && items.length < target; k++) {
      const a = R() * Math.PI * 2, r = rad * Math.sqrt(R());
      push(x + Math.cos(a) * r, z + Math.sin(a) * r);
    }
  }
  for (let k = 0, got = 0; k < 500 && got < Math.floor(24 * q); k++) {
    const a = R() * Math.PI * 2, r = 7 + R() * 6, x = LAYOUT.assembly.x + Math.cos(a) * r, z = LAYOUT.assembly.z + Math.sin(a) * r;
    if (R() > asmKeep(x, z) * 0.8) continue;
    const n = 3 + Math.floor(R() * 6), rad = 0.12 + R() * 0.22;
    for (let m = 0; m < n; m++) {
      const b = R() * Math.PI * 2, rr = rad * Math.sqrt(R());
      push(x + Math.cos(b) * rr, z + Math.sin(b) * rr, false);
    }
    got++;
  }
  const mat = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.55, metalness: 0, envMapIntensity: 0.35 });
  worldMaterial(mat, 'posidonia', {
    vDecl: POSI_VDECL,
    vNormal: POSI_VNORMAL,
    vBegin: 'transformed = wLeaf;',
    fDecl: POSI_FDECL,
    fColor: POSI_FCOLOR,
    fEmissive: 'totalEmissiveRadiance += diffuseColor.rgb * (0.05 * uLight * wGlowK());',
    fLights: TRANSLUCENT('wTrans'),
    fAO: 'reflectedLight.indirectDiffuse *= mix(0.4, 1.0, smoothstep(0.0, 0.6, wT));',
  });
  return makeInstanced(posidoniaShoot(), mat, items.concat(extra), { cast: false, receive: true });
}

function fanPlan(seed, H, o = {}) {
  const rng = makeRng$1(seed);
  const Wd = H * (o.width || 0.5), yp = o.peak || 0.66, ds = (o.step || 0.034) * H;
  const ph0 = rng() * 6.28, ph1 = rng() * 6.28;
  const half = (y) => {
    const t = y / H;
    if (t <= 0.02) return 0;
    const e = t < yp ? Math.pow(Math.sin((t / yp) * Math.PI * 0.5), 0.55) : Math.sqrt(Math.max(0, 1 - ((t - yp) / (1 - yp)) ** 2));
    return Wd * e * (1 + 0.12 * Math.sin(t * 8.5 + ph0) + 0.07 * Math.sin(t * 19 + ph1));
  };
  const gaps = [];
  for (let k = 0, ng = 1 + Math.floor(rng() * 2); k < ng; k++) gaps.push([(rng() - 0.5) * Wd, H * (0.45 + rng() * 0.4), H * (0.05 + rng() * 0.05)]);
  const A = [];
  for (let t = 0; A.length < (o.points || 320) && t < 20000; t++) {
    const x = (rng() * 2 - 1) * Wd * 1.2, y = H * (0.1 + rng() * 0.9);
    if (Math.abs(x) > half(y) || rng() > 0.35 + 0.65 * (y / H)) continue;
    if (gaps.some((g) => Math.hypot(x - g[0], y - g[1]) < g[2])) continue;
    A.push([x, y]);
  }
  const sh = H * (0.05 + rng() * 0.03);
  const N = [{ x: 0, y: 0, p: -1, k: [] }, { x: (rng() - 0.5) * 0.01 * H, y: sh, p: 0, k: [] }];
  N[0].k.push(1);
  const reach = (o.reach || 0.22) * H, kill = ds * (o.kill || 1.0), up = o.up || 0.28;
  const grid = new Map(), cellK = (x, y) => (Math.floor(x / reach) + 1024) * 4096 + Math.floor(y / reach) + 1024;
  const file = (i) => { const k = cellK(N[i].x, N[i].y); let c = grid.get(k); if (!c) grid.set(k, (c = [])); c.push(i); };
  file(1);
  for (let it = 0; it < 400 && A.length && N.length < (o.maxNodes || 320); it++) {
    const acc = new Map();
    for (const [ax, ay] of A) {
      let bi = -1, bd = reach * reach;
      const gx = Math.floor(ax / reach) + 1024, gy = Math.floor(ay / reach) + 1024;
      for (let cx = gx - 1; cx <= gx + 1; cx++) for (let cy = gy - 1; cy <= gy + 1; cy++) {
        const c = grid.get(cx * 4096 + cy);
        if (c) for (const i of c) { const dx = ax - N[i].x, dy = ay - N[i].y, d = dx * dx + dy * dy; if (d < bd || (d === bd && i < bi)) { bd = d; bi = i; } }
      }
      if (bi < 0) continue;
      const d = Math.sqrt(bd) || 1, v = acc.get(bi) || [0, 0];
      v[0] += (ax - N[bi].x) / d; v[1] += (ay - N[bi].y) / d;
      acc.set(bi, v);
    }
    if (!acc.size) break;
    for (const [i, v] of acc) {
      const n = N[i];
      let dx = v[0], dy = v[1];
      const l = Math.hypot(dx, dy) || 1;
      dx = dx / l + (rng() - 0.5) * 0.25; dy = dy / l + up;
      const l2 = Math.hypot(dx, dy) || 1;
      const m = { x: n.x + (dx / l2) * ds, y: n.y + (dy / l2) * ds, p: i, k: [] };
      if (m.y < n.y - ds * 0.3) continue;
      n.k.push(N.length);
      N.push(m);
      file(N.length - 1);
    }
    const start = Math.max(1, N.length - acc.size - 1);
    let w = 0;
    for (let j = 0; j < A.length; j++) {
      const [ax, ay] = A[j], gx = Math.floor(ax / reach) + 1024, gy = Math.floor(ay / reach) + 1024;
      let hit = false;
      for (let cx = gx - 1; cx <= gx + 1 && !hit; cx++) for (let cy = gy - 1; cy <= gy + 1 && !hit; cy++) {
        const c = grid.get(cx * 4096 + cy);
        if (c) for (let q = c.length - 1; q >= 0 && c[q] >= start; q--) if (Math.hypot(ax - N[c[q]].x, ay - N[c[q]].y) < kill) { hit = true; break; }
      }
      if (!hit) A[w++] = A[j];
    }
    A.length = w;
  }
  const tipsTop = N.map((n, i) => [n, i]).filter(([n]) => !n.k.length && n.y > H * 0.7).sort(() => rng() - 0.5);
  for (let q = 0; q < Math.min(o.lead ?? 1, tipsTop.length); q++) {
    let i = tipsTop[q][1];
    const steps = 2 + Math.floor(rng() * 3);
    for (let s = 0; s < steps; s++) {
      const n = N[i], pn = N[n.p], dx = n.x - pn.x, dy = n.y - pn.y, l = Math.hypot(dx, dy) || 1;
      const m = { x: n.x + (dx / l) * ds + (rng() - 0.5) * ds * 0.3, y: n.y + (dy / l) * ds, p: i, k: [] };
      n.k.push(N.length); N.push(m); i = N.length - 1;
    }
  }
  if (o.twig) {
    const cl = o.twig, occ = new Map(), ck = (x, y) => (Math.floor(x / cl) + 1024) * 4096 + Math.floor(y / cl) + 1024;
    const mark = (x, y, i) => { const k = ck(x, y); let c = occ.get(k); if (!c) occ.set(k, (c = [])); c.push(x, y, i); };
    const free = (x, y, own) => {
      const gx = Math.floor(x / cl) + 1024, gy = Math.floor(y / cl) + 1024;
      for (let cx = gx - 1; cx <= gx + 1; cx++) for (let cy = gy - 1; cy <= gy + 1; cy++) {
        const c = occ.get(cx * 4096 + cy);
        if (c) for (let q = 0; q < c.length; q += 3) if (!own.includes(c[q + 2]) && Math.hypot(x - c[q], y - c[q + 1]) < cl) return false;
      }
      return true;
    };
    for (let i = 1; i < N.length; i++) { const n = N[i], p = N[n.p]; for (let t = 0.25; t <= 1.001; t += 0.25) mark(p.x + (n.x - p.x) * t, p.y + (n.y - p.y) * t, n.p === 0 ? -1 : i); }
    const n0 = N.length, tl = ds * 0.75;
    for (let i = 2; i < n0; i++) {
      const n = N[i], pn = N[n.p];
      if (n.y < H * 0.33 || rng() > (o.twigP || 0.8)) continue;
      const bx = n.x - pn.x, by = n.y - pn.y, bl = Math.hypot(bx, by) || 1, a = ((i + (rng() < 0.3 ? 1 : 0)) & 1 ? 1 : -1) * (0.55 + rng() * 0.5);
      let ux = (bx * Math.cos(a) - by * Math.sin(a)) / bl, uy = (bx * Math.sin(a) + by * Math.cos(a)) / bl + 0.2;
      const ul = Math.hypot(ux, uy) || 1;
      ux /= ul; uy /= ul;
      const steps = 3 + Math.floor(rng() * 2), pts = [], own = [i, ...n.k];
      let x = n.x, y = n.y;
      for (let s = 0; s < steps; s++) {
        x += ux * tl + (rng() - 0.5) * tl * 0.25; y += uy * tl;
        if (Math.abs(x) > half(y) * 1.04 || y > H * 1.02 || !free(x, y, own)) break;
        pts.push([x, y]);
      }
      if (pts.length < 3) continue;
      let pi = i;
      for (const [px, py] of pts) { N[pi].k.push(N.length); N.push({ x: px, y: py, p: pi, k: [] }); pi = N.length - 1; mark(px, py, pi); mark((px + N[N[pi].p].x) / 2, (py + N[N[pi].p].y) / 2, pi); }
    }
  }
  const w = new Float32Array(N.length), wt = o.wmin || 0.0021;
  for (let i = N.length - 1; i >= 0; i--) {
    const n = N[i];
    if (!n.k.length) w[i] = wt;
    else { let s2 = 0; for (const c of n.k) s2 += Math.pow(w[c], 2.3); w[i] = Math.pow(s2, 1 / 2.3); }
  }
  const wk = (o.w0 || 0.0095) / Math.max(w[0], 1e-6);
  const out = [], sAt = new Float32Array(N.length);
  const run = (i0, d) => {
    const br = { pts: [], d };
    let i = i0;
    for (;;) {
      const n = N[i];
      if (n.p >= 0) sAt[i] = sAt[n.p] + Math.hypot(n.x - N[n.p].x, n.y - N[n.p].y);
      br.pts.push([n.x, n.y, sAt[i], Math.max(wt, w[i] * wk)]);
      if (!n.k.length) break;
      const ks = n.k.slice().sort((a2, b2) => w[b2] - w[a2]);
      for (let q = 1; q < ks.length; q++) {
        const c = N[ks[q]];
        sAt[ks[q]] = sAt[i] + Math.hypot(c.x - n.x, c.y - n.y);
        const sub = run(ks[q], d + 1);
        sub.pts.unshift([n.x, n.y, sAt[i], Math.max(wt, w[ks[q]] * wk)]);
      }
      i = ks[0];
    }
    out.push(br);
    return br;
  };
  run(0, 0);
  for (const br of out) {
    const p = br.pts;
    for (let it = 0; it < 2; it++) for (let i = 1; i < p.length - 1; i++) { p[i][0] = (p[i - 1][0] + 2 * p[i][0] + p[i + 1][0]) / 4; p[i][1] = (p[i - 1][1] + 2 * p[i][1] + p[i + 1][1]) / 4; }
  }
  return out.filter((br) => br.pts.length > (br.d >= 2 ? 3 : br.d ? 2 : 1)).sort((a2, b2) => a2.d - b2.d);
}
function fanGeometry(plan, H, o = {}) {
  const far = !!o.far;
  let sMax = 1e-6;
  for (const br of plan) sMax = Math.max(sMax, br.pts[br.pts.length - 1][2]);
  const wave = (x, y) => 0.035 * H * Math.sin((x / H) * 6.0 + (y / H) * 2.5) * Math.min(1, y / (0.35 * H)) + 0.05 * H * (x / H) * (x / H);
  const b = builder([['position', 3], ['normal', 3], ['aT', 1], ['aH', 1], ['aW', 1], ['aFz', 1], ['aFa', 3], ['aFo', 2]]);
  const FZ = 0.0035 * (o.fringe || 1);
  const tAt = (y, s) => clamp$9(0.55 * (y / H) + 0.45 * (s / sMax), 0, 1);
  {
    const w0 = plan[0].pts[0][3], R0 = w0 * 2.8, R1 = w0 * 1.1, n = 10, lo = [], hi = [];
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a), rj = 1 + 0.25 * Math.sin(a * 3 + 1.3);
      lo.push(b.v(ca * R0 * rj, -0.02, sa * R0 * rj * 0.8, ca * 0.5, 0.86, sa * 0.5, 0, 0, w0, 0, 0, 0, 0, 0, 0));
      hi.push(b.v(ca * R1, 0.012, sa * R1, ca * 0.8, 0.6, sa * 0.8, 0, 0, w0, 0, 0, 0, 0, 0, 0));
    }
    for (let k = 0; k < n; k++) { const k1 = (k + 1) % n; b.t(lo[k], hi[k], lo[k1]); b.t(lo[k1], hi[k], hi[k1]); }
  }
  for (const br of plan) {
    let pts = br.pts;
    if (far) {
      if (br.d >= 3 && pts.length < 4) continue;
      pts = pts.filter((_, i) => i === 0 || i === pts.length - 1 || i % (o.lite ? 3 : 2) === 0);
    }
    const n = pts.length, sides = far ? (br.d === 0 ? 4 : 3) : pts[0][3] > 0.0048 ? 6 : pts[0][3] > 0.003 ? 4 : 3;
    let prev = null, prevF = null;
    for (let i = 0; i < n; i++) {
      const [x, y, s, w] = pts[i];
      const j0 = Math.max(0, i - 1), j1 = Math.min(n - 1, i + 1);
      const tx = pts[j1][0] - pts[j0][0], ty = pts[j1][1] - pts[j0][1], tl = Math.hypot(tx, ty) || 1, px = -ty / tl, py = tx / tl;
      const z0 = wave(x, y), tt = tAt(y, s), ring = [];
      for (let k = 0; k < sides; k++) {
        const a = (k / sides) * Math.PI * 2 + (sides === 4 ? Math.PI / 4 : 0), ca = Math.cos(a), sa = Math.sin(a);
        ring.push(b.v(x + px * ca * w, y + py * ca * w, z0 + sa * w, px * ca, py * ca, sa, tt, y / H, w, 0, s, 0, 0, 0, 0));
      }
      if (prev) for (let k = 0; k < sides; k++) { const k1 = (k + 1) % sides; b.t(prev[k], ring[k], prev[k1]); b.t(prev[k1], ring[k], ring[k1]); }
      prev = ring;
      if (!far && (br.d > 0 || i > 0)) {
        const e = w + FZ;
        const tp = i === n - 1 ? 0.2 : i === n - 2 ? 0.65 : 1;
        const Lv = b.v(x + px * e, y + py * e, z0, px * 0.6, py * 0.6, 0.8, tt, y / H, w, 1, s, 1, tp, px * e, py * e);
        const Rv = b.v(x - px * e, y - py * e, z0, -px * 0.6, -py * 0.6, 0.8, tt, y / H, w, 1, s, -1, tp, -px * e, -py * e);
        if (prevF) { b.t(prevF[0], prevF[1], Lv); b.t(Lv, prevF[1], Rv); }
        prevF = [Lv, Rv];
      }
    }
    const [x1, y1, s1, w1] = pts[n - 1], [xp, yp] = pts[n - 2], ul = Math.hypot(x1 - xp, y1 - yp) || 1, ux = (x1 - xp) / ul, uy = (y1 - yp) / ul;
    const tv = b.v(x1 + ux * w1 * 1.3, y1 + uy * w1 * 1.3, wave(x1, y1), ux, uy, 0, 1, y1 / H, w1 * 0.6, 0, s1 + w1, 0, 0, 0, 0);
    for (let k = 0; k < sides; k++) b.t(prev[k], tv, prev[(k + 1) % sides]);
  }
  return b.build();
}
const FAN_FCOLOR = `
float wFanD = length(vWPos - cameraPosition);
{
  diffuseColor.rgb = mix(vC0, vC1.rgb, smoothstep(vC1.w, vC1.w > 0.0 ? min(1.0, vC1.w + 0.5) : 1.0, vT)) * mix(0.8, 1.0, smoothstep(0.0, 0.12, vT));
  float foot = max(length(dFdx(vWPos)), length(dFdy(vWPos)));
  float dC = length(vWPos - cameraPosition);
  if (vFz > 0.5) {
    float core = vFa.z, ac = abs(vFa.y), sg = vFa.y > 0.0 ? 0.5 : 0.0, S = 0.0034;
    float ph0 = vFa.x / S + sg + 0.45 * sin(vFa.x * 157.0 + sg * 3.1) + 0.25 * sin(vFa.x * 421.0 + 1.7);
    float ow = (ac - core) / max(1.0 - core, 1e-3);
    float knob = 0.0;
    for (int kk = -1; kk <= 1; kk++) {
      float cell = floor(ph0) + float(kk);
      float hsh = fract(sin(cell * 91.7 + sg * 34.6) * 43758.5453), hs2 = fract(sin(cell * 17.3 + sg * 71.1) * 24634.6345), hs3 = fract(hsh * 7.13 + hs2 * 3.7);
      if (hs3 < 0.16) continue;
      float cp = core + (1.0 - core) * (0.2 + 0.36 * hsh);
      float lean = (hs2 - 0.5) * 0.9;
      float du = (ph0 - cell - 0.5 - lean * clamp((ac - core) / max(cp - core, 1e-3), 0.0, 1.0)) * S, dv = (ac - cp) * vFe;
      float rc = S * (0.5 + 0.35 * hs3);
      float crown = 1.0 - smoothstep(rc * 0.75, rc, length(vec2(du, dv)));
      float stalk = (1.0 - smoothstep(S * 0.08, S * 0.16, abs(du))) * step(ac, cp);
      knob = max(knob, max(crown, stalk));
    }
    float res = (1.0 - smoothstep(0.0006, 0.0016, foot)) * (1.0 - smoothstep(0.6, 1.5, dC));
    float fur = mix(0.9, 0.7, smoothstep(2.5, 6.0, dC)) * (1.0 - smoothstep(0.15, 1.0, ow));
    float a = mix(fur, knob * 0.95, res);
    a *= step(core * 0.97, ac) * (1.0 - smoothstep(5.0, 6.5, dC));
    diffuseColor.rgb *= 1.0 + 0.06 * smoothstep(0.3, 1.0, ow);
    diffuseColor.a = smoothstep(0.38, 0.52, a * (1.0 - 0.35 * smoothstep(0.3, 1.0, (ac - core) / max(1.0 - core, 1e-3))));
  } else {
    vec4 pc = texture2D(uTexA, vec2(vFa.x * 55.0, vObjPos.z * 40.0 + vObjPos.x * 13.0));
    float pol = (1.0 - smoothstep(0.12, 0.24, pc.a)) * (1.0 - smoothstep(0.002, 0.006, foot));
    diffuseColor.rgb = mix(diffuseColor.rgb * 0.96, diffuseColor.rgb * 1.12 + vec3(0.02, 0.005, 0.01), pol * 0.5);
  }
  {
    float wFar = smoothstep(6.5, 13.0, dC);
    float wLu = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
    vec3 wStoneA = vec3(0.25, 0.28, 0.27);
    diffuseColor.rgb = mix(diffuseColor.rgb, mix(wStoneA, vec3(clamp(wLu, 0.21, 0.3)), 0.25), wFar * 0.9);
  }
}
`;
const FAN_FAR_NORMAL = '{ float wFarN = smoothstep(6.0, 12.0, wFanD); vec3 wUpV = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz); normal = normalize(mix(normal, wUpV, 0.65 * wFarN)); }\n';
const FAN_FLUO = 'vec3 wFluo = diffuseColor.rgb * vec3(1.0, 0.3, 0.45) * 0.06;\nfloat wPig = 1.0;\n';
const FAN_SPEC = 'reflectedLight.directSpecular *= 1.0 - smoothstep(3.0, 8.0, wFanD);\nreflectedLight.indirectSpecular *= 1.0 - smoothstep(3.0, 8.0, wFanD);\n';
const FAN_WIDEN = `
{
  float wS = 1.0;
  #ifdef USE_INSTANCING
    wS = max(length(instanceMatrix[0].xyz), 1e-3);
  #endif
  vFa = aFa;
  vFe = 0.0;
  if (aFz > 0.5) {
    float e = length(aFo), e1 = mix(aW + 0.012 * aFa.z / wS, 0.0, smoothstep(5.0, 6.5, wDc));
    transformed.xy += aFo * ((e1 - e) / max(e, 1e-6));
    vFa.z = aW / max(e1, 1e-6);
    vFe = e1;
  } else transformed += normal * max(0.0, (wDc * 0.00045 + 0.0005 * smoothstep(4.0, 9.0, wDc) * wDc) / wS - aW);
  vFz = aFz;
  vT = aT;
  vC0 = aC0;
  vC1 = aC1;
}
`;
const FAN_WIDEN_DEPTH = `
{
  float wS = 1.0;
  #ifdef USE_INSTANCING
    wS = max(length(instanceMatrix[0].xyz), 1e-3);
  #endif
  if (aFz > 0.5) transformed.xy -= aFo;
  else transformed += normal * max(0.0, (wDc * 0.00045 + 0.0005 * smoothstep(4.0, 9.0, wDc) * wDc) / wS - aW);
}
`;

function tubeInto(b, pts, rads, sides, H, t0 = 0, t1 = 1) {
  const u = new THREE.Vector3(), w = new THREE.Vector3(), tg = new THREE.Vector3(), n = pts.length;
  let prev = null;
  for (let s = 0; s < n; s++) {
    if (s < n - 1) tg.subVectors(pts[s + 1], pts[s]); else tg.subVectors(pts[s], pts[s - 1]);
    tg.normalize();
    if (s === 0) u.crossVectors(tg, Math.abs(tg.y) < 0.9 ? Y$1 : X).normalize();
    else u.addScaledVector(tg, -u.dot(tg)).normalize();
    w.crossVectors(tg, u);
    const p = pts[s], r = rads[s], t = lerp$4(t0, t1, s / (n - 1)), ring = [];
    for (let k = 0; k < sides; k++) {
      const a = (k / sides) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
      const nx = u.x * ca + w.x * sa, ny = u.y * ca + w.y * sa, nz = u.z * ca + w.z * sa;
      ring.push(b.v(p.x + nx * r, p.y + ny * r, p.z + nz * r, nx, ny, nz, p.y / H, t));
    }
    if (prev) for (let k = 0; k < sides; k++) { const k1 = (k + 1) % sides; b.t(prev[k], prev[k1], ring[k]); b.t(prev[k1], ring[k1], ring[k]); }
    prev = ring;
  }
  const e = pts[n - 1], r = rads[n - 1];
  const c = b.v(e.x + tg.x * r * 0.7, e.y + tg.y * r * 0.7, e.z + tg.z * r * 0.7, tg.x, tg.y, tg.z, (e.y + tg.y * r * 0.7) / H, t1);
  for (let k = 0; k < sides; k++) b.t(prev[k], prev[(k + 1) % sides], c);
}
function wander(rng, p0, dir, len, nSeg, jit, rise) {
  const pts = [p0.clone()], d = dir.clone(), cur = p0.clone();
  for (let s = 1; s <= nSeg; s++) {
    d.x += (rng() - 0.5) * jit; d.z += (rng() - 0.5) * jit; d.y += rise; d.normalize();
    pts.push(cur.addScaledVector(d, len / nSeg).clone());
  }
  return pts;
}

function candelabraGeometry(seed) {
  const rng = makeRng$1(seed);
  const b = builder([['position', 3], ['normal', 3], ['aH', 1], ['aT', 1]]);
  const H = 0.45;
  const stem = [new THREE.Vector3(0, -0.01, 0), new THREE.Vector3(0.004, 0.025, 0.002), new THREE.Vector3(0, 0.05, 0)];
  tubeInto(b, stem, [0.007, 0.006, 0.005], 5, H, 0, 0.1);
  const nArm = 2 + Math.floor(rng() * 2);
  for (let a = 0; a < nArm; a++) {
    const side = nArm === 2 ? (a ? 1 : -1) : a - 1;
    const arm = wander(rng, stem[2], new THREE.Vector3(side * 0.9 + (rng() - 0.5) * 0.3, 0.45, (rng() - 0.5) * 0.25), 0.05 + rng() * 0.04, 3, 0.2, 0.35);
    tubeInto(b, arm, [0.005, 0.0046, 0.0042, 0.004], 4, H, 0.1, 0.2);
    const nW = 2 + Math.floor(rng() * 2);
    for (let k = 0; k < nW; k++) {
      const base = arm[Math.min(arm.length - 1, 1 + k)];
      const len = H * (0.55 + rng() * 0.4) - base.y;
      const wh = wander(rng, base, new THREE.Vector3(side * 0.12 + (rng() - 0.5) * 0.12, 1, (rng() - 0.5) * 0.08), len, 5, 0.05, 0.05);
      tubeInto(b, wh, wh.map((_, s) => 0.004 * (1 - 0.35 * (s / 5))), 4, H, 0.2, 1);
    }
  }
  return b.build();
}
const SING_FCOLOR = `
{
  vec4 pn = texture2D(uTexC, vec2(vObjPos.y * 5.0 + vObjPos.x * 3.0, vObjPos.z * 5.0 + vTs * 1.5));
  vec3 axis = mix(vec3(0.8, 0.78, 0.7), vec3(0.86, 0.84, 0.77), vTs);
  float pol = (0.24 + 0.12 * (pn.b - 0.5)) * (1.0 - 0.45 * vTs);
  vec3 c = mix(axis, vec3(0.5, 0.46, 0.3), pol);
  #ifdef USE_COLOR
    c *= vColor.rgb;
  #endif
  diffuseColor.rgb = c;
}
`;

function axinellaGeometry(seed) {
  const rng = makeRng$1(seed);
  const b = builder([['position', 3], ['normal', 3], ['aH', 1], ['aT', 1]]);
  const H = 0.25;
  const grow = (p0, dir, len, r, depth) => {
    const pts = wander(rng, p0, dir, len, depth ? 3 : 4, 0.25, 0.18);
    tubeInto(b, pts, pts.map((_, s) => r * (1 - 0.18 * (s / (pts.length - 1)))), 6, H, depth * 0.3, depth * 0.3 + 0.4);
    if (depth >= 2) return;
    const nf = depth === 0 ? 2 + Math.floor(rng() * 2) : (rng() < 0.6 ? 2 : 0);
    for (let k = 0; k < nf; k++) {
      const at = pts[pts.length - 1 - Math.floor(rng() * 2)];
      const a = rng() * Math.PI * 2;
      grow(at, new THREE.Vector3(Math.cos(a) * 0.5, 1, Math.sin(a) * 0.5), len * (0.55 + rng() * 0.25), r * 0.85, depth + 1);
    }
  };
  grow(new THREE.Vector3(0, -0.01, 0), new THREE.Vector3((rng() - 0.5) * 0.2, 1, (rng() - 0.5) * 0.2), H * 0.45, 0.008, 0);
  return b.build();
}
const AXI_FCOLOR = `
float wAxH = 0.0;
{
  vec4 hp = texture2D(uTexA, vec2(vObjPos.y * 40.0 + vObjPos.x * 7.0, atan(vObjPos.z, vObjPos.x) * 1.3));
  float fw = length(fwidth(vWPos));
  float tuft = (1.0 - smoothstep(0.12, 0.3, hp.a)) * (1.0 - smoothstep(0.003, 0.009, fw));
  vec3 c = vec3(0.86 + 0.14 * smoothstep(0.5, 1.0, vTa)) * (1.0 - 0.18 * tuft);
  #ifdef USE_COLOR
    c *= vColor.rgb;
  #endif
  c = mix(c, vec3(0.5, 0.46, 0.38), smoothstep(0.6, 0.95, vWNrm.y) * 0.3);
  diffuseColor.rgb = c;
  wAxH = tuft * 0.0006;
}
`;

function myriaporaGeometry(seed) {
  const rng = makeRng$1(seed);
  const b = builder([['position', 3], ['normal', 3], ['aH', 1], ['aT', 1]]);
  const H = 0.09;
  const grow = (p0, dir, len, depth) => {
    const pts = wander(rng, p0, dir, len, 2, 0.3, 0.1);
    tubeInto(b, pts, [0.0042, 0.004, 0.0038], 5, H, depth / 3, (depth + 1) / 3);
    if (depth >= 2) return;
    for (let k = 0; k < 2; k++) {
      const a = rng() * Math.PI * 2, e = pts[2];
      grow(e, new THREE.Vector3(dir.x + Math.cos(a) * 0.6, 1, dir.z + Math.sin(a) * 0.6), len * (0.8 + rng() * 0.2), depth + 1);
    }
  };
  grow(new THREE.Vector3(0, -5e-3, 0), new THREE.Vector3(0, 1, 0), H * 0.36, 0);
  return b.build();
}
const MYR_FCOLOR = `
{
  float fw = length(fwidth(vWPos));
  vec4 pc = texture2D(uTexA, vec2(vObjPos.y * 90.0, atan(vObjPos.z, vObjPos.x) * 2.0 + vObjPos.x * 30.0));
  float pore = (1.0 - smoothstep(0.08, 0.2, pc.a)) * (1.0 - smoothstep(0.002, 0.006, fw));
  vec3 c = vec3((1.0 - 0.3 * pore) * (0.9 + 0.1 * smoothstep(0.6, 1.0, vTm)));
  #ifdef USE_COLOR
    c *= vColor.rgb;
  #endif
  diffuseColor.rgb = c;
}
`;

function anemoneGeometry(seed) {
  const rng = makeRng$1(seed);
  const b = builder([['position', 3], ['normal', 3], ['color', 3], ['aH', 1]]);
  const N = 56, SEG = 5;
  for (let k = 0; k < N; k++) {
    const a = rng() * Math.PI * 2, rr = Math.sqrt(rng()) * 0.035;
    const bx = Math.cos(a) * rr, bz = Math.sin(a) * rr;
    const out = 0.35 + rng() * 0.5, len = 0.1 + rng() * 0.08;
    const dx = Math.cos(a), dz = Math.sin(a);
    const rings = [];
    for (let s = 0; s <= SEG; s++) {
      const t = s / SEG;
      const cx = bx + dx * out * len * t, cz = bz + dz * out * len * t, cy = len * (t - 0.35 * t * t);
      const w = 0.0045 * (1 - 0.6 * t);
      const tipT = smoothstep(0.72, 1, t);
      const c = [lerp$4(0.3, 0.5, tipT), lerp$4(0.44, 0.3, tipT), lerp$4(0.22, 0.46, tipT)];
      const ring = [];
      for (let j = 0; j < 4; j++) {
        const th = (j / 4) * Math.PI * 2;
        const ox = Math.cos(th) * -dz, oz = Math.cos(th) * dx, oy = Math.sin(th);
        ring.push(b.v(cx + ox * w, cy + oy * w, cz + oz * w, ox, oy, oz, c[0], c[1], c[2], t));
      }
      rings.push(ring);
    }
    for (let s = 0; s < SEG; s++) {
      for (let j = 0; j < 4; j++) {
        const j1 = (j + 1) % 4;
        b.t(rings[s][j], rings[s + 1][j], rings[s][j1]);
        b.t(rings[s][j1], rings[s + 1][j], rings[s + 1][j1]);
      }
    }
  }
  const ci = b.v(0, 0.006, 0, 0, 1, 0, 0.3, 0.42, 0.24, 0);
  const rim = [];
  for (let j = 0; j < 12; j++) {
    const a = (j / 12) * Math.PI * 2;
    rim.push(b.v(Math.cos(a) * 0.036, 0.004, Math.sin(a) * 0.036, 0, 1, 0, 0.26, 0.4, 0.22, 0));
  }
  for (let j = 0; j < 12; j++) b.t(ci, rim[(j + 1) % 12], rim[j]);
  return b.build();
}

function spongeGeometry(seed) {
  const rng = makeRng$1(seed);
  const b = builder([['position', 3], ['aIn', 1]]);
  const n = 3 + Math.floor(rng() * 3);
  const S = 14;
  for (let i = 0; i < n; i++) {
    const r = 0.022 + rng() * 0.016, h = 0.07 + rng() * 0.12;
    const a = rng() * Math.PI * 2, d = i === 0 ? 0 : 0.03 + rng() * 0.035;
    const ox = Math.cos(a) * d, oz = Math.sin(a) * d, tilt = i === 0 ? (rng() - 0.5) * 0.25 : 0.2 + rng() * 0.25, td = i === 0 ? rng() * Math.PI * 2 : a;
    const p1 = rng() * 6.28, p2 = rng() * 6.28;
    const place = (x, y, z, flag) => {
      const f = 0.35 + 0.65 * Math.min(1, Math.max(0, y) / 0.035);
      return b.v(ox * f + x + Math.cos(td) * tilt * y, y - 0.008, oz * f + z + Math.sin(td) * tilt * y, flag);
    };
    const rimY = (aa) => h * (1 + 0.07 * Math.sin(2 * aa + p1) + 0.04 * Math.sin(5 * aa + p2));
    const outer = [], inner = [];
    for (let s = 0; s <= 6; s++) {
      const t = s / 6;
      const bulge = 1.35 - 0.4 * smoothstep(0, 0.35, t) + 0.08 * Math.sin(t * Math.PI) - 0.12 * t;
      const ring = [];
      for (let k = 0; k <= S; k++) {
        const aa = (k / S) * Math.PI * 2, lump = 1 + 0.07 * Math.sin(3 * aa + p1 + t * 4) + 0.05 * Math.sin(5 * aa + p2 - t * 3);
        ring.push(place(Math.cos(aa) * r * bulge * lump, t * rimY(aa), Math.sin(aa) * r * bulge * lump, 0));
      }
      outer.push(ring);
    }
    for (let s = 0; s <= 2; s++) {
      const f = 0.55 + 0.45 * (s / 2);
      const ring = [];
      for (let k = 0; k <= S; k++) { const aa = (k / S) * Math.PI * 2; ring.push(place(Math.cos(aa) * r * 0.55, f * rimY(aa) - (s < 2 ? 0.004 : 0), Math.sin(aa) * r * 0.55, 1)); }
      inner.push(ring);
    }
    for (let s = 0; s < 6; s++) for (let k = 0; k < S; k++) b.q(outer[s][k], outer[s][k + 1], outer[s + 1][k], outer[s + 1][k + 1]);
    for (let s = 0; s < 2; s++) for (let k = 0; k < S; k++) b.q(inner[s][k + 1], inner[s][k], inner[s + 1][k + 1], inner[s + 1][k]);
    for (let k = 0; k < S; k++) b.q(outer[6][k], outer[6][k + 1], inner[2][k], inner[2][k + 1]);
  }
  return b.build(true);
}
const SPONGE_FCOLOR$1 = `
float wSpH = 0.0;
{
  float fw = length(fwidth(vWPos));
  float n = uwNoise3(vObjPos * 150.0);
  vec4 cw = texture2D(uTexA, vObjPos.xz * 9.0 + vObjPos.y * 6.0);
  float near = 1.0 - smoothstep(0.002, 0.007, fw);
  float con = 1.0 - smoothstep(0.1, 0.3, cw.a);
  wSpH = (n * 0.0012 + con * 0.0008) * (1.0 - vIn) * near;
  vec3 c = diffuseColor.rgb * (0.84 + 0.22 * n) * mix(1.0, 0.92 + 0.14 * con, near);
  c = mix(c, c * vec3(0.3, 0.24, 0.16), vIn);
  float silt = smoothstep(0.35, 0.9, vWNrm.y) * (1.0 - vIn) * (0.45 + 0.35 * n);
  c = mix(c, vec3(0.5, 0.46, 0.38), silt * 0.55);
  diffuseColor.rgb = c;
}
`;

function urchinGeometry(seed) {
  const rng = makeRng$1(seed);
  const b = builder([['position', 3], ['aTip', 1]]);
  const LAT = 8, LON = 12;
  const rows = [];
  for (let i = 0; i <= LAT; i++) {
    const th = (i / LAT) * Math.PI;
    const row = [];
    for (let j = 0; j <= LON; j++) {
      const ph = (j / LON) * Math.PI * 2;
      row.push(b.v(Math.sin(th) * Math.cos(ph) * 0.032, -Math.cos(th) * 0.023, Math.sin(th) * Math.sin(ph) * 0.032, 0));
    }
    rows.push(row);
  }
  for (let i = 0; i < LAT; i++) for (let j = 0; j < LON; j++) b.q(rows[i][j], rows[i][j + 1], rows[i + 1][j], rows[i + 1][j + 1]);
  const N = 120;
  const dir = new THREE.Vector3(), u = new THREE.Vector3(), w = new THREE.Vector3();
  for (let i = 0; i < N; i++) {
    const yy = 1 - (i / (N - 1)) * 1.6;
    const rr = Math.sqrt(Math.max(0, 1 - yy * yy));
    const th = i * 2.399963;
    dir.set(Math.cos(th) * rr, Math.max(yy, -0.35), Math.sin(th) * rr).normalize();
    const bx = dir.x * 0.03, by = dir.y * 0.022, bz = dir.z * 0.03;
    const len = (0.032 + rng() * 0.02) * (0.8 + 0.4 * (1 - Math.abs(dir.y)));
    u.crossVectors(dir, Math.abs(dir.y) < 0.9 ? Y$1 : X).normalize();
    w.crossVectors(dir, u);
    const ring = [];
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2, ca = Math.cos(a) * 0.0018, sa = Math.sin(a) * 0.0018;
      ring.push(b.v(bx + u.x * ca + w.x * sa, by + u.y * ca + w.y * sa, bz + u.z * ca + w.z * sa, 0));
    }
    const tip = b.v(bx + dir.x * len, by + dir.y * len, bz + dir.z * len, 1);
    for (let k = 0; k < 3; k++) b.t(ring[k], ring[(k + 1) % 3], tip);
  }
  return b.build(true);
}

function starfishGeometry() {
  const b = builder([['position', 3], ['aArm', 2]]);
  const A = 80, R = 6;
  const rmax = (th) => 0.02 + 0.08 * Math.pow(0.5 + 0.5 * Math.cos(5 * th), 2.2);
  const top = [];
  for (let i = 0; i <= R; i++) {
    const f = i / R;
    const row = [];
    for (let j = 0; j < A; j++) {
      const th = (j / A) * Math.PI * 2;
      const rm = rmax(th), r = f * rm;
      const ridge = Math.pow(0.5 + 0.5 * Math.cos(5 * th), 0.6);
      const y = 0.012 * Math.sqrt(Math.max(0, 1 - f * f)) * (0.55 + 0.45 * ridge) + 0.004;
      row.push(b.v(Math.cos(th) * r, y, Math.sin(th) * r, th, (f * rm) / 0.1));
    }
    top.push(row);
  }
  for (let i = 0; i < R; i++) {
    for (let j = 0; j < A; j++) {
      const j1 = (j + 1) % A;
      b.q(top[i][j], top[i + 1][j], top[i][j1], top[i + 1][j1]);
    }
  }
  const cb = b.v(0, 0.0005, 0, 0, 0);
  for (let j = 0; j < A; j++) b.t(cb, top[R][j], top[R][(j + 1) % A]);
  return b.build(true);
}
const STAR_VBEGIN = `
{
  vec3 wIs = wInstPos();
  if (distance(wIs, uCamPos) > 52.0) { gl_Position = vec4(0.0, 0.0, 2.0, 1.0); return; }
  float ih = wHv(wIs.xz * 5.3);
  float arm = mod(floor(aArm.x / 1.2566371 + 0.5), 5.0);
  float curl = (wHv(vec2(ih * 31.0, arm * 1.7)) - 0.3) * 1.6;
  float rr = aArm.y * 0.1;
  transformed.y += curl * rr * rr * 3.5;
  float bend = (wHv(vec2(arm * 3.1, ih * 17.0)) - 0.5) * 0.9 * rr;
  float cb = cos(bend);
  float sb = sin(bend);
  transformed.xz = mat2(cb, sb, -sb, cb) * transformed.xz;
  transformed *= wFadeAt(distance(wIs, uCamPos), 52.0, wIs);
}
`;
const STAR_FCOLOR = `
float wStH = 0.0;
{
  vec4 tb = texture2D(uTexA, vObjPos.xz * 26.0);
  float tub = 1.0 - smoothstep(0.12, 0.3, tb.a);
  wStH = tub * 0.0012;
  vec3 c = diffuseColor.rgb * (0.85 + 0.25 * tub);
  c = mix(c, c * 1.2 + vec3(0.08, 0.05, 0.02), smoothstep(0.2, 0.6, -vWNrm.y));
  diffuseColor.rgb = c;
}
`;

function polypGeometry() {
  const b = builder([['position', 3], ['aH', 1]]);
  const S = 6;
  const r0 = [], r1 = [];
  for (let k = 0; k <= S; k++) {
    const a = (k / S) * Math.PI * 2;
    r0.push(b.v(Math.cos(a) * 0.0045, 0, Math.sin(a) * 0.0045, 0));
    r1.push(b.v(Math.cos(a) * 0.0036, 0.013, Math.sin(a) * 0.0036, 0.6));
  }
  for (let k = 0; k < S; k++) b.q(r0[k], r0[k + 1], r1[k], r1[k + 1]);
  const ci = b.v(0, 0.0135, 0, 0.7);
  const rim = [];
  for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; rim.push(b.v(Math.cos(a) * 0.0036, 0.013, Math.sin(a) * 0.0036, 0.7)); }
  for (let k = 0; k < 8; k++) b.t(ci, rim[(k + 1) % 8], rim[k]);
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2, da = 0.12;
    const p0 = b.v(Math.cos(a - da) * 0.0034, 0.013, Math.sin(a - da) * 0.0034, 0.75);
    const p1 = b.v(Math.cos(a + da) * 0.0034, 0.013, Math.sin(a + da) * 0.0034, 0.75);
    const tp = b.v(Math.cos(a) * 0.0095, 0.0165, Math.sin(a) * 0.0095, 1);
    b.t(p0, p1, tp);
  }
  return b.build(true);
}

function padinaGeometry(seed) {
  const rng = makeRng$1(seed);
  const b = builder([['position', 3], ['aR', 1], ['aH', 1]]);
  const R = 3, A = 7, K = 8;
  for (let f = 0; f < K; f++) {
    const yaw = (f / K) * Math.PI * 2 + (rng() - 0.5) * 0.6;
    const size = 0.032 + rng() * 0.036, lean = 0.2 + rng() * 0.55, span = Math.PI * (0.9 + rng() * 0.6), roll = 0.6 + rng() * 0.6;
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cl = Math.cos(lean), sl = Math.sin(lean);
    const bx = cy * 0.005 * rng(), bz = sy * 0.005 * rng();
    const rows = [];
    for (let i = 0; i <= R; i++) {
      const u = i / R, r = u * size, curl = u * u * roll;
      const row = [];
      for (let j = 0; j <= A; j++) {
        const a = (j / A - 0.5) * span;
        const lx = Math.sin(a) * r * (1 - 0.3 * curl);
        const ly = Math.cos(a * 0.35) * r;
        const lz = (1 - Math.cos(a)) * r * 0.45 * (0.4 + curl) + 0.003 * Math.sin(a * 3 + f) * u;
        const y1 = ly * cl - lz * sl, z1 = ly * sl + lz * cl, wob = 1 + 0.06 * Math.sin(a * 5 + f * 1.7) * u;
        row.push(b.v((-lx * sy + z1 * cy) * wob + bx, y1 * wob - 0.004, (lx * cy + z1 * sy) * wob + bz, u, (y1 * wob) / 0.08));
      }
      rows.push(row);
    }
    for (let i = 0; i < R; i++) for (let j = 0; j < A; j++) b.q(rows[i][j], rows[i][j + 1], rows[i + 1][j], rows[i + 1][j + 1]);
  }
  return b.build(true);
}
const PADINA_FCOLOR = `
{
  float bands = vR * 9.0;
  float fb = fract(bands);
  float fw = fwidth(bands);
  float vis = 1.0 - smoothstep(0.3, 0.8, fw);
  float line = 1.0 - smoothstep(0.0, 0.08 + fw, min(fb, 1.0 - fb));
  float chalk = smoothstep(0.35, 0.5, fb) * (1.0 - smoothstep(0.7, 0.85, fb));
  vec3 c = mix(vec3(0.56, 0.46, 0.24), vec3(0.8, 0.7, 0.44), vR);
  c = mix(c, vec3(0.88, 0.85, 0.74), chalk * 0.35 * vis);
  c *= 1.0 - 0.14 * line * vis;
  c = mix(c, vec3(0.86, 0.82, 0.68), smoothstep(0.9, 1.0, vR) * 0.35);
  #ifdef USE_COLOR
    c *= vColor.rgb;
  #endif
  diffuseColor.rgb = c;
}
`;

function cystoseiraGeometry(seed) {
  const rng = makeRng$1(seed);
  const b = builder([['position', 3], ['aH', 1], ['aL', 1]]);
  const H = 0.28;
  const tube = (pts, rads, level) => {
    let prev = null;
    const u = new THREE.Vector3(), w = new THREE.Vector3(), tg = new THREE.Vector3();
    for (let s = 0; s < pts.length; s++) {
      const p = pts[s];
      if (s < pts.length - 1) tg.copy(pts[s + 1]).sub(p); else tg.copy(p).sub(pts[s - 1]);
      tg.normalize();
      u.crossVectors(tg, Math.abs(tg.y) < 0.9 ? Y$1 : X).normalize();
      w.crossVectors(tg, u);
      const r = rads[s];
      const ring = [];
      for (let k = 0; k < 3; k++) {
        const a = (k / 3) * Math.PI * 2, ca = Math.cos(a) * r, sa = Math.sin(a) * r;
        ring.push(b.v(p.x + u.x * ca + w.x * sa, p.y + u.y * ca + w.y * sa, p.z + u.z * ca + w.z * sa, p.y / H, level / 3));
      }
      if (prev) for (let k = 0; k < 3; k++) { const k1 = (k + 1) % 3; b.q(prev[k1], prev[k], ring[k1], ring[k]); }
      prev = ring;
    }
  };
  const sdv = new THREE.Vector3(), q = new THREE.Vector3();
  const frond = (p0, dir, len, wid) => {
    sdv.crossVectors(dir, Math.abs(dir.y) < 0.9 ? Y$1 : X).normalize().applyAxisAngle(dir, rng() * Math.PI);
    q.copy(p0);
    let prev = null;
    for (let s = 0; s <= 3; s++) {
      const t = s / 3;
      if (s > 0) { q.addScaledVector(dir, len / 3); q.y -= 0.004 * t; }
      const wd = wid * (1 - 0.65 * t);
      const a = b.v(q.x + sdv.x * wd, q.y + sdv.y * wd, q.z + sdv.z * wd, q.y / H, 1);
      const c = b.v(q.x - sdv.x * wd, q.y - sdv.y * wd, q.z - sdv.z * wd, q.y / H, 1);
      if (prev) b.q(prev[0], prev[1], a, c);
      prev = [a, c];
    }
  };
  const grow = (p0, dir0, len, rad, level) => {
    const nSeg = level === 0 ? 5 : 3;
    const pts = [p0.clone()], rads = [rad];
    const d = dir0.clone();
    let cur = p0.clone();
    for (let s = 1; s <= nSeg; s++) {
      d.x += (rng() - 0.5) * 0.35; d.z += (rng() - 0.5) * 0.35; d.y += 0.12; d.normalize();
      cur = cur.clone().addScaledVector(d, len / nSeg);
      pts.push(cur);
      rads.push(s === nSeg ? rad * 0.3 : rad * (1 - 0.5 * (s / nSeg)));
      if (level === 0 && s < nSeg) {
        const a = rng() * Math.PI * 2;
        const cd = new THREE.Vector3(Math.cos(a), 0.45, Math.sin(a)).normalize().multiplyScalar(0.7).addScaledVector(d, 0.6).normalize();
        grow(cur, cd, len * (0.32 + rng() * 0.18), rads[s] * 0.7, 1);
      }
      for (let k = 0; k < 2; k++) {
        const a = rng() * Math.PI * 2;
        const fd = new THREE.Vector3(Math.cos(a), 0.6 + rng() * 0.5, Math.sin(a)).normalize().addScaledVector(d, 0.5).normalize();
        frond(cur, fd, 0.025 + rng() * 0.03, 0.0035 + rng() * 0.002);
      }
    }
    tube(pts, rads, level * 0.5);
  };
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2 + rng() * 0.8;
    grow(new THREE.Vector3(Math.cos(a) * 0.01, 0, Math.sin(a) * 0.01), new THREE.Vector3(Math.cos(a) * 0.35, 1, Math.sin(a) * 0.35).normalize(), H * (0.6 + rng() * 0.45), 0.0035, 0);
  }
  return b.build(true);
}
const CYSTO_FCOLOR = `
{
  vec3 c = mix(vec3(0.22, 0.17, 0.06), vec3(0.46, 0.38, 0.12), smoothstep(0.0, 0.8, vHc));
  vec4 cn = texture2D(uTexC, vObjPos.xz * 9.0 + vObjPos.y * 4.0);
  c = mix(c, vec3(0.56, 0.47, 0.14) * (0.9 + 0.2 * cn.b), vLc * 0.6);
  c *= 0.85 + 0.3 * cn.b;
  #ifdef USE_COLOR
    c *= vColor.rgb;
  #endif
  diffuseColor.rgb = c;
}
`;
const CYSTO_FEMISSIVE = `
{
  float fr = pow(1.0 - abs(dot(normal, normalize(vViewPosition))), 2.5);
  totalEmissiveRadiance += (vec3(0.02, 0.16, 0.15) * fr * 0.18 + diffuseColor.rgb * 0.02) * uLight * wGlowK();
}
`;

function halimedaGeometry(seed) {
  const rng = makeRng$1(seed);
  const b = builder([['position', 3], ['normal', 3], ['aH', 1], ['aRim', 1]]);
  const H = 0.15;
  const side = new THREE.Vector3();
  const disc = (c, up, face, w, h) => {
    side.crossVectors(up, face).normalize();
    const ci = b.v(c.x, c.y, c.z, face.x, face.y, face.z, c.y / H, 0);
    const rim = [];
    const K = 9;
    for (let k = 0; k < K; k++) {
      const a = (k / K) * Math.PI * 2;
      const notch = 1 - 0.3 * Math.exp(-((a - Math.PI * 1.5) ** 2) / 0.12);
      const x = Math.cos(a) * w * 0.5 * notch, y = Math.sin(a) * h * 0.5 * notch, z = 0.0015 * Math.cos(a * 2);
      const qx = c.x + side.x * x + up.x * y + face.x * z;
      const qy = c.y + side.y * x + up.y * y + face.y * z;
      const qz = c.z + side.z * x + up.z * y + face.z * z;
      rim.push(b.v(qx, qy, qz, face.x, face.y, face.z, qy / H, 1));
    }
    for (let k = 0; k < K; k++) b.t(ci, rim[k], rim[(k + 1) % K]);
  };
  const chain = (p, up0, face0, n, size0, depth) => {
    let c = p.clone(), size = size0;
    const u = up0.clone(), f = face0.clone();
    for (let s = 0; s < n; s++) {
      const w = size * (0.9 + rng() * 0.25), h = w * 0.78;
      const cc = c.clone().addScaledVector(u, h * 0.5);
      disc(cc, u, f, w, h);
      c = cc.clone().addScaledVector(u, h * 0.42);
      u.addScaledVector(f, 0.12 + rng() * 0.1).add(new THREE.Vector3((rng() - 0.5) * 0.2, 0.05, (rng() - 0.5) * 0.2)).normalize();
      f.applyAxisAngle(u, (rng() - 0.5) * 0.5);
      f.sub(u.clone().multiplyScalar(f.dot(u))).normalize();
      size *= 0.96;
      if (depth < 2 && s >= 1 && rng() < 0.4) {
        const u2 = u.clone().applyAxisAngle(f, (rng() < 0.5 ? -1 : 1) * (0.4 + rng() * 0.3));
        chain(c, u2, f.clone(), Math.max(1, n - s - 1), size, depth + 1);
      }
    }
  };
  const nChains = 4 + Math.floor(rng() * 3);
  for (let k = 0; k < nChains; k++) {
    const a = (k / nChains) * Math.PI * 2 + rng() * 0.5;
    const up = new THREE.Vector3(Math.cos(a) * 0.35, 1, Math.sin(a) * 0.35).normalize();
    const face = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
    face.sub(up.clone().multiplyScalar(face.dot(up))).normalize();
    chain(new THREE.Vector3(Math.cos(a) * 0.006, 0, Math.sin(a) * 0.006), up, face, 4 + Math.floor(rng() * 3), 0.018, 0);
  }
  return b.build();
}
const HALI_FCOLOR = `
{
  vec3 c = mix(vec3(0.12, 0.27, 0.1), vec3(0.22, 0.37, 0.15), vHh);
  c = mix(c, vec3(0.62, 0.7, 0.52), smoothstep(0.55, 1.0, vRim) * 0.55);
  #ifdef USE_COLOR
    c *= vColor.rgb;
  #endif
  diffuseColor.rgb = c;
}
`;

function caulerpaGeometry(seed) {
  const rng = makeRng$1(seed);
  const b = builder([['position', 3], ['aH', 1], ['aB', 1]]);
  const n = 7;
  for (let k = 0; k < n; k++) {
    const bx = (k / (n - 1) - 0.5) * 0.22 + (rng() - 0.5) * 0.02, bz = (rng() - 0.5) * 0.03;
    const len = 0.07 + rng() * 0.08, hw = 0.006 + rng() * 0.004;
    const yaw = rng() * Math.PI, lean = (rng() - 0.5) * 0.5;
    const wx = Math.cos(yaw), wz = Math.sin(yaw);
    let prev = null;
    for (let s = 0; s <= 6; s++) {
      const t = s / 6, y = len * t;
      const prof = (t < 0.18 ? 0.22 : 0.22 + 0.78 * smoothstep(0.18, 0.42, t)) * (t > 0.72 ? Math.sqrt(Math.max(0.02, 1 - ((t - 0.72) / 0.28) ** 2)) : 1);
      const off = lean * len * t * t;
      const cx = bx - wz * off, cz = bz + wx * off;
      const l = b.v(cx - wx * hw * prof, y, cz - wz * hw * prof, t, -1);
      const r = b.v(cx + wx * hw * prof, y, cz + wz * hw * prof, t, 1);
      if (prev) b.q(prev[0], prev[1], l, r);
      prev = [l, r];
    }
  }
  const s0 = b.v(-0.13, 0.002, -15e-4, 0, 0), s1 = b.v(-0.13, 0.002, 0.0015, 0, 0);
  const s2 = b.v(0.13, 0.002, -15e-4, 0, 0), s3 = b.v(0.13, 0.002, 0.0015, 0, 0);
  b.q(s0, s1, s2, s3);
  return b.build(true);
}
const CAUL_FCOLOR = `
{
  vec3 c = mix(vec3(0.1, 0.4, 0.05), vec3(0.3, 0.66, 0.12), smoothstep(0.0, 0.7, vHc));
  c *= 0.9 + 0.12 * (1.0 - abs(vBc));
  #ifdef USE_COLOR
    c *= vColor.rgb;
  #endif
  diffuseColor.rgb = c;
}
`;

function acetabulariaGeometry(seed) {
  const rng = makeRng$1(seed);
  const b = builder([['position', 3], ['normal', 3], ['aH', 1], ['aC', 2]]);
  for (let k = 0; k < 26; k++) {
    const a = rng() * Math.PI * 2, r = Math.sqrt(rng()) * 0.06;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    const h = 0.03 + rng() * 0.03;
    const tx = (rng() - 0.5) * 0.35 * h, tz = (rng() - 0.5) * 0.35 * h;
    const sr = 0.0006;
    const ring0 = [], ring1 = [];
    for (let j = 0; j < 3; j++) {
      const aa = (j / 3) * Math.PI * 2, cx = Math.cos(aa), cz = Math.sin(aa);
      ring0.push(b.v(x + cx * sr, 0, z + cz * sr, cx, 0, cz, 0, 0, 0));
      ring1.push(b.v(x + tx + cx * sr, h, z + tz + cz * sr, cx, 0, cz, 1, 0, 0));
    }
    for (let j = 0; j < 3; j++) { const j1 = (j + 1) % 3; b.q(ring0[j1], ring0[j], ring1[j1], ring1[j]); }
    const cr = 0.004 + rng() * 0.003;
    const ci = b.v(x + tx, h - 0.0008, z + tz, 0, 1, 0, 1, 1, 0.5);
    const rim = [];
    for (let j = 0; j < 12; j++) {
      const aa = (j / 12) * Math.PI * 2;
      rim.push(b.v(x + tx + Math.cos(aa) * cr, h + 0.0012, z + tz + Math.sin(aa) * cr, 0, 1, 0, 1, 1, j % 2));
    }
    for (let j = 0; j < 12; j++) b.t(ci, rim[(j + 1) % 12], rim[j]);
  }
  return b.build();
}
const ACETA_FCOLOR = `
{
  float rib = smoothstep(0.2, 0.8, abs(vCa.y - 0.5) * 2.0);
  vec3 cap = mix(vec3(0.38, 0.48, 0.3), vec3(0.5, 0.56, 0.42), rib);
  vec3 c = mix(vec3(0.42, 0.48, 0.34), cap, vCa.x);
  #ifdef USE_COLOR
    c *= vColor.rgb;
  #endif
  diffuseColor.rgb = c;
}
`;

function scallopPt(u, v) {
  const ear = 1 - smoothstep(0.14, 0.32, u);
  const half = lerp$4(1.02, 1.5, ear);
  const a = (v - 0.5) * 2 * half;
  const r = u * (1 - 0.1 * ear);
  const dome = 0.2 * Math.max(0, Math.sin(Math.PI * Math.min(1, u * 1.02))) * (1 - 0.3 * ((v - 0.5) * 2) ** 2);
  return [Math.sin(a) * r, dome, Math.cos(a) * r - 0.5];
}
function cocklePt(u, v) {
  const a = (v - 0.5) * 2 * 1.3;
  const r = u * (1 - 0.12 * ((v - 0.5) * 2) ** 2);
  const dome = 0.42 * Math.pow(Math.max(0, Math.sin(Math.PI * Math.min(1, u * 1.01))), 0.8) * (1 - 0.25 * ((v - 0.5) * 2) ** 2);
  return [Math.sin(a) * r * 0.95, dome, Math.cos(a) * r - 0.45];
}
function murexPt(u, v) {
  const phi = v * Math.PI * 2;
  let r;
  if (u < 0.38) r = 0.3 * (u / 0.38) * (0.85 + 0.15 * Math.abs(Math.sin((u / 0.38) * Math.PI * 3.5)));
  else if (u < 0.62) r = 0.3 + 0.09 * Math.sin(((u - 0.38) / 0.24) * Math.PI);
  else r = lerp$4(0.3, 0.02, smoothstep(0.62, 1.0, u));
  r += Math.pow(Math.max(0, Math.cos(phi * 7)), 6) * (Math.exp(-((u - 0.42) ** 2) / 0.002) * 0.14 + Math.exp(-((u - 0.55) ** 2) / 0.002) * 0.1);
  return [Math.cos(phi) * r, u - 0.5, Math.sin(phi) * r];
}
function shellGeometry() {
  const R = 10, C = 25;
  const geos = [scallopPt, cocklePt, murexPt].map((fn) => {
    const b = builder([['position', 3], ['aUV', 2]]);
    const rows = [];
    for (let i = 0; i < R; i++) {
      const row = [];
      for (let j = 0; j < C; j++) { const p = fn(i / (R - 1), j / (C - 1)); row.push(b.v(p[0], p[1], p[2], i / (R - 1), j / (C - 1))); }
      rows.push(row);
    }
    for (let i = 0; i < R - 1; i++) for (let j = 0; j < C - 1; j++) b.q(rows[i][j], rows[i][j + 1], rows[i + 1][j], rows[i + 1][j + 1]);
    return b.build(true);
  });
  const g = geos[0];
  g.setAttribute('pB', geos[1].attributes.position);
  g.setAttribute('nB', geos[1].attributes.normal);
  g.setAttribute('pC', geos[2].attributes.position);
  g.setAttribute('nC', geos[2].attributes.normal);
  return g;
}
const SHELL_VDECL = `
attribute vec3 pB;
attribute vec3 nB;
attribute vec3 pC;
attribute vec3 nC;
attribute vec2 aUV;
attribute float aVar;
varying vec2 vUV;
varying float vVar;
`;
const SHELL_FDECL = `
varying vec2 vUV;
varying float vVar;
`;
const SHELL_FCOLOR = `
float wShH = 0.0;
{
  float u = vUV.x;
  float v = vUV.y;
  vec2 fw = fwidth(vUV);
  float fade = 1.0 - smoothstep(0.012, 0.035, max(fw.x, fw.y));
  vec3 c;
  if (vVar < 0.5) {
    float rib = 0.5 + 0.5 * cos((v - 0.5) * 94.0);
    float gro = 0.5 + 0.5 * cos(u * 70.0);
    c = mix(vec3(0.5, 0.24, 0.16), vec3(0.74, 0.5, 0.34), (rib * 0.6 + gro * 0.15) * fade + 0.3 * (1.0 - fade));
    c = mix(c, vec3(0.78, 0.7, 0.58), smoothstep(0.85, 1.0, u) * 0.4);
    wShH = (rib * 0.0015 * u + gro * 0.0002) * fade;
  } else if (vVar < 1.5) {
    float rib = 0.5 + 0.5 * cos((v - 0.5) * 140.0);
    float gro = smoothstep(0.6, 1.0, 0.5 + 0.5 * cos(u * 48.0));
    c = mix(vec3(0.64, 0.54, 0.41), vec3(0.45, 0.31, 0.2), gro * 0.7 * fade);
    c *= 0.87 + 0.18 * rib * fade;
    wShH = rib * 0.0012 * fade;
  } else {
    float cord = 0.5 + 0.5 * cos(u * 95.0);
    c = mix(vec3(0.6, 0.51, 0.41), vec3(0.43, 0.33, 0.25), cord * 0.5 * fade);
    c = mix(c, vec3(0.7, 0.65, 0.58), smoothstep(0.62, 0.9, u) * 0.35);
    wShH = cord * 0.0008 * fade;
  }
  if (!gl_FrontFacing) {
    vec3 flush = mix(vec3(0.5, 0.38, 0.47), vec3(0.58, 0.43, 0.4), step(0.5, fract(vVar * 3.7)));
    c = mix(vec3(0.6, 0.58, 0.54), flush, smoothstep(0.5, 1.0, u) * 0.4);
    c = mix(c, vec3(0.52, 0.48, 0.4), 0.25);
    wShH = 0.0;
  }
  #ifdef USE_COLOR
    c *= vColor.rgb;
  #endif
  diffuseColor.rgb = c;
}
`;

function stoneGeometry(R = 10, C = 17) {
  const b = builder([['position', 3], ['aUV', 2]]);
  const rows = [];
  for (let i = 0; i < R; i++) {
    const th = (i / (R - 1)) * Math.PI;
    const row = [];
    for (let j = 0; j < C; j++) {
      const ph = (j / (C - 1)) * Math.PI * 2;
      row.push(b.v(Math.sin(th) * Math.cos(ph), -Math.cos(th), Math.sin(th) * Math.sin(ph), i / (R - 1), j / (C - 1)));
    }
    rows.push(row);
  }
  for (let i = 0; i < R - 1; i++) for (let j = 0; j < C - 1; j++) b.q(rows[i][j], rows[i][j + 1], rows[i + 1][j], rows[i + 1][j + 1]);
  return b.build(true);
}
const STONE_VDECL = `
attribute vec2 aUV;
attribute float aVar;
varying vec2 vUV;
varying float vVar;
varying float vSd;
`;
const STONE_VNORMAL = `
vec3 wIp = wInstPos();
if (distance(wIp, uCamPos) > 52.0) { gl_Position = vec4(0.0, 0.0, 2.0, 1.0); return; }
float wSd = wHv(wIp.xz * 7.31 + 0.3);
vec3 wAx = aVar > 1.5 ? vec3(1.0, mix(0.62, 0.9, wSd), mix(0.8, 1.0, fract(wSd * 5.1))) : aVar > 0.5 ? vec3(1.0, 0.56, 1.0) : vec3(1.0, mix(0.42, 0.78, wSd), mix(0.62, 1.0, fract(wSd * 7.13)));
float wRing = sqrt(max(0.0, 1.0 - position.y * position.y));
float wLump = aVar > 1.5 ? 1.0 + 0.2 * sin(position.x * 7.3 + wSd * 20.0) * sin(position.z * 6.1 + wSd * 13.0) + 0.14 * sin(position.y * 8.3 + wSd * 9.0)
  : aVar > 0.5 ? 1.0 + 0.04 * cos(5.0 * aUV.y * 6.2831853) * wRing
  : 1.0 + 0.08 * sin(position.x * 3.1 + wSd * 20.0) * sin(position.z * 2.7 + wSd * 13.0) + 0.05 * sin(position.y * 3.7 + wSd * 9.0);
vec3 wSt = position * wAx * wLump;
wSt.y = max(wSt.y, -wAx.y * 0.72);
wSt *= wFadeAt(distance(wIp, uCamPos), 52.0, wIp);
objectNormal = normalize(position / wAx);
vUV = aUV;
vVar = aVar;
vSd = wSd;
`;
const STONE_FDECL = `
varying vec2 vUV;
varying float vVar;
varying float vSd;
`;
const STONE_FCOLOR = `
float wStoneH = 0.0;
vec3 wFluo = vec3(0.0);
{
  vec3 c;
  if (vVar > 1.5) {
    vec4 t = texture2D(uTexA, vObjPos.xz * 4.0 + vObjPos.y * 3.0);
    c = mix(vec3(0.3, 0.14, 0.17), vec3(0.42, 0.2, 0.24), fract(vSd * 7.3));
    c = mix(c, vec3(0.36, 0.32, 0.31), step(0.75, fract(vSd * 3.7)) * 0.8);
    c = mix(c, vec3(0.48, 0.32, 0.34), smoothstep(0.6, 0.85, t.b) * 0.3);
    c = mix(c, vec3(0.42, 0.38, 0.32), smoothstep(0.6, 0.95, vWNrm.y) * 0.3);
    c *= (0.8 + 0.3 * t.g) * 0.78;
    wFluo = c * vec3(1.0, 0.35, 0.4) * 0.1;
    wStoneH = t.b * 0.002;
  } else if (vVar < 0.5) {
    float k = vSd;
    c = vec3(0.4, 0.38, 0.35);
    c = mix(c, vec3(0.2, 0.19, 0.18), step(0.55, k) * step(k, 0.72));
    c = mix(c, vec3(0.44, 0.35, 0.24), step(0.72, k) * step(k, 0.84));
    c = mix(c, vec3(0.54, 0.53, 0.49), step(0.84, k) * step(k, 0.92));
    c = mix(c, vec3(0.46, 0.24, 0.17), step(0.92, k));
    vec4 t = texture2D(uTexA, vObjPos.xz * 3.0 + vObjPos.y * 2.0);
    c *= 0.82 + 0.3 * t.b;
    float crust = smoothstep(0.55, 0.7, t.b + vWNrm.y * 0.3) * step(0.6, fract(k * 5.3));
    vec3 crC = mix(vec3(0.6, 0.24, 0.3), vec3(0.72, 0.32, 0.36), fract(k * 11.7));
    c = mix(c, crC, crust);
    c = mix(c, vec3(0.52, 0.47, 0.37), smoothstep(0.5, 0.95, vWNrm.y) * 0.3 * (1.0 - crust));
    wFluo = crC * vec3(1.0, 0.35, 0.4) * (0.3 * crust);
    wStoneH = t.b * 0.0012;
  } else {
    float amb = smoothstep(0.75, 0.95, cos(vUV.y * 31.415927));
    float pore = smoothstep(0.55, 0.75, cos(vUV.y * 31.415927 + 1.5708)) * smoothstep(0.1, 0.4, vUV.x);
    vec2 g = vec2(vUV.y * 90.0, vUV.x * 30.0);
    float fade = 1.0 - smoothstep(0.3, 0.8, max(fwidth(g.x), fwidth(g.y)));
    float tub = (1.0 - smoothstep(0.18, 0.32, length(fract(g) - 0.5))) * fade;
    c = mix(vec3(0.6, 0.58, 0.53), vec3(0.55, 0.45, 0.5), fract(vSd * 3.1) * 0.5);
    c *= 0.88 + 0.12 * tub - 0.14 * amb - 0.08 * pore;
    c *= mix(0.72, 1.0, smoothstep(0.25, 0.6, vUV.x));
    c = mix(c, vec3(0.5, 0.46, 0.38), 0.25);
    wStoneH = tub * 0.0006;
  }
  #ifdef USE_COLOR
    c *= vColor.rgb;
  #endif
  diffuseColor.rgb = c;
}
`;

function pinnaGeometry() {
  const b = builder([['position', 3], ['aUV', 2]]);
  const R = 12, C = 9;
  for (const s of [-1, 1]) {
    const rows = [];
    for (let i = 0; i < R; i++) {
      const u = i / (R - 1);
      const row = [];
      for (let j = 0; j < C; j++) {
        const v = (j / (C - 1)) * 2 - 1;
        const w = 0.22 * Math.pow(u, 0.75);
        const y = u * (1 - 0.1 * v * v * u);
        const bul = 0.07 * Math.pow(u, 0.7) * (1 - v * v);
        const gape = 0.012 * u * u * (0.5 + 0.5 * v);
        row.push(b.v(v * w, y, s * (bul + gape + 0.002 * (1 + v) * 0.5), u, (v + 1) * 0.5));
      }
      rows.push(row);
    }
    for (let i = 0; i < R - 1; i++) {
      for (let j = 0; j < C - 1; j++) {
        if (s > 0) b.q(rows[i][j], rows[i + 1][j], rows[i][j + 1], rows[i + 1][j + 1]);
        else b.q(rows[i][j], rows[i][j + 1], rows[i + 1][j], rows[i + 1][j + 1]);
      }
    }
  }
  return b.build(true);
}
const PINNA_FCOLOR = `
float wPnH = 0.0;
{
  float u = vUVp.x;
  float v = vUVp.y;
  vec3 c;
  if (gl_FrontFacing) {
    float ribs = 0.5 + 0.5 * cos(v * 3.14159 * 18.0);
    float growth = 0.5 + 0.5 * cos(u * 64.0);
    float scales = smoothstep(0.55, 0.9, ribs) * smoothstep(0.4, 0.9, growth);
    c = mix(vec3(0.25, 0.15, 0.09), vec3(0.45, 0.28, 0.17), ribs * 0.5 + growth * 0.25);
    c = mix(c, vec3(0.58, 0.45, 0.33), scales * 0.5);
    vec4 ep = texture2D(uTexC, vec2(u * 2.0, v * 1.2));
    float epi = smoothstep(0.5, 0.7, ep.b) * smoothstep(0.3, 0.8, u);
    c = mix(c, mix(vec3(0.6, 0.34, 0.43), vec3(0.24, 0.38, 0.14), ep.r), epi * 0.7);
    wPnH = (ribs * 0.4 + scales) * 0.0025;
  } else {
    float ir = 0.5 + 0.5 * sin(u * 30.0 + v * 7.0);
    c = mix(vec3(0.72, 0.5, 0.35), vec3(0.66, 0.6, 0.62), ir);
  }
  diffuseColor.rgb = c;
}
`;

function buildShells(grid, plan, q) {
  const rng = varyRng(9001);
  const items = [];
  const target = Math.floor(340 * q);
  const c = new THREE.Color();
  const put = (x, z, R) => {
    const h = grid.height(x, z);
    if (h < -40) return;
    const kind = R() < 0.42 ? 0 : R() < 0.6 ? 1 : 2;
    const size = kind === 0 ? 0.07 + R() * 0.05 : kind === 1 ? 0.04 + R() * 0.025 : 0.06 + R() * 0.03;
    const qq = new THREE.Quaternion().setFromUnitVectors(Y$1, grid.normal(x, z)).multiply(new THREE.Quaternion().setFromAxisAngle(Y$1, R() * Math.PI * 2));
    let lift = 0;
    if (kind < 2) {
      if (R() < 0.35) { qq.multiply(new THREE.Quaternion().setFromAxisAngle(X, Math.PI)); lift = (kind === 0 ? 0.2 : 0.42) * size; }
    } else {
      qq.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2));
      lift = 0.3 * size;
    }
    const t = 0.85 + R() * 0.3;
    items.push({ p: new THREE.Vector3(x, h + lift - size * 0.04, z), q: qq, s: sv(size), c: c.setRGB(t, t * (0.92 + R() * 0.1), t * (0.88 + R() * 0.14)).clone(), v: kind });
  };
  for (let i = 0; i < target * 8 && items.length < target; i++) {
    const r0 = rng();
    let x, z;
    if (r0 < 0.4) { x = LAYOUT.wreck.x + rng.gauss() * 7; z = LAYOUT.wreck.z + rng.gauss() * 9; }
    else if (r0 < 0.75) {
      const p = plan[Math.floor(rng() * plan.length)];
      const a = rng() * Math.PI * 2, d = 0.5 * (p.sx + p.sz) * (1.05 + rng() * 1.6);
      x = p.x + Math.cos(a) * d; z = p.z + Math.sin(a) * d;
    } else { x = (rng() - 0.5) * 90; z = (rng() - 0.5) * 90; }
    if (nearFinds(x, z, 0.4) || grid.sand(x, z) < 0.7 || rng() > asmKeep(x, z)) continue;
    put(x, z, rng);
  }
  const R2 = varyRng(9051);
  for (const f of LAYOUT.frags) {
    for (let k = 0; k < Math.floor(8 * q); k++) {
      const a = R2() * Math.PI * 2, r = 1.3 + R2() * 1.5, x = f.x + Math.cos(a) * r, z = f.z + Math.sin(a) * r;
      if (grid.sand(x, z) >= 0.7) put(x, z, R2);
    }
  }
  const mat = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.45, metalness: 0, envMapIntensity: 0.5 });
  worldMaterial(mat, 'shell', {
    vDecl: SHELL_VDECL,
    vNormal: 'objectNormal = aVar < 0.5 ? normal : (aVar < 1.5 ? nB : nC);',
    vBegin: cullVert(52, 'transformed = aVar < 0.5 ? position : (aVar < 1.5 ? pB : pC);\nvUV = aUV;\nvVar = aVar;'),
    fDecl: SHELL_FDECL,
    fColor: SHELL_FCOLOR,
    fNormal: 'normal = wBumpH(normal, wShH);',
  });
  return makeInstanced(shellGeometry(), mat, items, { extra: [['aVar', 1, (it) => it.v]] });
}

function buildStones(grid, plan, boulders, q, extra = []) {
  const rng = varyRng(9101);
  const items = [];
  const target = Math.floor(640 * q);
  const c = new THREE.Color();
  const put = (x, z, R) => {
    const h = grid.height(x, z);
    if (h < -46) return;
    const test = R() < 0.13;
    const s = test ? 0.025 + R() * 0.012 : 0.02 + Math.pow(R(), 1.5) * 0.05;
    const qq = new THREE.Quaternion().setFromUnitVectors(Y$1, grid.normal(x, z)).multiply(new THREE.Quaternion().setFromAxisAngle(Y$1, R() * Math.PI * 2));
    const t = 0.88 + R() * 0.24;
    items.push({ p: new THREE.Vector3(x, h + s * (test ? 0.18 : 0.08), z), q: qq, s: sv(s), c: c.setRGB(t, t, t * (0.96 + R() * 0.06)).clone(), v: test ? 1 : 0 });
  };
  for (let i = 0; i < target * 8 && items.length < target; i++) {
    const r0 = rng();
    let x, z;
    if (r0 < 0.35) {
      const p = plan[Math.floor(rng() * plan.length)];
      const a = rng() * Math.PI * 2, d = 0.5 * (p.sx + p.sz) * (1.0 + rng() * 1.2);
      x = p.x + Math.cos(a) * d; z = p.z + Math.sin(a) * d;
    } else if (r0 < 0.55 && boulders.length) {
      const bo = boulders[Math.floor(rng() * boulders.length)];
      const a = rng() * Math.PI * 2, d = bo.s * (0.85 + rng() * 1.4);
      x = bo.x + Math.cos(a) * d; z = bo.z + Math.sin(a) * d;
    } else if (r0 < 0.7) { x = LAYOUT.hull.x + rng.gauss() * 2.2; z = LAYOUT.hull.z + rng.gauss() * 5; }
    else { x = (rng() - 0.5) * 120; z = (rng() - 0.5) * 120; }
    if (nearFinds(x, z, 0.3) || rng() > asmKeep(x, z)) continue;
    put(x, z, rng);
  }
  const R2 = varyRng(9151);
  for (const f of LAYOUT.frags) {
    for (let k = 0; k < Math.floor(22 * q); k++) {
      const a = R2() * Math.PI * 2, r = 1.25 + R2() * 1.6, x = f.x + Math.cos(a) * r, z = f.z + Math.sin(a) * r;
      if (grid.sand(x, z) >= 0.7) put(x, z, R2);
    }
  }
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.7, metalness: 0, envMapIntensity: 0.5 });
  worldMaterial(mat, 'stone', {
    vDecl: STONE_VDECL,
    vNormal: STONE_VNORMAL,
    vBegin: 'transformed = wSt;',
    fDecl: STONE_FDECL,
    fColor: STONE_FCOLOR,
    fNormal: 'normal = wBumpH(normal, wStoneH);',
    fLights: FLUO_LIGHTS,
    fEmissive: FLUO_AMBIENT,
  });
  const mesh = makeInstanced(stoneGeometry(8, 13), mat, items, { extra: [['aVar', 1, (it) => it.v]], tile: TILE * 2 });
  if (!extra.length) return mesh;
  const g = new THREE.Group();
  g.add(mesh, makeInstanced(stoneGeometry(5, 7), mat, extra, { extra: [['aVar', 1, (it) => it.v]] }));
  return g;
}

const PINNA_KEEP = [];
function buildPinna(grid, blockers, q) {
  const rng = varyRng(9201);
  const items = [];
  const target = Math.max(1, Math.floor(14 * q));
  for (let i = 0; i < 6000 && items.length < target; i++) {
    const a = rng() * Math.PI * 2, r = Math.sqrt(rng()) * (LAYOUT.meadow.r - 3);
    const x = LAYOUT.meadow.x + Math.cos(a) * r * 1.25, z = LAYOUT.meadow.z + Math.sin(a) * r;
    if (meadowAt(x, z) < 0.35 || !seagrassOK(x, z, grid, blockers)) continue;
    if (items.some((it) => Math.hypot(it.p.x - x, it.p.z - z) < 3)) continue;
    const len = 0.42 + rng() * 0.26;
    const qq = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(rng() - 0.5, 0, rng() - 0.5).normalize(), (rng() - 0.5) * 0.3)
      .multiply(new THREE.Quaternion().setFromAxisAngle(Y$1, rng() * Math.PI * 2));
    items.push({ p: new THREE.Vector3(x, grid.height(x, z) - len * 0.3, z), q: qq, s: sv(len) });
  }
  const R2 = makeRng$1(9202), seg = (x, z, a, b) => { const ux = b.x - a.x, uz = b.z - a.z, t = clamp$9(((x - a.x) * ux + (z - a.z) * uz) / (ux * ux + uz * uz), 0, 1); return Math.hypot(x - a.x - ux * t, z - a.z - uz * t); };
  const F = LAYOUT.frags, walks = [[LAYOUT.landing, F[0]], [LAYOUT.landing, F[1]], [F[0], F[1]], [F[1], F[2]], [F[0], F[2]], BED_NORTH, BED_NORTH2];
  const open = [];
  for (let i = 0; i < 3000 && open.length < (q < 0.6 ? 0 : Math.max(2, Math.floor(18 * q))); i++) {
    const a = R2() * Math.PI * 2, r = 8 + R2() * 18, x = LAYOUT.wreck.x + Math.cos(a) * r, z = LAYOUT.wreck.z + Math.sin(a) * r;
    if (nearGameplay(x, z, 1.5) || Math.hypot(x - LAYOUT.assembly.x, z - LAYOUT.assembly.z) < 8 || Math.hypot(x - LAYOUT.landing.x, z - LAYOUT.landing.z) < 4) continue;
    if (walks.some(([p0, p1]) => seg(x, z, p0, p1) < 2.2) || !seagrassOK(x, z, grid, blockers) || meadowAt(x, z) > 0.2) continue;
    if ((LAYOUT.siteKeep || []).some((k) => Math.hypot(x - k.x, z - k.z) < k.r + 0.8) || !siteWayClear(x, 0, z, 0.6)) continue;
    if (items.concat(open).some((it) => Math.hypot(it.p.x - x, it.p.z - z) < 3.5)) continue;
    const len = 0.38 + R2() * 0.24;
    const qq = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(R2() - 0.5, 0, R2() - 0.5).normalize(), (R2() - 0.5) * 0.3)
      .multiply(new THREE.Quaternion().setFromAxisAngle(Y$1, R2() * Math.PI * 2));
    open.push({ p: new THREE.Vector3(x, grid.height(x, z) - len * 0.3, z), q: qq, s: sv(len) });
  }
  PINNA_KEEP.length = 0;
  for (const it of open) PINNA_KEEP.push({ x: it.p.x, y: it.p.y + it.s.y * 0.35, z: it.p.z, r: 0.28 });
  items.push(...open);
  const mat = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.6, metalness: 0, envMapIntensity: 0.5 });
  worldMaterial(mat, 'pinna', {
    vDecl: 'attribute vec2 aUV;\nvarying vec2 vUVp;\n',
    vBegin: cullVert(60, 'vUVp = aUV;'),
    fDecl: 'varying vec2 vUVp;\n',
    fColor: PINNA_FCOLOR,
    fNormal: 'normal = wBumpH(normal, wPnH);',
  });
  return makeInstanced(pinnaGeometry(), mat, items, { cast: false });
}

const SNOW_NEAR = 6.5, SNOW_FAR = 15.0;
const SNOW_VERT = `
uniform float uTime;
uniform vec3 uCam;
uniform vec3 uDrift;
uniform float uFpx;
uniform float uUnder;
uniform float uWaterY;
uniform float uLight;
uniform sampler2D uCaustics;
uniform float uCausticTile;
uniform vec3 uSunW;
attribute vec4 aSeed;
varying float vA;
varying float vKind;
varying float vSeed;
varying float vSoft;
varying float vPx;
varying vec3 vCol;
void main() {
  float s = aSeed.x;
  float kind = aSeed.y;
  float floc = step(0.5, kind) * step(kind, 1.5);
  float hs = mix(${gf$3(SNOW_FAR)}, ${gf$3(SNOW_NEAR)}, step(aSeed.w, 0.5));
  vec3 p = position + uDrift * (0.8 + 0.4 * fract(s * 7.31))
    + vec3(sin(uTime * 0.21 + s * 40.0), 0.35 * sin(uTime * 0.13 + s * 17.0), cos(uTime * 0.17 + s * 30.0)) * (0.1 + 0.2 * fract(s * 3.7));
  p.y -= uTime * (0.004 + 0.016 * fract(s * 5.1)) * (1.0 + floc);
  vec3 rel = mod(p - uCam + hs, 2.0 * hs) - hs;
  p = uCam + rel;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float d = max(-mv.z, 0.01);
  gl_Position = projectionMatrix * mv;
  float own = aSeed.z * 0.001 * uFpx / d;
  float coc = uFpx * 0.012 * abs(1.0 / d - 1.0 / 3.6);
  float px = max(max(own, coc), 1.35);
  vPx = px + 1.0;
  gl_PointSize = vPx;
  vSoft = smoothstep(1.5, 6.0, coc - own);
  float depth = max(uWaterY - p.y, 0.0);
  vec2 e = p.xz + uSunW.xz * (depth / max(uSunW.y, 0.2));
  float pat = textureLod(uCaustics, e / (uCausticTile * 4.2), 4.0).g;
  float grp = textureLod(uCaustics, e / (uCausticTile * 13.0) + vec2(uTime * 0.004, -uTime * 0.003), 5.0).g;
  float shaft = smoothstep(0.16, 0.42, pat) * smoothstep(0.08, 0.3, grp);
  vec3 tint = exp(-vec3(0.105, 0.036, 0.021) * depth);
  vCol = mix(vec3(0.92, 0.95, 0.9), vec3(0.84, 0.82, 0.7), floc) * (tint * (0.7 + 1.9 * shaft) + vec3(0.05, 0.13, 0.16)) * uLight;
  float energy = (own * own + 0.6) * (2.2 + 1.5 * floc);
  float peak = min(energy / (px * px), 1.0);
  peak = mix(peak, 0.13 + 0.06 * floc, vSoft);
  float edge = max(abs(rel.x), max(abs(rel.y), abs(rel.z)));
  vA = peak * smoothstep(0.12, 0.3, d) * (1.0 - smoothstep(hs * 0.72, hs, edge))
     * mix(0.3, 1.0, smoothstep(1.5, 12.0, depth)) * step(p.y, uWaterY - 0.25) * uUnder;
  vKind = kind;
  vSeed = s;
}
`;
const SNOW_FRAG = `
uniform float uTime;
varying float vA;
varying float vKind;
varying float vSeed;
varying float vSoft;
varying float vPx;
varying vec3 vCol;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float r = length(c) * 2.0;
  float aa = 2.0 / vPx;
  float disc = (1.0 - smoothstep(1.0 - aa * 1.5, 1.0, r)) * (0.8 + 0.35 * smoothstep(0.45, 0.95, r));
  float a;
  if (vKind < 0.5) {
    a = mix(exp(-r * r * 3.0) * 1.7, disc, vSoft);
  } else if (vKind < 1.5) {
    float ang = atan(c.y, c.x);
    float rag = 0.72 + 0.14 * sin(ang * 3.0 + vSeed * 20.0) + 0.1 * sin(ang * 7.0 - vSeed * 11.0);
    a = (1.0 - smoothstep(rag - 0.3 - aa, rag, r)) * (0.8 + 0.2 * sin(c.x * 23.0 + vSeed * 9.0) * sin(c.y * 19.0));
    a = mix(a * 1.4, disc, vSoft);
  } else {
    float tw = pow(max(0.0, sin(uTime * (1.3 + fract(vSeed * 7.0) * 2.0) + vSeed * 50.0)), 24.0);
    a = exp(-r * r * 3.0) * (1.0 - smoothstep(1.0 - aa, 1.0, r)) * (0.6 + 3.0 * tw);
  }
  a *= vA;
  if (a < 0.002) discard;
  gl_FragColor = vec4(vCol, a);
}
`;

class MarineSnow {
  constructor(scene, q) {
    const rng = makeRng$1(77);
    const nNear = Math.floor(5200 * q), nFar = Math.floor(1600 * q), count = nNear + nFar;
    const pos = new Float32Array(count * 3), seed = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) {
      const near = i < nNear, hs = near ? SNOW_NEAR : SNOW_FAR;
      pos[i * 3] = (rng() - 0.5) * 2 * hs;
      pos[i * 3 + 1] = (rng() - 0.5) * 2 * hs;
      pos[i * 3 + 2] = (rng() - 0.5) * 2 * hs;
      const r = rng(), kind = r < 0.84 ? 0 : r < 0.94 ? 1 : 2;
      seed[i * 4] = rng();
      seed[i * 4 + 1] = kind;
      seed[i * 4 + 2] = kind === 0 ? 0.3 + Math.pow(rng(), 2) * 1.2 : kind === 1 ? 1.8 + rng() * 3.5 : 0.5 + rng() * 0.6;
      seed[i * 4 + 3] = near ? 0 : 1;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
    this.u = { uCam: { value: new THREE.Vector3() }, uDrift: { value: new THREE.Vector3() }, uFpx: { value: 600 }, uUnder: { value: 1 } };
    this.drift = new THREE.Vector2();
    this.mat = new THREE.ShaderMaterial({
      uniforms: Object.assign({
        uTime: U.uTime, uLight: U.uLight, uWaterY: U.uWaterY, uCaustics: U.uCaustics,
        uCausticTile: U.uCausticTile, uSunW: U.uSunW,
      }, this.u),
      vertexShader: SNOW_VERT,
      fragmentShader: SNOW_FRAG,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
    this.points.onBeforeRender = (renderer, sc, cam) => {
      const rt = renderer.getRenderTarget();
      this.u.uFpx.value = cam.projectionMatrix.elements[5] * 0.5 * (rt ? rt.height : renderer.domElement.height);
    };
    scene.add(this.points);
  }
  update(dt, camera) {
    this.u.uCam.value.copy(camera.position);
    this.drift.x += dt * 0.035;
    this.drift.y += dt * 0.02;
    this.u.uDrift.value.set(this.drift.x + U.uSurge.value.x * 1.2, 0, this.drift.y + U.uSurge.value.z * 1.2);
    this.u.uUnder.value = camera.position.y < U.uWaterY.value + 0.05 ? 1 : 0;
  }
}

const SURGE_YAW = Math.atan2(0.895, -0.445);
const FAN_LOD = 6.5, FAN_FULL = 32, CAV_LOD = 5.0;
const FAN_PAL = [
  [0.38, [0.44, 0.05, 0.12], [0.72, 0.1, 0.18], 0],
  [0.34, [0.42, 0.05, 0.19], [0.68, 0.07, 0.3], 0],
  [0.18, [0.33, 0.04, 0.2], [0.48, 0.05, 0.27], 0],
  [0.1, [0.45, 0.06, 0.13], [0.7, 0.38, 0.06], 0.5],
];
function fanColours(r, pal = FAN_PAL) {
  let u = r(), v = pal[pal.length - 1];
  for (const p of pal) { if (u < p[0]) { v = p; break; } u -= p[0]; }
  const k = 0.92 + r() * 0.16, h = (r() - 0.5) * 0.2, w = v[3] ? v[3] + (r() - 0.5) * 0.1 : 0;
  const tint = (c) => [c[0] * k * (1 + h), c[1] * k, c[2] * k * (1 - h)];
  const c1 = tint(v[2]);
  return { c0: tint(v[1]), c1: [c1[0], c1[1], c1[2], w] };
}
const _fx = new THREE.Vector3(), _fy = new THREE.Vector3(), _fz = new THREE.Vector3(), _fm = new THREE.Matrix4();
function fanFrame(nx, ny, nz, yaw, lean, under = false, out = 0.55) {
  const ax = _fx, ay = _fy, az = _fz;
  if (under) { const hl = Math.hypot(nx, nz) || 1; ay.set((nx / hl) * 0.85, 0.3, (nz / hl) * 0.85).normalize(); }
  else {
    const hl = Math.hypot(nx, nz) || 1, fin = 1 - Math.abs((nx * Math.sin(yaw) + nz * Math.cos(yaw)) / hl);
    ay.set(nx, ny, nz).normalize().multiplyScalar(out * (0.35 + 0.65 * fin)).add(Y$1).normalize();
  }
  az.set(Math.sin(yaw), 0, Math.cos(yaw)).addScaledVector(ay, -az.dot(ay)).normalize();
  ax.crossVectors(ay, az).normalize();
  ay.addScaledVector(ax, lean).normalize();
  az.crossVectors(ax, ay).normalize();
  ax.crossVectors(ay, az).normalize();
  return new THREE.Quaternion().setFromRotationMatrix(_fm.makeBasis(ax, ay, az));
}
function placeReefLife(pts, blocks, axi, R, C, q, sun, gh = floorHeight) {
  const L2 = { fan0: [], fan1: [], fan2: [], fanFar: [], cav: [], sing: [], polyp: [], axi: [], myr: [], apl: [], star: [], urchin: [], anem: [], pad: [], aceta: [], cysto: [], hali: [], keep: [] };
  for (const e of pts) {
    const s = e.nx * sun.x + e.ny * sun.y + e.nz * sun.z, v = reefView(e.b), hl = Math.hypot(e.nx, e.nz) || 1;
    const vx = v.x - e.x, vz = v.z - e.z, vl = Math.hypot(vx, vz) || 1;
    e.lit = s > 0.25 && e.sh < 0.3;
    e.dim = s < 0.15 || e.sh > 0.5;
    e.seen = (e.nx * vx + e.nz * vz) / (hl * vl);
    e.f = e.ny > 0.72 && e.hB > 0.1 ? 'top' : e.ny > 0.3 && e.hB > 0.25 ? 'brink' : e.ny <= -0.25 && e.hB > 0.2 ? 'under' : e.ny <= 0.3 && e.hB > 0.3 ? 'wall' : 'foot';
    e.foot = e.hB <= 0.45;
  }
  const kind = (e) => e.o.kind, bowP = (e) => e.o.name.startsWith('bow');
  const walls = pts.filter((e) => (kind(e) === 'wall' || kind(e) === 'ledge' || kind(e) === 'shelf') && !bowP(e)), bow = pts.filter(bowP);
  const knoll = pts.filter((e) => kind(e) === 'knoll'), stones = pts.filter((e) => kind(e) === 'stone');
  const P = (e, d = 0) => new THREE.Vector3(e.x - e.nx * d, e.y - e.ny * d, e.z - e.nz * d);
  const sow = (src, n, ok, fn) => {
    if (!src.length) return;
    n = Math.round(n * q * (0.9 + R() * 0.2));
    for (let i = 0, t = 0; i < n && t < n * 80; t++) {
      const e = src[Math.floor(R() * src.length)];
      if (!ok(e) || R() > e.k) continue;
      if (fn(e) !== false) i++;
    }
  };
  const c = new THREE.Color();
  const gorg = [];
  const room = (e, h) => !gorg.some((g) => Math.hypot(g.x - e.x, g.y - e.y, g.z - e.z) < 0.35 * (g.h + h));
  const flowYaw = (e) => {
    const hl = Math.hypot(e.nx, e.nz), open = hl < 0.3 || kind(e) === 'knoll' || kind(e) === 'rubble';
    let a = open ? SURGE_YAW + (R() - 0.5) * 0.5 : Math.atan2(-e.nz / hl, e.nx / hl) + (R() - 0.5) * 1.22;
    if (e.seen > 0.2 || open) {
      const v = reefView(e.b), t = Math.atan2(v.x - e.x, v.z - e.z);
      let d = Math.atan2(Math.sin(t - a), Math.cos(t - a));
      if (Math.abs(d) > Math.PI / 2) d -= Math.sign(d) * Math.PI;
      a += clamp$9(d, open ? -0.8 : -0.7, open ? 0.8 : 0.7);
    }
    return a;
  };
  const _u = new THREE.Vector3(), _a = new THREE.Vector3(), _t = new THREE.Vector3();
  const clearOf = (p, qq, h, wHalf) => {
    _u.set(0, 1, 0).applyQuaternion(qq); _a.set(1, 0, 0).applyQuaternion(qq);
    for (const [f, u] of [[0.35, 0], [0.6, 0], [0.9, 0], [0.55, -0.8], [0.55, 0.8], [0.8, -0.7], [0.8, 0.7]]) {
      _t.copy(p).addScaledVector(_u, h * f).addScaledVector(_a, wHalf * u);
      if (blocks.some((b) => inBlock(b, _t.x, _t.y, _t.z, 1.02, true))) return false;
    }
    return true;
  };
  const ball = (p, qq, h, wHalf) => {
    _u.set(0, 1, 0).applyQuaternion(qq);
    return { x: p.x + _u.x * h * 0.55, y: p.y + _u.y * h * 0.55, z: p.z + _u.z * h * 0.55, r: Math.max(0.2, h * 0.6, wHalf * 1.1) + 0.05, fan: true };
  };
  const keep = (p, qq, h, wHalf) => { L2.keep.push(ball(p, qq, h, wHalf)); };
  const WN = (LAYOUT.formations || []).find((f) => f.kind === 'window');
  const LANE = WN ? [[LAYOUT.landing.x, LAYOUT.landing.z], [-2.75, 5.0], [-2.4, 8.3], [WN.x, WN.z - 0.6], [WN.x + 0.15, WN.z + 2.6]] : [];
  const LANE2 = WN ? [[-3.2, 3.6], [-3.9, 5.6], [-3.9, 8.6], [-3.3, 10.4], [-3, 13.4]] : [];
  const inLane = (b) => {
    const up = b.y - b.r - gh(b.x, b.z);
    if (!siteWayClear(b.x, up, b.z, b.r)) return true;
    if (up > 3.6) return false;
    for (let i = 0; i < LANE.length - 1; i++) {
      const lens = i >= 2;
      if (!lens && up > 2.0) continue;
      const [ax, az] = LANE[i], [bx, bz] = LANE[i + 1], ux = bx - ax, uz = bz - az, t = clamp$9(((b.x - ax) * ux + (b.z - az) * uz) / (ux * ux + uz * uz), 0, 1);
      if (Math.hypot(b.x - ax - ux * t, b.z - az - uz * t) < (lens ? 1.35 : 0.75) + b.r) return true;
    }
    for (let i = 0; i < LANE2.length - 1; i++) {
      const [ax, az] = LANE2[i], [bx, bz] = LANE2[i + 1], ux = bx - ax, uz = bz - az, t = clamp$9(((b.x - ax) * ux + (b.z - az) * uz) / (ux * ux + uz * uz), 0, 1);
      if (Math.hypot(b.x - ax - ux * t, b.z - az - uz * t) < 0.9 + b.r) return true;
    }
    return false;
  };
  const H = 0.95, LD = LAYOUT.landing;
  const fanH = () => { const u = R(); return u < 0.25 ? 0.45 + R() * 0.15 : u < 0.8 ? 0.6 + R() * 0.3 : 0.9 + R() * 0.2; };
  const byO = new Map();
  for (const e of pts) { let a = byO.get(e.o); if (!a) byO.set(e.o, (a = [])); a.push(e); }
  const grove = (e, n, sz) => {
    const nb = (byO.get(e.o) || []).filter((f) => (f.f === 'wall' || f.f === 'under' || (kind(f) === 'knoll' && f.f === 'brink')) && f.hB > 0.3
      && Math.abs(f.x - e.x) < 1.1 && Math.abs(f.y - e.y) < 1.1 && Math.abs(f.z - e.z) < 1.1 && Math.hypot(f.x - e.x, f.y - e.y, f.z - e.z) > 0.3
      && f.nx * e.nx + f.ny * e.ny + f.nz * e.nz > 0.45);
    for (let i = 0, t = 0; i < n && t < n * 6 && nb.length; t++) if (addFan(nb[Math.floor(R() * nb.length)], sz + R() * 0.35) !== false) i++;
  };
  const LENSES = [{ x: LD.x - 2.75, z: LD.z + 0.6, fx: 1, fz: 0 }, { x: LD.x - 0.55, z: LD.z - 2.7, fx: 0, fz: 1 }];
  const lensY = floorHeight(LD.x, LD.z) + 2.3, _f = new THREE.Vector3(), _g = new THREE.Vector3();
  const inView = (V, x, z) => { const dx = x - V.x, dz = z - V.z; return (dx * V.fx + dz * V.fz) / (Math.hypot(dx, dz) || 1) > 0.64; };
  const faceOK = (e, qq, p, h, near, flat, edge) => {
    _f.set(0, 0, 1).applyQuaternion(qq); _g.set(0, 1, 0).applyQuaternion(qq);
    if (Math.abs(_f.x * e.nx + _f.y * e.ny + _f.z * e.nz) > flat && _g.x * e.nx + _g.y * e.ny + _g.z * e.nz < 0.32) return false;
    if (near) {
      for (const V of LENSES) {
        if (!inView(V, p.x, p.z)) continue;
        const vx = p.x - V.x, vy = p.y + h * 0.5 - lensY, vz = p.z - V.z;
        if (Math.abs(_f.x * vx + _f.y * vy + _f.z * vz) / (Math.hypot(vx, vy, vz) || 1) < edge) return false;
      }
    }
    return true;
  };
  const _o = new THREE.Vector3(), _d = new THREE.Vector3();
  const openBehind = (p, qq, h, wHalf) => {
    _u.set(0, 1, 0).applyQuaternion(qq); _a.set(1, 0, 0).applyQuaternion(qq);
    for (const sd of [0, -0.8, 0.8]) {
      const cx = p.x + _u.x * h * 0.6 + _a.x * wHalf * sd, cy = p.y + _u.y * h * 0.6 + _a.y * wHalf * sd, cz = p.z + _u.z * h * 0.6 + _a.z * wHalf * sd;
      for (const V of LENSES) {
        if (!inView(V, cx, cz)) continue;
        _d.set(cx - V.x, cy - lensY, cz - V.z);
        if (_d.length() < 12) continue;
        _d.normalize();
        let hit = false;
        for (let t = 0.7; t < 11 && !hit; t += 0.45) {
          _o.set(cx + _d.x * t, cy + _d.y * t, cz + _d.z * t);
          hit = _o.y < gh(_o.x, _o.z) || blocks.some((b) => inBlock(b, _o.x, _o.y, _o.z, 1));
        }
        if (!hit) return true;
      }
    }
    return false;
  };
  const turned = (e, p, h, lean, out, flat = 0.82, edge = 0.4) => {
    const near = Math.hypot(e.x - LD.x, e.z - LD.z) < 12, V = near && LENSES.find((V) => inView(V, e.x, e.z));
    const y0 = V ? Math.atan2(V.x - e.x, V.z - e.z) + (R() - 0.5) * 0.5 : flowYaw(e);
    for (const dy of [0, 0.35, -0.35, 0.7, -0.7, 1.05, -1.05]) {
      const qq = fanFrame(e.nx, e.ny, e.nz, y0 + dy, lean, e.f === 'under', out);
      if (faceOK(e, qq, p, h, near, flat, edge)) return qq;
    }
    return null;
  };
  const addFan = (e, h, wk = 0.8 + R() * 0.6) => {
    if (!room(e, h)) return false;
    const p = P(e, 0.02), qq = turned(e, p, h, (R() - 0.5) * 0.36, kind(e) === 'knoll' ? 1.35 : 0.55);
    if (!qq || inLane(ball(p, qq, h, h * 0.6 * wk)) || !clearOf(p, qq, h, h * 0.5 * wk) || openBehind(p, qq, h, h * 0.5 * wk)) return false;
    gorg.push({ x: e.x, y: e.y, z: e.z, h });
    const it = Object.assign({ p, q: qq, s: new THREE.Vector3((h * wk) / H, h / H, (h * wk) / H) }, fanColours(C));
    L2['fan' + Math.floor(R() * 3)].push(it);
    keep(p, qq, h, h * 0.6 * wk);
  };
  const CAV = [[0.85, [0.6, 0.48, 0.1], [0.78, 0.68, 0.2], 0], [0.15, [0.6, 0.46, 0.1], [0.8, 0.56, 0.14], 0]];
  const addCav = (e, h) => {
    if (!room(e, h)) return false;
    const wk = 0.85 + R() * 0.5, p = P(e, 0.015), qq = turned(e, p, h, (R() - 0.5) * 0.3, 0.85, 0.9, 0.34);
    if (!qq || inLane(ball(p, qq, h, h * 0.55 * wk)) || !clearOf(p, qq, h, h * 0.5 * wk) || openBehind(p, qq, h, h * 0.5 * wk)) return false;
    gorg.push({ x: e.x, y: e.y, z: e.z, h });
    L2.cav.push(Object.assign({ p, q: qq, s: new THREE.Vector3((h * wk) / 0.4, h / 0.4, (h * wk) / 0.4) }, fanColours(C, CAV)));
    keep(p, qq, h, h * 0.55 * wk);
  };
  const knots = [], brinkLine = (e) => {
    const hl = Math.hypot(e.nx, e.nz) || 1, x = e.x - (e.nx / hl) * 0.25, y = e.y + 0.15, z = e.z - (e.nz / hl) * 0.25;
    return !blocks.some((b) => inBlock(b, x, y, z, 1, true));
  };
  const cavKnot = (e) => {
    const face = Math.round(((Math.atan2(e.nz, e.nx) + Math.PI) / (Math.PI * 2)) * 4) % 4;
    if (knots.some((k) => Math.hypot(k.x - e.x, k.y - e.y, k.z - e.z) < 1.0 || (k.o === e.o && k.face === face)) || brinkLine(e)) return false;
    knots.push({ x: e.x, y: e.y, z: e.z, o: e.o, face });
    return true;
  };
  const mat = (e, n, w, hgt) => {
    const tx = -e.nz, tz = e.nx, tl = Math.hypot(tx, tz) || 1;
    const on = pts.filter((f) => f.b === e.b && Math.abs((f.x - e.x) * tx + (f.z - e.z) * tz) / tl < w * 0.5 && Math.abs(f.y - e.y) < hgt * 0.5 + 0.02
      && Math.hypot(f.x - e.x, f.y - e.y, f.z - e.z) < w * 0.6 && f.nx * e.nx + f.ny * e.ny + f.nz * e.nz > 0.4);
    if (!on.length) return;
    const src = on.filter((f) => f.pz > 0.25);
    if (src.length < 3) return;
    for (let i = 0, m = Math.min(n, src.length * 6); i < m; i++) {
      const f = src[Math.floor(R() * src.length)], ftx = -f.nz, ftz = f.nx, fl = Math.hypot(ftx, ftz) || 1;
      const u = (R() - 0.5) * 0.04, v = (R() - 0.5) * 0.04;
      const x = f.x + (ftx / fl) * u - f.nx * 0.006, y = f.y + v * Math.hypot(f.nx, f.nz) - f.ny * 0.006, z = f.z + (ftz / fl) * u - f.nz * 0.006;
      if (blocks.some((b) => b !== f.b && inBlock(b, x, y, z, 0.98))) continue;
      L2.polyp.push({ p: new THREE.Vector3(x, y, z), q: orient$1(f.nx, f.ny, f.nz, 0.25, R() * 6.28), s: sv(0.85 + R() * 0.5) });
    }
  };
  const _m = new THREE.Matrix4(), _n = new THREE.Vector3(), _v = new THREE.Vector3(), _nm = new THREE.Matrix3();
  const addAxi = (e, h, carry = R() < 0.5) => {
    const y = C(), p = P(e, 0.01), qq = orient$1(e.nx, e.ny, e.nz, 0.7, R() * 6.28), s = sv(h / 0.25);
    if (!clearOf(p, qq, h, 0)) return false;
    c.setRGB(lerp$4(0.72, 0.8, y), lerp$4(0.4, 0.52, y), lerp$4(0.1, 0.14, y));
    L2.axi.push({ p, q: qq, s, c: c.clone() });
    if (carry && axi.length) {
      _m.compose(p, qq, s);
      _nm.getNormalMatrix(_m);
      for (let i = 0; i < 34; i++) {
        const a = axi[Math.floor(R() * axi.length)];
        _v.copy(a.p).applyMatrix4(_m); _n.copy(a.n).applyMatrix3(_nm).normalize();
        L2.polyp.push({ p: _v.clone(), q: orient$1(_n.x, _n.y, _n.z, 0, R() * 6.28), s: sv(0.55 + R() * 0.3) });
      }
    }
  };
  const axiClump = (e, n, carry = R() < 0.5) => {
    addAxi(e, 0.15 + R() * 0.12, carry);
    const nb = pts.filter((f) => f.b === e.b && Math.hypot(f.x - e.x, f.y - e.y, f.z - e.z) < 0.3 && f.nx * e.nx + f.ny * e.ny + f.nz * e.nz > 0.5);
    for (let i = 1; i < n && nb.length; i++) addAxi(nb[Math.floor(R() * nb.length)], 0.08 + R() * 0.14, R() < 0.3);
  };
  const addMyr = (e) => {
    const t = 0.9 + C() * 0.2;
    c.setRGB(0.8 * t, 0.28 * t * (0.9 + C() * 0.2), 0.1 * t);
    L2.myr.push({ p: P(e, 0.008), q: orient$1(e.nx, e.ny, e.nz, e.f === 'under' ? 0.05 : 0.3, R() * 6.28), s: sv((0.06 + R() * 0.06) / 0.09), c: c.clone() });
  };
  const addStar = (e, s = 0.8 + R() * 0.7) => {
    L2.star.push({ p: P(e, -5e-3), q: orient$1(e.nx, e.ny, e.nz, 0.1, R() * 6.28), s: sv(s), c: new THREE.Color(0.85, 0.2 + C() * 0.05, 0.08) });
  };
  const shadeOK = (e) => e.dim && (e.f === 'wall' || e.f === 'under') && e.hB > 0.2 && (e.seen > 0.1 || e.f === 'under');

  const kSeen = knoll.filter((e) => e.seen > -0.1), kFace = knoll.filter((e) => e.seen > 0.35);
  {
    const brink = kSeen.filter((e) => (e.f === 'brink' || e.f === 'wall') && e.lit && e.hB > 0.4);
    for (let k = 0, t0 = 0; k < 2 && t0 < 40 && brink.length; t0++) {
      const c0 = brink[Math.floor(R() * brink.length)];
      if (!cavKnot(c0)) continue;
      k++;
      const near = brink.filter((e) => Math.hypot(e.x - c0.x, e.y - c0.y, e.z - c0.z) < 0.4 && e.nx * c0.nx + e.ny * c0.ny + e.nz * c0.nz > 0.5 && !brinkLine(e));
      for (let i = 0, t = 0; i < 4 && t < 30 && near.length; t++) if (addCav(near[Math.floor(R() * near.length)], 0.14 + R() * 0.18) !== false) i++;
    }
  }
  const kFront = kFace.filter((e) => (e.f === 'wall' || e.f === 'brink' || e.f === 'under') && e.hB > 0.25 && e.hB < 1.0);
  for (let k = 0, t = 0; k < 2 && t < 30 && kFront.length; t++) { const e = kFront[Math.floor(R() * kFront.length)]; if (addFan(e, 0.5 + R() * 0.3) !== false) { grove(e, 3, 0.4); k++; } }
  sow(kFace, 24, (e) => (e.f === 'wall' || e.f === 'under' || (e.f === 'brink' && e.seen > 0.55)) && e.hB > 0.3, (e) => { if (addFan(e, 0.42 + R() * 0.38) === false) return false; grove(e, 3, 0.4); });
  const kShade = knoll.filter(shadeOK);
  for (let k = 0, t = 0; k < 3 && t < 40 && kShade.length; t++) { const e = kShade[Math.floor(R() * kShade.length)]; if (e.pz > 0.25) { mat(e, 70, 0.4, 0.18); k++; } }
  sow(kShade, 2, () => true, (e) => axiClump(e, 3 + Math.floor(R() * 3)));
  sow(kShade, 5, () => true, addMyr);

  {
    const rub = pts.filter((e) => kind(e) === 'rubble'), pick = (a) => a[Math.floor(R() * a.length)];
    const near = rub.filter((e) => e.seen > 0.2 && e.hB > 0.05 && e.f !== 'top'), top = rub.filter((e) => e.f === 'top' || e.f === 'brink');
    if (near.length) {
      mat(pick(near), 45, 0.3, 0.12);
      axiClump(pick(near), 3 + Math.floor(R() * 3), true);
      for (let k = 0; k < 3; k++) addMyr(pick(near));
    }
    if (top.length) {
      addStar(pick(top));
      for (let k = 0; k < 3; k++) { const e = pick(top); L2.pad.push({ p: P(e, 0.012), q: orient$1(e.nx, e.ny, e.nz, 0.4, R() * 6.28), s: sv(0.7 + R() * 0.45), c: new THREE.Color(0.92 + C() * 0.1, 0.92 + C() * 0.1, 0.86 + C() * 0.1) }); }
    }
    const kn = blocks.find((b) => b.kind === 'knoll' && b.part === 'base'), back = kn ? rub.filter((e) => e.f !== 'foot' && e.hB > 0.08 && Math.hypot(e.x - kn.x, e.z - kn.z) < Math.max(kn.sx, kn.sz) + 0.9) : [];
    for (let k = 0, t = 0; k < 3 && t < 30 && back.length; t++) if (addFan(pick(back), 0.34 + R() * 0.16) !== false) k++;
    for (let k = 0, t = 0; k < 2 && t < 20 && back.length; t++) if (addCav(pick(back), 0.13 + R() * 0.12) !== false) k++;
  }

  let si = 0;
  for (const o of LAYOUT.reef) {
    if (o.kind !== 'stone') continue;
    const mine = stones.filter((e) => e.o === o), seen = mine.filter((e) => e.seen > 0.2 && e.hB > 0.12 && e.f !== 'top');
    if (!mine.length) continue;
    const pick = (a) => a[Math.floor(R() * a.length)];
    const r = (si + Math.floor(R() * 3)) % 3;
    if (seen.length) {
      if (r === 0) { mat(pick(seen), 55, 0.32, 0.14); axiClump(pick(seen), 3 + Math.floor(R() * 2), true); addMyr(pick(seen)); }
      else if (r === 1) { axiClump(pick(seen), 3 + Math.floor(R() * 4)); mat(pick(seen), 30, 0.2, 0.1); }
      else { for (let k = 0; k < 3; k++) addMyr(pick(seen)); mat(pick(seen), 40, 0.26, 0.12); }
    }
    const top = mine.filter((e) => e.f === 'top' && e.lit);
    for (let k = 0; k < 2 && top.length; k++) { const e = pick(top); L2.pad.push({ p: P(e, 0.012), q: orient$1(e.nx, e.ny, e.nz, 0.4, R() * 6.28), s: sv(0.75 + R() * 0.5), c: new THREE.Color(0.92 + C() * 0.1, 0.92 + C() * 0.1, 0.86 + C() * 0.1) }); }
    if ((si + Math.floor(C() * 3)) % 3 === 0) {
      if (top.length && R() < 0.5) addStar(pick(top));
      else {
        const b = mine[0].b, v = reefView(b), a = Math.atan2(v.z - b.z, v.x - b.x) + (R() - 0.5) * 1.2, d = Math.max(b.sx, b.sz) * 1.1 + 0.2;
        const x = b.x + Math.cos(a) * d, z = b.z + Math.sin(a) * d;
        L2.star.push({ p: new THREE.Vector3(x, floorHeight(x, z) + 0.004, z), q: new THREE.Quaternion().setFromAxisAngle(Y$1, R() * 6.28), s: sv(0.9 + R() * 0.5), c: new THREE.Color(0.85, 0.22, 0.08) });
      }
    }
    si++;
  }

  const both = (nL, nB, ok, fn) => { sow(walls, nL, ok, fn); sow(bow, nB, ok, fn); };
  both(84, 16, (e) => (e.f === 'wall' || e.f === 'under') && e.hB > 0.35 && (e.seen > 0.2 || R() < 0.35), (e) => { if (addFan(e, fanH()) === false) return false; grove(e, 3, 0.55); });
  sow(pts.filter((e) => e.o.name === 'archL'), 22, (e) => ((e.f === 'wall' && e.hB < 3.8) || e.f === 'under') && e.hB > 0.6, (e) => { if (addFan(e, fanH()) === false) return false; grove(e, 3, 0.55); });
  const fpts = pts.filter((e) => e.o.name === 'archN' || e.o.name === 'stackL');
  sow(pts.filter((e) => e.o.name === 'archN'), 26, (e) => ((e.f === 'wall' && e.hB < 3.6) || e.f === 'under') && e.hB > 0.4, (e) => { if (addFan(e, fanH()) === false) return false; grove(e, 3, 0.5); });
  sow(pts.filter((e) => e.o.name === 'stackL'), 18, (e) => (e.f === 'wall' || e.f === 'under') && e.hB > 0.45 && e.hB < 4.6, (e) => { if (addFan(e, 0.45 + R() * 0.4) === false) return false; grove(e, 2, 0.42); });
  sow(fpts, 5, (e) => (e.f === 'wall' || e.f === 'under' || e.foot) && e.hB < 2.2 && e.hB > 0.1, (e) => axiClump(e, 3 + Math.floor(R() * 3)));
  sow(fpts, 18, (e) => (e.f === 'wall' || e.f === 'under') && e.hB < 2.4 && e.hB > 0.1, addMyr);
  {
    const fz = fpts.filter((e) => e.pz > 0.3 && e.hB < 2.5);
    for (let k = 0, t = 0; k < Math.round(5 * q) && t < 120 && fz.length; t++) {
      const e = fz[Math.floor(R() * fz.length)];
      if (L2.polyp.some((p) => Math.abs(p.p.x - e.x) + Math.abs(p.p.y - e.y) + Math.abs(p.p.z - e.z) < 0.6)) continue;
      mat(e, 60, 0.45, 0.2);
      k++;
    }
  }
  both(8, 3, (e) => (e.f === 'brink' || e.f === 'wall') && e.lit && e.hB > 0.5, (e) => {
    if (!cavKnot(e)) return false;
    if (addCav(e, 0.2 + R() * 0.24) === false) { knots.pop(); return false; }
    const nb = (byO.get(e.o) || []).filter((f) => f.lit && (f.f === 'brink' || f.f === 'wall') && Math.hypot(f.x - e.x, f.y - e.y, f.z - e.z) < 0.5
      && f.nx * e.nx + f.ny * e.ny + f.nz * e.nz > 0.5 && !brinkLine(f));
    for (let i = 0, t = 0; i < 2 + Math.floor(R() * 2) && t < 12 && nb.length; t++) if (addCav(nb[Math.floor(R() * nb.length)], 0.14 + R() * 0.18) !== false) i++;
  });
  const addSing = (e, h) => {
    if (!room(e, h * 0.6)) return false;
    const p = P(e, 0.015), qq = orient$1(e.nx, e.ny, e.nz, 0.8, flowYaw(e));
    if (!clearOf(p, qq, h, 0)) return false;
    gorg.push({ x: e.x, y: e.y, z: e.z, h: h * 0.6 });
    const t = 0.94 + C() * 0.12;
    L2.sing.push({ p, q: qq, s: sv(h / 0.45), c: new THREE.Color(t, t, t * (0.97 + C() * 0.05)) });
  };
  both(5, 2, (e) => e.f === 'top' && e.ny < 0.93 && e.lit, (e) => {
    if (addSing(e, 0.25 + R() * 0.3) === false) return false;
    const nb = (byO.get(e.o) || []).filter((f) => f.f === 'top' && f.lit && Math.hypot(f.x - e.x, f.y - e.y, f.z - e.z) < 0.6);
    for (let i = 0, t = 0; i < 1 + Math.floor(R() * 3) && t < 12 && nb.length; t++) if (addSing(nb[Math.floor(R() * nb.length)], 0.18 + R() * 0.25) !== false) i++;
  });
  {
    const pzs = walls.filter((e) => e.pz > 0.35 && Math.hypot(e.x - LD.x, e.z - LD.z) < 10);
    for (let k = 0, t = 0; k < Math.round(9 * q) && t < 200 && pzs.length; t++) {
      const e = pzs[Math.floor(R() * pzs.length)];
      if (L2.polyp.some((p) => Math.abs(p.p.x - e.x) + Math.abs(p.p.y - e.y) + Math.abs(p.p.z - e.z) < 0.5)) continue;
      mat(e, 60, 0.45, 0.2);
      k++;
    }
  }
  both(6, 2, shadeOK, (e) => axiClump(e, 3 + Math.floor(R() * 4)));
  both(22, 4, shadeOK, addMyr);
  both(5, 1, (e) => (e.f === 'top' || e.f === 'brink') && e.lit, (e) => {
    const s = 0.8 + R() * 0.6;
    L2.apl.push({ p: P(e, 0.02), q: orient$1(e.nx, e.ny, e.nz, 0.55, R() * 6.28), s: sv(s), c: new THREE.Color(0.74, 0.66 + 0.08 * C(), 0.7) });
  });
  both(6, 2, (e) => e.f === 'top' || e.f === 'brink' || (e.f === 'wall' && R() < 0.3), (e) => addStar(e));
  both(14, 4, (e) => (e.foot && e.ny < 0.55 && e.ny > -0.4) || e.f === 'wall', (e) => {
    const col = e.f === 'wall' && !e.foot ? [0.08, 0.05, 0.1] : C() < 0.3 ? [0.42, 0.14, 0.46] : [0.36, 0.07, 0.42];
    L2.urchin.push({ p: P(e), q: orient$1(e.nx, e.ny, e.nz, 0.2, R() * 6.28), s: sv(0.75 + R() * 0.6), c: new THREE.Color(...col) });
  });
  both(4, 1, (e) => e.f === 'top', (e) => { L2.anem.push({ p: P(e, 0.01), q: orient$1(e.nx, e.ny, e.nz, 0.6, R() * 6.28), s: sv(1.0 + R() * 0.9) }); });
  const tint = (a, b) => new THREE.Color(a + C() * b, a + C() * b, a - 0.05 + C() * b);
  const litTop = (e) => e.f === 'top' && e.lit;
  both(14, 4, litTop, (e) => { L2.pad.push({ p: P(e, 0.012), q: orient$1(e.nx, e.ny, e.nz, 0.35, R() * 6.28), s: sv(0.75 + R() * 0.5), c: tint(0.9, 0.2) }); });
  both(10, 3, litTop, (e) => { L2.aceta.push({ p: P(e, 0.005), q: orient$1(e.nx, e.ny, e.nz, 0.6, R() * 6.28), s: sv(0.8 + R() * 0.5), c: tint(0.9, 0.2) }); });
  both(6, 2, litTop, (e) => { L2.cysto.push({ p: P(e, 0.015), q: orient$1(e.nx, e.ny, e.nz, 0.8, R() * 6.28), s: sv(0.8 + R() * 0.6), c: tint(0.85, 0.28) }); });
  both(14, 4, (e) => (e.f === 'wall' && e.dim) || e.foot, (e) => { L2.hali.push({ p: P(e, 0.01), q: orient$1(e.nx, e.ny, e.nz, 0.5, R() * 6.28), s: sv(0.8 + R() * 0.6), c: tint(0.88, 0.24) }); });
  sow(knoll.filter(litTop), 5, () => true, (e) => { L2.pad.push({ p: P(e, 0.012), q: orient$1(e.nx, e.ny, e.nz, 0.35, R() * 6.28), s: sv(0.75 + R() * 0.5), c: tint(0.9, 0.2) }); });
  for (const k in L2) if (k !== 'keep') for (const it of L2[k]) it.tile = 'reef';
  return L2;
}

class World {
  constructor(scene, { quality = 1, seed = null, detail = 1, terrain = 1 } = {}) {
    const q = clamp$9(Number.isFinite(+quality) ? +quality : 1, 0.2, 2);
    ROCK_DETAIL = clamp$9(+detail || 1, 0.5, 1);
    TER_K = clamp$9(+terrain || 1, 1, 2);
    const ms = (this.ms = {});
    let lapT = performance.now();
    const lap = (k) => { const n = performance.now(); ms[k] = Math.round(n - lapT); lapT = n; };
    this.seed = seed !== null && Number.isFinite(+seed) ? +seed >>> 0 : (Math.random() * 4294967296) >>> 0;
    console.info('world seed', this.seed);
    setVarySeed(this.seed);
    this.finds = LAYOUT.frags.map((f) => ({ x: +f.x.toFixed(3), z: +f.z.toFixed(3) }));
    const rng = varyRng(2026);
    this.group = new THREE.Group();
    scene.add(this.group);
    const add = (m) => { this.group.add(m); return m; };

    const tex = makeNoiseTextures();
    WU.uTexA.value = tex.A;
    WU.uTexB.value = tex.B;
    WU.uTexC.value = tex.C;
    WU.uGk.value.copy(tex.gk);

    const plan = withBaseFinds(() => planRocks(makeRng$1(2026)));
    {
      const vr = varyRng(0x70c4);
      for (const p of plan) {
        p.o1 += vr() * 40; p.o2 += vr() * 40;
        const dist = p.far || p.mid, round = Math.abs(p.sx - p.sz) < 0.15 * Math.max(p.sx, p.sz);
        const turn = (vr() - 0.5) * (dist ? 1.2 : 0.5);
        if (dist || round) p.yaw += turn;
        if (dist) p.sy *= 0.92 + vr() * 0.16;
      }
    }
    const reefPlan = planReef(makeRng$1(this.seed ^ 0x5eef01));
    const solid = plan.concat(reefPlan);
    const arch = planArch();
    const forms = (LAYOUT.formations || []).map((o) => planForm(o));
    archLights(forms, arch, q);
    const boulders = planBoulders(plan, { spheres: arch.spheres.concat(...forms.map((f) => f.spheres)) }, q, solid);
    const boulders0 = boulders.slice();
    lap('rockPlan');
    const bed = planBed(makeRng$1(this.seed ^ 0xbed101), solid, arch, forms, boulders0, q);
    boulders.push(...bed.boulders);
    lap('bed');
    const occl = solid.map((p) => (p.far || p.mid ? { x: p.x, y: -999, z: p.z, r: 0.01, foot: 0.01 } : { x: p.x, y: p.y + p.r * p.sy * 0.3, z: p.z, r: 0.5 * (p.sx + p.sz) * 0.85, foot: 0.5 * (p.sx + p.sz) * 0.95 }));
    for (const s of arch.spheres) occl.push({ x: s.x, y: s.y, z: s.z, r: s.r * 1.05, foot: 1.5 });
    for (const f of forms) for (const s of f.spheres) occl.push({ x: s.x, y: s.y, z: s.z, r: s.r * 1.05, foot: s.r * 1.1 });
    for (const b of boulders) if (b.s > 0.5) occl.push({ x: b.x, y: b.y + b.sy * 0.3, z: b.z, r: b.s * 0.8, foot: b.s * 0.85 });

    lap('plan');
    const ter = buildTerrain$1(occl, bed.patches);
    lap('terrain');
    this.terrain = add(ter.mesh);
    const grid = ter.grid;

    const rocks = buildRocks(solid, arch, grid, occl, forms);
    lap('rocks');
    ms.rockStages = rocks.ms;
    add(rocks.mesh);
    if (rocks.formMesh) add(rocks.formMesh);
    if (rocks.midMesh) add(rocks.midMesh);
    if (rocks.farMesh) add(rocks.farMesh);
    this.obstacles = rocks.obstacles;
    this.reefSpots = rocks.reefSpots;
    const tops = rocks.tops, sides = rocks.sides;
    const stride = Math.max(1, Math.round((tops.length + sides.length) / 4000));
    const strip = (e) => ({ x: e.x, y: e.y, z: e.z, nx: e.nx, ny: e.ny, nz: e.nz });
    const every = (a) => a.filter((_, i) => i % stride === 0).map(strip);
    this.rockTops = every(tops).concat(every(rocks.reefTops));
    this.rockSides = every(sides).concat(every(rocks.reefSides));
    this.reef = reefPlan.map((p) => ({ name: p.reef.name, kind: p.kind, part: p.part, x: +p.x.toFixed(2), z: +p.z.toFixed(2), sx: +p.sx.toFixed(2), sz: +p.sz.toFixed(2), h: +(p.r * p.sy).toFixed(2), top: +p.top.toFixed(2), yaw: +p.yaw.toFixed(3) }));

    {
      const items = boulders.map((b) => ({
        p: new THREE.Vector3(b.x, b.y, b.z), q: b.q, s: new THREE.Vector3(b.s, b.sy, b.s),
        c: new THREE.Color(b.tint, b.tint * 0.98, b.tint * 0.95),
      }));
      const bGeo = scatterRockGeometry(31337, 9, 2), bMat = scatterRockMaterial('scatrock', 85);
      add(makeInstanced(bGeo, bMat, items.slice(0, boulders0.length), { cast: true }));
      if (items.length > boulders0.length) add(makeInstanced(scatterRockGeometry(31337, 4, 2), bMat, items.slice(boulders0.length), { cast: false })).name = 'bed-boulders';
      add(makeInstanced(scatterRockGeometry(4711, 3, 0), scatterRockMaterial('scatrock', 54), planCobbles(plan, boulders0, grid, q, solid), { cast: false }));
      const nearW = (x, z, r) => Math.hypot(x - LAYOUT.wreck.x, z - LAYOUT.wreck.z) < r;
      const keep = (e) => ({ x: e.x, y: e.y, z: e.z, nx: e.nx, ny: e.ny, nz: e.nz, hB: e.hB });
      const own = (e) => e.b && (e.b.kind === 'knoll' || e.b.kind === 'stone' || e.b.kind === 'rubble' || Math.hypot(e.x - LAYOUT.landing.x, e.z - LAYOUT.landing.z) < 8);
      HARD.tops = tops.concat(rocks.reefTops.filter((e) => !own(e))).filter((e) => e.ny > 0.8 && e.hB > 0.2 && nearW(e.x, e.z, 40)).map(keep);
      HARD.sides = sides.concat(rocks.reefSides.filter((e) => !own(e))).filter((e) => e.ny > -0.1 && e.ny < 0.45 && e.hB > 0.15 && nearW(e.x, e.z, 40)).map(keep);
      const BP = bGeo.attributes.position, BN = bGeo.attributes.normal, upIdx = [];
      for (let i = 0; i < BP.count; i++) if (BN.getY(i) > 0.85 && BP.getY(i) > 0.2) upIdx.push(i);
      const bm = new THREE.Matrix4(), nm = new THREE.Matrix3(), bv = new THREE.Vector3(), bn = new THREE.Vector3(), br = varyRng(6161);
      HARD.boulders.length = 0;
      HARD.rock = rocks.stand;
      HARD.boulderGeo = bGeo;
      boulders.forEach((b, bi) => {
        bm.compose(new THREE.Vector3(b.x, b.y, b.z), b.q, new THREE.Vector3(b.s, b.sy, b.s));
        let top = b.y + b.sy * 0.5;
        for (const i of upIdx) { bv.fromBufferAttribute(BP, i).applyMatrix4(bm); if (bv.y > top) top = bv.y; }
        HARD.boulders.push({ x: b.x, y: b.y, z: b.z, s: b.s, sy: b.sy, top, m: bm.clone() });
        if (b.s < 0.45 || !nearW(b.x, b.z, 34) || !upIdx.length) return;
        nm.getNormalMatrix(bm);
        for (let k = 0; k < 6; k++) {
          const i = upIdx[Math.floor(br() * upIdx.length)];
          bv.fromBufferAttribute(BP, i).applyMatrix4(bm);
          bn.fromBufferAttribute(BN, i).applyMatrix3(nm).normalize();
          HARD.boulderTops.push({ x: bv.x, y: bv.y, z: bv.z, nx: bn.x, ny: bn.y, nz: bn.z, s: b.s, b: bi });
        }
      });
    }

    const blockers = solid.map((p) => ({ x: p.x, z: p.z, r2: (0.5 * (p.sx + p.sz) * 1.05) ** 2 }));
    for (const s of [arch.spheres[0], arch.spheres[8]]) blockers.push({ x: s.x, z: s.z, r2: 1.9 * 1.9 });
    for (const f of forms) for (const s of f.feet) blockers.push({ x: s.x, z: s.z, r2: (s.r * 1.2) ** 2 });
    for (const b of boulders) blockers.push({ x: b.x, z: b.z, r2: (b.s * 0.95) ** 2 });
    const blockers0 = blockers.slice(0, blockers.length - bed.boulders.length);

    lap('boulders');
    const bedR = realiseBed(bed, grid, blockers, q);
    if (bedR.stones.length) add(makeInstanced(scatterRockGeometry(5813, 1, 0), scatterRockMaterial('scatrock', 30), bedR.stones, { cast: false })).name = 'bed-rubble';
    this.bed = { patches: bed.patches.length, boulders: bed.boulders.length, stones: bedR.stones.length, maerl: bedR.maerl.length, shoots: bedR.shoots.length, cysto: bedR.cysto.length, sponges: bedR.apl.length, why: bed.why, list: bed.patches.map((p) => [p.kind[0], +p.x.toFixed(1), +p.z.toFixed(1), +p.r.toFixed(1)]) };
    add(buildPosidonia(rng, q, grid, blockers, bedR.shoots));
    lap('posidonia');

    const pick = (arr) => arr[Math.floor(rng() * arr.length)];
    const or = (a, b) => (a.length ? a : b);
    const sunTops = or(tops.filter((p) => p.ny > 0.72 && p.y > -30), tops);
    const shade = or(sides.filter((p) => p.ny < 0.3), sides);
    const low = or([...tops, ...sides].filter((p) => p.hB < 0.6 && p.ny > -0.2), sides);
    const c = new THREE.Color();
    const axiGeo = axinellaGeometry(121), axiPts = [];
    {
      const AP = axiGeo.attributes.position, AN = axiGeo.attributes.normal;
      for (let i = 0; i < AP.count; i += 3) if (AP.getY(i) > 0.03) axiPts.push({ p: new THREE.Vector3().fromBufferAttribute(AP, i), n: new THREE.Vector3().fromBufferAttribute(AN, i) });
    }
    const RL = placeReefLife(rocks.reef, reefPlan.concat(forms.map((f) => f.solid)), axiPts, makeRng$1(this.seed ^ 0x5eef02), makeRng$1(this.seed ^ 0x5eef03), q, U.uSunW.value, (x, z) => grid.height(x, z));
    lap('reefLife');
    this.obstacles.push(...RL.keep);
    {
      const BR = makeRng$1(this.seed ^ 0x5eef07), BC = makeRng$1(this.seed ^ 0x5eef08), byB = new Map();
      for (const t of HARD.boulderTops) { let a = byB.get(t.b); if (!a) byB.set(t.b, (a = [])); a.push(t); }
      const tintB = () => new THREE.Color(0.9 + BC() * 0.2, 0.9 + BC() * 0.2, 0.85 + BC() * 0.2);
      for (const [bi, ts] of byB) {
        const b = boulders[bi], dl = Math.hypot(b.x - LAYOUT.landing.x, b.z - LAYOUT.landing.z);
        if (!b || nearFinds(b.x, b.z, 1.2) || dl < 3.5) continue;
        const pk = () => ts[Math.floor(BR() * ts.length)];
        for (let k = 0, n = b.bed ? Math.floor(BR() * 1.6) : 1 + Math.floor(BR() * 3); k < n; k++) { const e = pk(); RL.pad.push({ p: new THREE.Vector3(e.x, e.y - 0.012, e.z), q: orient$1(e.nx, e.ny, e.nz, 0.35, BR() * 6.28), s: sv(0.7 + BR() * 0.5), c: tintB(), tile: 'reef' }); }
        for (let k = 0, n = Math.floor(BR() * (b.bed ? 1.7 : 3)); k < n; k++) { const e = pk(); RL.hali.push({ p: new THREE.Vector3(e.x, e.y - 0.01, e.z), q: orient$1(e.nx, e.ny, e.nz, 0.5, BR() * 6.28), s: sv(0.8 + BR() * 0.6), c: tintB(), tile: 'reef' }); }
        if (b.bed && BR() < 0.4) {
          for (let k = 0, n = 1 + Math.floor(BR() * 2); k < n; k++) {
            const e = pk(), h = 0.14 + BR() * 0.14, wk = 0.8 + BR() * 0.5, qq = fanFrame(e.nx, Math.max(0.35, e.ny), e.nz, SURGE_YAW + (BR() - 0.5) * 0.9, (BR() - 0.5) * 0.4, false, 0.4);
            RL.cav.push(Object.assign({ p: new THREE.Vector3(e.x, e.y - 0.02, e.z), q: qq, s: new THREE.Vector3((h * wk) / 0.4, h / 0.4, (h * wk) / 0.4), tile: 'reef' }, fanColours(BC, BED_CAV)));
          }
        }
        if (BR() < 0.15) { const e = pk(); RL.star.push({ p: new THREE.Vector3(e.x, e.y + 0.005, e.z), q: orient$1(e.nx, e.ny, e.nz, 0.1, BR() * 6.28), s: sv(0.8 + BR() * 0.6), c: new THREE.Color(0.85, 0.2 + BC() * 0.05, 0.08), tile: 'reef' }); }
        if (!b.bed && b.s > 0.6 && BR() < 0.34) {
          for (let k = 0, n = 1 + Math.floor(BR() * 2); k < n; k++) {
            const e = pk(), h = 0.35 + BR() * 0.35, wk = 0.8 + BR() * 0.5, qq = fanFrame(e.nx, e.ny, e.nz, SURGE_YAW + (BR() - 0.5) * 0.9, (BR() - 0.5) * 0.35);
            const p = new THREE.Vector3(e.x, e.y - 0.02, e.z), sh = Math.floor(BR() * 3), cols = fanColours(BC);
            _fy.set(0, 1, 0).applyQuaternion(qq);
            const ball = { x: p.x + _fy.x * h * 0.55, y: p.y + _fy.y * h * 0.55, z: p.z + _fy.z * h * 0.55, r: Math.max(0.2, h * 0.6) + 0.05, fan: true };
            if (!siteWayClear(ball.x, ball.y - ball.r - floorHeight(ball.x, ball.z), ball.z, ball.r)) continue;
            RL['fan' + sh].push(Object.assign({ p, q: qq, s: new THREE.Vector3((h * wk) / 0.95, h / 0.95, (h * wk) / 0.95), tile: 'reef' }, cols));
            this.obstacles.push(ball);
          }
        }
      }
    }
    {
      const NR = makeRng$1(this.seed ^ 0x5eef09), NC = makeRng$1(this.seed ^ 0x5eef0a), from = [LAYOUT.landing, LAYOUT.landing, LAYOUT.frags[1]];
      const tintN = () => new THREE.Color(0.9 + NC() * 0.2, 0.9 + NC() * 0.2, 0.85 + NC() * 0.2);
      LAYOUT.frags.forEach((f, i) => {
        const a0 = Math.atan2(f.z - from[i].z, f.x - from[i].x);
        for (let k = 0; k < 8; k++) {
          const a = a0 + (NR() - 0.5) * 2.2, d = 1.3 + NR() * 1.0, x = f.x + Math.cos(a) * d, z = f.z + Math.sin(a) * d, y = floorHeight(x, z);
          if (k < 4) RL.pad.push({ p: new THREE.Vector3(x, y - 0.008, z), q: orient$1(0, 1, 0, 0.35, NR() * 6.28), s: sv(0.7 + NR() * 0.5), c: tintN(), tile: 'reef' });
          else if (k < 7) RL.hali.push({ p: new THREE.Vector3(x, y - 0.006, z), q: orient$1(0, 1, 0, 0.5, NR() * 6.28), s: sv(0.75 + NR() * 0.5), c: tintN(), tile: 'reef' });
          else RL.star.push({ p: new THREE.Vector3(x, y + 0.004, z), q: new THREE.Quaternion().setFromAxisAngle(Y$1, NR() * 6.28), s: sv(0.9 + NR() * 0.4), c: new THREE.Color(0.85, 0.2 + NC() * 0.05, 0.08), tile: 'reef' });
        }
      });
    }
    RL.pad.push(...bedR.pad.filter((_, i) => i % 2 === 0));
    RL.hali.push(...bedR.hali.filter((_, i) => i % 2 === 0));
    RL.star.push(...bedR.star);
    RL.cysto.push(...bedR.cysto);
    RL.apl.push(...bedR.apl.slice(0, Math.max(0, 150 - Math.floor(110 * q) - RL.apl.length)));
    this.reefLife = Object.fromEntries(Object.entries(RL).map(([k, v]) => [k, v.length]));
    this.reefMeshes = [];
    const reefAdd = (m) => { this.reefMeshes.push(m); return add(m); };

    {
      const FAN_VDECL = 'attribute float aT;\nattribute float aH;\nattribute float aW;\nattribute float aFz;\nattribute vec3 aFa;\nattribute vec2 aFo;\nattribute vec3 aC0;\nattribute vec4 aC1;\n';
      const FAN_VARY = 'varying float vFz;\nvarying vec3 vFa;\nvarying float vFe;\nvarying float vT;\nvarying vec3 vC0;\nvarying vec4 vC1;\n';
      const vb = plantVert('aH', 0.35, 64, FAN_WIDEN, true);
      const mat = new THREE.MeshStandardMaterial({ roughness: 0.8, metalness: 0, envMapIntensity: 0.25, side: THREE.DoubleSide, alphaToCoverage: true });
      worldMaterial(mat, 'fan', {
        vDecl: FAN_VDECL + FAN_VARY, vBegin: vb, fDecl: FAN_VARY,
        fColor: FAN_FCOLOR + FAN_FLUO, fLights: FLUO_LIGHTS + PIG_WB, fEmissive: FLUO_AMBIENT, fAO: FAN_SPEC, fNormal: FAN_FAR_NORMAL,
      });
      swayDepthMaterial('fan', FAN_VDECL, plantVert('aH', 0.35, 64, FAN_WIDEN_DEPTH, true));
      const pal = [['aC0', 3, (it) => it.c0], ['aC1', 4, (it) => it.c1]];
      const srcs = or(sides.filter((p) => p.y > -40 && p.hB > 0.3), or(sides.filter((p) => p.y > -40), tops));
      const far = RL.fanFar.slice(), FC = makeRng$1(this.seed ^ 0x5eef04), FR = makeRng$1(this.seed ^ 0x5eef06);
      const _fu = new THREE.Vector3(), _fa = new THREE.Vector3(), _ft = new THREE.Vector3();
      const FAN_PTS = [[0.15, 0], [0.3, 0], [0.5, 0], [0.7, 0], [0.9, 0], [0.22, -0.4], [0.22, 0.4], [0.32, -0.65], [0.32, 0.65], [0.42, -0.9], [0.42, 0.9],
        [0.55, -0.85], [0.55, 0.85], [0.7, -0.9], [0.7, 0.9], [0.85, -0.7], [0.85, 0.7]];
      const at = (e) => new THREE.Vector3(e.x, e.y, e.z).addScaledVector(_fy.set(e.nx, e.ny, e.nz).normalize(), -0.02);
      const nearB = [], archR = 3.9 + 1.35 * 2.4 + 1.5;
      const fanClear = (p, qq, h) => {
        _fu.set(0, 1, 0).applyQuaternion(qq); _fa.set(1, 0, 0).applyQuaternion(qq);
        nearB.length = 0;
        for (const b of solid) if (Math.hypot(b.x - p.x, b.z - p.z) < Math.max(b.sx, b.sz, b.r * b.sy) * 1.4 + h) nearB.push(b);
        const nearA = Math.hypot(arch.ax - p.x, arch.az - p.z) < archR + h;
        for (const [f, u] of FAN_PTS) {
          _ft.copy(p).addScaledVector(_fu, h * f).addScaledVector(_fa, 0.5 * h * u);
          if ((nearA && inArch(arch, _ft.x, _ft.y, _ft.z, 1.02)) || nearB.some((b) => inBlock(b, _ft.x, _ft.y, _ft.z, 1.02, true))) return false;
        }
        return true;
      };
      for (let i = 0; i < Math.floor(80 * q); i++) {
        let sp = pick(srcs);
        const yaw = SURGE_YAW + (rng() - 0.5) * 0.52, lean = (rng() - 0.5) * 0.35;
        if (rng() >= 0.3) { rng(); rng(); }
        const s = 0.7 + rng() * 0.6;
        let p = at(sp), qq = fanFrame(sp.nx, sp.ny, sp.nz, yaw, lean), ok = fanClear(p, qq, 0.95 * s);
        for (let t = 0; t < 24 && !ok; t++) {
          sp = srcs[Math.floor(FR() * srcs.length)];
          p = at(sp); qq = fanFrame(sp.nx, sp.ny, sp.nz, yaw, lean); ok = fanClear(p, qq, 0.95 * s);
        }
        const it = Object.assign({ p, q: qq, s: sv(s) }, fanColours(FC));
        if (ok && hashI(i, 11, 5) > 0.3) far.push(it);
      }
      const grovesF = [], GR = makeRng$1(this.seed ^ 0x5eef06), cellG = new Map(), gk = (x, z) => `${Math.floor(x / 1.5)},${Math.floor(z / 1.5)}`;
      const gsrc = srcs.filter((p) => Math.hypot(p.x - LAYOUT.landing.x, p.z - LAYOUT.landing.z) > 12 && Math.hypot(p.x - LAYOUT.landing.x, p.z - LAYOUT.landing.z) < 42 && !nearFinds(p.x, p.z, 1.0));
      for (const p of gsrc) { const k = gk(p.x, p.z); let a = cellG.get(k); if (!a) cellG.set(k, (a = [])); a.push(p); }
      for (let g = 0; g < (q < 0.6 ? 0 : Math.floor(22 * q)) && gsrc.length; g++) {
        const c0 = gsrc[Math.floor(GR() * gsrc.length)], hl0 = Math.hypot(c0.nx, c0.nz) || 1;
        const nb = (cellG.get(gk(c0.x, c0.z)) || []).filter((p) => p.nx * c0.nx + p.nz * c0.nz > 0.5 * hl0 * (Math.hypot(p.nx, p.nz) || 1));
        const yaw0 = SURGE_YAW + (GR() - 0.5) * 0.8;
        for (let k = 0, n = 5 + Math.floor(GR() * 6); k < n && nb.length; k++) {
          const sp = nb[Math.floor(GR() * nb.length)], s = 0.55 + GR() * 0.7;
          grovesF.push(Object.assign({ p: new THREE.Vector3(sp.x, sp.y, sp.z).addScaledVector(_fy.set(sp.nx, sp.ny, sp.nz).normalize(), -0.02), q: fanFrame(sp.nx, sp.ny, sp.nz, yaw0 + (GR() - 0.5) * 0.6, (GR() - 0.5) * 0.35), s: sv(s) }, fanColours(FC)));
        }
      }
      for (const cl of LAYOUT.outcrops || []) {
        if (!cl.crest) continue;
        const RC = makeRng$1((Math.round(cl.x * 331 + cl.z * 17) ^ this.seed) >>> 0);
        const pts = tops.concat(sides).filter((p) => p.ny > 0.2 && Math.hypot(p.x - cl.x, p.z - cl.z) < cl.s * 2.2 && p.y > floorHeight(p.x, p.z) + cl.s * 0.8);
        for (let k = 0; k < Math.round(cl.crest * Math.min(1, 0.4 + 0.6 * q)) && pts.length; k++) {
          const sp = pts[Math.floor(RC() * pts.length)];
          grovesF.push(Object.assign({ p: new THREE.Vector3(sp.x, sp.y - 0.03, sp.z), q: fanFrame(sp.nx, sp.ny, sp.nz, SURGE_YAW + (RC() - 0.5) * 0.6, (RC() - 0.5) * 0.3), s: sv(1.0 + RC() * 0.6) }, fanColours(FC)));
        }
      }
      const dense = { points: 900, kill: 0.8, step: 0.024, reach: 0.14, maxNodes: 700, w0: 0.0072, wmin: 0.0015, twig: 0.016, twigP: 0.56 };
      const shapes = [[11, { width: 0.5, peak: 0.66 }], [17, { width: 0.6, peak: 0.6 }], [23, { width: 0.42, peak: 0.72, lead: 2 }]].map(([sd, o]) => fanPlan(sd, 0.95, Object.assign(o, dense)));
      this.lods = [];
      shapes.forEach((pl, k) => {
        const set = new LodSet(RL['fan' + k], fanGeometry(pl, 0.95), fanGeometry(pl, 0.95, { far: true, lite: true }), mat, pal, FAN_LOD);
        this.lods.push(set);
        reefAdd(set.near);
      });
      const liteF = shareGeo(this.lods[0].far.geometry);
      const shareFans = () => {
        if (this.fanFar) { if (this.fanFar.parent) this.fanFar.parent.remove(this.fanFar); const r = this.reefMeshes.indexOf(this.fanFar); if (r >= 0) this.reefMeshes.splice(r, 1); }
        this.fanFar = reefAdd(LodSet.shareFar(this.lods, shareGeo(liteF), mat, pal));
      };
      shareFans();
      const farGeo = fanGeometry(fanPlan(11, 0.95, { width: 0.5, peak: 0.66, points: 130, maxNodes: 90 }), 0.95, { far: true });
      add(makeInstanced(farGeo, mat, far.concat(grovesF), { cast: false, extra: pal })).name = 'fan-groves';
      this.groveFans = grovesF.length;
      const cav = fanPlan(13, 0.4, { width: 0.6, peak: 0.55, points: 240, step: 0.034, reach: 0.19, maxNodes: 260, w0: 0.0048, wmin: 0.0015, twig: 0.016 });
      const cavGeo = fanGeometry(cav, 0.4, { fringe: 1.0 });
      const cavFar = fanGeometry(cav, 0.4, { fringe: 1.0, far: true, lite: true });
      this.cavLods = [];
      if (RL.cav.length) {
        const cs = new LodSet(RL.cav, cavGeo, cavFar, mat, pal, CAV_LOD);
        this.cavLods.push(cs);
        reefAdd(cs.near);
        reefAdd(cs.far);
      }
      WRECK_LIFE.grow = (tops) => {
        const WR = makeRng$1(this.seed ^ 0x3ec401), WC = makeRng$1(this.seed ^ 0x3ec402), fans = [[], [], []], cavs = [], taken = [];
        const CAVP = [[0.85, [0.6, 0.48, 0.1], [0.78, 0.68, 0.2], 0], [0.15, [0.6, 0.46, 0.1], [0.8, 0.56, 0.14], 0]];
        const room = (x, y, z, r) => taken.every((t) => Math.hypot(t[0] - x, t[1] - y, t[2] - z) > r + t[3]);
        const order = tops.map((t, i) => [t.h + WR() * 0.4, i]).sort((a, b) => b[0] - a[0]);
        for (const [, i] of order) {
          const t = tops[i];
          if (t.h < 0.18 || nearFinds(t.x, t.z, 1.2) || Math.hypot(t.x - LAYOUT.landing.x, t.z - LAYOUT.landing.z) < 3) continue;
          const big = !t.jar && t.h > 0.3 && fans[0].length + fans[1].length + fans[2].length < Math.round(44 * q) && WR() < 0.75;
          const h = big ? 0.32 + WR() * 0.4 : 0.14 + WR() * 0.16;
          if (!room(t.x, t.y, t.z, big ? h * 0.45 : 0.4)) continue;
          if (!big && (cavs.length >= Math.round(24 * q) || (t.jar && WR() < 0.6))) continue;
          const nl = Math.hypot(t.nx, t.ny, t.nz) || 1, nx = t.nx / nl, ny = Math.max(0.35, t.ny / nl), nz = t.nz / nl;
          const qq = fanFrame(nx, ny, nz, SURGE_YAW + (WR() - 0.5) * 0.9, (WR() - 0.5) * 0.4, false, 0.4);
          const p = new THREE.Vector3(t.x - nx * 0.02, t.y - 0.02, t.z - nz * 0.02), wk = 0.8 + WR() * 0.5;
          taken.push([t.x, t.y, t.z, h * 0.45]);
          if (big) {
            fans[Math.floor(WR() * 3)].push(Object.assign({ p, q: qq, s: new THREE.Vector3((h * wk) / 0.95, h / 0.95, (h * wk) / 0.95), tile: 'reef' }, fanColours(WC)));
            _fy.set(0, 1, 0).applyQuaternion(qq);
            this.obstacles.push({ x: p.x + _fy.x * h * 0.55, y: p.y + _fy.y * h * 0.55, z: p.z + _fy.z * h * 0.55, r: Math.max(0.2, h * 0.6) + 0.05, fan: true });
          } else cavs.push(Object.assign({ p, q: qq, s: new THREE.Vector3((h * wk) / 0.4, h / 0.4, (h * wk) / 0.4), tile: 'reef' }, fanColours(WC, CAVP)));
        }
        const remake = (sets, k, more, d, ownFar) => {
          const old = sets[k], set = new LodSet(old.items.concat(more), shareGeo(old.near.geometry), shareGeo(old.far.geometry), mat, pal, d);
          for (const m of [old.near, old.far]) { if (m.parent) m.parent.remove(m); const r = this.reefMeshes.indexOf(m); if (r >= 0) this.reefMeshes.splice(r, 1); }
          sets[k] = set;
          reefAdd(set.near);
          if (ownFar) reefAdd(set.far);
        };
        let grew = false;
        shapes.forEach((pl, k) => { if (fans[k].length && this.lods[k]) { remake(this.lods, k, fans[k], FAN_LOD, false); grew = true; } });
        if (grew) shareFans();
        if (cavs.length) {
          if (this.cavLods.length) remake(this.cavLods, 0, cavs, CAV_LOD, true);
          else {
            const cs = new LodSet(cavs, shareGeo(cavGeo), shareGeo(cavFar), mat, pal, CAV_LOD);
            this.cavLods.push(cs);
            reefAdd(cs.near);
            reefAdd(cs.far);
          }
        }
        this.wreckLife = { fans: fans[0].length + fans[1].length + fans[2].length, cav: cavs.length, hosts: tops.length };
      };
    }

    {
      const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0, envMapIntensity: 0.5 });
      worldMaterial(mat, 'anemone', {
        vDecl: 'attribute float aH;\nvarying float vHa;\n',
        vBegin: plantVert('aH', 1.4, 52, 'transformed.x += sin(uTime * 2.1 + position.z * 60.0) * 0.006 * aH;\ntransformed.z += cos(uTime * 1.8 + position.x * 60.0) * 0.006 * aH;\nvHa = aH;'),
        fDecl: 'varying float vHa;\n',
        fColor: 'vec3 wFluo = mix(vec3(0.006, 0.018, 0.006), vec3(0.06, 0.012, 0.07), smoothstep(0.7, 1.0, vHa));\n',
        fLights: FLUO_LIGHTS,
        fEmissive: FLUO_AMBIENT,
      });
      const items = [];
      for (let i = 0; i < Math.floor(90 * q); i++) {
        const sp = pick(tops);
        items.push({ p: new THREE.Vector3(sp.x, sp.y - 0.01, sp.z), q: orient$1(sp.nx, sp.ny, sp.nz, 0.6, rng() * 6.28), s: sv(1.0 + rng() * 0.9) });
      }
      items.push(...RL.anem);
      add(makeInstanced(anemoneGeometry(21), mat, items));
    }

    {
      const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(0.9, 0.7, 0.07), roughness: 0.9, metalness: 0, side: THREE.DoubleSide });
      worldMaterial(mat, 'sponge', {
        vDecl: 'attribute float aIn;\nvarying float vIn;\n', vBegin: cullVert(52, 'vIn = aIn;'),
        fDecl: 'varying float vIn;\n', fNormal: 'normal = wBumpH(normal, wSpH);',
        fColor: SPONGE_FCOLOR$1 + 'vec3 wFluo = diffuseColor.rgb * vec3(1.0, 0.5, 0.15) * (0.35 * (1.0 - vIn));\nfloat wPig = 1.0 - vIn;\n',
        fLights: FLUO_LIGHTS + PIG_WB, fEmissive: FLUO_AMBIENT,
      });
      const items = [];
      for (let i = 0; i < Math.floor(110 * q); i++) {
        const sp = pick(rng() < 0.7 ? tops : sides);
        const qq = orient$1(sp.nx, sp.ny, sp.nz, 0.55, rng() * 6.28), s = 0.9 + rng() * 0.8, h = hashI(i, 31, 7), ax = h < 0.33;
        items.push({
          p: new THREE.Vector3(sp.x, sp.y - 0.02, sp.z), q: qq,
          s: ax ? new THREE.Vector3(s * 0.8, s * 1.35, s * 0.8) : sv(s),
          c: ax ? new THREE.Color(1.08, 0.56, 0.5) : new THREE.Color(1, 0.92 + 0.12 * h, 1),
        });
      }
      items.push(...RL.apl);
      add(makeInstanced(spongeGeometry(31), mat, items, { cast: false }));
    }

    {
      const mat = new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0 });
      worldMaterial(mat, 'urchin', {
        vDecl: 'attribute float aTip;\nvarying float vTip;\n', vBegin: cullVert(52, 'vTip = aTip;'),
        fDecl: 'varying float vTip;\n',
        fColor: 'float wTp = clamp(vTip, 0.0, 1.0);\ndiffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 1.6 + vec3(0.05, 0.04, 0.035), wTp * wTp * 0.6);',
        fRough: 'roughnessFactor = mix(0.62, 0.3, wTp);',
      });
      const R = varyRng(4141);
      const colors = [new THREE.Color(0.36, 0.07, 0.42), new THREE.Color(0.08, 0.05, 0.1), new THREE.Color(0.34, 0.2, 0.09)];
      const crev = or([...low, ...shade].filter((p) => p.ny < 0.55 && p.ny > -0.4), low);
      const cells = new Map(), ck = (x, z) => Math.floor(x / 0.5) * 4096 + Math.floor(z / 0.5);
      for (const p of crev) { const k = ck(p.x, p.z); let l = cells.get(k); if (!l) cells.set(k, (l = [])); l.push(p); }
      const near = (p) => {
        const out = [], cx = Math.floor(p.x / 0.5), cz = Math.floor(p.z / 0.5);
        for (let dx = -1; dx <= 1; dx++) {
          for (let dz = -1; dz <= 1; dz++) {
            const l = cells.get((cx + dx) * 4096 + cz + dz);
            if (l) for (const o of l) if (Math.hypot(o.x - p.x, o.z - p.z) < 0.4 && Math.abs(o.y - p.y) < 0.3) out.push(o);
          }
        }
        return out;
      };
      const items = [], used = new Set(), target = Math.floor(210 * q);
      for (let guard = 0; items.length < target && guard < target * 6; guard++) {
        const group = near(crev[Math.floor(R() * crev.length)]), col = colors[Math.floor(R() * 3)];
        for (let i = 0, k = 2 + Math.floor(R() * 4); i < k && group.length && items.length < target; i++) {
          const p = group[Math.floor(R() * group.length)];
          if (used.has(p)) continue;
          used.add(p);
          items.push({ p: new THREE.Vector3(p.x, p.y, p.z), q: orient$1(p.nx, p.ny, p.nz, 0.2, R() * 6.28), s: sv(0.75 + R() * 0.6), c: col });
        }
      }
      items.push(...RL.urchin);
      add(makeInstanced(urchinGeometry(41), mat, items));
    }

    {
      const mat = new THREE.MeshStandardMaterial({ roughness: 0.65, metalness: 0 });
      worldMaterial(mat, 'star', {
        vDecl: 'attribute vec2 aArm;\n', vBegin: STAR_VBEGIN, fColor: STAR_FCOLOR + 'float wPig = 0.5;\n',
        fNormal: 'normal = wBumpH(normal, wStH);', fLights: PIG_WB,
      });
      const items = [];
      for (let i = 0; i < Math.floor(70 * q); i++) {
        let p, qq;
        if (rng() < 0.55) {
          const sp = pick(tops);
          p = new THREE.Vector3(sp.x, sp.y + 0.005, sp.z);
          qq = orient$1(sp.nx, sp.ny, sp.nz, 0.1, rng() * 6.28);
        } else {
          const a = rng() * Math.PI * 2, r = 6 + rng() * 34;
          const x = LAYOUT.wreck.x + Math.cos(a) * r, z = LAYOUT.wreck.z + Math.sin(a) * r;
          if (inClearings(x, z, 0.5) || nearAssembly(x, z, 9.0)) continue;
          p = new THREE.Vector3(x, grid.height(x, z) + 0.004, z);
          qq = new THREE.Quaternion().setFromUnitVectors(Y$1, grid.normal(x, z)).multiply(new THREE.Quaternion().setFromAxisAngle(Y$1, rng() * 6.28));
        }
        c.setRGB(0.92, 0.05 + rng() * 0.05, 0.03);
        items.push({ p, q: qq, s: sv(0.8 + rng() * 0.7), c: c.clone() });
      }
      const R = varyRng(5151);
      for (let i = 0; i < Math.floor(60 * q); i++) {
        const a = R() * Math.PI * 2, r = 3 + R() * 22;
        const x = LAYOUT.wreck.x + Math.cos(a) * r, z = LAYOUT.wreck.z + Math.sin(a) * r;
        if (inClearings(x, z, 0.5) || nearAssembly(x, z, 9.0) || grid.sand(x, z) < 0.5) continue;
        const qq = new THREE.Quaternion().setFromUnitVectors(Y$1, grid.normal(x, z)).multiply(new THREE.Quaternion().setFromAxisAngle(Y$1, R() * 6.28));
        const k = R();
        if (k < 0.7) c.setRGB(0.92, 0.05 + R() * 0.05, 0.03);
        else if (k < 0.88) c.setRGB(0.98, 0.16 + R() * 0.06, 0.03);
        else c.setRGB(0.5, 0.08, 0.56);
        items.push({ p: new THREE.Vector3(x, grid.height(x, z) + 0.004, z), q: qq, s: sv(0.9 + R() * 0.7), c: c.clone() });
      }
      const R3 = varyRng(5171);
      for (const f of LAYOUT.frags) {
        for (let k = 0; k < 2; k++) {
          const a = R3() * Math.PI * 2, r = 1.5 + R3() * 1.3, x = f.x + Math.cos(a) * r, z = f.z + Math.sin(a) * r;
          const qq = new THREE.Quaternion().setFromUnitVectors(Y$1, grid.normal(x, z)).multiply(new THREE.Quaternion().setFromAxisAngle(Y$1, R3() * 6.28));
          if (R3() < 0.7) c.setRGB(0.92, 0.05 + R3() * 0.05, 0.03); else c.setRGB(0.98, 0.16 + R3() * 0.06, 0.03);
          const s = 0.9 + R3() * 0.6;
          if (grid.sand(x, z) >= 0.5) items.push({ p: new THREE.Vector3(x, grid.height(x, z) + 0.004, z), q: qq, s: sv(s), c: c.clone() });
        }
      }
      items.push(...RL.star);
      add(makeInstanced(starfishGeometry(), mat, items));
    }

    {
      const mat = new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0, side: THREE.DoubleSide });
      worldMaterial(mat, 'polyp', {
        vDecl: 'attribute float aH;\nvarying float vHp;\n', vBegin: plantVert('aH', 0.04, 52, 'vHp = aH;'),
        fDecl: 'varying float vHp;\n',
        fColor: 'diffuseColor.rgb = mix(vec3(0.86, 0.54, 0.08), vec3(0.94, 0.7, 0.2), smoothstep(0.5, 1.0, vHp));\nvec3 wFluo = diffuseColor.rgb * vec3(1.0, 0.62, 0.1) * (0.06 + 0.05 * vHp);\nfloat wPig = 1.0;\n',
        fLights: FLUO_LIGHTS + PIG_WB,
        fEmissive: FLUO_AMBIENT,
      });
      const items = [];
      for (let k = 0; k < Math.floor(110 * q); k++) {
        const sp = pick(shade);
        const tx = -sp.nz, tz = sp.nx;
        for (let i = 0; i < 36; i++) {
          const u = (rng() - 0.5) * 0.35, v = (rng() - 0.5) * 0.22;
          const p = new THREE.Vector3(sp.x + tx * u - sp.nx * 0.008, sp.y + v - sp.ny * 0.008, sp.z + tz * u - sp.nz * 0.008);
          items.push({ p, q: orient$1(sp.nx, sp.ny, sp.nz, 0.3, rng() * 6.28), s: sv(0.7 + rng() * 0.6) });
        }
      }
      items.push(...RL.polyp);
      add(makeInstanced(polypGeometry(), mat, items));
    }

    {
      const vd = 'attribute float aH;\nattribute float aT;\nvarying float vTs;\n';
      const mat = new THREE.MeshStandardMaterial({ roughness: 0.75, metalness: 0 });
      worldMaterial(mat, 'singul', {
        vDecl: vd, vBegin: plantVert('aH', 0.5, 52, 'vTs = aT;\n', true),
        fDecl: 'varying float vTs;\n', fColor: SING_FCOLOR + 'float wPig = 0.5;\n', fLights: PIG_WB,
      });
      reefAdd(makeInstanced(candelabraGeometry(111), mat, RL.sing));
    }
    {
      const mat = new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0 });
      worldMaterial(mat, 'axinella', {
        vDecl: 'attribute float aH;\nattribute float aT;\nvarying float vTa;\n', vBegin: plantVert('aH', 0.08, 52, 'vTa = aT;\n', true),
        fDecl: 'varying float vTa;\n', fNormal: 'normal = wBumpH(normal, wAxH);',
        fColor: AXI_FCOLOR + 'vec3 wFluo = diffuseColor.rgb * vec3(1.0, 0.5, 0.15) * 0.12;\nfloat wPig = 1.0;\n',
        fLights: FLUO_LIGHTS + PIG_WB, fEmissive: FLUO_AMBIENT,
      });
      reefAdd(makeInstanced(axiGeo, mat, RL.axi));
    }
    {
      const mat = new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0 });
      worldMaterial(mat, 'myriapora', {
        vDecl: 'attribute float aH;\nattribute float aT;\nvarying float vTm;\n', vBegin: cullVert(40, 'vTm = aT;\n'),
        fDecl: 'varying float vTm;\n', fColor: MYR_FCOLOR + 'float wPig = 1.0;\n', fLights: PIG_WB,
      });
      reefAdd(makeInstanced(myriaporaGeometry(131), mat, RL.myr));
    }

    {
      const mat = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.65, metalness: 0 });
      worldMaterial(mat, 'padina', {
        vDecl: 'attribute float aR;\nattribute float aH;\nvarying float vR;\n', vBegin: plantVert('aH', 0.25, 52, 'vR = aR;'),
        fDecl: 'varying float vR;\n', fColor: PADINA_FCOLOR, fLights: TRANSLUCENT('0.35'),
      });
      const items = [];
      for (let i = 0; i < Math.floor(270 * q); i++) {
        const sp = pick(sunTops);
        c.setRGB(0.9 + rng() * 0.2, 0.9 + rng() * 0.2, 0.85 + rng() * 0.25);
        items.push({ p: new THREE.Vector3(sp.x, sp.y - 0.012, sp.z), q: orient$1(sp.nx, sp.ny, sp.nz, 0.35, rng() * 6.28), s: sv(0.75 + rng() * 0.5), c: c.clone() });
      }
      items.push(...RL.pad);
      add(makeInstanced(padinaGeometry(61), mat, items));
    }

    {
      const mat = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.6, metalness: 0 });
      worldMaterial(mat, 'cysto', {
        vDecl: 'attribute float aH;\nattribute float aL;\nvarying float vHc;\nvarying float vLc;\n',
        vBegin: plantVert('aH', 0.45, 56, 'vHc = aH;\nvLc = aL;'),
        fDecl: 'varying float vHc;\nvarying float vLc;\n', fColor: CYSTO_FCOLOR, fEmissive: CYSTO_FEMISSIVE, fLights: TRANSLUCENT('0.3'),
      });
      const items = [];
      for (let i = 0; i < Math.floor(250 * q); i++) {
        const sp = pick(sunTops);
        c.setRGB(0.85 + rng() * 0.3, 0.85 + rng() * 0.25, 0.8 + rng() * 0.25);
        items.push({ p: new THREE.Vector3(sp.x, sp.y - 0.015, sp.z), q: orient$1(sp.nx, sp.ny, sp.nz, 0.8, rng() * 6.28), s: sv(0.8 + rng() * 0.6), c: c.clone() });
      }
      items.push(...RL.cysto);
      add(makeInstanced(cystoseiraGeometry(71), mat, items));
    }

    {
      const mat = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.7, metalness: 0 });
      worldMaterial(mat, 'hali', {
        vDecl: 'attribute float aH;\nattribute float aRim;\nvarying float vHh;\nvarying float vRim;\n',
        vBegin: plantVert('aH', 0.12, 52, 'vHh = aH;\nvRim = aRim;'),
        fDecl: 'varying float vHh;\nvarying float vRim;\n', fColor: HALI_FCOLOR, fLights: TRANSLUCENT('0.3'),
      });
      const items = [];
      for (let i = 0; i < Math.floor(360 * q); i++) {
        const sp = pick(rng() < 0.6 ? shade : low);
        c.setRGB(0.88 + rng() * 0.24, 0.9 + rng() * 0.2, 0.85 + rng() * 0.25);
        items.push({ p: new THREE.Vector3(sp.x, sp.y - 0.01, sp.z), q: orient$1(sp.nx, sp.ny, sp.nz, 0.5, rng() * 6.28), s: sv(0.8 + rng() * 0.6), c: c.clone() });
      }
      items.push(...RL.hali);
      add(makeInstanced(halimedaGeometry(81), mat, items));
    }

    {
      const mat = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.4, metalness: 0 });
      worldMaterial(mat, 'caul', {
        vDecl: 'attribute float aH;\nattribute float aB;\nvarying float vHc;\nvarying float vBc;\n',
        vBegin: plantVert('aH', 0.3, 52, 'vHc = aH;\nvBc = aB;'),
        fDecl: 'varying float vHc;\nvarying float vBc;\n', fColor: CAUL_FCOLOR, fLights: TRANSLUCENT('0.5'),
      });
      const items = [];
      const target = Math.floor(420 * q);
      for (let i = 0; i < target * 10 && items.length < target; i++) {
        let x, z;
        if (rng() < 0.5) {
          const p = plan[Math.floor(rng() * plan.length)];
          const a = rng() * Math.PI * 2, d = 0.5 * (p.sx + p.sz) * (1.05 + rng() * 0.9);
          x = p.x + Math.cos(a) * d; z = p.z + Math.sin(a) * d;
        } else {
          const a = rng() * Math.PI * 2, r = LAYOUT.meadow.r - 4 + rng() * 14;
          x = LAYOUT.meadow.x + Math.cos(a) * r * 1.25; z = LAYOUT.meadow.z + Math.sin(a) * r;
        }
        if (inClearings(x, z, 0.3) || nearAssembly(x, z, 9.0) || grid.sand(x, z) < 0.8 || meadowAt(x, z) > 0.55) continue;
        if (blockers.some((b) => (x - b.x) ** 2 + (z - b.z) ** 2 < b.r2)) continue;
        const qq = new THREE.Quaternion().setFromUnitVectors(Y$1, grid.normal(x, z)).multiply(new THREE.Quaternion().setFromAxisAngle(Y$1, rng() * 6.28));
        c.setRGB(0.9 + rng() * 0.2, 0.9 + rng() * 0.2, 0.85 + rng() * 0.25);
        items.push({ p: new THREE.Vector3(x, grid.height(x, z) - 0.005, z), q: qq, s: sv(0.8 + rng() * 0.5), c: c.clone() });
      }
      add(makeInstanced(caulerpaGeometry(91), mat, items));
    }

    {
      const mat = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.6, metalness: 0 });
      worldMaterial(mat, 'aceta', {
        vDecl: 'attribute float aH;\nattribute vec2 aC;\nvarying vec2 vCa;\n', vBegin: plantVert('aH', 0.15, 52, 'vCa = aC;'),
        fDecl: 'varying vec2 vCa;\n', fColor: ACETA_FCOLOR, fLights: TRANSLUCENT('0.3'),
      });
      const items = [];
      for (let i = 0; i < Math.floor(200 * q); i++) {
        const sp = pick(sunTops);
        c.setRGB(0.9 + rng() * 0.2, 0.9 + rng() * 0.2, 0.9 + rng() * 0.2);
        items.push({ p: new THREE.Vector3(sp.x, sp.y - 0.005, sp.z), q: orient$1(sp.nx, sp.ny, sp.nz, 0.6, rng() * 6.28), s: sv(0.8 + rng() * 0.5), c: c.clone() });
      }
      items.push(...RL.aceta);
      add(makeInstanced(acetabulariaGeometry(101), mat, items));
    }

    add(buildShells(grid, plan, q));
    add(buildStones(grid, plan, boulders, q, bedR.maerl));
    add(buildPinna(grid, blockers0, q));
    this.obstacles.push(...PINNA_KEEP);

    this.snow = new MarineSnow(scene, q);
    this.fanFull = Math.round(FAN_FULL * Math.min(1, 0.2 + 0.8 * q));
    lap('rest');
  }

  update(dt, t, camera, pr) {
    const k = (Math.PI * 2) / 7.5;
    U.uSurge.value.set(Math.sin(t * k) * 0.16, 0, Math.cos(t * k + 0.7) * 0.10);
    WU.uCamPos.value.copy(camera.position);
    LodSet.updateAll(this.lods, camera, this.fanFull);
    if (this.cavLods && this.cavLods.length) LodSet.updateAll(this.cavLods, camera, Infinity);
    this.snow.update(dt, camera);
  }
}

