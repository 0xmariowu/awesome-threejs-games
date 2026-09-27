// noise.js
function mulberry32$1(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeRng$1(seed) {
  const r = mulberry32$1(seed);
  const api = () => r();
  api.range = (a, b) => a + (b - a) * r();
  api.int = (a, b) => Math.floor(a + (b - a + 1) * r());
  api.pick = (arr) => arr[Math.floor(r() * arr.length)];
  api.sign = () => (r() < 0.5 ? -1 : 1);
  api.gauss = () => {
    let u = 0, v = 0;
    while (u === 0) u = r();
    while (v === 0) v = r();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  return api;
}

const clamp$9 = (x, a, b) => (x < a ? a : x > b ? b : x);
const lerp$4 = (a, b, t) => a + (b - a) * t;
const smoothstep = (e0, e1, x) => {
  const t = clamp$9((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};
const easeInOut$1 = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
const easeInCubic = (t) => t * t * t;

const P$1 = new Uint8Array(512);
(function init() {
  const r = mulberry32$1(90210);
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = (r() * (i + 1)) | 0;
    const t = p[i]; p[i] = p[j]; p[j] = t;
  }
  for (let i = 0; i < 512; i++) P$1[i] = p[i & 255];
})();

function fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
function grad(h, x, y, z) {
  h &= 15;
  const u = h < 8 ? x : y;
  const v = h < 4 ? y : (h === 12 || h === 14 ? x : z);
  return ((h & 1) ? -u : u) + ((h & 2) ? -v : v);
}

function noise3(x, y, z) {
  let X = Math.floor(x), Y = Math.floor(y), Z = Math.floor(z);
  x -= X; y -= Y; z -= Z;
  X &= 255; Y &= 255; Z &= 255;
  const u = fade(x), v = fade(y), w = fade(z);
  const A = P$1[X] + Y, AA = P$1[A] + Z, AB = P$1[A + 1] + Z;
  const B = P$1[X + 1] + Y, BA = P$1[B] + Z, BB = P$1[B + 1] + Z;
  return lerp$4(
    lerp$4(lerp$4(grad(P$1[AA], x, y, z), grad(P$1[BA], x - 1, y, z), u),
         lerp$4(grad(P$1[AB], x, y - 1, z), grad(P$1[BB], x - 1, y - 1, z), u), v),
    lerp$4(lerp$4(grad(P$1[AA + 1], x, y, z - 1), grad(P$1[BA + 1], x - 1, y, z - 1), u),
         lerp$4(grad(P$1[AB + 1], x, y - 1, z - 1), grad(P$1[BB + 1], x - 1, y - 1, z - 1), u), v),
    w);
}

const noise2 = (x, y) => noise3(x, y, 0.371);

function fbm2(x, y, oct = 5) {
  let s = 0, a = 0.5, f = 1, n = 0;
  for (let i = 0; i < oct; i++) {
    s += a * noise2(x * f + i * 17.1, y * f - i * 9.3);
    n += a; a *= 0.5; f *= 2.03;
  }
  return s / n;
}

function fbm3(x, y, z, oct = 4) {
  let s = 0, a = 0.5, f = 1, n = 0;
  for (let i = 0; i < oct; i++) {
    s += a * noise3(x * f + i * 5.3, y * f - i * 3.1, z * f + i * 7.7);
    n += a; a *= 0.5; f *= 2.07;
  }
  return s / n;
}

function ridged2(x, y, oct = 4) {
  let s = 0, a = 0.5, f = 1, n = 0;
  for (let i = 0; i < oct; i++) {
    let v = 1 - Math.abs(noise2(x * f + i * 3.7, y * f + i * 1.9));
    v *= v;
    s += a * v; n += a; a *= 0.5; f *= 2.1;
  }
  return s / n;
}

