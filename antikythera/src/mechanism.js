// mechanism.js
const DEG$6 = Math.PI / 180;
const TAU$6 = Math.PI * 2;
const FONT_GR$1 = '"GFS Neohellenic", "Noto Serif", "Times New Roman", serif';
const wrapPi$1 = (a) => a - TAU$6 * Math.floor((a + Math.PI) / TAU$6);
const V3$1 = THREE.Vector3;

function at(p, dist, deg) { return [p[0] + dist * Math.cos(deg * DEG$6), p[1] + dist * Math.sin(deg * DEG$6)]; }
function intersect(A, rA, B, rB) {
  const dx = B[0] - A[0], dy = B[1] - A[1];
  const d = Math.hypot(dx, dy);
  const a = (rA * rA - rB * rB + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, rA * rA - a * a));
  const ux = dx / d, uy = dy / d;
  const px = A[0] + a * ux, py = A[1] + a * uy;
  return [[px - h * uy, py + h * ux], [px + h * uy, py - h * ux]];
}
const RN = (id, N) => pitchRadius(N, moduleOf(id));
const P = {};
P.b = [0, 0];
P.e = [0, -(RN('b3', 32) + RN('e1', 32))];
P.d = at(P.e, RN('d2', 127) + RN('e2', 32), 150);
P.c = intersect(P.b, RN('b2', 64) + RN('c1', 38), P.d, RN('c2', 48) + RN('d1', 24)).sort((u, v) => u[1] - v[1])[0];
P.m = at(P.e, RN('m3', 27) + RN('e3', 223), 70);
P.l = intersect(P.b, RN('b2', 64) + RN('l1', 38), P.m, RN('l2', 53) + RN('m1', 96)).sort((u, v) => v[0] - u[0])[0];
P.n = at(P.m, RN('m2', 15) + RN('n1', 53), 90);
P.o = at(P.n, RN('n3', 57) + RN('o1', 60), 210);
P.f = at(P.e, RN('e4', 188) + RN('f1', 53), -95);
P.g = at(P.f, RN('f2', 30) + RN('g1', 54), 190);
P.h = at(P.g, RN('g2', 20) + RN('h1', 60), -50);
P.i = at(P.h, RN('h2', 15) + RN('i1', 60), 175);

const Z = { L0: 0.044, L1: 0.036, L2: 0.027, L3: 0.018, L4: 0.009, L5: 0.0, L6: -8e-3, L7: -0.016, L8: -0.024, L9: -0.032, L10: -0.04, L11: -0.048 };
const K_RADIUS = RN('e5', 50) + RN('k1', 50);
const K_TIP = RN('k1', 50) + moduleOf('k1');
const PLATE_Z = 0.075;
const FACE_OFF = 0.0036;
const PLATE_W = 0.2, PLATE_H = 0.31;
const PLATE_HALF = 0.0028;
const PILLARS = [[-0.092, -0.147], [0.092, -0.147], [-0.092, 0.147], [0.092, 0.147]];
const ZF = PLATE_Z + FACE_OFF + 0.0012;
const B_TOP = ZF + 0.0075 + 0.0012;

const GEARS = [
  { id: 'b1', N: 224, ax: 'b', z: Z.L1, spokes: 4, thick: 0.0027, hero: 0 },
  { id: 'b2', N: 64, ax: 'b', z: Z.L2, coax: 'b1', thick: 0.0023 },
  { id: 'c1', N: 38, ax: 'c', z: Z.L2, mesh: 'b2' },
  { id: 'c2', N: 48, ax: 'c', z: Z.L3, coax: 'c1' },
  { id: 'd1', N: 24, ax: 'd', z: Z.L3, mesh: 'c2' },
  { id: 'd2', N: 127, ax: 'd', z: Z.L4, coax: 'd1', spokes: 4, thick: 0.0013, hero: 1 },
  { id: 'e2', N: 32, ax: 'e', z: Z.L4, mesh: 'd2' },
  { id: 'e5', N: 50, ax: 'e', z: Z.L5, coax: 'e2' },
  { id: 'l1', N: 38, ax: 'l', z: Z.L2, mesh: 'b2' },
  { id: 'l2', N: 53, ax: 'l', z: Z.L3, coax: 'l1' },
  { id: 'm1', N: 96, ax: 'm', z: Z.L3, mesh: 'l2', spokes: 4, thick: 0.002 },
  { id: 'm2', N: 15, ax: 'm', z: Z.L4, coax: 'm1' },
  { id: 'm3', N: 27, ax: 'm', z: Z.L7, coax: 'm1' },
  { id: 'n1', N: 53, ax: 'n', z: Z.L4, mesh: 'm2' },
  { id: 'n3', N: 57, ax: 'n', z: Z.L9, coax: 'n1' },
  { id: 'o1', N: 60, ax: 'o', z: Z.L9, mesh: 'n3' },
  { id: 'e3', N: 223, ax: 'e', z: Z.L7, mesh: 'm3', thick: 0.0014, hero: 2 },
  { id: 'e4', N: 188, ax: 'e', z: Z.L8, coax: 'e3', spokes: 5 },
  { id: 'f1', N: 53, ax: 'f', z: Z.L8, mesh: 'e4' },
  { id: 'f2', N: 30, ax: 'f', z: Z.L9, coax: 'f1' },
  { id: 'g1', N: 54, ax: 'g', z: Z.L9, mesh: 'f2' },
  { id: 'g2', N: 20, ax: 'g', z: Z.L10, coax: 'g1' },
  { id: 'h1', N: 60, ax: 'h', z: Z.L10, mesh: 'g2' },
  { id: 'h2', N: 15, ax: 'h', z: Z.L11, coax: 'h1' },
  { id: 'i1', N: 60, ax: 'i', z: Z.L11, mesh: 'h2' },
  { id: 'e6', N: 50, ax: 'e', z: Z.L6, special: 'e6' },
  { id: 'e1', N: 32, ax: 'e', z: Z.L0, coax: 'e6' },
  { id: 'b3', N: 32, ax: 'b', z: Z.L0, mesh: 'e1' },
  { id: 'k1', N: 50, ax: 'k', z: Z.L5, special: 'k1' },
  { id: 'k2', N: 50, ax: 'k', z: Z.L6, special: 'k2' },
];
const WHEEL_T = 0.0014;
for (const G of GEARS) { G.m = moduleOf(G.id); G.thick = G.thick || WHEEL_T; }

const HERO_NAMES = ['b1', 'd2', 'e3'];

const BRIDGE_AXES = ['b', 'c', 'd', 'l'];
const BRIDGE_Z0 = Z.L5 + 0.0058, BRIDGE_Z1 = Z.L5 + 0.0068;
const BRIDGE_PATH = [at(P.e, 0.058, 165), 'd', 'c', 'b', 'l', at(P.e, 0.058, 10)];

const PLAN = [
  { sets: [{ name: 'backFrame', kind: 'plate', parts: ['backAsm', 'pillar0', 'pillar1', 'pillar2', 'pillar3'] }], gap: 0.55 },
  { sets: [
    { name: 'sarosTrain', kind: 'gear', parts: ['h2', 'i1', 'g2', 'h1'] },
    { name: 'backTrain', kind: 'gear', parts: ['f2', 'g1', 'f1', 'e4'] },
    { name: 'metonicTrain', kind: 'gear', parts: ['n3', 'o1', 'm3'] },
  ], gap: 0.75 },
  { hero: 2 },
  { sets: [{ name: 'lunarSet', kind: 'gear', parts: ['e6', 'kCarrier', 'e5', 'lunarBridge'] }] },
  { hero: 1 },
  { sets: [
    { name: 'lunarTrain', kind: 'gear', parts: ['e2', 'm2', 'n1'] },
    { name: 'upperTrain', kind: 'gear', parts: ['c2', 'd1', 'l2', 'm1'] },
    { name: 'driveTrain', kind: 'gear', parts: ['b2', 'c1', 'l1'] },
  ], gap: 0.75 },
  { hero: 0 },
  { sets: [
    { name: 'moonTrain', kind: 'gear', parts: ['b3', 'e1'] },
    { name: 'dialSet', kind: 'dialSet', parts: ['frontAsm', 'ring0', 'ring1', 'ring2', 'ring3', 'ring4', 'dragon', 'moonPtr', 'sunPtr'], turn: true },
    { name: 'backDials', kind: 'dialSet', parts: ['backDials'] },
  ], gap: 0.6 },
  { sets: [
    { name: 'case', kind: 'plate', parts: ['case'] },
    { name: 'crank', parts: ['crank'] },
  ], gap: 1.2 },
];
const HERO_STEP = PLAN.findIndex((s) => s.hero !== undefined);

const PILE_OF = { backFrame: 0, sarosTrain: 1, backTrain: 2, metonicTrain: 3, lunarSet: 3, lunarTrain: 4, upperTrain: 4, driveTrain: 4, moonTrain: 5, dialSet: 5, backDials: 5, case: 6, crank: 6 };
const PILE_N = [];
for (const k of Object.values(PILE_OF)) PILE_N[k] = (PILE_N[k] || 0) + 1;
const PRE_ROLL = 0.3;
const GIVE_HURRY = 2.2;
const flyV = (t) => smoothstep(0, 0.2, t) * (Math.pow(1 - t, 1.7) + 0.035);
const FLY_N = 256;
const FLY_F = new Float32Array(FLY_N + 1);
let FLY_VEND = 0;
{
  let acc = 0;
  for (let i = 1; i <= FLY_N; i++) { acc += flyV((i - 0.5) / FLY_N) / FLY_N; FLY_F[i] = acc; }
  for (let i = 1; i <= FLY_N; i++) FLY_F[i] /= acc;
  FLY_VEND = flyV(1) / acc;
}
function flyF(tau) {
  const x = clamp$9(tau, 0, 1) * FLY_N, i = Math.min(FLY_N - 1, Math.floor(x));
  return FLY_F[i] + (FLY_F[i + 1] - FLY_F[i]) * (x - i);
}
const smoother$1 = (x) => { x = clamp$9(x, 0, 1); return x * x * x * (x * (x * 6 - 15) + 10); };
const Y_AXIS = new V3$1(0, 1, 0);
new THREE.Quaternion().setFromUnitVectors(new V3$1(0, 0, 1), new V3$1(0, 1, 0));
const IDQ = new THREE.Quaternion();
const GLYPH_KINDS = ['lunar', 'solar'];
const COVER_REST = -270 * DEG$6;
const SAND_COL = [0.62, 0.58, 0.48];
const CRUST_CLUMP = [[0.46, 0.44, 0.4], [0.34, 0.32, 0.28], [0.4, 0.32, 0.26], [0.24, 0.22, 0.19], [0.44, 0.37, 0.3]];
const CRUST_DUST = [0.34, 0.33, 0.29];
const resp = (w) => 1 - Math.exp(-Math.abs(w) / 2.4);
const luSeg = (x, a, b) => clamp$9((x - a) / (b - a), 0, 1);
const luOn = (u, t0, w = 0.2) => (u <= 0 ? 0 : smoothstep(t0 - w / 2, t0 + w / 2, u));
const LU_AT = {
  ring0: [0, 0.35], ring1: [0, 0.43], ring2: [0, 0.51], ring3: [0, 0.59], ring4: [0, 0.67], dragon: [0, 0.75], moon: [0, 0.83], sun: [0, 0.91],
  oly: [1, 0.3], met: [1, 0.42], exe: [1, 0.75], sar: [1, 0.86],
};
function ratchet(t) {
  const ov = 0.035;
  if (t < 0.1) return ov * easeOutCubic(t / 0.1);
  if (t < 0.22) return ov * (1 - 0.5 * smoothstep(0.1, 0.13, t));
  if (t < 0.36) return ov * 0.5 * (1 - smoothstep(0.24, 0.27, t));
  const s = t - 0.27;
  return ov * 0.12 * Math.exp(-s * 16) * Math.sin(s * 70);
}
const SOCK_VERT = `
varying vec2 vP;
void main() {
  vP = position.xy;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;
const SOCK_FRAG = `
uniform float uA;
uniform float uT;
uniform float uR;
uniform float uW;
varying vec2 vP;
void main() {
  float r = length(vP);
  float w = max(uW, fwidth(r) * 0.8);
  float d = (r - uR) / w;
  float line = exp(-d * d) * (uW / w);
  float a = atan(vP.y, vP.x);
  float glint = pow(0.5 + 0.5 * cos(a - uT * 0.8), 10.0) + 0.6 * pow(0.5 + 0.5 * cos(a + 2.4 - uT * 0.53), 16.0);
  gl_FragColor = vec4(vec3(1.0, 0.66, 0.3) * line * uA * (0.3 + 1.3 * glint), 1.0);
}
`;

function canvas$1(w, h = w) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}
function tex(c, srgb, aniso) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = aniso;
  t.needsUpdate = true;
  return t;
}
function arcText(g, text, cx, cy, r, angCenter, size, letter = 0.12, font = FONT_GR$1) {
  if (String(g.fillStyle).toLowerCase() === PASS.col.engr) {
    const fs = g.fillStyle;
    g.save();
    g.fillStyle = '#e0b574';
    g.globalAlpha *= 0.55;
    g.translate(size * 0.045, size * 0.045);
    arcTextRaw(g, text, cx, cy, r, angCenter, size, letter, font);
    g.restore();
    g.fillStyle = fs;
  }
  arcTextRaw(g, text, cx, cy, r, angCenter, size, letter, font);
}
function arcTextRaw(g, text, cx, cy, r, angCenter, size, letter, font) {
  g.font = `700 ${size}px ${font}`;
  const chars = [...text];
  const w = chars.map((ch) => g.measureText(ch).width);
  const total = w.reduce((a, b) => a + b, 0) + letter * size * (chars.length - 1);
  let a = angCenter + total / 2 / r;
  for (let i = 0; i < chars.length; i++) {
    const half = w[i] / 2 / r;
    a -= half;
    g.save();
    g.translate(cx + r * Math.cos(a), cy - r * Math.sin(a));
    g.rotate(Math.PI / 2 - a);
    g.fillText(chars[i], 0, 0);
    g.restore();
    a -= half + (letter * size) / r;
  }
}
function tick$1(g, cx, cy, a, r0, r1, w) {
  g.lineWidth = w;
  g.beginPath();
  g.moveTo(cx + r0 * Math.cos(a), cy - r0 * Math.sin(a));
  g.lineTo(cx + r1 * Math.cos(a), cy - r1 * Math.sin(a));
  g.stroke();
}
function ring(g, cx, cy, r0, r1, fill) {
  g.fillStyle = fill;
  g.beginPath();
  g.arc(cx, cy, r1, 0, TAU$6);
  g.arc(cx, cy, r0, 0, TAU$6, true);
  g.fill();
}
function circle(g, cx, cy, r, w) {
  g.lineWidth = w;
  g.beginPath();
  g.arc(cx, cy, r, 0, TAU$6);
  g.stroke();
}

const PASS = {
  col: { base: '#c58c45', polish: '#dcab62', engr: '#3a230e', enamel: '#1c3fa2', gold: '#f6c75c', field: '#b67d3c', bg: '#b88040' },
  mr: { base: 'rgb(0,82,255)', polish: 'rgb(0,58,255)', engr: 'rgb(0,215,40)', enamel: 'rgb(0,56,0)', gold: 'rgb(0,46,255)', field: 'rgb(0,100,255)', bg: 'rgb(0,90,255)' },
  bump: { base: '#ffffff', polish: '#ffffff', engr: '#000000', enamel: '#9a9a9a', gold: '#e6e6e6', field: '#f2f2f2', bg: '#ffffff' },
};

function paintFace(size, painter) {
  const out = {};
  for (const pass of ['col', 'mr', 'bump']) {
    const s = pass === 'mr' ? size / 2 : size;
    const c = canvas$1(s);
    const g = c.getContext('2d');
    g.scale(s / size, s / size);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    painter(g, PASS[pass], pass);
    out[pass] = c;
  }
  return out;
}

function meander(g, x0, y0, len, h) {
  const unit = h * 1.25;
  const n = Math.max(1, Math.floor(len / unit));
  const off = x0 + (len - n * unit) / 2;
  g.beginPath();
  for (let k = 0; k < n; k++) {
    const x = off + k * unit;
    g.moveTo(x, y0 + h);
    g.lineTo(x, y0);
    g.lineTo(x + h, y0);
    g.lineTo(x + h, y0 + h * 0.75);
    g.lineTo(x + h * 0.375, y0 + h * 0.75);
    g.lineTo(x + h * 0.375, y0 + h * 0.375);
    g.lineTo(x + h * 0.625, y0 + h * 0.375);
    g.moveTo(x, y0 + h);
    g.lineTo(x + unit, y0 + h);
  }
  g.stroke();
}

function plateFaces(W, extra) {
  const H = Math.round((W * PLATE_H) / PLATE_W);
  const k = W / PLATE_W;
  const T = { k, W, H, X: (x) => (x / PLATE_W + 0.5) * W, Y: (y) => (0.5 - y / PLATE_H) * H };
  const out = {};
  for (const pass of ['col', 'mr', 'bump']) {
    const s = 1;
    const c = canvas$1(Math.round(W * s), Math.round(H * s));
    const g = c.getContext('2d');
    g.scale(s, s);
    const C = PASS[pass];
    g.fillStyle = C.base;
    g.fillRect(0, 0, W, H);
    const rng = makeRng$1(5);
    const hs = W / 1024;
    g.globalAlpha = pass === 'bump' ? 0.22 : 0.07;
    for (let i = 0; i < 2600; i++) {
      g.fillStyle = rng() < 0.5 ? C.engr : C.polish;
      g.beginPath();
      g.ellipse(rng() * W, rng() * H, (2 + rng() * 6) * hs, (1.5 + rng() * 4) * hs, rng() * 3, 0, TAU$6);
      g.fill();
    }
    g.globalAlpha = 1;
    if (extra) { g.save(); extra(g, C, T, pass); g.restore(); }
    const m = 0.005 * k, bw = 0.009 * k;
    g.strokeStyle = C.gold;
    g.lineWidth = 0.0009 * k;
    g.strokeRect(m, m, W - 2 * m, H - 2 * m);
    g.strokeRect(m + bw, m + bw, W - 2 * (m + bw), H - 2 * (m + bw));
    g.lineWidth = 0.0007 * k;
    const h = bw * 0.62, inset = m + (bw - h) / 2;
    meander(g, m + bw, inset, W - 2 * (m + bw), h);
    g.save(); g.translate(W, H); g.rotate(Math.PI); meander(g, m + bw, inset, W - 2 * (m + bw), h); g.restore();
    g.save(); g.translate(0, H); g.rotate(-Math.PI / 2); meander(g, m + bw, inset, H - 2 * (m + bw), h); g.restore();
    g.save(); g.translate(W, 0); g.rotate(Math.PI / 2); meander(g, m + bw, inset, H - 2 * (m + bw), h); g.restore();
    for (const [cx, cy] of [[m + bw / 2, m + bw / 2], [W - m - bw / 2, m + bw / 2], [m + bw / 2, H - m - bw / 2], [W - m - bw / 2, H - m - bw / 2]]) {
      g.fillStyle = C.gold; g.beginPath(); g.arc(cx, cy, bw * 0.34, 0, TAU$6); g.fill();
      g.fillStyle = C.engr; g.beginPath(); g.arc(cx, cy, bw * 0.12, 0, TAU$6); g.fill();
    }
    out[pass] = c;
  }
  return out;
}

function scaleRings(g, C, T, cx, cy, r0, r1, n) {
  const x = T.X(cx), y = T.Y(cy);
  g.strokeStyle = C.engr;
  for (const r of [r0, r1]) circle(g, x, y, r * T.k, 0.00045 * T.k);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU$6 + Math.PI / 2;
    tick$1(g, x, y, a, r0 * T.k, (i % 6 === 0 ? r1 : r0 + (r1 - r0) * 0.55) * T.k, (i % 6 === 0 ? 0.0004 : 0.00028) * T.k);
  }
}

const ZODIAC$1 = ['ΚΡΙΟΣ', 'ΤΑΥΡΟΣ', 'ΔΙΔΥΜΟΙ', 'ΚΑΡΚΙΝΟΣ', 'ΛΕΩΝ', 'ΠΑΡΘΕΝΟΣ', 'ΧΗΛΑΙ', 'ΣΚΟΡΠΙΟΣ', 'ΤΟΞΟΤΗΣ', 'ΑΙΓΟΚΕΡΩΣ', 'ΥΔΡΟΧΟΟΣ', 'ΙΧΘΥΕΣ'];
const EGYPT = ['ΘΩΘ', 'ΦΑΩΦΙ', 'ΑΘΥΡ', 'ΧΟΙΑΚ', 'ΤΥΒΙ', 'ΜΕΧΙΡ', 'ΦΑΜΕΝΩΘ', 'ΦΑΡΜΟΥΘΙ', 'ΠΑΧΩΝ', 'ΠΑΥΝΙ', 'ΕΠΙΦΙ', 'ΜΕΣΟΡΗ'];
const CORINTH = ['ΦΟΙΝ', 'ΚΡΑΝ', 'ΛΑΝΟ', 'ΜΑΧΑ', 'ΔΩΔΕ', 'ΕΥΚΛ', 'ΑΡΤΕ', 'ΨΥΔΡ', 'ΓΑΜΕ', 'ΑΓΡΙ', 'ΠΑΝΑ', 'ΑΠΕΛ'];
const OLYMPIAD = [['ΙΣΘΜΙΑ', 'ΟΛΥΜΠΙΑ'], ['ΝΕΜΕΑ', 'ΝΑΑ'], ['ΙΣΘΜΙΑ', 'ΠΥΘΙΑ'], ['ΝΕΜΕΑ', 'ΑΛΙΕΙΑ']];
const PARAPEGMA_TOP = ['ΠΛΕΙΑΣ ΕΠΙΤΕΛΛΕΙ ΕΩΙΑ Α', 'ΥΑΔΕΣ ΕΠΙΤΕΛΛΟΥΣΙΝ ΕΩΙΑΙ Β', 'ΑΡΚΤΟΥΡΟΣ ΔΥΝΕΙ ΕΩΙΟΣ Γ', 'ΛΥΡΑ ΕΠΙΤΕΛΛΕΙ ΕΣΠΕΡΙΑ Δ', 'ΚΥΩΝ ΕΠΙΤΕΛΛΕΙ ΕΩΙΟΣ Ε'];
const PARAPEGMA_BOT = ['ΑΕΤΟΣ ΕΠΙΤΕΛΛΕΙ ΕΣΠΕΡΙΟΣ Ζ', 'ΑΙΞ ΕΠΙΤΕΛΛΕΙ ΕΣΠΕΡΙΑ Η', 'ΩΡΙΩΝ ΑΡΧΕΤΑΙ ΕΠΙΤΕΛΛΕΙΝ Θ', 'ΣΤΑΧΥΣ ΕΠΙΤΕΛΛΕΙ ΕΩΙΟΣ Ι', 'ΑΡΚΤΟΥΡΟΣ ΕΠΙΤΕΛΛΕΙ ΕΣΠΕΡΙΟΣ Κ'];
const PARA_W = 0.17, PARA_H = 0.051, PARA_Y = 0.1235;

const METONIC = { turns: 5, cells: 235, r0: 0.045, r1: 0.068, disc: 0.0715, a0: -Math.PI / 2 };
const SAROS_D = { turns: 4, cells: 223, r0: 0.030, r1: 0.060, disc: 0.0635, a0: Math.PI / 2 };
const spiralR = (D, psi) => D.r0 + (D.r1 - D.r0) * (psi / (D.turns * TAU$6));
const OLY_R = 0.0095, EXE_R = 0.0095;

const K_WHEEL = 0, K_TURNED = 1, K_FILED = 2, K_WOOD = 3, K_GEM = 4, K_MOON = 5, K_SLIDE = 8;
const RC_POLISH = 1, RC_MATT = 2, RC_ROUGH = 3;
const TINT = {
  gold: [1.0, 0.8, 0.4], dark: [0.40, 0.27, 0.15], silver: [0.95, 0.96, 0.98], arbor: [0.72, 0.52, 0.32],
  bronze: [0.88, 0.58, 0.28], red: [0.92, 0.48, 0.28], pale: [0.96, 0.70, 0.40], copper: [0.95, 0.56, 0.38],
};

function fill(n, size, vals) {
  const a = new Float32Array(n * size);
  for (let i = 0; i < n; i++) for (let j = 0; j < size; j++) a[i * size + j] = vals[j];
  return a;
}

function prep(geo, { kind = K_FILED, wear = 0, rough = 0, tint = null, uv = false } = {}) {
  if (!uv && geo.attributes.uv) geo.deleteAttribute('uv');
  if (geo.attributes.uv1) geo.deleteAttribute('uv1');
  const n = geo.attributes.position.count;
  if (!geo.index) {
    const idx = new Uint32Array(n);
    for (let i = 0; i < n; i++) idx[i] = i;
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
  }
  if (!geo.attributes.normal) geo.computeVertexNormals();
  if (!geo.attributes.color) geo.setAttribute('color', new THREE.BufferAttribute(fill(n, 3, tint || [1, 1, 1]), 3));
  if (!geo.attributes.aBz) geo.setAttribute('aBz', new THREE.BufferAttribute(fill(n, 4, [0, kind, wear, rough]), 4));
  geo.clearGroups();
  return geo;
}

function planarUV(geo, Rd) {
  const p = geo.attributes.position;
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) { uv[i * 2] = p.getX(i) / (2 * Rd) + 0.5; uv[i * 2 + 1] = p.getY(i) / (2 * Rd) + 0.5; }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geo;
}

function wearBevels(geo, wear = 0.9) {
  const n = geo.attributes.normal, a = geo.attributes.aBz;
  for (let i = 0; i < n.count; i++) {
    if (Math.max(Math.abs(n.getX(i)), Math.abs(n.getY(i)), Math.abs(n.getZ(i))) < 0.97) a.setZ(i, Math.max(a.getZ(i), wear));
  }
  return geo;
}

function merge$1(list) {
  const g = mergeGeometries(list, false);
  if (!g) throw new Error('mechanism: geometry merge failed');
  for (const x of list) x.dispose();
  return g;
}

function turned(pts, { segs = 32, closed = false, kind = K_TURNED, tint = null, rough = 0, phi = 0 } = {}) {
  const P = pts.map((p) => ({ r: Math.max(0, p[0]), z: p[1], w: p[2] || 0, sm: !!p[3] }));
  const n = P.length;
  const nSeg = closed ? n : n - 1;
  const seg = [];
  let total = 0;
  for (let j = 0; j < nSeg; j++) {
    const a = P[j], b = P[(j + 1) % n];
    const dr = b.r - a.r, dz = b.z - a.z, L = Math.hypot(dr, dz);
    seg.push({ nr: L > 1e-12 ? dz / L : 0, nz: L > 1e-12 ? -dr / L : 0, len: L });
    total += L;
  }
  for (let j = 1; j < nSeg; j++) if (seg[j].len <= 1e-12) { seg[j].nr = seg[j - 1].nr; seg[j].nz = seg[j - 1].nz; }
  for (let j = nSeg - 2; j >= 0; j--) if (seg[j].nr === 0 && seg[j].nz === 0) { seg[j].nr = seg[j + 1].nr; seg[j].nz = seg[j + 1].nz; }
  const rings = [];
  let s = 0;
  for (let j = 0; j < n; j++) {
    const p = P[j];
    if (j > 0) s += seg[j - 1].len;
    const inS = j > 0 ? seg[j - 1] : (closed ? seg[nSeg - 1] : null);
    const outS = j < nSeg ? seg[j] : null;
    const mk = (nr, nz, sv, link) => rings.push({ r: p.r, z: p.z, nr, nz, s: sv, w: p.w, link });
    if (inS && outS && p.sm && !(closed && j === 0)) {
      const ar = inS.nr + outS.nr, az = inS.nz + outS.nz, L = Math.hypot(ar, az) || 1;
      mk(ar / L, az / L, s, true);
    } else if (inS && outS) {
      mk(inS.nr, inS.nz, closed && j === 0 ? total : s, false);
      mk(outS.nr, outS.nz, s, true);
    } else {
      const S0 = inS || outS;
      mk(S0.nr, S0.nz, s, true);
    }
  }
  const t = tint || [1, 1, 1];
  const nR = rings.length, nV = nR * segs;
  const pos = new Float32Array(nV * 3), nor = new Float32Array(nV * 3), col = new Float32Array(nV * 3), abz = new Float32Array(nV * 4);
  let v = 0;
  for (const rg of rings) {
    for (let i = 0; i < segs; i++) {
      const a = phi + (i / segs) * TAU$6, c = Math.cos(a), sn = Math.sin(a);
      pos[v * 3] = rg.r * c; pos[v * 3 + 1] = rg.r * sn; pos[v * 3 + 2] = rg.z;
      nor[v * 3] = rg.nr * c; nor[v * 3 + 1] = rg.nr * sn; nor[v * 3 + 2] = rg.nz;
      col[v * 3] = t[0]; col[v * 3 + 1] = t[1]; col[v * 3 + 2] = t[2];
      abz[v * 4] = rg.s; abz[v * 4 + 1] = kind; abz[v * 4 + 2] = rg.w; abz[v * 4 + 3] = rough;
      v++;
    }
  }
  const idx = [];
  for (let k = 0; k < nR; k++) {
    const rg = rings[k];
    const nk = k + 1 < nR ? k + 1 : (closed ? 0 : -1);
    if (!rg.link || nk < 0) continue;
    const rn = rings[nk];
    if (rg.r < 1e-9 && rn.r < 1e-9) continue;
    for (let i = 0; i < segs; i++) {
      const i1 = (i + 1) % segs;
      const a = k * segs + i, b = k * segs + i1, c = nk * segs + i, d = nk * segs + i1;
      idx.push(a, b, c, b, d, c);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('aBz', new THREE.BufferAttribute(abz, 4));
  g.setIndex(idx);
  return g;
}

function arcPts(cr, cz, rr, rz, a0, a1, n, wear = 0) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + (a1 - a0) * (i / n);
    out.push([cr + rr * Math.cos(a), cz + rz * Math.sin(a), wear, 1]);
  }
  return out;
}

function pinGeo(r, z0, z1, h, o = {}) {
  return turned([[0, z0], [r * 0.8, z0], [r, z0 + r * 0.2, 0.4], [r, z1, 0.3], ...arcPts(0, z1, r, h, 0, Math.PI / 2, 4, 0.9)], { segs: o.segs || 10, ...o });
}

function roundRectShape(w, h, r, cx = 0, cy = 0) {
  const s = new THREE.Shape();
  const x0 = cx - w / 2, y0 = cy - h / 2, x1 = cx + w / 2, y1 = cy + h / 2;
  s.moveTo(x0 + r, y0);
  s.lineTo(x1 - r, y0); s.quadraticCurveTo(x1, y0, x1, y0 + r);
  s.lineTo(x1, y1 - r); s.quadraticCurveTo(x1, y1, x1 - r, y1);
  s.lineTo(x0 + r, y1); s.quadraticCurveTo(x0, y1, x0, y1 - r);
  s.lineTo(x0, y0 + r); s.quadraticCurveTo(x0, y0, x0 + r, y0);
  return s;
}

function slab(shape, depth, bevel, o = {}) {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel,
    bevelSegments: o.bevelSegs || 2, curveSegments: o.curveSegs || 8,
  });
  g.translate(0, 0, -depth / 2);
  return prep(g, o);
}

function block(w, h, d, bevel, o = {}) {
  return slab(roundRectShape(w - 2 * bevel, h - 2 * bevel, Math.min(w, h) * 0.08), d - 2 * bevel, bevel, o);
}

function taperShape(x0, x1, w0, w1) {
  const s = new THREE.Shape();
  s.moveTo(x0, -w0);
  s.lineTo(x1, -w1);
  s.absarc(x1, 0, w1, -Math.PI / 2, Math.PI / 2, false);
  s.lineTo(x0, w0);
  s.lineTo(x0, -w0);
  return s;
}

const TO_X = new THREE.Matrix4().makeBasis(new V3$1(0, 1, 0), new V3$1(0, 0, 1), new V3$1(1, 0, 0));
const Z_TO_X = new THREE.Matrix4().makeRotationY(Math.PI / 2);

const BZ_VERT_DECL = `
attribute vec4 aBz;
uniform float bzSlide;
varying vec4 vBzP;
varying vec4 vBzN;
`;

const BZ_VERT = `
{
  float bzK = aBz.y;
  float bzSl = step(7.5, bzK);
  bzK -= 8.0 * bzSl;
  transformed.x += bzSl * bzSlide;
  vec3 bzOP = transformed;
  vec3 bzON = objectNormal;
  #ifdef USE_INSTANCING
    bzOP = (instanceMatrix * vec4(bzOP, 1.0)).xyz;
    bzON = mat3(instanceMatrix) * bzON;
  #endif
  vBzP = vec4(bzOP, aBz.w * 32.0 + bzK * 4.0 + clamp(aBz.z, -1.0, 1.0) + 1.0);
  vBzN = vec4(bzON, aBz.x);
}
`;

const BZ_FRAG_DECL = `
#ifndef USE_NORMALMAP_OBJECTSPACE
uniform mat3 normalMatrix;
#endif
uniform float bzGlow;
uniform float bzCorr;
uniform float bzSeed;
uniform float bzTime;
uniform float bzEngr;
uniform vec4 bzGear;
uniform vec4 bzFlow;
uniform vec4 bzTip;
uniform vec3 bzTipCol;
uniform vec3 bzGem;
uniform vec4 bzMoon;
uniform vec3 bzMoonC;
uniform vec4 bzLight;
uniform vec4 bzDial;
uniform vec4 bzDial2;
uniform vec4 bzDial3;
uniform float bzLift;
uniform vec2 bzLu;
uniform vec4 bzSock;
uniform float bzSockK;
uniform float bzBack;
uniform vec4 bzSpir;
#ifdef BZ_LOOSE
uniform float bzSweep;
uniform float bzSweepK;
uniform float bzHover;
uniform float bzHint;
uniform vec2 bzTeeth;
#endif
varying vec4 vBzP;
varying vec4 vBzN;
float bzSiltM;
float bzSpPsi;
float bzSpIn;
float bzKind;
float bzWear;
float bzRcls;
float bzPx;
float bzU;
float bzSlopeU;
float bzEdge;
float bzEngMask;
float bzRoughMul;
float bzRoughAdd;
float bzMetMul;
vec3 bzGobj;
vec3 bzPitG;
float bzDialE;
float bzDialI;
float bzWoodSheen;
float bzHash1(float p) { p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
float bzHash3(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
float bzNoise1(float x) { float i = floor(x); float f = fract(x); f = f * f * (3.0 - 2.0 * f); return mix(bzHash1(i), bzHash1(i + 1.0), f); }
float bzNoise3(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  float a = mix(bzHash3(i), bzHash3(i + vec3(1.0, 0.0, 0.0)), f.x);
  float b = mix(bzHash3(i + vec3(0.0, 1.0, 0.0)), bzHash3(i + vec3(1.0, 1.0, 0.0)), f.x);
  float c = mix(bzHash3(i + vec3(0.0, 0.0, 1.0)), bzHash3(i + vec3(1.0, 0.0, 1.0)), f.x);
  float d = mix(bzHash3(i + vec3(0.0, 1.0, 1.0)), bzHash3(i + vec3(1.0, 1.0, 1.0)), f.x);
  return mix(mix(a, b, f.y), mix(c, d, f.y), f.z);
}
float bzFade(float period) { return 1.0 - smoothstep(0.3, 0.75, bzPx / period); }
float bzLine(float d, float w) { return clamp((w - abs(d)) / bzPx + 0.5, 0.0, 1.0) * clamp(2.0 * w / bzPx, 0.0, 1.0); }
float bzTicks(float r, float th, float stp, float ph, float ra, float rb, float w) {
  float d = abs(fract((th - ph) / stp + 0.5) - 0.5) * stp * r;
  return bzLine(d, w) * clamp((r - ra) / bzPx + 0.5, 0.0, 1.0) * clamp((rb - r) / bzPx + 0.5, 0.0, 1.0);
}
float bzAtan(vec2 v) { return atan(v.y, abs(v.x) + abs(v.y) < 1e-9 ? 1.0 : v.x); }
float bzScratchAt(vec2 q, float cell, float seed) {
  vec2 c = floor(q / cell);
  float h = bzHash3(vec3(c, seed));
  if (h < 0.4) return 0.0;
  float a = bzHash3(vec3(c, seed + 1.3)) * 3.14159265;
  vec2 dir = vec2(cos(a), sin(a));
  vec2 ctr = (c + 0.3 + 0.4 * vec2(bzHash3(vec3(c, seed + 2.1)), bzHash3(vec3(c, seed + 3.7)))) * cell;
  float hl = cell * (0.1 + 0.18 * bzHash3(vec3(c, seed + 4.9)));
  vec2 d = q - ctr;
  float t = clamp(dot(d, dir), -hl, hl);
  return bzLine(length(d - dir * t), cell * 0.006) * (h - 0.4) * 1.6;
}
`;

const BZ_FRAG_MAP = `
{
  vec3 bzP = vBzP.xyz;
  float bzPack = vBzP.w;
  bzRcls = floor((bzPack + 0.01) / 32.0);
  float bzKW = bzPack - bzRcls * 32.0;
  bzKind = floor((bzKW + 0.01) * 0.25);
  bzWear = clamp(bzKW - bzKind * 4.0 - 1.0, -1.0, 1.0);
  vec3 bzNo = normalize(vBzN.xyz);
  bzPx = max(max(length(dFdx(bzP)), length(dFdy(bzP))), 1e-7);
  float bzFace = step(0.7, abs(bzNo.z));
  float bzR = length(bzP.xy);
  float bzMetal = 1.0 - step(2.5, bzKind);
  float bzContact = step(0.5, bzRcls) * (1.0 - step(1.5, bzRcls));
  bzEngMask = 0.0;
  bzDialE = 0.0;
  bzDialI = 0.0;
  bzWoodSheen = 0.0;
  bzSiltM = 0.0;
  bzSpPsi = -100.0;
  bzSpIn = 0.0;
  bzGobj = vec3(0.0);
  bzU = vBzN.w;
  float bzNA = bzNoise3(bzP * 28.0 + bzSeed);
  float bzNB = bzNoise3(bzP * 85.0 + bzSeed * 1.7 + 3.0);
  float bzNC = mix(0.5, bzNoise3(bzP * 260.0 + 11.0 + bzSeed), bzFade(0.004));
  float bzNE = bzNoise3(bzP * 60.0 + 41.0 + bzSeed * 0.3);
  float bzL = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
  vec3 bzMet = mix(vec3(bzL), diffuseColor.rgb, 0.8) * mix(mix(0.5, 0.62, bzLift), 0.8, bzContact);
  bzMet *= mix(vec3(1.08, 0.86, 0.78), vec3(1.0, 1.02, 0.86), smoothstep(0.3, 0.72, bzNA)) * (0.9 + 0.2 * bzNC);
  float bzFlank = 0.0;
  if (bzKind < 0.5 && bzGear.x > 0.0) bzFlank = (1.0 - bzFace) * smoothstep(bzGear.x - 0.0001, bzGear.x + 0.0002, bzR);
  float bzStroke = 1.0;
  if (bzKind < 0.5) {
    vec2 bzT = vec2(-bzNo.y, bzNo.x);
    bzT = dot(bzT, bzT) > 1e-8 ? normalize(bzT) : vec2(1.0, 0.0);
    vec2 bzFd = vec2(cos(bzSeed * 2.39), sin(bzSeed * 2.39));
    bzU = bzFace > 0.5 ? dot(bzP.xy, bzFd) + 0.00018 * (bzNoise3(bzP * 1600.0 + bzSeed) - 0.5) : dot(bzP.xy, bzT);
    bzGobj = bzFace > 0.5 ? vec3(bzFd, 0.0) : vec3(bzT, 0.0);
    bzStroke = bzFace > 0.5 ? 0.12 + 0.45 * smoothstep(0.35, 0.8, bzNB) : 0.8;
  } else if (bzKind > 1.5 && bzKind < 2.5) {
    float bzAng = 0.35 + 1.4 * bzNA;
    vec2 bzD = vec2(cos(bzAng), sin(bzAng));
    bzU = bzFace > 0.5 ? dot(bzP.xy, bzD) : bzP.z;
    bzGobj = bzFace > 0.5 ? vec3(bzD, 0.0) : vec3(0.0, 0.0, 1.0);
  }
  float bzF1 = bzFade(0.00016) * bzMetal * (1.0 - 0.7 * bzFlank) * bzStroke;
  float bzF2 = bzFade(0.0007) * bzMetal * (1.0 - 0.7 * bzFlank) * bzStroke;
  float bzX1 = bzU / 0.00016;
  float bzX2 = bzU / 0.0007;
  float bzA1 = 0.35 + 0.65 * bzNoise1(bzX1 * 0.19 + bzSeed * 7.0);
  float bzA2 = smoothstep(0.3, 0.95, bzNoise1(bzX2 * 0.37 + bzSeed * 3.0));
  float bzGroove = (0.5 + 0.5 * sin(6.2831853 * bzX1)) * bzA1 * bzF1 * 0.5 + (0.5 + 0.5 * sin(6.2831853 * bzX2)) * bzA2 * bzF2;
  bzSlopeU = cos(6.2831853 * bzX1) * bzA1 * bzF1 * 0.10 + cos(6.2831853 * bzX2) * bzA2 * bzF2 * 0.16;
  vec3 bzCi = floor(bzP / 0.0014);
  float bzHp = bzHash3(bzCi + bzSeed);
  vec3 bzJ = vec3(bzHash3(bzCi + 17.1), bzHash3(bzCi + 41.7), bzHash3(bzCi + 73.3));
  vec3 bzDv = bzP - (bzCi + 0.3 + 0.4 * bzJ) * 0.0014;
  float bzPr = 0.0014 * (0.06 + 0.14 * bzHash3(bzCi + 5.9));
  float bzDl = length(bzDv);
  float bzPitF = step(0.64 - 0.34 * bzNE, bzHp) * bzFade(bzPr * 2.0) * bzMetal * (1.0 - bzContact);
  float bzPit = (1.0 - smoothstep(bzPr * 0.55, bzPr, bzDl)) * bzPitF;
  bzPitG = bzDl < bzPr ? bzDv * (0.9 * bzPitF / bzPr) : vec3(0.0);
  vec3 bzCd = floor(bzP / 0.0065);
  if (bzMetal > 0.5 && bzHash3(bzCd + 29.3 + bzSeed) > 0.8) {
    vec3 bzJd = vec3(bzHash3(bzCd + 1.9), bzHash3(bzCd + 8.3), bzHash3(bzCd + 15.7));
    vec3 bzDd = bzP - (bzCd + 0.3 + 0.4 * bzJd) * 0.0065;
    float bzRd = 0.0065 * (0.06 + 0.12 * bzHash3(bzCd + 4.4));
    if (length(bzDd) < bzRd) bzPitG += bzDd * (0.35 * bzFade(bzRd * 1.5) / bzRd);
  }
  float bzCav = max(-bzWear, 0.0);
  float bzEdg = max(bzWear, 0.0);
  float bzCham = smoothstep(0.3, 0.5, abs(bzNo.z)) * (1.0 - smoothstep(0.86, 0.97, abs(bzNo.z)));
  float bzScr = 0.0;
  if (bzGear.x > 0.0 && bzKind < 1.5) {
    float bzSc = bzLine(bzR - (bzGear.x - 0.0003), 0.00004);
    if (bzGear.w > 0.0) bzSc = max(bzSc, bzLine(bzR - (bzGear.w + 0.0006), 0.00004));
    else bzSc = max(bzSc, bzLine(bzR - 0.5 * (bzGear.z + bzGear.x), 0.000035));
    bzSc = max(bzSc, bzLine(bzR - (bzGear.z - 0.00045), 0.00003));
    bzScr = bzSc * bzFace;
    bzCav = max(bzCav, bzScr);
    if (bzKind < 0.5) {
      bzEdg = max(bzEdg, max(bzCham, 0.8 * smoothstep(bzGear.y - 0.00035, bzGear.y - 0.00003, bzR)));
      bzCav = max(bzCav, 0.7 * (1.0 - smoothstep(bzGear.x - 0.0001, bzGear.x + 0.0003, bzR)) * smoothstep(bzGear.x - 0.0009, bzGear.x - 0.0002, bzR));
    }
  } else if (bzKind > 1.5 && bzKind < 2.5) {
    bzEdg = max(bzEdg, bzCham);
  }
  #ifdef USE_BUMPMAP
    bzEngMask = smoothstep(0.5, 0.9, 1.0 - texture2D(bumpMap, vBumpMapUv).r);
    bzCav = max(bzCav, bzEngMask * 0.8);
  #endif
  bzEngMask = max(bzEngMask, bzScr);
  #ifdef BZ_DIAL
  {
    float bzE = 0.0;
    float bzTh = bzAtan(bzP.xy);
    if (bzDial.x < 1.5) {
      float bzDg = 0.017453293;
      float bzZ = 0.0;
      bzZ = max(bzZ, bzLine(bzR - 0.066, 0.00016));
      bzZ = max(bzZ, bzLine(bzR - 0.0752, 0.00008));
      bzZ = max(bzZ, bzLine(bzR - 0.0785, 0.00016));
      bzZ = max(bzZ, bzTicks(bzR, bzTh, bzDg, 0.0, 0.0752, 0.0785, 0.00005));
      bzZ = max(bzZ, bzTicks(bzR, bzTh, bzDg, 0.5 * bzDg, 0.0768, 0.0785, 0.000035));
      bzZ = max(bzZ, bzTicks(bzR, bzTh, 5.0 * bzDg, 0.0, 0.0735, 0.0785, 0.00007));
      bzZ = max(bzZ, bzTicks(bzR, bzTh, 30.0 * bzDg, 0.0, 0.0662, 0.0785, 0.00011));
      bzDialI = bzZ;
      float bzDay = 6.2831853 / 365.0;
      bzE = max(bzE, bzLine(bzR - 0.0795, 0.00013));
      bzE = max(bzE, bzLine(bzR - 0.0806, 0.00005));
      bzE = max(bzE, bzLine(bzR - 0.0892, 0.00008));
      bzE = max(bzE, bzLine(bzR - 0.0903, 0.00005));
      bzE = max(bzE, bzLine(bzR - 0.0918, 0.00013));
      bzE = max(bzE, bzTicks(bzR, bzTh, bzDay, 1.5707963, 0.0892, 0.0918, 0.00005));
      float bzCal = mod(1.5707963 - bzTh + 2.5 * bzDay, 6.2831853) - 2.5 * bzDay;
      bzE = max(bzE, bzTicks(bzR, bzCal, bzDay * 30.0, 0.0, 0.0795, 0.0918, 0.0001));
      for (int i = 0; i < 5; i++) bzE = max(bzE, 0.7 * bzLine(bzR - (0.028 + 0.006 * float(i)), 0.00007));
    } else {
      float bzPitch = (bzDial.z - bzDial.y) / bzDial.w;
      float bzPsi0 = mod(bzDial2.z - bzTh, 6.2831853);
      float bzF = (bzR - (bzDial.y - 0.5 * bzPitch)) / bzPitch - bzPsi0 / 6.2831853;
      float bzK = clamp(floor(bzF + 0.5), 0.0, bzDial.w);
      bzE = max(bzE, bzLine(bzR - (bzDial.y - 0.5 * bzPitch + bzPitch * (bzPsi0 / 6.2831853 + bzK)), 0.00015));
      float bzPsi = bzPsi0 + 6.2831853 * floor(bzF);
      float bzIn = step(0.0, bzPsi) * step(bzPsi, bzDial.w * 6.2831853);
      bzSpPsi = bzPsi;
      bzSpIn = bzIn;
      float bzCs = bzDial.w * 6.2831853 / bzDial2.x;
      bzE = max(bzE, bzLine(abs(fract(bzPsi / bzCs + 0.5) - 0.5) * bzCs * bzR, 0.00009) * bzIn);
      bzE = max(bzE, 0.22 * bzLine(mod(bzR, 0.0012) - 0.0006, 0.00004));
      bzE = max(bzE, bzLine(bzR - bzDial2.w, 0.00016));
      vec2 bzSq = bzP.xy - bzDial3.xy;
      float bzSr = length(bzSq);
      if (bzSr < bzDial3.z + 0.001) {
        bzE = max(bzE, bzLine(bzSr - (bzDial3.z - 0.0004), 0.00011));
        bzE = max(bzE, bzTicks(bzSr, bzAtan(bzSq), 6.2831853 / bzDial3.w, bzDial2.y, 0.0, bzDial3.z - 0.0004, 0.00008));
      }
    }
    bzDialE = bzE;
    bzEngMask = max(bzEngMask, max(bzE, bzDialI));
    bzCav = max(bzCav, bzE * 0.85);
  }
  #endif
  bzEdge = clamp(bzEdg, 0.0, 1.0);
  float bzBl = bzKind < 0.5 ? 0.14 : 0.28;
  float bzCover = mix(0.3, 0.24, bzLift) + mix(0.62, 0.56, bzLift) * smoothstep(0.5 - bzBl, 0.5 + bzBl, bzNA * 0.5 + bzNB * 0.32 + bzNC * 0.18);
  bzCover = max(bzCover, min(1.0, bzCav * 0.9 + 0.1));
  bzCover = mix(bzCover, 1.0, bzEdge * 0.35 * (1.0 - bzContact) * (1.0 - 0.6 * bzLift));
  float bzRub = max(bzContact * clamp(0.35 + 0.65 * bzEdge, 0.0, 1.0), bzFlank * 0.8) * (0.7 + 0.3 * bzNB);
  bzCover *= (1.0 - 0.85 * bzRub) * bzMetal;
  vec3 bzPat = mix(vec3(0.032, 0.021, 0.014), vec3(0.072, 0.060, 0.031), smoothstep(0.3, 0.72, bzNB * 0.7 + bzNC * 0.3));
  vec3 bzVerd = vec3(0.036, 0.105, 0.072) * (0.8 + 0.4 * bzNC);
  float bzGreen = clamp(smoothstep(0.55, 0.85, bzNE) * 0.55 + bzCav * 0.55 + bzEdge * 0.45 * (1.0 - bzContact), 0.0, 1.0);
  bzPat = mix(bzPat, bzVerd, bzGreen);
  if (bzKind < 0.5) bzPat = mix(bzPat, vec3(0.085, 0.032, 0.02) * (0.8 + 0.4 * bzNC), smoothstep(0.62, 0.85, 1.0 - bzNE) * 0.55);
  float bzStreak = smoothstep(0.62, 0.9, bzNoise3(vec3(bzP.x * 420.0, bzP.y * 26.0, bzP.z * 420.0) + bzSeed)) * bzFade(0.0024) * bzMetal;
  bzPat = mix(bzPat, bzNB > 0.5 ? vec3(0.016, 0.012, 0.009) : bzVerd * 0.7, bzStreak * 0.55);
  bzCover = max(bzCover, bzStreak * 0.6 * (1.0 - bzRub));
  bzPat *= mix(1.0, 2.1, bzLift);
  bzPat *= 1.0 - 0.45 * bzCav;
  #ifdef USE_MAP
    bzCover *= 0.72;
    bzPat = bzPat * mix(1.6, 1.15, bzLift) + vec3(0.01, 0.008, 0.004);
  #endif
  bzSlopeU *= 1.0 - 0.5 * bzCover;
  vec3 bzCs = floor(bzP / 0.0024);
  float bzSpot = 0.0;
  if (bzMetal > 0.5 && bzHash3(bzCs + 51.0 + bzSeed) > 0.9 - 0.45 * bzNE - 0.3 * bzCav) {
    vec3 bzJs = vec3(bzHash3(bzCs + 3.3), bzHash3(bzCs + 7.7), bzHash3(bzCs + 13.1));
    float bzRs = 0.0024 * (0.08 + 0.16 * bzHash3(bzCs + 19.9));
    float bzLs = length(bzP - (bzCs + 0.25 + 0.5 * bzJs) * 0.0024);
    bzSpot = (1.0 - smoothstep(bzRs * 0.35, bzRs, bzLs)) * bzFade(bzRs * 1.5) * (1.0 - bzRub);
  }
  vec3 bzAn = abs(bzNo);
  vec2 bzS2 = bzAn.z > max(bzAn.x, bzAn.y) ? bzP.xy : (bzAn.x > bzAn.y ? bzP.yz : bzP.xz);
  float bzScratch = clamp(bzScratchAt(bzS2, 0.0031, bzSeed) + bzScratchAt(bzS2 + 0.37, 0.0017, bzSeed + 5.0), 0.0, 1.0) * bzMetal;
  vec3 bzAlb = bzMet * (1.0 - 0.12 * bzGroove);
  bzAlb = mix(bzAlb, bzAlb * 1.35 + vec3(0.03, 0.022, 0.01), clamp(bzRub * 0.8 + bzFlank * 0.15, 0.0, 1.0));
  bzAlb = mix(bzAlb, bzPat * (0.85 + 0.3 * bzNC), bzCover);
  bzAlb = mix(bzAlb, vec3(0.012, 0.009, 0.007), bzPit * 0.85);
  bzAlb = mix(bzAlb, vec3(0.30, 0.42, 0.32) * (0.85 + 0.3 * bzNC), bzSpot);
  bzAlb = mix(bzAlb, bzMet * 1.15, bzScratch * 0.45 * (1.0 - bzSpot));
  bzRoughMul = mix(mix(0.6, 0.42, bzRub) * (1.0 + 0.3 * bzGroove) * mix(1.0, 0.8, bzFlank), 0.0, bzCover);
  bzRoughAdd = mix(mix(0.33, 0.2, bzRub), mix(0.66, 0.54, bzLift) + 0.12 * bzNC + 0.08 * bzCav, bzCover) + 0.15 * bzPit + 0.2 * bzSpot - 0.08 * bzScratch;
  bzMetMul = mix(0.95, mix(0.12, 0.2, bzLift), bzCover) * (1.0 - 0.9 * bzSpot) * (1.0 - 0.6 * bzPit);
  float bzSpec = bzEdge * bzLift * bzMetal * (1.0 - bzSpot);
  bzAlb = mix(bzAlb, bzMet * 1.35 + vec3(0.022, 0.016, 0.008), 0.36 * bzSpec);
  bzRoughAdd -= 0.26 * bzSpec;
  bzMetMul = mix(bzMetMul, 0.88, 0.62 * bzSpec);
  #ifdef BZ_DIAL
    bzAlb *= 1.0 - 0.65 * bzDialE;
    bzAlb = mix(bzAlb, vec3(0.5, 0.34, 0.12) * (0.9 + 0.2 * bzNC), bzDialI * 0.9);
    bzRoughAdd += 0.2 * bzDialE - 0.12 * bzDialI;
    bzMetMul = mix(bzMetMul, 1.0, bzDialI);
  #endif
  if (bzKind > 2.5 && bzKind < 3.5) {
    vec3 bzGp = bzRcls < 0.5 ? bzP : (bzRcls < 1.5 ? bzP.yzx : bzP.zxy);
    float bzG1 = bzNoise3(vec3(bzGp.x * 45.0, bzGp.y * 420.0, bzGp.z * 420.0) + bzSeed);
    float bzG2 = mix(0.5, bzNoise3(vec3(bzGp.x * 90.0, bzGp.y * 1500.0, bzGp.z * 1500.0)), bzFade(0.0007));
    float bzChk = smoothstep(0.78, 0.95, bzNoise3(vec3(bzGp.x * 70.0, bzGp.y * 900.0, bzGp.z * 900.0) + 7.0)) * bzFade(0.0011);
    float bzHeld = bzEdge * (0.6 + 0.4 * bzNB);
    vec3 bzWood = mix(vec3(0.081, 0.047, 0.025), vec3(0.221, 0.13, 0.068), bzG1 * 0.7 + bzG2 * 0.3) * (0.7 + 0.45 * bzNA);
    bzWood = mix(bzWood, bzWood * 1.5 + vec3(0.02, 0.012, 0.006), bzHeld * 0.6);
    bzAlb = bzWood * (1.0 - 0.55 * bzChk) * (1.0 - 0.55 * bzCav) * (0.85 + 0.3 * bzNC);
    bzRoughMul = 0.0; bzRoughAdd = mix(0.74, 0.46, bzHeld) + 0.1 * bzChk; bzMetMul = 0.0;
    bzWoodSheen = bzHeld;
  } else if (bzKind > 3.5 && bzKind < 4.5) {
    bzAlb = bzGem;
    bzRoughMul = 0.0; bzRoughAdd = 0.12; bzMetMul = 0.1;
  } else if (bzKind > 4.5) {
    float bzLit = smoothstep(-0.00035, 0.00035, dot(bzP - bzMoonC, bzMoon.xyz));
    bzAlb = mix(vec3(0.02, 0.018, 0.016), vec3(0.74, 0.73, 0.70) * (0.9 + 0.2 * bzNC), bzLit);
    bzRoughMul = 0.0; bzRoughAdd = mix(0.6, 0.3, bzLit); bzMetMul = bzLit;
  }
  diffuseColor.rgb = bzAlb;
}
`;

const BZ_FRAG_ROUGH = `
roughnessFactor = clamp(roughnessFactor * bzRoughMul + bzRoughAdd, 0.035, 1.0);
roughnessFactor = mix(roughnessFactor, 0.95, bzSiltM);
`;

const BZ_FRAG_METAL = `
metalnessFactor *= bzMetMul;
metalnessFactor = mix(metalnessFactor, 0.0, bzSiltM);
`;

const BZ_FRAG_NORMAL = `
{
  vec3 bzVp = -vViewPosition;
  vec3 bzSx = dFdx(bzVp);
  vec3 bzSy = dFdy(bzVp);
  float bzUx = dFdx(bzU);
  float bzUy = dFdy(bzU);
  vec3 bzR1 = cross(bzSy, normal);
  vec3 bzR2 = cross(normal, bzSx);
  float bzDet = dot(bzSx, bzR1);
  vec3 bzGv = (bzUx * bzR1 + bzUy * bzR2) * (bzDet < 0.0 ? -1.0 : 1.0);
  vec3 bzG = (bzKind > 0.5 && bzKind < 1.5) ? bzGv : normalMatrix * bzGobj;
  bzG -= normal * dot(normal, bzG);
  float bzGl = length(bzG);
  bzG = bzGl > 1e-12 ? bzG / bzGl : vec3(0.0);
  vec3 bzPg = normalMatrix * bzPitG;
  float bzPl = length(bzPg);
  bzPg = bzPl > 1e-12 ? bzPg * (length(bzPitG) / bzPl) : vec3(0.0);
  bzPg -= normal * dot(normal, bzPg);
  float bzMic = 1.0 - smoothstep(0.05, 0.6, bzCorr);
  normal = normalize(normal - (bzG * bzSlopeU + bzPg) * bzMic);
  vec3 bzDn = fwidth(normal);
  roughnessFactor = sqrt(clamp(roughnessFactor * roughnessFactor + min(0.35 * dot(bzDn, bzDn), 0.2), 0.0, 1.0));
}
`;

const BZ_FRAG_EMIT = `
{
  vec3 bzV = normalize(vViewPosition);
  float bzNV = clamp(dot(normal, bzV), 0.0, 1.0);
  float bzFr = pow(1.0 - bzNV, 3.0);
  vec3 bzGold = vec3(1.0, 0.64, 0.26);
  vec3 bzWarm = vec3(1.0, 0.52, 0.2);
  vec3 bzQ = vBzP.xyz;
  #if defined(BZ_CASE) || defined(USE_MAP)
    totalEmissiveRadiance += bzGold * bzGlow * (0.008 + 0.7 * bzFr * (0.3 + 0.7 * bzEdge)) * (1.0 - bzSiltM);
  #else
    totalEmissiveRadiance += bzGold * bzGlow * (0.09 + 3.1 * bzFr + 0.35 * bzEdge);
  #endif
  if (bzLu.x + bzLu.y > 0.0005) {
    float bzTB = bzGear.x > 0.0 ? smoothstep(bzGear.x - 0.0008, bzGear.y - 0.0001, length(bzQ.xy)) : 0.0;
    float bzMk = clamp(0.04 + 0.9 * bzEdge + 0.75 * bzTB + 0.6 * bzEngMask + 0.3 * bzFr, 0.0, 1.0);
    totalEmissiveRadiance += bzWarm * min(0.42 * bzLu.x + 0.9 * bzLu.y, 0.75) * bzMk;
  }
  if (bzFlow.y > 0.0005 && bzGear.x > 0.0) {
    float bzRr = length(bzQ.xy);
    float bzBand = smoothstep(bzGear.x - 0.0009, bzGear.x - 0.0001, bzRr) * (1.0 - smoothstep(bzGear.y - 0.00005, bzGear.y + 0.0002, bzRr));
    float bzPul = 0.0;
    if (bzBand + bzEngMask > 0.001) bzPul = pow(0.5 + 0.5 * cos(bzAtan(bzQ.xy) * bzFlow.z - bzFlow.x), 8.0);
    totalEmissiveRadiance += bzGold * bzFlow.y * (bzBand * (0.08 + 1.4 * bzPul) * (0.35 + 0.65 * bzFr + 0.4 * bzEdge) + bzEngMask * (0.25 + 0.6 * bzPul));
  }
  if (bzTip.w > 0.0005) {
    vec3 bzTd = bzQ - bzTip.xyz;
    float bzTg = exp(-dot(bzTd, bzTd) / 1.2e-5);
    totalEmissiveRadiance += bzTipCol * bzTip.w * (bzTg * (0.9 + 2.4 * bzFr) + 0.05);
  }
  totalEmissiveRadiance += vec3(1.0, 0.64, 0.34) * bzWoodSheen * (0.012 + 0.05 * bzFr) * (1.0 - bzSiltM);
  if (bzKind > 3.5 && bzKind < 4.5) totalEmissiveRadiance += bzGem * (0.04 + 0.35 * bzTip.w) * (0.35 + 0.65 * bzNV);
  if (bzEngr > 0.0005) totalEmissiveRadiance += bzWarm * bzEngr * bzEngMask * (0.7 + 0.3 * sin(bzAtan(bzQ.xy) * 3.0 - bzTime * 1.3)) * 0.55;
  if (bzLight.x > 0.0005) {
    float bzRv = 1.0 - smoothstep(bzLight.y - bzLight.z, bzLight.y, length(bzQ.xy));
    totalEmissiveRadiance += bzWarm * bzLight.x * bzRv * (0.9 * bzEngMask + 0.16 * bzFr + 0.03);
  }
  #ifdef BZ_DIAL
  if (bzSpIn > 0.5 && bzSpir.y + bzSpir.w > 0.0005) {
    float bzBh = 1.0 - smoothstep(bzSpir.x - 0.05, bzSpir.x + 0.05, bzSpPsi);
    float bzHd = exp(-(bzSpir.x - bzSpPsi) * (bzSpir.x - bzSpPsi) * 1.2);
    float bzPl = exp(-(bzSpir.z - bzSpPsi) * (bzSpir.z - bzSpPsi) * 2.0);
    float bzPt = 1.0 - smoothstep(bzSpir.z - 0.05, bzSpir.z + 0.05, bzSpPsi);
    float bzSk = bzSpir.y * (0.12 * bzBh + 0.5 * bzHd) + bzSpir.w * (1.6 * bzPl + 0.12 * bzPt);
    totalEmissiveRadiance += bzWarm * bzSk * (0.14 + 0.86 * bzDialE);
  }
  #endif
  if (bzSock.w > 0.0005) {
    vec3 bzSd = vWPos - bzSock.xyz;
    float bzSg = exp(-dot(bzSd, bzSd) * bzSockK);
    totalEmissiveRadiance += vec3(1.0, 0.58, 0.24) * bzSock.w * bzSg * (0.14 + 0.8 * bzEdge + 0.5 * bzFr);
  }
  if (bzBack > 0.0005) {
    vec2 bzBq = bzQ.xy - vec2(0.004, -0.02);
    float bzBg = exp(-dot(bzBq, bzBq) * 55.0);
    float bzEm = 0.6 + 0.4 * bzNoise3(vec3(bzQ.xy * 70.0, bzTime * 0.3));
    totalEmissiveRadiance += vec3(1.0, 0.46, 0.15) * bzBack * smoothstep(0.5, 0.95, vBzN.z) * bzBg * bzEm * (1.0 - 0.6 * bzEngMask);
  }
  #ifdef BZ_LOOSE
  {
    float bzLr = length(bzQ.xy);
    float bzLt = fract(atan(bzQ.x, bzQ.y) / 6.2831853 + 1.0);
    float bzTb = smoothstep(bzGear.x - 0.0005, bzGear.x + 0.0001, bzLr);
    float bzRi = max(bzGear.w, bzGear.x - 0.004);
    float bzRm = smoothstep(bzRi - 0.0002, bzRi + 0.0006, bzLr) * (1.0 - bzTb);
    float bzLm = 0.3 + 0.7 * bzFr + 0.6 * bzEdge;
    if (bzSweepK > 0.0005) {
      float bzTo = fract(0.25 * bzTeeth.x);
      float bzTi = fract((floor(bzLt * bzTeeth.x - bzTo + 0.5) + bzTo) / bzTeeth.x + bzTeeth.y);
      float bzTe = (bzSweep - bzTi) * bzTeeth.x;
      float bzLit = smoothstep(-0.4, 0.0, bzTe);
      float bzHa = fract(bzLt + bzTeeth.y - bzSweep + 0.5) - 0.5;
      float bzHg = exp(-bzHa * bzHa * 2500.0) * step(0.0005, bzSweep) * step(bzSweep, 0.9995);
      totalEmissiveRadiance += bzGold * bzSweepK * ((bzTb * (0.45 + 2.4 * exp(-max(bzTe, 0.0) * 0.35)) + 0.22 * bzRm) * bzLit * bzLm
        + bzRm * 1.3 * bzHg * (0.4 + 0.6 * bzFr + 0.5 * bzEdge));
    }
    if (bzHover > 0.0005) {
      float bzGd = fract(bzLt + bzTeeth.y - bzTime * 0.32 + 0.5) - 0.5;
      float bzGl = exp(-bzGd * bzGd * 900.0);
      totalEmissiveRadiance += bzWarm * bzHover * ((0.3 * bzTb + 0.12 * bzRm) * bzLm + bzGl * (bzTb + 0.5 * bzRm) * (0.7 + 1.8 * bzFr + bzEdge));
    }
    totalEmissiveRadiance += vec3(1.0, 0.62, 0.26) * bzHint * (0.16 + 0.9 * bzFr + 0.5 * bzEdge + 0.3 * bzTb);
  }
  #endif
}
`;

const BZ_FRAG_COLOR = `
#ifdef BZ_CASE
{
  vec3 bzSq = vBzP.xyz;
  float bzSn = bzNoise3(bzSq * 34.0 + bzSeed) * 0.62 + bzNoise3(bzSq * 130.0 + 3.0) * 0.38;
  bzSiltM = (1.0 - smoothstep(-0.05, 0.0, bzSn - (bzCorr * 1.12 - 0.06))) * step(0.001, bzCorr);
  vec3 bzSc = mix(vec3(0.40, 0.37, 0.30), vec3(0.60, 0.56, 0.46), bzNoise3(bzSq * 85.0 + 9.0));
  bzSc *= 0.85 + 0.3 * mix(0.5, bzNoise3(bzSq * 300.0), bzFade(0.0033));
  diffuseColor.rgb = mix(diffuseColor.rgb, bzSc, bzSiltM);
}
#endif
`;

function bronzify(mat, u) {
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\n' + BZ_VERT_DECL)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n' + BZ_VERT);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n' + BZ_FRAG_DECL)
      .replace('#include <map_fragment>', '#include <map_fragment>\n' + BZ_FRAG_MAP)
      .replace('#include <color_fragment>', '#include <color_fragment>\n' + BZ_FRAG_COLOR)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n' + BZ_FRAG_ROUGH)
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\n' + BZ_FRAG_METAL)
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n' + BZ_FRAG_NORMAL)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n' + BZ_FRAG_EMIT);
  };
  mat.customProgramCacheKey = () => 'bz2';
  mat.userData.bz = u;
  return mat;
}

function sharpEnds(pts, first, last) {
  if (first) pts[0][3] = 0;
  if (last) pts[pts.length - 1][3] = 0;
  return pts;
}

const KNOB_PROF = [[0.0536, 0.0037], [0.0557, 0.0037], [0.0559, 0.0034], [0.059, 0.0039], [0.0625, 0.0042], [0.066, 0.004], [0.07, 0.0035], [0.0725, 0.0034]];
for (let i = 1; i <= 6; i++) { const a = (i / 6) * Math.PI / 2; KNOB_PROF.push([0.0725 + 0.0032 * Math.sin(a), 0.0034 * Math.cos(a)]); }

class Mechanism {
  constructor(scene, { aniso = 8, quality = 1 } = {}) {
    this.aniso = aniso;
    this.quality = quality;
    this.texSize = quality >= 1 ? 1024 : 512;
    this.group = new THREE.Group();
    this.scale = 6.5;
    this.group.scale.setScalar(this.scale);
    scene.add(this.group);
    this.inner = new THREE.Group();
    this.group.add(this.inner);
    this.parts = {};
    this.partList = [];
    this.gears = {};
    this.glyphMats = [];
    this.pointers = [];
    this._faceU = [];
    this._uTime = { value: 0 };
    this._looseMats = [];
    this._looseHeroes = [];
    this._energy = 0;
    this._engr = 0;
    this._glowT = -1;
    this._crownW = 0;
    this._crownE = 0;
    this._spPrev = { th: null, t: 0 };
    this._thA = {};
    this._thB = {};
    this._thFlip = false;
    this._flyPool = [];
    this._uSock = { value: new THREE.Vector4() };
    this._uSockK = { value: 1 };
    this.sockFocus = -1;
    this.sockLit = -1;
    this.holdArrivals = false;
    this.handZ = 0.1;
    this._uBack = { value: 0 };
    this._sockA = 0;
    this._sockIdx = -1;
    this._sockAcc = 0;
    this._backA = 0;
    this._stirAcc = 0;
    this._fx = null;
    this._coverT = -1;
    this._ign = { on: false, tp: 0, tg: 0, L: 0, j: -1, p: new V3$1(), q: new THREE.Quaternion() };
    this._w = new V3$1();
    this._w2 = new V3$1();
    this._v = new V3$1();
    this._q = new THREE.Quaternion();
    this._col = new THREE.Color();
    this._m4 = new THREE.Matrix4();
    this._s3 = new V3$1();
    this._oSilt = { spread: 0, color: SAND_COL, up: 0, life: 0, size: 0, push: null, ground: -1e9 };
    this._oGrain = { spread: 0, up: 0, push: null, ground: -1e9 };
    this._oChip = { ground: -1e9, push: null, speed: 1 };
    this._up = new V3$1(0, 1, 0);
    this.eclipses = eclipseTable(SAROS + 1);
    this.sky0 = skyState(0);
    this._buildBack();
    this._buildPillars();
    this._buildGears();
    this._buildCrank();
    this._buildFront();
    this._buildPointers();
    this._buildCase();
    this._buildSockets();
    this._buildBridge();
    {
      const tg = new THREE.BufferGeometry();
      tg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(9), 3));
      tg.setDrawRange(0, 0);
      const tick = new THREE.Mesh(tg, new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, depthTest: false }));
      tick.frustumCulled = false;
      tick.onBeforeRender = () => { if (this.assembly) this._tickGlow(); };
      this.group.add(tick);
    }
    {
      let dm = null;
      this.group.traverse((o) => {
        if (!o.isMesh || !o.castShadow || !o.material || !o.material.map) return;
        if (!dm) dm = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: o.material.map });
        o.customDepthMaterial = dm;
      });
    }
    this.th0 = this._angles(0);
    this.lastCell = 0;
    this.months = 0;
    this.setMonths(0);
    this.group.updateMatrixWorld(true);
    const box = new THREE.Box3(), c = new V3$1(), qi = new THREE.Quaternion();
    for (const pt of this.partList) {
      pt.final = { p: pt.obj.position.clone(), q: pt.obj.quaternion.clone(), s: pt.obj.scale.clone() };
      box.setFromObject(pt.obj);
      pt.boxInner = new THREE.Box3(box.min.clone().divideScalar(this.scale), box.max.clone().divideScalar(this.scale));
      box.getCenter(c).divideScalar(this.scale);
      if (pt.kind === 'plate') c.set(0, 0, pt.axis.z < 0 ? -PLATE_Z : PLATE_Z);
      pt.cInner = c.clone();
      pt.cLocal = c.clone().sub(pt.obj.position).applyQuaternion(qi.copy(pt.obj.quaternion).invert());
      pt.obj.visible = false;
    }
    this.assembly = null;
  }

  _part(name, obj, { axis = [0, 0, 1], kind = 'gear', hero } = {}) {
    obj.name = name;
    const pt = {
      name, obj, axis: new V3$1(...axis), kind, hero, corrode: { value: 1 }, glow: { value: 0 }, state: 'hidden',
      luU: { value: new THREE.Vector2() }, luGlint: 0,
      aGlow: 0, gTarget: 0, peak: 0, seatT: 0, ripT: 0, ripA: 0, eGlow: 0, luGlow: 0, inSet: null, jit: null, seed: this.partList.length * 7.31 + 1.7,
    };
    this.parts[name] = pt;
    this.partList.push(pt);
    return pt;
  }
  _segs(n) { return Math.max(8, Math.round(n * (this.quality >= 1 ? 1 : 0.6))); }

  _bzU(pt, o = {}) {
    return {
      bzGlow: pt.glow, bzCorr: pt.corrode, bzSeed: { value: pt.seed + (o.seed || 0) }, bzTime: this._uTime,
      bzEngr: { value: 0 }, bzSlide: { value: 0 },
      bzGear: { value: new THREE.Vector4(...(o.gear || [0, 0, 0, 0])) },
      bzFlow: { value: new THREE.Vector4(0, 0, o.pulses || 1, 0) },
      bzTip: { value: new THREE.Vector4(...(o.tip || [0, 0, 0]), 0) },
      bzTipCol: { value: new THREE.Color(...(o.tipCol || [1.0, 0.68, 0.3])) },
      bzGem: { value: new THREE.Color(...(o.gem || [0, 0, 0])) },
      bzMoon: { value: new THREE.Vector4(0, 1, 0, 0) },
      bzMoonC: { value: new V3$1(...(o.moonC || [0, 0, 0])) },
      bzLight: { value: new THREE.Vector4(0, 1, 0.01, 0) },
      bzLift: { value: o.lift !== undefined ? o.lift : 1 },
      bzDial: { value: new THREE.Vector4() }, bzDial2: { value: new THREE.Vector4() }, bzDial3: { value: new THREE.Vector4(0, 0, 0, 1) },
      bzLu: pt.luU,
      bzSock: this._uSock, bzSockK: this._uSockK,
      bzBack: { value: 0 },
      bzSpir: { value: new THREE.Vector4(-1, 0, -100, 0) },
    };
  }
  _bz(pt, color, rough, o = {}) {
    const m = new THREE.MeshStandardMaterial({ color: new THREE.Color(...color), metalness: 1, roughness: rough, vertexColors: true });
    bronzify(m, this._bzU(pt, o));
    return patchMaterial(m, { corrode: true, corrodeU: pt.corrode, corrodeScale: 55 });
  }
  _mesh(geo, mat, { cast = true, receive = true } = {}) {
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = cast;
    m.receiveShadow = receive;
    return m;
  }
  _faceMaterial(pt, faces, bumpScale = 3, dial = null) {
    const mr = tex(faces.mr, false, this.aniso);
    const m = new THREE.MeshStandardMaterial({
      map: tex(faces.col, true, this.aniso), metalnessMap: mr, roughnessMap: mr,
      bumpMap: tex(faces.bump, false, this.aniso), bumpScale, metalness: 1, roughness: 1, transparent: true, alphaTest: 0.5,
    });
    const u = this._bzU(pt);
    u.bzLift.value = pt.name === 'frontAsm' ? 0.55 : 0;
    u.luKey = pt.name === 'frontAsm' ? 'front' : this._faceU.some((x) => x.luKey === 'met') ? 'sar' : 'met';
    if (dial) {
      const D = dial.D;
      u.bzDial.value.set(dial.type, D ? D.r0 : 0, D ? D.r1 : 0, D ? D.turns : 1);
      if (D) u.bzDial2.value.set(D.cells, dial.subPh ?? Math.PI / 2, D.a0, D.disc - 0.0012);
      if (dial.sub) u.bzDial3.value.set(...dial.sub);
      m.defines = Object.assign({}, m.defines, { BZ_DIAL: '' });
    }
    this._faceU.push(u);
    if (u.luKey === 'sar') this._sarU = u; else if (u.luKey === 'met') this._metU = u;
    bronzify(m, u);
    return patchMaterial(m, { corrode: true, corrodeU: pt.corrode, corrodeScale: 55 });
  }
  _plateMat(pt, which) {
    const extra = which === 'front'
      ? (g, C, T) => {
        scaleRings(g, C, T, 0, 0, 0.0968, 0.0982, 72);
        for (const [lines, y] of [[PARAPEGMA_TOP, PARA_Y], [PARAPEGMA_BOT, -PARA_Y]]) {
          const x0 = T.X(-PARA_W / 2), y0 = T.Y(y + PARA_H / 2), w = PARA_W * T.k, h = PARA_H * T.k;
          g.fillStyle = C.polish; g.fillRect(x0, y0, w, h);
          g.strokeStyle = C.engr; g.lineWidth = 0.0005 * T.k;
          const i = 0.0012 * T.k;
          g.strokeRect(x0 + i, y0 + i, w - 2 * i, h - 2 * i);
          g.fillStyle = C.engr; g.textAlign = 'left'; g.textBaseline = 'middle';
          g.font = `600 ${Math.round(h * 0.095)}px ${FONT_GR$1}`;
          g.save();
          g.globalAlpha = 0.7;
          lines.forEach((ln, k) => g.fillText(ln, x0 + w * 0.05 + (k % 2) * w * 0.02, y0 + h * (0.15 + k * 0.175)));
          g.restore();
        }
      }
      : (g, C, T) => {
        scaleRings(g, C, T, P.n[0], P.n[1], METONIC.disc + 0.0042, METONIC.disc + 0.0056, 72);
        scaleRings(g, C, T, P.g[0], P.g[1], SAROS_D.disc + 0.0042, SAROS_D.disc + 0.0056, 72);
      };
    const f = plateFaces(this.quality >= 1 ? 660 : 330, extra);
    const T = { col: tex(f.col, true, this.aniso), mr: tex(f.mr, false, this.aniso), bump: tex(f.bump, false, this.aniso) };
    for (const t of Object.values(T)) { t.repeat.set(1 / PLATE_W, 1 / PLATE_H); t.offset.set(0.5, 0.5); }
    const m = new THREE.MeshStandardMaterial({ map: T.col, metalnessMap: T.mr, roughnessMap: T.mr, bumpMap: T.bump, bumpScale: 1.2, metalness: 1, roughness: 1 });
    bronzify(m, this._bzU(pt));
    return patchMaterial(m, { corrode: true, corrodeU: pt.corrode, corrodeScale: 55 });
  }

  _roundRectAt(W, H, r, s) {
    const a = 2 * (W - r), b = 2 * (H - r), q = (Math.PI / 2) * r;
    const segs = [
      ['L', -W + r, -H, 1, 0, a, 0, -1], ['C', W - r, -H + r, -Math.PI / 2],
      ['L', W, -H + r, 0, 1, b, 1, 0], ['C', W - r, H - r, 0],
      ['L', W - r, H, -1, 0, a, 0, 1], ['C', -W + r, H - r, Math.PI / 2],
      ['L', -W, H - r, 0, -1, b, -1, 0], ['C', -W + r, -H + r, Math.PI],
    ];
    for (const g of segs) {
      const len = g[0] === 'L' ? g[5] : q;
      if (s <= len) {
        if (g[0] === 'L') return [g[1] + g[3] * s, g[2] + g[4] * s, g[6], g[7]];
        const ang = g[3] + s / r;
        return [g[1] + r * Math.cos(ang), g[2] + r * Math.sin(ang), Math.cos(ang), Math.sin(ang)];
      }
      s -= len;
    }
    return [-W + r, -H, 0, -1];
  }

  _plateGeo(panels, seed = 1) {
    const rng = makeRng$1(seed);
    const W = PLATE_W / 2, H = PLATE_H / 2, rr = 0.012;
    const perim = 4 * (W - rr) + 4 * (H - rr) + TAU$6 * rr;
    const chips = [];
    for (let i = 0; i < 24; i++) chips.push({ s: rng() * perim, w: 0.0025 + rng() * 0.004, d: 0.0002 + rng() * rng() * 0.0009 });
    const pts = [];
    const n = 440;
    for (let i = 0; i < n; i++) {
      const s = (i / n) * perim;
      const [x, y, nx, ny] = this._roundRectAt(W, H, rr, s);
      let inset = 0.00011 * (1 + Math.sin(s * 230 + seed)) + 0.00006 * (1 + Math.sin(s * 690 + seed * 3));
      for (const c of chips) {
        let ds = Math.abs(s - c.s);
        ds = Math.min(ds, perim - ds);
        if (ds < c.w) inset += c.d * Math.pow(Math.cos((ds / c.w) * (Math.PI / 2)), 0.8);
      }
      pts.push(new THREE.Vector2(x - nx * inset, y - ny * inset));
    }
    const sh = new THREE.Shape(pts);
    const hole = new THREE.Path();
    hole.absarc(0, 0, 0.0016, 0, TAU$6, true);
    sh.holes.push(hole);
    const g = new THREE.ExtrudeGeometry(sh, { depth: 0.004, bevelEnabled: true, bevelThickness: 0.0008, bevelSize: 0.0008, bevelSegments: 3, curveSegments: 10 });
    g.translate(0, 0, -2e-3);
    prep(g, { kind: K_FILED, uv: true });
    if (!panels) return g;
    const geos = [g];
    for (const y of [PARA_Y, -PARA_Y]) {
      const p = new THREE.ExtrudeGeometry(roundRectShape(PARA_W, PARA_H, 0.002, 0, y), { depth: 0.0003, bevelEnabled: true, bevelThickness: 0.00015, bevelSize: 0.00015, bevelSegments: 2, curveSegments: 4 });
      p.translate(0, 0, PLATE_HALF + 0.00015);
      geos.push(prep(p, { kind: K_FILED, uv: true, rough: RC_POLISH }));
    }
    return merge$1(geos);
  }

  _dialGeo(Rd, bands = [], subs = []) {
    const segs = this._segs(160);
    const base = prep(new THREE.CircleGeometry(Rd, segs), { kind: K_TURNED, uv: true });
    const pa = base.attributes.position, ab = base.attributes.aBz;
    for (let i = 0; i < pa.count; i++) ab.setX(i, Math.hypot(pa.getX(i), pa.getY(i)));
    const geos = [base];
    for (const [r0, r1, h] of bands) {
      const c = Math.min(0.0003, h * 0.8);
      geos.push(planarUV(turned([[r1, 0], [r1, h - c, 0.7], [r1 - c, h, 1], [r0 + c, h, 1], [r0, h - c, 0.7], [r0, 0]], { segs }), Rd));
    }
    for (const [cx, cy, rr, h] of subs) {
      const c = Math.min(0.0003, h * 0.8);
      geos.push(planarUV(turned([[rr, 0], [rr, h - c, 0.7], [rr - c, h, 1], [0, h]], { segs: this._segs(64) }).translate(cx, cy, 0), Rd));
    }
    return merge$1(geos);
  }

  _bezel(rr, below, h, w = 0.0034) {
    const b = w / 2;
    return turned([
      [rr + w, -below],
      ...sharpEnds(arcPts(rr + b, h * 0.3, b, h * 0.7, 0, Math.PI, 8, 0.9), false, true),
      [rr - w * 0.12, h * 0.3, 0.6], [rr - w * 0.12, h * 0.1], [rr - w * 0.2, h * 0.04, -0.8], [rr - w * 0.2, -below - 0.0002],
    ], { segs: this._segs(Math.max(24, Math.min(200, Math.round(rr * 2600)))), tint: TINT.gold, rough: RC_POLISH });
  }

  _washer() {
    return turned([[0.0028, 0], [0.0058, 0], [0.0058, 0.0005, 0.6], [0.0053, 0.0009, 1], [0.0034, 0.0009, 0.3], [0.0028, 0.0006, -0.6]],
      { segs: this._segs(28), tint: TINT.gold });
  }

  _rivetRing(cx, cy, r, n, ok) {
    const out = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU$6 + 0.13;
      const x = cx + r * Math.cos(a), y = cy + r * Math.sin(a);
      if (ok(x, y)) out.push([x, y]);
    }
    return out;
  }

  _nails(mat, zFace, dir, skip, extra = []) {
    const geo = turned([[0, 0], [0.00125, 0], [0.00125, 0.00012, 0.4], ...sharpEnds(arcPts(0, 0.00012, 0.00115, 0.0005, 0, Math.PI / 2, 4, 0.9), true, false)],
      { segs: this._segs(14), tint: TINT.copper });
    const pos = [];
    const xe = PLATE_W / 2 - 0.0095, ye = PLATE_H / 2 - 0.0095;
    for (let i = 1; i < 12; i++) { const x = -xe + (2 * xe * i) / 12; pos.push([x, ye], [x, -ye]); }
    for (let j = 1; j < 19; j++) { const y = -ye + (2 * ye * j) / 19; pos.push([xe, y], [-xe, y]); }
    const keep = pos.filter(([x, y]) => !skip(x, y)).concat(extra)
      .filter(([x, y]) => PILLARS.every(([px, py]) => Math.hypot(x - px, y - py) > 0.012));
    const mesh = new THREE.InstancedMesh(geo, mat, keep.length);
    const M = new THREE.Matrix4(), s = new V3$1(), p = new V3$1(), zAxis = new V3$1(0, 0, 1);
    const q = new THREE.Quaternion(), qz = new THREE.Quaternion();
    const flip = new THREE.Quaternion().setFromAxisAngle(new V3$1(1, 0, 0), dir < 0 ? Math.PI : 0);
    const rng = makeRng$1(dir < 0 ? 77 : 78);
    keep.forEach(([x, y], i) => {
      q.copy(flip).multiply(qz.setFromAxisAngle(zAxis, rng() * TAU$6));
      s.setScalar(0.8 + rng() * 0.4);
      M.compose(p.set(x, y, zFace), q, s);
      mesh.setMatrixAt(i, M);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  _arbors(out, bridge = out) {
    const byAxis = {};
    for (const G of GEARS) if (G.ax !== 'k') (byAxis[G.ax] || (byAxis[G.ax] = [])).push(G);
    const zBack = -PLATE_Z + PLATE_HALF;
    const through = { n: 1, o: 1, g: 1, i: 1 };
    const segs = this._segs(24);
    const rng = makeRng$1(31);
    for (const [ax, own] of Object.entries(byAxis)) {
      const [x, y] = P[ax];
      const onBridge = BRIDGE_AXES.includes(ax);
      const zIn = onBridge ? BRIDGE_Z1 : zBack;
      const dst = onBridge ? bridge : out;
      const lo = Math.min(...own.map((G) => G.z - (G.thick || WHEEL_T) / 2)) - 0.0012;
      const hi = Math.max(...own.map((G) => G.z + (G.thick || WHEEL_T) / 2)) + 0.0029;
      const top = ax === 'b' ? B_TOP : hi;
      const sh = Math.max(zIn + (onBridge ? 0.0022 : 0.0034), lo);
      const busy = [[sh - 0.0014, sh + 0.0006]];
      for (const G of GEARS) {
        const hw = (G.thick || WHEEL_T) / 2;
        if (G.ax === ax) { busy.push([G.z - hw - 0.0016, G.z + hw + 0.003]); continue; }
        if (G.ax === 'k') continue;
        if (Math.hypot(x - P[G.ax][0], y - P[G.ax][1]) < pitchRadius(G.N, G.m) + G.m + 0.0025) busy.push([G.z - hw - 0.0015, G.z + hw + 0.0015]);
      }
      if (Math.hypot(x - P.e[0], y - P.e[1]) < K_RADIUS + K_TIP + 0.003) busy.push([Z.L6 - 0.0025, Z.L5 + 0.0065]);
      if (ax === 'b') busy.push([PLATE_Z - PLATE_HALF - 0.0015, 1]);
      busy.sort((a, b) => a[0] - b[0]);
      const beads = [];
      const addFree = (a, b) => { const L = b - a; if (L > 0.016) beads.push(a + L / 3, a + (2 * L) / 3); else if (L > 0.0045) beads.push((a + b) / 2); };
      const zA = zIn + 0.0024, zB = top - 0.001;
      let cur = zA;
      for (const [b0, b1] of busy) {
        if (b1 <= cur) continue;
        if (b0 > cur) addFree(cur, Math.min(b0, zB));
        cur = Math.max(cur, b1);
        if (cur >= zB) break;
      }
      if (cur < zB) addFree(cur, zB);

      const pts = through[ax] ? [[0, -PLATE_Z - 0.0062], [0.0013, -PLATE_Z - 0.0062], [0.0013, zIn]] : [[0, zIn]];
      pts.push([0.0032, zIn, 0.3], [0.0032, zIn + 0.0005, 0.8], [0.0028, zIn + 0.0009, 1],
        ...arcPts(0.0022, zIn + 0.0016, 0.0007, 0.0007, -Math.PI / 2, -Math.PI, 3, -0.6));
      const bead = (zc, r0) => [[r0, zc - 0.0006], [r0 + 0.0003, zc - 0.00035, 0.3, 1], [r0 + 0.00048, zc, 1, 1], [r0 + 0.0003, zc + 0.00035, 0.3, 1], [r0, zc + 0.0006]];
      let stepped = false;
      for (const zc of beads.sort((a, b) => a - b)) {
        if (!stepped && zc > sh) { pts.push([0.0015, sh - 0.0006], [0.00185, sh - 0.0003, 0.5], [0.00185, sh, 0.9], [0.0013, sh]); stepped = true; }
        pts.push(...bead(zc, stepped ? 0.0013 : 0.0015));
      }
      if (!stepped) pts.push([0.0015, sh - 0.0006], [0.00185, sh - 0.0003, 0.5], [0.00185, sh, 0.9], [0.0013, sh]);
      if (ax === 'b') pts.push([0.0013, top], [0, top]);
      else {
        pts.push([0.0013, top], [0.0019, top, 0.3], ...arcPts(0, top + 0.0008, 0.0019, 0.0011, 0, Math.PI / 2, 5, 0.7));
        dst.push(slab(taperShape(-27e-4, 0.0027, 0.00042, 0.00022), 0.00032, 0.00006, { kind: K_FILED, tint: TINT.arbor }).rotateZ(rng() * Math.PI).translate(x, y, top + 0.0004));
      }
      for (const G of own) {
        const z1 = G.z - (G.thick || WHEEL_T) / 2 - 0.0012;
        dst.push(turned([[0.00135, z1 - 0.0004], [0.0026, z1 - 0.0004], [0.0026, z1, 0.6], [0.00135, z1, 0.2]], { segs: 18, tint: TINT.gold }).translate(x, y, 0));
      }
      dst.push(turned(pts, { segs, tint: TINT.arbor }).translate(x, y, 0));
    }
  }

  _buildBridge() {
    const geos = this._bridgeGeos || [];
    const zc = (BRIDGE_Z0 + BRIDGE_Z1) / 2, zBack = -PLATE_Z + PLATE_HALF;
    const pts = BRIDGE_PATH.map((k) => (typeof k === 'string' ? P[k] : k));
    for (let i = 0; i + 1 < pts.length; i++) {
      const [ax, ay] = pts[i], [bx2, by] = pts[i + 1], L = Math.hypot(bx2 - ax, by - ay);
      geos.push(slab(taperShape(0, L, 0.0021, 0.0021), BRIDGE_Z1 - BRIDGE_Z0 - 0.0004, 0.0002, { kind: K_FILED })
        .rotateZ(Math.atan2(by - ay, bx2 - ax)).translate(ax, ay, zc));
    }
    const pad = new THREE.Shape();
    pad.absarc(0, 0, 0.0034, 0, TAU$6, false);
    for (const [x, y] of pts) geos.push(slab(pad, BRIDGE_Z1 - BRIDGE_Z0 - 0.0004, 0.0002, { kind: K_FILED }).translate(x, y, zc));
    for (const [x, y] of [pts[0], pts[pts.length - 1]]) {
      geos.push(turned([[0, zBack], [0.0034, zBack, 0.3], [0.0034, zBack + 0.0005, 0.8], [0.0026, zBack + 0.0011, 1], [0.0021, zBack + 0.0017, 0.3],
        [0.0021, BRIDGE_Z0 - 0.0009, 0.3], [0.0027, BRIDGE_Z0 - 0.0003, 0.8], [0.0027, BRIDGE_Z0], [0, BRIDGE_Z0]], { segs: this._segs(20), tint: TINT.arbor }).translate(x, y, 0));
    }
    const grp = new THREE.Group();
    grp.position.set(P.e[0], P.e[1], 0);
    this.inner.add(grp);
    const pt = this._part('lunarBridge', grp, { axis: [0, 0, 1], kind: 'gear' });
    grp.add(this._mesh(merge$1(geos).translate(-P.e[0], -P.e[1], 0), this._bz(pt, [1, 1, 1], 0.26)));
    this._bridgeGeos = null;
  }

  _buildBack() {
    const asm = new THREE.Group();
    this.inner.add(asm);
    const pt = this._part('backAsm', asm, { axis: [0, 0, -1], kind: 'plate' });
    const plateMat = this._plateMat(pt, 'back');
    plateMat.userData.bz.bzBack = this._uBack;
    const plate = this._mesh(this._plateGeo(false, 3), plateMat);
    plate.position.z = -PLATE_Z;
    asm.add(plate);

    const metal = [];
    this._bridgeGeos = [];
    this._arbors(metal, this._bridgeGeos);
    const zo = -PLATE_Z - PLATE_HALF;
    for (const [x, y] of PILLARS) metal.push(this._washer().rotateX(Math.PI).translate(x, y, zo));
    const zFace = -PLATE_Z - FACE_OFF;
    for (const [c, rr] of [[P.n, METONIC.disc], [P.g, SAROS_D.disc]]) metal.push(this._bezel(rr, FACE_OFF - PLATE_HALF, 0.0016).rotateX(Math.PI).translate(c[0], c[1], zFace));
    for (const [c, rr] of [[P.o, OLY_R], [P.i, EXE_R]]) metal.push(this._bezel(rr, 0.0006, 0.0008, 0.0014).rotateX(Math.PI).translate(c[0], c[1], zFace - 0.0006));
    const metalMat = this._bz(pt, [1, 1, 1], 0.26);
    asm.add(this._mesh(merge$1(metal), metalMat));
    const okB = (x, y) => Math.abs(x) < 0.086 && Math.abs(y) < 0.14 && Math.hypot(x - P.n[0], y - P.n[1]) > METONIC.disc + 0.0045 && Math.hypot(x - P.g[0], y - P.g[1]) > SAROS_D.disc + 0.0045;
    const okM = (x, y) => okB(x, y) && Math.abs(Math.hypot(x - P.g[0], y - P.g[1]) - (SAROS_D.disc + 0.0068)) > 0.003;
    asm.add(this._nails(metalMat, zo, -1, (x, y) => Math.hypot(x - P.n[0], y - P.n[1]) < METONIC.disc + 0.006 || Math.hypot(x - P.g[0], y - P.g[1]) < SAROS_D.disc + 0.006,
      [...this._rivetRing(P.n[0], P.n[1], METONIC.disc + 0.0068, 30, okM), ...this._rivetRing(P.g[0], P.g[1], SAROS_D.disc + 0.0068, 26, okB)]));

    const bd = new THREE.Group();
    this.inner.add(bd);
    const dpt = this._part('backDials', bd, { axis: [0, 0, -1], kind: 'dialSet' });
    this.backGroup = new THREE.Group();
    this.backGroup.position.z = zFace;
    this.backGroup.rotation.y = Math.PI;
    bd.add(this.backGroup);
    const bx = (x) => -x;
    const S = this.texSize;

    const oOff = [bx(P.o[0]) - bx(P.n[0]), P.o[1] - P.n[1]];
    const metFaces = this._spiralFace(METONIC, S, (g, C, c, k) => {
      const inter = new Set([5, 30, 67, 104, 129, 166, 203]);
      let name = 0;
      g.fillStyle = C.engr;
      for (let cell = 0; cell < METONIC.cells; cell++) {
        const psi = ((cell + 0.5) / METONIC.cells) * METONIC.turns * TAU$6;
        arcText(g, CORINTH[name % 12], c, c, spiralR(METONIC, psi) * k, METONIC.a0 - psi, 0.0024 * k, 0.02);
        if (!inter.has(cell)) name++;
      }
      this._paintSub(g, C, c + oOff[0] * k, c - oOff[1] * k, k, OLY_R, 4, (q) => [
        [OLYMPIAD[q][0], 0.0074, (q * 90 - 45) * DEG$6, 0.0012], [OLYMPIAD[q][1], 0.0052, (q * 90 - 45) * DEG$6, 0.0012]]);
    });
    const mp = (METONIC.r1 - METONIC.r0) / METONIC.turns;
    const met = new THREE.Mesh(this._dialGeo(METONIC.disc, [[METONIC.r0 - mp * 0.5 - 0.001, Math.min(METONIC.disc - 0.0006, METONIC.r1 + mp * 0.5 + 0.001), 0.00035]],
      [[oOff[0], oOff[1], OLY_R, 0.0006]]), this._faceMaterial(dpt, metFaces, 2.2, { type: 2, D: METONIC, sub: [oOff[0], oOff[1], OLY_R, 4], subPh: Math.PI / 2 }));
    met.position.set(bx(P.n[0]), P.n[1], 0);
    met.receiveShadow = true;
    this.backGroup.add(met);

    const iOff = [bx(P.i[0]) - bx(P.g[0]), P.i[1] - P.g[1]];
    const sarFaces = this._spiralFace(SAROS_D, S, (g, C, c, k) => {
      g.fillStyle = C.engr;
      for (let cell = 0; cell < SAROS_D.cells; cell++) {
        const E = this.eclipses[cell];
        if (!E.solar && !E.lunar) continue;
        const psi = ((cell + 0.5) / SAROS_D.cells) * SAROS_D.turns * TAU$6;
        arcText(g, (E.lunar ? 'Σ' : '') + (E.solar ? 'Η' : ''), c, c, spiralR(SAROS_D, psi) * k, SAROS_D.a0 - psi, 0.0042 * k, 0.1);
      }
      const labels = ['', 'Η', 'ΙϚ'];
      this._paintSub(g, C, c + iOff[0] * k, c - iOff[1] * k, k, EXE_R, 3, (q) => (labels[q] ? [[labels[q], 0.0062, (-q * 120) * DEG$6, 0.0028]] : []));
    });
    const sp = (SAROS_D.r1 - SAROS_D.r0) / SAROS_D.turns;
    const sar = new THREE.Mesh(this._dialGeo(SAROS_D.disc, [[SAROS_D.r0 - sp * 0.5 - 0.001, Math.min(SAROS_D.disc - 0.0006, SAROS_D.r1 + sp * 0.5 + 0.001), 0.00035]],
      [[iOff[0], iOff[1], EXE_R, 0.0006]]), this._faceMaterial(dpt, sarFaces, 2.2, { type: 3, D: SAROS_D, sub: [iOff[0], iOff[1], EXE_R, 3], subPh: Math.PI / 3 }));
    sar.position.set(bx(P.g[0]), P.g[1], 0);
    sar.receiveShadow = true;
    this.backGroup.add(sar);

    const atlas = canvas$1(256, 128);
    {
      const g = atlas.getContext('2d');
      g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = `700 104px ${FONT_GR$1}`;
      g.fillText('Σ', 64, 70);
      g.fillText('Η', 192, 70);
    }
    const gmat = new THREE.MeshBasicMaterial({ map: tex(atlas, true, this.aniso), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xffffff, opacity: 1 });
    gmat.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float aGlyph;')
        .replace('#include <uv_vertex>', '#include <uv_vertex>\n#ifdef USE_MAP\n\tvMapUv.x = vMapUv.x * 0.5 + aGlyph * 0.5;\n#endif');
    };
    gmat.customProgramCacheKey = () => 'bzGlyph';
    this.glyphMats.push(gmat);
    const cellsOf = (kind) => { const c = []; for (let cell = 0; cell < SAROS_D.cells; cell++) if (this.eclipses[cell][kind]) c.push(cell); return c; };
    const lunar = cellsOf('lunar'), solar = cellsOf('solar');
    const ggeo = new THREE.PlaneGeometry(0.0062, 0.0062);
    const which = new Float32Array(lunar.length + solar.length);
    const gmesh = new THREE.InstancedMesh(ggeo, gmat, which.length);
    const M = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new V3$1(1, 1, 1), zAxis = new V3$1(0, 0, 1);
    const placeGlyphs = (kind, cells, off, color) => {
      cells.forEach((cell, j) => {
        const psi = ((cell + 0.5) / SAROS_D.cells) * SAROS_D.turns * TAU$6;
        const r = spiralR(SAROS_D, psi);
        const E = this.eclipses[cell];
        const shift = kind === 'lunar' && E.solar ? -26e-4 : kind === 'solar' && E.lunar ? 0.0026 : 0;
        const ta = SAROS_D.a0 - psi - shift / r;
        q.setFromAxisAngle(zAxis, ta - Math.PI / 2);
        const gp = new V3$1(bx(P.g[0]) + r * Math.cos(ta), P.g[1] + r * Math.sin(ta), 0.0006);
        M.compose(gp, q, s);
        gmesh.setMatrixAt(off + j, M);
        if (kind === 'solar' && cell === 0) { this._ign.j = off + j; this._ign.p.copy(gp); this._ign.q.copy(q); }
        gmesh.setColorAt(off + j, color);
        which[off + j] = kind === 'solar' ? 1 : 0;
      });
      return { mesh: gmesh, cells, off, flash: new Float32Array(cells.length), base: color.clone() };
    };
    this.glyphs = {
      lunar: placeGlyphs('lunar', lunar, 0, new THREE.Color(0.55, 0.75, 1.0)),
      solar: placeGlyphs('solar', solar, lunar.length, new THREE.Color(1.0, 0.72, 0.3)),
    };
    ggeo.setAttribute('aGlyph', new THREE.InstancedBufferAttribute(which, 1));
    gmesh.instanceMatrix.needsUpdate = true;
    gmesh.instanceColor.needsUpdate = true;
    gmesh.frustumCulled = false;
    this.backGroup.add(gmesh);
    {
      const c = canvas$1(256), g = c.getContext('2d');
      const halo = g.createRadialGradient(128, 128, 8, 128, 128, 126);
      halo.addColorStop(0, 'rgba(255,200,110,0.55)'); halo.addColorStop(0.35, 'rgba(255,160,60,0.22)'); halo.addColorStop(1, 'rgba(255,120,30,0)');
      g.fillStyle = halo; g.fillRect(0, 0, 256, 256);
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `700 150px ${FONT_GR$1}`;
      g.shadowColor = 'rgba(255,190,90,0.9)'; g.shadowBlur = 22;
      g.fillStyle = '#ffe2a8'; g.fillText('Η', 128, 136);
      g.shadowBlur = 0; g.fillStyle = '#fff4dc'; g.fillText('Η', 128, 136);
      const im = new THREE.MeshBasicMaterial({ map: tex(c, true, this.aniso), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: 0x000000 });
      const iq = new THREE.Mesh(new THREE.PlaneGeometry(0.03, 0.03), im);
      iq.visible = false;
      iq.renderOrder = 8;
      this.backGroup.add(iq);
      this._ignQuad = iq;
    }

    this.metPtr = this._backPtr(dpt, bx(P.n[0]), P.n[1], METONIC, 'met');
    this.sarPtr = this._backPtr(dpt, bx(P.g[0]), P.g[1], SAROS_D, 'sar');
    this.olyPtr = this._smallPtr(dpt, bx(P.o[0]), P.o[1], 'oly');
    this.exePtr = this._smallPtr(dpt, bx(P.i[0]), P.i[1], 'exe');
  }

  _paintSub(g, C, cx, cy, k, rr, n, labels) {
    g.fillStyle = C.polish; g.beginPath(); g.arc(cx, cy, rr * k, 0, TAU$6); g.fill();
    g.strokeStyle = C.engr; g.fillStyle = C.engr;
    for (let q = 0; q < n; q++) {
      for (const [txt, r, a, size] of labels(q)) arcText(g, txt, cx, cy, r * k, a, size * k, 0.05);
    }
  }

  _backPtr(pt, x, y, D, key) {
    const grp = new THREE.Group();
    grp.position.set(x, y, 0.0022);
    const L = D.r1 + ((D.r1 - D.r0) / D.turns) * 0.5 + 0.0022;
    const geos = [
      turned([[0, -14e-4], [0.0034, -14e-4], [0.0034, 0.0006, 0.6], [0.0028, 0.0011, 1], ...sharpEnds(arcPts(0, 0.0011, 0.0019, 0.0009, 0, Math.PI / 2, 5, 0.8), true, false)],
        { segs: this._segs(24), tint: TINT.gold }),
      pinGeo(0.00022, -39e-4, 0.0039, 0.0001, { tint: TINT.gold }).applyMatrix4(Z_TO_X).rotateZ(Math.PI / 2).translate(0, 0, -4e-4),
      slab(taperShape(0.0026, L, 0.0012, 0.0005), 0.0005, 0.00015, { kind: K_FILED, tint: TINT.silver }),
      turned(arcPts(0, 0.0011, 0.0008, 0.0011, -Math.PI / 2, Math.PI / 2, 8, 0.9), { segs: 12, tint: TINT.silver, rough: RC_POLISH }).applyMatrix4(Z_TO_X).translate(L - 0.0003, 0, 0),
      turned([[0, -19e-4], [0.0009, -19e-4], [0.0019, -12e-4, 0.5], [0.0019, 0.0006, 0.3], ...arcPts(0, 0.0006, 0.0023, 0.0006, 0, Math.PI / 2, 4, 0.8)],
        { segs: this._segs(20), kind: K_TURNED + K_SLIDE, tint: TINT.gold, rough: RC_POLISH }),
    ];
    const mat = this._bz(pt, [1, 1, 1], 0.14, { lift: 0, tip: [0, 0, 0], tipCol: [1.0, 0.74, 0.36] });
    const arm = this._mesh(merge$1(geos), mat, { cast: false });
    grp.add(arm);
    this.backGroup.add(grp);
    const u = mat.userData.bz;
    this.pointers.push({ u, key, w: 0, e: 0, gain: 1.1 });
    return { grp, arm, follower: null, u };
  }

  _smallPtr(pt, x, y, key) {
    const grp = new THREE.Group();
    grp.position.set(x, y, 0.0028);
    const L = 0.0088;
    const geos = [
      turned([[0, -9e-4], [0.0018, -9e-4], [0.0018, 0.0003, 0.6], [0.0014, 0.0007, 1], ...sharpEnds(arcPts(0, 0.0007, 0.0011, 0.0006, 0, Math.PI / 2, 4, 0.8), true, false)],
        { segs: this._segs(18), tint: TINT.dark }),
      slab(taperShape(0.0013, L, 0.0006, 0.0003), 0.0004, 0.0001, { kind: K_FILED, tint: TINT.dark }),
      turned(arcPts(0, 0.0007, 0.0005, 0.0007, -Math.PI / 2, Math.PI / 2, 6, 0.9), { segs: 10, tint: TINT.gold, rough: RC_POLISH }).applyMatrix4(Z_TO_X).translate(L - 0.0002, 0, 0),
    ];
    const mat = this._bz(pt, [1, 1, 1], 0.36, { lift: 0, tip: [L, 0, 0] });
    grp.add(this._mesh(merge$1(geos), mat, { cast: false }));
    this.backGroup.add(grp);
    this.pointers.push({ u: mat.userData.bz, key, w: 0, e: 0, gain: 0.8 });
    return grp;
  }

  _spiralFace(D, S, extra) {
    const k = S / 2 / D.disc, c = S / 2;
    const pitch = (D.r1 - D.r0) / D.turns;
    return paintFace(S, (g, C) => {
      g.fillStyle = C.bg;
      g.beginPath(); g.arc(c, c, D.disc * k, 0, TAU$6); g.fill();
      ring(g, c, c, (D.r0 - pitch * 0.5 - 0.001) * k, (D.r1 + pitch * 0.5 + 0.001) * k, C.polish);
      g.strokeStyle = C.engr; g.fillStyle = C.engr;
      extra(g, C, c, k, pitch);
    });
  }

  _buildPillars() {
    const zb = PLATE_Z - PLATE_HALF;
    const low = [
      [0, -0.0822], [0.0018, -0.0822], [0.0024, -0.0822 + 0.0006, 0.8], [0.0024, -0.0684], [0.005, -0.0684],
      ...arcPts(0.005, -0.0676, 0.0008, 0.0008, -Math.PI / 2, Math.PI / 2, 5, 1),
      ...arcPts(0.005, -0.0656, 0.0012, 0.0012, -Math.PI / 2, -Math.PI, 4, -0.7).slice(1),
      [0.0038, -0.0615, -0.2], [0.0045, -0.06, 0.5], [0.0045, -0.0593, 0.7], [0.0040, -0.058],
      [0.0036, -0.01], [0.0036, -36e-4], [0.0044, -22e-4, 0.6], [0.0047, -8e-4, 1, 1],
    ];
    const prof = [...low, [0.0048, 0, 1, 1], ...low.slice().reverse().map((p) => [p[0], -p[1], p[2], p[3]])];
    const geos = [turned(prof, { segs: this._segs(40) })];
    for (const s of [-1, 1]) geos.push(block(0.0115, 0.0115, 0.0038, 0.0003, { kind: K_FILED, tint: [0.96, 0.92, 0.86] }).translate(0, 0, s * (zb - 0.0019)));
    const wedge = new THREE.Shape();
    wedge.moveTo(-52e-4, -9e-4); wedge.lineTo(0.0052, -45e-5); wedge.lineTo(0.0052, 0.00045); wedge.lineTo(-52e-4, 0.0009); wedge.lineTo(-52e-4, -9e-4);
    this._wedgeShape = wedge;
    geos.push(slab(wedge, 0.0009, 0.0001, { kind: K_FILED, tint: TINT.dark, rough: RC_MATT }).translate(0, 0, -0.0802));
    const geo = merge$1(geos);
    PILLARS.forEach(([x, y], i) => {
      const grp = new THREE.Group();
      grp.position.set(x, y, 0);
      this.inner.add(grp);
      const pt = this._part('pillar' + i, grp, { axis: [0, 0, 1], kind: 'pillar' });
      grp.add(this._mesh(geo, this._bz(pt, [1.0, 0.8, 0.4], 0.18)));
    });
  }

  _trainDepth() {
    const d = { b1: 0 };
    for (const G of GEARS) {
      if (G.coax && d[G.coax] !== undefined) d[G.id] = d[G.coax];
      else if (G.mesh && d[G.mesh] !== undefined) d[G.id] = d[G.mesh] + 1;
    }
    d.k1 = d.e5 + 1; d.k2 = d.k1 + 1; d.e6 = d.k2 + 1; d.e1 = d.e6; d.b3 = d.e1 + 1;
    return d;
  }

  _wheel(G) {
    const th = G.thick || WHEEL_T, h = th / 2, hb = h + 0.00045, m = G.m || moduleOf(G.id);
    const D = wheelDims(G.N, G.spokes || 0, m);
    const { r, rootR, tipR, hubR, rimIn } = D, spokes = D.spokes;
    const bossR = spokes ? Math.min(hubR * 0.8, 0.0068) : clamp$9(rootR * 0.45, 0.0021, 0.0058);
    const colR = Math.min(0.0024, bossR * 0.78);
    const geos = [prep(wheelPlate(G.N, { spokes, thickness: th, id: G.id, m }), { kind: K_WHEEL })];
    const seg = this._segs(clamp$9(Math.round(bossR * 9000), 24, 64));
    const flip = (g) => g.rotateX(Math.PI);
    const rivet = (x, y, z, s, rad = 0.00032) => {
      const g = turned([[0, 0], ...arcPts(0, 0, rad, rad * 0.56, 0, Math.PI / 2, 3, 0.9)], { segs: 10, tint: TINT.copper });
      if (s < 0) g.rotateX(Math.PI);
      return g.translate(x, y, z);
    };
    if (spokes) {
      const band = [[rootR - 0.00045, h], [rootR - 0.00045, h + 0.00012, 0.6], [rootR - 0.00055, h + 0.00022, 1], [rimIn + 0.00045, h + 0.00022, 1], [rimIn + 0.00035, h + 0.00012, 0.6], [rimIn + 0.00035, h]];
      for (const f of [(g) => g, flip]) geos.push(f(turned(band, { segs: this._segs(clamp$9(Math.round(r * 2200), 48, 160)) })));
      for (let k = 0; k < spokes; k++) {
        const a = (k / spokes) * TAU$6;
        for (const s of [1, -1]) {
          geos.push(rivet((rimIn + 0.0012) * Math.cos(a), (rimIn + 0.0012) * Math.sin(a), s * (h + 0.00022), s, 0.00036));
          geos.push(rivet((hubR - 0.0008) * Math.cos(a), (hubR - 0.0008) * Math.sin(a), s * h, s, 0.00032));
        }
      }
    }
    const fil = arcPts(bossR + 0.0003, h + 0.0003, 0.0003, 0.0003, -Math.PI / 2, -Math.PI, 3, -0.8);
    const bossTop = [[bossR, hb - 0.0001, 0.6], [bossR - 0.0001, hb, 1]];
    const zb = hb + 0.0007;
    geos.push(turned([...fil, ...bossTop, [colR, hb, 0.1]], { segs: seg }));
    geos.push(flip(turned([...fil, ...bossTop, [colR, hb, 0.1], [colR, hb + 0.0005, 0.5], [colR - 0.0002, zb, 0.9], [0.0013, zb, 0.2]], { segs: seg })));
    geos.push(flip(prep(boreCap(0.0013, seg), { kind: K_TURNED, wear: 0.2 }).translate(0, 0, zb)));
    let zc0 = hb, sq = 0;
    if (bossR > 0.0032) {
      sq = Math.min(colR * 1.35, bossR * 0.72);
      const seat = roundRectShape(2 * sq - 0.00016, 2 * sq - 0.00016, 2 * sq * 0.08);
      const hs = BORE * Math.SQRT1_2 + 0.00011, hole = new THREE.Path();
      hole.moveTo(hs, hs); hole.lineTo(-hs, hs); hole.lineTo(-hs, -hs); hole.lineTo(hs, -hs); hole.lineTo(hs, hs);
      seat.holes.push(hole);
      geos.push(slab(seat, 0.0004 - 0.00016, 0.00008, { kind: K_FILED, tint: [1.04, 0.98, 0.9] }).rotateZ(Math.PI / 4).translate(0, 0, hb + 0.0002));
      zc0 = hb + 0.0004;
    }
    const zc1 = h + 0.0024, zt = zc1 + 0.00016;
    geos.push(turned([[colR + 0.00025, zc0, -0.6], [colR, zc0 + 0.00025, -0.3], [colR, zc1 - 0.0005, 0.2], [colR + 0.00022, zc1 - 0.00028, 0.9, 1], [colR, zc1 - 0.00006, 0.6],
      [colR - 0.00025, zt, 1], [0.0013, zt, 0.3]], { segs: seg, tint: [1.03, 1.0, 0.94] }));
    geos.push(prep(boreCap(0.0013, seg), { kind: K_TURNED, wear: 0.3, tint: [1.03, 1.0, 0.94] }).translate(0, 0, zt));
    geos.push(prep(boreTube(-zb, zt), { kind: K_FILED, wear: -1, tint: TINT.dark }));
    geos.push(pinGeo(0.0003, -(colR + 0.0009), colR + 0.0009, 0.00014, { tint: TINT.arbor }).applyMatrix4(Z_TO_X).rotateZ(G.N * 0.37).translate(0, 0, (zc0 + zc1) / 2));
    const inner = Math.max(sq * 1.45, colR + 0.0006);
    if (bossR - inner > 0.0008) {
      const rv = (inner + bossR) / 2, n = spokes || 4;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU$6 + Math.PI / n;
        for (const s of [1, -1]) geos.push(rivet(rv * Math.cos(a), rv * Math.sin(a), s * hb, s));
      }
    }
    if (G.id === 'k1') {
      geos.push(pinGeo(0.00055, 0.0006, 0.0067, 0.0003, { tint: TINT.silver }).rotateX(Math.PI).translate(PIN_RHO, 0, 0));
      geos.push(turned([[0, 0], ...arcPts(0, 0, 0.0008, 0.0003, 0, Math.PI / 2, 3, 0.9)], { segs: 12, tint: TINT.silver }).translate(PIN_RHO, 0, h));
    }
    if (G.id === 'k2') {
      const x0 = 0.0072, x1 = 0.0118, xm = (x0 + x1) / 2;
      for (const s of [1, -1]) geos.push(block(x1 - x0, 0.0006, 0.0006, 0.0001, { kind: K_FILED }).translate(xm, s * 0.00085, h + 0.0003));
      for (const x of [x0 - 0.0003, x1 + 0.0003]) geos.push(block(0.0006, 0.0023, 0.0006, 0.0001, { kind: K_FILED }).translate(x, 0, h + 0.0003));
      geos.push(slab(roundRectShape(x1 - x0, 0.0011, 0.0001), 0.00006, 0, { kind: K_FILED, wear: -1, rough: RC_ROUGH }).translate(xm, 0, h + 0.00004));
    }
    return { geo: merge$1(geos), rootR, tipR, bossR, rimIn };
  }

  _wheelLook(G, W) {
    const col = G.N > 150 ? TINT.pale : G.N % 3 === 0 ? TINT.red : TINT.bronze;
    return [col, G.N > 150 ? 0.17 : 0.2, { gear: [W.rootR, W.tipR, W.bossR, W.rimIn], pulses: clamp$9(Math.round(G.N / 45), 1, 5), seed: G.N * 0.13 }];
  }

  _buildGears() {
    const kHolder = new THREE.Group();
    kHolder.position.set(P.e[0], P.e[1], 0);
    this.inner.add(kHolder);
    this.kCarrier = kHolder;
    const kPt = this._part('kCarrier', kHolder, { axis: [0, 0, 1], kind: 'gear' });
    const depth = this._trainDepth();
    for (const G of GEARS) {
      const W = this._wheel(G);
      const holder = new THREE.Group();
      let pt;
      if (G.ax === 'k') {
        pt = kPt;
        holder.position.set(K_RADIUS + (G.id === 'k1' ? 0 : PIN_DELTA), 0, G.z);
        kHolder.add(holder);
      } else {
        holder.position.set(P[G.ax][0], P[G.ax][1], G.z);
        this.inner.add(holder);
        pt = this._part(G.id, holder, { axis: [0, 0, 1], kind: 'gear', hero: G.hero });
      }
      const look = this._wheelLook(G, W);
      const mat = this._bz(pt, ...look);
      const mesh = this._mesh(W.geo, mat);
      holder.add(mesh);
      this.gears[G.id] = { def: G, mesh, holder, k: 0, geo: null, mat, u: mat.userData.bz, pt, w: 0, e: 0, phase: 0, depth: depth[G.id] || 0, look };
    }
    const zb = Z.L5 + 0.004, kx = K_RADIUS + PIN_DELTA / 2;
    const bridge = [
      turned([[0.0016, zb - 0.0008], [0.0036, zb - 0.0008], [0.0036, zb + 0.0005, 0.6], [0.0032, zb + 0.0009, 1], [0.0016, zb + 0.0009, 0.3]], { segs: 28, tint: TINT.dark }),
      slab(taperShape(0.0025, kx, 0.0026, 0.0018), 0.0012, 0.0002, { kind: K_FILED, tint: TINT.dark }).translate(0, 0, zb),
      turned([[0, zb - 0.0008], [0.0034, zb - 0.0008], [0.0034, zb + 0.0006, 0.6], [0.003, zb + 0.001, 1], ...sharpEnds(arcPts(0, zb + 0.001, 0.0018, 0.0006, 0, Math.PI / 2, 4, 0.8), true, false)],
        { segs: 28, tint: TINT.dark }).translate(kx, 0, 0),
      pinGeo(0.0011, -32e-4, 0.0106, 0.0005, { tint: TINT.arbor, segs: 14 }).rotateX(Math.PI).translate(kx, 0, 0),
    ];
    kHolder.add(this._mesh(merge$1(bridge), this._bz(kPt, [1, 1, 1], 0.3)));
    for (const G of GEARS) {
      if (!G.mesh) continue;
      const A = this.gears[G.mesh].def;
      const pa = P[A.ax], pb = P[G.ax];
      const phi = Math.atan2(pb[1] - pa[1], pb[0] - pa[0]);
      this.gears[G.id].k = phi * (1 + A.N / G.N) + Math.PI - Math.PI / G.N;
    }
    this._gearList = Object.values(this.gears);
  }

  _buildCrank() {
    const grp = new THREE.Group();
    const thick = 0.0024, N = 48, m = moduleOf('b1');
    const r = (N * m) / 2, toothH = 2.1 * m, rD = r + 0.0016;
    const xFace = RN('b1', 224) + 1.0 * m + 0.0002;
    const xc = xFace + thick / 2;
    this.crownR = r;
    grp.position.set(xc, 0, Z.L1 - r);
    this.inner.add(grp);
    const pt = this._part('crank', grp, { axis: [1, 0, 0], kind: 'crank' });

    const rot = [];
    const pitch = (TAU$6 * r) / N;
    const tooth = new THREE.BoxGeometry(toothH, 0.0024, pitch * 0.62, 1, 1, 1);
    const tp = tooth.attributes.position;
    for (let i = 0; i < tp.count; i++) if (tp.getX(i) < 0) tp.setZ(i, tp.getZ(i) * 0.3);
    tooth.computeVertexNormals();
    const trng = makeRng$1(48);
    for (let j = 0; j < N; j++) {
      const psi = (j / N) * TAU$6 + (trng() - 0.5) * 0.012;
      const t = tooth.clone().scale(1 + (trng() - 0.5) * 0.1, 1, 1 + (trng() - 0.5) * 0.12);
      rot.push(prep(t.rotateX(psi).translate(-thick / 2 - toothH / 2, r * Math.cos(psi), r * Math.sin(psi)), { kind: K_FILED, tint: TINT.bronze }));
    }
    tooth.dispose();
    const zf = [];
    zf.push(turned([[0, -12e-4], [rD - 0.0003, -12e-4, 0.2], [rD, -9e-4, 0.9], [rD, 0.0009, 0.9], [rD - 0.0003, 0.0012, 1], [0.0062, 0.0012, 0.1],
      ...arcPts(0.0062, 0.0026, 0.0014, 0.0014, -Math.PI / 2, -Math.PI, 4, -0.7).slice(1), [0.0048, 0.0036, 0.6], [0.0044, 0.004, 1], [0.0016, 0.004, 0.3]],
    { segs: this._segs(64), tint: TINT.bronze }));
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU$6 + Math.PI / 4;
      zf.push(turned([[0, 0], ...arcPts(0, 0, 0.00032, 0.00018, 0, Math.PI / 2, 3, 0.9)], { segs: 10, tint: TINT.copper }).translate(0.0031 * Math.cos(a), 0.0031 * Math.sin(a), 0.004));
    }
    const collar = (z0) => [[0.0016, z0], [0.0025, z0 + 0.0004, 0.4], [0.0027, z0 + 0.0008, 0.9], [0.0027, z0 + 0.0026, 0.9], [0.0025, z0 + 0.003, 0.4], [0.0016, z0 + 0.0034]];
    const hz = [];
    zf.push(turned([[0, 0.0038], [0.0016, 0.0038], ...collar(0.0232), [0.0016, 0.032], [0, 0.032]], { segs: this._segs(24), tint: TINT.arbor }));
    zf.push(pinGeo(0.0003, -37e-4, 0.0037, 0.00014, { tint: TINT.arbor }).rotateX(Math.PI / 2).translate(0, 0, 0.0249));
    hz.push(turned([[0, 0.032], [0.0016, 0.032], ...collar(0.0364), [0.0016, 0.0548], [0.0012, 0.0552, 0.6], [0, 0.0552]], { segs: this._segs(24), tint: TINT.arbor }));
    hz.push(pinGeo(0.0003, -37e-4, 0.0037, 0.00014, { tint: TINT.arbor }).rotateX(Math.PI / 2).translate(0, 0, 0.0381));
    hz.push(turned([[0, 0.0492], [0.0043, 0.0492, 0.3], [0.0047, 0.0496, 0.9], [0.0047, 0.0544, 0.9], [0.0043, 0.0548, 1], [0.0016, 0.0548, 0.2]], { segs: this._segs(32), tint: TINT.gold, rough: RC_POLISH }));
    hz.push(pinGeo(0.0003, -57e-4, 0.0057, 0.00014, { tint: TINT.arbor }).rotateY(Math.PI / 2).translate(0, 0, 0.0542));
    for (const g of zf) rot.push(g.applyMatrix4(Z_TO_X));
    const hand = hz.map((g) => g.applyMatrix4(Z_TO_X));
    const armShape = new THREE.Shape();
    const Ra = 0.0045, Rb = 0.003, La = 0.031, al = Math.asin((Ra - Rb) / La);
    armShape.absarc(0, 0, Ra, Math.PI / 2 + al, 1.5 * Math.PI - al, false);
    armShape.absarc(La, 0, Rb, -Math.PI / 2 - al, Math.PI / 2 + al, false);
    armShape.closePath();
    hand.push(slab(armShape, 0.0024, 0.0004, { kind: K_FILED, tint: TINT.gold, rough: RC_POLISH, wear: 0.6, curveSegs: 12 }).applyMatrix4(TO_X).translate(0.052, 0, 0));
    const knob = [
      turned([[0.0031, 0.0536], [0.0037, 0.0538, 0.6], [0.0037, 0.0558, 0.9], [0.0033, 0.056, 0.4]], { segs: this._segs(24), tint: TINT.gold, rough: RC_POLISH }),
      turned([[0, 0.0557], [0.0033, 0.0557, -0.7], [0.0039, 0.059, 0.4, 1], [0.0042, 0.0625, 0.9, 1], [0.004, 0.066, 0.8, 1], [0.0035, 0.07, 0.3, 1],
        ...arcPts(0, 0.0725, 0.0034, 0.0032, 0, Math.PI / 2, 6, 0.2)], { segs: this._segs(28), kind: K_WOOD }),
      turned([[0, 0.0752], ...arcPts(0, 0.0752, 0.0011, 0.0009, 0, Math.PI / 2, 4, 0.9)], { segs: 12, tint: TINT.gold, rough: RC_POLISH }),
      turned([[0, 0], ...arcPts(0, 0, 0.0013, 0.0005, 0, Math.PI / 2, 4, 0.9)], { segs: 14, tint: TINT.gold, rough: RC_POLISH }).rotateX(Math.PI).translate(0, 0, 0.0504),
    ];
    for (const g of knob) hand.push(g.applyMatrix4(Z_TO_X).translate(0, 0.031, 0));
    const crankMat = this._bz(pt, [1, 1, 1], 0.22);
    this.crown = this._mesh(merge$1(rot), crankMat);
    grp.add(this.crown);
    this.handle = this._mesh(merge$1(hand), crankMat);
    grp.add(this.handle);
    this._handSet = false;
    this.crankSpin = new THREE.Group();
    this.crankSpin.position.x = 0.052;
    grp.add(this.crankSpin);

    const zp0 = -PLATE_Z + PLATE_HALF - grp.position.z;
    const bracket = [
      block(0.007, 0.0095, 0.0105, 0.0005, { kind: K_FILED, tint: TINT.arbor }).translate(0.032, 0, 0),
      ...[0.0279, 0.0354].map((z0) => turned([[0.0018, z0], [0.0036, z0], [0.0036, z0 + 0.0007, 0.7], [0.0018, z0 + 0.0007, 0.2]], { segs: 24, tint: TINT.gold }).applyMatrix4(Z_TO_X)),
      turned([[0, zp0], [0.0044, zp0, 0.2], [0.0044, zp0 + 0.0007, 0.8], ...arcPts(0.0038, zp0 + 0.0023, 0.0012, 0.0012, -Math.PI / 2, -Math.PI, 3, -0.6),
        [0.0026, -0.012], [0.0031, -0.0112, 0.9, 1], [0.0026, -0.0104], [0.0026, -68e-4], [0.0034, -6e-3, 0.6], [0.0034, -52e-4], [0, -52e-4]],
      { segs: this._segs(24), tint: TINT.arbor }).translate(0.032, 0, 0),
      pinGeo(0.0003, -58e-4, 0.0058, 0.00014, { tint: TINT.arbor }).applyMatrix4(Z_TO_X).translate(0.032, 0, -78e-4),
    ];
    grp.add(this._mesh(merge$1(bracket), this._bz(pt, [1, 1, 1], 0.3)));
  }

  _buildFront() {
    const asm = new THREE.Group();
    this.inner.add(asm);
    const pt = this._part('frontAsm', asm, { axis: [0, 0, 1], kind: 'plate' });
    const plate = this._mesh(this._plateGeo(true, 7), this._plateMat(pt, 'front'));
    plate.position.z = PLATE_Z;
    asm.add(plate);
    const zo = PLATE_Z + PLATE_HALF, Rd = 0.093;
    const metal = [];
    for (const [x, y] of PILLARS) {
      metal.push(this._washer().translate(x, y, zo));
      metal.push(slab(this._wedgeShape, 0.0009, 0.0001, { kind: K_FILED, tint: TINT.dark, rough: RC_MATT }).translate(x, y, zo + 0.0024));
    }
    metal.push(this._bezel(Rd, FACE_OFF - PLATE_HALF, 0.0016).translate(0, 0, PLATE_Z + FACE_OFF));
    metal.push(turned([[0.0016, 0], [0.0034, 0], [0.0034, 0.0006, 0.7], [0.003, 0.0009, 1], [0.0016, 0.0009, 0.2]], { segs: 24, tint: TINT.gold }).rotateX(Math.PI).translate(0, 0, PLATE_Z - PLATE_HALF));
    metal.push(turned([[0.0016, 0], [0.0052, 0], [0.0052, 0.0005, 0.7], [0.0047, 0.0009, 1], [0.0016, 0.0009, 0.3]], { segs: 40, tint: TINT.gold }).translate(0, 0, PLATE_Z + FACE_OFF));
    const metalMat = this._bz(pt, [1, 1, 1], 0.24);
    asm.add(this._mesh(merge$1(metal), metalMat));
    asm.add(this._nails(metalMat, zo, 1, (x, y) => Math.hypot(x, y) < Rd + 0.008 || (Math.abs(x) < PARA_W / 2 + 0.004 && Math.abs(Math.abs(y) - PARA_Y) < PARA_H / 2 + 0.004),
      this._rivetRing(0, 0, Rd + 0.0068, 40, (x, y) => Math.abs(x) < 0.086 && Math.abs(y) < 0.0955)));

    const S = this.texSize, k = S / 2 / Rd, c = S / 2;
    const faces = paintFace(S, (g, C) => {
      g.fillStyle = C.bg;
      g.beginPath(); g.arc(c, c, Rd * k, 0, TAU$6); g.fill();
      ring(g, c, c, 0, 0.064 * k, C.field);
      g.strokeStyle = C.engr;
      for (let r = 0.004; r < 0.064; r += 0.0011) { g.globalAlpha = 0.12; circle(g, c, c, r * k, 1.5); }
      g.globalAlpha = 1;
      ring(g, c, c, 0.066 * k, 0.0785 * k, C.enamel);
      g.strokeStyle = C.gold; g.fillStyle = C.gold;
      for (let s = 0; s < 12; s++) arcText(g, ZODIAC$1[s], c, c, 0.0700 * k, (90 - (s * 30 + 15)) * DEG$6, 0.0046 * k, 0.1);
      ring(g, c, c, 0.0795 * k, 0.0918 * k, C.polish);
      g.strokeStyle = C.engr; g.fillStyle = C.engr;
      for (let mth = 0; mth < 12; mth++) arcText(g, EGYPT[mth], c, c, 0.0845 * k, (90 - (mth * 30 + 15) * (360 / 365)) * DEG$6, 0.0044 * k, 0.14);
      arcText(g, 'ΕΠΑΓΟΜΕΝΑΙ', c, c, 0.0845 * k, (90 - (360 + 2.5) * (360 / 365)) * DEG$6, 0.0022 * k, 0.05);
    });
    const disc = new THREE.Mesh(this._dialGeo(Rd, [[0.066, 0.0785, 0.0005], [0.0795, 0.0918, 0.0005]]), this._faceMaterial(pt, faces, 2.5, { type: 1 }));
    disc.position.set(P.b[0], P.b[1], PLATE_Z + FACE_OFF);
    disc.receiveShadow = true;
    asm.add(disc);
  }

  _buildPointers() {
    const zf = ZF;
    const gemCol = [[0.34, 0.33, 0.33], [0.82, 0.77, 0.64], [0.46, 0.07, 0.04], [0.74, 0.46, 0.12], [0.09, 0.13, 0.36]];
    const boss = (r0, r1, h, tint) => turned([[r0, -h], [r1, -h], [r1, h * 0.45, 0.6], [r1 - 0.0004, h, 1], [r0, h, 0.2]], { segs: 24, tint });
    const finial = (x, len, rr, tint) => turned(arcPts(0, len / 2, rr, len / 2, -Math.PI / 2, Math.PI / 2, 8, 0.9), { segs: 12, tint, rough: RC_POLISH }).applyMatrix4(Z_TO_X).translate(x, 0, 0);
    const crossPin = (len, r, tint) => pinGeo(r, -len, len, 0.0001, { tint }).applyMatrix4(Z_TO_X).rotateZ(Math.PI / 2);

    this.planetRings = [];
    [0.028, 0.034, 0.040, 0.046, 0.052].forEach((r, i) => {
      const grp = new THREE.Group();
      grp.position.set(P.b[0], P.b[1], zf + i * 0.0005);
      this.inner.add(grp);
      const pt = this._part('ring' + i, grp, { axis: [0, 0, 1], kind: 'pointer' });
      const gem = new THREE.IcosahedronGeometry(0.003, 1);
      gem.computeVertexNormals();
      const geos = [
        turned([[r - 0.0011, -2e-4], [r + 0.0011, -2e-4], [r + 0.0011, 0.0001, 0.8], [r + 0.0008, 0.0002, 1], [r - 0.0008, 0.0002, 1], [r - 0.0011, 0.0001, 0.8]],
          { segs: this._segs(128), closed: true, tint: TINT.gold }),
        turned([[0.0038, 0], [0.0038, 0.0009, 0.6], [0.0041, 0.0012, 1], [0.0036, 0.0015, 0.9], [0.003, 0.0012, -0.6], [0.0024, 0.0008, -0.8]],
          { segs: 24, tint: TINT.gold }).translate(r, 0, 0),
        prep(gem.translate(r, 0, 0.0018), { kind: K_GEM }),
      ];
      const mat = this._bz(pt, [1, 1, 1], 0.14, { lift: 0, gem: gemCol[i], tip: [r, 0, 0.0018], tipCol: [0.9 + 0.2 * gemCol[i][0], 0.56 + 0.2 * gemCol[i][1], 0.24 + 0.2 * gemCol[i][2]] });
      grp.add(this._mesh(merge$1(geos), mat));
      this.planetRings.push(grp);
      this.pointers.push({ u: mat.userData.bz, key: 'ring' + i, w: 0, e: 0, gain: 0.7, pt });
    });

    this.dragon = new THREE.Group();
    this.dragon.position.set(P.b[0], P.b[1], zf + 0.004);
    this.inner.add(this.dragon);
    {
      const pt = this._part('dragon', this.dragon, { axis: [0, 0, 1], kind: 'pointer' });
      const geos = [
        boss(0.00135, 0.0026, 0.001, TINT.gold),
        crossPin(0.0029, 0.0002, TINT.gold),
        slab(taperShape(0.0022, 0.0205, 0.0009, 0.0005), 0.0005, 0.0001, { kind: K_FILED, tint: TINT.dark, rough: RC_MATT }),
        slab(taperShape(0.0022, 0.0195, 0.0009, 0.0004), 0.0005, 0.0001, { kind: K_FILED, tint: TINT.dark, rough: RC_MATT }).rotateZ(Math.PI),
        turned(arcPts(0, 0, 0.0021, 0.0021, -Math.PI / 2, Math.PI / 2, 10, 0.8), { segs: 20, tint: TINT.gold, rough: RC_POLISH }).translate(0.022, 0, 0),
        turned([[0, 0], [0.0012, 0], [0, 0.0022]], { segs: 12, tint: TINT.gold }).applyMatrix4(Z_TO_X).translate(0.0232, 0, 0),
        finial(0, 0.0024, 0.0007, TINT.gold).rotateZ(Math.PI).translate(-0.0195, 0, 0),
      ];
      const mat = this._bz(pt, [1, 1, 1], 0.2, { lift: 0, tip: [0.022, 0, 0] });
      this.dragon.add(this._mesh(merge$1(geos), mat));
      this.pointers.push({ u: mat.userData.bz, key: 'dragon', w: 0, e: 0, gain: 0.8, pt });
    }

    this.moonPtr = new THREE.Group();
    this.moonPtr.position.set(P.b[0], P.b[1], zf + 0.0055);
    this.inner.add(this.moonPtr);
    {
      const pt = this._part('moonPtr', this.moonPtr, { axis: [0, 0, 1], kind: 'pointer' });
      const bc = [0.060, 0, 0.002];
      const cres = new THREE.Shape();
      cres.absarc(0, 0, 0.0022, 1.0385, TAU$6 - 1.0385, false);
      cres.absarc(0.001, 0, 0.0019, TAU$6 - 1.5102, 1.5102, true);
      cres.closePath();
      const geos = [
        boss(0.00135, 0.0031, 0.0011, TINT.silver),
        crossPin(0.0035, 0.0002, TINT.silver),
        slab(taperShape(0.0026, 0.0535, 0.0011, 0.0008), 0.0006, 0.00012, { kind: K_FILED, tint: TINT.silver }),
        slab(taperShape(0.0665, 0.0715, 0.0008, 0.0005), 0.0006, 0.00012, { kind: K_FILED, tint: TINT.silver }),
        finial(0.0712, 0.0022, 0.0008, TINT.silver),
        slab(cres, 0.0004, 0.00008, { kind: K_FILED, tint: TINT.silver, rough: RC_POLISH }).translate(0.0752, 0, 0.0004),
        turned([[0.0061, -22e-4], [0.0069, -22e-4], [0.0069, 0.0032, 0.6], [0.0066, 0.0036, 1], [0.0061, 0.0036, 0.8]], { segs: 32, closed: true, tint: TINT.silver }).translate(bc[0], bc[1], 0),
        pinGeo(0.00035, -72e-4, 0.0072, 0.0001, { tint: TINT.gold }).applyMatrix4(Z_TO_X).translate(bc[0], bc[1], bc[2]),
        prep(new THREE.SphereGeometry(0.0058, 36, 22).translate(...bc), { kind: K_MOON }),
      ];
      const mat = this._bz(pt, [1, 1, 1], 0.12, { lift: 0, tip: [0.0715, 0, 0], tipCol: [0.7, 0.86, 1.0], moonC: bc });
      this.moonPtr.add(this._mesh(merge$1(geos), mat));
      this._moonU = mat.userData.bz;
      this.phaseBall = new THREE.Object3D();
      this.phaseBall.position.set(...bc);
      this.moonPtr.add(this.phaseBall);
      this.pointers.push({ u: mat.userData.bz, key: 'moon', w: 0, e: 0, gain: 1.0, pt });
    }

    this.sunPtr = new THREE.Group();
    this.sunPtr.position.set(P.b[0], P.b[1], zf + 0.0075);
    this.inner.add(this.sunPtr);
    {
      const pt = this._part('sunPtr', this.sunPtr, { axis: [0, 0, 1], kind: 'pointer' });
      const rays = new THREE.Shape();
      for (let i = 0; i < 32; i++) {
        const a = (i / 32) * TAU$6, rr = i % 2 ? 0.0047 : 0.0074;
        if (i === 0) rays.moveTo(rr * Math.cos(a), rr * Math.sin(a)); else rays.lineTo(rr * Math.cos(a), rr * Math.sin(a));
      }
      rays.closePath();
      const star = new THREE.Shape();
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * TAU$6, rr = i % 2 ? 0.0009 : 0.0017;
        if (i === 0) star.moveTo(rr * Math.cos(a), rr * Math.sin(a)); else star.lineTo(rr * Math.cos(a), rr * Math.sin(a));
      }
      star.closePath();
      const geos = [
        boss(0.0016, 0.0042, 0.0014, TINT.gold),
        turned([[0, 0.0014], ...arcPts(0, 0.0014, 0.0019, 0.0011, 0, Math.PI / 2, 5, 0.8)], { segs: 20, tint: TINT.gold }),
        crossPin(0.0048, 0.00024, TINT.gold),
        slab(taperShape(0.0038, 0.0866, 0.0013, 0.0006), 0.0007, 0.00012, { kind: K_FILED, tint: TINT.gold }),
        finial(0.0864, 0.0026, 0.0009, TINT.gold),
        slab(star, 0.0003, 0.00006, { kind: K_FILED, tint: TINT.gold, rough: RC_POLISH }).translate(0.0902, 0, 0.0003),
        slab(rays, 0.0004, 0.0001, { kind: K_FILED, tint: TINT.gold }).translate(0.0755, 0, 0.0002),
        turned(arcPts(0, 0, 0.0046, 0.0046, -Math.PI / 2, Math.PI / 2, 14, 0.5), { segs: 32, tint: TINT.gold, rough: RC_POLISH }).translate(0.0755, 0, 0.0012),
      ];
      const mat = this._bz(pt, [1, 1, 1], 0.14, { lift: 0, tip: [0.0755, 0, 0.0012], tipCol: [1.0, 0.78, 0.4] });
      this.sunPtr.add(this._mesh(merge$1(geos), mat));
      this.pointers.push({ u: mat.userData.bz, key: 'sun', w: 0, e: 0, gain: 1.3, pt });
    }
  }

  _buildSockets() {
    this.sockets = HERO_NAMES.map((id) => {
      const G = this.gears[id];
      const grp = new THREE.Group();
      grp.position.copy(G.holder.position);
      const r = pitchRadius(G.def.N, G.def.m);
      const mat = new THREE.ShaderMaterial({
        uniforms: { uA: { value: 0 }, uT: { value: 0 }, uR: { value: r }, uW: { value: 0.0012 } },
        vertexShader: SOCK_VERT, fragmentShader: SOCK_FRAG,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      });
      const ring = new THREE.Mesh(new THREE.RingGeometry(r - 0.0055, r + 0.0055, 256, 1), mat);
      ring.renderOrder = 7;
      grp.add(ring);
      grp.visible = false;
      grp.userData = { ring, a: 0 };
      this.inner.add(grp);
      return grp;
    });
  }

  _caseMat(pt) {
    const m = new THREE.MeshStandardMaterial({ color: new THREE.Color(1, 1, 1), metalness: 1, roughness: 0.5, vertexColors: true });
    m.defines = { BZ_CASE: '' };
    bronzify(m, this._bzU(pt));
    m.userData.envK = 0.5;
    return patchMaterial(m, {});
  }

  _buildCase() {
    const grp = new THREE.Group();
    this.inner.add(grp);
    const pt = this._part('case', grp, { axis: [0, 0, -1], kind: 'case' });
    const X0 = PLATE_W / 2 + 0.003, Y0 = PLATE_H / 2 + 0.003, T = 0.009, Zc = 0.086;
    const XO = X0 + T, YO = Y0 + T;
    const G = [];
    const wood = (w, h, d, grain, o = {}) => wearBevels(block(w, h, d, 0.0009, { kind: K_WOOD, rough: grain, ...o }));
    const dome = (r, h, tint = TINT.copper) => turned([[0, 0], ...arcPts(0, 0, r, h, 0, Math.PI / 2, 3, 0.9)], { segs: 8, tint });
    for (const sy of [1, -1]) G.push(wood(2 * XO, T, 2 * Zc, 0).translate(0, sy * (Y0 + T / 2), 0));
    for (const sx of [1, -1]) {
      for (const sz of [1, -1]) G.push(wood(T, 2 * Y0, 0.012, 1).translate(sx * (X0 + T / 2), 0, sz * (Zc - 0.006)));
      for (const sy of [1, -1]) G.push(wood(T, 0.026, 2 * Zc - 0.024, 2).translate(sx * (X0 + T / 2), sy * (Y0 - 0.013), 0));
    }
    for (const sz of [1, -1]) {
      const zl = sz * (PLATE_Z + PLATE_HALF + 0.0025);
      for (const sx of [1, -1]) G.push(wood(0.0042, 2 * Y0, 0.0045, 1).translate(sx * (X0 - 0.0018), 0, zl));
      for (const sy of [1, -1]) G.push(wood(2 * X0 - 0.008, 0.0042, 0.0045, 0).translate(0, sy * (Y0 - 0.0018), zl));
    }
    const peg = () => turned([[0, 0], [0.0012, 0], [0.0012, 0.0005, 0.3], ...arcPts(0, 0.0005, 0.0012, 0.0004, 0, Math.PI / 2, 3, 0.6)], { segs: 10, kind: K_WOOD, rough: 2 });
    for (const sx of [1, -1]) for (const sy of [1, -1]) for (const sz of [1, -1]) {
      const x = sx * (X0 + T / 2), z = sz * (Zc - 0.006);
      G.push(wood(T * 0.72, 0.0014, 0.0092, 1).translate(x, sy * (YO + 0.0005), z));
      G.push(block(T * 0.8, 0.0016, 0.0007, 0.00005, { kind: K_WOOD, wear: -1 }).translate(x, sy * (YO + 0.0007), z));
      G.push(peg().rotateX(sz > 0 ? 0 : Math.PI).translate(sx * (X0 - 0.008), sy * (Y0 + T / 2), sz * Zc));
      G.push(peg().applyMatrix4(Z_TO_X).rotateY(sx > 0 ? 0 : Math.PI).translate(sx * XO, sy * (Y0 - 0.013), sz * (Zc - 0.006)));
    }
    const prof = new THREE.Shape();
    prof.moveTo(-4e-3, 0);
    prof.lineTo(0.0012, 0);
    prof.lineTo(0.0012, 0.0007);
    prof.quadraticCurveTo(0.0025, 0.0008, 0.0025, 0.0021);
    prof.quadraticCurveTo(0.0025, 0.0034, 0.0008, 0.0036);
    prof.lineTo(-4e-3, 0.0036);
    prof.lineTo(-4e-3, 0);
    const run = (len, grain) => {
      const g = new THREE.ExtrudeGeometry(prof, { depth: len, bevelEnabled: false, curveSegments: 5 });
      g.computeVertexNormals();
      return wearBevels(prep(g, { kind: K_WOOD, rough: grain }), 0.7);
    };
    const LF = 2 * XO + 0.005, LS = 2 * (Zc - 0.004);
    const tops = [
      run(LF, 0).rotateY(-Math.PI / 2).translate(LF / 2, YO, Zc),
      run(LF, 0).rotateY(Math.PI / 2).translate(-LF / 2, YO, -Zc),
      run(LS, 2).translate(XO, YO, -LS / 2),
      run(LS, 2).rotateY(Math.PI).translate(-XO, YO, LS / 2),
    ];
    for (const g of tops) { G.push(g); G.push(g.clone().rotateX(Math.PI)); }
    const L = new THREE.Shape();
    L.moveTo(0, 0); L.lineTo(0.03, 0); L.lineTo(0.03, 0.0085); L.lineTo(0.0085, 0.0085); L.lineTo(0.0085, 0.03); L.lineTo(0, 0.03); L.lineTo(0, 0);
    const turn = { '-1,-1': 0, '1,-1': Math.PI / 2, '1,1': Math.PI, '-1,1': -Math.PI / 2 };
    for (const sz of [1, -1]) for (const sx of [1, -1]) for (const sy of [1, -1]) {
      const fx = sz > 0 ? sx : -sx;
      const br = [slab(L, 0.0006, 0.00015, { kind: K_FILED, tint: TINT.gold })];
      for (const [u, v] of [[0.006, 0.0042], [0.016, 0.0042], [0.026, 0.0042], [0.0042, 0.016], [0.0042, 0.026]]) br.push(dome(0.0007, 0.0004).translate(u, v, 0.0003));
      const b = merge$1(br).rotateZ(turn[fx + ',' + sy]).translate(fx * XO, sy * YO, Zc + 0.0005);
      if (sz < 0) b.rotateY(Math.PI);
      G.push(b);
      G.push(block(0.0085, 0.0006, 0.012, 0.0001, { kind: K_FILED, tint: TINT.gold }).translate(sx * (XO - 0.00425), sy * (YO + 0.0003), sz * (Zc - 0.006)));
      G.push(block(0.0006, 0.0085, 0.012, 0.0001, { kind: K_FILED, tint: TINT.gold }).translate(sx * (XO + 0.0003), sy * (YO - 0.00425), sz * (Zc - 0.006)));
    }
    for (const sz of [1, -1]) for (const sy of [1, -1]) {
      G.push(block(2 * XO - 0.066, 0.0045, 0.0005, 0.0001, { kind: K_FILED, tint: TINT.gold }).translate(0, sy * (Y0 + T / 2), sz * (Zc + 0.00025)));
      for (let x = -XO + 0.042; x < XO - 0.04; x += 0.018) G.push(dome(0.0006, 0.00035).rotateX(sz > 0 ? 0 : Math.PI).translate(x, sy * (Y0 + T / 2), sz * (Zc + 0.0005)));
    }
    const yTop = YO + 0.0036;
    for (const sx of [1, -1]) {
      G.push(turned([[0, 0], [0.0034, 0], [0.0034, 0.0007, 0.5], [0.0027, 0.0013, 0.9], [0.0017, 0.0017, 0.4], ...arcPts(0, 0.0017, 0.0017, 0.0026, 0, Math.PI / 2, 5, 0.8)],
        { segs: 16, tint: TINT.gold }).rotateX(-Math.PI / 2).translate(sx * 0.034, yTop, 0));
      G.push(dome(0.0009, 0.0005, TINT.gold).applyMatrix4(Z_TO_X).rotateY(sx > 0 ? 0 : Math.PI).translate(sx * 0.0357, yTop + 0.0027, 0));
    }
    const bail = new THREE.TorusGeometry(0.0342, 0.00135, 10, 48, Math.PI);
    G.push(prep(bail, { kind: K_TURNED, tint: TINT.gold, wear: 0.8, rough: RC_POLISH }).rotateX(-Math.PI / 2 - 0.05).translate(0, yTop + 0.0027, 0));
    const hx = -XO - 0.0026, hz = Zc + 0.0026;
    for (const y of [0.1, -0.1]) {
      G.push(turned([[0, -0.014], [0.0021, -0.014], [0.0024, -0.0136, 0.6], [0.0024, 0.0136, 0.6], [0.0021, 0.014, 0.3], [0, 0.014]], { segs: 14, tint: TINT.gold })
        .rotateX(-Math.PI / 2).translate(hx, y, hz));
      for (const s of [1, -1]) G.push(dome(0.0009, 0.0005, TINT.gold).rotateX(-s * Math.PI / 2).translate(hx, y + s * 0.014, hz));
      G.push(block(0.0006, 0.024, 0.016, 0.0001, { kind: K_FILED, tint: TINT.gold }).translate(-XO - 0.0003, y, Zc - 0.008));
      for (const dy of [-8e-3, 0, 0.008]) G.push(dome(0.0006, 0.00035).rotateY(-Math.PI / 2).translate(-XO - 0.0006, y + dy, Zc - 0.009));
    }
    grp.add(this._mesh(merge$1(G), this._caseMat(pt)));

    const CW = 2 * Zc + 0.0045, CH = 2 * YO - 0.001;
    const cg = new THREE.ExtrudeGeometry(roundRectShape(CW, CH, 0.008, CW / 2, 0), { depth: 0.0024, bevelEnabled: true, bevelThickness: 0.0006, bevelSize: 0.0006, bevelSegments: 2, curveSegments: 6 });
    wearBevels(prep(cg, { kind: K_FILED, uv: true }));
    const f = this._coverFaces(CW, CH);
    const T3 = { col: tex(f.col, true, this.aniso), mr: tex(f.mr, false, this.aniso), bump: tex(f.bump, false, this.aniso) };
    for (const t of Object.values(T3)) { t.repeat.set(1 / CW, 1 / CH); t.offset.set(0, 0.5); }
    const cm = new THREE.MeshStandardMaterial({ map: T3.col, metalnessMap: T3.mr, roughnessMap: T3.mr, bumpMap: T3.bump, bumpScale: 1.4, metalness: 1, roughness: 1 });
    bronzify(cm, this._bzU(pt, { seed: 5.5 }));
    const cover = this._mesh(cg, patchMaterial(cm, { corrode: true, corrodeU: pt.corrode, corrodeScale: 55 }));
    cover.position.set(hx, 0, hz);
    cover.rotation.y = COVER_REST;
    grp.add(cover);
    this.cover = cover;
  }

  _coverFaces(CW, CH) {
    const H = this.texSize >= 1024 ? 1024 : 512, W = Math.round((H * CW) / CH), k = W / CW;
    const text = [
      'ΤΟ ΔΕ ΠΡΟΣΩΠΟΝ ΤΟΥ ΟΡΓΑΝΟΥ', 'ΕΝ ΩΙ Ο ΖΩΙΔΙΑΚΟΣ ΚΥΚΛΟΣ', 'ΚΑΙ ΑΙ ΤΟΥ ΕΤΟΥΣ ΗΜΕΡΑΙ', 'Ο ΓΝΩΜΩΝ ΤΟΥ ΗΛΙΟΥ ΦΕΡΕΤΑΙ',
      'ΤΟ ΤΗΣ ΣΕΛΗΝΗΣ ΣΦΑΙΡΙΟΝ', 'ΔΕΙΚΝΥΣΙ ΤΑΣ ΦΑΣΕΙΣ', 'ΑΙ ΤΩΝ ΠΛΑΝΗΤΩΝ ΑΚΤΙΝΕΣ', 'ΕΡΜΟΥ ΑΦΡΟΔΙΤΗΣ ΑΡΕΩΣ',
      'ΔΙΟΣ ΚΡΟΝΟΥ ΣΦΑΙΡΙΑ', 'ΕΠΙ ΤΩΝ ΚΥΚΛΩΝ ΦΕΡΟΝΤΑΙ', 'ΟΠΙΣΘΕΝ Η ΕΛΙΞ ΤΩΝ ΜΗΝΩΝ', 'ΔΙΗΡΗΜΕΝΗ ΕΙΣ ΤΜΗΜΑΤΑ ΣΛΕ',
      'Η ΔΕ ΚΑΤΩ ΕΛΙΞ ΤΩΝ ΕΚΛΕΙΨΕΩΝ', 'ΤΜΗΜΑΤΑ ΣΚΓ ΕΝ ΣΠΕΙΡΑΙΣ Δ', 'Σ ΣΕΛΗΝΗ Η ΗΛΙΟΣ', 'ΩΡΑΙ ΚΑΙ ΧΡΩΜΑΤΑ',
      'ΤΑ ΔΕ ΛΟΙΠΑ ΕΝ ΤΩΙ ΠΑΡΑΠΗΓΜΑΤΙ', 'ΕΠΙΤΟΛΑΙ ΚΑΙ ΔΥΣΕΙΣ ΑΣΤΡΩΝ',
    ];
    const out = {};
    for (const pass of ['col', 'mr', 'bump']) {
      const s = pass === 'mr' ? 0.5 : 1;
      const c = canvas$1(Math.round(W * s), Math.round(H * s));
      const g = c.getContext('2d');
      g.scale(s, s);
      const C = PASS[pass];
      g.fillStyle = C.base;
      g.fillRect(0, 0, W, H);
      const rng = makeRng$1(311);
      g.globalAlpha = pass === 'bump' ? 0.2 : 0.07;
      for (let i = 0; i < 1400; i++) {
        g.fillStyle = rng() < 0.5 ? C.engr : C.polish;
        g.beginPath();
        g.ellipse(rng() * W, rng() * H, 1.5 + rng() * 4, 1 + rng() * 3, rng() * 3, 0, TAU$6);
        g.fill();
      }
      g.globalAlpha = 1;
      g.save();
      g.translate(W, 0);
      g.scale(-1, 1);
      g.strokeStyle = C.engr;
      g.lineWidth = 0.0006 * k;
      g.strokeRect(0.007 * k, 0.007 * k, W - 0.014 * k, H - 0.014 * k);
      g.lineWidth = 0.0003 * k;
      g.strokeRect(0.0095 * k, 0.0095 * k, W - 0.019 * k, H - 0.019 * k);
      g.textAlign = 'left';
      g.textBaseline = 'middle';
      g.font = `700 ${Math.round(0.0062 * k)}px ${FONT_GR$1}`;
      const trng = makeRng$1(97);
      text.forEach((ln, i) => {
        const y = (0.028 + i * 0.0165) * k;
        const a = 0.55 + 0.45 * trng();
        if (pass === 'col') { g.globalAlpha = a * 0.5; g.fillStyle = '#e0b574'; g.fillText(ln, 0.017 * k + 1.2, y + 1.2); }
        g.globalAlpha = a;
        g.fillStyle = C.engr;
        g.fillText(ln, 0.017 * k, y);
      });
      g.globalAlpha = 1;
      g.restore();
      out[pass] = c;
    }
    return out;
  }

  _angles(months, th = {}) {
    const Y = (months * 29.530589) / 365.24219;
    th.b1 = TAU$6 * Y;
    for (const G of GEARS) {
      if (G.id === 'b1') continue;
      const me = this.gears[G.id];
      if (G.coax) th[G.id] = th[G.coax];
      else if (G.mesh) th[G.id] = -(this.gears[G.mesh].def.N / G.N) * th[G.mesh] + me.k;
      else if (G.special === 'e6') {
        const a1 = -(th.e5 - th.e3);
        const eq = wrapPi$1(pinSlot(a1) - a1);
        th.k1 = a1;
        th.k2 = a1 + eq;
        th.e6 = th.e3 - th.k2;
      }
    }
    th.a1 = -4.666666666666667 * th.b1 + (Math.PI / 2 - Math.PI / 48);
    return th;
  }

  setMonths(months) {
    this.months = months;
    const th = this._angles(months, this._thA);
    for (const G of GEARS) {
      const a = th[G.id], w = G.N > 100 ? 0.0013 : 0.0022;
      this.gears[G.id].mesh.rotation.set(w * Math.sin(a + G.N), w * Math.cos(a + G.N * 1.7), a);
    }
    if (this._looseHeroes) for (let i = 0; i < this._looseHeroes.length; i++) this._looseSync(this._looseHeroes[i]);
    this.kCarrier.rotation.z = th.e3;
    this.crown.rotation.x = th.a1;
    if (!this._handSet) this.handle.rotation.x = th.a1;
    this.crankSpin.rotation.x = this.handle.rotation.x;
    const st = skyState(months);
    const dial = (lon) => (90 - lon) * DEG$6;
    this.sunPtr.rotation.z = dial(st.sun);
    const moonA = dial(this.sky0.moon) - (th.b3 - (this.th0 ? this.th0.b3 : th.b3));
    this.moonPtr.rotation.z = moonA;
    this.phaseBall.rotation.x = moonA - this.sunPtr.rotation.z - Math.PI / 2;
    const pa = this.phaseBall.rotation.x;
    this._moonU.bzMoon.value.set(0, Math.cos(pa), Math.sin(pa), 0);
    this.planetRings.forEach((r, i) => { r.rotation.z = dial(st.planets[i]); });
    this.dragon.rotation.z = dial(st.node);
    this.state = st;
    const t0 = this.th0 || th;
    const psiN = Math.abs(th.n1 - t0.n1);
    const psiG = Math.abs(th.g1 - t0.g1);
    this._spiralPtr(this.metPtr, METONIC, psiN);
    this._spiralPtr(this.sarPtr, SAROS_D, psiG);
    this.olyPtr.rotation.z = -Math.PI / 2 + Math.abs(th.o1 - t0.o1);
    this.exePtr.rotation.z = Math.PI / 3 - Math.abs(th.i1 - t0.i1);
    this.sarosPsi = psiG;
    this.metPsi = psiN;
    this._trackSpeeds(th, moonA);
    if (months >= SAROS - 1e-6 && this.assembly) this.igniteGlyph();
    this._tickGlow();
    return st;
  }

  _spiralPtr(p, D, psi) {
    p.grp.rotation.z = D.a0 - psi;
    const r = spiralR(D, Math.min(psi, D.turns * TAU$6));
    p.u.bzSlide.value = r;
    p.u.bzTip.value.x = r;
  }

  _ptrAngle(key, moonA) {
    switch (key) {
      case 'sun': return this.sunPtr.rotation.z;
      case 'moon': return moonA;
      case 'dragon': return this.dragon.rotation.z;
      case 'met': return this.metPtr.grp.rotation.z;
      case 'sar': return this.sarPtr.grp.rotation.z;
      case 'oly': return this.olyPtr.rotation.z;
      case 'exe': return this.exePtr.rotation.z;
      default: return this.planetRings[Number(key.slice(4))].rotation.z;
    }
  }

  _trackSpeeds(th, moonA) {
    const now = this._clock();
    for (const p of this.pointers) p.ang = this._ptrAngle(p.key, moonA);
    const S = this._spPrev;
    if (S.th && now - S.t < 0.004) return;
    if (S.th) {
      const dtm = now - S.t;
      const a = 1 - Math.exp(-dtm / 0.1);
      for (const G of GEARS) {
        const g = this.gears[G.id];
        g.w += ((th[G.id] - S.th[G.id]) / dtm - g.w) * a;
      }
      this._crownW += ((th.a1 - S.th.a1) / dtm - this._crownW) * a;
      for (const p of this.pointers) {
        const d = p.key === 'moon' ? p.ang - p.prev : wrapPi$1(p.ang - p.prev);
        p.w += (d / dtm - p.w) * a;
      }
    } else S.th = {};
    for (const p of this.pointers) p.prev = p.ang;
    for (const k in th) S.th[k] = th[k];
    S.t = now;
  }

  updateGlyphs(dt, onGlyph) {
    const cell = Math.floor((this.sarosPsi / (SAROS_D.turns * TAU$6)) * SAROS_D.cells + 1e-6);
    if (cell > this.lastCell) {
      for (let c = this.lastCell + 1; c <= cell; c++) {
        const idx = c % SAROS_D.cells;
        const E = this.eclipses[idx];
        for (let q = 0; q < 2; q++) {
          const kind = GLYPH_KINDS[q];
          if (!E[kind]) continue;
          const G = this.glyphs[kind];
          const j = G.cells.indexOf(idx);
          if (j >= 0) G.flash[j] = 1;
          if (onGlyph) onGlyph(kind, c);
        }
      }
    }
    this.lastCell = cell;
    const col = this._col;
    for (let q = 0; q < 2; q++) {
      const G = this.glyphs[GLYPH_KINDS[q]];
      let dirty = !this._glyphInit;
      for (let j = 0; j < G.flash.length; j++) {
        if (G.flash[j] > 0 || !this._glyphInit) {
          G.flash[j] = Math.max(0, G.flash[j] - dt * 0.7);
          col.copy(G.base).multiplyScalar(0.55 + G.flash[j] * 9.0);
          G.mesh.setColorAt(G.off + j, col);
          dirty = true;
        }
      }
      if (dirty) G.mesh.instanceColor.needsUpdate = true;
    }
    this._glyphInit = true;
    const I = this._ign;
    if (I.on) {
      if (I.tp < 0.8) { I.tp += dt; this.sarPtr.grp.rotation.z -= ratchet(I.tp); }
      this._ignApply();
    }
    this._stir(dt, 0.8);
    return cell;
  }

  _clock() { return performance.now() / 1000; }

  setEnergy(k) {
    this._energy = clamp$9(Number(k) || 0, 0, 1);
    this._tickGlow();
  }

  _tickGlow() {
    const now = this._clock();
    if (this._glowT >= 0 && now - this._glowT < 0.002) return;
    const dt = this._glowT < 0 ? 0 : Math.min(0.1, now - this._glowT);
    this._glowT = now;
    this._uTime.value += dt;
    const E = this._energy;
    this._luTick(dt);
    let kMax = 0;
    for (let i = 0; i < this._gearList.length; i++) {
      const g = this._gearList[i];
      const target = E * 0.75 * resp(g.w);
      g.e += (target - g.e) * (1 - Math.exp(-dt / (0.06 + 0.11 * g.depth)));
      const f = g.u.bzFlow.value;
      const vis = Math.sign(g.w) * Math.min(2.5 * Math.abs(g.w), 6.5);
      g.phase = (g.phase + dt * f.z * (vis - g.w)) % TAU$6;
      f.x = g.phase;
      f.y = g.e * 1.3;
      if (g.def.ax === 'k') kMax = Math.max(kMax, g.e); else g.pt.eGlow = g.e;
    }
    this.parts.kCarrier.eGlow = kMax;
    this._crownE += (E * 0.75 * resp(this._crownW) - this._crownE) * (1 - Math.exp(-dt / 0.06));
    this.parts.crank.eGlow = this._crownE;
    for (let i = 0; i < this.pointers.length; i++) {
      const p = this.pointers[i];
      const target = E * (0.35 + 0.65 * resp(p.w * 1.6));
      p.e += (target - p.e) * (1 - Math.exp(-dt / 0.15));
      p.u.bzTip.value.w = p.e * p.gain + (p.lu || 0) * 0.45;
      if (p.pt) p.pt.eGlow = p.e * 0.18;
    }
    this._engr += (E * 0.55 - this._engr) * (1 - Math.exp(-dt / 0.3));
    for (let i = 0; i < this._faceU.length; i++) this._faceU[i].bzEngr.value = this._engr;
    for (let i = 0; i < this.partList.length; i++) {
      const pt = this.partList[i];
      let a = 0;
      if (pt.state === 'moving' || (pt.state === 'queued' && pt.fromHero && pt.fromHero.direct)) a = pt.aGlow;
      else if (pt.seatT > 0) {
        const s = now - pt.seatT;
        if (s < 1.8) a = pt.peak * Math.exp(-3.2 * s); else pt.seatT = 0;
      }
      if (pt.ripT > 0 && now >= pt.ripT) {
        const x = now - pt.ripT;
        if (x < 1.2) a += pt.ripA * Math.exp(-x * 4.5) * Math.min(1, x / 0.07); else pt.ripT = 0;
      }
      pt.glow.value = a;
      pt.luU.value.set(Math.min(1, 0.6 * pt.luGlow + 0.75 * pt.eGlow), pt.luGlint);
    }
    this._ignTick(dt);
  }

  flying(out = []) {
    const M = this.inner.matrixWorld;
    let n = 0;
    for (let i = 0; i < this.partList.length; i++) {
      const pt = this.partList[i];
      if ((pt.state !== 'moving' && pt.state !== 'settling') || pt.inSet) continue;
      const o = this._flyPool[n] || (this._flyPool[n] = { name: '', pos: new V3$1() });
      o.name = pt.name;
      o.pos.copy(pt.cLocal).applyQuaternion(pt.obj.quaternion).add(pt.obj.position).applyMatrix4(M);
      out[n++] = o;
    }
    const sets = this.assembly && this.assembly.sets;
    if (sets) {
      for (let i = 0; i < sets.length; i++) {
        const S = sets[i];
        if (S.state !== 'moving' && S.state !== 'settling') continue;
        if (S.state === 'moving' && !(S.path && S.sNow >= S.path.sClear)) continue;
        const o = this._flyPool[n] || (this._flyPool[n] = { name: '', pos: new V3$1() });
        o.name = S.name;
        o.pos.copy(S.X).applyMatrix4(M);
        out[n++] = o;
      }
    }
    out.length = n;
    return out;
  }

  _ripple(src) {
    const now = this._clock();
    for (const q of this.partList) {
      if (q === src || q.state !== 'seated') continue;
      const d = q.cInner.distanceTo(src.cInner);
      const amp = 0.5 * Math.exp(-d / 0.07);
      if (amp < 0.05) continue;
      if (q.ripT > 0 && now < q.ripT + 0.25 && q.ripA >= amp) continue;
      q.ripT = now + 0.04 + d / 0.3;
      q.ripA = amp;
    }
  }

  _awaken() {
    const now = this._clock();
    for (const q of this.partList) {
      q.ripT = now + 0.15 + (q.cInner.z + 0.09) * 5.5;
      q.ripA = q.kind === 'plate' ? 0.55 : 0.9;
    }
  }

  place(pos, yaw) {
    this.group.position.copy(pos);
    this.group.rotation.set(0, yaw, 0);
    this.group.updateMatrixWorld(true);
  }

  setEnv(tex, intensity = 1.0) {
    this.envTex = tex;
    this._envI = intensity;
    this.group.traverse((o) => {
      if (!o.isMesh || !o.material) return;
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        if (m.isMeshStandardMaterial) { m.envMap = tex; m.envMapIntensity = intensity * 0.6 * (m.userData.envK || 1); m.needsUpdate = true; }
      }
    });
    for (const m of this._looseMats) { m.envMap = tex; m.envMapIntensity = intensity * 0.6; m.needsUpdate = true; }
  }

  showAllForCompile(on) {
    for (const pt of this.partList) pt.obj.visible = on;
    for (const s of this.sockets) s.visible = on;
  }

  startAssembly({ fx, onLand, onSocket, onCrack, onLump, pile }) {
    this.group.updateMatrixWorld(true);
    this._fx = fx || null;
    for (const pt of this.partList) {
      pt.corrode.value = pt.hero !== undefined ? 0 : 1;
      pt.obj.visible = false;
      pt.state = 'hidden';
      pt.aGlow = 0; pt.seatT = 0; pt.ripT = 0; pt.glow.value = 0; pt.inSet = null; pt.jit = null; pt.fromHero = null;
      pt.eGlow = 0; pt.luGlow = 0; pt.luGlint = 0; pt.luU.value.set(0, 0);
    }
    if (this.cover) this.cover.rotation.y = COVER_REST;
    this._coverT = -1;
    this._sockA = 0; this._sockIdx = -1; this._uSock.value.w = 0; this.sockFocus = -1; this.sockLit = -1; this.holdArrivals = false;
    for (const s of this.sockets) { s.visible = false; s.userData.a = 0; }
    this._backA = 0; this._uBack.value = 0;
    this._handSet = false;
    this._ign.on = false; this._ign.L = 0; this._ign.tp = 0; this._ign.tg = 0;
    this._ignApply();
    const lumps = pile && pile.length ? pile.map((L) => ({ p: L.p.clone(), q: L.q.clone(), r: L.r })) : null;
    this.assembly = {
      fx, onLand, onSocket, onCrack, onLump, step: -1, stepT: 0, waiting: false, done: false, active: [], sets: [],
      pile: lumps, pileTop: lumps ? pile.top : -Infinity, lumpLeft: PILE_N.slice(), lumpOut: [],
    };
    this._startStep(0);
  }

  assemblyLeft() {
    const A = this.assembly;
    if (!A || A.done) return 0;
    let left = 0;
    for (let i = Math.max(0, A.step); i < PLAN.length; i++) {
      const S = PLAN[i];
      if (!S.sets) continue;
      let d = 0;
      S.sets.forEach((def, j) => { d = Math.max(d, j * (S.gap || 0.8) + PRE_ROLL + (def.name === 'case' ? 2.5 : def.kind === 'plate' || def.kind === 'dialSet' ? 2.05 : 1.85) + 0.45); });
      left += i === A.step ? Math.max(0, d - A.stepT) : d;
    }
    return left;
  }
  seated(name) {
    const A = this.assembly;
    if (!A) return false;
    const k = PLAN.findIndex((S) => S.sets && S.sets.some((d) => d.name === name));
    if (k < 0 || A.step > k || A.done) return A.step > k || A.done;
    if (A.step < k) return false;
    const set = A.sets.find((x) => x.name === name);
    return !!set && set.state === 'seated';
  }
  setAvoid(p, r = 0.8) {
    if (!p) { this._avoid = null; return; }
    const v = this._avoid || (this._avoid = { p, r });
    v.p = p;
    v.r = r;
  }
  _held(set) {
    const A = this.assembly, v = this._avoid, P = set.path;
    if (this.holdArrivals && set.axis.z > 0.5) return true;
    if (A.sets.some((o) => o !== set && o.startAt < set.startAt && o.state !== 'seated' && !(o.t >= 0))) return true;
    return !!(v && P && Math.hypot(v.p.x - P.spotW.x, v.p.z - P.spotW.z) < P.rW + v.r);
  }

  _startStep(i) {
    const A = this.assembly;
    A.step = i;
    A.stepT = 0;
    A.sets = [];
    if (i >= PLAN.length) { A.done = true; this._awaken(); return; }
    const S = PLAN[i];
    if (S.hero !== undefined) {
      A.waiting = true;
      A.heroWaiting = S.hero;
      this.sockets[S.hero].visible = true;
      this._sockIdx = S.hero;
      if (A.onSocket) A.onSocket(S.hero);
      return;
    }
    A.waiting = false;
    A.sets = S.sets.map((def, j) => this._makeSet(def, j * (S.gap || 0.8)));
    A.active = [].concat(...A.sets.map((s) => s.members));
  }

  looseWheel({ id, N = 60, spokes = 0, thickness = 0.002 } = {}) {
    const own = this.gears[id];
    let G, geo, look;
    if (own) {
      G = own.def;
      geo = own.mesh.geometry;
      look = own.look;
    } else {
      G = { id: String(id || 'x' + N), N: clamp$9(Math.round(N), 12, 400), spokes: spokes | 0, thick: thickness, m: moduleOf(id) };
      const W = this._wheel(G);
      geo = W.geo;
      look = this._wheelLook(G, W);
    }
    const ptL = { glow: { value: 0 }, corrode: { value: 0 }, seed: own ? own.pt.seed : 5.3 + G.N * 0.071, luU: { value: new THREE.Vector2() } };
    const mat = this._bz(ptL, ...look);
    const u = { sweep: { value: 0 }, sweepK: { value: 0 }, hover: { value: 0 }, hint: { value: 0 } };
    const teeth = { value: new THREE.Vector2(G.N, 0) };
    Object.assign(mat.userData.bz, { bzSweep: u.sweep, bzSweepK: u.sweepK, bzHover: u.hover, bzHint: u.hint, bzTeeth: teeth });
    mat.defines.BZ_LOOSE = '';
    if (this.envTex) { mat.envMap = this.envTex; mat.envMapIntensity = (this._envI ?? 1) * 0.6; }
    this._looseMats.push(mat);
    const mesh = this._mesh(geo, mat);
    mesh.name = 'looseWheel';
    const obj = new THREE.Group();
    obj.name = 'loose-' + G.id;
    obj.add(mesh);
    if (own) {
      const L = { mesh, src: own.mesh, teeth: teeth.value };
      this._looseHeroes.push(L);
      this._looseSync(L);
    }
    return { obj, u, glow: ptL.glow };
  }

  _looseSync(L) {
    L.mesh.rotation.copy(L.src.rotation);
    L.teeth.y = -L.src.rotation.z / TAU$6;
  }

  heroSocketWorld(idx) {
    const pt = this.parts[HERO_NAMES[idx]];
    return this.inner.localToWorld(pt.final.p.clone().addScaledVector(pt.axis, 0.16));
  }

  placeHero(idx, fromWorld, fromQuatWorld, opts = {}) {
    const A = this.assembly;
    if (!A || !A.waiting || A.heroWaiting !== idx) return;
    const pt = this.parts[HERO_NAMES[idx]];
    const direct = !!(opts && opts.direct);
    const g0 = opts && opts.glow !== undefined ? Math.max(0, +opts.glow || 0) : 1;
    pt.fromHero = { p: fromWorld.clone(), q: fromQuatWorld ? fromQuatWorld.clone() : null, direct, glow: g0 };
    pt.state = 'queued';
    pt.startAt = 0;
    pt.t = 0;
    pt.seatedEvent = false;
    A.waiting = false;
    A.active = [pt];
    if (direct) {
      pt.obj.position.copy(fromWorld).applyMatrix4(this._m4.copy(this.inner.matrixWorld).invert());
      if (fromQuatWorld) this.inner.getWorldQuaternion(pt.obj.quaternion).invert().multiply(fromQuatWorld);
      pt.obj.visible = true;
      pt.aGlow = pt.fromHero.glow;
      pt.glow.value = pt.fromHero.glow;
    }
  }

  lightUp(p = 0) {
    this._luP = clamp$9(Number(p) || 0, 0, 1);
    this._tickGlow();
  }

  _luTick(dt) {
    this._luS = (this._luS || 0) + ((this._luP || 0) - (this._luS || 0)) * (1 - Math.exp(-dt / 0.3));
    const LP = this._luS;
    const uF = luSeg(LP, 0, 0.33), uG = luSeg(LP, 0.33, 0.66), uB = luSeg(LP, 0.66, 1);
    for (let i = 0; i < this._faceU.length; i++) {
      const u = this._faceU[i], L = u.bzLight.value;
      if (u.luKey === 'front') { L.set(0.34 * luOn(uF, 0.12), 0.02 + 0.1 * uF, 0.012, 0); continue; }
      L.set(0, 1, 0.01, 0);
      const met = u.luKey === 'met';
      u.bzSpir.value.x = (met ? this.metPsi : this.sarosPsi) || 0;
      u.bzSpir.value.y = Math.max(met ? luOn(uB, 0.12) : luOn(uB, 0.5), this._engr * 0.9);
    }
    for (let i = 0; i < this.pointers.length; i++) {
      const p = this.pointers[i], a = LU_AT[p.key];
      p.lu = a ? luOn(a[0] ? uB : uF, a[1]) : 0;
      if (p.pt) p.pt.luGlow = p.lu;
    }
    for (let i = 0; i < this._gearList.length; i++) {
      const g = this._gearList[i];
      const lv = luOn(uG, 0.14 + 0.72 * (g.depth / 7), 0.22);
      g.pt.luGlow = lv;
      g.pt.luGlint = 4 * lv * (1 - lv);
    }
    const c = luOn(uG, 0.1, 0.15);
    this.parts.crank.luGlow = c;
    this.parts.crank.luGlint = 4 * c * (1 - c);
  }

  _makeSet(def, startAt = 0) {
    const members = def.parts.map((n) => this.parts[n]);
    const center = new V3$1();
    for (const pt of members) center.add(pt.cInner);
    center.divideScalar(members.length);
    const lead = members[0];
    const box = new THREE.Box3();
    for (const pt of members) box.union(pt.boxInner);
    const set = {
      name: def.name, kind: def.kind || lead.kind, explicit: !!def.kind, hero: undefined, members, parts: members, turn: !!def.turn, startAt,
      hasPlate: members.some((pt) => pt.kind === 'plate'), isCase: lead.kind === 'case', center, axis: lead.axis.clone(),
      final: { p: center.clone(), q: new THREE.Quaternion(), s: new V3$1(1, 1, 1) }, cInner: center.clone(),
      half: box.getSize(new V3$1()).multiplyScalar(0.5), boxC: box.getCenter(new V3$1()).sub(center),
      obj: lead.obj, state: 'queued', t: 0, sNow: 0, path: null, seatedEvent: false, broke: false, jit: null, fromHero: null,
      X: new V3$1(), Q: new THREE.Quaternion(), qz: new THREE.Quaternion(), tmp: new V3$1(), fxAcc: 0, fxAcc2: 0,
    };
    for (const pt of members) { pt.inSet = set; pt.state = 'queued'; pt.seatedEvent = false; }
    return set;
  }

  _setPath(set) {
    const sc = this.scale, A = this.assembly;
    const inv = this._m4.copy(this.inner.matrixWorld).invert();
    const F = set.final.p, ax = set.axis;
    const S = F.clone().addScaledVector(ax, set.isCase ? 0.2 : 0.16);
    const k = PILE_OF[set.name] ?? PILE_N.length - 1, L = A.pile && A.pile[k];
    const spot = L ? L.p.clone() : this.inner.localToWorld(new V3$1(0, 0, -2.7 / sc));
    if (!L) spot.y = floorHeight(spot.x, spot.z) + 0.05;
    const lq = L ? L.q : IDQ;
    const n = PILE_N[k] || 1, j = n - (A.lumpOut[k] = (A.lumpOut[k] || 0) + 1);
    spot.addScaledVector(new V3$1(1, 0, 0).applyQuaternion(lq), (j - (n - 1) / 2) * 0.04);
    const hv = [set.half.x, set.half.y, set.half.z], cv = [set.boxC.x, set.boxC.y, set.boxC.z];
    let kk = 0;
    for (let i = 1; i < 3; i++) if (hv[i] < hv[kk]) kk = i;
    const off = set.members[0].cInner.getComponent(kk) - set.center.getComponent(kk);
    let sgn = Math.abs(off) > 1e-4 ? Math.sign(off) : (set.axis.getComponent(kk) < -0.5 ? -1 : 1);
    if (set.kind === 'dialSet') sgn = set.axis.getComponent(kk) < -0.5 ? -1 : 1;
    let h = 7;
    for (let i = 0; i < set.name.length; i++) h = (h * 31 + set.name.charCodeAt(i)) % 997;
    const lieQ = new THREE.Quaternion().setFromUnitVectors(new V3$1().setComponent(kk, sgn), Y_AXIS);
    const lieQW = lq.clone().multiply(new THREE.Quaternion().setFromAxisAngle(Y_AXIS, (h / 997) * TAU$6)).multiply(lieQ);
    const q0 = this.inner.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(lieQW);
    const hz = hv[kk] + Math.abs(cv[kk]);
    const rxy = Math.max(set.half.x, set.half.y) + Math.hypot(set.boxC.x, set.boxC.y);
    const hzW = hz * sc, rW = rxy * sc;
    const top = Math.max(A.pileTop, spot.y);
    const B = spot.clone().applyMatrix4(inv);
    const E1 = new V3$1(spot.x, top + Math.max(hzW, rW * 0.7) + 0.25, spot.z).applyMatrix4(inv);
    const pts = [B, E1];
    if (ax.z > 0.5) {
      const side = Math.sign(E1.x) || 1, outR = 0.13 + rxy;
      pts.push(new V3$1(side * outR, lerp$4(E1.y, S.y, 0.65), clamp$9(E1.z * 0.4, -0.06, S.z)));
      pts.push(new V3$1(side * outR * 0.8 + S.x * 0.2, S.y + 0.012, S.z + 0.09));
    } else if (ax.z < -0.5) {
      pts.push(new V3$1(lerp$4(E1.x, S.x, 0.6), lerp$4(E1.y, S.y, 0.8), S.z - (set.isCase ? 0.17 : 0.09)));
    } else {
      if (Math.sign(E1.x) !== Math.sign(S.x) && Math.abs(S.x) > 0.02) {
        const cb = this.parts.case ? this.parts.case.boxInner : null, half = cb ? Math.max(Math.abs(cb.min.x), Math.abs(cb.max.x)) : 0.15;
        pts.push(new V3$1(Math.sign(S.x) * (half + 0.03), lerp$4(E1.y, S.y, 0.5), -0.195));
      }
      pts.push(new V3$1(S.x + 0.075, lerp$4(E1.y, S.y, 0.7), S.z + (E1.z >= S.z ? 0.06 : -0.06)));
    }
    pts.push(S);
    const dirIn = new V3$1().subVectors(F, S).normalize();
    const P = this._pathBuild(pts, this._up, dirIn, F);
    P.q0 = q0;
    P.dirIn = dirIn;
    P.spotW = spot;
    P.rW = rW;
    P.lump = L ? k : -1;
    P.sBreak = 0.05 / sc;
    P.sClear = 0.5 * P.segL[1];
    P.sE = P.segL[1];
    P.sS = P.Lc;
    P.tip0 = P.sClear;
    P.tip1 = P.sE + 0.65 * (P.sS - P.sE);
    P.g0 = L ? clamp$9(L.r / Math.max(rW, 1e-3), 0.15, 1) : 1;
    P.gS = P.sClear;
    P.gE = P.sE + 0.6 * ((P.segL[2] || P.sE) - P.sE);
    P.T = set.isCase ? 2.5 : set.hasPlate || set.kind === 'dialSet' ? 2.05 : 1.85;
    P.spin = set.kind === 'gear' ? 2.4 : set.turn ? 1.3 : 0;
    P.big = set.isCase ? 2.4 : set.hasPlate || set.kind === 'dialSet' ? 1.6 : set.members.length > 2 ? 1.2 : 1;
    P.vEnd = (FLY_VEND * P.L) / P.T;
    return P;
  }

  _pathBuild(pts, t0, t1, end) {
    const n = pts.length, K = 32;
    const d = new Float32Array(n - 1);
    for (let i = 0; i < n - 1; i++) d[i] = Math.max(1e-5, pts[i].distanceTo(pts[i + 1]));
    const m = pts.map(() => new V3$1());
    m[0].copy(t0).normalize();
    m[n - 1].copy(t1).normalize();
    const a = new V3$1(), b = new V3$1();
    for (let i = 1; i < n - 1; i++) {
      a.subVectors(pts[i], pts[i - 1]).divideScalar(d[i - 1]);
      b.subVectors(pts[i + 1], pts[i]).divideScalar(d[i]);
      m[i].copy(a).multiplyScalar(d[i]).addScaledVector(b, d[i - 1]).divideScalar(d[i - 1] + d[i]);
    }
    const P = { n, pts, m, d, K, cum: new Float32Array((n - 1) * K + 1), segL: new Float32Array(n), t1: m[n - 1].clone(), Lc: 0, L: 0 };
    const p = new V3$1(), q = new V3$1().copy(pts[0]);
    let acc = 0, k = 0;
    for (let i = 0; i < n - 1; i++) {
      for (let j = 1; j <= K; j++) {
        this._herm(P, i, j / K, p);
        acc += p.distanceTo(q);
        q.copy(p);
        P.cum[++k] = acc;
      }
      P.segL[i + 1] = acc;
    }
    P.Lc = acc;
    P.L = acc + end.distanceTo(pts[n - 1]);
    return P;
  }

  _herm(P, i, u, out) {
    const u2 = u * u, u3 = u2 * u, d = P.d[i];
    return out.copy(P.pts[i]).multiplyScalar(2 * u3 - 3 * u2 + 1).addScaledVector(P.m[i], (u3 - 2 * u2 + u) * d)
      .addScaledVector(P.pts[i + 1], 3 * u2 - 2 * u3).addScaledVector(P.m[i + 1], (u3 - u2) * d);
  }

  _pathAt(P, s, out) {
    if (s >= P.Lc) return out.copy(P.pts[P.n - 1]).addScaledVector(P.t1, Math.min(s, P.L) - P.Lc);
    if (s <= 0) return out.copy(P.pts[0]);
    let lo = 0, hi = P.cum.length - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (P.cum[mid] <= s) lo = mid; else hi = mid; }
    const g = (lo + (s - P.cum[lo]) / Math.max(1e-9, P.cum[hi] - P.cum[lo])) / P.K;
    const i = Math.min(P.n - 2, Math.floor(g));
    return this._herm(P, i, g - i, out);
  }

  _animateSet(set, dt) {
    const A = this.assembly;
    if (set.state === 'queued') {
      if (A.stepT < set.startAt) return;
      set.state = 'moving';
      set.t = -PRE_ROLL;
      set.path = this._setPath(set);
      const g = set.isCase ? 0.5 : set.hasPlate ? 0.9 : set.kind === 'gear' ? 0.75 : 0.85;
      for (const pt of set.members) { pt.state = 'moving'; pt.obj.visible = true; pt.gTarget = g; pt.seatT = 0; pt.t = 0; }
    }
    if (set.state !== 'moving' && set.state !== 'settling') return;
    if (set.state === 'moving' && set.t < 0 && set.t + dt >= 0 && this._held(set)) set.t = Math.max(set.t, -0.02);
    else set.t += dt * this._giveWay(set, dt);
    const P = set.path, X = set.X, Q = set.Q;
    let turn = 0, g = 1;
    if (set.state === 'moving') {
      const tau = set.t / P.T, f = flyF(tau), s = f * P.L;
      set.sNow = s;
      g = P.g0 + (1 - P.g0) * smoother$1((s - P.gS) / Math.max(1e-4, P.gE - P.gS));
      this._pathAt(P, s, X);
      const hang = set.gw === undefined ? 0 : clamp$9(1 - set.gw, 0, 1);
      if (hang > 0.001) { set.hangT = (set.hangT || 0) + dt; X.y += 0.003 * hang * Math.sin(set.hangT * 1.9); }
      Q.copy(P.q0).slerp(IDQ, smoother$1((s - P.tip0) / Math.max(1e-4, P.tip1 - P.tip0)));
      const sp = s < P.sS ? 1 - s / P.sS : 0;
      if (P.spin && sp > 0) Q.multiply(set.qz.setFromAxisAngle(set.axis, P.spin * sp * sp));
      turn = (1 - f) * (1 - f);
      const fB = P.sBreak / P.L, fS = P.sS / P.L;
      const corrode = 1 - smoothstep(fB, fB + 0.65 * (fS - fB), f);
      const glow = smoothstep(fB * 0.5, fB + 0.1, f) * (0.86 + 0.14 * Math.sin(set.t * 9)) + 0.3 * smoothstep(0.75, 1, tau);
      for (const pt of set.members) { pt.corrode.value = corrode; pt.aGlow = pt.gTarget * glow; }
      this._riseFx(set, dt, s);
      if (set.t >= P.T) {
        set.state = 'settling';
        set.seatedEvent = true;
        const now = this._clock();
        const peak = set.isCase ? 1.2 : set.hasPlate || set.kind === 'dialSet' ? 2.4 : 1.9;
        for (const pt of set.members) { pt.state = 'settling'; pt.seatedEvent = true; pt.peak = peak; pt.seatT = now; pt.corrode.value = 0; }
        this._ripple(set);
        if (set.isCase) this._coverT = 0;
        const w = this._w.copy(set.final.p).applyMatrix4(this.inner.matrixWorld);
        if (A.onLand) A.onLand(w.clone(), set.explicit || set.members.length > 1 ? set : set.members[0]);
      }
    }
    if (set.state === 'settling') {
      const s2 = Math.max(0, set.t - P.T);
      X.copy(set.final.p).addScaledVector(P.dirIn, P.vEnd * s2 * Math.exp(-s2 / 0.07));
      Q.identity();
      if (s2 > 0.45) { set.state = 'seated'; X.copy(set.final.p); for (const pt of set.members) pt.state = 'seated'; }
    }
    let k = 0;
    for (const pt of set.members) {
      let ang = 0;
      if (set.turn && pt.kind === 'pointer') { ang = (k % 2 ? -1 : 1) * (0.9 - 0.07 * k) * turn; k++; }
      pt.obj.position.copy(set.tmp.copy(pt.final.p).sub(set.center).multiplyScalar(g).applyQuaternion(Q).add(X));
      pt.obj.quaternion.copy(Q).multiply(pt.final.q);
      if (ang) pt.obj.quaternion.multiply(set.qz.setFromAxisAngle(set.axis, ang));
      pt.obj.scale.copy(pt.final.s).multiplyScalar(g);
    }
  }

  _giveWay(set, dt) {
    const P = set.path;
    let want = 1;
    if (!this.holdArrivals) set.gwMode = 0;
    else if (set.state === 'moving' && set.t >= 0 && P && set.axis.z > 0.5) {
      if (!set.gwMode) set.gwMode = P.segL[2] && set.sNow < P.segL[2] ? 1 : 2;
      if (set.gwMode === 1) want = 0;
      else if (!(set.sNow >= P.Lc && set.X.z + set.boxC.z + set.half.z < this.handZ - 0.02)) want = GIVE_HURRY;
    }
    const r = set.gw === undefined ? 1 : set.gw;
    set.gw = r + (want - r) * (1 - Math.exp(-dt / 0.12));
    return set.gw;
  }

  _crust(fx, x, y, z, vx, vy, vz, size, ground) {
    const c = CRUST_CLUMP[Math.floor(Math.random() * CRUST_CLUMP.length)], sh = 0.8 + Math.random() * 0.4;
    fx.flakes.spawn(x, y, z, vx, vy, vz, 1.6 + Math.random() * 1.6, size, c[0] * sh, c[1] * sh, c[2] * sh, ground);
  }

  _riseFx(set, dt, s) {
    const A = this.assembly, fx = A.fx, P = set.path;
    const spot = P.spotW, big = P.big, oS = this._oSilt, rW = P.rW, ground = floorHeight(spot.x, spot.z);
    if (set.t < 0) {
      const k = 1 + set.t / PRE_ROLL;
      set.fxAcc += dt * (8 + 26 * k);
      let n = Math.floor(set.fxAcc);
      set.fxAcc -= n;
      while (n-- > 0) {
        const th = Math.random() * TAU$6, r = Math.sqrt(Math.random()) * 0.2;
        this._crust(fx, spot.x + Math.cos(th) * r, spot.y + 0.04, spot.z + Math.sin(th) * r,
          Math.cos(th) * 0.12 * Math.random(), 0.1 + 0.3 * k * Math.random(), Math.sin(th) * 0.12 * Math.random(), 0.006 + 0.008 * Math.random(), ground);
      }
      set.fxAcc2 += dt * (4 + 14 * k);
      const m = Math.floor(set.fxAcc2);
      if (m > 0) {
        set.fxAcc2 -= m;
        oS.spread = 0.25; oS.color = CRUST_DUST; oS.up = 0.08 + 0.1 * k; oS.life = 3.2; oS.size = 0.1; oS.push = null; oS.ground = ground;
        fx.silt(spot, m, oS);
      }
      return;
    }
    if (!set.broke && s >= P.sBreak) {
      set.broke = true;
      set.fxAcc = 0;
      set.fxAcc2 = 0;
      const rb = Math.sqrt(big);
      oS.spread = 0.3 + 0.1 * rb; oS.color = CRUST_DUST; oS.up = 0.4; oS.life = 4.2; oS.size = 0.16 * rb; oS.push = null; oS.ground = ground;
      fx.silt(spot, Math.round(26 * big), oS);
      for (let i = Math.round(34 * big); i > 0; i--) {
        const th = Math.random() * TAU$6, r = Math.sqrt(Math.random()) * 0.25, sp = 0.2 + 0.5 * Math.random();
        this._crust(fx, spot.x + Math.cos(th) * r, spot.y + 0.05, spot.z + Math.sin(th) * r,
          Math.cos(th) * sp, 0.5 + 0.9 * Math.random(), Math.sin(th) * sp, 0.012 + 0.018 * Math.random(), ground);
      }
      if (P.lump >= 0) {
        const k = P.lump, first = A.lumpLeft[k] === PILE_N[k];
        A.lumpLeft[k] = Math.max(0, A.lumpLeft[k] - 1);
        if (first && A.onCrack) A.onCrack(k, big / 2.4);
        if (A.onLump) A.onLump(k, A.lumpLeft[k], PILE_N[k]);
      }
    }
    if (set.broke && s < P.sE) {
      const w = this._w.copy(set.X).applyMatrix4(this.inner.matrixWorld);
      const k = 1 - clamp$9((s - P.sBreak) / Math.max(1e-4, P.sE - P.sBreak), 0, 1);
      set.fxAcc += dt * 70 * big * k;
      let n = Math.floor(set.fxAcc);
      set.fxAcc -= n;
      while (n-- > 0) {
        const th = Math.random() * TAU$6, r = Math.sqrt(Math.random()) * rW * 0.6;
        this._crust(fx, w.x + Math.cos(th) * r, w.y - 0.03, w.z + Math.sin(th) * r,
          (Math.random() - 0.5) * 0.2, -0.15 - 0.4 * Math.random(), (Math.random() - 0.5) * 0.2, 0.006 + 0.012 * Math.random(), ground);
      }
      set.fxAcc2 += dt * 14 * big * k;
      const m = Math.floor(set.fxAcc2);
      if (m > 0) {
        set.fxAcc2 -= m;
        oS.spread = rW * 0.5; oS.color = CRUST_DUST; oS.up = -0.05; oS.life = 3.0; oS.size = 0.09; oS.push = null; oS.ground = ground;
        fx.silt(w, m, oS);
      }
    }
  }

  _heroPath(pt) {
    const inv = this._m4.copy(this.inner.matrixWorld).invert();
    const F = pt.final.p;
    const S = F.clone().addScaledVector(pt.axis, 0.16);
    const E0 = pt.fromHero.p.clone().applyMatrix4(inv);
    const q0 = pt.fromHero.q ? this.inner.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(pt.fromHero.q) : pt.final.q.clone();
    const dirIn = new V3$1().subVectors(F, S).normalize();
    let P;
    if (pt.fromHero.direct || E0.distanceTo(S) < 0.01) {
      P = { n: 1, pts: [E0], Lc: 0, L: E0.distanceTo(F), t1: new V3$1().subVectors(F, E0).normalize(), T: 0.55 };
    } else {
      const W = S.clone().addScaledVector(pt.axis, 0.06);
      P = this._pathBuild([E0, W, S], new V3$1().subVectors(W, E0).normalize(), dirIn, F);
      P.T = 1.3;
    }
    P.q0 = q0;
    P.dirIn = dirIn;
    P.vEnd = (FLY_VEND * P.L) / P.T;
    return P;
  }

  _animatePart(pt, dt) {
    const A = this.assembly;
    if (pt.state === 'queued') {
      if (A.stepT < pt.startAt) return;
      pt.state = 'moving';
      pt.t = 0;
      pt.path = this._heroPath(pt);
      pt.obj.visible = true;
      pt.gTarget = 1.0;
      pt.seatT = 0;
    }
    if (pt.state !== 'moving' && pt.state !== 'settling') return;
    pt.t += dt;
    const P = pt.path, pos = this._w2, q = this._q;
    if (pt.state === 'moving') {
      const f = flyF(pt.t / P.T);
      this._pathAt(P, f * P.L, pos);
      q.copy(P.q0).slerp(pt.final.q, smoother$1(f / 0.8));
      pt.corrode.value = 0;
      pt.aGlow = pt.gTarget * (1 + 0.35 * f);
      if (pt.fromHero && pt.fromHero.direct) pt.aGlow = lerp$4(pt.fromHero.glow, pt.aGlow, smoothstep(0, 0.35, pt.t));
      if (pt.t >= P.T) {
        pt.state = 'settling';
        pt.seatedEvent = true;
        pt.peak = 2.6;
        pt.seatT = this._clock();
        this._ripple(pt);
        const w = this._w.copy(pt.final.p).applyMatrix4(this.inner.matrixWorld);
        if (A.onLand) A.onLand(w.clone(), pt);
      }
    }
    if (pt.state === 'settling') {
      const s2 = Math.max(0, pt.t - P.T);
      pos.copy(pt.final.p).addScaledVector(P.dirIn, P.vEnd * s2 * Math.exp(-s2 / 0.07));
      q.copy(pt.final.q);
      if (s2 > 0.4) { pt.state = 'seated'; pos.copy(pt.final.p); }
    }
    pt.obj.position.copy(pos);
    pt.obj.quaternion.copy(q);
    pt.obj.scale.copy(pt.final.s);
  }

  _socketTick(dt, t) {
    const A = this.assembly;
    const foc = this.sockLit >= 0 ? this.sockLit : A && A.waiting && A.heroWaiting !== undefined ? A.heroWaiting : -1;
    const open = !!A && !A.done && A.step >= HERO_STEP;
    this._sockHot = (this._sockHot || 0) + ((foc >= 0 && this.sockFocus === foc ? 1 : 0) - (this._sockHot || 0)) * (1 - Math.exp(-dt * 6));
    const hot = 1 + 0.8 * this._sockHot;
    for (let k = 0; k < this.sockets.length; k++) {
      const s = this.sockets[k], d = s.userData;
      const to = open && this.parts[HERO_NAMES[k]].state === 'hidden' && k === foc ? 1 : 0;
      d.a += (to - d.a) * (1 - Math.exp(-dt * (to > d.a ? 1.6 : 5)));
      s.visible = d.a > 0.01;
      if (!s.visible) continue;
      const u = d.ring.material.uniforms;
      u.uA.value = d.a * hot * (1.5 + 0.5 * (0.82 + 0.18 * Math.sin(t * 2.1 + k)));
      u.uT.value = t;
    }
    if (foc >= 0 && this.parts[HERO_NAMES[foc]].state === 'hidden') this._sockIdx = foc;
    const i = this._sockIdx;
    const lit = i >= 0 && i === foc && this.parts[HERO_NAMES[i]].state === 'hidden';
    this._sockA += ((lit ? 1 : 0) - this._sockA) * (1 - Math.exp(-dt * (lit ? 1.6 : 5)));
    if (i < 0) return;
    if (!lit && this._sockA < 0.01) {
      this._uSock.value.w = 0;
      this._sockIdx = -1;
      return;
    }
    const G = this.gears[HERO_NAMES[i]];
    const r = pitchRadius(G.def.N, G.def.m), sc = this.scale;
    const c = this.inner.localToWorld(this._w2.copy(G.holder.position));
    const breath = 0.82 + 0.18 * Math.sin(t * 2.1 + i);
    this._uSock.value.set(c.x, c.y, c.z, this._sockA * 1.6 * breath);
    const sig = r * sc * 1.0;
    this._uSockK.value = 1 / (2 * sig * sig);
    const fx = A && A.fx;
    if (!fx || !lit) return;
    this._sockAcc += dt * 16;
    const n = Math.floor(this._sockAcc);
    if (n <= 0) return;
    this._sockAcc -= n;
    const ex = this._v.set(1, 0, 0).transformDirection(this.inner.matrixWorld);
    const ez = this._s3.set(0, 0, 1).transformDirection(this.inner.matrixWorld);
    const R0 = r * sc * 1.7;
    for (let j = 0; j < n; j++) {
      const a = Math.random() * TAU$6, ca = Math.cos(a), sa = Math.sin(a);
      const rr = R0 * (0.8 + 0.4 * Math.random()), fz = (0.04 + 0.2 * Math.random()) * sc * 0.02;
      const life = 1.1 + Math.random() * 0.5, sp = rr / life;
      const vr = -0.85 * sp, vt = 0.5 * sp;
      fx.sparks.spawn(
        c.x + ex.x * ca * rr + ez.x * fz, c.y + sa * rr, c.z + ex.z * ca * rr + ez.z * fz,
        ex.x * (ca * vr - sa * vt), sa * vr + ca * vt, ex.z * (ca * vr - sa * vt),
        life, 0.005 + Math.random() * 0.007, 1.0, 0.7, 0.34);
    }
  }

  _coverTick(dt) {
    if (this._coverT < 0 || !this.cover) return;
    this._coverT += dt;
    const t = this._coverT, OPEN = 24 * DEG$6;
    let a;
    if (t < 0.26) a = OPEN * easeOutCubic(t / 0.26);
    else if (t < 0.72) { const u = (t - 0.26) / 0.46; a = OPEN * (1 - u * u); }
    else {
      const q = t - 0.72;
      a = OPEN * 0.16 * Math.exp(-q * 9) * Math.abs(Math.sin(q * 14));
      if (q > 0.8) { a = 0; this._coverT = -1; }
    }
    this.cover.rotation.y = COVER_REST + a;
  }

  _backTick(dt) {
    const A = this.assembly;
    let target = 0;
    if (A && A.step >= 1) {
      let s = 0;
      for (let i = 0; i < this._gearList.length; i++) if (this._gearList[i].pt.state === 'seated') s++;
      const cs = this.parts.case.state;
      target = (0.4 + 0.6 * (s / this._gearList.length)) * (cs === 'seated' || cs === 'settling' ? 0.35 : 1);
    }
    this._backA += (target - this._backA) * (1 - Math.exp(-dt * 1.5));
    this._uBack.value = this._backA * 0.85;
  }

  _stir(dt, k = 1) {
    const fx = this._fx;
    if (!fx || k <= 0) return;
    this._stirAcc += dt * 6 * k;
    const n = Math.floor(this._stirAcc);
    if (n <= 0) return;
    this._stirAcc -= n;
    const o = this._oSilt;
    for (let j = 0; j < n; j++) {
      const w = this.inner.localToWorld(this._w.set((Math.random() - 0.5) * 0.3, 0, (Math.random() - 0.5) * 0.24));
      w.y = floorHeight(w.x, w.z) + 0.02;
      o.spread = 0.3; o.color = SAND_COL; o.up = 0.06 + 0.07 * Math.random(); o.life = 4.5; o.size = 0.09; o.push = null; o.ground = w.y;
      fx.silt(w, 1, o);
    }
  }

  updateAssembly(dt, t = 0) {
    const A = this.assembly;
    if (!A) return true;
    this._socketTick(dt, t);
    this._coverTick(dt);
    this._backTick(dt);
    if (A.done) { this._stir(dt); this._tickGlow(); return true; }
    const back = this.parts.backDials;
    for (let i = 0; i < this.glyphMats.length; i++) this.glyphMats[i].opacity = 1 - back.corrode.value;
    if (A.step >= 1) this._stir(dt);
    if (A.waiting) { this._tickGlow(); return false; }
    A.stepT += dt;
    let all = true;
    if (A.sets && A.sets.length) {
      for (let i = 0; i < A.sets.length; i++) {
        const s = A.sets[i];
        this._animateSet(s, dt);
        if (s.state !== 'seated') all = false;
      }
    } else {
      for (let i = 0; i < A.active.length; i++) {
        const pt = A.active[i];
        this._animatePart(pt, dt);
        if (pt.state !== 'seated') all = false;
      }
    }
    if (all) this._startStep(A.step + 1);
    this._tickGlow();
    return A.done;
  }

  igniteGlyph() {
    const I = this._ign;
    if (I.on) return;
    I.on = true;
    I.tp = 0;
    I.tg = 0;
    I.L = 0;
  }

  _ignTick(dt) {
    const I = this._ign;
    if (!I.on) return;
    I.tg += dt;
    const t = I.tg;
    I.L = t < 0.04 ? 0 : t < 0.24 ? easeOutCubic((t - 0.04) / 0.2) : 1 - 0.4 * smoothstep(1.6, 5.0, t);
    this._ignApply();
    const u = this._sarU;
    if (u) {
      const k = clamp$9((t - 0.08) / 0.62, 0, 1);
      u.bzSpir.value.z = k * (SAROS_D.turns * TAU$6 + 1.5) - 0.75;
      u.bzSpir.value.w = (1 - smoothstep(0.85, 1, k)) * smoothstep(0.08, 0.16, t);
    }
  }

  _ignApply() {
    const I = this._ign, q = this._ignQuad;
    if (I.j < 0 || !q) return;
    const L = I.L;
    q.visible = L > 0.002;
    if (!q.visible) return;
    q.position.set(I.p.x, I.p.y, I.p.z + 0.0035 * smoothstep(0, 0.3, L));
    q.quaternion.copy(I.q);
    q.scale.setScalar(0.55 + 0.45 * easeOutCubic(Math.min(1, L * 1.2)));
    q.material.color.setRGB(1.0, 0.78, 0.46).multiplyScalar(2.4 * L);
  }

  worldPoint(local) { return this.inner.localToWorld(new V3$1(...local)); }
  get frontCenter() { return this.worldPoint([0, 0, PLATE_Z]); }
  get backSarosCenter() { return this.worldPoint([P.g[0], P.g[1], -PLATE_Z]); }
  get crankWorld() { return this.worldPoint([RN('b1', 224) + 0.06, 0, Z.L1 - this.crownR]); }

  setCrankAngle(rad) {
    this._handSet = true;
    this.handle.rotation.x = this.th0.a1 - (Number(rad) || 0);
    this.crankSpin.rotation.x = this.handle.rotation.x;
  }

  crankKnobWorld(out = new V3$1(), final = false) {
    const a = this.handle.rotation.x;
    return out.set(0.0655, 0.031 * Math.cos(a), 0.031 * Math.sin(a)).applyMatrix4(this._crankM(final));
  }

  crankAxisWorld(out = new V3$1(), final = false) {
    return out.set(1, 0, 0).transformDirection(this._crankM(final));
  }

  crankGripFrame() {
    const g = this._grip || (this._grip = { inv: new THREE.Matrix4(), s: 1, p: new V3$1() });
    this.handle.updateWorldMatrix(true, false);
    g.inv.copy(this.handle.matrixWorld).invert();
    g.s = g.p.setFromMatrixScale(this.handle.matrixWorld).x;
    return g;
  }
  crankGripSD(x, y, z) {
    const g = this._grip || this.crankGripFrame();
    const p = g.p.set(x, y, z).applyMatrix4(g.inv);
    const u = p.x, rho = Math.hypot(p.y - 0.031, p.z);
    const P = KNOB_PROF, u0 = P[0][0], u1 = P[P.length - 1][0];
    let d;
    if (u < u0) d = Math.hypot(u0 - u, Math.max(0, rho - P[0][1]));
    else if (u > u1) d = Math.hypot(u - u1, rho);
    else {
      let i = 1;
      while (i < P.length - 1 && P[i][0] < u) i++;
      const [a0, r0] = P[i - 1], [a1, r1] = P[i];
      d = rho - (r0 + (r1 - r0) * (u - a0) / Math.max(1e-9, a1 - a0));
      if (d < 0) d = Math.max(d, u0 - u, u - u1);
    }
    const t = Math.min(1, Math.max(0, p.y / 0.031));
    const dq = Math.hypot(p.y - t * 0.031, p.z) - (0.0045 - 0.0015 * t), dx = Math.abs(u - 0.052) - 0.0014;
    const dArm = dx > 0 && dq > 0 ? Math.hypot(dx, dq) : Math.max(dx, dq);
    return Math.min(d, dArm) * g.s;
  }
  get crankKnobR() { return 0.0042 * (this._grip ? this._grip.s : this.scale); }
  _crankM(final) {
    const pt = this.parts.crank;
    if (!final) { pt.obj.updateWorldMatrix(true, false); return pt.obj.matrixWorld; }
    this.inner.updateWorldMatrix(true, false);
    const m = this._m4c || (this._m4c = new THREE.Matrix4());
    return m.compose(pt.final.p, pt.final.q, pt.final.s).premultiply(this.inner.matrixWorld);
  }
}

